"""Protocol adapter for TS-Python translation."""

from typing import Any
from datetime import datetime
from pydantic import ValidationError

from app.gateway.dto import (
    UnifiedTaskDTO,
    UnifiedApprovalDTO,
    UnifiedTaskActionDTO,
    UnifiedSettingsDTO,
)
from app.tasks.models import AITaskDTO, TaskActionDTO
from app.approvals.models import AIApprovalDTO
from app.settings.models import AISettings


class ProtocolAdapter:
    """Adapts between TS and Python protocol formats."""

    # Status mappings
    FORMAL_TO_COMPAT_STATUS = {
        "open": "open",
        "in_progress": "in_progress",
        "blocked": "in_progress",  # Map blocked to in_progress for compat
        "completed": "done",
        "cancelled": "closed",
    }

    COMPAT_TO_FORMAL_STATUS = {
        "open": "open",
        "in_progress": "in_progress",
        "pending_approval": "in_progress",  # Map to in_progress in formal
        "done": "completed",
        "closed": "cancelled",
    }

    # Task type mappings
    FORMAL_TO_COMPAT_TYPE = {
        "restock": "chemical_purchase",
        "maintenance": "equipment_maintenance",
        "inspection": "equipment_maintenance",
        "calibration": "equipment_maintenance",
        "equipment_repair": "equipment_repair",
        "disposal": "other",
        "procurement": "chemical_purchase",
        "training": "other",
        "audit": "other",
        "other": "other",
    }

    COMPAT_TO_FORMAL_TYPE = {
        "chemical_purchase": "procurement",
        "equipment_maintenance": "maintenance",
        "equipment_repair": "equipment_repair",
        "restock": "restock",
        "maintenance": "maintenance",
        "anomaly_review": "inspection",
        "data_fix": "other",
    }

    def task_to_unified(self, task: AITaskDTO) -> UnifiedTaskDTO:
        """Convert Python task DTO to unified frontend DTO.

        Args:
            task: Python task DTO (snake_case)

        Returns:
            Unified task DTO (camelCase)
        """
        # Map status
        status = self.FORMAL_TO_COMPAT_STATUS.get(task.status, task.status)

        # Map task type
        task_type = self.FORMAL_TO_COMPAT_TYPE.get(task.type, task.type)

        return UnifiedTaskDTO(
            id=task.id,
            eventId=task.event_id,
            type=task_type,
            title=task.title,
            summary=task.summary,
            recommendation=task.recommendation,
            status=status,
            priority=task.priority,
            riskLevel=task.risk_level,
            sourceType=task.source_type,
            sourceId=task.source_id,
            sourceName=task.source_name,
            assigneeId=task.assignee_id,
            assigneeName=task.assignee_name,
            assigneeRole=task.assignee_role,
            requiresApproval=task.requires_approval,
            dueAt=task.due_at.isoformat() if task.due_at else None,
            createdAt=task.created_at.isoformat(),
            updatedAt=task.updated_at.isoformat(),
            closedAt=task.closed_at.isoformat() if task.closed_at else None,
            metadata=task.metadata,
        )

    def approval_to_unified(self, approval: AIApprovalDTO) -> UnifiedApprovalDTO:
        """Convert Python approval DTO to unified frontend DTO.

        Args:
            approval: Python approval DTO

        Returns:
            Unified approval DTO (camelCase)
        """
        return UnifiedApprovalDTO(
            id=approval.id,
            taskId=approval.task_id,
            title=approval.title,
            reason=approval.reason,
            status=approval.status,
            riskLevel=approval.risk_level,
            requestedBy=approval.requested_by.model_dump(),
            reviewerId=approval.reviewer_id,
            reviewerName=approval.reviewer_name,
            comment=approval.comment,
            createdAt=approval.created_at.isoformat(),
            updatedAt=approval.updated_at.isoformat(),
            decidedAt=approval.decided_at.isoformat() if approval.decided_at else None,
            metadata=approval.metadata,
        )

    def action_to_unified(self, action: TaskActionDTO) -> UnifiedTaskActionDTO:
        """Convert Python task action DTO to unified frontend DTO.

        Args:
            action: Python task action DTO

        Returns:
            Unified task action DTO (camelCase)
        """
        # Map statuses if present
        from_status = None
        if action.from_status:
            from_status = self.FORMAL_TO_COMPAT_STATUS.get(
                action.from_status, action.from_status
            )

        to_status = None
        if action.to_status:
            to_status = self.FORMAL_TO_COMPAT_STATUS.get(
                action.to_status, action.to_status
            )

        return UnifiedTaskActionDTO(
            id=action.id,
            taskId=action.task_id,
            approvalId=action.approval_id,
            actionType=action.action_type,
            fromStatus=from_status,
            toStatus=to_status,
            actor=action.actor.model_dump(),
            reasonCodes=action.reason_codes,
            detail=action.detail,
            toolName=action.tool_name,
            snapshot=action.snapshot,
            createdAt=action.created_at.isoformat(),
        )

    def settings_to_unified(self, settings: AISettings) -> UnifiedSettingsDTO:
        """Convert Python settings to unified frontend DTO.

        Args:
            settings: Python settings

        Returns:
            Unified settings DTO (camelCase)
        """
        return UnifiedSettingsDTO(
            thresholds=settings.thresholds.model_dump(),
            approvalStrategy=settings.approvalStrategy.model_dump(),
            sla=settings.sla.model_dump(),
            updatedAt=settings.updatedAt,
        )

    def ts_to_python(self, ts_input: dict[str, Any]) -> dict[str, Any]:
        """Map TS input format to Python format."""
        python_input = {}

        # Map known fields
        if "eventType" in ts_input:
            python_input["eventType"] = ts_input["eventType"]
        if "data" in ts_input:
            python_input["data"] = self._map_data_fields(ts_input["data"])
        if "audit" in ts_input:
            python_input["audit"] = self._map_audit_fields(ts_input["audit"])

        # Passthrough unknown fields
        for key, value in ts_input.items():
            if key not in ["eventType", "data", "audit"]:
                python_input[key] = value

        return python_input

    def python_to_ts(self, python_output: dict[str, Any]) -> dict[str, Any]:
        """Map Python output format to TS format."""
        ts_output = {}

        # Map known fields
        if "event_type" in python_output:
            ts_output["eventType"] = python_output["event_type"]
        elif "eventType" in python_output:
            ts_output["eventType"] = python_output["eventType"]

        if "metadata" in python_output:
            ts_output["metadata"] = python_output["metadata"]
        if "audit" in python_output:
            ts_output["audit"] = self._map_audit_fields(python_output["audit"])
        if "deduplicated" in python_output:
            ts_output["deduplicated"] = python_output["deduplicated"]

        # Passthrough unknown fields
        for key, value in python_output.items():
            if key not in ["event_type", "eventType", "metadata", "audit", "deduplicated"]:
                ts_output[key] = value

        return ts_output

    def _map_data_fields(self, data: dict[str, Any]) -> dict[str, Any]:
        """Map data fields (already in camelCase from TS)."""
        return data

    def _map_audit_fields(self, audit: dict[str, Any]) -> dict[str, Any]:
        """Map audit fields between formats."""
        mapped = {}
        if "runId" in audit:
            mapped["runId"] = audit["runId"]
        if "run_id" in audit:
            mapped["runId"] = audit["run_id"]
        if "operator" in audit:
            mapped["operator"] = audit["operator"]
        if "timestamp" in audit:
            mapped["timestamp"] = audit["timestamp"]
        return mapped

    def translate_import_response(self, python_response: dict[str, Any]) -> dict[str, Any]:
        """Translate Python import response to TS format."""
        return {
            "batchId": python_response.get("batch_id"),
            "totalCount": python_response.get("total_count", 0),
            "successCount": python_response.get("success_count", 0),
            "failedCount": python_response.get("failed_count", 0),
            "status": python_response.get("status"),
            "errors": python_response.get("errors", []),
        }

    def translate_error(self, error: Exception) -> dict[str, Any]:
        """Translate Python error to TS error format."""
        if isinstance(error, ValidationError):
            return {
                "error": "ValidationError",
                "code": "VALIDATION_FAILED",
                "details": error.errors(),
            }
        elif isinstance(error, ValueError):
            return {
                "error": "ValueError",
                "code": "INVALID_INPUT",
                "message": str(error),
            }
        else:
            return {
                "error": "SystemError",
                "code": "INTERNAL_ERROR",
                "message": str(error),
            }
