import { WineCommentGenerator } from "../../services/wine-comment-generator";
import { WinePageExtractor } from "../../services/wine-page-extractor";

export class VivinoInjector {
  private static readonly COMMENT_WIDGET_SELECTOR =
    '[data-react-class="ActivityCommentsContainer"]';
  private static readonly PROCESSED_ATTR = "data-comment-companion-processed";
  private static readonly PANEL_ID = "comment-companion-panel";
  private static triggerCounter = 0;

  public static inject(): void {
    console.log("🍷 Vivino injector active");

    this.injectIntoExistingCards();
    this.observeForNewCards();
  }

  // Wine cards in a Vivino activity feed (e.g. a user profile page) render
  // their comment form via a React component. There's one such widget per
  // wine, so it's a reliable anchor for injecting a per-wine trigger.
  private static injectIntoExistingCards(): void {
    document
      .querySelectorAll(this.COMMENT_WIDGET_SELECTOR)
      .forEach((widget) => this.injectTrigger(widget));
  }

  // The comment widget containers are present in the DOM up front as empty
  // React mount points; their actual form markup is filled in afterwards by
  // hydration (a mutation of an *existing* container's children, not a new
  // container being added). The feed also lazy-loads more activity as the
  // user scrolls. Either way, re-scanning all containers on any mutation
  // (cheap, and a no-op for already-processed ones) is simpler and more
  // correct than trying to pattern-match which mutation added what.
  private static observeForNewCards(): void {
    let scanScheduled = false;

    const observer = new MutationObserver(() => {
      if (scanScheduled) return;
      scanScheduled = true;
      requestAnimationFrame(() => {
        scanScheduled = false;
        this.injectIntoExistingCards();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private static injectTrigger(widget: Element): void {
    if (widget.hasAttribute(this.PROCESSED_ATTR)) return;

    const form = widget.querySelector(".comments__form");
    const submitButton = form?.querySelector(".comments__form__submit");
    if (!form || !submitButton) {
      // The React comment form hasn't rendered its children yet; the
      // MutationObserver will retry once it does.
      return;
    }

    widget.setAttribute(this.PROCESSED_ATTR, "true");

    const trigger = this.createTrigger();
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.togglePanel(trigger, widget);
    });

    form.insertBefore(trigger, submitButton);
  }

  private static createTrigger(): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.companionTriggerId = String(this.triggerCounter++);
    button.textContent = "💬";
    button.title = "Comment Companion: suggest a comment";

    Object.assign(button.style, {
      border: "none",
      background: "#a51c30",
      color: "#fff",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      minWidth: "32px",
      flexShrink: "0",
      fontSize: "16px",
      lineHeight: "1",
      cursor: "pointer",
      margin: "0 8px",
    });

    return button;
  }

  private static async togglePanel(anchor: HTMLButtonElement, widget: Element): Promise<void> {
    const existing = document.getElementById(this.PANEL_ID);
    const wasOpenForThisAnchor =
      existing?.dataset.forTrigger === anchor.dataset.companionTriggerId;
    existing?.remove();
    if (wasOpenForThisAnchor) {
      return;
    }

    let wineContext = WinePageExtractor.extractFromCard(widget);
    const winePageUrl = WinePageExtractor.winePageUrlFromCard(widget);
    const input = widget.querySelector<HTMLInputElement>(".comments__form__input input");

    const show = (context: typeof wineContext): void => {
      document.getElementById(this.PANEL_ID)?.remove();
      const comments = WineCommentGenerator.generate(context, 8);
      const panel = this.createPanel(comments, anchor, input);
      panel.dataset.forTrigger = anchor.dataset.companionTriggerId ?? "";
      document.body.appendChild(panel);
      this.attachPanelDismiss(panel, anchor);
    };

    show(wineContext);

    if (!wineContext.grapes?.length) {
      wineContext = await WinePageExtractor.enrichGrapes(wineContext, winePageUrl);
      const stillOpen = document.getElementById(this.PANEL_ID)?.dataset.forTrigger ===
        anchor.dataset.companionTriggerId;
      if (stillOpen && wineContext.grapes?.length) {
        show(wineContext);
      }
    }
  }

  private static createPanel(
    comments: readonly string[],
    anchor: HTMLElement,
    input: HTMLInputElement | null
  ): HTMLDivElement {
    const anchorRect = anchor.getBoundingClientRect();
    const panel = document.createElement("div");
    panel.id = this.PANEL_ID;

    Object.assign(panel.style, {
      position: "absolute",
      top: `${anchorRect.bottom + window.scrollY + 6}px`,
      left: `${anchorRect.left + window.scrollX}px`,
      zIndex: "2147483647",
      width: "340px",
      maxHeight: "400px",
      overflowY: "auto",
      background: "#fff",
      color: "#222",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      padding: "6px",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
    });

    comments.forEach((comment) => {
      panel.appendChild(this.createPanelItem(comment, input));
    });

    return panel;
  }

  private static createPanelItem(
    comment: string,
    input: HTMLInputElement | null
  ): HTMLButtonElement {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = comment;

    Object.assign(item.style, {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      borderBottom: "1px solid #eee",
      padding: "8px 6px",
      cursor: "pointer",
      color: "inherit",
      font: "inherit",
      lineHeight: "1.4",
    });

    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (item.dataset.used === "true") return;

      if (input) {
        this.appendComment(input, comment);
        input.focus();
      } else {
        void this.copyToClipboard(comment);
      }

      item.dataset.used = "true";
      item.style.opacity = "0.45";
    });

    return item;
  }

  private static appendComment(input: HTMLInputElement, comment: string): void {
    const current = input.value.trim();
    const next = current ? `${current} ${comment}` : comment;
    this.setReactControlledValue(input, next);
  }

  private static attachPanelDismiss(panel: HTMLDivElement, anchor: HTMLElement): void {
    const dismiss = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as Node | null;
        if (panel.contains(target) || anchor.contains(target)) return;
      }
      panel.remove();
      document.removeEventListener("mousedown", dismiss, true);
      document.removeEventListener("keydown", dismiss);
    };

    window.setTimeout(() => {
      document.addEventListener("mousedown", dismiss, true);
      document.addEventListener("keydown", dismiss);
    }, 0);
  }

  // Vivino's comment box is a React-controlled input. Setting `.value`
  // directly is ignored by React's change detection, so this uses the
  // native property setter and then fires a real "input" event, which is
  // the standard workaround for programmatically updating controlled inputs.
  private static setReactControlledValue(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private static async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable/blocked on some pages; this is only
      // a fallback for the rare case where the comment input isn't found.
    }
  }
}
