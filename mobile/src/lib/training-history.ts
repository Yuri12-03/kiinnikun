import { BODY_PARTS, type BodyPart } from '../../../supabase/functions/_shared/menu.ts';

export const RECENT_TRAINING_MS = 48 * 60 * 60 * 1000;
export type TrainingHistory = { serverNow: number; lastGeneratedAt: Partial<Record<BodyPart, number>> };
export type RecommendedPart = { id: BodyPart; label: string; lastGeneratedAt: number | null };

export function parseTrainingHistory(value: unknown): TrainingHistory {
  const invalid = () => new Error('生成履歴を読み込めませんでした。もう一度お試しください。');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const data = value as Record<string, unknown>;
  const serverNow = typeof data.serverNow === 'string' ? Date.parse(data.serverNow) : NaN;
  if (!Number.isFinite(serverNow) || !data.lastGeneratedAt || typeof data.lastGeneratedAt !== 'object' || Array.isArray(data.lastGeneratedAt)) throw invalid();
  const lastGeneratedAt: TrainingHistory['lastGeneratedAt'] = {};
  for (const [part, date] of Object.entries(data.lastGeneratedAt)) {
    const timestamp = typeof date === 'string' ? Date.parse(date) : NaN;
    if (!BODY_PARTS.some(({ id }) => id === part) || !Number.isFinite(timestamp) || timestamp > serverNow) throw invalid();
    lastGeneratedAt[part as BodyPart] = timestamp;
  }
  return { serverNow, lastGeneratedAt };
}

export function recommendParts(history: TrainingHistory, now = history.serverNow): RecommendedPart[] {
  return BODY_PARTS.map(({ id, label }) => ({ id, label, lastGeneratedAt: history.lastGeneratedAt[id] ?? null }))
    .filter(({ lastGeneratedAt }) => lastGeneratedAt === null || now - lastGeneratedAt >= RECENT_TRAINING_MS)
    .sort((left, right) => left.lastGeneratedAt === right.lastGeneratedAt ? 0 :
      left.lastGeneratedAt === null ? -1 : right.lastGeneratedAt === null ? 1 : left.lastGeneratedAt - right.lastGeneratedAt)
    .slice(0, 2);
}

export function historyReason(part: RecommendedPart, now: number): string {
  if (part.lastGeneratedAt === null) return '記録なし';
  const hours = Math.floor((now - part.lastGeneratedAt) / 3_600_000);
  return hours < 72 ? `前回の生成から${hours}時間` : `前回の生成から${Math.floor(hours / 24)}日`;
}
