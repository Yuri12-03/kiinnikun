import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../supabase/functions/generate-menu/handler.ts';

const variables: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key',
  GEMINI_API_KEY: 'test-secret-do-not-leak', ALLOWED_USER_ID: 'owner',
};
const menu = { summary: '脚を鍛えるメニューです。', items: [
  { exerciseId: 'squat', sets: 2, reps: 10, restSeconds: 60, reason: '脚全体を使う種目です。' },
  { exerciseId: 'glute-bridge', sets: 2, reps: 10, restSeconds: 60, reason: '臀部を鍛えます。' },
] };
const request = (body: unknown = { bodyParts: ['legs'], gymAvailable: false }, auth = true) => new Request('https://edge/generate-menu', {
  method: 'POST', headers: auth ? { Authorization: 'Bearer session-token' } : {}, body: JSON.stringify(body),
});

function setup(options: { owner?: string; quota?: boolean; aiStatus?: number; output?: unknown; finish?: string; timeout?: boolean; historyStatus?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith('/user')) return Response.json({ id: options.owner || 'owner' });
    if (url.includes('/rpc/')) return Response.json(options.quota ?? true);
    if (url.endsWith('/generated_training_history')) return new Response(null, { status: options.historyStatus ?? 201 });
    if (options.timeout) throw new DOMException('Upstream timed out with sensitive info', 'TimeoutError');
    if (options.aiStatus) return Response.json({ secret: variables.GEMINI_API_KEY }, { status: options.aiStatus });
    return Response.json({ candidates: [{ finishReason: options.finish || 'STOP', content: { parts: [{ text: JSON.stringify(options.output ?? menu) }] } }] });
  };
  return { calls, handler: createHandler({ env: (name) => variables[name], fetch: mockFetch }) };
}

test('preflight and unsupported methods do not call any services', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(new Request('https://edge', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://edge'))).status, 405);
  assert.equal(calls.length, 0);
});

test('missing authentication and wrong owner cannot invoke Gemini', async () => {
  const missing = setup(); assert.equal((await missing.handler(request(undefined, false))).status, 401); assert.equal(missing.calls.length, 0);
  const other = setup({ owner: 'someone-else' }); assert.equal((await other.handler(request())).status, 403); assert.equal(other.calls.length, 1);
});

test('invalid input is rejected before quota consumption', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request({ bodyParts: [], gymAvailable: false }))).status, 400);
  assert.equal(calls.length, 1);
});

test('exhausted daily quota does not call Gemini', async () => {
  const { handler, calls } = setup({ quota: false });
  const response = await handler(request());
  assert.equal(response.status, 429); assert.equal((await response.json()).error.code, 'DAILY_LIMIT');
  assert.equal(calls.length, 2);
});

test('success sends filtered catalog and secret header; returns validated menu only', async () => {
  const { handler, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { menu });
  const aiCall = calls[2];
  assert.ok(!aiCall.url.includes(variables.GEMINI_API_KEY));
  const body = JSON.parse(String(aiCall.init?.body));
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  const prompt = JSON.parse(body.contents[0].parts[0].text);
  assert.ok(prompt.candidates.every((exercise: { gymOnly: boolean }) => !exercise.gymOnly));
});

test('upstream errors, timeouts, and invalid output are sanitized', async () => {
  for (const options of [{ aiStatus: 429 }, { aiStatus: 500 }, { timeout: true }, { output: {} }, { finish: 'MAX_TOKENS' }]) {
    const { handler } = setup(options);
    const response = await handler(request());
    assert.ok(response.status >= 400);
    const text = await response.text();
    assert.ok(!text.includes(variables.GEMINI_API_KEY));
    assert.ok(!text.includes('sensitive'));
  }
});

test('server configuration failure makes no upstream calls', async () => {
  let called = false;
  const handler = createHandler({ env: () => undefined, fetch: async () => { called = true; return Response.json({}); } });
  assert.equal((await handler(request())).status, 503);
  assert.equal(called, false);
});

test('passes the selected duration and time calculation to Gemini', async () => {
  const { handler, calls } = setup();
  const response = await handler(request({ bodyParts: ['legs'], gymAvailable: false, durationMinutes: 15 }));
  assert.equal(response.status, 200);
  const payload = JSON.parse(String(calls[2].init?.body));
  const prompt = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(prompt.conditions.durationMinutes, 15);
  assert.ok(prompt.timeGuidance.includes('900秒以下'));
});

test('invalid duration does not use quota; an overlong AI result is not returned', async () => {
  const invalid = setup();
  assert.equal((await invalid.handler(request({ bodyParts: ['legs'], gymAvailable: false, durationMinutes: 12 }))).status, 400);
  assert.equal(invalid.calls.length, 1);
  const overlong = setup({ output: { ...menu, items: menu.items.map((item) => ({ ...item, sets: 4, reps: 20, restSeconds: 180 })) } });
  assert.equal((await overlong.handler(request({ bodyParts: ['legs'], gymAvailable: false, durationMinutes: 10 }))).status, 502);
});

test('records selected parts once after validating a successful generation', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request())).status, 200);
  const writes = calls.filter(({ url }) => url.endsWith('/generated_training_history'));
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(String(writes[0].init?.body)), { body_parts: ['legs'] });
  assert.equal(calls.indexOf(writes[0]), 3);
  assert.equal(new Headers(writes[0].init?.headers).get('Authorization'), 'Bearer session-token');
});

test('failed or invalid generations never record training history', async () => {
  for (const options of [{ aiStatus: 429 }, { aiStatus: 500 }, { timeout: true }, { output: {} }, { finish: 'MAX_TOKENS' }, { quota: false }]) {
    const { handler, calls } = setup(options);
    assert.notEqual((await handler(request())).status, 200);
    assert.ok(!calls.some(({ url }) => url.endsWith('/generated_training_history')));
  }
});

test('a failed history write is reported without returning a successful menu', async () => {
  const { handler } = setup({ historyStatus: 503 });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'HISTORY_SAVE_FAILED', message: 'メニューの生成履歴を記録できませんでした。時間を置いてお試しください。' } });
});

test('a 120-minute request is accepted and reaches Gemini', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request({ bodyParts: ['legs'], gymAvailable: false, durationMinutes: 120 }))).status, 200);
  const prompt = JSON.parse(JSON.parse(String(calls[2].init?.body)).contents[0].parts[0].text);
  assert.equal(prompt.conditions.durationMinutes, 120);
});
