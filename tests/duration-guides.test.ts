import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES, estimateMinutes, parseConditions, parseMenu } from '../supabase/functions/_shared/menu.ts';
import { applyReplacement, parseReplacementRequest, parseReplacementResult } from '../supabase/functions/_shared/replacements.ts';
import { EXERCISE_GUIDES } from '../mobile/src/lib/exercise-guides.ts';

const input = { bodyParts: ['legs'], gymAvailable: true, durationMinutes: 10 };
const item = (exerciseId: string, sets = 2) => ({ exerciseId, sets, reps: 10, restSeconds: 60, reason: '対象部位を鍛えます。' });
const menu = { summary: '短時間で脚を鍛えます。', items: [item('leg-press'), item('glute-bridge')] };

test('duration accepts slider values and preserves compatibility with an older APK', () => {
  for (let durationMinutes = 10; durationMinutes <= 60; durationMinutes += 5) {
    assert.equal(parseConditions({ ...input, durationMinutes }).durationMinutes, durationMinutes);
  }
  assert.deepEqual(parseConditions({ bodyParts: ['legs'], gymAvailable: true }), { bodyParts: ['legs'], gymAvailable: true });
  for (const durationMinutes of [null, '30', 0, 5, 12, 30.5, 65, NaN, Infinity]) {
    assert.throws(() => parseConditions({ ...input, durationMinutes }));
  }
});

test('estimated time counts rest between sets, transitions, and both sides', () => {
  assert.equal(estimateMinutes({ summary: '', items: [item('squat')] }), 4);
  assert.equal(estimateMinutes({ summary: '', items: [item('dead-bug')] }), 5);
  assert.equal(estimateMinutes({ summary: '', items: [item('squat', 1)] }), 2);
});

test('accepts a menu within the selected duration and rejects an overlong AI result', () => {
  const conditions = parseConditions(input);
  assert.deepEqual(parseMenu(menu, conditions), menu);
  const long = { ...menu, items: [item('leg-press', 4), item('glute-bridge', 4)] };
  assert.ok(estimateMinutes(long) > input.durationMinutes);
  assert.throws(() => parseMenu(long, conditions));
  assert.deepEqual(parseMenu(long, { ...conditions, durationMinutes: 15 }), long);
  const exact = { ...menu, items: [item('leg-press', 3), item('glute-bridge', 3)] };
  assert.equal(estimateMinutes(exact), 10);
  assert.deepEqual(parseMenu(exact, conditions), exact);
  assert.throws(() => parseMenu({ ...exact, items: exact.items.map((entry) => ({ ...entry, reps: 11 })) }, conditions));
});

test('replacing an exercise retains the duration and rejects a replacement that exceeds it', () => {
  const request = parseReplacementRequest({ conditions: input, menu, targetExerciseId: 'leg-press', reason: 'equipment_busy' });
  assert.equal(request.conditions.durationMinutes, 10);
  assert.equal(applyReplacement(request, item('squat')).menu.items[0].exerciseId, 'squat');
  const overlong = { ...item('squat', 4), reps: 20, restSeconds: 180 };
  assert.throws(() => parseReplacementResult({ candidates: [overlong] }, request));
});

test('each offered exercise has its own complete guide, including replacement-only exercises', () => {
  assert.deepEqual(Object.keys(EXERCISE_GUIDES).sort(), EXERCISES.map(({ id }) => id).sort());
  for (const { id } of EXERCISES) {
    const guide = EXERCISE_GUIDES[id];
    assert.equal(guide.steps.length, 2, id);
    assert.ok(guide.steps.every((step) => step.trim().length > 0), id);
    assert.ok(guide.tip.trim().length > 0, id);
  }
});
