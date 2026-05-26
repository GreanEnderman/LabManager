"""Standard error response utilities for API endpoints."""

from typing import Any
from fastapi import HTTPException


class ApiError(HTTPException):
    """Standard API error with structured detail."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None
    ):
        detail = {
            "code": code,
            "message": message,
        }
        if details:
            detail["details"] = details

        super().__init__(status_code=status_code, detail=detail)


# Common error factories
def not_found_error(resource: str, identifier: str) -> ApiError:
    """404 Not Found error."""
    return ApiError(
        status_code=404,
        code="not_found",
        message=f"{resource} not found: {identifier}"
    )


def invalid_transition_error(transition: str, current_status: str) -> ApiError:
    """400 Invalid Transition error."""
    return ApiError(
        status_code=400,
        code="invalid_transition",
        message=f"Invalid transition '{transition}' from status '{current_status}'"
    )


def validation_error(message: str, details: dict[str, Any] | None = None) -> ApiError:
    """422 Validation Error."""
    return ApiError(
        status_code=422,
        code="validation_error",
        message=message,
        details=details
    )


def unauthorized_error(message: str = "Authentication required") -> ApiError:
    """401 Unauthorized error."""
    return ApiError(
        status_code=401,
        code="unauthorized",
        message=message
    )


def forbidden_error(message: str = "Access forbidden") -> ApiError:
    """403 Forbidden error."""
    return ApiError(
        status_code=403,
        code="forbidden",
        message=message
    )
