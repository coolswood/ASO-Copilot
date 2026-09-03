"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

function Screenshot({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-72 w-40 flex-col items-center justify-center gap-2 bg-border/30 text-center">
        <ImageOff className="h-5 w-5 text-muted" />
        <div className="px-2 text-xs text-muted">Failed to load</div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`Screenshot ${index + 1}`}
      className="h-72 w-auto block bg-border/30"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export default function ScreenshotGallery({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
          <ImageOff className="h-5 w-5 text-muted" />
        </div>
        <div className="text-sm text-muted">No screenshots found on the store listing.</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
      {urls.map((url, i) => (
        <div
          key={`${i}-${url}`}
          className="shrink-0 snap-start rounded-xl overflow-hidden border border-border shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
        >
          <Screenshot url={url} index={i} />
        </div>
      ))}
    </div>
  );
}
