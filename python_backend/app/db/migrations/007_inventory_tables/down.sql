-- Migration 007 Rollback: Drop Inventory Tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_equipment_maintenance_equipment_date;
DROP INDEX IF EXISTS idx_inventory_movements_type_date;
DROP INDEX IF EXISTS idx_inventory_movements_chemical_date;
DROP INDEX IF EXISTS idx_equipment_lab_owner;
DROP INDEX IF EXISTS idx_equipment_status_maintenance;
DROP INDEX IF EXISTS idx_chemicals_lab_owner;
DROP INDEX IF EXISTS idx_chemicals_status_quantity;

-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS equipment_maintenance_records;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS chemicals;
