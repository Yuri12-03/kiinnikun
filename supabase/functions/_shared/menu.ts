export const BODY_PARTS = [
  { id: 'chest', label: '胸', hint: 'CHEST' },
  { id: 'back', label: '背中', hint: 'BACK' },
  { id: 'shoulders', label: '肩', hint: 'SHOULDERS' },
  { id: 'arms', label: '腕', hint: 'ARMS' },
  { id: 'core', label: 'お腹', hint: 'CORE' },
  { id: 'legs', label: '脚', hint: 'LEGS' },
] as const;

export type BodyPart = typeof BODY_PARTS[number]['id'];
export type Conditions = { bodyParts: BodyPart[]; gymAvailable: boolean };
export type Exercise = {
  id: string;
  name: string;
  bodyParts: BodyPart[];
  equipment: string;
  gymOnly: boolean;
  unilateral: boolean;
};

export const EXERCISES: Exercise[] = [
  { id: 'push-up', name: '膝つきプッシュアップ', bodyParts: ['chest', 'arms'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'wall-push-up', name: 'ウォールプッシュアップ', bodyParts: ['chest', 'arms'], equipment: '壁', gymOnly: false, unilateral: false },
  { id: 'prone-w-raise', name: 'うつ伏せWレイズ', bodyParts: ['back', 'shoulders'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'reverse-snow-angel', name: 'リバーススノーエンジェル', bodyParts: ['back', 'shoulders'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'arm-circle', name: 'アームサークル', bodyParts: ['shoulders'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'self-resisted-curl', name: 'セルフレジスタンスカール', bodyParts: ['arms'], equipment: '自重（反対の手で抵抗）', gymOnly: false, unilateral: true },
  { id: 'dead-bug', name: 'デッドバグ', bodyParts: ['core'], equipment: '自重', gymOnly: false, unilateral: true },
  { id: 'crunch', name: 'クランチ', bodyParts: ['core'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'squat', name: '自重スクワット', bodyParts: ['legs'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'glute-bridge', name: 'ヒップリフト', bodyParts: ['legs'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'calf-raise', name: 'カーフレイズ', bodyParts: ['legs'], equipment: '自重', gymOnly: false, unilateral: false },
  { id: 'chest-press', name: 'チェストプレス', bodyParts: ['chest', 'arms'], equipment: 'チェストプレスマシン', gymOnly: true, unilateral: false },
  { id: 'pec-fly', name: 'ペックフライ', bodyParts: ['chest'], equipment: 'ペックフライマシン', gymOnly: true, unilateral: false },
  { id: 'lat-pulldown', name: 'ラットプルダウン', bodyParts: ['back', 'arms'], equipment: 'ラットプルダウンマシン', gymOnly: true, unilateral: false },
  { id: 'seated-row', name: 'シーテッドロー', bodyParts: ['back', 'arms'], equipment: 'ローイングマシン', gymOnly: true, unilateral: false },
  { id: 'shoulder-press', name: 'ショルダープレス', bodyParts: ['shoulders', 'arms'], equipment: 'ショルダープレスマシン', gymOnly: true, unilateral: false },
  { id: 'lateral-raise', name: 'サイドレイズ', bodyParts: ['shoulders'], equipment: 'ダンベル', gymOnly: true, unilateral: false },
  { id: 'dumbbell-curl', name: 'ダンベルカール', bodyParts: ['arms'], equipment: 'ダンベル', gymOnly: true, unilateral: false },
  { id: 'triceps-pushdown', name: 'トライセプスプッシュダウン', bodyParts: ['arms'], equipment: 'ケーブルマシン', gymOnly: true, unilateral: false },
  { id: 'ab-crunch', name: 'アブドミナルクランチ', bodyParts: ['core'], equipment: 'アブドミナルマシン', gymOnly: true, unilateral: false },
  { id: 'leg-press', name: 'レッグプレス', bodyParts: ['legs'], equipment: 'レッグプレスマシン', gymOnly: true, unilateral: false },
  { id: 'leg-curl', name: 'レッグカール', bodyParts: ['legs'], equipment: 'レッグカールマシン', gymOnly: true, unilateral: false },
  { id: 'leg-extension', name: 'レッグエクステンション', bodyParts: ['legs'], equipment: 'レッグエクステンションマシン', gymOnly: true, unilateral: false },
];

export type MenuItem = {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  reason: string;
};
export type Menu = { summary: string; items: MenuItem[] };

export class MenuError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'MenuError';
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConditions(value: unknown): Conditions {
  if (!record(value) || !Array.isArray(value.bodyParts) || value.bodyParts.length === 0 ||
      value.bodyParts.length > BODY_PARTS.length || typeof value.gymAvailable !== 'boolean' ||
      value.bodyParts.some((part) => !BODY_PARTS.some(({ id }) => id === part)) ||
      new Set(value.bodyParts).size !== value.bodyParts.length) {
    throw new MenuError('INVALID_INPUT', '鍛えたい部位とジムの利用可否を選んでください。');
  }
  return { bodyParts: value.bodyParts as BodyPart[], gymAvailable: value.gymAvailable };
}

export function candidatesFor(conditions: Conditions): Exercise[] {
  return EXERCISES.filter((exercise) =>
    (conditions.gymAvailable || !exercise.gymOnly) &&
    exercise.bodyParts.some((part) => conditions.bodyParts.includes(part)));
}

function integerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function shortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function parseMenu(value: unknown, conditions: Conditions): Menu {
  const invalid = () => new MenuError('INVALID_RESPONSE', '提案を正しく読み取れませんでした。もう一度お試しください。', 502);
  if (!record(value) || !shortText(value.summary, 240) || !Array.isArray(value.items) ||
      value.items.length < 2 || value.items.length > 6) throw invalid();
  const candidates = candidatesFor(conditions);
  const seen = new Set<string>();
  const covered = new Set<BodyPart>();
  const items = value.items.map((item): MenuItem => {
    if (!record(item) || typeof item.exerciseId !== 'string' ||
        !integerIn(item.sets, 1, 4) || !integerIn(item.reps, 5, 20) ||
        !integerIn(item.restSeconds, 30, 180) || !shortText(item.reason, 200)) throw invalid();
    const exercise = candidates.find(({ id }) => id === item.exerciseId);
    if (!exercise || seen.has(exercise.id)) throw invalid();
    seen.add(exercise.id);
    exercise.bodyParts.forEach((part) => covered.add(part));
    return { exerciseId: exercise.id, sets: item.sets, reps: item.reps, restSeconds: item.restSeconds, reason: item.reason.trim() };
  });
  if (conditions.bodyParts.some((part) => !covered.has(part))) throw invalid();
  return { summary: value.summary.trim(), items };
}

export function menuSchema(conditions: Conditions) {
  return {
    type: 'object',
    properties: {
      summary: { type: 'string', maxLength: 240 },
      items: { type: 'array', minItems: 2, maxItems: 6, items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string', enum: candidatesFor(conditions).map(({ id }) => id) },
          sets: { type: 'integer', minimum: 1, maximum: 4 },
          reps: { type: 'integer', minimum: 5, maximum: 20 },
          restSeconds: { type: 'integer', minimum: 30, maximum: 180 },
          reason: { type: 'string', maxLength: 200 },
        },
        required: ['exerciseId', 'sets', 'reps', 'restSeconds', 'reason'],
        additionalProperties: false,
      } },
    },
    required: ['summary', 'items'],
    additionalProperties: false,
  };
}

export function estimateMinutes(menu: Menu): number {
  // An estimate, including transitions; never presented as a measured duration.
  const seconds = menu.items.reduce((total, item) => {
    const exercise = EXERCISES.find(({ id }) => id === item.exerciseId);
    return total + item.sets * item.reps * 4 * (exercise?.unilateral ? 2 : 1) +
      Math.max(0, item.sets - 1) * item.restSeconds + 60;
  }, 0);
  return Math.ceil(seconds / 60);
}
