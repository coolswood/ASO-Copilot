// Pure country-parameter helpers shared by the client (URL ?country= of the
// global storefront selector) and the server (REST query/body params, MCP
// tool inputs). Client-safe by design - no server imports, pattern of
// src/lib/metricColor.ts / storeLinks.ts.

/** Lowercase ISO 3166-1 alpha-2 - the canonical `country` format everywhere
 * (DB columns, store facades, URLs). Same regex as server-side validation. */
const COUNTRY_CODE_RE = /^[a-z]{2}$/;

/** Normalizes a raw country parameter (URL search param, query string, MCP
 * input) to a valid lowercase 2-letter code, or null when it is missing,
 * empty, or not a 2-letter code. Uppercase input ("DE") is normalized to
 * lowercase, matching how every other country value in the system is stored. */
export function parseCountryParam(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return COUNTRY_CODE_RE.test(normalized) ? normalized : null;
}

/** Resolves the effective country: the parsed param when valid, else the
 * fallback (e.g. the app's home country), else "us". Used for the global
 * selector's fallback chain URL param -> app.country -> "us". The fallback is
 * validated too, so a garbage fallback can never leak through. */
export function resolveCountry(param: string | null | undefined, fallback: string): string {
  return parseCountryParam(param) ?? parseCountryParam(fallback) ?? "us";
}
