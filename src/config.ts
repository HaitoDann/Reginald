import { loadEnv } from './env.js';

loadEnv();

export interface Config {
  discordToken: string;
  guildId: string;
  availabilityChannelId: string;
  firebaseServiceAccountPath: string | undefined;
  firebaseProjectId: string | undefined;
  timezone: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value.trim();
}

export function loadConfig(): Config {
  const timezone = process.env.TZ || 'Europe/Paris';
  if (timezone !== 'Europe/Paris') {
    // Reginald raisonne en heure de Paris (semaines/jours alignés sur ARCHI).
    // On tolère une surcharge mais on la signale.
    // eslint-disable-next-line no-console
    console.warn(`[config] TZ=${timezone} ≠ Europe/Paris — les semaines peuvent diverger d'ARCHI.`);
  }
  return {
    discordToken: required('DISCORD_TOKEN'),
    guildId: required('DISCORD_GUILD_ID'),
    availabilityChannelId: required('DISCORD_AVAILABILITY_CHANNEL_ID'),
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || undefined,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined,
    timezone,
  };
}
