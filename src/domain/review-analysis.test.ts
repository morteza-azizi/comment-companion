import { describe, expect, it } from "vitest";
import { analyzeReview, findObservations } from "./review-analysis";

const phrases = (text: string): string[] => findObservations(text).map((item) => item.phrase.toLowerCase());

describe("findObservations", () => {
  it("quotes the reviewer's own words", () => {
    expect(phrases("Grippy tannins and a long finish.")).toEqual(["grippy tannins", "long finish"]);
  });

  it("merges neighbouring descriptors of the same theme", () => {
    expect(phrases("Fresh and crisp.")).toEqual(["fresh and crisp"]);
  });

  it("applies negation and keeps it in the phrase", () => {
    const [sweet] = findObservations("Not very sweet at all.");
    expect(sweet?.phrase).toBe("Not very sweet");
    expect(sweet?.theme).toBe("sweetness");
    expect(sweet?.direction).toBe("low");
  });

  it("does not match inside other words", () => {
    expect(phrases("Around the corner, a darkened room.")).toEqual([]);
  });

  it("prefers the longest term (bone dry beats dry)", () => {
    expect(phrases("Bone dry and austere.")).toEqual(["bone dry and austere"]);
  });

  it("only hedges a descriptor the hedge sits next to", () => {
    const hedged = findObservations("Maybe a bit oaky. Tannic.").map((item) => [item.phrase, item.hedged]);
    expect(hedged).toEqual([
      ["oaky", true],
      ["Tannic", false],
    ]);
  });

  it("treats 'a bit too much' as excess rather than uncertainty", () => {
    const [oak] = findObservations("Vanilla and toasty oak, a bit too much.");
    expect(oak?.hedged).toBe(false);
  });
});

describe("analyzeReview", () => {
  it("separates facts, interpretations and unknowns", () => {
    const analysis = analyzeReview(
      { text: "Very acidic but fruity. Decanted for an hour.", rating: 3 },
      { rating: 4.2, vintage: 2019 },
    );
    expect(analysis.facts.join("\n")).toContain("“acidic”");
    expect(analysis.facts.some((fact) => fact.startsWith("Mentions"))).toBe(true);
    expect(analysis.interpretations.join("\n")).toMatch(/Mixed signals/);
    expect(analysis.interpretations.join("\n")).toMatch(/below the community average/);
    expect(analysis.unknowns).toContain("What they ate or drank it with");
    // Serving was mentioned, so it must not be listed as unknown.
    expect(analysis.unknowns.join("\n")).not.toMatch(/served/);
  });

  it("detects a contrast", () => {
    const analysis = analyzeReview({ text: "Light in colour but surprisingly tannic." });
    expect(analysis.contrasts).toHaveLength(1);
    expect(analysis.contrasts[0]?.first.theme).toBe("body");
    expect(analysis.contrasts[0]?.second.theme).toBe("tannin");
  });

  it("does not call it a contrast when the reviewer resolves the tension", () => {
    const analysis = analyzeReview({ text: "Acidic but the cherry fruit balances it." });
    expect(analysis.contrasts).toHaveLength(0);
  });

  it("recognises shared knowledge, comparisons and value", () => {
    const analysis = analyzeReview({
      text: "Too young, needs more time. Reminds me of a Barolo. Great value for the price.",
    });
    expect(analysis.insights.map((item) => item.kind).sort()).toEqual(["aging", "value"]);
    expect(analysis.comparisons[0]?.phrase).toMatch(/^Reminds me of a Barolo/);
  });

  it("flags generic praise", () => {
    for (const text of ["Great wine!", "Love it", "Nice", "Really good, will buy again."]) {
      expect(analyzeReview({ text }).isGeneric, text).toBe(true);
    }
  });

  it("does not flag a specific note as generic", () => {
    expect(analyzeReview({ text: "Cherry and leather, grippy." }).isGeneric).toBe(false);
  });

  it("separates 'long but unreadable' from 'generic'", () => {
    const analysis = analyzeReview({ text: "Smelled like a damp basement in the mountains after the rainstorm yesterday morning." });
    expect(analysis.isGeneric).toBe(false);
    expect(analysis.hasUnrecognizedDetail).toBe(true);
  });

  it("notices a truncated review", () => {
    expect(analyzeReview({ text: "Quite a lot going on in the glass, starts with…" }).truncated).toBe(true);
    expect(analyzeReview({ text: "Short but complete." }).truncated).toBe(false);
  });

  it("copes with no text at all", () => {
    const analysis = analyzeReview({});
    expect(analysis.observations).toEqual([]);
    expect(analysis.unknowns).toEqual(["There is no review text to read"]);
  });
});
