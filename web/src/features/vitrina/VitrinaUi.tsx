"use client";

import type { ReactNode } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";
import { vitrinaStatus } from "@/lib/vitrina";

export const initialStep: StepResult = { message: null, done: false };

type StepAction = (state: StepResult, form: FormData) => Promise<StepResult>;

export function VitrinaBadge({ status, label }: { status: string; label?: string }) {
  const meta = vitrinaStatus(status);
  return <Badge tone={meta.tone}>{label ?? meta.label}</Badge>;
}

export function PillButton({ onClick, tone = "accent", icon, children }: { onClick: () => void; tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={toneStyle(tone)} className="tint-soft inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-[12.5px] font-semibold transition-transform duration-300 hover:-translate-y-0.5">
      {icon}
      {children}
    </button>
  );
}

interface QuickActionProps {
  id: string;
  label: string;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  action: StepAction;
  fields?: Record<string, string>;
  icon?: ReactNode;
  tone?: Tone;
  row?: "view" | "edit" | "delete" | "neutral";
  primary?: boolean;
  children?: ReactNode;
}

export function QuickAction({ id, label, title, description, submitLabel, action, fields = {}, icon, tone = "accent", row, primary = false, children }: QuickActionProps) {
  return (
    <PanelAction<StepResult>
      label={label}
      icon={icon}
      variant={primary ? "primary" : "secondary"}
      formId={id}
      title={title}
      description={description}
      submitLabel={submitLabel}
      action={action}
      initial={initialStep}
      trigger={primary ? undefined : (open) => (row ? <RowIcon tone={row} label={label} icon={icon} onClick={open} /> : <PillButton onClick={open} tone={tone} icon={icon}>{label}</PillButton>)}
    >
      {() => (
        <>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {children ?? <p className="text-[13.5px] text-fg-2">Confirma para continuar.</p>}
        </>
      )}
    </PanelAction>
  );
}

export function TabCard({ tabs, initial }: { tabs: TabItem[]; initial?: string }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card [&_.shadow-card]:shadow-none">
      <Tabs tabs={tabs} initial={initial} />
    </section>
  );
}

export function ScoreRing({ value }: { value: number | null }) {
  const score = value ?? 0;
  const tone: Tone = score >= 80 ? "ok" : score >= 60 ? "warn" : "bad";
  return (
    <span style={{ ...toneStyle(tone), background: `conic-gradient(var(--tint) ${score * 3.6}deg, var(--surface-2) 0)` }} className="group relative grid h-10 w-10 place-items-center rounded-full transition-transform duration-300 hover:scale-110" title={value === null ? "Sin auditar" : `Puntaje ${score} de 100`}>
      <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-surface text-[11.5px] font-bold text-[var(--tint)]">{value ?? "—"}</span>
    </span>
  );
}

export function Meter({ value, max, tone = "t1", className }: { value: number; max: number; tone?: Tone; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span style={toneStyle(tone)} className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }} />
    </span>
  );
}
