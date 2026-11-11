export type RoleScope = "tenant" | "mobile" | "canal";

export interface TeamRole {
  code: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  custom: boolean;
  users: number;
  permissions: string[];
}

export interface PermissionModule {
  module: string;
  permissions: string[];
}

export const SCOPE_LABEL: Record<RoleScope, string> = {
  tenant: "Equipo interno",
  mobile: "App móvil",
  canal: "Clientes y socios",
};

export const PERMISSION_LABEL: Record<string, string> = {
  "admin.users.manage": "Invitar y administrar usuarios y sedes",
  "admin.roles.manage": "Configurar roles y permisos",
  "admin.settings.manage": "Configurar la agencia",
  "admin.audit.view": "Ver la auditoría",
  "admin.billing.manage": "Ver y pagar la suscripción",
  "admin.api.manage": "Gestionar API e integraciones",
  "approvals.view": "Ver la bandeja de aprobaciones",
  "inbox.view": "Ver la bandeja omnicanal",
  "inbox.manage": "Responder en la bandeja omnicanal",
  "crm.leads.view": "Ver leads",
  "crm.leads.manage": "Registrar y trabajar leads",
  "crm.opportunities.manage": "Gestionar oportunidades",
  "crm.activities.manage": "Gestionar actividades",
  "crm.clients.manage": "Gestionar clientes",
  "crm.targets.view": "Ver metas comerciales",
  "crm.targets.manage": "Definir metas comerciales",
  "crm.claims.manage": "Atender reclamos",
  "crm.records.reassign": "Reasignar registros entre asesores",
  "marketing.campaigns.manage": "Gestionar campañas",
  "catalog.products.view": "Ver el catálogo",
  "catalog.products.create": "Crear productos",
  "catalog.products.update": "Editar productos",
  "catalog.products.activate": "Aprobar y activar productos",
  "catalog.products.manage_rates": "Gestionar tarifas",
  "catalog.products.manage_availability": "Gestionar disponibilidad y salidas",
  "catalog.products.view_profitability": "Ver costos y margen de productos",
  "catalog.products.publish": "Publicar en canales",
  "catalog.providers.manage": "Gestionar proveedores",
  "catalog.allotments.manage": "Gestionar cupos con proveedores",
  "quotes.view": "Ver cotizaciones",
  "quotes.create": "Crear cotizaciones",
  "quotes.approve_internal": "Aprobar cotizaciones internamente",
  "quotes.send": "Enviar cotizaciones al cliente",
  "quotes.discount_override": "Superar el tope de descuento",
  "reservations.view": "Ver reservas",
  "reservations.create": "Crear reservas",
  "reservations.modify": "Modificar reservas",
  "reservations.cancel": "Cancelar reservas",
  "operations.view": "Ver operaciones",
  "operations.assign": "Asignar guías, conductores y proveedores",
  "operations.vouchers": "Emitir vouchers",
  "operations.incidents": "Gestionar incidencias",
  "operations.close": "Cerrar servicios",
  "operations.travel_docs": "Gestionar documentos de viaje",
  "finance.receivables": "Ver y gestionar cobros",
  "finance.payments.register": "Registrar pagos",
  "finance.payments.revert": "Revertir pagos",
  "finance.payables": "Gestionar pagos a proveedores",
  "finance.commissions": "Gestionar comisiones",
  "finance.profitability": "Ver rentabilidad",
  "finance.invoicing": "Emitir comprobantes",
  "finance.treasury": "Gestionar tesorería",
  "channels.b2b.manage": "Gestionar el canal B2B",
  "channels.ecommerce.manage": "Gestionar la tienda en línea",
  "channels.cms.publish": "Publicar en el sitio web",
  "reports.view": "Ver reportes",
  "reports.export": "Exportar reportes",
  "supplier.portal.view": "Entrar a la extranet de proveedores",
  "supplier.requests.respond": "Confirmar o rechazar solicitudes",
  "supplier.rooming.manage": "Gestionar rooming lists",
  "supplier.vouchers.redeem": "Canjear vouchers",
  "supplier.payables.view": "Ver cuentas por pagar",
  "supplier.invoices.upload": "Subir facturas",
  "supplier.incidents.report": "Reportar incidencias",
  "supplier.rates.request": "Solicitar cambios de tarifa",
  "supplier.users.manage": "Gestionar contactos de la empresa",
};

export interface AccessMapRole {
  role: string;
  name: string;
  scope: RoleScope;
  custom: boolean;
  experience: string;
  screens: Record<string, boolean>;
  allowed: number;
}

export interface AccessMapData {
  screens: { path: string; permissions: string[] }[];
  roles: AccessMapRole[];
}

export interface PermissionMatrixData {
  roles: { code: string; name: string; scope: RoleScope; custom: boolean; users: number }[];
  modules: PermissionModule[];
  matrix: Record<string, Record<string, boolean>>;
}

export const EXPERIENCE_LABEL: Record<string, string> = { backoffice: "Back-office", portal: "Portal externo", mobile: "App móvil" };

export interface RoleDetail {
  code: string;
  name: string;
  scope: RoleScope;
  custom: boolean;
  experience: string;
  screens: { allowed: number; total: number };
  users: { code: string | null; name: string; email: string; status: string; sede: string | null; last_login_at: string | null }[];
  audit: { at: string; action: string; permission: string | null; before: string | null; after: string | null; actor: string; correlation: string | null }[];
}
