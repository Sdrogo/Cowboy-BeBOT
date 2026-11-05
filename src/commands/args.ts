import type { ChatInputCommandInteraction, ModalSubmitInteraction, User } from 'discord.js';

/** Chi può rispondere a un'azione: lo slash command stesso o il form che lo completa. */
export type Interactive = (ChatInputCommandInteraction | ModalSubmitInteraction) & { channelId: string };

export type ArgValue = string | number | boolean | User;

/** I valori scelti nel form di un'azione. */
export class Args {
  constructor(private readonly values: Record<string, ArgValue | undefined> = {}) {}

  has(name: string): boolean {
    return this.values[name] !== undefined;
  }
  str(name: string): string | null {
    const v = this.values[name];
    return typeof v === 'string' ? v : null;
  }
  int(name: string): number | null {
    const v = this.values[name];
    return typeof v === 'number' ? v : null;
  }
  bool(name: string): boolean | null {
    const v = this.values[name];
    return typeof v === 'boolean' ? v : null;
  }
  user(name: string): User | null {
    const v = this.values[name];
    return typeof v === 'object' ? v : null;
  }
  reqStr(name: string): string {
    const v = this.str(name);
    if (v === null) throw new Error(`Manca «${name}»`);
    return v;
  }
  reqInt(name: string): number {
    const v = this.int(name);
    if (v === null) throw new Error(`Manca «${name}»`);
    return v;
  }
}
