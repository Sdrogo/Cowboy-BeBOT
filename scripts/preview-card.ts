/**
 * Genera alcune card di esempio in ./preview, per controllare la grafica senza Discord.
 * Uso: npm run preview-card
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { absorb, evaluate, markKept, push, type ProvaInput } from '../src/engine/prova.js';
import { renderProvaCard } from '../src/render/provaCard.js';
import { renderClocksCard } from '../src/render/clocksCard.js';
import { renderSessionCard } from '../src/render/sessionCard.js';
import type { Clock } from '../src/engine/session.js';

const base: ProvaInput = {
  turn: 2,
  difficulty: 10,
  approach: 'Dance',
  traits: ['Steel Tear'],
  genre: true,
  cartridges: 0,
  advantage: true,
  disadvantage: false,
  modifier: 0,
  minShock: 1,
  groove: null,
};

const samples = {
  'dance-vantaggio': evaluate(base, markKept([6, 5, 4, 1, 1], 'vantaggio')),
  'dance-al-limite-assorbito': absorb(
    absorb(push(evaluate({ ...base, advantage: false, genre: false }, markKept([5, 4, 2], 'normale'))), {
      kind: 'ferita',
      trait: 'Steel Tear',
    }),
    { kind: 'cartuccia' },
  ),
  'rock-lets-jam': evaluate(
    { ...base, approach: 'Rock', turn: 3, difficulty: 18, advantage: false, cartridges: 1, traits: ['Jericho'] },
    markKept([1, 1, 2, 3, 6, 6], 'normale'),
  ),
  'jazz-tanti-dadi': evaluate(
    { ...base, approach: 'Jazz', turn: 3, difficulty: 15, cartridges: 2, traits: ['Binocolo', 'Completo blu'] },
    markKept([3, 6, 2, 5, 1, 4, 6, 2, 5, 3, 4], 'vantaggio'),
  ),
};

mkdirSync('preview', { recursive: true });
for (const [name, result] of Object.entries(samples)) {
  const png = await renderProvaCard({ result, characterName: 'Spike Spiegel', cartridges: 4, confirmed: name.includes('assorbito') });
  writeFileSync(`preview/${name}.png`, png);
  console.log(`preview/${name}.png`);
}

// Fase di spesa, con etichette dal Rischio.
writeFileSync(
  'preview/spesa.png',
  await renderProvaCard({
    result: samples['dance-vantaggio'],
    characterName: 'Spike Spiegel',
    cartridges: 4,
    confirmed: true,
    tags: ['INSEGUIMENTO', 'SVANTAGGIO DAL RISCHIO'],
    spend: { successes: 1, shocks: 2, log: ['Successo su «Fuga dal casinò» (2/4).', 'Il Big Shot alza la Difficoltà a 11.'], done: false },
  }),
);
console.log('preview/spesa.png');

const clock = (id: number, name: string, size: number, approach: Clock['approach'], kind: Clock['kind'], marks: number): Clock => ({
  id, channelId: 'c', name, size, approach, kind, marks, closed: marks >= size,
});
writeFileSync(
  'preview/orologi.png',
  await renderClocksCard({
    title: 'Orologi',
    subtitle: 'In questo canale',
    clocks: [
      clock(1, 'Fuga dal casinò', 4, 'Dance', 'obiettivo', 2),
      clock(2, 'Arrivano i Red Dragon', 6, 'Jazz', 'minaccia', 6),
      clock(3, 'Inseguimento su Marte', 8, 'Rock', 'inseguimento', 5),
    ],
    highlightId: 2,
    note: '«Arrivano i Red Dragon» chiuso: la svolta termina in negativo. Complicazioni inaspettate: nella prossima svolta la Difficoltà sale di 3 e non si può ridurre.',
  }),
);
console.log('preview/orologi.png');

writeFileSync(
  'preview/sessione.png',
  await renderSessionCard({
    type: 'classica',
    title: 'Asteroid Blues',
    players: [
      { name: 'Spike Spiegel', roll: 4, ritmo: 5 },
      { name: 'Faye Valentine', roll: 6, ritmo: 6 },
      { name: 'Jet Black', roll: 2, ritmo: 2 },
    ],
    rischio: 5,
    genre: null,
    genreByPlayers: true,
  }),
);
console.log('preview/sessione.png');
