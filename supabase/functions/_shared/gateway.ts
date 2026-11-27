import { MenuError } from './menu.ts';

export type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch };
export type Settings = { url: string; anonKey: string; geminiKey: string; ownerId: string; model: string };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } }); }
export function methodResponse(request: Request): Response | null {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POSTで送信してください。' } }, 405);
  return null;
}
export function settings(deps: Dependencies): Settings {
  const url = deps.env('SUPABASE_URL'), anonKey = deps.env('SUPABASE_ANON_KEY'), geminiKey = deps.env('GEMINI_API_KEY'), ownerId = deps.env('ALLOWED_USER_ID');
  const model = deps.env('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
  if (!url || !anonKey || !geminiKey || !ownerId || !/^[a-zA-Z0-9.-]+$/.test(model)) throw new MenuError('SERVER_CONFIG', 'AIの接続設定を確認してください。', 503);
  return { url, anonKey, geminiKey, ownerId, model };
}
export async function authenticate(request: Request, config: Settings, deps: Dependencies): Promise<Record<string, string>> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new MenuError('UNAUTHORIZED', 'ログインしてからお試しください。', 401);
  const headers = { apikey: config.anonKey, Authorization: authorization };
  const response = await deps.fetch(`${config.url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    if (response.status >= 500) throw new MenuError('SERVICE_UNAVAILABLE', '接続先が混み合っています。時間を置いてお試しください。', 503);
    throw new MenuError('UNAUTHORIZED', '再度ログインしてください。', 401);
  }
  const user = await response.json();
  if (user.id !== config.ownerId) throw new MenuError('FORBIDDEN', 'このアカウントではAIを利用できません。', 403);
  return headers;
}
export async function readInput(request: Request, maxLength = 2048): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > maxLength) throw new MenuError('INVALID_INPUT', '入力内容が大きすぎます。');
  try { return JSON.parse(raw); } catch { throw new MenuError('INVALID_INPUT', '入力を読み取れませんでした。'); }
}
export async function consumeQuota(config: Settings, headers: Record<string, string>, deps: Dependencies) {
  const response = await deps.fetch(`${config.url}/rest/v1/rpc/consume_menu_request`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new MenuError('SERVICE_UNAVAILABLE', '利用状況を確認できませんでした。時間を置いてお試しください。', 503);
  if (await response.json() !== true) throw new MenuError('DAILY_LIMIT', '今日の提案回数の上限に達しました。翌日（日本時間）にお試しください。', 429);
}
export async function askGemini(config: Settings, deps: Dependencies, instructions: string, input: unknown, schema: unknown): Promise<unknown> {
  const response = await deps.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey }, signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 4096 } }),
  });
  if (response.status === 429) throw new MenuError('AI_RATE_LIMIT', 'Geminiの利用制限に達しました。時間を置いてお試しください。', 429);
  if (!response.ok) throw new MenuError('AI_UNAVAILABLE', 'AIからの提案を取得できませんでした。時間を置いてお試しください。', 502);
  const output = await response.json(), candidate = output.candidates?.[0];
  if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) throw new MenuError('INVALID_RESPONSE', '提案を最後まで取得できませんでした。もう一度お試しください。', 502);
  const text = candidate.content.parts.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || '').join('');
  try { return JSON.parse(text); } catch { throw new MenuError('INVALID_RESPONSE', '提案を読み取れませんでした。もう一度お試しください。', 502); }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof MenuError) return json({ error: { code: error.code, message: error.message } }, error.status);
  const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
  return json({ error: { code: timedOut ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE', message: timedOut ? '応答に時間がかかっています。もう一度お試しください。' : '接続できませんでした。時間を置いてお試しください。' } }, timedOut ? 504 : 503);
}
