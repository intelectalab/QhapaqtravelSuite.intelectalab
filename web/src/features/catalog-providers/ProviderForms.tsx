"use client";

import { Building2, CirclePlay, CircleStop, Pencil, Plus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { addProviderContact, createProvider, removeProviderContact, toggleProvider, updateProvider } from "@/app/(backoffice)/catalogo/proveedores/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { ProviderContact, ProviderRow, ProvidersOverview } from "@/lib/catalog-providers";
import type { StepResult } from "@/lib/server/resource";

const list = (values: string[]) => values.map((value) => ({ value, label: value }));

type ProviderFormContext = Pick<ProvidersOverview, "options" | "today">;

function ProviderFields({ overview, provider }: { overview: ProviderFormContext; provider?: ProviderRow }) {
  return (
    <>
      <PanelSection title="Empresa">
        <TextField label="Razón social" name="name" required minLength={3} maxLength={160} defaultValue={provider?.name} icon={<Building2 size={16} />} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="RUC" name="ruc" required inputMode="numeric" pattern="(10|15|17|20)[0-9]{9}" maxLength={11} defaultValue={provider?.ruc} placeholder="20XXXXXXXXX" />
          <SelectField label="Tipo" name="type" options={list(overview.options.types)} defaultValue={provider?.type ?? "Hotel"} />
          <TextField label="Ciudad" name="city" maxLength={80} defaultValue={provider?.city ?? undefined} />
          <TextField label="Estrellas" name="stars" type="number" min={0} max={5} defaultValue={provider?.stars ?? undefined} hint="Solo hoteles." />
        </div>
      </PanelSection>
      <PanelSection title="Contacto principal">
        <TextField label="Nombre" name="contact_name" required minLength={3} maxLength={120} defaultValue={provider?.contact_name} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Teléfono" name="phone" maxLength={40} defaultValue={provider?.phone ?? undefined} />
          <TextField label="Correo" name="email" type="email" maxLength={160} defaultValue={provider?.email ?? undefined} />
        </div>
      </PanelSection>
      <PanelSection title="Contrato">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Inicio" name="contract_start" type="date" required defaultValue={provider?.contract_start ?? overview.today} />
          <TextField label="Fin" name="contract_end" type="date" required defaultValue={provider?.contract_end} />
        </div>
        <ChoiceGroup label="Moneda" name="currency" options={list(overview.options.currencies)} defaultValue={provider?.currency ?? "PEN"} />
        <TextField label="Condiciones de pago" name="payment_terms" maxLength={120} defaultValue={provider?.payment_terms ?? undefined} placeholder="Por ejemplo: crédito 15 días" />
        {provider && (
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <TextField label="Calificación" name="rating" type="number" step="0.1" min={1} max={5} defaultValue={provider.rating || undefined} />
            <TextArea label="Nota de calificación" name="rating_note" rows={1} maxLength={500} defaultValue={provider.rating_note ?? undefined} />
          </div>
        )}
      </PanelSection>
    </>
  );
}

export function ProviderCreateAction({ overview }: { overview: ProvidersOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nuevo proveedor"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="provider-create"
      title="Nuevo proveedor"
      description="Nace inactivo. Actívalo cuando el contrato esté vigente."
      submitLabel="Crear proveedor"
      action={createProvider}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <ProviderFields overview={overview} />}
    </PanelAction>
  );
}

export function ProviderEditAction({ overview, provider, button = false }: { overview: ProviderFormContext; provider: ProviderRow; button?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`provider-edit-${provider.ref}`}
      icon={<Pencil size={15} />}
      trigger={button ? undefined : (open) => <RowIcon tone="edit" label="Editar" onClick={open} />}
      title="Editar proveedor"
      description={provider.state === "vencido" ? `${provider.ref} · contrato vencido: si extiendes la fecha de fin, vuelve a inactivo y podrás activarlo.` : provider.ref}
      submitLabel="Guardar cambios"
      action={updateProvider}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: provider.ref }} />
          <ProviderFields overview={overview} provider={provider} />
        </>
      )}
    </PanelAction>
  );
}

export function ProviderToggleAction({ provider, button = false }: { provider: ProviderRow; button?: boolean }) {
  const activate = provider.status !== "activo";
  if (activate && provider.contract_days < 0 && button) return null;
  if (activate && provider.contract_days < 0) return <RowIcon tone="neutral" label="Activar" icon={<CirclePlay size={16} />} disabledHint="Contrato vencido: extiéndelo para activarlo" />;
  return (
    <ConfirmAction
      id={`provider-${provider.ref}`}
      label={activate ? "Activar" : "Desactivar"}
      tone={activate ? "neutral" : "delete"}
      icon={activate ? <CirclePlay size={16} /> : <CircleStop size={16} />}
      title={activate ? "Activar proveedor" : "Desactivar proveedor"}
      description={
        activate
          ? `${provider.name} queda disponible para servicios, productos y salidas.`
          : provider.products.length
            ? `${provider.name} es proveedor principal de ${provider.products.length} productos. Sus servicios dejan de poder usarse.`
            : `${provider.name} deja de estar disponible para servicios y salidas.`
      }
      submitLabel={activate ? "Activar" : "Desactivar"}
      action={toggleProvider}
      hidden={{ ref: provider.ref, action: activate ? "activate" : "deactivate" }}
      reason={activate ? undefined : "Por ejemplo: incumplimiento de servicio."}
      button={button}
    />
  );
}

function useStep(action: (state: StepResult, form: FormData) => Promise<StepResult>) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(action, STEP_INITIAL);
  useEffect(() => {
    if (!state.done) return;
    formRef.current?.reset();
    router.refresh();
  }, [state, router]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => run(form));
  };
  return { state, submit, pending, formRef };
}

function ContactItem({ provider, contact, manage }: { provider: ProviderRow; contact: ProviderContact; manage: boolean }) {
  const { submit, pending } = useStep(removeProviderContact);
  return (
    <li className="group flex items-start justify-between gap-3 rounded-xl border border-line-2 px-3.5 py-2.5 transition hover:border-line hover:bg-surface-2">
      <span className="min-w-0 text-[13px]">
        <b className="block font-semibold">{contact.name}</b>
        <span className="block text-fg-3">{[contact.role, contact.phone, contact.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
      </span>
      {manage && (
        <form onSubmit={submit}>
          <HiddenFields values={{ ref: provider.ref, contact: contact.id }} />
          <button type="submit" disabled={pending} aria-label={`Quitar a ${contact.name}`} title="Quitar contacto" className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 opacity-0 transition hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] hover:text-bad group-hover:opacity-100 focus:opacity-100">
            <X size={15} />
          </button>
        </form>
      )}
    </li>
  );
}

export function ProviderContacts({ provider, manage }: { provider: ProviderRow; manage: boolean }) {
  const { state, submit, pending, formRef } = useStep(addProviderContact);
  return (
    <PanelSection title={`Contactos (${provider.contacts.length})`}>
      <ul className="flex flex-col gap-2">
        {provider.contacts.map((contact) => (
          <ContactItem key={contact.id} provider={provider} contact={contact} manage={manage} />
        ))}
      </ul>
      {manage && (
        <form ref={formRef} onSubmit={submit} className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5">
          <HiddenFields values={{ ref: provider.ref }} />
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label="Nombre" name="name" required minLength={3} maxLength={120} />
            <TextField label="Cargo" name="role" maxLength={80} />
            <TextField label="Teléfono" name="phone" maxLength={40} />
            <TextField label="Correo" name="email" type="email" maxLength={160} />
          </div>
          {state.message && !state.done && <p className="text-[12.5px] text-bad">{state.message}</p>}
          <Button type="submit" size="sm" variant="secondary" icon={<UserPlus size={15} />} disabled={pending} className="self-end">
            {pending ? "Un momento…" : "Agregar contacto"}
          </Button>
        </form>
      )}
    </PanelSection>
  );
}
