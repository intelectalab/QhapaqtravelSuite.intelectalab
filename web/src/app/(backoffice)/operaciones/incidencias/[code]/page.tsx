import { Camera, ClipboardList, FileText, History, Siren, Timer, UserRound, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { HeroBand, HeroChip, HeroPanel, Journey, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { EvidenceSection } from "@/features/operations/Evidence";
import { IncidentCommentAction, IncidentFlowActions, SeverityBadge } from "@/features/operations/Incidents";
import { SlaBar } from "@/features/operations/OpsBits";
import { cn } from "@/lib/cn";
import { formatDateTime, shortName } from "@/lib/format";
import { LOG_LABEL, OPEN_INCIDENT, SOURCE_LABEL, type IncidentDetail } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";
import { statusTone } from "@/lib/tone";

const getIncident = cache(async (code: string) => (await getResource<IncidentDetail>(`/ops/incidents/${encodeURIComponent(code)}`, "No pudimos cargar la incidencia.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/operaciones/incidencias/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getIncident(code)).title };
}

const KIND_TONE: Record<string, string> = { alerta: "bg-bad", resolucion: "bg-ok", estado: "bg-accent", reclasificacion: "bg-warn", asignacion: "bg-[var(--violet)]" };

export default async function IncidenciaPage({ params }: PageProps<"/operaciones/incidencias/[code]">) {
  const { code } = await params;
  const incident = await getIncident(code);
  const open = OPEN_INCIDENT.includes(incident.status);
  const workedOn = incident.status === "en_proceso" || incident.logs.some((entry) => entry.kind === "estado" && entry.message.startsWith("En proceso"));
  const resolved = incident.status === "resuelta" || (incident.status === "cerrada" && incident.logs.some((entry) => entry.kind === "resolucion"));
  const closed = incident.status === "cerrada";
  const steps = [
    { label: "Abierta", at: incident.created_at, done: true },
    { label: "En proceso", at: null, done: workedOn, skipped: !workedOn && incident.status !== "abierta" },
    { label: "Resuelta", at: incident.resolved_at, done: resolved, skipped: closed && !resolved },
    { label: "Cerrada", at: incident.closed_at, done: closed },
  ];

  return (
    <ToneScope tone={statusTone(incident.severity)}>
      <PageHeader
        back={{ href: "/operaciones/incidencias", label: "Incidencias" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Siren size={24} />
          </span>
        }
        title={incident.title}
        info={
          <span className="ml-2 flex flex-none items-center gap-2">
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </span>
        }
        subtitle={`${incident.code} · ${incident.type}`}
        actions={incident.can.manage ? <div className="flex flex-wrap items-center justify-end gap-2"><IncidentFlowActions incident={incident} /></div> : undefined}
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Plazo de atención</p>
            <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.03em]">{open ? (incident.overdue ? "Vencido" : formatDateTime(incident.sla_due_at, false)) : "Atendida"}</p>
            <p className="mt-2 text-[13.5px] text-white/80">{incident.sla_hours} horas desde el registro</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {incident.order && <HeroChip icon={<ClipboardList size={14} />}>{incident.order.code}</HeroChip>}
              <HeroChip icon={<UserRound size={14} />}>{incident.reporter ? shortName(incident.reporter) : "Sistema"}</HeroChip>
              <HeroChip icon={<FileText size={14} />}>{SOURCE_LABEL[incident.source] ?? incident.source}</HeroChip>
            </div>
          </div>
          <HeroPanel solid>
            <p className="mb-3 text-[13.5px] font-semibold">Seguimiento</p>
            <Journey steps={steps} skippedLabel="Omitida" formatAt={(iso) => formatDateTime(iso, false)} />
            <div className="mt-4">
              <SlaBar pct={incident.sla_pct} overdue={incident.overdue} closed={!open} />
            </div>
          </HeroPanel>
        </div>
      </HeroBand>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={UserRound} tone="t1" label="Responsable" info="Persona de Operaciones o Gerencia que atiende la incidencia; por defecto, el coordinador de la orden." value={<span className="text-[16px]">{incident.assignee ? shortName(incident.assignee.name) : "Sin asignar"}</span>} />
        <TintTile icon={ClipboardList} tone="t4" label="Orden" info="Orden operativa y reserva afectadas por la incidencia." value={<span className="text-[16px]">{incident.order ? <Link href={`/operaciones/ordenes/${incident.order.code}`} className="hover:underline">{incident.order.code}</Link> : "—"}</span>} note={incident.reservation?.code} />
        <TintTile icon={Timer} tone="warn" label="Registrada" info="Fecha y hora del reporte; desde ahí corre el plazo según la severidad." value={<span className="text-[16px]">{formatDateTime(incident.created_at, false)}</span>} />
        <TintTile icon={Camera} tone="violet" label="Evidencias" info="Fotos o documentos adjuntos a la incidencia y vigentes (no retirados)." value={incident.evidence_files.length} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={FileText} title="Qué pasó" />
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{incident.description}</p>
            {incident.resolution && (
              <div className={cn("mt-4 rounded-[12px] px-3.5 py-3", "bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]")}>
                <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ok">
                  <Wrench size={14} /> Resolución
                </p>
                <p className="text-[13.5px]">{incident.resolution}</p>
              </div>
            )}
          </Card>

          <Card>
            <TintCardTitle icon={Camera} title="Evidencias" aside={String(incident.evidence_files.length)} />
            <EvidenceSection scope="incident" target={incident.code} files={incident.evidence_files} canUpload={incident.can.manage && incident.status !== "cerrada"} canRemove={false} emptyText="Aún no hay fotos ni documentos de respaldo." />
          </Card>
        </div>

        <Card>
          <TintCardTitle icon={History} title="Bitácora" aside={incident.can.manage ? <IncidentCommentAction code={incident.code} /> : String(incident.logs.length)} />
          <ol className="flex flex-col gap-3 border-l-2 border-line pl-5">
            {incident.logs.map((log, index) => (
              <li key={log.id} style={{ animationDelay: `${index * 60}ms` }} className="relative animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                <span className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-surface", KIND_TONE[log.kind] ?? "bg-fg-3")} />
                <p className="text-[13.5px]">{log.message}</p>
                <p className="text-xs text-fg-3">
                  {LOG_LABEL[log.kind] ?? log.kind} · {log.user} · {formatDateTime(log.at, false)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </ToneScope>
  );
}
