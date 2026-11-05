import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags, type Interaction } from 'discord.js';
import { createContext, type Context } from './context.js';
import { checkAction } from './commands/actions.js';
import { ROOT_COMMAND } from './commands/definitions.js';
import { END_PREFIX, handleEndComponent } from './commands/fine.js';
import { autocompleteOrologio, handleOrologio } from './commands/orologio.js';
import { SESSION_PREFIX, handlePartita, handleSessionComponent } from './commands/partita.js';
import { PROVA_PREFIX, autocompleteProva, handleProva, handleProvaComponent } from './commands/prova.js';
import { handleRischio } from './commands/rischio.js';
import { autocompleteScheda, handleScheda } from './commands/scheda.js';
import { openDatabase } from './store/db.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Manca DISCORD_TOKEN: copia .env.example in .env e compilalo.');
  process.exit(1);
}

const db = openDatabase(process.env.DATABASE_PATH ?? 'data/cowboy-bebot.sqlite');
const ctx = createContext(db);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => console.log(`Cowboy BeBOT in linea come ${c.user.tag}`));
client.on(Events.InteractionCreate, (i) => {
  route(i, ctx).catch(async (err) => {
    console.error(err);
    if (i.isRepliable() && !i.replied && !i.deferred) {
      await i.reply({ content: 'Qualcosa è andato storto. Riprova tra poco.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
});

async function route(i: Interaction, ctx: Context): Promise<void> {
  if (i.isAutocomplete() || i.isChatInputCommand()) {
    // /cowbot-prova, oppure /cowbot-<area> azione:<azione>.
    if (!i.commandName.startsWith(`${ROOT_COMMAND}-`)) return;
    const area = i.commandName.slice(ROOT_COMMAND.length + 1);
    if (i.isAutocomplete()) {
      if (area === 'prova') return autocompleteProva(i, ctx);
      if (area === 'scheda') return autocompleteScheda(i, ctx);
      if (area === 'orologio') return autocompleteOrologio(i, ctx);
      return;
    }
    if (area === 'prova') return handleProva(i, ctx);
    if (area === 'scheda' || area === 'partita' || area === 'orologio' || area === 'rischio') {
      const problem = checkAction(i, area);
      if (problem) return void (await i.reply({ content: problem, flags: MessageFlags.Ephemeral }));
    }
    if (area === 'scheda') return handleScheda(i, ctx);
    if (area === 'partita') return handlePartita(i, ctx);
    if (area === 'orologio') return handleOrologio(i, ctx);
    if (area === 'rischio') return handleRischio(i, ctx);
    return;
  }
  if ((i.isButton() || i.isStringSelectMenu()) && i.customId.startsWith(`${PROVA_PREFIX}:`)) {
    return handleProvaComponent(i, ctx);
  }
  if (i.isButton() && i.customId.startsWith(`${SESSION_PREFIX}:`)) return handleSessionComponent(i, ctx);
  if (i.isButton() && i.customId.startsWith(`${END_PREFIX}:`)) return handleEndComponent(i, ctx);
}

// `docker stop` manda SIGTERM: chiudiamo Discord e il database prima di uscire.
async function shutdown(signal: string): Promise<void> {
  console.log(`Ricevuto ${signal}, chiusura in corso.`);
  await client.destroy().catch(() => {});
  db.close();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await client.login(token);
