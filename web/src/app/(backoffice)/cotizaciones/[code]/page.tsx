import { CalendarDays, ClipboardList, FileText, History, Pencil, Route, Target, UserRound, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { HeroBand, HeroChip, HeroPanel, Journey, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { QuoteLifecycleActions } from "@/features/quotes/QuoteActions";
import { QuoteConvertAction } from "@/features/quotes/QuoteConvertAction";
import { QuoteVersions } from "@/features/quotes/QuoteVersions";
import { formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { paxLabel, QUOTE_JOURNEY } from "@/lib/quotes";
import { getQuote, getQuoteConversion } from "@/lib/server/quotes";
import { statusTone } from "@/lib/tone";

export async function generateMetadata({ params }: PageProps<"/cotizaciones/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getQuote(code)).title };
}

const ACTION_LABEL: Record<string, string> = { crear: "Creada", editar: "Editada", enviar: "Enviada", aprobar: "Aprobada", rechazar: "Rechazada", nueva_version: "Nueva versión", convertir: "Convertida en reserva", negociacion: "Negociación", solicitar_aprobacion: "Aprobación interna pedida", aprobar_interna: "Aprobada por Gerencia", rechazar_interna: "Gerencia no la aprobó" };

export default async function CotizacionPage({ params }: PageProps<"/cotizaciones/[code]">) {
  const { code } = await params;
  const quote = await getQuote(code);
  const conversion = quote.status === "aprobada" && quote.can.register_approval ? await getQuoteConversion(code) : null;
  const reached = Math.max(QUOTE_JOURNEY.findIndex((step) => step.status === quote.status), quote.status === "convertida" ? QUOTE_JOURNEY.length - 1 : -1);
  const closed = ["rechazada", "vencida"].includes(quote.status);
  const steps = QUOTE_JOURNEY.map((step, index) => ({ label: step.label, at: null, done: !closed && index <= reached }));
  const current = quote.versions[0];

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
            <StatusBadge status={quote.status} />
          </span>
        }
        subtitle={`${quote.code} · versión ${quote.version}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {quote.status === "borrador" && quote.can.edit && (
              <Link href={`/cotizaciones/${quote.code}/editar`} className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 text-[13.5px] font-semibold transition-transform duration-300 hover:-translate-y-0.5">
                <Pencil size={16} />
                Editar
              </Link>
            )}
            <QuoteLifecycleActions quote={quote} />
            {conversion && <QuoteConvertAction conversion={conversion} lockVersion={quote.lock_version} />}
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
        <TintTile icon={Target} tone="violet" label="Oportunidad" value={quote.opportunity ? <Link href={`/crm/oportunidades/${quote.opportunity.code}`} className="text-[16px] hover:underline">{quote.opportunity.code}</Link> : <span className="text-[14px] text-fg-3">Sin oportunidad</span>} note={quote.opportunity?.title} />
        <TintTile
          icon={quote.reservation ? Route : CalendarDays}
          tone="sun"
          label={quote.reservation ? "Reserva" : "Vigencia"}
          value={quote.reservation ? <Link href={`/reservas/${quote.reservation.code}`} className="text-[16px] hover:underline">{quote.reservation.code}</Link> : <span className="text-[16px]">{quote.days_left === null ? formatDate(quote.valid_until) : quote.days_left < 0 ? "Vencida" : quote.days_left === 0 ? "Vence hoy" : `${quote.days_left} días`}</span>}
          note={quote.reservation ? "Generada desde esta cotización" : `Hasta el ${formatDate(quote.valid_until)}`}
        />
        <TintTile icon={Wallet} tone="t4" label="Margen" value={quote.margin_pct === null ? <span className="text-[14px] text-fg-3">Solo Finanzas y Gerencia</span> : `${quote.margin_pct} %`} note={`Responsable: ${shortName(quote.owner.name)}`} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={ClipboardList} title="Servicios cotizados" aside={current ? `${current.items.length} ${current.items.length === 1 ? "servicio" : "servicios"}` : undefined} />
          <QuoteVersions versions={quote.versions} currency={quote.currency} seeMargin={quote.see_margin} />
        </Card>
        <Card>
          <TintCardTitle icon={History} title="Historial" />
          <ol className="flex flex-col gap-3 border-l-2 border-[color-mix(in_srgb,var(--tint)_25%,transparent)] pl-4">
            {quote.versions.map((version) => (
              <li key={version.number} className="relative text-[13px]">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
                <b className="font-semibold">Versión {version.number}</b> · {formatDate(version.issued_on)}
                <span className="block text-xs text-fg-3">
                  {version.author} · {formatMoney(version.totals.grand, quote.currency)}
                  {version.notes ? ` · ${version.notes}` : ""}
                </span>
              </li>
            ))}
            {quote.viewed_at && (
              <li className="relative text-[13px]">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
                <b className="font-semibold">El cliente la abrió</b>
                <span className="block text-xs text-fg-3">{formatDateTime(quote.viewed_at)}</span>
              </li>
            )}
            {quote.history.map((event, index) => (
              <li key={index} className="relative text-[13px]">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
                <b className="font-semibold">{ACTION_LABEL[event.action] ?? event.action}</b>
                <span className="block text-xs text-fg-3">
                  {formatDateTime(event.occurred_at)}
                  {event.after_value && !["crear", "editar"].includes(event.action) ? ` · ${event.after_value}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </ToneScope>
  );
}
