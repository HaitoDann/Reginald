import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from './firebase.js';
import { log } from './logger.js';
import type { Day } from './days.js';
import type { PlayerLink } from './links.js';

/**
 * Disponibilités — schéma ARCHI STRICT (`plazma-availability`).
 * Doc id : `${week}__${uid}` ; champs : { week, uid, playerId, days:{Jour:'yes'} }.
 * Reginald n'écrit que la valeur 'yes' (réaction) / supprime le jour (retrait),
 * conformément au modèle validé : une réaction = "disponible".
 */

const COLLECTION = 'plazma-availability';
const YES = 'yes';

const docId = (week: string, uid: string): string => `${week}__${uid}`;

/** Marque un jour disponible pour un joueur (merge, sans écraser les autres jours). */
export async function setAvailable(
  week: string,
  link: PlayerLink,
  day: Day,
): Promise<void> {
  await firestore()
    .collection(COLLECTION)
    .doc(docId(week, link.uid))
    .set(
      {
        week,
        uid: link.uid,
        playerId: link.playerId,
        days: { [day]: YES },
      },
      { merge: true },
    );
  log.info('Dispo ajoutée', { week, playerId: link.playerId, day });
}

/** Retire la disponibilité d'un jour (supprime la clé du jour). */
export async function clearAvailable(
  week: string,
  link: PlayerLink,
  day: Day,
): Promise<void> {
  await firestore()
    .collection(COLLECTION)
    .doc(docId(week, link.uid))
    .set(
      { days: { [day]: FieldValue.delete() } },
      { merge: true },
    );
  log.info('Dispo retirée', { week, playerId: link.playerId, day });
}

/** days par joueur pour une semaine : { playerId: { Jour: 'yes' } }. */
export type WeekAvailability = Record<string, Partial<Record<Day, string>>>;

export async function readWeek(week: string): Promise<WeekAvailability> {
  const snap = await firestore().collection(COLLECTION).where('week', '==', week).get();
  const out: WeekAvailability = {};
  snap.forEach((d) => {
    const x = d.data() as { playerId?: string; days?: Partial<Record<Day, string>> };
    if (x.playerId) out[x.playerId] = x.days ?? {};
  });
  return out;
}

/** True si le joueur est marqué disponible ('yes') ce jour-là. */
export function isYes(days: Partial<Record<Day, string>> | undefined, day: Day): boolean {
  return (days?.[day] ?? '') === YES;
}
