import type { ConversationInput } from "../domain/wine-context";

// Manual input is the dependable path: it works whether or not Vivino's page
// structure can be read. Everything is validated and cleaned; anything that
// does not make sense is dropped with a warning rather than guessed.

export interface ManualFields {
  wineName?: unknown;
  producer?: unknown;
  vintage?: unknown;
  region?: unknown;
  country?: unknown;
  /** Community average shown on the wine. */
  rating?: unknown;
  reviewer?: unknown;
  reviewText?: unknown;
  /** The reviewer's own score. */
  reviewRating?: unknown;
  myNote?: unknown;
}

export type ParseResult =
  | { ok: true; input: ConversationInput; warnings: string[] }
  | { ok: false; error: string };

export const MAX_REVIEW_CHARS = 2000;
const MAX_FIELD_CHARS = 150;
const MAX_NOTE_CHARS = 400;

export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const cleaned = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

function parseRating(value: unknown): number | undefined | "invalid" {
  if (value === undefined || value === null || value === "") return undefined;
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  const parsed = Number.parseFloat(text.replace(",", "."));
  if (!Number.isFinite(parsed)) return "invalid";
  if (parsed === 0) return undefined; // Vivino shows 0.0 when there are no ratings yet.
  return parsed >= 1 && parsed <= 5 ? Math.round(parsed * 10) / 10 : "invalid";
}

function parseVintage(value: unknown, nowYear: number): number | undefined | "invalid" {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (/^n\.?v\.?$/i.test(text)) return undefined;
  if (!/^\d{4}$/.test(text)) return "invalid";
  const year = Number.parseInt(text, 10);
  return year >= 1900 && year <= nowYear + 1 ? year : "invalid";
}

export function parseManualInput(fields: unknown, nowYear = new Date().getFullYear()): ParseResult {
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    return { ok: false, error: "Nothing to analyze. Paste a review to get started." };
  }
  const raw = fields as ManualFields;
  const warnings: string[] = [];

  const reviewRaw = typeof raw.reviewText === "string" ? raw.reviewText : undefined;
  const text = cleanText(reviewRaw, Number.MAX_SAFE_INTEGER);
  let reviewText = text;
  if (text && text.length > MAX_REVIEW_CHARS) {
    reviewText = text.slice(0, MAX_REVIEW_CHARS).trim();
    warnings.push(`The review was longer than ${MAX_REVIEW_CHARS} characters, so only the start was used.`);
  }

  const vintage = parseVintage(raw.vintage, nowYear);
  if (vintage === "invalid") warnings.push("The vintage was not a valid year, so it was ignored.");
  const rating = parseRating(raw.rating);
  if (rating === "invalid") warnings.push("The wine rating must be between 1 and 5, so it was ignored.");
  const reviewRating = parseRating(raw.reviewRating);
  if (reviewRating === "invalid") warnings.push("The reviewer's score must be between 1 and 5, so it was ignored.");

  const input: ConversationInput = {
    wine: {
      wineName: cleanText(raw.wineName, MAX_FIELD_CHARS),
      producer: cleanText(raw.producer, MAX_FIELD_CHARS),
      vintage: vintage === "invalid" ? undefined : vintage,
      region: cleanText(raw.region, MAX_FIELD_CHARS),
      country: cleanText(raw.country, MAX_FIELD_CHARS),
      rating: rating === "invalid" ? undefined : rating,
    },
    review: {
      text: reviewText,
      rating: reviewRating === "invalid" ? undefined : reviewRating,
      reviewer: cleanText(raw.reviewer, MAX_FIELD_CHARS),
    },
    myNote: cleanText(raw.myNote, MAX_NOTE_CHARS),
  };

  const empty =
    !input.review.text && !input.wine.wineName && !input.wine.producer && !input.myNote && input.review.rating === undefined;
  if (empty) return { ok: false, error: "Nothing to analyze. Paste a review to get started." };

  return { ok: true, input, warnings };
}
