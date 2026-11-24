import { candidatesFor, menuSchema, MenuError, parseConditions, parseMenu } from '../_shared/menu.ts';

type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch };
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
}

export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POSTで送信してください。' } }, 405);
    try {
      const url = deps.env('SUPABASE_URL');
      const anonKey = deps.env('SUPABASE_ANON_KEY');
      const geminiKey = deps.env('GEMINI_API_KEY');
      const allowedUserId = deps.env('ALLOWED_USER_ID');
      const model = deps.env('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
      if (!url || !anonKey || !geminiKey || !allowedUserId || !/^[a-zA-Z0-9.-]+$/.test(model)) {
        throw new MenuError('SERVER_CONFIG', 'AIの接続設定を確認してください。', 503);
      }
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) throw new MenuError('UNAUTHORIZED', 'ログインしてからお試しください。', 401);
      const authHeaders = { apikey: anonKey, Authorization: authorization };
      const authResponse = await deps.fetch(`${url}/auth/v1/user`, {
        headers: authHeaders, signal: AbortSignal.timeout(10_000),
      });
      if (!authResponse.ok) {
        if (authResponse.status >= 500) throw new MenuError('SERVICE_UNAVAILABLE', '接続先が混み合っています。時間を置いてお試しください。', 503);
        throw new MenuError('UNAUTHORIZED', '再度ログインしてください。', 401);
      }
      const user = await authResponse.json();
      if (user.id !== allowedUserId) throw new MenuError('FORBIDDEN', 'このアカウントではAIを利用できません。', 403);
      // Bound the body before JSON parsing; there is no free-text prompt input.
      const raw = await request.text();
      if (raw.length > 2048) throw new MenuError('INVALID_INPUT', '入力内容が大きすぎます。');
      let input: unknown;
      try { input = JSON.parse(raw); } catch { throw new MenuError('INVALID_INPUT', '入力を読み取れませんでした。'); }
      const conditions = parseConditions(input);
      const quotaResponse = await deps.fetch(`${url}/rest/v1/rpc/consume_menu_request`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(10_000),
      });
      if (!quotaResponse.ok) throw new MenuError('SERVICE_UNAVAILABLE', '利用状況を確認できませんでした。時間を置いてお試しください。', 503);
      if (await quotaResponse.json() !== true) throw new MenuError('DAILY_LIMIT', '今日の提案回数の上限に達しました。翌日（日本時間）にお試しください。', 429);

      const response = await deps.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text:
            'あなたは筋トレのメニューを提案します。日本語で簡潔に回答してください。候補の種目IDから重複なく2〜6種目を実施順に選び、選択された全部位をカバーしてください。経験・筋力は不明です。控えめなセット数で、初めての利用者が調整できる提案にしてください。重量の数値や身長体重からの筋力推測は含めません。ジム利用可否を守り、候補以外の器具や種目を追加しないでください。片側ずつ行う種目の回数は片側あたりです。summaryとreasonは短く、効果を保証しないでください。' }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify({ conditions, candidates: candidatesFor(conditions) }) }] }],
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: menuSchema(conditions), maxOutputTokens: 4096 },
        }),
      });
      if (response.status === 429) throw new MenuError('AI_RATE_LIMIT', 'Geminiの利用制限に達しました。時間を置いてお試しください。', 429);
      if (!response.ok) throw new MenuError('AI_UNAVAILABLE', 'AIからの提案を取得できませんでした。時間を置いてお試しください。', 502);
      const output = await response.json();
      const candidate = output.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new MenuError('INVALID_RESPONSE', '提案を最後まで取得できませんでした。もう一度お試しください。', 502);
      const text = candidate.content?.parts?.filter((part: { thought?: boolean }) => !part.thought)
        .map((part: { text?: string }) => part.text || '').join('');
      let result: unknown;
      try { result = JSON.parse(text || ''); } catch { throw new MenuError('INVALID_RESPONSE', '提案を読み取れませんでした。もう一度お試しください。', 502); }
      return json({ menu: parseMenu(result, conditions) });
    } catch (error) {
      if (error instanceof MenuError) return json({ error: { code: error.code, message: error.message } }, error.status);
      const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
      // Never return/log upstream responses or request headers: they may contain credentials.
      return json({ error: { code: timedOut ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE', message: timedOut
        ? '応答に時間がかかっています。もう一度お試しください。'
        : '接続できませんでした。時間を置いてお試しください。' } }, timedOut ? 504 : 503);
    }
  };
}
