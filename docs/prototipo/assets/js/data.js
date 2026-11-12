/* ==========================================================================
   KipuControl — Datos de demostración (tenant ficticio)
   Todos los nombres de empresas, personas y proveedores son ficticios.
   Fecha de referencia del prototipo: 29/09/2026
   ========================================================================== */
window.TODAY = '2026-09-29';

window.SEED = (function () {
  const D = {};

  /* ---------------- Plataforma / tenants ---------------- */
  D.tenant = { id: 'TNT-0001', name: 'Andes Horizonte Travel S.A.C.', short: 'Andes Horizonte', ruc: '20611234567', country: 'Perú', currency: 'PEN', altCurrency: 'USD', fx: 3.74, tz: 'America/Lima', plan: 'Enterprise', status: 'activo', createdAt: '2025-11-03', taxPct: 18, rounding: 'Redondeo a 0.10', logo: 'AH' };
  D.tenants = [
    { id: 'TNT-0001', name: 'Andes Horizonte Travel S.A.C.', ruc: '20611234567', country: 'Perú', plan: 'Enterprise', users: 24, status: 'activo', createdAt: '2025-11-03', modules: 18, storage: '38.2 GB', mrr: 2890 },
    { id: 'TNT-0002', name: 'Selva Viva Expediciones E.I.R.L.', ruc: '20609876543', country: 'Perú', plan: 'Professional', users: 9, status: 'activo', createdAt: '2026-01-15', modules: 12, storage: '11.4 GB', mrr: 1190 },
    { id: 'TNT-0003', name: 'Costa Sur DMC S.A.C.', ruc: '20605551234', country: 'Perú', plan: 'Professional', users: 12, status: 'activo', createdAt: '2026-03-02', modules: 12, storage: '14.9 GB', mrr: 1190 },
    { id: 'TNT-0004', name: 'Altiplano Corporate Travel S.A.', ruc: '20603337788', country: 'Perú', plan: 'Enterprise', users: 31, status: 'activo', createdAt: '2026-04-20', modules: 18, storage: '52.7 GB', mrr: 3150 },
    { id: 'TNT-0005', name: 'Ruta Norte Turismo S.A.C.', ruc: '20612223344', country: 'Perú', plan: 'Starter', users: 4, status: 'prueba', createdAt: '2026-09-12', modules: 6, storage: '0.8 GB', mrr: 0 },
    { id: 'TNT-0006', name: 'Nevados Tours S.R.L.', ruc: '20601119090', country: 'Perú', plan: 'Starter', users: 3, status: 'suspendido', createdAt: '2025-12-01', modules: 6, storage: '2.1 GB', mrr: 490 }
  ];
  D.plans = [
    { id: 'Starter', price: 490, users: 5, modules: ['CRM', 'Catálogo', 'Cotizaciones', 'Reservas', 'Finanzas básicas', 'Portal cliente'] },
    { id: 'Professional', price: 1190, users: 15, modules: ['Todo Starter', 'Operaciones', 'Vouchers', 'Rentabilidad', 'B2B básico', 'Reportes'] },
    { id: 'Enterprise', price: 2890, users: 'Ilimitados', modules: ['Todo Professional', 'Multi-sede', 'E-commerce', 'CMS', 'Apps móviles', 'Integraciones', 'Auditoría avanzada'] }
  ];
  D.sedes = [
    { id: 'SED-01', name: 'Lima — Miraflores', address: 'Av. José Larco 1150, Of. 602, Miraflores', phone: '01 640 2210', manager: 'U02', status: 'activa' },
    { id: 'SED-02', name: 'Cusco — Centro Histórico', address: 'Calle Plateros 348, Cusco', phone: '084 23 1190', manager: 'U05', status: 'activa' },
    { id: 'SED-03', name: 'Arequipa — Yanahuara', address: 'Av. Ejército 710, Yanahuara', phone: '054 27 5540', manager: 'U03', status: 'activa' }
  ];

  /* ---------------- Roles, permisos y usuarios ---------------- */
  D.roles = [
    { id: 'super_admin', name: 'Super Admin SaaS', desc: 'Plataforma, planes y tenants', scope: 'plataforma' },
    { id: 'tenant_admin', name: 'Tenant Admin', desc: 'Administración completa del tenant', scope: 'tenant' },
    { id: 'manager', name: 'Manager', desc: 'Supervisión, aprobaciones y reportes', scope: 'tenant' },
    { id: 'sales', name: 'Ventas (Sales)', desc: 'CRM, clientes y cotizaciones', scope: 'tenant' },
    { id: 'operations', name: 'Operaciones', desc: 'Reservas, proveedores y ejecución', scope: 'tenant' },
    { id: 'finance', name: 'Finanzas', desc: 'Cobros, pagos, costos y rentabilidad', scope: 'tenant' },
    { id: 'accounting', name: 'Contabilidad', desc: 'Facturación y procesos contables', scope: 'tenant' },
    { id: 'guide', name: 'Guía', desc: 'Ejecución de servicios (app operador)', scope: 'mobile' },
    { id: 'driver', name: 'Conductor', desc: 'Transporte (app operador)', scope: 'mobile' },
    { id: 'b2b', name: 'Usuario B2B', desc: 'Agencia asociada — canal B2B', scope: 'canal' },
    { id: 'customer', name: 'Cliente', desc: 'Portal del cliente', scope: 'canal' },
    { id: 'passenger', name: 'Pasajero', desc: 'Portal / app del pasajero', scope: 'canal' },
    { id: 'provider', name: 'Proveedor', desc: 'Confirmación de solicitudes', scope: 'canal' }
  ];
  D.permissionGroups = [
    { module: 'Administración', perms: ['admin.tenant.manage', 'admin.users.manage', 'admin.roles.manage', 'admin.settings.manage', 'admin.audit.view', 'admin.billing.manage', 'admin.api.manage'] },
    { module: 'Colaboración', perms: ['approvals.view', 'inbox.view', 'inbox.manage'] },
    { module: 'CRM', perms: ['crm.leads.view', 'crm.leads.manage', 'crm.opportunities.manage', 'crm.activities.manage', 'crm.clients.manage', 'crm.records.reassign', 'crm.targets.view', 'crm.targets.manage', 'crm.claims.manage'] },
    { module: 'Marketing', perms: ['marketing.campaigns.manage'] },
    { module: 'Catálogo', perms: ['catalog.products.view', 'catalog.products.create', 'catalog.products.update', 'catalog.products.activate', 'catalog.products.manage_rates', 'catalog.products.manage_availability', 'catalog.products.view_profitability', 'catalog.products.publish', 'catalog.products.manage_promotions', 'catalog.providers.manage', 'catalog.allotments.manage'] },
    { module: 'Cotizaciones', perms: ['quotes.view', 'quotes.create', 'quotes.approve_internal', 'quotes.send', 'quotes.discount_override', 'quotes.reassign'] },
    { module: 'Reservas', perms: ['reservations.view', 'reservations.create', 'reservations.modify', 'reservations.cancel', 'reservations.approve_changes', 'reservations.reassign'] },
    { module: 'Operaciones', perms: ['operations.view', 'operations.assign', 'operations.vouchers', 'operations.incidents', 'operations.close', 'operations.travel_docs'] },
    { module: 'Finanzas', perms: ['finance.receivables', 'finance.payments.register', 'finance.payments.revert', 'finance.payables', 'finance.commissions', 'finance.profitability', 'finance.invoicing', 'finance.treasury'] },
    { module: 'Canales', perms: ['channels.b2b.manage', 'channels.ecommerce.manage', 'channels.cms.edit', 'channels.cms.publish'] },
    { module: 'Extranet', perms: ['supplier.portal.view', 'supplier.requests.respond', 'supplier.rooming.manage', 'supplier.vouchers.redeem', 'supplier.payables.view', 'supplier.invoices.upload', 'supplier.incidents.report', 'supplier.rates.request', 'supplier.users.manage'] },
    { module: 'Reportes', perms: ['reports.view', 'reports.export'] },
    { module: 'Crecimiento', perms: ['ai.assistant.use', 'ai.insights.view', 'inbox.whatsapp.manage', 'finance.payment_links', 'finance.gift_cards', 'finance.accounting_export', 'catalog.products.import', 'catalog.products.dynamic_pricing', 'channels.ota.manage', 'channels.marketplace.manage', 'operations.checkin', 'quotes.external_offers'] },   // v2.6 · spec 19
    { module: 'Corporativo', perms: ['crm.corporate.manage', 'finance.corporate_statements'] },   // v2.7 · spec 20
    { module: 'Marca y vitrina', perms: ['channels.showcase.manage', 'cms.seo.manage', 'finance.gateways.manage'] },   // v2.8 · spec 22
    { module: 'Plantillas e IA', perms: ['cms.templates.manage', 'ai.content.use'] },   // v2.9 · spec 23
    { module: 'Seguimiento y visitas', perms: ['marketing.tracking.manage', 'marketing.tracking.approve', 'analytics.web.view'] }   // v2.10 · spec 24
  ];
  const ALL = D.permissionGroups.flatMap(g => g.perms);
  const pick = (pref) => ALL.filter(p => pref.some(x => p.startsWith(x)));
  /* Matriz de permisos por rol (referencia: ERP turísticos y CRM de mercado).
     - Super Admin SaaS: consola de plataforma, NO opera los datos comerciales de los tenants.
     - Tenant Admin: todo el tenant, sin gestión de plataforma.
     - Manager: supervisión, aprobaciones y reportes; no configura el sistema ni registra caja.
     - Ventas: solo su cartera (leads, oportunidades, cotizaciones); no aprueba descuentos ni anula reservas.
     - Operaciones: reservas en ejecución, proveedores, asignaciones, vouchers; no ve rentabilidad.
     - Finanzas / Contabilidad: dinero y comprobantes; no editan catálogo ni CRM.
     - Roles externos (guía, conductor, B2B, cliente, pasajero, proveedor): solo su portal o app. */
  const EXCL = (list) => ALL.filter(p => !list.some(x => p.startsWith(x)));
  D.rolePerms = {
    super_admin: ['admin.tenant.manage', 'admin.audit.view'],
    tenant_admin: EXCL(['admin.tenant.', 'supplier.']),
    manager: EXCL(['supplier.', 'admin.tenant.', 'admin.roles.', 'admin.settings.', 'admin.users.', 'admin.billing.', 'admin.api.', 'finance.payments.register', 'finance.payments.revert', 'finance.invoicing', 'catalog.providers.manage', 'finance.accounting_export', 'finance.gateways.manage', 'marketing.tracking.approve']),
    sales: ['crm.leads.view', 'crm.leads.manage', 'crm.opportunities.manage', 'crm.activities.manage', 'crm.clients.manage', 'catalog.products.view', 'quotes.view', 'quotes.create', 'quotes.send', 'reservations.view', 'reservations.create', 'reports.view', 'approvals.view', 'inbox.view', 'inbox.manage', 'crm.targets.view', 'ai.assistant.use', 'finance.payment_links', 'quotes.external_offers', 'crm.corporate.manage', 'analytics.web.view'],
    operations: ['catalog.products.view', 'catalog.products.manage_availability', 'catalog.providers.manage', 'reservations.view', 'reservations.modify', 'operations.view', 'operations.assign', 'operations.vouchers', 'operations.incidents', 'operations.close', 'reports.view', 'approvals.view', 'inbox.view', 'inbox.manage', 'catalog.allotments.manage', 'operations.travel_docs', 'ai.assistant.use', 'operations.checkin'],
    finance: ['finance.receivables', 'finance.gateways.manage', 'finance.payments.register', 'finance.payments.revert', 'finance.payables', 'finance.commissions', 'finance.profitability', 'finance.invoicing', 'reservations.view', 'quotes.view', 'catalog.products.view', 'catalog.products.view_profitability', 'reports.view', 'reports.export', 'finance.treasury', 'approvals.view', 'ai.insights.view', 'finance.payment_links', 'finance.gift_cards', 'finance.accounting_export', 'crm.corporate.manage', 'finance.corporate_statements'],
    accounting: ['finance.invoicing', 'finance.receivables', 'reservations.view', 'reports.view', 'reports.export', 'finance.treasury', 'finance.accounting_export', 'finance.corporate_statements'],
    guide: ['operations.view', 'operations.incidents', 'operations.checkin'],
    driver: ['operations.view', 'operations.incidents', 'operations.checkin'],
    b2b: ['catalog.products.view', 'quotes.create', 'reservations.create', 'reservations.view'],
    customer: ['quotes.view', 'reservations.view'],
    passenger: ['reservations.view'],
    provider: ['operations.view', 'supplier.portal.view', 'supplier.requests.respond', 'supplier.rooming.manage', 'supplier.vouchers.redeem', 'supplier.payables.view', 'supplier.invoices.upload', 'supplier.incidents.report', 'supplier.rates.request', 'supplier.users.manage']
  };
  D.users = [
    { id: 'U01', name: 'Mariela Quispe Rojas', email: 'mquispe@andeshorizonte.pe', role: 'tenant_admin', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-29 08:12', mfa: true, phone: '987 112 450', color: '#1560B8' },
    { id: 'U02', name: 'Renato Salazar Vega', email: 'rsalazar@andeshorizonte.pe', role: 'manager', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-29 08:40', mfa: true, phone: '987 331 902', color: '#6A4FB3' },
    { id: 'U03', name: 'Lucía Paredes Torres', email: 'lparedes@andeshorizonte.pe', role: 'sales', sede: 'SED-03', status: 'activo', lastLogin: '2026-09-29 09:02', mfa: false, phone: '954 220 118', color: '#0E9AAB' },
    { id: 'U04', name: 'Diego Fernández Luna', email: 'dfernandez@andeshorizonte.pe', role: 'sales', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-28 18:30', mfa: true, phone: '945 881 207', color: '#2F6FB5' },
    { id: 'U05', name: 'Karina Huamán Ccori', email: 'khuaman@andeshorizonte.pe', role: 'operations', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-29 07:05', mfa: true, phone: '984 410 663', color: '#1E8A55' },
    { id: 'U06', name: 'Jorge Mamani Apaza', email: 'jmamani@andeshorizonte.pe', role: 'operations', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-29 06:48', mfa: false, phone: '984 552 190', color: '#1F6FB8' },
    { id: 'U07', name: 'Patricia León Gamarra', email: 'pleon@andeshorizonte.pe', role: 'finance', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-29 08:55', mfa: true, phone: '991 204 378', color: '#C0392B' },
    { id: 'U08', name: 'César Villanueva Ruiz', email: 'cvillanueva@andeshorizonte.pe', role: 'accounting', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-26 17:10', mfa: true, phone: '991 776 010', color: '#46606B' },
    { id: 'U09', guideId: 'G01', name: 'Wilber Condori Sutta', email: 'wcondori@guias.pe', role: 'guide', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-29 04:10', mfa: false, phone: '974 118 552', color: '#0A3A73' },
    { id: 'U10', guideId: 'G02', name: 'Hilda Ccahuana Puma', email: 'hccahuana@guias.pe', role: 'guide', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-28 20:01', mfa: false, phone: '974 228 671', color: '#6A4FB3' },
    { id: 'U11', driverId: 'C01', name: 'Edwin Choque Layme', email: 'echoque@conductores.pe', role: 'driver', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-29 03:55', mfa: false, phone: '958 330 214', color: '#2F6FB5' },
    { id: 'U12', name: 'Rosa Tito Huallpa', email: 'rtito@andeshorizonte.pe', role: 'sales', sede: 'SED-02', status: 'inactivo', lastLogin: '2026-08-30 12:44', mfa: false, phone: '984 009 331', color: '#7C929B' },
    { id: 'U13', agencyId: 'AGB-01', clientId: 'CLI-0007', name: 'Agencia Wayra Viajes (B2B)', email: 'reservas@wayraviajes.pe', role: 'b2b', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-28 16:22', mfa: false, phone: '01 445 9012', color: '#0E9AAB' },
    { id: 'U14', clientId: 'CLI-0001', name: 'Gabriela Ríos Montoya', email: 'gabriela.rios@correo.pe', role: 'customer', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-27 21:14', mfa: false, phone: '999 102 334', color: '#1560B8' },
    { id: 'U15', clientId: 'CLI-0003', resId: 'RES-2026-000347', name: 'Thomas Keller', email: 't.keller@mail.de', role: 'passenger', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-29 05:30', mfa: false, phone: '+49 171 5550102', color: '#1E8A55' },
    { id: 'U16', name: 'Superadmin Plataforma', email: 'ops@kipucontrol.com', role: 'super_admin', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-29 07:00', mfa: true, phone: '—', color: '#0A3A73' },
    { id: 'U17', providerId: 'PRV-001', name: 'Hotel Tambo Real Cusco (Proveedor)', email: 'reservas@tamboreal.pe', role: 'provider', sede: 'SED-02', status: 'activo', lastLogin: '2026-09-28 11:05', mfa: false, phone: '084 25 3300', color: '#1F6FB8' },
    { id: 'U18', clientId: 'CLI-0002', name: 'Úrsula Benavides Lara', email: 'ubenavides@mcblanca.com.pe', role: 'customer', sede: 'SED-01', status: 'activo', lastLogin: '2026-09-30 09:40', mfa: true, phone: '01 705 3312', color: '#6D4BC2' }
  ];

  /* ---------------- Portal corporativo (v2.7 · spec 20) ----------------
     Cuenta corporativa de la empresa cliente: centros de costo, viajeros, usuarios del portal con su rol
     (administrador, aprobador, pagador, viajero), aprobaciones, asignación de costos y estados de cuenta.
     `history` son las compras de meses anteriores ya cerradas (en producción salen de booking_reservations,
     fin_payments y las notas de crédito); la reserva viva RES-2026-000348 se lee de las tablas del demo. */
  D.corpAccounts = [
    { id: 'CORP-001', clientId: 'CLI-0002', status: 'activa', currency: 'PEN', creditDays: 30, requireApproval: true, approvalThreshold: 5000, defaultCc: 'CC-RRHH',
      statement: { auto: true, day: 1, recipients: ['ubenavides@mcblanca.com.pe', 'cuentasporpagar@mcblanca.com.pe'], lastSent: '2026-10-01' },
      costCenters: [
        { id: 'CC-GER', name: 'Gerencia general', budget: 30000, period: 'anual', active: true },
        { id: 'CC-OPS', name: 'Operaciones mina', budget: 25000, period: 'anual', active: true },
        { id: 'CC-SEG', name: 'Seguridad y salud ocupacional', budget: 20000, period: 'anual', active: true },
        { id: 'CC-RRHH', name: 'RR. HH. · Incentivos y bienestar', budget: 90000, period: 'anual', active: true }
      ],
      users: [
        { id: 'CPU-01', userId: 'U18', name: 'Úrsula Benavides Lara', email: 'ubenavides@mcblanca.com.pe', role: 'administrador', cc: null, active: true },
        { id: 'CPU-02', userId: null, name: 'Gonzalo Pacheco Ruiz', email: 'gpacheco@mcblanca.com.pe', role: 'aprobador', cc: 'CC-GER', active: true },
        { id: 'CPU-03', userId: null, name: 'Milagros Tello Ccori', email: 'cuentasporpagar@mcblanca.com.pe', role: 'pagador', cc: null, active: true },
        { id: 'CPU-04', userId: null, name: 'Ernesto Valdivia Ríos', email: 'evaldivia@mcblanca.com.pe', role: 'viajero', cc: 'CC-OPS', active: true }
      ],
      allocations: { 'RES-2026-000348': { cc: 'CC-RRHH' } },
      history: [
        { resId: 'RES-2026-000118', title: 'Directorio — reunión en Arequipa', date: '2026-02-09', travelFrom: '2026-02-18', cc: 'CC-GER', amount: 6840, currency: 'PEN', travelers: ['Gonzalo Pacheco Ruiz', 'Úrsula Benavides Lara', 'Raúl Espinoza Llerena'], approvedBy: 'Gonzalo Pacheco Ruiz', invoice: 'F001-00001190',
          payments: [{ id: 'PAG-01402', date: '2026-03-10', amount: 6840, method: 'Transferencia BCP' }] },
        { resId: 'RES-2026-000162', title: 'Capacitación SSO en Cusco — 8 pax', date: '2026-04-06', travelFrom: '2026-04-20', cc: 'CC-SEG', amount: 12450, currency: 'PEN', travelers: ['Karla Ugaz Soto', 'Óscar Linares Paz', 'Mónica Farfán Quiroz', 'Sandra Chávez Molina', 'Luis Alberto Huerta', 'Teresa Anaya Cruz', 'Fernando Rivas Olaya', 'Rocío Salinas Tapia'], approvedBy: 'Gonzalo Pacheco Ruiz', invoice: 'F001-00001268',
          payments: [{ id: 'PAG-01577', date: '2026-05-05', amount: 12450, method: 'Transferencia BBVA' }] },
        { resId: 'RES-2026-000201', title: 'Visita técnica a Huaraz — 5 pax', date: '2026-06-02', travelFrom: '2026-06-15', cc: 'CC-OPS', amount: 9380, currency: 'PEN', travelers: ['Ernesto Valdivia Ríos', 'Julio César Mena', 'Manuel Oré Guzmán', 'Óscar Linares Paz', 'Raúl Espinoza Llerena'], approvedBy: 'Gonzalo Pacheco Ruiz', invoice: 'F001-00001331',
          payments: [{ id: 'PAG-01688', date: '2026-07-01', amount: 8180, method: 'Transferencia BCP' }],
          creditNote: { id: 'F001-00001352', date: '2026-06-20', amount: 1200, reason: 'Traslado no prestado (cierre de vía)' } },
        { resId: 'RES-2026-000254', title: 'Traslados ejecutivos Lima — julio', date: '2026-07-08', travelFrom: '2026-07-10', cc: 'CC-GER', amount: 3960, currency: 'PEN', travelers: ['Gonzalo Pacheco Ruiz', 'Úrsula Benavides Lara'], approvedBy: 'Úrsula Benavides Lara', invoice: 'F001-00001390',
          payments: [{ id: 'PAG-01755', date: '2026-08-07', amount: 3960, method: 'Transferencia BCP' }] },
        { resId: 'RES-2026-000297', title: 'Bienestar — fin de semana en Paracas', date: '2026-08-04', travelFrom: '2026-08-22', cc: 'CC-RRHH', amount: 21700, currency: 'PEN', travelers: ['Karla Ugaz Soto', 'Mónica Farfán Quiroz', 'Teresa Anaya Cruz', 'Rocío Salinas Tapia', 'Sandra Chávez Molina', 'Julio César Mena', 'Fernando Rivas Olaya', 'Manuel Oré Guzmán', 'Luis Alberto Huerta', 'Ernesto Valdivia Ríos'], approvedBy: 'Úrsula Benavides Lara', invoice: 'F001-00001431',
          payments: [{ id: 'PAG-01840', date: '2026-09-03', amount: 21700, method: 'Transferencia BBVA' }] }
      ],
      approvals: [
        { id: 'APC-0007', ref: 'COT-2026-00201', title: 'Gerencia — visita a planta Trujillo (3 pax)', amount: 7420, currency: 'PEN', cc: 'CC-GER', requestedBy: 'Ernesto Valdivia Ríos', approver: 'Gonzalo Pacheco Ruiz', status: 'pendiente', requestedAt: '2026-09-29 17:05', expiresAt: '2026-10-03', decidedAt: null, reason: '' },
        { id: 'APC-0006', ref: 'RES-2026-000348', title: 'Incentivo mineros Q4 — Cusco', amount: 58610, currency: 'PEN', cc: 'CC-RRHH', requestedBy: 'Úrsula Benavides Lara', approver: 'Gonzalo Pacheco Ruiz', status: 'aprobada', requestedAt: '2026-09-04 10:12', expiresAt: '2026-09-08', decidedAt: '2026-09-05 11:58', reason: '' },
        { id: 'APC-0005', ref: 'COT-2026-00171', title: 'Seguridad — congreso en Lima (4 pax)', amount: 6100, currency: 'PEN', cc: 'CC-SEG', requestedBy: 'Karla Ugaz Soto', approver: 'Gonzalo Pacheco Ruiz', status: 'rechazada', requestedAt: '2026-08-18 09:30', expiresAt: '2026-08-22', decidedAt: '2026-08-19 16:40', reason: 'Fuera del presupuesto del trimestre' }
      ],
      exports: [{ id: 'EXC-0012', type: 'Estado de cuenta', period: '2026-09', format: 'PDF', status: 'listo', by: 'Sistema (envío automático)', at: '2026-10-01 06:00' }]
    }
  ];

  /* ---------------- Destinos (jerarquía) ---------------- */
  D.destinations = [
    { id: 'D01', name: 'Perú', type: 'País', parent: null, lat: -9.19, lng: -75.02 },
    { id: 'D02', name: 'Sur Andino', type: 'Región', parent: 'D01' },
    { id: 'D03', name: 'Cusco', type: 'Departamento', parent: 'D02', lat: -13.53, lng: -71.97 },
    { id: 'D04', name: 'Cusco (ciudad)', type: 'Ciudad', parent: 'D03', lat: -13.5319, lng: -71.9675 },
    { id: 'D05', name: 'Valle Sagrado', type: 'Zona', parent: 'D03', lat: -13.33, lng: -72.08 },
    { id: 'D06', name: 'Machu Picchu', type: 'Atracción', parent: 'D03', lat: -13.1631, lng: -72.545 },
    { id: 'D07', name: 'Laguna Humantay', type: 'Atracción', parent: 'D03', lat: -13.3876, lng: -72.6121 },
    { id: 'D08', name: 'Montaña de Colores (Vinicunca)', type: 'Atracción', parent: 'D03', lat: -13.8697, lng: -71.3031 },
    { id: 'D09', name: 'Puno', type: 'Departamento', parent: 'D02', lat: -15.84, lng: -70.02 },
    { id: 'D10', name: 'Lago Titicaca', type: 'Atracción', parent: 'D09', lat: -15.77, lng: -69.68 },
    { id: 'D11', name: 'Arequipa', type: 'Departamento', parent: 'D02', lat: -16.40, lng: -71.54 },
    { id: 'D12', name: 'Cañón del Colca', type: 'Atracción', parent: 'D11', lat: -15.61, lng: -71.90 },
    { id: 'D13', name: 'Costa Centro', type: 'Región', parent: 'D01' },
    { id: 'D14', name: 'Lima', type: 'Departamento', parent: 'D13', lat: -12.05, lng: -77.04 },
    { id: 'D15', name: 'Ica', type: 'Departamento', parent: 'D13', lat: -14.07, lng: -75.73 },
    { id: 'D16', name: 'Paracas', type: 'Ciudad', parent: 'D15', lat: -13.83, lng: -76.25 },
    { id: 'D17', name: 'Huacachina', type: 'Lugar', parent: 'D15', lat: -14.087, lng: -75.763 },
    { id: 'D18', name: 'Amazonía', type: 'Región', parent: 'D01' },
    { id: 'D19', name: 'Loreto — Iquitos', type: 'Ciudad', parent: 'D18', lat: -3.74, lng: -73.25 },
    { id: 'D20', name: 'Madre de Dios — Tambopata', type: 'Zona', parent: 'D18', lat: -12.59, lng: -69.19 }
  ];

  /* ---------------- Proveedores ---------------- */
  D.providers = [
    { id: 'PRV-001', name: 'Hotel Tambo Real Cusco', type: 'Hotel', ruc: '20490011223', city: 'Cusco', contact: 'Milagros Álvarez', phone: '084 25 3300', email: 'reservas@tamboreal.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.6, currency: 'USD', paymentTerms: 'Crédito 15 días', stars: 4 },
    { id: 'PRV-002', name: 'Hotel Piedra Viva Boutique', type: 'Hotel', ruc: '20490044556', city: 'Cusco', contact: 'Andrés Peralta', phone: '084 24 7711', email: 'ventas@piedraviva.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.8, currency: 'USD', paymentTerms: 'Prepago 50%', stars: 5 },
    { id: 'PRV-003', name: 'Hostal Valle Inka', type: 'Hotel', ruc: '20491230011', city: 'Urubamba', contact: 'Rocío Yupanqui', phone: '084 20 1144', email: 'reservas@valleinka.pe', contractStart: '2026-03-01', contractEnd: '2027-02-28', status: 'activo', rating: 4.3, currency: 'PEN', paymentTerms: 'Crédito 7 días', stars: 3 },
    { id: 'PRV-004', name: 'Transportes Qosqo Tour S.A.C.', type: 'Transporte', ruc: '20527788990', city: 'Cusco', contact: 'Fredy Huillca', phone: '984 700 120', email: 'operaciones@qosqotour.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.5, currency: 'PEN', paymentTerms: 'Crédito 30 días' },
    { id: 'PRV-005', name: 'Ferrovía Sur Andina', type: 'Tren', ruc: '20480099887', city: 'Cusco', contact: 'Mesa corporativa', phone: '084 58 1414', email: 'corporativo@ferroviasur.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.4, currency: 'USD', paymentTerms: 'Prepago' },
    { id: 'PRV-006', name: 'Asociación de Guías Oficiales Cusco', type: 'Guía', ruc: '20530011002', city: 'Cusco', contact: 'Wilber Condori', phone: '974 118 552', email: 'coordinacion@agocusco.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.7, currency: 'PEN', paymentTerms: 'Semanal' },
    { id: 'PRV-007', name: 'Restaurante Tika Wasi', type: 'Restaurante', ruc: '20533300441', city: 'Urubamba', contact: 'Elena Quispe', phone: '084 20 3322', email: 'grupos@tikawasi.pe', contractStart: '2026-02-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.5, currency: 'PEN', paymentTerms: 'Crédito 15 días' },
    { id: 'PRV-008', name: 'Consettur Ruta Hiram (Bus MAPI)', type: 'Transporte', ruc: '20481122334', city: 'Aguas Calientes', contact: 'Ventanilla corporativa', phone: '084 21 1133', email: 'corporativo@rutahiram.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.0, currency: 'USD', paymentTerms: 'Prepago' },
    { id: 'PRV-009', name: 'Ministerio de Cultura — Boletaje', type: 'Entrada', ruc: '20537630222', city: 'Cusco', contact: 'Plataforma de boletos', phone: '—', email: '—', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.0, currency: 'PEN', paymentTerms: 'Prepago' },
    { id: 'PRV-010', name: 'Paracas Náutica E.I.R.L.', type: 'Actividad', ruc: '20541100776', city: 'Paracas', contact: 'Luis Cárdenas', phone: '956 440 118', email: 'reservas@paracasnautica.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.4, currency: 'PEN', paymentTerms: 'Crédito 15 días' },
    { id: 'PRV-011', name: 'Titicaca Lodge Uros', type: 'Hotel', ruc: '20448866001', city: 'Puno', contact: 'Nancy Coaquira', phone: '051 36 5500', email: 'reservas@titicacalodge.pe', contractStart: '2026-01-01', contractEnd: '2026-09-15', status: 'vencido', rating: 4.2, currency: 'USD', paymentTerms: 'Prepago 30%' },
    { id: 'PRV-012', name: 'Colca Andes Trek', type: 'Operador', ruc: '20455512300', city: 'Arequipa', contact: 'Hernán Zúñiga', phone: '959 882 330', email: 'ops@colcaandes.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.3, currency: 'PEN', paymentTerms: 'Crédito 15 días' },
    { id: 'PRV-013', name: 'Amazon River Lodge', type: 'Hotel', ruc: '20493321100', city: 'Iquitos', contact: 'Carlos Pinedo', phone: '065 23 4455', email: 'reservas@amazonriverlodge.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'inactivo', rating: 3.9, currency: 'USD', paymentTerms: 'Prepago' },
    { id: 'PRV-014', name: 'Seguros Viajero Andino', type: 'Otros', ruc: '20600044112', city: 'Lima', contact: 'Área corporativa', phone: '01 611 2020', email: 'corporativo@viajeroandino.pe', contractStart: '2026-01-01', contractEnd: '2026-12-31', status: 'activo', rating: 4.1, currency: 'USD', paymentTerms: 'Mensual' }
  ];

  /* ---------------- Recursos operativos ---------------- */
  D.guides = [
    { id: 'G01', userId: 'U09', name: 'Wilber Condori Sutta', languages: ['ES', 'EN', 'QU'], license: 'GOT-CUS-0441', rating: 4.9, status: 'disponible', phone: '974 118 552' },
    { id: 'G02', userId: 'U10', name: 'Hilda Ccahuana Puma', languages: ['ES', 'EN', 'DE'], license: 'GOT-CUS-0588', rating: 4.8, status: 'asignado', phone: '974 228 671' },
    { id: 'G03', userId: null, name: 'Raúl Pumacahua Soto', languages: ['ES', 'FR', 'EN'], license: 'GOT-CUS-0712', rating: 4.6, status: 'disponible', phone: '974 551 330' },
    { id: 'G04', userId: null, name: 'Yesenia Arce Huamaní', languages: ['ES', 'EN', 'PT'], license: 'GOT-CUS-0803', rating: 4.7, status: 'vacaciones', phone: '974 668 120' },
    { id: 'G05', userId: null, name: 'Óscar Delgado Paz', languages: ['ES', 'EN'], license: 'GOT-ARE-0120', rating: 4.5, status: 'disponible', phone: '959 110 443' }
  ];
  D.drivers = [
    { id: 'C01', userId: 'U11', name: 'Edwin Choque Layme', license: 'A-IIIb Q48219033', expires: '2027-05-10', status: 'asignado', phone: '958 330 214' },
    { id: 'C02', userId: null, name: 'Marco Sullca Quispe', license: 'A-IIIb Q47100822', expires: '2026-11-02', status: 'disponible', phone: '958 441 207' },
    { id: 'C03', userId: null, name: 'Víctor Hanco Mayta', license: 'A-IIb Q46631190', expires: '2026-10-08', status: 'disponible', phone: '958 552 318' },
    { id: 'C04', userId: null, name: 'Nilo Ramos Chura', license: 'A-IIIb Q45522871', expires: '2027-02-21', status: 'descanso', phone: '958 663 902' }
  ];
  D.vehicles = [
    { id: 'V01', plate: 'X4F-821', type: 'Sprinter 19 pax', capacity: 19, providerId: 'PRV-004', status: 'asignado', soat: '2027-03-01' },
    { id: 'V02', plate: 'X4G-310', type: 'Sprinter 15 pax', capacity: 15, providerId: 'PRV-004', status: 'disponible', soat: '2026-12-15' },
    { id: 'V03', plate: 'X3Z-775', type: 'Coaster 25 pax', capacity: 25, providerId: 'PRV-004', status: 'disponible', soat: '2027-01-20' },
    { id: 'V04', plate: 'X5A-102', type: 'Van H1 9 pax', capacity: 9, providerId: 'PRV-004', status: 'mantenimiento', soat: '2026-10-05' },
    { id: 'V05', plate: 'X2B-448', type: 'SUV 4 pax', capacity: 4, providerId: 'PRV-004', status: 'disponible', soat: '2027-06-30' }
  ];

  /* ---------------- Servicios (componente operativo) ---------------- */
  D.services = [
    { id: 'SRV-001', providerId: 'PRV-004', name: 'Traslado aeropuerto ⇄ hotel Cusco (privado)', type: 'Traslado', unit: 'servicio', cost: 60, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 9, status: 'activo' },
    { id: 'SRV-002', providerId: 'PRV-004', name: 'Bus turístico Cusco — Ollantaytambo', type: 'Transporte', unit: 'pax', cost: 35, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 19, status: 'activo' },
    { id: 'SRV-003', providerId: 'PRV-005', name: 'Tren Ollantaytambo — Aguas Calientes (ida/vuelta) Expedition', type: 'Tren', unit: 'pax', cost: 150, currency: 'USD', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: null, status: 'activo' },
    { id: 'SRV-004', providerId: 'PRV-008', name: 'Bus Consettur subida/bajada MAPI', type: 'Transporte', unit: 'pax', cost: 24, currency: 'USD', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: null, status: 'activo' },
    { id: 'SRV-005', providerId: 'PRV-009', name: 'Entrada Machu Picchu — Circuito 2', type: 'Entrada', unit: 'pax', cost: 152, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 4500, status: 'activo' },
    { id: 'SRV-006', providerId: 'PRV-006', name: 'Guía oficial bilingüe (jornada)', type: 'Guía', unit: 'servicio', cost: 220, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 16, status: 'activo' },
    { id: 'SRV-007', providerId: 'PRV-007', name: 'Almuerzo buffet Valle Sagrado', type: 'Alimentación', unit: 'pax', cost: 45, currency: 'PEN', validFrom: '2026-02-01', validTo: '2026-12-31', capacity: 80, status: 'activo' },
    { id: 'SRV-008', providerId: 'PRV-001', name: 'Hab. doble estándar c/desayuno — Tambo Real', type: 'Alojamiento', unit: 'habitación', cost: 95, currency: 'USD', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 12, status: 'activo' },
    { id: 'SRV-009', providerId: 'PRV-002', name: 'Hab. deluxe c/desayuno — Piedra Viva', type: 'Alojamiento', unit: 'habitación', cost: 180, currency: 'USD', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 6, status: 'activo' },
    { id: 'SRV-010', providerId: 'PRV-003', name: 'Hab. doble — Hostal Valle Inka', type: 'Alojamiento', unit: 'habitación', cost: 190, currency: 'PEN', validFrom: '2026-03-01', validTo: '2027-02-28', capacity: 10, status: 'activo' },
    { id: 'SRV-011', providerId: 'PRV-009', name: 'Boleto Turístico del Cusco (integral)', type: 'Entrada', unit: 'pax', cost: 130, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: null, status: 'activo' },
    { id: 'SRV-012', providerId: 'PRV-004', name: 'Transporte Cusco — Soraypampa (Humantay)', type: 'Transporte', unit: 'pax', cost: 40, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 19, status: 'activo' },
    { id: 'SRV-013', providerId: 'PRV-007', name: 'Desayuno + almuerzo campestre Mollepata', type: 'Alimentación', unit: 'pax', cost: 30, currency: 'PEN', validFrom: '2026-02-01', validTo: '2026-12-31', capacity: 60, status: 'activo' },
    { id: 'SRV-014', providerId: 'PRV-010', name: 'Paseo en lancha Islas Ballestas', type: 'Actividad', unit: 'pax', cost: 55, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 40, status: 'activo' },
    { id: 'SRV-015', providerId: 'PRV-014', name: 'Seguro de asistencia en viaje (por día)', type: 'Seguro', unit: 'pax', cost: 4, currency: 'USD', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: null, status: 'activo' },
    { id: 'SRV-016', providerId: 'PRV-012', name: 'Tour Colca 2D/1N compartido', type: 'Tour', unit: 'pax', cost: 210, currency: 'PEN', validFrom: '2026-01-01', validTo: '2026-12-31', capacity: 20, status: 'activo' },
    { id: 'SRV-017', providerId: 'PRV-011', name: 'Noche en lodge flotante Uros', type: 'Alojamiento', unit: 'habitación', cost: 120, currency: 'USD', validFrom: '2026-01-01', validTo: '2026-09-15', capacity: 8, status: 'vencido' }
  ];

  /* ---------------- Catálogo configurable ---------------- */
  D.productTypes = ['TOUR', 'EXCURSIÓN', 'PAQUETE', 'ACTIVIDAD', 'EXPERIENCIA', 'TRASLADO', 'ALOJAMIENTO', 'TRANSPORTE', 'ENTRADA/TICKET', 'CIRCUITO', 'PROGRAMA TURÍSTICO', 'SERVICIO COMBINADO', 'PRODUCTO PERSONALIZADO'];
  D.categories = [
    { id: 'CAT-1', name: 'Aventura', subs: ['Trekking', 'Montañismo', 'Deportes extremos'] },
    { id: 'CAT-2', name: 'Cultural', subs: ['Arqueología', 'Museos', 'City Tours'] },
    { id: 'CAT-3', name: 'Naturaleza', subs: ['Ecoturismo', 'Fauna', 'Paisajes'] },
    { id: 'CAT-4', name: 'Gastronomía', subs: ['Restaurantes', 'Experiencias gastronómicas', 'Degustaciones'] },
    { id: 'CAT-5', name: 'Logística', subs: ['Traslados', 'Alojamiento', 'Seguros'] }
  ];
  D.seasons = [
    { id: 'TMP-01', name: 'Temporada alta 2026 (invierno seco)', type: 'Alta', from: '2026-06-01', to: '2026-08-31', priority: 1, factor: 1.20, status: 'activa' },
    { id: 'TMP-02', name: 'Temporada media — primavera', type: 'Media', from: '2026-09-01', to: '2026-11-30', priority: 2, factor: 1.00, status: 'activa' },
    { id: 'TMP-03', name: 'Temporada baja — lluvias', type: 'Baja', from: '2026-12-01', to: '2027-03-31', priority: 3, factor: 0.88, status: 'activa' },
    { id: 'TMP-04', name: 'Fiestas Patrias', type: 'Feriado', from: '2026-07-25', to: '2026-07-31', priority: 0, factor: 1.35, status: 'activa' },
    { id: 'TMP-05', name: 'Año Nuevo en Cusco', type: 'Fecha especial', from: '2026-12-28', to: '2027-01-02', priority: 0, factor: 1.40, status: 'activa' },
    { id: 'TMP-06', name: 'Inti Raymi', type: 'Fecha especial', from: '2026-06-20', to: '2026-06-25', priority: 0, factor: 1.50, status: 'activa' }
  ];

  /* ---------------- Productos turísticos ---------------- */
  const pol = (c) => ({
    cancel: c || 'Sin penalidad hasta 15 días antes. 50% entre 14 y 7 días. 100% dentro de 7 días o no-show.',
    modify: 'Cambios de fecha sin costo hasta 10 días antes, sujetos a disponibilidad y diferencia tarifaria.',
    noshow: 'No-show se factura al 100%. No hay reembolso de entradas nominativas.',
    refund: 'Reembolsos en 7–15 días hábiles por el mismo medio de pago, descontando gastos bancarios.',
    advanceMin: '48 horas', advanceMax: '365 días'
  });
  D.products = [
    {
      id: 'PRD-001', code: 'CUS-MAPI-FD', sku: 'AH-MAPI-001', name: 'Machu Picchu Full Day', internalName: 'MAPI FD Expedition + Circuito 2', type: 'EXCURSIÓN', category: 'Cultural', subcategory: 'Arqueología', destId: 'D06', secondary: ['D05', 'D04'], status: 'ACTIVE', short: 'Visita guiada a la ciudadela inca en un día, con tren panorámico desde Ollantaytambo.', long: 'Salida muy temprano desde el hotel en Cusco hacia la estación de Ollantaytambo. Tren Expedition a Aguas Calientes, bus de subida y visita guiada de 2 h 30 min por el Circuito 2 de la ciudadela. Tiempo libre para almorzar en Aguas Calientes y retorno en tren y bus a Cusco.', durationValue: 16, durationUnit: 'horas', modality: 'Compartido', mainProviderId: 'PRV-005', minPax: 1, maxPax: 16, minAge: 0, maxAge: 85, advMin: 3, advMax: 365, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: true }, markupPct: 28,
      components: [
        { serviceId: 'SRV-002', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: 'Recojo 04:10 desde hotel' },
        { serviceId: 'SRV-003', qty: 1, unit: 'pax', order: 2, required: true, included: true, notes: 'Tren 05:05 / retorno 15:20' },
        { serviceId: 'SRV-004', qty: 1, unit: 'pax', order: 3, required: true, included: true, notes: '' },
        { serviceId: 'SRV-005', qty: 1, unit: 'pax', order: 4, required: true, included: true, notes: 'Nominativa, requiere pasaporte' },
        { serviceId: 'SRV-006', qty: 1, unit: 'servicio', order: 5, required: true, included: true, notes: 'Grupo máx. 16' },
        { serviceId: 'SRV-015', qty: 1, unit: 'pax', order: 6, required: false, included: true, notes: '' }
      ],
      itinerary: [{ day: 1, title: 'Cusco — Machu Picchu — Cusco', items: [
        { time: '04:10', activity: 'Recojo del hotel en Cusco', type: 'Transporte', location: 'Hoteles Centro Histórico' },
        { time: '05:05', activity: 'Tren Ollantaytambo → Aguas Calientes', type: 'Tren', location: 'Estación Ollantaytambo' },
        { time: '07:30', activity: 'Bus de subida a la ciudadela', type: 'Transporte', location: 'Aguas Calientes' },
        { time: '08:00', activity: 'Visita guiada Circuito 2 (2 h 30 min)', type: 'Guía', location: 'Machu Picchu' },
        { time: '12:30', activity: 'Almuerzo libre en Aguas Calientes', type: 'Alimentación', location: 'Aguas Calientes' },
        { time: '15:20', activity: 'Tren de retorno a Ollantaytambo', type: 'Tren', location: 'Aguas Calientes' },
        { time: '19:30', activity: 'Llegada al hotel en Cusco', type: 'Transporte', location: 'Cusco' }
      ] }],
      inclusions: ['Transporte hotel — estación — hotel', 'Tren Expedition ida y vuelta', 'Bus Consettur subida y bajada', 'Entrada a Machu Picchu Circuito 2', 'Guía oficial bilingüe', 'Seguro de asistencia'],
      exclusions: ['Almuerzo', 'Propinas', 'Bebidas', 'Gastos personales', 'Ingreso a Huayna Picchu'],
      requirements: ['Pasaporte o DNI original (entrada nominativa)', 'Condición física: moderada', 'Llevar protector solar, repelente y casaca impermeable', 'Mochila máx. 20 L en la ciudadela'],
      policies: pol('Entradas no reembolsables una vez emitidas. Tren: 50% hasta 7 días; 100% dentro de 48 h.'),
      rates: [
        { id: 'TAR-001', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'USD', cost: 268, price: 345, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' },
        { id: 'TAR-002', type: 'Venta', segment: 'Niño', channel: 'Directo', currency: 'USD', cost: 190, price: 245, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' },
        { id: 'TAR-003', type: 'B2B', segment: 'Adulto', channel: 'B2B', currency: 'USD', cost: 268, price: 312, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' },
        { id: 'TAR-004', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'USD', cost: 285, price: 395, validFrom: '2026-06-01', validTo: '2026-08-31', season: 'TMP-01', status: 'vencida' },
        { id: 'TAR-005', type: 'Corporativa', segment: 'Adulto', channel: 'Corporativo', currency: 'USD', cost: 268, price: 329, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }
      ],
      availabilityModel: 'POR_SALIDA',
      departures: [
        { id: 'SAL-0101', date: '2026-09-30', time: '04:10', capacity: 16, sold: 14, status: 'abierta', guideId: 'G02', vehicleId: 'V01', meeting: 'Hotel (recojo)', ret: 'Hotel Cusco' },
        { id: 'SAL-0102', date: '2026-10-01', time: '04:10', capacity: 16, sold: 16, status: 'completa', guideId: 'G01', vehicleId: 'V02', meeting: 'Hotel (recojo)', ret: 'Hotel Cusco' },
        { id: 'SAL-0103', date: '2026-10-02', time: '04:10', capacity: 16, sold: 9, status: 'abierta', guideId: 'G03', vehicleId: 'V01', meeting: 'Hotel (recojo)', ret: 'Hotel Cusco' },
        { id: 'SAL-0104', date: '2026-10-03', time: '04:10', capacity: 16, sold: 4, status: 'abierta', guideId: null, vehicleId: null, meeting: 'Hotel (recojo)', ret: 'Hotel Cusco' },
        { id: 'SAL-0105', date: '2026-10-05', time: '04:10', capacity: 16, sold: 0, status: 'abierta', guideId: null, vehicleId: null, meeting: 'Hotel (recojo)', ret: 'Hotel Cusco' }
      ],
      related: [{ productId: 'PRD-005', relation: 'Complementario' }, { productId: 'PRD-003', relation: 'Upgrade' }, { productId: 'PRD-007', relation: 'Cross-sell' }],
      channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: true, ecommerce: true, mobile: true },
      versions: [
        { v: '1.0', date: '2026-01-05', user: 'U01', reason: 'Creación del producto', status: 'histórica' },
        { v: '1.1', date: '2026-04-12', user: 'U02', reason: 'Cambio de horario de tren y circuito', status: 'histórica' },
        { v: '2.0', date: '2026-08-20', user: 'U02', reason: 'Nuevos circuitos del Ministerio de Cultura', status: 'vigente' }
      ],
      promotions: [{ id: 'PROMO-01', name: 'Primavera Andina', kind: 'Descuento %', value: 8, from: '2026-09-15', to: '2026-10-31', channel: 'E-commerce', code: 'PRIMAVERA8', status: 'activa' }],
      b2b: [{ agencyId: 'AGB-01', priceList: 'Mayorista 2026', price: 312, commissionPct: 10, credit: true }],
      seo: { title: 'Machu Picchu Full Day desde Cusco | Tren + guía', description: 'Excursión de un día a Machu Picchu con tren Expedition, bus, entrada y guía oficial.', slug: 'machu-picchu-full-day' },
      faqs: [{ q: '¿Puedo ingresar con mochila grande?', a: 'Solo se permite mochila de hasta 20 L.' }, { q: '¿Se necesita pasaporte?', a: 'Sí, la entrada es nominativa.' }],
      hue: 172
    },
    {
      id: 'PRD-002', code: 'CUS-PKG-5D4N', sku: 'AH-PKG-5D4N', name: 'Cusco Mágico 5D/4N', internalName: 'Paquete Cusco clásico 4* con MAPI', type: 'PAQUETE', category: 'Cultural', subcategory: 'Arqueología', destId: 'D03', secondary: ['D04', 'D05', 'D06'], status: 'ACTIVE', short: 'Paquete clásico: City Tour, Valle Sagrado y Machu Picchu con hotel 4 estrellas.', long: 'Programa de 5 días y 4 noches que combina lo esencial de Cusco: city tour con templos incas, día completo en el Valle Sagrado con almuerzo buffet, y excursión a Machu Picchu. Incluye alojamiento en hotel 4* con desayuno y todos los traslados.', durationValue: 5, durationUnit: 'días', modality: 'Compartido', mainProviderId: 'PRV-001', minPax: 2, maxPax: 20, minAge: 0, maxAge: 80, advMin: 10, advMax: 365, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: true }, markupPct: 25,
      components: [
        { serviceId: 'SRV-001', qty: 2, unit: 'servicio', order: 1, required: true, included: true, notes: 'Llegada y salida' },
        { serviceId: 'SRV-008', qty: 4, unit: 'habitación', order: 2, required: true, included: true, notes: '4 noches, base doble' },
        { serviceId: 'SRV-011', qty: 1, unit: 'pax', order: 3, required: true, included: true, notes: 'City tour + Valle' },
        { serviceId: 'SRV-006', qty: 3, unit: 'servicio', order: 4, required: true, included: true, notes: '' },
        { serviceId: 'SRV-007', qty: 1, unit: 'pax', order: 5, required: false, included: true, notes: 'Valle Sagrado' },
        { serviceId: 'SRV-003', qty: 1, unit: 'pax', order: 6, required: true, included: true, notes: '' },
        { serviceId: 'SRV-004', qty: 1, unit: 'pax', order: 7, required: true, included: true, notes: '' },
        { serviceId: 'SRV-005', qty: 1, unit: 'pax', order: 8, required: true, included: true, notes: '' },
        { serviceId: 'SRV-015', qty: 5, unit: 'pax', order: 9, required: false, included: true, notes: '5 días' }
      ],
      itinerary: [
        { day: 1, title: 'Llegada y City Tour', items: [{ time: '10:00', activity: 'Recepción en aeropuerto y traslado', type: 'Traslado', location: 'Aeropuerto Velasco Astete' }, { time: '11:00', activity: 'Check-in y mate de coca', type: 'Hotel', location: 'Hotel Tambo Real' }, { time: '13:30', activity: 'City Tour: Qoricancha, Sacsayhuamán, Q’enqo, Tambomachay', type: 'Guía', location: 'Cusco' }] },
        { day: 2, title: 'Valle Sagrado de los Incas', items: [{ time: '07:30', activity: 'Pisac: mercado y parque arqueológico', type: 'Guía', location: 'Pisac' }, { time: '13:00', activity: 'Almuerzo buffet en Urubamba', type: 'Alimentación', location: 'Tika Wasi' }, { time: '15:00', activity: 'Ollantaytambo y Chinchero', type: 'Guía', location: 'Valle Sagrado' }] },
        { day: 3, title: 'Machu Picchu', items: [{ time: '04:10', activity: 'Recojo y tren a Aguas Calientes', type: 'Tren', location: 'Ollantaytambo' }, { time: '08:00', activity: 'Visita guiada a la ciudadela', type: 'Guía', location: 'Machu Picchu' }, { time: '19:30', activity: 'Retorno a Cusco', type: 'Transporte', location: 'Cusco' }] },
        { day: 4, title: 'Día libre', items: [{ time: '—', activity: 'Día libre. Opcional: Montaña de Colores o Laguna Humantay', type: 'Libre', location: 'Cusco' }] },
        { day: 5, title: 'Salida', items: [{ time: '10:00', activity: 'Check-out y traslado al aeropuerto', type: 'Traslado', location: 'Aeropuerto' }] }
      ],
      inclusions: ['4 noches en hotel 4* con desayuno', 'Traslados aeropuerto', 'City Tour y Valle Sagrado con guía', 'Almuerzo buffet en Valle', 'Excursión a Machu Picchu completa', 'Boleto turístico', 'Seguro de asistencia'],
      exclusions: ['Vuelos', 'Almuerzos y cenas no indicados', 'Propinas', 'Excursiones opcionales'],
      requirements: ['Pasaporte vigente', 'Recomendado aclimatarse el día 1'],
      policies: pol(),
      rates: [
        { id: 'TAR-011', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'USD', cost: 780, price: 975, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' },
        { id: 'TAR-012', type: 'Venta', segment: 'Niño', channel: 'Directo', currency: 'USD', cost: 560, price: 720, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' },
        { id: 'TAR-013', type: 'B2B', segment: 'Adulto', channel: 'B2B', currency: 'USD', cost: 780, price: 890, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' },
        { id: 'TAR-014', type: 'Grupal', segment: 'Grupo', channel: 'Directo', currency: 'USD', cost: 740, price: 915, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }
      ],
      availabilityModel: 'POR_HABITACION', departures: [],
      related: [{ productId: 'PRD-004', relation: 'Complementario' }, { productId: 'PRD-006', relation: 'Alternativo' }],
      channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: true, ecommerce: true, mobile: true },
      versions: [{ v: '1.0', date: '2026-01-10', user: 'U01', reason: 'Creación', status: 'histórica' }, { v: '1.1', date: '2026-07-01', user: 'U02', reason: 'Cambio de hotel base a Tambo Real', status: 'vigente' }],
      promotions: [], b2b: [{ agencyId: 'AGB-01', priceList: 'Mayorista 2026', price: 890, commissionPct: 10, credit: true }, { agencyId: 'AGB-02', priceList: 'Minorista 2026', price: 925, commissionPct: 8, credit: false }],
      config: [{ group: 'Hotel', options: [{ label: '3 estrellas', delta: -140 }, { label: '4 estrellas', delta: 0 }, { label: '5 estrellas', delta: 420 }] }, { group: 'Transporte', options: [{ label: 'Compartido', delta: 0 }, { label: 'Privado', delta: 180 }, { label: 'Premium', delta: 320 }] }, { group: 'Habitación', options: [{ label: 'Doble', delta: 0 }, { label: 'Simple', delta: 210 }, { label: 'Triple', delta: -60 }] }],
      seo: { title: 'Paquete Cusco 5 días 4 noches con Machu Picchu', description: 'Cusco, Valle Sagrado y Machu Picchu con hotel 4*.', slug: 'cusco-magico-5d4n' }, faqs: [], hue: 192
    },
    {
      id: 'PRD-003', code: 'CUS-MAPI-2D', sku: 'AH-MAPI-2D1N', name: 'Machu Picchu 2D/1N con noche en Aguas Calientes', internalName: 'MAPI 2D/1N', type: 'EXCURSIÓN', category: 'Cultural', subcategory: 'Arqueología', destId: 'D06', secondary: ['D05'], status: 'ACTIVE', short: 'Dos días para visitar Machu Picchu sin prisas, con noche en Aguas Calientes.', long: 'Programa de dos días con noche en Aguas Calientes para ingresar temprano a la ciudadela.', durationValue: 2, durationUnit: 'días', modality: 'Compartido', mainProviderId: 'PRV-005', minPax: 1, maxPax: 12, minAge: 0, maxAge: 85, advMin: 5, advMax: 365, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: false, featured: false }, markupPct: 26,
      components: [{ serviceId: 'SRV-003', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: '' }, { serviceId: 'SRV-004', qty: 1, unit: 'pax', order: 2, required: true, included: true, notes: '' }, { serviceId: 'SRV-005', qty: 1, unit: 'pax', order: 3, required: true, included: true, notes: '' }, { serviceId: 'SRV-006', qty: 1, unit: 'servicio', order: 4, required: true, included: true, notes: '' }],
      itinerary: [{ day: 1, title: 'Cusco — Aguas Calientes', items: [{ time: '12:00', activity: 'Tren a Aguas Calientes', type: 'Tren', location: 'Ollantaytambo' }] }, { day: 2, title: 'Machu Picchu — Cusco', items: [{ time: '06:00', activity: 'Visita guiada', type: 'Guía', location: 'Machu Picchu' }] }],
      inclusions: ['Tren ida y vuelta', 'Hotel 3* en Aguas Calientes', 'Entrada', 'Guía', 'Bus'], exclusions: ['Alimentación no indicada', 'Propinas'], requirements: ['Pasaporte'], policies: pol(),
      rates: [{ id: 'TAR-021', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'USD', cost: 360, price: 455, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }],
      availabilityModel: 'CUPOS', departures: [], related: [], channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: false, ecommerce: false, mobile: true },
      versions: [{ v: '1.0', date: '2026-02-01', user: 'U02', reason: 'Creación', status: 'vigente' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: 'machu-picchu-2d1n' }, faqs: [], hue: 160
    },
    {
      id: 'PRD-004', code: 'CUS-HUM-FD', sku: 'AH-HUM-001', name: 'Laguna Humantay Full Day', internalName: 'Humantay compartido', type: 'TOUR', category: 'Aventura', subcategory: 'Trekking', destId: 'D07', secondary: ['D04'], status: 'ACTIVE', short: 'Caminata a la laguna turquesa al pie del nevado Salkantay.', long: 'Salida de madrugada hacia Mollepata y Soraypampa. Caminata de 1 h 30 min hasta la laguna Humantay (4 200 m s. n. m.).', durationValue: 14, durationUnit: 'horas', modality: 'Compartido', mainProviderId: 'PRV-004', minPax: 2, maxPax: 20, minAge: 8, maxAge: 70, advMin: 1, advMax: 180, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: true }, markupPct: 45,
      components: [{ serviceId: 'SRV-012', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: 'Salida 04:30' }, { serviceId: 'SRV-013', qty: 1, unit: 'pax', order: 2, required: true, included: true, notes: '' }, { serviceId: 'SRV-006', qty: 1, unit: 'servicio', order: 3, required: true, included: true, notes: '' }],
      itinerary: [{ day: 1, title: 'Cusco — Humantay — Cusco', items: [{ time: '04:30', activity: 'Recojo en Plaza Regocijo', type: 'Transporte', location: 'Cusco' }, { time: '07:00', activity: 'Desayuno en Mollepata', type: 'Alimentación', location: 'Mollepata' }, { time: '09:00', activity: 'Inicio de caminata desde Soraypampa', type: 'Guía', location: 'Soraypampa' }, { time: '13:30', activity: 'Almuerzo campestre', type: 'Alimentación', location: 'Mollepata' }, { time: '18:30', activity: 'Retorno a Cusco', type: 'Transporte', location: 'Cusco' }] }],
      inclusions: ['Transporte turístico', 'Desayuno y almuerzo', 'Guía', 'Botiquín y oxígeno'], exclusions: ['Ingreso a la comunidad (S/ 20)', 'Caballo', 'Propinas'], requirements: ['Edad mínima 8 años', 'Condición física: moderada a exigente', 'Ropa de abrigo, bastones opcionales'], policies: pol('Sin penalidad hasta 48 h antes. No-show 100%.'),
      rates: [{ id: 'TAR-031', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'PEN', cost: 95, price: 140, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }, { id: 'TAR-032', type: 'B2B', segment: 'Adulto', channel: 'B2B', currency: 'PEN', cost: 95, price: 120, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }, { id: 'TAR-033', type: 'Promocional', segment: 'Adulto', channel: 'E-commerce', currency: 'PEN', cost: 95, price: 129, validFrom: '2026-09-15', validTo: '2026-10-31', season: 'TMP-02', status: 'vigente' }],
      availabilityModel: 'POR_SALIDA',
      departures: [
        { id: 'SAL-0401', date: '2026-09-30', time: '04:30', capacity: 20, sold: 12, status: 'abierta', guideId: 'G01', vehicleId: 'V03', meeting: 'Plaza Regocijo', ret: 'Plaza Regocijo' },
        { id: 'SAL-0402', date: '2026-10-01', time: '04:30', capacity: 20, sold: 20, status: 'completa', guideId: 'G03', vehicleId: 'V03', meeting: 'Plaza Regocijo', ret: 'Plaza Regocijo' },
        { id: 'SAL-0403', date: '2026-10-02', time: '04:30', capacity: 20, sold: 7, status: 'abierta', guideId: null, vehicleId: 'V02', meeting: 'Plaza Regocijo', ret: 'Plaza Regocijo' },
        { id: 'SAL-0404', date: '2026-10-04', time: '04:30', capacity: 20, sold: 2, status: 'abierta', guideId: null, vehicleId: null, meeting: 'Plaza Regocijo', ret: 'Plaza Regocijo' }
      ],
      related: [{ productId: 'PRD-008', relation: 'Alternativo' }], channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: true, ecommerce: true, mobile: true },
      versions: [{ v: '1.0', date: '2026-01-12', user: 'U05', reason: 'Creación', status: 'vigente' }], promotions: [{ id: 'PROMO-02', name: 'Grupo 4+', kind: 'Descuento por cantidad', value: 10, from: '2026-01-01', to: '2026-12-31', channel: 'Todos', code: '', status: 'activa' }], b2b: [{ agencyId: 'AGB-01', priceList: 'Mayorista 2026', price: 120, commissionPct: 12, credit: true }], seo: { title: 'Laguna Humantay Full Day', description: '', slug: 'laguna-humantay' }, faqs: [], hue: 186
    },
    { id: 'PRD-005', code: 'CUS-TRF-APT', sku: 'AH-TRF-001', name: 'Traslado aeropuerto Cusco (privado)', internalName: 'TRF APT CUS', type: 'TRASLADO', category: 'Logística', subcategory: 'Traslados', destId: 'D04', secondary: [], status: 'ACTIVE', short: 'Traslado privado entre el aeropuerto y hoteles del centro de Cusco.', long: '', durationValue: 1, durationUnit: 'horas', modality: 'Privado', mainProviderId: 'PRV-004', minPax: 1, maxPax: 9, minAge: 0, maxAge: 99, advMin: 1, advMax: 365, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: false }, markupPct: 50,
      components: [{ serviceId: 'SRV-001', qty: 1, unit: 'servicio', order: 1, required: true, included: true, notes: '' }], itinerary: [], inclusions: ['Vehículo privado', 'Conductor', 'Cartel de recepción'], exclusions: ['Propinas'], requirements: ['Enviar número de vuelo'], policies: pol('Sin penalidad hasta 24 h antes.'),
      rates: [{ id: 'TAR-041', type: 'Venta', segment: 'Pasajero', channel: 'Directo', currency: 'PEN', cost: 60, price: 90, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }],
      availabilityModel: 'POR_TRANSPORTE', departures: [], related: [], channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: false, ecommerce: true, mobile: true }, versions: [{ v: '1.0', date: '2026-01-05', user: 'U01', reason: 'Creación', status: 'vigente' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: 'traslado-aeropuerto-cusco' }, faqs: [], hue: 205 },
    { id: 'PRD-006', code: 'SUR-CIR-8D', sku: 'AH-CIR-SUR8', name: 'Circuito Sur Andino 8D/7N', internalName: 'Arequipa-Colca-Puno-Cusco', type: 'CIRCUITO', category: 'Naturaleza', subcategory: 'Paisajes', destId: 'D02', secondary: ['D11', 'D12', 'D09', 'D10', 'D03'], status: 'REVIEW', short: 'Arequipa, Colca, Puno y Cusco en un solo circuito terrestre.', long: 'Circuito terrestre por los principales destinos del sur andino.', durationValue: 8, durationUnit: 'días', modality: 'Grupal', mainProviderId: 'PRV-012', minPax: 4, maxPax: 24, minAge: 5, maxAge: 75, advMin: 20, advMax: 365, flags: { bookable: false, quoteable: true, b2b: false, ecommerce: false, featured: false }, markupPct: 24,
      components: [{ serviceId: 'SRV-016', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: '' }, { serviceId: 'SRV-017', qty: 1, unit: 'habitación', order: 2, required: true, included: true, notes: 'Proveedor con contrato vencido' }, { serviceId: 'SRV-008', qty: 3, unit: 'habitación', order: 3, required: true, included: true, notes: '' }],
      itinerary: [{ day: 1, title: 'Arequipa', items: [] }, { day: 2, title: 'Colca', items: [] }, { day: 3, title: 'Colca — Puno', items: [] }], inclusions: ['Transporte terrestre', 'Hoteles 3*/4*'], exclusions: ['Vuelos'], requirements: [], policies: pol(),
      rates: [], availabilityModel: 'POR_SALIDA', departures: [], related: [], channels: { erp: true, crm: true, quotes: true, b2b: false, portal: false, cms: false, ecommerce: false, mobile: false }, versions: [{ v: '0.9', date: '2026-09-20', user: 'U04', reason: 'Borrador inicial', status: 'en revisión' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: '' }, faqs: [], hue: 32 },
    { id: 'PRD-007', code: 'CUS-GAS-EXP', sku: 'AH-GAS-001', name: 'Clase de cocina andina y mercado San Pedro', internalName: 'Cooking class', type: 'EXPERIENCIA', category: 'Gastronomía', subcategory: 'Experiencias gastronómicas', destId: 'D04', secondary: [], status: 'ACTIVE', short: 'Recorrido por el mercado y clase práctica de cocina con chef local.', long: '', durationValue: 4, durationUnit: 'horas', modality: 'Compartido', mainProviderId: 'PRV-007', minPax: 2, maxPax: 12, minAge: 6, maxAge: 90, advMin: 1, advMax: 120, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: false }, markupPct: 40,
      components: [{ serviceId: 'SRV-007', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: '' }], itinerary: [], inclusions: ['Chef instructor', 'Insumos', 'Pisco sour'], exclusions: ['Transporte'], requirements: ['Informar alergias alimentarias'], policies: pol(),
      rates: [{ id: 'TAR-061', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'PEN', cost: 110, price: 185, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }],
      availabilityModel: 'CAPACIDAD', departures: [], related: [], channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: true, ecommerce: true, mobile: true }, versions: [{ v: '1.0', date: '2026-03-01', user: 'U03', reason: 'Creación', status: 'vigente' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: 'clase-cocina-andina' }, faqs: [], hue: 20 },
    { id: 'PRD-008', code: 'CUS-VIN-FD', sku: 'AH-VIN-001', name: 'Montaña de Colores (Vinicunca) Full Day', internalName: 'Vinicunca', type: 'TOUR', category: 'Aventura', subcategory: 'Trekking', destId: 'D08', secondary: [], status: 'SUSPENDED', short: 'Caminata a la montaña de siete colores.', long: 'Suspendido temporalmente por conflicto de acceso comunal.', durationValue: 14, durationUnit: 'horas', modality: 'Compartido', mainProviderId: 'PRV-004', minPax: 2, maxPax: 20, minAge: 10, maxAge: 65, advMin: 1, advMax: 180, flags: { bookable: false, quoteable: false, b2b: false, ecommerce: false, featured: false }, markupPct: 45,
      components: [{ serviceId: 'SRV-012', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: '' }], itinerary: [], inclusions: ['Transporte', 'Desayuno', 'Guía'], exclusions: ['Ingreso comunal'], requirements: ['Condición física exigente'], policies: pol(),
      rates: [{ id: 'TAR-071', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'PEN', cost: 90, price: 130, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }], availabilityModel: 'POR_SALIDA', departures: [], related: [], channels: { erp: true, crm: false, quotes: false, b2b: false, portal: false, cms: false, ecommerce: false, mobile: false }, versions: [{ v: '1.0', date: '2026-01-12', user: 'U05', reason: 'Creación', status: 'vigente' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: 'montana-de-colores' }, faqs: [], hue: 330 },
    { id: 'PRD-009', code: 'ICA-PAR-FD', sku: 'AH-PAR-001', name: 'Paracas e Islas Ballestas desde Lima', internalName: 'Paracas FD', type: 'EXCURSIÓN', category: 'Naturaleza', subcategory: 'Fauna', destId: 'D16', secondary: ['D17'], status: 'ACTIVE', short: 'Lobos marinos, pingüinos de Humboldt y reserva de Paracas en un día.', long: '', durationValue: 14, durationUnit: 'horas', modality: 'Compartido', mainProviderId: 'PRV-010', minPax: 2, maxPax: 40, minAge: 0, maxAge: 90, advMin: 2, advMax: 180, flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: false }, markupPct: 38,
      components: [{ serviceId: 'SRV-014', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: '' }], itinerary: [], inclusions: ['Bus turístico', 'Lancha', 'Guía'], exclusions: ['Impuesto de embarque', 'Almuerzo'], requirements: [], policies: pol(),
      rates: [{ id: 'TAR-081', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'PEN', cost: 150, price: 229, validFrom: '2026-01-01', validTo: '2026-12-31', season: 'TMP-02', status: 'vigente' }], availabilityModel: 'CUPOS', departures: [], related: [], channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: true, ecommerce: true, mobile: true }, versions: [{ v: '1.0', date: '2026-02-15', user: 'U04', reason: 'Creación', status: 'vigente' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: 'paracas-islas-ballestas' }, faqs: [], hue: 200 },
    { id: 'PRD-010', code: 'LOR-AMZ-4D', sku: 'AH-AMZ-4D3N', name: 'Amazonía Iquitos Lodge 4D/3N', internalName: 'Iquitos Lodge', type: 'PAQUETE', category: 'Naturaleza', subcategory: 'Ecoturismo', destId: 'D19', secondary: [], status: 'DRAFT', short: 'Programa de selva con lodge y excursiones fluviales.', long: '', durationValue: 4, durationUnit: 'días', modality: 'Compartido', mainProviderId: 'PRV-013', minPax: 2, maxPax: 16, minAge: 4, maxAge: 80, advMin: 7, advMax: 365, flags: { bookable: false, quoteable: false, b2b: false, ecommerce: false, featured: false }, markupPct: 30,
      components: [], itinerary: [], inclusions: [], exclusions: [], requirements: ['Vacuna contra fiebre amarilla recomendada'], policies: pol(), rates: [], availabilityModel: 'SIN_CONTROL', departures: [], related: [], channels: { erp: true, crm: false, quotes: false, b2b: false, portal: false, cms: false, ecommerce: false, mobile: false }, versions: [{ v: '0.1', date: '2026-09-25', user: 'U03', reason: 'Borrador', status: 'borrador' }], promotions: [], b2b: [], seo: { title: '', description: '', slug: '' }, faqs: [], hue: 120 }
  ];

  /* ---------------- CRM ---------------- */
  D.clients = [
    { id: 'CLI-0001', kind: 'Persona', name: 'Gabriela Ríos Montoya', doc: 'DNI 45781236', email: 'gabriela.rios@correo.pe', phone: '999 102 334', country: 'Perú', city: 'Lima', segment: 'Retail', owner: 'U04', createdAt: '2025-12-10', tags: ['Familia', 'Recurrente'], nps: 9, birth: '1988-04-12' },
    { id: 'CLI-0002', kind: 'Empresa', name: 'Minera Cordillera Blanca S.A.', doc: 'RUC 20100088771', email: 'viajes@mcblanca.com.pe', phone: '01 705 3300', country: 'Perú', city: 'Lima', segment: 'Corporativo', owner: 'U02', createdAt: '2026-01-20', tags: ['Incentivos', 'Crédito 30d'], nps: 8, contactName: 'Úrsula Benavides (RR. HH.)' },
    { id: 'CLI-0003', kind: 'Persona', name: 'Thomas Keller', doc: 'Pasaporte C4F82991', email: 't.keller@mail.de', phone: '+49 171 5550102', country: 'Alemania', city: 'Múnich', segment: 'Retail', owner: 'U03', createdAt: '2026-06-02', tags: ['Extranjero', 'Aventura'], nps: 10 },
    { id: 'CLI-0004', kind: 'Empresa', name: 'Colegio San Agustín de Arequipa', doc: 'RUC 20455001122', email: 'promocion@csaa.edu.pe', phone: '054 22 1180', country: 'Perú', city: 'Arequipa', segment: 'Grupos', owner: 'U03', createdAt: '2026-05-14', tags: ['Viaje de promoción'], nps: null, contactName: 'Prof. Álvaro Núñez' },
    { id: 'CLI-0005', kind: 'Persona', name: 'Familia Castañeda Ugarte', doc: 'DNI 41220988', email: 'jcastaneda@correo.pe', phone: '987 450 221', country: 'Perú', city: 'Trujillo', segment: 'VIP', owner: 'U04', createdAt: '2025-11-28', tags: ['VIP', 'Hotel 5*'], nps: 9 },
    { id: 'CLI-0006', kind: 'Persona', name: 'Sophie Martin', doc: 'Pasaporte 19FR22871', email: 'sophie.martin@mail.fr', phone: '+33 6 12 34 56 78', country: 'Francia', city: 'Lyon', segment: 'Retail', owner: 'U03', createdAt: '2026-08-19', tags: ['Extranjero'], nps: null },
    { id: 'CLI-0007', kind: 'Empresa', name: 'Wayra Viajes S.A.C. (agencia B2B)', doc: 'RUC 20600991230', email: 'reservas@wayraviajes.pe', phone: '01 445 9012', country: 'Perú', city: 'Lima', segment: 'B2B', owner: 'U02', createdAt: '2026-02-01', tags: ['Mayorista'], nps: 8, contactName: 'Pamela Ortiz' },
    { id: 'CLI-0008', kind: 'Persona', name: 'Ricardo Benites Alarcón', doc: 'DNI 70112045', email: 'rbenites@correo.pe', phone: '945 201 889', country: 'Perú', city: 'Lima', segment: 'Retail', owner: 'U04', createdAt: '2026-09-02', tags: ['Luna de miel'], nps: null },
    { id: 'CLI-0009', kind: 'Empresa', name: 'Laboratorios Andinos S.A.', doc: 'RUC 20511220034', email: 'eventos@labandinos.pe', phone: '01 611 7000', country: 'Perú', city: 'Lima', segment: 'Corporativo', owner: 'U02', createdAt: '2026-07-11', tags: ['Convención'], nps: null, contactName: 'Daniela Soto (Marketing)' },
    { id: 'CLI-0010', kind: 'Persona', name: 'Emily Johnson', doc: 'Passport 58812290', email: 'emily.j@mail.com', phone: '+1 415 555 0192', country: 'Estados Unidos', city: 'San Francisco', segment: 'Retail', owner: 'U03', createdAt: '2026-09-18', tags: ['Extranjero', 'Web'], nps: null }
  ];
  D.leads = [
    { id: 'LEAD-0231', name: 'Andrea Villalobos', email: 'andrea.v@correo.pe', phone: '987 663 021', company: '', source: 'Formulario web', interest: 'Paquete', destination: 'Cusco', travelDate: '2026-11-14', pax: 4, channel: 'Web', status: 'nuevo', owner: 'U04', score: 62, createdAt: '2026-09-29 07:44', notes: 'Viaje familiar, 2 adultos y 2 niños (8 y 11 años).' },
    { id: 'LEAD-0230', name: 'Marco Antonio Delgado', email: 'madelgado@empresa.pe', phone: '945 772 108', company: 'Tecnoservicios del Sur', source: 'WhatsApp', interest: 'Viaje corporativo', destination: 'Arequipa', travelDate: '2026-10-22', pax: 18, channel: 'WhatsApp', status: 'contactado', owner: 'U03', score: 78, createdAt: '2026-09-28 16:20', notes: 'Viaje de incentivo para equipo comercial.' },
    { id: 'LEAD-0229', name: 'Laura Bianchi', email: 'l.bianchi@mail.it', phone: '+39 347 555 0183', company: '', source: 'Facebook Ads', interest: 'Excursión', destination: 'Machu Picchu', travelDate: '2026-10-09', pax: 2, channel: 'Facebook', status: 'calificado', owner: 'U03', score: 85, createdAt: '2026-09-28 10:02', notes: 'Pareja, desea tren Vistadome.' },
    { id: 'LEAD-0228', name: 'Gabriela Ríos Montoya', email: 'gabriela.rios@correo.pe', phone: '999 102 334', company: '', source: 'Referido', interest: 'Paquete', destination: 'Cusco', travelDate: '2026-12-26', pax: 5, channel: 'Teléfono', status: 'duplicado', owner: 'U04', score: 40, createdAt: '2026-09-27 12:15', notes: 'Coincide con cliente CLI-0001.' },
    { id: 'LEAD-0227', name: 'Jorge Palacios', email: 'jpalacios@correo.pe', phone: '976 110 332', company: '', source: 'Feria Turismo', interest: 'Tour', destination: 'Paracas', travelDate: '2026-10-18', pax: 3, channel: 'Presencial', status: 'contactado', owner: 'U04', score: 55, createdAt: '2026-09-26 19:40', notes: '' },
    { id: 'LEAD-0226', name: 'Hotel Boutique Mirador (convenio)', email: 'ventas@miradorbq.pe', phone: '01 422 1100', company: 'Mirador Boutique', source: 'B2B', interest: 'Alianza', destination: 'Varios', travelDate: '', pax: 0, channel: 'Email', status: 'descartado', owner: 'U02', score: 20, createdAt: '2026-09-25 09:00', notes: 'No aplica: es proveedor, derivado a compras.' },
    { id: 'LEAD-0225', name: 'Emily Johnson', email: 'emily.j@mail.com', phone: '+1 415 555 0192', company: '', source: 'Formulario web', interest: 'Paquete', destination: 'Cusco', travelDate: '2026-10-20', pax: 2, channel: 'Web', status: 'convertido', owner: 'U03', score: 90, createdAt: '2026-09-18 22:10', notes: 'Convertido a CLI-0010 + OPP-0118.' },
    { id: 'LEAD-0224', name: 'Colegio Santa Rosa de Lima', email: 'direccion@csrl.edu.pe', phone: '01 480 2211', company: 'Colegio Santa Rosa', source: 'Llamada entrante', interest: 'Viaje de promoción', destination: 'Cusco', travelDate: '2026-11-25', pax: 42, channel: 'Teléfono', status: 'calificado', owner: 'U03', score: 74, createdAt: '2026-09-24 11:30', notes: '42 alumnos + 4 docentes.' },
    { id: 'LEAD-0223', name: 'Pedro Ñahui', email: 'pnahui@correo.pe', phone: '951 330 227', company: '', source: 'Instagram', interest: 'Tour', destination: 'Humantay', travelDate: '2026-10-03', pax: 2, channel: 'Instagram', status: 'nuevo', owner: 'U04', score: 48, createdAt: '2026-09-29 06:12', notes: '' }
  ];
  D.opportunities = [
    { id: 'OPP-0121', clientId: 'CLI-0009', title: 'Convención anual Laboratorios Andinos — Cusco', stage: 'negociacion', amount: 148500, currency: 'PEN', probability: 70, closeDate: '2026-10-10', owner: 'U02', destination: 'Cusco', pax: 60, leadId: null, createdAt: '2026-07-11', lostReason: '' },
    { id: 'OPP-0120', clientId: 'CLI-0004', title: 'Viaje de promoción 5° secundaria', stage: 'cotizacion', amount: 96800, currency: 'PEN', probability: 55, closeDate: '2026-10-15', owner: 'U03', destination: 'Cusco', pax: 44, leadId: null, createdAt: '2026-05-14', lostReason: '' },
    { id: 'OPP-0119', clientId: 'CLI-0002', title: 'Incentivo mineros destacados Q4', stage: 'ganada', amount: 62300, currency: 'PEN', probability: 100, closeDate: '2026-09-05', owner: 'U02', destination: 'Cusco', pax: 12, leadId: null, createdAt: '2026-08-01', lostReason: '' },
    { id: 'OPP-0118', clientId: 'CLI-0010', title: 'Emily Johnson — Cusco & Machu Picchu', stage: 'cotizacion', amount: 1950, currency: 'USD', probability: 60, closeDate: '2026-10-02', owner: 'U03', destination: 'Cusco', pax: 2, leadId: 'LEAD-0225', createdAt: '2026-09-19', lostReason: '' },
    { id: 'OPP-0117', clientId: 'CLI-0008', title: 'Luna de miel Benites — Cusco + Paracas', stage: 'descubrimiento', amount: 9800, currency: 'PEN', probability: 35, closeDate: '2026-10-20', owner: 'U04', destination: 'Cusco / Paracas', pax: 2, leadId: null, createdAt: '2026-09-02', lostReason: '' },
    { id: 'OPP-0116', clientId: 'CLI-0005', title: 'Año Nuevo en Cusco — Familia Castañeda', stage: 'negociacion', amount: 32400, currency: 'PEN', probability: 65, closeDate: '2026-10-05', owner: 'U04', destination: 'Cusco', pax: 6, leadId: null, createdAt: '2026-08-25', lostReason: '' },
    { id: 'OPP-0115', clientId: 'CLI-0006', title: 'Sophie Martin — Humantay + MAPI', stage: 'ganada', amount: 1180, currency: 'USD', probability: 100, closeDate: '2026-09-10', owner: 'U03', destination: 'Cusco', pax: 1, leadId: null, createdAt: '2026-08-19', lostReason: '' },
    { id: 'OPP-0114', clientId: 'CLI-0003', title: 'Keller — Cusco aventura 6D', stage: 'ganada', amount: 2860, currency: 'USD', probability: 100, closeDate: '2026-08-28', owner: 'U03', destination: 'Cusco', pax: 2, leadId: null, createdAt: '2026-06-02', lostReason: '' },
    { id: 'OPP-0113', clientId: 'CLI-0001', title: 'Fiestas Patrias Arequipa — Ríos', stage: 'perdida', amount: 7400, currency: 'PEN', probability: 0, closeDate: '2026-07-10', owner: 'U04', destination: 'Arequipa', pax: 4, leadId: null, createdAt: '2026-06-15', lostReason: 'Precio: eligió paquete de aerolínea' },
    { id: 'OPP-0112', clientId: 'CLI-0007', title: 'Cupo mayorista Wayra — octubre', stage: 'calificacion', amount: 45000, currency: 'PEN', probability: 25, closeDate: '2026-10-30', owner: 'U02', destination: 'Varios', pax: 80, leadId: null, createdAt: '2026-09-20', lostReason: '' }
  ];
  D.stages = [
    { id: 'calificacion', name: 'Calificación', prob: 20 },
    { id: 'descubrimiento', name: 'Descubrimiento', prob: 35 },
    { id: 'cotizacion', name: 'Cotización', prob: 55 },
    { id: 'negociacion', name: 'Negociación', prob: 70 },
    { id: 'ganada', name: 'Ganada', prob: 100 },
    { id: 'perdida', name: 'Perdida', prob: 0 }
  ];
  D.activities = [
    { id: 'ACT-0512', type: 'Llamada', subject: 'Primer contacto — viaje familiar Cusco', relType: 'lead', relId: 'LEAD-0231', owner: 'U04', due: '2026-09-29 11:00', status: 'pendiente', result: '' },
    { id: 'ACT-0511', type: 'Reunión', subject: 'Presentar propuesta v3 a comité de Laboratorios Andinos', relType: 'opportunity', relId: 'OPP-0121', owner: 'U02', due: '2026-09-30 15:00', status: 'pendiente', result: '' },
    { id: 'ACT-0510', type: 'WhatsApp', subject: 'Enviar opciones de hotel 5* a familia Castañeda', relType: 'opportunity', relId: 'OPP-0116', owner: 'U04', due: '2026-09-29 16:00', status: 'pendiente', result: '' },
    { id: 'ACT-0509', type: 'Email', subject: 'Seguimiento cotización COT-2026-00188 (Emily Johnson)', relType: 'quote', relId: 'COT-2026-00188', owner: 'U03', due: '2026-09-28 10:00', status: 'vencida', result: '' },
    { id: 'ACT-0508', type: 'Tarea', subject: 'Confirmar cupos de tren para promoción escolar', relType: 'opportunity', relId: 'OPP-0120', owner: 'U05', due: '2026-10-01 09:00', status: 'pendiente', result: '' },
    { id: 'ACT-0507', type: 'Llamada', subject: 'Calificación Tecnoservicios del Sur', relType: 'lead', relId: 'LEAD-0230', owner: 'U03', due: '2026-09-28 17:00', status: 'completada', result: 'Presupuesto aprox. S/ 38 000. Decisor: gerente comercial.' },
    { id: 'ACT-0506', type: 'Postventa', subject: 'Encuesta de satisfacción — Sophie Martin', relType: 'client', relId: 'CLI-0006', owner: 'U03', due: '2026-09-27 12:00', status: 'completada', result: 'Muy satisfecha (NPS 9). Sugiere más tiempo en Humantay.' },
    { id: 'ACT-0505', type: 'Reunión', subject: 'Visita a colegio San Agustín — reunión con padres', relType: 'opportunity', relId: 'OPP-0120', owner: 'U03', due: '2026-10-02 18:30', status: 'pendiente', result: '' }
  ];

  /* ---------------- Cotizaciones ---------------- */
  const it = (productId, date, qty, pax, unitCost, unitPrice, segment) => ({ productId, date, qty, pax, unitCost, unitPrice, segment: segment || 'Adulto' });
  D.quotes = [
    { id: 'COT-2026-00191', clientId: 'CLI-0009', oppId: 'OPP-0121', title: 'Convención Cusco 4D/3N — 60 pax', status: 'negociacion', currentVersion: 3, validUntil: '2026-10-08', currency: 'PEN', owner: 'U02', createdAt: '2026-08-02', travelFrom: '2026-11-18', travelTo: '2026-11-21', pax: { adt: 60, chd: 0, inf: 0 }, viewedAt: '2026-09-27 19:40', token: 'q7x9-a1b2-convencion',
      versions: [
        { v: 1, date: '2026-08-02', user: 'U02', status: 'reemplazada', items: [it('PRD-002', '2026-11-18', 1, 60, 2900, 3700)], markupPct: 25, discountPct: 0, taxPct: 18, notes: 'Propuesta inicial', snapshot: 'PRD-002 v1.1' },
        { v: 2, date: '2026-08-29', user: 'U02', status: 'reemplazada', items: [it('PRD-002', '2026-11-18', 1, 60, 2900, 3550), it('PRD-007', '2026-11-20', 1, 60, 110, 170)], markupPct: 22, discountPct: 3, taxPct: 18, notes: 'Se agrega actividad gastronómica', snapshot: 'PRD-002 v1.1 / PRD-007 v1.0' },
        { v: 3, date: '2026-09-24', user: 'U02', status: 'enviada', items: [it('PRD-002', '2026-11-18', 1, 60, 2900, 3450), it('PRD-007', '2026-11-20', 1, 60, 110, 165)], markupPct: 20, discountPct: 5, taxPct: 18, notes: 'Descuento corporativo 5% aprobado por gerencia', snapshot: 'PRD-002 v1.1 / PRD-007 v1.0' }
      ] },
    { id: 'COT-2026-00190', clientId: 'CLI-0005', oppId: 'OPP-0116', title: 'Año Nuevo Cusco 5* — 6 pax', status: 'vista', currentVersion: 2, validUntil: '2026-10-05', currency: 'PEN', owner: 'U04', createdAt: '2026-08-26', travelFrom: '2026-12-29', travelTo: '2027-01-02', pax: { adt: 4, chd: 2, inf: 0 }, viewedAt: '2026-09-28 21:05', token: 'n8k2-casta',
      versions: [
        { v: 1, date: '2026-08-26', user: 'U04', status: 'reemplazada', items: [it('PRD-002', '2026-12-29', 1, 4, 2900, 3650), it('PRD-002', '2026-12-29', 1, 2, 2100, 2690, 'Niño')], markupPct: 25, discountPct: 0, taxPct: 18, notes: 'Hotel 4*', snapshot: 'PRD-002 v1.1' },
        { v: 2, date: '2026-09-22', user: 'U04', status: 'enviada', items: [it('PRD-002', '2026-12-29', 1, 4, 4450, 5480), it('PRD-002', '2026-12-29', 1, 2, 2400, 3050, 'Niño'), it('PRD-005', '2026-12-29', 2, 1, 60, 90, 'Pasajero')], markupPct: 23, discountPct: 0, taxPct: 18, notes: 'Upgrade a hotel 5* (Piedra Viva) + traslados privados. Temporada Año Nuevo (factor 1.40).', snapshot: 'PRD-002 v1.1 / PRD-005 v1.0' }
      ] },
    { id: 'COT-2026-00189', clientId: 'CLI-0004', oppId: 'OPP-0120', title: 'Promoción escolar Cusco 5D/4N — 44 pax', status: 'enviada', currentVersion: 1, validUntil: '2026-10-12', currency: 'PEN', owner: 'U03', createdAt: '2026-09-20', travelFrom: '2026-11-25', travelTo: '2026-11-29', pax: { adt: 4, chd: 40, inf: 0 }, viewedAt: null, token: 'p3m1-csaa',
      versions: [{ v: 1, date: '2026-09-20', user: 'U03', status: 'enviada', items: [it('PRD-002', '2026-11-25', 1, 44, 1780, 2200, 'Grupo')], markupPct: 23, discountPct: 0, taxPct: 18, notes: 'Tarifa grupal escolar. 4 liberados docentes.', snapshot: 'PRD-002 v1.1' }] },
    { id: 'COT-2026-00188', clientId: 'CLI-0010', oppId: 'OPP-0118', title: 'Cusco & Machu Picchu 5D — 2 pax', status: 'enviada', currentVersion: 1, validUntil: '2026-10-02', currency: 'USD', owner: 'U03', createdAt: '2026-09-19', travelFrom: '2026-10-20', travelTo: '2026-10-24', pax: { adt: 2, chd: 0, inf: 0 }, viewedAt: '2026-09-20 03:12', token: 'e5j7-emily',
      versions: [{ v: 1, date: '2026-09-19', user: 'U03', status: 'enviada', items: [it('PRD-002', '2026-10-20', 1, 2, 780, 975), it('PRD-004', '2026-10-23', 1, 2, 26, 38)], markupPct: 25, discountPct: 0, taxPct: 0, notes: 'Exportación de servicios: no gravado con IGV (pasajero no domiciliado).', snapshot: 'PRD-002 v1.1 / PRD-004 v1.0' }] },
    { id: 'COT-2026-00187', clientId: 'CLI-0002', oppId: 'OPP-0119', title: 'Incentivo mineros Q4 — 12 pax', status: 'convertida', currentVersion: 2, validUntil: '2026-09-15', currency: 'PEN', owner: 'U02', createdAt: '2026-08-03', travelFrom: '2026-10-01', travelTo: '2026-10-05', pax: { adt: 12, chd: 0, inf: 0 }, viewedAt: '2026-09-02 10:30', token: 'm2c9-minera', approvedAt: '2026-09-05 12:14', approvedBy: 'Úrsula Benavides (cliente)',
      versions: [
        { v: 1, date: '2026-08-03', user: 'U02', status: 'reemplazada', items: [it('PRD-002', '2026-10-01', 1, 12, 2900, 3700)], markupPct: 25, discountPct: 0, taxPct: 18, notes: '', snapshot: 'PRD-002 v1.1' },
        { v: 2, date: '2026-08-30', user: 'U02', status: 'aprobada', items: [it('PRD-002', '2026-10-01', 1, 12, 2900, 3600), it('PRD-004', '2026-10-04', 1, 12, 95, 140), it('PRD-005', '2026-10-01', 4, 1, 60, 90, 'Pasajero')], markupPct: 24, discountPct: 2, taxPct: 18, notes: 'Incluye Humantay el día libre.', snapshot: 'PRD-002 v1.1 / PRD-004 v1.0 / PRD-005 v1.0' }
      ] },
    { id: 'COT-2026-00186', clientId: 'CLI-0006', oppId: 'OPP-0115', title: 'Humantay + Machu Picchu — 1 pax', status: 'convertida', currentVersion: 1, validUntil: '2026-09-12', currency: 'USD', owner: 'U03', createdAt: '2026-08-19', travelFrom: '2026-09-24', travelTo: '2026-09-27', pax: { adt: 1, chd: 0, inf: 0 }, viewedAt: '2026-08-20 08:00', token: 'f1s3-sophie', approvedAt: '2026-09-10 09:40', approvedBy: 'Sophie Martin',
      versions: [{ v: 1, date: '2026-08-19', user: 'U03', status: 'aprobada', items: [it('PRD-001', '2026-09-26', 1, 1, 268, 345), it('PRD-004', '2026-09-25', 1, 1, 26, 38), it('PRD-005', '2026-09-24', 2, 1, 16, 24, 'Pasajero')], markupPct: 28, discountPct: 0, taxPct: 0, notes: '', snapshot: 'PRD-001 v2.0 / PRD-004 v1.0' }] },
    { id: 'COT-2026-00185', clientId: 'CLI-0008', oppId: 'OPP-0117', title: 'Luna de miel Cusco + Paracas', status: 'borrador', currentVersion: 1, validUntil: '2026-10-20', currency: 'PEN', owner: 'U04', createdAt: '2026-09-27', travelFrom: '2026-11-08', travelTo: '2026-11-14', pax: { adt: 2, chd: 0, inf: 0 }, viewedAt: null, token: null,
      versions: [{ v: 1, date: '2026-09-27', user: 'U04', status: 'borrador', items: [it('PRD-002', '2026-11-08', 1, 2, 2900, 3650), it('PRD-009', '2026-11-13', 1, 2, 150, 229)], markupPct: 25, discountPct: 0, taxPct: 18, notes: 'Pendiente elegir hotel boutique.', snapshot: 'PRD-002 v1.1 / PRD-009 v1.0' }] },
    { id: 'COT-2026-00184', clientId: 'CLI-0001', oppId: 'OPP-0113', title: 'Fiestas Patrias Arequipa — 4 pax', status: 'rechazada', currentVersion: 1, validUntil: '2026-07-10', currency: 'PEN', owner: 'U04', createdAt: '2026-06-16', travelFrom: '2026-07-26', travelTo: '2026-07-29', pax: { adt: 2, chd: 2, inf: 0 }, viewedAt: '2026-06-17 20:00', token: 'r9o0-rios', rejectedReason: 'Precio: eligió paquete de aerolínea',
      versions: [{ v: 1, date: '2026-06-16', user: 'U04', status: 'rechazada', items: [it('PRD-006', '2026-07-26', 1, 4, 1480, 1850)], markupPct: 25, discountPct: 0, taxPct: 18, notes: '', snapshot: 'PRD-006 v0.9' }] },
    { id: 'COT-2026-00183', clientId: 'CLI-0003', oppId: 'OPP-0114', title: 'Keller — Cusco aventura 6D', status: 'convertida', currentVersion: 1, validUntil: '2026-08-30', currency: 'USD', owner: 'U03', createdAt: '2026-06-03', travelFrom: '2026-09-27', travelTo: '2026-10-02', pax: { adt: 2, chd: 0, inf: 0 }, viewedAt: '2026-06-04 07:00', token: 'k4l2-keller', approvedAt: '2026-08-28 14:02', approvedBy: 'Thomas Keller',
      versions: [{ v: 1, date: '2026-06-03', user: 'U03', status: 'aprobada', items: [it('PRD-002', '2026-09-27', 1, 2, 780, 975), it('PRD-004', '2026-10-01', 1, 2, 26, 38), it('PRD-001', '2026-09-30', 1, 2, 268, 345)], markupPct: 25, discountPct: 0, taxPct: 0, notes: '', snapshot: 'PRD-001 v2.0 / PRD-002 v1.1 / PRD-004 v1.0' }] },
    { id: 'COT-2026-00182', clientId: 'CLI-0007', oppId: null, title: 'Wayra — bloque MAPI setiembre', status: 'vencida', currentVersion: 1, validUntil: '2026-09-10', currency: 'USD', owner: 'U02', createdAt: '2026-08-25', travelFrom: '2026-09-20', travelTo: '2026-09-20', pax: { adt: 10, chd: 0, inf: 0 }, viewedAt: '2026-08-26 12:00', token: 'w1y8-wayra',
      versions: [{ v: 1, date: '2026-08-25', user: 'U02', status: 'vencida', items: [it('PRD-001', '2026-09-20', 1, 10, 268, 312)], markupPct: 16, discountPct: 0, taxPct: 0, notes: 'Tarifa B2B', snapshot: 'PRD-001 v2.0' }] }
  ];

  /* ---------------- Reservas ---------------- */
  D.reservations = [
    /* v2.8 · viaje por tramos en curso (spec 21): la pasajera está en Arequipa y puede sumar tours y movilidad de los tramos que faltan */
    { id: 'RES-2026-000361', quoteId: null, quoteVersion: null, clientId: 'CLI-0001', title: 'Ríos — Perú Clásico 10D/9N (web)', status: 'en_operacion', channel: 'E-commerce', travelFrom: '2026-09-27', travelTo: '2026-10-06', currency: 'USD', total: 2486, owner: 'U03', createdAt: '2026-08-30 20:15', sede: 'SED-01', notes: 'Pedido web con armador de viaje por tramos.', ecomOrderId: 'WEB-2026-00961',
      passengers: [{ name: 'Gabriela Ríos Montoya', doc: 'DNI 45871236', type: 'ADT', nationality: 'Peruana', birth: '1990-03-14', phone: '987 654 321', diet: '' }, { name: 'Andrés Ríos Montoya', doc: 'DNI 47120988', type: 'ADT', nationality: 'Peruano', birth: '1992-07-02', phone: '', diet: '' }],
      services: [
        { id: 'RS-3611', productId: 'PRD-011', name: 'Perú Clásico 10D/9N — 2 pax', date: '2026-09-27', time: '09:00', providerId: 'PRV-004', status: 'confirmado', cost: 980, price: 1290, confirmationCode: 'KC-349-01' },
        { id: 'RS-3612', productId: null, name: 'Alojamiento Lima · Hotel Miraflores Park Inn · 1 hab. doble × 1 noche(s)', date: '2026-09-27', time: '14:00', providerId: 'PRV-004', status: 'completado', cost: 68, price: 85, confirmationCode: 'MPI-2231', kind: 'alojamiento', extraOf: 'PRD-011' },
        { id: 'RS-3613', productId: null, name: 'Alojamiento Arequipa · Casona del Sillar · 1 hab. doble × 2 noche(s)', date: '2026-09-28', time: '14:00', providerId: 'PRV-004', status: 'confirmado', cost: 109, price: 136, confirmationCode: 'CDS-7781', kind: 'alojamiento', extraOf: 'PRD-011' },
        { id: 'RS-3614', productId: null, name: 'Alojamiento Puno · Posada del Titicaca · 1 hab. doble × 2 noche(s)', date: '2026-09-30', time: '14:00', providerId: 'PRV-004', status: 'confirmado', cost: 99, price: 124, confirmationCode: 'PDT-0412', kind: 'alojamiento', extraOf: 'PRD-011' },
        { id: 'RS-3615', productId: null, name: 'Alojamiento Cusco · Hostal Valle Inka · 1 hab. doble × 4 noche(s)', date: '2026-10-02', time: '14:00', providerId: 'PRV-004', status: 'confirmado', cost: 192, price: 240, confirmationCode: 'HVI-9920', kind: 'alojamiento', extraOf: 'PRD-011' },
        { id: 'RS-3616', productId: null, tourId: 'TT-LIM-1', name: 'Tour Lima · Tour gastronómico en Barranco (2 adt)', date: '2026-09-27', time: '18:30', providerId: 'PRV-004', status: 'completado', cost: 104, price: 130, confirmationCode: 'KC-349-02', kind: 'tour_tramo', legId: 'LEG-1', extraOf: 'PRD-011' },
        { id: 'RS-3617', productId: null, transportId: 'TR-LIM-AQP-V', name: 'Movilidad Vuelo Lima → Arequipa (económica)', date: '2026-09-28', time: '07:10', providerId: 'PRV-004', status: 'completado', cost: 152, price: 190, confirmationCode: 'LA2077', kind: 'movilidad', mode: 'Vuelo', extraOf: 'PRD-011' },
        { id: 'RS-3618', productId: null, transportId: 'TR-AQP-PUN-B', name: 'Movilidad Bus turístico Arequipa → Puno', date: '2026-09-30', time: '07:30', providerId: 'PRV-004', status: 'confirmado', cost: 48, price: 60, confirmationCode: 'BT-5521', kind: 'movilidad', mode: 'Bus', extraOf: 'PRD-011' }
      ],
      booking: { productId: 'PRD-011', date: '2026-09-27', pax: { adt: 2, chd: 0, inf: 0 }, currencyDisplay: 'USD', fxRate: 1, chargeCurrency: 'USD', total: 2486, rooms: 4, nights: 9,
        lodging: [{ legId: 'LEG-1', city: 'Lima', hotel: 'Hotel Miraflores Park Inn', roomType: 'Doble', rooms: 1, nights: 1 }, { legId: 'LEG-2', city: 'Arequipa', hotel: 'Casona del Sillar', roomType: 'Doble', rooms: 1, nights: 2 }, { legId: 'LEG-3', city: 'Puno', hotel: 'Posada del Titicaca', roomType: 'Doble', rooms: 1, nights: 2 }, { legId: 'LEG-4', city: 'Cusco', hotel: 'Hostal Valle Inka', roomType: 'Doble', rooms: 1, nights: 4 }],
        tripLegs: [{ legId: 'LEG-1', city: 'Lima', nights: 1, checkIn: '2026-09-27', checkOut: '2026-09-28' }, { legId: 'LEG-2', city: 'Arequipa', nights: 2, checkIn: '2026-09-28', checkOut: '2026-09-30' }, { legId: 'LEG-3', city: 'Puno', nights: 2, checkIn: '2026-09-30', checkOut: '2026-10-02' }, { legId: 'LEG-4', city: 'Cusco', nights: 4, checkIn: '2026-10-02', checkOut: '2026-10-06' }],
        tripEnd: '2026-10-06', byCategory: { base: 1290, lodging: 585, tour: 130, transport: 250, addon: 0, surcharge: 0 },
        trip: { tours: [{ id: 'TT-LIM-1', legId: 'LEG-1', date: '2026-09-27', amount: 130 }], transport: [{ id: 'TR-LIM-AQP-V', mode: 'Vuelo', date: '2026-09-28', amount: 190 }, { id: 'TR-AQP-PUN-B', mode: 'Bus', date: '2026-09-30', amount: 60 }] },
        addons: [], payment: { mode: 'total', depositPct: 100, deposit: 2486, balance: 0 }, rulesApplied: ['R-LODGING', 'R-TRIP-BUILDER', 'R-IN-TRIP-SALES'], lang: 'es' } },
    { id: 'RES-2026-000348', quoteId: 'COT-2026-00187', quoteVersion: 2, clientId: 'CLI-0002', title: 'Incentivo mineros Q4 — Cusco', status: 'confirmada', channel: 'Corporativo', travelFrom: '2026-10-01', travelTo: '2026-10-05', currency: 'PEN', total: 58610, owner: 'U02', createdAt: '2026-09-05 12:20', sede: 'SED-01', notes: 'Grupo corporativo. Factura a nombre de la empresa. Crédito 30 días.',
      passengers: [
        { name: 'Ernesto Valdivia Ríos', doc: 'DNI 40112233', type: 'ADT', nationality: 'Peruana', birth: '1979-03-11', phone: '987 100 201', diet: '' },
        { name: 'Julio César Mena', doc: 'DNI 42228811', type: 'ADT', nationality: 'Peruana', birth: '1983-07-22', phone: '987 100 202', diet: 'Vegetariano' },
        { name: 'Karla Ugaz Soto', doc: 'DNI 45567712', type: 'ADT', nationality: 'Peruana', birth: '1990-01-05', phone: '987 100 203', diet: '' },
        { name: 'Óscar Linares Paz', doc: 'DNI 41009921', type: 'ADT', nationality: 'Peruana', birth: '1981-10-30', phone: '987 100 204', diet: '' },
        { name: 'Mónica Farfán Quiroz', doc: 'DNI 46677123', type: 'ADT', nationality: 'Peruana', birth: '1992-12-14', phone: '987 100 205', diet: 'Sin gluten' },
        { name: 'Raúl Espinoza Llerena', doc: 'DNI 40551287', type: 'ADT', nationality: 'Peruana', birth: '1977-05-19', phone: '987 100 206', diet: '' },
        { name: 'Sandra Chávez Molina', doc: 'DNI 44120987', type: 'ADT', nationality: 'Peruana', birth: '1987-09-01', phone: '987 100 207', diet: '' },
        { name: 'Luis Alberto Huerta', doc: 'DNI 43218876', type: 'ADT', nationality: 'Peruana', birth: '1985-02-26', phone: '987 100 208', diet: '' },
        { name: 'Teresa Anaya Cruz', doc: 'DNI 47781203', type: 'ADT', nationality: 'Peruana', birth: '1994-06-08', phone: '987 100 209', diet: '' },
        { name: 'Fernando Rivas Olaya', doc: 'DNI 40987612', type: 'ADT', nationality: 'Peruana', birth: '1980-11-17', phone: '987 100 210', diet: '' },
        { name: 'Rocío Salinas Tapia', doc: 'DNI 45510098', type: 'ADT', nationality: 'Peruana', birth: '1989-08-03', phone: '987 100 211', diet: '' },
        { name: 'Manuel Oré Guzmán', doc: 'DNI 41876640', type: 'ADT', nationality: 'Peruana', birth: '1982-04-29', phone: '987 100 212', diet: '' }
      ],
      services: [
        { id: 'RS-3481', productId: 'PRD-005', name: 'Traslado aeropuerto → hotel (2 vehículos)', date: '2026-10-01', time: '10:30', providerId: 'PRV-004', status: 'confirmado', cost: 420, price: 770, confirmationCode: 'QT-88120' },
        { id: 'RS-3482', productId: 'PRD-002', name: 'Hotel Tambo Real — 6 hab. dobles × 4 noches', date: '2026-10-01', time: '14:00', providerId: 'PRV-001', status: 'confirmado', cost: 14910, price: 23900, confirmationCode: 'TR-55410' },
        { id: 'RS-3483', productId: 'PRD-002', name: 'City Tour Cusco con guía', date: '2026-10-01', time: '13:30', providerId: 'PRV-006', status: 'confirmado', cost: 770, price: 1660, confirmationCode: 'AGO-3321' },
        { id: 'RS-3484', productId: 'PRD-002', name: 'Valle Sagrado + almuerzo buffet', date: '2026-10-02', time: '07:30', providerId: 'PRV-007', status: 'confirmado', cost: 2660, price: 5120, confirmationCode: 'TW-1180' },
        { id: 'RS-3485', productId: 'PRD-002', name: 'Tren Expedition Ollantaytambo — AC (i/v)', date: '2026-10-03', time: '05:05', providerId: 'PRV-005', status: 'confirmado', cost: 11781, price: 17930, confirmationCode: 'FSA-7Q2K9' },
        { id: 'RS-3486', productId: 'PRD-002', name: 'Entradas Machu Picchu Circuito 2 (12)', date: '2026-10-03', time: '08:00', providerId: 'PRV-009', status: 'confirmado', cost: 3192, price: 4870, confirmationCode: 'MC-00918273' },
        { id: 'RS-3487', productId: 'PRD-004', name: 'Laguna Humantay Full Day (12 pax)', date: '2026-10-04', time: '04:30', providerId: 'PRV-004', status: 'solicitado', cost: 1995, price: 3590, confirmationCode: '' },
        { id: 'RS-3488', productId: 'PRD-005', name: 'Traslado hotel → aeropuerto (2 vehículos)', date: '2026-10-05', time: '09:00', providerId: 'PRV-004', status: 'pendiente', cost: 420, price: 770, confirmationCode: '' }
      ] },
    { id: 'RES-2026-000347', quoteId: 'COT-2026-00183', quoteVersion: 1, clientId: 'CLI-0003', title: 'Keller — Cusco aventura 6D', status: 'en_operacion', channel: 'Directo', travelFrom: '2026-09-27', travelTo: '2026-10-02', currency: 'USD', total: 2716, owner: 'U03', createdAt: '2026-08-28 14:10', sede: 'SED-02', notes: 'Pasajeros hablan alemán e inglés. Solicitan guía en alemán.',
      passengers: [
        { name: 'Thomas Keller', doc: 'Pasaporte C4F82991', type: 'ADT', nationality: 'Alemana', birth: '1984-02-17', phone: '+49 171 5550102', diet: '' },
        { name: 'Anna Keller', doc: 'Pasaporte C4F82992', type: 'ADT', nationality: 'Alemana', birth: '1986-09-03', phone: '+49 171 5550103', diet: 'Vegetariana' }
      ],
      services: [
        { id: 'RS-3471', productId: 'PRD-005', name: 'Traslado aeropuerto → hotel', date: '2026-09-27', time: '11:10', providerId: 'PRV-004', status: 'completado', cost: 16, price: 24, confirmationCode: 'QT-88002' },
        { id: 'RS-3472', productId: 'PRD-002', name: 'Hotel Tambo Real — hab. doble × 5 noches', date: '2026-09-27', time: '14:00', providerId: 'PRV-001', status: 'confirmado', cost: 475, price: 610, confirmationCode: 'TR-55102' },
        { id: 'RS-3473', productId: 'PRD-002', name: 'City Tour Cusco (guía DE)', date: '2026-09-27', time: '13:30', providerId: 'PRV-006', status: 'completado', cost: 59, price: 95, confirmationCode: 'AGO-3290' },
        { id: 'RS-3474', productId: 'PRD-002', name: 'Valle Sagrado + almuerzo', date: '2026-09-28', time: '07:30', providerId: 'PRV-007', status: 'completado', cost: 70, price: 140, confirmationCode: 'TW-1144' },
        { id: 'RS-3475', productId: 'PRD-002', name: 'Día libre / aclimatación', date: '2026-09-29', time: '—', providerId: null, status: 'confirmado', cost: 0, price: 0, confirmationCode: '' },
        { id: 'RS-3476', productId: 'PRD-001', name: 'Machu Picchu Full Day', date: '2026-09-30', time: '04:10', providerId: 'PRV-005', status: 'confirmado', cost: 536, price: 690, confirmationCode: 'FSA-6M1P2' },
        { id: 'RS-3477', productId: 'PRD-004', name: 'Laguna Humantay Full Day', date: '2026-10-01', time: '04:30', providerId: 'PRV-004', status: 'confirmado', cost: 52, price: 76, confirmationCode: 'QT-88115' },
        { id: 'RS-3478', productId: 'PRD-005', name: 'Traslado hotel → aeropuerto', date: '2026-10-02', time: '08:30', providerId: 'PRV-004', status: 'confirmado', cost: 16, price: 24, confirmationCode: 'QT-88116' }
      ] },
    { id: 'RES-2026-000346', quoteId: 'COT-2026-00186', quoteVersion: 1, clientId: 'CLI-0006', title: 'Sophie Martin — Humantay + MAPI', status: 'completada', channel: 'E-commerce', travelFrom: '2026-09-24', travelTo: '2026-09-27', currency: 'USD', total: 431, owner: 'U03', createdAt: '2026-09-10 09:45', sede: 'SED-02', notes: '',
      passengers: [{ name: 'Sophie Martin', doc: 'Pasaporte 19FR22871', type: 'ADT', nationality: 'Francesa', birth: '1995-05-21', phone: '+33 6 12 34 56 78', diet: '' }],
      services: [
        { id: 'RS-3461', productId: 'PRD-005', name: 'Traslado aeropuerto → hotel', date: '2026-09-24', time: '09:40', providerId: 'PRV-004', status: 'completado', cost: 16, price: 24, confirmationCode: 'QT-87990' },
        { id: 'RS-3462', productId: 'PRD-004', name: 'Laguna Humantay Full Day', date: '2026-09-25', time: '04:30', providerId: 'PRV-004', status: 'completado', cost: 26, price: 38, confirmationCode: 'QT-87991' },
        { id: 'RS-3463', productId: 'PRD-001', name: 'Machu Picchu Full Day', date: '2026-09-26', time: '04:10', providerId: 'PRV-005', status: 'completado', cost: 268, price: 345, confirmationCode: 'FSA-6K2A1' },
        { id: 'RS-3464', productId: 'PRD-005', name: 'Traslado hotel → aeropuerto', date: '2026-09-27', time: '07:00', providerId: 'PRV-004', status: 'completado', cost: 16, price: 24, confirmationCode: 'QT-87992' }
      ] },
    { id: 'RES-2026-000345', quoteId: null, quoteVersion: null, clientId: 'CLI-0007', title: 'Wayra — 8 pax Humantay (B2B)', status: 'pendiente_pago', channel: 'B2B', travelFrom: '2026-10-02', travelTo: '2026-10-02', currency: 'PEN', total: 960, owner: 'U13', createdAt: '2026-09-27 16:22', sede: 'SED-01', notes: 'Reserva creada desde portal B2B. Crédito disponible.',
      passengers: Array.from({ length: 8 }, (_, i) => ({ name: ['Pasajero Wayra ' + (i + 1)][0], doc: 'DNI 7' + (1022330 + i), type: 'ADT', nationality: 'Peruana', birth: '1990-01-01', phone: '', diet: '' })),
      services: [{ id: 'RS-3451', productId: 'PRD-004', name: 'Laguna Humantay Full Day (salida SAL-0403)', date: '2026-10-02', time: '04:30', providerId: 'PRV-004', status: 'confirmado', cost: 760, price: 960, confirmationCode: 'QT-88130' }] },
    { id: 'RES-2026-000344', quoteId: null, quoteVersion: null, clientId: 'CLI-0001', title: 'Ríos — Machu Picchu 2D/1N', status: 'pendiente_proveedor', channel: 'Directo', travelFrom: '2026-10-12', travelTo: '2026-10-13', currency: 'USD', total: 1820, owner: 'U04', createdAt: '2026-09-25 11:00', sede: 'SED-01', notes: 'Esperando confirmación de hotel en Aguas Calientes.',
      passengers: [{ name: 'Gabriela Ríos Montoya', doc: 'DNI 45781236', type: 'ADT', nationality: 'Peruana', birth: '1988-04-12', phone: '999 102 334', diet: '' }, { name: 'Iván Castro Díaz', doc: 'DNI 44001289', type: 'ADT', nationality: 'Peruana', birth: '1986-01-20', phone: '', diet: '' }, { name: 'Valeria Castro Ríos', doc: 'DNI 81230011', type: 'CHD', nationality: 'Peruana', birth: '2016-06-02', phone: '', diet: '' }, { name: 'Mateo Castro Ríos', doc: 'DNI 81994410', type: 'CHD', nationality: 'Peruana', birth: '2019-03-15', phone: '', diet: '' }],
      services: [{ id: 'RS-3441', productId: 'PRD-003', name: 'Machu Picchu 2D/1N (4 pax)', date: '2026-10-12', time: '12:00', providerId: 'PRV-005', status: 'solicitado', cost: 1440, price: 1820, confirmationCode: '' }] },
    { id: 'RES-2026-000343', quoteId: null, quoteVersion: null, clientId: 'CLI-0006', title: 'Martin — Paracas (cancelada)', status: 'cancelada', channel: 'E-commerce', travelFrom: '2026-09-20', travelTo: '2026-09-20', currency: 'PEN', total: 229, owner: 'U03', createdAt: '2026-09-05 10:00', sede: 'SED-01', notes: 'Cancelada por cliente 16 días antes: sin penalidad.', cancelReason: 'Cambio de itinerario del cliente', passengers: [{ name: 'Sophie Martin', doc: 'Pasaporte 19FR22871', type: 'ADT', nationality: 'Francesa', birth: '1995-05-21', phone: '', diet: '' }],
      services: [{ id: 'RS-3431', productId: 'PRD-009', name: 'Paracas e Islas Ballestas', date: '2026-09-20', time: '04:00', providerId: 'PRV-010', status: 'cancelado', cost: 150, price: 229, confirmationCode: 'PN-4410' }] },
    { id: 'RES-2026-000349', quoteId: null, quoteVersion: null, clientId: 'CLI-0010', title: 'Johnson — Traslado + Humantay (borrador)', status: 'borrador', channel: 'Directo', travelFrom: '2026-10-20', travelTo: '2026-10-23', currency: 'USD', total: 124, owner: 'U03', createdAt: '2026-09-29 08:30', sede: 'SED-02', notes: 'En espera de aprobación de COT-2026-00188.', passengers: [{ name: 'Emily Johnson', doc: 'Passport 58812290', type: 'ADT', nationality: 'Estadounidense', birth: '1991-07-30', phone: '+1 415 555 0192', diet: '' }],
      services: [{ id: 'RS-3491', productId: 'PRD-004', name: 'Laguna Humantay Full Day', date: '2026-10-23', time: '04:30', providerId: 'PRV-004', status: 'pendiente', cost: 52, price: 76, confirmationCode: '' }] }
  ];

  /* ---------------- Operaciones ---------------- */
  D.operations = [
    { id: 'OP-2026-0412', resId: 'RES-2026-000347', title: 'Keller — Cusco aventura 6D', status: 'en_ejecucion', coordinator: 'U05', createdAt: '2026-08-29', dateFrom: '2026-09-27', dateTo: '2026-10-02',
      tasks: [{ t: 'Confirmar guía en alemán para MAPI', done: true }, { t: 'Enviar vouchers al pasajero', done: true }, { t: 'Verificar pasaportes para entradas nominativas', done: true }, { t: 'Llamada de bienvenida', done: true }, { t: 'Encuesta de cierre', done: false }],
      assignments: [
        { serviceId: 'RS-3476', date: '2026-09-30', time: '04:10', service: 'Machu Picchu Full Day', guideId: 'G02', driverId: 'C01', vehicleId: 'V01', status: 'confirmada', checkin: null },
        { serviceId: 'RS-3477', date: '2026-10-01', time: '04:30', service: 'Laguna Humantay Full Day', guideId: 'G03', driverId: 'C02', vehicleId: 'V03', status: 'asignada', checkin: null },
        { serviceId: 'RS-3478', date: '2026-10-02', time: '08:30', service: 'Traslado hotel → aeropuerto', guideId: null, driverId: 'C03', vehicleId: 'V05', status: 'pendiente', checkin: null },
        { serviceId: 'RS-3474', date: '2026-09-28', time: '07:30', service: 'Valle Sagrado + almuerzo', guideId: 'G02', driverId: 'C01', vehicleId: 'V02', status: 'completada', checkin: '2026-09-28 07:26' }
      ] },
    { id: 'OP-2026-0413', resId: 'RES-2026-000348', title: 'Incentivo mineros Q4 — Cusco', status: 'asignada', coordinator: 'U06', createdAt: '2026-09-06', dateFrom: '2026-10-01', dateTo: '2026-10-05',
      tasks: [{ t: 'Rooming list enviada al hotel', done: true }, { t: 'Confirmar Humantay con proveedor', done: false }, { t: 'Dietas especiales comunicadas a restaurante', done: true }, { t: 'Kit de bienvenida corporativo', done: false }, { t: 'Vouchers emitidos', done: false }],
      assignments: [
        { serviceId: 'RS-3481', date: '2026-10-01', time: '10:30', service: 'Traslado aeropuerto → hotel (2 veh.)', guideId: null, driverId: 'C02', vehicleId: 'V02', status: 'confirmada', checkin: null },
        { serviceId: 'RS-3483', date: '2026-10-01', time: '13:30', service: 'City Tour Cusco', guideId: 'G01', driverId: 'C02', vehicleId: 'V02', status: 'confirmada', checkin: null },
        { serviceId: 'RS-3484', date: '2026-10-02', time: '07:30', service: 'Valle Sagrado + almuerzo', guideId: 'G01', driverId: 'C01', vehicleId: 'V03', status: 'asignada', checkin: null },
        { serviceId: 'RS-3485', date: '2026-10-03', time: '05:05', service: 'Machu Picchu (tren + entrada)', guideId: 'G01', driverId: 'C01', vehicleId: 'V03', status: 'asignada', checkin: null },
        { serviceId: 'RS-3487', date: '2026-10-04', time: '04:30', service: 'Laguna Humantay Full Day', guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null },
        { serviceId: 'RS-3488', date: '2026-10-05', time: '09:00', service: 'Traslado hotel → aeropuerto', guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null }
      ] },
    { id: 'OP-2026-0411', resId: 'RES-2026-000346', title: 'Sophie Martin — Humantay + MAPI', status: 'completada', coordinator: 'U05', createdAt: '2026-09-11', dateFrom: '2026-09-24', dateTo: '2026-09-27', tasks: [{ t: 'Vouchers', done: true }, { t: 'Encuesta', done: true }],
      assignments: [{ serviceId: 'RS-3463', date: '2026-09-26', time: '04:10', service: 'Machu Picchu Full Day', guideId: 'G01', driverId: 'C01', vehicleId: 'V01', status: 'completada', checkin: '2026-09-26 04:06' }] },
    { id: 'OP-2026-0414', resId: 'RES-2026-000345', title: 'Wayra — 8 pax Humantay (B2B)', status: 'pendiente_asignacion', coordinator: 'U06', createdAt: '2026-09-27', dateFrom: '2026-10-02', dateTo: '2026-10-02', tasks: [{ t: 'Asignar guía a salida SAL-0403', done: false }],
      assignments: [{ serviceId: 'RS-3451', date: '2026-10-02', time: '04:30', service: 'Laguna Humantay (SAL-0403)', guideId: null, driverId: null, vehicleId: 'V02', status: 'pendiente', checkin: null }] }
  ];
  D.rooming = [
    { resId: 'RES-2026-000348', hotel: 'PRV-001', checkIn: '2026-10-01', checkOut: '2026-10-05', rooms: [
      { room: '301', type: 'Doble twin', pax: ['Ernesto Valdivia Ríos', 'Julio César Mena'], status: 'confirmada' },
      { room: '302', type: 'Doble twin', pax: ['Óscar Linares Paz', 'Raúl Espinoza Llerena'], status: 'confirmada' },
      { room: '303', type: 'Doble twin', pax: ['Karla Ugaz Soto', 'Mónica Farfán Quiroz'], status: 'confirmada' },
      { room: '304', type: 'Doble twin', pax: ['Sandra Chávez Molina', 'Teresa Anaya Cruz'], status: 'confirmada' },
      { room: '305', type: 'Doble twin', pax: ['Luis Alberto Huerta', 'Fernando Rivas Olaya'], status: 'confirmada' },
      { room: '306', type: 'Doble twin', pax: ['Rocío Salinas Tapia', 'Manuel Oré Guzmán'], status: 'observada' }
    ] },
    { resId: 'RES-2026-000347', hotel: 'PRV-001', checkIn: '2026-09-27', checkOut: '2026-10-02', rooms: [{ room: '214', type: 'Matrimonial', pax: ['Thomas Keller', 'Anna Keller'], status: 'confirmada' }] }
  ];
  D.vouchers = [
    { id: 'VOU-2026-01201', resId: 'RES-2026-000347', serviceId: 'RS-3476', service: 'Machu Picchu Full Day', providerId: 'PRV-005', date: '2026-09-30', pax: 2, status: 'emitido', version: 1, issuedAt: '2026-09-20 10:02', issuedBy: 'U05' },
    { id: 'VOU-2026-01202', resId: 'RES-2026-000347', serviceId: 'RS-3477', service: 'Laguna Humantay Full Day', providerId: 'PRV-004', date: '2026-10-01', pax: 2, status: 'emitido', version: 2, issuedAt: '2026-09-26 18:30', issuedBy: 'U05' },
    { id: 'VOU-2026-01203', resId: 'RES-2026-000347', serviceId: 'RS-3472', service: 'Hotel Tambo Real — 5 noches', providerId: 'PRV-001', date: '2026-09-27', pax: 2, status: 'emitido', version: 1, issuedAt: '2026-09-20 10:05', issuedBy: 'U05' },
    { id: 'VOU-2026-01199', resId: 'RES-2026-000346', serviceId: 'RS-3463', service: 'Machu Picchu Full Day', providerId: 'PRV-005', date: '2026-09-26', pax: 1, status: 'utilizado', version: 1, issuedAt: '2026-09-12 09:00', issuedBy: 'U05' },
    { id: 'VOU-2026-01204', resId: 'RES-2026-000348', serviceId: 'RS-3482', service: 'Hotel Tambo Real — 6 hab. × 4 noches', providerId: 'PRV-001', date: '2026-10-01', pax: 12, status: 'emitido', version: 1, issuedAt: '2026-09-28 11:40', issuedBy: 'U06' },
    { id: 'VOU-2026-01198', resId: 'RES-2026-000343', serviceId: 'RS-3431', service: 'Paracas e Islas Ballestas', providerId: 'PRV-010', date: '2026-09-20', pax: 1, status: 'anulado', version: 1, issuedAt: '2026-09-06 12:00', issuedBy: 'U05' }
  ];
  D.incidents = [
    { id: 'INC-0088', opId: 'OP-2026-0412', resId: 'RES-2026-000347', severity: 'alta', type: 'Salud del pasajero', title: 'Pasajera con mal de altura leve', desc: 'Anna Keller presenta dolor de cabeza y náuseas al retorno del Valle. Se brinda oxígeno y se coordina revisión médica en hotel.', status: 'en_proceso', assignee: 'U05', reportedBy: 'U10', createdAt: '2026-09-28 18:40', evidence: ['foto_oximetro.jpg'], log: [{ ts: '2026-09-28 18:40', u: 'U10', m: 'Reporte desde app operador' }, { ts: '2026-09-28 19:05', u: 'U05', m: 'Médico de turno coordinado con el hotel' }] },
    { id: 'INC-0087', opId: 'OP-2026-0413', resId: 'RES-2026-000348', severity: 'media', type: 'Proveedor', title: 'Hotel observa hab. 306 (mantenimiento)', desc: 'El hotel informa que la habitación 306 estará en mantenimiento el 01/10; propone upgrade a junior suite sin costo.', status: 'abierta', assignee: 'U06', reportedBy: 'U17', createdAt: '2026-09-29 07:20', evidence: [], log: [{ ts: '2026-09-29 07:20', u: 'U17', m: 'Aviso enviado por proveedor' }] },
    { id: 'INC-0086', opId: 'OP-2026-0411', resId: 'RES-2026-000346', severity: 'baja', type: 'Horario', title: 'Retraso de 25 min en recojo', desc: 'Tráfico en Av. El Sol. Pasajera informada por WhatsApp.', status: 'cerrada', assignee: 'U05', reportedBy: 'U11', createdAt: '2026-09-25 04:40', evidence: ['gps_ruta.png'], log: [{ ts: '2026-09-25 04:40', u: 'U11', m: 'Reporte' }, { ts: '2026-09-25 05:10', u: 'U05', m: 'Cerrada: sin impacto en el servicio' }] },
    { id: 'INC-0085', opId: 'OP-2026-0412', resId: 'RES-2026-000347', severity: 'critica', type: 'Transporte', title: 'Huelga anunciada en vía Cusco — Ollantaytambo 30/09', desc: 'Federación agraria anuncia paro regional para el 30/09. Riesgo para el tren de las 05:05. Evaluar salida 03:00 o tren desde Poroy.', status: 'abierta', assignee: 'U02', reportedBy: 'U05', createdAt: '2026-09-29 06:30', evidence: ['comunicado_paro.pdf'], log: [{ ts: '2026-09-29 06:30', u: 'U05', m: 'Alerta crítica registrada. Notificado a gerencia.' }] }
  ];

  /* ---------------- Finanzas ---------------- */
  D.receivables = [
    { id: 'CXC-00710', resId: 'RES-2026-000348', clientId: 'CLI-0002', concept: 'Anticipo 40% — Incentivo mineros', amount: 23444, currency: 'PEN', due: '2026-09-12', paid: 23444, status: 'pagada' },
    { id: 'CXC-00711', resId: 'RES-2026-000348', clientId: 'CLI-0002', concept: 'Saldo 60% — Incentivo mineros (crédito 30 d)', amount: 35166, currency: 'PEN', due: '2026-11-04', paid: 0, status: 'abierta' },
    { id: 'CXC-00705', resId: 'RES-2026-000347', clientId: 'CLI-0003', concept: 'Pago total — Keller', amount: 2716, currency: 'USD', due: '2026-09-12', paid: 2716, status: 'pagada' },
    { id: 'CXC-00701', resId: 'RES-2026-000346', clientId: 'CLI-0006', concept: 'Pago e-commerce — Martin', amount: 431, currency: 'USD', due: '2026-09-10', paid: 431, status: 'pagada' },
    { id: 'CXC-00712', resId: 'RES-2026-000345', clientId: 'CLI-0007', concept: 'Reserva B2B Wayra — crédito 15 d', amount: 960, currency: 'PEN', due: '2026-10-12', paid: 0, status: 'abierta' },
    { id: 'CXC-00713', resId: 'RES-2026-000344', clientId: 'CLI-0001', concept: 'Anticipo 50% — Ríos MAPI 2D', amount: 910, currency: 'USD', due: '2026-09-27', paid: 400, status: 'vencida' },
    { id: 'CXC-00714', resId: 'RES-2026-000344', clientId: 'CLI-0001', concept: 'Saldo 50% — Ríos MAPI 2D', amount: 910, currency: 'USD', due: '2026-10-05', paid: 0, status: 'abierta' }
  ];
  D.payments = [
    { id: 'PAG-01920', receivableId: 'CXC-00710', resId: 'RES-2026-000348', method: 'Transferencia BCP', amount: 23444, currency: 'PEN', date: '2026-09-11', status: 'aplicado', ref: 'OP 00918273', by: 'U07' },
    { id: 'PAG-01915', receivableId: 'CXC-00705', resId: 'RES-2026-000347', method: 'Tarjeta (pasarela)', amount: 2716, currency: 'USD', date: '2026-08-28', status: 'aplicado', ref: 'TXN 8812-AA90', by: 'U07' },
    { id: 'PAG-01912', receivableId: 'CXC-00701', resId: 'RES-2026-000346', method: 'Tarjeta (e-commerce)', amount: 431, currency: 'USD', date: '2026-09-10', status: 'aplicado', ref: 'TXN 7710-CC12', by: 'Sistema' },
    { id: 'PAG-01921', receivableId: 'CXC-00713', resId: 'RES-2026-000344', method: 'Yape', amount: 400, currency: 'USD', date: '2026-09-25', status: 'aplicado', ref: 'YP 44910022', by: 'U07' },
    { id: 'PAG-01922', receivableId: 'CXC-00713', resId: 'RES-2026-000344', method: 'Transferencia Interbank', amount: 510, currency: 'USD', date: '2026-09-29', status: 'pendiente', ref: 'Voucher por validar', by: 'U04' },
    { id: 'PAG-01910', receivableId: null, resId: 'RES-2026-000343', method: 'Tarjeta (e-commerce)', amount: 229, currency: 'PEN', date: '2026-09-05', status: 'revertido', ref: 'Reembolso TXN 6610', by: 'U07' }
  ];
  D.payables = [
    { id: 'CXP-00402', providerId: 'PRV-001', resId: 'RES-2026-000348', concept: 'Hotel 24 noches-hab.', amount: 14910, currency: 'PEN', due: '2026-10-16', paid: 0, status: 'aprobada' },
    { id: 'CXP-00403', providerId: 'PRV-005', resId: 'RES-2026-000348', concept: 'Tren Expedition 12 pax', amount: 11781, currency: 'PEN', due: '2026-09-25', paid: 11781, status: 'pagada' },
    { id: 'CXP-00404', providerId: 'PRV-009', resId: 'RES-2026-000348', concept: 'Entradas MAPI 12', amount: 3192, currency: 'PEN', due: '2026-09-20', paid: 3192, status: 'pagada' },
    { id: 'CXP-00405', providerId: 'PRV-004', resId: 'RES-2026-000348', concept: 'Transporte y traslados', amount: 2835, currency: 'PEN', due: '2026-10-31', paid: 0, status: 'abierta' },
    { id: 'CXP-00398', providerId: 'PRV-006', resId: 'RES-2026-000347', concept: 'Guiado en alemán 3 jornadas', amount: 660, currency: 'PEN', due: '2026-10-03', paid: 0, status: 'abierta' },
    { id: 'CXP-00397', providerId: 'PRV-001', resId: 'RES-2026-000347', concept: 'Hotel 5 noches', amount: 475, currency: 'USD', due: '2026-10-12', paid: 0, status: 'aprobada' },
    { id: 'CXP-00390', providerId: 'PRV-007', resId: 'RES-2026-000346', concept: 'Alimentación', amount: 90, currency: 'PEN', due: '2026-09-20', paid: 0, status: 'vencida' }
  ];
  D.commissions = [
    { id: 'COM-0301', resId: 'RES-2026-000348', beneficiary: 'U02', kind: 'Vendedor', base: 49669, pct: 2.5, amount: 1241.73, currency: 'PEN', status: 'aprobada' },
    { id: 'COM-0300', resId: 'RES-2026-000347', beneficiary: 'U03', kind: 'Vendedor', base: 2716, pct: 3, amount: 81.48, currency: 'USD', status: 'pagada' },
    { id: 'COM-0299', resId: 'RES-2026-000345', beneficiary: 'AGB-01', kind: 'Agencia B2B', base: 960, pct: 12, amount: 115.2, currency: 'PEN', status: 'calculada' },
    { id: 'COM-0298', resId: 'RES-2026-000346', beneficiary: 'U03', kind: 'Vendedor', base: 431, pct: 3, amount: 12.93, currency: 'USD', status: 'pagada' }
  ];
  D.invoices = [
    { id: 'F001-00001482', type: 'Factura', clientId: 'CLI-0002', resId: 'RES-2026-000348', amount: 23444, currency: 'PEN', date: '2026-09-11', status: 'aceptado', detail: 'Anticipo 40% servicios turísticos' },
    { id: 'B001-00008810', type: 'Boleta', clientId: 'CLI-0006', resId: 'RES-2026-000346', amount: 431, currency: 'USD', date: '2026-09-10', status: 'aceptado', detail: 'Exportación de servicios' },
    { id: 'B001-00008811', type: 'Boleta', clientId: 'CLI-0003', resId: 'RES-2026-000347', amount: 2716, currency: 'USD', date: '2026-08-28', status: 'aceptado', detail: 'Exportación de servicios' },
    { id: 'F001-00001483', type: 'Nota de crédito', clientId: 'CLI-0006', resId: 'RES-2026-000343', amount: 229, currency: 'PEN', date: '2026-09-06', status: 'aceptado', detail: 'Anulación por cancelación' },
    { id: 'B001-00008812', type: 'Boleta', clientId: 'CLI-0001', resId: 'RES-2026-000344', amount: 400, currency: 'USD', date: '2026-09-25', status: 'observado', detail: 'Anticipo — revisar tipo de cambio' }
  ];
  D.bankLines = [
    { id: 'BNK-1', date: '2026-09-29', bank: 'BCP', desc: 'ABONO TRANSF INTERBANK REF 99812', amount: 1907.4, currency: 'PEN', match: 'PAG-01922', status: 'sugerido' },
    { id: 'BNK-2', date: '2026-09-28', bank: 'BCP', desc: 'ABONO YAPE 44910022', amount: 1496, currency: 'PEN', match: 'PAG-01921', status: 'conciliado' },
    { id: 'BNK-3', date: '2026-09-28', bank: 'BBVA', desc: 'ABONO SIN REFERENCIA', amount: 350, currency: 'PEN', match: null, status: 'excepción' },
    { id: 'BNK-4', date: '2026-09-27', bank: 'BCP', desc: 'CARGO PAGO PROV 20480099887', amount: -11781, currency: 'PEN', match: 'CXP-00403', status: 'conciliado' }
  ];

  /* ---------------- Canales ---------------- */
  D.b2bAgencies = [
    { id: 'AGB-01', name: 'Wayra Viajes S.A.C.', ruc: '20600991230', clientId: 'CLI-0007', priceList: 'Mayorista 2026', commissionPct: 12, creditLimit: 25000, creditUsed: 8960, currency: 'PEN', status: 'activa', since: '2026-02-01', contact: 'Pamela Ortiz', validTo: '2026-12-31' },
    { id: 'AGB-02', name: 'Mundo Andino Tours E.I.R.L.', ruc: '20607788991', clientId: null, priceList: 'Minorista 2026', commissionPct: 8, creditLimit: 0, creditUsed: 0, currency: 'PEN', status: 'activa', since: '2026-05-10', contact: 'Iván Salas', validTo: '2026-12-31' },
    { id: 'AGB-03', name: 'Pacífico Travel Group', ruc: '20609901122', clientId: null, priceList: 'Mayorista 2026', commissionPct: 10, creditLimit: 15000, creditUsed: 14200, currency: 'PEN', status: 'bloqueada', since: '2026-03-15', contact: 'Laura Meza', validTo: '2026-12-31' }
  ];
  D.cms = [
    { id: 'CMS-01', title: 'Home — Temporada de primavera', type: 'Página', channel: 'Web', status: 'publicado', updated: '2026-09-15', author: 'U01' },
    { id: 'CMS-02', title: 'Banner: Promo Humantay S/ 129', type: 'Banner', channel: 'Web / E-commerce', status: 'publicado', updated: '2026-09-15', author: 'U03' },
    { id: 'CMS-03', title: 'Blog: 10 consejos para el mal de altura', type: 'Artículo', channel: 'Web', status: 'en_revision', updated: '2026-09-27', author: 'U04' },
    { id: 'CMS-04', title: 'Landing: Año Nuevo en Cusco 2027', type: 'Página', channel: 'Web', status: 'borrador', updated: '2026-09-28', author: 'U04' },
    { id: 'CMS-05', title: 'Política de cancelaciones', type: 'Página legal', channel: 'Web / Portal', status: 'publicado', updated: '2026-06-01', author: 'U01' },
    { id: 'CMS-06', title: 'Banner Fiestas Patrias', type: 'Banner', channel: 'Web', status: 'despublicado', updated: '2026-08-01', author: 'U03' }
  ];
  D.ecomOrders = [
    { id: 'WEB-10433', date: '2026-09-29 06:50', customer: 'Emily Johnson', product: 'PRD-004', pax: 2, total: 258, currency: 'PEN', status: 'pago_pendiente' },
    { id: 'WEB-10432', date: '2026-09-28 22:14', customer: 'Lucas Pereira', product: 'PRD-001', pax: 2, total: 690, currency: 'USD', status: 'confirmado' },
    { id: 'WEB-10431', date: '2026-09-28 15:02', customer: 'Nadia Reyes', product: 'PRD-007', pax: 3, total: 555, currency: 'PEN', status: 'confirmado' },
    { id: 'WEB-10430', date: '2026-09-27 19:40', customer: 'Kenji Watanabe', product: 'PRD-001', pax: 1, total: 345, currency: 'USD', status: 'pago_rechazado' }
  ];

  /* ---------------- Plataforma: notificaciones, auditoría, jobs, integraciones ---------------- */
  D.notifications = [
    { id: 'NTF-9921', ts: '2026-09-29 07:20', event: 'incidencia.creada', channel: 'Email', to: 'khuaman@andeshorizonte.pe', subject: 'INC-0087 Hotel observa hab. 306', status: 'enviado', retries: 0 },
    { id: 'NTF-9920', ts: '2026-09-29 06:30', event: 'incidencia.critica', channel: 'WhatsApp', to: '987 331 902', subject: 'ALERTA CRÍTICA INC-0085', status: 'enviado', retries: 0 },
    { id: 'NTF-9919', ts: '2026-09-29 06:30', event: 'incidencia.critica', channel: 'Push', to: 'Renato Salazar', subject: 'ALERTA CRÍTICA INC-0085', status: 'enviado', retries: 0 },
    { id: 'NTF-9918', ts: '2026-09-29 05:00', event: 'viaje.proximo', channel: 'Email', to: 'viajes@mcblanca.com.pe', subject: 'Su viaje inicia en 2 días', status: 'enviado', retries: 0 },
    { id: 'NTF-9917', ts: '2026-09-28 21:05', event: 'cotizacion.vista', channel: 'Portal', to: 'U04', subject: 'COT-2026-00190 fue abierta por el cliente', status: 'enviado', retries: 0 },
    { id: 'NTF-9916', ts: '2026-09-28 18:00', event: 'pago.recordatorio', channel: 'WhatsApp', to: '999 102 334', subject: 'Recordatorio de anticipo vencido', status: 'fallido', retries: 3 },
    { id: 'NTF-9915', ts: '2026-09-28 11:40', event: 'voucher.emitido', channel: 'Email', to: 'reservas@tamboreal.pe', subject: 'VOU-2026-01204', status: 'enviado', retries: 0 },
    { id: 'NTF-9914', ts: '2026-09-27 19:40', event: 'cotizacion.vista', channel: 'Portal', to: 'U02', subject: 'COT-2026-00191 abierta por el cliente', status: 'enviado', retries: 0 }
  ];
  D.audit = [
    { id: 'AUD-55120', ts: '2026-09-29 09:02', user: 'U03', entity: 'Lead', entityId: 'LEAD-0231', action: 'asignar', before: 'sin asignar', after: 'U04', ip: '190.43.12.8', corr: 'c-8812a' },
    { id: 'AUD-55119', ts: '2026-09-29 08:40', user: 'U02', entity: 'Sesión', entityId: 'U02', action: 'login', before: '', after: 'MFA OK', ip: '190.43.12.9', corr: 'c-8811f' },
    { id: 'AUD-55118', ts: '2026-09-29 07:20', user: 'U17', entity: 'Incidencia', entityId: 'INC-0087', action: 'crear', before: '', after: 'abierta', ip: '181.65.2.100', corr: 'c-8810b' },
    { id: 'AUD-55117', ts: '2026-09-29 06:30', user: 'U05', entity: 'Incidencia', entityId: 'INC-0085', action: 'crear', before: '', after: 'abierta / crítica', ip: '179.7.40.22', corr: 'c-880ff' },
    { id: 'AUD-55116', ts: '2026-09-28 11:40', user: 'U06', entity: 'Voucher', entityId: 'VOU-2026-01204', action: 'emitir', before: '', after: 'emitido v1', ip: '179.7.40.23', corr: 'c-87f1a' },
    { id: 'AUD-55115', ts: '2026-09-26 18:30', user: 'U05', entity: 'Voucher', entityId: 'VOU-2026-01202', action: 'versionar', before: 'v1', after: 'v2 (cambio de guía)', ip: '179.7.40.22', corr: 'c-87c10' },
    { id: 'AUD-55114', ts: '2026-09-24 16:12', user: 'U02', entity: 'Cotización', entityId: 'COT-2026-00191', action: 'nueva_version', before: 'v2', after: 'v3', ip: '190.43.12.9', corr: 'c-87a02' },
    { id: 'AUD-55113', ts: '2026-09-24 16:10', user: 'U02', entity: 'Cotización', entityId: 'COT-2026-00191', action: 'descuento_override', before: '3%', after: '5%', ip: '190.43.12.9', corr: 'c-87a01' },
    { id: 'AUD-55112', ts: '2026-09-20 11:02', user: 'U04', entity: 'Producto', entityId: 'PRD-006', action: 'cambio_estado', before: 'DRAFT', after: 'REVIEW', ip: '190.43.12.10', corr: 'c-86f30' },
    { id: 'AUD-55111', ts: '2026-09-06 12:05', user: 'U07', entity: 'Pago', entityId: 'PAG-01910', action: 'revertir', before: 'aplicado', after: 'revertido', ip: '190.43.12.11', corr: 'c-85b11' },
    { id: 'AUD-55110', ts: '2026-09-05 12:20', user: 'U02', entity: 'Reserva', entityId: 'RES-2026-000348', action: 'crear_desde_cotizacion', before: 'COT-2026-00187 v2', after: 'confirmada', ip: '190.43.12.9', corr: 'c-85a90' },
    { id: 'AUD-55109', ts: '2026-08-20 10:00', user: 'U02', entity: 'Producto', entityId: 'PRD-001', action: 'nueva_version', before: '1.1', after: '2.0', ip: '190.43.12.9', corr: 'c-83100' },
    { id: 'AUD-55108', ts: '2026-08-20 09:58', user: 'U02', entity: 'Tarifa', entityId: 'TAR-001', action: 'cambio_precio', before: 'USD 335', after: 'USD 345', ip: '190.43.12.9', corr: 'c-830ff' }
  ];
  D.jobs = [
    { id: 'JOB-01', name: 'Expirar holds de disponibilidad', cron: 'cada 5 min', last: '2026-09-29 09:05', next: '2026-09-29 09:10', status: 'ok', lastResult: '2 holds liberados' },
    { id: 'JOB-02', name: 'Marcar cotizaciones vencidas', cron: 'diario 00:05', last: '2026-09-29 00:05', next: '2026-09-30 00:05', status: 'ok', lastResult: '1 cotización vencida' },
    { id: 'JOB-03', name: 'Recordatorios de pago', cron: 'diario 09:00', last: '2026-09-28 09:00', next: '2026-09-29 09:00', status: 'advertencia', lastResult: '1 envío WhatsApp fallido (3 reintentos)' },
    { id: 'JOB-04', name: 'Recordatorio de actividades CRM', cron: 'cada hora', last: '2026-09-29 09:00', next: '2026-09-29 10:00', status: 'ok', lastResult: '3 recordatorios' },
    { id: 'JOB-05', name: 'Notificar próximos viajes (48 h)', cron: 'diario 05:00', last: '2026-09-29 05:00', next: '2026-09-30 05:00', status: 'ok', lastResult: '2 clientes notificados' },
    { id: 'JOB-06', name: 'Detectar reservas pendientes de proveedor', cron: 'cada 2 h', last: '2026-09-29 08:00', next: '2026-09-29 10:00', status: 'ok', lastResult: '2 servicios sin confirmar' },
    { id: 'JOB-07', name: 'Sincronizar proveedores (adapters)', cron: 'cada 6 h', last: '2026-09-29 06:00', next: '2026-09-29 12:00', status: 'error', lastResult: 'Timeout adapter tren (backoff 3/5)' },
    { id: 'JOB-08', name: 'Reportes programados (gerencia)', cron: 'lunes 07:00', last: '2026-09-28 07:00', next: '2026-10-05 07:00', status: 'ok', lastResult: '3 PDF enviados' },
    { id: 'JOB-09', name: 'Expirar asignaciones no confirmadas', cron: 'cada 30 min', last: '2026-09-29 09:00', next: '2026-09-29 09:30', status: 'ok', lastResult: 'Sin cambios' }
  ];
  D.integrations = [
    { id: 'INT-01', name: 'Facturación electrónica (OSE/SUNAT)', kind: 'Fiscal', status: 'por_validar', note: 'Adaptador preparado. Proveedor OSE, contrato y API por definir con el cliente.' },
    { id: 'INT-02', name: 'Pasarela de pagos con tarjeta', kind: 'Pagos', status: 'por_validar', note: 'Proveedor por definir. Webhook de confirmación e idempotencia contemplados.' },
    { id: 'INT-03', name: 'Correo transaccional (SMTP / API)', kind: 'Email', status: 'activo', note: 'Plantillas por evento. Reintentos con backoff.' },
    { id: 'INT-04', name: 'WhatsApp Business API', kind: 'Mensajería', status: 'sandbox', note: 'Plantillas en aprobación. Envíos en entorno de pruebas.' },
    { id: 'INT-05', name: 'Mapas y geocodificación', kind: 'Mapas', status: 'activo', note: 'Coordenadas de destinos y puntos de encuentro.' },
    { id: 'INT-06', name: 'Proveedores (tren, entradas, hoteles)', kind: 'Proveedores', status: 'parcial', note: 'Disponibilidad externa solo informativa hasta confirmar integración.' },
    { id: 'INT-07', name: 'OTA / GDS', kind: 'Distribución', status: 'futuro', note: 'Fase futura. No se asume inventario externo.' }
  ];
  D.settings = {
    currency: 'PEN', altCurrency: 'USD', fx: 3.74, fxSource: 'Manual diario (SBS referencial)', taxPct: 18, rounding: '0.10', quoteValidityDays: 10, holdMinutes: 30,
    series: [{ doc: 'Cotización', prefix: 'COT-2026-', next: 192 }, { doc: 'Reserva', prefix: 'RES-2026-', next: 350 }, { doc: 'Orden operativa', prefix: 'OP-2026-', next: 415 }, { doc: 'Voucher', prefix: 'VOU-2026-', next: 1205 }, { doc: 'Factura', prefix: 'F001-', next: 1484 }, { doc: 'Boleta', prefix: 'B001-', next: 8813 }],
    notifications: [{ event: 'Cotización enviada', email: true, whatsapp: true, push: false, portal: true }, { event: 'Cotización aprobada', email: true, whatsapp: false, push: true, portal: true }, { event: 'Reserva confirmada', email: true, whatsapp: true, push: true, portal: true }, { event: 'Pago recibido', email: true, whatsapp: true, push: false, portal: true }, { event: 'Asignación', email: false, whatsapp: true, push: true, portal: false }, { event: 'Cambio de horario', email: true, whatsapp: true, push: true, portal: true }, { event: 'Incidencia crítica', email: true, whatsapp: true, push: true, portal: false }, { event: 'Voucher emitido', email: true, whatsapp: false, push: true, portal: true }]
  };

  /* Series mensuales para dashboards (2026) */
  D.monthly = {
    labels: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set'],
    sales: [182400, 205900, 318700, 402300, 291800, 248600],
    cost: [131200, 149800, 229400, 286900, 213100, 179300],
    reservations: [41, 47, 72, 88, 63, 58],
    leads: [96, 112, 140, 171, 133, 128],
    quotes: [58, 66, 91, 109, 84, 77],
    conversion: [22, 24, 27, 29, 25, 26]
  };

  /* ================= Motor de reservas: configuración comercial por producto (v2.1) =================
     Todas las tarifas de museos/entradas y tipos de cambio son REFERENCIALES para la demo. */
  D.settings.ecommerce = {
    baseCurrency: 'PEN',
    currencies: [
      { code: 'PEN', name: 'Sol peruano', symbol: 'S/', rate: 1, active: true },
      { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', rate: 3.74, active: true },
      { code: 'EUR', name: 'Euro', symbol: '€', rate: 4.05, active: true },
      { code: 'GBP', name: 'Libra esterlina', symbol: '£', rate: 4.78, active: true },
      { code: 'BRL', name: 'Real brasileño', symbol: 'R$', rate: 0.68, active: true },
      { code: 'CLP', name: 'Peso chileno', symbol: 'CLP$', rate: 0.0040, active: true },
      { code: 'MXN', name: 'Peso mexicano', symbol: 'MX$', rate: 0.20, active: true },
      { code: 'COP', name: 'Peso colombiano', symbol: 'COL$', rate: 0.00092, active: true },
      { code: 'ARS', name: 'Peso argentino', symbol: 'AR$', rate: 0.0039, active: false },
      { code: 'JPY', name: 'Yen japonés', symbol: '¥', rate: 0.025, active: false }
    ],
    rateSource: 'Tabla manual diaria (referencial). En producción: proveedor de tipos de cambio + margen configurable.',
    rateUpdatedAt: '2026-09-30 08:00',
    fxMarginPct: 2,
    chargeCurrencies: ['PEN', 'USD'],
    depositPctDefault: 30,
    balanceDueDaysDefault: 15,
    paymentModes: ['total', 'adelanto'],
    holdMinutes: 30,
    defaultPaxRules: { adultMinAge: 11, childMinAge: 4, childMaxAge: 10, childPays: true, childPricePct: 70, infantMaxAge: 3, infantPays: false, maxChildrenPerAdult: 2, maxInfantsPerAdult: 1, minAdults: 1 }
  };
  const bookingCfg = {
    'PRD-001': {
      availability: { ranges: [
        { id: 'RG-0101', from: '2026-09-30', to: '2026-10-31', status: 'disponible', capacityPerDay: 16, note: 'Salidas diarias' },
        { id: 'RG-0102', from: '2026-10-15', to: '2026-10-16', status: 'cerrado', capacityPerDay: 0, note: 'Mantenimiento de vía férrea (aviso del operador)' },
        { id: 'RG-0103', from: '2026-11-01', to: '2026-12-20', status: 'disponible', capacityPerDay: 16, note: '' }
      ], weekdays: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 72 },
      paxRules: { adultMinAge: 11, childMinAge: 4, childMaxAge: 10, childPays: true, childPricePct: 70, infantMaxAge: 3, infantPays: false, maxChildrenPerAdult: 2, maxInfantsPerAdult: 1, minAdults: 1, note: 'Entrada nominativa: todos los pasajeros, incluidos los infantes, deben registrarse con documento.' },
      addons: [
        { id: 'ADD-0101', name: 'Entrada a Huayna Picchu (montaña adicional)', category: 'Entrada', price: 75, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true, stock: 'Cupo limitado diario' },
        { id: 'ADD-0102', name: 'Museo de Sitio Manuel Chávez Ballón', category: 'Museo', price: 22, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
        { id: 'ADD-0103', name: 'Almuerzo buffet en Aguas Calientes', category: 'Alimentación', price: 25, currency: 'USD', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
        { id: 'ADD-0104', name: 'Upgrade a tren Vistadome', category: 'Transporte', price: 35, currency: 'USD', per: 'pax', appliesTo: ['ADT', 'CHD', 'INF'], optional: true }
      ],
      payment: { modes: ['total', 'adelanto'], depositPct: 50, balanceDueDays: 10, note: 'Las entradas nominativas se emiten con el adelanto.' },
      pickup: { required: true, askFlight: false, points: ['Recojo en hotel del Centro Histórico de Cusco', 'Plaza Regocijo (punto de encuentro)', 'Estación de Ollantaytambo (llego por mi cuenta)'] }
    },
    'PRD-002': {
      availability: { ranges: [
        { id: 'RG-0201', from: '2026-10-01', to: '2026-12-22', status: 'disponible', capacityPerDay: 20, note: '' },
        { id: 'RG-0202', from: '2026-12-23', to: '2027-01-02', status: 'agotado', capacityPerDay: 0, note: 'Fiestas de fin de año: cupos agotados' }
      ], weekdays: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 240 },
      paxRules: { adultMinAge: 11, childMinAge: 4, childMaxAge: 10, childPays: true, childPricePct: 75, infantMaxAge: 3, infantPays: false, maxChildrenPerAdult: 2, maxInfantsPerAdult: 1, minAdults: 1 },
      addons: [
        { id: 'ADD-0201', name: 'Museo Inka (Cusco)', category: 'Museo', price: 20, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
        { id: 'ADD-0202', name: 'Museo de Arte Precolombino (MAP)', category: 'Museo', price: 25, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
        { id: 'ADD-0203', name: 'Cena show folclórico', category: 'Experiencia', price: 45, currency: 'USD', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
        { id: 'ADD-0204', name: 'Seguro de viaje ampliado', category: 'Seguro', price: 18, currency: 'USD', per: 'pax', appliesTo: ['ADT', 'CHD', 'INF'], optional: true }
      ],
      payment: { modes: ['total', 'adelanto'], depositPct: 30, balanceDueDays: 15 },
      pickup: { required: true, askFlight: true, points: ['Aeropuerto de Cusco (indique vuelo de llegada)', 'Terminal terrestre de Cusco', 'Hotel en Cusco (llego por mi cuenta)'] }
    },
    'PRD-004': {
      availability: { ranges: [
        { id: 'RG-0401', from: '2026-09-30', to: '2026-11-30', status: 'disponible', capacityPerDay: 20, note: '' }
      ], weekdays: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 24 },
      paxRules: { adultMinAge: 11, childMinAge: 8, childMaxAge: 10, childPays: true, childPricePct: 80, infantMaxAge: 7, infantPays: false, infantAllowed: false, maxChildrenPerAdult: 1, maxInfantsPerAdult: 0, minAdults: 1, note: 'Caminata exigente: edad mínima 8 años; no se aceptan infantes.' },
      addons: [
        { id: 'ADD-0401', name: 'Caballo de apoyo para el ascenso', category: 'Servicio', price: 90, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
        { id: 'ADD-0402', name: 'Ingreso a la comunidad de Soraypampa', category: 'Entrada', price: 20, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true }
      ],
      payment: { modes: ['total'], depositPct: 100, balanceDueDays: 0 },
      pickup: { required: true, askFlight: false, points: ['Recojo en hotel del Centro Histórico de Cusco', 'Plaza Regocijo (punto de encuentro)'] }
    }
  };
  D.products.forEach(p => { if (bookingCfg[p.id]) Object.assign(p, bookingCfg[p.id]); });
  /* Circuito multi-ciudad con alojamiento opcional por ciudad */
  D.products.push({
    id: 'PRD-011', code: 'PER-CIR-10D', sku: 'AH-CIR-PER10', name: 'Perú Clásico 10D/9N: Lima, Arequipa, Puno y Cusco', internalName: 'Circuito Perú Clásico 4 ciudades', type: 'CIRCUITO', category: 'Cultural', subcategory: 'City Tours', destId: 'D01', secondary: ['D14', 'D11', 'D09', 'D03', 'D06'], status: 'ACTIVE',
    short: 'Circuito por las cuatro ciudades clásicas del Perú con traslados, tours y alojamiento opcional en cada ciudad.',
    long: 'Diez días recorriendo Lima colonial, la Arequipa del sillar, el lago Titicaca desde Puno y Cusco con Machu Picchu. Los tours, traslados internos y entradas están incluidos; el alojamiento es opcional y se elige por ciudad (categoría, tipo y número de habitaciones).',
    durationValue: 10, durationUnit: 'días', modality: 'Compartido', mainProviderId: 'PRV-012', minPax: 1, maxPax: 16, minAge: 0, maxAge: 85, advMin: 15, advMax: 365,
    flags: { bookable: true, quoteable: true, b2b: true, ecommerce: true, featured: true }, markupPct: 24,
    components: [{ serviceId: 'SRV-016', qty: 1, unit: 'pax', order: 1, required: true, included: true, notes: 'Colca' }, { serviceId: 'SRV-003', qty: 1, unit: 'pax', order: 2, required: true, included: true, notes: '' }, { serviceId: 'SRV-005', qty: 1, unit: 'pax', order: 3, required: true, included: true, notes: '' }, { serviceId: 'SRV-006', qty: 6, unit: 'servicio', order: 4, required: true, included: true, notes: '' }],
    itinerary: [
      { day: 1, title: 'Lima: llegada y centro histórico', items: [{ time: '10:00', activity: 'Recepción en aeropuerto', type: 'Traslado', location: 'Lima' }, { time: '15:00', activity: 'City tour colonial y moderno', type: 'Guía', location: 'Lima' }] },
      { day: 2, title: 'Lima → Arequipa', items: [{ time: '09:00', activity: 'Vuelo a Arequipa y tour del Monasterio', type: 'Transporte', location: 'Arequipa' }] },
      { day: 3, title: 'Arequipa: campiña', items: [{ time: '09:00', activity: 'Miradores de Yanahuara y Carmen Alto', type: 'Guía', location: 'Arequipa' }] },
      { day: 4, title: 'Arequipa → Puno', items: [{ time: '08:00', activity: 'Bus turístico por la reserva de Salinas', type: 'Transporte', location: 'Puno' }] },
      { day: 5, title: 'Lago Titicaca', items: [{ time: '07:30', activity: 'Islas Uros y Taquile', type: 'Guía', location: 'Puno' }] },
      { day: 6, title: 'Puno → Cusco (Ruta del Sol)', items: [{ time: '07:00', activity: 'Bus turístico con paradas', type: 'Transporte', location: 'Cusco' }] },
      { day: 7, title: 'Cusco: City tour', items: [{ time: '13:30', activity: 'Qoricancha y Sacsayhuamán', type: 'Guía', location: 'Cusco' }] },
      { day: 8, title: 'Valle Sagrado', items: [{ time: '08:00', activity: 'Pisac y Ollantaytambo', type: 'Guía', location: 'Valle Sagrado' }] },
      { day: 9, title: 'Machu Picchu', items: [{ time: '05:05', activity: 'Tren y visita guiada', type: 'Tren', location: 'Machu Picchu' }] },
      { day: 10, title: 'Salida', items: [{ time: '10:00', activity: 'Traslado al aeropuerto de Cusco', type: 'Traslado', location: 'Cusco' }] }
    ],
    inclusions: ['Traslados de llegada y salida', 'Tours guiados en las 4 ciudades', 'Bus turístico Arequipa–Puno y Puno–Cusco', 'Tren y entrada a Machu Picchu', 'Seguro de asistencia'],
    exclusions: ['Vuelo Lima–Arequipa', 'Alojamiento (opcional, se elige por ciudad)', 'Comidas no indicadas', 'Propinas'],
    requirements: ['Pasaporte o DNI vigente', 'Aclimatación recomendada en Arequipa antes de Puno (3 800 m s. n. m.)'],
    policies: pol('Sin penalidad hasta 30 días antes. 30% entre 29 y 15 días. 60% entre 14 y 7 días. 100% dentro de 7 días.'),
    rates: [
      { id: 'TAR-111', type: 'Venta', segment: 'Adulto', channel: 'Directo', currency: 'USD', cost: 1180, price: 1490, validFrom: '2026-01-01', validTo: '2027-03-31', season: 'TMP-02', status: 'vigente' },
      { id: 'TAR-112', type: 'Venta', segment: 'Niño', channel: 'Directo', currency: 'USD', cost: 850, price: 1090, validFrom: '2026-01-01', validTo: '2027-03-31', season: 'TMP-02', status: 'vigente' },
      { id: 'TAR-113', type: 'B2B', segment: 'Adulto', channel: 'B2B', currency: 'USD', cost: 1180, price: 1360, validFrom: '2026-01-01', validTo: '2027-03-31', season: 'TMP-02', status: 'vigente' }
    ],
    availabilityModel: 'POR_FECHA', departures: [],
    availability: { ranges: [
      { id: 'RG-1101', from: '2026-10-02', to: '2026-10-06', status: 'disponible', capacityPerDay: 12, note: 'Salidas diarias' },
      { id: 'RG-1102', from: '2026-10-07', to: '2026-10-09', status: 'cerrado', capacityPerDay: 0, note: 'Ocupado: grupo privado con toda la capacidad de guías' },
      { id: 'RG-1103', from: '2026-10-10', to: '2026-10-14', status: 'disponible', capacityPerDay: 12, note: '' },
      { id: 'RG-1104', from: '2026-10-15', to: '2026-10-31', status: 'disponible', capacityPerDay: 8, note: 'Capacidad reducida' },
      { id: 'RG-1105', from: '2026-11-01', to: '2026-11-15', status: 'cerrado', capacityPerDay: 0, note: 'Temporada de huelgas anunciadas en Puno: sin salidas' },
      { id: 'RG-1106', from: '2026-11-16', to: '2026-12-20', status: 'disponible', capacityPerDay: 12, note: '' }
    ], weekdays: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 48 },
    paxRules: { adultMinAge: 11, childMinAge: 4, childMaxAge: 10, childPays: true, childPricePct: 73, infantMaxAge: 3, infantPays: false, maxChildrenPerAdult: 2, maxInfantsPerAdult: 1, minAdults: 1, note: 'Los infantes (0–3 años) no pagan tour ni asiento; comparten habitación y cama con un adulto.' },
    addons: [
      { id: 'ADD-1101', name: 'Museo Larco (Lima)', category: 'Museo', price: 50, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
      { id: 'ADD-1102', name: 'Monasterio de Santa Catalina (Arequipa)', category: 'Museo', price: 40, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
      { id: 'ADD-1103', name: 'Museo Santuarios Andinos (Arequipa)', category: 'Museo', price: 20, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
      { id: 'ADD-1104', name: 'Cañón del Colca 2D/1N (extensión)', category: 'Extensión', price: 120, currency: 'USD', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
      { id: 'ADD-1105', name: 'Cena show en Puno', category: 'Experiencia', price: 30, currency: 'USD', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true },
      { id: 'ADD-1106', name: 'Entrada a Huayna Picchu', category: 'Entrada', price: 75, currency: 'PEN', per: 'pax', appliesTo: ['ADT', 'CHD'], optional: true }
    ],
    accommodation: { optional: true, note: 'Precio por habitación y noche, desayuno incluido. Los infantes comparten cama.', legs: [
      { id: 'LEG-1', city: 'Lima', destId: 'D14', nights: 1, minNights: 1, maxNights: 3, hotels: [
        { id: 'H-LIM-3', name: 'Hotel Miraflores Park Inn (3*)', category: '3 estrellas', rooms: [{ type: 'Simple', capacity: 1, price: 70 }, { type: 'Doble', capacity: 2, price: 85 }, { type: 'Triple', capacity: 3, price: 110 }] },
        { id: 'H-LIM-4', name: 'Hotel Costa Verde Suites (4*)', category: '4 estrellas', seasonRates: [{ from: '2026-12-20', to: '2027-01-05', pct: 20, label: 'Fiestas' }], rooms: [{ type: 'Simple', capacity: 1, price: 115 }, { type: 'Doble', capacity: 2, price: 135 }, { type: 'Triple', capacity: 3, price: 170 }] }] },
      { id: 'LEG-2', city: 'Arequipa', destId: 'D11', nights: 2, minNights: 1, maxNights: 4, hotels: [
        { id: 'H-AQP-3', name: 'Casona del Sillar (3*)', category: '3 estrellas', rooms: [{ type: 'Simple', capacity: 1, price: 55 }, { type: 'Doble', capacity: 2, price: 68 }, { type: 'Triple', capacity: 3, price: 90 }] },
        { id: 'H-AQP-4', name: 'Hotel Misti Colonial (4*)', category: '4 estrellas', rooms: [{ type: 'Simple', capacity: 1, price: 90 }, { type: 'Doble', capacity: 2, price: 105 }, { type: 'Triple', capacity: 3, price: 135 }] }] },
      { id: 'LEG-3', city: 'Puno', destId: 'D09', nights: 2, minNights: 1, maxNights: 3, hotels: [
        { id: 'H-PUN-3', name: 'Posada del Titicaca (3*)', category: '3 estrellas', seasonRates: [{ from: '2027-02-01', to: '2027-02-15', pct: 35, label: 'Fiesta de la Candelaria' }], rooms: [{ type: 'Simple', capacity: 1, price: 50 }, { type: 'Doble', capacity: 2, price: 62 }, { type: 'Triple', capacity: 3, price: 80 }] },
        { id: 'H-PUN-4', name: 'Titicaca Lodge Uros (4*)', category: '4 estrellas', providerId: 'PRV-011', seasonRates: [{ from: '2027-02-01', to: '2027-02-15', pct: 35, label: 'Fiesta de la Candelaria' }], rooms: [{ type: 'Doble', capacity: 2, price: 120 }, { type: 'Triple', capacity: 3, price: 150 }] }] },
      { id: 'LEG-4', city: 'Cusco', destId: 'D04', nights: 4, minNights: 3, maxNights: 6, hotels: [
        { id: 'H-CUS-3', name: 'Hostal Valle Inka (3*)', category: '3 estrellas', providerId: 'PRV-003', seasonRates: [{ from: '2026-06-01', to: '2026-08-31', pct: 20, label: 'Temporada alta' }], rooms: [{ type: 'Simple', capacity: 1, price: 48 }, { type: 'Doble', capacity: 2, price: 60 }, { type: 'Triple', capacity: 3, price: 78 }] },
        { id: 'H-CUS-4', name: 'Hotel Tambo Real Cusco (4*)', category: '4 estrellas', providerId: 'PRV-001', seasonRates: [{ from: '2026-06-01', to: '2026-08-31', pct: 25, label: 'Temporada alta' }, { from: '2026-12-20', to: '2027-01-05', pct: 30, label: 'Fiestas' }], rooms: [{ type: 'Simple', capacity: 1, price: 85 }, { type: 'Doble', capacity: 2, price: 95 }, { type: 'Triple', capacity: 3, price: 125 }] },
        { id: 'H-CUS-5', name: 'Hotel Piedra Viva Boutique (5*)', category: '5 estrellas', providerId: 'PRV-002', seasonRates: [{ from: '2026-06-01', to: '2026-08-31', pct: 25, label: 'Temporada alta' }, { from: '2026-12-20', to: '2027-01-05', pct: 30, label: 'Fiestas' }], rooms: [{ type: 'Doble', capacity: 2, price: 180 }, { type: 'Triple', capacity: 3, price: 230 }] }] }
    ], currency: 'USD' },
    /* v2.8 · Viaje por tramos (spec 21): tours opcionales por ciudad y movilidad entre ciudades y local.
       dayOffset = día dentro del tramo (0 = día de llegada). pricing 'pax' (adulto/niño) o 'vehiculo' (por tamaño de grupo). */
    trip: { currency: 'USD', note: 'Elija noches y hotel por ciudad, sume tours y movilidad. Los infantes no pagan tours ni movilidad.', tours: [
        { id: 'TT-LIM-1', legId: 'LEG-1', name: 'Tour gastronómico en Barranco', dayOffset: 0, time: '18:30', hours: 3, priceAdt: 65, priceChd: 40, capacity: 12, providerId: 'PRV-004', inTrip: true },
        { id: 'TT-AQP-1', legId: 'LEG-2', name: 'Campiña de Arequipa y Mansión del Fundador', dayOffset: 1, time: '09:00', hours: 4, priceAdt: 35, priceChd: 22, capacity: 20, inTrip: true },
        { id: 'TT-AQP-2', legId: 'LEG-2', name: 'Rafting en el río Chili', dayOffset: 1, time: '14:00', hours: 3, priceAdt: 45, priceChd: 0, minAge: 12, capacity: 10, inTrip: true },
        { id: 'TT-PUN-1', legId: 'LEG-3', name: 'Kayak al amanecer en el Titicaca', dayOffset: 1, time: '06:00', hours: 2.5, priceAdt: 40, priceChd: 25, capacity: 8, inTrip: true },
        { id: 'TT-PUN-2', legId: 'LEG-3', name: 'Islas Amantaní y Taquile (día completo)', dayOffset: 1, time: '07:30', hours: 9, priceAdt: 55, priceChd: 35, capacity: 25, inTrip: false },
        { id: 'TT-CUS-1', legId: 'LEG-4', name: 'Montaña de Colores (Vinicunca)', dayOffset: 2, time: '04:00', hours: 12, priceAdt: 48, priceChd: 30, minAge: 8, capacity: 16, providerId: 'PRV-004', inTrip: true },
        { id: 'TT-CUS-2', legId: 'LEG-4', name: 'Valle Sagrado VIP con almuerzo', dayOffset: 1, time: '08:00', hours: 10, priceAdt: 60, priceChd: 42, capacity: 18, inTrip: true },
        { id: 'TT-CUS-3', legId: 'LEG-4', name: 'Clase de cocina andina y mercado San Pedro', dayOffset: 3, time: '10:00', hours: 3.5, priceAdt: 50, priceChd: 30, capacity: 10, inTrip: true }
      ], transport: [
        { id: 'TR-LIM-AQP-V', fromLegId: 'LEG-1', toLegId: 'LEG-2', kind: 'Vuelo', name: 'Vuelo Lima → Arequipa (económica)', pricing: 'pax', priceAdt: 95, priceChd: 85, hours: 1.5 },
        { id: 'TR-LIM-AQP-B', fromLegId: 'LEG-1', toLegId: 'LEG-2', kind: 'Bus', name: 'Bus cama Lima → Arequipa (nocturno)', pricing: 'pax', priceAdt: 45, priceChd: 35, hours: 16 },
        { id: 'TR-AQP-PUN-B', fromLegId: 'LEG-2', toLegId: 'LEG-3', kind: 'Bus', name: 'Bus turístico Arequipa → Puno (con paradas)', pricing: 'pax', priceAdt: 40, priceChd: 30, hours: 6 },
        { id: 'TR-AQP-PUN-P', fromLegId: 'LEG-2', toLegId: 'LEG-3', kind: 'Privado', name: 'Movilidad privada Arequipa → Puno', pricing: 'vehiculo', vehicles: [{ name: 'Auto (1–3)', maxPax: 3, price: 220 }, { name: 'Van (4–10)', maxPax: 10, price: 340 }], hours: 5.5 },
        { id: 'TR-PUN-CUS-T', fromLegId: 'LEG-3', toLegId: 'LEG-4', kind: 'Tren', name: 'Tren Titicaca Puno → Cusco', pricing: 'pax', priceAdt: 290, priceChd: 220, hours: 10 },
        { id: 'TR-PUN-CUS-B', fromLegId: 'LEG-3', toLegId: 'LEG-4', kind: 'Bus', name: 'Bus turístico Ruta del Sol Puno → Cusco', pricing: 'pax', priceAdt: 55, priceChd: 40, hours: 10 },
        { id: 'TL-LIM-APT', fromLegId: 'LEG-1', toLegId: null, kind: 'Traslado', name: 'Traslado aeropuerto ↔ hotel en Lima', pricing: 'vehiculo', vehicles: [{ name: 'Auto (1–3)', maxPax: 3, price: 30 }, { name: 'Van (4–10)', maxPax: 10, price: 55 }], hours: 1 },
        { id: 'TL-CUS-DAY', fromLegId: 'LEG-4', toLegId: null, kind: 'Movilidad local', name: 'Movilidad privada en Cusco por un día (8 h)', pricing: 'vehiculo', vehicles: [{ name: 'Auto (1–3)', maxPax: 3, price: 90 }, { name: 'Van (4–10)', maxPax: 10, price: 150 }], hours: 8 }
      ] },
    payment: { modes: ['total', 'adelanto'], depositPct: 30, balanceDueDays: 30, note: 'El saldo se cobra 30 días antes de la salida.' },
    pickup: { required: true, askFlight: true, points: ['Aeropuerto Jorge Chávez, Lima (indique vuelo)', 'Hotel en Miraflores o Barranco', 'Hotel en el Centro de Lima'] },
    related: [{ productId: 'PRD-001', relation: 'Complementario' }], channels: { erp: true, crm: true, quotes: true, b2b: true, portal: true, cms: true, ecommerce: true, mobile: true },
    versions: [{ v: '1.0', date: '2026-09-30', user: 'U02', reason: 'Creación con alojamiento opcional por ciudad', status: 'vigente' }], promotions: [], b2b: [], seo: { title: 'Circuito Perú Clásico 10 días: Lima, Arequipa, Puno y Cusco', description: 'Circuito de 10 días con alojamiento opcional por ciudad.', slug: 'peru-clasico-10d9n' }, faqs: [{ q: '¿Puedo reservar sin hoteles?', a: 'Sí. El alojamiento es opcional y se elige por ciudad.' }], hue: 214
  });

  /* ================= Centro de reglas configurables por tenant =================
     Cada regla puede activarse/desactivarse desde Administración › Reglas de reserva.
     scope: dónde aplica · productOverride: si un producto puede desactivarla o cambiar parámetros. */
  D.settings.bookingRules = [
    { id: 'R-AVAIL-RANGES', group: 'Disponibilidad', name: 'Disponibilidad por rangos de fechas', desc: 'Define periodos disponibles, cerrados u ocupados y agotados por producto (p. ej. disponible 02–06 oct, ocupado 07–09 oct).', enabled: true, params: {}, scope: ['Catálogo', 'Sitio web', 'Widget', 'Cotizaciones', 'Reservas'], productOverride: true },
    { id: 'R-CUTOFF', group: 'Disponibilidad', name: 'Anticipación mínima de reserva', desc: 'Bloquea fechas dentro de las horas de anticipación del producto.', enabled: true, params: { defaultHours: 48 }, scope: ['Sitio web', 'Widget', 'B2B'], productOverride: true },
    { id: 'R-WEEKDAYS', group: 'Disponibilidad', name: 'Días de operación por semana', desc: 'El producto solo se vende los días de la semana configurados.', enabled: true, params: {}, scope: ['Sitio web', 'Widget'], productOverride: true },
    { id: 'R-HOLD', group: 'Disponibilidad', name: 'Bloqueo temporal de cupos en el carrito', desc: 'Reserva los cupos mientras el cliente paga.', enabled: true, params: { minutes: 30 }, scope: ['Sitio web', 'Widget'], productOverride: false },
    { id: 'R-MIN-GROUP', group: 'Disponibilidad', name: 'Grupo mínimo para garantizar la salida', desc: 'Si no se alcanza el mínimo X días antes, la salida se reprograma o reembolsa.', enabled: false, params: { minPax: 2, decisionDays: 3 }, scope: ['Operaciones', 'Sitio web'], productOverride: true },
    { id: 'R-MIN-ADULTS', group: 'Pasajeros', name: 'Adulto responsable obligatorio', desc: 'Toda reserva requiere al menos un adulto.', enabled: true, params: { minAdults: 1, adultMinAge: 11 }, scope: ['Sitio web', 'Widget', 'Cotizaciones', 'B2B'], productOverride: true },
    { id: 'R-CHILD-PER-ADULT', group: 'Pasajeros', name: 'Límite de niños que pagan por adulto', desc: 'Niños de 4 a 10 años (configurable) pagan tarifa de niño; máximo N por adulto.', enabled: true, params: { childMinAge: 4, childMaxAge: 10, maxChildrenPerAdult: 2, childPricePct: 70 }, scope: ['Sitio web', 'Widget', 'Cotizaciones', 'B2B'], productOverride: true },
    { id: 'R-INFANT-FREE', group: 'Pasajeros', name: 'Infantes sin costo y límite por adulto', desc: 'Menores de 3 años (configurable) no pagan y comparten asiento/cama; máximo N por adulto.', enabled: true, params: { infantMaxAge: 3, maxInfantsPerAdult: 1 }, scope: ['Sitio web', 'Widget', 'Cotizaciones', 'B2B'], productOverride: true },
    { id: 'R-MAX-PAX', group: 'Pasajeros', name: 'Máximo de pasajeros por reserva', desc: 'Grupos mayores se derivan a cotización a medida.', enabled: true, params: { max: 16 }, scope: ['Sitio web', 'Widget'], productOverride: true },
    { id: 'R-COMPANIONS', group: 'Pasajeros', name: 'Datos de acompañantes', desc: 'Solicita nombre, documento, nacionalidad, fecha de nacimiento y parentesco de cada acompañante.', enabled: true, params: { when: 'al_reservar', daysBeforeIfLater: 7, requireDocument: true }, scope: ['Sitio web', 'Widget', 'Portal cliente'], productOverride: true },
    { id: 'R-ALTITUDE', group: 'Pasajeros', name: 'Declaración de salud para altura', desc: 'Casilla de declaración y recomendación médica en tours sobre 3 500 m s. n. m. (sin registrar diagnósticos).', enabled: false, params: { minAltitude: 3500 }, scope: ['Sitio web', 'Widget'], productOverride: true },
    { id: 'R-LODGING', group: 'Alojamiento', name: 'Alojamiento opcional por ciudad', desc: 'El cliente elige hotel, tipo y número de habitaciones por ciudad; se muestran total de habitaciones y noches.', enabled: true, params: {}, scope: ['Sitio web', 'Widget', 'Cotizaciones'], productOverride: true },
    { id: 'R-LODGING-CAPACITY', group: 'Alojamiento', name: 'Validar camas suficientes', desc: 'Las habitaciones elegidas deben alojar a adultos y niños; los infantes comparten cama.', enabled: true, params: {}, scope: ['Sitio web', 'Widget', 'Cotizaciones'], productOverride: false },
    { id: 'R-SINGLE-SUPP', group: 'Alojamiento', name: 'Suplemento de habitación simple', desc: 'Cobra un recargo cuando un adulto viaja solo en habitación simple.', enabled: false, params: { pct: 40 }, scope: ['Sitio web', 'Cotizaciones'], productOverride: true },
    { id: 'R-ADDONS', group: 'Adicionales', name: 'Adicionales (entradas a museos, extensiones, comidas)', desc: 'Permite agregar servicios opcionales por pasajero o por reserva.', enabled: true, params: {}, scope: ['Sitio web', 'Widget', 'Cotizaciones', 'Portal cliente'], productOverride: true },
    { id: 'R-PROMO', group: 'Precios', name: 'Códigos promocionales', desc: 'Acepta cupones de descuento vigentes.', enabled: true, params: {}, scope: ['Sitio web', 'Widget'], productOverride: false },
    { id: 'R-GROUP-DISC', group: 'Precios', name: 'Descuento por grupo', desc: 'Descuento automático desde N pasajeros que pagan.', enabled: false, params: { fromPax: 6, pct: 5 }, scope: ['Sitio web', 'Widget', 'Cotizaciones'], productOverride: true },
    { id: 'R-EARLY-BIRD', group: 'Precios', name: 'Descuento por reserva anticipada', desc: 'Descuento si se reserva con X días o más de anticipación.', enabled: false, params: { days: 60, pct: 7 }, scope: ['Sitio web', 'Widget'], productOverride: true },
    { id: 'R-LAST-MINUTE', group: 'Precios', name: 'Recargo de última hora', desc: 'Recargo si se reserva con menos de X días.', enabled: false, params: { days: 3, pct: 10 }, scope: ['Sitio web', 'Widget'], productOverride: true },
    { id: 'R-SEASON', group: 'Precios', name: 'Factor de temporada', desc: 'Aplica el factor de la temporada vigente en la fecha del servicio.', enabled: true, params: {}, scope: ['Sitio web', 'Widget', 'Cotizaciones'], productOverride: false },
    { id: 'R-MULTICURRENCY', group: 'Monedas y pagos', name: 'Mostrar precios en varias monedas', desc: 'El cliente elige la moneda de visualización; se cobra en las monedas de cobro configuradas.', enabled: true, params: { fxMarginPct: 2 }, scope: ['Sitio web', 'Widget', 'Portal cliente'], productOverride: false },
    { id: 'R-DEPOSIT', group: 'Monedas y pagos', name: 'Pago con adelanto (porcentaje)', desc: 'Permite pagar un porcentaje al reservar y el saldo antes del viaje.', enabled: true, params: { pct: 30, balanceDueDays: 15 }, scope: ['Sitio web', 'Widget', 'Portal cliente', 'B2B'], productOverride: true },
    { id: 'R-PAY-LATER', group: 'Monedas y pagos', name: 'Reservar ahora, pagar después', desc: 'Reserva sin pago con bloqueo de cupos por X horas; se libera si no se paga.', enabled: false, params: { holdHours: 24 }, scope: ['Sitio web', 'Widget'], productOverride: true },
    { id: 'R-PAY-FEE', group: 'Monedas y pagos', name: 'Recargo por medio de pago', desc: 'Traslada al cliente un % por pago con tarjeta (verificar normativa y contrato con la pasarela).', enabled: false, params: { cardPct: 3.5 }, scope: ['Sitio web', 'Widget'], productOverride: false },
    { id: 'R-PREVIEW-REMOVE', group: 'Checkout', name: 'Previsualización con opción de quitar ítems', desc: 'Antes de pagar, el cliente revisa el resumen y puede quitar adicionales y alojamiento.', enabled: true, params: {}, scope: ['Sitio web', 'Widget'], productOverride: false },
    { id: 'R-PICKUP', group: 'Checkout', name: 'Punto de partida / recojo obligatorio', desc: 'Solicita punto de recojo o dirección del hotel, y vuelo de llegada si aplica.', enabled: true, params: { askFlight: true }, scope: ['Sitio web', 'Widget', 'Portal cliente'], productOverride: true },
    { id: 'R-COMMENTS', group: 'Checkout', name: 'Comentarios del cliente', desc: 'Campo libre para pedidos especiales (dietas, celebraciones, accesibilidad).', enabled: true, params: { maxChars: 1000 }, scope: ['Sitio web', 'Widget', 'Portal cliente'], productOverride: false },
    { id: 'R-NOMINATIVE', group: 'Checkout', name: 'Documento obligatorio para entradas nominativas', desc: 'Exige documento de todos los pasajeros cuando el producto incluye entradas nominativas (Machu Picchu).', enabled: true, params: {}, scope: ['Sitio web', 'Operaciones'], productOverride: true },
    { id: 'R-PAX-MESSAGES', group: 'Comunicación', name: 'Mensajes automáticos al pasajero', desc: 'Envía mensajes programados (confirmación, previaje, día del servicio, postviaje).', enabled: true, params: {}, scope: ['Comunicaciones'], productOverride: false },
    { id: 'R-PAX-FEEDBACK', group: 'Comunicación', name: 'Comentarios del pasajero desde su panel', desc: 'El pasajero envía comentarios o incidencias durante y después del viaje.', enabled: true, params: {}, scope: ['Portal pasajero', 'App pasajero'], productOverride: false },
    { id: 'R-REVIEW-INVITE', group: 'Comunicación', name: 'Invitación a reseña externa', desc: 'Tras el viaje invita a dejar reseña en TripAdvisor, Trustpilot o Google (según integración activa).', enabled: false, params: { daysAfter: 2 }, scope: ['Comunicaciones', 'Reseñas'], productOverride: false }
  ];

  /* ================= v2.2 · Planes de demostración para reglas y tipos de cambio DEMO =================
     Todo lo de este bloque es de PRUEBA y editable desde la consola de plataforma y la administración. */
  const PLAN_ORDER = ['Starter', 'Professional', 'Enterprise'];
  const minPlan = {
    'R-AVAIL-RANGES': 'Starter', 'R-CUTOFF': 'Starter', 'R-WEEKDAYS': 'Starter', 'R-HOLD': 'Starter', 'R-MIN-ADULTS': 'Starter', 'R-CHILD-PER-ADULT': 'Starter', 'R-INFANT-FREE': 'Starter',
    'R-MAX-PAX': 'Starter', 'R-COMPANIONS': 'Starter', 'R-PROMO': 'Starter', 'R-SEASON': 'Starter', 'R-DEPOSIT': 'Starter', 'R-PREVIEW-REMOVE': 'Starter', 'R-PICKUP': 'Starter', 'R-COMMENTS': 'Starter',
    'R-MIN-GROUP': 'Professional', 'R-ALTITUDE': 'Professional', 'R-LODGING': 'Professional', 'R-LODGING-CAPACITY': 'Professional', 'R-SINGLE-SUPP': 'Professional', 'R-ADDONS': 'Professional',
    'R-GROUP-DISC': 'Professional', 'R-EARLY-BIRD': 'Professional', 'R-LAST-MINUTE': 'Professional', 'R-MULTICURRENCY': 'Professional', 'R-NOMINATIVE': 'Professional', 'R-PAX-MESSAGES': 'Professional', 'R-PAX-FEEDBACK': 'Professional', 'R-OWN-REVIEWS': 'Professional',
    'R-PAY-LATER': 'Enterprise', 'R-PAY-FEE': 'Enterprise', 'R-REVIEW-INVITE': 'Enterprise', 'R-TRIP-BUILDER': 'Professional', 'R-IN-TRIP-SALES': 'Professional'
  };
  D.settings.bookingRules.push({ id: 'R-OWN-REVIEWS', group: 'Comunicación', name: 'Reseñas propias verificadas', desc: 'Solicita calificación y reseña a los pasajeros después del viaje; se moderan y publican en el sitio y el widget con sello de «viaje verificado».', enabled: true, params: { daysAfter: 1, minStarsAutoPublish: 4, moderation: true }, scope: ['Portal pasajero', 'Sitio web', 'Widget', 'Reseñas'], productOverride: true });
  D.settings.bookingRules.push({ id: 'R-TRIP-BUILDER', group: 'Alojamiento', name: 'Viaje por tramos', desc: 'El cliente elige cuántas noches pasa en cada ciudad (dentro del mínimo y máximo del tramo), el hotel con tarifa por fecha y suma tours y movilidad por ciudad. El total se separa en alojamiento, tours, movilidad y adicionales.', enabled: true, params: {}, scope: ['Sitio web', 'Widget', 'Cotizaciones'], productOverride: true });   // v2.8 · spec 21
  D.settings.bookingRules.push({ id: 'R-IN-TRIP-SALES', group: 'Comunicación', name: 'Venta durante el viaje', desc: 'El pasajero ve y compra tours y movilidad de los tramos que le quedan desde su portal o por WhatsApp con un link de pago; el proveedor confirma desde la extranet.', enabled: true, params: { minHoursBefore: 12 }, scope: ['Portal pasajero', 'WhatsApp'], productOverride: true });   // v2.8 · spec 21
  D.settings.bookingRules.forEach(r => { r.minPlan = minPlan[r.id] || 'Starter'; });
  D.planCatalogDemo = { isDemo: true, note: 'Planes, precios y límites de PRUEBA para validar el modelo; se reemplazarán por los definitivos.', order: PLAN_ORDER };

  /* ---------------- v2.8 · Vitrina gratuita, pases, add-ons, pasarelas, SEO y aventuras (spec 22) ----------------
     La vitrina es de la PLATAFORMA (dominio propio, multi-agencia); lo demás es del tenant. */
  D.showcase = {
    brand: 'Rutas Libres Perú', domain: 'rutaslibres.pe', domainNote: 'Nombre y dominio provisionales: se eligen con el equipo SEO antes del lanzamiento.',
    rules: { freeMonthlyBookings: 30, feePerAttendee: 2, feeCurrency: 'PEN', commissionPct: { none: 8, Starter: 5, Professional: 4, Enterprise: 3 } },
    cities: [
      { id: 'lima', name: 'Lima', zones: ['Centro Histórico', 'Miraflores', 'Barranco'] },
      { id: 'cusco', name: 'Cusco', zones: ['Centro Histórico', 'San Blas', 'Valle Sagrado'] },
      { id: 'arequipa', name: 'Arequipa', zones: ['Centro Histórico', 'Yanahuara'] },
      { id: 'puno', name: 'Puno', zones: ['Puerto', 'Centro'] }
    ],
    themes: ['Historia', 'Gastronomía', 'Arte urbano', 'Naturaleza', 'Mercados', 'Nocturno'],
    agencies: [
      { id: 'SHA-01', tenantId: 'TNT-0001', name: 'Andes Horizonte Travel', city: 'lima', plan: 'Enterprise', verified: true, rating: 4.8, reviews: 412, since: '2026-06-01', color: '#1560B8', site: 'reservas.andeshorizonte.pe' },
      { id: 'SHA-02', tenantId: 'TNT-0005', name: 'Ruta Norte Turismo', city: 'lima', plan: 'Pase 30 días', verified: true, rating: 4.6, reviews: 38, since: '2026-09-12', color: '#0E8A6A', site: null },
      { id: 'SHA-03', tenantId: null, name: 'Lima a Pie Free Walking', city: 'lima', plan: 'Vitrina gratis', verified: true, rating: 4.7, reviews: 1290, since: '2026-07-04', color: '#C2410C', site: null },
      { id: 'SHA-04', tenantId: null, name: 'Cusco Libre Tours', city: 'cusco', plan: 'Vitrina gratis', verified: true, rating: 4.9, reviews: 2210, since: '2026-06-20', color: '#7C3AED', site: null },
      { id: 'SHA-05', tenantId: null, name: 'Misti Walkers Arequipa', city: 'arequipa', plan: 'Vitrina gratis', verified: false, rating: 4.5, reviews: 186, since: '2026-08-18', color: '#B45309', site: null },
      { id: 'SHA-06', tenantId: null, name: 'Titicaca Andino', city: 'puno', plan: 'Vitrina gratis', verified: true, rating: 4.6, reviews: 97, since: '2026-09-02', color: '#0369A1', site: null }
    ],
    listings: [
      { id: 'SHL-001', agencyId: 'SHA-03', slug: 'centro-historico-de-lima-gratis', title: 'Free tour Centro Histórico de Lima', city: 'lima', zone: 'Centro Histórico', theme: 'Historia', langs: ['es', 'en'], times: ['10:00', '15:00'], hours: 2.5, meeting: 'Parque Kennedy, frente a la iglesia Virgen Milagrosa (salida en bus público)', model: 'propina', price: 0, rating: 4.8, reviews: 860, status: 'publicado', featured: true, capacity: 25, highlights: ['Plaza Mayor y Palacio de Gobierno', 'Catacumbas por fuera y balcones coloniales', 'Degustación de pisco sour (opcional)'] },
      { id: 'SHL-002', agencyId: 'SHA-03', slug: 'barranco-arte-urbano-gratis', title: 'Free tour Barranco y arte urbano', city: 'lima', zone: 'Barranco', theme: 'Arte urbano', langs: ['es', 'en'], times: ['16:00'], hours: 2, meeting: 'Plaza de Barranco, junto a la biblioteca municipal', model: 'propina', price: 0, rating: 4.7, reviews: 430, status: 'publicado', featured: false, capacity: 20, highlights: ['Puente de los Suspiros', 'Murales y galerías', 'Atardecer en el mirador'] },
      { id: 'SHL-003', agencyId: 'SHA-01', slug: 'miraflores-malecon-gratis', title: 'Free tour Miraflores y malecón', city: 'lima', zone: 'Miraflores', theme: 'Historia', langs: ['es', 'en', 'pt'], times: ['09:30'], hours: 2, meeting: 'Parque del Amor, junto a la escultura El Beso', model: 'propina', price: 0, rating: 4.8, reviews: 212, status: 'publicado', featured: true, capacity: 20, highlights: ['Huaca Pucllana por fuera', 'Malecón y parapentes', 'Recomendaciones de cevicherías'] },
      { id: 'SHL-004', agencyId: 'SHA-01', slug: 'tour-gastronomico-barranco', title: 'Tour gastronómico en Barranco (de pago)', city: 'lima', zone: 'Barranco', theme: 'Gastronomía', langs: ['es', 'en'], times: ['18:30'], hours: 3, meeting: 'Plaza de Barranco', model: 'pago', price: 243, currency: 'PEN', rating: 4.9, reviews: 96, status: 'publicado', featured: false, capacity: 12, productId: 'PRD-011', highlights: ['5 paradas con degustación', 'Cevichería, picantería y bar de pisco', 'Grupo reducido'] },
      { id: 'SHL-005', agencyId: 'SHA-02', slug: 'lima-nocturna-gratis', title: 'Lima nocturna: plazas iluminadas', city: 'lima', zone: 'Centro Histórico', theme: 'Nocturno', langs: ['es'], times: ['19:00'], hours: 2, meeting: 'Plaza San Martín, frente al monumento', model: 'propina', price: 0, rating: 4.6, reviews: 38, status: 'publicado', featured: false, capacity: 20, highlights: ['Circuito Mágico del Agua (entrada aparte)', 'Barrio Chino', 'Historias de la Lima virreinal'] },
      { id: 'SHL-006', agencyId: 'SHA-04', slug: 'cusco-centro-historico-gratis', title: 'Free tour Cusco: Centro Histórico y San Blas', city: 'cusco', zone: 'Centro Histórico', theme: 'Historia', langs: ['es', 'en'], times: ['10:00', '13:30', '16:00'], hours: 2.5, meeting: 'Plaza de Armas, bajo el portal de Panes (paraguas amarillo)', model: 'propina', price: 0, rating: 4.9, reviews: 1810, status: 'publicado', featured: true, capacity: 30, highlights: ['Muro de los 12 ángulos', 'Barrio de San Blas', 'Mirador y tienda de textiles'] },
      { id: 'SHL-007', agencyId: 'SHA-04', slug: 'mercado-san-pedro-gratis', title: 'Mercado San Pedro y comida local', city: 'cusco', zone: 'Centro Histórico', theme: 'Mercados', langs: ['es', 'en'], times: ['11:00'], hours: 2, meeting: 'Puerta principal del mercado San Pedro', model: 'propina', price: 0, rating: 4.8, reviews: 400, status: 'publicado', featured: false, capacity: 15, highlights: ['Frutas andinas', 'Jugos y caldos', 'Cacao y café'] },
      { id: 'SHL-008', agencyId: 'SHA-01', slug: 'valle-sagrado-vip', title: 'Valle Sagrado VIP con almuerzo (de pago)', city: 'cusco', zone: 'Valle Sagrado', theme: 'Naturaleza', langs: ['es', 'en'], times: ['08:00'], hours: 10, meeting: 'Recojo en hotel del centro de Cusco', model: 'pago', price: 448, currency: 'PEN', rating: 4.8, reviews: 140, status: 'publicado', featured: true, capacity: 16, productId: 'PRD-011', highlights: ['Pisac y Ollantaytambo', 'Almuerzo buffet', 'Guía bilingüe'] },
      { id: 'SHL-009', agencyId: 'SHA-05', slug: 'arequipa-ciudad-blanca-gratis', title: 'Free tour Arequipa, la Ciudad Blanca', city: 'arequipa', zone: 'Centro Histórico', theme: 'Historia', langs: ['es', 'en'], times: ['10:00', '15:00'], hours: 2.5, meeting: 'Plaza de Armas, junto a la fuente', model: 'propina', price: 0, rating: 4.5, reviews: 150, status: 'publicado', featured: false, capacity: 25, highlights: ['Monasterio de Santa Catalina por fuera', 'Sillar y casonas', 'Mirador de Yanahuara'] },
      { id: 'SHL-010', agencyId: 'SHA-05', slug: 'picanterias-arequipa', title: 'Ruta de picanterías arequipeñas', city: 'arequipa', zone: 'Yanahuara', theme: 'Gastronomía', langs: ['es'], times: ['12:30'], hours: 3, meeting: 'Mirador de Yanahuara', model: 'propina', price: 0, rating: 4.4, reviews: 36, status: 'en_revision', featured: false, capacity: 12, highlights: ['Rocoto relleno', 'Chicha de guiñapo', 'Historia de las picanteras'] },
      { id: 'SHL-011', agencyId: 'SHA-06', slug: 'puno-lago-titicaca-gratis', title: 'Free tour Puno y bahía del Titicaca', city: 'puno', zone: 'Puerto', theme: 'Naturaleza', langs: ['es', 'en'], times: ['09:00'], hours: 2, meeting: 'Muelle de Puno, caseta de información', model: 'propina', price: 0, rating: 4.6, reviews: 97, status: 'publicado', featured: false, capacity: 20, highlights: ['Malecón Bahía de los Incas', 'Mirador Kuntur Wasi', 'Leyendas del lago'] },
      { id: 'SHL-012', agencyId: 'SHA-06', slug: 'puno-noche-folklorica', title: 'Noche folclórica en Puno', city: 'puno', zone: 'Centro', theme: 'Nocturno', langs: ['es'], times: ['19:30'], hours: 2, meeting: 'Jr. Lima, frente a la catedral', model: 'propina', price: 0, rating: 0, reviews: 0, status: 'rechazado', rejectReason: 'Fotos con marca de agua de otra agencia. Suba fotos propias.', featured: false, capacity: 30, highlights: ['Danzas de la Candelaria', 'Música en vivo'] }
    ],
    bookings: [
      { id: 'SHB-0141', listingId: 'SHL-003', date: '2026-09-28', time: '09:30', name: 'Laura Gómez', email: 'laura.g@correo.com', pax: 2, lang: 'es', status: 'asistio', fee: 0, createdAt: '2026-09-25 21:10', source: 'Google orgánico' },
      { id: 'SHB-0142', listingId: 'SHL-004', date: '2026-09-28', time: '18:30', name: 'Tom Becker', email: 'tbecker@mail.de', pax: 2, lang: 'en', status: 'asistio', amount: 486, currency: 'PEN', commissionPct: 3, fee: 14.58, createdAt: '2026-09-26 10:02', source: 'Blog: qué comer en Lima' },
      { id: 'SHB-0143', listingId: 'SHL-003', date: '2026-09-30', time: '09:30', name: 'Ana Paula Ribeiro', email: 'apr@mail.br', pax: 3, lang: 'pt', status: 'confirmada', fee: 0, createdAt: '2026-09-27 18:44', source: 'Google orgánico' },
      { id: 'SHB-0144', listingId: 'SHL-008', date: '2026-10-02', time: '08:00', name: 'Marco Rossi', email: 'mrossi@mail.it', pax: 2, lang: 'en', status: 'confirmada', amount: 896, currency: 'PEN', commissionPct: 3, fee: 26.88, createdAt: '2026-09-28 09:15', source: 'Instagram' },
      { id: 'SHB-0145', listingId: 'SHL-003', date: '2026-09-27', time: '09:30', name: 'Diego Paredes', email: 'dparedes@correo.pe', pax: 1, lang: 'es', status: 'no_show', fee: 0, createdAt: '2026-09-26 22:30', source: 'Directo' },
      { id: 'SHB-0146', listingId: 'SHL-005', date: '2026-09-29', time: '19:00', name: 'Sofía Herrera', email: 'sofia.h@correo.com', pax: 4, lang: 'es', status: 'confirmada', fee: 0, createdAt: '2026-09-28 13:00', source: 'Google orgánico' },
      { id: 'SHB-0147', listingId: 'SHL-006', date: '2026-09-29', time: '10:00', name: 'Emily Clark', email: 'eclark@mail.uk', pax: 2, lang: 'en', status: 'confirmada', fee: 4, createdAt: '2026-09-27 08:20', source: 'Google orgánico' }
    ],
    posts: [
      { id: 'SHP-001', slug: 'free-tours-en-lima-guia', title: 'Free tours en Lima: guía 2026 por barrio', excerpt: 'Centro, Miraflores y Barranco a pie: horarios, puntos de encuentro y cuánta propina dejar.', city: 'lima', keyword: 'free tour lima', status: 'publicado', publishedAt: '2026-08-20', author: 'Equipo SEO', words: 1850, seoScore: 92, clicks: 3120, impressions: 48200, position: 6.4 },
      { id: 'SHP-002', slug: 'que-comer-en-lima-en-un-dia', title: 'Qué comer en Lima en un día (sin gastar de más)', excerpt: 'Ruta de mercados, cevicherías y picanterías, con tours gastronómicos recomendados.', city: 'lima', keyword: 'qué comer en lima', status: 'publicado', publishedAt: '2026-09-05', author: 'Equipo SEO', words: 1420, seoScore: 88, clicks: 1460, impressions: 30100, position: 9.1 },
      { id: 'SHP-003', slug: 'cusco-en-3-dias-a-pie', title: 'Cusco en 3 días a pie: free tours y miradores', excerpt: 'Itinerario para aclimatarse, con free tours por San Blas y el mercado San Pedro.', city: 'cusco', keyword: 'free walking tour cusco', status: 'publicado', publishedAt: '2026-09-15', author: 'Equipo SEO', words: 2100, seoScore: 90, clicks: 980, impressions: 22400, position: 11.3 },
      { id: 'SHP-004', slug: 'cuanta-propina-free-tour-peru', title: '¿Cuánta propina dejar en un free tour en Perú?', excerpt: 'Montos de referencia por ciudad y por qué el modelo de propina funciona.', city: null, keyword: 'propina free tour', status: 'borrador', publishedAt: null, author: 'Equipo SEO', words: 900, seoScore: 71, clicks: 0, impressions: 0, position: null }
    ],
    funnel: [
      { month: '2026-07', visits: 6400, bookings: 410, agencies: 3, trials: 0, paid: 0 },
      { month: '2026-08', visits: 14800, bookings: 1120, agencies: 5, trials: 1, paid: 0 },
      { month: '2026-09', visits: 27300, bookings: 2090, agencies: 6, trials: 2, paid: 1 }
    ],
    benefits: [
      ['Vitrina gratis', 'Publique free tours sin costo y reciba reservas con nombre y correo.'],
      ['Su propio sitio web', 'Dominio propio con SSL, blog y herramientas SEO para que Google lo encuentre.'],
      ['Venda más en cada viaje', 'Armador de viajes por tramos, venta en ruta y paquetes con hotel por ciudad.'],
      ['Cobre como quiera', 'Tarjeta, Yape o PayPal; el reporte muestra la comisión de cada pasarela y su neto.'],
      ['Todo en un panel', 'Reservas, proveedores, pagos y rentabilidad en un mismo lugar.']
    ]
  };
  D.accessPasses = [
    { id: 'PASE-0001', tenantId: 'TNT-0005', name: 'Pase Básico 30 días', from: '2026-09-12', to: '2026-10-12', price: 0, currency: 'PEN', reason: 'Agencia captada en la vitrina (Lima nocturna)', features: ['crm', 'catalog', 'quotes', 'reservations', 'finance_basic', 'portal_client', 'cms', 'custom_domain'], status: 'activo', createdBy: 'U16', createdAt: '2026-09-12 10:30', convertTo: 'Starter' },
    { id: 'PASE-0002', tenantId: 'TNT-0006', name: 'Pase Básico 30 días', from: '2026-07-01', to: '2026-07-31', price: 149, currency: 'PEN', reason: 'Prueba pagada antes de suscribirse', features: ['crm', 'catalog', 'quotes', 'reservations', 'finance_basic'], status: 'vencido', createdBy: 'U16', createdAt: '2026-07-01 09:00', convertTo: 'Starter' }
  ];
  D.addonCatalogV28 = [
    { key: 'paypal_gateway', label: 'Cobros con PayPal', billing: 'unico', price: 149, priceMonth: null, desc: 'Conexión de la cuenta PayPal de la agencia, conciliación y reporte de comisiones. Pago único.' },
    { key: 'trip_builder', label: 'Armador de viajes por tramos', billing: 'ambos', price: 690, priceMonth: 89, desc: 'Noches por ciudad, tarifas por fecha, tours y movilidad por tramo, venta en ruta.' },
    { key: 'seo_pro', label: 'SEO y blog de aventuras', billing: 'ambos', price: 490, priceMonth: 69, desc: 'Auditoría SEO por página, redirecciones, sitemap, datos estructurados y blog de aventuras con clientes.' },
    { key: 'showcase_boost', label: 'Destacado en la vitrina', billing: 'mensual', price: null, priceMonth: 39, desc: 'Sus tours aparecen primero en su ciudad y en el blog de la vitrina.' },
    { key: 'custom_domain', label: 'Dominio propio + SSL', billing: 'ambos', price: 290, priceMonth: 45, desc: 'Sitio y portales bajo el dominio de la agencia (CNAME + SSL automático).' }
  ];
  D.gateways = [
    { id: 'GW-01', provider: 'Pasarela local (tarjetas)', status: 'activo', mode: 'producción', account: 'Comercio 4402118', currency: 'PEN', feePct: 3.99, feeFixed: 0, feeCurrency: 'PEN', taxOnFee: true, settleDays: 2, passFee: false },
    { id: 'GW-02', provider: 'PayPal', status: 'activo', mode: 'producción', account: 'pagos@andeshorizonte.pe', currency: 'USD', feePct: 5.4, feeFixed: 0.3, feeCurrency: 'USD', fxSpreadPct: 3.5, taxOnFee: false, settleDays: 0, passFee: false, note: 'Comisión referencial para cobros internacionales; se toma del reporte de PayPal en cada transacción.' },
    { id: 'GW-03', provider: 'Yape / Plin (QR)', status: 'activo', mode: 'producción', account: 'Cuenta empresa BCP', currency: 'PEN', feePct: 0, feeFixed: 0, feeCurrency: 'PEN', taxOnFee: false, settleDays: 0, passFee: false }
  ];
  D.gatewayTxns = [
    { id: 'GTX-0101', gatewayId: 'GW-01', paymentId: 'PAG-01912', resId: 'RES-2026-000346', date: '2026-09-10', gross: 431, currency: 'USD', fee: 17.2, tax: 3.1, net: 410.7, status: 'liquidado', ref: 'TXN 7710-CC12' },
    { id: 'GTX-0102', gatewayId: 'GW-01', paymentId: 'PAG-01915', resId: 'RES-2026-000347', date: '2026-08-28', gross: 2716, currency: 'USD', fee: 108.37, tax: 19.51, net: 2588.12, status: 'liquidado', ref: 'TXN 8812-AA90' },
    { id: 'GTX-0103', gatewayId: 'GW-02', paymentId: 'PAG-01930', resId: 'RES-2026-000361', date: '2026-08-30', gross: 2486, currency: 'USD', fee: 134.54, tax: 0, net: 2351.46, status: 'liquidado', ref: 'PAYID-NB7Q2KA' },
    { id: 'GTX-0104', gatewayId: 'GW-03', paymentId: 'PAG-01921', resId: 'RES-2026-000344', date: '2026-09-25', gross: 400, currency: 'USD', fee: 0, tax: 0, net: 400, status: 'liquidado', ref: 'YP 44910022' }
  ];
  D.siteDomains = [
    { id: 'DOM-01', host: 'www.andeshorizonte.pe', kind: 'principal', status: 'verificado', dns: 'CNAME → sites.kipucontrol.com', ssl: 'emitido', sslUntil: '2026-12-28', verifiedAt: '2026-04-03' },
    { id: 'DOM-02', host: 'reservas.andeshorizonte.pe', kind: 'reservas', status: 'verificado', dns: 'CNAME → sites.kipucontrol.com', ssl: 'emitido', sslUntil: '2026-12-28', verifiedAt: '2026-04-03' },
    { id: 'DOM-03', host: 'blog.andeshorizonte.pe', kind: 'blog', status: 'pendiente_dns', dns: 'TXT kipu-verify=ah-7f21c9 · CNAME → sites.kipucontrol.com', ssl: 'pendiente', sslUntil: null, verifiedAt: null }
  ];
  D.seoPages = [
    { id: 'SEO-01', path: '/', title: 'Andes Horizonte Travel | Tours y paquetes por el Perú', desc: 'Tours, paquetes y viajes a medida por el Perú con precios web y disponibilidad en línea.', h1: 1, words: 820, images: 14, alt: 14, schema: 'TravelAgency', canonical: true, indexable: true, speed: 91, keyword: 'agencia de viajes perú', clicks: 2210, position: 8.2 },
    { id: 'SEO-02', path: '/tour/peru-clasico-10d9n', title: 'Perú Clásico 10D/9N: Lima, Arequipa, Puno y Cusco', desc: 'Circuito de 10 días con hotel por ciudad, tours y movilidad a elección.', h1: 1, words: 1240, images: 9, alt: 9, schema: 'TouristTrip, Offer', canonical: true, indexable: true, speed: 86, keyword: 'paquete perú 10 días', clicks: 640, position: 12.5 },
    { id: 'SEO-03', path: '/tour/machu-picchu-full-day', title: 'Machu Picchu Full Day', desc: '', h1: 1, words: 610, images: 8, alt: 5, schema: 'TouristTrip', canonical: true, indexable: true, speed: 74, keyword: 'machu picchu full day', clicks: 1890, position: 7.4 },
    { id: 'SEO-04', path: '/blog/que-llevar-a-machu-picchu', title: 'Qué llevar a Machu Picchu: lista completa', desc: 'Lista de equipaje por temporada, documentos y altura.', h1: 2, words: 1600, images: 6, alt: 6, schema: 'Article', canonical: true, indexable: true, speed: 88, keyword: 'qué llevar a machu picchu', clicks: 920, position: 5.9 },
    { id: 'SEO-05', path: '/ofertas-old', title: 'Ofertas', desc: '', h1: 0, words: 90, images: 2, alt: 0, schema: '', canonical: false, indexable: true, speed: 62, keyword: '', clicks: 12, position: 48 }
  ];
  D.redirects = [
    { id: 'RED-01', from: '/ofertas-old', to: '/ofertas', code: 301, hits: 214, status: 'activo' },
    { id: 'RED-02', from: '/tours/machupicchu', to: '/tour/machu-picchu-full-day', code: 301, hits: 1880, status: 'activo' }
  ];
  D.travelStories = [
    { id: 'AVT-001', slug: 'familia-rios-peru-clasico', title: 'Diez días, cuatro ciudades: la familia Ríos en el Perú Clásico', clientId: 'CLI-0001', resId: 'RES-2026-000361', city: 'Arequipa', status: 'publicado', consent: { at: '2026-09-29 08:40', by: 'Gabriela Ríos Montoya', channel: 'Portal cliente', photos: true, name: 'solo nombre' }, photos: 6, quote: 'El bus con paradas a Puno fue lo mejor: vimos vicuñas y la laguna Lagunillas.', publishedAt: '2026-09-29', seoScore: 84, views: 312, linkedProduct: 'PRD-011' },
    { id: 'AVT-002', slug: 'sophie-humantay', title: 'Sophie y la laguna Humantay al amanecer', clientId: 'CLI-0006', resId: 'RES-2026-000346', city: 'Cusco', status: 'pendiente_consentimiento', consent: null, photos: 4, quote: 'Subir a 4 200 m valió cada paso.', publishedAt: null, seoScore: 62, views: 0, linkedProduct: 'PRD-004' },
    { id: 'AVT-003', slug: 'incentivo-mineros-cusco', title: 'Incentivo corporativo: 12 colaboradores en Cusco', clientId: 'CLI-0002', resId: 'RES-2026-000348', city: 'Cusco', status: 'borrador', consent: { at: '2026-09-20 11:00', by: 'Úrsula Benavides Lara', channel: 'Correo firmado', photos: true, name: 'sin nombres de personas' }, photos: 10, quote: 'Organización impecable de principio a fin.', publishedAt: null, seoScore: 70, views: 0, linkedProduct: null }
  ];
  D.receivables.push({ id: 'CXC-00730', resId: 'RES-2026-000361', clientId: 'CLI-0001', concept: 'Pago total — pedido web WEB-2026-00961', amount: 2486, currency: 'USD', due: '2026-08-30', paid: 2486, status: 'pagada', kind: 'total' });
  D.payments.push({ id: 'PAG-01930', receivableId: 'CXC-00730', resId: 'RES-2026-000361', method: 'PayPal', amount: 2486, currency: 'USD', date: '2026-08-30', status: 'aplicado', ref: 'PAYID-NB7Q2KA', by: 'Sistema', gatewayFee: 134.54, net: 2351.46 });
  /* ---------------------------------------------------------------- v2.9 · Plantillas web y contenido con IA (spec 23) */
  D.addonCatalogV28.push(
    { key: 'ai_content', label: 'Contenido con IA', billing: 'mensual', price: null, priceMonth: 59, desc: '300 créditos al mes: mejorar descripciones de tours, metadatos SEO, traducciones, relatos de aventura y artículos del blog. Usted revisa antes de publicar.' },
    { key: 'ai_images', label: 'Imágenes con IA', billing: 'ambos', price: 39, priceMonth: 49, desc: 'Paquete de 20 imágenes (pago único) o 30 al mes, para tours, banners y blog, con texto alternativo y etiqueta «Imagen generada con IA».' },
    { key: 'premium_template', label: 'Plantilla premium', billing: 'unico', price: 290, priceMonth: null, desc: 'Diseño de autor para el sitio web (p. ej. Nazca Noche). Pago único por plantilla; las incluidas no tienen costo.' }
  );
  D.aiPlans = [
    { code: 'IA-BASICO', name: 'IA Básico', price: 59, billing: 'mensual', content: 300, images: 0, addon: 'ai_content', features: ['300 créditos de contenido al mes', 'Mejorar textos, SEO y traducciones (ES, EN, PT)', 'Relatos de aventura desde la reserva'] },
    { code: 'IA-PRO', name: 'IA Pro', price: 149, billing: 'mensual', content: 1000, images: 30, addon: 'ai_content', features: ['1 000 créditos de contenido al mes', '30 imágenes al mes', 'Artículos de blog completos con enlaces a sus tours', 'Tono de marca guardado'] }
  ];
  D.aiCreditPacks = [
    { code: 'IA-CONT-EXTRA-200', name: '200 créditos de contenido', kind: 'contenido', credits: 200, price: 39, billing: 'unico' },
    { code: 'IA-IMG-20', name: '20 imágenes', kind: 'imagenes', credits: 20, price: 39, billing: 'unico' },
    { code: 'IA-IMG-60', name: '60 imágenes', kind: 'imagenes', credits: 60, price: 99, billing: 'unico' },
    { code: 'IA-IMG-MES', name: '30 imágenes al mes', kind: 'imagenes', credits: 30, price: 49, billing: 'mensual' }
  ];
  D.aiCreditCost = { mejorar_texto: 2, meta_seo: 1, traducir: 3, relato_aventura: 4, articulo: 8, imagen: 1, imagen_hd: 2 };
  D.aiCredits = {
    plan: 'Enterprise', planIncluded: { contenido: 100, imagenes: 0 }, addons: ['IA-BASICO'],
    balance: { contenido: 342, imagenes: 14 },
    ledger: [
      { id: 'ICL-0101', at: '2026-10-01 00:00', kind: 'contenido', movement: 'asignacion_plan', credits: 100, balance: 100, note: 'Incluido en el plan Enterprise' },
      { id: 'ICL-0102', at: '2026-10-01 00:00', kind: 'contenido', movement: 'asignacion_plan', credits: 300, balance: 400, note: 'Add-on IA Básico (mensual)' },
      { id: 'ICL-0103', at: '2026-10-08 11:20', kind: 'imagenes', movement: 'compra_paquete', credits: 20, balance: 20, note: 'Paquete IA-IMG-20 · S/ 39 · FAC-PLT-2026-0412' },
      { id: 'ICL-0104', at: '2026-10-21 09:40', kind: 'contenido', movement: 'consumo', credits: -40, balance: 360, note: '18 pedidos de texto y SEO' },
      { id: 'ICL-0105', at: '2026-10-28 16:05', kind: 'imagenes', movement: 'consumo', credits: -6, balance: 14, note: 'IAC-0043 · 4 imágenes (2 HD)' },
      { id: 'ICL-0106', at: '2026-10-30 10:12', kind: 'contenido', movement: 'consumo', credits: -18, balance: 342, note: 'IAC-0040 a IAC-0042' }
    ]
  };
  D.aiJobs = [
    { id: 'IAC-0042', kind: 'meta_seo', target: 'pagina', targetId: '/tours/laguna-humantay-full-day', targetLabel: 'Laguna Humantay Full Day (página)', locale: 'es', tone: 'aventurero', status: 'listo', credits: 1, at: '2026-10-30 10:12', by: 'U02',
      before: { title: 'Laguna Humantay Full Day', desc: 'Tour a la laguna Humantay.' },
      after: { title: 'Laguna Humantay Full Day desde Cusco | Andes Horizonte', desc: 'Camine a la laguna turquesa a 4 200 m con guía, desayuno y almuerzo. Salida 4:00 a. m. desde su hotel en Cusco. Reserve en línea.' } },
    { id: 'IAC-0041', kind: 'mejorar_texto', target: 'producto', targetId: 'PRD-003', targetLabel: 'Machu Picchu 2D/1N con noche en Aguas Calientes', locale: 'es', tone: 'cercano', status: 'aplicado', credits: 2, at: '2026-10-30 09:58', by: 'U02', appliedAt: '2026-10-30 10:03',
      before: { text: 'Tour de 2 días a Machu Picchu con noche en Aguas Calientes. Incluye tren, bus y entrada.' },
      after: { text: 'Viva Machu Picchu sin prisas: el primer día viaja en tren por el valle del Urubamba y duerme en Aguas Calientes; al amanecer del segundo sube en el primer bus y recorre la ciudadela con su guía antes de que llegue la multitud. Tren, bus, entrada y hotel incluidos.' } },
    { id: 'IAC-0040', kind: 'traducir', target: 'producto', targetId: 'PRD-004', targetLabel: 'Laguna Humantay Full Day → inglés', locale: 'en', tone: 'aventurero', status: 'aplicado', credits: 3, at: '2026-10-29 17:30', by: 'U01', appliedAt: '2026-10-29 17:41',
      before: { text: 'Caminata a la laguna Humantay con desayuno y almuerzo buffet.' }, after: { text: 'Hike to turquoise Humantay Lake with breakfast and buffet lunch included.' } },
    { id: 'IAC-0043', kind: 'imagen', target: 'libre', targetLabel: 'Banner de temporada (4 imágenes)', locale: 'es', status: 'listo', credits: 6, at: '2026-10-28 16:05', by: 'U01',
      prompt: 'Grupo de viajeros caminando por el camino inca al amanecer, montañas nevadas al fondo, luz cálida, estilo fotográfico', style: 'fotografico' },
    { id: 'IAC-0039', kind: 'relato_aventura', target: 'historia', targetId: 'AVT-002', targetLabel: 'Sophie y la laguna Humantay al amanecer', locale: 'es', tone: 'cercano', status: 'descartado', credits: 4, at: '2026-10-27 12:10', by: 'U02',
      before: { text: 'Notas del guía: clienta francesa, llegó primera a la laguna, foto con el nevado.' }, after: { text: 'A las 9:40, Sophie fue la primera del grupo en llegar…' } }
  ];
  D.aiImages = [
    { id: 'IMG-0014', jobId: 'IAC-0043', alt: 'Viajeros en el camino inca al amanecer con nevados al fondo', style: 'fotografico', hd: true, status: 'en_uso', usedIn: ['Banner de inicio'], hue: 18, credits: 2 },
    { id: 'IMG-0015', jobId: 'IAC-0043', alt: 'Grupo de caminantes en un sendero andino con luz cálida', style: 'fotografico', hd: true, status: 'generada', usedIn: [], hue: 32, credits: 2 },
    { id: 'IMG-0016', jobId: 'IAC-0043', alt: 'Vista amplia de montañas nevadas y un sendero de piedra', style: 'fotografico', hd: false, status: 'generada', usedIn: [], hue: 205, credits: 1 },
    { id: 'IMG-0017', jobId: 'IAC-0043', alt: 'Silueta de viajeros contra el cielo naranja del amanecer', style: 'fotografico', hd: false, status: 'descartada', usedIn: [], hue: 350, credits: 1 }
  ];
  D.siteTemplates = [
    { id: 'TPL-ANDES', slug: 'andes-clasico', name: 'Andes Clásico', category: 'agencia', tier: 'incluida', price: 0, version: '3.0.0', status: 'publicado', author: 'Equipo KipuControl', authorKind: 'equipo', isDefault: true, installs: 41, minPlan: null,
      desc: 'Versión 3.0 diseñada en Stitch: azul marino y dorado, títulos con serif, hero centrado con buscador de vidrio, destinos en mosaico, salidas en tabla y Libro de Reclamaciones destacado.', tags: ['Paquetes', 'Multidestino', 'Recomendada', 'Nuevo 3.0'],
      tokens: { side: '#0F2747', accent: '#0E5DB5', soft: '#E3EEFB', sun: '#F2B33D', radius: 12, font: { display: 'Noto Serif', body: 'Plus Jakarta Sans' } }, lh: { perf: 94, a11y: 100, seo: 100, bp: 96 }, sections: ['hero_buscador', 'destinos', 'mas_vendidos', 'salidas', 'ofertas', 'resenas', 'blog', 'boletin'] },
    { id: 'TPL-INTI', slug: 'inti-raymi', name: 'Inti Raymi', category: 'agencia', tier: 'incluida', price: 0, version: '1.4.0', status: 'publicado', author: 'Equipo KipuControl', authorKind: 'equipo', isDefault: false, installs: 17, minPlan: null,
      desc: 'Rojo carmín y dorado del sol, bandas textiles y esquinas escalonadas. Para agencias de cultura y fiestas.', tags: ['Cultura', 'Peruano', 'Textil'],
      tokens: { side: '#7E1526', accent: '#C8102E', soft: '#FBEDE6', sun: '#E3A33B', radius: 18 }, lh: { perf: 92, a11y: 98, seo: 100, bp: 96 }, sections: ['hero_buscador', 'destinos', 'mas_vendidos', 'resenas', 'aventuras', 'blog'] },
    { id: 'TPL-AMAZONIA', slug: 'amazonia', name: 'Amazonía', category: 'aventura', tier: 'incluida', price: 0, version: '1.1.2', status: 'publicado', author: 'Equipo KipuControl', authorKind: 'equipo', isDefault: false, installs: 9, minPlan: null,
      desc: 'Verdes profundos y acentos de guacamayo. Foto grande, itinerario día por día y nivel de dificultad visible.', tags: ['Aventura', 'Naturaleza', 'Trekking'],
      tokens: { side: '#0F3D2E', accent: '#1F7A4D', soft: '#E3F3EA', sun: '#F2A93B', radius: 14 }, lh: { perf: 91, a11y: 97, seo: 100, bp: 96 }, sections: ['hero_video', 'experiencias', 'mas_vendidos', 'salidas', 'resenas', 'blog'] },
    { id: 'TPL-PACIFICO', slug: 'pacifico', name: 'Pacífico', category: 'corporativo', tier: 'incluida', price: 0, version: '1.0.4', status: 'publicado', author: 'Equipo KipuControl', authorKind: 'equipo', isDefault: false, installs: 6, minPlan: 'Professional',
      desc: 'Azul océano y arena, tipografía limpia y mucho aire. Para viajes corporativos, incentivos y MICE.', tags: ['Corporativo', 'MICE', 'Minimalista'],
      tokens: { side: '#0B2E4A', accent: '#1F5F8B', soft: '#E4EFF7', sun: '#D9B27A', radius: 8 }, lh: { perf: 97, a11y: 100, seo: 100, bp: 100 }, sections: ['hero_simple', 'servicios', 'casos', 'cotizar', 'clientes', 'blog'] },
    { id: 'TPL-CHAKANA', slug: 'chakana-free-tours', name: 'Chakana Free Tours', category: 'free_tour', tier: 'incluida', price: 0, version: '1.0.0', status: 'publicado', author: 'Equipo KipuControl', authorKind: 'equipo', isDefault: false, installs: 4, minPlan: null,
      desc: 'Pensada para free tours: horarios del día primero, reserva con nombre y correo, punto de encuentro con mapa y propina sugerida.', tags: ['Free tours', 'Guías', 'Móvil primero'],
      tokens: { side: '#3A1208', accent: '#B8432E', soft: '#FBEAE2', sun: '#E3A33B', radius: 20 }, lh: { perf: 98, a11y: 100, seo: 100, bp: 100 }, sections: ['horarios_hoy', 'tours', 'punto_encuentro', 'resenas', 'blog'] },
    { id: 'TPL-NAZCA', slug: 'nazca-noche', name: 'Nazca Noche', category: 'lujo', tier: 'premium', price: 290, version: '1.2.0', status: 'publicado', author: 'Estudio Wayra (partner)', authorKind: 'partner', isDefault: false, installs: 3, minPlan: 'Starter',
      desc: 'Fondo oscuro, líneas geométricas inspiradas en las líneas de Nazca y fotografía a pantalla completa. Para viajes de lujo y a medida.', tags: ['Lujo', 'A medida', 'Premium'],
      tokens: { side: '#14110F', accent: '#B8935A', soft: '#2A241D', sun: '#D9B27A', radius: 4 }, lh: { perf: 89, a11y: 96, seo: 100, bp: 92 }, sections: ['hero_foto', 'colecciones', 'a_medida', 'testimonios', 'prensa'] },
    { id: 'TPL-QHAPAQ', slug: 'qhapaq-nan', name: 'Qhapaq Ñan', category: 'multi', tier: 'premium', price: 290, version: '1.0.0', status: 'en_revision', author: 'Estudio Wayra (partner)', authorKind: 'partner', isDefault: false, installs: 0, minPlan: 'Starter',
      desc: 'Mapa de rutas como protagonista: el viajero arma su circuito sobre el camino inca. Pensada para el armador de viajes por tramos.', tags: ['Circuitos', 'Mapa', 'Tramos'],
      tokens: { side: '#2B2A1F', accent: '#8C6D2C', soft: '#F3ECDD', sun: '#C9A24A', radius: 10 }, lh: { perf: 88, a11y: 96, seo: 100, bp: 92 }, sections: ['mapa_rutas', 'armar_viaje', 'mas_vendidos', 'resenas'] }
  ];
  D.siteTheme = { templateId: 'TPL-ANDES', version: '2.3.0', chosenBy: 'alta', appliedAt: '2026-06-01 10:00', appliedBy: 'U01', overrides: {}, history: [
    { templateId: 'TPL-ANDES', version: '2.2.0', from: '2026-03-10', to: '2026-06-01', by: 'Plataforma (alta)' }
  ] };
  D.templateSubmissions = [
    { id: 'TSB-0007', templateId: 'TPL-QHAPAQ', version: '1.0.0', by: 'Estudio Wayra (partner)', at: '2026-10-28 15:20', status: 'validando',
      checks: { manifest: 'ok', build: 'ok', lighthouse: { perf: 88, a11y: 96, seo: 100, bp: 92 }, contraste: 'ok', i18n: 'ok', datos_estructurados: 'ok', seguridad: 'ok', revision_visual: 'pendiente' } },
    { id: 'TSB-0006', templateId: 'TPL-NAZCA', version: '1.2.0', by: 'Estudio Wayra (partner)', at: '2026-10-12 11:00', status: 'aprobada', decidedAt: '2026-10-14 09:30', reviewer: 'U16',
      checks: { manifest: 'ok', build: 'ok', lighthouse: { perf: 89, a11y: 96, seo: 100, bp: 92 }, contraste: 'ok', i18n: 'ok', datos_estructurados: 'ok', seguridad: 'ok', revision_visual: 'ok' } },
    { id: 'TSB-0005', templateId: 'TPL-PACIFICO', version: '1.1.0', by: 'Equipo KipuControl', at: '2026-10-05 18:40', status: 'rechazada', decidedAt: '2026-10-06 10:15', reviewer: 'U16',
      reason: 'Contraste del botón secundario 3,1:1 (mínimo 4,5:1) y LCP de 3,4 s en móvil (máximo 2,5 s).',
      checks: { manifest: 'ok', build: 'ok', lighthouse: { perf: 78, a11y: 91, seo: 100, bp: 96 }, contraste: 'falla', i18n: 'ok', datos_estructurados: 'ok', seguridad: 'ok', revision_visual: 'pendiente' } }
  ];
  D.tenantThemes = [
    { tenantId: 'TNT-0001', tenant: 'Andes Horizonte Travel S.A.C.', templateId: 'TPL-ANDES', version: '2.3.0', chosenBy: 'alta' },
    { tenantId: 'TNT-0002', tenant: 'Selva Viva Expediciones E.I.R.L.', templateId: 'TPL-AMAZONIA', version: '1.1.2', chosenBy: 'agencia' },
    { tenantId: 'TNT-0003', tenant: 'Costa Sur DMC S.A.C.', templateId: 'TPL-NAZCA', version: '1.2.0', chosenBy: 'agencia' },
    { tenantId: 'TNT-0004', tenant: 'Altiplano Corporate Travel S.A.', templateId: 'TPL-PACIFICO', version: '1.0.4', chosenBy: 'admin_plataforma' },
    { tenantId: 'TNT-0005', tenant: 'Ruta Norte Turismo S.A.C.', templateId: 'TPL-INTI', version: '1.4.0', chosenBy: 'alta' },
    { tenantId: 'TNT-0006', tenant: 'Nevados Tours S.R.L.', templateId: 'TPL-ANDES', version: '2.3.0', chosenBy: 'alta' }
  ];
  /* ---------------------------------------------------------------- v2.10 · Blog en Payload, seguimiento, conversiones y visitas (spec 24) */
  D.addonCatalogV28.push(
    { key: 'marketing_pro', label: 'Marketing Pro', billing: 'mensual', price: null, priceMonth: 39, desc: 'Para Starter: todos los píxeles (Google Ads, TikTok, LinkedIn, Clarity), conversiones del lado del servidor, scripts propios y visitas de 13 meses con exportación.' }
  );
  D.trackingProviders = [
    { id: 'ga4', name: 'Google Analytics 4', short: 'GA4', idLabel: 'ID de medición', placeholder: 'G-XXXXXXXXXX', re: '^G-[A-Z0-9]{6,12}$', consent: 'analiticas', color: '#E37400', server: 'Measurement Protocol', minPlan: 'Starter' },
    { id: 'gtm', name: 'Google Tag Manager', short: 'GTM', idLabel: 'ID del contenedor', placeholder: 'GTM-XXXXXXX', re: '^GTM-[A-Z0-9]{4,10}$', consent: 'analiticas', color: '#246FDB', server: null, minPlan: 'Starter' },
    { id: 'google_ads', name: 'Google Ads', short: 'Ads', idLabel: 'ID de conversión', placeholder: 'AW-123456789', re: '^AW-[0-9]{6,12}$', consent: 'marketing', color: '#1A73E8', server: 'Google Ads API (conversiones mejoradas)', minPlan: 'Professional' },
    { id: 'meta_pixel', name: 'Meta Pixel (Facebook e Instagram)', short: 'Meta', idLabel: 'ID del píxel', placeholder: '123456789012345', re: '^[0-9]{10,20}$', consent: 'marketing', color: '#0866FF', server: 'Conversions API', minPlan: 'Starter' },
    { id: 'tiktok', name: 'TikTok Pixel', short: 'TikTok', idLabel: 'ID del píxel', placeholder: 'CXXXXXXXXXXXX', re: '^[A-Za-z0-9_-]{4,40}$', consent: 'marketing', color: '#111111', server: 'Events API', minPlan: 'Professional' },
    { id: 'clarity', name: 'Microsoft Clarity', short: 'Clarity', idLabel: 'ID del proyecto', placeholder: 'abcd1234ef', re: '^[A-Za-z0-9_-]{4,40}$', consent: 'analiticas', color: '#5E5BE6', server: null, minPlan: 'Professional' },
    { id: 'linkedin', name: 'LinkedIn Insight Tag', short: 'LinkedIn', idLabel: 'Partner ID', placeholder: '1234567', re: '^[A-Za-z0-9_-]{4,40}$', consent: 'marketing', color: '#0A66C2', server: null, minPlan: 'Professional' },
    { id: 'script', name: 'Script propio', short: 'Script', idLabel: '', placeholder: '', re: '', consent: 'marketing', color: '#7A5C2E', server: null, minPlan: 'Professional' }
  ];
  D.trackingEvents = [
    { id: 'compra', label: 'Compra confirmada', ga4: 'purchase', value: true },
    { id: 'compra_pendiente', label: 'Compra pendiente (Yape o transferencia)', ga4: 'purchase_pending', value: true },
    { id: 'inicio_pago', label: 'Inicio de pago', ga4: 'begin_checkout', value: true },
    { id: 'lead_cotizacion', label: 'Pedido de viaje a medida', ga4: 'generate_lead', value: false },
    { id: 'lead_contacto', label: 'Formulario de contacto', ga4: 'generate_lead', value: false },
    { id: 'chat_web', label: 'Chat web iniciado', ga4: 'generate_lead', value: false },
    { id: 'registro_cliente', label: 'Cuenta de cliente creada', ga4: 'sign_up', value: false },
    { id: 'suscripcion_boletin', label: 'Suscripción al boletín', ga4: 'sign_up_newsletter', value: false },
    { id: 'clic_whatsapp', label: 'Clic en WhatsApp', ga4: 'contact_whatsapp', value: false }
  ];
  D.trackingTags = [
    { id: 'TAG-0001', provider: 'ga4', name: 'Analytics del sitio', mid: 'G-AH7K2M9Q1T', consent: 'analiticas', placement: 'head', pages: '/*', exclude: '', status: 'activo', createdBy: 'U01', approvedBy: null, verifiedAt: '2026-09-28 10:14', verify: 'ok', config: { sendPageView: true } },
    { id: 'TAG-0002', provider: 'meta_pixel', name: 'Pixel de Meta', mid: '738201945563120', consent: 'marketing', placement: 'head', pages: '/*', exclude: '', status: 'activo', createdBy: 'U01', approvedBy: null, verifiedAt: '2026-09-28 10:15', verify: 'ok', config: { capi: true, secret: 'vault://tenant/TNT-0001/meta-capi' } },
    { id: 'TAG-0003', provider: 'google_ads', name: 'Google Ads · campañas Cusco', mid: 'AW-11872034561', consent: 'marketing', placement: 'head', pages: '/*', exclude: '', status: 'activo', createdBy: 'U02', approvedBy: null, verifiedAt: '2026-09-27 18:02', verify: 'ok', config: { enhanced: true, server: true, secret: 'vault://tenant/TNT-0001/google-ads' } },
    { id: 'TAG-0004', provider: 'clarity', name: 'Mapas de calor', mid: 'm3k9x2ah7q', consent: 'analiticas', placement: 'head', pages: '/tours/*', exclude: '', status: 'pausado', createdBy: 'U02', approvedBy: null, verifiedAt: '2026-09-10 09:30', verify: 'ok', config: {} },
    { id: 'TAG-0005', provider: 'script', name: 'Widget de reseñas de TripAdvisor', src: 'https://www.jscache.com/wejs?wtype=selfserveprop&uniq=412', sri: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC', csp: ['www.jscache.com', 'www.tripadvisor.com'], consent: 'marketing', placement: 'body_fin', pages: '/', exclude: '/checkout/*', status: 'activo', createdBy: 'U02', approvedBy: 'U01', approvedAt: '2026-09-15 16:40', verifiedAt: '2026-09-15 16:45', verify: 'ok', config: {} },
    { id: 'TAG-0006', provider: 'script', name: 'Chat de ventas por WhatsApp (proveedor nuevo)', src: 'https://cdn.wachat.example/widget.v2.js', sri: 'sha384-Zr8q3uX1mLw0kP2c8N9tYV5Hj7bD4sQeR6aG1fK0oT3yU8iW2xE5nM9vB7cA4dS1', csp: ['cdn.wachat.example', 'api.wachat.example'], consent: 'marketing', placement: 'body_fin', pages: '/*', exclude: '/checkout/*', status: 'en_revision', createdBy: 'U02', approvedBy: null, verifiedAt: null, verify: null, config: {}, submittedAt: '2026-09-29 08:50' }
  ];
  D.conversionMappings = [
    { id: 'CVM-001', tagId: 'TAG-0001', event: 'compra', providerEvent: 'purchase', label: null, value: true, server: true, active: true },
    { id: 'CVM-002', tagId: 'TAG-0001', event: 'lead_cotizacion', providerEvent: 'generate_lead', label: null, value: false, server: false, active: true },
    { id: 'CVM-003', tagId: 'TAG-0001', event: 'clic_whatsapp', providerEvent: 'contact_whatsapp', label: null, value: false, server: false, active: true },
    { id: 'CVM-004', tagId: 'TAG-0002', event: 'compra', providerEvent: 'Purchase', label: null, value: true, server: true, active: true },
    { id: 'CVM-005', tagId: 'TAG-0002', event: 'lead_cotizacion', providerEvent: 'Lead', label: null, value: false, server: true, active: true },
    { id: 'CVM-006', tagId: 'TAG-0002', event: 'suscripcion_boletin', providerEvent: 'CompleteRegistration', label: null, value: false, server: false, active: true },
    { id: 'CVM-007', tagId: 'TAG-0003', event: 'compra', providerEvent: 'conversion', label: 'kQ3nCPvT9YgZEJ2o', value: true, server: true, active: true },
    { id: 'CVM-008', tagId: 'TAG-0003', event: 'lead_cotizacion', providerEvent: 'conversion', label: 'Xb7mCK2s9YgZEJ2o', value: false, server: false, active: true }
  ];
  D.conversionDispatches = [
    { id: 90412, at: '2026-09-29 09:12', event: 'compra', mappingId: 'CVM-007', channel: 'servidor', status: 'enviado', http: 200, value: 2380, currency: 'PEN', ref: 'WEB-2026-00418', attempts: 1 },
    { id: 90411, at: '2026-09-29 09:12', event: 'compra', mappingId: 'CVM-004', channel: 'servidor', status: 'enviado', http: 200, value: 2380, currency: 'PEN', ref: 'WEB-2026-00418', attempts: 1 },
    { id: 90410, at: '2026-09-29 09:12', event: 'compra', mappingId: 'CVM-004', channel: 'navegador', status: 'duplicado', http: 200, value: 2380, currency: 'PEN', ref: 'WEB-2026-00418', attempts: 1, note: 'Meta lo unió con el envío del servidor (mismo event_id).' },
    { id: 90409, at: '2026-09-29 09:11', event: 'compra', mappingId: 'CVM-001', channel: 'servidor', status: 'enviado', http: 204, value: 2380, currency: 'PEN', ref: 'WEB-2026-00418', attempts: 1 },
    { id: 90402, at: '2026-09-29 08:40', event: 'lead_cotizacion', mappingId: 'CVM-005', channel: 'servidor', status: 'sin_consentimiento', http: null, value: null, currency: null, ref: 'LEAD-0252', attempts: 0, note: 'El visitante rechazó las cookies de marketing.' },
    { id: 90398, at: '2026-09-29 07:55', event: 'compra', mappingId: 'CVM-007', channel: 'servidor', status: 'fallido', http: 401, value: 1460, currency: 'PEN', ref: 'WEB-2026-00417', attempts: 3, error: 'UNAUTHENTICATED: el token de Google Ads venció. Reconecte la cuenta.' },
    { id: 90391, at: '2026-09-28 21:30', event: 'lead_cotizacion', mappingId: 'CVM-008', channel: 'navegador', status: 'enviado', http: 200, value: null, currency: null, ref: 'LEAD-0251', attempts: 1 },
    { id: 90385, at: '2026-09-28 19:04', event: 'compra', mappingId: 'CVM-004', channel: 'servidor', status: 'enviado', http: 200, value: 890, currency: 'USD', ref: 'WEB-2026-00416', attempts: 2 },
    { id: 90377, at: '2026-09-28 16:20', event: 'suscripcion_boletin', mappingId: 'CVM-006', channel: 'navegador', status: 'enviado', http: 200, value: null, currency: null, ref: 'SUB-1180', attempts: 1 }
  ];
  /* Visitas agregadas por día (deterministas, 60 días hasta TODAY) del sitio de la agencia y de la vitrina */
  (function () {
    let s = 11; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const days = (base, amp, n) => { const out = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(2026, 8, 29 - i); const wd = d.getDay(); const v = Math.round(base * (1 + (60 - i) / 160) * (wd === 0 || wd === 6 ? 1.18 : 1) * (0.85 + r() * amp));
      const vis = Math.round(v * (0.78 + r() * 0.06)); const pv = Math.round(v * (2.1 + r() * 0.6)); const conv = Math.max(0, Math.round(v * (0.011 + r() * 0.009)));
      out.push({ d: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), visits: v, visitors: vis, pageviews: pv, bounces: Math.round(v * (0.38 + r() * 0.08)), engaged: Math.round(v * (95 + r() * 40)), conv, rev: Math.round(conv * (1450 + r() * 900)) }); } return out; };
    D.webAnalytics = {
      isDemo: true, cookieless: true, ga4Compare: 0.71,
      days: days(420, 0.3, 60),
      pages: [['/', 'Inicio', 31], ['/tours/machu-picchu-2d', 'Machu Picchu 2 días', 14], ['/destinos/cusco', 'Destino Cusco', 9], ['/tours/valle-sagrado-vip', 'Valle Sagrado VIP', 7], ['/blog/cuando-ir-a-machu-picchu', 'Blog: cuándo ir a Machu Picchu', 6], ['/tours/montana-de-colores', 'Montaña de 7 Colores', 6], ['/viajes-a-medida', 'Viajes a medida', 5], ['/ofertas', 'Ofertas', 4], ['/aventuras/luna-de-miel-en-cusco', 'Aventura: luna de miel', 3], ['/contacto', 'Contacto', 3]],
      sources: [['google', 'organic', '', 38], ['google', 'cpc', 'cusco-septiembre', 17], ['(directo)', '(ninguno)', '', 14], ['instagram', 'paid', 'mp-primavera', 9], ['facebook', 'social', '', 6], ['rutaslibres.pe', 'referral', '', 6], ['whatsapp', 'social', '', 4], ['boletin', 'email', 'newsletter-sep', 3], ['tripadvisor.com', 'referral', '', 2], ['bing', 'organic', '', 1]],
      devices: [['movil', 71], ['escritorio', 25], ['tablet', 4]],
      countries: [['PE', 'Perú', 46], ['US', 'Estados Unidos', 15], ['ES', 'España', 8], ['MX', 'México', 6], ['CL', 'Chile', 5], ['AR', 'Argentina', 4], ['BR', 'Brasil', 4], ['DE', 'Alemania', 3], ['FR', 'Francia', 3], ['ZZ', 'Otros', 6]],
      byEvent: [['compra', 46], ['compra_pendiente', 9], ['lead_cotizacion', 31], ['chat_web', 22], ['clic_whatsapp', 64], ['suscripcion_boletin', 18]],
      live: { now: 17, pages: [['/', 6], ['/tours/machu-picchu-2d', 4], ['/destinos/cusco', 3], ['/ofertas', 2], ['/blog/cuando-ir-a-machu-picchu', 2]] }
    };
    D.platformTracking = {
      tags: [
        { id: 'PTG-0001', site: 'ambos', provider: 'ga4', name: 'GA4 Rutas Libres', mid: 'G-RL4P8N2X6K', consent: 'analiticas', status: 'activo', createdBy: 'Daniela Ccahuana (marketing)', approvedBy: 'U16', verify: 'ok', verifiedAt: '2026-09-28 09:00' },
        { id: 'PTG-0002', site: 'ambos', provider: 'google_ads', name: 'Google Ads · captación de agencias', mid: 'AW-16620045123', consent: 'marketing', status: 'activo', createdBy: 'Daniela Ccahuana (marketing)', approvedBy: 'U16', verify: 'ok', verifiedAt: '2026-09-28 09:02', config: { enhanced: true, server: true } },
        { id: 'PTG-0003', site: 'ambos', provider: 'meta_pixel', name: 'Pixel Meta · viajeros y agencias', mid: '902114577630218', consent: 'marketing', status: 'activo', createdBy: 'Daniela Ccahuana (marketing)', approvedBy: 'U16', verify: 'ok', verifiedAt: '2026-09-28 09:03', config: { capi: true } },
        { id: 'PTG-0004', site: 'blog', provider: 'clarity', name: 'Clarity del blog', mid: 'rl7blog2qz', consent: 'analiticas', status: 'en_revision', createdBy: 'Daniela Ccahuana (marketing)', approvedBy: null, verify: null, verifiedAt: null },
        { id: 'PTG-0005', site: 'vitrina', provider: 'tiktok', name: 'TikTok · free tours Lima', mid: 'CRL8K2M4N6P8Q', consent: 'marketing', status: 'borrador', createdBy: 'U16', approvedBy: null, verify: null, verifiedAt: null }
      ],
      mappings: [
        { tagId: 'PTG-0002', event: 'registro_agencia', providerEvent: 'conversion', label: 'Rq1aCJm7-YgZEKOn', value: false, server: true },
        { tagId: 'PTG-0002', event: 'plan_pagado', providerEvent: 'conversion', label: 'Pt5sCJm7-YgZEKOn', value: true, server: true },
        { tagId: 'PTG-0003', event: 'reserva_vitrina', providerEvent: 'Schedule', label: null, value: false, server: true },
        { tagId: 'PTG-0003', event: 'registro_agencia', providerEvent: 'CompleteRegistration', label: null, value: false, server: true },
        { tagId: 'PTG-0001', event: 'lectura_articulo', providerEvent: 'article_read', label: null, value: false, server: false }
      ],
      sites: { vitrina: days(980, 0.35, 60), blog: days(640, 0.4, 60) },
      agencies: [['SHA-04', 9120, 612], ['SHA-03', 7410, 488], ['SHA-01', 5230, 301], ['SHA-02', 2210, 118], ['SHA-06', 1340, 74], ['SHA-05', 980, 41]],
      sources: [['google', 'organic', '', 52], ['(directo)', '(ninguno)', '', 13], ['google', 'cpc', 'agencias-lima', 11], ['instagram', 'paid', 'free-tours-lima', 8], ['tiktok', 'paid', 'free-tours-lima', 6], ['facebook', 'social', '', 5], ['chatgpt.com', 'referral', '', 3], ['bing', 'organic', '', 2]],
      payload: {
        url: 'https://rutaslibres.pe/admin', version: 'Payload 3 · Next.js 15', db: 'rutaslibres_cms (PostgreSQL)', lastWebhook: '2026-09-29 08:10', webhookOk: true,
        posts: [
          { postId: 'SHP-001', payloadId: '66f1a0c2e4b0a1d2c3f40001', status: 'published', syncedAt: '2026-09-20 11:02', checks: { words: 1640, keyword: true, meta: true, alt: true, tours: 4 } },
          { postId: 'SHP-002', payloadId: '66f1a0c2e4b0a1d2c3f40002', status: 'published', syncedAt: '2026-09-22 15:40', checks: { words: 1210, keyword: true, meta: true, alt: true, tours: 3 } },
          { postId: 'SHP-003', payloadId: '66f1a0c2e4b0a1d2c3f40003', status: 'scheduled', publishAt: '2026-10-02 08:00', syncedAt: '2026-09-29 08:10', checks: { words: 1380, keyword: true, meta: false, alt: true, tours: 3 } },
          { postId: 'SHP-004', payloadId: '66f1a0c2e4b0a1d2c3f40004', status: 'draft', syncedAt: '2026-09-27 10:05', checks: { words: 640, keyword: true, meta: true, alt: false, tours: 0 } }
        ]
      }
    };
  })();
  D.consentPolicy = { version: 'COOK-2026.2', categories: [['necesarias', 'Necesarias', 'Carrito, sesión, idioma y seguridad. Siempre activas.'], ['analiticas', 'Analíticas', 'Nos ayudan a entender qué páginas sirven (Google Analytics, Clarity).'], ['marketing', 'Marketing', 'Miden campañas y muestran anuncios relevantes (Google Ads, Meta, TikTok).']] };
  /* ---------------------------------------------------------------- v2.11 · Blog de Rutas Libres con estructura de Payload (spec 24 §13.1) */
  // Cada entrada replica los campos de la colección `posts` de Payload: categoría, autor, portada con texto
  // alternativo, tabla de contenidos, secciones (bloques) con tours incrustados, consejos, cita, preguntas
  // frecuentes y la pestaña SEO (meta título, meta descripción, palabra clave, canónica, noindex).
  D.showcase.categories = [
    { id: 'guias-de-barrio', name: 'Guías de barrio' }, { id: 'gastronomia', name: 'Gastronomía' },
    { id: 'itinerarios', name: 'Itinerarios' }, { id: 'consejos', name: 'Consejos prácticos' }
  ];
  D.showcase.authors = [
    { id: 'AUT-01', name: 'Valeria Méndez', role: 'Historiadora sanmarquina · redactora de rutas urbanas', verified: true, color: '#1D4ED8', bio: 'Guía oficial con carné MINCETUR desde 2016. Ha recorrido a pie más de 40 distritos de Lima y escribe las guías de barrio de Rutas Libres.' },
    { id: 'AUT-02', name: 'Renzo Quispe', role: 'Cocinero y guía gastronómico', verified: true, color: '#059669', bio: 'Formado en el Cordon Bleu de Lima. Lleva grupos por mercados y picanterías y prueba cada lugar antes de recomendarlo.' },
    { id: 'AUT-03', name: 'Equipo SEO', role: 'Redacción Rutas Libres', verified: false, color: '#64748B', bio: 'Equipo editorial de la plataforma.' }
  ];
  const POSTX = {
    'SHP-001': {
      category: 'guias-de-barrio', authorId: 'AUT-01', keyword: 'free tours en lima', readMinutes: 8, reads: 12800, updatedAt: '2026-10-28',
      kicker: 'Guía de barrio · Lima 2026', titleAccent: 'por barrio',
      cover: { tone: 'lima', alt: 'Malecón de Barranco al atardecer con el océano Pacífico al fondo', caption: 'Vista del malecón y la brisa del Pacífico al final del recorrido libre por Barranco y Miraflores.', credit: 'Archivo Rutas Libres' },
      intro: [
        'Los free tours en Lima son la mejor forma de descubrir una capital que durante décadas fue solo una escala técnica camino al Cusco. Quienes la recorren a pie con historiadores y vecinos encuentran 2 000 años de historia, casonas republicanas y acantilados frente al Pacífico.',
        'El modelo del free walking tour cambió la forma de conocer la capital: reservas gratis, caminas con un guía local y al final dejas la propina que te parezca justa.'
      ],
      sections: [
        { id: 'centro', kicker: 'Barrio 01 · Patrimonio de la Humanidad', h: 'Centro Histórico: conventos, balcones y catacumbas',
          paras: ['Los free tours del casco antiguo giran alrededor de dos ejes: la Plaza San Martín y la Plaza Mayor, con la Catedral y el Palacio de Gobierno.', 'El punto alto es el jirón Ucayali, con sus balcones de cajón tallados en cedro, y la parada en el convento de San Francisco para contar la historia de las catacumbas.'],
          tip: { title: 'Horario recomendado', text: 'Elija la salida de las 10:00: a mediodía verá el cambio de guardia en el Palacio de Gobierno sin el tráfico de la tarde.' }, tours: ['SHL-001', 'SHL-005'] },
        { id: 'barranco', kicker: 'Barrio 02 · Distrito de poetas y muralistas', h: 'Barranco: murales, poesía y atardecer sobre el mar',
          paras: ['Si el centro es la memoria virreinal, Barranco es el lado artístico de Lima: antiguo balneario de la élite, hoy galería de arte urbano al aire libre.', 'Los recorridos parten del Parque Municipal y bajan por la Bajada de Baños hasta el Puente de los Suspiros.'],
          quote: { text: 'El free tour no es un servicio gratis por falta de valor: es la forma de que el viajero premie el conocimiento vivo del guía local.', by: 'Asociación de guías oficiales de turismo del Perú' }, tours: ['SHL-002', 'SHL-004'] },
        { id: 'miraflores', kicker: 'Barrio 03 · Costa verde', h: 'Miraflores y el malecón: Pacífico y huacas prehispánicas',
          paras: ['El malecón une el Parque del Amor con el Faro de la Marina en un paseo de 3 km sobre los acantilados.', 'Muchos tours incluyen la Huaca Pucllana, una pirámide de adobe del año 500 en medio del distrito.'],
          tip: { title: 'Lleve abrigo ligero', text: 'De mayo a octubre la garúa y la brisa marina bajan la temperatura al final de la tarde.' }, tours: ['SHL-003'] },
        { id: 'callao', kicker: 'Barrio 04 · Puerto y fortaleza', h: 'Callao monumental: fortaleza y galerías portuarias',
          paras: ['El Callao Monumental pasó de zona de paso a uno de los barrios de arte más vivos de Lima, con casonas recuperadas como galerías.', 'La Fortaleza del Real Felipe completa la visita; vaya siempre con guía y en horario diurno.'], tours: [] },
        { id: 'consejos', kicker: 'Barrio 05 · Antes de salir', h: 'Consejos prácticos: propina, seguridad y Metropolitano',
          paras: ['La propina habitual va de S/ 20 a S/ 40 por persona según la duración y la calidad del recorrido.', 'Para moverse entre barrios, el Metropolitano conecta el centro con Miraflores y Barranco en unos 30 minutos.'], tours: [] }
      ],
      faq: [
        ['¿Los free tours en Lima son realmente gratis?', 'La reserva no cuesta nada y no hay pago previo. Al final se deja una propina voluntaria al guía.'],
        ['¿Cuánta propina se deja?', 'Entre S/ 20 y S/ 40 por persona es lo habitual para un recorrido de 2 a 3 horas.'],
        ['¿Hay free tours en inglés?', 'Sí. La mayoría de salidas del Centro, Barranco y Miraflores tienen grupos en inglés y algunas en portugués.']
      ],
      seo: { metaTitle: 'Free tours en Lima 2026: guía por barrio con horarios', metaDescription: 'Centro, Barranco, Miraflores y Callao a pie: horarios, puntos de encuentro, propina justa y los free tours mejor valorados de Lima.', keyword: 'free tours en lima', canonical: 'https://rutaslibres.pe/blog/free-tours-en-lima-guia', noindex: false, ogImage: 'og/free-tours-en-lima-guia.png' },
      related: ['SHP-002', 'SHP-003']
    },
    'SHP-002': {
      category: 'gastronomia', authorId: 'AUT-02', readMinutes: 6, reads: 7400, updatedAt: '2026-10-10',
      kicker: 'Gastronomía · Lima', titleAccent: '',
      cover: { tone: 'lima', alt: 'Ceviche servido en un mercado de Lima', caption: 'Ceviche de mediodía en el mercado de Surquillo.', credit: 'Archivo Rutas Libres' },
      intro: ['Qué comer en Lima en un día: la ciudad se come mejor de día y caminando, con mercado por la mañana, cevichería al mediodía y chifa por la tarde.'],
      sections: [
        { id: 'mercado', kicker: 'Parada 01', h: 'Mañana en el mercado de Surquillo', paras: ['Frutas que no verá en otro lugar, jugos al paso y el pan con chicharrón del desayuno limeño.'], tours: [] },
        { id: 'ceviche', kicker: 'Parada 02', h: 'Ceviche al mediodía, nunca de noche', paras: ['El pescado del día se sirve hasta las 4 de la tarde; las cevicherías de barrio cierran temprano.'], tip: { title: 'Presupuesto', text: 'Un menú de cevichería de barrio cuesta entre S/ 18 y S/ 35.' }, tours: ['SHL-004'] },
        { id: 'tarde', kicker: 'Parada 03', h: 'Tarde de chifa y dulces en el Centro', paras: ['El Barrio Chino junto al Mercado Central concentra los chifas más antiguos de la ciudad.'], tours: ['SHL-005'] }
      ],
      faq: [['¿Es seguro comer en los mercados?', 'Sí, en los puestos con más clientes locales y donde preparan al momento.']],
      seo: { metaTitle: 'Qué comer en Lima en un día: ruta sin gastar de más', metaDescription: 'Mercados, cevicherías y chifas en una ruta de un día por Lima, con precios de referencia y tours gastronómicos recomendados.', keyword: 'qué comer en lima', canonical: 'https://rutaslibres.pe/blog/que-comer-en-lima-en-un-dia', noindex: false },
      related: ['SHP-001', 'SHP-003']
    },
    'SHP-003': {
      category: 'itinerarios', authorId: 'AUT-01', keyword: 'cusco en 3 días', readMinutes: 9, reads: 5100, updatedAt: '2026-09-30',
      kicker: 'Itinerario · Cusco', titleAccent: '',
      cover: { tone: 'cusco', alt: 'Calle empedrada de San Blas en Cusco', caption: 'Cuesta de San Blas a primera hora, antes de los grupos grandes.', credit: 'Archivo Rutas Libres' },
      intro: ['Recorrer Cusco en 3 días a pie es posible si se respeta la altura (3 400 m): el primer día se camina despacio. Este itinerario combina free tours cortos con miradores para aclimatarse.'],
      sections: [
        { id: 'dia1', kicker: 'Día 01', h: 'Plaza de Armas y San Blas, sin prisa', paras: ['Un free tour de 2,5 horas por el centro y San Blas es la mejor forma de empezar.'], tip: { title: 'Mal de altura', text: 'Mate de coca, agua y nada de comidas pesadas la primera noche.' }, tours: ['SHL-006'] },
        { id: 'dia2', kicker: 'Día 02', h: 'Mercado San Pedro y miradores', paras: ['Desayuno en el mercado y subida al mirador de San Cristóbal al final de la tarde.'], tours: ['SHL-007'] },
        { id: 'dia3', kicker: 'Día 03', h: 'Valle Sagrado', paras: ['Con el cuerpo ya aclimatado, un día completo por Pisac y Ollantaytambo.'], tours: ['SHL-008'] }
      ],
      faq: [['¿Cuántos días necesito en Cusco?', 'Tres días como mínimo, sin contar Machu Picchu.']],
      seo: { metaTitle: 'Cusco en 3 días a pie: free tours y miradores', metaDescription: 'Itinerario de 3 días en Cusco para aclimatarse caminando: free tours por San Blas, el mercado San Pedro y el Valle Sagrado.', keyword: 'cusco en 3 días', canonical: 'https://rutaslibres.pe/blog/cusco-en-3-dias-a-pie', noindex: false },
      related: ['SHP-001', 'SHP-002']
    },
    'SHP-004': {
      category: 'consejos', authorId: 'AUT-03', readMinutes: 4, reads: 0, updatedAt: '2026-10-30',
      kicker: 'Consejos prácticos', titleAccent: '',
      cover: { tone: 'puno', alt: '', caption: '', credit: '' },
      intro: ['Borrador: montos de referencia por ciudad.'], sections: [], faq: [],
      seo: { metaTitle: '', metaDescription: '', keyword: 'propina free tour', canonical: '', noindex: false }, related: []
    }
  };
  D.showcase.posts.forEach(p => Object.assign(p, POSTX[p.id] || {}));
  /* ---------------------------------------------------------------- v2.12 · Landing de KipuControl (spec 25) */
  // Sitio comercial kipucontrol.com: planes y suscripción, blog compartido con Rutas Libres (mismo Payload, campo `site`),
  // comentarios moderados, popups con reglas y chatbot. Precios de los planes = D.plans; add-ons = catálogo de la v2.8/v2.9.
  D.landing = {
    domain: 'kipucontrol.com',
    announcement: 'Nuevo: contenido con IA para tu web y tu blog',
    trial: { days: 14, plan: 'Professional', coupon: 'KIPUTURISMO2026', couponPct: 10 },
    annualFreeMonths: 2,
    usdRate: 3.78,
    logos: ['Inca Trail Expeditions', 'Cusco Horizon', 'Rutas Andinas', 'Colca Canyons', 'Amazon Explorer', 'Lima Gastronómica', 'Titicaca Travel', 'Paracas Adventure'],
    trust: [['shield', 'SSL 256-bit y cifrado'], ['receipt', 'Facturación electrónica SUNAT'], ['lock', 'Ley 29733 de datos personales'], ['zap', '99,9 % disponibilidad']],
    modules: [
      ['users', 'CRM y ventas', 'WhatsApp, correo e historial de cada viajero en un solo embudo.'],
      ['file', 'Cotizaciones', 'Itinerarios día por día y PDF con tu marca en minutos.'],
      ['calendar', 'Reservas y cupos', 'Fechas, pasajeros y cupos en tiempo real, sin sobreventa.'],
      ['route', 'Operaciones y guías', 'Movilidad, guías oficiales y boletos de ingreso por salida.'],
      ['wallet', 'Finanzas y pagos', 'Cobros en soles y dólares con Yape, Plin, tarjeta y PayPal.'],
      ['chart', 'Rentabilidad', 'Margen real por salida, pasajero y proveedor.'],
      ['globe', 'Web, SEO y blog', 'Tu sitio con dominio propio, reservas directas y contenido con IA.'],
      ['phone', 'App móvil', 'Control en ruta para guías, vouchers y check-in sin conexión.']
    ],
    testimonials: [
      { name: 'Carlos Mendoza', role: 'Fundador de Inca Spirit Cusco', city: 'Cusco', metric: '+38 % reservas directas', text: 'Antes perdíamos ventas por tardar horas en armar un itinerario. Hoy cotizamos en 2 minutos y lo mandamos por WhatsApp con Yape.' },
      { name: 'Mariana Rojas', role: 'Directora de Arequipa Trekking Co.', city: 'Arequipa', metric: 'Cotiza 4x más rápido', text: 'El control de cupos del Cañón del Colca nos salvó la vida. Terminamos con las planillas de cálculo.' },
      { name: 'Jorge Villanueva', role: 'Gerente de Amazon Puno Exp.', city: 'Puno', metric: 'Cero sobreventas en 2026', text: 'La facturación SUNAT ahora es automática. PayPal o tarjeta y la boleta se emite sin intervención manual.' },
      { name: 'Patricia Quispe', role: 'Líder de Lima Bici & Tours', city: 'Lima', metric: 'Posicionamiento #1', text: 'Nuestra web creada con KipuControl empezó a rankear en Google para tours gastronómicos en Miraflores y Barranco.' },
      { name: 'Diego Alarcón', role: 'Fundador de Paracas Adventure', city: 'Ica', metric: 'WhatsApp 24/7 activo', text: 'El asistente IA contesta las preguntas de la madrugada y deja la reserva lista para el equipo.' },
      { name: 'Fiorella Beltrán', role: 'Gerente de Operaciones en Moche Tours', city: 'Trujillo', metric: 'Control total en ruta', text: 'Los guías escanean los vouchers desde el teléfono, incluso sin cobertura en Huanchaco.' }
    ],
    faq: [
      ['¿Necesito tarjeta de crédito para crear mi cuenta?', 'No. La prueba de 14 días del plan Professional y la vitrina gratis en Rutas Libres no piden tarjeta.'],
      ['¿Cómo funciona la emisión de comprobantes con la SUNAT?', 'KipuControl emite boletas y facturas electrónicas al confirmar cada pago y te envía el XML y el CDR.'],
      ['¿Puedo usar mi propio dominio web?', 'Sí. Conectas tu dominio .pe o .com, el SSL se activa solo y tu web recibe reservas directas.'],
      ['¿Cómo evita KipuControl que sobrevenda cupos?', 'Cada reserva descuenta el cupo de la salida en el momento y bloquea la venta cuando se llena, en todos tus canales.'],
      ['¿Qué es la integración con Rutas Libres?', 'Rutas Libres es nuestra vitrina gratuita de free tours. Publicas sin costo y, cuando quieras más, pasas a un plan con tus datos.'],
      ['¿Cuánto tiempo toma migrar desde hojas de Excel?', 'Entre uno y tres días. Importas tours y clientes desde Excel y un especialista te acompaña en una sesión de puesta en marcha.']
    ],
    // Blog B2B de KipuControl (en producción: colección `posts` de Payload con site = 'kipucontrol').
    categories: [{ id: 'ventas', name: 'Ventas' }, { id: 'marketing-seo', name: 'Marketing y SEO' }, { id: 'operaciones', name: 'Operaciones' }, { id: 'finanzas', name: 'Finanzas' }, { id: 'ia', name: 'IA para turismo' }],
    posts: [
      { id: 'KCP-001', site: 'kipucontrol', slug: 'como-cotizar-un-paquete-a-cusco-en-10-minutos', title: 'Cómo cotizar un paquete a Cusco en 10 minutos', titleAccent: '(y cerrar la venta el mismo día)', category: 'ventas', status: 'publicado', publishedAt: '2026-10-18', readMinutes: 8, reads: 2400, featured: true, author: 'Carlos Mendoza', authorRole: 'Head of Product · ex operador receptivo en Cusco', excerpt: 'Guía paso a paso para agencias receptivas: márgenes con trenes y boletos, exoneración del IGV y envío del itinerario por WhatsApp con cobro en soles y dólares.', keyword: 'cotizar paquete cusco',
        sections: [
          { id: 'cuello', h: 'El cuello de botella tradicional', paras: ['Un viajero de São Paulo pide un Cusco clásico de 5 días para 4 personas. En muchas agencias eso abre 4 a 6 horas de hojas de Excel, portales de trenes y consultas de cupos.', 'Cuando llega el PDF al final de la tarde, el viajero ya reservó con quien respondió en 15 minutos.'], tip: ['Consejo de temporada alta', 'No congeles cotizaciones con más de 48 horas de vigencia entre junio y agosto sin pre-reservar el tren.'] },
          { id: 'matriz', h: 'Tu matriz de costos y márgenes en 3 pasos', paras: ['Separa los componentes en tres bolsas: costos fijos no comisionables (entradas), servicios escalonados por volumen (transporte y guías) y tarifas netas negociadas (hoteles y trenes).'], table: [['Tren Vistadome ida y vuelta', 'USD 142,00', '+25 %', 'USD 177,50'], ['Boleto Machu Picchu circuito 2', 'USD 41,00', '0 %', 'USD 41,00'], ['Guía oficial bilingüe', 'USD 35,00', '+35 %', 'USD 47,25'], ['Hotel boutique 4★ (noche)', 'USD 85,00', '+30 %', 'USD 110,50']] },
          { id: 'cotizador', h: 'El cotizador de KipuControl', paras: ['El cotizador toma las tarifas vigentes, aplica la exoneración para no domiciliados y calcula el margen por pasajero antes de enviar.'], product: true },
          { id: 'cierre', h: 'Cierre inmediato: itinerario interactivo y cobro multimoneda', paras: ['Un PDF por correo se abre menos de la mitad de las veces. Un enlace con el itinerario, las fotos del hotel y un botón para pagar el 20 % elimina la fricción.'], tip: ['Dato de conversión', 'Las agencias que responden en los primeros 15 minutos con enlace y pasarela cierran 38 % más que las que tardan más de 2 horas.'] }
        ],
        faq: [['¿Cómo aplica la exoneración del IGV para turistas no domiciliados?', 'Los servicios de hospedaje y alimentación a no domiciliados con pasaporte se tratan como exportación de servicios (DL 1125). KipuControl la aplica por ítem al emitir.'], ['¿Puedo cotizar en dólares y cobrar en soles con Yape?', 'Sí. La cotización guarda el tipo de cambio y el enlace de pago acepta soles o dólares.'], ['¿Qué pasa si el pasajero reprograma Machu Picchu?', 'La reserva pasa a reprogramación, libera los cupos y recalcula diferencias de tarifa.']] },
      { id: 'KCP-002', site: 'kipucontrol', slug: 'guia-sunat-2026-facturacion-electronica-tours-receptivos', title: 'Guía SUNAT 2026: facturación electrónica para tours receptivos', category: 'finanzas', status: 'publicado', publishedAt: '2026-10-14', readMinutes: 9, reads: 4800, author: 'Renzo Quispe', authorRole: 'Contador tributario', excerpt: 'Requisitos del DL 1125, validación de pasaporte y emisión de facturas sin IGV para turistas no domiciliados.', keyword: 'facturación electrónica turismo' },
      { id: 'KCP-003', site: 'kipucontrol', slug: 'seo-local-para-operadores-en-cusco', title: 'SEO local para operadores en Cusco: tu web #1 en Google para Inca Trail', category: 'marketing-seo', status: 'publicado', publishedAt: '2026-10-11', readMinutes: 6, reads: 3900, author: 'Lucía Barreda', authorRole: 'Especialista SEO', excerpt: 'Web bilingüe, reseñas verificadas y datos estructurados de turismo para aparecer sin pagar publicidad.', keyword: 'seo agencia de viajes' },
      { id: 'KCP-004', site: 'kipucontrol', slug: 'checklist-de-operaciones-de-campo', title: 'Checklist de operaciones de campo: guías, transportistas y manifiestos', category: 'operaciones', status: 'publicado', publishedAt: '2026-10-08', readMinutes: 5, reads: 2100, author: 'Diego Rivas', authorRole: 'Jefe de operaciones', excerpt: 'Planillas de contingencia, comunicación con guías y auditorías en puestos de control de Ollantaytambo y Aguas Calientes.', keyword: 'operaciones turisticas' },
      { id: 'KCP-005', site: 'kipucontrol', slug: 'embudo-de-ventas-por-whatsapp', title: 'De lead frío a voucher confirmado: el embudo de ventas por WhatsApp', category: 'ventas', status: 'publicado', publishedAt: '2026-10-05', readMinutes: 7, reads: 3200, author: 'Carlos Mendoza', authorRole: 'Head of Product', excerpt: 'Mensajes con botones de pago, recordatorios y seguimiento para no perder consultas en temporada alta.', keyword: 'ventas por whatsapp turismo' },
      { id: 'KCP-006', site: 'kipucontrol', slug: 'prompts-de-ia-para-itinerarios', title: '15 prompts de IA para redactar itinerarios turísticos que venden', category: 'ia', status: 'publicado', publishedAt: '2026-10-01', readMinutes: 6, reads: 2900, author: 'Mateo Salcedo', authorRole: 'Producto e IA', excerpt: 'Plantillas para describir tours, traducir al inglés y portugués y escribir títulos SEO con revisión humana.', keyword: 'ia para agencias de viaje' },
      { id: 'KCP-007', site: 'kipucontrol', slug: 'precios-dinamicos-temporada-alta', title: 'Precios por temporada sin hojas de cálculo', category: 'finanzas', status: 'borrador', publishedAt: null, readMinutes: 5, reads: 0, author: 'Renzo Quispe', authorRole: 'Contador tributario', excerpt: 'Borrador.', keyword: 'precios turismo' }
    ],
    // Comentarios: entran como `pendiente`; los aprueba la plataforma (admin/marketing-vitrina › Landing). Anti-spam: honeypot, límite por IP y enlaces bloqueados.
    comments: [
      { id: 'CMT-0001', postId: 'KCP-001', parentId: null, name: 'Rosa Huamán', email: 'rosa@cuscoandino.pe', text: '¿El cotizador toma el tipo de cambio del día o uno fijo por cotización?', status: 'aprobado', createdAt: '2026-10-19 09:12', useful: 6, staff: false },
      { id: 'CMT-0002', postId: 'KCP-001', parentId: 'CMT-0001', name: 'Equipo KipuControl', email: 'hola@kipucontrol.com', text: 'Toma el del día y lo guarda en la cotización, así el monto no cambia aunque el viajero pague después.', status: 'aprobado', createdAt: '2026-10-19 10:40', useful: 9, staff: true },
      { id: 'CMT-0003', postId: 'KCP-001', parentId: null, name: 'Luis Ccori', email: 'luis@salkantay.pe', text: 'Lo de responder en 15 minutos es real: en julio duplicamos cierres solo con eso.', status: 'aprobado', createdAt: '2026-10-20 18:05', useful: 4, staff: false },
      { id: 'CMT-0004', postId: 'KCP-001', parentId: null, name: 'promo-seo', email: 'x@spam.biz', text: 'Compra enlaces baratos en mi sitio', status: 'spam', createdAt: '2026-10-21 03:10', useful: 0, staff: false },
      { id: 'CMT-0005', postId: 'SHP-001', parentId: null, name: 'Ana Paula', email: 'apr@mail.br', text: '¿El tour de Barranco tiene grupo en portugués los sábados?', status: 'pendiente', createdAt: '2026-10-30 21:44', useful: 0, staff: false }
    ],
    signups: [
      { id: 'SUB-0001', agency: 'Andean Explorers SAC', ruc: '20608912345', contact: 'Carlos Mendoza', email: 'carlos@andeanexplorers.pe', plan: 'Professional', cycle: 'anual', addons: ['ai_content', 'custom_domain'], coupon: 'KIPUTURISMO2026', method: 'tarjeta', total: 14620.55, currency: 'PEN', status: 'activa', source: 'landing/precios', createdAt: '2026-10-28 11:20', invoice: 'F001-0004291' },
      { id: 'SUB-0002', agency: 'Puno Lago Azul', ruc: '', contact: 'Gisela Mamani', email: 'gisela@lagoazul.pe', plan: 'Starter', cycle: 'mensual', addons: [], coupon: null, method: 'yape', total: 578.20, currency: 'PEN', status: 'prueba', source: 'popup/salida', createdAt: '2026-10-31 16:02', invoice: null },
      { id: 'SUB-0003', agency: 'Lima a Pie Free Walking', ruc: '20555123456', contact: 'Rocío Paredes', email: 'rocio@limaapie.pe', plan: 'Starter', cycle: 'mensual', addons: ['paypal_gateway'], coupon: null, method: 'paypal', total: 578.20, currency: 'PEN', status: 'activa', source: 'rutaslibres/agencias', createdAt: '2026-11-01 09:30', invoice: 'F001-0004302' }
    ],
    popups: [
      { id: 'POP-01', name: 'Prueba de 14 días al salir', trigger: 'salida', pages: 'Inicio y precios', freqDays: 7, status: 'activo', views: 1840, conversions: 96 },
      { id: 'POP-02', name: 'Boletín al 60 % del artículo', trigger: 'scroll_60', pages: 'Artículos del blog', freqDays: 14, status: 'activo', views: 3120, conversions: 212 },
      { id: 'POP-03', name: 'Demo en 30 segundos (precios)', trigger: 'tiempo_30s', pages: 'Precios', freqDays: 7, status: 'pausado', views: 410, conversions: 9 }
    ],
    newsletter: 1284,
    chatbot: { name: 'Kipu', handoff: 'WhatsApp +51 980 123 456', answered: 812, handoffs: 64, leads: 141 }
  };
  // Las guías de Rutas Libres también aparecen en el blog de la landing con su sitio y categoría.
  D.showcase.posts.forEach(p => { p.site = 'rutaslibres'; });
  D.plans.forEach(pl => { pl.isDemo = true; pl.rules = D.settings.bookingRules.filter(r => PLAN_ORDER.indexOf(r.minPlan) <= PLAN_ORDER.indexOf(pl.id)).map(r => r.id); });
  /* Tipos de cambio DEMO: historial de 30 días (soles por unidad) generado de forma determinista */
  (function () {
    const cfg = D.settings.ecommerce; let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    cfg.isDemoRates = true;
    cfg.fxProviders = [
      { id: 'FX-DEMO', name: 'Proveedor de tipo de cambio (DEMO)', kind: 'Simulado', status: 'activo', schedule: 'Diario 08:00 (America/Lima)', lastRun: '2026-09-30 08:00', note: 'Genera valores de prueba. Reemplazar por el proveedor contratado.' },
      { id: 'FX-SBS', name: 'SBS · tipo de cambio referencial (por integrar)', kind: 'Oficial', status: 'por_validar', schedule: '—', lastRun: null, note: 'Referencia oficial para PEN/USD; validar disponibilidad de API o carga.' },
      { id: 'FX-API', name: 'Proveedor comercial de tipos de cambio (por definir)', kind: 'API', status: 'por_validar', schedule: '—', lastRun: null, note: 'Para monedas distintas de USD (EUR, GBP, BRL, CLP, MXN, COP…).' },
      { id: 'FX-MAN', name: 'Carga manual', kind: 'Manual', status: 'activo', schedule: 'Cuando se edite', lastRun: '2026-09-30 08:00', note: 'Finanzas puede corregir cualquier valor; queda auditado.' }
    ];
    cfg.rateProvider = 'FX-DEMO';
    cfg.rateHistory = {};
    cfg.currencies.forEach(c => {
      if (c.code === 'PEN') return;
      const hist = []; let v = c.rate;
      for (let i = 0; i < 30; i++) { const d = new Date(2026, 8, 30 - i); hist.push({ date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), rate: +v.toFixed(c.rate < 0.1 ? 6 : 4), source: 'FX-DEMO' }); v = v * (1 + (rnd() - 0.5) * 0.008); }
      cfg.rateHistory[c.code] = hist.reverse();
    });
  })();
  return D;
})();
