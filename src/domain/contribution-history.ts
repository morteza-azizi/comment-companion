import type { ContributionMode, Novelty } from "./contribution";
import {
  assessNoveltyAgainst,
  type AngleInput,
  type NoveltyAssessment,
} from "./angle-fingerprint";

export interface HistoryEntry {
  mode: ContributionMode;
  ideaId: string;
  angleFingerprint: string;
  concepts: readonly string[];
  angle?: string;
  at: number;
}

export interface HistoryRecord {
  mode: ContributionMode;
  ideaId: string;
  angleFingerprint: string;
  concepts?: readonly string[];
  angle?: string;
  at?: number;
}

export class ContributionHistory {
  private readonly entries: HistoryEntry[] = [];

  public record(entry: HistoryRecord): void {
    this.entries.push({
      mode: entry.mode,
      ideaId: entry.ideaId,
      angleFingerprint: entry.angleFingerprint,
      concepts: entry.concepts ?? [],
      angle: entry.angle,
      at: entry.at ?? Date.now(),
    });
  }

  public usedIdea(ideaId: string): boolean {
    return this.entries.some((entry) => entry.ideaId === ideaId);
  }

  public modeShare(mode: ContributionMode, window = 20): number {
    const recent = this.entries.slice(-window);
    if (recent.length < 4) return 0;
    return recent.filter((entry) => entry.mode === mode).length / recent.length;
  }

  public noveltyFor(input: AngleInput, now = Date.now()): NoveltyAssessment {
    return assessNoveltyAgainst(input, this.asAngleInputs(), now);
  }

  public noveltyLabel(input: AngleInput, now = Date.now()): Novelty {
    return this.noveltyFor(input, now).novelty;
  }

  public anglePenalty(input: AngleInput, now = Date.now()): number {
    return this.noveltyFor(input, now).penalty;
  }

  public get size(): number {
    return this.entries.length;
  }

  public snapshot(): readonly HistoryEntry[] {
    return [...this.entries];
  }

  private asAngleInputs(): (AngleInput & { at: number })[] {
    return this.entries.map((entry) => ({
      concepts: entry.concepts,
      angle: entry.angle,
      at: entry.at,
    }));
  }
}
