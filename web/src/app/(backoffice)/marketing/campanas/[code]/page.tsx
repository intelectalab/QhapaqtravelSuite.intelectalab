import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { CampaignDetailAction, CampaignFormAction } from "@/features/marketing/CampaignForms";
import { CampaignAudienceView, CampaignHistory, CampaignRecipientsTable } from "@/features/marketing/CampaignDetail";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { campaignHref, rate, type CampaignAudienceDetail, type CampaignDetail, type CampaignRecipient, type MarketingOverview } from "@/lib/marketing";
import { apiFetch } from "@/lib/server/api";
import { getCachedResource } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";

const load = (code: string) => getCachedResource<CampaignDetail>(`/marketing/campaigns/${encodeURIComponent(code)}`, "No pudimos cargar la campaña.");

const SECTIONS = ["resumen", "audiencia", "destinatarios", "historial"] as const;

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const campaign = await load(code);
  return { title: campaign ? campaign.name : "Campaña" };
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ seccion?: string | string[] }> }) {
  const { code } = await params;
  const { seccion } = await searchParams;
  const campaign = await load(code);
  if (!campaign) notFound();

  const section = SECTIONS.find((item) => item === seccion) ?? "resumen";
  const base = campaignHref(campaign.code);
  const [audience, recipients, overview] = await Promise.all([
    section === "audiencia" ? getCachedResource<CampaignAudienceDetail>(`/marketing/campaigns/${encodeURIComponent(campaign.code)}/audience`, "No pudimos calcular la audiencia.") : null,
    section === "destinatarios" ? apiFetch<{ data: CampaignRecipient[]; meta: { next_cursor: string | null } }>(`/marketing/campaigns/${encodeURIComponent(campaign.code)}/recipients?page[size]=100`, { raw: true }) : null,
    campaign.can.manage ? getCachedResource<MarketingOverview>("/marketing/campaigns", "No pudimos cargar marketing.") : null,
  ]);
  const { metrics } = campaign;
  const facts = [
    { label: "Destinatarios", value: formatNumber(metrics.recipients || campaign.audience?.eligible || 0) },
    { label: "Entregados", value: formatNumber(metrics.delivered) },
    { label: "Apertura", value: campaign.status === "enviada" ? formatPercent(rate(metrics.opened, metrics.delivered), 0) : "—" },
    { label: "Clics", value: campaign.status === "enviada" ? formatPercent(rate(metrics.clicked, metrics.delivered), 0) : "—" },
    { label: "Bajas", value: formatNumber(metrics.unsubscribed) },
    { label: "Ingresos atribuidos", value: formatMoney(campaign.attribution.revenue) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/marketing/campanas" className="mb-1 inline-flex items-center gap-1 text-[12.5px] text-fg-3 hover:text-accent">
            <ArrowLeft size={13} /> Campañas
          </Link>
          <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
            <span style={toneStyle(campaign.channel === "email" ? "info" : "ok")} className="grid h-7 w-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
              {campaign.channel === "email" ? <Mail size={15} /> : <MessageCircle size={15} />}
            </span>
            {campaign.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
            <StatusBadge status={campaign.status} label={campaign.status_label} />
            <span>{campaign.code} · {campaign.segment?.name ?? "Sin segmento"} · {campaign.template?.name ?? "Sin plantilla"}</span>
            {campaign.promo_code && <Badge tone="sun" dot={false}>Código {campaign.promo_code}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview && campaign.can.edit && <CampaignFormAction overview={overview} campaign={campaign} />}
          <CampaignDetailAction campaign={campaign} canManage={campaign.can.manage} testOptions={overview?.test_options} />
        </div>
      </div>

      <TabbedCard
        active={section === "resumen" ? base : `${base}?seccion=${section}`}
        tabs={[
          { href: base, label: "Resumen" },
          { href: `${base}?seccion=audiencia`, label: "Audiencia" },
          { href: `${base}?seccion=destinatarios`, label: "Destinatarios", count: metrics.recipients },
          { href: `${base}?seccion=historial`, label: "Historial", count: campaign.history.length },
        ]}
      >
        {section === "resumen" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
              {facts.map((fact, index) => (
                <div key={fact.label} style={{ animationDelay: `${index * 40}ms` }} className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-xl border border-line px-3 py-2.5">
                  <p className="text-[11.5px] text-fg-3">{fact.label}</p>
                  <p className="font-mono text-[15px] font-semibold">{fact.value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                {campaign.subject && <p className="mb-2 text-[13px]"><b>Asunto:</b> {campaign.subject}</p>}
                <p className="whitespace-pre-line rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed">{campaign.body}</p>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3 gap-y-1.5 text-[12.5px]">
                <dt className="text-fg-3">Responsable</dt>
                <dd>{campaign.owner ?? "—"}</dd>
                <dt className="text-fg-3">Creada</dt>
                <dd>{formatDateTime(campaign.created_at)}</dd>
                <dt className="text-fg-3">Envío</dt>
                <dd>{campaign.sent_at ? formatDateTime(campaign.sent_at) : campaign.scheduled_at ? `Programada ${formatDateTime(campaign.scheduled_at)}` : "Sin programar"}</dd>
                <dt className="text-fg-3">Seguimiento</dt>
                <dd className="truncate font-mono text-[11.5px]">{campaign.utm}</dd>
                {campaign.attribution.items.length > 0 && (
                  <>
                    <dt className="text-fg-3">Reservas</dt>
                    <dd>{campaign.attribution.items.map((item) => item.code).join(", ")}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        )}
        {section === "audiencia" && audience && <CampaignAudienceView audience={audience} />}
        {section === "destinatarios" && recipients?.ok && recipients.data && <CampaignRecipientsTable campaign={campaign} recipients={recipients.data.data} truncated={recipients.data.meta.next_cursor !== null} />}
        {section === "historial" && <CampaignHistory history={campaign.history} />}
      </TabbedCard>
    </div>
  );
}
