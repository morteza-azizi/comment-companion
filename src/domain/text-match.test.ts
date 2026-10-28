import { describe, expect, it } from "vitest";
import { detectGrapesInText } from "./grapes";
import { countWords, hasAnyMarker, hasMarker, normalizeText, uniqueOverlap } from "./text-match";

describe("text-match (reused helpers)", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeText("  Grippy   TANNINS \n")).toBe("grippy tannins");
  });

  it("matches words on boundaries, not inside other words", () => {
    expect(hasMarker("a hint of oak", "oak")).toBe(true);
    expect(hasMarker("soaking wet", "oak")).toBe(false);
    expect(hasAnyMarker("nothing here", ["oak", "vanilla"])).toBe(false);
  });

  it("counts words without emoji", () => {
    expect(countWords("Nice 🍷 wine here")).toBe(3);
  });

  it("finds unique overlaps", () => {
    expect(uniqueOverlap(["A", "b", "a"], ["a"])).toEqual(["A"]);
  });
});

describe("detectGrapesInText", () => {
  it("reads a grape literally named in the title", () => {
    expect(detectGrapesInText("Reserva Malbec 2022")).toEqual(["Malbec"]);
    expect(detectGrapesInText("Grüner Veltliner Federspiel")).toEqual(["Grüner Veltliner"]);
  });

  it("does not guess a grape from a brand name or region", () => {
    expect(detectGrapesInText("Le Caprice Rioja Reserva")).toEqual([]);
    expect(detectGrapesInText(undefined)).toEqual([]);
  });

  it("prefers the longer variety name", () => {
    expect(detectGrapesInText("Cabernet Sauvignon Merlot")).toEqual(["Cabernet Sauvignon", "Merlot"]);
    expect(detectGrapesInText("Sauvignon Blanc")).toEqual(["Sauvignon Blanc"]);
  });
});
