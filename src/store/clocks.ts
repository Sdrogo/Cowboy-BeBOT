import { isApproach, type Approach } from '../engine/rules.js';
import { checkMark, type Clock, type ClockKind, type MarkSource } from '../engine/session.js';
import type { DB } from './db.js';
import { SheetError } from './characters.js';

interface Row {
  id: number;
  channel_id: string;
  name: string;
  size: number;
  approach: string;
  kind: string;
  marks: number;
  closed: number;
}

const fromRow = (r: Row): Clock => ({
  id: r.id,
  channelId: r.channel_id,
  name: r.name,
  size: r.size,
  approach: (isApproach(r.approach) ? r.approach : 'Rock') as Approach,
  kind: r.kind as ClockKind,
  marks: r.marks,
  closed: r.closed === 1,
});

export interface MarkOutcome {
  clock: Clock;
  closed: boolean;
}

export class ClockStore {
  constructor(private readonly db: DB) {}

  /** Orologi del canale: prima quelli aperti, poi i chiusi. */
  list(channelId: string, includeClosed = true): Clock[] {
    const rows = this.db
      .prepare(`SELECT * FROM clocks WHERE channel_id = ? ${includeClosed ? '' : 'AND closed = 0'} ORDER BY closed, id`)
      .all(channelId) as Row[];
    return rows.map(fromRow);
  }

  byId(id: number): Clock | null {
    const row = this.db.prepare('SELECT * FROM clocks WHERE id = ?').get(id) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  byName(channelId: string, name: string): Clock | null {
    const row = this.db
      .prepare('SELECT * FROM clocks WHERE channel_id = ? AND name = ? COLLATE NOCASE ORDER BY closed, id DESC LIMIT 1')
      .get(channelId, name.trim()) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  create(channelId: string, c: Pick<Clock, 'name' | 'size' | 'approach' | 'kind'>): Clock {
    const name = c.name.trim();
    if (!name) throw new SheetError("L'orologio ha bisogno di un nome.");
    const open = this.byName(channelId, name);
    if (open && !open.closed) throw new SheetError(`C'è già un orologio aperto chiamato «${name}».`);
    const info = this.db
      .prepare('INSERT INTO clocks (channel_id, name, size, approach, kind) VALUES (?, ?, ?, ?, ?)')
      .run(channelId, name, c.size, c.approach, c.kind);
    return this.byId(Number(info.lastInsertRowid))!;
  }

  /** Segna una sezione. I segni non si cancellano mai (p. 24). */
  mark(clock: Clock, source: MarkSource): MarkOutcome {
    const check = checkMark(clock, source);
    if (!check.ok) throw new SheetError(check.reason);
    const marks = clock.marks + 1;
    this.db.prepare('UPDATE clocks SET marks = ?, closed = ? WHERE id = ?').run(marks, check.closes ? 1 : 0, clock.id);
    return { clock: { ...clock, marks, closed: check.closes }, closed: check.closes };
  }

  delete(clock: Clock): void {
    this.db.prepare('DELETE FROM clocks WHERE id = ?').run(clock.id);
  }

  /** A fine Session gli orologi non chiusi non accadono: si puliscono. */
  clear(channelId: string): void {
    this.db.prepare('DELETE FROM clocks WHERE channel_id = ?').run(channelId);
  }
}
