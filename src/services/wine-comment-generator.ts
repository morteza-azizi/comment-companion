export interface WineCommentInput {
  region?: string;
  grape?: string;
  producer?: string;
  style?: string;
  rating?: string;
  vintage?: string;
  wineName?: string;
}

interface RegionProfile {
  aliases: readonly string[];
  templates: readonly string[];
  // General aging-potential guidance for the region's classic style — a
  // well-known rule of thumb, not a claim about this exact bottle's condition.
  aging?: string;
}

export class WineCommentGenerator {
  private static readonly MAX_WORDS = 25;
  private static readonly MENTION_CHANCE = 0.65;
  private static readonly STYLE_OPENER_CHANCE = 0.3;
  private static readonly EMOJI_CHANCE = 0.45;
  private static readonly RATING_CHANCE = 0.4;
  private static readonly VINTAGE_CHANCE = 0.35;
  private static readonly PAIRING_CHANCE = 0.35;
  private static readonly AGING_CHANCE = 0.35;
  private static readonly QUESTION_CHANCE = 0.12;
  private static readonly MAX_ATTEMPTS = 300;

  // These react to *seeing someone else's rating/post*, not to personally
  // tasting the wine — this generator is meant for commenting on other
  // people's activity, so it must never imply the commenter opened the
  // bottle themselves.
  private static readonly OPENERS: readonly string[] = [
    "Great pick",
    "Nice find here",
    "This one caught my eye",
    "Solid choice, by the look of it",
    "This looks like a fun bottle",
    "Adding this one to my list",
    "This one's now on my radar",
    "Really like the sound of this one",
    "This looks worth tracking down",
    "Good instinct picking this one",
    "This one's going on my wishlist",
    "Nice looking bottle",
  ];

  private static readonly STYLE_OPENERS: readonly string[] = [
    "Always up for a good {style}",
    "A {style} like this is exactly what I look for",
    "This {style} looks like it lives up to the hype",
  ];

  private static readonly GENERIC_REGION_PHRASES: readonly string[] = [
    "always curious about wines from {region}",
    "{region} doesn't get enough love, in my opinion",
    "keeping an eye on producers from {region}",
    "{region} has been on my radar lately",
    "would love to explore more from {region}",
    "need to try more wines from {region}",
    "don't see enough {region} wines on here",
    "{region} usually over-delivers for the price",
  ];

  // Grape is rarely stated on a compact activity card, so when it's not
  // explicitly known this is inferred from the region (see GRAPE_BY_REGION)
  // and always phrased as a hedge, not a fact about this specific bottle.
  private static readonly GRAPE_PHRASES: readonly string[] = [
    "probably built around {grape}, going by the region",
    "likely leaning on {grape}, if that's typical there",
    "usually means {grape} in that part of the world",
    "safe bet there's some {grape} in the mix",
    "{grape} is usually the go-to grape around there",
    "{grape} is one of my favorite grapes to explore",
    "always curious what {grape} does in different hands",
  ];

  private static readonly PRODUCER_PHRASES: readonly string[] = [
    "{producer} has a solid reputation",
    "always keep an eye out for {producer}",
    "{producer} rarely misses, from what I've heard",
    "{producer} seems like a safe bet",
    "good to see {producer} on here",
    "hadn't heard of {producer} before, noting that down",
    "heard good things about {producer} before",
  ];

  private static readonly RATING_PHRASES: readonly string[] = [
    "a {rating} rating is a solid sign",
    "{rating} average has me curious",
    "hard to argue with a {rating} score",
    "that {rating} rating stands out",
    "not bad at all for a {rating} average",
    "{rating} is nothing to sneeze at",
    "a {rating} score usually means it's worth a look",
  ];

  // Kept deliberately concrete (drinking window, aging) rather than vague
  // filler like "an interesting year" or "a talked-about year" — that kind
  // of hedge-y, says-nothing phrasing is a dead giveaway that a comment is
  // generated rather than something a person actually typed.
  private static readonly VINTAGE_PHRASES: readonly string[] = [
    "curious how the {vintage} is drinking already",
    "wondering if {vintage} needs more time in the bottle",
    "always curious how {vintage} vintages age",
    "hoping {vintage} is showing well this early",
  ];

  private static readonly PAIRING_PHRASES: readonly string[] = [
    "sounds like it'd go well with {pairing}",
    "curious how this does alongside {pairing}",
    "seems like a natural match for {pairing}",
    "might be worth pairing with {pairing}",
    "could see this working well with {pairing}",
  ];

  private static readonly AGING_PHRASES: readonly string[] = [
    "could easily have {aging} of aging potential",
    "the kind of wine that could go {aging} if you're patient",
    "worth tucking away for {aging} if you can resist it",
    "typically rewards {aging} in the cellar",
    "built to handle {aging} of age, from what I understand",
  ];

  // Best-effort grape -> pairing suggestion, offered as a speculative idea
  // rather than a claim about how this specific bottle was actually served.
  private static readonly FOOD_PAIRING_BY_GRAPE: Record<string, string> = {
    "cabernet sauvignon": "a good steak",
    merlot: "roasted lamb",
    "pinot noir": "duck or mushroom dishes",
    syrah: "grilled meats",
    shiraz: "barbecue",
    sangiovese: "tomato-based pasta",
    nebbiolo: "truffle dishes",
    tempranillo: "chorizo or grilled meats",
    riesling: "spicy food",
    chardonnay: "roast chicken",
    "sauvignon blanc": "goat cheese",
    grenache: "grilled vegetables",
    malbec: "a good steak",
    primitivo: "hearty pasta",
    "nero d'avola": "grilled sausage",
    corvina: "braised short rib",
    "touriga nacional": "roasted pork",
    gamay: "charcuterie",
    "chenin blanc": "seafood",
    assyrtiko: "grilled fish",
  };

  // Best-effort region -> typical grape mapping, used only to hedge a grape
  // mention when the page didn't expose one directly. Never presented as a
  // fact about the specific bottle, only as regional generalization.
  private static readonly GRAPE_BY_REGION: ReadonlyArray<{
    aliases: readonly string[];
    grape: string;
  }> = [
    { aliases: ["puglia", "apulia", "salento", "manduria"], grape: "Primitivo" },
    { aliases: ["sicily", "sicilia", "etna"], grape: "Nero d'Avola" },
    { aliases: ["veneto", "valpolicella", "amarone", "soave"], grape: "Corvina" },
    { aliases: ["douro"], grape: "Touriga Nacional" },
    { aliases: ["priorat", "priorato"], grape: "Garnacha" },
    { aliases: ["ribera del duero"], grape: "Tempranillo" },
    { aliases: ["alsace"], grape: "Riesling" },
    { aliases: ["loire", "sancerre", "vouvray", "chinon"], grape: "Chenin Blanc" },
    { aliases: ["beaujolais"], grape: "Gamay" },
    { aliases: ["languedoc", "roussillon", "minervois", "corbieres"], grape: "Grenache" },
    { aliases: ["barossa", "mclaren vale"], grape: "Shiraz" },
    { aliases: ["margaret river"], grape: "Cabernet Sauvignon" },
    { aliases: ["marlborough"], grape: "Sauvignon Blanc" },
    { aliases: ["central otago"], grape: "Pinot Noir" },
    { aliases: ["mendoza"], grape: "Malbec" },
    { aliases: ["stellenbosch"], grape: "Cabernet Sauvignon" },
    { aliases: ["willamette"], grape: "Pinot Noir" },
    { aliases: ["sonoma"], grape: "Pinot Noir" },
    { aliases: ["finger lakes"], grape: "Riesling" },
    { aliases: ["santorini"], grape: "Assyrtiko" },
  ];

  private static readonly EMOJIS: readonly string[] = [
    "🍷",
    "🍇",
    "😋",
    "👌",
    "🔥",
    "✨",
    "🙌",
    "😍",
    "🥂",
  ];

  // Curated per-region knowledge so comments reference the typical grapes/style of
  // the region without asserting the commenter actually tasted this specific bottle.
  private static readonly REGION_PROFILES: Record<string, RegionProfile> = {
    Bordeaux: {
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
      templates: [
        "Bordeaux blends like this usually reward a few more years in the cellar.",
        "Cab-Merlot blends from Bordeaux rarely disappoint when the vintage is right.",
        "Curious how this Bordeaux is drinking now versus in five years.",
        "Classic Left Bank structure — these always seem built to age.",
        "Bordeaux still sets the standard for Cabernet-Merlot blends, in my book.",
        "{producer} usually delivers solid, age-worthy Bordeaux — hoping this one holds up.",
      ],
      aging: "10-20 years",
    },
    Rhone: {
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
      templates: [
        "Rhône reds always bring that peppery Syrah spice I can't get enough of.",
        "GSM blends from the Southern Rhône are so hard to get wrong.",
        "Northern Rhône Syrah has a smoky edge that's instantly recognizable.",
        "Châteauneuf blends like this usually need a decant to open up.",
        "Rhône wines punch above their price point more often than not.",
        "{producer} makes some seriously reliable Rhône blends, from what I've seen.",
      ],
      aging: "8-15 years",
    },
    Burgundy: {
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
      templates: [
        "Burgundy Pinot is all about the terroir — every village tastes different.",
        "Red or white, Burgundy rarely does anything halfway.",
        "This region turns Chardonnay into something completely different from anywhere else.",
        "Burgundy pricing is wild, but the quality usually backs it up.",
        "Pinot from this region is famously fickle vintage to vintage.",
        "{producer} has a reputation for classic, restrained Burgundy style.",
      ],
      aging: "5-15 years",
    },
    Champagne: {
      aliases: ["champagne", "reims", "epernay", "épernay"],
      templates: [
        "Champagne always feels like an occasion, even on a random Tuesday.",
        "That toasty, brioche note is the giveaway for proper Champagne.",
        "Grower Champagne like this often overdelivers versus the big houses.",
        "Champagne is criminally underrated outside of celebrations, honestly.",
        "{producer} Champagne is usually a safe bet for the money.",
        "Blanc de blancs from this region are hard to beat.",
      ],
      aging: "a decade or more for vintage bottlings",
    },
    Mosel: {
      aliases: ["mosel", "moselle"],
      templates: [
        "Mosel Riesling has that slate minerality you just don't get elsewhere.",
        "Low alcohol, high acid — Mosel Riesling is endlessly food-friendly.",
        "Those steep river slopes really do come through in the glass.",
        "Mosel Rieslings age surprisingly well for something this light on paper.",
        "{producer} Riesling from the Mosel is usually a reliable pick.",
        "Sweet or dry, Mosel Riesling rarely loses that racy acidity.",
      ],
      aging: "10-20 years",
    },
    Tuscany: {
      aliases: [
        "tuscany",
        "toscana",
        "chianti",
        "brunello",
        "montalcino",
        "montepulciano",
        "maremma",
      ],
      templates: [
        "Sangiovese from Tuscany just wants a plate of pasta next to it.",
        "Chianti this good usually means the Sangiovese was handled with care.",
        "Brunello needs patience, but Tuscany rarely lets you down eventually.",
        "Tuscan reds have that rustic, sun-baked character I keep coming back to.",
        "{producer} Chianti is one of those dependable weeknight bottles.",
        "Super Tuscans blur the line, but the quality speaks for itself.",
      ],
      aging: "10+ years for a good Brunello or Riserva",
    },
    Rioja: {
      aliases: ["rioja"],
      templates: [
        "Rioja Reserva always smells like vanilla and old leather to me.",
        "Tempranillo from Rioja ages so gracefully when it's done right.",
        "Gran Reserva Rioja is basically a lesson in patience done well.",
        "That classic oak-aged Rioja profile is instantly recognizable.",
        "{producer} Rioja rarely strays from that traditional, oak-driven style.",
        "Rioja remains one of the best value regions out there.",
      ],
      aging: "10-20 years for a Gran Reserva",
    },
    Piedmont: {
      aliases: ["piedmont", "piemonte", "barolo", "barbaresco", "langhe"],
      templates: [
        "Nebbiolo from Piedmont needs time — tannins like that don't rush.",
        "Barolo like this is famously stubborn young and glorious later.",
        "That rose-and-tar note is such a Piedmont giveaway.",
        "Barbaresco tends to be Barolo's more approachable sibling, and I get why.",
        "{producer} Nebbiolo usually rewards whoever's patient enough to wait.",
        "Piedmont reds and truffle season just belong together.",
      ],
      aging: "15-20 years for a serious Barolo or Barbaresco",
    },
    Napa: {
      aliases: ["napa", "napa valley", "oakville", "rutherford", "stags leap"],
      templates: [
        "Napa Cab is rarely subtle, and honestly that's the whole appeal.",
        "Bold, ripe, oak-forward — pretty much the Napa Cabernet signature.",
        "Napa Valley Cab prices are wild, but the quality is usually there.",
        "{producer} Napa Cab tends to lean big and polished.",
        "Hillside fruit from Napa usually means more structure, less jam.",
        "Napa still does opulent New World Cabernet better than most.",
      ],
      aging: "10-15 years for a top Cabernet",
    },
  };

  // Genuine questions invite a reply instead of asserting an opinion, so they
  // naturally sidestep the "claiming to have tasted it" problem entirely —
  // they're an honest way to engage without asserting anything at all.
  private static readonly QUESTION_TEMPLATES: readonly string[] = [
    "How's the {grape} coming through in this one?",
    "Anyone know how well {grape} from {region} tends to age?",
    "Does {producer} usually deliver at this price point?",
    "Is a {rating} rating usually spot on for wines like this?",
    "How's this {vintage} vintage looking so far?",
    "Anyone compared this to other {region} bottles?",
    "What's everyone's take on {producer}'s wines these days?",
    "Has anyone else tried the {wineName}?",
    "Worth grabbing, or is {rating} more hype than substance?",
  ];

  public static generate(input: WineCommentInput, count = 8): string[] {
    const profile = this.matchRegion(input.region);
    const results = new Set<string>();
    // At most one question-style comment per batch — a whole panel of
    // questions reads like an interrogation, not a comment suggestion.
    let usedQuestion = false;

    for (
      let attempts = 0;
      results.size < count && attempts < this.MAX_ATTEMPTS;
      attempts++
    ) {
      const tryQuestion = !usedQuestion && Math.random() < this.QUESTION_CHANCE;
      const comment = tryQuestion
        ? this.buildQuestionComment(input)
        : profile
        ? this.buildRegionComment(profile, input)
        : this.buildGenericComment(input);
      if (comment) {
        if (tryQuestion) usedQuestion = true;
        results.add(comment);
      }
    }

    return Array.from(results);
  }

  private static buildQuestionComment(input: WineCommentInput): string | null {
    const values: Record<string, string | undefined> = {
      grape: this.resolveGrape(input),
      region: input.region,
      producer: input.producer,
      vintage: input.vintage,
      rating: input.rating,
      wineName: input.wineName,
    };

    const candidates = this.QUESTION_TEMPLATES.map((template) =>
      this.renderTemplate(template, values)
    )
      .filter((s): s is string => s !== null)
      .filter((s) => this.countWords(s) <= this.MAX_WORDS);

    if (candidates.length === 0) return null;

    const sentence = this.randomFrom(candidates);
    const emoji = Math.random() < this.EMOJI_CHANCE ? this.randomFrom(this.EMOJIS) : "";
    return emoji ? `${sentence} ${emoji}` : sentence;
  }

  private static renderTemplate(
    template: string,
    values: Record<string, string | undefined>
  ): string | null {
    const tokens = Array.from(template.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
    if (tokens.some((t) => !values[t])) return null;
    return tokens.reduce((s, t) => s.replace(`{${t}}`, values[t] as string), template);
  }

  private static matchRegion(region?: string): RegionProfile | undefined {
    if (!region) return undefined;
    const normalized = this.normalize(region);

    for (const profile of Object.values(this.REGION_PROFILES)) {
      if (profile.aliases.some((alias) => normalized.includes(this.normalize(alias)))) {
        return profile;
      }
    }
    return undefined;
  }

  private static buildRegionComment(
    profile: RegionProfile,
    input: WineCommentInput
  ): string | null {
    const usableTemplates = profile.templates.filter(
      (t) => !t.includes("{producer}") || Boolean(input.producer)
    );
    if (usableTemplates.length === 0) return null;

    const base = this.randomFrom(usableTemplates).replace(
      "{producer}",
      input.producer ?? ""
    );

    // Only ever bolt on ONE extra fact (rating, vintage, pairing, or aging),
    // never several at once — stacking multiple facts into one sentence is
    // what makes generated text read like a checklist instead of a comment.
    const sentence = this.appendOneOptionalClause(base, [
      { value: input.rating, phrases: this.RATING_PHRASES, token: "{rating}", chance: this.RATING_CHANCE },
      { value: input.vintage, phrases: this.VINTAGE_PHRASES, token: "{vintage}", chance: this.VINTAGE_CHANCE },
      {
        value: this.resolvePairing(input),
        phrases: this.PAIRING_PHRASES,
        token: "{pairing}",
        chance: this.PAIRING_CHANCE,
      },
      { value: profile.aging, phrases: this.AGING_PHRASES, token: "{aging}", chance: this.AGING_CHANCE },
    ]);

    const emoji = Math.random() < this.EMOJI_CHANCE ? this.randomFrom(this.EMOJIS) : "";
    return emoji ? `${sentence} ${emoji}` : sentence;
  }

  // Tries candidates in random order and stops after the FIRST one that
  // hits (if any) — so at most one fact ever gets appended, keeping the
  // sentence to something a person would actually type in one breath.
  private static appendOneOptionalClause(
    base: string,
    candidates: ReadonlyArray<{
      value: string | undefined;
      phrases: readonly string[];
      token: string;
      chance: number;
    }>
  ): string {
    for (const { value, phrases, token, chance } of this.shuffle(candidates)) {
      if (!value || Math.random() >= chance) continue;
      const clause = this.randomFrom(phrases).replace(token, value);
      const candidate = this.joinTwo(base, clause);
      if (this.countWords(candidate) <= this.MAX_WORDS) {
        return candidate;
      }
    }
    return base;
  }

  private static buildGenericComment(input: WineCommentInput): string | null {
    const opener = this.pickOpener(input);
    const clause = this.pickMentionClause(input);
    const emoji = Math.random() < this.EMOJI_CHANCE ? this.randomFrom(this.EMOJIS) : "";

    let sentence = opener;
    if (clause) {
      const candidate = this.joinTwo(opener, clause);
      if (this.countWords(candidate) <= this.MAX_WORDS) {
        sentence = candidate;
      }
    }
    if (!/[.!?]$/.test(sentence)) {
      sentence += ".";
    }

    return emoji ? `${sentence} ${emoji}` : sentence;
  }

  private static pickOpener(input: WineCommentInput): string {
    if (input.style && Math.random() < this.STYLE_OPENER_CHANCE) {
      return this.randomFrom(this.STYLE_OPENERS).replace("{style}", input.style);
    }
    return this.randomFrom(this.OPENERS);
  }

  private static resolveGrape(input: WineCommentInput): string | undefined {
    return input.grape ?? this.inferGrapeFromRegion(input.region);
  }

  private static inferGrapeFromRegion(region?: string): string | undefined {
    if (!region) return undefined;
    const normalized = this.normalize(region);
    return this.GRAPE_BY_REGION.find((entry) =>
      entry.aliases.some((alias) => normalized.includes(this.normalize(alias)))
    )?.grape;
  }

  private static resolvePairing(input: WineCommentInput): string | undefined {
    const grape = this.resolveGrape(input);
    return grape ? this.FOOD_PAIRING_BY_GRAPE[grape.toLowerCase()] : undefined;
  }

  // Picks AT MOST one fact to mention alongside the opener — real one-line
  // comments almost never cram in region + grape + producer + rating all
  // at once, so this never lets more than one through.
  private static pickMentionClause(input: WineCommentInput): string | null {
    const allCandidates: Array<[string | undefined, readonly string[], string]> = [
      [input.region, this.GENERIC_REGION_PHRASES, "{region}"],
      [this.resolveGrape(input), this.GRAPE_PHRASES, "{grape}"],
      [input.producer, this.PRODUCER_PHRASES, "{producer}"],
      [input.rating, this.RATING_PHRASES, "{rating}"],
      [input.vintage, this.VINTAGE_PHRASES, "{vintage}"],
      [this.resolvePairing(input), this.PAIRING_PHRASES, "{pairing}"],
    ];
    const candidates = allCandidates.filter(
      (c): c is [string, readonly string[], string] => Boolean(c[0])
    );

    if (candidates.length === 0 || Math.random() >= this.MENTION_CHANCE) {
      return null;
    }

    const [value, phrases, token] = this.randomFrom(candidates);
    return this.randomFrom(phrases).replace(token, value);
  }

  // Joins two fragments with a randomly-picked, human-sounding connector
  // (comma, dash, or a full second sentence) instead of always using the
  // same em-dash construction every time, which reads as a template tic.
  private static joinTwo(a: string, b: string): string {
    const clean = this.stripPeriod(a);
    const style = this.randomFrom(["comma", "dash", "period"] as const);
    if (style === "period") {
      return `${clean}. ${this.capitalizeFirst(this.stripPeriod(b))}.`;
    }
    const connector = style === "comma" ? ", " : " — ";
    return `${clean}${connector}${this.stripPeriod(b)}.`;
  }

  private static capitalizeFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private static stripPeriod(text: string): string {
    return text.endsWith(".") ? text.slice(0, -1) : text;
  }

  private static normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  private static countWords(text: string): number {
    return text
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  private static randomFrom<T>(list: readonly T[]): T {
    return list[Math.floor(Math.random() * list.length)];
  }

  private static shuffle<T>(list: readonly T[]): T[] {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
