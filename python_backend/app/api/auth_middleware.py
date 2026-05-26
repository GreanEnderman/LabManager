"""Authentication and authorization middleware for FastAPI.

This module provides middleware and dependency functions for checking
user capabilities and enforcing access control.
"""

from typing import Any

from fastapi import HTTPException, Request

from app.authz import AppCapability, has_capability


class ForbiddenError(HTTPException):
    """Exception raised when a user lacks required capability."""

    def __init__(self, capability: str, detail: str | None = None):
        super().__init__(
            status_code=403,
            detail=detail or f"Forbidden: requires capability '{capability}'",
        )
        self.capability = capability


async def record_forbidden_action(
    user: dict[str, Any], capability: AppCapability, context: dict[str, Any] | None = None
) -> None:
    """Record a forbidden action attempt to audit log.

    Args:
        user: User who attempted the action
        capability: Capability that was required
        context: Additional context about the attempt
    """
    # TODO: Implement audit logging
    # For now, this is a placeholder
    # In production, this should write to an audit log table or service
    pass


def require_capability(capability: AppCapability):
    """Create a FastAPI dependency that requires a specific capability.

    Usage:
        @router.post("/some-endpoint")
        async def endpoint(
            request: Request,
            user = Depends(require_capability(AppCapability.TASKS_WRITE))
        ):
            # user is guaranteed to have tasks:write capability
            ...

    Args:
        capability: The capability required to access the endpoint

    Returns:
        A dependency function that checks for the capability
    """

    async def dependency(request: Request) -> dict[str, Any]:
        """Check if the user has the required capability.

        Args:
            request: The FastAPI request object

        Returns:
            The authenticated user dict

        Raises:
            HTTPException: 401 if not authenticated, 403 if lacking capability
        """
        # Get user from request state (set by authentication middleware)
        user = getattr(request.state, "user", None)

        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Get user capabilities
        user_capabilities = user.get("capabilities", [])

        # Check if user has the required capability
        if not has_capability(user_capabilities, capability):
            # Record the forbidden action
            await record_forbidden_action(
                user,
                capability,
                {
                    "boundary": "http_route",
                    "path": request.url.path,
                    "method": request.method,
                },
            )
            raise ForbiddenError(capability.value)

        return user

    return dependency


def require_any_capability(*capabilities: AppCapability):
    """Create a FastAPI dependency that requires any of the specified capabilities.

    Usage:
        @router.get("/some-endpoint")
        async def endpoint(
            request: Request,
            user = Depends(require_any_capability(
                AppCapability.TASKS_READ,
                AppCapability.TASKS_WRITE
            ))
        ):
            # user has at least one of the specified capabilities
            ...

    Args:
        *capabilities: One or more capabilities, any of which satisfies the requirement

    Returns:
        A dependency function that checks for any of the capabilities
    """

    async def dependency(request: Request) -> dict[str, Any]:
        """Check if the user has any of the required capabilities."""
        user = getattr(request.state, "user", None)

        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        user_capabilities = user.get("capabilities", [])

        # Check if user has any of the required capabilities
        if not any(has_capability(user_capabilities, cap) for cap in capabilities):
            capability_names = ", ".join(cap.value for cap in capabilities)
            await record_forbidden_action(
                user,
                capabilities[0],  # Record first capability for audit
                {
                    "boundary": "http_route",
                    "path": request.url.path,
                    "method": request.method,
                    "required_any": capability_names,
                },
            )
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: requires any of [{capability_names}]",
            )

        return user

    return dependency


__all__ = [
    "ForbiddenError",
    "require_capability",
    "require_any_capability",
    "record_forbidden_action",
]
