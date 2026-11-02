import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { Context } from '../context.js';
import { SheetError } from '../store/characters.js';
import type { Game } from '../store/games.js';
import { gameEmbed } from './partita.js';

/** Controlli comuni: solo il Big Shot spende Rischio, e deve averne abbastanza. */
function spend(g: Game, userId: string, amount: number): Game {
  if (g.bigShotId && g.bigShotId !== userId) throw new SheetError('Il Rischio lo spende solo il Big Shot.');
  if (g.rischio < amount) throw new SheetError(`Servono ${amount} Rischio, il Big Shot ne ha ${g.rischio}.`);
  return { ...g, rischio: g.rischio - amount };
}

function startOfTurn(g: Game, what: string): void {
  if (g.provasInTurn > 0) {
    throw new SheetError(`${what} si fa solo a inizio svolta, prima della prima Prova (p. 35). Apri una nuova svolta con /cowbot partita svolta.`);
  }
}

export async function handleRischio(i: ChatInputCommandInteraction, ctx: Context): Promise<void> {
  const sub = i.options.getSubcommand();
  const g = ctx.games.get(i.channelId);
  try {
    switch (sub) {
      case 'difficolta': {
        startOfTurn(g, 'Alzare la Difficoltà con il Rischio');
        const n = i.options.getInteger('quantita', true);
        const next = ctx.games.save({ ...spend(g, i.user.id, n), difficulty: g.difficulty + n });
        await i.reply({
          content: `Il Big Shot spende **${n} Rischio**: la Difficoltà sale a **${next.difficulty}**.`,
          embeds: [gameEmbed(next)],
        });
        return;
      }
      case 'inseguimento': {
        startOfTurn(g, "Trasformare la svolta in un inseguimento");
        if (g.chase) throw new SheetError('Questa svolta è già un inseguimento.');
        const next = ctx.games.save({ ...spend(g, i.user.id, 1), chase: true });
        await i.reply({
          content:
            '**Inseguimento!** Il Big Shot spende 1 Rischio. Finché la svolta dura, ogni Prova con 0 successi viene ' +
            'Spinta da sola finché non ne ottiene almeno uno (p. 36). Aprite un orologio inseguimento con /cowbot orologio crea.',
          embeds: [gameEmbed(next)],
        });
        return;
      }
      case 'svantaggio': {
        const target = i.options.getUser('giocatore');
        const next = ctx.games.save({ ...spend(g, i.user.id, 1), disadvantageFor: target?.id ?? '*' });
        await i.reply({
          content: `Il Big Shot spende 1 Rischio: la prossima Prova${target ? ` di ${target}` : ''} si tira con **Svantaggio**.`,
          embeds: [gameEmbed(next)],
        });
        return;
      }
      case 'imposta': {
        if (g.bigShotId && g.bigShotId !== i.user.id) throw new SheetError('Il Rischio lo corregge solo il Big Shot.');
        const next = ctx.games.save({ ...g, rischio: i.options.getInteger('valore', true) });
        await i.reply({ content: `Rischio del Big Shot: **${next.rischio}** (era ${g.rischio}).`, embeds: [gameEmbed(next)] });
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
