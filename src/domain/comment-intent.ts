import type { WineContext } from "./wine-context";
import type { WineSignals } from "./wine-signals";

export type CommentIntentType =
  | "GRAPE_PROFILE"
  | "FOOD_PAIRING"
  | "OLD_VINTAGE_FIND"
  | "APPRECIATE_REGION"
  | "DISCOVER_PRODUCER"
  | "QUESTION";

export const INTENT_ORDER: readonly CommentIntentType[] = [
  "GRAPE_PROFILE",
  "OLD_VINTAGE_FIND",
  "APPRECIATE_REGION",
  "FOOD_PAIRING",
  "DISCOVER_PRODUCER",
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
  if (signals.hasProducer && signals.grapeKnowledge) {
    intents.push("DISCOVER_PRODUCER");
  }
  if (hasSpecificQuestion(context, signals)) {
    intents.push("QUESTION");
  }

  return INTENT_ORDER.filter((intent) => intents.includes(intent));
}

function hasSpecificQuestion(context: WineContext, signals: WineSignals): boolean {
  return Boolean(signals.grapeKnowledge && typeof context.vintage === "number" && signals.drinkStyle === "age");
}
