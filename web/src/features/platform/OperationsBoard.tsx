"use client";

import { AlertTriangle, Bell, Building2, CircleCheck, CirclePause, CirclePlay, Clock, Cog, FileText, Gauge, Layers, Play, Plug, RefreshCw, ServerCog, Wrench, XCircle, type LucideIcon } from "lucide-react";
import { pausePlatformJob, runPlatformJob } from "@/app/plataforma/(consola)/integraciones/actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { formatDateTime } from "@/lib/format";
import type { AgencyJobs, IntegrationError, OperationsOverview, PlatformJob, QueueStat } from "@/lib/platformBilling";
import type { Tone } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

const QUEUE_ICON: Record<string, LucideIcon> = { critical: Gauge, default: Cog, notifications: Bell, documents: FileText, integrations: Plug, reports: Layers, low: Wrench };

const RUN_TONE: Record<string, Tone> = { ok: "ok", advertencia: "warn", error: "bad", en_curso: "info" };

const SOURCE: Record<IntegrationError["source"], string> = { job: "Tarea", notification: "Notificación", integration: "Integración" };

export function OperationsKpis({ overview }: { overview: OperationsOverview }) {
  const flagged = overview.jobs.filter((job) => job.last_status === "error" || job.last_status === "advertencia").length;
  const pending = overview.queues.reduce((sum, queue) => sum + queue.pending, 0);
  const failed = overview.queues.reduce((sum, queue) => sum + queue.failed, 0);
  const open = overview.errors.filter((error) => error.status !== "resuelto").length;

  return (
    <section aria-label="Resumen" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TintTile icon={ServerCog} tone="t1" label="Tareas de plataforma" value={overview.jobs.length} note={`${overview.jobs.filter((job) => job.paused).length} pausadas`} />
      <TintTile icon={AlertTriangle} tone={flagged ? "warn" : "ok"} label="Con aviso en su última corrida" value={flagged} />
      <TintTile icon={Layers} tone={failed ? "bad" : "violet"} label="Trabajos en cola" value={pending} note={`${failed} fallidos`} />
      <TintTile icon={Plug} tone={open ? "bad" : "ok"} label="Errores abiertos en agencias" value={open} />
    </section>
  );
}

export function PlatformJobs({ jobs }: { jobs: PlatformJob[] }) {
  return (
    <section aria-label="Tareas programadas" className="mb-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {jobs.map((job, index) => (
        <JobCard key={job.code} job={job} index={index} />
      ))}
    </section>
  );
}

function JobCard({ job, index }: { job: PlatformJob; index: number }) {
  const tone: Tone = job.paused ? "mute" : RUN_TONE[job.last_status ?? "ok"] ?? "t1";

  return (
    <ToneScope tone={tone}>
      <article className="lift group flex h-full animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-card border border-[color-mix(in_srgb,var(--tint)_24%,transparent)] bg-surface p-4 shadow-card" style={{ animationDelay: `${index * 60}ms` }}>
        <header className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <b className="block text-[14px] font-semibold">{job.name}</b>
            <code className="text-[12px] text-fg-3">{job.command}</code>
          </div>
          {job.paused ? <Badge tone="mute">Pausada</Badge> : job.last_status && <StatusBadge status={job.last_status} />}
        </header>
        {job.description && <p className="mb-3 text-[12.5px] text-fg-2">{job.description}</p>}
        <p className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-3 py-2 text-[12.5px]">{job.last_result ?? "Todavía no corre"}</p>
        <div className="mb-3 flex items-center gap-1.5" aria-label="Últimas corridas">
          {job.runs.map((run) => (
            <span key={run.started_at} title={`${formatDateTime(run.started_at, false)} · ${run.trigger === "manual" ? "manual" : "programada"} · ${run.result ?? ""}${run.duration_ms !== null ? ` · ${(run.duration_ms / 1000).toFixed(1)} s` : ""}`} style={{ background: `var(--${RUN_TONE[run.status] === "ok" ? "ok" : RUN_TONE[run.status] === "warn" ? "warn" : "bad"})` }} className="h-2.5 w-6 rounded-full transition-transform duration-200 hover:scale-y-150" />
          ))}
        </div>
        <dl className="mb-3 grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <dt className="text-fg-3">Horario</dt>
            <dd className="font-medium">{job.cron_label}</dd>
          </div>
          <div>
            <dt className="text-fg-3">Cola</dt>
            <dd className="font-medium">{job.queue}</dd>
          </div>
          <div>
            <dt className="text-fg-3">Última</dt>
            <dd className="font-medium">{job.last_run_at ? formatDateTime(job.last_run_at, false) : "—"}</dd>
          </div>
          <div>
            <dt className="text-fg-3">Próxima</dt>
            <dd className="font-medium">{job.paused ? "En pausa" : job.next_run_at ? formatDateTime(job.next_run_at, false) : "—"}</dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap gap-2">
          {job.runnable && !job.paused && (
            <ConsoleAction id={`run-${job.code}`} label="Ejecutar ahora" icon={<Play size={14} />} size="sm" title={`Ejecutar ${job.name.toLowerCase()}`} description={job.description ?? undefined} submitLabel="Ejecutar" action={runPlatformJob} fields={{ code: job.code }} />
          )}
          <ConsoleAction
            id={`pause-${job.code}`}
            label={job.paused ? "Reanudar" : "Pausar"}
            icon={job.paused ? <CirclePlay size={14} /> : <CirclePause size={14} />}
            size="sm"
            variant="ghost"
            title={job.paused ? `Reanudar ${job.name.toLowerCase()}` : `Pausar ${job.name.toLowerCase()}`}
            description={job.paused ? "Vuelve a correr en su próximo horario." : "Deja de correr en su horario hasta que la reanudes. Úsalo solo ante un incidente."}
            submitLabel={job.paused ? "Reanudar" : "Pausar"}
            action={pausePlatformJob}
            fields={{ code: job.code, paused: job.paused ? "0" : "1" }}
          />
        </div>
      </article>
    </ToneScope>
  );
}

export function QueuesPanel({ queues }: { queues: QueueStat[] }) {
  return (
    <Card>
      <TintCardTitle icon={Layers} title="Colas" aside="Últimos 7 días" tone="violet" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {queues.map((queue, index) => {
          const Icon = QUEUE_ICON[queue.queue] ?? Cog;
          const tone: Tone = queue.failed > 0 || queue.errors > 0 ? "bad" : queue.warnings > 0 ? "warn" : "ok";
          return (
            <ToneScope key={queue.queue} tone={tone}>
              <li className="lift group flex items-center gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--tint)_20%,transparent)] px-3 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[13px] font-semibold">{queue.label}</b>
                  <code className="text-[11.5px] text-fg-3">{queue.queue}</code>
                </span>
                <span className="text-right text-[11.5px] text-fg-3">
                  <b className="block text-[13px] text-fg">{queue.pending} en cola</b>
                  {queue.runs} corridas · {queue.errors + queue.failed} con error
                </span>
              </li>
            </ToneScope>
          );
        })}
      </ul>
    </Card>
  );
}

export function AgencyJobsPanel({ agencies }: { agencies: AgencyJobs[] }) {
  return (
    <Card>
      <TintCardTitle icon={Building2} title="Tareas de las agencias" aside={`${agencies.length} con tareas`} tone="t4" />
      {agencies.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">Ninguna agencia tiene tareas programadas todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {agencies.map((agency, index) => (
            <li key={agency.name} className="lift flex items-center gap-3 rounded-[12px] bg-surface-2/60 px-3 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{agency.name}</b>
                <span className="text-[12px] text-fg-3">
                  {agency.jobs} tareas{agency.paused ? ` · ${agency.paused} pausadas` : ""}
                  {agency.last_run_at ? ` · última el ${formatDateTime(agency.last_run_at, false)}` : ""}
                </span>
              </span>
              {agency.errors > 0 && <Badge tone="bad">{agency.errors} con error</Badge>}
              {agency.warnings > 0 && <Badge tone="warn">{agency.warnings} con aviso</Badge>}
              {agency.open_errors > 0 && <Badge tone="info">{agency.open_errors} fallas abiertas</Badge>}
              {agency.errors + agency.warnings + agency.open_errors === 0 && <Badge tone="ok">Sin incidencias</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const errorColumns: Column<IntegrationError>[] = [
  {
    id: "target",
    header: "Destino",
    mobile: "title",
    cell: (error) => (
      <div className="min-w-0">
        <b className="block text-[13.5px] font-semibold">{error.target}</b>
        <small className="block text-xs text-fg-3">
          {error.tenant ?? "Plataforma"} · {SOURCE[error.source]} {error.ref}
        </small>
      </div>
    ),
  },
  { id: "error", header: "Error", cell: (error) => <span className="text-[13px] text-fg-2">{error.error}</span> },
  { id: "class", header: "Tipo", wideOnly: true, cell: (error) => <Badge tone={error.class === "permanente" ? "bad" : "info"} dot={false}>{error.class === "permanente" ? "Permanente" : "Transitorio"}</Badge> },
  { id: "attempt", header: "Intentos", align: "right", wideOnly: true, cell: (error) => <span className="font-mono text-[13px]">{error.attempt}/{error.max_attempts}</span> },
  {
    id: "status",
    header: "Estado",
    cell: (error) => (
      <span className="flex flex-col items-start gap-1">
        <Badge tone={error.status === "resuelto" ? "ok" : error.status === "fallo_definitivo" ? "bad" : "warn"}>{error.status === "resuelto" ? "Resuelto" : error.status === "fallo_definitivo" ? "Falla definitiva" : "Reintentando"}</Badge>
        {error.next_retry_at && <small className="text-[11.5px] text-fg-3">Próximo: {formatDateTime(error.next_retry_at, false)}</small>}
      </span>
    ),
  },
  { id: "at", header: "Fecha", wideOnly: true, cell: (error) => <span className="text-[12.5px] text-fg-3">{formatDateTime(error.at, false)}</span> },
];

const errorMetrics: MetricFilter<IntegrationError>[] = [
  { id: "retrying", label: "Reintentando", tone: "warn", icon: <RefreshCw size={19} />, matches: (error) => error.status === "reintentando" },
  { id: "failed", label: "Falla definitiva", tone: "bad", icon: <XCircle size={19} />, matches: (error) => error.status === "fallo_definitivo" },
  { id: "resolved", label: "Resueltos", tone: "ok", icon: <CircleCheck size={19} />, matches: (error) => error.status === "resuelto" },
];

const errorSorts: SortOption<IntegrationError>[] = [{ id: "at", label: "Fecha", type: "date", value: (error) => error.at }];

export function ErrorsTable({ errors }: { errors: IntegrationError[] }) {
  const filters: FilterConfig<IntegrationError>[] = [
    { id: "tenant", label: "Agencia", options: [...new Set(errors.map((error) => error.tenant ?? "Plataforma"))].map((value) => ({ value, label: value })), value: (error) => error.tenant ?? "Plataforma" },
    { id: "source", label: "Origen", options: Object.entries(SOURCE).map(([value, label]) => ({ value, label })), value: (error) => error.source },
  ];

  return (
    <Card padded={false} className="p-4">
      <TintCardTitle icon={Clock} title="Errores de integraciones y tareas" aside={String(errors.length)} tone="bad" />
      <DataTable screen="plataforma-errores" rows={errors} columns={errorColumns} getKey={(error) => error.id} entityLabel="errores" searchText={(error) => `${error.target} ${error.error} ${error.tenant ?? ""} ${error.ref}`} searchPlaceholder="Buscar destino o error" metrics={errorMetrics} filters={filters} sorts={errorSorts} />
    </Card>
  );
}

