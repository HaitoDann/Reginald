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
import { activeWeekValue } from './week.js';
import { dayForEmoji, REACTION_EMOJIS } from './days.js';
import { getPlayers } from './roster.js';
import { resolveDiscordUser, getLinks } from './links.js';
import { readWeek, setAvailable, clearAvailable } from './availability.js';
import { renderAvailabilityMessage, type RosterSets } from './message.js';
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
async function buildContent(week: string, config: Config): Promise<string> {
  const [players, links, avail] = await Promise.all([getPlayers(), getLinks(), readWeek(week)]);
  const starterIds = players.filter((p) => p.starter).map((p) => p.id);
  const starterSet = new Set(starterIds);
  // Un sub = joueur lié dont le playerId n'est ni un titulaire ni le coach.
  const subIds = [
    ...new Set(
      Object.values(links)
        .map((l) => l.playerId)
        .filter((id) => !starterSet.has(id) && id !== 'coach'),
    ),
  ];
  const sets: RosterSets = { starterIds, subIds };
  return renderAvailabilityMessage(week, avail, sets, { mentionRoleId: config.mentionRoleId });
}

/**
 * Retrouve (ou publie) le message hebdo pour la semaine donnée, et garantit
 * la présence des 7 réactions. Idempotent → survit aux redémarrages.
 */
async function ensureWeeklyMessage(client: Client, config: Config, week: string): Promise<Message> {
  const channel = (await client.channels.fetch(config.availabilityChannelId)) as TextChannel | null;
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Salon introuvable ou non textuel : ${config.availabilityChannelId}`);
  }

  const ref = await getAvailabilityMessageRef();
  if (ref && ref.week === week && ref.channelId === channel.id) {
    try {
      const existing = await channel.messages.fetch(ref.messageId);
      await existing.edit({ content: await buildContent(week, config), allowedMentions: { parse: [] } });
      await ensureReactions(existing);
      log.info('Message hebdo réutilisé', { week, messageId: existing.id });
      return existing;
    } catch (e) {
      log.warn('Message hebdo référencé introuvable, republication', { err: String(e) });
    }
  }

  const msg = await channel.send({
    content: await buildContent(week, config),
    // Ping le rôle une seule fois, à la publication (les éditions ne re-pingent pas).
    allowedMentions: config.mentionRoleId ? { roles: [config.mentionRoleId] } : { parse: [] },
  });
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

/** Édite le message actif (celui référencé dans l'état) avec les dispos à jour. */
async function refresh(client: Client, config: Config): Promise<void> {
  try {
    const ref = await getAvailabilityMessageRef();
    if (!ref) return;
    const channel = (await client.channels.fetch(ref.channelId)) as TextChannel | null;
    if (!channel) return;
    const msg = await channel.messages.fetch(ref.messageId);
    await msg.edit({ content: await buildContent(ref.week, config), allowedMentions: { parse: [] } });
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

    const week = ref.week || activeWeekValue();
    if (add) await setAvailable(week, link, day);
    else await clearAvailable(week, link, day);

    await refresh(client, config);
  } catch (e) {
    log.error('Traitement réaction échoué', { add, err: String(e) });
  }
}

// --- Ordonnancement de la semaine active + veille des dispos ARCHI ---
// Un tick périodique idempotent (ci-dessous) suffit à publier le message du
// samedi 08:00 : quand `activeWeekValue()` bascule sur la semaine suivante,
// le tick publie le nouveau message une seule fois, puis se contente de
// l'éditer. Robuste aux redémarrages, sans timer fragile.
const TICK_MS = 5 * 60 * 1000; // 5 min

let watchedWeek: string | null = null;
let unwatch: (() => void) | null = null;

/** (Re)cible l'écoute Firestore des dispos sur la semaine active. */
function watchAvailability(client: Client, config: Config, week: string): void {
  if (watchedWeek === week && unwatch) return;
  if (unwatch) unwatch();
  watchedWeek = week;
  unwatch = firestore()
    .collection('plazma-availability')
    .where('week', '==', week)
    .onSnapshot(
      () => void refresh(client, config),
      (err) => log.warn('onSnapshot dispo', { err: String(err) }),
    );
}

/**
 * Vérifie l'état attendu et le met en place : message publié pour la semaine
 * active, réactions présentes, écoute des dispos ciblée sur cette semaine.
 */
async function tick(client: Client, config: Config): Promise<void> {
  try {
    const week = activeWeekValue();
    await ensureWeeklyMessage(client, config, week);
    watchAvailability(client, config, week);
  } catch (e) {
    log.error('Tick hebdo échoué', { err: String(e) });
  }
}

export async function start(config: Config): Promise<Client> {
  const client = createClient();

  client.once(Events.ClientReady, async (c) => {
    log.info('Reginald connecté', { user: c.user.tag });
    await tick(client, config);
    setInterval(() => void tick(client, config), TICK_MS);
  });

  client.on(Events.MessageReactionAdd, (r, u) => handleReaction(client, config, r, u, true));
  client.on(Events.MessageReactionRemove, (r, u) => handleReaction(client, config, r, u, false));

  client.on(Events.Error, (e) => log.error('Erreur client Discord', { err: String(e) }));
  client.on(Events.ShardDisconnect, () => log.warn('Shard déconnecté — discord.js va tenter de reconnecter'));

  await client.login(config.discordToken);
  return client;
}
