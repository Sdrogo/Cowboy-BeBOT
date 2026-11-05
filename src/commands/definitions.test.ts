import { describe, expect, it } from 'vitest';
import { createContext } from '../context.js';
import { openDatabase } from '../store/db.js';
import { AREAS, checkArgs, type ActionSpec, type AreaName } from './actions.js';
import { Args } from './args.js';
import { allCommands } from './definitions.js';
import { buildModal, formFor } from './forms.js';

const json = allCommands.map((c) => c.toJSON());

describe('slash command', () => {
  it('registra un comando /cowbot-<area> per ogni area', () => {
    expect(json.map((c) => c.name)).toEqual(['cowbot-prova', 'cowbot-scheda', 'cowbot-partita', 'cowbot-orologio', 'cowbot-rischio']);
  });

  it('ogni area ha solo il campo azione, con tutte le azioni', () => {
    for (const [area, specs] of Object.entries(AREAS)) {
      const c = json.find((x) => x.name === `cowbot-${area}`)!;
      expect(c.options?.map((o) => o.name)).toEqual(['azione']);
      const choices = (c.options?.[0] as { choices?: { value: string }[] }).choices ?? [];
      expect(choices.map((x) => x.value)).toEqual(specs.map((s) => s.id));
    }
  });
});

describe('form delle azioni', () => {
  const ctx = createContext(openDatabase(':memory:'));
  const userId = 'u1';
  const channelId = 'c1';
  ctx.characters.create(userId, { name: 'Faye', concept: '', memory: '', groove: null });
  const c = ctx.characters.active(userId)!;
  ctx.characters.save({ ...c, traits: [{ name: 'Glock', slot: 'Rock', wound: 0 }] });
  ctx.clocks.create(channelId, { name: 'Fuga', size: 4, approach: 'Dance', kind: 'obiettivo' });

  for (const [area, specs] of Object.entries(AREAS)) {
    for (const spec of specs as readonly ActionSpec[]) {
      it(`${area} ${spec.id}: campi validi e coprono le opzioni obbligatorie`, () => {
        const fields = formFor(area as AreaName, spec.id, ctx, userId, channelId);
        expect(typeof fields).toBe('object');
        if (typeof fields === 'string') return;
        expect(fields.length).toBeLessThanOrEqual(5);
        const ids = fields.map((f) => f.id);
        for (const r of spec.required ?? []) expect(ids).toContain(r);
        if (fields.length) expect(() => buildModal(area as AreaName, spec.id, spec.label, fields).toJSON()).not.toThrow();
      });
    }
  }

  it('controlla opzioni mancanti e intervalli', () => {
    expect(checkArgs(new Args({}), 'scheda', 'crea')).toContain('nome');
    expect(checkArgs(new Args({ nome: 'x' }), 'scheda', 'crea')).toBeNull();
    expect(checkArgs(new Args({ valore: 3 }), 'partita', 'shock-minimo')).toContain('da 1 a 2');
    expect(checkArgs(new Args({ valore: 7 }), 'scheda', 'ritmo')).toContain('da 0 a 6');
  });

  it("segnala quando manca un personaggio o un orologio", () => {
    expect(typeof formFor('scheda', 'usa', ctx, 'nessuno', channelId)).toBe('string');
    expect(typeof formFor('orologio', 'segna', ctx, userId, 'altro-canale')).toBe('string');
  });
});
