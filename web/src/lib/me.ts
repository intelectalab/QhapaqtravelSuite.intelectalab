export interface Branding {
  brand: string;
  accent: string;
  menu: string;
  tile_variant: string;
}

export interface Me {
  id: string;
  code: string | null;
  name: string;
  email: string;
  avatar_color: string | null;
  role: { name: string; display_name: string | null };
  experience: "backoffice" | "portal" | "mobile";
  home: string;
  mfa_enabled: boolean;
  mfa_required: boolean;
  sede: { id: string | null; name: string | null };
  tenant: { id: string; code: string; name: string; legal_name: string; initials: string; base_currency: string; timezone: string; branding?: Branding };
  permissions: string[];
}

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Administración",
  manager: "Gerencia",
  sales: "Ventas",
  operations: "Operaciones",
  finance: "Finanzas",
  accounting: "Contabilidad",
  guide: "Guía",
  driver: "Conductor",
  b2b: "Agencia aliada",
  customer: "Cliente",
  passenger: "Pasajero",
  provider: "Proveedor",
};

export function roleLabel(role: Me["role"]): string {
  return ROLE_LABELS[role.name] ?? role.display_name ?? role.name;
}
