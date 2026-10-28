// A small, plain vocabulary used to RECOGNISE what a reviewer wrote. It is
// not a source of wine knowledge: nothing here is ever used to claim a
// characteristic of a wine that the review (or my own note) did not state.

export type TastingTheme =
  | "acidity"
  | "tannin"
  | "fruit"
  | "oak"
  | "sweetness"
  | "body"
  | "finish"
  | "aromatics"
  | "balance"
  | "condition";

/** Which way a descriptor leans on its theme. `neutral` = just a mention. */
export type Direction = "high" | "low" | "neutral";

export interface LexiconEntry {
  theme: TastingTheme;
  direction: Direction;
  terms: readonly string[];
}

export const THEME_LABEL: Record<TastingTheme, string> = {
  acidity: "freshness / acidity",
  tannin: "tannins and texture",
  fruit: "fruit",
  oak: "oak and winemaking flavours",
  sweetness: "sweetness / dryness",
  body: "weight and body",
  finish: "finish",
  aromatics: "aromas",
  balance: "balance",
  condition: "condition of the bottle",
};

export const TASTING_LEXICON: readonly LexiconEntry[] = [
  { theme: "acidity", direction: "high", terms: ["acidic", "acidity", "acid", "tart", "tangy", "zesty", "crisp", "sharp", "bright", "fresh", "freshness", "lively", "racy"] },
  { theme: "acidity", direction: "low", terms: ["flat", "flabby", "low acidity", "low acid"] },

  { theme: "tannin", direction: "neutral", terms: ["tannin", "tannins"] },
  { theme: "tannin", direction: "high", terms: ["tannic", "grippy", "astringent", "drying", "chewy", "gritty"] },
  { theme: "tannin", direction: "low", terms: ["smooth", "silky", "velvety", "supple", "soft", "mellow", "round"] },

  {
    theme: "fruit",
    direction: "neutral",
    terms: [
      "fruit", "fruity", "red fruit", "dark fruit", "stone fruit", "cherry", "cherries", "sour cherry", "cassis", "blackcurrant",
      "black currant", "blackberry", "blueberry", "raspberry", "strawberry", "plum", "berry", "berries", "apple", "pear",
      "peach", "apricot", "citrus", "lemon", "lime", "grapefruit", "tropical", "pineapple", "mango", "melon", "fig",
      "raisin", "prune",
    ],
  },
  { theme: "fruit", direction: "high", terms: ["fruit forward", "jammy", "ripe", "juicy", "lush", "fruit bomb"] },

  { theme: "oak", direction: "neutral", terms: ["oak", "oaky", "oaked", "vanilla", "toast", "toasty", "toasted", "buttery", "butter", "cedar", "coconut", "barrel", "smoky", "smoke", "caramel", "mocha"] },
  { theme: "oak", direction: "low", terms: ["unoaked", "no oak"] },

  { theme: "sweetness", direction: "high", terms: ["sweet", "sweetness", "off dry", "sugary", "syrupy", "honeyed", "residual sugar", "cloying"] },
  { theme: "sweetness", direction: "low", terms: ["dry", "bone dry", "austere"] },

  { theme: "body", direction: "high", terms: ["full bodied", "full body", "heavy", "rich", "bold", "big", "powerful", "concentrated", "intense", "dense", "weighty", "boozy", "alcoholic", "high alcohol"] },
  { theme: "body", direction: "low", terms: ["light", "light bodied", "thin", "watery", "delicate", "diluted"] },

  { theme: "finish", direction: "neutral", terms: ["finish"] },
  { theme: "finish", direction: "high", terms: ["long finish", "lingering", "lingers", "persistent", "endless finish"] },
  { theme: "finish", direction: "low", terms: ["short finish", "no finish", "fell off", "disappeared", "fades quickly", "fleeting", "empty finish"] },

  {
    theme: "aromatics",
    direction: "neutral",
    terms: [
      "aromatic", "aromas", "aroma", "bouquet", "perfumed", "floral", "flowers", "violet", "violets", "rose petal", "lavender",
      "herbal", "herbs", "grassy", "earthy", "earth", "mineral", "minerality", "flint", "chalk", "leather", "tobacco",
      "spice", "spicy", "spices", "pepper", "peppery", "licorice", "liquorice", "mushroom", "forest floor", "truffle",
      "tar", "petrol", "barnyard", "funky", "funk", "savory", "savoury", "nutty", "almond", "salty", "saline",
    ],
  },

  { theme: "balance", direction: "high", terms: ["balanced", "well balanced", "balance", "harmonious", "harmony", "integrated", "cohesive"] },
  { theme: "balance", direction: "low", terms: ["unbalanced", "disjointed", "out of balance"] },

  { theme: "condition", direction: "neutral", terms: ["corked", "cork taint", "oxidized", "oxidised", "reduced", "reduction", "volatile", "vinegar", "vinegary", "premox", "faulty", "flawed"] },
];

export type ConversationDimension =
  | "tasting"
  | "food"
  | "vintage"
  | "value"
  | "comparison"
  | "aging"
  | "preference"
  | "style"
  | "serving";

export const DIMENSION_LABEL: Record<ConversationDimension, string> = {
  tasting: "tasting characteristics",
  food: "food pairing",
  vintage: "vintage differences",
  value: "price and value",
  comparison: "regional or grape comparison",
  aging: "aging potential",
  preference: "personal preference",
  style: "winemaking style",
  serving: "serving conditions",
};

export type InsightKind = "pairing" | "value" | "aging" | "serving" | "style" | "preference" | "comparison";

export const INSIGHT_DIMENSION: Record<InsightKind, ConversationDimension> = {
  pairing: "food",
  value: "value",
  aging: "aging",
  serving: "serving",
  style: "style",
  preference: "preference",
  comparison: "comparison",
};

const FOODS =
  "steak|beef|ribs|lamb|pork|chicken|duck|venison|game|burger|bbq|barbecue|pasta|pizza|risotto|lasagna|cheese|cheeses|charcuterie|salmon|fish|seafood|oysters|shrimp|sushi|salad|curry|chocolate|dessert|cake|tapas|stew|mushrooms|truffle";

/** Patterns that find advice or knowledge the reviewer shares, with the verbatim phrase. */
export const INSIGHT_PATTERNS: readonly { kind: InsightKind; pattern: RegExp }[] = [
  {
    kind: "pairing",
    pattern: new RegExp(
      `\\b(?:(?:paired?|pairs?|pairing|goes|going|great|good|perfect|amazing|works?)\\s+(?:well\\s+|nicely\\s+|great\\s+)?(?:with|alongside)|with|alongside)\\s+(?:(?:a|an|the|some|my|grilled|roast|roasted|aged|fresh|spicy|fatty|rich)\\s+){0,2}(?:${FOODS})\\b`,
      "i",
    ),
  },
  { kind: "pairing", pattern: /\bfood[- ]friendly\b/i },
  {
    kind: "value",
    pattern: /\b(?:for the price|great value|good value|value for money|bargain|overpriced|pricey|expensive|worth (?:it|the (?:price|money))|(?:€|\$|£)\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:€|(?:euros?|eur|usd|dollars?)\b)|worth every (?:cent|penny))/i,
  },
  {
    kind: "aging",
    pattern: /\b(?:needs? (?:more |some )?(?:time|age|aging|ageing|cellaring)|too young|age[- ]?worthy|past (?:its )?prime|drink now|cellar(?:ing|ed)?|will improve|drinking window|still (?:very )?young|tertiary|mature)\b/i,
  },
  {
    kind: "serving",
    pattern: /\b(?:decanted?|decanting|too cold|too warm|served (?:cold|chilled|cool|warm)|chilled|room temperature|opened up|opens up|needs? to breathe|aerated|\d+\s?(?:min(?:ute)?s?|hours?|hrs?) (?:in|after|of))\b/i,
  },
  {
    kind: "style",
    pattern: /\b(?:natural wine|natty|orange wine|skin[- ]contact|carbonic|amphora|biodynamic|organic|unfiltered|pet[- ]?nat|sur lie|lees|malolactic|barrique|stainless steel|whole[- ]cluster|wild ferment(?:ed|ation)?)\b/i,
  },
  {
    kind: "preference",
    pattern: /\b(?:not my (?:style|thing|cup of tea)|not for me|my (?:favou?rite|go-to)|i (?:usually|normally|generally|always|tend to) (?:prefer|like|love|drink)|not a fan|acquired taste)\b/i,
  },
  {
    kind: "comparison",
    pattern: /\b(?:reminds? me of|reminded me of|similar to|(?:tastes?|tasted) like|better than|worse than|compared (?:to|with)|versus|unlike|vs\.?)(?:\s+(?:the|a|an|other|last|previous))?(?:\s+[\p{L}\d'’-]+){0,3}/iu,
  },
];

/** Praise-only words: they never count as a specific detail. */
export const PRAISE_WORDS: ReadonlySet<string> = new Set([
  "great", "good", "nice", "love", "loved", "lovely", "amazing", "excellent", "delicious", "yummy", "tasty", "favorite", "favourite",
  "best", "superb", "fantastic", "wonderful", "beautiful", "perfect", "outstanding", "super", "awesome", "fine", "enjoy",
  "enjoyed", "enjoyable", "recommend", "recommended", "buy", "again", "wine", "bottle", "really", "very", "so", "quite",
  "bad", "awful", "terrible", "ok", "okay", "meh", "average", "decent", "cheers", "wow", "top", "pretty",
]);

export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "and", "or", "but", "this", "that", "it", "its", "is", "was", "are", "were", "be", "been", "i", "we",
  "you", "my", "me", "of", "to", "in", "on", "for", "with", "at", "as", "by", "from", "will", "would", "had", "have",
  "has", "just", "too", "not", "no", "than", "then", "there", "here", "one", "some", "got", "get",
]);

export const POSITIVE_WORDS: readonly string[] = ["love", "loved", "lovely", "great", "excellent", "delicious", "amazing", "favorite", "favourite", "best", "superb", "fantastic", "wonderful", "beautiful", "perfect", "outstanding", "enjoyed", "yummy", "tasty"];
export const NEGATIVE_WORDS: readonly string[] = ["disappointing", "disappointed", "bad", "awful", "bland", "boring", "meh", "undrinkable", "harsh", "unpleasant", "terrible", "poor", "overpriced", "not for me", "not a fan"];
