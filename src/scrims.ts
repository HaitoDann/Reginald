import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from './firebase.js';
import { log } from './logger.js';

/**
 * Écriture d'un résultat de scrim dans `plazma-scrims` — MÊME format qu'ARCHI
 * (plazma-scrim.html) pour qu'il apparaisse dans l'historique du site :
 *   doc id : scrim-<ts36>-<rand>
 *   { m_date, m_adv, s_plazma, s_adv, g1_result…g5_result ('V'|'D'|''),
 *     t_bien, t_corriger, f_note, f_comment, errors{g1..g5:[]},
 *     strengths{g1..g5:[]}, _savedAt: serverTimestamp }
 */

const SCRIMS_COL = 'plazma-scrims';

const newDocId = (): string =>
  'scrim-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

export interface ScrimResult {
  date: string; // YYYY-MM-DD
  opponent: string;
  games: ('V' | 'D')[]; // résultat par game, dans l'ordre
  note?: string;
}

export async function saveScrimResult(r: ScrimResult): Promise<string> {
  const s_plazma = r.games.filter((g) => g === 'V').length;
  const s_adv = r.games.filter((g) => g === 'D').length;

  const doc: Record<string, unknown> = {
    m_date: r.date,
    m_adv: r.opponent,
    s_plazma: String(s_plazma),
    s_adv: String(s_adv),
    t_bien: '',
    t_corriger: '',
    f_note: '',
    f_comment: r.note ?? '',
    errors: { g1: [], g2: [], g3: [], g4: [], g5: [] },
    strengths: { g1: [], g2: [], g3: [], g4: [], g5: [] },
    _savedAt: FieldValue.serverTimestamp(),
  };
  for (let g = 1; g <= 5; g++) doc[`g${g}_result`] = r.games[g - 1] ?? '';

  const id = newDocId();
  await firestore().collection(SCRIMS_COL).doc(id).set(doc);
  log.info('Résultat de scrim enregistré', { id, opponent: r.opponent, score: `${s_plazma}-${s_adv}` });
  return id;
}
