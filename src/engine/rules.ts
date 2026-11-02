/**
 * Costanti di regolamento di Cowboy Bebop - Il Gioco di Ruolo (manuale base ITA).
 * I riferimenti di pagina sono quelli stampati sul manuale.
 */

export const APPROACHES = ['Rock', 'Dance', 'Blues', 'Tango', 'Jazz'] as const;
export type Approach = (typeof APPROACHES)[number];

export function isApproach(value: string): value is Approach {
  return (APPROACHES as readonly string[]).includes(value);
}

/** I tratti del MONO Racer vivono in esagoni a parte (p. 59). */
export type TraitSlot = Approach | 'MONO';

export type TurnNumber = 1 | 2 | 3;

export interface TurnInfo {
  number: TurnNumber;
  name: string;
  /** Difficoltà iniziale della svolta (p. 34). */
  startDifficulty: number;
}

export const TURNS: Record<TurnNumber, TurnInfo> = {
  1: { number: 1, name: 'G.E.S.T.', startDifficulty: 5 },
  2: { number: 2, name: '3, 2, 1…', startDifficulty: 10 },
  3: { number: 3, name: "Let's Jam!", startDifficulty: 15 },
};

/** Ogni Personaggio ha 6 Cartucce nel tamburo (p. 69). */
export const MAX_CARTRIDGES = 6;
/** Massimo Ritmo a inizio Session (p. 40). */
export const MAX_RITMO = 6;
/** Massimo tratti per Approccio sulla scheda (p. 59) e per il MONO. */
export const TRAITS_PER_SLOT = 3;
/** Tetto tecnico ai dadi di una Prova (scelta di progetto, non del manuale). */
export const MAX_DICE = 20;

export const GROOVE_IDS = [
  'contro-ogni-previsione',
  'piu-rapido-di-uno-sguardo',
  'lupo-solitario',
  'piani-a-lungo-termine',
  'artista-della-fuga',
  'vestigia-della-guerra',
  'specchio-dell-anima',
  'fuori-dagli-schemi',
  'aggiustatutto',
  'testa-dura',
  'di-necessita-virtu',
] as const;
export type GrooveId = (typeof GROOVE_IDS)[number];

export interface GrooveInfo {
  id: GrooveId;
  name: string;
  /** Groove che permettono di usare i tratti di un Approccio in Prove di altri due (pp. 71-73). */
  borrows?: { from: Approach; into: readonly Approach[] };
  summary: string;
}

export const GROOVES: Record<GrooveId, GrooveInfo> = {
  'contro-ogni-previsione': {
    id: 'contro-ogni-previsione',
    name: 'Contro Ogni Previsione',
    summary: 'Con Svantaggio, +1 successo se escono due dadi uguali tra 1 e 5.',
  },
  'piu-rapido-di-uno-sguardo': {
    id: 'piu-rapido-di-uno-sguardo',
    name: 'Più Rapido di uno Sguardo',
    borrows: { from: 'Jazz', into: ['Dance', 'Rock'] },
    summary: 'Puoi usare tratti Jazz in Prove Dance e Rock.',
  },
  'lupo-solitario': {
    id: 'lupo-solitario',
    name: 'Lupo Solitario',
    borrows: { from: 'Rock', into: ['Blues', 'Jazz'] },
    summary: 'Puoi usare tratti Rock in Prove Blues e Jazz.',
  },
  'piani-a-lungo-termine': {
    id: 'piani-a-lungo-termine',
    name: 'Piani a Lungo Termine',
    summary: 'Dopo il tiro puoi mettere da parte un dado e aggiungerlo a una Prova successiva.',
  },
  'artista-della-fuga': {
    id: 'artista-della-fuga',
    name: 'Artista della Fuga',
    borrows: { from: 'Tango', into: ['Dance', 'Jazz'] },
    summary: 'Puoi usare tratti Tango in Prove Dance e Jazz.',
  },
  'vestigia-della-guerra': {
    id: 'vestigia-della-guerra',
    name: 'Vestigia della Guerra',
    borrows: { from: 'Blues', into: ['Tango', 'Rock'] },
    summary: 'Puoi usare tratti Blues in Prove Tango e Rock.',
  },
  'specchio-dell-anima': {
    id: 'specchio-dell-anima',
    name: "Specchio dell'Anima",
    borrows: { from: 'Dance', into: ['Tango', 'Blues'] },
    summary: 'Puoi usare tratti Dance in Prove Tango e Blues.',
  },
  'fuori-dagli-schemi': {
    id: 'fuori-dagli-schemi',
    name: 'Fuori dagli Schemi',
    summary: 'Dopo il tiro, +1 shock per trasformare un dado da 2 a 5 in un 6.',
  },
  aggiustatutto: {
    id: 'aggiustatutto',
    name: 'Aggiustatutto',
    summary: 'Con Svantaggio puoi ritirare il dado scartato e tenerlo.',
  },
  'testa-dura': {
    id: 'testa-dura',
    name: 'Testa Dura',
    summary: "Con Svantaggio puoi usare i tratti feriti dell'Approccio.",
  },
  'di-necessita-virtu': {
    id: 'di-necessita-virtu',
    name: 'Di Necessità Virtù',
    summary: 'Al posto di un tratto ferito puoi usare un tratto in un esagono adiacente.',
  },
};

export function isGrooveId(value: string): value is GrooveId {
  return (GROOVE_IDS as readonly string[]).includes(value);
}

/** Approcci i cui tratti sono utilizzabili in una Prova con l'Approccio dato. */
export function usableTraitSlots(approach: Approach, groove: GrooveId | null): TraitSlot[] {
  const slots: TraitSlot[] = [approach];
  const borrow = groove ? GROOVES[groove].borrows : undefined;
  if (borrow && borrow.into.includes(approach)) slots.push(borrow.from);
  return slots;
}
