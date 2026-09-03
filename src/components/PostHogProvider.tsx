import { useEffect } from "react";
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

/** No-op unless VITE_POSTHOG_KEY is set — this is a self-hosted,
 * single-user tool, so analytics are opt-in, not on by default. Set the key
 * in .env when you want usage analytics for this instance. */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY || posthog.__loaded) return;
    posthog.init(KEY, { api_host: HOST, capture_pageview: true, capture_pageleave: true });
  }, []);

  return children;
}
