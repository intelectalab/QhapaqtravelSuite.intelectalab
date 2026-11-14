"use client";

import { CircleCheck, CircleDashed, FileCheck2, KeyRound, Pencil, PlugZap, Plus, ReceiptText, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import { clearTenantOseCredentials, createFxProvider, createOseProvider, deleteFxProvider, deleteOseProvider, saveTenantOseCredentials, testPlatformFxProvider, testTenantOse, updateFxProvider, updateOseProvider } from "@/app/plataforma/(consola)/integraciones/finanzas-actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { OseProgress } from "@/features/finance/OseStatus";
import { cn } from "@/lib/cn";
import type { CredentialSlot, DriverOption, FxCatalogOverview, FxCatalogProvider, OseCatalogOverview, OseProvider, TenantOse } from "@/lib/financeProviders";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

const OSE_STATUS_OPTIONS = [
  { value: "por_homologar", label: "Por homologar" },
  { value: "homologado", label: "Homologado" },
];

function CredentialInputs({ fields, slots = [] }: { fields: { field: string; label: string }[]; slots?: CredentialSlot[] }) {
  if (fields.length === 0) return <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-3">Esta conexión no necesita credenciales.</p>;

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const slot = slots.find((item) => item.field === field.field);
        return <TextField key={field.field} label={field.label} name={`credential_${field.field}`} revealable autoComplete="off" placeholder={slot?.set ? `Guardada (${slot.hint ?? "••••"}): escribe para reemplazarla` : "Sin cargar"} />;
      })}
      <p className="text-[12px] text-fg-3">Se guardan cifradas y nunca se vuelven a mostrar. Deja en blanco las que no cambian.</p>
    </div>
  );
}

function CredentialChips({ slots }: { slots: CredentialSlot[] }) {
  if (slots.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Credenciales">
      {slots.map((slot) => (
        <li key={slot.field} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium", slot.set ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-fg" : "bg-surface-2 text-fg-3")}>
          {slot.set ? <KeyRound size={12} /> : <CircleDashed size={12} />}
          {slot.label}
          {slot.hint && <span className="font-mono text-fg-3">{slot.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

function TestLine({ at, ok, result }: { at: string | null; ok: boolean | null; result: string | null }) {
  if (!at) return <p className="text-[12px] text-fg-3">Sin pruebas de conexión.</p>;

  return (
    <p className={cn("rounded-[10px] px-3 py-2 text-[12.5px]", ok ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]")}>
      <b className="font-semibold">{ok ? "Prueba correcta" : "Prueba fallida"}</b> · {formatDateTime(at)}
      {result && <span className="block text-fg-2">{result}</span>}
    </p>
  );
}

function FxCreateFields({ drivers }: { drivers: DriverOption[] }) {
  const [driver, setDriver] = useState(drivers.find((item) => item.value !== "simulado")?.value ?? drivers[0]?.value ?? "");
  const selected = drivers.find((item) => item.value === driver);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
        <TextField label="Código" name="code" required maxLength={20} placeholder="BCRP-API" />
        <TextField label="Nombre" name="name" required maxLength={120} />
      </div>
      <SelectField label="Tipo de conexión" name="driver" options={drivers.map((item) => ({ value: item.value, label: item.label }))} value={driver} onChange={setDriver} />
      <CredentialInputs fields={selected?.fields ?? []} />
      <TextArea label="Nota" name="note" rows={2} maxLength={300} />
    </div>
  );
}

function FxProviderCard({ provider, drivers, index }: { provider: FxCatalogProvider; drivers: DriverOption[]; index: number }) {
  const tone: Tone = provider.status === "validado" ? "ok" : "warn";
  const fields = drivers.find((item) => item.value === provider.driver)?.fields ?? [];

  return (
    <ToneScope tone={tone}>
      <article className="lift flex h-full animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-card border border-[color-mix(in_srgb,var(--tint)_24%,transparent)] bg-surface p-4 shadow-card" style={{ animationDelay: `${index * 60}ms` }}>
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <b className="block text-[14px] font-semibold">{provider.name}</b>
            <span className="text-[12px] text-fg-3">
              <code>{provider.code}</code> · {provider.driver_label}
            </span>
          </div>
          <Badge tone={tone}>{provider.status_label}</Badge>
        </header>
        {provider.note && <p className="text-[12.5px] text-fg-2">{provider.note}</p>}
        <CredentialChips slots={provider.credentials} />
        <TestLine at={provider.last_test_at} ok={provider.last_test_ok} result={provider.last_test_result} />
        <footer className="mt-auto flex items-center justify-end gap-1">
          <ConsoleAction id={`fx-test-${provider.code}`} label="Probar conexión" icon={<PlugZap size={15} />} rowTone="neutral" title={`Probar ${provider.name}`} description="Si la prueba pasa, el proveedor queda validado y las agencias pueden elegirlo en Monedas. Queda en la auditoría." submitLabel="Probar" action={testPlatformFxProvider} fields={{ code: provider.code }} />
          <ConsoleAction id={`fx-edit-${provider.code}`} label="Editar" icon={<Pencil size={15} />} rowTone="edit" title={`Editar ${provider.name}`} description="Si cambias las credenciales, el proveedor vuelve a «por validar» hasta que lo pruebes." submitLabel="Guardar" action={updateFxProvider} fields={{ code: provider.code }}>
            <div className="flex flex-col gap-3">
              <TextField label="Nombre" name="name" required maxLength={120} defaultValue={provider.name} />
              <CredentialInputs fields={fields} slots={provider.credentials} />
              <TextArea label="Nota" name="note" rows={2} maxLength={300} defaultValue={provider.note ?? ""} />
            </div>
          </ConsoleAction>
          <ConsoleAction id={`fx-delete-${provider.code}`} label="Eliminar" icon={<Trash2 size={15} />} rowTone="delete" title={`Eliminar ${provider.name}`} description="Las agencias que lo usan dejarán de actualizar el tipo de cambio desde el proveedor y seguirán con la carga manual." submitLabel="Eliminar" action={deleteFxProvider} fields={{ code: provider.code }} />
        </footer>
      </article>
    </ToneScope>
  );
}

export function FxCatalogBoard({ data }: { data: FxCatalogOverview }) {
  return (
    <section aria-label="Proveedores de tipo de cambio" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[680px] text-[13px] text-fg-2">
          {data.counts.validated} de {data.counts.total} validados. Las agencias eligen en Monedas solo entre los validados; los demás se les muestran deshabilitados.
          {data.simulated && " Las conexiones responden con valores de prueba mientras no haya adaptadores reales."}
        </p>
        <ConsoleAction id="fx-create" label="Nuevo proveedor" icon={<Plus size={16} />} variant="primary" title="Nuevo proveedor de tipo de cambio" description="Queda por validar hasta que una prueba de conexión pase." submitLabel="Crear" action={createFxProvider}>
          <FxCreateFields drivers={data.drivers} />
        </ConsoleAction>
      </div>
      {data.providers.length === 0 ? (
        <EmptyState icon={<PlugZap size={20} />} title="Sin proveedores" description="Agrega el primer proveedor de tipo de cambio." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.providers.map((provider, index) => (
            <FxProviderCard key={provider.code} provider={provider} drivers={data.drivers} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

function OseProviderCard({ provider, index }: { provider: OseProvider; index: number }) {
  const tone: Tone = provider.status === "homologado" ? "ok" : "warn";

  return (
    <ToneScope tone={tone}>
      <article className="lift flex h-full animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-card border border-[color-mix(in_srgb,var(--tint)_24%,transparent)] bg-surface p-4 shadow-card" style={{ animationDelay: `${index * 60}ms` }}>
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <b className="block text-[14px] font-semibold">{provider.name}</b>
            <span className="text-[12px] text-fg-3">
              <code>{provider.code}</code> · {provider.driver_label}
            </span>
          </div>
          <Badge tone={tone}>{provider.status_label}</Badge>
        </header>
        <dl className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-3 py-2">
            <dt className="text-fg-3">Agencias que lo eligieron</dt>
            <dd className="text-[18px] font-bold">{provider.tenants ?? 0}</dd>
          </div>
          <div className="rounded-[10px] bg-surface-2 px-3 py-2">
            <dt className="text-fg-3">Credenciales por agencia</dt>
            <dd className="font-medium">{provider.fields.length ? provider.fields.map((field) => field.label).join(", ") : "No necesita"}</dd>
          </div>
        </dl>
        {provider.note && <p className="text-[12.5px] text-fg-2">{provider.note}</p>}
        {provider.homologated_at && <p className="text-[12px] text-fg-3">Homologado el {formatDateTime(provider.homologated_at)}</p>}
        <footer className="mt-auto flex items-center justify-end gap-1">
          <ConsoleAction id={`ose-edit-${provider.code}`} label="Editar" icon={<Pencil size={15} />} rowTone="edit" title={`Editar ${provider.name}`} description="Solo los OSE homologados aparecen para que las agencias los elijan." submitLabel="Guardar" action={updateOseProvider} fields={{ code: provider.code }}>
            <div className="flex flex-col gap-3">
              <TextField label="Nombre" name="name" required maxLength={120} defaultValue={provider.name} />
              <ChoiceGroup label="Estado" name="status" options={OSE_STATUS_OPTIONS} defaultValue={provider.status} />
              <TextArea label="Nota" name="note" rows={2} maxLength={300} defaultValue={provider.note ?? ""} />
            </div>
          </ConsoleAction>
          <ConsoleAction id={`ose-delete-${provider.code}`} label="Eliminar" icon={<Trash2 size={15} />} rowTone="delete" title={`Eliminar ${provider.name}`} description="Solo se elimina si ninguna agencia lo tiene elegido." submitLabel="Eliminar" action={deleteOseProvider} fields={{ code: provider.code }} />
        </footer>
      </article>
    </ToneScope>
  );
}

export function OseCatalogBoard({ data }: { data: OseCatalogOverview }) {
  return (
    <section aria-label="Catálogo de OSE" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[680px] text-[13px] text-fg-2">
          {data.counts.homologated} de {data.counts.total} homologados · {data.counts.tenants} agencias con OSE elegido. Las credenciales de cada agencia se cargan en su ficha.
          {data.simulated && " La emisión sigue simulada hasta publicar el adaptador real de cada OSE."}
        </p>
        <ConsoleAction id="ose-create" label="Agregar OSE" icon={<Plus size={16} />} variant="primary" title="Agregar OSE al catálogo" description="Márcalo como homologado cuando termine la homologación con SUNAT." submitLabel="Agregar" action={createOseProvider}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
              <TextField label="Código" name="code" required maxLength={20} placeholder="OSE-01" />
              <TextField label="Nombre" name="name" required maxLength={120} />
            </div>
            <SelectField label="Tipo de conexión" name="driver" options={data.drivers.map((item) => ({ value: item.value, label: item.label }))} defaultValue={data.drivers[1]?.value ?? data.drivers[0]?.value} />
            <ChoiceGroup label="Estado" name="status" options={OSE_STATUS_OPTIONS} defaultValue="por_homologar" />
            <TextArea label="Nota" name="note" rows={2} maxLength={300} />
          </div>
        </ConsoleAction>
      </div>
      {data.providers.length === 0 ? (
        <EmptyState icon={<ReceiptText size={20} />} title="Aún no hay OSE en el catálogo" description="Agrega el OSE con el que KipuControl se homologa. Mientras no haya uno homologado, las agencias emiten en modo simulado." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.providers.map((provider, index) => (
            <OseProviderCard key={provider.code} provider={provider} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

export function TenantOseCard({ data }: { data: TenantOse }) {
  const fields = data.provider?.fields ?? [];
  const hasKeys = data.credentials.some((slot) => slot.set);

  return (
    <Card className="mt-5">
      <TintCardTitle icon={ReceiptText} title="Facturación electrónica" aside={data.provider ? data.provider.name : "Sin OSE elegido"} />
      <div className="flex flex-col gap-3">
        <p className={cn("flex items-start gap-2 rounded-[11px] px-3 py-2.5 text-[13px]", data.mode === "conectado" ? "bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]" : "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]")}>
          {data.ready ? <FileCheck2 size={16} className="mt-0.5 flex-none text-ok" /> : <CircleCheck size={16} className="mt-0.5 flex-none text-warn" />}
          {data.message}
        </p>
        <OseProgress status={data} />
        <CredentialChips slots={data.credentials} />
        {data.provider && fields.length > 0 && <TestLine at={data.last_test_at} ok={data.last_test_ok} result={data.last_test_result} />}
        {data.provider && fields.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {hasKeys && <ConsoleAction id="tenant-ose-clear" label="Quitar credenciales" icon={<Unplug size={15} />} size="sm" variant="ghost" title="Quitar credenciales" description={`${data.tenant.name} volverá a emitir en modo simulado hasta que se carguen de nuevo.`} submitLabel="Quitar" action={clearTenantOseCredentials} fields={{ tenant: data.tenant.code }} />}
            {data.credentials_complete && <ConsoleAction id="tenant-ose-test" label="Probar conexión" icon={<PlugZap size={15} />} size="sm" title={`Probar ${data.provider.name}`} description="Se prueba con las credenciales guardadas. El resultado queda en la auditoría." submitLabel="Probar" action={testTenantOse} fields={{ tenant: data.tenant.code }} />}
            <ConsoleAction id="tenant-ose-keys" label={hasKeys ? "Cambiar credenciales" : "Cargar credenciales"} icon={<KeyRound size={15} />} size="sm" variant="primary" title={`Credenciales de ${data.provider.name}`} description={`Credenciales de ${data.tenant.name} (RUC ${data.tenant.ruc}) ante ${data.provider.name}.`} submitLabel="Guardar" action={saveTenantOseCredentials} fields={{ tenant: data.tenant.code }}>
              <CredentialInputs fields={fields} slots={data.credentials} />
            </ConsoleAction>
          </div>
        )}
      </div>
    </Card>
  );
}
