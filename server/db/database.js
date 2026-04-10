import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

/**
 * Initialize the SQLite database, creating tables if they don't exist.
 * Uses Node.js built-in node:sqlite (Node 22+) — no native compilation needed.
 * @returns {DatabaseSync}
 */
export function initDatabase() {
  // On Railway (and other cloud hosts), use /tmp for writable storage.
  // Fall back to local server/db/ directory in development.
  const dbPath = process.env.DB_PATH ||
    (process.env.NODE_ENV === 'production'
      ? '/tmp/insight-radar.db'
      : join(__dirname, 'insight-radar.db'));
  db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  console.log(`Database initialized at ${dbPath}`);
  return db;
}

/**
 * Get the database instance. Must call initDatabase() first.
 * @returns {DatabaseSync}
 */
export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}
