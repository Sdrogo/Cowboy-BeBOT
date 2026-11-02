import {
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
  type SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import { APPROACHES, GROOVES, GROOVE_IDS, MAX_CARTRIDGES, MAX_RITMO } from '../engine/rules.js';
import { CLOCK_KINDS, CLOCK_SIZES, SESSION_LABELS, SESSION_TYPES } from '../engine/session.js';

const approachChoices = APPROACHES.map((a) => ({ name: a, value: a }));
const grooveChoices = GROOVE_IDS.map((id) => ({ name: GROOVES[id].name, value: id }));

const provaSubcommand = (s: SlashCommandSubcommandBuilder) =>
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

const schedaGroup = (g: SlashCommandSubcommandGroupBuilder) =>
  g
  .setName('scheda')
  .setDescription('Gestisci le schede dei tuoi personaggi')
  .addSubcommand((s) =>
    s
      .setName('crea')
      .setDescription('Crea un nuovo personaggio e rendilo attivo')
      .addStringOption((o) => o.setName('nome').setDescription('Nome del personaggio').setRequired(true).setMaxLength(60))
      .addStringOption((o) => o.setName('groove').setDescription('Il Groove del personaggio').addChoices(...grooveChoices))
      .addStringOption((o) => o.setName('concept').setDescription('Es. «Ex Mafioso», «Samurai Spaziale»').setMaxLength(100))
      .addStringOption((o) => o.setName('ricordo').setDescription('La frase sul passato che lo perseguita').setMaxLength(200)),
  )
  .addSubcommand((s) => s.setName('lista').setDescription('Elenca i tuoi personaggi'))
  .addSubcommand((s) =>
    s
      .setName('usa')
      .setDescription('Cambia personaggio attivo')
      .addStringOption((o) => o.setName('nome').setDescription('Personaggio').setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('mostra')
      .setDescription('Mostra una scheda (di default quella attiva)')
      .addStringOption((o) => o.setName('nome').setDescription('Personaggio').setAutocomplete(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('modifica')
      .setDescription('Modifica Groove, concept o Ricordo del personaggio attivo')
      .addStringOption((o) => o.setName('groove').setDescription('Nuovo Groove').addChoices(...grooveChoices))
      .addStringOption((o) => o.setName('concept').setDescription('Nuovo concept').setMaxLength(100))
      .addStringOption((o) => o.setName('ricordo').setDescription('Nuovo Ricordo').setMaxLength(200)),
  )
  .addSubcommand((s) =>
    s
      .setName('elimina')
      .setDescription('Elimina un personaggio')
      .addStringOption((o) => o.setName('nome').setDescription('Personaggio').setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('tratto-aggiungi')
      .setDescription('Aggiungi un tratto al personaggio attivo')
      .addStringOption((o) => o.setName('nome').setDescription('Es. «Rossetto Rosso»').setRequired(true).setMaxLength(60))
      .addStringOption((o) =>
        o
          .setName('approccio')
          .setDescription('Esagono in cui scriverlo')
          .setRequired(true)
          .addChoices(...approachChoices, { name: 'MONO (nave personale)', value: 'MONO' }),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('tratto-rimuovi')
      .setDescription('Rimuovi un tratto dal personaggio attivo')
      .addStringOption((o) => o.setName('nome').setDescription('Tratto').setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('tratto-ferita')
      .setDescription('Segna o cura la ferita di un tratto')
      .addStringOption((o) => o.setName('nome').setDescription('Tratto').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) =>
        o
          .setName('stato')
          .setDescription('Stato del tratto')
          .setRequired(true)
          .addChoices({ name: 'Integro', value: 0 }, { name: 'Ferito', value: 1 }, { name: 'Ferito gravemente', value: 2 }),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('cartucce')
      .setDescription('Imposta le Cartucce segnate')
      .addIntegerOption((o) => o.setName('valore').setDescription('Da 0 a 6').setRequired(true).setMinValue(0).setMaxValue(MAX_CARTRIDGES)),
  )
  .addSubcommand((s) =>
    s
      .setName('ritmo')
      .setDescription('Imposta il Ritmo del personaggio attivo')
      .addIntegerOption((o) => o.setName('valore').setDescription('Da 0 a 6').setRequired(true).setMinValue(0).setMaxValue(MAX_RITMO)),
  )
  .addSubcommand((s) =>
    s
      .setName('fardello')
      .setDescription('Aggiungi un Fardello o segnalo come risolto (X)')
      .addStringOption((o) => o.setName('titolo').setDescription('Titolo della Session').setRequired(true).setMaxLength(100))
      .addBooleanOption((o) => o.setName('risolto').setDescription('Segna la X accanto al Fardello')),
  );

const partitaGroup = (g: SlashCommandSubcommandGroupBuilder) =>
  g
  .setName('partita')
  .setDescription('Stato della partita in questo canale')
  .addSubcommand((s) =>
    s
      .setName('sessione')
      .setDescription('Inizia una Session: chi la lancia fa da Big Shot')
      .addStringOption((o) =>
        o
          .setName('tipo')
          .setDescription('Tipo di Session')
          .setRequired(true)
          .addChoices(...SESSION_TYPES.map((t) => ({ name: SESSION_LABELS[t], value: t }))),
      )
      .addStringOption((o) => o.setName('titolo').setDescription('Titolo della Session').setMaxLength(100)),
  )
  .addSubcommand((s) => s.setName('stato').setDescription('Mostra svolta, Difficoltà e Genere'))
  .addSubcommand((s) =>
    s
      .setName('svolta')
      .setDescription('Passa a una svolta: la Difficoltà torna a quella iniziale')
      .addIntegerOption((o) =>
        o
          .setName('numero')
          .setDescription('Svolta')
          .setRequired(true)
          .addChoices({ name: '1 · G.E.S.T.', value: 1 }, { name: '2 · 3, 2, 1…', value: 2 }, { name: "3 · Let's Jam!", value: 3 }),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('difficolta')
      .setDescription('Cambia la Difficoltà della svolta')
      .addIntegerOption((o) => o.setName('variazione').setDescription('Es. -1 per un successo speso, +1 per uno shock'))
      .addIntegerOption((o) => o.setName('valore').setDescription('Imposta un valore preciso').setMinValue(0)),
  )
  .addSubcommand((s) =>
    s
      .setName('genere')
      .setDescription('Imposta il Genere della Session')
      .addStringOption((o) =>
        o.setName('approccio').setDescription('Genere').setRequired(true).addChoices(...approachChoices, { name: 'Nessuno', value: 'nessuno' }),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('shock-minimo')
      .setDescription('Shock minimo per Prova (2 con un orologio minaccia Dance chiuso)')
      .addIntegerOption((o) => o.setName('valore').setDescription('1 o 2').setRequired(true).setMinValue(1).setMaxValue(2)),
  );

const orologioGroup = (g: SlashCommandSubcommandGroupBuilder) =>
  g
  .setName('orologio')
  .setDescription('Orologi della svolta: obiettivi, minacce, inseguimenti')
  .addSubcommand((s) => s.setName('lista').setDescription('Mostra gli orologi aperti nel canale'))
  .addSubcommand((s) =>
    s
      .setName('crea')
      .setDescription('Apri un nuovo orologio (Big Shot)')
      .addStringOption((o) => o.setName('nome').setDescription('Es. «Fuggire dal casinò»').setRequired(true).setMaxLength(60))
      .addIntegerOption((o) =>
        o
          .setName('calibro')
          .setDescription('Numero di sezioni')
          .setRequired(true)
          .addChoices(...CLOCK_SIZES.map((n) => ({ name: `${n} sezioni`, value: n }))),
      )
      .addStringOption((o) =>
        o.setName('approccio').setDescription("Approccio che chiude l'orologio").setRequired(true).addChoices(...approachChoices),
      )
      .addStringOption((o) =>
        o
          .setName('tipo')
          .setDescription('Obiettivo, minaccia, inseguimento o altro')
          .setRequired(true)
          .addChoices(...CLOCK_KINDS.map((k) => ({ name: k, value: k }))),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('segna')
      .setDescription('Segna sezioni a mano, fuori da una Prova (Big Shot)')
      .addStringOption((o) => o.setName('nome').setDescription('Orologio').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName('sezioni').setDescription('Quante sezioni (di default 1)').setMinValue(1).setMaxValue(8)),
  )
  .addSubcommand((s) =>
    s
      .setName('elimina')
      .setDescription('Elimina un orologio (Big Shot)')
      .addStringOption((o) => o.setName('nome').setDescription('Orologio').setRequired(true).setAutocomplete(true)),
  );

const rischioGroup = (g: SlashCommandSubcommandGroupBuilder) =>
  g
  .setName('rischio')
  .setDescription('Il Rischio del Big Shot')
  .addSubcommand((s) =>
    s
      .setName('difficolta')
      .setDescription('Inizio svolta: +1 Difficoltà per ogni Rischio speso')
      .addIntegerOption((o) => o.setName('quantita').setDescription('Rischio da spendere').setRequired(true).setMinValue(1).setMaxValue(10)),
  )
  .addSubcommand((s) => s.setName('inseguimento').setDescription('Inizio svolta: 1 Rischio per trasformarla in un inseguimento'))
  .addSubcommand((s) =>
    s
      .setName('svantaggio')
      .setDescription('1 Rischio: la prossima Prova si tira con Svantaggio')
      .addUserOption((o) => o.setName('giocatore').setDescription('Solo per la prossima Prova di questo giocatore')),
  )
  .addSubcommand((s) =>
    s
      .setName('imposta')
      .setDescription('Corregge a mano il Rischio del Big Shot')
      .addIntegerOption((o) => o.setName('valore').setDescription('Nuovo valore').setRequired(true).setMinValue(0).setMaxValue(99)),
  );

/** Nome dell'unico slash command del bot: tutto il resto sono sottocomandi. */
export const ROOT_COMMAND = 'cowbot';

/**
 * Un solo comando, /cowbot, con:
 * - /cowbot prova
 * - /cowbot scheda <azione>
 * - /cowbot partita <azione>
 * - /cowbot orologio <azione>
 * - /cowbot rischio <azione>
 */
export const cowbotCommand = new SlashCommandBuilder()
  .setName(ROOT_COMMAND)
  .setDescription('Cowboy Bebop - Il Gioco di Ruolo: Prove, schede, orologi e Rischio')
  .addSubcommand(provaSubcommand)
  .addSubcommandGroup(schedaGroup)
  .addSubcommandGroup(partitaGroup)
  .addSubcommandGroup(orologioGroup)
  .addSubcommandGroup(rischioGroup);

export const allCommands = [cowbotCommand];
