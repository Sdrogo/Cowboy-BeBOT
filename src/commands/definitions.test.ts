import { describe, expect, it } from 'vitest';
import { allCommands } from './definitions.js';

describe('slash command', () => {
  it('registra un solo comando /cowbot con prova, scheda e partita', () => {
    expect(allCommands).toHaveLength(1);
    const json = allCommands[0]!.toJSON();
    expect(json.name).toBe('cowbot');
    expect(json.options?.map((o) => o.name)).toEqual(['prova', 'scheda', 'partita']);
  });
});
