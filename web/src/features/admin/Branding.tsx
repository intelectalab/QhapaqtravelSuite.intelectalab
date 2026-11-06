"use client";

import { Bell, CalendarCheck, Check, CircleDollarSign, LayoutDashboard, Palette, RotateCcw, Sparkles, Users, Wand2 } from "lucide-react";
import { startTransition, useActionState, useMemo, useState, type CSSProperties } from "react";
import { resetBranding, saveBranding } from "@/app/(backoffice)/admin/personalizacion/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { FormError } from "@/features/auth/AuthForms";
import { ADMIN_INITIAL, type AdminActionState, type BrandingOverview, type BrandingValues, type TileVariantName } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { RISE } from "./AdminParts";

type Role = "brand" | "accent" | "menu";

const ROLES: { key: Role; label: string; hint: string; presets: string[] }[] = [
  { key: "brand", label: "Color principal", hint: "Botones principales, menú y pestaña activos, interruptores, banda de correos y cabecera de PDF.", presets: ["#b3263e", "#9f1d4f", "#c2410c", "#0f766e", "#1d4ed8", "#6d28d9", "#1f2937"] },
  { key: "accent", label: "Color de acento", hint: "Enlaces, iconos y etiquetas. Los fondos suaves se calculan solos.", presets: ["#26357a", "#1e40af", "#0e7490", "#2c7a66", "#7a5af8", "#b45309", "#be185d"] },
  { key: "menu", label: "Color del menú", hint: "Fondo del menú lateral. El texto se ajusta claro u oscuro.", presets: ["#141a33", "#0f172a", "#1c1917", "#14281f", "#2a1430", "#f4f5f8", "#ffffff"] },
];

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function darken(hex: string, amount: number): string {
  return `#${[1, 3, 5].map((i) => Math.max(0, Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount))).toString(16).padStart(2, "0")).join("")}`;
}

function suggestion(hex: string): string | null {
  if (!HEX.test(hex) || contrast(hex, "#ffffff") >= 4.5) return null;
  for (let step = 0.05; step < 0.9; step += 0.05) {
    const candidate = darken(hex, step);
    if (contrast(candidate, "#ffffff") >= 4.5) return candidate;
  }
  return "#1f2937";
}

function ColorRole({ role, value, onChange, disabled }: { role: (typeof ROLES)[number]; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const valid = HEX.test(value);
  const fix = role.key === "menu" ? null : suggestion(value);
  const ratio = valid ? contrast(value, role.key === "menu" ? (luminance(value) > 0.45 ? "#141a33" : "#ffffff") : "#ffffff") : 0;
  return (
    <div className={cn("rounded-[14px] border border-line p-3.5 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]", RISE)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-semibold">{role.label}</p>
          <p className="text-[12px] text-fg-3">{role.hint}</p>
        </div>
        <span className={cn("flex-none rounded-full px-2 py-0.5 text-[11px] font-bold", ratio >= 4.5 ? "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-warn")} title="Contraste del texto sobre este color (WCAG AA pide 4.5 o más)">
          {valid ? `${ratio.toFixed(1)} : 1` : "—"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {role.presets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset)}
            aria-label={`Usar ${preset}`}
            title={preset}
            style={{ background: preset }}
            className={cn("grid h-8 w-8 place-items-center rounded-full border border-black/10 transition-transform duration-200 hover:scale-115 disabled:cursor-not-allowed", value.toLowerCase() === preset && "ring-2 ring-fg ring-offset-2 ring-offset-surface")}
          >
            {value.toLowerCase() === preset && <Check size={14} className={luminance(preset) > 0.45 ? "text-fg" : "text-white"} strokeWidth={3} />}
          </button>
        ))}
        <label className="ml-auto flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 focus-within:border-accent">
          <span className="h-5 w-5 rounded-md border border-black/10" style={{ background: valid ? value : "transparent" }} />
          <input value={value} onChange={(event) => onChange(event.target.value.trim())} disabled={disabled} maxLength={7} aria-label={`${role.label} en hexadecimal`} className="w-[76px] bg-transparent font-mono text-[13px] uppercase outline-none" />
        </label>
      </div>
      {fix && (
        <p className="mt-2.5 flex items-center gap-2 text-[12px] text-warn">
          El texto blanco se lee con dificultad sobre este color.
          <button type="button" disabled={disabled} onClick={() => onChange(fix)} className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-2 py-0.5 font-semibold transition-transform hover:-translate-y-0.5">
            <Wand2 size={12} /> Usar {fix}
          </button>
        </p>
      )}
    </div>
  );
}

function Preview({ values, agency }: { values: BrandingValues; agency: BrandingOverview["agency"] }) {
  const menuLight = luminance(values.menu) > 0.45;
  const style = { "--brand": values.brand, "--accent": values.accent, "--menu": values.menu, "--t1": values.accent } as CSSProperties;
  return (
    <div style={style} className="overflow-hidden rounded-card border border-line shadow-card">
      <div className="grid grid-cols-[150px_minmax(0,1fr)]">
        <aside className={cn("flex flex-col gap-1 bg-[var(--menu)] p-3 text-[12px]", menuLight ? "text-[#141a33]" : "text-white")}>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-[11px] font-bold text-white">{agency.initials}</span>
            <b className="truncate text-[12.5px]">{agency.name}</b>
          </div>
          {[
            { icon: LayoutDashboard, label: "Inicio", active: true },
            { icon: Users, label: "Clientes" },
            { icon: CalendarCheck, label: "Reservas" },
            { icon: CircleDollarSign, label: "Finanzas" },
          ].map((item) => (
            <span key={item.label} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors", item.active ? "bg-[var(--brand)] font-semibold text-white" : menuLight ? "opacity-75 hover:bg-black/5" : "opacity-75 hover:bg-white/10")}>
              <item.icon size={14} />
              {item.label}
            </span>
          ))}
        </aside>
        <div className="flex flex-col gap-3 bg-bg p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold">Buenos días</p>
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-surface text-fg-2">
              <Bell size={15} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--brand)]" />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <TintTile icon={Sparkles} tone="brand" label="Ventas del mes" value="S/ 184 200" note="+12 %" variant={values.tile_variant} />
            <TintTile icon={CalendarCheck} tone="accent" label="Reservas activas" value="37" note="9 salen esta semana" variant={values.tile_variant} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="inline-flex h-8 items-center rounded-[10px] bg-[var(--brand)] px-3 font-semibold text-white shadow-[0_6px_16px_-8px_var(--brand)]">Nueva cotización</span>
            <span className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">Ver reservas</span>
            <span className="rounded-[7px] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-1 font-semibold text-[var(--accent)]">Confirmada</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandingStudio({ data }: { data: BrandingOverview }) {
  const [values, setValues] = useState<BrandingValues>(data.branding);
  const [state, run, pending] = useActionState<AdminActionState, FormData>(saveBranding, ADMIN_INITIAL);
  const manage = data.can_manage;
  const dirty = useMemo(() => (Object.keys(values) as (keyof BrandingValues)[]).some((key) => values[key].toLowerCase() !== data.branding[key].toLowerCase()), [values, data.branding]);
  const invalid = [values.brand, values.accent, values.menu].some((value) => !HEX.test(value));
  const isDefault = (Object.keys(data.defaults) as (keyof BrandingValues)[]).every((key) => data.branding[key] === data.defaults[key]);
  const submit = () => {
    const form = new FormData();
    (Object.keys(values) as (keyof BrandingValues)[]).forEach((key) => form.set(key, values[key]));
    startTransition(() => run(form));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col gap-5">
        <Card>
          <TintCardTitle icon={Palette} title="Colores de la marca" />
          <div className="flex flex-col gap-3">
            {ROLES.map((role) => (
              <ColorRole key={role.key} role={role} value={values[role.key]} disabled={!manage} onChange={(value) => setValues((current) => ({ ...current, [role.key]: value }))} />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-fg-3">Los colores de estado (confirmado, pendiente, vencido) no cambian, para que siempre se lean igual.</p>
        </Card>
        <Card>
          <TintCardTitle icon={LayoutDashboard} title="Diseño de las tarjetas" aside={data.variants.find((variant) => variant.value === values.tile_variant)?.label} />
          <div role="radiogroup" aria-label="Diseño de tarjeta" className="grid gap-3 sm:grid-cols-2">
            {data.variants.map((variant, index) => {
              const selected = values.tile_variant === variant.value;
              return (
                <button
                  key={variant.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!manage}
                  onClick={() => setValues((current) => ({ ...current, tile_variant: variant.value as TileVariantName }))}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className={cn("group relative rounded-[16px] border p-2.5 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed", selected ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-accent/40", RISE)}
                >
                  <span className="pointer-events-none block">
                    <TintTile icon={CalendarCheck} tone={index % 2 === 0 ? "t1" : "t4"} label="Reservas activas" value="37" note="9 esta semana" variant={variant.value as TileVariantName} />
                  </span>
                  <span className="mt-2 flex items-center justify-between px-1 text-[12.5px] font-semibold">
                    {variant.label}
                    {selected && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
      <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <TintCardTitle icon={Sparkles} title="Vista previa" aside="Así lo verá tu equipo" />
          <Preview values={values} agency={data.agency} />
          <FormError message={state.done ? null : state.message} />
          {state.done && !dirty && <p className="mt-3 text-[12.5px] font-semibold text-ok">Apariencia guardada.</p>}
          {manage && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {dirty && (
                <Button variant="ghost" onClick={() => setValues(data.branding)}>
                  Descartar cambios
                </Button>
              )}
              {!isDefault && (
                <PanelAction<AdminActionState>
                  label="Restablecer"
                  icon={<RotateCcw size={15} />}
                  variant="secondary"
                  formId="branding-reset"
                  title="Restablecer la apariencia"
                  description="Vuelven los colores y el diseño de tarjeta predeterminados de Qhapaq Travel Suite."
                  submitLabel="Restablecer"
                  action={resetBranding}
                  initial={ADMIN_INITIAL}
                  onDone={() => setValues(data.defaults)}
                >
                  {() => <TextArea label="Motivo" name="reason" rows={2} required minLength={3} placeholder="Por ejemplo: volvemos a la imagen original." />}
                </PanelAction>
              )}
              <Button variant="primary" disabled={!dirty || invalid || pending} onClick={submit}>
                {pending ? "Guardando…" : "Guardar apariencia"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
