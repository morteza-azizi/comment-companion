import { describe, expect, it } from "vitest";
import { parseReview, reviewerBand } from "./wine-review";

describe("reviewerBand", () => {
  it("bands scores the way a person would talk about them", () => {
    expect(reviewerBand(4.6)).toBe("loved");
    expect(reviewerBand(4.0)).toBe("liked");
    expect(reviewerBand(3.4)).toBe("mixed");
    expect(reviewerBand(2.8)).toBe("low");
  });
});

describe("parseReview", () => {
  it("pulls themes out of a short tasting note", () => {
    const parsed = parseReview("Light and fresh, a bit of strawberry.", 4.0);
    expect(parsed.band).toBe("liked");
    expect(parsed.themes).toEqual(expect.arrayContaining(["light", "acid", "fruit"]));
    expect(parsed.snippet).toMatch(/light and fresh/i);
  });

  it("ignores notes that are too short to use", () => {
    expect(parseReview("Nice", 4.5).snippet).toBeUndefined();
  });
});
