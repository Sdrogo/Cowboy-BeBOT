/**
 * Tipi di Session, risorse di inizio Session, orologi ed effetti delle minacce
 * (manuale pp. 23-26 e 29-53).
 */
import { MAX_CARTRIDGES, MAX_RITMO, type Approach } from './rules.js';

export const SESSION_TYPES = ['classica', 'personale', 'filler', 'climax-1', 'climax-2'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_LABELS: Record<SessionType, string> = {
  classica: 'Session Classica',
  personale: 'Session Personale',
  filler: 'Filler',
  'climax-1': 'Climax · prima Session',
  'climax-2': 'Climax · seconda Session',
};

export function isSessionType(v: string): v is SessionType {
  return (SESSION_TYPES as readonly string[]).includes(v);
}

/** Ciò che serve sapere di un CT per calcolare Ritmo e Rischio. */
export interface PlayerSheet {
  cartridges: number;
  burdens: { resolved: boolean }[];
}

/**
 * Ritmo iniziale di un CT.
 * - Classica: 1D6 (`roll`).
 * - Personale e Climax 2: uno per Cartuccia segnata (p. 42, p. 52).
 * - Filler: uno per Cartuccia libera e uno per Fardello (p. 47).
 * - Climax 1: tre, più due per Fardello (p. 52).
 */
export function startingRitmo(type: SessionType, p: PlayerSheet, roll: number): number {
  switch (type) {
    case 'classica':
      return roll;
    case 'personale':
    case 'climax-2':
      return p.cartridges;
    case 'filler':
      return MAX_CARTRIDGES - p.cartridges + p.burdens.length;
    case 'climax-1':
      return 3 + 2 * p.burdens.length;
  }
}

/** La Classica tira il Ritmo con 1D6: il massimo è comunque 6 (p. 40). */
export const clampRitmo = (v: number) => Math.max(0, Math.min(MAX_RITMO, v));

/**
 * Rischio del Big Shot a inizio Session, dato il Ritmo già calcolato dei CT.
 * - Classica: uno per giocatore, Big Shot compreso (p. 40).
 * - Personale e Climax 2: pari al Ritmo di tutti i CT (p. 42, p. 52).
 * - Filler: uno per ogni Cartuccia segnata dei CT, minimo uno (p. 47).
 * - Climax 1: uno per giocatore, più due per Fardello senza X (p. 52).
 */
export function startingRischio(type: SessionType, players: PlayerSheet[], ritmo: number[]): number {
  const giocatori = players.length + 1;
  switch (type) {
    case 'classica':
      return giocatori;
    case 'personale':
    case 'climax-2':
      return ritmo.reduce((a, b) => a + b, 0);
    case 'filler':
      return Math.max(1, players.reduce((a, p) => a + p.cartridges, 0));
    case 'climax-1':
      return giocatori + 2 * players.reduce((a, p) => a + p.burdens.filter((b) => !b.resolved).length, 0);
  }
}

/** Nella Classica il Genere lo scelgono i CT se qualcuno tira 6 al Ritmo (p. 41). */
export const genreChosenByPlayers = (type: SessionType, rolls: number[]) => type === 'classica' && rolls.includes(6);

// --- Orologi ---

export const CLOCK_SIZES = [4, 6, 8] as const;
export const CLOCK_KINDS = ['obiettivo', 'minaccia', 'inseguimento', 'altro'] as const;
export type ClockKind = (typeof CLOCK_KINDS)[number];

export interface Clock {
  id: number;
  channelId: string;
  name: string;
  size: number;
  approach: Approach;
  kind: ClockKind;
  marks: number;
  closed: boolean;
}

export type MarkSource = { by: 'successo'; approach: Approach } | { by: 'shock' } | { by: 'manuale' };

export type MarkCheck = { ok: true; closes: boolean } | { ok: false; reason: string };

/**
 * Un orologio si segna con successi o shock. L'ultima sezione segnata con un
 * successo deve venire da una Prova con lo stesso Approccio dell'orologio;
 * gli shock non hanno questo vincolo (p. 23).
 */
export function checkMark(clock: Clock, source: MarkSource): MarkCheck {
  if (clock.closed) return { ok: false, reason: `L'orologio «${clock.name}» è già chiuso.` };
  const closes = clock.marks + 1 >= clock.size;
  if (closes && source.by === 'successo' && source.approach !== clock.approach) {
    return {
      ok: false,
      reason: `L'ultima sezione di «${clock.name}» va segnata con un successo di una Prova ${clock.approach}.`,
    };
  }
  return { ok: true, closes };
}

/** Effetti da applicare nella svolta successiva alla chiusura di un orologio minaccia. */
export interface TurnEffects {
  minShock?: number;
  difficultyBonus?: number;
  difficultyLocked?: boolean;
  bluesLimit?: boolean;
}

export interface ThreatOutcome {
  /** Testo dell'effetto, da mostrare al tavolo. */
  text: string;
  effects: TurnEffects;
}

/** Cosa succede quando si chiude un orologio minaccia, per Approccio (p. 25). */
export function threatOutcome(approach: Approach): ThreatOutcome {
  switch (approach) {
    case 'Rock':
      return { text: 'Imminente sventura: ogni CT ferisce un tratto e racconta come.', effects: {} };
    case 'Dance':
      return { text: 'Il carburante finisce: nella prossima svolta ogni Prova produce almeno 2 shock.', effects: { minShock: 2 } };
    case 'Blues':
      return {
        text: 'Sale sulle ferite: nella prossima svolta *mostrare le ferite* ne rimuove una sola.',
        effects: { bluesLimit: true },
      };
    case 'Tango':
      return { text: 'Tradimento: un personaggio cambia schieramento e agisce contro i CT.', effects: {} };
    case 'Jazz':
      return {
        text: 'Complicazioni inaspettate: nella prossima svolta la Difficoltà sale di 3 e non si può ridurre.',
        effects: { difficultyBonus: 3, difficultyLocked: true },
      };
  }
}

// --- Fine Session ---

export type SessionOutcome = 'positiva' | 'negativa';

/** Personale e seconda Session del Climax cancellano i segni sulle Cartucce (p. 42, p. 52). */
export const clearsCartridges = (type: SessionType) => type === 'personale' || type === 'climax-2';

/**
 * Cosa possono fare i CT in chiusura, per tipo di Session:
 * See You Space Cowboy… (p. 38) o la Chiusura del tipo speciale (pp. 44, 49, 51, 53).
 */
export function closingNotes(type: SessionType, outcome: SessionOutcome, lastCartridge: boolean): string[] {
  switch (type) {
    case 'classica': {
      const out: string[] = [];
      if (outcome === 'positiva') out.push("Chi ha contribuito al successo può prendere un nuovo tratto o cambiare l'Approccio di uno esistente.");
      if (outcome === 'negativa' || lastCartridge) out.push('Almeno un CT scrive il titolo della Session come Fardello sotto il Ricordo.');
      if (lastCartridge) out.push("Di solito il Fardello lo prende chi ha segnato l'ultima Cartuccia. La prossima è una Session Personale.");
      return out;
    }
    case 'personale':
      return outcome === 'positiva'
        ? ['Il CT sotto i riflettori può segnare una X vicino al Fardello usato nella Session.', 'Le Cartucce di tutti tornano libere.']
        : ['Nessuna X sui Fardelli questa volta.', 'Le Cartucce di tutti tornano libere.'];
    case 'filler':
      return [
        'Ogni CT può spostare un tratto in un altro Approccio, rinominare un Fardello o cambiare un tratto.',
        'Ogni svolta negativa o attività fallita cancella una di queste azioni per tutti.',
      ];
    case 'climax-1':
      return ['Cliffhanger: il cattivo rivela il secondo Segreto. Niente Chiusura, il seguito è nella prossima Session.'];
    case 'climax-2': {
      const out = ['Ogni CT può cambiare il Groove del suo personaggio.', 'Le Cartucce di tutti tornano libere.'];
      if (outcome === 'positiva') out.unshift('Ogni CT può segnare una X vicino a un Fardello appropriato.');
      out.push('Se era il finale di stagione, è il momento di The End.');
      return out;
    }
  }
}

export interface TheEndResult {
  dice: number[];
  sum: number;
  sixes: number;
  successes: number;
  title: string;
  text: string;
}

export const THE_END_DIFFICULTY = 10;

/** The End: 1D6 più 1D6 per Fardello con la X, contro Difficoltà 10 (p. 54). */
export function theEnd(dice: number[]): TheEndResult {
  const sum = dice.reduce((a, b) => a + b, 0);
  const sixes = dice.filter((d) => d === 6).length;
  const successes = (sum >= THE_END_DIFFICULTY ? 1 : 0) + (sixes >= 2 ? 1 : 0);
  const verdicts = [
    { title: 'Schiacciato dal passato', text: 'Il personaggio muore o ricade nelle vecchie abitudini.' },
    { title: 'Venuto a patti', text: 'Non sarà mai davvero libero, ma la situazione sembra migliorare.' },
    { title: 'Finalmente libero', text: 'Il suo sentiero è tracciato e lo porterà lontano, nel bene e nel male.' },
  ];
  return { dice, sum, sixes, successes, ...verdicts[successes]! };
}

export function rollTheEnd(resolvedBurdens: number, rng: () => number = Math.random): TheEndResult {
  return theEnd(Array.from({ length: 1 + resolvedBurdens }, () => 1 + Math.floor(rng() * 6)));
}
