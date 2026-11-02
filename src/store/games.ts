import { TURNS, isApproach, type Approach, type TurnNumber } from '../engine/rules.js';
import { isSessionType, type SessionType, type TurnEffects } from '../engine/session.js';
import type { DB } from './db.js';

/** Stato della partita in un canale Discord. */
export interface Game {
  channelId: string;
  sessionType: SessionType | null;
  title: string;
  /** Utente Discord che fa da Big Shot: solo lui spende shock e Rischio. Null = chiunque. */
  bigShotId: string | null;
  turn: TurnNumber;
  difficulty: number;
  genre: Approach | null;
  minShock: number;
  rischio: number;
  /** La svolta è un inseguimento (p. 36). */
  chase: boolean;
  /** Orologio minaccia Jazz: la Difficoltà non si può ridurre (p. 25). */
  difficultyLocked: boolean;
  /** Orologio minaccia Blues: mostrare le ferite ne rimuove una sola (p. 25). */
  bluesLimit: boolean;
  /** Prove tirate nella svolta: il Rischio sulla Difficoltà si spende solo a inizio svolta. */
  provasInTurn: number;
  /** Effetti di orologi minaccia chiusi, da applicare alla prossima svolta. */
  nextTurnEffects: TurnEffects;
  /** Utente che tirerà la prossima Prova con Svantaggio imposto dal Rischio ('*' = chiunque). */
  disadvantageFor: string | null;
}

export interface SessionPlayer {
  userId: string;
  characterId: number;
  /** Tiro del Ritmo (Classica) o null se il Ritmo non si tira. */
  roll: number | null;
  ritmo: number;
}

interface Row {
  channel_id: string;
  session_type: string | null;
  title: string;
  big_shot_id: string | null;
  turn: number;
  difficulty: number;
  genre: string | null;
  min_shock: number;
  rischio: number;
  chase: number;
  difficulty_locked: number;
  blues_limit: number;
  provas_in_turn: number;
  next_turn_effects: string;
  disadvantage_for: string | null;
}

export function newGame(channelId: string): Game {
  return {
    channelId,
    sessionType: null,
    title: '',
    bigShotId: null,
    turn: 1,
    difficulty: TURNS[1].startDifficulty,
    genre: null,
    minShock: 1,
    rischio: 0,
    chase: false,
    difficultyLocked: false,
    bluesLimit: false,
    provasInTurn: 0,
    nextTurnEffects: {},
    disadvantageFor: null,
  };
}

/** Passa a una svolta: Difficoltà iniziale, più gli effetti delle minacce chiuse (p. 34, p. 25). */
export function enterTurn(g: Game, turn: TurnNumber): Game {
  const fx = g.nextTurnEffects;
  return {
    ...g,
    turn,
    difficulty: TURNS[turn].startDifficulty + (fx.difficultyBonus ?? 0),
    minShock: fx.minShock ?? 1,
    difficultyLocked: fx.difficultyLocked ?? false,
    bluesLimit: fx.bluesLimit ?? false,
    chase: false,
    provasInTurn: 0,
    nextTurnEffects: {},
  };
}

export class GameStore {
  constructor(private readonly db: DB) {}

  get(channelId: string): Game {
    const row = this.db.prepare('SELECT * FROM games WHERE channel_id = ?').get(channelId) as Row | undefined;
    if (!row) return newGame(channelId);
    return {
      channelId,
      sessionType: row.session_type && isSessionType(row.session_type) ? row.session_type : null,
      title: row.title,
      bigShotId: row.big_shot_id,
      turn: (row.turn === 2 || row.turn === 3 ? row.turn : 1) as TurnNumber,
      difficulty: row.difficulty,
      genre: row.genre && isApproach(row.genre) ? row.genre : null,
      minShock: row.min_shock,
      rischio: row.rischio,
      chase: row.chase === 1,
      difficultyLocked: row.difficulty_locked === 1,
      bluesLimit: row.blues_limit === 1,
      provasInTurn: row.provas_in_turn,
      nextTurnEffects: JSON.parse(row.next_turn_effects) as TurnEffects,
      disadvantageFor: row.disadvantage_for,
    };
  }

  save(g: Game): Game {
    this.db
      .prepare(
        `INSERT INTO games (channel_id, session_type, title, big_shot_id, turn, difficulty, genre, min_shock, rischio,
           chase, difficulty_locked, blues_limit, provas_in_turn, next_turn_effects, disadvantage_for, updated_at)
         VALUES (@channelId, @sessionType, @title, @bigShotId, @turn, @difficulty, @genre, @minShock, @rischio,
           @chase, @difficultyLocked, @bluesLimit, @provasInTurn, @nextTurnEffects, @disadvantageFor, datetime('now'))
         ON CONFLICT (channel_id) DO UPDATE SET session_type = excluded.session_type, title = excluded.title,
           big_shot_id = excluded.big_shot_id, turn = excluded.turn, difficulty = excluded.difficulty,
           genre = excluded.genre, min_shock = excluded.min_shock, rischio = excluded.rischio, chase = excluded.chase,
           difficulty_locked = excluded.difficulty_locked, blues_limit = excluded.blues_limit,
           provas_in_turn = excluded.provas_in_turn, next_turn_effects = excluded.next_turn_effects,
           disadvantage_for = excluded.disadvantage_for, updated_at = excluded.updated_at`,
      )
      .run({
        ...g,
        difficulty: Math.max(0, g.difficulty),
        rischio: Math.max(0, g.rischio),
        chase: g.chase ? 1 : 0,
        difficultyLocked: g.difficultyLocked ? 1 : 0,
        bluesLimit: g.bluesLimit ? 1 : 0,
        nextTurnEffects: JSON.stringify(g.nextTurnEffects),
      });
    return g;
  }

  setTurn(channelId: string, turn: TurnNumber): Game {
    return this.save(enterTurn(this.get(channelId), turn));
  }

  // --- Giocatori della Session ---

  players(channelId: string): SessionPlayer[] {
    const rows = this.db
      .prepare('SELECT user_id, character_id, roll, ritmo FROM session_players WHERE channel_id = ? ORDER BY joined_at')
      .all(channelId) as { user_id: string; character_id: number; roll: number | null; ritmo: number }[];
    return rows.map((r) => ({ userId: r.user_id, characterId: r.character_id, roll: r.roll, ritmo: r.ritmo }));
  }

  setPlayer(channelId: string, p: SessionPlayer): void {
    this.db
      .prepare(
        `INSERT INTO session_players (channel_id, user_id, character_id, roll, ritmo) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (channel_id, user_id) DO UPDATE SET character_id = excluded.character_id, roll = excluded.roll,
         ritmo = excluded.ritmo`,
      )
      .run(channelId, p.userId, p.characterId, p.roll, p.ritmo);
  }

  clearPlayers(channelId: string): void {
    this.db.prepare('DELETE FROM session_players WHERE channel_id = ?').run(channelId);
  }
}
