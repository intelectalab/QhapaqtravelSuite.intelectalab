"use client";

import { Building2, CalendarClock, Coins, Hash, Mail, MapPin, Pencil, Phone, Plus, Radio, ScrollText, Settings2, Timer, Wrench } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { createSequence, updateSequence, updateSettings } from "@/app/(backoffice)/admin/configuracion/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { ADMIN_INITIAL, type AdminActionState, type SettingsOverview, type SettingsSequence } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { RISE, ToggleField, Warnings } from "./AdminParts";

const OPERATIONS: { key: string; label: string; unit: string; hint: string }[] = [
  { key: "voucher_hours_before", label: "Envío de vouchers", unit: "h antes", hint: "Cuántas horas antes del servicio se envía el voucher." },
  { key: "assign_expiry_min", label: "Vence una asignación sin confirmar", unit: "min", hint: "Tiempo que tiene un guía o conductor para aceptar." },
  { key: "checkin_tolerance_min", label: "Tolerancia de check-in", unit: "min", hint: "Margen para considerar puntual un recojo." },
  { key: "modify_min_hours", label: "Cambios hasta", unit: "h antes", hint: "Plazo mínimo para modificar un servicio." },
  { key: "max_pax_per_guide", label: "Pasajeros por guía", unit: "pax", hint: "Entre 1 y 40." },
  { key: "offline_sync_min", label: "Sincronización sin conexión", unit: "min", hint: "Cada cuánto sincroniza la app de campo." },
  { key: "pay_reminder_days", label: "Recordatorio de pago", unit: "días antes", hint: "Aviso al cliente antes del vencimiento." },
  { key: "trip_notice_hours", label: "Aviso de viaje próximo", unit: "h antes", hint: "Correo al cliente antes del inicio." },
  { key: "incident_escalate_min", label: "Escalar incidencia", unit: "min", hint: "Sin respuesta, se avisa a gerencia." },
];

export function SectionCard({ icon, title, tone, updated, children, action, index }: { icon: typeof Building2; title: string; tone: Tone; updated?: string | null; children: ReactNode; action?: ReactNode; index: number }) {
  return (
    <div style={{ animationDelay: `${index * 60}ms` }} className={RISE}>
      <Card className="lift h-full">
        <TintCardTitle icon={icon} title={title} tone={tone} aside={action} />
        {children}
        {updated && <p className="mt-3 text-[11.5px] text-fg-3">Actualizado el {formatDateTime(updated)}</p>}
      </Card>
    </div>
  );
}

export function EditSection({ section, version, title, description, children, action = updateSettings }: { section: string; version: number; title: string; description: string; children: ReactNode; action?: (state: AdminActionState, form: FormData) => Promise<AdminActionState> }) {
  const [warnings, setWarnings] = useState<string[]>([]);
  return (
    <>
      <PanelAction<AdminActionState>
        label="Editar"
        variant="ghost"
        size="sm"
        formId={`settings-${section}`}
        trigger={(open) => <RowIcon tone="edit" label={`Editar ${title.toLowerCase()}`} onClick={open} />}
        title={title}
        description={description}
        submitLabel="Guardar cambios"
        action={action}
        initial={ADMIN_INITIAL}
        onDone={(state) => setWarnings(state.warnings ?? [])}
      >
        {() => (
          <>
            <input type="hidden" name="section" value={section} />
            <input type="hidden" name="lock_version" value={version} />
            {children}
          </>
        )}
      </PanelAction>
      {warnings.length > 0 && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm" onClick={() => setWarnings([])}>
          <Warnings items={warnings} />
        </div>
      )}
    </>
  );
}

const numberField = (name: string, label: string, value: number | undefined, min: number, max: number, hint?: string) => <TextField label={label} name={name} type="number" inputMode="numeric" min={min} max={max} required defaultValue={value} hint={hint} />;

export type SettingsView = "agencia" | "moneda" | "politicas" | "operacion" | "canales";

export function SettingsSections({ data, show }: { data: SettingsOverview; show: SettingsView }) {
  const { agency, sections, options, can_manage: manage } = data;
  const general = sections.general.values;
  const currency = sections.currency.values;
  const policies = sections.policies.values;
  const ops = sections.operations.values;
  const label = (list: { value: string; label: string }[], value?: string) => list.find((item) => item.value === value)?.label ?? value ?? "—";

  return (
    <div className={cn("grid items-start gap-5", show === "agencia" && "xl:grid-cols-2")}>
      {show === "agencia" && (
      <SectionCard
        index={0}
        icon={Building2}
        tone="t1"
        title="Datos de la agencia"
        action={
          manage && (
            <EditSection section="agency" version={agency.lock_version} title="Datos de la agencia" description="La razón social, el RUC y el país solo los cambia la plataforma, porque requieren validación.">
              <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                <TextField label="Nombre comercial" name="commercial_name" required defaultValue={agency.commercial_name} />
                <TextField label="Iniciales" name="logo_initials" required maxLength={3} defaultValue={agency.logo_initials} hint="Hasta 3 letras" />
              </div>
              <TextField label="Domicilio fiscal" name="fiscal_address" required defaultValue={agency.fiscal_address} icon={<MapPin size={17} />} />
              <TextField label="Representante legal" name="legal_rep" defaultValue={agency.legal_rep ?? undefined} />
              <SelectField label="Zona horaria" name="timezone" options={options.timezones.map((value) => ({ value, label: value.replace("America/", "").replace("_", " ") }))} defaultValue={agency.timezone} />
            </EditSection>
          )
        }
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand text-[16px] font-bold text-brand-fg shadow-[0_10px_20px_-12px_var(--brand)]">{agency.logo_initials}</span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{agency.commercial_name}</p>
            <p className="truncate text-[12.5px] text-fg-3">{agency.legal_name}</p>
          </div>
        </div>
        <FieldList
          fields={[
            { label: "RUC", value: <span className="font-mono">{agency.ruc}</span> },
            { label: "Domicilio fiscal", value: agency.fiscal_address },
            { label: "Representante", value: agency.legal_rep ?? "—" },
            { label: "Zona horaria", value: `${agency.timezone} · ${agency.country}` },
          ]}
        />
      </SectionCard>
      )}

      {show === "agencia" && (
      <SectionCard
        index={1}
        icon={Mail}
        tone="t4"
        title="Contacto y preferencias"
        updated={sections.general.updated_at}
        action={
          manage && (
            <EditSection section="general" version={sections.general.lock_version} title="Contacto y preferencias" description="Aparecen en cotizaciones, vouchers y correos a clientes.">
              <TextField label="Correo de la agencia" name="email" type="email" required defaultValue={general.email} icon={<Mail size={17} />} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Teléfono" name="phone" defaultValue={general.phone} icon={<Phone size={17} />} />
                <TextField label="Sitio web" name="web" defaultValue={general.web} />
              </div>
              <TextField label="Dirección de atención" name="address" required defaultValue={general.address} icon={<MapPin size={17} />} />
              <TextField label="Registro MINCETUR" name="mincetur_registry" defaultValue={general.mincetur_registry} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Idioma" name="lang" options={options.langs} defaultValue={general.lang} />
                <SelectField label="Formato de fecha" name="date_format" options={options.date_formats.map((item) => ({ value: item.value, label: `${item.value} · ${item.label}` }))} defaultValue={general.date_format} />
              </div>
              <SelectField label="Sede principal" name="main_sede_id" options={options.sedes} defaultValue={general.main_sede_id} />
            </EditSection>
          )
        }
      >
        <FieldList
          fields={[
            { label: "Correo", value: general.email ?? "—" },
            { label: "Teléfono", value: general.phone ?? "—" },
            { label: "Web", value: general.web ?? "—" },
            { label: "Sede principal", value: data.main_sede ?? "Sin definir" },
            { label: "Idioma y fecha", value: `${label(options.langs, general.lang)} · ${general.date_format ?? "—"}` },
            { label: "MINCETUR", value: general.mincetur_registry ?? "—" },
          ]}
        />
      </SectionCard>
      )}

      {show === "moneda" && (
      <SectionCard
        index={2}
        icon={Coins}
        tone="sun"
        title="Moneda e impuestos"
        updated={sections.currency.updated_at}
        action={
          manage && (
            <EditSection section="currency" version={sections.currency.lock_version} title="Moneda e impuestos" description="Los cambios aplican a documentos nuevos. Los ya emitidos conservan sus valores.">
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Moneda base" name="base_currency" options={[{ value: "PEN", label: "Soles (PEN)" }, { value: "USD", label: "Dólares (USD)" }]} defaultValue={currency.base_currency} hint={data.base_locked ? "Bloqueada: ya hay reservas o pagos." : undefined} />
                <SelectField label="Moneda alterna" name="alt_currency" options={options.alt_currencies} defaultValue={currency.alt_currency} />
              </div>
              {numberField("tax_pct", "IGV (%)", currency.tax_pct, 0, 30)}
              <ToggleField label="Precios con IGV incluido" name="price_with_tax" defaultChecked={Boolean(currency.price_with_tax)} hint="Si está apagado, el IGV se suma al final." />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Redondeo" name="rounding" options={options.rounding} defaultValue={currency.rounding} />
                <SelectField label="Cómo redondear" name="round_mode" options={options.round_modes} defaultValue={currency.round_mode} />
              </div>
              <SelectField label="Fuente del tipo de cambio" name="fx_source" options={options.fx_sources.map((value) => ({ value, label: value }))} defaultValue={currency.fx_source} />
            </EditSection>
          )
        }
      >
        <FieldList
          fields={[
            { label: "Monedas", value: `${currency.base_currency ?? "PEN"} base · ${currency.alt_currency ?? "USD"} alterna` },
            { label: "IGV", value: `${currency.tax_pct ?? 18} % · ${currency.price_with_tax ? "incluido en precios" : "se suma al final"}` },
            { label: "Redondeo", value: `${label(options.rounding, currency.rounding)} · ${label(options.round_modes, currency.round_mode).toLowerCase()}` },
            {
              label: "Tipo de cambio",
              value: data.fx ? (
                <Link href="/admin/monedas" className="hover:text-accent hover:underline">
                  S/ {data.fx.rate.toFixed(3)} al {formatDate(data.fx.date)}
                </Link>
              ) : (
                "Sin registrar"
              ),
            },
          ]}
        />
      </SectionCard>
      )}

      {show === "politicas" && (
      <SectionCard
        index={3}
        icon={ScrollText}
        tone="t3"
        title="Políticas comerciales"
        updated={sections.policies.updated_at}
        action={
          manage && (
            <EditSection section="policies" version={sections.policies.lock_version} title="Políticas comerciales" description="Se copian a cada cotización nueva; las ya enviadas conservan las suyas.">
              <div className="grid grid-cols-2 gap-3">
                {numberField("quote_validity_days", "Validez de cotización (días)", policies.quote_validity_days, 1, 60, "De 1 a 60 días")}
                {numberField("hold_minutes", "Retención de cupos (min)", policies.hold_minutes, 5, 1440, "De 5 a 1 440 min")}
                {numberField("markup_pct", "Margen sugerido (%)", policies.markup_pct, 0, 300)}
                {numberField("max_discount_pct", "Descuento sin aprobación (%)", policies.max_discount_pct, 0, 30, "Más que esto pide aprobación de Gerencia")}
                {numberField("approval_margin_pct", "Margen mínimo sin aprobación (%)", policies.approval_margin_pct, 0, 80, "Menos que esto pide aprobación de Gerencia")}
                {numberField("discount_cap_pct", "Tope de descuento (%)", policies.discount_cap_pct, 0, 50, "Ni con aprobación se supera")}
                {numberField("advance_pct", "Anticipo (%)", policies.advance_pct, 0, 100, "Se cobra al convertir una cotización o confirmar una reserva. La web usa la regla de adelanto de cada producto")}
                {numberField("balance_days_before", "Saldo vence (días antes)", policies.balance_days_before, 0, 365, "Días antes del inicio del viaje")}
              </div>
              <TextArea label="Política de cancelación" name="cancel_text" rows={3} required defaultValue={policies.cancel_text} />
              <TextArea label="Cambios" name="modify_text" rows={2} defaultValue={policies.modify_text} />
              <TextArea label="No presentarse" name="noshow_text" rows={2} defaultValue={policies.noshow_text} />
              <TextArea label="Reembolsos" name="refund_text" rows={2} defaultValue={policies.refund_text} />
            </EditSection>
          )
        }
      >
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { label: "Validez", value: `${policies.quote_validity_days ?? "—"} días`, icon: CalendarClock },
            { label: "Retención", value: `${policies.hold_minutes ?? "—"} min`, icon: Timer },
            { label: "Descuento sin aprobación", value: `${policies.max_discount_pct ?? "—"} %`, icon: Hash },
          ].map((item) => (
            <span key={item.label} className="group rounded-[12px] bg-[color-mix(in_srgb,var(--t3)_8%,var(--surface))] px-3 py-2 transition-transform duration-300 hover:-translate-y-0.5">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-t3">
                <item.icon size={13} className="transition-transform duration-300 group-hover:-rotate-12" />
                {item.label}
              </span>
              <b className="text-[16px]">{item.value}</b>
            </span>
          ))}
        </div>
        <FieldList
          fields={[
            { label: "Aprobación interna", value: `También si el margen baja de ${policies.approval_margin_pct ?? 15} % · tope de descuento ${policies.discount_cap_pct ?? 10} %` },
            { label: "Margen y anticipo", value: `${policies.markup_pct ?? "—"} % de margen · ${policies.advance_pct ?? "—"} % de anticipo` },
            { label: "Saldo", value: `Vence ${policies.balance_days_before ?? "—"} días antes del viaje` },
            {
              label: "Cancelación",
              value: (
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{policies.cancel_text}</span>
                  <InfoTip label="Políticas completas">
                    <span className="flex flex-col gap-2 text-left">
                      {[policies.cancel_text, policies.modify_text, policies.noshow_text, policies.refund_text].filter(Boolean).map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </span>
                  </InfoTip>
                </span>
              ),
            },
          ]}
        />
      </SectionCard>
      )}

      {show === "operacion" && (
      <SectionCard
        index={4}
        icon={Wrench}
        tone="violet"
        title="Parámetros operativos"
        updated={sections.operations.updated_at}
        action={
          manage && (
            <EditSection section="operations" version={sections.operations.lock_version} title="Parámetros operativos" description="Todos son números enteros desde 0.">
              <div className="grid grid-cols-2 gap-3">
                {OPERATIONS.map((item) => (
                  <TextField key={item.key} label={`${item.label} (${item.unit})`} name={item.key} type="number" inputMode="numeric" min={item.key === "max_pax_per_guide" ? 1 : 0} max={item.key === "max_pax_per_guide" ? 40 : undefined} required defaultValue={ops[item.key]} />
                ))}
              </div>
            </EditSection>
          )
        }
      >
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {OPERATIONS.map((item) => (
            <li key={item.key} title={item.hint} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] transition-colors hover:bg-surface-2">
              <span className="truncate text-fg-2">{item.label}</span>
              <b className="flex-none font-semibold">
                {ops[item.key] ?? "—"} <span className="text-[11.5px] font-medium text-fg-3">{item.unit}</span>
              </b>
            </li>
          ))}
        </ul>
      </SectionCard>
      )}

      {show === "canales" && (
      <SectionCard
        index={5}
        icon={Radio}
        tone="accent"
        title="Canales de venta y atención"
        updated={sections.channels.updated_at}
        action={
          manage && (
            <EditSection section="channels" version={sections.channels.lock_version} title="Canales" description="Solo puedes activar los canales que incluye tu plan.">
              {data.channels.map((channel) => (
                <ToggleField key={channel.key} label={channel.label} name={channel.key} defaultChecked={channel.enabled} disabled={!channel.allowed} hint={channel.allowed ? channel.description : `Disponible desde el plan ${channel.min_plan}.`} />
              ))}
            </EditSection>
          )
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.channels.map((channel) => (
            <li key={channel.key} title={channel.description} className={cn("flex items-center justify-between gap-2 rounded-[11px] border px-3 py-2 text-[13px] transition-transform duration-200 hover:-translate-y-0.5", channel.enabled ? "border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_6%,var(--surface))]" : "border-line")}>
              <span className="truncate">{channel.label}</span>
              {channel.allowed ? <Badge tone={channel.enabled ? "ok" : "mute"}>{channel.enabled ? "Activo" : "Apagado"}</Badge> : <Badge tone="mute">Plan {channel.min_plan}</Badge>}
            </li>
          ))}
        </ul>
      </SectionCard>
      )}
    </div>
  );
}

function SequenceFields({ types }: { types: SettingsOverview["sequence_types"] }) {
  const [type, setType] = useState(types[0]?.value ?? "");
  const chosen = types.find((option) => option.value === type);
  const [yearly, setYearly] = useState(chosen?.year_reset ?? false);
  return (
    <>
      <SelectField label="Documento" name="doc_type" options={types.map((option) => ({ value: option.value, label: option.label }))} value={type} onChange={(value) => { setType(value); setYearly(types.find((option) => option.value === value)?.year_reset ?? false); }} />
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <TextField label="Prefijo" name="prefix" required maxLength={30} placeholder="Ej.: OC-" hint="Mayúsculas, números y guiones." icon={<Settings2 size={17} />} />
        <TextField key={type} label="Dígitos" name="pad_width" type="number" min={3} max={10} defaultValue={String(chosen?.pad ?? 5)} />
      </div>
      <TextField label="Primer número" name="next_number" type="number" min={1} defaultValue="1" hint="Si migras desde otro sistema, empieza en el siguiente al último que emitiste." />
      <SwitchField label="Reiniciar cada año" name="year_reset" checked={yearly} onCheckedChange={setYearly} hint="El correlativo vuelve a 1 el 1 de enero." />
    </>
  );
}

export function SequenceCreateAction({ types }: { types: SettingsOverview["sequence_types"] }) {
  if (types.length === 0) return null;
  return (
    <PanelAction<AdminActionState> label="Nueva serie" icon={<Plus size={15} />} variant="primary" size="sm" formId="sequence-create" title="Nueva serie" description="Para documentos internos que aún no tienen correlativo. Las series de comprobantes electrónicos se crean en Facturación." submitLabel="Crear serie" action={createSequence} initial={ADMIN_INITIAL}>
      {() => <SequenceFields types={types} />}
    </PanelAction>
  );
}

export function SequencesTable({ rows, manage, types = [] }: { rows: SettingsSequence[]; manage: boolean; types?: SettingsOverview["sequence_types"] }) {
  const columns: Column<SettingsSequence>[] = [
    { id: "doc", header: "Documento", mobile: "title", cell: (row) => <div><b className="text-[13.5px] font-semibold">{row.label}</b>{row.series !== "default" && <div className="text-[12px] text-fg-3">Serie {row.series}</div>}</div> },
    { id: "prefix", header: "Prefijo", cell: (row) => <span className="font-mono text-[13px]">{row.prefix}</span> },
    { id: "next", header: "Próximo documento", cell: (row) => <span className="rounded-md bg-accent/10 px-2 py-1 font-mono text-[12.5px] font-semibold text-accent">{row.preview}</span> },
    { id: "reset", header: "Reinicio anual", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-3">{row.year_reset ? "Cada año" : "Continuo"}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (row) =>
        manage ? (
          <RowActions>
            <PanelAction<AdminActionState>
              label="Editar"
              icon={<Pencil size={15} />}
              variant="ghost"
              size="sm"
              formId={`sequence-${row.doc_type}-${row.series}`}
              trigger={(open) => <RowIcon tone="edit" label={`Editar serie de ${row.label}`} onClick={open} />}
              title={row.series === "default" ? `Serie de ${row.label}` : `Serie ${row.series} de ${row.label}`}
              description="Los correlativos no se reutilizan ni retroceden: solo puedes avanzarlos, por ejemplo al migrar desde otro sistema."
              submitLabel="Guardar serie"
              action={updateSequence}
              initial={ADMIN_INITIAL}
            >
              {() => (
                <>
                  <input type="hidden" name="doc_type" value={row.doc_type} />
                  <input type="hidden" name="series" value={row.series} />
                  <TextField label="Prefijo" name="prefix" required defaultValue={row.prefix} icon={<Settings2 size={17} />} />
                  <TextField label="Próximo número" name="next_number" type="number" min={row.next} required defaultValue={row.next} hint={`No puede ser menor que ${row.next}.`} />
                </>
              )}
            </PanelAction>
          </RowActions>
        ) : null,
    },
  ];
  return <DataTable screen="admin-series" rows={rows} columns={columns} getKey={(row) => `${row.doc_type}:${row.series}`} entityLabel="series" searchText={(row) => `${row.label} ${row.prefix}`} searchPlaceholder="Buscar documento o prefijo" toolbarEnd={manage ? <SequenceCreateAction types={types} /> : undefined} />;
}
