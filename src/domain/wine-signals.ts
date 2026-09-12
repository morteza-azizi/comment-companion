import type { WineContext } from "./wine-context";
import {
  findGrapeKnowledge,
  findRegionKnowledge,
  type DrinkStyle,
  type GrapeKnowledge,
  type RegionKnowledge,
} from "./wine-knowledge";

// Signals answer "what's actually interesting enough about THIS wine to
// comment on?", derived from WineContext (facts) plus WineKnowledge
// (general domain knowledge) — but never by inventing a new fact.
//
// The critical distinction lives in the grape fields: `primaryGrape` is
// only ever set from a CONFIRMED fact (WineContext.grapes). `associatedGrape`
// is only ever a region's typical grape, kept in a clearly separate field
// so callers can never accidentally treat "typical for the region" as if it
// were "known for this bottle".
export interface WineSignals {
  regionKnowledge?: RegionKnowledge;
  confirmedGrapes: string[];
  isConfirmedBlend: boolean;
  primaryGrape?: string;
  primaryGrapeKnowledge?: GrapeKnowledge;
  associatedGrape?: string;
  associatedGrapeKnowledge?: GrapeKnowledge;
  /** Knowledge used for character/pairing/drink-window: confirmed grape first. */
  grapeKnowledge?: GrapeKnowledge;
  drinkStyle?: DrinkStyle;
  pairings: readonly string[];
  hasProducer: boolean;
  hasVintage: boolean;
  vintageAge?: number;
  isOldVintage: boolean;
  isYoungVintage: boolean;
  hasRating: boolean;
  isHighRating: boolean;
  hasPrice: boolean;
  isGoodValue: boolean;
  isPremiumPrice: boolean;
  hasWineName: boolean;
}

const HIGH_RATING_THRESHOLD = 4.2;
const GOOD_VALUE_MAX_PRICE = 15;
const GOOD_VALUE_MIN_RATING = 4.0;
const PREMIUM_PRICE_THRESHOLD = 50;
const OLD_VINTAGE_YEARS = 10;
const YOUNG_VINTAGE_YEARS = 4;

export function deriveSignals(context: WineContext, nowYear = new Date().getFullYear()): WineSignals {
  const regionKnowledge = findRegionKnowledge(context.region);
  const confirmedGrapes = (context.grapes ?? []).filter((g): g is string => Boolean(g));
  const primaryGrape = confirmedGrapes[0];
  // Only fall back to a region's typical grape when there's no confirmed
  // grape fact at all — a known single grape must never be overridden by a
  // regional guess.
  const associatedGrape = !primaryGrape ? regionKnowledge?.typicalGrapes[0] : undefined;
  const grapeKnowledge = findGrapeKnowledge(primaryGrape) ?? findGrapeKnowledge(associatedGrape);

  const hasRating = typeof context.rating === "number";
  const hasPrice = typeof context.price === "number";
  const rating = context.rating ?? 0;
  const price = context.price ?? 0;
  const hasVintage = typeof context.vintage === "number";
  const vintageAge = hasVintage ? nowYear - (context.vintage as number) : undefined;

  return {
    regionKnowledge,
    confirmedGrapes,
    isConfirmedBlend: confirmedGrapes.length > 1,
    primaryGrape,
    primaryGrapeKnowledge: findGrapeKnowledge(primaryGrape),
    associatedGrape,
    associatedGrapeKnowledge: findGrapeKnowledge(associatedGrape),
    grapeKnowledge,
    drinkStyle: grapeKnowledge?.drinkStyle,
    pairings: grapeKnowledge?.pairings ?? [],
    hasProducer: Boolean(context.producer),
    hasVintage,
    vintageAge,
    isOldVintage: vintageAge !== undefined && vintageAge >= OLD_VINTAGE_YEARS,
    isYoungVintage: vintageAge !== undefined && vintageAge >= 0 && vintageAge <= YOUNG_VINTAGE_YEARS,
    hasRating,
    isHighRating: hasRating && rating >= HIGH_RATING_THRESHOLD,
    hasPrice,
    isGoodValue: hasPrice && hasRating && price <= GOOD_VALUE_MAX_PRICE && rating >= GOOD_VALUE_MIN_RATING,
    isPremiumPrice: hasPrice && price >= PREMIUM_PRICE_THRESHOLD,
    hasWineName: Boolean(context.wineName),
  };
}
