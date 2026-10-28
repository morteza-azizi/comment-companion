import { RECOMMENDATION_LABEL } from "../domain/opportunity";
import { describeWine, type ConversationInput } from "../domain/wine-context";
import { parseManualInput } from "../services/manual-input";
import type { WorkspaceController } from "../services/workspace-controller";

export const WORKSPACE_HOST_ID = "wine-conversation-companion";

export interface WorkspaceOptions {
  controller: WorkspaceController;
  /** Where the page extraction landed. Undefined means start from manual input. */
  initial?: ConversationInput;
  /** Fields extraction could not read, e.g. ["review text"]. */
  missing?: string[];
  /** Shown when extraction failed outright. */
  error?: string;
  /** Place the panel under this element; otherwise it sits in the bottom-right corner. */
  anchor?: HTMLElement;
  accent?: string;
}

export interface MountedWorkspace {
  host: HTMLElement;
  close(): void;
}

const STYLE = `
:host { all: initial; }
.panel { box-sizing: border-box; width: 380px; max-height: calc(100vh - 24px); overflow-y: auto; background: #fff; color: #222;
  border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.28); padding: 12px 14px; font: 13px/1.45 system-ui, sans-serif; }
.panel * { box-sizing: border-box; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.title { font-weight: 700; font-size: 12px; letter-spacing: .03em; color: var(--accent); }
.x { border: none; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: #666; }
.wine { font-weight: 600; }
.muted { color: #666; font-size: 12px; }
.quote { margin: 6px 0; padding: 6px 8px; background: #f6f3f1; border-left: 3px solid var(--accent); border-radius: 4px;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
details { margin: 6px 0; }
summary { cursor: pointer; font-size: 12px; color: #444; }
label { display: block; margin-top: 6px; font-size: 12px; color: #444; }
input, textarea, select { width: 100%; font: inherit; padding: 5px 6px; border: 1px solid #ccc; border-radius: 6px; }
textarea { resize: vertical; min-height: 54px; }
.row { display: flex; gap: 8px; } .row > * { flex: 1; }
.section { margin-top: 10px; }
.label { font-weight: 600; font-size: 12px; margin-bottom: 2px; }
ul { margin: 0; padding-left: 18px; } li { margin: 1px 0; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; color: #fff; margin-right: 6px; }
.badge.comment { background: #2f7d4f; } .badge.skip { background: #777; } .badge.context { background: #b7791f; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
button.btn { border: 1px solid var(--accent); background: #fff; color: var(--accent); border-radius: 8px; padding: 6px 10px; cursor: pointer; font: inherit; }
button.btn.primary { background: var(--accent); color: #fff; }
button.btn:disabled { opacity: .5; cursor: default; }
.msg { margin-top: 8px; padding: 6px 8px; border-radius: 6px; background: #fff4e5; color: #7a4a00; font-size: 12px; }
.msg.ok { background: #e8f5ec; color: #1f5a37; }
.foot { margin-top: 10px; font-size: 11px; color: #888; }
`;

type Field = "wineName" | "producer" | "vintage" | "reviewText" | "reviewRating" | "myNote";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the selection-based copy, which works without clipboard permission.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function mountWorkspace(options: WorkspaceOptions): MountedWorkspace {
  document.getElementById(WORKSPACE_HOST_ID)?.remove();

  const { controller } = options;
  const accent = options.accent ?? "#a51c30";
  const host = el("div", { id: WORKSPACE_HOST_ID });
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(el("style", { textContent: STYLE }));
  const panel = el("div", { className: "panel" });
  panel.style.setProperty("--accent", accent);
  shadow.append(panel);

  place(host, options.anchor);
  document.body.append(host);

  let base: ConversationInput = options.initial ?? { wine: {}, review: {} };
  const values: Record<Field, string> = {
    wineName: base.wine.wineName ?? "",
    producer: base.wine.producer ?? "",
    vintage: base.wine.vintage !== undefined ? String(base.wine.vintage) : "",
    reviewText: base.review.text ?? "",
    reviewRating: base.review.rating !== undefined ? String(base.review.rating) : "",
    myNote: base.myNote ?? "",
  };
  let status: { text: string; ok?: boolean } | undefined = options.error ? { text: options.error } : undefined;
  let analyzed = false;
  let dismissed = false;
  let editing = false;
  let draft = "";

  const close = (): void => host.remove();
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  const buildInput = (): ConversationInput | undefined => {
    const parsed = parseManualInput({
      ...values,
      rating: base.wine.rating,
      region: base.wine.region,
      country: base.wine.country,
      reviewer: base.review.reviewer,
    });
    if (!parsed.ok) {
      status = { text: parsed.error };
      return undefined;
    }
    parsed.input.wine.grapes = base.wine.grapes;
    parsed.input.wine.ratingCount = base.wine.ratingCount;
    parsed.input.review.url = base.review.url;
    if (parsed.warnings.length) status = { text: parsed.warnings.join(" ") };
    return parsed.input;
  };

  const run = async (action: "analyze" | "angle"): Promise<void> => {
    status = undefined;
    dismissed = false;
    editing = false;
    if (action === "analyze") {
      const input = buildInput();
      if (!input) return render();
      base = input;
      await controller.analyze(input);
    } else {
      await controller.anotherAngle();
    }
    analyzed = true;
    draft = controller.suggestion?.comment ?? "";
    render();
  };

  const field = (label: string, name: Field, multiline = false, hint?: string): HTMLElement => {
    const control = multiline
      ? el("textarea", { value: values[name], rows: name === "reviewText" ? 4 : 2 })
      : el("input", { value: values[name], type: "text" });
    control.addEventListener("input", () => {
      values[name] = control.value;
    });
    return el("label", {}, [label, ...(hint ? [el("span", { className: "muted", textContent: ` ${hint}` })] : []), control]);
  };

  const render = (): void => {
    panel.replaceChildren();

    panel.append(
      el("div", { className: "head" }, [
        el("div", { className: "title", textContent: "WINE CONVERSATION COMPANION" }),
        el("button", { className: "x", textContent: "×", title: "Close", onclick: close }),
      ]),
    );

    const wineLine = describeWine(base.wine);
    panel.append(el("div", { className: "wine", textContent: wineLine || "Wine not identified" }));
    const reviewerBits = [
      base.review.reviewer,
      base.review.rating !== undefined ? `scored ${base.review.rating.toFixed(1)}` : undefined,
    ].filter(Boolean);
    if (reviewerBits.length) panel.append(el("div", { className: "muted", textContent: reviewerBits.join(" · ") }));
    if (base.review.text) panel.append(el("div", { className: "quote", textContent: base.review.text }));

    if (status) panel.append(el("div", { className: `msg${status.ok ? " ok" : ""}`, textContent: status.text }));
    if (options.missing?.length && !analyzed) {
      panel.append(
        el("div", {
          className: "msg",
          textContent: `Couldn't read: ${options.missing.join(", ")}. Add it below to continue.`,
        }),
      );
    }

    const needsInput = !analyzed && (!base.review.text || Boolean(options.error));
    const form = el("details", { open: needsInput }, [
      el("summary", { textContent: needsInput ? "Paste the review" : "Edit details" }),
      field("Review", "reviewText", true),
      el("div", { className: "row" }, [field("Wine", "wineName"), field("Producer", "producer")]),
      el("div", { className: "row" }, [field("Vintage", "vintage"), field("Reviewer's score", "reviewRating")]),
      field("My own impression", "myNote", true, "(only if I have really tasted it)"),
      el("div", { className: "actions" }, [
        el("button", {
          className: "btn primary",
          textContent: analyzed ? "Re-analyze" : "Analyze",
          onclick: () => void run("analyze"),
        }),
      ]),
    ]);
    panel.append(form);

    if (analyzed && controller.suggestion) renderSuggestion();

    if (controller.notice) panel.append(el("div", { className: "msg", textContent: controller.notice }));
    panel.append(el("div", { className: "foot", textContent: "Nothing is posted automatically. You copy, paste and send." }));
  };

  const list = (title: string, items: string[]): HTMLElement | undefined =>
    items.length
      ? el("div", { className: "section" }, [
          el("div", { className: "label", textContent: title }),
          el("ul", {}, items.map((item) => el("li", { textContent: item }))),
        ])
      : undefined;

  const renderSuggestion = (): void => {
    const suggestion = controller.suggestion;
    if (!suggestion) return;
    const { analysis } = suggestion;

    const parts = [
      list("What they say", analysis.facts.slice(0, 4)),
      list("My reading", analysis.interpretations.slice(0, 2)),
      analysis.unknowns.length
        ? el("div", { className: "muted section", textContent: `Can't tell from the review: ${analysis.unknowns.join("; ")}.` })
        : undefined,
    ].filter((part): part is HTMLElement => Boolean(part));
    const analysisNode = el("details", { open: true }, [el("summary", { textContent: "Review analysis" }), ...parts]);

    const isComment = Boolean(suggestion.comment) && !dismissed;
    const kind = suggestion.recommendation === "REQUEST_MORE_CONTEXT" ? "context" : isComment ? "comment" : "skip";
    panel.append(
      el("div", { className: "section" }, [
        el("div", {}, [
          el("span", { className: `badge ${kind}`, textContent: kind === "comment" ? "COMMENT" : kind === "context" ? "MORE CONTEXT" : "SKIP" }),
          el("strong", { textContent: RECOMMENDATION_LABEL[dismissed ? "SKIP" : suggestion.recommendation] }),
        ]),
        el("div", { textContent: dismissed ? "Skipped. Nothing was posted." : suggestion.reason }),
      ]),
    );
    if (dismissed || !suggestion.comment) {
      panel.append(analysisNode);
      return;
    }

    if (suggestion.candidate) {
      panel.append(el("div", { className: "muted", textContent: `Angle: ${suggestion.candidate.angle}` }));
    }
    if (suggestion.repetition === "SAME_TOPIC_NEW_ANGLE") {
      panel.append(el("div", { className: "muted", textContent: "Same topic as a recent comment, but a different angle." }));
    }

    const area = el("textarea", { className: "comment-box", value: draft, readOnly: !editing, rows: 4 });
    area.addEventListener("input", () => {
      draft = area.value;
    });
    panel.append(el("div", { className: "section" }, [area]));

    const copyButton = el("button", { className: "btn primary", textContent: "Copy comment" });
    copyButton.addEventListener("click", () => {
      void controller.copyComment(draft).then(({ copied }) => {
        status = copied
          ? { text: "Copied. Paste it into Vivino yourself when you are happy with it.", ok: true }
          : { text: "Couldn't copy automatically. Select the text and copy it manually." };
        render();
      });
    });
    const editButton = el("button", {
      className: "btn",
      textContent: "Edit",
      onclick: () => {
        editing = true;
        area.readOnly = false;
        area.focus();
      },
    });
    const angleButton = el("button", {
      className: "btn",
      textContent: suggestion.anglesLeft > 0 ? "Another angle" : "Another angle (none left)",
      disabled: suggestion.anglesLeft === 0,
      onclick: () => void run("angle"),
    });
    const skipButton = el("button", {
      className: "btn",
      textContent: "Skip",
      onclick: () => {
        void controller.skip().then(() => {
          dismissed = true;
          render();
        });
      },
    });
    panel.append(el("div", { className: "actions" }, [copyButton, editButton, angleButton, skipButton]));

    panel.append(analysisNode);
    if (controller.existing?.used) renderOutcome();
    renderPatterns();
  };

  const triState = (label: string, current: boolean | undefined, onChange: (value: boolean | undefined) => void): HTMLElement => {
    const select = el("select", {});
    for (const [value, text] of [["", "Not recorded"], ["yes", "Yes"], ["no", "No"]] as const) {
      select.append(el("option", { value, textContent: text, selected: (current === undefined ? "" : current ? "yes" : "no") === value }));
    }
    select.addEventListener("change", () => onChange(select.value === "" ? undefined : select.value === "yes"));
    return el("label", {}, [label, select]);
  };

  const renderOutcome = (): void => {
    const record = controller.existing;
    if (!record) return;
    const outcome = { replyReceived: record.replyReceived, meaningful: record.meaningful };
    const saveButton = el("button", { className: "btn", textContent: "Save outcome" });
    saveButton.addEventListener("click", () => {
      void controller.recordOutcome(outcome).then((saved) => {
        status = saved ? { text: "Outcome saved on this device.", ok: true } : { text: "Couldn't save the outcome." };
        render();
      });
    });
    panel.append(
      el("details", {}, [
        el("summary", { textContent: "Record outcome (optional)" }),
        el("div", { className: "muted", textContent: "Only what you tell me. I can't see replies myself." }),
        triState("Did you get a reply?", outcome.replyReceived, (value) => (outcome.replyReceived = value)),
        triState("Was the exchange meaningful?", outcome.meaningful, (value) => (outcome.meaningful = value)),
        el("div", { className: "actions" }, [saveButton]),
      ]),
    );
  };

  const renderPatterns = (): void => {
    const { lines, note } = controller.patterns();
    panel.append(
      el("details", {}, [
        el("summary", { textContent: "What has worked for me" }),
        ...(lines.length
          ? [
              el(
                "ul",
                {},
                lines.map((line) =>
                  el("li", {
                    textContent: `${line.label}: used ${line.used}, replies recorded ${line.replies}/${line.outcomesRecorded}, meaningful ${line.meaningful}/${line.outcomesRecorded}`,
                  }),
                ),
              ),
            ]
          : []),
        el("div", { className: "muted", textContent: note }),
      ]),
    );
  };

  render();
  if (options.initial?.review.text) void run("analyze");
  else void controller.init().then(render);

  return { host, close };
}

function place(host: HTMLElement, anchor?: HTMLElement): void {
  host.style.zIndex = "2147483647";
  if (!anchor) {
    host.style.position = "fixed";
    host.style.right = "16px";
    host.style.bottom = "16px";
    return;
  }
  // Fixed, so the panel always stays fully on screen: under the anchor when
  // there is room, otherwise pinned to the bottom edge.
  const rect = anchor.getBoundingClientRect();
  host.style.position = "fixed";
  host.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 400))}px`;
  const roomBelow = window.innerHeight - rect.bottom - 14;
  if (roomBelow >= 460) host.style.top = `${rect.bottom + 6}px`;
  else host.style.bottom = "8px";
}
