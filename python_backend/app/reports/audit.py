import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def write_audit_log(
    entity_type: str,
    entity_id: str,
    action: str,
    operator: str,
    run_id: str,
    details: dict | None = None
):
    """Write audit log entry."""
    log_entry = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "operator": operator,
        "run_id": run_id,
        "timestamp": datetime.now().isoformat(),
        "details": details or {}
    }
    logger.info(f"Audit log: {log_entry}")
    # TODO: Write to database audit_logs table
    return log_entry
