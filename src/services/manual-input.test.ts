import { describe, expect, it } from "vitest";
import { MAX_REVIEW_CHARS, parseManualInput } from "./manual-input";
import { suggest } from "./conversation-companion";

describe("parseManualInput (manual fallback)", () => {
  it("builds a usable input from just a pasted review", () => {
    const result = parseManualInput({ reviewText: "  Grippy tannins,\n long finish.  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.review.text).toBe("Grippy tannins, long finish.");
    expect(result.input.wine).toEqual({
      wineName: undefined,
      producer: undefined,
      vintage: undefined,
      region: undefined,
      country: undefined,
      rating: undefined,
    });
    expect(suggest(result.input).comment).toContain("Grippy tannins");
  });

  it("reads all supported fields and locale decimal commas", () => {
    const result = parseManualInput(
      {
        wineName: "Cosecha",
        producer: "Pagos",
        vintage: "2019",
        region: "Ribera del Duero",
        country: "Spain",
        rating: "3,9",
        reviewer: "Anna",
        reviewText: "Tannic.",
        reviewRating: 4,
        myNote: "I found it tannic too.",
      },
      2026,
    );
    expect(result).toMatchObject({
      ok: true,
      input: {
        wine: { wineName: "Cosecha", producer: "Pagos", vintage: 2019, region: "Ribera del Duero", country: "Spain", rating: 3.9 },
        review: { text: "Tannic.", rating: 4, reviewer: "Anna" },
        myNote: "I found it tannic too.",
      },
      warnings: [],
    });
  });

  it("drops invalid values with a warning instead of guessing", () => {
    const result = parseManualInput(
      { reviewText: "Tannic.", vintage: "last year", rating: "9", reviewRating: "abc" },
      2026,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.wine.vintage).toBeUndefined();
    expect(result.input.wine.rating).toBeUndefined();
    expect(result.input.review.rating).toBeUndefined();
    expect(result.warnings).toHaveLength(3);
  });

  it("treats NV and a 0.0 rating as 'not available', not as an error", () => {
    const result = parseManualInput({ reviewText: "Tannic.", vintage: "NV", rating: "0.0" });
    expect(result).toMatchObject({ ok: true, warnings: [] });
  });

  it("rejects out-of-range vintages", () => {
    const result = parseManualInput({ reviewText: "Tannic.", vintage: "1066" }, 2026);
    expect(result.ok && result.warnings.length).toBe(1);
  });

  it("strips markup and control characters from pasted text", () => {
    const result = parseManualInput({ reviewText: "<b>Grippy</b> tannins\u0000\u0007 here" });
    expect(result.ok && result.input.review.text).toBe("Grippy tannins here");
  });

  it("truncates a huge paste and says so", () => {
    const result = parseManualInput({ reviewText: "word ".repeat(2000) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.review.text?.length).toBeLessThanOrEqual(MAX_REVIEW_CHARS);
    expect(result.warnings[0]).toMatch(/only the start was used/);
  });

  it.each([[undefined], [null], ["a string"], [42], [[]], [{}], [{ reviewText: "   " }], [{ reviewText: 12 }]])(
    "fails clearly on malformed or empty input: %j",
    (fields) => {
      const result = parseManualInput(fields);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Nothing to analyze/);
    },
  );

  it("lets a wine with no review through, so the workspace can ask for more context", () => {
    const result = parseManualInput({ wineName: "Cosecha" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(suggest(result.input).recommendation).toBe("REQUEST_MORE_CONTEXT");
  });
});
