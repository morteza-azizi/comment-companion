import { evaluateContribution } from "../../services/contribution-companion";
import {
  attachPanelDismiss,
  mountOpportunityPanel,
  OPPORTUNITY_PANEL_ID,
} from "../../ui/opportunity-panel";
import { extractLinkedInPostText, findLinkedInCommentEditor } from "./post-extractor";

export class LinkedInInjector {
  private static readonly COMMENT_BOX_SELECTORS = [
    ".comments-comment-box",
    ".comments-comment-texteditor",
    "form.comments-comment-box__form",
  ];
  private static readonly PROCESSED_ATTR = "data-comment-companion-processed";
  private static triggerCounter = 0;

  public static inject(): void {
    this.scan();
    this.observe();
  }

  private static observe(): void {
    let scanScheduled = false;
    const observer = new MutationObserver(() => {
      if (scanScheduled) return;
      scanScheduled = true;
      requestAnimationFrame(() => {
        scanScheduled = false;
        this.scan();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  private static scan(): void {
    for (const selector of this.COMMENT_BOX_SELECTORS) {
      document.querySelectorAll(selector).forEach((box) => this.injectTrigger(box));
    }
  }

  private static injectTrigger(box: Element): void {
    if (box.hasAttribute(this.PROCESSED_ATTR)) return;
    box.setAttribute(this.PROCESSED_ATTR, "true");

    const trigger = this.createTrigger();
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePanel(trigger, box);
    });
    box.appendChild(trigger);
  }

  private static createTrigger(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.companionTriggerId = String(this.triggerCounter++);
    button.textContent = "💬";
    button.title = "Comment Companion: evaluate whether to contribute";
    Object.assign(button.style, {
      border: "none",
      background: "#0a66c2",
      color: "#fff",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      fontSize: "16px",
      cursor: "pointer",
      margin: "8px",
    });
    return button;
  }

  private static togglePanel(anchor: HTMLButtonElement, box: Element): void {
    const existing = document.getElementById(OPPORTUNITY_PANEL_ID);
    const wasOpenForThisAnchor =
      existing?.dataset.forTrigger === anchor.dataset.companionTriggerId;
    existing?.remove();
    if (wasOpenForThisAnchor) return;

    const text = extractLinkedInPostText(box);
    const opportunity = evaluateContribution({
      post: { text, source: "linkedin" },
    });
    const editor = findLinkedInCommentEditor(box);

    const panel = mountOpportunityPanel({
      anchor,
      opportunity,
      accent: "#0a66c2",
      onInsert:
        opportunity.verdict === "COMMENT" && opportunity.contribution
          ? (comment) => {
              if (editor) {
                this.insertIntoEditor(editor, comment);
              } else {
                void navigator.clipboard.writeText(comment).catch(() => undefined);
              }
            }
          : undefined,
    });
    panel.dataset.forTrigger = anchor.dataset.companionTriggerId ?? "";
    attachPanelDismiss(panel, anchor);
  }

  private static insertIntoEditor(editor: HTMLElement, comment: string): void {
    editor.focus();
    const current = editor.innerText.trim();
    const next = current ? `${current} ${comment}` : comment;
    editor.innerText = next;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}
