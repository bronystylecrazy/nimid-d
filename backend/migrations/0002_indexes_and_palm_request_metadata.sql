CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
  ON users(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_ritual_states_updated_at
  ON ritual_states(updated_at);

CREATE INDEX IF NOT EXISTS idx_palm_reading_requests_status_created_at
  ON palm_reading_requests(status, created_at DESC);

ALTER TABLE palm_reading_requests ADD COLUMN model TEXT;
ALTER TABLE palm_reading_requests ADD COLUMN manifest_json TEXT;
ALTER TABLE palm_reading_requests ADD COLUMN panel_image_path TEXT;
