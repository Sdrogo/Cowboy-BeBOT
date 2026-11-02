/**
 * Registra gli slash command su Discord.
 * Con DISCORD_GUILD_ID li registra solo su quel server (aggiornamento immediato),
 * altrimenti globalmente (può richiedere fino a un'ora).
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { allCommands } from './commands/definitions.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId) {
  console.error('Servono DISCORD_TOKEN e DISCORD_CLIENT_ID nel file .env.');
  process.exit(1);
}

const rest = new REST().setToken(token);
const body = allCommands.map((c) => c.toJSON());
const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
await rest.put(route, { body });
console.log(`Registrati ${body.length} comandi ${guildId ? `sul server ${guildId}` : 'globalmente'}.`);
