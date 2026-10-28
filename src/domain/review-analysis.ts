import type { ReviewContext, WineContext } from "./wine-context";
import {
  DIMENSION_LABEL,
  INSIGHT_DIMENSION,
  INSIGHT_PATTERNS,
  NEGATIVE_WORDS,
  POSITIVE_WORDS,
  PRAISE_WORDS,
  STOP_WORDS,
  TASTING_LEXICON,
  THEME_LABEL,
  type Direction,
  type InsightKind,
  type TastingTheme,
} from "./tasting-lexicon";
import { hasAnyMarker } from "./text-match";

/** A tasting descriptor the text actually contains, quoted verbatim. */
export interface Observation {
  theme: TastingTheme;
  direction: Direction;
  /** Verbatim words from the text (including a leading "not"/"too" if present). */
  phrase: string;
  sentenceIndex: number;
  start: number;
  hedged: boolean;
}

/** Advice or knowledge the reviewer shares (food, serving, aging, ...). */
export interface Insight {
  kind: InsightKind;
  phrase: string;
  sentenceIndex: number;
}

/** Two descriptors the reviewer set against each other ("acidic but balanced"). */
export interface Contrast {
  first: Observation;
  second: Observation;
}

export type Sentiment = "positive" | "negative" | "mixed" | "neutral";

export interface ReviewAnalysis {
  text: string;
  wordCount: number;
  /** The text looks cut off ("…", "read more"), so it may be incomplete. */
  truncated: boolean;
  observations: Observation[];
  insights: Insight[];
  contrasts: Contrast[];
  /** Observations the reviewer hedged ("a bit", "maybe", "not sure"). */
  hedged: Observation[];
  /** The reviewer says a comparison ("reminds me of ...") with their own words. */
  comparisons: Insight[];
  sentiment: Sentiment;
  /** Only praise or filler; nothing specific to respond to. */
  isGeneric: boolean;
  /** There is some detail, but nothing this tool can reliably interpret. */
  hasUnrecognizedDetail: boolean;
  /** Stated in the review. */
  facts: string[];
  /** Readings of the review. Not facts. */
  interpretations: string[];
  /** Things that cannot be known from the review. */
  unknowns: string[];
}

// "a bit too much" is a judgement of excess, not uncertainty, so it is excluded.
const HEDGE_MARKER =
  /\b(?:a bit(?! too| much)|a little(?! too| much)|slightly|somewhat|kind of|sort of|maybe|perhaps|not sure(?: about| if)?|i think|i guess|seemed|seems|might be|probably)\b/gi;
// Markers that can also trail what they hedge ("oaky, I think").
const TRAILING_HEDGE = /^(?:maybe|perhaps|i think|i guess|probably|kind of|sort of)$/i;

/** A hedge only counts when it sits right next to the descriptor, not anywhere in the sentence. */
function isHedged(sentence: string, start: number, end: number): boolean {
  for (const marker of sentence.matchAll(HEDGE_MARKER)) {
    const markerStart = marker.index ?? 0;
    const markerEnd = markerStart + marker[0].length;
    if (markerEnd <= start) {
      const gap = sentence.slice(markerEnd, start);
      if (!/[,;:.]/.test(gap) && gap.length <= 18) return true;
    } else if (markerStart >= end && TRAILING_HEDGE.test(marker[0])) {
      if (/^[\s,]{0,3}$/.test(sentence.slice(end, markerStart))) return true;
    }
  }
  return false;
}
const CONNECTIVE = /\b(?:even though|but|though|although|however|yet|while|whereas|despite|except)\b/i;
const NEGATION =
  /(?:\b(?:not|no|never|without|barely|hardly|lacks?|lacking)|n['’]t)\s+(?:(?:too|very|that|really|so|quite|overly|particularly)\s+)?$/i;
const EXCESS = /\btoo\s+$/i;

interface CompiledTerm {
  theme: TastingTheme;
  direction: Direction;
  regex: RegExp;
}

let compiledLexicon: CompiledTerm[] | undefined;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileLexicon(): CompiledTerm[] {
  if (compiledLexicon) return compiledLexicon;
  compiledLexicon = TASTING_LEXICON.flatMap((entry) =>
    entry.terms.map((term) => ({
      theme: entry.theme,
      direction: entry.direction,
      // Spaces and hyphens are interchangeable ("fruit-forward" / "fruit forward").
      regex: new RegExp(
        `(?<![\\p{L}])${term.split(/[\s-]+/).map(escapeRegex).join("[\\s-]+")}(?:s|es)?(?![\\p{L}])`,
        "giu",
      ),
    })),
  );
  return compiledLexicon;
}

interface Sentence {
  text: string;
  start: number;
  end: number;
}

function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  for (const match of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    const raw = match[0];
    if (!raw.trim()) continue;
    sentences.push({ text: raw, start: match.index ?? 0, end: (match.index ?? 0) + raw.length });
  }
  return sentences;
}

function flip(direction: Direction): Direction {
  if (direction === "high") return "low";
  if (direction === "low") return "high";
  return "low";
}

interface RawMatch {
  theme: TastingTheme;
  direction: Direction;
  start: number;
  end: number;
}

/** Finds the tasting descriptors in a text. Used for the review and for my own note. */
export function findObservations(text: string): Observation[] {
  const sentences = splitSentences(text);
  const observations: Observation[] = [];

  sentences.forEach((sentence, sentenceIndex) => {
    const raw: RawMatch[] = [];
    for (const term of compileLexicon()) {
      term.regex.lastIndex = 0;
      for (const match of sentence.text.matchAll(term.regex)) {
        const start = match.index ?? 0;
        raw.push({ theme: term.theme, direction: term.direction, start, end: start + match[0].length });
      }
    }

    // Longest match wins where terms overlap ("bone dry" beats "dry").
    raw.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
    const accepted: RawMatch[] = [];
    for (const candidate of raw) {
      if (accepted.some((other) => candidate.start < other.end && other.start < candidate.end)) continue;
      accepted.push(candidate);
    }
    accepted.sort((a, b) => a.start - b.start);

    // Merge neighbours that describe the same theme ("fresh and crisp").
    const merged: RawMatch[] = [];
    for (const match of accepted) {
      const previous = merged[merged.length - 1];
      const gap = previous ? sentence.text.slice(previous.end, match.start) : "";
      if (previous && previous.theme === match.theme && /^(?:\s|,|and|&)*$/i.test(gap) && gap.length <= 6) {
        previous.end = match.end;
        if (previous.direction === "neutral") previous.direction = match.direction;
      } else {
        merged.push({ ...match });
      }
    }

    for (const match of merged) {
      let start = match.start;
      let direction = match.direction;
      const before = sentence.text.slice(0, start);
      const negation = before.match(NEGATION);
      const excess = before.match(EXCESS);
      if (negation) {
        start -= negation[0].length;
        direction = flip(direction);
      } else if (excess) {
        start -= excess[0].length;
        if (direction === "neutral") direction = "high";
      }
      const phrase = sentence.text.slice(start, match.end).replace(/\s+/g, " ").trim();
      observations.push({
        theme: match.theme,
        direction,
        phrase,
        sentenceIndex,
        start: sentence.start + start,
        hedged: isHedged(sentence.text, start, match.end),
      });
    }
  });

  return observations;
}

function findInsights(text: string): Insight[] {
  const sentences = splitSentences(text);
  const insights: Insight[] = [];
  sentences.forEach((sentence, sentenceIndex) => {
    for (const { kind, pattern } of INSIGHT_PATTERNS) {
      const match = sentence.text.match(pattern);
      if (!match) continue;
      const phrase = match[0].replace(/\s+/g, " ").trim().replace(/[.,;:!?]+$/, "");
      if (phrase.length < 3) continue;
      if (insights.some((existing) => existing.kind === kind && existing.sentenceIndex === sentenceIndex)) continue;
      insights.push({ kind, phrase, sentenceIndex });
    }
  });
  return insights;
}

function findContrasts(text: string, observations: Observation[]): Contrast[] {
  const sentences = splitSentences(text);
  const contrasts: Contrast[] = [];
  sentences.forEach((sentence, index) => {
    const connective = sentence.text.match(CONNECTIVE);
    if (!connective || connective.index === undefined) return;
    const cut = sentence.start + connective.index;
    const inSentence = observations.filter((item) => item.sentenceIndex === index);
    let before = inSentence.filter((item) => item.start < cut).at(-1);
    const after = inSentence.find((item) => item.start >= cut);
    // "acidic but the fruit balances it" resolves the tension; it is a balance
    // statement, not an open contrast.
    const resolved = inSentence.some(
      (item) => item.start >= cut && item.theme === "balance" && item.direction === "high",
    );
    if (resolved) return;
    if (!before && connective.index <= 2) {
      before = observations.filter((item) => item.sentenceIndex === index - 1).at(-1);
    }
    if (before && after && (before.theme !== after.theme || before.direction !== after.direction)) {
      contrasts.push({ first: before, second: after });
    }
  });
  return contrasts;
}

function contentWordCount(text: string): number {
  return (text.toLowerCase().match(/[\p{L}\d']+/gu) ?? []).filter(
    (word) => !STOP_WORDS.has(word) && !PRAISE_WORDS.has(word),
  ).length;
}

function sentimentOf(text: string, rating?: number): Sentiment {
  if (typeof rating === "number") {
    if (rating >= 4) return "positive";
    if (rating < 3) return "negative";
    return "mixed";
  }
  const positive = hasAnyMarker(text, POSITIVE_WORDS);
  const negative = hasAnyMarker(text, NEGATIVE_WORDS);
  if (positive && negative) return "mixed";
  if (positive) return "positive";
  if (negative) return "negative";
  return "neutral";
}

const quote = (phrase: string): string => `“${phrase}”`;

export function analyzeReview(review: ReviewContext, wine: WineContext = {}): ReviewAnalysis {
  const text = (review.text ?? "").replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  const truncated = /(?:…|\.\.\.|\b(?:read|see|show) more)\s*$/i.test(text);

  const observations = findObservations(text);
  const allInsights = findInsights(text);
  const comparisons = allInsights.filter((item) => item.kind === "comparison");
  const insights = allInsights.filter((item) => item.kind !== "comparison");
  const contrasts = findContrasts(text, observations);
  const hedged = observations.filter((item) => item.hedged);
  const sentiment = sentimentOf(text, review.rating);

  const hasSignal = observations.length > 0 || allInsights.length > 0;
  const isGeneric = !hasSignal && contentWordCount(text) < 6;
  const hasUnrecognizedDetail = !hasSignal && !isGeneric;

  const facts: string[] = [];
  for (const item of observations.slice(0, 4)) {
    facts.push(`Says ${quote(item.phrase)} (${THEME_LABEL[item.theme]})`);
  }
  for (const item of [...insights, ...comparisons].slice(0, 3)) {
    facts.push(`Mentions ${quote(item.phrase)} (${DIMENSION_LABEL[INSIGHT_DIMENSION[item.kind]]})`);
  }
  if (typeof review.rating === "number") {
    const average = typeof wine.rating === "number" ? ` (community average ${wine.rating.toFixed(1)})` : "";
    facts.push(`Scored it ${review.rating.toFixed(1)}${average}`);
  }

  const interpretations: string[] = [];
  for (const contrast of contrasts.slice(0, 2)) {
    interpretations.push(`Mixed signals: ${quote(contrast.first.phrase)} set against ${quote(contrast.second.phrase)}`);
  }
  for (const item of hedged.slice(0, 1)) {
    interpretations.push(`Sounds unsure about ${quote(item.phrase)} (hedged wording)`);
  }
  if (text && !isGeneric) interpretations.push(`Overall tone reads ${sentiment}`);
  if (typeof review.rating === "number" && typeof wine.rating === "number") {
    const gap = review.rating - wine.rating;
    if (Math.abs(gap) >= 0.8) {
      interpretations.push(`Scored noticeably ${gap < 0 ? "below" : "above"} the community average`);
    }
  }

  const unknowns = unknownsFor(text, allInsights, observations.length > 0, review, wine);

  return {
    text,
    wordCount,
    truncated,
    observations,
    insights,
    contrasts,
    hedged,
    comparisons,
    sentiment,
    isGeneric,
    hasUnrecognizedDetail,
    facts,
    interpretations,
    unknowns,
  };
}

function unknownsFor(
  text: string,
  insights: Insight[],
  hasObservations: boolean,
  review: ReviewContext,
  wine: WineContext,
): string[] {
  if (!text) return ["There is no review text to read"];
  const kinds = new Set(insights.map((item) => item.kind));
  const unknowns: string[] = [];
  if (typeof review.rating === "number" && !hasObservations) {
    unknowns.push("Why they gave that score");
  }
  if (!kinds.has("pairing")) unknowns.push("What they ate or drank it with");
  if (!kinds.has("serving")) unknowns.push("How it was served (temperature, decanting)");
  if (wine.vintage === undefined) unknowns.push("Which vintage they actually drank");
  else if (!kinds.has("aging")) unknowns.push("Whether the age of this bottle shaped their view");
  if (!kinds.has("value")) unknowns.push("What they paid");
  return unknowns.slice(0, 3);
}
