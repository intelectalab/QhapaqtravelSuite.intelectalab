export interface CredentialSlot {
  field: string;
  label: string;
  set: boolean;
  hint: string | null;
}

export interface DriverOption {
  value: string;
  label: string;
  kind?: string;
  fields: { field: string; label: string }[];
}

export interface FxCatalogProvider {
  code: string;
  name: string;
  driver: string;
  driver_label: string;
  kind: string;
  status: "validado" | "por_validar";
  status_label: string;
  note: string | null;
  credentials: CredentialSlot[];
  credentials_complete: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_result: string | null;
  updated_at: string | null;
}

export interface FxCatalogOverview {
  providers: FxCatalogProvider[];
  drivers: DriverOption[];
  simulated: boolean;
  counts: { total: number; validated: number };
}

export interface OseProvider {
  code: string;
  name: string;
  driver: string;
  driver_label: string;
  status: "homologado" | "por_homologar";
  status_label: string;
  note: string | null;
  homologated_at: string | null;
  fields: { field: string; label: string }[];
  tenants: number | null;
  updated_at: string | null;
  webhook?: OseWebhook;
}

export interface OseWebhook {
  secret_set: boolean;
  secret_hint: string | null;
  secret_generated_at: string | null;
  previous_secret_until: string | null;
  previous_secret_valid: boolean;
  still_previous: boolean;
  last_signed_at: string | null;
  last_key: "actual" | "anterior" | null;
  callback_url: string;
  signature_header: string;
}

export interface OseCatalogOverview {
  providers: OseProvider[];
  drivers: DriverOption[];
  simulated: boolean;
  counts: { total: number; homologated: number; tenants: number };
}

export type OseStep = "sin_ose" | "fuera_de_catalogo" | "por_homologar" | "sandbox" | "sin_credenciales" | "sin_probar" | "adaptador_pendiente" | "conectado";

export interface OseStatus {
  mode: "simulado" | "conectado";
  step: OseStep;
  message: string;
  ready: boolean;
  provider: OseProvider | null;
  credentials: CredentialSlot[];
  credentials_complete: boolean;
  credentials_at: string | null;
  chosen_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_result: string | null;
}

export interface AgencyOse extends OseStatus {
  options: OseProvider[];
  can_choose: boolean;
}

export interface TenantOse extends OseStatus {
  tenant: { code: string; name: string; ruc: string };
  catalog: OseProvider[];
}

export const OSE_STEPS: { step: OseStep[]; label: string }[] = [
  { step: ["sin_ose", "fuera_de_catalogo", "por_homologar", "sandbox"], label: "OSE homologado elegido" },
  { step: ["sin_credenciales"], label: "Credenciales cargadas" },
  { step: ["sin_probar"], label: "Conexión probada" },
  { step: ["adaptador_pendiente", "conectado"], label: "Emisión real" },
];

export function oseProgress(step: OseStep): number {
  const index = OSE_STEPS.findIndex((item) => item.step.includes(step));
  if (step === "conectado") return OSE_STEPS.length;
  return index < 0 ? 0 : index;
}
