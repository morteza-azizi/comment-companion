# Roadmap

## v0.1

- Vivino adapter
- Random comments
- Local comment library

## v0.2

- Categories
- Favorites

## v0.3

- Keyboard shortcuts

## v0.4

- AI-assisted rewrites

## v0.5

- Personal tasting history matching: import your own wine ratings (e.g. a
  Vivino export CSV), stored locally only (`chrome.storage.local`, no
  cloud dependency).
- Fuzzy-match wines seen in the feed (via `WinePageExtractor`) against your
  imported history on wine name + producer (+ vintage as a tie-breaker),
  biased toward false negatives — an unmatched wine just falls back to the
  existing non-tasting-claim comments, never a wrong personal claim.
- On a verified match, generate honest first-person comments based on your
  actual rating band (e.g. loved it / solid / mixed / not a favorite),
  optionally pulling a short snippet from your own tasting note if present.
- Needs a simple options page (paste/upload CSV) since this data has to be
  imported somewhere — the current `storage` permission in the manifest is
  otherwise unused.

## v1.0

- Multi-platform support