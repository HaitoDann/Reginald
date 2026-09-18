import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDay } from './message.js';
import type { Player } from './roster.js';
import type { WeekAvailability } from './availability.js';

const starters: Player[] = [
  { id: 'boulou', name: 'Boulou', emoji: '👍', role: 'Top', roleKey: 'top', starter: true },
  { id: 'zugu', name: 'Zugu', emoji: '🕊️', role: 'Jungle', roleKey: 'jungle', starter: true },
  { id: 'lakrael', name: 'Lakraël', emoji: '👀', role: 'Mid', roleKey: 'mid', starter: true },
  { id: 'ke1do', name: 'Ke1do', emoji: '🐯', role: 'ADC', roleKey: 'adc', starter: true },
  { id: 'sayro', name: 'Joordy', emoji: '🥀', role: 'Support', roleKey: 'support', starter: true },
];
const sub: Player = { id: 'sub1', name: 'Sub', emoji: '🎮', role: 'Joueur', roleKey: 'extra', starter: false };
const coach: Player = { id: 'coach', name: 'Coach', emoji: '♟️', role: 'Head Coach', roleKey: 'coach', starter: false };

const yesAll = (ids: string[]): WeekAvailability =>
  Object.fromEntries(ids.map((id) => [id, { Lundi: 'yes' }]));

test('5/5 avec les 5 titulaires → pas de sub', () => {
  const s = summarizeDay('Lundi', starters, yesAll(['boulou', 'zugu', 'lakrael', 'ke1do', 'sayro']));
  assert.equal(s.playable, true);
  assert.equal(s.needsSub, false);
  assert.equal(s.startersYes, 5);
});

test('4 titulaires + 1 sub → 5/5 mais needsSub', () => {
  const players = [...starters, sub];
  const s = summarizeDay('Lundi', players, yesAll(['boulou', 'zugu', 'lakrael', 'ke1do', 'sub1']));
  assert.equal(s.playable, true);
  assert.equal(s.needsSub, true);
  assert.equal(s.startersYes, 4);
  assert.equal(s.subsYes, 1);
});

test('le coach ne compte pas dans le 5/5', () => {
  const players = [...starters, coach];
  const s = summarizeDay('Lundi', players, yesAll(['boulou', 'zugu', 'lakrael', 'ke1do', 'coach']));
  assert.equal(s.startersYes, 4);
  assert.equal(s.playable, false);
});

test('moins de 5 dispos → non jouable', () => {
  const s = summarizeDay('Lundi', starters, yesAll(['boulou', 'zugu']));
  assert.equal(s.playable, false);
  assert.equal(s.needsSub, false);
});
