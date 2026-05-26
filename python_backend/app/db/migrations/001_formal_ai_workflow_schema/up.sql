CREATE TABLE IF NOT EXISTS ai_tasks (
  id TEXT PRIMARY KEY,
  event_id TEXT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  assignee_id TEXT NULL,
  assignee_name TEXT NULL,
  assignee_role TEXT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  requested_by JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewer_id TEXT NULL,
  reviewer_name TEXT NULL,
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_approvals_task_id FOREIGN KEY (task_id) REFERENCES ai_tasks (id)
);

CREATE TABLE IF NOT EXISTS ai_task_actions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  approval_id TEXT NULL,
  action_type TEXT NOT NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  actor JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  detail TEXT NOT NULL,
  tool_name TEXT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ai_task_actions_task_id FOREIGN KEY (task_id) REFERENCES ai_tasks (id),
  CONSTRAINT fk_ai_task_actions_approval_id FOREIGN KEY (approval_id) REFERENCES approvals (id)
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  source TEXT NOT NULL,
  file_name TEXT NULL,
  status TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  imported_by JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  imported_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_inspection_triggered BOOLEAN NOT NULL DEFAULT false,
  generated_event_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS report_deliveries (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  report_title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT NULL,
  triggered_by JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_mode TEXT NOT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_report_deliveries_report_id FOREIGN KEY (report_id) REFERENCES ai_reports (id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NULL,
  setting_key TEXT NOT NULL,
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status_priority_risk_due_at
  ON ai_tasks (status, priority, risk_level, due_at);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_source_type_source_id
  ON ai_tasks (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_actions_task_id_created_at
  ON ai_task_actions (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_status_risk_created_at
  ON approvals (status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reports_type_created_at
  ON ai_reports (report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status_created_at
  ON import_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_report_id_status_sent_at
  ON report_deliveries (report_id, status, sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_system_settings_setting_key
  ON system_settings (setting_key);
