import { EmbedBuilder, MessageFlags } from 'discord.js';
import { APPROACHES, GROOVES, MAX_CARTRIDGES, isGrooveId, type TraitSlot } from '../engine/rules.js';
import type { Context } from '../context.js';
import type { Args, Interactive } from './args.js';
import { approachColorInt } from '../render/theme.js';
import {
  SheetError,
  addTrait,
  removeTrait,
  setCartridges,
  setRitmo,
  setWound,
  type Character,
  type Trait,
  type Wound,
} from '../store/characters.js';

export async function handleScheda(i: Interactive, ctx: Context, sub: string, a: Args): Promise<void> {
  const userId = i.user.id;
  try {
    switch (sub) {
      case 'crea': {
        const groove = a.str('groove');
        const c = ctx.characters.create(userId, {
          name: a.reqStr('nome'),
          concept: a.str('concept') ?? '',
          memory: a.str('ricordo') ?? '',
          groove: groove && isGrooveId(groove) ? groove : null,
        });
        await i.reply({
          content: `Creato **${c.name}**, ora è il tuo personaggio attivo. Aggiungi i tratti con \`/cowbot-scheda azione:tratto-aggiungi\`: alla creazione ne servono 4, al massimo 2 nello stesso Approccio.`,
          embeds: [sheetEmbed(c)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case 'lista': {
        const list = ctx.characters.list(userId);
        const text = list.length
          ? list.map((c) => `${c.active ? '▶' : '·'} **${c.name}**${c.concept ? ` · ${c.concept}` : ''}`).join('\n')
          : 'Nessun personaggio. Creane uno con `/cowbot-scheda azione:crea`.';
        await i.reply({ content: text, flags: MessageFlags.Ephemeral });
        return;
      }
      case 'usa': {
        const c = ctx.characters.setActive(userId, a.reqStr('nome'));
        await i.reply({ content: `Ora giochi con **${c.name}**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      case 'mostra': {
        const name = a.str('nome');
        const c = name ? ctx.characters.byName(userId, name) : ctx.characters.active(userId);
        if (!c) throw new SheetError(name ? `Non hai un personaggio chiamato «${name}».` : 'Non hai un personaggio attivo.');
        await i.reply({ embeds: [sheetEmbed(c)] });
        return;
      }
      case 'elimina': {
        const c = ctx.characters.delete(userId, a.reqStr('nome'));
        const next = ctx.characters.active(userId);
        await i.reply({
          content: `Eliminato **${c.name}**.${next ? ` Personaggio attivo: **${next.name}**.` : ''}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // I comandi seguenti agiscono sul personaggio attivo.
    const c = ctx.characters.active(userId);
    if (!c) throw new SheetError('Non hai un personaggio attivo. Creane uno con `/cowbot-scheda azione:crea`.');
    let next: Character;
    let note: string;
    switch (sub) {
      case 'modifica': {
        const groove = a.str('groove');
        next = {
          ...c,
          groove: groove && isGrooveId(groove) ? groove : c.groove,
          concept: a.str('concept') ?? c.concept,
          memory: a.str('ricordo') ?? c.memory,
        };
        note = 'Scheda aggiornata.';
        break;
      }
      case 'tratto-aggiungi': {
        const name = a.reqStr('nome');
        next = addTrait(c, name, a.reqStr('approccio') as TraitSlot);
        note = `Aggiunto il tratto **${name.trim()}**.`;
        break;
      }
      case 'tratto-rimuovi': {
        const name = a.reqStr('nome');
        next = removeTrait(c, name);
        note = `Rimosso il tratto **${name}**.`;
        break;
      }
      case 'tratto-ferita': {
        const name = a.reqStr('nome');
        const wound = a.reqInt('stato') as Wound;
        next = setWound(c, name, wound);
        note = `**${name}**: ${woundLabel(wound)}.`;
        break;
      }
      case 'cartucce': {
        next = setCartridges(c, a.reqInt('valore'));
        note = `Cartucce segnate: ${next.cartridges}/${MAX_CARTRIDGES}.`;
        break;
      }
      case 'ritmo': {
        next = setRitmo(c, a.reqInt('valore'));
        note = `Ritmo: ${next.ritmo}.`;
        break;
      }
      case 'fardello': {
        const title = a.reqStr('titolo').trim();
        const resolved = a.bool('risolto') ?? false;
        const existing = c.burdens.find((b) => b.title.toLocaleLowerCase('it') === title.toLocaleLowerCase('it'));
        next = existing
          ? { ...c, burdens: c.burdens.map((b) => (b === existing ? { ...b, resolved } : b)) }
          : { ...c, burdens: [...c.burdens, { title, resolved }] };
        note = existing ? `Fardello «${title}» aggiornato.` : `Nuovo Fardello: «${title}».`;
        break;
      }
      default:
        return;
    }
    ctx.characters.save(next);
    await i.reply({ content: note, embeds: [sheetEmbed(next)], flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err instanceof SheetError) {
      await i.reply({ content: err.message, flags: MessageFlags.Ephemeral });
      return;
    }
    throw err;
  }
}

const woundLabel = (w: Wound) => (w === 0 ? 'integro' : w === 1 ? 'ferito' : 'ferito gravemente');

function traitLine(t: Trait): string {
  if (t.wound === 2) return `~~${t.name}~~ ✕✕`;
  if (t.wound === 1) return `~~${t.name}~~ ✕`;
  return t.name;
}

export function sheetEmbed(c: Character): EmbedBuilder {
  const cylinder = Array.from({ length: MAX_CARTRIDGES }, (_, k) => (k < c.cartridges ? '◉' : '○')).join(' ');
  const embed = new EmbedBuilder()
    .setTitle(c.name)
    .setColor(approachColorInt('Dance'))
    .setDescription(
      [
        c.concept ? `*${c.concept}*` : null,
        c.groove ? `**Groove · ${GROOVES[c.groove].name}**\n${GROOVES[c.groove].summary}` : '**Groove** non scelto',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  const slots: TraitSlot[] = [...APPROACHES, 'MONO'];
  for (const slot of slots) {
    const traits = c.traits.filter((t) => t.slot === slot);
    if (slot === 'MONO' && traits.length === 0) continue;
    embed.addFields({ name: slot, value: traits.length ? traits.map(traitLine).join('\n') : '—', inline: true });
  }
  embed.addFields(
    { name: 'Ricordo', value: c.memory || '—' },
    { name: `Cartucce ${c.cartridges}/${MAX_CARTRIDGES}`, value: cylinder, inline: true },
    { name: 'Ritmo', value: String(c.ritmo), inline: true },
  );
  if (c.burdens.length) {
    embed.addFields({
      name: 'Fardelli',
      value: c.burdens.map((b) => `${b.resolved ? '☒' : '☐'} ${b.title}`).join('\n'),
    });
  }
  return embed;
}
