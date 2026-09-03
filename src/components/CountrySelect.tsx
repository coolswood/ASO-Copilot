import type { ChangeEvent } from "react";
import { storefrontLabel } from "./countryShared";
import { SCAN_COUNTRIES } from "@/lib/countries";

/** One reusable storefront picker over SCAN_COUNTRIES. Powers the global
 * country selector in the app detail header (value lives in the URL), and
 * the local query-time pickers on the search / add-app pages - extracted
 * from the three inline selects that previously duplicated this markup. */
export default function CountrySelect({
  value,
  onChange,
  label = "Storefront country",
  title = "Storefront country - the storefront decides which market's search results, demand and ranks you see",
  className = "",
}: {
  value: string;
  onChange: (country: string) => void;
  /** Accessible name for the select (aria-label). */
  label?: string;
  /** Hover hint explaining what the storefront changes. */
  title?: string;
  /** Extra classes appended to the base styling. */
  className?: string;
}) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value);
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      title={title}
      aria-label={label}
      className={`shrink-0 rounded-lg border border-border bg-card px-2 py-2 text-sm text-muted transition-colors focus:border-accent ${className}`}
    >
      {SCAN_COUNTRIES.map((country) => (
        <option key={country} value={country}>
          {storefrontLabel(country)} ({country})
        </option>
      ))}
    </select>
  );
}
