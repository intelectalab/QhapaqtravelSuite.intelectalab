"use client";

import { Check, Copy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { growthStep, type GrowthStepResult } from "@/app/(backoffice)/finanzas/crecimiento-actions";
import { PanelAction } from "@/components/ui/PanelAction";

const initial: GrowthStepResult = { message: null, done: false, notice: null };

interface GrowthStepProps {
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

export function NoticeCard({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text.match(/https?:\/\/\S+|[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}/)?.[0] ?? text);
    setCopied(true);
  };
  return (
    <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-[420px] items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-[0_18px_40px_-16px_rgb(14_17_32/0.35)] animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)]">
      <p className="min-w-0 flex-1 break-words text-[13px] leading-relaxed text-fg-2">{text}</p>
      <button type="button" onClick={copy} className="grid h-8 w-8 flex-none place-items-center rounded-lg text-fg-2 transition hover:bg-surface-2 hover:text-fg" aria-label="Copiar">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <button type="button" onClick={onClose} className="grid h-8 w-8 flex-none place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg" aria-label="Cerrar">
        <X size={15} />
      </button>
    </div>
  );
}

export function GrowthStep({ step, itemKey = "", label, icon, variant = "secondary", title, description, submitLabel, trigger, children }: GrowthStepProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <PanelAction<GrowthStepResult>
        label={label}
        icon={icon}
        variant={variant}
        formId={`growth-${step}-${itemKey || "new"}`}
        title={title}
        description={description}
        submitLabel={submitLabel}
        action={growthStep}
        initial={initial}
        trigger={trigger}
        onDone={(state) => {
          setNotice(state.notice ?? null);
          router.refresh();
        }}
      >
        {() => (
          <>
            <input type="hidden" name="step" value={step} />
            <input type="hidden" name="key" value={itemKey} />
            {children}
          </>
        )}
      </PanelAction>
      {notice && <NoticeCard text={notice} onClose={() => setNotice(null)} />}
    </>
  );
}
