import { candidatesFor, menuSchema, parseConditions, parseMenu } from '../_shared/menu.ts';
import { askGemini, authenticate, consumeQuota, errorResponse, json, methodResponse, readInput, settings, type Dependencies } from '../_shared/gateway.ts';

export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const method = methodResponse(request);
    if (method) return method;
    try {
      const config = settings(deps);
      const authHeaders = await authenticate(request, config, deps);
      const conditions = parseConditions(await readInput(request));
      await consumeQuota(config, authHeaders, deps);
      const output = await askGemini(config, deps,
        'あなたは筋トレのメニューを提案します。日本語で簡潔に回答してください。候補の種目IDから重複なく2〜6種目を実施順に選び、選択された全部位をカバーしてください。経験・筋力は不明です。控えめなセット数で、初めての利用者が調整できる提案にしてください。重量の数値や身長体重からの筋力推測は含めません。ジム利用可否を守り、候補以外の器具や種目を追加しないでください。片側ずつ行う種目の回数は片側あたりです。summaryとreasonは短く、効果を保証しないでください。',
        { conditions, candidates: candidatesFor(conditions) }, menuSchema(conditions));
      return json({ menu: parseMenu(output, conditions) });
    } catch (error) { return errorResponse(error); }
  };
}
