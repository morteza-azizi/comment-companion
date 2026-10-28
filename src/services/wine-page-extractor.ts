import { detectGrapesInText } from "../domain/grapes";
import type { ConversationInput, WineContext } from "../domain/wine-context";

// Reads wine and review facts from Vivino pages. Vivino has no public API and
// its markup can change, so every field is optional and anything that cannot
// be read is reported in `missing` instead of being guessed. When extraction
// fails the workspace falls back to manual input.
//
// Verified against a live (logged-out) wine page: JSON-LD `Product` with
// `brand` and `aggregateRating`, `/explore/grapes/` and `/explore/regions/`
// links. The activity-feed card selectors below only exist for logged-in
// pages and could not be re-verified, so treat them as best effort.

export interface ExtractionResult {
  ok: boolean;
  input: ConversationInput;
  /** Fields worth having that could not be read. */
  missing: string[];
  /** Set when the markup was not recognised at all. */
  error?: string;
  winePageUrl?: string;
}

interface RawWine {
  wineName: string | null;
  producer: string | null;
  country: string | null;
  region: string | null;
  vintage: string | null;
  rating: string | null;
  ratingCount: string | null;
}

export class WinePageExtractor {
  private static readonly CARD_SELECTOR = ".user-activity-item, .activity-card";

  // Extracts one review card from an activity feed:
  //   .user-activity-item
  //     .activity-wine-card[data-year]
  //       .wine-info
  //         span.text-small > a       (winery/producer)
  //         p.wine-name > a           (wine name)
  //         a[data-item-type=country] (country name)
  //         a[href*="/explore/regions/"] (region)
  //       .wine-rating .header-large.text-block (community average)
  public static extractFromCard(cardOrDescendant: Element): ExtractionResult {
    const root = cardOrDescendant.closest(this.CARD_SELECTOR) ?? cardOrDescendant;
    const raw = this.emptyWine();

    raw.wineName = this.text(root.querySelector(".wine-name a"));
    raw.producer = this.text(root.querySelector(".wine-info > span.text-small > a"));
    raw.vintage = root.querySelector(".activity-wine-card")?.getAttribute("data-year") ?? null;
    raw.country =
      this.text(root.querySelector('a[data-item-type="country"]')) ??
      root.querySelector('meta[itemtype="https://schema.org/Country"]')?.getAttribute("content")?.toUpperCase() ??
      null;
    raw.region = this.text(root.querySelector('a[href*="/explore/regions/"]'));

    // "0.0" means "not enough ratings yet", not a real zero.
    const ratingText = this.text(root.querySelector(".wine-rating .header-large.text-block"));
    raw.rating = ratingText && !this.isEmptyRating(ratingText) ? ratingText : null;

    const wine = this.toWine(raw);
    const text = this.extractReviewText(root);
    const reviewerRating = this.parseRating(this.extractReviewerRating(root));
    const reviewerLink = this.findReviewerLink(root);

    const missing: string[] = [];
    if (!wine.wineName) missing.push("wine name");
    if (!text) missing.push("review text");

    const recognised = Boolean(wine.wineName) || Boolean(text);
    return {
      ok: recognised,
      input: {
        wine,
        review: {
          text: text ?? undefined,
          rating: reviewerRating,
          reviewer: this.text(reviewerLink) ?? undefined,
          url: this.absoluteUrl(reviewerLink?.getAttribute("href")),
        },
      },
      missing,
      error: recognised
        ? undefined
        : "I couldn't read a wine or a review from this part of the page. Paste the review instead.",
      winePageUrl: this.absoluteUrl(root.querySelector(".wine-name a")?.getAttribute("href")),
    };
  }

  /** Wine facts from a wine page (not a review). */
  public static extractFromWinePage(doc: Document = document): WineContext {
    const fromJsonLd = this.extractFromJsonLd(doc);
    const fromState = this.extractFromPreloadedState(doc);
    const fromDom = this.extractFromDom(doc);
    const raw: RawWine = {
      wineName: fromJsonLd.wineName ?? fromState.wineName ?? fromDom.wineName,
      producer: fromJsonLd.producer ?? fromState.producer ?? fromDom.producer,
      country: fromState.country ?? fromJsonLd.country ?? fromDom.country,
      region: fromState.region ?? fromJsonLd.region ?? fromDom.region,
      vintage: fromState.vintage ?? fromJsonLd.vintage ?? fromDom.vintage,
      rating: fromJsonLd.rating ?? fromState.rating ?? fromDom.rating,
      ratingCount: fromJsonLd.ratingCount ?? fromState.ratingCount,
    };
    const wine = this.toWine(raw);
    const grapes = this.grapesFromLinks(doc);
    return grapes.length > 0 ? { ...wine, grapes } : wine;
  }

   // ---- card helpers -------------------------------------------------------

  private static findReviewerLink(root: Element): Element | null {
    for (const link of Array.from(root.querySelectorAll('a[href*="/users/"]'))) {
      if (link.closest(".wine-info, .wine-name, .comments__form")) continue;
      if (this.text(link)) return link;
    }
    return null;
  }

  private static extractReviewerRating(root: Element): string | null {
    const attrHost = root.querySelector("[data-user-rating], [data-reviewer-rating]");
    const attr = attrHost?.getAttribute("data-user-rating") ?? attrHost?.getAttribute("data-reviewer-rating");
    if (attr && !this.isEmptyRating(attr)) return attr;

    for (const el of Array.from(root.querySelectorAll("[aria-label]"))) {
      if (el.closest(".wine-rating")) continue;
      const label = el.getAttribute("aria-label") ?? "";
      const match =
        label.match(/(?:you rated|your rating|rated|gave|rating)\s*([1-5](?:[.,]\d)?)/i) ??
        label.match(/([1-5](?:[.,]\d)?)\s*(?:stars?|\/\s*5)/i);
      if (match?.[1] && !this.isEmptyRating(match[1])) return match[1];
    }

    const numeric = root.querySelector(
      ".user-rating .header-large, .activity-rating .header-large, [class*='userRating'] .header-large, [class*='UserRating'] [class*='ratingValue']",
    );
    if (numeric && !numeric.closest(".wine-rating")) {
      const text = numeric.textContent?.trim() ?? "";
      if (/^[1-5]([.,]\d)?$/.test(text) && !this.isEmptyRating(text)) return text;
    }
    return null;
  }

  private static extractReviewText(root: Element): string | null {
    const selectors = [
      "[class*='activityNote']",
      "[class*='activity-note']",
      "[class*='tasteNote']",
      "[class*='tastingNote']",
      "[class*='tasting-note']",
      "[class*='reviewNote']",
      "[class*='review-note']",
      "[class*='user-note']",
      "[class*='userNote']",
      ".activity-text",
      ".activity-description",
      ".activity-comment",
      ".activity-note",
    ];
    for (const selector of selectors) {
      const text = this.cleanReviewText(root.querySelector(selector)?.textContent);
      if (text) return text;
    }
    for (const el of Array.from(root.querySelectorAll("p, [class*='Note'], [class*='note']"))) {
      if (el.closest(".wine-info, .wine-name, .wine-rating, .comments__form")) continue;
      const text = this.cleanReviewText(el.textContent);
      if (text) return text;
    }
    return null;
  }

  private static cleanReviewText(value: string | null | undefined): string | null {
    if (!value) return null;
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length < 8) return null;
    if (/^[1-5]([.,]\d)?$/.test(text)) return null;
    if (/^(add a note|write a review|see more|read more|show more)$/i.test(text)) return null;
    return text;
  }

  // ---- wine page helpers --------------------------------------------------

  private static grapesFromLinks(doc: Document): string[] {
    const found: string[] = [];
    for (const link of Array.from(doc.querySelectorAll('a[href*="/grapes/"]'))) {
      const text = this.text(link);
      if (!text) continue;
      const name = detectGrapesInText(text)[0] ?? text;
      if (!found.includes(name)) found.push(name);
    }
    return found;
  }

  private static extractFromJsonLd(doc: Document): RawWine {
    const result = this.emptyWine();
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
    for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        collect(JSON.parse(script.textContent ?? ""));
      } catch {
        // Not valid JSON-LD; skip it.
      }
    }
    for (const obj of candidates) {
      if (!result.wineName && typeof obj.name === "string") result.wineName = obj.name;
      if (!result.producer) result.producer = this.nameLike(obj.brand);
      const aggregate = obj.aggregateRating as Record<string, unknown> | undefined;
      if (!result.rating && aggregate?.ratingValue != null) result.rating = String(aggregate.ratingValue);
      if (!result.ratingCount && aggregate?.ratingCount != null) result.ratingCount = String(aggregate.ratingCount);
    }
    return result;
  }

  // Subtrees known to hold site/session/locale config rather than wine
  // content (e.g. `user.country_code` is the visitor's locale, not a wine's
  // origin). Skipped so they cannot produce false matches.
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

  private static extractFromPreloadedState(doc: Document): RawWine {
    const result = this.emptyWine();
    for (const node of Array.from(doc.querySelectorAll("[data-preloaded-state], [data-ssr-props]"))) {
      const raw = node.getAttribute("data-preloaded-state") ?? node.getAttribute("data-ssr-props");
      if (!raw) continue;
      try {
        this.mergeFromDeepSearch(result, JSON.parse(raw));
      } catch {
        // Not JSON; skip it.
      }
    }
    return result;
  }

  // Matches on key NAMES, because the exact preloaded-state shape is not
  // guaranteed.
  private static mergeFromDeepSearch(result: RawWine, value: unknown, depth = 0): void {
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
        result.producer = this.nameLike(val) ?? result.producer;
      } else if (!result.country && /country/.test(k)) {
        result.country = this.placeName(val) ?? result.country;
      } else if (!result.region && /region/.test(k)) {
        result.region = this.placeName(val) ?? result.region;
      } else if (!result.vintage && /vintage|^year$/.test(k)) {
        if (typeof val === "number" || typeof val === "string") result.vintage = String(val);
      } else if (!result.rating && /rating/.test(k)) {
        if (typeof val === "number" || typeof val === "string") result.rating = String(val);
      }
      if (typeof val === "object") this.mergeFromDeepSearch(result, val, depth + 1);
    }
  }

  // Short codes ("nl", "us") are locale codes, not a wine's country or region.
  private static placeName(value: unknown): string | null {
    const name = this.nameLike(value);
    return name && name.trim().length > 2 ? name : null;
  }

  private static extractFromDom(doc: Document): RawWine {
    const result = this.emptyWine();
    result.wineName = this.text(doc.querySelector("h1"));
    result.vintage = doc.title.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
    result.region = this.text(doc.querySelector('a[href*="/explore/regions/"]'));
    return result;
  }

  // ---- shared -------------------------------------------------------------

  private static emptyWine(): RawWine {
    return { wineName: null, producer: null, country: null, region: null, vintage: null, rating: null, ratingCount: null };
  }

  private static toWine(raw: RawWine): WineContext {
    const wineName = raw.wineName ?? undefined;
    const grapes = detectGrapesInText(wineName);
    return {
      wineName,
      producer: raw.producer ?? undefined,
      country: raw.country ?? undefined,
      region: raw.region ?? undefined,
      vintage: this.parseVintage(raw.vintage),
      grapes: grapes.length > 0 ? grapes : undefined,
      rating: this.parseRating(raw.rating),
      ratingCount: this.parseCount(raw.ratingCount),
    };
  }

  private static text(element: Element | null | undefined): string | null {
    const value = element?.textContent?.replace(/\s+/g, " ").trim();
    return value ? value : null;
  }

  private static absoluteUrl(href: string | null | undefined): string | undefined {
    if (!href) return undefined;
    try {
      return new URL(href, window.location.origin).href;
    } catch {
      return undefined;
    }
  }

  private static nameLike(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const name = (value as Record<string, unknown>).name;
      if (typeof name === "string") return name;
    }
    return null;
  }

  private static isEmptyRating(value: string): boolean {
    return /^0+[.,]?0*$/.test(value);
  }

  private static parseVintage(value: string | null): number | undefined {
    if (!value) return undefined;
    const year = Number.parseInt(value, 10);
    return Number.isFinite(year) && year >= 1900 && year <= new Date().getFullYear() + 1 ? year : undefined;
  }

  // Vivino renders ratings with a locale decimal comma ("3,9") as often as a dot.
  private static parseRating(value: string | null): number | undefined {
    if (!value) return undefined;
    const rating = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : undefined;
  }

  private static parseCount(value: string | null): number | undefined {
    if (!value) return undefined;
    const count = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(count) ? count : undefined;
  }
}
