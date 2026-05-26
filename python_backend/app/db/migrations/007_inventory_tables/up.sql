-- Migration 007: Inventory Tables (Chemicals and Equipment)
-- Creates tables for chemical inventory and equipment management

-- Chemicals table
CREATE TABLE IF NOT EXISTS chemicals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cas_number TEXT NULL,
  category TEXT NULL,
  spec TEXT NULL,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT '瓶',
  status TEXT NOT NULL DEFAULT '正常',
  lab_name TEXT NULL,
  owner_name TEXT NULL,
  location TEXT NULL,
  image_data_url TEXT NULL,
  remark TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NULL,
  model TEXT NULL,
  serial_number TEXT NULL,
  status TEXT NOT NULL DEFAULT '正常',
  lab_name TEXT NULL,
  owner_name TEXT NULL,
  location TEXT NULL,
  purchase_date DATE NULL,
  last_maintenance_at DATE NULL,
  next_maintenance_at DATE NULL,
  maintenance_interval_days INTEGER NULL DEFAULT 180,
  image_data_url TEXT NULL,
  remark TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Inventory movements table (inbound/outbound records)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  chemical_id TEXT NOT NULL,
  movement_type TEXT NOT NULL, -- 'inbound' or 'outbound'
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT '瓶',
  operator_name TEXT NULL,
  reason TEXT NULL,
  batch_number TEXT NULL,
  expiry_date DATE NULL,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_inventory_movements_chemical_id FOREIGN KEY (chemical_id) REFERENCES chemicals (id)
);

-- Equipment maintenance records table
CREATE TABLE IF NOT EXISTS equipment_maintenance_records (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  maintenance_type TEXT NOT NULL, -- 'routine', 'repair', 'calibration', 'inspection'
  maintenance_date DATE NOT NULL,
  engineer_name TEXT NULL,
  description TEXT NULL,
  result TEXT NULL,
  next_maintenance_date DATE NULL,
  cost DECIMAL(10, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_equipment_maintenance_equipment_id FOREIGN KEY (equipment_id) REFERENCES equipment (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chemicals_status_quantity
  ON chemicals (status, current_quantity);

CREATE INDEX IF NOT EXISTS idx_chemicals_lab_owner
  ON chemicals (lab_name, owner_name);

CREATE INDEX IF NOT EXISTS idx_equipment_status_maintenance
  ON equipment (status, last_maintenance_at);

CREATE INDEX IF NOT EXISTS idx_equipment_lab_owner
  ON equipment (lab_name, owner_name);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_chemical_date
  ON inventory_movements (chemical_id, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_date
  ON inventory_movements (movement_type, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment_date
  ON equipment_maintenance_records (equipment_id, maintenance_date DESC);

-- Comments for documentation
COMMENT ON TABLE chemicals IS '化学品库存表';
COMMENT ON TABLE equipment IS '设备资产表';
COMMENT ON TABLE inventory_movements IS '化学品出入库记录表';
COMMENT ON TABLE equipment_maintenance_records IS '设备维护记录表';

COMMENT ON COLUMN chemicals.cas_number IS 'CAS登记号';
COMMENT ON COLUMN chemicals.current_quantity IS '当前库存数量';
COMMENT ON COLUMN chemicals.threshold IS '低库存阈值';
COMMENT ON COLUMN equipment.maintenance_interval_days IS '维护间隔天数（默认180天）';
COMMENT ON COLUMN inventory_movements.movement_type IS '出入库类型：inbound=入库, outbound=出库';
COMMENT ON COLUMN equipment_maintenance_records.maintenance_type IS '维护类型：routine=例行, repair=维修, calibration=校准, inspection=检查';
