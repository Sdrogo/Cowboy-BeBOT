import { MAX_CARTRIDGES } from '../engine/rules.js';
import { SESSION_LABELS, THE_END_DIFFICULTY, type SessionOutcome, type SessionType, type TheEndResult } from '../engine/session.js';
import { div, renderPng, type Node } from './satori.js';
import { smallDie } from './sessionCard.js';
import { INK, LINE, MUTED, PAPER } from './theme.js';

export const END_CARD_WIDTH = 640;
const ACCENT = '#F2A900';
const RED = '#E8553A';

const mono = (size: number, color: string) => ({ fontFamily: 'Plex Mono', fontSize: size, fontWeight: 600, letterSpacing: 1.5, color });

export interface EndCardPlayer {
  name: string;
  cartridges: number;
  burdens: number;
  resolvedBurdens: number;
}

export interface EndCardData {
  type: SessionType;
  title: string;
  outcome: SessionOutcome;
  players: EndCardPlayer[];
  /** Rischio rimasto al Big Shot, perso con la fine della Session. */
  rischioLost: number;
  cartridgesCleared: boolean;
  notes: string[];
}

function playerRow(p: EndCardPlayer, cleared: boolean): Node {
  const last = p.cartridges >= MAX_CARTRIDGES;
  return div(
    { alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${LINE}` },
    div({ fontFamily: 'Bebas Neue', fontSize: 26, lineHeight: 1, color: PAPER }, p.name),
    div(
      { alignItems: 'center', gap: 16 },
      div(
        { gap: 4 },
        ...Array.from({ length: MAX_CARTRIDGES }, (_, k) =>
          div({ width: 12, height: 20, borderRadius: 3, backgroundColor: !cleared && k < p.cartridges ? (last ? RED : PAPER) : '#3A3835' }),
        ),
      ),
      div(mono(11, MUTED), `${p.burdens} FARDELL${p.burdens === 1 ? 'O' : 'I'} · ${p.resolvedBurdens} X`),
    ),
  );
}

export function endCardTree(d: EndCardData): Node {
  const positive = d.outcome === 'positiva';
  return div(
    { width: END_CARD_WIDTH, flexDirection: 'column', backgroundColor: INK, borderRadius: 12, overflow: 'hidden' },
    div(
      { padding: '22px', flexDirection: 'column', gap: 4, backgroundColor: positive ? ACCENT : RED },
      div(mono(11, INK), `${SESSION_LABELS[d.type].toUpperCase()} · ${positive ? 'POSITIVA' : 'NEGATIVA'}`),
      div({ fontFamily: 'Bebas Neue', fontSize: 52, lineHeight: 0.95, color: INK }, d.type === 'climax-1' ? 'To be continued…' : 'See you space cowboy…'),
      d.title ? div({ fontFamily: 'Plex Sans', fontWeight: 600, fontSize: 17, color: INK }, d.title) : null,
    ),
    d.players.length
      ? div(
          { padding: '10px 22px 4px', flexDirection: 'column' },
          div({ ...mono(11, MUTED), paddingTop: 6 }, d.cartridgesCleared ? 'CACCIATORI · CARTUCCE AZZERATE' : 'CACCIATORI · CARTUCCE'),
          ...d.players.map((p) => playerRow(p, d.cartridgesCleared)),
        )
      : null,
    div(
      { padding: '16px 22px', flexDirection: 'column', gap: 8 },
      div(mono(11, MUTED), 'CHIUSURA'),
      ...d.notes.map((n) =>
        div(
          { gap: 10, alignItems: 'flex-start' },
          div({ width: 8, height: 8, marginTop: 7, backgroundColor: positive ? ACCENT : RED, transform: 'rotate(45deg)' }),
          div({ flex: 1, fontFamily: 'Plex Sans', fontSize: 16, color: PAPER, lineHeight: 1.35 }, n),
        ),
      ),
    ),
    div(
      { padding: '12px 22px', borderTop: `1px solid ${LINE}`, ...mono(11, MUTED) },
      `RITMO E RISCHIO SI ESAURISCONO${d.rischioLost ? ` · ${d.rischioLost} RISCHIO NON SPESO` : ''}`,
    ),
  );
}

export function renderEndCard(d: EndCardData): Promise<Buffer> {
  return renderPng(endCardTree(d), END_CARD_WIDTH);
}

export function theEndCardTree(name: string, r: TheEndResult): Node {
  const color = r.successes === 0 ? RED : r.successes === 1 ? PAPER : ACCENT;
  return div(
    { width: END_CARD_WIDTH, flexDirection: 'column', backgroundColor: INK, borderRadius: 12, overflow: 'hidden' },
    div(
      { padding: '22px 22px 18px', flexDirection: 'column', gap: 2, borderBottom: `1px solid ${LINE}` },
      div(mono(11, MUTED), `THE END · ${name.toUpperCase()}`),
      div({ fontFamily: 'Bebas Neue', fontSize: 52, lineHeight: 0.95, color }, r.title),
    ),
    div(
      { padding: '18px 22px', alignItems: 'center', justifyContent: 'space-between' },
      div({ gap: 10, flexWrap: 'wrap', maxWidth: 420 }, ...r.dice.map((v) => smallDie(v))),
      div(
        { alignItems: 'flex-end', gap: 8 },
        div({ fontFamily: 'Bebas Neue', fontSize: 44, lineHeight: 1, color: PAPER }, String(r.sum)),
        div({ ...mono(12, MUTED), paddingBottom: 6 }, `SU ${THE_END_DIFFICULTY}`),
      ),
    ),
    div(
      { padding: '0 22px 18px', gap: 10 },
      div(mono(11, r.sum >= THE_END_DIFFICULTY ? ACCENT : MUTED), r.sum >= THE_END_DIFFICULTY ? 'DIFFICOLTÀ BATTUTA ·' : 'DIFFICOLTÀ NON BATTUTA ·'),
      div(mono(11, r.sixes >= 2 ? ACCENT : MUTED), r.sixes >= 2 ? 'DOPPIO 6 ·' : 'NIENTE DOPPIO 6 ·'),
      div(mono(11, PAPER), `${r.successes} SUCCESS${r.successes === 1 ? 'O' : 'I'}`),
    ),
    div({ padding: '14px 22px', backgroundColor: PAPER, color: INK, fontFamily: 'Plex Sans', fontWeight: 600, fontSize: 16 }, r.text),
  );
}

export function renderTheEndCard(name: string, r: TheEndResult): Promise<Buffer> {
  return renderPng(theEndCardTree(name, r), END_CARD_WIDTH);
}
