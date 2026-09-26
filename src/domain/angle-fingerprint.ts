import type { ContributionIdea, ContributionReason } from "./contribution";
import { normalizeText } from "./text-match";

export type Novelty = "NEW" | "RECENTLY_USED" | "PREVIOUSLY_USED";

export interface AngleInput {
  topics?: readonly string[];
  concepts?: readonly string[];
  reason?: ContributionReason | string;
  angle?: string;
}

export interface NoveltyAssessment {
  novelty: Novelty;
  similarity: number;
  penalty: number;
  matchedFingerprint?: string;
}

const DAY_MS = 86_400_000;
const RECENT_MS = 2 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const RECENT_INDEX_WINDOW = 6;
const MEDIUM_INDEX_WINDOW = 30;

const SIMILARITY_THRESHOLD = 0.5;
const RECENT_PENALTY = 40;
const MEDIUM_PENALTY = 12;

export function slug(text: string): string {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fingerprintAngle(input: AngleInput): string {
  const tokens = new Set<string>();
  for (const concept of input.concepts ?? []) {
    const s = slug(concept);
    if (s) tokens.add(s);
  }
  if (input.angle) {
    const s = slug(input.angle);
    if (s) tokens.add(s);
  }
  if (input.reason) tokens.add(slug(String(input.reason)));
  const topic = input.topics?.[0];
  if (topic) tokens.add(slug(topic));
  return [...tokens].sort().join("|");
}

export function attachAngle(idea: ContributionIdea): ContributionIdea {
  return {
    ...idea,
    angleFingerprint: fingerprintAngle(idea),
  };
}

export function ideaConceptTokens(input: AngleInput): Set<string> {
  const tokens = new Set<string>();
  for (const concept of input.concepts ?? []) addConcept(tokens, concept);
  if (input.angle) addConcept(tokens, input.angle);
  return tokens;
}

export function angleSimilarity(left: AngleInput, right: AngleInput): number {
  return jaccard(ideaConceptTokens(left), ideaConceptTokens(right));
}

export function isSameIntellectualAngle(left: AngleInput, right: AngleInput): boolean {
  const a = ideaConceptTokens(left);
  const b = ideaConceptTokens(right);
  if (a.size === 0 || b.size === 0) return false;
  const overlap = intersectionSize(a, b);
  if (jaccard(a, b) >= SIMILARITY_THRESHOLD) return true;
  return overlap >= 2 && (overlap === a.size || overlap === b.size);
}

export function alreadySaidThis(candidate: AngleInput, previous: AngleInput): boolean {
  return isSameIntellectualAngle(candidate, previous);
}

export function noveltyFromAge(ageMs: number | undefined, indexDistance: number): Novelty {
  if (ageMs !== undefined) {
    if (ageMs <= RECENT_MS) return "RECENTLY_USED";
    if (ageMs <= YEAR_MS) return "PREVIOUSLY_USED";
    return "NEW";
  }
  if (indexDistance <= RECENT_INDEX_WINDOW) return "RECENTLY_USED";
  if (indexDistance <= MEDIUM_INDEX_WINDOW) return "PREVIOUSLY_USED";
  return "NEW";
}

export function penaltyForNovelty(novelty: Novelty): number {
  if (novelty === "RECENTLY_USED") return RECENT_PENALTY;
  if (novelty === "PREVIOUSLY_USED") return MEDIUM_PENALTY;
  return 0;
}

export function assessNoveltyAgainst(
  candidate: AngleInput,
  previous: readonly (AngleInput & { at?: number })[],
  now = Date.now()
): NoveltyAssessment {
  let best: NoveltyAssessment = { novelty: "NEW", similarity: 0, penalty: 0 };

  previous.forEach((entry, index) => {
    if (!isSameIntellectualAngle(candidate, entry) && angleSimilarity(candidate, entry) < SIMILARITY_THRESHOLD) {
      return;
    }
    const similarity = Math.max(angleSimilarity(candidate, entry), isSameIntellectualAngle(candidate, entry) ? 1 : 0);
    const ageMs = entry.at !== undefined ? now - entry.at : undefined;
    const indexDistance = previous.length - index;
    const novelty = noveltyFromAge(ageMs, indexDistance);
    const penalty = penaltyForNovelty(novelty);
    if (penalty > best.penalty || (penalty === best.penalty && similarity > best.similarity)) {
      best = {
        novelty,
        similarity,
        penalty,
        matchedFingerprint: fingerprintAngle(entry),
      };
    }
  });

  return best;
}

export function ideaAngleInput(idea: Pick<ContributionIdea, "topics" | "reason" | "angle" | "concepts">): AngleInput {
  return {
    topics: idea.topics,
    concepts: idea.concepts,
    reason: idea.reason,
    angle: idea.angle,
  };
}

function addConcept(tokens: Set<string>, value: string): void {
  const whole = slug(value);
  if (whole) tokens.add(whole);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const overlap = intersectionSize(a, b);
  const union = a.size + b.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count += 1;
  }
  return count;
}
