export type EvidenceKind = "repository" | "article" | "experiment" | "measurement" | "project";

export interface UserEvidence {
  id: string;
  kind: EvidenceKind;
  topics: readonly string[];
  summary: string;
  suggests: string;
  /** Optional short name of the work. Never used as a promo line on its own. */
  workName?: string;
}

export interface UserProfile {
  expertise: readonly string[];
  evidence: readonly UserEvidence[];
}

export const DEFAULT_EXPERTISE: readonly string[] = [
  "Software Architecture",
  "Azure Integration Architecture",
  ".NET",
  "Distributed Systems",
  "Messaging",
  "Event-Driven Architecture",
  "APIs",
  "Resilience",
  "Cloud Architecture",
];

export const DEFAULT_USER_PROFILE: UserProfile = {
  expertise: DEFAULT_EXPERTISE,
  evidence: [],
};

export function profileHasEvidence(profile: UserProfile): boolean {
  return profile.evidence.length > 0;
}
