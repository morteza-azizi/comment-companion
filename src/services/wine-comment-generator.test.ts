import { describe, expect, it } from "vitest";
import { WineCommentGenerator } from "./wine-comment-generator";
import type { WineContext } from "../domain/wine-context";
import { ContributionHistory } from "../domain/contribution-history";
import { GENERIC_COMMENT_PATTERNS } from "../domain/distinctiveness";
import { KNOWN_GRAPE_NAMES } from "../domain/wine-knowledge";

const FORBIDDEN_AI_TELLS = [
  /the useful comment/i,
  /the useful distinction/i,
  /the useful question is/i,
  /not a claim about this exact bottle/i,
  /structural register/i,
  /consensus signal/i,
  /market observation/i,
  /generic toast/i,
  /toast to the bottle/i,
];

const FORBIDDEN_PERSONAL_CLAIMS = [
  /\bi tasted\b/i,
  /\bi opened\b/i,
  /\bi had this\b/i,
  /\bi bought\b/i,
  /\bi drank\b/i,
  /\bi drunk\b/i,
  /\bi served\b/i,
  /\bi visited\b/i,
  /in my experience/i,
  /last night/i,
  /with dinner/i,
];

function evaluate(context: WineContext) {
  return WineCommentGenerator.evaluate(context, new ContributionHistory());
}

describe("WineCommentGenerator", () => {
  it("SKIPs when the bottle has nothing distinctive to add", () => {
    const result = evaluate({});
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution).toBeUndefined();
  });

  it("SKIPs an unknown wine instead of manufacturing generic agreement", () => {
    const result = evaluate({
      producer: "Château Côtes de Saint Daniel",
      country: "Ukraine",
      vintage: 2024,
      wineName: "Le Caprice",
    });
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution).toBeUndefined();
  });

  it("adds a grape-and-vintage insight for a young Malbec", () => {
    const result = evaluate({
      grapes: ["Malbec"],
      vintage: 2024,
      producer: "Luigi Bosca",
      region: "Mendoza",
    });
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("ADD_ONE_INSIGHT");
    expect(result.contribution).toContain("Malbec");
    expect(result.contribution).toContain("2024");
    expect(result.why.length).toBeGreaterThan(20);
  });

  it("opens a discussion for an old age-worthy grape", () => {
    const result = evaluate({ grapes: ["Nebbiolo"], vintage: 2012 });
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("OPEN_DISCUSSION");
    expect(result.contribution).toContain("Nebbiolo");
    expect(result.contribution).toContain("2012");
  });

  it("asks a readiness question for a young age-worthy grape", () => {
    const result = evaluate({ grapes: ["Nebbiolo"], vintage: 2024 });
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("ASK_BETTER_QUESTION");
    expect(result.contribution).toMatch(/\?/);
    expect(result.contribution).toContain("Nebbiolo");
  });

  it("distinguishes vintage year from drink window when a fresh grape is old", () => {
    const result = evaluate({ grapes: ["Muscat"], vintage: 2018 });
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("TECHNICAL_DISTINCTION");
    expect(result.contribution).toMatch(/drink window|young/i);
  });

  it("never implies the commenter personally tasted the wine", () => {
    const contexts: WineContext[] = [
      { grapes: ["Malbec"], vintage: 2024, region: "Mendoza" },
      { grapes: ["Nebbiolo"], vintage: 2012 },
      { region: "Mosel" },
      { grapes: ["Riesling"] },
    ];
    for (const context of contexts) {
      const comment = evaluate(context).contribution ?? "";
      for (const pattern of FORBIDDEN_PERSONAL_CLAIMS) {
        expect(comment).not.toMatch(pattern);
      }
      for (const pattern of GENERIC_COMMENT_PATTERNS) {
        expect(comment).not.toMatch(pattern);
      }
    }
  });

  it("never mentions a grape unless it is confirmed or the region is known for it", () => {
    const comment = evaluate({}).contribution ?? "";
    for (const grape of KNOWN_GRAPE_NAMES) {
      expect(comment).not.toContain(grape);
    }
  });

  it("frames a region-associated grape as a style label, not a bottle fact", () => {
    const result = evaluate({ region: "Mosel" });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toContain("Mosel");
    expect(result.contribution).toMatch(/Riesling/i);
    expect(result.contribution).toMatch(/usually|typical|often/i);
    expect(result.contribution).not.toMatch(/this (bottle|one) is Riesling/i);
  });

  it("allows confident grape phrasing once the grape is a confirmed fact", () => {
    const result = evaluate({ grapes: ["Riesling"] });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toContain("Riesling");
  });

  it("can comment on every grape in the catalog without inventing a tasting", () => {
    expect(KNOWN_GRAPE_NAMES.length).toBeGreaterThanOrEqual(60);
    for (const grape of KNOWN_GRAPE_NAMES) {
      const result = evaluate({ grapes: [grape] });
      expect(result.verdict, grape).toBe("COMMENT");
      expect(result.contribution, grape).toContain(grape);
      for (const pattern of FORBIDDEN_PERSONAL_CLAIMS) {
        expect(result.contribution ?? "", grape).not.toMatch(pattern);
      }
    }
  });

  it("requires a vintage for any vintage-related comment", () => {
    const comment = evaluate({ region: "Bordeaux" }).contribution ?? "";
    expect(comment).not.toMatch(/\b(19|20)\d{2}\b/);
  });

  it("does not invent a producer comment when only a producer is known", () => {
    const result = evaluate({ producer: "Chateau Example" });
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution ?? "").not.toContain("Chateau Example");
  });

  it("is deterministic for a given bottle", () => {
    const context: WineContext = {
      region: "Rioja",
      producer: "Some Bodega",
      grapes: ["Tempranillo"],
      vintage: 2016,
    };
    expect(evaluate(context)).toEqual(evaluate(context));
  });

  it("does not keep repeating Chardonnay-plus-chicken across bottles", () => {
    const history = new ContributionHistory();
    const bottles: WineContext[] = [
      { grapes: ["Chardonnay"], vintage: 2024, region: "Burgundy" },
      { grapes: ["Chardonnay"], vintage: 2023, region: "Napa" },
      { grapes: ["Chardonnay"], region: "Mendoza" },
      { grapes: ["Chardonnay"], vintage: 2022 },
    ];

    const results = bottles.map((bottle) => WineCommentGenerator.evaluate(bottle, history));
    const comments = results.map((result) => result.contribution ?? "");
    const angles = results.map((result) => result.angle);

    expect(results.every((result) => result.verdict === "COMMENT")).toBe(true);
    expect(new Set(angles).size).toBeGreaterThanOrEqual(3);
    expect(comments.filter((comment) => /roast chicken/i.test(comment)).length).toBeLessThanOrEqual(1);
    expect(comments.some((comment) => /oak|stainless|malo/i.test(comment))).toBe(true);
    expect(comments.some((comment) => /2024|2023|2022/.test(comment))).toBe(true);
    expect(comments.some((comment) => /Burgundy|Napa|Mendoza/i.test(comment))).toBe(true);
  });

  it("comments on Müller-Thurgau instead of going silent", () => {
    const result = evaluate({ grapes: ["Müller-Thurgau"], vintage: 2024 });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toMatch(/Müller-Thurgau/i);
    expect(result.contribution).not.toMatch(/roast chicken/i);
  });

  it("can comment on a high rating when the grape is unknown", () => {
    const result = evaluate({ wineName: "Local Field Blend", rating: 4.5 });
    expect(result.verdict).toBe("COMMENT");
    expect(result.angle).toBe("community consensus");
    expect(result.contribution).toContain("4.5");
    expect(result.contribution).not.toMatch(/tasted|in my experience/i);
  });

  it("can comment on an old vintage when the grape is unknown", () => {
    const result = evaluate({ wineName: "Local Field Blend", vintage: 2012, country: "Germany" });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toContain("2012");
    expect(result.contribution).toContain("Germany");
  });

  it("uses a confirmed blend as its own angle", () => {
    const result = evaluate({ grapes: ["Cabernet Sauvignon", "Merlot"] });
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("TECHNICAL_DISTINCTION");
    expect(result.contribution).toMatch(/blend/i);
    expect(result.contribution).toContain("Cabernet Sauvignon");
    expect(result.contribution).toContain("Merlot");
  });

  it("does not pad a skip with radar or wishlist filler", () => {
    const result = evaluate({ producer: "Unknown Cellars", country: "Ukraine" });
    expect(result.verdict).toBe("SKIP");
    expect(result.why).not.toMatch(/wishlist|on my radar/i);
  });

  it("replies to the reviewer's note and score instead of lecturing about the grape", () => {
    const result = evaluate({
      grapes: ["Pinot Noir"],
      wineName: "Some Pinot Noir Rosé",
      wineColor: "rose",
      vintage: 2024,
      reviewerRating: 4.0,
      reviewText: "Light and fresh, perfect for summer.",
      rating: 3.8,
    });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toMatch(/4\.0/);
    expect(result.contribution).toMatch(/light|fresh/i);
    expect(result.contribution).toMatch(/ros[eé]/i);
    expect(result.contribution).toMatch(/\?/);
    expect(result.contribution).not.toMatch(/tannin|steak|extraction|duck/i);
    expect(result.angle).toBe("reply to review");
  });

  it("treats rosé as rosé even when the grape is a red variety", () => {
    const result = evaluate({
      grapes: ["Pinot Noir"],
      wineName: "Whispering Angel Rosé",
      wineColor: "rose",
      vintage: 2024,
    });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toMatch(/ros[eé]/i);
    expect(result.contribution).not.toMatch(/tannin|extraction|duck|steak/i);
  });

  it("does not talk about cellaring tannin for an old rosé of an age-worthy grape", () => {
    const result = evaluate({
      grapes: ["Syrah"],
      wineColor: "rose",
      vintage: 2014,
      wineName: "Some Syrah Rosé",
    });
    expect(result.mode).not.toBe("OPEN_DISCUSSION");
    expect(result.contribution).toMatch(/ros[eé]|young/i);
    expect(result.contribution).not.toMatch(/cellar|tannin/i);
  });

  it("asks about a reviewer's score when they ranked the wine but left no note", () => {
    const result = evaluate({
      grapes: ["Malbec"],
      vintage: 2023,
      reviewerRating: 3.2,
      rating: 4.4,
    });
    expect(result.verdict).toBe("COMMENT");
    expect(result.contribution).toMatch(/3\.2/);
    expect(result.contribution).toMatch(/4\.4/);
    expect(result.contribution).toMatch(/\?/);
  });

  it("avoids AI-lecture phrasing on shipped wine comments", () => {
    const contexts: WineContext[] = [
      { grapes: ["Malbec"], vintage: 2024, region: "Mendoza" },
      { grapes: ["Nebbiolo"], vintage: 2012 },
      { region: "Mosel" },
      { grapes: ["Riesling"] },
      {
        grapes: ["Pinot Noir"],
        wineColor: "rose",
        wineName: "Pinot Noir Rosé",
        reviewerRating: 4.2,
        reviewText: "Strawberry and a dry finish.",
      },
    ];
    for (const context of contexts) {
      const comment = evaluate(context).contribution ?? "";
      for (const pattern of FORBIDDEN_AI_TELLS) {
        expect(comment).not.toMatch(pattern);
      }
    }
  });
});
