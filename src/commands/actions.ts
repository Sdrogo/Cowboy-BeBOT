import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { MAX_CARTRIDGES, MAX_RITMO } from '../engine/rules.js';

/**
 * Ogni area (/cowbot-scheda, /cowbot-partita, ...) ha un campo `azione` che
 * elenca tutte le azioni possibili. Discord non permette opzioni che cambiano
 * con la scelta, quindi le opzioni sono tutte facoltative e le controlliamo qui.
 */
export interface ActionSpec {
  id: string;
  /** Testo mostrato nel campo `azione`. */
  label: string;
  /** Opzioni obbligatorie per questa azione. */
  required?: string[];
  /** Intervalli ammessi (estremi inclusi) per le opzioni numeriche. */
  ranges?: Record<string, [number, number]>;
}

export const AREAS = {
  scheda: [
    { id: 'crea', label: 'crea · nuovo personaggio', required: ['nome'] },
    { id: 'lista', label: 'lista · i tuoi personaggi' },
    { id: 'usa', label: 'usa · cambia personaggio attivo', required: ['nome'] },
    { id: 'mostra', label: 'mostra · vedi una scheda' },
    { id: 'modifica', label: 'modifica · Groove, concept, Ricordo' },
    { id: 'elimina', label: 'elimina · cancella un personaggio', required: ['nome'] },
    { id: 'tratto-aggiungi', label: 'tratto-aggiungi · nuovo tratto', required: ['nome', 'approccio'] },
    { id: 'tratto-rimuovi', label: 'tratto-rimuovi · togli un tratto', required: ['nome'] },
    { id: 'tratto-ferita', label: 'tratto-ferita · ferisci o cura un tratto', required: ['nome', 'stato'] },
    { id: 'cartucce', label: 'cartucce · imposta le Cartucce', required: ['valore'], ranges: { valore: [0, MAX_CARTRIDGES] } },
    { id: 'ritmo', label: 'ritmo · imposta il Ritmo', required: ['valore'], ranges: { valore: [0, MAX_RITMO] } },
    { id: 'fardello', label: 'fardello · aggiungi o risolvi un Fardello', required: ['titolo'] },
  ],
  partita: [
    { id: 'sessione', label: 'sessione · inizia una Session', required: ['tipo'] },
    { id: 'fine', label: 'fine · chiudi la Session (Big Shot)', required: ['esito'] },
    { id: 'the-end', label: 'the-end · finale di stagione' },
    { id: 'stato', label: 'stato · svolta, Difficoltà, Genere' },
    { id: 'svolta', label: 'svolta · passa a una nuova svolta', required: ['numero'] },
    { id: 'difficolta', label: 'difficolta · cambia la Difficoltà', ranges: { valore: [0, 99] } },
    { id: 'genere', label: 'genere · imposta il Genere', required: ['approccio'] },
    { id: 'shock-minimo', label: 'shock-minimo · shock minimo per Prova', required: ['valore'], ranges: { valore: [1, 2] } },
  ],
  orologio: [
    { id: 'lista', label: 'lista · orologi aperti' },
    { id: 'crea', label: 'crea · apri un orologio (Big Shot)', required: ['nome', 'calibro', 'approccio', 'tipo'] },
    { id: 'segna', label: 'segna · segna sezioni a mano (Big Shot)', required: ['nome'], ranges: { sezioni: [1, 8] } },
    { id: 'elimina', label: 'elimina · cancella un orologio (Big Shot)', required: ['nome'] },
  ],
  rischio: [
    { id: 'difficolta', label: 'difficolta · +1 Difficoltà per Rischio speso', required: ['quantita'], ranges: { quantita: [1, 10] } },
    { id: 'inseguimento', label: 'inseguimento · trasforma la svolta in inseguimento' },
    { id: 'svantaggio', label: 'svantaggio · Svantaggio alla prossima Prova' },
    { id: 'imposta', label: 'imposta · correggi il Rischio', required: ['valore'], ranges: { valore: [0, 99] } },
  ],
} as const satisfies Record<string, readonly ActionSpec[]>;

export type AreaName = keyof typeof AREAS;

/** L'azione scelta nel campo `azione`. */
export function actionOf(i: ChatInputCommandInteraction): string {
  return i.options.getString('azione', true);
}

/** Come actionOf, ma per l'autocompletamento: il campo può non essere ancora compilato. */
export function actionOfAutocomplete(i: AutocompleteInteraction): string | null {
  return i.options.getString('azione');
}

/** Messaggio d'errore se mancano opzioni o sono fuori intervallo; altrimenti null. */
export function checkAction(i: ChatInputCommandInteraction, area: AreaName): string | null {
  const id = actionOf(i);
  const spec = (AREAS[area] as readonly ActionSpec[]).find((a) => a.id === id);
  if (!spec) return 'Azione sconosciuta.';
  const missing = (spec.required ?? []).filter((name) => i.options.get(name) === null);
  if (missing.length) return `Per «${id}» manca: ${missing.map((m) => `**${m}**`).join(', ')}.`;
  for (const [name, [min, max]] of Object.entries(spec.ranges ?? {})) {
    const v = i.options.getInteger(name);
    if (v !== null && (v < min || v > max)) return `Per «${id}» **${name}** va da ${min} a ${max}.`;
  }
  return null;
}
