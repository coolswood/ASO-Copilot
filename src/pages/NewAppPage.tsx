import { useState } from "react";
import AppSearchPicker, { SearchHit } from "@/components/AppSearchPicker";
import AddAppProgress from "@/components/AddAppProgress";
import CountrySelect from "@/components/CountrySelect";
import type { StorePlatform } from "@/lib/stores/types";

export default function NewAppPage() {
  // Query-time picker (not the global URL-driven one): the market the user is
  // adding the app for becomes its home storefront.
  const [country, setCountry] = useState("us");
  const [selected, setSelected] = useState<{ hit: SearchHit; platform: StorePlatform } | null>(
    null,
  );

  if (selected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <AddAppProgress hit={selected.hit} platform={selected.platform} country={country} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Add an app</h1>
        <p className="text-sm text-muted mb-6">
          Search the App Store or Google Play, then pick your app to start tracking it.
        </p>
      </div>
      <div className="animate-fade-in-up [animation-delay:80ms] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Storefront to add the app for:</span>
          <CountrySelect
            value={country}
            onChange={setCountry}
            title="The app's home storefront - its keywords, competitors and reviews start out tracked in this market"
          />
        </div>
        <AppSearchPicker
          platform="IOS"
          country={country}
          onSelect={(hit, platform) => setSelected({ hit, platform })}
        />
      </div>
    </div>
  );
}
