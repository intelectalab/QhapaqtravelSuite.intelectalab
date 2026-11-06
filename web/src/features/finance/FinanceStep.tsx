"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { financeStep } from "@/app/(backoffice)/finanzas/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

interface FinanceStepProps {
  step: string;
  itemKey?: string;
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  title: string;
  description?: ReactNode;
  submitLabel: string;
  trigger?: (open: () => void) => ReactNode;
  children?: ReactNode;
}

export function FinanceStep({ step, itemKey = "", label, icon, variant = "secondary", title, description, submitLabel, trigger, children }: FinanceStepProps) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={label}
      icon={icon}
      variant={variant}
      formId={`finance-${step}-${itemKey || "new"}`}
      title={title}
      description={description}
      submitLabel={submitLabel}
      action={financeStep}
      initial={initial}
      trigger={trigger}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="key" value={itemKey} />
          {children}
        </>
      )}
    </PanelAction>
  );
}

export function SummaryBox({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="grid gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <dt className="text-fg-3">{row.label}</dt>
          <dd className={row.strong ? "font-mono font-semibold text-fg" : "text-fg-2"}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
