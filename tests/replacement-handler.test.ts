import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReplacementHandler } from '../supabase/functions/replace-exercise/handler.ts';

const config: Record<string, string> = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key', GEMINI_API_KEY: 'never-print-this', ALLOWED_USER_ID: 'owner' };
const item = (exerciseId: string) => ({ exerciseId, sets: 2, reps: 10, restSeconds: 60, reason: '元の種目と近い部位を鍛えます。' });
const input = { conditions: { bodyParts: ['legs'], gymAvailable: true }, menu: { summary: '脚のメニュー', items: [item('leg-press'), item('glute-bridge')] }, targetExerciseId: 'leg-press', reason: 'equipment_busy' };
const request = (body: unknown = input, token = 'Bearer valid') => new Request('https://edge/replace-exercise', { method: 'POST', headers: token ? { Authorization: token } : {}, body: JSON.stringify(body) });
function setup(options: { owner?: string; quota?: boolean; aiStatus?: number; output?: unknown; timeout?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const mockFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/user')) return Response.json({ id: options.owner || 'owner' });
    if (String(url).includes('/rpc/')) return Response.json(options.quota ?? true);
    if (options.timeout) throw new DOMException('sensitive upstream details', 'TimeoutError');
    if (options.aiStatus) return Response.json({ secret: config.GEMINI_API_KEY }, { status: options.aiStatus });
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(options.output ?? { candidates: [item('squat')] }) }] } }] });
  };
  return { calls, handler: createReplacementHandler({ env: (key) => config[key], fetch: mockFetch }) };
}

test('replacement rejects unauthenticated and non-owner requests before AI calls', async () => {
  const missing = setup(); assert.equal((await missing.handler(request(input, ''))).status, 401); assert.equal(missing.calls.length, 0);
  const other = setup({ owner: 'other' }); assert.equal((await other.handler(request())).status, 403); assert.equal(other.calls.length, 1);
});
test('invalid input and pain do not consume quota or call AI', async () => {
  for (const body of [{ ...input, reason: 'pain' }, { ...input, menu: {} }, { ...input, targetExerciseId: 'unknown' }]) {
    const { calls, handler } = setup(); assert.equal((await handler(request(body))).status, 400); assert.equal(calls.length, 1);
  }
});
test('empty candidate pool returns an empty list without charging quota', async () => {
  const { calls, handler } = setup();
  const response = await handler(request({ ...input, menu: { ...input.menu, items: [item('calf-raise'), item('glute-bridge')] }, targetExerciseId: 'calf-raise', reason: 'too_difficult' }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { candidates: [] }); assert.equal(calls.length, 1);
});
test('replacement shares the existing daily quota before invoking AI', async () => {
  const { calls, handler } = setup({ quota: false });
  const response = await handler(request()); assert.equal(response.status, 429); assert.equal((await response.json()).error.code, 'DAILY_LIMIT'); assert.equal(calls.length, 2);
});
test('returns validated alternatives and sends only filtered candidates to Gemini', async () => {
  const { calls, handler } = setup(); const response = await handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { candidates: [item('squat')] });
  const payload = JSON.parse(String(calls[2].init?.body)), prompt = JSON.parse(payload.contents[0].parts[0].text);
  assert.ok(prompt.candidates.every((candidate: { focus: string; id: string }) => candidate.focus === '太もも前側' && candidate.id !== 'leg-press'));
});

test('replacement prompt includes the selected duration and whole-menu time constraint', async () => {
  const { calls, handler } = setup();
  const response = await handler(request({ ...input, conditions: { ...input.conditions, durationMinutes: 10 } }));
  assert.equal(response.status, 200);
  const payload = JSON.parse(String(calls[2].init?.body));
  const prompt = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(prompt.conditions.durationMinutes, 10);
  assert.ok(prompt.timeGuidance.includes('600秒以下'));
});
test('rejects invalid AI candidates and sanitizes failures and timeouts', async () => {
  for (const options of [{ output: { candidates: [item('calf-raise')] } }, { aiStatus: 429 }, { aiStatus: 500 }, { timeout: true }]) {
    const { handler } = setup(options); const response = await handler(request()); assert.ok(response.status >= 400);
    const text = await response.text(); assert.ok(!text.includes(config.GEMINI_API_KEY)); assert.ok(!text.includes('sensitive'));
  }
});
