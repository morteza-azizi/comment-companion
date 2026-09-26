import {
  commentOpportunity,
  skipOpportunity,
  type ContributionOpportunity,
} from "../domain/contribution";
import { ContributionHistory } from "../domain/contribution-history";
import type { ConversationPost } from "../domain/conversation-post";
import { ideaAngleInput } from "../domain/angle-fingerprint";
import { isDistinctiveComment } from "../domain/distinctiveness";
import { analyzeOpportunity } from "../domain/opportunity-analyzer";
import { DEFAULT_USER_PROFILE, type UserProfile } from "../domain/user-profile";
import { analyzeWineOpportunity, rankWineIdeas } from "../domain/wine-opportunity";
import { draftComment } from "./comment-drafter";

export interface EvaluateInput {
  post: ConversationPost;
  profile?: UserProfile;
  history?: ContributionHistory;
}

const sessionHistory = new ContributionHistory();

const WINE_SKIP_WHY =
  "The bottle is reasonable, but there is no distinctive insight or evidence available to add.";

const DRAFT_FAILED_WHY =
  "A possible angle existed, but it failed the distinctiveness test and was not worth manufacturing a comment for.";

export function evaluateContribution(input: EvaluateInput): ContributionOpportunity {
  const history = input.history ?? sessionHistory;
  const opportunity = input.post.wine
    ? evaluateWine(input.post, history)
    : evaluateEngineering(input.post, input.profile ?? DEFAULT_USER_PROFILE, history);

  if (opportunity.verdict === "COMMENT" && opportunity.mode && opportunity.ideaId) {
    history.record({
      mode: opportunity.mode,
      ideaId: opportunity.ideaId,
      angleFingerprint: opportunity.angleFingerprint ?? opportunity.ideaId,
      concepts: opportunity.concepts,
      angle: opportunity.angle,
    });
  }

  return opportunity;
}


function evaluateEngineering(
  post: ConversationPost,
  profile: UserProfile,
  history: ContributionHistory
): ContributionOpportunity {
  const analysis = analyzeOpportunity(post, profile, history);
  if (analysis.kind === "skip") {
    return skipOpportunity(analysis.why);
  }

  for (const idea of analysis.ideas) {
    const draft = draftComment(idea);
    if (!draft) continue;
    if (!isDistinctiveComment(draft, idea)) continue;
    return commentOpportunity(idea, draft, history.noveltyLabel(ideaAngleInput(idea)));
  }

  return skipOpportunity(DRAFT_FAILED_WHY);
}

function evaluateWine(post: ConversationPost, history: ContributionHistory): ContributionOpportunity {
  if (!post.wine) {
    return skipOpportunity(WINE_SKIP_WHY);
  }

  const ideas = rankWineIdeas(analyzeWineOpportunity(post.wine), history);
  for (const idea of ideas) {
    const draft = draftComment(idea);
    if (!draft || !isDistinctiveComment(draft, idea)) continue;
    return commentOpportunity(idea, draft, history.noveltyLabel(ideaAngleInput(idea)));
  }

  return skipOpportunity(WINE_SKIP_WHY);
}

export { ContributionHistory };
