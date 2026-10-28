// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_HOST_ID } from "../../ui/workspace-panel";
import { VivinoInjector } from "./injector";

const CARD = `
<div class="user-activity-item">
  <a href="/users/12345">Anna K</a>
  <div class="activity-wine-card" data-year="2019">
    <div class="wine-info">
      <span class="text-small"><a href="/wineries/pagos">Pagos</a></span>
      <p class="wine-name"><a href="/en/pagos-cosecha/w/1156570">Cosecha Tempranillo</a></p>
    </div>
    <div class="wine-rating"><span class="header-large text-block">3,9</span></div>
  </div>
  <p class="activity-note">Grippy tannins, long finish. Needs more time in the cellar.</p>
  <div data-react-class="ActivityCommentsContainer">
    <form class="comments__form">
      <div class="comments__form__input"><input type="text" value="typed by me" /></div>
      <button type="submit" class="comments__form__submit">Post</button>
    </form>
  </div>
</div>`;

const writes: string[] = [];
let submitted = 0;
let fetchCalls = 0;

function shadow(): ShadowRoot {
  const root = document.getElementById(WORKSPACE_HOST_ID)?.shadowRoot;
  if (!root) throw new Error("workspace not open");
  return root;
}

function button(label: string | RegExp): HTMLButtonElement {
  const found = Array.from(shadow().querySelectorAll("button")).find((item) =>
    typeof label === "string" ? item.textContent === label : label.test(item.textContent ?? ""),
  );
  if (!found) throw new Error(`no button ${String(label)}`);
  return found;
}

beforeEach(() => {
  writes.length = 0;
  submitted = 0;
  fetchCalls = 0;
  document.body.innerHTML = CARD;
  document.addEventListener("submit", () => (submitted += 1), true);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void writes.push(text) },
  });
  vi.stubGlobal("fetch", () => {
    fetchCalls += 1;
    return Promise.reject(new Error("the extension must not make network requests"));
  });
  VivinoInjector.inject();
});

afterEach(() => {
  document.getElementById(WORKSPACE_HOST_ID)?.remove();
  vi.unstubAllGlobals();
});

describe("Vivino workspace (end to end in a DOM)", () => {
  it("adds the entry points and removes nothing from the page", () => {
    expect(document.querySelectorAll("button[data-companion-trigger-id]")).toHaveLength(1);
    expect(document.getElementById("wine-companion-launcher")).not.toBeNull();
    expect(document.querySelector(".comments__form__submit")).not.toBeNull();
  });

  it("reads the review, recommends one comment, and copies it without touching the page", async () => {
    (document.querySelector("button[data-companion-trigger-id]") as HTMLButtonElement).click();

    await vi.waitFor(() => expect(shadow().textContent).toContain("Review analysis"));
    const text = shadow().textContent ?? "";
    expect(text).toContain("Cosecha Tempranillo");
    expect(text).toMatch(/COMMENT|SKIP/);
    expect(text).toContain("Nothing is posted automatically");

    const area = shadow().querySelector("textarea.comment-box") as HTMLTextAreaElement | null;
    expect(area).not.toBeNull();
    const comment = (area as HTMLTextAreaElement).value;
    expect(comment.length).toBeGreaterThan(10);

    button("Copy comment").click();
    await vi.waitFor(() => expect(writes).toEqual([comment]));

    // The page is exactly as I left it: my typed text, no submit, no requests.
    const input = document.querySelector(".comments__form__input input") as HTMLInputElement;
    expect(input.value).toBe("typed by me");
    expect(submitted).toBe(0);
    expect(fetchCalls).toBe(0);
  });

  it("offers copy, edit, another angle and skip", async () => {
    (document.querySelector("button[data-companion-trigger-id]") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("Review analysis"));
    for (const label of ["Copy comment", "Edit", /Another angle/, "Skip"]) expect(button(label)).toBeTruthy();
  });

  it("lets me edit before copying, and copies my edited text", async () => {
    (document.querySelector("button[data-companion-trigger-id]") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("Review analysis"));
    const area = shadow().querySelector("textarea.comment-box") as HTMLTextAreaElement;
    expect(area.readOnly).toBe(true);
    button("Edit").click();
    expect(area.readOnly).toBe(false);
    area.value = "Edited by me about the long finish?";
    area.dispatchEvent(new Event("input"));
    button("Copy comment").click();
    await vi.waitFor(() => expect(writes).toEqual(["Edited by me about the long finish?"]));
  });

  it("skip does not copy or post anything", async () => {
    (document.querySelector("button[data-companion-trigger-id]") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("Review analysis"));
    button("Skip").click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("Skipped. Nothing was posted."));
    expect(writes).toEqual([]);
    expect(submitted).toBe(0);
  });

  it("another angle changes the suggestion", async () => {
    (document.querySelector("button[data-companion-trigger-id]") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("Review analysis"));
    const before = (shadow().querySelector("textarea.comment-box") as HTMLTextAreaElement).value;
    button(/^Another angle$/).click();
    await vi.waitFor(() => {
      const after = (shadow().querySelector("textarea.comment-box") as HTMLTextAreaElement | null)?.value;
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
    });
  });

  it("works from the manual launcher when nothing can be extracted", async () => {
    document.body.innerHTML = "<main>no cards here</main>";
    document.getElementById("wine-companion-launcher")?.remove();
    VivinoInjector.inject();
    (document.getElementById("wine-companion-launcher") as HTMLButtonElement).click();

    expect(shadow().textContent).toContain("Paste the review");
    const review = shadow().querySelector("textarea") as HTMLTextAreaElement;
    review.value = "Great wine, love it!";
    review.dispatchEvent(new Event("input"));
    button("Analyze").click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("SKIP"));
    expect(shadow().querySelector("textarea.comment-box")).toBeNull();

    review.value = "Light in colour but surprisingly tannic.";
    review.dispatchEvent(new Event("input"));
    button("Re-analyze").click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("COMMENT"));
    expect((shadow().querySelector("textarea.comment-box") as HTMLTextAreaElement).value).toContain("tannic");
  });

  it("explains an empty manual submission instead of failing silently", async () => {
    document.body.innerHTML = "<main></main>";
    document.getElementById("wine-companion-launcher")?.remove();
    VivinoInjector.inject();
    (document.getElementById("wine-companion-launcher") as HTMLButtonElement).click();
    button("Analyze").click();
    await vi.waitFor(() => expect(shadow().textContent).toContain("Nothing to analyze"));
  });
});
