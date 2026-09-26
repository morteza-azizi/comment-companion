export function extractLinkedInPostText(from: Element): string {
  const root =
    from.closest(".feed-shared-update-v2") ??
    from.closest("article") ??
    from.closest(".update-components-update") ??
    from;

  const selectors = [
    ".update-components-text",
    ".feed-shared-inline-show-more-text",
    ".feed-shared-update-v2__description",
    "[data-test-id='main-feed-activity-card__commentary']",
  ];

  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const text = node?.textContent?.replace(/\s+/g, " ").trim();
    if (text && text.length > 0) return text;
  }

  return root.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function findLinkedInCommentEditor(from: Element): HTMLElement | null {
  const root =
    from.closest(".feed-shared-update-v2") ??
    from.closest("article") ??
    from;

  return (
    root.querySelector<HTMLElement>(".ql-editor[contenteditable='true']") ??
    root.querySelector<HTMLElement>(".comments-comment-box__form [contenteditable='true']") ??
    root.querySelector<HTMLElement>("[contenteditable='true']")
  );
}
