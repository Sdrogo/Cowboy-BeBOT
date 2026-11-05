import { describe, expect, it } from 'vitest';
import { allCommands } from './definitions.js';

describe('slash command', () => {
  it('registra un comando /cowbot-<area> per ogni area', () => {
    const json = allCommands.map((c) => c.toJSON());
    expect(json.map((c) => c.name)).toEqual([
      'cowbot-prova',
      'cowbot-scheda',
      'cowbot-partita',
      'cowbot-orologio',
      'cowbot-rischio',
    ]);
    // Le aree con azioni hanno sotto-comandi (tipo 1), non gruppi (tipo 2).
    for (const c of json.slice(1)) expect(c.options?.every((o) => o.type === 1)).toBe(true);
  });
});
