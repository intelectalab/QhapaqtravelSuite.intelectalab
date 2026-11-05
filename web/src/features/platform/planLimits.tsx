import { CalendarCheck, Cloud, Gauge, HardDrive, KeyRound, Mail, MessageCircle, Store, Users, Webhook, type LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { PlanMetric, PlanSummary } from "@/lib/platform";
import type { Tone } from "@/lib/tone";

export interface PlanLimitInfo {
  metric: PlanMetric;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  unit?: string;
  key?: boolean;
}

export const PLAN_LIMITS: PlanLimitInfo[] = [
  { metric: "users", label: "Usuarios activos", hint: "Cuentas activas del equipo de la agencia.", icon: Users, tone: "t1", key: true },
  { metric: "sedes", label: "Sedes", hint: "Oficinas o sucursales de la agencia.", icon: Store, tone: "sun", key: true },
  { metric: "storage_gb", label: "Almacenamiento", hint: "Documentos, vouchers, adjuntos de reservas y fotografías.", icon: HardDrive, tone: "violet", unit: "GB", key: true },
  { metric: "reservations_month", label: "Reservas al mes", hint: "Reservas nuevas que puede registrar cada mes.", icon: CalendarCheck, tone: "t4", key: true },
  { metric: "whatsapp_month", label: "WhatsApp al mes", hint: "Mensajes de plantilla enviados por WhatsApp Business.", icon: MessageCircle, tone: "ok" },
  { metric: "email_month", label: "Correos al mes", hint: "Correos enviados desde el sistema.", icon: Mail, tone: "info" },
  { metric: "api_calls_month", label: "Llamadas a la API al mes", hint: "Consultas de otros sistemas a la API.", icon: Cloud, tone: "accent" },
  { metric: "api_rate_per_min", label: "Llamadas por minuto", hint: "Máximo de consultas a la API en un minuto.", icon: Gauge, tone: "t3" },
  { metric: "webhooks", label: "Webhooks", hint: "Avisos automáticos a otros sistemas.", icon: Webhook, tone: "violet" },
  { metric: "api_keys", label: "Llaves de API", hint: "Accesos para conectar otros sistemas.", icon: KeyRound, tone: "sun" },
];

export const KEY_LIMITS = PLAN_LIMITS.filter((limit) => limit.key);

export type LimitValue = { unlimited: true } | { unlimited: false; text: string; none: boolean };

export function limitValue(plan: Pick<PlanSummary, "limits">, info: PlanLimitInfo): LimitValue {
  const value = plan.limits[info.metric];
  if (value === null || value === undefined) return { unlimited: true };
  return { unlimited: false, none: value === 0, text: value === 0 ? "No incluye" : `${formatNumber(value)}${info.unit ? ` ${info.unit}` : ""}` };
}
