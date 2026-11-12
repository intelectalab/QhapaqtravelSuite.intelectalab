import { BedDouble, Building2, ClipboardList, ShieldAlert, Ticket, TriangleAlert, Truck } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { TintTile } from "@/components/ui/Tinted";
import type { OperationsData } from "@/lib/dashboard";
import { statusLabel } from "@/lib/tone";
import { CriticalAlert, DepartureList, IncidentList, MaybeLink, PanelCard, PanelLink, RowList, ServicesTable, shortDate, type CanOpen } from "./DashboardBlocks";
import { plural } from "./panelFormat";

export function OperationsPanel({ data, can }: { data: OperationsData; can: CanOpen }) {
  const { kpis } = data;
  const resources = new Map(data.soon.map((row) => [row.id, row]));

  return (
    <>
      <CriticalAlert incident={data.critical} can={can} />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={ClipboardList} tone="t1" label="Servicios hoy y mañana" value={kpis.soon.services} note={plural(kpis.soon.pax, "pasajero", "pasajeros")} info={<p>Servicios con proveedor, no cancelados, de reservas vigentes, con fecha hoy o mañana.</p>} />
        <TintTile icon={Building2} tone={kpis.unconfirmed.services > 0 ? "sun" : "ok"} label="Sin confirmar por proveedor" value={kpis.unconfirmed.services} note={plural(kpis.unconfirmed.providers, "proveedor", "proveedores")} info={<p>Servicios próximos solicitados, pendientes o rechazados por el proveedor.</p>} />
        <TintTile icon={Truck} tone={kpis.assignments.pending > 0 ? "bad" : "ok"} label="Asignaciones pendientes" value={kpis.assignments.pending} note={`${kpis.assignments.within3} en 3 días o menos`} info={<p>Asignaciones de órdenes operativas abiertas que aún no tienen guía, conductor o vehículo confirmados.</p>} />
        <TintTile icon={Ticket} tone="info" label="Vouchers por emitir" value={kpis.vouchers.to_issue} note="Servicios confirmados" info={<p>Servicios próximos confirmados por el proveedor que todavía no tienen un voucher vigente.</p>} />
        <TintTile icon={TriangleAlert} tone={kpis.incidents.by_severity.some((row) => row.severity === "critica") ? "bad" : "violet"} label="Incidencias abiertas" value={kpis.incidents.open} note={kpis.incidents.by_severity.map((row) => `${row.count} ${statusLabel(row.severity).toLowerCase()}`).join(" · ") || "Ninguna"} info={<p>Incidencias que no están resueltas ni cerradas, por severidad.</p>} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PanelCard icon={ClipboardList} title="Servicios de hoy y mañana" className="lg:col-span-12" aside={<PanelLink href="/operaciones/ordenes" can={can}>Órdenes</PanelLink>}>
          <ServicesTable
            rows={data.soon}
            can={can}
            empty="No hay servicios hoy ni mañana."
            extra={{
              header: "Asignación",
              cell: (row) => {
                const item = resources.get(row.id);
                const assignment = item?.assignment;
                if (!assignment) {
                  return item?.order ? (
                    <MaybeLink href={`/operaciones/ordenes/${item.order}`} can={can} className="text-[12.5px] text-warn">
                      Sin asignar
                    </MaybeLink>
                  ) : (
                    <span className="text-[12.5px] text-warn">Sin orden</span>
                  );
                }
                const people = [assignment.guide, assignment.driver, assignment.vehicle].filter(Boolean).join(" · ");
                return (
                  <span className="flex flex-col gap-0.5">
                    <StatusBadge status={assignment.status} />
                    <span className={people ? "text-[12px] text-fg-3" : "text-[12px] text-warn"}>{people || "Sin recursos"}</span>
                  </span>
                );
              },
            }}
          />
        </PanelCard>

        <PanelCard icon={Building2} title="Sin confirmar por proveedor" tone="sun" className="lg:col-span-4">
          <RowList
            empty="Todos los servicios próximos están confirmados."
            items={data.unconfirmed.map((group) => ({
              key: group.provider,
              icon: Building2,
              tone: "sun",
              title: group.provider,
              detail: group.items.map((item) => `${item.reservation} · ${shortDate(item.date)} · ${item.name}`).join(" / "),
              aside: <span className="font-mono text-fg-2">{group.total}</span>,
            }))}
          />
        </PanelCard>
        <PanelCard icon={Truck} title="Asignaciones pendientes" tone="bad" className="lg:col-span-4" aside={<PanelLink href="/operaciones/asignaciones" can={can}>Asignaciones</PanelLink>}>
          <RowList
            empty="No hay asignaciones pendientes."
            items={data.assignments.map((row, index) => ({
              key: `${row.order}-${index}`,
              icon: Truck,
              tone: "warn",
              title: row.service,
              detail: `${shortDate(row.date)}${row.time ? ` ${row.time}` : ""} · ${row.order}${row.missing.length ? ` · falta ${row.missing.join(", ")}` : ""}`,
            }))}
          />
        </PanelCard>
        <div className="lg:col-span-4">
          <IncidentList rows={data.incidents} can={can} icon={ShieldAlert} />
        </div>

        <PanelCard icon={Ticket} title="Vouchers por emitir" tone="info" className="lg:col-span-4" aside={<PanelLink href="/operaciones/vouchers" can={can}>Vouchers</PanelLink>}>
          <RowList
            empty="Todos los servicios confirmados tienen voucher."
            items={data.vouchers.map((row) => ({ key: row.id, icon: Ticket, tone: "info", title: row.name, detail: [shortDate(row.date), row.reservation, row.provider].filter(Boolean).join(" · ") }))}
          />
        </PanelCard>
        <PanelCard icon={BedDouble} title="Llegadas a hotel en 7 días" tone="t3" className="lg:col-span-4" aside={<PanelLink href="/operaciones/rooming" can={can}>Rooming</PanelLink>}>
          <RowList
            empty="No hay llegadas a hotel en los próximos 7 días."
            items={data.arrivals.map((row) => ({
              key: `${row.reservation}-${row.check_in}`,
              icon: BedDouble,
              tone: "t3",
              title: row.hotel ?? "Hotel",
              detail: `${shortDate(row.check_in)} al ${shortDate(row.check_out)} · ${plural(row.rooms, "habitación", "habitaciones")} · ${row.reservation}${row.hotel_confirmed ? " · el hotel acusó recibo" : ""}`,
              aside: <StatusBadge status={row.status} />,
            }))}
          />
        </PanelCard>
        <div className="lg:col-span-4">
          <DepartureList rows={data.departures} can={can} />
        </div>
      </div>
    </>
  );
}
