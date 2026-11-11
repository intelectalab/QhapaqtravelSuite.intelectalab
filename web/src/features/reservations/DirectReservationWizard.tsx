"use client";

import { Check, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { checkDirectAvailability, checkDirectStep, createDirectReservation } from "@/app/(backoffice)/reservas/actions";
import { Button } from "@/components/ui/Button";
import { useOpenFromQuery, useWizard, WizardPanel } from "@/components/ui/WizardPanel";
import { formatDate, formatMoney } from "@/lib/format";
import { DIRECT_STEPS, type DirectFormOptions, type DirectPayload, type DirectPlan } from "@/lib/reservations";
import { ClientStep, SummaryStep, TripStep } from "./DirectReservationSteps";

const BODY = "direct-reservation-body";

interface DirectReservationWizardProps {
  options: DirectFormOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DirectReservationWizard({ options, open, onOpenChange }: DirectReservationWizardProps) {
  const router = useRouter();
  const wizard = useWizard(DIRECT_STEPS.length, false);
  const { step, errors, busy, setBusy, fail, pass } = wizard;
  const [form, setForm] = useState<DirectPayload>({ client_id: "", product_id: "", channel: "", owner_id: options.owner_id, departure_id: "", date: "", adt: 2, chd: 0, inf: 0, notes: "" });
  const [plan, setPlan] = useState<DirectPlan | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const live = step >= 1 && form.product_id !== "";

  const set = (patch: Partial<DirectPayload>) => {
    if ("product_id" in patch) {
      setPlan(null);
      setCheckError(null);
    }
    setForm((current) => ({ ...current, ...patch }));
  };

  useEffect(() => {
    if (!live) return;
    let active = true;
    const timer = setTimeout(async () => {
      setChecking(true);
      const result = await checkDirectAvailability(form);
      if (!active) return;
      setChecking(false);
      setPlan(result.plan);
      setCheckError(result.message);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form, live]);

  const next = async () => {
    setBusy(true);
    const result = await checkDirectStep(form, step + 1);
    setBusy(false);
    if (!result.ok) return fail(result.error);
    if (result.data) {
      setPlan(result.data);
      setCheckError(null);
    }
    pass();
  };

  const create = async (confirm: boolean) => {
    setBusy(true);
    const result = await createDirectReservation(form, confirm);
    if (!result.ok) {
      setBusy(false);
      return fail(result.error);
    }
    onOpenChange(false);
    router.push(`/reservas/${encodeURIComponent(result.data.code)}`);
  };

  const product = options.products.find((item) => item.code === form.product_id);
  const client = options.clients.find((item) => item.code === form.client_id);
  const priced = plan?.priced && !checkError ? plan : null;
  const hints = useMemo(
    () => [
      [client?.name, form.channel].filter(Boolean).join(" · ") || "Cliente, canal y responsable.",
      [product?.name, priced?.date ? formatDate(priced.date) : null].filter(Boolean).join(" · ") || "Producto, salida o fecha y pasajeros.",
      priced ? `${priced.available ? "Con cupo" : "Sin cupo suficiente"} · ${formatMoney(priced.total ?? 0, priced.currency)}` : "Disponibilidad, precio y confirmación.",
    ],
    [client, product, form.channel, priced],
  );

  const props = { form, set, options, errors };
  const planProps = { plan, checkError, checking };
  const bodies: ReactNode[] = [<ClientStep key="1" {...props} />, <TripStep key="2" {...props} {...planProps} />, <SummaryStep key="3" {...props} {...planProps} />];
  const spinner = <LoaderCircle size={16} className="animate-spin" />;

  return (
    <WizardPanel
      wizard={wizard}
      steps={DIRECT_STEPS}
      hints={hints}
      open={open}
      onOpenChange={onOpenChange}
      bodyId={BODY}
      title="Nueva reserva directa"
      description="Venta sin cotización. El precio sale de la tarifa vigente del canal y la disponibilidad de la salida."
      onNext={next}
      finish={
        <>
          <Button type="button" variant="secondary" disabled={busy || !priced} onClick={() => create(false)} data-testid="direct-save-draft">
            Guardar borrador
          </Button>
          <Button type="button" variant="primary" disabled={busy || !priced?.available} icon={busy ? spinner : <Check size={16} />} onClick={() => create(true)} data-testid="direct-confirm">
            Crear y confirmar
          </Button>
        </>
      }
    >
      {bodies[step]}
    </WizardPanel>
  );
}

export function DirectReservationWizardAction({ options, defaultOpen = false }: { options: DirectFormOptions; defaultOpen?: boolean }) {
  const { open, setOpen, round, start } = useOpenFromQuery(defaultOpen, ["nueva"]);

  return (
    <>
      <Button type="button" variant="primary" icon={<Plus size={16} strokeWidth={2.4} />} onClick={start} data-testid="reservation-new">
        Nueva reserva
      </Button>
      <DirectReservationWizard key={round} options={options} open={open} onOpenChange={setOpen} />
    </>
  );
}
