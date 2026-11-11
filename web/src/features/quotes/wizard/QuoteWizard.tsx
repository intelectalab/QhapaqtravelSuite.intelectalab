"use client";

import { Check, LoaderCircle, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { checkQuoteStep, previewQuote, saveQuote } from "@/app/(backoffice)/cotizaciones/actions";
import { Button } from "@/components/ui/Button";
import { useOpenFromQuery, useWizard, WizardPanel } from "@/components/ui/WizardPanel";
import { QUOTE_STEPS, type QuoteDetail, type QuoteFormOptions, type QuotePreview } from "@/lib/quotes";
import { initialDraft, quotePayload, quoteStepSummaries, type QuoteDraft, type QuotePatch } from "./draft";
import { GeneralStep, ItemsStep, SummaryStep, TripStep } from "./QuoteSteps";

const BODY = "quote-wizard-body";

interface QuoteWizardProps {
  options: QuoteFormOptions;
  quote?: QuoteDetail;
  opportunityCode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteWizard({ options, quote, opportunityCode, open, onOpenChange }: QuoteWizardProps) {
  const router = useRouter();
  const editing = quote !== undefined;
  const wizard = useWizard(QUOTE_STEPS.length, editing);
  const { step, errors, busy, setBusy, fail, pass } = wizard;
  const [draft, setDraft] = useState<QuoteDraft>(() => initialDraft(options, quote, opportunityCode));
  const [preview, setPreview] = useState<QuotePreview | null>(null);
  const payload = useMemo(() => quotePayload(draft, quote?.lock_version), [draft, quote?.lock_version]);
  const pricing = step >= 2;

  const set = (patch: QuotePatch | ((current: QuoteDraft) => QuotePatch)) => setDraft((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }));

  useEffect(() => {
    if (!pricing || payload.items.length === 0) return;
    let active = true;
    const timer = setTimeout(async () => {
      const result = await previewQuote(payload);
      if (active && result.preview) setPreview(result.preview);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [payload, pricing]);

  const next = async () => {
    setBusy(true);
    const result = await checkQuoteStep(payload, step + 1);
    setBusy(false);
    if (!result.ok) return fail(result.error);
    if (step >= 2) setPreview(result.data);
    pass();
  };

  const save = async () => {
    setBusy(true);
    const result = await saveQuote(quote?.code ?? null, payload, quote?.version);
    if (!result.ok) {
      setBusy(false);
      return fail(result.error);
    }
    onOpenChange(false);
    if (editing) {
      setBusy(false);
      router.refresh();
      return;
    }
    router.push(`/cotizaciones/${encodeURIComponent(result.data.code)}`);
  };

  const props = { draft, set, options, errors };
  const bodies: ReactNode[] = [<GeneralStep key="1" {...props} />, <TripStep key="2" {...props} />, <ItemsStep key="3" {...props} preview={preview} />, <SummaryStep key="4" {...props} preview={preview} />];
  const hints = useMemo(() => quoteStepSummaries(draft, options, preview), [draft, options, preview]);

  return (
    <WizardPanel
      wizard={wizard}
      steps={QUOTE_STEPS}
      hints={hints}
      open={open}
      onOpenChange={onOpenChange}
      bodyId={BODY}
      title={quote ? `Editar ${quote.code}` : "Nueva cotización"}
      description={quote ? `${quote.title} · versión ${quote.version} en borrador. Los cambios se guardan al terminar.` : "Se guarda como borrador en su versión 1. El precio lo calcula el sistema con las tarifas vigentes."}
      onNext={next}
      finish={
        <Button type="button" variant="primary" data-testid="quote-save" disabled={busy} icon={busy ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />} onClick={save}>
          {editing ? "Guardar cambios" : "Crear borrador"}
        </Button>
      }
    >
      {bodies[step]}
    </WizardPanel>
  );
}

interface QuoteWizardActionProps {
  options: QuoteFormOptions;
  quote?: QuoteDetail;
  opportunityCode?: string;
  defaultOpen?: boolean;
}

export function QuoteWizardAction({ options, quote, opportunityCode, defaultOpen = false }: QuoteWizardActionProps) {
  const { open, setOpen, round, start } = useOpenFromQuery(defaultOpen, ["nueva", "editar", "oportunidad"]);

  return (
    <>
      {quote ? (
        <Button type="button" icon={<Pencil size={16} />} onClick={start} data-testid="btn-edit-quote">
          Editar
        </Button>
      ) : (
        <Button type="button" variant="primary" icon={<Plus size={16} strokeWidth={2.4} />} onClick={start} data-testid="btn-new-quote">
          Nueva cotización
        </Button>
      )}
      <QuoteWizard key={round} options={options} quote={quote} opportunityCode={round === 0 ? opportunityCode : undefined} open={open} onOpenChange={setOpen} />
    </>
  );
}
