"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/** No-op unless NEXT_PUBLIC_POSTHOG_KEY is set — this is a self-hosted,
 * single-user tool, so analytics are opt-in, not on by default. Set the key
 * in .env when you want usage analytics for this instance. */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY || posthog.__loaded) return;
    posthog.init(KEY, { api_host: HOST, capture_pageview: true, capture_pageleave: true });
  }, []);

  return children;
}
