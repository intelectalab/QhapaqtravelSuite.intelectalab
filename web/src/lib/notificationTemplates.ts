export type TemplateChannel = "email" | "whatsapp" | "push";

export const TEMPLATE_CHANNELS: { value: TemplateChannel; label: string }[] = [
  { value: "email", label: "Correo" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "push", label: "Push" },
];

export const VARIABLE_LABELS: Record<string, string> = {
  cliente: "Cliente",
  reserva: "Reserva",
  cotizacion: "Cotización",
  fecha_viaje: "Fecha de viaje",
  monto: "Monto",
  servicio: "Servicio",
  hora: "Hora",
  enlace: "Enlace",
  agencia: "Agencia",
  vendedor: "Asesor",
};

export interface NotificationTemplate {
  id: string | null;
  event_code: string;
  event_label: string;
  channel: TemplateChannel;
  source: "agencia" | "sistema";
  version: number;
  subject: string;
  body: string;
  provider_template_id: string | null;
  updated_at: string | null;
  updated_by: string | null;
  default: { subject: string; body: string };
  preview: { subject: string; body: string };
  variables: string[];
  max_length: number | null;
  versions: { id: string; version: number; current: boolean; created_at: string; created_by: string | null }[];
}

export interface TemplateResult {
  template: NotificationTemplate | null;
  message: string | null;
  notice?: string | null;
}
