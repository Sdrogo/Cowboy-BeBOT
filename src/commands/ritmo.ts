import type { Context } from '../context.js';
import { setRitmo, type Character } from '../store/characters.js';

/**
 * Spende Ritmo dal personaggio e dal tavolo della Session: il Ritmo vive sulla
 * scheda e, durante una Session, anche nella riga del giocatore.
 */
export function spendRitmo(ctx: Context, channelId: string, c: Character, n: number): Character {
  const next = ctx.characters.save(setRitmo(c, c.ritmo - n));
  const me = ctx.games.players(channelId).find((p) => p.characterId === c.id);
  if (me) ctx.games.setPlayer(channelId, { ...me, ritmo: next.ritmo });
  return next;
}
