import { CalendarCheck, Coins, FileText, Funnel, Luggage, Percent, PhoneCall, Target, UserPlus } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { TintTile } from "@/components/ui/Tinted";
import type { ActivityRow, SalesData } from "@/lib/dashboard";
import { capitalize, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { HBars, MaybeLink, PanelCard, PanelLink, RowList, SubHeading, shortDate, type CanOpen } from "./DashboardBlocks";
import { byCurrency, money, plural } from "./panelFormat";

const STAGE_TONES = ["info", "t1", "violet", "sun"] as const;

function daysLeft(today: string, date: string | null): number | null {
  if (!date) return null;
  return Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
}

function activityItem(activity: ActivityRow) {
  return {
    key: activity.code,
    icon: PhoneCall,
    tone: activity.status === "vencida" ? ("bad" as const) : ("t4" as const),
    title: activity.subject,
    detail: [capitalize(activity.type), activity.due_at ? formatDateTime(activity.due_at, false) : null].filter(Boolean).join(" · "),
    aside: <StatusBadge status={activity.status} />,
  };
}

export function SalesPanel({ data, can }: { data: SalesData; can: CanOpen }) {
  const { kpis } = data;

  return (
    <>
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={Target} tone="violet" label="Mi pipeline" value={money(kpis.pipeline.amount)} note={`${plural(kpis.pipeline.count, "oportunidad", "oportunidades")} · ponderado ${money(kpis.pipeline.weighted)}`} info={<p>Tus oportunidades abiertas, en soles. El ponderado multiplica cada una por su probabilidad.</p>} />
        <TintTile icon={FileText} tone={kpis.quotes.expiring > 0 ? "sun" : "accent"} label="Mis cotizaciones abiertas" value={kpis.quotes.open} note={kpis.quotes.expiring > 0 ? `${kpis.quotes.expiring} vencen en 7 días o menos` : "Ninguna vence esta semana"} info={<p>Tus cotizaciones en borrador, enviadas, vistas o en negociación. Debajo, las enviadas cuya validez termina en los próximos 7 días.</p>} />
        <TintTile icon={CalendarCheck} tone={kpis.activities.due > 0 ? "bad" : "ok"} label="Actividades de hoy" value={kpis.activities.due} note={`${kpis.activities.pending} pendientes en total`} info={<p>Tus actividades sin completar que vencen hoy o ya vencieron. Debajo, todas las que tienes sin completar.</p>} />
        <TintTile icon={Percent} tone="ok" label="Mi conversión" value={kpis.conversion.opportunities === null ? "—" : formatPercent(kpis.conversion.opportunities, 0)} note={`Leads convertidos ${kpis.conversion.leads === null ? "—" : formatPercent(kpis.conversion.leads, 0)}`} info={<p>Tus oportunidades ganadas entre las cerradas (ganadas y perdidas). Debajo, tus leads convertidos entre todos tus leads.</p>} />
        <TintTile icon={Coins} tone="sun" label={`Comisión de ${data.month}`} value={formatMoney(kpis.commission.amount)} note={kpis.commission.by_currency.length > 1 ? byCurrency(kpis.commission.by_currency) : "Estimada, sin anuladas"} info={<p>Tus comisiones no anuladas de reservas cuyo viaje empieza este mes, en soles.</p>} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PanelCard icon={Funnel} title="Mi pipeline por etapa" tone="violet" className="lg:col-span-7" aside={<PanelLink href="/crm/oportunidades" can={can}>Tablero</PanelLink>}>
          <HBars empty="No tienes oportunidades abiertas." rows={data.stages.map((stage, index) => ({ key: stage.code, label: `${stage.name} (${stage.count})`, value: stage.amount, display: formatMoney(stage.amount), tone: STAGE_TONES[index % 4] }))} />
          {data.closing.length > 0 && (
            <>
              <SubHeading>Cierre más próximo</SubHeading>
              <RowList
                empty=""
                items={data.closing.map((row) => ({
                  key: row.code,
                  title: (
                    <MaybeLink href={`/crm/oportunidades/${row.code}`} can={can}>
                      {row.title}
                    </MaybeLink>
                  ),
                  detail: row.close ? `Cierre ${shortDate(row.close)}` : "Sin fecha de cierre",
                  aside: <StatusBadge status={row.stage} />,
                }))}
              />
            </>
          )}
        </PanelCard>
        <PanelCard icon={CalendarCheck} title="Mis actividades" tone="t4" className="lg:col-span-5" aside={<PanelLink href="/crm/actividades" can={can}>Agenda</PanelLink>}>
          <SubHeading>Hoy y vencidas</SubHeading>
          <RowList empty="Nada pendiente para hoy." items={data.activities.due.map(activityItem)} />
          {data.activities.next.length > 0 && (
            <>
              <SubHeading>Próximas</SubHeading>
              <RowList empty="" items={data.activities.next.map(activityItem)} />
            </>
          )}
        </PanelCard>

        <PanelCard icon={FileText} title="Mis cotizaciones por vencer" tone="accent" className="lg:col-span-4" aside={<PanelLink href="/cotizaciones" can={can}>Cotizaciones</PanelLink>}>
          <RowList
            empty="Ninguna cotización vence en los próximos 7 días."
            items={data.expiring.map((quote) => {
              const left = daysLeft(data.today, quote.valid_until);
              return {
                key: quote.code,
                title: (
                  <MaybeLink href={`/cotizaciones/${quote.code}`} can={can}>
                    {quote.title}
                  </MaybeLink>
                ),
                detail: `${quote.client} · ${left === null ? "sin validez" : left < 0 ? "vencida" : left === 0 ? "vence hoy" : `vence en ${left} d`} · ${quote.viewed ? "vista" : "no abierta"}`,
                aside: (
                  <>
                    <b className="font-mono">{formatMoney(quote.total, quote.currency)}</b>
                    {quote.margin !== null && <span className={quote.margin < 15 ? "text-bad" : "text-fg-3"}>margen {formatPercent(quote.margin)}</span>}
                  </>
                ),
              };
            })}
          />
        </PanelCard>
        <PanelCard icon={UserPlus} title="Mis leads" tone="info" className="lg:col-span-4" aside={<PanelLink href="/crm/leads" can={can}>Leads</PanelLink>}>
          <RowList
            empty="No tienes leads activos."
            items={data.leads.map((lead) => ({
              key: lead.code,
              icon: UserPlus,
              tone: lead.status === "nuevo" ? "info" : "mute",
              title: (
                <MaybeLink href={`/crm/leads/${lead.code}`} can={can}>
                  {lead.name}
                </MaybeLink>
              ),
              detail: [lead.destination, lead.pax ? plural(lead.pax, "pasajero", "pasajeros") : null, lead.score !== null ? `puntaje ${lead.score}` : null].filter(Boolean).join(" · "),
              aside: <StatusBadge status={lead.status} />,
            }))}
          />
          <SubHeading>Sin asignar, disponibles para tomar</SubHeading>
          <RowList
            empty="No hay leads en la bolsa común."
            items={data.pool.map((lead) => ({
              key: lead.code,
              title: (
                <MaybeLink href={`/crm/leads/${lead.code}`} can={can}>
                  {lead.name}
                </MaybeLink>
              ),
              detail: [lead.source, lead.destination, lead.pax ? plural(lead.pax, "pasajero", "pasajeros") : null].filter(Boolean).join(" · "),
            }))}
          />
        </PanelCard>
        <PanelCard icon={Luggage} title="Mis próximos viajes" tone="t3" className="lg:col-span-4" aside={<PanelLink href="/reservas" can={can}>Reservas</PanelLink>}>
          <RowList
            empty="No tienes viajes próximos."
            items={data.trips.map((trip) => ({
              key: trip.code,
              icon: Luggage,
              tone: "t3",
              title: (
                <MaybeLink href={`/reservas/${trip.code}`} can={can}>
                  {trip.title}
                </MaybeLink>
              ),
              detail: `${shortDate(trip.date)} · ${plural(trip.passengers, "pasajero", "pasajeros")}`,
              aside: <StatusBadge status={trip.status} />,
            }))}
          />
        </PanelCard>
      </div>
    </>
  );
}
