import { SlashCommandBuilder, type SlashCommandStringOption, type SlashCommandSubcommandBuilder } from 'discord.js';
import { AREAS, type ActionSpec, type AreaName } from './actions.js';
import { APPROACHES, MAX_CARTRIDGES } from '../engine/rules.js';

/** Prefisso comune dei comandi del bot. */
export const ROOT_COMMAND = 'cowbot';

const approachChoices = APPROACHES.map((a) => ({ name: a, value: a }));

const provaCommand = (s: SlashCommandSubcommandBuilder) =>
  s
  .setName('prova')
  .setDescription('Tira una Prova con il tuo personaggio attivo')
  .addStringOption((o) =>
    o.setName('approccio').setDescription('Rock, Dance, Blues, Tango o Jazz').setRequired(true).addChoices(...approachChoices),
  )
  .addStringOption((o) => o.setName('tratto1').setDescription('Tratto usato nella scena (+1 dado)').setAutocomplete(true))
  .addStringOption((o) => o.setName('tratto2').setDescription('Altro tratto usato (+1 dado)').setAutocomplete(true))
  .addStringOption((o) => o.setName('tratto3').setDescription('Altro tratto usato (+1 dado)').setAutocomplete(true))
  .addIntegerOption((o) =>
    o
      .setName('cartucce')
      .setDescription('Farsi coinvolgere: Cartucce da segnare, +2 dadi ciascuna')
      .setMinValue(0)
      .setMaxValue(MAX_CARTRIDGES),
  )
  .addBooleanOption((o) => o.setName('vantaggio').setDescription('Tira un dado in più e scarta il più basso'))
  .addBooleanOption((o) => o.setName('svantaggio').setDescription('Tira un dado in più e scarta il più alto'))
  .addIntegerOption((o) =>
    o.setName('modificatore').setDescription('Dadi in più o in meno (es. Groove della Taglia)').setMinValue(-10).setMaxValue(10),
  );

const actionOption = (specs: readonly ActionSpec[]) => (o: SlashCommandStringOption) =>
  o
    .setName('azione')
    .setDescription('Cosa vuoi fare')
    .setRequired(true)
    .addChoices(...specs.map((a) => ({ name: a.label, value: a.id })));

const areaCommand = (name: AreaName, description: string) => (c: SlashCommandSubcommandBuilder) =>
  c.setName(name).setDescription(description).addStringOption(actionOption(AREAS[name]));

const schedaCommand = areaCommand('scheda', 'Gestisci le schede dei tuoi personaggi');
const partitaCommand = areaCommand('partita', 'Stato della partita in questo canale');
const orologioCommand = areaCommand('orologio', 'Orologi della svolta: obiettivi, minacce, inseguimenti');
const rischioCommand = areaCommand('rischio', 'Il Rischio del Big Shot');

/**
 * Un solo comando, /cowbot, con un sottocomando per area:
 * - /cowbot prova
 * - /cowbot scheda | partita | orologio | rischio: scegli l'azione e il bot
 *   apre un form con i soli campi che servono (src/commands/forms.ts)
 */
export const allCommands = [
  new SlashCommandBuilder()
    .setName(ROOT_COMMAND)
    .setDescription('Cowboy BeBOT: Prove, schede, partita, orologi e Rischio')
    .addSubcommand(provaCommand)
    .addSubcommand(schedaCommand)
    .addSubcommand(partitaCommand)
    .addSubcommand(orologioCommand)
    .addSubcommand(rischioCommand),
];
