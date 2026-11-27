PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS students (
  nim TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  nim TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS votes (
  nim TEXT PRIMARY KEY,
  group_method TEXT NOT NULL,
  theme_rank_1 TEXT NOT NULL,
  theme_rank_2 TEXT NOT NULL,
  theme_rank_3 TEXT NOT NULL,
  theme_rank_4 TEXT NOT NULL,
  theme_rank_5 TEXT NOT NULL,
  custom_theme TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(nim) REFERENCES students(nim) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO settings(setting_key,setting_value) VALUES
 ('voting_status','open'),
 ('deadline','2026-11-29T23:59:00+07:00');

CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON audit_log(actor,id);
