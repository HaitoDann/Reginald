import { firestore } from './firebase.js';
import { log } from './logger.js';

/**
 * Lecture du roster ARCHI — PORTAGE de `assets/plazma.js` (getPlayers()).
 * Source : doc `plazma/roster`.
 *   { <slotId>: { name, emoji }, _extras: [ { id, name, emoji, role } ] }
 * On NE recrée PAS le roster : on lit celui d'ARCHI et on résout les overrides.
 */

export interface Player {
  id: string; // Player ID ARCHI (clé de slot). Ex: "boulou", ou id d'extra.
  name: string;
  emoji: string;
  role: string;
  roleKey: string;
  starter: boolean; // true = 5 titulaires ; false = coach / remplaçant (extra)
}

interface Slot {
  id: string;
  roleKey: string;
  role: string;
  defaultName: string;
  defaultEmoji: string;
}

// Slots fixes — identiques à ROSTER_SLOTS d'ARCHI.
const ROSTER_SLOTS: Slot[] = [
  { id: 'boulou', roleKey: 'top', role: 'Top', defaultName: 'Boulou', defaultEmoji: '👍' },
  { id: 'zugu', roleKey: 'jungle', role: 'Jungle', defaultName: 'Zugu', defaultEmoji: '🕊️' },
  { id: 'lakrael', roleKey: 'mid', role: 'Mid', defaultName: 'Lakraël', defaultEmoji: '👀' },
  { id: 'ke1do', roleKey: 'adc', role: 'ADC', defaultName: 'Ke1do', defaultEmoji: '🐯' },
  { id: 'sayro', roleKey: 'support', role: 'Support', defaultName: 'Joordy', defaultEmoji: '🥀' },
];
const COACH_SLOT: Slot = {
  id: 'coach',
  roleKey: 'coach',
  role: 'Head Coach',
  defaultName: 'Coach',
  defaultEmoji: '♟️',
};

interface Override {
  name?: string;
  emoji?: string;
}
interface Extra {
  id: string;
  name?: string;
  emoji?: string;
  role?: string;
}

function resolve(slot: Slot, ov: Override | undefined, starter: boolean): Player {
  return {
    id: slot.id,
    roleKey: slot.roleKey,
    role: slot.role,
    name: ov?.name?.trim() || slot.defaultName,
    emoji: ov?.emoji?.trim() || slot.defaultEmoji,
    starter,
  };
}

/** Effectif complet : 5 titulaires + coach + remplaçants (extras). */
export async function getPlayers(): Promise<Player[]> {
  const snap = await firestore().collection('plazma').doc('roster').get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  const extras: Extra[] = Array.isArray((data as { _extras?: Extra[] })._extras)
    ? ((data as { _extras: Extra[] })._extras)
    : [];
  const overrides = data as Record<string, Override>;

  const starters = ROSTER_SLOTS.map((s) => resolve(s, overrides[s.id], true));
  const coach = resolve(COACH_SLOT, overrides[COACH_SLOT.id], false);
  const subs: Player[] = extras.map((e) => ({
    id: e.id,
    roleKey: 'extra',
    role: e.role?.trim() || 'Joueur',
    name: e.name?.trim() || 'Joueur',
    emoji: e.emoji?.trim() || '🎮',
    starter: false,
  }));

  log.debug('Roster chargé', { starters: starters.length, subs: subs.length });
  return [...starters, coach, ...subs];
}
