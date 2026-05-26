"""Business logic for inventory operations."""

import json
from datetime import datetime
from uuid import uuid4

from asyncpg import Connection

from app.inventory.models import (
    InventoryOperationRequest,
    InventoryOperationResponse,
    InventoryOperationDTO,
    UpdatedEntityDTO,
    InventoryTransactionDTO,
    TransactionFilters,
)


class InventoryService:
    """Service for inventory operations."""

    def __init__(self, conn: Connection):
        self.conn = conn

    async def create_inventory_operation(
        self, request: InventoryOperationRequest
    ) -> InventoryOperationResponse:
        """Create an inventory operation (inbound/outbound).

        This method:
        1. Validates the entity exists
        2. Checks stock sufficiency for outbound operations
        3. Inserts a movement record
        4. Updates the entity's quantity
        5. Returns the operation result

        All operations are performed in a database transaction for atomicity.
        """
        if request.entity_type != "chemical":
            raise ValueError("Currently only chemical operations are supported")

        async with self.conn.transaction():
            # 1. Fetch the chemical and validate it exists
            result = await self.conn.execute(
                "SELECT id, name, current_quantity, unit FROM chemicals WHERE id = %s",
                (request.entity_id,)
            )
            chemical = await result.fetchone()

            if not chemical:
                raise ValueError(f"Chemical not found: {request.entity_id}")

            # Convert row to dict
            chemical_dict = {
                "id": chemical[0],
                "name": chemical[1],
                "current_quantity": chemical[2],
                "unit": chemical[3],
            }

            # 2. Calculate quantity delta (positive for inbound, negative for outbound)
            quantity_delta = (
                request.quantity
                if request.operation_type == "inbound"
                else -request.quantity
            )

            # 3. Check stock sufficiency for outbound operations
            if request.operation_type == "outbound":
                if chemical_dict["current_quantity"] < request.quantity:
                    raise ValueError(
                        f"库存不足，当前库存: {chemical_dict['current_quantity']}，请求数量: {request.quantity}"
                    )

            # 4. Insert movement record
            movement_id = f"mov-{uuid4()}"
            batch_number = request.metadata.get("batchNumber")
            expiry_date = request.metadata.get("expiryDate")

            await self.conn.execute(
                """
                INSERT INTO inventory_movements (
                    id, chemical_id, movement_type, quantity, unit,
                    operator_name, reason, batch_number, expiry_date,
                    movement_date, metadata
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s::jsonb
                )
                """,
                (
                    movement_id,
                    request.entity_id,
                    request.operation_type,
                    request.quantity,
                    request.unit,
                    request.operator.name,
                    request.reason,
                    batch_number,
                    expiry_date,
                    json.dumps(request.metadata),
                )
            )

            # 5. Update chemical quantity
            result = await self.conn.execute(
                """
                UPDATE chemicals
                SET current_quantity = current_quantity + %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING id, name, current_quantity, (current_quantity - %s) as previous_quantity
                """,
                (quantity_delta, request.entity_id, quantity_delta)
            )
            updated = await result.fetchone()

            if not updated:
                raise ValueError(f"Failed to update chemical: {request.entity_id}")

            # Convert to dict
            updated_dict = {
                "id": updated[0],
                "name": updated[1],
                "current_quantity": updated[2],
                "previous_quantity": updated[3],
            }

            # 6. Fetch the created movement record
            result = await self.conn.execute(
                """
                SELECT id, chemical_id, movement_type, quantity, unit,
                       operator_name, reason, movement_date, metadata
                FROM inventory_movements
                WHERE id = %s
                """,
                (movement_id,)
            )
            movement = await result.fetchone()

            # Convert to dict
            movement_dict = {
                "id": movement[0],
                "chemical_id": movement[1],
                "movement_type": movement[2],
                "quantity": movement[3],
                "unit": movement[4],
                "operator_name": movement[5],
                "reason": movement[6],
                "movement_date": movement[7],
                "metadata": movement[8],
            }

            # 7. Build response
            operation_dto = InventoryOperationDTO(
                id=movement_dict["id"],
                entity_type="chemical",
                entity_id=movement_dict["chemical_id"],
                entity_name=chemical_dict["name"],
                operation_type=movement_dict["movement_type"],
                quantity=movement_dict["quantity"],
                unit=movement_dict["unit"],
                operator_name=movement_dict["operator_name"],
                reason=movement_dict["reason"],
                operation_date=movement_dict["movement_date"],
                metadata=movement_dict["metadata"],
            )

            updated_entity_dto = UpdatedEntityDTO(
                id=updated_dict["id"],
                current_quantity=updated_dict["current_quantity"],
                previous_quantity=updated_dict["previous_quantity"],
            )

            return InventoryOperationResponse(
                operation=operation_dto,
                updated_entity=updated_entity_dto,
            )

    async def list_inventory_transactions(
        self, filters: TransactionFilters
    ) -> list[InventoryTransactionDTO]:
        """List inventory transactions with optional filters."""
        # Build query dynamically based on filters
        query = """
            SELECT
                m.id,
                m.chemical_id,
                c.name as entity_name,
                m.movement_type,
                m.quantity,
                m.unit,
                m.operator_name,
                m.reason,
                m.batch_number,
                m.expiry_date,
                m.movement_date,
                m.created_at,
                m.metadata
            FROM inventory_movements m
            JOIN chemicals c ON m.chemical_id = c.id
            WHERE 1=1
        """

        params = []
        param_count = 0

        # Apply filters
        if filters.entity_id:
            param_count += 1
            query += f" AND m.chemical_id = %s"
            params.append(filters.entity_id)

        if filters.operation_type:
            param_count += 1
            query += f" AND m.movement_type = %s"
            params.append(filters.operation_type)

        if filters.start_date:
            param_count += 1
            query += f" AND m.movement_date >= %s"
            params.append(filters.start_date)

        if filters.end_date:
            param_count += 1
            query += f" AND m.movement_date <= %s"
            params.append(filters.end_date)

        # Order by date descending
        query += " ORDER BY m.movement_date DESC"

        # Apply limit and offset
        query += f" LIMIT %s OFFSET %s"
        params.append(filters.limit)
        params.append(filters.offset)

        # Execute query
        result = await self.conn.execute(query, tuple(params))
        rows = await result.fetchall()

        # Convert to DTOs
        transactions = []
        for row in rows:
            transaction = InventoryTransactionDTO(
                id=row[0],
                chemical_id=row[1],
                entity_name=row[2],
                movement_type=row[3],
                quantity=row[4],
                unit=row[5],
                operator_name=row[6],
                reason=row[7],
                batch_number=row[8],
                expiry_date=str(row[9]) if row[9] else None,
                movement_date=row[10],
                created_at=row[11],
                metadata=row[12],
            )
            transactions.append(transaction)

        return transactions

    async def list_chemicals(self) -> list[dict]:
        """List all chemicals from database."""
        rows = await self.conn.fetch(
            """
            SELECT id, name, cas_number, category, spec,
                   current_quantity, threshold, unit, status,
                   lab_name, owner_name, location, image_data_url,
                   remark, created_at, updated_at, metadata
            FROM chemicals
            ORDER BY updated_at DESC
            """
        )

        chemicals = []
        for row in rows:
            chemical = {
                "id": row[0],
                "name": row[1],
                "casNumber": row[2],
                "category": row[3],
                "spec": row[4],
                "currentQuantity": row[5],
                "threshold": row[6],
                "unit": row[7],
                "status": row[8],
                "labName": row[9],
                "ownerName": row[10],
                "location": row[11],
                "imageDataUrl": row[12],
                "remark": row[13],
                "createdAt": row[14].isoformat() if row[14] else None,
                "updatedAt": row[15].isoformat() if row[15] else None,
                "metadata": row[16],
            }
            chemicals.append(chemical)

        return chemicals

    async def list_equipment(self) -> list[dict]:
        """List all equipment from database."""
        rows = await self.conn.fetch(
            """
            SELECT id, name, vendor, model, serial_number, status,
                   lab_name, owner_name, location, purchase_date,
                   last_maintenance_at, next_maintenance_at,
                   maintenance_interval_days, image_data_url,
                   remark, created_at, updated_at, metadata
            FROM equipment
            ORDER BY updated_at DESC
            """
        )

        equipment_list = []
        for row in rows:
            equipment = {
                "id": row[0],
                "name": row[1],
                "vendor": row[2],
                "model": row[3],
                "serialNumber": row[4],
                "status": row[5],
                "labName": row[6],
                "ownerName": row[7],
                "location": row[8],
                "purchaseDate": str(row[9]) if row[9] else None,
                "lastMaintenanceAt": str(row[10]) if row[10] else None,
                "nextMaintenanceAt": str(row[11]) if row[11] else None,
                "maintenanceIntervalDays": row[12],
                "imageDataUrl": row[13],
                "remark": row[14],
                "createdAt": row[15].isoformat() if row[15] else None,
                "updatedAt": row[16].isoformat() if row[16] else None,
                "metadata": row[17],
            }
            equipment_list.append(equipment)

        return equipment_list

    async def import_chemicals(self, rows: list[dict]) -> tuple[list[dict], list[dict]]:
        """Import chemicals into database.

        Returns:
            Tuple of (imported_records, errors)
        """
        imported = []
        errors = []

        for idx, row in enumerate(rows):
            try:
                chemical_id = row.get("recordId") or f"chem-{uuid4()}"

                # Upsert chemical
                await self.conn.execute(
                    """
                    INSERT INTO chemicals (
                        id, name, cas_number, category, spec,
                        current_quantity, threshold, unit, status,
                        lab_name, owner_name, location, image_data_url,
                        remark, metadata
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        cas_number = EXCLUDED.cas_number,
                        category = EXCLUDED.category,
                        spec = EXCLUDED.spec,
                        current_quantity = EXCLUDED.current_quantity,
                        threshold = EXCLUDED.threshold,
                        unit = EXCLUDED.unit,
                        status = EXCLUDED.status,
                        lab_name = EXCLUDED.lab_name,
                        owner_name = EXCLUDED.owner_name,
                        location = EXCLUDED.location,
                        image_data_url = EXCLUDED.image_data_url,
                        remark = EXCLUDED.remark,
                        metadata = EXCLUDED.metadata,
                        updated_at = now()
                    """,
                    (
                        chemical_id,
                        row.get("name"),
                        row.get("casNumber"),
                        row.get("category"),
                        row.get("spec"),
                        row.get("currentQuantity", 0),
                        row.get("threshold", 5),
                        row.get("unit", "瓶"),
                        row.get("status", "正常"),
                        row.get("labName"),
                        row.get("ownerName"),
                        row.get("location"),
                        row.get("imageDataUrl"),
                        row.get("remark"),
                        json.dumps(row.get("metadata", {})),
                    )
                )

                # 提交每条记录的事务
                await self.conn.commit()

                imported.append({"id": chemical_id, "name": row.get("name")})

            except Exception as e:
                # 回滚失败的事务
                await self.conn.rollback()
                errors.append({
                    "row": idx,
                    "error": str(e),
                    "data": row
                })

        return imported, errors

    async def import_equipment(self, rows: list[dict]) -> tuple[list[dict], list[dict]]:
        """Import equipment into database.

        Returns:
            Tuple of (imported_records, errors)
        """
        imported = []
        errors = []

        def parse_date(date_str):
            """解析各种日期格式，包括 '2025.3' 这样的格式"""
            if not date_str:
                return None

            date_str = str(date_str).strip()

            # 处理 "2025.3" 格式（年.月）
            if '.' in date_str and date_str.count('.') == 1:
                try:
                    year, month = date_str.split('.')
                    return f"{year}-{month.zfill(2)}-01"
                except:
                    pass

            # 处理 "2025-3" 或 "2025/3" 格式
            for sep in ['-', '/']:
                if sep in date_str:
                    parts = date_str.split(sep)
                    if len(parts) == 2:  # 年-月
                        try:
                            return f"{parts[0]}-{parts[1].zfill(2)}-01"
                        except:
                            pass
                    elif len(parts) == 3:  # 年-月-日
                        try:
                            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                        except:
                            pass

            # 如果已经是标准格式或无法解析，返回原值
            return date_str

        for idx, row in enumerate(rows):
            try:
                equipment_id = row.get("recordId") or f"equip-{uuid4()}"

                # 解析日期字段
                last_maintenance_at = parse_date(row.get("lastMaintenanceAt"))
                next_maintenance_at = parse_date(row.get("nextMaintenanceAt"))
                purchase_date = parse_date(row.get("purchaseDate"))

                # Upsert equipment
                await self.conn.execute(
                    """
                    INSERT INTO equipment (
                        id, name, vendor, model, serial_number, status,
                        lab_name, owner_name, location, purchase_date,
                        last_maintenance_at, next_maintenance_at,
                        maintenance_interval_days, image_data_url,
                        remark, metadata
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        vendor = EXCLUDED.vendor,
                        model = EXCLUDED.model,
                        serial_number = EXCLUDED.serial_number,
                        status = EXCLUDED.status,
                        lab_name = EXCLUDED.lab_name,
                        owner_name = EXCLUDED.owner_name,
                        location = EXCLUDED.location,
                        purchase_date = EXCLUDED.purchase_date,
                        last_maintenance_at = EXCLUDED.last_maintenance_at,
                        next_maintenance_at = EXCLUDED.next_maintenance_at,
                        maintenance_interval_days = EXCLUDED.maintenance_interval_days,
                        image_data_url = EXCLUDED.image_data_url,
                        remark = EXCLUDED.remark,
                        metadata = EXCLUDED.metadata,
                        updated_at = now()
                    """,
                    (
                        equipment_id,
                        row.get("name"),
                        row.get("vendor"),
                        row.get("model"),
                        row.get("serialNumber"),
                        row.get("status", "正常"),
                        row.get("labName"),
                        row.get("ownerName"),
                        row.get("location"),
                        purchase_date,
                        last_maintenance_at,
                        next_maintenance_at,
                        row.get("maintenanceIntervalDays", 180),
                        row.get("imageDataUrl"),
                        row.get("remark"),
                        json.dumps(row.get("metadata", {})),
                    )
                )

                # 提交每条记录的事务
                await self.conn.commit()

                imported.append({"id": equipment_id, "name": row.get("name")})

            except Exception as e:
                # 回滚失败的事务
                await self.conn.rollback()
                errors.append({
                    "row": idx,
                    "error": str(e),
                    "data": row
                })

        return imported, errors
