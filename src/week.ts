/**
 * Calcul de la clé de semaine — PORTAGE FIDÈLE d'ARCHI (plazma-schedule.html).
 * Format : "YYYY-Www" (ex. "2026-W38"). Cette clé est partagée avec ARCHI via
 * le champ `week` des docs `plazma-availability`; elle DOIT rester identique,
 * sinon les documents ne se croisent pas.
 *
 * ARCHI raisonne en heure locale du navigateur (joueurs en France). Reginald
 * raisonne en Europe/Paris : on extrait d'abord la date civile de Paris, puis
 * on applique le même algorithme de numéro de semaine.
 */

const PARIS = 'Europe/Paris';

/** Retourne l'année/mois/jour civils à Paris pour un instant donné. */
function parisYMD(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Numéro de semaine ISO — identique à `getWeekNum` d'ARCHI.
 * (Semaine ISO 8601 : la semaine contenant le jeudi.)
 */
export function getWeekNum(year: number, month1to12: number, day: number): number {
  const d = new Date(Date.UTC(year, month1to12 - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const y1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y1.getTime()) / 86400000 + 1) / 7);
}

/**
 * Clé de semaine pour un instant donné (défaut : maintenant), en heure de Paris.
 * Attention : l'année utilisée est l'année civile (comme ARCHI), pas l'année
 * ISO — c'est volontaire pour rester bit-à-bit compatible avec ARCHI.
 */
export function weekValue(date: Date = new Date()): string {
  const { year, month, day } = parisYMD(date);
  const wk = getWeekNum(year, month, day);
  return `${year}-W${String(wk).padStart(2, '0')}`;
}

export const currentWeekValue = (): string => weekValue(new Date());

// ---- Semaine « active » (publication anticipée le samedi) ----
// Le message d'une semaine est publié le SAMEDI 08:00 (Paris) du week-end
// précédent, pour laisser le temps aux joueurs de répondre. Donc du samedi 08h
// au dimanche soir, la semaine active est la semaine SUIVANTE.
export const ROLL_WEEKDAY = 6; // 0=dim … 6=sam
export const ROLL_HOUR = 8; // 08:00 heure de Paris

/** Jour de la semaine (0=dim..6=sam) et heure (0-23) en heure de Paris. */
function parisWeekdayHour(date: Date): { weekday: number; hour: number } {
  const { year, month, day } = parisYMD(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: PARIS,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).find((p) => p.type === 'hour')?.value,
  );
  return { weekday, hour };
}

/**
 * Clé de la semaine dont Reginald doit afficher le message à l'instant donné.
 * - Samedi ≥ 08:00 (Paris) ou dimanche → la semaine suivante.
 * - Sinon → la semaine courante.
 * Idempotent : appelé en boucle, il ne « bascule » qu'au bon moment.
 */
export function activeWeekValue(now: Date = new Date()): string {
  const { weekday, hour } = parisWeekdayHour(now);
  const roll = (weekday === ROLL_WEEKDAY && hour >= ROLL_HOUR) || weekday === 0;
  if (!roll) return weekValue(now);
  // On saute franchement dans la semaine suivante (robuste aux bords/DST).
  return weekValue(new Date(now.getTime() + 3 * 86400000));
}
