CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_users_role_active ON app_users (role, is_active);

INSERT INTO app_users (id, username, display_name, role, password_hash, metadata)
VALUES
  (
    'default-admin',
    'admin',
    'Default Admin',
    'admin',
    'pbkdf2_sha256$120000$labmanager-default-admin-2026$leopwGZ2r_vMyzTsFxKdK5a1uZ1iAolUUccSJR-GPlc=',
    '{"seeded": true}'::jsonb
  ),
  (
    'default-manager',
    'manager',
    'Default Manager',
    'manager',
    'pbkdf2_sha256$120000$labmanager-default-manager-2026$-1OuYkQsZ2oNDVzCjwU5OvGTJr4kdg590CkdYqWB6l0=',
    '{"seeded": true}'::jsonb
  ),
  (
    'default-operator',
    'operator',
    'Default Operator',
    'operator',
    'pbkdf2_sha256$120000$labmanager-default-operator-2026$486rKh64zZoPQKCDIWHWATeUDp_I5cwfNVigPJuBOoI=',
    '{"seeded": true}'::jsonb
  ),
  (
    'default-viewer',
    'viewer',
    'Default Viewer',
    'viewer',
    'pbkdf2_sha256$120000$labmanager-default-viewer-2026$eJcgFiWlCP-1juoHq9I5rY6RBxisncoH44nyARSt1_Y=',
    '{"seeded": true}'::jsonb
  )
ON CONFLICT (username) DO NOTHING;
