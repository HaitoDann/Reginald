import { DAYS, EMOJI_BY_DAY, type Day } from './days.js';
import { isYes, type WeekAvailability } from './availability.js';
import { frenchWeekRange } from './weeklabel.js';

export interface MessageOptions {
  /** ID du rôle Discord à mentionner en tête (ex. "Joueur Titulaire"), optionnel. */
  mentionRoleId?: string;
}

/** Effectif complet requis pour un créneau jouable. */
const FULL = 5;

export interface RosterSets {
  /** playerId des 5 titulaires (ids de slot ARCHI). */
  starterIds: string[];
  /** playerId des remplaçants liés (subs). */
  subIds: string[];
}

export interface DaySummary {
  day: Day;
  startersYes: number;
  subsYes: number;
  playable: boolean; // au moins 5 joueurs dispos (titulaires + éventuels subs)
  needsSub: boolean; // 5 atteint seulement grâce à un/des remplaçant(s)
}

export function summarizeDay(day: Day, avail: WeekAvailability, sets: RosterSets): DaySummary {
  const startersYes = sets.starterIds.filter((id) => isYes(avail[id], day)).length;
  const subsYes = sets.subIds.filter((id) => isYes(avail[id], day)).length;
  const total = startersYes + subsYes;
  const playable = total >= FULL;
  const needsSub = playable && startersYes < FULL;
  return { day, startersYes, subsYes, playable, needsSub };
}

/**
 * Construit le contenu du message hebdomadaire de disponibilités.
 * Une ligne par jour + un récap des créneaux jouables (5/5).
 *
 * ⚠️ 5/5 = "créneau disponible", PAS "scrim confirmé". Un scrim n'est annoncé
 * que s'il existe réellement dans le Planning ARCHI.
 */
export function renderAvailabilityMessage(
  week: string,
  avail: WeekAvailability,
  sets: RosterSets,
  opts: MessageOptions = {},
): string {
  const lines: string[] = [];
  if (opts.mentionRoleId) lines.push(`<@&${opts.mentionRoleId}>`);
  lines.push('📅 **Disponibilités de la semaine**');
  lines.push('Merci de réagir en fonction de vos jours de présence prévus !');
  lines.push('');
  lines.push(`📆 ${frenchWeekRange(week)}`);
  lines.push('');
  for (const day of DAYS) lines.push(`${EMOJI_BY_DAY[day]} ${day}`);

  // Récap 5/5 ajouté seulement s'il existe au moins un créneau complet, pour
  // que le message reste épuré tant qu'aucun jour n'est à 5/5.
  const playable = DAYS.map((d) => summarizeDay(d, avail, sets)).filter((s) => s.playable);
  if (playable.length > 0) {
    lines.push('');
    lines.push('__Créneaux 5/5__');
    for (const s of playable) {
      const tag = s.needsSub ? ` ⚠️ avec un sub (${s.startersYes}/5 titulaires)` : '';
      lines.push(`${EMOJI_BY_DAY[s.day]} **${s.day}** — 5/5${tag}`);
    }
    lines.push('_5/5 = créneau possible, pas un scrim confirmé (annoncé seulement s’il est planifié dans ARCHI)._');
  }

  return lines.join('\n');
}
