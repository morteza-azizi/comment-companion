import { InteractionHistory } from "../domain/interaction-history";

// Local persistence only. In the extension this is chrome.storage.local
// (already declared in the manifest); nothing leaves the browser.

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const HISTORY_KEY = "wine-conversation-history";

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, unknown>();

  public async get(key: string): Promise<unknown> {
    const value = this.data.get(key);
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  public async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

interface ChromeStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

declare const chrome: { storage?: { local?: ChromeStorageArea } } | undefined;

export function chromeLocalStore(): KeyValueStore | undefined {
  const area = typeof chrome !== "undefined" ? chrome?.storage?.local : undefined;
  if (!area) return undefined;
  return {
    get: async (key) => (await area.get(key))[key],
    set: (key, value) => area.set({ [key]: value }),
  };
}

export interface LoadedHistory {
  history: InteractionHistory;
  /** Set when something went wrong that I should know about. */
  notice?: string;
  persistent: boolean;
}

export class HistoryStore {
  private readonly store: KeyValueStore | undefined;

  public constructor(store: KeyValueStore | undefined) {
    this.store = store;
  }

  public get persistent(): boolean {
    return this.store !== undefined;
  }

  public async load(): Promise<LoadedHistory> {
    if (!this.store) {
      return {
        history: new InteractionHistory(),
        persistent: false,
        notice: "History can't be saved here, so it only lasts until this page closes.",
      };
    }
    try {
      const { history, dropped, unreadable } = InteractionHistory.fromUnknown(await this.store.get(HISTORY_KEY));
      if (unreadable) {
        return { history, persistent: true, notice: "Saved history could not be read, so it was reset." };
      }
      return dropped > 0
        ? { history, persistent: true, notice: `${dropped} damaged history entr${dropped === 1 ? "y was" : "ies were"} skipped.` }
        : { history, persistent: true };
    } catch {
      return {
        history: new InteractionHistory(),
        persistent: false,
        notice: "Saved history could not be loaded. Suggestions still work, but history won't be saved.",
      };
    }
  }

  /** Returns false when saving failed, so the caller can tell me. */
  public async save(history: InteractionHistory): Promise<boolean> {
    if (!this.store) return false;
    try {
      await this.store.set(HISTORY_KEY, history.toJSON());
      return true;
    } catch {
      return false;
    }
  }
}
