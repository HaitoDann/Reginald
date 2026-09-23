import { firestore } from './firebase.js';

/**
 * Dashboard ARCHI — lecture seule de `plazma/dashboard`.
 * Les « dates clés » (inscription tournoi, mercato, RDV…) sont saisies côté
 * ARCHI comme objectifs à échéance, plus l'« événement » principal.
 *   { objectives: [ {name, deadline:"YYYY-MM-DD", status} ], nextEvent, nextEventDate }
 */

export interface KeyDate {
  label: string;
  date: string; // YYYY-MM-DD
}

interface Objective {
  name?: string;
  deadline?: string;
  status?: string;
}

export async function keyDates(): Promise<KeyDate[]> {
  const snap = await firestore().collection('plazma').doc('dashboard').get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  const d = data as { objectives?: Objective[]; nextEvent?: string; nextEventDate?: string };

  const out: KeyDate[] = [];
  for (const o of d.objectives ?? []) {
    if (o.deadline && o.status !== 'done') {
      out.push({ label: o.name?.trim() || 'Objectif', date: o.deadline });
    }
  }
  if (d.nextEventDate) out.push({ label: d.nextEvent?.trim() || 'Événement', date: d.nextEventDate });
  return out;
}
