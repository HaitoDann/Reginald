import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTonight,
  renderResultPrompt,
  renderKeyDateReminder,
} from './announce.js';
import type { Slot } from './schedule.js';

const scrim: Slot = { type: 'scrim', start: '21:00', end: '23:00', note: 'vs TeamX' };
const soloq: Slot = { type: 'soloq', start: '18:00' };

test('renderTonight — liste les événements, null si aucun', () => {
  assert.equal(renderTonight('Jeudi', []), null);
  const msg = renderTonight('Jeudi', [scrim, soloq]);
  assert.match(msg!, /ce soir — Jeudi/);
  assert.match(msg!, /Scrim.*21:00–23:00.*vs TeamX/);
});

test('renderResultPrompt — ne cible que scrim/match', () => {
  assert.equal(renderResultPrompt('Jeudi', [soloq]), null); // soloq → pas de résultat
  const msg = renderResultPrompt('Jeudi', [scrim]);
  assert.match(msg!, /\/resultat/);
});

test('renderKeyDateReminder — formate J-1 / J-7', () => {
  const msg = renderKeyDateReminder([
    { key: { label: 'Inscription tournoi', date: '2026-10-01' }, deltaDays: 7 },
    { key: { label: 'RDV coach', date: '2026-09-25' }, deltaDays: 1 },
  ]);
  assert.match(msg!, /Inscription tournoi.*dans 7 jours/);
  assert.match(msg!, /RDV coach.*demain/);
  assert.equal(renderKeyDateReminder([]), null);
});
