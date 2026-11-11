/* Administración (PROC-001 a 003, 059, 062–065) + Reportes (PROC-060/061) */
(function () {
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr } = Util;
  const ic = UI.icon;

  /* ---------------- Estilos propios del módulo (solo variables de tema) ---------------- */
  if (!document.getElementById('css-admin')) {
    const st = document.createElement('style'); st.id = 'css-admin';
    st.textContent = [
      '.adm-log{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px;font-family:var(--f-mono);font-size:.75rem;line-height:1.65;max-height:340px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:var(--fg-2);margin:0}',
      '.adm-log .l-in{color:var(--info)}.adm-log .l-ok{color:var(--ok)}.adm-log .l-bad{color:var(--bad);font-weight:600}.adm-log .l-warn{color:var(--warn)}.adm-log .l-mute{color:var(--fg-3)}',
      '.plan-card{border:1px solid var(--line);border-radius:var(--r);padding:16px;background:var(--surface);display:flex;flex-direction:column;gap:10px}',
      '.plan-card.cur{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}',
      '.plan-card .price{font-family:var(--f-display);font-size:1.55rem;font-weight:600;line-height:1.1}',
      '.plan-card ul{margin:0;padding:0;list-style:none;display:grid;gap:5px;font-size:.82rem}',
      '.plan-card li{display:flex;gap:7px;align-items:flex-start}.plan-card li svg{width:14px;height:14px;color:var(--ok);flex:none;margin-top:3px}',
      '.ent-y{color:var(--ok)}.ent-n{color:var(--fg-3)}.ent-y svg,.ent-n svg{width:15px;height:15px;vertical-align:-3px}',
      '.perm-matrix{min-width:980px}.perm-matrix td,.perm-matrix th{padding:7px 8px}',
      '.perm-matrix th{white-space:normal;line-height:1.25;vertical-align:bottom;min-width:74px}',
      '.perm-matrix td:first-child,.perm-matrix th:first-child{position:sticky;left:0;background:var(--surface);z-index:2;min-width:230px;box-shadow:1px 0 0 var(--line-2)}',
      '.perm-matrix th:first-child{background:var(--surface-2);z-index:3}',
      '.perm-matrix tr.pm-g td{background:var(--surface-2);font-weight:600;font-size:.78rem}',
      '.perm-matrix input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}',
      '.perm-matrix input[disabled]{cursor:not-allowed;opacity:.55}',
      '.perm-matrix th.pm-sel,.perm-matrix td.pm-sel{background:var(--accent-soft)}',
      '.tpl-var{cursor:pointer;font-family:var(--f-mono)}.tpl-var:hover{border-color:var(--accent);color:var(--accent)}',
      '.tpl-prev{border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface-2);padding:14px 16px;font-size:.85rem;white-space:pre-wrap;line-height:1.55}',
      '.tpl-prev .sj{font-weight:600;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--line-2)}',
      '.adm-sw td{text-align:center}.adm-sw td:first-child{text-align:left}',
      '.wz-body{min-height:250px;padding-top:6px}',
      '.wz-ch{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed var(--line-2)}',
      '.rep-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.rep-filters .input{width:auto}',
      '.mini-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}',
      '.mini-kv>div{border:1px solid var(--line-2);border-radius:var(--r-sm);padding:9px 11px;background:var(--surface-2)}',
      '.mini-kv b{display:block;font-size:1.05rem;font-family:var(--f-display)}',
      '.adm-role-list .list-item{cursor:pointer;border-radius:var(--r-sm);padding-left:8px;padding-right:8px}',
      '.adm-role-list .list-item.on{background:var(--accent-soft)}',
      '.adm-page>*,.adm-page .tab-body>*,.adm-page .tab-body{min-width:0;max-width:100%}',
      '.am-y{color:var(--ok);font-weight:700}.am-n{color:var(--fg-3)}',
      '.am-matrix{min-width:1180px}.am-matrix td,.am-matrix th{padding:6px 7px}',
      '.am-matrix td:first-child,.am-matrix th:first-child{min-width:210px}',
      '.am-matrix th .tag{font-size:.62rem;padding:1px 6px;margin-top:4px;text-transform:none;letter-spacing:0}',
      '.am-matrix tr.am-g td{background:var(--surface-2);font-weight:600;font-size:.78rem}',
      '.am-sum td{vertical-align:top}.am-sum .am-cap{font-size:.78rem;line-height:1.45;min-width:260px}.am-sum .am-cap b{font-weight:600}',
      '.am-sum .am-scope{font-size:.78rem;min-width:200px}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- Constantes de plataforma ---------------- */
  const PLAN_RANK = { Starter: 1, Professional: 2, Enterprise: 3 };
  const PLAN_LIMITS = { Starter: { users: 5, storage: 5, sedes: 1, support: 'Correo, horario laboral' }, Professional: { users: 15, storage: 25, sedes: 2, support: 'Correo y chat, 12 h' }, Enterprise: { users: Infinity, storage: 100, sedes: Infinity, support: 'Dedicado 24/7 · SLA 99.9%' } };
  const FEATURES = [
    ['CRM, leads y Cliente 360', 1, 1, 1], ['Catálogo turístico y tarifas', 1, 1, 1], ['Cotizaciones versionadas', 1, 1, 1], ['Reservas y pasajeros', 1, 1, 1], ['Finanzas básicas (CxC y pagos)', 1, 1, 1], ['Portal del cliente', 1, 1, 1],
    ['Órdenes operativas y asignaciones', 0, 1, 1], ['Vouchers y rooming list', 0, 1, 1], ['Rentabilidad y comisiones', 0, 1, 1], ['Canal B2B agencias', 0, 'Básico', 'Completo'], ['Reportes y exportación', 0, 1, 1], ['Portal del pasajero', 0, 1, 1],
    ['Multi-sede', 0, 0, 1], ['E-commerce', 0, 0, 1], ['CMS web', 0, 0, 1], ['Apps móviles (operador y pasajero)', 0, 0, 1], ['Integraciones por adapters', 0, 0, 1], ['Auditoría avanzada y exportación de bitácora', 0, 0, 1]
  ];
  const CHANNELS = [
    { k: 'portalCliente', label: 'Portal del cliente', plan: 'Starter', desc: 'Cotizaciones, aprobación, pagos y documentos del cliente.' },
    { k: 'portalPasajero', label: 'Portal del pasajero', plan: 'Professional', desc: 'Itinerario, vouchers y contacto de emergencia.' },
    { k: 'b2b', label: 'Portal B2B agencias', plan: 'Professional', desc: 'Tarifas netas, crédito y reservas de agencias asociadas.' },
    { k: 'whatsapp', label: 'WhatsApp Business', plan: 'Professional', desc: 'Notificaciones y recordatorios por plantillas aprobadas.' },
    { k: 'web', label: 'Web pública (CMS)', plan: 'Enterprise', desc: 'Páginas, banners y contenidos publicados.' },
    { k: 'ecommerce', label: 'E-commerce', plan: 'Enterprise', desc: 'Venta en línea con pago y confirmación automática.' },
    { k: 'appOperador', label: 'App operador (guías y conductores)', plan: 'Enterprise', desc: 'Check-in, ejecución, incidencias y modo offline.' },
    { k: 'appPasajero', label: 'App pasajero', plan: 'Enterprise', desc: 'Itinerario móvil, notificaciones push y encuestas.' }
  ];
  const CRIT = ['login', 'asignar', 'aprobar', 'rechazar', 'cancelar', 'crear_desde_cotizacion', 'revertir', 'cambio_precio', 'descuento_override', 'emitir', 'otorgar_permiso', 'revocar_permiso', 'suspender', 'reactivar', 'alta', 'desactivar', 'resetear_mfa', 'exportar', 'acceso_denegado', 'cambio_plan', 'crear_rol', 'cambio_rol', 'facturar', 'exportar_denegado'];
  const isCrit = (a) => CRIT.includes(a);
  const TPL_VARS = ['{{cliente}}', '{{reserva}}', '{{cotizacion}}', '{{fecha_viaje}}', '{{monto}}', '{{servicio}}', '{{hora}}', '{{enlace}}', '{{agencia}}', '{{vendedor}}'];
  const SAMPLE = { '{{cliente}}': 'Gabriela Ríos Montoya', '{{reserva}}': 'RES-2026-000344', '{{cotizacion}}': 'COT-2026-00190', '{{fecha_viaje}}': '12 oct 2026', '{{monto}}': 'US$ 910.00', '{{servicio}}': 'Machu Picchu 2D/1N', '{{hora}}': '05:05', '{{enlace}}': 'https://andeshorizonte.kipucontrol.com/p/q7x9-a1b2', '{{agencia}}': 'Andes Horizonte Travel', '{{vendedor}}': 'Diego Fernández Luna' };

  /* ---------------- Inicialización perezosa de estructuras del módulo ---------------- */
  function ensure() {
    const s = DB.settings; let ch = false;
    if (!s.general) { s.general = { email: 'administracion@andeshorizonte.pe', phone: '01 640 2210', web: 'www.andeshorizonte.pe', address: 'Av. José Larco 1150, Of. 602, Miraflores, Lima', mainSede: 'SED-01', lang: 'es-PE', dateFmt: 'DD/MM/AAAA', legalRep: 'Mariela Quispe Rojas', mincetur: 'Registro MINCETUR N.° 0412-2025' }; ch = true; }
    if (!s.policies) { s.policies = { cancel: 'Sin penalidad hasta 15 días antes. 50% entre 14 y 7 días. 100% dentro de 7 días o no-show.', modify: 'Cambios de fecha sin costo hasta 10 días antes, sujetos a disponibilidad y diferencia tarifaria.', noshow: 'No-show se factura al 100%. No hay reembolso de entradas nominativas.', refund: 'Reembolsos en 7–15 días hábiles por el mismo medio de pago, descontando gastos bancarios.', maxDiscountPct: 5, advancePct: 40, balanceDaysBefore: 15, markupPct: 25 }; ch = true; }
    if (!s.ops) { s.ops = { voucherHoursBefore: 72, assignExpiryMin: 120, checkinToleranceMin: 15, modifyMinHours: 48, maxPaxPerGuide: 16, offlineSyncMin: 10, payReminderDays: 3, tripNoticeHours: 48, incidentEscalateMin: 30 }; ch = true; }
    if (!s.channels) { s.channels = { portalCliente: true, portalPasajero: true, b2b: true, whatsapp: true, web: true, ecommerce: true, appOperador: true, appPasajero: true }; ch = true; }
    if (!s.fxHistory) { s.fxHistory = [{ date: '2026-09-29', fx: s.fx, source: s.fxSource, user: 'U07' }, { date: '2026-09-28', fx: 3.752, source: s.fxSource, user: 'U07' }, { date: '2026-09-27', fx: 3.748, source: s.fxSource, user: 'U07' }, { date: '2026-09-26', fx: 3.741, source: s.fxSource, user: 'U07' }]; ch = true; }
    if (s.priceWithTax == null) { s.priceWithTax = true; s.roundMode = 'Al más cercano'; ch = true; }
    if (!s.notifications.some(n => n.event === 'Inicio/fin de servicio')) { s.notifications.push({ event: 'Inicio/fin de servicio', email: false, whatsapp: true, push: true, portal: true }, { event: 'Cierre de viaje', email: true, whatsapp: false, push: false, portal: true }); ch = true; }
    if (!s.notifRules) { s.notifRules = { 'Cotización enviada': 'Cliente', 'Cotización aprobada': 'Vendedor + Gerencia', 'Reserva confirmada': 'Cliente + Operaciones', 'Pago recibido': 'Cliente + Finanzas', 'Asignación': 'Guía / Conductor', 'Cambio de horario': 'Pasajeros + Guía', 'Incidencia crítica': 'Gerencia + Operaciones', 'Voucher emitido': 'Cliente + Proveedor', 'Inicio/fin de servicio': 'Pasajeros', 'Cierre de viaje': 'Cliente (encuesta NPS)' }; ch = true; }
    if (!s.templates) { s.templates = {}; ch = true; }
    if (!DB.jobLog) {
      DB.jobLog = [
        { id: 'ERR-0418', ts: '2026-09-29 06:00', source: 'Job', ref: 'JOB-07', target: 'Adapter tren (Ferrovía Sur Andina)', error: 'Timeout 30 s al consultar disponibilidad', cls: 'Transitorio', attempt: 3, max: 5, nextRetry: '2026-09-29 06:16', status: 'reintentando' },
        { id: 'ERR-0417', ts: '2026-09-28 18:00', source: 'Notificación', ref: 'NTF-9916', target: 'WhatsApp Business API (sandbox)', error: 'Número destino no registrado en sandbox (código 131026)', cls: 'Permanente', attempt: 3, max: 3, nextRetry: '—', status: 'fallo_definitivo' },
        { id: 'ERR-0416', ts: '2026-09-28 09:00', source: 'Job', ref: 'JOB-03', target: 'Recordatorios de pago', error: '1 envío WhatsApp fallido', cls: 'Permanente', attempt: 1, max: 1, nextRetry: '—', status: 'fallo_definitivo' },
        { id: 'ERR-0415', ts: '2026-09-27 14:12', source: 'Integración', ref: 'INT-03', target: 'Correo transaccional', error: 'SMTP 421 servicio temporalmente no disponible', cls: 'Transitorio', attempt: 2, max: 5, nextRetry: '—', status: 'resuelto' }
      ]; ch = true;
    }
    if (!DB.exports) { DB.exports = [{ id: 'EXP-0031', ts: '2026-09-28 07:00', report: 'Finanzas y rentabilidad', format: 'PDF', rows: 42, size: '184 KB', user: 'U02', status: 'disponible' }, { id: 'EXP-0030', ts: '2026-09-26 17:44', report: 'Reservas', format: 'XLSX', rows: 58, size: '36 KB', user: 'U07', status: 'disponible' }]; ch = true; }
    DB.tenants.forEach(t => { if (!t.adminEmail) { t.adminEmail = { 'TNT-0001': 'mquispe@andeshorizonte.pe', 'TNT-0002': 'gerencia@selvaviva.pe', 'TNT-0003': 'admin@costasurdmc.pe', 'TNT-0004': 'sistemas@altiplanocorp.pe', 'TNT-0005': 'contacto@rutanorte.pe', 'TNT-0006': 'admin@nevadostours.pe' }[t.id] || 'admin@tenant.pe'; t.subdomain = t.subdomain || t.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''); if (t.status === 'suspendido' && !t.suspendReason) t.suspendReason = 'Falta de pago: 2 facturas de suscripción vencidas (jul–ago 2026).'; ch = true; } });
    if (ch) Store.save();
  }

  /* ---------------- Helpers ---------------- */
  const page = (html) => '<div class="page adm-page">' + html + '</div>';
  const isSA = () => Auth.role === 'super_admin';
  /* El Super Admin SaaS solo ve la consola de plataforma: sus migas no apuntan a pantallas del tenant */
  const crumbsAdmin = (label) => isSA() ? [['Consola de plataforma', '#/admin/tenants'], [label]] : [['Inicio', '#/dashboard'], ['Administración', '#/admin/usuarios'], [label]];
  const PLATFORM_ENT = ['Tenant', 'Sesión', 'Job', 'Integración', 'Plan', 'Rol', 'Permiso', 'Exportación'];
  const platformEvent = (a) => PLATFORM_ENT.includes(a.entity) || /denegad/.test(a.action);
  const setHash = (h) => { try { history.replaceState(null, '', h); } catch (e) { } };
  const nextId = (arr, prefix, width) => { const n = Math.max(0, ...arr.map(x => parseInt(String(x.id).replace(/\D/g, ''), 10) || 0)) + 1; return prefix + String(n).padStart(width, '0'); };
  const uName = (id) => Q.user(id) ? Q.userName(id) : (id || 'Sistema');
  const yesNo = (v) => v === 0 || v === false ? '<span class="ent-n" title="No incluido">' + ic('x') + '</span>' : v === 1 || v === true ? '<span class="ent-y" title="Incluido">' + ic('check') + '</span>' : '<span class="small">' + esc(v) + '</span>';
  function denied(el, title, crumbs, perm) {
    el.innerHTML = page(UI.pageHeader({ title, crumbs }) + UI.alert('bad', '<b>403 · Acceso denegado.</b> Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <span class="mono">' + esc(perm) + '</span>. La autorización se valida en el backend en cada solicitud (PROC-062); el menú solo refleja lo que el rol puede ver.'));
  }
  const readonlyNote = (perm) => UI.alert('warn', 'Vista de solo lectura: su rol no tiene el permiso <span class="mono">' + esc(perm) + '</span> para modificar esta sección.');
  const storageGB = (t) => parseFloat(String(t.storage)) || 0;
  const ENTITY_LINK = { Lead: id => '#/crm/leads/' + id, 'Cotización': id => '#/cotizaciones/' + id, Reserva: id => /^RES-2026-0003/.test(id) ? '#/reservas/' + id : '', Incidencia: id => '#/operaciones/incidencias/' + id, Voucher: () => '#/operaciones/vouchers', Producto: id => '#/catalogo/productos/' + id, Tarifa: () => '#/catalogo/tarifas', Pago: () => '#/finanzas/pagos', Tenant: id => '#/admin/tenants/' + id, Usuario: id => '#/admin/usuarios/' + id, 'Sesión': id => '#/admin/usuarios/' + id, Rol: id => '#/admin/roles/' + id, Permiso: id => '#/admin/roles/' + id, 'Configuración': () => '#/admin/configuracion', Sede: () => '#/admin/usuarios/sedes', Job: () => '#/admin/integraciones/jobs', 'Integración': () => '#/admin/integraciones', 'Notificación': () => '#/admin/notificaciones/log', Plantilla: () => '#/admin/notificaciones/plantillas', 'Exportación': () => '#/reportes', Cliente: id => '#/crm/clientes/' + id, Oportunidad: id => '#/crm/oportunidades/' + id };
  const entHref = (ent, id) => (ENTITY_LINK[ent] && id ? ENTITY_LINK[ent](id) : '');
  const entLink = (ent, id) => { const h = entHref(ent, id); return h && Access.canRoute(h.replace(/^#\//, '')) ? '<a href="' + h + '" class="mono">' + esc(id) + '</a>' : '<span class="mono">' + esc(id || '—') + '</span>'; };

  /* =====================================================================
     ADMIN / TENANTS (Super Admin SaaS) — PROC-001, E2E-08
     ===================================================================== */
  App.register('admin/tenants', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Tenants y planes');
    if (!Auth.can('admin.tenant.manage')) return denied(el, 'Tenants y planes', crumbs, 'admin.tenant.manage');
    const T = DB.tenants;
    const act = T.filter(t => t.status === 'activo');
    const mrr = sum(act, 'mrr');
    const stor = sum(T, storageGB);
    const isSA = Auth.role === 'super_admin';

    el.innerHTML = page(
      UI.pageHeader({ title: isSA ? 'Consola de plataforma' : 'Tenants y planes', subtitle: (isSA ? 'Tenants y planes · ' : 'Consola de plataforma SaaS: ') + 'alta de tenants, planes, entitlements, suspensión y prueba de aislamiento multi-tenant (PROC-001, E2E-08).', crumbs,
        actions: (isSA ? '' : '<a class="btn" href="#/admin/auditoria">' + ic('shield') + 'Auditoría</a>') + '<button class="btn primary" id="tn-new">' + ic('plus') + 'Alta de tenant</button>' }) +
      (isSA ? UI.alert('info', '<b>Alcance del Super Admin SaaS:</b> administra tenants, planes, jobs, integraciones y auditoría de seguridad de la plataforma. Por aislamiento multi-tenant no accede a reservas, clientes, cotizaciones ni finanzas de las agencias; para soporte sobre datos de negocio se requiere una sesión delegada autorizada por el Tenant Admin.') + '<div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn sm" href="#/admin/integraciones">' + ic('plug') + 'Integraciones y jobs</a><a class="btn sm" href="#/admin/auditoria">' + ic('shield') + 'Auditoría de plataforma</a></div>' : UI.alert('info', 'Está viendo la consola de plataforma con el rol <b>' + esc(Q.roleName(Auth.role)) + '</b>. En producción esta consola es exclusiva del <b>Super Admin SaaS</b>; un Tenant Admin solo administra su propio tenant.')) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Tenants activos', value: act.length + ' <span class="small faint">/ ' + T.length + '</span>', sub: T.filter(t => t.status === 'prueba').length + ' en prueba · ' + T.filter(t => t.status === 'suspendido').length + ' suspendido(s)', tone: 'accent', icon: 'server' }) +
        UI.kpi({ label: 'Usuarios en plataforma', value: fmtN(sum(T, 'users'), 0), sub: 'promedio ' + fmtN(sum(T, 'users') / T.length, 1) + ' por tenant', tone: 'info', icon: 'users' }) +
        UI.kpi({ label: 'MRR (ingreso recurrente)', value: money(mrr, 'PEN', 0), sub: 'ARR ' + money(mrr * 12, 'PEN', 0), tone: 'ok', icon: 'trending' }) +
        UI.kpi({ label: 'Almacenamiento usado', value: fmtN(stor, 1) + ' GB', sub: 'de ' + fmtN(sum(T, t => PLAN_LIMITS[t.plan] ? PLAN_LIMITS[t.plan].storage : 0), 0) + ' GB contratados', tone: 'sun', icon: 'database' }) +
      '</div>' +
      '<div id="tn-table"></div>' +
      '<div class="upper" style="margin:4px 0 -6px">Planes y entitlements</div>' +
      '<div class="grid g3">' + DB.plans.map(p => planCard(p)).join('') + '</div>' +
      UI.card('Matriz comparativa de entitlements', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Módulo / capacidad</th>' + DB.plans.map(p => '<th class="center">' + esc(p.id) + '</th>').join('') + '</tr></thead><tbody>' +
        FEATURES.map(f => '<tr><td>' + esc(f[0]) + '</td>' + [1, 2, 3].map(i => '<td class="center">' + yesNo(f[i]) + '</td>').join('') + '</tr>').join('') +
        '<tr><td>Usuarios incluidos</td>' + DB.plans.map(p => '<td class="center small">' + (PLAN_LIMITS[p.id].users === Infinity ? 'Ilimitados' : PLAN_LIMITS[p.id].users) + '</td>').join('') + '</tr>' +
        '<tr><td>Sedes</td>' + DB.plans.map(p => '<td class="center small">' + (PLAN_LIMITS[p.id].sedes === Infinity ? 'Ilimitadas' : PLAN_LIMITS[p.id].sedes) + '</td>').join('') + '</tr>' +
        '<tr><td>Almacenamiento</td>' + DB.plans.map(p => '<td class="center small">' + PLAN_LIMITS[p.id].storage + ' GB</td>').join('') + '</tr>' +
        '<tr><td>Soporte</td>' + DB.plans.map(p => '<td class="center small">' + esc(PLAN_LIMITS[p.id].support) + '</td>').join('') + '</tr>' +
        '</tbody></table></div>', { tight: true, sub: 'El backend aplica los entitlements del plan en cada módulo; el frontend solo oculta lo no contratado.' }) +
      '<div class="grid g2">' +
        UI.card('Aislamiento multi-tenant', '<p class="small muted" style="margin-bottom:10px">Cada solicitud resuelve el tenant desde el token de sesión (nunca desde un parámetro del cliente). Toda consulta se filtra por <span class="mono">tenant_id</span> y la política del recurso verifica la pertenencia antes de responder.</p>' +
          UI.flow(['Credenciales', 'Token', 'Tenant', 'Rol', 'Permiso', 'Policy', 'Recurso'], 7) +
          '<div class="col" style="margin-top:12px;gap:8px"><button class="btn primary" id="iso-run" style="height:auto;min-height:34px;white-space:normal;text-align:left">' + ic('lock') + 'Intentar leer RES de TNT-0002 desde TNT-0001</button><button class="btn" id="iso-hdr">' + ic('zap') + 'Forzar cabecera X-Tenant-Id: TNT-0002</button><button class="btn ghost sm" id="iso-clr">Limpiar log</button></div>', { sub: 'Prueba simulada E2E-08' }) +
        UI.card('Log de API', '<pre class="adm-log" id="iso-log"><span class="l-mute"># Ejecute una prueba para ver la traza de la solicitud.\n# Sesión: ' + esc(Auth.user.email) + ' · tenant del token: ' + esc(DB.tenant.id) + '</span></pre>', { sub: 'Traza de la solicitud tal como la registra el API gateway' }) +
      '</div>'
    );

    UI.dataTable(el.querySelector('#tn-table'), {
      exportName: 'tenants',
      rows: () => DB.tenants,
      search: ['id', 'name', 'ruc', 'plan'],
      searchPlaceholder: 'Buscar tenant, RUC o plan…',
      filters: [{ key: 'plan', label: 'Plan', options: DB.plans.map(p => [p.id, p.id]) }, { key: 'status', label: 'Estado', options: ['activo', 'prueba', 'suspendido'] }],
      columns: [
        { key: 'id', label: 'Tenant', render: t => '<div class="cell-main">' + esc(t.name) + (t.id === DB.tenant.id && !isSA ? ' <span class="tag">sesión actual</span>' : '') + '</div><div class="cell-sub mono">' + esc(t.id) + ' · RUC ' + esc(t.ruc) + '</div>' },
        { key: 'plan', label: 'Plan', render: t => '<span class="tag">' + esc(t.plan) + '</span>' },
        { key: 'users', label: 'Usuarios', align: 'num', render: t => { const lim = PLAN_LIMITS[t.plan].users; return t.users + (lim === Infinity ? '' : ' <span class="faint">/ ' + lim + '</span>'); } },
        { key: 'modules', label: 'Módulos', align: 'num' },
        { key: 'storage', label: 'Almac.', align: 'num', sortVal: storageGB },
        { key: 'mrr', label: 'MRR', align: 'num', render: t => money(t.mrr, 'PEN', 0) },
        { key: 'createdAt', label: 'Alta', render: t => '<span class="nowrap">' + date(t.createdAt) + '</span>' },
        { key: 'status', label: 'Estado', render: t => UI.badge(t.status) },
        { key: '', label: '', sort: false, render: t => '<button class="btn xs" data-tn="' + t.id + '">Detalle</button>' }
      ],
      onRow: t => tenantDrawer(t.id),
      afterDraw: (c) => c.querySelectorAll('[data-tn]').forEach(b => b.onclick = () => tenantDrawer(b.dataset.tn)),
      footer: rows => '<tr><td colspan="2"><b>Total</b></td><td class="num"><b>' + sum(rows, 'users') + '</b></td><td></td><td class="num nowrap"><b>' + fmtN(sum(rows, storageGB), 1) + ' GB</b></td><td class="num nowrap"><b>' + money(sum(rows.filter(r => r.status === 'activo'), 'mrr'), 'PEN', 0) + '</b></td><td colspan="3"></td></tr>'
    });

    el.querySelector('#tn-new').onclick = () => tenantWizard();
    el.querySelectorAll('[data-plan-t]').forEach(b => b.onclick = () => { const s = el.querySelector('#tn-table select[data-f="0"]'); if (s) { s.value = b.dataset.planT; s.onchange(); el.querySelector('#tn-table').scrollIntoView({ behavior: 'smooth' }); } });
    const log = el.querySelector('#iso-log');
    const write = (lines) => { log.innerHTML += '\n' + lines.join('\n'); log.scrollTop = log.scrollHeight; };
    el.querySelector('#iso-clr').onclick = () => { log.innerHTML = '<span class="l-mute"># Log limpiado.</span>'; };
    el.querySelector('#iso-run').onclick = () => {
      const corr = 'c-' + Math.random().toString(16).slice(2, 7);
      write(['', '<span class="l-mute">[' + nowStr() + '] correlación ' + corr + '</span>',
        '<span class="l-in">→ GET /api/v1/reservations/RES-2026-000112</span>',
        '  Host: andeshorizonte.kipucontrol.com',
        '  Authorization: Bearer eyJhbGciOi…  (sub=' + esc(Auth.user.id) + ', tenant=' + DB.tenant.id + ')',
        '  AuthN ........ token válido, MFA ' + (Auth.user.mfa ? 'OK' : 'no requerido'),
        '  TenantResolver  tenant de la sesión = ' + DB.tenant.id,
        '  Query ........ SELECT … FROM reservations WHERE id = :id AND tenant_id = \'' + DB.tenant.id + '\'',
        '  Resultado .... 0 filas (RES-2026-000112 pertenece a TNT-0002)',
        '<span class="l-bad">← 404 Not Found</span>  {"error":"RESOURCE_NOT_FOUND","message":"Recurso inexistente en su tenant"}',
        '<span class="l-ok">✓ E2E-08 superado:</span> no se revela la existencia del recurso de otro tenant. Evento registrado en auditoría.']);
      Audit.log('Reserva', 'RES-2026-000112', 'acceso_denegado', 'solicitud desde ' + DB.tenant.id, '404 · recurso de TNT-0002 (' + corr + ')');
      UI.toast('Acceso bloqueado: 404 Not Found. Registrado en auditoría.', 'info');
    };
    el.querySelector('#iso-hdr').onclick = () => {
      const corr = 'c-' + Math.random().toString(16).slice(2, 7);
      write(['', '<span class="l-mute">[' + nowStr() + '] correlación ' + corr + '</span>',
        '<span class="l-in">→ GET /api/v1/tenants/TNT-0002/reservations?status=confirmada</span>',
        '  Authorization: Bearer eyJhbGciOi…  (tenant=' + DB.tenant.id + ')',
        '  X-Tenant-Id: TNT-0002   <span class="l-warn">(cabecera enviada por el cliente: ignorada)</span>',
        '  TenantResolver  tenant de la sesión = ' + DB.tenant.id + ' ≠ TNT-0002 de la ruta',
        '  Policy ....... TenantScopePolicy → DENY (cross-tenant)',
        '<span class="l-bad">← 403 Forbidden</span>  {"error":"TENANT_SCOPE_VIOLATION","corr":"' + corr + '"}',
        '<span class="l-ok">✓ E2E-08 superado:</span> el tenant nunca se toma de parámetros del cliente. Alerta de seguridad generada.']);
      Audit.log('Tenant', 'TNT-0002', 'acceso_denegado', 'solicitud desde ' + DB.tenant.id, '403 · TENANT_SCOPE_VIOLATION (' + corr + ')');
      UI.toast('Acceso bloqueado: 403 Forbidden. Registrado en auditoría.', 'info');
    };
    if (params[0]) { if (params[0] === 'nuevo') tenantWizard(); else if (DB.tenants.some(t => t.id === params[0])) tenantDrawer(params[0]); }
  });

  function planCard(p) {
    const n = DB.tenants.filter(t => t.plan === p.id && t.status !== 'suspendido').length;
    const lim = PLAN_LIMITS[p.id];
    const mine = p.id === DB.tenant.plan && !isSA();
    return '<div class="plan-card' + (mine ? ' cur' : '') + '"><div class="row between"><h3>' + esc(p.id) + '</h3>' + (mine ? UI.badge('activo', 'Plan de ' + DB.tenant.short) : '') + '</div>' +
      '<div><span class="price">' + money(p.price, 'PEN', 0) + '</span> <span class="small faint">/ mes + IGV</span></div>' +
      '<div class="small muted">' + (lim.users === Infinity ? 'Usuarios ilimitados' : 'Hasta ' + lim.users + ' usuarios') + ' · ' + lim.storage + ' GB · ' + (lim.sedes === Infinity ? 'sedes ilimitadas' : lim.sedes + ' sede(s)') + '</div>' +
      '<div class="divider"></div><ul>' + p.modules.map(m => '<li>' + ic('check') + '<span>' + esc(m) + '</span></li>').join('') + '</ul>' +
      '<div class="divider"></div><div class="row between small"><span class="muted">' + n + ' tenant(s) en este plan</span><button class="btn xs ghost" data-plan-t="' + esc(p.id) + '">Ver tenants</button></div></div>';
  }

  function tenantDrawer(id) {
    const t = DB.tenants.find(x => x.id === id); if (!t) return;
    const lim = PLAN_LIMITS[t.plan];
    const usePct = lim.users === Infinity ? 0 : t.users / lim.users * 100;
    const stPct = storageGB(t) / lim.storage * 100;
    const hist = DB.audit.filter(a => a.entity === 'Tenant' && a.entityId === t.id);
    const feats = FEATURES.filter(f => f[PLAN_RANK[t.plan]]).map(f => f[0]);
    const can = Auth.can('admin.tenant.manage');
    const actions = [];
    actions.push({ label: 'Cambiar plan', icon: 'layers', onClick: () => { changePlan(t); return false; } });
    if (t.status === 'suspendido') actions.push({ label: 'Reactivar tenant', icon: 'refresh', cls: 'primary', onClick: () => { toggleTenant(t, 'reactivar'); return false; } });
    else actions.push({ label: 'Suspender tenant', icon: 'lock', cls: 'danger', onClick: () => { toggleTenant(t, 'suspender'); return false; } });
    UI.drawer({ title: esc(t.name), sub: '<span class="mono">' + esc(t.id) + '</span> · ' + esc(t.subdomain || '') + '.kipucontrol.com', wide: true, actions: can ? actions : [],
      body: (t.status === 'suspendido' ? UI.alert('bad', '<b>Tenant suspendido.</b> Sus usuarios no pueden iniciar sesión; los datos se conservan íntegros. Motivo: ' + esc(t.suspendReason || '—')) : '') +
        '<div class="grid g2" style="margin-bottom:14px">' +
          '<div>' + UI.dl([['Razón social', esc(t.name)], ['RUC', '<span class="mono">' + esc(t.ruc) + '</span>'], ['País', esc(t.country)], ['Plan', '<span class="tag">' + esc(t.plan) + '</span>'], ['Estado', UI.badge(t.status)], ['Alta', date(t.createdAt)], ['Administrador', esc(t.adminEmail)], ['MRR', money(t.mrr, 'PEN', 0)]]) + '</div>' +
          '<div class="col"><div><div class="row between small"><span class="muted">Usuarios</span><b>' + t.users + (lim.users === Infinity ? ' (ilimitado)' : ' / ' + lim.users) + '</b></div>' + UI.progress(usePct, usePct > 90 ? 'bad' : usePct > 75 ? 'warn' : '') + '</div>' +
          '<div><div class="row between small"><span class="muted">Almacenamiento</span><b>' + esc(t.storage) + ' / ' + lim.storage + ' GB</b></div>' + UI.progress(stPct, stPct > 90 ? 'bad' : stPct > 75 ? 'warn' : '') + '</div>' +
          '<div><div class="row between small"><span class="muted">Módulos habilitados</span><b>' + t.modules + '</b></div></div>' +
          '<div class="xs faint">Aislamiento: esquema compartido con <span class="mono">tenant_id</span> obligatorio, cifrado en reposo y respaldos por tenant.</div></div>' +
        '</div>' +
        '<div class="upper" style="margin-bottom:8px">Entitlements del plan ' + esc(t.plan) + '</div><div class="chip-row" style="margin-bottom:16px">' + feats.map(f => '<span class="tag">' + esc(f) + '</span>').join('') + '</div>' +
        '<div class="upper" style="margin-bottom:8px">Historial de estado y auditoría</div>' +
        UI.timeline(hist.map(a => ({ title: esc(a.action.replace(/_/g, ' ')) + ' <span class="faint small">' + esc(a.before) + ' → ' + esc(a.after) + '</span>', meta: datetime(a.ts) + ' · ' + esc(uName(a.user)) + ' · ' + esc(a.corr), icon: a.action === 'suspender' ? 'lock' : a.action === 'acceso_denegado' ? 'shield' : 'history' })).concat([{ title: 'Alta de tenant', meta: date(t.createdAt) + ' · Plataforma', icon: 'plus' }])) +
        (can ? '' : readonlyNote('admin.tenant.manage'))
    });
  }

  function toggleTenant(t, mode) {
    if (mode === 'suspender' && t.id === DB.tenant.id) { UI.toast('Regla PROC-001: no se puede suspender el tenant de la sesión activa. Solicítelo desde otra cuenta de plataforma.', 'bad'); return; }
    UI.confirm({ title: mode === 'suspender' ? 'Suspender tenant' : 'Reactivar tenant', danger: mode === 'suspender', reason: true, reasonLabel: 'Motivo (queda en auditoría)',
      message: mode === 'suspender' ? 'Se bloqueará el acceso de los <b>' + t.users + ' usuarios</b> de <b>' + esc(t.name) + '</b>. Los datos no se eliminan y el tenant puede reactivarse.' : 'Se restablecerá el acceso de los usuarios de <b>' + esc(t.name) + '</b> con su plan ' + esc(t.plan) + '.',
      confirmLabel: mode === 'suspender' ? 'Suspender' : 'Reactivar',
      onConfirm: (r) => {
        const before = t.status;
        t.status = mode === 'suspender' ? 'suspendido' : 'activo';
        if (mode === 'suspender') t.suspendReason = r; else { t.suspendReason = ''; if (!t.mrr) t.mrr = (DB.plans.find(p => p.id === t.plan) || {}).price || 0; }
        Store.save();
        Audit.log('Tenant', t.id, mode, before, t.status + ' · ' + r);
        Notify.push('tenant.' + (mode === 'suspender' ? 'suspendido' : 'reactivado'), 'Email', t.adminEmail, (mode === 'suspender' ? 'Suspensión de servicio — ' : 'Servicio reactivado — ') + t.name);
        UI.toast('Tenant ' + esc(t.id) + (mode === 'suspender' ? ' suspendido.' : ' reactivado.'));
        App.render(); setTimeout(() => tenantDrawer(t.id), 0);
      } });
  }

  function changePlan(t) {
    UI.modal({ title: 'Cambiar plan — ' + esc(t.id), size: 'sm', body: UI.form([{ id: 'cp-plan', label: 'Nuevo plan', type: 'select', options: DB.plans.map(p => [p.id, p.id + ' · ' + money(p.price, 'PEN', 0) + '/mes']), value: t.plan, col: 12 }, { id: 'cp-eff', label: 'Vigencia', type: 'select', options: ['Inmediata (prorrateo)', 'Próximo ciclo de facturación'], col: 12 }]) + '<div id="cp-msg" style="margin-top:12px"></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Aplicar cambio', cls: 'primary', onClick: (m) => {
        const np = m.querySelector('#cp-plan').value; if (np === t.plan) { UI.toast('El tenant ya tiene ese plan.', 'info'); return false; }
        const lim = PLAN_LIMITS[np];
        if (t.users > lim.users) { m.querySelector('#cp-msg').innerHTML = UI.alert('bad', '<b>Plan/entitlements:</b> el tenant tiene ' + t.users + ' usuarios y el plan ' + esc(np) + ' permite ' + lim.users + '. Desactive usuarios antes del downgrade.'); return false; }
        if (storageGB(t) > lim.storage) { m.querySelector('#cp-msg').innerHTML = UI.alert('bad', '<b>Plan/entitlements:</b> el almacenamiento usado supera el límite del plan destino.'); return false; }
        const before = t.plan; t.plan = np; t.modules = np === 'Starter' ? 6 : np === 'Professional' ? 12 : 18; if (t.status === 'activo') t.mrr = DB.plans.find(p => p.id === np).price;
        if (t.id === DB.tenant.id) DB.tenant.plan = np;
        Store.save(); Audit.log('Tenant', t.id, 'cambio_plan', before, np + ' · ' + m.querySelector('#cp-eff').value);
        UI.toast('Plan actualizado a ' + esc(np) + '.'); App.render(); setTimeout(() => tenantDrawer(t.id), 0);
      } }] });
  }

  /* ---------- Asistente de alta de tenant (PROC-001) ---------- */
  function tenantWizard() {
    if (!Auth.can('admin.tenant.manage')) { UI.toast('Requiere permiso admin.tenant.manage.', 'bad'); return; }
    const STEPS = ['Crear tenant', 'Empresa / RUC', 'País, moneda y zona', 'Sede', 'Administrador', 'Roles', 'Permisos', 'Config. comercial', 'Config. financiera', 'Canales', 'Activar'];
    const w = { step: 0, d: { name: '', subdomain: '', plan: 'Professional', start: 'prueba', razon: '', ruc: '', fiscal: '', rubro: 'Operador turístico', rep: '', country: 'Perú', currency: 'PEN', alt: 'USD', tz: 'America/Lima', lang: 'es-PE', sede: '', sedeAddr: '', sedeCity: '', sedePhone: '', adminName: '', adminEmail: '', adminPhone: '', adminMfa: true, roles: ['tenant_admin', 'manager', 'sales', 'operations', 'finance'], tpl: 'Estándar KipuControl (recomendada)', validity: 10, markup: 25, maxDisc: 5, hold: 30, igv: 18, round: '0.10', fx: DB.settings.fx, fxSource: 'Manual diario (SBS referencial)', advance: 40, serF: 'F001-', serB: 'B001-', channels: { portalCliente: true } } };
    const tenantRoles = DB.roles.filter(r => r.id !== 'super_admin');
    const m = UI.modal({ title: 'Alta de tenant', sub: 'PROC-001 · Solicitud de alta → tenant operativo', size: 'lg', body: '<div id="wz-flow"></div><div class="divider" style="margin:10px 0 14px"></div><div class="wz-body" id="wz-body"></div><div class="row between" style="margin-top:18px;border-top:1px solid var(--line-2);padding-top:14px"><button class="btn" id="wz-prev">' + ic('chevronLeft') + 'Anterior</button><span class="small faint" id="wz-count"></span><button class="btn primary" id="wz-next">Siguiente' + ic('chevronRight') + '</button></div>' });
    const body = m.querySelector('#wz-body');
    const d = w.d;
    const stepFields = () => {
      switch (w.step) {
        case 0: return UI.form([{ type: 'section', label: '1. Crear tenant' }, { id: 'name', label: 'Nombre comercial', required: true, value: d.name, col: 6, placeholder: 'Ej. Inka Trails Operador' }, { id: 'subdomain', label: 'Subdominio', required: true, value: d.subdomain, col: 6, hint: 'Se publicará como <subdominio>.kipucontrol.com', placeholder: 'inkatrails' }, { id: 'plan', label: 'Plan contratado', type: 'select', options: DB.plans.map(p => [p.id, p.id + ' · ' + money(p.price, 'PEN', 0) + '/mes']), value: d.plan, col: 6 }, { id: 'start', label: 'Inicio', type: 'select', options: [['prueba', 'Periodo de prueba (14 días)'], ['activo', 'Activo (facturación inmediata)']], value: d.start, col: 6 }]) + '<div style="margin-top:12px">' + UI.alert('info', 'Se genera un <span class="mono">tenant_id</span> único e inmutable. Todas las tablas del tenant quedarán particionadas por ese identificador.') + '</div>';
        case 1: return UI.form([{ type: 'section', label: '2. Registrar empresa' }, { id: 'razon', label: 'Razón social', required: true, value: d.razon, col: 8 }, { id: 'ruc', label: 'RUC', required: true, value: d.ruc, col: 4, hint: '11 dígitos (10, 15, 17 o 20)' }, { id: 'fiscal', label: 'Domicilio fiscal', required: true, value: d.fiscal, col: 12 }, { id: 'rubro', label: 'Tipo de empresa', type: 'select', options: ['Agencia de viajes minorista', 'Agencia mayorista', 'Operador turístico', 'DMC / receptivo', 'Agencia corporativa'], value: d.rubro, col: 6 }, { id: 'rep', label: 'Representante legal', value: d.rep, col: 6 }]);
        case 2: return UI.form([{ type: 'section', label: '3. País, moneda y zona horaria' }, { id: 'country', label: 'País', type: 'select', options: ['Perú', 'Bolivia', 'Chile', 'Ecuador', 'Colombia'], value: d.country, col: 6 }, { id: 'lang', label: 'Idioma', type: 'select', options: [['es-PE', 'Español (Perú)'], ['es-419', 'Español (Latinoamérica)'], ['en-US', 'Inglés']], value: d.lang, col: 6 }, { id: 'currency', label: 'Moneda base', type: 'select', options: [['PEN', 'PEN — Sol'], ['USD', 'USD — Dólar'], ['BOB', 'BOB — Boliviano'], ['CLP', 'CLP — Peso chileno']], value: d.currency, col: 4 }, { id: 'alt', label: 'Moneda alterna', type: 'select', options: [['USD', 'USD'], ['PEN', 'PEN'], ['EUR', 'EUR']], value: d.alt, col: 4 }, { id: 'tz', label: 'Zona horaria', type: 'select', options: ['America/Lima', 'America/La_Paz', 'America/Santiago', 'America/Guayaquil', 'America/Bogota'], value: d.tz, col: 4 }]) + '<p class="xs faint" style="margin-top:10px">La moneda base no podrá cambiarse una vez registradas transacciones (integridad contable).</p>';
        case 3: return UI.form([{ type: 'section', label: '4. Sede principal' }, { id: 'sede', label: 'Nombre de la sede', required: true, value: d.sede, col: 6, placeholder: 'Lima — San Isidro' }, { id: 'sedeCity', label: 'Ciudad', required: true, value: d.sedeCity, col: 6 }, { id: 'sedeAddr', label: 'Dirección', required: true, value: d.sedeAddr, col: 8 }, { id: 'sedePhone', label: 'Teléfono', value: d.sedePhone, col: 4 }]) + (d.plan === 'Starter' ? '<p class="xs faint" style="margin-top:10px">El plan Starter incluye 1 sede. Multi-sede requiere Enterprise.</p>' : '');
        case 4: return UI.form([{ type: 'section', label: '5. Administrador del tenant' }, { id: 'adminName', label: 'Nombre completo', required: true, value: d.adminName, col: 6 }, { id: 'adminEmail', label: 'Correo', type: 'email', required: true, value: d.adminEmail, col: 6 }, { id: 'adminPhone', label: 'Teléfono', value: d.adminPhone, col: 6 }, { id: 'adminMfa', label: 'MFA obligatorio en el primer acceso', type: 'switch', value: d.adminMfa, col: 6 }]) + '<div style="margin-top:12px">' + UI.alert('info', 'Se enviará una invitación con enlace de activación de un solo uso (válido 72 h). La contraseña nunca viaja por correo.') + '</div>';
        case 5: return '<div class="section-title" style="margin-bottom:10px">6. Roles iniciales</div><p class="small muted" style="margin-bottom:10px">Seleccione los roles base que se crearán en el tenant. Podrá crear roles personalizados después.</p><div class="grid g2" style="gap:8px">' + tenantRoles.map(r => '<label class="check" style="align-items:flex-start;border:1px solid var(--line-2);border-radius:8px;padding:9px 10px"><input type="checkbox" name="role_' + r.id + '"' + (d.roles.includes(r.id) ? ' checked' : '') + (r.id === 'tenant_admin' ? ' disabled' : '') + '><span><b>' + esc(r.name) + '</b><br><span class="xs faint">' + esc(r.desc) + ' · ' + esc(r.scope) + '</span></span></label>').join('') + '</div>';
        case 6: return '<div class="section-title" style="margin-bottom:10px">7. Permisos</div>' + UI.form([{ id: 'tpl', label: 'Plantilla de permisos', type: 'select', options: ['Estándar KipuControl (recomendada)', 'Mínimo privilegio', 'Copiar de tenant ' + DB.tenant.id], value: d.tpl, col: 12 }]) +
          '<div id="wz-perm"></div><p class="xs faint" style="margin-top:8px">Los permisos se podrán ajustar en Roles y permisos una vez activado el tenant.</p>';
        case 7: return UI.form([{ type: 'section', label: '8. Configuración comercial' }, { id: 'validity', label: 'Validez de cotización (días)', type: 'number', min: 1, value: d.validity, col: 6, required: true }, { id: 'hold', label: 'Minutos de hold de disponibilidad', type: 'number', min: 5, value: d.hold, col: 6, required: true }, { id: 'markup', label: 'Markup por defecto (%)', type: 'number', step: '0.5', value: d.markup, col: 6 }, { id: 'maxDisc', label: 'Descuento máx. sin aprobación (%)', type: 'number', step: '0.5', value: d.maxDisc, col: 6 }]);
        case 8: return UI.form([{ type: 'section', label: '9. Configuración financiera' }, { id: 'igv', label: 'IGV (%)', type: 'number', value: d.igv, col: 4, required: true }, { id: 'round', label: 'Redondeo', type: 'select', options: [['0.01', 'Al céntimo (0.01)'], ['0.10', 'A 0.10'], ['1', 'A la unidad']], value: d.round, col: 4 }, { id: 'advance', label: 'Anticipo por defecto (%)', type: 'number', value: d.advance, col: 4 }, { id: 'fx', label: 'Tipo de cambio inicial', type: 'number', step: '0.001', value: d.fx, col: 4, required: true }, { id: 'fxSource', label: 'Fuente del tipo de cambio', type: 'select', options: ['Manual diario (SBS referencial)', 'Automático SBS (integración por definir)'], value: d.fxSource, col: 8 }, { id: 'serF', label: 'Serie de facturas', value: d.serF, col: 6 }, { id: 'serB', label: 'Serie de boletas', value: d.serB, col: 6 }]);
        case 9: return '<div class="section-title" style="margin-bottom:6px">10. Canales</div><p class="small muted" style="margin-bottom:6px">Los canales no incluidos en el plan <b>' + esc(d.plan) + '</b> aparecen bloqueados (entitlements).</p>' + CHANNELS.map(c => { const ok = PLAN_RANK[d.plan] >= PLAN_RANK[c.plan]; return '<div class="wz-ch"><label class="switch"><input type="checkbox" name="ch_' + c.k + '"' + (ok && d.channels[c.k] ? ' checked' : '') + (ok ? '' : ' disabled') + ' aria-label="' + esc(c.label) + '"></label><div class="grow"><b class="small">' + esc(c.label) + '</b> ' + (ok ? '' : '<span class="tag">Requiere ' + esc(c.plan) + '</span>') + '<div class="xs faint">' + esc(c.desc) + '</div></div></div>'; }).join('');
        case 10: {
          const chk = [['Datos obligatorios de empresa y RUC', true], ['Moneda, impuestos y zona horaria', true], ['Sede principal', !!d.sede], ['Administrador con invitación', !!d.adminEmail], ['Roles y permisos desde plantilla', d.roles.length > 0], ['Entitlements del plan ' + d.plan + ' aplicados', true], ['Aislamiento: tenant_id asignado y políticas de alcance', true], ['Registro de auditoría del alta', true]];
          return '<div class="section-title" style="margin-bottom:10px">11. Revisión y activación</div><div class="grid g2"><div>' + UI.dl([['Tenant', esc(d.name)], ['Razón social', esc(d.razon)], ['RUC', '<span class="mono">' + esc(d.ruc) + '</span>'], ['Plan', esc(d.plan) + ' · ' + (d.start === 'prueba' ? 'prueba 14 días' : 'activo')], ['Moneda / TZ', esc(d.currency + ' / ' + d.alt + ' · ' + d.tz)], ['Sede', esc(d.sede)], ['Administrador', esc(d.adminName) + '<br><span class="xs faint">' + esc(d.adminEmail) + '</span>'], ['Roles', d.roles.length], ['Canales', esc(CHANNELS.filter(c => d.channels[c.k]).map(c => c.label).join(', ') || '—')]]) + '</div><div class="col" style="gap:6px">' + chk.map(c => '<div class="row small" style="gap:8px;flex-wrap:nowrap"><span class="' + (c[1] ? 'ok' : 'bad') + '">' + ic(c[1] ? 'checkCircle' : 'alert') + '</span>' + esc(c[0]) + '</div>').join('') + '</div></div>';
        }
      }
      return '';
    };
    const permTable = () => { const box = body.querySelector('#wz-perm'); if (!box) return; const tpl = body.querySelector('#tpl').value; box.innerHTML = '<div class="tbl-wrap" style="margin-top:12px"><table class="tbl compact"><thead><tr><th>Rol</th><th class="num">Permisos</th><th>Módulos con acceso</th></tr></thead><tbody>' + d.roles.map(rid => { const ps = templatePerms(rid, tpl); const mods = DB.permissionGroups.filter(g => g.perms.some(p => ps.includes(p))).map(g => g.module); return '<tr><td>' + esc(Q.roleName(rid)) + '</td><td class="num">' + ps.length + '</td><td class="small">' + esc(mods.join(', ') || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>'; };
    const draw = () => {
      m.querySelector('#wz-flow').innerHTML = UI.flow(STEPS, w.step);
      body.innerHTML = stepFields();
      if (w.step === 6) { permTable(); body.querySelector('#tpl').onchange = permTable; }
      m.querySelector('#wz-count').textContent = 'Paso ' + (w.step + 1) + ' de ' + STEPS.length;
      m.querySelector('#wz-prev').disabled = w.step === 0;
      m.querySelector('#wz-next').innerHTML = w.step === STEPS.length - 1 ? ic('checkCircle') + 'Activar tenant' : 'Siguiente' + ic('chevronRight');
      const fl = m.querySelector('.flow'), cur = m.querySelector('.flow-step.cur'); if (fl && cur) fl.scrollLeft = Math.max(0, cur.offsetLeft - fl.clientWidth / 2);
    };
    const collect = () => {
      const fd = UI.formData(body);
      if (w.step === 5) { d.roles = ['tenant_admin'].concat(tenantRoles.filter(r => r.id !== 'tenant_admin' && fd['role_' + r.id]).map(r => r.id)); return true; }
      if (w.step === 9) { CHANNELS.forEach(c => { d.channels[c.k] = !!fd['ch_' + c.k]; }); return true; }
      if (!UI.validate(body)) return false;
      const err = (id, msg) => { const i = body.querySelector('#' + id); if (i) { i.classList.add('err'); i.parentElement.insertAdjacentHTML('beforeend', '<div class="errmsg">' + esc(msg) + '</div>'); } UI.toast(esc(msg), 'bad'); return false; };
      if (w.step === 0) {
        fd.subdomain = String(fd.subdomain).toLowerCase();
        if (!/^[a-z0-9-]{3,30}$/.test(fd.subdomain)) return err('subdomain', 'Subdominio inválido: 3–30 caracteres, solo minúsculas, números y guion.');
        if (DB.tenants.some(t => t.subdomain === fd.subdomain)) return err('subdomain', 'El subdominio ya está en uso por otro tenant.');
      }
      if (w.step === 1) {
        if (!/^(10|15|17|20)\d{9}$/.test(fd.ruc)) return err('ruc', 'RUC inválido: debe tener 11 dígitos e iniciar con 10, 15, 17 o 20.');
        if (DB.tenants.some(t => t.ruc === fd.ruc)) return err('ruc', 'Ya existe un tenant con ese RUC (datos obligatorios únicos).');
      }
      if (w.step === 4 && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(fd.adminEmail)) return err('adminEmail', 'Correo del administrador inválido.');
      if (w.step === 7 && Number(fd.maxDisc) > 30) return err('maxDisc', 'El descuento máximo sin aprobación no puede superar 30%.');
      if (w.step === 8 && !(Number(fd.fx) > 0)) return err('fx', 'Tipo de cambio inválido.');
      Object.assign(d, fd);
      return true;
    };
    m.querySelector('#wz-prev').onclick = () => { if (w.step > 0) { w.step--; draw(); } };
    m.querySelector('#wz-next').onclick = () => {
      if (!collect()) return;
      if (w.step < STEPS.length - 1) { w.step++; draw(); return; }
      const id = nextId(DB.tenants, 'TNT-', 4);
      const plan = DB.plans.find(p => p.id === d.plan);
      const t = { id, name: d.razon || d.name, ruc: d.ruc, country: d.country, plan: d.plan, users: 1, status: d.start, createdAt: window.TODAY, modules: d.plan === 'Starter' ? 6 : d.plan === 'Professional' ? 12 : 18, storage: '0.0 GB', mrr: d.start === 'activo' ? plan.price : 0, adminEmail: d.adminEmail, subdomain: d.subdomain, commercialName: d.name, currency: d.currency, tz: d.tz, sede: d.sede, channels: Object.keys(d.channels).filter(k => d.channels[k]), roles: d.roles.slice() };
      DB.tenants.push(t); Store.save();
      Audit.log('Tenant', id, 'alta', '', (d.start === 'activo' ? 'activo' : 'prueba') + ' · plan ' + d.plan + ' · ' + d.roles.length + ' roles');
      Notify.push('tenant.activado', 'Email', d.adminEmail, 'Bienvenido a KipuControl — active su cuenta de administrador');
      UI.closeModal(); UI.toast('Tenant ' + esc(id) + ' creado y operativo.');
      App.render(); setTimeout(() => tenantDrawer(id), 0);
    };
    draw();
  }
  function templatePerms(rid, tpl) {
    const base = DB.rolePerms[rid] || [];
    if (String(tpl).startsWith('Mínimo')) return rid === 'tenant_admin' ? base.slice() : base.filter(p => /\.view$|\.receivables$|manage_availability|\.create$/.test(p));
    return base.slice();
  }

  /* =====================================================================
     ADMIN / USUARIOS Y SEDES — PROC-002
     ===================================================================== */
  App.register('admin/usuarios', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Usuarios y sedes');
    if (!Auth.can('admin.users.manage')) return denied(el, 'Usuarios y sedes', crumbs, 'admin.users.manage');
    const U = DB.users;
    const ext = (u) => ['customer', 'passenger', 'b2b', 'provider'].includes(u.role);
    el.innerHTML = page(
      UI.pageHeader({ title: 'Usuarios y sedes', subtitle: 'Identidades del tenant ' + esc(DB.tenant.short) + ': rol, sede, estado, MFA y último acceso. Las bajas son lógicas: el historial se conserva (PROC-002).', crumbs,
        actions: '<a class="btn" href="#/admin/roles">' + ic('key') + 'Roles y permisos</a><button class="btn primary" id="us-new">' + ic('plus') + 'Invitar usuario</button>' }) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Usuarios activos', value: U.filter(u => u.status === 'activo').length, sub: U.filter(u => u.status === 'activo' && !ext(u)).length + ' internos · ' + U.filter(u => u.status === 'activo' && ext(u)).length + ' de canal', tone: 'accent', icon: 'users' }) +
        UI.kpi({ label: 'Sin MFA', value: U.filter(u => u.status === 'activo' && !u.mfa).length, sub: 'Recomendado para roles internos', tone: 'warn', icon: 'lock' }) +
        UI.kpi({ label: 'Invitaciones pendientes', value: U.filter(u => u.status === 'pendiente').length, sub: 'Enlace válido 72 h', tone: 'info', icon: 'mail' }) +
        UI.kpi({ label: 'Sedes activas', value: DB.sedes.filter(s => s.status === 'activa').length + ' <span class="small faint">/ ' + DB.sedes.length + '</span>', sub: 'Plan ' + esc(DB.tenant.plan), tone: 'sun', icon: 'building' }) +
      '</div>' +
      UI.card('Ciclo de vida de la identidad', UI.flow(['Solicitud', 'Identidad', 'Tenant / Sede', 'Rol', 'Permisos', 'Activación', 'Uso', 'Auditoría', 'Baja lógica'], 7), { sub: 'PROC-002 · El frontend nunca sustituye la autorización backend' }) +
      '<div id="us-tabs"></div>'
    );
    el.querySelector('#us-new').onclick = () => userForm();
    UI.tabs(el.querySelector('#us-tabs'), [
      { id: 'usuarios', label: 'Usuarios', count: U.length, render: (b) => usersTable(b) },
      { id: 'sedes', label: 'Sedes', count: DB.sedes.length, render: (b) => sedesTab(b) }
    ], params[0] === 'sedes' ? 'sedes' : 'usuarios', { onChange: (id) => setHash('#/admin/usuarios' + (id === 'sedes' ? '/sedes' : '')) });
    if (params[0] && params[0] !== 'sedes' && Q.user(params[0])) userDrawer(params[0]);
  });

  function usersTable(b) {
    UI.dataTable(b, {
      exportName: 'usuarios',
      rows: () => DB.users,
      search: u => u.name + ' ' + u.email + ' ' + u.id + ' ' + Q.roleName(u.role),
      searchPlaceholder: 'Buscar nombre, correo o rol…',
      filters: [
        { key: 'role', label: 'Rol', options: DB.roles.map(r => [r.id, r.name]) },
        { key: 'sede', label: 'Sede', options: DB.sedes.map(s => [s.id, s.name]) },
        { key: 'status', label: 'Estado', options: [['activo', 'Activo'], ['inactivo', 'Inactivo'], ['pendiente', 'Invitación pendiente']] },
        { key: 'mfa', label: 'MFA', options: [['1', 'Habilitado'], ['0', 'No habilitado']], match: (u, v) => (u.mfa ? '1' : '0') === v }
      ],
      columns: [
        { key: 'name', label: 'Usuario', render: u => '<div class="row" style="gap:9px;flex-wrap:nowrap">' + UI.avatar(u) + '<div style="min-width:0"><div class="cell-main">' + esc(u.name) + (Auth.user.id === u.id ? ' <span class="tag">usted</span>' : '') + '</div><div class="cell-sub">' + esc(u.email) + '</div></div></div>' },
        { key: 'role', label: 'Rol', render: u => esc(Q.roleName(u.role)), sortVal: u => Q.roleName(u.role) },
        { key: 'sede', label: 'Sede', render: u => '<span class="small">' + esc(Q.sedeName(u.sede)) + '</span>' },
        { key: 'status', label: 'Estado', render: u => u.status === 'pendiente' ? UI.badge('pendiente', 'Invitación enviada') : UI.badge(u.status) },
        { key: 'mfa', label: 'MFA', render: u => u.mfa ? UI.badge('activo', 'Habilitado') : UI.badge('mute', 'No') },
        { key: 'lastLogin', label: 'Último acceso', render: u => '<span class="small nowrap">' + (u.lastLogin ? datetime(u.lastLogin) : '—') + '</span>' },
        { key: '', label: '', sort: false, render: u => '<button class="btn xs ghost icon" data-um="' + u.id + '" aria-label="Acciones">' + ic('more') + '</button>' }
      ],
      onRow: u => userDrawer(u.id),
      afterDraw: (c) => c.querySelectorAll('[data-um]').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); userMenu(btn, Q.user(btn.dataset.um)); })
    });
  }
  function userMenu(anchor, u) {
    UI.menu(anchor, [
      { label: 'Ver detalle', icon: 'eye', onClick: () => userDrawer(u.id) },
      { label: 'Editar rol y sede', icon: 'edit', onClick: () => userForm(u) },
      { label: u.status === 'activo' ? 'Desactivar (baja lógica)' : 'Activar', icon: u.status === 'activo' ? 'lock' : 'check', onClick: () => toggleUser(u) },
      { label: 'Resetear MFA', icon: 'key', onClick: () => resetMfa(u) },
      u.status === 'pendiente' ? { label: 'Reenviar invitación', icon: 'send', onClick: () => { Notify.push('usuario.invitado', 'Email', u.email, 'Invitación a ' + DB.tenant.short + ' (reenvío)'); Audit.log('Usuario', u.id, 'reenviar_invitacion', '', u.email); UI.toast('Invitación reenviada a ' + esc(u.email) + '.'); } } : { label: 'Ver actividad en auditoría', icon: 'shield', onClick: () => App.go('#/admin/auditoria') }
    ]);
  }
  function userDrawer(id) {
    const u = Q.user(id); if (!u) return;
    const perms = DB.rolePerms[u.role] || [];
    const acts = DB.audit.filter(a => a.user === u.id || a.entityId === u.id).slice(0, 8);
    UI.drawer({ title: esc(u.name), sub: esc(u.email) + ' · <span class="mono">' + u.id + '</span>',
      body: '<div class="row" style="margin-bottom:14px">' + UI.avatar(u, 'lg') + '<div class="grow"><div class="row" style="gap:6px">' + (u.status === 'pendiente' ? UI.badge('pendiente', 'Invitación enviada') : UI.badge(u.status)) + (u.mfa ? UI.badge('activo', 'MFA') : UI.badge('mute', 'Sin MFA')) + '</div><div class="small muted" style="margin-top:4px">' + esc(Q.roleName(u.role)) + ' · ' + esc(Q.sedeName(u.sede)) + '</div></div></div>' +
        UI.dl([['Rol', '<a href="#/admin/roles/' + esc(u.role) + '">' + esc(Q.roleName(u.role)) + '</a>'], ['Sede', esc(Q.sedeName(u.sede))], ['Tenant', esc(DB.tenant.name) + ' <span class="mono xs">' + DB.tenant.id + '</span>'], ['Teléfono', esc(u.phone || '—')], ['Último acceso', u.lastLogin ? datetime(u.lastLogin) : '—'], ['MFA', u.mfa ? 'Habilitado (TOTP)' : u.mfaRequired ? 'Pendiente de enrolamiento' : 'No habilitado'], u.deactivatedAt ? ['Baja lógica', datetime(u.deactivatedAt) + ' · ' + esc(u.deactivatedReason || '')] : null]) +
        '<div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:8px">Permisos efectivos del rol (' + perms.length + ')</div><div class="chip-row">' + (perms.length ? perms.map(p => '<span class="tag mono">' + esc(p) + '</span>').join('') : '<span class="small faint">Sin permisos</span>') + '</div>' +
        '<div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:8px">Actividad reciente</div>' + UI.timeline(acts.map(a => ({ title: esc(a.entity) + ' · ' + esc(a.action.replace(/_/g, ' ')), meta: datetime(a.ts) + ' · ' + esc(a.entityId) + ' · IP ' + esc(a.ip), icon: isCrit(a.action) ? 'shield' : 'history' }))),
      actions: [
        { label: 'Editar', icon: 'edit', onClick: () => { userForm(u); } },
        { label: 'Resetear MFA', icon: 'key', onClick: () => { resetMfa(u); } },
        { label: u.status === 'activo' ? 'Desactivar' : 'Activar', icon: u.status === 'activo' ? 'lock' : 'check', cls: u.status === 'activo' ? 'danger' : 'primary', onClick: () => { toggleUser(u); } }
      ] });
  }
  function userForm(u) {
    const isNew = !u;
    const roleOpts = DB.roles.filter(r => r.id !== 'super_admin' || Auth.role === 'super_admin').map(r => [r.id, r.name]);
    UI.modal({ title: isNew ? 'Invitar usuario' : 'Editar usuario — ' + esc(u.name), sub: isNew ? 'Se enviará una invitación con enlace de activación de un solo uso.' : 'Los cambios de rol o sede se registran en auditoría.', body:
      UI.form([
        { id: 'uf-name', label: 'Nombre completo', required: true, value: u ? u.name : '', col: 6 },
        { id: 'uf-email', label: 'Correo', type: 'email', required: true, value: u ? u.email : '', col: 6, disabled: !isNew },
        { id: 'uf-role', label: 'Rol', type: 'select', options: roleOpts, value: u ? u.role : 'sales', col: 6, required: true },
        { id: 'uf-sede', label: 'Sede', type: 'select', options: DB.sedes.filter(s => s.status === 'activa' || (u && u.sede === s.id)).map(s => [s.id, s.name]), value: u ? u.sede : 'SED-01', col: 6, required: true },
        { id: 'uf-phone', label: 'Teléfono', value: u ? u.phone : '', col: 6 },
        isNew ? { id: 'uf-mfa', label: 'Exigir MFA en el primer acceso', type: 'switch', value: true, col: 6 } : { type: 'html', col: 6, html: '' }
      ]) + '<div id="uf-msg" style="margin-top:12px"></div>',
      actions: [{ label: 'Cancelar' }, { label: isNew ? 'Enviar invitación' : 'Guardar cambios', cls: 'primary', icon: isNew ? 'send' : 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        if (isNew) {
          if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(f['uf-email'])) { UI.toast('Correo inválido.', 'bad'); return false; }
          if (DB.users.some(x => x.email.toLowerCase() === f['uf-email'].toLowerCase())) { m.querySelector('#uf-msg').innerHTML = UI.alert('bad', 'Ya existe una identidad con ese correo en el tenant. Reactive el usuario existente en lugar de duplicarlo.'); return false; }
          const lim = PLAN_LIMITS[DB.tenant.plan].users;
          if (DB.users.filter(x => x.status !== 'inactivo').length >= lim) { m.querySelector('#uf-msg').innerHTML = UI.alert('bad', '<b>Plan/entitlements:</b> se alcanzó el límite de usuarios del plan ' + esc(DB.tenant.plan) + '.'); return false; }
          const id = nextId(DB.users, 'U', 2);
          const colors = ['#1560B8', '#6A4FB3', '#D99A00', '#2F6FB5', '#1E8A55'];
          const nu = { id, name: f['uf-name'], email: f['uf-email'], role: f['uf-role'], sede: f['uf-sede'], status: 'pendiente', lastLogin: '', mfa: false, mfaRequired: !!f['uf-mfa'], phone: f['uf-phone'], color: colors[DB.users.length % colors.length], invitedAt: nowStr(), invitedBy: Auth.user.id };
          DB.users.push(nu); const t0 = DB.tenants.find(t => t.id === DB.tenant.id); if (t0) t0.users++;
          Store.save();
          Audit.log('Usuario', id, 'crear', '', 'invitado · ' + Q.roleName(nu.role) + ' · ' + Q.sedeName(nu.sede));
          Notify.push('usuario.invitado', 'Email', nu.email, 'Invitación a ' + DB.tenant.short + ' — active su cuenta');
          UI.toast('Invitación enviada a ' + esc(nu.email) + '.');
        } else {
          const before = Q.roleName(u.role) + ' / ' + Q.sedeName(u.sede);
          if (u.id === Auth.user.id && f['uf-role'] !== u.role) { m.querySelector('#uf-msg').innerHTML = UI.alert('bad', 'No puede cambiar su propio rol: evita escalamiento o pérdida accidental de privilegios. Pida a otro administrador.'); return false; }
          if (u.role === 'tenant_admin' && f['uf-role'] !== 'tenant_admin' && DB.users.filter(x => x.role === 'tenant_admin' && x.status === 'activo').length <= 1) { m.querySelector('#uf-msg').innerHTML = UI.alert('bad', 'El tenant debe conservar al menos un Tenant Admin activo.'); return false; }
          const roleChanged = f['uf-role'] !== u.role;
          u.name = f['uf-name']; u.role = f['uf-role']; u.sede = f['uf-sede']; u.phone = f['uf-phone'];
          Store.save();
          Audit.log('Usuario', u.id, roleChanged ? 'cambio_rol' : 'editar', before, Q.roleName(u.role) + ' / ' + Q.sedeName(u.sede));
          UI.toast('Usuario actualizado.' + (roleChanged ? ' Las sesiones activas se revalidan con el nuevo rol.' : ''));
        }
        App.render();
      } }] });
  }
  function toggleUser(u) {
    if (u.id === Auth.user.id) { UI.toast('No puede desactivar su propia cuenta.', 'bad'); return; }
    if (u.status === 'activo' || u.status === 'pendiente') {
      if (u.role === 'tenant_admin' && DB.users.filter(x => x.role === 'tenant_admin' && x.status === 'activo').length <= 1) { UI.toast('El tenant debe conservar al menos un Tenant Admin activo.', 'bad'); return; }
      const open = DB.opportunities.filter(o => o.owner === u.id && !['ganada', 'perdida'].includes(o.stage)).length + DB.activities.filter(a => a.owner === u.id && a.status !== 'completada').length;
      UI.confirm({ title: 'Desactivar usuario', danger: true, reason: true, reasonLabel: 'Motivo de la baja', confirmLabel: 'Desactivar',
        message: 'Se revocarán las sesiones de <b>' + esc(u.name) + '</b> y no podrá iniciar sesión. <b>No se elimina</b>: su historial, auditoría y registros asociados se conservan.' + (open ? '<br><br><span class="warn">Tiene ' + open + ' oportunidad(es)/actividad(es) abiertas: reasígnelas en <a href="#/crm/oportunidades">CRM</a>.</span>' : ''),
        onConfirm: (r) => { const b = u.status; u.status = 'inactivo'; u.deactivatedAt = nowStr(); u.deactivatedReason = r; Store.save(); Audit.log('Usuario', u.id, 'desactivar', b, 'inactivo · ' + r); UI.toast('Usuario desactivado (baja lógica).'); App.render(); } });
    } else {
      UI.confirm({ title: 'Activar usuario', message: 'Se restablecerá el acceso de <b>' + esc(u.name) + '</b> con el rol ' + esc(Q.roleName(u.role)) + '.', confirmLabel: 'Activar',
        onConfirm: () => { const b = u.status; u.status = 'activo'; u.deactivatedAt = null; Store.save(); Audit.log('Usuario', u.id, 'activar', b, 'activo'); UI.toast('Usuario activado.'); App.render(); } });
    }
  }
  function resetMfa(u) {
    UI.confirm({ title: 'Resetear MFA', message: 'Se eliminará el segundo factor de <b>' + esc(u.name) + '</b>. En su próximo acceso deberá enrolar un nuevo dispositivo.', confirmLabel: 'Resetear MFA', danger: true, reason: true, reasonLabel: 'Motivo (p. ej. cambio de celular)',
      onConfirm: (r) => { const b = u.mfa ? 'habilitado' : 'no habilitado'; u.mfa = false; u.mfaRequired = true; Store.save(); Audit.log('Usuario', u.id, 'resetear_mfa', b, 'pendiente de enrolamiento · ' + r); Notify.push('seguridad.mfa_reset', 'Email', u.email, 'Su segundo factor fue restablecido'); UI.toast('MFA reseteado. Se notificó al usuario.'); App.render(); } });
  }

  function sedesTab(b) {
    const can = Auth.can('admin.users.manage');
    b.innerHTML = '<div id="sd-tbl"></div>';
    UI.dataTable(b.querySelector('#sd-tbl'), {
      exportName: 'sedes', rows: () => DB.sedes, search: ['id', 'name', 'address'], searchPlaceholder: 'Buscar sede…',
      toolbar: can ? '<button class="btn sm primary" id="sd-new">' + ic('plus') + 'Nueva sede</button>' : '',
      columns: [
        { key: 'name', label: 'Sede', render: s => '<div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub mono">' + esc(s.id) + '</div>' },
        { key: 'address', label: 'Dirección', render: s => '<span class="small">' + esc(s.address) + '</span>' },
        { key: 'phone', label: 'Teléfono' },
        { key: 'manager', label: 'Responsable', render: s => s.manager ? UI.userChip(s.manager) : '—' },
        { key: 'users', label: 'Usuarios', align: 'num', sortVal: s => DB.users.filter(u => u.sede === s.id).length, render: s => DB.users.filter(u => u.sede === s.id && u.status === 'activo').length },
        { key: 'res', label: 'Reservas', align: 'num', sortVal: s => DB.reservations.filter(r => r.sede === s.id).length, render: s => DB.reservations.filter(r => r.sede === s.id).length },
        { key: 'status', label: 'Estado', render: s => UI.badge(s.status) },
        { key: '', label: '', sort: false, render: s => can ? '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-se="' + s.id + '">Editar</button><button class="btn xs ghost" data-st="' + s.id + '">' + (s.status === 'activa' ? 'Desactivar' : 'Activar') + '</button><button class="btn xs ghost icon" data-sx="' + s.id + '" aria-label="Eliminar">' + ic('trash') + '</button></span>' : '' }
      ],
      afterDraw: (c) => {
        c.querySelectorAll('[data-se]').forEach(x => x.onclick = () => sedeForm(DB.sedes.find(s => s.id === x.dataset.se)));
        c.querySelectorAll('[data-st]').forEach(x => x.onclick = () => toggleSede(DB.sedes.find(s => s.id === x.dataset.st)));
        c.querySelectorAll('[data-sx]').forEach(x => x.onclick = () => deleteSede(DB.sedes.find(s => s.id === x.dataset.sx)));
      }
    });
    const nb = b.querySelector('#sd-new'); if (nb) nb.onclick = () => sedeForm();
    b.insertAdjacentHTML('beforeend', '<p class="xs faint" style="margin-top:10px">Las sedes con usuarios o transacciones no se eliminan: se desactivan para conservar la trazabilidad. Plan ' + esc(DB.tenant.plan) + ': ' + (PLAN_LIMITS[DB.tenant.plan].sedes === Infinity ? 'sedes ilimitadas' : PLAN_LIMITS[DB.tenant.plan].sedes + ' sede(s)') + '.</p>');
  }
  function sedeForm(s) {
    const isNew = !s;
    UI.modal({ title: isNew ? 'Nueva sede' : 'Editar sede — ' + esc(s.name), body: UI.form([
      { id: 'sf-name', label: 'Nombre', required: true, value: s ? s.name : '', col: 6, placeholder: 'Puno — Centro' },
      { id: 'sf-phone', label: 'Teléfono', value: s ? s.phone : '', col: 6 },
      { id: 'sf-address', label: 'Dirección', required: true, value: s ? s.address : '', col: 12 },
      { id: 'sf-manager', label: 'Responsable', type: 'select', options: DB.users.filter(u => u.status === 'activo' && ['tenant_admin', 'manager', 'sales', 'operations', 'finance'].includes(u.role)).map(u => [u.id, u.name]), value: s ? s.manager : Auth.user.id, col: 12 }
    ]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false;
      const f = UI.formData(m);
      if (DB.sedes.some(x => x.name.toLowerCase() === f['sf-name'].toLowerCase() && x !== s)) { UI.toast('Ya existe una sede con ese nombre.', 'bad'); return false; }
      if (isNew) {
        const lim = PLAN_LIMITS[DB.tenant.plan].sedes;
        if (DB.sedes.filter(x => x.status === 'activa').length >= lim) { UI.toast('Plan/entitlements: el plan ' + esc(DB.tenant.plan) + ' no permite más sedes.', 'bad'); return false; }
        const id = nextId(DB.sedes, 'SED-', 2);
        DB.sedes.push({ id, name: f['sf-name'], address: f['sf-address'], phone: f['sf-phone'], manager: f['sf-manager'], status: 'activa' });
        Store.save(); Audit.log('Sede', id, 'crear', '', f['sf-name']); UI.toast('Sede creada.');
      } else {
        const before = s.name + ' · ' + s.address;
        Object.assign(s, { name: f['sf-name'], address: f['sf-address'], phone: f['sf-phone'], manager: f['sf-manager'] });
        Store.save(); Audit.log('Sede', s.id, 'editar', before, s.name + ' · ' + s.address); UI.toast('Sede actualizada.');
      }
      App.go('#/admin/usuarios/sedes');
    } }] });
  }
  function toggleSede(s) {
    if (s.status === 'activa') {
      const users = DB.users.filter(u => u.sede === s.id && u.status === 'activo').length;
      if (users) { UI.toast('No se puede desactivar ' + esc(s.name) + ': tiene ' + users + ' usuario(s) activo(s). Reasígnelos primero.', 'bad'); return; }
      if (DB.sedes.filter(x => x.status === 'activa').length <= 1) { UI.toast('El tenant requiere al menos una sede activa.', 'bad'); return; }
    }
    const b = s.status; s.status = s.status === 'activa' ? 'inactiva' : 'activa'; Store.save(); Audit.log('Sede', s.id, s.status === 'activa' ? 'activar' : 'desactivar', b, s.status); UI.toast('Sede ' + (s.status === 'activa' ? 'activada.' : 'desactivada.')); App.go('#/admin/usuarios/sedes');
  }
  function deleteSede(s) {
    const refs = DB.users.filter(u => u.sede === s.id).length + DB.reservations.filter(r => r.sede === s.id).length;
    if (refs) { UI.toast('No se puede eliminar ' + esc(s.name) + ': tiene ' + refs + ' registro(s) asociados (usuarios o reservas). Desactívela para conservar el historial.', 'bad'); return; }
    UI.confirm({ title: 'Eliminar sede', danger: true, message: 'La sede <b>' + esc(s.name) + '</b> no tiene registros asociados y se eliminará.', confirmLabel: 'Eliminar', onConfirm: () => { DB.sedes.splice(DB.sedes.indexOf(s), 1); Store.save(); Audit.log('Sede', s.id, 'eliminar', s.name, ''); UI.toast('Sede eliminada.'); App.go('#/admin/usuarios/sedes'); } });
  }

  /* =====================================================================
     ADMIN / ROLES Y MATRIZ DE PERMISOS — PROC-002 / PROC-062
     ===================================================================== */
  let roleSel = 'sales';
  let roleMod = '';
  let roleView = 'perm';
  const AM = { mod: '', kind: '' };
  /* ---------- Mapa de acceso (Rol × Pantalla) — se calcula con Access.checkFor sobre DB.rolePerms vivo ---------- */
  const EXT_SCREENS = { group: 'Portales y apps externas', items: [
    { r: 'canales/b2b/portal/catalogo', label: 'Portal de agencias B2B' },
    { r: 'canales/portal-cliente/CLI-0001/inicio', label: 'Portal del cliente (autoservicio)' },
    { r: 'canales/portal-pasajero/viajes', label: 'Portal del pasajero' },
    { r: 'proveedor/solicitudes', label: 'Extranet de proveedores' }
  ] };
  const screenGroups = () => App.NAV.map(g => ({ group: g.group, items: g.items.map(i => ({ r: i.r, label: i.label })) })).concat([EXT_SCREENS]);
  const UX_LABEL = { backoffice: 'Back-office', portal: 'Portal', mobile: 'App' };
  const uxOf = (rid) => { const u = Access.ROLE_UX[rid] || { layout: 'backoffice' }; return { kind: rid === 'super_admin' ? 'Plataforma' : UX_LABEL[u.layout] || 'Back-office', label: u.label || (u.layout === 'backoffice' ? 'Back-office interno' : '') }; };
  const CAP = {
    'admin.tenant.manage': 'tenants y planes de la plataforma', 'admin.users.manage': 'usuarios y sedes', 'admin.roles.manage': 'roles y permisos', 'admin.settings.manage': 'configuración, notificaciones e integraciones', 'admin.audit.view': 'consultar auditoría',
    'crm.leads.view': 'ver leads', 'crm.leads.manage': 'gestionar leads', 'crm.opportunities.manage': 'oportunidades', 'crm.activities.manage': 'actividades', 'crm.clients.manage': 'clientes 360 y postventa',
    'catalog.products.view': 'consultar oferta', 'catalog.products.create': 'crear productos', 'catalog.products.update': 'editar productos', 'catalog.products.activate': 'activar / inactivar', 'catalog.products.manage_rates': 'tarifas y temporadas', 'catalog.products.manage_availability': 'salidas, cupos y holds', 'catalog.products.view_profitability': 'ver costos y márgenes', 'catalog.products.publish': 'publicar en canales', 'catalog.providers.manage': 'gestionar proveedores y servicios',
    'quotes.view': 'consultar', 'quotes.create': 'crear', 'quotes.approve_internal': 'aprobar internamente', 'quotes.send': 'enviar al cliente', 'quotes.discount_override': 'autorizar descuentos',
    'reservations.view': 'consultar', 'reservations.create': 'crear', 'reservations.modify': 'modificar', 'reservations.cancel': 'cancelar',
    'operations.view': 'consultar', 'operations.assign': 'asignar recursos', 'operations.vouchers': 'emitir vouchers', 'operations.incidents': 'registrar incidencias', 'operations.close': 'cerrar servicios',
    'finance.receivables': 'cuentas por cobrar', 'finance.payments.register': 'registrar pagos', 'finance.payments.revert': 'revertir pagos', 'finance.payables': 'cuentas por pagar', 'finance.commissions': 'comisiones', 'finance.profitability': 'rentabilidad', 'finance.invoicing': 'facturación electrónica',
    'channels.b2b.manage': 'canal B2B', 'channels.ecommerce.manage': 'e-commerce', 'channels.cms.publish': 'CMS',
    'reports.view': 'consultar reportes', 'reports.export': 'exportar y programar'
  };
  const KEY_DENY = [['quotes.approve_internal', 'aprobar cotizaciones / descuentos'], ['catalog.products.view_profitability', 'ver márgenes y utilidad'], ['catalog.products.update', 'editar el catálogo'], ['finance.payments.register', 'registrar pagos'], ['finance.invoicing', 'emitir comprobantes'], ['reservations.cancel', 'anular reservas'], ['admin.users.manage', 'administrar usuarios'], ['reports.export', 'exportar reportes']];
  const SCOPE_TXT = {
    super_admin: 'Plataforma: todos los tenants (planes, estado, jobs, integraciones y auditoría de seguridad). Sin acceso a datos comerciales de las agencias.',
    tenant_admin: 'Todo el tenant.', manager: 'Todo el equipo; filtros por asesor y sede.',
    sales: 'Su cartera: leads, oportunidades, cotizaciones y reservas propias.',
    operations: 'Reservas en ejecución y proveedores del tenant; ve costos, no márgenes.',
    finance: 'Información financiera de todo el tenant.', accounting: 'Comprobantes, cobros y pagos del tenant (lectura de pagos).',
    guide: 'Solo sus servicios asignados.', driver: 'Solo sus traslados asignados.',
    b2b: 'Solo su agencia: sus reservas, tarifas netas y estado de cuenta.', customer: 'Solo sus cotizaciones, viajes, documentos y pagos.',
    passenger: 'Solo su viaje: itinerario, vouchers y alertas.', provider: 'Solo sus solicitudes, rooming lists, vouchers y pagos.'
  };
  const scopeOf = (r) => SCOPE_TXT[r.id] || (r.scope === 'tenant' ? 'Según permisos, sobre todo el tenant.' : 'Solo registros vinculados a su cuenta.');
  function capsOf(rid) {
    const ps = DB.rolePerms[rid] || [];
    const out = DB.permissionGroups.map(g => { const has = g.perms.filter(p => ps.includes(p)); if (!has.length) return ''; return '<b>' + esc(g.module) + ':</b> ' + (has.length === g.perms.length ? 'completo' : has.map(p => esc(CAP[p] || p)).join(', ')); }).filter(Boolean);
    return out.length ? out.join('<br>') : '<span class="faint">Sin permisos asignados</span>';
  }
  function denyOf(r) {
    if (r.id === 'super_admin') return 'Operar reservas, clientes, cotizaciones o finanzas de un tenant.';
    if (r.scope !== 'tenant') return 'Back-office interno, costos, márgenes y datos de otros clientes.';
    const ps = DB.rolePerms[r.id] || [];
    const d = KEY_DENY.filter(k => !ps.includes(k[0])).map(k => k[1]);
    return d.length ? d.join(', ') + '.' : '—';
  }
  function accessMap(root) {
    const roles = DB.roles.filter(r => !AM.kind || (AM.kind === 'bo' ? ['Back-office', 'Plataforma'].includes(uxOf(r.id).kind) : !['Back-office', 'Plataforma'].includes(uxOf(r.id).kind)));
    const groups = screenGroups().filter(g => !AM.mod || g.group === AM.mod);
    const all = screenGroups().flatMap(g => g.items);
    const cnt = (rid) => all.filter(i => Access.checkFor(rid, i.r)).length;
    root.innerHTML = UI.alert('info', 'El mapa se calcula con la misma regla que aplica el router (<span class="mono">Access.checkFor</span>): permiso requerido por pantalla + experiencia del rol. Al cambiar un permiso en la matriz, el mapa se recalcula al instante. Los usuarios externos no ven el back-office: solo su portal o app.') +
      '<div class="card" style="margin-top:14px"><div class="card-h"><div><div class="t">Mapa de acceso · Rol × Pantalla</div><div class="s">' + all.length + ' pantallas · ' + roles.length + ' roles · ✓ puede abrir · — sin acceso (403)</div></div><div class="row" style="gap:6px"><select class="input sm" id="am-mod" style="width:auto" aria-label="Módulo"><option value="">Todos los módulos</option>' + screenGroups().map(g => '<option' + (AM.mod === g.group ? ' selected' : '') + '>' + esc(g.group) + '</option>').join('') + '</select><select class="input sm" id="am-kind" style="width:auto" aria-label="Tipo de rol"><option value="">Todos los roles</option><option value="bo"' + (AM.kind === 'bo' ? ' selected' : '') + '>Back-office</option><option value="ext"' + (AM.kind === 'ext' ? ' selected' : '') + '>Portales y apps</option></select></div></div>' +
      '<div class="tbl-wrap" style="max-height:640px"><table class="tbl compact perm-matrix am-matrix"><thead><tr><th>Pantalla</th>' + roles.map(r => { const u = uxOf(r.id); return '<th class="center' + (r.id === roleSel ? ' pm-sel' : '') + '" title="' + esc(r.desc) + '">' + esc(r.name) + '<div><span class="tag">' + esc(u.kind) + '</span></div><div class="xs faint" style="text-transform:none;letter-spacing:0;font-weight:500">' + cnt(r.id) + ' pant.</div></th>'; }).join('') + '</tr></thead><tbody>' +
      groups.map(g => '<tr class="am-g"><td>' + esc(g.group) + '</td>' + roles.map(r => { const n = g.items.filter(i => Access.checkFor(r.id, i.r)).length; return '<td class="center xs' + (r.id === roleSel ? ' pm-sel' : '') + '">' + (n ? n + '/' + g.items.length : '<span class="am-n">—</span>') + '</td>'; }).join('') + '</tr>' +
        g.items.map(i => '<tr><td><div class="small">' + esc(i.label) + '</div><div class="xs faint mono">#/' + esc(i.r) + '</div></td>' + roles.map(r => { const ok = Access.checkFor(r.id, i.r); return '<td class="center' + (r.id === roleSel ? ' pm-sel' : '') + '">' + (ok ? '<span class="am-y" title="' + esc(r.name) + ' puede abrir ' + esc(i.label) + '">✓</span>' : '<span class="am-n" title="Sin acceso">—</span>') + '</td>'; }).join('') + '</tr>').join('')).join('') +
      '</tbody></table></div></div>' +
      UI.card('Resumen por rol', '<div class="tbl-wrap"><table class="tbl compact am-sum"><thead><tr><th>Rol</th><th>Experiencia</th><th>Inicio</th><th class="num">Pantallas</th><th>Qué puede hacer</th><th>No puede</th><th>Alcance de datos</th></tr></thead><tbody>' +
        roles.map(r => { const u = uxOf(r.id); const ux = Access.ux(r.id); const nUsers = DB.users.filter(x => x.role === r.id && x.status === 'activo').length; return '<tr' + (r.id === roleSel ? ' style="background:var(--accent-soft)"' : '') + '><td><div class="small" style="font-weight:600">' + esc(r.name) + '</div><div class="xs faint">' + nUsers + ' usuario(s) activo(s)</div></td><td class="small"><span class="tag">' + esc(u.kind) + '</span><div class="xs faint" style="margin-top:3px">' + esc(u.label) + '</div></td><td class="mono xs">' + esc(String(ux.home || '#/dashboard').replace(/CLI-\d+/, '{cliente}')) + '</td><td class="num">' + cnt(r.id) + ' / ' + all.length + '</td><td class="am-cap">' + capsOf(r.id) + '</td><td class="am-cap">' + esc(denyOf(r)) + '</td><td class="am-scope">' + esc(scopeOf(r)) + '</td></tr>'; }).join('') +
        '</tbody></table></div>', { tight: true, sub: 'Derivado en vivo de DB.rolePerms y de la experiencia por rol (Access.ROLE_UX)' });
    root.querySelector('#am-mod').onchange = (e) => { AM.mod = e.target.value; accessMap(root); };
    root.querySelector('#am-kind').onchange = (e) => { AM.kind = e.target.value; accessMap(root); };
  }
  App.register('admin/roles', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Roles y permisos');
    if (!Auth.canAny(['admin.roles.manage', 'admin.users.manage'])) return denied(el, 'Roles y permisos', crumbs, 'admin.roles.manage');
    const canEdit = Auth.can('admin.roles.manage');
    if (params[0] && Q.role(params[0])) { roleSel = params[0]; roleView = 'perm'; }
    if (params[0] === 'mapa') roleView = 'map';
    if (!Q.role(roleSel)) roleSel = 'sales';
    const allPerms = DB.permissionGroups.flatMap(g => g.perms);
    el.innerHTML = page(
      UI.pageHeader({ title: 'Roles y permisos', subtitle: 'Roles del tenant y matriz de permisos por módulo. Cada cambio se audita y aplica en la próxima solicitud del usuario.', crumbs,
        actions: '<a class="btn" href="#/admin/usuarios">' + ic('users') + 'Usuarios</a>' + (canEdit ? '<button class="btn primary" id="rl-new">' + ic('plus') + 'Crear rol personalizado</button>' : '') }) +
      UI.alert('info', '<b>El frontend nunca sustituye la autorización backend.</b> Esta matriz define la política; cada endpoint valida token → tenant → rol → permiso → policy del recurso (PROC-062). Ocultar un botón no concede ni retira acceso.') +
      (canEdit ? '' : readonlyNote('admin.roles.manage')) +
      '<div class="tabs" role="tablist" id="rv-tabs"><button class="tab" role="tab" data-rv="perm">Roles y permisos</button><button class="tab" role="tab" data-rv="map">Mapa de acceso</button></div>' +
      '<div id="rv-map"></div><div id="rv-perm" class="stack" style="gap:var(--gap,16px);display:grid">' +
      '<div class="grid g-1-2">' +
        UI.card('Roles', '<div class="list adm-role-list" id="rl-list"></div>', { tight: true, sub: DB.roles.length + ' roles · ' + allPerms.length + ' permisos' }) +
        '<div id="rl-detail"></div>' +
      '</div>' +
      UI.card('Matriz de permisos', '<div class="row" style="margin-bottom:10px"><select class="input sm" id="pm-mod" style="width:auto" aria-label="Módulo"><option value="">Todos los módulos</option>' + DB.permissionGroups.map(g => '<option' + (roleMod === g.module ? ' selected' : '') + '>' + esc(g.module) + '</option>').join('') + '</select><span class="xs faint grow">Clic en el contador de un módulo para marcar o desmarcar todo el módulo para ese rol.</span></div><div class="tbl-wrap" style="max-height:620px"><table class="tbl compact perm-matrix" id="pm"></table></div>', { sub: 'Módulo × permiso × rol (DB.rolePerms)' }) +
      UI.card('Auditoría de cambios de permisos', '<div id="pm-audit"></div>', { tight: true, actions: '<a class="btn sm ghost" href="#/admin/auditoria">Bitácora completa ' + ic('arrowRight') + '</a>' }) +
      '</div>'
    );
    const drawMap = () => { if (roleView === 'map') accessMap(el.querySelector('#rv-map')); };
    const showView = (v) => {
      roleView = v;
      el.querySelectorAll('[data-rv]').forEach(b => b.classList.toggle('on', b.dataset.rv === v));
      el.querySelector('#rv-perm').style.display = v === 'perm' ? 'grid' : 'none';
      el.querySelector('#rv-map').style.display = v === 'map' ? '' : 'none';
      if (v === 'map') drawMap();
    };
    el.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => { showView(b.dataset.rv); setHash('#/admin/roles/' + (b.dataset.rv === 'map' ? 'mapa' : roleSel)); });

    const drawList = () => {
      el.querySelector('#rl-list').innerHTML = DB.roles.map(r => { const n = DB.users.filter(u => u.role === r.id && u.status === 'activo').length; return '<div class="list-item' + (r.id === roleSel ? ' on' : '') + '" data-role="' + r.id + '"><div class="ico-box ' + (r.scope === 'plataforma' ? 'violet' : r.scope === 'tenant' ? '' : r.scope === 'mobile' ? 'sun' : 'info') + '">' + ic(r.scope === 'plataforma' ? 'server' : r.scope === 'mobile' ? 'phone' : r.scope === 'canal' ? 'globe' : 'key') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:600">' + esc(r.name) + (r.custom ? ' <span class="tag">personalizado</span>' : '') + '</div><div class="xs faint">' + esc(r.desc) + '</div></div><div class="right xs faint nowrap">' + (DB.rolePerms[r.id] || []).length + ' perm.<br>' + n + ' usuario(s)</div></div>'; }).join('');
      el.querySelectorAll('[data-role]').forEach(x => x.onclick = () => { roleSel = x.dataset.role; setHash('#/admin/roles/' + roleSel); drawList(); drawDetail(); drawMatrix(); drawMap(); UI.reveal(el.querySelector('#rl-detail')); });
    };
    const drawDetail = () => {
      const r = Q.role(roleSel); const ps = DB.rolePerms[r.id] || [];
      const users = DB.users.filter(u => u.role === r.id);
      el.querySelector('#rl-detail').innerHTML = UI.card(esc(r.name), '<div class="grid g2"><div>' + UI.dl([['Identificador', '<span class="mono">' + esc(r.id) + '</span>'], ['Alcance', esc(r.scope)], ['Descripción', esc(r.desc)], ['Tipo', r.custom ? 'Personalizado' : 'Base del sistema'], ['Permisos', ps.length + ' de ' + allPerms.length]]) +
        '<div class="upper" style="margin:14px 0 8px">Experiencia y acceso</div><div class="small"><span class="tag">' + esc(uxOf(r.id).kind) + '</span> ' + esc(uxOf(r.id).label) + ' · <b>' + screenGroups().flatMap(g => g.items).filter(i => Access.checkFor(r.id, i.r)).length + '</b> de ' + screenGroups().flatMap(g => g.items).length + ' pantallas · <a href="javascript:void(0)" id="rl-map">Ver mapa de acceso</a></div><div class="xs faint" style="margin-top:4px">' + esc(scopeOf(r)) + '</div>' +
        '<div class="upper" style="margin:14px 0 8px">Usuarios con este rol</div>' + (users.length ? '<div class="col" style="gap:6px">' + users.slice(0, 6).map(u => '<a href="#/admin/usuarios/' + u.id + '" style="color:inherit">' + UI.userChip(u.id) + '</a>').join('') + (users.length > 6 ? '<span class="xs faint">y ' + (users.length - 6) + ' más</span>' : '') + '</div>' : '<span class="small faint">Ningún usuario asignado</span>') + '</div>' +
        '<div>' + UI.chart.hbars({ items: DB.permissionGroups.map(g => ({ label: g.module, value: g.perms.filter(p => ps.includes(p)).length, display: g.perms.filter(p => ps.includes(p)).length + ' / ' + g.perms.length })) }) + '</div></div>',
        { sub: 'Detalle del rol seleccionado', actions: canEdit ? '<button class="btn sm" id="rl-dup">' + ic('copy') + 'Duplicar</button>' + (r.custom ? '<button class="btn sm" id="rl-edit">' + ic('edit') + 'Editar</button><button class="btn sm danger" id="rl-del">' + ic('trash') + 'Eliminar</button>' : '') : '' });
      const q = (s) => el.querySelector(s);
      if (q('#rl-map')) q('#rl-map').onclick = () => { showView('map'); setHash('#/admin/roles/mapa'); };
      if (q('#rl-dup')) q('#rl-dup').onclick = () => roleForm(null, r.id);
      if (q('#rl-edit')) q('#rl-edit').onclick = () => roleForm(r);
      if (q('#rl-del')) q('#rl-del').onclick = () => {
        if (users.length) { UI.toast('No se puede eliminar: ' + users.length + ' usuario(s) tienen este rol. Reasígnelos primero.', 'bad'); return; }
        UI.confirm({ title: 'Eliminar rol', danger: true, message: 'Se eliminará el rol personalizado <b>' + esc(r.name) + '</b> y su matriz de permisos.', confirmLabel: 'Eliminar', onConfirm: () => { const i = DB.roles.indexOf(r); DB.roles.splice(i, 1); delete DB.rolePerms[r.id]; Store.save(); Audit.log('Rol', r.id, 'eliminar_rol', r.name, ''); roleSel = 'sales'; UI.toast('Rol eliminado.'); App.go('#/admin/roles'); } });
      };
    };
    const ruleCheck = (rid, perm, grant) => {
      const r = Q.role(rid);
      if (rid === 'super_admin') return 'El rol Super Admin SaaS es de plataforma y no se edita desde un tenant.';
      if (!grant && rid === 'tenant_admin' && ['admin.roles.manage', 'admin.users.manage'].includes(perm)) return 'Regla anti-bloqueo: el Tenant Admin conserva la administración de usuarios y roles.';
      if (grant && ['canal', 'mobile'].includes(r.scope) && perm.startsWith('admin.')) return 'Mínimo privilegio: los roles de canal o mobile no pueden recibir permisos administrativos.';
      if (grant && ['canal', 'mobile'].includes(r.scope) && /finance\.|profitability|discount_override/.test(perm)) return 'Mínimo privilegio: los roles externos no acceden a costos, márgenes ni finanzas.';
      if (grant && perm === 'admin.tenant.manage' && rid !== 'tenant_admin') return 'admin.tenant.manage está reservado al Tenant Admin.';
      return '';
    };
    const apply = (rid, perm, grant) => {
      const arr = DB.rolePerms[rid] = DB.rolePerms[rid] || [];
      const has = arr.includes(perm);
      if (grant === has) return false;
      if (grant) arr.push(perm); else arr.splice(arr.indexOf(perm), 1);
      Audit.log('Permiso', rid, grant ? 'otorgar_permiso' : 'revocar_permiso', grant ? 'sin ' + perm : perm, grant ? perm : 'sin ' + perm);
      return true;
    };
    const drawMatrix = () => {
      const groups = DB.permissionGroups.filter(g => !roleMod || g.module === roleMod);
      const roles = DB.roles;
      const tbl = el.querySelector('#pm');
      tbl.innerHTML = '<thead><tr><th>Permiso</th>' + roles.map(r => '<th class="center' + (r.id === roleSel ? ' pm-sel' : '') + '" title="' + esc(r.desc) + '">' + esc(r.name) + '<div class="xs faint" style="text-transform:none;letter-spacing:0;font-weight:500">' + (DB.rolePerms[r.id] || []).length + '</div></th>').join('') + '</tr></thead><tbody>' +
        groups.map(g => '<tr class="pm-g"><td>' + esc(g.module) + '</td>' + roles.map(r => { const n = g.perms.filter(p => (DB.rolePerms[r.id] || []).includes(p)).length; return '<td class="center' + (r.id === roleSel ? ' pm-sel' : '') + '">' + (canEdit && r.id !== 'super_admin' ? '<button class="btn xs ghost" data-gm="' + esc(g.module) + '" data-gr="' + r.id + '" title="Marcar/desmarcar módulo">' + n + '/' + g.perms.length + '</button>' : '<span class="xs faint">' + n + '/' + g.perms.length + '</span>') + '</td>'; }).join('') + '</tr>' +
          g.perms.map(p => '<tr><td><span class="mono small">' + esc(p) + '</span></td>' + roles.map(r => '<td class="center' + (r.id === roleSel ? ' pm-sel' : '') + '"><input type="checkbox" aria-label="' + esc(r.name + ' · ' + p) + '" data-r="' + r.id + '" data-p="' + esc(p) + '"' + ((DB.rolePerms[r.id] || []).includes(p) ? ' checked' : '') + (!canEdit || r.id === 'super_admin' ? ' disabled' : '') + '></td>').join('') + '</tr>').join('')).join('') + '</tbody>';
      tbl.querySelectorAll('input[data-r]').forEach(cb => cb.onchange = () => {
        const rid = cb.dataset.r, perm = cb.dataset.p, grant = cb.checked;
        const why = ruleCheck(rid, perm, grant);
        if (why) { cb.checked = !grant; UI.toast(esc(why), 'bad'); return; }
        apply(rid, perm, grant); Store.save();
        UI.toast((grant ? 'Permiso otorgado: ' : 'Permiso revocado: ') + '<span class="mono">' + esc(perm) + '</span> · ' + esc(Q.roleName(rid)));
        afterChange(rid);
      });
      tbl.querySelectorAll('[data-gm]').forEach(bt => bt.onclick = () => {
        const g = DB.permissionGroups.find(x => x.module === bt.dataset.gm); const rid = bt.dataset.gr;
        const arr = DB.rolePerms[rid] || [];
        const grant = !g.perms.every(p => arr.includes(p));
        let n = 0, blocked = 0;
        g.perms.forEach(p => { if (ruleCheck(rid, p, grant)) blocked++; else if (apply(rid, p, grant)) n++; });
        Store.save();
        UI.toast(n + ' permiso(s) ' + (grant ? 'otorgados' : 'revocados') + ' en ' + esc(g.module) + ' para ' + esc(Q.roleName(rid)) + (blocked ? ' · ' + blocked + ' bloqueado(s) por reglas de seguridad' : '') + '.', blocked && !n ? 'bad' : 'ok');
        afterChange(rid);
      });
    };
    const drawAudit = () => {
      const rows = DB.audit.filter(a => ['Permiso', 'Rol'].includes(a.entity)).slice(0, 12);
      el.querySelector('#pm-audit').innerHTML = rows.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Actor</th><th>Rol</th><th>Acción</th><th>Antes → después</th><th>Correlación</th></tr></thead><tbody>' + rows.map(a => '<tr><td class="nowrap small">' + datetime(a.ts) + '</td><td>' + UI.userChip(a.user) + '</td><td>' + esc(Q.roleName(a.entityId)) + '</td><td>' + UI.badge(a.action.includes('revocar') || a.action.includes('eliminar') ? 'alta' : 'media', a.action.replace(/_/g, ' ')) + '</td><td class="small"><span class="faint">' + esc(a.before) + '</span> → <b>' + esc(a.after) + '</b></td><td class="mono xs">' + esc(a.corr) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Aún no hay cambios de permisos registrados en esta demo.', 'shield');
    };
    const afterChange = (rid) => {
      drawList(); drawDetail(); drawAudit(); drawMap();
      const wrap = el.querySelector('#pm').parentElement; const sx = wrap.scrollLeft, sy = wrap.scrollTop; drawMatrix(); wrap.scrollLeft = sx; wrap.scrollTop = sy;
      if (rid === Auth.role) { Shell.renderNav(); UI.toast('Cambió permisos de su propio rol: el menú se actualizó.', 'info'); }
    };
    el.querySelector('#pm-mod').onchange = (e) => { roleMod = e.target.value; drawMatrix(); };
    const nb = el.querySelector('#rl-new'); if (nb) nb.onclick = () => roleForm();
    drawList(); drawDetail(); drawMatrix(); drawAudit(); showView(roleView);
  });

  function roleForm(r, copyFrom) {
    const isNew = !r;
    UI.modal({ title: isNew ? 'Crear rol personalizado' : 'Editar rol — ' + esc(r.name), body: UI.form([
      { id: 'rf-name', label: 'Nombre del rol', required: true, value: r ? r.name : (copyFrom ? Q.roleName(copyFrom) + ' (copia)' : ''), col: 12, placeholder: 'Ej. Counter de ventas Cusco' },
      { id: 'rf-desc', label: 'Descripción', required: true, value: r ? r.desc : '', col: 12 },
      { id: 'rf-scope', label: 'Alcance', type: 'select', options: [['tenant', 'Tenant (usuario interno)'], ['mobile', 'Mobile (operador)'], ['canal', 'Canal externo']], value: r ? r.scope : 'tenant', col: 6, disabled: !isNew },
      isNew ? { id: 'rf-copy', label: 'Copiar permisos de', type: 'select', options: [['', 'Ninguno (sin permisos)']].concat(DB.roles.filter(x => x.id !== 'super_admin').map(x => [x.id, x.name])), value: copyFrom || '', col: 6 } : { type: 'html', col: 6, html: '' }
    ]) + '<p class="xs faint" style="margin-top:10px">Tras crearlo, ajuste los permisos en la matriz. Los roles de canal o mobile no pueden recibir permisos administrativos ni financieros.</p>',
    actions: [{ label: 'Cancelar' }, { label: isNew ? 'Crear rol' : 'Guardar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false;
      const f = UI.formData(m);
      if (DB.roles.some(x => x.name.toLowerCase() === f['rf-name'].toLowerCase() && x !== r)) { UI.toast('Ya existe un rol con ese nombre.', 'bad'); return false; }
      if (isNew) {
        let id = 'custom_' + f['rf-name'].toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
        while (Q.role(id)) id += '_2';
        let perms = f['rf-copy'] ? (DB.rolePerms[f['rf-copy']] || []).slice() : [];
        if (f['rf-scope'] !== 'tenant') perms = perms.filter(p => !p.startsWith('admin.') && !/finance\.|profitability|discount_override/.test(p));
        DB.roles.push({ id, name: f['rf-name'], desc: f['rf-desc'], scope: f['rf-scope'], custom: true });
        DB.rolePerms[id] = perms; roleSel = id;
        Store.save(); Audit.log('Rol', id, 'crear_rol', f['rf-copy'] ? 'copia de ' + f['rf-copy'] : '', f['rf-name'] + ' · ' + perms.length + ' permisos');
        UI.toast('Rol creado con ' + perms.length + ' permisos.');
      } else {
        const b = r.name; r.name = f['rf-name']; r.desc = f['rf-desc']; Store.save(); Audit.log('Rol', r.id, 'editar_rol', b, r.name); UI.toast('Rol actualizado.');
      }
      App.go('#/admin/roles/' + roleSel);
    } }] });
  }

  /* =====================================================================
     ADMIN / CONFIGURACIÓN — PROC-003
     ===================================================================== */
  App.register('admin/configuracion', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Configuración');
    if (!Auth.can('admin.settings.manage')) return denied(el, 'Configuración', crumbs, 'admin.settings.manage');
    const s = DB.settings;
    const lastCfg = DB.audit.find(a => a.entity === 'Configuración');
    el.innerHTML = page(
      UI.pageHeader({ title: 'Configuración del tenant', subtitle: 'Parámetros de ' + esc(DB.tenant.name) + ' (PROC-003). Cada cambio guardado se registra en auditoría con valor anterior y nuevo.', crumbs,
        actions: '<a class="btn" href="#/admin/auditoria">' + ic('shield') + 'Ver cambios en auditoría</a>' }) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Moneda base', value: esc(s.currency), sub: 'Alterna ' + esc(s.altCurrency) + ' · TC ' + s.fx, tone: 'accent', icon: 'coins' }) +
        UI.kpi({ label: 'IGV', value: s.taxPct + '%', sub: 'Redondeo ' + esc(s.rounding), tone: 'info', icon: 'percent' }) +
        UI.kpi({ label: 'Validez de cotización', value: s.quoteValidityDays + ' días', sub: 'Hold ' + s.holdMinutes + ' min', tone: 'violet', icon: 'clock' }) +
        UI.kpi({ label: 'Último cambio', value: lastCfg ? dateShort(lastCfg.ts) : '—', sub: lastCfg ? esc(uName(lastCfg.user)) + ' · ' + esc(lastCfg.entityId) : 'Sin cambios en esta demo', tone: 'sun', icon: 'history' }) +
      '</div><div id="cf-tabs"></div>');
    const tabs = [
      { id: 'general', label: 'General', render: cfgGeneral },
      { id: 'moneda', label: 'Moneda e impuestos', render: cfgMoneda },
      { id: 'series', label: 'Series y correlativos', render: cfgSeries },
      { id: 'politicas', label: 'Políticas', render: cfgPoliticas },
      { id: 'operativos', label: 'Parámetros operativos', render: cfgOps },
      { id: 'canales', label: 'Canales habilitados', render: cfgCanales }
    ];
    UI.tabs(el.querySelector('#cf-tabs'), tabs, tabs.some(t => t.id === params[0]) ? params[0] : 'general', { onChange: id => setHash('#/admin/configuracion/' + id) });
  });

  /* Guarda solo lo que cambió y audita cada campo (PROC-003 / PROC-063) */
  function saveDiff(section, target, vals, labels) {
    const changes = [];
    Object.keys(vals).forEach(k => {
      const nv = vals[k]; const ov = target[k];
      if (String(ov == null ? '' : ov) !== String(nv == null ? '' : nv)) { changes.push([k, ov, nv]); target[k] = nv; }
    });
    if (!changes.length) { UI.toast('No hay cambios que guardar.', 'info'); return 0; }
    Store.save();
    changes.forEach(([k, ov, nv]) => Audit.log('Configuración', section + '.' + k, 'actualizar', typeof ov === 'boolean' ? (ov ? 'sí' : 'no') : ov, typeof nv === 'boolean' ? (nv ? 'sí' : 'no') : nv));
    UI.toast(changes.length + ' cambio(s) guardado(s) en ' + esc(section) + ': ' + changes.map(c => esc(labels && labels[c[0]] || c[0])).join(', ') + '.');
    return changes.length;
  }
  const saveBar = (id, note) => '<div class="row between" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line-2)"><span class="xs faint">' + (note || 'Los cambios se aplican a documentos nuevos; los existentes conservan su snapshot.') + '</span><button class="btn primary" id="' + id + '">' + ic('check') + 'Guardar cambios</button></div>';

  function cfgGeneral(b) {
    const t = DB.tenant, g = DB.settings.general;
    b.innerHTML = '<div class="grid g-2-1">' + UI.card('Datos del tenant', UI.form([
      { type: 'section', label: 'Identificación' },
      { id: 'name', label: 'Razón social', required: true, value: t.name, col: 8 },
      { id: 'ruc', label: 'RUC', value: t.ruc, col: 4, disabled: true, hint: 'No editable: requiere validación de plataforma' },
      { id: 'short', label: 'Nombre comercial', required: true, value: t.short, col: 6 },
      { id: 'logo', label: 'Iniciales del logo', required: true, value: t.logo, col: 3 },
      { id: 'mincetur', label: 'Registro MINCETUR', value: g.mincetur, col: 3 },
      { id: 'legalRep', label: 'Representante legal', value: g.legalRep, col: 6 },
      { id: 'address', label: 'Domicilio fiscal', value: g.address, col: 6 },
      { type: 'section', label: 'Contacto y regionalización' },
      { id: 'email', label: 'Correo institucional', type: 'email', value: g.email, col: 4 },
      { id: 'phone', label: 'Teléfono', value: g.phone, col: 4 },
      { id: 'web', label: 'Sitio web', value: g.web, col: 4 },
      { id: 'country', label: 'País', value: t.country, col: 3, disabled: true },
      { id: 'tz', label: 'Zona horaria', type: 'select', options: ['America/Lima', 'America/La_Paz', 'America/Santiago', 'America/Bogota'], value: t.tz, col: 3 },
      { id: 'lang', label: 'Idioma', type: 'select', options: [['es-PE', 'Español (Perú)'], ['en-US', 'Inglés']], value: g.lang, col: 3 },
      { id: 'dateFmt', label: 'Formato de fecha', type: 'select', options: ['DD/MM/AAAA', 'AAAA-MM-DD'], value: g.dateFmt, col: 3 },
      { id: 'mainSede', label: 'Sede principal', type: 'select', options: DB.sedes.filter(s => s.status === 'activa').map(s => [s.id, s.name]), value: g.mainSede, col: 6 }
    ]) + saveBar('cf-g-save', 'Afecta encabezados de documentos, correos y portales del tenant.')) +
      UI.card('Resumen del tenant', UI.dl([['ID', '<span class="mono">' + esc(t.id) + '</span>'], ['Plan', esc(t.plan)], ['Estado', UI.badge(t.status)], ['Alta', date(t.createdAt)], ['Sedes', DB.sedes.length], ['Usuarios', DB.users.length]]) + '<div class="divider" style="margin:14px 0"></div><p class="xs faint">El identificador del tenant es inmutable y se resuelve desde la autenticación en cada solicitud.</p><div style="margin-top:10px"><a class="btn sm" href="#/admin/tenants">' + ic('server') + 'Ver planes</a></div>') + '</div>';
    b.querySelector('#cf-g-save').onclick = () => {
      const card = b.querySelector('.card'); if (!UI.validate(card)) return;
      const f = UI.formData(card);
      let n = saveDiff('general', DB.tenant, { name: f.name, short: f.short, logo: f.logo.toUpperCase().slice(0, 3), tz: f.tz });
      n += saveDiff('general', DB.settings.general, { email: f.email, phone: f.phone, web: f.web, address: f.address, legalRep: f.legalRep, mincetur: f.mincetur, lang: f.lang, dateFmt: f.dateFmt, mainSede: f.mainSede });
      const t0 = DB.tenants.find(x => x.id === DB.tenant.id); if (t0) { t0.name = DB.tenant.name; Store.save(); }
      if (n) { Shell.renderNav(); App.render(); }
    };
  }

  function cfgMoneda(b) {
    const s = DB.settings;
    const hasTx = DB.reservations.length + DB.payments.length > 0;
    b.innerHTML = '<div class="grid g-2-1">' + UI.card('Moneda, tipo de cambio e impuestos', UI.form([
      { type: 'section', label: 'Monedas' },
      { id: 'currency', label: 'Moneda base', type: 'select', options: [['PEN', 'PEN — Sol'], ['USD', 'USD — Dólar']], value: s.currency, col: 4, disabled: hasTx, hint: hasTx ? 'Bloqueada: existen transacciones registradas' : '' },
      { id: 'altCurrency', label: 'Moneda alterna', type: 'select', options: [['USD', 'USD — Dólar'], ['EUR', 'EUR — Euro']], value: s.altCurrency, col: 4 },
      { id: 'priceWithTax', label: 'Mostrar precios con IGV incluido', type: 'switch', value: s.priceWithTax, col: 4 },
      { type: 'section', label: 'Tipo de cambio' },
      { id: 'fx', label: 'Tipo de cambio (PEN por USD)', type: 'number', step: '0.001', min: 0.5, value: s.fx, col: 4, required: true },
      { id: 'fxSource', label: 'Fuente', type: 'select', options: ['Manual diario (SBS referencial)', 'Manual semanal (tesorería)', 'Automático SBS (integración por definir)'], value: s.fxSource, col: 8 },
      { type: 'section', label: 'Impuestos y redondeo' },
      { id: 'taxPct', label: 'IGV (%)', type: 'number', step: '0.5', min: 0, max: 30, value: s.taxPct, col: 4, required: true },
      { id: 'rounding', label: 'Redondeo de precio final', type: 'select', options: [['0.01', 'Al céntimo (0.01)'], ['0.10', 'A 0.10'], ['1', 'A la unidad']], value: s.rounding, col: 4 },
      { id: 'roundMode', label: 'Modo de redondeo', type: 'select', options: ['Al más cercano', 'Hacia arriba', 'Hacia abajo'], value: s.roundMode, col: 4 }
    ]) + '<div style="margin-top:12px">' + UI.alert('info', 'Exportación de servicios a no domiciliados: la cotización puede marcarse sin IGV (tasa 0%) según corresponda. El tipo de cambio se congela en el snapshot de cada cotización y pago.') + '</div>' + saveBar('cf-m-save')) +
      '<div class="stack">' + UI.card('Vista previa del cálculo', '<div id="cf-prev"></div>', { sub: 'Costo S/ 1 000 · markup 25%' }) +
      UI.card('Historial de tipo de cambio', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th class="num">TC</th><th>Registró</th></tr></thead><tbody>' + s.fxHistory.slice(0, 8).map(h => '<tr><td class="small">' + date(h.date) + '</td><td class="num mono">' + fmtN(h.fx, 3) + '</td><td class="small">' + esc(uName(h.user)) + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) + '</div></div>';
    const card = b.querySelector('.card');
    const prev = () => {
      const f = UI.formData(card);
      const r = Pricing.calc({ cost: 1000, markupPct: 25, taxPct: Number(f.taxPct) || 0, round: Number(f.rounding) || 0.01 });
      b.querySelector('#cf-prev').innerHTML = '<div class="stat-line"><span>Costo proveedores</span><b>' + money(r.base) + '</b></div><div class="stat-line"><span>Markup 25%</span><b>' + money(r.markup) + '</b></div><div class="stat-line"><span>Valor de venta</span><b>' + money(r.net) + '</b></div><div class="stat-line"><span>IGV ' + (Number(f.taxPct) || 0) + '%</span><b>' + money(r.tax) + '</b></div><div class="stat-line total"><span>Precio final</span><b>' + money(r.total) + '</b></div><div class="stat-line"><span>Equivalente ' + esc(f.altCurrency || 'USD') + '</span><b>' + money(r.total / (Number(f.fx) || 1), 'USD') + '</b></div>';
    };
    card.addEventListener('input', prev); card.addEventListener('change', prev); prev();
    b.querySelector('#cf-m-save').onclick = () => {
      if (!UI.validate(card)) return;
      const f = UI.formData(card);
      if (!(Number(f.fx) > 0.5 && Number(f.fx) < 20)) { UI.toast('Tipo de cambio fuera de rango razonable.', 'bad'); return; }
      const oldFx = s.fx;
      const vals = { altCurrency: f.altCurrency, priceWithTax: !!f.priceWithTax, fx: Number(f.fx), fxSource: f.fxSource, taxPct: Number(f.taxPct), rounding: f.rounding, roundMode: f.roundMode };
      if (!hasTx) vals.currency = f.currency;
      const n = saveDiff('moneda', s, vals, { fx: 'tipo de cambio', taxPct: 'IGV', rounding: 'redondeo' });
      if (n) {
        if (oldFx !== s.fx) { s.fxHistory.unshift({ date: window.TODAY, fx: s.fx, source: s.fxSource, user: Auth.user.id }); }
        DB.tenant.fx = s.fx; DB.tenant.taxPct = s.taxPct; DB.tenant.currency = s.currency; DB.tenant.altCurrency = s.altCurrency; Store.save();
        App.go('#/admin/configuracion/moneda');
      }
    };
  }

  function cfgSeries(b) {
    const s = DB.settings;
    const fmt = (x) => { const w = x.doc === 'Reserva' ? 6 : x.doc === 'Voucher' ? 5 : x.doc === 'Factura' || x.doc === 'Boleta' ? 8 : x.doc === 'Orden operativa' ? 4 : 5; return x.prefix + String(x.next).padStart(w, '0'); };
    b.innerHTML = UI.card('Series y correlativos', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Documento</th><th>Prefijo / serie</th><th class="num">Siguiente número</th><th>Próximo documento</th></tr></thead><tbody>' +
      s.series.map((x, i) => '<tr><td><b class="small">' + esc(x.doc) + '</b></td><td><input class="input sm mono" data-sp="' + i + '" value="' + esc(x.prefix) + '" style="max-width:160px" aria-label="Prefijo ' + esc(x.doc) + '"></td><td class="num"><input class="input sm num" type="number" min="' + x.next + '" data-sn="' + i + '" value="' + x.next + '" style="max-width:120px;margin-left:auto" aria-label="Siguiente ' + esc(x.doc) + '"></td><td class="mono small" id="sprev-' + i + '">' + esc(fmt(x)) + '</td></tr>').join('') +
      '</tbody></table></div>' + '<div class="row" style="margin-top:12px"><button class="btn sm" id="sr-add">' + ic('plus') + 'Agregar serie</button></div>' +
      '<div style="margin-top:12px">' + UI.alert('warn', '<b>Regla de correlativos:</b> los números no se reutilizan ni retroceden. Solo se permite avanzar el siguiente número (p. ej. al migrar desde otro sistema). Las series de facturas y boletas deben coincidir con las autorizadas ante SUNAT.') + '</div>' + saveBar('sr-save', 'Los correlativos se asignan en el backend de forma atómica al crear cada documento.'), { sub: 'DB.settings.series' });
    b.querySelectorAll('[data-sp],[data-sn]').forEach(inp => inp.oninput = () => { const i = +(inp.dataset.sp || inp.dataset.sn); const x = { doc: s.series[i].doc, prefix: b.querySelector('[data-sp="' + i + '"]').value, next: +b.querySelector('[data-sn="' + i + '"]').value || 0 }; b.querySelector('#sprev-' + i).textContent = fmt(x); });
    b.querySelector('#sr-add').onclick = () => UI.modal({ title: 'Agregar serie', size: 'sm', body: UI.form([{ id: 'ns-doc', label: 'Documento', type: 'select', options: ['Nota de crédito', 'Nota de débito', 'Liquidación de comisión', 'Recibo de caja', 'Orden de compra a proveedor'].filter(d => !s.series.some(x => x.doc === d)), col: 12 }, { id: 'ns-prefix', label: 'Prefijo', required: true, value: 'FC01-', col: 6 }, { id: 'ns-next', label: 'Número inicial', type: 'number', min: 1, value: 1, col: 6, required: true }]),
      actions: [{ label: 'Cancelar' }, { label: 'Agregar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); if (!f['ns-doc']) { UI.toast('No hay más tipos de documento disponibles.', 'bad'); return false; } if (s.series.some(x => x.prefix === f['ns-prefix'])) { UI.toast('El prefijo ya está en uso.', 'bad'); return false; } s.series.push({ doc: f['ns-doc'], prefix: f['ns-prefix'], next: Number(f['ns-next']) || 1 }); Store.save(); Audit.log('Configuración', 'series.' + f['ns-doc'], 'crear', '', f['ns-prefix'] + f['ns-next']); UI.toast('Serie agregada.'); App.go('#/admin/configuracion/series'); } }] });
    b.querySelector('#sr-save').onclick = () => {
      const changes = []; let err = '';
      s.series.forEach((x, i) => {
        const p = b.querySelector('[data-sp="' + i + '"]').value.trim(); const n = parseInt(b.querySelector('[data-sn="' + i + '"]').value, 10);
        if (!p) err = 'El prefijo de ' + x.doc + ' no puede estar vacío.';
        else if (!(n >= x.next)) err = 'Regla de correlativos: ' + x.doc + ' no puede retroceder de ' + x.next + ' a ' + (isNaN(n) ? '—' : n) + '.';
        else if (s.series.some((y, j) => j !== i && (b.querySelector('[data-sp="' + j + '"]').value.trim()) === p)) err = 'Prefijo duplicado: ' + p;
        else if (p !== x.prefix || n !== x.next) changes.push([x, p, n]);
      });
      if (err) { UI.toast(esc(err), 'bad'); return; }
      if (!changes.length) { UI.toast('No hay cambios que guardar.', 'info'); return; }
      changes.forEach(([x, p, n]) => { const before = fmt(x); x.prefix = p; x.next = n; Audit.log('Configuración', 'series.' + x.doc, 'actualizar', before, fmt(x)); });
      Store.save(); UI.toast(changes.length + ' serie(s) actualizada(s).'); App.go('#/admin/configuracion/series');
    };
  }

  function cfgPoliticas(b) {
    const s = DB.settings, p = s.policies;
    b.innerHTML = UI.card('Políticas comerciales por defecto', UI.form([
      { type: 'section', label: 'Cotizaciones y disponibilidad' },
      { id: 'quoteValidityDays', label: 'Validez de cotización (días)', type: 'number', min: 1, max: 60, value: s.quoteValidityDays, col: 3, required: true },
      { id: 'holdMinutes', label: 'Minutos de hold', type: 'number', min: 5, max: 1440, value: s.holdMinutes, col: 3, required: true, hint: 'Luego el job JOB-01 libera el cupo' },
      { id: 'markupPct', label: 'Markup por defecto (%)', type: 'number', step: '0.5', value: p.markupPct, col: 3 },
      { id: 'maxDiscountPct', label: 'Descuento máx. sin aprobación (%)', type: 'number', step: '0.5', value: p.maxDiscountPct, col: 3, hint: 'Superarlo requiere quotes.discount_override' },
      { type: 'section', label: 'Cobranza' },
      { id: 'advancePct', label: 'Anticipo para confirmar (%)', type: 'number', min: 0, max: 100, value: p.advancePct, col: 4 },
      { id: 'balanceDaysBefore', label: 'Saldo: días antes del viaje', type: 'number', min: 0, value: p.balanceDaysBefore, col: 4 },
      { type: 'html', col: 4, html: '' },
      { type: 'section', label: 'Textos de política (se copian a productos y cotizaciones nuevas)' },
      { id: 'cancel', label: 'Política de cancelación', type: 'textarea', rows: 2, value: p.cancel, col: 12, required: true },
      { id: 'modify', label: 'Política de modificación', type: 'textarea', rows: 2, value: p.modify, col: 6 },
      { id: 'noshow', label: 'No-show', type: 'textarea', rows: 2, value: p.noshow, col: 6 },
      { id: 'refund', label: 'Reembolsos', type: 'textarea', rows: 2, value: p.refund, col: 12 }
    ]) + saveBar('cf-p-save', 'Cada producto puede sobrescribir estas políticas; la cotización guarda la política vigente en su snapshot.'));
    b.querySelector('#cf-p-save').onclick = () => {
      const card = b.querySelector('.card'); if (!UI.validate(card)) return;
      const f = UI.formData(card);
      if (Number(f.maxDiscountPct) > 30) { UI.toast('El descuento máximo sin aprobación no puede superar 30%.', 'bad'); return; }
      if (Number(f.holdMinutes) < 5) { UI.toast('El hold mínimo es 5 minutos.', 'bad'); return; }
      const n = saveDiff('politicas', s, { quoteValidityDays: Number(f.quoteValidityDays), holdMinutes: Number(f.holdMinutes) }, { quoteValidityDays: 'validez de cotización', holdMinutes: 'minutos de hold' }) +
        saveDiff('politicas', p, { markupPct: Number(f.markupPct), maxDiscountPct: Number(f.maxDiscountPct), advancePct: Number(f.advancePct), balanceDaysBefore: Number(f.balanceDaysBefore), cancel: f.cancel, modify: f.modify, noshow: f.noshow, refund: f.refund });
      if (n) App.go('#/admin/configuracion/politicas');
    };
  }

  function cfgOps(b) {
    const o = DB.settings.ops;
    const L = { voucherHoursBefore: 'Emitir vouchers (horas antes)', assignExpiryMin: 'Expirar asignación no confirmada (min)', checkinToleranceMin: 'Tolerancia de check-in (min)', modifyMinHours: 'Modificación mínima antes del servicio (h)', maxPaxPerGuide: 'Máx. pasajeros por guía', offlineSyncMin: 'Sincronización offline app (min)', payReminderDays: 'Recordatorio de pago (días antes)', tripNoticeHours: 'Aviso de próximo viaje (horas)', incidentEscalateMin: 'Escalar incidencia sin atención (min)' };
    b.innerHTML = UI.card('Parámetros operativos', UI.form([{ type: 'section', label: 'Operación y recursos' }].concat(['voucherHoursBefore', 'assignExpiryMin', 'checkinToleranceMin', 'modifyMinHours', 'maxPaxPerGuide', 'offlineSyncMin'].map(k => ({ id: k, label: L[k], type: 'number', min: 0, value: o[k], col: 4, required: true })))
      .concat([{ type: 'section', label: 'Recordatorios y alertas (usados por el scheduler)' }], ['payReminderDays', 'tripNoticeHours', 'incidentEscalateMin'].map(k => ({ id: k, label: L[k], type: 'number', min: 0, value: o[k], col: 4, required: true })))) +
      '<div style="margin-top:12px">' + UI.alert('info', 'Estos parámetros alimentan los jobs programados: expiración de asignaciones (JOB-09), recordatorios de pago (JOB-03) y aviso de próximos viajes (JOB-05). <a href="#/admin/integraciones/jobs">Ver scheduler</a>.') + '</div>' + saveBar('cf-o-save'));
    b.querySelector('#cf-o-save').onclick = () => {
      const card = b.querySelector('.card'); if (!UI.validate(card)) return;
      const f = UI.formData(card); const v = {}; Object.keys(L).forEach(k => v[k] = Number(f[k]));
      if (v.maxPaxPerGuide < 1 || v.maxPaxPerGuide > 40) { UI.toast('Máx. pasajeros por guía debe estar entre 1 y 40.', 'bad'); return; }
      if (saveDiff('operativos', o, v, L)) App.go('#/admin/configuracion/operativos');
    };
  }

  function cfgCanales(b) {
    const c = DB.settings.channels; const plan = DB.tenant.plan;
    const dep = { whatsapp: 'INT-04', ecommerce: 'INT-02' };
    b.innerHTML = UI.card('Canales habilitados', CHANNELS.map(ch => { const ok = PLAN_RANK[plan] >= PLAN_RANK[ch.plan]; const integ = dep[ch.k] ? DB.integrations.find(i => i.id === dep[ch.k]) : null; return '<div class="wz-ch"><label class="switch"><input type="checkbox" name="' + ch.k + '"' + (ok && c[ch.k] ? ' checked' : '') + (ok ? '' : ' disabled') + ' aria-label="' + esc(ch.label) + '"></label><div class="grow"><b class="small">' + esc(ch.label) + '</b> ' + (ok ? '' : '<span class="tag">Requiere plan ' + esc(ch.plan) + '</span>') + '<div class="xs faint">' + esc(ch.desc) + '</div>' + (integ ? '<div class="xs" style="margin-top:3px">Depende de <a href="#/admin/integraciones">' + esc(integ.name) + '</a> ' + UI.badge(integ.status) + '</div>' : '') + '</div></div>'; }).join('') + saveBar('cf-c-save', 'Deshabilitar un canal oculta su acceso de inmediato; las reservas ya creadas por ese canal no se alteran.'), { sub: 'Plan ' + esc(plan) + ' · entitlements aplicados' });
    b.querySelector('#cf-c-save').onclick = () => {
      const f = UI.formData(b.querySelector('.card')); const v = {};
      CHANNELS.forEach(ch => { if (PLAN_RANK[plan] >= PLAN_RANK[ch.plan]) v[ch.k] = !!f[ch.k]; });
      if (v.ecommerce && DB.integrations.find(i => i.id === 'INT-02').status === 'por_validar') UI.toast('Aviso: E-commerce habilitado sin pasarela validada (INT-02). Los pagos quedarán como pendientes.', 'warn');
      if (saveDiff('canales', c, v, Object.fromEntries(CHANNELS.map(x => [x.k, x.label])))) App.go('#/admin/configuracion/canales');
    };
  }

  /* =====================================================================
     ADMIN / NOTIFICACIONES — PROC-059
     ===================================================================== */
  const CH_KEYS = [['email', 'Email', 'mail'], ['whatsapp', 'WhatsApp', 'msg'], ['push', 'Push', 'phone'], ['portal', 'Portal', 'globe']];
  const DEF_TPL = {
    'Cotización enviada': ['Su propuesta de viaje {{cotizacion}} — {{agencia}}', 'Hola {{cliente}}:\n\nLe compartimos la propuesta {{cotizacion}} para su viaje del {{fecha_viaje}}.\nMonto total: {{monto}}\n\nPuede revisarla, comentarla y aprobarla en línea:\n{{enlace}}\n\nQuedo atento a sus consultas.\n{{vendedor}} — {{agencia}}'],
    'Cotización aprobada': ['Cotización {{cotizacion}} aprobada', 'Hola {{vendedor}}:\n\n{{cliente}} aprobó la cotización {{cotizacion}} por {{monto}}. Proceda a convertirla en reserva.\n{{enlace}}'],
    'Reserva confirmada': ['Reserva confirmada {{reserva}}', 'Hola {{cliente}}:\n\nSu reserva {{reserva}} está confirmada. Fecha de inicio: {{fecha_viaje}}.\nEn su portal encontrará itinerario, vouchers y pagos:\n{{enlace}}\n\n{{agencia}}'],
    'Pago recibido': ['Hemos recibido su pago — {{reserva}}', 'Hola {{cliente}}:\n\nRegistramos su pago de {{monto}} para la reserva {{reserva}}. Gracias.\n\n{{agencia}}'],
    'Asignación': ['Nueva asignación: {{servicio}}', 'Tiene una nueva asignación: {{servicio}} el {{fecha_viaje}} a las {{hora}} (reserva {{reserva}}). Confirme en la app operador.'],
    'Cambio de horario': ['Cambio de horario — {{servicio}}', 'Estimado(a) {{cliente}}: el servicio {{servicio}} del {{fecha_viaje}} se reprograma a las {{hora}}. Disculpe las molestias. {{agencia}}'],
    'Incidencia crítica': ['ALERTA CRÍTICA — {{reserva}}', 'Incidencia crítica en la reserva {{reserva}} ({{servicio}}). Revise y asigne responsable de inmediato: {{enlace}}'],
    'Voucher emitido': ['Voucher de servicio — {{servicio}}', 'Hola {{cliente}}:\n\nAdjuntamos el voucher de {{servicio}} ({{fecha_viaje}}, {{hora}}). Preséntelo al proveedor.\n{{enlace}}'],
    'Inicio/fin de servicio': ['{{servicio}} en curso', 'Su servicio {{servicio}} ha iniciado. Punto de encuentro a las {{hora}}. Buen viaje.'],
    'Cierre de viaje': ['¿Cómo estuvo su viaje, {{cliente}}?', 'Hola {{cliente}}:\n\nGracias por viajar con {{agencia}}. Nos ayudaría mucho su opinión (2 minutos):\n{{enlace}}']
  };
  const tplKey = (ev, ch) => ev + '|' + ch;
  function getTpl(ev, ch) {
    const t = DB.settings.templates[tplKey(ev, ch)]; if (t) return t;
    const d = DEF_TPL[ev] || [ev, 'Hola {{cliente}}: ' + ev + '. {{agencia}}'];
    let body = d[1];
    if (ch === 'whatsapp') body = body.replace(/\n\n/g, '\n').split('\n').filter(Boolean).slice(0, 4).join('\n');
    if (ch === 'push') body = body.replace(/\n+/g, ' ').slice(0, 140);
    return { subject: d[0], body, version: 0 };
  }
  const renderTpl = (s) => esc(s).replace(/\{\{\s*[a-z_]+\s*\}\}/g, (v) => SAMPLE[v.replace(/\s/g, '')] ? '<b>' + esc(SAMPLE[v.replace(/\s/g, '')]) + '</b>' : '<span class="bad">' + v + '</span>');

  App.register('admin/notificaciones', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Notificaciones');
    if (!Auth.can('admin.settings.manage')) return denied(el, 'Notificaciones', crumbs, 'admin.settings.manage');
    const N = DB.notifications;
    const today = N.filter(n => n.ts.startsWith(window.TODAY));
    const failed = N.filter(n => n.status === 'fallido');
    el.innerHTML = page(
      UI.pageHeader({ title: 'Notificaciones', subtitle: 'Eventos del negocio que disparan mensajes por email, WhatsApp, push y portal mediante adaptadores configurables (PROC-059).', crumbs,
        actions: '<a class="btn" href="#/admin/integraciones">' + ic('plug') + 'Canales e integraciones</a>' }) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Envíos hoy', value: today.length, sub: N.length + ' en el registro', tone: 'accent', icon: 'send' }) +
        UI.kpi({ label: 'Tasa de entrega', value: fmtN(N.length ? (N.length - failed.length) / N.length * 100 : 100, 1) + '%', sub: 'Enviados / total', tone: 'ok', icon: 'checkCircle' }) +
        UI.kpi({ label: 'Fallidos', value: failed.length, sub: sum(N, 'retries') + ' reintentos acumulados', tone: failed.length ? 'bad' : 'ok', icon: 'alert' }) +
        UI.kpi({ label: 'Eventos configurados', value: DB.settings.notifications.length, sub: sum(DB.settings.notifications, e => CH_KEYS.filter(c => e[c[0]]).length) + ' combinaciones activas', tone: 'violet', icon: 'bell' }) +
      '</div>' +
      UI.card('Ciclo de una notificación', UI.flow(['Evento', 'Regla', 'Plantilla', 'Canal', 'Envío', 'Estado', 'Reintento', 'Log'], 8), { sub: 'Los envíos son asíncronos (cola) con reintentos y backoff; un fallo de canal no revierte la transacción de negocio.' }) +
      '<div id="nt-tabs"></div>');
    const tabs = [
      { id: 'matriz', label: 'Matriz evento × canal', render: notifMatrix },
      { id: 'plantillas', label: 'Plantillas', render: (b) => notifTemplates(b) },
      { id: 'log', label: 'Log de envíos', count: N.length, render: notifLog }
    ];
    UI.tabs(el.querySelector('#nt-tabs'), tabs, tabs.some(t => t.id === params[0]) ? params[0] : 'matriz', { onChange: id => setHash('#/admin/notificaciones/' + id) });
  });

  function notifMatrix(b) {
    const S = DB.settings;
    const wa = DB.integrations.find(i => i.id === 'INT-04');
    b.innerHTML = (wa && wa.status !== 'activo' ? UI.alert('warn', 'WhatsApp Business API está en estado <b>' + esc(UI.statusLabel(wa.status)) + '</b>: los envíos por WhatsApp solo llegan a números registrados en el entorno de pruebas. <a href="#/admin/integraciones">Ver integración</a>') : '') +
      UI.card('Reglas de envío por evento', '<div class="tbl-wrap"><table class="tbl adm-sw"><thead><tr><th>Evento</th><th>Regla (destinatarios · momento)</th>' + CH_KEYS.map(c => '<th class="center">' + c[1] + '</th>').join('') + '<th></th></tr></thead><tbody>' +
        S.notifications.map((e, i) => '<tr><td><b class="small">' + esc(e.event) + '</b></td><td class="small" style="text-align:left">' + esc(S.notifRules[e.event] || 'Cliente') + '<div class="xs faint">' + esc((S.notifTiming || {})[e.event] || 'Inmediato') + '</div></td>' + CH_KEYS.map(c => '<td><label class="switch" style="justify-content:center"><input type="checkbox" data-ev="' + i + '" data-ch="' + c[0] + '"' + (e[c[0]] ? ' checked' : '') + ' aria-label="' + esc(e.event + ' por ' + c[1]) + '"></label></td>').join('') +
        '<td class="nowrap"><button class="btn xs" data-rule="' + i + '">Regla</button> <button class="btn xs ghost" data-test="' + i + '">Probar</button> <button class="btn xs ghost" data-tpl="' + i + '">Plantilla</button></td></tr>').join('') +
        '</tbody></table></div>', { tight: true, sub: 'Los cambios se guardan al instante y se auditan' });
    b.querySelectorAll('input[data-ev]').forEach(cb => cb.onchange = () => {
      const e = S.notifications[+cb.dataset.ev]; const k = cb.dataset.ch;
      if (!cb.checked && e.event === 'Incidencia crítica' && CH_KEYS.filter(c => c[0] !== k && e[c[0]]).length === 0) { cb.checked = true; UI.toast('Regla: la incidencia crítica debe notificarse por al menos un canal.', 'bad'); return; }
      e[k] = cb.checked; Store.save();
      Audit.log('Notificación', e.event, 'actualizar', (cb.checked ? 'sin ' : '') + k, (cb.checked ? '' : 'sin ') + k);
      UI.toast(esc(e.event) + ': canal ' + esc(CH_KEYS.find(c => c[0] === k)[1]) + (cb.checked ? ' activado.' : ' desactivado.'));
    });
    b.querySelectorAll('[data-test]').forEach(bt => bt.onclick = () => {
      const e = S.notifications[+bt.dataset.test]; const chs = CH_KEYS.filter(c => e[c[0]]);
      if (!chs.length) { UI.toast('El evento no tiene canales activos.', 'warn'); return; }
      chs.forEach(c => Notify.push(eventCode(e.event), c[1], c[0] === 'email' ? Auth.user.email : c[0] === 'whatsapp' ? Auth.user.phone : Auth.user.id, '[Prueba] ' + getTpl(e.event, c[0] === 'portal' ? 'email' : c[0]).subject.replace(/\{\{\s*[a-z_]+\s*\}\}/g, v => SAMPLE[v.replace(/\s/g, '')] || v), c[0] === 'whatsapp' && DB.integrations.find(i => i.id === 'INT-04').status === 'sandbox' && !Auth.user.phone ? 'fallido' : 'enviado'));
      UI.toast('Prueba enviada por ' + chs.map(c => c[1]).join(', ') + '. Revise el log de envíos.');
    });
    b.querySelectorAll('[data-tpl]').forEach(bt => bt.onclick = () => { tplEvent = S.notifications[+bt.dataset.tpl].event; App.go('#/admin/notificaciones/plantillas'); });
    b.querySelectorAll('[data-rule]').forEach(bt => bt.onclick = () => {
      const e = S.notifications[+bt.dataset.rule]; S.notifTiming = S.notifTiming || {};
      UI.modal({ title: 'Regla — ' + esc(e.event), size: 'sm', body: UI.form([{ id: 'nr-to', label: 'Destinatarios', required: true, value: S.notifRules[e.event] || '', col: 12, hint: 'Roles o contactos resueltos en backend por evento' }, { id: 'nr-when', label: 'Momento de envío', type: 'select', options: ['Inmediato', 'Agrupado cada 15 min', 'Solo horario laboral (08:00–19:00)'], value: S.notifTiming[e.event] || 'Inmediato', col: 12 }, { id: 'nr-cond', label: 'Condición adicional', type: 'select', options: ['Siempre', 'Solo si el cliente aceptó comunicaciones', 'Solo reservas con monto > S/ 5 000'], value: (S.notifCond || {})[e.event] || 'Siempre', col: 12 }]),
        actions: [{ label: 'Cancelar' }, { label: 'Guardar regla', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); const before = (S.notifRules[e.event] || '') + ' · ' + (S.notifTiming[e.event] || 'Inmediato'); S.notifRules[e.event] = f['nr-to']; S.notifTiming[e.event] = f['nr-when']; S.notifCond = S.notifCond || {}; S.notifCond[e.event] = f['nr-cond']; Store.save(); Audit.log('Notificación', e.event, 'actualizar_regla', before, f['nr-to'] + ' · ' + f['nr-when']); UI.toast('Regla actualizada.'); App.go('#/admin/notificaciones/matriz'); } }] });
    });
  }
  const eventCode = (ev) => ({ 'Cotización enviada': 'cotizacion.enviada', 'Cotización aprobada': 'cotizacion.aprobada', 'Reserva confirmada': 'reserva.confirmada', 'Pago recibido': 'pago.recibido', 'Asignación': 'asignacion.creada', 'Cambio de horario': 'servicio.cambio_horario', 'Incidencia crítica': 'incidencia.critica', 'Voucher emitido': 'voucher.emitido', 'Inicio/fin de servicio': 'servicio.inicio', 'Cierre de viaje': 'viaje.cierre' })[ev] || 'evento';

  let tplEvent = 'Cotización enviada';
  let tplCh = 'email';
  function notifTemplates(b) {
    const S = DB.settings;
    if (!S.notifications.some(e => e.event === tplEvent)) tplEvent = S.notifications[0].event;
    b.innerHTML = '<div class="grid g-1-2"><div>' + UI.card('Eventos', '<div class="list adm-role-list">' + S.notifications.map(e => { const custom = CH_KEYS.some(c => S.templates[tplKey(e.event, c[0])]); return '<div class="list-item' + (e.event === tplEvent ? ' on' : '') + '" data-te="' + esc(e.event) + '"><div class="ico-box">' + ic('mail') + '</div><div class="grow"><div class="small" style="font-weight:600">' + esc(e.event) + '</div><div class="xs faint">' + CH_KEYS.filter(c => e[c[0]]).map(c => c[1]).join(' · ') + '</div></div>' + (custom ? '<span class="tag">editada</span>' : '') + '</div>'; }).join('') + '</div>', { tight: true }) + '</div><div id="tp-ed"></div></div>';
    b.querySelectorAll('[data-te]').forEach(x => x.onclick = () => { tplEvent = x.dataset.te; notifTemplates(b); UI.reveal(b.querySelector('#tp-ed')); });
    const ed = b.querySelector('#tp-ed');
    const t = getTpl(tplEvent, tplCh);
    ed.innerHTML = UI.card('Plantilla · ' + esc(tplEvent), '<div class="tabs pills" style="margin-bottom:14px">' + [['email', 'Email / Portal'], ['whatsapp', 'WhatsApp'], ['push', 'Push']].map(c => '<button class="tab' + (c[0] === tplCh ? ' on' : '') + '" data-tc="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
      UI.form([{ id: 'tp-subject', label: tplCh === 'push' ? 'Título' : 'Asunto', value: t.subject, col: 12, required: true }, { id: 'tp-body', label: 'Cuerpo', type: 'textarea', rows: tplCh === 'push' ? 3 : 8, value: t.body, col: 12, required: true }]) +
      '<div class="upper" style="margin:12px 0 6px">Variables disponibles (clic para insertar)</div><div class="chip-row">' + TPL_VARS.map(v => '<button class="tag tpl-var" type="button" data-var="' + v + '">' + v + '</button>').join('') + '</div>' +
      '<div id="tp-warn" style="margin-top:12px"></div><div class="upper" style="margin:14px 0 6px">Vista previa con datos de ejemplo</div><div class="tpl-prev" id="tp-prev"></div>' +
      '<div class="row between" style="margin-top:16px"><span class="xs faint">' + (t.version ? 'Versión ' + t.version + ' · ' + esc(t.updated || '') + ' · ' + esc(uName(t.by)) : 'Plantilla predeterminada del sistema') + '</span><span class="row" style="gap:6px"><button class="btn sm ghost" id="tp-reset">Restaurar predeterminada</button><button class="btn sm" id="tp-send">' + ic('send') + 'Enviarme prueba</button><button class="btn sm primary" id="tp-save">' + ic('check') + 'Guardar plantilla</button></span></div>', { sub: 'Canal: ' + (tplCh === 'email' ? 'Email / Portal' : tplCh === 'whatsapp' ? 'WhatsApp (plantilla sujeta a aprobación de Meta)' : 'Push (máx. 140 caracteres)') });
    const subj = ed.querySelector('#tp-subject'), body = ed.querySelector('#tp-body');
    let lastFocus = body;
    [subj, body].forEach(i => i.addEventListener('focus', () => { lastFocus = i; }));
    const unknown = () => [...(subj.value + ' ' + body.value).matchAll(/\{\{\s*[a-z_]+\s*\}\}/g)].map(m => m[0].replace(/\s/g, '')).filter(v => !TPL_VARS.includes(v));
    const prev = () => {
      ed.querySelector('#tp-prev').innerHTML = '<div class="sj">' + renderTpl(subj.value) + '</div>' + renderTpl(body.value);
      const u = unknown(); const over = tplCh === 'push' && body.value.length > 140;
      ed.querySelector('#tp-warn').innerHTML = (u.length ? UI.alert('bad', 'Variables no reconocidas: <span class="mono">' + esc(u.join(', ')) + '</span>. Solo se permiten las variables listadas.') : '') + (over ? UI.alert('warn', 'El cuerpo push supera 140 caracteres (' + body.value.length + ').') : '');
    };
    subj.oninput = prev; body.oninput = prev; prev();
    ed.querySelectorAll('[data-tc]').forEach(x => x.onclick = () => { tplCh = x.dataset.tc; notifTemplates(b); });
    ed.querySelectorAll('[data-var]').forEach(x => x.onclick = () => { const i = lastFocus; const s0 = i.selectionStart ?? i.value.length, e0 = i.selectionEnd ?? i.value.length; i.value = i.value.slice(0, s0) + x.dataset.var + i.value.slice(e0); i.focus(); i.selectionStart = i.selectionEnd = s0 + x.dataset.var.length; prev(); });
    ed.querySelector('#tp-save').onclick = () => {
      if (!UI.validate(ed)) return;
      if (unknown().length) { UI.toast('No se puede guardar: hay variables no reconocidas.', 'bad'); return; }
      if (tplCh === 'push' && body.value.length > 140) { UI.toast('Push: máximo 140 caracteres.', 'bad'); return; }
      const cur = getTpl(tplEvent, tplCh);
      if (cur.subject === subj.value && cur.body === body.value) { UI.toast('No hay cambios que guardar.', 'info'); return; }
      const v = (cur.version || 0) + 1;
      S.templates[tplKey(tplEvent, tplCh)] = { subject: subj.value, body: body.value, version: v, updated: nowStr(), by: Auth.user.id };
      Store.save(); Audit.log('Plantilla', tplEvent + ' · ' + tplCh, 'actualizar', 'v' + (cur.version || 0), 'v' + v);
      UI.toast('Plantilla guardada (versión ' + v + ').'); notifTemplates(b);
    };
    ed.querySelector('#tp-reset').onclick = () => {
      if (!S.templates[tplKey(tplEvent, tplCh)]) { UI.toast('La plantilla ya es la predeterminada.', 'info'); return; }
      UI.confirm({ title: 'Restaurar plantilla', message: 'Se descartará la versión personalizada de <b>' + esc(tplEvent) + '</b> (' + esc(tplCh) + ').', confirmLabel: 'Restaurar', onConfirm: () => { delete S.templates[tplKey(tplEvent, tplCh)]; Store.save(); Audit.log('Plantilla', tplEvent + ' · ' + tplCh, 'restaurar', 'personalizada', 'predeterminada'); UI.toast('Plantilla restaurada.'); notifTemplates(b); } });
    };
    ed.querySelector('#tp-send').onclick = () => {
      if (unknown().length) { UI.toast('Corrija las variables antes de enviar la prueba.', 'bad'); return; }
      const chName = tplCh === 'email' ? 'Email' : tplCh === 'whatsapp' ? 'WhatsApp' : 'Push';
      Notify.push(eventCode(tplEvent), chName, tplCh === 'email' ? Auth.user.email : tplCh === 'whatsapp' ? Auth.user.phone : Auth.user.id, '[Prueba] ' + subj.value.replace(/\{\{\s*[a-z_]+\s*\}\}/g, v => SAMPLE[v.replace(/\s/g, '')] || v));
      UI.toast('Prueba enviada por ' + chName + ' a su cuenta.');
    };
  }

  function notifLog(b) {
    const retry = (n) => {
      const wa = DB.integrations.find(i => i.id === 'INT-04');
      n.retries = (n.retries || 0) + 1;
      if (n.channel === 'WhatsApp' && wa && wa.status === 'sandbox' && /^\d/.test(n.to) && n.to !== Auth.user.phone) {
        n.status = 'fallido'; n.lastError = 'Código 131026: número no registrado en el entorno sandbox (error permanente)';
        Store.save(); Audit.log('Notificación', n.id, 'reintentar', 'fallido', 'fallido · intento ' + n.retries);
        DB.jobLog.unshift({ id: nextId(DB.jobLog, 'ERR-', 4), ts: nowStr(), source: 'Notificación', ref: n.id, target: 'WhatsApp Business API (sandbox)', error: n.lastError, cls: 'Permanente', attempt: n.retries, max: n.retries, nextRetry: '—', status: 'fallo_definitivo' }); Store.save();
        UI.toast('Reintento fallido: error permanente del canal WhatsApp (sandbox). Use "Canal alterno".', 'bad');
      } else {
        n.status = 'enviado'; n.lastError = ''; Store.save(); Audit.log('Notificación', n.id, 'reintentar', 'fallido', 'enviado · intento ' + n.retries);
        UI.toast('Notificación ' + esc(n.id) + ' reenviada correctamente.');
      }
    };
    const alt = (n) => { Notify.push(n.event, 'Email', Q.client && DB.clients.find(c => c.phone === n.to) ? DB.clients.find(c => c.phone === n.to).email : Auth.user.email, n.subject + ' (canal alterno)'); n.fallback = true; Store.save(); Audit.log('Notificación', n.id, 'canal_alterno', n.channel, 'Email'); UI.toast('Reenviado por Email como canal alterno.'); };
    const failedN = () => DB.notifications.filter(n => n.status === 'fallido').length;
    const dt = UI.dataTable(b, {
      exportName: 'notificaciones', rows: () => DB.notifications, pageSize: 12,
      search: ['id', 'event', 'to', 'subject', 'channel'], searchPlaceholder: 'Buscar evento, destinatario o asunto…',
      toolbar: '<button class="btn sm" id="nl-retry-all">' + ic('refresh') + 'Reintentar fallidos (' + failedN() + ')</button>',
      filters: [{ key: 'channel', label: 'Canal', options: ['Email', 'WhatsApp', 'Push', 'Portal'].map(x => [x, x]) }, { key: 'status', label: 'Estado', options: ['enviado', 'fallido'] }, { key: 'event', label: 'Evento', options: [...new Set(DB.notifications.map(n => n.event))].map(x => [x, x]) }],
      defaultSort: 'ts', defaultDir: -1,
      columns: [
        { key: 'ts', label: 'Fecha', render: n => '<span class="nowrap small">' + datetime(n.ts) + '</span>' },
        { key: 'event', label: 'Evento', render: n => '<span class="mono small">' + esc(n.event) + '</span>' },
        { key: 'channel', label: 'Canal' },
        { key: 'to', label: 'Destinatario', render: n => '<span class="small">' + esc(Q.user(n.to) ? Q.userName(n.to) : n.to) + '</span>' },
        { key: 'subject', label: 'Asunto', render: n => '<span class="small">' + esc(n.subject) + '</span>' },
        { key: 'status', label: 'Estado', render: n => UI.badge(n.status) + (n.fallback ? ' <span class="tag">alterno</span>' : '') },
        { key: 'retries', label: 'Reint.', align: 'num' },
        { key: '', label: '', sort: false, render: n => n.status === 'fallido' ? '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-rt="' + n.id + '">Reintentar</button>' + (n.channel !== 'Email' && !n.fallback ? '<button class="btn xs ghost" data-alt="' + n.id + '">Canal alterno</button>' : '') + '</span>' : '' }
      ],
      onRow: n => notifDrawer(n),
      afterDraw: (c) => {
        c.querySelectorAll('[data-rt]').forEach(x => x.onclick = () => { retry(DB.notifications.find(n => n.id === x.dataset.rt)); dt.redraw(); updBtn(); });
        c.querySelectorAll('[data-alt]').forEach(x => x.onclick = () => { alt(DB.notifications.find(n => n.id === x.dataset.alt)); dt.redraw(); updBtn(); });
      }
    });
    const updBtn = () => { const bt = b.querySelector('#nl-retry-all'); if (bt) bt.innerHTML = ic('refresh') + 'Reintentar fallidos (' + failedN() + ')'; };
    b.querySelector('#nl-retry-all').onclick = () => { const f = DB.notifications.filter(n => n.status === 'fallido'); if (!f.length) { UI.toast('No hay envíos fallidos.', 'info'); return; } f.forEach(retry); dt.redraw(); updBtn(); };
  }
  function notifDrawer(n) {
    const failed = n.status === 'fallido';
    const rule = DB.settings.notifications.find(e => eventCode(e.event) === n.event);
    UI.drawer({ title: 'Envío ' + esc(n.id), sub: esc(n.event) + ' · ' + esc(n.channel),
      body: UI.flow(['Evento', 'Regla', 'Plantilla', 'Canal', 'Envío', 'Estado', 'Reintento', 'Log'], failed ? 6 : 8, failed ? 5 : undefined) +
        '<div style="margin-top:14px">' + UI.dl([['Evento', '<span class="mono">' + esc(n.event) + '</span>'], ['Regla', rule ? esc(DB.settings.notifRules[rule.event] || '') : 'Evento de sistema'], ['Canal', esc(n.channel)], ['Destinatario', esc(Q.user(n.to) ? Q.userName(n.to) : n.to)], ['Asunto', esc(n.subject)], ['Fecha', datetime(n.ts)], ['Estado', UI.badge(n.status)], ['Reintentos', n.retries || 0], n.lastError ? ['Último error', '<span class="bad small">' + esc(n.lastError) + '</span>'] : null]) + '</div>' +
        (failed ? '<div style="margin-top:14px">' + UI.alert('warn', 'El fallo del canal no afecta la transacción de negocio que originó el evento (PROC-065). Puede reintentar o usar un canal alterno desde el log.') + '</div>' : '') });
  }

  /* =====================================================================
     ADMIN / INTEGRACIONES Y JOBS — PROC-064 / PROC-065 · §25–26
     ===================================================================== */
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTs = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const addMin = (ts, min) => { const d = Util.parseD(ts); d.setMinutes(d.getMinutes() + min); return fmtTs(d); };
  function nextRun(cron, from) {
    const base = Util.parseD(from || nowStr());
    let m;
    if ((m = /cada (\d+) min/.exec(cron))) return addMin(from || nowStr(), +m[1]);
    if (/cada hora/.test(cron)) return addMin(from || nowStr(), 60);
    if ((m = /cada (\d+) h/.exec(cron))) return addMin(from || nowStr(), +m[1] * 60);
    const hm = (/(\d{1,2}):(\d{2})/.exec(cron) || [0, 7, 0]);
    const d = new Date(base); d.setHours(+hm[1], +hm[2], 0, 0);
    if (/diario/.test(cron)) { if (d <= base) d.setDate(d.getDate() + 1); return fmtTs(d); }
    if (/lunes/.test(cron)) { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1); return fmtTs(d); }
    if (/viernes/.test(cron)) { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 5); return fmtTs(d); }
    if (/mensual/.test(cron)) { d.setMonth(d.getMonth() + 1, 1); return fmtTs(d); }
    return addMin(from || nowStr(), 60);
  }
  const INT_ICON = { Fiscal: 'receipt', Pagos: 'card', Email: 'mail', 'Mensajería': 'msg', Mapas: 'map', Proveedores: 'train', 'Distribución': 'globe' };
  const INT_IFACE = { Fiscal: 'FiscalDocumentProvider.emit(doc) · void(doc) · status(id)', Pagos: 'PaymentGateway.charge(req) · refund(id) · verifyWebhook(sig)', Email: 'MailSender.send(msg) · status(id)', 'Mensajería': 'MessagingChannel.sendTemplate(to, tpl, vars)', Mapas: 'GeoProvider.geocode(q) · route(a, b)', Proveedores: 'SupplierAdapter.availability(q) · book(req) · cancel(id)', 'Distribución': 'DistributionAdapter.pull(inv) · push(rates)' };

  App.register('admin/integraciones', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Integraciones y jobs');
    if (!Auth.can('admin.settings.manage') && !Auth.can('admin.tenant.manage')) return denied(el, 'Integraciones y jobs', crumbs, 'admin.settings.manage');
    const I = DB.integrations, J = DB.jobs;
    const openErr = DB.jobLog.filter(e => e.status !== 'resuelto');
    const SA = isSA();
    el.innerHTML = page(
      UI.pageHeader({ title: SA ? 'Integraciones y jobs de plataforma' : 'Integraciones y jobs', subtitle: (SA ? 'Contexto de plataforma (todos los tenants): ' : '') + 'adaptadores externos (PROC-064), scheduler de procesos programados y manejo de errores con reintentos y backoff (PROC-065).', crumbs,
        actions: Access.canRoute('admin/notificaciones') ? '<a class="btn" href="#/admin/notificaciones/log">' + ic('bell') + 'Log de notificaciones</a>' : '<a class="btn" href="#/admin/tenants">' + ic('server') + 'Consola de plataforma</a>' }) +
      (SA ? UI.alert('info', 'Vista de plataforma: estado técnico de adapters, colas y errores por tenant. Los resultados de jobs se muestran como conteos; el detalle de reservas, clientes o pagos permanece dentro de cada tenant.') + platformTenants() : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Integraciones activas', value: I.filter(i => i.status === 'activo').length + ' <span class="small faint">/ ' + I.length + '</span>', sub: I.filter(i => i.status === 'por_validar').length + ' por validar · ' + I.filter(i => i.status === 'sandbox').length + ' sandbox', tone: 'accent', icon: 'plug' }) +
        UI.kpi({ label: 'Jobs programados', value: J.length, sub: J.filter(j => j.status === 'ok').length + ' OK en última ejecución', tone: 'info', icon: 'clock' }) +
        UI.kpi({ label: 'Jobs con error o aviso', value: J.filter(j => ['error', 'advertencia'].includes(j.status)).length, sub: J.filter(j => j.paused).length + ' pausado(s)', tone: J.some(j => j.status === 'error') ? 'bad' : 'ok', icon: 'alert' }) +
        UI.kpi({ label: 'Errores abiertos', value: openErr.length, sub: openErr.filter(e => e.status === 'reintentando').length + ' en reintento con backoff', tone: openErr.length ? 'warn' : 'ok', icon: 'refresh' }) +
      '</div><div id="ig-tabs"></div>');
    const tabs = [
      { id: 'adapters', label: 'Integraciones', count: I.length, render: intTab },
      { id: 'jobs', label: 'Jobs y scheduler', count: J.length, render: jobsTab },
      { id: 'errores', label: 'Errores y reintentos', count: openErr.length, render: errTab }
    ];
    UI.tabs(el.querySelector('#ig-tabs'), tabs, tabs.some(t => t.id === params[0]) ? params[0] : 'adapters', { onChange: id => setHash('#/admin/integraciones/' + id) });
  });

  /* Salud de integraciones por tenant (Super Admin): solo metadatos técnicos, sin datos comerciales */
  function platformTenants() {
    const INTS = { Starter: ['Correo'], Professional: ['Correo', 'Pagos', 'WhatsApp'], Enterprise: ['Correo', 'Pagos', 'WhatsApp', 'OSE', 'Mapas', 'Proveedores'] };
    const rows = DB.tenants.map(t => { const cur = t.id === DB.tenant.id; const errs = cur ? DB.jobLog.filter(x => x.status !== 'resuelto').length : (t.status === 'suspendido' ? 0 : (t.users % 3 === 0 ? 1 : 0)); const jobs = cur ? DB.jobs.length : ({ Starter: 4, Professional: 7, Enterprise: 9 }[t.plan] || 4); return '<tr><td><div class="cell-main">' + esc(t.name) + '</div><div class="cell-sub mono">' + esc(t.id) + '</div></td><td><span class="tag">' + esc(t.plan) + '</span></td><td>' + UI.badge(t.status) + '</td><td class="small">' + (INTS[t.plan] || []).join(', ') + '</td><td class="num">' + (t.status === 'suspendido' ? '<span class="faint">pausados</span>' : jobs) + '</td><td class="num ' + (errs ? 'warn' : '') + '">' + errs + '</td><td class="small nowrap">' + (t.status === 'suspendido' ? '—' : datetime(window.TODAY + ' 0' + (6 + (t.users % 3)) + ':00')) + '</td></tr>'; }).join('');
    return UI.card('Salud por tenant', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Tenant</th><th>Plan</th><th>Estado</th><th>Integraciones habilitadas</th><th class="num">Jobs</th><th class="num">Errores abiertos</th><th>Último heartbeat</th></tr></thead><tbody>' + rows + '</tbody></table></div>', { tight: true, sub: 'Todos los tenants de la plataforma · el detalle de abajo corresponde al tenant ' + esc(DB.tenant.short) + ' (' + DB.tenant.id + ')' });
  }
  function intTab(b) {
    b.innerHTML = UI.card('Patrón adapter', '<div class="grid g2"><div><p class="small muted" style="margin-bottom:10px">El dominio nunca llama a un proveedor externo directamente: invoca una interfaz interna estable y un adaptador por proveedor traduce la solicitud, normaliza la respuesta y persiste el resultado. Cambiar de pasarela u OSE no altera cotizaciones, reservas ni finanzas.</p>' +
      UI.flow(['Solicitud / evento', 'Adapter', 'Proveedor', 'Respuesta', 'Normalización', 'Persistencia', 'Auditoría'], 7) +
      '<p class="xs faint" style="margin-top:8px">Regla PROC-064: no se inventan APIs, credenciales, costos ni límites. Las integraciones marcadas “Por validar” esperan definición contractual del cliente.</p></div>' +
      '<pre class="adm-log">' + Object.keys(INT_IFACE).map(k => '<span class="l-in">' + esc(k.padEnd(12)) + '</span> ' + esc(INT_IFACE[k])).join('\n') + '</pre></div>', { sub: 'Contratos internos por tipo de integración' }) +
      '<div class="grid g3" style="margin-top:16px">' + DB.integrations.map(i => {
        const lt = i.lastTest;
        return '<div class="card"><div class="card-b"><div class="row top" style="flex-wrap:nowrap"><div class="ico-box ' + (i.status === 'activo' ? 'ok' : i.status === 'futuro' ? '' : i.status === 'parcial' ? 'warn' : 'info') + '">' + ic(INT_ICON[i.kind] || 'plug') + '</div><div class="grow"><div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><b class="small">' + esc(i.name) + '</b>' + UI.badge(i.status) + '</div><div class="xs faint">' + esc(i.kind) + ' · <span class="mono">' + esc(i.id) + '</span>' + (i.cfg ? ' · ' + esc(i.cfg.env) : '') + '</div></div></div>' +
          '<p class="small muted" style="margin:10px 0">' + esc(i.note) + '</p>' +
          (lt ? '<div class="xs" style="margin-bottom:10px"><span class="' + (lt.ok ? 'ok' : 'warn') + '">' + ic(lt.ok ? 'checkCircle' : 'alert') + '</span> Última prueba ' + datetime(lt.ts) + ': ' + esc(lt.result) + '</div>' : '<div class="xs faint" style="margin-bottom:10px">Sin pruebas registradas en esta sesión.</div>') +
          '<div class="row" style="gap:6px"><button class="btn sm" data-it="' + i.id + '"' + (i.status === 'futuro' ? ' disabled title="Fase futura"' : '') + '>' + ic('zap') + 'Probar conexión</button><button class="btn sm ghost" data-ic="' + i.id + '"' + (i.status === 'futuro' ? ' disabled' : '') + '>' + ic('settings') + 'Configurar</button></div></div></div>';
      }).join('') + '</div>';
    b.querySelectorAll('[data-it]').forEach(x => x.onclick = () => testIntegration(DB.integrations.find(i => i.id === x.dataset.it), () => intTab(b)));
    b.querySelectorAll('[data-ic]').forEach(x => x.onclick = () => configIntegration(DB.integrations.find(i => i.id === x.dataset.ic), () => intTab(b)));
  }
  function testIntegration(i, done) {
    const corr = 'c-' + Math.random().toString(16).slice(2, 7);
    const ms = 120 + Math.floor(Math.random() * 260);
    let lines, ok, result;
    if (i.status === 'activo') { ok = true; result = 'OK · ' + ms + ' ms'; lines = ['→ Adapter ' + i.kind + ' · healthcheck', '→ Proveedor responde 200 en ' + ms + ' ms', '→ Normalización: esquema válido', '<span class="l-ok">✓ Conexión operativa</span>']; }
    else if (i.status === 'sandbox') { ok = true; result = 'OK en sandbox · ' + ms + ' ms'; lines = ['→ Adapter ' + i.kind + ' (entorno de pruebas)', '→ Proveedor responde 200 en ' + ms + ' ms', '<span class="l-warn">! Plantillas en aprobación: solo números registrados en sandbox</span>', '<span class="l-ok">✓ Conexión de prueba operativa</span>']; }
    else if (i.status === 'parcial') { ok = false; result = 'Parcial: 2 de 3 proveedores responden (tren: timeout)'; lines = ['→ SupplierAdapter hoteles ........ 200 · ' + ms + ' ms', '→ SupplierAdapter entradas ....... 200 · ' + (ms + 40) + ' ms', '<span class="l-bad">→ SupplierAdapter tren ........... timeout 30 s</span>', '<span class="l-warn">! Disponibilidad externa solo informativa: se confirma manualmente</span>']; DB.jobLog.unshift({ id: nextId(DB.jobLog, 'ERR-', 4), ts: nowStr(), source: 'Integración', ref: i.id, target: 'Adapter tren (Ferrovía Sur Andina)', error: 'Timeout 30 s en prueba de conexión', cls: 'Transitorio', attempt: 1, max: 5, nextRetry: addMin(nowStr(), 1), status: 'reintentando' }); }
    else { ok = false; result = 'No configurado: proveedor, contrato y API por definir'; lines = ['→ Adapter ' + i.kind + ' registrado sin proveedor asignado', '<span class="l-warn">! No se envían credenciales ficticias (regla PROC-064)</span>', '<span class="l-mute">Acción requerida: definir proveedor y contrato con el cliente</span>']; }
    i.lastTest = { ts: nowStr(), ok, result }; Store.save();
    Audit.log('Integración', i.id, 'probar_conexion', '', result);
    UI.modal({ title: 'Prueba de conexión — ' + esc(i.name), size: 'lg', body: '<pre class="adm-log"><span class="l-mute">[' + nowStr() + '] correlación ' + corr + '</span>\n' + lines.join('\n') + '</pre>', actions: [{ label: 'Cerrar', cls: 'primary' }] });
    UI.toast(esc(result), ok ? 'ok' : 'warn');
    done && done();
  }
  function configIntegration(i, done) {
    const c = i.cfg || { env: i.status === 'activo' ? 'Producción' : 'Sandbox', retries: 5, backoff: 60, timeout: 30, owner: 'U01' };
    UI.modal({ title: 'Configurar — ' + esc(i.name), sub: 'Las credenciales se gestionan en la bóveda de secretos del backend; nunca se muestran en pantalla.', body: UI.form([
      { id: 'ci-env', label: 'Entorno', type: 'select', options: ['Sandbox', 'Producción'], value: c.env, col: 6 },
      { id: 'ci-owner', label: 'Responsable', type: 'select', options: DB.users.filter(u => ['tenant_admin', 'manager', 'finance', 'operations'].includes(u.role) && u.status === 'activo').map(u => [u.id, u.name]), value: c.owner, col: 6 },
      { id: 'ci-retries', label: 'Reintentos máximos', type: 'number', min: 0, max: 10, value: c.retries, col: 4 },
      { id: 'ci-backoff', label: 'Backoff base (s)', type: 'number', min: 5, value: c.backoff, col: 4, hint: 'Exponencial: base × 2^intento' },
      { id: 'ci-timeout', label: 'Timeout (s)', type: 'number', min: 5, max: 120, value: c.timeout, col: 4 },
      { type: 'html', col: 12, html: '<div class="field"><label>Credenciales</label><div class="input" style="display:flex;align-items:center;color:var(--fg-3)">' + (i.status === 'activo' || i.status === 'sandbox' ? '•••••••• (almacenadas en bóveda · rotación cada 90 días)' : 'Pendiente de proveedor') + '</div></div>' }
    ]) + '<div id="ci-msg" style="margin-top:10px"></div>',
    actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
      const f = UI.formData(m);
      if (f['ci-env'] === 'Producción' && ['por_validar', 'futuro'].includes(i.status)) { m.querySelector('#ci-msg').innerHTML = UI.alert('bad', 'No se puede pasar a Producción una integración sin proveedor ni contrato validados (PROC-064).'); return false; }
      if (f['ci-env'] === 'Producción' && i.status === 'sandbox') { m.querySelector('#ci-msg').innerHTML = UI.alert('warn', 'WhatsApp requiere plantillas aprobadas antes de pasar a Producción. Se mantiene en Sandbox.'); return false; }
      const before = c.env + ' · ' + c.retries + ' reint.';
      i.cfg = { env: f['ci-env'], owner: f['ci-owner'], retries: Number(f['ci-retries']), backoff: Number(f['ci-backoff']), timeout: Number(f['ci-timeout']) };
      Store.save(); Audit.log('Integración', i.id, 'configurar', before, i.cfg.env + ' · ' + i.cfg.retries + ' reint. · backoff ' + i.cfg.backoff + ' s');
      UI.toast('Configuración de ' + esc(i.name) + ' guardada.'); done && done();
    } }] });
  }

  function runJob(j, after) {
    const prev = j.status;
    j.status = 'en_curso'; after && after();
    setTimeout(() => {
      let res = 'OK', st = 'ok';
      const T = window.TODAY;
      switch (j.id) {
        case 'JOB-01': res = 'Sin holds expirados en este ciclo'; break;
        case 'JOB-02': { const vq = DB.quotes.filter(q => ['enviada', 'vista', 'negociacion', 'borrador'].includes(q.status) && q.validUntil < T); vq.forEach(q => { Audit.log('Cotización', q.id, 'vencer', q.status, 'vencida (job)'); q.status = 'vencida'; }); res = vq.length + ' cotización(es) marcadas como vencidas'; break; }
        case 'JOB-03': { const days = DB.settings.ops.payReminderDays; const due = DB.receivables.filter(r => r.status !== 'pagada' && daysFromToday(r.due) <= days); due.forEach(r => { const c = Q.client(r.clientId); Notify.push('pago.recordatorio', 'Email', c ? c.email : r.clientId, 'Recordatorio de pago ' + r.id + ' — ' + money(r.amount - r.paid, r.currency)); }); res = due.length + ' recordatorio(s) de pago enviados por email'; break; }
        case 'JOB-04': { const n = DB.activities.filter(a => a.status !== 'completada' && a.due.slice(0, 10) <= T).length; res = n + ' recordatorio(s) de actividades'; break; }
        case 'JOB-05': { const h = DB.settings.ops.tripNoticeHours / 24; const rs = DB.reservations.filter(r => ['confirmada', 'pendiente_pago'].includes(r.status) && daysFromToday(r.travelFrom) >= 0 && daysFromToday(r.travelFrom) <= h); rs.forEach(r => { const c = Q.client(r.clientId); Notify.push('viaje.proximo', 'Email', c ? c.email : r.clientId, 'Su viaje ' + r.id + ' inicia el ' + date(r.travelFrom)); }); res = rs.length + ' cliente(s) notificados'; break; }
        case 'JOB-06': { const n = DB.reservations.flatMap(r => r.services).filter(s => ['solicitado', 'pendiente'].includes(s.status)).length; res = n + ' servicio(s) sin confirmar por proveedor'; if (n) st = 'advertencia'; break; }
        case 'JOB-07': {
          const e = DB.jobLog.find(x => x.ref === 'JOB-07' && x.status === 'reintentando');
          if (e) {
            e.attempt++;
            if (e.attempt >= e.max) { e.status = 'fallo_definitivo'; e.nextRetry = '—'; st = 'error'; res = 'Fallo definitivo tras ' + e.attempt + ' intentos: alerta enviada a Operaciones'; Notify.push('integracion.fallo', 'Email', 'khuaman@andeshorizonte.pe', 'Fallo definitivo: sincronización adapter tren (JOB-07)'); Audit.log('Job', j.id, 'fallo_definitivo', 'reintentando', 'alerta a Operaciones'); }
            else { const wait = Math.pow(2, e.attempt); e.nextRetry = addMin(nowStr(), wait); st = 'error'; res = 'Timeout adapter tren (backoff ' + e.attempt + '/' + e.max + ', próximo intento en ' + wait + ' min)'; }
            e.ts = nowStr();
          } else res = 'Sincronizado: 3 adapters, 0 errores';
          break;
        }
        case 'JOB-09': { const n = DB.operations.flatMap(o => o.assignments).filter(a => a.status === 'pendiente').length; res = n ? n + ' asignación(es) pendientes revisadas; ninguna expirada' : 'Sin cambios'; break; }
        default: {
          if (j.report || j.id === 'JOB-08') { const to = j.recipients || 'gerencia@andeshorizonte.pe'; String(to).split(',').map(s => s.trim()).filter(Boolean).forEach(r => Notify.push('reporte.programado', 'Email', r, (j.report ? 'Reporte ' + j.report : 'Reportes de gerencia') + ' (' + (j.format || 'PDF') + ')')); res = String(to).split(',').filter(Boolean).length + ' envío(s) de reporte generados'; DB.exports.unshift({ id: nextId(DB.exports, 'EXP-', 4), ts: nowStr(), report: j.report || 'Reportes de gerencia', format: j.format || 'PDF', rows: 0, size: '—', user: 'Sistema', status: 'disponible' }); }
        }
      }
      j.status = st; j.last = nowStr(); j.next = j.paused ? '—' : nextRun(j.cron); j.lastResult = res;
      Store.save(); Audit.log('Job', j.id, 'ejecutar_manual', prev, st + ' · ' + res);
      UI.toast(esc(j.name) + ': ' + esc(res), st === 'ok' ? 'ok' : st === 'advertencia' ? 'warn' : 'bad');
      after && after();
    }, 900);
  }
  function jobsTab(b) {
    b.innerHTML = UI.card('Scheduler', '<div class="row" style="gap:18px"><div class="grow small muted">Procesos asíncronos y programados del tenant (§25–26). Cada ejecución es idempotente, usa cola con reintentos y backoff exponencial y deja trazas de observabilidad. “Ejecutar ahora” encola una ejecución inmediata sin alterar la programación.</div><div class="mini-kv" style="min-width:320px"><div><span class="xs faint">Cola</span><b>0 pendientes</b></div><div><span class="xs faint">Workers</span><b>2 activos</b></div><div><span class="xs faint">Zona horaria</span><b style="font-size:.86rem">' + esc(DB.tenant.tz) + '</b></div></div></div>') + '<div id="jb-tbl" style="margin-top:16px"></div>';
    const dt = UI.dataTable(b.querySelector('#jb-tbl'), {
      exportName: 'jobs', rows: () => DB.jobs, pageSize: 15, search: ['id', 'name', 'cron', 'lastResult'], searchPlaceholder: 'Buscar job…',
      filters: [{ key: 'status', label: 'Estado', options: [['ok', 'OK'], ['advertencia', 'Advertencia'], ['error', 'Error']] }],
      columns: [
        { key: 'name', label: 'Job', render: j => '<div class="cell-main">' + esc(j.name) + '</div><div class="cell-sub"><span class="mono">' + esc(j.id) + '</span> · ' + esc(j.cron) + (j.report ? ' · creado desde Reportes' : '') + '</div>' },
        { key: 'last', label: 'Última ejecución', render: j => '<span class="small nowrap">' + (j.last && j.last !== '—' ? datetime(j.last) : '—') + '</span>' },
        { key: 'next', label: 'Próxima', render: j => '<span class="small nowrap">' + (j.paused ? '<span class="faint">Pausado</span>' : j.next && j.next !== '—' ? datetime(j.next) : '—') + '</span>' },
        { key: 'status', label: 'Estado', render: j => j.status === 'en_curso' ? UI.badge('en_curso', 'Ejecutando…') : UI.badge(j.status) + (j.paused ? ' ' + UI.badge('inactivo', 'Pausado') : '') },
        { key: 'lastResult', label: 'Resultado', render: j => '<span class="small">' + esc(j.lastResult || '—') + '</span>' },
        { key: '', label: '', sort: false, render: j => '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-run="' + j.id + '"' + (j.status === 'en_curso' ? ' disabled' : '') + '>' + ic('zap') + 'Ejecutar</button><button class="btn xs ghost" data-pause="' + j.id + '">' + (j.paused ? 'Reanudar' : 'Pausar') + '</button>' + (j.report ? '<button class="btn xs ghost icon" data-jdel="' + j.id + '" aria-label="Eliminar">' + ic('trash') + '</button>' : '') + '</span>' }
      ],
      afterDraw: (c) => {
        c.querySelectorAll('[data-run]').forEach(x => x.onclick = () => runJob(DB.jobs.find(j => j.id === x.dataset.run), () => dt.redraw()));
        c.querySelectorAll('[data-pause]').forEach(x => x.onclick = () => { const j = DB.jobs.find(y => y.id === x.dataset.pause); j.paused = !j.paused; j.next = j.paused ? '—' : nextRun(j.cron); Store.save(); Audit.log('Job', j.id, j.paused ? 'pausar' : 'reanudar', j.paused ? 'activo' : 'pausado', j.paused ? 'pausado' : 'activo'); UI.toast(esc(j.name) + (j.paused ? ' pausado.' : ' reanudado.')); dt.redraw(); });
        c.querySelectorAll('[data-jdel]').forEach(x => x.onclick = () => { const j = DB.jobs.find(y => y.id === x.dataset.jdel); UI.confirm({ title: 'Eliminar envío programado', danger: true, message: 'Se eliminará <b>' + esc(j.name) + '</b>. Los archivos ya generados se conservan.', confirmLabel: 'Eliminar', onConfirm: () => { DB.jobs.splice(DB.jobs.indexOf(j), 1); Store.save(); Audit.log('Job', j.id, 'eliminar', j.name, ''); UI.toast('Envío programado eliminado.'); dt.redraw(); } }); });
      }
    });
  }
  function errTab(b) {
    const stBadge = (s) => s === 'reintentando' ? UI.badge('en_proceso', 'Reintentando') : s === 'fallo_definitivo' ? UI.badge('fallido', 'Fallo definitivo') : UI.badge('resuelta', 'Resuelto');
    const refHref = (e) => e.source === 'Job' ? '#/admin/integraciones/jobs' : e.source === 'Notificación' && Access.canRoute('admin/notificaciones') ? '#/admin/notificaciones/log' : '#/admin/integraciones/adapters';
    b.innerHTML = '<div class="grid g-2-1">' + UI.card('Manejo de errores externos', UI.flow(['Error', 'Registrar', 'Clasificar', 'Reintentar', 'Backoff', 'Fallo definitivo', 'Alerta'], 7) + '<p class="small muted" style="margin-top:10px">Los errores <b>transitorios</b> (timeouts, 5xx, 429) se reintentan con backoff exponencial y jitter; los <b>permanentes</b> (4xx de validación, destinatario inválido) pasan directo a fallo definitivo y alerta. La transacción interna permanece consistente: una reserva no se revierte porque falle un correo o un adapter.</p>', { sub: 'PROC-065' }) +
      UI.card('Política de backoff', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Intento</th><th class="num">Espera</th></tr></thead><tbody>' + [1, 2, 3, 4, 5].map(n => '<tr><td>' + n + (n === 5 ? ' (último)' : '') + '</td><td class="num">' + Math.pow(2, n - 1) + ' min ± 20%</td></tr>').join('') + '</tbody></table></div><p class="xs faint" style="margin-top:8px">Tras el 5.º intento: fallo definitivo, alerta al responsable y registro en auditoría.</p>', { tight: false }) + '</div><div id="er-tbl" style="margin-top:16px"></div>';
    const dt = UI.dataTable(b.querySelector('#er-tbl'), {
      exportName: 'errores_integracion', rows: () => DB.jobLog, search: ['id', 'ref', 'target', 'error'], searchPlaceholder: 'Buscar error…',
      filters: [{ key: 'status', label: 'Estado', options: [['reintentando', 'Reintentando'], ['fallo_definitivo', 'Fallo definitivo'], ['resuelto', 'Resuelto']] }, { key: 'cls', label: 'Clase', options: [['Transitorio', 'Transitorio'], ['Permanente', 'Permanente']] }],
      columns: [
        { key: 'ts', label: 'Fecha', render: e => '<span class="small nowrap">' + datetime(e.ts) + '</span>' },
        { key: 'ref', label: 'Origen', render: e => '<div class="small">' + esc(e.source) + ' · <a class="mono" href="' + refHref(e) + '">' + esc(e.ref) + '</a></div><div class="cell-sub">' + esc(e.target) + '</div>' },
        { key: 'error', label: 'Error', render: e => '<span class="small">' + esc(e.error) + '</span>' },
        { key: 'cls', label: 'Clase', render: e => UI.badge(e.cls === 'Transitorio' ? 'media' : 'alta', e.cls) },
        { key: 'attempt', label: 'Intentos', render: e => '<div class="small num">' + e.attempt + ' / ' + e.max + '</div>' + UI.progress(e.attempt / e.max * 100, e.status === 'fallo_definitivo' ? 'bad' : e.status === 'resuelto' ? 'ok' : 'warn') },
        { key: 'nextRetry', label: 'Próximo intento', render: e => '<span class="small nowrap">' + (e.nextRetry && e.nextRetry !== '—' ? datetime(e.nextRetry) : '—') + '</span>' },
        { key: 'status', label: 'Estado', render: e => stBadge(e.status) },
        { key: '', label: '', sort: false, render: e => e.status === 'resuelto' ? '' : '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-er="' + e.id + '">Reintentar</button><button class="btn xs ghost" data-eok="' + e.id + '">Resolver</button></span>' }
      ],
      afterDraw: (c) => {
        c.querySelectorAll('[data-er]').forEach(x => x.onclick = () => {
          const e = DB.jobLog.find(y => y.id === x.dataset.er);
          if (e.ref === 'JOB-07') { if (e.status === 'fallo_definitivo') { e.status = 'reintentando'; e.attempt = 0; } runJob(DB.jobs.find(j => j.id === 'JOB-07'), () => dt.redraw()); return; }
          if (e.cls === 'Permanente') { e.attempt++; e.ts = nowStr(); Store.save(); Audit.log('Integración', e.ref, 'reintentar', 'fallo_definitivo', 'fallo_definitivo (error permanente)'); UI.toast('Error permanente: el reintento no cambia el resultado. Corrija el dato de origen o use un canal alterno.', 'bad'); dt.redraw(); return; }
          e.attempt++; e.status = 'resuelto'; e.nextRetry = '—'; e.ts = nowStr(); Store.save(); Audit.log('Integración', e.ref, 'reintentar', 'reintentando', 'resuelto en intento ' + e.attempt); UI.toast('Reintento exitoso: ' + esc(e.ref) + ' resuelto.'); dt.redraw();
        });
        c.querySelectorAll('[data-eok]').forEach(x => x.onclick = () => { const e = DB.jobLog.find(y => y.id === x.dataset.eok); UI.confirm({ title: 'Marcar como resuelto', reason: true, reasonLabel: 'Resolución aplicada', message: 'Se cerrará el error <b>' + esc(e.id) + '</b> (' + esc(e.target) + ').', confirmLabel: 'Resolver', onConfirm: (r) => { const b0 = e.status; e.status = 'resuelto'; e.nextRetry = '—'; e.resolution = r; Store.save(); Audit.log('Integración', e.ref, 'resolver_error', b0, 'resuelto · ' + r); UI.toast('Error marcado como resuelto.'); dt.redraw(); } }); });
      }
    });
  }

  /* =====================================================================
     ADMIN / AUDITORÍA — PROC-063
     ===================================================================== */
  App.register('admin/auditoria', (el, params) => {
    ensure();
    const crumbs = crumbsAdmin('Auditoría');
    if (!Auth.can('admin.audit.view')) return denied(el, 'Auditoría', crumbs, 'admin.audit.view');
    const SA = isSA();
    /* Super Admin: solo eventos de seguridad y operación de plataforma; los eventos de negocio quedan dentro del tenant */
    const A = SA ? DB.audit.filter(platformEvent) : DB.audit;
    const crit = A.filter(a => isCrit(a.action));
    const today = A.filter(a => a.ts.startsWith(window.TODAY));
    const deniedN = A.filter(a => /denegad/.test(a.action)).length;
    const byAct = Util.groupBy(crit, 'action');
    const byEnt = Util.groupBy(A, 'entity');
    const byUser = Util.groupBy(A, 'user');
    el.innerHTML = page(
      UI.pageHeader({ title: SA ? 'Auditoría de plataforma' : 'Auditoría', subtitle: SA ? 'Eventos de seguridad y operación de todos los tenants (sesiones, tenants, planes, jobs, integraciones, roles, exportaciones y accesos denegados). Append-only (PROC-063).' : 'Bitácora inmutable del tenant (append-only): actor, tenant, entidad, acción, estado anterior y nuevo, fecha/hora, IP y correlación (PROC-063).', crumbs,
        actions: '<button class="btn" id="au-exp">' + ic('download') + 'Exportar bitácora</button>' }) +
      (SA ? UI.alert('info', 'Contexto de plataforma: se muestran ' + A.length + ' de ' + DB.audit.length + ' eventos. Los eventos de negocio (reservas, clientes, cotizaciones, pagos) solo son visibles para el Tenant Admin de cada tenant.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Eventos registrados', value: fmtN(A.length, 0), sub: today.length + ' hoy', tone: 'accent', icon: 'history' }) +
        UI.kpi({ label: 'Acciones críticas', value: crit.length, sub: fmtN(A.length ? crit.length / A.length * 100 : 0, 0) + '% del total', tone: 'sun', icon: 'shield' }) +
        UI.kpi({ label: 'Accesos denegados', value: deniedN, sub: 'Incluye pruebas de aislamiento E2E-08', tone: deniedN ? 'bad' : 'ok', icon: 'lock' }) +
        UI.kpi({ label: 'Actores distintos', value: Object.keys(byUser).length, sub: 'Usuarios y procesos del sistema', tone: 'info', icon: 'users' }) +
      '</div>' +
      '<div class="grid g3">' +
        UI.card('Acciones críticas por tipo', Object.keys(byAct).length ? UI.chart.hbars({ items: Object.keys(byAct).map(k => ({ label: k.replace(/_/g, ' '), value: byAct[k].length })).sort((a, b) => b.value - a.value).slice(0, 7), color: 'var(--sun)' }) : UI.empty('Sin acciones críticas', 'shield')) +
        UI.card('Eventos por entidad', UI.chart.donut({ items: Object.keys(byEnt).map(k => ({ label: k, value: byEnt[k].length })).sort((a, b) => b.value - a.value).slice(0, 6), center: String(A.length), sub: 'eventos', size: 140 })) +
        UI.card('Actividad por actor', UI.chart.hbars({ items: Object.keys(byUser).map(k => ({ label: uName(k), value: byUser[k].length })).sort((a, b) => b.value - a.value).slice(0, 6) })) +
      '</div><div id="au-tbl"></div>');
    const users = [...new Set(A.map(a => a.user))];
    const tName = (a) => (DB.tenants.find(t => t.id === (a.tenant || DB.tenant.id)) || DB.tenant).name;
    const dt = UI.dataTable(el.querySelector('#au-tbl'), {
      exportName: 'auditoria', rows: () => SA ? DB.audit.filter(platformEvent) : DB.audit, pageSize: 15,
      search: a => [a.id, a.entity, a.entityId, a.action, a.before, a.after, uName(a.user), a.ip, a.corr].join(' '),
      searchPlaceholder: 'Buscar entidad, id, acción, IP o correlación…',
      filters: [
        { key: 'user', label: 'Usuario', options: users.map(u => [u, uName(u)]) },
        { key: 'entity', label: 'Entidad', options: Object.keys(byEnt).sort().map(k => [k, k]) },
        { key: 'action', label: 'Acción', options: [...new Set(A.map(a => a.action))].sort().map(k => [k, k.replace(/_/g, ' ')]) },
        { key: 'ts', label: 'Fecha', options: [['hoy', 'Hoy'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']], match: (a, v) => v === 'hoy' ? a.ts.startsWith(window.TODAY) : daysFromToday(a.ts.slice(0, 10)) >= -Number(v) },
        { key: 'crit', label: 'Criticidad', options: [['1', 'Solo críticas'], ['0', 'No críticas']], match: (a, v) => (isCrit(a.action) ? '1' : '0') === v }
      ].concat(SA ? [{ key: 'tenant', label: 'Tenant', options: DB.tenants.map(t => [t.id, t.name]), match: (a, v) => (a.tenant || DB.tenant.id) === v }] : []),
      columns: [
        { key: 'ts', label: 'Fecha / hora', render: a => '<span class="small nowrap">' + datetime(a.ts) + '</span>' }].concat(SA ? [{ key: 'tenant', label: 'Tenant', render: a => '<span class="small">' + esc(tName(a)) + '</span>', sortVal: tName }] : []).concat([
        { key: 'user', label: 'Actor', render: a => UI.userChip(a.user), sortVal: a => uName(a.user) },
        { key: 'entity', label: 'Entidad', render: a => '<div class="small">' + esc(a.entity) + '</div><div class="cell-sub">' + entLink(a.entity, a.entityId) + '</div>' },
        { key: 'action', label: 'Acción', render: a => isCrit(a.action) ? UI.badge('alta', a.action.replace(/_/g, ' ')) : UI.badge('mute', a.action.replace(/_/g, ' ')) },
        { key: 'before', label: 'Anterior → nuevo', render: a => '<span class="small"><span class="faint">' + esc(a.before || '∅') + '</span> → <b>' + esc(a.after || '∅') + '</b></span>' },
        { key: 'ip', label: 'IP', render: a => '<span class="mono xs">' + esc(a.ip) + '</span>' },
        { key: 'corr', label: 'Correlación', render: a => '<span class="mono xs">' + esc(a.corr) + '</span>' }
      ]),

      onRow: a => auditDrawer(a)
    });
    el.querySelector('#au-exp').onclick = () => {
      const rows = [['ID', 'Fecha', 'Actor', 'Tenant', 'Entidad', 'ID entidad', 'Acción', 'Anterior', 'Nuevo', 'IP', 'Correlación']].concat(A.map(a => [a.id, a.ts, uName(a.user), a.tenant || DB.tenant.id, a.entity, a.entityId, a.action, a.before, a.after, a.ip, a.corr]));
      exportJob({ report: 'Bitácora de auditoría', rows, perm: 'admin.audit.view' });
    };
    if (params[0]) { const a = A.find(x => x.id === params[0]); if (a) auditDrawer(a); }
  });
  function auditDrawer(a) {
    const related = DB.audit.filter(x => x !== a && (!isSA() || platformEvent(x)) && (x.corr === a.corr || (x.entity === a.entity && x.entityId === a.entityId))).slice(0, 8);
    const inc = a.entity === 'Incidencia' ? DB.incidents.find(i => i.id === a.entityId) : null;
    const href = entHref(a.entity, a.entityId);
    UI.drawer({ title: 'Evento ' + esc(a.id), sub: esc(a.entity) + ' · ' + esc(a.action.replace(/_/g, ' ')), wide: false,
      body: (isCrit(a.action) ? UI.alert('warn', '<b>Acción crítica</b> según PROC-063 (login, permisos, aprobación, rechazo, cancelación, reserva, pago, reversión, costo, facturación, asignación, incidencia y documentos).') : '') +
        '<div style="margin-top:10px">' + UI.dl([
          ['Actor', UI.userChip(a.user) + (Q.user(a.user) ? '<div class="xs faint" style="margin-top:3px">' + esc(Q.roleName(Q.user(a.user).role)) + '</div>' : '')],
          ['Tenant', esc(DB.tenant.name) + ' <span class="mono xs">' + esc(DB.tenant.id) + '</span>'],
          ['Entidad', esc(a.entity)], ['ID entidad', entLink(a.entity, a.entityId)],
          ['Acción', '<span class="mono">' + esc(a.action) + '</span>'],
          ['Estado anterior', '<span class="faint">' + esc(a.before || '∅') + '</span>'], ['Estado nuevo', '<b>' + esc(a.after || '∅') + '</b>'],
          ['Fecha / hora', datetime(a.ts) + ' <span class="xs faint">(' + esc(DB.tenant.tz) + ')</span>'],
          ['IP de origen', '<span class="mono">' + esc(a.ip) + '</span>'], ['Correlación', '<span class="mono">' + esc(a.corr) + '</span>'],
          ['Evidencia', inc && inc.evidence && inc.evidence.length ? inc.evidence.map(e => '<span class="tag">' + esc(e) + '</span>').join(' ') : 'Registro de la solicitud (payload firmado) conservado 5 años']
        ]) + '</div>' +
        '<div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:8px">Eventos relacionados (misma correlación o entidad)</div>' +
        (related.length ? '<div class="list">' + related.map(x => '<div class="list-item click" data-rel="' + x.id + '"><div class="ico-box ' + (isCrit(x.action) ? 'sun' : '') + '">' + ic('history') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(x.action.replace(/_/g, ' ')) + ' · ' + esc(x.entityId) + '</div><div class="xs faint">' + datetime(x.ts) + ' · ' + esc(uName(x.user)) + '</div></div></div>').join('') + '</div>' : UI.empty('Sin eventos relacionados', 'history')) +
        '<p class="xs faint" style="margin-top:14px">La bitácora es de solo inserción: ningún rol puede editar ni borrar eventos. Los accesos a la bitácora también se auditan.</p>',
      actions: href && Access.canRoute(href.replace(/^#\//, '')) ? [{ label: 'Ir a la entidad', icon: 'arrowRight', cls: 'primary', onClick: () => App.go(href) }] : [],
      onOpen: (d) => d.querySelectorAll('[data-rel]').forEach(x => x.onclick = () => auditDrawer(DB.audit.find(y => y.id === x.dataset.rel)))
    });
  }

  /* =====================================================================
     EXPORTACIÓN COMO JOB (PROC-061) — compartida por Reportes y Auditoría
     Solicitud → Permiso → Job → Procesar → Archivo → Disponible (→ Descarga → Auditoría)
     ===================================================================== */
  function exportJob({ report, rows, perm = 'reports.export' }) {
    const STEPS = ['Solicitud', 'Permiso', 'Job', 'Procesar', 'Archivo', 'Disponible'];
    const m = UI.modal({ title: 'Exportar — ' + esc(report), sub: 'PROC-061 · La exportación se procesa como job asíncrono y queda registrada en auditoría.', size: 'lg',
      body: UI.form([{ id: 'ex-fmt', label: 'Formato', type: 'select', options: [['CSV', 'CSV (separado por ;)'], ['XLSX', 'Excel (XLSX)'], ['PDF', 'PDF (documento)']], col: 4 }, { id: 'ex-scope', label: 'Alcance', type: 'select', options: ['Datos filtrados en pantalla', 'Incluir detalle por registro'], col: 5 }, { type: 'html', col: 3, html: '<div class="field"><label>Filas</label><div class="input" style="display:flex;align-items:center">' + Math.max(0, rows.length - 1) + '</div></div>' }]) +
        '<div style="margin-top:16px" id="ex-flow">' + UI.flow(STEPS, -1) + '</div><div style="margin-top:12px" id="ex-prog">' + UI.progress(0) + '<div class="row between xs faint" style="margin-top:6px"><span id="ex-st">Listo para generar</span><span id="ex-pct">0%</span></div></div><div id="ex-out" style="margin-top:14px"></div>',
      actions: [{ label: 'Cerrar' }, { label: 'Generar exportación', cls: 'primary', icon: 'download', close: false, onClick: (mm) => { start(mm); return false; } }] });
    let running = false;
    const start = (mm) => {
      if (running) return; running = true;
      const btn = mm.querySelector('.modal-f .btn.primary'); if (btn) btn.disabled = true;
      const fmt = mm.querySelector('#ex-fmt').value;
      const setStep = (i, pct, txt, fail) => { mm.querySelector('#ex-flow').innerHTML = UI.flow(STEPS, i, fail ? i : undefined); mm.querySelector('#ex-prog').firstElementChild.outerHTML = UI.progress(pct, fail ? 'bad' : pct >= 100 ? 'ok' : ''); mm.querySelector('#ex-st').textContent = txt; mm.querySelector('#ex-pct').textContent = Math.round(pct) + '%'; };
      const jobId = 'EXP-' + String(Math.max(0, ...DB.exports.map(e => parseInt(e.id.replace(/\D/g, ''), 10) || 0)) + 1).padStart(4, '0');
      setStep(0, 8, 'Solicitud registrada ' + jobId);
      setTimeout(() => {
        if (!Auth.can(perm)) {
          setStep(1, 16, 'Permiso denegado', true);
          mm.querySelector('#ex-out').innerHTML = UI.alert('bad', '<b>403 · Exportación denegada.</b> Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <span class="mono">' + esc(perm) + '</span>. El intento quedó registrado en auditoría.');
          Audit.log('Exportación', report, 'exportar_denegado', '', 'sin permiso ' + perm);
          return;
        }
        setStep(1, 22, 'Permiso ' + perm + ' verificado');
        setTimeout(() => {
          setStep(2, 34, 'Job ' + jobId + ' encolado');
          let pct = 34;
          const iv = setInterval(() => {
            pct += 9; if (!document.body.contains(mm)) { clearInterval(iv); return; }
            if (pct < 80) { setStep(3, pct, 'Procesando ' + Math.max(0, rows.length - 1) + ' filas…'); return; }
            clearInterval(iv);
            setStep(4, 90, 'Generando archivo ' + fmt + '…');
            setTimeout(() => {
              const csv = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\n');
              const kb = Math.max(1, Math.round(csv.length / 1024 * (fmt === 'PDF' ? 4.2 : fmt === 'XLSX' ? 0.6 : 1)));
              const fname = report.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + window.TODAY.replace(/-/g, '') + '.' + fmt.toLowerCase();
              DB.exports.unshift({ id: jobId, ts: nowStr(), report, format: fmt, rows: Math.max(0, rows.length - 1), size: kb + ' KB', user: Auth.user.id, status: 'disponible', file: fname });
              Store.save();
              Audit.log('Exportación', jobId, 'exportar', '', report + ' · ' + fmt + ' · ' + Math.max(0, rows.length - 1) + ' filas');
              Notify.push('exportacion.lista', 'Portal', Auth.user.id, 'Exportación disponible: ' + report + ' (' + fmt + ')');
              setStep(6, 100, 'Disponible para descarga · registrado en auditoría');
              mm.querySelector('#ex-out').innerHTML = '<div class="list-item" style="border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 12px"><div class="ico-box ok">' + ic('fileCheck') + '</div><div class="grow"><b class="small mono">' + esc(fname) + '</b><div class="xs faint">' + kb + ' KB · ' + Math.max(0, rows.length - 1) + ' filas · job ' + jobId + ' · disponible 7 días</div></div><button class="btn sm primary" id="ex-view">' + ic('eye') + 'Ver archivo</button></div>';
              mm.querySelector('#ex-view').onclick = () => {
                Audit.log('Exportación', jobId, 'descargar', '', fname);
                const box = mm.querySelector('#ex-out');
                if (box.querySelector('textarea')) return;
                box.insertAdjacentHTML('beforeend', '<p class="xs faint" style="margin:10px 0 6px">' + (fmt === 'CSV' ? 'Contenido del archivo:' : 'Vista previa de datos. En producción el archivo ' + fmt + ' se genera en el servidor y se descarga desde un enlace firmado.') + '</p><textarea class="input mono" rows="10" readonly>' + esc(csv) + '</textarea><div class="row end" style="margin-top:8px"><button class="btn sm" id="ex-copy">' + ic('copy') + 'Copiar</button></div>');
                box.querySelector('#ex-copy').onclick = () => UI.copy(csv);
              };
            }, 500);
          }, 260);
        }, 450);
      }, 450);
    };
    return m;
  }

  function scheduleReport(report) {
    if (!Auth.can('reports.export')) { UI.toast('Requiere permiso reports.export para programar envíos.', 'bad'); return; }
    UI.modal({ title: 'Programar envío — ' + esc(report), sub: 'Crea un job en el scheduler que genera y envía el reporte automáticamente.', body: UI.form([
      { id: 'sc-freq', label: 'Frecuencia', type: 'select', options: [['diario', 'Diario'], ['lunes', 'Semanal (lunes)'], ['viernes', 'Semanal (viernes)'], ['mensual', 'Mensual (día 1)']], value: 'lunes', col: 4 },
      { id: 'sc-time', label: 'Hora', type: 'time', value: '07:00', col: 4, required: true },
      { id: 'sc-fmt', label: 'Formato', type: 'select', options: ['PDF', 'XLSX', 'CSV'], col: 4 },
      { id: 'sc-to', label: 'Destinatarios (separados por coma)', required: true, value: Auth.user.email + ', ' + (Q.user('U02') || {}).email, col: 12 }
    ]), actions: [{ label: 'Cancelar' }, { label: 'Programar', cls: 'primary', icon: 'clock', onClick: (m) => {
      if (!UI.validate(m)) return false;
      const f = UI.formData(m);
      const bad = f['sc-to'].split(',').map(s => s.trim()).filter(s => s && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s));
      if (bad.length) { UI.toast('Correo inválido: ' + esc(bad.join(', ')), 'bad'); return false; }
      const cron = (f['sc-freq'] === 'mensual' ? 'mensual día 1 ' : f['sc-freq'] + ' ') + f['sc-time'];
      const id = nextId(DB.jobs, 'JOB-', 2);
      const j = { id, name: 'Reporte programado: ' + report, cron, last: '—', next: nextRun(cron), status: 'ok', lastResult: 'Programado — pendiente de primera ejecución', report, format: f['sc-fmt'], recipients: f['sc-to'], owner: Auth.user.id };
      DB.jobs.push(j); Store.save();
      Audit.log('Job', id, 'programar', '', report + ' · ' + cron + ' · ' + f['sc-fmt']);
      UI.toast('Envío programado (' + esc(id) + '). Próxima ejecución: ' + datetime(j.next) + '. <a href="#/admin/integraciones/jobs">Ver en scheduler</a>');
    } }] });
  }

  /* =====================================================================
     REPORTES Y KPIs — PROC-060 (Datos → Read model → KPI → Dashboard → Filtro → Exportación → Auditoría)
     ===================================================================== */
  const PERIODS = {
    set: { label: 'Setiembre 2026', from: '2026-09-01', idx: [5] },
    q3: { label: 'Jul – Set 2026 (T3)', from: '2026-07-01', idx: [3, 4, 5] },
    '6m': { label: 'Abr – Set 2026 (6 meses)', from: '2026-04-01', idx: [0, 1, 2, 3, 4, 5] },
    all: { label: 'Todo el historial', from: '2000-01-01', idx: [0, 1, 2, 3, 4, 5] }
  };
  const RS = { period: '6m', sede: '' };
  const arrSum = (a) => a.reduce((x, y) => x + (Number(y) || 0), 0);
  const pct = (a, b) => b ? a / b * 100 : 0;
  const pctS = (a, b) => fmtN(pct(a, b), 1) + '%';
  const kS = (v) => 'S/ ' + (Math.abs(v) >= 1e6 ? fmtN(v / 1e6, 2) + 'M' : Math.abs(v) >= 1000 ? fmtN(v / 1000, 1) + 'k' : fmtN(v, 0));
  const hoursBetween = (a, b) => (Util.parseD(b) - Util.parseD(a)) / 3600000;
  const resPEN = (r) => toPEN(r.total, r.currency);
  const resCostPEN = (r) => toPEN(Q.resCost(r), r.currency);
  const qTotal = (q) => { const v = q.versions.find(x => x.v === q.currentVersion) || q.versions[q.versions.length - 1]; return Pricing.quoteTotals(v); };
  const ownerSede = (id) => (Q.user(id) || {}).sede;
  const resDest = (r) => { const s = r.services.find(x => x.productId && Q.product(x.productId)); const p = s ? Q.product(s.productId) : null; return p ? Q.destName(p.destId) : '—'; };
  const noData = (msg) => UI.empty(msg || 'Sin datos para el periodo y sede seleccionados.', 'chart');

  function ctx() {
    const P = PERIODS[RS.period]; const inP = (d) => !!d && String(d).slice(0, 10) >= P.from && String(d).slice(0, 10) <= '2026-12-31';
    const own = Scope.ownOnly(); const me = Auth.user.id;
    const bySede = (owner, sede) => (!own || owner === me) && (!RS.sede || (sede ? sede === RS.sede : ownerSede(owner) === RS.sede));
    const M = DB.monthly;
    /* Ventas (mi cartera): las series mensuales se recalculan con sus propios registros en lugar del read model del tenant */
    const monthOf = (d) => { const s = String(d || ''); return s.slice(0, 4) === '2026' ? +s.slice(5, 7) - 4 : -1; };
    const mine = { leads: DB.leads.filter(l => l.owner === me), quotes: DB.quotes.filter(q => q.owner === me), reservations: DB.reservations.filter(r => r.owner === me) };
    return {
      P, M, own, idx: P.idx, labels: P.idx.map(i => M.labels[i]), ser: (k) => own && mine[k] ? P.idx.map(i => mine[k].filter(x => monthOf(x.createdAt) === i).length) : P.idx.map(i => M[k][i]),
      leads: DB.leads.filter(l => inP(l.createdAt) && bySede(l.owner)),
      opps: DB.opportunities.filter(o => inP(o.createdAt) && bySede(o.owner)),
      quotes: DB.quotes.filter(q => inP(q.createdAt) && bySede(q.owner)),
      res: DB.reservations.filter(r => inP(r.createdAt) && bySede(r.owner, r.sede)),
      clients: DB.clients.filter(c => bySede(c.owner))
    };
  }

  App.register('reportes', (el, params) => {
    ensure();
    const crumbs = [['Inicio', '#/dashboard'], ['Inteligencia'], ['Reportes y KPIs']];
    if (!Auth.can('reports.view')) return denied(el, 'Reportes y KPIs', crumbs, 'reports.view');
    const canExp = Auth.can('reports.export');
    const allowed = repTabsFor(Auth.role);
    const scopeTxt = { sales: 'Mi cartera: solo sus leads, oportunidades, cotizaciones y reservas.', operations: 'Operación: reservas, servicios, incidencias y proveedores (sin márgenes ni utilidad).', finance: 'Finanzas: ventas, costos, rentabilidad y cartera por cobrar.', accounting: 'Contabilidad: ventas, cartera por cobrar y facturación (sin márgenes).' }[Auth.role];
    el.innerHTML = page(
      UI.pageHeader({ title: 'Reportes y KPIs', subtitle: 'Centro de reportes del tenant alimentado por modelos de lectura (read models). Cifras en soles al TC ' + DB.settings.fx + '.', crumbs,
        actions: canExp ? '<button class="btn" id="rp-hist">' + ic('history') + 'Exportaciones (' + DB.exports.length + ')</button>' : '' }) +
      (scopeTxt ? UI.alert('info', '<b>Reportes según su rol (' + esc(Q.roleName(Auth.role)) + '):</b> ' + esc(scopeTxt)) : '') +
      (canExp ? '' : UI.alert('warn', 'Puede consultar reportes pero no exportarlos ni programar envíos: requiere el permiso <span class="mono">reports.export</span>.')) +
      '<div class="card"><div class="card-b" style="padding:12px 16px"><div class="rep-filters"><span class="upper" style="margin-right:4px">Filtros</span>' +
        '<select class="input sm" id="rp-period" aria-label="Periodo">' + Object.keys(PERIODS).map(k => '<option value="' + k + '"' + (RS.period === k ? ' selected' : '') + '>' + esc(PERIODS[k].label) + '</option>').join('') + '</select>' +
        '<select class="input sm" id="rp-sede" aria-label="Sede"><option value="">Todas las sedes</option>' + DB.sedes.map(s => '<option value="' + s.id + '"' + (RS.sede === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>' +
        '<span class="grow"></span><span class="xs faint">Datos → Read model → KPI → Dashboard → Filtro → Exportación → Auditoría</span></div></div></div>' +
      '<div id="rp-tabs"></div>');
    const TABS = [
      { id: 'comercial', label: 'Comercial / CRM', name: 'Comercial y CRM', render: repComercial },
      { id: 'cotizaciones', label: 'Cotizaciones', name: 'Cotizaciones', render: repCotizaciones },
      { id: 'reservas', label: 'Reservas', name: 'Reservas', render: repReservas },
      { id: 'operaciones', label: 'Operaciones', name: 'Operaciones', render: repOperaciones },
      { id: 'finanzas', label: 'Finanzas y rentabilidad', name: 'Finanzas y rentabilidad', render: repFinanzas },
      { id: 'proveedores', label: 'Proveedores', name: 'Proveedores', render: repProveedores },
      { id: 'clientes', label: 'Clientes', name: 'Clientes', render: repClientes }
    ].filter(t => allowed.includes(t.id));
    const tabs = UI.tabs(el.querySelector('#rp-tabs'), TABS.map(t => ({ id: t.id, label: t.label, render: (b) => { const c = ctx(); const out = t.render(b, c, t.name); bindRepActions(b, t.name, out); } })), TABS.some(t => t.id === params[0]) ? params[0] : TABS[0].id, { onChange: id => setHash('#/reportes/' + id) });
    el.querySelector('#rp-period').onchange = (e) => { RS.period = e.target.value; tabs.show(tabs.current); UI.toast('Periodo: ' + esc(PERIODS[RS.period].label), 'info'); };
    el.querySelector('#rp-sede').onchange = (e) => { RS.sede = e.target.value; tabs.show(tabs.current); };
    const hb = el.querySelector('#rp-hist'); if (hb) hb.onclick = () => exportsDrawer();
    if (params[0] && !TABS.some(t => t.id === params[0]) && ['comercial', 'cotizaciones', 'reservas', 'operaciones', 'finanzas', 'proveedores', 'clientes'].includes(params[0])) UI.toast('El reporte solicitado no está disponible para su rol.', 'bad');
  });
  /* Pestañas de reportes por rol (roles base); roles personalizados: según permisos */
  function repTabsFor(role) {
    const BY = { sales: ['comercial', 'cotizaciones'], operations: ['reservas', 'operaciones', 'proveedores'], finance: ['finanzas'], accounting: ['finanzas'] };
    if (BY[role]) return BY[role];
    if (['tenant_admin', 'manager'].includes(role)) return ['comercial', 'cotizaciones', 'reservas', 'operaciones', 'finanzas', 'proveedores', 'clientes'];
    const c = (p) => Auth.can(p);
    return [c('crm.leads.view') && 'comercial', c('quotes.view') && 'cotizaciones', c('reservations.view') && 'reservas', c('operations.view') && 'operaciones', (c('finance.receivables') || c('finance.profitability')) && 'finanzas', (c('catalog.providers.manage') || c('finance.payables')) && 'proveedores', c('crm.clients.manage') && 'clientes'].filter(Boolean);
  }
  const rlk = (route, id, html, cls) => Access.canRoute(route) ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="#/' + route + '/' + id + '">' + html + '</a>' : '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</span>';
  const goIf = (route, id) => { if (Access.canRoute(route)) App.go('#/' + route + '/' + id); };

  function repHead(desc, name) {
    const canExp = Auth.can('reports.export');
    return '<div class="row between" style="margin-bottom:14px"><div class="small muted grow" style="min-width:240px">' + desc + '</div>' + (canExp ? '<div class="row" style="gap:6px"><button class="btn sm" data-rsch>' + ic('clock') + 'Programar envío</button><button class="btn sm primary" data-rexp>' + ic('download') + 'Exportar</button></div>' : '<button class="btn sm" disabled title="Requiere permiso reports.export">' + ic('lock') + 'Exportar</button>') + '</div>';
  }
  function bindRepActions(b, name, rowsFn) {
    const ex = b.querySelector('[data-rexp]'); if (ex) ex.onclick = () => exportJob({ report: name + ' · ' + PERIODS[RS.period].label + (RS.sede ? ' · ' + Q.sedeName(RS.sede) : ''), rows: rowsFn ? rowsFn() : [['Sin datos']] });
    const sc = b.querySelector('[data-rsch]'); if (sc) sc.onclick = () => scheduleReport(name);
  }
  const miniKpis = (items) => '<div class="grid g5" style="margin-bottom:16px">' + items.map(k => UI.kpi(k)).join('') + '</div>';
  function repTable(container, name, cfg) {
    const dt = UI.dataTable(container, Object.assign({ exportName: name, pageSize: 10 }, cfg));
    const btn = container.querySelector('[data-export]');
    const cols = cfg.columns.filter(c => c.label);
    const rowsOut = () => [cols.map(c => c.label)].concat((typeof cfg.rows === 'function' ? cfg.rows() : cfg.rows).map(r => cols.map(c => c.x ? c.x(r) : (r[c.key] == null ? '' : r[c.key]))));
    if (btn) { btn.onclick = () => exportJob({ report: name, rows: rowsOut() }); if (!Auth.can('reports.export')) { btn.title = 'Requiere permiso reports.export'; btn.innerHTML = ic('lock') + 'Exportar'; btn.disabled = true; } }
    return rowsOut;
  }

  /* ---------- 1. Comercial / CRM ---------- */
  function repComercial(b, c, name) {
    const leadsN = c.own ? c.leads.length : arrSum(c.ser('leads'));
    const conv = c.own ? pct(c.res.filter(r => r.status !== 'cancelada').length, c.leads.length) : arrSum(c.ser('conversion')) / c.idx.length;
    const open = c.opps.filter(o => !['ganada', 'perdida'].includes(o.stage));
    const won = c.opps.filter(o => o.stage === 'ganada'), lost = c.opps.filter(o => o.stage === 'perdida');
    const wonAmt = sum(won, o => toPEN(o.amount, o.currency));
    const sources = Util.groupBy(c.leads, 'source');
    const sellers = c.own ? [Auth.user] : DB.users.filter(u => ['sales', 'manager'].includes(u.role) && (!RS.sede || u.sede === RS.sede));
    const perf = sellers.map(u => {
      const os = c.opps.filter(o => o.owner === u.id); const qs = c.quotes.filter(q => q.owner === u.id); const rs = c.res.filter(r => r.owner === u.id);
      const w = os.filter(o => o.stage === 'ganada'), l = os.filter(o => o.stage === 'perdida');
      return { id: u.id, name: u.name, opps: os.length, pipe: sum(os.filter(o => !['ganada', 'perdida'].includes(o.stage)), o => toPEN(o.amount, o.currency)), won: sum(w, o => toPEN(o.amount, o.currency)), win: w.length + l.length ? w.length / (w.length + l.length) * 100 : 0, quotes: qs.length, approved: qs.filter(q => ['aprobada', 'convertida'].includes(q.status)).length, res: rs.length, sales: sum(rs, resPEN), status: u.status };
    });
    const funnel = [['Leads', c.leads.length, 'var(--info)'], ['Calificados / convertidos', c.leads.filter(l => ['calificado', 'convertido'].includes(l.status)).length, 'var(--accent)'], ['Oportunidades', c.opps.length, 'var(--violet)'], ['Cotizaciones', c.quotes.length, 'var(--sun)'], ['Aprobadas', c.quotes.filter(q => ['aprobada', 'convertida'].includes(q.status)).length, 'var(--ok)'], ['Reservas', c.res.filter(r => r.status !== 'cancelada').length, 'var(--ok)']];
    const top = Math.max(1, funnel[0][1]);
    b.innerHTML = repHead('Embudo, conversión por fuente de lead y desempeño por vendedor. Fuente: leads, oportunidades, cotizaciones y reservas.', name) +
      miniKpis([
        { label: c.own ? 'Mis leads' : 'Leads recibidos', value: fmtN(leadsN, 0), sub: c.own ? 'Asignados a usted en el periodo' : c.leads.length + ' en CRM (detalle)', tone: 'info', icon: 'funnel' },
        { label: 'Conversión lead → reserva', value: fmtN(conv, 1) + '%', sub: 'Promedio del periodo', tone: 'accent', icon: 'percent' },
        { label: 'Pipeline abierto', value: kS(sum(open, o => toPEN(o.amount, o.currency))), sub: open.length + ' oportunidades', tone: 'violet', icon: 'target' },
        { label: 'Win rate', value: pctS(won.length, won.length + lost.length), sub: won.length + ' ganadas · ' + lost.length + ' perdidas', tone: 'ok', icon: 'award' },
        { label: 'Ticket promedio ganado', value: kS(won.length ? wonAmt / won.length : 0), sub: 'Monto ganado ' + kS(wonAmt), tone: 'sun', icon: 'coins' }
      ]) +
      '<div class="grid g-2-1">' +
        UI.card('Leads, cotizaciones y reservas', UI.chart.line({ labels: c.labels, series: [{ name: 'Leads', values: c.ser('leads') }, { name: 'Cotizaciones', values: c.ser('quotes'), color: 'var(--violet)' }, { name: 'Reservas', values: c.ser('reservations'), color: 'var(--sun)' }] }), { sub: c.own ? 'Mis registros por mes' : 'Volumen mensual consolidado del tenant' }) +
        UI.card('Embudo comercial', c.leads.length || c.opps.length ? UI.chart.hbars({ items: funnel.map(f => ({ label: f[0], value: f[1], color: f[2], display: String(f[1]) })) }) : noData(), { sub: 'Registros del periodo' }) +
      '</div>' +
      '<div class="grid g2">' +
        UI.card('Conversión por fuente de lead', Object.keys(sources).length ? UI.chart.hbars({ items: Object.keys(sources).map(k => { const n = sources[k].length, cv = sources[k].filter(l => l.status === 'convertido').length, q = sources[k].filter(l => ['calificado', 'convertido'].includes(l.status)).length; return { label: k, value: n, display: n + ' leads · ' + q + ' calif. · ' + pctS(cv, n) + ' conv.' }; }).sort((a, b) => b.value - a.value) }) : noData(), { sub: 'Leads, calificados y convertidos por fuente' }) +
        UI.card(c.own ? 'Mis ventas' : 'Ventas por vendedor', perf.some(p => p.sales || p.won) ? UI.chart.bars({ labels: perf.map(p => p.name.split(' ')[0]), series: [{ name: 'Reservas (S/)', values: perf.map(p => Math.round(p.sales)) }, { name: 'Oport. ganadas (S/)', values: perf.map(p => Math.round(p.won)), color: 'var(--ok)' }], fmt: v => 'S/ ' + fmtN(v, 0) }) : noData(), { sub: 'Montos en soles' }) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + (c.own ? ' — mi desempeño' : ' — desempeño por vendedor'), {
      rows: perf, search: ['name'], searchPlaceholder: 'Buscar vendedor…', defaultSort: 'sales', defaultDir: -1,
      columns: [
        { key: 'name', label: 'Vendedor', render: p => UI.userChip(p.id) + (p.status !== 'activo' ? ' ' + UI.badge(p.status) : ''), x: p => p.name },
        { key: 'opps', label: 'Oport.', align: 'num' },
        { key: 'pipe', label: 'Pipeline abierto', align: 'num', render: p => money(p.pipe, 'PEN', 0), x: p => p.pipe.toFixed(2) },
        { key: 'won', label: 'Ganado', align: 'num', render: p => money(p.won, 'PEN', 0), x: p => p.won.toFixed(2) },
        { key: 'win', label: 'Win rate', align: 'num', render: p => fmtN(p.win, 0) + '%', x: p => p.win.toFixed(1) },
        { key: 'quotes', label: 'Cotiz.', align: 'num' },
        { key: 'approved', label: 'Aprob.', align: 'num' },
        { key: 'res', label: 'Reservas', align: 'num' },
        { key: 'sales', label: 'Ventas', align: 'num', render: p => money(p.sales, 'PEN', 0), x: p => p.sales.toFixed(2) }
      ],
      footer: rows => '<tr><td><b>Total</b></td><td class="num"><b>' + sum(rows, 'opps') + '</b></td><td class="num"><b>' + money(sum(rows, 'pipe'), 'PEN', 0) + '</b></td><td class="num"><b>' + money(sum(rows, 'won'), 'PEN', 0) + '</b></td><td></td><td class="num"><b>' + sum(rows, 'quotes') + '</b></td><td class="num"><b>' + sum(rows, 'approved') + '</b></td><td class="num"><b>' + sum(rows, 'res') + '</b></td><td class="num"><b>' + money(sum(rows, 'sales'), 'PEN', 0) + '</b></td></tr>'
    });
  }

  /* ---------- 2. Cotizaciones ---------- */
  function repCotizaciones(b, c, name) {
    const Qs = c.quotes;
    const decided = Qs.filter(q => ['aprobada', 'convertida', 'rechazada', 'vencida'].includes(q.status));
    const appr = Qs.filter(q => ['aprobada', 'convertida'].includes(q.status));
    const viewed = Qs.filter(q => q.viewedAt);
    const hView = viewed.map(q => hoursBetween(q.createdAt, q.viewedAt));
    const dAppr = appr.filter(q => q.approvedAt).map(q => hoursBetween(q.createdAt, q.approvedAt) / 24);
    const byStatus = Util.groupBy(Qs, 'status');
    const reasons = {};
    Qs.filter(q => q.status === 'rechazada').forEach(q => { const k = (q.rejectedReason || 'Sin motivo').split(':')[0]; reasons[k] = (reasons[k] || 0) + 1; });
    Qs.filter(q => q.status === 'vencida').forEach(() => { reasons['Sin respuesta (vencida)'] = (reasons['Sin respuesta (vencida)'] || 0) + 1; });
    c.opps.filter(o => o.stage === 'perdida' && o.lostReason && !Qs.some(q => q.oppId === o.id && q.status === 'rechazada')).forEach(o => { const k = o.lostReason.split(':')[0]; reasons[k] = (reasons[k] || 0) + 1; });
    const rows = Qs.map(q => { const t = qTotal(q); return { q, id: q.id, client: Q.clientName(q.clientId), owner: q.owner, status: q.status, versions: q.versions.length, total: toPEN(t.total, q.currency), margin: t.marginPct, created: q.createdAt, hView: q.viewedAt ? hoursBetween(q.createdAt, q.viewedAt) : null, valid: q.validUntil }; });
    b.innerHTML = repHead('Tasa de aprobación, tiempos de respuesta del cliente y motivos de rechazo. Valores de la versión vigente de cada cotización.', name) +
      miniKpis([
        { label: 'Cotizaciones emitidas', value: Qs.length, sub: sum(Qs, q => q.versions.length) + ' versiones', tone: 'accent', icon: 'file' },
        { label: 'Tasa de aprobación', value: pctS(appr.length, decided.length), sub: appr.length + ' de ' + decided.length + ' decididas', tone: 'ok', icon: 'fileCheck' },
        { label: 'Tiempo a primera vista', value: hView.length ? fmtN(arrSum(hView) / hView.length, 0) + ' h' : '—', sub: viewed.length + ' vistas por el cliente', tone: 'info', icon: 'eye' },
        { label: 'Ciclo hasta aprobación', value: dAppr.length ? fmtN(arrSum(dAppr) / dAppr.length, 0) + ' días' : '—', sub: 'Desde la creación', tone: 'violet', icon: 'clock' },
        { label: 'Valor cotizado', value: kS(sum(rows, 'total')), sub: 'Margen medio ' + fmtN(rows.length ? sum(rows, 'margin') / rows.length : 0, 1) + '%', tone: 'sun', icon: 'coins' }
      ]) +
      '<div class="grid g3">' +
        UI.card('Estado de las cotizaciones', Qs.length ? UI.chart.donut({ items: Object.keys(byStatus).map(k => ({ label: UI.statusLabel(k), value: byStatus[k].length })), center: String(Qs.length), sub: 'cotizaciones', size: 140 }) : noData()) +
        UI.card('Motivos de rechazo o pérdida', Object.keys(reasons).length ? UI.chart.hbars({ items: Object.keys(reasons).map(k => ({ label: k, value: reasons[k] })).sort((a, b) => b.value - a.value), color: 'var(--bad)' }) : noData('Sin rechazos en el periodo.')) +
        UI.card('Horas hasta que el cliente la abre', viewed.length ? UI.chart.hbars({ items: viewed.map(q => ({ label: q.id.replace('COT-2026-', 'COT-'), value: Math.max(0, hoursBetween(q.createdAt, q.viewedAt)), display: fmtN(hoursBetween(q.createdAt, q.viewedAt), 0) + ' h' })).sort((a, b) => a.value - b.value).slice(0, 7), color: 'var(--info)' }) : noData()) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — detalle', {
      rows, search: ['id', 'client'], searchPlaceholder: 'Buscar cotización o cliente…', defaultSort: 'created', defaultDir: -1,
      filters: [{ key: 'status', label: 'Estado', options: Object.keys(byStatus) }],
      onRow: r => goIf('cotizaciones', r.id),
      columns: [
        { key: 'id', label: 'Cotización', render: r => rlk('cotizaciones', r.id, r.id, 'mono') + '<div class="cell-sub">' + esc(r.q.title) + '</div>' },
        { key: 'client', label: 'Cliente', render: r => rlk('crm/clientes', r.q.clientId, esc(r.client)) },
        { key: 'owner', label: 'Vendedor', render: r => esc(Q.userName(r.owner)), x: r => Q.userName(r.owner) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), x: r => UI.statusLabel(r.status) },
        { key: 'versions', label: 'Vers.', align: 'num' },
        { key: 'total', label: 'Total (S/)', align: 'num', render: r => money(r.total, 'PEN', 0), x: r => r.total.toFixed(2) },
        { key: 'margin', label: 'Margen', align: 'num', render: r => '<span class="' + (r.margin < 15 ? 'warn' : '') + '">' + fmtN(r.margin, 1) + '%</span>', x: r => r.margin.toFixed(1) },
        { key: 'hView', label: 'Vista en', align: 'num', render: r => r.hView == null ? '<span class="faint">—</span>' : fmtN(r.hView, 0) + ' h', sortVal: r => r.hView == null ? 1e9 : r.hView, x: r => r.hView == null ? '' : r.hView.toFixed(0) },
        { key: 'valid', label: 'Vence', render: r => '<span class="nowrap small">' + date(r.valid) + '</span>' }
      ]
    });
  }

  /* ---------- 3. Reservas ---------- */
  function repReservas(b, c, name) {
    const R = c.res; const act = R.filter(r => r.status !== 'cancelada');
    const byCh = Util.groupBy(R, 'channel'), bySt = Util.groupBy(R, 'status'), byDest = Util.groupBy(R, resDest);
    const pax = sum(act, r => r.passengers.length);
    const sales = sum(act, resPEN);
    b.innerHTML = repHead('Reservas por canal, destino y estado, con pasajeros y ventas. Las canceladas no suman ventas.', name) +
      miniKpis([
        { label: 'Reservas', value: R.length, sub: act.length + ' vigentes', tone: 'accent', icon: 'suitcase' },
        { label: 'Pasajeros', value: pax, sub: 'Promedio ' + fmtN(act.length ? pax / act.length : 0, 1) + ' por reserva', tone: 'info', icon: 'users' },
        { label: 'Ventas', value: kS(sales), sub: 'Reservas vigentes', tone: 'ok', icon: 'trending' },
        { label: 'Ticket promedio', value: kS(act.length ? sales / act.length : 0), sub: 'Por reserva', tone: 'violet', icon: 'coins' },
        { label: 'Canceladas', value: R.filter(r => r.status === 'cancelada').length, sub: pctS(R.filter(r => r.status === 'cancelada').length, R.length) + ' del total', tone: 'bad', icon: 'x' }
      ]) +
      '<div class="grid g3">' +
        UI.card('Por canal', R.length ? UI.chart.donut({ items: Object.keys(byCh).map(k => ({ label: k, value: byCh[k].length, display: byCh[k].length + ' · ' + kS(sum(byCh[k].filter(r => r.status !== 'cancelada'), resPEN)) })), center: String(R.length), sub: 'reservas', size: 140 }) : noData()) +
        UI.card('Por destino principal', R.length ? UI.chart.hbars({ items: Object.keys(byDest).map(k => ({ label: k, value: byDest[k].length, display: byDest[k].length + ' · ' + sum(byDest[k], r => r.passengers.length) + ' pax' })).sort((a, b) => b.value - a.value) }) : noData()) +
        UI.card('Por estado', R.length ? UI.chart.hbars({ items: Object.keys(bySt).map(k => ({ label: UI.statusLabel(k), value: bySt[k].length })).sort((a, b) => b.value - a.value), color: 'var(--violet)' }) : noData()) +
      '</div>' +
      UI.card('Reservas por mes', UI.chart.bars({ labels: c.labels, series: [{ name: 'Reservas', values: c.ser('reservations') }] }), { sub: 'Serie consolidada del tenant (read model mensual)' }) +
      '<div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — detalle', {
      rows: R, search: r => r.id + ' ' + r.title + ' ' + Q.clientName(r.clientId), searchPlaceholder: 'Buscar reserva o cliente…', defaultSort: 'createdAt', defaultDir: -1,
      filters: [{ key: 'channel', label: 'Canal', options: Object.keys(byCh).map(k => [k, k]) }, { key: 'status', label: 'Estado', options: Object.keys(bySt) }],
      onRow: r => goIf('reservas', r.id),
      columns: [
        { key: 'id', label: 'Reserva', render: r => rlk('reservas', r.id, r.id, 'mono') + '<div class="cell-sub">' + esc(r.title) + '</div>' },
        { key: 'clientId', label: 'Cliente', render: r => rlk('crm/clientes', r.clientId, esc(Q.clientName(r.clientId))), x: r => Q.clientName(r.clientId) },
        { key: 'channel', label: 'Canal' },
        { key: 'dest', label: 'Destino', render: r => esc(resDest(r)), sortVal: resDest, x: resDest },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), x: r => UI.statusLabel(r.status) },
        { key: 'pax', label: 'Pax', align: 'num', render: r => r.passengers.length, sortVal: r => r.passengers.length, x: r => r.passengers.length },
        { key: 'travelFrom', label: 'Viaje', render: r => '<span class="nowrap small">' + dateShort(r.travelFrom) + ' – ' + dateShort(r.travelTo) + '</span>' },
        { key: 'total', label: 'Total (S/)', align: 'num', render: r => money(resPEN(r), 'PEN', 0), sortVal: resPEN, x: r => resPEN(r).toFixed(2) },
        { key: 'sede', label: 'Sede', render: r => '<span class="small">' + esc(Q.sedeName(r.sede)) + '</span>', x: r => Q.sedeName(r.sede) }
      ]
    });
  }

  /* ---------- 4. Operaciones ---------- */
  function repOperaciones(b, c, name) {
    const resIds = new Set(c.res.map(r => r.id));
    const ops = DB.operations.filter(o => resIds.has(o.resId) || (!RS.sede && RS.period === 'all'));
    const svc = c.res.flatMap(r => r.services.filter(s => s.status !== 'cancelado').map(s => ({ ...s, res: r })));
    const bySvc = Util.groupBy(svc, 'status');
    const inc = DB.incidents.filter(i => resIds.has(i.resId));
    const bySev = Util.groupBy(inc, 'severity'), byType = Util.groupBy(inc, 'type');
    const asg = ops.flatMap(o => o.assignments);
    const done = asg.filter(a => a.checkin);
    const tol = DB.settings.ops.checkinToleranceMin;
    const onTime = done.filter(a => { const plan = Util.parseD(a.date + ' ' + a.time); return (Util.parseD(a.checkin) - plan) / 60000 <= tol; });
    const tasks = ops.flatMap(o => o.tasks);
    const confirmed = svc.filter(s => ['confirmado', 'completado', 'en_curso'].includes(s.status)).length;
    const opRows = ops.map(o => ({ o, id: o.id, resId: o.resId, title: o.title, status: o.status, coord: o.coordinator, from: o.dateFrom, asg: o.assignments.length, asgOk: o.assignments.filter(a => ['confirmada', 'completada'].includes(a.status)).length, tasksPct: pct(o.tasks.filter(t => t.done).length, o.tasks.length), inc: DB.incidents.filter(i => i.opId === o.id).length }));
    b.innerHTML = repHead('Servicios por estado, incidencias por severidad y tipo, y cumplimiento operativo (check-in dentro de la tolerancia de ' + tol + ' min y tareas completadas).', name) +
      miniKpis([
        { label: 'Servicios programados', value: svc.length, sub: pctS(confirmed, svc.length) + ' confirmados', tone: 'accent', icon: 'layers' },
        { label: 'Pendientes de proveedor', value: svc.filter(s => ['solicitado', 'pendiente'].includes(s.status)).length, sub: 'Solicitados sin confirmar', tone: 'warn', icon: 'clock' },
        { label: 'Incidencias', value: inc.length, sub: inc.filter(i => !['cerrada', 'resuelta'].includes(i.status)).length + ' abiertas · ' + inc.filter(i => i.severity === 'critica').length + ' crítica(s)', tone: 'bad', icon: 'alert' },
        { label: 'Puntualidad de check-in', value: done.length ? pctS(onTime.length, done.length) : '—', sub: done.length + ' check-in(s) registrados', tone: 'ok', icon: 'gps' },
        { label: 'Tareas completadas', value: pctS(tasks.filter(t => t.done).length, tasks.length), sub: tasks.length + ' tareas en ' + ops.length + ' órdenes', tone: 'info', icon: 'clipboard' }
      ]) +
      '<div class="grid g3">' +
        UI.card('Servicios por estado', svc.length ? UI.chart.hbars({ items: Object.keys(bySvc).map(k => ({ label: UI.statusLabel(k), value: bySvc[k].length })).sort((a, b) => b.value - a.value) }) : noData()) +
        UI.card('Incidencias por severidad', inc.length ? UI.chart.donut({ items: ['critica', 'alta', 'media', 'baja'].filter(k => bySev[k]).map(k => ({ label: UI.statusLabel(k), value: bySev[k].length, color: { critica: 'var(--bad)', alta: 'var(--warn)', media: 'var(--info)', baja: 'var(--fg-3)' }[k] })), center: String(inc.length), sub: 'incidencias', size: 140 }) : noData('Sin incidencias en el periodo.')) +
        UI.card('Incidencias por tipo', inc.length ? UI.chart.hbars({ items: Object.keys(byType).map(k => ({ label: k, value: byType[k].length })), color: 'var(--bad)' }) + (Access.canRoute('operaciones/incidencias') ? '<div style="margin-top:12px"><a class="btn sm ghost" href="#/operaciones/incidencias">Gestionar incidencias ' + ic('arrowRight') + '</a></div>' : '') : noData('Sin incidencias en el periodo.')) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — cumplimiento por orden', {
      rows: opRows, search: ['id', 'resId', 'title'], searchPlaceholder: 'Buscar orden o reserva…',
      onRow: r => goIf('operaciones/ordenes', r.id),
      columns: [
        { key: 'id', label: 'Orden', render: r => rlk('operaciones/ordenes', r.id, r.id, 'mono') + '<div class="cell-sub">' + esc(r.title) + '</div>' },
        { key: 'resId', label: 'Reserva', render: r => rlk('reservas', r.resId, r.resId, 'mono small') },
        { key: 'coord', label: 'Coordinador', render: r => esc(Q.userName(r.coord)), x: r => Q.userName(r.coord) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), x: r => UI.statusLabel(r.status) },
        { key: 'from', label: 'Inicio', render: r => '<span class="nowrap small">' + date(r.from) + '</span>' },
        { key: 'asg', label: 'Asignaciones', align: 'num', render: r => r.asgOk + ' / ' + r.asg, x: r => r.asgOk + '/' + r.asg },
        { key: 'tasksPct', label: 'Tareas', render: r => '<div class="small num">' + fmtN(r.tasksPct, 0) + '%</div>' + UI.progress(r.tasksPct, r.tasksPct >= 100 ? 'ok' : r.tasksPct < 50 ? 'warn' : ''), x: r => r.tasksPct.toFixed(0) },
        { key: 'inc', label: 'Incid.', align: 'num' }
      ]
    });
  }

  /* ---------- 5. Finanzas y rentabilidad ---------- */
  function repFinanzas(b, c, name) {
    const sales = c.ser('sales'), cost = c.ser('cost');
    const tS = arrSum(sales), tC = arrSum(cost);
    const cxc = DB.receivables.filter(r => r.status !== 'pagada' && (!RS.sede || (Q.reservation(r.resId) || {}).sede === RS.sede));
    const bal = (r) => toPEN(r.amount - r.paid, r.currency);
    const buckets = [['Por vencer', r => daysFromToday(r.due) >= 0, 'var(--ok)'], ['Vencido 1–30 días', r => daysFromToday(r.due) < 0 && daysFromToday(r.due) >= -30, 'var(--warn)'], ['Vencido 31–60 días', r => daysFromToday(r.due) < -30 && daysFromToday(r.due) >= -60, 'var(--sun)'], ['Vencido > 60 días', r => daysFromToday(r.due) < -60, 'var(--bad)']];
    const cxp = DB.payables.filter(p => p.status !== 'pagada');
    const M = Auth.can('finance.profitability'); const PAY = Auth.can('finance.payables');
    const btnTo = (route, label) => Access.canRoute(route) ? '<a class="btn sm ghost" href="#/' + route + '">' + label + ' ' + ic('arrowRight') + '</a>' : '';
    if (!M) return repFinanzasContable(b, c, name, { sales, tS, cxc, bal, buckets, btnTo });
    const prof = c.res.filter(r => r.status !== 'cancelada').map(r => { const v = resPEN(r), k = resCostPEN(r), paid = toPEN(Q.resPaid(r.id), r.currency); return { r, id: r.id, client: Q.clientName(r.clientId), sale: v, cost: k, profit: v - k, margin: pct(v - k, v), paidPct: pct(paid, v) }; });
    b.innerHTML = repHead('Ventas frente a costo de proveedores, margen bruto, rentabilidad por reserva y antigüedad de cuentas por cobrar (CxC aging).', name) +
      miniKpis([
        { label: 'Ventas netas', value: kS(tS), sub: c.P.label, tone: 'accent', icon: 'trending' },
        { label: 'Costo de proveedores', value: kS(tC), sub: pctS(tC, tS) + ' de las ventas', tone: 'sun', icon: 'coins' },
        { label: 'Margen bruto', value: pctS(tS - tC, tS), sub: 'Utilidad ' + kS(tS - tC), tone: 'ok', icon: 'percent' },
        { label: 'CxC pendiente', value: kS(sum(cxc, bal)), sub: cxc.length + ' documento(s)', tone: 'info', icon: 'wallet' },
        { label: 'CxC vencida', value: kS(sum(cxc.filter(r => daysFromToday(r.due) < 0), bal)), sub: cxc.filter(r => daysFromToday(r.due) < 0).length + ' vencida(s)', tone: 'bad', icon: 'alert' }
      ]) +
      '<div class="grid g-2-1">' +
        UI.card('Ventas vs. costo', UI.chart.bars({ labels: c.labels, series: [{ name: 'Ventas netas', values: sales }, { name: 'Costo proveedores', values: cost, color: 'var(--sun)' }], fmt: v => 'S/ ' + fmtN(v, 0) }), { sub: 'Read model mensual consolidado (S/)', actions: btnTo('finanzas/rentabilidad', 'Rentabilidad') }) +
        UI.card('Antigüedad de CxC (aging)', cxc.length ? UI.chart.hbars({ items: buckets.map(bk => { const rs = cxc.filter(bk[1]); return { label: bk[0], value: sum(rs, bal), color: bk[2], display: money(sum(rs, bal), 'PEN', 0) + ' · ' + rs.length }; }) }) + '<div style="margin-top:12px">' + btnTo('finanzas/cobros', 'Cuentas por cobrar') + '</div>' : noData('Sin saldos por cobrar.'), { sub: 'Saldo pendiente en S/' }) +
      '</div>' +
      '<div class="grid g' + (PAY ? '2' : '1') + '">' +
        UI.card('Margen bruto mensual', UI.chart.line({ labels: c.labels, series: [{ name: 'Margen %', values: c.idx.map(i => Math.round((DB.monthly.sales[i] - DB.monthly.cost[i]) / DB.monthly.sales[i] * 1000) / 10), color: 'var(--ok)' }], fmt: v => fmtN(v, 1) + '%' }), { sub: 'Porcentaje sobre ventas netas' }) +
        (!PAY ? '' : UI.card('Cuentas por pagar pendientes', cxp.length ? UI.chart.hbars({ items: Object.entries(Util.groupBy(cxp, 'status')).map(([k, v]) => ({ label: UI.statusLabel(k), value: sum(v, p => toPEN(p.amount - p.paid, p.currency)), display: money(sum(v, p => toPEN(p.amount - p.paid, p.currency)), 'PEN', 0) + ' · ' + v.length })), color: 'var(--sun)' }) + '<div style="margin-top:12px">' + btnTo('finanzas/proveedores', 'Cuentas por pagar') + '</div>' : noData(), { sub: 'Saldo a proveedores por estado (S/)' })) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — rentabilidad por reserva', {
      rows: prof, search: ['id', 'client'], searchPlaceholder: 'Buscar reserva o cliente…', defaultSort: 'profit', defaultDir: -1,
      onRow: r => goIf('reservas', r.id),
      columns: [
        { key: 'id', label: 'Reserva', render: r => rlk('reservas', r.id, r.id, 'mono') + '<div class="cell-sub">' + esc(r.r.title) + '</div>' },
        { key: 'client', label: 'Cliente' },
        { key: 'sale', label: 'Venta (S/)', align: 'num', render: r => money(r.sale, 'PEN', 0), x: r => r.sale.toFixed(2) },
        { key: 'cost', label: 'Costo (S/)', align: 'num', render: r => money(r.cost, 'PEN', 0), x: r => r.cost.toFixed(2) },
        { key: 'profit', label: 'Utilidad', align: 'num', render: r => '<b class="' + (r.profit < 0 ? 'bad' : '') + '">' + money(r.profit, 'PEN', 0) + '</b>', x: r => r.profit.toFixed(2) },
        { key: 'margin', label: 'Margen', align: 'num', render: r => '<span class="' + (r.margin < 15 ? 'warn' : 'ok') + '">' + fmtN(r.margin, 1) + '%</span>', x: r => r.margin.toFixed(1) },
        { key: 'paidPct', label: 'Cobrado', render: r => '<div class="small num">' + fmtN(Math.min(100, r.paidPct), 0) + '%</div>' + UI.progress(r.paidPct, r.paidPct >= 100 ? 'ok' : ''), x: r => r.paidPct.toFixed(0) }
      ],
      footer: rows => { const s = sum(rows, 'sale'), k = sum(rows, 'cost'); return '<tr><td colspan="2"><b>Total</b></td><td class="num"><b>' + money(s, 'PEN', 0) + '</b></td><td class="num"><b>' + money(k, 'PEN', 0) + '</b></td><td class="num"><b>' + money(s - k, 'PEN', 0) + '</b></td><td class="num"><b>' + fmtN(pct(s - k, s), 1) + '%</b></td><td></td></tr>'; }
    });
  }

  /* Finanzas sin finance.profitability (Contabilidad): ventas, cartera y facturación; sin costos, márgenes ni utilidad */
  function repFinanzasContable(b, c, name, k) {
    const inP = (d) => String(d || '').slice(0, 10) >= c.P.from;
    const inv = DB.invoices.filter(i => inP(i.date));
    const pays = DB.payments.filter(p => p.status === 'aplicado' && inP(p.date));
    const rows = k.cxc.map(r => ({ r, id: r.id, client: Q.clientName(r.clientId), resId: r.resId, due: r.due, saldo: k.bal(r), status: r.status }));
    b.innerHTML = repHead('Ventas facturables, cobranza y antigüedad de cuentas por cobrar. Costos de proveedor, márgenes y utilidad no se muestran para su rol (requiere <span class="mono">finance.profitability</span>).', name) +
      miniKpis([
        { label: 'Ventas netas', value: kS(k.tS), sub: c.P.label, tone: 'accent', icon: 'trending' },
        { label: 'Cobrado (aplicado)', value: kS(sum(pays, p => toPEN(p.amount, p.currency))), sub: pays.length + ' pago(s)', tone: 'ok', icon: 'checkCircle' },
        { label: 'Comprobantes emitidos', value: inv.length, sub: inv.filter(i => i.status === 'observado').length + ' observado(s)', tone: 'violet', icon: 'receipt' },
        { label: 'CxC pendiente', value: kS(sum(k.cxc, k.bal)), sub: k.cxc.length + ' documento(s)', tone: 'info', icon: 'wallet' },
        { label: 'CxC vencida', value: kS(sum(k.cxc.filter(r => daysFromToday(r.due) < 0), k.bal)), sub: k.cxc.filter(r => daysFromToday(r.due) < 0).length + ' vencida(s)', tone: 'bad', icon: 'alert' }
      ]) +
      '<div class="grid g-2-1">' +
        UI.card('Ventas netas por mes', UI.chart.bars({ labels: c.labels, series: [{ name: 'Ventas netas', values: k.sales }], fmt: v => 'S/ ' + fmtN(v, 0) }), { sub: 'Read model mensual (S/)', actions: k.btnTo('finanzas/facturacion', 'Facturación') }) +
        UI.card('Antigüedad de CxC (aging)', k.cxc.length ? UI.chart.hbars({ items: k.buckets.map(bk => { const rs = k.cxc.filter(bk[1]); return { label: bk[0], value: sum(rs, k.bal), color: bk[2], display: money(sum(rs, k.bal), 'PEN', 0) + ' · ' + rs.length }; }) }) + '<div style="margin-top:12px">' + k.btnTo('finanzas/cobros', 'Cuentas por cobrar') + '</div>' : noData('Sin saldos por cobrar.'), { sub: 'Saldo pendiente en S/' }) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — cuentas por cobrar', {
      rows, search: ['id', 'client', 'resId'], searchPlaceholder: 'Buscar documento o cliente…', defaultSort: 'due',
      onRow: r => goIf('finanzas/cobros', r.id),
      columns: [
        { key: 'id', label: 'Documento', render: r => rlk('finanzas/cobros', r.id, r.id, 'mono') },
        { key: 'client', label: 'Cliente' },
        { key: 'resId', label: 'Reserva', render: r => rlk('reservas', r.resId, r.resId, 'mono small') },
        { key: 'due', label: 'Vence', render: r => '<span class="nowrap small ' + (daysFromToday(r.due) < 0 ? 'bad' : '') + '">' + date(r.due) + '</span>' },
        { key: 'saldo', label: 'Saldo (S/)', align: 'num', render: r => money(r.saldo, 'PEN', 0), x: r => r.saldo.toFixed(2) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), x: r => UI.statusLabel(r.status) }
      ]
    });
  }

  /* ---------- 6. Proveedores ---------- */
  function repProveedores(b, c, name) {
    const svc = c.res.flatMap(r => r.services.filter(s => s.providerId && s.status !== 'cancelado').map(s => ({ ...s, res: r })));
    const byP = Util.groupBy(svc, 'providerId');
    const rows = DB.providers.map(p => { const ss = byP[p.id] || []; const pend = DB.payables.filter(x => x.providerId === p.id && x.status !== 'pagada'); return { p, id: p.id, name: p.name, type: p.type, n: ss.length, cost: sum(ss, s => toPEN(s.cost, s.res.currency)), confirmed: pct(ss.filter(s => ['confirmado', 'completado'].includes(s.status)).length, ss.length), rating: p.rating, cxp: sum(pend, x => toPEN(x.amount - x.paid, x.currency)), status: p.status, contractEnd: p.contractEnd }; });
    const used = rows.filter(r => r.n);
    const byType = Util.groupBy(used, 'type');
    b.innerHTML = repHead('Volumen de servicios y costo por proveedor, tasa de confirmación, calificación y saldo por pagar.', name) +
      miniKpis([
        { label: 'Proveedores utilizados', value: used.length, sub: 'de ' + DB.providers.filter(p => p.status === 'activo').length + ' activos', tone: 'accent', icon: 'building' },
        { label: 'Servicios contratados', value: svc.length, sub: pctS(svc.filter(s => ['confirmado', 'completado'].includes(s.status)).length, svc.length) + ' confirmados', tone: 'info', icon: 'layers' },
        { label: 'Costo total', value: kS(sum(used, 'cost')), sub: 'Servicios del periodo', tone: 'sun', icon: 'coins' },
        { label: 'Calificación media', value: fmtN(used.length ? sum(used, 'rating') / used.length : 0, 2), sub: 'Sobre 5.0', tone: 'ok', icon: 'star' },
        { label: 'Contratos por vencer / vencidos', value: DB.providers.filter(p => daysFromToday(p.contractEnd) <= 60).length, sub: 'En los próximos 60 días', tone: 'warn', icon: 'alert' }
      ]) +
      '<div class="grid g3">' +
        UI.card('Costo por proveedor', used.length ? UI.chart.hbars({ items: used.slice().sort((a, b) => b.cost - a.cost).slice(0, 7).map(r => ({ label: r.name, value: r.cost, display: money(r.cost, 'PEN', 0) })), color: 'var(--sun)' }) : noData()) +
        UI.card('Volumen de servicios', used.length ? UI.chart.hbars({ items: used.slice().sort((a, b) => b.n - a.n).slice(0, 7).map(r => ({ label: r.name, value: r.n, display: r.n + ' serv.' })) }) : noData()) +
        UI.card('Costo por tipo de proveedor', used.length ? UI.chart.donut({ items: Object.keys(byType).map(k => ({ label: k, value: Math.round(sum(byType[k], 'cost')), display: kS(sum(byType[k], 'cost')) })), center: kS(sum(used, 'cost')), sub: 'costo', size: 140 }) : noData()) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — detalle', {
      rows, search: ['name', 'type', 'id'], searchPlaceholder: 'Buscar proveedor…', defaultSort: 'cost', defaultDir: -1,
      filters: [{ key: 'type', label: 'Tipo', options: [...new Set(DB.providers.map(p => p.type))].map(t => [t, t]) }, { key: 'status', label: 'Estado', options: ['activo', 'vencido', 'inactivo'] }],
      onRow: r => goIf('catalogo/proveedores', r.id),
      columns: [
        { key: 'name', label: 'Proveedor', render: r => rlk('catalogo/proveedores', r.id, esc(r.name)) + '<div class="cell-sub">' + esc(r.type) + ' · ' + esc(r.p.city) + '</div>' },
        { key: 'n', label: 'Servicios', align: 'num' },
        { key: 'cost', label: 'Costo (S/)', align: 'num', render: r => money(r.cost, 'PEN', 0), x: r => r.cost.toFixed(2) },
        { key: 'confirmed', label: 'Confirmación', align: 'num', render: r => r.n ? fmtN(r.confirmed, 0) + '%' : '<span class="faint">—</span>', x: r => r.confirmed.toFixed(0) },
        { key: 'rating', label: 'Calificación', align: 'num', render: r => fmtN(r.rating, 1) },
        Auth.can('finance.payables') ? { key: 'cxp', label: 'Por pagar (S/)', align: 'num', render: r => r.cxp ? money(r.cxp, 'PEN', 0) : '<span class="faint">—</span>', x: r => r.cxp.toFixed(2) } : null,
        { key: 'contractEnd', label: 'Contrato hasta', render: r => '<span class="nowrap small ' + (daysFromToday(r.contractEnd) < 0 ? 'bad' : daysFromToday(r.contractEnd) <= 60 ? 'warn' : '') + '">' + date(r.contractEnd) + '</span>' },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), x: r => UI.statusLabel(r.status) }
      ].filter(Boolean)
    });
  }

  /* ---------- 7. Clientes ---------- */
  function repClientes(b, c, name) {
    const C = c.clients;
    const rows = C.map(cl => { const rs = c.res.filter(r => r.clientId === cl.id && r.status !== 'cancelada'); return { cl, id: cl.id, name: cl.name, segment: cl.segment, country: cl.country, res: rs.length, sales: sum(rs, resPEN), quotes: c.quotes.filter(q => q.clientId === cl.id).length, nps: cl.nps, owner: cl.owner, last: rs.map(r => r.travelFrom).sort().pop() || '' }; });
    const bySeg = Util.groupBy(rows, 'segment'), byCountry = Util.groupBy(rows, 'country');
    const npsR = rows.filter(r => r.nps != null);
    const prom = npsR.filter(r => r.nps >= 9).length, det = npsR.filter(r => r.nps <= 6).length;
    const withRes = rows.filter(r => r.res);
    b.innerHTML = repHead('Segmentación de la cartera, clientes con mayor facturación, origen y satisfacción (NPS).', name) +
      miniKpis([
        { label: 'Clientes en cartera', value: C.length, sub: C.filter(x => x.kind === 'Empresa').length + ' empresas · ' + C.filter(x => x.kind === 'Persona').length + ' personas', tone: 'accent', icon: 'users' },
        { label: 'Clientes con reservas', value: withRes.length, sub: pctS(withRes.length, C.length) + ' de la cartera', tone: 'info', icon: 'suitcase' },
        { label: 'Venta por cliente', value: kS(withRes.length ? sum(withRes, 'sales') / withRes.length : 0), sub: 'Promedio clientes activos', tone: 'violet', icon: 'coins' },
        { label: 'NPS', value: npsR.length ? fmtN((prom - det) / npsR.length * 100, 0) : '—', sub: npsR.length + ' respuestas · ' + prom + ' promotores', tone: 'ok', icon: 'heart' },
        { label: 'Extranjeros', value: rows.filter(r => r.country !== 'Perú').length, sub: Object.keys(byCountry).length + ' países de origen', tone: 'sun', icon: 'globe' }
      ]) +
      '<div class="grid g3">' +
        UI.card('Segmentos', C.length ? UI.chart.donut({ items: Object.keys(bySeg).map(k => ({ label: k, value: bySeg[k].length, display: bySeg[k].length + ' · ' + kS(sum(bySeg[k], 'sales')) })), center: String(C.length), sub: 'clientes', size: 140 }) : noData()) +
        UI.card('Top clientes por ventas', withRes.length ? UI.chart.hbars({ items: withRes.slice().sort((a, b) => b.sales - a.sales).slice(0, 6).map(r => ({ label: r.name, value: r.sales, display: money(r.sales, 'PEN', 0) })) }) : noData()) +
        UI.card('País de origen', C.length ? UI.chart.hbars({ items: Object.keys(byCountry).map(k => ({ label: k, value: byCountry[k].length })).sort((a, b) => b.value - a.value), color: 'var(--info)' }) : noData()) +
      '</div><div id="rp-t" style="margin-top:16px"></div>';
    return repTable(b.querySelector('#rp-t'), name + ' — cartera', {
      rows, search: ['name', 'id', 'segment', 'country'], searchPlaceholder: 'Buscar cliente…', defaultSort: 'sales', defaultDir: -1,
      filters: [{ key: 'segment', label: 'Segmento', options: Object.keys(bySeg).map(k => [k, k]) }],
      onRow: r => goIf('crm/clientes', r.id),
      columns: [
        { key: 'name', label: 'Cliente', render: r => rlk('crm/clientes', r.id, esc(r.name)) + '<div class="cell-sub">' + esc(r.cl.doc) + '</div>' },
        { key: 'segment', label: 'Segmento', render: r => '<span class="tag">' + esc(r.segment) + '</span>' },
        { key: 'country', label: 'País' },
        { key: 'quotes', label: 'Cotiz.', align: 'num' },
        { key: 'res', label: 'Reservas', align: 'num' },
        { key: 'sales', label: 'Ventas (S/)', align: 'num', render: r => money(r.sales, 'PEN', 0), x: r => r.sales.toFixed(2) },
        { key: 'nps', label: 'NPS', align: 'num', render: r => r.nps == null ? '<span class="faint">—</span>' : '<span class="' + (r.nps >= 9 ? 'ok' : r.nps <= 6 ? 'bad' : '') + '">' + r.nps + '</span>', sortVal: r => r.nps == null ? -1 : r.nps },
        { key: 'owner', label: 'Responsable', render: r => esc(Q.userName(r.owner)), x: r => Q.userName(r.owner) }
      ]
    });
  }

  function exportsDrawer() {
    UI.drawer({ title: 'Exportaciones y envíos programados', sub: 'PROC-061 · Solicitud → Permiso → Job → Procesar → Archivo → Disponible → Descarga → Auditoría', wide: true,
      body: UI.flow(['Solicitud', 'Permiso', 'Job', 'Procesar', 'Archivo', 'Disponible', 'Descarga', 'Auditoría'], 8) +
        '<div class="upper" style="margin:16px 0 8px">Archivos generados</div>' +
        (DB.exports.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Job</th><th>Reporte</th><th>Formato</th><th class="num">Filas</th><th>Tamaño</th><th>Solicitó</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>' + DB.exports.slice(0, 15).map(e => '<tr><td class="mono small">' + esc(e.id) + '</td><td class="small">' + esc(e.report) + '</td><td>' + esc(e.format) + '</td><td class="num">' + (e.rows || '—') + '</td><td class="small">' + esc(e.size) + '</td><td class="small">' + esc(uName(e.user)) + '</td><td class="small nowrap">' + datetime(e.ts) + '</td><td>' + UI.badge('disponible') + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Aún no hay exportaciones.', 'download')) +
        '<div class="upper" style="margin:16px 0 8px">Envíos programados</div>' +
        (DB.jobs.filter(j => j.report || j.id === 'JOB-08').length ? '<div class="list">' + DB.jobs.filter(j => j.report || j.id === 'JOB-08').map(j => '<div class="list-item"><div class="ico-box">' + ic('clock') + '</div><div class="grow"><div class="small" style="font-weight:600">' + esc(j.name) + '</div><div class="xs faint">' + esc(j.cron) + ' · ' + esc(j.format || 'PDF') + ' · próxima ' + (j.next && j.next !== '—' ? datetime(j.next) : '—') + (j.recipients ? ' · ' + esc(j.recipients) : '') + '</div></div>' + UI.badge(j.paused ? 'inactivo' : j.status, j.paused ? 'Pausado' : null) + '</div>').join('') + '</div>' : UI.empty('Sin envíos programados.', 'clock')),
      actions: Access.canRoute('admin/integraciones') ? [{ label: 'Ir al scheduler', icon: 'arrowRight', cls: 'primary', onClick: () => App.go('#/admin/integraciones/jobs') }] : [] });
  }
})();
