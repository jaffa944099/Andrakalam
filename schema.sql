CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  edition_date TEXT NOT NULL,
  district TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS edition_date_index ON editions(edition_date DESC);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry_index ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts (
  client TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
