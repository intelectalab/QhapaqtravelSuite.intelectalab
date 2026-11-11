import { Building2, ClipboardList, MessagesSquare } from "lucide-react";
import { FieldList } from "@/components/ui/Details";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import type { SupplierIncidentDetail } from "@/lib/supplier-portal";
import { CommentIncidentPanel } from "./SupplierIncidentsView";
import { SupplierBadge } from "./SupplierUi";

export function SupplierIncidentDetailView({ detail }: { detail: SupplierIncidentDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <PortalTitle title={detail.title} subtitle={`${detail.code}${detail.reservation ? ` · reserva ${detail.reservation}` : ""}`} back={{ href: "/proveedor/incidencias", label: "Incidencias" }} actions={detail.can_comment ? <CommentIncidentPanel code={detail.code} /> : undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard icon={ClipboardList} title="Detalle">
          <FieldList
            fields={[
              { label: "Estado", value: <SupplierBadge status={detail.status} scope="incident" /> },
              { label: "Impacto", value: <SupplierBadge status={detail.severity} scope="severity" /> },
              { label: "Tipo", value: detail.type },
              { label: "Reportada", value: formatDateTime(detail.created_at) },
              ...(detail.service ? [{ label: "Servicio", value: <span className="whitespace-normal">{`${detail.service.name} · ${formatDate(detail.service.date)}`}</span> }] : []),
            ]}
          />
          <p className="mt-3 whitespace-pre-line rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{detail.description}</p>
          {detail.resolution && (
            <p className="mt-3 rounded-tile bg-[color-mix(in_srgb,var(--ok)_9%,var(--surface))] px-3.5 py-3 text-[13px] text-fg-2">
              <b className="block text-ok">Resolución</b>
              {detail.resolution}
            </p>
          )}
        </SectionCard>
        <SectionCard icon={MessagesSquare} title="Seguimiento" aside={detail.logs.length}>
          {detail.logs.length === 0 ? (
            <EmptyLine>Aún no hay movimientos.</EmptyLine>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {detail.logs.map((log, index) => (
                <li key={log.id} style={rise(index)} className={cn("flex gap-3", RISE, log.mine && "flex-row-reverse")}>
                  <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-full text-white", log.mine ? "bg-t3" : "bg-t1")}>{log.mine ? <Building2 size={15} /> : <MessagesSquare size={15} />}</span>
                  <span className={cn("max-w-[560px] rounded-tile px-3.5 py-2.5 text-[13px]", log.mine ? "bg-[color-mix(in_srgb,var(--t3)_10%,var(--surface))]" : "bg-surface-2")}>
                    <span className="block text-[12px] font-semibold text-fg-3">
                      {log.mine ? "Usted" : log.author} · {formatDateTime(log.at, false)}
                    </span>
                    <span className="block whitespace-pre-line text-fg">{log.message}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!detail.can_comment && <p className="mt-3 text-[12.5px] text-fg-3">La incidencia está {detail.status === "cerrada" ? "cerrada" : "resuelta"}: ya no admite comentarios.</p>}
        </SectionCard>
      </div>
    </div>
  );
}
