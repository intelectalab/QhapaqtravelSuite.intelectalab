"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, LoaderCircle, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addProductRate, createProductFromDraft, previewProductDraft, removeProductRate, saveProductSection, setProductRateActive, updateProductRate, type ProductSection, type WizardFailure } from "@/app/(backoffice)/catalogo/productos/wizard-actions";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { PRODUCT_STEPS, type ProductDraft, type ProductEditorState, type ProductFormOptions, type ProductRateDraft, type ProductReview } from "@/lib/catalog";
import { draftFromState, emptyDraft, SECTION_OF_STEP, stepSummary, type DraftPatch } from "./draft";
import { CategorizeStep, DefineStep, DestinationStep } from "./StepsBasics";
import { cleanContent, ContentStep, PublishStep } from "./StepsContent";
import { AvailabilityStep, ComponentsStep, ItineraryStep, RatesStep, SeasonsStep } from "./StepsOperation";

const LAST = PRODUCT_STEPS.length - 1;
const BODY = "product-wizard-body";

interface ProductWizardProps {
  options: ProductFormOptions;
  initial?: ProductEditorState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: number;
}

export function ProductWizard({ options, initial, open, onOpenChange, initialStep = 0 }: ProductWizardProps) {
  const router = useRouter();
  const creating = initial === undefined;
  const [draft, setDraft] = useState<ProductDraft>(() => (initial ? draftFromState(initial, options) : emptyDraft(options)));
  const [saved, setSaved] = useState<ProductEditorState | null>(initial ?? null);
  const [step, setStep] = useState(creating ? 0 : initialStep);
  const [furthest, setFurthest] = useState(creating ? 0 : LAST);
  const [done, setDone] = useState<Set<number>>(() => new Set(creating ? [] : PRODUCT_STEPS.map((_, index) => index)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ step: number; message: string } | null>(null);
  const [preview, setPreview] = useState<ProductReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const review = saved?.review ?? preview;
  const rates: ProductRateDraft[] = saved ? saved.rates : draft.rates;

  const set = (patch: DraftPatch | ((current: ProductDraft) => DraftPatch)) => setDraft((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }));

  useEffect(() => {
    document.getElementById(BODY)?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const fail = (error: WizardFailure, current: number) => {
    const target = error.step !== null ? error.step - 1 : current;
    setErrors(error.fields);
    setFailure({ step: target, message: error.message });
    setStep(target);
  };

  const succeed = (current: number) => {
    setErrors({});
    setFailure(null);
    setDone((previous) => new Set(previous).add(current));
    setFurthest((previous) => Math.max(previous, Math.min(current + 1, LAST)));
  };

  const advance = async () => {
    const current = step;
    setBusy(true);
    const payload: ProductDraft = { ...draft, content: cleanContent(draft.content) };
    setDraft(payload);

    if (creating) {
      if (current === LAST) {
        const created = await createProductFromDraft(payload);
        if (!created.ok) {
          setBusy(false);
          return fail(created.error, current);
        }
        onOpenChange(false);
        router.push(`/catalogo/productos/${encodeURIComponent(created.data.code)}`);
        return;
      }
      const result = await previewProductDraft(payload, current + 1);
      setBusy(false);
      if (!result.ok) return fail(result.error, current);
      if (result.data.review) setPreview(result.data.review);
      succeed(current);
      setStep(current + 1);
      return;
    }

    const section = SECTION_OF_STEP[current];
    if (section !== "rates" && saved) {
      const result = await saveProductSection(saved.code, saved.lock_version, section as ProductSection, payload);
      if (!result.ok) {
        setBusy(false);
        return fail(result.error, current);
      }
      setSaved(result.data);
      if (section === "components") set({ components: result.data.components });
      if (section === "itinerary") set({ itinerary: result.data.itinerary });
      setNotice("Cambios guardados");
    }
    setBusy(false);
    succeed(current);
    if (current === LAST) {
      onOpenChange(false);
      router.refresh();
      return;
    }
    setStep(current + 1);
  };

  const addRate = async (rate: ProductRateDraft): Promise<boolean> => {
    if (!saved) {
      set((current) => ({ rates: [...current.rates, rate] }));
      return true;
    }
    const result = await addProductRate(saved.code, rate);
    if (!result.ok) {
      fail(result.error, 5);
      return false;
    }
    setSaved(result.data);
    setErrors({});
    setFailure(null);
    setNotice("Tarifa agregada");
    return true;
  };

  const toggleRate = async (ref: string, active: boolean) => {
    if (!saved) return;
    const result = await setProductRateActive(saved.code, ref, active);
    if (!result.ok) return fail(result.error, 5);
    setSaved(result.data);
    setNotice(active ? "Tarifa activada" : "Tarifa desactivada");
  };

  const updateRate = async (rate: ProductRateDraft, reason: string | null): Promise<boolean> => {
    if (!saved) return false;
    const result = await updateProductRate(saved.code, rate, reason);
    if (!result.ok) {
      fail(result.error, 5);
      return false;
    }
    setSaved(result.data);
    setErrors({});
    setFailure(null);
    setNotice("Tarifa guardada");
    return true;
  };

  const removeRate = async (ref: string) => {
    if (!saved) return;
    const result = await removeProductRate(saved.code, ref);
    if (!result.ok) return fail(result.error, 5);
    setSaved(result.data);
    setNotice("Tarifa quitada");
  };

  const props = { draft, set, options, errors };
  const bodies: ReactNode[] = [
    <DefineStep key="1" {...props} creating={creating} />,
    <CategorizeStep key="2" {...props} />,
    <DestinationStep key="3" {...props} />,
    <ComponentsStep key="4" {...props} review={review} />,
    <ItineraryStep key="5" {...props} />,
    <RatesStep key="6" {...props} review={review} saved={saved ? saved.rates : null} onAdd={addRate} onToggle={toggleRate} onUpdate={updateRate} onRemove={removeRate} />,
    <SeasonsStep key="7" {...props} rates={rates} />,
    <AvailabilityStep key="8" {...props} />,
    <ContentStep key="9" {...props} />,
    <PublishStep key="10" {...props} review={review} creating={creating} onGo={setStep} />,
  ];

  const summaries = useMemo(() => PRODUCT_STEPS.map((_, index) => stepSummary(index, draft, options, rates)), [draft, options, rates]);
  const title = creating ? "Nuevo producto turístico" : `Editar ${saved?.master.name ?? "producto"}`;
  const finishLabel = creating ? "Crear producto en borrador" : "Guardar y terminar";

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      bodyId={BODY}
      title={title}
      description={creating ? "Se crea en borrador: editable y no comercializable hasta pasar revisión, aprobación y el checklist de activación." : `${saved?.code} · cada paso se guarda al pasar al siguiente.`}
      subheader={<StepIndicator steps={PRODUCT_STEPS} hints={summaries} current={step} done={(index) => done.has(index)} failed={(index) => failure?.step === index} reachable={(index) => index <= furthest && !busy} onSelect={setStep} />}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="ghost" icon={<ArrowLeft size={16} />} disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
          <span className="flex items-center gap-3">
            {notice && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ok motion-safe:animate-[rise-in_260ms_ease-out_backwards]">
                <Check size={14} strokeWidth={2.6} />
                {notice}
              </span>
            )}
            <Button type="button" variant="primary" data-testid={`wizard-next:${step + 1}`} disabled={busy} icon={busy ? <LoaderCircle size={16} className="animate-spin" /> : step === LAST ? <Check size={16} /> : undefined} onClick={advance}>
              {step === LAST ? (
                finishLabel
              ) : (
                <>
                  Siguiente
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </span>
        </div>
      }
    >
      <div key={step} data-testid={`wizard-body:${step + 1}`} className="motion-safe:animate-[rise-in_280ms_ease-out_backwards]">
        <header className="mb-5">
          <p className="text-[12.5px] font-semibold text-fg-3">
            Paso {step + 1} de {PRODUCT_STEPS.length}
          </p>
          <h3 className="text-[19px] font-bold tracking-tight">{PRODUCT_STEPS[step]}</h3>
        </header>
        {failure?.step === step && (
          <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/[0.07] px-3.5 py-3 text-[13px] text-bad">
            <CircleAlert size={16} className="mt-0.5 flex-none" />
            {failure.message}
          </div>
        )}
        {bodies[step]}
      </div>
    </SidePanel>
  );
}

interface ProductWizardActionProps {
  options: ProductFormOptions;
  initial?: ProductEditorState;
  defaultOpen?: boolean;
  trigger?: (open: (step?: number) => void) => ReactNode;
}

export function ProductWizardAction({ options, initial, defaultOpen = false, trigger }: ProductWizardActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [round, setRound] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const start = (step = 0) => {
    setStartAt(step);
    setRound((value) => value + 1);
    setOpen(true);
  };

  useEffect(() => {
    if (!defaultOpen) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("editar") && !params.has("nuevo")) return;
    params.delete("editar");
    params.delete("nuevo");
    router.replace(`${window.location.pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [defaultOpen, router]);

  return (
    <>
      {trigger ? (
        trigger(start)
      ) : initial ? (
        <Button type="button" icon={<Pencil size={16} />} onClick={() => start()} data-testid="btn-edit-product">
          Editar
        </Button>
      ) : (
        <Button type="button" variant="primary" icon={<Plus size={16} strokeWidth={2.4} />} onClick={() => start()} data-testid="btn-new-product">
          Nuevo producto
        </Button>
      )}
      <ProductWizard key={round} options={options} initial={initial} open={open} onOpenChange={setOpen} initialStep={startAt} />
    </>
  );
}

export function EditStepButton({ options, initial, step, label = "Editar" }: { options: ProductFormOptions; initial: ProductEditorState; step: number; label?: string }) {
  return (
    <ProductWizardAction
      options={options}
      initial={initial}
      trigger={(open) => (
        <Button type="button" size="sm" icon={<Pencil size={14} />} onClick={() => open(step)} data-testid={`btn-edit-step:${step + 1}`}>
          {label}
        </Button>
      )}
    />
  );
}
