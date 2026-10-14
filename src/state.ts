import { firestore } from './firebase.js';

/**
 * État propre à Reginald (id du message hebdo à éditer), rangé dans un doc
 * dédié `plazma/reginald` pour ne pas toucher `plazma/config` d'ARCHI.
 *
 *   plazma/reginald = {
 *     availabilityMessage: { week, channelId, messageId }
 *   }
 */

const DOC = ['plazma', 'reginald'] as const;

export interface AvailabilityMessageRef {
  week: string;
  channelId: string;
  messageId: string;
}

export async function getAvailabilityMessageRef(): Promise<AvailabilityMessageRef | null> {
  const snap = await firestore().collection(DOC[0]).doc(DOC[1]).get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  return (data as { availabilityMessage?: AvailabilityMessageRef }).availabilityMessage ?? null;
}

export async function setAvailabilityMessageRef(ref: AvailabilityMessageRef): Promise<void> {
  await firestore()
    .collection(DOC[0])
    .doc(DOC[1])
    .set({ availabilityMessage: ref }, { merge: true });
}
