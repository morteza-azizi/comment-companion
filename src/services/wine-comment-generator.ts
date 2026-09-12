import type { WineContext } from "../domain/wine-context";
import { deriveSignals, type WineSignals } from "../domain/wine-signals";
import { selectAvailableIntents, type CommentIntentType } from "../domain/comment-intent";
import type { GrapeKnowledge } from "../domain/wine-knowledge";

export type RandomFn = () => number;

// Builds a short ordered panel: grape+vintage facts, then pairing, then
// old-vintage "great find", then region/producer, then one question last.
// Each slot is one pickable line. The injector appends clicks into the box.
export class WineCommentGenerator {
  private static readonly MAX_WORDS = 45;
  private static readonly EMOJI_CHANCE = 0.2;
  private static readonly EMOJIS: readonly string[] = ["🍷", "🍇", "👌", "✨", "🥂"];

  public static generate(context: WineContext, count = 8, rng: RandomFn = Math.random): string[] {
    const signals = deriveSignals(context);
    const results: string[] = [];

    const push = (comment: string | null): void => {
      if (comment && !results.includes(comment) && results.length < count) {
        results.push(comment);
      }
    };

    for (const intent of selectAvailableIntents(context, signals)) {
      if (results.length >= count) break;

      if (intent === "FOOD_PAIRING") {
        for (const line of this.buildFoodPairingLines(signals, rng)) {
          push(line);
        }
        continue;
      }

      if (intent === "GENERIC") {
        for (const line of this.buildGenericLines(context, rng, count - results.length)) {
          push(line);
        }
        continue;
      }

      push(this.buildComment(intent, context, signals, rng));
    }

    return results;
  }

  private static buildComment(
    intent: CommentIntentType,
    context: WineContext,
    signals: WineSignals,
    rng: RandomFn
  ): string | null {
    switch (intent) {
      case "GRAPE_PROFILE":
        return this.buildGrapeProfile(context, signals, rng);
      case "FOOD_PAIRING":
        return this.buildFoodPairingLines(signals, rng)[0] ?? null;
      case "OLD_VINTAGE_FIND":
        return this.buildOldVintageFind(context, rng);
      case "APPRECIATE_REGION":
        return this.buildAppreciateRegion(signals, rng);
      case "DISCOVER_PRODUCER":
        return this.buildDiscoverProducer(context, signals, rng);
      case "SIMPLE_REACTION":
        return this.buildSimpleReaction(rng);
      case "GENERIC":
        return this.buildGenericLines(context, rng, 1)[0] ?? null;
      case "QUESTION":
        return this.buildQuestion(signals, rng);
    }
  }

  // Combines grape character, drink window, and vintage into one line so
  // the user does not have to stitch three related facts by hand.
  private static buildGrapeProfile(
    context: WineContext,
    signals: WineSignals,
    rng: RandomFn
  ): string | null {
    const knowledge = signals.grapeKnowledge;
    if (!knowledge) return null;

    const grapeLabel = this.grapeLabel(signals, knowledge);
    const character = this.randomFrom(knowledge.character, rng);
    const parts: string[] = [`${grapeLabel} usually has ${character}`];

    if (knowledge.drinkStyle === "fresh") {
      parts.push("this grape is generally better young than aged");
    } else if (knowledge.drinkStyle === "age") {
      parts.push("this grape usually wants time in the bottle");
    } else {
      parts.push("this grape can drink young or with age, depending on the style");
    }

    if (typeof context.vintage === "number") {
      const vintageNote = this.vintageNote(context.vintage, knowledge, signals);
      if (vintageNote) parts.push(vintageNote);
    }

    return this.finalize(this.joinSentences(parts));
  }

  private static grapeLabel(signals: WineSignals, knowledge: GrapeKnowledge): string {
    if (signals.primaryGrape) return knowledge.name;
    if (signals.regionKnowledge) return `${signals.regionKnowledge.name} ${knowledge.name}`;
    return knowledge.name;
  }

  private static vintageNote(vintage: number, knowledge: GrapeKnowledge, signals: WineSignals): string | null {
    const age = signals.vintageAge;
    if (age === undefined) return null;

    if (knowledge.drinkStyle === "fresh" && signals.isYoungVintage) {
      return `${vintage} still suits it — best while it's bright`;
    }
    if (knowledge.drinkStyle === "flexible" && signals.isYoungVintage) {
      return `${vintage} is a good moment to drink it while it's still lively`;
    }
    if (knowledge.drinkStyle === "age" && signals.isOldVintage) {
      return `${vintage} is around the age this grape starts to open`;
    }
    if (knowledge.drinkStyle === "age" && signals.isYoungVintage) {
      return `${vintage} is still young for this grape`;
    }
    if (knowledge.drinkStyle === "fresh" && age > 4) {
      return `${vintage} is on the older side for a grape that's usually drunk young`;
    }
    return null;
  }

  private static readonly PAIRING_TEMPLATES: readonly string[] = [
    "Usually great with {pairing}.",
    "This style loves {pairing}.",
    "Classic pairing is {pairing}.",
    "Would go well with {pairing}.",
  ];

  private static buildFoodPairingLines(signals: WineSignals, rng: RandomFn): string[] {
    if (signals.pairings.length === 0) return [];
    const pairings = this.shuffle(signals.pairings, rng).slice(0, 2);
    const templates = this.shuffle(this.PAIRING_TEMPLATES, rng);
    return pairings
      .map((pairing, index) =>
        this.finalize(templates[index % templates.length].replace(/{pairing}/g, pairing), rng)
      )
      .filter((line): line is string => Boolean(line));
  }

  private static readonly OLD_VINTAGE_TEMPLATES: readonly string[] = [
    "Great find — a {vintage} like this can be hard to come by.",
    "Nice to see a {vintage} still around. Must have been a hunt.",
    "A {vintage} like this is a real find.",
  ];

  private static buildOldVintageFind(context: WineContext, rng: RandomFn): string | null {
    if (typeof context.vintage !== "number") return null;
    const sentence = this.randomFrom(this.OLD_VINTAGE_TEMPLATES, rng).replace(
      /{vintage}/g,
      String(context.vintage)
    );
    return this.finalize(sentence, rng);
  }

  private static readonly REGION_TEMPLATES: readonly string[] = [
    "Always have a soft spot for {region}.",
    "{region} is one of my go-to regions.",
    "Don't see enough {region} wines on here.",
  ];

  private static buildAppreciateRegion(signals: WineSignals, rng: RandomFn): string | null {
    const region = signals.regionKnowledge?.name;
    if (!region) return null;
    const sentence = this.randomFrom(this.REGION_TEMPLATES, rng).replace(/{region}/g, region);
    return this.finalize(sentence, rng);
  }

  private static readonly PRODUCER_WITH_GRAPE_TEMPLATES: readonly string[] = [
    "Always curious what {producer} is doing with this grape.",
    "Good to see {producer} pop up here.",
    "Would love to try more from {producer}.",
  ];

  private static readonly PRODUCER_TEMPLATES: readonly string[] = [
    "Always curious what {producer} is doing.",
    "Good to see {producer} pop up here.",
    "Would love to try more from {producer}.",
  ];

  private static buildDiscoverProducer(
    context: WineContext,
    signals: WineSignals,
    rng: RandomFn
  ): string | null {
    if (!context.producer) return null;
    const pool =
      signals.grapeKnowledge ? this.PRODUCER_WITH_GRAPE_TEMPLATES : this.PRODUCER_TEMPLATES;
    const sentence = this.randomFrom(pool, rng).replace(/{producer}/g, context.producer);
    return this.finalize(sentence, rng);
  }

  private static readonly REACTION_TEMPLATES: readonly string[] = [
    "Nice pick.",
    "Solid choice.",
    "Really like the look of this one.",
  ];

  private static buildSimpleReaction(rng: RandomFn): string | null {
    return this.finalize(this.randomFrom(this.REACTION_TEMPLATES, rng), rng);
  }

  private static readonly QUESTION_TEMPLATES: readonly string[] = [
    "How did it show for you?",
    "Wondering what you had it with.",
    "Did it feel ready, or still a bit tight?",
  ];

  private static buildQuestion(signals: WineSignals, rng: RandomFn): string | null {
    let pool = this.QUESTION_TEMPLATES;
    if (signals.pairings.length > 0) {
      pool = this.QUESTION_TEMPLATES.filter((q) => !q.includes("had it with"));
    }
    return this.finalize(this.randomFrom(pool, rng), rng);
  }

  private static joinSentences(parts: string[]): string {
    return parts
      .map((part, index) => {
        const trimmed = part.replace(/\.+$/, "");
        if (index === 0) return this.capitalizeFirst(trimmed);
        return trimmed;
      })
      .join(". ") + ".";
  }

  private static finalize(sentence: string, rng?: RandomFn): string | null {
    if (this.countWords(sentence) > this.MAX_WORDS) return null;
    let out = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    out = this.capitalizeFirst(out);
    if (rng && rng() < this.EMOJI_CHANCE) {
      out += ` ${this.randomFrom(this.EMOJIS, rng)}`;
    }
    return out;
  }

  private static capitalizeFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private static countWords(text: string): number {
    return text
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  private static readonly GENERIC_TEMPLATES: readonly string[] = [
    "Looks like an interesting bottle.",
    "Not one I know well — curious how it showed.",
    "Nice to see something a bit different on here.",
    "This one caught my eye.",
    "Would love to hear your take on it.",
    "Always up for trying something new like this.",
    "Don't know this one, but it looks worth a look.",
  ];

  private static readonly COUNTRY_TEMPLATES: readonly string[] = [
    "Don't see enough wines from {country} on here.",
    "Always curious about bottles from {country}.",
  ];

  private static buildGenericLines(context: WineContext, rng: RandomFn, limit: number): string[] {
    const lines: string[] = [];
    if (context.country) {
      const countryLine = this.finalize(
        this.randomFrom(this.COUNTRY_TEMPLATES, rng).replace(/{country}/g, context.country),
        rng
      );
      if (countryLine) lines.push(countryLine);
    }

    for (const template of this.shuffle(this.GENERIC_TEMPLATES, rng)) {
      if (lines.length >= limit) break;
      const comment = this.finalize(template, rng);
      if (comment && !lines.includes(comment)) lines.push(comment);
    }
    return lines;
  }

  private static shuffle<T>(list: readonly T[], rng: RandomFn): T[] {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private static randomFrom<T>(list: readonly T[], rng: RandomFn): T {
    return list[Math.floor(rng() * list.length)];
  }
}
