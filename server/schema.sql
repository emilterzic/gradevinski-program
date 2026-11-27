-- BIS program: baza (Cloudflare D1). Pokreće se jednom; sve naredbe su ponovljive.
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT, company TEXT, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', active INTEGER NOT NULL DEFAULT 1, valid_until TEXT, modes TEXT NOT NULL DEFAULT '["gradnja"]', created_at INTEGER NOT NULL, last_login INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE TABLE IF NOT EXISTS docs (user_id TEXT NOT NULL, id TEXT NOT NULL, part INTEGER NOT NULL DEFAULT 0, parts INTEGER NOT NULL DEFAULT 1, name TEXT, updated_at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (user_id, id, part));
CREATE TABLE IF NOT EXISTS files (user_id TEXT NOT NULL, id TEXT NOT NULL, part INTEGER NOT NULL, parts INTEGER NOT NULL, type TEXT, size INTEGER, created_at INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (user_id, id, part));
CREATE TABLE IF NOT EXISTS login_fail (k TEXT NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS login_fail_k ON login_fail (k, t);
