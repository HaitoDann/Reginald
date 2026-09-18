/**
 * Correspondance emoji ↔ jour, alignée sur le message hebdo de Reginald et sur
 * les clés `days` d'ARCHI (noms de jours en français, cf. plazma-schedule.html :
 * DAYS = ["Lundi", …, "Dimanche"]).
 */

export const DAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;

export type Day = (typeof DAYS)[number];

/** Ordre d'affichage des emojis dans le message de disponibilités. */
export const EMOJI_BY_DAY: Record<Day, string> = {
  Lundi: '🟥',
  Mardi: '🟧',
  Mercredi: '🟨',
  Jeudi: '🟩',
  Vendredi: '🟦',
  Samedi: '🟪',
  Dimanche: '⬜',
};

const DAY_BY_EMOJI: Record<string, Day> = Object.fromEntries(
  (Object.entries(EMOJI_BY_DAY) as [Day, string][]).map(([day, emoji]) => [emoji, day]),
);

/** Jour correspondant à un emoji de réaction, ou null si non géré par Reginald. */
export function dayForEmoji(emoji: string): Day | null {
  return DAY_BY_EMOJI[emoji] ?? null;
}

/** Emojis à ajouter au message, dans l'ordre des jours. */
export const REACTION_EMOJIS: string[] = DAYS.map((d) => EMOJI_BY_DAY[d]);
