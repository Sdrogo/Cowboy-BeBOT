import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { isApproach } from '../engine/rules.js';
import { CLOCK_KINDS, threatOutcome, type Clock, type ClockKind, type MarkSource } from '../engine/session.js';
import type { Context } from '../context.js';
import type { Args, Interactive } from './args.js';
import { renderClocksCard, type ClocksCardData } from '../render/clocksCard.js';
import { renderClockClosedCard, type ClockClosedData } from '../render/clockClosedCard.js';
import { SheetError } from '../store/characters.js';

export interface MarkResult {
  clock: Clock;
  closed: boolean;
  /** Righe da mostrare al tavolo (chiusura, fine svolta, effetti). */
  lines: string[];
  /** Nota in fondo alla card degli orologi. */
  note: string | null;
  /** Dati della card di chiusura, se l'orologio si è chiuso. */
  closure: ClockClosedData | null;
}

/**
 * Segna un orologio e applica le conseguenze della chiusura:
 * obiettivo → svolta positiva; minaccia → svolta negativa ed effetti (p. 24-25).
 */
export function markClock(ctx: Context, channelId: string, clock: Clock, source: MarkSource): MarkResult {
  const { clock: next, closed } = ctx.clocks.mark(clock, source);
  const lines: string[] = [];
  let note: string | null = null;
  let closure: ClockClosedData | null = null;
  if (closed) {
    switch (next.kind) {
      case 'obiettivo':
        note = `«${next.name}» chiuso: la svolta termina in positivo.`;
        lines.push(`**${note}** Il Big Shot può assegnare un Tratto Session.`);
        closure = {
          clock: next,
          headline: 'Obiettivo raggiunto',
          verdict: 'La svolta termina in positivo',
          detail: 'Il Big Shot può assegnare un Tratto Session.',
        };
        break;
      case 'minaccia': {
        const outcome = threatOutcome(next.approach);
        const game = ctx.games.get(channelId);
        ctx.games.save({ ...game, nextTurnEffects: { ...game.nextTurnEffects, ...outcome.effects } });
        note = `«${next.name}» chiuso: la svolta termina in negativo. ${outcome.text.replace(/\*/g, '')}`;
        lines.push(`**«${next.name}» chiuso: la svolta termina in negativo.** ${outcome.text}`);
        closure = {
          clock: next,
          headline: 'Minaccia scatenata',
          verdict: 'La svolta termina in negativo',
          detail: outcome.text.replace(/\*/g, ''),
        };
        break;
      }
      case 'inseguimento':
        note = `«${next.name}» chiuso: l'inseguimento finisce.`;
        lines.push(`**${note}** La svolta termina, di solito in positivo.`);
        closure = { clock: next, headline: 'Inseguimento concluso', verdict: 'La svolta termina, di solito in positivo', detail: '' };
        break;
      default:
        note = `«${next.name}» chiuso: l'evento accade.`;
        lines.push(`**${note}**`);
        closure = { clock: next, headline: 'Orologio chiuso', verdict: "L'evento accade", detail: '' };
    }
  }
  return { clock: next, closed, lines, note, closure };
}

export function clocksCardData(ctx: Context, channelId: string, highlightId: number | null, note: string | null): ClocksCardData {
  // Anche gli orologi chiusi restano in lista (segnati CHIUSO) fino alla fine della Session.
  const clocks = ctx.clocks.list(channelId);
  return { title: 'Orologi', subtitle: 'In questo canale', clocks, highlightId, note };
}

/** Testo alternativo di una card degli orologi. */
export function clocksAlt(d: ClocksCardData): string {
  return d.clocks.map((c) => `${c.name}: ${c.marks} su ${c.size}${c.closed ? ', chiuso' : ''}`).join('; ') || 'Nessun orologio';
}

/** Card di chiusura di un orologio, da mostrare a tutto il tavolo. */
export async function closureAttachment(c: ClockClosedData) {
  return new AttachmentBuilder(await renderClockClosedCard(c), {
    name: 'orologio-chiuso.png',
    description: `${c.headline}: «${c.clock.name}». ${c.verdict}. ${c.detail}`.trim(),
  });
}

export async function clocksAttachment(ctx: Context, channelId: string, highlightId: number | null, note: string | null) {
  const data = clocksCardData(ctx, channelId, highlightId, note);
  return new AttachmentBuilder(await renderClocksCard(data), { name: 'orologi.png', description: clocksAlt(data) });
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
        for (let k = 0; k < times && !(result?.closed ?? false); k++) {
          result = markClock(ctx, channelId, result?.clock ?? clock, { by: 'manuale' });
        }
        await i.reply({
          content: `Segnato **${clock.name}**.`,
          files: [await clocksAttachment(ctx, channelId, clock.id, null)],
        });
        // La chiusura è un momento: una card a parte, per tutto il tavolo.
        if (result?.closure) await i.followUp({ files: [await closureAttachment(result.closure)] });
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
