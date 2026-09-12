import { describe, expect, it } from "vitest";
import { WineCommentGenerator } from "./wine-comment-generator";
import type { WineContext } from "../domain/wine-context";
import { seededRng } from "../test-utils/seeded-rng";

const FORBIDDEN_PERSONAL_CLAIMS = [
  /\bi tasted\b/i,
  /\bi opened\b/i,
  /\bi had this\b/i,
  /\bi bought\b/i,
  /\bi drank\b/i,
  /\bi drunk\b/i,
  /\bi served\b/i,
  /\bi visited\b/i,
  /last night/i,
  /with dinner/i,
];

const KNOWN_GRAPE_NAMES = [
  "Cabernet Sauvignon",
  "Merlot",
  "Syrah",
  "Grenache",
  "Pinot Noir",
  "Chardonnay",
  "Riesling",
  "Sangiovese",
  "Tempranillo",
  "Nebbiolo",
  "Sauvignon Blanc",
  "Malbec",
  "Primitivo",
  "Chenin Blanc",
  "Friulano",
  "Muscat",
];

function countWords(text: string): number {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function generateMany(context: WineContext, seeds: number[], count = 8): string[] {
  return seeds.flatMap((seed) => WineCommentGenerator.generate(context, count, seededRng(seed)));
}

const SEEDS = [1, 2, 3, 4, 5, 42, 99, 12345];

describe("WineCommentGenerator", () => {
  it("never emits an unresolved template placeholder", () => {
    const contexts: WineContext[] = [
      {},
      { region: "Bordeaux" },
      { region: "Mosel", grapes: ["Riesling"] },
      { producer: "Some Winery", grapes: ["Malbec"] },
      { vintage: 2016, region: "Bordeaux" },
    ];
    for (const context of contexts) {
      for (const comment of generateMany(context, SEEDS)) {
        expect(comment).not.toMatch(/\{[a-zA-Z]+\}/);
      }
    }
  });

  it("keeps every comment within the word budget", () => {
    const context: WineContext = {
      wineName: "Big Reserve",
      producer: "Some Winery",
      region: "Bordeaux",
      grapes: ["Cabernet Sauvignon", "Merlot"],
      vintage: 2016,
      rating: 4.5,
    };
    for (const comment of generateMany(context, SEEDS)) {
      expect(countWords(comment)).toBeLessThanOrEqual(45);
    }
  });

  it("does not produce broken output for a completely empty context", () => {
    const comments = WineCommentGenerator.generate({}, 8, seededRng(7));
    expect(comments.length).toBeGreaterThan(0);
    for (const comment of comments) {
      expect(comment.length).toBeGreaterThan(0);
    }
  });

  it("never implies the commenter personally tasted, bought, or served the wine", () => {
    const richContext: WineContext = {
      wineName: "Big Reserve",
      producer: "Some Winery",
      region: "Napa",
      grapes: ["Cabernet Sauvignon"],
      vintage: 2018,
      rating: 4.6,
    };
    for (const comment of generateMany(richContext, SEEDS)) {
      for (const pattern of FORBIDDEN_PERSONAL_CLAIMS) {
        expect(comment).not.toMatch(pattern);
      }
    }
  });

  it("never mentions a grape unless it is confirmed or the region is known to be associated with it", () => {
    const context: WineContext = {};
    for (const comment of generateMany(context, SEEDS)) {
      for (const grape of KNOWN_GRAPE_NAMES) {
        expect(comment).not.toContain(grape);
      }
    }
  });

  it("only ever frames a region-associated grape as a style label, never as a claim about this bottle", () => {
    const context: WineContext = { region: "Mosel" };
    const comments = generateMany(context, SEEDS, 8);
    const grapeComments = comments.filter((c) => c.includes("Riesling"));
    expect(grapeComments.length).toBeGreaterThan(0);
    for (const comment of grapeComments) {
      expect(comment).toContain("Mosel");
    }
  });

  it("allows confident grape phrasing once the grape is an actual confirmed fact", () => {
    const context: WineContext = { grapes: ["Riesling"] };
    const comments = generateMany(context, SEEDS, 8);
    expect(comments.some((c) => c.includes("Riesling"))).toBe(true);
  });

  it("always includes a food pairing line when grape knowledge is available", () => {
    const comments = WineCommentGenerator.generate(
      { grapes: ["Malbec"], producer: "Luigi Bosca", vintage: 2024, region: "Mendoza" },
      8,
      seededRng(7)
    );
    expect(comments.some((c) => /steak|grilled meats|empanadas/i.test(c))).toBe(true);
  });

  it("adds a hard-to-find line for old vintages and skips it for young ones", () => {
    const oldComments = generateMany({ vintage: 2012, grapes: ["Nebbiolo"] }, SEEDS);
    expect(oldComments.some((c) => /hard to come by|real find|still around/i.test(c))).toBe(true);

    const youngComments = generateMany({ vintage: 2024, grapes: ["Malbec"] }, SEEDS);
    expect(youngComments.every((c) => !/hard to come by|real find|still around/i.test(c))).toBe(true);
  });

  it("requires a vintage for any vintage-related comment", () => {
    const context: WineContext = { region: "Bordeaux" };
    for (const comment of generateMany(context, SEEDS)) {
      expect(comment).not.toMatch(/\b(19|20)\d{2}\b/);
    }
  });

  it("only produces a producer-focused comment when a producer is known", () => {
    const withProducer = generateMany({ producer: "Chateau Example" }, SEEDS);
    expect(withProducer.some((c) => c.includes("Chateau Example"))).toBe(true);

    const withoutProducer = generateMany({ region: "Bordeaux" }, SEEDS);
    expect(withoutProducer.every((c) => !c.includes("Chateau Example"))).toBe(true);
  });

  it("puts informative grape/pairing lines before the question", () => {
    const comments = WineCommentGenerator.generate(
      { grapes: ["Malbec"], vintage: 2024, producer: "Luigi Bosca", region: "Mendoza" },
      8,
      seededRng(2024)
    );
    const questionIndex = comments.findIndex((c) => c.includes("?"));
    expect(questionIndex).toBeGreaterThan(0);
    expect(comments.slice(0, questionIndex).some((c) => /Malbec|steak/i.test(c))).toBe(true);
  });

  it("caps question-style comments to at most one per batch", () => {
    const context: WineContext = {
      wineName: "Malbec",
      producer: "Luigi Bosca",
      region: "Mendoza",
      grapes: ["Malbec"],
      vintage: 2024,
    };
    for (const seed of SEEDS) {
      const comments = WineCommentGenerator.generate(context, 8, seededRng(seed));
      const questionCount = comments.filter((c) => c.includes("?")).length;
      expect(questionCount).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for a given seed", () => {
    const context: WineContext = {
      region: "Rioja",
      producer: "Some Bodega",
      grapes: ["Tempranillo"],
      vintage: 2016,
    };
    const first = WineCommentGenerator.generate(context, 6, seededRng(555));
    const second = WineCommentGenerator.generate(context, 6, seededRng(555));
    expect(first).toEqual(second);
  });

  it("does not pad the panel with radar or wishlist filler", () => {
    const comments = generateMany(
      { grapes: ["Malbec"], vintage: 2024, producer: "Luigi Bosca", region: "Mendoza" },
      SEEDS
    );
    for (const comment of comments) {
      expect(comment).not.toMatch(/wishlist|on my radar|tracking this one down/i);
    }
  });

  it("offers more than one pairing option for Chardonnay", () => {
    const pairingHits = new Set<string>();
    for (const seed of SEEDS) {
      const comments = WineCommentGenerator.generate({ grapes: ["Chardonnay"] }, 8, seededRng(seed));
      for (const comment of comments) {
        if (/chicken|pasta|lobster|scallops|mushroom/i.test(comment)) {
          pairingHits.add(comment.replace(/\p{Extended_Pictographic}/gu, "").trim());
        }
      }
    }
    expect(pairingHits.size).toBeGreaterThan(1);
  });

  it("fills unknown wines with several generic comments instead of going silent", () => {
    const comments = WineCommentGenerator.generate(
      { producer: "Château Côtes de Saint Daniel", country: "Ukraine", vintage: 2024, wineName: "Le Caprice" },
      8,
      seededRng(3)
    );
    expect(comments.length).toBeGreaterThanOrEqual(4);
    expect(comments.some((c) => /Ukraine/i.test(c))).toBe(true);
  });
});
