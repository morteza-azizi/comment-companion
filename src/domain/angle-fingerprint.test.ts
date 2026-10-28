import { describe, expect, it } from "vitest";
import {
  assessRepetition,
  fingerprintIdea,
  isSameIdea,
  isSameWording,
  recentUses,
  sharesTopic,
  skeletonOf,
  type PastUse,
} from "./angle-fingerprint";

const DAY = 86_400_000;
const NOW = 1_000_000_000_000;

const askTannin = { type: "ASK_SPECIFIC_QUESTION", dimension: "tasting", concepts: ["tannin"] };

describe("fingerprints and ideas", () => {
  it("builds a stable fingerprint regardless of concept order", () => {
    expect(fingerprintIdea({ type: "A", dimension: "tasting", concepts: ["fruit", "acidity"] })).toBe(
      fingerprintIdea({ type: "A", dimension: "tasting", concepts: ["acidity", "fruit"] }),
    );
  });

  it("treats the same move on the same concept as the same idea", () => {
    expect(isSameIdea(askTannin, { ...askTannin, concepts: ["Tannin"] })).toBe(true);
  });

  it("does not treat a different concept as the same idea", () => {
    expect(isSameIdea(askTannin, { ...askTannin, concepts: ["finish"] })).toBe(false);
  });

  it("does not treat a different move on the same concept as the same idea", () => {
    expect(isSameIdea(askTannin, { ...askTannin, type: "COMPARE_PERSPECTIVES" })).toBe(false);
    expect(sharesTopic(askTannin, { ...askTannin, type: "COMPARE_PERSPECTIVES" })).toBe(true);
  });

  it("does not treat different dimensions as the same topic", () => {
    expect(sharesTopic(askTannin, { type: "ASK_SPECIFIC_QUESTION", dimension: "food", concepts: ["tannin"] })).toBe(false);
    expect(sharesTopic(askTannin, { type: "X", dimension: "food", concepts: ["food"] })).toBe(false);
  });
});

describe("wording", () => {
  it("compares sentence skeletons, not the wine-specific quotes", () => {
    const a = "Did “grippy tannins” change as the glass sat, or stay the same?";
    const b = "Did “firm structure” change as the glass sat, or stay the same?";
    expect(skeletonOf(a)).toBe(skeletonOf(b));
    expect(isSameWording(a, b)).toBe(true);
  });

  it("tells genuinely different sentences apart", () => {
    expect(
      isSameWording(
        "Did “grippy tannins” change as the glass sat, or stay the same?",
        "You say “reminds me of a Rioja”. What was it that made you think of that?",
      ),
    ).toBe(false);
  });
});

describe("assessRepetition", () => {
  const use = (overrides: Partial<PastUse> = {}): PastUse => ({ ...askTannin, comment: "x y z", at: NOW - DAY, ...overrides });

  it("is NEW with no history", () => {
    expect(assessRepetition(askTannin, "anything here", [], NOW).kind).toBe("NEW");
  });

  it("distinguishes same wording, same idea, and same topic from a new angle", () => {
    const same = "Did “grippy tannins” change as the glass sat, or stay the same?";
    expect(assessRepetition(askTannin, same, [use({ comment: same })], NOW).kind).toBe("SAME_WORDING");
    expect(assessRepetition(askTannin, "A different sentence entirely about structure.", [use()], NOW).kind).toBe("SAME_IDEA");
    expect(
      assessRepetition({ ...askTannin, type: "EXPLORE_DIFFERENCE" }, "A different sentence entirely.", [use()], NOW).kind,
    ).toBe("SAME_TOPIC_NEW_ANGLE");
    expect(assessRepetition({ type: "X", dimension: "food", concepts: ["food"] }, "Another.", [use()], NOW).kind).toBe("NEW");
  });

  it("only looks at the last few uses within two weeks", () => {
    const old = use({ at: NOW - 30 * DAY });
    expect(recentUses([old], NOW)).toEqual([]);
    const many = Array.from({ length: 8 }, (_, index) => use({ at: NOW - index * 1000, comment: `c${index}` }));
    expect(recentUses(many, NOW)).toHaveLength(5);
    expect(assessRepetition(askTannin, undefined, [old], NOW).kind).toBe("NEW");
  });
});
