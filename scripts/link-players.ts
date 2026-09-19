/**
 * Peuple le doc plazma/discord-links à partir d'un fichier mapping.json
 * (non versionné). Résout l'uid Firebase depuis le pseudo ARCHI (option A).
 *
 *   npm run link -- --dry-run   # affiche ce qui serait écrit, sans écrire
 *   npm run link                # écrit réellement plazma/discord-links
 *
 * Format attendu de mapping.json (à la racine, ou chemin via MAPPING_FILE) :
 *   [
 *     { "discordId": "391342015285166080", "playerId": "boulou", "pseudo": "boulou" },
 *     { "discordId": "...",                "playerId": "zugu",   "pseudo": "naiko"   }
 *   ]
 * - discordId : ID Discord EXACT (chaîne, pas un nombre).
 * - playerId  : id de slot/extra RÉEL du roster ARCHI (cf. npm run diagnose).
 * - pseudo    : username de connexion ARCHI (sert à retrouver l'uid).
 *   (ou fournir "uid" directement pour court-circuiter la résolution.)
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { initFirestore, firestore } from '../src/firebase.js';
import { getPlayers } from '../src/roster.js';
import { uidForUsername } from '../src/users.js';
import type { LinkMap } from '../src/links.js';

interface Entry {
  discordId: string;
  playerId: string;
  pseudo?: string;
  uid?: string;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const file = process.env.MAPPING_FILE || 'mapping.json';

  const config = loadConfig();
  initFirestore(config);

  const raw = readFileSync(file, 'utf8');
  const entries = JSON.parse(raw) as Entry[];
  if (!Array.isArray(entries)) throw new Error(`${file} doit contenir un tableau JSON.`);

  const validIds = new Set((await getPlayers()).map((p) => p.id));
  const links: LinkMap = {};
  const problems: string[] = [];

  for (const e of entries) {
    if (!/^\d{17,20}$/.test(String(e.discordId))) {
      problems.push(`discordId invalide (doit être 17-20 chiffres) : ${e.discordId}`);
      continue;
    }
    if (!validIds.has(e.playerId)) {
      problems.push(`playerId inconnu du roster ARCHI : "${e.playerId}" (voir npm run diagnose)`);
      continue;
    }
    let uid = e.uid;
    if (!uid) {
      if (!e.pseudo) {
        problems.push(`ni uid ni pseudo pour ${e.playerId}`);
        continue;
      }
      const resolved = await uidForUsername(e.pseudo);
      if (!resolved) {
        problems.push(`aucun compte users avec username="${e.pseudo}" (pour ${e.playerId})`);
        continue;
      }
      uid = resolved;
    }
    links[String(e.discordId)] = { playerId: e.playerId, uid };
  }

  console.log('\n--- Liens résolus ---');
  for (const [d, l] of Object.entries(links)) {
    console.log(`  discord:${d} → playerId=${l.playerId} uid=${l.uid}`);
  }
  if (problems.length) {
    console.log('\n--- Problèmes (ignorés) ---');
    for (const p of problems) console.log(`  ⚠️  ${p}`);
  }

  if (dryRun) {
    console.log('\n[dry-run] Rien écrit. Retire --dry-run pour appliquer.\n');
    process.exit(problems.length ? 2 : 0);
  }
  if (Object.keys(links).length === 0) {
    console.error('\nAucun lien valide — écriture annulée.\n');
    process.exit(1);
  }

  await firestore().collection('plazma').doc('discord-links').set({ links }, { merge: true });
  console.log(`\n✅ plazma/discord-links écrit (${Object.keys(links).length} liens).\n`);
  process.exit(problems.length ? 2 : 0);
}

main().catch((e) => {
  console.error('link-players échoué :', e);
  process.exit(1);
});
