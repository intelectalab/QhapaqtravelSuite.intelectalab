"use client";

import { AtSign, Building2, Check, CheckCircle2, CircleAlert, Globe, Hash, Lock, MapPin, Phone, ShieldCheck, User } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { ProvisionOptions, ProvisionPayload } from "@/lib/platform";

export interface StepProps {
  form: ProvisionPayload;
  set: (patch: Partial<ProvisionPayload>) => void;
  options: ProvisionOptions;
  errors: Record<string, string>;
}

function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return <p className={cn("rounded-[12px] px-3.5 py-2.5 text-[12.5px]", tone === "warn" ? "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-fg-2" : "bg-accent/5 text-fg-2")}>{children}</p>;
}

function Grid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={cn("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>;
}

function SelectCard({ selected, locked, onClick, children }: { selected: boolean; locked?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} disabled={locked && !selected} onClick={onClick} className={cn("lift relative flex w-full flex-col items-start rounded-tile border p-3.5 text-left transition", selected ? "border-accent bg-accent/5 shadow-[0_8px_20px_-14px_var(--accent)]" : "border-line hover:border-accent/40", locked && !selected && "cursor-not-allowed opacity-60 hover:border-line")}>
      <span className={cn("absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border transition", selected ? "border-accent bg-accent text-white" : "border-line bg-surface")}>{selected ? <Check size={12} strokeWidth={3} /> : locked ? <Lock size={10} className="text-fg-3" /> : null}</span>
      {children}
    </button>
  );
}

const num = (value: string) => (value === "" ? 0 : Number(value));

export function AgencyStep({ form, set, options, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Grid>
        <TextField label="Nombre comercial" name="commercial_name" value={form.commercial_name} onChange={(event) => set({ commercial_name: event.target.value })} error={errors.commercial_name} required placeholder="Por ejemplo: Inka Trails" icon={<Building2 size={17} />} />
        <TextField label="Subdominio" name="subdomain" value={form.subdomain} onChange={(event) => set({ subdomain: event.target.value.toLowerCase() })} error={errors.subdomain} required maxLength={30} placeholder="inkatrails" icon={<Globe size={17} />} hint={form.subdomain ? `${form.subdomain}.kipucontrol.com` : "Solo minúsculas, números y guiones."} />
      </Grid>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">Plan</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {options.plans.map((plan) => (
            <SelectCard key={plan.code} selected={form.plan === plan.code} onClick={() => set({ plan: plan.code, channels: form.channels.filter((key) => (options.channels.find((channel) => channel.key === key)?.plan_rank ?? 99) <= plan.rank) })}>
              <b className="text-[14px]">{plan.name}</b>
              <span className="mt-1 font-mono text-[18px] font-bold">{formatMoney(plan.price_month)}</span>
              <span className="text-[11.5px] text-fg-3">al mes · {plan.trial_days} días de prueba</span>
            </SelectCard>
          ))}
        </div>
        {errors.plan && <p className="mt-1 text-[12px] text-bad">{errors.plan}</p>}
      </div>
      <ChoiceGroup label="Inicio" name="status" options={[{ value: "prueba", label: "Con periodo de prueba" }, { value: "activo", label: "Activa y facturando" }]} defaultValue={form.status} onChange={(value) => set({ status: value as ProvisionPayload["status"] })} />
      <Note>Se genera un identificador único e inmutable para la agencia. Todos sus datos quedan aislados por ese identificador.</Note>
    </div>
  );
}

export function CompanyStep({ form, set, options, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TextField label="Razón social" name="legal_name" value={form.legal_name} onChange={(event) => set({ legal_name: event.target.value })} error={errors.legal_name} required placeholder="Inka Trails S.A.C." />
        <TextField label="RUC" name="ruc" value={form.ruc} onChange={(event) => set({ ruc: event.target.value.replace(/\D/g, "") })} error={errors.ruc} required inputMode="numeric" maxLength={11} placeholder="20612345678" icon={<Hash size={17} />} hint="11 dígitos, empieza con 10, 15, 17 o 20." />
      </div>
      <TextField label="Domicilio fiscal" name="fiscal_address" value={form.fiscal_address} onChange={(event) => set({ fiscal_address: event.target.value })} error={errors.fiscal_address} required icon={<MapPin size={17} />} />
      <Grid>
        <SelectField label="Tipo de empresa" name="business_type" value={form.business_type} onChange={(value) => set({ business_type: value })} options={options.business_types.map((type) => ({ value: type, label: type }))} error={errors.business_type} />
        <TextField label="Representante legal (opcional)" name="legal_rep" value={form.legal_rep} onChange={(event) => set({ legal_rep: event.target.value })} error={errors.legal_rep} icon={<User size={17} />} />
      </Grid>
    </div>
  );
}

export function LocaleStep({ form, set, options, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Grid>
        <SelectField label="País" name="country" value={form.country} onChange={(value) => set({ country: value })} options={options.countries.map((country) => ({ value: country, label: country }))} error={errors.country} />
        <SelectField label="Idioma" name="locale" value={form.locale} onChange={(value) => set({ locale: value })} options={options.locales} error={errors.locale} />
      </Grid>
      <Grid columns={3}>
        <SelectField label="Moneda base" name="base_currency" value={form.base_currency} onChange={(value) => set({ base_currency: value })} options={options.base_currencies.map((item) => ({ value: item.value, label: `${item.value} · ${item.label}` }))} error={errors.base_currency} />
        <SelectField label="Moneda alterna" name="alt_currency" value={form.alt_currency} onChange={(value) => set({ alt_currency: value })} options={options.alt_currencies.map((item) => ({ value: item.value, label: `${item.value} · ${item.label}` }))} error={errors.alt_currency} />
        <SelectField label="Zona horaria" name="timezone" value={form.timezone} onChange={(value) => set({ timezone: value })} options={options.timezones.map((zone) => ({ value: zone, label: zone.replace("America/", "").replace("_", " ") }))} error={errors.timezone} />
      </Grid>
      <Note tone="warn">La moneda base no se puede cambiar una vez que la agencia registra transacciones.</Note>
    </div>
  );
}

export function SedeStep({ form, set, options, errors }: StepProps) {
  const starter = options.plans.find((plan) => plan.code === form.plan)?.rank === 1;
  return (
    <div className="flex flex-col gap-4">
      <Grid>
        <TextField label="Nombre de la sede" name="sede_name" value={form.sede_name} onChange={(event) => set({ sede_name: event.target.value })} error={errors.sede_name} required placeholder="Cusco — El Sol" />
        <TextField label="Ciudad" name="sede_city" value={form.sede_city} onChange={(event) => set({ sede_city: event.target.value })} error={errors.sede_city} required />
      </Grid>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TextField label="Dirección" name="sede_address" value={form.sede_address} onChange={(event) => set({ sede_address: event.target.value })} error={errors.sede_address} required icon={<MapPin size={17} />} />
        <TextField label="Teléfono (opcional)" name="sede_phone" value={form.sede_phone} onChange={(event) => set({ sede_phone: event.target.value })} error={errors.sede_phone} inputMode="tel" icon={<Phone size={17} />} />
      </div>
      {starter && <Note>El plan Starter incluye una sede. Para varias sedes se necesita Enterprise.</Note>}
    </div>
  );
}

export function AdminStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Grid>
        <TextField label="Nombre completo" name="admin_name" value={form.admin_name} onChange={(event) => set({ admin_name: event.target.value })} error={errors.admin_name} required icon={<User size={17} />} />
        <TextField label="Correo" name="admin_email" type="email" value={form.admin_email} onChange={(event) => set({ admin_email: event.target.value })} error={errors.admin_email} required icon={<AtSign size={17} />} />
      </Grid>
      <Grid>
        <TextField label="Teléfono (opcional)" name="admin_phone" value={form.admin_phone} onChange={(event) => set({ admin_phone: event.target.value })} error={errors.admin_phone} inputMode="tel" icon={<Phone size={17} />} />
        <div className="flex items-end pb-1">
          <SwitchField label="Verificación en dos pasos obligatoria" name="admin_mfa" checked={form.admin_mfa} onCheckedChange={(checked) => set({ admin_mfa: checked })} hint="Se le pedirá en su primer acceso." />
        </div>
      </Grid>
      <Note>Recibirá una invitación con un enlace de un solo uso, válido 72 horas. La contraseña nunca viaja por correo.</Note>
    </div>
  );
}

export function RolesStep({ form, set, options }: StepProps) {
  const toggle = (id: string) => set({ roles: form.roles.includes(id) ? form.roles.filter((role) => role !== id) : [...form.roles, id] });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-fg-2">Elige los roles base que tendrá la agencia. Después podrá crear roles propios.</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.roles.map((role) => (
          <SelectCard key={role.id} selected={role.required || form.roles.includes(role.id)} locked={role.required} onClick={role.required ? undefined : () => toggle(role.id)}>
            <b className="pr-6 text-[13.5px]">{role.name}</b>
            {role.description && <span className="mt-0.5 line-clamp-2 text-[12px] text-fg-3">{role.description}</span>}
            <span className="mt-2 flex gap-1.5">
              <Badge tone="mute" dot={false}>{role.scope}</Badge>
              {role.required && <Badge tone="t1" dot={false}>Siempre incluido</Badge>}
            </span>
          </SelectCard>
        ))}
      </div>
    </div>
  );
}

export function PermissionsStep({ form, set, options }: StepProps) {
  const roles = options.roles.filter((role) => role.required || form.roles.includes(role.id));
  const max = Math.max(...roles.map((role) => role.templates.standard?.permissions ?? 0), 1);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.templates.map((template) => (
          <SelectCard key={template.value} selected={form.permission_template === template.value} onClick={() => set({ permission_template: template.value })}>
            <b className="text-[13.5px]">{template.label}</b>
            <span className="mt-0.5 text-[12px] text-fg-3">{template.value === "minimal" ? "Cada rol solo consulta; el administrador conserva todo y otorga lo demás." : "Los permisos de cada rol según el manual de la plataforma."}</span>
          </SelectCard>
        ))}
      </div>
      <div className="overflow-hidden rounded-tile border border-line">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[11.5px] text-fg-3">
              <th className="px-3 py-2 font-medium">Rol</th>
              <th className="px-3 py-2 font-medium">Permisos</th>
              <th className="px-3 py-2 font-medium">Módulos con acceso</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const data = role.templates[form.permission_template] ?? { permissions: 0, modules: [] };
              return (
                <tr key={role.id} className="border-b border-line-2 last:border-0">
                  <td className="px-3 py-2.5 font-semibold">{role.name}</td>
                  <td className="w-[34%] px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(data.permissions / max) * 100}%` }} />
                      </span>
                      <b className="w-8 text-right font-mono">{data.permissions}</b>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-fg-2">
                    {data.modules.slice(0, 3).join(", ") || "—"}
                    {data.modules.length > 3 && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-accent">
                        y {data.modules.length - 3} más
                        <InfoTip label={`Módulos de ${role.name}`}>{data.modules.join(", ")}</InfoTip>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-fg-3">Los permisos se ajustan después en Roles y permisos de la agencia.</p>
    </div>
  );
}

export function CommercialStep({ form, set, errors }: StepProps) {
  return (
    <Grid>
      <TextField label="Validez de la cotización (días)" name="quote_validity_days" type="number" min={1} max={60} value={form.quote_validity_days} onChange={(event) => set({ quote_validity_days: num(event.target.value) })} error={errors.quote_validity_days} />
      <TextField label="Bloqueo de cupos (minutos)" name="hold_minutes" type="number" min={5} max={1440} value={form.hold_minutes} onChange={(event) => set({ hold_minutes: num(event.target.value) })} error={errors.hold_minutes} />
      <TextField label="Margen sugerido (%)" name="markup_pct" type="number" step="0.5" min={0} value={form.markup_pct} onChange={(event) => set({ markup_pct: num(event.target.value) })} error={errors.markup_pct} />
      <TextField label="Descuento máximo sin aprobación (%)" name="max_discount_pct" type="number" step="0.5" min={0} max={30} value={form.max_discount_pct} onChange={(event) => set({ max_discount_pct: num(event.target.value) })} error={errors.max_discount_pct} hint="Hasta 30 %." />
    </Grid>
  );
}

export function FinanceStep({ form, set, options, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Grid columns={3}>
        <TextField label="IGV (%)" name="tax_pct" type="number" step="0.5" value={form.tax_pct} onChange={(event) => set({ tax_pct: num(event.target.value) })} error={errors.tax_pct} />
        <SelectField label="Redondeo" name="rounding" value={form.rounding} onChange={(value) => set({ rounding: value })} options={options.rounding} error={errors.rounding} />
        <TextField label="Anticipo por defecto (%)" name="advance_pct" type="number" value={form.advance_pct} onChange={(event) => set({ advance_pct: num(event.target.value) })} error={errors.advance_pct} />
      </Grid>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TextField label={`Tipo de cambio ${form.alt_currency} inicial`} name="fx_rate" type="number" step="0.001" value={form.fx_rate} onChange={(event) => set({ fx_rate: num(event.target.value) })} error={errors.fx_rate} />
        <SelectField label="Fuente del tipo de cambio" name="fx_source" value={form.fx_source} onChange={(value) => set({ fx_source: value })} options={options.fx_sources.map((source) => ({ value: source, label: source }))} error={errors.fx_source} />
      </div>
      <Grid>
        <TextField label="Serie de facturas" name="invoice_series" value={form.invoice_series} onChange={(event) => set({ invoice_series: event.target.value.toUpperCase() })} error={errors.invoice_series} maxLength={4} hint="F seguida de 3 letras o números." />
        <TextField label="Serie de boletas" name="receipt_series" value={form.receipt_series} onChange={(event) => set({ receipt_series: event.target.value.toUpperCase() })} error={errors.receipt_series} maxLength={4} hint="B seguida de 3 letras o números." />
      </Grid>
    </div>
  );
}

export function ChannelsStep({ form, set, options }: StepProps) {
  const rank = options.plans.find((plan) => plan.code === form.plan)?.rank ?? 1;
  const toggle = (key: string) => set({ channels: form.channels.includes(key) ? form.channels.filter((item) => item !== key) : [...form.channels, key] });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-fg-2">Los canales que no incluye el plan aparecen con candado.</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.channels.map((channel) => {
          const allowed = channel.plan_rank <= rank;
          return (
            <SelectCard key={channel.key} selected={allowed && form.channels.includes(channel.key)} locked={!allowed} onClick={allowed ? () => toggle(channel.key) : undefined}>
              <b className="pr-6 text-[13.5px]">{channel.label}</b>
              <span className="mt-0.5 text-[12px] text-fg-3">{channel.description}</span>
              {!allowed && <span className="mt-2"><Badge tone="mute" dot={false}>Requiere {channel.plan}</Badge></span>}
            </SelectCard>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewStep({ form, options }: StepProps) {
  const plan = options.plans.find((item) => item.code === form.plan);
  const roles = options.roles.filter((role) => role.required || form.roles.includes(role.id));
  const channels = options.channels.filter((channel) => form.channels.includes(channel.key));
  const groups: [string, [string, string][]][] = [
    ["Agencia", [["Nombre", form.commercial_name], ["Dirección", `${form.subdomain}.kipucontrol.com`], ["Plan", `${plan?.name ?? form.plan} · ${form.status === "prueba" ? `prueba de ${plan?.trial_days ?? 14} días` : "activa"}`]]],
    ["Empresa", [["Razón social", form.legal_name], ["RUC", form.ruc], ["Tipo", form.business_type]]],
    ["Región", [["País", form.country], ["Monedas", `${form.base_currency} y ${form.alt_currency}`], ["Zona", form.timezone]]],
    ["Sede y administrador", [["Sede", `${form.sede_name} · ${form.sede_city}`], ["Administrador", form.admin_name], ["Correo", form.admin_email]]],
    ["Acceso", [["Roles", `${roles.length}: ${roles.map((role) => role.name).join(", ")}`], ["Plantilla", options.templates.find((item) => item.value === form.permission_template)?.label ?? ""], ["Dos pasos", form.admin_mfa ? "Obligatoria" : "Opcional"]]],
    ["Configuración", [["Cotización", `${form.quote_validity_days} días · bloqueo ${form.hold_minutes} min`], ["Impuesto", `IGV ${form.tax_pct} % · anticipo ${form.advance_pct} %`], ["Series", `${form.invoice_series} y ${form.receipt_series}`], ["Canales", channels.map((channel) => channel.label).join(", ") || "Ninguno"]]],
  ];
  const checks: [string, boolean][] = [
    ["Empresa con RUC", /^(10|15|17|20)\d{9}$/.test(form.ruc) && form.legal_name !== ""],
    ["Moneda, impuesto y zona horaria", form.base_currency !== form.alt_currency],
    ["Sede principal", form.sede_name !== "" && form.sede_address !== ""],
    ["Administrador con invitación", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.admin_email)],
    ["Roles y permisos desde la plantilla", roles.length > 0],
    [`Módulos del plan ${plan?.name ?? ""} aplicados`, Boolean(plan)],
    ["Datos aislados por agencia y alta auditada", true],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map(([title, rows]) => (
          <div key={title} className="rounded-tile border border-line-2 p-3.5">
            <p className="mb-2 text-[12px] font-semibold text-fg-3">{title}</p>
            <dl className="grid gap-1.5 text-[12.5px]">
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[86px_1fr] gap-2">
                  <dt className="text-fg-3">{label}</dt>
                  <dd className="min-w-0 break-words font-medium">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="rounded-tile border border-line-2 bg-surface-2/60 p-4">
        <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
          <ShieldCheck size={16} className="text-accent" />
          Lista de verificación
        </p>
        <ul className="grid gap-2">
          {checks.map(([label, ok]) => (
            <li key={label} className="flex items-center gap-2 text-[12.5px]">
              {ok ? <CheckCircle2 size={16} className="flex-none text-ok" /> : <CircleAlert size={16} className="flex-none text-bad" />}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
