import { ArrowRight, CalendarCheck, CalendarClock, CircleX, FilePlus2, FileText, Filter, Mail, MapPin, Package, Percent, Phone, TriangleAlert, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { HeroBand, HeroChip, HeroPanel, Journey, SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { ActivityCreateAction } from "@/features/activities/ActivityForms";
import { RelatedActivities } from "@/features/activities/ActivityRow";
import { RecordHistory } from "@/features/crm/RecordHistory";
import { OpportunityActions, OpportunityReassignAction } from "@/features/opportunities/OpportunityActions";
import { OpportunityEditAction } from "@/features/opportunities/OpportunityForms";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, shortName } from "@/lib/format";
import { OPEN_STAGES, STAGE_TONE } from "@/lib/opportunities";
import { getRelatedOptions } from "@/lib/server/activities";
import { getCatalogs } from "@/lib/server/leads";
import { currentUser } from "@/lib/server/me";
import { getOpportunity, getOpportunityFormOptions } from "@/lib/server/opportunities";
import { statusLabel } from "@/lib/tone";

export async function generateMetadata({ params }: PageProps<"/crm/oportunidades/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getOpportunity(code)).title };
}

export default async function OportunidadPage({ params }: PageProps<"/crm/oportunidades/[code]">) {
  const { code } = await params;
  const [opportunity, catalogs, options, activityOptions, me] = await Promise.all([getOpportunity(code), getCatalogs(), getOpportunityFormOptions(), getRelatedOptions(), currentUser()]);
  const stageName = (stage: string | null) => opportunity.stages.find((item) => item.code === stage)?.name ?? stage ?? "";
  const lost = opportunity.stage === "perdida";
  const open = OPEN_STAGES.includes(opportunity.stage);
  const order = [...OPEN_STAGES, "ganada"];
  const reached = order.indexOf(opportunity.stage);
  const steps = order.map((stage, index) => ({ label: stageName(stage), at: stage === "ganada" ? opportunity.closed_at : null, done: !lost && index <= reached }));
  const weighted = (opportunity.amount_pen * opportunity.probability) / 100;
  const canQuote = open && me.permissions.includes("quotes.create");
  const card = opportunity.client_card;
  const translate = (value: string) => {
    const stage = opportunity.stages.find((item) => item.code === value);
    return stage ? stage.name : statusLabel(value);
  };

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
        actions={
          <>
            {options && <OpportunityEditAction opportunity={opportunity} options={options} />}
            {options && <OpportunityReassignAction opportunity={opportunity} advisors={options.advisors} />}
            {catalogs && <OpportunityActions opportunity={opportunity} lostReasons={catalogs.lost_reason} />}
          </>
        }
      />

      {opportunity.close_overdue && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-warn/10 px-4 py-3 text-[13px] text-warn">
          <TriangleAlert size={16} className="mt-0.5 flex-none" />
          La fecha de cierre esperada ({formatDate(opportunity.expected_close_date)}) ya pasó. Actualízala o marca la oportunidad como ganada o perdida.
        </p>
      )}

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
              {opportunity.product && (
                <Link href={`/catalogo/productos/${encodeURIComponent(opportunity.product.code)}`} className="transition hover:brightness-110">
                  <HeroChip icon={<Package size={14} />}>{opportunity.product.name}</HeroChip>
                </Link>
              )}
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
        <TintTile icon={Percent} tone="sun" label="Probabilidad" value={`${opportunity.probability} %`} note={`${formatMoney(weighted, "PEN", { compact: true })} ponderado`} info={<p>Probabilidad por defecto de la etapa, o la que se fijó al editar. El ponderado es el monto en soles por esa probabilidad.</p>} />
        <TintTile icon={CalendarCheck} tone="t1" label="Actividades pendientes" value={opportunity.pending_activities} info={<p>Llamadas, reuniones y tareas sin completar de la oportunidad, de su lead de origen y de sus cotizaciones.</p>} />
        <TintTile icon={Users} tone="t4" label="Responsable" value={<span className="text-[16px]">{shortName(opportunity.owner.name)}</span>} info={<p>Asesor dueño de la oportunidad. Solo la gerencia la reasigna.</p>} />
        <TintTile
          icon={Filter}
          tone="violet"
          label="Origen"
          value={<span className="text-[16px]">{opportunity.lead ? <Link href={`/crm/leads/${opportunity.lead.code}`} className="hover:underline">Lead {opportunity.lead.code}</Link> : opportunity.origin === "fidelizacion" ? "Recompra" : "Venta directa"}</span>}
          info={<p>De dónde nació: la conversión de un lead, una recompra desde postventa o el alta manual.</p>}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <TintCardTitle
            icon={UserRound}
            title="Cliente"
            aside={
              <Link href={`/crm/clientes/${opportunity.client.code}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                Ver ficha 360
                <ArrowRight size={14} />
              </Link>
            }
          />
          <p className="mb-3 text-[15px] font-semibold">{opportunity.client.name}</p>
          <FieldList
            fields={[
              { label: "Documento", value: card.document ?? "—" },
              { label: "Segmento", value: card.segment ?? "—" },
              { label: "Correo", value: card.email ? <a href={`mailto:${card.email}`} className="hover:underline">{card.email}</a> : "—" },
              { label: "Teléfono", value: card.phone ?? "—" },
            ]}
          />
          {card.contact && (
            <div className={cn("mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[12px] px-3.5 py-3 text-[13px]", SOFT_TINT)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-semibold text-[var(--tint)]">Contacto principal</span>
                <b className="font-semibold">{card.contact.name}</b>
                {card.contact.role && <span className="text-fg-3"> · {card.contact.role}</span>}
              </span>
              {card.contact.email && (
                <a href={`mailto:${card.contact.email}`} className="inline-flex items-center gap-1 text-fg-2 hover:underline">
                  <Mail size={13} />
                  {card.contact.email}
                </a>
              )}
              {card.contact.phone && (
                <span className="inline-flex items-center gap-1 text-fg-2">
                  <Phone size={13} />
                  {card.contact.phone}
                </span>
              )}
            </div>
          )}
        </Card>
        <Card>
          <TintCardTitle
            icon={FileText}
            title="Cotizaciones"
            aside={
              canQuote ? (
                <Button href={`/cotizaciones/nueva?oportunidad=${encodeURIComponent(opportunity.code)}`} size="sm" variant="secondary" icon={<FilePlus2 size={15} />}>
                  Crear cotización
                </Button>
              ) : undefined
            }
          />
          {opportunity.quotes.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">{open ? "Todavía no tiene cotizaciones. Al crear la primera, la oportunidad pasa sola a la etapa Cotización." : "No tuvo cotizaciones."}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {opportunity.quotes.map((quote) => (
                <li key={quote.code}>
                  <Link href={`/cotizaciones/${quote.code}`} className={cn("flex items-center gap-3 rounded-[12px] px-3.5 py-3 transition hover:brightness-[0.98]", SOFT_TINT)}>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{quote.title}</b>
                      <span className="text-xs text-fg-3">
                        {quote.code} · versión {quote.version} · válida hasta el {formatDate(quote.valid_until)}
                      </span>
                    </span>
                    {quote.total !== null && <b className="font-mono text-[13px]">{formatMoney(quote.total, quote.currency)}</b>}
                    <StatusBadge status={quote.status} />
                    <ArrowRight size={15} className="flex-none text-[var(--tint)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <RelatedActivities
          activities={opportunity.activities}
          options={activityOptions}
          empty="Sin actividades de la oportunidad, de su lead ni de sus cotizaciones."
          action={activityOptions ? <ActivityCreateAction options={activityOptions} preset={{ type: "opportunity", code: opportunity.code, name: opportunity.title }} label="Actividad" size="sm" variant="secondary" /> : undefined}
        />
        <RecordHistory events={opportunity.history} current={opportunity.code} translate={translate} />
      </div>
    </ToneScope>
  );
}
