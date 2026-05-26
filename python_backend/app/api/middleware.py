from datetime import datetime
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.audit = {
            "operator": request.headers.get("X-Operator-ID", "system"),
            "reason": request.headers.get("X-Reason", None),
            "time": datetime.utcnow(),
            "run_id": request.headers.get("X-Run-ID", str(uuid4())),
        }
        response = await call_next(request)
        return response
