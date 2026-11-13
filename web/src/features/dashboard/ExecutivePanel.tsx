import { BadgeCheck, BarChart3, BriefcaseBusiness, CalendarClock, ClipboardList, FileText, Filter, Gauge, ListChecks, Percent, ShieldAlert, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/MiniTable";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { TintTile } from "@/components/ui/Tinted";
import type { ExecutiveData, ManagerData } from "@/lib/dashboard";
import { capitalize, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { CriticalAlert, DepartureList, HBars, IncidentList, MaybeLink, PanelCard, PanelLink, RowList, ServicesTable, StatLine, SubHeading, shortDate, type CanOpen } from "./DashboardBlocks";
import { ApproveQuoteAction } from "./PanelActions";
import { closedMonths, deltaNote, money } from "./panelFormat";
import { TrendBars } from "./TrendBars";

const FUNNEL_TONES = ["info", "t1", "violet", "sun", "ok"] as const;

export function ExecutivePanel({ data, can }: { data: ExecutiveData; can: CanOpen }) {
  const { kpis } = data;
  const months = closedMonths(data.months);
  const first = data.funnel.steps[0]?.count ?? 0;

  return (
    <>
      <CriticalAlert incident={data.critical} can={can} />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={TrendingUp} tone="t1" label="Ventas del mes" value={money(kpis.sales.value)} note={deltaNote(kpis.sales.value, kpis.sales.previous, kpis.sales.previous_label)} info={<p>Total de las reservas vendidas (confirmadas, en operación, completadas o con pagos o proveedores pendientes) creadas este mes, en soles al tipo de cambio de cada reserva.</p>} />
        <TintTile icon={Percent} tone="ok" label="Margen bruto" value={kpis.margin.value === null ? "—" : formatPercent(kpis.margin.value)} note={kpis.margin.previous === null ? "Sin mes anterior para comparar" : `${formatPercent(kpis.margin.previous)} el mes anterior`} info={<p>Ventas del mes menos el costo de sus servicios no cancelados, dividido entre las ventas.</p>} />
        <TintTile icon={Target} tone="violet" label="Pipeline abierto" value={money(kpis.pipeline.amount)} note={`${kpis.pipeline.count} ${kpis.pipeline.count === 1 ? "oportunidad" : "oportunidades"}`} info={<p>Monto de las oportunidades que no están ganadas ni perdidas, en soles.</p>} />
        <TintTile icon={BriefcaseBusiness} tone="info" label="Reservas activas" value={kpis.active.reservations} note={`${kpis.active.passengers} ${kpis.active.passengers === 1 ? "pasajero" : "pasajeros"}`} info={<p>Reservas confirmadas, en operación o con algo pendiente, sin contar borradores, canceladas ni completadas. Debajo, sus pasajeros registrados.</p>} />
        <TintTile icon={Wallet} tone="sun" label="Por cobrar" value={money(kpis.receivable.open)} note={kpis.receivable.overdue_count > 0 ? `${money(kpis.receivable.overdue)} vencido` : "Nada vencido"} info={<p>Saldo de las cuentas por cobrar abiertas, parciales o vencidas, en soles. Debajo, la parte que ya pasó su fecha de vencimiento.</p>} />
      </section>

      {data.manager && <ManagerBlock data={data.manager} can={can} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PanelCard icon={BarChart3} title="Ventas y costo de proveedores" className="lg:col-span-7" aside={<PanelLink href="/finanzas/rentabilidad" can={can}>Rentabilidad</PanelLink>}>
          <p className="-mt-2 mb-3 text-[12.5px] text-fg-3">Meses cerrados, en soles</p>
          <TrendBars labels={months.map((month) => month.label)} unit="money" series={[{ name: "Ventas", tone: "t1", values: months.map((month) => month.sales) }, { name: "Costo de proveedores", tone: "sun", values: months.map((month) => month.cost) }]} />
        </PanelCard>
        <PanelCard icon={Filter} title={`Embudo comercial de ${data.month}`} tone="violet" className="lg:col-span-5">
          <HBars
            empty="Aún no entran leads este mes."
            rows={data.funnel.steps.map((step, index) => ({ key: step.key, label: step.label, value: step.count, tone: FUNNEL_TONES[index], display: index === 0 || first === 0 ? String(step.count) : `${step.count} · ${Math.round((step.count / first) * 100)} %` }))}
          />
          <div className="mt-4">
            <StatLine label="Conversión de lead a reserva" value={data.funnel.conversion === null ? "—" : formatPercent(data.funnel.conversion)} />
            <StatLine label="Ticket promedio" value={data.funnel.ticket === null ? "—" : formatMoney(data.funnel.ticket)} />
            <StatLine label="Tiempo medio de cierre" value={data.funnel.cycle_days === null ? "—" : `${data.funnel.cycle_days} ${data.funnel.cycle_days === 1 ? "día" : "días"}`} />
          </div>
        </PanelCard>

        <PanelCard icon={CalendarClock} title="Servicios de los próximos 7 días" tone="t3" className="lg:col-span-12" aside={<PanelLink href="/operaciones/calendario" can={can}>Calendario</PanelLink>}>
          <ServicesTable rows={data.services} can={can} empty="No hay servicios programados en los próximos 7 días." />
        </PanelCard>

        <PanelCard icon={ListChecks} title="Pendientes del equipo" tone="t4" className="lg:col-span-4" aside={<PanelLink href="/crm/actividades" can={can}>Agenda</PanelLink>}>
          <RowList
            empty="El equipo no tiene actividades pendientes."
            items={data.activities.map((activity) => ({
              key: activity.code,
              icon: ClipboardList,
              tone: activity.status === "vencida" ? "bad" : "t4",
              title: activity.subject,
              detail: [capitalize(activity.type), activity.due_at ? formatDateTime(activity.due_at, false) : null, activity.owner?.split(" ")[0]].filter(Boolean).join(" · "),
              aside: <StatusBadge status={activity.status} />,
            }))}
          />
        </PanelCard>
        <PanelCard icon={FileText} title="Cotizaciones en seguimiento" tone="accent" className="lg:col-span-4" aside={<PanelLink href="/cotizaciones" can={can}>Cotizaciones</PanelLink>}>
          <RowList
            empty="No hay cotizaciones enviadas esperando respuesta."
            items={data.quotes.map((quote) => ({
              key: quote.code,
              title: (
                <MaybeLink href={`/cotizaciones/${quote.code}`} can={can}>
                  {quote.title}
                </MaybeLink>
              ),
              detail: `${quote.client} · v${quote.version}${quote.valid_until ? ` · vence ${shortDate(quote.valid_until)}` : ""}`,
              aside: (
                <>
                  <b className="font-mono">{formatMoney(quote.total, quote.currency)}</b>
                  <StatusBadge status={quote.status} />
                </>
              ),
            }))}
          />
        </PanelCard>
        <div className="lg:col-span-4">
          <IncidentList rows={data.incidents} can={can} icon={ShieldAlert} />
        </div>

        <div className="lg:col-span-4">
          <DepartureList rows={data.departures} can={can} />
        </div>
        <PanelCard icon={Users} title="Leads, cotizaciones y reservas" tone="info" className="lg:col-span-5">
          <p className="-mt-2 mb-3 text-[12.5px] text-fg-3">Volumen de los meses cerrados</p>
          <TrendBars labels={months.map((month) => month.label)} unit="count" series={[{ name: "Leads", tone: "info", values: months.map((month) => month.leads) }, { name: "Cotizaciones", tone: "violet", values: months.map((month) => month.quotes) }, { name: "Reservas", tone: "sun", values: months.map((month) => month.reservations) }]} />
        </PanelCard>
        <PanelCard icon={Gauge} title={`Ventas por canal en ${data.month}`} tone="t2" className="lg:col-span-3">
          <HBars empty="Aún no hay ventas este mes." rows={data.channels.map((row, index) => ({ key: row.label, label: row.label, value: row.sales, display: money(row.sales), tone: (["t1", "violet", "sun", "info", "t4"] as const)[index % 5] }))} />
        </PanelCard>
      </div>
    </>
  );
}

function ManagerBlock({ data, can }: { data: ManagerData; can: CanOpen }) {
  const targets = data.targets;
  const salesPct = targets && targets.goal_sales > 0 ? (targets.sales / targets.goal_sales) * 100 : null;
  const marginPct = targets && targets.goal_margin > 0 ? (targets.margin / targets.goal_margin) * 100 : null;

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <PanelCard icon={BadgeCheck} title="Aprobaciones pendientes" tone="warn" className="lg:col-span-7" aside={<PanelLink href="/aprobaciones/pendientes" can={can}>Bandeja</PanelLink>}>
        {data.approvals.by_type.length > 1 && (
          <div className="mb-4">
            <HBars empty="" rows={data.approvals.by_type.map((group) => ({ key: group.type, label: group.label, value: group.count, display: String(group.count), tone: "warn" }))} />
          </div>
        )}
        <RowList
          empty="No hay solicitudes esperando aprobación."
          items={data.approvals.items.map((item) => ({
            key: item.code,
            icon: BadgeCheck,
            tone: "warn",
            title: item.title,
            detail: [item.type, item.requester, item.subject, `nivel ${item.level}`].filter(Boolean).join(" · "),
            aside: (
              <>
                {item.amount !== null && <b className="font-mono">{formatMoney(item.amount, item.currency ?? "PEN")}</b>}
                {item.due_at && <span className="text-fg-3">vence {formatDateTime(item.due_at, false)}</span>}
              </>
            ),
          }))}
        />
        {(data.quote_approvals?.length ?? 0) > 0 && (
          <>
            <SubHeading>Cotizaciones fuera de política</SubHeading>
            <RowList
              empty=""
              items={(data.quote_approvals ?? []).map((item) => ({
                key: item.key,
                icon: FileText,
                tone: "warn",
                title: (
                  <MaybeLink href={`/cotizaciones/${item.target}`} can={can}>
                    {item.code} · {item.title}
                  </MaybeLink>
                ),
                detail: [item.requester, formatMoney(item.amount, item.currency), item.impact].filter(Boolean).join(" · "),
                aside: <ApproveQuoteAction item={item} />,
              }))}
            />
          </>
        )}
      </PanelCard>
      <PanelCard icon={Target} title={targets ? `Metas de ${targets.period.toLowerCase()}` : "Metas del mes"} tone="ok" className="lg:col-span-5" aside={<PanelLink href="/crm/metas" can={can}>Metas</PanelLink>}>
        {targets ? (
          <div className="flex flex-col gap-3">
            <div>
              <StatLine label={`Ventas frente a ${formatMoney(targets.goal_sales, "PEN", { compact: true })}`} value={salesPct === null ? "—" : formatPercent(salesPct, 0)} />
              <ProgressBar value={salesPct ?? 0} tone={(salesPct ?? 0) >= 100 ? "ok" : "warn"} />
            </div>
            <div>
              <StatLine label={`Margen frente a ${formatMoney(targets.goal_margin, "PEN", { compact: true })}`} value={marginPct === null ? "—" : formatPercent(marginPct, 0)} />
              <ProgressBar value={marginPct ?? 0} tone={(marginPct ?? 0) >= 100 ? "ok" : "warn"} />
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-fg-3">Este mes no tiene metas por asesor vigentes.</p>
        )}
        <div className="mt-3">
          <StatLine label="Actividades vencidas del equipo" value={data.team.overdue_activities} tone={data.team.overdue_activities > 0 ? "bad" : undefined} />
          <StatLine label="Leads nuevos sin contactar" value={data.team.uncontacted} />
          <StatLine label="Leads sin asignar" value={data.team.unassigned} />
        </div>
      </PanelCard>
      <PanelCard icon={Users} title="Desempeño por asesor" tone="t1" className="lg:col-span-12" aside={<PanelLink href="/crm/oportunidades" can={can}>Oportunidades</PanelLink>}>
        <SimpleTable
          empty="No hay asesores activos."
          columns={[{ header: "Asesor" }, { header: "Leads activos", align: "right" }, { header: "Pipeline", align: "right" }, { header: "Cotizaciones abiertas", align: "right" }, { header: "Vendido en el mes", align: "right" }, { header: "Conversión", align: "right" }, { header: "Margen medio", align: "right" }, { header: "Vencidas", align: "right" }]}
          rows={data.advisors.map((advisor) => ({
            key: advisor.name,
            cells: [
              <b key="name">{advisor.name}</b>,
              advisor.leads,
              `${money(advisor.pipeline)} (${advisor.open})`,
              advisor.quotes,
              money(advisor.sold),
              advisor.conversion === null ? "—" : formatPercent(advisor.conversion, 0),
              <span key="margin" className={advisor.margin !== null && advisor.margin < 15 ? "text-bad" : undefined}>
                {advisor.margin === null ? "—" : formatPercent(advisor.margin)}
              </span>,
              <span key="overdue" className={advisor.overdue > 0 ? "text-bad" : undefined}>
                {advisor.overdue}
              </span>,
            ],
          }))}
        />
        <p className="mt-2 text-[12px] text-fg-3">Conversión: oportunidades ganadas entre las cerradas. El margen medio usa la versión vigente de sus cotizaciones enviadas; bajo 15 % se marca en rojo.</p>
      </PanelCard>
    </div>
  );
}
