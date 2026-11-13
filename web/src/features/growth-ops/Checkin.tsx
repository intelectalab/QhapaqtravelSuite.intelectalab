"use client";

import { Baby, FilePenLine, Plus, ScanLine, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { growthStep, type GrowthStepResult } from "@/app/(backoffice)/finanzas/crecimiento-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { FormError } from "@/features/auth/AuthForms";
import type { CheckinDay, Manifest, ManifestPassenger, WaiverTemplate, WaiverTemplates } from "@/lib/growth-ops";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { GrowthStep } from "./GrowthStep";

const WAIVER_TONES: Record<ManifestPassenger["waiver"], Tone> = { no_aplica: "mute", pendiente: "warn", falta_tutor: "warn", firmado: "ok" };

export function DayServices({ day, selected }: { day: CheckinDay; selected?: string }) {
  if (day.services.length === 0) return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[13px] text-fg-3">No hay tours ni traslados con pasajeros para el {formatDate(day.date)}.</p>;
  return (
    <ul className="grid gap-2">
      {day.services.map((service, index) => {
        const pct = service.total > 0 ? Math.round((service.checked_in / service.total) * 100) : 0;
        return (
          <li key={service.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <Link href={`/operaciones/checkin?servicio=${service.code}`} scroll={false} className={cn("lift grid gap-1.5 rounded-xl border px-3.5 py-3 transition", service.code === selected ? "border-accent bg-accent/5" : "border-line bg-surface hover:border-accent/40")}>
              <span className="flex items-baseline justify-between gap-2 text-[13px]">
                <b className="min-w-0 truncate font-semibold">{service.name}</b>
                <span className="flex-none font-mono text-[12px] text-fg-3">{service.time ?? "--:--"}</span>
              </span>
              <span className="text-[12px] text-fg-3">{service.reservation}{service.guide ? ` · ${service.guide}` : ""}</span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </span>
                <span className="font-mono text-[11.5px] text-fg-2">{service.checked_in}/{service.total}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const initial: GrowthStepResult = { message: null, done: false };

export function ScanBox({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [state, run, pending] = useActionState<GrowthStepResult, FormData>(async (previous, form) => {
    const next = await growthStep(previous, form);
    if (next.done) {
      setRound((value) => value + 1);
      router.refresh();
    }
    return next;
  }, initial);
  return (
    <form action={run} className="grid gap-2 rounded-xl border border-dashed border-line px-4 py-3.5">
      <input type="hidden" name="step" value="checkin_scan" />
      <input type="hidden" name="device_id" value="backoffice-web" />
      <div className="flex items-end gap-2">
        <TextField key={round} className="min-w-0 flex-1" label="Escanear pase" icon={<ScanLine size={16} />} name="token" required disabled={disabled} autoFocus={!disabled} autoComplete="off" placeholder={disabled ? "El escaneo se habilita el día del servicio" : "Apunta el lector al QR o pega el código"} />
        <Button type="submit" variant="primary" disabled={pending || disabled}>{pending ? "Registrando…" : "Registrar"}</Button>
      </div>
      {state.done ? <p className="text-[12.5px] font-semibold text-ok">Ingreso registrado.</p> : <FormError message={state.message} />}
    </form>
  );
}

export function ManifestView({ manifest }: { manifest: Manifest }) {
  const { service, counts } = manifest;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold">{service.name}</h3>
          <p className="text-[12.5px] text-fg-3">{service.code} · {service.reservation.code} · {formatDate(service.date)}{service.time ? ` · ${service.time}` : ""}{service.guide ? ` · Guía ${service.guide}` : ""}{service.driver ? ` · Conductor ${service.driver}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="ok">{counts.checked_in} ingresaron</Badge>
          <Badge tone="info">{counts.pending} por ingresar</Badge>
          {manifest.waiver_template && counts.waiver_missing > 0 && <Badge tone="warn">{counts.waiver_missing} sin deslinde</Badge>}
        </div>
      </div>
      <ScanBox disabled={!service.is_today} />
      <ul className="grid gap-2">
        {manifest.passengers.map((passenger) => (
          <li key={passenger.id} className={cn("lift flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-2.5", passenger.pass_status === "usado" ? "bg-[color-mix(in_srgb,var(--ok)_9%,var(--surface))]" : "bg-surface-2")}>
            <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-full", passenger.pass_status === "usado" ? "bg-ok text-white" : "bg-surface text-fg-3")}>
              {passenger.pass_status === "usado" ? <UserCheck size={16} /> : passenger.minor ? <Baby size={16} /> : <ShieldCheck size={16} />}
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              <b className="block font-semibold">{passenger.name}{passenger.is_lead ? " · titular" : ""}</b>
              <span className="text-[12px] text-fg-3">{passenger.document || passenger.pax_type}{passenger.diet_notes ? ` · ${passenger.diet_notes}` : ""}{passenger.scanned_at ? ` · ${formatDateTime(passenger.scanned_at)}${passenger.scanned_by ? ` por ${passenger.scanned_by}` : ""}` : ""}</span>
            </span>
            {manifest.waiver_template && <Badge tone={WAIVER_TONES[passenger.waiver]}>{passenger.waiver_label}</Badge>}
            <Badge tone={passenger.pass_status === "usado" ? "ok" : "info"}>{passenger.pass_label}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WaiverFormAction({ template, langs }: { template?: WaiverTemplate; langs: WaiverTemplates["langs"] }) {
  const [guardian, setGuardian] = useState(template?.versions[0]?.requires_guardian_for_minors ?? true);
  return (
    <GrowthStep step="waiver_create" label={template ? "Nueva versión" : "Nuevo deslinde"} icon={template ? <FilePenLine size={15} /> : <Plus size={15} strokeWidth={2.4} />} variant={template ? "secondary" : "primary"} title={template ? `Nueva versión de ${template.code}` : "Nuevo texto de deslinde"} description="Las firmas anteriores quedan con la versión que el pasajero firmó; desde ahora se pide la nueva." submitLabel="Guardar versión">
      {template && <input type="hidden" name="code" value={template.code} />}
      <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={template?.name} />
      <SelectField label="Idioma" name="lang" options={langs.map((item) => ({ value: item.key, label: item.label }))} defaultValue={template?.lang ?? "es"} />
      <TextArea label="Texto que firma el pasajero" name="body" rows={10} required minLength={40} maxLength={20000} defaultValue={template?.versions[0]?.body} />
      <SwitchField label="Menores firman con su tutor" name="guardian_switch" checked={guardian} onCheckedChange={setGuardian} hint="Pide el nombre de la madre, padre o tutor cuando el pasajero es menor de edad." />
      <input type="hidden" name="requires_guardian_for_minors" value={guardian ? "1" : "0"} />
    </GrowthStep>
  );
}

export function WaiverList({ data }: { data: WaiverTemplates }) {
  if (data.templates.length === 0) return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[13px] text-fg-3">Aún no hay deslindes. Sin deslinde activo, el check-in no pide firma.</p>;
  return (
    <ul className="grid gap-3">
      {data.templates.map((template) => (
        <li key={template.code} className="lift grid gap-2 rounded-xl border border-line bg-surface px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13.5px]">
              <b className="font-semibold">{template.name}</b>
              <span className="block text-[12px] text-fg-3">{template.code} · versión {template.current_version} · {template.lang_label} · {template.signatures === 1 ? "1 firma" : `${template.signatures} firmas`}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={template.active ? "ok" : "mute"}>{template.active ? "Vigente" : "Inactivo"}</Badge>
              <WaiverFormAction template={template} langs={data.langs} />
            </span>
          </div>
          <p className="line-clamp-3 text-[12.5px] leading-relaxed text-fg-2">{template.versions[0]?.body}</p>
        </li>
      ))}
    </ul>
  );
}
