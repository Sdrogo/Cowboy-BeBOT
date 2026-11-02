import { SlashCommandBuilder } from 'discord.js';
import { APPROACHES, GROOVES, GROOVE_IDS, MAX_CARTRIDGES, MAX_RITMO } from '../engine/rules.js';

const approachChoices = APPROACHES.map((a) => ({ name: a, value: a }));
const grooveChoices = GROOVE_IDS.map((id) => ({ name: GROOVES[id].name, value: id }));

export const provaCommand = new SlashCommandBuilder()
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

export const schedaCommand = new SlashCommandBuilder()
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

export const partitaCommand = new SlashCommandBuilder()
  .setName('partita')
  .setDescription('Stato della partita in questo canale')
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

export const allCommands = [provaCommand, schedaCommand, partitaCommand];
