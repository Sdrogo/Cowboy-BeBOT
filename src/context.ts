import type { ProvaResult } from './engine/prova.js';
import { CharacterStore } from './store/characters.js';
import { ClockStore } from './store/clocks.js';
import type { DB } from './store/db.js';
import { GameStore } from './store/games.js';

/** Prova in attesa di conferma: vive in memoria finché il giocatore non la conferma. */
export interface PendingProva {
  id: string;
  userId: string;
  characterId: number;
  characterName: string;
  channelId: string;
  result: ProvaResult;
  /** Etichette mostrate sulla card (inseguimento, Svantaggio dal Rischio...). */
  tags: string[];
  /** Il giocatore sta scegliendo quale tratto ferire. */
  choosingWound: boolean;
  /** 'tiro': Riff e assorbimento; 'spesa': successi e shock da spendere. */
  phase: 'tiro' | 'spesa';
  spend: SpendState;
  createdAt: number;
}

export interface SpendState {
  successes: number;
  shocks: number;
  log: string[];
  /** Rischio speso per +2 shock: in questa Prova lo shock non diventa Rischio (p. 35). */
  noConvert: boolean;
  converted: number;
}

/** Una Prova resta modificabile per 3 ore: copre una Session intera. */
const PENDING_TTL_MS = 3 * 60 * 60 * 1000;

export class PendingStore {
  private readonly items = new Map<string, PendingProva>();
  private counter = 0;

  add(p: Omit<PendingProva, 'id' | 'createdAt' | 'choosingWound' | 'phase' | 'spend'>): PendingProva {
    this.sweep();
    const id = `${Date.now().toString(36)}${(this.counter++).toString(36)}`;
    const item: PendingProva = {
      ...p,
      id,
      choosingWound: false,
      phase: 'tiro',
      spend: { successes: 0, shocks: 0, log: [], noConvert: false, converted: 0 },
      createdAt: Date.now(),
    };
    this.items.set(id, item);
    return item;
  }

  get(id: string): PendingProva | undefined {
    const p = this.items.get(id);
    if (p && Date.now() - p.createdAt > PENDING_TTL_MS) {
      this.items.delete(id);
      return undefined;
    }
    return p;
  }

  delete(id: string): void {
    this.items.delete(id);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, p] of this.items) if (now - p.createdAt > PENDING_TTL_MS) this.items.delete(id);
  }
}

export interface Context {
  characters: CharacterStore;
  games: GameStore;
  clocks: ClockStore;
  pending: PendingStore;
}

export function createContext(db: DB): Context {
  return {
    characters: new CharacterStore(db),
    games: new GameStore(db),
    clocks: new ClockStore(db),
    pending: new PendingStore(),
  };
}
