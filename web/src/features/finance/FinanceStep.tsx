"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { financeStep } from "@/app/(backoffice)/finanzas/actions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { useQuickAction } from "@/components/ui/QuickAction";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

export interface StepButton {
  label: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  testId?: string;
}

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
  action?: (state: StepResult, form: FormData) => Promise<StepResult>;
  children?: ReactNode;
  successToast?: string;
  testId?: string;
  button?: StepButton;
}

export function FinanceStep({ step, itemKey = "", label, icon, variant = "secondary", title, description, submitLabel, trigger, action = financeStep, children, successToast, testId, button }: FinanceStepProps) {
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
      action={action}
      initial={initial}
      trigger={button ? (open) => <Button variant={button.variant ?? "secondary"} icon={button.icon} onClick={open} data-testid={button.testId}>{button.label}</Button> : trigger}
      testId={testId}
      successToast={successToast}
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

interface QuickStepProps {
  step: string;
  itemKey: string;
  values?: Record<string, string | number>;
  button: StepButton;
  successToast: string;
  size?: "md" | "sm";
}

export function QuickFinanceStep({ step, itemKey, values = {}, button, successToast, size = "sm" }: QuickStepProps) {
  const { run, pending } = useQuickAction(financeStep, initial);
  return (
    <Button size={size} variant={button.variant ?? "secondary"} icon={button.icon} onClick={() => run({ step, key: itemKey, ...values }, successToast)} disabled={pending} data-testid={button.testId}>
      {pending ? "Un momento…" : button.label}
    </Button>
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
