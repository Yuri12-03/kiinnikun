import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY_PARTS } from '../supabase/functions/_shared/menu.ts';
import { historyReason, parseTrainingHistory, RECENT_TRAINING_MS, recommendParts } from '../mobile/src/lib/training-history.ts';

const now = Date.parse('2026-11-27T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
const history = (parts: Record<string, string>) => parseTrainingHistory({ serverNow: new Date(now).toISOString(), lastGeneratedAt: parts });

test('unrecorded parts are first, with deterministic ties and a maximum of two', () => {
  assert.deepEqual(recommendParts(history({})).map(({ id }) => id), ['chest', 'back']);
  assert.deepEqual(recommendParts(history({ chest: hoursAgo(500), back: hoursAgo(72) })).map(({ id }) => id), ['shoulders', 'arms']);
});

test('recently generated parts are excluded; exactly 48 hours is eligible', () => {
  const data = history(Object.fromEntries(BODY_PARTS.map(({ id }) => [id, hoursAgo(24)])));
  assert.deepEqual(recommendParts(data), []);
  assert.deepEqual(recommendParts(data, now + 24 * 3_600_000 - 1), []);
  assert.deepEqual(recommendParts(data, now + 24 * 3_600_000).map(({ id }) => id), ['chest', 'back']);
  assert.equal(RECENT_TRAINING_MS, 48 * 3_600_000);
});

test('oldest eligible parts are prioritized across JST day boundaries', () => {
  const data = history({ chest: hoursAgo(60), back: hoursAgo(50), shoulders: hoursAgo(90), arms: hoursAgo(12), core: hoursAgo(80), legs: hoursAgo(49) });
  assert.deepEqual(recommendParts(data).map(({ id }) => id), ['shoulders', 'core']);
  assert.equal(historyReason(recommendParts(data)[0], now), '前回の生成から3日');
});

test('repeated generation updates exclusion for each selected part', () => {
  const previous = history({ chest: hoursAgo(70), back: hoursAgo(90), shoulders: hoursAgo(10), arms: hoursAgo(10), core: hoursAgo(10), legs: hoursAgo(10) });
  assert.deepEqual(recommendParts(previous).map(({ id }) => id), ['back', 'chest']);
  const updated = history({ chest: hoursAgo(0), back: hoursAgo(0), shoulders: hoursAgo(10), arms: hoursAgo(10), core: hoursAgo(10), legs: hoursAgo(10) });
  assert.deepEqual(recommendParts(updated), []);
});

test('a single eligible part is shown alone and unseen labels never claim prior training', () => {
  const data = history({ chest: hoursAgo(1), back: hoursAgo(1), shoulders: hoursAgo(1), arms: hoursAgo(1), core: hoursAgo(1) });
  assert.deepEqual(recommendParts(data).map(({ id }) => id), ['legs']);
  assert.equal(historyReason(recommendParts(data)[0], now), '記録なし');
});

test('invalid history is an error rather than an empty history', () => {
  for (const data of [null, {}, { serverNow: 'bad', lastGeneratedAt: {} }, { serverNow: new Date(now).toISOString(), lastGeneratedAt: [] },
    { serverNow: new Date(now).toISOString(), lastGeneratedAt: { unknown: hoursAgo(10) } },
    { serverNow: new Date(now).toISOString(), lastGeneratedAt: { legs: 'invalid' } },
    { serverNow: new Date(now).toISOString(), lastGeneratedAt: { legs: hoursAgo(-1) } }]) assert.throws(() => parseTrainingHistory(data));
});
