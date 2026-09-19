/**
 * Peuple le doc plazma/discord-links à partir d'un fichier mapping.json
 * (non versionné), organisé PAR RÔLE pour survivre aux mercatos.
 *
 *   npm run link -- --dry-run   # affiche ce qui serait écrit, sans écrire
 *   npm run link                # écrit réellement plazma/discord-links
 *
 * Format de mapping.json (à la racine, ou chemin via MAPPING_FILE) :
 *   {
 *     "starters": {
 *       "top":     { "discordId": "…", "pseudo": "boulou" },
 *       "jungle":  { "discordId": "…", "pseudo": "naiko"  },
 *       "mid":     { "discordId": "…", "pseudo": "lakrael" },
 *       "adc":     { "discordId": "…", "pseudo": "ke1d0"  },
 *       "support": { "discordId": "…", "pseudo": "joordy" }
 *     },
 *     "subs": [
 *       { "discordId": "…", "playerId": "haito", "pseudo": "haito" }
 *     ]
 *   }
 *
 * MERCATO : un rôle change de joueur → on met juste à jour discordId + pseudo
 * sous ce rôle. Le playerId (slot ARCHI) est résolu automatiquement depuis le
 * roster (roleKey → id de slot), donc rien à toucher ailleurs.
 *
 * - discordId : ID Discord EXACT (chaîne de 17-20 chiffres).
 * - pseudo    : username de connexion ARCHI (résout l'uid — option A).
 *               (ou fournir "uid" directement pour court-circuiter.)
 * - subs.playerId : id ARCHI du remplaçant (extra du roster, ou id dédié).
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { initFirestore, firestore } from '../src/firebase.js';
import { getPlayers } from '../src/roster.js';
import { uidForUsername } from '../src/users.js';
import type { LinkMap } from '../src/links.js';

interface RoleEntry {
  discordId: string;
  pseudo?: string;
  uid?: string;
}
interface SubEntry extends RoleEntry {
  playerId: string;
}
interface Mapping {
  starters?: Record<string, RoleEntry>;
  subs?: SubEntry[];
}

const isDiscordId = (v: unknown): boolean => /^\d{17,20}$/.test(String(v));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const file = process.env.MAPPING_FILE || 'mapping.json';

  const config = loadConfig();
  initFirestore(config);

  const mapping = JSON.parse(readFileSync(file, 'utf8')) as Mapping;
  const players = await getPlayers();
  // roleKey → id de slot ARCHI (top→boulou, jungle→zugu, …), depuis le roster réel.
  const slotByRole = new Map(players.filter((p) => p.starter).map((p) => [p.roleKey, p.id]));
  const validIds = new Set(players.map((p) => p.id));

  const links: LinkMap = {};
  const problems: string[] = [];

  async function resolveUid(e: RoleEntry, who: string): Promise<string | null> {
    if (e.uid) return e.uid;
    if (!e.pseudo) {
      problems.push(`ni uid ni pseudo pour ${who}`);
      return null;
    }
    const uid = await uidForUsername(e.pseudo);
    if (!uid) problems.push(`aucun compte users avec username="${e.pseudo}" (${who})`);
    return uid;
  }

  // ---- Titulaires (par rôle) ----
  for (const [role, e] of Object.entries(mapping.starters ?? {})) {
    const playerId = slotByRole.get(role);
    if (!playerId) {
      problems.push(`rôle inconnu du roster : "${role}" (attendus : ${[...slotByRole.keys()].join(', ')})`);
      continue;
    }
    if (!isDiscordId(e.discordId)) {
      problems.push(`discordId invalide pour ${role} : ${e.discordId}`);
      continue;
    }
    const uid = await resolveUid(e, role);
    if (!uid) continue;
    links[String(e.discordId)] = { playerId, uid };
  }

  // ---- Remplaçants ----
  for (const e of mapping.subs ?? []) {
    if (!isDiscordId(e.discordId)) {
      problems.push(`discordId invalide pour sub ${e.playerId} : ${e.discordId}`);
      continue;
    }
    if (!e.playerId) {
      problems.push('sub sans playerId');
      continue;
    }
    if (!validIds.has(e.playerId)) {
      // Autorisé mais signalé : le sub n'a pas de slot dans le roster ARCHI
      // (il comptera dans le 5/5 de Reginald mais n'apparaîtra pas dans la grille ARCHI).
      problems.push(`⚠️ sub playerId="${e.playerId}" absent du roster ARCHI (compté par Reginald, pas affiché dans ARCHI)`);
    }
    const uid = await resolveUid(e, `sub ${e.playerId}`);
    if (!uid) continue;
    links[String(e.discordId)] = { playerId: e.playerId, uid };
  }

  console.log('\n--- Liens résolus ---');
  for (const [d, l] of Object.entries(links)) {
    console.log(`  discord:${d} → playerId=${l.playerId} uid=${l.uid}`);
  }
  if (problems.length) {
    console.log('\n--- Remarques / problèmes ---');
    for (const p of problems) console.log(`  ${p}`);
  }

  if (dryRun) {
    console.log('\n[dry-run] Rien écrit. Retire --dry-run pour appliquer.\n');
    process.exit(0);
  }
  if (Object.keys(links).length === 0) {
    console.error('\nAucun lien valide — écriture annulée.\n');
    process.exit(1);
  }

  await firestore().collection('plazma').doc('discord-links').set({ links }, { merge: true });
  console.log(`\n✅ plazma/discord-links écrit (${Object.keys(links).length} liens).\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error('link-players échoué :', e);
  process.exit(1);
});
