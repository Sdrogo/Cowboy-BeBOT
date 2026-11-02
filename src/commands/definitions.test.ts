import { describe, expect, it } from 'vitest';
import { allCommands } from './definitions.js';

describe('slash command', () => {
  it('registra un solo comando /cowbot con tutte le aree', () => {
    expect(allCommands).toHaveLength(1);
    const json = allCommands[0]!.toJSON();
    expect(json.name).toBe('cowbot');
    expect(json.options?.map((o) => o.name)).toEqual(['prova', 'scheda', 'partita', 'orologio', 'rischio']);
  });
});
