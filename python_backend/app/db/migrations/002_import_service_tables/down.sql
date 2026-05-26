DROP INDEX IF EXISTS idx_error_records_batch_id;
DROP INDEX IF EXISTS idx_import_records_run_id;
DROP INDEX IF EXISTS idx_import_records_batch_id;
DROP INDEX IF EXISTS idx_batch_history_operator;
DROP INDEX IF EXISTS idx_batch_history_timestamp;

DROP TABLE IF EXISTS error_records;
DROP TABLE IF EXISTS import_records;
DROP TABLE IF EXISTS batch_history;
