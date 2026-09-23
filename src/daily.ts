import { Client, type TextChannel } from 'discord.js';
import type { Config } from './config.js';
import { log } from './logger.js';
import { parisClock, parisDateStr, parisDayName } from './week.js';
import { eventsForDate } from './schedule.js';
import { keyDates } from './dashboard.js';
import { getJobs, setJobDay } from './state.js';
import {
  renderTonight,
  renderResultPrompt,
  renderKeyDateReminder,
  renderSatisfactionReminder,
} from './announce.js';

// Heures de déclenchement (heure de Paris).
const HOUR_TONIGHT = 14; // annonce des événements du soir
const HOUR_RESULT = 0; // rappel de saisie de résultat (après minuit)
const HOUR_KEYDATES = 10; // rappels dates clés + relance satisfaction
const SATISFACTION_PERIOD_DAYS = 90;

const YESTERDAY = (now: Date) => new Date(now.getTime() - 24 * 3600 * 1000);

function dayDiff(fromISO: string, toISO: string): number {
  const [ay, am, ad] = fromISO.split('-').map(Number);
  const [by, bm, bd] = toISO.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

async function post(client: Client, channelId: string, content: string): Promise<void> {
  const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
  if (!channel?.isTextBased()) {
    log.warn('Salon d’annonce introuvable', { channelId });
    return;
  }
  await channel.send({ content, allowedMentions: { parse: [] } });
}

/**
 * Exécute les jobs quotidiens dus. Appelé à chaque tick (toutes les 5 min) :
 * chaque job ne s'exécute qu'une fois par jour (marqueur persistant), et
 * rattrape après un redémarrage.
 */
export async function runDailyJobs(client: Client, config: Config): Promise<void> {
  const now = new Date();
  const today = parisDateStr(now);
  const { hour } = parisClock(now);
  const jobs = await getJobs();

  const due = (name: string, atHour: number) => hour >= atHour && jobs[name] !== today;

  // A — Annonce des événements du soir (14h).
  if (due('eventsTonight', HOUR_TONIGHT)) {
    try {
      const events = await eventsForDate(now);
      const msg = renderTonight(parisDayName(now), events);
      if (msg) await post(client, config.announceChannelId, msg);
      await setJobDay('eventsTonight', today);
    } catch (e) {
      log.warn('Job eventsTonight échoué', { err: String(e) });
    }
  }

  // C — Rappel de saisie de résultat pour la veille (après minuit).
  if (due('resultPrompt', HOUR_RESULT)) {
    try {
      const y = YESTERDAY(now);
      const events = await eventsForDate(y);
      const msg = renderResultPrompt(parisDayName(y), events);
      if (msg) await post(client, config.announceChannelId, msg);
      await setJobDay('resultPrompt', today);
    } catch (e) {
      log.warn('Job resultPrompt échoué', { err: String(e) });
    }
  }

  // B — Dates clés (J-7 / J-1) + relance satisfaction trimestrielle (10h).
  if (due('keyDates', HOUR_KEYDATES)) {
    try {
      const items = (await keyDates())
        .map((key) => ({ key, deltaDays: dayDiff(today, key.date) }))
        .filter((i) => i.deltaDays === 7 || i.deltaDays === 1);
      const msg = renderKeyDateReminder(items);
      if (msg) await post(client, config.announceChannelId, msg);

      // Relance satisfaction : ancre à aujourd'hui au 1er passage, puis tous
      // les 90 jours.
      const anchor = jobs.satisfactionAnchor;
      if (!anchor) {
        await setJobDay('satisfactionAnchor', today);
      } else if (dayDiff(anchor, today) >= SATISFACTION_PERIOD_DAYS) {
        await post(client, config.announceChannelId, renderSatisfactionReminder());
        await setJobDay('satisfactionAnchor', today);
      }

      await setJobDay('keyDates', today);
    } catch (e) {
      log.warn('Job keyDates échoué', { err: String(e) });
    }
  }
}
