import { describe, expect, it } from "vitest";
import { selectAvailableIntents } from "./comment-intent";
import { deriveSignals } from "./wine-signals";
import type { WineContext } from "./wine-context";

function intentsFor(context: WineContext) {
  return selectAvailableIntents(context, deriveSignals(context, 2026));
}

describe("selectAvailableIntents", () => {
  it("falls back to a simple reaction when nothing is known", () => {
    const intents = intentsFor({});
    expect(intents).toEqual(["SIMPLE_REACTION", "GENERIC"]);
  });

  it("puts grape profile and pairing before questions", () => {
    const intents = intentsFor({ grapes: ["Malbec"], vintage: 2024, producer: "Luigi Bosca" });
    expect(intents[0]).toBe("GRAPE_PROFILE");
    expect(intents).toContain("FOOD_PAIRING");
    expect(intents[intents.length - 1]).toBe("QUESTION");
  });

  it("unlocks FOOD_PAIRING from a confirmed or region-associated grape", () => {
    expect(intentsFor({ grapes: ["Malbec"] })).toContain("FOOD_PAIRING");
    expect(intentsFor({ region: "Mosel" })).toContain("FOOD_PAIRING");
    expect(intentsFor({})).not.toContain("FOOD_PAIRING");
  });

  it("only unlocks OLD_VINTAGE_FIND for bottles at least 10 years old", () => {
    expect(intentsFor({ vintage: 2016 })).toContain("OLD_VINTAGE_FIND");
    expect(intentsFor({ vintage: 2024 })).not.toContain("OLD_VINTAGE_FIND");
    expect(intentsFor({})).not.toContain("OLD_VINTAGE_FIND");
  });

  it("requires a producer for DISCOVER_PRODUCER", () => {
    expect(intentsFor({ producer: "Some Winery" })).toContain("DISCOVER_PRODUCER");
    expect(intentsFor({})).not.toContain("DISCOVER_PRODUCER");
  });

  it("unlocks region comments only when the region is recognized", () => {
    expect(intentsFor({ region: "Mendoza" })).toContain("APPRECIATE_REGION");
    expect(intentsFor({ region: "Nowhereland" })).not.toContain("APPRECIATE_REGION");
  });

  it("fills unknown wines with generic fallback comments", () => {
    expect(intentsFor({ country: "Ukraine", producer: "Some Chateau" })).toContain("GENERIC");
    expect(intentsFor({ grapes: ["Malbec"] })).not.toContain("GENERIC");
  });
});
