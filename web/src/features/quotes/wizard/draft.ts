import type { QuotePayload } from "@/app/(backoffice)/cotizaciones/actions";
import { formatDate, formatMoney } from "@/lib/format";
import { MANUAL_RATE, paxLabel, type QuoteDetail, type QuoteFormOptions, type QuoteLineInput, type QuotePreview } from "@/lib/quotes";

export interface QuoteDraft {
  client: string;
  opportunity: string;
  title: string;
  travelFrom: string;
  travelTo: string;
  validUntil: string;
  currency: string;
  pax: { adt: number; chd: number; inf: number };
  discount: string;
  tax: string;
  notes: string;
  conditions: string;
  lines: QuoteLineInput[];
}

export type QuotePatch = Partial<QuoteDraft>;

let counter = 0;
export const lineKey = () => `line-${++counter}`;

export const lineReady = (line: QuoteLineInput) => Boolean(line.product_code && line.date);

export function initialDraft(options: QuoteFormOptions, quote?: QuoteDetail, opportunityCode?: string): QuoteDraft {
  const preset = options.opportunities.find((item) => item.code === (quote?.opportunity?.code ?? opportunityCode));
  const current = quote?.versions[0];
  return {
    client: quote?.client.code ?? preset?.client_code ?? "",
    opportunity: preset?.code ?? "",
    title: quote?.title ?? preset?.title ?? "",
    travelFrom: quote?.travel_from ?? "",
    travelTo: quote?.travel_to ?? "",
    validUntil: quote?.valid_until ?? options.defaults.valid_until,
    currency: quote?.currency ?? preset?.currency ?? "USD",
    pax: { adt: quote?.pax.adt ?? (preset?.pax || 2), chd: quote?.pax.chd ?? 0, inf: quote?.pax.inf ?? 0 },
    discount: String(current?.discount_pct ?? 0),
    tax: String(current?.tax_pct ?? options.defaults.tax_pct),
    notes: current?.notes ?? "",
    conditions: current?.conditions ?? "",
    lines:
      current?.items.map((item) => ({
        key: lineKey(),
        product_code: item.product.code,
        date: item.date,
        qty: item.qty,
        pax: item.pax,
        segment: item.segment,
        rate_id: item.rate_id ?? (item.price_source === "manual" ? MANUAL_RATE : ""),
        unit_price: item.price_source === "rate" ? "" : String(item.unit_price),
        unit_cost: options.can.edit_cost && item.unit_cost !== null && !item.rate_id ? String(item.unit_cost) : "",
      })) ?? [],
  };
}

export function quotePayload(draft: QuoteDraft, lockVersion?: number): QuotePayload {
  return {
    client_code: draft.client,
    opportunity_code: draft.opportunity || undefined,
    title: draft.title,
    travel_from: draft.travelFrom,
    travel_to: draft.travelTo,
    valid_until: draft.validUntil || undefined,
    currency: draft.currency,
    pax_adt: draft.pax.adt,
    pax_chd: draft.pax.chd,
    pax_inf: draft.pax.inf,
    discount_pct: Number(draft.discount) || 0,
    tax_pct: draft.tax === "" ? undefined : Number(draft.tax),
    notes: draft.notes || undefined,
    conditions: draft.conditions || undefined,
    items: draft.lines.filter(lineReady).map((line) => ({
      product_code: line.product_code,
      date: line.date,
      qty: line.qty,
      pax: line.pax,
      segment: line.segment,
      ...(line.rate_id === "" ? {} : { rate_id: line.rate_id === MANUAL_RATE ? null : line.rate_id }),
      unit_price: line.unit_price === "" ? undefined : Number(line.unit_price),
      unit_cost: line.unit_cost === "" ? undefined : Number(line.unit_cost),
    })),
    lock_version: lockVersion,
  };
}

const range = (from: string, to: string) => (from && to ? `${formatDate(from).replace(/ \d{4}$/, "")} al ${formatDate(to)}` : from ? `Desde el ${formatDate(from)}` : "");

export function quoteStepSummaries(draft: QuoteDraft, options: QuoteFormOptions, preview: QuotePreview | null): string[] {
  const client = options.clients.find((item) => item.code === draft.client)?.name;
  const ready = draft.lines.filter(lineReady).length;
  return [
    [client, draft.title].filter(Boolean).join(" · ") || "Cliente, título, vigencia y moneda.",
    [range(draft.travelFrom, draft.travelTo), paxLabel(draft.pax)].filter(Boolean).join(" · ") || "Fechas del viaje y pasajeros.",
    ready ? `${ready} ${ready === 1 ? "ítem" : "ítems"} del catálogo` : "Productos del catálogo con su tarifa.",
    preview && ready ? `Total ${formatMoney(preview.totals.grand_total, draft.currency)}` : "Descuento, IGV, notas y total.",
  ];
}
