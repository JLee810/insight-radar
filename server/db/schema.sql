CREATE TABLE IF NOT EXISTS websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  check_interval INTEGER DEFAULT 3600,
  last_checked DATETIME,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  weight REAL DEFAULT 1.0,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER REFERENCES websites(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  relevance_score REAL DEFAULT 0,
  ai_tags TEXT,
  ai_insights TEXT,
  is_read BOOLEAN DEFAULT 0,
  is_bookmarked BOOLEAN DEFAULT 0,
  published_at DATETIME,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracking_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER REFERENCES websites(id),
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  articles_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_website_id ON articles(website_id);
CREATE INDEX IF NOT EXISTS idx_articles_relevance ON articles(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_discovered ON articles(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_log_website ON tracking_log(website_id);
