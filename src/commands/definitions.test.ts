import { describe, expect, it } from 'vitest';
import { AREAS } from './actions.js';
import { allCommands } from './definitions.js';

describe('slash command', () => {
  const json = allCommands.map((c) => c.toJSON());

  it('registra un comando /cowbot-<area> per ogni area', () => {
    expect(json.map((c) => c.name)).toEqual([
      'cowbot-prova',
      'cowbot-scheda',
      'cowbot-partita',
      'cowbot-orologio',
      'cowbot-rischio',
    ]);
  });

  it('ogni area ha un campo azione con tutte le azioni e nessun altro campo obbligatorio', () => {
    for (const [area, specs] of Object.entries(AREAS)) {
      const c = json.find((x) => x.name === `cowbot-${area}`)!;
      const [azione, ...rest] = c.options ?? [];
      expect(azione?.name).toBe('azione');
      expect(azione?.required).toBe(true);
      const choices = (azione as { choices?: { value: string }[] }).choices ?? [];
      expect(choices.map((x) => x.value)).toEqual(specs.map((s) => s.id));
      expect(rest.every((o) => !o.required)).toBe(true);
    }
  });

  it('le opzioni obbligatorie di ogni azione esistono nel comando', () => {
    for (const [area, specs] of Object.entries(AREAS)) {
      const names = new Set((json.find((x) => x.name === `cowbot-${area}`)!.options ?? []).map((o) => o.name));
      for (const s of specs) for (const r of (s as { required?: string[] }).required ?? []) expect(names.has(r)).toBe(true);
    }
  });
});
