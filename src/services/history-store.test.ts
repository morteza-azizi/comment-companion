import { describe, expect, it } from "vitest";
import { InteractionHistory } from "../domain/interaction-history";
import { HISTORY_KEY, HistoryStore, MemoryStore, type KeyValueStore } from "./history-store";

const sample = new InteractionHistory([
  {
    reference: "r1",
    wine: "Wine",
    processedAt: 1,
    updatedAt: 1,
    recommended: "SKIP",
    concepts: [],
    action: "none",
    used: false,
    anglesTried: 1,
  },
]);

describe("HistoryStore", () => {
  it("saves and reloads history", async () => {
    const backing = new MemoryStore();
    const store = new HistoryStore(backing);
    expect(await store.save(sample)).toBe(true);
    const loaded = await new HistoryStore(backing).load();
    expect(loaded.history.all()).toEqual(sample.all());
    expect(loaded.notice).toBeUndefined();
    expect(loaded.persistent).toBe(true);
  });

  it("starts empty on first run", async () => {
    const loaded = await new HistoryStore(new MemoryStore()).load();
    expect(loaded.history.size).toBe(0);
    expect(loaded.notice).toBeUndefined();
  });

  it("recovers from corrupted storage and says so", async () => {
    const backing = new MemoryStore();
    await backing.set(HISTORY_KEY, "{not what we wrote");
    const loaded = await new HistoryStore(backing).load();
    expect(loaded.history.size).toBe(0);
    expect(loaded.notice).toMatch(/could not be read/);
  });

  it("keeps readable entries and reports damaged ones", async () => {
    const backing = new MemoryStore();
    await backing.set(HISTORY_KEY, { version: 1, records: [...sample.toJSON().records, { broken: true }] });
    const loaded = await new HistoryStore(backing).load();
    expect(loaded.history.size).toBe(1);
    expect(loaded.notice).toMatch(/1 damaged history entry was skipped/);
  });

  it("survives a storage that throws on read", async () => {
    const failing: KeyValueStore = {
      get: () => Promise.reject(new Error("boom")),
      set: () => Promise.resolve(),
    };
    const loaded = await new HistoryStore(failing).load();
    expect(loaded.history.size).toBe(0);
    expect(loaded.notice).toMatch(/could not be loaded/);
  });

  it("reports a failed save instead of throwing", async () => {
    const failing: KeyValueStore = {
      get: () => Promise.resolve(undefined),
      set: () => Promise.reject(new Error("quota")),
    };
    expect(await new HistoryStore(failing).save(sample)).toBe(false);
  });

  it("works without any storage, and says history will not be kept", async () => {
    const store = new HistoryStore(undefined);
    const loaded = await store.load();
    expect(loaded.persistent).toBe(false);
    expect(loaded.notice).toMatch(/only lasts until this page closes/);
    expect(await store.save(sample)).toBe(false);
  });
});
