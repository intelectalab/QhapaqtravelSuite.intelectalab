"use client";

import { ChartColumnBig } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SidePanel } from "@/components/ui/SidePanel";

export function ChartsPanel({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        title={title}
        data-testid="charts-panel-open"
        className="group inline-grid h-8 w-8 place-items-center rounded-[10px] border border-line bg-surface text-fg-2 shadow-card transition hover:border-accent/40 hover:text-accent"
      >
        <ChartColumnBig size={16} strokeWidth={2} className="transition-transform duration-300 group-hover:scale-110" />
      </button>
      <SidePanel open={open} onOpenChange={setOpen} title={title} description={description} size="wide">
        {children}
      </SidePanel>
    </>
  );
}
