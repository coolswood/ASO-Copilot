/** Color for a 0-100 volume/difficulty score (see volumeAndDifficulty in
 * research.ts) - `inverse` flips the good/bad direction since low difficulty
 * is good but low volume isn't. Shared by MetricBar and ResearchSection's
 * inline metric text.
 *
 * Deliberately its own module, not exported from research.ts: research.ts
 * pulls in the live store-scraping clients (google-play-scraper, cheerio,
 * etc.), which are server-only. MetricBar is a Client Component, so
 * importing metricColor from research.ts would drag that whole server-only
 * dependency chain into the browser bundle. */
export function metricColor(value: number, inverse = false): string {
  const good = inverse ? value <= 40 : value >= 60;
  const mid = inverse ? value <= 70 : value >= 30;
  if (good) return "var(--success)";
  if (mid) return "var(--warning)";
  return "var(--danger)";
}
