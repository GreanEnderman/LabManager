from fastapi import APIRouter

from app.api.health import health_router
from app.api.imports import router as imports_router
from app.api.rules import router as rules_router
from app.api.email import router as email_router
from app.api.reports.endpoints import router as reports_router
from app.api.pdf.endpoints import router as pdf_router
from app.api.tasks import router as tasks_router
from app.api.settings import router as settings_router
from app.api.inventory import router as inventory_router
from app.api.inventory_operations import router as inventory_operations_router
from app.api.import_batches import router as import_batches_router
from app.api.ai_compat import router as ai_compat_router
from app.api.memories import router as memories_router
from app.gateway.imports import router as gateway_imports_router
from app.api.dashboard import router as dashboard_router
from app.api.workflow import router as workflow_router

api_router = APIRouter()
api_router.include_router(ai_compat_router)
api_router.include_router(health_router)
api_router.include_router(rules_router)
api_router.include_router(imports_router)
api_router.include_router(email_router)
api_router.include_router(reports_router)
api_router.include_router(pdf_router)
api_router.include_router(tasks_router)
api_router.include_router(settings_router)
api_router.include_router(inventory_router)
api_router.include_router(inventory_operations_router)
api_router.include_router(import_batches_router)
api_router.include_router(gateway_imports_router)
api_router.include_router(dashboard_router)
api_router.include_router(memories_router)
api_router.include_router(workflow_router)
