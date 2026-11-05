/* ==========================================================================
   Colaboración — Bandeja de aprobaciones unificada (#/aprobaciones) y
   Bandeja omnicanal de conversaciones (#/inbox).
   - Aprobaciones: motor de workflow que consolida las solicitudes que hoy
     viven en cada módulo (cotizaciones fuera de política, anulaciones,
     reversiones, CxP, comisiones, tarifas de proveedor) y solicitudes
     genéricas (DB.approvals). Al aprobar/rechazar ejecuta EXACTAMENTE el
     mismo efecto de estado que el módulo de origen (lógica portada de
     ventas.js, finanzas.js y proveedor.js), audita y notifica.
   - Inbox: conversaciones de WhatsApp, email, chat web, formulario y
     tickets del portal (DB.supportTickets) en un diseño de 3 columnas.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr, parseD, pad, clone } = Util;
  const I = UI.icon;
  const TODAY = () => window.TODAY;
  const me = () => Auth.user.id;
  const can = (p) => Auth.can(p);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const isSup = () => ['tenant_admin', 'manager'].includes(Auth.role);

  /* ---------------- CSS local ---------------- */
  function css() {
    if (document.getElementById('css-colaboracion')) return;
    const st = document.createElement('style'); st.id = 'css-colaboracion';
    st.textContent = [
      '.cb-sla{display:inline-flex;align-items:center;gap:6px;font-size:.76rem;white-space:nowrap}',
      '.cb-sla i{width:8px;height:8px;border-radius:50%;background:var(--fg-3);flex:none}',
      '.cb-sla.ok i{background:var(--ok)}.cb-sla.warn i{background:var(--warn)}.cb-sla.bad i{background:var(--bad)}.cb-sla.bad{color:var(--bad);font-weight:600}.cb-sla.warn{color:var(--warn);font-weight:600}',
      '.cb-ty{display:flex;gap:9px;align-items:flex-start;min-width:0}.cb-ty .ico-box{width:30px;height:30px}.cb-ty .ico-box svg{width:15px;height:15px}',
      '.cb-box{border:1px solid var(--line-2);border-radius:8px;padding:10px 12px;background:var(--surface-2)}',
      '.cb-box+.cb-box{margin-top:8px}',
      '.cb-noperm{opacity:.6;cursor:not-allowed}',
      '.cb-page>*{min-width:0}',
      '.cb-tbl td:first-child{min-width:230px}.cb-tbl .cb-sla{white-space:normal}.cb-tbl .avatar+.small{white-space:nowrap}',
      '.cb-scope{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);font-size:.78rem;font-weight:600;color:var(--fg-2);white-space:nowrap}.cb-scope svg{width:14px;height:14px}',
      /* inbox */
      '.ib{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr) minmax(250px,300px);border:1px solid var(--line);border-radius:var(--r);background:var(--surface);height:calc(100vh - 170px);min-height:560px;overflow:hidden}',
      '.ib-col{display:flex;flex-direction:column;min-width:0;min-height:0}',
      '.ib-list{border-right:1px solid var(--line)}',
      '.ib-side{border-left:1px solid var(--line);overflow-y:auto}',
      '.ib-f{padding:10px;border-bottom:1px solid var(--line);display:grid;gap:6px}',
      '.ib-f .row{gap:6px;flex-wrap:nowrap}.ib-f select{flex:1 1 0;min-width:0;width:auto}',
      '.ib-items{overflow-y:auto;flex:1;min-height:0}',
      '.ib-it{display:flex;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line-2);cursor:pointer;color:inherit;text-decoration:none;min-width:0}',
      '.ib-it:hover{background:var(--surface-2);text-decoration:none}.ib-it.on{background:var(--accent-soft)}',
      '.ib-it .ico-box{width:32px;height:32px}',
      '.ib-it .nm{font-weight:600;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ib-it .sj{font-size:.78rem;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ib-it .sn{font-size:.74rem;color:var(--fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ib-it .tm{font-size:.7rem;color:var(--fg-3);white-space:nowrap}',
      '.ib-un{min-width:18px;height:18px;border-radius:9px;background:var(--accent);color:var(--accent-fg);font-size:.66rem;font-weight:700;display:inline-grid;place-items:center;padding:0 5px}',
      '.ib-th{padding:12px 16px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}',
      '.ib-th h2{font-size:1rem;margin:0;overflow-wrap:anywhere}',
      '.ib-msgs{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}',
      '.ib-m{max-width:78%;padding:9px 12px;border-radius:10px;font-size:.85rem;line-height:1.45;border:1px solid var(--line-2);background:var(--surface);align-self:flex-start;overflow-wrap:anywhere;white-space:pre-wrap}',
      '.ib-m.out{align-self:flex-end;background:var(--accent-soft);border-color:transparent}',
      '.ib-m.note{align-self:stretch;max-width:none;background:var(--warn-soft);border:1px dashed var(--warn)}',
      '.ib-m .mt{font-size:.68rem;color:var(--fg-3);margin-top:4px;white-space:normal}',
      '.ib-ev{align-self:center;font-size:.72rem;color:var(--fg-3);text-align:center;max-width:90%}',
      '.ib-att{display:inline-flex;gap:5px;align-items:center;margin:5px 5px 0 0;padding:3px 8px;border-radius:6px;border:1px solid var(--line);background:var(--surface);font-size:.74rem;white-space:nowrap}',
      '.ib-att svg{width:13px;height:13px}',
      '.ib-cmp{border-top:1px solid var(--line);padding:10px 12px;display:grid;gap:8px;background:var(--surface)}',
      '.ib-cmp.note textarea{background:var(--warn-soft)}',
      '.ib-sec{padding:12px 14px;border-bottom:1px solid var(--line-2)}.ib-sec:last-child{border-bottom:0}',
      '.ib-sec .upper{margin-bottom:8px}',
      '.ib-lk{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:5px 0;font-size:.8rem;min-width:0}',
      '.ib-lk>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ib-acts{display:grid;gap:6px}.ib-acts .btn{justify-content:flex-start;width:100%}',
      '.ib-back,.ib-fic{display:none!important}',
      '@media (max-width:1180px){.ib{grid-template-columns:minmax(230px,290px) minmax(0,1fr)}.ib-side{display:none}.ib-fic{display:inline-flex!important}}',
      '@media (max-width:760px){.ib{grid-template-columns:minmax(0,1fr);height:auto;min-height:0}.ib.sel .ib-list{display:none}.ib:not(.sel) .ib-thread{display:none}.ib-list{border-right:0}.ib-msgs{max-height:62vh;min-height:280px}.ib-back{display:inline-flex!important}.ib-m{max-width:92%}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- Tiempo ---------------- */
  const fmtTs = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const addMin = (ts, m) => { const d = parseD(ts); d.setMinutes(d.getMinutes() + Math.round(m)); return fmtTs(d); };
  const minsBetween = (a, b) => (parseD(b) - parseD(a)) / 60000;
  const dur = (mins) => { mins = Math.abs(Math.round(mins)); if (mins < 60) return mins + ' min'; const h = Math.floor(mins / 60), m = mins % 60; if (h < 24) return h + ' h' + (m ? ' ' + m + ' min' : ''); const d = Math.floor(h / 24), hh = h % 24; return d + ' d' + (hh ? ' ' + hh + ' h' : ''); };
  const shortTs = (ts) => { if (!ts) return ''; return String(ts).slice(0, 10) === TODAY() ? String(ts).slice(11, 16) : dateShort(ts); };

  /* ---------------- Usuarios y permisos ---------------- */
  const userCan = (uid, perm) => { const u = Q.user(uid); if (!u || u.status !== 'activo') return false; const ps = DB.rolePerms[u.role] || []; return ps.includes(perm) || ps.some(p => p.endsWith('.') && perm.startsWith(p)); };
  const internalUsers = () => DB.users.filter(u => u.status === 'activo' && !Access.isExternal(u.role) && u.role !== 'super_admin');
  const holders = (perm) => internalUsers().filter(u => userCan(u.id, perm) && userCan(u.id, 'approvals.view'));
  const who = (id) => { if (!id) return '—'; if (id === 'Sistema') return 'Sistema (cálculo automático)'; const u = Q.user(id); if (u) return u.name; const p = Q.provider(id); if (p) return p.name + ' (proveedor)'; return Q.userName(id); };
  const chip = (id) => Q.user(id) ? UI.userChip(id) : '<span class="small">' + esc(who(id)) + '</span>';
  const lnk = (route, id, label, cls) => { const r = route + (id ? '/' + encodeURIComponent(id) : ''); return Access.canRoute(r) ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="#/' + r + '">' + label + '</a>' : '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</span>'; };
  const pbtn = (label, ic, cls, act, why) => '<button class="btn ' + (why ? (cls || '').replace(/\b(primary|danger|sun)\b/g, '') + ' cb-noperm' : cls || '') + '" data-x="' + act + '"' + (why ? ' aria-disabled="true" title="' + esc(why) + '"' : '') + '>' + I(why ? 'lock' : ic) + esc(label) + '</button>';
  const deny = (msg) => { UI.toast(msg, 'bad'); return false; };
  const nextNum = (arr, prefix, width) => { let max = 0; (arr || []).forEach(x => { const s = String(x.id); if (!s.startsWith(prefix)) return; const n = parseInt(s.slice(prefix.length).replace(/\D/g, ''), 10); if (n > max) max = n; }); return prefix + String(max + 1).padStart(width, '0'); };

  /* =====================================================================================
     LÓGICA PORTADA DE LOS MÓDULOS DE ORIGEN (mismo efecto de estado)
     ===================================================================================== */
  /* ventas.js — cotizaciones */
  const OPENQ = ['borrador', 'enviada', 'vista', 'negociacion'];
  const MAX_DISC = 10;
  const curV = (q) => q.versions.find(v => v.v === q.currentVersion) || q.versions[q.versions.length - 1];
  const needsInternal = (v, t) => { t = t || Pricing.quoteTotals(v); const r = []; if ((v.discountPct || 0) > 5) r.push('descuento ' + fmtN(v.discountPct, 1) + '% > 5%'); if (t.marginPct < 15) r.push('margen ' + fmtN(t.marginPct, 1) + '% < 15%'); return r; };
  const overCap = (v) => (v.discountPct || 0) > MAX_DISC;
  const PROFIT = () => Auth.canAny(['finance.profitability', 'catalog.products.view_profitability', 'quotes.approve_internal']);
  /* ventas.js — disponibilidad y cancelación (PROC-028) */
  const nextIdV = (arr, prefix, width) => { const n = Math.max(0, ...(DB[arr] || []).map(x => parseInt(String(x.id).replace(/^\D+/, '').replace(/\D/g, ''), 10) || 0)) + 1; return prefix + String(n).padStart(width, '0'); };
  const depById = (id) => { for (const p of DB.products) { const d = (p.departures || []).find(x => x.id === id); if (d) return { d, p }; } return null; };
  const setDepStatus = (d) => { if (d.status === 'cerrada') return; d.status = d.sold >= d.capacity ? 'completa' : 'abierta'; };
  const depForService = (s) => {
    if (s.depId) return depById(s.depId);
    const m = /SAL-\d{4}/.exec(s.name || ''); if (m) return depById(m[0]);
    const p = Q.product(s.productId);
    if (p && p.availabilityModel === 'POR_SALIDA') { const d = (p.departures || []).find(x => x.date === s.date); if (d) return { d, p }; }
    return null;
  };
  const svcPax = (r, s) => s.pax || (r.passengers || []).length;
  const uniqDeps = (r, svcs) => { const m = new Map(); svcs.forEach(s => { const x = depForService(s); if (!x) return; const px = svcPax(r, s); const cur = m.get(x.d.id); if (!cur || cur.pax < px) m.set(x.d.id, { x, pax: px, s }); }); return [...m.values()]; };
  const resPol = (r, productId) => (r.policies && r.policies[productId]) || ((Q.product(productId) || {}).policies) || {};
  function tiersFor(text) {
    text = String(text || '');
    if (/48 ?h/i.test(text) && /sin penalidad/i.test(text)) return [[2, 0], [0, 100]];
    if (/24 ?h/i.test(text) && /sin penalidad/i.test(text)) return [[1, 0], [0, 100]];
    if (/Tren:/i.test(text)) return [[15, 0], [7, 50], [2, 50], [0, 100]];
    return [[15, 0], [7, 50], [0, 100]];
  }
  const penaltyPct = (tiers, days) => { for (const [th, pct] of tiers) if (days >= th) return pct; return 100; };
  function cancelCalc(r) {
    const paid = Q.resPaid(r.id);
    const svcs = r.services.filter(s => !['cancelado', 'completado'].includes(s.status) && !(s.status === 'rechazado'));
    const lines = svcs.map(s => { const days = daysFromToday(s.date); const po = resPol(r, s.productId); const pct = penaltyPct(tiersFor(po.cancel), days); return { s, days, pct, pen: r2(s.price * pct / 100), pol: po.cancel }; });
    const used = r.services.filter(s => s.status === 'completado');
    const allTot = sum(svcs.concat(used), 'price') || 1;
    const penSvc = sum(lines, 'pen'); const consumed = sum(used, 'price');
    const k = r.total / allTot;
    const pen = r2(Math.min(r.total, (penSvc + consumed) * k));
    const refund = r2(Math.max(0, paid - pen)); const owed = r2(Math.max(0, pen - paid));
    return { paid, svcs, lines, used, penSvc, consumed, k, pen, refund, owed, deps: uniqDeps(r, svcs), vou: DB.vouchers.filter(v => v.resId === r.id && v.status === 'emitido') };
  }
  /* Efecto idéntico a ventas.js › cancelModal › "Confirmar cancelación" */
  function applyCancel(r, reason, x) {
    const bs = r.status;
    x.deps.forEach(z => { const bsold = z.x.d.sold; z.x.d.sold = Math.max(0, z.x.d.sold - z.pax); setDepStatus(z.x.d); Audit.log('Disponibilidad', z.x.d.id, 'liberar', 'vendidos ' + bsold, 'vendidos ' + z.x.d.sold + ' (' + r.id + ')'); });
    x.svcs.forEach(s => { s.status = 'cancelado'; });
    x.vou.forEach(v => { v.status = 'anulado'; Audit.log('Voucher', v.id, 'anular', 'emitido', 'anulado por cancelación ' + r.id); });
    DB.receivables.filter(c => c.resId === r.id && !['pagada', 'cancelada'].includes(c.status)).forEach(c => { const b = c.status; c.status = 'cancelada'; Audit.log('Cuenta por cobrar', c.id, 'cancelar', b, 'cancelada'); });
    if (x.owed > 0) DB.receivables.unshift({ id: nextIdV('receivables', 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Penalidad por cancelación — ' + r.id, amount: x.owed, currency: r.currency, due: addDays(TODAY(), 7), paid: 0, status: 'abierta' });
    if (x.refund > 0) {
      const nc = Seq.next('Factura');
      DB.invoices.unshift({ id: nc, type: 'Nota de crédito', clientId: r.clientId, resId: r.id, amount: x.refund, currency: r.currency, date: TODAY(), status: 'emitido', detail: 'Anulación por cancelación ' + r.id + ' (penalidad ' + money(x.pen, r.currency) + ')' });
      const pid = nextIdV('payments', 'PAG-', 5);
      DB.payments.unshift({ id: pid, receivableId: null, resId: r.id, method: 'Reembolso (mismo medio de pago)', amount: x.refund, currency: r.currency, date: TODAY(), status: 'pendiente', ref: 'Reembolso ' + nc + ' · 7–15 días hábiles', by: me(), kind: 'reembolso' });
      Audit.log('Nota de crédito', nc, 'emitir', '', money(x.refund, r.currency) + ' · reembolso ' + pid);
    }
    const op = DB.operations.find(o => o.resId === r.id);
    if (op) { const b = op.status; op.status = 'cancelada'; op.assignments.forEach(a => { if (a.status !== 'completada') a.status = 'cancelada'; }); Audit.log('Orden operativa', op.id, 'cancelar', b, 'cancelada por ' + r.id); }
    r.status = 'cancelada'; r.cancelReason = reason; r.cancelledAt = nowStr(); r.penalty = x.pen; r.refund = x.refund;
    if (r.cancelRequest && r.cancelRequest.status === 'pendiente') { Object.assign(r.cancelRequest, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: reason }); Notify.push('reserva.anulacion_aprobada', 'Portal', r.cancelRequest.by, 'Gerencia procesó la anulación de ' + r.id); }
    Audit.log('Reserva', r.id, 'cancelar', bs, 'cancelada · penalidad ' + fmtN(x.pen) + ' · reembolso ' + fmtN(x.refund) + ' · ' + reason);
    const cli = Q.client(r.clientId) || {};
    Notify.push('reserva.cancelada', 'Email', cli.email || cli.name, 'Cancelación de su reserva ' + r.id + (x.refund ? ' · reembolso ' + money(x.refund, r.currency) : ''));
    Notify.push('reserva.cancelada', 'Push', op ? op.coordinator : 'U05', 'Reserva ' + r.id + ' cancelada: liberar recursos');
    Notify.push('reserva.cancelada', 'Portal', 'U07', 'Cancelación ' + r.id + ': procesar ' + (x.refund ? 'reembolso ' + money(x.refund, r.currency) : 'penalidad'));
  }
  /* finanzas.js — pagos, CxC, CxP y comisiones */
  const FX = () => DB.settings.fx || 3.74;
  const penAmt = (amt, cur, fx) => cur === 'USD' ? (fx ? (amt || 0) * fx : toPEN(amt || 0, 'USD')) : (amt || 0);
  const bal = (o) => r2((o.amount || 0) - (o.paid || 0));
  const hist = (o, status, note) => { o.history = o.history || []; o.history.push({ ts: nowStr(), status, user: Auth.user ? Auth.user.id : 'Sistema', note: note || '' }); };
  function cxcStatus(r) { if (r.status === 'cancelada') return 'cancelada'; if (bal(r) <= 0) return 'pagada'; if (r.due < TODAY()) return 'vencida'; return (r.paid || 0) > 0 ? 'parcial' : 'abierta'; }
  function recalcCxC(r) { r.paid = r2(sum(DB.payments.filter(p => p.receivableId === r.id && p.status === 'aplicado'), 'amount')); r.status = cxcStatus(r); }
  const agencyOfClient = (cid) => DB.b2bAgencies.find(a => a.clientId === cid);
  const cxpNorm = (p) => { if (p.approved === undefined) p.approved = p.status === 'aprobada' || p.status === 'pagada'; if (p.paid == null) p.paid = 0; };
  function cxpStatus(p) { if (bal(p) <= 0) return 'pagada'; if (p.due < TODAY()) return 'vencida'; return p.approved ? 'aprobada' : 'abierta'; }
  const isCost = (p) => p.kind === 'costo_adicional';

  /* =====================================================================================
     APROBACIONES — catálogo de tipos y reglas
     ===================================================================================== */
  const TYPES = {
    quote: { label: 'Cotización fuera de política', short: 'Cotización', icon: 'fileCheck', tone: 'warn', rule: 'PROC-021/024 · descuento > 5 % o margen < 15 %; descuento > 10 % requiere quotes.discount_override', origin: 'Ventas › Cotizaciones', perm1: 'quotes.approve_internal' },
    cancel: { label: 'Anulación de reserva', short: 'Anulación', icon: 'x', tone: 'bad', rule: 'PROC-028 · cancelación con política de penalidades · Regla transversal 8', origin: 'Ventas › Reservas', perm1: 'reservations.cancel' },
    reversal: { label: 'Reversión de pago', short: 'Reversión', icon: 'refresh', tone: 'bad', rule: 'PROC-043 · Solicitud → Validar → Revertir → Desaplicar → Recalcular → Auditar', origin: 'Finanzas › Pagos', perm1: 'finance.payments.revert' },
    payable: { label: 'Cuenta por pagar por aprobar', short: 'CxP', icon: 'coins', tone: 'info', rule: 'PROC-044/046 · Obligación → Validar → Aprobar → Pagar', origin: 'Finanzas › Cuentas por pagar', perm1: 'finance.payables' },
    commission: { label: 'Comisión calculada', short: 'Comisión', icon: 'percent', tone: 'violet', rule: 'PROC-047 · Venta → Regla → Cálculo → Revisión → Aprobación → Pago', origin: 'Finanzas › Comisiones', perm1: 'finance.commissions' },
    provider_rate: { label: 'Actualización de tarifa de proveedor', short: 'Tarifa proveedor', icon: 'tag', tone: 'sun', rule: 'PROC-012/017 · cláusula de contrato: vigencia con 30 días de anticipación', origin: 'Extranet de proveedores', perm1: 'catalog.providers.manage' },
    credit_b2b: { label: 'Excepción de crédito B2B', short: 'Crédito B2B', icon: 'handshake', tone: 'accent', rule: 'PROC-053 · crédito por agencia · Regla transversal 14', origin: 'Solicitud genérica', generic: true },
    refund: { label: 'Reembolso fuera de política', short: 'Reembolso', icon: 'wallet', tone: 'accent', rule: 'PROC-028 · política de reembolsos del producto', origin: 'Solicitud genérica', generic: true },
    other: { label: 'Otra excepción operativa/comercial', short: 'Excepción', icon: 'shield', tone: 'accent', rule: 'Regla transversal 16 · acciones críticas auditadas', origin: 'Solicitud genérica', generic: true }
  };
  const PERM_LABEL = { 'quotes.approve_internal': 'Aprobación interna de cotizaciones', 'quotes.discount_override': 'Excepción de tope de descuento', 'reservations.cancel': 'Cancelar reservas', 'finance.payments.revert': 'Revertir pagos', 'finance.payables': 'Cuentas por pagar', 'finance.commissions': 'Comisiones', 'finance.profitability': 'Rentabilidad', 'finance.receivables': 'Cuentas por cobrar', 'catalog.providers.manage': 'Gestión de proveedores', 'finance.treasury': 'Tesorería' };
  const RULE_PERMS = Object.keys(PERM_LABEL);
  const DEFAULT_RULES = [
    { id: 'RA-01', type: 'quote', level: 1, perm: 'quotes.approve_internal', min: 0, sla: 8, noSelf: true, active: true },
    { id: 'RA-02', type: 'cancel', level: 1, perm: 'reservations.cancel', min: 0, sla: 24, noSelf: true, active: true },
    { id: 'RA-03', type: 'cancel', level: 2, perm: 'finance.payments.revert', min: 20000, sla: 24, noSelf: true, active: true },
    { id: 'RA-04', type: 'reversal', level: 1, perm: 'finance.payments.revert', min: 0, sla: 24, noSelf: true, active: true },
    { id: 'RA-05', type: 'reversal', level: 2, perm: 'quotes.approve_internal', min: 10000, sla: 24, noSelf: true, active: true },
    { id: 'RA-06', type: 'payable', level: 1, perm: 'finance.payables', min: 0, sla: 48, noSelf: true, active: true },
    { id: 'RA-07', type: 'payable', level: 2, perm: 'finance.profitability', min: 10000, sla: 48, noSelf: true, active: true },
    { id: 'RA-08', type: 'commission', level: 1, perm: 'finance.commissions', min: 0, sla: 72, noSelf: true, active: true },
    { id: 'RA-09', type: 'provider_rate', level: 1, perm: 'catalog.providers.manage', min: 0, sla: 72, noSelf: true, active: true },
    { id: 'RA-10', type: 'credit_b2b', level: 1, perm: 'quotes.approve_internal', min: 0, sla: 24, noSelf: true, active: true },
    { id: 'RA-11', type: 'credit_b2b', level: 2, perm: 'finance.receivables', min: 5000, sla: 24, noSelf: true, active: true },
    { id: 'RA-12', type: 'refund', level: 1, perm: 'quotes.approve_internal', min: 0, sla: 24, noSelf: true, active: true },
    { id: 'RA-13', type: 'refund', level: 2, perm: 'finance.payments.revert', min: 1000, sla: 24, noSelf: true, active: true },
    { id: 'RA-14', type: 'other', level: 1, perm: 'quotes.approve_internal', min: 0, sla: 48, noSelf: true, active: true }
  ];
  const PEND = ['pendiente', 'info'];
  const isPend = (a) => PEND.includes(a.status);
  const amtPEN = (a) => toPEN(Math.abs(a.amount || 0), a.currency);
  const stBadge = (a) => a.status === 'info' ? UI.badge('pendiente', 'Esperando información') : a.status === 'anulada' ? UI.badge('cancelada', 'Anulada') : UI.badge(a.status);

  /* ---------------- Semillas ---------------- */
  function seedApprovals() {
    let dirty = false;
    if (!DB.approvalRules) { DB.approvalRules = clone(DEFAULT_RULES); dirty = true; }
    if (!DB.providerRequests) {
      DB.providerRequests = [
        { id: 'SOL-TAR-0102', providerId: 'PRV-001', serviceId: 'SRV-008', current: 95, proposed: 104, currency: 'USD', from: '2026-11-01', reason: 'Ajuste por inflación / costos: incremento de energía y planilla (+9,5 %). Se mantiene desayuno buffet y late check-out sujeto a disponibilidad.', status: 'pendiente', ts: '2026-09-28 11:05', user: 'U17' },
        { id: 'SOL-TAR-0101', providerId: 'PRV-004', serviceId: 'SRV-012', current: 40, proposed: 45, currency: 'PEN', from: '2026-11-01', reason: 'Cambio de temporada: mayor costo de combustible y peajes en la ruta Cusco — Mollepata — Soraypampa.', status: 'pendiente', ts: '2026-09-27 15:30', user: null }
      ];
      dirty = true;
    }
    if (!DB.approvals) {
      /* Solicitudes vivas en los registros de origen (formato idéntico al de ventas.js / finanzas.js) */
      const q = Q.quote('COT-2026-00189');
      if (q && q.versions.length === 1 && q.status === 'enviada') {
        const v1 = q.versions[0]; const v2 = clone(v1);
        v1.status = 'reemplazada';
        Object.assign(v2, { v: 2, date: '2026-09-28', user: 'U03', status: 'borrador', discountPct: 8, notes: 'Ajuste por negociación: 8 % por abono del 50 % antes del 15/10 (acta APAFA). ' + (v1.notes || '') });
        v2.approvalRequest = { by: 'U03', ts: '2026-09-28 17:40', v: 2, reasons: needsInternal(v2), note: 'APAFA confirma 44 viajeros y abono del 50 % antes del 15/10. La competencia ofrece 7 %. Alta probabilidad de cierre.', status: 'pendiente' };
        q.versions.push(v2); q.currentVersion = 2; q.status = 'borrador';
      }
      const rj = Q.reservation('RES-2026-000349');
      if (rj && !rj.cancelRequest && rj.status !== 'cancelada') rj.cancelRequest = { by: 'U03', ts: '2026-09-29 08:40', reason: 'Solicitud del cliente: Emily Johnson prefiere incluir traslado y Humantay en la cotización COT-2026-00188 (una sola reserva). Anular este borrador para no duplicar servicios.', status: 'pendiente' };
      const py = DB.payments.find(p => p.id === 'PAG-01921');
      if (py && !py.reversalRequest && py.status === 'aplicado') py.reversalRequest = { by: 'U04', ts: '2026-09-29 08:20', reason: 'El Yape se abonó en soles (S/ 1 496, ver BNK-2) y no en USD 400: revertir y volver a registrar con el tipo de cambio del día para corregir la boleta B001-00008812 observada.', status: 'pendiente' };
      DB.approvals = [
        { id: 'APR-2026-0001', type: 'credit_b2b', origin: false, title: 'Ampliación temporal de línea de crédito — Pacífico Travel Group', requester: 'U04', createdAt: '2026-09-28 16:05', amount: 10000, currency: 'PEN', ref: { kind: 'agency', id: 'AGB-03' }, detail: 'La agencia está bloqueada (usa S/ 14 200 de S/ 15 000) y pide un bloque de 20 pax para Año Nuevo. Propongo ampliar la línea en S/ 10 000 hasta el 31/01/2027; pagos puntuales durante 2026.', status: 'pendiente', level: 2, steps: [{ level: 1, by: 'U02', ts: '2026-09-28 18:30', note: 'Visto bueno comercial: historial de pago puntual y bloque de alta rentabilidad.' }], dueAt: '2026-09-29 18:30', delegatedTo: null, info: [], log: [{ ts: '2026-09-28 16:05', user: 'U04', action: 'Solicitud creada', note: '' }, { ts: '2026-09-28 18:30', user: 'U02', action: 'Aprobó nivel 1', note: 'Visto bueno comercial: historial de pago puntual y bloque de alta rentabilidad.' }] },
        { id: 'APR-2026-0002', type: 'refund', origin: false, title: 'Reembolso fuera de política — Sophie Martin (Humantay)', requester: 'U03', createdAt: '2026-09-29 08:15', amount: 45, currency: 'USD', ref: { kind: 'reservation', id: 'RES-2026-000346' }, detail: 'El 25/09 el recojo se retrasó 25 min (INC-0086) y la pasajera tuvo menos tiempo en la laguna. La política no contempla reembolso por servicio ejecutado; propongo USD 45 como gesto comercial (NPS 9, potencial referidora).', status: 'pendiente', level: 1, steps: [], dueAt: '2026-09-30 08:15', delegatedTo: null, info: [], log: [{ ts: '2026-09-29 08:15', user: 'U03', action: 'Solicitud creada', note: '' }] },
        { id: 'APR-2026-0003', type: 'other', origin: false, title: 'Emisión de vouchers con saldo por cobrar — Minera Cordillera Blanca', requester: 'U06', createdAt: '2026-09-27 09:30', amount: 35166, currency: 'PEN', ref: { kind: 'reservation', id: 'RES-2026-000348' }, detail: 'Cliente corporativo con crédito 30 días: se requiere emitir vouchers antes del pago del saldo (CXC-00711, vence el 04/11).', status: 'aprobada', level: 1, steps: [{ level: 1, by: 'U02', ts: '2026-09-27 11:10', note: 'Aprobado: contrato corporativo con crédito 30 d vigente.' }], decidedBy: 'U02', decidedAt: '2026-09-27 11:10', decisionNote: 'Aprobado: contrato corporativo con crédito 30 d vigente.', dueAt: '2026-09-29 09:30', delegatedTo: null, info: [], log: [{ ts: '2026-09-27 09:30', user: 'U06', action: 'Solicitud creada', note: '' }, { ts: '2026-09-27 11:10', user: 'U02', action: 'Aprobó', note: 'Contrato corporativo con crédito 30 d vigente.' }] },
        { id: 'APR-2026-0004', type: 'other', origin: false, title: 'Upgrade sin costo a Hotel Piedra Viva — Familia Castañeda', requester: 'U04', createdAt: '2026-09-26 15:00', amount: 1340, currency: 'PEN', ref: { kind: 'quote', id: 'COT-2026-00190' }, detail: 'Absorber la diferencia de upgrade (S/ 1 340) para asegurar el cierre de Año Nuevo.', status: 'rechazada', level: 1, steps: [], decidedBy: 'U02', decidedAt: '2026-09-26 18:20', decisionNote: 'El upgrade ya está cotizado en v2; no absorber costo en temporada de Año Nuevo (factor 1,40).', dueAt: '2026-09-28 15:00', delegatedTo: null, info: [], log: [{ ts: '2026-09-26 15:00', user: 'U04', action: 'Solicitud creada', note: '' }, { ts: '2026-09-26 18:20', user: 'U02', action: 'Rechazó', note: 'El upgrade ya está cotizado en v2.' }] }
      ];
      dirty = true;
    }
    if (dirty) Store.save();
  }

  /* ---------------- Reglas: niveles aplicables ---------------- */
  function levelsFor(a) {
    const amt = amtPEN(a); const by = {};
    (DB.approvalRules || []).filter(r => r.type === a.type && r.active && amt >= (Number(r.min) || 0)).forEach(r => { if (!by[r.level] || (Number(r.min) || 0) > (Number(by[r.level].min) || 0)) by[r.level] = r; });
    const out = Object.keys(by).map(Number).sort().map(k => by[k]);
    return out.length ? out : [{ id: '—', type: a.type, level: 1, perm: TYPES[a.type].perm1 || 'quotes.approve_internal', min: 0, sla: 24, noSelf: true, active: true }];
  }
  const ruleOf = (a) => { const ls = levelsFor(a); return ls[Math.min(a.level, ls.length) - 1]; };

  /* ---------------- Sincronización con los módulos de origen ---------------- */
  function candidates() {
    const out = [];
    DB.quotes.forEach(q => {
      if (!OPENQ.includes(q.status)) return; const v = curV(q); const t = Pricing.quoteTotals(v); const rs = needsInternal(v, t);
      if (!rs.length || v.internalApproval) return; const ar = v.approvalRequest;
      if (ar && ar.status !== 'pendiente') return; if (!ar && q.status === 'borrador') return;
      out.push({ key: 'quote:' + q.id + ':v' + v.v, type: 'quote', ref: { kind: 'quote', id: q.id, v: v.v }, title: q.id + ' v' + v.v + ' · ' + q.title, requester: ar ? ar.by : q.owner, createdAt: ar ? ar.ts : v.date + ' 09:00', amount: r2(t.total), currency: q.currency, detail: ar ? (ar.note || '') : 'Detectada por la regla: la cotización está en estado «' + UI.statusLabel(q.status) + '» fuera de política y sin aprobación interna registrada.' });
    });
    DB.reservations.forEach(r => {
      const cr = r.cancelRequest; if (!cr || cr.status !== 'pendiente' || r.status === 'cancelada') return;
      out.push({ key: 'cancel:' + r.id + ':' + cr.ts, type: 'cancel', ref: { kind: 'reservation', id: r.id, ts: cr.ts }, title: 'Anular ' + r.id + ' · ' + r.title, requester: cr.by, createdAt: cr.ts, amount: r.total, currency: r.currency, detail: cr.reason || '' });
    });
    DB.payments.forEach(p => {
      const rr = p.reversalRequest; if (!rr || (rr.status && rr.status !== 'pendiente') || p.status === 'revertido') return;
      out.push({ key: 'reversal:' + p.id + ':' + rr.ts, type: 'reversal', ref: { kind: 'payment', id: p.id, ts: rr.ts }, title: 'Revertir ' + p.id + ' · ' + p.method + ' · ' + p.resId, requester: rr.by, createdAt: rr.ts, amount: p.amount, currency: p.currency, detail: rr.reason || '' });
    });
    DB.payables.forEach(p => {
      cxpNorm(p); if (p.approved || bal(p) <= 0) return;
      const op = DB.operations.find(o => o.resId === p.resId);
      out.push({ key: 'payable:' + p.id + ':' + (p.approvalRound || 1), type: 'payable', ref: { kind: 'payable', id: p.id }, title: p.id + ' · ' + Q.providerName(p.providerId) + ' · ' + p.concept, requester: p.createdBy || (op ? op.coordinator : 'U05'), createdAt: p.createdAt || (addDays(p.due, -15) < TODAY() ? addDays(p.due, -15) : TODAY()) + ' 10:00', amount: p.amount, currency: p.currency, detail: 'Obligación con proveedor asociada a ' + (p.resId || 'sin reserva') + ' · vence el ' + date(p.due) + (isCost(p) ? ' · costo adicional (PROC-045)' : '') });
    });
    DB.commissions.forEach(c => {
      if (c.status !== 'calculada') return; const res = Q.reservation(c.resId);
      out.push({ key: 'commission:' + c.id + ':' + (c.approvalRound || 1), type: 'commission', ref: { kind: 'commission', id: c.id }, title: c.id + ' · ' + c.kind + ' · ' + (c.kind === 'Agencia B2B' ? ((Q.agency(c.beneficiary) || {}).name || c.beneficiary) : Q.userName(c.beneficiary)), requester: c.createdBy || 'Sistema', createdAt: c.createdAt || (res ? res.createdAt : TODAY() + ' 08:00'), amount: c.amount, currency: c.currency, detail: fmtN(c.pct, 1) + ' % sobre base ' + money(c.base, c.currency) + ' · ' + c.resId });
    });
    (DB.providerRequests || []).forEach(r => {
      if (r.status !== 'pendiente') return; const s = Q.service(r.serviceId) || {};
      out.push({ key: 'provider_rate:' + r.id, type: 'provider_rate', ref: { kind: 'providerRequest', id: r.id }, title: r.id + ' · ' + Q.providerName(r.providerId) + ' · ' + (s.name || r.serviceId), requester: r.user || r.providerId, createdAt: r.ts, amount: r2(r.proposed - r.current), currency: r.currency, detail: r.reason || '' });
    });
    return out;
  }
  function originState(a) {
    const R = a.ref || {};
    if (a.type === 'quote') {
      const q = Q.quote(R.id); const v = q && q.versions.find(x => x.v === R.v);
      if (!q || !v) return { status: 'anulada', note: 'La cotización ya no existe' };
      if (v.internalApproval) return { status: 'aprobada', by: v.internalApproval.by, ts: v.internalApproval.ts, note: v.internalApproval.reason || '' };
      if (v.approvalRequest && v.approvalRequest.status === 'rechazada') return { status: 'rechazada', by: v.approvalRequest.decidedBy, ts: v.approvalRequest.decidedAt, note: v.approvalRequest.decisionNote || '' };
      if (v.approvalRequest && v.approvalRequest.status === 'anulada') return { status: 'anulada', note: 'Solicitud retirada o reemplazada por una nueva versión' };
      if (q.currentVersion !== R.v || !OPENQ.includes(q.status)) return { status: 'anulada', note: 'Nueva versión o cotización cerrada (' + UI.statusLabel(q.status) + ')' };
      if (!needsInternal(v).length) return { status: 'anulada', note: 'La versión ya no está fuera de política' };
      return null;
    }
    if (a.type === 'cancel') {
      const r = Q.reservation(R.id); if (!r) return { status: 'anulada', note: 'Reserva inexistente' };
      const cr = r.cancelRequest;
      if (r.status === 'cancelada') return { status: 'aprobada', by: (cr && cr.decidedBy) || 'Sistema', ts: r.cancelledAt, note: r.cancelReason || '' };
      if (!cr || cr.ts !== R.ts) return { status: 'anulada', note: 'Solicitud reemplazada' };
      if (cr.status === 'rechazada') return { status: 'rechazada', by: cr.decidedBy, ts: cr.decidedAt, note: cr.decisionNote || '' };
      if (cr.status !== 'pendiente') return { status: 'anulada', note: 'Solicitud retirada' };
      return null;
    }
    if (a.type === 'reversal') {
      const p = DB.payments.find(x => x.id === R.id); if (!p) return { status: 'anulada', note: 'Pago inexistente' };
      if (p.status === 'revertido') return { status: 'aprobada', by: p.revertedBy, ts: p.revertedAt, note: p.revertReason || '' };
      const rr = p.reversalRequest; if (!rr || rr.ts !== R.ts || (rr.status && rr.status !== 'pendiente')) return { status: 'anulada', note: 'Solicitud cerrada en Finanzas' };
      return null;
    }
    if (a.type === 'payable') {
      const p = DB.payables.find(x => x.id === R.id); if (!p) return { status: 'anulada', note: 'CxP inexistente' };
      cxpNorm(p); if (p.approved) return { status: 'aprobada', by: p.approvedBy || 'Sistema', ts: p.approvedAt, note: 'Aprobada en Finanzas' };
      if (bal(p) <= 0) return { status: 'anulada', note: 'Obligación pagada' };
      return null;
    }
    if (a.type === 'commission') {
      const c = DB.commissions.find(x => x.id === R.id); if (!c) return { status: 'anulada', note: 'Comisión inexistente' };
      if (c.status !== 'calculada') return { status: 'aprobada', by: c.approvedBy || 'Sistema', ts: c.approvedAt, note: 'Aprobada en Finanzas' };
      return null;
    }
    if (a.type === 'provider_rate') {
      const r = (DB.providerRequests || []).find(x => x.id === R.id); if (!r) return { status: 'anulada', note: 'Solicitud inexistente' };
      if (r.status !== 'pendiente') return { status: r.status === 'aprobada' ? 'aprobada' : r.status === 'rechazada' ? 'rechazada' : 'anulada', by: r.decidedBy, ts: r.decidedAt, note: r.decisionNote || '' };
      return null;
    }
    return null;
  }
  const nextAprId = () => nextNum(DB.approvals, 'APR-2026-', 4);
  function sync() {
    let dirty = false;
    candidates().forEach(c => {
      const ex = DB.approvals.find(a => a.key === c.key);
      if (ex) { if (isPend(ex) && (ex.title !== c.title || ex.amount !== c.amount)) { ex.title = c.title; ex.amount = c.amount; dirty = true; } return; }
      const a = Object.assign({ id: nextAprId(), origin: true, status: 'pendiente', level: 1, steps: [], delegatedTo: null, info: [], log: [{ ts: c.createdAt, user: c.requester, action: 'Solicitud registrada en ' + TYPES[c.type].origin, note: c.detail }] }, c);
      a.dueAt = addMin(a.createdAt, (ruleOf(a).sla || 24) * 60);
      DB.approvals.push(a); dirty = true;
    });
    DB.approvals.forEach(a => {
      if (!a.origin || !isPend(a)) return;
      const st = originState(a); if (!st) return;
      Object.assign(a, { status: st.status, decidedBy: st.by || null, decidedAt: st.ts || nowStr(), decisionNote: st.note || '', closedInOrigin: true });
      a.log.push({ ts: st.ts || nowStr(), user: st.by || 'Sistema', action: st.status === 'aprobada' ? 'Resuelta (aprobada) en el módulo de origen' : st.status === 'rechazada' ? 'Resuelta (rechazada) en el módulo de origen' : 'Anulada', note: st.note || '' });
      dirty = true;
    });
    if (dirty) Store.save();
  }

  /* ---------------- Quién puede qué ---------------- */
  function blockReason(a, uid) {
    uid = uid || me();
    if (!isPend(a)) return 'La solicitud ya está ' + UI.statusLabel(a.status).toLowerCase() + '.';
    const r = ruleOf(a);
    if (a.requester === uid && r.noSelf !== false) return 'Usted es el solicitante: la regla impide la autoaprobación (segregación de funciones).';
    if (a.steps.some(s => s.by === uid)) return 'Ya aprobó un nivel anterior; el nivel ' + a.level + ' debe resolverlo otro usuario.';
    if (a.delegatedTo && a.delegatedTo !== uid) return 'Delegada a ' + who(a.delegatedTo) + '.';
    if (!userCan(uid, r.perm) || !userCan(uid, 'approvals.view')) return 'Requiere el permiso ' + r.perm + ' (nivel ' + a.level + ').';
    return '';
  }
  const canAct = (a, uid) => !blockReason(a, uid);
  const approveBlock = (a) => {
    if (a.type === 'quote') { const q = Q.quote(a.ref.id); const v = q && q.versions.find(x => x.v === a.ref.v); if (v && overCap(v) && !can('quotes.discount_override')) return 'El descuento ' + fmtN(v.discountPct, 1) + '% supera el tope de ' + MAX_DISC + '%: requiere quotes.discount_override.'; }
    if (a.type === 'reversal') { const p = DB.payments.find(x => x.id === a.ref.id); if (p && !['aplicado', 'confirmado'].includes(p.status)) return 'Solo se revierten pagos confirmados o aplicados (PROC-043).'; }
    if (a.type === 'cancel') { const r = Q.reservation(a.ref.id); if (r && ['cancelada', 'completada'].includes(r.status)) return 'La reserva está ' + UI.statusLabel(r.status).toLowerCase() + '.'; }
    if (a.type === 'refund' || a.type === 'credit_b2b') { if (a.ref && a.ref.kind === 'agency' && !Q.agency(a.ref.id)) return 'La agencia ya no existe.'; }
    return '';
  };
  function visible(a) {
    if (isSup()) return true;
    const uid = me();
    if (a.requester === uid || a.delegatedTo === uid || a.steps.some(s => s.by === uid) || a.decidedBy === uid) return true;
    return (DB.approvalRules || []).some(r => r.type === a.type && r.active && userCan(uid, r.perm));
  }
  const mineToDo = () => DB.approvals.filter(a => isPend(a) && canAct(a));
  const approversOf = (a) => { const r = ruleOf(a); return holders(r.perm).filter(u => u.id !== a.requester && !a.steps.some(s => s.by === u.id)).map(u => u.id); };

  /* ---------------- SLA ---------------- */
  function slaOf(a) {
    if (!isPend(a)) { if (!a.decidedAt) return { cls: 'mute', txt: '—', rank: 9 }; const ok = !a.dueAt || a.decidedAt <= a.dueAt; return { cls: ok ? 'ok' : 'bad', txt: 'Resuelta en ' + dur(minsBetween(a.createdAt, a.decidedAt)) + (ok ? '' : ' · fuera de SLA'), rank: 9 }; }
    if (a.status === 'info') return { cls: 'mute', txt: 'En pausa · esperando información', rank: 5 };
    const left = minsBetween(nowStr(), a.dueAt); const tot = (ruleOf(a).sla || 24) * 60;
    if (left < 0) return { cls: 'bad', txt: 'Vencida hace ' + dur(-left), rank: 0 };
    if (left <= Math.max(120, tot * 0.25)) return { cls: 'warn', txt: 'Vence en ' + dur(left), rank: 1 };
    return { cls: 'ok', txt: 'Vence en ' + dur(left), rank: 2 };
  }
  const slaChip = (a) => { const s = slaOf(a); return '<span class="cb-sla ' + s.cls + '"><i></i>' + esc(s.txt) + '</span>'; };

  /* ---------------- Enlaces al registro de origen ---------------- */
  function recLink(a) {
    const R = a.ref || {};
    switch (R.kind) {
      case 'quote': return lnk('cotizaciones', R.id, esc(R.id) + (R.v ? ' v' + R.v : ''), 'mono');
      case 'reservation': return lnk('reservas', R.id, esc(R.id), 'mono');
      case 'payment': return lnk('finanzas/pagos', R.id, esc(R.id), 'mono');
      case 'payable': return lnk('finanzas/proveedores', R.id, esc(R.id), 'mono');
      case 'commission': return lnk('finanzas/comisiones', R.id, esc(R.id), 'mono');
      case 'providerRequest': { const r = (DB.providerRequests || []).find(x => x.id === R.id) || {}; return '<span class="mono">' + esc(R.id) + '</span> · ' + lnk('catalogo/servicios', r.serviceId, esc(r.serviceId || ''), 'mono'); }
      case 'agency': return lnk('canales/b2b', '', esc((Q.agency(R.id) || {}).name || R.id));
      default: return '—';
    }
  }
  function impactLine(a) {
    const R = a.ref || {};
    if (a.type === 'quote') { const q = Q.quote(R.id); const v = q && q.versions.find(x => x.v === R.v); if (!v) return ''; return needsInternal(v).join(' y ') + (overCap(v) ? ' · supera tope ' + MAX_DISC + '%' : ''); }
    if (a.type === 'cancel') { const r = Q.reservation(R.id); return r ? 'Reserva ' + UI.statusLabel(r.status).toLowerCase() + ' · viaje ' + dateShort(r.travelFrom) : ''; }
    if (a.type === 'reversal') { const p = DB.payments.find(x => x.id === R.id); return p ? 'Desaplica de ' + (p.receivableId || 'sin CxC') : ''; }
    if (a.type === 'payable') { const p = DB.payables.find(x => x.id === R.id); return p ? 'Vence ' + dateShort(p.due) + ' · ' + UI.statusLabel(cxpStatus(p)).toLowerCase() : ''; }
    if (a.type === 'commission') { const c = DB.commissions.find(x => x.id === R.id); return c ? fmtN(c.pct, 1) + ' % de ' + money(c.base, c.currency, 0) : ''; }
    if (a.type === 'provider_rate') { const r = (DB.providerRequests || []).find(x => x.id === R.id); return r ? 'Por unidad · ' + money(r.current, r.currency) + ' → ' + money(r.proposed, r.currency) + ' (' + (r.proposed >= r.current ? '+' : '') + fmtN((r.proposed - r.current) / r.current * 100, 1) + ' %)' : ''; }
    if (a.type === 'credit_b2b') { const ag = Q.agency(R.id); return ag ? 'Línea ' + money(ag.creditLimit, ag.currency, 0) + ' → ' + money(ag.creditLimit + (isPend(a) ? a.amount : 0), ag.currency, 0) : ''; }
    if (a.type === 'refund') return 'Genera reembolso pendiente en Finanzas';
    return '';
  }

  /* =====================================================================================
     EFECTOS DE APROBACIÓN / RECHAZO POR TIPO (mismo efecto que el módulo de origen)
     ===================================================================================== */
  const EFFECT_TXT = {
    quote: 'Registra la aprobación interna en la versión (v.internalApproval), cierra la solicitud del asesor y habilita el envío al cliente — igual que Cotizaciones › Aprobar.',
    cancel: 'Ejecuta la cancelación PROC-028: libera cupos, cancela servicios, anula vouchers, cancela CxC, emite nota de crédito/reembolso o CxC de penalidad, cancela la orden operativa y notifica.',
    reversal: 'Revierte el pago, lo desaplica de la CxC, recalcula saldo (y crédito B2B si aplica) y notifica al cliente — igual que Finanzas › Revertir pago (PROC-043).',
    payable: 'Aprueba la obligación con el proveedor (queda lista para programar pago); si es costo adicional, impacta la rentabilidad de la reserva — igual que Finanzas › Aprobar CxP.',
    commission: 'Pasa la comisión de Calculada a Aprobada (lista para pago) — igual que Finanzas › Comisiones › Aprobar (PROC-047).',
    provider_rate: 'Actualiza el costo del servicio: si la vigencia ya empezó se aplica de inmediato; si es futura queda programada con su fecha. Se notifica al proveedor en la extranet.',
    credit_b2b: 'Amplía la línea de crédito de la agencia en el monto aprobado y, si estaba bloqueada por consumo, la reactiva (PROC-053).',
    refund: 'Crea un pago de reembolso en estado Pendiente para que Finanzas lo procese por el mismo medio de pago.',
    other: 'Registra la excepción aprobada; el responsable ejecuta la acción en el módulo correspondiente con esta aprobación como evidencia.'
  };
  const EFFECT = {
    quote(a, note) {
      const q = Q.quote(a.ref.id); const v = q.versions.find(x => x.v === a.ref.v); const reasons = needsInternal(v); const ar = v.approvalRequest;
      v.internalApproval = { by: me(), ts: nowStr(), reason: note, override: true, overCap: overCap(v) };
      if (ar && ar.status === 'pendiente') Object.assign(ar, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: note });
      Audit.log('Cotización', q.id, 'aprobacion_interna', 'v' + v.v + ' ' + reasons.join(', '), 'aprobada: ' + note + (overCap(v) ? ' · override de tope' : ''));
      if (q.owner !== me()) Notify.push('cotizacion.aprobacion_aprobada', 'Portal', q.owner, q.id + ' v' + v.v + ': gerencia aprobó la solicitud' + (note ? ' — ' + note : ''));
    },
    reversal(a, why) {
      const p = DB.payments.find(x => x.id === a.ref.id); const r = DB.receivables.find(x => x.id === p.receivableId);
      const prev = p.status; p.status = 'revertido'; p.revertReason = why; p.revertedAt = nowStr(); p.revertedBy = me(); hist(p, 'revertido', why);
      Audit.log('Pago', p.id, 'revertir', prev, 'revertido · ' + why);
      if (p.method === 'Crédito B2B') { const res = Q.reservation(p.resId); const ag = res && agencyOfClient(res.clientId); if (ag) ag.creditUsed = Math.max(0, r2(ag.creditUsed - penAmt(p.amount, p.currency, p.fx))); }
      if (r) { const before = r.paid || 0; recalcCxC(r); Audit.log('Cuenta por cobrar', r.id, 'recalcular_saldo', money(before, r.currency), money(r.paid, r.currency) + ' · ' + UI.statusLabel(r.status)); }
      const res = Q.reservation(p.resId); const c = res ? Q.client(res.clientId) || {} : {};
      Notify.push('pago.revertido', 'Email', c.email || c.name || p.resId, 'Reversión del pago ' + p.id + ' — ' + money(p.amount, p.currency));
      if (p.reversalRequest) Object.assign(p.reversalRequest, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: why });
    },
    payable(a) {
      const p = DB.payables.find(x => x.id === a.ref.id); cxpNorm(p);
      const before = cxpStatus(p); p.approved = true; p.approvedBy = me(); p.approvedAt = nowStr(); p.status = cxpStatus(p); delete p.approvalRejected;
      Audit.log(isCost(p) ? 'Costo' : 'Cuenta por pagar', p.id, 'aprobar', before, 'aprobada');
      if (isCost(p) && p.resId) Audit.log('Rentabilidad', p.resId, 'impacto_costo', '', '+' + money(p.amount, p.currency) + ' (' + p.id + ')');
    },
    commission(a) {
      const c = DB.commissions.find(x => x.id === a.ref.id);
      c.status = 'aprobada'; c.approvedBy = me(); c.approvedAt = nowStr(); hist(c, 'aprobada'); delete c.approvalRejected;
      Audit.log('Comisión', c.id, 'aprobar', 'calculada', 'aprobada · ' + money(c.amount, c.currency));
    },
    provider_rate(a, note) {
      const r = DB.providerRequests.find(x => x.id === a.ref.id); const s = Q.service(r.serviceId); const before = s ? s.cost : r.current;
      Object.assign(r, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: note });
      if (s) {
        if (r.from <= TODAY()) s.cost = r.proposed; else s.scheduledCost = { cost: r.proposed, from: r.from, reqId: r.id };
        s.costHistory = (s.costHistory || []).concat([{ ts: nowStr(), from: r.from, before, after: r.proposed, reqId: r.id, by: me() }]);
        Audit.log('Tarifa proveedor', s.id, 'aprobar_actualizacion', s.currency + ' ' + before, s.currency + ' ' + r.proposed + ' desde ' + r.from + ' (' + r.id + ')');
      }
      notifyProvider(r, 'Su solicitud ' + r.id + ' fue aprobada: ' + money(r.proposed, r.currency) + ' vigente desde ' + date(r.from));
    },
    credit_b2b(a) {
      const ag = Q.agency(a.ref.id); if (!ag) return; const before = ag.creditLimit; const bst = ag.status;
      ag.creditLimit = r2(before + toPEN(a.amount, a.currency));
      ag.creditExceptions = (ag.creditExceptions || []).concat([{ aprId: a.id, amount: a.amount, ts: nowStr(), by: me() }]);
      if (ag.status === 'bloqueada' && ag.creditUsed < ag.creditLimit) ag.status = 'activa';
      Audit.log('Agencia B2B', ag.id, 'ampliar_credito', money(before, ag.currency) + ' · ' + bst, money(ag.creditLimit, ag.currency) + ' · ' + ag.status + ' (' + a.id + ')');
      Notify.push('b2b.credito', 'Email', ag.contact + ' <' + ag.name + '>', 'Su línea de crédito fue ampliada a ' + money(ag.creditLimit, ag.currency));
    },
    refund(a) {
      const res = Q.reservation(a.ref && a.ref.id); const pid = nextIdV('payments', 'PAG-', 5);
      DB.payments.unshift({ id: pid, receivableId: null, resId: res ? res.id : null, method: 'Reembolso (mismo medio de pago)', amount: a.amount, currency: a.currency, date: TODAY(), status: 'pendiente', ref: 'Reembolso excepcional ' + a.id, by: me(), kind: 'reembolso' });
      Audit.log('Pago', pid, 'crear_reembolso', '', money(a.amount, a.currency) + ' · ' + a.id);
      Notify.push('pago.reembolso', 'Portal', 'U07', 'Reembolso excepcional ' + pid + ' por ' + money(a.amount, a.currency) + ' aprobado (' + a.id + ')');
    },
    other() { }
  };
  const REJECT = {
    quote(a, note) {
      const q = Q.quote(a.ref.id); const v = q.versions.find(x => x.v === a.ref.v); const reasons = needsInternal(v); const ar = v.approvalRequest;
      if (ar) Object.assign(ar, { status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: note });
      else v.approvalRequest = { by: q.owner, ts: nowStr(), v: v.v, reasons, note: '', status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: note };
      Audit.log('Cotización', q.id, 'rechazar_aprobacion_interna', 'v' + v.v + ' ' + reasons.join(', '), 'rechazada: ' + note);
      if (q.owner !== me()) Notify.push('cotizacion.aprobacion_rechazada', 'Portal', q.owner, q.id + ' v' + v.v + ': gerencia rechazó la solicitud — ' + note);
    },
    cancel(a, t) {
      const r = Q.reservation(a.ref.id); const cr = r.cancelRequest;
      Object.assign(cr, { status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: t });
      Audit.log('Reserva', r.id, 'rechazar_solicitud_anulacion', 'pendiente', 'rechazada · ' + t);
      Notify.push('reserva.anulacion_rechazada', 'Portal', cr.by, 'Gerencia rechazó la anulación de ' + r.id + (t ? ': ' + t : ''));
    },
    reversal(a, t) {
      const p = DB.payments.find(x => x.id === a.ref.id); const rr = p.reversalRequest;
      if (rr) { Object.assign(rr, { status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: t }); p.reversalHistory = (p.reversalHistory || []).concat([rr]); delete p.reversalRequest; }
      hist(p, p.status, 'Solicitud de reversión rechazada: ' + t);
      Audit.log('Pago', p.id, 'rechazar_solicitud_reversion', 'pendiente', 'rechazada · ' + t);
    },
    payable(a, t) { const p = DB.payables.find(x => x.id === a.ref.id); p.approvalRejected = { by: me(), ts: nowStr(), note: t }; p.observation = t; Audit.log('Cuenta por pagar', p.id, 'observar', cxpStatus(p), 'observada · ' + t); },
    commission(a, t) { const c = DB.commissions.find(x => x.id === a.ref.id); c.approvalRejected = { by: me(), ts: nowStr(), note: t }; c.observation = t; hist(c, 'calculada', 'Observada: ' + t); Audit.log('Comisión', c.id, 'observar', 'calculada', 'observada · ' + t); },
    provider_rate(a, t) { const r = DB.providerRequests.find(x => x.id === a.ref.id); Object.assign(r, { status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: t }); Audit.log('Tarifa proveedor', r.serviceId, 'rechazar_actualizacion', r.currency + ' ' + r.current, 'rechazada ' + r.id + ' · ' + t); notifyProvider(r, 'Su solicitud ' + r.id + ' fue rechazada: ' + t); },
    credit_b2b() { }, refund() { }, other() { }
  };
  function notifyProvider(r, msg) { const u = DB.users.find(x => x.providerId === r.providerId); const p = Q.provider(r.providerId) || {}; if (u) Notify.push('proveedor.tarifa', 'Portal', u.id, msg); else Notify.push('proveedor.tarifa', 'Email', p.email || p.name, msg); }
  function notifyRequester(a, subject) { if (a.requester && Q.user(a.requester) && a.requester !== me()) Notify.push('aprobacion.resultado', 'Portal', a.requester, subject); }
  function logA(a, action, note) { a.log = a.log || []; a.log.push({ ts: nowStr(), user: me(), action, note: note || '' }); }

  /* ---------------- Acciones ---------------- */
  function doApprove(a) {
    const b = blockReason(a); if (b) return deny(b);
    const ab = approveBlock(a); if (ab) return deny(ab);
    const levels = levelsFor(a); const final = a.level >= levels.length;
    if (final && a.type === 'cancel') return cancelApproval(a);
    const needNote = a.type === 'quote' || a.type === 'reversal';
    UI.modal({ title: 'Aprobar ' + esc(a.id) + (levels.length > 1 ? ' · nivel ' + a.level + ' de ' + levels.length : ''), size: 'sm', sub: esc(TYPES[a.type].label),
      body: '<div class="cb-box"><b class="small">' + esc(a.title) + '</b><div class="xs muted" style="margin-top:3px">' + money(a.amount, a.currency) + ' · ' + esc(impactLine(a)) + '</div></div>' +
        (final ? UI.alert('info', '<b>Efecto al aprobar:</b> ' + EFFECT_TXT[a.type]) : UI.alert('info', 'Aprobación de <b>nivel ' + a.level + '</b>. La solicitud pasará al nivel ' + (a.level + 1) + ' (' + esc(levels[a.level].perm) + ', monto ≥ ' + money(levels[a.level].min, 'PEN', 0) + '). El efecto en el registro se ejecuta al completar el último nivel.')) +
        '<div style="margin-top:12px">' + UI.form([{ id: 'ap-note', label: needNote ? (a.type === 'reversal' ? 'Motivo de la reversión' : 'Justificación') : 'Comentario (opcional)', type: 'textarea', rows: 3, col: 12, required: needNote, value: a.type === 'reversal' ? a.detail : '' }]) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: final ? 'Aprobar y ejecutar' : 'Aprobar nivel ' + a.level, cls: 'primary', icon: 'checkCircle', onClick: (m) => {
        if (!UI.validate(m)) return false; const note = m.querySelector('#ap-note').value.trim();
        if (!final) { advance(a, note); return; }
        try { EFFECT[a.type](a, note); } catch (e) { console.error(e); UI.toast('No se pudo ejecutar el efecto en el registro de origen: ' + esc(e.message), 'bad'); return false; }
        close(a, 'aprobada', note);
        UI.toast(a.id + ' aprobada. Efecto aplicado en ' + esc(TYPES[a.type].origin) + '.'); App.render();
      } }] });
  }
  function advance(a, note) {
    a.steps.push({ level: a.level, by: me(), ts: nowStr(), note });
    logA(a, 'Aprobó nivel ' + a.level, note);
    Audit.log('Aprobación', a.id, 'aprobar_nivel_' + a.level, 'nivel ' + a.level, 'nivel ' + (a.level + 1) + (note ? ' · ' + note : ''));
    a.level += 1; a.delegatedTo = null; a.dueAt = addMin(nowStr(), (ruleOf(a).sla || 24) * 60);
    approversOf(a).forEach(u => Notify.push('aprobacion.solicitada', 'Portal', u, 'Nivel ' + a.level + ': aprobar ' + a.id + ' — ' + a.title));
    notifyRequester(a, a.id + ': ' + Auth.user.name + ' aprobó el nivel ' + (a.level - 1) + '; pasa a nivel ' + a.level);
    Store.save(); UI.toast('Nivel ' + (a.level - 1) + ' aprobado. Se notificó a los aprobadores del nivel ' + a.level + '.'); App.render();
  }
  function close(a, outcome, note) {
    if (outcome === 'aprobada') a.steps.push({ level: a.level, by: me(), ts: nowStr(), note });
    Object.assign(a, { status: outcome, decidedBy: me(), decidedAt: nowStr(), decisionNote: note, delegatedTo: null });
    logA(a, outcome === 'aprobada' ? 'Aprobó' + (a.steps.length > 1 ? ' (nivel ' + a.level + ', final)' : '') : outcome === 'rechazada' ? 'Rechazó' : 'Retiró la solicitud', note);
    Audit.log('Aprobación', a.id, outcome === 'aprobada' ? 'aprobar' : outcome === 'rechazada' ? 'rechazar' : 'retirar', 'pendiente · nivel ' + a.level, outcome + (note ? ' · ' + note : ''));
    notifyRequester(a, a.id + ' ' + outcome + ' por ' + Auth.user.name + (note ? ': ' + note : '') + ' — ' + a.title);
    Store.save();
  }
  function doReject(a) {
    const b = blockReason(a); if (b) return deny(b);
    UI.confirm({ title: 'Rechazar ' + esc(a.id), message: '<b>' + esc(a.title) + '</b><br>' + esc(TYPES[a.type].label) + ' · ' + money(a.amount, a.currency) + '.<br><br>El motivo es obligatorio, queda en auditoría y se notifica a ' + esc(who(a.requester)) + '.' + (a.type === 'payable' || a.type === 'commission' ? '<br><span class="small muted">El registro queda «observado» en Finanzas hasta que se corrija y se reenvíe a aprobación.</span>' : ''), confirmLabel: 'Rechazar', danger: true, reason: true, reasonLabel: 'Motivo del rechazo',
      onConfirm: (t) => { try { REJECT[a.type](a, t); } catch (e) { console.error(e); UI.toast('No se pudo actualizar el registro de origen: ' + esc(e.message), 'bad'); return; } close(a, 'rechazada', t); UI.toast(a.id + ' rechazada; se notificó al solicitante.', 'warn'); App.render(); } });
  }
  function doInfo(a) {
    const b = blockReason(a); if (b) return deny(b);
    UI.modal({ title: 'Pedir información — ' + esc(a.id), size: 'sm', body: UI.alert('info', 'La solicitud pasa a «Esperando información» y el SLA se pausa hasta que ' + esc(who(a.requester)) + ' responda.') + '<div style="margin-top:12px">' + UI.form([{ id: 'in-q', label: 'Pregunta al solicitante', type: 'textarea', rows: 3, required: true, col: 12, placeholder: 'Ej.: adjunte el sustento del cliente y el costo actualizado del proveedor.' }]) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Enviar pregunta', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const qtext = m.querySelector('#in-q').value.trim();
        a.info = a.info || []; a.info.push({ by: me(), ts: nowStr(), q: qtext, a: null }); a.status = 'info'; a.pausedAt = nowStr();
        logA(a, 'Pidió información', qtext); Audit.log('Aprobación', a.id, 'pedir_informacion', 'pendiente', 'esperando información · ' + qtext);
        if (Q.user(a.requester)) Notify.push('aprobacion.informacion', 'Portal', a.requester, a.id + ': ' + Auth.user.name + ' solicita información — ' + qtext);
        else if (a.type === 'provider_rate') notifyProvider(DB.providerRequests.find(x => x.id === a.ref.id), 'Consulta sobre ' + a.ref.id + ': ' + qtext);
        Store.save(); UI.toast('Pregunta enviada al solicitante; SLA en pausa.', 'info'); App.render();
      } }] });
  }
  function doAnswer(a) {
    const last = (a.info || []).slice().reverse().find(x => !x.a);
    if (!last) return;
    if (a.requester !== me() && !isSup()) return deny('Solo el solicitante responde la consulta.');
    UI.modal({ title: 'Responder consulta — ' + esc(a.id), size: 'sm', body: '<div class="cb-box small"><b>' + esc(who(last.by)) + '</b> · ' + datetime(last.ts) + '<div style="margin-top:4px">' + esc(last.q) + '</div></div><div style="margin-top:12px">' + UI.form([{ id: 'in-a', label: 'Respuesta', type: 'textarea', rows: 4, required: true, col: 12 }]) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Enviar respuesta', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const t = m.querySelector('#in-a').value.trim();
        last.a = t; last.answeredAt = nowStr(); last.answeredBy = me();
        const paused = a.pausedAt ? minsBetween(a.pausedAt, nowStr()) : 0; if (a.dueAt) a.dueAt = addMin(a.dueAt, Math.max(0, paused));
        a.status = 'pendiente'; delete a.pausedAt;
        logA(a, 'Respondió la consulta', t); Audit.log('Aprobación', a.id, 'responder_informacion', 'esperando información', 'pendiente · ' + t);
        Notify.push('aprobacion.informacion', 'Portal', last.by, a.id + ': ' + Auth.user.name + ' respondió — ' + t);
        Store.save(); UI.toast('Respuesta enviada. La solicitud vuelve a la bandeja del aprobador.'); App.render();
      } }] });
  }
  function doDelegate(a) {
    const b = blockReason(a); if (b) return deny(b);
    const r = ruleOf(a);
    const opts = holders(r.perm).filter(u => u.id !== me() && u.id !== a.requester && !a.steps.some(s => s.by === u.id));
    if (!opts.length) return deny('No hay otro usuario con el permiso ' + r.perm + ' al que delegar.');
    UI.modal({ title: 'Delegar ' + esc(a.id), size: 'sm', sub: 'Solo usuarios con el permiso ' + esc(r.perm), body: UI.form([{ id: 'dl-u', label: 'Delegar a', type: 'select', required: true, col: 12, placeholder: 'Seleccione…', options: opts.map(u => [u.id, u.name + ' — ' + Q.roleName(u.role)]) }, { id: 'dl-n', label: 'Nota para el delegado', type: 'textarea', rows: 2, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Delegar', cls: 'primary', icon: 'users', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        const prev = a.delegatedTo; a.delegatedTo = f['dl-u'];
        logA(a, 'Delegó a ' + who(a.delegatedTo), f['dl-n']); Audit.log('Aprobación', a.id, 'delegar', prev ? who(prev) : 'aprobadores del nivel ' + a.level, who(a.delegatedTo) + (f['dl-n'] ? ' · ' + f['dl-n'] : ''));
        Notify.push('aprobacion.delegada', 'Portal', a.delegatedTo, Auth.user.name + ' le delegó ' + a.id + ' — ' + a.title);
        Store.save(); UI.toast('Solicitud delegada a ' + esc(who(a.delegatedTo)) + '.'); App.render();
      } }] });
  }
  function doWithdraw(a) {
    if (a.requester !== me() || !isPend(a)) return deny('Solo el solicitante puede retirar una solicitud pendiente.');
    UI.confirm({ title: 'Retirar solicitud ' + esc(a.id), message: 'La solicitud quedará anulada y los aprobadores dejarán de verla en su bandeja.', confirmLabel: 'Retirar', danger: true, reason: true, reasonLabel: 'Motivo',
      onConfirm: (t) => {
        if (a.type === 'quote') { const q = Q.quote(a.ref.id); const v = q && q.versions.find(x => x.v === a.ref.v); if (v && v.approvalRequest) { v.approvalRequest.status = 'anulada'; Audit.log('Cotización', q.id, 'anular_solicitud_aprobacion', 'pendiente', 'retirada · ' + t); } }
        if (a.type === 'cancel') { const r = Q.reservation(a.ref.id); if (r && r.cancelRequest) { r.cancelRequest.status = 'retirada'; Audit.log('Reserva', r.id, 'retirar_solicitud_anulacion', 'pendiente', 'retirada · ' + t); } }
        if (a.type === 'reversal') { const p = DB.payments.find(x => x.id === a.ref.id); if (p && p.reversalRequest) { p.reversalRequest.status = 'retirada'; p.reversalHistory = (p.reversalHistory || []).concat([p.reversalRequest]); delete p.reversalRequest; Audit.log('Pago', p.id, 'retirar_solicitud_reversion', 'pendiente', 'retirada · ' + t); } }
        close(a, 'anulada', t); UI.toast('Solicitud retirada.', 'info'); App.render();
      } });
  }
  function doResubmit(a) {
    const perm = a.type === 'payable' ? 'finance.payables' : 'finance.commissions';
    if (a.requester !== me() && !can(perm)) return deny('Requiere ' + perm + ' o ser el solicitante.');
    const rec = a.type === 'payable' ? DB.payables.find(x => x.id === a.ref.id) : DB.commissions.find(x => x.id === a.ref.id);
    if (!rec) return;
    UI.confirm({ title: 'Reenviar a aprobación', message: 'Se generará una nueva ronda de aprobación para <b>' + esc(rec.id) + '</b>. Indique qué se corrigió respecto a la observación: «' + esc((rec.approvalRejected || {}).note || '') + '».', confirmLabel: 'Reenviar', reason: true, reasonLabel: 'Corrección realizada',
      onConfirm: (t) => { rec.approvalRound = (rec.approvalRound || 1) + 1; delete rec.approvalRejected; delete rec.observation; rec.resubmittedAt = nowStr(); rec.createdAt = nowStr(); rec.createdBy = me(); Audit.log(a.type === 'payable' ? 'Cuenta por pagar' : 'Comisión', rec.id, 'reenviar_aprobacion', 'observada', 'ronda ' + rec.approvalRound + ' · ' + t); logA(a, 'Reenvió a aprobación (ronda ' + rec.approvalRound + ')', t); Store.save(); sync(); UI.toast(rec.id + ' reenviada a aprobación.'); App.render(); } });
  }

  /* ---- Anulación: último nivel con la misma pantalla de impacto que Reservas › Cancelar ---- */
  function cancelApproval(a) {
    const r = Q.reservation(a.ref.id); if (!r) return deny('Reserva inexistente.');
    const x = cancelCalc(r); const cr = r.cancelRequest || {};
    const ck = (t, d) => '<div class="row top" style="gap:8px;flex-wrap:nowrap;padding:5px 0;border-bottom:1px dashed var(--line-2)">' + I('checkCircle') + '<div class="small"><b>' + t + '</b><div class="xs muted">' + d + '</div></div></div>';
    UI.modal({ title: 'Aprobar anulación — ' + esc(r.id), size: 'lg', sub: 'Solicitud → Política → Impacto económico → Confirmar → Liberar disponibilidad → Cancelar servicios → Finanzas → Notificar → Auditar',
      body: '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Servicio</th><th>Fecha</th><th class="num">Días antes</th><th>Política aplicada</th><th class="num">% penalidad</th><th class="num">Penalidad</th></tr></thead><tbody>' + (x.lines.map(l => '<tr><td>' + esc(l.s.name) + '</td><td class="nowrap">' + dateShort(l.s.date) + '</td><td class="num">' + l.days + '</td><td class="xs muted" style="max-width:260px">' + esc(l.pol || '') + '</td><td class="num">' + l.pct + '%</td><td class="num">' + money(l.pen, r.currency) + '</td></tr>').join('') || '<tr><td colspan="6" class="muted small">Sin servicios activos</td></tr>') + '</tbody></table></div>' +
        '<div class="grid g2" style="margin-top:12px;align-items:start"><div class="cb-box"><div class="section-title" style="margin-bottom:6px">Impacto económico</div><div class="stat-line"><span class="muted">Total de la reserva</span><b>' + money(r.total, r.currency) + '</b></div><div class="stat-line"><span class="muted">Monto pagado</span><b>' + money(x.paid, r.currency) + '</b></div><div class="stat-line"><span class="muted">Total retenido</span><b class="warn">' + money(x.pen, r.currency) + '</b></div><div class="stat-line total"><span>Reembolso al cliente</span><span class="ok">' + money(x.refund, r.currency) + '</span></div>' + (x.owed ? '<div class="stat-line"><span class="muted">Penalidad por cobrar</span><b class="bad">' + money(x.owed, r.currency) + '</b></div>' : '') + '</div>' +
        '<div>' + ck('Liberar disponibilidad', x.deps.length ? x.deps.map(z => esc(z.x.d.id) + ' −' + z.pax + ' cupo(s)').join(' · ') : 'Sin cupos por salida retenidos') + ck('Cancelar servicios', x.svcs.length + ' servicio(s) pasan a «cancelado»') + ck('Anular vouchers', x.vou.length ? x.vou.map(v => esc(v.id)).join(', ') : 'Sin vouchers vigentes') + ck('Finanzas', 'CxC abiertas se cancelan' + (x.refund ? '; nota de crédito y reembolso' : '') + (x.owed ? '; CxC de penalidad' : '')) + ck('Notificar y auditar', 'Cliente, operaciones, finanzas y solicitante · Regla transversal 8') + '</div></div>' +
        '<div style="margin-top:12px">' + UI.form([{ id: 'cn-why', label: 'Motivo de la cancelación', type: 'select', col: 6, options: ['Solicitud del cliente', 'Cambio de itinerario del cliente', 'Fuerza mayor / clima', 'Falta de pago', 'Proveedor sin disponibilidad', 'Otro'] }, { id: 'cn-det', label: 'Detalle (obligatorio)', col: 6, required: true, value: 'Solicitado por ' + who(cr.by) + ' — ' + (cr.reason || '') }]) + '</div>',
      actions: [{ label: 'Volver' }, { label: 'Aprobar y cancelar reserva', cls: 'danger', icon: 'x', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const reason = f['cn-why'] + ': ' + f['cn-det'];
        applyCancel(r, reason, x); close(a, 'aprobada', reason);
        UI.toast('Reserva cancelada. Penalidad ' + money(x.pen, r.currency) + ' · reembolso ' + money(x.refund, r.currency) + '.', 'warn'); App.render();
      } }] });
  }

  /* ---- Nueva solicitud genérica ---- */
  function newRequest() {
    if (!can('approvals.view')) return deny('Requiere approvals.view.');
    const resOpts = DB.reservations.filter(r => Scope.canSee(r) && r.status !== 'cancelada').map(r => [r.id, r.id + ' · ' + r.title]);
    const agOpts = DB.b2bAgencies.map(a => [a.id, a.name + ' · usa ' + money(a.creditUsed, a.currency, 0) + ' de ' + money(a.creditLimit, a.currency, 0)]);
    UI.modal({ title: 'Nueva solicitud de aprobación', size: 'lg', sub: 'Excepciones que no nacen en un módulo: se enrutan según la matriz de reglas',
      body: UI.form([
        { id: 'nr-type', label: 'Tipo', type: 'select', col: 6, options: Object.keys(TYPES).filter(k => TYPES[k].generic).map(k => [k, TYPES[k].label]) },
        { id: 'nr-cur', label: 'Moneda', type: 'select', col: 2, options: ['PEN', 'USD'] },
        { id: 'nr-amt', label: 'Monto / impacto', type: 'number', step: '0.01', min: 0, required: true, col: 4 },
        { id: 'nr-title', label: 'Título', required: true, col: 12, placeholder: 'Ej.: Reembolso parcial por servicio no prestado' },
        { id: 'nr-ag', label: 'Agencia B2B (crédito)', type: 'select', col: 6, placeholder: '—', options: agOpts },
        { id: 'nr-res', label: 'Reserva relacionada', type: 'select', col: 6, placeholder: 'Ninguna', options: resOpts },
        { id: 'nr-det', label: 'Justificación', type: 'textarea', rows: 4, required: true, col: 12 },
        { type: 'html', col: 12, html: '<div id="nr-route"></div>' }
      ]),
      onOpen: (m) => {
        const route = () => { const f = UI.formData(m); const tmp = { type: f['nr-type'], amount: Number(f['nr-amt']) || 0, currency: f['nr-cur'] }; const ls = levelsFor(tmp); m.querySelector('#nr-route').innerHTML = UI.alert('info', '<b>Ruta de aprobación:</b> ' + ls.map(r => 'Nivel ' + r.level + ' · ' + esc(r.perm) + ' (' + holders(r.perm).filter(u => u.id !== me()).map(u => esc(u.name.split(' ')[0])).join(', ') + ')').join(' → ') + ' · SLA ' + ls[0].sla + ' h.'); m.querySelector('#nr-ag').closest('.field').style.display = f['nr-type'] === 'credit_b2b' ? '' : 'none'; };
        m.querySelectorAll('select,input').forEach(x => x.addEventListener('change', route)); m.querySelector('#nr-amt').addEventListener('input', route); route();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Enviar solicitud', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        if (!(Number(f['nr-amt']) >= 0)) return deny('Monto inválido.');
        if (f['nr-type'] === 'credit_b2b' && !f['nr-ag']) return deny('Seleccione la agencia B2B.');
        const ref = f['nr-type'] === 'credit_b2b' ? { kind: 'agency', id: f['nr-ag'] } : f['nr-res'] ? { kind: 'reservation', id: f['nr-res'] } : null;
        const a = { id: nextAprId(), type: f['nr-type'], origin: false, title: f['nr-title'], requester: me(), createdAt: nowStr(), amount: r2(Number(f['nr-amt'])), currency: f['nr-cur'], ref, detail: f['nr-det'], status: 'pendiente', level: 1, steps: [], delegatedTo: null, info: [], log: [{ ts: nowStr(), user: me(), action: 'Solicitud creada', note: f['nr-det'] }] };
        a.dueAt = addMin(a.createdAt, (ruleOf(a).sla || 24) * 60);
        DB.approvals.push(a);
        Audit.log('Aprobación', a.id, 'crear', '', TYPES[a.type].label + ' · ' + money(a.amount, a.currency));
        approversOf(a).forEach(u => Notify.push('aprobacion.solicitada', 'Portal', u, 'Aprobar ' + a.id + ' — ' + a.title + ' (' + Auth.user.name + ')'));
        Store.save(); UI.toast('Solicitud ' + a.id + ' enviada. Se notificó a los aprobadores del nivel 1.'); apTab = 'sent'; App.go('#/aprobaciones');
      } }] });
  }

  /* =====================================================================================
     VISTA: BANDEJA DE APROBACIONES
     ===================================================================================== */
  let apTab = null;
  const typeCell = (a) => { const T = TYPES[a.type]; return '<div class="cb-ty"><div class="ico-box ' + (T.tone === 'bad' ? 'bad' : T.tone === 'warn' || T.tone === 'sun' ? 'sun' : T.tone === 'violet' ? 'violet' : T.tone === 'info' ? 'info' : '') + '">' + I(T.icon) + '</div><div style="min-width:0"><div class="cell-main">' + esc(a.title) + '</div><div class="cell-sub"><span class="mono">' + esc(a.id) + '</span> · ' + esc(T.short) + (a.origin ? '' : ' · genérica') + '</div></div></div>'; };
  const levelTxt = (a) => { const n = levelsFor(a).length; return n > 1 ? 'N' + Math.min(a.level, n) + ' de ' + n : 'N1'; };

  function renderApprovals(el, params) {
    css(); seedApprovals(); sync();
    const vis = DB.approvals.filter(visible);
    const todo = vis.filter(a => isPend(a) && canAct(a));
    const sent = DB.approvals.filter(a => a.requester === me());
    const hist = vis.filter(a => !isPend(a));
    const overdue = vis.filter(a => isPend(a) && slaOf(a).rank === 0);
    const resolved = hist.filter(a => a.decidedAt && daysFromToday(a.decidedAt.slice(0, 10)) >= -7);
    const avg = resolved.length ? sum(resolved, a => Math.max(0, minsBetween(a.createdAt, a.decidedAt))) / resolved.length : 0;
    const roleNote = Auth.role === 'sales' ? 'Rol Ventas: aquí ve el estado de las solicitudes que envió (aprobaciones de cotización, anulaciones, excepciones). La aprobación corresponde a Gerencia.'
      : Auth.role === 'operations' ? 'Rol Operaciones: aprueba solicitudes de tarifa de proveedores (catalog.providers.manage) y sigue las CxP que validó para Finanzas.'
      : Auth.role === 'finance' ? 'Rol Finanzas: aprueba reversiones de pago, cuentas por pagar, comisiones y el nivel financiero de excepciones de crédito/reembolso.'
      : Auth.role === 'manager' ? 'Gerencia: ve todas las solicitudes del tenant y aprueba las comerciales y operativas según la matriz de reglas.' : 'Administración: ve todas las solicitudes y configura la matriz de reglas de aprobación.';
    el.innerHTML = '<div class="page cb-page">' + UI.pageHeader({ title: 'Bandeja de aprobaciones' + (todo.length ? ' <span class="tag">' + todo.length + ' para mí</span>' : ''), subtitle: 'Workflow unificado de excepciones: cada solicitud se enruta por la matriz de reglas, con SLA, delegación y auditoría.', crumbs: [['Inicio', '#/dashboard'], ['General'], ['Aprobaciones']],
      actions: '<span class="cb-scope" title="Alcance de datos del rol">' + I(isSup() ? 'users' : 'user') + (isSup() ? 'Todo el tenant' : 'Según mi rol') + '</span><button class="btn primary" data-x="new">' + I('plus') + 'Nueva solicitud</button>' }) +
      '<div class="grid g4">' +
      UI.kpi({ label: 'Pendientes para mí', value: todo.length, sub: todo.filter(a => slaOf(a).rank === 0).length + ' con SLA vencido', tone: 'accent', icon: 'checkCircle' }) +
      UI.kpi({ label: 'SLA vencido (visibles)', value: overdue.length, sub: 'de ' + vis.filter(isPend).length + ' en curso', tone: overdue.length ? 'bad' : 'ok', icon: 'clock' }) +
      UI.kpi({ label: 'Enviadas por mí en curso', value: sent.filter(isPend).length, sub: sent.filter(a => a.status === 'info').length + ' esperando mi respuesta', tone: 'info', icon: 'send' }) +
      UI.kpi({ label: 'Resueltas (7 días)', value: resolved.length, sub: 'tiempo medio ' + (resolved.length ? dur(avg) : '—'), tone: 'violet', icon: 'history' }) + '</div>' +
      UI.alert('info', roleNote) +
      (sent.some(a => a.status === 'info' && a.info.some(x => !x.a)) ? UI.alert('warn', '<b>Tiene consultas por responder:</b> ' + sent.filter(a => a.status === 'info').map(a => '<a href="#/aprobaciones/' + a.id + '">' + esc(a.id) + '</a>').join(', ') + '. El SLA está en pausa hasta su respuesta.') : '') +
      '<div id="ap-tabs"></div></div>';
    el.querySelector('[data-x="new"]').onclick = newRequest;
    const tabs = [
      { id: 'todo', label: 'Pendientes para mí', count: todo.length, render: b => apTable(b, () => DB.approvals.filter(a => visible(a) && isPend(a) && canAct(a)), { empty: 'No tiene solicitudes pendientes de su aprobación.' }) },
      { id: 'sent', label: 'Enviadas por mí', count: sent.length, render: b => apTable(b, () => DB.approvals.filter(a => a.requester === me()), { status: true, empty: 'No ha enviado solicitudes de aprobación.' }) },
      { id: 'all', label: isSup() ? 'Todas' : 'Todas (según rol)', count: vis.filter(isPend).length, render: b => apTable(b, () => DB.approvals.filter(visible), { status: true, defStatus: 'pend' }) },
      { id: 'hist', label: 'Historial', count: hist.length, render: b => apHistory(b) },
      { id: 'rules', label: 'Reglas de aprobación', render: b => rulesView(b) }
    ];
    if (!apTab) apTab = todo.length ? 'todo' : 'sent';
    UI.tabs(el.querySelector('#ap-tabs'), tabs, apTab, { onChange: (id) => { apTab = id; } });
    if (params && params[0]) {
      const a = DB.approvals.find(x => x.id === params[0]);
      if (!a) UI.toast('La solicitud ' + esc(params[0]) + ' no existe.', 'bad');
      else if (!visible(a)) UI.toast('La solicitud ' + esc(a.id) + ' no está dentro del alcance de su rol.', 'bad');
      else openDetail(a);
    }
  }
  function apTable(b, rows, opt) {
    opt = opt || {};
    const typeOpts = Object.keys(TYPES).map(k => [k, TYPES[k].short]);
    const filters = [{ label: 'Tipo', options: typeOpts, key: 'type' }, { label: 'SLA', options: [['0', 'Vencido'], ['1', 'Por vencer'], ['2', 'En plazo'], ['5', 'En pausa']], match: (a, v) => String(slaOf(a).rank) === v }];
    if (opt.status) filters.push({ label: 'Estado', options: [['pend', 'En curso'], ['pendiente', 'Pendiente'], ['info', 'Esperando información'], ['aprobada', 'Aprobada'], ['rechazada', 'Rechazada'], ['anulada', 'Anulada']], match: (a, v) => v === 'pend' ? isPend(a) : a.status === v });
    b.innerHTML = '<div class="cb-tbl"></div>';
    const dt = UI.dataTable(b.firstChild, {
      rows, pageSize: 10, exportName: 'aprobaciones', empty: opt.empty, searchPlaceholder: 'Buscar por ID, título, solicitante…',
      search: (a) => [a.id, a.title, who(a.requester), TYPES[a.type].label, a.detail].join(' '),
      filters, defaultSort: 'sla', defaultDir: 1,
      columns: [
        { key: 'title', label: 'Solicitud', render: typeCell, csv: a => a.id + ' ' + a.title },
        { key: 'requester', label: 'Solicitante', render: a => Q.user(a.requester) ? '<span class="row" style="gap:7px;flex-wrap:nowrap">' + UI.avatar(Q.user(a.requester)) + '<span class="small nowrap">' + esc(Q.user(a.requester).name.split(' ').slice(0, 2).join(' ')) + '</span></span>' : '<span class="small">' + esc(who(a.requester)) + '</span>', sortVal: a => who(a.requester), csv: a => who(a.requester) },
        { key: 'createdAt', label: 'Fecha', render: a => '<span class="nowrap small">' + dateShort(a.createdAt) + ' · ' + esc(String(a.createdAt).slice(11, 16)) + '</span>' },
        { key: 'amount', label: 'Monto / impacto', align: 'num', sortVal: a => amtPEN(a), render: a => '<b class="nowrap">' + money(a.amount, a.currency) + '</b><div class="cell-sub" style="white-space:normal;max-width:220px;margin-left:auto">' + esc(impactLine(a)) + '</div>', csv: a => a.currency + ' ' + a.amount },
        { key: 'sla', label: 'SLA', sortVal: a => slaOf(a).rank * 1e7 + (a.dueAt ? minsBetween(nowStr(), a.dueAt) : 0), render: slaChip, csv: a => slaOf(a).txt },
        { key: 'status', label: 'Estado', render: a => stBadge(a) + '<div class="cell-sub nowrap">' + levelTxt(a) + (a.delegatedTo ? ' · delegada a ' + esc(who(a.delegatedTo).split(' ')[0]) : '') + '</div>', csv: a => a.status },
        { key: '', label: '', sort: false, csv: () => '', render: a => '<button class="btn xs' + (isPend(a) && canAct(a) ? ' primary' : '') + '" data-open="' + a.id + '">' + (isPend(a) && canAct(a) ? 'Revisar' : 'Ver') + '</button>' }
      ],
      onRow: a => App.go('#/aprobaciones/' + a.id),
      afterDraw: (c) => c.querySelectorAll('[data-open]').forEach(x => x.onclick = () => App.go('#/aprobaciones/' + x.dataset.open))
    });
    if (opt.defStatus) { const sel = b.querySelector('select[data-f="2"]'); if (sel) { sel.value = opt.defStatus; dt.state.f[2] = opt.defStatus; dt.redraw(); } }
  }
  function apHistory(b) {
    b.innerHTML = '<div id="ah-t"></div><div style="margin-top:14px" id="ah-l"></div>';
    apTable(b.querySelector('#ah-t'), () => DB.approvals.filter(a => visible(a) && !isPend(a)), { status: true, empty: 'Sin solicitudes resueltas.' });
    const ev = DB.audit.filter(x => x.entity === 'Aprobación' && (isSup() || x.user === me() || (DB.approvals.find(a => a.id === x.entityId) && visible(DB.approvals.find(a => a.id === x.entityId))))).slice(0, 12);
    b.querySelector('#ah-l').innerHTML = UI.card('Últimas decisiones auditadas', ev.length ? UI.timeline(ev.map(x => ({ icon: /rechaz/.test(x.action) ? 'x' : /deleg/.test(x.action) ? 'users' : /inform/.test(x.action) ? 'msg' : 'checkCircle', title: '<a href="#/aprobaciones/' + esc(x.entityId) + '" class="mono">' + esc(x.entityId) + '</a> · ' + esc(x.action.replace(/_/g, ' ')), meta: esc(Q.userName(x.user)) + ' · ' + datetime(x.ts) + ' · ' + esc(x.corr), desc: esc(x.after) }))) : UI.empty('Aún no hay decisiones registradas en esta sesión de demostración.', 'history'), { sub: 'Registro inmutable (audit_logs) · PROC-063' });
  }

  /* ---------------- Detalle ---------------- */
  function originDetail(a) {
    const R = a.ref || {};
    if (a.type === 'quote') {
      const q = Q.quote(R.id); const v = q && q.versions.find(x => x.v === R.v); if (!v) return UI.empty('Versión no disponible');
      const t = Pricing.quoteTotals(v); const seeM = PROFIT() || q.owner === me();
      return UI.dl([['Cliente', lnk('crm/clientes', q.clientId, esc(Q.clientName(q.clientId)))], ['Cotización', lnk('cotizaciones', q.id, esc(q.id), 'mono') + ' · v' + v.v + ' · ' + UI.badge(q.status)], ['Viaje', date(q.travelFrom) + ' → ' + date(q.travelTo)], ['Total', '<b>' + money(t.total, q.currency) + '</b> (neto ' + money(t.net, q.currency) + ')'], ['Descuento', fmtN(v.discountPct || 0, 1) + '%' + (overCap(v) ? ' <span class="bad">· supera tope ' + MAX_DISC + '%</span>' : '')], seeM ? ['Margen', '<b class="' + (t.marginPct < 15 ? 'bad' : '') + '">' + fmtN(t.marginPct, 1) + '%</b> · utilidad ' + money(t.profit, q.currency)] : null, ['Control', '<span class="warn">' + esc(needsInternal(v, t).join(' y ')) + '</span>']]) +
        '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Producto</th><th class="num">Pax</th><th class="num">Precio unit.</th>' + (seeM ? '<th class="num">Costo unit.</th>' : '') + '<th class="num">Subtotal</th></tr></thead><tbody>' + t.lines.map(l => '<tr><td>' + esc(Q.productName(l.productId)) + '<div class="cell-sub">' + dateShort(l.date) + ' · ' + esc(l.segment || 'Adulto') + '</div></td><td class="num">' + l.pax + '</td><td class="num">' + money(l.unitPrice, q.currency) + '</td>' + (seeM ? '<td class="num">' + money(l.unitCost, q.currency) + '</td>' : '') + '<td class="num">' + money(l.saleTotal, q.currency) + '</td></tr>').join('') + '</tbody></table></div>';
    }
    if (a.type === 'cancel') {
      const r = Q.reservation(R.id); if (!r) return UI.empty('Reserva no disponible'); const x = cancelCalc(r);
      return UI.dl([['Reserva', lnk('reservas', r.id, esc(r.id), 'mono') + ' · ' + esc(r.title) + ' · ' + UI.badge(r.status)], ['Cliente', esc(Q.clientName(r.clientId))], ['Viaje', date(r.travelFrom) + ' → ' + date(r.travelTo)], ['Total / pagado', money(r.total, r.currency) + ' / ' + money(x.paid, r.currency)], ['Penalidad estimada', '<b class="warn">' + money(x.pen, r.currency) + '</b> según política vigente'], ['Reembolso estimado', money(x.refund, r.currency)], ['Servicios a cancelar', x.svcs.length + ' · vouchers vigentes ' + x.vou.length]]);
    }
    if (a.type === 'reversal') {
      const p = DB.payments.find(x => x.id === R.id); if (!p) return UI.empty('Pago no disponible'); const c = DB.receivables.find(x => x.id === p.receivableId);
      return UI.dl([['Pago', lnk('finanzas/pagos', p.id, esc(p.id), 'mono') + ' · ' + UI.badge(p.status)], ['Método / referencia', esc(p.method) + ' · ' + esc(p.ref)], ['Monto', '<b>' + money(p.amount, p.currency) + '</b> · ' + date(p.date)], ['Reserva', lnk('reservas', p.resId, esc(p.resId), 'mono')], c ? ['CxC afectada', esc(c.id) + ' · saldo ' + money(bal(c), c.currency) + ' → ' + money(bal(c) + (p.status === 'aplicado' ? p.amount : 0), c.currency)] : null]);
    }
    if (a.type === 'payable') {
      const p = DB.payables.find(x => x.id === R.id); if (!p) return UI.empty('CxP no disponible'); const prv = Q.provider(p.providerId) || {};
      return UI.dl([['CxP', lnk('finanzas/proveedores', p.id, esc(p.id), 'mono') + ' · ' + UI.badge(cxpStatus(p))], ['Proveedor', esc(prv.name || '') + ' · ' + esc(prv.paymentTerms || '') + (prv.status !== 'activo' ? ' <span class="bad">· ' + esc(prv.status) + '</span>' : '')], ['Concepto', esc(p.concept)], ['Monto', '<b>' + money(p.amount, p.currency) + '</b> · vence ' + date(p.due)], ['Reserva', p.resId ? lnk('reservas', p.resId, esc(p.resId), 'mono') : '—'], p.observation ? ['Observación', '<span class="warn">' + esc(p.observation) + '</span>'] : null]);
    }
    if (a.type === 'commission') {
      const c = DB.commissions.find(x => x.id === R.id); if (!c) return UI.empty('Comisión no disponible');
      return UI.dl([['Comisión', lnk('finanzas/comisiones', c.id, esc(c.id), 'mono') + ' · ' + UI.badge(c.status)], ['Beneficiario', esc(c.kind === 'Agencia B2B' ? ((Q.agency(c.beneficiary) || {}).name || c.beneficiary) : Q.userName(c.beneficiary)) + ' · ' + esc(c.kind)], ['Cálculo', fmtN(c.pct, 1) + ' % × ' + money(c.base, c.currency) + ' = <b>' + money(c.amount, c.currency) + '</b>'], ['Reserva', lnk('reservas', c.resId, esc(c.resId), 'mono')], c.observation ? ['Observación', '<span class="warn">' + esc(c.observation) + '</span>'] : null]);
    }
    if (a.type === 'provider_rate') {
      const r = (DB.providerRequests || []).find(x => x.id === R.id); if (!r) return UI.empty('Solicitud no disponible'); const s = Q.service(r.serviceId) || {};
      const prods = DB.products.filter(p => (p.components || []).some(c => c.serviceId === r.serviceId));
      return UI.dl([['Proveedor', lnk('catalogo/proveedores', r.providerId, esc(Q.providerName(r.providerId)))], ['Servicio', lnk('catalogo/servicios', r.serviceId, esc(r.serviceId), 'mono') + ' · ' + esc(s.name || '')], ['Costo actual → propuesto', money(r.current, r.currency) + ' → <b>' + money(r.proposed, r.currency) + '</b> (' + (r.proposed >= r.current ? '+' : '') + fmtN((r.proposed - r.current) / r.current * 100, 1) + ' %)'], ['Vigente desde', date(r.from) + ' · ' + (daysFromToday(r.from) >= 30 ? '<span class="ok">cumple 30 días de anticipación</span>' : '<span class="bad">menos de 30 días</span>')], ['Productos afectados', prods.length ? prods.map(p => esc(p.name)).join(', ') : 'Ninguno usa este servicio como componente'], ['Sustento', esc(r.reason)]]);
    }
    if (a.type === 'credit_b2b') {
      const ag = Q.agency(R.id); if (!ag) return UI.empty('Agencia no disponible');
      return UI.dl([['Agencia', lnk('canales/b2b', '', esc(ag.name)) + ' · ' + UI.badge(ag.status)], ['Crédito usado / línea', money(ag.creditUsed, ag.currency) + ' / ' + money(ag.creditLimit, ag.currency)], ['Línea tras aprobar', '<b>' + money(ag.creditLimit + (isPend(a) ? toPEN(a.amount, a.currency) : 0), ag.currency) + '</b>'], ['Lista de precios', esc(ag.priceList) + ' · comisión ' + ag.commissionPct + ' %']]);
    }
    const res = R.kind === 'reservation' ? Q.reservation(R.id) : null;
    return res ? UI.dl([['Reserva', lnk('reservas', res.id, esc(res.id), 'mono') + ' · ' + esc(res.title) + ' · ' + UI.badge(res.status)], ['Cliente', esc(Q.clientName(res.clientId))], ['Total / pagado', money(res.total, res.currency) + ' / ' + money(Q.resPaid(res.id), res.currency)]]) : R.kind === 'quote' ? UI.dl([['Cotización', lnk('cotizaciones', R.id, esc(R.id), 'mono')], ['Cliente', esc(Q.clientName((Q.quote(R.id) || {}).clientId))]]) : '<div class="small muted">Sin registro vinculado.</div>';
  }
  function openDetail(a) {
    const T = TYPES[a.type]; const ls = levelsFor(a); const r = ruleOf(a);
    const block = isPend(a) ? blockReason(a) : ''; const act = isPend(a) && !block; const ab = act ? approveBlock(a) : '';
    const steps = ['Solicitud'].concat(ls.map(x => 'Nivel ' + x.level + ' · ' + (PERM_LABEL[x.perm] || x.perm))).concat(['Efecto en origen']);
    const cur = a.status === 'aprobada' ? steps.length : isPend(a) ? a.level : a.steps.length + 1;
    const failed = a.status === 'rechazada' || a.status === 'anulada' ? Math.min(a.level, ls.length) : undefined;
    const lastQ = (a.info || []).slice().reverse().find(x => !x.a);
    const body =
      UI.flow(steps, cur, failed) +
      (a.status === 'info' && lastQ ? UI.alert('warn', '<b>Esperando información de ' + esc(who(a.requester)) + '.</b> ' + esc(who(lastQ.by)) + ' preguntó: «' + esc(lastQ.q) + '» (' + datetime(lastQ.ts) + '). SLA en pausa.') : '') +
      (isPend(a) && block && a.requester !== me() ? UI.alert('info', esc(block)) : '') +
      (ab ? UI.alert('warn', esc(ab) + ' Puede rechazar, pedir información o delegar.') : '') +
      (a.status === 'rechazada' ? UI.alert('bad', '<b>Rechazada</b> por ' + esc(who(a.decidedBy)) + ' el ' + datetime(a.decidedAt) + ': ' + esc(a.decisionNote || '')) : '') +
      (a.status === 'aprobada' ? UI.alert('ok', '<b>Aprobada</b> por ' + esc(who(a.decidedBy)) + ' el ' + datetime(a.decidedAt) + (a.closedInOrigin ? ' (resuelta en ' + esc(T.origin) + ')' : '') + (a.decisionNote ? ': ' + esc(a.decisionNote) : '')) : '') +
      (a.status === 'anulada' ? UI.alert('info', '<b>Anulada</b>' + (a.decisionNote ? ': ' + esc(a.decisionNote) : '')) : '') +
      '<div class="grid g2" style="margin-top:14px;align-items:start"><div>' + UI.dl([['Tipo', esc(T.label)], ['Origen', esc(T.origin) + ' · ' + recLink(a)], ['Solicitante', chip(a.requester)], ['Fecha', datetime(a.createdAt)], ['Monto / impacto', '<b>' + money(a.amount, a.currency) + '</b>' + (a.currency === 'USD' ? ' <span class="xs faint">(' + money(amtPEN(a), 'PEN', 0) + ')</span>' : '') + '<div class="xs muted">' + esc(impactLine(a)) + '</div>'], ['SLA', slaChip(a) + (a.dueAt && isPend(a) ? '<div class="xs faint">Vence ' + datetime(a.dueAt) + ' · ' + (r.sla || 24) + ' h por nivel</div>' : '')]]) + '</div><div>' +
      UI.dl([['Regla que la originó', esc(T.rule)], ['Aprobador requerido', isPend(a) ? 'Nivel ' + a.level + ' de ' + ls.length + ' · <span class="mono">' + esc(r.perm) + '</span><div class="xs faint">' + esc(holders(r.perm).filter(u => u.id !== a.requester && !a.steps.some(s => s.by === u.id)).map(u => u.name).join(', ') || 'Sin usuarios con permiso') + '</div>' : ls.map(x => 'N' + x.level + ' ' + esc(x.perm)).join(' → ')], ['Delegada a', a.delegatedTo ? chip(a.delegatedTo) : '—'], ['Aprobaciones', a.steps.length ? a.steps.map(s => 'N' + s.level + ' · ' + esc(who(s.by)) + ' · ' + dateShort(s.ts) + ' ' + esc(String(s.ts).slice(11))).join('<br>') : '—']]) + '</div></div>' +
      '<div class="section-title" style="margin-top:16px">Justificación del solicitante</div><div class="cb-box small">' + esc(a.detail || '—') + '</div>' +
      '<div class="section-title" style="margin-top:16px">Detalle del registro</div>' + originDetail(a) +
      (a.info && a.info.length ? '<div class="section-title" style="margin-top:16px">Consultas</div>' + a.info.map(x => '<div class="cb-box small"><b>' + esc(who(x.by)) + '</b> · ' + datetime(x.ts) + '<div>' + esc(x.q) + '</div>' + (x.a ? '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--line-2)"><b>' + esc(who(x.answeredBy || a.requester)) + '</b> · ' + datetime(x.answeredAt) + '<div>' + esc(x.a) + '</div></div>' : '<div class="xs warn" style="margin-top:4px">Sin respuesta</div>') + '</div>').join('') : '') +
      (isPend(a) ? '<div class="section-title" style="margin-top:16px">Efecto al completar la aprobación</div><div class="small muted">' + esc(EFFECT_TXT[a.type]) + '</div>' : '') +
      '<div class="section-title" style="margin-top:16px">Trazabilidad</div>' + UI.timeline((a.log || []).slice().reverse().map(l => ({ icon: /Rechaz/.test(l.action) ? 'x' : /Deleg/.test(l.action) ? 'users' : /informaci|consulta/i.test(l.action) ? 'msg' : /Aprob|aprobada/.test(l.action) ? 'checkCircle' : 'send', title: esc(l.action), meta: esc(who(l.user)) + ' · ' + datetime(l.ts), desc: esc(l.note || '') })));
    const actions = [];
    if (act) {
      actions.push({ label: 'Delegar', icon: 'users', onClick: () => { doDelegate(a); return false; } });
      actions.push({ label: 'Pedir información', icon: 'msg', onClick: () => { doInfo(a); return false; } });
      actions.push({ label: 'Rechazar', cls: 'danger', icon: 'x', onClick: () => { doReject(a); return false; } });
      if (!ab) actions.push({ label: levelsFor(a).length > a.level ? 'Aprobar nivel ' + a.level : 'Aprobar', cls: 'primary', icon: 'checkCircle', onClick: () => { doApprove(a); return false; } });
    }
    if (a.status === 'info' && lastQ && (a.requester === me() || isSup())) actions.push({ label: 'Responder consulta', cls: 'primary', icon: 'send', onClick: () => { doAnswer(a); return false; } });
    if (isPend(a) && a.requester === me() && ['quote', 'cancel', 'reversal', 'credit_b2b', 'refund', 'other'].includes(a.type)) actions.push({ label: 'Retirar solicitud', icon: 'x', onClick: () => { doWithdraw(a); return false; } });
    if (a.status === 'rechazada' && ['payable', 'commission'].includes(a.type)) { const rec = a.type === 'payable' ? DB.payables.find(x => x.id === a.ref.id) : DB.commissions.find(x => x.id === a.ref.id); if (rec && rec.approvalRejected && (a.requester === me() || can(a.type === 'payable' ? 'finance.payables' : 'finance.commissions'))) actions.push({ label: 'Reenviar a aprobación', icon: 'refresh', onClick: () => { doResubmit(a); return false; } }); }
    UI.drawer({ title: esc(a.id) + ' · ' + esc(T.short), sub: esc(a.title) + ' · ' + stBadge(a), wide: true, body, actions });
  }

  /* ---------------- Matriz de reglas ---------------- */
  function rulesView(b) {
    const edit = can('admin.settings.manage');
    const rows = (DB.approvalRules || []).slice().sort((x, y) => Object.keys(TYPES).indexOf(x.type) - Object.keys(TYPES).indexOf(y.type) || x.level - y.level || x.min - y.min);
    b.innerHTML = (edit ? UI.alert('info', 'Matriz de enrutamiento: por tipo de solicitud, qué permiso aprueba cada nivel y desde qué monto (equivalente en S/) aplica el nivel 2. El <b>nivel 1 de los tipos de origen conserva el permiso del módulo</b> (no editable) para no romper la autorización del backend (Regla 17). Los cambios aplican a solicitudes nuevas y a las pendientes al recalcular su ruta.') : UI.alert('info', 'Consulta de la matriz de reglas. Solo el Tenant Admin (<span class="mono">admin.settings.manage</span>) puede modificarla.')) +
      UI.card('Reglas de aprobación (' + rows.length + ')', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tipo de solicitud</th><th>Nivel</th><th>Permiso requerido</th><th>Aprobadores actuales</th><th class="num">Monto desde (S/)</th><th class="num">SLA</th><th>Autoaprobación</th><th>Estado</th>' + (edit ? '<th></th>' : '') + '</tr></thead><tbody>' +
        rows.map(r => '<tr><td><b class="small">' + esc(TYPES[r.type].label) + '</b><div class="cell-sub">' + esc(TYPES[r.type].origin) + '</div></td><td>N' + r.level + '</td><td><span class="mono small">' + esc(r.perm) + '</span><div class="cell-sub">' + esc(PERM_LABEL[r.perm] || '') + '</div></td><td class="small">' + (holders(r.perm).map(u => esc(u.name.split(' ')[0]) + ' <span class="faint">(' + esc(Q.roleName(u.role)) + ')</span>').join(', ') || '<span class="bad">Nadie</span>') + '</td><td class="num">' + fmtN(r.min || 0, 0) + '</td><td class="num nowrap">' + r.sla + ' h</td><td>' + (r.noSelf !== false ? UI.badge('bloqueada', 'Prohibida') : UI.badge('advertencia', 'Permitida')) + '</td><td>' + UI.badge(r.active ? 'activa' : 'inactiva') + '</td>' + (edit ? '<td class="nowrap right"><button class="btn xs" data-er="' + r.id + '">' + I('edit') + 'Editar</button>' + (r.level > 1 ? ' <button class="btn xs ghost" data-dr="' + r.id + '" title="Eliminar regla">' + I('trash') + '</button>' : '') + '</td>' : '') + '</tr>').join('') + '</tbody></table></div>',
        { tight: true, sub: 'collab_approval_rules · por tenant', actions: edit ? '<button class="btn sm primary" data-nr>' + I('plus') + 'Nueva regla</button><button class="btn sm" data-rr>' + I('refresh') + 'Restaurar valores por defecto</button>' : '' });
    if (!edit) return;
    b.querySelectorAll('[data-er]').forEach(x => x.onclick = () => ruleForm(DB.approvalRules.find(r => r.id === x.dataset.er)));
    b.querySelectorAll('[data-dr]').forEach(x => x.onclick = () => { const r = DB.approvalRules.find(y => y.id === x.dataset.dr); UI.confirm({ title: 'Eliminar regla ' + esc(r.id), message: 'Las solicitudes de «' + esc(TYPES[r.type].label) + '» dejarán de requerir el nivel ' + r.level + '.', confirmLabel: 'Eliminar', danger: true, onConfirm: () => { DB.approvalRules = DB.approvalRules.filter(y => y.id !== r.id); Audit.log('Regla de aprobación', r.id, 'eliminar', r.type + ' N' + r.level + ' ' + r.perm, ''); Store.save(); UI.toast('Regla eliminada.'); App.render(); } }); });
    b.querySelector('[data-nr]').onclick = () => ruleForm(null);
    b.querySelector('[data-rr]').onclick = () => UI.confirm({ title: 'Restaurar matriz por defecto', message: 'Se reemplazarán las reglas actuales por la matriz de referencia.', confirmLabel: 'Restaurar', onConfirm: () => { DB.approvalRules = clone(DEFAULT_RULES); Audit.log('Regla de aprobación', 'matriz', 'restaurar', '', DEFAULT_RULES.length + ' reglas'); Store.save(); UI.toast('Matriz restaurada.'); App.render(); } });
  }
  function ruleForm(r) {
    if (!can('admin.settings.manage')) return deny('Requiere admin.settings.manage.');
    const isNew = !r; const lock = r && r.level === 1 && !TYPES[r.type].generic;
    UI.modal({ title: isNew ? 'Nueva regla de aprobación' : 'Editar regla ' + esc(r.id), size: 'lg',
      body: (lock ? UI.alert('info', 'Nivel 1 de un tipo de origen: el permiso es el del módulo (' + esc(r.perm) + ') y no puede cambiarse.') : '') + UI.form([
        { id: 'ru-type', label: 'Tipo de solicitud', type: 'select', col: 6, value: r ? r.type : 'refund', options: Object.keys(TYPES).map(k => [k, TYPES[k].label]), disabled: !isNew },
        { id: 'ru-level', label: 'Nivel', type: 'select', col: 2, value: r ? r.level : 2, options: [[1, 'Nivel 1'], [2, 'Nivel 2']], disabled: !isNew },
        { id: 'ru-perm', label: 'Permiso requerido', type: 'select', col: 4, value: r ? r.perm : 'finance.profitability', options: RULE_PERMS.map(p => [p, p]), disabled: lock },
        { id: 'ru-min', label: 'Aplica desde monto (S/)', type: 'number', min: 0, step: '1', col: 4, value: r ? r.min : 5000, hint: 'Nivel 1 normalmente desde 0.' },
        { id: 'ru-sla', label: 'SLA del nivel (horas)', type: 'number', min: 1, step: '1', col: 4, value: r ? r.sla : 24, required: true },
        { id: 'ru-self', label: 'Prohibir autoaprobación del solicitante', type: 'switch', col: 4, value: r ? r.noSelf !== false : true },
        { id: 'ru-act', label: 'Regla activa', type: 'switch', col: 4, value: r ? r.active : true }
      ]),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar regla', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        const type = isNew ? f['ru-type'] : r.type; const level = isNew ? Number(f['ru-level']) : r.level; const perm = lock ? r.perm : f['ru-perm'];
        const min = Math.max(0, Number(f['ru-min']) || 0); const sla = Math.max(1, Number(f['ru-sla']) || 24);
        if (level === 1 && !TYPES[type].generic && isNew) return deny('El nivel 1 de ' + TYPES[type].label + ' ya existe y usa el permiso del módulo de origen.');
        if (DB.approvalRules.some(x => x !== r && x.type === type && x.level === level && Number(x.min) === min)) return deny('Ya existe una regla para ese tipo, nivel y monto.');
        if (level === 1 && r && r.active && !f['ru-act'] && !DB.approvalRules.some(x => x !== r && x.type === type && x.level === 1 && x.active)) return deny('Cada tipo debe conservar una regla activa de nivel 1.');
        if (!holders(perm).length) return deny('Ningún usuario activo tiene el permiso ' + perm + '.');
        const before = r ? r.type + ' N' + r.level + ' ' + r.perm + ' ≥' + r.min + ' ' + r.sla + 'h' : '';
        const obj = r || { id: nextNum(DB.approvalRules, 'RA-', 2), type, level };
        Object.assign(obj, { perm, min, sla, noSelf: !!f['ru-self'], active: !!f['ru-act'] });
        if (isNew) DB.approvalRules.push(obj);
        Audit.log('Regla de aprobación', obj.id, isNew ? 'crear' : 'editar', before, obj.type + ' N' + obj.level + ' ' + obj.perm + ' ≥' + obj.min + ' ' + obj.sla + 'h' + (obj.active ? '' : ' (inactiva)'));
        Store.save(); UI.toast('Regla ' + obj.id + ' guardada.'); apTab = 'rules'; App.render();
      } }] });
  }

  /* =====================================================================================
     INBOX OMNICANAL
     ===================================================================================== */
  const CH = {
    'WhatsApp': { icon: 'msg', sla: 30, notify: 'WhatsApp', tone: 'ok' },
    'Email': { icon: 'mail', sla: 240, notify: 'Email', tone: 'info' },
    'Web chat': { icon: 'globe', sla: 15, notify: 'Portal', tone: '' },
    'Formulario': { icon: 'file', sla: 120, notify: 'Email', tone: 'violet' },
    'Portal': { icon: 'ticket', sla: 240, notify: 'Portal', tone: 'sun' }
  };
  const EMERGENCY = '+51 984 110 247';
  const cnvStatusBadge = (s) => UI.badge(s === 'abierta' ? 'abierta' : s === 'pendiente' ? 'pendiente' : 'resuelta', s === 'pendiente' ? 'Pendiente cliente' : null);
  function seedInbox() {
    let dirty = false;
    if (!DB.supportTickets) {
      DB.supportTickets = [{ id: 'TCK-0001', clientId: 'CLI-0001', subject: 'Confirmación del hotel en Aguas Calientes', category: 'Documentos', priority: 'media', message: 'Hola Diego, ¿ya confirmó el hotel en Aguas Calientes para el 12/10? Necesito el voucher para pedir el permiso en mi trabajo. Gracias.', resId: 'RES-2026-000344', status: 'abierta', createdAt: '2026-09-28 19:30', owner: 'U04', log: [{ ts: '2026-09-28 19:30', m: 'Ticket creado desde el portal del cliente' }] }];
      dirty = true;
    }
    if (!DB.inboxTemplates) {
      DB.inboxTemplates = [
        { id: 'PL-01', name: 'Saludo y toma del caso', text: 'Hola {{nombre}}, le saluda {{asesor}} de {{empresa}}. Gracias por escribirnos; ya estoy revisando su consulta y le respondo en breve.' },
        { id: 'PL-02', name: 'Envío de cotización', text: 'Estimado(a) {{nombre}}, le comparto la propuesta {{cotizacion}}. Puede revisarla y aprobarla desde su portal. Quedo atento(a) a sus comentarios.' },
        { id: 'PL-03', name: 'Confirmación de reserva', text: '{{nombre}}, su reserva {{reserva}} está confirmada. Recibirá los vouchers por correo 72 h antes del inicio del viaje.' },
        { id: 'PL-04', name: 'Cambio operativo en destino', text: 'Hola {{nombre}}, por una situación en ruta ajustamos su servicio de mañana. Su nuevo horario de recojo es a las 03:00 desde su hotel. Ante cualquier duda: central 24/7 {{telefono_emergencia}}.' },
        { id: 'PL-05', name: 'Datos para cotizar', text: 'Para preparar su propuesta, ¿podría indicarnos fechas tentativas, número de pasajeros (adultos y niños con edades) y categoría de hotel preferida?' },
        { id: 'PL-06', name: 'Cierre del caso', text: 'Gracias, {{nombre}}. Damos por resuelta su consulta; si necesita algo más, responda a este mensaje y reabriremos el caso.' },
        { id: 'PL-07', name: 'WhatsApp aprobada: seguimiento (fuera de 24 h)', wa: true, text: 'Hola {{nombre}}, le escribimos de {{empresa}} para dar seguimiento a su consulta. ¿Desea que continuemos con su solicitud?' }
      ];
      dirty = true;
    }
    if (!DB.conversations) {
      const C = (o) => Object.assign({ unread: 0, tags: [], priority: 'media', leadId: null, clientId: null, resId: null, quoteId: null, firstResponseAt: null, ticketId: null }, o, { slaDueAt: addMin(o.createdAt, CH[o.channel].sla) });
      DB.conversations = [
        C({ id: 'CNV-0101', channel: 'Web chat', contact: { name: 'Emily Johnson', email: 'emily.j@mail.com', phone: '+1 415 555 0192' }, subject: 'Pago pendiente WEB-10433 y upgrade a Vistadome', status: 'abierta', assignee: 'U03', createdAt: '2026-09-29 06:52', clientId: 'CLI-0010', leadId: 'LEAD-0225', resId: 'RES-2026-000349', quoteId: 'COT-2026-00188', priority: 'alta', tags: ['Cotización', 'Inglés', 'E-commerce'], unread: 2,
          messages: [{ from: 'contact', text: 'Hi! I tried to book the Humantay tour for Oct 23 on your website (order WEB-10433) but the payment still shows as pending. Did it go through?', ts: '2026-09-29 06:52', type: 'msg' }, { from: 'contact', text: 'Also, about quote COT-2026-00188: can we upgrade the train to Vistadome? We would like to confirm this week.', ts: '2026-09-29 06:54', type: 'msg' }] }),
        C({ id: 'CNV-0102', channel: 'WhatsApp', contact: { name: 'José Castañeda Ugarte', email: 'jcastaneda@correo.pe', phone: '987 450 221' }, subject: 'Año Nuevo en Cusco — habitaciones conectadas', status: 'pendiente', assignee: 'U04', createdAt: '2026-09-28 20:40', clientId: 'CLI-0005', quoteId: 'COT-2026-00190', priority: 'media', tags: ['VIP', 'Año Nuevo'], firstResponseAt: '2026-09-28 21:02',
          messages: [{ from: 'contact', text: 'Buenas noches, Diego. Revisamos la propuesta v2. ¿El Piedra Viva tiene habitaciones conectadas para los chicos?', ts: '2026-09-28 20:40', type: 'msg' }, { from: 'U04', text: 'Buenas noches, Sr. Castañeda. Sí, el hotel confirma 2 habitaciones deluxe conectadas para el 29/12. Le envío el detalle por aquí.', ts: '2026-09-28 21:02', type: 'msg', attachments: ['piedra_viva_hab_conectadas.pdf'] }, { from: 'U04', text: 'Cliente VIP: si pide descuento, hasta 5 % sin aprobación; por encima pasa por la bandeja de aprobaciones.', ts: '2026-09-28 21:05', type: 'note' }, { from: 'contact', text: 'Perfecto, lo converso con mi esposa y le confirmo mañana.', ts: '2026-09-28 21:15', type: 'msg' }, { from: 'U04', text: 'Quedo atento. ¡Buenas noches!', ts: '2026-09-28 21:17', type: 'msg' }] }),
        C({ id: 'CNV-0103', channel: 'WhatsApp', contact: { name: 'Thomas Keller', email: 't.keller@mail.de', phone: '+49 171 5550102' }, subject: 'Huelga 30/09 — horario de recojo a Machu Picchu', status: 'abierta', assignee: 'U05', createdAt: '2026-09-29 07:40', clientId: 'CLI-0003', resId: 'RES-2026-000347', priority: 'alta', tags: ['En viaje', 'Huelga', 'Alemán'], unread: 2,
          messages: [{ from: 'contact', text: 'Hello Karina, our guide told us about a strike tomorrow. Is our Machu Picchu trip on Sep 30 still on? What time will you pick us up?', ts: '2026-09-29 07:40', type: 'msg' }, { from: 'contact', text: 'Anna feels better today, thank you for sending the doctor.', ts: '2026-09-29 07:42', type: 'msg' }, { from: 'U05', text: 'Ver INC-0085: evaluando salida 03:00 o tren desde Poroy. Confirmar con Renato antes de responder el horario.', ts: '2026-09-29 07:55', type: 'note' }] }),
        C({ id: 'CNV-0104', channel: 'Email', contact: { name: 'Prof. Álvaro Núñez (Colegio San Agustín)', email: 'promocion@csaa.edu.pe', phone: '054 22 1180' }, subject: 'Descuento por pago adelantado — Promoción 5.° secundaria', status: 'abierta', assignee: 'U03', createdAt: '2026-09-28 11:20', clientId: 'CLI-0004', quoteId: 'COT-2026-00189', priority: 'media', tags: ['Grupos', 'Descuento'], firstResponseAt: '2026-09-28 12:05', unread: 1,
          messages: [{ from: 'contact', text: 'Estimada Lucía: la APAFA aprobó el viaje. Si abonamos el 50 % antes del 15/10, ¿podrían otorgarnos un 8 % de descuento? Adjunto el acta.', ts: '2026-09-28 11:20', type: 'msg', attachments: ['acta_apafa_5to_secundaria.pdf'] }, { from: 'U03', text: 'Estimado profesor, gracias por la confirmación. Estoy gestionando la aprobación del 8 % con gerencia y le envío la versión actualizada.', ts: '2026-09-28 12:05', type: 'msg' }, { from: 'contact', text: 'Lucía, ¿tendría novedades hoy? La reunión con los padres es el 02/10.', ts: '2026-09-29 08:30', type: 'msg' }] }),
        C({ id: 'CNV-0105', channel: 'Formulario', contact: { name: 'Andrea Villalobos', email: 'andrea.v@correo.pe', phone: '987 663 021' }, subject: 'Formulario web: viaje familiar a Cusco en noviembre', status: 'abierta', assignee: null, createdAt: '2026-09-29 07:44', leadId: 'LEAD-0231', tags: ['Web', 'Familia'], unread: 1,
          messages: [{ from: 'contact', text: 'Hola, somos 2 adultos y 2 niños (8 y 11 años). Queremos ir a Cusco del 14 al 18 de noviembre con Machu Picchu. ¿Tienen paquetes con hotel céntrico?', ts: '2026-09-29 07:44', type: 'msg' }] }),
        C({ id: 'CNV-0106', channel: 'Web chat', contact: { name: 'Carmen Lozano', email: 'carmen.lozano@correo.pe', phone: '962 118 440' }, subject: 'Chat web: Humantay para 3 personas', status: 'abierta', assignee: null, createdAt: '2026-09-29 09:05', priority: 'baja', tags: ['Web'], unread: 1,
          messages: [{ from: 'contact', text: 'Buen día, ¿cuánto cuesta el tour a la laguna Humantay para 3 personas el sábado 10 de octubre? ¿Incluye desayuno?', ts: '2026-09-29 09:05', type: 'msg' }] }),
        C({ id: 'CNV-0107', channel: 'Email', contact: { name: 'Úrsula Benavides (Minera Cordillera Blanca)', email: 'viajes@mcblanca.com.pe', phone: '01 705 3300' }, subject: 'Factura del anticipo y lista final de participantes', status: 'resuelta', assignee: 'U02', createdAt: '2026-09-26 10:15', clientId: 'CLI-0002', resId: 'RES-2026-000348', tags: ['Corporativo', 'Facturación'], firstResponseAt: '2026-09-26 11:02', resolvedAt: '2026-09-26 16:40', resolvedBy: 'U02',
          messages: [{ from: 'contact', text: 'Renato, buenos días. ¿Nos pueden reenviar la factura del anticipo? Además, confirmo la lista final de 12 participantes con sus dietas.', ts: '2026-09-26 10:15', type: 'msg', attachments: ['lista_participantes_final.xlsx'] }, { from: 'U02', text: 'Buenos días, Úrsula. Adjunto la factura F001-00001482. Registramos las dietas (1 vegetariano, 1 sin gluten) y ya se comunicaron al restaurante.', ts: '2026-09-26 11:02', type: 'msg', attachments: ['F001-00001482.pdf'] }, { from: 'contact', text: 'Recibido, muchas gracias.', ts: '2026-09-26 16:30', type: 'msg' }, { from: 'system', text: 'Conversación resuelta por Renato Salazar Vega', ts: '2026-09-26 16:40', type: 'event' }] })
      ];
      dirty = true;
    }
    syncTickets() && (dirty = true);
    if (dirty) Store.save();
  }
  const nextCnv = () => nextNum(DB.conversations, 'CNV-', 4);
  function syncTickets() {
    let ch = false;
    (DB.supportTickets || []).forEach(t => {
      const c = DB.conversations.find(x => x.ticketId === t.id);
      if (c) { if (t.status === 'resuelta' && c.status !== 'resuelta') { c.status = 'resuelta'; ch = true; } return; }
      const cl = Q.client(t.clientId) || {};
      DB.conversations.unshift({ id: nextCnv(), channel: 'Portal', ticketId: t.id, contact: { name: cl.name || 'Cliente', email: cl.email || '', phone: cl.phone || '' }, subject: t.subject + ' (' + t.id + ')', status: t.status === 'resuelta' ? 'resuelta' : 'abierta', assignee: t.owner || null, messages: [{ from: 'contact', text: t.message, ts: t.createdAt, type: 'msg' }], createdAt: t.createdAt, clientId: t.clientId, leadId: null, resId: t.resId || null, quoteId: null, priority: t.priority || 'media', tags: ['Ticket', t.category].filter(Boolean), slaDueAt: addMin(t.createdAt, CH.Portal.sla), firstResponseAt: null, unread: 1 });
      ch = true;
    });
    return ch;
  }
  const inTravel = (c) => { const r = c.resId && Q.reservation(c.resId); return !!r && r.status !== 'cancelada' && (r.status === 'en_operacion' || (r.travelFrom <= TODAY() && r.travelTo >= TODAY())); };
  function convVisible(c) {
    if (isSup()) return true;
    if (Auth.role === 'sales') return c.assignee === me() || !c.assignee;
    if (Auth.role === 'operations') return c.assignee === me() || inTravel(c);
    return c.assignee === me();
  }
  const scopeTxt = () => isSup() ? 'Todas las conversaciones' : Auth.role === 'sales' ? 'Asignadas a mí + sin asignar' : Auth.role === 'operations' ? 'Asignadas a mí + pasajeros en viaje' : 'Asignadas a mí';
  const lastMsg = (c) => c.messages.filter(m => m.type !== 'event').slice(-1)[0] || c.messages.slice(-1)[0] || {};
  const lastPub = (c) => c.messages.filter(m => m.type === 'msg').slice(-1)[0] || {};
  const lastIn = (c) => c.messages.filter(m => m.from === 'contact').slice(-1)[0];
  const awaiting = (c) => c.status !== 'resuelta' && lastPub(c).from === 'contact';
  function convSla(c) {
    if (c.firstResponseAt) { const ok = c.firstResponseAt <= c.slaDueAt; return { cls: ok ? 'ok' : 'bad', txt: '1.ª respuesta en ' + dur(minsBetween(c.createdAt, c.firstResponseAt)) + (ok ? '' : ' · fuera de SLA') }; }
    if (c.status === 'resuelta') return { cls: 'mute', txt: 'Resuelta sin respuesta' };
    const left = minsBetween(nowStr(), c.slaDueAt);
    if (left < 0) return { cls: 'bad', txt: 'SLA 1.ª respuesta vencido hace ' + dur(-left) };
    return { cls: left <= CH[c.channel].sla * 0.3 ? 'warn' : 'ok', txt: 'Responder en ' + dur(left) };
  }
  const slaSpan = (s) => '<span class="cb-sla ' + s.cls + '"><i></i>' + esc(s.txt) + '</span>';
  const tplVars = (c) => { const q = c.quoteId || ((DB.quotes.filter(x => x.clientId === c.clientId && OPENQ.includes(x.status))[0]) || {}).id; return { nombre: String(c.contact.name || '').replace(/^(Prof\.|Sr\.|Sra\.)\s*/, '').split(/[ (]/)[0], asesor: Auth.user.name.split(' ')[0], empresa: DB.tenant.short + ' Travel', cotizacion: q || '[cotización]', reserva: c.resId || '[reserva]', telefono_emergencia: EMERGENCY }; };
  const fillTpl = (t, c) => { const v = tplVars(c); return t.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] != null ? v[k] : m); };
  const waClosed = (c) => { if (c.channel !== 'WhatsApp') return false; const li = lastIn(c); return !li || minsBetween(li.ts, nowStr()) > 1440; };

  let ibF = { ch: '', st: '', asg: '', q: '' };
  let composer = { mode: 'msg', atts: [], waTpl: null };

  function renderInbox(el, params) {
    css(); seedInbox();
    const all = DB.conversations.filter(convVisible);
    const sel = params && params[0] ? DB.conversations.find(c => c.id === params[0]) : null;
    if (params && params[0] && !sel) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('La conversación ' + params[0] + ' no existe.', 'msg') + '<div class="center" style="padding-bottom:16px"><a class="btn" href="#/inbox">Volver a la bandeja</a></div>') + '</div>'; return; }
    if (sel && !convVisible(sel)) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Conversación fuera de su alcance', crumbs: [['Inicio', '#/dashboard'], ['Bandeja omnicanal', '#/inbox'], [sel.id]] }) + UI.alert('warn', 'La conversación <b>' + esc(sel.id) + '</b> está asignada a ' + esc(who(sel.assignee)) + '. Con su rol (' + esc(Q.roleName(Auth.role)) + ') ve: ' + esc(scopeTxt().toLowerCase()) + '. Solicite la reasignación a su gerente.') + '</div>'; return; }
    if (sel && sel.unread) { sel.unread = 0; Store.save(); }
    const open = all.filter(c => c.status !== 'resuelta');
    const unassigned = open.filter(c => !c.assignee).length;
    const late = open.filter(c => !c.firstResponseAt && convSla(c).cls === 'bad').length;
    const waiting = open.filter(awaiting).length;
    el.innerHTML = '<div class="page cb-page">' + UI.pageHeader({ title: 'Bandeja omnicanal', subtitle: open.length + ' abiertas · ' + waiting + ' esperando respuesta · ' + unassigned + ' sin asignar · <span class="' + (late ? 'bad' : '') + '">' + late + ' con SLA de 1.ª respuesta vencido</span>', crumbs: [['Inicio', '#/dashboard'], ['General'], ['Bandeja omnicanal']],
      actions: '<span class="cb-scope" title="Alcance de datos del rol">' + I(isSup() ? 'users' : 'user') + esc(scopeTxt()) + '</span><button class="btn" data-g="integ">' + I('plug') + 'Canales e integración</button>' + (can('inbox.manage') ? '<button class="btn" data-g="sim">' + I('download') + 'Simular entrante</button>' : '') }) +
      '<div class="ib' + (sel ? ' sel' : '') + '"><section class="ib-col ib-list"><div class="ib-f"><div class="search-in">' + I('search') + '<input class="input sm" type="search" id="ib-q" placeholder="Buscar contacto, asunto…" value="' + esc(ibF.q) + '" aria-label="Buscar conversación"></div><div class="row">' +
      '<select class="input sm" id="ib-ch" aria-label="Canal"><option value="">Canal: todos</option>' + Object.keys(CH).map(k => '<option' + (ibF.ch === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select>' +
      '<select class="input sm" id="ib-st" aria-label="Estado"><option value="">Estado: todos</option>' + [['abierta', 'Abierta'], ['pendiente', 'Pendiente'], ['resuelta', 'Resuelta']].map(([v, l]) => '<option value="' + v + '"' + (ibF.st === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
      '<select class="input sm" id="ib-as" aria-label="Asignación"><option value="">' + (isSup() ? 'Asignación: todas' : 'Asignación: todas las visibles') + '</option><option value="me"' + (ibF.asg === 'me' ? ' selected' : '') + '>Asignadas a mí</option><option value="none"' + (ibF.asg === 'none' ? ' selected' : '') + '>Sin asignar</option></select></div><div class="ib-items" id="ib-items"></div></section>' +
      '<section class="ib-col ib-thread" id="ib-thread">' + (sel ? threadHtml(sel) : '<div class="ib-msgs" style="justify-content:center">' + UI.empty('Seleccione una conversación de la lista.', 'msg') + '</div>') + '</section>' +
      '<aside class="ib-col ib-side" id="ib-side">' + (sel ? sideHtml(sel) : '<div class="ib-sec">' + UI.empty('La ficha del contacto aparece al abrir una conversación.', 'user') + '</div>') + '</aside></div></div>';
    const drawList = () => {
      const q = ibF.q.toLowerCase();
      const rows = all.filter(c => (!ibF.ch || c.channel === ibF.ch) && (!ibF.st || c.status === ibF.st) && (!ibF.asg || (ibF.asg === 'me' ? c.assignee === me() : !c.assignee)) && (!q || (c.contact.name + ' ' + c.subject + ' ' + c.id + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(q)))
        .sort((a, b) => (a.status === 'resuelta') - (b.status === 'resuelta') || String(lastMsg(b).ts).localeCompare(String(lastMsg(a).ts)));
      const box = el.querySelector('#ib-items');
      box.innerHTML = rows.length ? rows.map(c => { const lm = lastMsg(c); const s = convSla(c); const ch = CH[c.channel]; return '<a class="ib-it' + (sel && sel.id === c.id ? ' on' : '') + '" href="#/inbox/' + c.id + '"><div class="ico-box ' + ch.tone + '" title="' + esc(c.channel) + '">' + I(ch.icon) + '</div><div class="grow" style="min-width:0"><div class="row between" style="flex-wrap:nowrap;gap:6px"><span class="nm">' + esc(c.contact.name) + '</span><span class="tm">' + shortTs(lm.ts) + '</span></div><div class="sj">' + esc(c.subject) + '</div><div class="sn">' + (lm.type === 'note' ? 'Nota: ' : lm.from && lm.from !== 'contact' && lm.from !== 'system' ? 'Tú: ' : '') + esc(lm.text || '') + '</div><div class="row" style="gap:5px;margin-top:5px;flex-wrap:wrap">' + cnvStatusBadge(c.status) + (c.priority === 'alta' ? UI.badge('alta', 'Prioridad alta') : '') + (!c.assignee ? UI.badge('nuevo', 'Sin asignar') : '<span class="xs faint">' + esc(who(c.assignee).split(' ')[0]) + '</span>') + (!c.firstResponseAt && c.status !== 'resuelta' ? slaSpan(s) : '') + (c.unread ? '<span class="ib-un" title="No leídos">' + c.unread + '</span>' : '') + '</div></div></a>'; }).join('') : UI.empty('Sin conversaciones con estos filtros.', 'search');
    };
    drawList();
    const upd = () => { ibF = { ch: el.querySelector('#ib-ch').value, st: el.querySelector('#ib-st').value, asg: el.querySelector('#ib-as').value, q: el.querySelector('#ib-q').value }; drawList(); };
    ['#ib-ch', '#ib-st', '#ib-as'].forEach(s => el.querySelector(s).onchange = upd);
    el.querySelector('#ib-q').addEventListener('input', Util.debounce(upd, 150));
    el.querySelector('[data-g="integ"]').onclick = integrationInfo;
    const sim = el.querySelector('[data-g="sim"]'); if (sim) sim.onclick = () => simulateInbound(null);
    if (sel) { bindThread(el, sel); bindSide(el.querySelector('#ib-side'), sel); const box = el.querySelector('.ib-msgs'); if (box) box.scrollTop = box.scrollHeight; }
  }

  function msgHtml(m) {
    const atts = (m.attachments || []).map(a => '<span class="ib-att">' + I('file') + esc(a) + '</span>').join('');
    if (m.type === 'event') return '<div class="ib-ev">' + esc(m.text) + ' · ' + datetime(m.ts) + '</div>';
    if (m.type === 'note') return '<div class="ib-m note"><div class="xs" style="font-weight:600;color:var(--warn)">' + I('lock') + ' Nota interna · ' + esc(who(m.from)) + '</div>' + esc(m.text) + (atts ? '<div>' + atts + '</div>' : '') + '<div class="mt">' + datetime(m.ts) + ' · no visible para el cliente</div></div>';
    const out = m.from !== 'contact';
    return '<div class="ib-m' + (out ? ' out' : '') + '">' + esc(m.text) + (atts ? '<div>' + atts + '</div>' : '') + '<div class="mt">' + (out ? esc(who(m.from)) + ' · ' : '') + datetime(m.ts) + (m.status ? ' · ' + esc(m.status) : '') + '</div></div>';
  }
  function threadHtml(c) {
    const ch = CH[c.channel]; const closed = waClosed(c); const mg = can('inbox.manage');
    return '<div class="ib-th"><a class="btn sm ghost ib-back" href="#/inbox">' + I('chevronLeft') + 'Bandeja</a><div class="ico-box ' + ch.tone + '">' + I(ch.icon) + '</div><div class="grow" style="min-width:0"><h2>' + esc(c.contact.name) + '</h2><div class="small muted" style="overflow-wrap:anywhere">' + esc(c.subject) + '</div><div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">' + cnvStatusBadge(c.status) + '<span class="tag">' + esc(c.channel) + '</span>' + UI.badge(c.priority, 'Prioridad ' + UI.statusLabel(c.priority).toLowerCase()) + slaSpan(convSla(c)) + '<span class="xs faint">Asignada a ' + esc(c.assignee ? who(c.assignee) : 'nadie') + '</span></div></div>' +
      '<div class="row" style="gap:6px"><button class="btn sm ib-fic" data-z="fic">' + I('user') + 'Ficha</button>' + (mg ? (c.status === 'resuelta' ? '<button class="btn sm" data-z="reopen">' + I('refresh') + 'Reabrir</button>' : '<button class="btn sm" data-z="resolve">' + I('checkCircle') + 'Resolver</button>') + '<button class="btn sm icon" data-z="more" title="Más acciones" aria-label="Más acciones">' + I('more') + '</button>' : '') + '</div></div>' +
      '<div class="ib-msgs">' + c.messages.map(msgHtml).join('') + '</div>' +
      (mg ? '<div class="ib-cmp' + (composer.mode === 'note' ? ' note' : '') + '" id="ib-cmp"><div class="row between" style="gap:6px"><div class="row" style="gap:4px"><button class="btn xs' + (composer.mode === 'msg' ? ' primary' : '') + '" data-z="m-msg">Responder</button><button class="btn xs' + (composer.mode === 'note' ? ' primary' : '') + '" data-z="m-note">' + I('lock') + 'Nota interna</button></div><span class="xs faint">' + (composer.mode === 'note' ? 'Solo visible para el equipo' : 'Se envía por ' + esc(c.channel) + (c.channel === 'Portal' ? ' (ticket ' + esc(c.ticketId || '') + ')' : '') + ' vía adaptador') + '</span></div>' +
        (closed && composer.mode === 'msg' ? UI.alert('warn', 'Ventana de 24 h de WhatsApp cerrada: el último mensaje del cliente tiene más de 24 h. Solo pueden enviarse <b>plantillas aprobadas</b> por Meta (política WhatsApp Business).') : '') +
        '<textarea class="input" id="ib-txt" rows="3" placeholder="' + (composer.mode === 'note' ? 'Escriba una nota interna para el equipo…' : 'Escriba su respuesta… (use Plantillas para respuestas rápidas con variables)') + '"></textarea>' +
        '<div id="ib-atts">' + composer.atts.map((a, i) => '<span class="ib-att">' + I('file') + esc(a) + ' <a href="#" data-rm="' + i + '" aria-label="Quitar adjunto">' + I('x') + '</a></span>').join('') + '</div>' +
        '<div class="row between" style="gap:6px"><div class="row" style="gap:6px"><button class="btn sm" data-z="tpl">' + I('copy') + 'Plantillas</button><button class="btn sm" data-z="att">' + I('upload') + 'Adjuntar</button></div><div class="row" style="gap:6px">' + (composer.mode === 'msg' ? '<button class="btn sm" data-z="send-res">Enviar y resolver</button>' : '') + '<button class="btn sm primary" data-z="send">' + I('send') + (composer.mode === 'note' ? 'Guardar nota' : 'Enviar') + '</button></div></div></div>'
        : '<div class="ib-cmp">' + UI.alert('info', 'Modo consulta: responder requiere <span class="mono">inbox.manage</span>.') + '</div>');
  }
  function sideHtml(c) {
    const cl = c.clientId && Q.client(c.clientId); const ld = c.leadId && Q.lead(c.leadId); const rs = c.resId && Q.reservation(c.resId);
    const res = cl ? DB.reservations.filter(r => r.clientId === cl.id && Scope.canSee(r)).slice(0, 4) : [];
    const qs = cl && can('quotes.view') ? DB.quotes.filter(q => q.clientId === cl.id && Scope.canSee(q)).slice(0, 4) : [];
    const opp = cl ? DB.opportunities.find(o => o.clientId === cl.id && !['ganada', 'perdida'].includes(o.stage) && Scope.canSee(o)) : null;
    const mg = can('inbox.manage');
    const b = (label, ic, act, perm) => { const no = perm && !can(perm); return '<button class="btn sm' + (no ? ' cb-noperm' : '') + '" data-y="' + act + '"' + (no ? ' aria-disabled="true" title="Requiere permiso ' + perm + '"' : '') + '>' + I(no ? 'lock' : ic) + esc(label) + '</button>'; };
    return '<div class="ib-sec"><div class="upper">Contacto</div><div class="row" style="gap:10px;flex-wrap:nowrap">' + UI.avatar({ name: c.contact.name, color: '#46606B' }) + '<div style="min-width:0"><b class="small">' + esc(c.contact.name) + '</b><div class="xs faint" style="overflow-wrap:anywhere">' + esc(c.contact.email || '—') + '</div><div class="xs faint">' + esc(c.contact.phone || '—') + '</div></div></div>' +
      '<div class="chip-row" style="margin-top:8px">' + (c.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' + (inTravel(c) ? '<div style="margin-top:8px">' + UI.badge('en_curso', 'Pasajero en viaje') + '</div>' : '') + '</div>' +
      '<div class="ib-sec"><div class="upper">Vínculos CRM</div>' +
      '<div class="ib-lk"><span>Cliente</span>' + (cl ? lnk('crm/clientes', cl.id, esc(cl.name)) : '<span class="faint">Sin vincular</span>') + '</div>' +
      '<div class="ib-lk"><span>Lead</span>' + (ld ? lnk('crm/leads', ld.id, esc(ld.id)) + ' ' + UI.badge(ld.status) : '<span class="faint">—</span>') + '</div>' +
      '<div class="ib-lk"><span>Reserva</span>' + (rs ? lnk('reservas', rs.id, esc(rs.id), 'mono') + ' ' + UI.badge(rs.status) : '<span class="faint">—</span>') + '</div>' +
      (c.ticketId ? '<div class="ib-lk"><span>Ticket portal</span><span class="mono small">' + esc(c.ticketId) + '</span></div>' : '') + '</div>' +
      (cl ? '<div class="ib-sec"><div class="upper">Reservas del cliente</div>' + (res.length ? res.map(r => '<div class="ib-lk"><span>' + lnk('reservas', r.id, esc(r.id), 'mono') + ' · <span class="xs faint">' + dateShort(r.travelFrom) + '</span></span>' + UI.badge(r.status) + '</div>').join('') : '<div class="xs faint">Sin reservas en su alcance</div>') +
        (can('quotes.view') ? '<div class="upper" style="margin-top:10px">Cotizaciones</div>' + (qs.length ? qs.map(q => '<div class="ib-lk"><span>' + lnk('cotizaciones', q.id, esc(q.id), 'mono') + '</span>' + UI.badge(q.status) + '</div>').join('') : '<div class="xs faint">Sin cotizaciones en su alcance</div>') : '') + '</div>' : '') +
      (mg ? '<div class="ib-sec"><div class="upper">Acciones</div><div class="ib-acts">' +
        b('Asignar', 'user', 'assign') +
        (!cl && !ld ? b('Crear lead', 'funnel', 'lead', 'crm.leads.manage') : '') +
        b(cl ? 'Cambiar cliente / reserva' : 'Vincular a cliente', 'link', 'link', 'crm.clients.manage') +
        b('Crear cotización', 'file', 'quote', 'quotes.create') +
        b('Crear actividad', 'calendar', 'act', 'crm.activities.manage') +
        b('Prioridad y etiquetas', 'tag', 'tags') +
        (c.status === 'resuelta' ? b('Reabrir', 'refresh', 'reopen') : b('Resolver', 'checkCircle', 'resolve')) +
        '</div>' + (opp ? '<div class="xs faint" style="margin-top:6px">Oportunidad abierta: ' + lnk('crm/oportunidades', opp.id, esc(opp.id)) + '</div>' : '') + '</div>' : '') +
      '<div class="ib-sec"><div class="xs faint">Canal ' + esc(c.channel) + ' · SLA de 1.ª respuesta ' + dur(CH[c.channel].sla) + ' · creada ' + datetime(c.createdAt) + '</div></div>';
  }

  /* ---------------- Acciones de conversación ---------------- */
  const sysEv = (c, text) => c.messages.push({ from: 'system', text, ts: nowStr(), type: 'event' });
  const needM = () => can('inbox.manage') || deny('Requiere inbox.manage.');
  function send(c, resolveAfter) {
    if (!needM()) return;
    const ta = document.getElementById('ib-txt'); const text = (ta.value || '').trim();
    if (!text && !composer.atts.length) return deny('Escriba un mensaje o adjunte un archivo.');
    if (composer.mode === 'note') {
      c.messages.push({ from: me(), text, ts: nowStr(), type: 'note', attachments: composer.atts.slice() });
      composer.atts = []; Store.save(); UI.toast('Nota interna guardada.'); App.render(); return;
    }
    if (waClosed(c) && !(composer.waTpl && text === composer.waTpl)) return deny('Fuera de la ventana de 24 h de WhatsApp solo se permiten plantillas aprobadas (use Plantillas › «WhatsApp aprobada»).');
    const ts = nowStr();
    c.messages.push({ from: me(), text, ts, type: 'msg', attachments: composer.atts.slice(), status: 'enviado' });
    const first = !c.firstResponseAt; if (first) c.firstResponseAt = ts;
    if (!c.assignee) { c.assignee = me(); sysEv(c, 'Asignada automáticamente a ' + Auth.user.name + ' al responder'); Audit.log('Conversación', c.id, 'asignar', 'sin asignar', Auth.user.name); }
    const before = c.status; c.status = resolveAfter ? 'resuelta' : 'pendiente';
    if (resolveAfter) { c.resolvedAt = ts; c.resolvedBy = me(); sysEv(c, 'Conversación resuelta por ' + Auth.user.name); }
    if (c.ticketId) { const t = (DB.supportTickets || []).find(x => x.id === c.ticketId); if (t) { t.log = t.log || []; t.log.push({ ts, m: 'Respuesta de ' + Auth.user.name + ': ' + text }); t.status = resolveAfter ? 'resuelta' : 'en_proceso'; } }
    Notify.push('inbox.respuesta', CH[c.channel].notify, c.channel === 'WhatsApp' ? c.contact.phone : c.contact.email || c.contact.phone, (c.channel === 'Portal' ? 'Respuesta a su ticket ' + c.ticketId : 'Respuesta de ' + DB.tenant.short) + ': ' + text.slice(0, 70));
    Audit.log('Conversación', c.id, resolveAfter ? 'responder_y_resolver' : 'responder', before, c.status + (first ? ' · 1.ª respuesta ' + (ts <= c.slaDueAt ? 'en SLA' : 'fuera de SLA') : ''));
    composer.atts = []; composer.waTpl = null; Store.save();
    UI.toast('Mensaje enviado por ' + esc(c.channel) + (resolveAfter ? ' y conversación resuelta.' : '. Estado: pendiente del cliente.')); App.render();
  }
  function setStatus(c, st) {
    if (!needM()) return;
    const before = c.status; c.status = st;
    if (st === 'resuelta') { c.resolvedAt = nowStr(); c.resolvedBy = me(); sysEv(c, 'Conversación resuelta por ' + Auth.user.name); }
    else sysEv(c, 'Conversación reabierta por ' + Auth.user.name);
    if (c.ticketId) { const t = (DB.supportTickets || []).find(x => x.id === c.ticketId); if (t) { t.status = st === 'resuelta' ? 'resuelta' : 'en_proceso'; t.log = t.log || []; t.log.push({ ts: nowStr(), m: st === 'resuelta' ? 'Ticket resuelto por ' + Auth.user.name : 'Ticket reabierto' }); } }
    Audit.log('Conversación', c.id, st === 'resuelta' ? 'resolver' : 'reabrir', before, st);
    if (st === 'resuelta' && c.channel === 'Portal') Notify.push('soporte.resuelto', 'Portal', c.contact.email || c.contact.name, 'Su solicitud ' + c.ticketId + ' fue resuelta');
    Store.save(); UI.toast(st === 'resuelta' ? 'Conversación resuelta.' : 'Conversación reabierta.'); App.render();
  }
  function assign(c) {
    if (!needM()) return;
    let opts = internalUsers().filter(u => userCan(u.id, 'inbox.view'));
    if (Auth.role === 'sales') opts = opts.filter(u => u.id === me());
    if (Auth.role === 'operations') opts = opts.filter(u => u.role === 'operations' || u.role === 'manager');
    UI.modal({ title: 'Asignar conversación', size: 'sm', sub: esc(c.id) + ' · actual: ' + esc(c.assignee ? who(c.assignee) : 'sin asignar'), body: (Auth.role === 'sales' ? UI.alert('info', 'Con el rol Ventas puede tomar conversaciones sin asignar; la reasignación entre asesores la hace Gerencia.') : '') + UI.form([{ id: 'as-u', label: 'Responsable', type: 'select', col: 12, required: true, placeholder: 'Seleccione…', value: c.assignee || '', options: opts.map(u => [u.id, u.name + ' — ' + Q.roleName(u.role)]) }]),
      actions: [{ label: 'Cancelar' }, { label: 'Asignar', cls: 'primary', icon: 'user', onClick: (m) => {
        if (!UI.validate(m)) return false; const u = m.querySelector('#as-u').value;
        if (Auth.role === 'sales' && c.assignee && c.assignee !== me()) return deny('La conversación ya está asignada a otro asesor.');
        if (u === c.assignee) return deny('Seleccione un responsable distinto.');
        const prev = c.assignee; c.assignee = u; sysEv(c, 'Asignada a ' + who(u) + ' por ' + Auth.user.name);
        if (c.ticketId) { const t = (DB.supportTickets || []).find(x => x.id === c.ticketId); if (t) t.owner = u; }
        Audit.log('Conversación', c.id, 'asignar', prev ? who(prev) : 'sin asignar', who(u));
        if (u !== me()) Notify.push('inbox.asignada', 'Portal', u, 'Conversación asignada: ' + c.contact.name + ' — ' + c.subject);
        Store.save(); UI.toast('Conversación asignada a ' + esc(who(u)) + '.'); App.render();
      } }] });
  }
  function createLead(c) {
    if (!can('crm.leads.manage')) return deny('Requiere crm.leads.manage.');
    const dup = DB.leads.find(l => (c.contact.email && l.email === c.contact.email) || (c.contact.phone && l.phone === c.contact.phone));
    const cdup = DB.clients.find(x => (c.contact.email && x.email === c.contact.email) || (c.contact.phone && x.phone === c.contact.phone));
    const src = { 'WhatsApp': 'WhatsApp', 'Email': 'Email', 'Web chat': 'Chat web', 'Formulario': 'Formulario web', 'Portal': 'Portal' }[c.channel];
    const sellers = internalUsers().filter(u => ['sales', 'manager', 'tenant_admin'].includes(u.role));
    UI.modal({ title: 'Crear lead desde la conversación', size: 'lg', sub: 'PROC-004 · Lead recibido → Validar → Detectar duplicado → Registrar → Asignar',
      body: (dup || cdup ? UI.alert('warn', 'Posible duplicado: ' + (dup ? 'lead <b>' + esc(dup.id) + '</b> (' + esc(dup.name) + ')' : '') + (cdup ? (dup ? ' y ' : '') + 'cliente <b>' + esc(cdup.id) + '</b> (' + esc(cdup.name) + ')' : '') + ' con el mismo email/teléfono. Considere vincular en lugar de crear.') : '') + UI.form([
        { id: 'ld-name', label: 'Nombre', value: c.contact.name, required: true, col: 6 }, { id: 'ld-email', label: 'Email', value: c.contact.email, col: 6 },
        { id: 'ld-phone', label: 'Teléfono', value: c.contact.phone, col: 4 }, { id: 'ld-dest', label: 'Destino de interés', value: /Humantay/i.test(c.subject) ? 'Humantay' : /Cusco|Machu/i.test(c.subject + c.messages.map(m => m.text).join(' ')) ? 'Cusco' : '', col: 4 }, { id: 'ld-int', label: 'Interés', type: 'select', col: 4, options: ['Paquete', 'Tour', 'Excursión', 'Viaje corporativo', 'Viaje de promoción'] },
        { id: 'ld-date', label: 'Fecha de viaje', type: 'date', col: 4 }, { id: 'ld-pax', label: 'Pasajeros', type: 'number', min: 1, value: 2, col: 4 },
        { id: 'ld-owner', label: 'Asesor responsable', type: 'select', col: 4, value: Auth.role === 'sales' ? me() : (c.assignee || ''), placeholder: 'Sin asignar', options: (Auth.role === 'sales' ? sellers.filter(u => u.id === me()) : sellers).map(u => [u.id, u.name]) },
        { id: 'ld-notes', label: 'Notas', type: 'textarea', rows: 2, col: 12, value: 'Origen: ' + c.channel + ' (' + c.id + '). ' + (lastIn(c) || {}).text }
      ]),
      actions: [{ label: 'Cancelar' }, { label: 'Crear lead', cls: 'primary', icon: 'funnel', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        const l = { id: nextNum(DB.leads, 'LEAD-', 4), name: f['ld-name'], email: f['ld-email'], phone: f['ld-phone'], company: '', source: src, interest: f['ld-int'], destination: f['ld-dest'], productId: '', travelDate: f['ld-date'], pax: Number(f['ld-pax']) || 1, channel: c.channel === 'Web chat' ? 'Web' : c.channel, status: 'nuevo', owner: f['ld-owner'] || '', score: 55, createdAt: nowStr(), notes: f['ld-notes'], duplicateOf: dup ? dup.id : null, validatedAt: nowStr(), createdBy: me(), conversationId: c.id };
        DB.leads.unshift(l); c.leadId = l.id; sysEv(c, 'Lead ' + l.id + ' creado por ' + Auth.user.name);
        Audit.log('Lead', l.id, 'crear', src + ' · ' + c.id, l.status); Audit.log('Conversación', c.id, 'vincular_lead', '', l.id);
        if (l.owner && l.owner !== me()) Notify.push('lead.asignado', 'Portal', l.owner, 'Nuevo lead asignado: ' + l.name + ' (' + l.id + ') desde ' + c.channel);
        Store.save(); UI.toast('Lead ' + l.id + ' creado y vinculado.'); App.render();
      } }] });
  }
  function linkClient(c) {
    if (!can('crm.clients.manage')) return deny('Requiere crm.clients.manage.');
    const ids = Scope.clientIds(); const clients = DB.clients.filter(x => !ids || ids.has(x.id));
    const guess = DB.clients.find(x => (c.contact.email && x.email === c.contact.email) || (c.contact.phone && x.phone === c.contact.phone));
    const resOpts = (cid) => DB.reservations.filter(r => r.clientId === cid && Scope.canSee(r)).map(r => [r.id, r.id + ' · ' + r.title]);
    UI.modal({ title: 'Vincular a cliente', size: 'sm', sub: esc(c.contact.name) + ' · ' + esc(c.contact.email || c.contact.phone || ''),
      body: (guess && guess.id !== c.clientId ? UI.alert('info', 'Coincidencia por email/teléfono: <b>' + esc(guess.name) + '</b> (' + esc(guess.id) + ').') : '') + UI.form([{ id: 'lk-c', label: 'Cliente', type: 'select', required: true, col: 12, placeholder: 'Seleccione…', value: c.clientId || (guess ? guess.id : ''), options: clients.map(x => [x.id, x.name + ' · ' + x.id]) }, { id: 'lk-r', label: 'Reserva relacionada', type: 'select', col: 12, placeholder: 'Ninguna', value: c.resId || '', options: resOpts(c.clientId || (guess ? guess.id : '')) }]) + (Scope.ownOnly() ? '<p class="xs faint" style="margin-top:8px">Rol Ventas: solo clientes de su cartera.</p>' : ''),
      onOpen: (m) => { const s = m.querySelector('#lk-c'); s.onchange = () => { m.querySelector('#lk-r').innerHTML = '<option value="">Ninguna</option>' + resOpts(s.value).map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join(''); }; },
      actions: [{ label: 'Cancelar' }, { label: 'Vincular', cls: 'primary', icon: 'link', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const prev = c.clientId;
        c.clientId = f['lk-c']; c.resId = f['lk-r'] || null; sysEv(c, 'Vinculada a ' + Q.clientName(c.clientId) + (c.resId ? ' / ' + c.resId : '') + ' por ' + Auth.user.name);
        Audit.log('Conversación', c.id, 'vincular_cliente', prev || '', c.clientId + (c.resId ? ' · ' + c.resId : ''));
        Store.save(); UI.toast('Conversación vinculada a ' + esc(Q.clientName(c.clientId)) + '.'); App.render();
      } }] });
  }
  function createQuote(c) {
    if (!can('quotes.create')) return deny('Requiere quotes.create.');
    const cl = c.clientId && Q.client(c.clientId);
    const opp = cl ? DB.opportunities.find(o => o.clientId === cl.id && !['ganada', 'perdida'].includes(o.stage) && Scope.canSee(o)) : null;
    sysEv(c, 'Cotización iniciada por ' + Auth.user.name + (opp ? ' para ' + opp.id : '')); Audit.log('Conversación', c.id, 'crear_cotizacion', '', opp ? opp.id : 'sin oportunidad'); Store.save();
    if (!cl) UI.toast('Conversación sin cliente vinculado: seleccione el cliente en el constructor.', 'info');
    location.hash = '#/cotizaciones/nueva' + (opp ? '/' + opp.id : '');
  }
  function createActivity(c) {
    if (!can('crm.activities.manage')) return deny('Requiere crm.activities.manage.');
    const rel = c.leadId ? ['lead', c.leadId] : c.clientId ? ['client', c.clientId] : null;
    if (!rel) return deny('Vincule primero la conversación a un lead o cliente (la actividad necesita un registro CRM).');
    const owners = Auth.role === 'sales' ? [Auth.user] : internalUsers().filter(u => userCan(u.id, 'crm.activities.manage'));
    UI.modal({ title: 'Crear actividad', size: 'sm', sub: 'Relacionada con ' + (rel[0] === 'lead' ? 'lead ' : 'cliente ') + esc(rel[1]), body: UI.form([
      { id: 'ac-t', label: 'Tipo', type: 'select', col: 6, options: ['Llamada', 'WhatsApp', 'Email', 'Reunión', 'Tarea'], value: c.channel === 'WhatsApp' ? 'WhatsApp' : c.channel === 'Email' ? 'Email' : 'Llamada' },
      { id: 'ac-o', label: 'Responsable', type: 'select', col: 6, value: c.assignee || me(), options: owners.map(u => [u.id, u.name]) },
      { id: 'ac-s', label: 'Asunto', required: true, col: 12, value: 'Seguimiento: ' + c.subject },
      { id: 'ac-d', label: 'Fecha', type: 'date', required: true, col: 6, value: addDays(TODAY(), 1) }, { id: 'ac-h', label: 'Hora', type: 'time', required: true, col: 6, value: '10:00' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Crear actividad', cls: 'primary', icon: 'calendar', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        const a = { id: nextNum(DB.activities, 'ACT-', 4), type: f['ac-t'], subject: f['ac-s'], relType: rel[0], relId: rel[1], owner: f['ac-o'], due: f['ac-d'] + ' ' + f['ac-h'], status: 'pendiente', result: '', createdAt: nowStr(), createdBy: me(), conversationId: c.id };
        DB.activities.unshift(a); sysEv(c, 'Actividad ' + a.id + ' (' + a.type + ') programada para ' + datetime(a.due));
        Audit.log('Actividad', a.id, 'crear', 'desde ' + c.id, a.due);
        if (a.owner !== me()) Notify.push('actividad.asignada', 'Portal', a.owner, 'Actividad ' + a.id + ': ' + a.subject);
        Store.save(); UI.toast('Actividad ' + a.id + ' creada.'); App.render();
      } }] });
  }
  function editTags(c) {
    if (!needM()) return;
    UI.modal({ title: 'Prioridad y etiquetas', size: 'sm', body: UI.form([{ id: 'tg-p', label: 'Prioridad', type: 'select', col: 12, value: c.priority, options: [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta'], ['critica', 'Crítica']] }, { id: 'tg-t', label: 'Etiquetas (separadas por coma)', col: 12, value: (c.tags || []).join(', ') }]),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { const f = UI.formData(m); const b = c.priority + ' · ' + (c.tags || []).join(','); c.priority = f['tg-p']; c.tags = f['tg-t'].split(',').map(s => s.trim()).filter(Boolean).slice(0, 8); Audit.log('Conversación', c.id, 'clasificar', b, c.priority + ' · ' + c.tags.join(',')); Store.save(); UI.toast('Clasificación actualizada.'); App.render(); } }] });
  }
  function attach() {
    UI.modal({ title: 'Adjuntar archivo (simulado)', size: 'sm', body: UI.alert('info', 'En producción el archivo se sube a S3 (tenants/{tenant}/inbox/{uuid}) con URL firmada, se escanea con antivirus y se envía por el adaptador del canal (límite WhatsApp: 16 MB).') + '<div style="margin-top:12px">' + UI.form([{ id: 'at-n', label: 'Nombre del archivo', required: true, col: 12, placeholder: 'itinerario_cusco_5d.pdf' }, { id: 'at-q', label: 'Sugeridos', type: 'select', col: 12, placeholder: '—', options: ['itinerario_propuesto.pdf', 'voucher_servicio.pdf', 'politica_cancelacion.pdf', 'fotos_hotel.zip'] }]) + '</div>',
      onOpen: (m) => { m.querySelector('#at-q').onchange = (e) => { if (e.target.value) m.querySelector('#at-n').value = e.target.value; }; },
      actions: [{ label: 'Cancelar' }, { label: 'Adjuntar', cls: 'primary', icon: 'upload', onClick: (m) => { if (!UI.validate(m)) return false; composer.atts.push(m.querySelector('#at-n').value.trim()); keepDraft(() => App.render()); UI.toast('Adjunto agregado al mensaje.', 'info'); } }] });
  }
  function simulateInbound(c) {
    if (!needM()) return;
    UI.modal({ title: c ? 'Simular mensaje del cliente (webhook)' : 'Simular conversación entrante (webhook)', size: 'sm',
      body: UI.alert('info', 'Flujo real: el proveedor del canal llama al webhook <span class="mono">POST /api/v1/integrations/{canal}/webhook</span> → se valida la firma → job <span class="mono">ProcessInboundMessage</span> (cola integrations) → se crea o actualiza la conversación y se emite por Reverb.') + '<div style="margin-top:12px">' + UI.form((c ? [] : [{ id: 'si-ch', label: 'Canal', type: 'select', col: 6, options: Object.keys(CH).filter(k => k !== 'Portal') }, { id: 'si-n', label: 'Contacto', col: 6, value: 'Rodrigo Salcedo', required: true }, { id: 'si-p', label: 'Teléfono / email', col: 12, value: '955 402 118', required: true }, { id: 'si-s', label: 'Asunto', col: 12, value: 'Full day Paracas e Islas Ballestas para 2' }]).concat([{ id: 'si-t', label: 'Mensaje', type: 'textarea', rows: 3, required: true, col: 12, value: c ? '' : 'Hola, ¿qué precio tiene el full day a Paracas con Islas Ballestas para 2 personas el 17 de octubre?' }])) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Recibir mensaje', cls: 'primary', icon: 'download', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const ts = nowStr();
        if (c) { c.messages.push({ from: 'contact', text: f['si-t'], ts, type: 'msg' }); c.unread = (c.unread || 0) + 1; if (c.status !== 'abierta') { const b = c.status; c.status = 'abierta'; sysEv(c, 'Reabierta automáticamente por mensaje entrante'); Audit.log('Conversación', c.id, 'mensaje_entrante', b, 'abierta'); } if (c.assignee) Notify.push('inbox.mensaje', 'Push', c.assignee, 'Nuevo mensaje de ' + c.contact.name); Store.save(); UI.toast('Mensaje entrante recibido (webhook simulado).', 'info'); App.render(); return; }
        const ch = f['si-ch']; const isMail = /@/.test(f['si-p']);
        const n = { id: nextCnv(), channel: ch, contact: { name: f['si-n'], email: isMail ? f['si-p'] : '', phone: isMail ? '' : f['si-p'] }, subject: f['si-s'] || 'Nueva consulta', status: 'abierta', assignee: null, createdAt: ts, clientId: null, leadId: null, resId: null, quoteId: null, priority: 'media', tags: ['Nuevo'], slaDueAt: addMin(ts, CH[ch].sla), firstResponseAt: null, unread: 1, messages: [{ from: 'contact', text: f['si-t'], ts, type: 'msg' }] };
        const cl = DB.clients.find(x => (n.contact.email && x.email === n.contact.email) || (n.contact.phone && x.phone === n.contact.phone)); if (cl) { n.clientId = cl.id; n.messages.push({ from: 'system', text: 'Cliente reconocido automáticamente: ' + cl.name, ts, type: 'event' }); }
        DB.conversations.unshift(n); Audit.log('Conversación', n.id, 'crear', ch + ' webhook', 'abierta · sin asignar');
        internalUsers().filter(u => u.role === 'manager').forEach(u => Notify.push('inbox.nueva', 'Portal', u.id, 'Nueva conversación sin asignar (' + ch + '): ' + n.contact.name));
        Store.save(); UI.toast('Conversación ' + n.id + ' creada desde ' + esc(ch) + '.', 'info'); App.go('#/inbox/' + n.id);
      } }] });
  }
  function integrationInfo() {
    const wa = (DB.integrations || []).find(x => x.id === 'INT-04') || {}; const em = (DB.integrations || []).find(x => x.id === 'INT-03') || {};
    UI.drawer({ title: 'Canales e integración', sub: 'Adaptadores por canal (Regla transversal 20: integraciones aisladas)', wide: true, body:
      '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Canal</th><th>Adaptador / entrada</th><th>Salida</th><th class="num">SLA 1.ª resp.</th><th>Estado</th></tr></thead><tbody>' +
      [['WhatsApp', 'WhatsApp Business Cloud API · webhook firmado (X-Hub-Signature-256)', 'Mensajes de sesión (24 h) y plantillas aprobadas', UI.badge(wa.status || 'sandbox')], ['Email', 'Buzón atencion@ vía inbound parse (SES/Mailgun) o IMAP poll cada 2 min', 'SMTP/API transaccional con hilo (Message-ID/In-Reply-To)', UI.badge(em.status || 'activo')], ['Web chat', 'Widget del sitio (sitio/*) por WebSocket Reverb', 'Mismo canal en tiempo real', UI.badge('activo')], ['Formulario', 'Formulario de contacto del sitio → POST /api/v1/public/contact (rate limit)', 'Respuesta por email', UI.badge('activo')], ['Portal', 'Tickets de soporte de portal cliente/pasajero (DB.supportTickets)', 'Respuesta visible en el portal + email', UI.badge('activo')]].map(r => '<tr><td><b>' + r[0] + '</b></td><td class="small">' + r[1] + '</td><td class="small">' + r[2] + '</td><td class="num">' + dur(CH[r[0]].sla) + '</td><td>' + r[3] + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="section-title" style="margin-top:16px">Flujo de un mensaje entrante</div>' + UI.flow(['Webhook', 'Validar firma', 'Idempotencia (message_id)', 'Job ProcessInboundMessage', 'Resolver contacto', 'Conversación', 'Reverb + notificación'], 7) +
      '<div style="margin-top:12px">' + UI.alert('info', 'Los mensajes salientes se encolan (cola <span class="mono">integrations</span>) con reintentos y backoff; el estado de entrega (enviado, entregado, leído, fallido) vuelve por webhook de estado. Un fallo del proveedor no bloquea la conversación (Regla transversal 21).') + '</div>' });
  }
  function bindThread(el, c) {
    const box = el.querySelector('#ib-thread');
    const H = {
      resolve: () => setStatus(c, 'resuelta'), reopen: () => setStatus(c, 'abierta'),
      fic: () => UI.drawer({ title: 'Ficha del contacto', body: sideHtml(c), onOpen: (d) => bindSide(d, c) }),
      more: (b) => UI.menu(b, [{ label: 'Asignar', icon: 'user', onClick: () => assign(c) }, { label: 'Prioridad y etiquetas', icon: 'tag', onClick: () => editTags(c) }, { label: 'Simular mensaje del cliente (webhook)', icon: 'download', onClick: () => simulateInbound(c) }, '-', { label: 'Ver auditoría de la conversación', icon: 'shield', onClick: () => UI.drawer({ title: 'Auditoría · ' + esc(c.id), body: UI.timeline(DB.audit.filter(x => x.entityId === c.id).map(x => ({ icon: 'history', title: esc(x.action.replace(/_/g, ' ')), meta: esc(Q.userName(x.user)) + ' · ' + datetime(x.ts), desc: esc(x.before + ' → ' + x.after) }))) }) }]),
      'm-msg': () => { composer.mode = 'msg'; keepDraft(() => App.render()); }, 'm-note': () => { composer.mode = 'note'; keepDraft(() => App.render()); },
      tpl: (b) => { const closed = waClosed(c); UI.menu(b, DB.inboxTemplates.filter(t => !closed || t.wa || composer.mode === 'note').map(t => ({ label: t.name, icon: t.wa ? 'shield' : 'copy', onClick: () => { const ta = document.getElementById('ib-txt'); const txt = fillTpl(t.text, c); ta.value = t.wa ? txt : (ta.value ? ta.value + '\n' : '') + txt; composer.waTpl = t.wa ? txt : null; ta.focus(); } }))); },
      att: () => attach(), send: () => send(c, false), 'send-res': () => send(c, true)
    };
    box.querySelectorAll('[data-z]').forEach(b => b.onclick = (e) => { e.preventDefault(); const f = H[b.dataset.z]; if (f) f(b); });
    box.querySelectorAll('[data-rm]').forEach(a => a.onclick = (e) => { e.preventDefault(); composer.atts.splice(+a.dataset.rm, 1); keepDraft(() => App.render()); });
  }
  function keepDraft(fn) { const t = document.getElementById('ib-txt'); const v = t ? t.value : ''; fn(); const n = document.getElementById('ib-txt'); if (n) n.value = v; }
  function bindSide(root, c) {
    const H = { assign: () => assign(c), lead: () => createLead(c), link: () => linkClient(c), quote: () => createQuote(c), act: () => createActivity(c), tags: () => editTags(c), resolve: () => setStatus(c, 'resuelta'), reopen: () => setStatus(c, 'abierta') };
    root.querySelectorAll('[data-y]').forEach(b => b.onclick = (e) => { e.preventDefault(); const f = H[b.dataset.y]; if (f) f(); });
  }

  /* Semillas al cargar: los módulos de origen (dashboard, ventas, finanzas, portales) ven las mismas solicitudes */
  try { seedApprovals(); seedInbox(); } catch (e) { console.error(e); }

  /* ---------------- Rutas ---------------- */
  App.register('aprobaciones', (el, params) => {
    if (!can('approvals.view')) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Requiere el permiso approvals.view.') + '</div>'; return; }
    renderApprovals(el, params);
  });
  App.register('inbox', (el, params) => {
    if (!can('inbox.view')) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Requiere el permiso inbox.view.') + '</div>'; return; }
    renderInbox(el, params);
  });
})();
