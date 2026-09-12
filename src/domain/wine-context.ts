// The set of FACTS we actually know about one specific wine/bottle, as
// extracted directly from the Vivino page. Nothing in here should ever be
// guessed or inferred — if the page doesn't expose a field, it stays
// undefined rather than being filled in with a plausible-sounding guess.
//
// This is deliberately kept separate from WineKnowledge (general domain
// knowledge about a region/grape/style), so the rest of the pipeline can
// never accidentally treat "usually true of wines like this" as if it were
// "true of this exact bottle".
export interface WineContext {
  wineName?: string;
  producer?: string;
  country?: string;
  region?: string;
  appellation?: string;
  /** Actual known grape(s) for this bottle. Never populated from a region guess. */
  grapes?: string[];
  vintage?: number;
  style?: string;
  rating?: number;
  ratingCount?: number;
  price?: number;
  currency?: string;
}
