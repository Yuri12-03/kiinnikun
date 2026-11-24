import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY_PARTS, candidatesFor, EXERCISES, menuSchema, parseConditions, parseMenu } from '../supabase/functions/_shared/menu.ts';

const conditions = { bodyParts: ['legs'] as const, gymAvailable: false };
const validConditions = parseConditions(conditions);
const menu = { summary: '脚を中心に鍛えるメニューです。', items: [
  { exerciseId: 'squat', sets: 2, reps: 10, restSeconds: 60, reason: '脚全体の動きを確認します。' },
  { exerciseId: 'glute-bridge', sets: 2, reps: 10, restSeconds: 60, reason: '股関節の動きを補います。' },
] };

test('input rejects missing, non-boolean, unknown and duplicate values', () => {
  for (const invalid of [null, {}, { bodyParts: [], gymAvailable: false }, { bodyParts: ['legs'], gymAvailable: null },
    { bodyParts: ['legs'], gymAvailable: 'false' }, { bodyParts: ['unknown'], gymAvailable: true },
    { bodyParts: ['legs', 'legs'], gymAvailable: true }]) assert.throws(() => parseConditions(invalid));
  assert.deepEqual(parseConditions(conditions), conditions);
});

test('all body parts have at least two equipment-free candidates', () => {
  for (const { id } of BODY_PARTS) {
    const candidates = candidatesFor({ bodyParts: [id], gymAvailable: false });
    assert.ok(candidates.length >= 2, id);
    assert.ok(candidates.every((exercise) => !exercise.gymOnly));
  }
});

test('valid menu is parsed; schema only offers allowed exercise IDs', () => {
  assert.deepEqual(parseMenu(menu, validConditions), menu);
  const ids = menuSchema(validConditions).properties.items.items.properties.exerciseId.enum;
  assert.ok(!ids.includes('leg-press'));
  assert.ok(ids.includes('squat'));
});

test('rejects equipment violations, hallucinations, duplicates and unrelated exercises', () => {
  for (const id of ['leg-press', 'made-up-exercise', 'glute-bridge', 'crunch']) {
    assert.throws(() => parseMenu({ ...menu, items: [{ ...menu.items[0], exerciseId: id }, menu.items[1]] }, validConditions));
  }
});

test('rejects uncovered selected body parts and out-of-range numbers', () => {
  assert.throws(() => parseMenu(menu, { bodyParts: ['legs', 'arms'], gymAvailable: false }));
  for (const change of [{ sets: 0 }, { sets: 5 }, { reps: 2 }, { reps: 21 }, { reps: 10.5 }, { restSeconds: 0 },
    { restSeconds: 181 }, { reason: '' }]) {
    assert.throws(() => parseMenu({ ...menu, items: [{ ...menu.items[0], ...change }, menu.items[1]] }, validConditions));
  }
});

test('every combination of body parts can be covered within the six-exercise limit', () => {
  for (let mask = 1; mask < (1 << BODY_PARTS.length); mask++) {
    const bodyParts = BODY_PARTS.filter((_, index) => mask & (1 << index)).map(({ id }) => id);
    for (const gymAvailable of [false, true]) {
      const candidates = candidatesFor({ bodyParts, gymAvailable });
      assert.ok(bodyParts.every((part) => candidates.some((exercise) => exercise.bodyParts.includes(part))));
      const ids = new Set(bodyParts.map((part) => candidates.find((exercise) => exercise.bodyParts.includes(part))!.id));
      if (ids.size < 2) ids.add(candidates.find((exercise) => !ids.has(exercise.id))!.id);
      assert.ok(ids.size <= 6);
      parseMenu({ summary: '全選択部位をカバーします。', items: [...ids].map((exerciseId) => ({
        exerciseId, sets: 2, reps: 10, restSeconds: 60, reason: '対象部位の候補です。',
      })) }, { bodyParts, gymAvailable });
    }
  }
  assert.equal(new Set(EXERCISES.map(({ id }) => id)).size, EXERCISES.length);
});
