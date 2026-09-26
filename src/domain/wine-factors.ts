import type { WineContext } from "./wine-context";
import { deriveSignals, type WineSignals } from "./wine-signals";

export type WineFactorKind = "fact" | "derived" | "knowledge";

export type WineFactorId =
  | "confirmed_grape"
  | "confirmed_blend"
  | "vintage"
  | "old_vintage"
  | "young_vintage"
  | "region"
  | "country"
  | "producer"
  | "wine_name"
  | "wine_color"
  | "rating"
  | "high_rating"
  | "reviewer_rating"
  | "review_text"
  | "price"
  | "good_value"
  | "premium_price"
  | "grape_knowledge"
  | "winemaking_fork"
  | "region_knowledge"
  | "pairing_knowledge";

export interface WineFactorDefinition {
  id: WineFactorId;
  kind: WineFactorKind;
  /** A lone producer/country/name is not enough to justify a comment. */
  canJustifyComment: boolean;
  description: string;
}

export const WINE_FACTOR_CATALOG: readonly WineFactorDefinition[] = [
  {
    id: "confirmed_grape",
    kind: "fact",
    canJustifyComment: false,
    description: "Grape name(s) from the label or wine page. Never guessed from the region.",
  },
  {
    id: "confirmed_blend",
    kind: "fact",
    canJustifyComment: true,
    description: "Two or more confirmed grapes. The split of jobs in the blend can be the comment.",
  },
  {
    id: "vintage",
    kind: "fact",
    canJustifyComment: false,
    description: "The year on the bottle. Becomes comment-worthy only with age or grape drink-window knowledge.",
  },
  {
    id: "old_vintage",
    kind: "derived",
    canJustifyComment: true,
    description: "Bottle at least 10 years old. Distinctive even when the grape is unknown.",
  },
  {
    id: "young_vintage",
    kind: "derived",
    canJustifyComment: false,
    description: "Bottle 4 years or younger. Useful with grape drink-window knowledge, not alone.",
  },
  {
    id: "region",
    kind: "fact",
    canJustifyComment: false,
    description: "Region string from the page. Comment-worthy only if we recognize it.",
  },
  {
    id: "country",
    kind: "fact",
    canJustifyComment: false,
    description: "Country of origin. Supporting context, not a comment by itself.",
  },
  {
    id: "producer",
    kind: "fact",
    canJustifyComment: false,
    description: "Winery name. Curiosity about a producer is too generic to ship as a comment.",
  },
  {
    id: "wine_name",
    kind: "fact",
    canJustifyComment: false,
    description: "Label name. Used to detect grapes in the title, not as a comment topic.",
  },
  {
    id: "wine_color",
    kind: "fact",
    canJustifyComment: false,
    description: "Red, white, rosé, sparkling, or orange as stated on the label or review. Rosé is not the red of the same grape.",
  },
  {
    id: "rating",
    kind: "fact",
    canJustifyComment: false,
    description: "Community average. Only a high rating is distinctive enough to mention.",
  },
  {
    id: "high_rating",
    kind: "derived",
    canJustifyComment: true,
    description: "Community average at or above 4.2. Talk about consensus, never invent a tasting.",
  },
  {
    id: "reviewer_rating",
    kind: "fact",
    canJustifyComment: true,
    description: "This person's score for this check-in. Reply to their ranking, not only the crowd average.",
  },
  {
    id: "review_text",
    kind: "fact",
    canJustifyComment: true,
    description: "This person's tasting note. The comment should reflect what they actually wrote.",
  },
  {
    id: "price",
    kind: "fact",
    canJustifyComment: false,
    description: "Shelf price if extracted. Schema exists; the card extractor does not fill it yet.",
  },
  {
    id: "good_value",
    kind: "derived",
    canJustifyComment: true,
    description: "Low price plus a solid rating. Requires both facts.",
  },
  {
    id: "premium_price",
    kind: "derived",
    canJustifyComment: true,
    description: "High price as a fact about expectation, not a claim that the bottle is worth it.",
  },
  {
    id: "grape_knowledge",
    kind: "knowledge",
    canJustifyComment: true,
    description: "Known character, drink style, or structure for a confirmed or region-associated grape.",
  },
  {
    id: "winemaking_fork",
    kind: "knowledge",
    canJustifyComment: true,
    description: "A real stylistic fork for that grape (oak vs steel, residual sugar, extraction).",
  },
  {
    id: "region_knowledge",
    kind: "knowledge",
    canJustifyComment: true,
    description: "Recognized region style. Must not be stated as a fact about this exact bottle's grape.",
  },
  {
    id: "pairing_knowledge",
    kind: "knowledge",
    canJustifyComment: true,
    description: "Food pairing. One angle among others, never the default.",
  },
];

export interface AvailableWineFactor extends WineFactorDefinition {
  available: boolean;
}

export function availableWineFactors(
  context: WineContext,
  signals: WineSignals = deriveSignals(context)
): AvailableWineFactor[] {
  const available = new Set(presentFactorIds(context, signals));
  return WINE_FACTOR_CATALOG.map((factor) => ({
    ...factor,
    available: available.has(factor.id),
  }));
}

export function commentWorthyFactorIds(context: WineContext, signals?: WineSignals): WineFactorId[] {
  return availableWineFactors(context, signals)
    .filter((factor) => factor.available && factor.canJustifyComment)
    .map((factor) => factor.id);
}

function presentFactorIds(context: WineContext, signals: WineSignals): WineFactorId[] {
  const ids: WineFactorId[] = [];
  if (signals.primaryGrape) ids.push("confirmed_grape");
  if (signals.isConfirmedBlend) ids.push("confirmed_blend");
  if (signals.hasVintage) ids.push("vintage");
  if (signals.isOldVintage) ids.push("old_vintage");
  if (signals.isYoungVintage) ids.push("young_vintage");
  if (context.region) ids.push("region");
  if (context.country) ids.push("country");
  if (signals.hasProducer) ids.push("producer");
  if (signals.hasWineName) ids.push("wine_name");
  if (signals.wineColor) ids.push("wine_color");
  if (signals.hasRating) ids.push("rating");
  if (signals.isHighRating) ids.push("high_rating");
  if (typeof signals.reviewerRating === "number") ids.push("reviewer_rating");
  if (signals.hasReviewText) ids.push("review_text");
  if (signals.hasPrice) ids.push("price");
  if (signals.isGoodValue) ids.push("good_value");
  if (signals.isPremiumPrice) ids.push("premium_price");
  if (signals.grapeKnowledge) ids.push("grape_knowledge");
  if (
    signals.primaryGrapeKnowledge &&
    hasWinemakingFork(signals.primaryGrapeKnowledge.name) &&
    !signals.isRose &&
    (!signals.wineColor || signals.wineColor === "red")
  ) {
    ids.push("winemaking_fork");
  }
  if (signals.regionKnowledge) ids.push("region_knowledge");
  if (signals.pairings.length > 0 && signals.primaryGrape) ids.push("pairing_knowledge");
  return ids;
}

const WINEMAKING_FORK_GRAPES = new Set([
  "Chardonnay",
  "Riesling",
  "Pinot Noir",
  "Sauvignon Blanc",
  "Malbec",
  "Cabernet Sauvignon",
  "Nebbiolo",
  "Tempranillo",
]);

function hasWinemakingFork(grape: string): boolean {
  return WINEMAKING_FORK_GRAPES.has(grape);
}
