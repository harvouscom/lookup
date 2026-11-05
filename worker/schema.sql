CREATE TABLE church (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  short_id TEXT,
  name TEXT NOT NULL,
  street TEXT,
  city TEXT,
  near TEXT,
  postal_code TEXT,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  denomination TEXT,
  service_times TEXT,
  languages TEXT,
  ministries TEXT,
  pastor_name TEXT,
  last_verified INTEGER,
  completeness INTEGER NOT NULL,
  doc_hash TEXT NOT NULL,
  embed_hash TEXT NOT NULL
);
CREATE INDEX church_region ON church(region);
CREATE VIRTUAL TABLE church_fts USING fts5(name, loc, geo, prefix='1 2 3 4 5 6 7 8', tokenize='unicode61 remove_diacritics 2');
CREATE TABLE places (
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (key, region)
) WITHOUT ROWID;
CREATE TABLE vocab (id INTEGER PRIMARY KEY, token TEXT NOT NULL UNIQUE, df INTEGER NOT NULL);
CREATE TABLE vocab_del (del TEXT NOT NULL, id INTEGER NOT NULL, PRIMARY KEY (del, id)) WITHOUT ROWID;
CREATE TABLE moved (id TEXT PRIMARY KEY, moved_to TEXT NOT NULL);
CREATE TABLE lookup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sync_state (region TEXT PRIMARY KEY, cc TEXT NOT NULL, synced_at INTEGER, dirty_at INTEGER, last_ms INTEGER, last_result TEXT);
CREATE TABLE embed_pending (id TEXT PRIMARY KEY);
CREATE INDEX places_lat ON places(lat);
