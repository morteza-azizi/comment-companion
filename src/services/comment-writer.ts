import type { Candidate } from "../domain/opportunity";
import type { InsightKind, TastingTheme } from "../domain/tasting-lexicon";
import { hashString, reviewReference, type ConversationInput } from "../domain/wine-context";

// Writes comment text from a candidate. The only wine-specific material it
// uses is the reviewer's own quoted words, wine facts the page stated, and my
// own note. Sentence frames deliberately avoid tasting vocabulary, so a frame
// can never assert a characteristic the review did not state. Several frames
// exist per move so the quality gate can rotate away from a recently used one.

const q = (phrase: string): string => `“${phrase}”`;

const SINGLE_BY_THEME: Partial<Record<TastingTheme, (o: string) => string>> = {
  oak: (o) => `Did ${o} feel woven into the wine, or more like something sitting on top?`,
  finish: (o) => `Did ${o} change after the first few sips, or stay the same all the way through?`,
  aromatics: (o) => `Did ${o} come through on the nose, the palate, or both?`,
  fruit: (o) => `Did ${o} come through on the nose, the palate, or both?`,
  tannin: (o) => `Did ${o} change as the glass sat, or stay the same?`,
  acidity: (o) => `Was ${o} there from the first sip, or did it show up later?`,
  body: (o) => `Did ${o} change with time in the glass, or stay put?`,
  sweetness: (o) => `Was ${o} obvious straight away, or did it only show up later?`,
};

const SINGLE_GENERIC: ((o: string) => string)[] = [
  (o) => `Did ${o} hit you right away, or did it build over the glass?`,
  (o) => `Was ${o} the first thing you noticed, or did something else come first?`,
  (o) => `What made ${o} stand out for you in this one?`,
];

function ensureSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function insightFrames(kind: InsightKind, p: string, vintage?: number): string[] {
  switch (kind) {
    case "pairing":
      return [
        `You mention ${p}. What made that combination work, or not work?`,
        `What stood out to you about ${p}?`,
        `Did ${p} change how you saw the wine, or would it read the same on its own?`,
      ];
    case "value":
      return [
        `You say ${p}. What were you comparing it against?`,
        `When you say ${p}, what would you usually pick instead?`,
        `Did ${p} come from the price alone, or from how it drank?`,
      ];
    case "aging":
      return [
        `Useful detail on timing: ${p}. That helps anyone deciding when to open this wine.`,
        vintage !== undefined
          ? `Good to see ${p} spelled out. Do you think the ${vintage} vintage is behind it, or was it more about how the bottle was kept?`
          : `Good to see ${p} spelled out. Do you think it comes from the vintage, or from how the bottle was kept?`,
        `${p} is a helpful pointer. How long would you give it?`,
      ];
    case "serving":
      return [
        `Helpful practical detail: ${p}. Worth knowing before opening a bottle.`,
        `${p} is a useful tip. Did you work that out by trial and error, or follow someone's advice?`,
        `Noting ${p}. What changed once you did that?`,
      ];
    case "style":
      return [
        `You mention ${p}. Is that a style you look for, or did this one surprise you?`,
        `Useful to see ${p} noted. Did it change what you expected from the wine?`,
        `${p} is worth knowing here. How did it show in the glass?`,
      ];
    case "preference":
      return [
        `You say ${p}. What would a wine need to do to land differently for you?`,
        `When you say ${p}, what do you reach for instead?`,
        `Given ${p}, what would the ideal version look like for you?`,
      ];
    case "comparison":
      return [
        `You say ${p}. What was it that made you think of that?`,
        `Thinking about ${p}: where did the wine differ most from that for you?`,
        `${p} is an interesting comparison. Which part of the wine pulled you there?`,
      ];
  }
}

function variantsFor(candidate: Candidate, input: ConversationInput): string[] {
  const focus = candidate.focus;
  switch (focus.kind) {
    case "contrast": {
      const a = q(focus.first.phrase);
      const b = q(focus.second.phrase);
      return [
        `You mention both ${a} and ${b}. Which one stood out more to you?`,
        `Interesting that ${a} and ${b} show up in the same note. Did they feel like they worked together or pulled against each other?`,
        `I'm curious how ${a} sat alongside ${b}. Did one of them lead?`,
      ];
    }
    case "balance": {
      const a = q(focus.first.phrase);
      const b = q(focus.second.phrase);
      return [
        `You mention ${a} and ${b}. How did the two play off each other for you?`,
        `With ${a} and ${b} both in the picture, which one did you notice first?`,
        `Did ${a} and ${b} arrive together, or did one come before the other?`,
      ];
    }
    case "hedge": {
      const o = q(focus.observation.phrase);
      return [
        `What made you a little unsure about ${o}? Was it hard to pin down, or did it change as the glass went on?`,
        `You sound not quite sure about ${o}. Would you want to try it again to decide, or did you settle on a view?`,
        `${o} sounds like it was hard to call. What would settle it for you?`,
      ];
    }
    case "single": {
      const o = q(focus.observation.phrase);
      const specific = SINGLE_BY_THEME[focus.observation.theme];
      return [...(specific ? [specific(o)] : []), ...SINGLE_GENERIC.map((frame) => frame(o))];
    }
    case "rating-gap": {
      const o = q(focus.observation.phrase);
      const direction = focus.reviewerRating < focus.average ? "below" : "above";
      const r = focus.reviewerRating.toFixed(1);
      const a = focus.average.toFixed(1);
      return [
        `You scored it ${r}, well ${direction} the ${a} average, and mention ${o}. Was that the main reason?`,
        `Your ${r} is quite far from the ${a} average. Was ${o} the deciding factor?`,
      ];
    }
    case "insight":
    case "comparison":
      return insightFrames(focus.insight.kind, q(focus.insight.phrase), input.wine.vintage);
    case "my-note": {
      const o = q(focus.observation.phrase);
      const note = ensureSentence(input.myNote ?? "");
      if (!input.myNote?.trim()) return [];
      switch (focus.relation) {
        case "differ":
          return [
            `A different take on ${o}, in case it's useful: ${note}`,
            `That's a fair reading of ${o}. Mine went another way: ${note} Curious what you think.`,
          ];
        case "parallel":
          return [
            `Reading ${o}, here is how it landed for me: ${note} How does that compare with what you noticed?`,
            `${o} is interesting next to my own impression: ${note}`,
          ];
        case "agree":
          return [`On ${o}: ${note}`, `${o} caught my eye. ${note} Did you notice the same?`];
        case "unrelated":
          return [`Your note on ${o} got me thinking. ${note}`, `On ${o}: ${note}`];
      }
    }
  }
}

/**
 * All wording options for a candidate, in a deterministic order that starts
 * at a different frame for different reviews.
 */
export function writeVariants(candidate: Candidate, input: ConversationInput): string[] {
  const variants = variantsFor(candidate, input);
  if (variants.length === 0) return [];
  const start = Number.parseInt(hashString(`${reviewReference(input)}|${candidate.id}`), 36) % variants.length;
  return variants.map((_, index) => variants[(start + index) % variants.length] as string);
}
