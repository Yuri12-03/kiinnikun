import { MenuError, type Conditions, type Menu, type MenuItem } from '../../../supabase/functions/_shared/menu.ts';
import { applyReplacement, type Exclusions, type ReplacementRequest } from '../../../supabase/functions/_shared/replacements.ts';

export type Proposal = { conditions: Conditions; menu: Menu; exclusions?: Exclusions };

export function replaceInProposal(current: Proposal | null, expected: Proposal, request: ReplacementRequest, candidate: MenuItem): Proposal {
  if (current !== expected || JSON.stringify(expected.menu) !== JSON.stringify(request.menu)) {
    throw new MenuError('STALE_MENU', 'メニューが更新されています。もう一度変更する種目を選んでください。', 409);
  }
  return { ...expected, ...applyReplacement(request, candidate) };
}
