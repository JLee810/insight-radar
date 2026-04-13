import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

/**
 * Initialize the SQLite database using better-sqlite3.
 * Works on Railway (Linux) and locally. Uses /tmp in production.
 * @returns {Database}
 */
export function initDatabase() {
  const dbPath = process.env.DB_PATH ||
    (process.env.NODE_ENV === 'production'
      ? '/data/insight-radar.db'
      : join(__dirname, 'insight-radar.db'));

  // Create directory if it doesn't exist (needed for mounted volumes)
  const dbDir = dirname(dbPath);
  mkdirSync(dbDir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Safe migrations — add new columns without breaking existing tables
  try { db.exec('ALTER TABLE articles ADD COLUMN bias_data TEXT'); } catch { /* already exists */ }

  console.log(`Database initialized at ${dbPath}`);
  return db;
}

/**
 * Get the database instance. Must call initDatabase() first.
 * @returns {Database}
 */
export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}
