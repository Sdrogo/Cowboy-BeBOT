import { SESSION_LABELS, type SessionType } from '../engine/session.js';
import { MAX_RITMO, type Approach } from '../engine/rules.js';
import { div, renderPng, type Node } from './satori.js';
import { APPROACH_COLORS, INK, LINE, MUTED, PAPER } from './theme.js';

export const SESSION_CARD_WIDTH = 640;

export interface SessionCardPlayer {
  name: string;
  roll: number | null;
  ritmo: number;
}

export interface SessionCardData {
  type: SessionType;
  title: string;
  players: SessionCardPlayer[];
  rischio: number;
  genre: Approach | null;
  /** Nella Classica un 6 al Ritmo fa scegliere il Genere ai CT. */
  genreByPlayers: boolean;
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const mono = (size: number, color: string) => ({ fontFamily: 'Plex Mono', fontSize: size, fontWeight: 600, letterSpacing: 1.5, color });

function smallDie(value: number): Node {
  const on = PIPS[value] ?? [];
  return div(
    { width: 44, height: 44, borderRadius: 9, backgroundColor: PAPER, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2 },
    ...[0, 1, 2].map((r) =>
      div(
        { gap: 2 },
        ...[0, 1, 2].map((c) =>
          div(
            { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
            on.includes(r * 3 + c) ? div({ width: 7, height: 7, borderRadius: 7, backgroundColor: INK }) : null,
          ),
        ),
      ),
    ),
  );
}

function playerTile(p: SessionCardPlayer): Node {
  const top = p.roll === 6;
  const fg = top ? INK : PAPER;
  return div(
    { width: 186, boxSizing: 'border-box', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 10, backgroundColor: top ? '#F2A900' : '#1E1D1B' },
    div(
      { justifyContent: 'space-between', alignItems: 'center' },
      div({ fontFamily: 'Bebas Neue', fontSize: 24, lineHeight: 1, color: fg }, p.name),
      p.roll !== null ? smallDie(p.roll) : null,
    ),
    div(
      { gap: 4 },
      ...Array.from({ length: MAX_RITMO }, (_, k) =>
        div({ flex: 1, height: 10, borderRadius: 3, backgroundColor: k < p.ritmo ? fg : top ? '#C98C00' : '#3A3835' }),
      ),
    ),
    div(mono(12, fg), `${p.ritmo} RITMO${p.ritmo >= MAX_RITMO ? ' · MAX' : ''}`),
  );
}

export function sessionCardTree(d: SessionCardData): Node {
  return div(
    { width: SESSION_CARD_WIDTH, flexDirection: 'column', backgroundColor: INK, borderRadius: 12, overflow: 'hidden' },
    div(
      { padding: '22px 22px 18px', flexDirection: 'column', gap: 2, borderBottom: `1px solid ${LINE}` },
      div(mono(11, MUTED), `${SESSION_LABELS[d.type].toUpperCase()} · INIZIO`),
      div({ fontFamily: 'Bebas Neue', fontSize: 52, lineHeight: 0.95, color: PAPER }, d.title || 'Ready?'),
    ),
    d.players.length
      ? div({ padding: '18px 22px', gap: 12, flexWrap: 'wrap' }, ...d.players.map(playerTile))
      : div({ padding: '22px', fontFamily: 'Plex Sans', fontSize: 15, color: MUTED }, 'Nessun Cacciatore di Taglie al tavolo: premete «Mi unisco».'),
    d.genre
      ? div(
          { margin: '0 22px', padding: '12px 16px', borderRadius: 10, border: `2px solid ${APPROACH_COLORS[d.genre]}`, alignItems: 'center', gap: 12 },
          div(mono(11, MUTED), 'GENERE'),
          div({ fontFamily: 'Bebas Neue', fontSize: 28, lineHeight: 1, color: APPROACH_COLORS[d.genre] }, d.genre),
        )
      : d.genreByPlayers
        ? div(
            { margin: '0 22px', padding: '12px 16px', borderRadius: 10, border: '2px solid #F2A900', fontFamily: 'Bebas Neue', fontSize: 26, color: PAPER },
            'È uscito un 6: i Cacciatori scelgono il Genere',
          )
        : null,
    div(
      { padding: '18px 22px 22px', alignItems: 'center', gap: 14 },
      div(mono(11, MUTED), 'RISCHIO DEL BIG SHOT'),
      div(
        { gap: 8, flexWrap: 'wrap', maxWidth: 300 },
        ...Array.from({ length: Math.min(d.rischio, 20) }, () =>
          div({ width: 16, height: 16, backgroundColor: '#E8553A', transform: 'rotate(45deg)' }),
        ),
      ),
      div({ fontFamily: 'Bebas Neue', fontSize: 32, lineHeight: 1, color: PAPER }, String(d.rischio)),
    ),
  );
}

export function renderSessionCard(d: SessionCardData): Promise<Buffer> {
  return renderPng(sessionCardTree(d), SESSION_CARD_WIDTH);
}
