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
    aliases: ["grenache", "garnacha", "cannonau"],
    character: ["warmth and red-fruit character", "ripe red fruit and a softer structure"],
    drinkStyle: "flexible",
    pairings: ["grilled vegetables", "roast lamb"],
  },
  {
    name: "Pinot Noir",
    aliases: ["pinot noir", "pinot nero", "spatburgunder", "spätburgunder", "blauburgunder"],
    character: ["red fruit, earth, and a lighter body", "savory cherry and a silky texture when it's right"],
    drinkStyle: "flexible",
    pairings: ["duck", "mushroom dishes"],
  },
  {
    name: "Pinot Grigio",
    aliases: ["pinot grigio", "pinot gris", "grauburgunder", "rulander"],
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
    aliases: ["sangiovese", "nielluccio"],
    character: ["high acidity and rustic cherry", "food-friendly acidity and a savory edge"],
    drinkStyle: "age",
    pairings: ["tomato-based pasta", "pizza", "grilled meats"],
  },
  {
    name: "Tempranillo",
    aliases: ["tempranillo", "tinta roriz", "aragonez", "cencibel", "tinta de toro"],
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
  {
    name: "Müller-Thurgau",
    aliases: ["müller-thurgau", "muller-thurgau", "mueller-thurgau", "rivaner"],
    character: [
      "light floral aromatics and a gentle muscat-like note",
      "a soft, early-drinking white rather than a cellar grape",
    ],
    drinkStyle: "fresh",
    pairings: ["light salads", "mild cheeses"],
  },
  {
    name: "Grüner Veltliner",
    aliases: ["grüner veltliner", "gruner veltliner"],
    character: ["white pepper and lentil-like savoriness", "a crisp, food-friendly Austrian white"],
    drinkStyle: "fresh",
    pairings: ["schnitzel", "asparagus", "vegetable dishes"],
  },
  {
    name: "Gewürztraminer",
    aliases: ["gewürztraminer", "gewurztraminer", "gewurz"],
    character: ["lychee, rose, and spice aromatics", "a low-acid, highly aromatic white"],
    drinkStyle: "fresh",
    pairings: ["spicy Asian food", "Munster cheese"],
  },
  {
    name: "Albariño",
    aliases: ["albariño", "albarino", "alvarinho"],
    character: ["salty citrus and stone fruit", "a coastal, high-acid white"],
    drinkStyle: "fresh",
    pairings: ["seafood", "oysters"],
  },
  {
    name: "Pinot Blanc",
    aliases: ["pinot blanc", "pinot bianco", "weissburgunder", "weißburgunder"],
    character: ["quiet apple and pear with a softer acid than Pinot Grigio", "a gentle, food-friendly white"],
    drinkStyle: "fresh",
    pairings: ["roast chicken", "soft cheeses"],
  },
  {
    name: "Viognier",
    aliases: ["viognier"],
    character: ["apricot, peach, and a slight oiliness", "aromatic richness that can flatten if it gets too ripe"],
    drinkStyle: "fresh",
    pairings: ["roast chicken", "mildly spiced dishes"],
  },
  {
    name: "Sémillon",
    aliases: ["sémillon", "semillon"],
    character: ["wax, lemon, and a richer mid-palate than Sauvignon", "honeyed depth when it has a bit of age"],
    drinkStyle: "flexible",
    pairings: ["roast chicken", "rich fish"],
  },
  {
    name: "Vermentino",
    aliases: ["vermentino", "rolle"],
    character: ["citrus, herbs, and a slight saline edge", "a Mediterranean white built for seafood"],
    drinkStyle: "fresh",
    pairings: ["seafood", "olive-oil dishes"],
  },
  {
    name: "Verdicchio",
    aliases: ["verdicchio"],
    character: ["bitter almond and lemon with real acid", "a food white that can take a bit of bottle age"],
    drinkStyle: "flexible",
    pairings: ["fried seafood", "antipasti"],
  },
  {
    name: "Glera",
    aliases: ["glera", "prosecco"],
    character: ["light pear and white-flower notes", "a sparkling grape meant to drink young and cold"],
    drinkStyle: "fresh",
    pairings: ["antipasti", "light aperitivo food"],
  },
  {
    name: "Silvaner",
    aliases: ["silvaner", "sylvaner"],
    character: ["quiet herb and stone-fruit notes", "an earthy, food-first German white"],
    drinkStyle: "fresh",
    pairings: ["asparagus", "vegetable dishes"],
  },
  {
    name: "Kerner",
    aliases: ["kerner"],
    character: ["Riesling-like aromatics with a softer acid line", "a floral German crossing that drinks young"],
    drinkStyle: "fresh",
    pairings: ["spicy food", "mild cheeses"],
  },
  {
    name: "Scheurebe",
    aliases: ["scheurebe"],
    character: ["grapefruit and blackcurrant-leaf aromatics", "a vivid German aromatic white"],
    drinkStyle: "fresh",
    pairings: ["spicy food", "Asian dishes"],
  },
  {
    name: "Aligoté",
    aliases: ["aligote", "aligoté"],
    character: ["high acid and lemon-herb snap", "Burgundy's sharper everyday white"],
    drinkStyle: "fresh",
    pairings: ["oysters", "goat cheese"],
  },
  {
    name: "Melon de Bourgogne",
    aliases: ["melon de bourgogne", "muscadet"],
    character: ["lean citrus and a saline, yeasty edge", "built for oysters and youth, not cellar time"],
    drinkStyle: "fresh",
    pairings: ["oysters", "seafood"],
  },
  {
    name: "Torrontés",
    aliases: ["torrontés", "torrontes"],
    character: ["muscat-like florals with more acid than it smells", "an aromatic Argentine white that can tire if it sits"],
    drinkStyle: "fresh",
    pairings: ["empanadas", "spicy food"],
  },
  {
    name: "Verdejo",
    aliases: ["verdejo"],
    character: ["citrus, fennel, and a slight bitter finish", "Rueda's everyday high-acid white"],
    drinkStyle: "fresh",
    pairings: ["tapas", "seafood"],
  },
  {
    name: "Assyrtiko",
    aliases: ["assyrtiko"],
    character: ["piercing acid, lemon, and a stony saline finish", "a Greek island white that can take age and oak"],
    drinkStyle: "flexible",
    pairings: ["seafood", "lemon-heavy dishes"],
  },
  {
    name: "Furmint",
    aliases: ["furmint"],
    character: ["high acid and apple-to-honey range", "Tokaj's grape, equally serious dry or sweet"],
    drinkStyle: "flexible",
    pairings: ["foie gras", "spicy food"],
  },
  {
    name: "Trebbiano",
    aliases: ["trebbiano", "ugni blanc"],
    character: ["light citrus and a neutral, high-acid frame", "often a blending or everyday white rather than a star"],
    drinkStyle: "fresh",
    pairings: ["light seafood", "simple pasta"],
  },
  {
    name: "Garganega",
    aliases: ["garganega"],
    character: ["pear, almond, and a gentle bitter note", "Soave's grape when it is not stretched too far"],
    drinkStyle: "fresh",
    pairings: ["seafood", "risotto"],
  },
  {
    name: "Fiano",
    aliases: ["fiano"],
    character: ["hazelnut, honey, and citrus with more weight than it looks", "a southern Italian white that can take a little age"],
    drinkStyle: "flexible",
    pairings: ["seafood", "roast pork"],
  },
  {
    name: "Arneis",
    aliases: ["arneis"],
    character: ["pear and almond with a soft, rounded frame", "Piedmont's quieter white"],
    drinkStyle: "fresh",
    pairings: ["antipasti", "light pasta"],
  },
  {
    name: "Cortese",
    aliases: ["cortese"],
    character: ["lean citrus and a clean, mineral finish", "the grape behind Gavi, best when it stays tight"],
    drinkStyle: "fresh",
    pairings: ["seafood", "pesto"],
  },
  {
    name: "Grillo",
    aliases: ["grillo"],
    character: ["citrus and Mediterranean herbs", "a Sicilian white that can be simple or surprisingly structured"],
    drinkStyle: "fresh",
    pairings: ["seafood", "caponata"],
  },
  {
    name: "Carricante",
    aliases: ["carricante"],
    character: ["high acid, lemon, and a smoky Etna edge", "a volcanic white that can age"],
    drinkStyle: "flexible",
    pairings: ["seafood", "grilled vegetables"],
  },
  {
    name: "Pecorino",
    aliases: ["pecorino"],
    character: ["sage, citrus, and a salty, structured finish", "an Abruzzese white with more grip than most"],
    drinkStyle: "fresh",
    pairings: ["pecorino cheese", "lamb"],
  },
  {
    name: "Moschofilero",
    aliases: ["moschofilero"],
    character: ["rose, citrus, and a light, spicy perfume", "a Peloponnesian aromatic white"],
    drinkStyle: "fresh",
    pairings: ["seafood", "spicy food"],
  },
  {
    name: "Rkatsiteli",
    aliases: ["rkatsiteli"],
    character: ["high acid and apple-quince fruit", "Georgia's workhorse white, still or qvevri"],
    drinkStyle: "flexible",
    pairings: ["grilled vegetables", "herbed meats"],
  },
  {
    name: "Carmenère",
    aliases: ["carmenère", "carmenere"],
    character: ["green-pepper spice over ripe dark fruit", "Chile's signature red when it gets fully ripe"],
    drinkStyle: "flexible",
    pairings: ["grilled meats", "empanadas"],
  },
  {
    name: "Mourvèdre",
    aliases: ["mourvèdre", "mourvedre", "monastrell"],
    character: ["game, dark fruit, and firm tannin", "a late-ripening red that wants warmth and time"],
    drinkStyle: "age",
    pairings: ["roast lamb", "game"],
  },
  {
    name: "Carignan",
    aliases: ["carignan", "carinena", "cariñena", "mazuelo"],
    character: ["high acid and rustic red fruit", "old-vine bottles can be the serious face of a blending grape"],
    drinkStyle: "flexible",
    pairings: ["grilled meats", "cassoulet"],
  },
  {
    name: "Cinsault",
    aliases: ["cinsault", "cinsaut"],
    character: ["light red fruit and a silky, low-tannin frame", "often a blender, charming on its own when kept fresh"],
    drinkStyle: "fresh",
    pairings: ["charcuterie", "roast chicken"],
  },
  {
    name: "Petit Verdot",
    aliases: ["petit verdot"],
    character: ["ink, violet, and firm tannin", "a seasoning grape in Bordeaux, a fuller red on its own"],
    drinkStyle: "age",
    pairings: ["a good steak", "hard cheeses"],
  },
  {
    name: "Tannat",
    aliases: ["tannat"],
    character: ["dense tannin and dark fruit", "Madiran and Uruguay's structured red, better with air or age"],
    drinkStyle: "age",
    pairings: ["grilled meats", "hard cheeses"],
  },
  {
    name: "Montepulciano",
    aliases: ["montepulciano"],
    character: ["dark cherry, soft tannin, and a plush mid-palate", "Abruzzo's everyday red when yields stay in check"],
    drinkStyle: "flexible",
    pairings: ["tomato-based pasta", "grilled meats"],
  },
  {
    name: "Aglianico",
    aliases: ["aglianico"],
    character: ["firm tannin, dark fruit, and volcanic savor", "a southern Italian red that usually wants time"],
    drinkStyle: "age",
    pairings: ["braised beef", "hard cheeses"],
  },
  {
    name: "Nero d'Avola",
    aliases: ["nero d'avola", "nero davola"],
    character: ["ripe black cherry and a warm, round frame", "Sicily's everyday red, best when it keeps some freshness"],
    drinkStyle: "fresh",
    pairings: ["pasta with meat sauce", "grilled meats"],
  },
  {
    name: "Negroamaro",
    aliases: ["negroamaro"],
    character: ["dark fruit and a slightly bitter, rustic finish", "Puglia's warmer, fuller red"],
    drinkStyle: "fresh",
    pairings: ["hearty pasta", "barbecue"],
  },
  {
    name: "Corvina",
    aliases: ["corvina"],
    character: ["sour cherry and a lighter, bitter-almond edge", "Valpolicella's lead grape, including amarone-weight versions"],
    drinkStyle: "flexible",
    pairings: ["risotto", "grilled meats"],
  },
  {
    name: "Dolcetto",
    aliases: ["dolcetto"],
    character: ["dark cherry and a gentle bitter finish", "Piedmont's earlier-drinking red next to Nebbiolo"],
    drinkStyle: "fresh",
    pairings: ["pasta", "salumi"],
  },
  {
    name: "Lagrein",
    aliases: ["lagrein"],
    character: ["dark fruit, cocoa, and a slightly bitter alpine edge", "Alto Adige's fuller red"],
    drinkStyle: "flexible",
    pairings: ["speck", "game"],
  },
  {
    name: "Zweigelt",
    aliases: ["zweigelt"],
    character: ["juicy cherry and a soft, spicy frame", "Austria's everyday red, usually best young"],
    drinkStyle: "fresh",
    pairings: ["schnitzel", "grilled meats"],
  },
  {
    name: "Blaufränkisch",
    aliases: ["blaufränkisch", "blaufrankisch", "kekfrankos", "kékfrankos", "lemberger"],
    character: ["black pepper, dark fruit, and real acid", "Central Europe's serious, food-friendly red"],
    drinkStyle: "flexible",
    pairings: ["goulash", "roast pork"],
  },
  {
    name: "Pinotage",
    aliases: ["pinotage"],
    character: ["smoky, dark fruit with a distinctive roasted note", "South Africa's crossing, polarizing when overworked"],
    drinkStyle: "flexible",
    pairings: ["barbecue", "grilled meats"],
  },
  {
    name: "Touriga Nacional",
    aliases: ["touriga nacional"],
    character: ["dense dark fruit, violet, and firm tannin", "Portugal's flagship red, in Douro table wine and port"],
    drinkStyle: "age",
    pairings: ["roast lamb", "hard cheeses"],
  },
  {
    name: "Mencía",
    aliases: ["mencía", "mencia"],
    character: ["red fruit, herbs, and a lighter, Atlantic frame", "Bierzo and Ribeira Sacra's fresher Iberian red"],
    drinkStyle: "flexible",
    pairings: ["roast pork", "chorizo"],
  },
  {
    name: "Nerello Mascalese",
    aliases: ["nerello mascalese"],
    character: ["red fruit, smoke, and a Pinot-like frame on lava soils", "Etna's main red, often about site more than power"],
    drinkStyle: "flexible",
    pairings: ["grilled meats", "mushroom dishes"],
  },
  {
    name: "Sagrantino",
    aliases: ["sagrantino"],
    character: ["fierce tannin and dark fruit", "Montefalco's extreme structure, a grape that wants time and food"],
    drinkStyle: "age",
    pairings: ["braised beef", "hard cheeses"],
  },
  {
    name: "Bonarda",
    aliases: ["bonarda", "douce noir"],
    character: ["juicy dark fruit and a softer tannin than Malbec", "Argentina's second red, usually earlier drinking"],
    drinkStyle: "fresh",
    pairings: ["empanadas", "grilled meats"],
  },
  {
    name: "Dornfelder",
    aliases: ["dornfelder"],
    character: ["deep color and easy, juicy red fruit", "a German red built to drink young"],
    drinkStyle: "fresh",
    pairings: ["roast pork", "mild cheeses"],
  },
  {
    name: "Saperavi",
    aliases: ["saperavi"],
    character: ["inky color, dark fruit, and firm acid", "Georgia's teinturier red, still or qvevri"],
    drinkStyle: "age",
    pairings: ["grilled meats", "hard cheeses"],
  },
  {
    name: "Xinomavro",
    aliases: ["xinomavro"],
    character: ["high acid, tomato-leaf, and Nebbiolo-like tannin", "Naoussa's serious Greek red"],
    drinkStyle: "age",
    pairings: ["roast lamb", "tomato-based dishes"],
  },
  {
    name: "Agiorgitiko",
    aliases: ["agiorgitiko"],
    character: ["red fruit and a softer, rounder Greek frame", "Nemea's more approachable red next to Xinomavro"],
    drinkStyle: "flexible",
    pairings: ["grilled meats", "roast lamb"],
  },
  {
    name: "Petite Sirah",
    aliases: ["petite sirah", "petite syrah", "durif"],
    character: ["ink, pepper, and dense tannin", "a full Californian and Australian red, better with air"],
    drinkStyle: "age",
    pairings: ["barbecue", "a good steak"],
  },
];

export const KNOWN_GRAPE_NAMES: readonly string[] = GRAPE_KNOWLEDGE.map((grape) => grape.name);

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
  const exact = GRAPE_KNOWLEDGE.find(
    (entry) =>
      normalize(entry.name) === normalized ||
      entry.aliases.some((alias) => normalize(alias) === normalized)
  );
  if (exact) return exact;

  return GRAPE_KNOWLEDGE.find((entry) =>
    [entry.name, ...entry.aliases].some((label) => {
      const alias = normalize(label);
      return new RegExp(`(^|[^a-z])${escapeRegex(alias)}([^a-z]|$)`).test(` ${normalized} `);
    })
  );
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
