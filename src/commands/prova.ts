import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionUpdateOptions,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { absorb, canAbsorb, canPush, push, rollProva, type ProvaResult } from '../engine/prova.js';
import { MAX_CARTRIDGES, TURNS, isApproach, usableTraitSlots, type Approach } from '../engine/rules.js';
import type { Context, PendingProva } from '../context.js';
import { renderProvaCard } from '../render/provaCard.js';
import { checkTraitsForProva, findTrait, setCartridges, setWound, type Character } from '../store/characters.js';

export const PROVA_PREFIX = 'prova';

export async function handleProva(i: ChatInputCommandInteraction, ctx: Context): Promise<void> {
  const character = ctx.characters.active(i.user.id);
  if (!character) {
    await i.reply({
      content: 'Non hai ancora un personaggio attivo. Creane uno con `/cowbot scheda crea`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const approachRaw = i.options.getString('approccio', true);
  if (!isApproach(approachRaw)) throw new Error(`Approccio sconosciuto: ${approachRaw}`);
  const approach: Approach = approachRaw;
  const traitNames = ['tratto1', 'tratto2', 'tratto3']
    .map((n) => i.options.getString(n))
    .filter((v): v is string => Boolean(v && v.trim()));
  const cartridges = i.options.getInteger('cartucce') ?? 0;
  const advantage = i.options.getBoolean('vantaggio') ?? false;
  const disadvantage = i.options.getBoolean('svantaggio') ?? false;
  const modifier = i.options.getInteger('modificatore') ?? 0;

  const check = checkTraitsForProva(character, traitNames, approach, disadvantage);
  const errors = [...check.errors];
  if (character.cartridges + cartridges > MAX_CARTRIDGES) {
    errors.push(`${character.name} ha solo ${MAX_CARTRIDGES - character.cartridges} Cartucce libere.`);
  }
  if (errors.length) {
    await i.reply({ content: `Prova non tirata:\n- ${errors.join('\n- ')}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const game = ctx.games.get(i.channelId);
  const genre = game.genre !== null && check.ok.some((t) => t.slot === game.genre);
  const result = rollProva({
    turn: game.turn,
    difficulty: game.difficulty,
    approach,
    traits: check.ok.map((t) => t.name),
    genre,
    cartridges,
    advantage,
    disadvantage,
    modifier,
    minShock: game.minShock,
    groove: character.groove,
  });

  // Farsi coinvolgere: le Cartucce si segnano subito (p. 69).
  let updated = character;
  if (cartridges > 0) updated = ctx.characters.save(setCartridges(character, character.cartridges + cartridges));

  const pending = ctx.pending.add({
    userId: i.user.id,
    characterId: character.id,
    characterName: character.name,
    result,
  });

  await i.reply(await provaMessage(pending, updated, false));
}

function intro(p: PendingProva, c: Character, confirmed: boolean): string {
  const r = p.result;
  const lines: string[] = [];
  if (!confirmed) {
    lines.push(`**${c.name}** tira una Prova **${r.input.approach}** contro Difficoltà ${r.input.difficulty}.`);
    if (r.input.turn === 3 && r.ones > 0) lines.push("-# Let's Jam!: ogni 1 vale 2 shock.");
    if (r.autoShock > 0) lines.push(`-# Ogni Prova produce almeno ${r.input.minShock} shock: ${r.autoShock} automatico.`);
    if (r.input.cartridges > 0) {
      const n = r.input.cartridges;
      lines.push(`-# Farsi coinvolgere: ${n === 1 ? '1 Cartuccia segnata' : `${n} Cartucce segnate`}.`);
    }
  } else {
    const succ = r.successes === 1 ? '1 successo' : `${r.successes} successi`;
    const shock = r.shocksLeft === 1 ? '1 shock' : `${r.shocksLeft} shock`;
    lines.push(`**${c.name}** ha ${succ} da spendere, il Big Shot ha ${shock}.`);
    lines.push('-# Spendeteli insieme: segnare un orologio oppure ±1 alla Difficoltà (`/cowbot partita difficolta`).');
  }
  if (c.cartridges >= MAX_CARTRIDGES) {
    lines.push(`**Ultima Cartuccia segnata:** la svolta termina in negativo e il passato di ${c.name} bussa alla porta.`);
  }
  return lines.join('\n');
}

function buttons(p: PendingProva, c: Character): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const r = p.result;
  const id = (action: string) => `${PROVA_PREFIX}:${p.id}:${action}`;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(id('push'))
      .setLabel('Spingersi al limite')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canPush(r)),
    new ButtonBuilder()
      .setCustomId(id('wound'))
      .setLabel('Assorbi: ferisci un tratto')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAbsorb(r, 'ferita')),
    new ButtonBuilder()
      .setCustomId(id('cart'))
      .setLabel(`Assorbi: Cartuccia (${c.cartridges}/${MAX_CARTRIDGES})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAbsorb(r, 'cartuccia') || c.cartridges >= MAX_CARTRIDGES),
    new ButtonBuilder().setCustomId(id('done')).setLabel('Conferma').setStyle(ButtonStyle.Success),
  );
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [row];
  if (p.choosingWound) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(id('woundsel'))
      .setPlaceholder('Quale tratto viene ferito?')
      .addOptions(
        r.input.traits.map((t) => {
          const trait = findTrait(c, t);
          return {
            label: t,
            value: t,
            description: trait?.slot === 'MONO' ? 'Tratto del MONO: ferita grave' : 'Ferita, recuperabile',
          };
        }),
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }
  return rows;
}

async function provaMessage(p: PendingProva, c: Character, confirmed: boolean) {
  const png = await renderProvaCard({
    result: p.result,
    characterName: c.name,
    cartridges: c.cartridges,
    confirmed,
  });
  const file = new AttachmentBuilder(png, {
    name: 'prova.png',
    description: altText(p.result, c.name),
  });
  return {
    content: intro(p, c, confirmed),
    files: [file],
    attachments: [],
    components: confirmed ? [] : buttons(p, c),
  } satisfies InteractionUpdateOptions;
}

/** Testo alternativo della card, per chi usa uno screen reader. */
function altText(r: ProvaResult, name: string): string {
  const kept = r.dice.filter((d) => d.kept).map((d) => d.value).join(', ');
  return `Prova ${r.input.approach} di ${name}, svolta ${TURNS[r.input.turn].name}: dadi ${kept}, somma ${r.sum} contro ${r.input.difficulty}. ${r.successes} successi, ${r.shocksLeft} shock.`;
}

export async function handleProvaComponent(
  i: ButtonInteraction | StringSelectMenuInteraction,
  ctx: Context,
): Promise<void> {
  const [, id, action] = i.customId.split(':');
  const p = id ? ctx.pending.get(id) : undefined;
  if (!p) {
    await i.reply({ content: 'Questa Prova è scaduta: i pulsanti valgono per un\'ora.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (i.user.id !== p.userId) {
    await i.reply({ content: 'Solo chi ha tirato può decidere come usare questa Prova.', flags: MessageFlags.Ephemeral });
    return;
  }
  let c = ctx.characters.byId(p.characterId);
  if (!c) {
    ctx.pending.delete(p.id);
    await i.reply({ content: 'Il personaggio di questa Prova non esiste più.', flags: MessageFlags.Ephemeral });
    return;
  }

  let confirmed = false;
  switch (action) {
    case 'push':
      if (canPush(p.result)) p.result = push(p.result);
      break;
    case 'wound': {
      const usable = p.result.input.traits;
      if (usable.length === 1) {
        c = applyWound(ctx, p, c, usable[0]!);
      } else {
        p.choosingWound = true;
      }
      break;
    }
    case 'woundsel':
      if (i.isStringSelectMenu() && i.values[0]) c = applyWound(ctx, p, c, i.values[0]);
      break;
    case 'cart':
      if (canAbsorb(p.result, 'cartuccia') && c.cartridges < MAX_CARTRIDGES) {
        p.result = absorb(p.result, { kind: 'cartuccia' });
        c = ctx.characters.save(setCartridges(c, c.cartridges + 1));
      }
      break;
    case 'done':
      confirmed = true;
      ctx.pending.delete(p.id);
      break;
    default:
      return;
  }

  await i.update(await provaMessage(p, c, confirmed));
}

function applyWound(ctx: Context, p: PendingProva, c: Character, traitName: string): Character {
  p.choosingWound = false;
  if (!canAbsorb(p.result, 'ferita') || !p.result.input.traits.includes(traitName)) return c;
  const trait = findTrait(c, traitName);
  if (!trait) return c;
  // I tratti del MONO subiscono sempre ferite gravi (p. 37).
  const grave = trait.slot === 'MONO';
  p.result = absorb(p.result, { kind: 'ferita', trait: trait.name, grave });
  return ctx.characters.save(setWound(c, trait.name, grave ? 2 : 1));
}

/** Suggerisce i tratti del PG attivo utilizzabili con l'Approccio scelto. */
export async function autocompleteProva(i: AutocompleteInteraction, ctx: Context): Promise<void> {
  const c = ctx.characters.active(i.user.id);
  if (!c) {
    await i.respond([]);
    return;
  }
  const approach = i.options.getString('approccio');
  const slots = approach && isApproach(approach) ? [...usableTraitSlots(approach, c.groove), 'MONO'] : null;
  const typed = i.options.getFocused().toLocaleLowerCase('it');
  const choices = c.traits
    .filter((t) => (slots ? slots.includes(t.slot) : true))
    .filter((t) => t.wound === 0 || c.groove === 'testa-dura')
    .filter((t) => t.name.toLocaleLowerCase('it').includes(typed))
    .slice(0, 25)
    .map((t) => ({ name: `${t.name} · ${t.slot}${t.wound ? ' (ferito)' : ''}`, value: t.name }));
  await i.respond(choices);
}
