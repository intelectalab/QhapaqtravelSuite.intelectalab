import { formatNumber } from "@/lib/format";
import type { AiRequest, Labels } from "@/lib/growth";

export type AssistantSourceType = "quote" | "lead" | "conversation";

export interface AssistantFact {
  key: string;
  label: string;
  value: string;
  items?: string[];
}

export interface AssistantContext {
  source: { type: AssistantSourceType; label: string; code: string; title: string };
  facts: AssistantFact[];
  usage: { enabled: boolean; limit: number | null; remaining: number | null; exhausted: boolean; warning: boolean };
  kinds: Labels;
  recent: AiRequest[];
}

export const ASSISTANT_KIND_ORDER: Record<AssistantSourceType, string[]> = {
  quote: ["quote_draft", "itinerary", "reply_draft", "summary"],
  lead: ["itinerary", "quote_draft", "reply_draft", "summary"],
  conversation: ["reply_draft", "summary", "itinerary", "quote_draft"],
};

export const ASSISTANT_KIND_HINTS: Record<string, string> = {
  itinerary: "Día por día con el catálogo",
  quote_draft: "Servicios y pasajeros",
  reply_draft: "Texto listo para el cliente",
  summary: "Lo esencial en pocas líneas",
};

const RETURN_PREFIXES = ["/cotizaciones/", "/crm/leads/", "/inbox", "/asistente"];

export function orderedKinds(type: AssistantSourceType, kinds: Labels): { value: string; label: string }[] {
  const order = ASSISTANT_KIND_ORDER[type];
  return Object.entries(kinds)
    .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
    .map(([value, label]) => ({ value, label }));
}

export function factValue(facts: AssistantFact[], key: string): string | null {
  return facts.find((fact) => fact.key === key)?.value ?? null;
}

export function suggestedPrompt(type: AssistantSourceType, kind: string, facts: AssistantFact[]): string {
  const client = factValue(facts, "client");
  const who = client && client !== "Sin nombre" ? client : "el cliente";
  const place = factValue(facts, "destinations");
  const where = place ? ` en ${place}` : "";
  if (kind === "reply_draft") return type === "conversation" ? `Responde con amabilidad al último mensaje de ${who} y propón el siguiente paso.` : `Escribe un mensaje para ${who} con la propuesta${where} y el siguiente paso.`;
  if (kind === "summary") return type === "conversation" ? `Resume la conversación con ${who}: qué pide, fechas y dudas pendientes.` : `Resume lo que sabemos de ${who}: qué busca, fechas y pasajeros.`;
  if (kind === "quote_draft") return `Propón los servicios del catálogo para el viaje de ${who}${where}.`;
  return `Arma un itinerario día por día para ${who}${where}.`;
}

export function assistantReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) return null;
  return RETURN_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix)) ? path : null;
}

export function quotaLine(usage: AssistantContext["usage"]): string {
  if (usage.limit === null) return "Tu plan no tiene cupo mensual de pedidos.";
  if (usage.exhausted) return `La agencia ya usó los ${formatNumber(usage.limit)} pedidos del mes.`;
  return `Quedan ${formatNumber(usage.remaining ?? 0)} de ${formatNumber(usage.limit)} pedidos este mes.`;
}

export const ASSISTANT_REPLY_EVENT = "kipu:assistant-reply";

export function sendToComposer(conversation: string, text: string): void {
  window.dispatchEvent(new CustomEvent(ASSISTANT_REPLY_EVENT, { detail: { conversation, text } }));
}

export function onComposerFill(conversation: string, fill: (text: string) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ conversation: string; text: string }>).detail;
    if (detail?.conversation === conversation && detail.text) fill(detail.text);
  };
  window.addEventListener(ASSISTANT_REPLY_EVENT, listener);
  return () => window.removeEventListener(ASSISTANT_REPLY_EVENT, listener);
}
