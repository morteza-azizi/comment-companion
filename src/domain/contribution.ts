export type ContributionMode =
  | "ADD_ONE_INSIGHT"
  | "CHALLENGE_ASSUMPTION"
  | "TECHNICAL_DISTINCTION"
  | "SHARE_EVIDENCE"
  | "ASK_BETTER_QUESTION"
  | "OPEN_DISCUSSION"
  | "CORRECT_CAREFULLY"
  | "BRIDGE_TO_ENGINEERING";

import type { Novelty } from "./angle-fingerprint";

export type { Novelty };

export type ContributionVerdict = "COMMENT" | "SKIP";

export type ContributionConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ContributionReason =
  | "missing_distinction"
  | "evidence"
  | "challenge_assumption"
  | "identify_tradeoff"
  | "useful_question"
  | "connect_concepts"
  | "practical_consequence"
  | "missing_nuance"
  | "open_angle";

export const CONTRIBUTION_MODES: readonly ContributionMode[] = [
  "ADD_ONE_INSIGHT",
  "CHALLENGE_ASSUMPTION",
  "TECHNICAL_DISTINCTION",
  "SHARE_EVIDENCE",
  "ASK_BETTER_QUESTION",
  "OPEN_DISCUSSION",
  "CORRECT_CAREFULLY",
  "BRIDGE_TO_ENGINEERING",
];

export const MODE_PRIORITY: Record<ContributionMode, number> = {
  CORRECT_CAREFULLY: 0,
  CHALLENGE_ASSUMPTION: 1,
  TECHNICAL_DISTINCTION: 2,
  SHARE_EVIDENCE: 3,
  BRIDGE_TO_ENGINEERING: 4,
  ADD_ONE_INSIGHT: 5,
  ASK_BETTER_QUESTION: 6,
  OPEN_DISCUSSION: 7,
};

export interface ContributionIdea {
  id: string;
  mode: ContributionMode;
  reason: ContributionReason;
  why: string;
  confidence: ContributionConfidence;
  specificity: number;
  requiredTokens: readonly string[];
  topics: readonly string[];
  angle?: string;
  concepts?: readonly string[];
  angleFingerprint?: string;
  observation?: string;
  insight?: string;
  implication?: string;
  usefulPart?: string;
  assumption?: string;
  whyAssumptionFails?: string;
  betterFraming?: string;
  conceptA?: string;
  conceptB?: string;
  distinction?: string;
  claim?: string;
  evidenceSummary?: string;
  evidenceSuggests?: string;
  question?: string;
  discussionAngle?: string;
  correction?: string;
  consequence?: string;
  engineeringBridge?: string;
  workReference?: string;
}

export interface ContributionOpportunity {
  mode?: ContributionMode;
  verdict: ContributionVerdict;
  why: string;
  contribution?: string;
  confidence?: ContributionConfidence;
  ideaId?: string;
  angle?: string;
  angleFingerprint?: string;
  concepts?: readonly string[];
  novelty?: Novelty;
}

export function skipOpportunity(why: string): ContributionOpportunity {
  return { verdict: "SKIP", why };
}

export function commentOpportunity(
  idea: ContributionIdea,
  contribution: string,
  novelty: Novelty = "NEW"
): ContributionOpportunity {
  return {
    mode: idea.mode,
    verdict: "COMMENT",
    why: idea.why,
    contribution,
    confidence: idea.confidence,
    ideaId: idea.id,
    angle: idea.angle,
    angleFingerprint: idea.angleFingerprint,
    concepts: idea.concepts,
    novelty,
  };
}

export function formatOpportunity(opportunity: ContributionOpportunity): string {
  const lines = ["CONTRIBUTION OPPORTUNITY", ""];
  if (opportunity.mode) {
    lines.push("Mode:", opportunity.mode, "");
  }
  if (opportunity.angle) {
    lines.push("Angle:", opportunity.angle, "");
  }
  if (opportunity.novelty) {
    lines.push("Novelty:", opportunity.novelty, "");
  }
  lines.push("Verdict:", opportunity.verdict, "");
  lines.push("Why:", opportunity.why);
  if (opportunity.verdict === "COMMENT" && opportunity.contribution) {
    lines.push("", "Contribution:", opportunity.contribution);
  }
  if (opportunity.confidence) {
    lines.push("", "Confidence:", opportunity.confidence);
  }
  return lines.join("\n");
}
