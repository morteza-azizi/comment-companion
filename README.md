# Vivino Conversation Companion

A small Chrome extension that helps you decide **whether** to join a conversation on a Vivino review, and, if so, **what** is worth saying. It is not a comment generator. Most of the time the honest answer is "skip", and the tool says so.

It never posts anything. It never writes into Vivino's comment box. You read the suggestion, edit it if you like, copy it and paste it yourself.

## What it does

1. **Gets the context.** From a Vivino review card (best effort) or from text you paste or type. Every field is optional: wine, producer, vintage, region, grapes, rating, review text, reviewer.
2. **Analyses the review.** It separates what the reviewer said (quoted), a cautious reading of it, and what the review does not tell you (food, serving, price...). It never adds wine knowledge the reviewer didn't give.
3. **Decides.** One of: skip, ask a specific question, share an observation, compare perspectives, respectfully disagree, acknowledge a specific insight, explore the difference, or ask for more context. Generic reviews ("Great wine!") produce SKIP.
4. **Writes at most one comment.** It is short, anchored to a phrase from the review, and passes a quality gate: no generic praise, no echoing the review, no invented tasting experience, no characteristics the review did not mention.
5. **Keeps you in control.** Copy, edit, "Another angle" or Skip.
6. **Remembers locally.** Interactions are stored in `chrome.storage.local`. Repeating yourself is discouraged: the same wording or the same underlying idea as a comment you recently used is rejected. A different angle on the same topic is allowed.
7. **Outcomes are yours to record.** If someone replied and the reply was meaningful, you can note it. The extension cannot see replies and never claims to.

### Honesty rules

- First-person claims ("I tasted...", "I prefer...") only appear if you typed them in **My own impression**, and then verbatim.
- "Share an observation" and "Respectfully disagree" are only offered when you supply that impression.
- No network requests, no backend, no analytics, no LLM. The wording comes from sentence frames, and the quality gate checks every result.

## Install and run

Requirements: Node.js 20+ and Chrome or another Chromium browser.

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked** and select the `dist` folder. Open any page on `https://www.vivino.com`.

- Click the 🍷 button next to a review's comment box to analyse that review.
- Or click the floating launcher at the bottom right to paste a review manually. On a wine page (`/w/<id>`), the wine details are pre-filled.

## Develop and test

```bash
npm test            # vitest, full suite (jsdom tests included)
npx tsc --noEmit    # typecheck
npm run build       # typecheck and production build into dist/
npm run dev         # vite dev build with the CRX plugin
```

There is no linter configured.

## Layout

```
src/
  domain/      pure logic: review analysis, opportunity decision, quality gate,
               repetition fingerprints, interaction history
  services/    comment writer, companion pipeline, manual input parsing,
               Vivino extraction, storage, workspace controller
  adapters/    Vivino page integration (injects the trigger and launcher)
  ui/          Shadow DOM workspace panel
```

Pipeline: `analyzeReview` -> `decideOpportunity` -> `writeVariants` -> `checkQuality` -> `assessRepetition` -> user approval.

## Known limits

- Vivino's review-card markup could only be checked partially, because feeds need a login. Wine pages (JSON-LD, grape and region links) were checked. If a card cannot be read, the panel opens with what it found and asks you to paste the rest.
- Vivino can change its markup at any time. Manual input always works.
- The tasting vocabulary recognises common English terms only. Reviews in other languages, or with unusual wording, tend to get SKIP or "more context".
- Wording is template-based, so it is plain by design.
- Not tested: loading the built extension in a logged-in Vivino session.

Please follow Vivino's terms of service and keep your own pace. This tool is meant to reduce noise, not produce it.

## License

MIT
