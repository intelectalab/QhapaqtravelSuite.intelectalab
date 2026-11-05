/**
 * Rutas Next.js usadas por las pruebas. Regla (CONVENCIONES §6): ruta del prototipo sin `#/`.
 *
 * SUPUESTO DEL KIT: los grupos de rutas `(portal-cliente)`, `(portal-pasajero)`, `(b2b)`,
 * `(extranet-proveedor)` y `(plataforma)` no generan segmento en la URL; si se usan tal cual,
 * `/cotizaciones/[code]` del back-office y del portal del cliente colisionan. Para evitarlo,
 * cada experiencia externa lleva un segmento propio (`/portal-cliente`, `/portal-pasajero`,
 * `/b2b`, `/proveedor`, `/plataforma`). Si el equipo decide resolverlo por subdominio,
 * basta cambiar este archivo.
 */
export const R = {
  login: '/login',
  forbidden: '/403',
  dashboard: '/dashboard',

  // CRM (esp. 01)
  leads: '/crm/leads',
  lead: (code: string) => `/crm/leads/${code}`,
  opportunity: (code: string) => `/crm/oportunidades/${code}`,
  client: (code: string) => `/crm/clientes/${code}`,

  // Cotizaciones (esp. 03)
  quotes: '/cotizaciones',
  newQuote: (opp?: string) => (opp ? `/cotizaciones/nueva?opp=${opp}` : '/cotizaciones/nueva'),
  quote: (code: string) => `/cotizaciones/${code}`,

  // Reservas (esp. 04)
  reservations: '/reservas',
  reservation: (code: string, tab?: string) => `/reservas/${code}${tab ? `?tab=${tab}` : ''}`,

  // Operaciones (esp. 05)
  orders: '/operaciones/ordenes',
  order: (code: string) => `/operaciones/ordenes/${code}`,
  vouchers: '/operaciones/vouchers',
  incident: (code: string) => `/operaciones/incidencias/${code}`,
  incidents: '/operaciones/incidencias',

  // Finanzas (esp. 07)
  receivables: '/finanzas/cobros',
  receivable: (code: string) => `/finanzas/cobros/${code}`,
  payments: '/finanzas/pagos',
  payables: '/finanzas/cuentas-por-pagar',
  profitability: (res?: string) => (res ? `/finanzas/rentabilidad/${res}` : '/finanzas/rentabilidad'),
  invoicing: '/finanzas/facturacion',

  // Administración y reglas (esp. 09, 17)
  users: '/admin/usuarios',
  bookingRules: '/admin/reglas',
  subscription: '/admin/suscripcion',
  apiKeys: '/admin/api',
  reports: (tab = 'comercial') => `/reportes/${tab}`,

  // Portales externos (ver SUPUESTO arriba)
  customerHome: '/portal-cliente/inicio',
  customerQuote: (code: string) => `/portal-cliente/cotizaciones/${code}`,
  passengerTrip: '/portal-pasajero/viajes',
  passengerItinerary: '/portal-pasajero/itinerario',
  passengerVouchers: '/portal-pasajero/vouchers',
  passengerAlerts: '/portal-pasajero/alertas',
  platformTenants: '/plataforma/tenants',
  /** Vista previa interna (solo lectura, H-05) del portal del pasajero para una reserva. Supuesto de query param. */
  passengerPreview: (res: string) => `/canales/portal-pasajero/viajes?reserva=${res}`,

  // Sitio público y widget (esp. 15, 17) — sin sesión, tenant por host
  tour: (slug: string, qs = '') => `/tours/${slug}${qs}`,
  widget: (code: string, qs = '') => `/widget/${code}${qs}`,
  checkout: '/checkout',
} as const;

/** Endpoints API (esp. 00–18). Relativos a E2E_API_URL (…/api/v1). */
export const API = {
  login: '/auth/login',
  mfaVerify: '/auth/mfa/verify',
  passengerLink: '/portal/passenger/auth/link',
  passengerVerify: '/portal/passenger/auth/verify',
  reservation: (id: string) => `/reservations/${id}`,
  reservations: '/reservations',
  quotes: '/quotes',
  quote: (id: string) => `/quotes/${id}`,
  quoteConvert: (id: string) => `/quotes/${id}/convert`,
  quoteApprove: (id: string) => `/quotes/${id}/approve`,
  quoteSend: (id: string) => `/quotes/${id}/send`,
  internalApproval: (id: string, v: number) => `/quotes/${id}/versions/${v}/internal-approval`,
  internalApprovalRequest: (id: string) => `/quotes/${id}/internal-approval-requests`,
  leads: '/crm/leads',
  lead: (code: string) => `/crm/leads/${code}`,
  opSync: '/mobile/operator/sync',
  opBootstrap: '/mobile/operator/bootstrap',
  opAction: '/mobile/operator/actions',
  publicAvailability: (code: string, month: string, seats: number) => `/public/products/${code}/availability?month=${month}&seats=${seats}`,
  publicQuote: '/public/quote',
  bookingRule: (code: string) => `/admin/booking-rules/${code}`,
} as const;
