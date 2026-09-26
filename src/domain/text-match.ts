export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasMarker(haystack: string, marker: string): boolean {
  const n = normalizeText(haystack);
  const m = marker.toLowerCase().trim();
  if (!m) return false;
  if (m.includes(" ")) return n.includes(m);
  return new RegExp(`(^|[^a-z0-9.+#])${escapeRegex(m)}[a-z0-9.+#]*([^a-z0-9.+#]|$)`).test(n);
}

export function hasAnyMarker(haystack: string, markers: readonly string[]): boolean {
  return markers.some((marker) => hasMarker(haystack, marker));
}

export function hasAllMarkers(haystack: string, markers: readonly string[]): boolean {
  return markers.every((marker) => hasMarker(haystack, marker));
}

export function missingAllMarkers(haystack: string, markers: readonly string[]): boolean {
  return !hasAnyMarker(haystack, markers);
}

export function countWords(text: string): number {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function uniqueOverlap(left: readonly string[], right: readonly string[]): string[] {
  const rightNorm = new Set(right.map((item) => normalizeText(item)));
  const seen = new Set<string>();
  const hits: string[] = [];
  for (const item of left) {
    const key = normalizeText(item);
    if (!rightNorm.has(key) || seen.has(key)) continue;
    seen.add(key);
    hits.push(item);
  }
  return hits;
}
