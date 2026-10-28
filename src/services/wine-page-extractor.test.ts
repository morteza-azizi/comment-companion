// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { WinePageExtractor } from "./wine-page-extractor";

// Markup follows the structure documented in the extractor. It is a fixture,
// not a recording of Vivino: the activity feed requires a login.
const CARD = (parts: { note?: string; rating?: string; avg?: string; year?: string } = {}): string => `
<div class="user-activity-item">
  <a href="/users/12345">Anna K</a>
  <div class="activity-wine-card" data-year="${parts.year ?? "2019"}">
    <div class="wine-info">
      <span class="text-small"><a href="/wineries/pagos">Pagos de Valcerracín</a></span>
      <p class="wine-name"><a href="/en/pagos-cosecha/w/1156570">Cosecha Tempranillo</a></p>
      <a data-item-type="country" href="/wine-countries/es">Spain</a>
      <a href="/en/explore/regions/ribera-del-duero">Ribera del Duero</a>
    </div>
    <div class="wine-rating"><span class="header-large text-block">${parts.avg ?? "3,9"}</span></div>
  </div>
  ${parts.rating ? `<div class="user-rating"><span class="header-large">${parts.rating}</span></div>` : ""}
  ${parts.note ? `<p class="activity-note">${parts.note}</p>` : ""}
  <div data-react-class="ActivityCommentsContainer"><form class="comments__form"><input/><button class="comments__form__submit"></button></form></div>
</div>`;

function mount(html: string): Element {
  document.body.innerHTML = html;
  return document.querySelector(".comments__form") as Element;
}

describe("WinePageExtractor.extractFromCard", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("reads wine and review fields when they are all present", () => {
    const result = WinePageExtractor.extractFromCard(
      mount(CARD({ note: "Grippy tannins, long finish. Needs time.", rating: "4,5" })),
    );
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.input.wine).toMatchObject({
      wineName: "Cosecha Tempranillo",
      producer: "Pagos de Valcerracín",
      vintage: 2019,
      country: "Spain",
      region: "Ribera del Duero",
      rating: 3.9,
      grapes: ["Tempranillo"],
    });
    expect(result.input.review).toMatchObject({
      text: "Grippy tannins, long finish. Needs time.",
      rating: 4.5,
      reviewer: "Anna K",
    });
    expect(result.input.review.url).toMatch(/\/users\/12345$/);
    expect(result.winePageUrl).toMatch(/\/w\/1156570$/);
  });

  it("reports missing review text instead of guessing", () => {
    const result = WinePageExtractor.extractFromCard(mount(CARD()));
    expect(result.ok).toBe(true);
    expect(result.input.review.text).toBeUndefined();
    expect(result.missing).toEqual(["review text"]);
  });

  it("treats a 0.0 community rating and an unreadable year as unknown", () => {
    const result = WinePageExtractor.extractFromCard(mount(CARD({ note: "Tannic and dry.", avg: "0.0", year: "N.V." })));
    expect(result.input.wine.rating).toBeUndefined();
    expect(result.input.wine.vintage).toBeUndefined();
  });

  it("ignores placeholder text such as 'Add a note'", () => {
    const result = WinePageExtractor.extractFromCard(mount(CARD({ note: "Add a note" })));
    expect(result.input.review.text).toBeUndefined();
  });

  it("fails clearly when the markup is not recognised", () => {
    const element = mount(`<div class="something-else"><form class="comments__form"><input/></form></div>`);
    const result = WinePageExtractor.extractFromCard(element);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Paste the review instead/);
    expect(result.missing).toEqual(["wine name", "review text"]);
  });

  it("survives malformed review markup", () => {
    document.body.innerHTML = `<div class="user-activity-item"><p class="activity-note"></p><p>   </p><div class="wine-name"></div></div>`;
    const result = WinePageExtractor.extractFromCard(document.querySelector(".user-activity-item") as Element);
    expect(result.ok).toBe(false);
  });
});

describe("WinePageExtractor.extractFromWinePage", () => {
  it("reads JSON-LD, links and the title", () => {
    document.title = "Cosecha 2019 | Vivino";
    document.body.innerHTML = `
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        name: "Cosecha",
        brand: { "@type": "Brand", name: "Pagos" },
        aggregateRating: { ratingValue: "3.4", ratingCount: "65" },
      })}</script>
      <script type="application/ld+json">{ not json</script>
      <h1>Cosecha</h1>
      <a href="/en/explore/regions/ribera-del-duero">Ribera del Duero</a>
      <a href="/en/explore/grapes/tempranillo">Tempranillo</a>`;
    const wine = WinePageExtractor.extractFromWinePage();
    expect(wine).toMatchObject({
      wineName: "Cosecha",
      producer: "Pagos",
      region: "Ribera del Duero",
      vintage: 2019,
      rating: 3.4,
      ratingCount: 65,
      grapes: ["Tempranillo"],
    });
  });

  it("does not take the visitor's locale as the wine's country", () => {
    document.body.innerHTML = `<div data-preloaded-state='${JSON.stringify({
      user: { country_code: "nl" },
      wine: { wine_name: "X", country: "nl", region: { name: "Rioja" } },
    })}'></div>`;
    const wine = WinePageExtractor.extractFromWinePage();
    expect(wine.country).toBeUndefined();
    expect(wine.region).toBe("Rioja");
  });

  it("returns an empty wine when nothing is readable", () => {
    document.title = "";
    document.body.innerHTML = "<main></main>";
    const wine = WinePageExtractor.extractFromWinePage();
    expect(wine.wineName).toBeUndefined();
    expect(wine.grapes).toBeUndefined();
  });
});
