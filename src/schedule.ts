import { firestore } from './firebase.js';
import { weekValue, parisDayName } from './week.js';

/**
 * Planning ARCHI — lecture seule de `plazma/schedule-<semaine>`.
 *   { schedule: { Lundi:[ {type,start,end,note} ], … }, presence: {…} }
 * Types (cf. plazma-schedule.html) : scrim, soloq, repos, match, coaching,
 * review, flexq, atelier, autre.
 */

export interface Slot {
  type: string;
  start?: string; // "HH:MM"
  end?: string;
  note?: string;
}

/** Types considérés comme « événement » à annoncer (scrim / match offi / flex). */
export const EVENT_TYPES = new Set(['scrim', 'match', 'flexq']);
/** Types « compétitifs » qui appellent une saisie de résultat. */
export const RESULT_TYPES = new Set(['scrim', 'match']);

export const TYPE_LABEL: Record<string, string> = {
  scrim: 'Scrim',
  match: 'Match Offi',
  flexq: 'FlexQ',
  soloq: 'SoloQ',
  repos: 'Repos',
  coaching: 'Coaching',
  review: 'Review VOD',
  atelier: 'Atelier',
  autre: 'Autre',
};

export const typeLabel = (t: string): string => TYPE_LABEL[t] ?? t;

/** Créneaux planifiés pour une date donnée (heure de Paris). */
export async function slotsForDate(date: Date): Promise<Slot[]> {
  const week = weekValue(date);
  const dayName = parisDayName(date);
  const snap = await firestore().collection('plazma').doc(`schedule-${week}`).get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  const schedule = (data as { schedule?: Record<string, Slot[]> }).schedule ?? {};
  const slots = schedule[dayName] ?? [];
  return slots.slice().sort((a, b) => (a.start ?? '~').localeCompare(b.start ?? '~'));
}

/** Créneaux « événement » (scrim/match/flex) pour une date. */
export async function eventsForDate(date: Date): Promise<Slot[]> {
  return (await slotsForDate(date)).filter((s) => EVENT_TYPES.has(s.type));
}
