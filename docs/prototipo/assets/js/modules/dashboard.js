/* Panel de control por rol + Mapa de procesos
   - Tenant Admin: panel ejecutivo completo.
   - Manager: panel ejecutivo + aprobaciones pendientes y desempeño por asesor.
   - Ventas: su cartera (Scope). Operaciones: ejecución sin montos de venta ni márgenes.
   - Finanzas: caja, CxC/CxP, comisiones y margen. Contabilidad: comprobantes y cierre. */
(function () {
  const { esc, money, fmtN, date, dateShort, sum, toPEN, daysFromToday, nowStr } = Util;
  const MONTH = () => String(window.TODAY).slice(0, 7);
  const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthName = () => MES_LARGO[+MONTH().slice(5, 7) - 1] + ' ' + MONTH().slice(0, 4);
  const kS = (v) => 'S/ ' + fmtN(v / 1000, 1) + 'k';
  const curV = (q) => q.versions.find(v => v.v === q.currentVersion) || q.versions[q.versions.length - 1];
  const needsInternal = (v, t) => { t = t || Pricing.quoteTotals(v); const r = []; if ((v.discountPct || 0) > 5) r.push('descuento ' + fmtN(v.discountPct, 1) + '% > 5%'); if (t.marginPct < 15) r.push('margen ' + fmtN(t.marginPct, 1) + '% < 15%'); return r; };
  const OPEN_Q = ['borrador', 'enviada', 'vista', 'negociacion'];
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
  const first = () => esc(Auth.user.name.split(' ')[0]);
  const actIcon = (a) => UI.icon({ Llamada: 'phoneCall', Email: 'mail', WhatsApp: 'msg', Reunión: 'users', Tarea: 'check', Postventa: 'heart' }[a.type] || 'check');
  const li = (href, inner) => '<div class="list-item click" onclick="location.hash=\'' + href + '\'">' + inner + '</div>';
  const listOr = (items, emptyMsg, ic) => items.length ? '<div class="list">' + items.join('') + '</div>' : UI.empty(emptyMsg, ic || 'checkCircle');
  const btnIf = (perm, href, label, ic, cls) => Auth.can(perm) ? '<a class="btn ' + (cls || '') + '" href="' + href + '">' + UI.icon(ic) + label + '</a>' : '<button class="btn ' + (cls || '') + '" disabled title="Requiere permiso ' + perm + '">' + UI.icon(ic) + label + '</button>';
  const liveRes = () => DB.reservations.filter(r => !['cancelada', 'borrador'].includes(r.status));
  const saleOf = (r) => sum(r.services.filter(s => s.status !== 'cancelado'), 'price');
  function upcomingDeps(n) { return DB.products.flatMap(p => (p.departures || []).map(d => ({ ...d, p }))).filter(d => daysFromToday(d.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n); }
  function depsCard() {
    const deps = upcomingDeps(6);
    return UI.card('Salidas programadas y cupos', deps.length ? '<div class="list">' + deps.map(d => { const pct = d.sold / d.capacity * 100; return '<div class="list-item click" onclick="location.hash=\'#/catalogo/salidas\'"><div class="grow"><div class="row between small"><b>' + esc(d.p.name) + '</b><span class="num">' + d.sold + '/' + d.capacity + '</span></div><div class="xs faint" style="margin:2px 0 6px">' + date(d.date) + ' · ' + d.time + ' · ' + (d.guideId ? esc(Q.guide(d.guideId).name) : '<span class="warn">sin guía</span>') + ' · ' + (d.capacity - d.sold) + ' cupo(s) libres</div>' + UI.progress(pct, pct >= 100 ? 'sun' : pct >= 70 ? 'ok' : '') + '</div></div>'; }).join('') + '</div>' : UI.empty('Sin salidas programadas', 'calendar'), { tight: true });
  }
  function incCard(openInc) {
    return UI.card('Incidencias abiertas', openInc.length ? '<div class="list">' + openInc.map(i => li('#/operaciones/incidencias/' + i.id, '<div class="ico-box ' + (i.severity === 'critica' ? 'bad' : i.severity === 'alta' ? 'warn' : 'info') + '">' + UI.icon('alert') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(i.title) + '</div><div class="xs faint">' + esc(i.id) + ' · ' + esc(i.resId) + '</div></div>' + UI.badge(i.severity))).join('') + '</div>' : UI.empty('Sin incidencias abiertas', 'checkCircle'), { tight: true });
  }
  const openIncidents = () => DB.incidents.filter(i => !['cerrada', 'resuelta'].includes(i.status)).sort((a, b) => ['critica', 'alta', 'media', 'baja'].indexOf(a.severity) - ['critica', 'alta', 'media', 'baja'].indexOf(b.severity));
  const critAlert = (openInc, canOpen) => { const c = openInc.find(i => i.severity === 'critica'); return c ? UI.alert('bad', '<b>Incidencia crítica abierta:</b> ' + esc(c.title) + (canOpen ? ' — <a href="#/operaciones/incidencias/' + c.id + '">gestionar ahora</a>' : ' — a cargo de ' + esc(Q.userName(c.assignee)))) : ''; };

  App.register('dashboard', (el) => {
    const role = Auth.role;
    if (role === 'sales') return salesPanel(el);
    if (role === 'operations') return opsPanel(el);
    if (role === 'finance') return financePanel(el);
    if (role === 'accounting') return accountingPanel(el);
    return execPanel(el, role === 'manager');
  });

  /* ======================= Ejecutivo (Tenant Admin / Manager) ======================= */
  function execPanel(el, isManager) {
    const m = DB.monthly;
    const activeRes = DB.reservations.filter(r => !['cancelada', 'completada', 'borrador'].includes(r.status));
    const openQuotes = DB.quotes.filter(q => ['enviada', 'vista', 'negociacion'].includes(q.status));
    const pipeline = DB.opportunities.filter(o => !['ganada', 'perdida'].includes(o.stage));
    const pipeVal = sum(pipeline, o => toPEN(o.amount, o.currency));
    const cxcOpen = DB.receivables.filter(r => r.status !== 'pagada');
    const cxcVal = sum(cxcOpen, r => toPEN(r.amount - r.paid, r.currency));
    const openInc = openIncidents();
    const margin = (m.sales[5] - m.cost[5]) / m.sales[5] * 100;
    const upcoming = DB.reservations.flatMap(r => r.services.filter(s => s.status !== 'cancelado' && daysFromToday(s.date) >= 0 && daysFromToday(s.date) <= 6).map(s => ({ ...s, res: r }))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const todayActs = DB.activities.filter(a => a.status !== 'completada').sort((a, b) => a.due.localeCompare(b.due));

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: greet() + ', ' + first(), subtitle: (isManager ? 'Panel de gerencia · ' : 'Panel ejecutivo · ') + 'Resumen operativo y comercial de ' + esc(DB.tenant.short) + ' al ' + date(window.TODAY) + '. Cifras consolidadas en soles (TC ' + DB.settings.fx + ').', actions: (Auth.can('reports.view') ? '<a class="btn" href="#/reportes">' + UI.icon('chart') + 'Reportes</a>' : '') + btnIf('quotes.create', '#/cotizaciones/nueva', 'Nueva cotización', 'plus', 'primary') }) +
      critAlert(openInc, Auth.can('operations.view')) +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Ventas del mes', value: kS(m.sales[5]), delta: '−14.8% vs agosto', deltaDir: 'down', tone: 'accent', icon: 'trending' }) +
        UI.kpi({ label: 'Margen bruto', value: fmtN(margin, 1) + '%', sub: 'Meta 28%', tone: 'ok', icon: 'percent' }) +
        UI.kpi({ label: 'Pipeline abierto', value: kS(pipeVal), sub: pipeline.length + ' oportunidades', tone: 'violet', icon: 'target' }) +
        UI.kpi({ label: 'Reservas activas', value: activeRes.length, sub: sum(activeRes, r => r.passengers.length) + ' pasajeros', tone: 'info', icon: 'suitcase' }) +
        UI.kpi({ label: 'Por cobrar', value: kS(cxcVal), sub: cxcOpen.filter(r => r.status === 'vencida').length + ' vencida(s)', tone: 'sun', icon: 'wallet' }) +
      '</div>' +
      (isManager ? managerBlock() : '') +
      '<div class="grid g-2-1">' +
        UI.card('Ventas vs. costo de proveedores', UI.chart.bars({ labels: m.labels, series: [{ name: 'Ventas netas', values: m.sales }, { name: 'Costo proveedores', values: m.cost, color: 'var(--sun)' }], fmt: v => 'S/ ' + fmtN(v, 0) }), { sub: 'Últimos 6 meses · S/', actions: Access.canRoute('finanzas/rentabilidad') ? '<a class="btn sm ghost" href="#/finanzas/rentabilidad">Ver rentabilidad ' + UI.icon('arrowRight') + '</a>' : '' }) +
        UI.card('Embudo comercial · ' + MES_LARGO[+MONTH().slice(5, 7) - 1], funnel(), { sub: 'Lead → Cotización → Reserva' }) +
      '</div>' +
      '<div class="grid g-3-2">' +
        UI.card('Servicios de los próximos 7 días', upcoming.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Servicio</th><th>Reserva</th><th>Pax</th><th>Estado</th></tr></thead><tbody>' + upcoming.slice(0, 9).map(s => '<tr class="click" onclick="location.hash=\'#/reservas/' + s.res.id + '\'"><td class="nowrap"><b>' + dateShort(s.date) + '</b> <span class="faint">' + esc(s.time) + '</span></td><td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc(Q.providerName(s.providerId)) + '</div></td><td class="mono small">' + esc(s.res.id) + '</td><td class="num">' + s.res.passengers.length + '</td><td>' + UI.badge(s.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin servicios programados'), { tight: true, actions: Access.canRoute('operaciones/calendario') ? '<a class="btn sm ghost" href="#/operaciones/calendario">Calendario ' + UI.icon('arrowRight') + '</a>' : '' }) +
        depsCard() +
      '</div>' +
      '<div class="grid g3">' +
        UI.card('Pendientes del equipo', listOr(todayActs.slice(0, 6).map(a => li('#/crm/actividades', '<div class="ico-box ' + (a.status === 'vencida' ? 'bad' : '') + '">' + actIcon(a) + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(a.subject) + '</div><div class="xs faint">' + esc(a.type) + ' · ' + UI.datetime(a.due) + ' · ' + esc(Q.userName(a.owner).split(' ')[0]) + '</div></div>' + UI.badge(a.status))), 'Sin actividades pendientes'), { tight: true }) +
        UI.card('Cotizaciones en seguimiento', listOr(openQuotes.map(q => { const t = Pricing.quoteTotals(curV(q)); const d = daysFromToday(q.validUntil); return li('#/cotizaciones/' + q.id, '<div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(q.title) + '</div><div class="xs faint">' + esc(Q.clientName(q.clientId)) + ' · v' + q.currentVersion + ' · vence ' + (d < 0 ? '<span class="bad">vencida</span>' : 'en ' + d + ' d') + '</div></div><div class="right"><div class="small num" style="font-weight:600">' + money(t.total, q.currency, 0) + '</div>' + UI.badge(q.status) + '</div>'); }), 'Sin cotizaciones abiertas', 'file'), { tight: true }) +
        incCard(openInc) +
      '</div>' +
      '<div class="grid g2">' +
        UI.card('Leads y tasa de conversión', UI.chart.line({ labels: m.labels, series: [{ name: 'Leads recibidos', values: m.leads }, { name: 'Cotizaciones', values: m.quotes, color: 'var(--violet)' }, { name: 'Reservas', values: m.reservations, color: 'var(--sun)' }] }), { sub: 'Volumen mensual' }) +
        UI.card('Ventas por canal · ' + MES_LARGO[+MONTH().slice(5, 7) - 1], UI.chart.donut({ items: [{ label: 'Directo (agencia)', value: 41, display: '41%' }, { label: 'Corporativo', value: 27, display: '27%', color: 'var(--violet)' }, { label: 'B2B agencias', value: 18, display: '18%', color: 'var(--sun)' }, { label: 'E-commerce', value: 14, display: '14%', color: 'var(--info)' }], center: 'S/ 248k', sub: 'ventas netas' }), { sub: 'Participación sobre ventas netas' }) +
      '</div></div>';
    if (isManager) bindManager(el);

    function funnel() {
      const rows = [['Leads recibidos', 128, 'var(--info)'], ['Calificados', 71, 'var(--accent)'], ['Con cotización', 49, 'var(--violet)'], ['Aprobadas', 24, 'var(--sun)'], ['Convertidas en reserva', 22, 'var(--ok)']];
      return UI.chart.hbars({ items: rows.map(r => ({ label: r[0], value: r[1], color: r[2], display: r[1] + (r[1] !== 128 ? ' · ' + fmtN(r[1] / 128 * 100, 0) + '%' : '') })) }) + '<div class="divider" style="margin:14px 0 10px"></div><div class="row between small"><span class="muted">Conversión lead → reserva</span><b>17.2%</b></div><div class="row between small"><span class="muted">Ticket promedio</span><b>S/ 4 286</b></div><div class="row between small"><span class="muted">Tiempo medio de cierre</span><b>11 días</b></div>';
    }
  }

  /* ---- Bloque exclusivo de gerencia ---- */
  function approvalsPending() {
    return DB.quotes.filter(q => OPEN_Q.includes(q.status)).map(q => { const v = curV(q); const t = Pricing.quoteTotals(v); return { q, v, t, reasons: needsInternal(v, t) }; }).filter(x => x.reasons.length && !x.v.internalApproval);
  }
  function managerBlock() {
    const ap = approvalsPending();
    const cancels = DB.reservations.filter(r => r.cancelRequest && r.status !== 'cancelada' && !(r.cancelRequest.status && r.cancelRequest.status !== 'pendiente'));
    const reverts = DB.payments.filter(p => p.reversalRequest && p.status !== 'revertido');
    const canAp = Auth.can('quotes.approve_internal');
    const sellers = DB.users.filter(u => u.status === 'activo' && ['sales', 'manager'].includes(u.role));
    const perf = sellers.map(u => {
      const opps = DB.opportunities.filter(o => o.owner === u.id);
      const won = opps.filter(o => o.stage === 'ganada'), lost = opps.filter(o => o.stage === 'perdida');
      const open = opps.filter(o => !['ganada', 'perdida'].includes(o.stage));
      const quotes = DB.quotes.filter(q => q.owner === u.id);
      const qm = quotes.filter(q => q.status !== 'borrador').map(q => Pricing.quoteTotals(curV(q)).marginPct);
      return { u, leads: DB.leads.filter(l => l.owner === u.id && ['nuevo', 'contactado', 'calificado'].includes(l.status)).length, pipe: sum(open, o => toPEN(o.amount, o.currency)), open: open.length, quotes: quotes.filter(q => OPEN_Q.includes(q.status)).length, won: sum(won, o => toPEN(o.amount, o.currency)), conv: won.length + lost.length ? won.length / (won.length + lost.length) * 100 : null, margin: qm.length ? sum(qm, x => x) / qm.length : null, acts: DB.activities.filter(a => a.owner === u.id && a.status === 'vencida').length };
    }).sort((a, b) => b.won - a.won);
    return '<div class="grid g-2-1">' +
      UI.card('Aprobaciones pendientes <span class="tag">' + (ap.length + cancels.length + reverts.length) + '</span>',
        '<div class="upper" style="padding:10px 16px 0">Cotizaciones fuera de política (descuento &gt; 5 % o margen &lt; 15 %)</div>' +
        listOr(ap.map(x => '<div class="list-item"><div class="ico-box warn">' + UI.icon('fileCheck') + '</div><div class="grow" style="min-width:0"><a class="small" style="font-weight:550" href="#/cotizaciones/' + x.q.id + '">' + esc(x.q.id) + ' · ' + esc(x.q.title) + '</a><div class="xs faint">' + esc(Q.userName(x.q.owner)) + ' · v' + x.v.v + ' · ' + money(x.t.total, x.q.currency, 0) + ' · <span class="warn">' + esc(x.reasons.join(' y ')) + '</span></div></div>' + (canAp ? '<button class="btn xs primary" data-ap="' + x.q.id + '">Aprobar</button>' : '<button class="btn xs" disabled title="Requiere permiso quotes.approve_internal">Aprobar</button>') + '</div>'), 'Sin cotizaciones pendientes de aprobación interna') +
        '<div class="upper" style="padding:10px 16px 0;border-top:1px solid var(--line-2)">Anulaciones y reversiones solicitadas</div>' +
        listOr(cancels.map(r => li('#/reservas/' + r.id, '<div class="ico-box bad">' + UI.icon('x') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(r.id) + ' · ' + esc(r.title) + '</div><div class="xs faint">Solicitada por ' + esc(Q.userName(r.cancelRequest.by)) + (r.cancelRequest.reason ? ' · ' + esc(r.cancelRequest.reason) : '') + '</div></div>' + UI.badge('pendiente'))).concat(reverts.map(p => li('#/finanzas/pagos', '<div class="ico-box bad">' + UI.icon('refresh') + '</div><div class="grow"><div class="small" style="font-weight:550">Reversión ' + esc(p.id) + '</div><div class="xs faint">' + money(p.amount, p.currency) + ' · ' + esc(p.resId) + '</div></div>' + UI.badge('pendiente')))), 'Sin solicitudes de anulación o reversión pendientes'),
        { tight: true, sub: 'Regla PROC-021: toda excepción comercial queda auditada' }) +
      UI.card('Metas del mes', '<div class="stat-line"><span class="muted">Ventas vs. meta (S/ 300k)</span><b>' + fmtN(DB.monthly.sales[5] / 300000 * 100, 0) + '%</b></div>' + UI.progress(DB.monthly.sales[5] / 300000 * 100, 'sun') + '<div class="stat-line" style="margin-top:10px"><span class="muted">Margen bruto vs. meta 28 %</span><b>' + fmtN((DB.monthly.sales[5] - DB.monthly.cost[5]) / DB.monthly.sales[5] * 100, 1) + '%</b></div>' + UI.progress((DB.monthly.sales[5] - DB.monthly.cost[5]) / DB.monthly.sales[5] * 100 / 28 * 100, 'ok') + '<div class="stat-line" style="margin-top:10px"><span class="muted">Actividades vencidas del equipo</span><b class="' + (DB.activities.some(a => a.status === 'vencida') ? 'bad' : '') + '">' + DB.activities.filter(a => a.status === 'vencida').length + '</b></div><div class="stat-line"><span class="muted">Leads nuevos sin contactar</span><b>' + DB.leads.filter(l => l.status === 'nuevo').length + '</b></div><div class="stat-line"><span class="muted">Leads sin asignar</span><b>' + DB.leads.filter(l => !l.owner && !['descartado', 'convertido'].includes(l.status)).length + '</b></div>') +
    '</div>' +
    UI.card('Desempeño por asesor', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Asesor</th><th class="num">Leads activos</th><th class="num">Pipeline</th><th class="num">Cotiz. abiertas</th><th class="num">Ganado</th><th class="num">Conversión</th><th class="num">Margen medio</th><th class="num">Act. vencidas</th></tr></thead><tbody>' +
      perf.map(p => '<tr><td>' + UI.userChip(p.u.id) + '</td><td class="num">' + p.leads + '</td><td class="num nowrap">' + kS(p.pipe) + ' <span class="xs faint">(' + p.open + ')</span></td><td class="num">' + p.quotes + '</td><td class="num nowrap"><b>' + kS(p.won) + '</b></td><td class="num">' + (p.conv == null ? '—' : fmtN(p.conv, 0) + '%') + '</td><td class="num ' + (p.margin != null && p.margin < 15 ? 'bad' : '') + '">' + (p.margin == null ? '—' : fmtN(p.margin, 1) + '%') + '</td><td class="num ' + (p.acts ? 'bad' : '') + '">' + p.acts + '</td></tr>').join('') + '</tbody></table></div>', { tight: true, sub: 'Cartera completa del equipo · montos en S/ · conversión = ganadas / (ganadas + perdidas)', actions: Access.canRoute('crm/oportunidades') ? '<a class="btn sm ghost" href="#/crm/oportunidades">Oportunidades ' + UI.icon('arrowRight') + '</a>' : '' });
  }
  function bindManager(el) {
    el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => {
      if (!Auth.can('quotes.approve_internal')) { UI.toast('Requiere permiso quotes.approve_internal.', 'bad'); return; }
      const x = approvalsPending().find(y => y.q.id === b.dataset.ap); if (!x) return;
      UI.confirm({ title: 'Aprobación interna · ' + esc(x.q.id), message: 'La versión v' + x.v.v + ' está fuera de política comercial: <b>' + esc(x.reasons.join(' y ')) + '</b>. La aprobación queda registrada en auditoría y habilita el envío al cliente.', reason: true, reasonLabel: 'Justificación', confirmLabel: 'Aprobar excepción', onConfirm: (r) => {
        x.v.internalApproval = { by: Auth.user.id, ts: nowStr(), reason: r, override: true };
        Audit.log('Cotización', x.q.id, 'aprobacion_interna', 'v' + x.v.v + ' ' + x.reasons.join(', '), 'override: ' + r);
        Notify.push('cotizacion.aprobacion_interna', 'Portal', x.q.owner, x.q.id + ' v' + x.v.v + ' aprobada internamente por ' + Auth.user.name);
        Store.save(); UI.toast('Aprobación interna registrada para ' + esc(x.q.id) + '.'); App.render();
      } });
    });
  }

  /* ======================= Ventas (su cartera) ======================= */
  function salesPanel(el) {
    const me = Auth.user.id;
    const opps = Scope.mine(DB.opportunities);
    const open = opps.filter(o => !['ganada', 'perdida'].includes(o.stage));
    const won = opps.filter(o => o.stage === 'ganada'), lost = opps.filter(o => o.stage === 'perdida');
    const pipe = sum(open, o => toPEN(o.amount, o.currency)), weighted = sum(open, o => toPEN(o.amount, o.currency) * o.probability / 100);
    const quotes = Scope.mine(DB.quotes);
    const openQ = quotes.filter(q => OPEN_Q.includes(q.status));
    const expiring = openQ.filter(q => q.status !== 'borrador' && daysFromToday(q.validUntil) <= 7).sort((a, b) => a.validUntil.localeCompare(b.validUntil));
    const acts = Scope.mine(DB.activities).filter(a => a.status !== 'completada').sort((a, b) => a.due.localeCompare(b.due));
    const due = acts.filter(a => a.status === 'vencida' || a.due.slice(0, 10) <= window.TODAY);
    const next = acts.filter(a => !due.includes(a)).slice(0, 3);
    const leads = DB.leads.filter(l => l.owner === me && ['nuevo', 'contactado', 'calificado'].includes(l.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pool = DB.leads.filter(l => !l.owner && ['nuevo', 'contactado'].includes(l.status));
    const myLeadsAll = DB.leads.filter(l => l.owner === me);
    const conv = won.length + lost.length ? won.length / (won.length + lost.length) * 100 : null;
    const leadConv = myLeadsAll.length ? myLeadsAll.filter(l => l.status === 'convertido').length / myLeadsAll.length * 100 : 0;
    const coms = DB.commissions.filter(c => c.beneficiary === me && c.status !== 'anulada' && (Q.reservation(c.resId) || {}).travelFrom && Q.reservation(c.resId).travelFrom.slice(0, 7) === MONTH());
    const comPen = sum(coms, c => toPEN(c.amount, c.currency));
    const comCur = {}; coms.forEach(c => { comCur[c.currency] = (comCur[c.currency] || 0) + c.amount; });
    const trips = Scope.mine(DB.reservations).filter(r => !['cancelada', 'completada', 'borrador'].includes(r.status)).sort((a, b) => a.travelFrom.localeCompare(b.travelFrom)).slice(0, 4);
    const canLead = Auth.can('crm.leads.manage');

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: greet() + ', ' + first(), subtitle: 'Panel de Ventas · <b>' + esc(Scope.label()) + '</b>. Solo se muestran sus leads, oportunidades, cotizaciones y actividades.', actions: btnIf('crm.leads.manage', '#/crm/leads/nuevo', 'Nuevo lead', 'funnel') + btnIf('quotes.create', '#/cotizaciones/nueva', 'Nueva cotización', 'plus', 'primary') }) +
      (due.length ? UI.alert('warn', '<b>' + due.length + ' actividad(es) para hoy o vencidas.</b> Los recordatorios se envían cada hora (JOB-04).') : '') +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Mi pipeline', value: kS(pipe), sub: open.length + ' oport. · ponderado ' + kS(weighted), tone: 'violet', icon: 'target' }) +
        UI.kpi({ label: 'Mis cotizaciones abiertas', value: openQ.length, sub: expiring.length + ' vencen en ≤ 7 días', tone: expiring.length ? 'sun' : 'accent', icon: 'file' }) +
        UI.kpi({ label: 'Actividades hoy / vencidas', value: due.length, sub: acts.length + ' pendientes en total', tone: due.length ? 'bad' : 'ok', icon: 'calendar' }) +
        UI.kpi({ label: 'Mi conversión', value: conv == null ? '—' : fmtN(conv, 0) + '%', sub: 'Oportunidades · leads ' + fmtN(leadConv, 0) + '%', tone: 'ok', icon: 'percent' }) +
        UI.kpi({ label: 'Comisión estimada · ' + MES_LARGO[+MONTH().slice(5, 7) - 1], value: 'S/ ' + fmtN(comPen, 2), sub: Object.keys(comCur).map(k => money(comCur[k], k)).join(' + ') || 'Sin viajes del mes', tone: 'sun', icon: 'coins' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('Mi pipeline por etapa', open.length ? UI.chart.hbars({ items: DB.stages.filter(s => !['ganada', 'perdida'].includes(s.id)).map((s, k) => { const os = open.filter(o => o.stage === s.id); return { label: s.name + ' (' + os.length + ')', value: sum(os, o => toPEN(o.amount, o.currency)), display: 'S/ ' + fmtN(sum(os, o => toPEN(o.amount, o.currency)), 0), color: UI.chart.COLORS[k] }; }) }) + '<div class="divider" style="margin:12px 0 6px"></div>' + open.slice().sort((a, b) => a.closeDate.localeCompare(b.closeDate)).slice(0, 4).map(o => '<div class="stat-line"><a href="#/crm/oportunidades/' + o.id + '">' + esc(o.title) + '</a><span class="nowrap">' + UI.badge(o.stage) + ' <span class="xs faint">cierre ' + dateShort(o.closeDate) + '</span></span></div>').join('') : UI.empty('No tiene oportunidades abiertas', 'target'), { actions: '<a class="btn sm ghost" href="#/crm/oportunidades">Tablero ' + UI.icon('arrowRight') + '</a>' }) +
        UI.card('Mis actividades', (due.length ? '<div class="upper" style="padding:10px 16px 0">Hoy y vencidas</div>' + '<div class="list">' + due.map(a => actRow(a, true)).join('') + '</div>' : UI.empty('Nada pendiente para hoy', 'checkCircle')) + (next.length ? '<div class="upper" style="padding:10px 16px 0;border-top:1px solid var(--line-2)">Próximas</div><div class="list">' + next.map(a => actRow(a, false)).join('') + '</div>' : ''), { tight: true, actions: '<a class="btn sm ghost" href="#/crm/actividades">Agenda ' + UI.icon('arrowRight') + '</a>' }) +
      '</div>' +
      '<div class="grid g3">' +
        UI.card('Mis cotizaciones por vencer', listOr(expiring.map(q => { const t = Pricing.quoteTotals(curV(q)); const d = daysFromToday(q.validUntil); return li('#/cotizaciones/' + q.id, '<div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(q.title) + '</div><div class="xs faint">' + esc(Q.clientName(q.clientId)) + ' · ' + (d < 0 ? '<span class="bad">vencida</span>' : d === 0 ? '<span class="bad">vence hoy</span>' : '<span class="' + (d <= 3 ? 'warn' : '') + '">vence en ' + d + ' d</span>') + (q.viewedAt ? ' · vista' : ' · no abierta') + '</div></div><div class="right"><div class="small num" style="font-weight:600">' + money(t.total, q.currency, 0) + '</div><div class="xs ' + (t.marginPct < 15 ? 'bad' : 'faint') + '">margen ' + fmtN(t.marginPct, 1) + '%</div></div>'); }), 'Ninguna cotización vence en los próximos 7 días', 'file'), { tight: true, sub: 'Margen visible solo en sus cotizaciones' }) +
        UI.card('Mis leads', listOr(leads.slice(0, 5).map(l => li('#/crm/leads/' + l.id, '<div class="ico-box ' + (l.status === 'nuevo' ? 'info' : '') + '">' + UI.icon('funnel') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(l.name) + '</div><div class="xs faint">' + esc(l.destination) + ' · ' + l.pax + ' pax · score ' + l.score + '</div></div>' + UI.badge(l.status))), 'Sin leads activos', 'funnel') +
          '<div class="upper" style="padding:10px 16px 0;border-top:1px solid var(--line-2)">Sin asignar · disponibles para tomar</div>' +
          listOr(pool.map(l => '<div class="list-item"><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(l.name) + '</div><div class="xs faint">' + esc(l.source) + ' · ' + esc(l.destination) + ' · ' + l.pax + ' pax</div></div>' + (canLead ? '<button class="btn xs primary" data-take="' + l.id + '">Tomar</button>' : '<button class="btn xs" disabled title="Requiere permiso crm.leads.manage">Tomar</button>') + '</div>'), 'No hay leads sin asignar en la bolsa común', 'users'), { tight: true, actions: '<a class="btn sm ghost" href="#/crm/leads">Leads ' + UI.icon('arrowRight') + '</a>' }) +
        UI.card('Mis próximos viajes', listOr(trips.map(r => li('#/reservas/' + r.id, '<div class="ico-box">' + UI.icon('suitcase') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(r.title) + '</div><div class="xs faint">' + date(r.travelFrom) + ' · ' + r.passengers.length + ' pax</div></div>' + UI.badge(r.status))), 'Sin viajes próximos', 'suitcase') +
          '<div style="padding:12px 16px;border-top:1px solid var(--line-2)"><div class="upper" style="margin-bottom:8px">Accesos rápidos</div><div class="row" style="gap:6px;flex-wrap:wrap">' + btnIf('crm.leads.manage', '#/crm/leads/nuevo', 'Lead', 'plus', 'sm') + btnIf('quotes.create', '#/cotizaciones/nueva', 'Cotización', 'plus', 'sm') + '<a class="btn sm" href="#/crm/clientes">' + UI.icon('users') + 'Mis clientes</a><a class="btn sm" href="#/crm/postventa">' + UI.icon('heart') + 'Postventa</a></div></div>', { tight: true }) +
      '</div></div>';

    function actRow(a, isDue) {
      return '<div class="list-item"><div class="ico-box ' + (a.status === 'vencida' ? 'bad' : '') + '">' + actIcon(a) + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(a.subject) + '</div><div class="xs faint">' + esc(a.type) + ' · ' + UI.datetime(a.due) + '</div></div>' + (isDue ? '<button class="btn xs" data-done="' + a.id + '" title="Marcar como completada">' + UI.icon('check') + 'Hecha</button>' : UI.badge(a.status)) + '</div>';
    }
    el.querySelectorAll('[data-done]').forEach(b => b.onclick = () => {
      const a = DB.activities.find(x => x.id === b.dataset.done);
      if (!a || !Scope.canSee(a)) { UI.toast('La actividad no pertenece a su cartera.', 'bad'); return; }
      UI.modal({ title: 'Completar actividad', sub: esc(a.subject), size: 'sm', body: UI.form([{ id: 'res', label: 'Resultado', type: 'textarea', rows: 3, required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Completar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const bf = a.status;
        a.status = 'completada'; a.result = f.res; a.doneAt = nowStr();
        Audit.log('Actividad', a.id, 'completar', bf, 'completada'); Store.save(); UI.toast('Actividad completada.'); App.render();
      } }] });
    });
    el.querySelectorAll('[data-take]').forEach(b => b.onclick = () => {
      if (!Auth.can('crm.leads.manage')) { UI.toast('Requiere permiso crm.leads.manage.', 'bad'); return; }
      const l = DB.leads.find(x => x.id === b.dataset.take);
      if (!l || l.owner) { UI.toast('El lead ya fue tomado por otro asesor.', 'warn'); App.render(); return; }
      l.owner = Auth.user.id; Audit.log('Lead', l.id, 'asignar', 'sin asignar', Auth.user.id); Store.save(); UI.toast('Lead ' + esc(l.id) + ' asignado a su cartera.'); App.render();
    });
  }

  /* ======================= Operaciones (sin montos de venta ni márgenes) ======================= */
  function opsPanel(el) {
    const svc = liveRes().filter(r => r.status !== 'completada').flatMap(r => r.services.filter(s => s.status !== 'cancelado' && s.providerId).map(s => ({ s, r })));
    const asg = {}; DB.operations.forEach(o => o.assignments.forEach(a => { asg[a.serviceId] = { a, o }; }));
    const soon = svc.filter(x => daysFromToday(x.s.date) >= 0 && daysFromToday(x.s.date) <= 1).sort((a, b) => (a.s.date + a.s.time).localeCompare(b.s.date + b.s.time));
    const unconf = svc.filter(x => ['solicitado', 'pendiente', 'rechazado'].includes(x.s.status) && daysFromToday(x.s.date) >= 0);
    const byProv = {}; unconf.forEach(x => { (byProv[x.s.providerId] = byProv[x.s.providerId] || []).push(x); });
    const pendAsg = DB.operations.filter(o => !['completada', 'cancelada'].includes(o.status)).flatMap(o => o.assignments.filter(a => a.status === 'pendiente' && daysFromToday(a.date) >= 0).map(a => ({ a, o }))).sort((a, b) => a.a.date.localeCompare(b.a.date));
    const openInc = openIncidents();
    const sev = ['critica', 'alta', 'media', 'baja'].map(k => [k, openInc.filter(i => i.severity === k).length]);
    const issued = new Set(DB.vouchers.filter(v => v.status !== 'anulado').map(v => v.serviceId));
    const toIssue = svc.filter(x => x.s.status === 'confirmado' && daysFromToday(x.s.date) >= 0 && !issued.has(x.s.id)).sort((a, b) => a.s.date.localeCompare(b.s.date));
    const arrivals = DB.rooming.filter(rl => daysFromToday(rl.checkIn) >= 0 && daysFromToday(rl.checkIn) <= 7).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const hotelArr = svc.filter(x => (Q.provider(x.s.providerId) || {}).type === 'Hotel' && !/check-out/i.test(x.s.name) && daysFromToday(x.s.date) >= 0 && daysFromToday(x.s.date) <= 7 && !arrivals.some(rl => rl.resId === x.r.id && rl.checkIn === x.s.date));
    const resLabel = (a) => { if (!a) return '<span class="warn">Sin orden</span>'; const p = [a.a.guideId ? 'G: ' + Q.guide(a.a.guideId).name.split(' ')[0] : '', a.a.driverId ? 'C: ' + Q.driver(a.a.driverId).name.split(' ')[0] : '', a.a.vehicleId ? Q.vehicle(a.a.vehicleId).plate : ''].filter(Boolean); return UI.badge(a.a.status) + (p.length ? '<div class="xs faint">' + esc(p.join(' · ')) + '</div>' : '<div class="xs warn">sin recursos</div>'); };

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: greet() + ', ' + first(), subtitle: 'Panel de Operaciones · ejecución de servicios, proveedores, asignaciones y vouchers al ' + date(window.TODAY) + '. Montos de venta y márgenes no se muestran en este rol.', actions: '<a class="btn" href="#/operaciones/calendario">' + UI.icon('calendar') + 'Calendario</a><a class="btn primary" href="#/operaciones/asignaciones">' + UI.icon('truck') + 'Asignaciones</a>' }) +
      critAlert(openInc, true) +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Servicios hoy y mañana', value: soon.length, sub: sum(soon, x => x.r.passengers.length) + ' pax', tone: 'accent', icon: 'clipboard' }) +
        UI.kpi({ label: 'Sin confirmar por proveedor', value: unconf.length, sub: Object.keys(byProv).length + ' proveedor(es)', tone: unconf.length ? 'sun' : 'ok', icon: 'building' }) +
        UI.kpi({ label: 'Asignaciones pendientes', value: pendAsg.length, sub: pendAsg.filter(x => daysFromToday(x.a.date) <= 3).length + ' en ≤ 3 días', tone: pendAsg.length ? 'bad' : 'ok', icon: 'truck' }) +
        UI.kpi({ label: 'Vouchers por emitir', value: toIssue.length, sub: 'servicios confirmados', tone: 'info', icon: 'ticket' }) +
        UI.kpi({ label: 'Incidencias abiertas', value: openInc.length, sub: sev.filter(s => s[1]).map(s => s[1] + ' ' + UI.statusLabel(s[0]).toLowerCase()).join(' · ') || 'ninguna', tone: openInc.some(i => i.severity === 'critica') ? 'bad' : 'violet', icon: 'alert' }) +
      '</div>' +
      UI.card('Servicios de hoy y mañana', soon.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Servicio</th><th>Proveedor</th><th>Reserva</th><th class="num">Pax</th><th>Proveedor conf.</th><th>Asignación</th></tr></thead><tbody>' + soon.map(x => '<tr class="click" onclick="location.hash=\'#/operaciones/ordenes/' + ((asg[x.s.id] || {}).o || {}).id + '\'"><td class="nowrap"><b>' + (daysFromToday(x.s.date) === 0 ? 'Hoy' : 'Mañana') + '</b> <span class="faint">' + esc(x.s.time) + '</span></td><td><div class="cell-main">' + esc(x.s.name) + '</div></td><td class="small">' + esc(Q.providerName(x.s.providerId)) + '</td><td class="mono small">' + esc(x.r.id) + '</td><td class="num">' + x.r.passengers.length + '</td><td>' + UI.badge(x.s.status) + (x.s.confirmationCode ? '<div class="xs mono faint">' + esc(x.s.confirmationCode) + '</div>' : '') + '</td><td>' + resLabel(asg[x.s.id]) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin servicios hoy ni mañana', 'calendar'), { tight: true, actions: '<a class="btn sm ghost" href="#/operaciones/ordenes">Órdenes ' + UI.icon('arrowRight') + '</a>' }) +
      '<div class="grid g3">' +
        UI.card('Sin confirmar por proveedor', Object.keys(byProv).length ? '<div class="list">' + Object.keys(byProv).map(pid => '<div class="list-item" style="align-items:flex-start"><div class="ico-box sun">' + UI.icon('building') + '</div><div class="grow" style="min-width:0"><a class="small" style="font-weight:600" href="#/catalogo/proveedores/' + pid + '">' + esc(Q.providerName(pid)) + '</a>' + byProv[pid].map(x => '<div class="xs faint" style="margin-top:3px"><a class="mono" href="#/reservas/' + x.r.id + '">' + esc(x.r.id) + '</a> · ' + dateShort(x.s.date) + ' · ' + esc(x.s.name) + ' ' + (x.s.providerResponse && x.s.providerResponse.type === 'alternativa' ? UI.badge('pendiente', 'Alternativa') : UI.badge(x.s.status)) + '</div>').join('') + '</div><span class="tag">' + byProv[pid].length + '</span></div>').join('') + '</div>' : UI.empty('Todos los servicios están confirmados', 'checkCircle'), { tight: true }) +
        UI.card('Asignaciones pendientes', listOr(pendAsg.slice(0, 6).map(x => li('#/operaciones/asignaciones', '<div class="ico-box ' + (daysFromToday(x.a.date) <= 3 ? 'bad' : 'warn') + '">' + UI.icon('truck') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(x.a.service) + '</div><div class="xs faint">' + dateShort(x.a.date) + ' ' + esc(x.a.time) + ' · ' + esc(x.o.id) + ' · falta ' + [!x.a.guideId ? 'guía' : '', !x.a.driverId ? 'conductor' : '', !x.a.vehicleId ? 'vehículo' : ''].filter(Boolean).join(', ') + '</div></div>' + UI.badge('pendiente_asignacion'))), 'Sin asignaciones pendientes'), { tight: true }) +
        incCard(openInc) +
      '</div>' +
      '<div class="grid g3">' +
        UI.card('Vouchers por emitir', listOr(toIssue.slice(0, 6).map(x => li('#/operaciones/vouchers', '<div class="ico-box info">' + UI.icon('ticket') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(x.s.name) + '</div><div class="xs faint">' + dateShort(x.s.date) + ' · ' + esc(x.r.id) + ' · ' + esc(Q.providerName(x.s.providerId)) + '</div></div>' + UI.badge('confirmado'))), 'Todos los servicios confirmados tienen voucher'), { tight: true, sub: 'Regla 11: voucher solo con servicio confirmado' }) +
        UI.card('Llegadas a hotel (7 días)', listOr(arrivals.map(rl => li('#/operaciones/rooming/' + rl.resId, '<div class="ico-box">' + UI.icon('bed') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(Q.providerName(rl.hotel)) + '</div><div class="xs faint">' + date(rl.checkIn) + ' → ' + dateShort(rl.checkOut) + ' · ' + rl.rooms.length + ' hab. · ' + esc(rl.resId) + (rl.hotelConfirmedAt ? ' · <span class="ok">confirmada por hotel</span>' : '') + '</div></div>' + (rl.rooms.some(r => r.status === 'observada') ? UI.badge('observado', 'Observada') : UI.badge('confirmada')))).concat(hotelArr.map(x => li('#/reservas/' + x.r.id, '<div class="ico-box">' + UI.icon('bed') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(Q.providerName(x.s.providerId)) + '</div><div class="xs faint">' + date(x.s.date) + ' · ' + esc(x.s.name) + '</div></div>' + UI.badge(x.s.status)))), 'Sin llegadas en los próximos 7 días', 'bed'), { tight: true }) +
        depsCard() +
      '</div></div>';
  }

  /* ======================= Finanzas ======================= */
  function financePanel(el) {
    const cash = DB.payments.filter(p => ['aplicado', 'confirmado'].includes(p.status) && String(p.date).slice(0, 7) === MONTH());
    const cashVal = sum(cash, p => toPEN(p.amount, p.currency));
    const cxc = DB.receivables.filter(r => r.status !== 'pagada' && r.status !== 'cancelada');
    const bal = (r) => toPEN(r.amount - (r.paid || 0), r.currency);
    const buckets = [['Por vencer', r => daysFromToday(r.due) >= 0, 'var(--ok)'], ['1–30 días', r => -daysFromToday(r.due) >= 1 && -daysFromToday(r.due) <= 30, 'var(--sun)'], ['31–60 días', r => -daysFromToday(r.due) > 30 && -daysFromToday(r.due) <= 60, 'var(--warn)'], ['61–90 días', r => -daysFromToday(r.due) > 60 && -daysFromToday(r.due) <= 90, 'var(--bad)'], ['Más de 90 días', r => -daysFromToday(r.due) > 90, 'var(--bad)']];
    const toValidate = DB.payments.filter(p => p.status === 'pendiente');
    const cxp7 = DB.payables.filter(p => p.status !== 'pagada' && daysFromToday(p.due) <= 7).sort((a, b) => a.due.localeCompare(b.due));
    const coms = DB.commissions.filter(c => c.status === 'calculada');
    const res = liveRes().map(r => { const sale = saleOf(r), cost = Q.resCost(r); return { r, sale, cost, pct: sale ? (sale - cost) / sale * 100 : 0 }; }).sort((a, b) => a.pct - b.pct);
    const light = (p) => p >= 25 ? ['ok', 'En meta'] : p >= 15 ? ['pendiente', 'Vigilar'] : ['vencida', 'Bajo mínimo'];
    const m = DB.monthly;

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: greet() + ', ' + first(), subtitle: 'Panel de Finanzas · caja, cuentas por cobrar y pagar, comisiones y rentabilidad de ' + monthName() + '. Cifras en S/ (TC ' + DB.settings.fx + ').', actions: '<a class="btn" href="#/finanzas/conciliacion">' + UI.icon('scale') + 'Conciliación</a>' + btnIf('finance.payments.register', '#/finanzas/pagos', 'Registrar pago', 'plus', 'primary') }) +
      (toValidate.length ? UI.alert('warn', '<b>' + toValidate.length + ' pago(s) por validar</b> reportados por asesores o clientes. Un pago pendiente no aplica a la CxC hasta su validación (PROC-042).') : '') +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Caja del mes', value: kS(cashVal), sub: cash.length + ' cobros aplicados', tone: 'ok', icon: 'wallet' }) +
        UI.kpi({ label: 'CxC abierta', value: kS(sum(cxc, bal)), sub: cxc.filter(r => daysFromToday(r.due) < 0).length + ' vencida(s) · ' + kS(sum(cxc.filter(r => daysFromToday(r.due) < 0), bal)), tone: 'sun', icon: 'receipt' }) +
        UI.kpi({ label: 'Pagos por validar', value: toValidate.length, sub: kS(sum(toValidate, p => toPEN(p.amount, p.currency))), tone: toValidate.length ? 'bad' : 'ok', icon: 'card' }) +
        UI.kpi({ label: 'CxP a 7 días', value: kS(sum(cxp7, p => toPEN(p.amount - (p.paid || 0), p.currency))), sub: cxp7.length + ' documento(s)', tone: 'violet', icon: 'coins' }) +
        UI.kpi({ label: 'Margen bruto del mes', value: fmtN((m.sales[5] - m.cost[5]) / m.sales[5] * 100, 1) + '%', sub: 'Meta 28 %', tone: 'accent', icon: 'percent' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('Margen por reserva', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Reserva</th><th class="num">Venta neta</th><th class="num">Costo</th><th class="num">Utilidad</th><th class="num">Margen</th><th>Semáforo</th></tr></thead><tbody>' + res.map(x => { const l = light(x.pct); return '<tr class="click" onclick="location.hash=\'#/reservas/' + x.r.id + '\'"><td><div class="cell-main">' + esc(x.r.title) + '</div><div class="cell-sub mono">' + esc(x.r.id) + '</div></td><td class="num nowrap">' + money(x.sale, x.r.currency, 0) + '</td><td class="num nowrap">' + money(x.cost, x.r.currency, 0) + '</td><td class="num nowrap">' + money(x.sale - x.cost, x.r.currency, 0) + '</td><td class="num"><b>' + fmtN(x.pct, 1) + '%</b></td><td>' + UI.badge(l[0], l[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>', { tight: true, sub: 'Verde ≥ 25 % · ámbar 15–25 % · rojo < 15 %', actions: '<a class="btn sm ghost" href="#/finanzas/rentabilidad">Rentabilidad ' + UI.icon('arrowRight') + '</a>' }) +
        UI.card('CxC por antigüedad', UI.chart.hbars({ items: buckets.map(b => { const rs = cxc.filter(b[1]); return { label: b[0] + ' (' + rs.length + ')', value: sum(rs, bal), display: 'S/ ' + fmtN(sum(rs, bal), 0), color: b[2] }; }) }) + '<div class="divider" style="margin:12px 0 6px"></div>' + cxc.filter(r => daysFromToday(r.due) < 0).map(r => '<div class="stat-line"><a href="#/finanzas/cobros">' + esc(r.id) + ' · ' + esc(Q.clientName(r.clientId)) + '</a><b class="bad nowrap">' + money(r.amount - r.paid, r.currency) + '</b></div>').join(''), { sub: 'Saldo en S/ al ' + date(window.TODAY) }) +
      '</div>' +
      '<div class="grid g3">' +
        UI.card('Pagos por validar', listOr(toValidate.map(p => li('#/finanzas/pagos', '<div class="ico-box warn">' + UI.icon('card') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(p.id) + ' · ' + esc(p.method) + '</div><div class="xs faint">' + esc(p.resId) + ' · ' + date(p.date) + ' · reportado por ' + esc(Q.userName(p.by)) + '</div></div><div class="right"><b class="small nowrap">' + money(p.amount, p.currency) + '</b></div>')), 'Sin pagos por validar'), { tight: true }) +
        UI.card('CxP por vencer (7 días)', listOr(cxp7.map(p => li('#/finanzas/proveedores', '<div class="ico-box ' + (daysFromToday(p.due) < 0 ? 'bad' : 'violet') + '">' + UI.icon('coins') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(Q.providerName(p.providerId)) + '</div><div class="xs faint">' + esc(p.id) + ' · ' + (daysFromToday(p.due) < 0 ? '<span class="bad">vencida ' + dateShort(p.due) + '</span>' : 'vence ' + dateShort(p.due)) + (p.providerInvoice ? ' · fact. ' + esc(p.providerInvoice.number) : ' · <span class="warn">sin factura</span>') + '</div></div><b class="small nowrap">' + money(p.amount - (p.paid || 0), p.currency) + '</b>')), 'Sin pagos a proveedores en los próximos 7 días'), { tight: true }) +
        UI.card('Comisiones por aprobar', listOr(coms.map(c => li('#/finanzas/comisiones', '<div class="ico-box sun">' + UI.icon('percent') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(Q.userName(c.beneficiary)) + '</div><div class="xs faint">' + esc(c.kind) + ' · ' + esc(c.resId) + ' · ' + fmtN(c.pct, 1) + '% de ' + money(c.base, c.currency, 0) + '</div></div><b class="small nowrap">' + money(c.amount, c.currency) + '</b>')), 'Sin comisiones por aprobar'), { tight: true }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('Ventas vs. costo de proveedores', UI.chart.bars({ labels: m.labels, series: [{ name: 'Ventas netas', values: m.sales }, { name: 'Costo proveedores', values: m.cost, color: 'var(--sun)' }], fmt: v => 'S/ ' + fmtN(v, 0) }), { sub: 'Últimos 6 meses · S/' }) +
        UI.card('Caja del mes por medio de pago', (() => { const g = Util.groupBy(cash, p => p.method.split(' (')[0]); const items = Object.keys(g).map(k => ({ label: k + ' (' + g[k].length + ')', value: sum(g[k], p => toPEN(p.amount, p.currency)), display: 'S/ ' + fmtN(sum(g[k], p => toPEN(p.amount, p.currency)), 0) })); return items.length ? UI.chart.hbars({ items }) : UI.empty('Sin cobros aplicados en el mes', 'wallet'); })(), { sub: 'Cobros aplicados en ' + monthName() }) +
      '</div></div>';
  }

  /* ======================= Contabilidad ======================= */
  function accountingPanel(el) {
    const inv = DB.invoices.slice().sort((a, b) => b.date.localeCompare(a.date));
    const month = inv.filter(i => String(i.date).slice(0, 7) === MONTH());
    const obs = inv.filter(i => ['observado', 'rechazado'].includes(i.status));
    const noDoc = DB.payments.filter(p => ['aplicado', 'confirmado'].includes(p.status) && !DB.invoices.some(i => i.resId === p.resId && i.type !== 'Nota de crédito' && Math.abs(toPEN(i.amount, i.currency) - toPEN(p.amount, p.currency)) < 0.5));
    const cxc = DB.receivables.filter(r => !['pagada', 'cancelada'].includes(r.status)).sort((a, b) => a.due.localeCompare(b.due));
    const revNoNC = DB.payments.filter(p => p.status === 'revertido' && !DB.invoices.some(i => i.type === 'Nota de crédito' && i.resId === p.resId));
    const bankOpen = DB.bankLines.filter(b => b.status !== 'conciliado');
    const pc = DB.periodClose = DB.periodClose && DB.periodClose.period === MONTH() ? DB.periodClose : { period: MONTH(), checks: {}, closed: null };
    const checks = [
      { id: 'obs', label: 'Comprobantes observados subsanados', auto: obs.length === 0, detail: obs.length ? obs.length + ' observado(s)' : 'Sin observaciones', href: '#/finanzas/facturacion' },
      { id: 'nodoc', label: 'Todo cobro aplicado tiene comprobante', auto: noDoc.length === 0, detail: noDoc.length ? noDoc.length + ' cobro(s) sin comprobante' : 'Completo', href: '#/finanzas/facturacion' },
      { id: 'nc', label: 'Notas de crédito por reversiones emitidas', auto: revNoNC.length === 0, detail: revNoNC.length ? revNoNC.length + ' reversión(es) sin NC' : 'Completo', href: '#/finanzas/facturacion' },
      { id: 'bank', label: 'Conciliación bancaria sin partidas abiertas', auto: bankOpen.length === 0, detail: bankOpen.length ? bankOpen.length + ' movimiento(s) sin conciliar' : 'Conciliado', href: Access.canRoute('finanzas/conciliacion') ? '#/finanzas/conciliacion' : '' },
      { id: 'fx', label: 'Tipo de cambio de cierre registrado (SBS)', manual: true },
      { id: 'aging', label: 'Revisión de CxC vencidas y provisión de cobranza dudosa', manual: true },
      { id: 'igv', label: 'Registro de ventas conciliado con IGV del periodo', manual: true }
    ];
    const ok = (c) => c.manual ? !!pc.checks[c.id] : c.auto;
    const done = checks.filter(ok).length;
    const canClose = Auth.can('finance.invoicing');

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: greet() + ', ' + first(), subtitle: 'Panel de Contabilidad · comprobantes electrónicos, cobranza documentada y cierre de ' + monthName() + '.', actions: '<a class="btn" href="#/finanzas/cobros">' + UI.icon('wallet') + 'CxC</a>' + btnIf('finance.invoicing', '#/finanzas/facturacion', 'Facturación', 'receipt', 'primary') }) +
      (obs.length ? UI.alert('warn', '<b>' + obs.length + ' comprobante(s) observado(s)</b> por el OSE/SUNAT: ' + obs.map(i => esc(i.id) + ' (' + esc(i.detail) + ')').join(', ') + '.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Comprobantes del mes', value: month.length, sub: kS(sum(month.filter(i => i.type !== 'Nota de crédito'), i => toPEN(i.amount, i.currency))) + ' emitido', tone: 'accent', icon: 'receipt' }) +
        UI.kpi({ label: 'Observados / rechazados', value: obs.length, sub: 'Requieren corrección', tone: obs.length ? 'bad' : 'ok', icon: 'alert' }) +
        UI.kpi({ label: 'Cobros sin comprobante', value: noDoc.length, sub: noDoc.length ? kS(sum(noDoc, p => toPEN(p.amount, p.currency))) : 'Todo documentado', tone: noDoc.length ? 'sun' : 'ok', icon: 'fileCheck' }) +
        UI.kpi({ label: 'CxC abiertas', value: cxc.length, sub: kS(sum(cxc, r => toPEN(r.amount - r.paid, r.currency))), tone: 'violet', icon: 'wallet' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('Comprobantes emitidos', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Comprobante</th><th>Tipo</th><th>Cliente</th><th>Fecha</th><th class="num">Importe</th><th>Estado SUNAT</th></tr></thead><tbody>' + inv.map(i => '<tr class="click" onclick="location.hash=\'#/finanzas/facturacion\'"><td class="mono small">' + esc(i.id) + '</td><td>' + esc(i.type) + '</td><td class="small">' + esc(Q.clientName(i.clientId)) + '</td><td class="nowrap">' + dateShort(i.date) + '</td><td class="num nowrap">' + (i.type === 'Nota de crédito' ? '−' : '') + money(i.amount, i.currency) + '</td><td>' + UI.badge(i.status) + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
        UI.card('Cierre del periodo · ' + monthName(), '<div class="row between small" style="margin-bottom:6px"><span class="muted">' + done + ' de ' + checks.length + ' controles</span>' + (pc.closed ? UI.badge('cerrada', 'Periodo cerrado') : UI.badge('abierta', 'Abierto')) + '</div>' + UI.progress(done / checks.length * 100, done === checks.length ? 'ok' : 'sun') +
          '<div style="margin-top:10px">' + checks.map(c => '<div class="stat-line" style="align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap;min-width:0">' + (c.manual ? '<input type="checkbox" data-chk="' + c.id + '"' + (pc.checks[c.id] ? ' checked' : '') + (pc.closed || !canClose ? ' disabled' : '') + ' aria-label="' + esc(c.label) + '">' : '<span class="' + (c.auto ? 'ok' : 'bad') + '" style="display:inline-flex;width:16px">' + UI.icon(c.auto ? 'checkCircle' : 'alert') + '</span>') + '<span>' + esc(c.label) + (c.detail ? '<div class="xs ' + (c.auto ? 'faint' : 'bad') + '">' + (c.href && !c.auto ? '<a href="' + c.href + '">' + esc(c.detail) + '</a>' : esc(c.detail)) + '</div>' : c.manual && pc.checks[c.id] ? '<div class="xs faint">Revisado por ' + esc(Q.userName(pc.checks[c.id].by)) + '</div>' : '<div class="xs faint">Control manual</div>') + '</span></span></div>').join('') + '</div>',
          { footer: pc.closed ? '<span class="xs faint">Cerrado por ' + esc(Q.userName(pc.closed.by)) + ' el ' + UI.datetime(pc.closed.ts) + '</span>' : (canClose ? '<button class="btn sm primary" id="pc-close">' + UI.icon('lock') + 'Cerrar periodo</button>' : '<button class="btn sm" disabled title="Requiere permiso finance.invoicing">Cerrar periodo</button>') }) +
      '</div>' +
      '<div class="grid g2">' +
        UI.card('Cobros sin comprobante', listOr(noDoc.map(p => li('#/finanzas/facturacion', '<div class="ico-box sun">' + UI.icon('receipt') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(p.id) + ' · ' + esc(p.method) + '</div><div class="xs faint">' + esc(p.resId) + ' · ' + date(p.date) + '</div></div><b class="small nowrap">' + money(p.amount, p.currency) + '</b>')), 'Todos los cobros aplicados tienen comprobante emitido'), { tight: true }) +
        UI.card('CxC abiertas', listOr(cxc.map(r => li('#/finanzas/cobros', '<div class="ico-box ' + (daysFromToday(r.due) < 0 ? 'bad' : '') + '">' + UI.icon('wallet') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(r.id) + ' · ' + esc(Q.clientName(r.clientId)) + '</div><div class="xs faint">' + esc(r.concept) + ' · vence ' + dateShort(r.due) + '</div></div><div class="right"><b class="small nowrap">' + money(r.amount - r.paid, r.currency) + '</b>' + UI.badge(r.status) + '</div>')), 'Sin cuentas por cobrar abiertas'), { tight: true }) +
      '</div></div>';

    el.querySelectorAll('[data-chk]').forEach(cb => cb.onchange = () => {
      if (!Auth.can('finance.invoicing') || pc.closed) { cb.checked = !cb.checked; UI.toast('Requiere permiso finance.invoicing y periodo abierto.', 'bad'); return; }
      const id = cb.dataset.chk; if (cb.checked) pc.checks[id] = { by: Auth.user.id, ts: nowStr() }; else delete pc.checks[id];
      DB.periodClose = pc; Audit.log('Cierre contable', pc.period, cb.checked ? 'control_ok' : 'control_reabierto', '', id); Store.save(); App.render();
    });
    const btn = el.querySelector('#pc-close');
    if (btn) btn.onclick = () => {
      const pend = checks.filter(c => !ok(c));
      if (pend.length) { UI.toast('No se puede cerrar ' + monthName() + ': ' + pend.length + ' control(es) pendiente(s) — ' + esc(pend.map(c => c.label).join('; ')) + '.', 'bad'); return; }
      UI.confirm({ title: 'Cerrar periodo ' + monthName(), message: 'Tras el cierre no se podrán emitir comprobantes con fecha del periodo; los ajustes se registran con notas de crédito/débito en el periodo siguiente.', confirmLabel: 'Cerrar periodo', onConfirm: () => {
        pc.closed = { by: Auth.user.id, ts: nowStr() }; DB.periodClose = pc;
        Audit.log('Cierre contable', pc.period, 'cerrar_periodo', 'abierto', 'cerrado'); Notify.push('contabilidad.cierre', 'Email', 'U07', 'Periodo ' + monthName() + ' cerrado por ' + Auth.user.name); Store.save(); UI.toast('Periodo ' + monthName() + ' cerrado.'); App.render();
      } });
    };
  }

  /* ---------------- Mapa de procesos (DOC-PROC-001) ---------------- */
  const ROLE_STAGES = {
    sales: ['Lead', 'Oportunidad', 'Actividad', 'Cotización', 'Reserva', 'Postventa'],
    manager: ['Oportunidad', 'Aprobación', 'Reserva', 'Rentabilidad', 'Reporte', 'Postventa'],
    operations: ['Reserva', 'Disponibilidad', 'Orden operativa', 'Asignación', 'Voucher', 'Ejecución'],
    finance: ['Cobro', 'Costo', 'Rentabilidad', 'Reporte'],
    accounting: ['Cobro', 'Reporte']
  };
  App.register('flujo', (el) => {
    const chain = [
      ['Lead', '#/crm/leads', 'funnel'], ['Oportunidad', '#/crm/oportunidades', 'target'], ['Actividad', '#/crm/actividades', 'calendar'], ['Cotización', '#/cotizaciones', 'file'], ['Aprobación', '#/cotizaciones', 'fileCheck'], ['Reserva', '#/reservas', 'suitcase'], ['Disponibilidad', '#/catalogo/salidas', 'calendar'], ['Orden operativa', '#/operaciones/ordenes', 'clipboard'], ['Asignación', '#/operaciones/asignaciones', 'truck'], ['Voucher', '#/operaciones/vouchers', 'ticket'], ['Ejecución', '#/mobile/operador', 'phone'], ['Cobro', '#/finanzas/cobros', 'wallet'], ['Costo', '#/finanzas/proveedores', 'coins'], ['Rentabilidad', '#/finanzas/rentabilidad', 'trending'], ['Portal', '#/canales/portal-cliente', 'globe'], ['Reporte', '#/reportes', 'chart'], ['Postventa', '#/crm/postventa', 'heart']
    ];
    const states = [
      ['Cotización', ['Borrador', 'Enviada', 'Vista', 'Negociación', 'Aprobada', 'Convertida en reserva'], 'Alternativos: rechazada, vencida, cancelada'],
      ['Reserva', ['Borrador', 'Pend. disponibilidad', 'Confirmada', 'En operación', 'Completada'], 'Alternativos: cancelada, reprogramada, parcial, pendiente de pago, pendiente de proveedor, incidencia'],
      ['Disponibilidad', ['Disponible', 'Hold', 'Confirmada', 'Consumida'], 'Alternativos: liberada, expirada'],
      ['Operación', ['Planificada', 'Pend. asignación', 'Asignada', 'Confirmada', 'En ejecución', 'Completada'], ''],
      ['Pago', ['Pendiente', 'Confirmado', 'Aplicado'], 'Alternativo: revertido'],
      ['Cuenta por cobrar / pagar', ['Abierta', 'Parcial', 'Pagada'], 'Alternativos: vencida, cancelada'],
      ['Producto turístico', ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE'], 'Alternativos: SUSPENDED, INACTIVE, ARCHIVED']
    ];
    const procs = [
      ['Administración', 'PROC-001 a 003', 'Alta de tenant, usuarios, roles, permisos y configuración', '#/admin/usuarios'],
      ['CRM', 'PROC-004 a 010', 'Captación, calificación, oportunidades, actividades, Customer 360, postventa y fidelización', '#/crm/leads'],
      ['Catálogo', 'PROC-011 a 020', 'Destinos, proveedores, servicios, productos, paquetes, itinerarios, tarifas, pricing, temporadas, disponibilidad', '#/catalogo/productos'],
      ['Cotización', 'PROC-021 a 024', 'Creación, versionamiento, envío con enlace y aprobación o rechazo', '#/cotizaciones'],
      ['Reservas', 'PROC-025 a 030', 'Conversión, reserva, modificación, cancelación, reprogramación y reservas grupales/B2B', '#/reservas'],
      ['Operaciones', 'PROC-031 a 039', 'Orden operativa, solicitud a proveedor, asignación, rooming, voucher, ejecución, incidencias, evidencias y cierre', '#/operaciones/ordenes'],
      ['Finanzas', 'PROC-040 a 050', 'CxC, anticipos, pagos, reversión, CxP, costos, comisiones, rentabilidad, conciliación y facturación', '#/finanzas/cobros'],
      ['Canales', 'PROC-051 a 055', 'Portal cliente, portal pasajero, B2B, e-commerce y CMS', '#/canales/b2b'],
      ['Mobile', 'PROC-056 a 058', 'App operador, app pasajero y modo offline con sincronización', '#/mobile/operador'],
      ['Plataforma', 'PROC-059 a 065', 'Notificaciones, reportes, exportación, autenticación, auditoría e integraciones', '#/admin/auditoria']
    ];
    const e2e = [
      ['E2E-01', 'Lead → oportunidad → actividad → cotización → aprobación', '#/crm/leads'],
      ['E2E-02', 'Cotización aprobada → reserva', '#/cotizaciones/COT-2026-00191'],
      ['E2E-03', 'Reserva → servicios → proveedor → asignación → voucher', '#/reservas/RES-2026-000348'],
      ['E2E-04', 'Asignación → check-in → ejecución → evidencia → fin', '#/mobile/operador'],
      ['E2E-05', 'Reserva → obligación → pago → costo → rentabilidad', '#/finanzas/cobros'],
      ['E2E-06', 'Reserva → viaje → itinerario → documentos en portal', '#/canales/portal-pasajero'],
      ['E2E-07', 'Asignación → operador mobile → ejecución → sincronización', '#/mobile/operador'],
      ['E2E-08', 'Tenant A no puede acceder a Tenant B', '#/admin/tenants'],
      ['E2E-09', 'Cancelación → disponibilidad → finanzas → auditoría', '#/reservas'],
      ['E2E-10', 'Incidencia → alerta → resolución → cierre', '#/operaciones/incidencias']
    ];
    const can = (href) => Access.canRoute(href.replace(/^#\//, ''));
    const role = Auth.role;
    const mine = ROLE_STAGES[role] || (role === 'tenant_admin' ? chain.map(c => c[0]) : []);
    const NA = 'No disponible para su rol';
    const naTag = '<span class="tag" title="' + NA + '">' + UI.icon('lock') + NA + '</span>';
    const nMine = chain.filter(c => mine.includes(c[0]) && can(c[1])).length;
    const nOk = chain.filter(c => can(c[1])).length;

    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Mapa de procesos', subtitle: 'Recorrido funcional de extremo a extremo según el Documento de Flujo de Procesos DOC-PROC-001 v1.0. Se resaltan las etapas a cargo de su rol (' + esc(Q.roleName(role)) + '); las pantallas que su rol no puede abrir se muestran como no disponibles.', crumbs: [['Inicio', '#/dashboard'], ['Mapa de procesos']] }) +
      UI.card('Flujo E2E P0 del MVP', '<div class="flow" style="padding:8px 0">' + chain.map((c, i) => {
        const ok = can(c[1]); const me = ok && mine.includes(c[0]);
        const inner = '<div class="flow-dot">' + UI.icon(ok ? c[2] : 'lock') + '</div><div class="flow-lbl" style="color:' + (me ? 'var(--fg)' : ok ? 'var(--fg-2)' : 'var(--fg-3)') + '">' + c[0] + (ok ? '' : '<br><span class="xs">no disponible</span>') + '</div>';
        return '<div class="flow-step ' + (me ? 'done cur' : '') + '"' + (ok ? '' : ' style="opacity:.5"') + '>' + (ok ? '<a class="flow-node" href="' + c[1] + '" style="text-decoration:none" title="' + (me ? 'Etapa a cargo de su rol' : 'Puede consultar esta etapa') + '">' + inner + '</a>' : '<div class="flow-node" title="' + NA + '" aria-disabled="true">' + inner + '</div>') + (i < chain.length - 1 ? '<div class="flow-line"></div>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="legend" style="margin-top:10px"><span><i style="background:var(--accent)"></i>A cargo de su rol (' + nMine + ')</span><span><i style="background:var(--line)"></i>Puede consultar (' + (nOk - nMine) + ')</span><span><i style="background:var(--surface-3)"></i>No disponible para su rol (' + (chain.length - nOk) + ')</span></div>' +
      '<p class="small muted" style="margin-top:10px">Flujo oficial resumido: CAPTAR → CALIFICAR → VENDER → COTIZAR → APROBAR → RESERVAR → CONFIRMAR → OPERAR → EJECUTAR → COBRAR → LIQUIDAR → CERRAR → POSTVENDER → FIDELIZAR.</p>') +
      '<div class="grid g2">' +
        UI.card('Máquinas de estado', '<div class="col" style="gap:18px">' + states.map(s => '<div><div class="row between"><h4>' + s[0] + '</h4></div>' + UI.flow(s[1], s[1].length) + (s[2] ? '<div class="xs faint">' + s[2] + '</div>' : '') + '</div>').join('') + '</div>') +
        '<div class="stack">' + UI.card('Dominios y procesos', '<div class="list">' + procs.map(p => can(p[3]) ? '<a class="list-item click" href="' + p[3] + '" style="color:inherit;text-decoration:none"><div class="grow"><div class="row" style="gap:8px"><b class="small">' + p[0] + '</b><span class="tag mono">' + p[1] + '</span></div><div class="xs faint" style="margin-top:2px">' + p[2] + '</div></div>' + UI.icon('chevronRight') + '</a>' : '<div class="list-item" style="opacity:.6" title="' + NA + '"><div class="grow"><div class="row" style="gap:8px"><b class="small">' + p[0] + '</b><span class="tag mono">' + p[1] + '</span>' + naTag + '</div><div class="xs faint" style="margin-top:2px">' + p[2] + '</div></div></div>').join('') + '</div>', { tight: true }) +
        UI.card('Casos E2E obligatorios', '<div class="list">' + e2e.map(p => can(p[2]) ? '<a class="list-item click" href="' + p[2] + '" style="color:inherit;text-decoration:none"><span class="tag mono">' + p[0] + '</span><div class="grow small">' + p[1] + '</div>' + UI.icon('chevronRight') + '</a>' : '<div class="list-item" style="opacity:.6" title="' + NA + '"><span class="tag mono">' + p[0] + '</span><div class="grow small">' + p[1] + '<div class="xs faint">' + NA + '</div></div>' + UI.icon('lock') + '</div>').join('') + '</div>', { tight: true }) + '</div>' +
      '</div>' +
      UI.card('Matriz de handoff entre dominios', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Origen</th><th>Destino</th><th>Entregable</th></tr></thead><tbody>' + [['Canal / Marketing', 'CRM', 'Lead'], ['CRM', 'Comercial', 'Oportunidad'], ['Comercial', 'Cotización', 'Contexto / requerimiento'], ['Cotización', 'Reserva', 'Versión aprobada (snapshot)'], ['Reserva', 'Operaciones', 'Servicios / pasajeros / fechas'], ['Operaciones', 'Finanzas', 'Costos / ejecución'], ['Finanzas', 'Administración', 'Saldos / rentabilidad'], ['Operaciones', 'Portal', 'Itinerario / vouchers / estado'], ['Operaciones', 'Mobile', 'Asignaciones'], ['Todos', 'Reportes', 'Datos analíticos'], ['Viaje cerrado', 'CRM', 'Historial / postventa']].map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      '</div>';
  });
})();
