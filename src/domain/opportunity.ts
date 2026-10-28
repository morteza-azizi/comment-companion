import type { ConversationInput } from "./wine-context";
import {
  DIMENSION_LABEL,
  INSIGHT_DIMENSION,
  THEME_LABEL,
  type ConversationDimension,
  type TastingTheme,
} from "./tasting-lexicon";
import {
  findObservations,
  type Insight,
  type Observation,
  type ReviewAnalysis,
} from "./review-analysis";

export type InteractionType =
  | "ASK_SPECIFIC_QUESTION"
  | "SHARE_OBSERVATION"
  | "COMPARE_PERSPECTIVES"
  | "RESPECTFULLY_DISAGREE"
  | "ACKNOWLEDGE_INSIGHT"
  | "EXPLORE_DIFFERENCE";

export type Recommendation = InteractionType | "SKIP" | "REQUEST_MORE_CONTEXT";

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  ASK_SPECIFIC_QUESTION: "Ask a specific question",
  SHARE_OBSERVATION: "Share an observation",
  COMPARE_PERSPECTIVES: "Compare perspectives",
  RESPECTFULLY_DISAGREE: "Respectfully disagree",
  ACKNOWLEDGE_INSIGHT: "Acknowledge a specific insight",
  EXPLORE_DIFFERENCE: "Explore the difference",
  SKIP: "Skip",
  REQUEST_MORE_CONTEXT: "Needs more context",
};

/** The material a comment is built from. Always grounded in the review text or my own note. */
export type Focus =
  | { kind: "contrast"; first: Observation; second: Observation }
  | { kind: "hedge"; observation: Observation }
  | { kind: "balance"; first: Observation; second: Observation }
  | { kind: "single"; observation: Observation }
  | { kind: "insight"; insight: Insight }
  | { kind: "comparison"; insight: Insight }
  | { kind: "rating-gap"; observation: Observation; reviewerRating: number; average: number }
  | { kind: "my-note"; observation: Observation; relation: "agree" | "differ" | "parallel" | "unrelated" };

export interface Candidate {
  /** Stable for the same review: lets "another angle" skip what was already shown. */
  id: string;
  type: InteractionType;
  dimension: ConversationDimension;
  /** What the idea is about. Two candidates with the same type and concepts are the same idea. */
  concepts: string[];
  /** Verbatim phrases from the review. A comment must refer to at least one. */
  anchors: string[];
  /** Short label of the angle, for the UI. */
  angle: string;
  /** Why this comment would be worth posting. */
  reason: string;
  focus: Focus;
  /** Lower comes first. */
  priority: number;
}

export interface Decision {
  recommendation: Recommendation;
  /** Plain-language reason shown to me. */
  reason: string;
  candidates: Candidate[];
}

const THEME_ORDER: readonly TastingTheme[] = [
  "finish",
  "oak",
  "tannin",
  "aromatics",
  "fruit",
  "acidity",
  "sweetness",
  "body",
  "balance",
  "condition",
];

const quote = (phrase: string): string => `“${phrase}”`;

export function decideOpportunity(input: ConversationInput, analysis: ReviewAnalysis): Decision {
  if (!analysis.text) {
    return {
      recommendation: "REQUEST_MORE_CONTEXT",
      reason: "There is no review text to respond to. Paste the review into the details to continue.",
      candidates: [],
    };
  }

  const candidates = buildCandidates(input, analysis);
  const hasSignal = analysis.observations.length > 0 || analysis.insights.length > 0 || analysis.comparisons.length > 0;

  if (!hasSignal && analysis.truncated) {
    return {
      recommendation: "REQUEST_MORE_CONTEXT",
      reason: "The review looks cut off. Open the full review and paste it in before deciding.",
      candidates: [],
    };
  }
  if (analysis.isGeneric) {
    return {
      recommendation: "SKIP",
      reason: "The review is a general impression (praise, a shrug) or very short. There is no specific detail to build a real conversation on.",
      candidates: [],
    };
  }
  if (analysis.hasUnrecognizedDetail) {
    return {
      recommendation: "SKIP",
      reason:
        "The review has some detail, but I can't reliably pin down a tasting point to respond to. Skip it, or write your own comment.",
      candidates: [],
    };
  }
  const first = candidates[0];
  if (!first) {
    return {
      recommendation: "SKIP",
      reason: "Nothing in this review gives me a concrete, honest angle to add to.",
      candidates: [],
    };
  }
  return { recommendation: first.type, reason: first.reason, candidates };
}

function makeId(type: InteractionType, dimension: ConversationDimension, concepts: string[]): string {
  return `${type}:${dimension}:${[...concepts].sort().join("+")}`;
}

function candidate(parts: Omit<Candidate, "id">): Candidate {
  return { ...parts, id: makeId(parts.type, parts.dimension, parts.concepts) };
}

function buildCandidates(input: ConversationInput, analysis: ReviewAnalysis): Candidate[] {
  const found: Candidate[] = [];

  // --- Using MY OWN note (the only honest source of first-person claims). ---
  const myNote = (input.myNote ?? "").trim();
  if (myNote) found.push(...candidatesFromMyNote(myNote, analysis));

  // --- Tension inside the review. ---
  const contrastThemes = new Set<string>();
  for (const { first, second } of analysis.contrasts) {
    contrastThemes.add(first.phrase);
    contrastThemes.add(second.phrase);
    found.push(
      candidate({
        type: "EXPLORE_DIFFERENCE",
        dimension: "tasting",
        concepts: [first.theme, second.theme],
        anchors: [first.phrase, second.phrase],
        angle: `How ${quote(first.phrase)} and ${quote(second.phrase)} sit together`,
        reason: `The reviewer sets ${quote(first.phrase)} against ${quote(second.phrase)}, which is an open question about how the two fit.`,
        focus: { kind: "contrast", first, second },
        priority: 10,
      }),
    );
  }
  for (const observation of analysis.hedged) {
    if (contrastThemes.has(observation.phrase)) continue;
    found.push(
      candidate({
        type: "EXPLORE_DIFFERENCE",
        dimension: "tasting",
        concepts: [observation.theme, "uncertain"],
        anchors: [observation.phrase],
        angle: `What is behind the hedge on ${quote(observation.phrase)}`,
        reason: `The reviewer hedges on ${quote(observation.phrase)}, so there is room to ask what they were noticing.`,
        focus: { kind: "hedge", observation },
        priority: 11,
      }),
    );
  }

  // --- Things the reviewer shares or compares. ---
  for (const insight of analysis.comparisons) {
    const dimension: ConversationDimension = /\b(?:19|20)\d{2}\b|vintage/i.test(insight.phrase) ? "vintage" : "comparison";
    found.push(
      candidate({
        type: "COMPARE_PERSPECTIVES",
        dimension,
        concepts: [dimension, "reviewer-comparison"],
        anchors: [insight.phrase],
        angle: `The comparison they draw: ${quote(insight.phrase)}`,
        reason: `The reviewer compares this wine to something (${quote(insight.phrase)}). What made them think of it is not stated.`,
        focus: { kind: "comparison", insight },
        priority: 20,
      }),
    );
  }
  for (const insight of analysis.insights) {
    const dimension = INSIGHT_DIMENSION[insight.kind];
    const acknowledge = insight.kind === "aging" || insight.kind === "serving" || insight.kind === "style";
    found.push(
      candidate({
        type: acknowledge ? "ACKNOWLEDGE_INSIGHT" : "ASK_SPECIFIC_QUESTION",
        dimension,
        concepts: [dimension, insight.kind],
        anchors: [insight.phrase],
        angle: `Their note on ${DIMENSION_LABEL[dimension]}: ${quote(insight.phrase)}`,
        reason: acknowledge
          ? `The reviewer shares something practical about ${DIMENSION_LABEL[dimension]} (${quote(insight.phrase)}).`
          : `The reviewer mentions ${DIMENSION_LABEL[dimension]} (${quote(insight.phrase)}) without saying why, which is worth asking about.`,
        focus: { kind: "insight", insight },
        priority: acknowledge ? 30 : 40,
      }),
    );
  }

  // --- Tasting detail. ---
  const byTheme = new Map<TastingTheme, Observation>();
  for (const observation of analysis.observations) {
    if (!byTheme.has(observation.theme)) byTheme.set(observation.theme, observation);
  }
  // A faulty bottle ("corked") is not a tasting detail to quiz someone about.
  const tasteObservations = analysis.observations.filter((item) => item.theme !== "condition");
  const themes = THEME_ORDER.filter((theme) => theme !== "condition" && byTheme.has(theme));

  const pair = pickBalancePair(tasteObservations);
  if (pair) {
    found.push(
      candidate({
        type: "ASK_SPECIFIC_QUESTION",
        dimension: "tasting",
        concepts: [pair[0].theme, pair[1].theme, "balance"],
        anchors: [pair[0].phrase, pair[1].phrase],
        angle: `How ${quote(pair[0].phrase)} and ${quote(pair[1].phrase)} balance`,
        reason: `The reviewer mentions both ${quote(pair[0].phrase)} and ${quote(pair[1].phrase)}; how they balance is a natural thing to ask.`,
        focus: { kind: "balance", first: pair[0], second: pair[1] },
        priority: 50,
      }),
    );
  }

  themes.forEach((theme, index) => {
    const observation = byTheme.get(theme) as Observation;
    found.push(
      candidate({
        type: "ASK_SPECIFIC_QUESTION",
        dimension: "tasting",
        concepts: [theme],
        anchors: [observation.phrase],
        angle: `The ${quote(observation.phrase)} detail`,
        reason: `The reviewer pins down ${quote(observation.phrase)}, a specific tasting detail you can ask about.`,
        focus: { kind: "single", observation },
        priority: 60 + index,
      }),
    );
  });

  const gap = ratingGap(input);
  if (gap && analysis.observations.length > 0) {
    const anchor =
      analysis.observations.find((item) => item.direction !== "neutral") ?? (analysis.observations[0] as Observation);
    found.push(
      candidate({
        type: "ASK_SPECIFIC_QUESTION",
        dimension: "preference",
        concepts: ["rating-gap", anchor.theme],
        anchors: [anchor.phrase],
        angle: "Why their score differs from the average",
        reason: `Their score (${gap.reviewerRating.toFixed(1)}) is far from the community average (${gap.average.toFixed(1)}), and they mention ${quote(anchor.phrase)}.`,
        focus: { kind: "rating-gap", observation: anchor, reviewerRating: gap.reviewerRating, average: gap.average },
        priority: 70,
      }),
    );
  }

  const unique = new Map<string, Candidate>();
  for (const item of found) if (!unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()].sort((a, b) => a.priority - b.priority);
}

function ratingGap(input: ConversationInput): { reviewerRating: number; average: number } | undefined {
  const reviewerRating = input.review.rating;
  const average = input.wine.rating;
  if (typeof reviewerRating !== "number" || typeof average !== "number") return undefined;
  return Math.abs(reviewerRating - average) >= 0.8 ? { reviewerRating, average } : undefined;
}

function pickBalancePair(observations: Observation[]): [Observation, Observation] | undefined {
  for (let i = 0; i < observations.length; i += 1) {
    for (let j = i + 1; j < observations.length; j += 1) {
      const a = observations[i] as Observation;
      const b = observations[j] as Observation;
      if (a.theme !== b.theme && a.sentenceIndex === b.sentenceIndex) return [a, b];
    }
  }
  const themes = new Set<TastingTheme>();
  const distinct: Observation[] = [];
  for (const item of observations) {
    if (themes.has(item.theme)) continue;
    themes.add(item.theme);
    distinct.push(item);
  }
  return distinct.length >= 2 ? [distinct[0] as Observation, distinct[1] as Observation] : undefined;
}

function candidatesFromMyNote(myNote: string, analysis: ReviewAnalysis): Candidate[] {
  const mine = findObservations(myNote);
  const out: Candidate[] = [];
  const reviewTop = analysis.observations[0];

  for (const theirs of analysis.observations) {
    const same = mine.find((item) => item.theme === theirs.theme);
    if (!same) continue;
    const opposed = same.direction !== "neutral" && theirs.direction !== "neutral" && same.direction !== theirs.direction;
    const agree = same.direction !== "neutral" && same.direction === theirs.direction;
    const relation = opposed ? "differ" : agree ? "agree" : same.phrase.toLowerCase() === theirs.phrase.toLowerCase() ? "agree" : "parallel";
    const type: InteractionType =
      relation === "differ" ? "RESPECTFULLY_DISAGREE" : relation === "parallel" ? "COMPARE_PERSPECTIVES" : "SHARE_OBSERVATION";
    out.push(
      candidate({
        type,
        dimension: "tasting",
        concepts: [theirs.theme, `my-note-${relation}`],
        anchors: [theirs.phrase],
        angle:
          relation === "differ"
            ? `Your different take on ${quote(theirs.phrase)}`
            : relation === "parallel"
              ? `Your impression next to ${quote(theirs.phrase)}`
              : `Your own impression alongside ${quote(theirs.phrase)}`,
        reason:
          relation === "differ"
            ? `Your note and the review point in opposite directions on ${THEME_LABEL[theirs.theme]}. You can say so honestly and politely.`
            : relation === "parallel"
              ? `You and the reviewer both touch ${THEME_LABEL[theirs.theme]} with different words. Comparing them is a real exchange.`
              : `Your own note lines up with ${quote(theirs.phrase)}, so you can add what you noticed.`,
        focus: { kind: "my-note", observation: theirs, relation },
        priority: relation === "differ" ? 0 : relation === "agree" ? 1 : 2,
      }),
    );
  }

  if (out.length === 0 && reviewTop) {
    out.push(
      candidate({
        type: "SHARE_OBSERVATION",
        dimension: "tasting",
        concepts: [reviewTop.theme, "my-note-unrelated"],
        anchors: [reviewTop.phrase],
        angle: `Your own impression, prompted by ${quote(reviewTop.phrase)}`,
        reason: `You wrote your own impression, and the reviewer's ${quote(reviewTop.phrase)} is a natural place to bring it up.`,
        focus: { kind: "my-note", observation: reviewTop, relation: "unrelated" },
        priority: 3,
      }),
    );
  }
  return out;
}
