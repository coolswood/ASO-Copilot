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

// Primary language of each storefront's store audience. google-play-scraper's
// `lang` parameter defaults to "en", so without an explicit mapping every
// non-English storefront gets searched/ranked/scored against English-language
// results - a Cyrillic keyword then measures zero demand because no English
// listing title contains it, even though the storefront's own audience sees a
// full page of local results for it. The App Store search API takes no lang
// (the storefront implies the language), so only the Play path uses this.
const STOREFRONT_LANGS: Record<string, string> = {
  de: "de", at: "de", ch: "de",
  fr: "fr",
  es: "es", mx: "es", ar: "es", co: "es", cl: "es",
  it: "it",
  nl: "nl", be: "nl",
  pt: "pt", br: "pt",
  ru: "ru",
  tr: "tr",
  id: "id",
  vn: "vi",
  th: "th",
  pl: "pl",
  se: "sv",
  dk: "da",
  no: "no",
  fi: "fi",
  jp: "ja",
  kr: "ko",
  cn: "zh-CN",
  tw: "zh-TW",
  sa: "ar", ae: "ar", eg: "ar",
};

/** Result language for a storefront. English-speaking storefronts (and any
 * country not mapped above) fall back to "en", matching Play's own default. */
export function storefrontLang(country: string): string {
  return STOREFRONT_LANGS[country.toLowerCase()] ?? "en";
}
