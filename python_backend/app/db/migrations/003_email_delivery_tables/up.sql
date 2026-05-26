CREATE TABLE IF NOT EXISTS email_send_records (
    id SERIAL PRIMARY KEY,
    report_id INTEGER,
    recipients TEXT NOT NULL,
    subject TEXT,
    status VARCHAR(50) NOT NULL,
    error TEXT,
    operator_id INTEGER,
    task_run_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_send_records_status ON email_send_records(status);
CREATE INDEX idx_email_send_records_created_at ON email_send_records(created_at);
CREATE INDEX idx_email_send_records_report_id ON email_send_records(report_id);
