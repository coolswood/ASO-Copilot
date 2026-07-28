"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface AppTab {
  id: string;
  label: string;
  // A pre-rendered icon element, not a component reference - component
  // references (functions) can't cross the Server -> Client Component
  // boundary as props, only serializable data or already-rendered JSX.
  icon: ReactNode;
  badge?: number;
  content: ReactNode;
}

export default function AppTabs({ tabs }: { tabs: AppTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [topOffset, setTopOffset] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  // Measured, not hardcoded: the site header's real height (not a guessed
  // pixel value) so this bar docks directly under it regardless of font
  // metrics, zoom, or future header changes.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setTopOffset(header.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div
        ref={barRef}
        className="sticky z-10 -mx-4 border-b border-border bg-background px-4 sm:-mx-6 sm:px-6"
        style={{ top: topOffset }}
      >
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`group relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-3 text-sm font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="rounded-full bg-border px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {tab.badge}
                  </span>
                )}
                <span
                  className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent transition-transform duration-200 ${
                    isActive ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === active ? "animate-fade-in-up pt-6" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
