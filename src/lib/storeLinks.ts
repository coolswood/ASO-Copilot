// Outbound links to the public store search/listing pages - used wherever a
// keyword or competitor name links out to "go see this on the App
// Store/Google Play" (KeywordsSection, ResearchSection, the /search page,
// CompetitorsSection). Previously copy-pasted verbatim into each of those.

export function appStoreSearchUrl(term: string): string {
  return `https://apps.apple.com/us/search?term=${encodeURIComponent(term)}`;
}

export function playStoreSearchUrl(term: string): string {
  return `https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps`;
}

/** Google Play listing URLs resolve directly from the package id. There's no
 * iOS equivalent here - Apple's product page URLs need the numeric trackId,
 * not the bundleId this app tracks by, so iOS callers fall back to
 * appStoreSearchUrl by name instead. */
export function playStoreListingUrl(storeId: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(storeId)}`;
}
