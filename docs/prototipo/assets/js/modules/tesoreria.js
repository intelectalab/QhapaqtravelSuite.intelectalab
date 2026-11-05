/* ==========================================================================
   Tesorería (caja y bancos) + Libro de Reclamaciones virtual
   - finanzas/tesoreria: cuentas bancarias PEN/USD, cajas chicas por sede, pasarela
     como cuenta de tránsito, movimientos (sincronizados desde pagos aplicados y pagos
     a proveedores), transferencias, gastos de caja chica, apertura/cierre diario,
     arqueos por denominación, reposición, flujo proyectado 30/60/90 y diferencia cambiaria.
   - crm/reclamaciones + libro-reclamaciones: hojas de reclamación (Reclamo / Queja)
     con correlativo por sede, plazo en días hábiles, respuesta y constancia.
     Las hojas se guardan en DB.claims (colección de postventa del CRM) con book: true.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, daysFromToday, addDays, nowStr, parseD } = Util;
  const TODAY = () => window.TODAY;
  const FX = () => DB.settings.fx || 3.74;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const can = (p) => Auth.can(p);
  const pad = (n, w) => String(n).padStart(w, '0');
  const nextId = (arr, prefix, width) => { let max = 0; (arr || []).forEach(x => { const id = String(x.id); if (!id.startsWith(prefix)) return; const m = id.slice(prefix.length).match(/^(\d+)$/); if (m) max = Math.max(max, +m[1]); }); return prefix + pad(max + 1, width); };
  const needTip = (perm) => ' disabled title="Requiere permiso ' + perm + '"';
  const lk = (route, id, html, cls) => id && Access.canRoute(route) ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="#/' + route + '/' + encodeURIComponent(id) + '">' + html + '</a>' : '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</span>';
  const resLink = (id) => id ? lk('reservas', id, esc(id), 'mono') : '<span class="faint">—</span>';
  const cliLink = (id) => id && Q.client(id) ? lk('crm/clientes', id, esc(Q.clientName(id))) : '<span class="faint">—</span>';
  const signed = (v, cur) => '<span class="num nowrap ' + (v < 0 ? 'tz-neg' : v > 0 ? 'tz-pos' : '') + '">' + (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v), cur || 'PEN') + '</span>';

  function css() {
    if (document.getElementById('css-tesoreria')) return;
    const s = document.createElement('style'); s.id = 'css-tesoreria';
    s.textContent = '.tz-neg{color:var(--bad)}.tz-pos{color:var(--ok)}' +
      '.tz-den{width:100%;border-collapse:collapse}.tz-den td,.tz-den th{padding:5px 8px;border-bottom:1px solid var(--line-2);font-size:.82rem}.tz-den th{text-align:left;color:var(--fg-2);font-weight:550;font-size:.74rem;text-transform:uppercase;letter-spacing:.03em}.tz-den input{width:84px;text-align:right}.tz-den td.num,.tz-den th.num{text-align:right}' +
      '.tz-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.tz-sum>div{border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;min-width:0}.tz-sum span{display:block;font-size:.72rem;color:var(--fg-3);text-transform:uppercase;letter-spacing:.03em}.tz-sum b{font-size:1rem;font-variant-numeric:tabular-nums}' +
      '.tz-box{border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:10px;min-width:0;background:var(--surface)}.tz-box h3{font-size:.95rem}.tz-box .acts{display:flex;flex-wrap:wrap;gap:6px}' +
      '.tz-hz{width:100%;border-collapse:collapse}.tz-hz th,.tz-hz td{padding:8px 10px;border-bottom:1px solid var(--line-2);font-size:.84rem;text-align:right;white-space:nowrap}.tz-hz th:first-child,.tz-hz td:first-child{text-align:left;white-space:normal}.tz-hz tr.tot td{font-weight:650;border-top:2px solid var(--line)}' +
      '.lr-legal{font-size:.78rem;color:var(--fg-2);line-height:1.5}.lr-legal p+p{margin-top:6px}' +
      '.lr-type{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lr-type label{display:flex;gap:9px;align-items:flex-start;border:1px solid var(--line);border-radius:8px;padding:10px 12px;cursor:pointer;font-size:.84rem;min-width:0}.lr-type input{margin-top:3px;accent-color:var(--accent)}.lr-type b{display:block}' +
      '.lr-cnt{display:inline-flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}.lr-sheet{border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:grid;gap:6px}' +
      '@media (max-width:560px){.tz-sum{grid-template-columns:1fr}.lr-type{grid-template-columns:1fr}.tz-den input{width:64px}}';
    document.head.appendChild(s);
  }

  /* =====================================================================
     TESORERÍA — datos
     ===================================================================== */
  const DENOMS = [[200, 'Billete'], [100, 'Billete'], [50, 'Billete'], [20, 'Billete'], [10, 'Billete'], [5, 'Moneda'], [2, 'Moneda'], [1, 'Moneda'], [0.5, 'Moneda'], [0.2, 'Moneda'], [0.1, 'Moneda']];
  const MOV_TYPES = {
    ingreso: 'Cobro de cliente', reversion: 'Reversión de cobro', pago_proveedor: 'Pago a proveedor', transferencia: 'Transferencia entre cuentas',
    gasto_caja: 'Gasto de caja chica', reposicion: 'Reposición de caja chica', liquidacion_pasarela: 'Liquidación de pasarela', comision_pasarela: 'Comisión de pasarela',
    ajuste_arqueo: 'Ajuste por arqueo', ingreso_otro: 'Otro ingreso', egreso_otro: 'Otro egreso'
  };
  const SRC_LABEL = { payment: 'Pago de cliente', reversal: 'Reversión', payout: 'Pago a proveedor', payable: 'Pago a proveedor', transfer: 'Transferencia', expense: 'Gasto de caja', replenishment: 'Reposición', gateway: 'Pasarela', count: 'Arqueo', manual: 'Manual' };
  const EXP_CATS = ['Movilidad local', 'Útiles de oficina', 'Alimentación de grupo / conductores', 'Botiquín y oxígeno', 'Combustible y estacionamiento', 'Courier y envíos', 'Impresiones y fotocopias', 'Trámites notariales', 'Atenciones a clientes', 'Propinas y servicios menores', 'Otros'];
  const RECEIPTS = ['Factura', 'Boleta de venta', 'Ticket / cinta', 'Recibo por honorarios', 'Planilla de movilidad', 'Declaración jurada'];
  const MAN_CATS_OUT = ['Gastos bancarios / ITF', 'Tributos (SUNAT)', 'Planilla', 'Alquileres', 'Servicios TI y licencias', 'Servicios básicos', 'Préstamos', 'Otros egresos'];
  const MAN_CATS_IN = ['Intereses bancarios', 'Aporte de capital', 'Devolución de proveedor', 'Otros ingresos'];

  const acc = (id) => (DB.treasuryAccounts || []).find(a => a.id === id);
  const isCash = (a) => a && a.kind === 'caja';
  const kindLabel = (a) => a.kind === 'banco' ? 'Banco' : a.kind === 'caja' ? 'Caja chica' : 'Pasarela (tránsito)';
  const live = () => DB.treasuryMovements.filter(m => m.status !== 'anulado');
  const balance = (id, upto) => { const a = acc(id); if (!a) return 0; return r2(a.opening + sum(live().filter(m => m.accountId === id && (!upto || m.date <= upto)), m => m.dir === 'in' ? m.amount : -m.amount)); };
  const eqPEN = (amt, cur) => cur === 'USD' ? amt * FX() : amt;
  const accLabel = (a) => a ? a.name + (a.number ? ' · ' + a.number : '') : '—';
  const accLink = (id) => { const a = acc(id); return a ? '<a href="#/finanzas/tesoreria/cuenta/' + a.id + '">' + esc(a.name) + '</a>' : '—'; };
  const sessionToday = (accId) => (DB.cashSessions || []).find(s => s.accountId === accId && s.date === TODAY());
  const lastSession = (accId) => (DB.cashSessions || []).filter(s => s.accountId === accId).sort((a, b) => (b.date + b.openedAt).localeCompare(a.date + a.openedAt))[0];

  /* Permisos de tesorería (el backend los valida en cada endpoint) */
  const P = {
    view: () => can('finance.treasury'),
    oper: () => can('finance.treasury') && can('finance.payments.register'),          // Finanzas, Tenant Admin
    acct: () => can('finance.treasury') && can('finance.invoicing'),                  // Contabilidad (+ Finanzas, Admin)
    appr: () => can('finance.treasury') && can('finance.profitability') && can('approvals.view') // Manager (+ Finanzas, Admin)
  };
  const blockOper = (what) => { if (P.oper()) return false; UI.toast('Su rol (' + esc(Q.roleName(Auth.role)) + ') no puede ' + what + ': requiere <span class="mono">finance.payments.register</span> (Regla transversal 17).', 'bad'); return true; };

  function breakdown(amount) {
    let cents = Math.round(amount * 100); const out = {};
    DENOMS.forEach(([d]) => { const c = Math.round(d * 100); const n = Math.floor(cents / c); out[d] = n; cents -= n * c; });
    return out;
  }

  /* Cuenta destino según el método de pago del cobro */
  function bankAcc(bank, cur) { return DB.treasuryAccounts.find(a => a.bank === bank && a.currency === cur) || DB.treasuryAccounts.find(a => a.bank === bank && a.currency === 'PEN'); }
  function cashOfSede(sede) { return DB.treasuryAccounts.find(a => a.kind === 'caja' && a.sede === sede) || DB.treasuryAccounts.find(a => a.kind === 'caja'); }
  function accForPayment(p) {
    const m = String(p.method || '').toLowerCase(); const cur = p.currency;
    if (m.includes('crédito b2b')) return null;
    if (m.includes('tarjeta') || m.includes('pasarela')) return DB.treasuryAccounts.find(a => a.kind === 'pasarela' && a.currency === cur) || DB.treasuryAccounts.find(a => a.kind === 'pasarela');
    if (m.includes('yape')) return bankAcc('BCP', 'PEN');
    if (m.includes('plin')) return bankAcc('Interbank', 'PEN');
    if (m.includes('interbank')) return bankAcc('Interbank', cur);
    if (m.includes('bbva')) return bankAcc('BBVA', cur);
    if (m.includes('efectivo')) { const r = Q.reservation(p.resId); return cashOfSede(r ? r.sede : 'SED-01'); }
    return bankAcc('BCP', cur);
  }
  /* Conversión al moneda de la cuenta conservando el original (Regla transversal 15) */
  function conv(amount, cur, fx, a) {
    if (cur === a.currency) return { amount: r2(amount), fx: cur === 'USD' ? (fx || FX()) : null, orig: null };
    const rate = fx || FX();
    if (cur === 'USD') return { amount: r2(amount * rate), fx: null, orig: { amount, currency: cur, fx: rate } };
    return { amount: r2(amount / rate), fx: rate, orig: { amount, currency: cur, fx: rate } };
  }
  function newMov(o) {
    const m = Object.assign({ id: nextId(DB.treasuryMovements, 'MOV-', 6), status: 'registrado', createdAt: nowStr(), by: Auth.user ? Auth.user.id : 'Sistema', fx: null }, o);
    DB.treasuryMovements.unshift(m); return m;
  }

  /* Sincronización con Finanzas: pagos confirmados/aplicados → ingresos; reversiones → egresos;
     pagos a proveedores (payouts o CxP pagadas) → egresos. Idempotente por srcKey. */
  function sync() {
    let n = 0; const has = new Set(DB.treasuryMovements.map(m => m.srcKey).filter(Boolean));
    DB.payments.forEach(p => {
      if (!['aplicado', 'confirmado', 'revertido'].includes(p.status)) return;
      const a = accForPayment(p); if (!a) return;
      const c = conv(p.amount, p.currency, p.fx, a); const res = Q.reservation(p.resId); const cl = res ? Q.client(res.clientId) : null;
      if (!has.has('PAG:' + p.id)) { newMov({ accountId: a.id, date: p.date, dir: 'in', type: 'ingreso', amount: c.amount, currency: a.currency, fx: c.fx, orig: c.orig, srcKind: 'payment', srcId: p.id, srcKey: 'PAG:' + p.id, desc: 'Cobro ' + (p.receivableId || p.resId || '') + (cl ? ' — ' + cl.name : ''), ref: p.ref, counterparty: cl ? cl.name : '', sede: res ? res.sede : a.sede, by: p.by || 'Sistema' }); n++; }
      if (p.status === 'revertido' && !has.has('REV:' + p.id)) { const d = p.revertedAt ? String(p.revertedAt).slice(0, 10) : addDays(p.date, 1); newMov({ accountId: a.id, date: d, dir: 'out', type: 'reversion', amount: c.amount, currency: a.currency, fx: c.fx, orig: c.orig, srcKind: 'reversal', srcId: p.id, srcKey: 'REV:' + p.id, desc: 'Reversión del cobro ' + p.id + (p.revertReason ? ' — ' + p.revertReason : ''), ref: p.ref, counterparty: cl ? cl.name : '', sede: res ? res.sede : a.sede, by: p.revertedBy || p.by || 'Sistema' }); n++; }
    });
    DB.payables.forEach(p => {
      const prv = Q.provider(p.providerId) || {}; const res = Q.reservation(p.resId);
      (p.payouts || []).forEach(x => {
        const key = 'PPR:' + x.id; if (has.has(key)) return;
        let a = String(x.method || '').toLowerCase().includes('efectivo') ? cashOfSede(res ? res.sede : 'SED-01') : DB.treasuryAccounts.find(t => t.number && String(x.account || '').includes(t.number));
        if (!a) a = DB.treasuryAccounts.find(t => t.kind === 'banco' && String(x.account || '').includes(t.bank) && t.currency === p.currency) || bankAcc('BCP', p.currency);
        const c = conv(x.amount, p.currency, x.fx, a);
        newMov({ accountId: a.id, date: x.date, dir: 'out', type: 'pago_proveedor', amount: c.amount, currency: a.currency, fx: c.fx, orig: c.orig, srcKind: 'payout', srcId: p.id, payoutId: x.id, srcKey: key, desc: 'Pago ' + p.id + ' — ' + (prv.name || '') + ' · ' + p.concept, ref: x.ref, counterparty: prv.name || '', sede: res ? res.sede : a.sede, by: x.by || 'Sistema' }); n++;
      });
      if (p.status === 'pagada' && !(p.payouts || []).length && !has.has('CXP:' + p.id)) {
        const bl = (DB.bankLines || []).find(b => b.match === p.id); const a = bl ? bankAcc(bl.bank, p.currency) : bankAcc('BCP', p.currency);
        const c = conv(p.paid || p.amount, p.currency, p.fx, a);
        newMov({ accountId: a.id, date: bl ? bl.date : addDays(p.due, -1), dir: 'out', type: 'pago_proveedor', amount: c.amount, currency: a.currency, fx: c.fx, orig: c.orig, srcKind: 'payable', srcId: p.id, srcKey: 'CXP:' + p.id, desc: 'Pago ' + p.id + ' — ' + (prv.name || '') + ' · ' + p.concept, ref: bl ? bl.desc : 'Pago registrado antes de la puesta en marcha', counterparty: prv.name || '', sede: res ? res.sede : a.sede, by: 'U07' }); n++;
      }
    });
    if (n) Store.save();
    return n;
  }

  /* Valorización en soles de una cuenta USD por costo promedio ponderado.
     Devuelve {bal, val, rate, realized:[{m, rate, diff}]} hasta la fecha indicada. */
  function valuation(id, upto) {
    const a = acc(id); let bal = a.opening, val = a.opening * (a.openingRate || FX()); const realized = [];
    const ev = live().filter(m => m.accountId === id && (!upto || m.date <= upto)).map(m => ({ d: m.date, k: 0, m }))
      .concat((DB.fxRevaluations || []).filter(r => r.accountId === id && (!upto || r.date <= upto)).map(r => ({ d: r.date, k: 1, r })))
      .sort((x, y) => x.d.localeCompare(y.d) || x.k - y.k || (x.m && y.m ? x.m.id.localeCompare(y.m.id) : 0));
    ev.forEach(e => {
      if (e.r) { val += e.r.diffPEN; return; }
      const m = e.m;
      if (m.dir === 'in') { bal += m.amount; val += m.amount * (m.fx || FX()); }
      else { const rate = bal > 0 ? val / bal : FX(); bal -= m.amount; val -= m.amount * rate; if (m.fx && Math.abs(m.fx - rate) > 0.00001) realized.push({ m, rate, diff: r2(m.amount * (m.fx - rate)) }); }
    });
    return { bal: r2(bal), val: r2(val), rate: bal ? val / bal : (a.openingRate || FX()), realized };
  }

  function ensureT() {
    css();
    if (!DB.treasuryAccounts) {
      const o = '2026-08-01';
      DB.treasuryAccounts = [
        { id: 'CTA-01', kind: 'banco', bank: 'BCP', name: 'BCP Cta. Cte. PEN', number: '193-2284410-0-31', cci: '002-193-002284410031-15', currency: 'PEN', sede: 'SED-01', opening: 142380.5, openingRate: null, openingDate: o, status: 'activa' },
        { id: 'CTA-02', kind: 'banco', bank: 'BCP', name: 'BCP Cta. Cte. USD', number: '193-2284411-1-45', cci: '002-193-002284411145-19', currency: 'USD', sede: 'SED-01', opening: 21480, openingRate: 3.69, openingDate: o, status: 'activa' },
        { id: 'CTA-03', kind: 'banco', bank: 'Interbank', name: 'Interbank Cta. Cte. PEN', number: '200-3001882210', cci: '003-200-003001882210-41', currency: 'PEN', sede: 'SED-01', opening: 46300, openingRate: null, openingDate: o, status: 'activa' },
        { id: 'CTA-04', kind: 'banco', bank: 'Interbank', name: 'Interbank Cta. Cte. USD', number: '200-3001882229', cci: '003-200-003001882229-47', currency: 'USD', sede: 'SED-01', opening: 8950, openingRate: 3.69, openingDate: o, status: 'activa' },
        { id: 'CTA-05', kind: 'banco', bank: 'BBVA', name: 'BBVA Cta. Cte. PEN', number: '0011-0182-0100045521', cci: '011-182-000100045521-66', currency: 'PEN', sede: 'SED-02', opening: 27840, openingRate: null, openingDate: o, status: 'activa' },
        { id: 'CTA-06', kind: 'banco', bank: 'BBVA', name: 'BBVA Cta. Cte. USD', number: '0011-0182-0100045548', cci: '011-182-000100045548-60', currency: 'USD', sede: 'SED-02', opening: 3200, openingRate: 3.69, openingDate: o, status: 'activa' },
        { id: 'CTA-07', kind: 'caja', bank: '', name: 'Caja chica Lima', number: '', currency: 'PEN', sede: 'SED-01', fund: 1500, custodian: 'U07', opening: 1500, openingRate: null, openingDate: o, status: 'activa' },
        { id: 'CTA-08', kind: 'caja', bank: '', name: 'Caja chica Cusco', number: '', currency: 'PEN', sede: 'SED-02', fund: 2000, custodian: 'U05', opening: 2000, openingRate: null, openingDate: o, status: 'activa' },
        { id: 'CTA-09', kind: 'caja', bank: '', name: 'Caja chica Arequipa', number: '', currency: 'PEN', sede: 'SED-03', fund: 800, custodian: 'U03', opening: 800, openingRate: null, openingDate: o, status: 'activa' },
        { id: 'CTA-10', kind: 'pasarela', bank: '', name: 'Pasarela de pagos USD', number: 'Comercio 4410-2290', currency: 'USD', sede: 'SED-01', settleTo: 'CTA-02', opening: 0, openingRate: 3.69, openingDate: o, status: 'activa' },
        { id: 'CTA-11', kind: 'pasarela', bank: '', name: 'Pasarela de pagos PEN', number: 'Comercio 4410-2288', currency: 'PEN', sede: 'SED-01', settleTo: 'CTA-01', opening: 0, openingRate: null, openingDate: o, status: 'activa' }
      ];
      DB.treasurySettings = { tolerance: 10, maxExpense: 500, djMax: 150, replenishPct: 40, gatewayFeePct: 4, depositHours: 24,
        recurring: [{ concept: 'Planilla de remuneraciones', amount: 48500, day: 28 }, { concept: 'Alquiler de oficinas Lima y Cusco', amount: 9300, day: 5 }, { concept: 'Tributos mensuales (IGV y renta)', amount: 12400, day: 18 }] };
      DB.treasuryMovements = [];
      const seedBy = 'U07';
      const add = (o) => { const m = newMov(Object.assign({ by: seedBy, createdAt: o.date + ' 10:00', srcKind: 'manual' }, o)); return m; };
      const trf = (id, from, to, date, amt, amtTo, fx, desc, ref, type) => {
        add({ accountId: from, date, dir: 'out', type: type || 'transferencia', amount: amt, currency: acc(from).currency, fx: acc(from).currency === 'USD' ? fx : null, srcKind: 'transfer', transferId: id, desc, ref });
        add({ accountId: to, date, dir: 'in', type: type || 'transferencia', amount: amtTo, currency: acc(to).currency, fx: acc(to).currency === 'USD' ? fx : null, srcKind: 'transfer', transferId: id, desc, ref });
      };
      add({ accountId: 'CTA-01', date: '2026-09-01', dir: 'out', type: 'egreso_otro', amount: 6800, currency: 'PEN', category: 'Alquileres', desc: 'Alquiler oficina Miraflores — setiembre', ref: 'OP 00887120', counterparty: 'Inmobiliaria Larco 1150 S.A.C.' });
      add({ accountId: 'CTA-05', date: '2026-09-05', dir: 'out', type: 'egreso_otro', amount: 2500, currency: 'PEN', category: 'Alquileres', desc: 'Alquiler oficina Calle Plateros — setiembre', ref: 'OP 71220981', counterparty: 'Rosa Pacheco de Olivera' });
      add({ accountId: 'CTA-05', date: '2026-09-07', dir: 'out', type: 'egreso_otro', amount: 1180, currency: 'PEN', category: 'Servicios TI y licencias', desc: 'Licencias de software y hosting', ref: 'OP 71224410', counterparty: 'Nube Andina S.A.C.' });
      trf('TRF-0032', 'CTA-02', 'CTA-01', '2026-09-12', 3000, 11205, 3.735, 'Venta de dólares para capital de trabajo (TC 3.735)', 'OP 00901442');
      add({ accountId: 'CTA-01', date: '2026-09-18', dir: 'out', type: 'egreso_otro', amount: 12430, currency: 'PEN', category: 'Tributos (SUNAT)', desc: 'Pago IGV agosto 2026 — SUNAT', ref: 'NPS 1029384756', counterparty: 'SUNAT' });
      add({ accountId: 'CTA-03', date: '2026-09-26', dir: 'out', type: 'egreso_otro', amount: 38.5, currency: 'PEN', category: 'Gastos bancarios / ITF', desc: 'Comisiones de mantenimiento y portes', ref: 'Cargo automático', counterparty: 'Interbank' });
      add({ accountId: 'CTA-01', date: '2026-09-28', dir: 'out', type: 'egreso_otro', amount: 48500, currency: 'PEN', category: 'Planilla', desc: 'Planilla de remuneraciones — setiembre', ref: 'Telecrédito 00044812', counterparty: 'Trabajadores (planilla)' });
      /* Gastos de caja chica con comprobante */
      const gx = (accId, dt, cat, desc, amt, rcp, num, ruc, sup, rep, resId) => add({ accountId: accId, date: dt, dir: 'out', type: 'gasto_caja', amount: amt, currency: 'PEN', category: cat, desc, ref: rcp + (num ? ' ' + num : ''), counterparty: sup, srcKind: 'expense', receipt: { type: rcp, number: num, ruc: ruc || '', supplier: sup, file: num ? num.replace(/\W/g, '') + '.pdf' : '' }, replenishmentId: rep || null, resId: resId || null, by: accId === 'CTA-08' ? 'U05' : accId === 'CTA-09' ? 'U03' : 'U07', sede: acc(accId).sede });
      gx('CTA-08', '2026-09-03', 'Movilidad local', 'Movilidad del guía a estación Poroy', 45, 'Planilla de movilidad', 'PM-0091', '', 'Planilla interna', 'REP-0007');
      gx('CTA-08', '2026-09-05', 'Útiles de oficina', 'Útiles y tóner para oficina Cusco', 132.5, 'Boleta de venta', 'B002-004410', '20564412201', 'Librería El Estudiante S.A.C.', 'REP-0007');
      gx('CTA-08', '2026-09-08', 'Alimentación de grupo / conductores', 'Agua y snacks grupo corporativo', 280, 'Factura', 'F001-002231', '20527711093', 'Distribuidora Imperial E.I.R.L.', 'REP-0007');
      gx('CTA-08', '2026-09-10', 'Propinas y servicios menores', 'Propinas a porteadores Salkantay', 150, 'Declaración jurada', 'DJ-0014', '', 'Porteadores (sin comprobante)', 'REP-0007');
      gx('CTA-08', '2026-09-11', 'Courier y envíos', 'Envío de documentos a Lima', 58, 'Boleta de venta', 'B011-120045', '20100686814', 'Olva Courier S.A.C.', 'REP-0007');
      gx('CTA-08', '2026-09-12', 'Botiquín y oxígeno', 'Recarga de balones de oxígeno medicinal', 320, 'Factura', 'F003-000877', '20490022118', 'Oxígeno Andino S.R.L.', 'REP-0007');
      gx('CTA-08', '2026-09-14', 'Combustible y estacionamiento', 'Combustible camioneta de apoyo', 464.5, 'Factura', 'F120-044512', '20330262428', 'Grifo Wanchaq S.A.', 'REP-0007');
      trf('TRF-0033', 'CTA-01', 'CTA-08', '2026-09-15', 1450, 1450, null, 'Reposición caja chica Cusco REP-0007', 'OP 00910022', 'reposicion');
      gx('CTA-08', '2026-09-17', 'Movilidad local', 'Taxi a Ministerio de Cultura (boletaje)', 38, 'Planilla de movilidad', 'PM-0094', '', 'Planilla interna');
      gx('CTA-08', '2026-09-19', 'Botiquín y oxígeno', 'Reposición de botiquín de campo', 96.5, 'Boleta de venta', 'B001-078812', '20601122334', 'Botica Sagrado Corazón S.A.C.');
      gx('CTA-08', '2026-09-22', 'Alimentación de grupo / conductores', 'Alimentación conductores ruta Humantay', 180, 'Factura', 'F001-000915', '20533300441', 'Restaurante Tika Wasi', null, 'RES-2026-000346');
      gx('CTA-08', '2026-09-24', 'Útiles de oficina', 'Archivadores y papel para rooming', 64, 'Boleta de venta', 'B002-004502', '20564412201', 'Librería El Estudiante S.A.C.');
      gx('CTA-08', '2026-09-26', 'Combustible y estacionamiento', 'Estacionamiento aeropuerto Velasco Astete', 25, 'Ticket / cinta', 'T-88120', '20100012001', 'Corpac S.A.');
      gx('CTA-08', '2026-09-27', 'Alimentación de grupo / conductores', 'Snacks de bienvenida — Keller', 142, 'Boleta de venta', 'B004-011290', '20490099551', 'Minimarket San Blas E.I.R.L.', null, 'RES-2026-000347');
      gx('CTA-08', '2026-09-29', 'Impresiones y fotocopias', 'Impresión de vouchers y rooming lists', 18.5, 'Boleta de venta', 'B001-005521', '10412231190', 'Copias Plateros');
      gx('CTA-07', '2026-09-04', 'Courier y envíos', 'Envío de contrato a Minera Cordillera Blanca', 35, 'Boleta de venta', 'B011-118220', '20100686814', 'Olva Courier S.A.C.');
      gx('CTA-07', '2026-09-09', 'Movilidad local', 'Movilidad a reunión con cliente corporativo', 48, 'Planilla de movilidad', 'PM-0102', '', 'Planilla interna');
      gx('CTA-07', '2026-09-11', 'Útiles de oficina', 'Útiles de oficina Miraflores', 186.4, 'Factura', 'F001-018822', '20100048920', 'Tai Loy S.A.', 'REP-0008');
      gx('CTA-07', '2026-09-16', 'Atenciones a clientes', 'Café y bocaditos reunión Laboratorios Andinos', 95, 'Boleta de venta', 'B003-220145', '20512002090', 'Café Larco S.A.C.', 'REP-0008');
      gx('CTA-07', '2026-09-21', 'Trámites notariales', 'Legalización de contrato de alquiler', 120, 'Factura', 'F002-004411', '20492211003', 'Notaría Paino Scarpati', 'REP-0008');
      gx('CTA-07', '2026-09-25', 'Movilidad local', 'Movilidad a SUNAT', 28, 'Planilla de movilidad', 'PM-0107', '', 'Planilla interna', 'REP-0008');
      gx('CTA-07', '2026-09-26', 'Impresiones y fotocopias', 'Impresión de catálogos para feria', 100, 'Boleta de venta', 'B001-009912', '10456612203', 'Imprenta Grafi Lima', 'REP-0008');
      DB.treasuryMovements.filter(m => m.accountId === 'CTA-07' && ['2026-09-04', '2026-09-09'].includes(m.date)).forEach(m => { m.replenishmentId = 'REP-0008'; });
      gx('CTA-09', '2026-09-10', 'Movilidad local', 'Movilidad a Colegio San Agustín', 32, 'Planilla de movilidad', 'PM-0031', '', 'Planilla interna');
      gx('CTA-09', '2026-09-18', 'Útiles de oficina', 'Útiles de oficina Yanahuara', 74, 'Boleta de venta', 'B001-003320', '20455118876', 'Librería Arequipa S.A.C.');
      gx('CTA-09', '2026-09-24', 'Alimentación de grupo / conductores', 'Agua para grupo Colca', 80, 'Boleta de venta', 'B002-010021', '20455009921', 'Distribuidora del Sur E.I.R.L.');
      /* Cobros sincronizados desde Finanzas y liquidación de la pasarela */
      sync();
      trf('TRF-0031', 'CTA-10', 'CTA-02', '2026-09-02', 2607.36, 2607.36, 3.72, 'Liquidación pasarela — lote 0828 (neto)', 'LIQ-0828', 'liquidacion_pasarela');
      add({ accountId: 'CTA-10', date: '2026-09-02', dir: 'out', type: 'comision_pasarela', amount: 108.64, currency: 'USD', fx: 3.72, category: 'Gastos bancarios / ITF', srcKind: 'gateway', transferId: 'TRF-0031', desc: 'Comisión pasarela 4 % — lote 0828', ref: 'LIQ-0828', counterparty: 'Procesador de pagos' });
      /* Reposiciones */
      const lima = DB.treasuryMovements.filter(m => m.replenishmentId === 'REP-0008');
      const cus = DB.treasuryMovements.filter(m => m.replenishmentId === 'REP-0007');
      DB.cashReplenishments = [
        { id: 'REP-0008', accountId: 'CTA-07', sede: 'SED-01', amount: r2(sum(lima, 'amount')), movIds: lima.map(m => m.id), status: 'solicitada', requestedBy: 'U07', requestedAt: '2026-09-28 17:30', note: 'Rendición de gastos 04/09 al 26/09', log: [{ ts: '2026-09-28 17:30', u: 'U07', m: 'Solicitud de reposición con ' + lima.length + ' comprobantes' }] },
        { id: 'REP-0007', accountId: 'CTA-08', sede: 'SED-02', amount: r2(sum(cus, 'amount')), movIds: cus.map(m => m.id), status: 'pagada', requestedBy: 'U05', requestedAt: '2026-09-14 18:00', approvedBy: 'U02', approvedAt: '2026-09-15 09:10', paidAt: '2026-09-15 11:20', paidBy: 'U07', paidFrom: 'CTA-01', transferId: 'TRF-0033', note: 'Rendición 03/09 al 14/09', log: [{ ts: '2026-09-14 18:00', u: 'U05', m: 'Solicitud' }, { ts: '2026-09-15 09:10', u: 'U02', m: 'Aprobada' }, { ts: '2026-09-15 11:20', u: 'U07', m: 'Pagada desde BCP PEN (TRF-0033)' }] }
      ];
      /* Sesiones de caja (apertura/cierre diario) y arqueos */
      DB.cashSessions = []; DB.cashCounts = [];
      const cnt = (id, accId, dt, kind, diff, status, by, extra) => { const exp = balance(accId, dt); const counted = r2(exp + diff); const c = Object.assign({ id, accountId: accId, sede: acc(accId).sede, date: dt, ts: dt + ' 19:05', kind, denoms: breakdown(counted), counted, expected: exp, diff: r2(diff), result: diff === 0 ? 'cuadrado' : diff > 0 ? 'sobrante' : 'faltante', note: '', signedBy: by, signedAt: dt + ' 19:06', witness: null, status }, extra || {}); DB.cashCounts.unshift(c); return c; };
      cnt('ARQ-0040', 'CTA-07', '2026-09-26', 'arqueo', -25, 'pendiente_aprobacion', 'U07', { ts: '2026-09-26 12:40', signedAt: '2026-09-26 12:42', note: 'Arqueo sorpresa. Faltante de S/ 25.00; la custodia indica un pago de movilidad sin planilla firmada.', witness: 'U08' });
      [['CTA-07', 'U07', 0, 'ARQ-0041'], ['CTA-08', 'U05', -3.5, 'ARQ-0042'], ['CTA-09', 'U03', 0, 'ARQ-0043']].forEach(([a, u, diff, id], i) => {
        const sid = 'CJS-' + pad(118 + i, 4);
        const c = cnt(id, a, '2026-09-28', 'cierre', diff, diff ? 'firmado' : 'validado', u, { sessionId: sid, validatedBy: diff ? null : 'U08', validatedAt: diff ? null : '2026-09-29 08:30', note: diff ? 'Faltante menor por redondeo de vueltos; cargo a la custodia.' : '' });
        if (diff) { const m = add({ accountId: a, date: '2026-09-28', dir: 'out', type: 'ajuste_arqueo', amount: Math.abs(diff), currency: 'PEN', srcKind: 'count', srcId: id, desc: 'Faltante de arqueo ' + id + ' (cargo a custodia)', ref: id, by: u, category: 'Ajuste de caja' }); c.adjustmentMovId = m.id; }
        DB.cashSessions.push({ id: sid, accountId: a, sede: acc(a).sede, date: '2026-09-28', openedAt: '08:' + (20 + i * 5), openedBy: u, openingAmount: balance(a, '2026-09-27'), closedAt: '19:0' + (5 + i), closedBy: u, closingCountId: id, status: 'cerrada' });
      });
      DB.cashSessions.push({ id: 'CJS-0121', accountId: 'CTA-07', sede: 'SED-01', date: '2026-09-29', openedAt: '08:25', openedBy: 'U07', openingAmount: balance('CTA-07', '2026-09-28'), status: 'abierta' });
      DB.cashSessions.push({ id: 'CJS-0122', accountId: 'CTA-08', sede: 'SED-02', date: '2026-09-29', openedAt: '07:40', openedBy: 'U05', openingAmount: balance('CTA-08', '2026-09-28'), status: 'abierta' });
      /* Diferencia cambiaria de agosto (TC cierre 3.71) */
      DB.fxRevaluations = [];
      DB.treasuryAccounts.filter(a => a.currency === 'USD').forEach((a, i) => { const v = valuation(a.id, '2026-08-31'); const diff = r2(v.bal * 3.71 - v.val); if (Math.abs(diff) >= 0.01) DB.fxRevaluations.push({ id: 'DC-' + pad(21 + i, 4), period: '2026-08', date: '2026-08-31', accountId: a.id, balance: v.bal, bookRate: r2(v.rate * 1e4) / 1e4, closeRate: 3.71, diffPEN: diff, by: 'U08', at: '2026-08-31 18:00' }); });
      Store.save();
    }
    if (!DB.cashSessions) DB.cashSessions = [];
    if (!DB.cashCounts) DB.cashCounts = [];
    if (!DB.cashReplenishments) DB.cashReplenishments = [];
    if (!DB.fxRevaluations) DB.fxRevaluations = [];
    sync();
  }

  /* =====================================================================
     TESORERÍA — pantallas
     ===================================================================== */
  let curTab = 'resumen';
  App.register('finanzas/tesoreria', (el, params) => {
    ensureT();
    if (params[0] === 'cuenta') return accountPage(el, params[1]);
    const tabs = ['resumen', 'movimientos', 'cajas', 'flujo', 'cambio'];
    if (tabs.includes(params[0])) curTab = params[0];
    const accs = DB.treasuryAccounts.filter(a => a.status === 'activa');
    const tot = (f) => r2(sum(accs.filter(f), a => eqPEN(balance(a.id), a.currency)));
    const bankPEN = r2(sum(accs.filter(a => a.kind === 'banco' && a.currency === 'PEN'), a => balance(a.id)));
    const bankUSD = r2(sum(accs.filter(a => a.kind === 'banco' && a.currency === 'USD'), a => balance(a.id)));
    const cash = tot(a => a.kind === 'caja'); const gw = tot(a => a.kind === 'pasarela'); const all = tot(() => true);
    const hz = horizons({ overdue: true, fixed: true });
    const pendCounts = DB.cashCounts.filter(c => c.status === 'pendiente_aprobacion').length;
    const pendRep = DB.cashReplenishments.filter(r => ['solicitada', 'aprobada'].includes(r.status)).length;
    const roleNote = P.oper() ? '' : Auth.role === 'accounting' ? UI.alert('info', '<b>Contabilidad:</b> consulta de saldos y movimientos, validación de arqueos y registro de la diferencia cambiaria. El registro de movimientos y gastos corresponde a Finanzas (<span class="mono">finance.payments.register</span>).') : UI.alert('info', '<b>Vista de supervisión (' + esc(Q.roleName(Auth.role)) + '):</b> consulta de saldos y flujo proyectado; aprueba reposiciones de caja chica y diferencias de arqueo mayores a la tolerancia. No registra movimientos de caja (<span class="mono">finance.payments.register</span>).');
    el.innerHTML = '<div class="page">' + UI.pageHeader({
      title: 'Tesorería · caja y bancos', subtitle: 'Saldos por cuenta, movimientos, cajas chicas por sede y flujo de caja proyectado. Consolidado en soles al TC ' + fmtN(FX(), 3) + '.',
      crumbs: [['Inicio', '#/dashboard'], ['Finanzas', Access.canRoute('finanzas/cobros') ? '#/finanzas/cobros' : ''], ['Tesorería']],
      actions: '<button class="btn" id="tz-sync">' + UI.icon('sync') + 'Sincronizar con Finanzas</button>' +
        '<button class="btn" id="tz-trf"' + (P.oper() ? '' : needTip('finance.payments.register')) + '>' + UI.icon('refresh') + 'Transferencia</button>' +
        '<button class="btn primary" id="tz-new"' + (P.oper() ? '' : needTip('finance.payments.register')) + '>' + UI.icon('plus') + 'Registrar movimiento</button>'
    }) + roleNote +
      '<div class="grid g5">' +
      UI.kpi({ label: 'Saldo consolidado', value: 'S/ ' + fmtN(all / 1000, 1) + 'k', sub: accs.length + ' cuentas activas', tone: 'accent', icon: 'database' }) +
      UI.kpi({ label: 'Bancos en soles', value: money(bankPEN, 'PEN', 0), sub: 'BCP · Interbank · BBVA', tone: 'info', icon: 'building' }) +
      UI.kpi({ label: 'Bancos en dólares', value: money(bankUSD, 'USD', 0), sub: '≈ S/ ' + fmtN(bankUSD * FX(), 0), tone: 'violet', icon: 'globe' }) +
      UI.kpi({ label: 'Cajas y pasarela', value: money(cash + gw, 'PEN', 0), sub: 'Cajas S/ ' + fmtN(cash, 0) + ' · tránsito S/ ' + fmtN(gw, 0), tone: 'sun', icon: 'wallet' }) +
      UI.kpi({ label: 'Saldo proyectado 30 d', value: 'S/ ' + fmtN(hz[0].end / 1000, 1) + 'k', sub: (pendCounts + pendRep) ? (pendCounts + pendRep) + ' pendiente(s) de aprobación' : 'CxC − CxP − egresos fijos', tone: hz[0].end < 0 ? 'bad' : 'ok', icon: 'trending' }) +
      '</div><div id="tz-tabs"></div></div>';
    const T = [
      { id: 'resumen', label: 'Resumen', render: tabResumen },
      { id: 'movimientos', label: 'Movimientos', count: live().length, render: tabMovs },
      { id: 'cajas', label: 'Cajas y arqueos', count: (pendCounts + pendRep) || null, render: tabCajas },
      { id: 'flujo', label: 'Flujo proyectado', render: tabFlujo },
      { id: 'cambio', label: 'Diferencia cambiaria', render: tabCambio }
    ];
    UI.tabs(el.querySelector('#tz-tabs'), T, curTab, { onChange: (id) => { curTab = id; try { history.replaceState(null, '', '#/finanzas/tesoreria/' + id); } catch (e) { } } });
    el.querySelector('#tz-sync').onclick = () => { const n = sync(); Audit.log('Tesorería', 'sync', 'sincronizar_finanzas', '', n + ' movimiento(s)'); UI.toast(n ? n + ' movimiento(s) nuevo(s) desde pagos y pagos a proveedores.' : 'Tesorería al día: no hay pagos nuevos por reflejar.', n ? 'ok' : 'info'); if (n) App.render(); };
    el.querySelector('#tz-new').onclick = () => movModal();
    el.querySelector('#tz-trf').onclick = () => transferModal();
  });

  function alertsList() {
    const out = [];
    DB.treasuryAccounts.filter(a => a.kind === 'caja').forEach(a => {
      const b = balance(a.id); const pct = b / a.fund * 100; const s = sessionToday(a.id);
      if (!s) out.push(['warn', '<b>' + esc(a.name) + '</b>: la caja no ha sido aperturada hoy. No se pueden registrar gastos (TES-BR-05).']);
      if (pct < DB.treasurySettings.replenishPct && !DB.cashReplenishments.some(r => r.accountId === a.id && ['solicitada', 'aprobada'].includes(r.status))) out.push(['warn', '<b>' + esc(a.name) + '</b> al ' + fmtN(pct, 0) + ' % del fondo (' + money(b) + ' de ' + money(a.fund) + '). Solicite reposición (TES-BR-08).']);
    });
    DB.treasuryAccounts.filter(a => a.kind === 'pasarela').forEach(a => { const b = balance(a.id); if (b > 0.005) out.push(['info', '<b>' + esc(a.name) + '</b>: ' + money(b, a.currency) + ' en tránsito pendiente de liquidación al banco.']); });
    DB.cashCounts.filter(c => c.status === 'pendiente_aprobacion').forEach(c => out.push(['bad', 'Arqueo <span class="mono">' + c.id + '</span> (' + esc(acc(c.accountId).name) + ') con ' + (c.diff < 0 ? 'faltante' : 'sobrante') + ' de ' + money(Math.abs(c.diff)) + ' pendiente de aprobación.']));
    DB.cashReplenishments.filter(r => r.status === 'solicitada').forEach(r => out.push(['info', 'Reposición <span class="mono">' + r.id + '</span> de ' + esc(acc(r.accountId).name) + ' por ' + money(r.amount) + ' pendiente de aprobación.']));
    const cashIn = live().filter(m => isCash(acc(m.accountId)) && m.type === 'ingreso' && daysFromToday(m.date) < -1 && !m.depositedBy);
    if (cashIn.length) out.push(['warn', cashIn.length + ' cobro(s) en efectivo con más de ' + DB.treasurySettings.depositHours + ' h sin depositar (TES-BR-09).']);
    return out;
  }

  function tabResumen(body) {
    const accs = DB.treasuryAccounts;
    const groups = [['Bancos PEN', a => a.kind === 'banco' && a.currency === 'PEN'], ['Bancos USD', a => a.kind === 'banco' && a.currency === 'USD'], ['Cajas chicas', a => a.kind === 'caja'], ['Pasarela (tránsito)', a => a.kind === 'pasarela']];
    const items = groups.map(([l, f]) => { const v = r2(sum(accs.filter(f), a => eqPEN(balance(a.id), a.currency))); return { label: l, value: Math.max(0, v), display: fmtN(v / 1000, 1) + 'k' }; });
    const days = []; for (let i = 27; i >= 0; i -= 3) days.push(addDays(TODAY(), -i));
    const series = days.map(d => r2(sum(accs, a => eqPEN(balance(a.id, d), a.currency))));
    const al = alertsList();
    body.innerHTML = '<div class="grid g-2-1"><div id="tz-accs" style="min-width:0"></div><div class="col" style="gap:16px;min-width:0">' +
      UI.card('Composición del saldo', UI.chart.donut({ items, size: 130, center: 'S/ ' + fmtN(sum(items, 'value') / 1000, 0) + 'k', sub: 'consolidado' }), { sub: 'Equivalente en soles' }) +
      UI.card('Alertas de tesorería', al.length ? al.map(a => UI.alert(a[0], a[1])).join('') : UI.empty('Sin alertas', 'checkCircle'), { sub: 'Reglas TES-BR' }) +
      '</div></div>' +
      '<div class="grid g-2-1">' + UI.card('Saldo consolidado · últimos 28 días', UI.chart.line({ labels: days.map(dateShort), series: [{ name: 'Saldo S/', values: series }], fmt: v => 'S/ ' + fmtN(v, 0) }), { sub: 'Incluye bancos, cajas y pasarela (USD al TC del día)' }) +
      UI.card('Últimos movimientos', '<div class="list">' + live().slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 7).map(m => '<div class="list-item"><div class="ico-box ' + (m.dir === 'in' ? 'ok' : '') + '">' + UI.icon(m.dir === 'in' ? 'download' : 'upload') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.desc) + '</div><div class="xs faint">' + dateShort(m.date) + ' · ' + esc(acc(m.accountId).name) + '</div></div>' + signed(m.dir === 'in' ? m.amount : -m.amount, m.currency) + '</div>').join('') + '</div>', { actions: '<button class="btn xs" id="tz-allm">Ver todos</button>' }) + '</div>';
    UI.dataTable(body.querySelector('#tz-accs'), {
      rows: () => DB.treasuryAccounts.map(a => ({ ...a, bal: balance(a.id), eq: eqPEN(balance(a.id), a.currency) })), exportName: 'tesoreria_cuentas', pageSize: 12, searchPlaceholder: 'Buscar cuenta…',
      search: a => [a.name, a.number, a.bank, Q.sedeName(a.sede)].join(' '),
      toolbar: '<b class="small" style="margin-right:6px">Cuentas</b>',
      filters: [{ key: 'kind', label: 'Tipo', options: [['banco', 'Banco'], ['caja', 'Caja chica'], ['pasarela', 'Pasarela']] }, { key: 'currency', label: 'Moneda', options: [['PEN', 'PEN'], ['USD', 'USD']] }],
      columns: [
        { key: 'name', label: 'Cuenta', render: a => '<div class="cell-main">' + esc(a.name) + '</div><div class="cell-sub mono">' + esc(a.number || Q.sedeName(a.sede)) + '</div>' },
        { key: 'kind', label: 'Tipo', render: a => '<span class="tag">' + esc(kindLabel(a)) + '</span>', csv: a => kindLabel(a) },
        { key: 'sede', label: 'Sede', render: a => '<span class="small">' + esc(Q.sedeName(a.sede).split(' — ')[0]) + '</span>', csv: a => Q.sedeName(a.sede) },
        { key: 'bal', label: 'Saldo', align: 'num', render: a => '<span class="num nowrap">' + money(a.bal, a.currency) + '</span>', csv: a => a.bal.toFixed(2) },
        { key: 'eq', label: 'Equiv. S/', align: 'num', render: a => '<span class="num nowrap">' + fmtN(a.eq, 2) + '</span>', csv: a => a.eq.toFixed(2) },
        { key: 'st', label: 'Estado', sort: false, render: a => a.kind === 'caja' ? (sessionToday(a.id) ? UI.badge(sessionToday(a.id).status === 'abierta' ? 'abierta' : 'cerrada', sessionToday(a.id).status === 'abierta' ? 'Abierta' : 'Cerrada') : UI.badge('pendiente', 'Sin abrir')) : a.kind === 'pasarela' ? (a.bal > 0 ? UI.badge('pendiente', 'Por liquidar') : UI.badge('activa', 'Liquidada')) : UI.badge('activa'), csv: a => a.status }
      ],
      footer: rows => '<tr><td colspan="4"><b>Total consolidado</b></td><td class="num"><b>' + fmtN(sum(rows, 'eq'), 2) + '</b></td><td></td></tr>',
      onRow: a => App.go('#/finanzas/tesoreria/cuenta/' + a.id)
    });
    body.querySelector('#tz-allm').onclick = () => { const b = document.querySelector('.tab[data-tab="movimientos"]'); if (b) b.click(); };
  }

  function movRows() { return DB.treasuryMovements.slice(); }
  function srcCell(m) {
    if (m.srcKind === 'payment' || m.srcKind === 'reversal') return lk('finanzas/pagos', m.srcId, esc(m.srcId), 'mono');
    if (m.srcKind === 'payout' || m.srcKind === 'payable') return lk('finanzas/proveedores', m.srcId, esc(m.srcId), 'mono');
    if (m.srcKind === 'count') return '<span class="mono">' + esc(m.srcId) + '</span>';
    if (m.transferId) return '<span class="mono">' + esc(m.transferId) + '</span>';
    if (m.replenishmentId && m.type === 'gasto_caja') return '<span class="xs faint">Rendido en ' + esc(m.replenishmentId) + '</span>';
    return '<span class="faint">Manual</span>';
  }
  function movTable(host, rowsFn, opts) {
    opts = opts || {};
    UI.dataTable(host, {
      rows: rowsFn, exportName: 'tesoreria_movimientos', defaultSort: 'date', defaultDir: -1, pageSize: opts.pageSize || 12, searchPlaceholder: 'Buscar descripción, referencia, origen…',
      search: m => [m.id, m.desc, m.ref, m.counterparty, m.srcId, m.transferId, m.category, acc(m.accountId).name].join(' '),
      toolbar: opts.toolbar || '',
      filters: [
        opts.noAcc ? null : { key: 'accountId', label: 'Cuenta', options: DB.treasuryAccounts.map(a => [a.id, a.name]) },
        { key: 'type', label: 'Tipo', options: Object.keys(MOV_TYPES).map(k => [k, MOV_TYPES[k]]) },
        { key: 'dir', label: 'Sentido', options: [['in', 'Ingreso'], ['out', 'Egreso']] },
        { key: 'status', label: 'Estado', options: [['registrado', 'Registrado'], ['anulado', 'Anulado']] }
      ].filter(Boolean),
      columns: [
        { key: 'date', label: 'Fecha', render: m => '<span class="nowrap">' + date(m.date) + '</span><div class="cell-sub mono">' + m.id + '</div>', sortVal: m => m.date + m.createdAt },
        { key: 'desc', label: 'Movimiento', render: m => '<div class="cell-main">' + esc(m.desc) + '</div><div class="cell-sub">' + esc(MOV_TYPES[m.type] || m.type) + (m.category ? ' · ' + esc(m.category) : '') + (m.ref ? ' · ' + esc(m.ref) : '') + '</div>', csv: m => m.desc },
        opts.noAcc ? null : { key: 'accountId', label: 'Cuenta', render: m => accLink(m.accountId), csv: m => acc(m.accountId).name },
        { key: 'src', label: 'Origen', sort: false, render: srcCell, csv: m => m.srcId || m.transferId || 'Manual' },
        { key: 'in', label: 'Ingreso', align: 'num', render: m => m.dir === 'in' ? '<span class="num nowrap tz-pos">' + money(m.amount, m.currency) + '</span>' + (m.orig ? '<div class="cell-sub">' + money(m.orig.amount, m.orig.currency) + ' · TC ' + fmtN(m.orig.fx, 3) + '</div>' : '') : '', sortVal: m => m.dir === 'in' ? m.amount : 0, csv: m => m.dir === 'in' ? m.amount.toFixed(2) : '' },
        { key: 'out', label: 'Egreso', align: 'num', render: m => m.dir === 'out' ? '<span class="num nowrap tz-neg">' + money(m.amount, m.currency) + '</span>' + (m.orig ? '<div class="cell-sub">' + money(m.orig.amount, m.orig.currency) + ' · TC ' + fmtN(m.orig.fx, 3) + '</div>' : '') : '', sortVal: m => m.dir === 'out' ? m.amount : 0, csv: m => m.dir === 'out' ? m.amount.toFixed(2) : '' },
        opts.running ? { key: 'run', label: 'Saldo', align: 'num', render: m => '<span class="num nowrap">' + (m.status === 'anulado' ? '—' : money(m._run, m.currency)) + '</span>', sort: false, csv: m => (m._run || 0).toFixed(2) } : null,
        { key: 'status', label: 'Estado', render: m => m.status === 'anulado' ? UI.badge('anulado') : UI.badge('aplicado', 'Registrado'), csv: m => m.status }
      ].filter(Boolean),
      onRow: m => movDrawer(m)
    });
  }
  function tabMovs(body) {
    body.innerHTML = '<div id="tz-mt" style="min-width:0"></div>';
    movTable(body.querySelector('#tz-mt'), movRows, { toolbar: P.oper() ? '<button class="btn sm" id="tz-exp">' + UI.icon('receipt') + 'Gasto de caja</button>' : '' });
    const b = body.querySelector('#tz-exp'); if (b) b.onclick = () => expenseModal();
  }

  function movDrawer(m) {
    const a = acc(m.accountId); const manual = ['manual', 'transfer', 'expense', 'gateway'].includes(m.srcKind);
    const canVoid = P.oper() && m.status !== 'anulado' && manual && !(m.type === 'gasto_caja' && m.replenishmentId);
    const why = m.status === 'anulado' ? '' : !manual ? 'Movimiento generado desde ' + esc(SRC_LABEL[m.srcKind] || 'otro módulo') + ': se corrige en el documento de origen (p. ej. reversión PROC-043), no en tesorería (TES-BR-03).' : m.type === 'gasto_caja' && m.replenishmentId ? 'El gasto ya forma parte de la reposición ' + esc(m.replenishmentId) + ' (TES-BR-10).' : !P.oper() ? 'Requiere permiso finance.payments.register.' : '';
    const bl = (DB.bankLines || []).find(b => b.match && (b.match === m.srcId));
    UI.drawer({
      title: esc(MOV_TYPES[m.type] || m.type), sub: '<span class="mono">' + m.id + '</span> · ' + date(m.date), wide: true,
      body: (m.status === 'anulado' ? UI.alert('bad', '<b>Movimiento anulado.</b> ' + esc(m.voidReason || '')) : '') +
        UI.dl([['Cuenta', accLink(m.accountId) + ' <span class="xs faint">' + esc(a.number || '') + '</span>'], ['Sentido', m.dir === 'in' ? 'Ingreso' : 'Egreso'], ['Monto', '<b class="num">' + money(m.amount, m.currency) + '</b>' + (m.fx && m.currency === 'USD' ? ' <span class="xs faint">TC ' + fmtN(m.fx, 3) + '</span>' : '')], m.orig ? ['Monto original', money(m.orig.amount, m.orig.currency) + ' · TC ' + fmtN(m.orig.fx, 3)] : null,
          ['Descripción', esc(m.desc)], ['Categoría', esc(m.category || '—')], ['Referencia', esc(m.ref || '—')], ['Contraparte', esc(m.counterparty || '—')], ['Origen', srcCell(m) + ' <span class="xs faint">' + esc(SRC_LABEL[m.srcKind] || '') + '</span>'], m.resId ? ['Reserva', resLink(m.resId)] : null,
          ['Conciliación bancaria', a.kind === 'banco' ? (bl ? UI.badge(bl.status) + ' <span class="mono xs">' + esc(bl.id) + '</span>' : '<span class="faint">Sin línea de extracto asociada</span>') : '<span class="faint">No aplica</span>'],
          ['Registrado por', esc(Q.userName(m.by)) + ' · ' + datetime(m.createdAt)]]) +
        (m.receipt ? '<div class="section-title" style="margin-top:14px">Comprobante</div>' + UI.dl([['Tipo', esc(m.receipt.type)], ['Número', '<span class="mono">' + esc(m.receipt.number || '—') + '</span>'], ['RUC emisor', esc(m.receipt.ruc || '—')], ['Proveedor', esc(m.receipt.supplier || '—')], ['Archivo', m.receipt.file ? '<span class="mono xs">' + esc(m.receipt.file) + '</span> <span class="xs faint">(S3 · URL firmada en producción)</span>' : '—']]) : '') +
        (why ? '<div style="margin-top:12px">' + UI.alert('info', why) + '</div>' : '') +
        '<div class="section-title" style="margin-top:14px">Auditoría</div>' + UI.timeline(DB.audit.filter(x => x.entityId === m.id || (m.transferId && x.entityId === m.transferId)).slice(0, 8).map(x => ({ title: esc(x.action), meta: datetime(x.ts) + ' · ' + esc(Q.userName(x.user)), desc: esc(x.after), icon: 'history' }))),
      actions: [{ label: 'Cerrar' }].concat(m.status !== 'anulado' && manual ? [{ label: 'Anular movimiento', cls: 'danger', icon: 'x', onClick: () => { if (!canVoid) { UI.toast(why || 'No se puede anular.', 'bad'); return false; } voidMov(m); return false; } }] : [])
    });
  }
  function voidMov(m) {
    UI.confirm({ title: 'Anular ' + m.id, message: 'El movimiento quedará anulado (no se elimina, Regla transversal 24)' + (m.transferId ? ' junto con las demás partidas de <b>' + esc(m.transferId) + '</b>' : '') + '. El saldo de la cuenta se recalcula.', confirmLabel: 'Anular', danger: true, reason: true, reasonLabel: 'Motivo de anulación',
      onConfirm: (why) => {
        const set = m.transferId ? DB.treasuryMovements.filter(x => x.transferId === m.transferId && x.status !== 'anulado') : [m];
        const back = set.find(x => x.dir === 'in' && x.accountId !== m.accountId && balance(x.accountId) - x.amount < -0.005 && !isCash(acc(x.accountId)));
        if (back) { UI.toast('No se puede anular: la cuenta ' + esc(acc(back.accountId).name) + ' quedaría con saldo negativo (TES-BR-02).', 'bad'); return; }
        set.forEach(x => { x.status = 'anulado'; x.voidReason = why; x.voidedBy = Auth.user.id; x.voidedAt = nowStr(); Audit.log('Movimiento de tesorería', x.id, 'anular', 'registrado', 'anulado · ' + why); });
        const rep = DB.cashReplenishments.find(r => r.transferId && r.transferId === m.transferId);
        if (rep) { rep.status = 'aprobada'; rep.transferId = null; rep.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Pago anulado: ' + why }); }
        Store.save(); UI.closeDrawer(); UI.toast('Movimiento anulado.', 'warn'); App.render();
      } });
  }

  function accOpts(filter) { return DB.treasuryAccounts.filter(a => a.status === 'activa' && (!filter || filter(a))).map(a => [a.id, a.name + ' (' + a.currency + ') · saldo ' + money(balance(a.id), a.currency)]); }

  function movModal(preAcc) {
    if (blockOper('registrar movimientos')) return;
    UI.modal({
      title: 'Registrar movimiento', sub: 'Ingresos y egresos no originados en cobros ni pagos a proveedores (gastos bancarios, tributos, planilla, intereses).',
      body: UI.form([
        { id: 'mv-acc', label: 'Cuenta', type: 'select', col: 12, required: true, options: accOpts(a => a.kind === 'banco'), value: preAcc || 'CTA-01' },
        { id: 'mv-dir', label: 'Sentido', type: 'select', col: 4, options: [['out', 'Egreso'], ['in', 'Ingreso']] },
        { id: 'mv-cat', label: 'Categoría', type: 'select', col: 8, options: MAN_CATS_OUT },
        { id: 'mv-date', label: 'Fecha', type: 'date', col: 4, required: true, value: TODAY(), max: TODAY() },
        { id: 'mv-amount', label: 'Monto (moneda de la cuenta)', type: 'number', col: 4, required: true, step: '0.01', min: 0 },
        { id: 'mv-ref', label: 'N° de operación / documento', col: 4, required: true },
        { id: 'mv-cp', label: 'Contraparte', col: 6 },
        { id: 'mv-desc', label: 'Descripción', col: 6, required: true }
      ]),
      onOpen: (m) => { m.querySelector('#mv-dir').onchange = (e) => { m.querySelector('#mv-cat').innerHTML = (e.target.value === 'in' ? MAN_CATS_IN : MAN_CATS_OUT).map(c => '<option>' + esc(c) + '</option>').join(''); }; },
      actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const a = acc(d['mv-acc']); const amt = r2(d['mv-amount']);
        if (!(amt > 0)) { UI.toast('El monto debe ser mayor que cero.', 'bad'); return false; }
        if (d['mv-date'] > TODAY()) { UI.toast('No se registran movimientos con fecha futura (TES-BR-01).', 'bad'); return false; }
        if (d['mv-dir'] === 'out' && amt > balance(a.id) + 0.005) { UI.toast('Saldo insuficiente en ' + esc(a.name) + ' (' + money(balance(a.id), a.currency) + '). TES-BR-02: las cuentas no operan en sobregiro.', 'bad'); return false; }
        const mv = newMov({ accountId: a.id, date: d['mv-date'], dir: d['mv-dir'], type: d['mv-dir'] === 'in' ? 'ingreso_otro' : 'egreso_otro', amount: amt, currency: a.currency, fx: a.currency === 'USD' ? FX() : null, category: d['mv-cat'], desc: d['mv-desc'], ref: d['mv-ref'], counterparty: d['mv-cp'], srcKind: 'manual', sede: a.sede });
        Audit.log('Movimiento de tesorería', mv.id, 'registrar', '', (mv.dir === 'in' ? 'Ingreso ' : 'Egreso ') + money(amt, a.currency) + ' · ' + a.name);
        Store.save(); UI.toast('Movimiento ' + mv.id + ' registrado. Saldo ' + esc(a.name) + ': ' + money(balance(a.id), a.currency) + '.'); App.render();
      } }]
    });
  }

  function transferModal(pre) {
    if (blockOper('registrar transferencias')) return;
    pre = pre || {};
    UI.modal({
      title: 'Transferencia entre cuentas', sub: 'Genera una salida y una entrada enlazadas (TRF). Entre monedas distintas se registra el TC pactado.',
      body: UI.form([
        { id: 'tf-from', label: 'Cuenta de origen', type: 'select', col: 6, required: true, options: accOpts(a => a.kind !== 'pasarela'), value: pre.from || 'CTA-01' },
        { id: 'tf-to', label: 'Cuenta de destino', type: 'select', col: 6, required: true, options: accOpts(a => a.kind !== 'pasarela'), value: pre.to || 'CTA-03' },
        { id: 'tf-amount', label: 'Monto a debitar (moneda origen)', type: 'number', col: 4, required: true, step: '0.01', min: 0, value: pre.amount || '' },
        { id: 'tf-fx', label: 'TC pactado (si cambia de moneda)', type: 'number', col: 4, step: '0.001', value: FX() },
        { id: 'tf-date', label: 'Fecha', type: 'date', col: 4, required: true, value: TODAY(), max: TODAY() },
        { id: 'tf-ref', label: 'N° de operación', col: 6, required: true },
        { id: 'tf-desc', label: 'Descripción', col: 6, required: true, value: pre.desc || '' },
        { type: 'html', col: 12, html: '<div id="tf-prev" class="small muted"></div>' }
      ]),
      onOpen: (m) => {
        const upd = () => { const f = acc(m.querySelector('#tf-from').value), t = acc(m.querySelector('#tf-to').value); const amt = +m.querySelector('#tf-amount').value || 0; const fx = +m.querySelector('#tf-fx').value || FX(); const dest = f.currency === t.currency ? amt : f.currency === 'USD' ? amt * fx : amt / fx; m.querySelector('#tf-fx').disabled = f.currency === t.currency; m.querySelector('#tf-prev').innerHTML = 'Se debitará <b>' + money(amt, f.currency) + '</b> de ' + esc(f.name) + ' y se acreditará <b>' + money(dest, t.currency) + '</b> en ' + esc(t.name) + (isCash(f) && t.kind === 'banco' ? ' (depósito de efectivo).' : '.'); };
        m.querySelectorAll('select,input').forEach(x => x.addEventListener('input', upd)); upd();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Transferir', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const f = acc(d['tf-from']), t = acc(d['tf-to']); const amt = r2(d['tf-amount']); const fx = +d['tf-fx'] || FX();
        if (f.id === t.id) { UI.toast('Origen y destino deben ser cuentas distintas.', 'bad'); return false; }
        if (!(amt > 0)) { UI.toast('El monto debe ser mayor que cero.', 'bad'); return false; }
        if (amt > balance(f.id) + 0.005) { UI.toast('Saldo insuficiente en ' + esc(f.name) + ' (' + money(balance(f.id), f.currency) + '). TES-BR-02.', 'bad'); return false; }
        if (isCash(t) && !sessionToday(t.id)) { UI.toast('La caja destino no está aperturada hoy (TES-BR-05).', 'bad'); return false; }
        const dest = r2(f.currency === t.currency ? amt : f.currency === 'USD' ? amt * fx : amt / fx);
        const id = nextId(DB.treasuryMovements.filter(x => x.transferId).map(x => ({ id: x.transferId })), 'TRF-', 4);
        const type = isCash(t) && pre.rep ? 'reposicion' : 'transferencia';
        const o = newMov({ accountId: f.id, date: d['tf-date'], dir: 'out', type, amount: amt, currency: f.currency, fx: f.currency === 'USD' ? (f.currency !== t.currency ? fx : FX()) : null, srcKind: 'transfer', transferId: id, desc: d['tf-desc'], ref: d['tf-ref'], counterparty: t.name, sede: f.sede });
        const i = newMov({ accountId: t.id, date: d['tf-date'], dir: 'in', type, amount: dest, currency: t.currency, fx: t.currency === 'USD' ? (f.currency !== t.currency ? fx : FX()) : null, srcKind: 'transfer', transferId: id, desc: d['tf-desc'], ref: d['tf-ref'], counterparty: f.name, sede: t.sede });
        if (isCash(f) && t.kind === 'banco') live().filter(x => x.accountId === f.id && x.type === 'ingreso' && !x.depositedBy).forEach(x => { x.depositedBy = id; });
        Audit.log('Transferencia', id, 'registrar', f.name + ' ' + money(amt, f.currency), t.name + ' ' + money(dest, t.currency) + (f.currency !== t.currency ? ' · TC ' + fx : ''));
        Store.save(); UI.toast('Transferencia ' + id + ' registrada (' + o.id + ' / ' + i.id + ').'); pre.done ? pre.done(id) : App.render();
      } }]
    });
  }

  function settleModal(a) {
    if (blockOper('liquidar la pasarela')) return;
    const b = balance(a.id); if (b <= 0.005) { UI.toast('No hay importes en tránsito por liquidar.', 'info'); return; }
    const pct = DB.treasurySettings.gatewayFeePct;
    UI.modal({ title: 'Liquidar ' + esc(a.name), size: 'sm', sub: 'El procesador abona el neto al banco y descuenta su comisión.',
      body: UI.form([{ id: 'st-gross', label: 'Monto bruto del lote (' + a.currency + ')', type: 'number', col: 12, required: true, step: '0.01', value: b, max: b }, { id: 'st-pct', label: 'Comisión %', type: 'number', col: 6, step: '0.01', value: pct }, { id: 'st-date', label: 'Fecha de abono', type: 'date', col: 6, required: true, value: TODAY(), max: TODAY() }, { id: 'st-ref', label: 'Lote / referencia', col: 12, required: true, value: 'LIQ-' + TODAY().slice(5).replace('-', '') }, { type: 'html', col: 12, html: '<div id="st-prev" class="small muted"></div>' }]),
      onOpen: (m) => { const u = () => { const g = +m.querySelector('#st-gross').value || 0, p = +m.querySelector('#st-pct').value || 0; const fee = r2(g * p / 100); m.querySelector('#st-prev').innerHTML = 'Comisión ' + money(fee, a.currency) + ' · neto a ' + esc(acc(a.settleTo).name) + ': <b>' + money(g - fee, a.currency) + '</b>'; }; m.querySelectorAll('input').forEach(x => x.addEventListener('input', u)); u(); },
      actions: [{ label: 'Cancelar' }, { label: 'Registrar liquidación', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const g = r2(d['st-gross']); const fee = r2(g * (+d['st-pct'] || 0) / 100);
        if (!(g > 0) || g > b + 0.005) { UI.toast('El bruto debe ser mayor que cero y no exceder lo que está en tránsito (' + money(b, a.currency) + ').', 'bad'); return false; }
        const id = nextId(DB.treasuryMovements.filter(x => x.transferId).map(x => ({ id: x.transferId })), 'TRF-', 4); const to = acc(a.settleTo); const fx = a.currency === 'USD' ? FX() : null;
        newMov({ accountId: a.id, date: d['st-date'], dir: 'out', type: 'liquidacion_pasarela', amount: r2(g - fee), currency: a.currency, fx, srcKind: 'transfer', transferId: id, desc: 'Liquidación pasarela — ' + d['st-ref'] + ' (neto)', ref: d['st-ref'], counterparty: to.name });
        newMov({ accountId: to.id, date: d['st-date'], dir: 'in', type: 'liquidacion_pasarela', amount: r2(g - fee), currency: to.currency, fx, srcKind: 'transfer', transferId: id, desc: 'Liquidación pasarela — ' + d['st-ref'] + ' (neto)', ref: d['st-ref'], counterparty: a.name });
        if (fee > 0) newMov({ accountId: a.id, date: d['st-date'], dir: 'out', type: 'comision_pasarela', amount: fee, currency: a.currency, fx, srcKind: 'gateway', transferId: id, category: 'Gastos bancarios / ITF', desc: 'Comisión pasarela ' + d['st-pct'] + ' % — ' + d['st-ref'], ref: d['st-ref'], counterparty: 'Procesador de pagos' });
        Audit.log('Transferencia', id, 'liquidar_pasarela', money(g, a.currency) + ' bruto', money(g - fee, a.currency) + ' neto · comisión ' + money(fee, a.currency));
        Store.save(); UI.toast('Liquidación ' + id + ' registrada.'); App.render();
      } }] });
  }

  /* ---------------- Cajas chicas: apertura, gastos, arqueos, cierre, reposición ---------------- */
  function tabCajas(body) {
    const cajas = DB.treasuryAccounts.filter(a => a.kind === 'caja');
    body.innerHTML = '<div class="grid g3">' + cajas.map(a => {
      const b = balance(a.id); const pct = b / a.fund * 100; const s = sessionToday(a.id); const pend = live().filter(m => m.accountId === a.id && m.type === 'gasto_caja' && !m.replenishmentId);
      const st = s ? (s.status === 'abierta' ? UI.badge('abierta', 'Abierta ' + s.openedAt) : UI.badge('cerrada', 'Cerrada ' + (s.closedAt || ''))) : UI.badge('pendiente', 'Sin aperturar hoy');
      const o = P.oper(); const t = needTip('finance.payments.register');
      return '<div class="tz-box"><div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div style="min-width:0"><h3>' + esc(a.name) + '</h3><div class="xs faint">' + esc(Q.sedeName(a.sede)) + ' · custodia ' + esc(Q.userName(a.custodian)) + '</div></div>' + st + '</div>' +
        '<div class="row between"><span class="small muted">Saldo / fondo fijo</span><b class="num">' + money(b) + ' <span class="faint" style="font-weight:400">/ ' + money(a.fund, 'PEN', 0) + '</span></b></div>' + UI.progress(pct, pct < DB.treasurySettings.replenishPct ? 'bad' : pct < 60 ? 'warn' : 'ok') +
        '<div class="xs faint">' + pend.length + ' gasto(s) por rendir · ' + money(sum(pend, 'amount')) + '</div>' +
        '<div class="acts">' + (!s || s.status === 'cerrada' ? '<button class="btn xs primary" data-open="' + a.id + '"' + (o ? '' : t) + '>' + UI.icon('lock') + 'Aperturar</button>' : '<button class="btn xs" data-exp="' + a.id + '"' + (o ? '' : t) + '>' + UI.icon('receipt') + 'Gasto</button><button class="btn xs" data-count="' + a.id + '"' + (o ? '' : t) + '>' + UI.icon('coins') + 'Arqueo</button><button class="btn xs primary" data-close="' + a.id + '"' + (o ? '' : t) + '>' + UI.icon('lock') + 'Cerrar caja</button>') +
        '<button class="btn xs" data-rep="' + a.id + '"' + (o ? '' : t) + '>' + UI.icon('refresh') + 'Reposición</button><a class="btn xs ghost" href="#/finanzas/tesoreria/cuenta/' + a.id + '">Detalle</a></div></div>';
    }).join('') + '</div>' +
      '<div style="height:16px"></div><div id="tz-cnt" style="min-width:0"></div><div style="height:16px"></div><div id="tz-rep" style="min-width:0"></div><div style="height:16px"></div><div id="tz-ses" style="min-width:0"></div>';
    body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCash(acc(b.dataset.open)));
    body.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => expenseModal(b.dataset.exp));
    body.querySelectorAll('[data-count]').forEach(b => b.onclick = () => countModal(acc(b.dataset.count), 'arqueo'));
    body.querySelectorAll('[data-close]').forEach(b => b.onclick = () => countModal(acc(b.dataset.close), 'cierre'));
    body.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => requestRep(acc(b.dataset.rep)));
    const RES = { cuadrado: ['conciliado', 'Cuadrado'], sobrante: ['advertencia', 'Sobrante'], faltante: ['error', 'Faltante'] };
    const CST = { firmado: ['confirmado', 'Firmado'], pendiente_aprobacion: ['pendiente', 'Pend. aprobación'], aprobado: ['aprobada', 'Aprobado'], validado: ['conciliado', 'Validado contab.'] };
    UI.dataTable(body.querySelector('#tz-cnt'), {
      rows: () => DB.cashCounts, exportName: 'arqueos', defaultSort: 'ts', defaultDir: -1, pageSize: 6, searchPlaceholder: 'Buscar arqueo…', search: c => [c.id, acc(c.accountId).name, c.note].join(' '),
      toolbar: '<b class="small" style="margin-right:6px">Arqueos de caja</b>',
      filters: [{ key: 'accountId', label: 'Caja', options: cajas.map(a => [a.id, a.name]) }, { key: 'status', label: 'Estado', options: Object.keys(CST).map(k => [k, CST[k][1]]) }],
      columns: [
        { key: 'ts', label: 'Fecha', render: c => '<span class="nowrap">' + datetime(c.ts) + '</span><div class="cell-sub mono">' + c.id + '</div>' },
        { key: 'accountId', label: 'Caja', render: c => esc(acc(c.accountId).name) + '<div class="cell-sub">' + (c.kind === 'cierre' ? 'Cierre diario' : 'Arqueo sorpresa') + '</div>', csv: c => acc(c.accountId).name },
        { key: 'expected', label: 'Sistema', align: 'num', render: c => '<span class="num">' + fmtN(c.expected) + '</span>' },
        { key: 'counted', label: 'Contado', align: 'num', render: c => '<span class="num">' + fmtN(c.counted) + '</span>' },
        { key: 'diff', label: 'Diferencia', align: 'num', render: c => signed(c.diff) + '<div>' + UI.badge(RES[c.result][0], RES[c.result][1]) + '</div>', csv: c => c.diff.toFixed(2) },
        { key: 'signedBy', label: 'Firma', render: c => '<span class="small">' + esc(Q.userName(c.signedBy)) + '</span>' + (c.witness ? '<div class="cell-sub">Testigo: ' + esc(Q.userName(c.witness)) + '</div>' : ''), csv: c => Q.userName(c.signedBy) },
        { key: 'status', label: 'Estado', render: c => UI.badge(CST[c.status][0], CST[c.status][1]), csv: c => CST[c.status][1] },
        { key: 'act', label: '', sort: false, csv: () => '', render: c => '<span class="row" style="gap:4px;flex-wrap:nowrap">' + (c.status === 'pendiente_aprobacion' ? '<button class="btn xs primary" data-appr="' + c.id + '"' + (P.appr() ? '' : needTip('finance.profitability')) + '>Aprobar</button>' : '') + (['firmado', 'aprobado'].includes(c.status) ? '<button class="btn xs" data-val="' + c.id + '"' + (P.acct() ? '' : needTip('finance.invoicing')) + '>Validar</button>' : '') + '</span>' }
      ],
      onRow: c => countDoc(c),
      afterDraw: (cont) => {
        cont.querySelectorAll('[data-appr]').forEach(b => b.onclick = (e) => { e.stopPropagation(); approveCount(DB.cashCounts.find(x => x.id === b.dataset.appr)); });
        cont.querySelectorAll('[data-val]').forEach(b => b.onclick = (e) => { e.stopPropagation(); validateCount(DB.cashCounts.find(x => x.id === b.dataset.val)); });
      }
    });
    const RST = { solicitada: ['pendiente', 'Solicitada'], aprobada: ['aprobada', 'Aprobada'], pagada: ['pagada', 'Pagada'], rechazada: ['rechazada', 'Rechazada'] };
    UI.dataTable(body.querySelector('#tz-rep'), {
      rows: () => DB.cashReplenishments, exportName: 'reposiciones_caja', defaultSort: 'requestedAt', defaultDir: -1, pageSize: 5, searchPlaceholder: 'Buscar reposición…', search: r => [r.id, acc(r.accountId).name, r.note].join(' '),
      toolbar: '<b class="small" style="margin-right:6px">Reposiciones de caja chica</b>',
      columns: [
        { key: 'id', label: 'Reposición', render: r => '<span class="mono">' + r.id + '</span><div class="cell-sub">' + datetime(r.requestedAt) + '</div>' },
        { key: 'accountId', label: 'Caja', render: r => esc(acc(r.accountId).name) + '<div class="cell-sub">' + r.movIds.length + ' comprobante(s)</div>', csv: r => acc(r.accountId).name },
        { key: 'amount', label: 'Monto', align: 'num', render: r => '<span class="num">' + money(r.amount) + '</span>' },
        { key: 'requestedBy', label: 'Solicita', render: r => '<span class="small">' + esc(Q.userName(r.requestedBy)) + '</span>', csv: r => Q.userName(r.requestedBy) },
        { key: 'status', label: 'Estado', render: r => UI.badge(RST[r.status][0], RST[r.status][1]) + (r.approvedBy ? '<div class="cell-sub">Aprobó ' + esc(Q.userName(r.approvedBy)) + '</div>' : ''), csv: r => r.status },
        { key: 'act', label: '', sort: false, csv: () => '', render: r => '<span class="row" style="gap:4px;flex-wrap:nowrap">' + (r.status === 'solicitada' ? '<button class="btn xs primary" data-rapp="' + r.id + '"' + (P.appr() ? '' : needTip('finance.profitability')) + '>Aprobar</button><button class="btn xs" data-rrej="' + r.id + '"' + (P.appr() ? '' : needTip('finance.profitability')) + '>Rechazar</button>' : '') + (r.status === 'aprobada' ? '<button class="btn xs primary" data-rpay="' + r.id + '"' + (P.oper() ? '' : needTip('finance.payments.register')) + '>Pagar</button>' : '') + '</span>' }
      ],
      onRow: r => repDrawer(r),
      afterDraw: (cont) => {
        const f = (id) => DB.cashReplenishments.find(x => x.id === id);
        cont.querySelectorAll('[data-rapp]').forEach(b => b.onclick = (e) => { e.stopPropagation(); approveRep(f(b.dataset.rapp)); });
        cont.querySelectorAll('[data-rrej]').forEach(b => b.onclick = (e) => { e.stopPropagation(); rejectRep(f(b.dataset.rrej)); });
        cont.querySelectorAll('[data-rpay]').forEach(b => b.onclick = (e) => { e.stopPropagation(); payRep(f(b.dataset.rpay)); });
      }
    });
    UI.dataTable(body.querySelector('#tz-ses'), {
      rows: () => DB.cashSessions, exportName: 'sesiones_caja', defaultSort: 'date', defaultDir: -1, pageSize: 6, searchPlaceholder: 'Buscar sesión…', search: s => [s.id, acc(s.accountId).name].join(' '),
      toolbar: '<b class="small" style="margin-right:6px">Apertura y cierre diario</b>',
      columns: [
        { key: 'date', label: 'Fecha', render: s => date(s.date) + '<div class="cell-sub mono">' + s.id + '</div>', sortVal: s => s.date + s.openedAt },
        { key: 'accountId', label: 'Caja', render: s => esc(acc(s.accountId).name), csv: s => acc(s.accountId).name },
        { key: 'openedAt', label: 'Apertura', render: s => s.openedAt + ' · ' + esc(Q.userName(s.openedBy).split(' ')[0]) + '<div class="cell-sub">' + money(s.openingAmount) + '</div>' },
        { key: 'closedAt', label: 'Cierre', render: s => s.closedAt ? s.closedAt + ' · ' + esc(Q.userName(s.closedBy).split(' ')[0]) + '<div class="cell-sub mono">' + esc(s.closingCountId) + '</div>' : '<span class="faint">—</span>' },
        { key: 'status', label: 'Estado', render: s => UI.badge(s.status) }
      ]
    });
  }

  function openCash(a) {
    if (blockOper('aperturar cajas')) return;
    const last = lastSession(a.id);
    if (last && last.status === 'abierta') { UI.toast('La sesión ' + last.id + ' del ' + date(last.date) + ' sigue abierta: ciérrela con arqueo antes de aperturar (TES-BR-06).', 'bad'); return; }
    const exp = balance(a.id);
    UI.modal({ title: 'Aperturar ' + esc(a.name), size: 'sm', sub: date(TODAY()) + ' · saldo del último cierre ' + money(exp),
      body: UI.form([{ id: 'op-amt', label: 'Efectivo contado al abrir (S/)', type: 'number', col: 12, required: true, step: '0.10', value: exp }, { id: 'op-note', label: 'Observación', col: 12 }]) + '<p class="xs faint" style="margin-top:8px">Si el conteo difiere del saldo de cierre, registre primero un arqueo con la diferencia (TES-BR-07).</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Aperturar caja', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const amt = r2(d['op-amt']);
        if (Math.abs(amt - exp) > 0.005) { UI.toast('El conteo (' + money(amt) + ') no coincide con el saldo de cierre (' + money(exp) + '). Registre un arqueo con la diferencia (TES-BR-07).', 'bad'); return false; }
        const s = { id: nextId(DB.cashSessions, 'CJS-', 4), accountId: a.id, sede: a.sede, date: TODAY(), openedAt: nowStr().slice(11), openedBy: Auth.user.id, openingAmount: amt, note: d['op-note'], status: 'abierta' };
        DB.cashSessions.push(s); Audit.log('Caja', s.id, 'aperturar', '', a.name + ' · ' + money(amt)); Store.save(); UI.toast(esc(a.name) + ' aperturada.'); App.render();
      } }] });
  }

  function expenseModal(accId) {
    if (blockOper('registrar gastos de caja chica')) return;
    const st = DB.treasurySettings;
    const resOpts = DB.reservations.filter(r => !['cancelada', 'borrador'].includes(r.status)).map(r => [r.id, r.id + ' · ' + r.title]);
    UI.modal({ title: 'Registrar gasto de caja chica', sub: 'Todo gasto requiere comprobante de pago. Máximo ' + money(st.maxExpense, 'PEN', 0) + ' por gasto; declaración jurada hasta ' + money(st.djMax, 'PEN', 0) + '.',
      body: UI.form([
        { id: 'gx-acc', label: 'Caja', type: 'select', col: 6, required: true, options: accOpts(isCash), value: accId || (cashOfSede(Auth.user.sede) || {}).id },
        { id: 'gx-cat', label: 'Categoría', type: 'select', col: 6, options: EXP_CATS },
        { id: 'gx-desc', label: 'Descripción del gasto', col: 8, required: true },
        { id: 'gx-amount', label: 'Monto (S/)', type: 'number', col: 4, required: true, step: '0.10', min: 0 },
        { type: 'section', label: 'Comprobante' },
        { id: 'gx-rtype', label: 'Tipo de comprobante', type: 'select', col: 4, options: RECEIPTS },
        { id: 'gx-rnum', label: 'Serie y número', col: 4, placeholder: 'F001-000123' },
        { id: 'gx-ruc', label: 'RUC del emisor', col: 4, placeholder: '11 dígitos' },
        { id: 'gx-sup', label: 'Proveedor / beneficiario', col: 6, required: true },
        { id: 'gx-res', label: 'Reserva (costo imputable)', type: 'select', col: 6, placeholder: 'Sin reserva', options: resOpts },
        { type: 'html', col: 12, html: '<div class="field"><label for="gx-file">Archivo del comprobante</label><input class="input" type="file" id="gx-file" accept=".pdf,.jpg,.png"><div class="hint">PDF o foto. En producción se sube a S3 (tenants/{tenant}/treasury/…).</div></div>' }
      ]),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar gasto', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const a = acc(d['gx-acc']); const amt = r2(d['gx-amount']); const rt = d['gx-rtype'];
        const fileEl = m.querySelector('#gx-file'); const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0].name : '';
        if (!sessionToday(a.id) || sessionToday(a.id).status !== 'abierta') { UI.toast(esc(a.name) + ' no está aperturada hoy. TES-BR-05: no se registran gastos con la caja cerrada.', 'bad'); return false; }
        if (!(amt > 0)) { UI.toast('El monto debe ser mayor que cero.', 'bad'); return false; }
        if (amt > st.maxExpense) { UI.toast('TES-BR-11: gastos mayores a ' + money(st.maxExpense, 'PEN', 0) + ' se pagan por tesorería (cuenta por pagar), no por caja chica.', 'bad'); return false; }
        if (amt > balance(a.id) + 0.005) { UI.toast('Saldo insuficiente en ' + esc(a.name) + ' (' + money(balance(a.id)) + '). Solicite reposición.', 'bad'); return false; }
        if (rt === 'Declaración jurada' && amt > st.djMax) { UI.toast('TES-BR-12: la declaración jurada solo sustenta gastos hasta ' + money(st.djMax, 'PEN', 0) + '.', 'bad'); return false; }
        if (!['Declaración jurada', 'Planilla de movilidad'].includes(rt) && !d['gx-rnum']) { UI.toast('Indique la serie y número del comprobante (TES-BR-12).', 'bad'); m.querySelector('#gx-rnum').classList.add('err'); return false; }
        if (['Factura', 'Recibo por honorarios'].includes(rt) && !/^\d{11}$/.test(d['gx-ruc'])) { UI.toast('La ' + rt.toLowerCase() + ' requiere RUC del emisor de 11 dígitos.', 'bad'); m.querySelector('#gx-ruc').classList.add('err'); return false; }
        const mv = newMov({ accountId: a.id, date: TODAY(), dir: 'out', type: 'gasto_caja', amount: amt, currency: 'PEN', category: d['gx-cat'], desc: d['gx-desc'], ref: rt + (d['gx-rnum'] ? ' ' + d['gx-rnum'] : ''), counterparty: d['gx-sup'], srcKind: 'expense', receipt: { type: rt, number: d['gx-rnum'], ruc: d['gx-ruc'], supplier: d['gx-sup'], file }, replenishmentId: null, resId: d['gx-res'] || null, sede: a.sede });
        Audit.log('Movimiento de tesorería', mv.id, 'gasto_caja', '', money(amt) + ' · ' + a.name + ' · ' + mv.ref);
        const b = balance(a.id);
        if (b / a.fund * 100 < st.replenishPct) Notify.push('caja.umbral', 'Portal', 'U07', a.name + ' al ' + fmtN(b / a.fund * 100, 0) + ' % del fondo: solicitar reposición');
        Store.save(); UI.toast('Gasto ' + mv.id + ' registrado. Saldo de ' + esc(a.name) + ': ' + money(b) + '.'); App.render();
      } }] });
  }

  function countModal(a, kind) {
    if (blockOper(kind === 'cierre' ? 'cerrar cajas' : 'registrar arqueos')) return;
    const s = sessionToday(a.id);
    if (kind === 'cierre' && (!s || s.status !== 'abierta')) { UI.toast('La caja no tiene una sesión abierta hoy.', 'bad'); return; }
    const exp = balance(a.id); const tol = DB.treasurySettings.tolerance;
    const witnesses = DB.users.filter(u => u.status === 'activo' && u.id !== Auth.user.id && ['tenant_admin', 'manager', 'finance', 'accounting', 'operations', 'sales'].includes(u.role) && u.sede === a.sede || ['U08', 'U02'].includes(u.id) && u.id !== Auth.user.id);
    UI.modal({ title: (kind === 'cierre' ? 'Cierre de caja con arqueo · ' : 'Arqueo sorpresa · ') + esc(a.name), size: 'lg', sub: date(TODAY()) + ' · conteo por denominación (soles)',
      body: '<div class="grid g2" style="align-items:start"><div class="tbl-wrap"><table class="tz-den"><thead><tr><th>Denominación</th><th class="num">Cantidad</th><th class="num">Subtotal</th></tr></thead><tbody>' +
        DENOMS.map(([d, t]) => '<tr><td>' + t + ' S/ ' + fmtN(d, d < 1 ? 2 : 0) + '</td><td class="num"><input class="input sm" type="number" min="0" step="1" data-den="' + d + '" aria-label="Cantidad de ' + t + ' de S/ ' + d + '" value="0"></td><td class="num" data-sub="' + d + '">0.00</td></tr>').join('') + '</tbody></table></div>' +
        '<div><div class="tz-sum"><div><span>Contado</span><b id="ac-cnt">S/ 0.00</b></div><div><span>Saldo sistema</span><b>' + money(exp) + '</b></div><div><span>Diferencia</span><b id="ac-diff">—</b></div></div>' +
        '<div id="ac-msg" style="margin-top:12px"></div>' +
        UI.form([{ id: 'ac-note', label: 'Observación / justificación', type: 'textarea', rows: 3, col: 12 }, { id: 'ac-wit', label: 'Testigo del arqueo', type: 'select', col: 12, placeholder: 'Sin testigo', options: witnesses.map(u => [u.id, u.name + ' · ' + Q.roleName(u.role)]) }, { id: 'ac-sign', label: 'Declaro que el conteo es correcto y firmo el acta como responsable (' + Auth.user.name + ')', type: 'checkbox', col: 12 }]) +
        '<button class="btn xs ghost" id="ac-fill" type="button" style="margin-top:8px">Cargar conteo igual al saldo (demo)</button></div></div>',
      onOpen: (m) => {
        const upd = () => { let t = 0; m.querySelectorAll('[data-den]').forEach(i => { const v = Math.max(0, Math.floor(+i.value || 0)) * +i.dataset.den; t += v; m.querySelector('[data-sub="' + i.dataset.den + '"]').textContent = fmtN(v); }); t = r2(t); const diff = r2(t - exp); m.querySelector('#ac-cnt').textContent = money(t); m.querySelector('#ac-diff').innerHTML = signed(diff); m.querySelector('#ac-msg').innerHTML = diff === 0 ? UI.alert('ok', 'Caja cuadrada.') : Math.abs(diff) <= tol ? UI.alert('warn', (diff > 0 ? 'Sobrante' : 'Faltante') + ' dentro de la tolerancia (' + money(tol) + '): se registra el ajuste al firmar. Justifique la diferencia.') : UI.alert('bad', (diff > 0 ? 'Sobrante' : 'Faltante') + ' mayor a la tolerancia (' + money(tol) + '): el acta queda pendiente de aprobación de gerencia (TES-BR-13).'); return { t, diff }; };
        m.querySelectorAll('[data-den]').forEach(i => i.addEventListener('input', upd)); upd();
        m.querySelector('#ac-fill').onclick = () => { const bd = breakdown(exp); m.querySelectorAll('[data-den]').forEach(i => { i.value = bd[i.dataset.den] || 0; }); upd(); };
        m._upd = upd;
      },
      actions: [{ label: 'Cancelar' }, { label: kind === 'cierre' ? 'Firmar y cerrar caja' : 'Firmar arqueo', cls: 'primary', onClick: (m) => {
        const { t, diff } = m._upd(); const d = UI.formData(m);
        if (t <= 0 && exp > 0) { UI.toast('Registre las cantidades contadas por denominación.', 'bad'); return false; }
        if (diff !== 0 && !d['ac-note']) { UI.toast('Justifique la diferencia en la observación.', 'bad'); m.querySelector('#ac-note').classList.add('err'); return false; }
        if (!d['ac-sign']) { UI.toast('Debe firmar el acta (declaración del responsable).', 'bad'); return false; }
        const denoms = {}; m.querySelectorAll('[data-den]').forEach(i => { denoms[i.dataset.den] = Math.max(0, Math.floor(+i.value || 0)); });
        const over = Math.abs(diff) > tol;
        const c = { id: nextId(DB.cashCounts, 'ARQ-', 4), accountId: a.id, sede: a.sede, date: TODAY(), ts: nowStr(), kind, denoms, counted: t, expected: exp, diff, result: diff === 0 ? 'cuadrado' : diff > 0 ? 'sobrante' : 'faltante', note: d['ac-note'], signedBy: Auth.user.id, signedAt: nowStr(), witness: d['ac-wit'] || null, status: over ? 'pendiente_aprobacion' : 'firmado', sessionId: s ? s.id : null };
        DB.cashCounts.unshift(c);
        if (diff !== 0 && !over) adjust(c);
        if (over) Notify.push('arqueo.diferencia', 'Portal', 'U02', 'Arqueo ' + c.id + ' — ' + a.name + ': diferencia ' + money(diff) + ' requiere aprobación');
        if (kind === 'cierre') { s.closedAt = nowStr().slice(11); s.closedBy = Auth.user.id; s.closingCountId = c.id; s.status = 'cerrada'; Audit.log('Caja', s.id, 'cerrar', 'abierta', 'cerrada · ' + c.id); }
        Audit.log('Arqueo', c.id, kind === 'cierre' ? 'arqueo_cierre' : 'arqueo', money(exp), money(t) + ' · ' + c.result + ' ' + money(diff));
        Store.save(); UI.toast('Acta ' + c.id + ' firmada' + (kind === 'cierre' ? ' y caja cerrada' : '') + '. ' + (diff === 0 ? 'Caja cuadrada.' : over ? 'Pendiente de aprobación.' : 'Ajuste registrado.'), diff === 0 ? 'ok' : 'warn'); App.render();
      } }] });
  }
  function adjust(c) {
    const m = newMov({ accountId: c.accountId, date: c.date, dir: c.diff > 0 ? 'in' : 'out', type: 'ajuste_arqueo', amount: Math.abs(c.diff), currency: 'PEN', srcKind: 'count', srcId: c.id, category: 'Ajuste de caja', desc: (c.diff > 0 ? 'Sobrante' : 'Faltante') + ' de arqueo ' + c.id + (c.diff < 0 ? ' (cargo a custodia)' : ''), ref: c.id, sede: c.sede });
    c.adjustmentMovId = m.id;
  }
  function approveCount(c) {
    if (!P.appr()) { UI.toast('Aprobar diferencias de arqueo requiere <span class="mono">finance.profitability</span> + <span class="mono">approvals.view</span>.', 'bad'); return; }
    if (c.signedBy === Auth.user.id) { UI.toast('TES-BR-14: quien firma el arqueo no puede aprobar su propia diferencia (segregación de funciones).', 'bad'); return; }
    UI.confirm({ title: 'Aprobar diferencia ' + c.id, message: 'Se registrará el ajuste de ' + signed(c.diff) + ' en ' + esc(acc(c.accountId).name) + '. Justificación: <i>' + esc(c.note) + '</i>', confirmLabel: 'Aprobar y ajustar', reason: true, reasonLabel: 'Comentario de aprobación',
      onConfirm: (why) => { adjust(c); c.status = 'aprobado'; c.approvedBy = Auth.user.id; c.approvedAt = nowStr(); c.approveNote = why; Audit.log('Arqueo', c.id, 'aprobar_diferencia', 'pendiente_aprobacion', 'aprobado · ' + money(c.diff) + ' · ' + why); Notify.push('arqueo.aprobado', 'Portal', c.signedBy, 'Diferencia del arqueo ' + c.id + ' aprobada'); Store.save(); UI.toast('Diferencia aprobada y ajuste registrado.'); App.render(); } });
  }
  function validateCount(c) {
    if (!P.acct()) { UI.toast('La validación contable requiere <span class="mono">finance.invoicing</span>.', 'bad'); return; }
    c.status = 'validado'; c.validatedBy = Auth.user.id; c.validatedAt = nowStr(); Audit.log('Arqueo', c.id, 'validar_contable', 'firmado', 'validado'); Store.save(); UI.toast('Arqueo ' + c.id + ' validado por contabilidad.'); App.render();
  }
  function countDoc(c) {
    const a = acc(c.accountId);
    UI.modal({ title: 'Acta de arqueo ' + c.id, size: 'lg', sub: 'Vista del documento. En producción se genera PDF por job (cola documents) y se guarda en sys_documents con hash.',
      body: '<div class="doc"><div class="doc-head"><div><h2>' + esc(DB.tenant.name) + '</h2><div class="muted">RUC ' + esc(DB.tenant.ruc) + ' · ' + esc(Q.sedeName(a.sede)) + '</div></div><div style="text-align:right"><h3>ACTA DE ARQUEO DE CAJA</h3><div style="font-family:var(--f-mono)">' + c.id + '</div><div class="muted">' + (c.kind === 'cierre' ? 'Cierre diario' : 'Arqueo sorpresa') + ' · ' + datetime(c.ts) + '</div></div></div>' +
        '<p><b>Caja:</b> ' + esc(a.name) + ' · <b>Fondo fijo:</b> ' + money(a.fund) + ' · <b>Custodia:</b> ' + esc(Q.userName(a.custodian)) + '</p>' +
        '<table><thead><tr><th>Denominación</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Subtotal S/</th></tr></thead><tbody>' + DENOMS.filter(([d]) => c.denoms[d]).map(([d, t]) => '<tr><td>' + t + ' S/ ' + fmtN(d, d < 1 ? 2 : 0) + '</td><td style="text-align:right">' + c.denoms[d] + '</td><td style="text-align:right">' + fmtN(c.denoms[d] * d) + '</td></tr>').join('') + '</tbody></table>' +
        '<table class="tot"><tbody><tr><td>Total contado</td><td style="text-align:right"><b>' + money(c.counted) + '</b></td></tr><tr><td>Saldo según sistema</td><td style="text-align:right">' + money(c.expected) + '</td></tr><tr><td>Diferencia (' + c.result + ')</td><td style="text-align:right"><b>' + (c.diff > 0 ? '+' : '') + fmtN(c.diff) + '</b></td></tr></tbody></table>' +
        (c.note ? '<p><b>Observación:</b> ' + esc(c.note) + '</p>' : '') +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px;margin-top:26px">' + [['Responsable', c.signedBy, c.signedAt], ['Testigo', c.witness, c.witness ? c.signedAt : null], ['Aprobación', c.approvedBy, c.approvedAt], ['Validación contable', c.validatedBy, c.validatedAt]].map(([l, u, ts]) => '<div style="border-top:1px solid #9aa9ae;padding-top:6px"><div class="muted" style="font-size:.72rem;text-transform:uppercase">' + l + '</div><div>' + (u ? esc(Q.userName(u)) : '—') + '</div><div class="muted" style="font-size:.72rem">' + (ts ? 'Firma electrónica · ' + datetime(ts) : 'Pendiente') + '</div></div>').join('') + '</div></div>',
      actions: [{ label: 'Cerrar' }] });
  }

  function requestRep(a) {
    if (blockOper('solicitar reposiciones')) return;
    if (DB.cashReplenishments.some(r => r.accountId === a.id && ['solicitada', 'aprobada'].includes(r.status))) { UI.toast('Ya existe una reposición en curso para ' + esc(a.name) + ' (TES-BR-15).', 'bad'); return; }
    const pend = live().filter(m => m.accountId === a.id && m.type === 'gasto_caja' && !m.replenishmentId).sort((x, y) => x.date.localeCompare(y.date));
    if (!pend.length) { UI.toast('No hay gastos pendientes de rendición en ' + esc(a.name) + '.', 'info'); return; }
    const tot = r2(sum(pend, 'amount'));
    UI.modal({ title: 'Solicitar reposición · ' + esc(a.name), sub: 'Rendición de gastos con comprobante. El monto repone el fondo fijo de ' + money(a.fund, 'PEN', 0) + '.',
      body: '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Gasto</th><th>Comprobante</th><th class="num">Monto</th></tr></thead><tbody>' + pend.map(m => '<tr><td class="nowrap">' + dateShort(m.date) + '</td><td>' + esc(m.desc) + '<div class="cell-sub">' + esc(m.category || '') + '</div></td><td class="small">' + esc(m.ref) + '</td><td class="num">' + fmtN(m.amount) + '</td></tr>').join('') + '</tbody><tfoot><tr><td colspan="3"><b>Total a reponer</b></td><td class="num"><b>' + money(tot) + '</b></td></tr></tfoot></table></div>' + UI.form([{ id: 'rp-note', label: 'Nota', col: 12, value: 'Rendición ' + dateShort(pend[0].date) + ' al ' + dateShort(pend[pend.length - 1].date) }]),
      actions: [{ label: 'Cancelar' }, { label: 'Enviar a aprobación', cls: 'primary', onClick: (m) => {
        const r = { id: nextId(DB.cashReplenishments, 'REP-', 4), accountId: a.id, sede: a.sede, amount: tot, movIds: pend.map(x => x.id), status: 'solicitada', requestedBy: Auth.user.id, requestedAt: nowStr(), note: UI.formData(m)['rp-note'], log: [{ ts: nowStr(), u: Auth.user.id, m: 'Solicitud con ' + pend.length + ' comprobantes' }] };
        pend.forEach(x => { x.replenishmentId = r.id; });
        DB.cashReplenishments.unshift(r); Audit.log('Reposición de caja', r.id, 'solicitar', '', money(tot) + ' · ' + a.name);
        Notify.push('caja.reposicion', 'Portal', 'U02', 'Reposición ' + r.id + ' de ' + a.name + ' por ' + money(tot) + ' pendiente de aprobación');
        Store.save(); UI.toast('Reposición ' + r.id + ' enviada a aprobación.'); App.render();
      } }] });
  }
  function approveRep(r) {
    if (!P.appr()) { UI.toast('Aprobar reposiciones requiere <span class="mono">finance.profitability</span> + <span class="mono">approvals.view</span>.', 'bad'); return; }
    if (r.requestedBy === Auth.user.id) { UI.toast('TES-BR-14: quien solicita la reposición no puede aprobarla.', 'bad'); return; }
    r.status = 'aprobada'; r.approvedBy = Auth.user.id; r.approvedAt = nowStr(); r.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Aprobada' });
    Audit.log('Reposición de caja', r.id, 'aprobar', 'solicitada', 'aprobada'); Notify.push('caja.reposicion_aprobada', 'Portal', r.requestedBy, 'Reposición ' + r.id + ' aprobada: pendiente de pago'); Store.save(); UI.toast('Reposición ' + r.id + ' aprobada.'); App.render();
  }
  function rejectRep(r) {
    if (!P.appr()) { UI.toast('Requiere <span class="mono">finance.profitability</span> + <span class="mono">approvals.view</span>.', 'bad'); return; }
    if (r.requestedBy === Auth.user.id) { UI.toast('TES-BR-14: quien solicita no puede resolver su propia reposición.', 'bad'); return; }
    UI.confirm({ title: 'Rechazar ' + r.id, message: 'Los gastos vuelven a quedar pendientes de rendición.', confirmLabel: 'Rechazar', danger: true, reason: true, onConfirm: (why) => { r.status = 'rechazada'; r.rejectReason = why; r.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Rechazada: ' + why }); DB.treasuryMovements.filter(m => m.replenishmentId === r.id).forEach(m => { m.replenishmentId = null; }); Audit.log('Reposición de caja', r.id, 'rechazar', 'solicitada', 'rechazada · ' + why); Notify.push('caja.reposicion_rechazada', 'Portal', r.requestedBy, 'Reposición ' + r.id + ' rechazada: ' + why); Store.save(); UI.toast('Reposición rechazada.', 'warn'); App.render(); } });
  }
  function payRep(r) {
    if (blockOper('pagar reposiciones')) return;
    const a = acc(r.accountId);
    transferModal({ from: 'CTA-01', to: a.id, amount: r.amount, desc: 'Reposición ' + a.name + ' ' + r.id, rep: true, done: (tid) => { r.status = 'pagada'; r.paidAt = nowStr(); r.paidBy = Auth.user.id; r.transferId = tid; r.paidFrom = (DB.treasuryMovements.find(m => m.transferId === tid && m.dir === 'out') || {}).accountId; r.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Pagada (' + tid + ')' }); Audit.log('Reposición de caja', r.id, 'pagar', 'aprobada', 'pagada · ' + tid); Notify.push('caja.reposicion_pagada', 'Portal', a.custodian, 'Reposición ' + r.id + ' abonada en ' + a.name); Store.save(); App.render(); } });
  }
  function repDrawer(r) {
    const movs = r.movIds.map(id => DB.treasuryMovements.find(m => m.id === id)).filter(Boolean);
    UI.drawer({ title: 'Reposición ' + r.id, sub: esc(acc(r.accountId).name) + ' · ' + money(r.amount), wide: true,
      body: UI.flow(['Solicitada', 'Aprobada', 'Pagada'], { solicitada: 0, aprobada: 1, pagada: 3, rechazada: 1 }[r.status], r.status === 'rechazada' ? 1 : undefined) + (r.rejectReason ? UI.alert('bad', 'Rechazada: ' + esc(r.rejectReason)) : '') +
        UI.dl([['Solicitó', esc(Q.userName(r.requestedBy)) + ' · ' + datetime(r.requestedAt)], ['Aprobó', r.approvedBy ? esc(Q.userName(r.approvedBy)) + ' · ' + datetime(r.approvedAt) : '—'], ['Pago', r.transferId ? '<span class="mono">' + esc(r.transferId) + '</span> desde ' + esc((acc(r.paidFrom) || {}).name || '') : '—'], ['Nota', esc(r.note || '')]]) +
        '<div class="section-title" style="margin-top:14px">Comprobantes rendidos</div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Gasto</th><th>Comprobante</th><th class="num">Monto</th></tr></thead><tbody>' + movs.map(m => '<tr><td>' + dateShort(m.date) + '</td><td>' + esc(m.desc) + '</td><td class="small">' + esc(m.ref) + (m.receipt && m.receipt.ruc ? '<div class="cell-sub">RUC ' + esc(m.receipt.ruc) + '</div>' : '') + '</td><td class="num">' + fmtN(m.amount) + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="section-title" style="margin-top:14px">Historial</div>' + UI.timeline(r.log.slice().reverse().map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(Q.userName(l.u)), icon: 'history' }))) });
  }

  /* ---------------- Flujo de caja proyectado ---------------- */
  function projItems(opt) {
    const t = TODAY(); const end = addDays(t, 90); const out = [];
    const penOf = (amt, cur, fx) => cur === 'USD' ? amt * (fx || FX()) : amt;
    DB.receivables.forEach(r => { const b = r2(r.amount - (r.paid || 0)); if (r.status === 'pagada' || b <= 0) return; const od = r.due < t; if (od && !opt.overdue) return; out.push({ id: r.id, kind: 'CxC', date: od ? t : r.due, due: r.due, overdue: od, label: r.concept, party: Q.clientName(r.clientId), cur: r.currency, amt: b, pen: r2(penOf(b, r.currency, r.fx)) }); });
    DB.payables.forEach(p => { const b = r2(p.amount - (p.paid || 0)); if (p.status === 'pagada' || b <= 0) return; const d = p.scheduled && p.scheduled.date ? p.scheduled.date : p.due < t ? t : p.due; out.push({ id: p.id, kind: 'CxP', date: d, due: p.due, overdue: p.due < t, label: p.concept, party: Q.providerName(p.providerId), cur: p.currency, amt: b, pen: -r2(penOf(b, p.currency, p.fx)) }); });
    const x0 = parseD(t); const eom = x0.getFullYear() + '-' + pad(x0.getMonth() + 1, 2) + '-' + pad(new Date(x0.getFullYear(), x0.getMonth() + 1, 0).getDate(), 2);
    (DB.commissions || []).filter(c => c.status === 'aprobada').forEach(c => { out.push({ id: c.id, kind: 'Comisión', date: eom < t ? t : eom, due: eom, label: 'Comisión ' + c.kind + ' ' + c.resId, party: c.kind === 'Agencia B2B' ? ((Q.agency(c.beneficiary) || {}).name || c.beneficiary) : Q.userName(c.beneficiary), cur: c.currency, amt: c.amount, pen: -r2(penOf(c.amount, c.currency)) }); });
    if (opt.fixed) {
      const x = parseD(t);
      for (let k = 0; k < 4; k++) { const y = new Date(x.getFullYear(), x.getMonth() + k, 1); DB.treasurySettings.recurring.forEach((rc, i) => { const d = y.getFullYear() + '-' + pad(y.getMonth() + 1, 2) + '-' + pad(Math.min(rc.day, 28), 2); if (d > t && d <= end) out.push({ id: 'FIJ-' + (i + 1) + '-' + d.slice(0, 7), kind: 'Egreso fijo', date: d, due: d, label: rc.concept, party: 'Estimado', cur: 'PEN', amt: rc.amount, pen: -rc.amount }); }); }
    }
    return out.filter(i => i.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  }
  function horizons(opt) {
    const start = r2(sum(DB.treasuryAccounts, a => eqPEN(balance(a.id), a.currency))); const items = projItems(opt); let run = start;
    return [30, 60, 90].map((h, i) => { const from = i ? addDays(TODAY(), [0, 30, 60][i] + 1) : '0000'; const to = addDays(TODAY(), h); const set = items.filter(x => x.date >= from && x.date <= to); const cxc = r2(sum(set.filter(x => x.kind === 'CxC'), 'pen')); const cxp = r2(sum(set.filter(x => x.kind === 'CxP'), 'pen')); const com = r2(sum(set.filter(x => x.kind === 'Comisión'), 'pen')); const fix = r2(sum(set.filter(x => x.kind === 'Egreso fijo'), 'pen')); const ini = run; run = r2(run + cxc + cxp + com + fix); return { h, from, to, ini, cxc, cxp, com, fix, end: run }; });
  }
  const flowOpt = { overdue: true, fixed: true };
  function tabFlujo(body) {
    const hz = horizons(flowOpt); const items = projItems(flowOpt);
    const weeks = []; for (let i = 0; i < 13; i++) { const f = addDays(TODAY(), i * 7), t = addDays(TODAY(), i * 7 + 6); const set = items.filter(x => x.date >= f && x.date <= t); weeks.push({ l: dateShort(f), inn: r2(sum(set.filter(x => x.pen > 0), 'pen')), out: r2(-sum(set.filter(x => x.pen < 0), 'pen')) }); }
    let run = hz[0].ini; const bal = weeks.map(w => { run = r2(run + w.inn - w.out); return Math.max(0, run); });
    const row = (l, k, cls) => '<tr class="' + (cls || '') + '"><td>' + l + '</td>' + hz.map(h => '<td class="num">' + (k === 'ini' || k === 'end' ? fmtN(h[k], 0) : signed(h[k]).replace('S/ ', '')) + '</td>').join('') + '</tr>';
    body.innerHTML = '<div class="row" style="gap:16px;margin-bottom:12px;flex-wrap:wrap"><label class="check"><input type="checkbox" id="fl-od"' + (flowOpt.overdue ? ' checked' : '') + '> Incluir CxC vencidas como cobro inmediato</label><label class="check"><input type="checkbox" id="fl-fx"' + (flowOpt.fixed ? ' checked' : '') + '> Incluir egresos fijos estimados (planilla, alquileres, tributos)</label></div>' +
      '<div class="grid g-2-1">' + UI.card('Flujo proyectado por horizonte (S/)', '<div class="tbl-wrap"><table class="tz-hz"><thead><tr><th>Concepto</th><th>0–30 días</th><th>31–60 días</th><th>61–90 días</th></tr></thead><tbody>' + row('Saldo inicial', 'ini') + row('(+) Cuentas por cobrar por vencer', 'cxc') + row('(−) Cuentas por pagar a proveedores', 'cxp') + row('(−) Comisiones aprobadas', 'com') + row('(−) Egresos fijos estimados', 'fix') + row('Saldo final proyectado', 'end', 'tot') + '</tbody></table></div><p class="xs faint" style="margin-top:8px">USD convertidos al TC ' + fmtN(FX(), 3) + '. CxC vencidas: ' + (flowOpt.overdue ? 'se asumen cobradas hoy (riesgo de cobranza).' : 'excluidas.') + '</p>', { sub: 'Horizontes acumulados desde hoy ' + date(TODAY()) }) +
      UI.card('Riesgo de liquidez', hz.some(h => h.end < 0) ? UI.alert('bad', 'Saldo negativo proyectado en el horizonte de ' + hz.find(h => h.end < 0).h + ' días. Evaluar línea de crédito o reprogramar pagos.') : UI.alert('ok', 'Sin déficit proyectado a 90 días.') + UI.chart.hbars({ items: [{ label: 'Entradas 90 d', value: sum(items.filter(i => i.pen > 0), 'pen'), display: 'S/ ' + fmtN(sum(items.filter(i => i.pen > 0), 'pen'), 0), color: 'var(--ok)' }, { label: 'Salidas 90 d', value: -sum(items.filter(i => i.pen < 0), 'pen'), display: 'S/ ' + fmtN(-sum(items.filter(i => i.pen < 0), 'pen'), 0), color: 'var(--bad)' }] }), { sub: 'Semáforo' }) + '</div>' +
      UI.card('Entradas y salidas por semana (13 semanas)', UI.chart.bars({ labels: weeks.map(w => w.l), series: [{ name: 'Entradas', values: weeks.map(w => w.inn), color: 'var(--ok)' }, { name: 'Salidas', values: weeks.map(w => w.out), color: 'var(--bad)' }], fmt: v => 'S/ ' + fmtN(v, 0) }) + UI.chart.line({ labels: weeks.map(w => w.l), series: [{ name: 'Saldo proyectado', values: bal }], height: 160, fmt: v => 'S/ ' + fmtN(v, 0) }), { sub: 'Semana que inicia en la fecha indicada' }) +
      '<div id="fl-det" style="min-width:0"></div>';
    body.querySelector('#fl-od').onchange = (e) => { flowOpt.overdue = e.target.checked; tabFlujo(body); };
    body.querySelector('#fl-fx').onchange = (e) => { flowOpt.fixed = e.target.checked; tabFlujo(body); };
    UI.dataTable(body.querySelector('#fl-det'), {
      rows: () => items, exportName: 'flujo_proyectado', pageSize: 10, searchPlaceholder: 'Buscar documento o contraparte…', search: i => [i.id, i.label, i.party].join(' '),
      toolbar: '<b class="small" style="margin-right:6px">Detalle proyectado</b>',
      filters: [{ key: 'kind', label: 'Tipo', options: [['CxC', 'Cuenta por cobrar'], ['CxP', 'Cuenta por pagar'], ['Comisión', 'Comisión'], ['Egreso fijo', 'Egreso fijo']] }, { key: 'h', label: 'Horizonte', options: [['30', '0–30 días'], ['60', '31–60 días'], ['90', '61–90 días']], match: (i, v) => { const d = daysFromToday(i.date); return v === '30' ? d <= 30 : v === '60' ? d > 30 && d <= 60 : d > 60; } }],
      columns: [
        { key: 'date', label: 'Fecha', render: i => date(i.date) + (i.overdue ? '<div class="cell-sub" style="color:var(--bad)">Vencido ' + dateShort(i.due) + '</div>' : '') },
        { key: 'id', label: 'Documento', render: i => i.kind === 'CxC' ? lk('finanzas/cobros', i.id, esc(i.id), 'mono') : i.kind === 'CxP' ? lk('finanzas/proveedores', i.id, esc(i.id), 'mono') : '<span class="mono">' + esc(i.id) + '</span>' },
        { key: 'kind', label: 'Tipo', render: i => '<span class="tag">' + esc(i.kind) + '</span>' },
        { key: 'label', label: 'Concepto', render: i => esc(i.label) + '<div class="cell-sub">' + esc(i.party) + '</div>' },
        { key: 'amt', label: 'Monto', align: 'num', render: i => '<span class="num nowrap">' + money(i.amt, i.cur) + '</span>' },
        { key: 'pen', label: 'Efecto S/', align: 'num', render: i => signed(i.pen), csv: i => i.pen.toFixed(2) }
      ]
    });
  }

  /* ---------------- Diferencia cambiaria ---------------- */
  function tabCambio(body) {
    const usd = DB.treasuryAccounts.filter(a => a.currency === 'USD');
    const period = TODAY().slice(0, 7);
    const rows = (rate) => usd.map(a => { const v = valuation(a.id); const diff = r2(v.bal * rate - v.val); return { a, v, diff, done: DB.fxRevaluations.some(r => r.accountId === a.id && r.period === period) }; });
    const realized = usd.flatMap(a => valuation(a.id).realized.map(x => ({ ...x, a })));
    const draw = () => {
      const rate = +body.querySelector('#dc-rate').value || FX(); const rs = rows(rate); const tot = r2(sum(rs.filter(r => !r.done), 'diff'));
      body.querySelector('#dc-tbl').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cuenta</th><th class="num">Saldo USD</th><th class="num">TC contable</th><th class="num">Valor contable S/</th><th class="num">Valor al cierre S/</th><th class="num">Diferencia S/</th><th></th></tr></thead><tbody>' +
        rs.map(r => '<tr><td>' + accLink(r.a.id) + '</td><td class="num">' + fmtN(r.v.bal) + '</td><td class="num">' + fmtN(r.v.rate, 4) + '</td><td class="num">' + fmtN(r.v.val) + '</td><td class="num">' + fmtN(r.v.bal * rate) + '</td><td class="num">' + signed(r.diff) + '<div class="cell-sub">' + (r.diff >= 0 ? 'Ganancia' : 'Pérdida') + '</div></td><td>' + (r.done ? UI.badge('aplicado', 'Registrada ' + period) : '') + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td colspan="5"><b>Diferencia por registrar (' + period + ')</b></td><td class="num"><b>' + signed(tot) + '</b></td><td></td></tr></tfoot></table></div>';
    };
    body.innerHTML = '<div class="grid g-2-1"><div style="min-width:0">' + UI.card('Revaluación de saldos en moneda extranjera (no realizada)', '<div class="row" style="gap:10px;margin-bottom:12px;align-items:flex-end;flex-wrap:wrap"><div class="field" style="width:180px"><label for="dc-rate">TC de cierre (venta SBS)</label><input class="input" id="dc-rate" type="number" step="0.001" value="' + FX() + '"></div><button class="btn primary" id="dc-reg"' + (P.acct() ? '' : needTip('finance.invoicing')) + '>' + UI.icon('check') + 'Registrar diferencia del periodo</button></div><div id="dc-tbl"></div><p class="xs faint" style="margin-top:8px">Valor contable por costo promedio ponderado: entradas al TC de cada operación, salidas al TC promedio, más revaluaciones anteriores. La revaluación no cambia el saldo en dólares; genera el asiento de diferencia de cambio (cuentas 676/776 del PCGE).</p>', { sub: 'Cuentas en USD · periodo ' + period }) + '</div>' +
      UI.card('Diferencia realizada', realized.length ? '<div class="list">' + realized.map(x => '<div class="list-item"><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(x.m.desc) + '</div><div class="xs faint">' + dateShort(x.m.date) + ' · ' + money(x.m.amount, 'USD') + ' · TC op. ' + fmtN(x.m.fx, 3) + ' vs promedio ' + fmtN(x.rate, 4) + '</div></div>' + signed(x.diff) + '</div>').join('') + '</div>' : UI.empty('Sin salidas de dólares con TC distinto al promedio', 'scale'), { sub: 'Salidas en USD valorizadas al TC de la operación' }) + '</div>' +
      UI.card('Historial de revaluaciones', DB.fxRevaluations.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Asiento</th><th>Periodo</th><th>Cuenta</th><th class="num">Saldo USD</th><th class="num">TC contable → cierre</th><th class="num">Diferencia S/</th><th>Registró</th></tr></thead><tbody>' + DB.fxRevaluations.slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => '<tr><td class="mono">' + r.id + '</td><td>' + r.period + '</td><td>' + esc(acc(r.accountId).name) + '</td><td class="num">' + fmtN(r.balance) + '</td><td class="num">' + fmtN(r.bookRate, 4) + ' → ' + fmtN(r.closeRate, 3) + '</td><td class="num">' + signed(r.diffPEN) + '</td><td class="small">' + esc(Q.userName(r.by)) + '<div class="cell-sub">' + datetime(r.at) + '</div></td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin revaluaciones', 'history'), { tight: true });
    body.querySelector('#dc-rate').addEventListener('input', draw); draw();
    body.querySelector('#dc-reg').onclick = () => {
      if (!P.acct()) { UI.toast('Registrar la diferencia cambiaria requiere <span class="mono">finance.invoicing</span> (Contabilidad).', 'bad'); return; }
      const rate = +body.querySelector('#dc-rate').value; if (!(rate > 2 && rate < 6)) { UI.toast('Indique un TC de cierre válido.', 'bad'); return; }
      const rs = rows(rate).filter(r => !r.done && Math.abs(r.diff) >= 0.01);
      if (!rs.length) { UI.toast('La diferencia del periodo ' + period + ' ya fue registrada para todas las cuentas (TES-BR-16).', 'info'); return; }
      UI.confirm({ title: 'Registrar diferencia cambiaria ' + period, message: 'Se registrarán ' + rs.length + ' asiento(s) con TC de cierre ' + fmtN(rate, 3) + ' por un neto de ' + signed(r2(sum(rs, 'diff'))) + '. Solo una revaluación por cuenta y periodo.', confirmLabel: 'Registrar',
        onConfirm: () => { rs.forEach(r => { const x = { id: nextId(DB.fxRevaluations, 'DC-', 4), period, date: TODAY(), accountId: r.a.id, balance: r.v.bal, bookRate: r2(r.v.rate * 1e4) / 1e4, closeRate: rate, diffPEN: r.diff, by: Auth.user.id, at: nowStr() }; DB.fxRevaluations.push(x); Audit.log('Diferencia cambiaria', x.id, 'registrar', 'TC ' + fmtN(r.v.rate, 4), 'TC ' + rate + ' · ' + money(r.diff)); }); Notify.push('tesoreria.dif_cambio', 'Portal', 'U08', 'Diferencia cambiaria ' + period + ' registrada (' + rs.length + ' cuentas)'); Store.save(); UI.toast('Diferencia cambiaria registrada.'); App.render(); } });
    };
  }

  /* ---------------- Detalle de cuenta ---------------- */
  function accountPage(el, id) {
    const a = acc(id);
    if (!a) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('La cuenta ' + esc(id || '') + ' no existe.', 'database')) + '</div>'; return; }
    const b = balance(a.id); const month = TODAY().slice(0, 7);
    const mm = live().filter(m => m.accountId === a.id && m.date.startsWith(month));
    const rows = () => { const list = DB.treasuryMovements.filter(m => m.accountId === a.id).sort((x, y) => (x.date + x.createdAt + x.id).localeCompare(y.date + y.createdAt + y.id)); let run = a.opening; list.forEach(m => { if (m.status !== 'anulado') run = r2(run + (m.dir === 'in' ? m.amount : -m.amount)); m._run = run; }); return list; };
    const s = sessionToday(a.id); const o = P.oper(); const t = needTip('finance.payments.register');
    const acts = a.kind === 'caja' ? ((!s || s.status === 'cerrada') ? '<button class="btn primary" id="ac-open"' + (o ? '' : t) + '>' + UI.icon('lock') + 'Aperturar</button>' : '<button class="btn" id="ac-exp"' + (o ? '' : t) + '>' + UI.icon('receipt') + 'Gasto</button><button class="btn" id="ac-cnt"' + (o ? '' : t) + '>' + UI.icon('coins') + 'Arqueo</button><button class="btn primary" id="ac-close"' + (o ? '' : t) + '>' + UI.icon('lock') + 'Cerrar caja</button>')
      : a.kind === 'pasarela' ? '<button class="btn primary" id="ac-settle"' + (o ? '' : t) + '>' + UI.icon('refresh') + 'Liquidar al banco</button>'
      : '<button class="btn" id="ac-trf"' + (o ? '' : t) + '>' + UI.icon('refresh') + 'Transferir</button><button class="btn primary" id="ac-mov"' + (o ? '' : t) + '>' + UI.icon('plus') + 'Movimiento</button>';
    const val = a.currency === 'USD' ? valuation(a.id) : null;
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(a.name), subtitle: esc(kindLabel(a)) + ' · ' + esc(a.currency) + (a.number ? ' · <span class="mono">' + esc(a.number) + '</span>' : '') + ' · ' + esc(Q.sedeName(a.sede)), crumbs: [['Inicio', '#/dashboard'], ['Tesorería', '#/finanzas/tesoreria'], [a.name]], actions: acts }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Saldo actual', value: money(b, a.currency), sub: a.currency === 'USD' ? '≈ S/ ' + fmtN(b * FX(), 0) + ' · TC contable ' + fmtN(val.rate, 4) : a.kind === 'caja' ? 'Fondo fijo ' + money(a.fund, 'PEN', 0) : 'Saldo inicial ' + money(a.opening, a.currency, 0) + ' al ' + dateShort(a.openingDate), tone: 'accent', icon: 'database' }) +
      UI.kpi({ label: 'Ingresos del mes', value: money(sum(mm.filter(m => m.dir === 'in'), 'amount'), a.currency, 0), sub: mm.filter(m => m.dir === 'in').length + ' movimientos', tone: 'ok', icon: 'download' }) +
      UI.kpi({ label: 'Egresos del mes', value: money(sum(mm.filter(m => m.dir === 'out'), 'amount'), a.currency, 0), sub: mm.filter(m => m.dir === 'out').length + ' movimientos', tone: 'bad', icon: 'upload' }) +
      UI.kpi({ label: a.kind === 'caja' ? 'Sesión de hoy' : a.kind === 'pasarela' ? 'Por liquidar' : 'CCI', value: a.kind === 'caja' ? (s ? (s.status === 'abierta' ? 'Abierta' : 'Cerrada') : 'Sin aperturar') : a.kind === 'pasarela' ? money(b, a.currency, 0) : '<span class="mono" style="font-size:.9rem">' + esc(a.cci || '—') + '</span>', sub: a.kind === 'caja' ? 'Custodia: ' + esc(Q.userName(a.custodian)) : a.kind === 'pasarela' ? 'Abono a ' + esc(acc(a.settleTo).name) : esc(a.bank), tone: 'info', icon: a.kind === 'caja' ? 'lock' : 'building' }) + '</div>' +
      '<div id="ac-mt" style="min-width:0"></div></div>';
    movTable(el.querySelector('#ac-mt'), rows, { noAcc: true, running: true, pageSize: 15, toolbar: '<b class="small" style="margin-right:6px">Libro de la cuenta (saldo acumulado)</b>' });
    const on = (sel, fn) => { const x = el.querySelector(sel); if (x) x.onclick = fn; };
    on('#ac-open', () => openCash(a)); on('#ac-exp', () => expenseModal(a.id)); on('#ac-cnt', () => countModal(a, 'arqueo')); on('#ac-close', () => countModal(a, 'cierre'));
    on('#ac-settle', () => settleModal(a)); on('#ac-trf', () => transferModal({ from: a.id, to: a.id === 'CTA-01' ? 'CTA-03' : 'CTA-01' })); on('#ac-mov', () => movModal(a.id));
  }

  /* =====================================================================
     LIBRO DE RECLAMACIONES
     ===================================================================== */
  const BK = { recibido: ['nuevo', 'Recibido'], en_evaluacion: ['en_proceso', 'En evaluación'], respondido: ['resuelta', 'Respondido'], cerrado: ['cerrada', 'Cerrado'] };
  const BK2CRM = { recibido: 'abierta', en_evaluacion: 'en_proceso', respondido: 'resuelta', cerrado: 'cerrada' };
  const bkBadge = (s) => UI.badge(BK[s][0], BK[s][1]);
  const SEDE_CODE = { 'SED-01': 'LIM', 'SED-02': 'CUS', 'SED-03': 'AQP' };
  const DOC_TYPES = ['DNI', 'Carné de extranjería', 'Pasaporte', 'RUC'];
  const DECISIONS = ['Procedente', 'Procedente en parte', 'No procedente'];

  const cfg = () => DB.claimBook;
  const isHoliday = (d) => cfg().holidays.includes(d);
  const isBiz = (d) => { const w = parseD(d).getDay(); return w !== 0 && w !== 6 && !isHoliday(d); };
  const addBiz = (d, n) => { let x = d, c = 0; while (c < n) { x = addDays(x, 1); if (isBiz(x)) c++; } return x; };
  const bizBetween = (a, b) => { if (a === b) return 0; const sgn = b > a ? 1 : -1; let x = a, c = 0; while (x !== b) { x = addDays(x, sgn); if (isBiz(x)) c += sgn; } return c; };
  const books = () => (DB.claims || []).filter(c => c.book);
  function setBook(c, st, msg) { c.bookStatus = st; c.status = BK2CRM[st]; c.log = c.log || []; c.log.push({ ts: nowStr(), u: Auth.user ? Auth.user.id : 'Sistema', m: msg }); }
  function plazo(c) {
    const due = c.dueDate;
    if (['respondido', 'cerrado'].includes(c.bookStatus)) { const sent = c.response && (c.response.sentAt || c.response.at); const late = sent && sent.slice(0, 10) > due; return { code: late ? 'fuera' : 'atendido', label: late ? 'Respondido fuera de plazo' : 'Respondido en plazo', badge: UI.badge(late ? 'vencido' : 'activo', late ? 'Fuera de plazo' : 'En plazo'), days: null }; }
    const rem = bizBetween(TODAY(), due);
    if (rem < 0) return { code: 'vencido', label: 'Vencido hace ' + (-rem) + ' día(s) hábil(es)', badge: UI.badge('vencido', 'Vencido ' + (-rem) + ' d'), days: rem };
    if (rem <= cfg().alertDays) return { code: 'por_vencer', label: 'Vence en ' + rem + ' día(s) hábil(es)', badge: UI.badge('pendiente', rem === 0 ? 'Vence hoy' : 'Quedan ' + rem + ' d'), days: rem };
    return { code: 'en_plazo', label: 'Quedan ' + rem + ' días hábiles', badge: UI.badge('activo', rem + ' d hábiles'), days: rem };
  }
  function nextBookNo(sede) { const code = SEDE_CODE[sede] || 'WEB'; const s = cfg().seq; const n = s[sede] || 1; s[sede] = n + 1; return 'LR-' + code + '-' + TODAY().slice(0, 4) + '-' + pad(n, 6); }
  function normalize(c) {
    if (!c.book) return false; let d = false;
    if (!c.sede) { c.sede = 'SED-01'; d = true; }
    if (!c.bookNo) { c.bookNo = nextBookNo(c.sede); d = true; }
    if (!c.bookStatus) { c.bookStatus = ({ abierta: 'recibido', en_proceso: 'en_evaluacion', resuelta: 'respondido', cerrada: 'cerrado' })[c.status] || 'recibido'; d = true; }
    if (!c.createdAt) { c.createdAt = nowStr(); d = true; }
    if (!c.dueDate) { c.dueDate = addBiz(c.createdAt.slice(0, 10), cfg().responseDays); d = true; }
    if (!c.consumer) { c.consumer = { name: Q.clientName(c.clientId), docType: 'DNI', docNumber: '', address: '', email: (Q.client(c.clientId) || {}).email || '', phone: '', minor: false, guardian: null }; d = true; }
    if (!c.good) { c.good = { kind: 'Servicio', description: c.subject || '', amount: 0, currency: 'PEN' }; d = true; }
    if (!c.owner) { c.owner = 'U02'; d = true; }
    if (!c.priority) { c.priority = c.type === 'Reclamo' ? 'alta' : 'media'; d = true; }
    if (!c.log) { c.log = []; d = true; }
    if (c.status !== BK2CRM[c.bookStatus]) { c.status = BK2CRM[c.bookStatus]; d = true; }
    return d;
  }
  /* Alta de una hoja (usada por el formulario del portal, el registro presencial y el sitio web público) */
  function register(data) {
    ensureC();
    const id = nextId(DB.claims, 'REC-', 4); const created = data.createdAt || nowStr();
    const c = { id, book: true, bookNo: nextBookNo(data.sede), sede: data.sede, channel: data.channel || 'Sitio web', type: data.type, clientId: data.clientId || null, resId: data.resId || null, surveyId: null,
      priority: data.type === 'Reclamo' ? 'alta' : 'media', subject: String(data.detail || '').slice(0, 90) + (String(data.detail || '').length > 90 ? '…' : ''), desc: data.detail, request: data.request,
      consumer: data.consumer, good: data.good, bookStatus: 'recibido', status: 'abierta', owner: data.owner || 'U02', createdAt: created, dueDate: addBiz(created.slice(0, 10), cfg().responseDays), responseDays: cfg().responseDays,
      resolution: '', response: null, submittedBy: data.submittedBy || (Auth.user ? Auth.user.id : 'web'), ackSentAt: nowStr(), log: [{ ts: created, u: data.submittedBy || (Auth.user ? Auth.user.id : 'web'), m: 'Hoja registrada (' + (data.channel || 'Sitio web') + ')' }] };
    DB.claims.unshift(c);
    Audit.log('Libro de reclamaciones', c.id, 'registrar', '', c.bookNo + ' · ' + c.type + ' · vence ' + c.dueDate);
    if (c.consumer && c.consumer.email) Notify.push('reclamacion.constancia', 'Email', c.consumer.email, 'Constancia de ' + c.type.toLowerCase() + ' — Hoja ' + c.bookNo);
    Notify.push('reclamacion.nueva', 'Portal', c.owner, 'Nueva hoja ' + c.bookNo + ' (' + c.type + ') — responder hasta ' + date(c.dueDate));
    Store.save();
    return c;
  }
  window.ClaimBook = { register: (d) => register(d), nextBookNo, dueDate: (d) => { ensureC(); return addBiz(d, cfg().responseDays); }, plazo: (c) => plazo(c), normalize };

  function ensureC() {
    css();
    if (!DB.claims) {
      /* Mismos casos de postventa que siembra crm.js (se replican por si esta pantalla se abre primero). */
      DB.claims = [
        { id: 'REC-0014', clientId: 'CLI-0007', resId: 'RES-2026-000345', surveyId: null, type: 'Reclamo', priority: 'media', subject: 'Demora en emisión de vouchers para reservas B2B', desc: 'La agencia reporta que los vouchers de la salida del 02/10 aún no se reflejan en el portal B2B.', status: 'en_proceso', owner: 'U02', createdAt: '2026-09-28 10:20', resolution: '', log: [{ ts: '2026-09-28 10:20', u: 'U02', m: 'Registrado por llamada de Pamela Ortiz' }, { ts: '2026-09-28 15:00', u: 'U06', m: 'Operaciones revisa emisión pendiente' }] },
        { id: 'REC-0013', clientId: 'CLI-0006', resId: 'RES-2026-000346', surveyId: 'ENC-0101', type: 'Sugerencia', priority: 'baja', subject: 'Más tiempo en la laguna Humantay', desc: 'La pasajera sugiere ampliar el tiempo libre en la laguna (actualmente 45 min).', status: 'abierta', owner: 'U03', createdAt: '2026-09-27 12:15', resolution: '', log: [{ ts: '2026-09-27 12:15', u: 'U03', m: 'Registrado desde encuesta ENC-0101' }] },
        { id: 'REC-0012', clientId: 'CLI-0001', resId: null, surveyId: 'ENC-0095', type: 'Reclamo', priority: 'alta', subject: 'Detractor NPS 5 — categoría de hotel en Arequipa', desc: 'El hotel en Arequipa no correspondía a la categoría ofrecida.', status: 'resuelta', owner: 'U04', createdAt: '2026-05-18 16:45', resolution: 'Se otorgó nota de crédito del 15% y se retiró el hotel del programa.', log: [{ ts: '2026-05-18 16:45', u: 'U04', m: 'Caso generado automáticamente por NPS ≤ 6' }, { ts: '2026-05-21 12:00', u: 'U02', m: 'Resuelto: compensación aprobada por gerencia' }] },
        { id: 'REC-0010', clientId: 'CLI-0005', resId: null, surveyId: 'ENC-0094', type: 'Queja', priority: 'media', subject: 'Detractor NPS 6 — retraso de traslado', desc: 'Traslado al aeropuerto llegó 40 minutos tarde.', status: 'cerrada', owner: 'U04', createdAt: '2026-02-20 10:20', resolution: 'Proveedor amonestado; se asignó unidad de respaldo para clientes VIP.', log: [{ ts: '2026-02-20 10:20', u: 'U04', m: 'Caso generado automáticamente por NPS ≤ 6' }, { ts: '2026-02-24 09:00', u: 'U04', m: 'Cerrado con conformidad del cliente' }] }
      ];
    }
    if (!DB.claimBook) {
      DB.claimBook = { responseDays: 15, alertDays: 3, seq: { 'SED-01': 5, 'SED-02': 9, 'SED-03': 3 }, retentionYears: 2,
        holidays: ['2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-07', '2026-06-29', '2026-07-23', '2026-07-28', '2026-07-29', '2026-08-06', '2026-08-30', '2026-10-08', '2026-11-01', '2026-12-08', '2026-12-09', '2026-12-25'] };
    }
    if (!DB.claimBookSeeded) {
      DB.claimBookSeeded = true;
      const S = (o) => {
        const id = nextId(DB.claims, 'REC-', 4); const created = o.createdAt;
        const c = Object.assign({ id, book: true, bookNo: nextBookNo(o.sede), surveyId: null, priority: o.type === 'Reclamo' ? 'alta' : 'media', subject: o.detail.slice(0, 90) + (o.detail.length > 90 ? '…' : ''), desc: o.detail, owner: 'U02', dueDate: addBiz(created.slice(0, 10), 15), responseDays: 15, resolution: '', response: null, ackSentAt: created, submittedBy: o.submittedBy || 'web' }, o);
        delete c.detail; c.status = BK2CRM[c.bookStatus]; DB.claims.unshift(c); return c;
      };
      const P1 = (name, docType, docNumber, address, email, phone, minor, guardian) => ({ name, docType, docNumber, address, email, phone, minor: !!minor, guardian: guardian || null });
      const G = (description, amount, currency) => ({ kind: 'Servicio', description, amount, currency });
      S({ sede: 'SED-01', type: 'Reclamo', channel: 'Presencial', clientId: 'CLI-0005', resId: null, createdAt: '2026-08-10 16:00', bookStatus: 'cerrado', consumer: P1('Jorge Castañeda Ugarte', 'DNI', '41220988', 'Av. Larco 455, Trujillo', 'jcastaneda@correo.pe', '987 450 221'), good: G('Paquete Paracas VIP 3D/2N — habitación vista al mar', 350, 'PEN'), detail: 'La habitación asignada en Paracas no tenía vista al mar pese a que se contrató y pagó la categoría "vista mar".', request: 'Reembolso de la diferencia tarifaria de S/ 350.', response: { decision: 'Procedente en parte', text: 'Se verificó con el hotel que la categoría vista mar no estuvo disponible por sobreventa. Se reconoce una nota de crédito de S/ 200 aplicable a su próximo viaje y se trasladó la penalidad al proveedor.', actions: 'Nota de crédito S/ 200. Penalidad al proveedor.', at: '2026-08-19 12:00', by: 'U02', sentAt: '2026-08-19 12:05', sentTo: 'jcastaneda@correo.pe' }, closedAt: '2026-08-25 09:30', closeNote: 'Consumidor conforme con la nota de crédito.', submittedBy: 'U02', log: [{ ts: '2026-08-10 16:00', u: 'U02', m: 'Hoja registrada (Presencial)' }, { ts: '2026-08-11 09:00', u: 'U02', m: 'En evaluación' }, { ts: '2026-08-19 12:05', u: 'U02', m: 'Respuesta enviada por email' }, { ts: '2026-08-25 09:30', u: 'U02', m: 'Cerrada: consumidor conforme' }] });
      S({ sede: 'SED-02', type: 'Queja', channel: 'Sitio web', clientId: null, resId: null, createdAt: '2026-07-14 09:00', bookStatus: 'cerrado', consumer: P1('Lucas Pereira', 'Pasaporte', 'FT882104', 'Rua Augusta 1200, São Paulo, Brasil', 'lucas.pereira@mail.com', '+55 11 98877 1020'), good: G('Tour Valle Sagrado compartido', 0, 'USD'), detail: 'El personal de la oficina de Cusco no respondió mis consultas por teléfono durante dos días antes del tour.', request: 'Mejorar la atención telefónica.', response: { decision: 'Procedente', text: 'Lamentamos la demora. Se implementó una guardia telefónica de 07:00 a 21:00 en la sede Cusco.', actions: 'Guardia telefónica y capacitación del personal.', at: '2026-07-20 10:00', by: 'U02', sentAt: '2026-07-20 10:02', sentTo: 'lucas.pereira@mail.com' }, closedAt: '2026-07-27 09:00', closeNote: 'Sin respuesta del consumidor en 5 días hábiles.', log: [{ ts: '2026-07-14 09:00', u: 'web', m: 'Hoja registrada (Sitio web)' }, { ts: '2026-07-20 10:02', u: 'U02', m: 'Respuesta enviada por email' }, { ts: '2026-07-27 09:00', u: 'U02', m: 'Cerrada' }] });
      S({ sede: 'SED-03', type: 'Reclamo', channel: 'Presencial', clientId: 'CLI-0004', resId: null, createdAt: '2026-09-01 11:15', bookStatus: 'en_evaluacion', consumer: P1('Mateo Núñez Carpio', 'DNI', '78451236', 'Calle Misti 214, Yanahuara, Arequipa', 'rcarpio@correo.pe', '959 330 118', true, { name: 'Rosa Carpio Delgado', docType: 'DNI', docNumber: '29654102', relation: 'Madre' }), good: G('Viaje de promoción Cusco 2026 — cuota de reserva', 180, 'PEN'), detail: 'Se pagó la cuota de reserva de S/ 180 para el viaje de promoción. El alumno no podrá viajar por motivos familiares y en la oficina de Arequipa indicaron que la cuota no es reembolsable, condición que no se informó al momento del pago.', request: 'Devolución de la cuota de reserva de S/ 180.', submittedBy: 'U03', log: [{ ts: '2026-09-01 11:15', u: 'U03', m: 'Hoja registrada (Presencial) por la apoderada' }, { ts: '2026-09-03 10:00', u: 'U02', m: 'En evaluación: se solicita al colegio el contrato del viaje de promoción' }] });
      S({ sede: 'SED-02', type: 'Reclamo', channel: 'Sitio web', clientId: 'CLI-0006', resId: 'RES-2026-000346', createdAt: '2026-09-27 18:30', bookStatus: 'respondido', consumer: P1('Sophie Martin', 'Pasaporte', '19FR22871', '12 Rue Mercière, Lyon, Francia', 'sophie.martin@mail.fr', '+33 6 12 34 56 78'), good: G('Full Day Laguna Humantay (RES-2026-000346)', 45, 'USD'), detail: 'El programa ofrecía 1 h 30 min en la laguna Humantay, pero el grupo solo permaneció 45 minutos por el retraso en la salida desde Cusco.', request: 'Devolución proporcional de US$ 45.', response: { decision: 'Procedente', text: 'Se verificó con el reporte del guía que la salida se retrasó 50 minutos por el recojo de pasajeros. Se reconoce la devolución de US$ 45 mediante extorno a su tarjeta en un plazo de 7 días hábiles.', actions: 'Extorno US$ 45. Ajuste del horario de recojo en Humantay.', at: '2026-09-29 10:20', by: 'U02', sentAt: '2026-09-29 10:22', sentTo: 'sophie.martin@mail.fr' }, log: [{ ts: '2026-09-27 18:30', u: 'web', m: 'Hoja registrada (Sitio web)' }, { ts: '2026-09-28 09:10', u: 'U02', m: 'En evaluación' }, { ts: '2026-09-29 10:22', u: 'U02', m: 'Respuesta enviada por email' }] });
      S({ sede: 'SED-01', type: 'Reclamo', channel: 'Portal del cliente', clientId: 'CLI-0001', resId: 'RES-2026-000344', createdAt: '2026-09-28 20:15', bookStatus: 'en_evaluacion', consumer: P1('Gabriela Ríos Montoya', 'DNI', '45781236', 'Calle Los Pinos 180, Surco, Lima', 'gabriela.rios@correo.pe', '999 102 334'), good: G('Paquete Machu Picchu 2D/1N (RES-2026-000344)', 510, 'USD'), detail: 'Pagué el anticipo de mi reserva en dos partes (Yape US$ 400 el 25/09 y transferencia Interbank por el saldo). El 28/09 recibí un recordatorio de deuda vencida que advierte la posible anulación de la reserva, lo cual no corresponde.', request: 'Que se valide mi transferencia, se corrija el estado de cuenta y se confirme por escrito que la reserva sigue vigente.', submittedBy: 'U14', log: [{ ts: '2026-09-28 20:15', u: 'U14', m: 'Hoja registrada (Portal del cliente)' }, { ts: '2026-09-29 08:50', u: 'U02', m: 'En evaluación: Finanzas valida PAG-01922' }] });
      S({ sede: 'SED-01', type: 'Queja', channel: 'Sitio web', clientId: 'CLI-0010', resId: null, createdAt: '2026-09-28 22:40', bookStatus: 'recibido', consumer: P1('Emily Johnson', 'Pasaporte', '58812290', '1450 Market St, San Francisco, EE. UU.', 'emily.j@mail.com', '+1 415 555 0192'), good: G('Pedido web WEB-10433 — Laguna Humantay', 0, 'PEN'), detail: 'Envié tres mensajes por WhatsApp y un formulario web entre el 25 y el 28/09 y no recibí respuesta sobre mi pago pendiente.', request: 'Que me contacten para completar el pago de mi pedido.', log: [{ ts: '2026-09-28 22:40', u: 'web', m: 'Hoja registrada (Sitio web)' }] });
      S({ sede: 'SED-02', type: 'Queja', channel: 'Portal del pasajero', clientId: 'CLI-0003', resId: 'RES-2026-000347', createdAt: '2026-09-29 07:40', bookStatus: 'recibido', consumer: P1('Thomas Keller', 'Pasaporte', 'C4F82991', 'Leopoldstraße 88, Múnich, Alemania', 't.keller@mail.de', '+49 171 5550102'), good: G('Programa Cusco aventura 6D (RES-2026-000347)', 0, 'USD'), detail: 'Al consultar en la oficina de Cusco por el paro anunciado para el 30/09, el personal de recepción me atendió con desinterés y no me dio información clara sobre las alternativas para mi visita a Machu Picchu.', request: 'Recibir por escrito el plan de contingencia y que se mejore la atención en la oficina.', submittedBy: 'U15', log: [{ ts: '2026-09-29 07:40', u: 'U15', m: 'Hoja registrada (Portal del pasajero)' }] });
      Store.save();
    }
    let dirty = false; books().forEach(c => { if (normalize(c)) dirty = true; }); if (dirty) Store.save();
  }

  const ownerOpts = () => DB.users.filter(u => u.status === 'activo' && Access.checkFor(u.role, 'crm/reclamaciones') && !Access.isExternal(u.role)).map(u => [u.id, u.name]);
  const canManage = () => can('crm.claims.manage') && !Auth.isExternal;
  const canConfig = () => can('admin.settings.manage');

  let lrTab = 'hojas';
  App.register('crm/reclamaciones', (el, params) => {
    ensureC();
    if (params[0] && !['hojas', 'reportes', 'configuracion'].includes(params[0])) return sheetPage(el, params[0]);
    if (params[0]) lrTab = params[0];
    const all = books(); const open = all.filter(c => ['recibido', 'en_evaluacion'].includes(c.bookStatus));
    const pl = open.map(plazo); const month = TODAY().slice(0, 7);
    const answered = all.filter(c => c.response && c.response.sentAt);
    const avg = answered.length ? sum(answered, c => bizBetween(c.createdAt.slice(0, 10), c.response.sentAt.slice(0, 10))) / answered.length : 0;
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Libro de reclamaciones', subtitle: 'Hojas de reclamación virtuales por sede. Plazo de respuesta: ' + cfg().responseDays + ' días hábiles (parámetro configurable). Validar normativa vigente con asesoría legal.',
      crumbs: [['Inicio', '#/dashboard'], ['CRM', Access.canRoute('crm/clientes') ? '#/crm/clientes' : ''], ['Libro de reclamaciones']],
      actions: '<a class="btn" href="#/libro-reclamaciones">' + UI.icon('eye') + 'Formulario público</a><button class="btn" id="lr-job">' + UI.icon('clock') + 'Alertar vencimientos</button><button class="btn primary" id="lr-new"' + (canManage() ? '' : needTip('crm.claims.manage')) + '>' + UI.icon('plus') + 'Registrar hoja presencial</button>' }) +
      (pl.some(p => p.code === 'vencido') ? UI.alert('bad', '<b>' + pl.filter(p => p.code === 'vencido').length + ' hoja(s) con plazo vencido.</b> El incumplimiento del plazo de respuesta es infracción sancionable por INDECOPI. Priorice su atención.') : '') +
      '<div class="grid g5">' +
      UI.kpi({ label: 'Hojas del mes', value: all.filter(c => c.createdAt.startsWith(month)).length, sub: all.filter(c => c.createdAt.startsWith(month) && c.type === 'Reclamo').length + ' reclamos · ' + all.filter(c => c.createdAt.startsWith(month) && c.type === 'Queja').length + ' quejas', tone: 'accent', icon: 'clipboard' }) +
      UI.kpi({ label: 'Abiertas', value: open.length, sub: 'Recibidas o en evaluación', tone: 'info', icon: 'clock' }) +
      UI.kpi({ label: 'Por vencer', value: pl.filter(p => p.code === 'por_vencer').length, sub: '≤ ' + cfg().alertDays + ' días hábiles', tone: 'sun', icon: 'alert' }) +
      UI.kpi({ label: 'Vencidas', value: pl.filter(p => p.code === 'vencido').length, sub: 'Sin respuesta en plazo', tone: pl.some(p => p.code === 'vencido') ? 'bad' : 'ok', icon: 'alert' }) +
      UI.kpi({ label: 'Tiempo medio de respuesta', value: fmtN(avg, 1) + ' d', sub: 'días hábiles · ' + answered.length + ' respondidas', tone: 'violet', icon: 'history' }) + '</div><div id="lr-tabs"></div></div>';
    UI.tabs(el.querySelector('#lr-tabs'), [
      { id: 'hojas', label: 'Hojas de reclamación', count: all.length, render: lrList },
      { id: 'reportes', label: 'Reportes', render: lrReports },
      { id: 'configuracion', label: 'Configuración', render: lrConfig }
    ], lrTab, { onChange: (id) => { lrTab = id; try { history.replaceState(null, '', '#/crm/reclamaciones/' + id); } catch (e) { } } });
    el.querySelector('#lr-new').onclick = () => { if (!canManage()) { UI.toast('Requiere permiso crm.claims.manage.', 'bad'); return; } internalSheetModal(); };
    el.querySelector('#lr-job').onclick = () => {
      const due = books().filter(c => ['recibido', 'en_evaluacion'].includes(c.bookStatus)).map(c => ({ c, p: plazo(c) })).filter(x => ['por_vencer', 'vencido'].includes(x.p.code));
      due.forEach(x => Notify.push('reclamacion.' + (x.p.code === 'vencido' ? 'vencida' : 'por_vencer'), 'Email', x.c.owner, 'Hoja ' + x.c.bookNo + ': ' + x.p.label));
      Audit.log('Job', 'claims:deadline-alerts', 'ejecutar', '', due.length + ' alerta(s)');
      UI.toast(due.length ? due.length + ' alerta(s) enviadas a los responsables (job diario 08:00).' : 'No hay hojas por vencer.', due.length ? 'ok' : 'info');
    };
  });

  function lrList(body) {
    body.innerHTML = '<div id="lr-dt" style="min-width:0"></div>';
    UI.dataTable(body.querySelector('#lr-dt'), {
      rows: books, exportName: 'libro_reclamaciones', defaultSort: 'createdAt', defaultDir: -1, pageSize: 10, searchPlaceholder: 'Buscar N° de hoja, consumidor, detalle…',
      search: c => [c.bookNo, c.id, c.consumer.name, c.consumer.docNumber, c.desc, c.request, Q.clientName(c.clientId), c.resId].join(' '),
      filters: [
        { key: 'type', label: 'Tipo', options: [['Reclamo', 'Reclamo'], ['Queja', 'Queja']] },
        { key: 'sede', label: 'Sede', options: DB.sedes.map(s => [s.id, s.name.split(' — ')[0]]) },
        { key: 'bookStatus', label: 'Estado', options: Object.keys(BK).map(k => [k, BK[k][1]]) },
        { key: 'pl', label: 'Plazo', options: [['en_plazo', 'En plazo'], ['por_vencer', 'Por vencer'], ['vencido', 'Vencido'], ['atendido', 'Respondido en plazo'], ['fuera', 'Respondido fuera de plazo']], match: (c, v) => plazo(c).code === v }
      ],
      columns: [
        { key: 'bookNo', label: 'Hoja', render: c => '<a class="mono" href="#/crm/reclamaciones/' + c.id + '">' + esc(c.bookNo) + '</a><div class="cell-sub">' + datetime(c.createdAt) + '</div>' },
        { key: 'type', label: 'Tipo', render: c => '<span class="tag">' + esc(c.type) + '</span><div class="cell-sub">' + esc(c.channel) + '</div>' },
        { key: 'consumer', label: 'Consumidor', render: c => '<div class="cell-main">' + esc(c.consumer.name) + (c.consumer.minor ? ' <span class="tag">Menor</span>' : '') + '</div><div class="cell-sub">' + (c.clientId ? esc(Q.clientName(c.clientId)) : 'Sin cliente vinculado') + '</div>', csv: c => c.consumer.name, sortVal: c => c.consumer.name },
        { key: 'desc', label: 'Detalle', render: c => '<div class="small" style="max-width:320px">' + esc(c.subject) + '</div>', csv: c => c.desc },
        { key: 'sede', label: 'Sede', render: c => '<span class="small">' + esc(Q.sedeName(c.sede).split(' — ')[0]) + '</span>', csv: c => Q.sedeName(c.sede) },
        { key: 'dueDate', label: 'Plazo', render: c => plazo(c).badge + '<div class="cell-sub">Vence ' + dateShort(c.dueDate) + '</div>', csv: c => c.dueDate },
        { key: 'bookStatus', label: 'Estado', render: c => bkBadge(c.bookStatus), csv: c => BK[c.bookStatus][1] }
      ],
      onRow: c => App.go('#/crm/reclamaciones/' + c.id)
    });
  }

  function lrReports(body) {
    const all = books(); const months = []; const x = parseD(TODAY());
    for (let i = 5; i >= 0; i--) { const d = new Date(x.getFullYear(), x.getMonth() - i, 1); months.push(d.getFullYear() + '-' + pad(d.getMonth() + 1, 2)); }
    const ML = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
    const bySede = DB.sedes.map(s => ({ label: s.name.split(' — ')[0], value: all.filter(c => c.sede === s.id).length }));
    const answered = all.filter(c => c.response && c.response.sentAt); const inTime = answered.filter(c => c.response.sentAt.slice(0, 10) <= c.dueDate);
    const overdue = all.filter(c => plazo(c).code === 'vencido');
    body.innerHTML = '<div class="grid g3">' +
      UI.card('Por tipo', UI.chart.donut({ items: [{ label: 'Reclamos', value: all.filter(c => c.type === 'Reclamo').length }, { label: 'Quejas', value: all.filter(c => c.type === 'Queja').length, color: 'var(--sun)' }], center: String(all.length), sub: 'hojas' })) +
      UI.card('Por sede', UI.chart.hbars({ items: bySede })) +
      UI.card('Cumplimiento del plazo', UI.chart.donut({ items: [{ label: 'Respondidas en plazo', value: inTime.length, color: 'var(--ok)' }, { label: 'Fuera de plazo', value: answered.length - inTime.length, color: 'var(--warn)' }, { label: 'Vencidas sin respuesta', value: overdue.length, color: 'var(--bad)' }], center: answered.length ? fmtN(inTime.length / answered.length * 100, 0) + '%' : '—', sub: 'en plazo' })) + '</div>' +
      UI.card('Hojas por mes y tipo', UI.chart.bars({ labels: months.map(m => ML[+m.slice(5) - 1]), stacked: true, series: [{ name: 'Reclamos', values: months.map(m => all.filter(c => c.type === 'Reclamo' && c.createdAt.startsWith(m)).length) }, { name: 'Quejas', values: months.map(m => all.filter(c => c.type === 'Queja' && c.createdAt.startsWith(m)).length), color: 'var(--sun)' }] }), { sub: 'Últimos 6 meses' }) +
      '<div id="lr-ov" style="min-width:0"></div><div style="height:16px"></div>' +
      UI.card('Reporte para INDECOPI', '<p class="small muted">Relación de hojas del periodo con número, fecha, tipo, consumidor, detalle, pedido, fecha y sentido de la respuesta. Se atiende ante requerimiento de la autoridad; en producción se genera por job en la cola <span class="mono">reports</span> (CSV/PDF) y queda auditado.</p><div class="row" style="margin-top:10px"><button class="btn" id="lr-ind">' + UI.icon('download') + 'Generar relación del año</button></div>');
    UI.dataTable(body.querySelector('#lr-ov'), {
      rows: () => overdue, exportName: 'reclamaciones_vencidas', pageSize: 6, searchPlaceholder: 'Buscar…', search: c => c.bookNo + ' ' + c.consumer.name,
      toolbar: '<b class="small" style="margin-right:6px">Vencidas sin respuesta</b>', empty: 'No hay hojas vencidas.',
      columns: [{ key: 'bookNo', label: 'Hoja', render: c => '<a class="mono" href="#/crm/reclamaciones/' + c.id + '">' + esc(c.bookNo) + '</a>' }, { key: 'type', label: 'Tipo' }, { key: 'consumer', label: 'Consumidor', render: c => esc(c.consumer.name), csv: c => c.consumer.name }, { key: 'dueDate', label: 'Venció', render: c => date(c.dueDate) + '<div class="cell-sub">' + esc(plazo(c).label) + '</div>' }, { key: 'owner', label: 'Responsable', render: c => esc(Q.userName(c.owner)), csv: c => Q.userName(c.owner) }]
    });
    body.querySelector('#lr-ind').onclick = () => {
      const rows = all.filter(c => c.createdAt.startsWith(TODAY().slice(0, 4))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const csv = ['N° hoja;Fecha;Sede;Tipo;Consumidor;Documento;Detalle;Pedido;Monto;Estado;Fecha respuesta;Sentido'].concat(rows.map(c => [c.bookNo, c.createdAt, Q.sedeName(c.sede), c.type, c.consumer.name, c.consumer.docType + ' ' + c.consumer.docNumber, c.desc, c.request, c.good.amount ? c.good.currency + ' ' + c.good.amount : '', BK[c.bookStatus][1], c.response ? c.response.sentAt || '' : '', c.response ? c.response.decision : ''].map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';'))).join('\n');
      Audit.log('Exportación', 'libro_reclamaciones_' + TODAY().slice(0, 4), 'exportar', '', rows.length + ' hojas');
      UI.modal({ title: 'Relación de hojas ' + TODAY().slice(0, 4), size: 'lg', body: '<p class="small muted" style="margin-bottom:10px">Vista previa (' + rows.length + ' hojas). En producción se genera como job y se descarga con URL firmada.</p><textarea class="input mono" rows="12" readonly>' + esc(csv) + '</textarea>', actions: [{ label: 'Cerrar' }] });
    };
  }

  function lrConfig(body) {
    const c = cfg(); const ok = canConfig();
    body.innerHTML = '<div class="grid g-2-1"><div style="min-width:0">' + UI.card('Parámetros del libro', (ok ? '' : UI.alert('info', 'Solo lectura: modificar parámetros requiere <span class="mono">admin.settings.manage</span> (Tenant Admin).')) +
      UI.form([
        { id: 'cf-days', label: 'Plazo de respuesta (días hábiles)', type: 'number', col: 4, required: true, value: c.responseDays, min: 1, max: 30, disabled: !ok, hint: 'Vigente: 15 días hábiles. Validar con asesoría legal.' },
        { id: 'cf-alert', label: 'Alerta previa (días hábiles)', type: 'number', col: 4, required: true, value: c.alertDays, min: 0, max: 10, disabled: !ok },
        { id: 'cf-ret', label: 'Conservación (años)', type: 'number', col: 4, value: c.retentionYears, min: 2, disabled: !ok },
        { id: 'cf-hol', label: 'Feriados nacionales (uno por línea, AAAA-MM-DD)', type: 'textarea', rows: 6, col: 12, value: c.holidays.join('\n'), disabled: !ok }
      ]) + (ok ? '<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="cf-save">' + UI.icon('check') + 'Guardar parámetros</button></div>' : '') + '<p class="xs faint" style="margin-top:10px">El nuevo plazo aplica a las hojas que se registren después del cambio; las existentes conservan su fecha de vencimiento (se calculó al recibirlas).</p>') + '</div>' +
      UI.card('Correlativos por sede', '<div class="list">' + DB.sedes.map(s => '<div class="list-item"><div class="ico-box">' + UI.icon('building') + '</div><div class="grow"><b class="small">' + esc(s.name) + '</b><div class="xs faint">Siguiente: <span class="mono">LR-' + SEDE_CODE[s.id] + '-' + TODAY().slice(0, 4) + '-' + pad(c.seq[s.id] || 1, 6) + '</span></div></div></div>').join('') + '</div><p class="xs faint" style="margin-top:10px">Numeración correlativa por establecimiento, sin saltos; en producción se asigna con <span class="mono">sys_sequences</span> y bloqueo FOR UPDATE.</p>') + '</div>';
    const b = body.querySelector('#cf-save'); if (b) b.onclick = () => {
      if (!UI.validate(body)) return; const d = UI.formData(body); const hol = String(d['cf-hol']).split(/\s+/).filter(Boolean);
      if (hol.some(h => !/^\d{4}-\d{2}-\d{2}$/.test(h))) { UI.toast('Revise el formato de feriados (AAAA-MM-DD).', 'bad'); return; }
      if (!(d['cf-days'] >= 1 && d['cf-days'] <= 30)) { UI.toast('El plazo debe estar entre 1 y 30 días hábiles.', 'bad'); return; }
      const before = c.responseDays + ' d / alerta ' + c.alertDays; c.responseDays = d['cf-days']; c.alertDays = d['cf-alert']; c.retentionYears = d['cf-ret'] || 2; c.holidays = hol;
      Audit.log('Configuración', 'claim_book', 'actualizar', before, c.responseDays + ' d / alerta ' + c.alertDays + ' / ' + hol.length + ' feriados'); Store.save(); UI.toast('Parámetros guardados.'); App.render();
    };
  }

  /* ---------------- Detalle de una hoja ---------------- */
  function sheetPage(el, id) {
    const c = books().find(x => x.id === id || x.bookNo === id);
    if (!c) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('La hoja ' + esc(id) + ' no existe.', 'clipboard')) + '</div>'; return; }
    const p = plazo(c); const idx = ['recibido', 'en_evaluacion', 'respondido', 'cerrado'].indexOf(c.bookStatus); const m = canManage(); const t = needTip('crm.claims.manage');
    const acts = [
      '<button class="btn" id="sh-doc">' + UI.icon('file') + 'Constancia</button>',
      c.bookStatus === 'recibido' ? '<button class="btn" id="sh-eval"' + (m ? '' : t) + '>' + UI.icon('arrowRight') + 'Iniciar evaluación</button>' : '',
      ['recibido', 'en_evaluacion'].includes(c.bookStatus) ? '<button class="btn primary" id="sh-resp"' + (m ? '' : t) + '>' + UI.icon('send') + 'Responder y enviar</button>' : '',
      c.bookStatus === 'respondido' ? '<button class="btn" id="sh-resend"' + (m ? '' : t) + '>' + UI.icon('mail') + 'Reenviar respuesta</button><button class="btn primary" id="sh-close"' + (m ? '' : t) + '>' + UI.icon('check') + 'Cerrar hoja</button>' : ''
    ].join('');
    const cons = c.consumer; const g = c.good; const r = c.response;
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Hoja ' + esc(c.bookNo), subtitle: esc(c.type) + ' · ' + esc(Q.sedeName(c.sede)) + ' · recibida ' + datetime(c.createdAt) + ' por ' + esc(c.channel), crumbs: [['Inicio', '#/dashboard'], ['Libro de reclamaciones', '#/crm/reclamaciones'], [c.bookNo]], actions: acts }) +
      UI.card('', UI.flow(['Recibido', 'En evaluación', 'Respondido', 'Cerrado'], c.bookStatus === 'cerrado' ? 4 : idx) + '<div class="row between" style="margin-top:12px;flex-wrap:wrap;gap:8px"><span class="lr-cnt">' + UI.icon('clock') + '<b>' + esc(p.label) + '</b> ' + p.badge + '</span><span class="small muted">Vencimiento legal: <b>' + date(c.dueDate) + '</b> (' + (c.responseDays || cfg().responseDays) + ' días hábiles desde la recepción)</span></div>' + (p.code === 'vencido' ? '<div style="margin-top:10px">' + UI.alert('bad', 'Plazo vencido sin respuesta. Responda de inmediato y documente la causa del retraso.') + '</div>' : '')) +
      '<div class="grid g2">' +
      UI.card('1. Consumidor reclamante', UI.dl([['Nombre', esc(cons.name) + (cons.minor ? ' <span class="tag">Menor de edad</span>' : '')], ['Documento', esc(cons.docType + ' ' + cons.docNumber)], ['Domicilio', esc(cons.address)], ['Correo', esc(cons.email)], ['Teléfono', esc(cons.phone)], cons.minor && cons.guardian ? ['Apoderado', esc(cons.guardian.name) + ' · ' + esc(cons.guardian.docType + ' ' + cons.guardian.docNumber) + (cons.guardian.relation ? ' · ' + esc(cons.guardian.relation) : '')] : null])) +
      UI.card('2. Bien contratado y vinculación', UI.dl([['Tipo', esc(g.kind)], ['Descripción', esc(g.description)], ['Monto reclamado', g.amount ? money(g.amount, g.currency) : '—'], ['Cliente', cliLink(c.clientId)], ['Reserva', resLink(c.resId)], ['Responsable', esc(Q.userName(c.owner))]]), { actions: '<button class="btn xs" id="sh-link"' + (m ? '' : t) + '>' + UI.icon('link') + 'Vincular</button>' }) + '</div>' +
      UI.card('3. Detalle de la reclamación', '<div class="upper" style="margin-bottom:4px">' + esc(c.type) + ' — ' + (c.type === 'Reclamo' ? 'disconformidad relacionada con el servicio' : 'malestar respecto a la atención') + '</div><p>' + esc(c.desc) + '</p><div class="upper" style="margin:12px 0 4px">Pedido del consumidor</div><p>' + esc(c.request || '—') + '</p>') +
      UI.card('4. Respuesta del proveedor', r ? UI.dl([['Sentido', '<b>' + esc(r.decision) + '</b>'], ['Respuesta', esc(r.text)], ['Acciones adoptadas', esc(r.actions || '—')], ['Respondió', esc(Q.userName(r.by)) + ' · ' + datetime(r.at)], ['Envío al consumidor', r.sentAt ? 'Email a ' + esc(r.sentTo) + ' · ' + datetime(r.sentAt) + (r.notificationId ? ' · <span class="mono">' + esc(r.notificationId) + '</span>' : '') : '<span class="faint">No enviado</span>']]) + (c.closedAt ? '<div style="margin-top:10px">' + UI.alert('ok', 'Cerrada el ' + datetime(c.closedAt) + ': ' + esc(c.closeNote || '')) + '</div>' : '') : UI.empty('Aún sin respuesta', 'send')) +
      '<div class="grid g2">' + UI.card('Historial', UI.timeline((c.log || []).slice().reverse().map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(l.u === 'web' ? 'Sitio web' : Q.userName(l.u)), icon: 'history' }))), { actions: '<button class="btn xs" id="sh-note"' + (m ? '' : t) + '>' + UI.icon('plus') + 'Nota interna</button>' }) +
      UI.card('Auditoría', UI.timeline(DB.audit.filter(a => a.entityId === c.id).slice(0, 10).map(a => ({ title: esc(a.action), meta: datetime(a.ts) + ' · ' + esc(Q.userName(a.user)), desc: esc(a.after), icon: 'shield' })))) + '</div></div>';
    const on = (s, fn) => { const x = el.querySelector(s); if (x) x.onclick = () => { if (s !== '#sh-doc' && !canManage()) { UI.toast('Requiere permiso crm.claims.manage.', 'bad'); return; } fn(); }; };
    on('#sh-doc', () => constancia(c));
    on('#sh-eval', () => UI.modal({ title: 'Iniciar evaluación', size: 'sm', body: UI.form([{ id: 'ev-owner', label: 'Responsable', type: 'select', col: 12, options: ownerOpts(), value: c.owner }, { id: 'ev-note', label: 'Nota', col: 12, value: 'Se solicita información a las áreas involucradas' }]), actions: [{ label: 'Cancelar' }, { label: 'Iniciar', cls: 'primary', onClick: (mm) => { const d = UI.formData(mm); const prev = c.owner; c.owner = d['ev-owner']; setBook(c, 'en_evaluacion', 'En evaluación: ' + (d['ev-note'] || '')); Audit.log('Libro de reclamaciones', c.id, 'evaluar', 'recibido', 'en_evaluacion · ' + Q.userName(c.owner)); if (prev !== c.owner) Notify.push('reclamacion.asignada', 'Portal', c.owner, 'Hoja ' + c.bookNo + ' asignada — vence ' + date(c.dueDate)); Store.save(); UI.toast('Hoja en evaluación.'); App.render(); } }] }));
    on('#sh-resp', () => respondModal(c));
    on('#sh-resend', () => { const n = sendResponse(c, true); UI.toast('Respuesta reenviada a ' + esc(c.consumer.email) + ' (' + n + ').'); App.render(); });
    on('#sh-close', () => UI.modal({ title: 'Cerrar hoja ' + esc(c.bookNo), size: 'sm', body: UI.form([{ id: 'cl-note', label: 'Motivo de cierre', type: 'select', col: 12, options: ['Consumidor conforme con la respuesta', 'Sin respuesta del consumidor en 5 días hábiles', 'Consumidor no conforme: se le informa su derecho de acudir a INDECOPI', 'Solución aplicada (reembolso / nota de crédito ejecutada)'] }, { id: 'cl-obs', label: 'Observación', col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Cerrar hoja', cls: 'primary', onClick: (mm) => { const d = UI.formData(mm); c.closedAt = nowStr(); c.closeNote = d['cl-note'] + (d['cl-obs'] ? ' — ' + d['cl-obs'] : ''); c.resolution = (c.response ? c.response.decision + ': ' + c.response.text : '') ; setBook(c, 'cerrado', 'Cerrada: ' + c.closeNote); Audit.log('Libro de reclamaciones', c.id, 'cerrar', 'respondido', 'cerrado · ' + d['cl-note']); Store.save(); UI.toast('Hoja cerrada.'); App.render(); } }] }));
    on('#sh-link', () => linkModal(c));
    on('#sh-note', () => UI.modal({ title: 'Nota interna', size: 'sm', body: UI.form([{ id: 'nt', label: 'Nota (no se envía al consumidor)', type: 'textarea', rows: 3, col: 12, required: true }]), actions: [{ label: 'Cancelar' }, { label: 'Agregar', cls: 'primary', onClick: (mm) => { if (!UI.validate(mm)) return false; c.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Nota: ' + UI.formData(mm).nt }); Store.save(); App.render(); } }] }));
  }
  function sendResponse(c, again) {
    const to = c.consumer.minor && c.consumer.guardian && !c.consumer.email ? c.consumer.guardian.name : c.consumer.email;
    Notify.push('reclamacion.respuesta', 'Email', to, 'Respuesta a su ' + c.type.toLowerCase() + ' — Hoja ' + c.bookNo);
    const n = DB.notifications[0].id; c.response.sentAt = nowStr(); c.response.sentTo = to; c.response.notificationId = n;
    c.log.push({ ts: nowStr(), u: Auth.user.id, m: (again ? 'Respuesta reenviada' : 'Respuesta enviada') + ' por email a ' + to + ' (' + n + ')' });
    Audit.log('Libro de reclamaciones', c.id, again ? 'reenviar_respuesta' : 'enviar_respuesta', '', to + ' · ' + n); Store.save(); return n;
  }
  function respondModal(c) {
    if (!c.consumer.email) { UI.toast('La hoja no tiene correo del consumidor: registre el medio de envío antes de responder.', 'bad'); return; }
    UI.modal({ title: 'Responder hoja ' + esc(c.bookNo), sub: 'La respuesta se envía al correo consignado por el consumidor y queda registrada con fecha y hora.',
      body: UI.alert('info', '<b>Pedido:</b> ' + esc(c.request || '—')) + '<div style="height:10px"></div>' + UI.form([
        { id: 'rs-dec', label: 'Sentido de la respuesta', type: 'select', col: 6, options: DECISIONS },
        { id: 'rs-to', label: 'Enviar a', col: 6, value: c.consumer.email, disabled: true },
        { id: 'rs-text', label: 'Respuesta al consumidor', type: 'textarea', rows: 5, col: 12, required: true, placeholder: 'Hechos verificados, conclusión y solución ofrecida…' },
        { id: 'rs-act', label: 'Observaciones y acciones adoptadas por el proveedor', type: 'textarea', rows: 2, col: 12, required: true }
      ]),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar y enviar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m);
        if (d['rs-text'].length < 40) { UI.toast('La respuesta debe ser clara y motivada (mínimo 40 caracteres).', 'bad'); return false; }
        const prev = c.bookStatus; c.response = { decision: d['rs-dec'], text: d['rs-text'], actions: d['rs-act'], at: nowStr(), by: Auth.user.id };
        c.resolution = d['rs-dec'] + ': ' + d['rs-text'];
        setBook(c, 'respondido', 'Respuesta registrada (' + d['rs-dec'] + ')'); sendResponse(c);
        Audit.log('Libro de reclamaciones', c.id, 'responder', prev, 'respondido · ' + d['rs-dec'] + (plazo(c).code === 'fuera' ? ' · FUERA DE PLAZO' : ''));
        Store.save(); UI.toast('Respuesta enviada a ' + esc(c.consumer.email) + '.' + (plazo(c).code === 'fuera' ? ' Registrada fuera de plazo.' : ''), plazo(c).code === 'fuera' ? 'warn' : 'ok'); App.render();
      } }] });
  }
  function linkModal(c) {
    const resOf = (cid) => DB.reservations.filter(r => r.clientId === cid).map(r => [r.id, r.id + ' · ' + r.title]);
    UI.modal({ title: 'Vincular cliente y reserva', size: 'sm', body: UI.form([{ id: 'lk-cli', label: 'Cliente', type: 'select', col: 12, placeholder: 'Sin cliente', options: DB.clients.map(x => [x.id, x.name]), value: c.clientId }, { id: 'lk-res', label: 'Reserva', type: 'select', col: 12, placeholder: 'Sin reserva', options: c.clientId ? resOf(c.clientId) : [], value: c.resId }]),
      onOpen: (m) => { m.querySelector('#lk-cli').onchange = (e) => { m.querySelector('#lk-res').innerHTML = '<option value="">Sin reserva</option>' + resOf(e.target.value).map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join(''); }; },
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { const d = UI.formData(m); const before = (c.clientId || '—') + ' / ' + (c.resId || '—'); c.clientId = d['lk-cli'] || null; c.resId = d['lk-res'] || null; c.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Vinculada a ' + (c.clientId ? Q.clientName(c.clientId) : 'sin cliente') + (c.resId ? ' / ' + c.resId : '') }); Audit.log('Libro de reclamaciones', c.id, 'vincular', before, (c.clientId || '—') + ' / ' + (c.resId || '—')); Store.save(); UI.toast('Vinculación actualizada. La hoja aparece en el Cliente 360.'); App.render(); } }] });
  }

  function constanciaHtml(c) {
    const s = Q.sede(c.sede) || {}; const cons = c.consumer; const g = c.good; const r = c.response;
    const row = (l, v) => '<tr><td style="width:34%;color:#5b6f77">' + l + '</td><td>' + v + '</td></tr>';
    return '<div class="doc"><div class="doc-head"><div><h2>' + esc(DB.tenant.name) + '</h2><div class="muted">RUC ' + esc(DB.tenant.ruc) + '<br>' + esc(s.address || '') + '</div></div><div style="text-align:right"><h3>LIBRO DE RECLAMACIONES</h3><div class="muted">Hoja de reclamación</div><div style="font-family:var(--f-mono);font-size:.95rem;margin-top:4px">' + esc(c.bookNo) + '</div><div class="muted">Fecha: ' + datetime(c.createdAt) + '</div></div></div>' +
      '<h3 style="margin-top:4px">1. Identificación del consumidor reclamante</h3><table><tbody>' + row('Nombre', esc(cons.name)) + row('Documento', esc(cons.docType + ' ' + cons.docNumber)) + row('Domicilio', esc(cons.address)) + row('Teléfono / correo', esc(cons.phone) + ' · ' + esc(cons.email)) + (cons.minor && cons.guardian ? row('Padre, madre o apoderado', esc(cons.guardian.name) + ' · ' + esc(cons.guardian.docType + ' ' + cons.guardian.docNumber)) : '') + '</tbody></table>' +
      '<h3>2. Identificación del bien contratado</h3><table><tbody>' + row('Producto / Servicio', esc(g.kind)) + row('Descripción', esc(g.description)) + row('Monto reclamado', g.amount ? money(g.amount, g.currency) : '—') + '</tbody></table>' +
      '<h3>3. Detalle de la reclamación y pedido del consumidor</h3><table><tbody>' + row('Tipo', '<b>' + esc(c.type) + '</b> — ' + (c.type === 'Reclamo' ? 'disconformidad relacionada a los productos o servicios' : 'disconformidad no relacionada a los productos o servicios; o malestar o descontento respecto a la atención al público')) + row('Detalle', esc(c.desc)) + row('Pedido', esc(c.request || '—')) + '</tbody></table>' +
      '<h3>4. Observaciones y acciones adoptadas por el proveedor</h3><table><tbody>' + (r ? row('Fecha de comunicación de la respuesta', r.sentAt ? datetime(r.sentAt) : '—') + row('Respuesta', esc(r.decision) + '. ' + esc(r.text)) + row('Acciones adoptadas', esc(r.actions || '—')) : row('Estado', 'Pendiente de respuesta. Plazo máximo: ' + date(c.dueDate))) + '</tbody></table>' +
      '<p class="muted" style="font-size:.74rem;margin-top:14px">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI. El proveedor deberá dar respuesta al reclamo en un plazo no mayor a ' + (c.responseDays || cfg().responseDays) + ' días hábiles. Constancia enviada al correo del consumidor al momento del registro. Referencia normativa: Ley N.° 29571, Código de Protección y Defensa del Consumidor, y Reglamento del Libro de Reclamaciones (D.S. N.° 011-2011-PCM y modificatorias). <b>Validar normativa vigente con asesoría legal.</b></p></div>';
  }
  function constancia(c, preview) {
    UI.modal({ title: preview ? 'Vista previa de la constancia (no registrada)' : 'Constancia · ' + esc(c.bookNo), size: 'lg', sub: 'Documento que recibe el consumidor por correo. En producción se genera PDF por job (cola documents) con hash en sys_documents.', body: constanciaHtml(c), actions: [{ label: 'Cerrar' }] });
  }

  /* ---------------- Formulario (portal cliente/pasajero, registro presencial, vista previa) ---------------- */
  function sheetForm(preset) {
    preset = preset || {};
    const sedeOpts = DB.sedes.filter(s => s.status === 'activa').map(s => [s.id, s.name + ' — ' + s.address]);
    return '<div class="section-title">Identificación del proveedor</div><div class="small muted" style="margin-bottom:10px">' + esc(DB.tenant.name) + ' · RUC ' + esc(DB.tenant.ruc) + ' · Fecha ' + date(TODAY()) + ' · N° de hoja: se asigna al enviar</div>' +
      UI.form([
        { id: 'lr_sede', label: 'Establecimiento (sede)', type: 'select', col: 12, required: true, options: sedeOpts, value: preset.sede || 'SED-01' },
        { type: 'section', label: '1. Identificación del consumidor reclamante' },
        { id: 'lr_name', label: 'Nombre completo', col: 6, required: true, value: preset.name },
        { id: 'lr_dtype', label: 'Tipo de documento', type: 'select', col: 3, options: DOC_TYPES.slice(0, 3), value: preset.docType || 'DNI' },
        { id: 'lr_dnum', label: 'N° de documento', col: 3, required: true, value: preset.docNumber },
        { id: 'lr_addr', label: 'Domicilio', col: 12, required: true, value: preset.address },
        { id: 'lr_email', label: 'Correo electrónico (recibirá la constancia y la respuesta)', type: 'email', col: 7, required: true, value: preset.email },
        { id: 'lr_phone', label: 'Teléfono', col: 5, value: preset.phone },
        { id: 'lr_minor', label: 'El consumidor es menor de edad (completar datos del padre, madre o apoderado)', type: 'checkbox', col: 12 }
      ]) +
      '<div id="lr-guard" hidden>' + UI.form([
        { id: 'lr_gname', label: 'Nombre del padre, madre o apoderado *', col: 6 },
        { id: 'lr_gdtype', label: 'Tipo de documento', type: 'select', col: 3, options: DOC_TYPES.slice(0, 3) },
        { id: 'lr_gdnum', label: 'N° de documento *', col: 3 }
      ]) + '</div>' +
      UI.form([
        { type: 'section', label: '2. Identificación del bien contratado' },
        { id: 'lr_kind', label: 'Tipo', type: 'select', col: 3, options: ['Servicio', 'Producto'] },
        { id: 'lr_res', label: 'Reserva o servicio contratado', type: 'select', col: 9, placeholder: preset.resOpts && preset.resOpts.length ? 'Seleccione (opcional)' : 'Sin reserva vinculada', options: preset.resOpts || [], value: preset.resId },
        { id: 'lr_gdesc', label: 'Descripción del servicio', col: 6, required: true, value: preset.goodDesc },
        { id: 'lr_amt', label: 'Monto reclamado', type: 'number', col: 3, step: '0.01', min: 0 },
        { id: 'lr_cur', label: 'Moneda', type: 'select', col: 3, options: ['PEN', 'USD'] },
        { type: 'section', label: '3. Detalle de la reclamación y pedido del consumidor' },
        { type: 'html', col: 12, html: '<div class="lr-type" role="radiogroup" aria-label="Tipo"><label><input type="radio" name="lr_type" value="Reclamo" checked><span><b>Reclamo</b><span class="xs muted">Disconformidad relacionada con el servicio contratado.</span></span></label><label><input type="radio" name="lr_type" value="Queja"><span><b>Queja</b><span class="xs muted">Malestar o descontento respecto a la atención al público.</span></span></label></div>' },
        { id: 'lr_detail', label: 'Detalle', type: 'textarea', rows: 4, col: 12, required: true },
        { id: 'lr_request', label: 'Pedido', type: 'textarea', rows: 2, col: 12, required: true },
        { id: 'lr_accept', label: 'Acepto que la constancia y la respuesta se envíen al correo electrónico consignado.', type: 'checkbox', col: 12 }
      ]) +
      '<div class="lr-legal" style="margin-top:12px"><p>La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.</p><p>El proveedor deberá dar respuesta al reclamo o queja en un plazo no mayor a <b>' + cfg().responseDays + ' días hábiles</b>. Sus datos se tratan conforme a la Ley N.° 29733 de Protección de Datos Personales.</p></div>';
  }
  function bindSheetForm(root) {
    const mi = root.querySelector('#lr_minor'); const gd = root.querySelector('#lr-guard');
    mi.onchange = () => { gd.hidden = !mi.checked; };
    const rs = root.querySelector('#lr_res'); const gdesc = root.querySelector('#lr_gdesc');
    if (rs) rs.onchange = () => { const r = Q.reservation(rs.value); if (r && !gdesc.value) gdesc.value = r.title + ' (' + r.id + ')'; };
  }
  function readSheetForm(root) {
    if (!UI.validate(root)) return null;
    const d = UI.formData(root); const type = (root.querySelector('input[name=lr_type]:checked') || {}).value || 'Reclamo';
    const bad = (sel, msg) => { const x = root.querySelector(sel); if (x) x.classList.add('err'); UI.toast(msg, 'bad'); return null; };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.lr_email)) return bad('#lr_email', 'Ingrese un correo electrónico válido.');
    if (d.lr_dtype === 'DNI' && !/^\d{8}$/.test(d.lr_dnum)) return bad('#lr_dnum', 'El DNI debe tener 8 dígitos.');
    if (d.lr_minor && (!d.lr_gname || !d.lr_gdnum)) return bad('#lr_gname', 'Consumidor menor de edad: complete nombre y documento del padre, madre o apoderado (LR-BR-04).');
    if (d.lr_amt !== '' && d.lr_amt < 0) return bad('#lr_amt', 'El monto no puede ser negativo.');
    if (d.lr_detail.length < 20) return bad('#lr_detail', 'Describa el detalle con al menos 20 caracteres.');
    if (!d.lr_accept) { UI.toast('Debe aceptar el envío de la constancia y la respuesta por correo.', 'bad'); return null; }
    return { sede: d.lr_sede, type, resId: d.lr_res || null, detail: d.lr_detail, request: d.lr_request,
      consumer: { name: d.lr_name, docType: d.lr_dtype, docNumber: d.lr_dnum, address: d.lr_addr, email: d.lr_email, phone: d.lr_phone, minor: !!d.lr_minor, guardian: d.lr_minor ? { name: d.lr_gname, docType: d.lr_gdtype, docNumber: d.lr_gdnum, relation: 'Apoderado' } : null },
      good: { kind: d.lr_kind, description: d.lr_gdesc, amount: d.lr_amt === '' ? 0 : r2(d.lr_amt), currency: d.lr_cur } };
  }
  function internalSheetModal() {
    UI.modal({ title: 'Registrar hoja presencial', size: 'lg', sub: 'El consumidor formula su reclamo en la sede y el personal lo transcribe en el libro virtual. Se entrega constancia por correo.',
      body: sheetForm({ sede: Auth.user.sede, resOpts: DB.reservations.map(r => [r.id, r.id + ' · ' + r.title + ' · ' + Q.clientName(r.clientId)]) }),
      onOpen: (m) => bindSheetForm(m),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar hoja', cls: 'primary', onClick: (m) => {
        const d = readSheetForm(m); if (!d) return false;
        const r = d.resId ? Q.reservation(d.resId) : null;
        const c = register(Object.assign(d, { channel: 'Presencial', clientId: r ? r.clientId : (DB.clients.find(x => x.email === d.consumer.email) || {}).id || null, submittedBy: Auth.user.id }));
        UI.toast('Hoja ' + c.bookNo + ' registrada. Constancia enviada a ' + esc(c.consumer.email) + '.'); App.go('#/crm/reclamaciones/' + c.id);
      } }] });
  }

  App.register('libro-reclamaciones', (el) => {
    ensureC();
    const ext = Auth.isExternal; const preview = !ext;
    const cid = Auth.clientId; const cl = cid ? Q.client(cid) : null;
    const mine = ext ? books().filter(c => (cid && c.clientId === cid) || (c.consumer && c.consumer.email && Auth.user && c.consumer.email === Auth.user.email)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
    const resOpts = ext && cid ? DB.reservations.filter(r => r.clientId === cid && r.status !== 'borrador').map(r => [r.id, r.id + ' · ' + r.title]) : DB.reservations.slice(0, 0);
    const docP = cl && cl.doc ? String(cl.doc).split(' ') : [];
    const preset = ext ? { name: Auth.user.name, email: Auth.user.email, phone: Auth.user.phone, docType: docP[0] === 'Pasaporte' || docP[0] === 'Passport' ? 'Pasaporte' : 'DNI', docNumber: docP.slice(1).join(' '), address: cl ? (cl.city + ', ' + cl.country) : '', sede: Auth.user.sede, resOpts, resId: Auth.user.resId || '' } : { sede: Auth.user.sede };
    el.innerHTML = '<div class="page" style="max-width:980px;margin:0 auto;width:100%">' + UI.pageHeader({ title: 'Libro de Reclamaciones', subtitle: esc(DB.tenant.name) + ' · RUC ' + esc(DB.tenant.ruc) + '. Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, contamos con un Libro de Reclamaciones a su disposición.', crumbs: preview ? [['Libro de reclamaciones', '#/crm/reclamaciones'], ['Formulario público']] : [] }) +
      (preview ? UI.alert('info', '<b>Vista previa del formulario público.</b> Así lo ven clientes y pasajeros desde su portal (y el sitio web). Al enviar desde aquí solo se valida y se muestra la constancia; no se registra ninguna hoja. Para registrar un reclamo presencial use <a href="#/crm/reclamaciones">Registrar hoja presencial</a>.') : '') +
      (ext ? UI.card('Mis hojas de reclamación', mine.length ? '<div class="col" style="gap:10px">' + mine.map(c => { const p = plazo(c); return '<div class="lr-sheet"><div class="row between" style="gap:8px"><b class="mono">' + esc(c.bookNo) + '</b>' + bkBadge(c.bookStatus) + '</div><div class="small">' + esc(c.type) + ' · ' + datetime(c.createdAt) + ' · ' + esc(Q.sedeName(c.sede)) + '</div><div class="small muted">' + esc(c.subject) + '</div>' + (c.response && c.response.sentAt ? UI.alert('ok', '<b>Respuesta (' + datetime(c.response.sentAt) + '):</b> ' + esc(c.response.text)) : '<div class="xs faint">Respuesta a más tardar el ' + date(c.dueDate) + (p.code === 'vencido' ? ' (plazo vencido)' : '') + '</div>') + '<div><button class="btn xs" data-cons="' + c.id + '">' + UI.icon('file') + 'Ver constancia</button></div></div>'; }).join('') + '</div>' : UI.empty('No ha registrado hojas de reclamación.', 'clipboard'), { sub: 'Estado y respuesta de sus reclamos y quejas' }) : '') +
      UI.card('Hoja de reclamación virtual', '<form id="lr-form" novalidate>' + sheetForm(preset) + '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" type="submit">' + UI.icon('send') + (preview ? 'Validar y ver constancia (vista previa)' : 'Enviar hoja de reclamación') + '</button></div></form>') + '</div>';
    const f = el.querySelector('#lr-form'); bindSheetForm(f);
    el.querySelectorAll('[data-cons]').forEach(b => b.onclick = () => constancia(books().find(x => x.id === b.dataset.cons)));
    f.onsubmit = (e) => {
      e.preventDefault(); const d = readSheetForm(f); if (!d) return;
      if (preview) { const fake = Object.assign({ bookNo: 'LR-' + (SEDE_CODE[d.sede] || 'WEB') + '-' + TODAY().slice(0, 4) + '-' + pad(cfg().seq[d.sede] || 1, 6) + ' (vista previa)', createdAt: nowStr(), channel: 'Vista previa', dueDate: addBiz(TODAY(), cfg().responseDays), responseDays: cfg().responseDays, desc: d.detail, response: null }, d); constancia(fake, true); return; }
      const c = register(Object.assign(d, { channel: Auth.role === 'passenger' ? 'Portal del pasajero' : 'Portal del cliente', clientId: cid || null, submittedBy: Auth.user.id }));
      UI.toast('Hoja ' + c.bookNo + ' registrada. Enviamos la constancia a ' + esc(c.consumer.email) + '.');
      App.render(); setTimeout(() => constancia(c), 60);
    };
  });
})();
