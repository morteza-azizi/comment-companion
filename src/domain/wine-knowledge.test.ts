import { describe, expect, it } from "vitest";
import {
  detectGrapesInText,
  findGrapeKnowledge,
  grapesFromWinePageHtml,
  KNOWN_GRAPE_NAMES,
} from "./wine-knowledge";

describe("detectGrapesInText", () => {
  it("reads a grape that is literally in the wine name", () => {
    expect(detectGrapesInText("Malbec 2024")).toEqual(["Malbec"]);
    expect(detectGrapesInText("Collio Friulano")).toEqual(["Friulano"]);
  });

  it("does not invent a grape from a branded cuvée name", () => {
    expect(detectGrapesInText("Le Caprice")).toEqual([]);
    expect(detectGrapesInText("Reserve")).toEqual([]);
  });

  it("covers a broad catalog of grapes that actually show up on Vivino", () => {
    expect(KNOWN_GRAPE_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(KNOWN_GRAPE_NAMES).toEqual([...new Set(KNOWN_GRAPE_NAMES)]);
  });

  it("does not treat Petite Sirah as Syrah or Cabernet Sauvignon as Sauvignon Blanc", () => {
    expect(findGrapeKnowledge("Petite Sirah")?.name).toBe("Petite Sirah");
    expect(findGrapeKnowledge("Cabernet Sauvignon")?.name).toBe("Cabernet Sauvignon");
    expect(findGrapeKnowledge("Sauvignon Blanc")?.name).toBe("Sauvignon Blanc");
  });

  it("reads Müller-Thurgau from the label, including the umlaut form", () => {
    expect(detectGrapesInText("Müller-Thurgau 2023")).toEqual(["Müller-Thurgau"]);
    expect(detectGrapesInText("Muller-Thurgau Kabinett")).toEqual(["Müller-Thurgau"]);
    expect(detectGrapesInText("Rivaner Trocken")).toEqual(["Müller-Thurgau"]);
  });

  it("prefers the longer match so Cabernet Franc is not swallowed by Sauvignon", () => {
    expect(detectGrapesInText("Cabernet Franc")).toEqual(["Cabernet Franc"]);
    expect(detectGrapesInText("Cabernet Sauvignon")).toEqual(["Cabernet Sauvignon"]);
  });
});

describe("grapesFromWinePageHtml", () => {
  it("reads grape names from stable /grapes/ links", () => {
    const html = `
      <a href="/grapes/malbec">Malbec</a>
      <a href="https://www.vivino.com/grapes/cabernet-sauvignon">Cabernet Sauvignon</a>
    `;
    expect(grapesFromWinePageHtml(html)).toEqual(["Malbec", "Cabernet Sauvignon"]);
  });

  it("falls back to the URL slug when link text is missing", () => {
    const html = `<a href="/grapes/muscat"></a>`;
    // empty link text is skipped; slug fallback only runs when no link-text grapes were found
    expect(grapesFromWinePageHtml(html)).toEqual(["Muscat"]);
  });
});
