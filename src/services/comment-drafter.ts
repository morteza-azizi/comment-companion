import type { ContributionIdea } from "../domain/contribution";
import { countWords } from "../domain/text-match";

const MAX_WORDS = 70;

export function draftComment(idea: ContributionIdea): string | null {
  const sentences = sentencesFor(idea)
    .map(cleanSentence)
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) return null;

  let comment = joinSentences(sentences);
  if (countWords(comment) > MAX_WORDS && sentences.length > 2) {
    comment = joinSentences(sentences.slice(0, 2));
  }
  if (countWords(comment) > MAX_WORDS) return null;
  if (/\bin my experience\b/i.test(comment)) return null;
  return comment;
}

function sentencesFor(idea: ContributionIdea): string[] {
  switch (idea.mode) {
    case "ADD_ONE_INSIGHT":
      return [idea.observation, idea.insight, idea.implication].filter((part): part is string => Boolean(part));
    case "CHALLENGE_ASSUMPTION":
      return [
        idea.usefulPart,
        idea.assumption ? `The assumption is that ${idea.assumption}.` : undefined,
        idea.whyAssumptionFails,
        idea.betterFraming,
      ].filter((part): part is string => Boolean(part));
    case "TECHNICAL_DISTINCTION":
      return [idea.distinction, idea.implication].filter((part): part is string => Boolean(part));
    case "SHARE_EVIDENCE":
      return [idea.claim, idea.evidenceSummary, idea.evidenceSuggests].filter((part): part is string =>
        Boolean(part)
      );
    case "ASK_BETTER_QUESTION":
      return idea.question ? [idea.question] : [];
    case "OPEN_DISCUSSION":
      return idea.discussionAngle ? [idea.discussionAngle] : [];
    case "CORRECT_CAREFULLY":
      return [idea.correction, idea.consequence].filter((part): part is string => Boolean(part));
    case "BRIDGE_TO_ENGINEERING":
      return [idea.engineeringBridge, idea.workReference].filter((part): part is string => Boolean(part));
  }
}

function cleanSentence(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function joinSentences(parts: string[]): string {
  return parts
    .map((part) => {
      const trimmed = part.trim();
      const ended = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
      return capitalizeFirst(ended);
    })
    .join(" ");
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
