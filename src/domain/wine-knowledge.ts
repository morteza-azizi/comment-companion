// General domain knowledge about wine regions and grapes — NOT facts about
// any specific bottle. This is what lets the generator say things like
// "Mosel is known for Riesling" as a general statement about the region's
// style, without ever implying that a specific unlabelled bottle from
// Mosel is definitely made of Riesling.

export interface RegionKnowledge {
  name: string;
  aliases: readonly string[];
  /** Grape(s) typically associated with the region — knowledge, not a fact about any one bottle. */
  typicalGrapes: readonly string[];
  /** Whether the region is traditionally known for blending multiple grapes. */
  isBlendRegion: boolean;
  /** Rough rule-of-thumb aging window for the region's classic style. */
  agingPotential?: string;
  /** Short, factual-sounding observations usable in "{region} is known for ___" style sentences. */
  observations: readonly string[];
}

export type DrinkStyle = "fresh" | "flexible" | "age";

export interface GrapeKnowledge {
  name: string;
  aliases: readonly string[];
  /** Sensory/structure notes — pick one per comment so the same grape does not always sound identical. */
  character: readonly string[];
  /** Whether the grape is typically drunk young, can go either way, or wants time. */
  drinkStyle: DrinkStyle;
  pairings: readonly string[];
}

export const REGION_KNOWLEDGE: readonly RegionKnowledge[] = [
  {
    name: "Bordeaux",
    aliases: [
      "bordeaux",
      "medoc",
      "saint-emilion",
      "saint emilion",
      "pauillac",
      "margaux",
      "pomerol",
      "graves",
    ],
    typicalGrapes: ["Cabernet Sauvignon", "Merlot"],
    isBlendRegion: true,
    agingPotential: "10-20 years",
    observations: [
      "serious structure and real aging potential",
      "classic Cabernet-Merlot blending",
      "that firm Left Bank backbone",
    ],
  },
  {
    name: "Rhône",
    aliases: [
      "rhone",
      "rhône",
      "cotes du rhone",
      "côtes du rhône",
      "chateauneuf",
      "châteauneuf",
      "hermitage",
      "cornas",
      "gigondas",
    ],
    typicalGrapes: ["Syrah", "Grenache"],
    isBlendRegion: true,
    agingPotential: "8-15 years",
    observations: [
      "that peppery Syrah spice",
      "GSM blends that overdeliver",
      "punching above its price point",
    ],
  },
  {
    name: "Burgundy",
    aliases: [
      "burgundy",
      "bourgogne",
      "cote de nuits",
      "côte de nuits",
      "cote de beaune",
      "côte de beaune",
      "chablis",
      "beaune",
      "nuits-saint-georges",
    ],
    typicalGrapes: ["Pinot Noir", "Chardonnay"],
    isBlendRegion: false,
    agingPotential: "5-15 years",
    observations: [
      "terroir-driven Pinot and Chardonnay",
      "wild vintage variation",
      "turning Chardonnay into something else entirely",
    ],
  },
  {
    name: "Champagne",
    aliases: ["champagne", "reims", "epernay", "épernay"],
    typicalGrapes: ["Chardonnay", "Pinot Noir", "Pinot Meunier"],
    isBlendRegion: true,
    agingPotential: "a decade or more for vintage bottlings",
    observations: [
      "that toasty, brioche character",
      "grower bottlings that overdeliver versus the big houses",
      "being criminally underrated outside of celebrations",
    ],
  },
  {
    name: "Mosel",
    aliases: ["mosel", "moselle"],
    typicalGrapes: ["Riesling"],
    isBlendRegion: false,
    agingPotential: "10-20 years",
    observations: [
      "that slate-driven minerality",
      "racy acidity even at low alcohol",
      "aging far better than you'd expect",
    ],
  },
  {
    name: "Tuscany",
    aliases: ["tuscany", "toscana", "chianti", "brunello", "montalcino", "montepulciano", "maremma"],
    typicalGrapes: ["Sangiovese"],
    isBlendRegion: false,
    agingPotential: "10+ years for a good Brunello or Riserva",
    observations: [
      "that rustic, sun-baked character",
      "Sangiovese's natural acidity",
      "Brunello that rewards patience",
    ],
  },
  {
    name: "Rioja",
    aliases: ["rioja"],
    typicalGrapes: ["Tempranillo"],
    isBlendRegion: false,
    agingPotential: "10-20 years for a Gran Reserva",
    observations: [
      "that classic oak-aged style",
      "Tempranillo that ages gracefully",
      "serious value for the quality",
    ],
  },
  {
    name: "Piedmont",
    aliases: ["piedmont", "piemonte", "barolo", "barbaresco", "langhe"],
    typicalGrapes: ["Nebbiolo"],
    isBlendRegion: false,
    agingPotential: "15-20 years for a serious Barolo or Barbaresco",
    observations: [
      "Nebbiolo's stubborn tannins",
      "that rose-and-tar aromatic signature",
      "wines that need patience young",
    ],
  },
  {
    name: "Napa",
    aliases: ["napa", "napa valley", "oakville", "rutherford", "stags leap"],
    typicalGrapes: ["Cabernet Sauvignon"],
    isBlendRegion: false,
    agingPotential: "10-15 years for a top Cabernet",
    observations: [
      "bold, oak-forward Cabernet",
      "hillside fruit with real structure",
      "New World Cabernet at its most opulent",
    ],
  },
  {
    name: "Friuli",
    aliases: ["friuli", "collio", "isonzo", "grave del friuli", "friuli-venezia giulia"],
    typicalGrapes: ["Friulano", "Pinot Grigio", "Sauvignon Blanc"],
    isBlendRegion: false,
    observations: [
      "crisp, aromatic whites",
      "Friulano with that almond-bitter finish",
      "some of Italy's most precise white wines",
    ],
  },
  {
    name: "Mendoza",
    aliases: ["mendoza"],
    typicalGrapes: ["Malbec"],
    isBlendRegion: false,
    observations: [
      "ripe, sun-driven Malbec",
      "high-altitude fruit with real concentration",
    ],
  },
];

export const GRAPE_KNOWLEDGE: readonly GrapeKnowledge[] = [
  {
    name: "Cabernet Sauvignon",
    aliases: ["cabernet sauvignon"],
    character: ["structure, blackcurrant, and firm tannins", "real aging potential and a serious backbone"],
    drinkStyle: "age",
    pairings: ["a good steak", "roast lamb"],
  },
  {
    name: "Cabernet Franc",
    aliases: ["cabernet franc"],
    character: [
      "herbaceous notes and a lighter frame than Cabernet Sauvignon",
      "a greener, more savory Cabernet cousin",
    ],
    drinkStyle: "flexible",
    pairings: ["roasted vegetables", "herb-crusted lamb"],
  },
  {
    name: "Merlot",
    aliases: ["merlot"],
    character: ["plush fruit and softer tannins than Cabernet", "rounder and earlier-drinking than Cabernet"],
    drinkStyle: "flexible",
    pairings: ["roasted lamb", "mushroom dishes"],
  },
  {
    name: "Syrah",
    aliases: ["syrah", "shiraz"],
    character: ["peppery spice and dark fruit", "a smoky, meaty edge when it's from a cooler site"],
    drinkStyle: "age",
    pairings: ["grilled meats", "barbecue"],
  },
  {
    name: "Grenache",
    aliases: ["grenache", "garnacha"],
    character: ["warmth and red-fruit character", "ripe red fruit and a softer structure"],
    drinkStyle: "flexible",
    pairings: ["grilled vegetables", "roast lamb"],
  },
  {
    name: "Pinot Noir",
    aliases: ["pinot noir"],
    character: ["red fruit, earth, and a lighter body", "savory cherry and a silky texture when it's right"],
    drinkStyle: "flexible",
    pairings: ["duck", "mushroom dishes"],
  },
  {
    name: "Pinot Grigio",
    aliases: ["pinot grigio", "pinot gris"],
    character: ["crisp pear and citrus when it stays fresh and dry", "a light, easygoing white when it's well made"],
    drinkStyle: "fresh",
    pairings: ["light seafood", "salads"],
  },
  {
    name: "Chardonnay",
    aliases: ["chardonnay"],
    character: [
      "green apple and citrus when it's unoaked",
      "a round, toasty character when it's been in barrel",
      "a wide range from crisp and lean to rich and buttery",
    ],
    drinkStyle: "flexible",
    pairings: ["roast chicken", "creamy pasta", "lobster or scallops", "mushroom dishes"],
  },
  {
    name: "Riesling",
    aliases: ["riesling"],
    character: ["racy acidity and citrus or stone-fruit notes", "high acid and a surprising ability to age"],
    drinkStyle: "flexible",
    pairings: ["spicy food", "Asian dishes", "fresh goat cheese"],
  },
  {
    name: "Sangiovese",
    aliases: ["sangiovese"],
    character: ["high acidity and rustic cherry", "food-friendly acidity and a savory edge"],
    drinkStyle: "age",
    pairings: ["tomato-based pasta", "pizza", "grilled meats"],
  },
  {
    name: "Tempranillo",
    aliases: ["tempranillo"],
    character: ["cherry fruit that ages into vanilla and leather", "oak-aged spice and a savory finish"],
    drinkStyle: "age",
    pairings: ["chorizo", "grilled meats", "manchego"],
  },
  {
    name: "Nebbiolo",
    aliases: ["nebbiolo"],
    character: ["firm tannins and rose-and-tar aromatics", "a stubborn structure that usually wants time"],
    drinkStyle: "age",
    pairings: ["truffle dishes", "rich pasta", "braised beef"],
  },
  {
    name: "Sauvignon Blanc",
    aliases: ["sauvignon blanc", "sauvignon"],
    character: ["zippy acidity and herbaceous citrus notes", "gooseberry and grass when it's from a cool climate"],
    drinkStyle: "fresh",
    pairings: ["goat cheese", "seafood", "salads"],
  },
  {
    name: "Malbec",
    aliases: ["malbec"],
    character: ["deep color and ripe dark fruit", "plush texture and generous blackberry notes"],
    drinkStyle: "fresh",
    pairings: ["a good steak", "grilled meats", "empanadas"],
  },
  {
    name: "Primitivo",
    aliases: ["primitivo", "zinfandel"],
    character: ["ripe jammy fruit and a full body", "generous fruit that's usually best young"],
    drinkStyle: "fresh",
    pairings: ["hearty pasta", "barbecue"],
  },
  {
    name: "Chenin Blanc",
    aliases: ["chenin blanc"],
    character: ["apple, honey, and bright acidity", "equally at home dry, sweet, or sparkling"],
    drinkStyle: "flexible",
    pairings: ["seafood", "roast pork"],
  },
  {
    name: "Friulano",
    aliases: ["friulano", "tocai friulano"],
    character: ["a dry, almond-bitter finish", "quiet fruit and a slightly bitter almond note"],
    drinkStyle: "fresh",
    pairings: ["prosciutto", "almonds", "light seafood"],
  },
  {
    name: "Ribolla Gialla",
    aliases: ["ribolla gialla", "ribolla"],
    character: ["high acidity and a floral, citrus profile", "bright, slightly tannic whites when skin-fermented"],
    drinkStyle: "fresh",
    pairings: ["fried seafood", "antipasti"],
  },
  {
    name: "Barbera",
    aliases: ["barbera"],
    character: ["bright acidity and juicy red fruit", "high acid and early drinking"],
    drinkStyle: "fresh",
    pairings: ["tomato-based pasta", "pizza"],
  },
  {
    name: "Gamay",
    aliases: ["gamay"],
    character: ["light body and crunchy red fruit", "meant to be drunk young and slightly chilled"],
    drinkStyle: "fresh",
    pairings: ["charcuterie", "roast chicken"],
  },
  {
    name: "Muscat",
    aliases: ["muscat", "moscato", "moscato bianco", "muscat blanc", "white muscat"],
    character: ["floral, grapey aromatics", "orange blossom and grape notes that fade if it sits too long"],
    drinkStyle: "fresh",
    pairings: ["spicy food", "a fruit-and-cheese plate", "light desserts"],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function findRegionKnowledge(region?: string): RegionKnowledge | undefined {
  if (!region) return undefined;
  const normalized = normalize(region);
  return REGION_KNOWLEDGE.find((r) => r.aliases.some((alias) => normalized.includes(normalize(alias))));
}

export function findGrapeKnowledge(grape?: string): GrapeKnowledge | undefined {
  if (!grape) return undefined;
  const normalized = normalize(grape);
  return GRAPE_KNOWLEDGE.find((g) => g.aliases.some((alias) => normalized.includes(normalize(alias))));
}

// Reads grape names that are literally present in a wine title. That is a
// fact extracted from the label/name, not a region guess — "Malbec 2024"
// is Malbec; "Le Caprice" is not a grape just because it is a branded cuvée.
export function detectGrapesInText(text?: string): string[] {
  if (!text) return [];

  const ranked = GRAPE_KNOWLEDGE.flatMap((grape) =>
    grape.aliases.map((alias) => ({
      name: grape.name,
      alias: normalize(alias),
    }))
  ).sort((a, b) => b.alias.length - a.alias.length);

  const found: string[] = [];
  let haystack = ` ${normalize(text)} `;
  for (const { name, alias } of ranked) {
    if (found.includes(name)) continue;
    const pattern = new RegExp(`[^a-z]${escapeRegex(alias)}[^a-z]`);
    if (!pattern.test(haystack)) continue;
    found.push(name);
    haystack = haystack.replace(pattern, " ");
  }
  return found;
}

// Parses grape names out of a Vivino wine-page HTML dump via the stable
// `/grapes/` link pattern, not hashed CSS classes. Link text is preferred;
// the URL slug is a fallback.
export function grapesFromWinePageHtml(html: string): string[] {
  const found: string[] = [];

  const add = (raw: string): void => {
    const cleaned = raw.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (!cleaned || /^see all/i.test(cleaned)) return;
    const known = findGrapeKnowledge(cleaned);
    const name = known?.name ?? titleCaseGrape(cleaned);
    if (name && !found.includes(name)) found.push(name);
  };

  for (const match of html.matchAll(/<a[^>]+href=["'][^"']*\/grapes?\/[^"']*["'][^>]*>([^<]+)<\/a>/gi)) {
    add(match[1]);
  }

  if (found.length === 0) {
    for (const match of html.matchAll(/\/grapes?\/([a-z0-9-]+)/gi)) {
      const slug = match[1];
      if (/^\d+$/.test(slug)) continue;
      add(slug.replace(/-/g, " "));
    }
  }

  return found;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCaseGrape(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
