import { TURNS, isApproach, type Approach, type TurnNumber } from '../engine/rules.js';
import type { DB } from './db.js';

/** Stato della partita in un canale Discord. */
export interface Game {
  channelId: string;
  turn: TurnNumber;
  difficulty: number;
  genre: Approach | null;
  minShock: number;
}

interface Row {
  channel_id: string;
  turn: number;
  difficulty: number;
  genre: string | null;
  min_shock: number;
}

export class GameStore {
  constructor(private readonly db: DB) {}

  get(channelId: string): Game {
    const row = this.db.prepare('SELECT * FROM games WHERE channel_id = ?').get(channelId) as Row | undefined;
    if (!row) return { channelId, turn: 1, difficulty: TURNS[1].startDifficulty, genre: null, minShock: 1 };
    return {
      channelId,
      turn: (row.turn === 2 || row.turn === 3 ? row.turn : 1) as TurnNumber,
      difficulty: row.difficulty,
      genre: row.genre && isApproach(row.genre) ? row.genre : null,
      minShock: row.min_shock,
    };
  }

  save(g: Game): Game {
    this.db
      .prepare(
        `INSERT INTO games (channel_id, turn, difficulty, genre, min_shock, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (channel_id) DO UPDATE SET turn = excluded.turn, difficulty = excluded.difficulty,
         genre = excluded.genre, min_shock = excluded.min_shock, updated_at = excluded.updated_at`,
      )
      .run(g.channelId, g.turn, Math.max(0, g.difficulty), g.genre, g.minShock);
    return g;
  }

  /** Passa a una svolta: la Difficoltà torna a quella iniziale (p. 34). */
  setTurn(channelId: string, turn: TurnNumber): Game {
    return this.save({ ...this.get(channelId), turn, difficulty: TURNS[turn].startDifficulty, minShock: 1 });
  }
}
