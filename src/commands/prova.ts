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
import {
  absorb,
  addPlanned,
  boostDie,
  canAbsorb,
  canAddPlanned,
  canBoost,
  canPush,
  canRetry,
  canSetAside,
  decideRetry,
  push,
  retryDie,
  retryPending,
  rollProva,
  setAside,
  type ProvaResult,
} from '../engine/prova.js';
import { MAX_CARTRIDGES, TURNS, isApproach, usableTraitSlots, type Approach } from '../engine/rules.js';
import { RIFF_MIN_TURN, cartridgeRule, type CartridgeRule, type Clock } from '../engine/session.js';
import type { Context, PendingProva } from '../context.js';
import { renderProvaCard } from '../render/provaCard.js';
import { SheetError, checkTraitsForProva, findTrait, setCartridges, setWound, type Character } from '../store/characters.js';
import type { Game } from '../store/games.js';
import { spendRitmo } from './ritmo.js';
import { clocksAlt, clocksCardData, closureAttachment, markClock } from './orologio.js';
import type { ClockClosedData } from '../render/clockClosedCard.js';
import type { ClocksCardData } from '../render/clocksCard.js';

export const PROVA_PREFIX = 'prova';

type Row = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

export async function handleProva(i: ChatInputCommandInteraction, ctx: Context): Promise<void> {
  const character = ctx.characters.active(i.user.id);
  if (!character) {
    await i.reply({
      content: 'Non hai ancora un personaggio attivo. Creane uno con `/cowbot scheda azione:crea`.',
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
  const improvvisaRaw = i.options.getString('improvvisa');
  const improvvisa = improvvisaRaw && isApproach(improvvisaRaw) ? improvvisaRaw : null;
  const wantRitmo = i.options.getBoolean('ritmo') ?? false;
  const modifier = i.options.getInteger('modificatore') ?? 0;

  const game = ctx.games.get(i.channelId);
  const tags: string[] = [];

  // Aiutare e Jam dichiarati dagli altri CT (p. 20): Vantaggio, e con Jam il Groove dell'aiutante.
  const aids = game.aids.filter((a) => a.to === i.user.id);
  const advantage = (i.options.getBoolean('vantaggio') ?? false) || aids.length > 0;
  const jamAid = aids.find((a) => a.jam);
  const jamGroove = jamAid ? (ctx.characters.byId(jamAid.fromCharacterId)?.groove ?? null) : null;
  for (const a of aids) {
    const name = ctx.characters.byId(a.fromCharacterId)?.name ?? '???';
    tags.push(a.jam ? `JAM DI ${name.toUpperCase()}` : `AIUTO DI ${name.toUpperCase()}`);
  }

  // Ritmo al posto delle Cartucce: sempre nel Filler, a scelta in Personale e Climax 2.
  const rule = cartridgeRule(game.sessionType);
  const payRitmo = cartridges > 0 && (rule === 'ritmo' || (rule === 'scelta' && wantRitmo));
  // Svantaggio imposto dal Big Shot spendendo Rischio (p. 34).
  const riskDisadvantage = game.disadvantageFor === '*' || game.disadvantageFor === i.user.id;
  if (riskDisadvantage) tags.push('SVANTAGGIO DAL RISCHIO');
  const disadvantage = (i.options.getBoolean('svantaggio') ?? false) || riskDisadvantage;

  const check = checkTraitsForProva(character, traitNames, approach, disadvantage, {
    groove: jamGroove ?? character.groove,
    ...(improvvisa ? { improvvisa } : {}),
  });
  const errors = [...check.errors];
  if (wantRitmo && rule === 'cartucce') {
    errors.push('In questa Session il Ritmo non sostituisce le Cartucce (solo Personale, Filler e Climax 2).');
  }
  if (improvvisa) {
    if (game.turn < RIFF_MIN_TURN) errors.push('Improvvisare si può dalla svolta 3, 2, 1… (p. 20).');
    if (improvvisa === approach) errors.push('Improvvisare serve a usare un Approccio diverso da quello della Prova.');
  }
  const ritmoCost = (payRitmo ? cartridges : 0) + (improvvisa ? 1 : 0);
  if (ritmoCost > character.ritmo) {
    errors.push(`${character.name} ha ${character.ritmo} Ritmo, ne servono ${ritmoCost}.`);
  }
  if (!payRitmo && character.cartridges + cartridges > MAX_CARTRIDGES) {
    errors.push(`${character.name} ha solo ${MAX_CARTRIDGES - character.cartridges} Cartucce libere.`);
  }
  if (errors.length) {
    await i.reply({ content: `Prova non tirata:\n- ${errors.join('\n- ')}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const genre = game.genre !== null && check.ok.some((t) => t.slot === game.genre);
  let result = rollProva({
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
    groove: jamGroove ?? character.groove,
    ritmoInstead: payRitmo,
  });
  // Inseguimento: ci si spinge al limite finché non si ha almeno un successo (p. 36).
  if (game.chase) {
    tags.push('INSEGUIMENTO');
    if (result.successes === 0 && canPush(result)) result = push(result);
  }

  ctx.games.save({
    ...game,
    provasInTurn: game.provasInTurn + 1,
    disadvantageFor: riskDisadvantage ? null : game.disadvantageFor,
    aids: game.aids.filter((a) => a.to !== i.user.id),
  });

  // Farsi coinvolgere: le Cartucce si segnano subito (p. 69), oppure si spende Ritmo al loro posto.
  let updated = character;
  if (cartridges > 0 && !payRitmo) updated = ctx.characters.save(setCartridges(character, character.cartridges + cartridges));
  if (ritmoCost > 0) updated = spendRitmo(ctx, i.channelId, updated, ritmoCost);
  if (improvvisa) tags.push(`IMPROVVISA ${improvvisa.toUpperCase()}`);

  const pending = ctx.pending.add({
    userId: i.user.id,
    characterId: character.id,
    characterName: character.name,
    channelId: i.channelId,
    result,
    tags,
    aids,
  });

  // La card si disegna in qualche centinaio di millisecondi (di più su un VPS piccolo): Discord vuole una risposta entro 3 secondi.
  await i.deferReply();
  await i.editReply(await provaMessage(ctx, pending, updated, null));
}

// --- Messaggio ---

function intro(p: PendingProva, c: Character, game: Game): string {
  const r = p.result;
  const lines: string[] = [];
  if (p.phase === 'tiro') {
    lines.push(`**${c.name}** tira una Prova **${r.input.approach}** contro Difficoltà ${r.input.difficulty}.`);
    if (r.input.turn === 3 && r.ones > 0) lines.push("-# Let's Jam!: ogni 1 vale 2 shock.");
    if (r.autoShock > 0) lines.push(`-# Ogni Prova produce almeno ${r.input.minShock} shock: ${r.autoShock} automatico.`);
    if (r.input.cartridges > 0) {
      const n = r.input.cartridges;
      lines.push(`-# Farsi coinvolgere: ${r.input.ritmoInstead ? (n === 1 ? '1 Ritmo speso' : `${n} Ritmo spesi`) : n === 1 ? '1 Cartuccia segnata' : `${n} Cartucce segnate`}.`);
    }
    const aside = r.dice.find((d) => d.aside);
    if (aside) lines.push(`-# Piani a Lungo Termine: il dado ${aside.value} è messo da parte per una Prova successiva.`);
    const boosted = r.dice.find((d) => d.boosted);
    if (boosted) lines.push(`-# Fuori dagli Schemi: un ${boosted.was} diventa un 6, +1 shock.`);
    const retried = r.dice.find((d) => d.retry !== undefined);
    if (retried) {
      lines.push(
        !retried.retryDecided
          ? `-# Aggiustatutto: il dado scartato (${retried.value}) ritirato fa ${retried.retry}. Tenerlo?`
          : retried.kept
            ? `-# Aggiustatutto: tenuto il nuovo dado (${retried.value}) al posto dello scartato (${retried.was}).`
            : `-# Aggiustatutto: il nuovo dado (${retried.retry}) non viene tenuto.`,
      );
    }
    const planned = r.dice.find((d) => d.fromPlan);
    if (planned) lines.push(`-# Piani a Lungo Termine: aggiunto il dado messo da parte (${planned.value}).`);
    if (p.solo) lines.push(`-# Assolo di ${p.solo.name}: +1 successo da spendere.`);
    if (p.tags.includes('INSEGUIMENTO') && r.pushed) lines.push('-# Inseguimento: spinto al limite in automatico.');
  } else {
    const s = p.spend;
    const bs = game.bigShotId ? `<@${game.bigShotId}>` : 'il Big Shot';
    lines.push(
      `**${c.name}** spende ${s.successes === 1 ? '1 successo' : `${s.successes} successi`}, ${bs} ${s.shocks === 1 ? '1 shock' : `${s.shocks} shock`}. Difficoltà attuale: **${game.difficulty}**.`,
    );
    lines.push('-# Successi: segnare un orologio o −1 Difficoltà. Shock: segnare un orologio, +1 Difficoltà o diventare Rischio.');
  }
  if (c.cartridges >= MAX_CARTRIDGES) {
    lines.push(`**Ultima Cartuccia segnata:** la svolta termina in negativo e il passato di ${c.name} bussa alla porta.`);
  }
  return lines.join('\n');
}

const cid = (p: PendingProva, action: string) => `${PROVA_PREFIX}:${p.id}:${action}`;

const soloButton = (p: PendingProva) =>
  new ButtonBuilder().setCustomId(cid(p, 'solo')).setLabel('Assolo (1 Ritmo, +1 successo)').setStyle(ButtonStyle.Secondary).setDisabled(Boolean(p.solo));

function rollRows(p: PendingProva, c: Character, rule: CartridgeRule): Row[] {
  const r = p.result;
  const buttons = [
    new ButtonBuilder().setCustomId(cid(p, 'push')).setLabel('Spingersi al limite').setStyle(ButtonStyle.Primary).setDisabled(!canPush(r)),
    new ButtonBuilder()
      .setCustomId(cid(p, 'wound'))
      .setLabel('Assorbi: ferisci un tratto')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAbsorb(r, 'ferita')),
  ];
  // Filler: niente Cartucce, solo Ritmo; Personale e Climax 2: l'uno o l'altro (pp. 42, 46, 52).
  if (rule !== 'ritmo') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(cid(p, 'cart'))
        .setLabel(`Assorbi: Cartuccia (${c.cartridges}/${MAX_CARTRIDGES})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canAbsorb(r, 'cartuccia') || c.cartridges >= MAX_CARTRIDGES),
    );
  }
  if (rule !== 'cartucce') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(cid(p, 'rit'))
        .setLabel(`Assorbi: Ritmo (${c.ritmo})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canAbsorb(r, 'cartuccia') || c.ritmo < 1),
    );
  }
  buttons.push(new ButtonBuilder().setCustomId(cid(p, 'done')).setLabel('Conferma e spendi').setStyle(ButtonStyle.Success));
  const second = [soloButton(p)];
  // Piani a Lungo Termine (p. 71): metti da parte un dado, o aggiungi quello già conservato.
  if (r.input.groove === 'piani-a-lungo-termine') {
    second.push(
      c.reservedDie !== null
        ? new ButtonBuilder()
            .setCustomId(cid(p, 'plan'))
            .setLabel(`Aggiungi il dado messo da parte (${c.reservedDie})`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAddPlanned(r))
        : new ButtonBuilder()
            .setCustomId(cid(p, 'plan'))
            .setLabel('Piani: metti da parte un dado')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canSetAside(r)),
    );
  }
  // Fuori dagli Schemi (p. 72): 1 shock per trasformare un dado da 2-5 in un 6.
  if (r.input.groove === 'fuori-dagli-schemi') {
    second.push(
      new ButtonBuilder()
        .setCustomId(cid(p, 'boost'))
        .setLabel(r.grooveShocks > 0 ? 'Fuori dagli Schemi: già usato' : 'Fuori dagli Schemi: +1 shock, un dado diventa 6')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canBoost(r)),
    );
  }
  // Aggiustatutto (p. 72): con Svantaggio, tira di nuovo il dado scartato e tienilo se vuoi.
  if (r.input.groove === 'aggiustatutto') {
    if (retryPending(r)) {
      const fresh = r.dice.find((d) => !d.kept && d.retry !== undefined && !d.retryDecided)!;
      second.push(
        new ButtonBuilder().setCustomId(cid(p, 'retrykeep')).setLabel(`Tieni il nuovo dado (${fresh.retry})`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(cid(p, 'retryno')).setLabel('Lascia perdere').setStyle(ButtonStyle.Secondary),
      );
    } else {
      second.push(
        new ButtonBuilder()
          .setCustomId(cid(p, 'retry'))
          .setLabel('Aggiustatutto: ritira il dado scartato')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!canRetry(r)),
      );
    }
  }
  const rows: Row[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
    new ActionRowBuilder<ButtonBuilder>().addComponents(...second),
  ];
  if (p.choosingDie) {
    const boost = p.choosingDie === 'boost';
    const menu = new StringSelectMenuBuilder()
      .setCustomId(cid(p, boost ? 'boostsel' : 'plansel'))
      .setPlaceholder(boost ? 'Quale dado diventa un 6?' : 'Quale dado conservi per dopo?')
      .addOptions(
        r.dice.flatMap((d, k) =>
          d.kept && !d.aside && (!boost || (d.value >= 2 && d.value <= 5)) ? [{ label: `Dado ${k + 1}: ${d.value}`, value: String(k) }] : [],
        ),
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }
  if (p.choosingWound) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(cid(p, 'woundsel'))
      .setPlaceholder('Quale tratto viene ferito?')
      .addOptions(
        r.input.traits.map((t) => ({
          label: t,
          value: t,
          description: findTrait(c, t)?.slot === 'MONO' ? 'Tratto del MONO: ferita grave' : 'Ferita, recuperabile',
        })),
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }
  return rows;
}

function clockMenu(p: PendingProva, action: string, placeholder: string, clocks: Clock[], disabled: boolean): Row {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(p, action))
    .setPlaceholder(placeholder)
    .setDisabled(disabled)
    .addOptions(
      clocks.slice(0, 25).map((k) => ({
        label: `${k.name} (${k.marks}/${k.size})`.slice(0, 100),
        value: String(k.id),
        description: `${k.kind} · ${k.approach}`,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function spendRows(p: PendingProva, game: Game, clocks: Clock[]): Row[] {
  const s = p.spend;
  const rows: Row[] = [];
  if (clocks.length) rows.push(clockMenu(p, 'sclock', `Successo (${s.successes}): segna un orologio`, clocks, s.successes === 0));
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(cid(p, 'sdiff'))
        .setLabel(game.difficultyLocked ? 'Difficoltà bloccata' : 'Successo: −1 Difficoltà')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(s.successes === 0 || game.difficultyLocked || game.difficulty === 0),
      soloButton(p),
      new ButtonBuilder().setCustomId(cid(p, 'end')).setLabel('Fine spesa').setStyle(ButtonStyle.Success),
    ),
  );
  if (clocks.length) rows.push(clockMenu(p, 'kclock', `Shock (${s.shocks}): segna un orologio`, clocks, s.shocks === 0));
  const turn = p.result.input.turn;
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(cid(p, 'kdiff')).setLabel('Shock: +1 Difficoltà').setStyle(ButtonStyle.Danger).setDisabled(s.shocks === 0),
      new ButtonBuilder()
        .setCustomId(cid(p, 'krisk'))
        .setLabel('Shock → Rischio')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(s.shocks === 0 || s.noConvert),
      // Svolta 1: 1 Rischio per +1 shock; dalla svolta 2 il Rischio vale +2 shock (p. 34).
      turn >= 2
        ? new ButtonBuilder()
            .setCustomId(cid(p, 'r2'))
            .setLabel(`Rischio: +2 shock (${game.rischio})`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(game.rischio < 1 || s.converted > 0)
        : new ButtonBuilder()
            .setCustomId(cid(p, 'r1'))
            .setLabel(`Rischio: +1 shock (${game.rischio})`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(game.rischio < 1),
    ),
  );
  return rows;
}

async function provaMessage(ctx: Context, p: PendingProva, c: Character, extra: ClocksCardData | null, done = false) {
  const game = ctx.games.get(p.channelId);
  const png = await renderProvaCard({
    result: p.result,
    characterName: c.name,
    cartridges: c.cartridges,
    confirmed: p.phase === 'spesa',
    tags: p.tags,
    spend: p.phase === 'spesa' ? { ...p.spend, done } : null,
    clocks: extra,
  });
  const file = new AttachmentBuilder(png, { name: 'prova.png', description: altText(p.result, c.name) + (extra ? ` Orologi: ${clocksAlt(extra)}.` : '') });
  const clocks = ctx.clocks.list(p.channelId, false);
  let components: Row[] = [];
  if (!done) components = p.phase === 'tiro' ? rollRows(p, c, cartridgeRule(game.sessionType)) : spendRows(p, game, clocks);
  return {
    content: intro(p, c, game),
    files: [file],
    attachments: [],
    components,
  } satisfies InteractionUpdateOptions;
}

/** Testo alternativo della card, per chi usa uno screen reader. */
function altText(r: ProvaResult, name: string): string {
  const kept = r.dice.filter((d) => d.kept).map((d) => d.value).join(', ');
  return `Prova ${r.input.approach} di ${name}, svolta ${TURNS[r.input.turn].name}: dadi ${kept}, somma ${r.sum} contro ${r.input.difficulty}. ${r.successes} successi, ${r.shocksLeft} shock.`;
}

// --- Pulsanti ---

/** Azioni del giocatore che ha tirato e azioni del Big Shot. */
const PLAYER_ACTIONS = new Set(['push', 'wound', 'woundsel', 'cart', 'rit', 'plan', 'plansel', 'boost', 'boostsel', 'retry', 'retrykeep', 'retryno', 'done', 'sclock', 'sdiff']);
const BIG_SHOT_ACTIONS = new Set(['kclock', 'kdiff', 'krisk', 'r1', 'r2']);

export async function handleProvaComponent(i: ButtonInteraction | StringSelectMenuInteraction, ctx: Context): Promise<void> {
  const [, id, action = ''] = i.customId.split(':');
  const p = id ? ctx.pending.get(id) : undefined;
  if (!p) {
    await i.reply({ content: 'Questa Prova è scaduta: i pulsanti valgono per tre ore.', flags: MessageFlags.Ephemeral });
    return;
  }
  const game = ctx.games.get(p.channelId);
  const isBigShot = !game.bigShotId || game.bigShotId === i.user.id;
  if (PLAYER_ACTIONS.has(action) && i.user.id !== p.userId) {
    await i.reply({ content: 'Solo chi ha tirato decide come usare i suoi successi.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (BIG_SHOT_ACTIONS.has(action) && !isBigShot) {
    await i.reply({ content: 'Gli shock e il Rischio li spende il Big Shot.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (action === 'end' && i.user.id !== p.userId && !isBigShot) {
    await i.reply({ content: 'Può chiudere la spesa chi ha tirato o il Big Shot.', flags: MessageFlags.Ephemeral });
    return;
  }
  let c = ctx.characters.byId(p.characterId);
  if (!c) {
    ctx.pending.delete(p.id);
    await i.reply({ content: 'Il personaggio di questa Prova non esiste più.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Disegnare la card può richiedere tempo: si conferma subito il clic e si aggiorna il messaggio dopo.
  await i.deferUpdate();
  try {
    let extra: ClocksCardData | null = null;
    let closure: ClockClosedData | null = null;
    let done = false;
    const s = p.spend;
    switch (action) {
      // Fase del tiro
      case 'push':
        if (canPush(p.result)) p.result = push(p.result);
        break;
      case 'wound': {
        const usable = p.result.input.traits;
        if (usable.length === 1) c = applyWound(ctx, p, c, usable[0]!);
        else p.choosingWound = true;
        break;
      }
      case 'woundsel':
        if (i.isStringSelectMenu() && i.values[0]) c = applyWound(ctx, p, c, i.values[0]);
        break;
      case 'cart':
        if (cartridgeRule(game.sessionType) !== 'ritmo' && canAbsorb(p.result, 'cartuccia') && c.cartridges < MAX_CARTRIDGES) {
          p.result = absorb(p.result, { kind: 'cartuccia' });
          c = ctx.characters.save(setCartridges(c, c.cartridges + 1));
        }
        break;
      case 'plan':
        if (p.result.input.groove !== 'piani-a-lungo-termine') break;
        if (c.reservedDie !== null) {
          // Il dado conservato torna con lo stesso valore che aveva (p. 71).
          if (!canAddPlanned(p.result)) break;
          p.result = addPlanned(p.result, c.reservedDie);
          c = ctx.characters.save({ ...c, reservedDie: null });
        } else if (canSetAside(p.result)) {
          p.choosingDie = 'aside';
        }
        break;
      case 'plansel': {
        p.choosingDie = null;
        if (!i.isStringSelectMenu() || c.reservedDie !== null) break;
        const out = setAside(p.result, Number(i.values[0]));
        if (!out) break;
        p.result = out.result;
        c = ctx.characters.save({ ...c, reservedDie: out.value });
        break;
      }
      case 'boost':
        if (canBoost(p.result)) p.choosingDie = 'boost';
        break;
      case 'boostsel':
        p.choosingDie = null;
        if (i.isStringSelectMenu() && i.values[0]) p.result = boostDie(p.result, Number(i.values[0]));
        break;
      case 'retry':
        if (canRetry(p.result)) p.result = retryDie(p.result);
        break;
      case 'retrykeep':
      case 'retryno':
        p.result = decideRetry(p.result, action === 'retrykeep');
        break;
      case 'rit':
        // Ritmo al posto della Cartuccia per assorbire uno shock (pp. 42, 46, 52).
        if (cartridgeRule(game.sessionType) !== 'cartucce' && canAbsorb(p.result, 'cartuccia') && c.ritmo >= 1) {
          p.result = absorb(p.result, { kind: 'cartuccia', ritmo: true });
          c = spendRitmo(ctx, p.channelId, c, 1);
        }
        break;
      case 'solo': {
        // Assolo: una volta per Session, anche per una Prova di un altro CT (p. 20).
        if (game.bigShotId === i.user.id) throw new SheetError('Gli Assolo sono dei Cacciatori di Taglie, non del Big Shot.');
        const me = ctx.characters.active(i.user.id);
        if (!me) throw new SheetError('Ti serve un personaggio attivo per fare un Assolo.');
        if (p.solo) throw new SheetError(`Su questa Prova c'è già un Assolo di ${p.solo.name}.`);
        if (me.ritmo < 1) throw new SheetError(`${me.name} non ha Ritmo da spendere.`);
        const row = ctx.games.players(p.channelId).find((x) => x.userId === i.user.id);
        if (row?.soloUsed) throw new SheetError(`${me.name} ha già fatto l'Assolo in questa Session.`);
        const spent = spendRitmo(ctx, p.channelId, me, 1);
        ctx.games.setPlayer(p.channelId, { userId: i.user.id, characterId: spent.id, roll: row?.roll ?? null, ritmo: spent.ritmo, soloUsed: true });
        if (spent.id === c.id) c = spent;
        p.solo = { userId: i.user.id, name: spent.name };
        if (p.phase === 'spesa') {
          s.successes++;
          s.log.push(`Assolo di ${spent.name}: +1 successo da spendere.`);
        }
        break;
      }
      case 'done':
        p.phase = 'spesa';
        p.choosingWound = false;
        p.choosingDie = null;
        s.successes = p.result.successes + (p.solo ? 1 : 0);
        s.shocks = p.result.shocksLeft;
        if (p.solo) s.log.push(`Assolo di ${p.solo.name}: +1 successo da spendere.`);
        // Chi ha aiutato rimuove una ferita al termine della Prova (p. 20).
        for (const a of p.aids) {
          const helper = ctx.characters.byId(a.fromCharacterId);
          const wounded = helper?.traits.find((t) => t.wound === 1);
          if (helper && wounded) {
            ctx.characters.save(setWound(helper, wounded.name, 0));
            s.log.push(`${helper.name} rimuove la ferita da «${wounded.name}».`);
          }
        }
        break;

      // Fase di spesa (p. 20)
      case 'sclock':
      case 'kclock': {
        const bySuccess = action === 'sclock';
        if ((bySuccess ? s.successes : s.shocks) < 1 || !i.isStringSelectMenu()) break;
        const clock = ctx.clocks.byId(Number(i.values[0]));
        if (!clock || clock.channelId !== p.channelId) throw new SheetError('Orologio non trovato.');
        const res = markClock(
          ctx,
          p.channelId,
          clock,
          bySuccess ? { by: 'successo', approach: p.result.input.approach } : { by: 'shock' },
        );
        if (bySuccess) s.successes--;
        else s.shocks--;
        s.log.push(`${bySuccess ? 'Successo' : 'Shock'} su «${clock.name}»: ${res.clock.marks}/${res.clock.size}${res.closed ? ', chiuso' : ''}.`);
        closure = res.closure;
        extra = clocksCardData(ctx, p.channelId, clock.id, res.note);
        break;
      }
      case 'sdiff': {
        if (s.successes < 1 || game.difficultyLocked) break;
        const g = ctx.games.save({ ...game, difficulty: Math.max(0, game.difficulty - 1) });
        s.successes--;
        s.log.push(`Successo: la Difficoltà scende a ${g.difficulty}.`);
        break;
      }
      case 'kdiff': {
        if (s.shocks < 1) break;
        const g = ctx.games.save({ ...game, difficulty: game.difficulty + 1 });
        s.shocks--;
        s.log.push(`Shock: la Difficoltà sale a ${g.difficulty}.`);
        break;
      }
      case 'krisk': {
        if (s.shocks < 1 || s.noConvert) break;
        const g = ctx.games.save({ ...game, rischio: game.rischio + 1 });
        s.shocks--;
        s.converted++;
        s.log.push(`Shock messo da parte come Rischio: il Big Shot ne ha ${g.rischio}.`);
        break;
      }
      case 'r1':
      case 'r2': {
        if (game.rischio < 1) break;
        const two = action === 'r2';
        if (!two && p.result.input.turn >= 2) break;
        if (two && (p.result.input.turn < 2 || s.converted > 0)) break;
        const g = ctx.games.save({ ...game, rischio: game.rischio - 1 });
        s.shocks += two ? 2 : 1;
        if (two) s.noConvert = true;
        s.log.push(`Il Big Shot spende 1 Rischio: +${two ? 2 : 1} shock da spendere subito (Rischio rimasto ${g.rischio}).`);
        break;
      }
      case 'end':
        done = true;
        ctx.pending.delete(p.id);
        break;
      default:
        return;
    }
    await i.editReply(await provaMessage(ctx, p, c, extra, done));
    // La chiusura di un orologio è un momento: una card a parte, per tutto il tavolo.
    if (closure) await announce(i, { files: [await closureAttachment(closure)] });
  } catch (err) {
    if (err instanceof SheetError) {
      await i.followUp({ content: err.message, flags: MessageFlags.Ephemeral });
      return;
    }
    throw err;
  }
}

/** Gli eventi importanti (fine svolta) vanno in un messaggio a parte, visibile a tutti. */
async function announce(i: ButtonInteraction | StringSelectMenuInteraction, message: { files: AttachmentBuilder[] }): Promise<void> {
  const channel = i.channel;
  if (channel && 'send' in channel) await channel.send(message).catch(() => {});
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
  // Jam presta il Groove dell'aiutante; Improvvisare apre i tratti di un secondo Approccio.
  const game = ctx.games.get(i.channelId ?? '');
  const jam = game.aids.find((a) => a.to === i.user.id && a.jam);
  const groove = (jam ? ctx.characters.byId(jam.fromCharacterId)?.groove : null) ?? c.groove;
  const second = i.options.getString('improvvisa');
  const slots =
    approach && isApproach(approach)
      ? [...usableTraitSlots(approach, groove), ...(second && isApproach(second) ? usableTraitSlots(second, groove) : []), 'MONO']
      : null;
  const typed = i.options.getFocused().toLocaleLowerCase('it');
  const disadvantage = i.options.getBoolean('svantaggio') ?? false;
  const focusedName = i.options.getFocused(true).name;
  // Tratti già scelti negli altri campi: ognuno vale una sola volta per Prova.
  const taken = new Set(
    ['tratto1', 'tratto2', 'tratto3']
      .filter((n) => n !== focusedName)
      .map((n) => i.options.getString(n))
      .filter((v): v is string => Boolean(v && v.trim()))
      .map((v) => findTrait(c, v)?.name),
  );
  const choices = c.traits
    .filter((t) => (slots ? slots.includes(t.slot) : true))
    .filter((t) => !taken.has(t.name))
    // Ferito: inutilizzabile; grave: mai; Testa Dura solo con Svantaggio.
    .filter((t) => t.wound === 0 || (t.wound === 1 && groove === 'testa-dura' && disadvantage))
    .filter((t) => t.name.toLocaleLowerCase('it').includes(typed))
    .slice(0, 25)
    .map((t) => ({ name: `${t.name} · ${t.slot}${t.wound ? ' (ferito)' : ''}`, value: t.name }));
  await i.respond(choices);
}
