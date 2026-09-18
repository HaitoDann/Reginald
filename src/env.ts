import { readFileSync, existsSync } from 'node:fs';

/**
 * Charge un fichier .env dans process.env (sans dépendance externe).
 * N'écrase jamais une variable déjà définie dans l'environnement réel.
 * Silencieux si le fichier n'existe pas (ex. secrets injectés par systemd).
 */
export function loadEnv(path = '.env'): void {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Retire d'éventuels guillemets entourants.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
