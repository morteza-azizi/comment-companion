import { WineCommentGenerator } from "../../services/wine-comment-generator";
import { WinePageExtractor } from "../../services/wine-page-extractor";
import {
  attachPanelDismiss,
  mountOpportunityPanel,
  OPPORTUNITY_PANEL_ID,
} from "../../ui/opportunity-panel";

export class VivinoInjector {
  private static readonly COMMENT_WIDGET_SELECTOR =
    '[data-react-class="ActivityCommentsContainer"]';
  private static readonly PROCESSED_ATTR = "data-comment-companion-processed";
  private static triggerCounter = 0;

  public static inject(): void {
    console.log("🍷 Vivino injector active");

    this.injectIntoExistingCards();
    this.observeForNewCards();
  }

  private static injectIntoExistingCards(): void {
    document
      .querySelectorAll(this.COMMENT_WIDGET_SELECTOR)
      .forEach((widget) => this.injectTrigger(widget));
  }

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
    button.title = "Comment Companion: evaluate whether to contribute";

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
    const existing = document.getElementById(OPPORTUNITY_PANEL_ID);
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
      const opportunity = WineCommentGenerator.evaluate(context);
      const panel = mountOpportunityPanel({
        anchor,
        opportunity,
        accent: "#a51c30",
        onInsert:
          opportunity.verdict === "COMMENT" && opportunity.contribution
            ? (comment) => {
                if (input) {
                  this.appendComment(input, comment);
                  input.focus();
                } else {
                  void this.copyToClipboard(comment);
                }
              }
            : undefined,
      });
      panel.dataset.forTrigger = anchor.dataset.companionTriggerId ?? "";
      attachPanelDismiss(panel, anchor);
    };

    show(wineContext);

    if (!wineContext.grapes?.length) {
      wineContext = await WinePageExtractor.enrichGrapes(wineContext, winePageUrl);
      const stillOpen =
        document.getElementById(OPPORTUNITY_PANEL_ID)?.dataset.forTrigger ===
        anchor.dataset.companionTriggerId;
      if (stillOpen && wineContext.grapes?.length) {
        show(wineContext);
      }
    }
  }

  private static appendComment(input: HTMLInputElement, comment: string): void {
    const current = input.value.trim();
    const next = current ? `${current} ${comment}` : comment;
    this.setReactControlledValue(input, next);
  }

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
      // Clipboard API can be unavailable; insert path is preferred.
    }
  }
}
