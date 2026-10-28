import { describe, expect, it } from "vitest";
import { checkQuality, type GateContext } from "./quality-gate";

function context(overrides: Partial<GateContext> = {}): GateContext {
  return {
    candidate: { anchors: ["grippy tannins"] },
    input: { wine: { wineName: "Ribera", vintage: 2019 }, review: { text: "Grippy tannins, long finish." } },
    analysis: { text: "Grippy tannins, long finish." },
    ...overrides,
  };
}

const GOOD = "Did “grippy tannins” change as the glass sat, or stay the same?";

describe("quality gate", () => {
  it("passes a specific, grounded question", () => {
    expect(checkQuality(GOOD, context())).toEqual({ passed: true, failures: [] });
  });

  it("rejects empty comments", () => {
    expect(checkQuality("   ", context()).failures).toEqual(["empty"]);
  });

  it("rejects generic praise", () => {
    const result = checkQuality("Great review, thanks for sharing! Love this wine. Cheers!", context());
    expect(result.failures).toContain("generic");
  });

  it("requires a reference to a detail in the review", () => {
    const result = checkQuality("Did it change as the glass sat, or stay the same for you?", context());
    expect(result.failures).toContain("not_anchored");
  });

  it("rejects comments that only repeat the reviewer", () => {
    const result = checkQuality("Grippy tannins, long finish.", context());
    expect(result.failures).toContain("echo");
  });

  it("rejects overly long comments", () => {
    const long = `“grippy tannins” ${"and more words here ".repeat(20)}?`;
    expect(checkQuality(long, context()).failures).toContain("too_long");
  });

  it.each([
    "I tried this last month and “grippy tannins” were softer for me.",
    "I agree, “grippy tannins” were the first thing I noticed too.",
    "Same here, “grippy tannins” all the way, and my favourite bottle of the year.",
    "When I had it, the “grippy tannins” faded after an hour.",
  ])("rejects an invented personal experience: %s", (comment) => {
    expect(checkQuality(comment, context()).failures).toContain("invented_experience");
  });

  it("rejects 'for me' / 'mine' style claims when I wrote no note", () => {
    expect(checkQuality("Mine was different on the “grippy tannins”, honestly.", context()).failures).toContain(
      "invented_experience",
    );
  });

  it("does not mistake the reviewer's quoted first-person words for my own claim", () => {
    const quoted = context({
      candidate: { anchors: ["not for me"] },
      analysis: { text: "Not for me. Too sweet." },
      input: { wine: {}, review: { text: "Not for me. Too sweet." } },
    });
    const result = checkQuality("You say “Not for me”. What would a wine need to do to land differently for you?", quoted);
    expect(result.failures).toEqual([]);
  });

  it("allows first-person claims only inside my own note, verbatim", () => {
    const withNote = context({
      input: {
        wine: {},
        review: { text: "Grippy tannins, long finish." },
        myNote: "I found the tannins softer after an hour.",
      },
    });
    const ok = checkQuality("On “grippy tannins”: I found the tannins softer after an hour.", withNote);
    expect(ok.failures).not.toContain("invented_experience");

    const extra = checkQuality(
      "On “grippy tannins”: I found the tannins softer after an hour. I also tried it last year.",
      withNote,
    );
    expect(extra.failures).toContain("invented_experience");
  });

  it("rejects a tasting characteristic nobody stated", () => {
    const result = checkQuality("Is the “grippy tannins” part of why it feels so smooth and silky?", context());
    expect(result.failures).toContain("invented_characteristic");
  });

  it("accepts descriptors that appear in the review or in my note", () => {
    const withNote = context({
      input: { wine: {}, review: { text: "Grippy tannins, long finish." }, myNote: "I noticed it a bit silky." },
    });
    expect(checkQuality("Did “grippy tannins” sit alongside silky for anyone?", withNote).failures).not.toContain(
      "invented_characteristic",
    );
  });

  it("rejects encyclopedic generalisations", () => {
    const result = checkQuality("Wines like this are typically tannic, so “grippy tannins” makes sense, right?", context());
    expect(result.failures).toContain("unsupported_generalization");
  });

  it("rejects wording that repeats a recent comment", () => {
    const result = checkQuality(GOOD, context({ recentComments: ["Did “firm structure” change as the glass sat, or stay the same?"] }));
    expect(result.failures).toContain("repeated_wording");
  });
});
