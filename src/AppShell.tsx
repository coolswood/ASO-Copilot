import type { ReactNode } from "react";
import { Link } from "react-router";
import PostHogProvider from "@/components/PostHogProvider";

/** Port of the Next.js root layout chrome (src/app/layout.tsx): sticky
 * header + nav around the router outlet, wrapped in PostHogProvider. */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2.5 font-semibold text-lg">
            <span className="inline-block h-6 w-6 rounded-md bg-accent transition-transform duration-300 group-hover:rotate-12" />
            ASO Copilot
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted">
            <Link to="/" className="group relative py-1 hover:text-foreground">
              Dashboard
              <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-accent transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
            <Link to="/search" className="group relative py-1 hover:text-foreground">
              Keyword Search
              <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-accent transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
            <Link
              to="/apps/new"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-accent-foreground font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0"
            >
              + Add App
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </PostHogProvider>
  );
}
