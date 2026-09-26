import { describe, expect, it } from "vitest";
import { selectAvailableIntents } from "./comment-intent";
import { deriveSignals } from "./wine-signals";
import type { WineContext } from "./wine-context";

function intentsFor(context: WineContext) {
  return selectAvailableIntents(context, deriveSignals(context, 2026));
}

describe("selectAvailableIntents", () => {
  it("returns no comment-worthy intents when nothing distinctive is known", () => {
    expect(intentsFor({})).toEqual([]);
  });

  it("does not treat generic agreement as an available intent", () => {
    const intents = intentsFor({ country: "Ukraine", producer: "Some Chateau" });
    expect(intents).not.toContain("GENERIC");
    expect(intents).not.toContain("SIMPLE_REACTION");
    expect(intents).toEqual([]);
  });

  it("unlocks grape and pairing knowledge before a question", () => {
    const intents = intentsFor({ grapes: ["Nebbiolo"], vintage: 2024, producer: "Produttori" });
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

  it("requires a producer and grape knowledge for DISCOVER_PRODUCER", () => {
    expect(intentsFor({ producer: "Some Winery", grapes: ["Malbec"] })).toContain("DISCOVER_PRODUCER");
    expect(intentsFor({ producer: "Some Winery" })).not.toContain("DISCOVER_PRODUCER");
    expect(intentsFor({})).not.toContain("DISCOVER_PRODUCER");
  });

  it("unlocks region comments only when the region is recognized", () => {
    expect(intentsFor({ region: "Mendoza" })).toContain("APPRECIATE_REGION");
    expect(intentsFor({ region: "Nowhereland" })).not.toContain("APPRECIATE_REGION");
  });
});
