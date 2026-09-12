import type { WineContext } from "./wine-context";
import type { WineSignals } from "./wine-signals";

export type CommentIntentType =
  | "GRAPE_PROFILE"
  | "FOOD_PAIRING"
  | "OLD_VINTAGE_FIND"
  | "APPRECIATE_REGION"
  | "DISCOVER_PRODUCER"
  | "SIMPLE_REACTION"
  | "GENERIC"
  | "QUESTION";

// Informative slots first, question last. Wishlist/radar is not a default
// intent — those lines were crowding out grape and pairing comments.
export const INTENT_ORDER: readonly CommentIntentType[] = [
  "GRAPE_PROFILE",
  "FOOD_PAIRING",
  "OLD_VINTAGE_FIND",
  "APPRECIATE_REGION",
  "DISCOVER_PRODUCER",
  "SIMPLE_REACTION",
  "GENERIC",
  "QUESTION",
];

export function selectAvailableIntents(context: WineContext, signals: WineSignals): CommentIntentType[] {
  const intents: CommentIntentType[] = [];

  if (signals.grapeKnowledge) {
    intents.push("GRAPE_PROFILE");
  }
  if (signals.pairings.length > 0) {
    intents.push("FOOD_PAIRING");
  }
  if (signals.isOldVintage) {
    intents.push("OLD_VINTAGE_FIND");
  }
  if (signals.regionKnowledge) {
    intents.push("APPRECIATE_REGION");
  }
  if (signals.hasProducer) {
    intents.push("DISCOVER_PRODUCER");
  }

  intents.push("SIMPLE_REACTION");

  // When grape/region knowledge is missing, fill the panel with generic
  // reactions instead of leaving the user with one blind "Nice pick."
  if (!signals.grapeKnowledge) {
    intents.push("GENERIC");
  }

  if (hasAnyQuestionableFact(context, signals)) {
    intents.push("QUESTION");
  }

  return INTENT_ORDER.filter((intent) => intents.includes(intent));
}

function hasAnyQuestionableFact(context: WineContext, signals: WineSignals): boolean {
  return Boolean(
    signals.primaryGrape ||
      signals.associatedGrape ||
      context.region ||
      context.producer ||
      signals.hasVintage ||
      context.wineName ||
      context.country
  );
}
