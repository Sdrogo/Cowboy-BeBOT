import {
  MAX_CARTRIDGES,
  MAX_RITMO,
  TRAITS_PER_SLOT,
  usableTraitSlots,
  type Approach,
  type GrooveId,
  type TraitSlot,
} from '../engine/rules.js';
import type { DB } from './db.js';

/** 0 = integro, 1 = ferito, 2 = ferito gravemente (fino a fine Session). */
export type Wound = 0 | 1 | 2;

export interface Trait {
  name: string;
  slot: TraitSlot;
  wound: Wound;
}

export interface Burden {
  title: string;
  /** X accanto al Fardello: il personaggio è venuto a patti con quel passato (p. 69). */
  resolved: boolean;
}

export interface Character {
  id: number;
  userId: string;
  name: string;
  concept: string;
  groove: GrooveId | null;
  memory: string;
  cartridges: number;
  ritmo: number;
  traits: Trait[];
  burdens: Burden[];
  active: boolean;
}

interface Row {
  id: number;
  user_id: string;
  name: string;
  concept: string;
  groove: string | null;
  memory: string;
  cartridges: number;
  ritmo: number;
  traits: string;
  burdens: string;
  active: number;
}

const fromRow = (r: Row): Character => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  concept: r.concept,
  groove: r.groove as GrooveId | null,
  memory: r.memory,
  cartridges: r.cartridges,
  ritmo: r.ritmo,
  traits: JSON.parse(r.traits) as Trait[],
  burdens: JSON.parse(r.burdens) as Burden[],
  active: r.active === 1,
});

export class SheetError extends Error {}

export interface NewCharacter {
  name: string;
  concept?: string;
  groove?: GrooveId | null;
  memory?: string;
}

export class CharacterStore {
  constructor(private readonly db: DB) {}

  list(userId: string): Character[] {
    const rows = this.db
      .prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY name COLLATE NOCASE')
      .all(userId) as Row[];
    return rows.map(fromRow);
  }

  active(userId: string): Character | null {
    const row = this.db
      .prepare('SELECT * FROM characters WHERE user_id = ? AND active = 1')
      .get(userId) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  byName(userId: string, name: string): Character | null {
    const row = this.db
      .prepare('SELECT * FROM characters WHERE user_id = ? AND name = ? COLLATE NOCASE')
      .get(userId, name.trim()) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  byId(id: number): Character | null {
    const row = this.db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  /** Crea un PG e lo rende attivo. */
  create(userId: string, data: NewCharacter): Character {
    const name = data.name.trim();
    if (!name) throw new SheetError('Il personaggio ha bisogno di un nome.');
    if (this.byName(userId, name)) throw new SheetError(`Hai già un personaggio chiamato «${name}».`);
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE characters SET active = 0 WHERE user_id = ?').run(userId);
      const info = this.db
        .prepare(
          'INSERT INTO characters (user_id, name, concept, groove, memory, active) VALUES (?, ?, ?, ?, ?, 1)',
        )
        .run(userId, name, data.concept ?? '', data.groove ?? null, data.memory ?? '');
      return Number(info.lastInsertRowid);
    });
    return this.byId(tx())!;
  }

  setActive(userId: string, name: string): Character {
    const target = this.byName(userId, name);
    if (!target) throw new SheetError(`Non hai un personaggio chiamato «${name}».`);
    this.db.transaction(() => {
      this.db.prepare('UPDATE characters SET active = 0 WHERE user_id = ?').run(userId);
      this.db.prepare('UPDATE characters SET active = 1 WHERE id = ?').run(target.id);
    })();
    return { ...target, active: true };
  }

  delete(userId: string, name: string): Character {
    const target = this.byName(userId, name);
    if (!target) throw new SheetError(`Non hai un personaggio chiamato «${name}».`);
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM characters WHERE id = ?').run(target.id);
      if (target.active) {
        this.db
          .prepare(
            'UPDATE characters SET active = 1 WHERE id = (SELECT id FROM characters WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)',
          )
          .run(userId);
      }
    })();
    return target;
  }

  save(c: Character): Character {
    this.db
      .prepare(
        `UPDATE characters SET name = ?, concept = ?, groove = ?, memory = ?, cartridges = ?, ritmo = ?,
         traits = ?, burdens = ? WHERE id = ?`,
      )
      .run(
        c.name,
        c.concept,
        c.groove,
        c.memory,
        c.cartridges,
        c.ritmo,
        JSON.stringify(c.traits),
        JSON.stringify(c.burdens),
        c.id,
      );
    return c;
  }
}

// --- Operazioni sulla scheda (pure, restituiscono una copia) ---

export function findTrait(c: Character, name: string): Trait | undefined {
  const key = name.trim().toLocaleLowerCase('it');
  return c.traits.find((t) => t.name.toLocaleLowerCase('it') === key);
}

export function addTrait(c: Character, name: string, slot: TraitSlot): Character {
  const clean = name.trim();
  if (!clean) throw new SheetError('Il tratto ha bisogno di un nome.');
  if (findTrait(c, clean)) throw new SheetError(`${c.name} ha già il tratto «${clean}».`);
  if (c.traits.filter((t) => t.slot === slot).length >= TRAITS_PER_SLOT) {
    throw new SheetError(`Gli esagoni ${slot} sono pieni (massimo ${TRAITS_PER_SLOT}).`);
  }
  return { ...c, traits: [...c.traits, { name: clean, slot, wound: 0 }] };
}

export function removeTrait(c: Character, name: string): Character {
  const t = findTrait(c, name);
  if (!t) throw new SheetError(`${c.name} non ha il tratto «${name}».`);
  return { ...c, traits: c.traits.filter((x) => x !== t) };
}

export function setWound(c: Character, name: string, wound: Wound): Character {
  const t = findTrait(c, name);
  if (!t) throw new SheetError(`${c.name} non ha il tratto «${name}».`);
  return { ...c, traits: c.traits.map((x) => (x === t ? { ...x, wound } : x)) };
}

export function setCartridges(c: Character, value: number): Character {
  return { ...c, cartridges: Math.max(0, Math.min(MAX_CARTRIDGES, value)) };
}

export function setRitmo(c: Character, value: number): Character {
  return { ...c, ritmo: Math.max(0, Math.min(MAX_RITMO, value)) };
}

export interface TraitCheck {
  ok: Trait[];
  errors: string[];
}

/**
 * Verifica quali tratti possono aggiungere dadi a una Prova:
 * stesso Approccio (o prestato dal Groove), tratti del MONO, non feriti
 * (salvo Testa Dura con Svantaggio).
 */
export function checkTraitsForProva(
  c: Character,
  names: string[],
  approach: Approach,
  disadvantage: boolean,
): TraitCheck {
  const slots = usableTraitSlots(approach, c.groove);
  const ok: Trait[] = [];
  const errors: string[] = [];
  for (const raw of names) {
    const t = findTrait(c, raw);
    if (!t) {
      errors.push(`«${raw}» non è sulla scheda di ${c.name}.`);
    } else if (ok.includes(t)) {
      errors.push(`«${t.name}» è stato scelto più volte: ogni tratto vale una sola volta per Prova.`);
    } else if (t.slot !== 'MONO' && !slots.includes(t.slot)) {
      errors.push(`«${t.name}» è un tratto ${t.slot}: non vale in una Prova ${approach}.`);
    } else if (t.wound === 2) {
      errors.push(`«${t.name}» è ferito gravemente fino a fine Session.`);
    } else if (t.wound === 1 && !(c.groove === 'testa-dura' && disadvantage)) {
      errors.push(`«${t.name}» è ferito.`);
    } else {
      ok.push(t);
    }
  }
  return { ok, errors };
}
