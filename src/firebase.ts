import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Config } from './config.js';
import { log } from './logger.js';

let app: App | undefined;
let db: Firestore | undefined;

/**
 * Initialise le SDK Admin (une seule fois).
 *
 * ⚠️ L'Admin SDK contourne `firestore.rules`. Reginald écrit donc dans
 * `plazma-availability` en respectant STRICTEMENT le schéma ARCHI
 * (week, uid, playerId, days) pour rester cohérent avec l'UI.
 */
export function initFirestore(config: Config): Firestore {
  if (db) return db;

  const credential = config.firebaseServiceAccountPath
    ? cert(JSON.parse(readFileSync(config.firebaseServiceAccountPath, 'utf8')))
    : applicationDefault();

  app = initializeApp({
    credential,
    ...(config.firebaseProjectId ? { projectId: config.firebaseProjectId } : {}),
  });
  db = getFirestore(app);
  log.info('Firestore initialisé', { projectId: config.firebaseProjectId ?? '(auto)' });
  return db;
}

export function firestore(): Firestore {
  if (!db) throw new Error('Firestore non initialisé — appeler initFirestore() au démarrage.');
  return db;
}
