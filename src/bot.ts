import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Message,
  type TextChannel,
  type MessageReaction,
  type PartialMessageReaction,
  type User,
  type PartialUser,
} from 'discord.js';
import type { Config } from './config.js';
import { log } from './logger.js';
import { currentWeekValue } from './week.js';
import { dayForEmoji, REACTION_EMOJIS } from './days.js';
import { getPlayers } from './roster.js';
import { resolveDiscordUser } from './links.js';
import { readWeek, setAvailable, clearAvailable } from './availability.js';
import { renderAvailabilityMessage } from './message.js';
import { getAvailabilityMessageRef, setAvailabilityMessageRef } from './state.js';
import { firestore } from './firebase.js';

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
    // Partials indispensables : réactions sur des messages non mis en cache
    // (ex. message posté avant un redémarrage du bot).
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  });
}

/** (Re)construit le contenu du message pour la semaine courante. */
async function buildContent(week: string): Promise<string> {
  const [players, avail] = await Promise.all([getPlayers(), readWeek(week)]);
  return renderAvailabilityMessage(week, players, avail);
}

/**
 * Retrouve (ou publie) le message hebdo de la semaine courante, et garantit
 * la présence des 7 réactions. Idempotent → survit aux redémarrages.
 */
async function ensureWeeklyMessage(client: Client, config: Config): Promise<Message> {
  const week = currentWeekValue();
  const channel = (await client.channels.fetch(config.availabilityChannelId)) as TextChannel | null;
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Salon introuvable ou non textuel : ${config.availabilityChannelId}`);
  }

  const ref = await getAvailabilityMessageRef();
  if (ref && ref.week === week && ref.channelId === channel.id) {
    try {
      const existing = await channel.messages.fetch(ref.messageId);
      await existing.edit(await buildContent(week));
      await ensureReactions(existing);
      log.info('Message hebdo réutilisé', { week, messageId: existing.id });
      return existing;
    } catch (e) {
      log.warn('Message hebdo référencé introuvable, republication', { err: String(e) });
    }
  }

  const msg = await channel.send(await buildContent(week));
  await ensureReactions(msg);
  await setAvailabilityMessageRef({ week, channelId: channel.id, messageId: msg.id });
  log.info('Message hebdo publié', { week, messageId: msg.id });
  return msg;
}

async function ensureReactions(msg: Message): Promise<void> {
  const present = new Set(msg.reactions.cache.map((r) => r.emoji.name));
  for (const emoji of REACTION_EMOJIS) {
    if (!present.has(emoji)) {
      try {
        await msg.react(emoji);
      } catch (e) {
        log.warn('Échec ajout réaction', { emoji, err: String(e) });
      }
    }
  }
}

/** Édite le message courant avec l'état à jour des disponibilités. */
async function refresh(client: Client, config: Config): Promise<void> {
  try {
    const week = currentWeekValue();
    const ref = await getAvailabilityMessageRef();
    if (!ref || ref.week !== week) return; // rien à rafraîchir (nouvelle semaine gérée ailleurs)
    const channel = (await client.channels.fetch(ref.channelId)) as TextChannel | null;
    if (!channel) return;
    const msg = await channel.messages.fetch(ref.messageId);
    await msg.edit(await buildContent(week));
  } catch (e) {
    log.warn('Refresh message échoué', { err: String(e) });
  }
}

async function handleReaction(
  client: Client,
  config: Config,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  add: boolean,
): Promise<void> {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    const ref = await getAvailabilityMessageRef();
    if (!ref || reaction.message.id !== ref.messageId) return; // pas notre message

    const emoji = reaction.emoji.name ?? '';
    const day = dayForEmoji(emoji);
    if (!day) return; // emoji hors périmètre

    const link = await resolveDiscordUser(user.id);
    if (!link) {
      log.info('Réaction ignorée : joueur non lié', { discordUserId: user.id, emoji });
      return;
    }

    const week = ref.week || currentWeekValue();
    if (add) await setAvailable(week, link, day);
    else await clearAvailable(week, link, day);

    await refresh(client, config);
  } catch (e) {
    log.error('Traitement réaction échoué', { add, err: String(e) });
  }
}

/**
 * Écoute les changements de dispos côté ARCHI (site web) pour rafraîchir le
 * message Discord en direct — le bot reste la source d'affichage unique.
 */
function watchAvailability(client: Client, config: Config): () => void {
  const week = currentWeekValue();
  return firestore()
    .collection('plazma-availability')
    .where('week', '==', week)
    .onSnapshot(
      () => {
        void refresh(client, config);
      },
      (err) => log.warn('onSnapshot dispo', { err: String(err) }),
    );
}

export async function start(config: Config): Promise<Client> {
  const client = createClient();

  client.once(Events.ClientReady, async (c) => {
    log.info('Reginald connecté', { user: c.user.tag });
    try {
      await ensureWeeklyMessage(client, config);
      watchAvailability(client, config);
    } catch (e) {
      log.error('Initialisation post-ready échouée', { err: String(e) });
    }
  });

  client.on(Events.MessageReactionAdd, (r, u) => handleReaction(client, config, r, u, true));
  client.on(Events.MessageReactionRemove, (r, u) => handleReaction(client, config, r, u, false));

  client.on(Events.Error, (e) => log.error('Erreur client Discord', { err: String(e) }));
  client.on(Events.ShardDisconnect, () => log.warn('Shard déconnecté — discord.js va tenter de reconnecter'));

  await client.login(config.discordToken);
  return client;
}
