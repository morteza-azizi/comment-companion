// Grape NAMES only. Used to read a variety that is literally present in a
// wine's title, or listed on its wine page. Nothing here says what a grape
// tastes like: the tool must never assert wine characteristics.

const GRAPES: Record<string, readonly string[]> = {
  "Cabernet Sauvignon": ["cabernet sauvignon", "cab sauv"],
  "Cabernet Franc": ["cabernet franc"],
  Merlot: ["merlot"],
  Syrah: ["syrah", "shiraz"],
  Grenache: ["grenache", "garnacha"],
  "Pinot Noir": ["pinot noir", "spatburgunder", "blauburgunder"],
  "Pinot Grigio": ["pinot grigio", "pinot gris"],
  "Pinot Blanc": ["pinot blanc", "pinot bianco", "weissburgunder"],
  Chardonnay: ["chardonnay"],
  Riesling: ["riesling"],
  Sangiovese: ["sangiovese"],
  Tempranillo: ["tempranillo", "tinto fino"],
  Nebbiolo: ["nebbiolo"],
  "Sauvignon Blanc": ["sauvignon blanc"],
  Malbec: ["malbec"],
  Primitivo: ["primitivo", "zinfandel"],
  "Chenin Blanc": ["chenin blanc"],
  Barbera: ["barbera"],
  Gamay: ["gamay"],
  Muscat: ["muscat", "moscato"],
  "Grüner Veltliner": ["gruner veltliner"],
  Gewürztraminer: ["gewurztraminer"],
  Albariño: ["albarino", "alvarinho"],
  Viognier: ["viognier"],
  Sémillon: ["semillon"],
  Vermentino: ["vermentino"],
  Verdicchio: ["verdicchio"],
  Glera: ["glera"],
  Carmenère: ["carmenere"],
  Mourvèdre: ["mourvedre", "monastrell"],
  Carignan: ["carignan"],
  Cinsault: ["cinsault"],
  Tannat: ["tannat"],
  Montepulciano: ["montepulciano"],
  Aglianico: ["aglianico"],
  "Nero d'Avola": ["nero d'avola"],
  Dolcetto: ["dolcetto"],
  Zweigelt: ["zweigelt"],
  Blaufränkisch: ["blaufrankisch"],
  Pinotage: ["pinotage"],
  "Touriga Nacional": ["touriga nacional"],
  Mencía: ["mencia"],
  Furmint: ["furmint"],
  Assyrtiko: ["assyrtiko"],
  Verdejo: ["verdejo"],
  Trebbiano: ["trebbiano"],
  Garganega: ["garganega"],
  Fiano: ["fiano"],
  Arneis: ["arneis"],
  Nerello: ["nerello mascalese"],
  "Petit Verdot": ["petit verdot"],
};

const ALIASES: { name: string; alias: string }[] = Object.entries(GRAPES)
  .flatMap(([name, aliases]) => [name, ...aliases].map((alias) => ({ name, alias: fold(alias) })))
  .sort((a, b) => b.alias.length - a.alias.length);

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Grapes literally named in a wine title ("Malbec 2022" is Malbec; a branded
 * cuvée name is not a grape). A fact read from the label, never a guess.
 */
export function detectGrapesInText(text?: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  let haystack = ` ${fold(text)} `;
  for (const { name, alias } of ALIASES) {
    if (found.includes(name)) continue;
    const pattern = new RegExp(`[^a-z]${escapeRegex(alias)}[^a-z]`);
    if (!pattern.test(haystack)) continue;
    found.push(name);
    haystack = haystack.replace(pattern, " ");
  }
  return found;
}
