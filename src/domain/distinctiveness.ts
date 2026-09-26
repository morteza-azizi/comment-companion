import type { ContributionIdea } from "./contribution";
import { normalizeText } from "./text-match";

export const GENERIC_COMMENT_PATTERNS: readonly RegExp[] = [
  /great perspective/i,
  /this is an important point/i,
  /important point/i,
  /the trade-?offs? here/i,
  /i['’]d add that/i,
  /this highlights/i,
  /in my experience/i,
  /the key takeaway is/i,
  /great reminder/i,
  /balancing trade-?offs/i,
  /communication is just as important/i,
  /thanks for sharing/i,
  /so true/i,
  /great post/i,
  /this is so important/i,
  /architecture is all about/i,
  /really important/i,
  /what do you think\?/i,
];

export function failsHundredPeopleTest(comment: string, idea: ContributionIdea): boolean {
  if (GENERIC_COMMENT_PATTERNS.some((pattern) => pattern.test(comment))) {
    return true;
  }

  const lower = normalizeText(comment);
  const hits = idea.requiredTokens.filter((token) => lower.includes(normalizeText(token)));
  return hits.length === 0;
}

export function hasClearReasonToExist(idea: ContributionIdea): boolean {
  return Boolean(idea.reason && idea.why.trim().length > 0);
}

export function isDistinctiveComment(comment: string, idea: ContributionIdea): boolean {
  if (!comment.trim()) return false;
  if (!hasClearReasonToExist(idea)) return false;
  if (failsHundredPeopleTest(comment, idea)) return false;
  return true;
}
