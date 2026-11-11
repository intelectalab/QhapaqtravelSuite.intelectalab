/* Plataforma SaaS — módulos de negocio del producto (lo que lo hace vendible como SaaS)
   - admin/suscripcion  (Tenant Admin · admin.billing.manage): plan, consumo vs límites, add-ons, cambio de plan con
     prorrateo, facturas de la plataforma, método de pago, datos de facturación, renovación y cancelación.
   - admin/api          (Tenant Admin · admin.api.manage): API keys con scopes, webhooks firmados HMAC con reintentos,
     log de entregas, límites de rate limit por plan, documentación OpenAPI y aplicaciones OAuth.
   - admin/plataforma   (Super Admin SaaS · admin.tenant.manage): MRR/ARR, altas/bajas, facturas por tenant, cobros
     fallidos y dunning (1/3/7 días + suspensión), trials, cupones, catálogo de planes y feature flags (entitlements).
   El Super Admin nunca ve datos comerciales de las agencias: solo contadores de uso agregados.
   Especificación: proto/docs/especificaciones/13-plataforma-saas-api.md */
(function () {
  'use strict';
  const { esc, money, fmtN, date, datetime, sum, addDays, nowStr, daysBetween } = Util;
  const ic = UI.icon;

  /* ---------------- Estilos del módulo (solo variables de tema) ---------------- */
  if (!document.getElementById('css-plataforma')) {
    const st = document.createElement('style'); st.id = 'css-plataforma';
    st.textContent = [
      '.pl-page>*,.pl-page .tab-body>*,.pl-page .tab-body{min-width:0;max-width:100%}',
      '.pl-meters{display:grid;gap:14px}',
      '.pl-meter .row{flex-wrap:nowrap}.pl-meter .row>span:first-child{min-width:0}',
      '.pl-meter .progress{margin:5px 0 3px}',
      '.pl-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}',
      '.pl-opt{border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;background:var(--surface);cursor:pointer;display:flex;flex-direction:column;gap:6px;text-align:left;font:inherit;color:inherit}',
      '.pl-opt:hover{border-color:var(--accent)}',
      '.pl-opt.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);background:var(--accent-soft)}',
      '.pl-opt .pr{font-family:var(--f-display);font-size:1.25rem;font-weight:600}',
      '.pl-opt.cur .cur-tag{display:inline-block}.pl-opt .cur-tag{display:none}',
      '.pl-secret{background:var(--surface-2);border:1px dashed var(--accent);border-radius:var(--r-sm);padding:12px 14px;font-family:var(--f-mono);font-size:.82rem;word-break:break-all;user-select:all}',
      '.pl-code{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px;font-family:var(--f-mono);font-size:.74rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto;margin:0;color:var(--fg-2)}',
      '.pl-scopes{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 14px}',
      '.pl-scopes label{display:flex;gap:7px;align-items:flex-start;font-size:.82rem}',
      '.pl-scopes input{margin-top:3px;accent-color:var(--accent)}',
      '.pl-fm{min-width:720px}.pl-fm td,.pl-fm th{padding:7px 9px}.pl-fm td.c,.pl-fm th.c{text-align:center}',
      '.pl-fm input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}',
      '.pl-fm tr.g td{background:var(--surface-2);font-weight:600;font-size:.78rem}',
      '.pl-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}',
      '.pl-kv>div{border:1px solid var(--line-2);border-radius:var(--r-sm);padding:9px 11px;background:var(--surface-2);min-width:0}',
      '.pl-kv b{display:block;font-size:1.02rem;font-family:var(--f-display)}',
      '.pl-steps{display:flex;gap:6px;flex-wrap:wrap}',
      '.pl-steps span{font-size:.72rem;border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--fg-2)}',
      '.pl-steps span.done{border-color:var(--bad);color:var(--bad)}.pl-steps span.ok{border-color:var(--ok);color:var(--ok)}.pl-steps span.next{border-color:var(--warn);color:var(--warn);font-weight:600}',
      '.pl-wrap{word-break:break-all}',
      '.pl-rm td.inc{background:var(--ok-soft)}.pl-rmc{display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap}.pl-rmc input{accent-color:var(--accent)}',
      '.pl-rchips{display:flex;flex-wrap:wrap;gap:5px}.pl-rchips .tag{white-space:normal}.pl-rchips .lk{color:var(--fg-3)}',
      '.pl-rg{margin-top:8px}.pl-rg>.xs{font-weight:600;margin-bottom:4px;color:var(--fg-2)}',
      '.pl-code .l-ok{color:var(--ok)}.pl-code .l-warn{color:var(--warn)}.pl-code .l-bad{color:var(--bad);font-weight:600}.pl-code .l-mute{color:var(--fg-3)}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- Constantes ---------------- */
  const TODAY = () => window.TODAY;
  const MONTH = () => String(window.TODAY).slice(0, 7);
  const TID = () => DB.tenant.id;
  const PLAN_ORDER = ['Starter', 'Professional', 'Enterprise'];
  const rank = (p) => PLAN_ORDER.indexOf(p) + 1;
  const LIMITS = {
    Starter: { users: 5, sedes: 1, storageGB: 5, reservations: 150, whatsapp: 500, email: 5000, apiCalls: 0, rateMin: 0, webhooks: 0, apiKeys: 0, extraUserPrice: 59 },
    Professional: { users: 15, sedes: 2, storageGB: 25, reservations: 600, whatsapp: 2000, email: 20000, apiCalls: 100000, rateMin: 60, webhooks: 3, apiKeys: 5, extraUserPrice: 49 },
    Enterprise: { users: null, sedes: null, storageGB: 100, reservations: 3000, whatsapp: 5000, email: 100000, apiCalls: 1000000, rateMin: 600, webhooks: 20, apiKeys: 25, extraUserPrice: 0 }
  };
  const LIMIT_LABEL = { users: 'Usuarios activos', sedes: 'Sedes', storageGB: 'Almacenamiento (GB)', reservations: 'Reservas / mes', whatsapp: 'WhatsApp / mes', email: 'Emails / mes', apiCalls: 'Llamadas API / mes', rateMin: 'Rate limit (req/min)', webhooks: 'Webhooks', apiKeys: 'API keys' };
  /* Add-ons: avail = planes donde se puede contratar; incl = planes donde ya viene incluido */
  const ADDONS = [
    { key: 'extra_users', label: 'Usuarios adicionales', unit: 'usuario', qty: true, price: (plan) => (planOf(plan).limits || {}).extraUserPrice || 0, avail: ['Starter', 'Professional'], incl: ['Enterprise'], desc: 'Amplía el límite de usuarios activos facturables del plan.' },
    { key: 'whatsapp_pack', label: 'Paquete WhatsApp +1 000 mensajes/mes', unit: 'paquete', qty: true, price: () => 65, avail: PLAN_ORDER, incl: [], desc: 'Mensajes de plantilla adicionales por mes (WhatsApp Business API).' },
    { key: 'storage_pack', label: 'Almacenamiento +50 GB', unit: 'paquete', qty: true, price: () => 80, avail: PLAN_ORDER, incl: [], desc: 'Documentos, vouchers, adjuntos de reservas y fotografías.' },
    { key: 'b2b_full', label: 'Módulo B2B completo', unit: 'módulo', qty: false, price: () => 290, avail: ['Professional'], incl: ['Enterprise'], feature: 'b2b', desc: 'Portal de agencias con tarifas netas, crédito, comisiones y reservas en línea.' },
    { key: 'mobile_apps', label: 'Apps móviles (operador y pasajero)', unit: 'módulo', qty: false, price: () => 390, avail: ['Professional'], incl: ['Enterprise'], feature: 'mobile_apps', desc: 'App de guías y conductores (offline) y app del pasajero con push.' },
    { key: 'custom_domain', label: 'Dominio propio + certificado SSL', unit: 'dominio', qty: false, price: () => 45, avail: PLAN_ORDER, incl: [], feature: 'custom_domain', desc: 'Portales y sitio web bajo el dominio de la agencia (CNAME + SSL automático).' }
  ];
  const addonOf = (k) => ADDONS.find(a => a.key === k);
  const SCOPES = [
    ['catalog:read', 'Leer catálogo, productos y tarifas públicas'], ['availability:read', 'Consultar disponibilidad y salidas'],
    ['crm:read', 'Leer leads, clientes y oportunidades'], ['crm:write', 'Crear/actualizar leads y clientes'],
    ['quotes:read', 'Leer cotizaciones'], ['quotes:write', 'Crear cotizaciones y versiones'],
    ['reservations:read', 'Leer reservas y pasajeros'], ['reservations:write', 'Crear/modificar reservas'],
    ['payments:read', 'Leer pagos y cuentas por cobrar'], ['invoices:read', 'Leer comprobantes electrónicos'],
    ['operations:read', 'Leer órdenes operativas y vouchers'], ['webhooks:manage', 'Gestionar webhooks por API']
  ];
  const EVENTS = [
    ['lead.created', 'CRM', 'Lead creado'], ['quote.sent', 'Cotizaciones', 'Cotización enviada al cliente'], ['quote.approved', 'Cotizaciones', 'Cotización aprobada por el cliente'],
    ['reservation.created', 'Reservas', 'Reserva creada'], ['reservation.confirmed', 'Reservas', 'Reserva confirmada'], ['reservation.cancelled', 'Reservas', 'Reserva cancelada'],
    ['payment.applied', 'Finanzas', 'Pago aplicado'], ['payment.reversed', 'Finanzas', 'Pago revertido'], ['invoice.issued', 'Finanzas', 'Comprobante electrónico emitido'],
    ['voucher.issued', 'Operaciones', 'Voucher emitido'], ['incident.created', 'Operaciones', 'Incidencia creada'], ['incident.resolved', 'Operaciones', 'Incidencia resuelta']
  ];
  const BACKOFF = ['1 min', '5 min', '30 min', '2 h', '6 h', '24 h'];
  const BACKOFF_MIN = [1, 5, 30, 120, 360, 1440];
  const AUTO_DISABLE = 10; /* fallos consecutivos que deshabilitan un webhook */
  const BILLABLE = ['tenant_admin', 'manager', 'sales', 'operations', 'finance', 'accounting', 'guide', 'driver'];
  const TONE = { ok: 'activo', warn: 'pendiente', bad: 'vencido', info: 'nuevo', mute: 'inactivo', accent: 'contactado', violet: 'calificado' };
  const ST = {
    pagada: ['Pagada', 'ok'], pendiente: ['Pendiente', 'warn'], fallida: ['Cobro fallido', 'bad'], vencida: ['Vencida', 'bad'], anulada: ['Anulada', 'mute'],
    activa: ['Activa', 'ok'], trial: ['En prueba', 'info'], past_due: ['Pago atrasado', 'bad'], cancel_programada: ['Cancelación programada', 'warn'], cancelada: ['Cancelada', 'mute'],
    revocada: ['Revocada', 'mute'], expirada: ['Expirada', 'mute'], activo: ['Activo', 'ok'], pausado: ['Pausado', 'warn'], deshabilitado: ['Deshabilitado', 'bad'],
    entregado: ['Entregado', 'ok'], fallido: ['Fallido', 'bad'], reintentando: ['Reintentando', 'warn'], inactivo: ['Inactivo', 'mute'], prueba: ['En prueba', 'info'], suspendido: ['Suspendido', 'bad'],
    aceptado: ['Aceptado SUNAT', 'ok'], exitoso: ['Exitoso', 'ok'], rechazado: ['Rechazado', 'bad'], programado: ['Programado', 'info']
  };
  const B = (s, label) => { const x = ST[s]; return x ? UI.badge(TONE[x[1]], label || x[0]) : UI.badge(s, label); };
  const DECLINE = { insufficient_funds: 'Fondos insuficientes (51)', card_declined: 'Tarjeta rechazada por el emisor (05)', expired_card: 'Tarjeta vencida (54)' };

  /* ---------------- Helpers generales ---------------- */
  const r2 = (n) => Math.round(n * 100) / 100;
  const planOf = (id) => DB.plans.find(p => p.id === id) || DB.plans[0];
  const tenantRow = (id) => DB.tenants.find(t => t.id === id);
  const tName = (id) => (tenantRow(id) || {}).name || id;
  const uName = (id) => Q.user(id) ? Q.userName(id) : (id || 'Sistema');
  const nextId = (arr, prefix, width) => { const n = Math.max(0, ...arr.map(x => parseInt(String(x.id).replace(/\D/g, ''), 10) || 0)) + 1; return prefix + String(n).padStart(width, '0'); };
  const rnd = (n) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
  const fakeHex = (s, len = 64) => { let h = 2166136261 >>> 0, out = ''; s = String(s); while (out.length < len) { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; out += h.toString(16).padStart(8, '0'); s += out; } return out.slice(0, len); };
  const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1 + n, d); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); };
  const fmtQ = (n, dec) => n == null ? 'Ilimitado' : fmtN(n, dec || 0);
  const setHash = (h) => { try { history.replaceState(null, '', h); } catch (e) { } };
  const crumbsT = (label) => [['Inicio', '#/dashboard'], ['Administración', '#/admin/usuarios'], [label]];
  const crumbsP = (label) => [['Consola de plataforma', '#/admin/tenants'], [label]];
  const page = (html) => '<div class="page pl-page">' + html + '</div>';
  const tbl = (head, rows, cls) => '<div class="tbl-wrap"><table class="tbl ' + (cls || '') + '"><thead><tr>' + head.map(h => '<th' + (h.startsWith('#') ? ' class="num"' : '') + '>' + esc(h.replace(/^#/, '')) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  /* ---- v2.2 · Planes × reglas de reserva (DEMO): rule.minPlan ↔ DB.plans[].rules ---- */
  const RGROUPS = ['Disponibilidad', 'Pasajeros', 'Alojamiento', 'Adicionales', 'Precios', 'Monedas y pagos', 'Checkout', 'Comunicación'];
  const DEMO_TAG = '<span class="badge b-warn" title="Valores de prueba: se reemplazarán por los definitivos">Demo — editable</span>';
  const allRules = () => (DB.settings && DB.settings.bookingRules) || [];
  const minPlanOf = (r) => PLAN_ORDER.includes(r.minPlan) ? r.minPlan : 'Starter';
  const rulesOfPlan = (planId) => allRules().filter(r => rank(minPlanOf(r)) <= rank(planId));
  const ruleGroups = () => RGROUPS.concat(Array.from(new Set(allRules().map(r => r.group))).filter(g => !RGROUPS.includes(g)));
  function syncPlanRules() { DB.plans.forEach(p => { p.rules = rulesOfPlan(p.id).map(r => r.id); }); }
  const demoNote = () => UI.alert('warn', '<b>Demo — editable.</b> ' + esc((DB.planCatalogDemo && DB.planCatalogDemo.note) || 'Planes, precios y reglas de prueba.') + ' El cliente aún no define planes ni reglas por plan: esta matriz es un punto de partida que se reemplazará por los valores definitivos.');
  /* Tenants cuyo acceso a la regla cambia al mover el plan mínimo de «from» a «to» */
  function affectedTenants(from, to) {
    const lo = Math.min(rank(from), rank(to)), hi = Math.max(rank(from), rank(to));
    return DB.tenants.filter(t => t.status !== 'cancelado' && rank(t.plan) >= lo && rank(t.plan) < hi);
  }
  function denied(el, title, perm, crumbs) {
    el.innerHTML = page(UI.pageHeader({ title, crumbs: crumbs || crumbsT(title) }) + UI.alert('bad', '<b>403 · Acceso denegado.</b> Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <span class="mono">' + esc(perm) + '</span>. La autorización real la valida el backend en cada solicitud (PROC-062).'));
  }
  /* Guardia de acción: si el rol no puede, bloquea con toast y no modifica datos */
  const guard = (perm) => { if (Auth.can(perm)) return true; UI.toast('Acción bloqueada: requiere permiso ' + perm + '.', 'bad'); return false; };

  /* ---------------- Datos semilla del módulo ---------------- */
  function seedInvoices() {
    const cfg = DB.platformConfig; const out = [];
    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const spec = { 'TNT-0001': { from: '2026-04' }, 'TNT-0002': { from: '2026-04' }, 'TNT-0003': { from: '2026-04' }, 'TNT-0004': { from: '2026-05' }, 'TNT-0006': { from: '2026-04', to: '2026-08' } };
    const list = [];
    Object.keys(spec).forEach(tid => { const tb = cfg.tenantBilling[tid]; months.filter(m => m >= spec[tid].from && (!spec[tid].to || m <= spec[tid].to)).forEach(m => list.push({ tid, m, d: m + '-' + String(tb.day).padStart(2, '0') })); });
    list.sort((a, b) => a.d.localeCompare(b.d));
    let n = 188;
    list.forEach(({ tid, m, d }) => {
      const t = tenantRow(tid); const tb = cfg.tenantBilling[tid]; const p = planOf(t.plan);
      const price = tid === 'TNT-0004' ? 3150 : p.price;
      const end = addDays(addMonths(d, 1), -1);
      const lines = [{ desc: 'Suscripción plan ' + t.plan + ' — periodo ' + date(d) + ' al ' + date(end), qty: 1, unit: price, amount: price }];
      if (tid === 'TNT-0001') { lines.push({ desc: 'Add-on: Dominio propio + certificado SSL', qty: 1, unit: 45, amount: 45 }); if (m >= '2026-06') lines.push({ desc: 'Add-on: Paquete WhatsApp +1 000 mensajes/mes', qty: 2, unit: 65, amount: 130 }); }
      const subtotal = sum(lines, 'amount'); const igv = r2(subtotal * 0.18);
      const id = cfg.invoiceSeries + '-' + String(n++).padStart(8, '0');
      const inv = { id, tenantId: tid, kind: 'suscripcion', period: m, periodFrom: d, periodTo: end, issueDate: d, dueDate: d, lines, subtotal, igv, total: r2(subtotal + igv), currency: 'PEN', status: 'pagada', paidAt: d + ' 06:0' + (n % 10), method: tb.pm, attempts: [{ ts: d + ' 06:00', result: 'exitoso', code: '00', msg: 'Aprobado' }], dunning: null, sunat: 'aceptado', hash: fakeHex(id + tid, 28), billTo: { name: t.name, ruc: t.ruc, address: tb.address } };
      if (tid === 'TNT-0003' && m === '2026-09') {
        inv.attempts = [{ ts: '2026-09-02 06:00', result: 'rechazado', code: 'card_declined', msg: DECLINE.card_declined }, { ts: '2026-09-03 10:00', result: 'rechazado', code: 'card_declined', msg: DECLINE.card_declined }, { ts: '2026-09-05 10:00', result: 'exitoso', code: '00', msg: 'Aprobado (reintento 2 de 3)' }];
        inv.paidAt = '2026-09-05 10:00'; inv.recovered = true;
      }
      if (tid === 'TNT-0004' && m === '2026-09') {
        inv.status = 'fallida'; inv.paidAt = null; inv.dueDate = addDays(d, 7);
        inv.attempts = [{ ts: '2026-09-26 06:00', result: 'rechazado', code: 'insufficient_funds', msg: DECLINE.insufficient_funds }, { ts: '2026-09-27 10:00', result: 'rechazado', code: 'insufficient_funds', msg: DECLINE.insufficient_funds + ' · reintento 1 de 3' }];
        inv.dunning = { failedAt: '2026-09-26', retriesDone: 1, nextRetryAt: '2026-09-29 10:00', extendedDays: 0 };
      }
      if (tid === 'TNT-0006' && (m === '2026-07' || m === '2026-08')) {
        inv.status = 'vencida'; inv.paidAt = null; inv.dueDate = addDays(d, 7);
        inv.attempts = [{ ts: d + ' 06:00', result: 'rechazado', code: 'expired_card', msg: DECLINE.expired_card }, { ts: addDays(d, 1) + ' 10:00', result: 'rechazado', code: 'expired_card', msg: DECLINE.expired_card }, { ts: addDays(d, 3) + ' 10:00', result: 'rechazado', code: 'expired_card', msg: DECLINE.expired_card }, { ts: addDays(d, 7) + ' 10:00', result: 'rechazado', code: 'expired_card', msg: DECLINE.expired_card }];
        inv.dunning = { failedAt: d, retriesDone: 3, nextRetryAt: null, extendedDays: m === '2026-07' ? 24 : 0, exhausted: true };
      }
      out.push(inv);
    });
    cfg.nextInvoice = n;
    return out.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.id.localeCompare(a.id));
  }

  function ensure() {
    let ch = false;
    DB.plans.forEach(p => {
      if (!p.limits) { p.limits = Object.assign({}, LIMITS[p.id] || LIMITS.Starter); ch = true; }
      if (p.priceYear == null) { p.priceYear = p.price * 10; ch = true; }
      if (p.trialDays == null) { p.trialDays = 14; ch = true; }
      if (!p.status) { p.status = 'activo'; ch = true; }
    });
    if (!DB.platformConfig) {
      DB.platformConfig = {
        issuer: { name: 'KipuControl Cloud S.A.C.', ruc: '20614455661', address: 'Av. Santo Toribio 143, Of. 1102, San Isidro, Lima', email: 'facturacion@kipucontrol.com', web: 'www.kipucontrol.com' },
        igvPct: 18, currency: 'PEN', invoiceSeries: 'FQ01', nextInvoice: 188,
        gateway: 'Pasarela local con tokenización y cargos recurrentes (proveedor por definir)',
        dunning: { retryDays: [1, 3, 7], suspendAfterLast: true },
        tenantBilling: {
          'TNT-0001': { day: 3, cycle: 'mensual', pm: 'Visa •••• 4821', cardOk: true, addonsMrr: 175, address: 'Av. José Larco 1150, Of. 602, Miraflores, Lima' },
          'TNT-0002': { day: 15, cycle: 'mensual', pm: 'Mastercard •••• 1034', cardOk: true, addonsMrr: 0, address: 'Jr. Putumayo 382, Iquitos, Loreto' },
          'TNT-0003': { day: 2, cycle: 'mensual', pm: 'Visa •••• 7719', cardOk: true, addonsMrr: 0, address: 'Av. Paracas 214, Paracas, Ica' },
          'TNT-0004': { day: 26, cycle: 'mensual', pm: 'Visa •••• 0092', cardOk: false, declineCode: 'insufficient_funds', addonsMrr: 0, address: 'Av. El Puerto 455, Puno' },
          'TNT-0005': { day: 12, cycle: 'mensual', pm: null, cardOk: false, addonsMrr: 0, trialStart: '2026-09-12', trialEnd: '2026-10-03', trialExtended: 7, address: 'Jr. Pizarro 540, Trujillo, La Libertad' },
          'TNT-0006': { day: 1, cycle: 'mensual', pm: 'Visa •••• 5530 (vencida)', cardOk: false, declineCode: 'expired_card', addonsMrr: 0, suspendedAt: '2026-08-08', address: 'Av. Luzuriaga 612, Huaraz, Áncash' }
        }
      };
      ch = true;
    }
    if (!DB.platformInvoices) { DB.platformInvoices = seedInvoices(); ch = true; }
    if (!DB.subscription) {
      const resSeed = DB.reservations.filter(r => String(r.createdAt || '').startsWith(MONTH())).length;
      const waSeed = DB.notifications.filter(n => n.channel === 'WhatsApp' && String(n.ts).startsWith(MONTH())).length;
      const emSeed = DB.notifications.filter(n => n.channel === 'Email' && String(n.ts).startsWith(MONTH())).length;
      DB.subscription = {
        id: 'SUB-2025-0001', tenantId: TID(), plan: DB.tenant.plan, cycle: 'mensual', status: 'activa', customerSince: '2025-11-03',
        trialStart: '2025-11-03', trialEnd: '2025-11-17', periodStart: '2026-09-03', periodEnd: '2026-10-02', autoRenew: true,
        addons: [{ key: 'whatsapp_pack', qty: 2, since: '2026-06-03' }, { key: 'custom_domain', qty: 1, since: '2026-04-03', meta: 'reservas.andeshorizonte.pe', ssl: 'emitido' }],
        coupon: null, creditBalance: 0, pendingChange: null, cancelAt: null, cancelSurvey: null,
        paymentMethod: { brand: 'Visa', last4: '4821', exp: '08/2028', holder: 'MARIELA QUISPE ROJAS', token: 'pm_' + fakeHex('pm4821', 20), updatedAt: '2026-03-10', updatedBy: 'U01' },
        billing: { ruc: DB.tenant.ruc, name: DB.tenant.name, address: 'Av. José Larco 1150, Of. 602, Miraflores, Lima', ubigeo: '150122', email: 'facturacion@andeshorizonte.pe', contact: 'Mariela Quispe Rojas', docType: 'Factura' },
        usage: { month: MONTH(), reservationsBase: Math.max(0, 58 - resSeed), whatsappBase: 5840 - waSeed, emailBase: 21480 - emSeed, apiCalls: 846210, storageGB: 38.2 },
        usageHistory: [
          { month: '2026-04', reservations: 41, whatsapp: 2980, email: 14210, apiCalls: 402100, storageGB: 31.4 },
          { month: '2026-05', reservations: 47, whatsapp: 3410, email: 15880, apiCalls: 468900, storageGB: 32.9 },
          { month: '2026-06', reservations: 72, whatsapp: 5120, email: 22640, apiCalls: 701300, storageGB: 34.6 },
          { month: '2026-07', reservations: 88, whatsapp: 6210, email: 27910, apiCalls: 918400, storageGB: 36.1 },
          { month: '2026-08', reservations: 63, whatsapp: 5390, email: 23050, apiCalls: 811700, storageGB: 37.3 }
        ]
      };
      ch = true;
    }
    if (!DB.featureFlags) {
      const F = (key, label, module, S, P, E, extra) => Object.assign({ key, label, module, kind: 'módulo', plans: { Starter: S, Professional: P, Enterprise: E }, addon: null, overrides: [] }, extra || {});
      DB.featureFlags = [
        F('crm', 'CRM, leads y Cliente 360', 'Comercial', true, true, true), F('catalog', 'Catálogo turístico y tarifas', 'Catálogo', true, true, true),
        F('quotes', 'Cotizaciones versionadas', 'Ventas', true, true, true), F('reservations', 'Reservas y pasajeros', 'Ventas', true, true, true),
        F('finance_basic', 'Finanzas básicas (CxC y pagos)', 'Finanzas', true, true, true), F('portal_client', 'Portal del cliente', 'Canales', true, true, true),
        F('operations', 'Órdenes operativas y asignaciones', 'Operaciones', false, true, true), F('vouchers', 'Vouchers y rooming list', 'Operaciones', false, true, true),
        F('travel_docs', 'Documentos de viaje', 'Operaciones', false, true, true), F('profitability', 'Rentabilidad y comisiones', 'Finanzas', false, true, true),
        F('treasury', 'Tesorería (caja y bancos)', 'Finanzas', false, true, true), F('reports', 'Reportes y exportación', 'Inteligencia', false, true, true),
        F('portal_passenger', 'Portal del pasajero', 'Canales', false, true, true), F('inbox_omnichannel', 'Bandeja omnicanal', 'Colaboración', false, true, true),
        F('marketing_campaigns', 'Campañas y segmentos', 'Marketing', false, true, true), F('b2b', 'Canal B2B agencias', 'Canales', false, 'básico', true, { addon: 'b2b_full' }),
        F('multi_sede', 'Multi-sede', 'Administración', false, false, true), F('ecommerce', 'E-commerce', 'Canales', false, false, true), F('cms', 'CMS y sitio web', 'Canales', false, false, true),
        F('mobile_apps', 'Apps móviles (operador y pasajero)', 'Móvil', false, false, true, { addon: 'mobile_apps' }), F('integrations', 'Integraciones por adapters', 'Plataforma', false, false, true),
        F('audit_advanced', 'Auditoría avanzada y exportación', 'Plataforma', false, false, true),
        F('api_access', 'API REST y API keys', 'Plataforma', false, true, true, { kind: 'límite' }), F('webhooks', 'Webhooks salientes', 'Plataforma', false, true, true, { kind: 'límite' }),
        F('oauth_apps', 'Aplicaciones OAuth de terceros', 'Plataforma', false, false, true), F('custom_domain', 'Dominio propio', 'Canales', false, false, false, { addon: 'custom_domain', kind: 'add-on' }),
        F('ai_quote_assistant', 'Asistente de cotización (beta)', 'Ventas', false, false, false, { kind: 'beta', overrides: [{ tenantId: 'TNT-0001', value: true, reason: 'Programa beta cerrado — acuerdo firmado 01/09/2026', until: '2026-12-31', by: 'U16', at: '2026-09-01 10:00' }] })
      ];
      DB.featureFlags.find(f => f.key === 'ecommerce').overrides.push({ tenantId: 'TNT-0002', value: true, reason: 'Piloto comercial de e-commerce aprobado por gerencia de producto', until: '2026-10-31', by: 'U16', at: '2026-08-15 09:30' });
      ch = true;
    }
    if (!DB.coupons) {
      DB.coupons = [
        { id: 'CPN-0004', code: 'QUEDATE20', type: 'percent', value: 20, months: 3, plans: PLAN_ORDER.slice(), maxRedemptions: 30, redeemed: 4, validTo: '2026-12-31', status: 'activo', note: 'Retención: ofrecido en el flujo de cancelación', createdBy: 'U16', createdAt: '2026-07-01' },
        { id: 'CPN-0003', code: 'FERIATUR26', type: 'percent', value: 15, months: 6, plans: ['Starter', 'Professional'], maxRedemptions: 50, redeemed: 12, validTo: '2026-10-31', status: 'activo', note: 'Feria de turismo Lima 2026', createdBy: 'U16', createdAt: '2026-05-20' },
        { id: 'CPN-0002', code: 'ANUAL2MESES', type: 'fixed', value: 490, months: 1, plans: ['Starter'], maxRedemptions: 100, redeemed: 7, validTo: '2026-12-31', status: 'activo', note: 'Descuento al pasar a ciclo anual', createdBy: 'U16', createdAt: '2026-04-02' },
        { id: 'CPN-0001', code: 'LANZAMIENTO', type: 'percent', value: 30, months: 3, plans: PLAN_ORDER.slice(), maxRedemptions: 20, redeemed: 20, validTo: '2026-03-31', status: 'inactivo', note: 'Lanzamiento comercial (agotado)', createdBy: 'U16', createdAt: '2025-10-15' }
      ];
      ch = true;
    }
    if (!DB.platformMetrics) {
      DB.platformMetrics = {
        labels: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set'],
        mrr: [7440, 10590, 10765, 10275, 9785, 0], newTenants: [1, 0, 0, 0, 0, 1], churned: [0, 0, 1, 0, 1, 0], suspended: [0, 0, 0, 0, 1, 0],
        cancellations: [
          { name: 'Mistura Viajes E.I.R.L.', plan: 'Professional', date: '2026-08-31', mrr: 1190, reason: 'Precio', comment: 'Migró a un sistema local más económico.' },
          { name: 'Inka Trails Club S.A.C.', plan: 'Starter', date: '2026-06-30', mrr: 490, reason: 'Cierre o pausa del negocio', comment: 'Cese temporal de operaciones.' }
        ],
        usageByTenant: {
          'TNT-0002': { reservations: 212, whatsapp: 1640, email: 8120, apiCalls: 38400, storageGB: 11.4 },
          'TNT-0003': { reservations: 188, whatsapp: 1980, email: 9960, apiCalls: 61200, storageGB: 14.9 },
          'TNT-0004': { reservations: 402, whatsapp: 3910, email: 30480, apiCalls: 488000, storageGB: 52.7 },
          'TNT-0005': { reservations: 31, whatsapp: 470, email: 1210, apiCalls: 0, storageGB: 0.8 },
          'TNT-0006': { reservations: 0, whatsapp: 0, email: 0, apiCalls: 0, storageGB: 2.1 }
        }
      };
      ch = true;
    }
    if (!DB.apiKeys) {
      DB.apiKeys = [
        { id: 'KEY-0003', tenantId: TID(), name: 'ERP contable — exportación de ventas', env: 'live', prefix: 'qts_live_4fZp', last4: 'x9Q1', hash: 'sha256:' + fakeHex('KEY-0003', 20), scopes: ['invoices:read', 'payments:read', 'reservations:read'], ipAllow: '200.48.22.17', createdBy: 'U01', createdAt: '2026-05-12 11:20', expiresAt: '2027-05-12', lastUsedAt: '2026-09-29 08:05', lastIp: '200.48.22.17', calls30d: 18240, throttled24h: 0, status: 'activa' },
        { id: 'KEY-0002', tenantId: TID(), name: 'Sitio web — motor de reservas', env: 'live', prefix: 'qts_live_9Qa1', last4: 'Lk7m', hash: 'sha256:' + fakeHex('KEY-0002', 20), scopes: ['catalog:read', 'availability:read', 'quotes:write', 'reservations:write', 'crm:write'], ipAllow: '', createdBy: 'U01', createdAt: '2026-02-02 16:45', expiresAt: null, lastUsedAt: '2026-09-29 09:11', lastIp: '161.132.8.40', calls30d: 612300, throttled24h: 37, status: 'activa' },
        { id: 'KEY-0001', tenantId: TID(), name: 'Pruebas integración Wayra (sandbox)', env: 'test', prefix: 'qts_test_2Lm8', last4: 'pP3d', hash: 'sha256:' + fakeHex('KEY-0001', 20), scopes: ['catalog:read', 'reservations:write'], ipAllow: '', createdBy: 'U01', createdAt: '2026-01-20 10:02', expiresAt: '2026-07-20', lastUsedAt: '2026-05-28 17:40', lastIp: '190.12.77.4', calls30d: 0, throttled24h: 0, status: 'revocada', revokedAt: '2026-06-01 09:15', revokedBy: 'U01', revokeReason: 'Fin de pruebas con la agencia' }
      ];
      ch = true;
    }
    if (!DB.webhooks) {
      DB.webhooks = [
        { id: 'WH-0001', tenantId: TID(), url: 'https://erp.andeshorizonte.pe/api/kipucontrol/webhooks', description: 'ERP contable: pagos, comprobantes y reservas', events: ['reservation.confirmed', 'reservation.cancelled', 'payment.applied', 'invoice.issued'], secretPrefix: 'whsec_3kd9', secretRotatedAt: '2026-05-12 11:30', status: 'activo', health: 'ok', consecutiveFailures: 0, createdBy: 'U01', createdAt: '2026-05-12 11:30', apiVersion: '2026-09-01' },
        { id: 'WH-0002', tenantId: TID(), url: 'https://crm-mkt.andeshorizonte.pe/hooks/qts', description: 'Automatización de marketing (seguimiento de cotizaciones)', events: ['lead.created', 'quote.sent', 'quote.approved'], secretPrefix: 'whsec_Tq81', secretRotatedAt: '2026-07-03 15:10', status: 'activo', health: 'fail', consecutiveFailures: 7, createdBy: 'U01', createdAt: '2026-07-03 15:10', apiVersion: '2026-09-01' },
        { id: 'WH-0003', tenantId: TID(), url: 'https://alertas.andeshorizonte.pe/ops/incidencias', description: 'Alertas operativas al canal de guardia', events: ['incident.created', 'incident.resolved', 'voucher.issued'], secretPrefix: 'whsec_Zm20', secretRotatedAt: '2026-08-10 08:00', status: 'pausado', health: 'ok', consecutiveFailures: 0, createdBy: 'U01', createdAt: '2026-08-10 08:00', apiVersion: '2026-09-01', pausedAt: '2026-09-29 08:00', pausedBy: 'U01' }
      ];
      ch = true;
    }
    if (!DB.webhookDeliveries) {
      const D = (id, wh, ev, ent, ts, attempt, code, ms, status, next) => ({ id, webhookId: wh, event: ev, eventId: 'evt_' + fakeHex(id, 16), entityId: ent, ts, attempt, code, ms, status, nextRetryAt: next || null });
      DB.webhookDeliveries = [
        D('WHD-004821', 'WH-0002', 'lead.created', 'LEAD-0231', '2026-09-29 09:03', 3, 503, 1204, 'reintentando', '2026-09-29 09:33'),
        D('WHD-004820', 'WH-0002', 'quote.sent', 'COT-2026-00190', '2026-09-29 08:48', 4, 503, 988, 'reintentando', '2026-09-29 10:48'),
        D('WHD-004819', 'WH-0003', 'incident.created', 'INC-0087', '2026-09-29 07:20', 1, 200, 141, 'entregado'),
        D('WHD-004818', 'WH-0003', 'incident.created', 'INC-0085', '2026-09-29 06:30', 1, 200, 156, 'entregado'),
        D('WHD-004817', 'WH-0001', 'payment.applied', 'PAG-01922', '2026-09-29 06:12', 1, 200, 188, 'entregado'),
        D('WHD-004816', 'WH-0002', 'quote.sent', 'COT-2026-00189', '2026-09-28 18:20', 6, 0, 30000, 'fallido'),
        D('WHD-004815', 'WH-0003', 'voucher.issued', 'VOU-2026-01204', '2026-09-28 11:40', 1, 200, 132, 'entregado'),
        D('WHD-004814', 'WH-0001', 'reservation.confirmed', 'RES-2026-000345', '2026-09-27 16:05', 2, 200, 240, 'entregado'),
        D('WHD-004813', 'WH-0001', 'invoice.issued', 'B001-00008812', '2026-09-25 16:41', 1, 200, 176, 'entregado'),
        D('WHD-004812', 'WH-0001', 'payment.applied', 'PAG-01921', '2026-09-25 16:40', 1, 200, 182, 'entregado'),
        D('WHD-004811', 'WH-0002', 'quote.approved', 'COT-2026-00186', '2026-09-24 10:15', 1, 200, 311, 'entregado'),
        D('WHD-004810', 'WH-0001', 'invoice.issued', 'F001-00001482', '2026-09-11 12:02', 1, 200, 201, 'entregado')
      ];
      ch = true;
    }
    if (!DB.oauthApps) {
      DB.oauthApps = [{ id: 'OAP-0001', tenantId: TID(), name: 'Contador Digital Andino', vendor: 'Contador Digital Andino S.A.C.', clientId: 'qts_cli_8f2a61c4', redirectUris: ['https://app.contadorandino.pe/oauth/callback'], scopes: ['invoices:read', 'payments:read'], status: 'activa', createdAt: '2026-07-01 10:00', createdBy: 'U01', tokens: 1, lastTokenAt: '2026-09-29 07:30' }];
      ch = true;
    }
    /* Sincronía: el plan del tenant puede cambiar desde la consola (admin/tenants) */
    const sub = DB.subscription;
    if (sub.plan !== DB.tenant.plan) { sub.plan = DB.tenant.plan; ch = true; }
    if (ch) Store.save();
  }

  /* ---------------- Reglas de suscripción, uso y entitlements ---------------- */
  const cyclePrice = (planId, cycle) => cycle === 'anual' ? planOf(planId).priceYear : planOf(planId).price;
  const monthlyOf = (planId, cycle) => cycle === 'anual' ? planOf(planId).priceYear / 12 : planOf(planId).price;
  const activeAddons = (sub) => sub.addons.filter(a => !a.removedAt);
  const addonPrice = (a, plan) => addonOf(a.key).price(plan) * (a.qty || 1);
  const addonsTotal = (sub) => sum(activeAddons(sub).filter(a => !addonOf(a.key).incl.includes(sub.plan)), a => addonPrice(a, sub.plan));
  function effLimits(sub, planId) {
    const L = Object.assign({}, planOf(planId || sub.plan).limits);
    activeAddons(sub).forEach(a => {
      if (a.key === 'whatsapp_pack') L.whatsapp += 1000 * a.qty;
      if (a.key === 'storage_pack') L.storageGB += 50 * a.qty;
      if (a.key === 'extra_users' && L.users != null) L.users += a.qty;
    });
    return L;
  }
  function usageNow(sub) {
    const m = MONTH(); const u = sub.usage;
    return {
      users: DB.users.filter(x => x.status === 'activo' && BILLABLE.includes(x.role)).length,
      sedes: DB.sedes.filter(s => s.status === 'activa').length,
      storageGB: u.storageGB,
      reservations: u.reservationsBase + DB.reservations.filter(r => String(r.createdAt || '').startsWith(m)).length,
      whatsapp: u.whatsappBase + DB.notifications.filter(n => n.channel === 'WhatsApp' && String(n.ts).startsWith(m)).length,
      email: u.emailBase + DB.notifications.filter(n => n.channel === 'Email' && String(n.ts).startsWith(m)).length,
      apiCalls: u.apiCalls,
      apiKeys: DB.apiKeys.filter(k => k.tenantId === TID() && k.status === 'activa').length,
      webhooks: DB.webhooks.filter(w => w.tenantId === TID() && w.status !== 'eliminado').length
    };
  }
  const tenantPlan = (tid) => tid === TID() ? DB.subscription.plan : (tenantRow(tid) || {}).plan;
  /* Resolución de entitlement: override vigente > add-on activo > plan */
  function ent(key, tid, planId) {
    tid = tid || TID();
    const f = DB.featureFlags.find(x => x.key === key); if (!f) return { val: true, src: 'sin flag' };
    const ov = f.overrides.find(o => o.tenantId === tid && (!o.until || o.until >= TODAY()));
    if (ov && !planId) return { val: ov.value, src: 'override', ov };
    if (tid === TID() && f.addon && !planId && activeAddons(DB.subscription).some(a => a.key === f.addon) && addonOf(f.addon).avail.includes(DB.subscription.plan)) return { val: true, src: 'add-on' };
    const p = planId || tenantPlan(tid);
    return { val: f.plans[p], src: 'plan' };
  }
  const entOn = (v) => v === true || (typeof v === 'string' && v);
  function periodInfo(sub) { const pd = daysBetween(sub.periodStart, sub.periodEnd) + 1; const rem = Math.max(0, Math.min(pd, daysBetween(TODAY(), sub.periodEnd) + 1)); return { pd, rem }; }
  function classify(sub, np, nc) {
    if (np === sub.plan && nc === sub.cycle) return 'none';
    if (rank(np) > rank(sub.plan)) return 'upgrade';
    if (rank(np) < rank(sub.plan)) return 'downgrade';
    return nc === 'anual' ? 'upgrade' : 'downgrade';
  }
  function prorate(sub, np, nc) {
    const { pd, rem } = periodInfo(sub);
    const credit = r2(cyclePrice(sub.plan, sub.cycle) * rem / pd);
    const toAnnual = nc === 'anual' && sub.cycle !== 'anual';
    const charge = toAnnual ? cyclePrice(np, 'anual') : r2(cyclePrice(np, nc) * rem / pd);
    return { pd, rem, credit, charge, net: r2(charge - credit), toAnnual };
  }
  /* Bloqueos de downgrade: consumo actual por encima del plan destino o módulos en uso que el plan destino no incluye */
  function downgradeBlockers(sub, np) {
    const L = effLimits(sub, np); const U = usageNow(sub); const out = [];
    [['users', 'Usuarios activos facturables'], ['sedes', 'Sedes activas'], ['storageGB', 'Almacenamiento (GB)'], ['apiKeys', 'API keys activas'], ['webhooks', 'Webhooks configurados']].forEach(([k, l]) => { if (L[k] != null && U[k] > L[k]) out.push(l + ': ' + fmtN(U[k], k === 'storageGB' ? 1 : 0) + ' en uso > ' + fmtN(L[k], k === 'storageGB' ? 1 : 0) + ' permitidos en ' + np); });
    const inUse = [
      ['ecommerce', 'E-commerce con pedidos recientes', () => DB.ecomOrders.length > 0],
      ['cms', 'CMS con páginas publicadas', () => DB.cms.some(c => c.status === 'publicado')],
      ['mobile_apps', 'Apps móviles con guías/conductores vinculados', () => DB.users.some(u => (u.role === 'guide' || u.role === 'driver') && u.status === 'activo')],
      ['multi_sede', 'Multi-sede (' + U.sedes + ' sedes activas)', () => U.sedes > 1],
      ['oauth_apps', 'Aplicaciones OAuth autorizadas', () => DB.oauthApps.some(a => a.tenantId === TID() && a.status === 'activa')],
      ['integrations', 'Integraciones por adapters activas', () => DB.integrations.some(i => i.status === 'activo')]
    ];
    inUse.forEach(([k, l, test]) => { const v = ent(k, TID(), np).val; const hasAddon = activeAddons(sub).some(a => (addonOf(a.key).feature === k) && addonOf(a.key).avail.includes(np)); if (!entOn(v) && !hasAddon && test()) out.push('Módulo en uso no incluido en ' + np + ': ' + l); });
    return out;
  }
  const tenantEmail = (tid) => tid === TID() ? DB.subscription.billing.email : ((tenantRow(tid) || {}).adminEmail || 'admin@' + tid.toLowerCase() + '.pe');
  function newInvoice(tid, lines, opts) {
    opts = opts || {}; const cfg = DB.platformConfig;
    const id = cfg.invoiceSeries + '-' + String(cfg.nextInvoice++).padStart(8, '0');
    const subtotal = r2(sum(lines, 'amount')); const igv = r2(subtotal * cfg.igvPct / 100);
    const t = tenantRow(tid) || {}; const bill = tid === TID() ? DB.subscription.billing : { name: t.name, ruc: t.ruc, address: (cfg.tenantBilling[tid] || {}).address };
    const pm = tid === TID() ? (DB.subscription.paymentMethod ? DB.subscription.paymentMethod.brand + ' •••• ' + DB.subscription.paymentMethod.last4 : null) : (cfg.tenantBilling[tid] || {}).pm;
    const ts = nowStr();
    const inv = { id, tenantId: tid, kind: opts.kind || 'suscripcion', period: MONTH(), periodFrom: opts.from || TODAY(), periodTo: opts.to || TODAY(), issueDate: TODAY(), dueDate: opts.due || TODAY(), lines, subtotal, igv, total: r2(subtotal + igv), currency: 'PEN', status: opts.status || 'pagada', paidAt: (opts.status || 'pagada') === 'pagada' ? ts : null, method: pm, attempts: (opts.status || 'pagada') === 'pagada' ? [{ ts, result: 'exitoso', code: '00', msg: 'Aprobado' }] : [], dunning: null, sunat: 'aceptado', hash: fakeHex(id + ts, 28), billTo: { name: bill.name, ruc: bill.ruc, address: bill.address }, note: opts.note || '' };
    DB.platformInvoices.unshift(inv); Store.save();
    return inv;
  }

  /* ---------------- Documento de factura de la plataforma (.doc) ---------------- */
  function invoiceDoc(inv) {
    const I = DB.platformConfig.issuer;
    return '<div class="doc"><div class="doc-head"><div><h2 style="margin-bottom:4px">' + esc(I.name) + '</h2><div class="muted">RUC ' + esc(I.ruc) + '</div><div class="muted">' + esc(I.address) + '</div><div class="muted">' + esc(I.email) + ' · ' + esc(I.web) + '</div></div>' +
      '<div style="text-align:right"><div class="muted" style="font-size:.72rem;letter-spacing:.06em">FACTURA ELECTRÓNICA</div><h2 class="mono" style="margin:2px 0">' + esc(inv.id) + '</h2><div>Emisión: ' + date(inv.issueDate) + '</div><div>Vencimiento: ' + date(inv.dueDate) + '</div></div></div>' +
      '<table><tbody><tr><td style="width:120px" class="muted">Cliente</td><td><b>' + esc(inv.billTo.name) + '</b></td></tr><tr><td class="muted">RUC</td><td>' + esc(inv.billTo.ruc) + '</td></tr><tr><td class="muted">Dirección</td><td>' + esc(inv.billTo.address || '—') + '</td></tr><tr><td class="muted">Tenant</td><td>' + esc(inv.tenantId) + ' · ' + (inv.kind === 'prorrateo' ? 'Cargo prorrateado' : inv.kind === 'addon' ? 'Add-on' : 'Suscripción periodo ' + date(inv.periodFrom) + ' – ' + date(inv.periodTo)) + '</td></tr></tbody></table>' +
      '<table><thead><tr><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">P. unit.</th><th style="text-align:right">Importe</th></tr></thead><tbody>' +
      inv.lines.map(l => '<tr><td>' + esc(l.desc) + '</td><td style="text-align:right">' + fmtN(l.qty || 1, 0) + '</td><td style="text-align:right">' + fmtN(l.unit != null ? l.unit : l.amount, 2) + '</td><td style="text-align:right">' + fmtN(l.amount, 2) + '</td></tr>').join('') + '</tbody></table>' +
      '<table class="tot"><tbody><tr><td>Op. gravada</td><td style="text-align:right">' + money(inv.subtotal) + '</td></tr><tr><td>IGV ' + DB.platformConfig.igvPct + ' %</td><td style="text-align:right">' + money(inv.igv) + '</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>' + money(inv.total) + '</b></td></tr></tbody></table>' +
      '<p class="muted" style="margin-top:14px;font-size:.74rem">Forma de pago: ' + esc(inv.method || 'Transferencia bancaria') + ' · Estado: ' + esc((ST[inv.status] || [inv.status])[0]) + (inv.paidAt ? ' el ' + datetime(inv.paidAt) : '') + '<br>Representación impresa de la factura electrónica. Estado OSE/SUNAT: aceptada. Resumen (hash): ' + esc(inv.hash) + '<br>Servicio SaaS prestado por ' + esc(I.name) + '. El detalle de consumo del periodo está disponible en Administración › Suscripción y uso.</p></div>';
  }
  function showInvoice(inv, extraActions) {
    UI.modal({ title: 'Factura ' + esc(inv.id), sub: 'Vista del comprobante. En producción el PDF se genera por job en la cola documents y se envía al correo de facturación.', size: 'lg', body: invoiceDoc(inv) + (inv.attempts.length ? '<div class="section-title" style="margin-top:16px">Intentos de cobro</div>' + tbl(['Fecha', 'Resultado', 'Código', 'Detalle'], inv.attempts.map(a => '<tr><td>' + datetime(a.ts) + '</td><td>' + B(a.result) + '</td><td class="mono">' + esc(a.code) + '</td><td class="small">' + esc(a.msg) + '</td></tr>')) : ''), actions: (extraActions || []).concat([{ label: 'Cerrar' }]) });
  }

  /* ---------------- Medidor de consumo ---------------- */
  function meter(label, used, limit, opts) {
    opts = opts || {}; const dec = opts.dec || 0;
    if (limit === 0) return '<div class="pl-meter"><div class="row between small"><span>' + esc(label) + '</span><b class="num">' + fmtN(used, dec) + '</b></div>' + UI.progress(0) + '<div class="xs faint">No incluido en su plan' + (opts.hint ? ' · ' + esc(opts.hint) : '') + '</div></div>';
    const unl = limit == null; const pct = unl ? 0 : used / limit * 100;
    const tone = pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : 'ok';
    return '<div class="pl-meter"><div class="row between small"><span>' + esc(label) + '</span><b class="num" style="white-space:nowrap">' + fmtN(used, dec) + ' <span class="faint">/ ' + (unl ? 'Ilimitado' : fmtN(limit, dec)) + '</span></b></div>' + UI.progress(unl ? 4 : pct, unl ? '' : tone) +
      '<div class="row between xs faint" style="flex-wrap:nowrap"><span style="min-width:0">' + esc(opts.hint || '') + '</span><span style="white-space:nowrap">' + (unl ? 'Sin límite' : (pct >= 100 ? '<b style="color:var(--bad)">Límite alcanzado</b>' : pct >= 80 ? '<b style="color:var(--warn)">' + fmtN(pct, 0) + ' % · aviso</b>' : fmtN(pct, 0) + ' %')) + '</span></div></div>';
  }
  function meterDefs(sub) {
    const L = effLimits(sub); const U = usageNow(sub);
    return [
      { k: 'users', label: 'Usuarios activos facturables', used: U.users, limit: L.users, hint: 'Internos + guías y conductores con app' },
      { k: 'sedes', label: 'Sedes activas', used: U.sedes, limit: L.sedes },
      { k: 'storageGB', label: 'Almacenamiento', used: U.storageGB, limit: L.storageGB, dec: 1, hint: 'GB en documentos y adjuntos' },
      { k: 'reservations', label: 'Reservas creadas en el mes', used: U.reservations, limit: L.reservations },
      { k: 'whatsapp', label: 'Envíos WhatsApp del mes', used: U.whatsapp, limit: L.whatsapp, hint: 'Incluye paquetes add-on' },
      { k: 'email', label: 'Envíos de email del mes', used: U.email, limit: L.email },
      { k: 'apiCalls', label: 'Llamadas API del mes', used: U.apiCalls, limit: L.apiCalls, hint: 'Todas las API keys y apps OAuth' }
    ];
  }

  /* =====================================================================
     ADMIN / SUSCRIPCIÓN (Tenant Admin)
     ===================================================================== */
  App.register('admin/suscripcion', (el, params) => {
    ensure();
    const title = 'Suscripción y uso';
    if (!Auth.can('admin.billing.manage')) return denied(el, title, 'admin.billing.manage');
    const sub = DB.subscription; const plan = planOf(sub.plan);
    const meters = meterDefs(sub);
    const warn = meters.filter(m => m.limit && m.used / m.limit >= 0.8);
    const invs = DB.platformInvoices.filter(i => i.tenantId === TID());
    const unpaid = invs.filter(i => ['pendiente', 'fallida', 'vencida'].includes(i.status));
    const renew = addDays(sub.periodEnd, 1);
    const est = nextCharge(sub);
    const pm = sub.paymentMethod;

    let banners = '';
    if (sub.status === 'cancel_programada') banners += UI.alert('warn', '<b>Cancelación programada para el ' + date(sub.cancelAt) + '.</b> Mantiene acceso completo hasta esa fecha; después la cuenta pasa a solo lectura por 30 días para exportar datos y luego se elimina según la política de retención. <button class="btn xs" id="sb-resume" style="margin-left:6px">' + ic('refresh') + 'Reanudar suscripción</button>');
    if (sub.pendingChange) banners += UI.alert('info', '<b>Cambio programado:</b> plan ' + esc(sub.pendingChange.plan) + ' (' + esc(sub.pendingChange.cycle) + ') desde el ' + date(sub.pendingChange.effective) + '. Hasta entonces conserva su plan actual. <button class="btn xs" id="sb-undo" style="margin-left:6px">' + ic('x') + 'Anular cambio</button>');
    if (unpaid.length) banners += UI.alert('bad', '<b>' + unpaid.length + ' factura(s) de la plataforma impaga(s)</b> por ' + money(sum(unpaid, 'total')) + '. Reintentos automáticos a 1, 3 y 7 días; al agotarse, el servicio se suspende. <button class="btn xs danger" id="sb-payall" style="margin-left:6px">Pagar ahora</button>');
    if (warn.length) banners += UI.alert('warn', '<b>Consumo alto:</b> ' + warn.map(m => esc(m.label) + ' al ' + fmtN(m.used / m.limit * 100, 0) + ' %').join(' · ') + '. Al llegar al 100 % los envíos de mensajería se encolan y la API responde 429 hasta el siguiente periodo o hasta contratar un add-on.');

    el.innerHTML = page(
      UI.pageHeader({ title, crumbs: crumbsT(title), subtitle: 'Plan contratado, consumo del periodo frente a los límites, add-ons, facturas de la plataforma y método de pago de ' + esc(DB.tenant.short) + '.',
        actions: '<button class="btn" id="sb-coupon">' + ic('tag') + 'Aplicar cupón</button><button class="btn primary" id="sb-plan">' + ic('layers') + 'Cambiar plan</button>' }) +
      banners +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Plan actual', value: esc(plan.id), sub: money(cyclePrice(plan.id, sub.cycle), 'PEN', 0) + (sub.cycle === 'anual' ? ' / año' : ' / mes') + ' + IGV', tone: 'accent', icon: 'layers' }) +
        UI.kpi({ label: 'Próxima renovación', value: date(renew), sub: sub.status === 'cancel_programada' ? 'No se renovará' : 'en ' + daysBetween(TODAY(), renew) + ' días · ' + (sub.autoRenew ? 'automática' : 'manual'), tone: sub.status === 'cancel_programada' ? 'sun' : 'info', icon: 'calendar' }) +
        UI.kpi({ label: 'Próximo cargo estimado', value: money(est.total, 'PEN', 0), sub: 'incluye IGV' + (sub.coupon ? ' · cupón ' + esc(sub.coupon.code) : ''), tone: 'violet', icon: 'receipt' }) +
        UI.kpi({ label: 'Método de pago', value: pm ? esc(pm.brand) + ' •••• ' + esc(pm.last4) : 'Sin tarjeta', sub: pm ? 'vence ' + esc(pm.exp) : 'Registre un método de pago', tone: pm ? 'ok' : 'bad', icon: 'card' }) +
      '</div>' +
      '<div class="grid g-2-1" style="margin-top:16px">' +
        UI.card('Consumo del periodo', '<div class="pl-meters">' + meters.map(m => meter(m.label, m.used, m.limit, { dec: m.dec, hint: m.hint })).join('') + '</div>', { sub: 'Periodo ' + date(sub.periodStart) + ' – ' + date(sub.periodEnd) + ' · contadores consolidados cada noche (job usage:consolidate)', actions: '<span class="xs faint">Avisos al 80 % y 100 %</span>' }) +
        '<div class="col" style="gap:16px">' +
          UI.card('Plan y periodo', UI.dl([
            ['Estado', B(sub.status)], ['Ciclo de facturación', sub.cycle === 'anual' ? 'Anual (2 meses de ahorro)' : 'Mensual'], ['Periodo actual', date(sub.periodStart) + ' – ' + date(sub.periodEnd)],
            ['Periodo de prueba', date(sub.trialStart) + ' – ' + date(sub.trialEnd) + ' · finalizado'], ['Cliente desde', date(sub.customerSince)],
            ['Saldo a favor', sub.creditBalance ? money(sub.creditBalance) : '—'], ['Cupón', sub.coupon ? '<span class="tag mono">' + esc(sub.coupon.code) + '</span> ' + esc(couponLabel(sub.coupon)) + ' · ' + sub.coupon.remaining + ' ciclo(s)' : '—']
          ]) + '<div class="divider" style="margin:12px 0"></div><label class="switch"><input type="checkbox" id="sb-auto"' + (sub.autoRenew ? ' checked' : '') + (sub.status === 'cancel_programada' ? ' disabled' : '') + '> Renovación automática con el método de pago registrado</label>',
            { footer: '<div class="row between" style="width:100%"><span class="xs faint">ID ' + esc(sub.id) + '</span>' + (sub.status === 'cancel_programada' ? '' : '<button class="btn sm danger" id="sb-cancel">' + ic('x') + 'Cancelar suscripción</button>') + '</div>' }) +
          UI.card('Módulos habilitados', '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 14px">' + DB.featureFlags.filter(f => f.kind !== 'beta' || entOn(ent(f.key).val)).map(f => { const e = ent(f.key); const on = entOn(e.val); return '<div class="row between small" style="flex-wrap:nowrap"><span class="row" style="gap:7px;flex-wrap:nowrap;min-width:0"><span style="color:var(--' + (on ? 'ok' : 'fg-3') + ')">' + ic(on ? 'check' : 'x') + '</span><span style="' + (on ? '' : 'color:var(--fg-3)') + '">' + esc(f.label) + '</span></span>' + (on && e.src !== 'plan' ? '<span class="tag">' + esc(e.src) + '</span>' : typeof e.val === 'string' ? '<span class="tag">' + esc(e.val) + '</span>' : '') + '</div>'; }).join('') + '</div>', { sub: 'Entitlements del plan ' + esc(plan.id) + ' + add-ons + excepciones vigentes' }) +
        '</div>' +
      '</div>' +
      planRulesSection(sub) +
      '<div id="sb-tabs" style="margin-top:16px"></div>'
    );
    el.querySelectorAll('[data-upg]').forEach(x => x.onclick = () => changePlanModal(sub, x.dataset.upg));
    const $ = (s) => el.querySelector(s);
    const tabIds = ['addons', 'facturas', 'pago', 'historial'];
    const startTab = tabIds.includes(params[0]) ? params[0] : 'addons';
    UI.tabs($('#sb-tabs'), [
      { id: 'addons', label: 'Add-ons', count: activeAddons(sub).length, render: (b) => renderAddons(b, sub) },
      { id: 'facturas', label: 'Facturas de la plataforma', count: invs.length, render: (b) => renderTenantInvoices(b, invs) },
      { id: 'pago', label: 'Método de pago y facturación', render: (b) => renderPayment(b, sub) },
      { id: 'historial', label: 'Historial de consumo', render: (b) => renderHistory(b, sub) }
    ], startTab, { onChange: (id) => setHash('#/admin/suscripcion' + (id === 'addons' ? '' : '/' + id)) });

    $('#sb-plan').onclick = () => changePlanModal(sub);
    $('#sb-coupon').onclick = () => couponModal(sub);
    $('#sb-auto').onchange = (e) => { if (!guard('admin.billing.manage')) return; const b = sub.autoRenew; sub.autoRenew = e.target.checked; Store.save(); Audit.log('Suscripción', sub.id, 'renovacion_automatica', b ? 'sí' : 'no', sub.autoRenew ? 'sí' : 'no'); UI.toast('Renovación automática ' + (sub.autoRenew ? 'activada.' : 'desactivada: recibirá la factura para pago manual.')); };
    if ($('#sb-cancel')) $('#sb-cancel').onclick = () => cancelModal(sub);
    if ($('#sb-resume')) $('#sb-resume').onclick = () => { const b = sub.status; sub.status = 'activa'; sub.cancelAt = null; sub.autoRenew = true; Store.save(); Audit.log('Suscripción', sub.id, 'reanudar', b, 'activa'); Notify.push('suscripcion.reanudada', 'Email', 'ops@kipucontrol.com', 'Tenant ' + TID() + ' reanudó su suscripción'); UI.toast('Suscripción reanudada. Se renovará el ' + date(renew) + '.'); App.render(); };
    if ($('#sb-undo')) $('#sb-undo').onclick = () => { const pc = sub.pendingChange; sub.pendingChange = null; Store.save(); Audit.log('Suscripción', sub.id, 'anular_cambio_programado', pc.plan + ' ' + pc.cycle, sub.plan + ' ' + sub.cycle); UI.toast('Cambio programado anulado.'); App.render(); };
    if ($('#sb-payall')) $('#sb-payall').onclick = () => payInvoices(unpaid);
  });

  /* «Qué incluye su plan»: reglas de reserva incluidas/bloqueadas y comparativo de upgrades (matriz DEMO) */
  function planRulesSection(sub) {
    const cur = sub.plan; const inc = rulesOfPlan(cur); const incIds = new Set(inc.map(r => r.id)); const blocked = allRules().filter(r => !incIds.has(r.id));
    const chips = (list, locked) => ruleGroups().map(g => { const rs = list.filter(r => r.group === g); if (!rs.length) return '';
      return '<div class="pl-rg"><div class="xs">' + esc(g) + '</div><div class="pl-rchips">' + rs.map(r => '<span class="tag' + (locked ? ' lk' : '') + '" title="' + esc(r.id + ' · ' + r.desc) + '">' + (locked ? ic('lock').replace('<svg', '<svg width="11" height="11" style="vertical-align:-1px"') + ' ' : '') + esc(r.name) + (locked ? ' · desde ' + esc(minPlanOf(r)) : r.enabled ? '' : ' (inactiva)') + '</span>').join('') + '</div></div>'; }).join('');
    const rows = PLAN_ORDER.map((p, i) => { const prev = i ? rulesOfPlan(PLAN_ORDER[i - 1]).map(r => r.id) : []; const adds = rulesOfPlan(p).filter(r => !prev.includes(r.id)); const isCur = p === cur; const up = rank(p) > rank(cur);
      return '<tr' + (isCur ? ' style="background:var(--accent-soft)"' : '') + '><td><b>' + esc(p) + '</b>' + (isCur ? ' <span class="tag">Su plan</span>' : '') + '</td><td class="num">' + money(planOf(p).price, 'PEN', 0) + '</td><td class="num">' + rulesOfPlan(p).length + '</td><td class="small">' + (i ? '<span class="faint">Suma a ' + esc(PLAN_ORDER[i - 1]) + ':</span> ' : '<span class="faint">Base:</span> ') + (adds.length ? adds.map(r => esc(r.name)).join(', ') : '—') + '</td><td>' + (up ? '<button class="btn xs primary" data-upg="' + esc(p) + '"' + (Auth.can('admin.billing.manage') ? '' : ' disabled title="Requiere permiso admin.billing.manage"') + '>' + ic('layers') + 'Mejorar a ' + esc(p) + '</button>' : '') + '</td></tr>'; });
    return '<div style="margin-top:16px" id="sb-rules">' + UI.card('Qué incluye su plan ' + DEMO_TAG,
      '<div class="grid g2"><div><div class="section-title">Reglas de reserva incluidas (' + inc.length + ')</div>' + (inc.length ? chips(inc, false) : UI.empty('Ninguna regla incluida.', 'shield')) + '</div>' +
      '<div><div class="section-title">No incluidas en ' + esc(cur) + ' (' + blocked.length + ')</div>' + (blocked.length ? chips(blocked, true) + '<p class="xs faint" style="margin:8px 0 0">En el centro de reglas aparecen con candado. Se habilitan al mejorar de plan; su configuración se conserva.</p>' : '<div style="margin-top:8px">' + UI.alert('ok', 'Su plan incluye todas las reglas del motor de reservas.') + '</div>') + '</div></div>' +
      '<div class="section-title" style="margin-top:16px">Comparativo de planes</div>' + tbl(['Plan', '#Precio / mes', '#Reglas', 'Qué suma cada plan', ''], rows) +
      '<p class="xs faint" style="margin:8px 0 0">' + esc((DB.planCatalogDemo && DB.planCatalogDemo.note) || '') + ' <a href="#/admin/reglas">Ir al centro de reglas</a>.</p>',
      { sub: 'Reglas del motor de reservas según el plan ' + esc(cur) + ' · matriz de demostración, se reemplazará por la definitiva' }) + '</div>';
  }
  function couponLabel(c) { return c.type === 'percent' ? '-' + c.value + ' %' : '-' + money(c.value, 'PEN', 0); }
  function nextCharge(sub) {
    const base = sub.pendingChange ? cyclePrice(sub.pendingChange.plan, sub.pendingChange.cycle) : cyclePrice(sub.plan, sub.cycle);
    const add = addonsTotal(sub) * (sub.cycle === 'anual' ? 12 : 1);
    let disc = 0; if (sub.coupon && sub.coupon.remaining > 0) disc = sub.coupon.type === 'percent' ? (base + add) * sub.coupon.value / 100 : sub.coupon.value;
    const credit = Math.min(sub.creditBalance || 0, base + add - disc);
    const net = Math.max(0, base + add - disc - credit);
    return { base, add, disc, credit, net, total: r2(net * 1.18) };
  }
  function payInvoices(list) {
    if (!guard('admin.billing.manage')) return;
    const sub = DB.subscription; const pm = sub.paymentMethod;
    if (!pm) { UI.toast('Registre un método de pago antes de pagar.', 'bad'); return; }
    UI.confirm({ title: 'Pagar facturas pendientes', message: 'Se cargará <b>' + money(sum(list, 'total')) + '</b> a la tarjeta ' + esc(pm.brand) + ' •••• ' + esc(pm.last4) + ' (' + list.length + ' factura(s)). La operación es idempotente: un segundo intento no genera un doble cargo.', confirmLabel: 'Pagar ahora', onConfirm: () => {
      const ts = nowStr();
      list.forEach(i => { const b = i.status; i.status = 'pagada'; i.paidAt = ts; i.method = pm.brand + ' •••• ' + pm.last4; i.attempts.push({ ts, result: 'exitoso', code: '00', msg: 'Pago manual desde el portal del tenant' }); if (i.dunning) i.dunning.nextRetryAt = null; Audit.log('Factura plataforma', i.id, 'pagar', b, 'pagada'); });
      if (sub.status === 'past_due') sub.status = 'activa';
      Store.save(); Notify.push('suscripcion.pago_recibido', 'Email', sub.billing.email, 'Pago recibido — ' + list.map(i => i.id).join(', '));
      UI.toast('Pago registrado. Comprobante enviado a ' + esc(sub.billing.email) + '.'); App.render();
    } });
  }

  /* ---- Add-ons ---- */
  function renderAddons(b, sub) {
    b.innerHTML = UI.alert('info', 'Los add-ons se facturan junto con la suscripción. Al contratar se cobra el prorrateo de los días restantes del periodo; al retirar, el add-on sigue activo hasta el cierre del periodo (sin reembolso parcial).') +
      tbl(['Add-on', 'Disponibilidad', '#Precio', 'Contratado', 'Acción'], ADDONS.map(a => {
        const cur = sub.addons.find(x => x.key === a.key && !x.removedAt);
        const incl = a.incl.includes(sub.plan); const avail = a.avail.includes(sub.plan);
        const price = a.price(sub.plan);
        const status = incl ? B('activo', 'Incluido en ' + sub.plan) : cur ? (cur.removeAt ? B('pendiente', 'Se retira el ' + date(cur.removeAt)) : B('activo', 'Activo' + (a.qty ? ' × ' + cur.qty : ''))) : avail ? '<span class="faint small">No contratado</span>' : B('inactivo', 'No disponible en ' + sub.plan);
        const act = incl ? '' : cur ? (cur.removeAt ? '<button class="btn xs" data-keep="' + a.key + '">Mantener</button>' : (a.qty ? '<button class="btn xs" data-adj="' + a.key + '">Ajustar</button> ' : '') + '<button class="btn xs danger" data-rm="' + a.key + '">Retirar</button>') : avail ? '<button class="btn xs primary" data-add="' + a.key + '">Contratar</button>' : '<span class="xs faint">Requiere ' + esc(a.avail.join(' / ')) + '</span>';
        return '<tr><td><b class="small">' + esc(a.label) + '</b><div class="xs faint">' + esc(a.desc) + (cur && cur.meta ? ' · <span class="mono">' + esc(cur.meta) + '</span> (SSL ' + esc(cur.ssl || 'pendiente') + ')' : '') + '</div></td><td class="small">' + esc(a.avail.join(', ')) + '</td><td class="num">' + (incl ? '—' : money(price, 'PEN', 0) + '<div class="xs faint">por ' + esc(a.unit) + '/mes</div>') + '</td><td>' + status + '</td><td style="white-space:nowrap">' + act + '</td></tr>';
      })) + '<div class="small muted" style="margin-top:10px">Total add-ons facturables: <b>' + money(addonsTotal(sub)) + '</b> / mes + IGV.</div>';
    b.querySelectorAll('[data-add]').forEach(x => x.onclick = () => addonModal(sub, x.dataset.add, null));
    b.querySelectorAll('[data-adj]').forEach(x => x.onclick = () => addonModal(sub, x.dataset.adj, sub.addons.find(a => a.key === x.dataset.adj && !a.removedAt)));
    b.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => removeAddon(sub, x.dataset.rm));
    b.querySelectorAll('[data-keep]').forEach(x => x.onclick = () => { const a = sub.addons.find(y => y.key === x.dataset.keep && !y.removedAt); a.removeAt = null; Store.save(); Audit.log('Suscripción', sub.id, 'addon_mantener', 'retiro programado', a.key); UI.toast('Se mantiene el add-on.'); App.render(); });
  }
  function addonModal(sub, key, cur) {
    if (!guard('admin.billing.manage')) return;
    const a = addonOf(key); const { pd, rem } = periodInfo(sub);
    if (!a.avail.includes(sub.plan)) { UI.toast('El add-on no está disponible en el plan ' + sub.plan + '.', 'bad'); return; }
    const fields = [];
    if (a.qty) fields.push({ id: 'ad-qty', label: 'Cantidad (' + a.unit + ')', type: 'number', min: 1, max: 50, value: cur ? cur.qty : 1, required: true, col: 6 });
    if (key === 'custom_domain') fields.push({ id: 'ad-dom', label: 'Dominio (subdominio de la agencia)', value: cur ? cur.meta : 'reservas.andeshorizonte.pe', required: true, col: 12, hint: 'Cree un registro CNAME hacia tenants.kipucontrol.com; el certificado SSL se emite automáticamente al validar el DNS.' });
    UI.modal({ title: (cur ? 'Ajustar ' : 'Contratar ') + esc(a.label), size: 'sm', body: UI.form(fields) + '<div id="ad-prev" style="margin-top:12px"></div>', onOpen: (m) => {
      const upd = () => { const q = a.qty ? Math.max(1, +m.querySelector('#ad-qty').value || 1) : 1; const delta = q - (cur ? cur.qty : 0); const pr = r2(a.price(sub.plan) * Math.max(0, delta) * rem / pd); m.querySelector('#ad-prev').innerHTML = UI.dl([['Precio mensual', money(a.price(sub.plan) * q)], ['Prorrateo hoy (' + rem + ' de ' + pd + ' días)', delta > 0 ? money(pr) + ' + IGV' : 'Sin cargo'], ['Desde el ' + date(addDays(sub.periodEnd, 1)), money(a.price(sub.plan) * q) + ' / mes + IGV']]); };
      m.querySelectorAll('input').forEach(i => i.oninput = upd); upd();
    }, actions: [{ label: 'Cancelar' }, { label: cur ? 'Guardar' : 'Contratar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false;
      const d = UI.formData(m); const q = a.qty ? Math.max(1, +d['ad-qty'] || 1) : 1;
      if (key === 'custom_domain' && !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(d['ad-dom'])) { UI.toast('Dominio inválido. Ejemplo: reservas.suagencia.pe', 'bad'); return false; }
      if (cur && a.qty && q < cur.qty && key === 'whatsapp_pack') { const L = effLimits(sub).whatsapp - 1000 * (cur.qty - q); if (usageNow(sub).whatsapp > L) { UI.toast('Regla SUB-BR-06: no puede reducir el paquete por debajo del consumo ya realizado en el periodo (' + fmtN(usageNow(sub).whatsapp, 0) + ' envíos). Aplíquelo desde el próximo periodo.', 'bad'); return false; } }
      const delta = q - (cur ? cur.qty : 0); const before = cur ? cur.key + ' × ' + cur.qty : '—';
      const pr = r2(a.price(sub.plan) * Math.max(0, delta) * rem / pd);
      if (cur) { cur.qty = q; if (key === 'custom_domain') { cur.meta = d['ad-dom']; cur.ssl = 'pendiente'; } }
      else sub.addons.push({ key, qty: q, since: TODAY(), meta: key === 'custom_domain' ? d['ad-dom'] : undefined, ssl: key === 'custom_domain' ? 'pendiente' : undefined });
      let inv = null;
      if (pr > 0) inv = newInvoice(TID(), [{ desc: 'Add-on ' + a.label + ' × ' + Math.max(0, delta) + ' — prorrateo ' + rem + '/' + pd + ' días', qty: 1, unit: pr, amount: pr }], { kind: 'addon', from: TODAY(), to: sub.periodEnd });
      Store.save(); Audit.log('Suscripción', sub.id, cur ? 'addon_ajustar' : 'addon_contratar', before, key + ' × ' + q + (inv ? ' · ' + inv.id : ''));
      Notify.push('suscripcion.addon', 'Email', sub.billing.email, 'Add-on ' + a.label + (cur ? ' ajustado' : ' contratado') + (inv ? ' · factura ' + inv.id : ''));
      UI.toast((cur ? 'Add-on actualizado' : 'Add-on contratado') + (inv ? '. Factura ' + inv.id + ' por ' + money(inv.total) + ' cargada a la tarjeta.' : '.')); App.render();
    } }] });
  }
  function removeAddon(sub, key) {
    if (!guard('admin.billing.manage')) return;
    const a = addonOf(key); const cur = sub.addons.find(x => x.key === key && !x.removedAt);
    const warnF = a.feature ? ' Al retirarlo se deshabilita la funcionalidad <b>' + esc(a.label) + '</b> desde el ' + date(addDays(sub.periodEnd, 1)) + ' (el backend responde 403 FEATURE_NOT_IN_PLAN).' : '';
    UI.confirm({ title: 'Retirar add-on', danger: true, message: 'El add-on <b>' + esc(a.label) + '</b> seguirá activo hasta el <b>' + date(sub.periodEnd) + '</b> y no se renovará.' + warnF, confirmLabel: 'Programar retiro', onConfirm: () => {
      cur.removeAt = sub.periodEnd; Store.save(); Audit.log('Suscripción', sub.id, 'addon_retirar', key + ' × ' + cur.qty, 'retiro ' + sub.periodEnd);
      UI.toast('Retiro programado para el ' + date(sub.periodEnd) + '.'); App.render();
    } });
  }

  /* ---- Facturas (tenant) ---- */
  function renderTenantInvoices(b, invs) {
    UI.dataTable(b, { rows: () => DB.platformInvoices.filter(i => i.tenantId === TID()), exportName: 'facturas_plataforma', searchPlaceholder: 'Buscar número o periodo…', search: (r) => r.id + ' ' + r.period + ' ' + r.kind,
      filters: [{ key: 'status', label: 'Estado', options: [['pagada', 'Pagada'], ['pendiente', 'Pendiente'], ['fallida', 'Cobro fallido'], ['vencida', 'Vencida'], ['anulada', 'Anulada']] }],
      columns: [
        { key: 'id', label: 'Número', render: r => '<span class="mono">' + esc(r.id) + '</span>' },
        { key: 'kind', label: 'Concepto', render: r => r.kind === 'prorrateo' ? 'Cambio de plan (prorrateo)' : r.kind === 'addon' ? 'Add-on (prorrateo)' : 'Suscripción ' + esc(r.period) },
        { key: 'issueDate', label: 'Emisión', render: r => date(r.issueDate) },
        { key: 'total', label: 'Total', align: 'num', render: r => money(r.total) },
        { key: 'status', label: 'Estado', render: r => B(r.status) },
        { key: 'sunat', label: 'SUNAT', render: r => B(r.sunat) },
        { key: '', label: '', sort: false, render: r => '<button class="btn xs" data-v="' + esc(r.id) + '">' + ic('eye') + 'Ver</button>' }
      ],
      onRow: (r) => openTenantInvoice(r),
      afterDraw: (c) => c.querySelectorAll('[data-v]').forEach(x => x.onclick = () => openTenantInvoice(DB.platformInvoices.find(i => i.id === x.dataset.v))),
      footer: (rows) => '<tr><td colspan="3"><b>Total</b></td><td class="num"><b>' + money(sum(rows, 'total')) + '</b></td><td colspan="3"></td></tr>' });
  }
  function openTenantInvoice(inv) {
    const acts = ['pendiente', 'fallida', 'vencida'].includes(inv.status) ? [{ label: 'Pagar ahora', cls: 'primary', icon: 'card', onClick: () => { UI.closeModal(); payInvoices([inv]); return false; } }] : [];
    acts.push({ label: 'Reenviar por correo', icon: 'mail', onClick: () => { Notify.push('factura_plataforma.reenvio', 'Email', DB.subscription.billing.email, 'Factura ' + inv.id); Audit.log('Factura plataforma', inv.id, 'reenviar', '', DB.subscription.billing.email); UI.toast('Factura reenviada a ' + esc(DB.subscription.billing.email) + '.'); return false; } });
    showInvoice(inv, acts);
  }

  /* ---- Método de pago y datos de facturación ---- */
  function renderPayment(b, sub) {
    const pm = sub.paymentMethod; const bl = sub.billing;
    b.innerHTML = '<div class="grid g2">' +
      UI.card('Método de pago', pm ? '<div class="row" style="gap:14px;flex-wrap:nowrap"><div class="ico-box info" style="width:44px;height:44px">' + ic('card') + '</div><div><b>' + esc(pm.brand) + ' •••• ' + esc(pm.last4) + '</b><div class="small muted">' + esc(pm.holder) + ' · vence ' + esc(pm.exp) + '</div><div class="xs faint">Token de pasarela <span class="mono">' + esc(pm.token.slice(0, 12)) + '…</span> · actualizado ' + date(pm.updatedAt) + ' por ' + esc(uName(pm.updatedBy)) + '</div></div></div>' : UI.empty('Sin método de pago registrado', 'card'),
        { sub: 'La tarjeta se tokeniza en la pasarela; la plataforma nunca almacena el número completo ni el CVV (PCI DSS SAQ-A).', footer: '<button class="btn sm primary" id="pm-upd">' + ic('edit') + (pm ? 'Actualizar tarjeta' : 'Registrar tarjeta') + '</button>' }) +
      UI.card('Datos de facturación', '<div id="bl-form">' + UI.form([
        { id: 'bl-ruc', label: 'RUC', value: bl.ruc, required: true, col: 4 }, { id: 'bl-name', label: 'Razón social', value: bl.name, required: true, col: 8 },
        { id: 'bl-addr', label: 'Dirección fiscal', value: bl.address, required: true, col: 8 }, { id: 'bl-ubi', label: 'Ubigeo', value: bl.ubigeo, col: 4 },
        { id: 'bl-mail', label: 'Correo para comprobantes', type: 'email', value: bl.email, required: true, col: 6 }, { id: 'bl-contact', label: 'Contacto de facturación', value: bl.contact, col: 6 },
        { id: 'bl-doc', label: 'Comprobante', type: 'select', options: ['Factura'], value: bl.docType, col: 6, hint: 'Empresas con RUC 20 reciben factura electrónica.' }
      ]) + '</div>', { sub: 'Se usan en las próximas facturas; las emitidas no cambian (snapshot).', footer: '<button class="btn sm primary" id="bl-save">' + ic('check') + 'Guardar datos</button>' }) +
      '</div>';
    b.querySelector('#pm-upd').onclick = () => cardModal(sub);
    b.querySelector('#bl-save').onclick = () => {
      if (!guard('admin.billing.manage')) return;
      const f = b.querySelector('#bl-form'); if (!UI.validate(f)) return; const d = UI.formData(f);
      if (!/^(10|15|17|20)\d{9}$/.test(d['bl-ruc'])) { UI.toast('RUC inválido: 11 dígitos, inicia en 10, 15, 17 o 20 (regla SUB-BR-09).', 'bad'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d['bl-mail'])) { UI.toast('Correo inválido.', 'bad'); return; }
      const before = bl.ruc + ' · ' + bl.email;
      Object.assign(bl, { ruc: d['bl-ruc'], name: d['bl-name'], address: d['bl-addr'], ubigeo: d['bl-ubi'], email: d['bl-mail'], contact: d['bl-contact'], docType: d['bl-doc'] });
      Store.save(); Audit.log('Suscripción', sub.id, 'datos_facturacion', before, bl.ruc + ' · ' + bl.email); UI.toast('Datos de facturación actualizados.');
    };
  }
  function cardModal(sub) {
    if (!guard('admin.billing.manage')) return;
    UI.modal({ title: 'Actualizar tarjeta', size: 'sm', sub: 'Simulación del formulario embebido de la pasarela (iframe). Los datos no pasan por los servidores de la plataforma.', body: UI.form([
      { id: 'cc-num', label: 'Número de tarjeta', placeholder: '4111 1111 1111 1111', required: true, col: 12 }, { id: 'cc-name', label: 'Titular', value: sub.paymentMethod ? sub.paymentMethod.holder : '', required: true, col: 12 },
      { id: 'cc-exp', label: 'Vencimiento (MM/AAAA)', placeholder: '09/2029', required: true, col: 6 }, { id: 'cc-cvc', label: 'CVV', type: 'password', required: true, col: 6 }
    ]) + '<p class="xs faint" style="margin-top:10px">Se realiza una validación de S/ 1.00 que se revierte de inmediato (3-D Secure si el emisor lo exige).</p>', actions: [{ label: 'Cancelar' }, { label: 'Guardar tarjeta', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = UI.formData(m); const num = d['cc-num'].replace(/\D/g, '');
      const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
      if (num.length < 13 || num.length > 19 || !luhn(num)) { UI.toast('Número de tarjeta inválido (verificación Luhn).', 'bad'); return false; }
      const mm = /^(\d{2})\/(\d{4})$/.exec(d['cc-exp']); if (!mm || +mm[1] < 1 || +mm[1] > 12 || (mm[2] + '-' + mm[1]) < MONTH()) { UI.toast('Fecha de vencimiento inválida o pasada.', 'bad'); return false; }
      if (!/^\d{3,4}$/.test(d['cc-cvc'])) { UI.toast('CVV inválido.', 'bad'); return false; }
      const brand = /^4/.test(num) ? 'Visa' : /^5[1-5]|^2[2-7]/.test(num) ? 'Mastercard' : /^3[47]/.test(num) ? 'American Express' : 'Diners Club';
      const before = sub.paymentMethod ? sub.paymentMethod.brand + ' •••• ' + sub.paymentMethod.last4 : '—';
      sub.paymentMethod = { brand, last4: num.slice(-4), exp: d['cc-exp'], holder: d['cc-name'].toUpperCase(), token: 'pm_' + fakeHex(num + Date.now(), 20), updatedAt: TODAY(), updatedBy: Auth.user.id };
      DB.platformConfig.tenantBilling[TID()].pm = brand + ' •••• ' + num.slice(-4); DB.platformConfig.tenantBilling[TID()].cardOk = true;
      Store.save(); Audit.log('Suscripción', sub.id, 'metodo_pago', before, brand + ' •••• ' + num.slice(-4));
      Notify.push('suscripcion.metodo_pago', 'Email', sub.billing.email, 'Se actualizó el método de pago de la suscripción');
      UI.toast('Tarjeta ' + brand + ' •••• ' + num.slice(-4) + ' registrada.'); App.render();
    } }] });
  }

  /* ---- Historial de consumo ---- */
  function renderHistory(b, sub) {
    const U = usageNow(sub); const H = sub.usageHistory.concat([{ month: MONTH(), reservations: U.reservations, whatsapp: U.whatsapp, email: U.email, apiCalls: U.apiCalls, storageGB: U.storageGB }]);
    const lab = H.map(h => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'][+h.month.slice(5) - 1]);
    const L = effLimits(sub);
    b.innerHTML = '<div class="grid g2">' +
      UI.card('Mensajería por mes', UI.chart.bars({ labels: lab, series: [{ name: 'WhatsApp', values: H.map(h => h.whatsapp) }, { name: 'Email (÷10)', values: H.map(h => Math.round(h.email / 10)) }], height: 200 }), { sub: 'Límite WhatsApp vigente: ' + fmtQ(L.whatsapp) + ' / mes' }) +
      UI.card('Llamadas API por mes', UI.chart.line({ labels: lab, series: [{ name: 'Llamadas API', values: H.map(h => h.apiCalls) }], height: 200 }), { sub: 'Cuota del plan: ' + fmtQ(L.apiCalls) + ' / mes' }) +
      '</div><div style="margin-top:16px">' + UI.card('Detalle mensual', tbl(['Mes', '#Reservas', '#WhatsApp', '#Emails', '#Llamadas API', '#Almacenamiento GB'], H.slice().reverse().map(h => '<tr><td>' + esc(h.month) + (h.month === MONTH() ? ' <span class="tag">en curso</span>' : '') + '</td><td class="num">' + fmtN(h.reservations, 0) + '</td><td class="num">' + fmtN(h.whatsapp, 0) + '</td><td class="num">' + fmtN(h.email, 0) + '</td><td class="num">' + fmtN(h.apiCalls, 0) + '</td><td class="num">' + fmtN(h.storageGB, 1) + '</td></tr>')), { tight: true, sub: 'Contadores en Redis consolidados diariamente en usage_counters (job usage:consolidate 00:15)' }) + '</div>';
  }

  /* ---- Cambio de plan con prorrateo y validación de downgrade ---- */
  function changePlanModal(sub, pre) {
    if (!guard('admin.billing.manage')) return;
    if (sub.status === 'cancel_programada') { UI.toast('Reanude la suscripción antes de cambiar de plan.', 'bad'); return; }
    let sel = pre && planOf(pre).id === pre ? pre : sub.plan, cyc = sub.cycle;
    const ruleDiff = (a, b) => { const A = rulesOfPlan(a).map(r => r.id); return rulesOfPlan(b).filter(r => !A.includes(r.id)); };
    const opts = DB.plans.filter(p => p.status !== 'inactivo').map(p => '<button type="button" class="pl-opt' + (p.id === sub.plan ? ' cur on' : '') + '" data-p="' + esc(p.id) + '"><span class="row between"><b>' + esc(p.id) + '</b><span class="tag cur-tag">Actual</span></span><span class="pr">' + money(p.price, 'PEN', 0) + '<span class="small faint"> / mes</span></span><span class="xs faint">' + money(p.priceYear, 'PEN', 0) + ' / año · ' + fmtQ(p.limits.users) + ' usuarios · ' + fmtQ(p.limits.storageGB) + ' GB · API ' + (p.limits.apiCalls ? fmtN(p.limits.apiCalls / 1000, 0) + 'k/mes' : 'no incluida') + '</span></button>').join('');
    UI.modal({ title: 'Cambiar plan', size: 'lg', sub: 'Upgrade: inmediato con cargo prorrateado. Downgrade: al cierre del periodo, solo si el consumo cabe en el plan destino.',
      body: '<div class="pl-opts">' + opts + '</div><div class="field" style="margin-top:14px;max-width:260px"><label for="cp-cyc">Ciclo de facturación</label><select class="input" id="cp-cyc"><option value="mensual"' + (cyc === 'mensual' ? ' selected' : '') + '>Mensual</option><option value="anual"' + (cyc === 'anual' ? ' selected' : '') + '>Anual (paga 10 meses)</option></select></div><div id="cp-prev" style="margin-top:14px"></div>',
      onOpen: (m) => {
        const upd = () => {
          m.querySelectorAll('.pl-opt').forEach(o => o.classList.toggle('on', o.dataset.p === sel));
          const kind = classify(sub, sel, cyc); const box = m.querySelector('#cp-prev');
          if (kind === 'none') { box.innerHTML = UI.alert('info', 'Seleccione un plan o ciclo distinto al actual.'); return; }
          if (kind === 'upgrade') {
            const p = prorate(sub, sel, cyc);
            box.innerHTML = UI.alert('ok', '<b>Upgrade inmediato</b> a ' + esc(sel) + ' (' + esc(cyc) + '). Los nuevos módulos y límites se habilitan al confirmar.') + UI.dl([
              ['Días restantes del periodo', p.rem + ' de ' + p.pd],
              ['Cargo ' + (p.toAnnual ? 'plan anual ' + esc(sel) : 'prorrateado ' + esc(sel)), money(p.charge)],
              ['Crédito por días no usados de ' + esc(sub.plan), '− ' + money(p.credit)],
              ['Neto a cobrar hoy', '<b>' + money(Math.max(0, p.net)) + '</b> + IGV = <b>' + money(r2(Math.max(0, p.net) * 1.18)) + '</b>' + (p.net < 0 ? ' · saldo a favor ' + money(-p.net) : '')],
              ['Nuevo periodo', p.toAnnual ? date(TODAY()) + ' – ' + date(addDays(addMonths(TODAY(), 12), -1)) : 'Se mantiene (' + date(sub.periodStart) + ' – ' + date(sub.periodEnd) + ')']
            ]) + (ruleDiff(sub.plan, sel).length ? '<div class="small" style="margin-top:8px"><b>Reglas de reserva que se habilitan:</b> ' + ruleDiff(sub.plan, sel).map(r => esc(r.name)).join(', ') + ' <span class="xs faint">(matriz demo)</span></div>' : '');
          } else {
            const bl = downgradeBlockers(sub, sel);
            const lost = DB.featureFlags.filter(f => entOn(ent(f.key, TID(), sub.plan).val) && !entOn(ent(f.key, TID(), sel).val)).map(f => f.label);
            box.innerHTML = (bl.length ? UI.alert('bad', '<b>Downgrade bloqueado (regla SUB-BR-03).</b> Reduzca el consumo antes de programar el cambio:<ul style="margin:6px 0 0 16px">' + bl.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>') : UI.alert('warn', '<b>Downgrade programado</b> para el ' + date(addDays(sub.periodEnd, 1)) + '. No hay reembolso del periodo en curso.')) +
              (lost.length ? '<div class="small" style="margin-top:8px"><b>Módulos que dejarán de estar disponibles:</b> ' + lost.map(esc).join(', ') + '</div>' : '') +
              (ruleDiff(sel, sub.plan).length ? '<div class="small" style="margin-top:8px"><b>Reglas de reserva que dejarán de aplicarse:</b> ' + ruleDiff(sel, sub.plan).map(r => esc(r.name)).join(', ') + ' <span class="xs faint">(matriz demo; su configuración se conserva)</span></div>' : '');
          }
        };
        m.querySelectorAll('.pl-opt').forEach(o => o.onclick = () => { sel = o.dataset.p; upd(); });
        m.querySelector('#cp-cyc').onchange = (e) => { cyc = e.target.value; upd(); };
        upd();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar cambio', cls: 'primary', onClick: () => {
        const kind = classify(sub, sel, cyc);
        if (kind === 'none') { UI.toast('No hay cambios que aplicar.', 'info'); return false; }
        const before = sub.plan + ' · ' + sub.cycle;
        if (kind === 'downgrade') {
          const bl = downgradeBlockers(sub, sel);
          if (bl.length) { UI.toast('Regla SUB-BR-03: el consumo actual excede el plan ' + esc(sel) + ' (' + bl.length + ' bloqueo(s)).', 'bad'); Audit.log('Suscripción', sub.id, 'downgrade_bloqueado', before, sel + ' · ' + bl.length + ' bloqueos'); return false; }
          sub.pendingChange = { plan: sel, cycle: cyc, effective: addDays(sub.periodEnd, 1), requestedBy: Auth.user.id, at: nowStr() };
          Store.save(); Audit.log('Suscripción', sub.id, 'cambio_plan_programado', before, sel + ' · ' + cyc + ' desde ' + sub.pendingChange.effective);
          Notify.push('suscripcion.cambio_programado', 'Email', sub.billing.email, 'Cambio a ' + sel + ' programado para el ' + date(sub.pendingChange.effective));
          UI.toast('Cambio a ' + esc(sel) + ' programado para el ' + date(sub.pendingChange.effective) + '.'); App.render(); return;
        }
        const p = prorate(sub, sel, cyc);
        const lines = [{ desc: (p.toAnnual ? 'Plan ' + sel + ' anual' : 'Prorrateo plan ' + sel + ' (' + p.rem + '/' + p.pd + ' días)'), qty: 1, unit: p.charge, amount: p.charge }, { desc: 'Crédito por días no usados plan ' + sub.plan + ' (' + p.rem + '/' + p.pd + ' días)', qty: 1, unit: -p.credit, amount: -p.credit }];
        let inv = null;
        if (p.net > 0) inv = newInvoice(TID(), lines, { kind: 'prorrateo', from: TODAY(), to: p.toAnnual ? addDays(addMonths(TODAY(), 12), -1) : sub.periodEnd });
        else sub.creditBalance = r2((sub.creditBalance || 0) - p.net);
        sub.plan = sel; sub.cycle = cyc; sub.pendingChange = null;
        if (p.toAnnual) { sub.periodStart = TODAY(); sub.periodEnd = addDays(addMonths(TODAY(), 12), -1); }
        DB.tenant.plan = sel; const t = tenantRow(TID()); if (t) { t.plan = sel; t.modules = sel === 'Starter' ? 6 : sel === 'Professional' ? 12 : 18; t.mrr = Math.round(monthlyOf(sel, cyc)); }
        DB.platformConfig.tenantBilling[TID()].cycle = cyc;
        Store.save(); Audit.log('Suscripción', sub.id, 'cambio_plan', before, sel + ' · ' + cyc + (inv ? ' · ' + inv.id : ''));
        Notify.push('suscripcion.plan_cambiado', 'Email', sub.billing.email, 'Plan actualizado a ' + sel + (inv ? ' · factura ' + inv.id : ''));
        UI.toast('Plan actualizado a ' + esc(sel) + (inv ? '. Factura ' + inv.id + ' por ' + money(inv.total) + '.' : '.')); App.render();
      } }] });
  }

  /* ---- Cupón ---- */
  function couponModal(sub) {
    if (!guard('admin.billing.manage')) return;
    if (sub.coupon && sub.coupon.remaining > 0) { UI.toast('Ya tiene el cupón ' + esc(sub.coupon.code) + ' vigente; los cupones no son acumulables (SUB-BR-07).', 'bad'); return; }
    UI.modal({ title: 'Aplicar cupón', size: 'sm', body: UI.form([{ id: 'cp-code', label: 'Código', required: true, col: 12, placeholder: 'Ej. FERIATUR26' }]), actions: [{ label: 'Cancelar' }, { label: 'Aplicar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const code = UI.formData(m)['cp-code'].toUpperCase();
      const c = DB.coupons.find(x => x.code === code);
      const err = !c ? 'El cupón no existe.' : c.status !== 'activo' ? 'El cupón no está activo.' : c.validTo < TODAY() ? 'El cupón venció el ' + date(c.validTo) + '.' : c.redeemed >= c.maxRedemptions ? 'El cupón alcanzó su máximo de canjes.' : !c.plans.includes(sub.plan) ? 'El cupón no aplica al plan ' + sub.plan + '.' : '';
      if (err) { UI.toast('Regla SUB-BR-07: ' + err, 'bad'); Audit.log('Suscripción', sub.id, 'cupon_rechazado', '', code); return false; }
      c.redeemed++; sub.coupon = { code: c.code, type: c.type, value: c.value, remaining: c.months, appliedAt: TODAY() };
      Store.save(); Audit.log('Suscripción', sub.id, 'cupon_aplicar', '', c.code + ' ' + couponLabel(c) + ' × ' + c.months);
      UI.toast('Cupón ' + esc(c.code) + ' aplicado: ' + esc(couponLabel(c)) + ' durante ' + c.months + ' ciclo(s).'); App.render();
    } }] });
  }

  /* ---- Cancelación con encuesta ---- */
  function cancelModal(sub) {
    if (!guard('admin.billing.manage')) return;
    const reasons = ['Precio', 'Faltan funcionalidades', 'Cambio a otro software', 'Cierre o pausa del negocio', 'Problemas técnicos o de rendimiento', 'Soporte insuficiente', 'Otro'];
    UI.modal({ title: 'Cancelar suscripción', size: 'lg', sub: 'La cancelación se hace efectiva al final del periodo pagado (' + date(sub.periodEnd) + ').',
      body: UI.alert('info', '<b>Antes de irse:</b> puede pasar a un plan menor, pausar add-ons o aplicar el cupón de retención <span class="mono">QUEDATE20</span> (20 % durante 3 meses).') +
        UI.form([
          { id: 'cn-reason', label: 'Motivo principal', type: 'select', options: reasons, placeholder: 'Seleccione…', required: true, col: 6 },
          { id: 'cn-to', label: '¿A qué solución se cambia? (opcional)', col: 6 },
          { id: 'cn-score', label: 'Probabilidad de recomendarnos (0–10)', type: 'number', min: 0, max: 10, value: 7, col: 6 },
          { id: 'cn-stay', label: '¿Qué le habría hecho quedarse?', type: 'textarea', col: 12, rows: 2 },
          { id: 'cn-comment', label: 'Comentarios', type: 'textarea', col: 12, rows: 2 },
          { id: 'cn-export', type: 'checkbox', label: 'Solicitar exportación completa de datos (ZIP con CSV y documentos) antes del cierre', value: true, col: 12 },
          { id: 'cn-ok', type: 'checkbox', label: 'Entiendo que al cierre los usuarios pierden acceso y los datos se conservan 30 días en solo lectura', col: 12 }
        ]),
      actions: [{ label: 'Volver' }, { label: 'Aplicar cupón de retención', onClick: () => { UI.closeModal(); couponModal(sub); return false; } }, { label: 'Confirmar cancelación', cls: 'danger', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m);
        if (!d['cn-ok']) { UI.toast('Confirme que entiende las condiciones de cierre.', 'bad'); return false; }
        const before = sub.status;
        sub.status = 'cancel_programada'; sub.cancelAt = sub.periodEnd; sub.autoRenew = false; sub.pendingChange = null;
        sub.cancelSurvey = { reason: d['cn-reason'], to: d['cn-to'], score: d['cn-score'], stay: d['cn-stay'], comment: d['cn-comment'], exportRequested: d['cn-export'], at: nowStr(), by: Auth.user.id };
        Store.save(); Audit.log('Suscripción', sub.id, 'cancelar', before, 'cancel_programada ' + sub.cancelAt + ' · ' + d['cn-reason']);
        Notify.push('suscripcion.cancelacion', 'Email', 'ops@kipucontrol.com', 'Cancelación programada ' + TID() + ' — motivo: ' + d['cn-reason']);
        Notify.push('suscripcion.cancelacion', 'Email', sub.billing.email, 'Confirmación de cancelación efectiva el ' + date(sub.cancelAt));
        if (d['cn-export']) Notify.push('export.tenant', 'Email', sub.billing.email, 'Exportación completa de datos en preparación (job reports)');
        UI.toast('Cancelación programada para el ' + date(sub.cancelAt) + '.'); App.render();
      } }] });
  }

  /* =====================================================================
     ADMIN / API Y WEBHOOKS (Tenant Admin)
     ===================================================================== */
  App.register('admin/api', (el, params) => {
    ensure();
    const title = 'API y webhooks';
    if (!Auth.can('admin.api.manage')) return denied(el, title, 'admin.api.manage');
    const sub = DB.subscription; const L = effLimits(sub); const U = usageNow(sub);
    const eApi = entOn(ent('api_access').val); const eWh = entOn(ent('webhooks').val);
    const keys = DB.apiKeys.filter(k => k.tenantId === TID());
    const hooks = DB.webhooks.filter(w => w.tenantId === TID() && w.status !== 'eliminado');
    const dels24 = DB.webhookDeliveries.filter(d => hooks.some(h => h.id === d.webhookId) && daysBetween(d.ts.slice(0, 10), TODAY()) <= 1);
    const okRate = dels24.length ? dels24.filter(d => d.status === 'entregado').length / dels24.length * 100 : 100;
    const apiPct = L.apiCalls ? U.apiCalls / L.apiCalls * 100 : 0;
    el.innerHTML = page(
      UI.pageHeader({ title, crumbs: crumbsT(title), subtitle: 'Acceso programático al tenant: API keys con alcance (scopes), webhooks firmados con HMAC-SHA256, límites por plan y documentación OpenAPI 3.1.',
        actions: '<button class="btn" id="ap-doc">' + ic('file') + 'Especificación OpenAPI</button>' + (eApi ? '<button class="btn primary" id="ap-newkey">' + ic('key') + 'Nueva API key</button>' : '<button class="btn primary" disabled title="Entitlement api_access no incluido en el plan">' + ic('key') + 'Nueva API key</button>') }) +
      (!eApi ? UI.alert('bad', '<b>Su plan ' + esc(sub.plan) + ' no incluye acceso API (entitlement <span class="mono">api_access</span>).</b> El middleware <span class="mono">EnsureFeature:api_access</span> responde 403 FEATURE_NOT_IN_PLAN a toda llamada. <a href="#/admin/suscripcion">Mejorar plan</a>') : '') +
      (apiPct >= 80 ? UI.alert(apiPct >= 100 ? 'bad' : 'warn', 'Cuota mensual de API al <b>' + fmtN(apiPct, 0) + ' %</b> (' + fmtN(U.apiCalls, 0) + ' de ' + fmtN(L.apiCalls, 0) + '). Al 100 % la API responde 429 <span class="mono">QUOTA_EXCEEDED</span> hasta el ' + date(addDays(sub.periodEnd, 1)) + '.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'API keys activas', value: keys.filter(k => k.status === 'activa').length + ' <span class="small faint">/ ' + fmtQ(L.apiKeys) + '</span>', sub: keys.filter(k => k.status !== 'activa').length + ' revocadas o vencidas', tone: 'accent', icon: 'key' }) +
        UI.kpi({ label: 'Webhooks', value: hooks.length + ' <span class="small faint">/ ' + fmtQ(L.webhooks) + '</span>', sub: hooks.filter(h => h.status === 'activo').length + ' activos · ' + hooks.filter(h => h.consecutiveFailures > 0).length + ' con fallos', tone: 'info', icon: 'link' }) +
        UI.kpi({ label: 'Llamadas API del mes', value: fmtN(U.apiCalls / 1000, 0) + 'k', sub: fmtN(apiPct, 0) + ' % de ' + fmtN(L.apiCalls / 1000, 0) + 'k · ' + fmtN(L.rateMin, 0) + ' req/min', tone: apiPct >= 80 ? 'sun' : 'ok', icon: 'zap' }) +
        UI.kpi({ label: 'Entregas webhook 24 h', value: fmtN(okRate, 1) + ' %', sub: dels24.length + ' entregas · ' + dels24.filter(d => d.status !== 'entregado').length + ' fallidas/reintentando', tone: okRate < 95 ? 'bad' : 'ok', icon: 'send' }) +
      '</div><div id="ap-tabs" style="margin-top:16px"></div>');
    const tabIds = ['claves', 'webhooks', 'entregas', 'limites', 'docs', 'oauth'];
    UI.tabs(el.querySelector('#ap-tabs'), [
      { id: 'claves', label: 'API keys', count: keys.length, render: (b) => renderKeys(b, eApi) },
      { id: 'webhooks', label: 'Webhooks', count: hooks.length, render: (b) => renderHooks(b, eWh) },
      { id: 'entregas', label: 'Log de entregas', render: (b) => renderDeliveries(b) },
      { id: 'limites', label: 'Límites y rate limit', render: (b) => renderLimits(b, sub) },
      { id: 'docs', label: 'Documentación', render: (b) => renderDocs(b) },
      { id: 'oauth', label: 'Aplicaciones OAuth', count: DB.oauthApps.filter(a => a.tenantId === TID()).length, render: (b) => renderOAuth(b) }
    ], tabIds.includes(params[0]) ? params[0] : 'claves', { onChange: (id) => setHash('#/admin/api' + (id === 'claves' ? '' : '/' + id)) });
    el.querySelector('#ap-doc').onclick = () => openApiModal();
    const nk = el.querySelector('#ap-newkey'); if (nk) nk.onclick = () => newKeyModal();
  });

  const scopeChecks = (sel, name) => '<div class="pl-scopes">' + SCOPES.map(([s, d]) => '<label><input type="checkbox" name="' + name + '" value="' + s + '"' + (sel.includes(s) ? ' checked' : '') + '><span><span class="mono">' + esc(s) + '</span><br><span class="xs faint">' + esc(d) + '</span></span></label>').join('') + '</div>';
  const checked = (root, name) => Array.from(root.querySelectorAll('input[name="' + name + '"]:checked')).map(i => i.value);
  /* Se difiere para no ser cerrado por el cierre automático del modal/confirm que lo invoca */
  function secretModal(title, secret, note) { setTimeout(() => secretModalNow(title, secret, note), 0); }
  function secretModalNow(title, secret, note) {
    UI.modal({ title, size: 'sm', body: UI.alert('warn', '<b>Copie el valor ahora.</b> Por seguridad solo se muestra una vez; la plataforma guarda únicamente su hash.') + '<div class="pl-secret" style="margin-top:10px">' + esc(secret) + '</div>' + (note ? '<p class="xs faint" style="margin-top:10px">' + note + '</p>' : ''), actions: [{ label: 'Copiar', icon: 'copy', onClick: () => { UI.copy(secret); return false; } }, { label: 'Ya lo guardé', cls: 'primary', onClick: () => App.render() }] });
    const ov = document.getElementById('modal-ov'); if (ov) ov.querySelector('[data-close]').addEventListener('click', () => App.render());
  }

  /* ---- API keys ---- */
  function renderKeys(b, eApi) {
    b.innerHTML = '<div id="k-dt"></div><p class="xs faint" style="margin-top:8px">Autenticación: <span class="mono">Authorization: Bearer qts_live_…</span>. Las claves <span class="mono">qts_test_</span> operan contra el entorno sandbox del tenant. Rotación recomendada cada 12 meses.</p>';
    UI.dataTable(b.querySelector('#k-dt'), { rows: () => DB.apiKeys.filter(k => k.tenantId === TID()), exportName: 'api_keys', search: (r) => r.name + ' ' + r.prefix + ' ' + r.scopes.join(' '),
      filters: [{ key: 'status', label: 'Estado', options: [['activa', 'Activa'], ['revocada', 'Revocada'], ['expirada', 'Expirada']] }, { key: 'env', label: 'Entorno', options: [['live', 'Producción'], ['test', 'Sandbox']] }],
      columns: [
        { key: 'name', label: 'Nombre', render: r => '<b class="small">' + esc(r.name) + '</b><div class="xs faint mono">' + esc(r.prefix) + '…' + esc(r.last4) + '</div>' },
        { key: 'env', label: 'Entorno', render: r => r.env === 'live' ? B('activo', 'Producción') : B('prueba', 'Sandbox') },
        { key: 'scopes', label: 'Scopes', sort: false, render: r => '<div class="chip-row">' + r.scopes.map(s => '<span class="tag mono">' + esc(s) + '</span>').join('') + '</div>' },
        { key: 'lastUsedAt', label: 'Último uso', render: r => r.lastUsedAt ? datetime(r.lastUsedAt) + '<div class="xs faint mono">' + esc(r.lastIp) + '</div>' : '<span class="faint">Nunca</span>' },
        { key: 'calls30d', label: 'Llamadas 30 d', align: 'num', render: r => fmtN(r.calls30d, 0) + (r.throttled24h ? '<div class="xs" style="color:var(--warn)">' + r.throttled24h + ' × 429 (24 h)</div>' : '') },
        { key: 'expiresAt', label: 'Vence', render: r => r.expiresAt ? date(r.expiresAt) : '<span class="faint">Sin vencimiento</span>' },
        { key: 'status', label: 'Estado', render: r => B(r.status) },
        { key: '', label: '', sort: false, render: r => r.status === 'activa' ? '<button class="btn xs danger" data-rv="' + r.id + '">Revocar</button>' : '' }
      ],
      onRow: (r) => keyDrawer(r),
      afterDraw: (c) => c.querySelectorAll('[data-rv]').forEach(x => x.onclick = () => revokeKey(DB.apiKeys.find(k => k.id === x.dataset.rv)))
    });
  }
  function keyDrawer(k) {
    const logs = DB.audit.filter(a => a.entity === 'API key' && a.entityId === k.id).slice(0, 8);
    UI.drawer({ title: esc(k.name), sub: 'API key ' + esc(k.id), body: UI.dl([['Prefijo', '<span class="mono">' + esc(k.prefix) + '…' + esc(k.last4) + '</span>'], ['Hash almacenado', '<span class="mono small pl-wrap">' + esc(k.hash) + '…</span>'], ['Entorno', k.env === 'live' ? 'Producción' : 'Sandbox'], ['Estado', B(k.status)], ['Creada', datetime(k.createdAt) + ' por ' + esc(uName(k.createdBy))], ['Vence', k.expiresAt ? date(k.expiresAt) : 'Sin vencimiento'], ['IPs permitidas', k.ipAllow ? '<span class="mono">' + esc(k.ipAllow) + '</span>' : 'Cualquiera'], ['Último uso', k.lastUsedAt ? datetime(k.lastUsedAt) + ' desde ' + esc(k.lastIp) : 'Nunca'], ['Llamadas 30 días', fmtN(k.calls30d, 0)], ['Respuestas 429 (24 h)', fmtN(k.throttled24h, 0)], k.revokedAt ? ['Revocada', datetime(k.revokedAt) + ' por ' + esc(uName(k.revokedBy)) + ' · ' + esc(k.revokeReason || '')] : null]) +
      '<div class="section-title" style="margin-top:14px">Scopes</div><div class="chip-row">' + k.scopes.map(s => '<span class="tag mono">' + esc(s) + '</span>').join('') + '</div>' +
      '<div class="section-title" style="margin-top:14px">Auditoría</div>' + UI.timeline(logs.map(a => ({ title: esc(a.action.replace(/_/g, ' ')), meta: datetime(a.ts) + ' · ' + esc(uName(a.user)), desc: esc(a.after), icon: 'shield' }))),
      actions: k.status === 'activa' ? [{ label: 'Revocar', cls: 'danger', icon: 'lock', onClick: () => { UI.closeDrawer(); revokeKey(k); return false; } }] : [] });
  }
  function newKeyModal() {
    if (!guard('admin.api.manage')) return;
    const L = effLimits(DB.subscription); const active = DB.apiKeys.filter(k => k.tenantId === TID() && k.status === 'activa').length;
    if (!entOn(ent('api_access').val)) { UI.toast('403 FEATURE_NOT_IN_PLAN: el plan no incluye api_access.', 'bad'); return; }
    if (L.apiKeys != null && active >= L.apiKeys) { UI.toast('Regla API-BR-02: alcanzó el máximo de ' + L.apiKeys + ' API keys activas del plan. Revoque una clave o mejore el plan.', 'bad'); return; }
    UI.modal({ title: 'Nueva API key', size: 'lg', body: UI.form([
      { id: 'nk-name', label: 'Nombre descriptivo', required: true, col: 6, placeholder: 'Ej. Integración ERP contable' },
      { id: 'nk-env', label: 'Entorno', type: 'select', options: [['live', 'Producción (qts_live_)'], ['test', 'Sandbox (qts_test_)']], value: 'live', col: 3 },
      { id: 'nk-exp', label: 'Vencimiento', type: 'select', options: [['90', '90 días'], ['365', '12 meses'], ['0', 'Sin vencimiento']], value: '365', col: 3 },
      { id: 'nk-ip', label: 'IPs permitidas (opcional, separadas por coma)', col: 12, placeholder: '200.48.22.17, 161.132.8.0/24' },
      { type: 'section', label: 'Scopes (principio de mínimo privilegio)' }
    ]) + scopeChecks(['catalog:read'], 'nk-sc'), actions: [{ label: 'Cancelar' }, { label: 'Crear API key', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = UI.formData(m); const sc = checked(m, 'nk-sc');
      if (!sc.length) { UI.toast('Seleccione al menos un scope.', 'bad'); return false; }
      if (d['nk-ip'] && !d['nk-ip'].split(',').every(x => /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(x.trim()))) { UI.toast('Lista de IPs inválida (use IPv4 o CIDR).', 'bad'); return false; }
      const token = 'qts_' + d['nk-env'] + '_' + rnd(32);
      const id = nextId(DB.apiKeys, 'KEY-', 4);
      DB.apiKeys.unshift({ id, tenantId: TID(), name: d['nk-name'], env: d['nk-env'], prefix: token.slice(0, 13), last4: token.slice(-4), hash: 'sha256:' + fakeHex(token, 20), scopes: sc, ipAllow: d['nk-ip'], createdBy: Auth.user.id, createdAt: nowStr(), expiresAt: +d['nk-exp'] ? addDays(TODAY(), +d['nk-exp']) : null, lastUsedAt: null, lastIp: '', calls30d: 0, throttled24h: 0, status: 'activa' });
      Store.save(); Audit.log('API key', id, 'crear', '', d['nk-name'] + ' · ' + sc.join(' '));
      Notify.push('api.key_creada', 'Email', Auth.user.email, 'Se creó la API key "' + d['nk-name'] + '" (' + token.slice(0, 13) + '…)');
      secretModal('API key creada', token, 'Úsela en el header <span class="mono">Authorization: Bearer</span>. Si la pierde, revóquela y cree otra.');
    } }] });
  }
  function revokeKey(k) {
    if (!guard('admin.api.manage')) return;
    UI.confirm({ title: 'Revocar API key', danger: true, reason: true, reasonLabel: 'Motivo (queda en auditoría)', message: 'La clave <b>' + esc(k.name) + '</b> (<span class="mono">' + esc(k.prefix) + '…</span>) dejará de funcionar de inmediato: las llamadas responderán 401. Esta acción no se puede deshacer.', confirmLabel: 'Revocar', onConfirm: (r) => {
      k.status = 'revocada'; k.revokedAt = nowStr(); k.revokedBy = Auth.user.id; k.revokeReason = r;
      Store.save(); Audit.log('API key', k.id, 'revocar', 'activa', 'revocada · ' + r); UI.toast('API key revocada. Caché de autenticación invalidada.'); App.render();
    } });
  }

  /* ---- Webhooks ---- */
  const eventChecks = (sel) => { const groups = {}; EVENTS.forEach(e => (groups[e[1]] = groups[e[1]] || []).push(e)); return '<div class="pl-scopes">' + Object.keys(groups).map(g => groups[g].map(([k, , d]) => '<label><input type="checkbox" name="wh-ev" value="' + k + '"' + (sel.includes(k) ? ' checked' : '') + '><span><span class="mono">' + esc(k) + '</span><br><span class="xs faint">' + esc(g) + ' · ' + esc(d) + '</span></span></label>').join('')).join('') + '</div>'; };
  function validUrl(u) {
    const m = /^https:\/\/([^/:]+)(:\d+)?(\/.*)?$/i.exec(u || '');
    if (!m) return 'La URL debe usar HTTPS (API-BR-05).';
    const h = m[1].toLowerCase();
    if (h === 'localhost' || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.endsWith('.local') || h.endsWith('.internal')) return 'Destino no permitido: redes privadas/loopback bloqueadas para prevenir SSRF (API-BR-06).';
    return '';
  }
  function renderHooks(b, eWh) {
    const L = effLimits(DB.subscription);
    const hooks = DB.webhooks.filter(w => w.tenantId === TID() && w.status !== 'eliminado');
    b.innerHTML = (!eWh ? UI.alert('bad', 'Su plan no incluye webhooks (entitlement <span class="mono">webhooks</span>).') : '') +
      '<div class="row between" style="margin-bottom:12px"><span class="small muted">Cada evento se envía como POST JSON firmado con <span class="mono">KipuControl-Signature: t=…,v1=HMAC-SHA256(secreto, t + "." + cuerpo)</span>. Reintentos con backoff ' + BACKOFF.join(' · ') + '; se deshabilita tras ' + AUTO_DISABLE + ' fallos consecutivos.</span>' +
      (eWh ? '<button class="btn primary sm" id="wh-new">' + ic('plus') + 'Nuevo webhook</button>' : '') + '</div>' +
      (hooks.length ? '<div class="col" style="gap:12px">' + hooks.map(w => {
        const dl = DB.webhookDeliveries.filter(d => d.webhookId === w.id); const ok = dl.filter(d => d.status === 'entregado').length;
        return UI.card('<span class="mono small pl-wrap">' + esc(w.url) + '</span>', '<div class="small muted" style="margin-bottom:8px">' + esc(w.description || '') + '</div><div class="chip-row">' + w.events.map(e => '<span class="tag mono">' + esc(e) + '</span>').join('') + '</div>' +
          '<div class="pl-kv" style="margin-top:12px"><div><span class="xs faint">Estado</span><b>' + B(w.status) + '</b></div><div><span class="xs faint">Éxito histórico</span><b>' + (dl.length ? fmtN(ok / dl.length * 100, 1) + ' %' : '—') + '</b></div><div><span class="xs faint">Fallos consecutivos</span><b style="color:var(--' + (w.consecutiveFailures ? 'bad' : 'fg') + ')">' + w.consecutiveFailures + ' / ' + AUTO_DISABLE + '</b></div><div><span class="xs faint">Secreto</span><b class="mono small">' + esc(w.secretPrefix) + '…</b></div></div>' +
          (w.consecutiveFailures >= 5 && w.status === 'activo' ? '<div style="margin-top:10px">' + UI.alert('warn', 'El endpoint responde con errores. Si alcanza ' + AUTO_DISABLE + ' fallos consecutivos el webhook se deshabilita automáticamente y se notifica al administrador.') + '</div>' : '') +
          (w.status === 'deshabilitado' ? '<div style="margin-top:10px">' + UI.alert('bad', 'Deshabilitado automáticamente por fallos consecutivos. Corrija el endpoint y reactívelo; los eventos no entregados pueden reenviarse desde el log.') + '</div>' : ''),
          { sub: esc(w.id) + ' · versión de payload ' + esc(w.apiVersion) + ' · creado ' + date(w.createdAt.slice(0, 10)) + ' · secreto rotado ' + date(w.secretRotatedAt.slice(0, 10)),
            footer: '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn xs" data-wt="' + w.id + '">' + ic('send') + 'Enviar ping</button><button class="btn xs" data-we="' + w.id + '">' + ic('edit') + 'Editar</button><button class="btn xs" data-wr="' + w.id + '">' + ic('key') + 'Rotar secreto</button>' +
              (w.status === 'activo' ? '<button class="btn xs" data-wp="' + w.id + '">Pausar</button>' : '<button class="btn xs primary" data-wa="' + w.id + '">' + (w.status === 'deshabilitado' ? 'Reactivar' : 'Reanudar') + '</button>') +
              '<button class="btn xs" data-wl="' + w.id + '">' + ic('list') + 'Ver entregas</button><button class="btn xs danger" data-wd="' + w.id + '">' + ic('trash') + 'Eliminar</button></div>' });
      }).join('') + '</div>' : UI.empty('Sin webhooks configurados', 'link')) +
      '<p class="xs faint" style="margin-top:10px">Límite del plan: ' + fmtQ(L.webhooks) + ' webhooks. Idempotencia: cada entrega incluye <span class="mono">KipuControl-Event-Id</span>; el receptor debe ignorar duplicados.</p>';
    const W = (id) => DB.webhooks.find(w => w.id === id);
    const nb = b.querySelector('#wh-new'); if (nb) nb.onclick = () => hookModal(null);
    b.querySelectorAll('[data-we]').forEach(x => x.onclick = () => hookModal(W(x.dataset.we)));
    b.querySelectorAll('[data-wt]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const w = W(x.dataset.wt); const d = deliver(w, 'ping', 'test', 1); UI.toast('Ping enviado: HTTP ' + (d.code || 'timeout') + ' en ' + d.ms + ' ms.', d.status === 'entregado' ? 'ok' : 'bad'); App.render(); });
    b.querySelectorAll('[data-wr]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const w = W(x.dataset.wr); UI.confirm({ title: 'Rotar secreto de firma', message: 'Se generará un nuevo secreto. El anterior seguirá siendo aceptado durante <b>24 horas</b> (se envían ambas firmas v1) para permitir actualizar el receptor sin cortes.', confirmLabel: 'Rotar', onConfirm: () => { const s = 'whsec_' + rnd(32); const bf = w.secretPrefix; w.secretPrefix = s.slice(0, 10); w.secretRotatedAt = nowStr(); Store.save(); Audit.log('Webhook', w.id, 'rotar_secreto', bf + '…', w.secretPrefix + '…'); secretModal('Nuevo secreto de firma', s, 'Configure este secreto en su receptor para validar el header KipuControl-Signature.'); } }); });
    b.querySelectorAll('[data-wp]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const w = W(x.dataset.wp); w.status = 'pausado'; w.pausedAt = nowStr(); w.pausedBy = Auth.user.id; Store.save(); Audit.log('Webhook', w.id, 'pausar', 'activo', 'pausado'); UI.toast('Webhook pausado: los eventos se descartan mientras esté pausado.'); App.render(); });
    b.querySelectorAll('[data-wa]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const w = W(x.dataset.wa); const bf = w.status; w.status = 'activo'; w.consecutiveFailures = 0; Store.save(); Audit.log('Webhook', w.id, 'reactivar', bf, 'activo'); UI.toast('Webhook activo.'); App.render(); });
    b.querySelectorAll('[data-wl]').forEach(x => x.onclick = () => App.go('#/admin/api/entregas'));
    b.querySelectorAll('[data-wd]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const w = W(x.dataset.wd); UI.confirm({ title: 'Eliminar webhook', danger: true, message: 'Se eliminará <span class="mono">' + esc(w.url) + '</span>. El log de entregas se conserva 30 días para auditoría.', confirmLabel: 'Eliminar', onConfirm: () => { w.status = 'eliminado'; Store.save(); Audit.log('Webhook', w.id, 'eliminar', w.url, 'eliminado'); UI.toast('Webhook eliminado.'); App.render(); } }); });
  }
  function hookModal(w) {
    if (!guard('admin.api.manage')) return;
    const L = effLimits(DB.subscription);
    if (!w) { if (!entOn(ent('webhooks').val)) { UI.toast('403 FEATURE_NOT_IN_PLAN: webhooks.', 'bad'); return; } const n = DB.webhooks.filter(x => x.tenantId === TID() && x.status !== 'eliminado').length; if (L.webhooks != null && n >= L.webhooks) { UI.toast('Regla API-BR-04: máximo ' + L.webhooks + ' webhooks en su plan.', 'bad'); return; } }
    UI.modal({ title: w ? 'Editar webhook ' + esc(w.id) : 'Nuevo webhook', size: 'lg', body: UI.form([
      { id: 'wh-url', label: 'URL del endpoint (HTTPS)', value: w ? w.url : '', required: true, col: 12, placeholder: 'https://erp.suagencia.pe/webhooks/kipucontrol' },
      { id: 'wh-desc', label: 'Descripción', value: w ? w.description : '', col: 12 },
      { type: 'section', label: 'Eventos suscritos' }
    ]) + eventChecks(w ? w.events : ['reservation.confirmed', 'payment.applied']), actions: [{ label: 'Cancelar' }, { label: w ? 'Guardar' : 'Crear webhook', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = UI.formData(m); const evs = checked(m, 'wh-ev');
      const e = validUrl(d['wh-url']); if (e) { UI.toast(e, 'bad'); return false; }
      if (!evs.length) { UI.toast('Seleccione al menos un evento.', 'bad'); return false; }
      if (w) {
        const bf = w.url + ' [' + w.events.length + ']'; const changedUrl = w.url !== d['wh-url'];
        w.url = d['wh-url']; w.description = d['wh-desc']; w.events = evs; if (changedUrl) { w.health = 'ok'; w.consecutiveFailures = 0; }
        Store.save(); Audit.log('Webhook', w.id, 'editar', bf, w.url + ' [' + evs.length + ']'); UI.toast('Webhook actualizado.' + (changedUrl ? ' Envíe un ping para verificar el nuevo endpoint.' : '')); App.render(); return;
      }
      const id = nextId(DB.webhooks, 'WH-', 4); const s = 'whsec_' + rnd(32);
      DB.webhooks.push({ id, tenantId: TID(), url: d['wh-url'], description: d['wh-desc'], events: evs, secretPrefix: s.slice(0, 10), secretRotatedAt: nowStr(), status: 'activo', health: 'ok', consecutiveFailures: 0, createdBy: Auth.user.id, createdAt: nowStr(), apiVersion: '2026-09-01' });
      Store.save(); Audit.log('Webhook', id, 'crear', '', d['wh-url'] + ' · ' + evs.join(' '));
      secretModal('Webhook creado — secreto de firma', s, 'Valide cada entrega calculando HMAC-SHA256 con este secreto sobre <span class="mono">timestamp + "." + cuerpo</span> y compárelo en tiempo constante con v1. Rechace entregas con más de 5 minutos de antigüedad.');
    } }] });
  }
  /* Simula una entrega: el resultado depende de la "salud" del endpoint (en producción: respuesta HTTP real) */
  function deliver(w, event, entityId, attempt) {
    const ok = w.health === 'ok';
    const id = nextId(DB.webhookDeliveries, 'WHD-', 6);
    const d = { id, webhookId: w.id, event, eventId: 'evt_' + fakeHex(id + Date.now(), 16), entityId, ts: nowStr(), attempt: attempt || 1, code: ok ? 200 : 503, ms: ok ? 120 + Math.floor(Math.random() * 120) : 900 + Math.floor(Math.random() * 400), status: ok ? 'entregado' : 'reintentando', nextRetryAt: null, manual: true };
    if (ok) w.consecutiveFailures = 0;
    else {
      w.consecutiveFailures++;
      const next = BACKOFF_MIN[Math.min(d.attempt - 1, BACKOFF_MIN.length - 1)];
      if (d.attempt >= BACKOFF_MIN.length) { d.status = 'fallido'; } else { const t = new Date(); t.setMinutes(t.getMinutes() + next); d.nextRetryAt = TODAY() + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }
      if (w.consecutiveFailures >= AUTO_DISABLE && w.status === 'activo') {
        w.status = 'deshabilitado'; Audit.log('Webhook', w.id, 'deshabilitar_automatico', 'activo', w.consecutiveFailures + ' fallos consecutivos');
        Notify.push('webhook.deshabilitado', 'Email', 'U01', 'Webhook ' + w.id + ' deshabilitado tras ' + w.consecutiveFailures + ' fallos consecutivos');
      }
    }
    DB.webhookDeliveries.unshift(d); Store.save();
    Audit.log('Webhook', w.id, event === 'ping' ? 'ping' : 'reenviar', d.id, 'HTTP ' + d.code);
    return d;
  }
  function payloadOf(d) {
    const data = { id: d.entityId };
    if (/^RES/.test(d.entityId)) { const r = Q.reservation(d.entityId); if (r) Object.assign(data, { status: r.status, client_id: r.clientId, travel_from: r.travelFrom, currency: r.currency, total: String(r.total) }); }
    if (/^COT/.test(d.entityId)) { const q = Q.quote(d.entityId); if (q) Object.assign(data, { status: q.status, client_id: q.clientId, current_version: q.currentVersion, valid_until: q.validUntil }); }
    if (/^PAG/.test(d.entityId)) { const p = DB.payments.find(x => x.id === d.entityId); if (p) Object.assign(data, { reservation_id: p.resId, amount: String(p.amount), currency: p.currency, method: p.method }); }
    if (/^INC/.test(d.entityId)) { const i = DB.incidents.find(x => x.id === d.entityId); if (i) Object.assign(data, { severity: i.severity, status: i.status, title: i.title }); }
    return JSON.stringify({ id: d.eventId, type: d.event, api_version: '2026-09-01', created_at: d.ts.replace(' ', 'T') + ':00-05:00', tenant_id: TID(), data }, null, 2);
  }
  function renderDeliveries(b) {
    const hooks = DB.webhooks.filter(w => w.tenantId === TID());
    UI.dataTable(b, { rows: () => DB.webhookDeliveries.filter(d => hooks.some(h => h.id === d.webhookId)), exportName: 'webhook_entregas', pageSize: 10, search: (r) => r.id + ' ' + r.event + ' ' + r.entityId + ' ' + r.eventId,
      filters: [{ key: 'status', label: 'Estado', options: [['entregado', 'Entregado'], ['reintentando', 'Reintentando'], ['fallido', 'Fallido']] }, { key: 'webhookId', label: 'Webhook', options: hooks.map(h => [h.id, h.id]) }, { key: 'event', label: 'Evento', options: EVENTS.map(e => [e[0], e[0]]).concat([['ping', 'ping']]) }],
      columns: [
        { key: 'ts', label: 'Fecha', render: r => datetime(r.ts) },
        { key: 'webhookId', label: 'Webhook', render: r => '<span class="mono small">' + esc(r.webhookId) + '</span>' },
        { key: 'event', label: 'Evento', render: r => '<span class="mono small">' + esc(r.event) + '</span>' },
        { key: 'entityId', label: 'Entidad', render: r => '<span class="mono small">' + esc(r.entityId) + '</span>' },
        { key: 'attempt', label: 'Intento', align: 'num' },
        { key: 'code', label: 'HTTP', align: 'num', render: r => '<b style="color:var(--' + (r.code >= 200 && r.code < 300 ? 'ok' : 'bad') + ')">' + (r.code || 'timeout') + '</b>' },
        { key: 'ms', label: 'ms', align: 'num', render: r => fmtN(r.ms, 0) },
        { key: 'status', label: 'Estado', render: r => B(r.status) + (r.nextRetryAt ? '<div class="xs faint">próx. ' + esc(r.nextRetryAt.slice(11)) + '</div>' : '') },
        { key: '', label: '', sort: false, render: r => r.status !== 'entregado' ? '<button class="btn xs" data-rs="' + r.id + '">' + ic('refresh') + 'Reenviar</button>' : '' }
      ],
      onRow: (r) => deliveryDrawer(r),
      afterDraw: (c) => c.querySelectorAll('[data-rs]').forEach(x => x.onclick = () => resend(DB.webhookDeliveries.find(d => d.id === x.dataset.rs)))
    });
  }
  function resend(d) {
    if (!guard('admin.api.manage')) return;
    const w = DB.webhooks.find(x => x.id === d.webhookId);
    if (!w || w.status === 'eliminado') { UI.toast('El webhook fue eliminado.', 'bad'); return; }
    if (w.status !== 'activo') { UI.toast('El webhook está ' + (ST[w.status] || [w.status])[0].toLowerCase() + '; reactívelo antes de reenviar.', 'bad'); return; }
    const n = deliver(w, d.event, d.entityId, d.status === 'entregado' ? 1 : d.attempt + 1);
    if (n.status === 'entregado') { d.status = 'entregado'; d.nextRetryAt = null; Store.save(); }
    UI.toast('Reenvío ' + n.id + ': HTTP ' + n.code + (n.status === 'entregado' ? ' — entregado.' : ' — el endpoint sigue fallando (' + w.consecutiveFailures + ' fallos consecutivos).'), n.status === 'entregado' ? 'ok' : 'bad');
    App.render();
  }
  function deliveryDrawer(d) {
    const w = DB.webhooks.find(x => x.id === d.webhookId) || {}; const body = payloadOf(d); const ts = 1759100000 + (parseInt(d.id.replace(/\D/g, ''), 10) % 100000);
    UI.drawer({ title: 'Entrega ' + esc(d.id), sub: esc(d.event) + ' → ' + esc(w.url || ''), wide: true, body: UI.dl([['Estado', B(d.status)], ['Evento', '<span class="mono">' + esc(d.eventId) + '</span>'], ['Intento', d.attempt + ' de ' + BACKOFF_MIN.length + ' (backoff ' + BACKOFF.join(' · ') + ')'], ['Respuesta', 'HTTP ' + (d.code || 'timeout (30 s)') + ' en ' + fmtN(d.ms, 0) + ' ms'], d.nextRetryAt ? ['Próximo reintento', datetime(d.nextRetryAt)] : null]) +
      '<div class="section-title" style="margin-top:14px">Headers enviados</div><pre class="pl-code">POST ' + esc((w.url || '').replace(/^https:\/\/[^/]+/, '') || '/') + '\nContent-Type: application/json\nUser-Agent: KipuControl-Webhooks/1.0\nKipuControl-Event-Id: ' + esc(d.eventId) + '\nKipuControl-Event-Type: ' + esc(d.event) + '\nKipuControl-Delivery-Id: ' + esc(d.id) + '\nKipuControl-Signature: t=' + ts + ',v1=' + fakeHex(body + ts + w.secretPrefix) + '</pre>' +
      '<div class="section-title" style="margin-top:14px">Cuerpo (payload)</div><pre class="pl-code">' + esc(body) + '</pre>' +
      '<div class="section-title" style="margin-top:14px">Respuesta del endpoint</div><pre class="pl-code">' + (d.code === 200 ? 'HTTP/1.1 200 OK\n{"received":true}' : d.code ? 'HTTP/1.1 ' + d.code + ' Service Unavailable\n<html>upstream connect error</html>' : 'Sin respuesta: timeout de 30 s') + '</pre>',
      actions: d.status !== 'entregado' ? [{ label: 'Reenviar ahora', cls: 'primary', icon: 'refresh', onClick: () => { UI.closeDrawer(); resend(d); return false; } }] : [] });
  }

  /* ---- Límites y rate limit ---- */
  function renderLimits(b, sub) {
    const L = effLimits(sub); const U = usageNow(sub);
    const keys = DB.apiKeys.filter(k => k.tenantId === TID() && k.status === 'activa');
    b.innerHTML = '<div class="grid g2">' +
      UI.card('Límites de su plan (' + esc(sub.plan) + ')', tbl(['Límite', '#Valor', '#Uso actual'], [
        '<tr><td>Rate limit por API key</td><td class="num">' + fmtN(L.rateMin, 0) + ' req/min</td><td class="num">ráfaga ' + fmtN(Math.round(L.rateMin / 6), 0) + ' req/10 s</td></tr>',
        '<tr><td>Cuota mensual de llamadas</td><td class="num">' + fmtQ(L.apiCalls) + '</td><td class="num">' + fmtN(U.apiCalls, 0) + '</td></tr>',
        '<tr><td>API keys activas</td><td class="num">' + fmtQ(L.apiKeys) + '</td><td class="num">' + U.apiKeys + '</td></tr>',
        '<tr><td>Webhooks</td><td class="num">' + fmtQ(L.webhooks) + '</td><td class="num">' + U.webhooks + '</td></tr>',
        '<tr><td>Tamaño máximo de request</td><td class="num">1 MB</td><td class="num">—</td></tr>',
        '<tr><td>Página máxima (cursor)</td><td class="num">100 registros</td><td class="num">—</td></tr>'
      ]), { tight: true, sub: 'Comparativa: ' + PLAN_ORDER.map(p => p + ' ' + (planOf(p).limits.rateMin ? planOf(p).limits.rateMin + ' req/min' : 'sin API')).join(' · ') }) +
      UI.card('Headers de rate limit', '<pre class="pl-code">HTTP/1.1 200 OK\nX-RateLimit-Limit: ' + L.rateMin + '\nX-RateLimit-Remaining: ' + Math.max(0, L.rateMin - 42) + '\nX-RateLimit-Reset: 18\nX-Quota-Limit: ' + (L.apiCalls || 0) + '\nX-Quota-Remaining: ' + Math.max(0, (L.apiCalls || 0) - U.apiCalls) + '\n\nHTTP/1.1 429 Too Many Requests\nRetry-After: 12\n{"code":"RATE_LIMITED","message":"Límite de ' + L.rateMin + ' req/min por API key excedido"}</pre><p class="xs faint" style="margin-top:8px">Algoritmo de ventana deslizante en Redis por API key (<span class="mono">rl:{tenant}:{key}:{minuto}</span>). La cuota mensual se descuenta de un contador Redis y se consolida cada noche.</p>') +
      '</div><div style="margin-top:16px">' + UI.card('Consumo por API key (30 días)', keys.length ? UI.chart.hbars({ items: keys.map(k => ({ label: k.name + ' · ' + k.prefix, value: k.calls30d, display: fmtN(k.calls30d, 0) + (k.throttled24h ? ' · ' + k.throttled24h + ' × 429' : '') })) }) : UI.empty('Sin API keys activas', 'key')) + '</div>';
  }

  /* ---- Documentación ---- */
  const API_EP = [
    ['GET', '/api/v1/catalog/products', 'catalog:read', 'Lista productos activos publicables con tarifas vigentes'], ['GET', '/api/v1/catalog/products/{code}/availability', 'availability:read', 'Disponibilidad por fecha/salida'],
    ['POST', '/api/v1/crm/leads', 'crm:write', 'Crea un lead (formulario web, landing, chatbot)'], ['GET', '/api/v1/crm/clients/{id}', 'crm:read', 'Ficha del cliente'],
    ['POST', '/api/v1/quotes', 'quotes:write', 'Crea una cotización en borrador'], ['GET', '/api/v1/quotes/{code}', 'quotes:read', 'Cotización con versión vigente'],
    ['POST', '/api/v1/reservations', 'reservations:write', 'Crea reserva (Idempotency-Key obligatorio)'], ['GET', '/api/v1/reservations/{code}', 'reservations:read', 'Reserva, servicios y pasajeros'],
    ['GET', '/api/v1/finance/payments', 'payments:read', 'Pagos aplicados (filtro por fecha)'], ['GET', '/api/v1/finance/invoices', 'invoices:read', 'Comprobantes electrónicos emitidos'],
    ['GET', '/api/v1/operations/vouchers/{code}', 'operations:read', 'Voucher emitido (PDF firmado)'], ['GET|POST|DELETE', '/api/v1/integrations/webhooks', 'webhooks:manage', 'Gestión de webhooks por API']
  ];
  function renderDocs(b) {
    b.innerHTML = '<div class="grid g-2-1"><div>' + UI.card('Endpoints públicos del tenant', tbl(['Método', 'Ruta', 'Scope', 'Descripción'], API_EP.map(e => '<tr><td><span class="tag mono">' + esc(e[0]) + '</span></td><td class="mono small">' + esc(e[1]) + '</td><td class="mono small">' + esc(e[2]) + '</td><td class="small">' + esc(e[3]) + '</td></tr>')), { tight: true, sub: 'Base URL: https://api.kipucontrol.com · el tenant se resuelve desde la API key, nunca desde un parámetro' }) + '</div>' +
      '<div class="col" style="gap:16px">' + UI.card('Recursos', '<div class="list">' +
        '<div class="list-item"><div class="ico-box">' + ic('file') + '</div><div class="grow"><b class="small">OpenAPI 3.1 (JSON/YAML)</b><div class="xs faint mono">/api/v1/docs/openapi.json</div></div><button class="btn xs" id="dc-open">Ver</button></div>' +
        '<div class="list-item"><div class="ico-box">' + ic('layout') + '</div><div class="grow"><b class="small">Referencia interactiva</b><div class="xs faint mono">/api/v1/docs (Scramble / Stoplight)</div></div></div>' +
        '<div class="list-item"><div class="ico-box">' + ic('shield') + '</div><div class="grow"><b class="small">Guía de verificación de firmas</b><div class="xs faint">Ejemplos PHP, Node.js y Python</div></div><button class="btn xs" id="dc-sig">Ver</button></div>' +
        '</div>') + UI.card('Convenciones', '<ul class="small" style="margin:0;padding-left:18px;display:grid;gap:5px"><li>Paginación por cursor: <span class="mono">page[size]</span>, <span class="mono">page[cursor]</span></li><li>Montos como string decimal + <span class="mono">currency</span></li><li>Errores 422 con <span class="mono">errors</span>; negocio 409/422 con <span class="mono">code</span></li><li><span class="mono">Idempotency-Key</span> en POST críticos (24 h)</li><li>Versión de payload fijada por webhook</li></ul>') + '</div></div>';
    b.querySelector('#dc-open').onclick = () => openApiModal();
    b.querySelector('#dc-sig').onclick = () => UI.modal({ title: 'Verificar firma de webhooks', size: 'lg', body: '<pre class="pl-code">// Node.js (Express, cuerpo crudo)\nconst crypto = require("crypto");\nfunction verify(req, secret) {\n  const [t, v1] = req.get("KipuControl-Signature").split(",").map(p => p.split("=")[1]);\n  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;   // anti-replay 5 min\n  const mac = crypto.createHmac("sha256", secret).update(t + "." + req.rawBody).digest("hex");\n  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(v1));\n}\n\n// PHP\n[$t, $v1] = array_map(fn($p) => explode("=", $p)[1], explode(",", $_SERVER["HTTP_KIPUCONTROL_SIGNATURE"]));\n$ok = abs(time() - (int)$t) <= 300\n   && hash_equals(hash_hmac("sha256", $t . "." . file_get_contents("php://input"), $secret), $v1);</pre>', actions: [{ label: 'Cerrar' }] });
  }
  function openApiModal() {
    const y = 'openapi: 3.1.0\ninfo:\n  title: KipuControl API\n  version: "1.0.0"\nservers:\n  - url: https://api.kipucontrol.com/api/v1\nsecurity:\n  - bearerApiKey: []\ncomponents:\n  securitySchemes:\n    bearerApiKey: { type: http, scheme: bearer, bearerFormat: "qts_live_*" }\n    oauth2:\n      type: oauth2\n      flows:\n        authorizationCode:\n          authorizationUrl: https://auth.kipucontrol.com/oauth/authorize\n          tokenUrl: https://auth.kipucontrol.com/oauth/token\n          scopes: {' + SCOPES.map(s => ' "' + s[0] + '": "' + s[1] + '"').join(',') + ' }\npaths:\n' + API_EP.map(e => '  ' + e[1] + ':\n    ' + e[0].split('|')[0].toLowerCase() + ':\n      summary: ' + e[3] + '\n      security: [{ bearerApiKey: [] }, { oauth2: ["' + e[2] + '"] }]\n      x-required-scope: ' + e[2] + '\n      responses: { "200": { description: OK }, "401": { description: API key inválida }, "403": { description: Scope o feature no permitidos }, "429": { description: Rate limit } }').join('\n');
    UI.modal({ title: 'Especificación OpenAPI 3.1 (extracto)', size: 'lg', sub: 'Generada automáticamente desde FormRequest y JsonResource (dedoc/scramble).', body: '<pre class="pl-code" style="max-height:460px">' + esc(y) + '</pre>', actions: [{ label: 'Copiar', icon: 'copy', onClick: () => { UI.copy(y); return false; } }, { label: 'Cerrar' }] });
  }

  /* ---- Aplicaciones OAuth ---- */
  function renderOAuth(b) {
    const eO = entOn(ent('oauth_apps').val);
    const apps = DB.oauthApps.filter(a => a.tenantId === TID());
    b.innerHTML = (!eO ? UI.alert('warn', 'Su plan no incluye aplicaciones OAuth (entitlement <span class="mono">oauth_apps</span>, plan Enterprise).') : UI.alert('info', 'OAuth 2.0 con Authorization Code + PKCE (Laravel Passport). Permite que aplicaciones de terceros accedan con consentimiento del Tenant Admin y scopes limitados, sin compartir API keys.')) +
      '<div class="row between" style="margin:12px 0"><span class="small muted">' + apps.length + ' aplicación(es) registrada(s)</span>' + (eO ? '<button class="btn sm primary" id="oa-new">' + ic('plus') + 'Registrar aplicación</button>' : '') + '</div>' +
      tbl(['Aplicación', 'Client ID', 'Redirect URI', 'Scopes', 'Tokens', 'Estado', ''], apps.map(a => '<tr><td><b class="small">' + esc(a.name) + '</b><div class="xs faint">' + esc(a.vendor) + '</div></td><td class="mono small">' + esc(a.clientId) + '</td><td class="mono xs pl-wrap">' + a.redirectUris.map(esc).join('<br>') + '</td><td>' + a.scopes.map(s => '<span class="tag mono">' + esc(s) + '</span>').join(' ') + '</td><td class="num">' + a.tokens + (a.lastTokenAt ? '<div class="xs faint">' + datetime(a.lastTokenAt) + '</div>' : '') + '</td><td>' + B(a.status) + '</td><td style="white-space:nowrap">' + (a.status === 'activa' ? '<button class="btn xs" data-os="' + a.id + '">Nuevo secreto</button> <button class="btn xs danger" data-or="' + a.id + '">Revocar</button>' : '') + '</td></tr>'));
    const A = (id) => DB.oauthApps.find(a => a.id === id);
    const nb = b.querySelector('#oa-new'); if (nb) nb.onclick = () => {
      if (!guard('admin.api.manage')) return;
      UI.modal({ title: 'Registrar aplicación OAuth', size: 'lg', body: UI.form([{ id: 'oa-name', label: 'Nombre de la aplicación', required: true, col: 6 }, { id: 'oa-vendor', label: 'Empresa desarrolladora', required: true, col: 6 }, { id: 'oa-uri', label: 'Redirect URI (HTTPS)', required: true, col: 12, placeholder: 'https://app.proveedor.pe/oauth/callback' }, { type: 'section', label: 'Scopes que puede solicitar' }]) + scopeChecks(['catalog:read'], 'oa-sc'), actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const sc = checked(m, 'oa-sc'); const e = validUrl(d['oa-uri']); if (e) { UI.toast(e, 'bad'); return false; } if (!sc.length) { UI.toast('Seleccione al menos un scope.', 'bad'); return false; }
        const id = nextId(DB.oauthApps, 'OAP-', 4); const secret = 'qts_sec_' + rnd(40);
        DB.oauthApps.push({ id, tenantId: TID(), name: d['oa-name'], vendor: d['oa-vendor'], clientId: 'qts_cli_' + fakeHex(id + Date.now(), 8), redirectUris: [d['oa-uri']], scopes: sc, status: 'activa', createdAt: nowStr(), createdBy: Auth.user.id, tokens: 0, lastTokenAt: null });
        Store.save(); Audit.log('App OAuth', id, 'crear', '', d['oa-name'] + ' · ' + sc.join(' ')); secretModal('Client secret de ' + esc(d['oa-name']), secret, 'Entréguelo al desarrollador por un canal seguro.');
      } }] });
    };
    b.querySelectorAll('[data-os]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const a = A(x.dataset.os); const s = 'qts_sec_' + rnd(40); Audit.log('App OAuth', a.id, 'rotar_secreto', '', 'nuevo client secret'); Store.save(); secretModal('Nuevo client secret', s, 'El secreto anterior queda invalidado de inmediato.'); });
    b.querySelectorAll('[data-or]').forEach(x => x.onclick = () => { if (!guard('admin.api.manage')) return; const a = A(x.dataset.or); UI.confirm({ title: 'Revocar aplicación', danger: true, message: 'Se revocarán la aplicación <b>' + esc(a.name) + '</b> y sus ' + a.tokens + ' token(s) de acceso activos.', confirmLabel: 'Revocar', onConfirm: () => { a.status = 'revocada'; a.tokens = 0; Store.save(); Audit.log('App OAuth', a.id, 'revocar', 'activa', 'revocada'); UI.toast('Aplicación revocada.'); App.render(); } }); });
  }

  /* =====================================================================
     ADMIN / PLATAFORMA — Facturación de la plataforma (Super Admin SaaS)
     ===================================================================== */
  const tb = (tid) => DB.platformConfig.tenantBilling[tid] || {};
  const tMrr = (t) => t.id === TID() ? Math.round(monthlyOf(DB.subscription.plan, DB.subscription.cycle)) + addonsTotal(DB.subscription) : (t.mrr || 0) + (tb(t.id).addonsMrr || 0);
  const payingTenants = () => DB.tenants.filter(t => t.status === 'activo');
  const platformMrr = () => sum(payingTenants(), tMrr);
  const dunningInvs = () => DB.platformInvoices.filter(i => i.status === 'fallida' && i.dunning);
  function tenantUsage(tid) {
    if (tid === TID()) { const U = usageNow(DB.subscription); return { users: U.users, storageGB: U.storageGB, reservations: U.reservations, whatsapp: U.whatsapp, email: U.email, apiCalls: U.apiCalls, limits: effLimits(DB.subscription) }; }
    const t = tenantRow(tid); const u = DB.platformMetrics.usageByTenant[tid] || {};
    return Object.assign({ users: t.users }, u, { limits: planOf(t.plan).limits });
  }

  App.register('admin/plataforma', (el, params) => {
    ensure();
    const title = 'Facturación de plataforma';
    if (Auth.role !== 'super_admin' || !Auth.can('admin.tenant.manage')) return denied(el, title, 'admin.tenant.manage', crumbsP(title));
    const mrr = platformMrr(); const pm = DB.platformMetrics;
    const dun = dunningInvs(); const atRisk = sum(dun, i => tMrr(tenantRow(i.tenantId)));
    const trials = DB.tenants.filter(t => t.status === 'prueba');
    const churn90 = pm.churned.slice(-3).reduce((a, b) => a + b, 0);
    const lost90 = sum(pm.cancellations.filter(c => daysBetween(c.date, TODAY()) <= 92), 'mrr');
    el.innerHTML = page(
      UI.pageHeader({ title, crumbs: crumbsP(title), subtitle: 'Ingresos recurrentes, facturas por tenant, cobranza automática (dunning), trials, cupones, catálogo de planes y feature flags.',
        actions: '<a class="btn" href="#/admin/tenants">' + ic('server') + 'Tenants</a><button class="btn primary" id="pf-dun">' + ic('refresh') + 'Ejecutar job de cobranza</button>' }) +
      UI.alert('info', '<b>Alcance:</b> datos de facturación de la plataforma y contadores de uso agregados por tenant. Por aislamiento multi-tenant no se muestran clientes, reservas, montos de venta ni documentos de las agencias.') +
      '<div class="grid g5">' +
        UI.kpi({ label: 'MRR', value: money(mrr, 'PEN', 0), sub: payingTenants().length + ' tenants de pago', tone: 'accent', icon: 'trending' }) +
        UI.kpi({ label: 'ARR', value: money(mrr * 12, 'PEN', 0), sub: 'MRR × 12', tone: 'info', icon: 'chart' }) +
        UI.kpi({ label: 'ARPA', value: money(payingTenants().length ? mrr / payingTenants().length : 0, 'PEN', 0), sub: 'ingreso medio por tenant', tone: 'violet', icon: 'users' }) +
        UI.kpi({ label: 'Churn 90 días', value: churn90 + ' baja(s)', sub: money(lost90, 'PEN', 0) + ' de MRR perdido', tone: churn90 ? 'sun' : 'ok', icon: 'logout' }) +
        UI.kpi({ label: 'Cobros fallidos', value: money(sum(dun, 'total'), 'PEN', 0), sub: dun.length + ' en dunning · MRR en riesgo ' + money(atRisk, 'PEN', 0), tone: dun.length ? 'bad' : 'ok', icon: 'alert' }) +
      '</div><div id="pf-tabs" style="margin-top:16px"></div>');
    const tabIds = ['resumen', 'facturas', 'cobranza', 'trials', 'cupones', 'planes', 'flags', 'uso'];
    UI.tabs(el.querySelector('#pf-tabs'), [
      { id: 'resumen', label: 'Resumen', render: (b) => pfSummary(b) },
      { id: 'facturas', label: 'Facturas', count: DB.platformInvoices.length, render: (b) => pfInvoices(b) },
      { id: 'cobranza', label: 'Cobros fallidos y dunning', count: dun.length, render: (b) => pfDunning(b) },
      { id: 'trials', label: 'Trials', count: trials.length, render: (b) => pfTrials(b) },
      { id: 'cupones', label: 'Cupones', count: DB.coupons.filter(c => c.status === 'activo').length, render: (b) => pfCoupons(b) },
      { id: 'planes', label: 'Catálogo de planes', render: (b) => pfPlans(b) },
      { id: 'flags', label: 'Feature flags', render: (b) => pfFlags(b) },
      { id: 'uso', label: 'Uso por tenant', render: (b) => pfUsage(b) }
    ], tabIds.includes(params[0]) ? params[0] : 'resumen', { onChange: (id) => setHash('#/admin/plataforma' + (id === 'resumen' ? '' : '/' + id)) });
    el.querySelector('#pf-dun').onclick = () => runDunning();
  });

  function pfSummary(b) {
    const pm = DB.platformMetrics; const series = pm.mrr.slice(); series[series.length - 1] = platformMrr();
    const byPlan = PLAN_ORDER.map((p, i) => ({ label: p, value: sum(payingTenants().filter(t => t.plan === p), tMrr), color: UI.chart.COLORS[i] })).map(x => Object.assign(x, { display: money(x.value, 'PEN', 0) }));
    const sub = DB.subscription;
    const events = [];
    if (sub.status === 'cancel_programada') events.push({ title: 'Cancelación programada · ' + esc(tName(TID())), meta: 'efectiva ' + date(sub.cancelAt) + ' · motivo: ' + esc(sub.cancelSurvey ? sub.cancelSurvey.reason : '—'), icon: 'logout' });
    if (sub.pendingChange) events.push({ title: 'Downgrade programado · ' + esc(tName(TID())), meta: sub.plan + ' → ' + esc(sub.pendingChange.plan) + ' desde ' + date(sub.pendingChange.effective), icon: 'layers' });
    dunningInvs().forEach(i => events.push({ title: 'Dunning · ' + esc(tName(i.tenantId)), meta: esc(i.id) + ' · ' + money(i.total) + ' · próximo reintento ' + (i.dunning.nextRetryAt ? datetime(i.dunning.nextRetryAt) : '—'), icon: 'alert' }));
    DB.tenants.filter(t => t.status === 'prueba').forEach(t => events.push({ title: 'Trial por vencer · ' + esc(t.name), meta: 'vence ' + date(tb(t.id).trialEnd) + ' (' + daysBetween(TODAY(), tb(t.id).trialEnd) + ' días) · ' + (tb(t.id).pm ? 'con tarjeta' : 'sin método de pago'), icon: 'clock' }));
    DB.tenants.filter(t => t.status === 'suspendido').forEach(t => events.push({ title: 'Suspendido · ' + esc(t.name), meta: esc(t.suspendReason || 'Falta de pago: reintentos de cobro agotados') + (tb(t.id).suspendedAt ? ' · desde ' + date(tb(t.id).suspendedAt) : ''), icon: 'lock' }));
    pm.cancellations.forEach(c => events.push({ title: 'Baja · ' + esc(c.name) + ' (' + esc(c.plan) + ')', meta: date(c.date) + ' · ' + money(c.mrr, 'PEN', 0) + ' MRR · ' + esc(c.reason), icon: 'x' }));
    b.innerHTML = '<div class="grid g2">' +
      UI.card('MRR últimos 6 meses', UI.chart.line({ labels: pm.labels, series: [{ name: 'MRR (S/)', values: series }], height: 210 }), { sub: 'Incluye add-ons; excluye tenants suspendidos y en prueba' }) +
      UI.card('Altas y bajas de tenants', tbl(['Mes', '#Altas', '#Bajas (churn)', '#Suspensiones', '#MRR'], pm.labels.map((l, i) => '<tr><td>' + esc(l) + ' 2026</td><td class="num" style="color:var(--' + (pm.newTenants[i] ? 'ok' : 'fg-3') + ')">' + pm.newTenants[i] + '</td><td class="num" style="color:var(--' + (pm.churned[i] ? 'bad' : 'fg-3') + ')">' + pm.churned[i] + '</td><td class="num" style="color:var(--' + (pm.suspended[i] ? 'warn' : 'fg-3') + ')">' + pm.suspended[i] + '</td><td class="num">' + money(series[i], 'PEN', 0) + '</td></tr>')), { tight: true, sub: 'Logo churn = bajas / tenants de pago al inicio del mes' }) +
      UI.card('MRR por plan', UI.chart.donut({ items: byPlan, center: money(platformMrr() / 1000, 'PEN', 1) + 'k', sub: 'MRR' })) +
      UI.card('Eventos del ciclo de vida', UI.timeline(events)) +
      '</div>';
  }

  function pfInvoices(b) {
    UI.dataTable(b, { rows: () => DB.platformInvoices, exportName: 'facturas_plataforma_todas', pageSize: 12, searchPlaceholder: 'Buscar número o tenant…', search: (r) => r.id + ' ' + tName(r.tenantId) + ' ' + r.tenantId + ' ' + r.period,
      filters: [{ key: 'tenantId', label: 'Tenant', options: DB.tenants.map(t => [t.id, t.id + ' · ' + t.name.split(' ').slice(0, 2).join(' ')]) }, { key: 'status', label: 'Estado', options: [['pagada', 'Pagada'], ['pendiente', 'Pendiente'], ['fallida', 'Cobro fallido'], ['vencida', 'Vencida'], ['anulada', 'Anulada']] }, { key: 'period', label: 'Periodo', options: Array.from(new Set(DB.platformInvoices.map(i => i.period))).sort().reverse().map(p => [p, p]) }],
      columns: [
        { key: 'id', label: 'Número', render: r => '<span class="mono small">' + esc(r.id) + '</span>' },
        { key: 'tenantId', label: 'Tenant', render: r => '<b class="small">' + esc(tName(r.tenantId)) + '</b><div class="xs faint mono">' + esc(r.tenantId) + '</div>' },
        { key: 'kind', label: 'Concepto', render: r => r.kind === 'suscripcion' ? 'Suscripción ' + esc(r.period) : r.kind === 'prorrateo' ? 'Prorrateo' : 'Add-on' },
        { key: 'issueDate', label: 'Emisión', render: r => date(r.issueDate) },
        { key: 'total', label: 'Total', align: 'num', render: r => money(r.total) },
        { key: 'attempts', label: 'Intentos', align: 'num', sortVal: r => r.attempts.length, render: r => r.attempts.length + (r.recovered ? '<div class="xs" style="color:var(--ok)">recuperado</div>' : '') },
        { key: 'status', label: 'Estado', render: r => B(r.status) }
      ],
      onRow: (r) => pfInvoiceActions(r),
      footer: (rows) => '<tr><td colspan="4"><b>Total (' + rows.length + ')</b></td><td class="num"><b>' + money(sum(rows, 'total')) + '</b></td><td colspan="2"></td></tr>' });
  }
  function pfInvoiceActions(inv) {
    const acts = [];
    if (['fallida', 'pendiente', 'vencida'].includes(inv.status)) {
      acts.push({ label: 'Reintentar cobro', icon: 'refresh', onClick: () => { UI.closeModal(); chargeNow(inv, true); return false; } });
      acts.push({ label: 'Registrar pago manual', icon: 'wallet', onClick: () => { UI.closeModal(); manualPay(inv); return false; } });
    }
    if (inv.status !== 'anulada') acts.push({ label: 'Anular (nota de crédito)', cls: 'danger', icon: 'x', onClick: () => { UI.closeModal(); voidInvoice(inv); return false; } });
    showInvoice(inv, acts);
  }
  /* Cobro contra el token de tarjeta del tenant (simulado por tenantBilling.cardOk) */
  function chargeNow(inv, manual) {
    const cfgT = tb(inv.tenantId); const ok = !!cfgT.cardOk; const ts = nowStr();
    if (ok) {
      const bf = inv.status; inv.status = 'pagada'; inv.paidAt = ts; inv.attempts.push({ ts, result: 'exitoso', code: '00', msg: manual ? 'Reintento manual (Super Admin)' : 'Reintento automático' }); if (inv.dunning) { inv.dunning.nextRetryAt = null; inv.recovered = true; }
      Store.save(); Audit.log('Factura plataforma', inv.id, 'cobro_exitoso', bf, 'pagada'); Notify.push('plataforma.pago_recibido', 'Email', tenantEmail(inv.tenantId), 'Pago recibido ' + inv.id);
      if (manual) { UI.toast('Cobro aprobado: ' + inv.id + ' pagada.'); App.render(); }
      return true;
    }
    inv.attempts.push({ ts, result: 'rechazado', code: cfgT.declineCode || 'card_declined', msg: (DECLINE[cfgT.declineCode] || DECLINE.card_declined) + (manual ? ' · reintento manual' : '') });
    Store.save(); Audit.log('Factura plataforma', inv.id, 'cobro_rechazado', inv.status, cfgT.declineCode || 'card_declined');
    if (manual) { UI.toast('Cobro rechazado: ' + esc(DECLINE[cfgT.declineCode] || DECLINE.card_declined) + '. El calendario de dunning no cambia.', 'bad'); App.render(); }
    return false;
  }
  function manualPay(inv) {
    UI.modal({ title: 'Registrar pago manual · ' + esc(inv.id), size: 'sm', body: UI.form([{ id: 'mp-m', label: 'Medio', type: 'select', options: ['Transferencia BCP', 'Transferencia BBVA', 'Depósito en cuenta', 'Yape empresarial'], col: 12 }, { id: 'mp-ref', label: 'N.° de operación', required: true, col: 12 }, { id: 'mp-d', label: 'Fecha', type: 'date', value: TODAY(), required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = UI.formData(m);
      const bf = inv.status; inv.status = 'pagada'; inv.paidAt = d['mp-d'] + ' ' + nowStr().slice(11); inv.method = d['mp-m'] + ' · op. ' + d['mp-ref']; inv.attempts.push({ ts: nowStr(), result: 'exitoso', code: 'manual', msg: 'Pago manual registrado por ' + Auth.user.name }); if (inv.dunning) inv.dunning.nextRetryAt = null;
      const t = tenantRow(inv.tenantId); let react = false;
      if (t && t.status === 'suspendido' && !DB.platformInvoices.some(i => i.tenantId === t.id && ['fallida', 'vencida'].includes(i.status))) { t.status = 'activo'; t.suspendReason = ''; react = true; Audit.log('Tenant', t.id, 'reactivar', 'suspendido', 'activo (deuda saldada)'); }
      Store.save(); Audit.log('Factura plataforma', inv.id, 'pago_manual', bf, 'pagada · ' + d['mp-ref']); Notify.push('plataforma.pago_recibido', 'Email', tenantEmail(inv.tenantId), 'Pago registrado ' + inv.id);
      UI.toast('Pago registrado.' + (react ? ' Tenant reactivado: no tiene deuda pendiente.' : '')); App.render();
    } }] });
  }
  function voidInvoice(inv) {
    UI.confirm({ title: 'Anular factura ' + esc(inv.id), danger: true, reason: true, reasonLabel: 'Motivo (se consigna en la nota de crédito)', message: 'Se emitirá una <b>nota de crédito electrónica</b> por ' + money(inv.total) + ' que anula la factura ante SUNAT' + (inv.status === 'pagada' ? ' y se generará un reembolso a la tarjeta del tenant' : '') + '.', confirmLabel: 'Anular', onConfirm: (r) => {
      const bf = inv.status; inv.status = 'anulada'; inv.voidReason = r; inv.creditNote = 'NQ01-' + String(DB.platformInvoices.filter(i => i.creditNote).length + 41).padStart(8, '0'); if (inv.dunning) inv.dunning.nextRetryAt = null;
      Store.save(); Audit.log('Factura plataforma', inv.id, 'anular', bf, 'anulada · NC ' + inv.creditNote + ' · ' + r); Notify.push('plataforma.nota_credito', 'Email', tenantEmail(inv.tenantId), 'Nota de crédito ' + inv.creditNote + ' — anula ' + inv.id);
      UI.toast('Factura anulada con nota de crédito ' + inv.creditNote + '.'); App.render();
    } });
  }

  function pfDunning(b) {
    const cfg = DB.platformConfig.dunning; const list = dunningInvs();
    const hist = DB.platformInvoices.filter(i => i.dunning && i.status !== 'fallida').concat(DB.platformInvoices.filter(i => i.recovered && !i.dunning));
    b.innerHTML = '<div class="grid g-2-1"><div>' +
      (list.length ? list.map(inv => {
        const d = inv.dunning; const steps = cfg.retryDays.map((n, i) => { const day = addDays(d.failedAt, n + (i === cfg.retryDays.length - 1 ? d.extendedDays || 0 : 0)); const cls = i < d.retriesDone ? 'done' : i === d.retriesDone ? 'next' : ''; return '<span class="' + cls + '">Reintento ' + (i + 1) + ' · D+' + n + ' · ' + date(day) + '</span>'; });
        const suspendAt = addDays(d.failedAt, cfg.retryDays[cfg.retryDays.length - 1] + (d.extendedDays || 0));
        return UI.card(esc(tName(inv.tenantId)) + ' <span class="faint small mono">' + esc(inv.tenantId) + '</span>', UI.dl([['Factura', '<span class="mono">' + esc(inv.id) + '</span> · ' + money(inv.total)], ['Fallo inicial', date(d.failedAt) + ' · ' + esc(inv.attempts[0].msg)], ['Método', esc(inv.method || '—')], ['Próximo reintento', d.nextRetryAt ? datetime(d.nextRetryAt) + (d.nextRetryAt.slice(0, 10) <= TODAY() ? ' <span class="tag">vence hoy</span>' : '') : '—'], ['Suspensión automática', date(suspendAt) + (d.extendedDays ? ' (prórroga +' + d.extendedDays + ' d)' : '')]]) + '<div class="pl-steps" style="margin-top:10px"><span class="done">Cargo inicial · ' + date(d.failedAt) + '</span>' + steps.join('') + '<span>Suspensión</span></div>',
          { footer: '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn xs" data-dr="' + inv.id + '">' + ic('refresh') + 'Reintentar ahora</button><button class="btn xs" data-dl="' + inv.id + '">' + ic('mail') + 'Enviar enlace de pago</button><button class="btn xs" data-dx="' + inv.id + '">' + ic('clock') + 'Prórroga +7 días</button><button class="btn xs" data-dm="' + inv.id + '">' + ic('wallet') + 'Pago manual</button><button class="btn xs danger" data-ds="' + inv.id + '">' + ic('lock') + 'Suspender ahora</button></div>' });
      }).join('<div style="height:12px"></div>') : UI.card('', UI.empty('No hay cobros en proceso de dunning', 'checkCircle'))) +
      '<div style="margin-top:16px">' + UI.card('Historial de dunning', tbl(['Factura', 'Tenant', 'Resultado', '#Intentos'], hist.map(i => '<tr><td class="mono small">' + esc(i.id) + '</td><td class="small">' + esc(tName(i.tenantId)) + '</td><td>' + (i.status === 'pagada' ? B('pagada', 'Recuperado') : B(i.status)) + '</td><td class="num">' + i.attempts.length + '</td></tr>')), { tight: true }) + '</div></div>' +
      '<div class="col" style="gap:16px">' + UI.card('Política de cobranza', UI.dl([['Reintentos', cfg.retryDays.map(n => 'D+' + n).join(' · ')], ['Al agotar reintentos', cfg.suspendAfterLast ? 'Suspensión automática del tenant' : 'Solo alerta'], ['Notificaciones', 'Email al Tenant Admin en cada fallo + banner en Suscripción'], ['Job', '<span class="mono">billing:dunning</span> diario 10:00 (cola critical)']]), { footer: '<button class="btn sm" id="dp-edit">' + ic('edit') + 'Editar política</button>' }) +
      UI.card('Recuperación', '<div class="pl-kv"><div><span class="xs faint">Recuperado 90 d</span><b>' + money(sum(DB.platformInvoices.filter(i => i.recovered), 'total'), 'PEN', 0) + '</b></div><div><span class="xs faint">Perdido (vencidas)</span><b>' + money(sum(DB.platformInvoices.filter(i => i.status === 'vencida'), 'total'), 'PEN', 0) + '</b></div></div>') + '</div></div>';
    const I = (id) => DB.platformInvoices.find(i => i.id === id);
    b.querySelectorAll('[data-dr]').forEach(x => x.onclick = () => chargeNow(I(x.dataset.dr), true));
    b.querySelectorAll('[data-dm]').forEach(x => x.onclick = () => manualPay(I(x.dataset.dm)));
    b.querySelectorAll('[data-dl]').forEach(x => x.onclick = () => { const inv = I(x.dataset.dl); Notify.push('plataforma.enlace_pago', 'Email', tenantEmail(inv.tenantId), 'Actualice su método de pago — factura ' + inv.id); Audit.log('Factura plataforma', inv.id, 'enviar_enlace_pago', '', tenantEmail(inv.tenantId)); UI.toast('Enlace de pago enviado a ' + esc(tenantEmail(inv.tenantId)) + '.'); });
    b.querySelectorAll('[data-dx]').forEach(x => x.onclick = () => { const inv = I(x.dataset.dx); UI.confirm({ title: 'Conceder prórroga', reason: true, reasonLabel: 'Motivo', message: 'Se posterga 7 días el último reintento y la suspensión automática de <b>' + esc(tName(inv.tenantId)) + '</b>.', confirmLabel: 'Conceder', onConfirm: (r) => { const d = inv.dunning; d.extendedDays = (d.extendedDays || 0) + 7; if (d.nextRetryAt && d.retriesDone === DB.platformConfig.dunning.retryDays.length - 1) d.nextRetryAt = addDays(d.nextRetryAt.slice(0, 10), 7) + ' 10:00'; Store.save(); Audit.log('Factura plataforma', inv.id, 'prorroga_dunning', '', '+7 días · ' + r); UI.toast('Prórroga concedida.'); App.render(); } }); });
    b.querySelectorAll('[data-ds]').forEach(x => x.onclick = () => { const inv = I(x.dataset.ds); if (inv.tenantId === TID()) { UI.toast('Regla PROC-001: no se puede suspender el tenant de la sesión activa desde esta consola.', 'bad'); return; } UI.confirm({ title: 'Suspender tenant', danger: true, reason: true, reasonLabel: 'Motivo (queda en auditoría)', message: 'Se bloqueará el acceso de los usuarios de <b>' + esc(tName(inv.tenantId)) + '</b>. Los datos se conservan y el tenant se reactiva al saldar la deuda.', confirmLabel: 'Suspender', onConfirm: (r) => { suspendTenant(inv, r); UI.toast('Tenant suspendido.'); App.render(); } }); });
    b.querySelector('#dp-edit').onclick = () => UI.modal({ title: 'Política de cobranza', size: 'sm', body: UI.form([{ id: 'dp-days', label: 'Días de reintento tras el fallo (separados por coma)', value: cfg.retryDays.join(', '), required: true, col: 12 }, { id: 'dp-sus', type: 'switch', label: 'Suspender automáticamente al agotar reintentos', value: cfg.suspendAfterLast, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
      const d = UI.formData(m); const days = d['dp-days'].split(',').map(s => parseInt(s, 10)).filter(n => n > 0);
      if (!days.length || days.length > 6 || days.some((n, i) => i && n <= days[i - 1]) || days[days.length - 1] > 30) { UI.toast('Días inválidos: valores crecientes entre 1 y 30, máximo 6 reintentos.', 'bad'); return false; }
      const bf = cfg.retryDays.join('/') + (cfg.suspendAfterLast ? ' + susp.' : ''); cfg.retryDays = days; cfg.suspendAfterLast = d['dp-sus'];
      Store.save(); Audit.log('Plan', 'dunning', 'editar_politica', bf, days.join('/') + (cfg.suspendAfterLast ? ' + susp.' : '')); UI.toast('Política de cobranza actualizada.'); App.render();
    } }] });
  }
  function suspendTenant(inv, reason) {
    const t = tenantRow(inv.tenantId); if (!t) return;
    const bf = t.status; t.status = 'suspendido'; t.suspendReason = reason || ('Suspensión automática por dunning: factura ' + inv.id + ' impaga tras ' + DB.platformConfig.dunning.retryDays.length + ' reintentos.');
    inv.status = 'vencida'; inv.dunning.nextRetryAt = null; inv.dunning.exhausted = true; tb(t.id).suspendedAt = TODAY();
    DB.platformMetrics.suspended[DB.platformMetrics.suspended.length - 1]++;
    Store.save(); Audit.log('Tenant', t.id, 'suspender', bf, 'suspendido · ' + t.suspendReason);
    Notify.push('tenant.suspendido', 'Email', tenantEmail(t.id), 'Suspensión de servicio por falta de pago — ' + t.name);
  }
  /* Job billing:dunning — procesa los reintentos vencidos a la fecha */
  function runDunning() {
    const cfg = DB.platformConfig.dunning; const log = [];
    dunningInvs().forEach(inv => {
      const d = inv.dunning;
      if (!d.nextRetryAt || d.nextRetryAt.slice(0, 10) > TODAY()) { log.push('<span class="l-mute">' + inv.id + ' · ' + esc(tName(inv.tenantId)) + ': sin reintento hoy (próximo ' + (d.nextRetryAt ? d.nextRetryAt : '—') + ')</span>'); return; }
      const ok = chargeNow(inv, false); d.retriesDone++;
      if (ok) { log.push('<span class="l-ok">' + inv.id + ': reintento ' + d.retriesDone + ' aprobado — factura pagada</span>'); return; }
      const nextDays = cfg.retryDays[d.retriesDone];
      if (nextDays != null) { d.nextRetryAt = addDays(d.failedAt, nextDays + (d.retriesDone === cfg.retryDays.length - 1 ? d.extendedDays || 0 : 0)) + ' 10:00'; log.push('<span class="l-warn">' + inv.id + ': reintento ' + d.retriesDone + ' rechazado (' + esc(DECLINE[tb(inv.tenantId).declineCode] || 'rechazo') + '). Próximo: ' + d.nextRetryAt + '</span>'); Notify.push('plataforma.cobro_fallido', 'Email', tenantEmail(inv.tenantId), 'Cobro rechazado ' + inv.id + ' — reintento ' + d.nextRetryAt); }
      else if (cfg.suspendAfterLast) { if (inv.tenantId === TID()) { d.nextRetryAt = null; log.push('<span class="l-bad">' + inv.id + ': reintentos agotados (tenant de la sesión: suspensión omitida en demo)</span>'); } else { suspendTenant(inv); log.push('<span class="l-bad">' + inv.id + ': reintentos agotados — tenant ' + inv.tenantId + ' SUSPENDIDO</span>'); } }
      else { d.nextRetryAt = null; log.push('<span class="l-bad">' + inv.id + ': reintentos agotados — alerta enviada</span>'); }
    });
    const trials = DB.tenants.filter(t => t.status === 'prueba' && tb(t.id).trialEnd && tb(t.id).trialEnd < TODAY());
    trials.forEach(t => log.push('<span class="l-warn">Trial vencido ' + t.id + ': requiere conversión o baja</span>'));
    Store.save(); Audit.log('Job', 'billing:dunning', 'ejecutar', '', log.length + ' registros');
    UI.modal({ title: 'Job billing:dunning ejecutado', size: 'lg', sub: 'Simulación de la ejecución programada (diaria 10:00, cola critical, lock por factura).', body: '<pre class="pl-code">[' + nowStr() + '] billing:dunning start\n' + (log.length ? log.join('\n') : 'Sin facturas en dunning') + '\n[' + nowStr() + '] billing:dunning done</pre>', actions: [{ label: 'Cerrar', cls: 'primary', onClick: () => App.render() }] });
  }

  function pfTrials(b) {
    const list = DB.tenants.filter(t => t.status === 'prueba');
    b.innerHTML = UI.alert('info', 'Trial estándar de ' + planOf('Starter').trialDays + ' días sin tarjeta. Al vencer sin método de pago el tenant pasa a solo lectura 7 días y luego a baja. Aviso automático a 7, 3 y 1 día(s).') +
      (list.length ? tbl(['Tenant', 'Plan', 'Inicio', 'Vence', '#Días', 'Uso', 'Método de pago', 'Acciones'], list.map(t => { const c = tb(t.id); const left = daysBetween(TODAY(), c.trialEnd); const u = tenantUsage(t.id); return '<tr><td><b class="small">' + esc(t.name) + '</b><div class="xs faint mono">' + esc(t.id) + ' · ' + esc(t.adminEmail || '') + '</div></td><td>' + esc(t.plan) + '</td><td>' + date(c.trialStart) + '</td><td>' + date(c.trialEnd) + (c.trialExtended ? '<div class="xs faint">extendido +' + c.trialExtended + ' d</div>' : '') + '</td><td class="num"><b style="color:var(--' + (left <= 3 ? 'bad' : left <= 7 ? 'warn' : 'fg') + ')">' + left + '</b></td><td class="small">' + t.users + ' usuarios · ' + fmtN(u.reservations || 0, 0) + ' reservas</td><td>' + (c.pm ? esc(c.pm) : '<span class="faint">Sin tarjeta</span>') + '</td><td style="white-space:nowrap"><button class="btn xs" data-tx="' + t.id + '">+7 días</button> <button class="btn xs primary" data-tc="' + t.id + '">Convertir</button></td></tr>'; })) : UI.empty('No hay tenants en prueba', 'clock'));
    b.querySelectorAll('[data-tx]').forEach(x => x.onclick = () => { const t = tenantRow(x.dataset.tx); const c = tb(t.id); if ((c.trialExtended || 0) >= 14) { UI.toast('Regla SUB-BR-10: extensión máxima de trial 14 días.', 'bad'); return; } const bf = c.trialEnd; c.trialEnd = addDays(c.trialEnd, 7); c.trialExtended = (c.trialExtended || 0) + 7; Store.save(); Audit.log('Tenant', t.id, 'extender_trial', bf, c.trialEnd); Notify.push('trial.extendido', 'Email', t.adminEmail, 'Su prueba se extendió hasta el ' + date(c.trialEnd)); UI.toast('Trial extendido hasta el ' + date(c.trialEnd) + '.'); App.render(); });
    b.querySelectorAll('[data-tc]').forEach(x => x.onclick = () => { const t = tenantRow(x.dataset.tc); UI.modal({ title: 'Convertir trial a suscripción · ' + esc(t.name), size: 'sm', body: UI.form([{ id: 'tc-plan', label: 'Plan', type: 'select', options: PLAN_ORDER, value: t.plan, col: 6 }, { id: 'tc-cyc', label: 'Ciclo', type: 'select', options: [['mensual', 'Mensual'], ['anual', 'Anual']], col: 6 }, { id: 'tc-cp', label: 'Cupón (opcional)', col: 12 }]) + '<p class="xs faint" style="margin-top:8px">Se emite la primera factura pendiente de pago (vence en 7 días) y se envía el enlace para registrar la tarjeta.</p>', actions: [{ label: 'Cancelar' }, { label: 'Convertir', cls: 'primary', onClick: (m) => {
      const d = UI.formData(m); const cp = d['tc-cp'] ? DB.coupons.find(c => c.code === d['tc-cp'].toUpperCase() && c.status === 'activo' && c.validTo >= TODAY() && c.plans.includes(d['tc-plan']) && c.redeemed < c.maxRedemptions) : null;
      if (d['tc-cp'] && !cp) { UI.toast('Regla SUB-BR-07: cupón inválido para el plan elegido.', 'bad'); return false; }
      const price = cyclePrice(d['tc-plan'], d['tc-cyc']); const disc = cp ? (cp.type === 'percent' ? r2(price * cp.value / 100) : cp.value) : 0;
      const lines = [{ desc: 'Suscripción plan ' + d['tc-plan'] + ' (' + d['tc-cyc'] + ')', qty: 1, unit: price, amount: price }]; if (disc) { lines.push({ desc: 'Cupón ' + cp.code, qty: 1, unit: -disc, amount: -disc }); cp.redeemed++; }
      const inv = newInvoice(t.id, lines, { status: 'pendiente', due: addDays(TODAY(), 7), to: addDays(d['tc-cyc'] === 'anual' ? addMonths(TODAY(), 12) : addMonths(TODAY(), 1), -1) });
      const bf = t.status + ' ' + t.plan; t.status = 'activo'; t.plan = d['tc-plan']; t.mrr = Math.round(monthlyOf(d['tc-plan'], d['tc-cyc'])); t.modules = d['tc-plan'] === 'Starter' ? 6 : d['tc-plan'] === 'Professional' ? 12 : 18;
      Object.assign(tb(t.id), { cycle: d['tc-cyc'], day: +TODAY().slice(8) });
      Store.save(); Audit.log('Tenant', t.id, 'convertir_trial', bf, 'activo ' + t.plan + ' · ' + inv.id); Notify.push('trial.convertido', 'Email', t.adminEmail, 'Bienvenido al plan ' + t.plan + ' — factura ' + inv.id);
      UI.toast('Trial convertido. Factura ' + inv.id + ' emitida.'); App.render();
    } }] }); });
  }

  function pfCoupons(b) {
    b.innerHTML = '<div class="row between" style="margin-bottom:12px"><span class="small muted">Descuentos aplicables a la suscripción (no acumulables). El canje se valida en backend con lock para no exceder el máximo.</span><button class="btn sm primary" id="cp-new">' + ic('plus') + 'Nuevo cupón</button></div><div id="cp-dt"></div>';
    UI.dataTable(b.querySelector('#cp-dt'), { rows: () => DB.coupons, exportName: 'cupones', search: ['code', 'note'],
      filters: [{ key: 'status', label: 'Estado', options: [['activo', 'Activo'], ['inactivo', 'Inactivo']] }],
      columns: [
        { key: 'code', label: 'Código', render: r => '<b class="mono">' + esc(r.code) + '</b><div class="xs faint">' + esc(r.note || '') + '</div>' },
        { key: 'value', label: 'Descuento', render: r => esc(couponLabel(r)) + ' × ' + r.months + ' ciclo(s)' },
        { key: 'plans', label: 'Planes', sort: false, render: r => r.plans.map(p => '<span class="tag">' + esc(p) + '</span>').join(' ') },
        { key: 'redeemed', label: 'Canjes', align: 'num', render: r => r.redeemed + ' / ' + r.maxRedemptions + UI.progress(r.redeemed / r.maxRedemptions * 100, r.redeemed >= r.maxRedemptions ? 'bad' : '') },
        { key: 'validTo', label: 'Vigente hasta', render: r => date(r.validTo) + (r.validTo < TODAY() ? ' ' + B('vencida') : '') },
        { key: 'status', label: 'Estado', render: r => B(r.status) },
        { key: '', label: '', sort: false, render: r => '<button class="btn xs" data-ct="' + r.id + '">' + (r.status === 'activo' ? 'Desactivar' : 'Activar') + '</button>' }
      ],
      afterDraw: (c) => c.querySelectorAll('[data-ct]').forEach(x => x.onclick = () => { const cp = DB.coupons.find(y => y.id === x.dataset.ct); if (cp.status !== 'activo' && (cp.validTo < TODAY() || cp.redeemed >= cp.maxRedemptions)) { UI.toast('No se puede activar: cupón vencido o agotado. Cree uno nuevo.', 'bad'); return; } const bf = cp.status; cp.status = cp.status === 'activo' ? 'inactivo' : 'activo'; Store.save(); Audit.log('Cupón', cp.code, cp.status === 'activo' ? 'activar' : 'desactivar', bf, cp.status); UI.toast('Cupón ' + esc(cp.code) + ' ' + (cp.status === 'activo' ? 'activado.' : 'desactivado.')); App.render(); })
    });
    b.querySelector('#cp-new').onclick = () => UI.modal({ title: 'Nuevo cupón', size: 'lg', body: UI.form([
      { id: 'nc-code', label: 'Código', required: true, col: 4, placeholder: 'VERANO27' }, { id: 'nc-type', label: 'Tipo', type: 'select', options: [['percent', 'Porcentaje'], ['fixed', 'Monto fijo (S/)']], col: 4 }, { id: 'nc-val', label: 'Valor', type: 'number', min: 1, required: true, col: 4 },
      { id: 'nc-months', label: 'Duración (ciclos)', type: 'number', min: 1, max: 12, value: 3, required: true, col: 4 }, { id: 'nc-max', label: 'Máximo de canjes', type: 'number', min: 1, value: 50, required: true, col: 4 }, { id: 'nc-to', label: 'Vigente hasta', type: 'date', value: addDays(TODAY(), 90), required: true, col: 4 },
      { id: 'nc-note', label: 'Nota interna', col: 12 }, { type: 'section', label: 'Planes aplicables' }
    ]) + '<div class="row" style="gap:14px">' + PLAN_ORDER.map(p => '<label class="check"><input type="checkbox" name="nc-pl" value="' + p + '" checked> ' + p + '</label>').join('') + '</div>', actions: [{ label: 'Cancelar' }, { label: 'Crear cupón', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = UI.formData(m); const code = d['nc-code'].toUpperCase(); const pl = checked(m, 'nc-pl');
      if (!/^[A-Z0-9_-]{4,20}$/.test(code)) { UI.toast('Código: 4 a 20 caracteres A-Z, 0-9, guion.', 'bad'); return false; }
      if (DB.coupons.some(c => c.code === code)) { UI.toast('Ya existe un cupón con ese código.', 'bad'); return false; }
      if (d['nc-type'] === 'percent' && (d['nc-val'] <= 0 || d['nc-val'] > 50)) { UI.toast('Regla SUB-BR-08: el descuento porcentual máximo es 50 %.', 'bad'); return false; }
      if (!pl.length) { UI.toast('Seleccione al menos un plan.', 'bad'); return false; }
      if (d['nc-to'] < TODAY()) { UI.toast('La vigencia debe ser futura.', 'bad'); return false; }
      const id = nextId(DB.coupons, 'CPN-', 4);
      DB.coupons.unshift({ id, code, type: d['nc-type'], value: +d['nc-val'], months: +d['nc-months'], plans: pl, maxRedemptions: +d['nc-max'], redeemed: 0, validTo: d['nc-to'], status: 'activo', note: d['nc-note'], createdBy: Auth.user.id, createdAt: TODAY() });
      Store.save(); Audit.log('Cupón', code, 'crear', '', couponLabel({ type: d['nc-type'], value: +d['nc-val'] }) + ' × ' + d['nc-months'] + ' · ' + pl.join('/')); UI.toast('Cupón ' + code + ' creado.'); App.render();
    } }] });
  }

  function pfPlans(b) {
    const keys = ['users', 'sedes', 'storageGB', 'reservations', 'whatsapp', 'email', 'apiCalls', 'rateMin', 'webhooks', 'apiKeys'];
    b.innerHTML = demoNote() + UI.alert('info', 'Los cambios de precio aplican a nuevas suscripciones y a las existentes desde su siguiente renovación con aviso previo de 30 días (grandfathering). Los límites se aplican de inmediato vía middleware de entitlements.') +
      '<div class="row between" style="margin-top:14px"><div class="section-title">Catálogo de planes ' + DEMO_TAG + '</div></div>' +
      '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Concepto</th>' + PLAN_ORDER.map(p => '<th class="num">' + esc(p) + '</th>').join('') + '</tr></thead><tbody>' +
      '<tr><td><b>Precio mensual</b> ' + DEMO_TAG + '</td>' + PLAN_ORDER.map(p => '<td class="num"><b>' + money(planOf(p).price, 'PEN', 0) + '</b></td>').join('') + '</tr>' +
      '<tr><td>Precio anual</td>' + PLAN_ORDER.map(p => '<td class="num">' + money(planOf(p).priceYear, 'PEN', 0) + '</td>').join('') + '</tr>' +
      '<tr><td>Días de prueba</td>' + PLAN_ORDER.map(p => '<td class="num">' + planOf(p).trialDays + '</td>').join('') + '</tr>' +
      keys.map(k => '<tr><td>' + esc(LIMIT_LABEL[k]) + '</td>' + PLAN_ORDER.map(p => '<td class="num">' + (planOf(p).limits[k] === 0 ? '<span class="faint">No incluido</span>' : fmtQ(planOf(p).limits[k])) + '</td>').join('') + '</tr>').join('') +
      '<tr><td>Tenants activos / prueba</td>' + PLAN_ORDER.map(p => '<td class="num">' + DB.tenants.filter(t => t.plan === p && t.status === 'activo').length + ' / ' + DB.tenants.filter(t => t.plan === p && t.status === 'prueba').length + '</td>').join('') + '</tr>' +
      '<tr><td>Reglas de reserva incluidas</td>' + PLAN_ORDER.map(p => '<td class="num">' + rulesOfPlan(p).length + ' de ' + allRules().length + '</td>').join('') + '</tr>' +
      '<tr><td></td>' + PLAN_ORDER.map(p => '<td class="num"><button class="btn xs" data-pe="' + p + '">' + ic('edit') + 'Editar</button></td>').join('') + '</tr>' +
      '</tbody></table></div><div id="pf-rm" style="margin-top:16px"></div>';
    drawRuleMatrix(b.querySelector('#pf-rm'));
    b.querySelectorAll('[data-pe]').forEach(x => x.onclick = () => {
      const p = planOf(x.dataset.pe); const n = DB.tenants.filter(t => t.plan === p.id && t.status !== 'suspendido').length;
      UI.modal({ title: 'Editar plan ' + esc(p.id) + ' (demo)', size: 'lg', sub: n + ' tenant(s) en este plan · precios y límites de demostración, editables; se reemplazarán por los definitivos', body: UI.form([{ id: 'pe-price', label: 'Precio mensual (S/)', type: 'number', min: 0, value: p.price, required: true, col: 4 }, { id: 'pe-year', label: 'Precio anual (S/)', type: 'number', min: 0, value: p.priceYear, required: true, col: 4 }, { id: 'pe-trial', label: 'Días de prueba', type: 'number', min: 0, max: 60, value: p.trialDays, required: true, col: 4 }, { type: 'section', label: 'Límites (vacío = ilimitado; 0 = no incluido)' }].concat(keys.map(k => ({ id: 'pe-' + k, label: LIMIT_LABEL[k], type: 'number', min: 0, value: p.limits[k] == null ? '' : p.limits[k], col: 4 })))),
        actions: [{ label: 'Cancelar' }, { label: 'Guardar cambios', cls: 'primary', onClick: (m) => {
          if (!UI.validate(m)) return false; const d = UI.formData(m);
          if (d['pe-year'] > d['pe-price'] * 12) { UI.toast('El precio anual no puede superar 12 mensualidades.', 'bad'); return false; }
          const i = PLAN_ORDER.indexOf(p.id); const lower = PLAN_ORDER[i - 1] && planOf(PLAN_ORDER[i - 1]); const upper = PLAN_ORDER[i + 1] && planOf(PLAN_ORDER[i + 1]);
          if ((lower && d['pe-price'] <= lower.price) || (upper && d['pe-price'] >= upper.price)) { UI.toast('Regla PLN-BR-01: el precio debe mantener el orden Starter < Professional < Enterprise.', 'bad'); return false; }
          const bf = 'S/ ' + p.price + ' · ' + keys.map(k => k + '=' + (p.limits[k] == null ? '∞' : p.limits[k])).join(' ');
          p.price = +d['pe-price']; p.priceYear = +d['pe-year']; p.trialDays = +d['pe-trial']; keys.forEach(k => { p.limits[k] = d['pe-' + k] === '' ? null : +d['pe-' + k]; });
          Store.save(); Audit.log('Plan', p.id, 'editar_plan', bf, 'S/ ' + p.price + ' · ' + keys.map(k => k + '=' + (p.limits[k] == null ? '∞' : p.limits[k])).join(' '));
          if (n) Notify.push('plan.cambio_condiciones', 'Email', 'Tenants plan ' + p.id, 'Aviso de cambio de condiciones del plan ' + p.id + ' (30 días)');
          UI.toast('Plan ' + esc(p.id) + ' actualizado.' + (n ? ' Aviso de 30 días encolado para ' + n + ' tenant(s).' : '')); App.render();
        } }] });
    });
  }

  /* Matriz regla × plan (DEMO). Marcar un plan = plan mínimo de la regla; los planes superiores la heredan. */
  function drawRuleMatrix(box) {
    const rules = allRules(); const live = DB.tenants.filter(t => t.status !== 'cancelado');
    const cell = (r, p) => { const mp = minPlanOf(r); const inc = rank(p) >= rank(mp); const isMin = p === mp;
      return '<td class="c' + (inc ? ' inc' : '') + '"><label class="pl-rmc" title="' + esc(r.name) + ': incluir desde ' + esc(p) + '"><input type="radio" name="rm-' + esc(r.id) + '" data-rm="' + esc(r.id) + '" value="' + p + '"' + (isMin ? ' checked' : '') + ' aria-label="' + esc(r.id + ' desde ' + p) + '"><span class="xs">' + (isMin ? 'Desde aquí' : inc ? 'Incluida' : '—') + '</span></label></td>'; };
    box.innerHTML = UI.card('Planes × reglas de reserva ' + DEMO_TAG,
      '<p class="small muted" style="margin:0 0 10px">Marque el plan <b>desde</b> el que se incluye cada regla; los planes superiores la heredan. Cambiar el plan mínimo actualiza <span class="mono">rule.minPlan</span> y <span class="mono">plans[].rules</span>, queda auditado y el motor (<span class="mono">BE.on</span>) deja de aplicar la regla en los tenants cuyo plan no la incluye, aunque la tengan activada.</p>' +
      '<div class="tbl-wrap"><table class="tbl pl-fm pl-rm"><thead><tr><th>Regla</th><th>Código</th>' + PLAN_ORDER.map(p => '<th class="c">' + esc(p) + '<div class="xs faint" style="font-weight:400">' + rulesOfPlan(p).length + ' reglas</div></th>').join('') + '<th class="c">Tenants con acceso</th></tr></thead><tbody>' +
      ruleGroups().map(g => { const rs = rules.filter(r => r.group === g); if (!rs.length) return '';
        return '<tr class="g"><td colspan="' + (3 + PLAN_ORDER.length) + '">' + esc(g) + '</td></tr>' + rs.map(r => '<tr><td class="small">' + esc(r.name) + (r.custom ? ' <span class="tag">Personalizada</span>' : '') + '</td><td class="mono xs">' + esc(r.id) + '</td>' + PLAN_ORDER.map(p => cell(r, p)).join('') + '<td class="c small">' + live.filter(t => rank(t.plan) >= rank(minPlanOf(r))).length + ' / ' + live.length + '</td></tr>').join(''); }).join('') +
      '</tbody></table></div>',
      { sub: 'Agrupada como el centro de reglas · ' + rules.length + ' reglas', actions: '<button class="btn sm" id="rm-reset">' + ic('refresh') + 'Restablecer matriz demo</button>' });
    box.querySelectorAll('[data-rm]').forEach(x => x.onchange = () => {
      const r = allRules().find(y => y.id === x.dataset.rm); const from = minPlanOf(r); const to = x.value;
      box.querySelector('[data-rm="' + r.id + '"][value="' + from + '"]').checked = true;
      if (from === to) return;
      const aff = affectedTenants(from, to); const lose = rank(to) > rank(from);
      UI.confirm({ title: 'Plan mínimo de ' + esc(r.id) + ': ' + esc(from) + ' → ' + esc(to), danger: lose, confirmLabel: 'Aplicar cambio',
        message: '<b>' + esc(r.name) + '</b> quedará incluida desde el plan <b>' + esc(to) + '</b>.<br>' + (aff.length ? '<b>' + aff.length + ' tenant(s) afectados</b> (' + (lose ? 'pierden' : 'ganan') + ' la regla): ' + aff.map(t => esc(t.name) + ' (' + esc(t.plan) + ')').join(', ') + '.' + (lose ? ' En esos tenants el motor deja de aplicarla aunque esté activada; su configuración se conserva por si mejoran de plan.' : ' Podrán activarla desde su centro de reglas.') : 'Ningún tenant cambia de acceso con este ajuste.') + '<div class="xs faint" style="margin-top:8px">Matriz de demostración: se reemplazará por la definitiva.</div>',
        onConfirm: () => {
          r.minPlan = to; syncPlanRules(); Store.save();
          Audit.log('Plan × regla', r.id, 'cambiar_plan_minimo', from, to + ' · ' + aff.length + ' tenant(s) ' + (lose ? 'pierden' : 'ganan') + ' la regla');
          if (aff.length) Notify.push('plan.cambio_reglas', 'Email', aff.length + ' tenant(s)', 'Cambio en las reglas incluidas en su plan: ' + r.name);
          UI.toast('Plan mínimo de ' + esc(r.id) + ' = ' + esc(to) + '. ' + aff.length + ' tenant(s) afectados.', lose && aff.length ? 'warn' : 'ok'); drawRuleMatrix(box);
        } });
    });
    box.querySelector('#rm-reset').onclick = () => {
      const seed = ((window.SEED && window.SEED.settings && window.SEED.settings.bookingRules) || []).reduce((a, r) => { a[r.id] = r.minPlan; return a; }, {});
      const diff = allRules().filter(r => minPlanOf(r) !== (seed[r.id] || 'Starter'));
      UI.confirm({ title: 'Restablecer matriz demo', danger: true, confirmLabel: 'Restablecer', message: 'Se restaurará el plan mínimo de demostración de todas las reglas (' + diff.length + ' difieren). Las reglas personalizadas quedan en Starter.',
        onConfirm: () => { diff.forEach(r => { r.minPlan = seed[r.id] || 'Starter'; }); syncPlanRules(); Store.save(); Audit.log('Plan × regla', 'MATRIZ', 'restablecer_demo', diff.length + ' reglas modificadas', 'matriz demo'); UI.toast('Matriz demo restablecida (' + diff.length + ' reglas).'); drawRuleMatrix(box); } });
    };
  }

  function pfFlags(b) {
    const groups = {}; DB.featureFlags.forEach(f => (groups[f.module] = groups[f.module] || []).push(f));
    const ovs = DB.featureFlags.flatMap(f => f.overrides.map(o => Object.assign({ f }, o)));
    b.innerHTML = UI.alert('info', 'Entitlements: cada módulo se habilita por plan, por add-on o por excepción (override) para un tenant. El backend lo valida con el middleware <span class="mono">EnsureFeature:{key}</span> en rutas y jobs; el menú del frontend solo lo refleja. Caché Redis <span class="mono">ent:{tenant}</span> invalidada al guardar.') +
      '<div class="tbl-wrap" style="margin-top:12px"><table class="tbl pl-fm"><thead><tr><th>Funcionalidad</th><th>Clave</th><th>Tipo</th>' + PLAN_ORDER.map(p => '<th class="c">' + esc(p) + '</th>').join('') + '<th class="c">Add-on</th><th class="c">Overrides</th></tr></thead><tbody>' +
      Object.keys(groups).map(g => '<tr class="g"><td colspan="' + (5 + PLAN_ORDER.length) + '">' + esc(g) + '</td></tr>' + groups[g].map(f => '<tr><td class="small">' + esc(f.label) + '</td><td class="mono xs">' + esc(f.key) + '</td><td class="xs">' + esc(f.kind) + '</td>' + PLAN_ORDER.map(p => '<td class="c">' + (typeof f.plans[p] === 'string' ? '<span class="tag" title="Nivel ' + esc(f.plans[p]) + '">' + esc(f.plans[p]) + '</span> ' : '') + '<input type="checkbox" data-ff="' + f.key + '" data-pl="' + p + '"' + (f.plans[p] ? ' checked' : '') + ' aria-label="' + esc(f.label + ' en ' + p) + '"></td>').join('') + '<td class="c xs">' + (f.addon ? esc(addonOf(f.addon).label.split(' ')[0]) + '…' : '—') + '</td><td class="c">' + (f.overrides.length ? '<span class="tag">' + f.overrides.length + '</span>' : '') + '</td></tr>').join('')).join('') +
      '</tbody></table></div>' +
      '<div style="margin-top:16px">' + UI.card('Excepciones por tenant (overrides)', tbl(['Tenant', 'Funcionalidad', 'Valor', 'Hasta', 'Motivo', 'Otorgado', ''], ovs.map((o, i) => '<tr><td class="small"><b>' + esc(tName(o.tenantId)) + '</b><div class="xs faint mono">' + esc(o.tenantId) + '</div></td><td class="small">' + esc(o.f.label) + '<div class="xs faint mono">' + esc(o.f.key) + '</div></td><td>' + (o.value ? B('activo', 'Habilitado') : B('inactivo', 'Deshabilitado')) + '</td><td>' + (o.until ? date(o.until) + (o.until < TODAY() ? ' ' + B('vencida') : '') : 'Indefinido') + '</td><td class="small">' + esc(o.reason) + '</td><td class="xs">' + esc(uName(o.by)) + '<br>' + datetime(o.at) + '</td><td><button class="btn xs danger" data-od="' + i + '">Quitar</button></td></tr>')), { tight: true, actions: '<button class="btn sm primary" id="ov-new">' + ic('plus') + 'Nueva excepción</button>' }) + '</div>';
    b.querySelectorAll('[data-ff]').forEach(x => x.onchange = () => {
      const f = DB.featureFlags.find(y => y.key === x.dataset.ff); const p = x.dataset.pl; const on = x.checked;
      const n = DB.tenants.filter(t => t.plan === p && t.status !== 'suspendido').length;
      x.checked = !on;
      UI.confirm({ title: (on ? 'Habilitar ' : 'Deshabilitar ') + esc(f.label) + ' en ' + esc(p), danger: !on, message: 'Afecta a <b>' + n + ' tenant(s)</b> del plan ' + esc(p) + '.' + (on ? '' : ' Los usuarios perderán acceso a las pantallas y endpoints del módulo (403 FEATURE_NOT_IN_PLAN); los datos se conservan.'), confirmLabel: on ? 'Habilitar' : 'Deshabilitar', onConfirm: () => {
        const bf = String(f.plans[p]); f.plans[p] = on; Store.save(); Audit.log('Feature flag', f.key, 'plan_entitlement', p + ': ' + bf, p + ': ' + on); UI.toast('Entitlement actualizado. Caché de ' + n + ' tenant(s) invalidada.'); App.render();
      } });
    });
    b.querySelectorAll('[data-od]').forEach(x => x.onclick = () => { const o = ovs[+x.dataset.od]; UI.confirm({ title: 'Quitar excepción', danger: true, message: 'Se eliminará la excepción de <b>' + esc(o.f.label) + '</b> para <b>' + esc(tName(o.tenantId)) + '</b>. Volverá a regir lo que indique su plan.', confirmLabel: 'Quitar', onConfirm: () => { o.f.overrides = o.f.overrides.filter(y => !(y.tenantId === o.tenantId && y.at === o.at)); Store.save(); Audit.log('Feature flag', o.f.key, 'quitar_override', o.tenantId + ': ' + o.value, 'plan'); UI.toast('Excepción eliminada.'); App.render(); } }); });
    b.querySelector('#ov-new').onclick = () => UI.modal({ title: 'Nueva excepción de funcionalidad', size: 'lg', body: UI.form([
      { id: 'ov-t', label: 'Tenant', type: 'select', options: DB.tenants.map(t => [t.id, t.id + ' · ' + t.name]), required: true, col: 6 }, { id: 'ov-f', label: 'Funcionalidad', type: 'select', options: DB.featureFlags.map(f => [f.key, f.label]), required: true, col: 6 },
      { id: 'ov-v', label: 'Valor', type: 'select', options: [['1', 'Habilitar'], ['0', 'Deshabilitar']], col: 4 }, { id: 'ov-u', label: 'Vigente hasta', type: 'date', value: addDays(TODAY(), 30), col: 4 }, { id: 'ov-r', label: 'Motivo', required: true, col: 12, placeholder: 'Ej. Piloto comercial aprobado / incumplimiento de términos' }
    ]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = UI.formData(m); const f = DB.featureFlags.find(y => y.key === d['ov-f']);
      if (d['ov-u'] && d['ov-u'] < TODAY()) { UI.toast('La vigencia debe ser futura.', 'bad'); return false; }
      if (d['ov-u'] && daysBetween(TODAY(), d['ov-u']) > 180) { UI.toast('Regla PLN-BR-03: una excepción no puede superar 180 días; use un cambio de plan o add-on.', 'bad'); return false; }
      f.overrides = f.overrides.filter(o => o.tenantId !== d['ov-t']);
      f.overrides.push({ tenantId: d['ov-t'], value: d['ov-v'] === '1', reason: d['ov-r'], until: d['ov-u'] || null, by: Auth.user.id, at: nowStr() });
      Store.save(); Audit.log('Feature flag', f.key, 'override', d['ov-t'] + ': plan', d['ov-t'] + ': ' + (d['ov-v'] === '1') + ' hasta ' + (d['ov-u'] || '∞'));
      UI.toast('Excepción registrada para ' + esc(d['ov-t']) + '.'); App.render();
    } }] });
  }

  function pfUsage(b) {
    const rows = DB.tenants.map(t => { const u = tenantUsage(t.id); const L = u.limits; const pct = (k) => L[k] ? (u[k] || 0) / L[k] * 100 : 0; const mx = Math.max(pct('users'), pct('storageGB'), pct('reservations'), pct('whatsapp'), pct('apiCalls')); return Object.assign({ t, mx }, u); });
    UI.dataTable(b, { rows, exportName: 'uso_por_tenant', search: (r) => r.t.name + ' ' + r.t.id, defaultSort: 'mx', defaultDir: -1,
      filters: [{ key: 'plan', label: 'Plan', options: PLAN_ORDER.map(p => [p, p]), match: (r, v) => r.t.plan === v }, { key: 'alert', label: 'Consumo', options: [['80', '≥ 80 % de algún límite']], match: (r) => r.mx >= 80 }],
      columns: [
        { key: 'name', label: 'Tenant', sortVal: r => r.t.name, render: r => '<b class="small">' + esc(r.t.name) + '</b><div class="xs faint">' + esc(r.t.id) + ' · ' + esc(r.t.plan) + ' · ' + B(r.t.status) + '</div>' },
        { key: 'users', label: 'Usuarios', align: 'num', render: r => fmtN(r.users, 0) + ' / ' + fmtQ(r.limits.users) },
        { key: 'storageGB', label: 'Almac. GB', align: 'num', render: r => fmtN(r.storageGB || 0, 1) + ' / ' + fmtQ(r.limits.storageGB) },
        { key: 'reservations', label: 'Reservas/mes', align: 'num', render: r => fmtN(r.reservations || 0, 0) },
        { key: 'whatsapp', label: 'WhatsApp/mes', align: 'num', render: r => fmtN(r.whatsapp || 0, 0) + ' / ' + fmtQ(r.limits.whatsapp) },
        { key: 'apiCalls', label: 'API/mes', align: 'num', render: r => r.limits.apiCalls ? fmtN((r.apiCalls || 0) / 1000, 1) + 'k' : '<span class="faint">sin API</span>' },
        { key: 'mx', label: 'Mayor consumo', align: 'num', render: r => '<b style="color:var(--' + (r.mx >= 100 ? 'bad' : r.mx >= 80 ? 'warn' : 'ok') + ')">' + fmtN(r.mx, 0) + ' %</b>' + UI.progress(r.mx, r.mx >= 100 ? 'bad' : r.mx >= 80 ? 'warn' : 'ok') }
      ],
      footer: () => '<tr><td colspan="7" class="xs faint">Solo contadores agregados (medición de uso para facturación y límites). Fuente: tabla platform usage_counters, consolidada diariamente desde Redis.</td></tr>' });
  }
})();
