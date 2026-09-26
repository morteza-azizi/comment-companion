import { describe, expect, it } from "vitest";
import type { ContributionIdea } from "./contribution";
import {
  failsHundredPeopleTest,
  GENERIC_COMMENT_PATTERNS,
  isDistinctiveComment,
} from "./distinctiveness";

function idea(overrides: Partial<ContributionIdea> = {}): ContributionIdea {
  return {
    id: "test",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "Adds a missing technical distinction about retries.",
    confidence: "HIGH",
    specificity: 80,
    requiredTokens: ["idempotency", "retry budget"],
    topics: ["Resilience"],
    insight: "Retries need a budget.",
    ...overrides,
  };
}

describe("distinctiveness", () => {
  it("rejects comments that could appear under 100 unrelated posts", () => {
    const generic = [
      "Great perspective. The trade-offs here are really important.",
      "This is a great reminder that architecture is all about balancing trade-offs.",
      "I'd add that communication is just as important as technology.",
      "This highlights an important point.",
      "In my experience, this is the key takeaway.",
    ];

    for (const comment of generic) {
      expect(failsHundredPeopleTest(comment, idea())).toBe(true);
      expect(isDistinctiveComment(comment, idea())).toBe(false);
    }
  });

  it("accepts a comment that carries a concrete, post-specific idea", () => {
    const comment =
      "Retries can hide a transient blip. Without an idempotency key, a budget, and backoff, the same policy that helps one caller can amplify load into an outage.";
    expect(isDistinctiveComment(comment, idea())).toBe(true);
  });

  it("rejects a fluent comment that names no specific token from the idea", () => {
    const comment = "This architecture choice deserves a closer look at the surrounding constraints.";
    expect(GENERIC_COMMENT_PATTERNS.some((pattern) => pattern.test(comment))).toBe(false);
    expect(isDistinctiveComment(comment, idea())).toBe(false);
  });
});
