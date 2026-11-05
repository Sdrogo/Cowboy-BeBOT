import type { Clock } from '../engine/session.js';
import { div, el, renderPng, svg, type Node } from './satori.js';
import { INK, LINE, MUTED, NEGATIVE_CLOCK_COLORS, PAPER, POSITIVE_CLOCK_COLORS } from './theme.js';

export const CLOSED_CARD_WIDTH = 640;

const mono = (size: number, color: string) => ({ fontFamily: 'Plex Mono', fontSize: size, fontWeight: 600, letterSpacing: 1.5, color });

export interface ClockClosedData {
  clock: Clock;
  /** Titolo grande, es. OBIETTIVO RAGGIUNTO. */
  headline: string;
  /** Riga sotto il titolo, es. LA SVOLTA FINISCE IN POSITIVO. */
  verdict: string;
  /** Spiegazione o effetto in chiaro. */
  detail: string;
}

/** Colore dominante: rosso per le minacce, verde per il resto. */
export function closedColor(clock: Clock): string {
  return clock.kind === 'minaccia' ? NEGATIVE_CLOCK_COLORS[0]! : POSITIVE_CLOCK_COLORS[0]!;
}

/** Orologio completo, con le sezioni tutte piene e un anello esterno. */
function fullPie(clock: Clock, color: string, diameter: number): Node {
  const r = 44;
  const paths: Node[] = [el('circle', { cx: 50, cy: 50, r: 49, fill: 'none', stroke: color, strokeWidth: 1.5 })];
  for (let k = 0; k < clock.size; k++) {
    const a0 = ((-90 + (k * 360) / clock.size) * Math.PI) / 180;
    const a1 = ((-90 + ((k + 1) * 360) / clock.size) * Math.PI) / 180;
    const p = (a: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    paths.push(el('path', { d: `M50 50 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`, fill: color, stroke: INK, strokeWidth: 3 }));
  }
  return svg({ width: diameter, height: diameter, viewBox: '0 0 100 100' }, ...paths);
}

export function clockClosedTree(d: ClockClosedData): Node {
  const color = closedColor(d.clock);
  return div(
    { width: CLOSED_CARD_WIDTH, flexDirection: 'column', backgroundColor: INK, borderRadius: 12, overflow: 'hidden', color: PAPER },
    div(
      { backgroundColor: color, padding: '10px 22px', justifyContent: 'space-between' },
      div(mono(12, INK), 'OROLOGIO CHIUSO'),
      div(mono(12, INK), `${d.clock.kind.toUpperCase()} · ${d.clock.approach.toUpperCase()}`),
    ),
    div(
      { padding: '26px 22px 20px', gap: 24, alignItems: 'center' },
      fullPie(d.clock, color, 170),
      div(
        { flexDirection: 'column', flex: 1, gap: 6 },
        div({ fontFamily: 'Bebas Neue', fontSize: 62, lineHeight: 0.95, color }, d.headline),
        div({ fontFamily: 'Bebas Neue', fontSize: 34, lineHeight: 1, color: PAPER }, d.clock.name),
        div(mono(12, MUTED), `${d.clock.size} / ${d.clock.size} SEZIONI`),
      ),
    ),
    div(
      { flexDirection: 'column', gap: 6, padding: '14px 22px 18px', borderTop: `1px solid ${LINE}` },
      div(mono(13, color), d.verdict.toUpperCase()),
      d.detail ? div({ fontFamily: 'Plex Sans', fontSize: 16, color: PAPER }, d.detail) : null,
    ),
  );
}

export function renderClockClosedCard(d: ClockClosedData): Promise<Buffer> {
  return renderPng(clockClosedTree(d), CLOSED_CARD_WIDTH);
}
