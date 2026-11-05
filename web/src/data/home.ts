import clientsSeed from "./seed/clients.json";
import incidentsSeed from "./seed/incidents.json";
import monthlySeed from "./seed/monthly.json";
import quotesSeed from "./seed/quotes.json";
import receivablesSeed from "./seed/receivables.json";
import reservationsSeed from "./seed/reservations.json";
import tenantSeed from "./seed/tenant.json";
import { monthName } from "@/lib/format";
import { BUSINESS_DATE } from "./workspace";

export type AttentionKind = "incident" | "collection" | "quote";

export interface AttentionItem {
  kind: AttentionKind;
  title: string;
  detail: string;
  action: string;
  href: string;
}

export interface Departure {
  id: string;
  date: string;
  title: string;
  passengers: number;
  status: string;
}

const ACTIVE_RESERVATION = new Set(["confirmada", "en_operacion", "pendiente_pago", "pendiente_proveedor", "parcial", "incidencia"]);
const OPEN_QUOTE = new Set(["enviada", "vista", "negociacion"]);

const toPen = (amount: number, currency: string) => (currency === "USD" ? amount * tenantSeed.fx : amount);
const clientName = (id: string) => clientsSeed.find((client) => client.id === id)?.name ?? "";
const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

function overdueReceivables() {
  const overdue = receivablesSeed.filter((receivable) => receivable.status === "vencida");
  return {
    count: overdue.length,
    amountPen: Math.round(overdue.reduce((sum, receivable) => sum + toPen(receivable.amount - receivable.paid, receivable.currency), 0)),
    clients: [...new Set(overdue.map((receivable) => clientName(receivable.clientId)))],
  };
}

export function attentionItems(): AttentionItem[] {
  const items: AttentionItem[] = [];
  const critical = incidentsSeed.find((incident) => incident.severity === "critica" && incident.status !== "cerrada");
  if (critical) {
    items.push({ kind: "incident", title: critical.title, detail: `Reserva ${critical.resId} · ${critical.type}`, action: "Gestionar", href: `/operaciones/incidencias/${critical.id}` });
  }
  const overdue = overdueReceivables();
  if (overdue.count > 0) {
    items.push({
      kind: "collection",
      title: `${overdue.count} cobros vencidos por S/ ${new Intl.NumberFormat("es-PE").format(overdue.amountPen).replace(/,/g, " ")}`,
      detail: overdue.clients.join(" y "),
      action: "Ver cobros",
      href: "/finanzas/cobros",
    });
  }
  const expiring = quotesSeed
    .filter((quote) => OPEN_QUOTE.has(quote.status) && quote.validUntil >= BUSINESS_DATE)
    .sort((a, b) => a.validUntil.localeCompare(b.validUntil))[0];
  if (expiring) {
    const days = daysBetween(BUSINESS_DATE, expiring.validUntil);
    items.push({
      kind: "quote",
      title: `La cotización de ${clientName(expiring.clientId)} vence en ${days} ${days === 1 ? "día" : "días"}`,
      detail: expiring.title.replace(" — ", " · "),
      action: "Abrir",
      href: `/cotizaciones/${expiring.id}`,
    });
  }
  return items;
}

export function homeKpis() {
  const { sales, cost, labels } = monthlySeed;
  const current = sales.at(-1) ?? 0;
  const previous = sales.at(-2) ?? 0;
  const active = reservationsSeed.filter((reservation) => ACTIVE_RESERVATION.has(reservation.status));
  const pending = receivablesSeed.filter((receivable) => receivable.status !== "pagada");
  return {
    sales: current,
    salesDelta: previous ? ((current - previous) / previous) * 100 : 0,
    previousMonth: monthName(Number(BUSINESS_DATE.slice(5, 7)) - 2),
    periods: labels,
    margin: current ? ((current - (cost.at(-1) ?? 0)) / current) * 100 : 0,
    marginGoal: 28,
    receivable: Math.round(pending.reduce((sum, receivable) => sum + toPen(receivable.amount - receivable.paid, receivable.currency), 0)),
    overdue: overdueReceivables().amountPen,
    activeReservations: active.length,
    passengers: active.reduce((sum, reservation) => sum + reservation.passengers.length, 0),
    trend: { sales, cost },
  };
}

export function upcomingDepartures(limit = 3): Departure[] {
  return reservationsSeed
    .filter((reservation) => ACTIVE_RESERVATION.has(reservation.status) && reservation.travelFrom > BUSINESS_DATE)
    .sort((a, b) => a.travelFrom.localeCompare(b.travelFrom))
    .slice(0, limit)
    .map((reservation) => ({
      id: reservation.id,
      date: reservation.travelFrom,
      title: reservation.title.replace(/\s*\(web\)$/, ""),
      passengers: reservation.passengers.length,
      status: reservation.status,
    }));
}

export function monthlySales() {
  return monthlySeed.labels.map((label, index) => ({ label, sales: monthlySeed.sales[index], cost: monthlySeed.cost[index] }));
}
