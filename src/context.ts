import type { ProvaResult } from './engine/prova.js';
import { CharacterStore } from './store/characters.js';
import type { DB } from './store/db.js';
import { GameStore } from './store/games.js';

/** Prova in attesa di conferma: vive in memoria finché il giocatore non la conferma. */
export interface PendingProva {
  id: string;
  userId: string;
  characterId: number;
  characterName: string;
  result: ProvaResult;
  /** Il giocatore sta scegliendo quale tratto ferire. */
  choosingWound: boolean;
  createdAt: number;
}

const PENDING_TTL_MS = 60 * 60 * 1000;

export class PendingStore {
  private readonly items = new Map<string, PendingProva>();
  private counter = 0;

  add(p: Omit<PendingProva, 'id' | 'createdAt' | 'choosingWound'>): PendingProva {
    this.sweep();
    const id = `${Date.now().toString(36)}${(this.counter++).toString(36)}`;
    const item = { ...p, id, choosingWound: false, createdAt: Date.now() };
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
  pending: PendingStore;
}

export function createContext(db: DB): Context {
  return { characters: new CharacterStore(db), games: new GameStore(db), pending: new PendingStore() };
}
