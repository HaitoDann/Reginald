import { firestore } from './firebase.js';
import { log } from './logger.js';

/**
 * Association Discord User ID ↔ joueur ARCHI.
 *
 * C'est la SEULE donnée nouvelle introduite par Reginald : ARCHI ne stocke
 * aucun identifiant Discord aujourd'hui. On la range dans un doc dédié
 * `plazma/discord-links` pour ne pas polluer le roster :
 *
 *   plazma/discord-links = {
 *     links: {
 *       "<discordUserId>": { playerId: "boulou", uid: "<firebaseAuthUid>" }
 *     }
 *   }
 *
 * - `playerId` : id de slot ARCHI (cf. roster.ts).
 * - `uid`      : uid Firebase Auth du compte ARCHI du joueur (option A) — c'est
 *   ce qui est écrit dans le champ `uid` des docs `plazma-availability`, pour
 *   que la grille ARCHI reste cohérente avec ce qu'écrit le bot.
 */

const DOC = firestore; // paresseux : firestore() n'est appelable qu'après init

export interface PlayerLink {
  playerId: string;
  uid: string;
}

export type LinkMap = Record<string, PlayerLink>;

export async function getLinks(): Promise<LinkMap> {
  const snap = await DOC().collection('plazma').doc('discord-links').get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  const links = (data as { links?: LinkMap }).links ?? {};
  return links;
}

/** Résout un Discord User ID vers le joueur ARCHI lié, ou null si non lié. */
export async function resolveDiscordUser(discordUserId: string): Promise<PlayerLink | null> {
  const links = await getLinks();
  const link = links[discordUserId] ?? null;
  if (!link) log.debug('Discord user non lié', { discordUserId });
  return link;
}
