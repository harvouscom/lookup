CREATE TABLE IF NOT EXISTS sync_state (region TEXT PRIMARY KEY, cc TEXT NOT NULL, synced_at INTEGER, dirty_at INTEGER, last_ms INTEGER, last_result TEXT);
CREATE TABLE IF NOT EXISTS embed_pending (id TEXT PRIMARY KEY);
CREATE INDEX IF NOT EXISTS places_lat ON places(lat);
