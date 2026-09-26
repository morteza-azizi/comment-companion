import { describe, expect, it } from "vitest";
import { commentWorthyFactorIds, WINE_FACTOR_CATALOG, availableWineFactors } from "./wine-factors";

describe("wine factor catalog", () => {
  it("lists page facts, derived signals, and knowledge as separate kinds", () => {
    const kinds = new Set(WINE_FACTOR_CATALOG.map((factor) => factor.kind));
    expect(kinds).toEqual(new Set(["fact", "derived", "knowledge"]));
    expect(WINE_FACTOR_CATALOG.map((factor) => factor.id)).toContain("confirmed_blend");
    expect(WINE_FACTOR_CATALOG.map((factor) => factor.id)).toContain("high_rating");
    expect(WINE_FACTOR_CATALOG.map((factor) => factor.id)).toContain("winemaking_fork");
  });

  it("does not treat producer, country, or wine name as enough to comment", () => {
    const lonely = ["producer", "country", "wine_name"] as const;
    for (const id of lonely) {
      expect(WINE_FACTOR_CATALOG.find((factor) => factor.id === id)?.canJustifyComment).toBe(false);
    }
    expect(commentWorthyFactorIds({ producer: "Some Winery", country: "Ukraine", wineName: "Le Caprice" })).toEqual(
      []
    );
  });

  it("marks Müller-Thurgau as a grape-knowledge opportunity", () => {
    const factors = availableWineFactors({ grapes: ["Müller-Thurgau"], vintage: 2024 });
    expect(factors.find((factor) => factor.id === "grape_knowledge")?.available).toBe(true);
    expect(commentWorthyFactorIds({ grapes: ["Müller-Thurgau"], vintage: 2024 })).toContain("grape_knowledge");
  });

  it("treats a confirmed blend and a high rating as comment-worthy facts", () => {
    expect(commentWorthyFactorIds({ grapes: ["Cabernet Sauvignon", "Merlot"] })).toContain("confirmed_blend");
    expect(commentWorthyFactorIds({ rating: 4.5 })).toContain("high_rating");
  });

  it("treats the reviewer's own score and note as comment-worthy", () => {
    expect(commentWorthyFactorIds({ reviewerRating: 3.2 })).toContain("reviewer_rating");
    expect(commentWorthyFactorIds({ reviewText: "Light and fresh, perfect for summer." })).toContain(
      "review_text"
    );
  });
});
