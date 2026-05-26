"""
Example: How to Apply Permission Checks in API Routes

This document demonstrates how to integrate the authorization middleware
into Python backend API routes.
"""

# Example 1: Single capability requirement
# =========================================

from fastapi import APIRouter, Depends, Request
from app.api.auth_middleware import require_capability
from app.authz import AppCapability

router = APIRouter()

@router.post("/api/ai/rules/execute")
async def execute_rule(
    request: Request,
    user = Depends(require_capability(AppCapability.RULES_EXECUTE))
):
    """Execute AI rules - requires rules:execute capability."""
    # user is guaranteed to have rules:execute capability
    payload = await request.json()
    # ... existing implementation
    return {"data": result}


# Example 2: Multiple capability options
# =======================================

from app.api.auth_middleware import require_any_capability

@router.get("/api/ai/tasks")
async def list_tasks(
    request: Request,
    user = Depends(require_any_capability(
        AppCapability.TASKS_READ,
        AppCapability.TASKS_WRITE
    ))
):
    """List tasks - requires tasks:read OR tasks:write."""
    # user has at least one of the specified capabilities
    # ... existing implementation
    return {"data": tasks}


# Example 3: Key endpoints and their required capabilities
# =========================================================

# Rules and Agent Execution
@router.post("/api/ai/rules/execute")
# Requires: AppCapability.RULES_EXECUTE

@router.post("/api/ai/agents/task-tracking/execute")
# Requires: AppCapability.AGENTS_EXECUTE

@router.post("/api/ai/agents/reporting/execute")
# Requires: AppCapability.AGENTS_EXECUTE

@router.post("/api/ai/agents/retrospective/execute")
# Requires: AppCapability.AGENTS_EXECUTE


# Task Management
@router.get("/api/ai/tasks")
# Requires: AppCapability.TASKS_READ

@router.post("/api/ai/tasks")
# Requires: AppCapability.TASKS_WRITE

@router.patch("/api/ai/tasks/{task_id}/status")
# Requires: AppCapability.TASKS_WRITE

@router.patch("/api/ai/tasks/{task_id}/assign")
# Requires: AppCapability.TASKS_WRITE


# Approval Management
@router.get("/api/ai/approvals")
# Requires: AppCapability.APPROVALS_READ

@router.post("/api/ai/approvals")
# Requires: AppCapability.APPROVALS_WRITE

@router.patch("/api/ai/approvals/{approval_id}/process")
# Requires: AppCapability.APPROVALS_WRITE


# Report Management
@router.get("/api/ai/reports")
# Requires: AppCapability.REPORTS_READ

@router.post("/api/ai/reports/generate")
# Requires: AppCapability.REPORTS_GENERATE

@router.delete("/api/ai/reports/{report_id}")
# Requires: AppCapability.REPORTS_DELETE


# Settings Management
@router.get("/api/ai/settings")
# Requires: AppCapability.SETTINGS_READ

@router.patch("/api/ai/settings")
# Requires: AppCapability.SETTINGS_UPDATE


# Import Management
@router.get("/api/imports")
# Requires: AppCapability.IMPORTS_READ

@router.post("/api/imports")
# Requires: AppCapability.IMPORTS_CREATE


# Example 4: Integration with existing ai_compat.py
# ==================================================

"""
To integrate into python_backend/app/api/ai_compat.py:

1. Import the middleware:
   from app.api.auth_middleware import require_capability
   from app.authz import AppCapability

2. Add dependency to route handlers:
   @router.post("/rules/execute")
   async def execute_rule(
       request: Request,
       user = Depends(require_capability(AppCapability.RULES_EXECUTE))
   ):
       # ... existing implementation

3. The middleware will:
   - Check if user is authenticated (401 if not)
   - Check if user has required capability (403 if not)
   - Record forbidden actions to audit log
   - Return authenticated user object if checks pass
"""


# Example 5: Error handling
# ==========================

"""
The middleware automatically handles errors:

- 401 Unauthorized: User is not authenticated
  Response: {"detail": "Unauthorized"}

- 403 Forbidden: User lacks required capability
  Response: {"detail": "Forbidden: requires capability 'tasks:write'"}

Forbidden actions are automatically recorded to the audit log with:
- user: The user who attempted the action
- capability: The capability that was required
- context: Additional context (path, method, etc.)
"""


# Example 6: Testing with permissions
# ====================================

"""
When testing endpoints with permission checks:

1. Mock the user in request.state:
   request.state.user = {
       "id": "test-user",
       "name": "Test User",
       "capabilities": ["tasks:read", "tasks:write"]
   }

2. Or use the test fixtures:
   @pytest.fixture
   def admin_user():
       return {
           "id": "admin",
           "name": "Admin User",
           "capabilities": get_capabilities_for_role("admin")
       }
"""
