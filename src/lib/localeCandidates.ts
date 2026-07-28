// Storefront locales scanned by the per-locale localization audit
// (see src/lib/localizationAudit.ts). google-play-scraper's `lang` accepts
// these directly; `country` is picked to match the real storefront a native
// speaker of that locale would actually browse (not just "us" for
// everything), since Play sometimes varies pricing/availability by country.
export interface LocaleCandidate {
  code: string;
  country: string;
  label: string;
  /** Unicode scripts considered native to this locale - anything else
   * showing up in the fetched copy is a strong signal of leaked/untranslated
   * text (see SCRIPT_RANGES in localizationAudit.ts). Latin is always
   * implicitly allowed everywhere (brand names, "AI", etc.), so it's never
   * listed here. */
  ownScripts: string[];
}

export const LOCALE_CANDIDATES: LocaleCandidate[] = [
  { code: "en", country: "us", label: "English (US)", ownScripts: [] },
  { code: "es", country: "es", label: "Spanish", ownScripts: [] },
  { code: "de", country: "de", label: "German", ownScripts: [] },
  { code: "fr", country: "fr", label: "French", ownScripts: [] },
  { code: "pt", country: "br", label: "Portuguese (Brazil)", ownScripts: [] },
  { code: "it", country: "it", label: "Italian", ownScripts: [] },
  { code: "nl", country: "nl", label: "Dutch", ownScripts: [] },
  { code: "pl", country: "pl", label: "Polish", ownScripts: [] },
  { code: "sv", country: "se", label: "Swedish", ownScripts: [] },
  { code: "tr", country: "tr", label: "Turkish", ownScripts: [] },
  { code: "id", country: "id", label: "Indonesian", ownScripts: [] },
  { code: "vi", country: "vn", label: "Vietnamese", ownScripts: [] },
  { code: "ru", country: "ru", label: "Russian", ownScripts: ["cyrillic"] },
  { code: "ja", country: "jp", label: "Japanese", ownScripts: ["han", "kana"] },
  { code: "ko", country: "kr", label: "Korean", ownScripts: ["hangul", "han"] },
  { code: "zh-CN", country: "cn", label: "Chinese (Simplified)", ownScripts: ["han"] },
  { code: "ar", country: "sa", label: "Arabic", ownScripts: ["arabic"] },
  { code: "hi", country: "in", label: "Hindi", ownScripts: ["devanagari"] },
  { code: "th", country: "th", label: "Thai", ownScripts: ["thai"] },
];
