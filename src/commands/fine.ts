import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { MAX_CARTRIDGES } from '../engine/rules.js';
import {
  SESSION_LABELS,
  clearsCartridges,
  closingNotes,
  rollTheEnd,
  type SessionOutcome,
} from '../engine/session.js';
import type { Context } from '../context.js';
import type { Args, Interactive } from './args.js';
import { renderEndCard, renderTheEndCard, type EndCardPlayer } from '../render/endCard.js';
import { newGame } from '../store/games.js';

export const END_PREFIX = 'fine';
/** Un personaggio ha spazio per tre Fardelli (p. 50). */
const MAX_BURDENS = 3;

const isOutcome = (v: string | undefined): v is SessionOutcome => v === 'positiva' || v === 'negativa';

/** /cowbot-partita azione:fine: chiede conferma prima di chiudere. */
export async function askEndSession(i: Interactive, ctx: Context, a: Args): Promise<void> {
  const g = ctx.games.get(i.channelId);
  if (!g.sessionType) {
    await i.reply({ content: 'Non c\'è una Session in corso in questo canale.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (g.bigShotId && g.bigShotId !== i.user.id) {
    await i.reply({ content: 'La Session la chiude il Big Shot.', flags: MessageFlags.Ephemeral });
    return;
  }
  const outcome = a.reqStr('esito');
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${END_PREFIX}:end:${outcome}`).setLabel('Chiudi la Session').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${END_PREFIX}:cancel`).setLabel('Annulla').setStyle(ButtonStyle.Secondary),
  );
  const players = ctx.games.players(i.channelId).length;
  await i.reply({
    content:
      `Chiudere ${g.title ? `«${g.title}»` : `la ${SESSION_LABELS[g.sessionType]}`} come **${outcome}**? ` +
      `Ritmo e Rischio si azzerano, gli orologi si cancellano e le ferite gravi guariscono` +
      `${clearsCartridges(g.sessionType) ? ', le Cartucce tornano libere' : ''}. ${players} CT al tavolo.`,
    components: [row],
  });
}

export async function handleEndComponent(i: ButtonInteraction, ctx: Context): Promise<void> {
  const [, action, arg] = i.customId.split(':');
  const channelId = i.channelId;
  const g = ctx.games.get(channelId);
  const ephemeral = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral });
  const isBigShot = !g.bigShotId || g.bigShotId === i.user.id;

  switch (action) {
    case 'cancel': {
      if (!isBigShot) return void (await ephemeral('Può annullare solo il Big Shot.'));
      await i.update({ content: 'La Session continua.', components: [] });
      return;
    }
    case 'end': {
      if (!isBigShot) return void (await ephemeral('La Session la chiude il Big Shot.'));
      if (!g.sessionType || !isOutcome(arg)) return void (await i.update({ content: 'Non c\'è più una Session da chiudere.', components: [] }));
      const type = g.sessionType;
      const cleared = clearsCartridges(type);
      const players: EndCardPlayer[] = [];
      let lastCartridge = false;
      for (const p of ctx.games.players(channelId)) {
        const c = ctx.characters.byId(p.characterId);
        if (!c) continue;
        if (c.cartridges >= MAX_CARTRIDGES) lastCartridge = true;
        players.push({
          name: c.name,
          cartridges: c.cartridges,
          burdens: c.burdens.length,
          resolvedBurdens: c.burdens.filter((b) => b.resolved).length,
        });
        ctx.characters.save({
          ...c,
          ritmo: 0,
          cartridges: cleared ? 0 : c.cartridges,
          traits: c.traits.map((t) => (t.wound === 2 ? { ...t, wound: 0 } : t)),
        });
      }
      ctx.clocks.clear(channelId);
      ctx.games.clearPlayers(channelId);
      // Il titolo resta per il pulsante del Fardello; il resto della partita riparte da zero.
      ctx.games.save({ ...newGame(channelId), title: g.title });

      const png = await renderEndCard({
        type,
        title: g.title,
        outcome: arg,
        players,
        rischioLost: g.rischio,
        cartridgesCleared: cleared,
        notes: closingNotes(type, arg, lastCartridge),
      });
      const buttons: ButtonBuilder[] = [];
      if (type === 'classica' && (arg === 'negativa' || lastCartridge) && g.title) {
        buttons.push(new ButtonBuilder().setCustomId(`${END_PREFIX}:burden`).setLabel('Prendo io il Fardello').setStyle(ButtonStyle.Primary));
      }
      if (type === 'climax-2') {
        buttons.push(new ButtonBuilder().setCustomId(`${END_PREFIX}:theend`).setLabel('Tira The End').setStyle(ButtonStyle.Danger));
      }
      await i.update({
        content: `**Fine della Session.** ${g.title ? `«${g.title}» ` : ''}si chiude in ${arg === 'positiva' ? 'positivo' : 'negativo'}.`,
        files: [new AttachmentBuilder(png, { name: 'fine-session.png', description: closingNotes(type, arg, lastCartridge).join(' ') })],
        components: buttons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)] : [],
      });
      return;
    }
    case 'burden': {
      if (g.sessionType) return void (await ephemeral('È già iniziata un\'altra Session: usa /cowbot-scheda azione:fardello.'));
      if (!g.title) return void (await ephemeral('La Session non aveva un titolo: usa /cowbot-scheda azione:fardello.'));
      const c = ctx.characters.active(i.user.id);
      if (!c) return void (await ephemeral('Ti serve un personaggio attivo.'));
      if (c.burdens.some((b) => b.title.toLocaleLowerCase('it') === g.title.toLocaleLowerCase('it'))) {
        return void (await ephemeral(`${c.name} ha già il Fardello «${g.title}».`));
      }
      if (c.burdens.length >= MAX_BURDENS) return void (await ephemeral(`${c.name} ha già ${MAX_BURDENS} Fardelli.`));
      ctx.characters.save({ ...c, burdens: [...c.burdens, { title: g.title, resolved: false }] });
      await i.reply(`**${c.name}** scrive «${g.title}» come Fardello sotto il suo Ricordo.`);
      return;
    }
    case 'theend':
      await replyTheEnd(i, ctx);
      return;
  }
}

/** The End per il personaggio attivo di chi lo chiede. */
export async function replyTheEnd(i: ButtonInteraction | Interactive, ctx: Context): Promise<void> {
  const c = ctx.characters.active(i.user.id);
  if (!c) {
    await i.reply({ content: 'Ti serve un personaggio attivo.', flags: MessageFlags.Ephemeral });
    return;
  }
  const resolved = c.burdens.filter((b) => b.resolved).length;
  const r = rollTheEnd(resolved);
  const png = await renderTheEndCard(c.name, r);
  await i.reply({
    content: `**The End** per ${c.name}: ${r.dice.length}D6 (1 + ${resolved} Fardell${resolved === 1 ? 'o' : 'i'} con la X).`,
    files: [new AttachmentBuilder(png, { name: 'the-end.png', description: `${r.dice.join(', ')}: ${r.successes} successi. ${r.title}. ${r.text}` })],
  });
}
