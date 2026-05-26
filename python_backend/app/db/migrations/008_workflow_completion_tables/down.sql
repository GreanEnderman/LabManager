DROP INDEX IF EXISTS idx_equipment_maintenance_task_id;

ALTER TABLE equipment_maintenance_records
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS confirmed_by,
  DROP COLUMN IF EXISTS report_storage_url,
  DROP COLUMN IF EXISTS report_content_type,
  DROP COLUMN IF EXISTS report_file_name,
  DROP COLUMN IF EXISTS report_title,
  DROP COLUMN IF EXISTS task_id;

DROP INDEX IF EXISTS idx_purchase_requests_task_status;
DROP TABLE IF EXISTS purchase_requests;
