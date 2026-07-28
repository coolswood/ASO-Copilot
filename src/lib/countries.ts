/** Major App Store / Google Play storefronts scanned by the "Global Reach"
 * world map. Bounded to a curated list rather than all ~250 ISO countries:
 * a full scan would be slow (one live store-search request per country) and
 * most of the long tail shares ranking behavior with a nearby major market
 * anyway. Lowercase to match the `country` param already threaded through
 * src/lib/stores/*. */
export const SCAN_COUNTRIES = [
  "us", "gb", "de", "fr", "jp", "kr", "cn", "br", "mx", "in",
  "ca", "au", "es", "it", "nl", "ru", "tr", "id", "ph", "vn",
  "th", "pl", "se", "ch", "at", "be", "sa", "ae", "eg", "za",
  "ng", "ar", "co", "cl", "pt", "dk", "no", "fi", "ie", "nz",
  "sg", "my", "hk", "tw",
];
