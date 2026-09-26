import type { WineColor, WineContext } from "./wine-context";
import { hasAnyMarker, normalizeText } from "./text-match";

export interface RoseCharacter {
  character: string;
  pairing: string;
}

const ROSE_BY_GRAPE: Record<string, RoseCharacter> = {
  "Pinot Noir": {
    character: "light red fruit in a chillable pink, not the savory red",
    pairing: "salads or grilled salmon",
  },
  Grenache: {
    character: "strawberry and a dry, savory finish when it's well made",
    pairing: "grilled fish or picnic food",
  },
  Syrah: {
    character: "pepper and red fruit in a colder, lighter glass than the red version",
    pairing: "charcuterie or grilled vegetables",
  },
  Tempranillo: {
    character: "cherry fruit without the oak-and-leather weight of a reserva red",
    pairing: "tapas or grilled vegetables",
  },
  Sangiovese: {
    character: "sour cherry and acid, without the rustic tannin of the red",
    pairing: "tomato salads or light pasta",
  },
  Malbec: {
    character: "softer dark-pink fruit, not the plush red",
    pairing: "empanadas or grilled vegetables",
  },
  "Cabernet Sauvignon": {
    character: "a pale, herbal pink — not Cabernet structure",
    pairing: "salads or grilled chicken",
  },
  Merlot: {
    character: "soft red fruit and a round, low-tannin pink",
    pairing: "picnic food or mild cheeses",
  },
  Mourvèdre: {
    character: "savory and pale, much lighter than a Bandol-style red",
    pairing: "grilled fish or olives",
  },
};

const ROSE_DEFAULT: RoseCharacter = {
  character: "lighter fruit than the same grape as a red, and meant to be drunk cold",
  pairing: "salads, grilled fish, or anything served cold",
};

const ROSE_MARKERS = [
  "rose",
  "rosé",
  "rosato",
  "rosado",
  "weissherbst",
  "weißherbst",
  "blush",
  "vin gris",
];

const SPARKLING_MARKERS = [
  "sparkling",
  "prosecco",
  "cava",
  "sekt",
  "champagne",
  "cremant",
  "crémant",
  "spumante",
  "brut",
  "frizzante",
];

const ROSE_REGIONS = ["provence", "cotes de provence", "côtes de provence", "tavel"];

export function detectWineColor(
  context: Pick<WineContext, "wineName" | "style" | "reviewText" | "region">
): WineColor | undefined {
  const label = `${context.style ?? ""} ${context.wineName ?? ""}`;
  const review = context.reviewText ?? "";
  const blob = `${label} ${review}`;
  if (hasAnyMarker(blob, SPARKLING_MARKERS)) return "sparkling";
  // "rose" in a tasting note often means rose-petal aroma, not wine color.
  if (hasAnyMarker(label, ROSE_MARKERS) || hasAnyMarker(review, ["rosé", "rosato", "rosado", "weissherbst", "weißherbst"])) {
    return "rose";
  }
  if (hasAnyMarker(blob, ["orange wine", "skin-contact", "skin contact", "amber wine"])) return "orange";

  const style = normalizeText(context.style ?? "");
  if (style) {
    if (/ros/.test(style)) return "rose";
    if (/spark|fizz/.test(style)) return "sparkling";
    if (/white|blanc|bianco/.test(style)) return "white";
    if (/red|rouge|rosso|tinto/.test(style)) return "red";
  }

  if (hasAnyMarker(blob, ["white wine", "weisswein"]) && !hasAnyMarker(blob, ["pinot blanc", "sauvignon blanc"])) {
    return "white";
  }
  if (hasAnyMarker(blob, ["red wine", "vin rouge", "vino rosso", "vino tinto"])) return "red";

  const region = normalizeText(context.region ?? "");
  if (region && ROSE_REGIONS.some((name) => region.includes(name)) && !hasAnyMarker(blob, ["rouge", "red", "tinto"])) {
    return "rose";
  }

  return undefined;
}

export function roseCharacterFor(grape?: string): RoseCharacter {
  if (grape && ROSE_BY_GRAPE[grape]) return ROSE_BY_GRAPE[grape];
  return ROSE_DEFAULT;
}

export function isRose(color?: WineColor): boolean {
  return color === "rose";
}
