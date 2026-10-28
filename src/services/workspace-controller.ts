import { InteractionHistory, summarizePatterns, type InteractionRecord } from "../domain/interaction-history";
import { describeWine, reviewReference, type ConversationInput } from "../domain/wine-context";
import { suggest, type Suggestion } from "./conversation-companion";
import type { HistoryStore } from "./history-store";

// The workspace's behaviour without any DOM. The only "output" channel to the
// outside world is `copy` (clipboard). There is deliberately no way here to
// write into Vivino's comment box or to submit anything.

export interface WorkspaceDeps {
  store: HistoryStore;
  copy: (text: string) => Promise<boolean>;
  now?: () => number;
}

export interface OutcomePatch {
  replyReceived?: boolean;
  meaningful?: boolean;
}

export class WorkspaceController {
  public history = new InteractionHistory();
  public input?: ConversationInput;
  public suggestion?: Suggestion;
  /** One-line message about storage or earlier use of this review. */
  public notice?: string;

  private shownIds: string[] = [];
  private loaded = false;

  private readonly deps: WorkspaceDeps;

  public constructor(deps: WorkspaceDeps) {
    this.deps = deps;
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  public async init(): Promise<void> {
    if (this.loaded) return;
    const loaded = await this.deps.store.load();
    this.history = loaded.history;
    this.notice = loaded.notice;
    this.loaded = true;
  }

  /** Start on a review (new or edited). Resets the list of angles already shown. */
  public async analyze(input: ConversationInput): Promise<Suggestion> {
    await this.init();
    this.input = input;
    this.shownIds = [];
    return this.refresh();
  }

  /** Another conversational angle on the same review. */
  public async anotherAngle(): Promise<Suggestion | undefined> {
    if (!this.input || !this.suggestion) return undefined;
    return this.refresh();
  }

  public get existing(): InteractionRecord | undefined {
    return this.suggestion ? this.history.get(this.suggestion.reference) : undefined;
  }

  /** Copies the (possibly edited) comment. It never posts it. */
  public async copyComment(text: string): Promise<{ copied: boolean }> {
    const suggestion = this.suggestion;
    if (!suggestion || !suggestion.comment || !text.trim()) return { copied: false };
    const copied = await this.deps.copy(text.trim());
    if (!copied) return { copied: false };
    const edited = text.trim() !== suggestion.comment.trim();
    this.history.update(
      suggestion.reference,
      { action: edited ? "edited_copied" : "copied", comment: text.trim() },
      this.now(),
    );
    await this.persist();
    return { copied: true };
  }

  public async skip(): Promise<void> {
    const suggestion = this.suggestion;
    if (!suggestion) return;
    const record = this.history.get(suggestion.reference);
    if (record && !record.used) {
      this.history.update(suggestion.reference, { action: "skipped" }, this.now());
      await this.persist();
    }
  }

  public async recordOutcome(patch: OutcomePatch): Promise<boolean> {
    const suggestion = this.suggestion;
    if (!suggestion) return false;
    const updated = this.history.update(suggestion.reference, patch, this.now());
    if (!updated) return false;
    await this.persist();
    return true;
  }

  public patterns(): ReturnType<typeof summarizePatterns> {
    return summarizePatterns(this.history);
  }

  private async refresh(): Promise<Suggestion> {
    const input = this.input as ConversationInput;
    const reference = reviewReference(input);
    const own = this.history.get(reference);
    const suggestion = suggest(input, {
      uses: this.history.pastUses(reference),
      skipIds: this.shownIds,
      now: this.now(),
    });

    if (suggestion.candidate) this.shownIds.push(suggestion.candidate.id);
    this.suggestion = suggestion;
    if (own?.used) this.notice = "You already used a comment on this review.";
    this.recordShown(suggestion, input);
    await this.persist();
    return suggestion;
  }

  private recordShown(suggestion: Suggestion, input: ConversationInput): void {
    const now = this.now();
    const existing = this.history.get(suggestion.reference);
    if (existing?.used) return; // Keep what I actually used.
    this.history.upsert({
      reference: suggestion.reference,
      wine: describeWine(input.wine) || "Unknown wine",
      processedAt: existing?.processedAt ?? now,
      updatedAt: now,
      recommended: suggestion.recommendation,
      type: suggestion.candidate?.type,
      dimension: suggestion.candidate?.dimension,
      concepts: suggestion.candidate?.concepts ?? [],
      comment: suggestion.comment,
      action: existing?.action === "skipped" ? "none" : (existing?.action ?? "none"),
      used: false,
      anglesTried: this.shownIds.length,
      replyReceived: existing?.replyReceived,
      meaningful: existing?.meaningful,
    });
  }

  private async persist(): Promise<void> {
    const saved = await this.deps.store.save(this.history);
    if (!saved && this.deps.store.persistent) {
      this.notice = "Couldn't save your history this time.";
    }
  }
}
