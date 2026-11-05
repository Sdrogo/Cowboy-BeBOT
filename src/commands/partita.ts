import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { MAX_RITMO, TURNS, isApproach, type TurnNumber } from '../engine/rules.js';
import {
  SESSION_LABELS,
  clampRitmo,
  genreChosenByPlayers,
  isSessionType,
  startingRischio,
  startingRitmo,
  type PlayerSheet,
} from '../engine/session.js';
import type { Context } from '../context.js';
import { enterTurn, newGame, type Game } from '../store/games.js';
import { renderSessionCard } from '../render/sessionCard.js';
import { approachColorInt } from '../render/theme.js';
import { setRitmo } from '../store/characters.js';
import { askEndSession, replyTheEnd } from './fine.js';

export const SESSION_PREFIX = 'sessione';

const TURN_NOTES: Record<TurnNumber, string> = {
  1: 'Riff: Assolo (1 volta per Session). Big Shot: 1 Rischio per +1 shock o per imporre Svantaggio.',
  2: 'Si aggiungono Aiutare e Improvvisare. Big Shot: 1 Rischio per +2 shock.',
  3: 'Si aggiunge Jam. Ogni 1 tirato genera 2 shock.',
};

export function gameEmbed(g: Game, title = 'Stato della partita'): EmbedBuilder {
  const turn = TURNS[g.turn];
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(g.genre ? approachColorInt(g.genre) : 0x111111)
    .addFields(
      { name: 'Svolta', value: `${turn.number} · ${turn.name}`, inline: true },
      { name: 'Difficoltà', value: String(g.difficulty), inline: true },
      { name: 'Genere', value: g.genre ?? '—', inline: true },
      { name: 'Session', value: g.sessionType ? SESSION_LABELS[g.sessionType] : '—', inline: true },
      { name: 'Big Shot', value: g.bigShotId ? `<@${g.bigShotId}>` : 'chiunque', inline: true },
      { name: 'Rischio', value: String(g.rischio), inline: true },
      { name: 'In questa svolta', value: [TURN_NOTES[g.turn], ...turnFlags(g)].join('\n') },
    )
    .setFooter({ text: g.minShock > 1 ? `Shock minimo per Prova: ${g.minShock}` : 'Ogni Prova produce almeno 1 shock' });
}

function turnFlags(g: Game): string[] {
  const out: string[] = [];
  if (g.chase) out.push('**Inseguimento**: le Prove con 0 successi si Spingono da sole.');
  if (g.difficultyLocked) out.push('**Minaccia Jazz**: la Difficoltà non può scendere.');
  if (g.bluesLimit) out.push('**Minaccia Blues**: mostrare le ferite ne cura una sola.');
  if (g.disadvantageFor) out.push(`Prossima Prova${g.disadvantageFor === '*' ? '' : ` di <@${g.disadvantageFor}>`} con **Svantaggio** dal Rischio.`);
  const fx = g.nextTurnEffects;
  if (Object.keys(fx).length) out.push('Effetti di minacce chiuse in arrivo alla prossima svolta.');
  return out;
}

// --- Inizio Session ---

async function sessionView(ctx: Context, channelId: string, open: boolean) {
  const g = ctx.games.get(channelId);
  const players = ctx.games.players(channelId);
  const type = g.sessionType ?? 'classica';
  const rows = players.map((p) => ({ p, c: ctx.characters.byId(p.characterId) }));
  const png = await renderSessionCard({
    type,
    title: g.title,
    players: rows.map(({ p, c }) => ({ name: c?.name ?? '???', roll: p.roll, ritmo: p.ritmo })),
    rischio: g.rischio,
    genre: g.genre,
    genreByPlayers: genreChosenByPlayers(type, players.flatMap((p) => (p.roll === null ? [] : [p.roll]))),
  });
  const alt = `${SESSION_LABELS[type]}: ${rows.map(({ p, c }) => `${c?.name ?? '???'} Ritmo ${p.ritmo}`).join(', ') || 'nessun CT'}; Rischio ${g.rischio}`;
  const files = [new AttachmentBuilder(png, { name: 'sessione.png', description: alt })];
  if (!open) return { files, components: [] };
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${SESSION_PREFIX}:join`).setLabel('Mi unisco').setStyle(ButtonStyle.Primary),
    ...(type === 'classica'
      ? [new ButtonBuilder().setCustomId(`${SESSION_PREFIX}:buy`).setLabel('Compra Ritmo (+1 Rischio al Big Shot)').setStyle(ButtonStyle.Secondary)]
      : []),
    new ButtonBuilder().setCustomId(`${SESSION_PREFIX}:start`).setLabel('Inizia G.E.S.T.').setStyle(ButtonStyle.Success),
  );
  return { files, components: [row] };
}

/**
 * Ricalcola il Rischio iniziale dai CT al tavolo. Nella Classica il Ritmo
 * comprato (Ritmo oltre il tiro) dà un Rischio ciascuno al Big Shot (p. 40).
 */
function recomputeRischio(ctx: Context, channelId: string): Game {
  const g = ctx.games.get(channelId);
  if (!g.sessionType) return g;
  const players = ctx.games.players(channelId);
  const sheets: PlayerSheet[] = players.map((p) => ctx.characters.byId(p.characterId) ?? { cartridges: 0, burdens: [] });
  let rischio = startingRischio(g.sessionType, sheets, players.map((p) => p.ritmo));
  if (g.sessionType === 'classica') rischio += players.reduce((a, p) => a + Math.max(0, p.ritmo - (p.roll ?? p.ritmo)), 0);
  return ctx.games.save({ ...g, rischio });
}

export async function handleSessionComponent(i: ButtonInteraction, ctx: Context): Promise<void> {
  const action = i.customId.split(':')[1];
  const channelId = i.channelId;
  const g = ctx.games.get(channelId);
  const ephemeral = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral });
  if (!g.sessionType) return void (await ephemeral('Nessuna Session in corso: avviala con /cowbot-partita sessione.'));
  const isBigShot = !g.bigShotId || g.bigShotId === i.user.id;

  switch (action) {
    case 'join': {
      if (g.bigShotId === i.user.id) return void (await ephemeral('Sei il Big Shot: i CT sono gli altri giocatori.'));
      const c = ctx.characters.active(i.user.id);
      if (!c) return void (await ephemeral('Ti serve un personaggio attivo: creane uno con /cowbot-scheda crea.'));
      const prev = ctx.games.players(channelId).find((p) => p.userId === i.user.id);
      // Nella Classica il Ritmo si tira una volta sola: chi si riunisce tiene il suo tiro.
      const roll = g.sessionType === 'classica' ? (prev?.roll ?? 1 + Math.floor(Math.random() * 6)) : null;
      const ritmo = clampRitmo(startingRitmo(g.sessionType, c, roll ?? 0));
      ctx.games.setPlayer(channelId, { userId: i.user.id, characterId: c.id, roll, ritmo });
      ctx.characters.save(setRitmo(c, ritmo));
      recomputeRischio(ctx, channelId);
      await i.update(await sessionView(ctx, channelId, true));
      return;
    }
    case 'buy': {
      const players = ctx.games.players(channelId);
      const me = players.find((p) => p.userId === i.user.id);
      if (!me) return void (await ephemeral('Prima premi «Mi unisco».'));
      if (me.ritmo >= MAX_RITMO) return void (await ephemeral(`Hai già il Ritmo massimo (${MAX_RITMO}).`));
      ctx.games.setPlayer(channelId, { ...me, ritmo: me.ritmo + 1 });
      const c = ctx.characters.byId(me.characterId);
      if (c) ctx.characters.save(setRitmo(c, me.ritmo + 1));
      recomputeRischio(ctx, channelId);
      await i.update(await sessionView(ctx, channelId, true));
      return;
    }
    case 'start': {
      if (!isBigShot) return void (await ephemeral('La prima svolta la apre il Big Shot.'));
      const next = ctx.games.save(enterTurn(ctx.games.get(channelId), 1));
      await i.update(await sessionView(ctx, channelId, false));
      await i.followUp({ embeds: [gameEmbed(next, `Si apre la svolta 1: ${TURNS[1].name}`)] });
      return;
    }
  }
}

export async function handlePartita(i: ChatInputCommandInteraction, ctx: Context): Promise<void> {
  const sub = i.options.getSubcommand();
  const g = ctx.games.get(i.channelId);
  switch (sub) {
    case 'sessione': {
      const type = i.options.getString('tipo', true);
      if (!isSessionType(type)) throw new Error('Tipo di Session non valido');
      ctx.games.clearPlayers(i.channelId);
      ctx.clocks.clear(i.channelId);
      const fresh = newGame(i.channelId);
      const genre = i.options.getString('genere');
      ctx.games.save({
        ...fresh,
        sessionType: type,
        title: i.options.getString('titolo') ?? '',
        bigShotId: i.user.id,
        genre: genre && isApproach(genre) ? genre : null,
      });
      recomputeRischio(ctx, i.channelId);
      await i.reply({
        content:
          `${i.user} fa da **Big Shot** per questa ${SESSION_LABELS[type]}. ` +
          (genre && isApproach(genre) ? `Genere: **${genre}**. ` : '') +
          'Cacciatori, premete «Mi unisco» con il personaggio attivo: il bot calcola Ritmo e Rischio.',
        ...(await sessionView(ctx, i.channelId, true)),
      });
      return;
    }
    case 'fine':
      await askEndSession(i, ctx);
      return;
    case 'the-end':
      await replyTheEnd(i, ctx);
      return;
    case 'stato':
      await i.reply({ embeds: [gameEmbed(g)] });
      return;
    case 'svolta': {
      const n = i.options.getInteger('numero', true) as TurnNumber;
      const next = ctx.games.setTurn(i.channelId, n);
      await i.reply({ embeds: [gameEmbed(next, `Si apre la svolta ${n}: ${TURNS[n].name}`)] });
      return;
    }
    case 'difficolta': {
      const delta = i.options.getInteger('variazione');
      const value = i.options.getInteger('valore');
      const difficulty = Math.max(0, value ?? g.difficulty + (delta ?? 0));
      if (g.difficultyLocked && difficulty < g.difficulty) {
        await i.reply({ content: 'Minaccia Jazz: in questa svolta la Difficoltà non può scendere (p. 25).', flags: MessageFlags.Ephemeral });
        return;
      }
      const next = ctx.games.save({ ...g, difficulty });
      const sign = difficulty > g.difficulty ? 'sale' : difficulty < g.difficulty ? 'scende' : 'resta';
      await i.reply(`La Difficoltà ${sign} a **${next.difficulty}** (era ${g.difficulty}).`);
      return;
    }
    case 'genere': {
      const raw = i.options.getString('approccio', true);
      const next = ctx.games.save({ ...g, genre: isApproach(raw) ? raw : null });
      await i.reply(next.genre ? `Genere della Session: **${next.genre}**. I suoi tratti danno +1 dado.` : 'Nessun Genere per questa Session.');
      return;
    }
    case 'shock-minimo': {
      const next = ctx.games.save({ ...g, minShock: i.options.getInteger('valore', true) });
      await i.reply(`Ogni Prova ora produce almeno **${next.minShock}** shock.`);
      return;
    }
  }
}
