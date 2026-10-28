import { describe, expect, it } from "vitest";
import { findObservations } from "../domain/review-analysis";
import { checkQuality } from "../domain/quality-gate";
import type { ConversationInput } from "../domain/wine-context";
import { suggest, type Suggestion } from "./conversation-companion";

const DAY = 86_400_000;

function input(text: string, extra: Partial<ConversationInput> = {}, rating?: number): ConversationInput {
  return {
    wine: { wineName: "Ribera Cosecha", producer: "Pagos", vintage: 2019, rating: 4.1 },
    review: { text, rating },
    ...extra,
  };
}

const FIRST_PERSON =
  /\bI(?:'ve| have| had)?\s+(?:tasted|tried|had|drank|opened|loved|liked|enjoyed|found|noticed|think|prefer)\b|\bmy (?:favou?rite|experience|bottle)\b|\bsame here\b|\bme too\b/i;

// A spread of realistic review shapes, used for the safety properties below.
const CORPUS: string[] = [
  "Quite acidic but the red cherry fruit balances it nicely. Needs food.",
  "Grippy tannins, long finish. Decanted for an hour and it opened up. Reminds me of a Barolo.",
  "Not very sweet, smells of vanilla and toasty oak, a bit too much for me",
  "Great value for the price, went well with grilled lamb. Fresh and crisp.",
  "Too young, needs more time in the cellar. Tannic.",
  "Soft tannins and juicy fruit, easy to drink",
  "Maybe a little oaky? Plum and pepper on the nose, short finish.",
  "Skin contact white, funky and herbal, not my style.",
  "Light and delicate but surprisingly long finish.",
  "Bone dry, mineral, slightly salty. Better than the 2018.",
];

describe("suggest — deciding whether to engage", () => {
  it("recommends SKIP for a generic review", () => {
    const result = suggest(input("Great wine, love it!", {}, 4.5));
    expect(result.recommendation).toBe("SKIP");
    expect(result.comment).toBeUndefined();
    expect(result.reason).toMatch(/general praise|very short/);
  });

  it("asks for more context when there is no review text", () => {
    const result = suggest(input(""));
    expect(result.recommendation).toBe("REQUEST_MORE_CONTEXT");
    expect(result.comment).toBeUndefined();
  });

  it("asks for more context when the only text looks cut off", () => {
    const result = suggest(input("What a lovely evening with friends and…"));
    expect(["REQUEST_MORE_CONTEXT", "SKIP"]).toContain(result.recommendation);
    expect(result.comment).toBeUndefined();
  });

  it("skips a long note it cannot interpret instead of inventing a point", () => {
    const result = suggest(input("Smelled like a damp basement in the mountains after the rainstorm yesterday morning."));
    expect(result.recommendation).toBe("SKIP");
    expect(result.comment).toBeUndefined();
  });

  it("does not quiz someone about a faulty bottle", () => {
    const result = suggest(input("Corked, unfortunately."));
    expect(result.recommendation).toBe("SKIP");
    expect(result.comment).toBeUndefined();
  });

  it("reads a price the reviewer states, quoting it exactly", () => {
    const result = suggest(input("I paid 12 euros and it was worth every cent."));
    expect(result.recommendation).toBe("ASK_SPECIFIC_QUESTION");
    expect(result.candidate?.dimension).toBe("value");
    expect(result.comment).toContain("12 euros");
  });

  it("treats a stated preference as its own conversation dimension", () => {
    const result = suggest(input("Not for me. Too sweet."));
    expect(result.candidate?.dimension).toBe("preference");
    expect(result.comment).toContain("Not for me");
  });

  it("produces a specific question from a tasting observation", () => {
    const result = suggest(input("Lots of grippy tannins on this one."));
    expect(result.recommendation).toBe("ASK_SPECIFIC_QUESTION");
    expect(result.comment).toContain("grippy tannins");
    expect(result.comment).toMatch(/\?/);
  });

  it("explores a real contrast in the review", () => {
    const result = suggest(input("Light in colour but surprisingly tannic."));
    expect(result.recommendation).toBe("EXPLORE_DIFFERENCE");
    expect(result.comment).toMatch(/Light/);
    expect(result.comment).toMatch(/tannic/);
  });

  it("asks how two descriptors balance when the reviewer says they do", () => {
    const result = suggest(input("Quite acidic but the red cherry fruit balances it nicely."));
    expect(result.recommendation).toBe("ASK_SPECIFIC_QUESTION");
    expect(result.candidate?.concepts).toContain("balance");
    expect(result.comment).toMatch(/acidic/);
    expect(result.comment).toMatch(/cherry fruit/);
  });

  it("acknowledges a practical insight with the reviewer's own words", () => {
    const result = suggest(input("Too young, needs more time in the cellar."));
    expect(result.recommendation).toBe("ACKNOWLEDGE_INSIGHT");
    expect(result.comment).toContain("Too young");
  });

  it("compares perspectives when the reviewer draws a comparison", () => {
    const result = suggest(input("Reminds me of a Rioja, in a good way."));
    expect(result.recommendation).toBe("COMPARE_PERSPECTIVES");
    expect(result.comment).toContain("Reminds me of a Rioja");
  });

  it("returns at most one comment", () => {
    for (const text of CORPUS) {
      const result = suggest(input(text));
      expect(typeof (result.comment ?? "")).toBe("string");
      expect((result.comment ?? "").match(/\n/)).toBeNull();
    }
  });
});

describe("suggest — my own experience", () => {
  const review = "Soft tannins and juicy fruit, easy to drink.";

  it("never offers a first-person observation without my note", () => {
    for (const text of CORPUS) {
      const result = suggest(input(text));
      if (result.comment) expect(result.comment, text).not.toMatch(FIRST_PERSON);
      expect(["SHARE_OBSERVATION", "RESPECTFULLY_DISAGREE"]).not.toContain(result.recommendation);
    }
  });

  it("shares an observation only when my note agrees on the same point", () => {
    const result = suggest(input(review, { myNote: "I found the tannins soft too, even young." }));
    expect(result.recommendation).toBe("SHARE_OBSERVATION");
    expect(result.comment).toContain("I found the tannins soft too, even young.");
  });

  it("disagrees respectfully only when my note really points the other way", () => {
    const result = suggest(input(review, { myNote: "I found the tannins grippy even after an hour." }));
    expect(result.recommendation).toBe("RESPECTFULLY_DISAGREE");
    expect(result.comment).toContain("I found the tannins grippy even after an hour.");
    expect(result.comment).toContain("Soft tannins");
  });

  it("compares perspectives when my note describes the same theme differently", () => {
    const result = suggest(input(review, { myNote: "I noticed more plum than cherry." }));
    expect(result.recommendation).toBe("COMPARE_PERSPECTIVES");
    expect(result.comment).toContain("I noticed more plum than cherry.");
  });

  it("keeps my note word for word and adds nothing else in the first person", () => {
    const note = "I found the tannins grippy even after an hour.";
    const result = suggest(input(review, { myNote: note }));
    const withoutNote = (result.comment ?? "").replace(note.replace(/\.$/, ""), "");
    expect(withoutNote).not.toMatch(FIRST_PERSON);
  });
});

describe("suggest — nothing fabricated about the wine", () => {
  it("never states a tasting descriptor that is not in the review, my note, or the wine details", () => {
    for (const text of CORPUS) {
      for (const myNote of [undefined, "I noticed more plum than cherry."]) {
        const data = input(text, { myNote });
        let result: Suggestion = suggest(data);
        const seen: string[] = [];
        // Walk through every angle the tool is willing to offer.
        while (result.candidate) {
          seen.push(result.candidate.id);
          const comment = result.comment ?? "";
          const sources = `${text} ${myNote ?? ""} ${data.wine.wineName} ${data.wine.producer}`.toLowerCase().replace(/-/g, " ");
          for (const observation of findObservations(comment)) {
            expect(sources, `${text} -> ${comment}`).toContain(observation.phrase.toLowerCase().replace(/-/g, " "));
          }
          result = suggest(data, { skipIds: seen });
        }
      }
    }
  });

  it("works with no wine metadata at all and never prints 'undefined'", () => {
    const result = suggest({ wine: {}, review: { text: "Grippy tannins and a long finish." } });
    expect(result.comment).toBeTruthy();
    expect(result.comment).not.toMatch(/undefined|null|NaN/);
  });

  it("does not use wine facts it was not given", () => {
    const result = suggest({ wine: {}, review: { text: "Too young, needs more time." } });
    expect(result.comment).not.toMatch(/\b(?:19|20)\d{2}\b/);
  });
});

describe("suggest — different conversational angles", () => {
  const review = "Grippy tannins, long finish. Reminds me of a Barolo. Great value for the price.";

  it("offers different angles for the same review when asked", () => {
    const first = suggest(input(review));
    const shown = [first.candidate?.id as string];
    const second = suggest(input(review), { skipIds: shown });
    shown.push(second.candidate?.id as string);
    const third = suggest(input(review), { skipIds: shown });

    expect(new Set(shown).size).toBe(2);
    expect(third.candidate?.id).not.toBe(first.candidate?.id);
    expect(third.candidate?.id).not.toBe(second.candidate?.id);
    expect(first.comment).not.toBe(second.comment);
    expect(second.comment).not.toBe(third.comment);
    expect(first.anglesLeft).toBeGreaterThan(second.anglesLeft);
  });

  it("runs out of angles honestly", () => {
    const shown: string[] = [];
    let result = suggest(input(review));
    while (result.candidate) {
      shown.push(result.candidate.id);
      result = suggest(input(review), { skipIds: shown });
    }
    expect(result.recommendation).toBe("SKIP");
    expect(result.reason).toMatch(/no other honest angles/);
    expect(shown.length).toBeGreaterThan(2);
  });

  it("is deterministic for the same review", () => {
    expect(suggest(input(review)).comment).toBe(suggest(input(review)).comment);
  });
});

describe("suggest — repetition", () => {
  const now = 1_000_000_000_000;
  const tannins = "Grippy tannins on this one.";
  const otherTannins = "Quite tannic and astringent, honestly.";

  it("blocks the same kind of comment about the same concept", () => {
    const first = suggest(input(tannins), { now });
    expect(first.recommendation).toBe("ASK_SPECIFIC_QUESTION");
    const uses = [
      {
        type: first.candidate?.type as string,
        dimension: first.candidate?.dimension as string,
        concepts: first.candidate?.concepts as string[],
        comment: first.comment,
        at: now - DAY,
      },
    ];
    const second = suggest(input(otherTannins), { uses, now });
    expect(second.recommendation).toBe("SKIP");
    expect(second.reason).toMatch(/same kind of comment/);
  });

  it("blocks reused wording even when the quoted words differ", () => {
    const first = suggest(input(tannins), { now });
    const uses = [
      { type: "OTHER", dimension: "food", concepts: ["x"], comment: first.comment as string, at: now - DAY },
    ];
    const again = suggest(input("Lots of grippy tannins."), { uses, now });
    // Same idea, same skeleton: must not come back as the same text.
    expect(again.comment ?? "").not.toBe(first.comment);
  });

  it("allows the same topic reached by a different angle", () => {
    const first = suggest(input(tannins), { now });
    const uses = [
      {
        type: first.candidate?.type as string,
        dimension: first.candidate?.dimension as string,
        concepts: first.candidate?.concepts as string[],
        comment: first.comment,
        at: now - DAY,
      },
    ];
    const second = suggest(input("Light in colour but surprisingly tannic."), { uses, now });
    expect(second.recommendation).toBe("EXPLORE_DIFFERENCE");
    expect(second.repetition).toBe("SAME_TOPIC_NEW_ANGLE");
  });

  it("forgets old uses", () => {
    const first = suggest(input(tannins), { now });
    const uses = [
      {
        type: first.candidate?.type as string,
        dimension: first.candidate?.dimension as string,
        concepts: first.candidate?.concepts as string[],
        comment: first.comment,
        at: now - 60 * DAY,
      },
    ];
    expect(suggest(input(otherTannins), { uses, now }).recommendation).toBe("ASK_SPECIFIC_QUESTION");
  });

  it("every comment it writes passes its own quality gate", () => {
    for (const text of CORPUS) {
      const data = input(text);
      const result = suggest(data);
      if (!result.comment || !result.candidate) continue;
      const gate = checkQuality(result.comment, { candidate: result.candidate, input: data, analysis: result.analysis });
      expect(gate.failures, `${text} -> ${result.comment}`).toEqual([]);
    }
  });
});
