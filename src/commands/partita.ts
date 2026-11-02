import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { TURNS, isApproach, type TurnNumber } from '../engine/rules.js';
import type { Context } from '../context.js';
import type { Game } from '../store/games.js';
import { approachColorInt } from '../render/theme.js';

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
      { name: 'In questa svolta', value: TURN_NOTES[g.turn] },
    )
    .setFooter({ text: g.minShock > 1 ? `Shock minimo per Prova: ${g.minShock}` : 'Ogni Prova produce almeno 1 shock' });
}

export async function handlePartita(i: ChatInputCommandInteraction, ctx: Context): Promise<void> {
  const sub = i.options.getSubcommand();
  const g = ctx.games.get(i.channelId);
  switch (sub) {
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
