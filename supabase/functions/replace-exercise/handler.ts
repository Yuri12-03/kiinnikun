import { EXERCISES } from '../_shared/menu.ts';
import { EXERCISE_PROFILES, parseReplacementRequest, parseReplacementResult, replacementCandidates, replacementSchema } from '../_shared/replacements.ts';
import { askGemini, authenticate, consumeQuota, errorResponse, json, methodResponse, readInput, settings, type Dependencies } from '../_shared/gateway.ts';

export function createReplacementHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const method = methodResponse(request);
    if (method) return method;
    try {
      const config = settings(deps), authHeaders = await authenticate(request, config, deps);
      const input = parseReplacementRequest(await readInput(request, 12_000));
      const candidates = replacementCandidates(input);
      if (candidates.length === 0) return json({ candidates: [] });
      await consumeQuota(config, authHeaders, deps);
      const target = EXERCISES.find(({ id }) => id === input.targetExerciseId)!;
      const output = await askGemini(config, deps,
        'あなたは筋トレの代替種目を提案します。日本語で簡潔に回答してください。候補から適切なものを最大3つ選んで優先順に返してください。他の種目の内容は変えません。targetと主に鍛える部位・動作が近い候補を優先し、同じ効果を保証しないでください。reasonには元の種目との共通点と負荷や動作の違いを短く説明してください。適切な候補がなければcandidatesを空配列にしてください。難しいことが理由の場合は難易度を下げます。重量は提案しません。セット数・回数・休憩は無理のない範囲とし、片側ずつの回数は片側あたりです。候補以外の種目・器具を追加してはいけません。',
        { ...input, target: { ...target, ...EXERCISE_PROFILES[target.id] }, candidates: candidates.map((exercise) => ({ ...exercise, ...EXERCISE_PROFILES[exercise.id] })) }, replacementSchema(input));
      return json(parseReplacementResult(output, input));
    } catch (error) { return errorResponse(error); }
  };
}
