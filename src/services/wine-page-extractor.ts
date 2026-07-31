export interface ExtractedWineData {
  wineName: string | null;
  producer: string | null;
  country: string | null;
  region: string | null;
  vintage: string | null;
  rating: string | null;
}

export class WinePageExtractor {
  private static readonly LOG_PREFIX = "🍷 [WinePageExtractor]";

  public static extract(): ExtractedWineData {
    const fromJsonLd = this.extractFromJsonLd();
    const fromPreloadedState = this.extractFromPreloadedState();
    const fromDom = this.extractFromDom();

    console.log(`${this.LOG_PREFIX} JSON-LD ->`, fromJsonLd);
    console.log(`${this.LOG_PREFIX} preloaded-state ->`, fromPreloadedState);
    console.log(`${this.LOG_PREFIX} DOM fallback ->`, fromDom);

    const merged: ExtractedWineData = {
      wineName: fromJsonLd.wineName ?? fromPreloadedState.wineName ?? fromDom.wineName,
      producer: fromJsonLd.producer ?? fromPreloadedState.producer ?? fromDom.producer,
      country: fromPreloadedState.country ?? fromJsonLd.country ?? fromDom.country,
      region: fromPreloadedState.region ?? fromJsonLd.region ?? fromDom.region,
      vintage: fromPreloadedState.vintage ?? fromJsonLd.vintage ?? fromDom.vintage,
      rating: fromJsonLd.rating ?? fromPreloadedState.rating ?? fromDom.rating,
    };

    console.log(`${this.LOG_PREFIX} merged result ->`, merged);
    return merged;
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
  public static extractFromCard(cardOrDescendant: Element): ExtractedWineData {
    const result = this.empty();
    const root =
      cardOrDescendant.closest(".user-activity-item") ??
      cardOrDescendant.closest(".activity-card") ??
      cardOrDescendant;

    const nameLink = root.querySelector(".wine-name a");
    if (nameLink?.textContent) {
      result.wineName = nameLink.textContent.trim();
    }

    const producerLink = root.querySelector(".wine-info > span.text-small > a");
    if (producerLink?.textContent) {
      result.producer = producerLink.textContent.trim();
    }

    const year = root.querySelector(".activity-wine-card")?.getAttribute("data-year");
    if (year) {
      result.vintage = year;
    }

    const countryLink = root.querySelector('a[data-item-type="country"]');
    if (countryLink?.textContent) {
      result.country = countryLink.textContent.trim();
    } else {
      const countryCode = root
        .querySelector('meta[itemtype="https://schema.org/Country"]')
        ?.getAttribute("content");
      if (countryCode) {
        result.country = countryCode.toUpperCase();
      }
    }

    const regionLink = root.querySelector('a[href*="/explore/regions/"]');
    if (regionLink?.textContent) {
      result.region = regionLink.textContent.trim();
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
      result.rating = ratingText;
    }

    console.log(`${this.LOG_PREFIX} extractFromCard ->`, result);
    return result;
  }

  private static empty(): ExtractedWineData {
    return {
      wineName: null,
      producer: null,
      country: null,
      region: null,
      vintage: null,
      rating: null,
    };
  }

  private static extractFromJsonLd(): ExtractedWineData {
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

  private static extractFromPreloadedState(): ExtractedWineData {
    const result = this.empty();
    const nodes = document.querySelectorAll(
      "[data-preloaded-state], [data-ssr-props]"
    );

    for (const node of Array.from(nodes)) {
      const raw =
        node.getAttribute("data-preloaded-state") ??
        node.getAttribute("data-ssr-props");
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
  private static mergeFromDeepSearch(
    result: ExtractedWineData,
    value: unknown,
    depth = 0
  ): void {
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

  private static extractFromDom(): ExtractedWineData {
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
