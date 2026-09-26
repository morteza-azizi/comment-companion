import { describe, expect, it } from "vitest";
import type { ContributionIdea } from "./contribution";
import { DEFAULT_USER_PROFILE } from "./user-profile";
import { assessUsefulness } from "./usefulness-gate";

function idea(overrides: Partial<ContributionIdea> = {}): ContributionIdea {
  return {
    id: "nuance:retries-need-budget",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "Retries without a budget are an incomplete reliability story.",
    confidence: "HIGH",
    specificity: 82,
    requiredTokens: ["idempotency", "backoff"],
    topics: ["Resilience"],
    insight: "Retries need a budget.",
    ...overrides,
  };
}

describe("assessUsefulness", () => {
  it("passes a specific insight inside the user's expertise", () => {
    expect(assessUsefulness(idea(), DEFAULT_USER_PROFILE).passed).toBe(true);
  });

  it("fails SHARE_EVIDENCE when no evidence exists", () => {
    const assessment = assessUsefulness(
      idea({
        mode: "SHARE_EVIDENCE",
        reason: "evidence",
        evidenceSummary: "We measured something.",
      }),
      DEFAULT_USER_PROFILE
    );
    expect(assessment.passed).toBe(false);
  });

  it("fails an empty agreement-shaped idea", () => {
    const assessment = assessUsefulness(
      idea({
        insight: undefined,
        requiredTokens: [],
        specificity: 10,
        reason: "missing_nuance",
      }),
      DEFAULT_USER_PROFILE
    );
    expect(assessment.passed).toBe(false);
  });
});
