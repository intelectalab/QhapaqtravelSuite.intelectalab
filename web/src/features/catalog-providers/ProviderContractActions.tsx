"use client";

import { CalendarClock, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { rateProvider, renewProviderContract } from "@/app/(backoffice)/catalogo/proveedores/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { ProviderRow } from "@/lib/catalog-providers";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

export function ProviderRenewAction({ provider, today }: { provider: ProviderRow; today: string }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Renovar contrato"
      icon={<CalendarClock size={16} />}
      variant="primary"
      formId={`provider-renew-${provider.ref}`}
      title="Renovar contrato"
      description={provider.contract_days < 0 ? `${provider.name} · venció el ${formatDate(provider.contract_end)}. Al renovarlo vuelve a inactivo y podrás activarlo.` : `${provider.name} · vigente hasta el ${formatDate(provider.contract_end)}.`}
      submitLabel="Renovar"
      action={renewProviderContract}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: provider.ref }} />
          <TextField label="Nuevo fin del contrato" name="contract_end" type="date" required min={provider.contract_end > today ? provider.contract_end : today} />
          <TextField label="Condiciones de pago" name="payment_terms" maxLength={120} defaultValue={provider.payment_terms ?? undefined} placeholder="Por ejemplo: crédito 30 días" hint="Déjalas como están si no cambian." />
        </>
      )}
    </PanelAction>
  );
}

export function ProviderRateAction({ provider }: { provider: ProviderRow }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Calificar"
      icon={<Star size={16} />}
      formId={`provider-rate-${provider.ref}`}
      title="Calificar proveedor"
      description={provider.rating ? `${provider.name} · hoy tiene ${provider.rating.toFixed(1)} de 5.` : `${provider.name} · aún no tiene calificación.`}
      submitLabel="Guardar calificación"
      action={rateProvider}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: provider.ref }} />
          <ChoiceGroup label="Calificación" name="rating" defaultValue={String(Math.round(provider.rating) || 4)} options={["1", "2", "3", "4", "5"].map((value) => ({ value, label: `${value} ${value === "1" ? "estrella" : "estrellas"}` }))} />
          <TextArea label="Comentario" name="note" rows={3} maxLength={500} defaultValue={provider.rating_note ?? undefined} placeholder="Por ejemplo: puntual y con buena comunicación en temporada alta." />
        </>
      )}
    </PanelAction>
  );
}
