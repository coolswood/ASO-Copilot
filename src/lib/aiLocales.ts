// Shared by both the client (locale picker UI) and server (prompt building,
// validation) sides of AI Copy Suggestions - kept in its own module so the
// client component doesn't have to import src/lib/ai.ts (which talks to
// OpenRouter and reads server-only env vars) just to render a locale list.
export interface AILocale {
  code: string;
  label: string;
  /** Storefront country to search when discovering local keyword ideas for
   * this locale (see discoverLocaleKeywords in src/lib/research.ts) - kept
   * alongside the label so that's the one place a locale's real-world
   * storefront identity lives. */
  country: string;
}

// Fixed top set rather than every store-supported locale: covers the
// highest-traffic markets without needing per-app locale configuration UI.
// English-speaking storefronts (US/UK/Canada) convert disproportionately
// well, so they get their own regional variants (same language, different
// spelling/idiom conventions - "colour"/"favourite"/"organise") alongside a
// handful of the highest-traffic non-English markets. Matches the major
// storefronts already scanned by the "Global Reach" world map.
export const AI_LOCALES: AILocale[] = [
  { code: "en", label: "English (US)", country: "us" },
  { code: "en-gb", label: "English (UK)", country: "gb" },
  { code: "en-ca", label: "English (Canada)", country: "ca" },
  { code: "es", label: "Spanish", country: "es" },
  { code: "de", label: "German", country: "de" },
  { code: "fr", label: "French", country: "fr" },
  { code: "pt", label: "Portuguese", country: "br" },
  { code: "it", label: "Italian", country: "it" },
  { code: "nl", label: "Dutch", country: "nl" },
  { code: "pl", label: "Polish", country: "pl" },
  { code: "ja", label: "Japanese", country: "jp" },
];
