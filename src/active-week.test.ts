import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeWeekValue, weekValue } from './week.js';

// Semaine du 14/09/2026 (lundi) = S38 ; semaine suivante (21/09) = S39.
test('mercredi → semaine courante', () => {
  const wed = new Date('2026-09-16T09:00:00Z'); // 11h Paris, mercredi
  assert.equal(activeWeekValue(wed), '2026-W38');
});

test('samedi 07:00 Paris (avant 8h) → encore la semaine courante', () => {
  const sat = new Date('2026-09-19T05:00:00Z'); // 07h Paris (été, +2), samedi
  assert.equal(activeWeekValue(sat), '2026-W38');
});

test('samedi 08:00 Paris → bascule sur la semaine suivante', () => {
  const sat = new Date('2026-09-19T06:00:00Z'); // 08h Paris, samedi
  assert.equal(activeWeekValue(sat), '2026-W39');
});

test('dimanche → semaine suivante', () => {
  const sun = new Date('2026-09-20T12:00:00Z'); // 14h Paris, dimanche
  assert.equal(activeWeekValue(sun), '2026-W39');
});

test('lundi → nouvelle semaine courante (plus de bascule)', () => {
  const mon = new Date('2026-09-21T09:00:00Z');
  assert.equal(activeWeekValue(mon), weekValue(mon));
  assert.equal(activeWeekValue(mon), '2026-W39');
});
