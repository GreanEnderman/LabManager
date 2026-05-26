"""Approval service layer for formal approval workflows."""

from datetime import datetime
from uuid import uuid4

from psycopg import AsyncConnection

from app.approvals.models import AIApprovalDTO, AIApprovalRecord, CreateApprovalRequest, ProcessApprovalRequest
from app.tasks.models import AITaskRecord, AuditActor
from app.approvals.repository import (
    create_approval,
    get_approval_by_id,
    get_latest_approval_for_task,
    list_approvals,
    update_approval_processing,
)
from app.tasks.repository import create_task_action, get_task_by_id, update_task_status
from app.tasks.repository import update_task_metadata
from app.tasks.repository import list_tasks
from app.tasks.models import ListTasksQuery
from psycopg.types.json import Json


class ApprovalNotFoundError(Exception):
    """Raised when an approval is not found."""


class ApprovalService:
    """Service for approval operations."""

    def __init__(self, conn: AsyncConnection):
        self.conn = conn

    async def list_approvals(self) -> list[AIApprovalDTO]:
        await self.ensure_required_task_approvals()
        approvals = await list_approvals(self.conn)
        return [self._to_dto(item) for item in approvals]

    async def ensure_required_task_approvals(self) -> int:
        tasks = await list_tasks(self.conn, ListTasksQuery())
        created_count = 0
        for task in tasks:
            if not self._needs_human_intervention_approval(task):
                continue
            existing = await get_latest_approval_for_task(self.conn, task.id)
            if existing and existing.status in {"pending", "needs_info"}:
                continue
            await self.create_approval(
                CreateApprovalRequest(
                    task_id=task.id,
                    title=f"{task.title} approval",
                    reason=task.recommendation or "Task requires human intervention before continuing.",
                    risk_level=task.risk_level,
                    requested_by=AuditActor(id="system", name="Approval Automation", type="system"),
                    metadata={"source": "approval_backfill"},
                )
            )
            created_count += 1
        return created_count

    async def get_latest_task_approval(self, task_id: str) -> AIApprovalDTO | None:
        approval = await get_latest_approval_for_task(self.conn, task_id)
        if approval is None:
            return None
        return self._to_dto(approval)

    async def create_approval(self, request: CreateApprovalRequest) -> AIApprovalDTO:
        existing = await get_latest_approval_for_task(self.conn, request.task_id)
        if existing and existing.status in {"pending", "needs_info"}:
            return self._to_dto(existing)

        now = datetime.utcnow()
        approval = AIApprovalRecord(
            id=f"approval_{uuid4().hex[:12]}",
            task_id=request.task_id,
            title=request.title,
            reason=request.reason,
            status="pending",
            risk_level=request.risk_level,
            requested_by=request.requested_by,
            reviewer_id=None,
            reviewer_name=None,
            comment=None,
            created_at=now,
            updated_at=now,
            decided_at=None,
            metadata=request.metadata,
        )
        created = await create_approval(self.conn, approval)
        await create_task_action(
            self.conn,
            action_id=f"action_{uuid4().hex[:12]}",
            task_id=created.task_id,
            approval_id=created.id,
            action_type="approval_requested",
            from_status=None,
            to_status=None,
            actor=created.requested_by,
            reason_codes=["approval_requested"],
            detail=request.reason,
            tool_name=None,
            snapshot={"approval_id": created.id, "risk_level": created.risk_level},
            created_at=now,
        )
        await self._commit()
        return self._to_dto(created)

    async def process_approval(self, approval_id: str, request: ProcessApprovalRequest) -> AIApprovalDTO:
        approval = await get_approval_by_id(self.conn, approval_id)
        if approval is None:
            raise ApprovalNotFoundError(f"Approval {approval_id} not found")
        task = await get_task_by_id(self.conn, approval.task_id)

        now = datetime.utcnow()
        status = {"approve": "approved", "reject": "rejected", "request_info": "needs_info"}[request.decision]
        decided_at = now if status in {"approved", "rejected"} else None
        updated = await update_approval_processing(
            self.conn,
            approval_id,
            status=status,
            reviewer_id=request.reviewer_id,
            reviewer_name=request.reviewer_name,
            comment=request.comment,
            updated_at=now,
            decided_at=decided_at,
        )
        if updated is None:
            raise ApprovalNotFoundError(f"Approval {approval_id} not found")

        await self._apply_approval_task_effect(
            task=task,
            approval=updated,
            decision=request.decision,
            actor=AuditActor(id=request.reviewer_id, name=request.reviewer_name, type="user"),
            comment=request.comment,
            at=now,
        )

        await create_task_action(
            self.conn,
            action_id=f"action_{uuid4().hex[:12]}",
            task_id=updated.task_id,
            approval_id=updated.id,
            action_type="approval_processed",
            from_status=None,
            to_status=None,
            actor=AuditActor(id=request.reviewer_id, name=request.reviewer_name, type="user"),
            reason_codes=[f"approval_{request.decision}"],
            detail=request.comment or f"Approval decision: {request.decision}",
            tool_name=None,
            snapshot={"approval_id": updated.id, "status": updated.status},
            created_at=now,
        )
        await self._commit()
        return self._to_dto(updated)

    async def _apply_approval_task_effect(
        self,
        *,
        task: AITaskRecord | None,
        approval: AIApprovalRecord,
        decision: str,
        actor: AuditActor,
        comment: str | None,
        at: datetime,
    ) -> None:
        if task is None:
            return

        next_status = self._approval_task_next_status(task, decision)
        if next_status is None or next_status == task.status:
            if decision == "approve" and self._is_purchase_task(task):
                await self._create_purchase_request(task, approval, actor, at)
            return

        closed_at = at if next_status in {"completed", "cancelled"} else None
        await update_task_status(self.conn, task_id=task.id, status=next_status, closed_at=closed_at)
        await create_task_action(
            self.conn,
            action_id=f"action_{uuid4().hex[:12]}",
            task_id=task.id,
            approval_id=approval.id,
            action_type="task_status_changed",
            from_status=task.status,
            to_status=next_status,
            actor=actor,
            reason_codes=[f"approval_{decision}"],
            detail=comment or self._approval_task_detail(decision, next_status),
            tool_name="approval_service",
            snapshot={
                "approval_id": approval.id,
                "approval_status": approval.status,
                "decision": decision,
            },
            created_at=at,
        )
        if decision == "approve" and self._is_purchase_task(task):
            await self._create_purchase_request(task, approval, actor, at)

    def _approval_task_next_status(self, task: AITaskRecord, decision: str) -> str | None:
        if decision == "approve":
            if self._is_purchase_task(task):
                return "completed"
            if task.status == "blocked":
                return "open"
            return task.status
        if decision == "reject":
            if task.status in {"open", "in_progress", "blocked"}:
                return "cancelled"
            return task.status
        if decision == "request_info":
            return task.status
        return None

    def _is_purchase_task(self, task: AITaskRecord) -> bool:
        return task.task_type in {"chemical_purchase", "procurement", "restock"}

    def _needs_human_intervention_approval(self, task: AITaskRecord) -> bool:
        if task.status in {"completed", "cancelled"}:
            return False
        return task.requires_approval or task.task_type in {
            "chemical_purchase",
            "equipment_maintenance",
            "equipment_repair",
            "procurement",
            "maintenance",
            "restock",
        }

    async def _commit(self) -> None:
        commit = getattr(self.conn, "commit", None)
        if commit is not None:
            await commit()

    def _approval_task_detail(self, decision: str, next_status: str) -> str:
        if decision == "approve":
            return f"Approval approved; task is now {next_status}."
        if decision == "reject":
            return "Approval rejected; task cancelled."
        return "Approval requires more information."

    async def _create_purchase_request(
        self,
        task: AITaskRecord,
        approval: AIApprovalRecord,
        actor: AuditActor,
        at: datetime,
    ) -> None:
        purchase_id = f"purchase_{uuid4().hex[:12]}"
        metadata = dict(task.metadata or {})
        evidence = metadata.get("evidence") or []
        quantity = None
        unit = None
        for item in evidence:
            label = str(item.get("label") or item.get("type") or "").lower()
            if "threshold" in label:
                try:
                    quantity = int(item.get("value"))
                except (TypeError, ValueError):
                    quantity = None
            if label == "unit":
                unit = str(item.get("value"))

        await self.conn.execute(
            """
            INSERT INTO purchase_requests (
                id, task_id, chemical_id, chemical_name, quantity, unit, status,
                requested_by, approved_by, created_at, updated_at, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                purchase_id,
                task.id,
                task.source_id,
                task.source_name,
                quantity,
                unit,
                "submitted",
                Json(approval.requested_by.model_dump()),
                Json(actor.model_dump()),
                at,
                at,
                Json({"approval_id": approval.id, "source": "approval_service"}),
            ),
        )

        metadata["autoPurchase"] = {
            "status": "submitted",
            "purchaseRequestId": purchase_id,
            "updatedAt": at.isoformat(),
            "message": "Purchase request submitted after supervisor approval.",
        }
        await update_task_metadata(self.conn, task.id, metadata)
        await create_task_action(
            self.conn,
            action_id=f"action_{uuid4().hex[:12]}",
            task_id=task.id,
            approval_id=approval.id,
            action_type="purchase_request_submitted",
            from_status=task.status,
            to_status=task.status,
            actor=actor,
            reason_codes=["approval_approve", "purchase_request_submitted"],
            detail=f"Purchase request {purchase_id} submitted for {task.source_name}.",
            tool_name="approval_service",
            snapshot={"purchase_request_id": purchase_id, "approval_id": approval.id},
            created_at=at,
        )

    def _to_dto(self, approval: AIApprovalRecord) -> AIApprovalDTO:
        return AIApprovalDTO(
            id=approval.id,
            task_id=approval.task_id,
            title=approval.title,
            reason=approval.reason,
            status=approval.status,
            risk_level=approval.risk_level,
            requested_by=approval.requested_by,
            reviewer_id=approval.reviewer_id,
            reviewer_name=approval.reviewer_name,
            comment=approval.comment,
            created_at=approval.created_at,
            updated_at=approval.updated_at,
            decided_at=approval.decided_at,
            metadata=approval.metadata,
        )
