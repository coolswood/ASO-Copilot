// Shared by both the client (locale picker UI) and server (prompt building,
// validation) sides of AI Copy Suggestions - kept in its own module so the
// client component doesn't have to import src/lib/ai.ts (which talks to
// OpenRouter and reads server-only env vars) just to render a locale list.
export interface AILocale {
  code: string;
  label: string;
}

// Fixed top set rather than every store-supported locale: covers the
// highest-traffic markets without needing per-app locale configuration UI.
// English-speaking storefronts (US/UK/Canada) convert disproportionately
// well, so they get their own regional variants (same language, different
// spelling/idiom conventions - "colour"/"favourite"/"organise") alongside a
// handful of the highest-traffic non-English markets. Matches the major
// storefronts already scanned by the "Global Reach" world map.
export const AI_LOCALES: AILocale[] = [
  { code: "en", label: "English (US)" },
  { code: "en-gb", label: "English (UK)" },
  { code: "en-ca", label: "English (Canada)" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
];
