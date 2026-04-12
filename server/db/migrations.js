/**
 * Database migrations — run once at startup after initDatabase().
 * Each migration is idempotent (IF NOT EXISTS / IF NOT EXISTS column).
 * New migrations go at the bottom of the `migrations` array.
 */
import { getDb } from './database.js';

const migrations = [
  {
    id: 1,
    name: 'community_tables',
    sql: `
      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT  NOT NULL,
        role        TEXT    NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
        is_banned   BOOLEAN NOT NULL DEFAULT 0,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

      -- Votes: each user can vote once per article
      CREATE TABLE IF NOT EXISTS votes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, article_id)
      );
      CREATE INDEX IF NOT EXISTS idx_votes_article ON votes(article_id);

      -- Debate threads: one per article, opened when vote threshold reached
      CREATE TABLE IF NOT EXISTS debate_threads (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id  INTEGER NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
        vote_count  INTEGER NOT NULL DEFAULT 0,
        status      TEXT    NOT NULL DEFAULT 'voting',  -- 'voting' | 'open' | 'closed'
        opened_at   DATETIME,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_threads_article ON debate_threads(article_id);
      CREATE INDEX IF NOT EXISTS idx_threads_status  ON debate_threads(status);

      -- Comments on debate threads
      CREATE TABLE IF NOT EXISTS comments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id   INTEGER NOT NULL REFERENCES debate_threads(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL DEFAULT 'argument',  -- 'argument'|'counter'|'evidence'|'question'
        body        TEXT    NOT NULL,
        is_reported BOOLEAN NOT NULL DEFAULT 0,
        is_deleted  BOOLEAN NOT NULL DEFAULT 0,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

      -- Refresh tokens for JWT rotation
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT    NOT NULL UNIQUE,
        expires_at  DATETIME NOT NULL,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

      -- Migration log
      CREATE TABLE IF NOT EXISTS _migrations (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: 2,
    name: 'article_website_name',
    sql: `
      -- Add website_name to articles if missing (denormalized for performance)
      -- SQLite doesn't support IF NOT EXISTS for columns, so we use a no-op approach
      CREATE TABLE IF NOT EXISTS _dummy_migration2 (x INTEGER);
      DROP TABLE IF EXISTS _dummy_migration2;
    `,
  },
  {
    id: 4,
    name: 'opinions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS opinions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title      TEXT    NOT NULL,
        body       TEXT    NOT NULL,
        tags       TEXT    NOT NULL DEFAULT '[]',
        status     TEXT    NOT NULL DEFAULT 'published',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_opinions_user   ON opinions(user_id);
      CREATE INDEX IF NOT EXISTS idx_opinions_status ON opinions(status);
    `,
  },
  {
    id: 3,
    name: 'bias_data_column',
    sql: `
      -- Add bias_data JSON column to articles for cached bias analysis
      CREATE TABLE IF NOT EXISTS _dummy_migration3 (x INTEGER);
      DROP TABLE IF EXISTS _dummy_migration3;
    `,
  },
  {
    id: 5,
    name: 'per_user_interests_websites',
    sql: `
      -- Add user_id to interests (existing rows keep NULL = global/admin defaults)
      CREATE TABLE IF NOT EXISTS _dummy_migration5 (x INTEGER);
      DROP TABLE IF EXISTS _dummy_migration5;
    `,
  },
  {
    id: 6,
    name: 'comment_likes_notifications',
    sql: `
      -- Comment likes
      CREATE TABLE IF NOT EXISTS comment_likes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, comment_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       TEXT    NOT NULL,  -- 'reply' | 'debate_open' | 'like'
        data       TEXT    NOT NULL DEFAULT '{}',
        is_read    BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
    `,
  },
  {
    id: 7,
    name: 'data_consent',
    sql: `
      CREATE TABLE IF NOT EXISTS _dummy_migration7 (x INTEGER);
      DROP TABLE IF EXISTS _dummy_migration7;
    `,
  },
];

/**
 * Run all pending migrations.
 * @returns {{ applied: string[], skipped: string[] }}
 */
export function runMigrations() {
  const db = getDb();

  // Ensure migration log table exists
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  const applied = [];
  const skipped = [];

  for (const migration of migrations) {
    const already = db.prepare('SELECT id FROM _migrations WHERE id = ?').get(migration.id);
    if (already) {
      skipped.push(migration.name);
      continue;
    }

    db.exec(migration.sql);
    db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
    applied.push(migration.name);
    console.log(`[migrations] Applied: ${migration.name}`);
  }

  if (applied.length === 0) {
    console.log('[migrations] All up to date.');
  }

  return { applied, skipped };
}
