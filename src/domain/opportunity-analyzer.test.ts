import { describe, expect, it } from "vitest";
import { ContributionHistory } from "./contribution-history";
import { analyzeOpportunity } from "./opportunity-analyzer";
import { DEFAULT_USER_PROFILE } from "./user-profile";

describe("analyzeOpportunity", () => {
  it("selects a contribution mode before any comment is drafted", () => {
    const analysis = analyzeOpportunity(
      {
        text: "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine.",
        source: "test",
      },
      DEFAULT_USER_PROFILE,
      new ContributionHistory()
    );

    expect(analysis.kind).toBe("candidates");
    if (analysis.kind !== "candidates") return;
    expect(analysis.ideas[0]?.mode).toBe("ADD_ONE_INSIGHT");
    expect(analysis.ideas[0]?.angle).toBe("retry amplification");
    expect(analysis.ideas[0]).not.toHaveProperty("contribution");
  });

  it("prefers a novel angle over a recently used higher-priority sibling", () => {
    const history = new ContributionHistory();
    history.record({
      mode: "ADD_ONE_INSIGHT",
      ideaId: "nuance:retries-need-budget",
      angleFingerprint: "retry-amplification",
      concepts: ["retry-amplification", "retry-budget", "backoff"],
      angle: "retry amplification",
      at: Date.now(),
    });

    const analysis = analyzeOpportunity(
      {
        text: "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine.",
        source: "test",
      },
      DEFAULT_USER_PROFILE,
      history
    );

    expect(analysis.kind).toBe("candidates");
    if (analysis.kind !== "candidates") return;
    expect(analysis.ideas[0]?.angle).toBe("idempotency");
    expect(analysis.ideas.some((idea) => idea.angle === "retry amplification")).toBe(true);
  });

  it("SKIPs before drafting when the post is generic inspiration", () => {
    const analysis = analyzeOpportunity(
      {
        text: "Leadership is about inspiring others. Grateful for my amazing team. Monday motivation!",
        source: "test",
      },
      DEFAULT_USER_PROFILE,
      new ContributionHistory()
    );

    expect(analysis).toEqual({
      kind: "skip",
      why: expect.stringContaining("repeat"),
    });
  });
});
