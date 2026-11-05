import { SlashCommandBuilder, type SlashCommandStringOption } from 'discord.js';
import { AREAS, type ActionSpec } from './actions.js';
import { APPROACHES, GROOVES, GROOVE_IDS, MAX_CARTRIDGES, MAX_RITMO } from '../engine/rules.js';
import { CLOCK_KINDS, CLOCK_SIZES, SESSION_LABELS, SESSION_TYPES } from '../engine/session.js';

/** Prefisso comune dei comandi del bot. */
export const ROOT_COMMAND = 'cowbot';

const approachChoices = APPROACHES.map((a) => ({ name: a, value: a }));
const grooveChoices = GROOVE_IDS.map((id) => ({ name: GROOVES[id].name, value: id }));

const provaCommand = (s: SlashCommandBuilder) =>
  s
  .setName(`${ROOT_COMMAND}-prova`)
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

const nomeOption = (desc: string) => (o: SlashCommandStringOption) =>
  o.setName('nome').setDescription(desc).setMaxLength(60).setAutocomplete(true);

const schedaCommand = (c: SlashCommandBuilder) =>
  c
    .setName(`${ROOT_COMMAND}-scheda`)
    .setDescription('Gestisci le schede dei tuoi personaggi')
    .addStringOption(actionOption(AREAS.scheda))
    .addStringOption(nomeOption('Personaggio o tratto (per crea e tratto-aggiungi scrivi il nome nuovo)'))
    .addStringOption((o) => o.setName('groove').setDescription('Il Groove del personaggio').addChoices(...grooveChoices))
    .addStringOption((o) => o.setName('concept').setDescription('Es. «Ex Mafioso», «Samurai Spaziale»').setMaxLength(100))
    .addStringOption((o) => o.setName('ricordo').setDescription('La frase sul passato che lo perseguita').setMaxLength(200))
    .addStringOption((o) =>
      o
        .setName('approccio')
        .setDescription('Esagono in cui scrivere il tratto')
        .addChoices(...approachChoices, { name: 'MONO (nave personale)', value: 'MONO' }),
    )
    .addIntegerOption((o) =>
      o
        .setName('stato')
        .setDescription('Stato del tratto')
        .addChoices({ name: 'Integro', value: 0 }, { name: 'Ferito', value: 1 }, { name: 'Ferito gravemente', value: 2 }),
    )
    .addIntegerOption((o) => o.setName('valore').setDescription('Cartucce o Ritmo, da 0 a 6').setMinValue(0).setMaxValue(6))
    .addStringOption((o) => o.setName('titolo').setDescription('Titolo della Session (Fardello)').setMaxLength(100))
    .addBooleanOption((o) => o.setName('risolto').setDescription('Fardello: segna la X'));

const partitaCommand = (c: SlashCommandBuilder) =>
  c
    .setName(`${ROOT_COMMAND}-partita`)
    .setDescription('Stato della partita in questo canale')
    .addStringOption(actionOption(AREAS.partita))
    .addStringOption((o) =>
      o
        .setName('tipo')
        .setDescription('Tipo di Session')
        .addChoices(...SESSION_TYPES.map((t) => ({ name: SESSION_LABELS[t], value: t }))),
    )
    .addStringOption((o) => o.setName('titolo').setDescription('Titolo della Session').setMaxLength(100))
    .addStringOption((o) =>
      o
        .setName('esito')
        .setDescription("Com'è finita la svolta Let's Jam!")
        .addChoices({ name: 'Positiva', value: 'positiva' }, { name: 'Negativa', value: 'negativa' }),
    )
    .addIntegerOption((o) =>
      o
        .setName('numero')
        .setDescription('Svolta')
        .addChoices({ name: '1 · G.E.S.T.', value: 1 }, { name: '2 · 3, 2, 1…', value: 2 }, { name: "3 · Let's Jam!", value: 3 }),
    )
    .addStringOption((o) =>
      o
        .setName('approccio')
        .setDescription('Genere della Session, o Approccio degli orologi della svolta')
        .addChoices(...approachChoices, { name: 'Nessuno', value: 'nessuno' }),
    )
    .addStringOption((o) => o.setName('obiettivo').setDescription('Svolta: crea un orologio obiettivo con questo nome').setMaxLength(60))
    .addStringOption((o) => o.setName('minaccia').setDescription('Svolta: crea un orologio minaccia con questo nome').setMaxLength(60))
    .addIntegerOption((o) =>
      o
        .setName('calibro')
        .setDescription('Svolta: sezioni degli orologi creati (di default 4)')
        .addChoices(...CLOCK_SIZES.map((n) => ({ name: `${n} sezioni`, value: n }))),
    )
    .addIntegerOption((o) => o.setName('variazione').setDescription('Difficoltà: es. -1 per un successo speso, +1 per uno shock'))
    .addIntegerOption((o) => o.setName('valore').setDescription('Difficoltà (valore preciso) o shock minimo (1 o 2)').setMinValue(0));

const orologioCommand = (c: SlashCommandBuilder) =>
  c
    .setName(`${ROOT_COMMAND}-orologio`)
    .setDescription('Orologi della svolta: obiettivi, minacce, inseguimenti')
    .addStringOption(actionOption(AREAS.orologio))
    .addStringOption(nomeOption('Nome dell\'orologio (per crea scrivi il nome nuovo)'))
    .addIntegerOption((o) =>
      o
        .setName('calibro')
        .setDescription('Numero di sezioni')
        .addChoices(...CLOCK_SIZES.map((n) => ({ name: `${n} sezioni`, value: n }))),
    )
    .addStringOption((o) =>
      o.setName('approccio').setDescription("Approccio che chiude l'orologio").addChoices(...approachChoices),
    )
    .addStringOption((o) =>
      o
        .setName('tipo')
        .setDescription('Obiettivo, minaccia, inseguimento o altro')
        .addChoices(...CLOCK_KINDS.map((k) => ({ name: k, value: k }))),
    )
    .addIntegerOption((o) => o.setName('sezioni').setDescription('Segna: quante sezioni (di default 1)').setMinValue(1).setMaxValue(8));

const rischioCommand = (c: SlashCommandBuilder) =>
  c
    .setName(`${ROOT_COMMAND}-rischio`)
    .setDescription('Il Rischio del Big Shot')
    .addStringOption(actionOption(AREAS.rischio))
    .addIntegerOption((o) => o.setName('quantita').setDescription('Difficoltà: Rischio da spendere').setMinValue(1).setMaxValue(10))
    .addUserOption((o) => o.setName('giocatore').setDescription('Svantaggio: solo per la prossima Prova di questo giocatore'))
    .addIntegerOption((o) => o.setName('valore').setDescription('Imposta: nuovo valore del Rischio').setMinValue(0).setMaxValue(99));

/**
 * Un comando di primo livello per area, con un campo `azione` che elenca tutto
 * quello che si può fare:
 * - /cowbot-prova
 * - /cowbot-scheda azione:...
 * - /cowbot-partita azione:...
 * - /cowbot-orologio azione:...
 * - /cowbot-rischio azione:...
 */
export const allCommands = [
  provaCommand(new SlashCommandBuilder()),
  schedaCommand(new SlashCommandBuilder()),
  partitaCommand(new SlashCommandBuilder()),
  orologioCommand(new SlashCommandBuilder()),
  rischioCommand(new SlashCommandBuilder()),
];
