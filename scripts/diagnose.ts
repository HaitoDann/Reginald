/**
 * Diagnostic lecture seule (aucune écriture).
 *   npm run diagnose
 * Vérifie l'accès Firestore et affiche : roster réel (id + noms), comptes
 * users (pseudo → uid), semaine courante, dispos de la semaine, et l'état du
 * mapping plazma/discord-links. Sert à valider l'intégration avant tout write.
 */
import { loadConfig } from '../src/config.js';
import { initFirestore } from '../src/firebase.js';
import { getPlayers } from '../src/roster.js';
import { listUsers } from '../src/users.js';
import { getLinks } from '../src/links.js';
import { readWeek } from '../src/availability.js';
import { currentWeekValue } from '../src/week.js';

async function main() {
  const config = loadConfig();
  initFirestore(config);

  const week = currentWeekValue();
  console.log(`\n=== Semaine courante : ${week} ===\n`);

  const players = await getPlayers();
  console.log('--- Roster ARCHI (id → nom / rôle / statut) ---');
  for (const p of players) {
    const kind = p.roleKey === 'coach' ? 'coach' : p.starter ? 'titulaire' : 'remplaçant';
    console.log(`  ${p.id.padEnd(12)} ${p.name.padEnd(14)} ${p.role.padEnd(12)} [${kind}]`);
  }

  const users = await listUsers();
  console.log('\n--- Comptes users (username → uid) ---');
  for (const u of users) console.log(`  ${u.username.padEnd(16)} ${u.uid}`);

  const links = await getLinks();
  console.log('\n--- Mapping plazma/discord-links ---');
  const entries = Object.entries(links);
  if (entries.length === 0) console.log('  (vide)');
  for (const [discordId, l] of entries) {
    console.log(`  discord:${discordId} → playerId=${l.playerId} uid=${l.uid}`);
  }

  const avail = await readWeek(week);
  console.log('\n--- Disponibilités de la semaine ---');
  const keys = Object.keys(avail);
  if (keys.length === 0) console.log('  (aucune)');
  for (const pid of keys) console.log(`  ${pid.padEnd(12)} ${JSON.stringify(avail[pid])}`);

  console.log('\nOK — lecture seule terminée, rien n’a été écrit.\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('Diagnostic échoué :', e);
  process.exit(1);
});
