"use client";

import { CalendarClock, CheckCircle2, Clock, Download, FileSpreadsheet, FileText, FileType, Mail, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteReportSchedule, toggleReportSchedule } from "@/app/(backoffice)/reportes/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import type { ReportExportsData, ReportSchedule } from "@/lib/reports";

const FORMAT_ICON = { CSV: FileType, XLSX: FileSpreadsheet, PDF: FileText } as const;

const STATUS = { disponible: { label: "Disponible", tone: "ok" }, expirado: { label: "Vencida", tone: "mute" }, fallido: { label: "Falló", tone: "bad" }, en_cola: { label: "En cola", tone: "sun" }, procesando: { label: "Generando", tone: "sun" } } as const;

function size(bytes: number | null): string {
  if (bytes === null) return "—";
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ScheduleActions({ item }: { item: ReportSchedule }) {
  const mode = item.paused ? "resume" : "pause";
  return (
    <RowActions>
      <PanelAction<AdminActionState> label={item.paused ? "Reanudar" : "Pausar"} variant="ghost" size="sm" formId={`schedule-${mode}-${item.code}`} trigger={(open) => <RowIcon tone="neutral" label={item.paused ? "Reanudar envío" : "Pausar envío"} icon={item.paused ? <PlayCircle size={15} /> : <PauseCircle size={15} />} onClick={open} />} title={item.paused ? "Reanudar envío" : "Pausar envío"} description={item.paused ? `${item.title} vuelve a enviarse ${item.label.toLowerCase()}.` : `${item.title} deja de enviarse hasta que lo reanudes. No se pierde la configuración.`} submitLabel={item.paused ? "Reanudar" : "Pausar"} action={toggleReportSchedule} initial={ADMIN_INITIAL}>
        {() => (
          <>
            <input type="hidden" name="code" value={item.code} />
            <input type="hidden" name="mode" value={mode} />
          </>
        )}
      </PanelAction>
      <PanelAction<AdminActionState> label="Eliminar" variant="ghost" size="sm" formId={`schedule-delete-${item.code}`} trigger={(open) => <RowIcon tone="delete" label="Eliminar envío" icon={<Trash2 size={15} />} onClick={open} />} title="Eliminar envío programado" description={`${item.title} deja de enviarse a ${item.recipients.length} ${item.recipients.length === 1 ? "destinatario" : "destinatarios"}. Las exportaciones ya generadas se conservan.`} submitLabel="Eliminar" action={deleteReportSchedule} initial={ADMIN_INITIAL}>
        {() => <input type="hidden" name="code" value={item.code} />}
      </PanelAction>
    </RowActions>
  );
}

export function ExportsView({ data }: { data: ReportExportsData }) {
  const available = data.exports.filter((item) => item.status === "disponible").length;
  return (
    <div className="flex flex-col gap-5">
      <KpiGrid columns={3}>
        <TintTile icon={CheckCircle2} tone="ok" label="Listas para descargar" value={available} note={`De ${data.exports.length} recientes`} info={<p>Exportaciones generadas por ti en los últimos días que siguen disponibles. Cada archivo se guarda 7 días.</p>} />
        <TintTile icon={CalendarClock} tone="t1" label="Envíos programados" value={data.schedules.length} note={`${data.schedules.filter((item) => item.paused).length} en pausa`} info={<p>Reportes que se generan y se envían por correo con la frecuencia elegida. Se pausan, reanudan o eliminan desde cada tarjeta.</p>} />
        <TintTile icon={Mail} tone="violet" label="Destinatarios" value={new Set(data.schedules.flatMap((item) => item.recipients)).size} note="Correos distintos" info={<p>Correos únicos que reciben al menos un envío programado.</p>} />
      </KpiGrid>

      <Card>
        <TintCardTitle icon={Download} title="Exportaciones recientes" aside="Últimas 15" />
        {data.exports.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-3">Aún no exportas reportes. Abre uno y usa «Exportar».</p>
        ) : (
          <ul className="flex flex-col">
            {data.exports.map((item, index) => {
              const Icon = FORMAT_ICON[item.format] ?? FileText;
              const status = STATUS[item.status] ?? STATUS.fallido;
              return (
                <li key={item.id} style={{ animationDelay: `${index * 40}ms` }} className="group flex flex-wrap items-center gap-3 border-t border-line-2 px-1 py-3 first:border-t-0 animate-[rise-in_360ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-accent/10 text-accent transition-transform group-hover:scale-105">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px]">{item.name}</b>
                    <span className="text-[12px] text-fg-3">
                      <span className="font-mono">{item.code}</span> · {item.format} · {item.rows ?? 0} filas · {size(item.size)} · {formatDateTime(item.created_at)}
                      {item.scheduled ? " · envío programado" : ""}
                    </span>
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {item.status === "disponible" ? (
                    <a href={`/reportes/exportaciones/${item.id}/descargar`} className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-[12.5px] font-semibold text-white transition hover:brightness-110">
                      <Download size={14} />
                      Descargar
                    </a>
                  ) : (
                    <span className="inline-flex h-8 items-center px-3 text-[12px] text-fg-3">{item.expires_at ? `Venció el ${formatDate(item.expires_at)}` : "No disponible"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <TintCardTitle icon={CalendarClock} title="Envíos programados" aside={<Link href="/admin/integraciones/procesos" className="text-[12.5px] font-semibold text-accent hover:underline">Ver todos los procesos</Link>} />
        {data.schedules.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-3">No hay envíos programados. Desde un reporte usa «Programar envío».</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.schedules.map((item) => (
              <div key={item.code} className={cn("lift rounded-tile border border-line-2 p-4", item.paused && "opacity-70")}>
                <div className="flex items-start justify-between gap-3">
                  <span>
                    <b className="block text-[14px]">{item.title}</b>
                    <span className="font-mono text-[11.5px] text-fg-3">{item.code}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {item.paused ? (
                      <Badge tone="mute">
                        <PauseCircle size={12} /> En pausa
                      </Badge>
                    ) : (
                      <Badge tone="ok">Activo</Badge>
                    )}
                    <ScheduleActions item={item} />
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-fg-3">Cuándo</dt>
                  <dd className="flex items-center gap-1.5">
                    <Clock size={13} className="text-fg-3" />
                    {item.label}
                  </dd>
                  <dt className="text-fg-3">Formato</dt>
                  <dd>
                    {item.format}
                    {item.period ? ` · ${item.period.toLowerCase()}` : ""}
                  </dd>
                  <dt className="text-fg-3">Para</dt>
                  <dd className="flex items-center gap-1">
                    {item.recipients[0]}
                    {item.recipients.length > 1 && (
                      <span className="flex items-center gap-1 text-fg-3">
                        y {item.recipients.length - 1} más
                        <InfoTip label="Todos los destinatarios">
                          <ul className="grid gap-1">
                            {item.recipients.map((email) => (
                              <li key={email}>{email}</li>
                            ))}
                          </ul>
                        </InfoTip>
                      </span>
                    )}
                  </dd>
                  <dt className="text-fg-3">Último envío</dt>
                  <dd>{item.last_run_at ? `${formatDateTime(item.last_run_at)}${item.last_status === "error" ? " · con error" : ""}` : "Aún no se envía"}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
