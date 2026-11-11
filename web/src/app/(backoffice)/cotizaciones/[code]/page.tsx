import { BadgeCheck, CalendarDays, ClipboardList, FileText, History, Layers, Route, Send, Target, TrendingUp, UserRound, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { HeroBand, HeroChip, HeroPanel, Journey, TintTile, ToneScope } from "@/components/ui/Tinted";
import { QuoteLifecycleActions } from "@/features/quotes/QuoteActions";
import { QuoteConvertAction } from "@/features/quotes/QuoteConvertAction";
import { QuoteDuplicateAction, QuoteReassignAction } from "@/features/quotes/QuoteCopyActions";
import { ActivitySection, DetailSection, PricingSection, TrackingSection, VersionsSection } from "@/features/quotes/QuoteSections";
import { QuoteWizardAction } from "@/features/quotes/wizard/QuoteWizard";
import { formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { paxLabel, QUOTE_JOURNEY } from "@/lib/quotes";
import { resolveSections } from "@/lib/sections";
import { getAdvisors } from "@/lib/server/leads";
import { getQuote, getQuoteActivity, getQuoteConversion, getQuoteFormOptions } from "@/lib/server/quotes";
import { statusLabel, statusTone } from "@/lib/tone";

export async function generateMetadata({ params }: PageProps<"/cotizaciones/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getQuote(code)).title };
}

const ACTION_LABEL: Record<string, string> = { registrar_vista: "Vista registrada", crear: "Creada", editar: "Editada", enviar: "Enviada", aprobar: "Aprobada", rechazar: "Rechazada", nueva_version: "Nueva versión", convertir: "Convertida en reserva", negociacion: "Negociación", solicitar_aprobacion: "Aprobación interna pedida", aprobar_interna: "Aprobada por Gerencia", rechazar_interna: "Gerencia no la aprobó", duplicar: "Duplicada", reasignar: "Reasignada", vencer: "Venció", anular_aprobacion_interna: "Aprobación interna anulada" };

export default async function CotizacionPage({ params, searchParams }: PageProps<"/cotizaciones/[code]">) {
  const [{ code }, { editar, seccion }] = await Promise.all([params, searchParams]);
  const quote = await getQuote(code);
  const editOptions = quote.status === "borrador" && quote.can.edit ? await getQuoteFormOptions() : null;
  const advisors = quote.can.reassign ? await getAdvisors() : [];
  const conversion = quote.status === "aprobada" && quote.can.register_approval ? await getQuoteConversion(code) : null;
  const reached = Math.max(QUOTE_JOURNEY.findIndex((step) => step.status === quote.status), quote.status === "convertida" ? QUOTE_JOURNEY.length - 1 : -1);
  const closed = ["rechazada", "vencida"].includes(quote.status);
  const steps = QUOTE_JOURNEY.map((step, index) => ({ label: step.label, status: step.status, at: null, done: !closed && index <= reached }));
  const base = `/cotizaciones/${encodeURIComponent(quote.code)}`;
  const { active, groups } = resolveSections(
    base,
    [
      { group: "Cotización", id: "detalle", label: "Detalle e ítems", icon: <ClipboardList size={15} />, count: quote.versions[0]?.items.length },
      { group: "Cotización", id: "versiones", label: "Versiones", icon: <Layers size={15} />, count: quote.versions.length },
      { group: "Cotización", id: "pricing", label: "Pricing", icon: <TrendingUp size={15} />, show: quote.see_margin },
      { group: "Seguimiento", id: "seguimiento", label: "Envío y seguimiento", icon: <Send size={15} />, count: quote.timeline.length },
      { group: "Control", id: "actividad", label: "Actividad", icon: <History size={15} /> },
    ],
    editar ? undefined : seccion,
  );
  const body = await (async () => {
    switch (active) {
      case "versiones":
        return <VersionsSection quote={quote} />;
      case "pricing":
        return <PricingSection quote={quote} />;
      case "seguimiento":
        return <TrackingSection quote={quote} />;
      case "actividad":
        return <ActivitySection events={await getQuoteActivity(code)} labels={ACTION_LABEL} />;
      default:
        return <DetailSection quote={quote} />;
    }
  })();

  return (
    <ToneScope tone={statusTone(quote.status)}>
      <PageHeader
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <FileText size={24} />
          </span>
        }
        title={quote.title}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={quote.status} primary />
          </span>
        }
        subtitle={`${quote.code} · versión ${quote.version}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {editOptions && <QuoteWizardAction options={editOptions} quote={quote} defaultOpen={editar === "1"} />}
            <DownloadButton href={`/cotizaciones/${quote.code}/pdf/${quote.version}`} label="Propuesta PDF" iconOnlyOnMobile />
            <QuoteLifecycleActions quote={quote} />
            {quote.can.duplicate && <QuoteDuplicateAction quote={quote} />}
            {quote.can.reassign && quote.status !== "convertida" && <QuoteReassignAction quote={quote} advisors={advisors} />}
            {conversion && <QuoteConvertAction conversion={conversion} lockVersion={quote.lock_version} canVersion={quote.can.edit} />}
          </div>
        }
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Total de la versión vigente</p>
            <p className="mt-1 text-[38px] font-bold leading-none tracking-[-0.03em]">{formatMoney(quote.total, quote.currency)}</p>
            {quote.currency !== "PEN" && <p className="mt-2 text-[13.5px] text-white/75">{formatMoney(quote.total_pen)} al cambio de la cotización</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroChip icon={<CalendarDays size={14} />}>
                {formatDate(quote.travel_from).replace(/ \d{4}$/, "")} al {formatDate(quote.travel_to)}
              </HeroChip>
              <HeroChip icon={<Users size={14} />}>{paxLabel(quote.pax)}</HeroChip>
            </div>
          </div>
          <HeroPanel solid>
            <p className="mb-3 text-[13.5px] font-semibold">{closed ? (quote.status === "rechazada" ? "El cliente la rechazó" : "Venció sin respuesta") : "Avance de la cotización"}</p>
            {closed ? (
              <p className="text-[13.5px] text-fg-2">{quote.rejected_reason ?? `La vigencia terminó el ${formatDate(quote.valid_until)}.`}</p>
            ) : (
              <Journey steps={steps} formatAt={(iso) => formatDate(iso)} />
            )}
          </HeroPanel>
        </div>
      </HeroBand>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={UserRound} tone="t1" label="Cliente" value={<Link href={`/crm/clientes/${quote.client.code}`} className="text-[16px] hover:underline">{quote.client.name}</Link>} note={quote.client.code} />
        <TintTile icon={Target} tone="violet" label="Oportunidad" value={quote.opportunity ? <Link href={`/crm/oportunidades/${quote.opportunity.code}`} className="text-[16px] hover:underline">{quote.opportunity.code}</Link> : <span className="text-[14px] text-fg-3">Sin oportunidad</span>} note={quote.opportunity ? `${quote.opportunity.title}${quote.opportunity.stage ? ` · etapa ${statusLabel(quote.opportunity.stage).toLowerCase()}` : ""}` : undefined} />
        <TintTile
          icon={quote.reservation ? Route : CalendarDays}
          tone="sun"
          label={quote.reservation ? "Reserva" : "Vigencia"}
          value={quote.reservation ? <Link href={`/reservas/${quote.reservation.code}`} data-testid="quote-reservation-link" className="text-[16px] hover:underline">{quote.reservation.code}</Link> : <span className="text-[16px]">{quote.days_left === null ? formatDate(quote.valid_until) : quote.days_left < 0 ? "Vencida" : quote.days_left === 0 ? "Vence hoy" : quote.days_left === 1 ? "1 día" : `${quote.days_left} días`}</span>}
          note={quote.reservation ? "Generada desde esta cotización" : `Hasta el ${formatDate(quote.valid_until)}`}
        />
        <TintTile icon={Wallet} tone="t4" label="Margen" value={quote.margin_pct === null ? <span className="text-[14px] text-fg-3">Solo Finanzas y Gerencia</span> : `${quote.margin_pct} %`} note={`Responsable: ${shortName(quote.owner.name)}`} />
      </section>

      {quote.status === "vencida" && (
        <p className="mb-5 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]">
          <b className="font-semibold">Venció el {formatDate(quote.valid_until)}.</b> Ya no puede aprobarse ni enviarse; crea una nueva versión para renovar la vigencia.
        </p>
      )}
      {quote.approval && ["aprobada", "convertida"].includes(quote.status) && (
        <p data-testid="quote-approved-notice" className="mb-5 flex flex-wrap items-center gap-x-2 rounded-card border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_9%,transparent)] px-4 py-3 text-[13.5px]">
          <BadgeCheck size={16} className="flex-none text-ok" />
          <b className="font-semibold">Aprobada por el cliente{quote.approval.version ? ` en la versión ${quote.approval.version}` : ""}.</b>
          <span className="text-fg-2">
            {[quote.approval.by, formatDateTime(quote.approval.at), quote.approval.channel, quote.approval.reference ? `ref. ${quote.approval.reference}` : null].filter(Boolean).join(" · ")}
          </span>
        </p>
      )}
      {quote.internal?.required && quote.internal.status === "pendiente" && (
        <p className="mb-5 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]">
          <b className="font-semibold">Esperando a Gerencia.</b> No se puede enviar al cliente hasta que se decida la aprobación interna.{" "}
          {active !== "seguimiento" && (
            <Link href={`${base}?seccion=seguimiento`} scroll={false} className="font-semibold text-[var(--tint)] hover:underline">
              Ver la solicitud
            </Link>
          )}
        </p>
      )}

      <SectionLayout nav={<SectionNav label="Secciones de la cotización" groups={groups} active={active} testId="quote-sections" />}>{body}</SectionLayout>
    </ToneScope>
  );
}
