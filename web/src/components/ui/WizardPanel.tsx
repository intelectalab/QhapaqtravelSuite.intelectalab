"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { WizardFailure } from "@/lib/wizard";
import { Button } from "./Button";
import { SidePanel } from "./SidePanel";
import { StepIndicator } from "./StepIndicator";

export function useWizard(count: number, complete: boolean) {
  const last = count - 1;
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(complete ? last : 0);
  const [done, setDone] = useState<Set<number>>(() => new Set(complete ? Array.from({ length: count }, (_, index) => index) : []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ step: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (error: WizardFailure) => {
    const target = error.step !== null ? Math.min(Math.max(error.step - 1, 0), Math.max(furthest, step)) : step;
    setErrors(error.fields);
    setFailure({ step: target, message: error.message });
    setStep(target);
  };

  const pass = () => {
    setErrors({});
    setFailure(null);
    setDone((previous) => new Set(previous).add(step));
    setFurthest((previous) => Math.max(previous, Math.min(step + 1, last)));
    setStep(Math.min(step + 1, last));
  };

  return { step, setStep, last, furthest, done, errors, failure, busy, setBusy, fail, pass };
}

export type WizardState = ReturnType<typeof useWizard>;

interface WizardPanelProps {
  wizard: WizardState;
  steps: readonly string[];
  hints?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  bodyId: string;
  onNext: () => void;
  finish: ReactNode;
  notice?: string | null;
  children: ReactNode;
}

export function WizardPanel({ wizard, steps, hints, open, onOpenChange, title, description, bodyId, onNext, finish, notice, children }: WizardPanelProps) {
  const { step, last, furthest, done, failure, busy, setStep } = wizard;

  useEffect(() => {
    document.getElementById(bodyId)?.scrollTo({ top: 0 });
  }, [step, bodyId]);

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      bodyId={bodyId}
      title={title}
      description={description}
      subheader={<StepIndicator steps={steps} hints={hints} current={step} done={(index) => done.has(index)} failed={(index) => failure?.step === index} reachable={(index) => index <= furthest && !busy} onSelect={setStep} />}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" icon={<ArrowLeft size={16} />} disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
          <span className="flex flex-wrap items-center justify-end gap-2.5">
            {notice && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ok motion-safe:animate-[rise-in_260ms_ease-out_backwards]">
                <Check size={14} strokeWidth={2.6} />
                {notice}
              </span>
            )}
            {step === last ? (
              finish
            ) : (
              <Button type="button" variant="primary" data-testid={`wizard-next:${step + 1}`} disabled={busy} icon={busy ? <LoaderCircle size={16} className="animate-spin" /> : undefined} onClick={onNext}>
                Siguiente
                <ArrowRight size={16} />
              </Button>
            )}
          </span>
        </div>
      }
    >
      <div key={step} data-testid={`wizard-body:${step + 1}`} className="motion-safe:animate-[rise-in_280ms_ease-out_backwards]">
        <header className="mb-5">
          <p className="text-[12.5px] font-semibold text-fg-3">
            Paso {step + 1} de {steps.length}
          </p>
          <h3 className="text-[19px] font-bold tracking-tight">{steps[step]}</h3>
        </header>
        {failure?.step === step && (
          <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/[0.07] px-3.5 py-3 text-[13px] text-bad">
            <CircleAlert size={16} className="mt-0.5 flex-none" />
            {failure.message}
          </div>
        )}
        {children}
      </div>
    </SidePanel>
  );
}

export function useOpenFromQuery(defaultOpen: boolean, params: readonly string[]) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [round, setRound] = useState(0);
  const keys = params.join(",");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (defaultOpen && keys.split(",").some((key) => search.has(key))) router.replace(window.location.pathname, { scroll: false });
  }, [defaultOpen, keys, router]);

  const start = () => {
    setRound((value) => value + 1);
    setOpen(true);
  };

  return { open, setOpen, round, start };
}
