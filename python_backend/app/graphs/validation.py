"""Validation utilities for graph tool inputs.

This module provides schema validation for tool inputs before
they are passed to services, ensuring data integrity.
"""

from typing import Any, Optional
from pydantic import BaseModel, ValidationError, Field


class CreateTaskInput(BaseModel):
    """Validated input for task creation."""

    type: str
    title: str
    summary: str
    recommendation: str
    priority: str
    risk_level: str
    source_type: str
    source_id: str
    source_name: str
    requires_approval: bool
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CreateApprovalInput(BaseModel):
    """Validated input for approval creation."""

    task_id: str
    title: str
    reason: str
    risk_level: str
    requested_by: dict[str, Any]


class ValidationResult(BaseModel):
    """Result of validation."""

    valid: bool
    data: Optional[dict[str, Any]] = None
    errors: list[dict[str, Any]] = Field(default_factory=list)


def validate_create_task_input(data: dict[str, Any]) -> ValidationResult:
    """Validate task creation input.

    Args:
        data: Raw input data

    Returns:
        ValidationResult with validated data or errors
    """
    try:
        validated = CreateTaskInput(**data)
        return ValidationResult(
            valid=True,
            data=validated.model_dump(),
        )
    except ValidationError as e:
        return ValidationResult(
            valid=False,
            errors=e.errors(),
        )


def validate_create_approval_input(data: dict[str, Any]) -> ValidationResult:
    """Validate approval creation input.

    Args:
        data: Raw input data

    Returns:
        ValidationResult with validated data or errors
    """
    try:
        validated = CreateApprovalInput(**data)
        return ValidationResult(
            valid=True,
            data=validated.model_dump(),
        )
    except ValidationError as e:
        return ValidationResult(
            valid=False,
            errors=e.errors(),
        )


def validate_evidence_items(evidence: list[dict[str, Any]]) -> ValidationResult:
    """Validate evidence items format.

    Args:
        evidence: List of evidence items

    Returns:
        ValidationResult indicating if evidence is valid

    Expected format:
        [{"type": "string", "value": any, "label": "string"}]
    """
    errors = []

    for i, item in enumerate(evidence):
        if not isinstance(item, dict):
            errors.append({
                "loc": ["evidence", i],
                "msg": "Evidence item must be a dict",
                "type": "type_error",
            })
            continue

        if "type" not in item:
            errors.append({
                "loc": ["evidence", i, "type"],
                "msg": "Field required",
                "type": "missing",
            })

        if "value" not in item:
            errors.append({
                "loc": ["evidence", i, "value"],
                "msg": "Field required",
                "type": "missing",
            })

    if errors:
        return ValidationResult(valid=False, errors=errors)

    return ValidationResult(valid=True, data={"evidence": evidence})
