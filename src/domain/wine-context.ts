// Everything the tool is told about one wine and one review. Every field is
// optional: Vivino pages do not always expose everything, and a missing
// field stays `undefined` rather than being guessed.

/** Facts about the bottle itself, as read from the page or typed in. */
export interface WineContext {
  wineName?: string;
  producer?: string;
  vintage?: number;
  country?: string;
  region?: string;
  /** Only grapes literally listed on the page or in the wine name. */
  grapes?: string[];
  /** Community average rating. */
  rating?: number;
  ratingCount?: number;
}

/** What the reviewer wrote. */
export interface ReviewContext {
  text?: string;
  /** The reviewer's own score for this wine, not the community average. */
  rating?: number;
  reviewer?: string;
  /** Link to the reviewer's profile or the review, if the page exposes one. */
  url?: string;
}

export interface ConversationInput {
  wine: WineContext;
  review: ReviewContext;
  /**
   * My own genuine impression of this wine, typed by me. This is the ONLY
   * source of first-person tasting claims the tool is ever allowed to use.
   */
  myNote?: string;
}

export function describeWine(wine: WineContext): string {
  const name = [wine.producer, wine.wineName]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index)
    .join(" ");
  const place = [wine.region, wine.country].filter(Boolean).join(", ");
  const pieces = [
    name || undefined,
    wine.vintage !== undefined ? String(wine.vintage) : undefined,
    place || undefined,
    wine.grapes?.length ? wine.grapes.join(", ") : undefined,
    wine.rating !== undefined ? `avg ${wine.rating.toFixed(1)}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return pieces.join(" · ");
}

/**
 * A stable key for "this review of this wine", used to recognise a review I
 * have already processed. Not a security hash.
 */
export function reviewReference(input: ConversationInput): string {
  const wine = [input.wine.producer, input.wine.wineName, input.wine.vintage]
    .filter((part) => part !== undefined && part !== "")
    .join(" ")
    .toLowerCase()
    .trim();
  const reviewer = (input.review.reviewer ?? "").toLowerCase().trim();
  const body = (input.review.text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${wine || "unknown-wine"}#${reviewer || "unknown-reviewer"}#${hashString(body)}`;
}

export function hashString(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}
