"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import type { StepResult } from "@/lib/server/resource";

export const STEP_INITIAL: StepResult = { message: null, done: false };

type StepAction = (state: StepResult, form: FormData) => Promise<StepResult>;

export function HiddenFields({ values }: { values: Record<string, string | number | null | undefined> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value ?? ""} />
      ))}
    </>
  );
}

interface ConfirmActionProps {
  id: string;
  label: string;
  title: string;
  description: ReactNode;
  submitLabel: string;
  action: StepAction;
  hidden: Record<string, string | number | null | undefined>;
  tone?: "delete" | "neutral" | "edit";
  icon?: ReactNode;
  reason?: string;
  children?: ReactNode;
}

export function ConfirmAction({ id, label, title, description, submitLabel, action, hidden, tone = "delete", icon, reason, children }: ConfirmActionProps) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={label}
      formId={`confirm-${id}`}
      trigger={(open) => <RowIcon tone={tone} label={label} icon={icon} onClick={open} />}
      title={title}
      description={description}
      submitLabel={submitLabel}
      action={action}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={hidden} />
          {children}
          {reason && <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={300} placeholder={reason} />}
        </>
      )}
    </PanelAction>
  );
}

export function DetailPanel({ title, description, label = "Ver detalle", children, trigger }: { title: string; description?: ReactNode; label?: string; children: ReactNode; trigger?: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : <RowIcon tone="view" label={label} onClick={() => setOpen(true)} />}
      <SidePanel open={open} onOpenChange={setOpen} title={title} description={description}>
        <div className="flex flex-col gap-5">{children}</div>
      </SidePanel>
    </>
  );
}

export function NameButton({ children, onClick, hint }: { children: ReactNode; onClick: () => void; hint?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 text-left">
      <span className="block truncate font-semibold transition-colors hover:text-accent hover:underline">{children}</span>
      {hint && <small className="block truncate text-xs text-fg-3">{hint}</small>}
    </button>
  );
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

export function OccupancyBar({ capacity, sold, held = 0, delay = 0, compact = false }: { capacity: number; sold: number; held?: number; delay?: number; compact?: boolean }) {
  const safe = Math.max(capacity, 1);
  const soldPct = Math.min(100, (sold / safe) * 100);
  const heldPct = Math.min(100 - soldPct, (held / safe) * 100);
  const free = Math.max(0, capacity - sold - held);
  const tone = soldPct + heldPct >= 100 ? "bg-bad" : soldPct + heldPct >= 75 ? "bg-warn" : "bg-ok";
  return (
    <div className={cn("group/bar min-w-[132px]", compact && "min-w-[96px]")} title={`${sold} vendidos · ${held} retenidos · ${free} libres de ${capacity}`}>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-2 transition-[height] duration-200 group-hover/bar:h-2.5">
        <span className={cn("absolute inset-y-0 left-0 origin-left rounded-full motion-safe:animate-[fill-x_720ms_cubic-bezier(0.22,1,0.36,1)_backwards]", tone)} style={{ width: `${soldPct}%`, animationDelay: `${delay}ms` }} />
        {heldPct > 0 && <span className="absolute inset-y-0 origin-left bg-[repeating-linear-gradient(135deg,var(--warn)_0_4px,color-mix(in_srgb,var(--warn)_45%,transparent)_4px_8px)] motion-safe:animate-[fill-x_720ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ left: `${soldPct}%`, width: `${heldPct}%`, animationDelay: `${delay + 160}ms` }} />}
      </div>
      {!compact && (
        <p className="mt-1 flex justify-between gap-2 font-mono text-[11.5px] text-fg-3">
          <span>
            <b className="font-semibold text-fg">{sold}</b>/{capacity}
            {held > 0 && <span className="text-warn"> · {held} en hold</span>}
          </span>
          <span className={cn(free === 0 ? "text-bad" : "text-ok", "font-semibold")}>{free} libres</span>
        </p>
      )}
    </div>
  );
}
