import { MessageFlags, type ChatInputCommandInteraction, type ModalSubmitInteraction } from 'discord.js';
import type { Context } from '../context.js';
import { AREAS, actionOf, checkArgs, type ActionSpec, type AreaName } from './actions.js';
import { Args, type Interactive } from './args.js';
import { FORM_PREFIX, buildModal, formFor, readModal } from './forms.js';
import { handleOrologio } from './orologio.js';
import { handlePartita } from './partita.js';
import { handleRischio } from './rischio.js';
import { handleScheda } from './scheda.js';

export const isArea = (s: string): s is AreaName => s in AREAS;

const ephemeral = (i: ChatInputCommandInteraction | ModalSubmitInteraction, content: string) =>
  i.reply({ content, flags: MessageFlags.Ephemeral });

function run(i: Interactive, ctx: Context, area: AreaName, action: string, a: Args): Promise<void> {
  switch (area) {
    case 'scheda':
      return handleScheda(i, ctx, action, a);
    case 'partita':
      return handlePartita(i, ctx, action, a);
    case 'orologio':
      return handleOrologio(i, ctx, action, a);
    case 'rischio':
      return handleRischio(i, ctx, action, a);
  }
}

/** Slash command scelto: apre il form dell'azione, oppure la esegue subito se non ha campi. */
export async function startAction(i: ChatInputCommandInteraction, ctx: Context, area: AreaName): Promise<void> {
  if (!i.channelId) return void (await ephemeral(i, 'Usami in un canale di un server.'));
  const action = actionOf(i);
  const fields = formFor(area, action, ctx, i.user.id, i.channelId);
  if (typeof fields === 'string') return void (await ephemeral(i, fields));
  if (!fields.length) return run(i as Interactive, ctx, area, action, new Args());
  const spec = (AREAS[area] as readonly ActionSpec[]).find((a) => a.id === action);
  await i.showModal(buildModal(area, action, spec?.label ?? action, fields));
}

/** Form compilato: legge i valori, li controlla e esegue l'azione. */
export async function submitForm(i: ModalSubmitInteraction, ctx: Context): Promise<void> {
  const [, area, action] = i.customId.split(':');
  if (!area || !action || !isArea(area) || i.customId.split(':')[0] !== FORM_PREFIX) return;
  if (!i.channelId) return void (await ephemeral(i, 'Usami in un canale di un server.'));
  const fields = formFor(area, action, ctx, i.user.id, i.channelId);
  if (typeof fields === 'string') return void (await ephemeral(i, fields));
  const read = readModal(i, fields);
  if ('error' in read) return void (await ephemeral(i, read.error));
  const problem = checkArgs(read.args, area, action);
  if (problem) return void (await ephemeral(i, problem));
  await run(i as Interactive, ctx, area, action, read.args);
}
