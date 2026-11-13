"use client";

import { AlarmClock, BookOpen, Building2, CalendarOff, CalendarRange, Coins, Download, Hash, MapPin, Pencil, Plus, Settings2, Tags, Timer, TimerReset, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { claimHolidayStep, requestClaimExport, saveClaimSettings, type ClaimExportResult } from "@/app/(backoffice)/crm/reclamaciones/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { HiddenFields } from "@/features/catalog-shared/CatalogPanels";
import { BarChart } from "@/components/ui/Charts";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import type { ClaimHoliday, ClaimReport, ClaimSheet, ClaimsOverview } from "@/lib/claims";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { ClaimsTable } from "./ClaimsTable";

const initial: StepResult = { message: null, done: false };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`;

function claimedAmounts(claims: ClaimSheet[]) {
  const totals = new Map<string, number>();
  for (const claim of claims) {
    if (!claim.good || claim.good.amount <= 0) continue;
    totals.set(claim.good.currency, (totals.get(claim.good.currency) ?? 0) + claim.good.amount);
  }
  return [...totals.entries()];
}

export function ClaimTiles({ overview }: { overview: ClaimsOverview }) {
  const { kpis, settings, claims, today } = overview;
  const month = today.slice(0, 7);
  const ofMonth = claims.filter((claim) => claim.received_on.startsWith(month));
  const open = claims.filter((claim) => claim.book_status === "received" || claim.book_status === "in_review");
  const amounts = claimedAmounts(open);
  const answered = claims.filter((claim) => claim.deadline === "respondido_en_plazo" || claim.deadline === "respondido_fuera_de_plazo");
  const late = answered.filter((claim) => claim.deadline === "respondido_fuera_de_plazo").length;
  return (
    <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TintTile icon={CalendarRange} tone="t1" label="Hojas del mes" value={formatNumber(kpis.month)} info={<p>Recibidas desde el día 1: {plural(ofMonth.filter((claim) => claim.type_code === "reclamo").length, "reclamo", "reclamos")} y {plural(ofMonth.filter((claim) => claim.type_code === "queja").length, "queja", "quejas")}.</p>} />
      <TintTile icon={Timer} tone="violet" label="Tiempo de respuesta" value={kpis.avg_days !== null ? `${kpis.avg_days} días` : "Sin datos"} note="Días hábiles, en promedio" info={<p>Desde que se recibe la hoja hasta que se responde, sin contar fines de semana ni feriados. Promedio de {plural(answered.length, "hoja respondida", "hojas respondidas")}.</p>} />
      <TintTile icon={TimerReset} tone="ok" label="Respondidas a tiempo" value={kpis.on_time_pct !== null ? `${kpis.on_time_pct} %` : "Sin datos"} note={`Plazo de ${settings.response_days} días hábiles`} info={<p>{late === 0 ? "Ninguna respuesta salió fuera del plazo legal." : `${plural(late, "respuesta salió", "respuestas salieron")} fuera del plazo legal.`}</p>} />
      <TintTile icon={Coins} tone="sun" label="Monto en reclamo" value={amounts.length ? amounts.map(([currency, amount]) => formatMoney(amount, currency, { compact: true })).join(" · ") : "—"} note="Hojas sin responder" info={<p>Suma del monto del bien contratado declarado por el consumidor en las hojas que aún no se responden.</p>} />
    </section>
  );
}

function monthly(claims: ClaimSheet[], today: string) {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 1 - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const items = claims.filter((claim) => claim.received_on.startsWith(key));
    const claimsCount = items.filter((claim) => claim.type_code === "reclamo").length;
    return { label: MONTHS[date.getMonth()], value: items.length, caption: String(items.length), detail: `${plural(claimsCount, "reclamo", "reclamos")} · ${plural(items.length - claimsCount, "queja", "quejas")}`, highlight: index === 5 };
  });
}

const EXPORT_COLUMNS = ["N° de hoja", "Fecha", "Sede", "Tipo", "Consumidor", "Documento", "Detalle", "Pedido", "Monto", "Estado", "Respuesta", "Plazo"];

const exportInitial: ClaimExportResult = { message: null, done: false };

function ExportYearAction({ year, count }: { year: string; count: number }) {
  const [last, setLast] = useState<ClaimExportResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PanelAction<ClaimExportResult>
        label="Exportar relación"
        icon={<Download size={15} />}
        size="sm"
        formId="exportar-relacion"
        title={`Relación de hojas ${year}`}
        description="El archivo queda en Exportaciones por 7 días y la descarga se registra en la auditoría."
        submitLabel="Generar archivo"
        action={requestClaimExport}
        initial={exportInitial}
        onDone={setLast}
      >
        {() => (
          <>
            <input type="hidden" name="year" value={year} />
            <ChoiceGroup label="Formato" name="format" options={[{ value: "XLSX", label: "Excel" }, { value: "CSV", label: "CSV" }, { value: "PDF", label: "PDF" }]} defaultValue="XLSX" />
          </>
        )}
      </PanelAction>
      {last?.exportId && (
        <Button href={`/reportes/exportaciones/${last.exportId}/descargar`} variant="primary" size="sm" icon={<Download size={15} />}>
          Descargar ({plural(last.rows ?? count, "hoja", "hojas")})
        </Button>
      )}
    </div>
  );
}

function Compliance({ report }: { report: ClaimReport }) {
  const { on_time, late, overdue, pending } = report.compliance;
  const total = on_time + late + overdue + pending;
  const parts = [
    { label: "En plazo", value: on_time, tone: "var(--ok)" },
    { label: "Fuera de plazo", value: late, tone: "var(--warn)" },
    { label: "Vencidas sin respuesta", value: overdue, tone: "var(--bad)" },
    { label: "Aún en plazo", value: pending, tone: "var(--info)" },
  ];
  return (
    <section className="lift rounded-tile border border-line p-4">
      <TintCardTitle icon={TimerReset} title="Cumplimiento del plazo" tone="ok" aside={`${report.year} · ${plural(total, "hoja", "hojas")}`} />
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-2">
        {parts.map((part) => (part.value > 0 ? <span key={part.label} title={`${part.label}: ${part.value}`} style={{ width: `${(part.value / Math.max(total, 1)) * 100}%`, background: part.tone }} className="transition-[width] duration-700" /> : null))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {parts.map((part) => (
          <li key={part.label} className="rounded-xl bg-surface-2 px-3 py-2 transition-transform duration-200 hover:-translate-y-0.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
              <span className="h-2 w-2 rounded-full" style={{ background: part.tone }} />
              {part.label}
            </span>
            <b className="text-[17px]">{formatNumber(part.value)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OverdueTable({ report }: { report: ClaimReport }) {
  return (
    <section className="lift rounded-tile border border-line p-4">
      <TintCardTitle icon={AlarmClock} title="Vencidas sin respuesta" tone="bad" aside={plural(report.overdue.length, "hoja", "hojas")} />
      <SimpleTable
        columns={[{ header: "Hoja" }, { header: "Consumidor" }, { header: "Sede" }, { header: "Venció" }, { header: "Atraso", align: "right" }, { header: "Responsable" }]}
        rows={report.overdue.map((row) => ({
          key: row.code,
          cells: [
            <Link key="code" href={`/crm/reclamaciones/${encodeURIComponent(row.code)}`} className="font-mono text-[12.5px] text-accent hover:underline">{row.book_number}</Link>,
            row.consumer,
            row.sede ?? "—",
            row.due_date ? formatDate(row.due_date) : "—",
            row.days_late !== null ? plural(row.days_late, "día hábil", "días hábiles") : "—",
            row.owner ?? "Sin responsable",
          ],
        }))}
        empty="Ninguna hoja está vencida sin respuesta."
      />
    </section>
  );
}

export function ClaimReports({ overview, report }: { overview: ClaimsOverview; report: ClaimReport | null }) {
  const year = overview.today.slice(0, 4);
  const ofYear = overview.claims.filter((claim) => claim.received_on.startsWith(year)).length;
  return (
    <div className="flex flex-col gap-5">
      {report && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Compliance report={report} />
          <OverdueTable report={report} />
        </div>
      )}
      <section className="lift rounded-tile border border-line p-4">
        <TintCardTitle icon={CalendarRange} title="Hojas por mes" aside="Últimos 6 meses" />
        <BarChart data={monthly(overview.claims, overview.today)} height={110} />
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="lift rounded-tile border border-line p-4">
          <TintCardTitle icon={Tags} title="Por tipo" tone="violet" />
          <BarChart data={overview.by_type.map((item) => ({ label: item.label, value: item.count, caption: String(item.count), detail: plural(item.count, "hoja", "hojas") }))} height={100} />
        </section>
        <section className="lift rounded-tile border border-line p-4">
          <TintCardTitle icon={MapPin} title="Por sede" tone="t3" />
          <BarChart data={overview.by_sede.map((item) => ({ label: item.label.split(" — ")[0], value: item.count, caption: String(item.count), detail: `${item.label}: ${item.count}` }))} height={100} />
        </section>
      </div>
      <section className="lift rounded-tile border border-line p-4">
        <TintCardTitle icon={BookOpen} title={`Relación de hojas ${year}`} aside={plural(ofYear, "hoja", "hojas")} />
        <ul className="mb-4 flex flex-wrap gap-1.5">
          {EXPORT_COLUMNS.map((column) => (
            <li key={column} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-fg-2">
              {column}
            </li>
          ))}
        </ul>
        {ofYear > 0 ? <ExportYearAction year={year} count={ofYear} /> : <p className="text-[13px] text-fg-3">Aún no hay hojas este año.</p>}
      </section>
    </div>
  );
}

function SettingsAction({ overview }: { overview: ClaimsOverview }) {
  const { settings } = overview;
  return (
    <PanelAction<StepResult>
      label="Editar parámetros"
      icon={<Settings2 size={16} />}
      size="sm"
      formId="claim-book-settings"
      title="Parámetros del libro"
      description="El nuevo plazo se aplica a las hojas que se registren desde ahora; las anteriores conservan su vencimiento."
      submitLabel="Guardar"
      action={saveClaimSettings}
      initial={initial}
    >
      {() => (
        <>
          <TextField label="Plazo de respuesta (días hábiles)" name="response_days" type="number" min={1} max={30} required defaultValue={settings.response_days} hint="Valida el plazo vigente con asesoría legal." />
          <TextField label="Alerta previa (días hábiles)" name="alert_days" type="number" min={0} max={10} required defaultValue={settings.alert_days} />
          <TextField label="Conservación (años)" name="retention_years" type="number" min={2} max={20} required defaultValue={settings.retention_years} />
        </>
      )}
    </PanelAction>
  );
}

export function ClaimSettings({ overview }: { overview: ClaimsOverview }) {
  const { settings } = overview;
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="lift rounded-tile border border-line p-4">
        <TintCardTitle icon={Settings2} title="Parámetros del libro" aside={overview.can.settings ? <SettingsAction overview={overview} /> : undefined} />
        <FieldList
          fields={[
            { label: "Plazo de respuesta", value: `${settings.response_days} días hábiles` },
            { label: "Alerta previa", value: settings.alert_days === 0 ? "Sin alerta" : `${settings.alert_days} días hábiles antes` },
            { label: "Conservación", value: `${settings.retention_years} años` },
          ]}
        />
        {!overview.can.settings && <p className="mt-3 text-[12.5px] text-fg-3">Solo el administrador de la agencia cambia estos parámetros.</p>}
      </section>
      <section className="lift rounded-tile border border-line p-4">
        <TintCardTitle icon={Hash} title="Correlativos por sede" tone="t3" />
        <ul className="flex flex-col gap-2">
          {overview.sequences.map((item) => (
            <li key={item.sede} className="lift flex items-center gap-3 rounded-tile border border-line px-3.5 py-2.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-surface-2 text-fg-2">
                <Building2 size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{item.sede}</b>
                <span className="block text-[12px] text-fg-3">
                  Siguiente <span className="font-mono text-fg-2">{item.next}</span>
                </span>
              </span>
              <span className="flex-none text-right text-[12px] text-fg-3">{plural(item.year_count, "hoja", "hojas")} este año</span>
            </li>
          ))}
        </ul>
      </section>
      <ClaimHolidays overview={overview} />
    </div>
  );
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function HolidayForm({ overview, holiday }: { overview: ClaimsOverview; holiday?: ClaimHoliday }) {
  return (
    <PanelAction<StepResult>
      label={holiday ? "Editar" : "Agregar feriado"}
      formId={`claim-holiday-${holiday?.date ?? "new"}`}
      title={holiday ? "Editar feriado" : "Agregar feriado"}
      description="Los días feriados no cuentan para el plazo legal de respuesta ni para la alerta previa."
      submitLabel="Guardar"
      action={claimHolidayStep}
      initial={initial}
      trigger={holiday ? (open) => <RowIcon tone="edit" label={`Editar ${holiday.name}`} icon={<Pencil size={15} />} onClick={open} /> : (open) => <Button size="sm" icon={<Plus size={15} />} onClick={open}>Agregar feriado</Button>}
    >
      {() => (
        <>
          <HiddenFields values={{ step: "save", original: holiday?.date, current: JSON.stringify(overview.holidays) }} />
          <TextField label="Fecha" name="date" type="date" required defaultValue={holiday?.date} />
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={holiday?.name} placeholder="Día de la Independencia" />
        </>
      )}
    </PanelAction>
  );
}

function RemoveHoliday({ overview, holiday }: { overview: ClaimsOverview; holiday: ClaimHoliday }) {
  return (
    <PanelAction<StepResult>
      label="Quitar"
      formId={`claim-holiday-remove-${holiday.date}`}
      title="Quitar feriado"
      description={`${holiday.name} vuelve a contar como día hábil. Las hojas ya registradas conservan su vencimiento.`}
      submitLabel="Quitar"
      action={claimHolidayStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label={`Quitar ${holiday.name}`} icon={<Trash2 size={15} />} onClick={open} />}
    >
      {() => <HiddenFields values={{ step: "remove", date: holiday.date, current: JSON.stringify(overview.holidays) }} />}
    </PanelAction>
  );
}

function ClaimHolidays({ overview }: { overview: ClaimsOverview }) {
  const years = [...new Set(overview.holidays.map((holiday) => holiday.date.slice(0, 4)))];
  const upcoming = overview.holidays.filter((holiday) => holiday.date >= overview.today).length;
  return (
    <section className="lift rounded-tile border border-line p-4 xl:col-span-2">
      <TintCardTitle icon={CalendarOff} title="Feriados" tone="t2" aside={overview.can.settings ? <HolidayForm overview={overview} /> : <span className="text-[12px] text-fg-3">{plural(upcoming, "feriado próximo", "feriados próximos")}</span>} />
      <p className="mb-3 text-[12.5px] text-fg-3">El plazo de respuesta cuenta días hábiles: se saltan sábados, domingos y estas fechas.</p>
      {overview.holidays.length === 0 ? (
        <p className="rounded-tile border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Aún no hay feriados registrados para este año.</p>
      ) : (
        years.map((year) => (
          <div key={year} className="mb-3 last:mb-0">
            <b className="mb-2 block text-[12px] font-semibold text-fg-2">{year}</b>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overview.holidays.filter((holiday) => holiday.date.startsWith(year)).map((holiday) => {
                const day = new Date(`${holiday.date}T12:00:00`);
                const past = holiday.date < overview.today;
                return (
                  <li key={holiday.date} className={`lift flex items-center gap-3 rounded-tile border border-line px-3 py-2 ${past ? "opacity-60" : ""}`}>
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-surface-2 text-center leading-none">
                      <b className="block text-[14px] font-semibold">{day.getDate()}</b>
                      <span className="block text-[10.5px] text-fg-3">{MONTHS[day.getMonth()]}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-semibold">{holiday.name}</b>
                      <span className="block text-[12px] text-fg-3">{WEEKDAYS[day.getDay()]}</span>
                    </span>
                    {overview.can.settings && (
                      <span className="flex flex-none items-center gap-0.5">
                        <HolidayForm overview={overview} holiday={holiday} />
                        <RemoveHoliday overview={overview} holiday={holiday} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

export function ClaimsWorkspace({ overview, section, report }: { overview: ClaimsOverview; section: "sheets" | "reports" | "settings"; report?: ClaimReport | null }) {
  if (section === "reports") return <ClaimReports overview={overview} report={report ?? null} />;
  if (section === "settings") return <ClaimSettings overview={overview} />;
  return <ClaimsTable overview={overview} publicUrl={overview.public_path} />;
}
