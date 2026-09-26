import { attachAngle, ideaAngleInput } from "./angle-fingerprint";
import type { ContributionIdea } from "./contribution";
import { MODE_PRIORITY } from "./contribution";
import type { ContributionHistory } from "./contribution-history";
import type { ConversationPost } from "./conversation-post";
import { postText } from "./conversation-post";
import {
  detectTopicAreas,
  hasTechnicalSubstance,
  isGenericInspirationalPost,
  isPureAgreementPost,
  matchKnowledge,
  type KnowledgeMatch,
} from "./engineering-knowledge";
import { hasAnyMarker, uniqueOverlap } from "./text-match";
import type { UserEvidence, UserProfile } from "./user-profile";
import { assessUsefulness } from "./usefulness-gate";

export type AnalysisDecision =
  | { kind: "skip"; why: string }
  | { kind: "candidates"; ideas: ContributionIdea[] };

const OUTSIDE_EXPERTISE_WHY =
  "The topic is outside the user's useful expertise, so any comment would be generic or unearned.";

const GENERIC_WHY =
  "The post is interesting, but the available contribution would only repeat the author's point.";

const NOTHING_NEW_WHY =
  "The post is reasonable, but there is no distinctive technical insight or evidence available to add.";

export function analyzeOpportunity(
  post: ConversationPost,
  profile: UserProfile,
  history: ContributionHistory
): AnalysisDecision {
  const text = postText(post);
  if (!text) {
    return { kind: "skip", why: NOTHING_NEW_WHY };
  }

  if (isGenericInspirationalPost(text) || isPureAgreementPost(text) || !hasTechnicalSubstance(text)) {
    return { kind: "skip", why: GENERIC_WHY };
  }

  const topics = detectTopicAreas(text);
  const expertiseOverlap = uniqueOverlap(topics, profile.expertise);
  const knowledgeHits = matchKnowledge(text);

  if (topics.length > 0 && expertiseOverlap.length === 0 && knowledgeHits.length === 0) {
    return { kind: "skip", why: OUTSIDE_EXPERTISE_WHY };
  }

  const ideas = [
    ...knowledgeHits.map(ideaFromMatch),
    ...evidenceIdeas(text, topics, profile),
  ];

  const useful = ideas.filter((idea) => assessUsefulness(idea, profile).passed);
  if (useful.length === 0) {
    return { kind: "skip", why: NOTHING_NEW_WHY };
  }

  useful.sort((a, b) => compareIdeas(a, b, history));
  return { kind: "candidates", ideas: useful };
}

function compareIdeas(a: ContributionIdea, b: ContributionIdea, history: ContributionHistory): number {
  return ideaRank(b, history) - ideaRank(a, history);
}

function ideaRank(idea: ContributionIdea, history: ContributionHistory): number {
  const modeBonus = (10 - MODE_PRIORITY[idea.mode]) * 10;
  const evidenceBonus =
    idea.mode === "SHARE_EVIDENCE" || idea.mode === "BRIDGE_TO_ENGINEERING" ? 8 : 0;
  const modePenalty = history.modeShare(idea.mode) > 0.35 ? 20 : 0;
  const noveltyPenalty = history.anglePenalty(ideaAngleInput(idea));
  return modeBonus + idea.specificity + evidenceBonus - modePenalty - noveltyPenalty;
}

function ideaFromMatch(match: KnowledgeMatch): ContributionIdea {
  return attachAngle({
    id: match.id,
    mode: match.mode,
    reason: match.reason,
    why: match.why,
    confidence: match.specificity >= 85 ? "HIGH" : match.specificity >= 72 ? "MEDIUM" : "LOW",
    specificity: match.specificity,
    requiredTokens: match.requiredTokens,
    topics: match.topics,
    angle: match.angle,
    concepts: match.concepts,
    observation: match.observation,
    insight: match.insight,
    implication: match.implication,
    usefulPart: match.usefulPart,
    assumption: match.assumption,
    whyAssumptionFails: match.whyAssumptionFails,
    betterFraming: match.betterFraming,
    conceptA: match.conceptA,
    conceptB: match.conceptB,
    distinction: match.distinction,
    claim: match.claim,
    question: match.question,
    discussionAngle: match.discussionAngle,
    correction: match.correction,
    consequence: match.consequence,
    engineeringBridge: match.engineeringBridge,
  });
}

function evidenceIdeas(text: string, topics: string[], profile: UserProfile): ContributionIdea[] {
  const ideas: ContributionIdea[] = [];
  for (const evidence of profile.evidence) {
    if (!evidenceFitsPost(text, topics, evidence)) continue;

    if (evidence.kind === "experiment" || evidence.kind === "measurement" || evidence.kind === "repository") {
      ideas.push(shareEvidenceIdea(text, evidence));
    }
    if (evidence.kind === "project" || evidence.kind === "article") {
      ideas.push(...bridgeIdeas(text, evidence));
    }
  }
  return ideas;
}

function evidenceFitsPost(text: string, topics: string[], evidence: UserEvidence): boolean {
  if (uniqueOverlap(evidence.topics, topics).length > 0) return true;
  return evidence.topics.some((topic) => hasAnyMarker(text, [topic]));
}

function shareEvidenceIdea(text: string, evidence: UserEvidence): ContributionIdea {
  const claim = evidenceClaim(text);
  const poison = hasAnyMarker(text, ["dead-letter", "dlq", "delivery count", "poison"]);
  return attachAngle({
    id: `evidence:${evidence.id}`,
    mode: "SHARE_EVIDENCE",
    reason: "evidence",
    why: "The post is directly related to verified engineering evidence the user can actually cite.",
    confidence: "HIGH",
    specificity: 93,
    requiredTokens: evidenceRequiredTokens(evidence),
    topics: evidence.topics,
    angle: poison ? "dead-letter vs retry count" : "measured retry outcome",
    concepts: poison ? ["dead-letter", "poison-message"] : ["measured-retry", "retry-outcome"],
    claim,
    evidenceSummary: evidence.summary,
    evidenceSuggests: evidence.suggests,
  });
}

function bridgeIdeas(text: string, evidence: UserEvidence): ContributionIdea[] {
  const tokens = evidenceRequiredTokens(evidence);
  const workReference = evidence.workName
    ? `That is the same seam ${evidence.workName} had to make explicit.`
    : undefined;
  const ideas: ContributionIdea[] = [];

  if (hasAnyMarker(text, ["service bus", "lock", "handler", "resilien", "retry"])) {
    ideas.push(
      attachAngle({
        id: `bridge:${evidence.id}:lock-duration`,
        mode: "BRIDGE_TO_ENGINEERING",
        reason: "connect_concepts",
        why: "The topic connects naturally to the user's actual engineering work, and the bridge adds a concrete seam rather than a promo line.",
        confidence: "HIGH",
        specificity: 84,
        requiredTokens: tokens,
        topics: evidence.topics,
        angle: "lock duration vs handler time",
        concepts: ["lock-duration", "handler-time", "at-least-once"],
        engineeringBridge:
          "The interesting boundary on Azure Service Bus is usually where lock duration, peek-lock, and handler time diverge. Once processing can outlive the lock, at-least-once stops being a delivery setting and becomes an application protocol.",
        workReference,
      })
    );
    ideas.push(
      attachAngle({
        id: `bridge:${evidence.id}:failure-ownership`,
        mode: "BRIDGE_TO_ENGINEERING",
        reason: "connect_concepts",
        why: "The useful bridge is who owns the failure after retries stop helping, not another restatement of lock timing.",
        confidence: "HIGH",
        specificity: 78,
        requiredTokens: tokens.filter((token) => token !== "lock"),
        topics: evidence.topics,
        angle: "ownership of failure",
        concepts: ["failure-ownership", "retry-boundary"],
        engineeringBridge:
          "The useful seam in an Azure integration layer is rarely the connector choice. It is where a failure stops being a retry and starts being someone else's ownership problem.",
        workReference,
      })
    );
    return ideas;
  }

  ideas.push(
    attachAngle({
      id: `bridge:${evidence.id}`,
      mode: "BRIDGE_TO_ENGINEERING",
      reason: "connect_concepts",
      why: "The topic connects naturally to the user's actual engineering work, and the bridge adds a concrete seam rather than a promo line.",
      confidence: "MEDIUM",
      specificity: 72,
      requiredTokens: tokens,
      topics: evidence.topics,
      angle: "integration failure ownership",
      concepts: ["failure-ownership", "integration-boundary"],
      engineeringBridge:
        hasAnyMarker(text, ["integration", "azure"])
          ? "The useful seam in an Azure integration layer is rarely the connector choice. It is where a failure stops being a retry and starts being someone else's ownership problem."
          : evidence.summary,
      workReference,
    })
  );
  return ideas;
}

function evidenceRequiredTokens(evidence: UserEvidence): string[] {
  const blob = `${evidence.summary} ${evidence.suggests} ${evidence.workName ?? ""}`;
  const technical = [
    "service bus",
    "retry",
    "dead-letter",
    "dlq",
    "kafka",
    "azure",
    ".net",
    "lock",
    "handler",
    "outbox",
  ];
  const tokens = technical.filter((token) => hasAnyMarker(blob, [token]));
  if (evidence.workName) tokens.push(evidence.workName);
  return tokens.length > 0 ? tokens : ["boundary"];
}

function evidenceClaim(text: string): string {
  if (hasAnyMarker(text, ["dead-letter", "dlq", "delivery count"])) {
    return "Retry count is a weak success metric when the useful signal is sitting on the dead-letter path.";
  }
  if (hasAnyMarker(text, ["retry"])) {
    return "Widening retries can hide a poison payload instead of removing it.";
  }
  return "The claim is testable, and there is relevant measured evidence for it.";
}
