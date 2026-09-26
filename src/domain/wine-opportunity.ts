import { attachAngle, ideaAngleInput } from "./angle-fingerprint";
import type { ContributionIdea } from "./contribution";
import type { ContributionHistory } from "./contribution-history";
import { roseCharacterFor } from "./wine-color";
import { parseReview, type ParsedReview, type ReviewTheme } from "./wine-review";
import { deriveSignals, type WineSignals } from "./wine-signals";
import type { ReviewerBand, WineContext } from "./wine-context";
import type { GrapeKnowledge } from "./wine-knowledge";

interface WineTechnique {
  angle: string;
  concepts: readonly string[];
  observation: string;
  insight: string;
  tokens: readonly string[];
}

const TECHNIQUES: Record<string, WineTechnique> = {
  Chardonnay: {
    angle: "oak vs stainless",
    concepts: ["oak-vs-stainless", "winemaking"],
    observation: "Chardonnay is shaped more by the cellar than by the grape name.",
    insight:
      "Stainless keeps it on apple and citrus; oak and malo make the same grape round and toasty.",
    tokens: ["Chardonnay", "oak"],
  },
  Riesling: {
    angle: "residual sugar vs acidity",
    concepts: ["residual-sugar", "winemaking"],
    observation: "With Riesling the fork is sweetness against acid, not oak.",
    insight: "The same high acid can finish bone-dry or off-dry — that choice changes the glass more than the year usually does.",
    tokens: ["Riesling", "acid"],
  },
  "Pinot Noir": {
    angle: "extraction vs delicacy",
    concepts: ["extraction", "winemaking"],
    observation: "Pinot Noir is easy to overwork.",
    insight:
      "Gentle extraction keeps the savory, lighter frame; more extraction just makes a thin grape taste forced.",
    tokens: ["Pinot Noir", "extraction"],
  },
  "Sauvignon Blanc": {
    angle: "steel vs oak",
    concepts: ["steel-vs-oak", "winemaking"],
    observation: "Sauvignon Blanc is usually a steel grape.",
    insight: "The real choice is whether it stays on citrus and grass, or whether oak is allowed to blur that.",
    tokens: ["Sauvignon Blanc", "steel"],
  },
  Malbec: {
    angle: "altitude vs ripeness",
    concepts: ["altitude", "winemaking"],
    observation: "With Malbec the split is ripeness, not a generic dark-fruit note.",
    insight:
      "Higher, cooler sites keep the plush fruit from turning jammy; warmer, lower fruit is why so many bottles taste the same.",
    tokens: ["Malbec", "ripeness"],
  },
  "Cabernet Sauvignon": {
    angle: "extraction vs oak",
    concepts: ["extraction", "oak", "winemaking"],
    observation: "Cabernet Sauvignon can take oak and still be under-ripe or over-extracted.",
    insight: "The question is whether the structure comes from the fruit and tannin, or from barrel piled on top.",
    tokens: ["Cabernet Sauvignon", "oak"],
  },
  Nebbiolo: {
    angle: "maceration vs tannin",
    concepts: ["maceration", "tannin", "winemaking"],
    observation: "Nebbiolo tannin is a cellar problem as much as a grape fact.",
    insight:
      "Long maceration builds the structure people cellar; shorter work can make a young bottle easier without changing the grape.",
    tokens: ["Nebbiolo", "tannin"],
  },
  Tempranillo: {
    angle: "oak aging vs fruit",
    concepts: ["oak-aging", "winemaking"],
    observation: "Tempranillo in Spain is often more about oak time than the grape alone.",
    insight: "Crianza versus reserva is a barrel clock — vanilla and leather come from oak age, not from the vintage year by itself.",
    tokens: ["Tempranillo", "oak"],
  },
};

export function winePostText(context: WineContext): string {
  const parts = [
    context.producer,
    context.wineName,
    typeof context.vintage === "number" ? String(context.vintage) : undefined,
    context.region,
    context.country,
    context.grapes?.join(", "),
    context.wineColor,
    typeof context.reviewerRating === "number" ? `reviewer ${context.reviewerRating}` : undefined,
    context.reviewText,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" ");
}

export function analyzeWineOpportunity(context: WineContext): ContributionIdea[] {
  const signals = deriveSignals(context);
  const ideas: ContributionIdea[] = [];
  const knowledge = signals.grapeKnowledge;

  ideas.push(...reviewIdeas(context, signals));

  if (knowledge && signals.isOldVintage && signals.drinkStyle === "age" && typeof context.vintage === "number") {
    ideas.push(ageWorthyDiscussion(context, signals));
  }

  if (knowledge && typeof context.vintage === "number" && signals.vintageAge !== undefined) {
    ideas.push(...vintageIdeas(context, signals));
  }

  if (knowledge && TECHNIQUES[knowledge.name] && signals.primaryGrape && canUseRedTechnique(signals)) {
    ideas.push(winemakingIdea(knowledge, signals));
  }

  if (signals.regionKnowledge) {
    ideas.push(regionInsight(signals));
  }

  if (knowledge && (signals.primaryGrape || signals.regionKnowledge)) {
    ideas.push(grapeStructureIdea(signals));
    if (knowledge.character.length > 1 || signals.isRose) {
      ideas.push(styleQuestion(knowledge, signals));
    }
    if (signals.pairings.length > 0 && signals.primaryGrape) {
      ideas.push(pairingIdea(knowledge, signals));
    }
  }

  if (signals.isConfirmedBlend && !signals.isRose) {
    ideas.push(blendIdea(signals.confirmedGrapes));
  }

  if (signals.isHighRating && typeof context.rating === "number" && typeof context.reviewerRating !== "number") {
    ideas.push(ratingIdea(context.rating));
  }

  if (signals.isGoodValue && typeof context.price === "number" && typeof context.rating === "number") {
    ideas.push(valueIdea(context.price, context.rating));
  } else if (signals.isPremiumPrice && typeof context.price === "number") {
    ideas.push(premiumPriceIdea(context.price, context.currency));
  }

  if (signals.isOldVintage && !knowledge && typeof context.vintage === "number") {
    ideas.push(oldVintageWithoutGrape(context.vintage, context.country, context.region));
  }

  return ideas;
}

export function rankWineIdeas(
  ideas: readonly ContributionIdea[],
  history: ContributionHistory
): ContributionIdea[] {
  return [...ideas].sort((left, right) => wineRank(right, history) - wineRank(left, history));
}

function wineRank(idea: ContributionIdea, history: ContributionHistory): number {
  return idea.specificity - history.anglePenalty(ideaAngleInput(idea));
}

function canUseRedTechnique(signals: WineSignals): boolean {
  if (signals.isRose) return false;
  if (signals.wineColor && signals.wineColor !== "red") return false;
  return true;
}

function reviewIdeas(context: WineContext, signals: WineSignals): ContributionIdea[] {
  const parsed = parseReview(context.reviewText, context.reviewerRating);
  const ideas: ContributionIdea[] = [];
  const score = typeof context.reviewerRating === "number" ? formatScore(context.reviewerRating) : undefined;

  if (parsed.snippet && (score || parsed.themes.length > 0 || parsed.snippet.length >= 8)) {
    ideas.push(reviewReplyIdea(signals, parsed, score));
  } else if (score) {
    ideas.push(scoreOnlyIdea(signals, parsed, score));
  }

  if (
    typeof context.reviewerRating === "number" &&
    typeof context.rating === "number" &&
    Math.abs(context.reviewerRating - context.rating) >= 0.6
  ) {
    ideas.push(scoreSplitIdea(context));
  }

  return ideas;
}

function reviewReplyIdea(
  signals: WineSignals,
  parsed: ParsedReview,
  score?: string
): ContributionIdea {
  const grape = signals.primaryGrape ?? signals.grapeKnowledge?.name;
  const snippet = parsed.snippet as string;
  const hook = score
    ? `${score} and you called it ${clipSnippet(snippet)}`
    : `You called it ${clipSnippet(snippet)}`;
  const follow = followUpFor(parsed.themes, signals, grape);
  const roseBit = signals.isRose ? " For a rosé that's a different drink than the red of the same grape." : "";

  return attachAngle({
    id: `wine:review:${score ?? "note"}:${signals.wineColor ?? "unknown"}`,
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: "They left a tasting note and a score; the comment should answer what they actually said.",
    confidence: "HIGH",
    specificity: 96,
    requiredTokens: [score ?? snippet.slice(0, 12), grape ?? "you"].filter((token): token is string => Boolean(token)),
    topics: ["wine"],
    angle: "reply to review",
    concepts: ["reviewer-note", ...parsed.themes],
    question: `${hook}.${roseBit} ${follow}`,
  });
}

function scoreOnlyIdea(
  signals: WineSignals,
  parsed: ParsedReview,
  score: string
): ContributionIdea {
  const grape = signals.primaryGrape ?? signals.grapeKnowledge?.name;
  const opener = scoreOpener(parsed.band, score);
  const follow = scoreFollowUp(parsed.band, score, signals, grape);

  return attachAngle({
    id: `wine:score:${score}:${signals.wineColor ?? "unknown"}`,
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: `They ranked this ${score}; the useful reply is about that score, not a generic grape lecture.`,
    confidence: "HIGH",
    specificity: 91,
    requiredTokens: [score],
    topics: ["wine"],
    angle: "reply to score",
    concepts: ["reviewer-rating", parsed.band ?? "score"],
    question: `${opener} ${follow}`,
  });
}

function scoreSplitIdea(context: WineContext): ContributionIdea {
  const theirs = formatScore(context.reviewerRating as number);
  const crowd = (context.rating as number).toFixed(1);
  const higher = (context.reviewerRating as number) > (context.rating as number);
  return attachAngle({
    id: `wine:score-split:${theirs}:${crowd}`,
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: "Their score and the community average disagree; that split is the thing to talk about.",
    confidence: "HIGH",
    specificity: 93,
    requiredTokens: [theirs, crowd],
    topics: ["wine"],
    angle: "reviewer vs community score",
    concepts: ["score-split"],
    question: higher
      ? `You put ${theirs} on a wine the crowd has at ${crowd}. What did you get that they are missing?`
      : `You put ${theirs} on a wine the crowd has at ${crowd}. What didn't land for you?`,
  });
}

function vintageIdeas(context: WineContext, signals: WineSignals): ContributionIdea[] {
  const knowledge = signals.grapeKnowledge as GrapeKnowledge;
  const vintage = context.vintage as number;
  const ideas: ContributionIdea[] = [];
  const drinkStyle = signals.drinkStyle ?? knowledge.drinkStyle;
  const label = wineLabel(knowledge, signals);

  if (drinkStyle === "fresh" && (signals.vintageAge ?? 0) > 4) {
    ideas.push(
      attachAngle({
        id: `wine:distinction:${knowledge.name}:${vintage}`,
        mode: "TECHNICAL_DISTINCTION",
        reason: "missing_distinction",
        why: `${vintage} looks impressive on a ${label} that is usually drunk young; age here is a risk, not a virtue.`,
        confidence: "HIGH",
        specificity: 88,
        requiredTokens: [knowledge.name, String(vintage)],
        topics: ["wine"],
        angle: "vintage year vs drink window",
        concepts: ["drink-window", "vintage-year"],
        conceptA: "vintage year",
        conceptB: "drink window",
        distinction: signals.isRose
          ? `${vintage} is old for a ${knowledge.name} rosé. Pink wines are usually drunk young — the year here is a risk to the fruit, not a virtue.`
          : `${vintage} is old for ${knowledge.name}. This grape is usually drunk young — the year on the label isn't a virtue here.`,
        implication: signals.isRose
          ? "Did any of that fresh fruit survive, or had it already gone quiet?"
          : "Did the fruit still feel alive, or had the year already cost it?",
      })
    );
  }

  if (drinkStyle === "age" && signals.isYoungVintage) {
    ideas.push(
      attachAngle({
        id: `wine:question:${knowledge.name}:${vintage}`,
        mode: "ASK_BETTER_QUESTION",
        reason: "useful_question",
        why: `${vintage} is still young for ${knowledge.name}; ask about readiness instead of complimenting the bottle.`,
        confidence: "MEDIUM",
        specificity: 86,
        requiredTokens: [knowledge.name, String(vintage), "tannic"],
        topics: ["wine"],
        angle: "readiness vs grape structure",
        concepts: ["readiness", "tannic-structure"],
        question: `Did the ${vintage} ${knowledge.name} still feel tannic and tight, or was this a more approachable bottling?`,
      })
    );
  }

  const note = vintageNote(vintage, knowledge, signals);
  if (note) {
    ideas.push(
      attachAngle({
        id: `wine:vintage:${knowledge.name}:${vintage}`,
        mode: "ADD_ONE_INSIGHT",
        reason: "missing_nuance",
        why: `There is a concrete drink-window nuance for ${vintage} ${label} that the post does not spell out.`,
        confidence: "HIGH",
        specificity: 82,
        requiredTokens: [knowledge.name, String(vintage)],
        topics: ["wine"],
        angle: "drink window",
        concepts: ["drink-window", drinkStyle],
        observation: `${vintage} ${label} still has a timing story.`,
        insight: note,
      })
    );
  }

  return ideas;
}

function ageWorthyDiscussion(context: WineContext, signals: WineSignals): ContributionIdea {
  const knowledge = signals.grapeKnowledge as GrapeKnowledge;
  const vintage = context.vintage as number;
  const character = knowledge.character[0];
  return attachAngle({
    id: `wine:discuss:${knowledge.name}:${vintage}`,
    mode: "OPEN_DISCUSSION",
    reason: "open_angle",
    why: `${knowledge.name} at ${vintage} is old enough that the interesting question is structure, not the vintage year itself.`,
    confidence: "HIGH",
    specificity: 92,
    requiredTokens: [knowledge.name, String(vintage), "tannin"],
    topics: ["wine"],
    angle: "structure vs vintage year",
    concepts: ["tannin-structure", "cellaring"],
    discussionAngle: `${vintage} ${knowledge.name} is around when the tannins should start to give. ${capitalize(character)} — did it finally open, or still need food and air?`,
  });
}

function winemakingIdea(knowledge: GrapeKnowledge, signals: WineSignals): ContributionIdea {
  const technique = TECHNIQUES[knowledge.name];
  const label = signals.primaryGrape ? knowledge.name : `${signals.regionKnowledge?.name} ${knowledge.name}`;
  return attachAngle({
    id: `wine:technique:${label}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: `The distinctive contribution is a winemaking fork for ${knowledge.name}, not another grape-plus-pairing line.`,
    confidence: "HIGH",
    specificity: 78,
    requiredTokens: technique.tokens,
    topics: ["wine"],
    angle: technique.angle,
    concepts: technique.concepts,
    observation: technique.observation,
    insight: technique.insight,
  });
}

function grapeStructureIdea(signals: WineSignals): ContributionIdea {
  const knowledge = signals.grapeKnowledge as GrapeKnowledge;
  const label = wineLabel(knowledge, signals);

  if (signals.isRose) {
    const rose = roseCharacterFor(knowledge.name);
    return attachAngle({
      id: `wine:rose:${label}`,
      mode: "ADD_ONE_INSIGHT",
      reason: "missing_nuance",
      why: `${knowledge.name} as rosé is a different drink than the red; commenting as if it were red would miss the bottle.`,
      confidence: "HIGH",
      specificity: 85,
      requiredTokens: [knowledge.name, "rosé"],
      topics: ["wine"],
      angle: "rosé vs red of the same grape",
      concepts: [knowledge.name, "rose-style"],
      observation: `${label} is ${rose.character}.`,
      insight: "That's a different drink than the red of the same grape.",
    });
  }

  const character = knowledge.character[0];
  return attachAngle({
    id: `wine:grape:${label}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: `The distinctive contribution is a concrete ${knowledge.name} note, not a generic reaction.`,
    confidence: "MEDIUM",
    specificity: 70,
    requiredTokens: [knowledge.name],
    topics: ["wine"],
    angle: "grape structure",
    concepts: [knowledge.name, "grape-structure"],
    observation: `${label} usually shows ${character}.`,
    insight: `Did this one stay there, or go somewhere else?`,
  });
}

function pairingIdea(knowledge: GrapeKnowledge, signals: WineSignals): ContributionIdea {
  const pairing = signals.pairings[0] ?? knowledge.pairings[0];
  const label = wineLabel(knowledge, signals);
  return attachAngle({
    id: `wine:pairing:${label}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: signals.isRose
      ? `Rosé pairing is not the red-grape pairing for ${knowledge.name}.`
      : `Food pairing is one possible angle for ${knowledge.name}, not the default comment.`,
    confidence: "LOW",
    specificity: signals.isRose ? 62 : 60,
    requiredTokens: [knowledge.name, pairing],
    topics: ["wine"],
    angle: "food pairing",
    concepts: ["food-pairing"],
    observation: signals.isRose
      ? `${label} wants ${pairing}, not the red-grape food.`
      : `${label} has the structure to sit next to ${pairing}.`,
    insight: signals.isRose
      ? "The pink version is a food wine for a colder plate."
      : "Only if this bottle still has that structure — not every example of the grape does.",
  });
}

function styleQuestion(knowledge: GrapeKnowledge, signals: WineSignals): ContributionIdea {
  const label = wineLabel(knowledge, signals);
  if (signals.isRose) {
    return attachAngle({
      id: `wine:style-q:${label}:rose`,
      mode: "ASK_BETTER_QUESTION",
      reason: "useful_question",
      why: `${knowledge.name} rosé can stay pale and light or pick up color and weight; ask which one showed.`,
      confidence: "MEDIUM",
      specificity: 72,
      requiredTokens: [knowledge.name],
      topics: ["wine"],
      angle: "which rosé style showed",
      concepts: ["rose-style-split"],
      question: `Did this ${knowledge.name} rosé stay on strawberry and stay light, or did it pick up more color and weight?`,
    });
  }

  const first = knowledge.character[0];
  const second = knowledge.character[1];
  return attachAngle({
    id: `wine:style-q:${label}`,
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: `${knowledge.name} spans more than one style; a question about which one showed is more useful than restating the grape.`,
    confidence: "MEDIUM",
    specificity: 64,
    requiredTokens: [knowledge.name],
    topics: ["wine"],
    angle: "which style showed",
    concepts: ["style-split"],
    question: `Did the ${label} show ${first}, or ${second}?`,
  });
}

function regionInsight(signals: WineSignals): ContributionIdea {
  const region = signals.regionKnowledge!;
  const observation = region.observations[0];
  const grape = region.typicalGrapes[0];
  return attachAngle({
    id: `wine:region:${region.name}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: `${region.name} has a distinctive style note worth adding; a generic region compliment would not.`,
    confidence: "MEDIUM",
    specificity: 74,
    requiredTokens: [region.name],
    topics: ["wine"],
    angle: "regional style",
    concepts: [region.name, "regional-style"],
    observation: `${region.name} usually means ${observation}.`,
    insight: grape
      ? `If this followed the usual ${grape} path, that's the thing worth asking about.`
      : `If this followed that, that's the thing worth asking about.`,
  });
}

function blendIdea(grapes: readonly string[]): ContributionIdea {
  const listed = grapes.slice(0, 3).join(" and ");
  return attachAngle({
    id: `wine:blend:${grapes.join("+")}`,
    mode: "TECHNICAL_DISTINCTION",
    reason: "missing_distinction",
    why: "A confirmed blend is a fact about this bottle; the useful comment is what each grape is doing.",
    confidence: "HIGH",
    specificity: 80,
    requiredTokens: [...grapes.slice(0, 2), "blend"],
    topics: ["wine"],
    angle: "blend roles",
    concepts: ["blend-roles"],
    conceptA: grapes[0],
    conceptB: grapes[1],
    distinction: `This is a blend of ${listed}. Those grapes are not interchangeable — one usually carries fruit or perfume, the other structure or freshness.`,
    implication: "Curious which one did the work in this bottling?",
  });
}

function ratingIdea(rating: number): ContributionIdea {
  const label = rating.toFixed(1);
  return attachAngle({
    id: `wine:rating:${label}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "A high community average is agreement, not a tasting note we can invent.",
    confidence: "MEDIUM",
    specificity: 66,
    requiredTokens: [label],
    topics: ["wine"],
    angle: "community consensus",
    concepts: ["community-rating"],
    observation: `${label} from the crowd is agreement, not a tasting note.`,
    insight: "It says people landed in the same place — not what the next glass will show.",
  });
}

function valueIdea(price: number, rating: number): ContributionIdea {
  return attachAngle({
    id: `wine:value:${price}:${rating}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "identify_tradeoff",
    why: "Price and rating together can support a value comment without inventing a tasting.",
    confidence: "MEDIUM",
    specificity: 68,
    requiredTokens: [String(price), rating.toFixed(1)],
    topics: ["wine"],
    angle: "price vs rating",
    concepts: ["price-rating"],
    observation: `At ${price} with a ${rating.toFixed(1)} average, the gap between price and the crowd is the story.`,
    insight: "That's a shelf fact, not a promise this bottle will overdeliver in the glass.",
  });
}

function premiumPriceIdea(price: number, currency?: string): ContributionIdea {
  const amount = currency ? `${currency} ${price}` : String(price);
  return attachAngle({
    id: `wine:premium:${price}`,
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: "A high price raises a question about expectation, not a compliment.",
    confidence: "MEDIUM",
    specificity: 64,
    requiredTokens: [String(price)],
    topics: ["wine"],
    angle: "price expectation",
    concepts: ["premium-price"],
    question: `At ${amount}, is the premium coming from site and age, or from oak, branding, and scarcity? Those are different wines.`,
  });
}

function oldVintageWithoutGrape(vintage: number, country?: string, region?: string): ContributionIdea {
  const place = region || country;
  return attachAngle({
    id: `wine:old-unknown:${vintage}:${place ?? "none"}`,
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "An old vintage is a distinctive fact even when the grape is outside known knowledge.",
    confidence: "MEDIUM",
    specificity: 72,
    requiredTokens: [String(vintage)],
    topics: ["wine"],
    angle: "old vintage without grape knowledge",
    concepts: ["old-vintage"],
    observation: place
      ? `A ${vintage} from ${place} is already an old bottle.`
      : `A ${vintage} still circulating is already an old bottle.`,
    insight: "Without a grape we can speak about, the year itself is the thing — not a guessed tasting note.",
  });
}

function vintageNote(vintage: number, knowledge: GrapeKnowledge, signals: WineSignals): string | null {
  const age = signals.vintageAge;
  if (age === undefined) return null;
  const drinkStyle = signals.drinkStyle ?? knowledge.drinkStyle;
  const label = wineLabel(knowledge, signals);

  if (drinkStyle === "fresh" && signals.isYoungVintage) {
    return signals.isRose
      ? `${vintage} still sits in the window a ${knowledge.name} rosé is built for.`
      : `${vintage} still sits in the bright window this grape is built for.`;
  }
  if (drinkStyle === "flexible" && signals.isYoungVintage) {
    return `${vintage} is a good moment to drink it while the fruit is still lively.`;
  }
  if (drinkStyle === "age" && signals.isOldVintage) {
    return `${vintage} is around the age this grape starts to open.`;
  }
  if (drinkStyle === "age" && signals.isYoungVintage) {
    return `${vintage} is still young for a grape that usually wants time in the bottle.`;
  }
  if (drinkStyle === "flexible" && age > 4 && !signals.isOldVintage) {
    return `${vintage} is far enough along that the question is whether this was the leaner or the richer bottling.`;
  }
  if (drinkStyle === "fresh" && age > 4) {
    return signals.isRose
      ? `${vintage} is on the older side for ${label} — rosé usually doesn't gain from the extra years.`
      : `${vintage} is on the older side for a grape that's usually drunk young.`;
  }
  return null;
}

function wineLabel(knowledge: GrapeKnowledge, signals: WineSignals): string {
  if (signals.isRose) return `${knowledge.name} rosé`;
  if (signals.primaryGrape) return knowledge.name;
  if (signals.regionKnowledge) return `${signals.regionKnowledge.name} ${knowledge.name}`;
  return knowledge.name;
}

function followUpFor(themes: ReviewTheme[], signals: WineSignals, grape?: string): string {
  if (signals.isRose) {
    if (themes.includes("light") || themes.includes("acid")) {
      return "Did it stay on strawberry and stay pale, or pick up more color?";
    }
    if (themes.includes("tannin")) {
      return "Tannin in a rosé is unusual — was it actually grip, or just a dry finish?";
    }
    if (themes.includes("fruit")) {
      return "Was that fruit sweet-strawberry, or more savory and dry?";
    }
    if (themes.includes("heavy")) {
      return "That's a lot of weight for a pink wine. Was it the color, the alcohol, or a richer style?";
    }
    return "Did this one stay a chillable pink, or drink closer to a light red?";
  }
  if (themes.includes("oak")) return "Was the oak in the right place, or did it cover the fruit?";
  if (themes.includes("tannin")) return "Did the tannin need food, or was it just unresolved?";
  if (themes.includes("acid")) return "Was that acid refreshing, or a bit sharp on its own?";
  if (themes.includes("short")) return "Did it fall off that fast with food too, or only on its own?";
  if (themes.includes("sweet")) return "Was the sweetness in balance, or did it sit on the finish?";
  if (themes.includes("heavy")) return "Was the weight from fruit, oak, or just alcohol?";
  if (themes.includes("light")) return "Light in a good way, or just thin?";
  if (grape) return `Did it taste like typical ${grape}, or go somewhere else?`;
  return "What actually held the score there?";
}

function scoreOpener(band: ReviewerBand | undefined, score: string): string {
  if (band === "loved") return `${score} is you really liked this.`;
  if (band === "liked") return `${score} is a solid like.`;
  if (band === "mixed") return `${score} is pretty honest.`;
  if (band === "low") return `${score} is a shrug.`;
  return `${score} is your score.`;
}

function scoreFollowUp(
  band: ReviewerBand | undefined,
  score: string,
  signals: WineSignals,
  grape?: string
): string {
  if (signals.isRose) {
    return grape
      ? `For a ${grape} rosé, what held it at ${score} — the fruit, the freshness, or how easy it was?`
      : `For a rosé, what held it at ${score} — fruit, freshness, or how easy it was?`;
  }
  if (band === "loved") return "What held it there — fruit, freshness, or just how easy it was?";
  if (band === "liked") return grape ? `What got it to ${score} for you on this ${grape}?` : `What got it to ${score} for you?`;
  if (band === "mixed") {
    return grape ? `Was it thin, or just not what you wanted from ${grape}?` : "Was it thin, or just not what you wanted?";
  }
  if (band === "low") return "What didn't land — fruit, balance, or the style?";
  return grape ? `What held it at ${score} on this ${grape}?` : `What held it at ${score}?`;
}

function clipSnippet(snippet: string): string {
  const cleaned = snippet.replace(/[.!?]+$/, "").trim();
  return cleaned.length > 60 ? `${cleaned.slice(0, 57).trim()}…` : cleaned;
}

function formatScore(rating: number): string {
  return rating.toFixed(1);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
