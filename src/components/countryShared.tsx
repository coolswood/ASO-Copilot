// Client-safe storefront helpers shared by the country pickers and labels.
// Kept in a component module (like localeShared.tsx) rather than
// src/lib/countries.ts because that file documents server-side scan behavior;
// these are pure display bits.

/** Human storefront name for a 2-letter country code ("de" -> "Germany").
 * Intl.DisplayNames needs no locale data bundled and works in every browser
 * this app targets, so a static country-name map isn't worth maintaining. */
export function storefrontLabel(country: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) ??
      country.toUpperCase()
    );
  } catch {
    return country.toUpperCase();
  }
}
