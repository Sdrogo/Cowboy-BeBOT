import { EmbedBuilder, MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { APPROACHES, GROOVES, MAX_CARTRIDGES, isGrooveId, type TraitSlot } from '../engine/rules.js';
import type { Context } from '../context.js';
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

export async function handleScheda(i: ChatInputCommandInteraction, ctx: Context): Promise<void> {
  const sub = i.options.getSubcommand();
  const userId = i.user.id;
  try {
    switch (sub) {
      case 'crea': {
        const groove = i.options.getString('groove');
        const c = ctx.characters.create(userId, {
          name: i.options.getString('nome', true),
          concept: i.options.getString('concept') ?? '',
          memory: i.options.getString('ricordo') ?? '',
          groove: groove && isGrooveId(groove) ? groove : null,
        });
        await i.reply({
          content: `Creato **${c.name}**, ora è il tuo personaggio attivo. Aggiungi i tratti con \`/cowbot scheda tratto-aggiungi\`: alla creazione ne servono 4, al massimo 2 nello stesso Approccio.`,
          embeds: [sheetEmbed(c)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case 'lista': {
        const list = ctx.characters.list(userId);
        const text = list.length
          ? list.map((c) => `${c.active ? '▶' : '·'} **${c.name}**${c.concept ? ` · ${c.concept}` : ''}`).join('\n')
          : 'Nessun personaggio. Creane uno con `/cowbot scheda crea`.';
        await i.reply({ content: text, flags: MessageFlags.Ephemeral });
        return;
      }
      case 'usa': {
        const c = ctx.characters.setActive(userId, i.options.getString('nome', true));
        await i.reply({ content: `Ora giochi con **${c.name}**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      case 'mostra': {
        const name = i.options.getString('nome');
        const c = name ? ctx.characters.byName(userId, name) : ctx.characters.active(userId);
        if (!c) throw new SheetError(name ? `Non hai un personaggio chiamato «${name}».` : 'Non hai un personaggio attivo.');
        await i.reply({ embeds: [sheetEmbed(c)] });
        return;
      }
      case 'elimina': {
        const c = ctx.characters.delete(userId, i.options.getString('nome', true));
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
    if (!c) throw new SheetError('Non hai un personaggio attivo. Creane uno con `/cowbot scheda crea`.');
    let next: Character;
    let note: string;
    switch (sub) {
      case 'modifica': {
        const groove = i.options.getString('groove');
        next = {
          ...c,
          groove: groove && isGrooveId(groove) ? groove : c.groove,
          concept: i.options.getString('concept') ?? c.concept,
          memory: i.options.getString('ricordo') ?? c.memory,
        };
        note = 'Scheda aggiornata.';
        break;
      }
      case 'tratto-aggiungi': {
        const name = i.options.getString('nome', true);
        next = addTrait(c, name, i.options.getString('approccio', true) as TraitSlot);
        note = `Aggiunto il tratto **${name.trim()}**.`;
        break;
      }
      case 'tratto-rimuovi': {
        const name = i.options.getString('nome', true);
        next = removeTrait(c, name);
        note = `Rimosso il tratto **${name}**.`;
        break;
      }
      case 'tratto-ferita': {
        const name = i.options.getString('nome', true);
        const wound = i.options.getInteger('stato', true) as Wound;
        next = setWound(c, name, wound);
        note = `**${name}**: ${woundLabel(wound)}.`;
        break;
      }
      case 'cartucce': {
        next = setCartridges(c, i.options.getInteger('valore', true));
        note = `Cartucce segnate: ${next.cartridges}/${MAX_CARTRIDGES}.`;
        break;
      }
      case 'ritmo': {
        next = setRitmo(c, i.options.getInteger('valore', true));
        note = `Ritmo: ${next.ritmo}.`;
        break;
      }
      case 'fardello': {
        const title = i.options.getString('titolo', true).trim();
        const resolved = i.options.getBoolean('risolto') ?? false;
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

export async function autocompleteScheda(i: AutocompleteInteraction, ctx: Context): Promise<void> {
  const typed = i.options.getFocused().toLocaleLowerCase('it');
  const sub = i.options.getSubcommand();
  let names: string[];
  if (sub.startsWith('tratto')) {
    names = ctx.characters.active(i.user.id)?.traits.map((t) => t.name) ?? [];
  } else {
    names = ctx.characters.list(i.user.id).map((c) => c.name);
  }
  await i.respond(
    names
      .filter((n) => n.toLocaleLowerCase('it').includes(typed))
      .slice(0, 25)
      .map((n) => ({ name: n, value: n })),
  );
}
