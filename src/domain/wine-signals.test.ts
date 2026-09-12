import { describe, expect, it } from "vitest";
import { deriveSignals } from "./wine-signals";
import type { WineContext } from "./wine-context";

describe("deriveSignals", () => {
  it("treats an empty context as having no signals beyond the defaults", () => {
    const signals = deriveSignals({});
    expect(signals.regionKnowledge).toBeUndefined();
    expect(signals.primaryGrape).toBeUndefined();
    expect(signals.associatedGrape).toBeUndefined();
    expect(signals.isConfirmedBlend).toBe(false);
    expect(signals.hasProducer).toBe(false);
    expect(signals.hasVintage).toBe(false);
    expect(signals.hasRating).toBe(false);
    expect(signals.hasPrice).toBe(false);
    expect(signals.isGoodValue).toBe(false);
    expect(signals.isPremiumPrice).toBe(false);
  });

  it("only derives an associated grape from region knowledge when no grape is confirmed", () => {
    const signals = deriveSignals({ region: "Mosel" });
    expect(signals.regionKnowledge?.name).toBe("Mosel");
    expect(signals.primaryGrape).toBeUndefined();
    expect(signals.associatedGrape).toBe("Riesling");
  });

  it("never lets a region guess override a confirmed grape fact", () => {
    const context: WineContext = { region: "Bordeaux", grapes: ["Pinot Noir"] };
    const signals = deriveSignals(context);
    expect(signals.primaryGrape).toBe("Pinot Noir");
    // Bordeaux's typical grapes are Cabernet/Merlot, not Pinot Noir — the
    // confirmed fact must win, and no fallback grape should be derived.
    expect(signals.associatedGrape).toBeUndefined();
  });

  it("flags a confirmed blend only when 2+ grapes are actually known", () => {
    const single = deriveSignals({ grapes: ["Merlot"] });
    const blend = deriveSignals({ grapes: ["Cabernet Sauvignon", "Merlot"] });
    expect(single.isConfirmedBlend).toBe(false);
    expect(blend.isConfirmedBlend).toBe(true);
  });

  it("does not resolve an unknown region to any knowledge", () => {
    const signals = deriveSignals({ region: "Nowhereland" });
    expect(signals.regionKnowledge).toBeUndefined();
    expect(signals.associatedGrape).toBeUndefined();
  });

  it("requires both price and rating for value signals", () => {
    const priceOnly = deriveSignals({ price: 10 });
    const ratingOnly = deriveSignals({ rating: 4.5 });
    const both = deriveSignals({ price: 12, rating: 4.5 });

    expect(priceOnly.isGoodValue).toBe(false);
    expect(ratingOnly.isGoodValue).toBe(false);
    expect(both.isGoodValue).toBe(true);
  });

  it("flags a premium price independent of rating", () => {
    const signals = deriveSignals({ price: 80 });
    expect(signals.isPremiumPrice).toBe(true);
    expect(signals.isGoodValue).toBe(false);
  });

  it("flags a high rating only above the threshold", () => {
    expect(deriveSignals({ rating: 3.5 }).isHighRating).toBe(false);
    expect(deriveSignals({ rating: 4.5 }).isHighRating).toBe(true);
  });

  it("treats a 10+ year old bottle as an old vintage", () => {
    expect(deriveSignals({ vintage: 2016 }, 2026).isOldVintage).toBe(true);
    expect(deriveSignals({ vintage: 2024 }, 2026).isOldVintage).toBe(false);
    expect(deriveSignals({ vintage: 2024 }, 2026).isYoungVintage).toBe(true);
  });

  it("exposes pairings from grape knowledge", () => {
    expect(deriveSignals({ grapes: ["Malbec"] }).pairings).toContain("a good steak");
    expect(deriveSignals({}).pairings).toEqual([]);
  });
});
