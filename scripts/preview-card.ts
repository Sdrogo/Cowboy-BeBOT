/**
 * Genera alcune card di esempio in ./preview, per controllare la grafica senza Discord.
 * Uso: npm run preview-card
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { absorb, evaluate, markKept, push, type ProvaInput } from '../src/engine/prova.js';
import { renderProvaCard } from '../src/render/provaCard.js';

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
