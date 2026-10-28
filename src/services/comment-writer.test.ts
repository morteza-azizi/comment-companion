import { describe, expect, it } from "vitest";
import { decideOpportunity } from "../domain/opportunity";
import { analyzeReview, findObservations } from "../domain/review-analysis";
import type { ConversationInput } from "../domain/wine-context";
import { writeVariants } from "./comment-writer";

const REVIEW =
  "Acidic but balanced, grippy tannins, long finish, vanilla oak, cherry. Maybe a bit floral? Too young, needs more time. Decanted an hour. Reminds me of a Barolo. Great value for the price, with grilled lamb. Skin contact, not my style. Dry. Light in colour but surprisingly tannic.";

function everything(input: ConversationInput) {
  const analysis = analyzeReview(input.review, input.wine);
  return decideOpportunity(input, analysis).candidates;
}

describe("writeVariants", () => {
  const input: ConversationInput = {
    wine: { wineName: "Cosecha", vintage: 2019, rating: 4.4 },
    review: { text: REVIEW, rating: 3 },
    myNote: "I found the tannins soft.",
  };

  it("covers every kind of focus with at least two wordings", () => {
    const candidates = everything(input);
    const kinds = new Set(candidates.map((candidate) => candidate.focus.kind));
    expect(kinds).toEqual(new Set(["contrast", "hedge", "balance", "single", "insight", "comparison", "rating-gap", "my-note"]));
    for (const candidate of candidates) {
      expect(writeVariants(candidate, input).length, candidate.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("never uses tasting vocabulary of its own: sentence frames contain no descriptors", () => {
    for (const candidate of everything(input)) {
      for (const variant of writeVariants(candidate, input)) {
        const frame = variant.replace(/[“"][^”"]*[”"]/g, " ").replace(input.myNote ?? "", " ");
        expect(findObservations(frame).map((item) => item.phrase), variant).toEqual([]);
      }
    }
  });

  it("starts at a different wording for different reviews but is stable for one review", () => {
    const base = everything(input).find((candidate) => candidate.focus.kind === "single");
    expect(base).toBeDefined();
    const first = writeVariants(base!, input);
    expect(writeVariants(base!, input)).toEqual(first);
    const heads = new Set<string>();
    for (const text of ["Grippy tannins here.", "Grippy tannins there.", "Grippy tannins again.", "Grippy tannins always.", "Grippy tannins now."]) {
      const other: ConversationInput = { wine: {}, review: { text } };
      const candidate = everything(other).find((item) => item.focus.kind === "single")!;
      heads.add(writeVariants(candidate, other)[0] as string);
    }
    expect(heads.size).toBeGreaterThan(1);
  });

  it("mentions the vintage only when it was provided", () => {
    const aging = (wine: ConversationInput["wine"]) => {
      const data: ConversationInput = { wine, review: { text: "Too young, needs more time." } };
      const candidate = everything(data).find((item) => item.focus.kind === "insight")!;
      return writeVariants(candidate, data).join(" ");
    };
    expect(aging({ vintage: 2019 })).toContain("2019");
    expect(aging({})).not.toMatch(/\b(?:19|20)\d{2}\b/);
  });

  it("returns nothing for a my-note focus without a note", () => {
    const candidates = everything(input);
    const mine = candidates.find((candidate) => candidate.focus.kind === "my-note")!;
    expect(writeVariants(mine, { ...input, myNote: undefined })).toEqual([]);
  });
});
