import { firestore } from './firebase.js';

/**
 * Comptes ARCHI (`users/{uid}`) — schéma vu dans firestore.rules :
 *   { name, username, role, disabled, sections: {...} }
 * On s'en sert pour résoudre le pseudo de connexion d'un joueur vers son uid
 * Firebase Auth (option A : c'est cet uid qu'on écrit dans plazma-availability).
 */

export interface ArchiUser {
  uid: string;
  username: string;
  name?: string;
}

/** Tous les comptes (petit effectif : lecture simple, sans pagination). */
export async function listUsers(): Promise<ArchiUser[]> {
  const snap = await firestore().collection('users').get();
  return snap.docs.map((d) => {
    const data = d.data() as { username?: string; name?: string };
    return { uid: d.id, username: data.username ?? '', name: data.name };
  });
}

/** uid du compte dont le username correspond (insensible à la casse), ou null. */
export async function uidForUsername(username: string): Promise<string | null> {
  const target = username.trim().toLowerCase();
  const users = await listUsers();
  const match = users.find((u) => u.username.trim().toLowerCase() === target);
  return match ? match.uid : null;
}
