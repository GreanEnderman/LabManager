"""Pydantic models for inventory operations."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, ConfigDict


class ActorInfo(BaseModel):
    """Actor information for operations."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    type: str = "user"


class InventoryOperationRequest(BaseModel):
    """Request model for creating an inventory operation."""

    model_config = ConfigDict(populate_by_name=True)

    entity_type: Literal["chemical", "equipment"] = Field(
        ..., description="Type of entity (chemical or equipment)", alias="entityType"
    )
    entity_id: str = Field(..., description="ID of the chemical or equipment", alias="entityId")
    operation_type: Literal["inbound", "outbound"] = Field(
        ..., description="Operation type: inbound (入库) or outbound (出库)", alias="operationType"
    )
    quantity: int = Field(..., gt=0, description="Quantity (must be positive)")
    unit: str = Field(default="瓶", description="Unit of measurement")
    operator: ActorInfo = Field(..., description="Operator information")
    reason: str | None = Field(None, description="Reason for the operation")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata (e.g., batchNumber, expiryDate)"
    )


class InventoryOperationDTO(BaseModel):
    """DTO for inventory operation record."""

    id: str
    entity_type: str
    entity_id: str
    entity_name: str
    operation_type: str
    quantity: int
    unit: str
    operator_name: str
    reason: str | None
    operation_date: datetime
    metadata: dict[str, Any]


class UpdatedEntityDTO(BaseModel):
    """DTO for updated entity after operation."""

    id: str
    current_quantity: int
    previous_quantity: int


class InventoryOperationResponse(BaseModel):
    """Response model for inventory operation."""

    operation: InventoryOperationDTO
    updated_entity: UpdatedEntityDTO


class InventoryTransactionDTO(BaseModel):
    """DTO for inventory transaction record (for listing)."""

    id: str
    chemical_id: str | None = None
    equipment_id: str | None = None
    entity_name: str
    movement_type: str  # 'inbound' or 'outbound'
    quantity: int
    unit: str
    operator_name: str | None
    reason: str | None
    batch_number: str | None = None
    expiry_date: str | None = None
    movement_date: datetime
    created_at: datetime
    metadata: dict[str, Any]


class TransactionFilters(BaseModel):
    """Filters for listing transactions."""

    entity_type: Literal["chemical", "equipment"] | None = None
    operation_type: Literal["inbound", "outbound"] | None = None
    entity_id: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    limit: int = Field(default=100, le=1000)
    offset: int = Field(default=0, ge=0)
