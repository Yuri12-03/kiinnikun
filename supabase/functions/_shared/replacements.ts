import { EXERCISES, MenuError, menuSchema, parseConditions, parseMenu, type Conditions, type Exercise, type Menu, type MenuItem } from './menu.ts';

export const REPLACEMENT_REASONS = [
  { id: 'equipment_busy', label: '器具が空いていない' },
  { id: 'equipment_missing', label: '器具がない' },
  { id: 'too_difficult', label: '難しい' },
] as const;
export type ReplacementReason = typeof REPLACEMENT_REASONS[number]['id'];
export type Exclusions = { equipment: string[]; exerciseIds: string[] };
export type ReplacementRequest = { conditions: Conditions; menu: Menu; targetExerciseId: string; reason: ReplacementReason; exclusions: Exclusions };
export type ReplacementResult = { candidates: MenuItem[] };
type Profile = { focus: string; movement: string; difficulty: 1 | 2 | 3 };

// A calf exercise cannot replace a quadriceps exercise merely because both train legs.
export const EXERCISE_PROFILES: Record<string, Profile> = {
  'push-up': { focus: '胸', movement: '水平プッシュ', difficulty: 2 },
  'wall-push-up': { focus: '胸', movement: '水平プッシュ', difficulty: 1 },
  'prone-w-raise': { focus: '背中上部', movement: '肩甲骨を寄せる', difficulty: 1 },
  'reverse-snow-angel': { focus: '背中上部', movement: '肩甲骨を動かす', difficulty: 1 },
  'arm-circle': { focus: '肩', movement: '肩の回旋', difficulty: 1 },
  'self-resisted-curl': { focus: '上腕二頭筋', movement: '肘を曲げる', difficulty: 1 },
  'dead-bug': { focus: '腹部', movement: '体幹を安定させる', difficulty: 2 },
  'crunch': { focus: '腹部', movement: '体幹を曲げる', difficulty: 1 },
  'squat': { focus: '太もも前側', movement: '膝と股関節を伸ばす', difficulty: 2 },
  'glute-bridge': { focus: 'お尻', movement: '股関節を伸ばす', difficulty: 1 },
  'calf-raise': { focus: 'ふくらはぎ', movement: 'かかとを上げる', difficulty: 1 },
  'chest-press': { focus: '胸', movement: '水平プッシュ', difficulty: 2 },
  'pec-fly': { focus: '胸', movement: '腕を胸の前で閉じる', difficulty: 2 },
  'lat-pulldown': { focus: '広背筋', movement: '垂直プル', difficulty: 2 },
  'seated-row': { focus: '広背筋', movement: '水平プル', difficulty: 2 },
  'shoulder-press': { focus: '肩', movement: '垂直プッシュ', difficulty: 2 },
  'lateral-raise': { focus: '肩', movement: '腕を横に上げる', difficulty: 2 },
  'dumbbell-curl': { focus: '上腕二頭筋', movement: '肘を曲げる', difficulty: 2 },
  'triceps-pushdown': { focus: '上腕三頭筋', movement: '肘を伸ばす', difficulty: 2 },
  'ab-crunch': { focus: '腹部', movement: '体幹を曲げる', difficulty: 2 },
  'leg-press': { focus: '太もも前側', movement: '膝と股関節を伸ばす', difficulty: 2 },
  'leg-curl': { focus: '太もも裏側', movement: '膝を曲げる', difficulty: 2 },
  'leg-extension': { focus: '太もも前側', movement: '膝を伸ばす', difficulty: 2 },
  'good-morning': { focus: '太もも裏側', movement: '股関節を伸ばす', difficulty: 1 },
  'cable-curl': { focus: '上腕二頭筋', movement: '肘を曲げる', difficulty: 2 },
  'wall-triceps-extension': { focus: '上腕三頭筋', movement: '肘を伸ばす', difficulty: 1 },
  'shallow-squat': { focus: '太もも前側', movement: '膝と股関節を伸ばす', difficulty: 1 },
};

function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export function parseExclusions(value: unknown): Exclusions {
  if (value === undefined) return { equipment: [], exerciseIds: [] };
  const invalid = () => new MenuError('INVALID_INPUT', '使えない種目・器具の情報を確認してください。');
  if (!object(value)) throw invalid();
  const equipment = value.equipment, exerciseIds = value.exerciseIds;
  if (!Array.isArray(equipment) || !Array.isArray(exerciseIds) || equipment.length > EXERCISES.length || exerciseIds.length > EXERCISES.length ||
    equipment.some((item) => typeof item !== 'string' || !EXERCISES.some((exercise) => exercise.gymOnly && exercise.equipment === item)) ||
    exerciseIds.some((item) => typeof item !== 'string' || !EXERCISES.some(({ id }) => id === item)) ||
    new Set(equipment).size !== equipment.length || new Set(exerciseIds).size !== exerciseIds.length) throw invalid();
  return { equipment: [...equipment], exerciseIds: [...exerciseIds] };
}

export function parseReplacementRequest(value: unknown): ReplacementRequest {
  if (!object(value)) throw new MenuError('INVALID_INPUT', '変更する種目を選んでください。');
  const conditions = parseConditions(value.conditions);
  let menu: Menu;
  try { menu = parseMenu(value.menu, conditions); }
  catch { throw new MenuError('INVALID_INPUT', '元のメニューを読み取れませんでした。メニューを作り直してください。'); }
  if (typeof value.targetExerciseId !== 'string' || !menu.items.some(({ exerciseId }) => exerciseId === value.targetExerciseId) ||
    !REPLACEMENT_REASONS.some(({ id }) => id === value.reason)) throw new MenuError('INVALID_INPUT', '変更する種目と理由を選んでください。');
  const target = EXERCISES.find(({ id }) => id === value.targetExerciseId)!;
  if (value.reason !== 'too_difficult' && !target.gymOnly) throw new MenuError('INVALID_INPUT', 'この種目では器具を理由に変更できません。');
  return { conditions, menu, targetExerciseId: target.id, reason: value.reason as ReplacementReason, exclusions: parseExclusions(value.exclusions) };
}

export function exclusionsAfter(request: ReplacementRequest): Exclusions {
  const target = EXERCISES.find(({ id }) => id === request.targetExerciseId)!;
  return { equipment: [...new Set([...request.exclusions.equipment, ...(request.reason === 'too_difficult' ? [] : [target.equipment])])],
    exerciseIds: [...new Set([...request.exclusions.exerciseIds, target.id])] };
}

export function replacementCandidates(request: ReplacementRequest): Exercise[] {
  const targetProfile = EXERCISE_PROFILES[request.targetExerciseId], exclusions = exclusionsAfter(request);
  const currentIds = new Set(request.menu.items.map(({ exerciseId }) => exerciseId));
  return EXERCISES.filter((exercise) => {
    const profile = EXERCISE_PROFILES[exercise.id];
    if (!profile || !targetProfile || profile.focus !== targetProfile.focus ||
      (!request.conditions.gymAvailable && exercise.gymOnly) || currentIds.has(exercise.id) ||
      exclusions.exerciseIds.includes(exercise.id) || exclusions.equipment.includes(exercise.equipment) ||
      profile.difficulty > targetProfile.difficulty || (request.reason === 'too_difficult' && profile.difficulty >= targetProfile.difficulty)) return false;
    try {
      parseMenu({ ...request.menu, items: request.menu.items.map((item) => item.exerciseId === request.targetExerciseId ? { ...item, exerciseId: exercise.id } : item) }, request.conditions);
      return true;
    } catch { return false; }
  }).sort((left, right) => Number(EXERCISE_PROFILES[right.id].movement === targetProfile.movement) - Number(EXERCISE_PROFILES[left.id].movement === targetProfile.movement));
}

export function replacementSchema(request: ReplacementRequest) {
  const itemSchema = menuSchema(request.conditions).properties.items.items;
  return { type: 'object', properties: { candidates: { type: 'array', minItems: 0, maxItems: 3,
    items: { ...itemSchema, properties: { ...itemSchema.properties, exerciseId: { type: 'string', enum: replacementCandidates(request).map(({ id }) => id) } } },
  } }, required: ['candidates'], additionalProperties: false };
}

export function parseReplacementResult(value: unknown, request: ReplacementRequest): ReplacementResult {
  const invalid = () => new MenuError('INVALID_RESPONSE', '代替候補を正しく読み取れませんでした。もう一度お試しください。', 502);
  if (!object(value) || !Array.isArray(value.candidates) || value.candidates.length > 3) throw invalid();
  const allowed = new Set(replacementCandidates(request).map(({ id }) => id)), seen = new Set<string>();
  const candidates = value.candidates.map((candidate): MenuItem => {
    if (!object(candidate) || typeof candidate.exerciseId !== 'string' || !allowed.has(candidate.exerciseId) || seen.has(candidate.exerciseId)) throw invalid();
    seen.add(candidate.exerciseId);
    try {
      const menu = parseMenu({ ...request.menu, items: request.menu.items.map((item) => item.exerciseId === request.targetExerciseId ? candidate : item) }, request.conditions);
      return menu.items.find(({ exerciseId }) => exerciseId === candidate.exerciseId)!;
    } catch { throw invalid(); }
  });
  return { candidates };
}

export function applyReplacement(request: ReplacementRequest, candidate: MenuItem): { menu: Menu; exclusions: Exclusions } {
  const { candidates } = parseReplacementResult({ candidates: [candidate] }, request);
  return { menu: { summary: '実行できる種目に調整したメニューです。',
    items: request.menu.items.map((item) => item.exerciseId === request.targetExerciseId ? candidates[0] : item) }, exclusions: exclusionsAfter(request) };
}
