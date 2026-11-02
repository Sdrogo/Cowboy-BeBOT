import { describe, expect, it } from 'vitest';
import {
  absorb,
  buildPool,
  canAbsorb,
  canPush,
  evaluate,
  markKept,
  poolSize,
  push,
  rollDice,
  type ProvaInput,
} from './prova.js';

const base = (over: Partial<ProvaInput> = {}): ProvaInput => ({
  turn: 2,
  difficulty: 10,
  approach: 'Dance',
  traits: [],
  genre: false,
  cartridges: 0,
  advantage: false,
  disadvantage: false,
  modifier: 0,
  minShock: 1,
  groove: null,
  ...over,
});

const kept = (...values: number[]) => values.map((value) => ({ value, kept: true }));

describe('riserva di dadi', () => {
  it('somma svolta, tratti, Genere e Cartucce', () => {
    const input = base({ turn: 3, traits: ['Glock', 'Rossetto Rosso'], genre: true, cartridges: 1 });
    expect(poolSize(buildPool(input))).toBe(3 + 2 + 1 + 2);
  });

  it('non scende sotto 1 dado e non supera il tetto', () => {
    expect(poolSize(buildPool(base({ turn: 1, modifier: -5 })))).toBe(1);
    expect(poolSize(buildPool(base({ cartridges: 6, modifier: 30 })))).toBe(20);
  });

  it('Vantaggio aggiunge un dado e scarta il più basso', () => {
    const dice = markKept([4, 2, 6], 'vantaggio');
    expect(dice.filter((d) => !d.kept).map((d) => d.value)).toEqual([2]);
  });

  it('Svantaggio scarta il più alto', () => {
    const dice = markKept([4, 2, 6], 'svantaggio');
    expect(dice.filter((d) => !d.kept).map((d) => d.value)).toEqual([6]);
  });

  it('Vantaggio e Svantaggio si annullano', () => {
    const input = base({ advantage: true, disadvantage: true });
    expect(rollDice(input, () => 0.5)).toHaveLength(2);
  });
});

describe('successi e shock', () => {
  it('esempio di p. 21: 5, 4, 2 contro 10, poi al limite e assorbimento', () => {
    const input = base({ traits: ['Steel Tear'] });
    let r = evaluate(input, kept(5, 4, 2));
    expect(r.sum).toBe(11);
    expect(r.successes).toBe(1);
    expect(r.shocks).toBe(1);
    expect(r.autoShock).toBe(1);
    expect(canPush(r)).toBe(true);

    r = push(r);
    expect(r.successes).toBe(2);
    expect(r.shocks).toBe(3);

    r = absorb(r, { kind: 'ferita', trait: 'Steel Tear' });
    r = absorb(r, { kind: 'cartuccia' });
    expect(r.successes).toBe(2);
    expect(r.shocksLeft).toBe(1);
  });

  it('esempio di p. 52 (Let\'s Jam!): 1, 1, 2, 3, 6, 6 contro 18', () => {
    const r = evaluate(base({ turn: 3, difficulty: 18 }), kept(1, 1, 2, 3, 6, 6));
    expect(r.successes).toBe(2);
    expect(r.shocks).toBe(4);
  });

  it('esempio di p. 37 (inseguimento): 1, 2, 2, 3 al limite dà 1 successo e 3 shock', () => {
    const r = push(evaluate(base({ turn: 3, difficulty: 15 }), kept(1, 2, 2, 3)));
    // In Let's Jam! l'1 vale 2 shock: 2 + 2 del limite.
    expect(r.successes).toBe(1);
    expect(r.shocks).toBe(4);
  });

  it('due 6 danno un successo anche sotto la Difficoltà', () => {
    const r = evaluate(base({ difficulty: 15 }), kept(6, 6));
    expect(r.beatDifficulty).toBe(false);
    expect(r.doubleSix).toBe(true);
    expect(r.successes).toBe(1);
  });

  it('i dadi scartati non contano', () => {
    const dice = markKept([1, 6, 6], 'svantaggio');
    const r = evaluate(base({ disadvantage: true }), dice);
    expect(r.sixes).toBe(1);
    expect(r.ones).toBe(1);
  });

  it('con due successi non ci si spinge al limite', () => {
    const r = evaluate(base(), kept(6, 6, 3));
    expect(canPush(r)).toBe(false);
    expect(push(r).successes).toBe(2);
  });

  it('shock minimo 2 con orologio minaccia Dance', () => {
    expect(evaluate(base({ minShock: 2 }), kept(4, 4)).shocks).toBe(2);
    expect(evaluate(base({ minShock: 2 }), kept(1, 4)).shocks).toBe(2);
    expect(evaluate(base({ minShock: 2 }), kept(1, 1, 1)).shocks).toBe(3);
  });

  it('Contro Ogni Previsione: coppia con Svantaggio dà un successo extra', () => {
    const input = base({ disadvantage: true, groove: 'contro-ogni-previsione' });
    const r = evaluate(input, markKept([3, 3, 6], 'svantaggio'));
    expect(r.bonuses).toHaveLength(1);
    expect(r.successes).toBe(1);
  });
});

describe('assorbire shock', () => {
  it('massimo uno per tipo e non oltre gli shock prodotti', () => {
    let r = evaluate(base({ traits: ['Glock'] }), kept(4, 4));
    expect(r.shocks).toBe(1);
    r = absorb(r, { kind: 'cartuccia' });
    expect(r.shocksLeft).toBe(0);
    expect(canAbsorb(r, 'ferita')).toBe(false);
  });

  it('senza tratti usati non si può ferire', () => {
    const r = evaluate(base(), kept(1, 1));
    expect(canAbsorb(r, 'ferita')).toBe(false);
    expect(canAbsorb(r, 'cartuccia')).toBe(true);
  });
});
