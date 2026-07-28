"use client";

import { useState } from "react";
import AppSearchPicker, { SearchHit } from "@/components/AppSearchPicker";
import AddAppProgress from "@/components/AddAppProgress";

export default function NewAppPage() {
  const [selected, setSelected] = useState<{ hit: SearchHit; platform: "IOS" | "ANDROID" } | null>(null);

  if (selected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <AddAppProgress hit={selected.hit} platform={selected.platform} />
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
      <div className="animate-fade-in-up [animation-delay:80ms]">
        <AppSearchPicker platform="IOS" onSelect={(hit, platform) => setSelected({ hit, platform })} />
      </div>
    </div>
  );
}
