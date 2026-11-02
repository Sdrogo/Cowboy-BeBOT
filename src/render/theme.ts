import type { Approach } from '../engine/rules.js';

export const INK = '#111111';
export const PAPER = '#F3EBDD';
export const MUTED = '#A8A29A';
export const LINE = '#2A2826';
export const LINE_STRONG = '#4A4744';

/** Colore di ogni Approccio: la card del tiro prende il colore della Prova. */
export const APPROACH_COLORS: Record<Approach, string> = {
  Rock: '#E8553A',
  Dance: '#F2A900',
  Blues: '#4A8BE8',
  Tango: '#E8679F',
  Jazz: '#A57CF0',
};

/** Stessi colori come intero, per gli embed di Discord. */
export const approachColorInt = (a: Approach): number => parseInt(APPROACH_COLORS[a].slice(1), 16);
