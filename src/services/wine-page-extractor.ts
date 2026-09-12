import type { WineContext } from "../domain/wine-context";
import { detectGrapesInText, grapesFromWinePageHtml } from "../domain/wine-knowledge";

// Internal, string-only shape used while merging multiple raw extraction
// strategies together (JSON-LD / preloaded-state / DOM all naturally yield
// strings). This is converted to a typed WineContext (facts only, proper
// number types, undefined instead of null) at the boundary, right before
// being handed to the rest of the pipeline.
interface RawExtractedWine {
  wineName: string | null;
  producer: string | null;
  country: string | null;
  region: string | null;
  vintage: string | null;
  rating: string | null;
  grapes: string[];
}

export class WinePageExtractor {
  private static readonly LOG_PREFIX = "🍷 [WinePageExtractor]";

  public static extract(): WineContext {
    const fromJsonLd = this.extractFromJsonLd();
    const fromPreloadedState = this.extractFromPreloadedState();
    const fromDom = this.extractFromDom();

    console.log(`${this.LOG_PREFIX} JSON-LD ->`, fromJsonLd);
    console.log(`${this.LOG_PREFIX} preloaded-state ->`, fromPreloadedState);
    console.log(`${this.LOG_PREFIX} DOM fallback ->`, fromDom);

    const merged: RawExtractedWine = {
      wineName: fromJsonLd.wineName ?? fromPreloadedState.wineName ?? fromDom.wineName,
      producer: fromJsonLd.producer ?? fromPreloadedState.producer ?? fromDom.producer,
      country: fromPreloadedState.country ?? fromJsonLd.country ?? fromDom.country,
      region: fromPreloadedState.region ?? fromJsonLd.region ?? fromDom.region,
      vintage: fromPreloadedState.vintage ?? fromJsonLd.vintage ?? fromDom.vintage,
      rating: fromJsonLd.rating ?? fromPreloadedState.rating ?? fromDom.rating,
      grapes: [],
    };

    const context = this.toWineContext(merged);
    console.log(`${this.LOG_PREFIX} merged result ->`, context);
    return context;
  }

  // Extracts data for a single wine card in a Vivino activity feed (e.g. a
  // user profile page), based on real markup:
  //   .user-activity-item
  //     .activity-wine-card[data-year]
  //       .wine-info
  //         span.text-small > a       (winery/producer)
  //         p.wine-name > a           (wine name)
  //         a[data-item-type=country] (country name)
  //         meta[itemtype=".../Country"] (country code, fallback)
  //         a[href*="/explore/regions/"] (region)
  //       .wine-rating .header-large.text-block (avg. rating)
  //
  // Note: appellation, style, price and currency aren't wired up yet —
  // there's no confirmed selector for them on the compact activity card.
  // Grapes are step 1: read from the wine name when the variety is in the
  // title. Step 2 (wine-page fetch) lives in enrichGrapes().
  public static extractFromCard(cardOrDescendant: Element): WineContext {
    const raw = this.empty();
    const root =
      cardOrDescendant.closest(".user-activity-item") ??
      cardOrDescendant.closest(".activity-card") ??
      cardOrDescendant;

    const nameLink = root.querySelector(".wine-name a");
    if (nameLink?.textContent) {
      raw.wineName = nameLink.textContent.trim();
    }

    const producerLink = root.querySelector(".wine-info > span.text-small > a");
    if (producerLink?.textContent) {
      raw.producer = producerLink.textContent.trim();
    }

    const year = root.querySelector(".activity-wine-card")?.getAttribute("data-year");
    if (year) {
      raw.vintage = year;
    }

    const countryLink = root.querySelector('a[data-item-type="country"]');
    if (countryLink?.textContent) {
      raw.country = countryLink.textContent.trim();
    } else {
      const countryCode = root
        .querySelector('meta[itemtype="https://schema.org/Country"]')
        ?.getAttribute("content");
      if (countryCode) {
        raw.country = countryCode.toUpperCase();
      }
    }

    const regionLink = root.querySelector('a[href*="/explore/regions/"]');
    if (regionLink?.textContent) {
      raw.region = regionLink.textContent.trim();
    }

    // The first ".header-large.text-block" in the ratings row is Vivino's
    // community average rating for the wine (not the profile owner's own
    // star rating for this specific post — that's a separate element we
    // don't have a confirmed selector for yet). "0.0"/"0,0" means the wine
    // doesn't have enough ratings yet, not that it's actually rated zero,
    // so that case is treated as no rating at all to avoid nonsense like
    // "that 0.0 rating stands out".
    const ratingValue = root.querySelector(".wine-rating .header-large.text-block");
    const ratingText = ratingValue?.textContent?.trim();
    if (ratingText && !/^0+[.,]?0*$/.test(ratingText)) {
      raw.rating = ratingText;
    }

    const context = this.toWineContext(raw);
    console.log(`${this.LOG_PREFIX} extractFromCard ->`, context);
    return context;
  }

  public static winePageUrlFromCard(cardOrDescendant: Element): string | undefined {
    const root =
      cardOrDescendant.closest(".user-activity-item") ??
      cardOrDescendant.closest(".activity-card") ??
      cardOrDescendant;
    const href = root.querySelector(".wine-name a")?.getAttribute("href");
    if (!href) return undefined;
    try {
      return new URL(href, window.location.origin).href;
    } catch {
      return undefined;
    }
  }

  // Step 2: if the wine name did not contain a grape, fetch the wine page
  // and parse `/grapes/` links. Cached per URL; times out rather than
  // hanging the comment panel.
  public static async enrichGrapes(context: WineContext, winePageUrl?: string): Promise<WineContext> {
    if (context.grapes && context.grapes.length > 0) return context;
    if (!winePageUrl) return context;

    const cached = this.grapeCache.get(winePageUrl);
    if (cached) {
      return cached.length > 0 ? { ...context, grapes: cached } : context;
    }

    const grapes = await this.fetchGrapesFromWinePage(winePageUrl);
    this.grapeCache.set(winePageUrl, grapes);
    console.log(`${this.LOG_PREFIX} enrichGrapes ->`, winePageUrl, grapes);
    return grapes.length > 0 ? { ...context, grapes } : context;
  }

  private static readonly grapeCache = new Map<string, string[]>();
  private static readonly FETCH_TIMEOUT_MS = 4000;

  private static async fetchGrapesFromWinePage(url: string): Promise<string[]> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) return [];
      const html = await response.text();
      return grapesFromWinePageHtml(html);
    } catch {
      return [];
    } finally {
      window.clearTimeout(timer);
    }
  }

  private static empty(): RawExtractedWine {
    return {
      wineName: null,
      producer: null,
      country: null,
      region: null,
      vintage: null,
      rating: null,
      grapes: [],
    };
  }

  // Converts the raw, string-only scraping result into a typed WineContext:
  // numeric fields become real numbers (or undefined if unparsable), and
  // null becomes undefined so "we don't know" is represented one way.
  private static toWineContext(raw: RawExtractedWine): WineContext {
    const grapesFromName = detectGrapesInText(raw.wineName ?? undefined);
    const grapes = grapesFromName.length > 0 ? grapesFromName : raw.grapes;
    return {
      wineName: raw.wineName ?? undefined,
      producer: raw.producer ?? undefined,
      country: raw.country ?? undefined,
      region: raw.region ?? undefined,
      grapes: grapes.length > 0 ? grapes : undefined,
      vintage: this.parseVintage(raw.vintage),
      rating: this.parseRating(raw.rating),
    };
  }

  private static parseVintage(value: string | null): number | undefined {
    if (!value) return undefined;
    const year = Number.parseInt(value, 10);
    return Number.isFinite(year) ? year : undefined;
  }

  // Vivino renders ratings with a locale decimal comma (e.g. "3,9") as often
  // as a dot, so both are normalized before parsing.
  private static parseRating(value: string | null): number | undefined {
    if (!value) return undefined;
    const rating = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(rating) ? rating : undefined;
  }

  private static extractFromJsonLd(): RawExtractedWine {
    const result = this.empty();
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    const candidates: Record<string, unknown>[] = [];
    const collect = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }
      const obj = node as Record<string, unknown>;
      candidates.push(obj);
      if (obj.itemReviewed) collect(obj.itemReviewed);
      if (obj["@graph"]) collect(obj["@graph"]);
    };

    for (const script of Array.from(scripts)) {
      try {
        collect(JSON.parse(script.textContent ?? ""));
      } catch {
        // Not valid JSON-LD, skip.
      }
    }

    for (const obj of candidates) {
      if (!result.wineName && typeof obj.name === "string") {
        result.wineName = obj.name;
      }
      if (!result.producer) {
        result.producer = this.extractNameLike(obj.brand);
      }
      const aggregateRating = obj.aggregateRating as Record<string, unknown> | undefined;
      if (!result.rating && aggregateRating?.ratingValue != null) {
        result.rating = String(aggregateRating.ratingValue);
      }
    }

    return result;
  }

  private static extractFromPreloadedState(): RawExtractedWine {
    const result = this.empty();
    const nodes = document.querySelectorAll("[data-preloaded-state], [data-ssr-props]");

    for (const node of Array.from(nodes)) {
      const raw = node.getAttribute("data-preloaded-state") ?? node.getAttribute("data-ssr-props");
      if (!raw) continue;

      try {
        this.mergeFromDeepSearch(result, JSON.parse(raw));
      } catch {
        // Attribute wasn't valid JSON, skip.
      }
    }

    return result;
  }

  // Subtrees that are known to hold site/session/locale config rather than
  // wine content (confirmed by inspecting Vivino's own preloaded state, e.g.
  // "user.country_code" is the visitor's locale, not a wine's origin).
  // Skipping them outright avoids false-positive matches like picking up the
  // visitor's 2-letter locale code as the wine's "country".
  private static readonly BLOCKED_KEYS = new Set([
    "user",
    "menudata",
    "page_settings",
    "pagesettings",
    "ab_testing",
    "abtesting",
    "environment",
    "magic_link_result",
    "user_type",
  ]);

  // Generic recursive scan for plausible wine fields. The exact shape of
  // Vivino's preloaded-state JSON on a wine page hasn't been confirmed yet,
  // so this matches on key *names* rather than a fixed path.
  private static mergeFromDeepSearch(result: RawExtractedWine, value: unknown, depth = 0): void {
    if (depth > 6 || value == null || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach((item) => this.mergeFromDeepSearch(result, item, depth + 1));
      return;
    }

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const k = key.toLowerCase();
      if (this.BLOCKED_KEYS.has(k)) continue;

      if (!result.wineName && /^wine_?name$/.test(k) && typeof val === "string") {
        result.wineName = val;
      } else if (!result.producer && /winery|producer/.test(k)) {
        result.producer = this.extractNameLike(val) ?? result.producer;
      } else if (!result.country && /country/.test(k)) {
        result.country = this.extractPlaceName(val) ?? result.country;
      } else if (!result.region && /region/.test(k)) {
        result.region = this.extractPlaceName(val) ?? result.region;
      } else if (!result.vintage && /vintage|^year$/.test(k)) {
        if (typeof val === "number" || typeof val === "string") {
          result.vintage = String(val);
        }
      } else if (!result.rating && /rating/.test(k)) {
        if (typeof val === "number" || typeof val === "string") {
          result.rating = String(val);
        }
      }

      if (typeof val === "object") {
        this.mergeFromDeepSearch(result, val, depth + 1);
      }
    }
  }

  // Locale/country codes (e.g. "nl", "us") are almost never how a wine's own
  // country or region is represented, so short codes are rejected here to
  // avoid re-introducing the locale false-positive described above.
  private static extractPlaceName(value: unknown): string | null {
    const name = this.extractNameLike(value);
    return name && name.trim().length > 2 ? name : null;
  }

  private static extractFromDom(): RawExtractedWine {
    const result = this.empty();

    const heading = document.querySelector("h1");
    if (heading?.textContent) {
      result.wineName = heading.textContent.trim();
    }

    const vintageMatch = document.title.match(/\b(19|20)\d{2}\b/);
    if (vintageMatch) {
      result.vintage = vintageMatch[0];
    }

    const breadcrumb = document.querySelector('nav[aria-label*="breadcrumb" i]');
    if (breadcrumb) {
      const crumbs = Array.from(breadcrumb.querySelectorAll("a"))
        .map((a) => a.textContent?.trim())
        .filter((text): text is string => Boolean(text));

      if (crumbs.length >= 1) result.country = crumbs[0];
      if (crumbs.length >= 2) result.region = crumbs[crumbs.length - 1];
    }

    return result;
  }

  private static extractNameLike(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const name = (value as Record<string, unknown>).name;
      if (typeof name === "string") return name;
    }
    return null;
  }
}
