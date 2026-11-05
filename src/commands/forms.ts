import {
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { Context } from '../context.js';
import { APPROACHES, GROOVES, GROOVE_IDS, MAX_CARTRIDGES, MAX_RITMO } from '../engine/rules.js';
import { CLOCK_KINDS, CLOCK_SIZES, SESSION_LABELS, SESSION_TYPES } from '../engine/session.js';
import { Args, type ArgValue } from './args.js';
import type { AreaName } from './actions.js';

export const FORM_PREFIX = 'form';

interface Opt {
  label: string;
  value: string;
  description?: string;
}

export interface Field {
  id: string;
  label: string;
  kind: 'text' | 'select' | 'user';
  required: boolean;
  placeholder?: string;
  maxLength?: number;
  long?: boolean;
  options?: Opt[];
  /** Come interpretare il valore: numero intero o sì/no. */
  as?: 'int' | 'bool';
}

const text = (id: string, label: string, o: Partial<Field> = {}): Field => ({ id, label, kind: 'text', required: false, ...o });
const select = (id: string, label: string, options: Opt[], o: Partial<Field> = {}): Field => ({
  id,
  label,
  kind: 'select',
  required: false,
  options,
  ...o,
});
const range = (min: number, max: number): Opt[] => Array.from({ length: max - min + 1 }, (_, k) => ({ label: String(min + k), value: String(min + k) }));

const approaches: Opt[] = APPROACHES.map((a) => ({ label: a, value: a }));
const grooves: Opt[] = GROOVE_IDS.map((id) => ({ label: GROOVES[id].name, value: id }));

/**
 * I campi del form di ogni azione. Restituisce una lista vuota se l'azione non
 * ha campi, oppure un messaggio d'errore se non si può compilare (es. nessun personaggio).
 */
export function formFor(area: AreaName, action: string, ctx: Context, userId: string, channelId: string): Field[] | string {
  const key = `${area}:${action}`;
  switch (key) {
    // --- scheda ---
    case 'scheda:crea':
      return [
        text('nome', 'Nome del personaggio', { required: true, maxLength: 60 }),
        select('groove', 'Groove', grooves),
        text('concept', 'Concept', { maxLength: 100, placeholder: 'Es. «Ex Mafioso», «Samurai Spaziale»' }),
        text('ricordo', 'Ricordo (il passato che lo perseguita)', { maxLength: 200, long: true }),
      ];
    case 'scheda:usa':
    case 'scheda:mostra':
    case 'scheda:elimina': {
      const list = ctx.characters.list(userId).slice(0, 25);
      if (!list.length) return 'Non hai personaggi: creane uno con `/cowbot scheda azione:crea`.';
      return [select('nome', 'Personaggio', list.map((c) => ({ label: c.name, value: c.name })), { required: action !== 'mostra' })];
    }
    case 'scheda:modifica':
      return [
        select('groove', 'Nuovo Groove', grooves),
        text('concept', 'Nuovo concept', { maxLength: 100 }),
        text('ricordo', 'Nuovo Ricordo', { maxLength: 200, long: true }),
      ];
    case 'scheda:tratto-aggiungi':
      return [
        text('nome', 'Nome del tratto', { required: true, maxLength: 60, placeholder: 'Es. «Rossetto Rosso»' }),
        select('approccio', 'Esagono in cui scriverlo', [...approaches, { label: 'MONO (nave personale)', value: 'MONO' }], { required: true }),
      ];
    case 'scheda:tratto-rimuovi':
    case 'scheda:tratto-ferita': {
      const traits = ctx.characters.active(userId)?.traits.slice(0, 25) ?? [];
      if (!traits.length) return 'Il tuo personaggio attivo non ha tratti.';
      const fields = [select('nome', 'Tratto', traits.map((t) => ({ label: t.name, value: t.name, description: t.slot })), { required: true })];
      if (action === 'tratto-ferita') {
        fields.push(
          select(
            'stato',
            'Stato del tratto',
            [
              { label: 'Integro', value: '0' },
              { label: 'Ferito', value: '1' },
              { label: 'Ferito gravemente', value: '2' },
            ],
            { required: true, as: 'int' },
          ),
        );
      }
      return fields;
    }
    case 'scheda:cartucce':
      return [select('valore', 'Cartucce segnate', range(0, MAX_CARTRIDGES), { required: true, as: 'int' })];
    case 'scheda:ritmo':
      return [select('valore', 'Ritmo', range(0, MAX_RITMO), { required: true, as: 'int' })];
    case 'scheda:fardello':
      return [
        text('titolo', 'Titolo della Session', { required: true, maxLength: 100 }),
        select('risolto', 'Segna la X (risolto)?', [{ label: 'No', value: 'no' }, { label: 'Sì', value: 'si' }], { as: 'bool' }),
      ];

    // --- partita ---
    case 'partita:sessione':
      return [
        select('tipo', 'Tipo di Session', SESSION_TYPES.map((t) => ({ label: SESSION_LABELS[t], value: t })), { required: true }),
        text('titolo', 'Titolo della Session', { maxLength: 100 }),
        select('approccio', 'Genere della Session', approaches),
      ];
    case 'partita:fine':
      return [select('esito', "Com'è finita la svolta Let's Jam!", [{ label: 'Positiva', value: 'positiva' }, { label: 'Negativa', value: 'negativa' }], { required: true })];
    case 'partita:svolta':
      return [
        text('obiettivo', 'Orologio obiettivo (nome)', { maxLength: 60, placeholder: 'Lascia vuoto per non crearlo' }),
        text('minaccia', 'Orologio minaccia (nome)', { maxLength: 60, placeholder: 'Lascia vuoto per non crearla' }),
        select('calibro', 'Sezioni degli orologi (default: 4, 6, 8 per svolta)', CLOCK_SIZES.map((n) => ({ label: `${n} sezioni`, value: String(n) })), { as: 'int' }),
        select('approccio', 'Approccio degli orologi (default il Genere)', approaches),
      ];
    case 'partita:difficolta':
      return [
        text('variazione', 'Variazione', { maxLength: 3, placeholder: 'Es. -1 per un successo speso, +1 per uno shock', as: 'int' }),
        text('valore', 'Oppure valore preciso', { maxLength: 3, placeholder: 'Es. 4', as: 'int' }),
      ];
    case 'partita:genere':
      return [select('approccio', 'Genere', [...approaches, { label: 'Nessuno', value: 'nessuno' }], { required: true })];
    case 'partita:shock-minimo':
      return [select('valore', 'Shock minimo per Prova', [{ label: '1 (normale)', value: '1' }, { label: '2 (minaccia Dance chiusa)', value: '2' }], { required: true, as: 'int' })];

    // --- orologio ---
    case 'orologio:crea':
      return [
        text('nome', "Nome dell'orologio", { required: true, maxLength: 60, placeholder: 'Es. «Fuggire dal casinò»' }),
        select('calibro', 'Sezioni', CLOCK_SIZES.map((n) => ({ label: `${n} sezioni`, value: String(n) })), { required: true, as: 'int' }),
        select('approccio', "Approccio che chiude l'orologio", approaches, { required: true }),
        select('tipo', 'Tipo', CLOCK_KINDS.map((k) => ({ label: k, value: k })), { required: true }),
      ];
    case 'orologio:segna':
    case 'orologio:elimina': {
      const clocks = ctx.clocks.list(channelId, action === 'elimina').slice(0, 25);
      if (!clocks.length) return 'Non ci sono orologi in questo canale.';
      const fields = [
        select(
          'nome',
          'Orologio',
          clocks.map((c) => ({ label: c.name, value: c.name, description: `${c.kind} ${c.approach} ${c.marks}/${c.size}` })),
          { required: true },
        ),
      ];
      if (action === 'segna') fields.push(select('sezioni', 'Quante sezioni (default 1)', range(1, 8), { as: 'int' }));
      return fields;
    }

    // --- rischio ---
    case 'rischio:difficolta':
      return [select('quantita', 'Rischio da spendere (+1 Difficoltà ciascuno)', range(1, 10), { required: true, as: 'int' })];
    case 'rischio:svantaggio':
      return [{ id: 'giocatore', label: 'Solo per la prossima Prova di…', kind: 'user', required: false }];
    case 'rischio:imposta':
      return [text('valore', 'Nuovo valore del Rischio', { required: true, maxLength: 2, as: 'int' })];
    default:
      return [];
  }
}

export function buildModal(area: AreaName, action: string, title: string, fields: Field[]): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`${FORM_PREFIX}:${area}:${action}`).setTitle(title.slice(0, 45));
  for (const f of fields) {
    const label = new LabelBuilder().setLabel(f.label.slice(0, 45));
    if (f.kind === 'text') {
      const input = new TextInputBuilder()
        .setCustomId(f.id)
        .setStyle(f.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(f.required);
      if (f.maxLength) input.setMaxLength(f.maxLength);
      if (f.placeholder) input.setPlaceholder(f.placeholder.slice(0, 100));
      label.setTextInputComponent(input);
    } else if (f.kind === 'select') {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(f.id)
        .setRequired(f.required)
        .setMinValues(f.required ? 1 : 0)
        .setMaxValues(1)
        .setPlaceholder('Scegli…')
        .addOptions(
          (f.options ?? []).map((o) => {
            const b = new StringSelectMenuOptionBuilder().setLabel(o.label.slice(0, 100)).setValue(o.value.slice(0, 100));
            return o.description ? b.setDescription(o.description.slice(0, 100)) : b;
          }),
        );
      label.setStringSelectMenuComponent(menu);
    } else {
      label.setUserSelectMenuComponent(
        new UserSelectMenuBuilder().setCustomId(f.id).setRequired(f.required).setMinValues(f.required ? 1 : 0).setMaxValues(1),
      );
    }
    modal.addLabelComponents(label);
  }
  return modal;
}

/** Legge i valori inviati; restituisce un messaggio se un numero non è valido. */
export function readModal(i: ModalSubmitInteraction, fields: Field[]): { args: Args } | { error: string } {
  const values: Record<string, ArgValue> = {};
  for (const f of fields) {
    let raw: string | undefined;
    if (f.kind === 'text') raw = i.fields.getTextInputValue(f.id).trim() || undefined;
    else if (f.kind === 'select') raw = i.fields.getStringSelectValues(f.id)[0];
    else {
      const user = i.fields.getSelectedUsers(f.id, false)?.first();
      if (user) values[f.id] = user;
      continue;
    }
    if (raw === undefined) continue;
    if (f.as === 'int') {
      if (!/^[+-]?\d+$/.test(raw)) return { error: `«${f.label}» deve essere un numero intero.` };
      values[f.id] = Number.parseInt(raw, 10);
    } else if (f.as === 'bool') values[f.id] = raw === 'si';
    else values[f.id] = raw;
  }
  return { args: new Args(values) };
}
