"use client";

import { AlertOctagon, CheckCircle2, CircleDashed, CreditCard, FileCheck2, Globe2, Mail, MapPinned, MessageCircle, Pause, Play, Plug, PlugZap, RefreshCw, Settings2, ShieldCheck, Truck, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { configureAdapter, resolveIntegrationError, retryIntegrationError, runJob, setJobStatus, testAdapter, type ConnectionTestState } from "@/app/(backoffice)/admin/integraciones/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ToneScope } from "@/components/ui/Tinted";
import { ADMIN_INITIAL, type Adapter, type AdminActionState, type ConnectionTestLog, type IntegrationError, type IntegrationsOverview, type ScheduledJob } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { RISE } from "./AdminParts";

const KIND_ICONS: Record<string, typeof Plug> = { fiscal: FileCheck2, payments: CreditCard, email: Mail, messaging: MessageCircle, maps: MapPinned, suppliers: Truck, distribution: Globe2 };
const ADAPTER_TONES: Record<string, Tone> = { activo: "ok", sandbox: "sun", parcial: "t1", por_validar: "warn", futuro: "mute" };
const JOB_STATUS: Record<string, { label: string; tone: Tone }> = { ok: { label: "Correcto", tone: "ok" }, advertencia: { label: "Con avisos", tone: "warn" }, error: { label: "Con error", tone: "bad" }, en_curso: { label: "En curso", tone: "info" } };
const ERROR_STATUS: Record<IntegrationError["status"], { label: string; tone: Tone }> = { reintentando: { label: "Reintentando", tone: "sun" }, fallo_definitivo: { label: "Fallo definitivo", tone: "bad" }, resuelto: { label: "Resuelto", tone: "ok" } };
const SOURCES: Record<IntegrationError["source"], string> = { job: "Proceso", notification: "Aviso", integration: "Integración" };

const TEST_INITIAL: ConnectionTestState = { message: null, done: false, log: null };

const STEP_TONE: Record<ConnectionTestLog["steps"][number]["status"], string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-fg-3" };

const STEP_MARK: Record<ConnectionTestLog["steps"][number]["status"], string> = { ok: "✓", warn: "!", bad: "×", info: "→" };

function ConnectionLog({ log, ok, result }: { log: ConnectionTestLog; ok: boolean; result: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold", ok ? "bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-warn")}>
        {ok ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}
        {result ?? (ok ? "Conexión correcta" : "La prueba no pasó")}
      </p>
      <ol className="flex flex-col gap-1 rounded-[12px] bg-surface-2 p-3 font-mono text-[12px]">
        <li className="text-fg-3">
          [{formatDateTime(log.at)}] correlación {log.correlation_id}
        </li>
        {log.steps.map((step, index) => (
          <li key={index} className={cn("flex items-start justify-between gap-3", STEP_TONE[step.status])}>
            <span>
              {STEP_MARK[step.status]} {step.label}
            </span>
            {step.ms !== null && <span className="flex-none text-fg-3">{step.ms} ms</span>}
          </li>
        ))}
      </ol>
      <p className="text-[12px] text-fg-3">
        Duró {log.duration_ms} ms de un máximo de {log.timeout_s} s.
      </p>
    </div>
  );
}

function AdapterCard({ adapter, data, index }: { adapter: Adapter; data: IntegrationsOverview; index: number }) {
  const Icon = KIND_ICONS[adapter.kind] ?? Plug;
  const tone = ADAPTER_TONES[adapter.status] ?? "mute";
  return (
    <ToneScope tone={tone}>
      <article style={{ animationDelay: `${index * 55}ms` }} className={cn("lift group flex h-full flex-col rounded-card border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-surface p-4 shadow-card", RISE)}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug">{adapter.name}</p>
            <p className="text-[12px] text-fg-3">
              <span className="font-mono">{adapter.code}</span> · {adapter.kind_label}
            </p>
          </div>
          <Badge tone={tone}>{adapter.status_label}</Badge>
        </div>
        {adapter.note && <p className="mt-2.5 text-[12.5px] text-fg-2">{adapter.note}</p>}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <div className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <dt className="text-fg-3">Entorno</dt>
            <dd className="font-semibold">{adapter.environment === "production" ? "Producción" : "Pruebas"}</dd>
          </div>
          <div className="rounded-[10px] bg-surface-2 px-2.5 py-1.5" title={`Espera base ${adapter.backoff} s, se duplica en cada intento`}>
            <dt className="text-fg-3">Reintentos</dt>
            <dd className="font-semibold">{adapter.max_retries} · {adapter.backoff} s</dd>
          </div>
          <div className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <dt className="text-fg-3">Espera</dt>
            <dd className="font-semibold">{adapter.timeout} s</dd>
          </div>
        </dl>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-3">
          <span>Responsable: {adapter.owner?.name ?? "sin asignar"}</span>
          <span className="flex items-center gap-1">
            <ShieldCheck size={13} className={adapter.has_secret ? "text-ok" : "text-fg-3"} />
            {adapter.has_secret ? "Credenciales en bóveda" : "Sin credenciales"}
          </span>
          {adapter.open_errors > 0 && <span className="font-semibold text-bad">{adapter.open_errors} errores abiertos</span>}
        </div>
        {adapter.last_test && (
          <p className={cn("mt-2 flex items-start gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px]", adapter.last_test.ok ? "bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-warn")}>
            {adapter.last_test.ok ? <CheckCircle2 size={14} className="mt-px flex-none" /> : <CircleDashed size={14} className="mt-px flex-none" />}
            <span>
              {adapter.last_test.result} <span className="text-fg-3">· {formatDateTime(adapter.last_test.at, false)}</span>
            </span>
          </p>
        )}
        {data.can_manage && (
          <div className="mt-auto flex justify-end gap-1.5 border-t border-line-2 pt-3">
            <PanelAction<ConnectionTestState> label="Probar" variant="ghost" size="sm" formId={`adapter-test-${adapter.code}`} trigger={(open) => <RowIcon tone="view" label="Probar conexión" icon={<PlugZap size={15} />} onClick={open} />} title={`Probar conexión · ${adapter.name}`} description={["por_validar", "futuro"].includes(adapter.status) ? "Esta integración aún no tiene proveedor: la prueba no envía credenciales." : "Llamamos al adaptador y te mostramos cada paso. El resultado queda en la tarjeta y en la auditoría."} submitLabel="Probar ahora" action={testAdapter} initial={TEST_INITIAL}>
              {(state) => (
                <>
                  <input type="hidden" name="code" value={adapter.code} />
                  {state.log && <ConnectionLog log={state.log} ok={state.ok ?? false} result={state.result ?? null} />}
                </>
              )}
            </PanelAction>
            <PanelAction<AdminActionState> label="Configurar" variant="ghost" size="sm" formId={`adapter-config-${adapter.code}`} trigger={(open) => <RowIcon tone="edit" label="Configurar" icon={<Settings2 size={15} />} onClick={open} />} title={adapter.name} description="Las credenciales viven en la bóveda y nunca se muestran. Solo pasan a producción las integraciones validadas." submitLabel="Guardar" action={configureAdapter} initial={ADMIN_INITIAL}>
              {() => (
                <>
                  <input type="hidden" name="code" value={adapter.code} />
                  <ChoiceGroup label="Entorno" name="environment" options={[{ value: "sandbox", label: "Pruebas" }, { value: "production", label: "Producción" }]} defaultValue={adapter.environment} />
                  <SelectField label="Responsable" name="owner_user_id" options={data.owners} defaultValue={adapter.owner?.id ?? ""} placeholder="Sin responsable" />
                  <div className="grid grid-cols-3 gap-3">
                    <TextField label="Reintentos" name="max_retries" type="number" min={0} max={10} required defaultValue={adapter.max_retries} />
                    <TextField label="Espera base (s)" name="backoff_base_s" type="number" min={5} max={3600} required defaultValue={adapter.backoff} />
                    <TextField label="Tiempo máx. (s)" name="timeout_s" type="number" min={5} max={120} required defaultValue={adapter.timeout} />
                  </div>
                  <p className="text-[12px] text-fg-3">La espera entre reintentos se duplica en cada intento: base × 2^intento, con una variación de ±20 %.</p>
                </>
              )}
            </PanelAction>
          </div>
        )}
      </article>
    </ToneScope>
  );
}

export function AdaptersGrid({ data }: { data: IntegrationsOverview }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.adapters.map((adapter, index) => (
        <AdapterCard key={adapter.code} adapter={adapter} data={data} index={index} />
      ))}
    </div>
  );
}

function JobRuns({ job }: { job: ScheduledJob }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="view" label="Ver ejecuciones" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={job.name} description={`${job.code} · ${job.cron_label} · cola ${job.queue_label.toLowerCase()}`}>
        <ol className="flex flex-col gap-2">
          {job.runs.length === 0 && <li className="text-[13px] text-fg-3">Aún no hay ejecuciones registradas.</li>}
          {job.runs.map((run) => (
            <li key={run.at} className="flex items-start gap-3 rounded-[12px] border border-line px-3 py-2.5 text-[13px]">
              <Badge tone={JOB_STATUS[run.status]?.tone ?? "mute"}>{JOB_STATUS[run.status]?.label ?? run.status}</Badge>
              <div className="min-w-0 flex-1">
                <p>{run.result ?? "Sin detalle"}</p>
                <p className="text-[11.5px] text-fg-3">
                  {formatDateTime(run.at)} · {run.trigger === "manual" ? "manual" : run.trigger === "retry" ? "reintento" : "programado"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </SidePanel>
    </>
  );
}

export function JobsTable({ data }: { data: IntegrationsOverview }) {
  const columns: Column<ScheduledJob>[] = [
    {
      id: "job",
      header: "Proceso",
      mobile: "title",
      cell: (job) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{job.name}</p>
          <p className="text-[11.5px] text-fg-3">
            <span className="font-mono">{job.code}</span> · {job.cron_label}
          </p>
        </div>
      ),
    },
    { id: "queue", header: "Cola", wideOnly: true, cell: (job) => <span className="text-[12.5px] text-fg-2">{job.queue_label}</span> },
    {
      id: "last",
      header: "Última ejecución",
      cell: (job) => (
        <span className="flex max-w-[300px] flex-col items-start gap-0.5">
          {job.status && <Badge tone={JOB_STATUS[job.status]?.tone ?? "mute"}>{JOB_STATUS[job.status]?.label ?? job.status}</Badge>}
          <span className="truncate text-[11.5px] text-fg-3" title={job.result ?? undefined}>
            {job.result ?? "—"}
          </span>
        </span>
      ),
    },
    { id: "next", header: "Próxima", cell: (job) => (job.paused ? <Badge tone="mute">En pausa</Badge> : <span className="text-[12.5px] text-fg-2">{job.next_run_at ? formatDateTime(job.next_run_at, false) : "—"}</span>) },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (job) => (
        <RowActions>
          <JobRuns job={job} />
          {data.can_manage && !job.paused && job.status !== "en_curso" && (
            <PanelAction<AdminActionState> label="Ejecutar ahora" variant="ghost" size="sm" formId={`job-run-${job.code}`} trigger={(open) => <RowIcon tone="neutral" label="Ejecutar ahora" icon={<Zap size={15} />} onClick={open} />} title="Ejecutar ahora" description="Se encola una ejecución manual sin cambiar su programación. Si ya está en curso, espera a que termine." submitLabel="Ejecutar" action={runJob} initial={ADMIN_INITIAL}>
              {() => <input type="hidden" name="code" value={job.code} />}
            </PanelAction>
          )}
          {data.can_manage && (
            <PanelAction<AdminActionState>
              label={job.paused ? "Reanudar" : "Pausar"}
              variant="ghost"
              size="sm"
              formId={`job-${job.code}`}
              trigger={(open) => <RowIcon tone="neutral" label={job.paused ? "Reanudar" : "Pausar"} icon={job.paused ? <Play size={15} /> : <Pause size={15} />} onClick={open} />}
              title={job.paused ? "Reanudar proceso" : "Pausar proceso"}
              description={job.paused ? "Se calcula la próxima ejecución según su programación." : "No se ejecutará hasta que lo reanudes. Lo que ya está en curso termina."}
              submitLabel={job.paused ? "Reanudar" : "Pausar"}
              action={setJobStatus}
              initial={ADMIN_INITIAL}
            >
              {() => (
                <>
                  <input type="hidden" name="code" value={job.code} />
                  <input type="hidden" name="mode" value={job.paused ? "resume" : "pause"} />
                </>
              )}
            </PanelAction>
          )}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ScheduledJob>[] = [
    { id: "ok", label: "Sin problemas", tone: "ok", icon: <CheckCircle2 size={19} />, matches: (job) => job.status === "ok" && !job.paused },
    { id: "warn", label: "Con avisos o error", tone: "bad", icon: <AlertOctagon size={19} />, matches: (job) => job.status === "advertencia" || job.status === "error" },
    { id: "paused", label: "En pausa", tone: "mute", icon: <Pause size={19} />, matches: (job) => job.paused },
  ];
  const filters: FilterConfig<ScheduledJob>[] = [{ id: "queue", label: "Cola", options: [...new Map(data.jobs.map((job) => [job.queue, job.queue_label])).entries()].map(([value, label]) => ({ value, label })), value: (job) => job.queue }];
  const sorts: SortOption<ScheduledJob>[] = [
    { id: "next", label: "Próxima ejecución", type: "date", value: (job) => job.next_run_at },
    { id: "last", label: "Última ejecución", type: "date", value: (job) => job.last_run_at },
  ];
  const csv = {
    fileName: "procesos-programados",
    columns: [
      { header: "Código", value: (job: ScheduledJob) => job.code },
      { header: "Proceso", value: (job: ScheduledJob) => job.name },
      { header: "Programación", value: (job: ScheduledJob) => job.cron_label },
      { header: "Cola", value: (job: ScheduledJob) => job.queue_label },
      { header: "En pausa", value: (job: ScheduledJob) => job.paused },
      { header: "Última ejecución", value: (job: ScheduledJob) => job.last_run_at, type: "datetime" as const },
      { header: "Estado", value: (job: ScheduledJob) => (job.status ? (JOB_STATUS[job.status]?.label ?? job.status) : "") },
      { header: "Resultado", value: (job: ScheduledJob) => job.result },
      { header: "Próxima ejecución", value: (job: ScheduledJob) => job.next_run_at, type: "datetime" as const },
    ],
  };
  return <DataTable screen="admin-jobs" rows={data.jobs} columns={columns} getKey={(job) => job.code} entityLabel="procesos" searchText={(job) => `${job.code} ${job.name} ${job.result ?? ""}`} searchPlaceholder="Buscar proceso" metrics={metrics} filters={filters} sorts={sorts} csv={csv} />;
}

const waitLabel = (seconds: number) => (seconds < 60 ? `${seconds} s` : seconds % 60 === 0 ? `${seconds / 60} min` : `${(seconds / 60).toFixed(1)} min`);

export function SchedulerCard({ scheduler }: { scheduler: NonNullable<IntegrationsOverview["scheduler"]> }) {
  const items = [
    { label: "En curso o en cola", value: String(scheduler.queued), note: scheduler.oldest_queued_at ? `Desde ${formatDateTime(scheduler.oldest_queued_at, false)}` : "Nada pendiente", tip: "Ejecuciones de tu agencia que ya se encolaron y aún no terminan." },
    { label: "Workers", value: scheduler.workers === null ? "Sin datos" : `${scheduler.workers} activos`, note: "Compartidos por la plataforma", tip: "Procesos que atienden las colas en este momento, según el supervisor de colas." },
    { label: "Zona horaria", value: scheduler.timezone.replace("America/", "").replace("_", " "), note: scheduler.next_run_at ? `Próxima: ${formatDateTime(scheduler.next_run_at, false)}` : "Sin próximas ejecuciones", tip: "Las programaciones se calculan con la zona horaria de la agencia." },
    { label: "En pausa", value: String(scheduler.paused), note: "No se ejecutan hasta reanudarlos", tip: "Procesos programados que alguien pausó." },
  ];
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {items.map((item, index) => (
          <div key={item.label} style={{ animationDelay: `${index * 50}ms` }} title={item.tip} className={cn("lift rounded-tile border border-line-2 bg-surface px-3.5 py-3", RISE)}>
            <p className="text-[11.5px] font-semibold text-fg-3">{item.label}</p>
            <p className="truncate text-[17px] font-bold">{item.value}</p>
            <p className="truncate text-[11.5px] text-fg-3">{item.note}</p>
          </div>
        ))}
      </div>
      <div className="rounded-tile border border-line-2 bg-surface px-3.5 py-3">
        <p className="mb-2 text-[12.5px] font-semibold text-fg-2">Política de reintentos</p>
        <ol className="flex flex-col gap-1.5">
          {scheduler.policy.steps.map((step) => {
            const max = scheduler.policy.steps.at(-1)?.seconds ?? step.seconds;
            return (
              <li key={step.attempt} className="group grid grid-cols-[74px_1fr_86px] items-center gap-2 text-[12px]">
                <span className="text-fg-2">Intento {step.attempt}</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full origin-left rounded-full bg-[var(--t1)] transition-[filter] group-hover:brightness-125 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.max(6, (step.seconds / max) * 100)}%` }} />
                </span>
                <span className="text-right font-mono text-fg-3">
                  {waitLabel(step.seconds)} ±{scheduler.policy.jitter_pct} %
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[11.5px] text-fg-3">Tras el último intento queda como fallo definitivo y se avisa al responsable. Cada integración puede ajustar su espera base en Configurar.</p>
      </div>
    </div>
  );
}

export function ErrorsTable({ data }: { data: IntegrationsOverview }) {
  const columns: Column<IntegrationError>[] = [
    {
      id: "error",
      header: "Error",
      mobile: "title",
      cell: (error) => (
        <div className="min-w-0 max-w-[380px]">
          <p className="truncate text-[13.5px] font-semibold" title={error.error}>
            {error.error}
          </p>
          <p className="text-[11.5px] text-fg-3">
            <span className="font-mono">{error.code}</span> · {SOURCES[error.source]} {error.ref} · {error.target}
          </p>
        </div>
      ),
    },
    { id: "class", header: "Tipo", cell: (error) => <Badge tone={error.class === "permanente" ? "violet" : "t1"}>{error.class === "permanente" ? "Permanente" : "Temporal"}</Badge> },
    { id: "attempts", header: "Intentos", align: "right", wideOnly: true, cell: (error) => <span className="font-mono text-[12.5px]">{error.attempt} / {error.max}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (error) => (
        <span className="flex flex-col items-start gap-0.5">
          <Badge tone={ERROR_STATUS[error.status].tone}>{ERROR_STATUS[error.status].label}</Badge>
          {error.resolution && (
            <span className="max-w-[220px] truncate text-[11px] text-fg-3" title={error.resolution}>
              {error.resolution}
            </span>
          )}
        </span>
      ),
    },
    { id: "at", header: "Fecha", wideOnly: true, cell: (error) => <span className="text-[12.5px] text-fg-3">{formatDateTime(error.at, false)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (error) =>
        data.can_manage && error.status !== "resuelto" ? (
          <RowActions>
            {error.class === "permanente" ? (
              <RowIcon tone="neutral" label="Reintentar" icon={<RefreshCw size={15} />} disabledHint="Error permanente: reintentar no cambia el resultado." />
            ) : (
              <PanelAction<AdminActionState> label="Reintentar" variant="ghost" size="sm" formId={`err-retry-${error.code}`} trigger={(open) => <RowIcon tone="neutral" label="Reintentar" icon={<RefreshCw size={15} />} onClick={open} />} title="Reintentar" description="Se reinicia el contador y se reintenta en un minuto con espera creciente." submitLabel="Reintentar" action={retryIntegrationError} initial={ADMIN_INITIAL}>
                {() => <input type="hidden" name="code" value={error.code} />}
              </PanelAction>
            )}
            <PanelAction<AdminActionState> label="Resolver" variant="ghost" size="sm" formId={`err-resolve-${error.code}`} trigger={(open) => <RowIcon tone="edit" label="Marcar como resuelto" icon={<CheckCircle2 size={15} />} onClick={open} />} title="Marcar como resuelto" description={error.error} submitLabel="Marcar resuelto" action={resolveIntegrationError} initial={ADMIN_INITIAL}>
              {() => (
                <>
                  <input type="hidden" name="code" value={error.code} />
                  <TextArea label="Cómo se resolvió" name="resolution" rows={3} required minLength={5} placeholder="Ej.: el cliente corrigió su número de WhatsApp y se le avisó por correo." />
                </>
              )}
            </PanelAction>
          </RowActions>
        ) : null,
    },
  ];
  const metrics: MetricFilter<IntegrationError>[] = [
    { id: "retrying", label: "Reintentando", tone: "sun", icon: <RefreshCw size={19} />, matches: (error) => error.status === "reintentando" },
    { id: "final", label: "Fallo definitivo", tone: "bad", icon: <XCircle size={19} />, matches: (error) => error.status === "fallo_definitivo" },
    { id: "resolved", label: "Resueltos", tone: "ok", icon: <CheckCircle2 size={19} />, matches: (error) => error.status === "resuelto" },
  ];
  const filters: FilterConfig<IntegrationError>[] = [
    { id: "source", label: "Origen", options: Object.entries(SOURCES).map(([value, label]) => ({ value, label })), value: (error) => error.source },
    { id: "class", label: "Tipo", options: [{ value: "transitorio", label: "Temporal" }, { value: "permanente", label: "Permanente" }], value: (error) => error.class },
  ];
  const sorts: SortOption<IntegrationError>[] = [{ id: "at", label: "Fecha", type: "date", value: (error) => error.at }];
  const csv = {
    fileName: "errores-de-integracion",
    columns: [
      { header: "Código", value: (error: IntegrationError) => error.code },
      { header: "Fecha", value: (error: IntegrationError) => error.at, type: "datetime" as const },
      { header: "Origen", value: (error: IntegrationError) => `${SOURCES[error.source]} ${error.ref}` },
      { header: "Destino", value: (error: IntegrationError) => error.target },
      { header: "Error", value: (error: IntegrationError) => error.error },
      { header: "Tipo", value: (error: IntegrationError) => (error.class === "permanente" ? "Permanente" : "Temporal") },
      { header: "Intentos", value: (error: IntegrationError) => `${error.attempt} / ${error.max}` },
      { header: "Estado", value: (error: IntegrationError) => ERROR_STATUS[error.status].label },
      { header: "Resolución", value: (error: IntegrationError) => error.resolution },
    ],
  };
  return <DataTable screen="admin-errores-integracion" rows={data.errors} columns={columns} getKey={(error) => error.code} entityLabel="errores" searchText={(error) => `${error.code} ${error.ref} ${error.target} ${error.error}`} searchPlaceholder="Buscar error" metrics={metrics} filters={filters} sorts={sorts} csv={csv} />;
}
