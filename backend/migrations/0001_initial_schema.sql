CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  palm_image_path TEXT,
  palm_image_mime TEXT,
  palm_reading_status TEXT NOT NULL DEFAULT 'pending',
  palm_reading_json TEXT,
  palm_reading_manifest_json TEXT,
  palm_reading_panel_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON user_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
  ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS ritual_states (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  activity TEXT NOT NULL DEFAULT 'meditate',
  feeling TEXT NOT NULL DEFAULT '',
  moods_json TEXT NOT NULL DEFAULT '[]',
  temple TEXT NOT NULL DEFAULT 'thai',
  box TEXT NOT NULL DEFAULT 'gold',
  category TEXT NOT NULL DEFAULT 'work',
  music TEXT NOT NULL DEFAULT 'bell',
  current_step TEXT NOT NULL DEFAULT 'login',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fortune_readings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_snapshot_json TEXT,
  activity TEXT,
  feeling TEXT NOT NULL DEFAULT '',
  moods_json TEXT NOT NULL DEFAULT '[]',
  temple TEXT NOT NULL DEFAULT 'thai',
  box TEXT NOT NULL DEFAULT 'gold',
  category TEXT NOT NULL DEFAULT 'work',
  music TEXT NOT NULL DEFAULT 'bell',
  fortune_num TEXT NOT NULL,
  fortune_title TEXT NOT NULL,
  fortune_text TEXT NOT NULL,
  fortune_advice TEXT,
  fortune_question TEXT,
  fortune_luck TEXT,
  pre_score INTEGER,
  post_score INTEGER,
  post_moods_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fortune_readings_user_id_created_at
  ON fortune_readings(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS palm_reading_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  image_path TEXT,
  response_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_palm_reading_requests_user_id
  ON palm_reading_requests(user_id, created_at DESC);
