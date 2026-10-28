import { describe, expect, it } from "vitest";
import type { ConversationInput } from "../domain/wine-context";
import { HistoryStore, MemoryStore } from "./history-store";
import { WorkspaceController } from "./workspace-controller";

function setup(copyResult = true) {
  const backing = new MemoryStore();
  const copied: string[] = [];
  let clock = 1_000_000;
  const make = () =>
    new WorkspaceController({
      store: new HistoryStore(backing),
      copy: async (text) => {
        copied.push(text);
        return copyResult;
      },
      now: () => (clock += 1000),
    });
  return { backing, copied, make };
}

const REVIEW: ConversationInput = {
  wine: { wineName: "Cosecha", producer: "Pagos", vintage: 2019 },
  review: { text: "Grippy tannins, long finish.", reviewer: "Anna" },
};

describe("WorkspaceController", () => {
  it("analyzes, records what was shown, and persists it", async () => {
    const { make, backing } = setup();
    const controller = make();
    const suggestion = await controller.analyze(REVIEW);
    expect(suggestion.comment).toBeTruthy();
    const record = controller.existing;
    expect(record).toMatchObject({ action: "none", used: false, recommended: suggestion.recommendation, anglesTried: 1 });
    expect(record?.replyReceived).toBeUndefined();

    const reloaded = make();
    await reloaded.init();
    expect(reloaded.history.get(suggestion.reference)).toEqual(record);
    expect(backing).toBeDefined();
  });

  it("copy sends the text to the clipboard only, and records that it was used", async () => {
    const { make, copied } = setup();
    const controller = make();
    const suggestion = await controller.analyze(REVIEW);
    const result = await controller.copyComment(suggestion.comment as string);
    expect(result.copied).toBe(true);
    expect(copied).toEqual([suggestion.comment]);
    expect(controller.existing).toMatchObject({ action: "copied", used: true });
  });

  it("records an edited copy as edited, with the final text", async () => {
    const { make, copied } = setup();
    const controller = make();
    await controller.analyze(REVIEW);
    await controller.copyComment("My own wording about grippy tannins?");
    expect(copied).toEqual(["My own wording about grippy tannins?"]);
    expect(controller.existing).toMatchObject({ action: "edited_copied", used: true, comment: "My own wording about grippy tannins?" });
  });

  it("does not mark anything as used when copying fails", async () => {
    const { make } = setup(false);
    const controller = make();
    const suggestion = await controller.analyze(REVIEW);
    expect((await controller.copyComment(suggestion.comment as string)).copied).toBe(false);
    expect(controller.existing?.used).toBe(false);
  });

  it("skip records the decision without using the suggestion", async () => {
    const { make } = setup();
    const controller = make();
    await controller.analyze(REVIEW);
    await controller.skip();
    expect(controller.existing).toMatchObject({ action: "skipped", used: false });
    expect(controller.history.pastUses()).toEqual([]);
  });

  it("records outcomes only when I provide them", async () => {
    const { make } = setup();
    const controller = make();
    const suggestion = await controller.analyze(REVIEW);
    await controller.copyComment(suggestion.comment as string);
    expect(controller.existing?.replyReceived).toBeUndefined();
    await controller.recordOutcome({ replyReceived: true });
    expect(controller.existing).toMatchObject({ replyReceived: true });
    expect(controller.existing?.meaningful).toBeUndefined();
    await controller.recordOutcome({ meaningful: true });
    expect(controller.existing).toMatchObject({ replyReceived: true, meaningful: true });
    expect(controller.patterns().lines[0]).toMatchObject({ used: 1, outcomesRecorded: 1, replies: 1, meaningful: 1 });
  });

  it("walks through other angles and remembers how many it tried", async () => {
    const { make } = setup();
    const controller = make();
    const input: ConversationInput = {
      ...REVIEW,
      review: { text: "Grippy tannins, long finish. Reminds me of a Barolo. Great value for the price." },
    };
    const first = await controller.analyze(input);
    const second = await controller.anotherAngle();
    expect(second?.candidate?.id).not.toBe(first.candidate?.id);
    expect(controller.existing?.anglesTried).toBe(2);
    expect(controller.existing?.comment).toBe(second?.comment);
  });

  it("uses past copied comments to avoid repeating the same idea", async () => {
    const { make } = setup();
    const controller = make();
    const first = await controller.analyze({ wine: { wineName: "A" }, review: { text: "Grippy tannins on this one." } });
    await controller.copyComment(first.comment as string);

    const second = await controller.analyze({ wine: { wineName: "B" }, review: { text: "Quite tannic and astringent." } });
    expect(second.recommendation).toBe("SKIP");
    expect(second.reason).toMatch(/same kind of comment/);
  });

  it("re-analyzing a review I already used does not overwrite what I used", async () => {
    const { make } = setup();
    const controller = make();
    const first = await controller.analyze(REVIEW);
    await controller.copyComment(first.comment as string);
    await controller.analyze(REVIEW);
    expect(controller.existing).toMatchObject({ used: true, comment: first.comment });
    expect(controller.notice).toMatch(/already used/);
  });

  it("works, with a notice, when storage is unavailable", async () => {
    const controller = new WorkspaceController({ store: new HistoryStore(undefined), copy: async () => true });
    const suggestion = await controller.analyze(REVIEW);
    expect(suggestion.comment).toBeTruthy();
    expect(controller.notice).toMatch(/only lasts until this page closes/);
  });
});
