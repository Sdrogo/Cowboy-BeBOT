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

CREATE TABLE IF NOT EXISTS session_players (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  character_id INTEGER NOT NULL,
  roll INTEGER,
  ritmo INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS clocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  approach TEXT NOT NULL,
  kind TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS clocks_channel ON clocks (channel_id);
`;

/** Colonne aggiunte dopo la prima versione: si aggiungono ai database esistenti. */
const GAME_COLUMNS: Record<string, string> = {
  session_type: 'TEXT',
  title: "TEXT NOT NULL DEFAULT ''",
  big_shot_id: 'TEXT',
  rischio: 'INTEGER NOT NULL DEFAULT 0',
  chase: 'INTEGER NOT NULL DEFAULT 0',
  difficulty_locked: 'INTEGER NOT NULL DEFAULT 0',
  blues_limit: 'INTEGER NOT NULL DEFAULT 0',
  provas_in_turn: 'INTEGER NOT NULL DEFAULT 0',
  next_turn_effects: "TEXT NOT NULL DEFAULT '{}'",
  disadvantage_for: 'TEXT',
};

function migrate(db: Database.Database): void {
  const existing = new Set((db.prepare('PRAGMA table_info(games)').all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of Object.entries(GAME_COLUMNS)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE games ADD COLUMN ${name} ${type}`);
  }
}

export function openDatabase(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
