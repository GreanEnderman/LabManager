"""Tool interfaces and adapters for the supervisor graph."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from app.approvals.models import AIApprovalDTO, CreateApprovalRequest
from app.approvals.service import ApprovalService
from app.core.actor_converter import ActorConverter
from app.core.event_mappings import EventMappings
from app.tasks.models import AITaskDTO, AIEvidenceItem, AuditActor, CreateTaskRequest, ListTasksQuery
from app.tasks.repository import create_task_action
from app.tasks.service import TaskService


def normalize_compat_task_type(task_type: str | None) -> str:
    if task_type in {"restock", "procurement"}:
        return "chemical_purchase"
    if task_type in {"maintenance", "anomaly_review", "inspection", "calibration"}:
        return "equipment_maintenance"
    if task_type == "equipment_repair":
        return "equipment_repair"
    return str(task_type or "")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_optional_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# Keep actor_to_formal as an alias for backward compatibility
def actor_to_formal(actor: dict[str, Any] | None) -> AuditActor:
    """Convert dict to formal AuditActor (delegates to ActorConverter)."""
    return ActorConverter.to_formal(actor)


def formal_to_compat_status(status: str) -> str:
    mapping = {
        "open": "open",
        "in_progress": "in_progress",
        "blocked": "in_progress",
        "completed": "done",
        "cancelled": "closed",
    }
    return mapping.get(status, "open")


def compat_evidence_to_formal(items: list[dict[str, Any]]) -> list[AIEvidenceItem]:
    evidence: list[AIEvidenceItem] = []
    for item in items:
        evidence.append(
            AIEvidenceItem(
                type=str(item.get("type") or "observation"),
                value=item.get("value"),
                label=item.get("label"),
            )
        )
    return evidence


def task_dto_to_compat(task: AITaskDTO) -> dict[str, Any]:
    metadata = dict(task.metadata or {})
    return {
        "id": task.id,
        "eventId": task.event_id,
        "type": EventMappings.formal_to_compat_task_type(task.type, metadata),
        "title": task.title,
        "summary": task.summary,
        "recommendation": task.recommendation,
        "status": formal_to_compat_status(task.status),
        "priority": task.priority,
        "riskLevel": task.risk_level,
        "sourceType": task.source_type,
        "sourceId": task.source_id,
        "sourceName": task.source_name,
        "assigneeId": task.assignee_id,
        "assigneeName": task.assignee_name,
        "assigneeRole": task.assignee_role,
        "requiresApproval": task.requires_approval,
        "dueAt": task.due_at.isoformat().replace("+00:00", "Z") if task.due_at else None,
        "createdAt": task.created_at.isoformat().replace("+00:00", "Z"),
        "updatedAt": task.updated_at.isoformat().replace("+00:00", "Z"),
        "closedAt": task.closed_at.isoformat().replace("+00:00", "Z") if task.closed_at else None,
        "metadata": metadata,
    }


def approval_dto_to_compat(approval: AIApprovalDTO) -> dict[str, Any]:
    return {
        "id": approval.id,
        "taskId": approval.task_id,
        "title": approval.title,
        "reason": approval.reason,
        "status": approval.status,
        "riskLevel": approval.risk_level,
        "createdAt": approval.created_at.isoformat().replace("+00:00", "Z"),
        "updatedAt": approval.updated_at.isoformat().replace("+00:00", "Z"),
        "comment": approval.comment,
        "metadata": dict(approval.metadata or {}),
    }


class TaskTool(Protocol):
    async def find_existing_open_task(self, event_id: str, source_id: str, task_type: str) -> dict[str, Any] | None: ...

    async def create_task(self, task_draft: dict[str, Any], actor: dict[str, Any] | None = None) -> dict[str, Any]: ...


class ApprovalTool(Protocol):
    async def create_approval(
        self,
        approval_draft: dict[str, Any],
        actor: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...


class AuditLogTool(Protocol):
    async def write_many(self, drafts: list[dict[str, Any]]) -> list[dict[str, Any]]: ...


@dataclass
class InMemoryTaskTool:
    tasks: list[dict[str, Any]] = field(default_factory=list)

    async def find_existing_open_task(self, event_id: str, source_id: str, task_type: str) -> dict[str, Any] | None:
        normalized_task_type = normalize_compat_task_type(task_type)
        for task in self.tasks:
            if (
                task.get("eventId") == event_id
                and task.get("sourceId") == source_id
                and normalize_compat_task_type(task.get("type")) == normalized_task_type
                and task.get("status") in {"open", "in_progress", "pending_approval"}
            ):
                return task
        return None

    async def create_task(self, task_draft: dict[str, Any], actor: dict[str, Any] | None = None) -> dict[str, Any]:
        created = dict(task_draft)
        created["id"] = created.get("id") or f"task-{uuid4()}"
        self.tasks.append(created)
        return created


@dataclass
class InMemoryApprovalTool:
    approvals: list[dict[str, Any]] = field(default_factory=list)

    async def create_approval(
        self,
        approval_draft: dict[str, Any],
        actor: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        created = dict(approval_draft)
        created["id"] = created.get("id") or f"approval-{uuid4()}"
        self.approvals.append(created)
        return created


@dataclass
class InMemoryAuditLogTool:
    actions: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    async def write_many(self, drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        persisted: list[dict[str, Any]] = []
        for draft in drafts:
            record = dict(draft)
            task_id = record.get("taskId")
            if task_id:
                self.actions.setdefault(task_id, []).append(record)
            persisted.append(record)
        return persisted


class TaskActionAuditLogTool:
    """AuditLogTool adapter backed by the formal ai_task_actions table."""

    def __init__(self, connection_factory: Any):
        self._connection_factory = connection_factory

    async def write_many(self, drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        persisted: list[dict[str, Any]] = []
        async with self._connection_factory() as conn:
            for draft in drafts:
                record = dict(draft)
                task_id = record.get("taskId")
                if not task_id:
                    persisted.append(record)
                    continue

                # Verify task exists before creating action log
                from app.tasks.repository import get_task_by_id
                try:
                    task = await get_task_by_id(conn, str(task_id))
                    if not task:
                        # Task doesn't exist, skip this action log
                        continue
                except Exception:
                    # Error checking task, skip this action log
                    continue

                approval_id = record.get("approvalId")
                try:
                    await create_task_action(
                        conn,
                        action_id=str(record.get("id") or f"action_{uuid4().hex[:12]}"),
                        task_id=str(task_id),
                        approval_id=str(approval_id) if approval_id else None,
                        action_type=str(record.get("actionType") or "graph_action"),
                        from_status=record.get("fromStatus"),
                        to_status=record.get("toStatus"),
                        actor=actor_to_formal(record.get("actor")),
                        reason_codes=[str(code) for code in list(record.get("reasonCodes") or [])],
                        detail=str(record.get("detail") or "Supervisor graph audit action."),
                        tool_name=record.get("toolName"),
                        snapshot=dict(record.get("snapshot") or {}),
                        created_at=parse_optional_datetime(record.get("createdAt")) or datetime.now(timezone.utc),
                    )
                    persisted.append(record)
                except Exception:
                    # Failed to create action log, skip
                    continue
        return persisted


class TaskServiceTaskTool:
    """TaskTool adapter backed by the formal TaskService."""

    def __init__(self, connection_factory: Any):
        self._connection_factory = connection_factory

    async def find_existing_open_task(self, event_id: str, source_id: str, task_type: str) -> dict[str, Any] | None:
        formal_type = EventMappings.compat_to_formal_task_type(task_type)
        async with self._connection_factory() as conn:
            service = TaskService(conn)
            tasks = await service.list_tasks(ListTasksQuery(type=formal_type))

        for task in tasks:
            if task.event_id != event_id:
                continue
            if task.source_id != source_id:
                continue
            if task.status not in {"open", "in_progress", "blocked"}:
                continue
            return task_dto_to_compat(task)
        return None

    async def create_task(self, task_draft: dict[str, Any], actor: dict[str, Any] | None = None) -> dict[str, Any]:
        metadata = dict(task_draft.get("metadata") or {})
        evidence = compat_evidence_to_formal(list(metadata.get("evidence") or task_draft.get("evidence") or []))
        metadata["compatTaskType"] = task_draft.get("type")

        request = CreateTaskRequest(
            event_id=task_draft.get("eventId"),
            type=EventMappings.compat_to_formal_task_type(str(task_draft.get("type") or "other")),
            title=str(task_draft.get("title") or "AI task"),
            summary=str(task_draft.get("summary") or "Generated from supervisor graph."),
            recommendation=str(task_draft.get("recommendation") or "Review and follow SOP."),
            priority=str(task_draft.get("priority") or "medium"),
            risk_level=str(task_draft.get("riskLevel") or "medium"),
            source_type=str(task_draft.get("sourceType") or "system"),
            source_id=str(task_draft.get("sourceId") or "unknown"),
            source_name=str(task_draft.get("sourceName") or "Unknown source"),
            assignee_id=task_draft.get("assigneeId"),
            assignee_name=task_draft.get("assigneeName"),
            assignee_role=task_draft.get("assigneeRole"),
            requires_approval=bool(task_draft.get("requiresApproval")),
            due_at=parse_optional_datetime(task_draft.get("dueAt")),
            evidence=evidence,
            metadata=metadata,
        )

        async with self._connection_factory() as conn:
            service = TaskService(conn)
            created = await service.create_task(request=request, actor=actor_to_formal(actor))
        return task_dto_to_compat(created)


class ApprovalServiceApprovalTool:
    """ApprovalTool adapter backed by the formal ApprovalService."""

    def __init__(self, connection_factory: Any):
        self._connection_factory = connection_factory

    async def create_approval(
        self,
        approval_draft: dict[str, Any],
        actor: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with self._connection_factory() as conn:
            service = ApprovalService(conn)
            created = await service.create_approval(
                CreateApprovalRequest(
                    task_id=str(approval_draft.get("taskId") or ""),
                    title=str(approval_draft.get("title") or "Approval request"),
                    reason=str(approval_draft.get("reason") or ""),
                    risk_level=str(approval_draft.get("riskLevel") or "medium"),
                    requested_by=actor_to_formal(actor),
                    metadata=dict(approval_draft.get("metadata") or {}),
                )
            )
        return approval_dto_to_compat(created)


@dataclass
class SupervisorTools:
    task_tool: TaskTool
    approval_tool: ApprovalTool
    audit_log_tool: AuditLogTool
    rules_adapter: Any  # SupervisorRulesAdapter, avoiding circular import
    memory_tool: Any = None  # MemoryTool, optional for backward compatibility


@dataclass
class InMemorySupervisorTools(SupervisorTools):
    tasks: list[dict[str, Any]] = field(default_factory=list)
    approvals: list[dict[str, Any]] = field(default_factory=list)
    actions: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    memories: list[dict[str, Any]] = field(default_factory=list)

    def __init__(
        self,
        tasks: list[dict[str, Any]] | None = None,
        approvals: list[dict[str, Any]] | None = None,
        actions: dict[str, list[dict[str, Any]]] | None = None,
        rules_adapter: Any | None = None,
        memories: list[dict[str, Any]] | None = None,
    ) -> None:
        task_store = tasks if tasks is not None else []
        approval_store = approvals if approvals is not None else []
        action_store = actions if actions is not None else {}
        memory_store = memories if memories is not None else []
        self.tasks = task_store
        self.approvals = approval_store
        self.actions = action_store
        self.memories = memory_store
        self.task_tool = InMemoryTaskTool(task_store)
        self.approval_tool = InMemoryApprovalTool(approval_store)
        self.audit_log_tool = InMemoryAuditLogTool(action_store)

        # Create default memory_tool
        from app.graphs.memory_tools import InMemoryMemoryTool
        self.memory_tool = InMemoryMemoryTool(memory_store)

        # Create default rules_adapter if not provided
        if rules_adapter is None:
            from app.rules.engine import RulesEngine
            from app.graphs.rules_adapter import SupervisorRulesAdapter
            rules_adapter = SupervisorRulesAdapter(RulesEngine(), task_tool=self.task_tool)
        self.rules_adapter = rules_adapter
