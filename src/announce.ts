import type { Slot } from './schedule.js';
import { typeLabel } from './schedule.js';
import type { KeyDate } from './dashboard.js';

const slotLine = (s: Slot): string => {
  const time = s.start ? `${s.start}${s.end ? `–${s.end}` : ''}` : 'heure à définir';
  const note = s.note ? ` — ${s.note}` : '';
  return `• **${typeLabel(s.type)}** (${time})${note}`;
};

/** Annonce « ce soir » : événements planifiés du jour. */
export function renderTonight(dayName: string, events: Slot[]): string | null {
  if (events.length === 0) return null;
  return [`📣 **Au programme ce soir — ${dayName}**`, ...events.map(slotLine)].join('\n');
}

/** Rappel de saisie de résultat pour les matchs de la veille. */
export function renderResultPrompt(dayName: string, events: Slot[]): string | null {
  const competitive = events.filter((s) => s.type === 'scrim' || s.type === 'match');
  if (competitive.length === 0) return null;
  return [
    `📝 **Résultat à renseigner — ${dayName}**`,
    ...competitive.map(slotLine),
    '',
    'Renseigne le score avec la commande **`/resultat`** (adversaire + V/D par game).',
  ].join('\n');
}

/** Rappels de dates clés (J-7 / J-1). `deltaDays` = jours restants. */
export function renderKeyDateReminder(items: { key: KeyDate; deltaDays: number }[]): string | null {
  if (items.length === 0) return null;
  const line = (k: KeyDate, d: number) => {
    const when = d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : `dans ${d} jours`;
    return `• **${k.label}** — ${when} (${k.date})`;
  };
  return ['📌 **Dates clés à venir**', ...items.map((i) => line(i.key, i.deltaDays))].join('\n');
}

/** Relance trimestrielle du questionnaire de satisfaction. */
export function renderSatisfactionReminder(): string {
  return [
    '🗳️ **Questionnaire de satisfaction**',
    "C'est l'heure du point trimestriel : merci de prendre 5 min pour remplir le questionnaire de satisfaction sur ARCHI.",
  ].join('\n');
}
