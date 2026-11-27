import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES, type MenuItem } from '../supabase/functions/_shared/menu.ts';
import { applyReplacement, EXERCISE_PROFILES, exclusionsAfter, parseReplacementRequest, parseReplacementResult, replacementCandidates, replacementSchema } from '../supabase/functions/_shared/replacements.ts';
import { replaceInProposal } from '../mobile/src/state/proposal.ts';

const item = (exerciseId: string): MenuItem => ({ exerciseId, sets: 2, reps: 10, restSeconds: 60, reason: '選んだ部位を鍛える種目です。' });
const input = {
  conditions: { bodyParts: ['legs'], gymAvailable: true },
  menu: { summary: '脚のメニューです。', items: [item('leg-press'), item('glute-bridge')] },
  targetExerciseId: 'leg-press', reason: 'equipment_busy', exclusions: { equipment: [], exerciseIds: [] },
};

test('every exercise has explicit focus, movement, and difficulty metadata', () => {
  for (const exercise of EXERCISES) {
    const profile = EXERCISE_PROFILES[exercise.id];
    assert.ok(profile?.focus && profile.movement && [1, 2, 3].includes(profile.difficulty), exercise.id);
  }
});

test('rejects invalid target, reason, exclusions, menu, and equipment-free equipment excuses', () => {
  for (const change of [{ targetExerciseId: 'squat' }, { reason: 'pain' }, { reason: 'anything' }, { menu: {} },
    { exclusions: { equipment: ['自重'], exerciseIds: [] } }, { exclusions: { equipment: [], exerciseIds: ['unknown'] } },
    { targetExerciseId: 'glute-bridge', reason: 'equipment_missing' }]) assert.throws(() => parseReplacementRequest({ ...input, ...change }));
});

test('equipment reason excludes the unavailable equipment and current menu; matches specific muscle focus', () => {
  const request = parseReplacementRequest(input), candidates = replacementCandidates(request);
  assert.ok(candidates.some(({ id }) => id === 'squat'));
  assert.ok(!candidates.some(({ id }) => ['leg-press', 'glute-bridge', 'calf-raise', 'leg-curl'].includes(id)));
  assert.ok(candidates.every((exercise) => EXERCISE_PROFILES[exercise.id].focus === '太もも前側'));
  assert.deepEqual(exclusionsAfter(request), { equipment: ['レッグプレスマシン'], exerciseIds: ['leg-press'] });
});

test('too difficult offers strictly lower difficulty and respects gym-free input', () => {
  const request = parseReplacementRequest({ ...input, conditions: { bodyParts: ['legs'], gymAvailable: false },
    menu: { ...input.menu, items: [item('squat'), item('glute-bridge')] }, targetExerciseId: 'squat', reason: 'too_difficult' });
  assert.deepEqual(replacementCandidates(request).map(({ id }) => id), ['shallow-squat']);
  assert.equal(exclusionsAfter(request).equipment.length, 0);
});

test('cannot substitute an unrelated leg exercise when no adequate candidate remains', () => {
  const request = parseReplacementRequest({ ...input, menu: { ...input.menu, items: [item('calf-raise'), item('glute-bridge')] }, targetExerciseId: 'calf-raise', reason: 'too_difficult' });
  assert.deepEqual(replacementCandidates(request), []);
  assert.deepEqual(parseReplacementResult({ candidates: [] }, request), { candidates: [] });
});

test('validates AI alternatives, numeric ranges, duplicates, and allowed IDs', () => {
  const request = parseReplacementRequest(input);
  assert.deepEqual(parseReplacementResult({ candidates: [item('squat')] }, request).candidates, [item('squat')]);
  for (const candidates of [[item('calf-raise')], [item('leg-press')], [item('squat'), item('squat')], [{ ...item('squat'), sets: 20 }],
    [item('squat'), item('shallow-squat'), item('leg-extension'), item('squat')]]) assert.throws(() => parseReplacementResult({ candidates }, request));
  const allowed = replacementSchema(request).properties.candidates.items.properties.exerciseId.enum;
  assert.ok(!allowed.includes('calf-raise'));
});

test('preserves selected body-part coverage when changing one item', () => {
  const request = parseReplacementRequest({ ...input, conditions: { bodyParts: ['chest', 'arms'], gymAvailable: true },
    menu: { summary: '胸と腕を鍛えます。', items: [item('chest-press'), item('pec-fly')] }, targetExerciseId: 'chest-press' });
  assert.ok(!replacementCandidates(request).some(({ id }) => id === 'pec-fly'));
  assert.ok(replacementCandidates(request).some(({ id }) => id === 'wall-push-up'));
});

test('application changes exactly one item and preserves original input', () => {
  const request = parseReplacementRequest(input), before = JSON.stringify(request);
  const updated = applyReplacement(request, item('squat'));
  assert.equal(updated.menu.items[0].exerciseId, 'squat');
  assert.strictEqual(updated.menu.items[1], request.menu.items[1]);
  assert.equal(JSON.stringify(request), before);
  assert.ok(updated.exclusions.exerciseIds.includes('leg-press'));
});

test('equipment and exercise exclusions carry over to later replacements', () => {
  const first = parseReplacementRequest(input), updated = applyReplacement(first, item('squat'));
  const next = parseReplacementRequest({ ...first, ...updated, targetExerciseId: 'squat', reason: 'too_difficult' });
  const candidates = replacementCandidates(next);
  assert.ok(!candidates.some(({ id }) => id === 'leg-press'));
  assert.ok(candidates.some(({ id }) => id === 'shallow-squat'));
  const unavailable = parseReplacementRequest({ ...input, exclusions: { equipment: ['レッグエクステンションマシン'], exerciseIds: ['squat'] } });
  assert.ok(!replacementCandidates(unavailable).some(({ id }) => ['leg-extension', 'squat'].includes(id)));
});

test('stale proposals and candidates for a different menu cannot be applied', () => {
  const request = parseReplacementRequest(input);
  const proposal = { conditions: request.conditions, menu: request.menu };
  assert.throws(() => replaceInProposal({ ...proposal }, proposal, request, item('squat')), /メニューが更新/);
  assert.throws(() => replaceInProposal(null, proposal, request, item('squat')), /メニューが更新/);
  const changed = { ...request, menu: { ...request.menu, summary: 'different snapshot' } };
  assert.throws(() => replaceInProposal(proposal, proposal, changed, item('squat')), /メニューが更新/);
  assert.equal(replaceInProposal(proposal, proposal, request, item('squat')).menu.items[0].exerciseId, 'squat');
});
