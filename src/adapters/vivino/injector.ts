import { chromeLocalStore, HistoryStore } from "../../services/history-store";
import { WinePageExtractor } from "../../services/wine-page-extractor";
import { WorkspaceController } from "../../services/workspace-controller";
import { copyToClipboard, mountWorkspace, WORKSPACE_HOST_ID } from "../../ui/workspace-panel";

// Adds two entry points to Vivino pages. Neither one writes into Vivino's
// forms or submits anything:
//   1. a small button next to a review's comment box (reads that review), and
//   2. a floating button that opens the workspace for manual input,
//      pre-filled with the wine when I am on a wine page.
// The workspace only ever copies text to the clipboard.

export class VivinoInjector {
  private static readonly COMMENT_WIDGET_SELECTOR = '[data-react-class="ActivityCommentsContainer"]';
  private static readonly PROCESSED_ATTR = "data-wine-companion-processed";
  private static readonly LAUNCHER_ID = "wine-companion-launcher";
  private static triggerCounter = 0;
  private static controller?: WorkspaceController;

  public static inject(): void {
    this.injectLauncher();
    this.injectIntoExistingCards();
    this.observeForNewCards();
  }

  private static getController(): WorkspaceController {
    this.controller ??= new WorkspaceController({
      store: new HistoryStore(chromeLocalStore()),
      copy: copyToClipboard,
    });
    return this.controller;
  }

  private static injectIntoExistingCards(): void {
    document.querySelectorAll(this.COMMENT_WIDGET_SELECTOR).forEach((widget) => this.injectTrigger(widget));
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
    if (!form || !submitButton) return;
    widget.setAttribute(this.PROCESSED_ATTR, "true");

    const trigger = this.createButton("Wine conversation companion: decide whether and what to say about this review");
    trigger.dataset.companionTriggerId = String(this.triggerCounter++);
    Object.assign(trigger.style, { width: "32px", height: "32px", minWidth: "32px", flexShrink: "0", margin: "0 8px" });
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openForCard(trigger, widget);
    });
    form.insertBefore(trigger, submitButton);
  }

  private static openForCard(anchor: HTMLElement, widget: Element): void {
    if (this.closeIfOpenFor(anchor)) return;
    const extraction = WinePageExtractor.extractFromCard(widget);
    const mounted = mountWorkspace({
      controller: this.getController(),
      initial: extraction.ok ? extraction.input : undefined,
      missing: extraction.missing,
      error: extraction.error,
      anchor,
    });
    mounted.host.dataset.forTrigger = anchor.dataset.companionTriggerId ?? "";
  }

  private static closeIfOpenFor(anchor: HTMLElement): boolean {
    const existing = document.getElementById(WORKSPACE_HOST_ID);
    if (!existing) return false;
    const sameAnchor = existing.dataset.forTrigger === anchor.dataset.companionTriggerId;
    existing.remove();
    return sameAnchor;
  }

  private static injectLauncher(): void {
    if (document.getElementById(this.LAUNCHER_ID)) return;
    const launcher = this.createButton("Wine conversation companion: paste a review");
    launcher.id = this.LAUNCHER_ID;
    Object.assign(launcher.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      width: "40px",
      height: "40px",
      zIndex: "2147483646",
      boxShadow: "0 2px 8px rgba(0,0,0,.3)",
    });
    launcher.addEventListener("click", () => {
      const existing = document.getElementById(WORKSPACE_HOST_ID);
      if (existing) {
        existing.remove();
        return;
      }
      const onWinePage = /\/w\/\d+/.test(window.location.pathname);
      mountWorkspace({
        controller: this.getController(),
        initial: onWinePage ? { wine: WinePageExtractor.extractFromWinePage(), review: {} } : undefined,
      });
    });
    document.body.append(launcher);
  }

  private static createButton(title: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "🍷";
    button.title = title;
    button.setAttribute("aria-label", title);
    Object.assign(button.style, {
      border: "none",
      background: "#a51c30",
      color: "#fff",
      borderRadius: "50%",
      fontSize: "16px",
      lineHeight: "1",
      cursor: "pointer",
    });
    return button;
  }
}
