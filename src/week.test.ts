import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekNum, weekValue } from './week.js';

// Valeurs de référence calculées avec l'algo d'ARCHI (getWeekNum).
test('getWeekNum — semaines ISO connues', () => {
  assert.equal(getWeekNum(2026, 1, 1), 1);
  assert.equal(getWeekNum(2026, 9, 18), 38); // 18 sept. 2026 = S38
  assert.equal(getWeekNum(2025, 12, 29), 1); // lundi 29/12/2025 → S1 2026 (ISO)
});

test('weekValue — format YYYY-Www à Paris', () => {
  // Midi UTC le 18/09/2026 = 14h à Paris, même date civile.
  const d = new Date('2026-09-18T12:00:00Z');
  assert.equal(weekValue(d), '2026-W38');
});

test('weekValue — bascule de jour selon Paris', () => {
  // 23h30 UTC le 18/09 = 01h30 Paris le 19/09 (toujours S38 ici).
  const d = new Date('2026-09-18T23:30:00Z');
  assert.equal(weekValue(d), '2026-W38');
});
