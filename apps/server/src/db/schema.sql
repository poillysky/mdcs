CREATE TABLE IF NOT EXISTS kinds (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL,
  source_root TEXT NOT NULL,
  library_root TEXT NOT NULL,
  organize_mode TEXT NOT NULL DEFAULT 'hardlink',
  profile_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  source_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_mtime INTEGER NOT NULL,
  code TEXT,
  cd_index INTEGER DEFAULT 1,
  mosaic TEXT NOT NULL DEFAULT '',
  group_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  target_path TEXT,
  error TEXT,
  scraped_at INTEGER,
  organized_at INTEGER,
  job_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_kind_status ON files (kind, status);
CREATE INDEX IF NOT EXISTS idx_files_code ON files (code);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files (file_mtime);
CREATE INDEX IF NOT EXISTS idx_files_status ON files (status);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kinds TEXT NOT NULL,
  mode TEXT NOT NULL,
  dry_run INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  options_json TEXT NOT NULL DEFAULT '{}',
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_updated ON jobs (updated_at);

CREATE TABLE IF NOT EXISTS scrape_cache (
  code TEXT NOT NULL,
  kind TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  scraped_at INTEGER NOT NULL,
  PRIMARY KEY (code, kind)
);

CREATE INDEX IF NOT EXISTS idx_scrape_cache_scraped ON scrape_cache (scraped_at);

CREATE TABLE IF NOT EXISTS actor_profiles (
  name TEXT PRIMARY KEY,
  mapped_name TEXT NOT NULL DEFAULT '',
  avatar_path TEXT NOT NULL DEFAULT '',
  backdrop_path TEXT NOT NULL DEFAULT '',
  overview TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',
  birthplace TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  provider_ids_json TEXT NOT NULL DEFAULT '{}',
  sources_json TEXT NOT NULL DEFAULT '{}',
  scraped_at INTEGER,
  image_scraped_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_actor_profiles_scraped ON actor_profiles (scraped_at);
