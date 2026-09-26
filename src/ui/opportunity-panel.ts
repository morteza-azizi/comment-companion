import type { ContributionOpportunity } from "../domain/contribution";
import { formatOpportunity } from "../domain/contribution";

export const OPPORTUNITY_PANEL_ID = "comment-companion-panel";

export interface OpportunityPanelOptions {
  anchor: HTMLElement;
  opportunity: ContributionOpportunity;
  accent: string;
  onInsert?: (comment: string) => void;
}

export function mountOpportunityPanel(options: OpportunityPanelOptions): HTMLDivElement {
  document.getElementById(OPPORTUNITY_PANEL_ID)?.remove();

  const anchorRect = options.anchor.getBoundingClientRect();
  const panel = document.createElement("div");
  panel.id = OPPORTUNITY_PANEL_ID;
  Object.assign(panel.style, {
    position: "absolute",
    top: `${anchorRect.bottom + window.scrollY + 6}px`,
    left: `${anchorRect.left + window.scrollX}px`,
    zIndex: "2147483647",
    width: "420px",
    maxHeight: "480px",
    overflowY: "auto",
    background: "#fff",
    color: "#222",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    padding: "12px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    lineHeight: "1.45",
  });

  const heading = document.createElement("div");
  heading.textContent = "CONTRIBUTION OPPORTUNITY";
  Object.assign(heading.style, {
    fontWeight: "700",
    letterSpacing: "0.04em",
    fontSize: "11px",
    color: options.accent,
    marginBottom: "10px",
  });
  panel.appendChild(heading);

  if (options.opportunity.mode) {
    panel.appendChild(labeledBlock("Mode", options.opportunity.mode));
  }
  if (options.opportunity.angle) {
    panel.appendChild(labeledBlock("Angle", options.opportunity.angle));
  }
  if (options.opportunity.novelty) {
    panel.appendChild(labeledBlock("Novelty", options.opportunity.novelty));
  }
  panel.appendChild(labeledBlock("Verdict", options.opportunity.verdict));
  panel.appendChild(labeledBlock("Why", options.opportunity.why));

  if (options.opportunity.verdict === "COMMENT" && options.opportunity.contribution) {
    const contribution = options.opportunity.contribution;
    const block = labeledBlock("Contribution", contribution);
    if (options.onInsert) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Insert this angle";
      Object.assign(button.style, {
        marginTop: "8px",
        border: "none",
        background: options.accent,
        color: "#fff",
        borderRadius: "8px",
        padding: "8px 10px",
        cursor: "pointer",
        font: "inherit",
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onInsert?.(contribution);
      });
      block.appendChild(button);
    }
    panel.appendChild(block);
  }

  if (options.opportunity.confidence) {
    panel.appendChild(labeledBlock("Confidence", options.opportunity.confidence));
  }

  panel.dataset.formatted = formatOpportunity(options.opportunity);
  document.body.appendChild(panel);
  return panel;
}

function labeledBlock(label: string, value: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "10px";

  const title = document.createElement("div");
  title.textContent = `${label}:`;
  Object.assign(title.style, { fontWeight: "600", marginBottom: "2px" });

  const body = document.createElement("div");
  body.textContent = value;
  body.style.whiteSpace = "pre-wrap";

  wrap.appendChild(title);
  wrap.appendChild(body);
  return wrap;
}

export function attachPanelDismiss(panel: HTMLDivElement, anchor: HTMLElement): void {
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
