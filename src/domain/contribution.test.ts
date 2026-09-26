import { describe, expect, it } from "vitest";
import { commentOpportunity, formatOpportunity, skipOpportunity, type ContributionIdea } from "./contribution";

const idea: ContributionIdea = {
  id: "distinction:reliability-vs-durability",
  mode: "TECHNICAL_DISTINCTION",
  reason: "missing_distinction",
  why: "The post treats retries as a reliability mechanism, but does not distinguish retry policy from recovery strategy.",
  confidence: "HIGH",
  specificity: 90,
  requiredTokens: ["retry", "durability"],
  topics: ["Resilience"],
};

describe("formatOpportunity", () => {
  it("renders a COMMENT opportunity with visible reasoning and no extra drafts", () => {
    const formatted = formatOpportunity(
      commentOpportunity(idea, "Retries improve the chance a request succeeds. Durability is whether the write survives a crash.")
    );
    expect(formatted).toContain("CONTRIBUTION OPPORTUNITY");
    expect(formatted).toContain("Mode:\nTECHNICAL_DISTINCTION");
    expect(formatted).toContain("Novelty:\nNEW");
    expect(formatted).toContain("Verdict:\nCOMMENT");
    expect(formatted).toContain("Why:\nThe post treats retries");
    expect(formatted).toContain("Contribution:\nRetries improve");
    expect(formatted).toContain("Confidence:\nHIGH");
  });

  it("renders SKIP without a contribution block", () => {
    const formatted = formatOpportunity(
      skipOpportunity("The post is interesting, but the available contribution would only repeat the author's point.")
    );
    expect(formatted).toContain("Verdict:\nSKIP");
    expect(formatted).not.toContain("Contribution:");
    expect(formatted).not.toContain("Mode:");
  });
});
