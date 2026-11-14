"use client";

import { Clock3, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { updateBusinessHours } from "@/app/(backoffice)/admin/configuracion/actions";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import type { BusinessDay, BusinessHoursOverview, WeekDay } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { EditSection, SectionCard } from "./Settings";

export const WEEK_DAYS: { key: WeekDay; label: string; short: string }[] = [
  { key: "mon", label: "Lunes", short: "Lun" },
  { key: "tue", label: "Martes", short: "Mar" },
  { key: "wed", label: "Miércoles", short: "Mié" },
  { key: "thu", label: "Jueves", short: "Jue" },
  { key: "fri", label: "Viernes", short: "Vie" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
];

const slots = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => {
  const minutes = (from + index) * 30;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { value, label: value };
});

const OPENING = slots(0, 47);
const CLOSING = slots(1, 48);

const minuteOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function DayBar({ day }: { day: BusinessDay }) {
  const left = (minuteOf(day.from) / 1440) * 100;
  const width = ((minuteOf(day.to) - minuteOf(day.from)) / 1440) * 100;
  return (
    <span className="relative block h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
      {[25, 50, 75].map((mark) => (
        <span key={mark} aria-hidden className="absolute inset-y-0 w-px bg-line" style={{ left: `${mark}%` }} />
      ))}
      {day.open && <span className="absolute inset-y-0 rounded-full bg-[var(--t1)] transition-[filter] group-hover:brightness-110" style={{ left: `${left}%`, width: `${width}%` }} />}
    </span>
  );
}

function DayEditor({ day, value }: { day: (typeof WEEK_DAYS)[number]; value: BusinessDay }) {
  const [open, setOpen] = useState(value.open);
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
      <SwitchField label={day.label} name={`${day.key}_open`} checked={open} onCheckedChange={setOpen} />
      {open ? (
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Abre" name={`${day.key}_from`} options={OPENING} defaultValue={value.from} />
          <SelectField label="Cierra" name={`${day.key}_to`} options={CLOSING} defaultValue={value.to} />
        </div>
      ) : (
        <p className="text-[13px] text-fg-3">Cerrado</p>
      )}
    </div>
  );
}

export function BusinessHoursCard({ hours, manage, index }: { hours: BusinessHoursOverview; manage: boolean; index: number }) {
  return (
    <SectionCard
      index={index}
      icon={Clock3}
      tone="t1"
      title="Horario de atención"
      updated={hours.updated_at}
      action={
        <span className="flex items-center gap-1">
          <InfoTip label="Dónde se usa">Arma el texto de la barra y el pie del sitio, la respuesta del chat fuera de horario, los avisos marcados «Solo en horario de atención» y los plazos que corren en horas hábiles. Zona horaria {hours.timezone}.</InfoTip>
          {manage && (
            <EditSection section="business-hours" version={hours.lock_version} title="Horario de atención" description="Marca los días que atiendes y el horario de cada uno. Los plazos en horas hábiles solo corren dentro de este horario." action={updateBusinessHours}>
              <div className="flex flex-col">
                {WEEK_DAYS.map((day) => (
                  <DayEditor key={day.key} day={day} value={hours.days[day.key]} />
                ))}
              </div>
            </EditSection>
          )}
        </span>
      }
    >
      {hours.notice && (
        <p data-testid="business-hours-notice" className="mb-3 flex items-center gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))] px-3 py-2 text-[13px] font-medium text-fg">
          <TriangleAlert size={15} className="flex-none text-warn" />
          {hours.notice}. Mientras tanto se usa lunes a viernes de 08:00 a 19:00.
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={hours.open_now ? "ok" : "mute"}>{hours.open_now ? "Abierto ahora" : "Cerrado ahora"}</Badge>
        {!hours.open_now && <span className="text-[12.5px] text-fg-3">Abre el {formatDateTime(hours.next_open, false)}</span>}
      </div>
      <ul className="flex flex-col gap-1.5" aria-label={hours.summary.es}>
        {WEEK_DAYS.map((day) => {
          const value = hours.days[day.key];
          return (
            <li key={day.key} className="group flex items-center gap-3 rounded-lg px-1 py-0.5 text-[12.5px] transition hover:bg-surface-2/60" title={value.open ? `${day.label}: ${value.from}–${value.to}` : `${day.label}: cerrado`}>
              <span className="w-9 font-semibold text-fg-2">{day.short}</span>
              <DayBar day={value} />
              <span className={cn("w-[92px] text-right font-mono", value.open ? "text-fg" : "text-fg-3")}>{value.open ? `${value.from}–${value.to}` : "Cerrado"}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] text-fg-3">En el sitio: {hours.summary.es}</p>
    </SectionCard>
  );
}
