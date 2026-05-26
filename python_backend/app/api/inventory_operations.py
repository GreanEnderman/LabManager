"""API endpoints for inventory operations."""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.db.postgres import get_db_connection
from app.inventory.models import (
    InventoryOperationRequest,
    InventoryOperationResponse,
    TransactionFilters,
)
from app.inventory.service import InventoryService

router = APIRouter(prefix="/api/ai/inventory", tags=["inventory-operations"])


def ok(data: Any) -> dict[str, Any]:
    """Wrap response data in standard envelope."""
    return {"data": data, "error": None}


@router.post("/operations")
async def create_inventory_operation(
    request: InventoryOperationRequest,
) -> dict[str, Any]:
    """Create a new inventory operation (inbound/outbound).

    This endpoint:
    - Validates the request
    - Creates an inventory movement record
    - Updates the entity's quantity atomically
    - Returns the operation result

    Args:
        request: Inventory operation request

    Returns:
        Operation result with updated entity information

    Raises:
        HTTPException: 400 if validation fails or insufficient stock
        HTTPException: 404 if entity not found
        HTTPException: 500 if database error occurs
    """
    try:
        async with get_db_connection() as conn:
            service = InventoryService(conn)
            result = await service.create_inventory_operation(request)

            # Convert to dict for response
            response_data = {
                "operation": {
                    "id": result.operation.id,
                    "entityType": result.operation.entity_type,
                    "entityId": result.operation.entity_id,
                    "entityName": result.operation.entity_name,
                    "operationType": result.operation.operation_type,
                    "quantity": result.operation.quantity,
                    "unit": result.operation.unit,
                    "operatorName": result.operation.operator_name,
                    "reason": result.operation.reason,
                    "operationDate": result.operation.operation_date.isoformat().replace(
                        "+00:00", "Z"
                    ),
                    "metadata": result.operation.metadata,
                },
                "updatedEntity": {
                    "id": result.updated_entity.id,
                    "currentQuantity": result.updated_entity.current_quantity,
                    "previousQuantity": result.updated_entity.previous_quantity,
                },
            }

            return ok(response_data)

    except ValueError as e:
        # Business logic errors (not found, insufficient stock, etc.)
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=404,
                detail={"code": "not_found", "message": error_msg},
            )
        else:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_request", "message": error_msg},
            )
    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail={"code": "internal_error", "message": f"Internal server error: {e}"},
        )


@router.get("/transactions")
async def list_inventory_transactions(
    entity_type: str | None = None,
    operation_type: str | None = None,
    entity_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """List inventory transactions with optional filters.

    Args:
        entity_type: Filter by entity type (chemical/equipment)
        operation_type: Filter by operation type (inbound/outbound)
        entity_id: Filter by specific entity ID
        start_date: Filter by start date (ISO format)
        end_date: Filter by end date (ISO format)
        limit: Maximum number of records to return (default 100, max 1000)
        offset: Number of records to skip (default 0)

    Returns:
        List of inventory transactions
    """
    try:
        filters = TransactionFilters(
            entity_type=entity_type,
            operation_type=operation_type,
            entity_id=entity_id,
            start_date=start_date,
            end_date=end_date,
            limit=min(limit, 1000),
            offset=offset,
        )

        async with get_db_connection() as conn:
            service = InventoryService(conn)
            transactions = await service.list_inventory_transactions(filters)

            # Convert to response format
            transactions_data = []
            for txn in transactions:
                transactions_data.append({
                    "id": txn.id,
                    "date": txn.movement_date.isoformat().replace("+00:00", "Z"),
                    "name": txn.entity_name,
                    "type": "入库" if txn.movement_type == "inbound" else "出库",
                    "quantity": str(txn.quantity),
                    "unit": txn.unit,
                    "operator": txn.operator_name or "未知",
                    "reason": txn.reason or "",
                    "batchNumber": txn.batch_number,
                    "expiryDate": txn.expiry_date,
                    "metadata": txn.metadata,
                })

            return ok(transactions_data)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "internal_error", "message": f"Internal server error: {e}"},
        )
