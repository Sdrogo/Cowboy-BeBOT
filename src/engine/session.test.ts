import { describe, expect, it } from 'vitest';
import {
  checkMark,
  clearsCartridges,
  closingNotes,
  genreChosenByPlayers,
  rollTheEnd,
  startingRischio,
  startingRitmo,
  theEnd,
  threatOutcome,
  type Clock,
} from './session.js';

const pg = (cartridges: number, burdens: boolean[] = []) => ({ cartridges, burdens: burdens.map((resolved) => ({ resolved })) });

describe('inizio Session', () => {
  it('calcola il Ritmo per tipo di Session', () => {
    expect(startingRitmo('classica', pg(2), 4)).toBe(4);
    expect(startingRitmo('personale', pg(3), 6)).toBe(3);
    expect(startingRitmo('climax-2', pg(5), 1)).toBe(5);
    expect(startingRitmo('filler', pg(4, [false, true]), 1)).toBe(2 + 2);
    expect(startingRitmo('climax-1', pg(0, [false, true]), 1)).toBe(3 + 4);
  });

  it('calcola il Rischio del Big Shot', () => {
    const players = [pg(2, [false]), pg(0, [true, false])];
    expect(startingRischio('classica', players, [3, 5])).toBe(3);
    expect(startingRischio('personale', players, [3, 5])).toBe(8);
    expect(startingRischio('filler', players, [3, 5])).toBe(2);
    expect(startingRischio('filler', [pg(0)], [6])).toBe(1);
    expect(startingRischio('climax-1', players, [5, 7])).toBe(3 + 2 * 2);
  });

  it('un 6 al Ritmo nella Classica fa scegliere il Genere ai CT', () => {
    expect(genreChosenByPlayers('classica', [2, 6])).toBe(true);
    expect(genreChosenByPlayers('classica', [2, 5])).toBe(false);
    expect(genreChosenByPlayers('filler', [6])).toBe(false);
  });
});

describe('orologi', () => {
  const clock: Clock = { id: 1, channelId: 'c', name: 'Fuga', size: 4, approach: 'Dance', kind: 'obiettivo', marks: 3, closed: false };

  it("l'ultima sezione va chiusa con un successo dello stesso Approccio", () => {
    expect(checkMark(clock, { by: 'successo', approach: 'Rock' }).ok).toBe(false);
    expect(checkMark(clock, { by: 'successo', approach: 'Dance' })).toEqual({ ok: true, closes: true });
    expect(checkMark(clock, { by: 'shock' })).toEqual({ ok: true, closes: true });
    expect(checkMark({ ...clock, marks: 1 }, { by: 'successo', approach: 'Rock' })).toEqual({ ok: true, closes: false });
  });

  it('un orologio chiuso non si segna più', () => {
    expect(checkMark({ ...clock, marks: 4, closed: true }, { by: 'manuale' }).ok).toBe(false);
  });

  it('le minacce Dance e Jazz cambiano la svolta successiva', () => {
    expect(threatOutcome('Dance').effects).toEqual({ minShock: 2 });
    expect(threatOutcome('Jazz').effects).toEqual({ difficultyBonus: 3, difficultyLocked: true });
    expect(threatOutcome('Rock').effects).toEqual({});
  });
});

describe('fine Session', () => {
  it('The End: Difficoltà 10 e doppio 6 danno fino a due successi', () => {
    expect(theEnd([3, 3]).successes).toBe(0);
    expect(theEnd([4, 6]).successes).toBe(1);
    expect(theEnd([6, 6]).successes).toBe(2);
    expect(theEnd([6, 6, 1]).title).toBe('Finalmente libero');
    expect(rollTheEnd(2, () => 0).dice).toEqual([1, 1, 1]);
  });

  it('Personale e Climax 2 liberano le Cartucce', () => {
    expect(clearsCartridges('personale')).toBe(true);
    expect(clearsCartridges('climax-2')).toBe(true);
    expect(clearsCartridges('classica')).toBe(false);
  });

  it('la Classica negativa o con ultima Cartuccia chiede un Fardello', () => {
    const fardello = (n: string[]) => n.some((x) => x.includes('Fardello'));
    expect(fardello(closingNotes('classica', 'positiva', false))).toBe(false);
    expect(fardello(closingNotes('classica', 'negativa', false))).toBe(true);
    expect(fardello(closingNotes('classica', 'positiva', true))).toBe(true);
  });
});
