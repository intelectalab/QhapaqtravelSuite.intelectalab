/* Operaciones (PROC-031 a PROC-039) + Apps móviles operador / pasajero (PROC-056 a PROC-058) */
(function () {
  const { esc, money, fmtN, date, dateShort, datetime, sum, daysFromToday, addDays, nowStr, parseD, uid, pad, daysBetween } = Util;
  const ic = UI.icon;
  const T = () => window.TODAY;

  /* ======================================================================
     Estilos propios del módulo (solo variables de tema)
     ====================================================================== */
  function css() {
    if (document.getElementById('css-operaciones')) return;
    const s = document.createElement('style'); s.id = 'css-operaciones';
    s.textContent = `
@media (max-width:640px){.op-pg .ph>.grow{flex-basis:100%}}
.op-quote{border-left:3px solid var(--sun);background:var(--sun-soft);padding:8px 11px;border-radius:0 8px 8px 0;font-size:.86rem;overflow-wrap:anywhere}
.op-mob{display:grid;grid-template-columns:auto minmax(0,1fr);gap:28px;align-items:start}
.op-mob>.phone{position:sticky;top:78px}
@media (max-width:980px){.op-mob{grid-template-columns:minmax(0,1fr)}.op-mob>.phone{position:static}}
.m-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--line);min-height:48px}
.m-bar h3{font-size:.92rem;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-back{border:0;background:none;padding:4px;cursor:pointer;color:var(--fg);display:grid;place-items:center}
.m-net{font-size:.64rem;font-weight:650;padding:3px 8px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);cursor:pointer;display:inline-flex;gap:5px;align-items:center;white-space:nowrap;color:var(--fg-2)}
.m-net i{width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block}
.m-net.off{background:var(--warn-soft);color:var(--warn);border-color:transparent}.m-net.off i{background:var(--warn)}
.m-net.sync i{background:var(--info)}
.m-pad{padding:12px 13px 18px;display:grid;gap:10px}
.m-h{font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3);font-weight:650;margin-top:6px}
.m-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 12px;display:grid;gap:3px;min-width:0}
.m-card.click{cursor:pointer}.m-card.click:hover{border-color:var(--accent)}
.m-card .t{font-weight:600;font-size:.86rem;line-height:1.3}
.m-card .s{font-size:.72rem;color:var(--fg-3)}
.m-time{font-family:var(--f-display);font-weight:650;font-size:1.05rem;font-variant-numeric:tabular-nums}
.m-hero{background:var(--side);color:var(--side-fg);border-radius:14px;padding:14px;display:grid;gap:6px}
.m-hero b,.m-hero h3{color:var(--side-fg)}
.m-hero .xs{color:var(--side-fg-2)}
.m-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;border-radius:11px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:.86rem;cursor:pointer;color:var(--fg);padding:0 12px}
.m-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.m-btn.ok{background:var(--ok);border-color:var(--ok);color:var(--surface)}
.m-btn.warn{background:var(--warn-soft);color:var(--warn);border-color:transparent}
.m-btn.bad{background:var(--bad-soft);color:var(--bad);border-color:transparent}
.m-btn[disabled]{opacity:.45;cursor:not-allowed}
.m-btn svg{width:18px;height:18px}
.m-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m-row{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2);min-width:0}
.m-row:last-child{border-bottom:0}
.m-chk{width:32px;height:32px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;background:var(--surface);cursor:pointer;color:var(--fg-3);flex:none;padding:0}
.m-chk svg{width:16px;height:16px}
.m-chk.on{background:var(--ok);border-color:var(--ok);color:var(--surface)}
.m-chk[disabled]{cursor:not-allowed;opacity:.5}
.m-steps{display:flex;gap:3px}.m-steps span{flex:1;height:5px;border-radius:3px;background:var(--line)}.m-steps span.on{background:var(--accent)}.m-steps span.cur{background:var(--sun)}
.m-ev{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.m-ev div{aspect-ratio:1;border-radius:8px;background:var(--surface-3);display:grid;place-items:center;color:var(--fg-3);font-size:.58rem;text-align:center;padding:4px;overflow:hidden}
.m-ev svg{width:20px;height:20px}
.m-q{display:flex;gap:8px;align-items:center;font-size:.74rem;padding:7px 0;border-bottom:1px dashed var(--line-2)}
.m-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}
.m-week div{border-radius:9px;padding:5px 0;font-size:.66rem;color:var(--fg-3);background:var(--surface);border:1px solid var(--line-2)}
.m-week div b{display:block;font-size:.86rem;color:var(--fg)}
.m-week div.today{border-color:var(--accent)}
.m-week i{display:block;width:5px;height:5px;border-radius:50%;background:var(--accent);margin:3px auto 0}
.m-week i.no{background:transparent}
.m-tabbar6 button{font-size:.56rem}
.chat{display:flex;flex-direction:column;gap:8px}
.msg{max-width:84%;padding:8px 11px;border-radius:12px;font-size:.79rem;background:var(--surface);border:1px solid var(--line);line-height:1.4}
.msg .xs{display:block;margin-top:3px;color:var(--fg-3)}
.msg.me{align-self:flex-end;background:var(--accent-soft);border-color:transparent}
.m-chips{display:flex;gap:6px;flex-wrap:wrap}.m-chips button{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:4px 10px;font-size:.7rem;cursor:pointer;color:var(--fg-2)}
.qrbox{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px;display:inline-grid;place-items:center}
.mob-panel ol{margin:0;padding-left:20px;display:grid;gap:4px;font-size:.82rem;color:var(--fg-2)}
.mob-panel ol li.cur{color:var(--fg);font-weight:650}
.mob-panel ol li.done{color:var(--fg-3)}
.st-pill{display:inline-flex;align-items:center;gap:6px;font-size:.74rem;padding:3px 9px;border-radius:14px;background:var(--surface-3);color:var(--fg-2)}
.st-pill b{color:var(--fg)}
.av-tbl td{vertical-align:top;min-width:112px}
.av-tbl td:first-child{min-width:190px}
.av-chip{display:block;font-size:.66rem;padding:2px 5px;border-radius:4px;background:var(--accent-soft);color:var(--accent);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;font-weight:550}
.av-chip.dep{background:var(--ok-soft);color:var(--ok)}
.av-chip.done{background:var(--mute-soft);color:var(--fg-3)}
.av-chip.off{background:var(--surface-3);color:var(--fg-3)}
.av-chip.bad{background:var(--bad-soft);color:var(--bad)}
.av-free{font-size:.66rem;color:var(--fg-3)}
.cal-ev.ok{background:var(--ok-soft);color:var(--ok)}
.cal-ev.mute{background:var(--mute-soft);color:var(--fg-2)}
.cal-ev.pend{outline:1px dashed currentColor;outline-offset:-1px}
.cal-more{font-size:.68rem;color:var(--fg-3);cursor:pointer;padding:0 4px}
.cal-more:hover{color:var(--accent)}
.cal-d .dn{font-weight:600;font-size:.72rem}
.wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
@media (max-width:900px){.wk{grid-template-columns:minmax(0,1fr)}}
.wk-d{border:1px solid var(--line);border-radius:10px;background:var(--surface);min-height:170px;display:flex;flex-direction:column;min-width:0}
.wk-d .wk-h{padding:7px 9px;border-bottom:1px solid var(--line-2);font-size:.74rem;font-weight:600;display:flex;justify-content:space-between}
.wk-d.today .wk-h{color:var(--accent)}
.wk-d .wk-b{padding:6px;display:grid;gap:5px;align-content:start}
.wk-d .cal-ev{white-space:normal;font-size:.7rem;line-height:1.3;padding:4px 6px}
.ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.ev-card{border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--surface);min-width:0}
.ev-img{aspect-ratio:4/3;background:var(--surface-3);display:grid;place-items:center;color:var(--fg-3)}
.ev-img svg{width:30px;height:30px}
.ev-card .ev-b{padding:8px 10px;display:grid;gap:2px}
.chk-row{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line-2)}
.chk-row:last-child{border-bottom:0}
.chk-ic{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:none}
.chk-ic svg{width:15px;height:15px}
.chk-ic.ok{background:var(--ok-soft);color:var(--ok)}.chk-ic.bad{background:var(--bad-soft);color:var(--bad)}.chk-ic.warn{background:var(--warn-soft);color:var(--warn)}
.task-row{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-2)}
.task-row:last-child{border-bottom:0}
.task-row.done .task-t{text-decoration:line-through;color:var(--fg-3)}
.room-pax{display:flex;flex-wrap:wrap;gap:4px}
.val-list{margin:4px 0 0;padding-left:18px;display:grid;gap:3px}
.sla-box{display:grid;gap:6px}
.pax-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 12px;max-height:260px;overflow:auto;padding:4px 0}
.op-mini{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
@media (max-width:1100px){.op-mini{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.op-mini{grid-template-columns:repeat(2,minmax(0,1fr))}}
.op-mini>div{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:10px 12px}
.op-mini .l{font-size:.7rem;color:var(--fg-3)}
.op-mini .v{font-family:var(--f-display);font-weight:600;font-size:1.15rem;font-variant-numeric:tabular-nums}
.op-app{display:flex;justify-content:center;padding:4px 0 8px}
.op-app .phone-screen{height:min(760px,calc(100vh - 170px));min-height:560px}
@media (max-width:520px){
  .op-app{margin:-14px -12px -28px;padding:0}
  .op-app .phone{width:100%;border-radius:0;padding:0;background:none;box-shadow:none}
  .op-app .phone-screen{border-radius:0;height:calc(100vh - 62px);height:calc(100dvh - 62px);min-height:480px}
  .op-app .phone-tabbar{padding-bottom:env(safe-area-inset-bottom)}
  .op-app .phone-tabbar button{font-size:.7rem;padding:9px 0 11px}
  .op-app .phone-notch{display:none}
}
`;
    document.head.appendChild(s);
  }

  /* ======================================================================
     Utilidades y búsquedas
     ====================================================================== */
  const OP_KEYS = ['planificada', 'pendiente_asignacion', 'asignada', 'confirmada', 'en_ejecucion', 'completada'];
  const OP_STEPS = ['Planificada', 'Pend. asignación', 'Asignada', 'Confirmada', 'En ejecución', 'Completada'];
  const opIdx = (s) => { const i = OP_KEYS.indexOf(s); return i === 5 ? 6 : Math.max(0, i); };
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dowOf = (s) => DOW[parseD(s).getDay()];
  const mins = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const nowTime = () => nowStr().split(' ')[1];

  const resOf = (op) => Q.reservation(op.resId) || { id: op.resId, passengers: [], services: [], clientId: null, notes: '' };
  const svcOf = (res, sid) => (res.services || []).find(s => s.id === sid);
  const opOfRes = (resId) => DB.operations.find(o => o.resId === resId);
  const gName = (id) => id ? ((Q.guide(id) || {}).name || id) : '';
  const dName = (id) => id ? ((Q.driver(id) || {}).name || id) : '';
  const vLabel = (id) => { const v = Q.vehicle(id); return v ? v.plate + ' · ' + v.type : ''; };
  /* Enlace solo si el rol puede abrir la ruta destino; si no, texto plano (evita llevar al usuario a un 403) */
  const lnk = (path, html, cls) => Access.canRoute(path) ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="#/' + esc(path) + '">' + html + '</a>' : '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</span>';
  const resLink = (id) => id ? lnk('reservas/' + id, esc(id), 'mono') : '—';
  const opLink = (id) => lnk('operaciones/ordenes/' + id, esc(id), 'mono');
  const incLink = (id) => lnk('operaciones/incidencias/' + id, esc(id), 'mono');
  const vouLink = (id) => lnk('operaciones/vouchers/' + id, esc(id), 'mono');
  const provLink = (id) => id ? lnk('catalogo/proveedores/' + id, esc(Q.providerName(id))) : '<span class="faint">Sin proveedor</span>';
  const prodLink = (id) => id ? lnk('catalogo/productos/' + id, esc(Q.productName(id))) : '—';
  const cliLink = (id) => id ? lnk('crm/clientes/' + id, esc(Q.clientName(id))) : '—';
  /* Datos económicos: Operaciones ve costos de proveedor, pero no precios de venta ni márgenes */
  const canMargin = () => Auth.canAny(['finance.profitability', 'catalog.products.view_profitability', 'quotes.approve_internal']);
  const dis = (p) => Auth.can(p) ? '' : ' disabled title="Requiere permiso ' + p + '"';
  const guard = (p) => { if (Auth.can(p)) return true; UI.toast('Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <b>' + p + '</b>. El backend valida cada acción (Regla transversal 17).', 'bad'); return false; };
  const rerender = () => { const y = window.scrollY; App.render(); window.scrollTo(0, y); };
  const isOpenInc = (i) => !['cerrada', 'resuelta'].includes(i.status);
  const allAssign = () => DB.operations.flatMap(op => (op.assignments || []).map(a => ({ op, a })));
  const manager = () => DB.users.find(u => u.role === 'manager') || DB.users[0];
  const opUsers = () => DB.users.filter(u => ['operations', 'manager', 'tenant_admin'].includes(u.role) && u.status === 'activo');
  const svcClass = (s) => !s.providerId ? 'libre' : /hotel|hab\./i.test(s.name) ? 'aloj' : /traslado/i.test(s.name) ? 'traslado' : /tren|entrada/i.test(s.name) ? 'tren' : 'tour';
  const CLS_COLOR = { tour: '', traslado: 'info', aloj: 'violet', tren: 'sun', salida: 'ok', libre: 'mute' };
  const CLS_LABEL = { tour: 'Tour / excursión', traslado: 'Traslado', aloj: 'Alojamiento', tren: 'Tren / entradas', salida: 'Salida programada', libre: 'Día libre' };
  const CLS_ICON = { tour: 'mountain', traslado: 'truck', aloj: 'bed', tren: 'train', salida: 'users', libre: 'sun' };
  /* ---- v2.1: datos capturados por el motor de reservas (r.booking) ---- */
  const BEo = () => window.BookingEngine;
  const bkProdOf = (res) => { if (res.booking && res.booking.productId) return Q.product(res.booking.productId); const s = (res.services || []).find(x => x.productId); return s ? Q.product(s.productId) : null; };
  const ruleOnRes = (id, res) => !BEo() || BEo().on(id, bkProdOf(res));
  const pickupOf = (res) => { const pk = res && res.booking && res.booking.pickup; return pk && (pk.point || pk.flight) ? pk : null; };
  /* El recojo aplica al servicio marcado (pickup) o, si ninguno lo está, al primer servicio del primer día */
  const pickupApplies = (res, s) => { if (!pickupOf(res) || !s) return false; if ((res.services || []).some(x => x.pickup)) return !!s.pickup; const first = (res.services || []).filter(x => x.status !== 'cancelado').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]; return !!first && first.id === s.id; };
  const arrTime = (pk) => pk && pk.arrival ? String(pk.arrival).split(' ').pop() : '';
  const pickupText = (res) => { const pk = pickupOf(res); if (!pk) return ''; return [pk.point, pk.address].filter(Boolean).join(' — ') + (pk.flight ? ' · vuelo ' + pk.flight + (pk.arrival ? ' (llega ' + datetime(pk.arrival) + ')' : '') : ''); };
  const clientComments = (res) => (res.booking && res.booking.comments) || '';
  function opTags(res) {
    const t = clientComments(res) + ' ' + (res.passengers || []).map(p => p.diet || '').join(' ') + ' ' + (res.notes || '');
    if (window.PaxExp) return window.PaxExp.specialTags(t);
    const out = []; if (/alerg|gluten|vegetar|vegan|dieta|frutos secos/i.test(t)) out.push(['bad', 'Dieta / alergia']); if (/aniversario|cumplea|luna de miel|celebra/i.test(t)) out.push(['violet', 'Celebración']); return out;
  }
  const ruleOff = (id, res) => ruleOnRes(id, res) ? '' : ' <span class="tag" title="Regla desactivada hoy; dato capturado al reservar">' + id + ' inactiva</span>';
  const tagsHtml = (res) => opTags(res).map(x => '<span class="badge b-' + x[0] + '">' + esc(x[1]) + '</span>').join(' ');
  const ageOf = (p, res) => { if (p.age != null && p.age !== '') return +p.age; if (!p.birth) return null; const b = parseD(p.birth), d = parseD(res.travelFrom || T()); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
  const rlKey = (rl) => rl.leg ? rl.resId + '~' + rl.leg : rl.resId;
  const rlHotelName = (rl) => rl.hotel ? Q.providerName(rl.hotel) : (rl.hotelName || 'Hotel');
  const rlHotelLink = (rl) => rl.hotel ? provLink(rl.hotel) : '<span>' + esc(rl.hotelName || 'Hotel') + '</span> <span class="xs faint">(sin proveedor en catálogo)</span>';
  const hotelOf = (res) => { const s = (res.services || []).find(x => x.providerId && (Q.provider(x.providerId) || {}).type === 'Hotel' && x.status !== 'cancelado'); return s ? Q.provider(s.providerId) : null; };
  const needLang = (res) => { const set = new Set(); (res.passengers || []).forEach(p => { if (/Alem/i.test(p.nationality)) set.add('DE'); if (/Franc/i.test(p.nationality)) set.add('FR'); if (/Brasil/i.test(p.nationality)) set.add('PT'); }); if (/alemán/i.test(res.notes || '')) set.add('DE'); return [...set]; };
  const coordPhone = (op) => (Q.user(op && op.coordinator) || {}).phone || '984 410 663';
  const EMERGENCY = '+51 984 410 663';

  function evList(op) {
    if (!op.evidence) {
      const seed = { 'OP-2026-0412': [{ name: 'checkin_valle_28-09.jpg', serviceId: 'RS-3474', ts: '2026-09-28 07:27', user: 'Hilda Ccahuana Puma', source: 'App operador' }, { name: 'lista_firmada_valle.jpg', serviceId: 'RS-3474', ts: '2026-09-28 17:40', user: 'Hilda Ccahuana Puma', source: 'App operador' }], 'OP-2026-0411': [{ name: 'cierre_mapi_26-09.jpg', serviceId: 'RS-3463', ts: '2026-09-26 15:10', user: 'Wilber Condori Sutta', source: 'App operador' }], 'OP-2026-0413': [{ name: 'rooming_firmado_tamboreal.pdf', serviceId: 'RS-3482', ts: '2026-09-28 11:35', user: 'Jorge Mamani Apaza', source: 'Web' }] };
      op.evidence = seed[op.id] || [];
    }
    return op.evidence;
  }
  function vHist(v) {
    if (!v.history) { v.history = [{ v: 1, ts: v.issuedAt, user: v.issuedBy, reason: 'Emisión inicial' }]; if (v.version >= 2) v.history.push({ v: 2, ts: v.issuedAt, user: v.issuedBy, reason: 'Cambio de guía asignado' }); }
    return v.history;
  }
  function roomingList(key) { return DB.rooming.find(r => rlKey(r) === key) || DB.rooming.find(r => r.resId === key); }
  const roomingsOf = (resId) => DB.rooming.filter(r => r.resId === resId);
  /* v2.1: legs de alojamiento de la reserva web aún sin rooming list */
  function lodgingLegs(res) {
    const b = res && res.booking; if (!b || !(b.lodging || []).length) return [];
    const p = bkProdOf(res); const legs = (p && p.accommodation && p.accommodation.legs) || [];
    const groups = []; b.lodging.forEach(l => { const k = l.legId || l.city; let g = groups.find(x => x.leg === k); if (!g) { g = { leg: k, city: l.city, hotel: l.hotel, nights: l.nights || 0, items: [] }; groups.push(g); } g.items.push(l); });
    let off = 0; const start = b.date || res.travelFrom;
    legs.forEach(lg => { const g = groups.find(x => x.leg === lg.id); if (g) { g.checkIn = addDays(start, off); g.checkOut = addDays(g.checkIn, g.nights || lg.nights); } off += lg.nights; });
    groups.filter(g => !g.checkIn).forEach(g => { g.checkIn = addDays(start, off); g.checkOut = addDays(g.checkIn, g.nights || 1); off += g.nights || 1; });
    groups.forEach(g => { const lg = legs.find(x => x.id === g.leg); const h = lg && lg.hotels.find(x => x.name === g.hotel); g.providerId = (h && h.providerId) || null; g.exists = DB.rooming.some(x => x.resId === res.id && (x.leg === g.leg || (!x.leg && g.providerId && x.hotel === g.providerId))); });
    return groups;
  }
  /* Prellena rooming lists desde booking.lodging: habitaciones por ciudad/hotel; adultos repartidos, infantes con un adulto */
  function prefillRooming(res) {
    if (!guard('reservations.modify')) return;
    const legs = lodgingLegs(res).filter(g => !g.exists);
    if (!legs.length) { UI.toast('Las rooming lists de ' + esc(res.id) + ' ya existen.', 'info'); return; }
    const adults = res.passengers.filter(p => p.type === 'ADT'), kids = res.passengers.filter(p => p.type === 'CHD'), infs = res.passengers.filter(p => p.type === 'INF');
    legs.forEach(g => {
      const rooms = []; let n = 0; const pre = String(g.city || 'HAB').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
      g.items.forEach(l => { for (let i = 0; i < (+l.rooms || 0); i++) rooms.push({ room: pre + '-' + (++n), type: ROOM_TYPES[l.roomType] ? l.roomType : 'Doble', pax: [], status: 'pendiente' }); });
      const cap = (r) => ROOM_TYPES[r.type] || 2; const place = (p) => { const r = rooms.filter(x => x.pax.length < cap(x)).sort((a, b) => a.pax.length - b.pax.length)[0]; if (r) r.pax.push(p.name); };
      adults.forEach(place); kids.forEach(place);
      infs.forEach(p => { const r = rooms.filter(x => x.pax.some(n2 => adults.some(a => a.name === n2))).sort((a, b) => a.pax.length - b.pax.length)[0] || rooms[0]; if (r) r.pax.push(p.name); });
      DB.rooming.push({ resId: res.id, leg: g.leg, city: g.city, hotel: g.providerId, hotelName: g.hotel, checkIn: g.checkIn, checkOut: g.checkOut, rooms, status: 'borrador', source: 'booking.lodging' });
      Audit.log('Rooming', res.id + '~' + g.leg, 'prellenar_reserva_web', '', g.city + ' · ' + g.hotel + ' · ' + rooms.length + ' hab.');
    });
    Store.save(); UI.toast(legs.length + ' rooming list(s) prellenadas desde la reserva web (' + legs.map(g => g.city).join(', ') + '). Asigne números de habitación y confirme.');
    App.go('#/operaciones/rooming/' + res.id + '~' + legs[0].leg);
  }
  function rlStatus(rl) { if (!rl.status) rl.status = rl.resId === 'RES-2026-000348' ? 'enviado' : 'confirmada'; return rl.status; }

  const nextInc = () => 'INC-' + String(Math.max(0, ...DB.incidents.map(i => +String(i.id).replace(/\D/g, '') || 0)) + 1).padStart(4, '0');

  function svcOnDate(d) {
    return DB.reservations.filter(r => !['cancelada', 'borrador'].includes(r.status)).flatMap(r => r.services.filter(s => s.date === d && s.status !== 'cancelado' && s.providerId).map(s => ({ s, r })));
  }

  function recomputeOp(op) {
    if (['en_ejecucion', 'completada', 'cancelada'].includes(op.status)) return;
    const as = op.assignments || []; if (!as.length) return;
    if (as.some(a => a.status === 'pendiente')) op.status = 'pendiente_asignacion';
    else if (as.every(a => ['confirmada', 'completada', 'en_curso'].includes(a.status))) op.status = 'confirmada';
    else op.status = 'asignada';
  }

  /* ---------------- Incidencias: creación y notificación ---------------- */
  function notifyIncident(inc) {
    const op = Q.operation(inc.opId); const co = Q.user(op ? op.coordinator : inc.assignee);
    Notify.push('incidencia.creada', 'Email', co ? co.email : 'operaciones@andeshorizonte.pe', inc.id + ' ' + inc.title);
    if (inc.severity === 'critica') {
      const m = manager();
      Notify.push('incidencia.critica', 'Push', m.name, 'ALERTA CRÍTICA ' + inc.id + ' — ' + inc.title);
      Notify.push('incidencia.critica', 'WhatsApp', m.phone, 'ALERTA CRÍTICA ' + inc.id + ' — ' + inc.title);
      inc.log.push({ ts: nowStr(), u: 'Sistema', m: 'Alerta crítica enviada a gerencia (' + m.name + ') por push y WhatsApp.' });
    }
  }
  function createIncident(d, notify = true) {
    const op = Q.operation(d.opId);
    const inc = { id: nextInc(), opId: d.opId || null, resId: d.resId || (op ? op.resId : null), severity: d.severity, type: d.type, title: d.title, desc: d.desc || '', status: 'abierta', assignee: d.assignee || (op ? op.coordinator : Auth.user.id), reportedBy: d.reportedBy || Auth.user.id, createdAt: nowStr(), evidence: d.evidence || [], serviceId: d.serviceId || null, log: [{ ts: nowStr(), u: d.reportedBy || Auth.user.id, m: 'Incidencia registrada' + (d.via ? ' desde ' + d.via : '') + '. Clasificada como ' + UI.statusLabel(d.severity).toLowerCase() + ' (' + d.type + ').' }] };
    DB.incidents.unshift(inc);
    Audit.log('Incidencia', inc.id, 'crear', '', 'abierta / ' + d.severity);
    if (notify) notifyIncident(inc);
    Store.save();
    return inc;
  }

  /* ======================================================================
     Validación de asignaciones (PROC-033)
     ====================================================================== */
  function occupations(ex) {
    const out = [];
    DB.operations.forEach(op => {
      if (op.status === 'cancelada') return;
      (op.assignments || []).forEach(a => {
        if (ex && op.id === ex.opId && a.serviceId === ex.serviceId) return;
        const base = { date: a.date, time: a.time, label: a.service, ref: op.id, opId: op.id, serviceId: a.serviceId, done: a.status === 'completada' };
        [a.guideId, a.driverId, a.vehicleId].forEach(rid => { if (rid) out.push({ ...base, rid }); });
      });
    });
    DB.products.forEach(p => (p.departures || []).forEach(d => {
      if (ex && ex.productId === p.id && ex.date === d.date && ex.time === d.time) return;
      const base = { date: d.date, time: d.time, label: 'Salida ' + p.name, ref: d.id, dep: true, productId: p.id };
      [d.guideId, d.vehicleId].forEach(rid => { if (rid) out.push({ ...base, rid }); });
    }));
    return out;
  }
  function validateAssign(op, a, sel) {
    const res = resOf(op); const s = svcOf(res, a.serviceId) || {};
    const blocks = [], warns = [];
    const pax = res.passengers.length; const dt = a.date;
    if (!sel.guideId && !sel.driverId && !sel.vehicleId) blocks.push('Seleccione al menos un recurso. Regla transversal 12: asignación con responsable y servicio válido.');
    if (s.status === 'cancelado') blocks.push('El servicio está cancelado.');
    const occ = occupations({ opId: op.id, serviceId: a.serviceId, productId: s.productId, date: a.date, time: a.time });
    const chk = (rid, label) => {
      if (!rid) return;
      occ.filter(o => o.rid === rid && o.date === dt && !o.done).forEach(o => {
        const m1 = mins(a.time), m2 = mins(o.time);
        const near = m1 != null && m2 != null && Math.abs(m1 - m2) < 360;
        const txt = label + ' ya tiene «' + esc(o.label) + '» (' + esc(o.ref) + ') el ' + dateShort(dt) + ' a las ' + esc(o.time);
        if (near && o.opId !== op.id) blocks.push(txt + ': horario superpuesto (menos de 6 h).');
        else if (near) warns.push(txt + ' en esta misma orden: verifique el encadenamiento de servicios.');
        else warns.push(txt + ': verifique tiempos de retorno y traslado.');
      });
    };
    if (sel.guideId) {
      const g = Q.guide(sel.guideId); const nm = 'El guía ' + esc(g.name);
      if (g.status === 'vacaciones') blocks.push(nm + ' está de vacaciones.');
      if (g.status === 'descanso') warns.push(nm + ' está en descanso programado.');
      const need = needLang(res).filter(l => !g.languages.includes(l));
      if (need.length) warns.push('Los pasajeros requieren idioma ' + need.join(', ') + '; ' + esc(g.name) + ' habla ' + g.languages.join(', ') + '.');
      chk(sel.guideId, nm);
    }
    if (sel.driverId) {
      const d = Q.driver(sel.driverId); const nm = 'El conductor ' + esc(d.name);
      if (d.status === 'vacaciones') blocks.push(nm + ' está de vacaciones.');
      if (d.status === 'descanso') warns.push(nm + ' está en descanso programado.');
      if (d.expires < dt) blocks.push('Licencia de ' + esc(d.name) + ' vencida (' + date(d.expires) + ') para la fecha del servicio.');
      else if (daysFromToday(d.expires) <= 30) warns.push('Licencia de ' + esc(d.name) + ' vence el ' + date(d.expires) + ' (en ' + daysFromToday(d.expires) + ' días).');
      chk(sel.driverId, nm);
    }
    if (sel.vehicleId) {
      const v = Q.vehicle(sel.vehicleId); const nm = 'El vehículo ' + esc(v.plate);
      if (v.status === 'mantenimiento') blocks.push(nm + ' está en mantenimiento.');
      if (v.capacity < pax) blocks.push('Capacidad insuficiente: ' + esc(v.type) + ' (' + v.capacity + ' asientos) para ' + pax + ' pasajeros.');
      if (v.soat < dt) blocks.push('SOAT de ' + esc(v.plate) + ' vencido (' + date(v.soat) + ') para la fecha del servicio.');
      else if (daysFromToday(v.soat) <= 30) warns.push('SOAT de ' + esc(v.plate) + ' vence el ' + date(v.soat) + ' (en ' + daysFromToday(v.soat) + ' días).');
      chk(sel.vehicleId, nm);
    }
    return { blocks, warns };
  }
  function renderVal(r) {
    let h = '';
    if (r.blocks.length) h += UI.alert('bad', '<b>Asignación bloqueada (' + r.blocks.length + ')</b><ul class="val-list">' + r.blocks.map(x => '<li>' + x + '</li>').join('') + '</ul>');
    if (r.warns.length) h += '<div style="margin-top:8px">' + UI.alert('warn', '<b>Advertencias (' + r.warns.length + ')</b><ul class="val-list">' + r.warns.map(x => '<li>' + x + '</li>').join('') + '</ul>' + (r.blocks.length ? '' : '<label class="check" style="margin-top:8px"><input type="checkbox" name="as_ack"> Asumo las advertencias y confirmo la asignación</label>')) + '</div>';
    if (!h) h = UI.alert('ok', 'Sin conflictos: recursos disponibles en el horario, documentos vigentes y capacidad suficiente.');
    return h;
  }
  function assignModal(op, a, onDone) {
    if (!guard('operations.assign')) return;
    const res = resOf(op); const s = svcOf(res, a.serviceId) || {};
    const gOpts = DB.guides.map(g => [g.id, g.name + ' — ' + g.languages.join('/') + (g.status !== 'disponible' ? ' (' + UI.statusLabel(g.status) + ')' : '')]);
    const dOpts = DB.drivers.map(d => [d.id, d.name + ' — lic. vence ' + dateShort(d.expires) + (d.status !== 'disponible' ? ' (' + UI.statusLabel(d.status) + ')' : '')]);
    const vOpts = DB.vehicles.map(v => [v.id, v.plate + ' · ' + v.type + (v.status !== 'disponible' ? ' (' + UI.statusLabel(v.status) + ')' : '')]);
    UI.modal({
      title: 'Asignar recursos', size: 'lg', sub: esc(a.service) + ' · ' + date(a.date) + ' ' + esc(a.time) + ' · ' + res.passengers.length + ' pax',
      body: '<div class="grid g-2-1" style="gap:18px"><div>' + UI.form([
        { id: 'guideId', label: 'Guía', type: 'select', options: gOpts, value: a.guideId || '', placeholder: 'Sin guía', col: 12 },
        { id: 'driverId', label: 'Conductor', type: 'select', options: dOpts, value: a.driverId || '', placeholder: 'Sin conductor', col: 12 },
        { id: 'vehicleId', label: 'Vehículo', type: 'select', options: vOpts, value: a.vehicleId || '', placeholder: 'Sin vehículo', col: 12 },
        { type: 'section', label: 'Notificar al recurso (PROC-059)' },
        { id: 'n_push', label: 'Push en app operador', type: 'checkbox', value: true, col: 6 },
        { id: 'n_wa', label: 'WhatsApp', type: 'checkbox', value: true, col: 6 }
      ]) + '</div><div>' + UI.dl([['Orden', esc(op.id)], ['Reserva', esc(res.id)], ['Servicio', esc(a.service)], ['Proveedor', esc(Q.providerName(s.providerId))], ['Fecha', date(a.date) + ' · ' + esc(a.time)], ['Pasajeros', res.passengers.length + ''], ['Idioma requerido', needLang(res).join(', ') || 'ES']]) + '<p class="xs faint" style="margin-top:10px">Validación PROC-033: cruce de horarios del mismo recurso (órdenes y salidas), capacidad del vehículo, estado del recurso y vigencia de licencia / SOAT.</p></div></div><div id="as-val" style="margin-top:14px"></div>',
      onOpen: (m) => {
        const val = () => { const f = UI.formData(m); m.querySelector('#as-val').innerHTML = renderVal(validateAssign(op, a, f)); };
        m.querySelectorAll('select').forEach(x => x.addEventListener('change', val)); val();
      },
      actions: [{ label: 'Cancelar' }, {
        label: 'Asignar y notificar', cls: 'primary', icon: 'send', onClick: (m) => {
          const f = UI.formData(m); const r = validateAssign(op, a, f);
          if (r.blocks.length) { UI.toast('No se puede asignar: ' + r.blocks.length + ' conflicto(s) bloqueante(s). PROC-033.', 'bad'); return false; }
          if (r.warns.length && !f.as_ack) { UI.toast('Revise las advertencias y marque la casilla de confirmación.', 'warn'); return false; }
          const before = [a.guideId, a.driverId, a.vehicleId].map(x => x || '—').join(' / ');
          a.guideId = f.guideId || null; a.driverId = f.driverId || null; a.vehicleId = f.vehicleId || null;
          a.status = 'asignada';
          const subj = 'Nueva asignación: ' + a.service + ' · ' + dateShort(a.date) + ' ' + a.time + ' (' + op.id + ')';
          [Q.guide(a.guideId), Q.driver(a.driverId)].filter(Boolean).forEach(rsc => {
            if (f.n_push) Notify.push('asignacion.nueva', 'Push', rsc.userId || rsc.name, subj);
            if (f.n_wa) Notify.push('asignacion.nueva', 'WhatsApp', rsc.phone, subj);
          });
          Audit.log('Asignación', op.id + '/' + a.serviceId, 'asignar', before, [a.guideId, a.driverId, a.vehicleId].map(x => x || '—').join(' / ') + (r.warns.length ? ' (con ' + r.warns.length + ' advertencia/s)' : ''));
          recomputeOp(op); Store.save();
          UI.toast('Recursos asignados y notificados' + (f.n_push || f.n_wa ? ' (' + [f.n_push ? 'push' : '', f.n_wa ? 'WhatsApp' : ''].filter(Boolean).join(' + ') + ')' : '') + '.');
          onDone ? onDone() : rerender();
        }
      }]
    });
  }
  function ensureAssignment(op, s) {
    let a = (op.assignments || []).find(x => x.serviceId === s.id);
    if (!a) { a = { serviceId: s.id, date: s.date, time: s.time, service: s.name, guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null }; op.assignments.push(a); }
    return a;
  }

  /* ======================================================================
     ÓRDENES OPERATIVAS — lista (PROC-031)
     ====================================================================== */
  function orderList(el) {
    const ops = DB.operations;
    const enEj = ops.filter(o => o.status === 'en_ejecucion').length;
    const pendA = allAssign().filter(({ op, a }) => a.status === 'pendiente' && op.status !== 'completada');
    const todaySv = svcOnDate(T()), tomSv = svcOnDate(addDays(T(), 1));
    const openInc = DB.incidents.filter(isOpenInc);
    const crit = openInc.filter(i => i.severity === 'critica');
    const coords = [...new Set(ops.map(o => o.coordinator))];
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({
      title: 'Órdenes operativas', crumbs: [['Inicio', '#/dashboard'], ['Operaciones'], ['Órdenes operativas']],
      subtitle: 'Reserva confirmada → orden operativa → servicios → proveedores → asignaciones → confirmaciones → voucher → ejecución → cierre (PROC-031 a PROC-039).',
      actions: '<a class="btn" href="#/operaciones/calendario">' + ic('calendar') + 'Calendario</a><a class="btn" href="#/operaciones/asignaciones">' + ic('truck') + 'Recursos</a><button class="btn primary" id="op-new"' + dis('operations.assign') + '>' + ic('plus') + 'Nueva orden</button>'
    }) +
      (crit.length ? UI.alert('bad', '<b>Incidencia crítica abierta:</b> ' + crit.map(i => incLink(i.id) + ' ' + esc(i.title)).join(' · ')) : '') +
      '<div class="grid g4">' +
      UI.kpi({ label: 'En ejecución', value: enEj, sub: ops.filter(o => !['completada', 'cancelada'].includes(o.status)).length + ' órdenes activas', tone: 'accent', icon: 'route' }) +
      UI.kpi({ label: 'Pendientes de asignación', value: pendA.length, sub: 'servicios sin recursos', tone: pendA.length ? 'sun' : 'ok', icon: 'truck' }) +
      UI.kpi({ label: 'Servicios hoy', value: todaySv.length, sub: tomSv.length + ' mañana (' + dateShort(addDays(T(), 1)) + ')', tone: 'info', icon: 'calendar' }) +
      UI.kpi({ label: 'Incidencias abiertas', value: openInc.length, sub: crit.length + ' crítica(s)', tone: crit.length ? 'bad' : 'ok', icon: 'alert' }) +
      '</div><div id="op-tbl"></div></div>';
    UI.dataTable(el.querySelector('#op-tbl'), {
      rows: () => DB.operations, exportName: 'ordenes_operativas', defaultSort: 'dateFrom',
      search: (r) => [r.id, r.resId, r.title, Q.clientName(resOf(r).clientId), Q.userName(r.coordinator)].join(' '),
      searchPlaceholder: 'Buscar orden, reserva, cliente…',
      filters: [{ key: 'status', label: 'Estado', options: OP_KEYS }, { key: 'coordinator', label: 'Coordinador', options: coords.map(u => [u, Q.userName(u)]) }],
      onRow: (r) => App.go('#/operaciones/ordenes/' + r.id),
      columns: [
        { key: 'id', label: 'Orden', render: r => '<span class="mono">' + esc(r.id) + '</span>' },
        { key: 'resId', label: 'Reserva / cliente', render: r => '<div class="cell-main">' + resLink(r.resId) + '</div><div class="cell-sub">' + esc(Q.clientName(resOf(r).clientId)) + '</div>', csv: r => r.resId },
        { key: 'title', label: 'Operación', render: r => '<div class="cell-main">' + esc(r.title) + '</div><div class="cell-sub">' + esc(resOf(r).channel || '') + ' · ' + (resOf(r).services || []).length + ' servicios</div>' },
        { key: 'dateFrom', label: 'Fechas', render: r => '<span class="nowrap">' + dateShort(r.dateFrom) + ' – ' + date(r.dateTo) + '</span>' },
        { key: 'pax', label: 'Pax', align: 'num', sortVal: r => resOf(r).passengers.length, render: r => resOf(r).passengers.length, csv: r => resOf(r).passengers.length },
        { key: 'asg', label: 'Asignación', sortVal: r => asgPct(r), csv: r => asgDone(r) + '/' + (r.assignments || []).length, render: r => { const n = (r.assignments || []).length, d = asgDone(r); return '<div style="min-width:110px"><div class="row between xs"><span class="faint">' + d + '/' + n + ' con recursos</span></div>' + UI.progress(n ? d / n * 100 : 0, d === n ? 'ok' : 'sun') + '</div>'; } },
        { key: 'inc', label: 'Incid.', align: 'num', sortVal: r => DB.incidents.filter(i => i.opId === r.id && isOpenInc(i)).length, csv: r => DB.incidents.filter(i => i.opId === r.id && isOpenInc(i)).length, render: r => { const l = DB.incidents.filter(i => i.opId === r.id && isOpenInc(i)); return l.length ? UI.badge(l.some(i => i.severity === 'critica') ? 'critica' : 'alta', String(l.length)) : '<span class="faint">0</span>'; } },
        { key: 'coordinator', label: 'Coordinador', render: r => UI.userChip(r.coordinator), csv: r => Q.userName(r.coordinator) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), csv: r => UI.statusLabel(r.status) }
      ]
    });
    const nb = el.querySelector('#op-new'); if (nb) nb.onclick = newOrderModal;
  }
  const asgDone = (op) => (op.assignments || []).filter(a => a.status !== 'pendiente').length;
  const asgPct = (op) => { const n = (op.assignments || []).length; return n ? asgDone(op) / n : 0; };

  function newOrderModal() {
    if (!guard('operations.assign')) return;
    const cands = DB.reservations.filter(r => !opOfRes(r.id) && !['cancelada', 'completada'].includes(r.status));
    UI.modal({
      title: 'Nueva orden operativa', sub: 'PROC-031: Reserva confirmada → Crear orden → Replicar servicios → Fechas → Pasajeros → Proveedores → Tareas → Responsables',
      body: cands.length ? UI.form([
        { id: 'resId', label: 'Reserva', type: 'select', required: true, placeholder: 'Seleccione…', options: cands.map(r => [r.id, r.id + ' — ' + r.title + ' (' + UI.statusLabel(r.status) + ')']), col: 12 },
        { id: 'coord', label: 'Coordinador responsable', type: 'select', required: true, options: opUsers().map(u => [u.id, u.name]), value: Auth.user.role === 'operations' ? Auth.user.id : 'U05', col: 12 },
        { type: 'html', col: 12, html: '<div id="no-chk"></div>' }
      ]) : UI.empty('Todas las reservas activas ya tienen orden operativa.', 'checkCircle'),
      onOpen: (m) => {
        const s = m.querySelector('#resId'); if (!s) return;
        s.onchange = () => { const r = Q.reservation(s.value); const box = m.querySelector('#no-chk'); if (!r) { box.innerHTML = ''; return; } box.innerHTML = r.status === 'confirmada' || r.status === 'en_operacion' ? UI.alert('ok', 'Reserva confirmada. Se replicarán ' + r.services.filter(x => x.status !== 'cancelado').length + ' servicios y ' + r.passengers.length + ' pasajeros.') : UI.alert('bad', '<b>Bloqueado:</b> la reserva está en estado «' + esc(UI.statusLabel(r.status)) + '». Solo una reserva confirmada genera orden operativa (PROC-031).'); };
      },
      actions: cands.length ? [{ label: 'Cancelar' }, {
        label: 'Crear orden', cls: 'primary', onClick: (m) => {
          if (!UI.validate(m)) return false;
          const f = UI.formData(m); const r = Q.reservation(f.resId);
          if (!['confirmada', 'en_operacion'].includes(r.status)) { UI.toast('PROC-031: la reserva debe estar confirmada para generar la orden operativa.', 'bad'); return false; }
          const svcs = r.services.filter(s => s.status !== 'cancelado' && s.providerId && !/hotel|hab\.|entrada/i.test(s.name));
          const op = { id: Seq.next('Orden operativa'), resId: r.id, title: r.title, status: 'pendiente_asignacion', coordinator: f.coord, createdAt: T(), dateFrom: r.travelFrom, dateTo: r.travelTo,
            tasks: [{ t: 'Enviar solicitudes a proveedores', done: false }, { t: 'Asignar guías, conductores y vehículos', done: false }, { t: 'Emitir vouchers de servicios confirmados', done: false }, { t: 'Llamada de bienvenida al cliente', done: false }, { t: 'Encuesta de cierre', done: false }],
            assignments: svcs.map(s => ({ serviceId: s.id, date: s.date, time: s.time, service: s.name, guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null })), evidence: [] };
          if (!op.assignments.length) op.status = 'planificada';
          DB.operations.unshift(op);
          Audit.log('Orden operativa', op.id, 'crear', '', r.id + ' / ' + op.assignments.length + ' servicios');
          Notify.push('orden.creada', 'Email', (Q.user(f.coord) || {}).email || f.coord, 'Nueva orden operativa ' + op.id + ' — ' + r.title);
          Store.save(); UI.toast('Orden ' + op.id + ' creada.'); App.go('#/operaciones/ordenes/' + op.id);
        }
      }] : [{ label: 'Cerrar' }]
    });
  }

  /* ======================================================================
     ORDEN 360
     ====================================================================== */
  const opTab = {};
  function orderDetail(el, id) {
    const op = Q.operation(id);
    if (!op) { el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Orden no encontrada', crumbs: [['Operaciones', '#/operaciones/ordenes'], [id]] }) + UI.card('', UI.empty('La orden ' + id + ' no existe.', 'clipboard')) + '</div>'; return; }
    const res = resOf(op); evList(op);
    const svcs = res.services.filter(s => s.status !== 'cancelado');
    const incs = DB.incidents.filter(i => i.opId === op.id);
    const vous = DB.vouchers.filter(v => v.resId === op.resId);
    const rl = roomingList(op.resId); const rls = roomingsOf(op.resId);
    const idx = opIdx(op.status);
    /* v2.1: datos que el cliente ingresó en la reserva web (recojo, vuelo, comentarios) + alertas operativas */
    const pk = pickupOf(res), cmt = clientComments(res), tg = tagsHtml(res), diets = res.passengers.filter(p => p.diet);
    const pkSvc = pk ? res.services.find(s => pickupApplies(res, s)) : null;
    const webCard = (pk || cmt || diets.length) ? UI.card('Datos del cliente para la operación', '<div class="grid g3">' +
      '<div>' + UI.dl([['Punto de recojo', pk ? esc([pk.point, pk.address].filter(Boolean).join(' — ')) + ruleOff('R-PICKUP', res) : '<span class="faint">Según itinerario</span>'], ['Hora de recojo', pkSvc ? esc(dateShort(pkSvc.date) + ' · ' + pkSvc.time) + ' <span class="xs faint">(' + esc(pkSvc.name) + ')</span>' : '—']]) + '</div>' +
      '<div>' + UI.dl([['Vuelo de llegada', pk && pk.flight ? esc(pk.flight) : '—'], ['Llegada', pk && pk.arrival ? datetime(pk.arrival) : '—']]) + '</div>' +
      '<div>' + (cmt ? '<div class="xs faint" style="margin-bottom:4px">Comentarios especiales del cliente' + ruleOff('R-COMMENTS', res) + '</div><div class="op-quote">' + esc(cmt) + '</div>' : '') + (diets.length ? '<div class="small" style="margin-top:6px">' + diets.map(p => '<b>' + esc(p.name.split(' ')[0]) + ':</b> ' + esc(p.diet)).join(' · ') + '</div>' : '') + (tg ? '<div class="row" style="gap:6px;margin-top:6px">' + tg + '</div>' : '') + '</div></div>', { sub: res.booking ? 'Capturados en la reserva web ' + (res.booking.orderId ? esc(res.booking.orderId) : '') + ' · visibles en app del operador y voucher' : 'Dietas y notas de pasajeros' }) : '';
    const next = { planificada: ['pendiente_asignacion', 'Pasar a asignación'], pendiente_asignacion: ['asignada', 'Marcar como asignada'], asignada: ['confirmada', 'Confirmar operación'], confirmada: ['en_ejecucion', 'Iniciar ejecución'] }[op.status];
    const conf = svcs.filter(s => ['confirmado', 'completado', 'en_curso'].includes(s.status)).length;
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({
      title: esc(op.title) + ' ' + UI.badge(op.status), crumbs: [['Inicio', '#/dashboard'], ['Órdenes operativas', '#/operaciones/ordenes'], [op.id]],
      subtitle: '<span class="mono">' + op.id + '</span> · Reserva ' + resLink(res.id) + ' · ' + cliLink(res.clientId) + ' · ' + date(op.dateFrom) + ' – ' + date(op.dateTo) + ' · ' + res.passengers.length + ' pax · Coordina ' + esc(Q.userName(op.coordinator)),
      actions: '<a class="btn" href="#/reservas/' + esc(res.id) + '">' + ic('suitcase') + 'Ver reserva</a><button class="btn" id="op-coord"' + dis('operations.assign') + '>' + ic('user') + 'Coordinador</button>' + (next ? '<button class="btn primary" id="op-next"' + dis('operations.assign') + '>' + ic('arrowRight') + next[1] + '</button>' : '') + (op.status === 'en_ejecucion' ? '<button class="btn primary" id="op-toclose"' + dis('operations.close') + '>' + ic('checkCircle') + 'Ir a cierre</button>' : '')
    }) +
      (incs.some(i => i.severity === 'critica' && isOpenInc(i)) ? UI.alert('bad', '<b>Incidencia crítica abierta en esta operación:</b> ' + incs.filter(i => i.severity === 'critica' && isOpenInc(i)).map(i => incLink(i.id) + ' ' + esc(i.title)).join(' · ') + '. Debe resolverse antes del cierre (PROC-037 / PROC-039).') : '') +
      UI.card('', UI.flow(OP_STEPS, idx) + '<div class="row between xs faint" style="margin-top:8px"><span>Creada el ' + date(op.createdAt) + (op.closedAt ? ' · Cerrada el ' + datetime(op.closedAt) + ' por ' + esc(Q.userName(op.closedBy)) : '') + '</span><span>Máquina de estados de la operación (DOC-PROC-001)</span></div>') +
      '<div class="op-mini">' + [['Servicios', svcs.length], ['Confirmados prov.', conf + '/' + svcs.length], ['Con recursos', asgDone(op) + '/' + (op.assignments || []).length], ['Vouchers vigentes', vous.filter(v => v.status === 'emitido').length], ['Incidencias abiertas', incs.filter(isOpenInc).length], ['Evidencias', op.evidence.length]].map(k => '<div><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>').join('') + '</div>' +
      webCard + '<div class="card"><div class="card-b" id="op-tabs"></div></div></div>';

    const tabs = [
      { id: 'svc', label: 'Servicios y asignaciones', count: svcs.length, render: b => tabServices(b, op, res) },
      { id: 'tasks', label: 'Tareas', count: op.tasks.filter(t => !t.done).length, render: b => tabTasks(b, op) },
      { id: 'pax', label: 'Pasajeros', count: res.passengers.length, render: b => tabPax(b, op, res) },
      { id: 'room', label: 'Rooming', count: rls.reduce((a, x) => a + x.rooms.length, 0), render: b => tabRooming(b, op, res, rl) },
      { id: 'vou', label: 'Vouchers', count: vous.length, render: b => tabVouchers(b, op, res) },
      { id: 'inc', label: 'Incidencias', count: incs.length, render: b => tabIncidents(b, op, incs) },
      { id: 'ev', label: 'Evidencias', count: op.evidence.length, render: b => tabEvidence(b, op, res, incs) },
      { id: 'close', label: 'Cierre', render: b => tabClose(b, op, res, incs) }
    ];
    UI.tabs(el.querySelector('#op-tabs'), tabs, opTab[op.id] || 'svc', { onChange: t => { opTab[op.id] = t; } });

    const nx = el.querySelector('#op-next');
    if (nx) nx.onclick = () => {
      if (!guard('operations.assign')) return;
      const to = next[0];
      if (to === 'asignada' && op.assignments.some(a => a.status === 'pendiente')) { UI.toast('Hay ' + op.assignments.filter(a => a.status === 'pendiente').length + ' servicio(s) sin recursos. Complete las asignaciones (PROC-033).', 'bad'); return; }
      if (to === 'confirmada') { const pend = op.assignments.filter(a => !['confirmada', 'completada', 'en_curso'].includes(a.status)); const provPend = svcs.filter(s => ['pendiente', 'solicitado'].includes(s.status)); if (pend.length || provPend.length) { UI.toast('No se puede confirmar: ' + (pend.length ? pend.length + ' asignación(es) sin confirmar por el recurso' : '') + (pend.length && provPend.length ? ' y ' : '') + (provPend.length ? provPend.length + ' servicio(s) sin confirmación del proveedor (PROC-032)' : '') + '.', 'bad'); return; } }
      UI.confirm({ title: next[1], message: 'La orden pasará de <b>' + UI.statusLabel(op.status) + '</b> a <b>' + UI.statusLabel(to) + '</b>.', onConfirm: () => {
        const b = op.status; op.status = to;
        if (to === 'en_ejecucion' && res.status === 'confirmada') res.status = 'en_operacion';
        Audit.log('Orden operativa', op.id, 'cambio_estado', b, to); Store.save(); UI.toast('Orden en estado ' + UI.statusLabel(to) + '.'); rerender();
      } });
    };
    const tc = el.querySelector('#op-toclose'); if (tc) tc.onclick = () => { opTab[op.id] = 'close'; rerender(); };
    el.querySelector('#op-coord').onclick = () => {
      if (!guard('operations.assign')) return;
      UI.modal({ title: 'Coordinador responsable', size: 'sm', body: UI.form([{ id: 'c', label: 'Coordinador', type: 'select', options: opUsers().map(u => [u.id, u.name + ' — ' + Q.roleName(u.role)]), value: op.coordinator, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { const c = m.querySelector('#c').value; const b = op.coordinator; op.coordinator = c; Audit.log('Orden operativa', op.id, 'cambio_responsable', b, c); Notify.push('orden.responsable', 'Email', (Q.user(c) || {}).email, 'Se le asignó la orden ' + op.id); Store.save(); UI.toast('Responsable actualizado.'); rerender(); } }] });
    };
  }

  /* ---- Pestaña: Servicios y asignaciones ---- */
  function tabServices(b, op, res) {
    const svcs = res.services.slice().sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
    b.innerHTML = '<div class="row between" style="margin-bottom:12px"><div class="small muted">Servicios replicados de la reserva. Solicitud a proveedor (PROC-032), asignación de recursos con validación de conflictos (PROC-033) y confirmaciones.</div><div class="legend"><span><i style="background:var(--accent)"></i>Recurso asignado</span><span><i style="background:var(--warn)"></i>Pendiente</span></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Servicio / proveedor</th><th>Estado proveedor</th><th>Guía</th><th>Conductor</th><th>Vehículo</th><th>Asignación</th><th class="right">Acciones</th></tr></thead><tbody>' +
      svcs.map(s => {
        const a = (op.assignments || []).find(x => x.serviceId === s.id);
        const needs = s.providerId && !/hotel|hab\.|entrada/i.test(s.name);
        const cell = (v) => v ? '<span class="small">' + v + '</span>' : (needs && a ? '<span class="xs warn">Sin asignar</span>' : '<span class="faint">—</span>');
        return '<tr' + (s.status === 'cancelado' ? ' style="opacity:.55"' : '') + '><td class="nowrap"><b>' + dateShort(s.date) + '</b> <span class="faint">' + esc(s.time) + '</span></td>' +
          '<td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + provLink(s.providerId) + (s.productId ? ' · ' + prodLink(s.productId) : '') + (s.confirmationCode ? ' · <span class="mono">' + esc(s.confirmationCode) + '</span>' : '') + '</div>' + (pickupApplies(res, s) ? '<div class="cell-sub" style="color:var(--accent)">' + ic('pin') + ' Recojo: ' + esc(pickupText(res)) + '</div>' : '') + '</td>' +
          '<td>' + UI.badge(s.status) + '</td>' +
          '<td>' + cell(a && a.guideId ? esc(gName(a.guideId)) : '') + '</td><td>' + cell(a && a.driverId ? esc(dName(a.driverId)) : '') + '</td><td>' + cell(a && a.vehicleId ? '<span class="mono">' + esc((Q.vehicle(a.vehicleId) || {}).plate) + '</span>' : '') + '</td>' +
          '<td>' + (a ? UI.badge(a.status) + (a.checkin ? '<div class="xs faint">Check-in ' + esc(a.checkin.split(' ')[1] || a.checkin) + '</div>' : '') : '<span class="faint xs">No requiere</span>') + '</td>' +
          '<td class="right nowrap">' + (s.status !== 'cancelado' && s.providerId ? ((needs || a) ? '<button class="btn xs" data-as="' + s.id + '"' + dis('operations.assign') + '>' + ic('truck') + (a && a.status !== 'pendiente' ? 'Reasignar' : 'Asignar') + '</button> ' : '') + '<button class="btn xs icon" data-more="' + s.id + '" aria-label="Más acciones">' + ic('more') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    b.querySelectorAll('[data-as]').forEach(x => x.onclick = () => { const s = svcOf(res, x.dataset.as); const a = ensureAssignment(op, s); assignModal(op, a); });
    b.querySelectorAll('[data-more]').forEach(x => x.onclick = () => svcMenu(x, op, res, svcOf(res, x.dataset.more)));
  }
  function svcMenu(anchor, op, res, s) {
    const a = (op.assignments || []).find(x => x.serviceId === s.id);
    const items = [];
    if (s.status === 'pendiente') items.push({ label: 'Enviar solicitud al proveedor', icon: 'send', onClick: () => { if (!guard('operations.assign')) return; s.status = 'solicitado'; const p = Q.provider(s.providerId); Notify.push('proveedor.solicitud', 'Email', p ? p.email : '—', 'Solicitud de servicio ' + s.name + ' · ' + dateShort(s.date) + ' (' + res.id + ')'); Audit.log('Servicio', s.id, 'solicitar_proveedor', 'pendiente', 'solicitado'); Store.save(); UI.toast('Solicitud enviada a ' + esc(Q.providerName(s.providerId)) + ' (PROC-032).'); rerender(); } });
    if (['pendiente', 'solicitado', 'rechazado'].includes(s.status)) items.push({ label: 'Registrar confirmación del proveedor', icon: 'checkCircle', onClick: () => provConfirm(s, res) });
    if (s.status === 'solicitado') items.push({ label: 'Registrar rechazo del proveedor', icon: 'x', onClick: () => { if (!guard('operations.assign')) return; UI.confirm({ title: 'Rechazo del proveedor', message: 'Se registrará el rechazo de <b>' + esc(Q.providerName(s.providerId)) + '</b>. Deberá gestionar un proveedor alternativo.', reason: true, confirmLabel: 'Registrar rechazo', danger: true, onConfirm: (r) => { s.status = 'rechazado'; Audit.log('Servicio', s.id, 'rechazo_proveedor', 'solicitado', 'rechazado: ' + r); Notify.push('proveedor.rechazo', 'Email', (Q.user(op.coordinator) || {}).email, 'Proveedor rechazó ' + s.name); Store.save(); UI.toast('Rechazo registrado. Busque alternativa (PROC-032).', 'warn'); rerender(); } }); } });
    if (a && a.status === 'asignada') items.push({ label: 'Registrar confirmación del recurso', icon: 'check', onClick: () => { if (!guard('operations.assign')) return; a.status = 'confirmada'; Audit.log('Asignación', op.id + '/' + s.id, 'confirmar', 'asignada', 'confirmada'); recomputeOp(op); Store.save(); UI.toast('Asignación confirmada por el recurso.'); rerender(); } });
    if (a && a.status !== 'pendiente' && a.status !== 'completada') items.push({ label: 'Liberar recursos', icon: 'refresh', onClick: () => { if (!guard('operations.assign')) return; UI.confirm({ title: 'Liberar recursos', message: 'Se quitarán guía, conductor y vehículo de este servicio y se notificará a los recursos.', danger: true, confirmLabel: 'Liberar', onConfirm: () => { const bf = [a.guideId, a.driverId, a.vehicleId].join('/'); [Q.guide(a.guideId), Q.driver(a.driverId)].filter(Boolean).forEach(r => Notify.push('asignacion.liberada', 'WhatsApp', r.phone, 'Asignación liberada: ' + a.service + ' ' + dateShort(a.date))); a.guideId = a.driverId = a.vehicleId = null; a.status = 'pendiente'; Audit.log('Asignación', op.id + '/' + s.id, 'liberar', bf, '—'); recomputeOp(op); Store.save(); UI.toast('Recursos liberados.'); rerender(); } }); } });
    if (['confirmado', 'en_curso'].includes(s.status)) items.push({ label: 'Marcar servicio completado', icon: 'checkCircle', onClick: () => { if (!guard('operations.assign')) return; if (s.date > T()) { UI.toast('El servicio es del ' + date(s.date) + ': no puede completarse antes de su fecha (PROC-036).', 'bad'); return; } const bf = s.status; s.status = 'completado'; if (a) a.status = 'completada'; Audit.log('Servicio', s.id, 'completar', bf, 'completado'); Store.save(); UI.toast('Servicio completado.'); rerender(); } });
    if (['confirmado', 'completado'].includes(s.status)) items.push({ label: 'Emitir voucher', icon: 'ticket', onClick: () => emitVoucher(res.id, s.id) });
    const need = { 'Enviar solicitud al proveedor': 'operations.assign', 'Registrar confirmación del proveedor': 'operations.assign', 'Registrar rechazo del proveedor': 'operations.assign', 'Registrar confirmación del recurso': 'operations.assign', 'Liberar recursos': 'operations.assign', 'Marcar servicio completado': 'operations.assign', 'Emitir voucher': 'operations.vouchers' };
    for (let k = items.length - 1; k >= 0; k--) if (need[items[k].label] && !Auth.can(need[items[k].label])) items.splice(k, 1);
    if (items.length) items.push('-');
    items.push({ label: 'Ver en calendario', icon: 'calendar', onClick: () => { cal.anchor = s.date.slice(0, 8) + '01'; App.go('#/operaciones/calendario'); } });
    if (s.productId && Access.canRoute('catalogo/productos/' + s.productId)) items.push({ label: 'Abrir producto', icon: 'box', onClick: () => App.go('#/catalogo/productos/' + s.productId) });
    if (s.providerId && Access.canRoute('catalogo/proveedores/' + s.providerId)) items.push({ label: 'Abrir proveedor', icon: 'building', onClick: () => App.go('#/catalogo/proveedores/' + s.providerId) });
    UI.menu(anchor, items);
  }
  function provConfirm(s, res) {
    if (!guard('operations.assign')) return;
    UI.modal({ title: 'Confirmación del proveedor', size: 'sm', sub: esc(s.name) + ' · ' + esc(Q.providerName(s.providerId)), body: UI.form([{ id: 'code', label: 'Código de confirmación', required: true, value: s.confirmationCode || '', placeholder: 'Ej.: QT-88140', col: 12 }, { id: 'note', label: 'Observación', type: 'textarea', rows: 2, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar confirmación', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); const b = s.status; s.status = 'confirmado'; s.confirmationCode = f.code; Audit.log('Servicio', s.id, 'confirmacion_proveedor', b, 'confirmado ' + f.code); Store.save(); UI.toast('Servicio confirmado por el proveedor. Ya puede emitirse su voucher (Regla transversal 11).'); rerender(); } }] });
  }

  /* ---- Pestaña: Tareas ---- */
  function tabTasks(b, op) {
    const done = op.tasks.filter(t => t.done).length;
    b.innerHTML = '<div class="grid g-2-1"><div>' + '<div class="row between" style="margin-bottom:6px"><b class="small">Checklist operativo</b><span class="xs faint">' + done + ' de ' + op.tasks.length + ' completadas</span></div>' + UI.progress(op.tasks.length ? done / op.tasks.length * 100 : 0, done === op.tasks.length ? 'ok' : '') +
      '<div style="margin-top:8px">' + (op.tasks.length ? op.tasks.map((t, i) => '<div class="task-row' + (t.done ? ' done' : '') + '"><input type="checkbox" data-t="' + i + '"' + (t.done ? ' checked' : '') + dis('operations.assign') + ' style="width:17px;height:17px;accent-color:var(--accent)" aria-label="Completar tarea"><span class="grow small task-t">' + esc(t.t) + '</span>' + (t.by ? '<span class="xs faint">' + esc(Q.userName(t.by)) + ' · ' + esc(t.at || '') + '</span>' : '') + '<button class="btn xs ghost icon" data-del="' + i + '"' + dis('operations.assign') + ' aria-label="Eliminar tarea">' + ic('trash') + '</button></div>').join('') : UI.empty('Sin tareas', 'clipboard')) + '</div>' +
      '<div class="row" style="margin-top:12px;flex-wrap:nowrap"><input class="input" id="t-new" placeholder="Nueva tarea (p. ej. Confirmar dietas con restaurante)"' + (Auth.can('operations.assign') ? '' : ' disabled') + '><button class="btn primary" id="t-add"' + dis('operations.assign') + '>' + ic('plus') + 'Agregar</button></div></div>' +
      '<div>' + UI.alert('info', 'Las tareas no bloquean el cierre, pero quedan registradas en la bitácora de la orden. El cierre exige servicios, incidencias, evidencias y costos (PROC-039).') + '</div></div>';
    b.querySelectorAll('[data-t]').forEach(x => x.onchange = () => { if (!guard('operations.assign')) { x.checked = !x.checked; return; } const t = op.tasks[+x.dataset.t]; t.done = x.checked; t.by = Auth.user.id; t.at = nowStr(); Store.save(); rerender(); });
    b.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { if (!guard('operations.assign')) return; const t = op.tasks[+x.dataset.del]; UI.confirm({ title: 'Eliminar tarea', message: '¿Eliminar «' + esc(t.t) + '»?', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { op.tasks.splice(+x.dataset.del, 1); Audit.log('Orden operativa', op.id, 'eliminar_tarea', t.t, ''); Store.save(); rerender(); } }); });
    const add = () => { if (!guard('operations.assign')) return; const v = b.querySelector('#t-new').value.trim(); if (!v) { UI.toast('Escriba la tarea.', 'warn'); return; } op.tasks.push({ t: v, done: false }); Store.save(); UI.toast('Tarea agregada.'); rerender(); };
    b.querySelector('#t-add').onclick = add;
    b.querySelector('#t-new').onkeydown = (e) => { if (e.key === 'Enter') add(); };
  }

  /* ---- Pestaña: Pasajeros ---- */
  function tabPax(b, op, res) {
    const cnt = (name) => (op.assignments || []).filter(a => a.paxCheckin && a.paxCheckin[name]).length;
    b.innerHTML = '<div class="small muted" style="margin-bottom:10px">Pasajeros de la reserva ' + resLink(res.id) + '. El check-in individual se registra desde la app del operador (PROC-036).</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Pasajero</th><th>Parentesco</th><th>Documento</th><th>Tipo</th><th class="num">Edad</th><th>Nacionalidad</th><th>Teléfono</th><th>Dieta / notas</th><th class="num">Check-ins</th></tr></thead><tbody>' +
      res.passengers.map((p, i) => '<tr><td class="faint">' + (i + 1) + '</td><td class="cell-main">' + esc(p.name) + (p.isLead ? ' ' + UI.badge('confirmado', 'Titular') : '') + '</td><td>' + esc(p.relationship || '—') + '</td><td class="mono">' + esc(p.doc) + '</td><td>' + esc(p.type) + '</td><td class="num">' + (ageOf(p, res) != null ? ageOf(p, res) : '—') + '</td><td>' + esc(p.nationality) + '</td><td>' + esc(p.phone || '—') + '</td><td>' + (p.diet ? UI.badge('alta', p.diet) : '<span class="faint">—</span>') + '</td><td class="num">' + cnt(p.name) + '</td></tr>').join('') + '</tbody></table></div>';
  }

  /* ---- Pestaña: Rooming ---- */
  function tabRooming(b, op, res, rl) {
    const legsPend = lodgingLegs(res).filter(g => !g.exists);
    const preHtml = legsPend.length ? UI.alert('info', 'La reserva web trae alojamiento por ciudad (' + legsPend.map(g => esc(g.city) + ': ' + g.items.map(l => l.rooms + ' ' + esc(String(l.roomType).toLowerCase())).join(' + ')).join(' · ') + '). <button class="btn xs primary" id="rm-pre"' + dis('reservations.modify') + '>' + ic('bed') + 'Prellenar rooming desde la reserva web</button>') : '';
    const all = roomingsOf(res.id);
    if (all.length > 1 || (!rl && legsPend.length)) {
      b.innerHTML = preHtml + (all.length ? '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Ciudad / hotel</th><th>Fechas</th><th class="num">Hab.</th><th>Distribución</th><th>Estado</th><th></th></tr></thead><tbody>' + all.map(x => { const v = validateRooming(x); return '<tr><td><div class="cell-main">' + esc(x.city || '') + (x.city ? ' · ' : '') + esc(rlHotelName(x)) + '</div></td><td class="nowrap">' + dateShort(x.checkIn) + ' → ' + dateShort(x.checkOut) + '</td><td class="num">' + x.rooms.length + '</td><td class="small">' + x.rooms.map(r => '<b>' + esc(r.room) + '</b> ' + r.pax.map(n => esc(n.split(' ')[0])).join(', ')).join(' · ') + '</td><td>' + (v.bad.length ? UI.badge('rechazado', v.bad.length + ' conflicto(s)') : UI.badge(rlStatus(x) === 'borrador' ? 'borrador' : 'ok', { borrador: 'Borrador', enviado: 'Enviada', confirmada: 'Confirmada', modificada: 'Modificada' }[rlStatus(x)] || rlStatus(x))) + '</td><td><a class="btn xs" href="#/operaciones/rooming/' + esc(rlKey(x)) + '">' + ic('edit') + 'Gestionar</a></td></tr>'; }).join('') + '</tbody></table></div>' : '');
      const pb = b.querySelector('#rm-pre'); if (pb) pb.onclick = () => prefillRooming(res); return;
    }
    if (!rl) { b.innerHTML = UI.empty('Esta reserva no tiene rooming list.', 'bed') + '<div class="center"><a class="btn" href="#/operaciones/rooming">' + ic('bed') + 'Ir a rooming list</a></div>'; return; }
    const v = validateRooming(rl);
    b.innerHTML = preHtml + '<div class="row between" style="margin-bottom:10px"><div class="small">' + rlHotelLink(rl) + ' · ' + date(rl.checkIn) + ' → ' + date(rl.checkOut) + ' · ' + UI.badge(rlStatus(rl) === 'modificada' ? 'pendiente' : rlStatus(rl), { enviado: 'Enviada al hotel', modificada: 'Modificada (reenviar)', borrador: 'Borrador', confirmada: 'Confirmada' }[rlStatus(rl)]) + '</div><a class="btn sm" href="#/operaciones/rooming/' + esc(rlKey(rl)) + '">' + ic('edit') + 'Gestionar rooming</a></div>' +
      (v.bad.length ? UI.alert('bad', v.bad.join('<br>')) : '') + (v.warn.length ? UI.alert('warn', v.warn.join('<br>')) : '') +
      '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Hab.</th><th>Tipo</th><th>Pasajeros</th><th>Estado</th></tr></thead><tbody>' + rl.rooms.map(r => '<tr><td class="mono">' + esc(r.room) + '</td><td>' + esc(r.type) + '</td><td class="small">' + r.pax.map(esc).join(', ') + '</td><td>' + roomBadge(r.status) + roomInc(rl, r) + '</td></tr>').join('') + '</tbody></table></div>';
    const pb = b.querySelector('#rm-pre'); if (pb) pb.onclick = () => prefillRooming(res);
  }
  const roomBadge = (st) => st === 'observada' ? UI.badge('observado', 'Observada') : st === 'confirmada' ? UI.badge('confirmada') : UI.badge(st);
  function roomInc(rl, r) { const inc = DB.incidents.find(i => i.resId === rl.resId && new RegExp('hab\\.?\\s*' + r.room + '\\b', 'i').test(i.title + ' ' + i.desc)); return inc ? ' <a class="xs mono" href="#/operaciones/incidencias/' + inc.id + '">' + inc.id + '</a>' : ''; }

  /* ---- Pestaña: Vouchers ---- */
  function tabVouchers(b, op, res) {
    const vs = DB.vouchers.filter(v => v.resId === res.id);
    const conf = res.services.filter(s => ['confirmado', 'completado'].includes(s.status) && s.providerId && !vs.some(v => v.serviceId === s.id && v.status !== 'anulado'));
    b.innerHTML = '<div class="row between" style="margin-bottom:10px"><div class="small muted">Vouchers de la reserva. Solo servicios confirmados o autorizados pueden emitir voucher (PROC-035 · Regla transversal 11). ' + (conf.length ? '<b class="warn">' + conf.length + ' servicio(s) confirmado(s) sin voucher.</b>' : '') + '</div><button class="btn primary sm" id="v-emit"' + dis('operations.vouchers') + '>' + ic('ticket') + 'Emitir voucher</button></div>' +
      (vs.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Voucher</th><th>Servicio</th><th>Proveedor</th><th>Fecha</th><th class="num">Pax</th><th>Versión</th><th>Estado</th></tr></thead><tbody>' + vs.map(v => '<tr class="click" data-v="' + v.id + '"><td>' + vouLink(v.id) + '</td><td class="cell-main">' + esc(v.service) + '</td><td>' + provLink(v.providerId) + '</td><td>' + date(v.date) + '</td><td class="num">' + v.pax + '</td><td>v' + v.version + '</td><td>' + UI.badge(v.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin vouchers emitidos para esta reserva.', 'ticket'));
    b.querySelector('#v-emit').onclick = () => emitVoucher(res.id);
    b.querySelectorAll('[data-v]').forEach(tr => tr.onclick = (e) => { if (e.target.closest('a')) return; App.go('#/operaciones/vouchers/' + tr.dataset.v); });
  }

  /* ---- Pestaña: Incidencias ---- */
  function tabIncidents(b, op, incs) {
    b.innerHTML = '<div class="row between" style="margin-bottom:10px"><div class="small muted">Incidencias vinculadas a la orden (PROC-037). Las críticas generan alerta a gerencia y no se cierran sin resolución y evidencia.</div><button class="btn primary sm" id="i-new"' + dis('operations.incidents') + '>' + ic('plus') + 'Nueva incidencia</button></div>' +
      (incs.length ? '<div class="list" style="border:1px solid var(--line-2);border-radius:9px">' + incs.map(i => '<a class="list-item click" href="#/operaciones/incidencias/' + i.id + '" style="color:inherit;text-decoration:none"><div class="ico-box ' + sevTone(i.severity) + '">' + ic('alert') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:600">' + esc(i.title) + '</div><div class="xs faint">' + i.id + ' · ' + esc(i.type) + ' · ' + datetime(i.createdAt) + ' · ' + esc(Q.userName(i.assignee)) + '</div></div>' + UI.badge(i.severity) + ' ' + UI.badge(i.status) + '</a>').join('') + '</div>' : UI.empty('Sin incidencias registradas.', 'checkCircle'));
    b.querySelector('#i-new').onclick = () => newIncidentModal({ opId: op.id });
  }
  const sevTone = (s) => s === 'critica' ? 'bad' : s === 'alta' ? 'warn' : s === 'media' ? 'info' : '';

  /* ---- Pestaña: Evidencias (PROC-038) ---- */
  function tabEvidence(b, op, res, incs) {
    const ev = evList(op);
    const incEv = incs.flatMap(i => (i.evidence || []).map(n => ({ name: n, inc: i })));
    const opts = res.services.filter(s => s.status !== 'cancelado').map(s => [s.id, dateShort(s.date) + ' · ' + s.name]);
    b.innerHTML = '<div class="grid g-2-1"><div><div class="row between" style="margin-bottom:10px"><b class="small">Evidencias de la operación (' + ev.length + ')</b><span class="xs faint">Captura → Validación → Compresión → Upload → Asociación → Auditoría</span></div>' +
      (ev.length ? '<div class="ev-grid">' + ev.map((e, i) => '<div class="ev-card"><div class="ev-img">' + ic(/\.pdf$/i.test(e.name) ? 'file' : 'image') + '</div><div class="ev-b"><div class="small mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(e.name) + '">' + esc(e.name) + '</div><div class="xs faint">' + esc(e.serviceId ? ((svcOf(res, e.serviceId) || {}).name || e.serviceId) : 'General') + '</div><div class="xs faint">' + datetime(e.ts) + ' · ' + esc(e.source || 'Web') + '</div><button class="btn xs ghost" data-rm="' + i + '"' + dis('operations.assign') + ' style="justify-self:start;margin-top:3px">' + ic('trash') + 'Quitar</button></div></div>').join('') + '</div>' : UI.empty('Aún no hay evidencias registradas.', 'camera')) +
      (incEv.length ? '<div class="upper" style="margin:16px 0 8px">Evidencias de incidencias</div><div class="chip-row">' + incEv.map(e => '<a class="tag" href="#/operaciones/incidencias/' + e.inc.id + '">' + ic('file') + esc(e.name) + ' · ' + e.inc.id + '</a>').join('') + '</div>' : '') + '</div>' +
      '<div>' + UI.card('Registrar evidencia', UI.form([
        { id: 'ev_svc', label: 'Servicio asociado', type: 'select', options: opts, placeholder: 'General (sin servicio)', col: 12 },
        { type: 'html', col: 12, html: '<div class="field"><label for="ev_file">Archivo(s) <span class="req">*</span></label><input class="input" type="file" id="ev_file" multiple accept="image/*,application/pdf" style="padding:6px"></div>' }
      ]) + '<p class="xs faint" style="margin-top:8px">En la demo solo se registra el nombre del archivo. En producción se valida tipo/tamaño, se comprime y se sube a almacenamiento seguro con hash.</p>', { footer: '<button class="btn primary sm" id="ev-up"' + dis('operations.assign') + '>' + ic('upload') + 'Registrar</button>' }) + '</div></div>';
    b.querySelector('#ev-up').onclick = () => {
      if (!guard('operations.assign')) return;
      const inp = b.querySelector('#ev_file'); const files = [...(inp.files || [])];
      if (!files.length) { UI.toast('Seleccione al menos un archivo.', 'warn'); return; }
      const svc = b.querySelector('#ev_svc').value;
      files.forEach(f => ev.push({ name: f.name, serviceId: svc || null, ts: nowStr(), user: Auth.user.name, source: 'Web' }));
      Audit.log('Evidencia', op.id, 'upload', '', files.map(f => f.name).join(', '));
      Store.save(); UI.toast(files.length + ' evidencia(s) registrada(s).'); rerender();
    };
    b.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { if (!guard('operations.assign')) return; const e = ev[+x.dataset.rm]; UI.confirm({ title: 'Quitar evidencia', message: 'La evidencia «' + esc(e.name) + '» se marcará como retirada (eliminación lógica, queda en auditoría).', reason: true, danger: true, confirmLabel: 'Quitar', onConfirm: (r) => { ev.splice(+x.dataset.rm, 1); Audit.log('Evidencia', op.id, 'retirar', e.name, r); Store.save(); rerender(); } }); });
  }

  /* ---- Pestaña: Cierre (PROC-039) ---- */
  function closeChecks(op, res, incs) {
    const svcs = res.services.filter(s => s.status !== 'cancelado' && s.providerId);
    const pendSvc = svcs.filter(s => s.status !== 'completado');
    const openI = incs.filter(isOpenInc);
    const ev = evList(op);
    const critNoEv = incs.filter(i => ['critica', 'alta'].includes(i.severity) && !(i.evidence || []).length);
    const noCost = svcs.filter(s => !(s.cost > 0));
    const payables = DB.payables.filter(p => p.resId === res.id);
    return [
      { ok: !pendSvc.length, t: 'Servicios obligatorios completados', d: pendSvc.length ? pendSvc.length + ' servicio(s) sin completar: ' + pendSvc.map(s => esc(s.name) + ' (' + UI.statusLabel(s.status) + ')').join(', ') : 'Los ' + svcs.length + ' servicios con proveedor están completados.' },
      { ok: !openI.length, t: 'Incidencias gestionadas', d: openI.length ? openI.map(i => incLink(i.id) + ' ' + esc(i.title) + ' (' + UI.statusLabel(i.status) + ')').join('<br>') : incs.length + ' incidencia(s), todas resueltas o cerradas.' },
      { ok: ev.length > 0 && !critNoEv.length, t: 'Evidencias requeridas', d: !ev.length ? 'La operación no tiene evidencias registradas.' : critNoEv.length ? 'Incidencias alta/crítica sin evidencia: ' + critNoEv.map(i => incLink(i.id)).join(', ') : ev.length + ' evidencia(s) registrada(s).' },
      { ok: !noCost.length, t: 'Costos disponibles', d: noCost.length ? noCost.length + ' servicio(s) sin costo registrado.' : 'Costo total ' + money(sum(svcs, 'cost'), res.currency) + ' · ' + payables.length + ' cuenta(s) por pagar vinculada(s).' }
    ];
  }
  function tabClose(b, op, res, incs) {
    const checks = closeChecks(op, res, incs);
    const ok = checks.every(c => c.ok);
    const done = op.status === 'completada';
    const tasksPend = op.tasks.filter(t => !t.done).length;
    b.innerHTML = '<div class="grid g-2-1"><div>' + (done ? UI.alert('ok', '<b>Operación cerrada</b> el ' + datetime(op.closedAt || op.dateTo) + (op.closedBy ? ' por ' + esc(Q.userName(op.closedBy)) : '') + '. La reserva quedó en estado completada.') : '') +
      '<div class="upper" style="margin:6px 0 4px">Precondiciones de cierre (PROC-039)</div>' +
      checks.map(c => '<div class="chk-row"><div class="chk-ic ' + (c.ok ? 'ok' : 'bad') + '">' + ic(c.ok ? 'check' : 'x') + '</div><div class="grow"><div class="small" style="font-weight:600">' + c.t + '</div><div class="xs muted">' + c.d + '</div></div>' + UI.badge(c.ok ? 'ok' : 'pendiente', c.ok ? 'Cumple' : 'Pendiente') + '</div>').join('') +
      '<div class="chk-row"><div class="chk-ic ' + (tasksPend ? 'warn' : 'ok') + '">' + ic(tasksPend ? 'alert' : 'check') + '</div><div class="grow"><div class="small" style="font-weight:600">Checklist de tareas (no bloqueante)</div><div class="xs muted">' + (tasksPend ? tasksPend + ' tarea(s) pendiente(s).' : 'Todas las tareas completadas.') + '</div></div></div></div>' +
      '<div>' + UI.card('Cerrar operación', '<p class="small muted">Al cerrar: la orden pasa a <b>Completada</b>, la reserva a <b>Completada</b>, se notifica al equipo y queda registro en auditoría. Los costos pasan a liquidación y rentabilidad.</p>' + (!Auth.can('operations.close') ? '<div style="margin-top:10px">' + UI.alert('warn', 'Su rol no tiene el permiso operations.close.') + '</div>' : '') + (!ok && !done ? '<div style="margin-top:10px">' + UI.alert('bad', 'No se cumplen todas las precondiciones. El botón se habilita cuando las 4 estén en verde.') + '</div>' : ''), { footer: '<button class="btn primary" id="op-close"' + (ok && !done && Auth.can('operations.close') ? '' : ' disabled') + '>' + ic('lock') + (done ? 'Operación cerrada' : 'Cerrar operación') + '</button>' }) +
      '<div style="margin-top:14px">' + (canMargin() ? UI.card('Resumen económico', '<div class="stat-line"><span>Venta de servicios</span><b>' + money(sum(res.services.filter(s => s.status !== 'cancelado'), 'price'), res.currency) + '</b></div><div class="stat-line"><span>Costo de proveedores</span><b>' + money(Q.resCost(res), res.currency) + '</b></div><div class="stat-line total"><span>Margen bruto</span><b>' + money(sum(res.services.filter(s => s.status !== 'cancelado'), 'price') - Q.resCost(res), res.currency) + '</b></div>' + (Access.canRoute('finanzas/rentabilidad') ? '<a class="btn sm ghost" href="#/finanzas/rentabilidad" style="margin-top:8px">Ver rentabilidad ' + ic('arrowRight') + '</a>' : '')) :
        UI.card('Costos de proveedores', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Servicio</th><th>Proveedor</th><th class="num">Costo</th></tr></thead><tbody>' + res.services.filter(s => s.status !== 'cancelado' && s.providerId).map(s => '<tr><td class="small">' + esc(s.name) + '</td><td class="small">' + esc(Q.providerName(s.providerId)) + '</td><td class="num">' + (s.cost > 0 ? money(s.cost, res.currency) : '<span class="bad xs">Sin costo</span>') + '</td></tr>').join('') + '</tbody></table></div><div class="stat-line total" style="padding:10px 14px"><span>Total costo proveedores</span><b>' + money(Q.resCost(res), res.currency) + '</b></div><div class="xs faint" style="padding:0 14px 12px">Precios de venta y márgenes visibles solo para Gerencia y Finanzas (finance.profitability).</div>', { tight: true })) + '</div></div></div>';
    const cb = b.querySelector('#op-close');
    if (cb) cb.onclick = () => {
      if (!guard('operations.close')) return;
      if (!closeChecks(op, res, incs).every(c => c.ok)) { UI.toast('PROC-039: no se cumplen las precondiciones de cierre.', 'bad'); return; }
      UI.confirm({ title: 'Cerrar operación ' + op.id, message: 'Se cerrará la operación y la reserva <b>' + esc(res.id) + '</b> pasará a <b>Completada</b>. Esta acción queda auditada.', confirmLabel: 'Cerrar operación', onConfirm: () => {
        const b1 = op.status, b2 = res.status;
        op.status = 'completada'; op.closedAt = nowStr(); op.closedBy = Auth.user.id; res.status = 'completada';
        Audit.log('Orden operativa', op.id, 'cierre', b1, 'completada'); Audit.log('Reserva', res.id, 'cambio_estado', b2, 'completada');
        Notify.push('operacion.cerrada', 'Email', (Q.user(op.coordinator) || {}).email, 'Operación ' + op.id + ' cerrada');
        Notify.push('operacion.cerrada', 'Portal', res.clientId, 'Su viaje ' + res.title + ' ha finalizado. Cuéntenos su experiencia.');
        Store.save(); UI.toast('Operación cerrada. Reserva completada.'); rerender();
      } });
    };
  }

  /* ======================================================================
     CALENDARIO OPERATIVO
     ====================================================================== */
  const cal = { anchor: '2026-10-01', view: 'mes', type: '' };
  function calEvents() {
    const ev = [];
    DB.reservations.filter(r => r.status !== 'cancelada').forEach(r => r.services.filter(s => s.status !== 'cancelado').forEach(s => {
      const k = svcClass(s); const op = opOfRes(r.id); const a = op && (op.assignments || []).find(x => x.serviceId === s.id);
      ev.push({ kind: 'svc', cls: k, date: s.date, time: s.time, title: s.name, res: r, s, op, a, pend: ['pendiente', 'solicitado'].includes(s.status) || (a && a.status === 'pendiente') });
    }));
    DB.products.forEach(p => (p.departures || []).forEach(d => ev.push({ kind: 'dep', cls: 'salida', date: d.date, time: d.time, title: 'Salida ' + p.name, p, d, pend: !d.guideId || !d.vehicleId })));
    return ev.filter(e => !cal.type || e.cls === cal.type).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }
  const evChip = (e, i) => '<div class="cal-ev ' + CLS_COLOR[e.cls] + (e.pend ? ' pend' : '') + '" data-ev="' + i + '" title="' + esc(e.time + ' ' + e.title) + '">' + esc(e.time !== '—' ? e.time + ' ' : '') + esc(e.title) + '</div>';
  function evDrawer(e) {
    if (e.kind === 'dep') {
      const pct = e.d.sold / e.d.capacity * 100;
      UI.drawer({ title: esc(e.p.name), sub: 'Salida programada ' + e.d.id + ' · ' + date(e.d.date) + ' ' + e.d.time, body: UI.dl([['Producto', prodLink(e.p.id)], ['Salida', '<span class="mono">' + e.d.id + '</span> ' + UI.badge(e.d.status)], ['Ocupación', e.d.sold + ' / ' + e.d.capacity + ' cupos' + UI.progress(pct, pct >= 100 ? 'sun' : 'ok')], ['Guía', e.d.guideId ? esc(gName(e.d.guideId)) : '<span class="warn">Sin guía</span>'], ['Vehículo', e.d.vehicleId ? esc(vLabel(e.d.vehicleId)) : '<span class="warn">Sin vehículo</span>'], ['Punto de encuentro', esc(e.d.meeting)], ['Retorno', esc(e.d.ret)]]) + '<div style="margin-top:14px">' + UI.alert('info', 'Las salidas se gestionan desde Catálogo › Salidas y disponibilidad (PROC-020).') + '</div>', actions: (Access.canRoute('catalogo/salidas') ? [{ label: 'Abrir salidas', cls: 'primary', onClick: () => App.go('#/catalogo/salidas') }] : []).concat([{ label: 'Cerrar' }]) });
      return;
    }
    const { s, res, op, a } = e;
    UI.drawer({ title: esc(s.name), sub: date(s.date) + ' · ' + esc(s.time) + ' · ' + CLS_LABEL[e.cls],
      body: UI.dl([['Estado', UI.badge(s.status)], ['Reserva', resLink(res.id) + ' · ' + esc(res.title)], ['Cliente', cliLink(res.clientId)], ['Pasajeros', res.passengers.length + ''], ['Proveedor', provLink(s.providerId)], ['Producto', prodLink(s.productId)], ['Código conf.', s.confirmationCode ? '<span class="mono">' + esc(s.confirmationCode) + '</span>' : '—'], ['Orden operativa', op ? opLink(op.id) + ' ' + UI.badge(op.status) : '<span class="faint">Sin orden</span>']]) +
        (a ? '<div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:8px">Asignación</div>' + UI.dl([['Estado', UI.badge(a.status)], ['Guía', esc(gName(a.guideId)) || '—'], ['Conductor', esc(dName(a.driverId)) || '—'], ['Vehículo', esc(vLabel(a.vehicleId)) || '—'], ['Check-in', a.checkin ? datetime(a.checkin) : '—']]) : ''),
      actions: [op && a && s.providerId && Auth.can('operations.assign') ? { label: 'Asignar recursos', icon: 'truck', onClick: () => { assignModal(op, a); return false; }, close: false } : null, op ? { label: 'Abrir orden 360', cls: 'primary', onClick: () => App.go('#/operaciones/ordenes/' + op.id) } : { label: 'Abrir reserva', cls: 'primary', onClick: () => App.go('#/reservas/' + res.id) }].filter(Boolean) });
  }
  function calendarView(el) {
    const events = calEvents();
    const an = parseD(cal.anchor); const y = an.getFullYear(), mo = an.getMonth();
    let body = '', label = '';
    if (cal.view === 'mes') {
      label = MESES[mo] + ' ' + y;
      const first = y + '-' + pad(mo + 1) + '-01'; const dow = (parseD(first).getDay() + 6) % 7; let d = addDays(first, -dow);
      const cells = []; do { for (let i = 0; i < 7; i++) { cells.push(d); d = addDays(d, 1); } } while (parseD(d).getMonth() === mo);
      body = '<div class="cal">' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(x => '<div class="cal-h">' + x + '</div>').join('') + cells.map(c => { const list = events.map((e, i) => [e, i]).filter(([e]) => e.date === c); const out = parseD(c).getMonth() !== mo; return '<div class="cal-d' + (out ? ' out' : '') + (c === T() ? ' today' : '') + '"><div class="row between"><span class="dn">' + parseD(c).getDate() + '</span>' + (list.length ? '<span class="xs faint">' + list.length + '</span>' : '') + '</div>' + list.slice(0, 3).map(([e, i]) => evChip(e, i)).join('') + (list.length > 3 ? '<div class="cal-more" data-day="' + c + '">+' + (list.length - 3) + ' más</div>' : '') + '</div>'; }).join('') + '</div>';
    } else if (cal.view === 'semana') {
      const dow = (an.getDay() + 6) % 7; const start = addDays(cal.anchor, -dow); const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      label = 'Semana del ' + dateShort(days[0]) + ' al ' + date(days[6]);
      body = '<div class="wk">' + days.map(dd => { const list = events.map((e, i) => [e, i]).filter(([e]) => e.date === dd); return '<div class="wk-d' + (dd === T() ? ' today' : '') + '"><div class="wk-h"><span>' + dowOf(dd) + ' ' + dateShort(dd) + '</span><span class="faint">' + list.length + '</span></div><div class="wk-b">' + (list.length ? list.map(([e, i]) => evChip(e, i)).join('') : '<span class="xs faint">Sin servicios</span>') + '</div></div>'; }).join('') + '</div>';
    } else {
      label = MESES[mo] + ' ' + y + ' · lista';
      const list = events.map((e, i) => [e, i]).filter(([e]) => parseD(e.date).getMonth() === mo && parseD(e.date).getFullYear() === y);
      body = list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Servicio</th><th>Reserva / salida</th><th>Recursos</th><th>Estado</th></tr></thead><tbody>' + list.map(([e, i]) => '<tr class="click" data-ev="' + i + '"><td class="nowrap"><b>' + dowOf(e.date) + ' ' + dateShort(e.date) + '</b> <span class="faint">' + esc(e.time) + '</span></td><td><span class="cal-ev ' + CLS_COLOR[e.cls] + '" style="display:inline-block">' + CLS_LABEL[e.cls] + '</span></td><td class="cell-main">' + esc(e.title) + '</td><td>' + (e.kind === 'dep' ? '<span class="mono small">' + e.d.id + '</span> · ' + e.d.sold + '/' + e.d.capacity : '<span class="mono small">' + esc(e.res.id) + '</span><div class="cell-sub">' + esc(Q.clientName(e.res.clientId)) + '</div>') + '</td><td class="small">' + (e.kind === 'dep' ? esc([gName(e.d.guideId), (Q.vehicle(e.d.vehicleId) || {}).plate].filter(Boolean).join(' · ') || '—') : e.a ? esc([gName(e.a.guideId), dName(e.a.driverId), (Q.vehicle(e.a.vehicleId) || {}).plate].filter(Boolean).join(' · ') || '—') : '<span class="faint">—</span>') + '</td><td>' + (e.kind === 'dep' ? UI.badge(e.d.status) : UI.badge(e.s.status)) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin servicios en el mes.', 'calendar');
    }
    const monthEv = events.filter(e => parseD(e.date).getMonth() === mo && parseD(e.date).getFullYear() === y);
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Calendario operativo', crumbs: [['Inicio', '#/dashboard'], ['Operaciones', '#/operaciones/ordenes'], ['Calendario']], subtitle: 'Todos los servicios de reservas y salidas programadas. Clic en un evento para ver el detalle, la asignación y enlaces a la orden.', actions: '<a class="btn" href="#/operaciones/asignaciones">' + ic('truck') + 'Recursos</a><a class="btn" href="#/operaciones/ordenes">' + ic('clipboard') + 'Órdenes</a>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Servicios en ' + MESES[mo].toLowerCase(), value: monthEv.filter(e => e.kind === 'svc').length, tone: 'accent', icon: 'calendar' }) + UI.kpi({ label: 'Salidas programadas', value: monthEv.filter(e => e.kind === 'dep').length, tone: 'ok', icon: 'users' }) + UI.kpi({ label: 'Pendientes (proveedor o recursos)', value: monthEv.filter(e => e.pend).length, tone: 'sun', icon: 'alert', sub: 'borde discontinuo' }) + UI.kpi({ label: 'Hoy', value: events.filter(e => e.date === T()).length, sub: date(T()), tone: 'info', icon: 'clock' }) + '</div>' +
      UI.card('<span id="cal-lbl">' + esc(label) + '</span>', '<div class="row between" style="margin-bottom:12px"><div class="row" style="gap:6px"><button class="btn sm icon" id="c-prev" aria-label="Anterior">' + ic('chevronLeft') + '</button><button class="btn sm" id="c-today">Hoy</button><button class="btn sm icon" id="c-next" aria-label="Siguiente">' + ic('chevronRight') + '</button><select class="input sm" id="c-type" style="width:auto" aria-label="Tipo"><option value="">Todos los tipos</option>' + Object.keys(CLS_LABEL).map(k => '<option value="' + k + '"' + (cal.type === k ? ' selected' : '') + '>' + CLS_LABEL[k] + '</option>').join('') + '</select></div><div class="legend">' + Object.keys(CLS_LABEL).map(k => '<span><i style="background:var(--' + ({ tour: 'accent', traslado: 'info', aloj: 'violet', tren: 'sun', salida: 'ok', libre: 'fg-3' })[k] + ')"></i>' + CLS_LABEL[k] + '</span>').join('') + '</div></div>' + body, { actions: '<div class="btn-group">' + [['mes', 'Mes'], ['semana', 'Semana'], ['lista', 'Lista']].map(v => '<button class="btn sm' + (cal.view === v[0] ? ' on' : '') + '" data-view="' + v[0] + '">' + v[1] + '</button>').join('') + '</div>' }) + '</div>';
    el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { cal.view = b.dataset.view; calendarView(el); });
    const step = (n) => { if (cal.view === 'semana') cal.anchor = addDays(cal.anchor, 7 * n); else { const d = parseD(cal.anchor); d.setDate(1); d.setMonth(d.getMonth() + n); cal.anchor = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01'; } calendarView(el); };
    el.querySelector('#c-prev').onclick = () => step(-1); el.querySelector('#c-next').onclick = () => step(1);
    el.querySelector('#c-today').onclick = () => { cal.anchor = T(); calendarView(el); };
    el.querySelector('#c-type').onchange = (e) => { cal.type = e.target.value; calendarView(el); };
    el.querySelectorAll('[data-ev]').forEach(x => x.onclick = () => evDrawer(events[+x.dataset.ev]));
    el.querySelectorAll('[data-day]').forEach(x => x.onclick = () => { const dd = x.dataset.day; const list = events.map((e, i) => [e, i]).filter(([e]) => e.date === dd); UI.drawer({ title: dowOf(dd) + ' ' + date(dd), sub: list.length + ' eventos', body: '<div class="list">' + list.map(([e, i]) => '<div class="list-item click" data-dv="' + i + '"><div class="ico-box ' + (CLS_COLOR[e.cls] || '') + '">' + ic(CLS_ICON[e.cls]) + '</div><div class="grow"><div class="small" style="font-weight:600">' + esc(e.title) + '</div><div class="xs faint">' + esc(e.time) + ' · ' + (e.kind === 'dep' ? e.d.id : esc(e.res.id)) + '</div></div>' + UI.badge(e.kind === 'dep' ? e.d.status : e.s.status) + '</div>').join('') + '</div>', onOpen: (d) => d.querySelectorAll('[data-dv]').forEach(r => r.onclick = () => evDrawer(events[+r.dataset.dv])) }); });
  }

  /* ======================================================================
     ASIGNACIONES Y RECURSOS
     ====================================================================== */
  function docAlerts() {
    const out = [];
    DB.drivers.forEach(d => { const n = daysFromToday(d.expires); if (n <= 30) out.push({ rid: d.id, tone: n < 0 ? 'bad' : n <= 10 ? 'bad' : 'warn', t: 'Licencia de ' + d.name + ' (' + d.license + ')', d: (n < 0 ? 'vencida desde el ' : 'vence el ') + date(d.expires) + (n >= 0 ? ' · en ' + n + ' días' : '') }); });
    DB.vehicles.forEach(v => { const n = daysFromToday(v.soat); if (n <= 30) out.push({ rid: v.id, tone: n <= 10 ? 'bad' : 'warn', t: 'SOAT ' + v.plate + ' (' + v.type + ')', d: (n < 0 ? 'vencido desde el ' : 'vence el ') + date(v.soat) + (n >= 0 ? ' · en ' + n + ' días' : '') }); });
    return out;
  }
  function resourceMenu(anchor, kind, r) {
    const opts = kind === 'vehicle' ? ['disponible', 'asignado', 'mantenimiento'] : ['disponible', 'asignado', 'descanso', 'vacaciones'];
    if (!Auth.can('operations.assign')) { UI.menu(anchor, [{ label: 'Ver agenda del recurso', icon: 'calendar', onClick: () => resourceDrawer(r.id) }]); return; }
    UI.menu(anchor, opts.map(s => ({ label: 'Estado: ' + UI.statusLabel(s), icon: s === r.status ? 'check' : 'info', onClick: () => { if (!guard('operations.assign')) return; const b = r.status; r.status = s; Audit.log('Recurso', r.id, 'cambio_estado', b, s); Store.save(); UI.toast(esc(r.name || r.plate) + ': ' + UI.statusLabel(s)); rerender(); } })).concat(['-', { label: 'Ver agenda del recurso', icon: 'calendar', onClick: () => resourceDrawer(r.id) }]));
  }
  function resourceDrawer(rid) {
    const r = Q.guide(rid) || Q.driver(rid) || Q.vehicle(rid);
    const occ = occupations().filter(o => o.rid === rid && o.date >= T()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const info = Q.guide(rid) ? [['Idiomas', r.languages.join(', ')], ['Carné', r.license], ['Calificación', fmtN(r.rating, 1) + ' / 5'], ['Teléfono', r.phone]] : Q.driver(rid) ? [['Licencia', r.license], ['Vence', date(r.expires) + (daysFromToday(r.expires) <= 30 ? ' ' + UI.badge('alta', 'Por vencer') : '')], ['Teléfono', r.phone]] : [['Tipo', r.type], ['Capacidad', r.capacity + ' asientos'], ['SOAT vence', date(r.soat) + (daysFromToday(r.soat) <= 30 ? ' ' + UI.badge('alta', 'Por vencer') : '')], ['Proveedor', provLink(r.providerId)]];
    UI.drawer({ title: esc(r.name || r.plate), sub: 'Recurso ' + rid + ' · ' + UI.statusLabel(r.status), body: UI.dl([['Estado', UI.badge(r.status)]].concat(info)) + '<div class="divider" style="margin:14px 0"></div><div class="upper" style="margin-bottom:8px">Agenda desde hoy (' + occ.length + ')</div>' + (occ.length ? '<div class="list">' + occ.map(o => '<div class="list-item" style="padding:9px 0"><div class="ico-box ' + (o.dep ? 'ok' : '') + '">' + ic(o.dep ? 'users' : 'clipboard') + '</div><div class="grow"><div class="small" style="font-weight:600">' + esc(o.label) + '</div><div class="xs faint">' + dowOf(o.date) + ' ' + date(o.date) + ' · ' + esc(o.time) + ' · ' + (o.dep ? esc(o.ref) : opLink(o.ref)) + '</div></div></div>').join('') + '</div>' : UI.empty('Sin servicios próximos', 'calendar')) });
  }
  function assignBoard(el) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(T(), i));
    const occ = occupations();
    const alerts = docAlerts();
    const pend = allAssign().filter(({ op, a }) => op.status !== 'completada' && a.status !== 'completada' && (!a.guideId || !a.driverId || !a.vehicleId) && a.date >= T()).sort((x, y) => (x.a.date + x.a.time).localeCompare(y.a.date + y.a.time));
    const rows = [['Guías', DB.guides.map(g => ({ r: g, kind: 'guide', name: g.name, sub: g.languages.join(' · ') + ' · ' + g.license }))], ['Conductores', DB.drivers.map(d => ({ r: d, kind: 'driver', name: d.name, sub: d.license }))], ['Vehículos', DB.vehicles.map(v => ({ r: v, kind: 'vehicle', name: v.plate + ' · ' + v.type, sub: v.capacity + ' asientos · SOAT ' + dateShort(v.soat) }))]];
    const cell = (x, d) => {
      const r = x.r;
      if (['vacaciones', 'mantenimiento'].includes(r.status)) return '<span class="av-chip off">' + UI.statusLabel(r.status) + '</span>';
      const docExp = x.kind === 'driver' ? r.expires : x.kind === 'vehicle' ? r.soat : null;
      let h = docExp && docExp < d ? '<span class="av-chip bad">' + (x.kind === 'driver' ? 'Licencia vencida' : 'SOAT vencido') + '</span>' : docExp === d ? '<span class="av-chip bad">' + (x.kind === 'driver' ? 'Licencia' : 'SOAT') + ' vence hoy</span>' : '';
      const list = occ.filter(o => o.rid === r.id && o.date === d);
      const dedup = list.filter(o => !o.dep || !list.some(z => !z.dep && z.time === o.time));
      h += dedup.map(o => '<span class="av-chip' + (o.dep ? ' dep' : '') + (o.done ? ' done' : '') + '" title="' + esc(o.time + ' ' + o.label + ' (' + o.ref + ')') + '">' + esc(o.time) + ' ' + esc(o.label) + '</span>').join('');
      if (r.status === 'descanso' && !dedup.length) h += '<span class="av-chip off">Descanso</span>';
      return h || '<span class="av-free">Libre</span>';
    };
    const rCard = (title, list, kind) => UI.card(title, '<div class="list">' + list.map(x => { const r = x; const extra = kind === 'guide' ? '<div class="chip-row" style="margin-top:3px">' + r.languages.map(l => '<span class="tag">' + l + '</span>').join('') + '<span class="tag">' + ic('star') + fmtN(r.rating, 1) + '</span></div>' : kind === 'driver' ? '<div class="xs ' + (daysFromToday(r.expires) <= 30 ? 'bad' : 'faint') + '">Licencia ' + esc(r.license) + ' · vence ' + date(r.expires) + '</div>' : '<div class="xs ' + (daysFromToday(r.soat) <= 30 ? 'bad' : 'faint') + '">' + r.capacity + ' asientos · SOAT vence ' + date(r.soat) + '</div>'; const occN = occ.filter(o => o.rid === r.id && o.date >= T() && o.date <= days[6]).length; return '<div class="list-item"><div class="grow" style="min-width:0"><div class="small click" style="font-weight:600;cursor:pointer" data-rd="' + r.id + '">' + esc(r.name || r.plate + ' · ' + r.type) + '</div>' + extra + '<div class="xs faint">' + occN + ' servicio(s) en 7 días</div></div>' + UI.badge(r.status) + '<button class="btn xs icon ghost" data-rm="' + kind + ':' + r.id + '" aria-label="Opciones">' + ic('more') + '</button></div>'; }).join('') + '</div>', { tight: true });
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Asignaciones y recursos', crumbs: [['Inicio', '#/dashboard'], ['Operaciones', '#/operaciones/ordenes'], ['Asignaciones y recursos']], subtitle: 'Guías, conductores y vehículos con estado, idiomas y vigencia documentaria. Disponibilidad de los próximos 7 días y asignación rápida con validación de conflictos (PROC-033).', actions: '<a class="btn" href="#/operaciones/calendario">' + ic('calendar') + 'Calendario</a>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Guías disponibles', value: DB.guides.filter(g => g.status === 'disponible').length + ' / ' + DB.guides.length, tone: 'accent', icon: 'users' }) + UI.kpi({ label: 'Conductores disponibles', value: DB.drivers.filter(g => g.status === 'disponible').length + ' / ' + DB.drivers.length, tone: 'info', icon: 'user' }) + UI.kpi({ label: 'Vehículos operativos', value: DB.vehicles.filter(v => v.status !== 'mantenimiento').length + ' / ' + DB.vehicles.length, tone: 'violet', icon: 'truck' }) + UI.kpi({ label: 'Alertas documentarias', value: alerts.length, sub: 'licencias y SOAT ≤ 30 días', tone: alerts.length ? 'bad' : 'ok', icon: 'shield' }) + '</div>' +
      (alerts.length ? UI.alert('warn', '<b>Vencimientos próximos:</b><ul class="val-list">' + alerts.map(a => '<li><b>' + esc(a.t) + '</b> ' + a.d + '. La asignación se bloquea para servicios posteriores al vencimiento.</li>').join('') + '</ul>') : '') +
      '<div class="grid g3">' + rCard('Guías', DB.guides, 'guide') + rCard('Conductores', DB.drivers, 'driver') + rCard('Vehículos', DB.vehicles, 'vehicle') + '</div>' +
      UI.card('Disponibilidad — próximos 7 días', '<div class="tbl-wrap"><table class="tbl compact av-tbl"><thead><tr><th>Recurso</th>' + days.map(d => '<th>' + dowOf(d) + ' ' + dateShort(d) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(([g, list]) => '<tr><td colspan="8" style="background:var(--surface-2)" class="upper">' + g + '</td></tr>' + list.map(x => '<tr><td><div class="small" style="font-weight:600">' + esc(x.name) + '</div><div class="xs faint">' + esc(x.sub) + '</div></td>' + days.map(d => '<td>' + cell(x, d) + '</td>').join('') + '</tr>').join('')).join('') + '</tbody></table></div>', { tight: true, sub: 'Ocupación por órdenes operativas (turquesa) y salidas programadas (verde)', actions: '<div class="legend"><span><i style="background:var(--accent)"></i>Orden</span><span><i style="background:var(--ok)"></i>Salida</span><span><i style="background:var(--bad)"></i>Documento vencido</span></div>' }) +
      UI.card('Asignación rápida — servicios con recursos incompletos (' + pend.length + ')', pend.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Servicio</th><th>Orden</th><th class="num">Pax</th><th>Guía</th><th>Conductor</th><th>Vehículo</th><th></th></tr></thead><tbody>' + pend.map(({ op, a }, i) => '<tr><td class="nowrap"><b>' + dateShort(a.date) + '</b> <span class="faint">' + esc(a.time) + '</span></td><td class="cell-main">' + esc(a.service) + '</td><td>' + opLink(op.id) + '</td><td class="num">' + resOf(op).passengers.length + '</td><td class="small">' + (esc(gName(a.guideId)) || '<span class="warn xs">—</span>') + '</td><td class="small">' + (esc(dName(a.driverId)) || '<span class="warn xs">—</span>') + '</td><td class="small mono">' + (esc((Q.vehicle(a.vehicleId) || {}).plate || '') || '<span class="warn xs">—</span>') + '</td><td class="right"><button class="btn xs primary" data-qa="' + i + '"' + dis('operations.assign') + '>' + ic('truck') + 'Asignar</button></td></tr>').join('') + '</tbody></table></div>' : UI.empty('Todos los servicios próximos tienen recursos completos.', 'checkCircle'), { tight: true }) + '</div>';
    el.querySelectorAll('[data-qa]').forEach(b => b.onclick = () => { const { op, a } = pend[+b.dataset.qa]; assignModal(op, a); });
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.rm.split(':'); resourceMenu(b, k, Q.guide(id) || Q.driver(id) || Q.vehicle(id)); });
    el.querySelectorAll('[data-rd]').forEach(b => b.onclick = () => resourceDrawer(b.dataset.rd));
  }

  /* ======================================================================
     ROOMING LIST (PROC-034)
     ====================================================================== */
  const ROOM_TYPES = { 'Simple': 1, 'Doble': 2, 'Doble twin': 2, 'Matrimonial': 2, 'Triple': 3, 'Junior suite': 2 };
  function validateRooming(rl, rooms) {
    rooms = rooms || rl.rooms;
    const bad = [], warn = [];
    const res = Q.reservation(rl.resId) || { passengers: [] };
    const seen = {};
    rooms.forEach(r => r.pax.forEach(p => { (seen[p] = seen[p] || []).push(r.room); }));
    Object.keys(seen).forEach(p => { if (seen[p].length > 1) bad.push('<b>' + esc(p) + '</b> figura en ' + seen[p].length + ' habitaciones (' + seen[p].join(', ') + ') en el mismo intervalo. Regla transversal 13: rooming sin conflictos.'); });
    const infSet = new Set(res.passengers.filter(p => p.type === 'INF').map(p => p.name)); const occ = (r) => r.pax.filter(p => !infSet.has(p)).length;
    rooms.forEach(r => { const cap = ROOM_TYPES[r.type] || 2; if (occ(r) > cap) bad.push('Habitación ' + esc(r.room) + ' (' + esc(r.type) + '): ' + occ(r) + ' pasajeros exceden la capacidad (' + cap + ').'); if (!r.pax.length) warn.push('Habitación ' + esc(r.room) + ' sin pasajeros asignados.'); });
    const nums = {}; rooms.forEach(r => { nums[r.room] = (nums[r.room] || 0) + 1; }); Object.keys(nums).forEach(n => { if (nums[n] > 1) bad.push('El número de habitación ' + esc(n) + ' está duplicado.'); });
    DB.rooming.filter(o => o !== rl && (o.hotel || o.hotelName) === (rl.hotel || rl.hotelName) && o.checkIn < rl.checkOut && rl.checkIn < o.checkOut).forEach(o => o.rooms.forEach(r2 => { if (rooms.some(r => r.room === r2.room)) bad.push('La habitación ' + esc(r2.room) + ' ya está asignada a la reserva ' + esc(o.resId) + ' en fechas superpuestas.'); r2.pax.forEach(p => { if (seen[p]) bad.push(esc(p) + ' también está alojado en la rooming list de ' + esc(o.resId) + ' en fechas superpuestas.'); }); }));
    const unassigned = res.passengers.filter(p => !seen[p.name]);
    if (unassigned.length) warn.push(unassigned.length + ' pasajero(s) sin habitación: ' + unassigned.map(p => esc(p.name)).join(', ') + '.');
    rooms.filter(r => r.status === 'observada').forEach(r => { warn.push('Habitación ' + esc(r.room) + ' observada por el hotel' + (roomInc(rl, r) ? ' — incidencia' + roomInc(rl, r) : '') + '.'); });
    return { bad, warn };
  }
  function roomingDoc(rl) {
    const res = Q.reservation(rl.resId); const h = Q.provider(rl.hotel);
    return '<div class="doc"><div class="doc-head"><div><h2>' + esc(DB.tenant.name) + '</h2><div class="muted">RUC ' + DB.tenant.ruc + ' · ' + esc((Q.sede('SED-02') || {}).address || '') + '</div></div><div style="text-align:right"><h3>ROOMING LIST</h3><div class="muted">Reserva ' + esc(rl.resId) + '</div><div class="muted">Emitida ' + datetime(nowStr()) + '</div></div></div><p><b>Hotel:</b> ' + esc(h ? h.name : rlHotelName(rl)) + (rl.city ? ' (' + esc(rl.city) + ')' : '') + ' · <b>Check-in:</b> ' + date(rl.checkIn) + ' · <b>Check-out:</b> ' + date(rl.checkOut) + ' · <b>Grupo:</b> ' + esc(res ? res.title : '') + '</p><table><thead><tr><th>Hab.</th><th>Tipo</th><th>Pasajeros</th><th>Documento</th><th>Observaciones</th></tr></thead><tbody>' + rl.rooms.map(r => '<tr><td>' + esc(r.room) + '</td><td>' + esc(r.type) + '</td><td>' + r.pax.map(esc).join('<br>') + '</td><td>' + r.pax.map(p => esc(((res && res.passengers.find(x => x.name === p)) || {}).doc || '')).join('<br>') + '</td><td>' + r.pax.map(p => esc(((res && res.passengers.find(x => x.name === p)) || {}).diet || '')).filter(Boolean).join(', ') + (r.status === 'observada' ? ' Observada por el hotel' : '') + '</td></tr>').join('') + '</tbody></table><p class="muted" style="margin-top:12px">Total: ' + rl.rooms.length + ' habitaciones · ' + sum(rl.rooms, r => r.pax.length) + ' pasajeros. Contacto operaciones 24/7: ' + EMERGENCY + '.</p></div>';
  }
  function roomModal(rl, idx) {
    const res = Q.reservation(rl.resId) || { passengers: [] };
    const r = idx != null ? rl.rooms[idx] : { room: '', type: 'Doble twin', pax: [], status: 'confirmada' };
    const where = (p) => { const x = rl.rooms.find((z, i) => i !== idx && z.pax.includes(p)); return x ? x.room : ''; };
    UI.modal({ title: idx != null ? 'Editar habitación ' + esc(r.room) : 'Agregar habitación', size: 'lg', sub: 'Distribución de pasajeros · validación de conflictos (PROC-034)',
      body: UI.form([{ id: 'room', label: 'Número de habitación', required: true, value: r.room, col: 4 }, { id: 'type', label: 'Tipo', type: 'select', options: Object.keys(ROOM_TYPES).map(t => [t, t + ' (máx. ' + ROOM_TYPES[t] + ')']), value: r.type, col: 4 }, { id: 'status', label: 'Estado', type: 'select', options: [['confirmada', 'Confirmada'], ['pendiente', 'Pendiente'], ['observada', 'Observada']], value: r.status, col: 4 }, { type: 'section', label: 'Pasajeros en la habitación' }]) +
        '<div class="pax-pick">' + res.passengers.map(p => { const w = where(p.name); return '<label class="check"><input type="checkbox" name="px" value="' + esc(p.name) + '"' + (r.pax.includes(p.name) ? ' checked' : '') + '> <span>' + esc(p.name) + (w ? ' <span class="xs warn">(en ' + esc(w) + ')</span>' : '') + '</span></label>'; }).join('') + '</div><div id="rm-val" style="margin-top:12px"></div>',
      onOpen: (m) => { const run = () => { const tmp = collect(m); const v = validateRooming(rl, tmp.rooms); m.querySelector('#rm-val').innerHTML = (v.bad.length ? UI.alert('bad', v.bad.join('<br>')) : UI.alert('ok', 'Distribución sin conflictos.')); }; m.querySelectorAll('input,select').forEach(x => x.addEventListener('change', run)); run(); },
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const tmp = collect(m); const v = validateRooming(rl, tmp.rooms);
        if (v.bad.length) { UI.toast('Regla transversal 13: la distribución tiene ' + v.bad.length + ' conflicto(s). Corrija antes de guardar.', 'bad'); return false; }
        const before = idx != null ? JSON.stringify(rl.rooms[idx]) : '';
        rl.rooms = tmp.rooms; if (rlStatus(rl) !== 'borrador') rl.status = 'modificada';
        Audit.log('Rooming', rl.resId, idx != null ? 'editar_habitacion' : 'agregar_habitacion', before, JSON.stringify(tmp.room)); Store.save(); UI.toast('Habitación guardada. Reconfirme y reenvíe al hotel.'); rerender();
      } }] });
    function collect(m) { const f = UI.formData(m); const room = { room: m.querySelector('#room').value.trim(), type: f.type, status: f.status, pax: [...m.querySelectorAll('input[name=px]:checked')].map(x => x.value) }; const rooms = rl.rooms.slice(); if (idx != null) rooms[idx] = room; else rooms.push(room); return { room, rooms }; }
  }
  let rmSel = null;
  function roomingView(el, params) {
    if (params[0]) rmSel = params[0];
    if (!DB.rooming.length) { el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Rooming list', crumbs: [['Operaciones', '#/operaciones/ordenes'], ['Rooming']] }) + UI.card('', UI.empty('No hay rooming lists.', 'bed')) + '</div>'; return; }
    const rl = roomingList(rmSel) || DB.rooming[0]; rmSel = rlKey(rl);
    const pend = DB.reservations.filter(r => !['cancelada', 'completada'].includes(r.status) && lodgingLegs(r).some(g => !g.exists));
    const res = Q.reservation(rl.resId) || { passengers: [], title: '' };
    const v = validateRooming(rl); const st = rlStatus(rl);
    const op = opOfRes(rl.resId);
    const STL = { borrador: 'Borrador', modificada: 'Modificada (reenviar)', confirmada: 'Confirmada', enviado: 'Enviada al hotel' };
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Rooming list', crumbs: [['Inicio', '#/dashboard'], ['Operaciones', '#/operaciones/ordenes'], ['Rooming list']], subtitle: 'Pasajeros → Habitaciones → Distribución → Validar conflicto → Confirmar → Enviar (PROC-034). No se permite doble habitación activa para el mismo intervalo.', actions: '<button class="btn" id="rl-new"' + dis('reservations.modify') + '>' + ic('plus') + 'Nueva rooming list</button>' }) +
      pend.map(r => UI.alert('info', '<b>Reserva web ' + esc(r.id) + '</b> (' + esc(r.title) + ') trae alojamiento por ciudad sin rooming list: ' + lodgingLegs(r).filter(g => !g.exists).map(g => esc(g.city) + ' · ' + esc(g.hotel) + ' (' + g.items.reduce((a, l) => a + (+l.rooms || 0), 0) + ' hab.)').join('; ') + '. <button class="btn xs primary" data-pre="' + esc(r.id) + '"' + dis('reservations.modify') + '>' + ic('bed') + 'Prellenar desde la reserva web</button>')).join('') +
      '<div class="tabs pills">' + DB.rooming.map(x => '<button class="tab' + (x === rl ? ' on' : '') + '" data-rl="' + esc(rlKey(x)) + '">' + esc(x.resId) + ' · ' + esc(x.city ? x.city + ' · ' : '') + esc(rlHotelName(x)) + '<span class="cnt">' + x.rooms.length + '</span></button>').join('') + '</div>' +
      '<div class="grid g-2-1"><div class="stack">' + UI.card(esc(res.title) + ' ' + UI.badge(st === 'enviado' || st === 'confirmada' ? 'ok' : st === 'modificada' ? 'pendiente' : 'borrador', STL[st] || st), '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hab.</th><th>Tipo</th><th>Pasajeros</th><th>Ocupación</th><th>Estado</th><th></th></tr></thead><tbody>' + (rl.rooms.length ? rl.rooms.map((r, i) => { const cap = ROOM_TYPES[r.type] || 2; const infN = r.pax.filter(n => (res.passengers.find(x => x.name === n) || {}).type === 'INF').length; const occN = r.pax.length - infN; return '<tr><td class="mono"><b>' + esc(r.room) + '</b></td><td>' + esc(r.type) + '</td><td><div class="room-pax">' + (r.pax.length ? r.pax.map(p => '<span class="tag">' + ic('user') + esc(p) + '</span>').join('') : '<span class="xs warn">Vacía</span>') + '</div></td><td class="num ' + (occN > cap ? 'bad' : '') + '">' + occN + '/' + cap + (infN ? '<div class="xs faint">+' + infN + ' INF</div>' : '') + '</td><td>' + roomBadge(r.status) + roomInc(rl, r) + '</td><td class="right nowrap"><button class="btn xs" data-ed="' + i + '"' + dis('reservations.modify') + '>' + ic('edit') + 'Editar</button> <button class="btn xs ghost icon" data-dl="' + i + '"' + dis('reservations.modify') + ' aria-label="Eliminar">' + ic('trash') + '</button></td></tr>'; }).join('') : '<tr><td colspan="6">' + UI.empty('Sin habitaciones', 'bed') + '</td></tr>') + '</tbody></table></div>', { tight: true, sub: rlHotelLink(rl) + (rl.source === 'booking.lodging' ? ' · <span class="tag">Prellenada desde reserva web</span>' : '') + ' · ' + date(rl.checkIn) + ' → ' + date(rl.checkOut) + ' · ' + daysBetween(rl.checkIn, rl.checkOut) + ' noches', footer: '<button class="btn" id="rl-add"' + dis('reservations.modify') + '>' + ic('plus') + 'Agregar habitación</button><button class="btn" id="rl-prev">' + ic('eye') + 'Vista previa</button><button class="btn" id="rl-conf"' + dis('reservations.modify') + '>' + ic('check') + 'Confirmar rooming</button><button class="btn primary" id="rl-send"' + dis('reservations.modify') + '>' + ic('send') + 'Enviar al hotel</button>' }) + '</div>' +
      '<div class="stack">' + UI.card('Validación de conflictos', (v.bad.length ? UI.alert('bad', '<b>Conflictos (' + v.bad.length + ')</b><ul class="val-list">' + v.bad.map(x => '<li>' + x + '</li>').join('') + '</ul>') : UI.alert('ok', 'Sin conflictos: ningún pasajero en dos habitaciones del mismo intervalo y capacidades respetadas (Regla transversal 13).')) + (v.warn.length ? '<div style="margin-top:8px">' + UI.alert('warn', '<ul class="val-list">' + v.warn.map(x => '<li>' + x + '</li>').join('') + '</ul>') + '</div>' : '')) +
      UI.card('Datos', UI.dl([['Reserva', resLink(rl.resId)], ['Orden', op ? opLink(op.id) : '—'], ['Hotel', rlHotelLink(rl)], ['Contacto hotel', esc(((Q.provider(rl.hotel)) || {}).email || '—')], ['Pasajeros', res.passengers.length + ' (' + sum(rl.rooms, r => r.pax.length) + ' alojados)'], ['Último envío', rl.sentAt ? datetime(rl.sentAt) : (st === 'enviado' ? 'Enviada previamente' : '—')]])) + '</div></div></div>';
    el.querySelectorAll('[data-rl]').forEach(b => b.onclick = () => App.go('#/operaciones/rooming/' + b.dataset.rl));
    el.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => prefillRooming(Q.reservation(b.dataset.pre)));
    el.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { if (guard('reservations.modify')) roomModal(rl, +b.dataset.ed); });
    el.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => { if (!guard('reservations.modify')) return; const r = rl.rooms[+b.dataset.dl]; UI.confirm({ title: 'Eliminar habitación ' + esc(r.room), message: 'Los pasajeros quedarán sin habitación asignada.', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { rl.rooms.splice(+b.dataset.dl, 1); rl.status = 'modificada'; Audit.log('Rooming', rl.resId, 'eliminar_habitacion', r.room, ''); Store.save(); rerender(); } }); });
    el.querySelector('#rl-add').onclick = () => { if (guard('reservations.modify')) roomModal(rl, null); };
    el.querySelector('#rl-prev').onclick = () => UI.modal({ title: 'Rooming list — vista previa', size: 'lg', body: roomingDoc(rl) + '<p class="xs faint center" style="margin-top:10px">En producción el PDF se genera por job y se adjunta al correo del hotel.</p>', actions: [{ label: 'Cerrar' }] });
    el.querySelector('#rl-conf').onclick = () => { if (!guard('reservations.modify')) return; const vv = validateRooming(rl); if (vv.bad.length) { UI.toast('No se puede confirmar: ' + vv.bad.length + ' conflicto(s). Regla transversal 13.', 'bad'); return; } rl.status = 'confirmada'; Audit.log('Rooming', rl.resId, 'confirmar', st, 'confirmada'); Store.save(); UI.toast('Rooming list confirmada.'); rerender(); };
    el.querySelector('#rl-send').onclick = () => {
      if (!guard('reservations.modify')) return;
      const vv = validateRooming(rl);
      if (vv.bad.length) { UI.toast('No se puede enviar con conflictos (Regla transversal 13).', 'bad'); return; }
      if (!['confirmada', 'enviado'].includes(rlStatus(rl))) { UI.toast('Confirme la rooming list antes de enviarla al hotel.', 'warn'); return; }
      const h = Q.provider(rl.hotel);
      UI.modal({ title: 'Enviar rooming list al hotel', size: 'lg', sub: 'Destinatario: ' + esc(h ? h.email : '—'), body: (vv.warn.length ? UI.alert('warn', vv.warn.join('<br>')) + '<div style="height:10px"></div>' : '') + roomingDoc(rl), actions: [{ label: 'Cancelar' }, { label: 'Enviar por email', cls: 'primary', icon: 'send', onClick: () => { rl.status = 'enviado'; rl.sentAt = nowStr(); Notify.push('rooming.enviado', 'Email', h ? h.email : rl.hotel, 'Rooming list ' + rl.resId + ' — ' + rl.rooms.length + ' habitaciones'); Audit.log('Rooming', rlKey(rl), 'enviar_hotel', '', h ? h.email : rlHotelName(rl)); Store.save(); UI.toast('Rooming list enviada a ' + esc(h ? h.name : rlHotelName(rl)) + '.'); rerender(); } }] });
    };
    el.querySelector('#rl-new').onclick = () => {
      if (!guard('reservations.modify')) return;
      const cands = DB.reservations.filter(r => !roomingList(r.id) && !['cancelada', 'completada'].includes(r.status));
      UI.modal({ title: 'Nueva rooming list', body: cands.length ? UI.form([{ id: 'resId', label: 'Reserva', type: 'select', required: true, placeholder: 'Seleccione…', options: cands.map(r => [r.id, r.id + ' — ' + r.title]), col: 12 }, { id: 'hotel', label: 'Hotel', type: 'select', required: true, options: DB.providers.filter(p => p.type === 'Hotel' && p.status === 'activo').map(p => [p.id, p.name]), col: 12 }, { id: 'ci', label: 'Check-in', type: 'date', required: true, col: 6 }, { id: 'co', label: 'Check-out', type: 'date', required: true, col: 6 }]) : UI.empty('Todas las reservas activas ya tienen rooming list.', 'bed'),
        onOpen: (m) => { const s = m.querySelector('#resId'); if (s) s.onchange = () => { const r = Q.reservation(s.value); if (r) { m.querySelector('#ci').value = r.travelFrom; m.querySelector('#co').value = r.travelTo; } }; },
        actions: cands.length ? [{ label: 'Cancelar' }, { label: 'Crear', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); if (f.co <= f.ci) { UI.toast('El check-out debe ser posterior al check-in.', 'bad'); return false; } DB.rooming.push({ resId: f.resId, hotel: f.hotel, checkIn: f.ci, checkOut: f.co, rooms: [], status: 'borrador' }); Audit.log('Rooming', f.resId, 'crear', '', f.hotel); Store.save(); UI.toast('Rooming list creada. Agregue habitaciones.'); App.go('#/operaciones/rooming/' + f.resId); } }] : [{ label: 'Cerrar' }] });
    };
  }

  /* ======================================================================
     VOUCHERS (PROC-035)
     ====================================================================== */
  function meetingPoint(res, s) {
    if (!s) return '—';
    if (pickupApplies(res, s)) { const pk = pickupOf(res); return [pk.point, pk.address].filter(Boolean).join(' — ') || '—'; }
    const hotel = hotelOf(res);
    if (/aeropuerto →/i.test(s.name)) return 'Hall de llegadas — Aeropuerto Alejandro Velasco Astete (cartel con el nombre del pasajero)';
    if (/→ aeropuerto/i.test(s.name)) return 'Lobby del hotel' + (hotel ? ' — ' + hotel.name : '');
    if (/hotel|hab\./i.test(s.name)) return 'Recepción del hotel (check-in desde 14:00)';
    if (/tren/i.test(s.name)) return 'Estación Ollantaytambo — presentarse 30 min antes';
    if (/entrada/i.test(s.name)) return 'Control de ingreso a Machu Picchu — con pasaporte original';
    const p = Q.product(s.productId);
    if (p && p.type === 'PAQUETE') return 'Lobby del hotel' + (hotel ? ' — ' + hotel.name : '');
    const d = p && ((p.departures || []).find(x => x.date === s.date) || (p.departures || [])[0]);
    if (d) return d.meeting === 'Hotel (recojo)' ? 'Recojo en el lobby del hotel' + (hotel ? ' — ' + hotel.name : '') : d.meeting;
    const it0 = p && p.itinerary && p.itinerary[0] && p.itinerary[0].items[0];
    return it0 ? it0.location : 'Por confirmar con el coordinador';
  }
  function qrSvg(text, size, fg, bg) {
    const N = 25; let h = 2166136261; const bits = [];
    for (let i = 0; i < N * N; i++) { h ^= text.charCodeAt(i % text.length) + i * 31; h = Math.imul(h, 16777619) >>> 0; bits.push((h >>> 13) & 1); }
    const F = [[0, 0], [0, N - 7], [N - 7, 0]];
    const fcell = (r, c) => { for (const [fr, fc] of F) { if (r >= fr - 1 && r <= fr + 7 && c >= fc - 1 && c <= fc + 7) { const rr = r - fr, cc = c - fc; if (rr < 0 || cc < 0 || rr > 6 || cc > 6) return 0; if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return 1; if (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4) return 1; return 0; } } return null; };
    let rects = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { let v = fcell(r, c); if (v === null) v = (r === 6 || c === 6) ? (r + c) % 2 === 0 ? 1 : 0 : bits[r * N + c]; if (v) rects += '<rect x="' + c + '" y="' + r + '" width="1" height="1"/>'; }
    return '<svg viewBox="-2 -2 ' + (N + 4) + ' ' + (N + 4) + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" role="img" aria-label="Código QR del voucher" style="display:block;fill:' + fg + '"><rect x="-2" y="-2" width="' + (N + 4) + '" height="' + (N + 4) + '" style="fill:' + bg + '"/>' + rects + '</svg>';
  }
  function voucherDoc(v) {
    const res = Q.reservation(v.resId) || { passengers: [], services: [] }; const s = svcOf(res, v.serviceId) || { name: v.service, date: v.date, time: '—' };
    const p = Q.provider(v.providerId) || {}; const prod = Q.product(s.productId); const op = opOfRes(res.id); const sede = Q.sede(res.sede) || DB.sedes[0];
    const a = op && (op.assignments || []).find(x => x.serviceId === v.serviceId);
    const anul = v.status === 'anulado';
    return '<div class="doc" style="position:relative;overflow:hidden">' + (anul ? '<div style="position:absolute;top:40%;left:0;right:0;text-align:center;font-size:4.5rem;font-weight:800;color:#C0392B;opacity:.14;transform:rotate(-18deg);pointer-events:none">ANULADO</div>' : '') +
      '<div class="doc-head"><div><h2>' + esc(DB.tenant.name) + '</h2><div class="muted">RUC ' + DB.tenant.ruc + ' · ' + esc(sede.address) + '</div><div class="muted">Tel. ' + esc(sede.phone) + ' · operaciones@andeshorizonte.pe</div></div><div style="text-align:right"><h3>VOUCHER DE SERVICIO</h3><div style="font-family:var(--f-mono);font-size:1rem;font-weight:700">' + esc(v.id) + '</div><div class="muted">Versión ' + v.version + ' · ' + (anul ? 'ANULADO' : v.status === 'utilizado' ? 'UTILIZADO' : 'VÁLIDO') + '</div><div class="muted">Emitido ' + datetime(v.issuedAt) + '</div></div></div>' +
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start"><div><table><tbody>' +
      [['Proveedor', esc(p.name || '—') + '<div class="muted">RUC ' + esc(p.ruc || '—') + ' · ' + esc(p.phone || '') + ' · ' + esc(p.email || '') + '</div>'], ['Servicio', '<b>' + esc(s.name) + '</b>' + (prod ? '<div class="muted">' + esc(prod.name) + ' (' + esc(prod.code) + ')</div>' : '')], ['Fecha y hora', '<b>' + date(s.date) + ' · ' + esc(s.time) + '</b>'], [pickupApplies(res, s) ? 'Punto de recojo' : 'Punto de encuentro', esc(meetingPoint(res, s)) + (pickupApplies(res, s) && pickupOf(res).flight ? '<div class="muted">Vuelo de llegada ' + esc(pickupOf(res).flight) + (pickupOf(res).arrival ? ' · llega ' + esc(datetime(pickupOf(res).arrival)) : '') + ' · el conductor espera con cartel a nombre de ' + esc((res.passengers.find(x => x.isLead) || res.passengers[0] || {}).name || '') + '</div>' : '')], ['Código de confirmación', '<b style="font-family:var(--f-mono)">' + esc(s.confirmationCode || 'Pendiente') + '</b>'], ['Reserva', esc(res.id) + ' · ' + esc(res.title || '')], ['Pasajeros (' + v.pax + ')', res.passengers.map(x => esc(x.name) + ' <span class="muted">(' + [x.isLead ? 'titular' : (x.relationship ? 'acompañante · ' + x.relationship.toLowerCase() : ''), x.type, x.doc].filter(Boolean).map(esc).join(' · ') + ')</span>').join('<br>')]].concat(a && (a.guideId || a.driverId) ? [['Guía / transporte', esc([gName(a.guideId), dName(a.driverId), (Q.vehicle(a.vehicleId) || {}).plate].filter(Boolean).join(' · '))]] : []).map(r => '<tr><td style="width:170px;color:#5b6f77;font-size:.76rem;text-transform:uppercase;letter-spacing:.03em;vertical-align:top">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') +
      '</tbody></table></div><div style="text-align:center;padding-top:8px">' + qrSvg(v.id + '|' + res.id + '|' + v.version, 132, '#0A3A73', '#ffffff') + '<div class="muted" style="font-size:.7rem;margin-top:4px">Presente este código<br>al proveedor</div></div></div>' +
      (prod ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:6px"><div><h4 style="color:#0A3A73;margin-bottom:4px">Incluye</h4><ul style="margin:0;padding-left:18px">' + prod.inclusions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div><div><h4 style="color:#0A3A73;margin-bottom:4px">No incluye</h4><ul style="margin:0;padding-left:18px">' + prod.exclusions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' : '') +
      (res.passengers.some(x => x.diet) || clientComments(res) ? '<p style="margin-top:10px"><b>Observaciones:</b> ' + res.passengers.filter(x => x.diet).map(x => esc(x.name) + ': ' + esc(x.diet)).concat(clientComments(res) ? ['Pedido del cliente: ' + esc(clientComments(res))] : []).join(' · ') + '</p>' : '') +
      '<div style="margin-top:16px;padding:10px 12px;border:1px solid #e3eaec;border-radius:6px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>Contacto de emergencia 24/7:</b> ' + EMERGENCY + ' (WhatsApp)</div><div>Coordinador: ' + esc(op ? Q.userName(op.coordinator) : '—') + ' · ' + esc(coordPhone(op)) + '</div></div>' +
      '<p class="muted" style="margin-top:10px;font-size:.72rem">Documento vinculado a la reserva de origen (Regla transversal 23). Válido solo para el servicio, fecha y pasajeros indicados. Cualquier modificación genera una nueva versión y anula la anterior.</p></div>';
  }
  function showVoucherDoc(v) { UI.modal({ title: 'Voucher ' + esc(v.id) + ' · v' + v.version, size: 'lg', body: voucherDoc(v) + '<p class="xs faint center" style="margin-top:10px">Vista del documento. En producción el PDF se genera mediante un job y queda disponible en el portal del pasajero.</p>', actions: [{ label: 'Cerrar' }] }); }
  function emitVoucher(resId, serviceId) {
    if (!guard('operations.vouchers')) return;
    const cands = DB.reservations.filter(r => !['cancelada', 'borrador'].includes(r.status));
    UI.modal({ title: 'Emitir voucher', sub: 'Servicio confirmado → Validar → Generar → Versionar → Publicar → Notificar (PROC-035)',
      body: UI.form([{ id: 'res', label: 'Reserva', type: 'select', required: true, options: cands.map(r => [r.id, r.id + ' — ' + r.title]), value: resId || '', placeholder: 'Seleccione…', col: 12 }, { id: 'svc', label: 'Servicio', type: 'select', required: true, options: [], col: 12 }, { id: 'notes', label: 'Nota para el pasajero (opcional)', type: 'textarea', rows: 2, col: 12 }]) + '<div id="vx-val" style="margin-top:12px"></div>',
      onOpen: (m) => {
        const rs = m.querySelector('#res'), ss = m.querySelector('#svc'), box = m.querySelector('#vx-val');
        const fill = () => { const r = Q.reservation(rs.value); ss.innerHTML = r ? r.services.filter(s => s.providerId).map(s => '<option value="' + s.id + '"' + (s.id === serviceId ? ' selected' : '') + '>' + esc(dateShort(s.date) + ' · ' + s.name + ' — ' + UI.statusLabel(s.status)) + '</option>').join('') : ''; check(); };
        const check = () => { const r = Q.reservation(rs.value); const s = r && svcOf(r, ss.value); box.innerHTML = s ? renderVx(vCheck(r, s)) : ''; };
        rs.onchange = fill; ss.onchange = check; fill();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Emitir y publicar', cls: 'primary', icon: 'ticket', onClick: (m) => {
        const r = Q.reservation(m.querySelector('#res').value); const s = r && svcOf(r, m.querySelector('#svc').value);
        if (!s) { UI.toast('Seleccione reserva y servicio.', 'warn'); return false; }
        const c = vCheck(r, s); if (c.bad.length) { UI.toast('Emisión bloqueada: ' + c.bad[0], 'bad'); return false; }
        const v = { id: Seq.next('Voucher'), resId: r.id, serviceId: s.id, service: s.name, providerId: s.providerId, date: s.date, pax: r.passengers.length, status: 'emitido', version: 1, issuedAt: nowStr(), issuedBy: Auth.user.id, note: m.querySelector('#notes').value.trim() };
        v.history = [{ v: 1, ts: v.issuedAt, user: Auth.user.id, reason: 'Emisión inicial' }];
        DB.vouchers.unshift(v);
        const cl = Q.client(r.clientId); const p = Q.provider(s.providerId);
        Notify.push('voucher.emitido', 'Email', cl ? cl.email : r.clientId, v.id + ' — ' + s.name);
        Notify.push('voucher.emitido', 'Push', 'Pasajeros ' + r.id, 'Nuevo voucher disponible: ' + s.name);
        if (p) Notify.push('voucher.emitido', 'Email', p.email, v.id + ' — ' + s.name + ' · ' + dateShort(s.date));
        Audit.log('Voucher', v.id, 'emitir', '', 'emitido v1 · ' + s.id);
        Store.save(); UI.toast('Voucher ' + v.id + ' emitido y publicado en el portal del pasajero.'); App.go('#/operaciones/vouchers/' + v.id);
      } }] });
  }
  function vCheck(r, s) {
    const bad = [], warn = [];
    if (!['confirmado', 'completado'].includes(s.status)) bad.push('el servicio está «' + UI.statusLabel(s.status) + '». Solo servicios confirmados o autorizados emiten voucher (Regla transversal 11).');
    if (!s.confirmationCode && s.status === 'confirmado') warn.push('El servicio no tiene código de confirmación del proveedor.');
    const act = DB.vouchers.find(v => v.serviceId === s.id && v.resId === r.id && v.status === 'emitido');
    if (act) bad.push('ya existe el voucher vigente ' + act.id + ' (v' + act.version + '). Use «Nueva versión» para modificarlo.');
    const p = Q.provider(s.providerId); if (p && p.status !== 'activo') bad.push('el proveedor ' + p.name + ' está ' + UI.statusLabel(p.status).toLowerCase() + ' (contrato no vigente).');
    if (s.status === 'completado') warn.push('El servicio ya fue ejecutado: el voucher quedará como respaldo documental.');
    return { bad, warn };
  }
  const renderVx = (c) => (c.bad.length ? UI.alert('bad', '<b>No se puede emitir:</b> ' + c.bad.join(' ')) : UI.alert('ok', 'Servicio válido para emisión de voucher.')) + (c.warn.length ? '<div style="margin-top:8px">' + UI.alert('warn', c.warn.join('<br>')) + '</div>' : '');
  function vouchersList(el) {
    const vs = DB.vouchers;
    const conf = DB.reservations.filter(r => !['cancelada', 'borrador'].includes(r.status)).flatMap(r => r.services.filter(s => s.providerId && s.status === 'confirmado' && !vs.some(v => v.serviceId === s.id && v.status !== 'anulado')).map(s => ({ r, s })));
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Vouchers', crumbs: [['Inicio', '#/dashboard'], ['Operaciones', '#/operaciones/ordenes'], ['Vouchers']], subtitle: 'Emisión, versionamiento y anulación de vouchers. Solo servicios confirmados o autorizados (Regla transversal 11). Publicados en el portal y app del pasajero.', actions: '<button class="btn primary" id="v-new"' + dis('operations.vouchers') + '>' + ic('ticket') + 'Emitir voucher</button>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Emitidos vigentes', value: vs.filter(v => v.status === 'emitido').length, tone: 'ok', icon: 'ticket' }) + UI.kpi({ label: 'Utilizados', value: vs.filter(v => v.status === 'utilizado').length, tone: 'violet', icon: 'checkCircle' }) + UI.kpi({ label: 'Anulados', value: vs.filter(v => v.status === 'anulado').length, tone: 'bad', icon: 'x' }) + UI.kpi({ label: 'Confirmados sin voucher', value: conf.length, tone: conf.length ? 'sun' : 'ok', icon: 'alert', sub: 'listos para emitir' }) + '</div>' +
      (conf.length ? UI.card('Servicios confirmados pendientes de voucher', '<div class="list">' + conf.slice(0, 6).map(({ r, s }, i) => '<div class="list-item"><div class="ico-box sun">' + ic('ticket') + '</div><div class="grow"><div class="small" style="font-weight:600">' + esc(s.name) + '</div><div class="xs faint">' + dateShort(s.date) + ' ' + esc(s.time) + ' · ' + esc(r.id) + ' · ' + esc(Q.providerName(s.providerId)) + '</div></div><button class="btn xs primary" data-em="' + i + '"' + dis('operations.vouchers') + '>Emitir</button></div>').join('') + '</div>', { tight: true }) : '') +
      '<div id="v-tbl"></div></div>';
    UI.dataTable(el.querySelector('#v-tbl'), { rows: () => DB.vouchers, exportName: 'vouchers', search: r => [r.id, r.resId, r.service, Q.providerName(r.providerId)].join(' '), searchPlaceholder: 'Buscar voucher, reserva, servicio…', defaultSort: 'date', defaultDir: -1,
      filters: [{ key: 'status', label: 'Estado', options: ['emitido', 'utilizado', 'anulado'] }, { key: 'providerId', label: 'Proveedor', options: [...new Set(DB.vouchers.map(v => v.providerId))].map(p => [p, Q.providerName(p)]) }],
      onRow: r => App.go('#/operaciones/vouchers/' + r.id),
      columns: [{ key: 'id', label: 'Voucher', render: r => '<span class="mono">' + esc(r.id) + '</span>' }, { key: 'resId', label: 'Reserva', render: r => resLink(r.resId) + '<div class="cell-sub">' + esc(Q.clientName((Q.reservation(r.resId) || {}).clientId)) + '</div>' }, { key: 'service', label: 'Servicio', render: r => '<span class="cell-main">' + esc(r.service) + '</span>' }, { key: 'providerId', label: 'Proveedor', render: r => provLink(r.providerId), csv: r => Q.providerName(r.providerId) }, { key: 'date', label: 'Fecha', render: r => date(r.date) }, { key: 'pax', label: 'Pax', align: 'num' }, { key: 'version', label: 'Versión', render: r => 'v' + r.version }, { key: 'issuedAt', label: 'Emisión', render: r => '<span class="small">' + datetime(r.issuedAt) + '</span><div class="cell-sub">' + esc(Q.userName(r.issuedBy)) + '</div>' }, { key: 'status', label: 'Estado', render: r => UI.badge(r.status), csv: r => r.status }] });
    el.querySelector('#v-new').onclick = () => emitVoucher();
    el.querySelectorAll('[data-em]').forEach(b => b.onclick = () => { const x = conf[+b.dataset.em]; emitVoucher(x.r.id, x.s.id); });
  }
  function voucherDetail(el, id) {
    const v = DB.vouchers.find(x => x.id === id);
    if (!v) { el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Voucher no encontrado', crumbs: [['Vouchers', '#/operaciones/vouchers'], [id]] }) + UI.card('', UI.empty('El voucher ' + id + ' no existe.', 'ticket')) + '</div>'; return; }
    const res = Q.reservation(v.resId) || { passengers: [], services: [] }; const s = svcOf(res, v.serviceId) || {}; const hist = vHist(v);
    const canV = Auth.can('operations.vouchers');
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Voucher ' + esc(v.id) + ' ' + UI.badge(v.status), crumbs: [['Inicio', '#/dashboard'], ['Vouchers', '#/operaciones/vouchers'], [v.id]], subtitle: esc(v.service) + ' · ' + date(v.date) + ' · Reserva ' + resLink(v.resId) + ' · Versión ' + v.version,
      actions: '<button class="btn" id="vd-prev">' + ic('download') + 'Descargar PDF</button><button class="btn" id="vd-send"' + (!canV ? dis('operations.vouchers') : v.status === 'emitido' ? '' : ' disabled title="Solo vouchers vigentes (emitidos)"') + '>' + ic('send') + 'Reenviar</button><button class="btn" id="vd-ver"' + (!canV ? dis('operations.vouchers') : v.status === 'emitido' ? '' : ' disabled title="Solo vouchers vigentes (emitidos)"') + '>' + ic('copy') + 'Nueva versión</button><button class="btn" id="vd-use"' + (!canV ? dis('operations.vouchers') : v.status === 'emitido' ? '' : ' disabled title="Solo vouchers vigentes (emitidos)"') + '>' + ic('check') + 'Marcar utilizado</button><button class="btn danger" id="vd-void"' + (!canV ? dis('operations.vouchers') : v.status === 'emitido' ? '' : ' disabled title="Solo vouchers vigentes (emitidos)"') + '>' + ic('x') + 'Anular</button>' }) +
      (v.status === 'anulado' ? UI.alert('bad', '<b>Voucher anulado</b>' + (v.voidReason ? ': ' + esc(v.voidReason) : '') + '. No es válido para la prestación del servicio.') : '') + (!canV ? UI.alert('warn', 'Su rol puede consultar el voucher pero no emitir, versionar ni anular (operations.vouchers).') : '') +
      '<div class="grid g-2-1"><div>' + voucherDoc(v) + '</div><div class="stack">' + UI.card('Datos', UI.dl([['Reserva', resLink(v.resId)], ['Cliente', cliLink(res.clientId)], ['Servicio', esc(v.service) + '<div class="xs faint">' + UI.badge(s.status || 'confirmado') + '</div>'], ['Producto', prodLink(s.productId)], ['Proveedor', provLink(v.providerId)], ['Pasajeros', v.pax + ''], ['Emitido', datetime(v.issuedAt) + ' · ' + esc(Q.userName(v.issuedBy))], ['Orden', opOfRes(v.resId) ? opLink(opOfRes(v.resId).id) : '—']])) +
      UI.card('Historial de versiones', UI.timeline(hist.slice().reverse().map(h => ({ title: 'Versión ' + h.v + (h.v === v.version ? ' (vigente)' : ''), meta: datetime(h.ts) + ' · ' + esc(Q.userName(h.user)), desc: esc(h.reason), icon: h.v === v.version ? 'fileCheck' : 'history' })).concat(v.status === 'anulado' ? [{ title: 'Anulado', meta: datetime(v.voidAt || v.issuedAt), desc: esc(v.voidReason || ''), icon: 'x' }] : []))) +
      UI.card('Notificaciones', (() => { const n = DB.notifications.filter(x => (x.subject || '').includes(v.id)); return n.length ? '<div class="list">' + n.map(x => '<div class="list-item" style="padding:8px 0"><div class="grow"><div class="small">' + esc(x.channel) + ' → ' + esc(x.to) + '</div><div class="xs faint">' + datetime(x.ts) + '</div></div>' + UI.badge(x.status) + '</div>').join('') + '</div>' : '<div class="small faint">Sin envíos registrados para este voucher.</div>'; })()) + '</div></div></div>';
    el.querySelector('#vd-prev').onclick = () => showVoucherDoc(v);
    const b = (id) => el.querySelector(id);
    b('#vd-send').onclick = () => { if (!guard('operations.vouchers')) return; const cl = Q.client(res.clientId); Notify.push('voucher.reenviado', 'Email', cl ? cl.email : '—', v.id + ' — ' + v.service); Audit.log('Voucher', v.id, 'reenviar', '', cl ? cl.email : ''); UI.toast('Voucher reenviado a ' + esc(cl ? cl.email : 'cliente') + '.'); rerender(); };
    b('#vd-ver').onclick = () => { if (!guard('operations.vouchers')) return; if (!['confirmado', 'completado'].includes(s.status)) { UI.toast('Regla transversal 11: el servicio ya no está confirmado; no se puede versionar el voucher.', 'bad'); return; } UI.confirm({ title: 'Nueva versión del voucher', message: 'Se generará la versión <b>v' + (v.version + 1) + '</b> y la anterior quedará reemplazada. El pasajero y el proveedor serán notificados.', reason: true, reasonLabel: 'Motivo del cambio', confirmLabel: 'Generar v' + (v.version + 1), onConfirm: (r) => { const bf = 'v' + v.version; v.version++; hist.push({ v: v.version, ts: nowStr(), user: Auth.user.id, reason: r }); v.issuedAt = nowStr(); v.issuedBy = Auth.user.id; Audit.log('Voucher', v.id, 'versionar', bf, 'v' + v.version + ' (' + r + ')'); const cl = Q.client(res.clientId); Notify.push('voucher.actualizado', 'Email', cl ? cl.email : '—', v.id + ' actualizado a v' + v.version + ': ' + r); Notify.push('voucher.actualizado', 'Push', 'Pasajeros ' + res.id, 'Voucher actualizado: ' + v.service); Store.save(); UI.toast('Versión v' + v.version + ' generada.'); rerender(); } }); };
    b('#vd-use').onclick = () => { if (!guard('operations.vouchers')) return; v.status = 'utilizado'; Audit.log('Voucher', v.id, 'utilizar', 'emitido', 'utilizado'); Store.save(); UI.toast('Voucher marcado como utilizado.'); rerender(); };
    b('#vd-void').onclick = () => { if (!guard('operations.vouchers')) return; UI.confirm({ title: 'Anular voucher', message: 'El voucher <b>' + esc(v.id) + '</b> dejará de ser válido. Se notificará al proveedor y al pasajero. Queda en historial (eliminación lógica).', reason: true, danger: true, confirmLabel: 'Anular', onConfirm: (r) => { v.status = 'anulado'; v.voidReason = r; v.voidAt = nowStr(); Audit.log('Voucher', v.id, 'anular', 'emitido', 'anulado: ' + r); const p = Q.provider(v.providerId); if (p) Notify.push('voucher.anulado', 'Email', p.email, v.id + ' anulado'); Store.save(); UI.toast('Voucher anulado.', 'warn'); rerender(); } }); };
  }

  /* ======================================================================
     INCIDENCIAS (PROC-037)
     ====================================================================== */
  const SLA_H = { critica: 4, alta: 8, media: 24, baja: 72 };
  const INC_TYPES = ['Transporte', 'Proveedor', 'Salud del pasajero', 'Horario', 'Clima', 'Documentación', 'Equipaje', 'Seguridad', 'Otro'];
  const INC_STEPS = ['Detectar', 'Registrar', 'Clasificar', 'Priorizar', 'Asignar', 'Resolver', 'Evidencia', 'Cerrar'];
  function sla(i) {
    const hours = SLA_H[i.severity] || 24;
    const end = i.resolvedAt || i.closedAt || (isOpenInc(i) ? nowStr() : i.createdAt);
    const el = Math.max(0, (parseD(end) - parseD(i.createdAt)) / 3600000);
    const closed = !isOpenInc(i);
    return { hours, el, pct: Math.min(100, el / hours * 100), over: el > hours, closed };
  }
  function slaHtml(i, compact) {
    const s = sla(i);
    const tone = s.closed ? (s.over ? 'warn' : 'ok') : s.over ? 'bad' : s.pct > 70 ? 'warn' : 'ok';
    const txt = s.closed ? (s.over ? 'Resuelta fuera de SLA' : 'Resuelta en SLA') : s.over ? 'SLA vencido hace ' + fmtN(s.el - s.hours, 1) + ' h' : 'Quedan ' + fmtN(s.hours - s.el, 1) + ' h';
    return compact ? '<div style="min-width:110px"><div class="xs ' + (tone === 'ok' ? 'faint' : tone) + '">' + txt + '</div>' + UI.progress(s.pct, tone) + '</div>' : '<div class="sla-box"><div class="row between small"><span>Objetivo ' + s.hours + ' h (' + UI.statusLabel(i.severity).toLowerCase() + ')</span><b class="' + tone + '">' + txt + '</b></div>' + UI.progress(s.pct, tone) + '<div class="xs faint">Transcurrido ' + fmtN(s.el, 1) + ' h desde ' + datetime(i.createdAt) + '</div></div>';
  }
  function incStep(i) {
    if (i.status === 'cerrada') return 8;
    let k = 4; if (i.assignee) k = 5;
    if (i.resolution) k = 6;
    if (i.resolution && (i.evidence || []).length) k = 7;
    return k;
  }
  function newIncidentModal(pre = {}) {
    if (!guard('operations.incidents')) return;
    const ops = DB.operations.filter(o => o.status !== 'completada' || o.id === pre.opId);
    UI.modal({ title: 'Nueva incidencia', size: 'lg', sub: 'Detectar → Registrar → Clasificar → Priorizar → Asignar (PROC-037)',
      body: UI.form([
        { id: 'opId', label: 'Orden operativa / reserva', type: 'select', required: true, placeholder: 'Seleccione…', options: ops.map(o => [o.id, o.id + ' — ' + o.resId + ' — ' + o.title]), value: pre.opId || '', col: 12 },
        { id: 'type', label: 'Tipo', type: 'select', options: INC_TYPES, value: pre.type || 'Transporte', col: 4 },
        { id: 'severity', label: 'Severidad', type: 'select', options: [['baja', 'Baja (SLA 72 h)'], ['media', 'Media (SLA 24 h)'], ['alta', 'Alta (SLA 8 h)'], ['critica', 'Crítica (SLA 4 h)']], value: pre.severity || 'media', col: 4 },
        { id: 'assignee', label: 'Responsable', type: 'select', options: opUsers().map(u => [u.id, u.name]), value: 'U05', col: 4 },
        { id: 'title', label: 'Título', required: true, placeholder: 'Resumen breve de la incidencia', col: 12 },
        { id: 'desc', label: 'Descripción', type: 'textarea', required: true, rows: 3, col: 12 },
        { type: 'html', col: 12, html: '<div class="field"><label for="inc_file">Evidencia (opcional)</label><input class="input" type="file" id="inc_file" multiple accept="image/*,application/pdf" style="padding:6px"></div><div id="inc-crit" style="margin-top:10px"></div>' }
      ]),
      onOpen: (m) => { const s = m.querySelector('#severity'); const upd = () => { m.querySelector('#inc-crit').innerHTML = s.value === 'critica' ? UI.alert('bad', 'Severidad <b>crítica</b>: se enviará alerta inmediata a gerencia (' + esc(manager().name) + ') por push y WhatsApp. No podrá cerrarse sin resolución y evidencia.') : ''; }; s.onchange = upd; upd(); },
      actions: [{ label: 'Cancelar' }, { label: 'Registrar incidencia', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const files = [...(m.querySelector('#inc_file').files || [])].map(x => x.name);
        const inc = createIncident({ opId: f.opId, type: f.type, severity: f.severity, title: f.title, desc: f.desc, assignee: f.assignee, evidence: files, via: 'web' });
        UI.toast('Incidencia ' + inc.id + ' registrada' + (inc.severity === 'critica' ? '. Alerta crítica enviada a gerencia.' : '.'), inc.severity === 'critica' ? 'warn' : 'ok');
        App.go('#/operaciones/incidencias/' + inc.id);
      } }] });
  }
  function incidentsList(el) {
    const open = DB.incidents.filter(isOpenInc);
    const crit = open.filter(i => i.severity === 'critica');
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Incidencias', crumbs: [['Inicio', '#/dashboard'], ['Operaciones', '#/operaciones/ordenes'], ['Incidencias']], subtitle: 'Detectar → Registrar → Clasificar → Priorizar → Asignar → Resolver → Evidencia → Cerrar (PROC-037). Una incidencia crítica genera alerta y permanece abierta hasta su resolución.', actions: '<button class="btn primary" id="i-new"' + dis('operations.incidents') + '>' + ic('plus') + 'Nueva incidencia</button>' }) +
      (crit.length ? UI.alert('bad', '<b>' + crit.length + ' incidencia(s) crítica(s) abierta(s):</b> ' + crit.map(i => incLink(i.id) + ' ' + esc(i.title)).join(' · ')) : '') +
      '<div class="grid g4">' + UI.kpi({ label: 'Abiertas', value: open.length, tone: 'info', icon: 'alert' }) + UI.kpi({ label: 'Críticas abiertas', value: crit.length, tone: crit.length ? 'bad' : 'ok', icon: 'zap' }) + UI.kpi({ label: 'En proceso', value: DB.incidents.filter(i => i.status === 'en_proceso').length, tone: 'accent', icon: 'clock' }) + UI.kpi({ label: 'SLA vencido', value: open.filter(i => sla(i).over).length, tone: open.some(i => sla(i).over) ? 'bad' : 'ok', icon: 'history', sub: 'objetivo por severidad' }) + '</div><div id="i-tbl"></div></div>';
    const sevO = { critica: 0, alta: 1, media: 2, baja: 3 };
    UI.dataTable(el.querySelector('#i-tbl'), { rows: () => DB.incidents, exportName: 'incidencias', search: r => [r.id, r.title, r.resId, r.opId, r.type, Q.userName(r.assignee)].join(' '), searchPlaceholder: 'Buscar incidencia, reserva…', defaultSort: 'createdAt', defaultDir: -1,
      filters: [{ key: 'status', label: 'Estado', options: ['abierta', 'en_proceso', 'resuelta', 'cerrada'] }, { key: 'severity', label: 'Severidad', options: ['critica', 'alta', 'media', 'baja'] }, { key: 'type', label: 'Tipo', options: INC_TYPES.map(t => [t, t]) }],
      onRow: r => App.go('#/operaciones/incidencias/' + r.id),
      columns: [{ key: 'id', label: 'ID', render: r => '<span class="mono">' + esc(r.id) + '</span>' }, { key: 'title', label: 'Incidencia', render: r => '<div class="cell-main">' + esc(r.title) + '</div><div class="cell-sub">' + esc(r.type) + ' · ' + (r.opId ? esc(r.opId) + ' · ' : '') + esc(r.resId || '') + '</div>' }, { key: 'severity', label: 'Severidad', sortVal: r => sevO[r.severity], render: r => UI.badge(r.severity), csv: r => r.severity }, { key: 'status', label: 'Estado', render: r => UI.badge(r.status), csv: r => r.status }, { key: 'assignee', label: 'Responsable', render: r => UI.userChip(r.assignee), csv: r => Q.userName(r.assignee) }, { key: 'createdAt', label: 'Registrada', render: r => '<span class="small nowrap">' + datetime(r.createdAt) + '</span><div class="cell-sub">por ' + esc(Q.userName(r.reportedBy)) + '</div>' }, { key: 'sla', label: 'SLA', sortVal: r => sla(r).pct, render: r => slaHtml(r, true), csv: r => fmtN(sla(r).el, 1) + ' h / ' + sla(r).hours + ' h' }] });
    el.querySelector('#i-new').onclick = () => newIncidentModal();
  }
  function incidentDetail(el, id) {
    const i = DB.incidents.find(x => x.id === id);
    if (!i) { el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: 'Incidencia no encontrada', crumbs: [['Incidencias', '#/operaciones/incidencias'], [id]] }) + UI.card('', UI.empty('La incidencia ' + id + ' no existe.', 'alert')) + '</div>'; return; }
    const op = Q.operation(i.opId); const res = Q.reservation(i.resId);
    const can = Auth.can('operations.incidents'); const open = isOpenInc(i);
    const notifs = DB.notifications.filter(n => (n.subject || '').includes(i.id));
    el.innerHTML = '<div class="page op-pg">' + UI.pageHeader({ title: esc(i.title) + ' ' + UI.badge(i.severity) + ' ' + UI.badge(i.status), crumbs: [['Inicio', '#/dashboard'], ['Incidencias', '#/operaciones/incidencias'], [i.id]], subtitle: '<span class="mono">' + i.id + '</span> · ' + esc(i.type) + ' · Registrada ' + datetime(i.createdAt) + ' por ' + esc(Q.userName(i.reportedBy)) + (res ? ' · Reserva ' + resLink(res.id) : '') + (op ? ' · Orden ' + opLink(op.id) : ''),
      actions: (i.status === 'abierta' ? '<button class="btn" id="ic-take"' + dis('operations.incidents') + '>' + ic('clock') + 'Pasar a en proceso</button>' : '') + '<button class="btn" id="ic-asg"' + (!can ? dis('operations.incidents') : open ? '' : ' disabled title="La incidencia está cerrada"') + '>' + ic('user') + 'Asignar</button><button class="btn" id="ic-sev"' + (!can ? dis('operations.incidents') : open ? '' : ' disabled title="La incidencia está cerrada"') + '>' + ic('filter') + 'Reclasificar</button>' + (open ? '<button class="btn" id="ic-res"' + dis('operations.incidents') + '>' + ic('checkCircle') + 'Registrar resolución</button>' : '') + (i.status !== 'cerrada' ? '<button class="btn primary" id="ic-close"' + dis('operations.incidents') + '>' + ic('lock') + 'Cerrar incidencia</button>' : '<button class="btn" id="ic-reopen"' + dis('operations.incidents') + '>' + ic('refresh') + 'Reabrir</button>') }) +
      (i.severity === 'critica' && open ? UI.alert('bad', '<b>Incidencia crítica.</b> Alerta enviada a gerencia. No puede cerrarse sin resolución registrada y al menos una evidencia (PROC-037).') : '') +
      UI.card('', UI.flow(INC_STEPS, incStep(i))) +
      '<div class="grid g-2-1"><div class="stack">' + UI.card('Detalle', '<p class="small" style="margin-bottom:12px">' + esc(i.desc) + '</p>' + UI.dl([['Tipo', esc(i.type)], ['Severidad', UI.badge(i.severity)], ['Estado', UI.badge(i.status)], ['Responsable', UI.userChip(i.assignee)], ['Reportada por', esc(Q.userName(i.reportedBy))], ['Reserva', res ? resLink(res.id) + ' · ' + esc(res.title) : '—'], ['Orden operativa', op ? opLink(op.id) + ' ' + UI.badge(op.status) : '—'], ['Cliente', res ? cliLink(res.clientId) : '—'], ['Resolución', i.resolution ? esc(i.resolution) + '<div class="xs faint">' + datetime(i.resolvedAt) + '</div>' : '<span class="faint">Pendiente</span>']])) +
      UI.card('Bitácora', UI.timeline(i.log.slice().reverse().map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(Q.userName(l.u)), icon: /alerta|crític/i.test(l.m) ? 'zap' : /resol/i.test(l.m) ? 'checkCircle' : /evidencia/i.test(l.m) ? 'camera' : 'msg' }))) + '<div class="divider" style="margin:10px 0 12px"></div><div class="field"><label for="ic-cm">Agregar comentario</label><textarea class="input" id="ic-cm" rows="2" placeholder="Acción realizada, coordinación con proveedor, contacto con el pasajero…"' + (can ? '' : ' disabled') + '></textarea></div><div class="row end" style="margin-top:8px"><button class="btn sm primary" id="ic-add"' + dis('operations.incidents') + '>' + ic('send') + 'Comentar</button></div>') + '</div>' +
      '<div class="stack">' + UI.card('SLA', slaHtml(i)) +
      UI.card('Evidencias (' + (i.evidence || []).length + ')', ((i.evidence || []).length ? '<div class="list">' + i.evidence.map(n => '<div class="list-item" style="padding:8px 0"><div class="ico-box">' + ic(/\.pdf$/i.test(n) ? 'file' : 'image') + '</div><div class="grow small mono" style="overflow-wrap:anywhere">' + esc(n) + '</div></div>').join('') + '</div>' : '<div class="small faint">Sin evidencias.</div>') + '<div class="field" style="margin-top:10px"><label for="ic-file">Adjuntar evidencia</label><input class="input" type="file" id="ic-file" multiple accept="image/*,application/pdf" style="padding:6px"' + (can ? '' : ' disabled') + '></div><button class="btn sm" id="ic-up" style="margin-top:8px"' + dis('operations.incidents') + '>' + ic('upload') + 'Registrar evidencia</button>') +
      UI.card('Notificaciones enviadas', notifs.length ? '<div class="list">' + notifs.map(n => '<div class="list-item" style="padding:8px 0"><div class="ico-box ' + (n.event.includes('critica') ? 'bad' : '') + '">' + ic({ Email: 'mail', WhatsApp: 'msg', Push: 'phone', Portal: 'globe' }[n.channel] || 'bell') + '</div><div class="grow"><div class="small">' + esc(n.channel) + ' → ' + esc(Q.user(n.to) ? Q.userName(n.to) : n.to) + '</div><div class="xs faint">' + datetime(n.ts) + ' · ' + esc(n.event) + '</div></div>' + UI.badge(n.status) + '</div>').join('') + '</div>' : '<div class="small faint">Sin notificaciones.</div>') + '</div></div></div>';
    const q = (s) => el.querySelector(s);
    const log = (m) => i.log.push({ ts: nowStr(), u: Auth.user.id, m });
    if (q('#ic-take')) q('#ic-take').onclick = () => { if (!guard('operations.incidents')) return; const b = i.status; i.status = 'en_proceso'; if (!i.assignee) i.assignee = Auth.user.id; log('Estado: en proceso'); Audit.log('Incidencia', i.id, 'cambio_estado', b, 'en_proceso'); Store.save(); rerender(); };
    q('#ic-asg').onclick = () => { if (!guard('operations.incidents')) return; UI.modal({ title: 'Asignar responsable', size: 'sm', body: UI.form([{ id: 'u', label: 'Responsable', type: 'select', options: opUsers().map(u => [u.id, u.name + ' — ' + Q.roleName(u.role)]), value: i.assignee, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Asignar', cls: 'primary', onClick: (m) => { const u = m.querySelector('#u').value; const b = i.assignee; i.assignee = u; log('Asignada a ' + Q.userName(u)); Audit.log('Incidencia', i.id, 'asignar', b, u); Notify.push('incidencia.asignada', 'Push', Q.userName(u), i.id + ' asignada: ' + i.title); Store.save(); UI.toast('Responsable asignado y notificado.'); rerender(); } }] }); };
    q('#ic-sev').onclick = () => { if (!guard('operations.incidents')) return; UI.modal({ title: 'Reclasificar incidencia', size: 'sm', body: UI.form([{ id: 'sev', label: 'Severidad', type: 'select', options: ['baja', 'media', 'alta', 'critica'].map(s => [s, UI.statusLabel(s)]), value: i.severity, col: 12 }, { id: 'tp', label: 'Tipo', type: 'select', options: INC_TYPES, value: i.type, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { const f = UI.formData(m); const b = i.severity; i.severity = f.sev; i.type = f.tp; log('Reclasificada: ' + UI.statusLabel(b) + ' → ' + UI.statusLabel(f.sev) + ' · ' + f.tp); Audit.log('Incidencia', i.id, 'reclasificar', b, f.sev); if (f.sev === 'critica' && b !== 'critica') { const mg = manager(); Notify.push('incidencia.critica', 'Push', mg.name, 'ALERTA CRÍTICA ' + i.id + ' — ' + i.title); Notify.push('incidencia.critica', 'WhatsApp', mg.phone, 'ALERTA CRÍTICA ' + i.id + ' — ' + i.title); log('Alerta crítica enviada a gerencia (push + WhatsApp).'); UI.toast('Escalada a crítica: alerta enviada a gerencia.', 'warn'); } Store.save(); rerender(); } }] }); };
    if (q('#ic-res')) q('#ic-res').onclick = () => { if (!guard('operations.incidents')) return; UI.modal({ title: 'Registrar resolución', body: UI.form([{ id: 'r', label: 'Resolución aplicada', type: 'textarea', rows: 4, required: true, value: i.resolution || '', col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Marcar como resuelta', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const b = i.status; i.resolution = m.querySelector('#r').value.trim(); i.resolvedAt = nowStr(); i.status = 'resuelta'; log('Resolución registrada: ' + i.resolution); Audit.log('Incidencia', i.id, 'resolver', b, 'resuelta'); Store.save(); UI.toast('Incidencia resuelta. Adjunte evidencia y ciérrela.'); rerender(); } }] }); };
    if (q('#ic-close')) q('#ic-close').onclick = () => {
      if (!guard('operations.incidents')) return;
      if (['critica', 'alta'].includes(i.severity) && !i.resolution) { UI.toast('PROC-037: una incidencia ' + UI.statusLabel(i.severity).toLowerCase() + ' no puede cerrarse sin resolución registrada.', 'bad'); return; }
      if (i.severity === 'critica' && !(i.evidence || []).length) { UI.toast('PROC-037: la incidencia crítica requiere al menos una evidencia para cerrarse.', 'bad'); return; }
      UI.confirm({ title: 'Cerrar incidencia ' + i.id, message: 'La incidencia quedará cerrada y registrada en la bitácora de la operación.', reason: !i.resolution, reasonLabel: 'Comentario de cierre', confirmLabel: 'Cerrar', onConfirm: (r) => { const b = i.status; i.status = 'cerrada'; i.closedAt = nowStr(); if (!i.resolution) { i.resolution = r; i.resolvedAt = nowStr(); } log('Incidencia cerrada' + (r ? ': ' + r : '')); Audit.log('Incidencia', i.id, 'cerrar', b, 'cerrada'); if (i.severity === 'critica') Notify.push('incidencia.cerrada', 'Push', manager().name, i.id + ' cerrada: ' + i.title); Store.save(); UI.toast('Incidencia cerrada.'); rerender(); } });
    };
    if (q('#ic-reopen')) q('#ic-reopen').onclick = () => { if (!guard('operations.incidents')) return; UI.confirm({ title: 'Reabrir incidencia', message: 'La incidencia volverá a estado en proceso.', reason: true, onConfirm: (r) => { i.status = 'en_proceso'; i.closedAt = null; log('Reabierta: ' + r); Audit.log('Incidencia', i.id, 'reabrir', 'cerrada', 'en_proceso'); Store.save(); rerender(); } }); };
    q('#ic-add').onclick = () => { if (!guard('operations.incidents')) return; const t = q('#ic-cm').value.trim(); if (!t) { UI.toast('Escriba un comentario.', 'warn'); return; } log(t); Store.save(); rerender(); };
    q('#ic-up').onclick = () => { if (!guard('operations.incidents')) return; const fs = [...(q('#ic-file').files || [])]; if (!fs.length) { UI.toast('Seleccione un archivo.', 'warn'); return; } i.evidence = i.evidence || []; fs.forEach(f => i.evidence.push(f.name)); log('Evidencia adjunta: ' + fs.map(f => f.name).join(', ')); Audit.log('Evidencia', i.id, 'upload', '', fs.map(f => f.name).join(', ')); Store.save(); UI.toast('Evidencia registrada.'); rerender(); };
  }

  /* ======================================================================
     APP OPERADOR (PROC-056, PROC-036, PROC-058)
     ====================================================================== */
  const mob = { res: 'G02', screen: 'hoy', sel: null, incPre: null };
  let mobEl = null, paxEl = null;
  function md() { if (!DB.mobileOps) DB.mobileOps = { offline: false, outbox: [], history: [], lastSync: '2026-09-29 04:12' }; return DB.mobileOps; }
  function curRes() {
    const u = Auth.user;
    if (u && (u.role === 'guide' || u.role === 'driver')) { const own = Auth.resourceId; if (own) return own; const r = DB.guides.find(g => g.userId === u.id) || DB.drivers.find(d => d.userId === u.id); return r ? r.id : null; }
    return mob.res;
  }
  const rObj = (id) => Q.guide(id) || Q.driver(id);
  const myAssign = (rid) => allAssign().filter(({ a }) => a.guideId === rid || a.driverId === rid).sort((x, y) => (x.a.date + x.a.time).localeCompare(y.a.date + y.a.time));
  const ACT = { confirm: 'Confirmar asignación', start: 'Iniciar servicio', checkin: 'Check-in de pasajero', checkinAll: 'Check-in de todo el grupo', evidence: 'Registrar evidencia', incident: 'Reportar incidencia', finish: 'Finalizar servicio' };
  const EXEC = ['Asignado', 'Confirmado', 'Inicio', 'Check-in', 'Evidencia', 'Fin'];
  function execIdx(op, a) {
    if (a.status === 'completada') return 6;
    if (a.status === 'pendiente' || a.status === 'asignada') return 1;
    if (a.status === 'confirmada') return 2;
    const ck = a.paxCheckin && Object.keys(a.paxCheckin).length;
    const ev = evList(op).some(e => e.serviceId === a.serviceId);
    return !ck ? 3 : !ev ? 4 : 5;
  }
  function applyAction(x) {
    const op = Q.operation(x.opId); if (!op) return;
    const a = (op.assignments || []).find(z => z.serviceId === x.serviceId); const res = resOf(op); const s = svcOf(res, x.serviceId);
    const r = rObj(x.rid) || {};
    if (x.type === 'confirm' && a) a.status = 'confirmada';
    if (x.type === 'start' && a) { a.status = 'en_curso'; a.startedAt = x.ts; if (s) s.status = 'en_curso'; if (!['en_ejecucion', 'completada'].includes(op.status)) op.status = 'en_ejecucion'; if (res.status === 'confirmada') res.status = 'en_operacion'; }
    if ((x.type === 'checkin' || x.type === 'checkinAll') && a) { a.paxCheckin = a.paxCheckin || {}; const names = x.type === 'checkinAll' ? res.passengers.map(p => p.name) : [x.payload.pax]; names.forEach(n => { if (x.payload.undo) delete a.paxCheckin[n]; else if (!a.paxCheckin[n]) a.paxCheckin[n] = x.ts; }); const vals = Object.values(a.paxCheckin).sort(); a.checkin = vals[0] || null; }
    if (x.type === 'evidence') evList(op).push({ name: x.payload.name, serviceId: x.serviceId, ts: x.ts, user: r.name || 'App operador', source: 'App operador' + (x.offline ? ' (offline)' : '') });
    if (x.type === 'incident') { const inc = createIncident({ opId: op.id, type: x.payload.type, severity: x.payload.severity, title: x.payload.title, desc: x.payload.desc, evidence: x.payload.photo ? ['foto_' + x.serviceId + '_' + x.ts.replace(/\D/g, '').slice(-4) + '.jpg'] : [], reportedBy: r.userId || Auth.user.id, serviceId: x.serviceId, via: 'app operador' + (x.offline ? ' (sin conexión)' : '') }, false); x.payload.incId = inc.id; }
    if (x.type === 'finish' && a) { a.status = 'completada'; a.finishedAt = x.ts; if (s) s.status = 'completado'; }
    Store.save();
  }
  function sideEffects(x) {
    const op = Q.operation(x.opId); const r = rObj(x.rid) || {}; const co = Q.user(op && op.coordinator);
    Audit.log('App operador', x.opId + '/' + x.serviceId, x.type, x.offline ? 'offline ' + x.ts : '', ACT[x.type] + (x.payload && x.payload.pax ? ' · ' + x.payload.pax : '') + ' · ' + (r.name || ''));
    if (x.type === 'confirm') Notify.push('asignacion.confirmada', 'Push', co ? co.id : 'U05', (r.name || 'Recurso') + ' confirmó ' + x.serviceId);
    if (x.type === 'start') Notify.push('servicio.iniciado', 'Push', co ? co.id : 'U05', 'Servicio iniciado ' + x.serviceId + ' (' + x.opId + ')');
    if (x.type === 'finish') Notify.push('servicio.finalizado', 'Push', co ? co.id : 'U05', 'Servicio finalizado ' + x.serviceId + ' (' + x.opId + ')');
    if (x.type === 'incident' && x.payload.incId) { const inc = DB.incidents.find(i => i.id === x.payload.incId); if (inc) notifyIncident(inc); }
    Store.save();
  }
  function runAction(type, op, a, payload) {
    const m = md(); const rid = curRes();
    const x = { id: 'OBX-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(), type, rid, opId: op.id, serviceId: a.serviceId, payload: payload || {}, ts: nowStr(), key: type + ':' + op.id + ':' + a.serviceId + ':' + ((payload && payload.pax) || ''), state: 'pending', offline: m.offline };
    if (m.offline) { const dup = m.outbox.findIndex(z => z.key === x.key && (type === 'checkin' || type === 'confirm')); if (dup >= 0) m.outbox.splice(dup, 1); }
    applyAction(x);
    if (m.offline) { m.outbox.push(x); UI.toast('Sin conexión: «' + ACT[type] + '» guardada en la bandeja de salida.', 'warn'); }
    else { x.state = 'synced'; x.syncedAt = nowStr(); sideEffects(x); m.history.unshift(x); m.history = m.history.slice(0, 30); m.lastSync = nowStr(); UI.toast(ACT[type] + ': sincronizado.'); }
    Store.save(); paintOp();
  }
  const CONFLICT = {
    checkin: 'El conductor registró el check-in del mismo pasajero desde otro dispositivo. Regla: idempotencia por pasajero + servicio; se conserva la marca de tiempo más temprana.',
    checkinAll: 'Parte del grupo ya tenía check-in en el servidor. Regla: idempotencia por pasajero + servicio; se conservan las marcas más tempranas.',
    confirm: 'El coordinador ya había confirmado la asignación desde la web. Regla: operación idempotente; se descarta el duplicado sin error.',
    start: 'El servidor tenía la hora de inicio planificada modificada por el coordinador. Regla: el backend es fuente de verdad para la planificación; el dispositivo, para los hechos de campo. Se conserva la hora real de inicio.',
    finish: 'El servidor registraba el servicio en curso (versión anterior). Regla: la transición registrada en campo prevalece si es válida en la máquina de estados (PROC-036).',
    evidence: 'Ya existía en el servidor un archivo con el mismo hash. Regla: deduplicación por hash; se asocia la evidencia existente.',
    incident: 'El coordinador registró una incidencia similar en los últimos 10 minutos. Regla: no se fusiona automáticamente; se crea vinculada y se notifica para revisión.'
  };
  function goOnline() {
    const m = md(); m.offline = false;
    if (!m.outbox.length) { m.lastSync = nowStr(); Store.save(); UI.toast('Conexión restablecida. Sin acciones pendientes.'); paintOp(); return; }
    m.outbox.forEach(x => { x.state = 'syncing'; x.attempts = (x.attempts || 0) + 1; }); Store.save(); paintOp();
    setTimeout(() => {
      m.outbox.forEach((x, i) => { if (i === 0) { x.state = 'conflict'; x.conflict = CONFLICT[x.type]; } else { x.state = 'synced'; x.syncedAt = nowStr(); sideEffects(x); } });
      Store.save(); paintOp();
      setTimeout(() => {
        const c = m.outbox[0]; if (c) { c.state = 'synced'; c.resolved = true; c.syncedAt = nowStr(); sideEffects(c); }
        const n = m.outbox.length; m.history = m.outbox.slice().reverse().concat(m.history).slice(0, 30); m.outbox = []; m.lastSync = nowStr(); Store.save(); paintOp();
        UI.toast('Sincronización completa: ' + n + ' acción(es), 1 conflicto resuelto por regla de negocio.');
      }, 1500);
    }, 1100);
  }
  function setOffline(v) { const m = md(); if (v) { m.offline = true; Store.save(); UI.toast('Modo sin conexión: las acciones se guardarán en la bandeja de salida (Outbox).', 'warn'); paintOp(); } else goOnline(); }
  const SST = { pending: ['Pending', 'warn'], syncing: ['Syncing', 'info'], synced: ['Synced', 'ok'], conflict: ['Conflict', 'bad'], failed: ['Failed', 'bad'] };
  const syncBadge = (st, res) => '<span class="badge b-' + SST[st][1] + '">' + SST[st][0] + (res ? ' · resuelto' : '') + '</span>';
  function netChip() { const m = md(); const syncing = m.outbox.some(x => x.state === 'syncing' || x.state === 'conflict'); return '<button class="m-net' + (m.offline ? ' off' : syncing ? ' sync' : '') + '" data-net title="' + (Auth.isExternal ? 'Estado de red del dispositivo · cambiar en Perfil' : 'Cambiar conectividad (demo)') + '"><i></i>' + (m.offline ? 'Sin conexión' + (m.outbox.length ? ' · ' + m.outbox.length : '') : syncing ? 'Sincronizando…' : 'En línea') + '</button>'; }

  function opCard({ op, a }) {
    const res = resOf(op); const s = svcOf(res, a.serviceId) || {};
    return '<div class="m-card click" data-open="' + op.id + '|' + a.serviceId + '"><div class="row between" style="flex-wrap:nowrap"><span class="m-time">' + esc(a.time) + '</span>' + UI.badge(a.status) + '</div><div class="t">' + esc(a.service) + '</div><div class="s">' + dowOf(a.date) + ' ' + dateShort(a.date) + ' · ' + res.passengers.length + ' pax · ' + esc(res.title) + '</div><div class="s">' + ic('pin') + ' ' + (pickupApplies(res, s) ? '<b>Recojo:</b> ' : '') + esc(meetingPoint(res, s)) + (pickupApplies(res, s) && pickupOf(res).flight ? ' · vuelo ' + esc(pickupOf(res).flight) : '') + '</div>' + (clientComments(res) ? '<div class="s" style="color:var(--sun)">' + ic('msg') + ' ' + esc(clientComments(res)) + '</div>' : '') + '</div>';
  }
  function scrHoy(rid) {
    const r = rObj(rid); const list = myAssign(rid); const m = md();
    const today = list.filter(x => x.a.date === T()); const next = list.filter(x => x.a.date > T()); const past = list.filter(x => x.a.date < T()).slice(-2).reverse();
    const toConfirm = list.filter(x => x.a.status === 'asignada').length;
    return '<div class="m-pad"><div class="m-hero"><div class="xs">' + DOW[parseD(T()).getDay()] + ' ' + date(T()) + '</div><h3>Hola, ' + esc(r.name.split(' ')[0]) + '</h3><div class="row" style="gap:14px"><span class="small"><b>' + today.length + '</b> hoy</span><span class="small"><b>' + next.length + '</b> próximos</span><span class="small"><b>' + toConfirm + '</b> por confirmar</span></div></div>' +
      (m.offline ? UI.alert('warn', '<b>Sin conexión.</b> ' + m.outbox.length + ' acción(es) en cola. Se sincronizarán al reconectar.', 'wifiOff') : '<div class="xs faint row" style="gap:6px">' + ic('sync') + 'Última sincronización ' + datetime(m.lastSync) + '</div>') +
      (DB.incidents.some(i => i.severity === 'critica' && isOpenInc(i) && list.some(x => x.op.id === i.opId && x.a.date >= T())) ? UI.alert('bad', '<b>Alerta operativa:</b> ' + esc(DB.incidents.find(i => i.severity === 'critica' && isOpenInc(i) && list.some(x => x.op.id === i.opId)).title) + '. Espere indicaciones del coordinador.') : '') +
      '<div class="m-h">Hoy</div>' + (today.length ? today.map(opCard).join('') : '<div class="m-card"><div class="s">Sin servicios asignados para hoy.</div></div>') +
      '<div class="m-h">Próximos</div>' + (next.length ? next.map(opCard).join('') : '<div class="m-card"><div class="s">Sin servicios próximos.</div></div>') +
      (past.length ? '<div class="m-h">Recientes</div>' + past.map(opCard).join('') : '') + '</div>';
  }
  function scrDetalle(rid) {
    const op = Q.operation(mob.sel.opId); const a = op && op.assignments.find(x => x.serviceId === mob.sel.serviceId);
    if (!a || (a.guideId !== rid && a.driverId !== rid)) { mob.screen = 'hoy'; mob.sel = null; return scrHoy(rid); }
    const res = resOf(op); const s = svcOf(res, a.serviceId) || {}; const k = execIdx(op, a);
    const partner = Q.guide(rid) ? (a.driverId ? 'Conductor: ' + dName(a.driverId) + ' · ' + (Q.driver(a.driverId) || {}).phone : 'Sin conductor asignado') : (a.guideId ? 'Guía: ' + gName(a.guideId) + ' · ' + (Q.guide(a.guideId) || {}).phone : 'Sin guía asignado');
    const ck = a.paxCheckin || {}; const nCk = res.passengers.filter(p => ck[p.name]).length;
    const running = a.status === 'en_curso'; const done = a.status === 'completada';
    const ev = evList(op).filter(e => e.serviceId === a.serviceId);
    const diets = res.passengers.filter(p => p.diet);
    const incs = DB.incidents.filter(i => i.opId === op.id && isOpenInc(i));
    let actions = '';
    if (a.status === 'pendiente' || a.status === 'asignada') actions = '<button class="m-btn primary" data-act="confirm">' + ic('check') + 'Confirmar asignación</button>';
    else if (a.status === 'confirmada') actions = '<button class="m-btn primary" data-act="start">' + ic('arrowRight') + 'Iniciar servicio</button>';
    else if (running) actions = '<div class="m-grid2"><button class="m-btn" data-act="checkinAll">' + ic('users') + 'Check-in grupal</button><button class="m-btn" data-act="evidence">' + ic('camera') + 'Evidencia</button></div><button class="m-btn warn" data-act="incident">' + ic('alert') + 'Reportar incidencia</button><button class="m-btn ok" data-act="finish">' + ic('checkCircle') + 'Finalizar servicio</button>';
    else if (done) actions = UI.alert('ok', 'Servicio finalizado' + (a.finishedAt ? ' el ' + datetime(a.finishedAt) : '') + '.');
    return '<div class="m-pad"><div><div class="row between" style="flex-wrap:nowrap"><span class="m-time">' + esc(a.time) + ' · ' + dowOf(a.date) + ' ' + dateShort(a.date) + '</span>' + UI.badge(a.status) + '</div><h3 style="margin-top:4px">' + esc(a.service) + '</h3><div class="xs faint">' + esc(res.title) + ' · ' + esc(op.id) + '</div></div>' +
      '<div><div class="m-steps">' + EXEC.map((x, i) => '<span class="' + (i < k ? 'on' : i === k ? 'cur' : '') + '"></span>').join('') + '</div><div class="xs faint" style="margin-top:4px">' + (k >= 6 ? 'Completado' : 'Paso actual: ' + EXEC[Math.min(k, 5)]) + ' · PROC-036</div></div>' +
      actions +
      (!running && !done && a.status !== 'pendiente' && a.status !== 'asignada' ? '<button class="m-btn warn" data-act="incident">' + ic('alert') + 'Reportar incidencia</button>' : '') +
      '<div class="m-card"><div class="m-row">' + ic('pin') + '<div class="grow"><div class="xs faint">Punto de encuentro</div><div class="small">' + esc(meetingPoint(res, s)) + '</div></div></div><div class="m-row">' + ic('truck') + '<div class="grow"><div class="xs faint">Vehículo</div><div class="small">' + (esc(vLabel(a.vehicleId)) || 'Sin vehículo') + '</div></div></div><div class="m-row">' + ic('user') + '<div class="grow"><div class="xs faint">Equipo</div><div class="small">' + esc(partner) + '</div></div></div><div class="m-row">' + ic('phoneCall') + '<div class="grow"><div class="xs faint">Coordinador</div><div class="small">' + esc(Q.userName(op.coordinator)) + ' · ' + esc(coordPhone(op)) + '</div></div><button class="btn xs" data-call="' + esc(coordPhone(op)) + '">Llamar</button></div></div>' +
      (pickupApplies(res, s) ? '<div class="m-card" style="border-color:var(--accent)"><div class="xs faint">Recojo del cliente (reserva web)</div><div class="small"><b>' + esc(meetingPoint(res, s)) + '</b></div>' + (pickupOf(res).flight ? '<div class="small">Vuelo ' + esc(pickupOf(res).flight) + (pickupOf(res).arrival ? ' · llega ' + esc(arrTime(pickupOf(res))) : '') + '</div>' : '') + '<div class="xs faint">Cartel: ' + esc((res.passengers.find(x => x.isLead) || res.passengers[0] || {}).name || '') + ' · ' + res.passengers.length + ' pax</div></div>' : '') +
      (clientComments(res) ? '<div class="m-card" style="border-color:var(--sun)"><div class="xs faint">Comentarios del cliente</div><div class="small">' + esc(clientComments(res)) + '</div><div class="row" style="gap:4px;margin-top:4px">' + tagsHtml(res) + '</div></div>' : '') +
      (res.notes || diets.length || incs.length ? '<div class="m-card"><div class="xs faint">Notas</div>' + (res.notes ? '<div class="small">' + esc(res.notes) + '</div>' : '') + (diets.length ? '<div class="small">Dietas: ' + diets.map(p => esc(p.name.split(' ')[0]) + ' (' + esc(p.diet) + ')').join(', ') + '</div>' : '') + incs.map(i => '<div class="small bad">' + esc(i.id) + ': ' + esc(i.title) + '</div>').join('') + '</div>' : '') +
      '<div class="m-h">Pasajeros · check-in ' + nCk + '/' + res.passengers.length + '</div><div class="m-card">' + res.passengers.map(p => '<div class="m-row"><button class="m-chk' + (ck[p.name] ? ' on' : '') + '" data-ck="' + esc(p.name) + '"' + (running ? '' : ' disabled') + ' aria-label="Check-in ' + esc(p.name) + '">' + ic('check') + '</button><div class="grow" style="min-width:0"><div class="small" style="font-weight:600">' + esc(p.name) + '</div><div class="xs faint">' + esc(p.doc) + (p.diet ? ' · ' + esc(p.diet) : '') + (ck[p.name] ? ' · ' + esc(ck[p.name].split(' ')[1]) : '') + '</div></div></div>').join('') + (!running && !done ? '<div class="xs faint" style="padding-top:6px">El check-in se habilita al iniciar el servicio.</div>' : '') + '</div>' +
      '<div class="m-h">Evidencias (' + ev.length + ')</div>' + (ev.length ? '<div class="m-ev">' + ev.map(e => '<div>' + ic('image') + '<span>' + esc(e.name) + '</span></div>').join('') + '</div>' : '<div class="xs faint">Sin evidencias para este servicio.</div>') + '</div>';
  }
  function scrIncForm(rid) {
    const list = myAssign(rid).filter(x => x.a.status !== 'completada' || x.a.date >= addDays(T(), -1));
    const pre = mob.incPre;
    return '<div class="m-pad"><div class="small muted">Registre la incidencia desde campo. Si es crítica, se alerta a gerencia al sincronizar (PROC-037).</div>' +
      '<div class="field"><label for="mi-svc">Servicio</label><select class="input" id="mi-svc">' + list.map(({ op, a }) => '<option value="' + op.id + '|' + a.serviceId + '"' + (pre && pre.opId === op.id && pre.serviceId === a.serviceId ? ' selected' : '') + '>' + esc(dateShort(a.date) + ' · ' + a.service) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mi-type">Tipo</label><select class="input" id="mi-type">' + INC_TYPES.map(t => '<option>' + t + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Severidad</label><div class="m-grid2" id="mi-sev">' + ['baja', 'media', 'alta', 'critica'].map((s, i) => '<label class="check" style="border:1px solid var(--line);border-radius:9px;padding:8px"><input type="radio" name="mi-sev" value="' + s + '"' + (i === 1 ? ' checked' : '') + '> ' + UI.statusLabel(s) + '</label>').join('') + '</div></div>' +
      '<div class="field"><label for="mi-title">Título</label><input class="input" id="mi-title" placeholder="Ej.: Pasajero con síntomas de soroche"></div>' +
      '<div class="field"><label for="mi-desc">Descripción</label><textarea class="input" id="mi-desc" rows="3"></textarea></div>' +
      '<label class="check"><input type="checkbox" id="mi-photo" checked> Adjuntar foto (cámara simulada)</label>' +
      '<button class="m-btn warn" id="mi-send">' + ic('send') + 'Enviar incidencia</button></div>';
  }
  function scrCal(rid) {
    const list = myAssign(rid); const days = Array.from({ length: 7 }, (_, i) => addDays(T(), i));
    const upcoming = list.filter(x => x.a.date >= T() && x.a.date <= addDays(T(), 13));
    const byDay = {}; upcoming.forEach(x => (byDay[x.a.date] = byDay[x.a.date] || []).push(x));
    return '<div class="m-pad"><div class="m-week">' + days.map(d => '<div class="' + (d === T() ? 'today' : '') + '">' + dowOf(d) + '<b>' + parseD(d).getDate() + '</b><i class="' + (list.some(x => x.a.date === d) ? '' : 'no') + '"></i></div>').join('') + '</div>' +
      (Object.keys(byDay).length ? Object.keys(byDay).sort().map(d => '<div class="m-h">' + dowOf(d) + ' ' + date(d) + '</div>' + byDay[d].map(opCard).join('')).join('') : '<div class="m-card"><div class="s">Sin servicios en los próximos 14 días.</div></div>') + '</div>';
  }
  function scrInc(rid) {
    const r = rObj(rid); const ops = new Set(myAssign(rid).map(x => x.op.id));
    const list = DB.incidents.filter(i => ops.has(i.opId) || (r.userId && i.reportedBy === r.userId));
    return '<div class="m-pad"><button class="m-btn warn" data-newinc>' + ic('plus') + 'Reportar incidencia</button>' + (list.length ? list.map(i => '<div class="m-card"><div class="row between" style="flex-wrap:nowrap"><span class="mono xs">' + esc(i.id) + '</span>' + UI.badge(i.severity) + '</div><div class="t">' + esc(i.title) + '</div><div class="s">' + esc(i.type) + ' · ' + datetime(i.createdAt) + '</div><div>' + UI.badge(i.status) + '</div></div>').join('') : '<div class="m-card"><div class="s">Sin incidencias en sus servicios.</div></div>') + '</div>';
  }
  function scrPerfil(rid) {
    const r = rObj(rid); const m = md(); const g = Q.guide(rid);
    return '<div class="m-pad"><div class="m-card" style="justify-items:center;text-align:center;padding:16px">' + UI.avatar(r.userId ? Q.user(r.userId) : r.name, 'lg') + '<div class="t" style="margin-top:6px">' + esc(r.name) + '</div><div class="s">' + (g ? 'Guía oficial · ' + g.languages.join(', ') : 'Conductor') + '</div>' + UI.badge(r.status) + '</div>' +
      '<div class="m-card">' + UI.dl(g ? [['Carné', esc(g.license)], ['Calificación', fmtN(g.rating, 1) + ' / 5'], ['Teléfono', esc(g.phone)]] : [['Licencia', esc(r.license)], ['Vence', date(r.expires) + (daysFromToday(r.expires) <= 30 ? ' ' + UI.badge('alta', 'Por vencer') : '')], ['Teléfono', esc(r.phone)]]) + '</div>' +
      '<div class="m-h">Red del dispositivo</div><div class="m-card"><label class="switch"><input type="checkbox" id="m-off"' + (m.offline ? ' checked' : '') + '> Sin conexión (modo offline)</label><div class="xs faint">Las acciones sin señal se guardan en el teléfono y se sincronizan al reconectar. Última sincronización: ' + datetime(m.lastSync) + '</div></div>' +
      '<div class="m-h">Bandeja de salida (' + m.outbox.length + ')</div><div class="m-card">' + (m.outbox.length ? m.outbox.map(x => '<div class="m-q"><div class="grow"><div style="font-weight:600">' + ACT[x.type] + (x.payload.pax ? ' · ' + esc(x.payload.pax.split(' ')[0]) : '') + '</div><div class="faint">' + esc(x.serviceId) + ' · ' + esc(x.ts.split(' ')[1]) + '</div>' + (x.conflict ? '<div class="bad" style="margin-top:3px">' + esc(x.conflict) + '</div>' : '') + '</div>' + syncBadge(x.state) + '</div>').join('') : '<div class="xs faint">Sin acciones pendientes.</div>') + '</div>' +
      '<div class="m-h">Sincronizadas recientemente</div><div class="m-card">' + (m.history.length ? m.history.slice(0, 6).map(x => '<div class="m-q"><div class="grow"><div style="font-weight:600">' + ACT[x.type] + '</div><div class="faint">' + esc(x.serviceId) + ' · ' + esc((x.syncedAt || x.ts).split(' ')[1]) + (x.offline ? ' · offline' : '') + '</div>' + (x.resolved ? '<div class="faint" style="margin-top:3px">' + esc(x.conflict || '') + '</div>' : '') + '</div>' + syncBadge('synced', x.resolved) + '</div>').join('') : '<div class="xs faint">Aún no hay acciones.</div>') + '</div></div>';
  }
  const OP_INFO = {
    hoy: ['Inicio del operador', 'Servicios asignados del día y próximos con su estado. El recurso ve solo lo que le fue asignado desde Operaciones (PROC-033).', 1],
    detalle: ['Detalle del servicio', 'Ejecución guiada con botones grandes: confirmar, iniciar, check-in por pasajero, evidencia, incidencia y fin (PROC-036). Cada acción actualiza la orden 360 en la web.', 4],
    incForm: ['Reportar incidencia', 'Registro en campo con tipo, severidad y foto simulada. Una incidencia crítica dispara alerta a gerencia (PROC-037).', 8],
    cal: ['Calendario', 'Agenda de 14 días del recurso, derivada de las asignaciones de las órdenes operativas.', 2],
    inc: ['Incidencias', 'Incidencias de las órdenes en las que participa el recurso y las que reportó.', 8],
    perfil: ['Perfil y sincronización', 'Datos del recurso, vigencia documentaria, interruptor offline y bandeja de salida con estados Pending → Syncing → Synced / Conflict (PROC-058).', 10]
  };
  const PROC56 = ['Login', 'Dashboard', 'Calendario', 'Asignación', 'Servicio', 'Pasajeros', 'Check-in', 'Inicio', 'Incidencia / evidencia', 'Fin', 'Sync'];
  function opPanel(rid) {
    const m = md(); const inf = OP_INFO[mob.screen] || OP_INFO.hoy; const isRes = Auth.user && ['guide', 'driver'].includes(Auth.user.role);
    const cnt = (st) => m.outbox.filter(x => x.state === st).length;
    const sel = mob.screen === 'detalle' && mob.sel ? Q.operation(mob.sel.opId) : null;
    return '<div class="stack mob-panel">' + UI.card(esc(inf[0]), '<p class="small muted">' + inf[1] + '</p><div class="upper" style="margin:12px 0 6px">PROC-056 · App operador</div><ol>' + PROC56.map((s, i) => '<li class="' + (i < inf[2] ? 'done' : i === inf[2] ? 'cur' : '') + '">' + s + '</li>').join('') + '</ol>', { sub: 'Pantalla actual' }) +
      UI.card('Controles de la demo', (isRes ? '<div class="small muted">Sesión de ' + esc(Auth.user.name) + ': la app muestra su propio recurso.</div>' : '<div class="field"><label for="mp-res">Ver como recurso</label><select class="input" id="mp-res">' + DB.guides.map(g => '<option value="' + g.id + '"' + (g.id === rid ? ' selected' : '') + '>' + esc(g.name) + ' — guía</option>').join('') + DB.drivers.map(d => '<option value="' + d.id + '"' + (d.id === rid ? ' selected' : '') + '>' + esc(d.name) + ' — conductor</option>').join('') + '</select></div>') +
        '<div style="margin-top:12px"><label class="switch"><input type="checkbox" id="mp-off"' + (m.offline ? ' checked' : '') + '> Sin conexión</label><div class="xs faint" style="margin-top:4px">Al desactivarlo se sincroniza la bandeja (con un conflicto resuelto de ejemplo).</div></div>' +
        (sel ? '<div style="margin-top:12px"><a class="btn sm" href="#/operaciones/ordenes/' + sel.id + '">' + ic('clipboard') + 'Ver orden ' + sel.id + ' en la web</a></div>' : '')) +
      UI.card('Sincronización offline · PROC-058', '<div class="row" style="gap:6px;margin-bottom:10px"><span class="st-pill">Pending <b>' + cnt('pending') + '</b></span><span class="st-pill">Syncing <b>' + cnt('syncing') + '</b></span><span class="st-pill">Conflict <b>' + cnt('conflict') + '</b></span><span class="st-pill">Synced <b>' + m.history.length + '</b></span></div><div class="small muted">Cache → Acción local → Outbox → Pending → Syncing → Synced / Failed / Conflict. Idempotencia por clave de acción, reintentos con backoff y resolución de conflictos por reglas de negocio. El móvil no duplica reglas del backend (Regla transversal 19).</div><div class="xs faint" style="margin-top:8px">Última sincronización: <b>' + datetime(m.lastSync) + '</b></div>') + '</div>';
  }
  function paintOp() {
    if (!mobEl || App.current !== 'mobile/operador' || !document.body.contains(mobEl)) return;
    const body = mobEl.querySelector('.phone-body'); const keep = body && mobEl.dataset.scr === mob.screen ? body.scrollTop : 0;
    renderOperador(mobEl);
    const nb = mobEl.querySelector('.phone-body'); if (nb) nb.scrollTop = keep;
  }
  function renderOperador(el) {
    css(); mobEl = el; el.dataset.scr = mob.screen;
    const rid = curRes(); const r = rObj(rid); const ext = Auth.isExternal;
    if (!r) { el.innerHTML = '<div class="page op-pg">' + UI.card('', UI.empty(ext ? 'Su usuario no está vinculado a un recurso operativo. Comuníquese con la coordinación de operaciones.' : 'Recurso no encontrado.', 'user')) + '</div>'; return; }
    const titles = { hoy: 'Mis servicios', detalle: 'Servicio', incForm: 'Nueva incidencia', cal: 'Calendario', inc: 'Incidencias', perfil: 'Perfil' };
    const scr = { hoy: scrHoy, detalle: scrDetalle, incForm: scrIncForm, cal: scrCal, inc: scrInc, perfil: scrPerfil }[mob.screen] || scrHoy;
    const content = scr(rid);
    const back = mob.screen === 'detalle' || mob.screen === 'incForm';
    const tabs = [['hoy', 'Hoy', 'home'], ['cal', 'Calendario', 'calendar'], ['inc', 'Incidencias', 'alert'], ['perfil', 'Perfil', 'user']];
    const m = md();
    const phoneHtml = '<div class="phone"><div class="phone-screen"><div class="phone-notch"><span>' + nowTime() + '</span><span>' + (m.offline ? 'Sin señal' : '4G · 82%') + '</span></div>' +
      '<div class="m-bar">' + (back ? '<button class="m-back" data-back aria-label="Volver">' + ic('chevronLeft') + '</button>' : UI.avatar(r.userId ? Q.user(r.userId) : r.name)) + '<h3>' + titles[mob.screen] + '</h3>' + netChip() + '</div>' +
      '<div class="phone-body">' + content + '</div>' +
      '<div class="phone-tabbar">' + tabs.map(t => '<button class="' + (mob.screen === t[0] || (t[0] === 'hoy' && mob.screen === 'detalle') || (t[0] === 'inc' && mob.screen === 'incForm') ? 'on' : '') + '" data-tab="' + t[0] + '">' + ic(t[2]) + t[1] + (t[0] === 'perfil' && m.outbox.length ? ' (' + m.outbox.length + ')' : '') + '</button>').join('') + '</div></div></div>';
    /* Usuario externo (guía/conductor): solo la app, como en su teléfono, bloqueada a su recurso. Internos: maqueta con panel explicativo y controles. */
    el.innerHTML = ext ? '<div class="page op-pg"><div class="op-app">' + phoneHtml + '</div></div>' :
      '<div class="page op-pg">' + UI.pageHeader({ title: 'App del operador', crumbs: [['Inicio', '#/dashboard'], ['Móvil'], ['App operador']], subtitle: 'Maqueta funcional de la app de guías y conductores: servicios asignados, ejecución en campo, check-in, evidencias, incidencias y modo sin conexión (PROC-056 a PROC-058).', actions: (Access.canRoute('mobile/pasajero') ? '<a class="btn" href="#/mobile/pasajero">' + ic('phone') + 'App pasajero</a>' : '') + (Access.canRoute('operaciones/asignaciones') ? '<a class="btn" href="#/operaciones/asignaciones">' + ic('truck') + 'Asignaciones</a>' : '') }) +
      '<div class="op-mob">' + phoneHtml + opPanel(rid) + '</div></div>';
    const $ = (s) => el.querySelector(s);
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { mob.screen = b.dataset.tab; paintOp(); });
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const [o, s] = b.dataset.open.split('|'); mob.sel = { opId: o, serviceId: s }; mob.screen = 'detalle'; paintOp(); });
    const bk = $('[data-back]'); if (bk) bk.onclick = () => { mob.screen = mob.screen === 'incForm' && mob.sel ? 'detalle' : mob.screen === 'incForm' ? 'inc' : 'hoy'; paintOp(); };
    el.querySelectorAll('[data-net]').forEach(b => b.onclick = () => { if (ext) { mob.screen = 'perfil'; paintOp(); return; } setOffline(!md().offline); });
    const po = $('#mp-off'); if (po) po.onchange = () => setOffline(po.checked);
    const mo = $('#m-off'); if (mo) mo.onchange = () => setOffline(mo.checked);
    const rs = $('#mp-res'); if (rs && !ext) rs.onchange = () => { mob.res = rs.value; mob.screen = 'hoy'; mob.sel = null; paintOp(); };
    el.querySelectorAll('[data-call]').forEach(b => b.onclick = () => UI.toast('Llamando a ' + esc(b.dataset.call) + '…', 'info'));
    const ni = $('[data-newinc]'); if (ni) ni.onclick = () => { mob.incPre = null; mob.screen = 'incForm'; paintOp(); };
    if (mob.screen === 'detalle' && mob.sel) {
      const op = Q.operation(mob.sel.opId); const a = op && op.assignments.find(x => x.serviceId === mob.sel.serviceId);
      if (op && a) {
        el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
          const t = b.dataset.act;
          if (t === 'incident') { mob.incPre = { opId: op.id, serviceId: a.serviceId }; mob.screen = 'incForm'; paintOp(); return; }
          if (t === 'evidence') { const n = evList(op).filter(e => e.serviceId === a.serviceId).length + 1; runAction('evidence', op, a, { name: 'foto_' + a.serviceId + '_' + String(n).padStart(2, '0') + '.jpg' }); return; }
          if (t === 'finish') { const ck = a.paxCheckin ? Object.keys(a.paxCheckin).length : 0; if (!ck) { UI.toast('PROC-036: registre el check-in de al menos un pasajero antes de finalizar.', 'bad'); return; } if (!evList(op).some(e => e.serviceId === a.serviceId)) { UI.toast('PROC-036 / PROC-038: registre al menos una evidencia antes de finalizar.', 'bad'); return; } const res = resOf(op); const miss = res.passengers.length - ck; UI.confirm({ title: 'Finalizar servicio', message: miss ? '<b>' + miss + ' pasajero(s) sin check-in</b> quedarán como no presentados (no-show).' : 'Todos los pasajeros tienen check-in. Se marcará el servicio como completado.', confirmLabel: 'Finalizar', onConfirm: () => runAction('finish', op, a) }); return; }
          runAction(t, op, a);
        });
        el.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { const on = b.classList.contains('on'); runAction('checkin', op, a, { pax: b.dataset.ck, undo: on }); });
      }
    }
    const ms = $('#mi-send');
    if (ms) ms.onclick = () => {
      const [o, s] = ($('#mi-svc').value || '').split('|'); const op = Q.operation(o); const a = op && op.assignments.find(x => x.serviceId === s);
      const title = $('#mi-title').value.trim(); const desc = $('#mi-desc').value.trim();
      if (!a) { UI.toast('Seleccione un servicio.', 'warn'); return; }
      if (!title) { $('#mi-title').classList.add('err'); UI.toast('Indique un título.', 'bad'); return; }
      const sev = (el.querySelector('input[name=mi-sev]:checked') || {}).value || 'media';
      runAction('incident', op, a, { type: $('#mi-type').value, severity: sev, title, desc: desc || title, photo: $('#mi-photo').checked });
      mob.sel = { opId: op.id, serviceId: a.serviceId }; mob.screen = 'inc'; paintOp();
    };
  }

  /* ======================================================================
     APP PASAJERO (PROC-057)
     ====================================================================== */
  const PAX_RES = 'RES-2026-000347';
  const pax = { tab: 'viaje', open: null, voucher: null, msg: null };
  /* Pasajero externo: su propia reserva (Auth.user.resId). Internos: reserva de demostración. */
  const paxResId = () => Auth.role === 'passenger' ? (Auth.user.resId || '') : PAX_RES;
  const paxName = () => Auth.role === 'passenger' ? Auth.user.name : 'Thomas Keller';
  function pd() { if (!DB.paxApp) DB.paxApp = { read: [], chat: [{ from: 'agency', who: 'Karina Huamán (Operaciones Cusco)', ts: '2026-09-29 06:52', m: 'Buenos días, Thomas. Le informamos que se ha anunciado un paro regional para mañana 30/09 en la vía a Ollantaytambo. Estamos evaluando adelantar el recojo a las 03:00 o tomar el tren desde Poroy.' }, { from: 'me', ts: '2026-09-29 07:05', m: 'Gracias. ¿Debemos estar listos a las 03:00 entonces? Anna se siente mejor hoy.' }, { from: 'agency', who: 'Karina Huamán (Operaciones Cusco)', ts: '2026-09-29 07:11', m: 'Le confirmaremos el horario antes de las 20:00 por este chat y por WhatsApp. Por precaución, deje su mochila lista esta noche y lleve los pasaportes originales. Nos alegra que Anna esté mejor.' }] }; return DB.paxApp; }
  function paxAlerts(res) {
    const inc = DB.incidents.find(i => i.id === 'INC-0085');
    const list = [];
    if (inc && inc.resId === res.id) list.push(isOpenInc(inc) ? { id: 'AL-1', ts: '2026-09-29 06:45', tone: 'bad', t: 'Posible cambio de horario — Machu Picchu 30/09', d: 'Paro regional anunciado en la vía Cusco — Ollantaytambo. Su coordinador confirmará hoy antes de las 20:00 el nuevo horario de recojo (propuesta: 03:00) o la salida alternativa en tren desde Poroy.', inc: inc.id } : { id: 'AL-1', ts: inc.closedAt || inc.resolvedAt || nowStr(), tone: 'ok', t: 'Horario confirmado — Machu Picchu 30/09', d: inc.resolution || 'La incidencia de transporte fue resuelta. Revise su itinerario actualizado.', inc: inc.id });
    list.push({ id: 'AL-2', ts: '2026-09-28 20:05', tone: 'info', t: 'Recordatorio: Machu Picchu Full Day', d: 'Lleve pasaporte original (entrada nominativa), casaca impermeable y protector solar. Mochila máx. 20 L.' });
    list.push({ id: 'AL-3', ts: '2026-09-26 18:31', tone: 'warn', t: 'Voucher actualizado: Laguna Humantay (v2)', d: 'Se actualizó el guía asignado. El voucher anterior quedó reemplazado.' });
    list.push({ id: 'AL-4', ts: '2026-09-27 11:40', tone: 'ok', t: 'Bienvenidos a Cusco', d: 'Su traslado al hotel fue completado. Recomendamos descansar y tomar mate de coca para aclimatarse.' });
    DB.vouchers.filter(v => v.resId === res.id && v.history && v.history.length > 1).forEach(v => { const h = v.history[v.history.length - 1]; if (h.ts > '2026-09-28') list.push({ id: 'AL-V' + v.id, ts: h.ts, tone: 'warn', t: 'Voucher actualizado: ' + v.service + ' (v' + h.v + ')', d: h.reason }); });
    return list.sort((a, b) => b.ts.localeCompare(a.ts));
  }
  function paxNext(res) {
    const now = nowStr();
    return res.services.filter(s => s.status !== 'cancelado' && s.providerId && mins(s.time) != null && (s.date + ' ' + s.time) > now && s.status !== 'completado').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  }
  function pViaje(res) {
    const n = daysBetween(res.travelFrom, res.travelTo) + 1; const dIdx = daysBetween(res.travelFrom, T()) + 1;
    const state = T() < res.travelFrom ? 'Faltan ' + daysFromToday(res.travelFrom) + ' días' : T() > res.travelTo ? 'Viaje finalizado' : 'En curso · día ' + dIdx + ' de ' + n;
    const nx = paxNext(res); let cd = '';
    if (nx) { const diff = Math.max(0, (parseD(nx.date + ' ' + nx.time) - parseD(nowStr())) / 60000); const h = Math.floor(diff / 60), mi = Math.round(diff % 60); cd = (h >= 24 ? Math.floor(h / 24) + ' d ' + (h % 24) + ' h' : h + ' h ' + mi + ' min'); }
    const al = paxAlerts(res).find(a => a.tone === 'bad');
    const hotel = hotelOf(res); const rl = roomingList(res.id); const room = rl && rl.rooms.find(r => r.pax.includes(paxName()));
    const op = opOfRes(res.id); const a = op && nx && op.assignments.find(x => x.serviceId === nx.id); const g = a && Q.guide(a.guideId);
    return '<div class="m-pad"><div class="m-hero"><div class="xs">' + esc(res.id) + '</div><h3>Hola, ' + esc(paxName().split(' ')[0]) + '</h3><div class="small">' + esc(res.title) + '</div><div class="xs">' + date(res.travelFrom) + ' → ' + date(res.travelTo) + ' · ' + res.passengers.length + ' viajeros</div><div><span class="badge b-accent">' + state + '</span></div></div>' +
      (al ? '<div class="m-card click" data-ptab="alertas" style="border-color:var(--bad)"><div class="row" style="gap:8px;flex-wrap:nowrap;color:var(--bad)">' + ic('alert') + '<b class="small">' + esc(al.t) + '</b></div><div class="s">' + esc(al.d) + '</div></div>' : '') +
      (nx ? '<div class="m-card"><div class="xs faint">Próxima actividad · en ' + cd + '</div><div class="t">' + esc(nx.name) + '</div><div class="s">' + dowOf(nx.date) + ' ' + date(nx.date) + ' · ' + esc(nx.time) + '</div><div class="s">' + ic('pin') + ' ' + esc(meetingPoint(res, nx)) + '</div>' + (g ? '<div class="s">Guía: ' + esc(g.name) + ' (' + g.languages.join(', ') + ')</div>' : '') + '</div>' : '') +
      (hotel ? '<div class="m-card"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="ico-box violet">' + ic('bed') + '</div><div class="grow"><div class="t">' + esc(hotel.name) + '</div><div class="s">' + (room ? 'Habitación ' + esc(room.room) + ' · ' + esc(room.type) + ' · ' : '') + 'Check-out ' + dateShort(res.travelTo) + '</div></div></div></div>' : '') +
      '<div class="m-grid2"><button class="m-btn" data-ptab="itin">' + ic('route') + 'Itinerario</button><button class="m-btn" data-ptab="vouchers">' + ic('ticket') + 'Vouchers</button><button class="m-btn" data-ptab="soporte">' + ic('msg') + 'Chat agencia</button><button class="m-btn bad" data-sos>' + ic('phoneCall') + 'Emergencia</button>' + pxExtraBtns(res) + '</div></div>';
  }
  function pItin(res) {
    const n = daysBetween(res.travelFrom, res.travelTo) + 1; const hotel = hotelOf(res); const rl = roomingList(res.id); const room = rl && rl.rooms.find(r => r.pax.includes(paxName()));
    const op = opOfRes(res.id);
    let h = '<div class="m-pad">';
    for (let i = 0; i < n; i++) {
      const d = addDays(res.travelFrom, i); const sv = res.services.filter(s => s.date === d && s.status !== 'cancelado' && !/hotel|hab\./i.test(s.name)).sort((a, b) => a.time.localeCompare(b.time));
      h += '<div class="m-h">Día ' + (i + 1) + ' · ' + dowOf(d) + ' ' + dateShort(d) + (d === T() ? ' · hoy' : '') + '</div>';
      h += sv.map(s => { const k = svcClass(s); const a = op && op.assignments.find(x => x.serviceId === s.id); const open = pax.open === s.id; const p = Q.product(s.productId); return '<div class="m-card click" data-pop="' + s.id + '"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="ico-box ' + (CLS_COLOR[k] || '') + '">' + ic(CLS_ICON[k]) + '</div><div class="grow" style="min-width:0"><div class="t">' + esc(s.name) + '</div><div class="s">' + esc(s.time) + ' · ' + CLS_LABEL[k] + '</div></div>' + (s.status === 'completado' ? '<span class="ok">' + ic('checkCircle') + '</span>' : UI.badge(s.status)) + '</div>' + (open ? '<div class="divider" style="margin:8px 0"></div><div class="s">' + ic('pin') + ' ' + esc(meetingPoint(res, s)) + '</div>' + (s.providerId ? '<div class="s">Proveedor: ' + esc(Q.providerName(s.providerId)) + (s.confirmationCode ? ' · Código ' + esc(s.confirmationCode) : '') + '</div>' : '') + (a && (a.guideId || a.driverId) ? '<div class="s">' + esc([a.guideId ? 'Guía ' + gName(a.guideId) : '', a.driverId ? 'Conductor ' + dName(a.driverId) : ''].filter(Boolean).join(' · ')) + '</div>' : '') + (p && p.inclusions ? '<div class="s">Incluye: ' + esc(p.inclusions.slice(0, 4).join(', ')) + '</div>' : '') : '') + '</div>'; }).join('') || '<div class="m-card"><div class="s">Sin actividades programadas.</div></div>';
      if (hotel && d < res.travelTo) h += '<div class="xs faint row" style="gap:6px">' + ic('bed') + 'Noche en ' + esc(hotel.name) + (room ? ' · hab. ' + esc(room.room) : '') + '</div>';
    }
    return h + '</div>';
  }
  function pVouchers(res) {
    const vs = DB.vouchers.filter(v => v.resId === res.id && v.status !== 'anulado');
    if (pax.voucher) {
      const v = vs.find(x => x.id === pax.voucher);
      if (v) { const s = svcOf(res, v.serviceId) || {}; return '<div class="m-pad"><div class="m-card" style="justify-items:center;text-align:center;padding:16px"><div class="xs faint">' + esc(v.id) + ' · v' + v.version + '</div><div class="t" style="font-size:1rem">' + esc(v.service) + '</div><div class="s">' + dowOf(v.date) + ' ' + date(v.date) + ' · ' + esc(s.time || '') + '</div><div class="qrbox" style="margin:10px 0">' + qrSvg(v.id + '|' + v.resId + '|' + v.version, 170, 'var(--fg)', 'var(--surface)') + '</div>' + UI.badge(v.status, v.status === 'emitido' ? 'Válido' : null) + '<div class="s" style="margin-top:6px">Presente este código al proveedor</div></div><div class="m-card">' + UI.dl([['Proveedor', esc(Q.providerName(v.providerId))], ['Confirmación', '<span class="mono">' + esc(s.confirmationCode || '—') + '</span>'], ['Encuentro', esc(meetingPoint(res, s))], ['Pasajeros', res.passengers.map(p => esc(p.name)).join('<br>')]]) + '</div><button class="m-btn" data-vback>' + ic('chevronLeft') + 'Todos los vouchers</button></div>'; }
      pax.voucher = null;
    }
    return '<div class="m-pad"><div class="small muted">Vouchers publicados por la agencia. Solo se muestran servicios confirmados (Regla transversal 11).</div>' + (vs.length ? vs.map(v => '<div class="m-card click" data-vo="' + v.id + '"><div class="row between" style="flex-wrap:nowrap"><span class="mono xs">' + esc(v.id) + ' · v' + v.version + '</span>' + UI.badge(v.status, v.status === 'emitido' ? 'Válido' : null) + '</div><div class="t">' + esc(v.service) + '</div><div class="s">' + dowOf(v.date) + ' ' + date(v.date) + ' · ' + esc(Q.providerName(v.providerId)) + '</div></div>').join('') : '<div class="m-card"><div class="s">Aún no hay vouchers publicados.</div></div>') + '</div>';
  }
  const PAX_DOCS = [['itin', 'Itinerario del viaje', 'PDF · actualizado hoy', 'route'], ['boleta', 'Boleta electrónica B001-00008811', 'Comprobante · 28 ago 2026', 'receipt'], ['seguro', 'Póliza de asistencia en viaje', 'Seguros Viajero Andino', 'shield'], ['pasaporte', 'Pasaportes registrados', 'Datos verificados para entradas', 'user'], ['politicas', 'Condiciones y políticas', 'Cancelación, cambios y reembolsos', 'file']];
  function pDocs() { return '<div class="m-pad"><div class="small muted">Documentos del viaje vinculados a su reserva (Regla transversal 23).</div>' + PAX_DOCS.map(d => '<div class="m-card click" data-doc="' + d[0] + '"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="ico-box">' + ic(d[3]) + '</div><div class="grow"><div class="t">' + d[1] + '</div><div class="s">' + d[2] + '</div></div>' + ic('chevronRight') + '</div></div>').join('') + '</div>'; }
  function docModal(k, res) {
    const inv = DB.invoices.find(i => i.resId === res.id);
    const body = {
      itin: '<div class="doc"><div class="doc-head"><div><h2>' + esc(DB.tenant.name) + '</h2><div class="muted">Itinerario del viaje</div></div><div style="text-align:right"><b>' + esc(res.id) + '</b><div class="muted">' + date(res.travelFrom) + ' – ' + date(res.travelTo) + '</div></div></div><table><thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>' + res.services.map(s => '<tr><td>' + date(s.date) + '</td><td>' + esc(s.time) + '</td><td>' + esc(s.name) + '</td><td>' + esc(UI.statusLabel(s.status)) + '</td></tr>').join('') + '</tbody></table><p class="muted">Emergencias 24/7: ' + EMERGENCY + '</p></div>',
      boleta: UI.dl([['Comprobante', inv ? esc(inv.id) : 'B001-00008811'], ['Fecha', inv ? date(inv.date) : '—'], ['Importe', inv ? money(inv.amount, inv.currency) : '—'], ['Detalle', inv ? esc(inv.detail) : '—'], ['Estado SUNAT', inv ? UI.badge(inv.status) : '—']]),
      seguro: UI.dl([['Aseguradora', 'Seguros Viajero Andino'], ['Cobertura', 'Asistencia médica, evacuación y equipaje'], ['Vigencia', date(res.travelFrom) + ' – ' + date(res.travelTo)], ['Asegurados', res.passengers.map(p => esc(p.name)).join(', ')], ['Central 24/7', '01 611 2020']]),
      pasaporte: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pasajero</th><th>Documento</th><th>Nacionalidad</th></tr></thead><tbody>' + res.passengers.map(p => '<tr><td>' + esc(p.name) + '</td><td class="mono">' + esc(p.doc) + '</td><td>' + esc(p.nationality) + '</td></tr>').join('') + '</tbody></table></div>',
      politicas: '<p class="small">' + esc((Q.product('PRD-002') || { policies: { cancel: '' } }).policies.cancel) + '</p><p class="small" style="margin-top:8px">' + esc((Q.product('PRD-002') || { policies: { modify: '' } }).policies.modify) + '</p>'
    }[k];
    UI.modal({ title: (PAX_DOCS.find(d => d[0] === k) || [])[1], size: k === 'itin' ? 'lg' : '', body: body + '<p class="xs faint" style="margin-top:10px">En producción el archivo se descarga desde almacenamiento seguro con enlace firmado.</p>', actions: [{ label: 'Cerrar' }] });
  }
  function pAlertas(res) {
    const read = pd().read; const list = paxAlerts(res);
    return '<div class="m-pad">' + list.map(a => '<div class="m-card' + (read.includes(a.id) ? '' : ' click') + '" data-al="' + a.id + '" style="' + (read.includes(a.id) ? '' : 'border-color:var(--' + (a.tone === 'bad' ? 'bad' : a.tone === 'warn' ? 'warn' : 'line') + ')') + '"><div class="row between" style="flex-wrap:nowrap"><b class="small ' + (a.tone === 'bad' ? 'bad' : '') + '">' + esc(a.t) + '</b>' + (read.includes(a.id) ? '' : '<span class="badge b-info">Nueva</span>') + '</div><div class="s">' + esc(a.d) + '</div><div class="s">' + datetime(a.ts) + '</div></div>').join('') + '</div>';
  }
  /* ---- v2.1: Mensajes (R-PAX-MESSAGES) y Comentarios (R-PAX-FEEDBACK) en la app del pasajero (misma lógica que el portal: window.PaxExp) ---- */
  const PXE = () => window.PaxExp;
  const pxMsgOn = (res) => !!PXE() && PXE().on('R-PAX-MESSAGES', res);
  const pxFbOn = (res) => !!PXE() && PXE().on('R-PAX-FEEDBACK', res);
  /* v2.2: calificar el viaje desde la app (misma API que el portal: window.OwnReviews, regla R-OWN-REVIEWS) */
  const OR = () => window.OwnReviews;
  const rvWho = () => ({ name: paxName(), email: Auth.role === 'passenger' ? Auth.user.email : '' });
  function rvElig(res) { if (!OR()) return { show: false }; try { return OR().eligibility(res, rvWho()); } catch (e) { return { show: false }; } }
  function pCalificar(res) {
    const el = rvElig(res);
    if (!el.show) return '<div class="m-pad"><div class="m-card"><div class="s">La calificación estará disponible al completar sus servicios.</div></div></div>';
    const pend = el.list.filter(x => !x.rv); const subs = OR().activeSubs();
    return '<div class="m-pad"><div class="small muted">Califique los servicios ya realizados. Su reseña se publica con el sello «Viaje verificado» tras la revisión de la agencia.' + (el.partial ? ' Su viaje continúa: podrá calificar el resto al terminar.' : '') + '</div>' +
      (pend.length ? '<div class="field"><label for="rv-p">Servicio</label><select class="input" id="rv-p">' + pend.map(x => '<option value="' + x.p.id + '">' + esc(x.p.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Calificación</label><div class="row" id="rv-stars" style="gap:4px">' + [1, 2, 3, 4, 5].map(n => '<button class="m-btn" type="button" data-star="' + n + '" style="flex:1;padding:8px 0">' + n + '★</button>').join('') + '</div></div>' +
        subs.map(sb => '<div class="field"><label for="rv-s-' + sb[0] + '">' + esc(sb[1]) + '</label><select class="input" id="rv-s-' + sb[0] + '"><option value="">—</option>' + [5, 4, 3, 2, 1].map(n => '<option value="' + n + '">' + n + '★</option>').join('') + '</select></div>').join('') +
        '<div class="field"><label for="rv-t">Título</label><input class="input" id="rv-t" maxlength="120"></div><div class="field"><label for="rv-x">Su experiencia</label><textarea class="input" id="rv-x" rows="4" maxlength="2000"></textarea></div>' +
        '<label class="check small"><input type="checkbox" id="rv-c" checked> Autorizo publicar mi reseña con mi nombre abreviado</label><button class="m-btn primary" id="rv-send">' + ic('send') + 'Enviar reseña</button>' : '<div class="m-card"><div class="s">Ya calificó todos sus servicios realizados. ¡Gracias!</div></div>') +
      (el.mine && el.mine.length ? '<div class="m-h">Mis reseñas</div>' + el.mine.map(r => '<div class="m-card"><div class="row between" style="flex-wrap:nowrap"><b class="small">' + '★★★★★'.slice(0, r.stars) + ' ' + esc(r.title) + '</b>' + OR().statusBadge(r.status) + '</div><div class="small">' + esc(r.text) + '</div>' + (r.reply ? '<div class="xs faint" style="margin-top:6px">Respuesta de la agencia: ' + esc(r.reply.text) + '</div>' : '') + '</div>').join('') : '') + '</div>';
  }
  function pxExtraBtns(res) { const rv = rvElig(res); const u = pxMsgOn(res) ? PXE().unread(res.id) : 0; return (rv.show ? '<button class="m-btn" data-ptab="calificar">' + ic('star') + 'Califica tu viaje' + (rv.pending ? ' (' + rv.pending + ')' : '') + '</button>' : '') + (pxMsgOn(res) ? '<button class="m-btn" data-ptab="mensajes">' + ic('mail') + 'Mensajes' + (u ? ' (' + u + ')' : '') + '</button>' : '') + (pxFbOn(res) ? '<button class="m-btn" data-ptab="comentar">' + ic('star') + 'Comentar</button>' : ''); }
  function pMensajes(res) {
    if (!pxMsgOn(res)) return '<div class="m-pad"><div class="m-card"><div class="s">Mensajes no disponibles.</div></div></div>';
    const list = PXE().messagesFor(res.id); const CH = PXE().CH_LBL;
    return '<div class="m-pad"><div class="small muted">Mensajes de la agencia sobre su reserva. Toque uno para leerlo.</div>' + (list.length ? list.map(m => { const nw = m.status !== 'leido' && m.status !== 'fallido'; const open = pax.msg === m.id; return '<div class="m-card click" data-pmsg="' + esc(m.id) + '" style="' + (nw ? 'border-color:var(--accent)' : '') + '"><div class="row between" style="flex-wrap:nowrap;gap:6px"><b class="small" style="min-width:0">' + esc(m.subject || '') + '</b>' + (nw ? '<span class="badge b-info">Nuevo</span>' : m.status === 'fallido' ? UI.badge('fallido') : '') + '</div><div class="s">' + esc(CH[m.channel] || m.channel) + ' · ' + datetime(m.sentAt || m.scheduledAt) + '</div>' + (open ? '<div class="divider" style="margin:6px 0"></div><div class="small" style="white-space:pre-wrap">' + esc(m.body || '') + '</div>' : '') + '</div>'; }).join('') : '<div class="m-card"><div class="s">Aún no hay mensajes.</div></div>') + '</div>';
  }
  function pComentar(res) {
    if (!pxFbOn(res)) return '<div class="m-pad"><div class="m-card"><div class="s">Comentarios no disponibles.</div></div></div>';
    const X = PXE(); const mine = X.feedbackFor(res.id).slice(0, 5);
    return '<div class="m-pad"><div class="small muted">Envíe un comentario, sugerencia, felicitación, reclamo o incidencia. Operaciones le responde en la app.</div>' +
      '<div class="field"><label for="pf-type">Tipo</label><select class="input" id="pf-type">' + X.FB_TYPES.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="pf-svc">Servicio (opcional)</label><select class="input" id="pf-svc"><option value="">Viaje en general</option>' + res.services.filter(x => x.status !== 'cancelado').map(x => '<option value="' + x.id + '">' + esc(dateShort(x.date) + ' · ' + x.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="pf-rate">Calificación (opcional)</label><select class="input" id="pf-rate"><option value="">Sin calificar</option>' + [5, 4, 3, 2, 1].map(n => '<option value="' + n + '">' + '★★★★★'.slice(0, n) + ' (' + n + ')</option>').join('') + '</select></div>' +
      '<div class="field"><label for="pf-text">Comentario <span class="req">*</span></label><textarea class="input" id="pf-text" rows="4" maxlength="1000"></textarea></div>' +
      '<button class="m-btn primary" id="pf-send">' + ic('send') + 'Enviar</button>' +
      (mine.length ? '<div class="m-h">Mis comentarios</div>' + mine.map(f => '<div class="m-card"><div class="row between" style="flex-wrap:nowrap;gap:6px">' + X.typeBadge(f.type) + X.fbBadge(f.status) + '</div><div class="small">' + esc(f.text) + '</div>' + (f.reply ? '<div class="s" style="color:var(--accent)">Agencia: ' + esc(f.reply) + '</div>' : '') + '<div class="s">' + datetime(f.createdAt) + '</div></div>').join('') : '') + '</div>';
  }
  function pSoporte() {
    const c = pd().chat;
    return '<div class="m-pad"><div class="m-card" style="border-color:var(--bad)"><div class="row between" style="flex-wrap:nowrap"><div><div class="xs faint">Emergencias 24/7</div><div class="t bad" style="font-size:1.05rem">' + EMERGENCY + '</div></div><button class="btn sm danger" data-sos>' + ic('phoneCall') + 'Llamar</button></div></div><div class="chat">' + c.map(x => '<div class="msg' + (x.from === 'me' ? ' me' : '') + '">' + (x.who ? '<b class="xs" style="display:block;margin-bottom:2px">' + esc(x.who) + '</b>' : '') + esc(x.m) + '<span class="xs">' + esc(x.ts.split(' ')[1]) + '</span></div>').join('') + '</div><div class="m-chips">' + ['¿Confirmaron el horario de mañana?', 'Necesito un médico', 'Olvidé algo en el hotel'].map(q => '<button data-qr="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="input" id="pc-in" placeholder="Escriba un mensaje…"><button class="btn primary icon" id="pc-send" aria-label="Enviar">' + ic('send') + '</button></div></div>';
  }
  const PAX_INFO = { viaje: ['Mi viaje', 'Resumen del viaje, estado y cuenta regresiva a la próxima actividad, con alertas destacadas.', 1], itin: ['Itinerario', 'Día a día con servicios, hoteles, transporte y actividades; al tocar un servicio se ve el punto de encuentro, proveedor y guía.', 2], vouchers: ['Vouchers', 'Vouchers publicados desde Operaciones (PROC-035) con código QR para presentar al proveedor.', 3], docs: ['Documentos', 'Itinerario, comprobante, póliza y políticas vinculados a la reserva.', 4], alertas: ['Alertas', 'Notificaciones del viaje: cambios de horario por incidencias, vouchers actualizados y recordatorios (PROC-059).', 5], soporte: ['Contacto y soporte', 'Chat con la agencia y número de emergencia visible en todo momento.', 6], mensajes: ['Mensajes', 'Bandeja de mensajes enviados por la agencia (confirmación, recordatorios, respuestas). Regla R-PAX-MESSAGES.', 5], calificar: ['Califica tu viaje', 'Reseña verificada del pasajero sobre los servicios ya realizados; se modera y se publica en el sitio y el widget. Regla R-OWN-REVIEWS.', 7], comentar: ['Comentarios', 'El pasajero envía comentarios, sugerencias, reclamos o incidencias; reclamos e incidencias abren un caso en el Inbox. Regla R-PAX-FEEDBACK.', 6] };
  const PROC57 = ['Login', 'Viaje', 'Itinerario', 'Reservas', 'Documentos', 'Notificaciones', 'Soporte'];
  function renderPasajero(el) {
    css(); paxEl = el;
    const ext = Auth.isExternal;
    const res = Q.reservation(paxResId());
    if (!res) { el.innerHTML = '<div class="page op-pg">' + UI.card('', UI.empty(ext ? 'No encontramos un viaje vinculado a su cuenta. Escriba a su agencia.' : 'Reserva de demostración no disponible.', 'suitcase')) + '</div>'; return; }
    const unread = paxAlerts(res).filter(a => !pd().read.includes(a.id)).length;
    const tabs = [['viaje', 'Mi viaje', 'home'], ['itin', 'Itinerario', 'route'], ['vouchers', 'Vouchers', 'ticket'], ['docs', 'Docs', 'file'], ['alertas', 'Alertas', 'bell'], ['soporte', 'Soporte', 'msg']];
    if ((pax.tab === 'mensajes' && !pxMsgOn(res)) || (pax.tab === 'comentar' && !pxFbOn(res)) || (pax.tab === 'calificar' && !rvElig(res).show)) pax.tab = 'viaje';
    const content = { viaje: pViaje, itin: pItin, vouchers: pVouchers, docs: pDocs, alertas: pAlertas, soporte: pSoporte, mensajes: pMensajes, comentar: pComentar, calificar: pCalificar }[pax.tab](res);
    const inf = PAX_INFO[pax.tab]; const op = opOfRes(res.id);
    const phoneHtml = '<div class="phone"><div class="phone-screen"><div class="phone-notch"><span>' + nowTime() + '</span><span>5G · 64%</span></div><div class="m-bar">' + (pax.tab === 'vouchers' && pax.voucher ? '<button class="m-back" data-vback aria-label="Volver">' + ic('chevronLeft') + '</button>' : '<div class="ico-box" style="width:30px;height:30px">' + ic('logo') + '</div>') + '<h3>' + (pax.tab === 'viaje' ? esc(DB.tenant.short) : inf[0]) + '</h3><button class="m-net" data-ptab="alertas">' + ic('bell') + (unread ? unread : '') + '</button></div><div class="phone-body">' + content + '</div><div class="phone-tabbar m-tabbar6">' + tabs.map(t => '<button class="' + (pax.tab === t[0] ? 'on' : '') + '" data-ptab="' + t[0] + '">' + ic(t[2]) + t[1] + (t[0] === 'alertas' && unread ? ' (' + unread + ')' : '') + '</button>').join('') + '</div></div></div>';
    el.innerHTML = ext ? '<div class="page op-pg"><div class="op-app">' + phoneHtml + '</div></div>' : '<div class="page op-pg">' + UI.pageHeader({ title: 'App del pasajero', crumbs: [['Inicio', '#/dashboard'], ['Móvil'], ['App pasajero']], subtitle: 'Vista de ' + esc(paxName()) + ' (' + res.id + '): viaje, itinerario, vouchers con QR, documentos, alertas y soporte (PROC-057).', actions: (Access.canRoute('mobile/operador') ? '<a class="btn" href="#/mobile/operador">' + ic('phone') + 'App operador</a>' : '') + '<a class="btn" href="#/canales/portal-pasajero">' + ic('globe') + 'Portal web del pasajero</a>' }) +
      '<div class="op-mob">' + phoneHtml +
      '<div class="stack mob-panel">' + UI.card(esc(inf[0]), '<p class="small muted">' + inf[1] + '</p><div class="upper" style="margin:12px 0 6px">PROC-057 · App pasajero</div><ol>' + PROC57.map((s, i) => '<li class="' + (i < inf[2] ? 'done' : i === inf[2] ? 'cur' : '') + '">' + s + '</li>').join('') + '</ol>', { sub: 'Pantalla actual' }) +
      UI.card('Datos de origen', UI.dl([['Reserva', resLink(res.id) + ' ' + UI.badge(res.status)], ['Cliente', cliLink(res.clientId)], ['Orden operativa', op ? opLink(op.id) : '—'], ['Incidencia vinculada', incLink('INC-0085')], ['Vouchers', DB.vouchers.filter(v => v.resId === res.id && v.status !== 'anulado').length + ' publicados']]) + '<p class="xs faint" style="margin-top:10px">La app consume la misma API que el portal: no duplica reglas del core (Reglas transversales 18 y 19). Los cambios hechos en Operaciones se reflejan aquí al instante.</p>') + '</div></div></div>';
    const $ = (s) => el.querySelector(s);
    el.querySelectorAll('[data-ptab]').forEach(b => b.onclick = () => { pax.tab = b.dataset.ptab; pax.voucher = null; renderPasajero(el); });
    el.querySelectorAll('[data-pop]').forEach(b => b.onclick = () => { pax.open = pax.open === b.dataset.pop ? null : b.dataset.pop; const y = $('.phone-body').scrollTop; renderPasajero(el); $('.phone-body').scrollTop = y; });
    el.querySelectorAll('[data-vo]').forEach(b => b.onclick = () => { pax.voucher = b.dataset.vo; renderPasajero(el); });
    el.querySelectorAll('[data-vback]').forEach(b => b.onclick = () => { pax.voucher = null; renderPasajero(el); });
    el.querySelectorAll('[data-doc]').forEach(b => b.onclick = () => docModal(b.dataset.doc, res));
    el.querySelectorAll('[data-sos]').forEach(b => b.onclick = () => UI.toast('Llamando a la central de emergencias ' + EMERGENCY + '…', 'info'));
    el.querySelectorAll('[data-al]').forEach(b => b.onclick = () => { const r = pd().read; if (!r.includes(b.dataset.al)) { r.push(b.dataset.al); Store.save(); renderPasajero(el); } });
    const send = (txt) => { txt = (txt || '').trim(); if (!txt) return; const c = pd().chat; c.push({ from: 'me', ts: nowStr(), m: txt }); Store.save(); renderPasajero(el); const b = $('.phone-body'); if (b) b.scrollTop = b.scrollHeight;
      setTimeout(() => { const reply = /médico/i.test(txt) ? 'Entendido. Coordinamos de inmediato un médico al hotel (Hotel Tambo Real). Le escribirá la Dra. Rojas en 10 minutos. Si es urgente, llame al ' + EMERGENCY + '.' : /horario|mañana/i.test(txt) ? 'Seguimos monitoreando el paro. Le confirmaremos el horario de recojo antes de las 20:00 por este chat y WhatsApp.' : 'Gracias por su mensaje. Un agente de operaciones le responderá en breve (tiempo medio de respuesta: 5 min).'; c.push({ from: 'agency', who: 'Karina Huamán (Operaciones Cusco)', ts: nowStr(), m: reply }); Store.save(); if (App.current === 'mobile/pasajero' && paxEl && document.body.contains(paxEl) && pax.tab === 'soporte') { renderPasajero(paxEl); const bb = paxEl.querySelector('.phone-body'); if (bb) bb.scrollTop = bb.scrollHeight; } }, 1200); };
    const ps = $('#pc-send'); if (ps) { ps.onclick = () => send($('#pc-in').value); $('#pc-in').onkeydown = (e) => { if (e.key === 'Enter') send(e.target.value); }; const b = $('.phone-body'); if (b) b.scrollTop = b.scrollHeight; }
    el.querySelectorAll('[data-qr]').forEach(b => b.onclick = () => send(b.dataset.qr));
    el.querySelectorAll('[data-pmsg]').forEach(b => b.onclick = () => { const m = (DB.paxMessages || []).find(x => x.id === b.dataset.pmsg); pax.msg = pax.msg === b.dataset.pmsg ? null : b.dataset.pmsg; if (m && PXE() && PXE().markRead(m, paxName())) Store.save(); renderPasajero(el); });
    let rvStars = 0;
    el.querySelectorAll('[data-star]').forEach(b => b.onclick = () => { rvStars = +b.dataset.star; el.querySelectorAll('[data-star]').forEach(x => x.classList.toggle('primary', +x.dataset.star <= rvStars)); });
    const rvs = $('#rv-send'); if (rvs) rvs.onclick = () => {
      const subs = {}; OR().activeSubs().forEach(sb => { const f = $('#rv-s-' + sb[0]); if (f && f.value) subs[sb[0]] = f.value; });
      const r3 = OR().submit(res, { productId: $('#rv-p').value, stars: rvStars, title: $('#rv-t').value, text: $('#rv-x').value, subratings: subs, consent: $('#rv-c').checked, lang: 'es' }, rvWho(), 'app');
      if (r3.error) { UI.toast(r3.error, 'bad'); return; }
      UI.toast('Gracias. Su reseña ' + r3.rv.id + ' quedó ' + (r3.rv.status === 'publicada' ? 'publicada.' : 'en revisión.')); renderPasajero(el);
    };
    const pfs = $('#pf-send'); if (pfs) pfs.onclick = () => {
      const r2 = PXE().submitFeedback(res, { type: $('#pf-type').value, serviceId: $('#pf-svc').value, rating: $('#pf-rate').value, text: $('#pf-text').value }, { name: paxName(), email: Auth.role === 'passenger' ? Auth.user.email : 't.keller@mail.de', phone: Auth.role === 'passenger' ? Auth.user.phone : '+49 171 5550102' }, 'App pasajero');
      if (r2.error) { UI.toast(r2.error, 'bad'); return; }
      UI.toast('Comentario ' + r2.fb.id + ' enviado.' + (r2.fb.conversationId ? ' Caso ' + r2.fb.conversationId + ' abierto con operaciones.' : '') + (r2.fb.type === 'reclamo' ? ' También puede usar el Libro de Reclamaciones.' : '')); renderPasajero(el);
    };
  }

  /* ======================================================================
     Registro de rutas
     ====================================================================== */
  const withCss = (fn) => (el, params) => { css(); fn(el, params || []); };
  App.register('operaciones', withCss((el) => orderList(el)));
  App.register('operaciones/ordenes', withCss((el, p) => p[0] ? orderDetail(el, p[0]) : orderList(el)));
  App.register('operaciones/calendario', withCss((el) => calendarView(el)));
  App.register('operaciones/asignaciones', withCss((el) => assignBoard(el)));
  App.register('operaciones/rooming', withCss((el, p) => roomingView(el, p)));
  App.register('operaciones/vouchers', withCss((el, p) => p[0] ? voucherDetail(el, p[0]) : vouchersList(el)));
  App.register('operaciones/incidencias', withCss((el, p) => p[0] ? incidentDetail(el, p[0]) : incidentsList(el)));
  App.register('mobile', withCss((el) => renderOperador(el)));
  App.register('mobile/operador', withCss((el) => renderOperador(el)));
  App.register('mobile/pasajero', withCss((el) => renderPasajero(el)));
})();
