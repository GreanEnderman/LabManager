CREATE TABLE IF NOT EXISTS batch_history (
  batch_id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  operator VARCHAR(255) NOT NULL,
  file_name VARCHAR(512) NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS import_records (
  id SERIAL PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  operator VARCHAR(255) NOT NULL,
  reason TEXT,
  time TIMESTAMPTZ NOT NULL,
  run_id VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS error_records (
  id SERIAL PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  record_index INTEGER NOT NULL,
  field_path VARCHAR(255) NOT NULL,
  error_code VARCHAR(64) NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_history_timestamp ON batch_history (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_batch_history_operator ON batch_history (operator);
CREATE INDEX IF NOT EXISTS idx_import_records_batch_id ON import_records (batch_id);
CREATE INDEX IF NOT EXISTS idx_import_records_run_id ON import_records (run_id);
CREATE INDEX IF NOT EXISTS idx_error_records_batch_id ON error_records (batch_id);
