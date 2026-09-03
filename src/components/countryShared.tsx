// Client-safe storefront helpers shared by the keywords and competitors
// tables. Kept in a component module (like localeShared.tsx) rather than
// src/lib/countries.ts because that file documents server-side scan behavior;
// these are pure display bits.

/** Human storefront name for a 2-letter country code ("de" -> "Germany").
 * Intl.DisplayNames needs no locale data bundled and works in every browser
 * this app targets, so a static country-name map isn't worth maintaining. */
export function storefrontLabel(country: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) ?? country.toUpperCase();
  } catch {
    return country.toUpperCase();
  }
}

/** Small uppercase country code badge identifying which storefront a keyword
 * (and its ranks) belongs to. */
export function CountryChip({ country, muted = false }: { country: string; muted?: boolean }) {
  return (
    <span
      title={`Storefront: ${storefrontLabel(country)} (${country})`}
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        muted ? "bg-background text-muted" : "bg-border/60 text-muted"
      }`}
    >
      {country}
    </span>
  );
}
