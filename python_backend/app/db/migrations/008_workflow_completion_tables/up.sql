CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  chemical_id TEXT NULL,
  chemical_name TEXT NOT NULL,
  quantity INTEGER NULL,
  unit TEXT NULL,
  status TEXT NOT NULL,
  requested_by JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_purchase_requests_task_id FOREIGN KEY (task_id) REFERENCES ai_tasks (id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_task_status
  ON purchase_requests (task_id, status, created_at DESC);

ALTER TABLE equipment_maintenance_records
  ADD COLUMN IF NOT EXISTS task_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS report_title TEXT NULL,
  ADD COLUMN IF NOT EXISTS report_file_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS report_content_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS report_storage_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by JSONB NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_task_id
  ON equipment_maintenance_records (task_id);
