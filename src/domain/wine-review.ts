import type { ReviewerBand } from "./wine-context";
import { hasAnyMarker, normalizeText } from "./text-match";

export type ReviewTheme =
  | "oak"
  | "tannin"
  | "acid"
  | "fruit"
  | "sweet"
  | "dry"
  | "light"
  | "heavy"
  | "short"
  | "food"
  | "value";

export interface ParsedReview {
  themes: ReviewTheme[];
  snippet?: string;
  band?: ReviewerBand;
}

const THEME_MARKERS: Record<ReviewTheme, readonly string[]> = {
  oak: ["oak", "vanilla", "toasty", "barrel", "buttery"],
  tannin: ["tannin", "tannic", "astringent", "drying", "grippy"],
  acid: ["acid", "crisp", "zesty", "sharp", "fresh"],
  fruit: ["fruit", "cherry", "berry", "strawberry", "raspberry", "blackberry", "apple", "citrus", "jammy", "ripe"],
  sweet: ["sweet", "off-dry", "residual sugar", "sugary"],
  dry: ["bone dry", "very dry", "dry finish"],
  light: ["light", "thin", "delicate", "watery"],
  heavy: ["heavy", "big", "rich", "alcoholic", "hot"],
  short: ["short finish", "fell off", "disappeared", "no finish"],
  food: ["with food", "with dinner", "with steak", "with fish", "needed food"],
  value: ["value", "overpriced", "worth it", "for the price"],
};

export function reviewerBand(rating?: number): ReviewerBand | undefined {
  if (typeof rating !== "number") return undefined;
  if (rating >= 4.5) return "loved";
  if (rating >= 4) return "liked";
  if (rating >= 3) return "mixed";
  return "low";
}

export function parseReview(text?: string, rating?: number): ParsedReview {
  const themes = (Object.keys(THEME_MARKERS) as ReviewTheme[]).filter((theme) =>
    hasAnyMarker(text ?? "", THEME_MARKERS[theme])
  );
  return {
    themes,
    snippet: snippetFrom(text),
    band: reviewerBand(rating),
  };
}

function snippetFrom(text?: string): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 8) return undefined;
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return sentence.length > 80 ? `${sentence.slice(0, 77).trim()}…` : sentence;
}

export function reviewMentions(text: string | undefined, theme: ReviewTheme): boolean {
  return Boolean(text && hasAnyMarker(text, THEME_MARKERS[theme]));
}

export function normalizeReviewText(text?: string): string {
  return normalizeText(text ?? "");
}
