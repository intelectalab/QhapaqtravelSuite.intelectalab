/* ==========================================================================
   Inventario contratado y documentación del pasajero
   - #/catalogo/cupos ................ Cupos y bloqueos (allotments) con proveedores
   - #/catalogo/cupos/<CUP-…> ......... Detalle de contrato de cupo
   - #/operaciones/documentos-viaje .... Checklist de documentos de viaje por reserva
   - #/operaciones/documentos-viaje/<RES-…> Detalle por reserva y pasajero
   Permisos: catalog.allotments.manage (gestión), catalog.products.view_profitability (lectura
   con penalidades, Finanzas); operations.travel_docs (gestión), reservations.create (Ventas:
   solo sus reservas, consulta y solicitud de documentos).
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, daysFromToday, addDays, nowStr, parseD } = Util;
  const ic = (n) => UI.icon(n);
  const T = () => window.TODAY;
  const P_CUP = 'catalog.allotments.manage', P_DOC = 'operations.travel_docs';
  const dis = (perm) => Auth.can(perm) ? '' : ' disabled title="Requiere permiso ' + perm + '"';
  const deny = (perm) => { if (Auth.can(perm)) return false; UI.toast('Acción no permitida: requiere permiso ' + perm + '.', 'bad'); return true; };
  const range = (n) => Array.from({ length: Math.max(0, n) }, (_, i) => i);
  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dow = (d) => DOW[parseD(d).getDay()];
  const pct = (a, b) => b ? a / b * 100 : 0;

  function css() {
    if (document.getElementById('css-inventario')) return;
    const s = document.createElement('style'); s.id = 'css-inventario';
    s.textContent =
      '.cup-grid{border-collapse:separate;border-spacing:0;font-size:.78rem;min-width:100%}' +
      '.cup-grid th,.cup-grid td{border-bottom:1px solid var(--line-2);border-right:1px solid var(--line-2);padding:0;text-align:center;white-space:nowrap}' +
      '.cup-grid thead th{background:var(--surface-2);color:var(--fg-3);font-weight:600;font-size:.68rem;padding:6px 4px;text-transform:uppercase;letter-spacing:.03em}' +
      '.cup-grid thead th.today{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}' +
      '.cup-grid .rowh{position:sticky;left:0;z-index:1;background:var(--surface);text-align:left;padding:8px 10px;min-width:210px;max-width:230px;white-space:normal}' +
      '.cup-grid thead .rowh{background:var(--surface-2);z-index:2}' +
      '.cup-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:54px;height:46px;cursor:pointer;background:transparent;border:0;width:100%;color:var(--fg);font:inherit}' +
      '.cup-cell:hover{outline:2px solid var(--accent);outline-offset:-2px}' +
      '.cup-cell b{font-size:.9rem;font-variant-numeric:tabular-nums}.cup-cell small{font-size:.66rem;color:var(--fg-3);font-variant-numeric:tabular-nums}' +
      '.cup-cell.st-ok{background:var(--ok-soft)}.cup-cell.st-mid{background:var(--info-soft)}.cup-cell.st-full{background:var(--sun-soft)}' +
      '.cup-cell.st-over{background:var(--bad-soft)}.cup-cell.st-rel{background:var(--warn-soft)}.cup-cell.st-ret{background:var(--violet-soft)}' +
      '.cup-cell.st-free small{color:var(--fg-3)}.cup-cell.st-free b{color:var(--fg-3);font-weight:500}.cup-cell.st-past,.cup-cell.st-free,.cup-cell.st-off{background:var(--surface-2);color:var(--fg-3)}.cup-cell.st-off{cursor:default}' +
      '.cup-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.74rem;color:var(--fg-2);margin-top:10px}.cup-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px;border:1px solid var(--line)}' +
      '.doc-pax{border:1px solid var(--line);border-radius:var(--r-sm);margin-bottom:14px;overflow:hidden;background:var(--surface)}' +
      '.doc-pax-h{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--line)}' +
      '.doc-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}' +
      '.inv-note{font-size:.74rem;color:var(--fg-3)}' +
      '@media (max-width:700px){.cup-grid .rowh{min-width:140px;max-width:150px}.cup-cell{min-width:46px}}';
    document.head.appendChild(s);
  }

  /* ======================================================================
     1. CUPOS Y BLOQUEOS (ALLOTMENTS)
     ====================================================================== */
  const KIND = {
    hotel: { label: 'Hotel', unit: 'hab./noche', icon: 'bed' },
    tren: { label: 'Tren', unit: 'asiento/día', icon: 'train' },
    entrada: { label: 'Entradas', unit: 'cupo/día', icon: 'ticket' }
  };
  const CST = { activo: ['activo', 'Activo'], en_release: ['hold', 'En release'], liberado: ['liberada', 'Liberado'], vencido: ['vencido', 'Vencido'] };
  const cBadge = (s) => UI.badge((CST[s] || [s])[0], (CST[s] || [s, s])[1]);
  const REQ_ST = { solicitada: ['solicitado', 'Solicitada'], aceptada: ['aceptado', 'Aceptada'], rechazada: ['rechazado', 'Rechazada'] };

  function seedAllotments() {
    if (DB.allotments) return;
    DB.allotments = [
      { id: 'CUP-2026-001', providerId: 'PRV-001', serviceId: 'SRV-008', kind: 'hotel', name: 'Tambo Real — hab. doble estándar (2.º semestre)', contractRef: 'Adenda 03 · contrato de alojamiento 2026', from: '2026-09-01', to: '2026-12-20', qty: 8, releaseDays: 14, netRate: 88, currency: 'USD', penaltyPct: 100, status: 'activo', owner: 'U05', createdAt: '2026-08-12 10:20',
        notes: 'Bloqueo base de 8 habitaciones por noche. Ampliado a 10 del 01 al 04/10 por el incentivo corporativo (AMP-0010).',
        overrides: { '2026-10-01': 10, '2026-10-02': 10, '2026-10-03': 10, '2026-10-04': 10 }, released: {}, retained: { '2026-10-01': 'Posible ampliación del grupo corporativo', '2026-10-02': 'Posible ampliación del grupo corporativo', '2026-10-03': 'Posible ampliación del grupo corporativo', '2026-10-04': 'Posible ampliación del grupo corporativo' },
        charges: [{ date: '2026-09-19', qty: 1, amount: 88, ts: '2026-09-20 00:15', by: 'Sistema', reason: 'Habitación retenida después del release y no vendida' }],
        requests: [
          { id: 'AMP-0010', from: '2026-10-01', to: '2026-10-04', qty: 2, status: 'aceptada', ts: '2026-09-04 11:30', user: 'U06', note: 'Incentivo corporativo Minera Cordillera Blanca (12 pax)', response: 'Aceptada por Milagros Álvarez', respondedAt: '2026-09-05 09:12' },
          { id: 'AMP-0013', from: '2026-10-15', to: '2026-10-18', qty: 4, status: 'solicitada', ts: '2026-09-28 16:10', user: 'U05', note: 'Convención Laboratorios Andinos (en negociación)', response: '', respondedAt: '' }
        ], log: [] },
      { id: 'CUP-2026-002', providerId: 'PRV-002', serviceId: 'SRV-009', kind: 'hotel', name: 'Piedra Viva — hab. deluxe (temporada intermedia)', contractRef: 'Contrato de cupo PV-2026-07', from: '2026-09-15', to: '2026-11-30', qty: 3, releaseDays: 21, netRate: 165, currency: 'USD', penaltyPct: 100, status: 'activo', owner: 'U05', createdAt: '2026-07-20 15:05',
        notes: 'Cupo garantizado de 3 hab. deluxe. Release 21 días; lo retenido después del release se paga al 100 % de la tarifa neta.', overrides: {}, released: {}, retained: {}, charges: [], requests: [], log: [], _noAutoRelease: true },
      { id: 'CUP-2026-003', providerId: 'PRV-005', serviceId: 'SRV-003', kind: 'tren', name: 'Expedition Ollantaytambo ⇄ Aguas Calientes', contractRef: 'Convenio corporativo FSA-2026-114', from: '2026-07-01', to: '2026-12-31', qty: 20, releaseDays: 10, netRate: 142, currency: 'USD', penaltyPct: 50, status: 'activo', owner: 'U06', createdAt: '2026-06-18 09:40',
        notes: '20 asientos diarios (ida y vuelta). Penalidad del 50 % sobre asientos retenidos después del release y no utilizados.',
        overrides: { '2026-10-10': 26, '2026-10-11': 26, '2026-10-12': 26 }, released: {}, retained: {}, charges: [],
        requests: [{ id: 'AMP-0011', from: '2026-10-10', to: '2026-10-12', qty: 6, status: 'aceptada', ts: '2026-09-15 10:02', user: 'U06', note: 'Feriado largo — demanda web', response: 'Aceptada por mesa corporativa', respondedAt: '2026-09-16 12:40' }], log: [] },
      { id: 'CUP-2026-004', providerId: 'PRV-009', serviceId: 'SRV-005', kind: 'entrada', name: 'Entradas Machu Picchu — Circuito 2 (nominativas)', contractRef: 'Cupo operador turístico RD-0412-2026', from: '2026-09-01', to: '2026-10-31', qty: 25, releaseDays: 7, netRate: 152, currency: 'PEN', penaltyPct: 0, status: 'activo', owner: 'U05', createdAt: '2026-08-25 08:30',
        notes: 'Cupo diario asignado al operador. Las entradas no nominadas 7 días antes vuelven a la plataforma de venta; no hay penalidad económica, se pierde el cupo.', overrides: {}, released: {}, retained: {}, charges: [], requests: [], log: [] },
      { id: 'CUP-2026-005', providerId: 'PRV-003', serviceId: 'SRV-010', kind: 'hotel', name: 'Valle Inka — hab. doble (invierno)', contractRef: 'Contrato de cupo VI-2026-02', from: '2026-06-01', to: '2026-09-27', qty: 4, releaseDays: 7, netRate: 170, currency: 'PEN', penaltyPct: 50, status: 'vencido', owner: 'U05', createdAt: '2026-05-10 12:00',
        notes: 'Contrato de temporada de invierno. Vencido el 27/09; pendiente de evaluar renovación para 2027.', overrides: {}, released: {}, retained: { '2026-09-20': 'Grupo escolar no confirmado', '2026-09-21': 'Grupo escolar no confirmado' },
        charges: [{ date: '2026-09-20', qty: 2, amount: 170, ts: '2026-09-21 00:15', by: 'Sistema', reason: 'Retención sin uso (50 %)' }, { date: '2026-09-21', qty: 2, amount: 170, ts: '2026-09-22 00:15', by: 'Sistema', reason: 'Retención sin uso (50 %)' }],
        requests: [], log: [] }
    ];
    // Estado inicial coherente: fechas cuyo release ya pasó quedan liberadas (el job corrió), salvo retenciones,
    // cargos registrados y el contrato de Piedra Viva, cuyo release está pendiente (job con alerta).
    const U = usageMap();
    DB.allotments.forEach(c => {
      eachDate(c.from, c.to, d => {
        const dl = addDays(d, -c.releaseDays);
        if (dl > T() || c.retained[d] || c.charges.some(x => x.date === d)) return;
        if (c._noAutoRelease && d >= T()) return;
        const a = cellAt(c, d, U).avail; if (a > 0) c.released[d] = a;
      });
      delete c._noAutoRelease;
      c.log.push({ ts: c.createdAt, user: c.owner, m: 'Contrato de cupo registrado (' + c.contractRef + ')' });
      refreshStatus(c, U);
    });
    if (!DB.jobs.some(j => j.id === 'JOB-10')) DB.jobs.push({ id: 'JOB-10', name: 'Liberar cupos en release (allotments)', cron: 'diario 00:15', last: '2026-09-29 00:15', next: '2026-09-30 00:15', status: 'advertencia', lastResult: 'Piedra Viva: 7 fechas pendientes de liberar (sin respuesta del adapter)' });
    Store.save();
  }
  function eachDate(from, to, fn) { let d = from, guard = 0; while (d <= to && guard++ < 800) { fn(d); d = addDays(d, 1); } }
  const blockedAt = (c, d) => (d < c.from || d > c.to) ? 0 : (c.overrides[d] != null ? c.overrides[d] : c.qty);
  const deadline = (c, d) => addDays(d, -c.releaseDays);

  /* ¿El servicio corresponde a una entrada nominativa a Machu Picchu? Devuelve la fecha de ingreso. */
  function nominative(s) {
    if (!s) return null;
    if (s.providerId === 'PRV-009' && /entrada|machu/i.test(s.name)) return { date: s.date };
    const p = Q.product(s.productId);
    if (!p || p.type === 'PAQUETE' || !(p.components || []).some(x => x.serviceId === 'SRV-005')) return null;
    const pv = Q.provider(s.providerId); if ((pv && pv.type === 'Hotel') || !/machu picchu|entrada|mapi/i.test(s.name)) return null;
    const idx = (p.itinerary || []).findIndex(d => /machu picchu/i.test(d.title) && !/^cusco\s*—\s*aguas/i.test(d.title));
    return { date: addDays(s.date, idx > 0 ? idx : 0) };
  }
  const paxCount = (r) => r.passengers.filter(p => p.type !== 'INF').length || 1;
  /* Unidades del contrato que consume un servicio de reserva: [{d, q}] */
  function svcUnits(c, r, s) {
    if (c.kind === 'hotel') {
      if (s.providerId !== c.providerId) return [];
      const rooms = (s.name.match(/(\d+)\s*(?:hab\.?|twin|doble|triple|simple|matrimonial)/gi) || []).reduce((a, m) => a + parseInt(m, 10), 0) || 1, nights = +((s.name.match(/(\d+)\s*noches?/i) || [])[1] || 1);
      return range(nights).map(i => ({ d: addDays(s.date, i), q: rooms }));
    }
    if (c.kind === 'tren') return s.providerId === c.providerId ? [{ d: s.date, q: paxCount(r) }] : [];
    if (c.kind === 'entrada') { const n = nominative(s); return n ? [{ d: n.date, q: paxCount(r) }] : []; }
    return [];
  }
  const USED_ST = ['confirmado', 'completado', 'en_curso'], PEND_ST = ['solicitado', 'pendiente'];
  /* Consumo automático: lee DB.reservations (servicios del proveedor/fecha) */
  function usageMap() {
    const m = {};
    (DB.allotments || []).forEach(c => {
      const u = m[c.id] = {};
      DB.reservations.forEach(r => {
        if (r.status === 'cancelada') return;
        r.services.forEach(s => {
          if (s.status === 'cancelado') return;
          const used = r.status !== 'borrador' && USED_ST.includes(s.status), pend = !used;
          svcUnits(c, r, s).forEach(({ d, q }) => {
            if (d < c.from || d > c.to) return;
            const x = u[d] = u[d] || { used: 0, pend: 0, refs: [] };
            if (used) x.used += q; else if (pend) x.pend += q;
            x.refs.push({ resId: r.id, svcId: s.id, name: s.name, q, used, status: s.status, created: r.createdAt });
          });
        });
      });
    });
    return m;
  }
  function cellAt(c, d, U) {
    const B = blockedAt(c, d), R = Math.min(B, c.released[d] || 0), u = (U[c.id] || {})[d] || { used: 0, pend: 0, refs: [] };
    const cap = B - R, avail = Math.max(0, cap - u.used), over = Math.max(0, u.used - cap);
    const dl = deadline(c, d), dlIn = daysFromToday(dl);
    let st;
    if (!B) st = 'off';
    else if (d < T()) st = 'past';
    else if (over) st = 'over';
    else if (!cap && R) st = 'free';
    else if (c.retained[d] && dlIn < 0 && avail > 0) st = 'ret';
    else if (avail > 0 && dlIn <= 3) st = 'rel';
    else { const p = pct(u.used, cap); st = cap && !avail ? 'full' : p >= 50 ? 'mid' : 'ok'; }
    return { B, R, used: u.used, pend: u.pend, refs: u.refs, cap, avail, over, dl, dlIn, st, retained: c.retained[d] || '' };
  }
  /* Fechas futuras cuyo release ya venció o vence hoy, con unidades sin usar y sin retención */
  function pendingRelease(c, U) { const out = []; if (['liberado', 'vencido'].includes(c.status)) return out; eachDate(c.from < T() ? T() : c.from, c.to, d => { const x = cellAt(c, d, U); if (x.dlIn <= 0 && !x.retained && x.avail > 0) out.push({ d, n: x.avail }); }); return out; }
  function upcomingRelease(c, U, days = 3) { const out = []; if (['liberado', 'vencido'].includes(c.status)) return out; eachDate(T() > c.from ? T() : c.from, c.to, d => { const x = cellAt(c, d, U); if (x.dlIn > 0 && x.dlIn <= days && x.avail > 0) out.push({ d, n: x.avail, dl: x.dl, dlIn: x.dlIn }); }); return out; }
  function exposure(c, U) { let q = 0; if (['liberado', 'vencido'].includes(c.status)) return { q: 0, amt: 0 }; eachDate(T() > c.from ? T() : c.from, c.to, d => { const x = cellAt(c, d, U); if (x.dlIn < 0 && x.retained && x.avail > 0) q += x.avail; }); return { q, amt: q * c.netRate * c.penaltyPct / 100 }; }
  const penaltyTotal = (c) => sum(c.charges, 'amount');
  function refreshStatus(c, U) {
    if (c.to < T() && c.status !== 'vencido') { c.log.unshift({ ts: nowStr(), user: 'Sistema', m: 'Contrato vencido por fin de vigencia (' + date(c.to) + ')' }); c.status = 'vencido'; return; }
    if (['liberado', 'vencido'].includes(c.status)) return;
    c.status = pendingRelease(c, U || usageMap()).length ? 'en_release' : 'activo';
  }
  function periodStats(c, U, from, days) {
    let B = 0, R = 0, used = 0, pend = 0, avail = 0;
    range(days).forEach(i => { const d = addDays(from, i); const x = cellAt(c, d, U); B += x.B; R += x.R; used += x.used; pend += x.pend; avail += x.avail; });
    return { B, R, used, pend, avail, cap: B - R, util: pct(used, B - R) };
  }
  const prov = (c) => Q.provider(c.providerId) || {};
  const unitOf = (c) => KIND[c.kind].unit;

  /* ---------- Job: liberar cupos en release ---------- */
  function runReleaseJob(manual) {
    if (manual && deny(P_CUP)) return;
    let rel = 0, dates = 0, charged = 0, expired = 0; const touched = [];
    const U = usageMap();
    DB.allotments.forEach(c => {
      const before = c.status;
      if (c.to < T() && c.status !== 'vencido') { refreshStatus(c, U); expired++; Audit.log('Cupo', c.id, 'vencer', before, 'vencido'); return; }
      if (['liberado', 'vencido'].includes(c.status)) return;
      const pend = pendingRelease(c, U); let n = 0;
      pend.forEach(p => { c.released[p.d] = (c.released[p.d] || 0) + p.n; n += p.n; dates++; });
      // Cargos por no-uso de fechas pasadas retenidas (o no liberadas a tiempo)
      eachDate(addDays(T(), -30) > c.from ? addDays(T(), -30) : c.from, addDays(T(), -1) < c.to ? addDays(T(), -1) : c.to, d => {
        const x = cellAt(c, d, U);
        if (x.avail > 0 && !c.charges.some(k => k.date === d)) {
          const amt = x.avail * c.netRate * c.penaltyPct / 100;
          c.charges.push({ date: d, qty: x.avail, amount: amt, ts: nowStr(), by: 'Sistema', reason: c.penaltyPct ? 'No-uso sin liberación a tiempo (' + c.penaltyPct + ' %)' : 'Cupo no utilizado (sin penalidad económica)' });
          if (amt) charged += amt;
        }
      });
      if (n) {
        rel += n; touched.push(c.id);
        c.log.unshift({ ts: nowStr(), user: manual ? Auth.user.id : 'Sistema', m: 'Release automático: ' + n + ' ' + unitOf(c) + ' liberadas en ' + pend.length + ' fecha(s)' });
        Notify.push('cupo.release', 'Email', prov(c).email || prov(c).name, 'Liberación de ' + n + ' ' + unitOf(c) + ' — ' + c.id);
      }
      refreshStatus(c, U);
      if (before !== c.status || n) Audit.log('Cupo', c.id, 'release_automatico', before + (n ? '' : ''), c.status + (n ? ' · ' + n + ' liberadas' : ''));
    });
    const j = DB.jobs.find(x => x.id === 'JOB-10');
    const res = rel ? rel + ' unidades liberadas en ' + dates + ' fecha(s) (' + touched.join(', ') + ')' : 'Sin unidades por liberar';
    if (j) { j.last = nowStr(); j.status = 'ok'; j.lastResult = res + (expired ? ' · ' + expired + ' contrato(s) vencido(s)' : ''); }
    Store.save();
    UI.toast('Job ejecutado: ' + res + '.', rel ? 'ok' : 'info');
    App.render();
  }

  /* ---------- Formularios y acciones ---------- */
  function contractForm(c) {
    const edit = !!c; c = c || { kind: 'hotel', from: T(), to: addDays(T(), 90), qty: 4, releaseDays: 14, netRate: '', currency: 'USD', penaltyPct: 100, notes: '', contractRef: '', providerId: '', serviceId: '', name: '' };
    const provs = DB.providers.filter(p => ['Hotel', 'Tren', 'Entrada'].includes(p.type) && p.status === 'activo');
    const svcs = DB.services.filter(s => ['Alojamiento', 'Tren', 'Entrada'].includes(s.type) && s.status === 'activo');
    UI.modal({ title: edit ? 'Editar contrato ' + esc(c.id) : 'Nuevo contrato de cupo', size: 'lg', sub: 'Datos del contrato firmado con el proveedor. El bloqueo por fecha se ajusta luego en la grilla.',
      body: UI.form([
        { type: 'section', label: 'Proveedor y servicio' },
        { id: 'providerId', label: 'Proveedor', type: 'select', required: true, placeholder: 'Seleccione…', options: provs.map(p => [p.id, p.name + ' (' + p.type + ')']), value: c.providerId, col: 6, disabled: edit },
        { id: 'serviceId', label: 'Servicio contratado', type: 'select', required: true, placeholder: 'Seleccione…', options: svcs.map(s => [s.id, s.name]), value: c.serviceId, col: 6, disabled: edit },
        { id: 'name', label: 'Nombre del cupo', required: true, value: c.name, col: 8, placeholder: 'Ej. Tambo Real — hab. doble (temporada alta)' },
        { id: 'contractRef', label: 'Referencia de contrato', value: c.contractRef, col: 4, placeholder: 'Adenda / convenio' },
        { type: 'section', label: 'Vigencia y cantidad' },
        { id: 'from', label: 'Vigente desde', type: 'date', required: true, value: c.from, col: 3 },
        { id: 'to', label: 'Vigente hasta', type: 'date', required: true, value: c.to, col: 3 },
        { id: 'qty', label: 'Bloqueo base por fecha', type: 'number', min: 1, required: true, value: c.qty, col: 3, hint: 'Habitaciones/noche, asientos o entradas por día' },
        { id: 'releaseDays', label: 'Días de release', type: 'number', min: 0, required: true, value: c.releaseDays, col: 3, hint: 'Liberación automática X días antes' },
        { type: 'section', label: 'Condiciones económicas' },
        { id: 'netRate', label: 'Tarifa neta del bloqueo', type: 'number', step: '0.01', min: 0, required: true, value: c.netRate, col: 4 },
        { id: 'currency', label: 'Moneda', type: 'select', options: [['USD', 'USD'], ['PEN', 'PEN']], value: c.currency, col: 4 },
        { id: 'penaltyPct', label: 'Penalidad por no-uso (%)', type: 'number', min: 0, max: 100, required: true, value: c.penaltyPct, col: 4, hint: 'Sobre la tarifa neta de lo retenido y no usado' },
        { id: 'notes', label: 'Condiciones / notas', type: 'textarea', value: c.notes, col: 12 }
      ]),
      onOpen: (m) => {
        const ps = m.querySelector('#providerId'), ss = m.querySelector('#serviceId');
        if (!edit) ps.onchange = () => { const s = svcs.find(x => x.providerId === ps.value); if (s) { ss.value = s.id; m.querySelector('#currency').value = s.currency; m.querySelector('#netRate').value = s.cost; } };
      },
      actions: [{ label: 'Cancelar' }, { label: edit ? 'Guardar cambios' : 'Registrar contrato', cls: 'primary', icon: 'check', onClick: (m) => {
        if (deny(P_CUP)) return;
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        if (f.to < f.from) { UI.toast('CUP-BR-001: la vigencia final debe ser posterior al inicio.', 'bad'); return false; }
        if (!edit) {
          const s = Q.service(f.serviceId);
          if (s && s.providerId !== f.providerId) { UI.toast('CUP-BR-002: el servicio no pertenece al proveedor seleccionado.', 'bad'); return false; }
          const kind = s.type === 'Tren' ? 'tren' : s.type === 'Entrada' ? 'entrada' : 'hotel';
          const overlap = DB.allotments.find(x => x.serviceId === f.serviceId && !['liberado', 'vencido'].includes(x.status) && x.from <= f.to && x.to >= f.from);
          if (overlap) { UI.toast('CUP-BR-003: ya existe el contrato ' + overlap.id + ' vigente para ese servicio en el rango.', 'bad'); return false; }
          const id = 'CUP-2026-' + String(DB.allotments.length + 1).padStart(3, '0');
          const nc = { id, providerId: f.providerId, serviceId: f.serviceId, kind, name: f.name, contractRef: f.contractRef, from: f.from, to: f.to, qty: +f.qty, releaseDays: +f.releaseDays, netRate: +f.netRate, currency: f.currency, penaltyPct: +f.penaltyPct, status: 'activo', owner: Auth.user.id, createdAt: nowStr(), notes: f.notes, overrides: {}, released: {}, retained: {}, charges: [], requests: [], log: [{ ts: nowStr(), user: Auth.user.id, m: 'Contrato registrado' }] };
          DB.allotments.push(nc); refreshStatus(nc); Store.save();
          Audit.log('Cupo', id, 'crear', '', f.qty + ' ' + KIND[kind].unit + ' · ' + f.from + '→' + f.to);
          UI.toast('Contrato ' + id + ' registrado.'); location.hash = '#/catalogo/cupos/' + id; return;
        }
        const before = c.qty + ' / rel ' + c.releaseDays + ' / ' + c.netRate + ' / ' + c.penaltyPct + '%';
        Object.assign(c, { name: f.name, contractRef: f.contractRef, from: f.from, to: f.to, qty: +f.qty, releaseDays: +f.releaseDays, netRate: +f.netRate, currency: f.currency, penaltyPct: +f.penaltyPct, notes: f.notes });
        if (c.status === 'vencido' && c.to >= T()) c.status = 'activo';
        c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Condiciones del contrato editadas' });
        refreshStatus(c); Store.save();
        Audit.log('Cupo', c.id, 'editar_contrato', before, c.qty + ' / rel ' + c.releaseDays + ' / ' + c.netRate + ' / ' + c.penaltyPct + '%');
        UI.toast('Contrato actualizado.'); App.render();
      } }]
    });
  }

  function cellDrawer(c, d) {
    const U = usageMap(), x = cellAt(c, d, U), can = Auth.can(P_CUP), past = d < T(), closed = ['liberado', 'vencido'].includes(c.status);
    const refs = x.refs.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reserva</th><th>Servicio</th><th class="num">Unid.</th><th>Estado</th></tr></thead><tbody>' + x.refs.map(r => '<tr><td>' + (Access.canRoute('reservas') ? '<a href="#/reservas/' + esc(r.resId) + '">' + esc(r.resId) + '</a>' : esc(r.resId)) + '</td><td class="small">' + esc(r.name) + '</td><td class="num">' + r.q + '</td><td>' + UI.badge(r.status) + (r.used ? '' : ' <span class="xs faint">no consume</span>') + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin reservas que consuman este cupo en la fecha.', 'box');
    const charge = c.charges.find(k => k.date === d);
    const note = x.over ? UI.alert('bad', '<b>Sobreventa:</b> ' + x.over + ' ' + unitOf(c) + ' confirmadas por encima del cupo vigente. CUP-BR-006: tramitar como <i>on request</i> con el proveedor o solicitar ampliación.') :
      x.st === 'rel' ? UI.alert('warn', 'El release vence el <b>' + date(x.dl) + '</b> (' + (x.dlIn === 0 ? 'hoy' : 'en ' + x.dlIn + ' día(s)') + '). Si no se vende ni se retiene, el job liberará ' + x.avail + ' ' + unitOf(c) + '.') :
        x.st === 'ret' ? UI.alert('warn', '<b>Retenido después del release</b> (' + esc(x.retained) + '). Exposición de penalidad: ' + money(x.avail * c.netRate * c.penaltyPct / 100, c.currency) + ' si no se usa.') : '';
    UI.drawer({ title: esc(c.name), sub: dow(d) + ' ' + date(d) + ' · ' + esc(prov(c).name), body:
      note + UI.dl([['Bloqueado', x.B + ' ' + unitOf(c)], ['Liberado', x.R], ['Usado (confirmado)', '<b>' + x.used + '</b>'], ['En trámite (no consume)', x.pend], ['Disponible', '<b>' + x.avail + '</b>'], ['Utilización', fmtN(pct(x.used, x.cap), 0) + ' %'], ['Fecha de release', date(x.dl) + (past ? '' : x.dlIn < 0 ? ' · vencido' : ' · en ' + x.dlIn + ' día(s)')], ['Retención', x.retained ? esc(x.retained) : '—'], charge ? ['Cargo por no-uso', money(charge.amount, c.currency) + ' (' + charge.qty + ' unid.)'] : null]) +
      '<div class="section-title" style="margin-top:16px">Consumo automático desde reservas</div>' + refs +
      (can && !past && !closed ? '<div class="section-title" style="margin-top:16px">Ajustar esta fecha</div><div class="form-grid"><div class="field c6"><label for="cd-n">Unidades a liberar</label><input class="input" id="cd-n" type="number" min="1" max="' + x.avail + '" value="' + Math.max(1, x.avail) + '"' + (x.avail ? '' : ' disabled') + '></div><div class="field c6"><label for="cd-r">Motivo de retención</label><input class="input" id="cd-r" placeholder="Ej. grupo en negociación" value="' + esc(x.retained) + '"></div></div>' : (!can ? UI.alert('info', 'Vista de solo lectura. Requiere permiso ' + P_CUP + ' para liberar o retener.') : '')),
      actions: can && !past && !closed ? [
        { label: 'Liberar ahora', icon: 'upload', onClick: (dr) => {
          const n = +dr.querySelector('#cd-n').value;
          if (!x.avail) { UI.toast('No hay unidades disponibles para liberar.', 'bad'); return false; }
          if (!(n >= 1 && n <= x.avail)) { UI.toast('CUP-BR-005: solo puede liberar entre 1 y ' + x.avail + ' unidades (no se libera lo ya consumido).', 'bad'); return false; }
          c.released[d] = (c.released[d] || 0) + n; if (n === x.avail) delete c.retained[d];
          c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Liberación manual de ' + n + ' ' + unitOf(c) + ' del ' + date(d) });
          refreshStatus(c); Store.save();
          Audit.log('Cupo', c.id, 'liberar', d + ' bloq. ' + (x.B - x.R), 'bloq. ' + (x.B - x.R - n));
          Notify.push('cupo.liberacion', 'Email', prov(c).email || prov(c).name, 'Liberamos ' + n + ' ' + unitOf(c) + ' del ' + date(d) + ' — ' + c.id);
          UI.toast(n + ' ' + unitOf(c) + ' liberadas y notificadas al proveedor.'); App.render();
        } },
        x.retained ? { label: 'Quitar retención', icon: 'x', onClick: () => {
          delete c.retained[d]; c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Retención retirada del ' + date(d) }); refreshStatus(c); Store.save();
          Audit.log('Cupo', c.id, 'quitar_retencion', d, ''); UI.toast('Retención retirada. El job de release liberará lo disponible.'); App.render();
        } } : { label: 'Retener (no liberar)', icon: 'lock', onClick: (dr) => {
          const r = dr.querySelector('#cd-r').value.trim();
          if (!r) { dr.querySelector('#cd-r').classList.add('err'); UI.toast('Indique el motivo de la retención.', 'bad'); return false; }
          c.retained[d] = r; c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Retención del ' + date(d) + ': ' + r }); refreshStatus(c); Store.save();
          Audit.log('Cupo', c.id, 'retener', d, r + ' · exposición ' + money(x.avail * c.netRate * c.penaltyPct / 100, c.currency));
          UI.toast('Fecha retenida. CUP-BR-007: lo no usado genera penalidad del ' + c.penaltyPct + ' %.', 'warn'); App.render();
        } },
        { label: 'Cerrar' }] : [{ label: 'Cerrar' }]
    });
  }

  function expansionModal(c) {
    if (deny(P_CUP)) return;
    UI.modal({ title: 'Solicitar ampliación de cupo', sub: esc(c.id) + ' · ' + esc(prov(c).name), body:
      UI.form([
        { id: 'from', label: 'Desde', type: 'date', required: true, value: T() > c.from ? addDays(T(), 7) : c.from, col: 4 },
        { id: 'to', label: 'Hasta', type: 'date', required: true, value: T() > c.from ? addDays(T(), 9) : c.from, col: 4 },
        { id: 'qty', label: 'Unidades adicionales por fecha', type: 'number', min: 1, required: true, value: 2, col: 4 },
        { id: 'note', label: 'Motivo / mensaje al proveedor', type: 'textarea', required: true, col: 12, placeholder: 'Ej. grupo corporativo en negociación, alta demanda web…' }
      ]) + '<p class="xs faint" style="margin-top:8px">Se envía por correo a ' + esc(prov(c).email || '—') + ' (y a la extranet del proveedor en producción). La ampliación se aplica al bloqueo solo cuando el proveedor la acepta.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Enviar solicitud', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        if (f.to < f.from || f.from < T()) { UI.toast('Rango inválido: debe ser futuro y con fin posterior al inicio.', 'bad'); return false; }
        if (f.from < c.from || f.to > c.to) { UI.toast('CUP-BR-004: la ampliación debe estar dentro de la vigencia del contrato (' + date(c.from) + ' – ' + date(c.to) + ').', 'bad'); return false; }
        const all = DB.allotments.flatMap(x => x.requests.map(r => +String(r.id).replace(/\D/g, '')));
        const id = 'AMP-' + String(Math.max(13, ...all) + 1).padStart(4, '0');
        c.requests.unshift({ id, from: f.from, to: f.to, qty: +f.qty, status: 'solicitada', ts: nowStr(), user: Auth.user.id, note: f.note, response: '', respondedAt: '' });
        c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Ampliación ' + id + ' solicitada: +' + f.qty + ' del ' + date(f.from) + ' al ' + date(f.to) });
        Store.save();
        Audit.log('Cupo', c.id, 'solicitar_ampliacion', '', id + ' +' + f.qty + ' ' + f.from + '→' + f.to);
        Notify.push('cupo.ampliacion', 'Email', prov(c).email || prov(c).name, 'Solicitud de ampliación ' + id + ' (+' + f.qty + ' ' + unitOf(c) + ')');
        UI.toast('Solicitud ' + id + ' enviada al proveedor.'); App.render();
      } }]
    });
  }
  function respondExpansion(c, r, accepted) {
    if (deny(P_CUP)) return;
    UI.confirm({ title: accepted ? 'Registrar aceptación del proveedor' : 'Registrar rechazo del proveedor', message: 'Ampliación <b>' + esc(r.id) + '</b>: +' + r.qty + ' ' + unitOf(c) + ' del ' + date(r.from) + ' al ' + date(r.to) + '.' + (accepted ? ' El bloqueo de cada fecha se incrementará automáticamente.' : ''), reason: true, reasonLabel: 'Respuesta / contacto del proveedor', confirmLabel: accepted ? 'Aceptada' : 'Rechazada', danger: !accepted,
      onConfirm: (txt) => {
        r.status = accepted ? 'aceptada' : 'rechazada'; r.response = txt; r.respondedAt = nowStr();
        if (accepted) eachDate(r.from, r.to, d => { c.overrides[d] = blockedAt(c, d) + r.qty; });
        c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Ampliación ' + r.id + ' ' + r.status + ': ' + txt });
        refreshStatus(c); Store.save();
        Audit.log('Cupo', c.id, 'ampliacion_' + r.status, 'solicitada', r.id + (accepted ? ' +' + r.qty : ''));
        UI.toast('Ampliación ' + r.id + ' ' + r.status + '.'); App.render();
      } });
  }
  function releaseContract(c) {
    if (deny(P_CUP)) return;
    const U = usageMap(); let n = 0; const dates = [];
    eachDate(T() > c.from ? T() : c.from, c.to, d => { const x = cellAt(c, d, U); if (x.avail > 0) { n += x.avail; dates.push([d, x.avail]); } });
    UI.confirm({ title: 'Liberar todo el contrato', message: 'Se devolverán al proveedor <b>' + n + ' ' + unitOf(c) + '</b> sin usar en ' + dates.length + ' fecha(s) futuras. Lo ya consumido por reservas se mantiene. El contrato pasa a <b>Liberado</b> y deja de recibir consumo nuevo.', reason: true, danger: true, confirmLabel: 'Liberar contrato',
      onConfirm: (why) => {
        dates.forEach(([d, a]) => { c.released[d] = (c.released[d] || 0) + a; delete c.retained[d]; });
        const b = c.status; c.status = 'liberado';
        c.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Contrato liberado (' + n + ' unid.): ' + why });
        Store.save(); Audit.log('Cupo', c.id, 'liberar_contrato', b, 'liberado · ' + n + ' unid. · ' + why);
        Notify.push('cupo.liberacion', 'Email', prov(c).email || prov(c).name, 'Liberación total del cupo ' + c.id + ' (' + n + ' ' + unitOf(c) + ')');
        UI.toast('Contrato liberado y proveedor notificado.'); App.render();
      } });
  }

  /* ---------- Vistas ---------- */
  let gridStart = null, gridKind = '', gridAll = false;
  const CUP_TABS = ['grilla', 'contratos', 'release', 'pickup'];
  App.register('catalogo/cupos', (el, params) => {
    css(); seedAllotments();
    if (params[0] && !CUP_TABS.includes(params[0])) return cupDetail(el, params[0]);
    const U = usageMap(), can = Auth.can(P_CUP), all = DB.allotments;
    const act = all.filter(c => !['liberado', 'vencido'].includes(c.status));
    const s30 = act.map(c => ({ c, s: periodStats(c, U, T(), 30) }));
    const utilAvg = pct(sum(s30, x => x.s.used), sum(s30, x => x.s.cap));
    const upc = act.flatMap(c => upcomingRelease(c, U).map(x => ({ ...x, c })));
    const pend = act.flatMap(c => pendingRelease(c, U).map(x => ({ ...x, c })));
    const over = act.flatMap(c => { const o = []; eachDate(T() > c.from ? T() : c.from, c.to, d => { const x = cellAt(c, d, U); if (x.over) o.push({ c, d, n: x.over }); }); return o; });
    const penPEN = sum(all, c => Util.toPEN(penaltyTotal(c), c.currency)), expPEN = sum(act, c => Util.toPEN(exposure(c, U).amt, c.currency));
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Cupos y bloqueos', crumbs: [['Catálogo', '#/catalogo/productos'], ['Cupos y bloqueos']],
      subtitle: 'Allotments contratados con hoteles, tren y entradas: bloqueo por fecha, release automático, consumo desde reservas confirmadas y penalidad por no-uso.',
      actions: '<button class="btn" id="cp-job"' + dis(P_CUP) + '>' + ic('refresh') + 'Ejecutar job de release</button><button class="btn primary" id="cp-new"' + dis(P_CUP) + '>' + ic('plus') + 'Nuevo contrato</button>' }) +
      (!can ? UI.alert('info', 'Vista de <b>solo lectura</b> para ' + esc(Q.roleName(Auth.role)) + ': consulta de utilización, tarifas netas y costo de penalidades. La gestión requiere el permiso ' + P_CUP + ' (Operaciones, Manager, Admin).') : '') +
      (pend.length ? UI.alert('warn', '<b>' + pend.length + ' fecha(s) con release vencido sin liberar</b> (' + [...new Set(pend.map(p => p.c.id))].join(', ') + '). El job "Liberar cupos en release" las devolverá al proveedor' + (can ? ' — <a href="#" id="cp-job2">ejecutar ahora</a>' : '') + '.') : '') +
      (over.length ? UI.alert('bad', '<b>Sobreventa detectada:</b> ' + over.map(o => esc(o.c.id) + ' ' + dateShort(o.d) + ' (+' + o.n + ')').join(', ') + '. Regla CUP-BR-006.') : '') +
      '<div class="grid g5" style="margin-bottom:16px">' +
      UI.kpi({ label: 'Contratos activos', value: act.length + ' / ' + all.length, sub: all.filter(c => c.status === 'en_release').length + ' en release', icon: 'layers' }) +
      UI.kpi({ label: 'Utilización 30 días', value: fmtN(utilAvg, 0) + ' %', sub: sum(s30, x => x.s.used) + ' usadas de ' + sum(s30, x => x.s.cap), tone: utilAvg < 40 ? 'warn' : 'ok', icon: 'chart' }) +
      UI.kpi({ label: 'Release próximo (≤ 3 d)', value: upc.length + ' fechas', sub: sum(upc, 'n') + ' unidades por vencer', tone: upc.length ? 'warn' : 'ok', icon: 'clock' }) +
      UI.kpi({ label: 'Exposición a penalidad', value: 'S/ ' + fmtN(expPEN, 0), sub: 'Retenido tras el release', tone: expPEN ? 'bad' : 'ok', icon: 'alert' }) +
      UI.kpi({ label: 'Penalidades devengadas', value: 'S/ ' + fmtN(penPEN, 0), sub: 'Cargos por no-uso (TC ' + DB.settings.fx + ')', tone: 'violet', icon: 'coins' }) + '</div><div id="cp-tabs"></div></div>';
    const bindJob = (b) => b && (b.onclick = (e) => { e.preventDefault(); runReleaseJob(true); });
    bindJob(el.querySelector('#cp-job')); bindJob(el.querySelector('#cp-job2'));
    el.querySelector('#cp-new').onclick = () => { if (!deny(P_CUP)) contractForm(); };
    UI.tabs(el.querySelector('#cp-tabs'), [
      { id: 'grilla', label: 'Grilla fecha × contrato', render: (b) => renderGrid(b) },
      { id: 'contratos', label: 'Contratos', count: all.length, render: (b) => renderContracts(b, U) },
      { id: 'release', label: 'Alertas de release', count: upc.length + pend.length, render: (b) => renderRelease(b, U, upc, pend) },
      { id: 'pickup', label: 'Pick-up report', render: (b) => renderPickup(b, U) }
    ], CUP_TABS.includes(params[0]) ? params[0] : 'grilla', { onChange: (t) => { try { history.replaceState(null, '', '#/catalogo/cupos' + (t === 'grilla' ? '' : '/' + t)); } catch (e) { } } });
  });

  function renderGrid(box) {
    if (!gridStart) gridStart = addDays(T(), -2);
    const days = 14, U = usageMap();
    const rows = DB.allotments.filter(c => (!gridKind || c.kind === gridKind) && (gridAll || !['liberado', 'vencido'].includes(c.status)));
    const dates = range(days).map(i => addDays(gridStart, i));
    box.innerHTML = UI.card('Disponibilidad por fecha', '<div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
      '<button class="btn sm" id="g-prev">' + ic('chevronLeft') + '7 días</button><button class="btn sm" id="g-today">Hoy</button><button class="btn sm" id="g-next">7 días' + ic('chevronRight') + '</button>' +
      '<input class="input sm" type="date" id="g-date" value="' + gridStart + '" style="width:auto" aria-label="Fecha inicial">' +
      '<select class="input sm" id="g-kind" style="width:auto" aria-label="Tipo"><option value="">Tipo: todos</option>' + Object.keys(KIND).map(k => '<option value="' + k + '"' + (gridKind === k ? ' selected' : '') + '>' + KIND[k].label + '</option>').join('') + '</select>' +
      '<label class="check small"><input type="checkbox" id="g-all"' + (gridAll ? ' checked' : '') + '> Incluir liberados y vencidos</label></div>' +
      (rows.length ? '<div class="tbl-wrap"><table class="cup-grid"><thead><tr><th class="rowh">Contrato</th>' + dates.map(d => '<th class="' + (d === T() ? 'today' : '') + '">' + dow(d) + '<br>' + dateShort(d) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(c => '<tr><td class="rowh"><a href="#/catalogo/cupos/' + c.id + '" class="small" style="font-weight:600">' + esc(prov(c).name) + '</a><div class="xs faint">' + esc(c.id) + ' · ' + KIND[c.kind].unit + ' · rel. ' + c.releaseDays + ' d</div><div style="margin-top:3px">' + cBadge(c.status) + '</div></td>' +
          dates.map(d => { const x = cellAt(c, d, U); if (x.st === 'off') return '<td><div class="cup-cell st-off"><small>—</small></div></td>'; return '<td><button class="cup-cell st-' + x.st + '" data-c="' + c.id + '" data-d="' + d + '" title="' + esc(date(d) + ' · bloq. ' + x.B + ' · lib. ' + x.R + ' · usado ' + x.used + ' · disp. ' + x.avail + (x.pend ? ' · en trámite ' + x.pend : '') + ' · release ' + date(x.dl)) + '"><b>' + x.avail + '</b><small>' + x.used + '/' + x.cap + (x.R ? ' · L' + x.R : '') + '</small></button></td>'; }).join('') + '</tr>').join('') +
        '</tbody></table></div>' : UI.empty('No hay contratos para los filtros seleccionados.', 'grid')) +
      '<div class="cup-leg"><span><b>N</b> = disponible · usado/cupo vigente · L = liberado</span><span><i style="background:var(--ok-soft)"></i>Holgado</span><span><i style="background:var(--info-soft)"></i>≥ 50 % usado</span><span><i style="background:var(--sun-soft)"></i>Completo</span><span><i style="background:var(--warn-soft)"></i>Release ≤ 3 días o vencido</span><span><i style="background:var(--violet-soft)"></i>Retenido (riesgo de penalidad)</span><span><i style="background:var(--bad-soft)"></i>Sobreventa</span><span><i style="background:var(--surface-2)"></i>Fecha pasada o cupo liberado</span></div>',
    { sub: 'Clic en una celda para ver reservas que consumen el cupo, liberar o retener. El consumo se calcula de las reservas con servicios confirmados del proveedor.' });
    const go = (d) => { gridStart = d; renderGrid(box); };
    box.querySelector('#g-prev').onclick = () => go(addDays(gridStart, -7));
    box.querySelector('#g-next').onclick = () => go(addDays(gridStart, 7));
    box.querySelector('#g-today').onclick = () => go(addDays(T(), -2));
    box.querySelector('#g-date').onchange = (e) => e.target.value && go(e.target.value);
    box.querySelector('#g-kind').onchange = (e) => { gridKind = e.target.value; renderGrid(box); };
    box.querySelector('#g-all').onchange = (e) => { gridAll = e.target.checked; renderGrid(box); };
    box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => cellDrawer(DB.allotments.find(c => c.id === b.dataset.c), b.dataset.d));
  }

  function renderContracts(box, U) {
    UI.dataTable(box, {
      exportName: 'cupos', searchPlaceholder: 'Buscar contrato o proveedor…',
      rows: () => DB.allotments,
      search: (c) => [c.id, c.name, prov(c).name, c.contractRef].join(' '),
      filters: [{ label: 'Estado', key: 'status', options: Object.keys(CST).map(k => [k, CST[k][1]]) }, { label: 'Tipo', key: 'kind', options: Object.keys(KIND).map(k => [k, KIND[k].label]) }],
      onRow: (c) => location.hash = '#/catalogo/cupos/' + c.id,
      columns: [
        { key: 'id', label: 'Contrato', render: c => '<div class="cell-main mono">' + esc(c.id) + '</div><div class="cell-sub">' + esc(c.contractRef) + '</div>' },
        { key: 'prov', label: 'Proveedor / cupo', sortVal: c => prov(c).name, csv: c => prov(c).name + ' — ' + c.name, render: c => '<div class="cell-main">' + esc(prov(c).name) + '</div><div class="cell-sub">' + esc(c.name) + '</div>' },
        { key: 'kind', label: 'Tipo', render: c => KIND[c.kind].label },
        { key: 'from', label: 'Vigencia', csv: c => c.from + ' a ' + c.to, render: c => '<span class="small">' + dateShort(c.from) + ' – ' + date(c.to) + '</span>' },
        { key: 'qty', label: 'Bloqueo base', align: 'num', render: c => c.qty + ' <span class="xs faint">' + KIND[c.kind].unit + '</span>' },
        { key: 'releaseDays', label: 'Release', align: 'num', render: c => c.releaseDays + ' d' },
        { key: 'netRate', label: 'Tarifa neta', align: 'num', csv: c => c.currency + ' ' + c.netRate, render: c => money(c.netRate, c.currency) },
        { key: 'penaltyPct', label: 'Penalidad', align: 'num', render: c => c.penaltyPct + ' %' },
        { key: 'util', label: 'Util. 30 d', align: 'num', sortVal: c => periodStats(c, U, T(), 30).util, csv: c => fmtN(periodStats(c, U, T(), 30).util, 0) + '%', render: c => { if (['liberado', 'vencido'].includes(c.status)) return '<span class="faint">—</span>'; const s = periodStats(c, U, T(), 30); return '<div style="min-width:80px">' + fmtN(s.util, 0) + ' %' + UI.progress(s.util, s.util < 30 ? 'warn' : '') + '</div>'; } },
        { key: 'pen', label: 'Penalidad devengada', align: 'num', sortVal: c => penaltyTotal(c), csv: c => penaltyTotal(c), render: c => penaltyTotal(c) ? '<span style="color:var(--bad)">' + money(penaltyTotal(c), c.currency) + '</span>' : '<span class="faint">—</span>' },
        { key: 'status', label: 'Estado', render: c => cBadge(c.status) }
      ]
    });
  }

  function renderRelease(box, U, upc, pend) {
    const can = Auth.can(P_CUP);
    const row = (x, kind) => '<tr><td><a href="#/catalogo/cupos/' + x.c.id + '" class="mono">' + esc(x.c.id) + '</a><div class="cell-sub">' + esc(prov(x.c).name) + '</div></td><td>' + dow(x.d) + ' ' + date(x.d) + '</td><td>' + date(deadline(x.c, x.d)) + '</td><td class="num"><b>' + x.n + '</b> <span class="xs faint">' + unitOf(x.c) + '</span></td><td class="num">' + (x.c.penaltyPct ? money(x.n * x.c.netRate * x.c.penaltyPct / 100, x.c.currency) : '<span class="faint">Sin penalidad</span>') + '</td><td>' + (kind === 'pend' ? UI.badge('vencida', 'Release vencido') : UI.badge('pendiente', 'Vence en ' + x.dlIn + ' d')) + '</td><td class="right"><button class="btn xs" data-cell="' + x.c.id + '|' + x.d + '">' + (can ? 'Gestionar' : 'Ver') + '</button></td></tr>';
    const all = pend.map(x => row(x, 'pend')).concat(upc.map(x => row(x, 'upc')));
    const ret = DB.allotments.filter(c => !['liberado', 'vencido'].includes(c.status)).flatMap(c => Object.keys(c.retained).filter(d => d >= T()).map(d => ({ c, d, x: cellAt(c, d, U) }))).filter(r => r.x.avail > 0);
    box.innerHTML = '<div class="grid g-2-1">' + UI.card('Fechas por liberar', all.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Contrato</th><th>Fecha de servicio</th><th>Release</th><th class="num">Sin usar</th><th class="num">Penalidad si se retiene</th><th>Situación</th><th></th></tr></thead><tbody>' + all.join('') + '</tbody></table></div>' : UI.empty('No hay releases vencidos ni próximos en los siguientes 3 días.', 'checkCircle'),
      { tight: true, sub: 'Release vencido (el job los libera) y releases que vencen en ≤ 3 días (alerta a Operaciones).', actions: '<button class="btn sm primary" id="rl-run"' + dis(P_CUP) + '>' + ic('refresh') + 'Liberar cupos en release</button>' }) +
      '<div class="col" style="gap:16px">' + UI.card('Retenciones activas', ret.length ? '<div class="list">' + ret.map(r => '<div class="list-item"><div class="grow"><div class="small"><b>' + esc(r.c.id) + '</b> · ' + date(r.d) + '</div><div class="xs faint">' + esc(r.c.retained[r.d]) + '</div></div><div class="right small"><b>' + r.x.avail + '</b> ' + unitOf(r.c) + '<div class="xs" style="color:var(--bad)">' + money(r.x.avail * r.c.netRate * r.c.penaltyPct / 100, r.c.currency) + '</div></div></div>').join('') + '</div>' : UI.empty('Sin retenciones posteriores al release.', 'lock'), { sub: 'Unidades que no se liberarán automáticamente' }) +
      UI.card('Job programado', (() => { const j = DB.jobs.find(x => x.id === 'JOB-10') || {}; return UI.dl([['Job', esc(j.name || 'Liberar cupos en release')], ['Frecuencia', esc(j.cron || 'diario 00:15')], ['Última ejecución', datetime(j.last)], ['Resultado', esc(j.lastResult || '—')], ['Estado', UI.badge(j.status || 'ok')]]); })()) + '</div></div>';
    box.querySelector('#rl-run').onclick = () => runReleaseJob(true);
    box.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { const [id, d] = b.dataset.cell.split('|'); cellDrawer(DB.allotments.find(c => c.id === id), d); });
  }

  /* Pick-up report: ritmo de ventas vs cupo en el horizonte */
  function pickupSeries(c, U, from, days, weeks) {
    const refs = []; range(days).forEach(i => { const d = addDays(from, i); const u = (U[c.id] || {})[d]; if (u) u.refs.filter(r => r.used).forEach(r => refs.push({ ...r, d })); });
    const ends = range(weeks + 1).map(k => addDays(T(), -7 * (weeks - k)));
    return { ends, cum: ends.map(e => sum(refs.filter(r => String(r.created).slice(0, 10) <= e), 'q')), refs };
  }
  function renderPickup(box, U) {
    const H = 30, W = 8;
    const act = DB.allotments.filter(c => !['vencido'].includes(c.status));
    const rows = act.map(c => {
      const s = periodStats(c, U, T(), H), ps = pickupSeries(c, U, T(), H, W);
      const p7 = sum(ps.refs.filter(r => String(r.created).slice(0, 10) > addDays(T(), -7)), 'q'), p30 = sum(ps.refs.filter(r => String(r.created).slice(0, 10) > addDays(T(), -30)), 'q');
      const rec = c.status === 'liberado' ? ['mute', 'Contrato liberado'] : s.util >= 85 ? ['ok', 'Solicitar ampliación'] : s.util < 25 && s.cap > 0 ? ['warn', 'Reducir bloqueo / liberar anticipado'] : ['info', 'Mantener y monitorear'];
      return { c, s, p7, p30, rec };
    });
    let sel = rows.find(r => r.c.id === 'CUP-2026-001') ? 'CUP-2026-001' : (rows[0] && rows[0].c.id);
    const draw = () => {
      const r = rows.find(x => x.c.id === sel);
      const ps = r ? pickupSeries(r.c, U, T(), H, W) : null;
      box.querySelector('#pk-chart').innerHTML = r ? UI.chart.line({ labels: ps.ends.map(dateShort), series: [{ name: 'Vendido acumulado (confirmado)', values: ps.cum }, { name: 'Cupo vigente (' + H + ' d)', values: ps.ends.map(() => r.s.cap), color: 'var(--sun)' }, { name: 'Ritmo objetivo 85 %', values: ps.ends.map((_, i) => Math.round(r.s.cap * 0.85 * (i + 1) / ps.ends.length)), color: 'var(--fg-3)' }], height: 230, area: false }) +
        '<p class="xs faint" style="margin-top:8px">Unidades confirmadas para estadías entre ' + date(T()) + ' y ' + date(addDays(T(), H - 1)) + ', acumuladas por fecha de creación de la reserva (corte semanal). En trámite: ' + r.s.pend + ' unid. (no consumen hasta confirmarse).</p>' : UI.empty('Sin contratos.', 'chart');
    };
    box.innerHTML = UI.card('Pick-up por contrato — próximos ' + H + ' días', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Contrato</th><th class="num">Cupo vigente</th><th class="num">Vendido</th><th class="num">En trámite</th><th class="num">Util.</th><th class="num">Pick-up 7 d</th><th class="num">Pick-up 30 d</th><th>Recomendación</th></tr></thead><tbody>' +
      rows.map(r => '<tr class="click" data-pk="' + r.c.id + '"><td><div class="cell-main">' + esc(prov(r.c).name) + '</div><div class="cell-sub mono">' + esc(r.c.id) + ' · ' + KIND[r.c.kind].unit + '</div></td><td class="num">' + r.s.cap + '</td><td class="num"><b>' + r.s.used + '</b></td><td class="num">' + r.s.pend + '</td><td class="num">' + fmtN(r.s.util, 0) + ' %</td><td class="num">' + r.p7 + '</td><td class="num">' + r.p30 + '</td><td>' + UI.badge(r.rec[0] === 'ok' ? 'aceptado' : r.rec[0] === 'warn' ? 'pendiente' : r.rec[0] === 'mute' ? 'liberada' : 'enviada', r.rec[1]) + '</td></tr>').join('') + '</tbody></table></div>',
    { tight: true, sub: 'Ritmo de ventas (pick-up) frente al cupo contratado. Clic en una fila para ver su curva.' }) +
      '<div style="height:16px"></div>' + UI.card('Curva de pick-up', '<div id="pk-chart"></div>', { sub: '<span id="pk-sub"></span>' });
    const setSel = (id) => { sel = id; const r = rows.find(x => x.c.id === id); box.querySelector('#pk-sub').textContent = r ? r.c.id + ' · ' + prov(r.c).name : ''; box.querySelectorAll('[data-pk]').forEach(tr => tr.style.background = tr.dataset.pk === id ? 'var(--accent-soft)' : ''); draw(); };
    box.querySelectorAll('[data-pk]').forEach(tr => tr.onclick = () => setSel(tr.dataset.pk));
    setSel(sel);
  }

  function cupDetail(el, id) {
    const c = DB.allotments.find(x => x.id === id);
    if (!c) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Contrato no encontrado', crumbs: [['Catálogo', '#/catalogo/productos'], ['Cupos y bloqueos', '#/catalogo/cupos'], [id]] }) + UI.card('', UI.empty('No existe el contrato de cupo ' + id + '.', 'search')) + '</div>'; return; }
    const U = usageMap(), can = Auth.can(P_CUP), closed = ['liberado', 'vencido'].includes(c.status), p = prov(c);
    const s30 = periodStats(c, U, T() > c.from ? T() : c.from, 30), ex = exposure(c, U), up = upcomingRelease(c, U), pe = pendingRelease(c, U);
    const flowIdx = { activo: 0, en_release: 1, liberado: 2, vencido: 3 }[c.status];
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(c.name), crumbs: [['Catálogo', '#/catalogo/productos'], ['Cupos y bloqueos', '#/catalogo/cupos'], [c.id]],
      subtitle: '<span class="mono">' + esc(c.id) + '</span> · ' + esc(p.name) + ' · ' + esc(c.contractRef) + ' · ' + cBadge(c.status),
      actions: '<button class="btn" id="cd-amp"' + (can && !closed ? '' : dis(P_CUP) || ' disabled title="Contrato ' + c.status + '"') + '>' + ic('send') + 'Solicitar ampliación</button><button class="btn" id="cd-edit"' + dis(P_CUP) + '>' + ic('edit') + 'Editar</button><button class="btn danger" id="cd-rel"' + (can && !closed ? '' : dis(P_CUP) || ' disabled title="Contrato ' + c.status + '"') + '>' + ic('upload') + 'Liberar contrato</button>' }) +
      (pe.length ? UI.alert('warn', '<b>Release vencido sin ejecutar</b> en ' + pe.length + ' fecha(s) (' + sum(pe, 'n') + ' unid.). Se liberarán en la próxima ejecución del job.') : '') +
      (ex.q ? UI.alert('bad', '<b>Exposición de penalidad:</b> ' + ex.q + ' ' + unitOf(c) + ' retenidas después del release · ' + money(ex.amt, c.currency) + ' si no se venden (CUP-BR-007).') : '') +
      '<div class="grid g5" style="margin-bottom:16px">' +
      UI.kpi({ label: 'Cupo vigente 30 d', value: fmtN(s30.cap, 0), sub: s30.B + ' bloq. · ' + s30.R + ' liberadas', icon: KIND[c.kind].icon }) +
      UI.kpi({ label: 'Usado (confirmado)', value: fmtN(s30.used, 0), sub: s30.pend + ' en trámite', tone: 'ok', icon: 'checkCircle' }) +
      UI.kpi({ label: 'Utilización 30 d', value: fmtN(s30.util, 0) + ' %', sub: 'Disponible ' + s30.avail, tone: s30.util < 30 ? 'warn' : 'accent', icon: 'chart' }) +
      UI.kpi({ label: 'Release ≤ 3 días', value: up.length + ' fechas', sub: sum(up, 'n') + ' unidades', tone: up.length ? 'warn' : 'ok', icon: 'clock' }) +
      UI.kpi({ label: 'Penalidad devengada', value: money(penaltyTotal(c), c.currency, 0), sub: c.penaltyPct + ' % de la tarifa neta', tone: penaltyTotal(c) ? 'bad' : 'ok', icon: 'coins' }) + '</div>' +
      UI.card('Ciclo del contrato', UI.flow(['Activo', 'En release', 'Liberado', 'Vencido'], flowIdx) + '<p class="xs faint" style="margin-top:8px">Activo ⇄ En release (automático según fechas con release vencido sin liberar) · Liberado (acción manual con motivo) · Vencido (job al superar la vigencia).</p>') +
      '<div style="height:16px"></div><div id="cd-tabs"></div></div>';
    el.querySelector('#cd-amp').onclick = () => expansionModal(c);
    el.querySelector('#cd-edit').onclick = () => { if (!deny(P_CUP)) contractForm(c); };
    el.querySelector('#cd-rel').onclick = () => releaseContract(c);
    const refsAll = []; Object.keys(U[c.id] || {}).sort().forEach(d => U[c.id][d].refs.forEach(r => refsAll.push({ ...r, d })));
    UI.tabs(el.querySelector('#cd-tabs'), [
      { id: 'cal', label: 'Calendario', render: (b) => detailCalendar(b, c) },
      { id: 'cond', label: 'Condiciones', render: (b) => { b.innerHTML = '<div class="grid g2">' + UI.card('Contrato', UI.dl([['Proveedor', esc(p.name) + ' · ' + esc(p.contact || '')], ['Servicio', esc((Q.service(c.serviceId) || {}).name)], ['Tipo / unidad', KIND[c.kind].label + ' · ' + KIND[c.kind].unit], ['Vigencia', date(c.from) + ' – ' + date(c.to)], ['Bloqueo base', c.qty + ' por fecha'], ['Fechas con bloqueo especial', Object.keys(c.overrides).length ? Object.keys(c.overrides).sort().map(d => dateShort(d) + ': ' + c.overrides[d]).join(', ') : '—'], ['Responsable', esc(Q.userName(c.owner))], ['Registrado', datetime(c.createdAt)]])) + UI.card('Condiciones económicas y release', UI.dl([['Tarifa neta', money(c.netRate, c.currency) + ' por ' + KIND[c.kind].unit], ['Días de release', c.releaseDays + ' días antes de la fecha de servicio'], ['Penalidad por no-uso', c.penaltyPct ? c.penaltyPct + ' % de la tarifa neta sobre lo retenido y no usado' : 'Sin penalidad económica (se pierde el cupo)'], ['Términos de pago', esc(p.paymentTerms || '—')], ['Notas', esc(c.notes)]])) + '</div>'; } },
      { id: 'cons', label: 'Consumo', count: refsAll.length, render: (b) => { b.innerHTML = UI.card('Reservas que consumen el cupo', refsAll.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Reserva</th><th>Servicio</th><th class="num">Unid.</th><th>Estado servicio</th><th>Consumo</th></tr></thead><tbody>' + refsAll.map(r => '<tr><td>' + date(r.d) + '</td><td>' + (Access.canRoute('reservas') ? '<a href="#/reservas/' + esc(r.resId) + '">' + esc(r.resId) + '</a>' : esc(r.resId)) + '</td><td class="small">' + esc(r.name) + '</td><td class="num">' + r.q + '</td><td>' + UI.badge(r.status) + '</td><td>' + (r.used ? UI.badge('consumida', 'Consumido') : UI.badge('pendiente', 'En trámite')) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Ninguna reserva consume este contrato.', 'box'), { tight: true, sub: 'Regla CUP-BR-008: consume solo el servicio confirmado de una reserva no cancelada; solicitados/pendientes quedan "en trámite".' }); } },
      { id: 'amp', label: 'Ampliaciones', count: c.requests.length, render: (b) => { b.innerHTML = UI.card('Solicitudes de ampliación al proveedor', c.requests.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Solicitud</th><th>Rango</th><th class="num">Adicional</th><th>Motivo</th><th>Solicitó</th><th>Estado</th><th>Respuesta</th><th></th></tr></thead><tbody>' + c.requests.map(r => '<tr><td class="mono">' + esc(r.id) + '<div class="cell-sub">' + datetime(r.ts) + '</div></td><td class="small">' + dateShort(r.from) + ' – ' + dateShort(r.to) + '</td><td class="num">+' + r.qty + '</td><td class="small">' + esc(r.note) + '</td><td class="small">' + esc(Q.userName(r.user)) + '</td><td>' + UI.badge(REQ_ST[r.status][0], REQ_ST[r.status][1]) + '</td><td class="small">' + esc(r.response || '—') + '</td><td class="right">' + (r.status === 'solicitada' ? '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-ok="' + r.id + '"' + dis(P_CUP) + '>Aceptada</button><button class="btn xs" data-ko="' + r.id + '"' + dis(P_CUP) + '>Rechazada</button></span>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin solicitudes de ampliación.', 'send'), { tight: true, actions: '<button class="btn sm primary" id="amp-new"' + (can && !closed ? '' : ' disabled title="Requiere permiso ' + P_CUP + ' y contrato vigente"') + '>' + ic('plus') + 'Nueva solicitud</button>' });
        const nb = b.querySelector('#amp-new'); if (nb) nb.onclick = () => expansionModal(c);
        b.querySelectorAll('[data-ok]').forEach(x => x.onclick = () => respondExpansion(c, c.requests.find(r => r.id === x.dataset.ok), true));
        b.querySelectorAll('[data-ko]').forEach(x => x.onclick = () => respondExpansion(c, c.requests.find(r => r.id === x.dataset.ko), false)); } },
      { id: 'pen', label: 'Penalidades', count: c.charges.length, render: (b) => { b.innerHTML = UI.card('Cargos por no-uso', c.charges.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha servicio</th><th class="num">Unid.</th><th class="num">Monto</th><th>Motivo</th><th>Registrado</th></tr></thead><tbody>' + c.charges.slice().sort((a, b2) => b2.date.localeCompare(a.date)).map(k => '<tr><td>' + date(k.date) + '</td><td class="num">' + k.qty + '</td><td class="num">' + money(k.amount, c.currency) + '</td><td class="small">' + esc(k.reason) + '</td><td class="small">' + datetime(k.ts) + ' · ' + esc(k.by === 'Sistema' ? 'Job' : Q.userName(k.by)) + '</td></tr>').join('') + '</tbody><tfoot><tr><td>Total</td><td class="num">' + sum(c.charges, 'qty') + '</td><td class="num">' + money(penaltyTotal(c), c.currency) + '</td><td colspan="2"></td></tr></tfoot></table></div>' : UI.empty('Sin cargos por no-uso.', 'coins'), { tight: true, sub: 'En producción cada cargo genera una cuenta por pagar al proveedor (Finanzas) y se concilia con su factura.' }); } },
      { id: 'hist', label: 'Historial', render: (b) => { const aud = DB.audit.filter(a => a.entity === 'Cupo' && a.entityId === c.id); b.innerHTML = '<div class="grid g2">' + UI.card('Bitácora del contrato', UI.timeline(c.log.map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(l.user === 'Sistema' ? 'Sistema (job)' : Q.userName(l.user)), icon: 'history' })))) + UI.card('Auditoría', aud.length ? '<div class="list">' + aud.map(a => '<div class="list-item"><div class="grow"><div class="small"><b>' + esc(a.action) + '</b> · ' + esc(Q.userName(a.user)) + '</div><div class="xs faint">' + datetime(a.ts) + ' · ' + esc(a.before) + ' → ' + esc(a.after) + '</div></div></div>').join('') + '</div>' : UI.empty('Sin acciones auditadas en esta sesión.', 'shield')) + '</div>'; } }
    ], 'cal');
  }
  function detailCalendar(b, c) {
    let start = T() > c.from && T() <= c.to ? T() : c.from; start = addDays(start, -((parseD(start).getDay() + 6) % 7));
    const draw = () => {
      const U = usageMap(), cells = range(28).map(i => addDays(start, i));
      b.innerHTML = UI.card('Bloqueado / usado / disponible / liberado', '<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn sm" id="dc-p">' + ic('chevronLeft') + '</button><span class="small"><b>' + date(cells[0]) + ' – ' + date(cells[27]) + '</b></span><button class="btn sm" id="dc-n">' + ic('chevronRight') + '</button></div>' +
        '<div class="cal">' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(x => '<div class="cal-h">' + x + '</div>').join('') + cells.map(d => { const x = cellAt(c, d, U); const tone = { ok: 'info', mid: '', full: 'sun', over: 'bad', rel: 'sun', ret: 'violet', past: '', off: '', free: '' }[x.st];
          return '<div class="cal-d' + (x.st === 'off' || x.st === 'past' ? ' out' : '') + (d === T() ? ' today' : '') + '"><div class="row between"><span class="dn">' + parseD(d).getDate() + '</span>' + (x.B ? '<span class="xs faint">B' + x.B + '</span>' : '') + '</div>' + (x.B ? '<div class="cal-ev ' + tone + '" data-d="' + d + '" title="Clic para gestionar">Disp. ' + x.avail + ' · U ' + x.used + '</div>' + (x.R ? '<div class="xs faint">Lib. ' + x.R + '</div>' : '') + (x.retained && x.st !== 'past' ? '<div class="xs" style="color:var(--violet)">Retenido</div>' : '') : '') + '</div>'; }).join('') + '</div>',
      { sub: 'B = bloqueado, U = usado (confirmado), Lib. = liberado. Clic en una fecha para gestionar.' });
      b.querySelector('#dc-p').onclick = () => { start = addDays(start, -28); draw(); };
      b.querySelector('#dc-n').onclick = () => { start = addDays(start, 28); draw(); };
      b.querySelectorAll('[data-d]').forEach(x => x.onclick = () => cellDrawer(c, x.dataset.d));
    };
    draw();
  }

  /* ======================================================================
     2. DOCUMENTOS DE VIAJE DEL PASAJERO
     ====================================================================== */
  const DTYPES = [
    ['id_doc', 'Pasaporte / DNI', 'Documento de identidad con vencimiento'],
    ['visa', 'Visa', 'Solo nacionalidades que la requieren'],
    ['insurance', 'Seguro de viaje', 'Extranjeros o programas de trekking/altura'],
    ['yellow_fever', 'Vacuna fiebre amarilla', 'Programas en Amazonía'],
    ['minor_auth', 'Autorización de viaje de menor', 'Permiso notarial si no viaja con ambos padres'],
    ['migration', 'Registro migratorio (TAM virtual)', 'Pasajeros extranjeros'],
    ['emergency', 'Contacto de emergencia', 'Obligatorio para todos'],
    ['special', 'Atención especial en operación', 'Indicador y nota operativa, sin diagnósticos']
  ];
  const DLABEL = Object.fromEntries(DTYPES.map(x => [x[0], x[1]]));
  const DST = { completo: ['aceptado', 'Completo'], pendiente: ['solicitado', 'Pendiente'], recibido: ['consumida', 'Por validar'], observado: ['observado', 'Observado'], vencido: ['vencido', 'Vencido'], no_aplica: ['cancelado', 'No aplica'] };
  const dBadge = (s) => UI.badge(DST[s][0], DST[s][1]);
  const ORDER = ['vencido', 'observado', 'pendiente', 'recibido', 'completo'];
  const agg = (list) => { const l = list.filter(s => s !== 'no_aplica'); if (!l.length) return 'completo'; for (const s of ORDER) if (l.includes(s)) return s === 'recibido' ? 'pendiente' : s; return 'completo'; };

  function cfg() {
    if (!DB.travelDocsCfg) DB.travelDocsCfg = { reminderDays: [15, 7, 3], channels: ['Email', 'WhatsApp'], passportMonths: 6, visaNationalities: ['China', 'India', 'Vietnamita'], insuranceTrekking: true };
    return DB.travelDocsCfg;
  }
  const isForeign = (p) => !/peruan/i.test(p.nationality || '');
  const ageAt = (birth, d) => { if (!birth) return 99; const b = parseD(birth), x = parseD(d); let a = x.getFullYear() - b.getFullYear(); if (x.getMonth() < b.getMonth() || (x.getMonth() === b.getMonth() && x.getDate() < b.getDate())) a--; return a; };
  const isMinor = (r, p) => p.type === 'CHD' || p.type === 'INF' || ageAt(p.birth, r.travelFrom) < 18;
  const resProducts = (r) => r.services.filter(s => s.status !== 'cancelado').map(s => Q.product(s.productId)).filter(Boolean);
  const hasTrek = (r) => resProducts(r).some(p => p.category === 'Aventura');
  const hasAmazon = (r) => resProducts(r).some(p => /Loreto|Amazon|Madre de Dios/i.test(Q.destPath(p.destId)) || (p.requirements || []).some(x => /fiebre amarilla/i.test(x)));
  function applies(r, p, t) {
    const c = cfg();
    switch (t) {
      case 'visa': return isForeign(p) && c.visaNationalities.some(n => (p.nationality || '').toLowerCase().startsWith(n.toLowerCase().slice(0, 4)));
      case 'insurance': return isForeign(p) || (c.insuranceTrekking && hasTrek(r));
      case 'yellow_fever': return hasAmazon(r);
      case 'minor_auth': return isMinor(r, p);
      case 'migration': return isForeign(p);
      default: return true;
    }
  }
  /* DOC-BR-001/002: extranjero → pasaporte vigente ≥ N meses tras el fin del viaje; peruano → DNI vigente al fin del viaje */
  const minExpiry = (r, p) => isForeign(p) ? addMonths(r.travelTo, cfg().passportMonths) : r.travelTo;
  function addMonths(d, n) { const x = parseD(d); x.setMonth(x.getMonth() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function itemStatus(r, p, t, it) {
    if (!applies(r, p, t)) return 'no_aplica';
    it = it || {};
    if (t === 'emergency') return it.name && it.phone ? 'completo' : 'pendiente';
    if (t === 'special') return it.flag == null ? 'pendiente' : 'completo';
    if (t === 'id_doc' && it.expiry && it.status !== 'observado' && it.expiry < minExpiry(r, p)) return 'vencido';
    return it.status || 'pendiente';
  }
  function docRec(r) {
    if (!DB.travelDocs) DB.travelDocs = [];
    let rec = DB.travelDocs.find(x => x.resId === r.id);
    if (!rec) { rec = { resId: r.id, pax: [], reminders: [], log: [] }; DB.travelDocs.push(rec); }
    r.passengers.forEach((p, i) => { if (!rec.pax[i] || rec.pax[i].name !== p.name) rec.pax[i] = rec.pax[i] && rec.pax.find(x => x.name === p.name) || { name: p.name, items: { id_doc: { status: 'pendiente', number: p.doc || '' }, emergency: {}, special: {} } }; });
    rec.pax.length = r.passengers.length;
    return rec;
  }
  function seedDocs() {
    if (DB.travelDocs) return;
    DB.travelDocs = [];
    const ok = (number, expiry, file, by, at) => ({ status: 'completo', number, expiry, file: file ? { name: file, size: 184000, at: at || '2026-09-10 10:00', by: 'Cliente' } : null, validatedBy: by || 'U05', validatedAt: at || '2026-09-10 11:00' });
    const E = (name, phone, relation) => ({ name, phone, relation });
    const S = (flag, note) => ({ flag, note: note || '' });
    const setPax = (resId, fn) => { const r = Q.reservation(resId); if (!r) return; const rec = docRec(r); rec.pax.forEach((px, i) => fn(px, r.passengers[i], i)); return rec; };
    // Keller (en operación, extranjeros): todo completo
    let rec = setPax('RES-2026-000347', (px, p, i) => { px.items = { id_doc: ok(p.doc.replace('Pasaporte ', ''), i ? '2029-08-14' : '2031-05-10', 'pasaporte_' + (i ? 'anna' : 'thomas') + '_keller.pdf', 'U05', '2026-09-02 09:30'), insurance: ok('VA-771203', '2026-10-05', 'poliza_viajero_andino_VA-771203.pdf', 'U05', '2026-09-02 09:35'), migration: ok('TAM-DE-' + (5520 + i), '', 'tam_virtual_' + (i ? 'anna' : 'thomas') + '.pdf', 'U05', '2026-09-26 18:00'), emergency: E('Monika Keller', '+49 89 5550199', 'Familiar'), special: S(false, p.diet ? 'Dieta ' + p.diet.toLowerCase() : '') }; });
    rec.log.push({ ts: '2026-09-26 18:05', user: 'U05', m: 'Checklist completo. Emisión de entradas nominativas habilitada.' });
    // Sophie Martin (completada)
    setPax('RES-2026-000346', (px) => { px.items = { id_doc: ok('19FR22871', '2030-11-02', 'passeport_martin.pdf', 'U05', '2026-09-12 09:00'), insurance: ok('AXA-FR-889012', '2026-09-28', 'assurance_martin.pdf', 'U05', '2026-09-12 09:02'), migration: ok('TAM-FR-2201', '', 'tam_martin.pdf', 'U05', '2026-09-23 20:00'), emergency: E('Claire Martin', '+33 6 88 12 40 11', 'Familiar'), special: S(false) }; });
    // Mineros (corporativo, peruanos): DNI vencido de Manuel Oré, DNI por validar de Julio Mena, contacto pendiente de Mónica Farfán
    const dniExp = ['2029-03-11', '2030-07-22', '2031-01-05', '2028-10-30', '2032-12-14', '2027-05-19', '2029-09-01', '2030-02-26', '2033-06-08', '2028-11-17', '2031-08-03', '2026-08-15'];
    rec = setPax('RES-2026-000348', (px, p, i) => {
      const n = p.doc.replace('DNI ', '');
      px.items = { id_doc: p.name === 'Julio César Mena' ? { status: 'recibido', number: n, expiry: '2030-07-22', file: { name: 'dni_julio_mena.jpg', size: 912000, at: '2026-09-28 17:40', by: 'Cliente' } } : ok(n, dniExp[i], 'dni_' + n + '.pdf', 'U06', '2026-09-20 10:15'),
        insurance: ok('VA-G-2210', '2026-10-06', 'poliza_grupal_VA-G-2210.pdf', 'U06', '2026-09-20 10:20'),
        emergency: p.name === 'Mónica Farfán Quiroz' ? {} : E('Úrsula Benavides (RR. HH. empresa)', '01 705 3300', 'Empresa'),
        special: p.name === 'Raúl Espinoza Llerena' ? S(true, 'Coordinar ritmo pausado en caminatas y asiento delantero en bus') : S(false, p.diet ? 'Dieta ' + p.diet.toLowerCase() : '') };
    });
    rec.reminders.push({ ts: '2026-09-24 08:00', channel: 'Email', to: 'viajes@mcblanca.com.pe', by: 'Sistema', kind: 'Recordatorio automático (7 días)' });
    rec.log.push({ ts: '2026-09-29 07:10', user: 'U06', m: 'DNI de Manuel Oré Guzmán caducado (15/08/2026): se solicitó DNI renovado o pasaporte a RR. HH.' });
    // Wayra (B2B): lista de pasajeros enviada sin documentos
    rec = setPax('RES-2026-000345', (px, p) => { px.items = { id_doc: { status: 'pendiente', number: p.doc.replace('DNI ', '') }, emergency: {}, special: {} }; });
    rec.reminders.push({ ts: '2026-09-28 10:15', channel: 'Email', to: 'reservas@wayraviajes.pe', by: 'U06', kind: 'Solicitud de documentos a la agencia' });
    // Familia Ríos: 2 menores con autorización pendiente
    rec = setPax('RES-2026-000344', (px, p) => {
      const n = p.doc.replace('DNI ', ''), minor = p.type === 'CHD';
      px.items = { id_doc: minor ? { status: 'recibido', number: n, expiry: p.name.startsWith('Valeria') ? '2029-06-02' : '2027-03-15', file: { name: 'dni_' + p.name.split(' ')[0].toLowerCase() + '.jpg', size: 640000, at: '2026-09-26 21:10', by: 'Cliente' } } : ok(n, p.name.startsWith('Gabriela') ? '2031-04-12' : '2028-01-20', 'dni_' + n + '.pdf', 'U05', '2026-09-26 09:00'),
        minor_auth: minor ? { status: 'pendiente', note: 'Acreditar filiación con ambos padres (partida de nacimiento) o presentar permiso notarial del padre/madre que no viaja.' } : undefined,
        emergency: E('Rosa Montoya Salas', '998 223 410', 'Familiar'), special: S(false) };
      if (!minor) delete px.items.minor_auth;
    });
    rec.reminders.push({ ts: '2026-09-27 08:00', channel: 'Email', to: 'gabriela.rios@correo.pe', by: 'Sistema', kind: 'Recordatorio automático (15 días)' });
    // Johnson (borrador): pasaporte no cumple 6 meses de vigencia
    setPax('RES-2026-000349', (px) => { px.items = { id_doc: { status: 'completo', number: '58812290', expiry: '2027-03-10', file: { name: 'passport_johnson.pdf', size: 402000, at: '2026-09-29 08:40', by: 'Cliente' }, validatedBy: 'U05', validatedAt: '2026-09-29 09:10' }, emergency: {}, special: {} }; });
    if (!DB.jobs.some(j => j.id === 'JOB-11')) DB.jobs.push({ id: 'JOB-11', name: 'Recordatorio de documentos de viaje', cron: 'diario 08:00', last: '2026-09-29 08:00', next: '2026-09-30 08:00', status: 'ok', lastResult: 'Sin reservas en hitos 15/7/3 días' });
    Store.save();
  }
  function paxView(r, rec, i) {
    const p = r.passengers[i], px = rec.pax[i];
    const items = DTYPES.map(([t]) => ({ t, it: px.items[t] || {}, st: itemStatus(r, p, t, px.items[t]) }));
    return { p, px, items, st: agg(items.map(x => x.st)) };
  }
  function resView(r) {
    const rec = docRec(r), pax = r.passengers.map((_, i) => paxView(r, rec, i));
    const all = pax.flatMap(x => x.items).filter(x => x.st !== 'no_aplica');
    const cnt = (s) => all.filter(x => x.st === s).length;
    return { r, rec, pax, st: agg(pax.map(x => x.st)), done: cnt('completo'), total: all.length, pend: cnt('pendiente') + cnt('recibido'), obs: cnt('observado'), venc: cnt('vencido'), toValidate: cnt('recibido'), mapi: mapiCheck(r, pax) };
  }
  /* DOC-BR-010: bloqueo operativo de entradas nominativas (MAPI) */
  function mapiCheck(r, pax) {
    const svcs = r.services.filter(s => s.status !== 'cancelado').map(s => ({ s, n: nominative(s) })).filter(x => x.n);
    if (!svcs.length) return { applies: false, blocked: false, svcs: [], missing: [] };
    pax = pax || resView(r).pax;
    const missing = pax.filter(x => { const idd = x.items.find(i => i.t === 'id_doc').st, ma = x.items.find(i => i.t === 'minor_auth').st; return idd !== 'completo' || !['completo', 'no_aplica'].includes(ma); }).map(x => { const idd = x.items.find(i => i.t === 'id_doc').st, ma = x.items.find(i => i.t === 'minor_auth').st; return { name: x.p.name, why: [idd !== 'completo' ? 'documento de identidad ' + DST[idd][1].toLowerCase() : '', !['completo', 'no_aplica'].includes(ma) ? 'autorización de menor ' + DST[ma][1].toLowerCase() : ''].filter(Boolean).join(' y ') }; });
    return { applies: true, blocked: missing.length > 0, svcs, missing, emitted: svcs.every(x => x.n.date < T()) };
  }
  const liveRes = () => DB.reservations.filter(r => !['cancelada'].includes(r.status));
  const scopedRes = () => Scope.ownOnly() ? liveRes().filter(r => r.owner === Auth.user.id) : liveRes();
  const canManageDocs = () => Auth.can(P_DOC);
  const canRequest = (r) => canManageDocs() || (Auth.can('reservations.create') && r.owner === Auth.user.id);
  const resLink = (id) => Access.canRoute('reservas') ? '<a href="#/reservas/' + esc(id) + '">' + esc(id) + '</a>' : esc(id);
  const clientContact = (r) => { const c = Q.client(r.clientId) || {}; return { email: c.email || '—', phone: c.phone || '', name: c.name || '—' }; };

  function sendRequest(r, auto, label) {
    const v = resView(r), c = clientContact(r), missing = v.pax.flatMap(x => x.items.filter(i => ['pendiente', 'observado', 'vencido'].includes(i.st)).map(i => x.p.name.split(' ')[0] + ': ' + DLABEL[i.t]));
    cfg().channels.forEach(ch => Notify.push('documentos.recordatorio', ch, ch === 'Email' ? c.email : (c.phone || c.email), (auto ? 'Recordatorio: ' : 'Solicitud: ') + 'documentos pendientes para su viaje ' + r.id + ' (' + missing.length + ')'));
    v.rec.reminders.unshift({ ts: nowStr(), channel: cfg().channels.join(' + '), to: c.email, by: auto ? 'Sistema' : Auth.user.id, kind: label || (auto ? 'Recordatorio automático' : 'Solicitud manual de documentos'), items: missing.length });
    Store.save();
    return missing.length;
  }
  function runReminderJob() {
    if (deny(P_DOC)) return;
    const days = cfg().reminderDays, min = Math.min(...days); const sent = [];
    liveRes().filter(r => r.status !== 'completada' && r.travelFrom >= T()).forEach(r => {
      const v = resView(r); if (v.st === 'completo') return;
      const dtt = daysFromToday(r.travelFrom);
      const today = v.rec.reminders.some(x => String(x.ts).slice(0, 10) === T() && x.by === 'Sistema');
      if (today) return;
      if (days.includes(dtt) || dtt <= min) { sendRequest(r, true, 'Recordatorio automático (' + dtt + ' días)'); sent.push(r.id); v.rec.log.unshift({ ts: nowStr(), user: 'Sistema', m: 'Recordatorio automático enviado (' + dtt + ' días antes del viaje)' }); }
    });
    const j = DB.jobs.find(x => x.id === 'JOB-11'); const res = sent.length ? sent.length + ' recordatorio(s): ' + sent.join(', ') : 'Sin reservas en hitos ' + days.join('/') + ' días';
    if (j) { j.last = nowStr(); j.status = 'ok'; j.lastResult = res; }
    Audit.log('Documento de viaje', 'JOB-11', 'ejecutar_recordatorios', '', res);
    Store.save(); UI.toast('Job ejecutado: ' + res + '.', sent.length ? 'ok' : 'info'); App.render();
  }

  App.register('operaciones/documentos-viaje', (el, params) => {
    css(); seedAllotments(); seedDocs(); cfg();
    if (params[0] && /^RES-/.test(params[0])) return docDetail(el, params[0]);
    const views = scopedRes().map(resView);
    const upcoming = views.filter(v => v.r.travelTo >= T() && v.r.status !== 'completada');
    const paxAll = upcoming.flatMap(v => v.pax.map(x => ({ ...x, v })));
    const blocked = upcoming.filter(v => v.mapi.blocked && !v.mapi.emitted);
    const own = Scope.ownOnly();
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Documentos de viaje', crumbs: [['Operaciones', Access.canRoute('operaciones') ? '#/operaciones' : null], ['Documentos de viaje']],
      subtitle: 'Checklist por reserva y pasajero: identidad y vigencia, visa, seguro, vacunas, autorización de menores, registro migratorio, contacto de emergencia y atención especial. ' + (own ? '<b>' + Scope.label() + '</b>: solo sus reservas.' : ''),
      actions: canManageDocs() ? '<button class="btn" id="dv-job">' + ic('mail') + 'Ejecutar recordatorios</button>' : '<button class="btn" disabled title="Requiere permiso ' + P_DOC + '">' + ic('mail') + 'Ejecutar recordatorios</button>' }) +
      (own ? UI.alert('info', 'Con el rol Ventas puede <b>consultar</b> el checklist de sus reservas y <b>solicitar documentos</b> al cliente. La carga, validación y observación son de Operaciones (' + P_DOC + ').') : '') +
      (blocked.length ? UI.alert('bad', '<b>Emisión de entradas nominativas bloqueada</b> en ' + blocked.length + ' reserva(s): ' + blocked.map(v => '<a href="#/operaciones/documentos-viaje/' + v.r.id + '">' + esc(v.r.id) + '</a>').join(', ') + '. Regla DOC-BR-010: no se emiten entradas a Machu Picchu si falta el documento validado del pasajero.') : '') +
      '<div class="grid g5" style="margin-bottom:16px">' +
      UI.kpi({ label: 'Reservas próximas', value: upcoming.length, sub: upcoming.filter(v => v.st === 'completo').length + ' con checklist completo', icon: 'suitcase' }) +
      UI.kpi({ label: 'Pasajeros pendientes', value: paxAll.filter(x => x.st === 'pendiente').length, sub: 'de ' + paxAll.length + ' pasajeros', tone: 'warn', icon: 'users' }) +
      UI.kpi({ label: 'Por validar', value: sum(upcoming, 'toValidate'), sub: 'Archivos cargados sin revisar', tone: 'info', icon: 'fileCheck' }) +
      UI.kpi({ label: 'Observados / vencidos', value: sum(upcoming, 'obs') + ' / ' + sum(upcoming, 'venc'), sub: 'Requieren nuevo documento', tone: 'bad', icon: 'alert' }) +
      UI.kpi({ label: 'Bloqueos MAPI', value: blocked.length, sub: 'Entradas nominativas retenidas', tone: blocked.length ? 'bad' : 'ok', icon: 'lock' }) + '</div><div id="dv-tabs"></div></div>';
    const jb = el.querySelector('#dv-job'); if (jb) jb.onclick = runReminderJob;
    UI.tabs(el.querySelector('#dv-tabs'), [
      { id: 'res', label: 'Por reserva', count: views.length, render: (b) => docTableRes(b, views) },
      { id: 'pax', label: 'Por pasajero', count: views.reduce((a, v) => a + v.pax.length, 0), render: (b) => docTablePax(b, views) },
      { id: 'mapi', label: 'Bloqueo entradas MAPI', count: views.filter(v => v.mapi.applies).length, render: (b) => docMapi(b, views) },
      { id: 'cfg', label: 'Reglas y recordatorios', render: (b) => docRules(b) }
    ], 'res');
  });

  function docTableRes(b, views) {
    UI.dataTable(b, {
      exportName: 'documentos-viaje-reservas', searchPlaceholder: 'Buscar reserva, cliente o pasajero…', defaultSort: 'travelFrom',
      rows: () => views,
      search: (v) => [v.r.id, v.r.title, Q.clientName(v.r.clientId), v.r.passengers.map(p => p.name).join(' ')].join(' '),
      filters: [{ label: 'Estado', options: ['completo', 'pendiente', 'observado', 'vencido'].map(s => [s, DST[s][1]]), match: (v, x) => v.st === x }, { label: 'Periodo', options: [['prox', 'Próximos viajes'], ['past', 'Finalizados']], match: (v, x) => x === 'prox' ? v.r.travelTo >= T() && v.r.status !== 'completada' : !(v.r.travelTo >= T() && v.r.status !== 'completada') }, { label: 'MAPI', options: [['bloq', 'Bloqueada'], ['ok', 'Habilitada'], ['na', 'No aplica']], match: (v, x) => x === 'na' ? !v.mapi.applies : x === 'bloq' ? v.mapi.blocked : v.mapi.applies && !v.mapi.blocked }],
      onRow: (v) => location.hash = '#/operaciones/documentos-viaje/' + v.r.id,
      columns: [
        { key: 'id', label: 'Reserva', sortVal: v => v.r.id, csv: v => v.r.id, render: v => '<div class="cell-main mono">' + esc(v.r.id) + '</div><div class="cell-sub">' + esc(v.r.title) + '</div>' },
        { key: 'client', label: 'Cliente', sortVal: v => Q.clientName(v.r.clientId), csv: v => Q.clientName(v.r.clientId), render: v => '<span class="small">' + esc(Q.clientName(v.r.clientId)) + '</span>' },
        { key: 'travelFrom', label: 'Viaje', sortVal: v => v.r.travelFrom, csv: v => v.r.travelFrom, render: v => { const d = daysFromToday(v.r.travelFrom); return '<div class="small">' + dateShort(v.r.travelFrom) + ' – ' + dateShort(v.r.travelTo) + '</div><div class="cell-sub">' + (v.r.status === 'completada' || v.r.travelTo < T() ? 'Finalizado' : d > 0 ? 'En ' + d + ' día(s)' : 'En curso') + '</div>'; } },
        { key: 'pax', label: 'Pax', align: 'num', sortVal: v => v.pax.length, csv: v => v.pax.length, render: v => v.pax.length },
        { key: 'prog', label: 'Avance', sortVal: v => pct(v.done, v.total), csv: v => v.done + '/' + v.total, render: v => '<div style="min-width:100px"><div class="xs">' + v.done + ' / ' + v.total + ' ítems</div>' + UI.progress(pct(v.done, v.total), v.st === 'completo' ? '' : 'warn') + '</div>' },
        { key: 'issues', label: 'Pend. · Obs. · Venc.', sortVal: v => v.pend + v.obs * 10 + v.venc * 100, csv: v => v.pend + '/' + v.obs + '/' + v.venc, render: v => '<span class="small num">' + v.pend + ' · ' + v.obs + ' · <span style="color:' + (v.venc ? 'var(--bad)' : 'inherit') + '">' + v.venc + '</span></span>' },
        { key: 'mapi', label: 'Entradas MAPI', sortVal: v => v.mapi.applies ? (v.mapi.blocked ? 0 : 1) : 2, csv: v => !v.mapi.applies ? 'No aplica' : v.mapi.blocked ? 'Bloqueada' : 'Habilitada', render: v => !v.mapi.applies ? '<span class="faint small">No aplica</span>' : v.mapi.emitted ? UI.badge('utilizado', 'Ejecutada') : v.mapi.blocked ? UI.badge('bloqueada', 'Bloqueada') : UI.badge('aceptado', 'Habilitada') },
        { key: 'owner', label: 'Asesor', sortVal: v => Q.userName(v.r.owner), csv: v => Q.userName(v.r.owner), render: v => '<span class="small">' + esc(Q.userName(v.r.owner)) + '</span>' },
        { key: 'st', label: 'Estado', sortVal: v => ORDER.indexOf(v.st), csv: v => DST[v.st][1], render: v => dBadge(v.st) }
      ]
    });
  }
  function docTablePax(b, views) {
    const rows = views.flatMap(v => v.pax.map(x => ({ v, x })));
    UI.dataTable(b, {
      exportName: 'documentos-viaje-pasajeros', searchPlaceholder: 'Buscar pasajero o documento…',
      rows: () => rows, search: (o) => [o.x.p.name, o.x.p.doc, o.v.r.id, o.x.p.nationality].join(' '),
      filters: [{ label: 'Estado', options: ['completo', 'pendiente', 'observado', 'vencido'].map(s => [s, DST[s][1]]), match: (o, x) => o.x.st === x }, { label: 'Tipo', options: [['ext', 'Extranjeros'], ['nac', 'Peruanos'], ['men', 'Menores']], match: (o, x) => x === 'ext' ? isForeign(o.x.p) : x === 'nac' ? !isForeign(o.x.p) : isMinor(o.v.r, o.x.p) }],
      onRow: (o) => location.hash = '#/operaciones/documentos-viaje/' + o.v.r.id,
      columns: [
        { key: 'name', label: 'Pasajero', sortVal: o => o.x.p.name, csv: o => o.x.p.name, render: o => '<div class="cell-main">' + esc(o.x.p.name) + (isMinor(o.v.r, o.x.p) ? ' <span class="tag">Menor</span>' : '') + '</div><div class="cell-sub">' + esc(o.x.p.nationality) + ' · ' + esc(o.x.p.type) + '</div>' },
        { key: 'res', label: 'Reserva', sortVal: o => o.v.r.id, csv: o => o.v.r.id, render: o => '<span class="mono small">' + esc(o.v.r.id) + '</span><div class="cell-sub">' + dateShort(o.v.r.travelFrom) + '</div>' },
        { key: 'doc', label: 'Documento', sortVal: o => o.x.p.doc, csv: o => o.x.p.doc, render: o => { const it = o.x.px.items.id_doc || {}; return '<span class="mono small">' + esc(o.x.p.doc) + '</span><div class="cell-sub">Vence: ' + (it.expiry ? date(it.expiry) : '—') + '</div>'; } },
        { key: 'iddoc', label: 'Identidad', sortVal: o => o.x.items[0].st, csv: o => DST[o.x.items[0].st][1], render: o => dBadge(o.x.items[0].st) },
        { key: 'miss', label: 'Faltantes / observaciones', sortVal: o => o.x.items.filter(i => !['completo', 'no_aplica'].includes(i.st)).length, csv: o => o.x.items.filter(i => !['completo', 'no_aplica'].includes(i.st)).map(i => DLABEL[i.t]).join(', '), render: o => { const m = o.x.items.filter(i => !['completo', 'no_aplica'].includes(i.st)); return m.length ? '<span class="small">' + m.map(i => esc(DLABEL[i.t]) + ' <span class="faint">(' + DST[i.st][1].toLowerCase() + ')</span>').join(', ') + '</span>' : '<span class="faint small">—</span>'; } },
        { key: 'sp', label: 'Atención esp.', sortVal: o => (o.x.px.items.special || {}).flag ? 1 : 0, csv: o => (o.x.px.items.special || {}).flag ? 'Sí' : 'No', render: o => (o.x.px.items.special || {}).flag ? UI.badge('alta', 'Requiere') : '<span class="faint small">No</span>' },
        { key: 'st', label: 'Estado', sortVal: o => ORDER.indexOf(o.x.st), csv: o => DST[o.x.st][1], render: o => dBadge(o.x.st) }
      ]
    });
  }
  function docMapi(b, views) {
    const list = views.filter(v => v.mapi.applies).sort((a, c) => a.mapi.svcs[0].n.date.localeCompare(c.mapi.svcs[0].n.date));
    b.innerHTML = UI.alert('info', '<b>Regla DOC-BR-010 (bloqueo operativo).</b> Las entradas a Machu Picchu son nominativas: la emisión (Ministerio de Cultura) y el voucher del servicio solo proceden si <b>cada pasajero</b> tiene el documento de identidad <b>validado</b> y vigente y, si es menor de edad, la autorización de viaje completa. En producción la API de emisión de vouchers/entradas responde <span class="mono">422 DOC-BR-010</span> mientras exista un faltante; esta pantalla muestra la regla sin modificar el módulo de Operaciones.') +
      UI.card('Servicios con entradas nominativas', list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reserva</th><th>Servicio</th><th>Fecha de ingreso</th><th class="num">Pax</th><th>Emisión</th><th>Pasajeros con faltantes</th></tr></thead><tbody>' +
        list.flatMap(v => v.mapi.svcs.map(x => '<tr><td><a href="#/operaciones/documentos-viaje/' + v.r.id + '" class="mono">' + esc(v.r.id) + '</a><div class="cell-sub">' + esc(v.r.title) + '</div></td><td class="small">' + esc(x.s.name) + '</td><td>' + date(x.n.date) + '</td><td class="num">' + paxCount(v.r) + '</td><td>' + (x.n.date < T() ? UI.badge('utilizado', 'Ejecutada') : v.mapi.blocked ? UI.badge('bloqueada', 'Bloqueada') : UI.badge('aceptado', 'Habilitada')) + '</td><td class="small">' + (v.mapi.missing.length ? v.mapi.missing.map(m => '<b>' + esc(m.name) + '</b>: ' + esc(m.why)).join('<br>') : '<span class="faint">—</span>') + '</td></tr>')).join('') + '</tbody></table></div>' : UI.empty('No hay reservas con entradas nominativas.', 'ticket'), { tight: true });
  }
  function docRules(b) {
    const c = cfg(), can = canManageDocs(), j = DB.jobs.find(x => x.id === 'JOB-11') || {};
    const rules = [
      ['DOC-BR-001', 'Extranjero: pasaporte con vigencia mínima de ' + c.passportMonths + ' meses posterior a la fecha de fin del viaje; si no cumple, el ítem queda <b>Vencido</b>.'],
      ['DOC-BR-002', 'Peruano: DNI (o pasaporte) vigente a la fecha de fin del viaje.'],
      ['DOC-BR-003', 'Visa: solo si la nacionalidad figura en la lista configurada (' + esc(c.visaNationalities.join(', ')) + ').'],
      ['DOC-BR-004', 'Seguro de viaje: obligatorio para extranjeros' + (c.insuranceTrekking ? ' y para todo pasajero en programas de trekking/altura (categoría Aventura)' : '') + '.'],
      ['DOC-BR-005', 'Vacuna contra fiebre amarilla: obligatoria si la reserva incluye un programa en Amazonía (destino Loreto/Madre de Dios o requisito del producto).'],
      ['DOC-BR-006', 'Menor de edad (CHD/INF o < 18 años al inicio): autorización de viaje. Perú: permiso notarial cuando el menor no viaja con ambos padres; si viaja con ambos se acredita la filiación (partida o DNI con datos de padres).'],
      ['DOC-BR-007', 'Extranjero: registro migratorio (TAM virtual) antes del ingreso a destinos con control.'],
      ['DOC-BR-008', 'Contacto de emergencia obligatorio para todo pasajero (nombre y teléfono).'],
      ['DOC-BR-009', 'Atención especial: solo indicador "requiere atención especial" y nota operativa (dieta, movilidad, asiento). Prohibido registrar diagnósticos.'],
      ['DOC-BR-010', 'Bloqueo de entradas nominativas (MAPI) si falta identidad validada o autorización de menor.'],
      ['DOC-BR-011', 'Solo Operaciones valida u observa; la validación de un pasaporte/DNI se rechaza si no cumple DOC-BR-001/002.'],
      ['DOC-BR-012', 'Ventas solo consulta y solicita documentos de sus propias reservas (ownership).']
    ];
    b.innerHTML = '<div class="grid g-2-1">' + UI.card('Reglas de negocio aplicadas', '<div class="tbl-wrap"><table class="tbl"><tbody>' + rules.map(r => '<tr><td class="mono small" style="white-space:nowrap;vertical-align:top">' + r[0] + '</td><td class="small">' + r[1] + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      '<div class="col" style="gap:16px">' + UI.card('Recordatorio automático', UI.form([
        { id: 'rd', label: 'Días antes del viaje', value: c.reminderDays.join(', '), col: 12, hint: 'Separados por coma. También se envía diario si faltan menos días que el menor hito.', disabled: !can },
        { id: 'pm', label: 'Meses de vigencia de pasaporte', type: 'number', min: 0, value: c.passportMonths, col: 6, disabled: !can },
        { id: 'ch', label: 'Canales', type: 'select', options: [['Email,WhatsApp', 'Email + WhatsApp'], ['Email', 'Solo email'], ['WhatsApp', 'Solo WhatsApp']], value: c.channels.join(','), col: 6, disabled: !can },
        { id: 'vn', label: 'Nacionalidades con visa', value: c.visaNationalities.join(', '), col: 12, disabled: !can },
        { id: 'it', label: 'Seguro obligatorio en trekking/altura', type: 'switch', value: c.insuranceTrekking, col: 12, disabled: !can }
      ]) + (can ? '<div class="row" style="justify-content:flex-end;margin-top:12px;gap:8px"><button class="btn" id="cf-run">' + ic('mail') + 'Ejecutar ahora</button><button class="btn primary" id="cf-save">' + ic('check') + 'Guardar</button></div>' : '<p class="xs faint" style="margin-top:8px">Solo lectura. Requiere permiso ' + P_DOC + '.</p>')) +
      UI.card('Job programado', UI.dl([['Job', esc(j.name || '')], ['Frecuencia', esc(j.cron || '')], ['Última ejecución', datetime(j.last)], ['Resultado', esc(j.lastResult || '—')]])) + '</div></div>';
    if (!can) return;
    b.querySelector('#cf-run').onclick = runReminderJob;
    b.querySelector('#cf-save').onclick = () => {
      const f = UI.formData(b); const days = String(f.rd).split(',').map(x => parseInt(x, 10)).filter(x => x > 0 && x < 120);
      if (!days.length) { UI.toast('Indique al menos un hito de días válido.', 'bad'); return; }
      const before = JSON.stringify({ d: c.reminderDays, m: c.passportMonths });
      Object.assign(c, { reminderDays: [...new Set(days)].sort((a, x) => x - a), passportMonths: Math.max(0, +f.pm || 0), channels: f.ch.split(','), visaNationalities: f.vn.split(',').map(x => x.trim()).filter(Boolean), insuranceTrekking: !!f.it });
      Store.save(); Audit.log('Documento de viaje', 'configuracion', 'editar_reglas', before, JSON.stringify({ d: c.reminderDays, m: c.passportMonths }));
      UI.toast('Reglas y recordatorios guardados.'); App.render();
    };
  }

  /* ---------- Detalle por reserva ---------- */
  function docDetail(el, resId) {
    const r = Q.reservation(resId);
    if (!r) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Reserva no encontrada', crumbs: [['Documentos de viaje', '#/operaciones/documentos-viaje'], [resId]] }) + UI.card('', UI.empty('No existe la reserva ' + resId + '.', 'search')) + '</div>'; return; }
    if (!Scope.canSee(r, 'owner')) return Scope.denied(el, 'La reserva ' + r.id);
    const v = resView(r), manage = canManageDocs(), req = canRequest(r), c = clientContact(r), dtt = daysFromToday(r.travelFrom);
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Documentos — ' + esc(r.title), crumbs: [['Documentos de viaje', '#/operaciones/documentos-viaje'], [r.id]],
      subtitle: resLink(r.id) + ' · ' + esc(Q.clientName(r.clientId)) + ' · ' + date(r.travelFrom) + ' – ' + date(r.travelTo) + ' (' + (r.travelTo < T() || r.status === 'completada' ? 'finalizado' : dtt > 0 ? 'en ' + dtt + ' día(s)' : 'en curso') + ') · Asesor: ' + esc(Q.userName(r.owner)) + ' · ' + dBadge(v.st),
      actions: '<button class="btn primary" id="dd-req"' + (req ? '' : ' disabled title="Requiere permiso ' + P_DOC + ' o ser el asesor de la reserva"') + '>' + ic('send') + 'Solicitar documentos al cliente</button>' }) +
      (v.mapi.applies && !v.mapi.emitted ? (v.mapi.blocked ? UI.alert('bad', '<b>Emisión de entradas nominativas bloqueada (DOC-BR-010).</b> ' + v.mapi.svcs.map(x => esc(x.s.name) + ' — ingreso ' + date(x.n.date)).join('; ') + '. Falta: ' + v.mapi.missing.map(m => '<b>' + esc(m.name) + '</b> (' + esc(m.why) + ')').join(', ') + '.') : UI.alert('ok', '<b>Entradas nominativas habilitadas:</b> todos los pasajeros tienen identidad validada' + (v.pax.some(x => isMinor(r, x.p)) ? ' y autorización de menores' : '') + '.')) : '') +
      (!manage ? UI.alert('info', 'Vista de consulta para Ventas: puede solicitar documentos al cliente; la carga, validación y observación las realiza Operaciones.') : '') +
      '<div class="grid g4" style="margin-bottom:16px">' +
      UI.kpi({ label: 'Avance del checklist', value: fmtN(pct(v.done, v.total), 0) + ' %', sub: v.done + ' de ' + v.total + ' ítems aplicables', icon: 'fileCheck' }) +
      UI.kpi({ label: 'Pendientes / por validar', value: v.pend, sub: v.toValidate + ' archivo(s) por validar', tone: 'warn', icon: 'clock' }) +
      UI.kpi({ label: 'Observados', value: v.obs, tone: v.obs ? 'bad' : 'ok', icon: 'alert' }) +
      UI.kpi({ label: 'Vencidos', value: v.venc, sub: 'Vigencia insuficiente', tone: v.venc ? 'bad' : 'ok', icon: 'calendar' }) + '</div>' +
      '<div class="grid g-2-1"><div id="dd-pax"></div><div class="col" style="gap:16px">' +
      UI.card('Contacto para solicitudes', UI.dl([['Cliente', esc(c.name)], ['Correo', esc(c.email)], ['Teléfono', esc(c.phone || '—')], ['Canales', esc(cfg().channels.join(' + '))], ['Hitos automáticos', cfg().reminderDays.join(', ') + ' días antes']])) +
      UI.card('Solicitudes y recordatorios', v.rec.reminders.length ? '<div class="list">' + v.rec.reminders.map(x => '<div class="list-item"><div class="ico-box info">' + ic('mail') + '</div><div class="grow"><div class="small"><b>' + esc(x.kind) + '</b></div><div class="xs faint">' + datetime(x.ts) + ' · ' + esc(x.channel) + ' · ' + esc(x.to) + ' · ' + esc(x.by === 'Sistema' ? 'Job' : Q.userName(x.by)) + '</div></div></div>').join('') + '</div>' : UI.empty('Sin envíos registrados.', 'mail')) +
      UI.card('Bitácora', UI.timeline(v.rec.log.slice(0, 12).map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(l.user === 'Sistema' ? 'Sistema' : Q.userName(l.user)), icon: 'history' })))) +
      '</div></div></div>';
    el.querySelector('#dd-req').onclick = () => {
      if (!canRequest(r)) { UI.toast('Solo el asesor de la reserva u Operaciones pueden solicitar documentos (DOC-BR-012).', 'bad'); return; }
      const n = resView(r).pax.flatMap(x => x.items.filter(i => ['pendiente', 'observado', 'vencido'].includes(i.st))).length;
      if (!n) { UI.toast('El checklist no tiene documentos pendientes por solicitar.', 'info'); return; }
      UI.confirm({ title: 'Solicitar documentos', message: 'Se enviará al cliente (' + esc(c.email) + ') por ' + esc(cfg().channels.join(' y ')) + ' el detalle de <b>' + n + '</b> documento(s) pendientes, observados o vencidos, con enlace al portal para cargarlos.', confirmLabel: 'Enviar solicitud',
        onConfirm: () => { sendRequest(r, false); v.rec.log.unshift({ ts: nowStr(), user: Auth.user.id, m: 'Solicitud de documentos enviada al cliente (' + n + ' ítems)' }); Store.save(); Audit.log('Documento de viaje', r.id, 'solicitar_documentos', '', n + ' ítems'); UI.toast('Solicitud enviada al cliente.'); App.render(); } });
    };
    const box = el.querySelector('#dd-pax');
    box.innerHTML = v.pax.map((x, i) => '<div class="doc-pax"><div class="doc-pax-h"><div><b>' + esc(x.p.name) + '</b>' + (isMinor(r, x.p) ? ' <span class="tag">Menor · ' + ageAt(x.p.birth, r.travelFrom) + ' años</span>' : '') + '<div class="xs faint">' + esc(x.p.nationality) + ' · ' + esc(x.p.doc) + ' · ' + (isForeign(x.p) ? 'Extranjero' : 'Nacional') + '</div></div>' + dBadge(x.st) + '</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Documento</th><th>Estado</th><th>Detalle</th><th class="right">Acciones</th></tr></thead><tbody>' +
      x.items.filter(y => y.st !== 'no_aplica').map(({ t, it, st }) => '<tr><td><div class="cell-main small">' + esc(DLABEL[t]) + '</div><div class="cell-sub">' + esc(DTYPES.find(d => d[0] === t)[2]) + '</div></td><td>' + dBadge(st) + '</td><td class="small">' + itemDetail(r, x.p, t, it, st) + '</td><td class="right"><div class="doc-actions">' + itemActions(t, st, i, manage) + '</div></td></tr>').join('') + '</tbody></table></div>' + (x.items.some(y => y.st === 'no_aplica') ? '<div class="xs faint" style="padding:8px 14px;border-top:1px solid var(--line-2)">No aplica: ' + x.items.filter(y => y.st === 'no_aplica').map(y => esc(DLABEL[y.t]) + ' (' + itemDetail(r, x.p, y.t, y.it, 'no_aplica').replace(/<[^>]+>/g, '').toLowerCase() + ')').join(' · ') + '</div>' : '') + '</div>').join('');
    box.querySelectorAll('[data-act]').forEach(bt => bt.onclick = () => itemAction(r, +bt.dataset.i, bt.dataset.t, bt.dataset.act));
  }
  function itemDetail(r, p, t, it, st) {
    it = it || {};
    if (st === 'no_aplica') return '<span class="faint">' + (t === 'visa' ? 'Nacionalidad exenta' : t === 'minor_auth' ? 'Pasajero adulto' : t === 'migration' ? 'Pasajero nacional' : t === 'yellow_fever' ? 'Sin destino amazónico' : 'No requerido') + '</span>';
    if (t === 'emergency') return it.name ? esc(it.name) + ' · ' + esc(it.phone) + (it.relation ? ' <span class="faint">(' + esc(it.relation) + ')</span>' : '') : '<span class="faint">Sin registrar</span>';
    if (t === 'special') return it.flag == null ? '<span class="faint">Sin declarar</span>' : (it.flag ? '<b>Requiere atención especial</b>' : 'No requiere') + (it.note ? '<div class="inv-note">' + esc(it.note) + '</div>' : '');
    const out = [];
    if (it.number) out.push('N.º <span class="mono">' + esc(it.number) + '</span>');
    if (it.expiry) out.push('Vence ' + date(it.expiry));
    if (t === 'id_doc') out.push('<span class="inv-note">Mínimo exigido: ' + date(minExpiry(r, p)) + ' (' + (isForeign(p) ? 'DOC-BR-001' : 'DOC-BR-002') + ')</span>');
    if (it.file) out.push(ic('file') + ' ' + esc(it.file.name) + ' <span class="faint">(' + datetime(it.file.at) + ')</span>');
    if (it.validatedBy && st === 'completo') out.push('<span class="inv-note">Validado por ' + esc(Q.userName(it.validatedBy)) + ' · ' + datetime(it.validatedAt) + '</span>');
    if (it.obs && st === 'observado') out.push('<span style="color:var(--warn)">Observación: ' + esc(it.obs) + '</span>');
    if (it.note) out.push('<span class="inv-note">' + esc(it.note) + '</span>');
    return out.join('<br>') || '<span class="faint">Sin documento cargado</span>';
  }
  function itemActions(t, st, i, manage) {
    if (st === 'no_aplica') return '';
    const b = (act, label, extra) => '<button class="btn xs' + (extra || '') + '" data-act="' + act + '" data-t="' + t + '" data-i="' + i + '"' + (manage ? '' : ' disabled title="Requiere permiso ' + P_DOC + '"') + '>' + label + '</button>';
    if (t === 'emergency' || t === 'special') return b('edit', st === 'completo' ? 'Editar' : 'Registrar');
    const out = [b('upload', st === 'completo' ? 'Reemplazar' : 'Cargar')];
    if (['recibido', 'observado', 'pendiente'].includes(st)) out.push(b('validate', 'Validar', ' primary'));
    if (st !== 'observado') out.push(b('observe', 'Observar'));
    return out.join('');
  }
  function itemAction(r, i, t, act) {
    if (deny(P_DOC)) return;
    const rec = docRec(r), p = r.passengers[i], px = rec.pax[i]; const it = px.items[t] = px.items[t] || {};
    const who = p.name + ' — ' + DLABEL[t];
    const done = (msg, auditAct, before, after) => { rec.log.unshift({ ts: nowStr(), user: Auth.user.id, m: msg }); Store.save(); Audit.log('Documento de viaje', r.id, auditAct, before, p.name + ' · ' + DLABEL[t] + ': ' + after); UI.toast(msg); App.render(); };
    if (act === 'upload') {
      const needExp = ['id_doc', 'insurance', 'visa'].includes(t);
      UI.modal({ title: 'Cargar documento', sub: esc(who), body: UI.form([
        { type: 'html', col: 12, html: '<div class="field"><label for="up-file">Archivo (PDF/JPG/PNG, máx. 10 MB) <span class="req">*</span></label><input class="input" id="up-file" type="file" accept=".pdf,.jpg,.jpeg,.png"></div>' },
        { id: 'number', label: t === 'id_doc' ? 'Número de documento' : t === 'insurance' ? 'N.º de póliza' : t === 'minor_auth' ? 'N.º de permiso / partida' : 'Referencia', value: it.number || '', col: 6 },
        needExp ? { id: 'expiry', label: t === 'insurance' ? 'Cobertura hasta' : 'Fecha de vencimiento', type: 'date', required: t === 'id_doc', value: it.expiry || '', col: 6 } : { type: 'html', col: 6, html: '' },
        { id: 'note', label: 'Nota', value: '', col: 12, placeholder: 'Opcional' }
      ]) + '<p class="xs faint" style="margin-top:8px">Prototipo: se registra el nombre del archivo. En producción se sube a S3 (tenants/{tenant}/travel-docs/…) con URL firmada y antivirus.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Registrar carga', cls: 'primary', icon: 'upload', onClick: (m) => {
        const f = m.querySelector('#up-file').files[0];
        if (!f) { m.querySelector('#up-file').classList.add('err'); UI.toast('Seleccione el archivo a cargar.', 'bad'); return false; }
        if (f.size > 10 * 1024 * 1024) { UI.toast('El archivo supera 10 MB.', 'bad'); return false; }
        if (!UI.validate(m)) return false;
        const d = UI.formData(m); const before = it.status || 'pendiente';
        Object.assign(it, { status: 'recibido', number: d.number || it.number, expiry: d.expiry || it.expiry, file: { name: f.name, size: f.size, at: nowStr(), by: Auth.user.id }, obs: '', validatedBy: null, validatedAt: null, note: d.note || it.note });
        done('Documento cargado: ' + who + ' (' + f.name + ')', 'cargar', before, 'recibido · ' + f.name);
      } }] });
      return;
    }
    if (act === 'validate') {
      if (!it.file && t !== 'minor_auth') { UI.toast('No hay archivo cargado para validar. Cargue el documento primero.', 'bad'); return; }
      if (t === 'minor_auth' && !it.file) { UI.toast('DOC-BR-006: cargue la partida de nacimiento o el permiso notarial antes de validar.', 'bad'); return; }
      if (t === 'id_doc') {
        if (!it.expiry) { UI.toast('Registre la fecha de vencimiento antes de validar (DOC-BR-001/002).', 'bad'); return; }
        if (it.expiry < minExpiry(r, p)) { UI.toast((isForeign(p) ? 'DOC-BR-001: el pasaporte debe vencer después del ' : 'DOC-BR-002: el DNI debe estar vigente al ') + date(minExpiry(r, p)) + '. Solicite un documento renovado.', 'bad'); return; }
      }
      const before = it.status; Object.assign(it, { status: 'completo', validatedBy: Auth.user.id, validatedAt: nowStr(), obs: '' });
      const nv = resView(r);
      done('Validado: ' + who + (nv.mapi.applies && !nv.mapi.blocked && !nv.mapi.emitted ? '. Entradas nominativas habilitadas.' : ''), 'validar', before, 'completo');
      return;
    }
    if (act === 'observe') {
      UI.confirm({ title: 'Observar documento', message: '<b>' + esc(who) + '</b>. Se notificará al cliente para que cargue un documento corregido.', reason: true, reasonLabel: 'Observación', confirmLabel: 'Observar', danger: true,
        onConfirm: (why) => { const before = it.status || 'pendiente'; Object.assign(it, { status: 'observado', obs: why, validatedBy: null, validatedAt: null }); const c = clientContact(r); Notify.push('documentos.observado', 'Email', c.email, 'Documento observado: ' + DLABEL[t] + ' de ' + p.name + ' (' + r.id + ')'); done('Observado: ' + who + ' — ' + why, 'observar', before, 'observado · ' + why); } });
      return;
    }
    if (act === 'edit' && t === 'emergency') {
      UI.modal({ title: 'Contacto de emergencia', sub: esc(p.name), body: UI.form([{ id: 'name', label: 'Nombre', required: true, value: it.name || '', col: 12 }, { id: 'phone', label: 'Teléfono', required: true, value: it.phone || '', col: 6 }, { id: 'relation', label: 'Relación', type: 'select', options: ['Familiar', 'Pareja', 'Amigo(a)', 'Empresa', 'Otro'], value: it.relation || 'Familiar', col: 6 }]),
        actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const d = UI.formData(m); const before = it.name ? 'registrado' : 'pendiente'; Object.assign(it, d); done('Contacto de emergencia registrado: ' + p.name, 'registrar_contacto', before, d.name); } }] });
      return;
    }
    if (act === 'edit' && t === 'special') {
      UI.modal({ title: 'Atención especial en operación', sub: esc(p.name), body: UI.alert('info', 'DOC-BR-009: registre solo la <b>indicación operativa</b> (dieta, movilidad, asiento, ritmo). No registre diagnósticos ni información clínica.') +
        UI.form([{ id: 'flag', label: '¿Requiere atención especial?', type: 'select', options: [['0', 'No'], ['1', 'Sí, requiere atención especial']], value: it.flag ? '1' : '0', col: 12 }, { id: 'note', label: 'Nota operativa', type: 'textarea', value: it.note || '', col: 12, placeholder: 'Ej. dieta vegetariana; asiento delantero en bus' }]),
        actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
          const d = UI.formData(m);
          if (/diagn|enfermedad|patolog|diabet|epileps|cáncer|cancer|vih|depresi|ansiedad|trastorno/i.test(d.note)) { UI.toast('DOC-BR-009: la nota contiene términos clínicos. Describa solo la necesidad operativa.', 'bad'); return false; }
          const before = it.flag == null ? 'sin declarar' : it.flag ? 'sí' : 'no'; it.flag = d.flag === '1'; it.note = d.note;
          done('Atención especial declarada: ' + p.name + (it.flag ? ' (requiere)' : ''), 'declarar_atencion', before, it.flag ? 'sí' : 'no');
        } }] });
    }
  }
})();
