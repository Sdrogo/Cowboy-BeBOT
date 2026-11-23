/**
 * Motore delle Prove (manuale pp. 17-22).
 *
 * Le funzioni sono pure: il tiro dei dadi è separato dalla valutazione,
 * così i test possono valutare risultati noti (es. gli esempi del manuale).
 */
import { MAX_DICE, type Approach, type GrooveId, type TurnNumber } from './rules.js';

export type Rng = () => number;

export const d6 = (rng: Rng): number => 1 + Math.floor(rng() * 6);

export type RollMode = 'normale' | 'vantaggio' | 'svantaggio';

export interface ProvaInput {
  turn: TurnNumber;
  difficulty: number;
  approach: Approach;
  /** Nomi dei tratti usati nella descrizione (già validati). Ognuno vale +1 dado. */
  traits: string[];
  /** Session Classica con tratti dell'Approccio del Genere: +1 dado. */
  genre: boolean;
  /** Cartucce segnate con "farsi coinvolgere": +2 dadi ciascuna. */
  cartridges: number;
  advantage: boolean;
  disadvantage: boolean;
  /** Modificatore libero ai dadi (Groove delle Taglie, regole della casa...). */
  modifier: number;
  /** Shock minimo per Prova: 1, oppure 2 con un orologio minaccia Dance chiuso (p. 25). */
  minShock: number;
  groove: GrooveId | null;
  /** Le Cartucce di "farsi coinvolgere" sono pagate con Ritmo invece di segnarle (Personale, Filler, Climax 2). */
  ritmoInstead?: boolean;
}

export interface PoolPart {
  label: string;
  dice: number;
}

export interface Die {
  value: number;
  kept: boolean;
  /** Piani a Lungo Termine: dado tolto dal tiro e conservato per una Prova successiva. */
  aside?: boolean;
  /** Piani a Lungo Termine: dado conservato in precedenza, aggiunto a questo tiro. */
  fromPlan?: boolean;
  /** Fuori dagli Schemi: dado trasformato in un 6 (spendendo uno shock); `was` è il valore tirato. */
  boosted?: boolean;
  was?: number;
  /** Aggiustatutto: nuovo tiro del dado scartato con Svantaggio. */
  retry?: number;
  /** Aggiustatutto: il nuovo dado è stato tenuto (sostituisce lo scartato) o rifiutato. */
  retryDecided?: boolean;
}

export interface Absorption {
  kind: 'ferita' | 'cartuccia';
  /** Tratto ferito, per kind === 'ferita'. */
  trait?: string;
  /** Ferita grave (tratti del MONO). */
  grave?: boolean;
  /** Per kind === 'cartuccia': pagata con un Ritmo invece di segnare la Cartuccia. */
  ritmo?: boolean;
}

export interface ProvaResult {
  input: ProvaInput;
  pool: PoolPart[];
  /** Dadi della riserva, prima del dado extra di Vantaggio/Svantaggio. */
  poolSize: number;
  mode: RollMode;
  dice: Die[];
  sum: number;
  beatDifficulty: boolean;
  sixes: number;
  doubleSix: boolean;
  /** Successi ottenuti dai dadi (0-2). */
  diceSuccesses: number;
  ones: number;
  shockPerOne: number;
  shockFromOnes: number;
  /** Shock aggiunti per arrivare al minimo (di solito 1). */
  autoShock: number;
  pushed: boolean;
  bonuses: { label: string; successes: number }[];
  successes: number;
  /** Shock prodotti dalla Prova, prima di assorbirli. */
  shocks: number;
  /** Shock pagati con Fuori dagli Schemi (già inclusi in `shocks`). */
  grooveShocks: number;
  absorbed: Absorption[];
  /** Shock rimasti al Big Shot dopo l'assorbimento. */
  shocksLeft: number;
}

export function rollMode(input: Pick<ProvaInput, 'advantage' | 'disadvantage'>): RollMode {
  if (input.advantage && !input.disadvantage) return 'vantaggio';
  if (input.disadvantage && !input.advantage) return 'svantaggio';
  return 'normale';
}

export function buildPool(input: ProvaInput): PoolPart[] {
  const parts: PoolPart[] = [{ label: `svolta ${input.turn}`, dice: input.turn }];
  for (const trait of input.traits) parts.push({ label: trait, dice: 1 });
  if (input.genre) parts.push({ label: `Genere ${input.approach}`, dice: 1 });
  if (input.cartridges > 0) {
    const unit = input.ritmoInstead ? 'Ritmo' : 'Cartuccia';
    parts.push({
      label: input.cartridges === 1 ? unit : input.ritmoInstead ? `da ${input.cartridges} Ritmo` : `da ${input.cartridges} Cartucce`,
      dice: 2 * input.cartridges,
    });
  }
  if (input.modifier !== 0) parts.push({ label: 'modificatore', dice: input.modifier });
  return parts;
}

export function poolSize(parts: PoolPart[]): number {
  const total = parts.reduce((acc, p) => acc + p.dice, 0);
  return Math.max(1, Math.min(MAX_DICE, total));
}

/** Tira i dadi della Prova e scarta quello di Vantaggio/Svantaggio. */
export function rollDice(input: ProvaInput, rng: Rng = Math.random): Die[] {
  const mode = rollMode(input);
  const count = poolSize(buildPool(input)) + (mode === 'normale' ? 0 : 1);
  const values = Array.from({ length: count }, () => d6(rng));
  return markKept(values, mode);
}

/** Con Vantaggio scarta il dado più basso, con Svantaggio il più alto (p. 19). */
export function markKept(values: number[], mode: RollMode): Die[] {
  const dice = values.map((value) => ({ value, kept: true }));
  if (mode === 'normale' || dice.length < 2) return dice;
  let idx = 0;
  dice.forEach((d, i) => {
    const cur = dice[idx]!;
    if (mode === 'vantaggio' ? d.value < cur.value : d.value > cur.value) idx = i;
  });
  dice[idx]!.kept = false;
  return dice;
}

export interface EvaluateOptions {
  pushed?: boolean;
  absorbed?: Absorption[];
}

/** Calcola successi e shock a partire dai dadi tirati (pp. 19-21). */
export function evaluate(input: ProvaInput, dice: Die[], opts: EvaluateOptions = {}): ProvaResult {
  const pool = buildPool(input);
  const mode = rollMode(input);
  const kept = dice.filter((d) => d.kept).map((d) => d.value);

  const sum = kept.reduce((a, b) => a + b, 0);
  const beatDifficulty = sum >= input.difficulty;
  const sixes = kept.filter((v) => v === 6).length;
  const doubleSix = sixes >= 2;
  const diceSuccesses = (beatDifficulty ? 1 : 0) + (doubleSix ? 1 : 0);

  const ones = kept.filter((v) => v === 1).length;
  // Let's Jam!: ogni 1 genera due shock (p. 35).
  const shockPerOne = input.turn === 3 ? 2 : 1;
  const shockFromOnes = ones * shockPerOne;
  // Ogni Prova produce almeno uno shock (p. 19), due con l'orologio minaccia Dance (p. 25).
  const autoShock = Math.max(0, input.minShock - shockFromOnes);

  // Spingersi al limite: +1 successo per 2 shock, solo senza già 2 successi (p. 21).
  const pushed = Boolean(opts.pushed) && diceSuccesses < 2;

  const bonuses: ProvaResult['bonuses'] = [];
  if (input.groove === 'contro-ogni-previsione' && mode === 'svantaggio' && hasPairOneToFive(kept)) {
    bonuses.push({ label: 'Contro Ogni Previsione', successes: 1 });
  }

  const successes = diceSuccesses + (pushed ? 1 : 0) + bonuses.reduce((a, b) => a + b.successes, 0);
  const grooveShocks = dice.filter((d) => d.boosted).length;
  const shocks = shockFromOnes + autoShock + (pushed ? 2 : 0) + grooveShocks;
  const absorbed = (opts.absorbed ?? []).slice(0, maxAbsorb(shocks));

  return {
    input,
    pool,
    poolSize: poolSize(pool),
    mode,
    dice,
    sum,
    beatDifficulty,
    sixes,
    doubleSix,
    diceSuccesses,
    ones,
    shockPerOne,
    shockFromOnes,
    autoShock,
    pushed,
    bonuses,
    successes,
    shocks,
    grooveShocks,
    absorbed,
    shocksLeft: shocks - absorbed.length,
  };
}

function hasPairOneToFive(values: number[]): boolean {
  const seen = new Set<number>();
  for (const v of values) {
    if (v >= 1 && v <= 5) {
      if (seen.has(v)) return true;
      seen.add(v);
    }
  }
  return false;
}

/** Si possono assorbire al massimo 2 shock: uno con una ferita, uno con una Cartuccia (p. 19). */
export function maxAbsorb(shocks: number): number {
  return Math.min(2, shocks);
}

export function canPush(result: ProvaResult): boolean {
  return !result.pushed && result.diceSuccesses < 2 && result.absorbed.length === 0;
}

export function canAbsorb(result: ProvaResult, kind: Absorption['kind']): boolean {
  if (result.shocksLeft <= 0) return false;
  if (result.absorbed.some((a) => a.kind === kind)) return false;
  if (kind === 'ferita' && result.input.traits.length === 0) return false;
  return true;
}

/**
 * Piani a Lungo Termine (p. 71): subito dopo il tiro si toglie un dado e lo si
 * conserva. Non si può più fare dopo aver assorbito o spinto, né aggiungendo
 * il dado conservato nella stessa Prova.
 */
export function canSetAside(result: ProvaResult): boolean {
  if (result.pushed || result.absorbed.length > 0) return false;
  return !result.dice.some((d) => d.aside || d.fromPlan);
}

/** Toglie il dado `index` dal tiro (non conta più) e restituisce il suo valore. */
export function setAside(result: ProvaResult, index: number): { result: ProvaResult; value: number } | null {
  const die = result.dice[index];
  if (!die || !die.kept || !canSetAside(result)) return null;
  const dice = result.dice.map((d, k) => (k === index ? { ...d, kept: false, aside: true } : d));
  return { result: evaluate(result.input, dice, { pushed: result.pushed, absorbed: result.absorbed }), value: die.value };
}

/** Un dado conservato si può aggiungere una volta per Prova, e non se se ne è appena messo uno da parte. */
export function canAddPlanned(result: ProvaResult): boolean {
  return !result.dice.some((d) => d.aside || d.fromPlan);
}

/** Aggiunge al tiro il dado conservato, con il valore che aveva (p. 71). */
export function addPlanned(result: ProvaResult, value: number): ProvaResult {
  if (!canAddPlanned(result)) return result;
  const dice = [...result.dice, { value, kept: true, fromPlan: true }];
  return evaluate(result.input, dice, { pushed: result.pushed, absorbed: result.absorbed });
}

// --- Groove con scelte dopo il tiro (p. 72) ---

const untouched = (r: ProvaResult) => !r.pushed && r.absorbed.length === 0;

/** Fuori dagli Schemi: subito dopo il tiro, uno shock per trasformare un dado da 2-5 in un 6. */
export function canBoost(result: ProvaResult): boolean {
  if (result.input.groove !== 'fuori-dagli-schemi' || !untouched(result)) return false;
  if (result.dice.some((d) => d.boosted)) return false;
  return result.dice.some((d) => d.kept && !d.aside && d.value >= 2 && d.value <= 5);
}

export function boostDie(result: ProvaResult, index: number): ProvaResult {
  const die = result.dice[index];
  if (!die || !canBoost(result) || !die.kept || die.aside || die.value < 2 || die.value > 5) return result;
  const dice = result.dice.map((d, k) => (k === index ? { ...d, value: 6, boosted: true, was: d.value } : d));
  return evaluate(result.input, dice, { pushed: result.pushed, absorbed: result.absorbed });
}

/** Il dado scartato dallo Svantaggio, se c'è ed è ancora da ritirare. */
const discardedIndex = (result: ProvaResult) => result.dice.findIndex((d) => !d.kept && !d.aside && d.retry === undefined);

/** Aggiustatutto: con Svantaggio si può tirare di nuovo il dado rimosso (p. 72). */
export function canRetry(result: ProvaResult): boolean {
  return result.input.groove === 'aggiustatutto' && result.mode === 'svantaggio' && untouched(result) && discardedIndex(result) >= 0;
}

export function retryDie(result: ProvaResult, rng: Rng = Math.random): ProvaResult {
  const index = discardedIndex(result);
  if (!canRetry(result)) return result;
  const dice = result.dice.map((d, k) => (k === index ? { ...d, retry: d6(rng) } : d));
  return evaluate(result.input, dice, { pushed: result.pushed, absorbed: result.absorbed });
}

/** Il nuovo dado aspetta una scelta: tenerlo nel risultato o lasciarlo perdere. */
export function retryPending(result: ProvaResult): boolean {
  return result.dice.some((d) => !d.kept && d.retry !== undefined && !d.retryDecided);
}

/** Tiene il nuovo dado al posto di quello scartato, oppure lo rifiuta. */
export function decideRetry(result: ProvaResult, keep: boolean): ProvaResult {
  const index = result.dice.findIndex((d) => !d.kept && d.retry !== undefined && !d.retryDecided);
  if (index < 0) return result;
  const dice = result.dice.map((d, k) =>
    k !== index ? d : keep ? { ...d, value: d.retry!, kept: true, was: d.value, retryDecided: true } : { ...d, retryDecided: true },
  );
  return evaluate(result.input, dice, { pushed: result.pushed, absorbed: result.absorbed });
}

export function rollProva(input: ProvaInput, rng: Rng = Math.random): ProvaResult {
  return evaluate(input, rollDice(input, rng));
}

export function push(result: ProvaResult): ProvaResult {
  return evaluate(result.input, result.dice, { pushed: true, absorbed: result.absorbed });
}

export function absorb(result: ProvaResult, absorption: Absorption): ProvaResult {
  if (!canAbsorb(result, absorption.kind)) return result;
  return evaluate(result.input, result.dice, {
    pushed: result.pushed,
    absorbed: [...result.absorbed, absorption],
  });
}
