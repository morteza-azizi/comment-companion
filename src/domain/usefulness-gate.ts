import type { ContributionIdea } from "./contribution";
import type { UserProfile } from "./user-profile";
import { uniqueOverlap } from "./text-match";

export interface UsefulnessAssessment {
  passed: boolean;
  yesCount: number;
  answers: readonly boolean[];
}

const STRONG_THRESHOLD = 5;

export function assessUsefulness(idea: ContributionIdea, profile: UserProfile): UsefulnessAssessment {
  const expertiseOverlap = uniqueOverlap(idea.topics, profile.expertise);
  const evidenceMatch = profile.evidence.some((item) => uniqueOverlap(item.topics, idea.topics).length > 0);

  const somethingNew = Boolean(
    idea.insight ||
      idea.distinction ||
      idea.assumption ||
      idea.question ||
      idea.correction ||
      idea.discussionAngle ||
      idea.evidenceSummary ||
      idea.engineeringBridge
  );
  const relevant = idea.topics.length > 0 || idea.requiredTokens.length > 0;
  const grounded =
    idea.mode === "SHARE_EVIDENCE" || idea.mode === "BRIDGE_TO_ENGINEERING"
      ? evidenceMatch
      : expertiseOverlap.length > 0 || evidenceMatch;
  const improvesConversation = idea.reason !== "open_angle" || Boolean(idea.discussionAngle);
  const specificEnough = idea.requiredTokens.length > 0 && idea.specificity >= 60;
  const worthWithoutEngagement = idea.mode !== "ADD_ONE_INSIGHT" || Boolean(idea.insight);
  const credible =
    idea.mode === "SHARE_EVIDENCE" || idea.mode === "BRIDGE_TO_ENGINEERING"
      ? evidenceMatch
      : expertiseOverlap.length > 0 || idea.topics.length === 0;

  const answers = [
    somethingNew,
    relevant,
    grounded,
    improvesConversation,
    specificEnough,
    worthWithoutEngagement,
    credible,
  ];
  const yesCount = answers.filter(Boolean).length;

  return {
    passed: yesCount >= STRONG_THRESHOLD && somethingNew && grounded,
    yesCount,
    answers,
  };
}
