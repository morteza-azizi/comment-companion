import { isSameWording } from "./angle-fingerprint";
import type { Candidate } from "./opportunity";
import { findObservations, type ReviewAnalysis } from "./review-analysis";
import { countWords, normalizeText } from "./text-match";
import { STOP_WORDS } from "./tasting-lexicon";
import { describeWine, type ConversationInput } from "./wine-context";

export type GateFailure =
  | "empty"
  | "too_long"
  | "generic"
  | "not_anchored"
  | "echo"
  | "invented_experience"
  | "invented_characteristic"
  | "unsupported_generalization"
  | "repeated_wording";

export const GATE_MESSAGE: Record<GateFailure, string> = {
  empty: "The comment is empty.",
  too_long: "The comment is too long to be a natural reply.",
  generic: "The comment is generic praise or filler.",
  not_anchored: "The comment does not refer to a specific detail from the review.",
  echo: "The comment only repeats the reviewer's words without adding anything.",
  invented_experience: "The comment claims a personal tasting experience that you did not provide.",
  invented_characteristic: "The comment states a wine characteristic that is not in the review, your note, or the wine details.",
  unsupported_generalization: "The comment makes a general wine claim that nothing in the review supports.",
  repeated_wording: "The comment repeats wording you used recently.",
};

export interface GateContext {
  candidate: Pick<Candidate, "anchors">;
  input: ConversationInput;
  analysis: Pick<ReviewAnalysis, "text">;
  /** Recently USED comments, to catch the same sentence skeleton again. */
  recentComments?: readonly string[];
}

export interface GateResult {
  passed: boolean;
  failures: GateFailure[];
}

export const MAX_COMMENT_WORDS = 60;

const GENERIC_PATTERNS: readonly RegExp[] = [
  /\bgreat (?:review|note|post|wine|notes|description)\b/i,
  /\bnice (?:review|note|post|wine|notes)\b/i,
  /\bthanks? for sharing\b/i,
  /\bsounds? (?:delicious|great|good|amazing|lovely|wonderful)\b/i,
  /\bso true\b/i,
  /\bwell said\b/i,
  /\blove (?:this|that|it)\b/i,
  /\bcheers\b/i,
  /^\s*wow\b/i,
  /\bwhat do you think\?\s*$/i,
  /\bgood (?:one|choice|pick)\b/i,
];

// First-person tasting/experience claims. Allowed ONLY inside my own note.
const EXPERIENCE_CLAIMS: readonly RegExp[] = [
  /\bi(?:'ve|’ve| have| had| also| just|'d|’d| would)?\s+(?:tasted|tried|had|drank|drunk|opened|bought|loved|liked|enjoyed|found|noticed|got|picked up|felt|experienced|smelled|taste|think|prefer|feel|find|get|agree)\b/i,
  /\b(?:we|my (?:wife|husband|friends?|partner))\s+(?:had|tried|drank|opened|loved|enjoyed)\b/i,
  /\bmy (?:favou?rite|experience|bottle|last|cellar|palate|go-to)\b/i,
  /\b(?:same here|me too|i agree|agreed|likewise|same (?:for|with) me)\b/i,
  /\bwhen i (?:tried|had|drank|opened)\b/i,
];

// Words that only make sense as a claim about MY experience when I wrote no note.
const SELF_REFERENCE: readonly RegExp[] = [/\bmine\b/i, /\bfor me\b/i, /\bmy own\b/i];

const GENERALIZATIONS =
  /\b(?:typically|generally|usually|traditionally|is known for|are known for|characterized by|characteristic of|classically|by definition|in general)\b/i;

function stripQuotes(text: string): string {
  return text.replace(/[“"][^”"]*[”"]/g, " ");
}

function stripNote(comment: string, myNote?: string): string {
  const note = (myNote ?? "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  if (!note) return comment;
  const normalized = comment.replace(/\s+/g, " ");
  const index = normalized.toLowerCase().indexOf(note.toLowerCase());
  return index === -1 ? normalized : `${normalized.slice(0, index)} ${normalized.slice(index + note.length)}`;
}

function wineText(input: ConversationInput): string {
  return `${describeWine(input.wine)} ${input.wine.wineName ?? ""} ${input.wine.producer ?? ""}`;
}

function fold(text: string): string {
  return normalizeText(text.replace(/-/g, " "));
}

export function checkQuality(comment: string, context: GateContext): GateResult {
  const failures: GateFailure[] = [];
  const text = comment.replace(/\s+/g, " ").trim();
  const myNote = context.input.myNote?.trim() ? context.input.myNote : undefined;

  if (!text) return { passed: false, failures: ["empty"] };
  if (countWords(text) > MAX_COMMENT_WORDS) failures.push("too_long");

  const withoutNote = stripNote(text, myNote);
  // Words inside quotation marks are the reviewer's, not mine: they are
  // never read as a claim I am making.
  const mine = stripQuotes(withoutNote);

  if (GENERIC_PATTERNS.some((pattern) => pattern.test(withoutNote))) failures.push("generic");

  const lower = fold(text);
  if (!context.candidate.anchors.some((anchor) => lower.includes(fold(anchor)))) failures.push("not_anchored");

  const ownWords = (mine.toLowerCase().match(/[\p{L}']+/gu) ?? []).filter(
    (word) => !STOP_WORDS.has(word),
  );
  const reviewWords = new Set(context.analysis.text.toLowerCase().match(/[\p{L}']+/gu) ?? []);
  if (ownWords.length < 4 || ownWords.every((word) => reviewWords.has(word))) failures.push("echo");

  if (EXPERIENCE_CLAIMS.some((pattern) => pattern.test(mine))) failures.push("invented_experience");
  else if (!myNote && SELF_REFERENCE.some((pattern) => pattern.test(mine))) failures.push("invented_experience");

  const sources = fold(`${context.analysis.text} ${myNote ?? ""} ${wineText(context.input)}`);
  const unsupported = findObservations(withoutNote).some((observation) => !sources.includes(fold(observation.phrase)));
  if (unsupported) failures.push("invented_characteristic");

  if (GENERALIZATIONS.test(mine)) failures.push("unsupported_generalization");

  if ((context.recentComments ?? []).some((previous) => isSameWording(text, previous))) {
    failures.push("repeated_wording");
  }

  return { passed: failures.length === 0, failures };
}
