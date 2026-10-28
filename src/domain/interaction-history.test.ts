import { describe, expect, it } from "vitest";
import { InteractionHistory, MAX_RECORDS, summarizePatterns, type InteractionRecord } from "./interaction-history";

function record(overrides: Partial<InteractionRecord> = {}): InteractionRecord {
  return {
    reference: "wine#reviewer#abc",
    wine: "Test wine",
    processedAt: 1000,
    updatedAt: 1000,
    recommended: "ASK_SPECIFIC_QUESTION",
    type: "ASK_SPECIFIC_QUESTION",
    dimension: "tasting",
    concepts: ["tannin"],
    comment: "Did “grippy tannins” change?",
    action: "none",
    used: false,
    anglesTried: 1,
    ...overrides,
  };
}

describe("InteractionHistory", () => {
  it("upserts one record per review", () => {
    const history = new InteractionHistory();
    history.upsert(record());
    history.upsert(record({ comment: "changed" }));
    expect(history.size).toBe(1);
    expect(history.get("wine#reviewer#abc")?.comment).toBe("changed");
  });

  it("marks a record as used only when the comment was copied", () => {
    const history = new InteractionHistory([record()]);
    expect(history.pastUses()).toEqual([]);
    history.update("wine#reviewer#abc", { action: "copied" }, 2000);
    expect(history.pastUses()).toHaveLength(1);
    history.update("wine#reviewer#abc", { action: "skipped" }, 3000);
    expect(history.pastUses()).toEqual([]);
  });

  it("can exclude one review from past uses", () => {
    const history = new InteractionHistory([record({ action: "copied", used: true })]);
    expect(history.pastUses("wine#reviewer#abc")).toEqual([]);
  });

  it("does not invent outcomes", () => {
    const history = new InteractionHistory([record({ action: "copied", used: true })]);
    const stored = history.get("wine#reviewer#abc");
    expect(stored?.replyReceived).toBeUndefined();
    expect(stored?.meaningful).toBeUndefined();
  });

  it("keeps at most MAX_RECORDS, dropping the oldest", () => {
    const history = new InteractionHistory();
    for (let index = 0; index < MAX_RECORDS + 5; index += 1) history.upsert(record({ reference: `r${index}` }));
    expect(history.size).toBe(MAX_RECORDS);
    expect(history.get("r0")).toBeUndefined();
    expect(history.get(`r${MAX_RECORDS + 4}`)).toBeDefined();
  });

  it("round-trips through JSON", () => {
    const history = new InteractionHistory([record({ action: "edited_copied", used: true, replyReceived: true, meaningful: false })]);
    const restored = InteractionHistory.fromUnknown(JSON.parse(JSON.stringify(history.toJSON())));
    expect(restored.dropped).toBe(0);
    expect(restored.history.all()).toEqual(history.all());
  });
});

describe("InteractionHistory.fromUnknown (recovery)", () => {
  it("starts empty when nothing was stored", () => {
    expect(InteractionHistory.fromUnknown(undefined)).toMatchObject({ dropped: 0, unreadable: false });
  });

  it.each([["garbage"], [42], [[1, 2, 3]], [{ version: 99, records: [] }], [{ version: 1 }]])(
    "reports unreadable data without throwing: %j",
    (data) => {
      const result = InteractionHistory.fromUnknown(data);
      expect(result.unreadable).toBe(true);
      expect(result.history.size).toBe(0);
    },
  );

  it("keeps good records and drops damaged ones", () => {
    const good = record();
    const result = InteractionHistory.fromUnknown({
      version: 1,
      records: [
        good,
        null,
        "nope",
        { ...good, reference: "" },
        { ...good, reference: "x", recommended: "FLATTER" },
        { ...good, reference: "y", action: "posted" },
        { ...good, reference: "z", processedAt: "yesterday" },
        { ...good, reference: "ok", replyReceived: "yes", concepts: ["a", 3, "b"], comment: "c".repeat(5000) },
      ],
    });
    expect(result.dropped).toBe(6);
    expect(result.history.all().map((item) => item.reference)).toEqual(["wine#reviewer#abc", "ok"]);
    const sanitized = result.history.get("ok");
    expect(sanitized?.replyReceived).toBeUndefined();
    expect(sanitized?.concepts).toEqual(["a", "b"]);
    expect(sanitized?.comment).toHaveLength(1000);
  });

  it("derives 'used' from the action, not from stored data", () => {
    const result = InteractionHistory.fromUnknown({ version: 1, records: [record({ used: true, action: "skipped" })] });
    expect(result.history.all()[0]?.used).toBe(false);
  });
});

describe("summarizePatterns", () => {
  it("says so when nothing has been used or recorded", () => {
    expect(summarizePatterns(new InteractionHistory()).note).toBe("Nothing used yet.");
    const used = new InteractionHistory([record({ action: "copied", used: true })]);
    expect(summarizePatterns(used).note).toMatch(/Too few recorded outcomes/);
  });

  it("counts only outcomes I recorded, never assuming 'no reply'", () => {
    const history = new InteractionHistory([
      record({ reference: "a", action: "copied", used: true, replyReceived: true, meaningful: true }),
      record({ reference: "b", action: "copied", used: true, replyReceived: false }),
      record({ reference: "c", action: "copied", used: true }),
      record({ reference: "d", type: "COMPARE_PERSPECTIVES", action: "copied", used: true, replyReceived: true, meaningful: true }),
    ]);
    const { lines, note } = summarizePatterns(history);
    const ask = lines.find((line) => line.label === "Ask a specific question");
    expect(ask).toMatchObject({ used: 3, outcomesRecorded: 2, replies: 1, meaningful: 1 });
    expect(note).toMatch(/Based on 3 outcomes you recorded yourself/);
  });

  it("ignores suggestions I did not use", () => {
    const history = new InteractionHistory([record({ action: "skipped" }), record({ reference: "n", action: "none" })]);
    expect(summarizePatterns(history).lines).toEqual([]);
  });
});
