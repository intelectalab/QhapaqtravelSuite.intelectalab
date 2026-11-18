export type AgencyIntegrationKey = "email" | "whatsapp" | "ose" | "payments";

export type PlatformFeatureKey = "sales_ai" | "catalog_import" | "site_content_ai" | "ruc" | "fx" | "antivirus" | "checkout" | "ota" | "accounting" | "travel_inventory" | "reviews" | "push" | "domains" | "tracking";

export type IntegrationStatus = "conectado" | "en_proceso" | "sin_configurar";

export interface AgencyIntegration {
  key: AgencyIntegrationKey;
  label: string;
  description: string;
  status: IntegrationStatus;
  detail: string | null;
  usable: boolean;
  href: string;
  cta: string;
}

export interface PlatformFeature {
  available: boolean;
  label: string;
  message: string | null;
}

export interface IntegrationReadiness {
  enforced: boolean;
  items: AgencyIntegration[];
  pending: number;
  features: Record<PlatformFeatureKey, PlatformFeature>;
  can_manage: boolean;
}

export type MailProvider = "gmail" | "outlook" | "zoho" | "otro";

export interface MailProviderOption {
  value: MailProvider;
  label: string;
  help: string;
  host: string | null;
  port: number | null;
  encryption: "ssl" | "tls" | "none" | null;
}

export interface AgencyMailSummary {
  status: "conectado" | "sin_configurar";
  provider: MailProvider | null;
  address: string;
  from_name: string;
  host: string | null;
  port: number | null;
  encryption: "ssl" | "tls" | "none" | null;
  password_set: boolean;
  verified_at: string | null;
  providers: MailProviderOption[];
}

export const INTEGRATION_STATUS: Record<IntegrationStatus, { label: string; tone: "ok" | "warn" | "mute" }> = {
  conectado: { label: "Conectado", tone: "ok" },
  en_proceso: { label: "En proceso", tone: "warn" },
  sin_configurar: { label: "Sin configurar", tone: "mute" },
};

export function pendingItems(readiness: IntegrationReadiness | null): AgencyIntegration[] {
  return readiness ? readiness.items.filter((item) => item.status !== "conectado") : [];
}

export function featureOf(readiness: IntegrationReadiness | null, key: PlatformFeatureKey): PlatformFeature {
  return readiness?.features[key] ?? { available: true, label: key, message: null };
}

export function integrationOf(readiness: IntegrationReadiness | null, key: AgencyIntegrationKey): AgencyIntegration | null {
  return readiness?.items.find((item) => item.key === key) ?? null;
}
