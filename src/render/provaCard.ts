import type { Die, ProvaResult } from '../engine/prova.js';
import { MAX_CARTRIDGES, TURNS } from '../engine/rules.js';
import { div, el, renderPng, svg, type Child, type Node } from './satori.js';
import { APPROACH_COLORS, INK, LINE, LINE_STRONG, MUTED, PAPER } from './theme.js';

export const CARD_WIDTH = 640;

export interface ProvaCardData {
  result: ProvaResult;
  characterName: string;
  /** Cartucce segnate dopo questa Prova, per il riepilogo. */
  cartridges: number;
  confirmed: boolean;
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const BOLT = 'M13 2 4 14h7l-1 8 9-12h-7l1-8z';
const CHECK = 'M20 6 9 17l-5-5';
const CROSS = 'M18 6 6 18M6 6l12 12';

const mono = (size: number, color: string, weight = 600) => ({
  fontFamily: 'Plex Mono',
  fontSize: size,
  fontWeight: weight,
  letterSpacing: 1.5,
  color,
});
const display = (size: number, color: string) => ({
  fontFamily: 'Bebas Neue',
  fontSize: size,
  lineHeight: 1,
  color,
});

function icon(path: string, color: string, size = 18): Node {
  return svg(
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' },
    el('path', { d: path, stroke: color, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  );
}

function dieFace(d: Die, size: number, accent: string): Node {
  const border = 3;
  const gap = Math.max(2, Math.round(size * 0.04));
  const pad = Math.round(size * 0.12);
  const cell = Math.floor((size - 2 * pad - 2 * border - 2 * gap) / 3);
  const pip = Math.round(cell * 0.7);
  const on = PIPS[d.value] ?? [];
  const color = !d.kept ? 'transparent' : d.value === 6 ? accent : d.value === 1 ? PAPER : 'transparent';
  const rows: Node[] = [0, 1, 2].map((r) =>
    div(
      { gap },
      ...[0, 1, 2].map((c) =>
        div(
          { width: cell, height: cell, alignItems: 'center', justifyContent: 'center' },
          on.includes(r * 3 + c) ? div({ width: pip, height: pip, borderRadius: pip, backgroundColor: INK }) : null,
        ),
      ),
    ),
  );
  const face = div(
    {
      boxSizing: 'border-box',
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.18),
      backgroundColor: d.kept ? PAPER : '#5E5A55',
      padding: pad,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap,
      border: `${border}px ${d.value === 1 && d.kept ? 'dashed' : 'solid'} ${color}`,
    },
    ...rows,
  );
  if (d.kept) return face;
  return div(
    { position: 'relative', width: size, height: size },
    face,
    div(
      { position: 'absolute', left: 0, top: 0, width: size, height: size },
      svg(
        { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        el('line', { x1: 4, y1: size - 4, x2: size - 4, y2: 4, stroke: PAPER, strokeWidth: 4, strokeLinecap: 'round' }),
      ),
    ),
  );
}

function dieCaption(d: Die, result: ProvaResult, accent: string): Node {
  let text = ' ';
  let color = MUTED;
  if (!d.kept) text = 'SCARTATO';
  else if (d.value === 6) {
    text = 'SEI';
    color = accent;
  } else if (d.value === 1) {
    text = result.shockPerOne === 2 ? '2 SHOCK' : '1 SHOCK';
    color = PAPER;
  }
  return div(mono(11, color), text);
}

function slot(kind: string, label: string, detail: string, on: boolean, accent: string): Node {
  const fg = on ? INK : MUTED;
  return div(
    {
      flex: 1,
      flexDirection: 'column',
      gap: 6,
      padding: 14,
      borderRadius: 10,
      backgroundColor: on ? accent : INK,
      border: `2px solid ${on ? accent : LINE_STRONG}`,
    },
    div({ alignItems: 'center', gap: 6 }, icon(on ? CHECK : CROSS, fg), div(mono(11, fg), kind)),
    div(display(24, fg), label),
    div({ fontFamily: 'Plex Sans', fontSize: 13, color: fg }, detail),
  );
}

function header(data: ProvaCardData, accent: string): Node {
  const { result } = data;
  const turn = TURNS[result.input.turn];
  const chips: Child[] = [
    div(
      { border: `1px solid ${PAPER}`, borderRadius: 999, padding: '2px 10px', fontFamily: 'Plex Sans', fontSize: 13, color: PAPER },
      data.characterName,
    ),
  ];
  if (result.mode !== 'normale') {
    chips.push(
      div(
        { backgroundColor: PAPER, borderRadius: 999, padding: '2px 10px', fontFamily: 'Plex Sans', fontWeight: 600, fontSize: 13, color: INK },
        result.mode.toUpperCase(),
      ),
    );
  }
  if (data.confirmed) {
    chips.push(
      div(
        { backgroundColor: accent, borderRadius: 999, padding: '2px 10px', fontFamily: 'Plex Sans', fontWeight: 600, fontSize: 13, color: INK },
        'CONFERMATA',
      ),
    );
  }
  return div(
    { alignItems: 'stretch' },
    div(
      { backgroundColor: accent, padding: '18px 22px 14px', flexDirection: 'column', justifyContent: 'flex-end', width: 210 },
      div(mono(11, INK), 'PROVA'),
      div({ ...display(64, INK), lineHeight: 0.9 }, result.input.approach.toUpperCase()),
    ),
    div(
      { flex: 1, padding: '18px 22px 14px', flexDirection: 'column', justifyContent: 'space-between', gap: 10 },
      div(
        { justifyContent: 'space-between' },
        div({ flexDirection: 'column', gap: 2 }, div(mono(11, MUTED), `SVOLTA ${turn.number}`), div(display(30, PAPER), turn.name)),
        div(
          { flexDirection: 'column', gap: 2, alignItems: 'flex-end' },
          div(mono(11, MUTED), 'DIFFICOLTÀ'),
          div(display(30, PAPER), String(result.input.difficulty)),
        ),
      ),
      div({ gap: 6, flexWrap: 'wrap' }, ...chips),
    ),
  );
}

function diceRow(result: ProvaResult, accent: string): Node {
  const n = result.dice.length;
  const size = n <= 6 ? 76 : n <= 9 ? 56 : 42;
  const gap = n <= 6 ? 14 : 10;
  return div(
    { padding: '24px 22px 8px', gap, flexWrap: 'wrap', alignItems: 'flex-start' },
    ...result.dice.map((d) =>
      div({ flexDirection: 'column', alignItems: 'center', gap: 8, width: size + 8 }, dieFace(d, size, accent), dieCaption(d, result, accent)),
    ),
  );
}

function meter(result: ProvaResult, accent: string): Node {
  const scale = Math.max(20, result.sum, result.input.difficulty);
  const sumPct = (result.sum / scale) * 100;
  const diffPct = (result.input.difficulty / scale) * 100;
    return div(
    { padding: '12px 22px 4px', flexDirection: 'column', gap: 8 },
    div(
      { justifyContent: 'space-between', alignItems: 'flex-end' },
      div(mono(11, MUTED), 'SOMMA DEI DADI TENUTI'),
      div({ alignItems: 'flex-end', gap: 8 }, div(display(36, PAPER), String(result.sum)), div({ ...mono(13, MUTED), paddingBottom: 6 }, `SU ${result.input.difficulty}`)),
    ),
    div(
      { position: 'relative', height: 14, backgroundColor: LINE, borderRadius: 7 },
      div({ position: 'absolute', left: 0, top: 0, height: 14, width: `${sumPct}%`, backgroundColor: accent, borderRadius: 7 }),
      div({ position: 'absolute', left: `${diffPct}%`, top: -6, width: 3, height: 26, backgroundColor: PAPER }),
    ),
    div(
      { position: 'relative', height: 16 },
      div({ ...mono(11, MUTED, 500), position: 'absolute', left: 0 }, '0'),
      div({ ...mono(11, PAPER, 500), position: 'absolute', left: `${diffPct}%` }, String(result.input.difficulty)),
      div({ ...mono(11, MUTED, 500), position: 'absolute', right: 0 }, String(scale)),
    ),
  );
}

function outcome(result: ProvaResult, accent: string): Node {
  const second = result.doubleSix
    ? slot('SUCCESSO 2', 'Doppio 6', `${result.sixes} sei tenuti`, true, accent)
    : result.pushed
      ? slot('SUCCESSO 2', 'Al limite', '+1 successo, +2 shock', true, accent)
      : slot('SUCCESSO 2', 'Doppio 6', result.sixes === 1 ? 'Un solo 6 su due' : 'Nessun 6', false, accent);
  const first = slot(
    'SUCCESSO 1',
    result.beatDifficulty ? 'Batte la Difficoltà' : 'Sotto la Difficoltà',
    `${result.sum} contro ${result.input.difficulty}`,
    result.beatDifficulty,
    accent,
  );

  const shockParts: string[] = [];
  if (result.shockFromOnes) shockParts.push(`${result.shockFromOnes} dagli 1`);
  if (result.autoShock) shockParts.push(`${result.autoShock} automatico`);
  if (result.pushed) shockParts.push('2 dal limite');
  const absorbedTxt = result.absorbed.length ? `assorbiti ${result.absorbed.length}` : null;

  const shockBox = div(
    { flex: 1, flexDirection: 'column', gap: 6, padding: 14, borderRadius: 10, backgroundColor: PAPER },
    div({ alignItems: 'center', gap: 6 }, icon(BOLT, INK), div(mono(11, INK), 'SHOCK')),
    div(
      { alignItems: 'flex-end', gap: 10 },
      result.absorbed.length
        ? div({ ...display(28, '#6B6762'), textDecoration: 'line-through' }, String(result.shocks))
        : null,
      div({ ...display(46, INK), lineHeight: 0.9 }, String(result.shocksLeft)),
    ),
    div({ fontFamily: 'Plex Sans', fontSize: 13, color: INK }, ['al Big Shot', shockParts.join(' · '), absorbedTxt].filter(Boolean).join(' · ')),
  );

  return div({ padding: '12px 22px 18px', gap: 12 }, first, second, shockBox);
}

function footer(data: ProvaCardData, accent: string): Node {
  const { result } = data;
  const pool = result.pool
    .map((p) => (p.dice >= 0 ? `${p.dice} ${p.label}` : `${p.dice} ${p.label}`))
    .join(' · ');
  const extra = result.mode === 'normale' ? '' : ` · +1 ${result.mode}`;
  const lines: Child[] = [];

  for (const b of result.bonuses) {
    lines.push(div(mono(11, accent), `+${b.successes} SUCCESSO · ${b.label.toUpperCase()}`));
  }
  for (const a of result.absorbed) {
    lines.push(
      div(
        mono(11, PAPER, 500),
        a.kind === 'ferita'
          ? `ASSORBITO · ${a.grave ? 'ferita grave' : 'ferita'} su «${a.trait}»`
          : `ASSORBITO · Cartuccia segnata (${data.cartridges}/${MAX_CARTRIDGES})`,
      ),
    );
  }
  if (data.cartridges >= MAX_CARTRIDGES) {
    lines.push(div(mono(11, accent), 'ULTIMA CARTUCCIA · LA SVOLTA TERMINA IN NEGATIVO'));
  }

  const succ = result.successes === 1 ? '1 SUCCESSO' : `${result.successes} SUCCESSI`;
  return div(
    { borderTop: `1px solid ${LINE}`, padding: '12px 22px 14px', flexDirection: 'column', gap: 6 },
    ...lines,
    div(
      { justifyContent: 'space-between', gap: 12 },
      div({ ...mono(11, MUTED, 500), flex: 1 }, `RISERVA ${result.poolSize} = ${pool}${extra}`),
      div(mono(11, accent), `${succ} · ${result.shocksLeft} SHOCK`),
    ),
  );
}

export function provaCardTree(data: ProvaCardData): Node {
  const accent = APPROACH_COLORS[data.result.input.approach];
  return div(
    { width: CARD_WIDTH, flexDirection: 'column', backgroundColor: INK, borderRadius: 12, overflow: 'hidden', color: PAPER },
    header(data, accent),
    diceRow(data.result, accent),
    meter(data.result, accent),
    outcome(data.result, accent),
    footer(data, accent),
  );
}

export function renderProvaCard(data: ProvaCardData): Promise<Buffer> {
  return renderPng(provaCardTree(data), CARD_WIDTH);
}
