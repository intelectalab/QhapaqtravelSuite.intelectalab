import { ArrowRight, Building2, Fingerprint, GitCompareArrows, Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle } from "@/components/ui/Tinted";
import { formatDateTime } from "@/lib/format";
import { actionMeta } from "@/lib/platformBilling";
import { getPlatformAuditEvent } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Evento de auditoría" };

function ValueBox({ title, value, tone }: { title: string; value: string | null; tone: "bad" | "ok" }) {
  return (
    <div className={tone === "bad" ? "rounded-[14px] border border-[color-mix(in_srgb,var(--bad)_25%,transparent)] bg-[color-mix(in_srgb,var(--bad)_5%,var(--surface))] p-4" : "rounded-[14px] border border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_6%,var(--surface))] p-4"}>
      <p className={tone === "bad" ? "mb-1.5 text-[12px] font-semibold text-bad" : "mb-1.5 text-[12px] font-semibold text-ok"}>{title}</p>
      <p className="whitespace-pre-wrap break-words text-[13.5px]">{value ?? <span className="text-fg-3">Sin valor</span>}</p>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[12.5px] font-semibold text-fg-2">{title}</p>
      <pre className="scroll-thin max-h-72 overflow-auto rounded-[12px] bg-surface-2 p-3 font-mono text-[12px]">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default async function PlatformAuditEventPage({ params }: PageProps<"/plataforma/auditoria/[id]">) {
  const { id } = await params;
  const event = await getPlatformAuditEvent(id);
  const actor = event.actor ?? "Sistema";
  const meta = actionMeta(event.action);

  return (
    <>
      <PageHeader
        back={{ href: "/plataforma/auditoria", label: "Auditoría" }}
        leading={<Avatar name={actor} size="lg" />}
        title={meta.label}
        subtitle={`${actor} · ${event.entity} · ${event.subject} · ${formatDateTime(event.at)}`}
        jump={false}
        actions={event.critical ? <Badge tone="bad">Evento crítico</Badge> : undefined}
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
            {event.diff && <JsonBlock title="Detalle por campo" value={event.diff} />}
            {event.evidence && <JsonBlock title="Evidencia" value={event.evidence} />}
          </Card>
          <Card>
            <TintCardTitle icon={Link2} title="Eventos relacionados" aside={String(event.related.length)} />
            {event.related.length === 0 ? (
              <p className="text-[13px] text-fg-3">No hay otros eventos de la misma operación ni del mismo registro.</p>
            ) : (
              <ol className="flex flex-col">
                {event.related.map((item) => (
                  <li key={item.id}>
                    <Link href={`/plataforma/auditoria/${item.id}`} className="group flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition-colors hover:bg-surface-2">
                      <span className={item.critical ? "h-2 w-2 flex-none rounded-full bg-bad" : "h-2 w-2 flex-none rounded-full bg-accent"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold group-hover:text-accent">
                          {actionMeta(item.action).label} <span className="font-normal text-fg-3">· {item.subject}</span>
                        </span>
                        <span className="block truncate text-[12px] text-fg-3">{item.before && item.after ? `${item.before} → ${item.after}` : (item.after ?? item.before ?? "")}</span>
                      </span>
                      {item.same_request && (
                        <Badge tone="info" dot={false}>
                          Misma operación
                        </Badge>
                      )}
                      <span className="flex-none text-[11.5px] text-fg-3">
                        {item.actor ?? "Sistema"} · {formatDateTime(item.at, false)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          {event.tenant && (
            <Card>
              <TintCardTitle icon={Building2} title="Agencia" />
              <Link href={`/plataforma/agencias/${event.tenant.code}`} className="flex items-center gap-3 rounded-[12px] bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-2/70">
                <Avatar name={event.tenant.name} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold">{event.tenant.name}</b>
                  <span className="text-xs text-fg-3">{event.tenant.code} · ver la ficha</span>
                </span>
                <ArrowRight size={16} className="text-fg-3" />
              </Link>
            </Card>
          )}
          <Card>
            <TintCardTitle icon={Fingerprint} title="Contexto" />
            <FieldList
              fields={[
                { label: "Código", value: <span className="font-mono">{event.code}</span> },
                { label: "Usuario", value: event.actor_email ? `${actor} (${event.actor_email})` : actor },
                { label: "Rol", value: event.actor_role ?? (event.actor_type === "platform_user" ? "Super Admin" : "—") },
                { label: "Entidad", value: `${event.entity} · ${event.entity_id}` },
                { label: "Fecha y hora", value: formatDateTime(event.at) },
                { label: "IP", value: <span className="font-mono">{event.ip ?? "—"}</span> },
                { label: "Navegador", value: <span title={event.user_agent ?? undefined}>{event.user_agent ?? "—"}</span> },
                { label: "Operación", value: <span className="font-mono text-[12px]">{event.correlation_id ?? "—"}</span> },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
