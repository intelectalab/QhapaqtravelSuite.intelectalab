/* Finanzas — PROC-040 a PROC-050
   Cotización → Reserva → Anticipo → Cobros → Facturación → Costos → Pagos a proveedores → Comisiones → Rentabilidad → Liquidación / cierre
   Montos en moneda original con TC conservado (Regla transversal 15); consolidación en soles. */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr, groupBy } = Util;

  /* ---------------- Estilos propios (solo variables del tema) ---------------- */
  function css() {
    cxpNorm();
    if (document.getElementById('css-finanzas')) return;
    const s = document.createElement('style'); s.id = 'css-finanzas';
    s.textContent = '.fz-sem{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:0;background:var(--fg-3)}.fz-sem.r{background:var(--bad)}.fz-sem.a{background:var(--warn)}.fz-sem.g{background:var(--ok)}' +
      '.fz-neg{color:var(--bad)}.fz-pos{color:var(--ok)}' +
      '.fz-check{display:flex;gap:8px;align-items:flex-start;font-size:.82rem;padding:4px 0;color:var(--fg)}.fz-check svg{width:16px;height:16px;flex:none;margin-top:2px}.fz-check.ok svg{color:var(--ok)}.fz-check.bad svg{color:var(--bad)}.fz-check.info svg{color:var(--info)}' +
      '.fz-file{position:relative;overflow:hidden}.fz-file input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}' +
      '.fz-aging{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.fz-aging>div{border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;min-width:0}.fz-aging b{display:block;font-size:.95rem;font-variant-numeric:tabular-nums}' +
      '@media (max-width:560px){.fz-aging{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '.fz-proc{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.76rem;color:var(--fg-2)}.fz-proc span.st{padding:2px 8px;border-radius:5px;background:var(--surface-3);border:1px solid var(--line-2);white-space:nowrap}.fz-proc span.ar{color:var(--fg-3)}' +
      '[data-noperm]{display:none!important}' +
      '.fz-radio{display:flex;gap:8px;align-items:flex-start;padding:9px 10px;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:.84rem}.fz-radio input{margin-top:3px;accent-color:var(--accent)}';
    document.head.appendChild(s);
  }

  /* ---------------- Utilidades locales ---------------- */
  const TODAY = () => window.TODAY;
  const MONTH = () => window.TODAY.slice(0, 7);
  const FX = () => DB.settings.fx || 3.74;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fxOf = (o) => (o && o.fx) || FX();
  const pen = (amt, cur, fx) => cur === 'USD' ? (fx ? (amt || 0) * fx : toPEN(amt || 0, 'USD')) : (amt || 0);
  const penOf = (o, amt) => pen(amt == null ? o.amount : amt, o.currency, o.fx);
  const S = (n, d) => money(n, 'PEN', d);
  const kS = (n) => 'S/ ' + fmtN(n / 1000, 1) + 'k';
  const bal = (o) => r2((o.amount || 0) - (o.paid || 0));
  const fxLine = (amt, cur, fx) => cur === 'USD' ? '<div class="xs faint num nowrap">TC ' + fmtN(fx || FX(), 3) + ' · ' + S(pen(amt, cur, fx || FX())) + '</div>' : '';
  const amtCell = (amt, cur, fx) => '<span class="num nowrap">' + money(amt, cur) + '</span>' + fxLine(amt, cur, fx);
  const proc = (steps) => '<div class="fz-proc">' + steps.map((s, i) => '<span class="st">' + esc(s) + '</span>' + (i < steps.length - 1 ? '<span class="ar">→</span>' : '')).join('') + '</div>';
  const sem = (pct) => '<span class="nowrap"><span class="fz-sem ' + (pct < 15 ? 'r' : pct <= 25 ? 'a' : 'g') + '"></span>' + fmtN(pct, 1) + '%</span>';
  const check = (ok, html) => '<div class="fz-check ' + (ok === true ? 'ok' : ok === 'info' ? 'info' : 'bad') + '">' + UI.icon(ok === true ? 'checkCircle' : ok === 'info' ? 'info' : 'alert') + '<div>' + html + '</div></div>';
  const miniTable = (heads, rows, empty) => rows.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr>' + heads.map(h => '<th class="' + (h[1] || '') + '">' + esc(h[0]) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : UI.empty(empty || 'Sin registros', 'box');
  const nextId = (arr, prefix, width) => { let max = 0; arr.forEach(x => { const id = String(x.id); if (!id.startsWith(prefix)) return; const m = id.slice(prefix.length).match(/^(\d+)$/); if (m) max = Math.max(max, +m[1]); }); return prefix + String(max + 1).padStart(width, '0'); };
  const hist = (o, status, note) => { o.history = o.history || []; o.history.push({ ts: nowStr(), status, user: Auth.user ? Auth.user.id : 'Sistema', note: note || '' }); };

  /* Enlaces cruzados: solo se enlaza si el rol puede abrir la pantalla destino (Access); si no, texto plano. */
  const lk = (route, id, html, cls) => Access.canRoute(route) ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="#/' + route + '/' + encodeURIComponent(id) + '">' + html + '</a>' : '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</span>';
  const resLink = (id) => id ? lk('reservas', id, esc(id), 'mono') : '<span class="faint">—</span>';
  const cliLink = (id) => id && Q.client(id) ? lk('crm/clientes', id, esc(Q.clientName(id))) : '<span class="faint">—</span>';
  const prvLink = (id) => id && Q.provider(id) ? lk('catalogo/proveedores', id, esc(Q.providerName(id))) : '<span class="faint">—</span>';
  const cxcLink = (id) => id ? lk('finanzas/cobros', id, esc(id), 'mono') : '<span class="faint">—</span>';
  const payLink = (id) => lk('finanzas/pagos', id, esc(id), 'mono');
  const cxpLink = (id) => lk('finanzas/proveedores', id, esc(id), 'mono');
  const invLink = (id) => lk('finanzas/facturacion', id, esc(id), 'mono');
  const agencyOfClient = (cid) => DB.b2bAgencies.find(a => a.clientId === cid);
  const benLabel = (c) => { if (c.kind === 'Agencia B2B') { const a = Q.agency(c.beneficiary); return '<a href="#/canales/b2b">' + esc(a ? a.name : c.beneficiary) + '</a>'; } return UI.userChip(c.beneficiary); };
  const benText = (c) => c.kind === 'Agencia B2B' ? ((Q.agency(c.beneficiary) || {}).name || c.beneficiary) : Q.userName(c.beneficiary);

  function header(title, sub, label, actions) {
    return UI.pageHeader({ title, subtitle: sub, crumbs: [['Inicio', '#/dashboard'], ['Finanzas', '#/finanzas/cobros'], [label]].concat([]), actions });
  }
  function guard(el, perm, title) {
    if (Auth.can(perm)) return true;
    el.innerHTML = '<div class="page">' + header(title, '', title) + UI.alert('warn', 'Su rol <b>' + esc(Q.roleName(Auth.role)) + '</b> no tiene el permiso <span class="mono">' + perm + '</span> para ver esta pantalla. El backend valida la autorización en cada solicitud (Regla transversal 17).') + '</div>';
    return false;
  }
  function need(perm, what) {
    if (Auth.can(perm)) return true;
    UI.toast('Sin permiso para ' + what + ': requiere <span class="mono">' + perm + '</span> (Regla transversal 17).', 'bad');
    return false;
  }
  /* Acciones sin permiso: se ocultan (data-noperm). Las funciones de acción re-validan con need() → toast 'bad'. */
  const dis = (perm) => Auth.can(perm) ? '' : ' disabled data-noperm title="Requiere ' + perm + '"';
  /* Perfil operativo de tesorería: registrar/aplicar pagos, anticipos, recordatorios, pagos a proveedores y comisiones, liquidar.
     Finanzas (y Tenant Admin) lo tienen; Manager supervisa en solo lectura + aprobaciones; Contabilidad factura y consulta. */
  const OP = 'finance.payments.register';
  const canOp = () => Auth.can(OP);
  const cols = (arr) => arr.filter(c => c && !c.hide);
  function roleNote(page) {
    const r = Auth.role;
    if (r === 'manager') return UI.alert('info', '<b>Modo supervisión (Manager):</b> consulta de todo el módulo financiero en solo lectura' + (page === 'cxp' ? '; puede <b>aprobar cuentas por pagar y costos</b> (finance.payables)' : page === 'com' ? '; puede <b>aprobar comisiones</b> (finance.commissions)' : '') + '. El registro de pagos, anticipos y pagos a proveedores corresponde a Finanzas (requiere <span class="mono">' + OP + '</span>); la emisión de comprobantes, a Contabilidad.');
    if (r === 'accounting') return UI.alert('info', '<b>Contabilidad:</b> ' + (page === 'inv' ? 'emisión, corrección y entrega de comprobantes electrónicos.' : 'consulta de cuentas por cobrar y pagos para facturar. Registrar, aplicar o revertir pagos corresponde a Finanzas (requiere <span class="mono">' + OP + '</span>).'));
    return '';
  }
  function refresh(fn) { App.render(); if (fn) fn(); }
  function auditTimeline(ids) {
    const set = new Set(ids);
    const items = DB.audit.filter(a => set.has(a.entityId)).slice(0, 14).map(a => ({ title: esc(a.entity) + ' · ' + esc(String(a.action).replace(/_/g, ' ')) + ' <span class="mono xs faint">' + esc(a.entityId) + '</span>', meta: datetime(a.ts) + ' · ' + esc(Q.userName(a.user)), desc: esc((a.before ? a.before + ' → ' : '') + (a.after || '')), icon: 'history' }));
    return UI.timeline(items);
  }

  /* ================= Cuentas por cobrar (PROC-040 / 041 / 042) ================= */
  function cxcStatus(r) {
    if (r.status === 'cancelada') return 'cancelada';
    if (bal(r) <= 0) return 'pagada';
    if (r.due < TODAY()) return 'vencida';
    return (r.paid || 0) > 0 ? 'parcial' : 'abierta';
  }
  function recalcCxC(r) { r.paid = r2(sum(DB.payments.filter(p => p.receivableId === r.id && p.status === 'aplicado'), 'amount')); r.status = cxcStatus(r); }
  function syncResStatus(resId) {
    const res = Q.reservation(resId); if (!res) return;
    const list = DB.receivables.filter(x => x.resId === resId && x.status !== 'cancelada');
    if (res.status === 'pendiente_pago' && list.length && list.every(x => cxcStatus(x) === 'pagada')) {
      res.status = 'confirmada';
      Audit.log('Reserva', res.id, 'cambio_estado', 'pendiente_pago', 'confirmada (obligaciones pagadas)');
    }
  }
  function cxcFlow(r) {
    const st = cxcStatus(r); const steps = ['Cargo', 'Obligación', 'Vencimiento', 'Pago', 'Aplicación', 'Saldo', 'Pagada'];
    if (st === 'pagada') return UI.flow(steps, 7);
    if (st === 'parcial') return UI.flow(steps, 5);
    if (st === 'vencida') return UI.flow(steps, (r.paid || 0) > 0 ? 5 : 3, 2);
    return UI.flow(steps, 3);
  }
  const cxcBadge = (r) => { const st = cxcStatus(r); return UI.badge(st) + (st === 'vencida' && r.paid > 0 ? '<div class="xs faint">con pago parcial</div>' : ''); };

  const PAY_METHODS = ['Transferencia BCP', 'Transferencia Interbank', 'Transferencia BBVA', 'Tarjeta', 'Yape', 'Plin', 'Efectivo', 'Crédito B2B'];

  function payModal(r, done) {
    if (!need('finance.payments.register', 'registrar pagos')) return;
    const b = bal(r);
    if (b <= 0) { UI.toast('La cuenta ' + esc(r.id) + ' ya está pagada.', 'warn'); return; }
    const cli = Q.client(r.clientId) || {};
    const ag = agencyOfClient(r.clientId);
    UI.modal({
      title: 'Registrar pago', sub: 'PROC-042 · Recibir → Validar → Registrar → Confirmar → Aplicar → Actualizar saldo → Auditar',
      body: UI.alert('info', '<b>' + esc(r.id) + '</b> · ' + esc(r.concept) + '<br>Cliente: ' + esc(cli.name || '—') + ' · Saldo pendiente <b>' + money(b, r.currency) + '</b>' + (r.currency === 'USD' ? ' (≈ ' + S(pen(b, 'USD', FX())) + ')' : '')) +
        '<div style="height:12px"></div>' + UI.form([
          { id: 'pm-method', label: 'Método de pago', type: 'select', col: 6, required: true, options: PAY_METHODS, value: 'Transferencia BCP' },
          { id: 'pm-date', label: 'Fecha de pago', type: 'date', col: 6, required: true, value: TODAY() },
          { id: 'pm-amount', label: 'Monto (' + r.currency + ')', type: 'number', col: r.currency === 'USD' ? 4 : 6, required: true, value: b, step: '0.01', min: 0, max: b, hint: 'Máximo: saldo pendiente' },
          r.currency === 'USD' ? { id: 'pm-fx', label: 'Tipo de cambio', type: 'number', col: 4, required: true, value: FX(), step: '0.001', hint: 'TC conservado (Regla 15)' } : null,
          { id: 'pm-ref', label: 'Referencia / N° de operación', col: r.currency === 'USD' ? 4 : 6, placeholder: 'OP 00000000' },
          { id: 'pm-note', label: 'Observación', type: 'textarea', col: 12, rows: 2 },
          { type: 'html', col: 12, html: '<div id="pm-eq" class="small muted"></div>' }
        ].filter(Boolean)),
      onOpen: (m) => {
        const upd = () => {
          const a = +m.querySelector('#pm-amount').value || 0; const meth = m.querySelector('#pm-method').value;
          const fx = r.currency === 'USD' ? (+m.querySelector('#pm-fx').value || FX()) : 1;
          let t = 'Equivalente consolidado: <b>' + S(r.currency === 'USD' ? a * fx : a) + '</b> · Saldo resultante: ' + money(Math.max(0, b - a), r.currency) + (a > 0 && a < b ? ' (quedará <b>Parcial</b>)' : a >= b ? ' (quedará <b>Pagada</b>)' : '');
          if (meth === 'Crédito B2B') t += '<br>' + (ag ? 'Línea B2B ' + esc(ag.name) + ': disponible ' + S(ag.creditLimit - ag.creditUsed) + (ag.status !== 'activa' ? ' · <span class="bad">agencia ' + esc(ag.status) + '</span>' : '') : '<span class="bad">El cliente no es una agencia B2B con línea de crédito.</span>');
          m.querySelector('#pm-eq').innerHTML = t;
        };
        m.querySelectorAll('input,select').forEach(i => i.addEventListener('input', upd)); upd();
      },
      actions: [{ label: 'Cancelar' }, {
        label: 'Registrar y aplicar', cls: 'primary', icon: 'check', onClick: (m) => {
          if (!UI.validate(m)) return false;
          const d = UI.formData(m); const a = r2(d['pm-amount']);
          if (!(a > 0)) { UI.toast('El monto debe ser mayor que cero.', 'bad'); return false; }
          if (a > b + 0.005) { UI.toast('PROC-042: el monto (' + money(a, r.currency) + ') no puede exceder el saldo pendiente (' + money(b, r.currency) + ').', 'bad'); return false; }
          if (d['pm-method'] !== 'Efectivo' && d['pm-method'] !== 'Crédito B2B' && !d['pm-ref']) { UI.toast('Indique la referencia u N° de operación del pago.', 'bad'); m.querySelector('#pm-ref').classList.add('err'); return false; }
          const fx = r.currency === 'USD' ? (+d['pm-fx'] || FX()) : null;
          if (d['pm-method'] === 'Crédito B2B') {
            if (!ag) { UI.toast('Crédito B2B solo aplica a agencias asociadas con línea vigente (Regla transversal 14).', 'bad'); return false; }
            if (ag.status !== 'activa') { UI.toast('La agencia ' + esc(ag.name) + ' está ' + esc(ag.status) + ': no puede usar crédito.', 'bad'); return false; }
            if (pen(a, r.currency, fx) > ag.creditLimit - ag.creditUsed + 0.005) { UI.toast('Línea de crédito insuficiente: disponible ' + S(ag.creditLimit - ag.creditUsed) + '.', 'bad'); return false; }
            ag.creditUsed = r2(ag.creditUsed + pen(a, r.currency, fx));
          }
          const p = { id: nextId(DB.payments, 'PAG-', 5), receivableId: r.id, resId: r.resId, method: d['pm-method'], amount: a, currency: r.currency, fx, date: d['pm-date'], status: 'confirmado', ref: d['pm-ref'] || (d['pm-method'] === 'Efectivo' ? 'Caja sede' : 'Línea B2B'), by: Auth.user.id, note: d['pm-note'] };
          hist(p, 'confirmado', 'Pago registrado y validado');
          DB.payments.unshift(p);
          Audit.log('Pago', p.id, 'registrar', '', 'confirmado · ' + money(a, r.currency) + (fx ? ' TC ' + fx : ''));
          p.status = 'aplicado'; hist(p, 'aplicado', 'Aplicado a ' + r.id);
          const before = r.paid || 0; recalcCxC(r);
          Audit.log('Pago', p.id, 'aplicar', 'confirmado', 'aplicado → ' + r.id);
          Audit.log('Cuenta por cobrar', r.id, 'actualizar_saldo', money(before, r.currency), money(r.paid, r.currency) + ' · ' + UI.statusLabel(r.status));
          syncResStatus(r.resId);
          Notify.push('pago.recibido', 'Email', cli.email || cli.name || r.clientId, 'Pago recibido ' + p.id + ' — ' + money(a, r.currency) + ' (' + r.id + ')');
          Store.save();
          UI.toast('Pago <b>' + p.id + '</b> aplicado a ' + esc(r.id) + '. Estado: ' + UI.statusLabel(r.status) + '.');
          done && done();
        }
      }]
    });
  }

  function pickCxcForPayment(done) {
    if (!need('finance.payments.register', 'registrar pagos')) return;
    const open = DB.receivables.filter(r => bal(r) > 0 && r.status !== 'cancelada');
    if (!open.length) { UI.toast('No hay cuentas por cobrar con saldo.', 'info'); return; }
    UI.modal({ title: 'Registrar pago', sub: 'Regla transversal 9: todo pago se asocia a una obligación', size: 'sm', body: UI.form([{ id: 'pk-cxc', label: 'Cuenta por cobrar', type: 'select', col: 12, options: open.map(r => [r.id, r.id + ' · ' + Q.clientName(r.clientId) + ' · saldo ' + money(bal(r), r.currency)]) }]),
      actions: [{ label: 'Cancelar' }, { label: 'Continuar', cls: 'primary', onClick: (m) => { const r = DB.receivables.find(x => x.id === m.querySelector('#pk-cxc').value); setTimeout(() => payModal(r, done), 0); } }] });
  }

  function remind(r) {
    if (!need(OP, 'enviar recordatorios de cobranza')) return;
    if (cxcStatus(r) === 'pagada') { UI.toast('La obligación ya está pagada; no se envía recordatorio.', 'warn'); return; }
    const c = Q.client(r.clientId) || {};
    Notify.push('pago.recordatorio', 'Email', c.email || c.name || r.clientId, 'Recordatorio de pago ' + r.id + ' — saldo ' + money(bal(r), r.currency) + ', vence ' + date(r.due));
    if (c.phone) Notify.push('pago.recordatorio', 'WhatsApp', c.phone, 'Recordatorio de pago ' + r.id + ' — ' + money(bal(r), r.currency));
    r.reminders = (r.reminders || []).concat(nowStr()); Store.save();
    Audit.log('Cuenta por cobrar', r.id, 'recordatorio', '', 'Email' + (c.phone ? ' + WhatsApp' : ''));
    UI.toast('Recordatorio enviado a ' + esc(c.name || r.clientId) + ' por email' + (c.phone ? ' y WhatsApp' : '') + ' (PROC-059).');
  }

  function resCommitted(resId) { return sum(DB.receivables.filter(x => x.resId === resId && x.status !== 'cancelada'), 'amount'); }
  function anticipoModal(preset, done) {
    if (!need(OP, 'solicitar anticipos')) return;
    const list = DB.reservations.filter(r => !['cancelada', 'completada'].includes(r.status));
    const def = preset || (list.find(r => r.total - resCommitted(r.id) > 0.5) || list[0] || {}).id;
    UI.modal({
      title: 'Solicitar anticipo', sub: 'PROC-041 · Solicitud → Importe → Obligación → Pago → Aplicación → Saldo',
      body: UI.form([
        { id: 'an-res', label: 'Reserva', type: 'select', required: true, col: 12, options: list.map(r => [r.id, r.id + ' · ' + r.title]), value: def },
        { type: 'html', col: 12, html: '<div id="an-info"></div>' },
        { id: 'an-pct', label: 'Porcentaje del total', type: 'number', col: 4, value: 50, min: 1, max: 100, step: 1 },
        { id: 'an-amt', label: 'Importe', type: 'number', col: 4, required: true, step: '0.01', min: 0 },
        { id: 'an-due', label: 'Vencimiento', type: 'date', col: 4, required: true, value: addDays(TODAY(), 3) },
        { id: 'an-concept', label: 'Concepto', col: 12, required: true },
        { id: 'an-notify', label: 'Notificar al cliente (email y portal)', type: 'checkbox', value: true, col: 12 }
      ]),
      onOpen: (m) => {
        const sel = m.querySelector('#an-res'), pct = m.querySelector('#an-pct'), amt = m.querySelector('#an-amt'), con = m.querySelector('#an-concept');
        const upd = (setAmt) => {
          const res = Q.reservation(sel.value); if (!res) return;
          const committed = resCommitted(res.id), avail = r2(res.total - committed);
          m.querySelector('#an-info').innerHTML = '<div class="grid g3" style="gap:10px">' + [['Total reserva', money(res.total, res.currency)], ['Obligaciones registradas', money(committed, res.currency)], ['Disponible para anticipo', '<span class="' + (avail > 0 ? 'ok' : 'bad') + '">' + money(avail, res.currency) + '</span>']].map(x => '<div class="kpi" style="padding:9px 12px"><div class="l">' + x[0] + '</div><div class="small" style="font-weight:650">' + x[1] + '</div></div>').join('') + '</div>' + (res.currency === 'USD' ? '<div class="xs faint" style="margin-top:6px">Moneda de la reserva USD · se conserva el TC ' + fmtN(FX(), 3) + ' en la obligación (Regla 15).</div>' : '');
          if (setAmt) { amt.value = r2(Math.min(avail > 0 ? avail : res.total, res.total * (+pct.value || 0) / 100)); con.value = 'Anticipo ' + (+pct.value || 0) + '% — ' + res.title; }
        };
        sel.onchange = () => upd(true); pct.oninput = () => upd(true); upd(true);
      },
      actions: [{ label: 'Cancelar' }, {
        label: 'Crear obligación', cls: 'primary', icon: 'plus', onClick: (m) => {
          if (!UI.validate(m)) return false;
          const d = UI.formData(m); const res = Q.reservation(d['an-res']); const a = r2(d['an-amt']);
          const avail = r2(res.total - resCommitted(res.id));
          if (!(a > 0)) { UI.toast('El importe debe ser mayor que cero.', 'bad'); return false; }
          if (a > avail + 0.005) { UI.toast('PROC-041: el anticipo excede el saldo no comprometido de la reserva (' + money(avail, res.currency) + ').', 'bad'); return false; }
          const r = { id: nextId(DB.receivables, 'CXC-', 5), resId: res.id, clientId: res.clientId, concept: d['an-concept'], amount: a, currency: res.currency, fx: res.currency === 'USD' ? FX() : null, due: d['an-due'], paid: 0, status: 'abierta', kind: 'anticipo', createdAt: nowStr(), by: Auth.user.id };
          DB.receivables.unshift(r);
          Audit.log('Cuenta por cobrar', r.id, 'crear_anticipo', '', money(a, r.currency) + ' · ' + res.id);
          if (d['an-notify']) { const c = Q.client(res.clientId) || {}; Notify.push('pago.solicitud', 'Email', c.email || c.name, 'Solicitud de anticipo ' + r.id + ' — ' + money(a, r.currency) + ', vence ' + date(r.due)); Notify.push('pago.solicitud', 'Portal', c.name || res.clientId, 'Nuevo pago pendiente en su portal: ' + r.id); }
          Store.save(); UI.toast('Obligación <b>' + r.id + '</b> creada por ' + money(a, r.currency) + '.');
          done && done(r);
        }
      }]
    });
  }

  function cxcBody(r) {
    const st = cxcStatus(r); const pays = DB.payments.filter(p => p.receivableId === r.id);
    const invs = DB.invoices.filter(i => i.receivableId === r.id || (!i.receivableId && i.resId === r.resId));
    const d = daysFromToday(r.due);
    const res = Q.reservation(r.resId);
    return (st === 'vencida' ? UI.alert('bad', '<b>Obligación vencida hace ' + (-d) + ' día(s).</b> Saldo ' + money(bal(r), r.currency) + '. Se sugiere enviar recordatorio y validar pagos pendientes.') : '') +
      (pays.some(p => p.status === 'pendiente') ? UI.alert('warn', 'Existe un pago pendiente de validación asociado: ' + pays.filter(p => p.status === 'pendiente').map(p => payLink(p.id)).join(', ') + '.') : '') +
      '<div class="card" style="margin:12px 0"><div class="card-b">' + cxcFlow(r) + '</div></div>' +
      '<div class="grid g2">' +
        '<div>' + UI.dl([['Cliente', cliLink(r.clientId)], ['Reserva', resLink(r.resId) + (res ? '<div class="xs faint">' + esc(res.title) + '</div>' : '')], ['Concepto', esc(r.concept)], ['Tipo', r.kind === 'anticipo' || /anticipo/i.test(r.concept) ? 'Anticipo (PROC-041)' : 'Cargo / saldo (PROC-040)'], ['Vencimiento', date(r.due) + ' <span class="xs faint">(' + (d < 0 ? 'hace ' + (-d) + ' d' : d === 0 ? 'hoy' : 'en ' + d + ' d') + ')</span>'], ['Moneda', r.currency + (r.currency === 'USD' ? ' · TC ' + fmtN(fxOf(r), 3) : '')], ['Estado', cxcBadge(r)], ['Recordatorios', r.reminders && r.reminders.length ? r.reminders.length + ' · último ' + datetime(r.reminders[r.reminders.length - 1]) : 'Ninguno']]) + '</div>' +
        '<div>' + '<div class="stat-line"><span class="muted">Importe</span><b class="num">' + money(r.amount, r.currency) + '</b></div><div class="stat-line"><span class="muted">Pagos aplicados</span><b class="num ok">' + money(r.paid || 0, r.currency) + '</b></div><div class="stat-line total"><span>Saldo</span><span class="num">' + money(bal(r), r.currency) + '</span></div>' + (r.currency === 'USD' ? '<div class="xs faint right">≈ ' + S(penOf(r, bal(r))) + ' al TC ' + fmtN(fxOf(r), 3) + '</div>' : '') + '<div style="margin-top:10px">' + UI.progress(r.amount ? (r.paid || 0) / r.amount * 100 : 0, st === 'pagada' ? 'ok' : st === 'vencida' ? 'bad' : '') + '</div></div>' +
      '</div>' +
      '<div class="section-title" style="margin:18px 0 8px">Pagos aplicados y registrados</div>' +
      miniTable([['Pago'], ['Fecha'], ['Método'], ['Referencia'], ['Monto', 'num'], ['Estado'], ['']], pays.map(p => '<tr><td>' + payLink(p.id) + '</td><td class="nowrap">' + date(p.date) + '</td><td>' + esc(p.method) + '</td><td class="small">' + esc(p.ref) + '</td><td class="num">' + amtCell(p.amount, p.currency, p.fx) + '</td><td>' + UI.badge(p.status) + '</td><td class="right">' + (['aplicado', 'confirmado'].includes(p.status) ? '<button class="btn xs" data-rev="' + p.id + '"' + dis('finance.payments.revert') + '>Revertir</button>' : p.status === 'pendiente' ? '<button class="btn xs" data-val="' + p.id + '"' + dis('finance.payments.register') + '>Validar</button>' : '') + '</td></tr>'), 'Sin pagos registrados para esta obligación') +
      '<div class="section-title" style="margin:18px 0 8px">Comprobantes de la reserva</div>' +
      miniTable([['Número'], ['Tipo'], ['Fecha'], ['Importe', 'num'], ['Estado']], invs.map(i => '<tr><td>' + invLink(i.id) + '</td><td>' + esc(i.type) + '</td><td>' + date(i.date) + '</td><td class="num">' + money(i.amount, i.currency) + '</td><td>' + UI.badge(i.status) + '</td></tr>'), 'Sin comprobantes emitidos');
  }
  function bindCxcBody(root, again) {
    root.querySelectorAll('[data-rev]').forEach(b => b.onclick = () => revertPayment(DB.payments.find(p => p.id === b.dataset.rev), again));
    root.querySelectorAll('[data-val]').forEach(b => b.onclick = () => validatePay(DB.payments.find(p => p.id === b.dataset.val), again));
  }
  function cxcDrawer(id) {
    const r = DB.receivables.find(x => x.id === id); if (!r) return;
    const again = () => refresh(() => cxcDrawer(id));
    UI.drawer({
      title: 'Cuenta por cobrar ' + esc(id), sub: esc(r.concept), wide: true, body: cxcBody(r),
      onOpen: (d) => bindCxcBody(d, again),
      actions: [{ label: 'Abrir ficha', icon: 'arrowRight', onClick: () => App.go('#/finanzas/cobros/' + id) }]
        .concat(Auth.can('finance.invoicing') ? [{ label: 'Emitir comprobante', icon: 'receipt', cls: canOp() ? '' : 'primary', onClick: () => { emitModal(r.id, null, null, (inv) => App.go('#/finanzas/facturacion/' + inv.id)); return false; } }] : [])
        .concat(canOp() && bal(r) > 0 ? [{ label: 'Enviar recordatorio', icon: 'send', onClick: () => { remind(r); return false; } }, { label: 'Registrar pago', icon: 'wallet', cls: 'primary', onClick: () => { payModal(r, again); return false; } }] : [])
    });
  }

  function cxcDetail(el, id) {
    const r = DB.receivables.find(x => x.id === id);
    if (!r) { el.innerHTML = '<div class="page">' + header('Cuenta por cobrar', '', id) + UI.card('', UI.empty('No existe la cuenta por cobrar ' + id + '.', 'search')) + '</div>'; return; }
    const pays = DB.payments.filter(p => p.receivableId === id);
    const again = () => refresh();
    el.innerHTML = '<div class="page">' + UI.pageHeader({
      title: esc(r.id) + ' <span style="vertical-align:3px">' + UI.badge(cxcStatus(r)) + '</span>', subtitle: esc(r.concept) + ' · ' + esc(Q.clientName(r.clientId)),
      crumbs: [['Inicio', '#/dashboard'], ['Finanzas', '#/finanzas/cobros'], ['Cuentas por cobrar', '#/finanzas/cobros'], [r.id]],
      actions: '<button class="btn" id="cx-rem"' + dis(OP) + '>' + UI.icon('send') + 'Enviar recordatorio</button><button class="btn' + (canOp() ? '' : ' primary') + '" id="cx-inv"' + dis('finance.invoicing') + '>' + UI.icon('receipt') + 'Emitir comprobante</button><button class="btn primary" id="cx-pay"' + (!canOp() ? dis(OP) : bal(r) <= 0 ? ' disabled' : '') + '>' + UI.icon('wallet') + 'Registrar pago</button>'
    }) + roleNote('cxc') + '<div class="grid g-2-1"><div>' + UI.card('Detalle de la obligación', cxcBody(r)) + '</div><div class="stack">' +
      UI.card('Historial y auditoría', auditTimeline([r.id].concat(pays.map(p => p.id))), { sub: 'Acciones críticas auditadas (Regla 16)' }) +
      UI.card('Notificaciones enviadas', (() => { const ns = DB.notifications.filter(n => String(n.subject).includes(r.id)); return ns.length ? '<div class="list">' + ns.map(n => '<div class="list-item" style="padding:8px 0"><div class="grow"><div class="small">' + esc(n.subject) + '</div><div class="xs faint">' + esc(n.channel) + ' · ' + datetime(n.ts) + '</div></div>' + UI.badge(n.status) + '</div>').join('') + '</div>' : UI.empty('Sin notificaciones para esta obligación', 'bell'); })()) +
      '</div></div></div>';
    bindCxcBody(el, again);
    el.querySelector('#cx-rem').onclick = () => { remind(r); refresh(); };
    el.querySelector('#cx-pay').onclick = () => payModal(r, again);
    el.querySelector('#cx-inv').onclick = () => emitModal(r.id, null, null, (inv) => App.go('#/finanzas/facturacion/' + inv.id));
  }

  function renderCobros(el, params) {
    css();
    if (!guard(el, 'finance.receivables', 'Cuentas por cobrar')) return;
    if (params && params[0]) return cxcDetail(el, params[0]);
    const all = DB.receivables.filter(r => r.status !== 'cancelada');
    const open = all.filter(r => bal(r) > 0);
    const totOpen = sum(open, r => penOf(r, bal(r)));
    const overdue = open.filter(r => cxcStatus(r) === 'vencida');
    const soon = open.filter(r => { const d = daysFromToday(r.due); return d >= 0 && d <= 7; });
    const paidMonth = DB.payments.filter(p => p.status === 'aplicado' && String(p.date).startsWith(MONTH()));
    const buckets = [['Por vencer', r => daysFromToday(r.due) >= 0], ['0–30 días', r => { const d = -daysFromToday(r.due); return d > 0 && d <= 30; }], ['31–60 días', r => { const d = -daysFromToday(r.due); return d > 30 && d <= 60; }], ['> 60 días', r => -daysFromToday(r.due) > 60]].map(([label, f]) => { const rs = open.filter(f); return { label, n: rs.length, v: r2(sum(rs, r => penOf(r, bal(r)))) }; });
    const upcoming = open.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    el.innerHTML = '<div class="page">' +
      header('Cuentas por cobrar', 'Obligaciones de clientes por reserva (PROC-040), anticipos (PROC-041) y registro de pagos (PROC-042). Consolidado en soles al TC conservado de cada documento.', 'Cuentas por cobrar',
        '<button class="btn" id="cb-ant"' + dis(OP) + '>' + UI.icon('plus') + 'Solicitar anticipo</button><button class="btn primary" id="cb-pay"' + dis(OP) + '>' + UI.icon('wallet') + 'Registrar pago</button>' + (!canOp() && Auth.can('finance.invoicing') ? '<a class="btn primary" href="#/finanzas/facturacion">' + UI.icon('receipt') + 'Ir a facturación</a>' : '')) +
      roleNote('cxc') +
      (overdue.length ? UI.alert('bad', '<b>' + overdue.length + ' obligación(es) vencida(s)</b> por ' + S(sum(overdue, r => penOf(r, bal(r)))) + ': ' + overdue.map(r => cxcLink(r.id) + ' (' + esc(Q.clientName(r.clientId)) + ')').join(', ') + '.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Por cobrar total', value: kS(totOpen), sub: open.length + ' obligaciones abiertas', tone: 'accent', icon: 'wallet' }) +
        UI.kpi({ label: 'Vencido', value: kS(sum(overdue, r => penOf(r, bal(r)))), sub: overdue.length + ' documento(s)', tone: 'bad', icon: 'alert' }) +
        (Auth.role === 'accounting' ? (() => { const inv = {}; DB.invoices.filter(i => i.type !== 'Nota de crédito' && i.status !== 'anulado').forEach(i => { inv[i.resId] = (inv[i.resId] || 0) + pen(i.amount, i.currency, i.fx); }); const col = {}; DB.payments.filter(p => p.status === 'aplicado').forEach(p => { col[p.resId] = (col[p.resId] || 0) + pen(p.amount, p.currency, p.fx); }); const pend = Object.keys(col).map(k => col[k] - (inv[k] || 0)).filter(v => v > 0.5); return UI.kpi({ label: 'Cobrado por facturar', value: kS(sum(pend, v => v)), sub: pend.length + ' reserva(s) · emitir comprobante', tone: 'sun', icon: 'receipt' }); })() : UI.kpi({ label: 'Por vencer en 7 días', value: kS(sum(soon, r => penOf(r, bal(r)))), sub: soon.length + ' documento(s)', tone: 'sun', icon: 'clock' })) +
        UI.kpi({ label: 'Cobrado en el mes', value: kS(sum(paidMonth, p => pen(p.amount, p.currency, p.fx))), sub: paidMonth.length + ' pagos aplicados', tone: 'ok', icon: 'checkCircle' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('Antigüedad de saldos (aging)', UI.chart.bars({ labels: buckets.map(b => b.label), series: [{ name: 'Saldo S/', values: buckets.map(b => b.v) }], height: 190, fmt: v => S(v, 0) }) + '<div class="fz-aging">' + buckets.map((b, i) => '<div><div class="xs faint">' + esc(b.label) + '</div><b class="' + (i > 0 && b.v > 0 ? 'bad' : '') + '">' + S(b.v, 0) + '</b><div class="xs faint">' + b.n + ' doc.</div></div>').join('') + '</div>', { sub: 'Saldo pendiente por días de atraso · S/' }) +
        UI.card('Próximos vencimientos', upcoming.length ? '<div class="list">' + upcoming.map(r => { const d = daysFromToday(r.due); return '<div class="list-item click" data-open="' + r.id + '"><div class="ico-box ' + (d < 0 ? 'bad' : d <= 7 ? 'sun' : '') + '">' + UI.icon('calendar') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(Q.clientName(r.clientId)) + '</div><div class="xs faint"><span class="mono">' + esc(r.id) + '</span> · ' + (d < 0 ? '<span class="bad">vencida hace ' + (-d) + ' d</span>' : 'vence ' + dateShort(r.due)) + '</div></div><div class="right small num" style="font-weight:600">' + money(bal(r), r.currency) + '</div></div>'; }).join('') + '</div>' : UI.empty('Sin saldos pendientes', 'checkCircle'), { tight: true }) +
      '</div><div id="cb-tbl" style="min-width:0"></div></div>';
    el.querySelectorAll('[data-open]').forEach(x => x.onclick = () => cxcDrawer(x.dataset.open));
    el.querySelector('#cb-ant').onclick = () => anticipoModal(null, (r) => refresh(() => cxcDrawer(r.id)));
    el.querySelector('#cb-pay').onclick = () => pickCxcForPayment(() => refresh());
    UI.dataTable(el.querySelector('#cb-tbl'), {
      exportName: 'cuentas_por_cobrar',
      rows: () => DB.receivables,
      search: r => [r.id, r.concept, r.resId, Q.clientName(r.clientId)].join(' '),
      defaultSort: 'due',
      filters: [
        { label: 'Estado', options: ['abierta', 'parcial', 'vencida', 'pagada'], match: (r, v) => cxcStatus(r) === v },
        { label: 'Moneda', options: [['PEN', 'Soles (PEN)'], ['USD', 'Dólares (USD)']], match: (r, v) => r.currency === v }
      ],
      columns: cols([
        { key: 'id', label: 'Documento', render: r => '<span class="mono" style="font-weight:600">' + esc(r.id) + '</span>' },
        { key: 'client', label: 'Cliente / concepto', sortVal: r => Q.clientName(r.clientId), render: r => '<div class="cell-main">' + cliLink(r.clientId) + '</div><div class="cell-sub">' + esc(r.concept) + '</div>', csv: r => Q.clientName(r.clientId) + ' — ' + r.concept },
        { key: 'resId', label: 'Reserva', render: r => resLink(r.resId) },
        { key: 'due', label: 'Vence', render: r => { const d = daysFromToday(r.due); return '<span class="nowrap">' + date(r.due) + '</span><div class="cell-sub ' + (d < 0 && bal(r) > 0 ? 'bad' : '') + '">' + (bal(r) <= 0 ? 'liquidada' : d < 0 ? 'hace ' + (-d) + ' d' : d === 0 ? 'hoy' : 'en ' + d + ' d') + '</div>'; } },
        { key: 'amount', label: 'Importe', align: 'num', sortVal: r => penOf(r), render: r => amtCell(r.amount, r.currency, r.fx), csv: r => r.currency + ' ' + r.amount },
        { key: 'paid', label: 'Pagado', align: 'num', render: r => '<span class="nowrap">' + money(r.paid || 0, r.currency) + '</span>' },
        { key: 'bal', label: 'Saldo', align: 'num', sortVal: r => penOf(r, bal(r)), render: r => '<b class="nowrap">' + money(bal(r), r.currency) + '</b>', csv: r => bal(r) },
        { key: 'status', label: 'Estado', sortVal: r => cxcStatus(r), render: r => cxcBadge(r), csv: r => UI.statusLabel(cxcStatus(r)) },
        { key: '', label: 'Acciones', sort: false, hide: !canOp(), render: r => bal(r) > 0 ? '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs primary" data-pay="' + r.id + '">Cobrar</button><button class="btn xs" data-rem="' + r.id + '" title="Enviar recordatorio">' + UI.icon('send') + '</button></span>' : '', csv: () => '' }
      ]),
      footer: rows => '<tr><td colspan="6">Saldo consolidado de ' + rows.length + ' documento(s)</td><td class="num nowrap">' + S(sum(rows, r => penOf(r, bal(r)))) + '</td><td' + (canOp() ? ' colspan="2"' : '') + '></td></tr>',
      onRow: r => cxcDrawer(r.id),
      afterDraw: (c) => {
        c.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => payModal(DB.receivables.find(x => x.id === b.dataset.pay), () => refresh(() => cxcDrawer(b.dataset.pay))));
        c.querySelectorAll('[data-rem]').forEach(b => b.onclick = () => remind(DB.receivables.find(x => x.id === b.dataset.rem)));
      }
    });
  }
  App.register('finanzas', (el) => renderCobros(el, []));
  App.register('finanzas/cobros', renderCobros);

  /* ================= Pagos (PROC-042 / 043) ================= */
  function payFlow(p) {
    if (p.status === 'revertido') return UI.flow(['Pendiente', 'Confirmado', 'Aplicado', 'Revertido'], 3, 3);
    if (p.status === 'rechazado') return UI.flow(['Pendiente', 'Validación', 'Rechazado'], 2, 2);
    const idx = { pendiente: 0, confirmado: 1, aplicado: 3 }[p.status] || 0;
    return UI.flow(['Pendiente', 'Confirmado', 'Aplicado'], idx);
  }
  function validatePay(p, done) {
    if (!need('finance.payments.register', 'validar pagos')) return;
    if (p.status !== 'pendiente') { UI.toast('Solo se validan pagos en estado Pendiente.', 'warn'); return; }
    const line = DB.bankLines.find(b => b.match === p.id);
    UI.modal({
      title: 'Validar pago ' + esc(p.id), size: 'sm', sub: 'PROC-042 · Recibir → Validar → Confirmar',
      body: UI.dl([['Monto', amtCell(p.amount, p.currency, p.fx)], ['Método', esc(p.method)], ['Referencia', esc(p.ref)], ['Reserva', resLink(p.resId)], ['Obligación', cxcLink(p.receivableId)], ['Extracto bancario', line ? '<span class="mono">' + esc(line.id) + '</span> · ' + esc(line.desc) + ' · ' + S(line.amount) + ' ' + UI.badge(line.status) : '<span class="warn">Sin movimiento bancario asociado</span>']]) +
        '<div style="margin-top:12px">' + UI.alert(line ? 'ok' : 'warn', line ? 'El abono figura en el extracto bancario: se puede confirmar.' : 'No se encontró el abono en el extracto. Confirme solo con voucher verificado.') + '</div>',
      actions: [
        { label: 'Rechazar', cls: 'danger', onClick: () => { setTimeout(() => rejectPay(p, done), 0); } },
        { label: 'Confirmar', onClick: () => { p.status = 'confirmado'; hist(p, 'confirmado', 'Validado por ' + Auth.user.name); Audit.log('Pago', p.id, 'validar', 'pendiente', 'confirmado'); Store.save(); UI.toast('Pago ' + p.id + ' confirmado. Pendiente de aplicación.'); done && done(); } },
        { label: 'Confirmar y aplicar', cls: 'primary', onClick: () => { p.status = 'confirmado'; hist(p, 'confirmado', 'Validado por ' + Auth.user.name); Audit.log('Pago', p.id, 'validar', 'pendiente', 'confirmado'); Store.save(); setTimeout(() => applyPay(p, done), 0); } }
      ]
    });
  }
  function rejectPay(p, done) {
    if (!need('finance.payments.register', 'rechazar pagos')) return;
    UI.confirm({
      title: 'Rechazar pago ' + esc(p.id), message: 'Excepción de pago: el pago se marca como <b>rechazado</b>, la obligación ' + esc(p.receivableId || '') + ' <b>se mantiene abierta</b> y se notifica al cliente para reintento.', confirmLabel: 'Rechazar pago', danger: true, reason: true, reasonLabel: 'Motivo del rechazo',
      onConfirm: (why) => {
        const before = p.status; p.status = 'rechazado'; p.rejectReason = why; hist(p, 'rechazado', why);
        Audit.log('Pago', p.id, 'rechazar', before, 'rechazado · ' + why);
        const res = Q.reservation(p.resId); const c = res ? Q.client(res.clientId) || {} : {};
        Notify.push('pago.rechazado', 'Email', c.email || c.name || p.resId, 'Pago ' + p.id + ' no validado: ' + why + '. La obligación sigue pendiente.');
        Store.save(); UI.toast('Pago rechazado. La obligación se mantiene y el cliente fue notificado.', 'warn'); done && done();
      }
    });
  }
  function retryPay(p, done) {
    if (!need('finance.payments.register', 'reintentar pagos')) return;
    p.retries = (p.retries || 0) + 1; p.status = 'pendiente'; hist(p, 'pendiente', 'Reintento #' + p.retries);
    Audit.log('Pago', p.id, 'reintentar', 'rechazado', 'pendiente (reintento ' + p.retries + ')');
    Store.save(); UI.toast('Pago ' + p.id + ' reabierto para nueva validación (reintento ' + p.retries + ').', 'info'); done && done();
  }
  function applyPay(p, done) {
    if (!need('finance.payments.register', 'aplicar pagos')) return;
    if (p.status !== 'confirmado') { UI.toast('Solo un pago confirmado puede aplicarse (PROC-042: Confirmar → Aplicar).', 'bad'); return; }
    const opts = DB.receivables.filter(r => r.resId === p.resId && r.currency === p.currency && bal(r) > 0);
    if (!opts.length) { UI.toast('No hay obligaciones abiertas en ' + p.currency + ' para ' + esc(p.resId) + '. Regla transversal 9: el pago debe asociarse a una obligación.', 'bad'); return; }
    const pre = opts.some(r => r.id === p.receivableId) ? p.receivableId : opts[0].id;
    UI.modal({
      title: 'Aplicar pago ' + esc(p.id), sub: 'PROC-042 · Aplicar → Actualizar saldo → Auditar', size: 'sm',
      body: UI.alert('info', 'Pago de <b>' + money(p.amount, p.currency) + '</b>' + (p.currency === 'USD' ? ' (TC ' + fmtN(fxOf(p), 3) + ')' : '') + ' · ' + esc(p.method) + ' · ' + esc(p.ref)) + '<div style="height:12px"></div>' +
        UI.form([{ id: 'ap-cxc', label: 'Cuenta por cobrar', type: 'select', col: 12, options: opts.map(r => [r.id, r.id + ' · ' + r.concept + ' · saldo ' + money(bal(r), r.currency)]), value: pre }]),
      actions: [{ label: 'Cancelar' }, {
        label: 'Aplicar pago', cls: 'primary', onClick: (m) => {
          const r = DB.receivables.find(x => x.id === m.querySelector('#ap-cxc').value);
          if (p.amount > bal(r) + 0.005) { UI.toast('El pago (' + money(p.amount, p.currency) + ') excede el saldo de ' + r.id + ' (' + money(bal(r), r.currency) + ').', 'bad'); return false; }
          p.receivableId = r.id; p.status = 'aplicado'; hist(p, 'aplicado', 'Aplicado a ' + r.id);
          const before = r.paid || 0; recalcCxC(r); syncResStatus(r.resId);
          Audit.log('Pago', p.id, 'aplicar', 'confirmado', 'aplicado → ' + r.id);
          Audit.log('Cuenta por cobrar', r.id, 'actualizar_saldo', money(before, r.currency), money(r.paid, r.currency) + ' · ' + UI.statusLabel(r.status));
          const c = Q.client(r.clientId) || {};
          Notify.push('pago.recibido', 'Email', c.email || c.name, 'Pago recibido ' + p.id + ' — ' + money(p.amount, p.currency) + ' (' + r.id + ')');
          Store.save(); UI.toast('Pago aplicado. ' + esc(r.id) + ' queda ' + UI.statusLabel(r.status) + '.'); done && done();
        }
      }]
    });
  }
  function revertPayment(p, done) {
    if (!p) return;
    if (!Auth.can('finance.payments.revert')) { UI.toast('Reversión bloqueada: requiere el permiso <span class="mono">finance.payments.revert</span> (PROC-043, Regla 17).', 'bad'); return; }
    if (!['aplicado', 'confirmado'].includes(p.status)) { UI.toast('Solo se revierten pagos confirmados o aplicados.', 'warn'); return; }
    const r = DB.receivables.find(x => x.id === p.receivableId);
    UI.confirm({
      title: 'Revertir pago ' + esc(p.id),
      message: 'PROC-043 · Solicitud → Validar → Revertir → Desaplicar → Recalcular → Auditar.<br><br>Se revertirá <b>' + money(p.amount, p.currency) + '</b>' + (r && p.status === 'aplicado' ? ', se desaplicará de <b>' + esc(r.id) + '</b> y su saldo pasará de ' + money(bal(r), r.currency) + ' a ' + money(bal(r) + p.amount, r.currency) : '') + '. La acción queda auditada.',
      confirmLabel: 'Revertir pago', danger: true, reason: true, reasonLabel: 'Motivo de la reversión',
      onConfirm: (why) => {
        const prev = p.status; p.status = 'revertido'; p.revertReason = why; p.revertedAt = nowStr(); p.revertedBy = Auth.user.id; hist(p, 'revertido', why);
        Audit.log('Pago', p.id, 'revertir', prev, 'revertido · ' + why);
        if (p.method === 'Crédito B2B') { const res = Q.reservation(p.resId); const ag = res && agencyOfClient(res.clientId); if (ag) ag.creditUsed = Math.max(0, r2(ag.creditUsed - pen(p.amount, p.currency, p.fx))); }
        if (r) { const before = r.paid || 0; recalcCxC(r); Audit.log('Cuenta por cobrar', r.id, 'recalcular_saldo', money(before, r.currency), money(r.paid, r.currency) + ' · ' + UI.statusLabel(r.status)); }
        const res = Q.reservation(p.resId); const c = res ? Q.client(res.clientId) || {} : {};
        Notify.push('pago.revertido', 'Email', c.email || c.name || p.resId, 'Reversión del pago ' + p.id + ' — ' + money(p.amount, p.currency));
        Store.save(); UI.toast('Pago ' + p.id + ' revertido y saldo recalculado.', 'warn'); done && done();
      }
    });
  }
  function payActions(p, again) {
    const a = [];
    if (!canOp()) { if (p.status === 'aplicado' && Auth.can('finance.payments.revert')) a.push({ label: 'Revertir pago', cls: 'danger', icon: 'refresh', onClick: () => { revertPayment(p, again); return false; } }); return a; }
    if (p.status === 'pendiente') a.push({ label: 'Rechazar', cls: 'danger', onClick: () => { rejectPay(p, again); return false; } }, { label: 'Validar pago', cls: 'primary', icon: 'check', onClick: () => { validatePay(p, again); return false; } });
    if (p.status === 'confirmado' && Auth.can('finance.payments.revert')) a.push({ label: 'Revertir', onClick: () => { revertPayment(p, again); return false; } }); if (p.status === 'confirmado') a.push({ label: 'Aplicar a CxC', cls: 'primary', onClick: () => { applyPay(p, again); return false; } });
    if (p.status === 'aplicado' && Auth.can('finance.payments.revert')) a.push({ label: 'Revertir pago', cls: 'danger', icon: 'refresh', onClick: () => { revertPayment(p, again); return false; } });
    if (p.status === 'rechazado') a.push({ label: 'Reintentar validación', cls: 'primary', icon: 'refresh', onClick: () => { retryPay(p, again); return false; } });
    return a;
  }
  function payDrawer(id) {
    const p = DB.payments.find(x => x.id === id); if (!p) return;
    const res = Q.reservation(p.resId); const line = DB.bankLines.find(b => b.match === p.id);
    const again = () => refresh(() => payDrawer(id));
    const h = (p.history || []).slice().reverse().map(x => ({ title: UI.badge(x.status) + ' ' + esc(x.note || ''), meta: datetime(x.ts) + ' · ' + esc(Q.userName(x.user)), icon: 'history' }));
    const setA = new Set([p.id]);
    const auditItems = DB.audit.filter(a => setA.has(a.entityId)).map(a => ({ title: esc(a.entity) + ' · ' + esc(String(a.action).replace(/_/g, ' ')), meta: datetime(a.ts) + ' · ' + esc(Q.userName(a.user)), desc: esc((a.before ? a.before + ' → ' : '') + (a.after || '')), icon: 'shield' }));
    const base = { title: 'Pago recibido · ' + esc(p.method), meta: date(p.date) + ' · ' + esc(Q.userName(p.by)), desc: esc(p.ref), icon: 'wallet' };
    UI.drawer({
      title: 'Pago ' + esc(p.id), sub: esc(p.method) + ' · ' + date(p.date), wide: true,
      body: (p.status === 'revertido' ? UI.alert('bad', '<b>Pago revertido.</b> ' + esc(p.revertReason || 'Reembolso / anulación registrada.') + ' El saldo de la obligación fue recalculado.') : '') +
        (p.status === 'rechazado' ? UI.alert('warn', '<b>Pago rechazado:</b> ' + esc(p.rejectReason || '') + '. La obligación ' + esc(p.receivableId || '') + ' se mantiene pendiente; se notificó al cliente y puede reintentarse.') : '') +
        (p.status === 'pendiente' ? UI.alert('warn', 'Pago pendiente de validación. Verifique el voucher contra el extracto bancario antes de confirmarlo.') : '') +
        '<div class="card" style="margin:12px 0"><div class="card-b">' + payFlow(p) + '</div></div>' +
        '<div class="grid g2"><div>' + UI.dl([['Monto', amtCell(p.amount, p.currency, p.fx)], ['Método', esc(p.method)], ['Referencia', esc(p.ref)], ['Fecha', date(p.date)], ['Estado', UI.badge(p.status)], ['Registrado por', esc(Q.userName(p.by))]]) + '</div><div>' +
        UI.dl([['Obligación', cxcLink(p.receivableId)], ['Reserva', resLink(p.resId)], ['Cliente', res ? cliLink(res.clientId) : '—'], ['Conciliación', line ? '<span class="mono">' + esc(line.id) + '</span> ' + UI.badge(line.status) : '<span class="faint">Sin conciliar</span>'], p.note ? ['Observación', esc(p.note)] : null, p.retries ? ['Reintentos', p.retries] : null]) + '</div></div>' +
        '<div class="section-title" style="margin:18px 0 10px">Historial de estados y auditoría</div>' + UI.timeline((h.length ? h : auditItems).concat([base])),
      actions: [{ label: 'Ver obligación', onClick: () => { if (p.receivableId) App.go('#/finanzas/cobros/' + p.receivableId); else UI.toast('Pago sin obligación asociada.', 'info'); return !!p.receivableId; } }].concat(payActions(p, again))
    });
  }
  App.register('finanzas/pagos', (el, params) => {
    css();
    if (!guard(el, 'finance.receivables', 'Pagos y aplicaciones')) return;
    const P = DB.payments;
    const pend = P.filter(p => p.status === 'pendiente'), conf = P.filter(p => p.status === 'confirmado');
    const appMonth = P.filter(p => p.status === 'aplicado' && String(p.date).startsWith(MONTH()));
    const rev = P.filter(p => p.status === 'revertido'), rej = P.filter(p => p.status === 'rechazado');
    el.innerHTML = '<div class="page">' +
      header('Pagos y aplicaciones', 'Validación, confirmación y aplicación de pagos a obligaciones (PROC-042) y reversión controlada (PROC-043). Estados: Pendiente → Confirmado → Aplicado; alternativo Revertido.', 'Pagos y aplicaciones', '<button class="btn primary" id="pg-new"' + dis(OP) + '>' + UI.icon('plus') + 'Registrar pago</button>') +
      roleNote('pag') +
      (pend.length ? UI.alert('warn', '<b>' + pend.length + ' pago(s) pendiente(s) de validación:</b> ' + pend.map(p => '<a href="#/finanzas/pagos/' + p.id + '" class="mono">' + p.id + '</a> (' + money(p.amount, p.currency) + ', ' + esc(p.method) + ')').join(', ')) : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Pendientes de validar', value: String(pend.length), sub: S(sum(pend, p => pen(p.amount, p.currency, p.fx))), tone: 'sun', icon: 'clock' }) +
        UI.kpi({ label: 'Aplicados en el mes', value: kS(sum(appMonth, p => pen(p.amount, p.currency, p.fx))), sub: appMonth.length + ' pagos · ' + conf.length + ' por aplicar', tone: 'ok', icon: 'checkCircle' }) +
        UI.kpi({ label: 'Revertidos', value: String(rev.length), sub: S(sum(rev, p => pen(p.amount, p.currency, p.fx))), tone: 'bad', icon: 'refresh' }) +
        UI.kpi({ label: 'Rechazados', value: String(rej.length), sub: 'Obligación se mantiene', tone: 'violet', icon: 'alert' }) +
      '</div>' +
      '<div class="grid g2">' + UI.card('PROC-042 · Pago', proc(['Recibir', 'Validar', 'Registrar', 'Confirmar', 'Aplicar', 'Actualizar saldo', 'Auditar'])) + UI.card('PROC-043 · Reversión', proc(['Solicitud', 'Validar', 'Revertir', 'Desaplicar', 'Recalcular', 'Auditar']) + '<div class="xs faint" style="margin-top:8px">Requiere <span class="mono">finance.payments.revert</span> y motivo obligatorio' + (Auth.can('finance.payments.revert') ? '.' : ' — <b class="bad">su rol no puede revertir.</b>') + '</div>') + '</div>' +
      '<div id="pg-tbl" style="min-width:0"></div></div>';
    el.querySelector('#pg-new').onclick = () => pickCxcForPayment(() => refresh());
    UI.dataTable(el.querySelector('#pg-tbl'), {
      exportName: 'pagos', rows: () => DB.payments,
      search: p => [p.id, p.ref, p.method, p.resId, p.receivableId, (Q.client((Q.reservation(p.resId) || {}).clientId) || {}).name].join(' '),
      defaultSort: 'date', defaultDir: -1,
      filters: [{ label: 'Estado', options: ['pendiente', 'confirmado', 'aplicado', 'revertido', 'rechazado'], key: 'status' }, { label: 'Método', options: Array.from(new Set(DB.payments.map(p => p.method))).map(m => [m, m]), key: 'method' }],
      columns: cols([
        { key: 'id', label: 'Pago', render: p => '<span class="mono" style="font-weight:600">' + esc(p.id) + '</span>' },
        { key: 'date', label: 'Fecha', render: p => '<span class="nowrap">' + date(p.date) + '</span>' },
        { key: 'client', label: 'Cliente / reserva', sortVal: p => (Q.reservation(p.resId) || {}).clientId || '', render: p => { const res = Q.reservation(p.resId); return '<div class="cell-main">' + (res ? cliLink(res.clientId) : '—') + '</div><div class="cell-sub">' + resLink(p.resId) + '</div>'; }, csv: p => p.resId },
        { key: 'receivableId', label: 'Obligación', render: p => cxcLink(p.receivableId) },
        { key: 'method', label: 'Método / referencia', render: p => '<div class="cell-main">' + esc(p.method) + '</div><div class="cell-sub">' + esc(p.ref) + '</div>' },
        { key: 'amount', label: 'Monto', align: 'num', sortVal: p => pen(p.amount, p.currency, p.fx), render: p => amtCell(p.amount, p.currency, p.fx), csv: p => p.currency + ' ' + p.amount },
        { key: 'status', label: 'Estado', render: p => UI.badge(p.status), csv: p => UI.statusLabel(p.status) },
        { key: 'by', label: 'Registró', render: p => '<span class="small">' + esc(Q.userName(p.by)) + '</span>', csv: p => Q.userName(p.by) },
        { key: '', label: '', sort: false, hide: !canOp(), csv: () => '', render: p => p.status === 'pendiente' ? '<button class="btn xs primary" data-act="val" data-id="' + p.id + '"' + dis(OP) + '>Validar</button>' : p.status === 'confirmado' ? '<button class="btn xs primary" data-act="app" data-id="' + p.id + '"' + dis(OP) + '>Aplicar</button>' : p.status === 'aplicado' ? '<button class="btn xs" data-act="rev" data-id="' + p.id + '"' + dis('finance.payments.revert') + '>Revertir</button>' : p.status === 'rechazado' ? '<button class="btn xs" data-act="retry" data-id="' + p.id + '"' + dis(OP) + '>Reintentar</button>' : '' }
      ]),
      onRow: p => payDrawer(p.id),
      afterDraw: (c) => c.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const p = DB.payments.find(x => x.id === b.dataset.id); const again = () => refresh(() => payDrawer(p.id)); ({ val: validatePay, app: applyPay, rev: revertPayment, retry: retryPay })[b.dataset.act](p, again); })
    });
    if (params[0]) payDrawer(params[0]);
  });

  /* ================= Cuentas por pagar y costos (PROC-044 / 045 / 046) ================= */
  function cxpNorm() { DB.payables.forEach(p => { if (p.approved === undefined) p.approved = p.status === 'aprobada' || p.status === 'pagada'; if (p.paid == null) p.paid = 0; }); }
  function cxpStatus(p) { if (bal(p) <= 0) return 'pagada'; if (p.due < TODAY()) return 'vencida'; return p.approved ? 'aprobada' : 'abierta'; }
  const BANK_ACCOUNTS = ['BCP Cta. Cte. PEN 193-2284410-0-31', 'BCP Cta. Cte. USD 193-2284411-1-45', 'Interbank Cta. Cte. PEN 200-3001882210', 'BBVA Cta. Cte. PEN 0011-0182-0100045521'];
  const COST_TYPES = ['Costo adicional', 'Ajuste de tarifa', 'Penalidad de proveedor', 'Gasto operativo en destino'];
  const isCost = (p) => p.kind === 'costo_adicional';
  function cxpFlow(p) {
    if (isCost(p)) { const steps = ['Detectar', 'Registrar', 'Asociar', 'Validar', 'Aprobar', 'Impactar rentabilidad']; return UI.flow(steps, p.approved ? 6 : 3); }
    const steps = ['Costo / obligación', 'Validar', 'Aprobar', 'Pagar', 'Aplicar', 'Cerrar']; const st = cxpStatus(p);
    return UI.flow(steps, st === 'pagada' ? 6 : p.approved ? 3 : 2, st === 'vencida' && !p.approved ? 2 : undefined);
  }
  function approveCxP(p, done) {
    if (!need('finance.payables', 'aprobar cuentas por pagar')) return;
    if (p.approved) { UI.toast('La obligación ya está aprobada.', 'info'); return; }
    const prv = Q.provider(p.providerId) || {};
    const warns = [];
    if (prv.status && prv.status !== 'activo') warns.push('Proveedor en estado <b>' + esc(prv.status) + '</b> (contrato ' + esc(prv.contractEnd || '') + ').');
    if (p.resId && !Q.reservation(p.resId)) warns.push('La reserva asociada no existe.');
    UI.confirm({
      title: 'Aprobar ' + esc(p.id), confirmLabel: 'Aprobar',
      message: (isCost(p) ? 'PROC-045 · Validar → Aprobar → Impactar rentabilidad.' : 'PROC-044 · Validar → Aprobar.') + '<br><br>' + esc(prv.name || '') + ' · ' + esc(p.concept) + ' · <b>' + money(p.amount, p.currency) + '</b>' + (p.resId ? ' · ' + esc(p.resId) : '') + (warns.length ? '<div style="margin-top:10px">' + UI.alert('warn', warns.join('<br>')) + '</div>' : '') + (isCost(p) ? '<div class="small muted" style="margin-top:10px">Al aprobar, el costo se suma a la rentabilidad de la reserva.</div>' : ''),
      onConfirm: () => {
        const before = cxpStatus(p); p.approved = true; p.approvedBy = Auth.user.id; p.approvedAt = nowStr(); p.status = cxpStatus(p);
        Audit.log(isCost(p) ? 'Costo' : 'Cuenta por pagar', p.id, 'aprobar', before, 'aprobada');
        if (isCost(p) && p.resId) Audit.log('Rentabilidad', p.resId, 'impacto_costo', '', '+' + money(p.amount, p.currency) + ' (' + p.id + ')');
        Store.save(); UI.toast(esc(p.id) + ' aprobada' + (isCost(p) ? ' e incluida en la rentabilidad de ' + esc(p.resId) : '') + '.'); done && done();
      }
    });
  }
  function scheduleCxP(p, done) {
    if (!need('finance.payables', 'programar pagos') || !need(OP, 'programar pagos a proveedores')) return;
    if (!p.approved) { UI.toast('PROC-046: Obligación → Aprobación → Pago. Apruebe ' + esc(p.id) + ' antes de programar su pago.', 'bad'); return; }
    UI.modal({
      title: 'Programar pago ' + esc(p.id), size: 'sm', sub: esc(Q.providerName(p.providerId)) + ' · saldo ' + money(bal(p), p.currency),
      body: UI.form([{ id: 'sc-date', label: 'Fecha programada', type: 'date', col: 12, required: true, value: p.scheduled ? p.scheduled.date : (p.due < TODAY() ? TODAY() : p.due) }, { id: 'sc-acc', label: 'Cuenta de origen', type: 'select', col: 12, options: BANK_ACCOUNTS.filter(a => a.includes(p.currency)), value: p.scheduled ? p.scheduled.account : '' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Programar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const d = UI.formData(m); if (d['sc-date'] < TODAY()) { UI.toast('La fecha programada no puede ser anterior a hoy.', 'bad'); return false; } p.scheduled = { date: d['sc-date'], account: d['sc-acc'], by: Auth.user.id }; Audit.log('Cuenta por pagar', p.id, 'programar_pago', '', d['sc-date'] + ' · ' + d['sc-acc']); Store.save(); UI.toast('Pago de ' + esc(p.id) + ' programado para el ' + date(d['sc-date']) + '.'); done && done(); } }]
    });
  }
  function payCxP(p, done) {
    if (!need('finance.payables', 'pagar a proveedores') || !need(OP, 'registrar pagos a proveedores')) return;
    if (bal(p) <= 0) { UI.toast('La obligación ya está pagada.', 'info'); return; }
    if (!p.approved) { UI.toast('PROC-046: Obligación → Aprobación → Pago. ' + esc(p.id) + ' debe estar aprobada antes de pagarse.', 'bad'); return; }
    const b = bal(p); const prv = Q.provider(p.providerId) || {};
    UI.modal({
      title: 'Registrar pago a proveedor', sub: 'PROC-046 · Obligación → Aprobación → Pago → Confirmación → Aplicación',
      body: UI.alert('info', '<b>' + esc(p.id) + '</b> · ' + esc(prv.name || '') + ' (RUC ' + esc(prv.ruc || '—') + ') · ' + esc(p.concept) + '<br>Saldo: <b>' + money(b, p.currency) + '</b> · Condición: ' + esc(prv.paymentTerms || '—')) + '<div style="height:12px"></div>' +
        UI.form([
          { id: 'pp-method', label: 'Método', type: 'select', col: 6, options: ['Transferencia', 'Transferencia interbancaria (CCI)', 'Cheque de gerencia', 'Efectivo (caja chica)'] },
          { id: 'pp-acc', label: 'Cuenta de origen', type: 'select', col: 6, options: BANK_ACCOUNTS.filter(a => a.includes(p.currency)), value: p.scheduled ? p.scheduled.account : '' },
          { id: 'pp-amount', label: 'Monto (' + p.currency + ')', type: 'number', col: p.currency === 'USD' ? 4 : 6, required: true, value: b, step: '0.01', max: b },
          p.currency === 'USD' ? { id: 'pp-fx', label: 'Tipo de cambio', type: 'number', col: 4, required: true, step: '0.001', value: FX() } : null,
          { id: 'pp-date', label: 'Fecha', type: 'date', col: p.currency === 'USD' ? 4 : 6, required: true, value: TODAY() },
          { id: 'pp-ref', label: 'N° de operación', col: 12, required: true }
        ].filter(Boolean)),
      actions: [{ label: 'Cancelar' }, {
        label: 'Registrar pago', cls: 'primary', onClick: (m) => {
          if (!UI.validate(m)) return false;
          const d = UI.formData(m); const a = r2(d['pp-amount']);
          if (!(a > 0) || a > b + 0.005) { UI.toast('El monto debe ser mayor que cero y no exceder el saldo (' + money(b, p.currency) + ').', 'bad'); return false; }
          const before = p.paid || 0;
          p.payouts = p.payouts || [];
          p.payouts.push({ id: 'PPR-' + String(1000 + DB.payables.reduce((n, x) => n + (x.payouts || []).length, 0) + 1), date: d['pp-date'], amount: a, method: d['pp-method'], account: d['pp-acc'], ref: d['pp-ref'], fx: p.currency === 'USD' ? +d['pp-fx'] : null, by: Auth.user.id });
          p.paid = r2(before + a); p.status = cxpStatus(p); if (p.status === 'pagada') p.scheduled = null;
          Audit.log('Cuenta por pagar', p.id, 'pagar', money(before, p.currency), money(p.paid, p.currency) + ' · ' + UI.statusLabel(p.status) + ' · ' + d['pp-ref']);
          Notify.push('pago.proveedor', 'Email', prv.email || prv.name, 'Pago realizado ' + p.id + ' — ' + money(a, p.currency) + ' · Op. ' + d['pp-ref']);
          Store.save(); UI.toast('Pago a ' + esc(prv.name || 'proveedor') + ' registrado. ' + esc(p.id) + ': ' + UI.statusLabel(p.status) + '.'); done && done();
        }
      }]
    });
  }
  function costModal(done, presetRes) {
    if (!need('finance.payables', 'registrar costos') || !need(OP, 'registrar costos')) return;
    const resList = DB.reservations.filter(r => !['cancelada', 'borrador'].includes(r.status));
    const provs = DB.providers.filter(p => p.status === 'activo');
    UI.modal({
      title: 'Registrar costo', size: 'lg', sub: 'PROC-045 · Detectar → Registrar → Asociar → Validar → Aprobar → Impactar rentabilidad',
      body: UI.form([
        { type: 'section', label: 'Asociación' },
        { id: 'co-res', label: 'Reserva', type: 'select', col: 6, required: true, options: resList.map(r => [r.id, r.id + ' · ' + r.title]), value: presetRes || '' , placeholder: 'Seleccione…' },
        { id: 'co-srv', label: 'Servicio de la reserva', type: 'select', col: 6, options: [] },
        { id: 'co-prv', label: 'Proveedor', type: 'select', col: 6, required: true, options: provs.map(p => [p.id, p.name + ' · ' + p.type]), placeholder: 'Seleccione…' },
        { id: 'co-type', label: 'Tipo de costo', type: 'select', col: 6, options: COST_TYPES },
        { type: 'section', label: 'Registro' },
        { id: 'co-concept', label: 'Concepto', col: 12, required: true, placeholder: 'p. ej. Almuerzo adicional por cambio de horario de tren' },
        { id: 'co-cur', label: 'Moneda', type: 'select', col: 3, options: ['PEN', 'USD'] },
        { id: 'co-amt', label: 'Monto', type: 'number', col: 3, required: true, step: '0.01', min: 0 },
        { id: 'co-due', label: 'Vencimiento', type: 'date', col: 3, required: true, value: addDays(TODAY(), 15) },
        { id: 'co-doc', label: 'Documento del proveedor', col: 3, placeholder: 'F001-000123' },
        { id: 'co-note', label: 'Evidencia / sustento', type: 'textarea', col: 12, rows: 2 },
        { type: 'html', col: 12, html: '<div id="co-impact"></div>' }
      ]),
      onOpen: (m) => {
        const res = m.querySelector('#co-res'), srv = m.querySelector('#co-srv'), prv = m.querySelector('#co-prv');
        const fillSrv = () => { const r = Q.reservation(res.value); srv.innerHTML = '<option value="">Costo general de la reserva</option>' + (r ? r.services.filter(s => s.status !== 'cancelado').map(s => '<option value="' + s.id + '">' + esc(s.id + ' · ' + s.name) + '</option>').join('') : ''); };
        const impact = () => {
          const r = Q.reservation(res.value); const box = m.querySelector('#co-impact');
          if (!r) { box.innerHTML = ''; return; }
          const f = resFin(r); const a = +m.querySelector('#co-amt').value || 0; const add = pen(a, m.querySelector('#co-cur').value, FX());
          const newPct = f.income ? (f.gross - add) / f.income * 100 : 0;
          box.innerHTML = UI.alert(newPct < 15 ? 'bad' : newPct <= 25 ? 'warn' : 'info', 'Impacto estimado al aprobar: margen bruto de ' + esc(r.id) + ' pasa de <b>' + fmtN(f.pct, 1) + '%</b> a <b>' + fmtN(newPct, 1) + '%</b> (' + S(f.gross) + ' → ' + S(f.gross - add) + ').');
        };
        res.onchange = () => { fillSrv(); impact(); };
        srv.onchange = () => { const r = Q.reservation(res.value); const s = r && r.services.find(x => x.id === srv.value); if (s && s.providerId) prv.value = s.providerId; };
        m.querySelector('#co-amt').oninput = impact; m.querySelector('#co-cur').onchange = impact;
        fillSrv(); impact();
      },
      actions: [{ label: 'Cancelar' }, {
        label: 'Registrar costo', cls: 'primary', onClick: (m) => {
          if (!UI.validate(m)) return false;
          const d = UI.formData(m); const a = r2(d['co-amt']);
          if (!(a > 0)) { UI.toast('El monto debe ser mayor que cero.', 'bad'); return false; }
          const p = { id: nextId(DB.payables, 'CXP-', 5), providerId: d['co-prv'], resId: d['co-res'], serviceId: d['co-srv'] || null, concept: d['co-concept'], amount: a, currency: d['co-cur'], fx: d['co-cur'] === 'USD' ? FX() : null, due: d['co-due'], paid: 0, status: 'abierta', approved: false, kind: 'costo_adicional', costType: d['co-type'], supplierDoc: d['co-doc'], note: d['co-note'], createdAt: nowStr(), by: Auth.user.id };
          DB.payables.unshift(p);
          Audit.log('Costo', p.id, 'registrar', '', money(a, p.currency) + ' · ' + p.resId + (p.serviceId ? ' / ' + p.serviceId : ''));
          Store.save(); UI.toast('Costo <b>' + p.id + '</b> registrado y asociado a ' + esc(p.resId) + '. Pendiente de validación y aprobación para impactar la rentabilidad.');
          done && done(p);
        }
      }]
    });
  }
  function cxpActionsHtml(p) {
    const b = [];
    if (!p.approved && bal(p) > 0) b.push('<button class="btn xs primary" data-cxp="apr" data-id="' + p.id + '"' + dis('finance.payables') + '>Aprobar</button>');
    if (p.approved && bal(p) > 0 && canOp()) b.push('<button class="btn xs" data-cxp="sch" data-id="' + p.id + '">Programar</button><button class="btn xs primary" data-cxp="pay" data-id="' + p.id + '">Pagar</button>');
    return b.length ? '<span class="row" style="gap:4px;flex-wrap:nowrap">' + b.join('') + '</span>' : '';
  }
  function bindCxpActions(root, againFor) {
    root.querySelectorAll('[data-cxp]').forEach(btn => btn.onclick = () => { const p = DB.payables.find(x => x.id === btn.dataset.id); ({ apr: approveCxP, sch: scheduleCxP, pay: payCxP })[btn.dataset.cxp](p, againFor(p)); });
  }
  function cxpDrawer(id) {
    cxpNorm();
    const p = DB.payables.find(x => x.id === id); if (!p) return;
    const prv = Q.provider(p.providerId) || {}; const st = cxpStatus(p);
    const again = () => refresh(() => cxpDrawer(id));
    const srv = p.serviceId && Q.reservation(p.resId) ? Q.reservation(p.resId).services.find(s => s.id === p.serviceId) : null;
    const acts = [];
    if (!p.approved && bal(p) > 0 && Auth.can('finance.payables')) acts.push({ label: 'Aprobar', cls: 'primary', icon: 'check', onClick: () => { approveCxP(p, again); return false; } });
    if (p.approved && bal(p) > 0 && canOp()) acts.push({ label: 'Programar pago', icon: 'calendar', onClick: () => { scheduleCxP(p, again); return false; } }, { label: 'Registrar pago', cls: 'primary', icon: 'coins', onClick: () => { payCxP(p, again); return false; } });
    UI.drawer({
      title: (isCost(p) ? 'Costo ' : 'Cuenta por pagar ') + esc(p.id), sub: esc(prv.name || '') + ' · ' + esc(p.concept), wide: true,
      body: (st === 'vencida' ? UI.alert('bad', '<b>Obligación vencida</b> desde el ' + date(p.due) + '.' + (!p.approved ? ' Requiere aprobación antes del pago (PROC-046).' : '')) : '') +
        (isCost(p) && !p.approved ? UI.alert('warn', 'Costo registrado pendiente de validación y aprobación: aún <b>no impacta</b> la rentabilidad de ' + esc(p.resId) + ' (PROC-045).') : '') +
        '<div class="card" style="margin:12px 0"><div class="card-b">' + cxpFlow(p) + '</div></div>' +
        '<div class="grid g2"><div>' + UI.dl([['Proveedor', prvLink(p.providerId) + '<div class="xs faint">RUC ' + esc(prv.ruc || '—') + ' · ' + esc(prv.paymentTerms || '') + '</div>'], ['Reserva', resLink(p.resId)], srv ? ['Servicio', esc(srv.id + ' · ' + srv.name)] : null, ['Concepto', esc(p.concept)], isCost(p) ? ['Tipo de costo', esc(p.costType || 'Costo adicional')] : null, p.supplierDoc ? ['Doc. proveedor', '<span class="mono">' + esc(p.supplierDoc) + '</span>'] : null, ['Vencimiento', date(p.due)], p.scheduled ? ['Pago programado', date(p.scheduled.date) + '<div class="xs faint">' + esc(p.scheduled.account) + '</div>'] : null, ['Aprobación', p.approved ? UI.badge('aprobada') + (p.approvedBy ? ' <span class="xs faint">' + esc(Q.userName(p.approvedBy)) + '</span>' : '') : UI.badge('pendiente', 'Por aprobar')]]) + '</div>' +
        '<div><div class="stat-line"><span class="muted">Importe</span><b class="num">' + money(p.amount, p.currency) + '</b></div><div class="stat-line"><span class="muted">Pagado</span><b class="num ok">' + money(p.paid || 0, p.currency) + '</b></div><div class="stat-line total"><span>Saldo</span><span class="num">' + money(bal(p), p.currency) + '</span></div>' + (p.currency === 'USD' ? '<div class="xs faint right">≈ ' + S(penOf(p, bal(p))) + ' al TC ' + fmtN(fxOf(p), 3) + '</div>' : '') + '<div style="margin-top:8px">' + UI.badge(st) + '</div></div></div>' +
        '<div class="section-title" style="margin:18px 0 8px">Pagos realizados</div>' +
        miniTable([['Pago'], ['Fecha'], ['Método / cuenta'], ['Operación'], ['Monto', 'num']], (p.payouts || []).map(x => '<tr><td class="mono">' + esc(x.id) + '</td><td>' + date(x.date) + '</td><td><div class="small">' + esc(x.method) + '</div><div class="xs faint">' + esc(x.account || '') + '</div></td><td class="mono">' + esc(x.ref) + '</td><td class="num">' + amtCell(x.amount, p.currency, x.fx) + '</td></tr>'), st === 'pagada' ? 'Pago registrado antes de la puesta en marcha del sistema' : 'Sin pagos registrados') +
        '<div class="section-title" style="margin:18px 0 10px">Auditoría</div>' + auditTimeline([p.id]),
      actions: acts
    });
  }
  App.register('finanzas/proveedores', (el, params) => {
    css(); cxpNorm();
    if (!guard(el, 'finance.payables', 'Cuentas por pagar')) return;
    const all = DB.payables;
    const open = all.filter(p => bal(p) > 0);
    const venc = open.filter(p => cxpStatus(p) === 'vencida');
    const toApprove = open.filter(p => !p.approved);
    const paidMonth = all.flatMap(p => (p.payouts || []).filter(x => String(x.date).startsWith(MONTH())).map(x => pen(x.amount, p.currency, x.fx)));
    const sched = open.filter(p => p.scheduled && daysFromToday(p.scheduled.date) <= 7);
    el.innerHTML = '<div class="page">' +
      header('Cuentas por pagar y costos', 'Obligaciones con proveedores (PROC-044), registro de costos (PROC-045) y pagos a proveedores (PROC-046). Estados: Abierta → Aprobada → Pagada; alternativo Vencida.', 'Cuentas por pagar', '<button class="btn primary" id="cp-cost"' + dis(OP) + '>' + UI.icon('plus') + 'Registrar costo</button>') +
      roleNote('cxp') +
      (venc.length ? UI.alert('bad', '<b>' + venc.length + ' obligación(es) vencida(s)</b> con proveedores: ' + venc.map(p => cxpLink(p.id) + ' (' + esc(Q.providerName(p.providerId)) + ')').join(', ') + '.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Por pagar total', value: kS(sum(open, p => penOf(p, bal(p)))), sub: open.length + ' obligaciones', tone: 'accent', icon: 'coins' }) +
        UI.kpi({ label: 'Vencido', value: kS(sum(venc, p => penOf(p, bal(p)))), sub: venc.length + ' documento(s)', tone: 'bad', icon: 'alert' }) +
        UI.kpi({ label: 'Por aprobar', value: String(toApprove.length), sub: S(sum(toApprove, p => penOf(p, bal(p))), 0), tone: 'sun', icon: 'fileCheck' }) +
        UI.kpi({ label: 'Pagado en el mes', value: kS(sum(paidMonth)), sub: sched.length + ' pago(s) programado(s) 7 días', tone: 'ok', icon: 'checkCircle' }) +
      '</div>' +
      '<div class="grid g3">' + UI.card('PROC-044 · Cuenta por pagar', proc(['Costo / obligación', 'Validar', 'Aprobar', 'Pagar', 'Aplicar', 'Cerrar'])) + UI.card('PROC-045 · Costos', proc(['Detectar', 'Registrar', 'Asociar', 'Validar', 'Aprobar', 'Impactar rentabilidad'])) + UI.card('PROC-046 · Pago proveedor', proc(['Obligación', 'Aprobación', 'Pago', 'Confirmación', 'Aplicación'])) + '</div>' +
      '<div id="cp-tabs" style="min-width:0"></div></div>';
    el.querySelector('#cp-cost').onclick = () => costModal((p) => refresh(() => cxpDrawer(p.id)));
    const againFor = (p) => () => refresh(() => cxpDrawer(p.id));
    UI.tabs(el.querySelector('#cp-tabs'), [
      { id: 'doc', label: 'Por documento', count: all.length, render: (b) => UI.dataTable(b, {
        exportName: 'cuentas_por_pagar', rows: () => DB.payables,
        search: p => [p.id, p.concept, p.resId, Q.providerName(p.providerId)].join(' '), defaultSort: 'due',
        filters: [{ label: 'Estado', options: ['abierta', 'aprobada', 'vencida', 'pagada'], match: (p, v) => cxpStatus(p) === v }, { label: 'Origen', options: [['svc', 'Servicios de reserva'], ['cost', 'Costos registrados (PROC-045)']], match: (p, v) => v === 'cost' ? isCost(p) : !isCost(p) }],
        columns: [
          { key: 'id', label: 'Documento', render: p => '<span class="mono" style="font-weight:600">' + esc(p.id) + '</span>' },
          { key: 'prov', label: 'Proveedor', sortVal: p => Q.providerName(p.providerId), render: p => '<div class="cell-main">' + prvLink(p.providerId) + '</div><div class="cell-sub">' + esc((Q.provider(p.providerId) || {}).type || '') + '</div>', csv: p => Q.providerName(p.providerId) },
          { key: 'resId', label: 'Reserva', render: p => resLink(p.resId) },
          { key: 'concept', label: 'Concepto', render: p => esc(p.concept) + (isCost(p) ? ' <span class="tag">' + esc(p.costType || 'Costo adicional') + '</span>' : '') },
          { key: 'due', label: 'Vence', render: p => '<span class="nowrap">' + date(p.due) + '</span>' + (p.scheduled && bal(p) > 0 ? '<div class="cell-sub">Prog. ' + dateShort(p.scheduled.date) + '</div>' : '') },
          { key: 'amount', label: 'Importe', align: 'num', sortVal: p => penOf(p), render: p => amtCell(p.amount, p.currency, p.fx), csv: p => p.currency + ' ' + p.amount },
          { key: 'bal', label: 'Saldo', align: 'num', sortVal: p => penOf(p, bal(p)), render: p => '<b class="nowrap">' + money(bal(p), p.currency) + '</b>', csv: p => bal(p) },
          { key: 'status', label: 'Estado', sortVal: p => cxpStatus(p), render: p => UI.badge(cxpStatus(p)) + (cxpStatus(p) === 'vencida' && p.approved ? '<div class="cell-sub">aprobada</div>' : ''), csv: p => UI.statusLabel(cxpStatus(p)) },
          { key: '', label: 'Acciones', sort: false, csv: () => '', render: cxpActionsHtml }
        ],
        footer: rows => '<tr><td colspan="6">Saldo consolidado</td><td class="num nowrap">' + S(sum(rows, p => penOf(p, bal(p)))) + '</td><td colspan="2"></td></tr>',
        onRow: p => cxpDrawer(p.id), afterDraw: (c) => bindCxpActions(c, againFor)
      }) },
      { id: 'prov', label: 'Por proveedor', count: Object.keys(groupBy(all, 'providerId')).length, render: (b) => {
        const g = groupBy(DB.payables, 'providerId');
        const rows = Object.keys(g).map(pid => { const ps = g[pid]; const op = ps.filter(p => bal(p) > 0); return { pid, n: ps.length, total: sum(ps, p => penOf(p)), paid: sum(ps, p => penOf(p, p.paid || 0)), bal: sum(op, p => penOf(p, bal(p))), venc: sum(op.filter(p => cxpStatus(p) === 'vencida'), p => penOf(p, bal(p))), next: op.map(p => p.due).sort()[0] || '' }; }).sort((a, b) => b.bal - a.bal);
        b.innerHTML = UI.card('Saldos agrupados por proveedor', miniTable([['Proveedor'], ['Docs', 'num'], ['Total', 'num'], ['Pagado', 'num'], ['Saldo', 'num'], ['Vencido', 'num'], ['Próx. vencimiento']], rows.map(r => '<tr class="click" data-prv="' + r.pid + '"><td><div class="cell-main">' + prvLink(r.pid) + '</div><div class="cell-sub">' + esc((Q.provider(r.pid) || {}).paymentTerms || '') + '</div></td><td class="num">' + r.n + '</td><td class="num nowrap">' + S(r.total) + '</td><td class="num nowrap">' + S(r.paid) + '</td><td class="num nowrap"><b>' + S(r.bal) + '</b></td><td class="num nowrap ' + (r.venc > 0 ? 'bad' : '') + '">' + S(r.venc) + '</td><td>' + (r.next ? date(r.next) : '—') + '</td></tr>').concat(['<tr><td><b>Total</b></td><td class="num"><b>' + DB.payables.length + '</b></td><td class="num nowrap"><b>' + S(sum(rows, 'total')) + '</b></td><td class="num nowrap"><b>' + S(sum(rows, 'paid')) + '</b></td><td class="num nowrap"><b>' + S(sum(rows, 'bal')) + '</b></td><td class="num nowrap"><b>' + S(sum(rows, 'venc')) + '</b></td><td></td></tr>'])), { tight: true, sub: 'Montos consolidados en S/ · clic para ver los documentos del proveedor' });
        b.querySelectorAll('[data-prv]').forEach(tr => tr.onclick = (e) => { if (e.target.closest('a')) return; provDrawer(tr.dataset.prv); });
      } },
      { id: 'cost', label: 'Costos registrados', count: all.filter(isCost).length, render: (b) => {
        const cs = DB.payables.filter(isCost);
        b.innerHTML = UI.card('Costos adicionales (PROC-045)', miniTable([['Documento'], ['Reserva'], ['Proveedor'], ['Tipo'], ['Concepto'], ['Monto', 'num'], ['Validación'], ['Rentabilidad']], cs.map(p => '<tr class="click" data-id="' + p.id + '"><td class="mono">' + esc(p.id) + '</td><td>' + resLink(p.resId) + '</td><td>' + prvLink(p.providerId) + '</td><td>' + esc(p.costType || '') + '</td><td>' + esc(p.concept) + '</td><td class="num">' + amtCell(p.amount, p.currency, p.fx) + '</td><td>' + (p.approved ? UI.badge('aprobada') : UI.badge('pendiente', 'Por validar')) + '</td><td>' + (p.approved ? '<span class="ok small">Impactada</span>' : '<span class="faint small">Sin impacto</span>') + '</td></tr>'), 'Aún no se registraron costos adicionales. Use “Registrar costo”.'), { tight: true, actions: '<button class="btn sm" id="cp-cost2"' + dis(OP) + '>' + UI.icon('plus') + 'Registrar costo</button>' });
        b.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = (e) => { if (e.target.closest('a')) return; cxpDrawer(tr.dataset.id); });
        b.querySelector('#cp-cost2').onclick = () => costModal((p) => refresh(() => cxpDrawer(p.id)));
      } }
    ]);
    if (params[0]) cxpDrawer(params[0]);
  });
  function provDrawer(pid) {
    const ps = DB.payables.filter(p => p.providerId === pid); const prv = Q.provider(pid) || {};
    UI.drawer({
      title: esc(prv.name || pid), sub: 'RUC ' + esc(prv.ruc || '—') + ' · ' + esc(prv.paymentTerms || '') + ' · ' + esc(prv.email || ''), wide: true,
      body: miniTable([['Documento'], ['Reserva'], ['Concepto'], ['Vence'], ['Saldo', 'num'], ['Estado'], ['']], ps.map(p => '<tr><td>' + cxpLink(p.id) + '</td><td>' + resLink(p.resId) + '</td><td>' + esc(p.concept) + '</td><td class="nowrap">' + date(p.due) + '</td><td class="num nowrap">' + money(bal(p), p.currency) + '</td><td>' + UI.badge(cxpStatus(p)) + '</td><td>' + cxpActionsHtml(p) + '</td></tr>')) +
        '<div class="stat-line total" style="margin-top:12px"><span>Saldo total</span><span class="num">' + S(sum(ps, p => penOf(p, bal(p)))) + '</span></div>',
      actions: [{ label: 'Ver ficha del proveedor', onClick: () => App.go('#/catalogo/proveedores/' + pid) }],
      onOpen: (d) => bindCxpActions(d, () => () => refresh(() => provDrawer(pid)))
    });
  }

  /* ================= Comisiones (PROC-047) ================= */
  const COMM_ACTIVE = ['confirmada', 'en_operacion', 'completada', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'reprogramada'];
  function commRule(res) {
    if (res.channel === 'B2B') { const ag = agencyOfClient(res.clientId); if (ag) return { kind: 'Agencia B2B', beneficiary: ag.id, pct: ag.commissionPct, base: res.total, rule: 'Lista B2B ' + ag.priceList + ' · ' + ag.commissionPct + '% sobre tarifa B2B' }; }
    const corp = ['Corporativo', 'Grupos'].includes(res.channel) || ((Q.client(res.clientId) || {}).segment === 'Corporativo');
    const pct = corp ? 2.5 : 3;
    const base = res.currency === 'PEN' ? r2(res.total / (1 + DB.settings.taxPct / 100)) : res.total;
    return { kind: 'Vendedor', beneficiary: res.owner, pct, base, rule: 'Vendedor ' + (corp ? 'corporativo/grupos 2.5%' : 'directo/e-commerce 3%') + ' sobre venta neta' + (res.currency === 'PEN' ? ' (sin IGV)' : ' (exportación, sin IGV)') };
  }
  function commFlow(c) { const steps = ['Venta', 'Regla', 'Cálculo', 'Revisión', 'Aprobación', 'Pago', 'Registro']; return UI.flow(steps, c.status === 'pagada' ? 7 : c.status === 'aprobada' ? 5 : 3); }
  function approveComm(c, done) {
    if (!need('finance.commissions', 'aprobar comisiones')) return;
    if (c.status !== 'calculada') { UI.toast('Solo se aprueban comisiones en estado Calculada.', 'warn'); return; }
    c.status = 'aprobada'; c.approvedBy = Auth.user.id; c.approvedAt = nowStr(); hist(c, 'aprobada');
    Audit.log('Comisión', c.id, 'aprobar', 'calculada', 'aprobada · ' + money(c.amount, c.currency)); Store.save();
    UI.toast('Comisión ' + c.id + ' aprobada.'); done && done();
  }
  function payComm(c, done) {
    if (!need('finance.commissions', 'pagar comisiones') || !need(OP, 'registrar el pago de comisiones')) return;
    if (c.status !== 'aprobada') { UI.toast('PROC-047: la comisión debe estar aprobada antes del pago.', 'bad'); return; }
    UI.modal({
      title: 'Pagar comisión ' + esc(c.id), size: 'sm', sub: esc(benText(c)) + ' · ' + money(c.amount, c.currency),
      body: UI.form([{ id: 'cm-method', label: 'Forma de pago', type: 'select', col: 12, options: c.kind === 'Agencia B2B' ? ['Nota de crédito a cuenta B2B', 'Transferencia BCP'] : ['Planilla del mes', 'Transferencia BCP'] }, { id: 'cm-ref', label: 'Referencia', col: 12, required: true, value: c.kind === 'Agencia B2B' ? '' : 'Planilla ' + MONTH() }]),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar pago', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const d = UI.formData(m); c.status = 'pagada'; c.paidAt = nowStr(); c.payRef = d['cm-method'] + ' · ' + d['cm-ref']; hist(c, 'pagada', c.payRef); Audit.log('Comisión', c.id, 'pagar', 'aprobada', 'pagada · ' + c.payRef); const u = Q.user(c.beneficiary); const ag = Q.agency(c.beneficiary); Notify.push('comision.pagada', 'Email', u ? u.email : ag ? ag.name : c.beneficiary, 'Comisión ' + c.id + ' pagada — ' + money(c.amount, c.currency)); Store.save(); UI.toast('Comisión pagada y registrada.'); done && done(); } }]
    });
  }
  function recalcComm(c, done) {
    if (!need('finance.commissions', 'recalcular comisiones') || !need(OP, 'recalcular comisiones')) return;
    if (c.status === 'pagada') { UI.toast('Comisión pagada: no se puede recalcular. Registre un ajuste en el siguiente periodo.', 'bad'); return; }
    const res = Q.reservation(c.resId); if (!res) { UI.toast('Reserva no encontrada.', 'bad'); return; }
    const rule = commRule(res); const amount = r2(rule.base * rule.pct / 100);
    const before = money(c.amount, c.currency) + ' (' + c.pct + '% de ' + fmtN(c.base) + ')';
    const prev = c.status;
    Object.assign(c, { base: rule.base, pct: rule.pct, amount, rule: rule.rule, currency: res.currency });
    if (prev === 'aprobada') c.status = 'calculada';
    hist(c, c.status, 'Recalculada');
    Audit.log('Comisión', c.id, 'recalcular', before, money(amount, c.currency) + ' (' + rule.pct + '% de ' + fmtN(rule.base) + ')' + (prev === 'aprobada' ? ' · vuelve a revisión' : ''));
    Store.save(); UI.toast('Comisión recalculada: ' + money(amount, c.currency) + (prev === 'aprobada' ? '. Requiere nueva aprobación.' : '.'), prev === 'aprobada' ? 'warn' : 'ok'); done && done();
  }
  function generateComms(done) {
    if (!need('finance.commissions', 'calcular comisiones') || !need(OP, 'calcular comisiones')) return;
    const created = [];
    DB.reservations.filter(r => COMM_ACTIVE.includes(r.status)).forEach(res => {
      const rule = commRule(res);
      if (DB.commissions.some(c => c.resId === res.id && c.kind === rule.kind)) return;
      const c = { id: nextId(DB.commissions, 'COM-', 4), resId: res.id, beneficiary: rule.beneficiary, kind: rule.kind, base: rule.base, pct: rule.pct, amount: r2(rule.base * rule.pct / 100), currency: res.currency, fx: res.currency === 'USD' ? FX() : null, status: 'calculada', rule: rule.rule, createdAt: nowStr() };
      hist(c, 'calculada', rule.rule); DB.commissions.unshift(c); created.push(c);
      Audit.log('Comisión', c.id, 'calcular', '', money(c.amount, c.currency) + ' · ' + res.id);
    });
    Store.save();
    if (created.length) UI.toast(created.length + ' comisión(es) calculada(s): ' + created.map(c => c.id).join(', ') + '.'); else UI.toast('No hay ventas pendientes de cálculo de comisión.', 'info');
    done && done();
  }
  function commDrawer(id) {
    const c = DB.commissions.find(x => x.id === id); if (!c) return;
    const res = Q.reservation(c.resId); const again = () => refresh(() => commDrawer(id));
    const rule = res ? commRule(res) : null; const diff = rule ? r2(rule.base * rule.pct / 100) - c.amount : 0;
    const acts = [];
    if (c.status !== 'pagada' && canOp()) acts.push({ label: 'Recalcular', icon: 'refresh', onClick: () => { recalcComm(c, again); return false; } });
    if (c.status === 'calculada') acts.push({ label: 'Aprobar', cls: 'primary', icon: 'check', onClick: () => { approveComm(c, again); return false; } });
    if (c.status === 'aprobada' && canOp()) acts.push({ label: 'Registrar pago', cls: 'primary', icon: 'coins', onClick: () => { payComm(c, again); return false; } });
    UI.drawer({
      title: 'Comisión ' + esc(c.id), sub: esc(c.kind) + ' · ' + esc(benText(c)), wide: true,
      body: '<div class="card" style="margin-bottom:12px"><div class="card-b">' + commFlow(c) + '</div></div>' +
        (Math.abs(diff) > 0.05 && c.status !== 'pagada' ? UI.alert('warn', 'El cálculo difiere de la regla vigente en ' + money(diff, c.currency) + '. Use “Recalcular”.') : '') +
        '<div class="grid g2"><div>' + UI.dl([['Beneficiario', benLabel(c)], ['Tipo', esc(c.kind)], ['Reserva', resLink(c.resId) + (res ? '<div class="xs faint">' + esc(res.title) + ' · ' + esc(res.channel) + '</div>' : '')], ['Regla aplicada', esc(c.rule || (rule ? rule.rule : ''))], ['Estado', UI.badge(c.status)], c.payRef ? ['Pago', esc(c.payRef)] : null]) + '</div><div>' +
        '<div class="stat-line"><span class="muted">Base (venta neta)</span><b class="num">' + money(c.base, c.currency) + '</b></div><div class="stat-line"><span class="muted">Porcentaje</span><b class="num">' + fmtN(c.pct, 2) + '%</b></div><div class="stat-line total"><span>Comisión</span><span class="num">' + money(c.amount, c.currency) + '</span></div>' + fxLine(c.amount, c.currency, c.fx || (res && res.fx)) + '</div></div>' +
        '<div class="section-title" style="margin:18px 0 10px">Auditoría</div>' + auditTimeline([c.id]),
      actions: acts
    });
  }
  App.register('finanzas/comisiones', (el, params) => {
    css();
    if (!guard(el, 'finance.commissions', 'Comisiones')) return;
    const C = DB.commissions; const P = (c) => pen(c.amount, c.currency, c.fx || (Q.reservation(c.resId) || {}).fx);
    const by = (st) => C.filter(c => c.status === st);
    const pendingSales = DB.reservations.filter(r => COMM_ACTIVE.includes(r.status) && !C.some(c => c.resId === r.id && c.kind === commRule(r).kind));
    const g = groupBy(C, 'beneficiary');
    const benRows = Object.keys(g).map(k => { const cs = g[k]; return { c: cs[0], n: cs.length, calc: sum(cs.filter(c => c.status === 'calculada'), P), apr: sum(cs.filter(c => c.status === 'aprobada'), P), pag: sum(cs.filter(c => c.status === 'pagada'), P), tot: sum(cs, P) }; }).sort((a, b) => b.tot - a.tot);
    el.innerHTML = '<div class="page">' +
      header('Comisiones', 'Comisiones de vendedores y agencias B2B (PROC-047): Venta → Regla → Cálculo → Revisión → Aprobación → Pago → Registro.', 'Comisiones', '<button class="btn primary" id="cm-gen"' + dis(OP) + '>' + UI.icon('refresh') + 'Calcular comisiones pendientes' + (pendingSales.length ? ' (' + pendingSales.length + ')' : '') + '</button>') +
      roleNote('com') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Por revisar (calculadas)', value: S(sum(by('calculada'), P), 0), sub: by('calculada').length + ' comisión(es)', tone: 'info', icon: 'percent' }) +
        UI.kpi({ label: 'Aprobadas por pagar', value: S(sum(by('aprobada'), P), 0), sub: by('aprobada').length + ' comisión(es)', tone: 'sun', icon: 'fileCheck' }) +
        UI.kpi({ label: 'Pagadas', value: S(sum(by('pagada'), P), 0), sub: by('pagada').length + ' comisión(es)', tone: 'ok', icon: 'checkCircle' }) +
        UI.kpi({ label: 'Ventas sin cálculo', value: String(pendingSales.length), sub: pendingSales.map(r => r.id).join(', ') || 'Al día', tone: 'violet', icon: 'suitcase' }) +
      '</div>' +
      '<div class="grid g-1-2">' +
        UI.card('Reglas de comisión vigentes', '<div class="list">' +
          '<div class="list-item"><div class="ico-box">' + UI.icon('user') + '</div><div class="grow"><div class="small" style="font-weight:600">Vendedor · venta directa / e-commerce</div><div class="xs faint">3.0% sobre venta neta (sin IGV). Exportación de servicios: sobre total.</div></div><b class="num">3.0%</b></div>' +
          '<div class="list-item"><div class="ico-box">' + UI.icon('building') + '</div><div class="grow"><div class="small" style="font-weight:600">Vendedor · corporativo / grupos</div><div class="xs faint">2.5% sobre venta neta (sin IGV)</div></div><b class="num">2.5%</b></div>' +
          DB.b2bAgencies.map(a => '<div class="list-item"><div class="ico-box sun">' + UI.icon('handshake') + '</div><div class="grow"><div class="small" style="font-weight:600">' + esc(a.name) + '</div><div class="xs faint">Agencia B2B · ' + esc(a.priceList) + ' · ' + UI.badge(a.status) + '</div></div><b class="num">' + fmtN(a.commissionPct, 1) + '%</b></div>').join('') +
          '</div>', { tight: true, sub: 'Lista B2B según convenio vigente (Regla 14)' }) +
        UI.card('Resumen por beneficiario', miniTable([['Beneficiario'], ['Tipo'], ['N°', 'num'], ['Calculada', 'num'], ['Aprobada', 'num'], ['Pagada', 'num'], ['Total S/', 'num']], benRows.map(r => '<tr><td>' + benLabel(r.c) + '</td><td class="small">' + esc(r.c.kind) + '</td><td class="num">' + r.n + '</td><td class="num nowrap">' + S(r.calc) + '</td><td class="num nowrap">' + S(r.apr) + '</td><td class="num nowrap">' + S(r.pag) + '</td><td class="num nowrap"><b>' + S(r.tot) + '</b></td></tr>')), { tight: true, sub: 'Consolidado en soles' }) +
      '</div><div id="cm-tbl" style="min-width:0"></div></div>';
    el.querySelector('#cm-gen').onclick = () => generateComms(() => refresh());
    UI.dataTable(el.querySelector('#cm-tbl'), {
      exportName: 'comisiones', rows: () => DB.commissions,
      search: c => [c.id, c.resId, benText(c), c.kind].join(' '),
      filters: [{ label: 'Estado', options: ['calculada', 'aprobada', 'pagada'], key: 'status' }, { label: 'Tipo', options: [['Vendedor', 'Vendedor'], ['Agencia B2B', 'Agencia B2B']], key: 'kind' }],
      columns: [
        { key: 'id', label: 'Comisión', render: c => '<span class="mono" style="font-weight:600">' + esc(c.id) + '</span>' },
        { key: 'ben', label: 'Beneficiario', sortVal: benText, render: benLabel, csv: benText },
        { key: 'kind', label: 'Tipo' },
        { key: 'resId', label: 'Reserva', render: c => resLink(c.resId) },
        { key: 'base', label: 'Base', align: 'num', render: c => '<span class="nowrap">' + money(c.base, c.currency) + '</span>' },
        { key: 'pct', label: '%', align: 'num', render: c => fmtN(c.pct, 1) + '%' },
        { key: 'amount', label: 'Comisión', align: 'num', sortVal: P, render: c => amtCell(c.amount, c.currency, c.fx || (Q.reservation(c.resId) || {}).fx), csv: c => c.currency + ' ' + c.amount },
        { key: 'status', label: 'Estado', render: c => UI.badge(c.status), csv: c => UI.statusLabel(c.status) },
        { key: '', label: 'Acciones', sort: false, csv: () => '', render: c => '<span class="row" style="gap:4px;flex-wrap:nowrap">' + (c.status === 'calculada' ? '<button class="btn xs primary" data-cm="apr" data-id="' + c.id + '"' + dis('finance.commissions') + '>Aprobar</button>' : '') + (c.status === 'aprobada' ? '<button class="btn xs primary" data-cm="pay" data-id="' + c.id + '"' + dis(OP) + '>Pagar</button>' : '') + (c.status !== 'pagada' ? '<button class="btn xs" data-cm="rec" data-id="' + c.id + '" title="Recalcular"' + dis(OP) + '>' + UI.icon('refresh') + '</button>' : '') + '</span>' }
      ],
      footer: rows => '<tr><td colspan="6">Total consolidado</td><td class="num nowrap">' + S(sum(rows, P)) + '</td><td colspan="2"></td></tr>',
      onRow: c => commDrawer(c.id),
      afterDraw: (ct) => ct.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { const c = DB.commissions.find(x => x.id === b.dataset.id); ({ apr: approveComm, pay: payComm, rec: recalcComm })[b.dataset.cm](c, () => refresh(() => commDrawer(c.id))); })
    });
    if (params[0]) commDrawer(params[0]);
  });

  /* ================= Rentabilidad y liquidación (PROC-048) ================= */
  function resFin(r) {
    const fx = fxOf(r); const P = (a) => pen(a, r.currency, fx);
    const income = P(r.total);
    const svcCost = P(Q.resCost(r));
    const extras = DB.payables.filter(p => p.resId === r.id && isCost(p));
    const extra = sum(extras.filter(p => p.approved), p => penOf(p));
    const extraPending = sum(extras.filter(p => !p.approved), p => penOf(p));
    const comms = DB.commissions.filter(c => c.resId === r.id);
    const comm = sum(comms, c => pen(c.amount, c.currency, c.fx || fx));
    const cost = svcCost + extra; const gross = income - cost; const net = gross - comm;
    const cxc = DB.receivables.filter(x => x.resId === r.id && x.status !== 'cancelada');
    const cxp = DB.payables.filter(x => x.resId === r.id);
    return { income, svcCost, extra, extraPending, comm, cost, gross, net, pct: income ? gross / income * 100 : 0, netPct: income ? net / income * 100 : 0,
      collected: sum(cxc, x => penOf(x, x.paid || 0)), toCollect: sum(cxc, x => penOf(x, bal(x))), paidProv: sum(cxp, x => penOf(x, x.paid || 0)), toPay: sum(cxp, x => penOf(x, bal(x))), commPaid: sum(comms.filter(c => c.status === 'pagada'), c => pen(c.amount, c.currency, c.fx || fx)), cxc, cxp, comms, extras };
  }
  const PROFIT_RES = () => DB.reservations.filter(r => !['borrador', 'cancelada'].includes(r.status));
  function liqChecks(r, f) {
    return [
      [f.cxc.length > 0 && f.cxc.every(x => cxcStatus(x) === 'pagada'), 'Obligaciones de cobro pagadas', f.cxc.filter(x => cxcStatus(x) !== 'pagada').map(x => x.id).join(', ')],
      [f.cxp.every(x => bal(x) <= 0), 'Cuentas por pagar a proveedores pagadas', f.cxp.filter(x => bal(x) > 0).map(x => x.id).join(', ')],
      [f.extras.every(x => x.approved), 'Costos adicionales validados y aprobados', f.extras.filter(x => !x.approved).map(x => x.id).join(', ')],
      [f.comms.every(c => ['aprobada', 'pagada'].includes(c.status)), 'Comisiones aprobadas o pagadas', f.comms.filter(c => c.status === 'calculada').map(c => c.id).join(', ')],
      [r.status === 'completada', 'Servicios ejecutados (reserva completada)', 'Estado actual: ' + UI.statusLabel(r.status)]
    ];
  }
  function liquidacion(resId) {
    const r = Q.reservation(resId); if (!r) { UI.toast('Reserva no encontrada.', 'bad'); return; }
    const f = resFin(r); const fx = fxOf(r); const checks = liqChecks(r, f); const ok = checks.every(c => c[0]);
    const again = () => refresh(() => liquidacion(resId));
    const svcRows = r.services.map(s => '<tr><td><div class="small">' + esc(s.name) + '</div><div class="xs faint">' + date(s.date) + '</div></td><td class="small">' + prvLink(s.providerId) + '</td><td>' + UI.badge(s.status) + '</td><td class="num nowrap">' + (s.status === 'cancelado' ? '<s class="faint">' + money(s.cost, r.currency) + '</s>' : money(s.cost, r.currency)) + '</td></tr>');
    const extraRows = f.extras.map(p => '<tr><td><div class="small">' + esc(p.concept) + '</div><div class="xs faint">' + cxpLink(p.id) + ' · ' + esc(p.costType || '') + '</div></td><td class="small">' + prvLink(p.providerId) + '</td><td>' + (p.approved ? UI.badge('aprobada') : UI.badge('pendiente', 'Por aprobar')) + '</td><td class="num nowrap">' + money(p.amount, p.currency) + '</td></tr>');
    UI.modal({
      title: 'Liquidación / cierre · ' + esc(r.id), size: 'xl', sub: esc(r.title) + ' · Estado de cuenta de la reserva (PROC-048)',
      body: (r.settlement ? UI.alert('ok', '<b>Reserva liquidada</b> el ' + datetime(r.settlement.closedAt) + ' por ' + esc(Q.userName(r.settlement.by)) + '. Utilidad registrada: ' + S(r.settlement.net) + '.') : ok ? UI.alert('ok', 'Todas las condiciones de cierre se cumplen. La reserva puede liquidarse.') : UI.alert('warn', 'La reserva aún no puede liquidarse: revise los pendientes del checklist.')) +
        '<div class="grid g4" style="margin:12px 0">' +
          UI.kpi({ label: 'Ingresos', value: S(f.income, 0), sub: r.currency === 'USD' ? money(r.total, 'USD') + ' · TC ' + fmtN(fx, 3) : 'Total reserva', tone: 'accent' }) +
          UI.kpi({ label: 'Costos', value: S(f.cost, 0), sub: 'Servicios + adicionales', tone: 'sun' }) +
          UI.kpi({ label: 'Margen bruto', value: sem(f.pct), sub: S(f.gross, 0), tone: f.pct < 15 ? 'bad' : f.pct <= 25 ? 'sun' : 'ok' }) +
          UI.kpi({ label: 'Utilidad neta', value: S(f.net, 0), sub: 'Después de comisiones · ' + fmtN(f.netPct, 1) + '%', tone: 'violet' }) +
        '</div>' +
        '<div class="grid g2">' +
          '<div class="stack">' +
            UI.card('Cobros', miniTable([['Obligación'], ['Vence'], ['Importe', 'num'], ['Cobrado', 'num'], ['Estado']], f.cxc.map(x => '<tr><td>' + cxcLink(x.id) + '<div class="xs faint">' + esc(x.concept) + '</div></td><td class="nowrap">' + dateShort(x.due) + '</td><td class="num nowrap">' + money(x.amount, x.currency) + '</td><td class="num nowrap">' + money(x.paid || 0, x.currency) + '</td><td>' + UI.badge(cxcStatus(x)) + '</td></tr>'), 'Sin obligaciones de cobro'), { tight: true, sub: 'Cobrado ' + S(f.collected) + ' · por cobrar ' + S(f.toCollect) }) +
            UI.card('Comisiones', miniTable([['Comisión'], ['Beneficiario'], ['Monto', 'num'], ['Estado']], f.comms.map(c => '<tr><td class="mono">' + esc(c.id) + '</td><td class="small">' + esc(benText(c)) + '</td><td class="num nowrap">' + money(c.amount, c.currency) + '</td><td>' + UI.badge(c.status) + '</td></tr>'), 'Sin comisiones'), { tight: true }) +
            UI.card('Checklist de cierre', checks.map(c => check(c[0], '<b>' + esc(c[1]) + '</b>' + (!c[0] && c[2] ? '<div class="xs faint">Pendiente: ' + esc(c[2]) + '</div>' : ''))).join('')) +
          '</div><div class="stack">' +
            UI.card('Costos', miniTable([['Servicio / costo'], ['Proveedor'], ['Estado'], ['Costo', 'num']], svcRows.concat(extraRows), 'Sin costos'), { tight: true, sub: 'Pagado a proveedores ' + S(f.paidProv) + ' · por pagar ' + S(f.toPay) }) +
            UI.card('Estado de resultados', '<div class="stat-line"><span>Ingresos (total reserva)</span><b class="num">' + S(f.income) + '</b></div><div class="stat-line"><span class="muted">(−) Costo de servicios</span><span class="num">' + S(f.svcCost) + '</span></div><div class="stat-line"><span class="muted">(−) Costos adicionales aprobados</span><span class="num">' + S(f.extra) + '</span></div>' + (f.extraPending ? '<div class="stat-line"><span class="faint">Costos por aprobar (sin impacto)</span><span class="num faint">' + S(f.extraPending) + '</span></div>' : '') + '<div class="stat-line total"><span>Margen bruto · ' + sem(f.pct) + '</span><span class="num">' + S(f.gross) + '</span></div><div class="stat-line"><span class="muted">(−) Comisiones</span><span class="num">' + S(f.comm) + '</span></div><div class="stat-line total"><span>Utilidad neta · ' + fmtN(f.netPct, 1) + '%</span><span class="num">' + S(f.net) + '</span></div>' +
              '<div class="section-title" style="margin:14px 0 6px">Flujo de caja</div><div class="stat-line"><span class="muted">Cobrado a clientes</span><span class="num ok">' + S(f.collected) + '</span></div><div class="stat-line"><span class="muted">Pagado a proveedores</span><span class="num">' + S(f.paidProv) + '</span></div><div class="stat-line"><span class="muted">Comisiones pagadas</span><span class="num">' + S(f.commPaid) + '</span></div><div class="stat-line total"><span>Caja neta</span><span class="num">' + S(f.collected - f.paidProv - f.commPaid) + '</span></div>' +
              (r.currency === 'USD' ? '<div class="xs faint" style="margin-top:8px">Reserva en USD consolidada al TC ' + fmtN(fx, 3) + ' conservado (Regla transversal 15).</div>' : '')) +
          '</div>' +
        '</div>',
      actions: [
        { label: 'Ver reserva', onClick: () => App.go('#/reservas/' + r.id) }].concat(!canOp() ? [{ label: 'Cerrar' }] : [
        { label: 'Enviar estado de cuenta', icon: 'send', onClick: () => { const c = Q.client(r.clientId) || {}; Notify.push('estado_cuenta.enviado', 'Email', c.email || c.name, 'Estado de cuenta ' + r.id + ' — saldo ' + S(f.toCollect)); Audit.log('Reserva', r.id, 'enviar_estado_cuenta', '', c.email || ''); UI.toast('Estado de cuenta enviado a ' + esc(c.name || '') + '.'); return false; } },
        r.settlement ? { label: 'Cerrar' } : { label: 'Cerrar liquidación', cls: 'primary', icon: 'lock', onClick: () => {
          if (!need('finance.profitability', 'liquidar reservas') || !need(OP, 'liquidar reservas')) return false;
          const pend = checks.filter(c => !c[0]);
          if (pend.length) { UI.toast('No se puede liquidar ' + esc(r.id) + ': ' + pend.map(c => esc(c[1]) + (c[2] ? ' (' + esc(c[2]) + ')' : '')).join('; ') + '.', 'bad'); return false; }
          r.settlement = { closedAt: nowStr(), by: Auth.user.id, income: r2(f.income), cost: r2(f.cost), comm: r2(f.comm), net: r2(f.net), pct: r2(f.pct) };
          Audit.log('Reserva', r.id, 'liquidar', UI.statusLabel(r.status), 'liquidada · utilidad ' + S(f.net));
          Notify.push('reserva.liquidada', 'Portal', r.owner, 'Reserva ' + r.id + ' liquidada — utilidad ' + S(f.net));
          Store.save(); UI.toast('Reserva ' + r.id + ' liquidada y cerrada financieramente.'); setTimeout(again, 0);
        } }
      ])
    });
  }
  App.register('finanzas/rentabilidad', (el, params) => {
    css(); cxpNorm();
    if (!guard(el, 'finance.profitability', 'Rentabilidad')) return;
    const list = PROFIT_RES(); const fins = list.map(r => ({ r, f: resFin(r) }));
    const T = { income: sum(fins, x => x.f.income), cost: sum(fins, x => x.f.cost), comm: sum(fins, x => x.f.comm), gross: sum(fins, x => x.f.gross), net: sum(fins, x => x.f.net) };
    const tPct = T.income ? T.gross / T.income * 100 : 0;
    const m = DB.monthly; const mPct = m.sales.map((s, i) => r2((s - m.cost[i]) / s * 100));
    // por producto (a partir de los servicios de cada reserva)
    const prod = {}; list.forEach(r => r.services.filter(s => s.status !== 'cancelado' && s.productId).forEach(s => { const k = s.productId; prod[k] = prod[k] || { inc: 0, cost: 0 }; prod[k].inc += pen(s.price, r.currency, fxOf(r)); prod[k].cost += pen(s.cost, r.currency, fxOf(r)); }));
    const prodItems = Object.keys(prod).map(k => ({ k, ...prod[k], pct: prod[k].inc ? (prod[k].inc - prod[k].cost) / prod[k].inc * 100 : 0 })).sort((a, b) => (b.inc - b.cost) - (a.inc - a.cost));
    const grp = (keyFn) => { const g = {}; fins.forEach(x => { const k = keyFn(x.r); g[k] = g[k] || { inc: 0, gross: 0, net: 0, n: 0 }; g[k].inc += x.f.income; g[k].gross += x.f.gross; g[k].net += x.f.net; g[k].n++; }); return Object.keys(g).map(k => ({ k, ...g[k], pct: g[k].inc ? g[k].gross / g[k].inc * 100 : 0 })).sort((a, b) => b.gross - a.gross); };
    const bySeller = grp(r => r.owner), byChannel = grp(r => r.channel);
    const tone = (p) => p < 15 ? 'var(--bad)' : p <= 25 ? 'var(--warn)' : 'var(--ok)';
    const chain = [['Cotización', '#/cotizaciones'], ['Reserva', '#/reservas'], ['Anticipo', '#/finanzas/cobros'], ['Cobros', '#/finanzas/pagos'], ['Facturación', '#/finanzas/facturacion'], ['Costos', '#/finanzas/proveedores'], ['Pagos a proveedores', '#/finanzas/proveedores'], ['Comisiones', '#/finanzas/comisiones'], ['Rentabilidad', '#/finanzas/rentabilidad'], ['Liquidación / cierre', '#/finanzas/rentabilidad']];
    const liqCount = list.filter(r => r.settlement).length;
    el.innerHTML = '<div class="page">' +
      header('Rentabilidad', 'Ingresos → Costos → Comisiones → Reglas → Margen → Dashboard (PROC-048). Reservas activas y ejecutadas, consolidadas en soles al TC conservado de cada reserva.', 'Rentabilidad') +
      roleNote('ren') +
      UI.card('Flujo financiero oficial', '<div class="flow" style="padding:4px 0">' + chain.map((c, i) => '<div class="flow-step ' + (i < 8 ? 'done' : i === 8 ? 'cur' : '') + '"><a class="flow-node"' + (Access.canRoute(c[1].slice(2)) ? ' href="' + c[1] + '"' : ' title="Pantalla no disponible para su rol"') + ' style="text-decoration:none"><div class="flow-dot">' + (i < 8 ? UI.icon('check') : i + 1) + '</div><div class="flow-lbl">' + esc(c[0]) + '</div></a>' + (i < chain.length - 1 ? '<div class="flow-line"></div>' : '') + '</div>').join('') + '</div>', { sub: 'DOC-PROC-001 §15 · ' + liqCount + ' de ' + list.length + ' reservas liquidadas' }) +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Ingresos', value: kS(T.income), sub: list.length + ' reservas', tone: 'accent', icon: 'trending' }) +
        UI.kpi({ label: 'Costos', value: kS(T.cost), sub: 'Servicios + costos aprobados', tone: 'sun', icon: 'coins' }) +
        UI.kpi({ label: 'Comisiones', value: kS(T.comm), sub: 'Vendedores y agencias', tone: 'violet', icon: 'percent' }) +
        UI.kpi({ label: 'Margen bruto', value: fmtN(tPct, 1) + '%', sub: S(T.gross, 0), tone: tPct < 15 ? 'bad' : tPct <= 25 ? 'sun' : 'ok', icon: 'pie' }) +
        UI.kpi({ label: 'Utilidad neta', value: kS(T.net), sub: fmtN(T.income ? T.net / T.income * 100 : 0, 1) + '% sobre ingresos', tone: 'info', icon: 'wallet' }) +
      '</div>' +
      '<div class="grid g2">' +
        UI.card('Ventas vs. costo por mes', UI.chart.bars({ labels: m.labels, series: [{ name: 'Ventas netas', values: m.sales }, { name: 'Costo proveedores', values: m.cost, color: 'var(--sun)' }], fmt: v => S(v, 0) }), { sub: 'Abr–Set 2026 · S/' }) +
        UI.card('Margen bruto mensual', UI.chart.line({ labels: m.labels, series: [{ name: 'Margen %', values: mPct }], fmt: v => fmtN(v, 1) + '%' }) + '<div class="row between small" style="margin-top:8px"><span class="muted">Margen setiembre</span><b>' + fmtN(mPct[mPct.length - 1], 1) + '%</b></div>', { sub: '(Ventas − costo) / ventas' }) +
      '</div>' +
      '<div class="grid g3">' +
        UI.card('Por producto', prodItems.length ? UI.chart.hbars({ items: prodItems.map(p => ({ label: Q.productName(p.k), value: Math.max(0, p.inc - p.cost), display: S(p.inc - p.cost, 0) + ' · ' + fmtN(p.pct, 1) + '%', color: tone(p.pct) })) }) : UI.empty('Sin datos'), { sub: 'Margen bruto por producto · S/' }) +
        UI.card('Por vendedor', UI.chart.hbars({ items: bySeller.map(x => ({ label: Q.userName(x.k), value: Math.max(0, x.gross), display: S(x.gross, 0) + ' · ' + fmtN(x.pct, 1) + '%', color: tone(x.pct) })) }), { sub: 'Margen bruto por responsable de la venta' }) +
        UI.card('Por canal', UI.chart.hbars({ items: byChannel.map(x => ({ label: x.k + ' (' + x.n + ')', value: Math.max(0, x.gross), display: S(x.gross, 0) + ' · ' + fmtN(x.pct, 1) + '%', color: tone(x.pct) })) }), { sub: 'Semáforo: <15% rojo · 15–25% ámbar · >25% verde' }) +
      '</div><div id="rt-tbl" style="min-width:0"></div></div>';
    UI.dataTable(el.querySelector('#rt-tbl'), {
      exportName: 'rentabilidad_reservas', rows: () => fins, pageSize: 10,
      search: x => [x.r.id, x.r.title, Q.clientName(x.r.clientId), x.r.channel].join(' '),
      filters: [{ label: 'Semáforo', options: [['r', 'Rojo (<15%)'], ['a', 'Ámbar (15–25%)'], ['g', 'Verde (>25%)']], match: (x, v) => (x.f.pct < 15 ? 'r' : x.f.pct <= 25 ? 'a' : 'g') === v }, { label: 'Canal', options: Array.from(new Set(list.map(r => r.channel))).map(c => [c, c]), match: (x, v) => x.r.channel === v }],
      defaultSort: 'pct',
      columns: [
        { key: 'id', label: 'Reserva', sortVal: x => x.r.id, render: x => resLink(x.r.id) + '<div class="cell-sub">' + esc(x.r.title) + '</div>', csv: x => x.r.id },
        { key: 'client', label: 'Cliente / canal', sortVal: x => Q.clientName(x.r.clientId), render: x => '<div class="cell-main">' + cliLink(x.r.clientId) + '</div><div class="cell-sub">' + esc(x.r.channel) + ' · ' + esc(Q.userName(x.r.owner)) + '</div>', csv: x => Q.clientName(x.r.clientId) },
        { key: 'st', label: 'Estado', sortVal: x => x.r.status, render: x => UI.badge(x.r.status) + (x.r.settlement ? '<div style="margin-top:3px">' + UI.badge('cerrada', 'Liquidada') + '</div>' : ''), csv: x => UI.statusLabel(x.r.status) },
        { key: 'income', label: 'Ingresos', align: 'num', sortVal: x => x.f.income, render: x => '<span class="nowrap">' + S(x.f.income, 0) + '</span>' + (x.r.currency === 'USD' ? '<div class="cell-sub nowrap">' + money(x.r.total, 'USD', 0) + ' · TC ' + fmtN(fxOf(x.r), 2) + '</div>' : ''), csv: x => r2(x.f.income) },
        { key: 'cost', label: 'Costos', align: 'num', sortVal: x => x.f.cost, render: x => '<span class="nowrap">' + S(x.f.cost, 0) + '</span>' + (x.f.extra ? '<div class="cell-sub">incl. adic. ' + S(x.f.extra, 0) + '</div>' : ''), csv: x => r2(x.f.cost) },
        { key: 'comm', label: 'Comisiones', align: 'num', sortVal: x => x.f.comm, render: x => '<span class="nowrap">' + S(x.f.comm, 0) + '</span>', csv: x => r2(x.f.comm) },
        { key: 'gross', label: 'Margen bruto', align: 'num', sortVal: x => x.f.gross, render: x => '<b class="nowrap">' + S(x.f.gross, 0) + '</b>', csv: x => r2(x.f.gross) },
        { key: 'pct', label: 'Margen %', align: 'num', sortVal: x => x.f.pct, render: x => sem(x.f.pct), csv: x => r2(x.f.pct) },
        { key: 'net', label: 'Utilidad neta', align: 'num', sortVal: x => x.f.net, render: x => '<span class="nowrap">' + S(x.f.net, 0) + '</span>', csv: x => r2(x.f.net) },
        { key: '', label: '', sort: false, csv: () => '', render: x => '<button class="btn xs" data-liq="' + x.r.id + '">Liquidación</button>' }
      ],
      footer: rows => { const inc = sum(rows, x => x.f.income), g = sum(rows, x => x.f.gross); return '<tr><td colspan="3">Total (' + rows.length + ')</td><td class="num nowrap">' + S(inc, 0) + '</td><td class="num nowrap">' + S(sum(rows, x => x.f.cost), 0) + '</td><td class="num nowrap">' + S(sum(rows, x => x.f.comm), 0) + '</td><td class="num nowrap">' + S(g, 0) + '</td><td class="num">' + sem(inc ? g / inc * 100 : 0) + '</td><td class="num nowrap">' + S(sum(rows, x => x.f.net), 0) + '</td><td></td></tr>'; },
      onRow: x => liquidacion(x.r.id),
      afterDraw: (c) => c.querySelectorAll('[data-liq]').forEach(b => b.onclick = () => liquidacion(b.dataset.liq))
    });
    if (params[0]) liquidacion(params[0]);
  });

  /* ================= Facturación (PROC-050) ================= */
  const OSE_NOTICE = 'Integración con OSE/SUNAT pendiente de validar proveedor, contrato y API (DOC-PROC-001 §16); en el prototipo la respuesta es simulada.';
  const invOp = (i) => i.op || (/export/i.test(i.detail || '') ? 'exportacion' : 'gravada');
  const invSign = (i) => i.type === 'Nota de crédito' ? -1 : 1;
  function parseDoc(c) {
    const s = String((c && c.doc) || '').trim(); const m = s.match(/^(RUC|DNI|Pasaporte|Passport|CE)\s+(.+)$/i);
    if (!m) return { type: 'DNI', num: '' };
    const t = m[1].toUpperCase(); return { type: t === 'RUC' ? 'RUC' : t === 'DNI' ? 'DNI' : t === 'CE' ? 'CE' : 'Pasaporte', num: m[2].trim() };
  }
  function letras(n, cur) {
    const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
    const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    const two = (x) => x < 30 ? U[x] : D[Math.floor(x / 10)] + (x % 10 ? ' Y ' + U[x % 10] : '');
    const three = (x) => x === 100 ? 'CIEN' : (C[Math.floor(x / 100)] + (x % 100 ? ' ' + two(x % 100) : '')).trim();
    const words = (x) => {
      if (x === 0) return 'CERO';
      const mi = Math.floor(x / 1e6), th = Math.floor((x % 1e6) / 1000), rest = x % 1000; let out = '';
      if (mi) out += (mi === 1 ? 'UN MILLÓN' : words(mi).replace(/UNO$/, 'UN') + ' MILLONES') + ' ';
      if (th) out += (th === 1 ? 'MIL' : three(th).replace(/UNO$/, 'UN') + ' MIL') + ' ';
      if (rest) out += three(rest);
      return out.trim();
    };
    const tot = Math.round(Math.abs(n) * 100); const ent = Math.floor(tot / 100), cents = tot % 100;
    return 'SON: ' + words(ent) + ' CON ' + String(cents).padStart(2, '0') + '/100 ' + (cur === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES');
  }
  function fiscalChecks(v) {
    const out = [];
    if (v.type === 'Factura') out.push([v.docType === 'RUC' && /^(10|15|17|20)\d{9}$/.test(v.docNum), v.docType === 'RUC' && /^(10|15|17|20)\d{9}$/.test(v.docNum) ? 'RUC de 11 dígitos válido para factura' : 'Factura requiere RUC válido de 11 dígitos (Regla transversal 10)']);
    if (v.type === 'Boleta') { const okD = (v.docType === 'DNI' && /^\d{8}$/.test(v.docNum)) || (['Pasaporte', 'CE'].includes(v.docType) && /^[A-Z0-9]{6,12}$/i.test(v.docNum)); out.push([okD, okD ? v.docType + ' válido para boleta' : 'Boleta requiere DNI de 8 dígitos o pasaporte / CE válido (Regla transversal 10)']); if (v.docType === 'RUC') out.push([false, 'Cliente con RUC: corresponde emitir factura']); }
    if (v.type === 'Nota de crédito') { out.push([!!v.ref, v.ref ? 'Comprobante de referencia: ' + v.ref : 'La nota de crédito debe referenciar un comprobante aceptado']); out.push([!!v.docNum, v.docNum ? 'Documento del adquirente consignado' : 'Falta documento del adquirente']); }
    out.push([!!v.name, v.name ? 'Razón social / nombre consignado' : 'Falta razón social o nombre']);
    out.push([v.amount > 0 && v.amount <= v.max + 0.005, v.amount > 0 && v.amount <= v.max + 0.005 ? 'Importe ' + money(v.amount, v.cur) + ' dentro del máximo ' + money(v.max, v.cur) : 'Importe inválido: debe ser mayor que cero y no exceder ' + money(v.max, v.cur)]);
    out.push(['info', v.domiciled ? 'Operación gravada: IGV ' + DB.settings.taxPct + '% incluido en el importe' : 'Exportación de servicios a no domiciliado: operación sin IGV']);
    if (v.cur === 'USD') out.push(['info', 'Moneda USD · TC ' + fmtN(v.fx, 3) + ' conservado en el comprobante (Regla 15)']);
    return out;
  }
  function invTotals(i) {
    const op = invOp(i); const t = DB.settings.taxPct / 100; const tot = i.amount;
    if (op === 'gravada') { const base = r2(tot / (1 + t)); return { op, base, igv: r2(tot - base), tot }; }
    return { op, base: tot, igv: 0, tot };
  }
  function invDoc(i) {
    const c = Q.client(i.clientId) || {}; const t = DB.tenant; const sede = DB.sedes[0]; const tt = invTotals(i);
    const title = i.type === 'Factura' ? 'FACTURA ELECTRÓNICA' : i.type === 'Boleta' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'NOTA DE CRÉDITO ELECTRÓNICA';
    const d = i.docType ? { type: i.docType, num: i.docNum } : parseDoc(c);
    return '<div class="doc"><div class="doc-head"><div><h2 style="margin-bottom:4px">' + esc(t.name) + '</h2><div class="muted">RUC ' + esc(t.ruc) + '</div><div class="muted">' + esc(sede.address) + ' · Lima, Perú</div><div class="muted">Tel. ' + esc(sede.phone) + ' · Agencia de viajes y turismo</div></div>' +
      '<div style="border:2px solid #0A3A73;border-radius:6px;padding:10px 16px;text-align:center;min-width:220px"><div style="font-weight:700">RUC ' + esc(t.ruc) + '</div><div style="font-weight:700;color:#1560B8;margin:4px 0">' + title + '</div><div style="font-family:var(--f-mono);font-weight:700">' + esc(i.id) + '</div></div></div>' +
      '<table><tbody><tr><td style="width:30%" class="muted">Señor(es)</td><td><b>' + esc(i.clientName || c.name || '—') + '</b></td></tr><tr><td class="muted">' + esc(d.type) + '</td><td>' + esc(d.num || '—') + '</td></tr><tr><td class="muted">Domicilio / país</td><td>' + esc((c.city ? c.city + ', ' : '') + (c.country || '')) + '</td></tr><tr><td class="muted">Fecha de emisión</td><td>' + date(i.date) + '</td></tr><tr><td class="muted">Moneda</td><td>' + (i.currency === 'USD' ? 'Dólares americanos (USD) · TC ' + fmtN(fxOf(i), 3) : 'Soles (PEN)') + '</td></tr>' + (i.resId ? '<tr><td class="muted">Referencia</td><td>Reserva ' + esc(i.resId) + (i.receivableId ? ' · ' + esc(i.receivableId) : '') + '</td></tr>' : '') + (i.refInvoice ? '<tr><td class="muted">Documento que modifica</td><td>' + esc(i.refInvoice) + ' · Motivo: ' + esc(i.reason || 'Anulación de la operación') + '</td></tr>' : '') + '</tbody></table>' +
      '<table><thead><tr><th style="width:60px">Cant.</th><th>Descripción</th><th style="text-align:right">Valor unit.</th><th style="text-align:right">Importe</th></tr></thead><tbody><tr><td>1</td><td>' + esc(i.detail || 'Servicios turísticos') + (tt.op === 'exportacion' ? '<div class="muted" style="font-size:.74rem">Exportación de servicios — adquirente no domiciliado</div>' : '') + '</td><td style="text-align:right">' + fmtN(tt.base) + '</td><td style="text-align:right">' + fmtN(tt.base) + '</td></tr></tbody></table>' +
      '<table class="tot"><tbody><tr><td class="muted">' + (tt.op === 'gravada' ? 'Op. gravada' : 'Op. exportación / no gravada') + '</td><td style="text-align:right">' + money(tt.base, i.currency) + '</td></tr><tr><td class="muted">Op. exonerada</td><td style="text-align:right">' + money(0, i.currency) + '</td></tr><tr><td class="muted">IGV ' + DB.settings.taxPct + '%</td><td style="text-align:right">' + money(tt.igv, i.currency) + '</td></tr><tr><td><b>Importe total</b></td><td style="text-align:right"><b>' + money(tt.tot, i.currency) + '</b></td></tr></tbody></table>' +
      '<p style="margin-top:10px;font-weight:600">' + letras(tt.tot, i.currency) + '</p>' +
      '<p class="muted" style="margin-top:14px;font-size:.72rem">Representación impresa simulada del comprobante electrónico. Estado ante OSE: ' + esc(UI.statusLabel(i.status)) + '. ' + esc(OSE_NOTICE) + ' En producción el PDF se genera por job y el XML/CDR proviene del OSE.</p></div>';
  }
  function previewInv(i) {
    UI.modal({ title: 'Vista previa · ' + esc(i.id), size: 'lg', sub: 'Documento imprimible (en producción se genera el PDF por job asíncrono)', body: invDoc(i), actions: [{ label: 'Cerrar' }, { label: 'Descargar PDF', icon: 'download', cls: 'primary', onClick: () => { Audit.log('Comprobante', i.id, 'solicitar_pdf', '', 'job encolado'); UI.toast('Generación de PDF encolada como job (PROC-061). Esta vista es la representación del documento.', 'info'); return false; } }] });
  }
  function simulateOse(inv) {
    setTimeout(() => {
      if (inv.status !== 'emitido') return;
      inv.status = 'aceptado'; hist(inv, 'aceptado', 'Respuesta OSE simulada'); Audit.log('Comprobante', inv.id, 'respuesta_ose', 'emitido', 'aceptado (simulado)'); Store.save();
      document.querySelectorAll('[data-inv-st="' + inv.id + '"]').forEach(e => { e.innerHTML = UI.badge('aceptado'); });
      UI.toast('Respuesta simulada del OSE: ' + esc(inv.id) + ' aceptado.', 'info');
    }, 1400);
  }
  function emitModal(preCxc, preType, refInv, done) {
    if (!need('finance.invoicing', 'emitir comprobantes')) return;
    const srcs = DB.receivables.filter(r => r.status !== 'cancelada');
    const ref0 = refInv ? DB.invoices.find(x => x.id === refInv) : null;
    const pre = preCxc || (ref0 ? ((DB.receivables.find(r => r.resId === ref0.resId) || {}).id) : null) || (srcs[0] || {}).id;
    let first = true;
    UI.modal({
      title: 'Emitir comprobante electrónico', size: 'lg', sub: 'PROC-050 · Venta/Cobro → Validación fiscal → Preparación → Emisión → Respuesta → Registro → Entrega → Auditoría',
      body: UI.alert('info', OSE_NOTICE) + '<div style="height:12px"></div>' + UI.form([
        { id: 'iv-src', label: 'Origen: cobro / cuenta por cobrar', type: 'select', col: 12, options: srcs.map(r => [r.id, r.id + ' · ' + Q.clientName(r.clientId) + ' · ' + r.concept + ' · ' + money(r.amount, r.currency) + ' (pagado ' + money(r.paid || 0, r.currency) + ')']), value: pre },
        { id: 'iv-type', label: 'Tipo de comprobante', type: 'select', col: 4, options: ['Factura', 'Boleta', 'Nota de crédito'], value: preType || '' },
        { id: 'iv-doctype', label: 'Tipo de documento', type: 'select', col: 4, options: ['RUC', 'DNI', 'Pasaporte', 'CE'] },
        { id: 'iv-docnum', label: 'Número de documento', col: 4, required: true },
        { id: 'iv-name', label: 'Razón social / nombre', col: 8, required: true },
        { id: 'iv-dom', label: 'Adquirente domiciliado en Perú', type: 'switch', col: 4, value: true },
        { id: 'iv-ref', label: 'Comprobante que modifica (nota de crédito)', type: 'select', col: 6, options: [] },
        { id: 'iv-reason', label: 'Motivo (nota de crédito)', col: 6, value: 'Anulación de la operación' },
        { id: 'iv-amt', label: 'Importe total', type: 'number', col: 4, required: true, step: '0.01' },
        { id: 'iv-cur', label: 'Moneda', col: 4, disabled: true },
        { id: 'iv-fx', label: 'Tipo de cambio', type: 'number', col: 4, step: '0.001', value: FX() },
        { id: 'iv-desc', label: 'Descripción del servicio', col: 12, required: true },
        { type: 'html', col: 12, html: '<div class="section-title" style="margin:4px 0 6px">Validación fiscal</div><div id="iv-checks"></div>' }
      ]),
      onOpen: (m) => {
        const $ = (s) => m.querySelector(s);
        const invoicedFor = (r) => sum(DB.invoices.filter(x => x.status !== 'anulado' && (x.receivableId === r.id || (!x.receivableId && x.resId === r.resId && x.type !== 'Nota de crédito' && Math.abs(x.amount - r.amount) < 0.01))), x => invSign(x) * x.amount);
        const state = () => {
          const r = DB.receivables.find(x => x.id === $('#iv-src').value); const type = $('#iv-type').value;
          const ref = DB.invoices.find(x => x.id === $('#iv-ref').value);
          const max = type === 'Nota de crédito' ? (ref ? ref.amount : 0) : r ? r2(r.amount - Math.max(0, invoicedFor(r))) : 0;
          return { r, type, ref, max, docType: $('#iv-doctype').value, docNum: $('#iv-docnum').value.trim(), name: $('#iv-name').value.trim(), domiciled: $('#iv-dom').checked, amount: +$('#iv-amt').value || 0, cur: r ? r.currency : 'PEN', fx: +$('#iv-fx').value || FX() };
        };
        const paint = () => {
          const v = state(); $('#iv-ref').closest('.field').style.display = v.type === 'Nota de crédito' ? '' : 'none'; $('#iv-reason').closest('.field').style.display = v.type === 'Nota de crédito' ? '' : 'none';
          $('#iv-fx').closest('.field').style.display = v.cur === 'USD' ? '' : 'none';
          $('#iv-checks').innerHTML = fiscalChecks(v).map(c => check(c[0], esc(c[1]))).join('');
        };
        const load = () => {
          const r = DB.receivables.find(x => x.id === $('#iv-src').value); if (!r) return;
          const c = Q.client(r.clientId) || {}; const d = parseDoc(c);
          $('#iv-doctype').value = d.type; $('#iv-docnum').value = d.num; $('#iv-name').value = c.name || ''; $('#iv-dom').checked = (c.country || 'Perú') === 'Perú';
          if (!(first && preType)) $('#iv-type').value = d.type === 'RUC' ? 'Factura' : 'Boleta';
          if (first && ref0) $('#iv-type').value = 'Nota de crédito';
          const refs = DB.invoices.filter(x => x.clientId === r.clientId && x.type !== 'Nota de crédito' && x.status === 'aceptado');
          $('#iv-ref').innerHTML = '<option value="">—</option>' + refs.map(x => '<option value="' + x.id + '"' + (ref0 && ref0.id === x.id ? ' selected' : '') + '>' + esc(x.id + ' · ' + x.type + ' · ' + money(x.amount, x.currency)) + '</option>').join('');
          $('#iv-cur').value = r.currency; $('#iv-fx').value = fxOf(r);
          const pend = r2(r.amount - Math.max(0, invoicedFor(r)));
          $('#iv-amt').value = $('#iv-type').value === 'Nota de crédito' && ref0 ? ref0.amount : (r.paid > 0 ? Math.min(r.paid, pend) : pend);
          $('#iv-desc').value = $('#iv-type').value === 'Nota de crédito' ? 'Nota de crédito — ' + (ref0 ? ref0.detail : r.concept) : 'Servicios turísticos: ' + r.concept + ' (' + r.resId + ')';
          first = false; paint();
        };
        $('#iv-src').onchange = load;
        $('#iv-type').addEventListener('change', () => { const v = state(); if (v.type === 'Nota de crédito' && v.ref) $('#iv-amt').value = v.ref.amount; });
        $('#iv-ref').addEventListener('change', () => { const v = state(); if (v.ref) $('#iv-amt').value = v.ref.amount; });
        m.querySelectorAll('input,select').forEach(i => { i.addEventListener('input', paint); i.addEventListener('change', paint); });
        load();
        m._state = state;
      },
      actions: [{ label: 'Cancelar' }, {
        label: 'Validar y emitir', cls: 'primary', icon: 'send', onClick: (m) => {
          if (!UI.validate(m)) return false;
          const v = m._state(); const fails = fiscalChecks(v).filter(c => c[0] === false);
          if (fails.length) { UI.toast('Validación fiscal fallida: ' + fails.map(f => esc(f[1])).join('; ') + '.', 'bad'); return false; }
          const r = v.r; let id;
          if (v.type === 'Factura') id = Seq.next('Factura');
          else if (v.type === 'Boleta') id = Seq.next('Boleta');
          else { const pfx = v.ref.id.startsWith('F') ? 'FC01-' : 'BC01-'; id = nextId(DB.invoices, pfx, 8); }
          const inv = { id, type: v.type, clientId: r.clientId, clientName: v.name, docType: v.docType, docNum: v.docNum, resId: r.resId, receivableId: r.id, amount: r2(v.amount), currency: r.currency, fx: r.currency === 'USD' ? v.fx : null, date: TODAY(), status: 'emitido', detail: m.querySelector('#iv-desc').value.trim(), op: v.domiciled ? 'gravada' : 'exportacion', refInvoice: v.type === 'Nota de crédito' ? v.ref.id : null, reason: v.type === 'Nota de crédito' ? m.querySelector('#iv-reason').value.trim() : null, by: Auth.user.id };
          hist(inv, 'emitido', 'Enviado al OSE');
          DB.invoices.unshift(inv);
          Audit.log('Comprobante', inv.id, 'emitir', '', inv.type + ' · ' + money(inv.amount, inv.currency) + ' · ' + r.id);
          Store.save(); simulateOse(inv);
          UI.toast(esc(inv.type) + ' <b>' + inv.id + '</b> emitida. Esperando respuesta (simulada) del OSE…');
          done && done(inv);
        }
      }]
    });
  }
  function invFlow(i) {
    const steps = ['Venta/Cobro', 'Validación fiscal', 'Preparación', 'Emisión', 'Respuesta', 'Registro', 'Entrega', 'Auditoría'];
    if (i.status === 'observado') return UI.flow(steps, 4, 4);
    if (i.status === 'emitido') return UI.flow(steps, 4);
    if (i.status === 'anulado') return UI.flow(steps, 8, 7);
    return UI.flow(steps, i.delivered ? 8 : 6);
  }
  function deliverInv(i, done) {
    if (!need('finance.invoicing', 'entregar comprobantes')) return;
    if (i.status !== 'aceptado') { UI.toast('Solo se entregan comprobantes aceptados por el OSE.', 'bad'); return; }
    const c = Q.client(i.clientId) || {};
    Notify.push('comprobante.emitido', 'Email', c.email || c.name, 'Comprobante electrónico ' + i.id + ' — ' + money(i.amount, i.currency));
    Notify.push('comprobante.emitido', 'Portal', c.name || i.clientId, 'Nuevo comprobante disponible: ' + i.id);
    i.delivered = nowStr(); hist(i, 'aceptado', 'Entregado por email y portal');
    Audit.log('Comprobante', i.id, 'entregar', '', 'Email + Portal'); Store.save();
    UI.toast('Comprobante ' + i.id + ' entregado al cliente por email y portal.'); done && done();
  }
  function fixInv(i, done) {
    if (!need('finance.invoicing', 'corregir comprobantes')) return;
    UI.modal({
      title: 'Corregir y reenviar ' + esc(i.id), size: 'sm', sub: 'Observación del OSE: ' + esc(i.detail),
      body: UI.form([i.currency === 'USD' ? { id: 'fx-fx', label: 'Tipo de cambio de la fecha de emisión', type: 'number', step: '0.001', col: 12, value: fxOf(i), required: true } : null, { id: 'fx-desc', label: 'Descripción', col: 12, value: String(i.detail || '').replace(/ — revisar.*$/i, ''), required: true }].filter(Boolean)),
      actions: [{ label: 'Cancelar' }, { label: 'Reenviar al OSE', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const d = UI.formData(m); const before = i.status; if (d['fx-fx']) i.fx = +d['fx-fx']; i.detail = d['fx-desc']; i.status = 'emitido'; hist(i, 'emitido', 'Reenvío tras observación'); Audit.log('Comprobante', i.id, 'reenviar', before, 'emitido' + (i.fx ? ' · TC ' + i.fx : '')); Store.save(); simulateOse(i); UI.toast('Comprobante reenviado. Esperando respuesta simulada del OSE.', 'info'); done && done(); } }]
    });
  }
  function invDrawer(id) {
    const i = DB.invoices.find(x => x.id === id); if (!i) return;
    const again = () => refresh(() => invDrawer(id)); const tt = invTotals(i);
    const acts = [{ label: 'Vista previa', icon: 'eye', onClick: () => { previewInv(i); return false; } }];
    if (i.status === 'emitido') acts.push({ label: 'Consultar respuesta OSE', icon: 'refresh', onClick: () => { i.status = 'aceptado'; hist(i, 'aceptado', 'Consulta manual (simulada)'); Audit.log('Comprobante', i.id, 'respuesta_ose', 'emitido', 'aceptado (simulado)'); Store.save(); UI.toast('OSE (simulado): comprobante aceptado.'); again(); return false; } });
    if (i.status === 'observado') acts.push({ label: 'Corregir y reenviar', cls: 'primary', onClick: () => { fixInv(i, again); return false; } });
    if (i.status === 'aceptado' && i.type !== 'Nota de crédito') acts.push({ label: 'Nota de crédito', onClick: () => { emitModal(null, 'Nota de crédito', i.id, (n) => refresh(() => invDrawer(n.id))); return false; } });
    if (i.status === 'aceptado') acts.push({ label: i.delivered ? 'Reenviar al cliente' : 'Entregar al cliente', cls: 'primary', icon: 'send', onClick: () => { deliverInv(i, again); return false; } });
    UI.drawer({
      title: esc(i.type) + ' ' + esc(i.id), sub: esc(Q.clientName(i.clientId)) + ' · ' + date(i.date), wide: true,
      body: UI.alert('info', OSE_NOTICE) + (i.status === 'observado' ? '<div style="height:10px"></div>' + UI.alert('warn', '<b>Comprobante observado.</b> ' + esc(i.detail) + '. Corrija los datos y reenvíe.') : '') +
        '<div class="card" style="margin:12px 0"><div class="card-b">' + invFlow(i) + '</div></div>' +
        '<div class="grid g2"><div>' + UI.dl([['Tipo', esc(i.type)], ['Número', '<span class="mono">' + esc(i.id) + '</span>'], ['Cliente', cliLink(i.clientId)], ['Documento', esc((i.docType || parseDoc(Q.client(i.clientId)).type) + ' ' + (i.docNum || parseDoc(Q.client(i.clientId)).num))], ['Reserva', resLink(i.resId)], ['Cobro / CxC', cxcLink(i.receivableId)], i.refInvoice ? ['Modifica a', invLink(i.refInvoice) + ' · ' + esc(i.reason || '')] : null, ['Estado', UI.badge(i.status)], ['Entrega', i.delivered ? datetime(i.delivered) : '<span class="faint">Pendiente</span>']]) + '</div>' +
        '<div><div class="stat-line"><span class="muted">' + (tt.op === 'gravada' ? 'Op. gravada' : 'Op. exportación (sin IGV)') + '</span><span class="num">' + money(tt.base, i.currency) + '</span></div><div class="stat-line"><span class="muted">IGV ' + DB.settings.taxPct + '%</span><span class="num">' + money(tt.igv, i.currency) + '</span></div><div class="stat-line total"><span>Total</span><span class="num">' + money(tt.tot, i.currency) + '</span></div>' + fxLine(tt.tot, i.currency, fxOf(i)) + '<div class="xs faint" style="margin-top:8px">' + esc(letras(tt.tot, i.currency)) + '</div></div></div>' +
        '<div class="section-title" style="margin:18px 0 10px">Auditoría</div>' + auditTimeline([i.id]),
      actions: acts
    });
  }
  App.register('finanzas/facturacion', (el, params) => {
    css();
    if (!guard(el, 'finance.invoicing', 'Facturación')) return;
    const I = DB.invoices; const monthI = I.filter(i => String(i.date).startsWith(MONTH()));
    const collectedByRes = {}, invoicedByRes = {};
    DB.payments.filter(p => p.status === 'aplicado').forEach(p => { collectedByRes[p.resId] = (collectedByRes[p.resId] || 0) + pen(p.amount, p.currency, p.fx); });
    I.filter(i => i.type !== 'Nota de crédito' && i.status !== 'anulado').forEach(i => { invoicedByRes[i.resId] = (invoicedByRes[i.resId] || 0) + pen(i.amount, i.currency, i.fx); });
    const pending = Object.keys(collectedByRes).map(k => ({ resId: k, col: collectedByRes[k], inv: invoicedByRes[k] || 0 })).filter(x => x.col - x.inv > 0.5).map(x => ({ ...x, pend: x.col - x.inv }));
    el.innerHTML = '<div class="page">' +
      header('Facturación electrónica', 'Comprobantes de pago (factura, boleta y nota de crédito) emitidos desde cobros y cuentas por cobrar (PROC-050), con validación fiscal previa (Regla transversal 10).', 'Facturación', '<button class="btn primary" id="fc-new"' + dis('finance.invoicing') + '>' + UI.icon('plus') + 'Emitir comprobante</button>') +
      roleNote('inv') +
      UI.alert('warn', '<b>Aviso:</b> ' + OSE_NOTICE) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Emitidos en el mes', value: String(monthI.length), sub: S(sum(monthI, i => invSign(i) * pen(i.amount, i.currency, i.fx)), 0) + ' neto', tone: 'accent', icon: 'receipt' }) +
        UI.kpi({ label: 'Aceptados', value: String(I.filter(i => i.status === 'aceptado').length), sub: I.filter(i => i.status === 'emitido').length + ' esperando respuesta', tone: 'ok', icon: 'checkCircle' }) +
        UI.kpi({ label: 'Observados', value: String(I.filter(i => i.status === 'observado').length), sub: 'Requieren corrección', tone: 'bad', icon: 'alert' }) +
        UI.kpi({ label: 'Cobrado por facturar', value: S(sum(pending, 'pend'), 0), sub: pending.length + ' reserva(s)', tone: 'sun', icon: 'clock' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('PROC-050 · Flujo de facturación', proc(['Venta/Cobro', 'Validación fiscal', 'Preparación', 'Emisión', 'Respuesta', 'Registro', 'Entrega', 'Auditoría']) + '<div class="grid g3" style="margin-top:14px;gap:10px">' +
          '<div>' + check(true, '<b>Factura</b><div class="xs faint">RUC de 11 dígitos (10/20…)</div>') + '</div><div>' + check(true, '<b>Boleta</b><div class="xs faint">DNI 8 dígitos o pasaporte / CE</div>') + '</div><div>' + check('info', '<b>No domiciliados</b><div class="xs faint">Exportación de servicios sin IGV</div>') + '</div></div>') +
        UI.card('Cobros pendientes de facturar', pending.length ? '<div class="list">' + pending.map(x => { const res = Q.reservation(x.resId); const cx = DB.receivables.filter(r => r.resId === x.resId && (r.paid || 0) > 0).slice(-1)[0]; return '<div class="list-item"><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + resLink(x.resId) + ' · ' + esc(res ? Q.clientName(res.clientId) : '') + '</div><div class="xs faint">Cobrado ' + S(x.col, 0) + ' · facturado ' + S(x.inv, 0) + '</div></div><b class="small num">' + S(x.pend, 0) + '</b>' + (cx ? '<button class="btn xs primary" data-emit="' + cx.id + '"' + dis('finance.invoicing') + '>Emitir</button>' : '') + '</div>'; }).join('') + '</div>' : UI.empty('Todos los cobros aplicados están facturados', 'checkCircle'), { tight: true }) +
      '</div><div id="fc-tbl" style="min-width:0"></div></div>';
    const afterEmit = (inv) => refresh(() => invDrawer(inv.id));
    el.querySelector('#fc-new').onclick = () => emitModal(null, null, null, afterEmit);
    el.querySelectorAll('[data-emit]').forEach(b => b.onclick = () => emitModal(b.dataset.emit, null, null, afterEmit));
    UI.dataTable(el.querySelector('#fc-tbl'), {
      exportName: 'comprobantes', rows: () => DB.invoices,
      search: i => [i.id, i.type, i.detail, i.resId, Q.clientName(i.clientId)].join(' '),
      defaultSort: 'date', defaultDir: -1,
      filters: [{ label: 'Tipo', options: [['Factura', 'Factura'], ['Boleta', 'Boleta'], ['Nota de crédito', 'Nota de crédito']], key: 'type' }, { label: 'Estado', options: ['emitido', 'aceptado', 'observado'], key: 'status' }],
      columns: [
        { key: 'id', label: 'Número', render: i => '<span class="mono" style="font-weight:600">' + esc(i.id) + '</span>' },
        { key: 'type', label: 'Tipo', render: i => esc(i.type) + (i.refInvoice ? '<div class="cell-sub">Ref. ' + esc(i.refInvoice) + '</div>' : '') },
        { key: 'date', label: 'Emisión', render: i => '<span class="nowrap">' + date(i.date) + '</span>' },
        { key: 'client', label: 'Cliente / detalle', sortVal: i => Q.clientName(i.clientId), render: i => '<div class="cell-main">' + cliLink(i.clientId) + '</div><div class="cell-sub">' + esc(i.detail) + '</div>', csv: i => Q.clientName(i.clientId) },
        { key: 'resId', label: 'Reserva', render: i => resLink(i.resId) },
        { key: 'op', label: 'Operación', sortVal: invOp, render: i => '<span class="tag">' + (invOp(i) === 'gravada' ? 'Gravada IGV 18%' : 'Exportación') + '</span>', csv: invOp },
        { key: 'amount', label: 'Total', align: 'num', sortVal: i => invSign(i) * pen(i.amount, i.currency, i.fx), render: i => (invSign(i) < 0 ? '<span class="fz-neg">− </span>' : '') + amtCell(i.amount, i.currency, i.fx), csv: i => i.currency + ' ' + invSign(i) * i.amount },
        { key: 'status', label: 'Estado OSE', render: i => '<span data-inv-st="' + esc(i.id) + '">' + UI.badge(i.status) + '</span>', csv: i => UI.statusLabel(i.status) },
        { key: 'delivered', label: 'Entrega', render: i => i.delivered ? '<span class="small ok">Entregado</span>' : '<span class="small faint">Pendiente</span>', csv: i => i.delivered ? 'Entregado' : 'Pendiente' },
        { key: '', label: '', sort: false, csv: () => '', render: i => '<button class="btn xs" data-prev="' + esc(i.id) + '" title="Vista previa">' + UI.icon('eye') + '</button>' }
      ],
      onRow: i => invDrawer(i.id),
      afterDraw: (c) => c.querySelectorAll('[data-prev]').forEach(b => b.onclick = () => previewInv(DB.invoices.find(x => x.id === b.dataset.prev)))
    });
    if (params[0]) invDrawer(params[0]);
  });

  /* ================= Conciliación bancaria (PROC-049) ================= */
  const matchedIds = (except) => new Set(DB.bankLines.filter(b => b !== except && b.match && b.status !== 'excepción').map(b => b.match));
  function candidatesFor(line) {
    const used = matchedIds(line); const refNums = (String(line.desc).match(/\d{5,}/g) || []);
    if (line.amount > 0) {
      return DB.payments.filter(p => !used.has(p.id) && !['revertido', 'rechazado'].includes(p.status)).map(p => ({ id: p.id, kind: 'Pago', label: p.id + ' · ' + p.method + ' · ' + money(p.amount, p.currency), amt: pen(p.amount, p.currency, p.fx), refHit: refNums.some(n => String(p.ref).includes(n)) }));
    }
    return DB.payables.filter(p => !used.has(p.id) && (p.approved || bal(p) <= 0)).map(p => ({ id: p.id, kind: 'Cuenta por pagar', label: p.id + ' · ' + Q.providerName(p.providerId) + ' · ' + money(p.amount, p.currency), amt: penOf(p, bal(p) > 0 ? bal(p) : p.amount), refHit: refNums.some(n => String((Q.provider(p.providerId) || {}).ruc).includes(n)) }));
  }
  function bestMatch(line) {
    const target = Math.abs(line.amount);
    const c = candidatesFor(line).filter(x => Math.abs(x.amt - target) < 0.5).sort((a, b) => (b.refHit ? 1 : 0) - (a.refHit ? 1 : 0));
    return c[0] || null;
  }
  function runMatching(done) {
    if (!need('finance.payments.register', 'ejecutar el matching')) return;
    const pend = DB.bankLines.filter(b => b.status === 'pendiente' && !b.closedIn);
    if (!pend.length) { UI.toast('No hay líneas pendientes de matching. Importe un extracto.', 'info'); return; }
    let s = 0, e = 0;
    pend.forEach(l => { const m = bestMatch(l); if (m) { l.match = m.id; l.status = 'sugerido'; s++; } else { l.match = null; l.status = 'excepción'; e++; } });
    Audit.log('Conciliación', 'EXTRACTO', 'matching', pend.length + ' líneas', s + ' sugeridas · ' + e + ' excepciones'); Store.save();
    UI.toast('Matching ejecutado: ' + s + ' sugerencia(s) y ' + e + ' excepción(es).', e ? 'warn' : 'ok'); done && done();
  }
  function confirmMatch(l, done) {
    if (!need('finance.payments.register', 'confirmar conciliaciones')) return;
    if (!l.match) { UI.toast('La línea no tiene match sugerido.', 'bad'); return; }
    if (l.match.startsWith('PAG-')) {
      const p = DB.payments.find(x => x.id === l.match);
      if (p && p.status === 'pendiente') { p.status = 'confirmado'; hist(p, 'confirmado', 'Confirmado por conciliación ' + l.id); Audit.log('Pago', p.id, 'validar', 'pendiente', 'confirmado (conciliación ' + l.id + ')'); }
    } else if (l.match.startsWith('CXP-')) {
      const p = DB.payables.find(x => x.id === l.match);
      if (p && bal(p) > 0) { cxpNorm(); const a = Math.abs(l.amount) / (p.currency === 'USD' ? fxOf(p) : 1); p.payouts = p.payouts || []; p.payouts.push({ id: 'PPR-B' + l.id.replace(/\D/g, ''), date: l.date, amount: r2(Math.min(a, bal(p))), method: 'Cargo bancario', account: l.bank, ref: l.desc, fx: p.currency === 'USD' ? fxOf(p) : null, by: Auth.user.id }); const before = p.paid || 0; p.paid = r2(before + Math.min(a, bal(p))); p.approved = true; p.status = cxpStatus(p); Audit.log('Cuenta por pagar', p.id, 'pagar', money(before, p.currency), money(p.paid, p.currency) + ' (conciliación ' + l.id + ')'); }
    }
    l.status = 'conciliado'; l.resolution = 'match'; l.resolvedBy = Auth.user.id;
    Audit.log('Conciliación', l.id, 'confirmar_match', 'sugerido', 'conciliado → ' + l.match); Store.save();
    UI.toast('Línea ' + l.id + ' conciliada con ' + l.match + '.'); done && done();
  }
  function rejectMatch(l, done) {
    if (!need('finance.payments.register', 'rechazar sugerencias')) return;
    const prev = l.match; l.match = null; l.status = 'excepción';
    Audit.log('Conciliación', l.id, 'rechazar_match', prev || '', 'excepción'); Store.save();
    UI.toast('Sugerencia descartada. La línea pasa a excepción.', 'warn'); done && done();
  }
  function resolveModal(l, done) {
    if (!need('finance.payments.register', 'resolver excepciones')) return;
    const cands = candidatesFor(l).sort((a, b) => Math.abs(a.amt - Math.abs(l.amount)) - Math.abs(b.amt - Math.abs(l.amount)));
    const other = l.amount > 0 ? 'Otro ingreso (no asociado a reserva)' : 'Gasto / comisión bancaria';
    UI.modal({
      title: 'Resolver excepción ' + esc(l.id), sub: 'PROC-049 · Excepción → Resolver',
      body: UI.dl([['Fecha', date(l.date)], ['Banco', esc(l.bank)], ['Descripción', '<span class="mono">' + esc(l.desc) + '</span>'], ['Importe', '<b class="' + (l.amount < 0 ? 'fz-neg' : 'fz-pos') + '">' + S(l.amount) + '</b>']]) +
        '<div class="col" style="margin-top:14px;gap:8px">' +
          '<label class="fz-radio"><input type="radio" name="rs-mode" value="assign" checked><div class="grow"><b>Asignar a ' + (l.amount > 0 ? 'un pago registrado' : 'una cuenta por pagar') + '</b><select class="input sm" id="rs-target" style="margin-top:6px">' + cands.map(c => '<option value="' + c.id + '">' + esc(c.label) + ' · ' + S(c.amt) + (Math.abs(c.amt - Math.abs(l.amount)) >= 0.5 ? ' (dif. ' + S(Math.abs(l.amount) - c.amt) + ')' : '') + '</option>').join('') + '</select></div></label>' +
          '<label class="fz-radio"><input type="radio" name="rs-mode" value="other"><div><b>Registrar como ' + esc(other.toLowerCase()) + '</b><div class="xs faint">No afecta obligaciones de clientes ni proveedores</div></div></label>' +
        '</div><div class="field" style="margin-top:12px"><label for="rs-note">Sustento <span class="req">*</span></label><textarea class="input" id="rs-note" rows="2" placeholder="p. ej. Abono identificado con voucher del cliente"></textarea></div>',
      actions: [{ label: 'Cancelar' }, {
        label: 'Resolver', cls: 'primary', onClick: (m) => {
          const mode = m.querySelector('input[name="rs-mode"]:checked').value; const note = m.querySelector('#rs-note').value.trim();
          if (!note) { m.querySelector('#rs-note').classList.add('err'); UI.toast('Indique el sustento de la resolución.', 'bad'); return false; }
          if (mode === 'assign') { const t = m.querySelector('#rs-target').value; if (!t) { UI.toast('No hay registros disponibles para asignar.', 'bad'); return false; } l.match = t; l.resolution = 'asignado'; }
          else { l.match = null; l.resolution = l.amount > 0 ? 'otro_ingreso' : 'gasto_bancario'; }
          l.status = 'conciliado'; l.note = note; l.resolvedBy = Auth.user.id;
          Audit.log('Conciliación', l.id, 'resolver_excepcion', 'excepción', (l.match ? 'asignado → ' + l.match : other) + ' · ' + note); Store.save();
          UI.toast('Excepción ' + l.id + ' resuelta.'); done && done();
        }
      }]
    });
  }
  function importLines(file, bank, done) {
    if (!need('finance.payments.register', 'importar extractos')) return;
    const mk = (desc, amount) => ({ id: nextId(DB.bankLines, 'BNK-', 1), date: TODAY(), bank, desc, amount, currency: 'PEN', match: null, status: 'pendiente', importedFrom: file, importedAt: nowStr() });
    const pay = DB.payments.find(p => p.status === 'aplicado' && p.currency === 'PEN' && !matchedIds(null).has(p.id));
    cxpNorm(); const cxp = DB.payables.find(p => bal(p) > 0 && p.approved && p.currency === 'PEN' && !matchedIds(null).has(p.id));
    const lines = [];
    lines.push(mk(pay ? 'ABONO TRANSF ' + bank + ' REF ' + (String(pay.ref).match(/\d{5,}/) || ['00' + Math.floor(Math.random() * 1e6)])[0] : 'ABONO TRANSF ' + bank + ' REF 7741209', pay ? pay.amount : 1250)); DB.bankLines.unshift(lines[0]);
    lines.push(mk(cxp ? 'CARGO PAGO PROV ' + ((Q.provider(cxp.providerId) || {}).ruc || '') : 'CARGO PAGO PROV 20527788990', cxp ? -bal(cxp) : -980)); DB.bankLines.unshift(lines[1]);
    lines.push(mk('COMISION MANTENIMIENTO CTA CTE', -18.5)); DB.bankLines.unshift(lines[2]);
    Audit.log('Conciliación', 'EXTRACTO', 'importar', file, '3 líneas normalizadas · ' + bank); Store.save();
    UI.toast('Extracto “' + esc(file) + '” importado y normalizado: 3 líneas pendientes de matching.'); done && done();
  }
  function closeRecon(done) {
    if (!need('finance.payments.register', 'cerrar la conciliación')) return;
    const open = DB.bankLines.filter(b => !b.closedIn);
    if (!open.length) { UI.toast('No hay líneas abiertas para cerrar.', 'info'); return; }
    const bad = open.filter(b => b.status !== 'conciliado');
    if (bad.length) { UI.toast('No se puede cerrar: ' + bad.length + ' línea(s) sin conciliar (' + bad.map(b => b.id + ' ' + UI.statusLabel(b.status)).join(', ') + '). PROC-049: Excepción → Resolver → Cerrar.', 'bad'); return; }
    const ab = sum(open.filter(b => b.amount > 0), 'amount'), ca = sum(open.filter(b => b.amount < 0), 'amount');
    UI.confirm({
      title: 'Cerrar conciliación', confirmLabel: 'Cerrar conciliación',
      message: 'Se cerrarán <b>' + open.length + '</b> líneas conciliadas del periodo. Abonos ' + S(ab) + ' · cargos ' + S(ca) + ' · neto <b>' + S(ab + ca) + '</b>. Las líneas cerradas quedan bloqueadas para edición.',
      onConfirm: () => {
        DB.reconClosures = DB.reconClosures || [];
        const id = 'CON-2026-' + String(DB.reconClosures.length + 1).padStart(3, '0');
        const c = { id, date: nowStr(), period: 'Setiembre 2026', lines: open.length, abonos: r2(ab), cargos: r2(ca), neto: r2(ab + ca), matched: open.filter(b => b.match).length, others: open.filter(b => !b.match).length, by: Auth.user.id };
        open.forEach(b => b.closedIn = id); DB.reconClosures.unshift(c);
        Audit.log('Conciliación', id, 'cerrar', open.length + ' líneas', 'neto ' + S(ab + ca)); Store.save();
        done && done();
        UI.modal({ title: 'Conciliación ' + id + ' cerrada', size: 'sm', body: UI.alert('ok', 'Cierre registrado y auditado.') + '<div style="margin-top:12px">' + UI.dl([['Periodo', c.period], ['Líneas', c.lines], ['Con match', c.matched], ['Otros ingresos / gastos', c.others], ['Abonos', S(c.abonos)], ['Cargos', S(c.cargos)], ['Neto', '<b>' + S(c.neto) + '</b>'], ['Cerrado por', esc(Q.userName(c.by))]]) + '</div>', actions: [{ label: 'Aceptar', cls: 'primary' }] });
      }
    });
  }
  App.register('finanzas/conciliacion', (el) => {
    css();
    if (!guard(el, 'finance.payments.register', 'Conciliación bancaria')) return;
    DB.reconClosures = DB.reconClosures || [];
    const open = DB.bankLines.filter(b => !b.closedIn);
    const cnt = (st) => open.filter(b => b.status === st).length;
    const net = sum(open, 'amount');
    const step = !open.length ? 0 : cnt('pendiente') ? 2 : cnt('sugerido') ? 2 : cnt('excepción') ? 4 : 5;
    const matchLabel = (b) => { if (!b.match) return b.resolution === 'otro_ingreso' ? '<span class="small">Otro ingreso</span>' : b.resolution === 'gasto_bancario' ? '<span class="small">Gasto bancario</span>' : '<span class="faint">—</span>'; if (b.match.startsWith('PAG-')) { const p = DB.payments.find(x => x.id === b.match); return payLink(b.match) + (p ? '<div class="cell-sub">' + esc(p.method) + ' · ' + money(p.amount, p.currency) + ' ' + UI.badge(p.status) + '</div>' : ''); } const p = DB.payables.find(x => x.id === b.match); return cxpLink(b.match) + (p ? '<div class="cell-sub">' + esc(Q.providerName(p.providerId)) + '</div>' : ''); };
    el.innerHTML = '<div class="page">' +
      header('Conciliación bancaria', 'Importar → Normalizar → Matching → Excepción → Resolver → Cerrar (PROC-049). Extractos de BCP, Interbank y BBVA contra pagos de clientes y pagos a proveedores.', 'Conciliación bancaria',
        '<button class="btn" id="cn-match">' + UI.icon('zap') + 'Ejecutar matching</button><button class="btn primary" id="cn-close">' + UI.icon('lock') + 'Cerrar conciliación</button>') +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Líneas abiertas', value: String(open.length), sub: 'Neto ' + S(net, 0), tone: 'accent', icon: 'list' }) +
        UI.kpi({ label: 'Conciliadas', value: String(cnt('conciliado')), sub: open.length ? fmtN(cnt('conciliado') / open.length * 100, 0) + '% del extracto' : '—', tone: 'ok', icon: 'checkCircle' }) +
        UI.kpi({ label: 'Sugeridas', value: String(cnt('sugerido')), sub: 'Por confirmar', tone: 'info', icon: 'link' }) +
        UI.kpi({ label: 'Excepciones', value: String(cnt('excepción')), sub: 'Por resolver', tone: 'bad', icon: 'alert' }) +
        UI.kpi({ label: 'Pendientes', value: String(cnt('pendiente')), sub: 'Sin matching', tone: 'sun', icon: 'clock' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        UI.card('Proceso de conciliación', UI.flow(['Importar', 'Normalizar', 'Matching', 'Excepción', 'Resolver', 'Cerrar'], step) + '<div class="xs faint" style="margin-top:10px">Reglas de matching: importe equivalente en soles (±0.50) y coincidencia de referencia / RUC en la descripción. Los pagos en USD se comparan al TC conservado del pago.</div>') +
        UI.card('Importar extracto', '<div class="form-grid"><div class="field c6"><label for="cn-bank">Banco</label><select class="input" id="cn-bank"><option>BCP</option><option>Interbank</option><option>BBVA</option></select></div><div class="field c6"><label>Archivo</label><label class="btn fz-file" style="justify-content:center">' + UI.icon('upload') + 'Elegir archivo<input type="file" id="cn-file" accept=".csv,.txt,.xlsx,.xls" aria-label="Archivo de extracto"></label></div></div><div class="xs faint" style="margin-top:8px">Formatos CSV / TXT / XLSX del banco. En el prototipo se agregan 3 líneas simuladas ya normalizadas (fecha, descripción en mayúsculas, importe con signo).</div>') +
      '</div><div id="cn-tbl" style="min-width:0"></div>' +
      UI.card('Cierres de conciliación', DB.reconClosures.length ? miniTable([['Cierre'], ['Fecha'], ['Periodo'], ['Líneas', 'num'], ['Abonos', 'num'], ['Cargos', 'num'], ['Neto', 'num'], ['Responsable']], DB.reconClosures.map(c => '<tr><td class="mono">' + esc(c.id) + '</td><td>' + datetime(c.date) + '</td><td>' + esc(c.period) + '</td><td class="num">' + c.lines + '</td><td class="num nowrap">' + S(c.abonos) + '</td><td class="num nowrap">' + S(c.cargos) + '</td><td class="num nowrap"><b>' + S(c.neto) + '</b></td><td class="small">' + esc(Q.userName(c.by)) + '</td></tr>')) : UI.empty('Aún no se registraron cierres. Resuelva sugerencias y excepciones para cerrar.', 'lock'), { tight: true }) +
      '</div>';
    el.querySelector('#cn-match').onclick = () => runMatching(() => refresh());
    el.querySelector('#cn-close').onclick = () => closeRecon(() => refresh());
    el.querySelector('#cn-file').onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; importLines(f.name, el.querySelector('#cn-bank').value, () => refresh()); };
    UI.dataTable(el.querySelector('#cn-tbl'), {
      exportName: 'extracto_bancario', rows: () => DB.bankLines, pageSize: 10,
      search: b => [b.id, b.desc, b.bank, b.match].join(' '),
      defaultSort: 'date', defaultDir: -1,
      filters: [{ label: 'Estado', options: ['pendiente', 'sugerido', 'excepción', 'conciliado'], key: 'status' }, { label: 'Cierre', options: [['abiertas', 'Abiertas'], ['cerradas', 'Cerradas']], match: (b, v) => v === 'abiertas' ? !b.closedIn : !!b.closedIn }],
      columns: [
        { key: 'id', label: 'Línea', render: b => '<span class="mono">' + esc(b.id) + '</span>' },
        { key: 'date', label: 'Fecha', render: b => '<span class="nowrap">' + date(b.date) + '</span>' },
        { key: 'bank', label: 'Banco' },
        { key: 'desc', label: 'Descripción', render: b => '<span class="mono small">' + esc(b.desc) + '</span>' + (b.note ? '<div class="cell-sub">' + esc(b.note) + '</div>' : '') },
        { key: 'amount', label: 'Importe', align: 'num', render: b => '<b class="nowrap ' + (b.amount < 0 ? 'fz-neg' : 'fz-pos') + '">' + S(b.amount) + '</b>' },
        { key: 'match', label: 'Match', render: matchLabel, csv: b => b.match || b.resolution || '' },
        { key: 'status', label: 'Estado', render: b => UI.badge(b.status) + (b.closedIn ? '<div class="cell-sub">' + esc(b.closedIn) + '</div>' : ''), csv: b => UI.statusLabel(b.status) },
        { key: '', label: 'Acciones', sort: false, csv: () => '', render: b => b.closedIn ? '<span class="xs faint">Cerrada</span>' : b.status === 'sugerido' ? '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs primary" data-bn="ok" data-id="' + b.id + '">Confirmar</button><button class="btn xs" data-bn="no" data-id="' + b.id + '">Rechazar</button></span>' : b.status === 'excepción' ? '<button class="btn xs sun" data-bn="res" data-id="' + b.id + '">Resolver</button>' : b.status === 'pendiente' ? '<span class="xs faint">Ejecute matching</span>' : '' }
      ],
      footer: rows => '<tr><td colspan="4">Neto de ' + rows.length + ' línea(s)</td><td class="num nowrap">' + S(sum(rows, 'amount')) + '</td><td colspan="3"></td></tr>',
      afterDraw: (c) => c.querySelectorAll('[data-bn]').forEach(btn => btn.onclick = () => { const l = DB.bankLines.find(x => x.id === btn.dataset.id); ({ ok: confirmMatch, no: rejectMatch, res: resolveModal })[btn.dataset.bn](l, () => refresh()); })
    });
  });
})();
