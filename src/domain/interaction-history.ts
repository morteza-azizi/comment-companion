import type { PastUse } from "./angle-fingerprint";
import type { ConversationDimension } from "./tasting-lexicon";
import { RECOMMENDATION_LABEL, type InteractionType, type Recommendation } from "./opportunity";

export type ChosenAction = "none" | "copied" | "edited_copied" | "skipped";

/**
 * One reviewed review. `replyReceived` and `meaningful` are only ever set when
 * I record them myself: the tool cannot see replies, so absent means unknown.
 */
export interface InteractionRecord {
  reference: string;
  wine: string;
  processedAt: number;
  updatedAt: number;
  recommended: Recommendation;
  type?: InteractionType;
  dimension?: ConversationDimension;
  concepts: string[];
  /** The comment last suggested (or the edited text I copied). */
  comment?: string;
  action: ChosenAction;
  /** I copied the suggestion, so it counts as something I said. */
  used: boolean;
  anglesTried: number;
  replyReceived?: boolean;
  meaningful?: boolean;
}

export interface StoredHistory {
  version: 1;
  records: InteractionRecord[];
}

export const HISTORY_VERSION = 1;
export const MAX_RECORDS = 500;

const RECOMMENDATIONS = new Set<string>(Object.keys(RECOMMENDATION_LABEL));
const ACTIONS = new Set<string>(["none", "copied", "edited_copied", "skipped"]);
const DIMENSIONS = new Set<string>(["tasting", "food", "vintage", "value", "comparison", "aging", "preference", "style", "serving"]);

export class InteractionHistory {
  private records: InteractionRecord[];

  public constructor(records: readonly InteractionRecord[] = []) {
    this.records = records.slice(-MAX_RECORDS);
  }

  public get size(): number {
    return this.records.length;
  }

  public all(): readonly InteractionRecord[] {
    return [...this.records];
  }

  public get(reference: string): InteractionRecord | undefined {
    return this.records.find((record) => record.reference === reference);
  }

  /** Adds or replaces the record for this review. */
  public upsert(record: InteractionRecord): void {
    const index = this.records.findIndex((existing) => existing.reference === record.reference);
    if (index === -1) this.records.push(record);
    else this.records[index] = record;
    this.records = this.records.slice(-MAX_RECORDS);
  }

  public update(reference: string, patch: Partial<InteractionRecord>, now = Date.now()): InteractionRecord | undefined {
    const existing = this.get(reference);
    if (!existing) return undefined;
    const next: InteractionRecord = { ...existing, ...patch, reference, updatedAt: now };
    next.used = next.action === "copied" || next.action === "edited_copied";
    this.upsert(next);
    return next;
  }

  /** Comments I actually used, oldest first. These drive repetition checks. */
  public pastUses(exceptReference?: string): PastUse[] {
    return this.records
      .filter((record) => record.used && record.type && record.dimension && record.reference !== exceptReference)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((record) => ({
        type: record.type as string,
        dimension: record.dimension as string,
        concepts: record.concepts,
        comment: record.comment,
        at: record.updatedAt,
      }));
  }

  public toJSON(): StoredHistory {
    return { version: HISTORY_VERSION, records: [...this.records] };
  }

  /**
   * Rebuilds a history from whatever was stored. Corrupt or unknown data
   * never throws: bad records are dropped and counted.
   */
  public static fromUnknown(data: unknown): { history: InteractionHistory; dropped: number; unreadable: boolean } {
    if (data === undefined || data === null) return { history: new InteractionHistory(), dropped: 0, unreadable: false };
    const list = isObject(data) && Array.isArray(data.records) ? (data.records as unknown[]) : undefined;
    if (!list || (isObject(data) && data.version !== HISTORY_VERSION)) {
      return { history: new InteractionHistory(), dropped: 0, unreadable: true };
    }
    const records: InteractionRecord[] = [];
    let dropped = 0;
    for (const item of list) {
      const record = sanitizeRecord(item);
      if (record) records.push(record);
      else dropped += 1;
    }
    return { history: new InteractionHistory(records), dropped, unreadable: false };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeRecord(value: unknown): InteractionRecord | undefined {
  if (!isObject(value)) return undefined;
  const { reference, wine, processedAt, updatedAt, recommended, action } = value;
  if (typeof reference !== "string" || !reference) return undefined;
  if (typeof recommended !== "string" || !RECOMMENDATIONS.has(recommended)) return undefined;
  if (typeof action !== "string" || !ACTIONS.has(action)) return undefined;
  if (typeof processedAt !== "number" || !Number.isFinite(processedAt)) return undefined;

  const type =
    typeof value.type === "string" &&
    RECOMMENDATIONS.has(value.type) &&
    value.type !== "SKIP" &&
    value.type !== "REQUEST_MORE_CONTEXT"
      ? (value.type as InteractionType)
      : undefined;
  const dimension =
    typeof value.dimension === "string" && DIMENSIONS.has(value.dimension) ? (value.dimension as ConversationDimension) : undefined;
  const concepts = Array.isArray(value.concepts)
    ? value.concepts.filter((item): item is string => typeof item === "string").slice(0, 10)
    : [];

  return {
    reference,
    wine: typeof wine === "string" ? wine.slice(0, 200) : "",
    processedAt,
    updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : processedAt,
    recommended: recommended as Recommendation,
    type,
    dimension,
    concepts,
    comment: typeof value.comment === "string" ? value.comment.slice(0, 1000) : undefined,
    action: action as ChosenAction,
    used: action === "copied" || action === "edited_copied",
    anglesTried: typeof value.anglesTried === "number" && Number.isFinite(value.anglesTried) ? value.anglesTried : 1,
    replyReceived: typeof value.replyReceived === "boolean" ? value.replyReceived : undefined,
    meaningful: typeof value.meaningful === "boolean" ? value.meaningful : undefined,
  };
}

export interface PatternLine {
  label: string;
  used: number;
  outcomesRecorded: number;
  replies: number;
  meaningful: number;
}

/**
 * What worked, based ONLY on outcomes I recorded myself. Comments with no
 * recorded outcome are counted as used but never as "no reply".
 */
export function summarizePatterns(history: InteractionHistory): { lines: PatternLine[]; note: string } {
  const byType = new Map<InteractionType, PatternLine>();
  for (const record of history.all()) {
    if (!record.used || !record.type) continue;
    const line = byType.get(record.type) ?? {
      label: RECOMMENDATION_LABEL[record.type],
      used: 0,
      outcomesRecorded: 0,
      replies: 0,
      meaningful: 0,
    };
    line.used += 1;
    if (record.replyReceived !== undefined || record.meaningful !== undefined) line.outcomesRecorded += 1;
    if (record.replyReceived) line.replies += 1;
    if (record.meaningful) line.meaningful += 1;
    byType.set(record.type, line);
  }
  const lines = [...byType.values()].sort((a, b) => b.meaningful - a.meaningful || b.used - a.used);
  const recorded = lines.reduce((sum, line) => sum + line.outcomesRecorded, 0);
  const note =
    lines.length === 0
      ? "Nothing used yet."
      : recorded < 3
        ? "Too few recorded outcomes to say what works. Record whether replies came and whether they were meaningful."
        : `Based on ${recorded} outcomes you recorded yourself.`;
  return { lines, note };
}
