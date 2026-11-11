import { CalendarCheck, CheckCircle2, CircleAlert, ClipboardList, Eye, FileText, History, ListChecks, Map as MapIcon, MessagesSquare, Route, Send, ShieldCheck, ThumbsDown, ThumbsUp, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniTable, ProgressBar } from "@/components/ui/MiniTable";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { QuoteAuditEvent, QuoteDetail, QuoteTimelineEvent } from "@/lib/quotes";
import { statusLabel } from "@/lib/tone";
import { QuoteRecordViewAction } from "./QuoteActions";
import { QuoteCompare } from "./QuoteCompare";
import { QuoteVersions } from "./QuoteVersions";

const ACTIVITY_LABEL: Record<string, string> = { llamada: "Llamada", reunion: "Reunión", email: "Correo", whatsapp: "WhatsApp", tarea: "Tarea", visita: "Visita" };

export function DetailSection({ quote }: { quote: QuoteDetail }) {
  const current = quote.versions[0];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle
          icon={ClipboardList}
          title="Ítems de la cotización"
          aside={
            <span className="flex items-center gap-2">
              <QuoteCompare code={quote.code} versions={quote.versions.map((version) => version.number)} currency={quote.currency} />
              {current ? `${current.items.length} ${current.items.length === 1 ? "ítem" : "ítems"}` : null}
            </span>
          }
        />
        <QuoteVersions code={quote.code} versions={quote.versions} currency={quote.currency} seeMargin={quote.see_margin} />
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={FileText} title="Condiciones de la versión vigente" />
          {current ? (
            <FieldList
              fields={[
                { label: "Moneda", value: quote.currency === "PEN" ? "Soles" : `${quote.currency} · cambio ${current.fx_rate ?? quote.fx_rate}` },
                { label: "Pasajeros", value: [quote.pax.adt && `${quote.pax.adt} adultos`, quote.pax.chd && `${quote.pax.chd} niños`, quote.pax.inf && `${quote.pax.inf} infantes`].filter(Boolean).join(" · ") },
                { label: "Copia del catálogo", value: <span className="whitespace-normal">{current.snapshot}</span> },
                { label: "Condiciones comerciales", value: <span className="whitespace-normal">{current.conditions || "Las de cada producto"}</span> },
                ...(current.markup_pct ? [{ label: "Markup aplicado", value: `${Number(current.markup_pct)} %` }] : []),
                { label: "Edición", value: current.frozen_at ? `Congelada el ${formatDateTime(current.frozen_at)}` : current.status === "borrador" ? "Aún editable" : "Congelada al enviarse" },
              ]}
            />
          ) : (
            <p className="text-[13.5px] text-fg-3">Sin versión vigente.</p>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={MapIcon} title="Itinerario resumido" />
          {quote.itinerary.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Los productos de esta versión no tienen itinerario cargado.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {quote.itinerary.map((block) => (
                <li key={block.product.code}>
                  <p className="mb-1 text-[13.5px] font-semibold">
                    <Link href={`/catalogo/productos/${block.product.code}`} className="hover:underline">
                      {block.product.name}
                    </Link>
                    <span className="ml-2 text-[12px] font-normal text-fg-3">desde el {formatDate(block.start)}</span>
                  </p>
                  {block.days.length > 0 ? (
                    <ul className="ml-1 flex flex-col border-l-2 border-[color-mix(in_srgb,var(--tint)_30%,transparent)] pl-3">
                      {block.days.map((day) => (
                        <li key={day.day} className="py-0.5 text-[13px] text-fg-2">
                          <b className="mr-1.5 font-semibold text-fg">Día {day.day}</b>
                          {day.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-fg-3">Sin itinerario por días.</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

export function VersionsSection({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <TintCardTitle icon={History} title="Versiones" aside={<QuoteCompare code={quote.code} versions={quote.versions.map((version) => version.number)} currency={quote.currency} />} />
      <MiniTable head={["Versión", "Emitida", "Autor", "Ítems", "Total", ...(quote.see_margin ? ["Margen"] : []), "Desc.", "Estado", ""]} align={["left", "left", "left", "right", "right", ...(quote.see_margin ? ["right" as const] : []), "right", "left", "right"]} minWidth={680}>
        {quote.versions.map((version) => (
          <tr key={version.number}>
            <td>
              <b className="font-semibold">Versión {version.number}</b>
              {version.number === quote.version && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Vigente</span>}
              <span className="block text-xs text-fg-3">{version.snapshot}</span>
            </td>
            <td className="whitespace-nowrap">{formatDate(version.issued_on)}</td>
            <td>{version.author}</td>
            <td className="text-right tabular-nums">{version.item_count ?? version.items.length}</td>
            <td className="text-right font-mono">{formatMoney(version.totals.grand, quote.currency)}</td>
            {quote.see_margin && <td className={cn("text-right font-mono", version.totals.margin_pct !== null && Number(version.totals.margin_pct) < Number(quote.approval_rules.margin_floor) ? "text-warn" : "text-ok")}>{version.totals.margin_pct !== null ? `${version.totals.margin_pct} %` : "—"}</td>}
            <td className="text-right tabular-nums">{Number(version.discount_pct) > 0 ? `${version.discount_pct} %` : "—"}</td>
            <td>
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={version.status} />
                {version.internal_status && <span className="text-[11.5px] text-fg-3">Gerencia: {statusLabel(version.internal_status).toLowerCase()}</span>}
              </span>
            </td>
            <td className="text-right">
              <DownloadButton href={`/cotizaciones/${quote.code}/pdf/${version.number}`} label={`PDF de la versión ${version.number}`} size="sm" variant="ghost" iconOnly />
            </td>
          </tr>
        ))}
      </MiniTable>
      <p className="mt-3 text-[12.5px] text-fg-3">Las versiones enviadas quedan congeladas: las reservas y los documentos conservan la copia del catálogo con la que se emitieron.</p>
    </Card>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className={cn("flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px]", ok ? "bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]" : "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]")}>
      {ok ? <CheckCircle2 size={16} className="mt-0.5 flex-none text-ok" /> : <CircleAlert size={16} className="mt-0.5 flex-none text-warn" />}
      <span>
        <b className="block font-semibold">{label}</b>
        <span className="text-fg-2">{detail}</span>
      </span>
    </li>
  );
}

export function PricingSection({ quote }: { quote: QuoteDetail }) {
  const version = quote.versions[0];
  if (!version) return <Card><EmptyState icon={<TrendingUp size={20} />} title="Sin versión" description="La cotización no tiene una versión vigente." /></Card>;
  const rules = quote.approval_rules;
  const discount = Number(version.discount_pct);
  const margin = version.totals.margin_pct === null ? null : Number(version.totals.margin_pct);
  const internal = quote.internal_detail;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={TrendingUp} title="Desglose por línea" aside={`Versión ${version.number}`} />
        <MiniTable head={["Producto", "Fecha", "Temporada", "Costo", "Venta", "Utilidad", "Margen"]} align={["left", "left", "right", "right", "right", "right", "left"]} minWidth={720}>
          {version.items.map((item) => {
            const cost = Number(item.unit_cost ?? 0) * item.qty * item.pax;
            const sale = Number(item.total);
            const pct = item.margin_pct === null ? null : Number(item.margin_pct);
            const season = version.seasons?.[item.line];
            return (
              <tr key={item.line}>
                <td>
                  <b className="block font-semibold">{item.product.name}</b>
                  <span className="text-xs text-fg-3">
                    {item.pax} {item.segment.toLowerCase()}{item.pax === 1 ? "" : "s"}
                    {item.qty > 1 ? ` × ${item.qty}` : ""}
                  </span>
                </td>
                <td className="whitespace-nowrap">{formatDate(item.date)}</td>
                <td className="text-right tabular-nums">{season && Number(season) !== 1 ? `× ${Number(season).toFixed(2)}` : "Base"}</td>
                <td className="text-right font-mono">{formatMoney(cost, quote.currency)}</td>
                <td className="text-right font-mono">{formatMoney(sale, quote.currency)}</td>
                <td className="text-right font-mono">{formatMoney(sale - cost, quote.currency)}</td>
                <td className="w-[150px]">
                  {pct !== null && (
                    <span className="flex items-center gap-2">
                      <span className="flex-1">
                        <ProgressBar value={Math.max(0, pct) * 2} tone={pct < Number(rules.margin_floor) ? "warn" : "ok"} />
                      </span>
                      <span className="w-12 text-right text-[12px] tabular-nums">{pct} %</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </MiniTable>
        <dl className="mt-4 ml-auto grid max-w-[420px] grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          <dt className="text-fg-3">Venta</dt>
          <dd className="text-right font-mono">{formatMoney(version.totals.sale, quote.currency)}</dd>
          <dt className="text-fg-3">Costo</dt>
          <dd className="text-right font-mono">{formatMoney(version.totals.cost ?? 0, quote.currency)}</dd>
          <dt className="text-fg-3">Descuento</dt>
          <dd className="text-right font-mono">{formatMoney(version.totals.discount, quote.currency)}</dd>
          <dt className="border-t border-line-2 pt-1.5 font-semibold">Utilidad</dt>
          <dd className="border-t border-line-2 pt-1.5 text-right font-mono font-semibold">
            {formatMoney(version.totals.profit ?? 0, quote.currency)} · {version.totals.margin_pct ?? "—"} %
          </dd>
        </dl>
      </Card>
      <Card>
        <TintCardTitle icon={ShieldCheck} title="Control de aprobación interna" aside={internal ? <StatusBadge status={internal.status} /> : undefined} />
        <ul className="grid gap-2 md:grid-cols-3">
          <Check ok={discount <= Number(rules.discount_limit)} label={`Descuento hasta ${rules.discount_limit} %`} detail={discount > 0 ? `Esta versión tiene ${discount} %.` : "Sin descuento."} />
          <Check ok={margin === null || margin >= Number(rules.margin_floor)} label={`Margen desde ${rules.margin_floor} %`} detail={margin === null ? "Sin datos de costo." : `Esta versión deja ${margin} %.`} />
          <Check ok={discount <= Number(rules.max_discount)} label={`Tope de ${rules.max_discount} %`} detail={discount > Number(rules.max_discount) ? "Supera el tope: solo Gerencia puede autorizarlo." : "Dentro del tope de la agencia."} />
        </ul>
        <p className="mt-3 text-[12.5px] text-fg-3">{quote.internal?.required ? "Por estas reglas, Gerencia debe aprobarla antes de enviarla al cliente." : "Cumple las reglas: se puede enviar sin aprobación de Gerencia."}</p>
      </Card>
    </div>
  );
}


const EVENT: Record<QuoteTimelineEvent["kind"], { label: string; icon: ReactNode; tone: string }> = {
  envio: { label: "Enviada", icon: <Send size={14} />, tone: "bg-info" },
  vista: { label: "Vista por el cliente", icon: <Eye size={14} />, tone: "bg-violet" },
  negociacion: { label: "Negociación", icon: <MessagesSquare size={14} />, tone: "bg-warn" },
  aprobacion: { label: "Aprobada por el cliente", icon: <ThumbsUp size={14} />, tone: "bg-ok" },
  rechazo: { label: "Rechazada por el cliente", icon: <ThumbsDown size={14} />, tone: "bg-bad" },
};

export function TrackingSection({ quote }: { quote: QuoteDetail }) {
  const live = ["enviada", "vista", "negociacion"].includes(quote.status);
  const internal = quote.internal_detail;
  return (
    <div className="flex flex-col gap-5">
      {internal && (
        <div className="grid gap-5 xl:grid-cols-2">
          {internal && (
            <Card>
              <TintCardTitle icon={ShieldCheck} title="Aprobación interna" aside={<StatusBadge status={internal.status} />} />
              <FieldList
                fields={[
                  { label: "Motivo", value: <span className="whitespace-normal">{internal.reasons.join(" · ") || "—"}</span> },
                  { label: "Pidió", value: `${internal.requested_by ?? "—"}${internal.requested_at ? ` · ${formatDateTime(internal.requested_at)}` : ""}` },
                  ...(internal.request_note ? [{ label: "Justificación", value: <span className="whitespace-normal">{internal.request_note}</span> }] : []),
                  ...(internal.decided_by ? [{ label: "Decidió", value: `${internal.decided_by}${internal.decided_at ? ` · ${formatDateTime(internal.decided_at)}` : ""}` }] : []),
                  ...(internal.decision_note ? [{ label: "Nota de Gerencia", value: <span className="whitespace-normal">{internal.decision_note}</span> }] : []),
                ]}
              />
            </Card>
          )}
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <TintCardTitle icon={Route} title="Seguimiento" aside={live && quote.can.send ? <QuoteRecordViewAction code={quote.code} /> : undefined} />
          {quote.timeline.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">{quote.status === "borrador" ? "Todavía no se envió al cliente." : "No hay envíos, vistas ni negociaciones registradas."}</p>
          ) : (
            <ol className="flex flex-col gap-4 border-l-2 border-line-2 pl-5">
              {quote.timeline.map((event, index) => {
                const meta = EVENT[event.kind];
                return (
                  <li key={index} className="relative text-[13px]">
                    <span className={cn("absolute -left-[31px] top-0 grid h-[22px] w-[22px] place-items-center rounded-full text-white ring-4 ring-surface", meta.tone)}>{meta.icon}</span>
                    <b className="font-semibold">{meta.label}</b>
                    {event.channel && <span className="ml-1.5 text-fg-2">por {event.channel}</span>}
                    {event.version && <span className="ml-1.5 text-[12px] text-fg-3">versión {event.version}</span>}
                    {event.detail && <span className="block text-fg-2">{event.detail}</span>}
                    {event.note && <span className={cn("mt-1 block rounded-[10px] px-3 py-2 text-[12.5px] text-fg-2", SOFT_TINT)}>{event.note}</span>}
                    <span className="mt-0.5 block text-xs text-fg-3">
                      {formatDateTime(event.at)}
                      {event.actor && ` · ${event.actor}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={CalendarCheck} title="Actividades vinculadas" aside={quote.activities.length ? String(quote.activities.length) : undefined} />
          {quote.activities.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">No hay llamadas, reuniones ni tareas ligadas a esta cotización o a su oportunidad.</p>
          ) : (
            <ul className="flex flex-col">
              {quote.activities.map((activity) => (
                <li key={activity.code} className="flex items-start gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold">{activity.subject}</b>
                    <span className="text-xs text-fg-3">
                      {ACTIVITY_LABEL[activity.type] ?? activity.type}
                      {activity.due_at && ` · ${formatDateTime(activity.due_at)}`}
                      {activity.owner && ` · ${activity.owner}`}
                      {activity.related_type === "opportunity" && " · de la oportunidad"}
                    </span>
                  </span>
                  <StatusBadge status={activity.status} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/crm/actividades" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--tint)] hover:underline">
            <ListChecks size={14} />
            Ir a la agenda
          </Link>
        </Card>
      </div>
    </div>
  );
}

export function ActivitySection({ events, labels }: { events: QuoteAuditEvent[]; labels: Record<string, string> }) {
  if (events.length === 0) return <Card><EmptyState icon={<History size={20} />} title="Sin eventos" description="Aún no hay movimientos en la auditoría de esta cotización." /></Card>;
  return (
    <Card>
      <TintCardTitle icon={History} title="Actividad" aside={`${events.length} eventos`} />
      <MiniTable head={["Fecha", "Usuario", "Acción", "Antes", "Después"]}>
        {events.map((event) => (
          <tr key={event.id}>
            <td className="whitespace-nowrap text-xs">{formatDateTime(event.at)}</td>
            <td>{event.actor ?? "—"}</td>
            <td className="font-semibold">{labels[event.action] ?? statusLabel(event.action.replaceAll("_", " "))}</td>
            <td className="max-w-[200px] whitespace-normal text-xs text-fg-3">{event.before ?? "—"}</td>
            <td className="max-w-[260px] whitespace-normal text-xs">{event.after ?? "—"}</td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}
