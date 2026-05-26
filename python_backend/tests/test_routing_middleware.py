"""Tests for routing middleware."""

import pytest
from unittest.mock import MagicMock
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.api.routing_middleware import RoutingMiddleware, get_request_capability_target
from app.gateway.routing import Capability, ServiceTarget


@pytest.fixture
def app():
    """Create test FastAPI app with routing middleware."""
    app = FastAPI()

    # Add routing middleware
    app.add_middleware(RoutingMiddleware)

    # Add test endpoint
    @app.get("/test")
    async def test_endpoint(request: Request):
        # Access routing from request state
        routing = request.state.capability_routing
        return {
            "tasks": routing[Capability.TASKS].value,
            "approvals": routing[Capability.APPROVALS].value,
        }

    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


def test_routing_middleware_sets_request_state(client):
    """Test that routing middleware sets request state."""
    response = client.get("/test")

    assert response.status_code == 200
    data = response.json()

    # Should have routing decisions
    assert "tasks" in data
    assert "approvals" in data
    # Values should be valid ServiceTarget values
    assert data["tasks"] in ["ts", "python", "compat_fallback"]
    assert data["approvals"] in ["ts", "python", "compat_fallback"]


def test_get_request_capability_target():
    """Test getting capability target from request state."""
    # Create mock request with routing state
    request = MagicMock(spec=Request)
    request.state.capability_routing = {
        Capability.TASKS: ServiceTarget.PYTHON_BACKEND,
        Capability.APPROVALS: ServiceTarget.COMPAT_FALLBACK,
    }

    # Get target for TASKS
    target = get_request_capability_target(request, Capability.TASKS)
    assert target == ServiceTarget.PYTHON_BACKEND

    # Get target for APPROVALS
    target = get_request_capability_target(request, Capability.APPROVALS)
    assert target == ServiceTarget.COMPAT_FALLBACK


def test_routing_middleware_creates_routing_for_all_capabilities(client):
    """Test that routing middleware creates routing for all capabilities."""
    # Create endpoint that checks all capabilities
    @client.app.get("/check-all")
    async def check_all(request: Request):
        routing = request.state.capability_routing
        return {
            "has_all_capabilities": len(routing) == len(Capability),
            "capability_count": len(routing),
        }

    response = client.get("/check-all")
    assert response.status_code == 200
    data = response.json()

    # Should have routing for all capabilities
    assert data["has_all_capabilities"] is True
    assert data["capability_count"] > 0

