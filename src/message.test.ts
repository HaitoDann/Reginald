import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDay, type RosterSets } from './message.js';
import type { WeekAvailability } from './availability.js';

const sets: RosterSets = {
  starterIds: ['boulou', 'zugu', 'lakrael', 'ke1do', 'sayro'],
  subIds: ['haito'],
};

const yesAll = (ids: string[]): WeekAvailability =>
  Object.fromEntries(ids.map((id) => [id, { Lundi: 'yes' }]));

test('5/5 avec les 5 titulaires → pas de sub', () => {
  const s = summarizeDay('Lundi', yesAll(['boulou', 'zugu', 'lakrael', 'ke1do', 'sayro']), sets);
  assert.equal(s.playable, true);
  assert.equal(s.needsSub, false);
  assert.equal(s.startersYes, 5);
});

test('4 titulaires + 1 sub → 5/5 mais needsSub', () => {
  const s = summarizeDay('Lundi', yesAll(['boulou', 'zugu', 'lakrael', 'ke1do', 'haito']), sets);
  assert.equal(s.playable, true);
  assert.equal(s.needsSub, true);
  assert.equal(s.startersYes, 4);
  assert.equal(s.subsYes, 1);
});

test('un playerId inconnu (ni titulaire ni sub) ne compte pas', () => {
  const s = summarizeDay('Lundi', yesAll(['boulou', 'zugu', 'lakrael', 'ke1do', 'coach']), sets);
  assert.equal(s.startersYes, 4);
  assert.equal(s.playable, false);
});

test('moins de 5 dispos → non jouable', () => {
  const s = summarizeDay('Lundi', yesAll(['boulou', 'zugu']), sets);
  assert.equal(s.playable, false);
  assert.equal(s.needsSub, false);
});
