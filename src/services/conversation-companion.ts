import { assessRepetition, recentUses, type PastUse, type Repetition } from "../domain/angle-fingerprint";
import { decideOpportunity, type Candidate, type Recommendation } from "../domain/opportunity";
import { checkQuality } from "../domain/quality-gate";
import { analyzeReview, type ReviewAnalysis } from "../domain/review-analysis";
import { reviewReference, type ConversationInput } from "../domain/wine-context";
import { writeVariants } from "./comment-writer";

// The whole decision pipeline, as one pure function:
//   analysis -> opportunity decision -> (skip | pick an angle) ->
//   write one comment -> quality gate -> repetition check.
// It never posts anything and never touches the page.

export interface Suggestion {
  reference: string;
  recommendation: Recommendation;
  /** Why this recommendation, in plain words. */
  reason: string;
  /** Present only when recommendation is a comment type. */
  comment?: string;
  candidate?: Candidate;
  repetition: Repetition;
  analysis: ReviewAnalysis;
  /** How many other angles from this review could still be tried. */
  anglesLeft: number;
}

export interface SuggestOptions {
  /** Comments I have actually used, for repetition checks. */
  uses?: readonly PastUse[];
  /** Angles already shown for this review ("try a different angle"). */
  skipIds?: readonly string[];
  now?: number;
}

export function suggest(input: ConversationInput, options: SuggestOptions = {}): Suggestion {
  const reference = reviewReference(input);
  const analysis = analyzeReview(input.review, input.wine);
  const decision = decideOpportunity(input, analysis);
  const base = { reference, analysis, repetition: "NEW" as Repetition, anglesLeft: 0 };

  if (decision.candidates.length === 0) {
    return { ...base, recommendation: decision.recommendation, reason: decision.reason };
  }

  const skip = new Set(options.skipIds ?? []);
  const remaining = decision.candidates.filter((candidate) => !skip.has(candidate.id));
  if (remaining.length === 0) {
    return {
      ...base,
      recommendation: "SKIP",
      reason: "There are no other honest angles in this review. Skipping it is fine.",
    };
  }

  const uses = options.uses ?? [];
  const now = options.now ?? Date.now();
  const recentComments = recentUses(uses, now)
    .map((use) => use.comment)
    .filter((comment): comment is string => Boolean(comment));

  let blockedByRepetition = false;
  for (const [index, candidate] of remaining.entries()) {
    const idea = assessRepetition(candidate, undefined, uses, now);
    if (idea.kind === "SAME_IDEA") {
      blockedByRepetition = true;
      continue;
    }
    for (const variant of writeVariants(candidate, input)) {
      const gate = checkQuality(variant, { candidate, input, analysis, recentComments });
      if (!gate.passed) {
        if (gate.failures.includes("repeated_wording")) blockedByRepetition = true;
        continue;
      }
      return {
        ...base,
        recommendation: candidate.type,
        reason: candidate.reason,
        comment: variant,
        candidate,
        repetition: idea.kind,
        anglesLeft: remaining.length - index - 1,
      };
    }
  }

  return {
    ...base,
    recommendation: "SKIP",
    reason: blockedByRepetition
      ? "What I could say here would be the same kind of comment you used recently. Skipping keeps your comments from becoming interchangeable."
      : "I couldn't write something specific and honest enough from this review. Skip it, or write your own.",
  };
}
