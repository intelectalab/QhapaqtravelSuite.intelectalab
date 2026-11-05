import { ArrowRight, CalendarClock, CircleX, FileText, Filter, History, MapPin, Percent, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { HeroBand, HeroChip, HeroPanel, Journey, SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { OpportunityActions } from "@/features/opportunities/OpportunityActions";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { OPEN_STAGES, STAGE_TONE } from "@/lib/opportunities";
import { getCatalogs } from "@/lib/server/leads";
import { getOpportunity } from "@/lib/server/opportunities";

export async function generateMetadata({ params }: PageProps<"/crm/oportunidades/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getOpportunity(code)).title };
}

export default async function OportunidadPage({ params }: PageProps<"/crm/oportunidades/[code]">) {
  const { code } = await params;
  const [opportunity, catalogs] = await Promise.all([getOpportunity(code), getCatalogs()]);
  const stageName = (stage: string | null) => opportunity.stages.find((item) => item.code === stage)?.name ?? stage ?? "";
  const lost = opportunity.stage === "perdida";
  const order = [...OPEN_STAGES, "ganada"];
  const reached = order.indexOf(opportunity.stage);
  const steps = order.map((stage, index) => ({ label: stageName(stage), at: stage === "ganada" ? opportunity.closed_at : null, done: !lost && index <= reached }));
  const weighted = (opportunity.amount_pen * opportunity.probability) / 100;

  return (
    <ToneScope tone={STAGE_TONE[opportunity.stage]}>
      <PageHeader
        back={{ href: "/crm/oportunidades", label: "Oportunidades" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Filter size={24} />
          </span>
        }
        title={opportunity.title}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={STAGE_TONE[opportunity.stage]}>{stageName(opportunity.stage)}</Badge>
          </span>
        }
        subtitle={opportunity.code}
        actions={catalogs ? <OpportunityActions opportunity={opportunity} lostReasons={catalogs.lost_reason} /> : undefined}
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Monto estimado</p>
            <p className="mt-1 text-[38px] font-bold leading-none tracking-[-0.03em]">{formatMoney(opportunity.amount, opportunity.currency)}</p>
            {opportunity.currency !== "PEN" && <p className="mt-2 text-[13.5px] text-white/75">{formatMoney(opportunity.amount_pen)} al cambio de hoy</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroChip icon={<CalendarClock size={14} />}>{opportunity.closed_at ? `Cerrada el ${formatDate(opportunity.closed_at)}` : `Cierre esperado el ${formatDate(opportunity.expected_close_date)}`}</HeroChip>
              {opportunity.destination && <HeroChip icon={<MapPin size={14} />}>{opportunity.destination}</HeroChip>}
              {opportunity.pax > 0 && <HeroChip icon={<Users size={14} />}>{opportunity.pax} pasajeros</HeroChip>}
            </div>
          </div>
          <HeroPanel solid>
            <p className="mb-3.5 text-[13.5px] font-semibold">{lost ? "Se perdió" : "Avance de la venta"}</p>
            {lost ? (
              <p className="flex items-start gap-2 text-[13.5px] text-fg-2">
                <CircleX size={16} className="mt-0.5 flex-none text-fg-3" />
                <span>
                  <b className="text-fg">{opportunity.lost_reason}</b>
                  {opportunity.lost_at_stage ? ` en ${stageName(opportunity.lost_at_stage).toLowerCase()}` : ""}
                  {opportunity.lost_detail ? `. ${opportunity.lost_detail}` : ""}
                </span>
              </p>
            ) : (
              <Journey steps={steps} formatAt={(iso) => formatDate(iso).replace(/ \d{4}$/, "")} />
            )}
          </HeroPanel>
        </div>
      </HeroBand>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Percent} tone="sun" label="Probabilidad" value={`${opportunity.probability} %`} note={`${formatMoney(weighted, "PEN", { compact: true })} ponderado`} />
        <TintTile icon={UserRound} tone="t1" label="Cliente" value={<Link href={`/crm/clientes/${opportunity.client.code}`} className="text-[16px] hover:underline">{opportunity.client.name}</Link>} />
        <TintTile icon={Users} tone="t4" label="Responsable" value={<span className="text-[16px]">{shortName(opportunity.owner.name)}</span>} />
        <TintTile
          icon={Filter}
          tone="violet"
          label="Origen"
          value={<span className="text-[16px]">{opportunity.lead ? <Link href={`/crm/leads/${opportunity.lead.code}`} className="hover:underline">Lead {opportunity.lead.code}</Link> : "Venta directa"}</span>}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <TintCardTitle icon={FileText} title="Cotizaciones" aside={String(opportunity.quotes.length)} />
          {opportunity.quotes.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Todavía no tiene cotizaciones.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {opportunity.quotes.map((quote) => (
                <li key={quote.code}>
                  <Link href={`/cotizaciones/${quote.code}`} className={cn("flex items-center gap-3 rounded-[12px] px-3.5 py-3", SOFT_TINT)}>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{quote.title}</b>
                      <span className="text-xs text-fg-3">
                        {quote.code} · válida hasta el {formatDate(quote.valid_until)}
                      </span>
                    </span>
                    <StatusBadge status={quote.status} />
                    <ArrowRight size={15} className="flex-none text-[var(--tint)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={History} title="Historial" />
          {opportunity.history.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Sin cambios desde que se creó.</p>
          ) : (
            <ol className="flex flex-col">
              {opportunity.history.map((event) => (
                <li key={`${event.occurred_at}-${event.action}`} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                  <span className="min-w-0 flex-1">
                    {event.action === "crear" ? "Se creó" : event.action === "reabrir" ? "Se reabrió" : "Pasó"}
                    {event.before_value && event.action !== "crear" ? ` de ${stageName(event.before_value).toLowerCase()}` : ""}
                    {event.after_value && event.action !== "crear" ? ` a ${stageName(event.after_value).toLowerCase()}` : ""}
                  </span>
                  <span className="text-xs text-fg-3">{formatDateTime(event.occurred_at, false)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </ToneScope>
  );
}
