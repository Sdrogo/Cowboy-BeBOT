import type { Clock } from '../engine/session.js';
import { div, el, renderPng, svg, type Node } from './satori.js';
import { APPROACH_COLORS, INK, LINE, LINE_STRONG, MUTED, PAPER } from './theme.js';

export const CLOCKS_CARD_WIDTH = 640;

const KIND_LABEL: Record<Clock['kind'], string> = {
  obiettivo: 'OBIETTIVO',
  minaccia: 'MINACCIA',
  inseguimento: 'INSEGUIMENTO',
  altro: 'OROLOGIO',
};

const mono = (size: number, color: string) => ({ fontFamily: 'Plex Mono', fontSize: size, fontWeight: 600, letterSpacing: 1.5, color });

/** Torta divisa in `size` sezioni: segnate in colore, l'ultima segnata evidenziata. */
export function clockPie(clock: Clock, diameter: number, highlightLast = false): Node {
  const r = 46;
  const color = clock.kind === 'minaccia' ? PAPER : APPROACH_COLORS[clock.approach];
  const paths: Node[] = [];
  for (let k = 0; k < clock.size; k++) {
    const a0 = ((-90 + (k * 360) / clock.size) * Math.PI) / 180;
    const a1 = ((-90 + ((k + 1) * 360) / clock.size) * Math.PI) / 180;
    const p = (a: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    let fill = LINE;
    if (k < clock.marks) fill = color;
    if (highlightLast && k === clock.marks - 1) fill = clock.kind === 'minaccia' ? '#E8553A' : PAPER;
    paths.push(el('path', { d: `M50 50 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`, fill, stroke: INK, strokeWidth: 3 }));
  }
  return svg({ width: diameter, height: diameter, viewBox: '0 0 100 100' }, ...paths);
}

function clockTile(clock: Clock, highlightId: number | null): Node {
  const color = APPROACH_COLORS[clock.approach];
  return div(
    {
      width: 186,
      boxSizing: 'border-box',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '14px 10px',
      borderRadius: 10,
      border: `2px solid ${clock.closed ? color : LINE_STRONG}`,
      opacity: clock.closed && clock.id !== highlightId ? 0.55 : 1,
    },
    clockPie(clock, 104, clock.id === highlightId),
    div(mono(11, clock.kind === 'minaccia' ? PAPER : color), `${KIND_LABEL[clock.kind]} · ${clock.approach.toUpperCase()}`),
    div({ fontFamily: 'Bebas Neue', fontSize: 24, lineHeight: 1, color: PAPER, textAlign: 'center', justifyContent: 'center' }, clock.name),
    div(mono(12, clock.closed ? color : MUTED), clock.closed ? 'CHIUSO' : `${clock.marks} / ${clock.size}`),
  );
}

export interface ClocksCardData {
  title: string;
  subtitle: string;
  clocks: Clock[];
  /** Orologio appena segnato, evidenziato. */
  highlightId?: number | null;
  /** Riga in fondo, es. l'effetto di una minaccia chiusa. */
  note?: string | null;
}

export function clocksCardTree(d: ClocksCardData): Node {
  return div(
    { width: CLOCKS_CARD_WIDTH, flexDirection: 'column', backgroundColor: INK, borderRadius: 12, overflow: 'hidden' },
    div(
      { padding: '18px 22px 14px', flexDirection: 'column', gap: 2, borderBottom: `1px solid ${LINE}` },
      div(mono(11, MUTED), d.subtitle.toUpperCase()),
      div({ fontFamily: 'Bebas Neue', fontSize: 44, lineHeight: 1, color: PAPER }, d.title),
    ),
    d.clocks.length
      ? div({ padding: '18px 22px', gap: 12, flexWrap: 'wrap' }, ...d.clocks.map((c) => clockTile(c, d.highlightId ?? null)))
      : div({ padding: '22px', fontFamily: 'Plex Sans', fontSize: 15, color: MUTED }, 'Nessun orologio aperto in questo canale.'),
    d.note
      ? div(
          { padding: '14px 22px', backgroundColor: PAPER, color: INK, fontFamily: 'Plex Sans', fontWeight: 600, fontSize: 15 },
          d.note,
        )
      : null,
  );
}

export function renderClocksCard(d: ClocksCardData): Promise<Buffer> {
  return renderPng(clocksCardTree(d), CLOCKS_CARD_WIDTH);
}
