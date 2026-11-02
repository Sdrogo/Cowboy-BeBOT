import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  concept TEXT NOT NULL DEFAULT '',
  groove TEXT,
  memory TEXT NOT NULL DEFAULT '',
  cartridges INTEGER NOT NULL DEFAULT 0,
  ritmo INTEGER NOT NULL DEFAULT 0,
  traits TEXT NOT NULL DEFAULT '[]',
  burdens TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS characters_user ON characters (user_id);

CREATE TABLE IF NOT EXISTS games (
  channel_id TEXT PRIMARY KEY,
  turn INTEGER NOT NULL DEFAULT 1,
  difficulty INTEGER NOT NULL DEFAULT 5,
  genre TEXT,
  min_shock INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDatabase(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
