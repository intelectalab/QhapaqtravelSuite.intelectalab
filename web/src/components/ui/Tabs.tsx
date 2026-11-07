"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export function Tabs({ tabs, initial }: { tabs: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab:${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === current.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "-mb-px flex flex-none items-center gap-1.5 border-b-2 px-2.5 py-3.5 text-[13.5px] font-medium transition",
              tab.id === current.id ? "border-brand font-semibold text-fg" : "border-transparent text-fg-3 hover:text-fg",
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="rounded-md bg-surface-2 px-1.5 font-mono text-[11px] font-semibold text-fg-2">{tab.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-5">
        {current.content}
      </div>
    </div>
  );
}
