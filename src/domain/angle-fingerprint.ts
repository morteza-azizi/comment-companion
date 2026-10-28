import { normalizeText } from "./text-match";

// Repetition has three different meanings, and they are treated differently:
//
//   SAME_WORDING          the same sentence skeleton again (only the wine's
//                         own quoted words changed). Interchangeable.
//   SAME_IDEA             a different sentence, but the same kind of move on
//                         the same concept (e.g. "ask about timing of the
//                         tannins" twice). Interchangeable.
//   SAME_TOPIC_NEW_ANGLE  the same wine topic reached a different way
//                         (a question about acidity, then a comparison
//                         involving acidity). Fine, even welcome.

export type Repetition = "NEW" | "SAME_TOPIC_NEW_ANGLE" | "SAME_IDEA" | "SAME_WORDING";

export interface IdeaKey {
  type: string;
  dimension: string;
  concepts: readonly string[];
}

export interface PastUse extends IdeaKey {
  comment?: string;
  at: number;
}

export interface RepetitionAssessment {
  kind: Repetition;
  matched?: PastUse;
}

export const RECENT_USE_COUNT = 5;
export const RECENT_USE_MS = 14 * 86_400_000;

const SIMILARITY_THRESHOLD = 0.5;
const WORDING_THRESHOLD = 0.75;

export function slug(text: string): string {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function conceptSet(concepts: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const concept of concepts) {
    const s = slug(concept);
    if (s) out.add(s);
  }
  return out;
}

export function fingerprintIdea(key: IdeaKey): string {
  return [key.type, key.dimension, [...conceptSet(key.concepts)].sort().join("+")].join("|");
}

export function angleSimilarity(left: readonly string[], right: readonly string[]): number {
  return jaccard(conceptSet(left), conceptSet(right));
}

function overlapCount(left: readonly string[], right: readonly string[]): number {
  const a = conceptSet(left);
  const b = conceptSet(right);
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

/** Same kind of move on essentially the same concepts. */
export function isSameIdea(left: IdeaKey, right: IdeaKey): boolean {
  if (left.type !== right.type || left.dimension !== right.dimension) return false;
  const a = conceptSet(left.concepts);
  const b = conceptSet(right.concepts);
  if (a.size === 0 || b.size === 0) return false;
  if (jaccard(a, b) >= SIMILARITY_THRESHOLD) return true;
  const overlap = overlapCount(left.concepts, right.concepts);
  return overlap >= 2 && (overlap === a.size || overlap === b.size);
}

/** Same wine topic (dimension and at least one concept), regardless of the move made. */
export function sharesTopic(left: IdeaKey, right: IdeaKey): boolean {
  return left.dimension === right.dimension && overlapCount(left.concepts, right.concepts) > 0;
}

/**
 * The sentence skeleton: the comment with quoted material removed. The
 * quotes are the wine-specific part; what remains is the reusable template.
 */
export function skeletonOf(comment: string): string {
  return normalizeText(
    comment
      .replace(/[“"][^”"]*[”"]/g, " ")
      .replace(/\b(?:19|20)\d{2}\b/g, " ")
      .replace(/[^\p{L}\s]/gu, " "),
  );
}

export function wordingSimilarity(left: string, right: string): number {
  const a = new Set(skeletonOf(left).split(" ").filter((word) => word.length > 2));
  const b = new Set(skeletonOf(right).split(" ").filter((word) => word.length > 2));
  return jaccard(a, b);
}

export function isSameWording(left: string, right: string): boolean {
  return wordingSimilarity(left, right) >= WORDING_THRESHOLD;
}

/** Only recent uses matter: last few, within a couple of weeks. */
export function recentUses(uses: readonly PastUse[], now = Date.now()): PastUse[] {
  return uses.filter((use) => now - use.at <= RECENT_USE_MS).slice(-RECENT_USE_COUNT);
}

export function assessRepetition(
  candidate: IdeaKey,
  comment: string | undefined,
  uses: readonly PastUse[],
  now = Date.now(),
): RepetitionAssessment {
  let best: RepetitionAssessment = { kind: "NEW" };
  for (const use of recentUses(uses, now)) {
    if (comment && use.comment && isSameWording(comment, use.comment)) {
      return { kind: "SAME_WORDING", matched: use };
    }
    if (isSameIdea(candidate, use)) {
      best = { kind: "SAME_IDEA", matched: use };
    } else if (best.kind === "NEW" && sharesTopic(candidate, use)) {
      best = { kind: "SAME_TOPIC_NEW_ANGLE", matched: use };
    }
  }
  return best;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  const union = a.size + b.size - overlap;
  return union === 0 ? 0 : overlap / union;
}
