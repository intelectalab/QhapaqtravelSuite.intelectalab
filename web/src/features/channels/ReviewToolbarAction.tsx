"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { StepResult } from "@/lib/server/resource";

export function ReviewToolbarAction({ label, icon, hint, run }: { label: string; icon: ReactNode; hint: string; run: () => Promise<StepResult> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<StepResult | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        title={hint}
        disabled={pending}
        onClick={() => start(async () => setResult(await run()))}
        className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 text-[13.5px] font-semibold text-fg transition hover:-translate-y-0.5 hover:bg-surface-2 disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : icon}
        {label}
      </button>
      {result?.message && <span className={cn("text-[13px]", result.done ? "text-ok" : "text-bad")}>{result.message}</span>}
    </div>
  );
}
