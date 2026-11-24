import { MenuError, parseMenu, type Conditions, type Menu } from '../../../supabase/functions/_shared/menu';
import { getSupabase } from './supabase';

export async function generateMenu(conditions: Conditions, signal: AbortSignal): Promise<Menu> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new MenuError('UNAUTHORIZED', 'AIを利用するためにログインしてください。', 401);
  let response: Response;
  try {
    response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-menu`, {
      method: 'POST', signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(conditions),
    });
  } catch {
    throw new MenuError('NETWORK', signal.aborted
      ? '応答に時間がかかっています。もう一度お試しください。'
      : '接続できませんでした。通信環境を確認してお試しください。', 503);
  }
  let body;
  try { body = await response.json(); } catch {
    throw new MenuError('INVALID_RESPONSE', '提案を読み取れませんでした。もう一度お試しください。', 502);
  }
  if (!response.ok) {
    // Render only our known error messages, never arbitrary gateway/provider errors.
    const messages: Record<string, string> = {
      UNAUTHORIZED: 'ログインの有効期限が切れました。ログアウトして入り直してください。',
      FORBIDDEN: 'このアカウントではAIを利用できません。接続設定を確認してください。',
      DAILY_LIMIT: '今日の提案回数の上限に達しました。翌日（日本時間）にお試しください。',
      AI_RATE_LIMIT: 'Geminiの利用制限に達しました。時間を置いてお試しください。',
      SERVER_CONFIG: 'AIの接続準備がまだ完了していません。接続設定を確認してください。',
      INVALID_RESPONSE: '提案を正しく読み取れませんでした。もう一度お試しください。',
      TIMEOUT: '応答に時間がかかっています。もう一度お試しください。',
    };
    const code = typeof body?.error?.code === 'string' ? body.error.code : 'SERVICE_UNAVAILABLE';
    throw new MenuError(code, messages[code] || 'AIからの提案を取得できませんでした。時間を置いてお試しください。', response.status);
  }
  return parseMenu(body?.menu, conditions);
}
