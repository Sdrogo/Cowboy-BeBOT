import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags, type Interaction } from 'discord.js';
import { createContext, type Context } from './context.js';
import { handlePartita } from './commands/partita.js';
import { PROVA_PREFIX, autocompleteProva, handleProva, handleProvaComponent } from './commands/prova.js';
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
  if (i.isAutocomplete()) {
    if (i.commandName === 'prova') return autocompleteProva(i, ctx);
    if (i.commandName === 'scheda') return autocompleteScheda(i, ctx);
    return;
  }
  if (i.isChatInputCommand()) {
    if (i.commandName === 'prova') return handleProva(i, ctx);
    if (i.commandName === 'scheda') return handleScheda(i, ctx);
    if (i.commandName === 'partita') return handlePartita(i, ctx);
    return;
  }
  if ((i.isButton() || i.isStringSelectMenu()) && i.customId.startsWith(`${PROVA_PREFIX}:`)) {
    return handleProvaComponent(i, ctx);
  }
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
