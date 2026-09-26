import type { ContributionOpportunity } from "../domain/contribution";
import type { WineContext } from "../domain/wine-context";
import { winePostText } from "../domain/wine-opportunity";
import { evaluateContribution, type EvaluateInput } from "./contribution-companion";
import type { ContributionHistory } from "../domain/contribution-history";

export class WineCommentGenerator {
  public static evaluate(
    context: WineContext,
    history?: ContributionHistory
  ): ContributionOpportunity {
    const input: EvaluateInput = {
      post: { text: winePostText(context), source: "vivino", wine: context },
      history,
    };
    return evaluateContribution(input);
  }
}
