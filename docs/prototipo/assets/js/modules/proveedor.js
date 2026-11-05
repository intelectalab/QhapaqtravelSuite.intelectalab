/* ==========================================================================
   Extranet de proveedores (supplier portal) — PROC-032 / PROC-034 / PROC-035 / PROC-044
   El proveedor (p. ej. U17 → PRV-001) solo ve SUS solicitudes, rooming lists, vouchers,
   cuentas por pagar, incidencias y contrato. Nunca ve precios de venta de la agencia,
   datos comerciales del cliente ni márgenes: solo grupo/titular, pax y su tarifa neta.
   ========================================================================== */
(function () {
  const { esc, money, fmtN, date, dateShort, datetime, sum, daysFromToday, nowStr } = Util;
  const ic = (n) => UI.icon(n);

  /* ---- Solicitudes de demostración para la extranet (una sola vez, idempotente) ----
     Los datos semilla no tienen solicitudes pendientes para el hotel PRV-001; se agregan dos
     servicios "solicitado" coherentes con reservas existentes para que la demo sea operable. */
  (function seedDemo() {
    try {
      const has = (id) => DB.reservations.some(r => r.services.some(s => s.id === id));
      const r344 = DB.reservations.find(r => r.id === 'RES-2026-000344');
      const r348 = DB.reservations.find(r => r.id === 'RES-2026-000348');
      let ch = false;
      if (r344 && !has('RS-3442')) { r344.services.push({ id: 'RS-3442', productId: 'PRD-003', name: 'Hotel Tambo Real — 1 hab. doble + 1 twin × 1 noche (retorno a Cusco)', date: '2026-10-13', time: '15:00', providerId: 'PRV-001', status: 'solicitado', cost: 190, price: 250, confirmationCode: '', requestedAt: '2026-09-25 11:20', requestedBy: 'U06', nights: 1, rooms: 2 }); ch = true; }
      if (r348 && !has('RS-3489')) { r348.services.push({ id: 'RS-3489', productId: 'PRD-002', name: 'Late check-out 6 hab. hasta 18:00 (vuelo nocturno)', date: '2026-10-05', time: '12:00', providerId: 'PRV-001', status: 'solicitado', cost: 540, price: 780, confirmationCode: '', requestedAt: '2026-09-28 16:05', requestedBy: 'U06', rooms: 6 }); ch = true; }
      if (ch) Store.save();
    } catch (e) { /* sin datos */ }
  })();

  /* ---- CSS propio del portal ---- */
  if (!document.getElementById('css-proveedor')) {
    const st = document.createElement('style'); st.id = 'css-proveedor';
    st.textContent = '.pv-pg{max-width:1280px;margin:0 auto}' +
      '.pv-id{display:flex;gap:12px;align-items:center;min-width:0}.pv-id .ico-box{width:40px;height:40px}' +
      '.pv-actions{display:flex;gap:6px;flex-wrap:wrap}' +
      '.pv-rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}' +
      '.pv-room{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface);min-width:0}' +
      '.pv-room.obs{border-color:var(--warn);background:var(--warn-soft)}' +
      '.pv-code{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pv-code .input{max-width:260px}' +
      '.pv-note{border-left:3px solid var(--line);padding:4px 10px;margin-top:6px;font-size:.78rem;color:var(--fg-2)}' +
      '@media (max-width:560px){.pv-code .input{max-width:none;flex:1 1 100%}.pv-actions .btn{flex:1 1 auto}}';
    document.head.appendChild(st);
  }

  /* ---- Contexto del proveedor ---- */
  const PID = () => Auth.providerId;
  const prov = () => Q.provider(PID()) || { name: 'Proveedor', currency: 'PEN' };
  const OPS = ['U05', 'U06'];
  const PENDING = ['solicitado', 'pendiente'];

  /* Servicios de reservas asignados al proveedor (sin borradores de la agencia) */
  function myServices() {
    return DB.reservations.filter(r => r.status !== 'borrador').flatMap(r => r.services.filter(s => s.providerId === PID()).map(s => ({ s, r })));
  }
  const paxOf = (r) => (r.passengers || []).length;
  function holder(r) {
    const p = (r.passengers || [])[0];
    if (paxOf(r) >= 6) return 'Grupo: ' + r.title.split(' — ')[0];
    return p ? 'Titular: ' + p.name : r.title.split(' — ')[0];
  }
  const myRooming = () => DB.rooming.filter(x => x.hotel === PID());
  const myVouchers = () => DB.vouchers.filter(v => v.providerId === PID());
  const myPayables = () => DB.payables.filter(p => p.providerId === PID());
  const myResIds = () => new Set(myServices().map(x => x.r.id));
  function myIncidents() {
    const ids = myResIds();
    return DB.incidents.filter(i => i.providerId === PID() || i.reportedBy === Auth.user.id || (i.type === 'Proveedor' && ids.has(i.resId)));
  }
  const myRateReqs = () => (DB.providerRequests || []).filter(x => x.providerId === PID());

  function svcState(s) {
    if (PENDING.includes(s.status) && s.providerResponse && s.providerResponse.type === 'alternativa') return UI.badge('pendiente', 'Alternativa propuesta');
    if (PENDING.includes(s.status)) return UI.badge('pendiente', 'Por responder');
    return UI.badge(s.status);
  }
  const isPending = (s) => PENDING.includes(s.status) && !(s.providerResponse && s.providerResponse.type === 'alternativa');

  function notifyOps(event, subject) { OPS.forEach(u => Notify.push(event, 'Portal', u, subject)); }
  function nextInc() { const n = Math.max(0, ...DB.incidents.map(i => parseInt(String(i.id).replace(/\D/g, ''), 10) || 0)) + 1; return 'INC-' + String(n).padStart(4, '0'); }
  function opOf(resId) { return DB.operations.find(o => o.resId === resId); }

  /* Saldo por moneda (sin conversión: el proveedor factura en su moneda de contrato) */
  function byCur(rows, f) { const m = {}; rows.forEach(r => { const c = r.currency || 'PEN'; m[c] = (m[c] || 0) + f(r); }); return m; }
  const curTxt = (m) => Object.keys(m).filter(k => Math.abs(m[k]) > 0.004).map(k => money(m[k], k)).join(' + ') || money(0, prov().currency || 'PEN');

  /* ---- Marco común: encabezado + KPIs ---- */
  function frame(el, { title, subtitle, crumb, body, actions = '' }) {
    const p = prov();
    const svc = myServices();
    const pend = svc.filter(x => isPending(x.s)).length;
    const alt = svc.filter(x => PENDING.includes(x.s.status) && !isPending(x.s)).length;
    const arrivals = svc.filter(x => !['cancelado', 'rechazado'].includes(x.s.status) && daysFromToday(x.s.date) >= 0 && daysFromToday(x.s.date) <= 7);
    const arrPax = sum(arrivals, x => paxOf(x.r));
    const open = myPayables().filter(x => x.status !== 'pagada');
    const bal = byCur(open, x => x.amount - (x.paid || 0));
    const inc = myIncidents().filter(i => !['cerrada', 'resuelta'].includes(i.status));
    el.innerHTML = '<div class="page pv-pg">' +
      UI.pageHeader({ title, subtitle, crumbs: [[p.name, '#/proveedor/solicitudes'], [crumb]], actions }) +
      (Auth.providerId ? '' : UI.alert('bad', 'Su usuario no está vinculado a un proveedor. Contacte a la agencia.')) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Solicitudes por responder', value: pend, sub: alt ? alt + ' con alternativa en revisión' : 'Responder en máx. 24 h', tone: pend ? 'sun' : 'ok', icon: 'clipboard' }) +
        UI.kpi({ label: 'Llegadas próximos 7 días', value: arrivals.length, sub: arrPax + ' pax', tone: 'info', icon: 'calendar' }) +
        UI.kpi({ label: 'Saldo por cobrar a la agencia', value: '<span style="font-size:1.05rem">' + curTxt(bal) + '</span>', sub: open.length + ' documento(s) abiertos', tone: 'accent', icon: 'wallet' }) +
        UI.kpi({ label: 'Incidencias abiertas', value: inc.length, sub: inc.length ? 'Requieren seguimiento' : 'Sin pendientes', tone: inc.length ? 'bad' : 'ok', icon: 'alert' }) +
      '</div>' + body + '</div>';
  }

  /* ======================= SOLICITUDES ======================= */
  function solicitudes(el) {
    const rows = () => myServices().sort((a, b) => (isPending(b.s) - isPending(a.s)) || (a.s.date + a.s.time).localeCompare(b.s.date + b.s.time));
    frame(el, { title: 'Solicitudes de servicio', crumb: 'Solicitudes', subtitle: 'Servicios que la agencia le solicitó. Confirme con su código de reserva, rechace indicando el motivo o proponga una alternativa. Operaciones recibe su respuesta al instante.',
      body: (rows().some(x => isPending(x.s)) ? UI.alert('warn', '<b>Tiene ' + rows().filter(x => isPending(x.s)).length + ' solicitud(es) por responder.</b> Una solicitud sin respuesta bloquea la emisión del voucher al pasajero (Regla transversal 11).') : UI.alert('ok', 'No tiene solicitudes pendientes de respuesta.')) + '<div id="pv-tbl"></div>' });
    UI.dataTable(el.querySelector('#pv-tbl'), {
      rows, exportName: 'solicitudes-proveedor', pageSize: 10, searchPlaceholder: 'Buscar reserva, servicio, titular…',
      search: (x) => [x.r.id, x.s.id, x.s.name, holder(x.r), x.s.confirmationCode].join(' '),
      filters: [{ label: 'Estado', options: [['pend', 'Por responder'], ['alt', 'Alternativa propuesta'], ['confirmado', 'Confirmado'], ['rechazado', 'Rechazado'], ['completado', 'Completado'], ['cancelado', 'Cancelado']], match: (x, v) => v === 'pend' ? isPending(x.s) : v === 'alt' ? (PENDING.includes(x.s.status) && !isPending(x.s)) : x.s.status === v }],
      columns: [
        { key: 'date', label: 'Fecha', sortVal: x => x.s.date + x.s.time, render: x => '<b class="nowrap">' + dateShort(x.s.date) + '</b><div class="xs faint nowrap">' + esc(x.s.time) + (daysFromToday(x.s.date) >= 0 && daysFromToday(x.s.date) <= 2 ? ' · <span class="warn">en ' + daysFromToday(x.s.date) + ' d</span>' : '') + '</div>', csv: x => x.s.date + ' ' + x.s.time },
        { key: 'svc', label: 'Servicio solicitado', sortVal: x => x.s.name, render: x => '<div class="cell-main">' + esc(x.s.name) + '</div><div class="cell-sub mono">' + esc(x.r.id) + ' · ' + esc(x.s.id) + '</div>', csv: x => x.s.name },
        { key: 'holder', label: 'Grupo / titular', sortVal: x => holder(x.r), render: x => '<span class="small">' + esc(holder(x.r)) + '</span>', csv: x => holder(x.r) },
        { key: 'pax', label: 'Pax', align: 'num', sortVal: x => paxOf(x.r), render: x => String(paxOf(x.r)), csv: x => paxOf(x.r) },
        { key: 'cost', label: 'Tarifa neta', align: 'num', sortVal: x => x.s.cost, render: x => '<span class="nowrap">' + money(x.s.cost, x.r.currency) + '</span>', csv: x => x.s.cost },
        { key: 'st', label: 'Estado', sortVal: x => x.s.status, render: x => svcState(x.s) + (x.s.confirmationCode ? '<div class="xs mono faint" style="margin-top:3px">' + esc(x.s.confirmationCode) + '</div>' : ''), csv: x => x.s.status + (x.s.confirmationCode ? ' ' + x.s.confirmationCode : '') },
        { key: '', label: '', sort: false, render: x => PENDING.includes(x.s.status) ? '<div class="pv-actions"><button class="btn xs primary" data-conf="' + x.s.id + '">' + ic('check') + 'Confirmar</button><button class="btn xs" data-alt="' + x.s.id + '">Alternativa</button><button class="btn xs danger" data-rej="' + x.s.id + '">Rechazar</button></div>' : '<button class="btn xs ghost" data-view="' + x.s.id + '">Ver detalle</button>', csv: () => '' }
      ],
      onRow: (x) => detail(x),
      afterDraw: (c) => {
        const find = (id) => myServices().find(x => x.s.id === id);
        c.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => confirmSvc(find(b.dataset.conf)));
        c.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => rejectSvc(find(b.dataset.rej)));
        c.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => altSvc(find(b.dataset.alt)));
        c.querySelectorAll('[data-view]').forEach(b => b.onclick = () => detail(find(b.dataset.view)));
      }
    });
  }

  function guardOwn(x) {
    if (!x || x.s.providerId !== PID()) { UI.toast('La solicitud no corresponde a su establecimiento.', 'bad'); return false; }
    if (!PENDING.includes(x.s.status)) { UI.toast('La solicitud ya fue respondida (' + esc(UI.statusLabel(x.s.status)) + '). Para cambios contacte a Operaciones.', 'bad'); return false; }
    return true;
  }
  function svcSummary(x) {
    return UI.dl([['Reserva de la agencia', '<span class="mono">' + esc(x.r.id) + '</span>'], ['Servicio', esc(x.s.name)], ['Fecha y hora', date(x.s.date) + ' · ' + esc(x.s.time)], ['Grupo / titular', esc(holder(x.r))], ['Pasajeros', String(paxOf(x.r))], ['Tarifa neta acordada', money(x.s.cost, x.r.currency)]]);
  }
  function confirmSvc(x) {
    if (!guardOwn(x)) return;
    UI.modal({ title: 'Confirmar solicitud', sub: esc(x.s.id) + ' · ' + esc(x.r.id), body: svcSummary(x) + '<div style="height:12px"></div>' + UI.form([
      { id: 'code', label: 'Código de confirmación del hotel', required: true, placeholder: 'Ej.: TR-55620', col: 6, hint: 'Obligatorio: se imprime en el voucher del pasajero.' },
      { id: 'by', label: 'Confirmado por', value: prov().contact || '', col: 6 },
      { id: 'note', label: 'Observación para la agencia (opcional)', type: 'textarea', rows: 2, col: 12, placeholder: 'Ej.: Habitaciones en piso 3, desayuno desde 05:00 por salida temprana.' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar servicio', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        if (f.code.length < 4) { UI.toast('El código de confirmación debe tener al menos 4 caracteres.', 'bad'); return false; }
        const before = x.s.status;
        x.s.status = 'confirmado'; x.s.confirmationCode = f.code.toUpperCase();
        x.s.providerResponse = { type: 'confirmacion', ts: nowStr(), user: Auth.user.id, by: f.by, note: f.note };
        Audit.log('Servicio', x.s.id, 'proveedor_confirma', before, 'confirmado ' + x.s.confirmationCode);
        notifyOps('proveedor.confirmacion', prov().name + ' confirmó ' + x.s.id + ' (' + x.r.id + ') · código ' + x.s.confirmationCode);
        Store.save(); UI.toast('Solicitud confirmada con código ' + esc(x.s.confirmationCode) + '. Operaciones fue notificada.'); App.render();
      } }] });
  }
  function rejectSvc(x) {
    if (!guardOwn(x)) return;
    UI.modal({ title: 'Rechazar solicitud', sub: esc(x.s.id) + ' · ' + esc(x.r.id), size: 'sm', body: svcSummary(x) + '<div style="height:12px"></div>' + UI.form([
      { id: 'why', label: 'Motivo', type: 'select', required: true, placeholder: 'Seleccione…', options: ['Sin disponibilidad (sold out)', 'Fecha bloqueada por mantenimiento', 'Tarifa no vigente para la fecha', 'Cupo de grupo excedido', 'Otro'], col: 12 },
      { id: 'det', label: 'Detalle', type: 'textarea', rows: 2, required: true, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Rechazar', cls: 'danger', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const before = x.s.status;
        x.s.status = 'rechazado'; x.s.providerResponse = { type: 'rechazo', ts: nowStr(), user: Auth.user.id, reason: f.why, note: f.det };
        Audit.log('Servicio', x.s.id, 'proveedor_rechaza', before, 'rechazado: ' + f.why);
        notifyOps('proveedor.rechazo', prov().name + ' rechazó ' + x.s.id + ' (' + x.r.id + '): ' + f.why);
        Store.save(); UI.toast('Solicitud rechazada. Operaciones buscará otra alternativa.', 'warn'); App.render();
      } }] });
  }
  function altSvc(x) {
    if (!guardOwn(x)) return;
    const own = DB.services.filter(s => s.providerId === PID() && s.status === 'activo');
    UI.modal({ title: 'Proponer alternativa', sub: esc(x.s.id) + ' · ' + esc(x.r.id), body: svcSummary(x) + '<div style="height:12px"></div>' + UI.form([
      { id: 'kind', label: 'Tipo de alternativa', type: 'select', required: true, options: ['Otra fecha', 'Otro tipo de habitación', 'Otro horario', 'Upgrade sin costo', 'Otro'], col: 6 },
      { id: 'date', label: 'Fecha propuesta', type: 'date', value: x.s.date, col: 6 },
      { id: 'svc', label: 'Servicio / tarifa propuesta', type: 'select', options: [['', 'Mismo servicio']].concat(own.map(s => [s.id, s.name + ' · ' + money(s.cost, s.currency)])), col: 12 },
      { id: 'cost', label: 'Tarifa neta propuesta', type: 'number', step: '0.01', value: x.s.cost, col: 6, hint: 'Moneda de la reserva: ' + x.r.currency },
      { id: 'hold', label: 'Mantener bloqueo hasta', type: 'date', value: Util.addDays(window.TODAY, 2), col: 6 },
      { id: 'det', label: 'Detalle de la propuesta', type: 'textarea', rows: 2, required: true, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Enviar propuesta', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        x.s.providerResponse = { type: 'alternativa', ts: nowStr(), user: Auth.user.id, kind: f.kind, date: f.date, serviceId: f.svc, cost: f.cost, holdUntil: f.hold, note: f.det };
        Audit.log('Servicio', x.s.id, 'proveedor_alternativa', x.s.status, f.kind + ' · ' + f.date + ' · ' + f.cost);
        notifyOps('proveedor.alternativa', prov().name + ' propone alternativa para ' + x.s.id + ' (' + x.r.id + '): ' + f.kind);
        Store.save(); UI.toast('Propuesta enviada. Operaciones la revisará y le responderá por este portal.'); App.render();
      } }] });
  }
  function detail(x) {
    if (!x) return;
    const pr = x.s.providerResponse;
    const rl = DB.rooming.find(r => r.resId === x.r.id && r.hotel === PID());
    const vou = myVouchers().filter(v => v.serviceId === x.s.id);
    UI.drawer({ title: esc(x.s.name), sub: esc(x.r.id) + ' · ' + esc(x.s.id), body: svcSummary(x) +
      '<div class="divider" style="margin:14px 0"></div>' + UI.dl([['Estado', svcState(x.s)], ['Código de confirmación', x.s.confirmationCode ? '<span class="mono">' + esc(x.s.confirmationCode) + '</span>' : '—'], ['Solicitado', x.s.requestedAt ? datetime(x.s.requestedAt) : '—'], ['Rooming list', rl ? rl.rooms.length + ' hab. · <a href="#/proveedor/rooming">ver</a>' : '—'], ['Voucher', vou.length ? vou.map(v => '<span class="mono">' + esc(v.id) + '</span> ' + UI.badge(v.status)).join('<br>') : 'Aún no emitido']]) +
      (pr ? '<div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:6px">Su respuesta</div><div class="small"><b>' + esc({ confirmacion: 'Confirmación', rechazo: 'Rechazo', alternativa: 'Alternativa propuesta' }[pr.type] || pr.type) + '</b> · ' + datetime(pr.ts) + '</div>' + (pr.reason ? '<div class="pv-note">' + esc(pr.reason) + '</div>' : '') + (pr.kind ? '<div class="pv-note">' + esc(pr.kind) + ' · ' + date(pr.date) + ' · ' + money(pr.cost || 0, x.r.currency) + (pr.holdUntil ? ' · bloqueo hasta ' + date(pr.holdUntil) : '') + '</div>' : '') + (pr.note ? '<div class="pv-note">' + esc(pr.note) + '</div>' : '') : '') +
      '<p class="xs faint" style="margin-top:14px">Por confidencialidad comercial, la extranet no muestra precios de venta ni datos de contacto del cliente final.</p>',
      actions: PENDING.includes(x.s.status) ? [{ label: 'Rechazar', cls: 'danger', onClick: () => rejectSvc(x) }, { label: 'Alternativa', onClick: () => altSvc(x) }, { label: 'Confirmar', cls: 'primary', icon: 'check', onClick: () => confirmSvc(x) }] : [{ label: 'Cerrar' }] });
  }

  /* ======================= ROOMING ======================= */
  function rooming(el) {
    const lists = myRooming().sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    frame(el, { title: 'Rooming lists', crumb: 'Rooming lists', subtitle: 'Distribución de huéspedes enviada por la agencia. Acuse recibo, confirme las habitaciones o reporte una observación (crea una incidencia para Operaciones).',
      body: lists.length ? lists.map((rl, i) => {
        const res = Q.reservation(rl.resId) || { passengers: [], title: rl.resId };
        const obs = rl.rooms.filter(r => r.status === 'observada').length;
        const nights = Util.daysBetween(rl.checkIn, rl.checkOut);
        const st = rl.hotelConfirmedAt ? UI.badge('confirmada', 'Confirmada por el hotel') : rl.hotelAck ? UI.badge('enviada', 'Recibida') : UI.badge('pendiente', 'Por acusar recibo');
        return UI.card('<span class="mono">' + esc(rl.resId) + '</span> · ' + esc(holder(res)) + ' ' + st,
          '<div class="row" style="gap:16px;margin-bottom:12px;flex-wrap:wrap"><span class="small"><span class="faint">Check-in</span> <b>' + date(rl.checkIn) + '</b></span><span class="small"><span class="faint">Check-out</span> <b>' + date(rl.checkOut) + '</b></span><span class="small"><span class="faint">Noches</span> <b>' + nights + '</b></span><span class="small"><span class="faint">Habitaciones</span> <b>' + rl.rooms.length + '</b></span><span class="small"><span class="faint">Huéspedes</span> <b>' + sum(rl.rooms, r => r.pax.length) + '</b></span>' + (daysFromToday(rl.checkIn) >= 0 && daysFromToday(rl.checkIn) <= 7 ? '<span class="tag">Llega en ' + daysFromToday(rl.checkIn) + ' d</span>' : daysFromToday(rl.checkIn) < 0 && daysFromToday(rl.checkOut) >= 0 ? '<span class="tag">En casa</span>' : '') + '</div>' +
          (obs ? UI.alert('warn', obs + ' habitación(es) con observación del hotel. Operaciones gestiona el cambio.') + '<div style="height:10px"></div>' : '') +
          '<div class="pv-rooms">' + rl.rooms.map((r, k) => '<div class="pv-room' + (r.status === 'observada' ? ' obs' : '') + '"><div class="row between" style="flex-wrap:nowrap"><b>Hab. ' + esc(r.room) + '</b>' + (r.status === 'observada' ? UI.badge('observado', 'Observada') : UI.badge(r.status || 'pendiente')) + '</div><div class="xs faint" style="margin:2px 0 6px">' + esc(r.type) + '</div>' + r.pax.map(p => '<div class="small">' + esc(p) + '</div>').join('') + (r.hotelNote ? '<div class="pv-note">' + esc(r.hotelNote) + '</div>' : '') + (r.status !== 'observada' ? '<button class="btn xs ghost" style="margin-top:8px" data-obs="' + i + ':' + k + '">' + ic('alert') + 'Reportar observación</button>' : '') + '</div>').join('') + '</div>',
          { footer: '<div class="pv-actions">' + (rl.hotelAck ? '<span class="xs faint" style="align-self:center">Recibida ' + datetime(rl.hotelAck.ts) + '</span>' : '<button class="btn sm" data-ack="' + i + '">' + ic('fileCheck') + 'Acusar recibo</button>') + (rl.hotelConfirmedAt ? '<span class="xs faint" style="align-self:center">· Confirmada ' + datetime(rl.hotelConfirmedAt) + '</span>' : '<button class="btn sm primary" data-rconf="' + i + '">' + ic('check') + 'Confirmar habitaciones</button>') + '</div>' });
      }).join('') : UI.card('', UI.empty('No tiene rooming lists asignadas.', 'bed')) });
    el.querySelectorAll('[data-ack]').forEach(b => b.onclick = () => { const rl = lists[+b.dataset.ack]; rl.hotelAck = { ts: nowStr(), user: Auth.user.id }; Audit.log('Rooming', rl.resId, 'acuse_recibo_hotel', '', prov().name); notifyOps('rooming.recibida', prov().name + ' acusó recibo de la rooming list ' + rl.resId); Store.save(); UI.toast('Acuse de recibo registrado.'); App.render(); });
    el.querySelectorAll('[data-rconf]').forEach(b => b.onclick = () => {
      const rl = lists[+b.dataset.rconf]; const obs = rl.rooms.filter(r => r.status === 'observada');
      UI.confirm({ title: 'Confirmar habitaciones', message: 'Se confirmarán ' + (rl.rooms.length - obs.length) + ' habitación(es) de la reserva <b>' + esc(rl.resId) + '</b>' + (obs.length ? '. Las ' + obs.length + ' observada(s) quedan pendientes hasta que Operaciones resuelva la incidencia.' : '.'), confirmLabel: 'Confirmar', onConfirm: () => {
        rl.rooms.forEach(r => { if (r.status !== 'observada') r.status = 'confirmada'; });
        if (!rl.hotelAck) rl.hotelAck = { ts: nowStr(), user: Auth.user.id };
        rl.hotelConfirmedAt = nowStr();
        Audit.log('Rooming', rl.resId, 'confirmacion_hotel', '', (rl.rooms.length - obs.length) + ' hab. confirmadas');
        notifyOps('rooming.confirmada', prov().name + ' confirmó la rooming list ' + rl.resId);
        Store.save(); UI.toast('Rooming list confirmada. Operaciones fue notificada.'); App.render();
      } });
    });
    el.querySelectorAll('[data-obs]').forEach(b => b.onclick = () => { const [i, k] = b.dataset.obs.split(':').map(Number); roomObs(lists[i], lists[i].rooms[k]); });
  }
  function roomObs(rl, r) {
    UI.modal({ title: 'Observación — hab. ' + esc(r.room), sub: esc(rl.resId) + ' · ' + date(rl.checkIn) + ' → ' + date(rl.checkOut), body: UI.form([
      { id: 'kind', label: 'Motivo', type: 'select', required: true, options: ['Habitación en mantenimiento', 'Tipo de habitación no disponible', 'Sobreventa (overbooking)', 'Datos de huésped incompletos', 'Otro'], col: 6 },
      { id: 'sev', label: 'Impacto', type: 'select', options: [['media', 'Media'], ['alta', 'Alta'], ['baja', 'Baja']], col: 6 },
      { id: 'prop', label: 'Propuesta del hotel', type: 'textarea', rows: 2, required: true, placeholder: 'Ej.: upgrade a junior suite sin costo adicional.', col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Reportar e informar a Operaciones', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const op = opOf(rl.resId);
        const inc = { id: nextInc(), opId: op ? op.id : null, resId: rl.resId, severity: f.sev || 'media', type: 'Proveedor', title: 'Hotel observa hab. ' + r.room + ' (' + f.kind.toLowerCase() + ')', desc: f.prop, status: 'abierta', assignee: op ? op.coordinator : 'U05', reportedBy: Auth.user.id, providerId: PID(), createdAt: nowStr(), evidence: [], log: [{ ts: nowStr(), u: Auth.user.id, m: 'Reporte desde extranet de proveedores' }] };
        DB.incidents.unshift(inc);
        r.status = 'observada'; r.hotelNote = f.kind + ': ' + f.prop;
        Audit.log('Incidencia', inc.id, 'crear', '', 'abierta / ' + inc.severity + ' (proveedor)');
        Audit.log('Rooming', rl.resId, 'observacion_hotel', 'hab. ' + r.room, f.kind);
        notifyOps('incidencia.creada', inc.id + ' ' + inc.title);
        Store.save(); UI.toast('Observación registrada como ' + inc.id + '. Operaciones fue notificada.'); App.render();
      } }] });
  }

  /* ======================= VOUCHERS ======================= */
  function vouchers(el) {
    const V = () => myVouchers().slice().sort((a, b) => b.date.localeCompare(a.date));
    frame(el, { title: 'Vouchers', crumb: 'Vouchers', subtitle: 'Vouchers emitidos por la agencia a nombre de su establecimiento. Valide el código al momento del check-in o del servicio para registrarlo como utilizado.',
      body: UI.card('Validar voucher en recepción', '<div class="pv-code"><input class="input" id="pv-code" placeholder="Código del voucher, p. ej. VOU-2026-01204" autocomplete="off" aria-label="Código de voucher"><button class="btn primary" id="pv-val">' + ic('fileCheck') + 'Validar y marcar como utilizado</button></div><div class="xs faint" style="margin-top:6px">Solo se aceptan vouchers vigentes emitidos a nombre de ' + esc(prov().name) + '. Un voucher anulado o ya utilizado no puede volver a usarse.</div>') + '<div id="pv-vt"></div>' });
    UI.dataTable(el.querySelector('#pv-vt'), {
      rows: V, exportName: 'vouchers-proveedor', searchPlaceholder: 'Buscar voucher o reserva…', search: v => [v.id, v.resId, v.service].join(' '),
      filters: [{ key: 'status', label: 'Estado', options: ['emitido', 'utilizado', 'anulado'] }],
      columns: [
        { key: 'id', label: 'Voucher', render: v => '<b class="mono">' + esc(v.id) + '</b><div class="xs faint">v' + v.version + ' · emitido ' + datetime(v.issuedAt) + '</div>' },
        { key: 'service', label: 'Servicio', render: v => '<div class="cell-main">' + esc(v.service) + '</div><div class="cell-sub mono">' + esc(v.resId) + '</div>' },
        { key: 'date', label: 'Fecha', render: v => date(v.date) },
        { key: 'pax', label: 'Pax', align: 'num' },
        { key: 'status', label: 'Estado', render: v => UI.badge(v.status) + (v.usedAt ? '<div class="xs faint" style="margin-top:3px">' + datetime(v.usedAt) + '</div>' : '') },
        { key: '', label: '', sort: false, render: v => v.status === 'emitido' ? '<button class="btn xs" data-use="' + v.id + '">' + ic('check') + 'Marcar utilizado</button>' : '', csv: () => '' }
      ],
      afterDraw: (c) => c.querySelectorAll('[data-use]').forEach(b => b.onclick = () => useVoucher(b.dataset.use, true))
    });
    const run = () => useVoucher(el.querySelector('#pv-code').value.trim().toUpperCase(), false);
    el.querySelector('#pv-val').onclick = run;
    el.querySelector('#pv-code').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  }
  function useVoucher(code, ask) {
    if (!code) { UI.toast('Ingrese el código del voucher.', 'bad'); return; }
    const v = DB.vouchers.find(x => x.id.toUpperCase() === code);
    if (!v || v.providerId !== PID()) { UI.toast('El código ' + esc(code) + ' no corresponde a un voucher emitido a su establecimiento.', 'bad'); return; }
    if (v.status === 'anulado') { UI.toast('Voucher anulado por la agencia: no es válido para el servicio.', 'bad'); return; }
    if (v.status === 'utilizado') { UI.toast('El voucher ' + esc(v.id) + ' ya fue utilizado el ' + (v.usedAt ? datetime(v.usedAt) : 'registro previo') + '.', 'warn'); return; }
    const d = daysFromToday(v.date);
    const doIt = () => {
      v.status = 'utilizado'; v.usedAt = nowStr(); v.usedBy = Auth.user.id;
      Audit.log('Voucher', v.id, 'check_in_proveedor', 'emitido', 'utilizado');
      notifyOps('voucher.utilizado', v.id + ' utilizado en ' + prov().name + ' (' + v.resId + ')');
      Store.save(); UI.toast('Voucher ' + esc(v.id) + ' registrado como utilizado.'); App.render();
    };
    UI.confirm({ title: 'Registrar uso del voucher', message: '<b class="mono">' + esc(v.id) + '</b> · ' + esc(v.service) + '<br>' + date(v.date) + ' · ' + v.pax + ' pax' + (d > 0 ? '<br><span class="warn">Atención: la fecha del servicio es dentro de ' + d + ' día(s). Registre el uso solo si el huésped ya se presentó.</span>' : ''), confirmLabel: 'Marcar como utilizado', onConfirm: doIt });
  }

  /* ======================= PAGOS ======================= */
  const PAY_LBL = { abierta: ['pendiente', 'En revisión'], aprobada: ['aprobada', 'Programado'], pagada: ['pagada', 'Pagado'], vencida: ['vencida', 'Vencido'], parcial: ['parcial', 'Pago parcial'] };
  function pagos(el) {
    const P = () => myPayables().slice().sort((a, b) => a.due.localeCompare(b.due));
    const open = P().filter(p => p.status !== 'pagada');
    frame(el, { title: 'Pagos de la agencia', crumb: 'Pagos', subtitle: 'Estado de sus cuentas por cobrar a ' + esc(DB.tenant.short) + '. Condición de pago: ' + esc(prov().paymentTerms || '—') + '. Para programar el pago, adjunte su factura electrónica.',
      body: (open.some(p => !p.providerInvoice) ? UI.alert('info', 'Hay ' + open.filter(p => !p.providerInvoice).length + ' documento(s) sin factura adjunta. Finanzas programa el pago solo con la factura registrada.') : '') + '<div id="pv-pt"></div>' });
    UI.dataTable(el.querySelector('#pv-pt'), {
      rows: P, exportName: 'pagos-proveedor', searchPlaceholder: 'Buscar documento o reserva…', search: p => [p.id, p.resId, p.concept, (p.providerInvoice || {}).number].join(' '),
      filters: [{ key: 'status', label: 'Estado', options: Object.keys(PAY_LBL).map(k => [k, PAY_LBL[k][1]]) }],
      columns: [
        { key: 'id', label: 'Documento', render: p => '<b class="mono">' + esc(p.id) + '</b><div class="xs faint mono">' + esc(p.resId) + '</div>' },
        { key: 'concept', label: 'Concepto' },
        { key: 'amount', label: 'Importe', align: 'num', render: p => money(p.amount, p.currency) },
        { key: 'bal', label: 'Saldo', align: 'num', sortVal: p => p.amount - (p.paid || 0), render: p => '<b>' + money(p.amount - (p.paid || 0), p.currency) + '</b>', csv: p => p.amount - (p.paid || 0) },
        { key: 'due', label: 'Fecha programada', render: p => date(p.due) + (p.status !== 'pagada' && daysFromToday(p.due) < 0 ? '<div class="xs bad">vencido hace ' + (-daysFromToday(p.due)) + ' d</div>' : p.status !== 'pagada' ? '<div class="xs faint">en ' + daysFromToday(p.due) + ' d</div>' : '') },
        { key: 'status', label: 'Estado', render: p => { const l = PAY_LBL[p.status] || [p.status]; return UI.badge(l[0], l[1]); }, csv: p => (PAY_LBL[p.status] || [p.status, p.status])[1] },
        { key: 'inv', label: 'Su factura', sortVal: p => (p.providerInvoice || {}).number || '', render: p => p.providerInvoice ? '<span class="mono small">' + esc(p.providerInvoice.number) + '</span><div class="xs faint">' + esc(p.providerInvoice.file || '') + '</div>' : (p.status === 'pagada' ? '<span class="faint">—</span>' : '<button class="btn xs" data-inv="' + p.id + '">' + ic('upload') + 'Subir factura</button>'), csv: p => (p.providerInvoice || {}).number || '' }
      ],
      footer: rows => { const m = byCur(rows, p => p.amount - (p.paid || 0)); return '<tr><td colspan="3"><b>Saldo total</b></td><td class="num"><b>' + curTxt(m) + '</b></td><td colspan="3"></td></tr>'; },
      afterDraw: (c) => c.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => uploadInv(DB.payables.find(p => p.id === b.dataset.inv)))
    });
  }
  function uploadInv(p) {
    if (!p || p.providerId !== PID()) { UI.toast('Documento no disponible.', 'bad'); return; }
    UI.modal({ title: 'Subir factura', sub: esc(p.id) + ' · ' + esc(p.concept) + ' · ' + money(p.amount - (p.paid || 0), p.currency), body: UI.form([
      { id: 'num', label: 'Número de factura', required: true, placeholder: 'F001-00012345', col: 6, hint: 'Serie y correlativo del comprobante electrónico.' },
      { id: 'dt', label: 'Fecha de emisión', type: 'date', value: window.TODAY, required: true, col: 6 },
      { id: 'amt', label: 'Importe facturado', type: 'number', step: '0.01', value: p.amount - (p.paid || 0), col: 6, hint: 'Moneda: ' + p.currency },
      { type: 'html', col: 6, html: '<div class="field"><label for="pv-file">Archivo PDF / XML <span class="req">*</span></label><input class="input" type="file" id="pv-file" accept=".pdf,.xml,.zip"><div class="hint">En la demo solo se registra el nombre del archivo.</div></div>' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar factura', cls: 'primary', icon: 'upload', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const file = m.querySelector('#pv-file');
        const fname = file.files && file.files[0] ? file.files[0].name : '';
        if (!fname) { file.classList.add('err'); UI.toast('Adjunte el archivo de la factura (PDF o XML).', 'bad'); return false; }
        if (!/^[A-Z0-9]{4}-\d{1,8}$/i.test(f.num)) { UI.toast('Formato de número inválido. Use serie-correlativo, p. ej. F001-00012345.', 'bad'); return false; }
        if (Math.abs(Number(f.amt || 0) - (p.amount - (p.paid || 0))) > 0.01) { UI.toast('El importe no coincide con el saldo del documento; Finanzas revisará la diferencia.', 'warn'); }
        p.providerInvoice = { number: f.num.toUpperCase(), date: f.dt, amount: Number(f.amt || 0), file: fname, uploadedAt: nowStr(), user: Auth.user.id };
        Audit.log('Cuenta por pagar', p.id, 'factura_proveedor', '', p.providerInvoice.number + ' (' + fname + ')');
        Notify.push('proveedor.factura', 'Portal', 'U07', prov().name + ' registró la factura ' + p.providerInvoice.number + ' para ' + p.id);
        Store.save(); UI.toast('Factura ' + esc(p.providerInvoice.number) + ' registrada. Finanzas la validará para programar el pago.'); App.render();
      } }] });
  }

  /* ======================= INCIDENCIAS ======================= */
  function incidencias(el) {
    const I = () => myIncidents().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    frame(el, { title: 'Incidencias', crumb: 'Incidencias', subtitle: 'Incidencias vinculadas a sus servicios. Operaciones responde por este canal; las críticas se escalan por teléfono.', actions: '<button class="btn primary" id="pv-newinc">' + ic('plus') + 'Reportar incidencia</button>',
      body: '<div id="pv-it"></div>' });
    UI.dataTable(el.querySelector('#pv-it'), {
      rows: I, exportName: 'incidencias-proveedor', search: i => [i.id, i.title, i.resId].join(' '),
      filters: [{ key: 'status', label: 'Estado', options: ['abierta', 'en_proceso', 'resuelta', 'cerrada'] }],
      columns: [
        { key: 'id', label: 'Incidencia', render: i => '<b class="mono">' + esc(i.id) + '</b><div class="xs faint">' + datetime(i.createdAt) + '</div>' },
        { key: 'title', label: 'Asunto', render: i => '<div class="cell-main">' + esc(i.title) + '</div><div class="cell-sub mono">' + esc(i.resId || '—') + '</div>' },
        { key: 'severity', label: 'Impacto', render: i => UI.badge(i.severity) },
        { key: 'status', label: 'Estado', render: i => UI.badge(i.status) },
        { key: 'last', label: 'Última actualización', sort: false, render: i => { const lg = i.log || []; const l = lg[lg.length - 1]; return l ? '<span class="small">' + esc(l.m) + '</span><div class="xs faint">' + datetime(l.ts) + '</div>' : '—'; }, csv: i => ((i.log || [])[(i.log || []).length - 1] || {}).m || '' }
      ],
      onRow: (i) => incDetail(i)
    });
    el.querySelector('#pv-newinc').onclick = () => newInc();
  }
  function incDetail(i) {
    UI.drawer({ title: esc(i.id) + ' · ' + esc(i.title), sub: 'Reserva ' + esc(i.resId || '—'), body: UI.dl([['Estado', UI.badge(i.status)], ['Impacto', UI.badge(i.severity)], ['Tipo', esc(i.type)], ['Reportada', datetime(i.createdAt)]]) + '<div class="divider" style="margin:14px 0"></div><p class="small">' + esc(i.desc) + '</p><div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:8px">Seguimiento</div>' +
      UI.timeline((i.log || []).slice().reverse().map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + (l.u === Auth.user.id ? 'Usted' : Q.user(l.u) && Access.isExternal(Q.user(l.u).role) ? esc(Q.userName(l.u)) : 'Operaciones ' + esc(DB.tenant.short)), icon: l.u === Auth.user.id ? 'building' : 'msg' }))) +
      (['cerrada', 'resuelta'].includes(i.status) ? '' : '<div class="field" style="margin-top:14px"><label for="pv-cm">Agregar comentario</label><textarea class="input" id="pv-cm" rows="2"></textarea></div>'),
      actions: ['cerrada', 'resuelta'].includes(i.status) ? [{ label: 'Cerrar' }] : [{ label: 'Cerrar' }, { label: 'Enviar comentario', cls: 'primary', icon: 'send', onClick: (d) => {
        const t = d.querySelector('#pv-cm').value.trim(); if (!t) { UI.toast('Escriba un comentario.', 'bad'); return false; }
        i.log = i.log || []; i.log.push({ ts: nowStr(), u: Auth.user.id, m: t });
        Audit.log('Incidencia', i.id, 'comentario_proveedor', '', t.slice(0, 60));
        OPS.concat(i.assignee && !OPS.includes(i.assignee) ? [i.assignee] : []).forEach(u => Notify.push('incidencia.comentario', 'Portal', u, i.id + ': nuevo comentario de ' + prov().name));
        Store.save(); UI.toast('Comentario enviado a Operaciones.'); App.render();
      } }] });
  }
  function newInc() {
    const svc = myServices().filter(x => !['cancelado', 'rechazado'].includes(x.s.status) && daysFromToday(x.s.date) >= -7);
    if (!svc.length) { UI.toast('No tiene servicios activos a los cuales asociar una incidencia.', 'warn'); return; }
    UI.modal({ title: 'Reportar incidencia', sub: 'Se notificará a Operaciones de ' + esc(DB.tenant.short), body: UI.form([
      { id: 'svc', label: 'Servicio relacionado', type: 'select', required: true, placeholder: 'Seleccione…', options: svc.map(x => [x.s.id, dateShort(x.s.date) + ' · ' + x.r.id + ' · ' + x.s.name]), col: 12 },
      { id: 'type', label: 'Tipo', type: 'select', options: ['Proveedor', 'Horario', 'Capacidad', 'Pasajero', 'Otro'], col: 6 },
      { id: 'sev', label: 'Impacto', type: 'select', options: [['media', 'Media'], ['alta', 'Alta'], ['critica', 'Crítica'], ['baja', 'Baja']], col: 6 },
      { id: 'title', label: 'Asunto', required: true, col: 12 },
      { id: 'desc', label: 'Descripción y propuesta', type: 'textarea', rows: 3, required: true, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Reportar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const x = svc.find(y => y.s.id === f.svc); const op = opOf(x.r.id);
        const inc = { id: nextInc(), opId: op ? op.id : null, resId: x.r.id, serviceId: x.s.id, severity: f.sev, type: f.type, title: f.title, desc: f.desc, status: 'abierta', assignee: op ? op.coordinator : 'U05', reportedBy: Auth.user.id, providerId: PID(), createdAt: nowStr(), evidence: [], log: [{ ts: nowStr(), u: Auth.user.id, m: 'Reporte desde extranet de proveedores' }] };
        DB.incidents.unshift(inc);
        Audit.log('Incidencia', inc.id, 'crear', '', 'abierta / ' + inc.severity + ' (proveedor)');
        notifyOps(f.sev === 'critica' ? 'incidencia.critica' : 'incidencia.creada', inc.id + ' ' + inc.title + ' — ' + prov().name);
        Store.save(); UI.toast('Incidencia ' + inc.id + ' reportada.'); App.render();
      } }] });
  }

  /* ======================= CONTRATO ======================= */
  function contrato(el) {
    const p = prov(); const S = DB.services.filter(s => s.providerId === PID());
    const left = daysFromToday(p.contractEnd);
    const reqs = myRateReqs();
    const coord = Q.user('U05') || {}; const fin = Q.user('U07') || {};
    frame(el, { title: 'Mi contrato', crumb: 'Contrato', subtitle: 'Condiciones comerciales vigentes con ' + esc(DB.tenant.name) + ' y tarifas netas contratadas.',
      body: (left < 60 ? UI.alert(left < 0 ? 'bad' : 'warn', left < 0 ? 'El contrato venció el ' + date(p.contractEnd) + '. La agencia no puede solicitar nuevos servicios hasta renovarlo.' : 'El contrato vence en ' + left + ' días (' + date(p.contractEnd) + '). Coordine la renovación y las tarifas del próximo año.') : '') +
        '<div class="grid g2">' +
          UI.card('Condiciones', UI.dl([['Razón social', esc(p.name)], ['RUC', esc(p.ruc)], ['Tipo', esc(p.type) + (p.stars ? ' · ' + p.stars + ' estrellas' : '')], ['Vigencia', date(p.contractStart) + ' → ' + date(p.contractEnd)], ['Estado', UI.badge(p.status)], ['Moneda', esc(p.currency)], ['Condición de pago', esc(p.paymentTerms)], ['Facturación', 'Factura electrónica a ' + esc(DB.tenant.name) + ' · RUC ' + esc(DB.tenant.ruc)]])) +
          UI.card('Contactos', '<div class="upper" style="margin-bottom:6px">Su establecimiento</div>' + UI.dl([['Contacto', esc(p.contact)], ['Teléfono', esc(p.phone)], ['Email', esc(p.email)]]) + '<div class="divider" style="margin:12px 0"></div><div class="upper" style="margin-bottom:6px">' + esc(DB.tenant.short) + '</div>' + UI.dl([['Operaciones', esc(coord.name || 'Operaciones') + '<div class="xs faint">' + esc(coord.email || '') + ' · ' + esc(coord.phone || '') + '</div>'], ['Pagos a proveedores', esc(fin.name || 'Finanzas') + '<div class="xs faint">' + esc(fin.email || '') + '</div>'], ['Emergencias 24 h', esc((Q.sede('SED-02') || {}).phone || '—')]])) +
        '</div>' +
        UI.card('Tarifas netas contratadas', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Servicio</th><th>Unidad</th><th class="num">Tarifa neta</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>' +
            (S.length ? S.map(s => { const rq = reqs.find(r => r.serviceId === s.id && r.status === 'pendiente'); return '<tr><td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub mono">' + esc(s.id) + ' · ' + esc(s.type) + (s.capacity ? ' · cupo ' + s.capacity : '') + '</div></td><td>' + esc(s.unit) + '</td><td class="num nowrap"><b>' + money(s.cost, s.currency) + '</b></td><td class="nowrap small">' + dateShort(s.validFrom) + ' → ' + date(s.validTo) + '</td><td>' + UI.badge(s.status) + '</td><td>' + (rq ? UI.badge('pendiente', 'Actualización enviada') : '<button class="btn xs" data-rate="' + s.id + '">' + ic('edit') + 'Actualizar tarifa</button>') + '</td></tr>'; }).join('') : '<tr><td colspan="6">' + UI.empty('Sin tarifas registradas.', 'tag') + '</td></tr>') + '</tbody></table></div>', { tight: true, sub: 'Montos sin IGV. La tarifa aplicada en cada solicitud es la vigente a la fecha del servicio.' }) +
        UI.card('Solicitudes de actualización de tarifa', reqs.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Solicitud</th><th>Servicio</th><th class="num">Actual</th><th class="num">Propuesta</th><th>Desde</th><th>Estado</th></tr></thead><tbody>' + reqs.map(r => '<tr><td class="mono small">' + esc(r.id) + '<div class="xs faint">' + datetime(r.ts) + '</div></td><td class="small">' + esc((Q.service(r.serviceId) || {}).name || r.serviceId) + '<div class="xs faint">' + esc(r.reason) + '</div></td><td class="num">' + money(r.current, r.currency) + '</td><td class="num"><b>' + money(r.proposed, r.currency) + '</b> <span class="xs ' + (r.proposed > r.current ? 'bad' : 'ok') + '">' + (r.proposed >= r.current ? '+' : '') + fmtN((r.proposed - r.current) / (r.current || 1) * 100, 1) + '%</span></td><td>' + date(r.from) + '</td><td>' + UI.badge(r.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('No ha enviado solicitudes de actualización de tarifa.', 'tag'), { tight: true }) });
    el.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => rateReq(DB.services.find(s => s.id === b.dataset.rate)));
  }
  function rateReq(s) {
    if (!s || s.providerId !== PID()) { UI.toast('Servicio no disponible.', 'bad'); return; }
    UI.modal({ title: 'Solicitar actualización de tarifa', sub: esc(s.name) + ' · actual ' + money(s.cost, s.currency), body: UI.alert('info', 'La nueva tarifa no se aplica automáticamente: Compras/Operaciones la evalúa y, si la aprueba, crea una nueva vigencia. Las reservas ya confirmadas conservan la tarifa pactada.') + '<div style="height:12px"></div>' + UI.form([
      { id: 'amt', label: 'Nueva tarifa neta (' + s.currency + ')', type: 'number', step: '0.01', required: true, col: 6 },
      { id: 'from', label: 'Vigente desde', type: 'date', required: true, value: Util.addDays(window.TODAY, 30), col: 6, hint: 'Mínimo 30 días de anticipación según contrato.' },
      { id: 'why', label: 'Motivo', type: 'select', options: ['Ajuste por inflación / costos', 'Cambio de temporada', 'Mejora del servicio', 'Tarifa promocional', 'Otro'], col: 12 },
      { id: 'det', label: 'Sustento', type: 'textarea', rows: 2, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Enviar solicitud', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const amt = Number(f.amt);
        if (!(amt > 0)) { UI.toast('Ingrese una tarifa válida.', 'bad'); return false; }
        if (Util.daysFromToday(f.from) < 30) { UI.toast('La vigencia debe iniciar con al menos 30 días de anticipación (cláusula de contrato).', 'bad'); return false; }
        DB.providerRequests = DB.providerRequests || [];
        const r = { id: 'SOL-TAR-' + String(DB.providerRequests.length + 101).padStart(4, '0'), providerId: PID(), serviceId: s.id, current: s.cost, proposed: amt, currency: s.currency, from: f.from, reason: f.why + (f.det ? ': ' + f.det : ''), status: 'pendiente', ts: nowStr(), user: Auth.user.id };
        DB.providerRequests.unshift(r);
        Audit.log('Tarifa proveedor', s.id, 'solicitud_actualizacion', s.currency + ' ' + s.cost, s.currency + ' ' + amt + ' desde ' + f.from);
        ['U05', 'U02'].forEach(u => Notify.push('proveedor.tarifa', 'Portal', u, prov().name + ' solicita actualizar ' + s.id + ' a ' + money(amt, s.currency) + ' desde ' + date(f.from)));
        Store.save(); UI.toast('Solicitud ' + r.id + ' enviada a Compras / Operaciones.'); App.render();
      } }] });
  }

  /* ---- Rutas ---- */
  const guard = (fn) => (el, params) => {
    if (!Auth.providerId) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Extranet de proveedores' }) + UI.alert('warn', 'La extranet está disponible solo para usuarios de proveedores vinculados a un proveedor del catálogo. El personal interno gestiona proveedores desde <b>Catálogo › Proveedores</b>.') + '</div>'; return; }
    fn(el, params);
  };
  App.register('proveedor', (el) => { location.replace('#/proveedor/solicitudes'); });
  App.register('proveedor/solicitudes', guard(solicitudes));
  App.register('proveedor/rooming', guard(rooming));
  App.register('proveedor/vouchers', guard(vouchers));
  App.register('proveedor/pagos', guard(pagos));
  App.register('proveedor/incidencias', guard(incidencias));
  App.register('proveedor/contrato', guard(contrato));
})();
