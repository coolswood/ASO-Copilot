"use client";

import { useState } from "react";

/** Store icon CDNs (play-lh.googleusercontent.com etc.) hotlink-block by
 * Referer: confirmed via direct fetch testing that identical bursts of
 * requests succeed 100% with no Referer header and fail with 429 100% of
 * the time once a foreign Referer is attached, independent of concurrency.
 * `referrerPolicy="no-referrer"` stops the browser from sending it at all. */
export default function AppIcon({
  src,
  alt = "",
  className,
}: {
  src: string | null;
  alt?: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={`${className} bg-border`} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
