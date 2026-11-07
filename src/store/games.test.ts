import { describe, expect, it } from 'vitest';
import { ClockStore } from './clocks.js';
import { openDatabase } from './db.js';
import { GameStore, enterTurn, newGame } from './games.js';
import { SheetError } from './characters.js';

describe('partita', () => {
  it('la nuova svolta applica gli effetti delle minacce chiuse e li consuma', () => {
    const g = { ...newGame('c'), chase: true, provasInTurn: 3, nextTurnEffects: { difficultyBonus: 3, difficultyLocked: true, minShock: 2 } };
    const next = enterTurn(g, 2);
    expect(next).toMatchObject({ turn: 2, difficulty: 13, difficultyLocked: true, minShock: 2, chase: false, provasInTurn: 0, nextTurnEffects: {} });
    expect(enterTurn(next, 3)).toMatchObject({ difficulty: 15, difficultyLocked: false, minShock: 1 });
  });

  it('salva e rilegge lo stato e i CT della Session', () => {
    const s = new GameStore(openDatabase(':memory:'));
    s.save({ ...newGame('c'), sessionType: 'filler', bigShotId: 'bs', rischio: 4, disadvantageFor: '*', nextTurnEffects: { minShock: 2 } });
    expect(s.get('c')).toMatchObject({ sessionType: 'filler', bigShotId: 'bs', rischio: 4, disadvantageFor: '*', nextTurnEffects: { minShock: 2 } });
    s.setPlayer('c', { userId: 'u1', characterId: 1, roll: 3, ritmo: 3 });
    s.setPlayer('c', { userId: 'u1', characterId: 1, roll: 3, ritmo: 4 });
    expect(s.players('c')).toEqual([{ userId: 'u1', characterId: 1, roll: 3, ritmo: 4 }]);
  });
});

describe('orologi del canale', () => {
  it('si segnano fino a chiudersi e non si duplicano', () => {
    const s = new ClockStore(openDatabase(':memory:'));
    let clock = s.create('c', { name: 'Fuga', size: 4, approach: 'Dance', kind: 'obiettivo' });
    expect(() => s.create('c', { name: 'fuga', size: 6, approach: 'Rock', kind: 'minaccia' })).toThrow(SheetError);
    for (let k = 0; k < 3; k++) clock = s.mark(clock, { by: 'shock' }).clock;
    expect(() => s.mark(clock, { by: 'successo', approach: 'Rock' })).toThrow(SheetError);
    const out = s.mark(clock, { by: 'successo', approach: 'Dance' });
    expect(out.closed).toBe(true);
    expect(s.list('c', false)).toEqual([]);
    expect(s.byName('c', 'FUGA')?.closed).toBe(true);
  });
});
