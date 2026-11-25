"use client";

import { BadgeCheck, BookOpen, CircleAlert, Coins, ExternalLink, EyeOff, FileWarning, Rocket, Ticket, Timer, Webhook, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Charts";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { type AgencyVisits, type BlogSyncStatus, type LandingSignup, type LandingSignups, SIGNUP_TONE } from "@/lib/tracking";

export function AgencyVisitsTable({ rows }: { rows: AgencyVisits[] }) {
  const columns: Column<AgencyVisits>[] = [
    {
      id: "agency",
      header: "Agencia",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="text-[13.5px] font-semibold">{row.name}</b>
          <span className="text-[12px] text-fg-3">
            {row.city} · {row.plan}
          </span>
        </span>
      ),
    },
    { id: "visits", header: "Visitas a sus tours", align: "right", cell: (row) => <span className="tabular-nums">{formatNumber(row.visits)}</span> },
    { id: "bookings", header: "Reservas", align: "right", cell: (row) => <span className="tabular-nums">{formatNumber(row.conversions)}</span> },
    { id: "rate", header: "Conversión", align: "right", mobile: "detail", cell: (row) => <span className="tabular-nums">{formatPercent(row.conversion_rate, 1)}</span> },
    { id: "trend", header: "Últimos 14 días", wideOnly: true, cell: (row) => <Sparkline values={row.trend} className="h-8 w-28" /> },
  ];
  const sorts: SortOption<AgencyVisits>[] = [
    { id: "visits", label: "Visitas", type: "number", value: (row) => row.visits },
    { id: "rate", label: "Conversión", type: "number", value: (row) => row.conversion_rate },
  ];
  const filters: FilterConfig<AgencyVisits>[] = [{ id: "plan", label: "Plan", options: [...new Set(rows.map((row) => row.plan))].map((plan) => ({ value: plan, label: plan })), value: (row) => row.plan }];
  const metrics: MetricFilter<AgencyVisits>[] = [
    { id: "with", label: "Con reservas", tone: "ok", icon: <Ticket size={19} />, info: <p>Agencias con al menos una reserva desde la vitrina en los últimos 30 días.</p>, matches: (row) => row.conversions > 0 },
    { id: "without", label: "Sin visitas", tone: "mute", icon: <EyeOff size={19} />, info: <p>Agencias cuyas fichas no recibieron visitas en los últimos 30 días.</p>, matches: (row) => row.visits === 0 },
  ];

  return <DataTable screen="vitrina-agencias" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="agencias" searchText={(row) => `${row.name} ${row.city}`} searchPlaceholder="Buscar agencia o ciudad" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no hay agencias en la vitrina" />;
}

export function BlogSyncPanel({ status }: { status: BlogSyncStatus }) {
  const last = status.last_webhook;
  const columns: Column<BlogSyncStatus["posts"][number]>[] = [
    {
      id: "post",
      header: "Artículo",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="text-[13.5px] font-semibold">{row.title}</b>
          <span className="font-mono text-[11.5px] text-fg-3">/blog/{row.slug}</span>
        </span>
      ),
    },
    { id: "source", header: "Origen", cell: (row) => <Badge tone={row.source === "payload" ? "info" : "mute"}>{row.source === "payload" ? "Payload" : "Nativo"}</Badge> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={row.status === "publicado" ? "ok" : row.status === "archivado" ? "mute" : "warn"}>{row.status === "publicado" ? "Publicado" : row.status === "en_revision" ? "Programado" : row.status === "archivado" ? "Archivado" : "Borrador"}</Badge> },
    { id: "words", header: "Palabras", align: "right", cell: (row) => <span className={cn("tabular-nums", row.word_count < 800 && "text-bad")}>{formatNumber(row.word_count)}</span> },
    { id: "seo", header: "SEO", align: "right", wideOnly: true, cell: (row) => <span className="tabular-nums">{row.seo_score ?? "—"}</span> },
    { id: "synced", header: "Sincronizado", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.synced_at ? formatDateTime(row.synced_at) : "—"}</span> },
  ];

  const blogMetrics: MetricFilter<BlogSyncStatus["posts"][number]>[] = [
    { id: "synced", label: "Sincronizados", tone: last !== null && !last.ok ? "bad" : "info", icon: <Webhook size={19} />, display: formatNumber(status.kpis.synced), note: `${status.kpis.published} publicados · último webhook ${last ? formatDateTime(last.at) : "sin llamadas"}`, info: <p>Artículos del índice platform_blog_posts que llegaron desde Payload por el webhook firmado (X-Kipu-Signature, HMAC) al publicar, despublicar o cambiar el slug. La nota muestra la última llamada{last ? `: ${last.ok ? "correcta" : "con error"}${last.note ? `, ${last.note}` : ""}` : status.configured ? "; la clave ya está configurada" : "; falta la clave del webhook"}.</p>, matches: (row) => row.source === "payload" },
    { id: "short", label: "Bajo 800 palabras", tone: status.kpis.below_minimum > 0 ? "warn" : "ok", icon: <FileWarning size={19} />, display: formatNumber(status.kpis.below_minimum), note: "No se pueden publicar (VT-13)", info: <p>Borradores con menos de 800 palabras; la base rechaza publicarlos.</p>, matches: (row) => row.word_count < 800 && row.status !== "publicado" },
    { id: "native", label: "Nativos sin Payload", tone: "mute", icon: <BookOpen size={19} />, display: formatNumber(status.kpis.pending), note: "Se enlazan por slug", info: <p>Artículos del blog anterior que todavía no tienen una entrada en Payload; al publicarlos en Payload con el mismo slug se enlazan.</p>, matches: (row) => row.source === "nativo" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line bg-surface-2/50 px-4 py-3 text-[13px] text-fg-2">
        <span className="inline-flex items-center gap-2">
          {status.configured ? <BadgeCheck size={16} className="text-ok" /> : <CircleAlert size={16} className="text-warn" />}
          Los artículos se escriben y publican en Payload; aquí se ve el índice sincronizado y si cumplen las reglas SEO.
        </span>
        <span className="inline-flex flex-wrap items-center gap-3">
          <Link href="/plataforma/integraciones/blog-de-la-vitrina" className="font-semibold text-accent hover:underline">
            {status.configured ? "Clave de firma" : "Generar la clave de firma"}
          </Link>
          <a href={status.admin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            Abrir panel de Payload <ExternalLink size={13} />
          </a>
        </span>
      </div>
      <DataTable screen="vitrina-blog" rows={status.posts} columns={columns} getKey={(row) => row.payload_id ?? row.slug} entityLabel="artículos" searchText={(row) => `${row.title} ${row.slug} ${row.focus_keyword}`} searchPlaceholder="Buscar artículo o slug" metrics={blogMetrics} emptyTitle="Aún no hay artículos" />
    </div>
  );
}

export function SignupsPanel({ data }: { data: LandingSignups }) {
  const [monthAgo] = useState(() => Date.now() - 30 * 86_400_000);
  const max = Math.max(1, ...data.funnel.map((step) => step.count));
  const columns: Column<LandingSignup>[] = [
    {
      id: "agency",
      header: "Agencia",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="text-[13.5px] font-semibold">{row.agency}</b>
          <span className="text-[12px] text-fg-3">
            {row.email} · RUC {row.ruc}
          </span>
        </span>
      ),
    },
    { id: "plan", header: "Plan", cell: (row) => <span className="text-[13px]">{row.plan} · {row.cycle === "anual" ? "anual" : row.cycle === "prueba" ? "prueba" : "mensual"}</span> },
    { id: "total", header: "Total", align: "right", cell: (row) => <span className="tabular-nums">{formatMoney(row.total)}</span> },
    { id: "source", header: "Origen", wideOnly: true, cell: (row) => <span className="text-[12.5px]">{row.source}{row.campaign ? ` · ${row.campaign}` : ""}</span> },
    { id: "invoice", header: "Comprobante", wideOnly: true, cell: (row) => <span className="font-mono text-[12px]">{row.invoice ?? "—"}</span> },
    { id: "state", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={SIGNUP_TONE[row.state]}>{row.state_label}</Badge> },
    { id: "at", header: "Alta", cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDateTime(row.created_at)}</span> },
  ];
  const metrics: MetricFilter<LandingSignup>[] = [
    { id: "recent", label: "Altas (30 días)", tone: "t4", icon: <Rocket size={19} />, display: formatNumber(data.kpis.last_30_days), note: `${data.kpis.total} en total`, info: <p>Agencias creadas desde la landing en los últimos 30 días, según la marca de alta guardada en cada agencia.</p>, matches: (row) => new Date(row.created_at).getTime() >= monthAgo },
    { id: "paid", label: "Pagadas", tone: "ok", icon: <Coins size={19} />, note: `${formatPercent(data.kpis.conversion_rate, 1)} de conversión · ${formatMoney(data.kpis.new_mrr)} recurrente nuevo`, info: <p>Altas que ya pagaron su plan. La nota es la conversión a pago (pagadas sobre el total de altas) y la suma del precio mensual del plan de las altas pagadas, sin IGV.</p>, matches: (row) => row.state === "pagada" },
    { id: "trial", label: "En prueba", tone: "info", icon: <Timer size={19} />, note: "14 días sin tarjeta", info: <p>Altas en prueba gratuita; siguen los avisos y la suspensión de la suscripción.</p>, matches: (row) => row.state === "prueba" },
    { id: "pending", label: "Pago pendiente", tone: "warn", icon: <CircleAlert size={19} />, info: <p>Altas cuyo pago no se completó o fue rechazado; si pasan 24 horas sin pagar se cuentan como abandonadas.</p>, matches: (row) => row.state === "pago_pendiente" || row.state === "fallida" },
    { id: "abandoned", label: "Abandonadas", tone: "mute", icon: <XCircle size={19} />, info: <p>Altas que dejaron el pago pendiente por más de 24 horas.</p>, matches: (row) => row.state === "abandonada" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="lift rounded-card border border-line bg-surface p-4">
        <h3 className="mb-3 text-[14.5px] font-semibold">Embudo de la landing</h3>
        <ol className="flex flex-col gap-2.5">
          {data.funnel.map((step, index) => (
            <li key={step.step} className="group grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_48px] items-center gap-3 text-[13px]">
              <span className="truncate">{step.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full origin-left rounded-full transition-[filter] duration-200 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]" style={{ width: `${Math.max(3, (step.count / max) * 100)}%`, background: `color-mix(in srgb, var(--accent) ${100 - index * 18}%, var(--ok))` }} />
              </span>
              <b className="text-right tabular-nums">{step.count}</b>
            </li>
          ))}
        </ol>
      </section>
      <DataTable screen="vitrina-altas" rows={data.rows} columns={columns} getKey={(row) => row.tenant} entityLabel="altas" searchText={(row) => `${row.agency} ${row.email} ${row.ruc} ${row.source}`} searchPlaceholder="Buscar agencia, correo o RUC" metrics={metrics} emptyTitle="Aún no hay altas desde la landing" />
    </div>
  );
}
