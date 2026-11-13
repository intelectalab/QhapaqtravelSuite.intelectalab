import { ArrowRight, ExternalLink, Fingerprint, GitCompareArrows, Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle } from "@/components/ui/Tinted";
import { AuditChange } from "@/features/admin/Audit";
import { actionLabel, type AuditDetail } from "@/lib/admin";
import { auditEntityHref } from "@/lib/auditLinks";
import { formatDateTime } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Evento de auditoría" };

function ValueBox({ title, value, tone }: { title: string; value: string | null; tone: "bad" | "ok" }) {
  return (
    <div className={tone === "bad" ? "rounded-[14px] border border-[color-mix(in_srgb,var(--bad)_25%,transparent)] bg-[color-mix(in_srgb,var(--bad)_5%,var(--surface))] p-4" : "rounded-[14px] border border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_6%,var(--surface))] p-4"}>
      <p className={tone === "bad" ? "mb-1.5 text-[12px] font-semibold text-bad" : "mb-1.5 text-[12px] font-semibold text-ok"}>{title}</p>
      <p className="whitespace-pre-wrap break-words text-[13.5px]">{value ?? <span className="text-fg-3">Sin valor</span>}</p>
    </div>
  );
}

export default async function AuditEventPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const event = await getResource<AuditDetail>(`/audit-events/${encodeURIComponent(codigo)}`, "No pudimos cargar el evento.");
  if (!event) return <NoAccess home="/dashboard" />;
  const target = auditEntityHref(event.entity, event.entity_id);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/auditoria", label: "Auditoría" }}
        leading={<Avatar name={event.actor} size="lg" />}
        title={actionLabel(event.action)}
        subtitle={`${event.actor} · ${event.entity} ${event.entity_id} · ${formatDateTime(event.at)}`}
        jump={false}
        actions={
          event.critical || target ? (
            <span className="flex flex-wrap items-center gap-2">
              {event.critical && <Badge tone="bad">Evento crítico</Badge>}
              {target && (
                <Button href={target} size="sm" icon={<ExternalLink size={15} />}>
                  Ir a la entidad
                </Button>
              )}
            </span>
          ) : undefined
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={GitCompareArrows} title="Qué cambió" />
            <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <ValueBox title="Antes" value={event.before} tone="bad" />
              <span className="hidden place-items-center text-fg-3 md:grid">
                <ArrowRight size={18} />
              </span>
              <ValueBox title="Después" value={event.after} tone="ok" />
            </div>
            {event.diff && (
              <div className="mt-4">
                <p className="mb-1.5 text-[12.5px] font-semibold text-fg-2">Detalle por campo</p>
                <pre className="scroll-thin max-h-72 overflow-auto rounded-[12px] bg-surface-2 p-3 font-mono text-[12px]">{JSON.stringify(event.diff, null, 2)}</pre>
              </div>
            )}
            {event.evidence && (
              <div className="mt-4">
                <p className="mb-1.5 text-[12.5px] font-semibold text-fg-2">Evidencia</p>
                <pre className="scroll-thin max-h-72 overflow-auto rounded-[12px] bg-surface-2 p-3 font-mono text-[12px]">{JSON.stringify(event.evidence, null, 2)}</pre>
              </div>
            )}
          </Card>
          <Card>
            <TintCardTitle icon={Link2} title="Eventos relacionados" aside={`${event.related.length}`} />
            {event.related.length === 0 ? (
              <p className="text-[13px] text-fg-3">No hay otros eventos de la misma operación ni del mismo registro.</p>
            ) : (
              <ol className="flex flex-col">
                {event.related.map((item) => (
                  <li key={item.code}>
                    <Link href={`/admin/auditoria/${item.code}`} className="group flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition-colors hover:bg-surface-2">
                      <span className={item.critical ? "h-2 w-2 flex-none rounded-full bg-bad" : "h-2 w-2 flex-none rounded-full bg-accent"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold group-hover:text-accent">
                          {actionLabel(item.action)} <span className="font-normal text-fg-3">· {item.entity} {item.entity_id}</span>
                        </span>
                        <AuditChange before={item.before} after={item.after} compact />
                      </span>
                      <span className="flex-none text-[11.5px] text-fg-3">
                        {item.actor} · {formatDateTime(item.at, false)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <Card>
          <TintCardTitle icon={Fingerprint} title="Contexto" />
          <FieldList
            fields={[
              { label: "Código", value: <span className="font-mono">{event.code}</span> },
              { label: "Usuario", value: event.actor_code ? `${event.actor} (${event.actor_code})` : event.actor },
              { label: "Rol", value: event.role ?? "—" },
              {
                label: "Entidad",
                value: target ? (
                  <Link href={target} className="font-semibold text-accent hover:underline">
                    {event.entity} · {event.entity_id}
                  </Link>
                ) : (
                  `${event.entity} · ${event.entity_id}`
                ),
              },
              { label: "Fecha y hora", value: formatDateTime(event.at) },
              { label: "IP", value: <span className="font-mono">{event.ip ?? "—"}</span> },
              { label: "Navegador", value: <span title={event.user_agent ?? undefined}>{event.user_agent ?? "—"}</span> },
              { label: "Operación", value: <span className="font-mono text-[12px]">{event.correlation}</span> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
