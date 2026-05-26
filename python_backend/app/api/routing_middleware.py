"""Routing middleware for capability-based traffic routing.

This middleware centralizes routing decisions for all capabilities,
ensuring consistent routing logic and cross-capability validation.
"""

import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.gateway.routing import (
    Capability,
    ServiceTarget,
    get_capability_target,
    get_capability_routing_snapshot,
)

logger = logging.getLogger(__name__)


class RoutingMiddleware(BaseHTTPMiddleware):
    """Middleware to determine and store routing decisions per request."""

    def __init__(self, app):
        super().__init__(app)
        self._validate_routing_consistency()

    def _validate_routing_consistency(self):
        """Validate cross-capability routing dependencies on startup."""
        snapshot = get_capability_routing_snapshot()

        # Rule: If TASKS → PYTHON, then APPROVALS must also → PYTHON
        tasks_target = get_capability_target(Capability.TASKS)
        approvals_target = get_capability_target(Capability.APPROVALS)

        if tasks_target == ServiceTarget.PYTHON_BACKEND:
            if approvals_target != ServiceTarget.PYTHON_BACKEND:
                logger.warning(
                    "Routing inconsistency: TASKS → PYTHON but APPROVALS → %s. "
                    "This may cause data inconsistency.",
                    approvals_target.value,
                )

        # Rule: If RULES → PYTHON, then TASKS must also → PYTHON
        rules_target = get_capability_target(Capability.RULES)
        if rules_target == ServiceTarget.PYTHON_BACKEND:
            if tasks_target != ServiceTarget.PYTHON_BACKEND:
                logger.warning(
                    "Routing inconsistency: RULES → PYTHON but TASKS → %s. "
                    "Rules engine requires Python task service.",
                    tasks_target.value,
                )

        # Log routing snapshot on startup
        logger.info("Capability routing snapshot: %s", snapshot)

    async def dispatch(self, request: Request, call_next):
        """Intercept request and determine routing for all capabilities."""
        # Determine routing for each capability
        routing = {}
        for capability in Capability:
            routing[capability] = get_capability_target(capability)

        # Store routing decisions in request state
        request.state.capability_routing = routing

        # Log routing decision for this request (debug level)
        logger.debug(
            "Request %s %s - Routing: %s",
            request.method,
            request.url.path,
            {k.value: v.value for k, v in routing.items()},
        )

        # Proceed with request
        response = await call_next(request)

        # Add routing info to response headers (for debugging)
        if hasattr(request.state, "capability_routing"):
            # Add a header showing which capabilities are routed to Python
            python_capabilities = [
                cap.value
                for cap, target in request.state.capability_routing.items()
                if target == ServiceTarget.PYTHON_BACKEND
            ]
            if python_capabilities:
                response.headers["X-Python-Capabilities"] = ",".join(python_capabilities)

        return response


def get_request_capability_target(request: Request, capability: Capability) -> ServiceTarget:
    """Get routing target for a capability from request state.

    Args:
        request: FastAPI request object
        capability: Capability to check

    Returns:
        ServiceTarget for the capability

    Raises:
        RuntimeError: If routing middleware hasn't run
    """
    if not hasattr(request.state, "capability_routing"):
        # Fallback: compute routing on-demand if middleware hasn't run
        logger.warning(
            "Routing middleware hasn't run for request %s %s. "
            "Computing routing on-demand.",
            request.method,
            request.url.path,
        )
        return get_capability_target(capability)

    return request.state.capability_routing[capability]
