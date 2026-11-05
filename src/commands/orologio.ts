import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { isApproach } from '../engine/rules.js';
import { CLOCK_KINDS, threatOutcome, type Clock, type ClockKind, type MarkSource } from '../engine/session.js';
import type { Context } from '../context.js';
import type { Args, Interactive } from './args.js';
import { renderClocksCard } from '../render/clocksCard.js';
import { SheetError } from '../store/characters.js';

export interface MarkResult {
  clock: Clock;
  closed: boolean;
  /** Righe da mostrare al tavolo (chiusura, fine svolta, effetti). */
  lines: string[];
  /** Nota in fondo alla card degli orologi. */
  note: string | null;
}

/**
 * Segna un orologio e applica le conseguenze della chiusura:
 * obiettivo → svolta positiva; minaccia → svolta negativa ed effetti (p. 24-25).
 */
export function markClock(ctx: Context, channelId: string, clock: Clock, source: MarkSource): MarkResult {
  const { clock: next, closed } = ctx.clocks.mark(clock, source);
  const lines: string[] = [];
  let note: string | null = null;
  if (closed) {
    switch (next.kind) {
      case 'obiettivo':
        note = `«${next.name}» chiuso: la svolta termina in positivo.`;
        lines.push(`**${note}** Il Big Shot può assegnare un Tratto Session.`);
        break;
      case 'minaccia': {
        const outcome = threatOutcome(next.approach);
        const game = ctx.games.get(channelId);
        ctx.games.save({ ...game, nextTurnEffects: { ...game.nextTurnEffects, ...outcome.effects } });
        note = `«${next.name}» chiuso: la svolta termina in negativo. ${outcome.text.replace(/\*/g, '')}`;
        lines.push(`**«${next.name}» chiuso: la svolta termina in negativo.** ${outcome.text}`);
        break;
      }
      case 'inseguimento':
        note = `«${next.name}» chiuso: l'inseguimento finisce.`;
        lines.push(`**${note}** La svolta termina, di solito in positivo.`);
        break;
      default:
        note = `«${next.name}» chiuso: l'evento accade.`;
        lines.push(`**${note}**`);
    }
  }
  return { clock: next, closed, lines, note };
}

export async function clocksAttachment(ctx: Context, channelId: string, highlightId: number | null, note: string | null) {
  const clocks = ctx.clocks.list(channelId).filter((c) => !c.closed || c.id === highlightId);
  const png = await renderClocksCard({ title: 'Orologi', subtitle: 'In questo canale', clocks, highlightId, note });
  const alt = clocks.map((c) => `${c.name}: ${c.marks} su ${c.size}${c.closed ? ', chiuso' : ''}`).join('; ');
  return new AttachmentBuilder(png, { name: 'orologi.png', description: alt || 'Nessun orologio' });
}

export async function handleOrologio(i: Interactive, ctx: Context, sub: string, a: Args): Promise<void> {
  const channelId = i.channelId;
  const game = ctx.games.get(channelId);
  const isBigShot = !game.bigShotId || game.bigShotId === i.user.id;
  try {
    switch (sub) {
      case 'lista': {
        await i.reply({ files: [await clocksAttachment(ctx, channelId, null, null)] });
        return;
      }
      case 'crea': {
        if (!isBigShot) throw new SheetError('Gli orologi li crea il Big Shot: chiedi a lui di aprirlo (p. 23).');
        const approach = a.reqStr('approccio');
        const kind = a.reqStr('tipo') as ClockKind;
        if (!isApproach(approach) || !(CLOCK_KINDS as readonly string[]).includes(kind)) throw new Error('Opzioni non valide');
        const clock = ctx.clocks.create(channelId, {
          name: a.reqStr('nome'),
          size: a.reqInt('calibro'),
          approach,
          kind,
        });
        await i.reply({
          content: `Nuovo orologio **${clock.name}**: ${kind} da ${clock.size}, Approccio ${clock.approach}.`,
          files: [await clocksAttachment(ctx, channelId, clock.id, null)],
        });
        return;
      }
      case 'segna': {
        if (!isBigShot) throw new SheetError('Fuori dalle Prove solo il Big Shot segna gli orologi a mano.');
        const clock = findClock(ctx, channelId, a.reqStr('nome'));
        const times = a.int('sezioni') ?? 1;
        let result: MarkResult | null = null;
        const lines: string[] = [];
        for (let k = 0; k < times && !(result?.closed ?? false); k++) {
          result = markClock(ctx, channelId, result?.clock ?? clock, { by: 'manuale' });
          lines.push(...result.lines);
        }
        await i.reply({
          content: [`Segnato **${clock.name}**.`, ...lines].join('\n'),
          files: [await clocksAttachment(ctx, channelId, clock.id, result?.note ?? null)],
        });
        return;
      }
      case 'elimina': {
        if (!isBigShot) throw new SheetError('Solo il Big Shot elimina gli orologi.');
        const clock = findClock(ctx, channelId, a.reqStr('nome'));
        ctx.clocks.delete(clock);
        await i.reply(`Orologio **${clock.name}** eliminato.`);
        return;
      }
    }
  } catch (err) {
    if (err instanceof SheetError) {
      await i.reply({ content: err.message, flags: MessageFlags.Ephemeral });
      return;
    }
    throw err;
  }
}

function findClock(ctx: Context, channelId: string, name: string): Clock {
  const clock = ctx.clocks.byName(channelId, name);
  if (!clock) throw new SheetError(`Non c'è un orologio chiamato «${name}» in questo canale.`);
  return clock;
}
