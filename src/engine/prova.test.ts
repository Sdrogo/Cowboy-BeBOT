import { describe, expect, it } from 'vitest';
import {
  absorb,
  addPlanned,
  boostDie,
  canBoost,
  canRetry,
  decideRetry,
  retryDie,
  retryPending,
  canAddPlanned,
  canSetAside,
  setAside,
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

describe('Ritmo al posto delle Cartucce', () => {
  it('le Cartucce pagate con Ritmo danno gli stessi dadi ma con un\'altra etichetta', () => {
    const pool = buildPool(base({ cartridges: 2, ritmoInstead: true }));
    expect(pool.find((p) => p.label === 'da 2 Ritmo')?.dice).toBe(4);
    expect(buildPool(base({ cartridges: 1, ritmoInstead: true })).some((p) => p.label === 'Ritmo')).toBe(true);
  });

  it('il Ritmo assorbe uno shock al posto della Cartuccia, una volta sola', () => {
    const r = evaluate(base(), kept(1, 1, 3), { absorbed: [] });
    const a = absorb(r, { kind: 'cartuccia', ritmo: true });
    expect(a.absorbed).toEqual([{ kind: 'cartuccia', ritmo: true }]);
    expect(canAbsorb(a, 'cartuccia')).toBe(false);
  });
});

describe('Piani a Lungo Termine', () => {
  it('il dado messo da parte non conta più nel tiro e si può mettere da parte una volta sola', () => {
    const r = evaluate(base({ difficulty: 10 }), kept(6, 6, 2));
    expect(r.sum).toBe(14);
    expect(r.doubleSix).toBe(true);
    const out = setAside(r, 0)!;
    expect(out.value).toBe(6);
    expect(out.result.sum).toBe(8);
    expect(out.result.doubleSix).toBe(false);
    expect(out.result.dice[0]).toMatchObject({ kept: false, aside: true });
    expect(canSetAside(out.result)).toBe(false);
    expect(setAside(out.result, 1)).toBeNull();
  });

  it('non si mette da parte dopo aver assorbito o spinto', () => {
    const r = evaluate(base(), kept(1, 3, 4));
    expect(canSetAside(absorb(r, { kind: 'cartuccia' }))).toBe(false);
    expect(canSetAside(push(r))).toBe(false);
  });

  it('il dado conservato si aggiunge con lo stesso valore, una volta per Prova', () => {
    const r = evaluate(base({ difficulty: 10 }), kept(6, 1, 2));
    const out = addPlanned(r, 6);
    expect(out.sum).toBe(15);
    expect(out.doubleSix).toBe(true);
    expect(out.dice.at(-1)).toMatchObject({ value: 6, kept: true, fromPlan: true });
    expect(canAddPlanned(out)).toBe(false);
    expect(addPlanned(out, 5).dice).toHaveLength(4);
  });

  it('un dado conservato che vale 1 aggiunge anche lo shock', () => {
    const r = evaluate(base(), kept(3, 4));
    expect(addPlanned(r, 1).shocks).toBe(1);
    expect(r.shocks).toBe(1);
    expect(addPlanned(evaluate(base(), kept(3, 1)), 1).shocks).toBe(2);
  });
});

describe('Fuori dagli Schemi', () => {
  const fds = (over: Partial<ProvaInput> = {}) => base({ groove: 'fuori-dagli-schemi', ...over });

  it('un dado da 2-5 diventa 6 al costo di uno shock, una volta sola', () => {
    const r = evaluate(fds({ difficulty: 12 }), kept(6, 4, 3));
    expect(r.beatDifficulty).toBe(true);
    expect(r.shocks).toBe(1);
    const out = boostDie(r, 1);
    expect(out.dice[1]).toMatchObject({ value: 6, boosted: true, was: 4 });
    expect(out.doubleSix).toBe(true);
    expect(out.grooveShocks).toBe(1);
    expect(out.shocks).toBe(2);
    expect(canBoost(out)).toBe(false);
    expect(boostDie(out, 2)).toBe(out);
  });

  it('non vale su 1 e 6, senza il Groove o dopo aver assorbito', () => {
    const r = evaluate(fds(), kept(6, 1, 3));
    expect(boostDie(r, 0)).toBe(r);
    expect(boostDie(r, 1)).toBe(r);
    expect(canBoost(evaluate(base(), kept(3, 4)))).toBe(false);
    expect(canBoost(absorb(evaluate(fds(), kept(3, 4, 1)), { kind: 'cartuccia' }))).toBe(false);
  });
});

describe('Aggiustatutto', () => {
  const agg = (over: Partial<ProvaInput> = {}) => base({ groove: 'aggiustatutto', disadvantage: true, ...over });
  const withDiscard = (input: ProvaInput) => evaluate(input, [{ value: 2, kept: true }, { value: 3, kept: true }, { value: 6, kept: false }]);

  it('con Svantaggio si ritira il dado scartato e si può tenere', () => {
    const r = withDiscard(agg());
    expect(canRetry(r)).toBe(true);
    const rolled = retryDie(r, () => 0.5);
    expect(rolled.dice[2]).toMatchObject({ kept: false, retry: 4 });
    expect(rolled.sum).toBe(5);
    expect(retryPending(rolled)).toBe(true);
    expect(canRetry(rolled)).toBe(false);
    const kept4 = decideRetry(rolled, true);
    expect(kept4.sum).toBe(9);
    expect(kept4.dice[2]).toMatchObject({ kept: true, value: 4, was: 6 });
    expect(retryPending(kept4)).toBe(false);
  });

  it('si può rifiutare il nuovo dado', () => {
    const out = decideRetry(retryDie(withDiscard(agg()), () => 0.99), false);
    expect(out.sum).toBe(5);
    expect(out.dice[2]).toMatchObject({ kept: false, retry: 6, retryDecided: true });
    expect(retryPending(out)).toBe(false);
  });

  it('serve il Groove e lo Svantaggio', () => {
    expect(canRetry(withDiscard(agg({ groove: null })))).toBe(false);
    expect(canRetry(evaluate(agg({ disadvantage: false }), kept(2, 3)))).toBe(false);
  });
});
