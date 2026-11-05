/* ==========================================================================
   Ventas — Cotizaciones (PROC-021 a PROC-024) y Reservas (PROC-025 a PROC-030)
   Constructor de cotización, versionamiento inmutable, envío con token,
   aprobación/rechazo, conversión idempotente a reserva, Reserva 360,
   modificación, reprogramación y cancelación con política.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr, daysBetween, clone, uid } = Util;
  const I = UI.icon;
  const TODAY = () => window.TODAY;

  /* ---------------- CSS local del módulo ---------------- */
  if (!document.getElementById('css-ventas')) {
    const st = document.createElement('style'); st.id = 'css-ventas';
    st.textContent = [
      '.qb-tbl td{padding:7px 8px;vertical-align:top}',
      '.qb-tbl .input{height:30px;padding:0 7px;font-size:.8rem}',
      '.qb-tbl .w-date{width:136px}.qb-tbl .w-num{width:62px}.qb-tbl .w-money{width:96px}.qb-tbl .w-rate{min-width:190px}',
      '.qb-tbl .hint-s{font-size:.68rem;color:var(--fg-3);margin-top:3px;white-space:nowrap}',
      '.qb-sticky{position:sticky;top:74px}',
      '@media (max-width:900px){.qb-sticky{position:static}}',
      '.df-chg{background:var(--warn-soft)!important}.df-add{background:var(--ok-soft)!important}.df-del{background:var(--bad-soft)!important}.df-del .cell-main{text-decoration:line-through}',
      '.pick-list{max-height:52vh;overflow-y:auto;border:1px solid var(--line-2);border-radius:8px}',
      '.pick-list .list-item.dis{opacity:.6;cursor:not-allowed}',
      '.chk-list .ck{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed var(--line-2);font-size:.84rem}',
      '.chk-list .ck:last-child{border-bottom:0}',
      '.chk-list .ck>svg{width:16px;height:16px;flex:none;margin-top:2px}',
      '.chk-list .ck.okk>svg{color:var(--ok)}.chk-list .ck.bad>svg{color:var(--bad)}.chk-list .ck.wrn>svg{color:var(--warn)}',
      '.qd-logo{width:46px;height:46px;border-radius:8px;border:2px solid var(--accent);color:var(--accent);display:grid;place-items:center;font-weight:700;font-size:1rem;flex:none}',
      '.doc .qd-sec{font-size:.74rem;text-transform:uppercase;letter-spacing:.07em;margin:18px 0 6px;font-weight:700}',
      '.doc ul{margin:4px 0 0 18px;padding:0}.doc li{margin:2px 0}',
      '.doc td.num,.doc th.num{text-align:right;font-variant-numeric:tabular-nums}',
      '.doc .qd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '@media (max-width:600px){.doc .qd-grid{grid-template-columns:minmax(0,1fr)}}',
      '.vt-noperm{opacity:.62;cursor:not-allowed}',
      '.vt-scope{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);font-size:.78rem;font-weight:600;color:var(--fg-2);white-space:nowrap}',
      '.vt-scope svg{width:14px;height:14px}',
      '.vt-facts{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0;border-top:1px solid var(--line-2);margin-top:12px}',
      '.vt-facts>div{padding:10px 12px;border-right:1px solid var(--line-2);min-width:0}.vt-facts>div:last-child{border-right:0}',
      '.vt-facts .k{font-size:.7rem;color:var(--fg-3);text-transform:uppercase;letter-spacing:.05em}.vt-facts .v{font-weight:600;font-size:.88rem;margin-top:2px;overflow-wrap:anywhere}',
      '@media (max-width:1100px){.vt-facts{grid-template-columns:repeat(3,minmax(0,1fr))}.vt-facts>div:nth-child(3n){border-right:0}.vt-facts>div:nth-child(-n+3){border-bottom:1px solid var(--line-2)}}',
      '@media (max-width:560px){.vt-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.vt-facts>div{border-right:0!important;border-bottom:1px solid var(--line-2)}}',
      '.vt-cal .cal-d{min-height:88px}.vt-cal .cal-ev{font-size:.66rem}',
      '.vt-more{font-size:.66rem;color:var(--fg-3);padding-left:4px}',
      '.ph-tag{display:inline-flex;align-items:center;padding:1px 6px;border-radius:5px;font-size:.66rem;background:var(--warn-soft);color:var(--warn);margin-left:6px;font-weight:600}',
      '.vt-page>*,.vt-page .stack>*,.vt-page .tab-body>*{min-width:0}',
      '.vt-imp{border:1px solid var(--line);border-radius:9px;padding:12px 14px;background:var(--surface-2)}',
      '.vt-web td.num,.vt-web .stat-line b,.vt-web dd b{white-space:nowrap}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- Helpers generales ---------------- */
  const can = (p) => Auth.can(p);
  const need = (p) => { if (Auth.can(p)) return true; UI.toast('Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <b>' + esc(p) + '</b>. La autorización también se valida en backend (PROC-062).', 'bad'); return false; };
  const pbtn = (label, ic, cls, act, perm, why) => { const no = (perm && !can(perm)) || !!why; return '<button class="btn ' + (cls || '').replace(/\b(primary|sun|danger)\b/g, no ? '' : '$1') + (no ? ' vt-noperm' : '') + '" data-a="' + act + '"' + (no ? ' aria-disabled="true" title="' + esc(why || ('Requiere permiso ' + perm)) + '"' : '') + '>' + I(no ? 'lock' : ic) + esc(label) + '</button>'; };
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const conv = (amt, from, to) => (!from || !to || from === to) ? amt : from === 'USD' ? amt * DB.settings.fx : amt / DB.settings.fx;
  const minD = (a, b) => (a < b ? a : b); const maxD = (a, b) => (a > b ? a : b);
  const nextId = (arr, prefix, width) => { const n = Math.max(0, ...(DB[arr] || []).map(x => parseInt(String(x.id).replace(/^\D+/, '').replace(/\D/g, ''), 10) || 0)) + 1; return prefix + String(n).padStart(width, '0'); };
  const clientLink = (id) => Access.canRoute('crm/clientes') ? '<a href="#/crm/clientes/' + esc(id) + '">' + esc(Q.clientName(id)) + '</a>' : esc(Q.clientName(id));

  /* ---------------- Alcance y visibilidad por rol ----------------
     Ventas: solo su cartera (cotizaciones/reservas propias). Gerente/Admin: filtro "Asesor"
     compartido con CRM y reasignación. Datos sensibles (principio 2): margen/utilidad solo
     con finance.profitability, catalog.products.view_profitability o quotes.approve_internal,
     o Ventas sobre sus propios registros. Operaciones ve costos de proveedor, sin margen. */
  const me = () => Auth.user.id;
  const own = () => Scope.ownOnly();
  const isSup = () => ['tenant_admin', 'manager'].includes(Auth.role);
  const Adv = { get() { try { return sessionStorage.getItem('qh_advisor') || ''; } catch (e) { return ''; } }, set(v) { try { sessionStorage.setItem('qh_advisor', v || ''); } catch (e) { } } };
  const adv = () => isSup() ? Adv.get() : '';
  const scoped = (rows) => rows.filter(x => own() ? x.owner === me() : (!adv() || x.owner === adv()));
  const PROFIT = () => Auth.canAny(['finance.profitability', 'catalog.products.view_profitability', 'quotes.approve_internal']);
  const seeMargin = (row) => PROFIT() || (own() && (!row || row.owner === me()));
  const seeCost = (row) => seeMargin(row) || can('operations.view');
  const seePrice = (row) => seeMargin(row) || !can('operations.view');
  const MAX_DISC = 10;
  const sellersList = () => DB.users.filter(u => ['tenant_admin', 'manager', 'sales'].includes(u.role) && u.status === 'activo');
  const managers = () => DB.users.filter(u => u.role === 'manager' && u.status === 'activo').map(u => u.id);
  function scopeCtl() {
    if (own()) return '<span class="vt-scope" title="Rol Ventas: solo ve y gestiona sus propias cotizaciones y reservas.">' + I('user') + 'Mi cartera</span>';
    if (!isSup()) return '';
    return '<select class="input sm" data-adv aria-label="Filtrar por asesor" style="width:auto"><option value="">Asesor: todos</option>' + sellersList().map(u => '<option value="' + u.id + '"' + (u.id === Adv.get() ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') + '</select>';
  }
  const bindScope = (el) => el.querySelectorAll('[data-adv]').forEach(s => s.onchange = () => { Adv.set(s.value); App.render(); });
  const advNote = () => adv() ? UI.alert('info', 'Mostrando solo la cartera de <b>' + esc(Q.userName(adv())) + '</b>. Cambie el filtro “Asesor” para ver todo el equipo.') : '';
  const roNote = (what) => UI.alert('info', '<b>Modo consulta (' + esc(Q.roleName(Auth.role)) + ').</b> ' + what);
  function reassign(kind, row) {
    if (!isSup()) { UI.toast('Solo Gerencia o el Administrador pueden reasignar ' + kind.toLowerCase() + 's entre asesores.', 'bad'); return; }
    UI.modal({ title: 'Reasignar ' + kind.toLowerCase(), size: 'sm', sub: esc(row.id) + ' · actual: ' + esc(Q.userName(row.owner)), body: UI.form([{ id: 'ra-owner', label: 'Nuevo asesor responsable', type: 'select', required: true, placeholder: 'Seleccione…', options: sellersList().map(u => [u.id, u.name + ' — ' + Q.roleName(u.role)]), value: row.owner, col: 12 }, { id: 'ra-note', label: 'Motivo', type: 'textarea', rows: 2, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Reasignar', cls: 'primary', icon: 'user', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        if (f['ra-owner'] === row.owner) { UI.toast('Seleccione un asesor distinto al actual.', 'bad'); return false; }
        const prev = row.owner; row.owner = f['ra-owner'];
        Audit.log(kind, row.id, 'reasignar', Q.userName(prev), Q.userName(row.owner) + (f['ra-note'] ? ' · ' + f['ra-note'] : ''));
        Notify.push(kind.toLowerCase() + '.reasignada', 'Portal', row.owner, kind + ' ' + row.id + ' reasignada a su cartera');
        Store.save(); UI.toast(kind + ' reasignada a ' + esc(Q.userName(row.owner)) + '.'); App.render();
      } }] });
  }
  const prodLink = (id) => '<a href="#/catalogo/productos/' + esc(id) + '">' + esc(Q.productName(id)) + '</a>';
  const ck = (state, title, detail) => '<div class="ck ' + (state === true ? 'okk' : state === 'warn' ? 'wrn' : 'bad') + '">' + I(state === true ? 'checkCircle' : state === 'warn' ? 'alert' : 'x') + '<div><b>' + title + '</b>' + (detail ? '<div class="xs muted">' + detail + '</div>' : '') + '</div></div>';
  const bindActs = (root, H) => root.querySelectorAll('[data-a]').forEach(b => { b.onclick = (e) => { e.preventDefault(); const f = H[b.dataset.a]; if (f) f(b); }; });
  const tabMem = {};
  const segChannel = (c) => ({ Corporativo: 'Corporativo', B2B: 'B2B', Grupos: 'Corporativo' })[c && c.segment] || 'Directo';

  /* ---------------- Catálogo / pricing ---------------- */
  const prodVer = (p) => { const v = (p.versions || []).find(x => x.status === 'vigente') || (p.versions || []).slice(-1)[0]; return v ? v.v : '1.0'; };
  const snapshotOf = (items) => [...new Set(items.map(i => i.productId))].map(id => { const p = Q.product(id); return id + ' v' + (p ? prodVer(p) : '?'); }).join(' / ');
  const sellBlock = (p) => {
    if (!p) return 'Producto inexistente en el catálogo';
    if (p.status !== 'ACTIVE') return 'PRD-BR-002: producto en estado ' + UI.statusLabel(p.status) + '; no puede usarse para nuevas ventas';
    if (p.flags && p.flags.quoteable === false) return 'Producto no habilitado para el canal de cotizaciones';
    return '';
  };
  const rateValid = (r, d) => r.status !== 'vencida' && (!d || (d >= r.validFrom && d <= r.validTo));
  const seasonOf = (d) => Pricing.seasonFor(d);
  const suggest = (rate, d, cur) => {
    const base = (Q.season(rate.season) || { factor: 1 }).factor || 1;
    const s = seasonOf(d); const f = (s ? s.factor : 1) / base;
    return { cost: round2(conv(rate.cost * f, rate.currency, cur)), price: round2(conv(rate.price * f, rate.currency, cur)), factor: f, season: s };
  };
  const defaultRate = (p, d, client) => {
    const ch = segChannel(client);
    const ok = (p.rates || []).filter(r => rateValid(r, d));
    return ok.find(r => r.channel === ch && r.segment !== 'Niño') || ok.find(r => r.channel === 'Directo' && r.segment !== 'Niño') || ok[0] || null;
  };
  const MODEL = { POR_SALIDA: 'Por salida (cupos)', POR_HABITACION: 'Por habitación', CUPOS: 'Cupos con proveedor', CAPACIDAD: 'Capacidad diaria', POR_TRANSPORTE: 'Capacidad de transporte', SIN_CONTROL: 'Sin control' };

  /* ---------------- Disponibilidad ---------------- */
  const depById = (id) => { for (const p of DB.products) { const d = (p.departures || []).find(x => x.id === id); if (d) return { d, p }; } return null; };
  const freeOf = (d) => d.capacity - d.sold;
  const setDepStatus = (d) => { if (d.status === 'cerrada') return; d.status = d.sold >= d.capacity ? 'completa' : 'abierta'; };
  const depForService = (s) => {
    if (s.depId) return depById(s.depId);
    const m = /SAL-\d{4}/.exec(s.name || ''); if (m) return depById(m[0]);
    const p = Q.product(s.productId);
    if (p && p.availabilityModel === 'POR_SALIDA') { const d = (p.departures || []).find(x => x.date === s.date); if (d) return { d, p }; }
    return null;
  };
  function availFor(productId, dateStr, pax, currentDepId) {
    const p = Q.product(productId);
    if (!p) return { ok: false, msg: 'Producto inexistente', alts: [] };
    if (p.status !== 'ACTIVE') return { ok: false, msg: 'PRD-BR-002: producto ' + UI.statusLabel(p.status) + ', no disponible para nuevas ventas', alts: [] };
    if (p.availabilityModel === 'POR_SALIDA') {
      const deps = (p.departures || []).filter(d => d.status !== 'cerrada' && daysFromToday(d.date) >= 0);
      const d = deps.find(x => x.date === dateStr);
      const alts = deps.filter(x => x.date !== dateStr && freeOf(x) >= pax);
      if (!d) return { ok: false, msg: 'Sin salida programada el ' + date(dateStr), alts, model: p.availabilityModel };
      const fr = freeOf(d) + (currentDepId === d.id ? pax : 0);
      if (fr < pax) return { ok: false, dep: d, msg: 'Salida ' + d.id + ' con ' + Math.max(0, freeOf(d)) + ' cupo(s) libre(s); se requieren ' + pax, alts, model: p.availabilityModel };
      return { ok: true, dep: d, msg: 'Salida ' + d.id + ' · ' + freeOf(d) + ' de ' + d.capacity + ' cupos libres', model: p.availabilityModel };
    }
    return { ok: true, hold: true, msg: (MODEL[p.availabilityModel] || p.availabilityModel) + ': hold solicitado al proveedor, sujeto a confirmación (PRD-BR-013)', model: p.availabilityModel };
  }
  const altsHtml = (alts) => alts && alts.length ? '<div class="xs" style="margin-top:4px">Alternativas con cupo: ' + alts.slice(0, 4).map(a => '<span class="tag">' + esc(a.id) + ' · ' + dateShort(a.date) + ' · ' + freeOf(a) + ' libres</span>').join(' ') + '</div>' : '<div class="xs faint" style="margin-top:4px">Sin salidas alternativas con cupo suficiente. Programe una nueva salida en Catálogo › Salidas.</div>';

  /* ---------------- Cotizaciones: helpers ---------------- */
  const curV = (q) => q.versions.find(v => v.v === q.currentVersion) || q.versions[q.versions.length - 1];
  const qTot = (q) => Pricing.quoteTotals(curV(q));
  const OPEN = ['borrador', 'enviada', 'vista', 'negociacion'];
  const SENT = ['enviada', 'vista', 'negociacion'];
  const isExpired = (q) => q.status === 'vencida' || (SENT.includes(q.status) && daysFromToday(q.validUntil) < 0);
  const needsInternal = (v, t) => { t = t || Pricing.quoteTotals(v); const r = []; if ((v.discountPct || 0) > 5) r.push('descuento ' + fmtN(v.discountPct, 1) + '% > 5%'); if (t.marginPct < 15) r.push('margen ' + fmtN(t.marginPct, 1) + '% < 15%'); return r; };
  const overCap = (v) => (v.discountPct || 0) > MAX_DISC;
  const canApproveV = (v) => can('quotes.approve_internal') && (!overCap(v) || can('quotes.discount_override'));
  const pendReq = (v) => v && v.approvalRequest && v.approvalRequest.status === 'pendiente' ? v.approvalRequest : null;
  const needsIA = (v) => needsInternal(v).length > 0 && !v.internalApproval;
  const Q_STEPS = ['Borrador', 'Enviada', 'Vista', 'Negociación', 'Aprobada', 'Convertida'];
  const qFlow = (q) => { const m = { borrador: 0, enviada: 1, vista: 2, negociacion: 3, aprobada: 4, convertida: 6 }; if (m[q.status] != null) return UI.flow(Q_STEPS, m[q.status]); const at = q.status === 'vencida' ? (q.viewedAt ? 3 : 2) : 4; return UI.flow(Q_STEPS, at, at); };
  const resOfQuote = (q) => DB.reservations.find(r => r.quoteId === q.id && r.status !== 'cancelada') || (q.reservationId ? Q.reservation(q.reservationId) : null);
  const portalUrl = (q) => 'https://portal.andeshorizonte.pe/c/' + q.token;
  const newToken = () => Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 8);
  const lineKey = (i) => i.productId + '|' + (i.segment || 'Adulto');

  function itineraryOf(items) {
    const rows = [];
    items.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(it => {
      const p = Q.product(it.productId); if (!p) return;
      if (p.itinerary && p.itinerary.length) p.itinerary.forEach(d => rows.push({ date: addDays(it.date, d.day - 1), title: d.title, acts: (d.items || []).map(x => (x.time && x.time !== '—' ? x.time + ' · ' : '') + x.activity), prod: p.name }));
      else rows.push({ date: it.date, title: p.name, acts: p.short ? [p.short] : [], prod: p.name });
    });
    const seen = new Set();
    return rows.filter(r => { const k = r.date + '|' + r.title; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.date.localeCompare(b.date));
  }
  const itinHtml = (items) => { const rows = itineraryOf(items); if (!rows.length) return UI.empty('Agregue productos para generar el itinerario.', 'route'); return UI.timeline(rows.map(r => ({ icon: 'calendar', title: '<span class="mono small">' + dateShort(r.date) + '</span> · ' + esc(r.title), meta: esc(r.prod), desc: r.acts.length ? esc(r.acts.join(' — ')) : '' }))); };

  /* ---------------- Documento profesional de cotización ---------------- */
  function quoteDoc(q, v) {
    const c = Q.client(q.clientId) || {}; const t = Pricing.quoteTotals(v); const T = DB.tenant;
    const own = Q.user(q.owner) || {}; const sede = Q.sede(own.sede) || DB.sedes[0];
    const prods = [...new Set(v.items.map(i => i.productId))].map(Q.product).filter(Boolean);
    const itin = itineraryOf(v.items);
    const pax = q.pax || { adt: 0, chd: 0, inf: 0 };
    const pol = v.policies || {};
    return '<div class="doc">' +
      '<div class="doc-head"><div class="row top" style="gap:12px;flex-wrap:nowrap"><div class="qd-logo">' + esc(T.logo) + '</div><div><h2 style="font-size:1.05rem;margin:0">' + esc(T.name) + '</h2><div class="muted xs">RUC ' + esc(T.ruc) + ' · ' + esc(sede.address) + '</div><div class="muted xs">Tel. ' + esc(sede.phone) + ' · ' + esc(own.email || '') + '</div></div></div>' +
      '<div class="right"><h1 style="font-size:1.15rem;margin:0;letter-spacing:.04em">COTIZACIÓN</h1><div class="mono" style="font-weight:600">' + esc(q.id) + ' · versión ' + v.v + '</div><div class="muted xs">Emitida el ' + date(v.date) + '</div><div class="xs"><b>Válida hasta el ' + date(q.validUntil) + '</b></div></div></div>' +
      '<div class="qd-grid"><div><div class="qd-sec" style="margin-top:0">Cliente</div><b>' + esc(c.name) + '</b><div class="muted xs">' + esc(c.doc || '') + (c.contactName ? ' · Atención: ' + esc(c.contactName) : '') + '</div><div class="muted xs">' + esc(c.email || '') + ' · ' + esc(c.phone || '') + '</div><div class="muted xs">' + esc((c.city || '') + ', ' + (c.country || '')) + '</div></div>' +
      '<div><div class="qd-sec" style="margin-top:0">Viaje</div><b>' + esc(q.title) + '</b><div class="muted xs">Del ' + date(q.travelFrom) + ' al ' + date(q.travelTo) + ' (' + (daysBetween(q.travelFrom, q.travelTo) + 1) + ' días)</div><div class="muted xs">Pasajeros: ' + pax.adt + ' adulto(s)' + (pax.chd ? ', ' + pax.chd + ' niño(s)' : '') + (pax.inf ? ', ' + pax.inf + ' infante(s)' : '') + '</div><div class="muted xs">Moneda: ' + (q.currency === 'USD' ? 'Dólares americanos (US$)' : 'Soles (S/)') + '</div></div></div>' +
      '<div class="qd-sec">Itinerario resumido</div>' + (itin.length ? '<table><thead><tr><th style="width:90px">Fecha</th><th>Programa</th><th>Actividades</th></tr></thead><tbody>' + itin.map(r => '<tr><td class="nowrap">' + dateShort(r.date) + '</td><td><b>' + esc(r.title) + '</b></td><td class="muted">' + esc(r.acts.join(' · ')) + '</td></tr>').join('') + '</tbody></table>' : '<p class="muted">Sin itinerario.</p>') +
      '<div class="qd-sec">Detalle de precios</div><table><thead><tr><th>Servicio</th><th>Fecha</th><th>Tarifa</th><th class="num">Cant.</th><th class="num">Pax</th><th class="num">P. unitario</th><th class="num">Subtotal</th></tr></thead><tbody>' +
      t.lines.map(l => '<tr><td>' + esc(Q.productName(l.productId)) + '</td><td class="nowrap">' + dateShort(l.date) + '</td><td>' + esc(l.segment || 'Adulto') + '</td><td class="num">' + l.qty + '</td><td class="num">' + l.pax + '</td><td class="num">' + money(l.unitPrice, q.currency) + '</td><td class="num">' + money(l.saleTotal, q.currency) + '</td></tr>').join('') + '</tbody></table>' +
      '<table class="tot"><tbody><tr><td>Subtotal</td><td class="num">' + money(t.sale, q.currency) + '</td></tr>' + (t.discount ? '<tr><td>Descuento (' + fmtN(v.discountPct, 1) + '%)</td><td class="num">− ' + money(t.discount, q.currency) + '</td></tr>' : '') + '<tr><td>Valor de venta</td><td class="num">' + money(t.net, q.currency) + '</td></tr><tr><td>IGV (' + fmtN(v.taxPct || 0, 0) + '%)' + (!v.taxPct ? ' <span class="muted xs">exonerado / no domiciliado</span>' : '') + '</td><td class="num">' + money(t.tax, q.currency) + '</td></tr><tr><td><b>TOTAL</b></td><td class="num"><b>' + money(t.total, q.currency) + '</b></td></tr></tbody></table>' +
      '<div class="qd-grid">' + prods.map(p => '<div><div class="qd-sec">' + esc(p.name) + ' — incluye</div><ul>' + (p.inclusions || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + ((p.exclusions || []).length ? '<div class="qd-sec" style="margin-top:8px">No incluye</div><ul>' + p.exclusions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>').join('') + '</div>' +
      '<div class="qd-sec">Políticas aplicables (snapshot ' + esc(v.snapshot || snapshotOf(v.items)) + ')</div>' + prods.map(p => { const po = pol[p.id] || p.policies || {}; return '<div style="margin-bottom:8px"><b class="xs">' + esc(p.name) + '</b><div class="xs muted">Cancelación: ' + esc(po.cancel) + '</div><div class="xs muted">Cambios: ' + esc(po.modify) + ' No-show: ' + esc(po.noshow) + '</div><div class="xs muted">Reembolsos: ' + esc(po.refund) + '</div></div>'; }).join('') +
      '<div class="qd-sec">Condiciones y validez</div><div class="xs">' + esc(v.conditions || 'Precios sujetos a disponibilidad al momento de la reserva. Para confirmar se requiere el 40% de anticipo; el saldo se cancela 15 días antes del inicio del viaje.') + '</div>' + (v.notes ? '<div class="xs muted" style="margin-top:4px">Notas: ' + esc(v.notes) + '</div>' : '') +
      '<div class="xs muted" style="margin-top:4px">Oferta válida hasta el ' + date(q.validUntil) + '. Tipo de cambio referencial S/ ' + fmtN(DB.settings.fx, 2) + ' por US$. Documento generado desde la versión ' + v.v + '; una versión aprobada es inmutable.</div>' +
      '<div class="row between" style="margin-top:26px;border-top:1px solid var(--line-2);padding-top:10px"><div class="xs"><b>' + esc(own.name || '') + '</b><div class="muted">Ejecutivo(a) de ventas · ' + esc(own.phone || '') + '</div></div><div class="xs muted right">Aprobación del cliente en línea:<div class="mono">' + (q.token ? esc(portalUrl(q)) : 'enlace pendiente de generar') + '</div></div></div>' +
      '</div>';
  }
  const docModal = (q, v) => UI.modal({ title: 'Vista de impresión — ' + esc(q.id) + ' v' + v.v, size: 'lg', body: UI.alert('info', 'En producción el PDF se genera como job asíncrono (PROC-060) a partir de esta plantilla y queda adjunto a la versión. Esta es la vista previa del documento.') + '<div style="margin-top:12px">' + quoteDoc(q, v) + '</div>', actions: [{ label: 'Cerrar' }, { label: 'Encolar generación de PDF', cls: 'primary', icon: 'file', onClick: () => { Audit.log('Cotización', q.id, 'generar_pdf', '', 'v' + v.v); UI.toast('Generación de PDF encolada para ' + esc(q.id) + ' v' + v.v + '.'); } }] });

  /* ======================================================================
     COTIZACIONES — Lista
     ====================================================================== */
  function renderQuoteList(el) {
    const QS = scoped(DB.quotes);
    const open = QS.filter(q => OPEN.includes(q.status) && !isExpired(q));
    const follow = QS.filter(q => SENT.includes(q.status) && !isExpired(q));
    const followAmt = sum(follow, q => toPEN(qTot(q).total, q.currency));
    const won = QS.filter(q => ['aprobada', 'convertida'].includes(q.status)).length;
    const decided = QS.filter(q => ['aprobada', 'convertida', 'rechazada', 'vencida'].includes(q.status)).length;
    const soon = follow.filter(q => { const d = daysFromToday(q.validUntil); return d >= 0 && d <= 3; });
    const pend = QS.filter(q => pendReq(curV(q)));
    const ro = !can('quotes.create') && !can('quotes.send');
    el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: 'Cotizaciones', subtitle: 'Creación, versionamiento, envío con enlace seguro, aprobación y conversión a reserva (PROC-021 a PROC-025).', crumbs: [['Inicio', '#/dashboard'], ['Ventas'], ['Cotizaciones']], actions: scopeCtl() + (Access.canRoute('reservas') ? '<a class="btn" href="#/reservas">' + I('suitcase') + 'Reservas</a>' : '') + (can('quotes.create') ? '<a class="btn primary" href="#/cotizaciones/nueva">' + I('plus') + 'Nueva cotización</a>' : '') }) +
      (ro ? roNote('Puede consultar cotizaciones, versiones y documentos; la creación, edición y envío requieren <span class="mono">quotes.create</span> / <span class="mono">quotes.send</span>.') : '') + advNote() +
      (pend.length && canApproveV({}) ? UI.alert('warn', '<b>' + pend.length + ' cotización(es) pendiente(s) de aprobación de gerencia:</b> ' + pend.map(q => '<a class="mono" href="#/cotizaciones/' + q.id + '">' + esc(q.id) + '</a> (' + esc(Q.userName(q.owner)) + ')').join(', ') + '. Ábrala para aprobar o rechazar.') : '') +
      '<div class="grid g5">' +
      UI.kpi({ label: 'Cotizaciones abiertas', value: open.length, sub: open.filter(q => q.status === 'borrador').length + ' en borrador', tone: 'accent', icon: 'file' }) +
      UI.kpi({ label: 'Monto en seguimiento', value: 'S/ ' + fmtN(followAmt / 1000, 1) + 'k', sub: follow.length + ' enviadas / en negociación', tone: 'violet', icon: 'target' }) +
      UI.kpi({ label: 'Tasa de aprobación', value: fmtN(decided ? won / decided * 100 : 0, 1) + '%', sub: won + ' de ' + decided + ' decididas', tone: 'ok', icon: 'fileCheck' }) +
      UI.kpi({ label: 'Por vencer (≤ 3 días)', value: soon.length, sub: soon.length ? soon.map(q => q.id.slice(-5)).join(', ') : 'Sin vencimientos próximos', tone: soon.length ? 'sun' : 'info', icon: 'clock' }) +
      UI.kpi({ label: 'Aprobación de gerencia', value: pend.length, sub: own() ? 'mis solicitudes pendientes' : 'solicitudes por resolver', tone: pend.length ? 'bad' : 'ok', icon: 'shield' }) +
      '</div><div id="q-tbl"></div></div>';
    bindScope(el);
    UI.dataTable(el.querySelector('#q-tbl'), {
      rows: () => scoped(DB.quotes), exportName: 'cotizaciones', defaultSort: 'id', defaultDir: -1,
      search: q => [q.id, q.title, Q.clientName(q.clientId), q.oppId].join(' '), searchPlaceholder: 'Buscar código, título o cliente…',
      filters: [
        { label: 'Estado', options: ['borrador', 'enviada', 'vista', 'negociacion', 'aprobada', 'convertida', 'rechazada', 'vencida'], match: (q, v) => v === 'vencida' ? isExpired(q) : q.status === v },
        { label: 'Aprobación interna', options: [['pend', 'Pendiente de gerencia'], ['req', 'Requiere aprobación'], ['ok', 'Aprobada internamente']], match: (q, v) => { const cv = curV(q); return v === 'pend' ? !!pendReq(cv) : v === 'ok' ? !!cv.internalApproval : OPEN.includes(q.status) && needsIA(cv); } }
      ],
      onRow: q => App.go('#/cotizaciones/' + q.id),
      columns: [
        { key: 'id', label: 'Código', render: q => '<span class="mono small">' + esc(q.id) + '</span>' },
        { key: 'title', label: 'Título / cliente', render: q => '<div class="cell-main">' + esc(q.title) + '</div><div class="cell-sub">' + esc(Q.clientName(q.clientId)) + (q.oppId ? ' · ' + esc(q.oppId) : '') + '</div>' },
        { key: 'currentVersion', label: 'Versión', render: q => '<span class="tag mono">v' + q.currentVersion + '</span> <span class="xs faint">de ' + q.versions.length + '</span>' },
        { key: 'travelFrom', label: 'Viaje', render: q => '<span class="nowrap">' + dateShort(q.travelFrom) + ' – ' + dateShort(q.travelTo) + '</span><div class="cell-sub">' + ((q.pax.adt || 0) + (q.pax.chd || 0) + (q.pax.inf || 0)) + ' pax</div>' },
        { key: 'total', label: 'Total', align: 'num', sortVal: q => toPEN(qTot(q).total, q.currency), render: q => '<b class="nowrap">' + money(qTot(q).total, q.currency) + '</b>', csv: q => fmtN(qTot(q).total) },
        { key: 'validUntil', label: 'Validez', render: q => { const d = daysFromToday(q.validUntil); const exp = isExpired(q); return '<span class="nowrap ' + (exp ? 'bad' : (SENT.includes(q.status) && d <= 3 ? 'warn' : '')) + '">' + date(q.validUntil) + '</span><div class="cell-sub">' + (exp ? '<span class="bad">Vencida</span>' : SENT.includes(q.status) || q.status === 'borrador' ? 'vence en ' + d + ' d' : '—') + '</div>'; } },
        own() ? null : { key: 'owner', label: 'Vendedor', render: q => '<span class="small nowrap">' + esc(Q.userName(q.owner)) + '</span>', sortVal: q => Q.userName(q.owner), csv: q => Q.userName(q.owner) },
        { key: 'status', label: 'Estado', render: q => (isExpired(q) && q.status !== 'vencida' ? UI.badge('vencida') : UI.badge(q.status)) + (pendReq(curV(q)) ? '<div class="cell-sub warn">Pend. aprobación gerencia</div>' : ''), csv: q => UI.statusLabel(q.status) + (pendReq(curV(q)) ? ' (pendiente aprobación gerencia)' : '') }
      ].filter(Boolean)
    });
  }

  /* ======================================================================
     COTIZACIONES — Constructor (nueva / editar borrador)
     ====================================================================== */
  function renderBuilder(el, { oppId, quote }) {
    if (!can('quotes.create')) { el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: 'Nueva cotización', crumbs: [['Ventas'], ['Cotizaciones', '#/cotizaciones'], ['Nueva']] }) + UI.alert('warn', 'Su rol no tiene el permiso <b>quotes.create</b> para crear o editar cotizaciones.') + '</div>'; return; }
    let st;
    const editing = !!quote;
    if (editing) {
      const v = curV(quote);
      if (v.status !== 'borrador') { UI.toast('Solo se editan versiones en borrador. La versión v' + v.v + ' es de solo lectura (PROC-022).', 'bad'); location.hash = '#/cotizaciones/' + quote.id; return; }
      st = { clientId: quote.clientId, oppId: quote.oppId || '', title: quote.title, travelFrom: quote.travelFrom, travelTo: quote.travelTo, validUntil: quote.validUntil, currency: quote.currency, adt: quote.pax.adt || 0, chd: quote.pax.chd || 0, inf: quote.pax.inf || 0, discountPct: v.discountPct || 0, taxPct: v.taxPct || 0, notes: v.notes || '', conditions: v.conditions || '', items: clone(v.items) };
    } else {
      const opp = oppId ? Q.opportunity(oppId) : null;
      if (opp && own() && opp.owner !== me()) { Scope.denied(el, 'La oportunidad ' + opp.id + ' (' + opp.title + ')'); return; }
      const lead = opp && opp.leadId ? Q.lead(opp.leadId) : null;
      const cli = opp ? Q.client(opp.clientId) : null;
      const from = lead && lead.travelDate && daysFromToday(lead.travelDate) > 0 ? lead.travelDate : addDays(TODAY(), 30);
      st = { clientId: opp ? opp.clientId : '', oppId: opp ? opp.id : '', title: opp ? opp.title : '', travelFrom: from, travelTo: addDays(from, 3), validUntil: addDays(TODAY(), DB.settings.quoteValidityDays || 10), currency: opp ? opp.currency : 'PEN', adt: opp ? Math.max(1, opp.pax || 1) : 2, chd: 0, inf: 0, discountPct: 0, taxPct: cli && cli.country !== 'Perú' ? 0 : DB.settings.taxPct, notes: '', conditions: 'Precios sujetos a disponibilidad al momento de la reserva. Para confirmar se requiere el 40% de anticipo; el saldo se cancela 15 días antes del inicio del viaje.', items: [] };
      if (oppId && !opp) UI.toast('La oportunidad ' + esc(oppId) + ' no existe.', 'warn');
    }
    const opp0 = st.oppId ? Q.opportunity(st.oppId) : null;
    const title = editing ? 'Editar ' + quote.id + ' · v' + quote.currentVersion : 'Nueva cotización';
    el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: esc(title), subtitle: 'Constructor de cotización: cliente, pasajeros, ítems del catálogo, pricing con temporada y margen por línea (PROC-021).', crumbs: [['Inicio', '#/dashboard'], ['Ventas'], ['Cotizaciones', '#/cotizaciones'], [editing ? quote.id : 'Nueva']], actions: '<a class="btn" href="' + (editing ? '#/cotizaciones/' + quote.id : '#/cotizaciones') + '">Cancelar</a><button class="btn primary" data-a="save">' + I('check') + 'Guardar borrador</button>' }) +
      (opp0 && !editing ? UI.alert('info', 'Cotización precargada desde la oportunidad <a href="#/crm/oportunidades/' + opp0.id + '"><b>' + esc(opp0.id) + '</b></a> — ' + esc(opp0.title) + ' (' + opp0.pax + ' pax, destino ' + esc(opp0.destination) + ').') : '') +
      '<div class="stack"><div class="grid g-2-1" style="align-items:start">' +
      UI.card('Datos generales', '<div id="qb-gen"></div>') +
      '<div class="qb-sticky">' + UI.card('Resumen económico', '<div id="qb-tot"></div>', { footer: '<div class="row end"><button class="btn primary" data-a="save">' + I('check') + 'Guardar borrador</button></div>' }) + '</div></div>' +
      UI.card('Ítems de la cotización', '<div id="qb-items"></div>', { tight: true, sub: 'Solo productos activos y cotizables (PRD-BR-002). Tarifas vencidas no seleccionables (PRD-BR-005). Precio sugerido = tarifa × factor de temporada.', actions: '<button class="btn sm primary" data-a="add">' + I('plus') + 'Agregar del catálogo</button>', footer: '<div id="qb-foot" class="row between small"></div>' }) +
      '<div class="grid g2" style="align-items:start">' +
      UI.card('Notas y condiciones', UI.form([{ id: 'qb-notes', label: 'Notas internas / para el cliente', type: 'textarea', col: 12, rows: 2, value: st.notes }, { id: 'qb-cond', label: 'Condiciones comerciales', type: 'textarea', col: 12, rows: 4, value: st.conditions }])) +
      UI.card('Itinerario resumido (generado de los productos)', '<div id="qb-itin"></div>') +
      '</div></div></div>';

    const gen = el.querySelector('#qb-gen'), itemsEl = el.querySelector('#qb-items'), totEl = el.querySelector('#qb-tot'), itinEl = el.querySelector('#qb-itin');
    const client = () => Q.client(st.clientId);
    function drawGen() {
      const opps = DB.opportunities.filter(o => o.clientId === st.clientId && (!own() || o.owner === me()) && (!['ganada', 'perdida'].includes(o.stage) || o.id === st.oppId));
      const cs = Scope.clientIds();
      gen.innerHTML = UI.form([
        { id: 'g-client', label: 'Cliente', type: 'select', col: 6, required: true, placeholder: 'Seleccione un cliente…', value: st.clientId, options: DB.clients.filter(c => !cs || cs.has(c.id) || c.id === st.clientId).map(c => [c.id, c.name + ' · ' + c.segment]), hint: cs ? 'Clientes de su cartera' : '' },
        { id: 'g-opp', label: 'Oportunidad', type: 'select', col: 6, value: st.oppId, placeholder: '(sin oportunidad)', options: opps.map(o => [o.id, o.id + ' — ' + o.title]) },
        { id: 'g-title', label: 'Título de la cotización', col: 12, required: true, value: st.title, placeholder: 'Ej.: Cusco clásico 5D/4N — familia' },
        { id: 'g-from', label: 'Viaje desde', type: 'date', col: 3, required: true, value: st.travelFrom },
        { id: 'g-to', label: 'Viaje hasta', type: 'date', col: 3, required: true, value: st.travelTo },
        { id: 'g-valid', label: 'Válida hasta', type: 'date', col: 3, required: true, value: st.validUntil },
        { id: 'g-cur', label: 'Moneda', type: 'select', col: 3, value: st.currency, options: [['PEN', 'PEN — Soles'], ['USD', 'USD — Dólares']], hint: 'TC ' + DB.settings.fx + ' (' + DB.settings.fxSource + ')' },
        { id: 'g-adt', label: 'Adultos (ADT)', type: 'number', min: 0, col: 2, value: st.adt },
        { id: 'g-chd', label: 'Niños (CHD)', type: 'number', min: 0, col: 2, value: st.chd },
        { id: 'g-inf', label: 'Infantes (INF)', type: 'number', min: 0, col: 2, value: st.inf },
        { id: 'g-disc', label: 'Descuento %', type: 'number', min: 0, max: can('quotes.discount_override') ? 50 : MAX_DISC, step: '0.5', col: 3, value: st.discountPct, hint: '> 5% requiere aprobación de gerencia · tope ' + MAX_DISC + '%' + (can('quotes.discount_override') ? ' (usted puede superarlo)' : '') },
        { id: 'g-tax', label: 'IGV %', type: 'number', min: 0, max: 18, col: 3, value: st.taxPct, hint: client() && client().country !== 'Perú' ? 'Cliente no domiciliado: 0% (exportación de servicios)' : 'Tasa general ' + DB.settings.taxPct + '%' }
      ]);
      const g = (id) => gen.querySelector('#' + id);
      g('g-client').onchange = (e) => { st.clientId = e.target.value; const c = client(); st.oppId = ''; if (c) { st.taxPct = c.country !== 'Perú' ? 0 : DB.settings.taxPct; if (c.country !== 'Perú') UI.toast('Cliente no domiciliado: IGV 0% (exportación de servicios).', 'info'); } drawGen(); drawTot(); };
      g('g-opp').onchange = (e) => { st.oppId = e.target.value; const o = Q.opportunity(st.oppId); if (o && !st.title) { st.title = o.title; g('g-title').value = o.title; } };
      g('g-title').oninput = (e) => { st.title = e.target.value; };
      g('g-from').onchange = (e) => { const old = st.travelFrom; st.travelFrom = e.target.value; if (st.travelTo < st.travelFrom) { st.travelTo = addDays(st.travelFrom, Math.max(0, daysBetween(old, st.travelTo))); g('g-to').value = st.travelTo; } };
      g('g-to').onchange = (e) => { st.travelTo = e.target.value; };
      g('g-valid').onchange = (e) => { st.validUntil = e.target.value; };
      g('g-cur').onchange = (e) => { const nc = e.target.value; st.items.forEach(i => { i.unitCost = round2(conv(i.unitCost, st.currency, nc)); i.unitPrice = round2(conv(i.unitPrice, st.currency, nc)); }); st.currency = nc; UI.toast('Montos convertidos a ' + nc + ' con TC ' + DB.settings.fx + '.', 'info'); drawItems(); };
      ['adt', 'chd', 'inf'].forEach(k => { g('g-' + k).oninput = (e) => { st[k] = Math.max(0, num(e.target.value)); drawTot(); }; });
      g('g-disc').oninput = (e) => { st.discountPct = Math.max(0, num(e.target.value)); drawTot(); };
      g('g-tax').oninput = (e) => { st.taxPct = Math.max(0, num(e.target.value)); drawTot(); };
    }
    function rateOpts(it) {
      const p = Q.product(it.productId);
      return '<option value="">Precio manual</option>' + (p.rates || []).map(r => { const ok = rateValid(r, it.date); return '<option value="' + r.id + '"' + (r.id === it.rateId ? ' selected' : '') + (ok ? '' : ' disabled') + '>' + esc(r.id + ' · ' + r.type + ' ' + r.segment + ' · ' + r.channel + ' · ' + r.currency + ' ' + fmtN(r.price, 0)) + (ok ? '' : ' — no vigente (PRD-BR-005)') + '</option>'; }).join('');
    }
    function lineMargin(i) { return i.unitPrice ? (i.unitPrice - i.unitCost) / i.unitPrice * 100 : 0; }
    function hintFor(i) {
      const s = seasonOf(i.date); const r = i.rateId ? (Q.product(i.productId).rates || []).find(x => x.id === i.rateId) : null;
      const sg = r ? suggest(r, i.date, st.currency) : null;
      return (s ? esc(s.type) + ' ×' + fmtN(s.factor, 2) : 'Sin temporada') + (sg ? ' · sug. ' + money(sg.price, st.currency, 0) : '');
    }
    function drawItems() {
      if (!st.items.length) { itemsEl.innerHTML = UI.empty('Aún no hay ítems. Use “Agregar del catálogo” para incluir productos activos.', 'box'); drawTot(); return; }
      itemsEl.innerHTML = '<div class="tbl-wrap"><table class="tbl qb-tbl"><thead><tr><th>Producto</th><th>Fecha</th><th>Tarifa / segmento</th><th class="num">Cant.</th><th class="num">Pax</th><th class="num">Costo unit.</th><th class="num">Precio unit.</th><th class="num">Margen</th><th class="num">Subtotal</th><th></th></tr></thead><tbody>' +
        st.items.map((i, k) => {
          const p = Q.product(i.productId); const blk = sellBlock(p); const r = i.rateId ? (p.rates || []).find(x => x.id === i.rateId) : null; const rBad = r && !rateValid(r, i.date);
          const mg = lineMargin(i);
          return '<tr data-k="' + k + '"><td style="min-width:180px"><div class="cell-main">' + esc(p ? p.name : i.productId) + '</div><div class="cell-sub">' + esc(p ? p.code + ' · ' + (MODEL[p.availabilityModel] || '') : '') + '</div>' + (blk ? '<div class="xs bad">' + esc(blk) + '</div>' : '') + (rBad ? '<div class="xs bad">Tarifa ' + esc(r.id) + ' no vigente para la fecha (PRD-BR-005)</div>' : '') + '</td>' +
            '<td><input class="input w-date" type="date" data-f="date" value="' + esc(i.date) + '"></td>' +
            '<td><select class="input w-rate" data-f="rateId">' + rateOpts(i) + '</select><div class="hint-s">' + hintFor(i) + '</div><select class="input" data-f="segment" style="margin-top:4px">' + ['Adulto', 'Niño', 'Infante', 'Grupo', 'Pasajero'].map(s => '<option' + (s === (i.segment || 'Adulto') ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td>' +
            '<td class="num"><input class="input w-num" type="number" min="1" data-f="qty" value="' + i.qty + '"></td>' +
            '<td class="num"><input class="input w-num" type="number" min="1" data-f="pax" value="' + i.pax + '"></td>' +
            '<td class="num"><input class="input w-money" type="number" min="0" step="0.01" data-f="unitCost" value="' + i.unitCost + '"></td>' +
            '<td class="num"><input class="input w-money" type="number" min="0" step="0.01" data-f="unitPrice" value="' + i.unitPrice + '"></td>' +
            '<td class="num nowrap" data-mg><b class="' + (mg < 15 ? 'bad' : mg < 22 ? 'warn' : 'ok') + '">' + fmtN(mg, 1) + '%</b></td>' +
            '<td class="num nowrap" data-sub><b>' + money(i.unitPrice * i.qty * i.pax, st.currency) + '</b></td>' +
            '<td><button class="btn xs ghost" data-del title="Quitar ítem">' + I('trash') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      itemsEl.querySelectorAll('tr[data-k]').forEach(tr => {
        const i = st.items[+tr.dataset.k];
        tr.querySelectorAll('[data-f]').forEach(inp => {
          const f = inp.dataset.f;
          const ev = (f === 'date' || f === 'rateId' || f === 'segment') ? 'onchange' : 'oninput';
          inp[ev] = () => {
            if (f === 'date' || f === 'rateId') {
              i[f] = inp.value;
              if (f === 'date' && i.rateId) { const r = (Q.product(i.productId).rates || []).find(x => x.id === i.rateId); if (r && !rateValid(r, i.date)) { UI.toast('La tarifa ' + esc(r.id) + ' no está vigente el ' + date(i.date) + ' (PRD-BR-005). Seleccione otra tarifa.', 'bad'); i.rateId = ''; } }
              const r = i.rateId ? (Q.product(i.productId).rates || []).find(x => x.id === i.rateId) : null;
              if (r) { const sg = suggest(r, i.date, st.currency); i.unitCost = sg.cost; i.unitPrice = sg.price; if (r.segment === 'Niño') i.segment = 'Niño'; }
              drawItems(); return;
            }
            if (f === 'segment') { i.segment = inp.value; return; }
            i[f] = Math.max(0, num(inp.value));
            const mg = lineMargin(i);
            tr.querySelector('[data-mg]').innerHTML = '<b class="' + (mg < 15 ? 'bad' : mg < 22 ? 'warn' : 'ok') + '">' + fmtN(mg, 1) + '%</b>';
            tr.querySelector('[data-sub]').innerHTML = '<b>' + money(i.unitPrice * i.qty * i.pax, st.currency) + '</b>';
            drawTot();
          };
        });
        tr.querySelector('[data-del]').onclick = () => { st.items.splice(+tr.dataset.k, 1); drawItems(); };
      });
      drawTot();
    }
    function vObj() { return { items: st.items, discountPct: st.discountPct, taxPct: st.taxPct }; }
    function drawTot() {
      const t = Pricing.quoteTotals(vObj()); const cur = st.currency;
      const reasons = st.items.length ? needsInternal(vObj(), t) : [];
      const paxT = st.adt + st.chd + st.inf;
      totEl.innerHTML = '<div class="stat-line"><span class="muted">Costo total</span><b class="num">' + money(t.cost, cur) + '</b></div>' +
        '<div class="stat-line"><span class="muted">Venta bruta</span><b class="num">' + money(t.sale, cur) + '</b></div>' +
        '<div class="stat-line"><span class="muted">Descuento (' + fmtN(st.discountPct, 1) + '%)</span><b class="num">− ' + money(t.discount, cur) + '</b></div>' +
        '<div class="stat-line"><span class="muted">Valor de venta</span><b class="num">' + money(t.net, cur) + '</b></div>' +
        '<div class="stat-line"><span class="muted">IGV (' + fmtN(st.taxPct, 0) + '%)</span><b class="num">' + money(t.tax, cur) + '</b></div>' +
        '<div class="stat-line total"><span>Total</span><span class="num">' + money(t.total, cur) + '</span></div>' +
        '<div class="stat-line"><span class="muted">Utilidad bruta</span><b class="num ' + (t.profit < 0 ? 'bad' : '') + '">' + money(t.profit, cur) + '</b></div>' +
        '<div class="stat-line"><span class="muted">Margen</span><b class="num ' + (t.marginPct < 15 ? 'bad' : 'ok') + '">' + fmtN(t.marginPct, 1) + '%</b></div>' +
        (cur === 'USD' ? '<div class="stat-line"><span class="muted">Equivalente en soles</span><span class="num">' + money(toPEN(t.total, 'USD'), 'PEN') + '</span></div>' : '') +
        '<div class="stat-line"><span class="muted">Pasajeros</span><span>' + st.adt + ' ADT · ' + st.chd + ' CHD · ' + st.inf + ' INF</span></div>' +
        (paxT && t.total ? '<div class="stat-line"><span class="muted">Precio medio por pasajero</span><span class="num">' + money(t.total / Math.max(1, st.adt + st.chd), cur) + '</span></div>' : '') +
        (st.discountPct > MAX_DISC ? '<div style="margin-top:10px">' + UI.alert(can('quotes.discount_override') ? 'warn' : 'bad', '<b>Descuento sobre el tope de ' + MAX_DISC + '%.</b> ' + (can('quotes.discount_override') ? 'Usted tiene <span class="mono">quotes.discount_override</span>; quedará auditado.' : 'Requiere <span class="mono">quotes.discount_override</span> (Gerencia). No podrá guardar con este descuento.')) + '</div>' : '') +
        (reasons.length ? '<div style="margin-top:10px">' + UI.alert('warn', '<b>Requerirá aprobación de gerencia</b> antes del envío: ' + esc(reasons.join(' y ')) + '. ' + (can('quotes.approve_internal') ? 'Usted puede aprobarla (<span class="mono">quotes.approve_internal</span>).' : 'Tras guardar, use “Solicitar aprobación a gerencia”.')) + '</div>' : '');
      itinEl.innerHTML = itinHtml(st.items);
      const ft = el.querySelector('#qb-foot');
      if (ft) ft.innerHTML = '<span class="muted">' + st.items.length + ' ítem(s) · costo ' + money(t.cost, cur) + ' · venta ' + money(t.sale, cur) + '</span><span>Total <b>' + money(t.total, cur) + '</b> · margen <b class="' + (t.marginPct < 15 ? 'bad' : 'ok') + '">' + fmtN(t.marginPct, 1) + '%</b></span>';
    }
    function addProduct(p) {
      const blk = sellBlock(p); if (blk) { UI.toast(esc(blk), 'bad'); return; }
      const d = st.travelFrom || TODAY();
      const r = defaultRate(p, d, client());
      const it = { productId: p.id, date: d, qty: 1, pax: Math.max(1, st.adt + st.chd) || 1, unitCost: 0, unitPrice: 0, segment: 'Adulto', rateId: r ? r.id : '' };
      if (p.type === 'TRASLADO') { it.pax = 1; it.qty = 2; it.segment = 'Pasajero'; }
      if (r) { const sg = suggest(r, d, st.currency); it.unitCost = sg.cost; it.unitPrice = sg.price; }
      else UI.toast('El producto no tiene tarifas vigentes para ' + date(d) + '; ingrese precio manual.', 'warn');
      st.items.push(it); drawItems();
      UI.toast(esc(p.name) + ' agregado.' + (r ? ' Tarifa ' + esc(r.id) + (seasonOf(d) ? ' · ' + esc(seasonOf(d).name) : '') : ''));
    }
    function picker() {
      const list = DB.products.slice().sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || a.name.localeCompare(b.name));
      UI.modal({ title: 'Agregar producto del catálogo', sub: 'Se muestran todos los productos; solo los activos y cotizables pueden seleccionarse.', size: 'lg', body: '<div class="search-in" style="margin-bottom:10px">' + I('search') + '<input class="input" id="pk-q" placeholder="Buscar por nombre, código o destino…"></div><div class="pick-list list" id="pk-list"></div>', actions: [{ label: 'Cerrar' }],
        onOpen: (m) => {
          const draw = () => {
            const qv = m.querySelector('#pk-q').value.trim().toLowerCase();
            const rows = list.filter(p => !qv || (p.name + ' ' + p.code + ' ' + Q.destName(p.destId) + ' ' + p.type).toLowerCase().includes(qv));
            m.querySelector('#pk-list').innerHTML = rows.map(p => {
              const blk = sellBlock(p); const vr = (p.rates || []).filter(r => rateValid(r, st.travelFrom)); const from = vr.length ? Math.min(...vr.map(r => conv(r.price, r.currency, st.currency))) : null;
              return '<div class="list-item ' + (blk ? 'dis' : 'click') + '" data-p="' + p.id + '"><div class="ico-box ' + (blk ? 'bad' : '') + '">' + I(blk ? 'lock' : 'box') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:600">' + esc(p.name) + '</div><div class="xs faint">' + esc(p.code + ' · ' + p.type + ' · ' + Q.destName(p.destId) + ' · ' + (MODEL[p.availabilityModel] || '')) + '</div>' + (blk ? '<div class="xs bad">' + esc(blk) + '</div>' : !vr.length ? '<div class="xs warn">Sin tarifas vigentes para ' + date(st.travelFrom) + ' (PRD-BR-005): precio manual</div>' : '') + '</div><div class="right">' + UI.badge(p.status) + (from != null ? '<div class="xs faint" style="margin-top:3px">desde ' + money(from, st.currency, 0) + '</div>' : '') + '</div></div>';
            }).join('') || UI.empty('Sin coincidencias', 'search');
            m.querySelectorAll('[data-p]').forEach(row => row.onclick = () => { const p = Q.product(row.dataset.p); const blk = sellBlock(p); if (blk) { UI.toast(esc(blk), 'bad'); return; } UI.closeModal(); addProduct(p); });
          };
          m.querySelector('#pk-q').oninput = draw; draw();
        } });
    }
    function save() {
      st.notes = el.querySelector('#qb-notes').value.trim(); st.conditions = el.querySelector('#qb-cond').value.trim();
      if (!UI.validate(gen)) return;
      if (st.travelTo < st.travelFrom) { UI.toast('La fecha de fin del viaje no puede ser anterior al inicio.', 'bad'); return; }
      if (st.adt + st.chd + st.inf <= 0) { UI.toast('Indique al menos un pasajero.', 'bad'); return; }
      if (st.discountPct > MAX_DISC && !can('quotes.discount_override')) { UI.toast('Tope de descuento: ' + MAX_DISC + '%. Superarlo requiere el permiso quotes.discount_override (Gerencia). Ajuste el descuento o solicite a su gerente.', 'bad'); return; }
      if (!st.items.length) { UI.toast('Agregue al menos un ítem del catálogo.', 'bad'); return; }
      for (const i of st.items) {
        const p = Q.product(i.productId); const blk = sellBlock(p);
        if (blk) { UI.toast(esc(p ? p.name : i.productId) + ': ' + esc(blk), 'bad'); return; }
        const r = i.rateId ? (p.rates || []).find(x => x.id === i.rateId) : null;
        if (r && !rateValid(r, i.date)) { UI.toast('Tarifa ' + esc(r.id) + ' no vigente para ' + date(i.date) + ' (PRD-BR-005).', 'bad'); return; }
        if (!(i.pax > 0) || !(i.qty > 0)) { UI.toast('Cantidad y pax deben ser mayores a cero.', 'bad'); return; }
        if (!(i.unitPrice > 0)) { UI.toast('Indique el precio unitario de ' + esc(p.name) + '.', 'bad'); return; }
      }
      const items = st.items.map(i => ({ productId: i.productId, date: i.date, qty: i.qty, pax: i.pax, unitCost: round2(i.unitCost), unitPrice: round2(i.unitPrice), segment: i.segment || 'Adulto', rateId: i.rateId || '' }));
      const t = Pricing.quoteTotals({ items, discountPct: st.discountPct, taxPct: st.taxPct });
      const policies = {}; items.forEach(i => { const p = Q.product(i.productId); if (p) policies[p.id] = clone(p.policies); });
      const vData = { items, markupPct: round2(t.cost ? (t.sale / t.cost - 1) * 100 : 0), discountPct: st.discountPct, taxPct: st.taxPct, notes: st.notes, conditions: st.conditions, snapshot: snapshotOf(items), policies };
      const common = { clientId: st.clientId, oppId: st.oppId || null, title: st.title, travelFrom: st.travelFrom, travelTo: st.travelTo, validUntil: st.validUntil, currency: st.currency, pax: { adt: st.adt, chd: st.chd, inf: st.inf } };
      let q;
      if (editing) {
        q = quote; const v = curV(q); const before = money(Pricing.quoteTotals(v).total, q.currency);
        Object.assign(q, common); Object.assign(v, vData, { date: TODAY(), user: Auth.user.id }); delete v.internalApproval; if (v.approvalRequest && v.approvalRequest.status === 'pendiente') { v.approvalRequest.status = 'anulada'; Audit.log('Cotización', q.id, 'anular_solicitud_aprobacion', 'pendiente', 'versión editada'); } delete v.approvalRequest;
        Audit.log('Cotización', q.id, 'editar_version', 'v' + v.v + ' ' + before, 'v' + v.v + ' ' + money(t.total, q.currency));
      } else {
        q = Object.assign({ id: Seq.next('Cotización'), status: 'borrador', currentVersion: 1, owner: Auth.user.id, createdAt: TODAY(), viewedAt: null, token: null, sends: [], negotiations: [] }, common);
        q.versions = [Object.assign({ v: 1, date: TODAY(), user: Auth.user.id, status: 'borrador' }, vData)];
        DB.quotes.unshift(q);
        Audit.log('Cotización', q.id, 'crear', '', 'borrador v1 · ' + money(t.total, q.currency) + ' · ' + vData.snapshot);
        if (st.discountPct > MAX_DISC) Audit.log('Cotización', q.id, 'descuento_sobre_tope', 'tope ' + MAX_DISC + '%', fmtN(st.discountPct, 1) + '% (quotes.discount_override)');
        const o = q.oppId ? Q.opportunity(q.oppId) : null;
        if (o && ['calificacion', 'descubrimiento'].includes(o.stage)) { const b = o.stage; o.stage = 'cotizacion'; o.probability = 55; Audit.log('Oportunidad', o.id, 'cambio_etapa', b, 'cotizacion'); }
      }
      Store.save();
      UI.toast('Cotización ' + esc(q.id) + ' guardada como borrador (v' + q.currentVersion + ').');
      App.go('#/cotizaciones/' + q.id);
    }
    bindActs(el, { save, add: picker });
    drawGen(); drawItems();
  }

  /* ======================================================================
     COTIZACIONES — Detalle
     ====================================================================== */
  function renderQuote(el, q) {
    const v = curV(q); const t = Pricing.quoteTotals(v); const cli = Q.client(q.clientId) || {};
    const exp = isExpired(q); const res = resOfQuote(q); const reasons = needsInternal(v, t);
    const d = daysFromToday(q.validUntil);
    const ro = !can('quotes.create') && !can('quotes.send') && !can('reservations.create');
    const iaPend = OPEN.includes(q.status) && !exp && needsIA(v); const req = pendReq(v);
    let acts = scopeCtl();
    if (!ro) {
      if (q.status === 'borrador') {
        acts += pbtn('Editar ítems', 'edit', '', 'edit', 'quotes.create');
        if (iaPend && canApproveV(v)) acts += pbtn('Aprobar internamente', 'shield', '', 'iaOk', 'quotes.approve_internal');
        else if (iaPend && !req) acts += pbtn('Solicitar aprobación a gerencia', 'shield', '', 'iaReq', 'quotes.create');
        acts += pbtn('Enviar al cliente', 'send', 'primary', 'send', 'quotes.send', iaPend ? 'Bloqueado: requiere aprobación de gerencia (' + reasons.join(' y ') + ')' : '');
      }
      if (SENT.includes(q.status) && !exp) acts += pbtn('Registrar negociación', 'handshake', '', 'nego', 'quotes.send') + pbtn('Rechazar', 'x', 'danger', 'reject', 'quotes.send') + pbtn('Aprobar (cliente)', 'fileCheck', 'primary', 'approve', 'reservations.create');
      if (exp) acts += pbtn('Aprobar (cliente)', 'fileCheck', '', 'approve', 'reservations.create', 'Cotización vencida: aprobación bloqueada') + pbtn('Crear nueva versión', 'layers', 'primary', 'newver', 'quotes.create');
      if (q.status === 'aprobada') acts += pbtn('Convertir en reserva', 'suitcase', 'sun', 'convert', 'reservations.create');
    }
    if (q.status === 'convertida' && res && Access.canRoute('reservas')) acts += '<a class="btn" href="#/reservas/' + res.id + '">' + I('suitcase') + 'Ver reserva</a>';
    acts += '<button class="btn icon" data-a="more" title="Más acciones" aria-label="Más acciones">' + I('more') + '</button>';

    el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: esc(q.title), subtitle: '<span class="mono">' + esc(q.id) + '</span> · versión vigente v' + v.v + ' · ' + (exp && q.status !== 'vencida' ? UI.badge('vencida') : UI.badge(q.status)) + (req ? ' ' + UI.badge('pendiente', 'Pendiente de aprobación de gerencia') : '') + ' · ' + clientLink(q.clientId), crumbs: [['Inicio', '#/dashboard'], ['Ventas'], ['Cotizaciones', '#/cotizaciones'], [q.id]], actions: acts }) +
      (exp ? UI.alert('bad', '<b>Cotización vencida el ' + date(q.validUntil) + '.</b> Excepción “Cotización vencida → Bloquear aprobación → Nueva versión”: la aprobación está bloqueada. Genere una nueva versión con precios y validez actualizados.') : '') +
      (q.status === 'convertida' && res ? UI.alert('ok', 'Convertida en la reserva <a href="#/reservas/' + res.id + '"><b>' + esc(res.id) + '</b></a> desde la versión v' + (res.quoteVersion || v.v) + (q.approvedAt ? ' · aprobada por ' + esc(q.approvedBy || '') + ' el ' + datetime(q.approvedAt) : '') + '.') : '') +
      (q.status === 'aprobada' ? UI.alert('ok', '<b>Aprobada por ' + esc(q.approvedBy || 'el cliente') + '</b> el ' + datetime(q.approvedAt) + (q.approvalEvidence ? ' · evidencia: ' + esc(q.approvalEvidence.channel) + ' (' + esc(q.approvalEvidence.ref) + ')' : '') + '. La versión v' + v.v + ' es inmutable. Siguiente paso: convertir en reserva (PROC-025).') : '') +
      (q.status === 'rechazada' ? UI.alert('bad', '<b>Rechazada por el cliente.</b> Motivo: ' + esc(q.rejectedReason || '—') + (q.rejectedAt ? ' · ' + datetime(q.rejectedAt) : '')) : '') +
      (ro ? roNote('Puede revisar versiones, pricing y el documento. No puede editar, enviar ni aprobar (requiere <span class="mono">quotes.create</span>, <span class="mono">quotes.send</span> o <span class="mono">reservations.create</span>).') : '') +
      '<div id="q-appr">' + approvalBanner(q, v, reasons, exp) + '</div>' +
      '<div class="card"><div class="card-b">' + qFlow(q) + '<div class="vt-facts">' +
      '<div><div class="k">Cliente</div><div class="v">' + clientLink(q.clientId) + '</div><div class="xs faint">' + esc(cli.segment || '') + '</div></div>' +
      '<div><div class="k">Oportunidad</div><div class="v">' + (q.oppId ? '<a href="#/crm/oportunidades/' + esc(q.oppId) + '">' + esc(q.oppId) + '</a>' : '—') + '</div><div class="xs faint">' + (q.oppId && Q.opportunity(q.oppId) ? UI.statusLabel(Q.opportunity(q.oppId).stage) : '') + '</div></div>' +
      '<div><div class="k">Viaje</div><div class="v">' + dateShort(q.travelFrom) + ' – ' + date(q.travelTo) + '</div><div class="xs faint">' + (q.pax.adt || 0) + ' ADT · ' + (q.pax.chd || 0) + ' CHD · ' + (q.pax.inf || 0) + ' INF</div></div>' +
      '<div><div class="k">Total v' + v.v + '</div><div class="v">' + money(t.total, q.currency) + '</div><div class="xs faint">' + (seeMargin(q) ? 'Margen ' + fmtN(t.marginPct, 1) + '%' : 'Desc. ' + fmtN(v.discountPct || 0, 1) + '%') + '</div></div>' +
      '<div><div class="k">Validez</div><div class="v ' + (exp ? 'bad' : d <= 3 && OPEN.includes(q.status) ? 'warn' : '') + '">' + date(q.validUntil) + '</div><div class="xs faint">' + (exp ? 'Vencida' : OPEN.includes(q.status) ? 'vence en ' + d + ' día(s)' : '—') + '</div></div>' +
      '<div><div class="k">Vendedor</div><div class="v">' + UI.userChip(q.owner) + '</div></div>' +
      '</div></div></div><div id="q-tabs"></div></div>';

    const tabs = [
      { id: 'ver', label: 'Versiones', count: q.versions.length, render: (b) => tabVersions(b, q) },
      { id: 'items', label: 'Detalle e ítems', count: v.items.length, render: (b) => tabItems(b, q) },
      seeMargin(q) ? { id: 'pricing', label: 'Pricing', render: (b) => tabPricing(b, q) } : null,
      { id: 'doc', label: 'Documento', render: (b) => { b.innerHTML = '<div class="row between" style="margin-bottom:12px"><span class="small muted">Vista previa del documento profesional de la versión v' + v.v + ' (formato de impresión).</span><button class="btn sm" data-a="pdf">' + I('download') + 'Descargar PDF</button></div>' + quoteDoc(q, v); b.querySelector('[data-a="pdf"]').onclick = () => docModal(q, v); } },
      { id: 'send', label: 'Envío y seguimiento', render: (b) => tabSend(b, q) },
      { id: 'act', label: 'Actividad', count: DB.audit.filter(a => a.entityId === q.id).length, render: (b) => tabActivity(b, q) }
    ].filter(Boolean);
    UI.tabs(el.querySelector('#q-tabs'), tabs, tabs.some(x => x.id === tabMem[q.id]) ? tabMem[q.id] : 'ver', { onChange: (id) => { tabMem[q.id] = id; } });
    bindScope(el);
    bindActs(el.querySelector('#q-appr'), { iaOk: () => decideApproval(q, true), iaNo: () => decideApproval(q, false), iaReq: () => requestApproval(q) });

    bindActs(el.querySelector('.ph'), {
      edit: () => { if (need('quotes.create')) App.go('#/cotizaciones/' + q.id + '/editar'); },
      send: () => sendModal(q), nego: () => negoModal(q), approve: () => approveModal(q), reject: () => rejectQuote(q),
      newver: () => newVersion(q), convert: () => convertModal(q),
      iaOk: () => decideApproval(q, true), iaReq: () => requestApproval(q),
      more: (b) => {
        const items = [{ label: 'Vista de impresión (PDF)', icon: 'file', onClick: () => docModal(q, curV(q)) }];
        if (can('quotes.create')) items.push({ label: 'Duplicar cotización', icon: 'copy', onClick: () => duplicate(q) }, { label: 'Crear nueva versión', icon: 'layers', onClick: () => newVersion(q) });
        items.push({ label: 'Comparar versiones', icon: 'scale', onClick: () => compareModal(q) });
        const sendItems = can('quotes.send') ? [{ label: 'Registrar apertura del enlace (vista)', icon: 'eye', onClick: () => registerView(q) }, { label: 'Rechazar (motivo obligatorio)', icon: 'x', onClick: () => rejectQuote(q) }] : [];
        const supItems = isSup() ? [{ label: 'Reasignar asesor', icon: 'user', onClick: () => reassign('Cotización', q) }] : [];
        if (sendItems.length || supItems.length) items.push('-');
        UI.menu(b, items.concat(sendItems, supItems));
      }
    });
  }

  /* ---- Aprobación interna de gerencia (descuento > 5 % / margen < 15 % / tope de descuento) ---- */
  function approvalBanner(q, v, reasons, exp) {
    const ar = v.approvalRequest;
    if (!OPEN.includes(q.status) || exp || !reasons.length) return '';
    if (v.internalApproval) return UI.alert('ok', '<b>Aprobada por gerencia</b>: ' + esc(Q.userName(v.internalApproval.by)) + ' · ' + datetime(v.internalApproval.ts) + (v.internalApproval.reason ? ' · “' + esc(v.internalApproval.reason) + '”' : '') + '.');
    const gate = q.status === 'borrador' ? 'el envío al cliente' : 'el registro de la aprobación del cliente';
    const why = esc(reasons.join(' y ')) + (overCap(v) ? '; además supera el tope de ' + MAX_DISC + '% (requiere <span class="mono">quotes.discount_override</span>)' : '');
    if (ar && ar.status === 'pendiente') {
      const who = 'Solicitada por <b>' + esc(Q.userName(ar.by)) + '</b> el ' + datetime(ar.ts) + (ar.note ? ' · “' + esc(ar.note) + '”' : '');
      const tail = canApproveV(v) ? '<div class="row" style="margin-top:8px;gap:8px">' + pbtn('Aprobar', 'checkCircle', 'sm primary', 'iaOk', 'quotes.approve_internal') + pbtn('Rechazar', 'x', 'sm danger', 'iaNo', 'quotes.approve_internal') + '</div>'
        : can('quotes.approve_internal') ? '<div class="xs" style="margin-top:4px">El descuento supera el tope: solo un usuario con <span class="mono">quotes.discount_override</span> puede aprobarla.</div>'
        : '<div class="xs" style="margin-top:4px">Gerencia fue notificada. ' + gate.charAt(0).toUpperCase() + gate.slice(1) + ' queda bloqueado hasta su decisión.</div>';
      return UI.alert('warn', '<b>Pendiente de aprobación de gerencia</b> (' + why + '). ' + who + '.' + tail);
    }
    const rej = ar && ar.status === 'rechazada' ? '<b>Solicitud rechazada</b> por ' + esc(Q.userName(ar.decidedBy)) + ' el ' + datetime(ar.decidedAt) + (ar.decisionNote ? ': “' + esc(ar.decisionNote) + '”' : '') + '. Ajuste la cotización y vuelva a solicitar. ' : '';
    const btn = canApproveV(v) ? '<div class="row" style="margin-top:8px">' + pbtn('Aprobar internamente', 'shield', 'sm primary', 'iaOk', 'quotes.approve_internal') + '</div>'
      : (can('quotes.create') || can('quotes.send')) ? '<div class="row" style="margin-top:8px">' + pbtn('Solicitar aprobación a gerencia', 'shield', 'sm primary', 'iaReq', null) + '</div>' : '';
    return UI.alert(rej ? 'bad' : 'warn', rej + '<b>Requiere aprobación de gerencia</b> antes de ' + gate + ': ' + why + ' (permiso <span class="mono">quotes.approve_internal</span>).' + btn);
  }
  function requestApproval(q) {
    const v = curV(q); const reasons = needsInternal(v);
    if (!can('quotes.create') && !can('quotes.send')) { need('quotes.create'); return; }
    if (own() && q.owner !== me()) { UI.toast('Solo el asesor dueño de la cotización puede solicitar su aprobación.', 'bad'); return; }
    if (!reasons.length || v.internalApproval) { UI.toast('La versión v' + v.v + ' no requiere aprobación interna.', 'info'); return; }
    if (pendReq(v)) { UI.toast('Ya existe una solicitud pendiente para v' + v.v + '.', 'warn'); return; }
    UI.modal({ title: 'Solicitar aprobación a gerencia', size: 'sm', sub: esc(q.id) + ' · v' + v.v + ' · ' + money(Pricing.quoteTotals(v).total, q.currency),
      body: UI.alert('warn', 'Motivo del control: <b>' + esc(reasons.join(' y ')) + '</b>' + (overCap(v) ? ' · supera el tope de ' + MAX_DISC + '%' : '') + '.') + '<div style="margin-top:12px">' + UI.form([{ id: 'ar-note', label: 'Justificación comercial', type: 'textarea', rows: 3, required: true, col: 12, placeholder: 'Ej.: cliente corporativo recurrente; la competencia ofrece 8% de descuento.' }]) + '</div><p class="xs faint" style="margin-top:8px">Se notificará a Gerencia. Hasta su decisión la cotización no puede enviarse al cliente.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Enviar solicitud', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const note = m.querySelector('#ar-note').value.trim();
        v.approvalRequest = { by: me(), ts: nowStr(), v: v.v, reasons, note, status: 'pendiente' };
        Audit.log('Cotización', q.id, 'solicitar_aprobacion_interna', 'v' + v.v + ' · ' + reasons.join(', '), 'pendiente de gerencia · ' + note);
        managers().forEach(u => Notify.push('cotizacion.aprobacion_solicitada', 'Portal', u, 'Aprobar ' + q.id + ' v' + v.v + ' (' + reasons.join(', ') + ') — solicitado por ' + Auth.user.name));
        Store.save(); UI.toast('Solicitud enviada a Gerencia. Estado: pendiente de aprobación.', 'warn'); App.render();
      } }] });
  }
  function decideApproval(q, approve) {
    if (!need('quotes.approve_internal')) return;
    const v = curV(q); const reasons = needsInternal(v); const ar = v.approvalRequest;
    if (approve && overCap(v) && !can('quotes.discount_override')) { UI.toast('El descuento ' + fmtN(v.discountPct, 1) + '% supera el tope de ' + MAX_DISC + '%: requiere quotes.discount_override.', 'bad'); return; }
    UI.confirm({ title: (approve ? 'Aprobar' : 'Rechazar') + ' — ' + esc(q.id) + ' v' + v.v, message: 'Motivo del control: <b>' + esc(reasons.join(' y ') || 'revisión de pricing') + '</b>.' + (ar && ar.status === 'pendiente' ? '<br>Solicitud de ' + esc(Q.userName(ar.by)) + (ar.note ? ': “' + esc(ar.note) + '”' : '') : '') + '<br>La decisión queda auditada y se notifica al asesor.', confirmLabel: approve ? 'Aprobar' : 'Rechazar solicitud', danger: !approve, reason: true, reasonLabel: approve ? 'Justificación' : 'Motivo del rechazo',
      onConfirm: (r) => {
        if (approve) { v.internalApproval = { by: me(), ts: nowStr(), reason: r, override: true, overCap: overCap(v) }; if (ar && ar.status === 'pendiente') Object.assign(ar, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: r }); Audit.log('Cotización', q.id, 'aprobacion_interna', 'v' + v.v + ' ' + reasons.join(', '), 'aprobada: ' + r + (overCap(v) ? ' · override de tope' : '')); }
        else { if (ar) Object.assign(ar, { status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: r }); else v.approvalRequest = { by: q.owner, ts: nowStr(), v: v.v, reasons, note: '', status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: r }; Audit.log('Cotización', q.id, 'rechazar_aprobacion_interna', 'v' + v.v + ' ' + reasons.join(', '), 'rechazada: ' + r); }
        if (q.owner !== me()) Notify.push('cotizacion.aprobacion_' + (approve ? 'aprobada' : 'rechazada'), 'Portal', q.owner, q.id + ' v' + v.v + ': gerencia ' + (approve ? 'aprobó' : 'rechazó') + ' la solicitud' + (r ? ' — ' + r : ''));
        Store.save(); UI.toast(approve ? 'Aprobación interna registrada para v' + v.v + '. Ya puede enviarse al cliente.' : 'Solicitud rechazada; se notificó al asesor.', approve ? 'ok' : 'warn'); App.render();
      } });
  }

  /* ---- Pestaña Versiones ---- */
  function tabVersions(b, q) {
    const sm = seeMargin(q);
    b.innerHTML = UI.alert('info', 'PROC-022: cada cambio genera una nueva versión (v1 → v2 → v3) que conserva servicios, pasajeros, fechas, precios, moneda, condiciones, descuentos, impuestos y snapshot del catálogo. <b>Una versión aprobada es inmutable</b> (Regla transversal 7).') +
      '<div class="card" style="margin-top:12px"><div class="card-h"><div><div class="t">Historial de versiones</div><div class="s">Versión vigente: v' + q.currentVersion + '</div></div><div class="row"><button class="btn sm" data-a="cmp"' + (q.versions.length < 2 ? ' disabled' : '') + '>' + I('scale') + 'Comparar versiones</button>' + (can('quotes.create') ? pbtn('Crear nueva versión', 'layers', 'sm primary', 'nv', 'quotes.create') : '') + '</div></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Versión</th><th>Fecha</th><th>Usuario</th><th class="num">Ítems</th><th class="num">Total</th>' + (sm ? '<th class="num">Margen</th>' : '') + '<th class="num">Desc.</th><th>Snapshot</th><th>Estado</th><th></th></tr></thead><tbody>' +
      q.versions.slice().reverse().map(v => { const t = Pricing.quoteTotals(v); return '<tr><td><b class="mono">v' + v.v + '</b>' + (v.v === q.currentVersion ? ' <span class="tag">vigente</span>' : '') + (v.status === 'aprobada' ? ' <span class="xs faint">' + I('lock') + '</span>' : '') + '</td><td class="nowrap">' + date(v.date) + '</td><td>' + UI.userChip(v.user) + '</td><td class="num">' + v.items.length + '</td><td class="num nowrap"><b>' + money(t.total, q.currency) + '</b></td>' + (sm ? '<td class="num ' + (t.marginPct < 15 ? 'bad' : '') + '">' + fmtN(t.marginPct, 1) + '%</td>' : '') + '<td class="num">' + fmtN(v.discountPct || 0, 1) + '%</td><td class="xs mono">' + esc(v.snapshot || '') + '</td><td>' + UI.badge(v.status) + '</td><td><button class="btn xs" data-view="' + v.v + '">' + I('eye') + 'Ver</button></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    b.querySelector('[data-a="cmp"]').onclick = () => compareModal(q);
    const nvb = b.querySelector('[data-a="nv"]'); if (nvb) nvb.onclick = () => newVersion(q);
    b.querySelectorAll('[data-view]').forEach(x => x.onclick = () => viewVersion(q, q.versions.find(v => v.v === +x.dataset.view)));
  }
  function itemsTable(v, cur, withMargin, withCost) {
    const t = Pricing.quoteTotals(v);
    return '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Producto</th><th>Fecha</th><th>Segmento</th><th class="num">Cant.</th><th class="num">Pax</th>' + (withCost ? '<th class="num">Costo unit.</th>' : '') + '<th class="num">Precio unit.</th><th class="num">Subtotal</th>' + (withMargin ? '<th class="num">Margen</th>' : '') + '</tr></thead><tbody>' +
      t.lines.map(l => { const mg = l.saleTotal ? (l.saleTotal - l.costTotal) / l.saleTotal * 100 : 0; return '<tr><td><div class="cell-main">' + prodLink(l.productId) + '</div><div class="cell-sub">' + esc(l.rateId || 'precio manual/histórico') + '</div></td><td class="nowrap">' + date(l.date) + '</td><td>' + esc(l.segment || 'Adulto') + '</td><td class="num">' + l.qty + '</td><td class="num">' + l.pax + '</td>' + (withCost ? '<td class="num">' + money(l.unitCost, cur) + '</td>' : '') + '<td class="num">' + money(l.unitPrice, cur) + '</td><td class="num"><b>' + money(l.saleTotal, cur) + '</b></td>' + (withMargin ? '<td class="num ' + (mg < 15 ? 'bad' : '') + '">' + fmtN(mg, 1) + '%</td>' : '') + '</tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="' + (withCost ? 7 : 6) + '">Total (neto ' + money(t.net, cur) + ' + IGV ' + money(t.tax, cur) + ')</td><td class="num">' + money(t.total, cur) + '</td>' + (withMargin ? '<td class="num">' + fmtN(t.marginPct, 1) + '%</td>' : '') + '</tr></tfoot></table></div>';
  }
  function viewVersion(q, v) {
    UI.drawer({ title: esc(q.id) + ' · versión v' + v.v, sub: UI.statusLabel(v.status) + ' · ' + date(v.date) + ' · ' + esc(Q.userName(v.user)), wide: true,
      body: (v.status === 'aprobada' ? UI.alert('ok', 'Versión aprobada: <b>inmutable</b>. Solo lectura (PROC-022).', 'lock') : v.v !== q.currentVersion ? UI.alert('info', 'Versión histórica (' + UI.statusLabel(v.status) + '). Consultable, no editable (PRD-BR-017).') : '') +
        '<div style="margin-top:12px">' + itemsTable(v, q.currency, seeMargin(q), seeMargin(q)) + '</div><div class="grid g2" style="margin-top:14px"><div>' + UI.dl([['Descuento', fmtN(v.discountPct || 0, 1) + '%'], ['IGV', fmtN(v.taxPct || 0, 0) + '%'], seeMargin(q) ? ['Markup medio', fmtN(v.markupPct || 0, 1) + '%'] : null, ['Snapshot', '<span class="mono xs">' + esc(v.snapshot || '') + '</span>']]) + '</div><div>' + UI.dl([['Notas', esc(v.notes || '')], ['Condiciones', esc(v.conditions || '')], ['Aprobación interna', v.internalApproval ? esc(Q.userName(v.internalApproval.by)) + ' · ' + datetime(v.internalApproval.ts) : '—']]) + '</div></div>' +
        '<div class="section-title" style="margin-top:16px">Itinerario de la versión</div>' + itinHtml(v.items),
      actions: [{ label: 'Vista de documento', icon: 'file', onClick: () => docModal(q, v) }, { label: 'Cerrar', cls: 'primary' }] });
  }
  function compareModal(q) {
    if (q.versions.length < 2) { UI.toast('La cotización tiene una sola versión.', 'info'); return; }
    const vs = q.versions.map(v => v.v);
    const a0 = vs[vs.length - 2], b0 = vs[vs.length - 1];
    const sel = (id, val) => '<select class="input sm" id="' + id + '" style="width:auto">' + vs.map(n => '<option value="' + n + '"' + (n === val ? ' selected' : '') + '>v' + n + ' · ' + UI.statusLabel(q.versions.find(x => x.v === n).status) + '</option>').join('') + '</select>';
    UI.modal({ title: 'Comparar versiones — ' + esc(q.id), size: 'xl', sub: 'Diferencias resaltadas: amarillo = cambio, verde = línea nueva, rojo = línea retirada.',
      body: '<div class="row" style="margin-bottom:12px"><span class="small muted">Comparar</span>' + sel('cmp-a', a0) + '<span class="small muted">con</span>' + sel('cmp-b', b0) + '</div><div id="cmp-out"></div>', actions: [{ label: 'Cerrar', cls: 'primary' }],
      onOpen: (m) => {
        const draw = () => {
          const A = q.versions.find(x => x.v === +m.querySelector('#cmp-a').value), B = q.versions.find(x => x.v === +m.querySelector('#cmp-b').value);
          const ta = Pricing.quoteTotals(A), tb = Pricing.quoteTotals(B); const cur = q.currency;
          const keys = []; const idx = (lines) => { const cnt = {}; return lines.map(l => { const k = lineKey(l); cnt[k] = (cnt[k] || 0) + 1; const kk = k + '#' + cnt[k]; if (!keys.includes(kk)) keys.push(kk); return [kk, l]; }); };
          const ma = new Map(idx(ta.lines)), mb = new Map(idx(tb.lines));
          const cell = (l, other, f, fmt) => { const val = l ? fmt(l[f]) : '—'; const chg = l && other && l[f] !== other[f]; return '<td class="num' + (chg ? ' df-chg' : '') + '">' + val + '</td>'; };
          const rows = keys.map(k => { const la = ma.get(k), lb = mb.get(k); const cls = !la ? 'df-add' : !lb ? 'df-del' : ''; const l = la || lb; const dlt = (lb ? lb.saleTotal : 0) - (la ? la.saleTotal : 0);
            return '<tr class="' + cls + '"><td><div class="cell-main">' + esc(Q.productName(l.productId)) + '</div><div class="cell-sub">' + esc(l.segment || 'Adulto') + (!la ? ' · nueva en v' + B.v : !lb ? ' · retirada en v' + B.v : '') + '</div></td>' +
              cell(la, lb, 'date', dateShort) + cell(la, lb, 'pax', x => x) + cell(la, lb, 'unitPrice', x => money(x, cur)) + cell(la, lb, 'saleTotal', x => money(x, cur)) +
              cell(lb, la, 'date', dateShort) + cell(lb, la, 'pax', x => x) + cell(lb, la, 'unitPrice', x => money(x, cur)) + cell(lb, la, 'saleTotal', x => money(x, cur)) +
              '<td class="num ' + (dlt > 0 ? 'ok' : dlt < 0 ? 'bad' : 'faint') + '">' + (dlt ? (dlt > 0 ? '+' : '−') + money(Math.abs(dlt), cur) : '—') + '</td></tr>'; }).join('');
          const sumRow = (lbl, va, vb, fmt, better) => { const chg = va !== vb; const dd = vb - va; return '<tr><td>' + lbl + '</td><td class="num' + (chg ? ' df-chg' : '') + '">' + fmt(va) + '</td><td class="num' + (chg ? ' df-chg' : '') + '">' + fmt(vb) + '</td><td class="num ' + (!chg ? 'faint' : (better ? dd > 0 : dd < 0) ? 'ok' : 'bad') + '">' + (chg ? (dd > 0 ? '+' : '−') + fmt(Math.abs(dd)) : '—') + '</td></tr>'; };
          m.querySelector('#cmp-out').innerHTML = '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th rowspan="2">Línea</th><th colspan="4" class="center">v' + A.v + ' · ' + esc(UI.statusLabel(A.status)) + '</th><th colspan="4" class="center">v' + B.v + ' · ' + esc(UI.statusLabel(B.status)) + '</th><th rowspan="2" class="num">Δ subtotal</th></tr><tr><th class="num">Fecha</th><th class="num">Pax</th><th class="num">P. unit.</th><th class="num">Subtotal</th><th class="num">Fecha</th><th class="num">Pax</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="grid g2" style="margin-top:14px"><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Concepto</th><th class="num">v' + A.v + '</th><th class="num">v' + B.v + '</th><th class="num">Diferencia</th></tr></thead><tbody>' +
            sumRow('Venta bruta', ta.sale, tb.sale, x => money(x, cur), true) + sumRow('Descuento %', A.discountPct || 0, B.discountPct || 0, x => fmtN(x, 1) + '%', false) + sumRow('IGV %', A.taxPct || 0, B.taxPct || 0, x => fmtN(x, 0) + '%', false) + sumRow('Total', ta.total, tb.total, x => money(x, cur), true) + (seeMargin(q) ? sumRow('Costo', ta.cost, tb.cost, x => money(x, cur), false) + sumRow('Utilidad', ta.profit, tb.profit, x => money(x, cur), true) + sumRow('Margen', ta.marginPct, tb.marginPct, x => fmtN(x, 1) + '%', true) : '') +
            '</tbody></table></div><div>' + UI.dl([['Notas v' + A.v, '<span class="' + (A.notes !== B.notes ? 'df-chg' : '') + '">' + esc(A.notes || '—') + '</span>'], ['Notas v' + B.v, '<span class="' + (A.notes !== B.notes ? 'df-chg' : '') + '">' + esc(B.notes || '—') + '</span>'], ['Snapshot v' + A.v, '<span class="mono xs">' + esc(A.snapshot || '') + '</span>'], ['Snapshot v' + B.v, '<span class="mono xs ' + (A.snapshot !== B.snapshot ? 'df-chg' : '') + '">' + esc(B.snapshot || '') + '</span>']]) + '</div></div>';
        };
        m.querySelector('#cmp-a').onchange = draw; m.querySelector('#cmp-b').onchange = draw; draw();
      } });
  }

  /* ---- Pestaña Ítems ---- */
  function tabItems(b, q) {
    const v = curV(q); const editable = v.status === 'borrador';
    b.innerHTML = (editable ? UI.alert('info', 'La versión v' + v.v + ' está en <b>borrador</b>' + (can('quotes.create') ? ': puede editar ítems, precios, pasajeros y condiciones antes de enviarla.' : '.')) : UI.alert(v.status === 'aprobada' ? 'ok' : 'warn', 'Versión v' + v.v + ' en estado <b>' + esc(UI.statusLabel(v.status)) + '</b>: solo lectura. Para modificar, cree una nueva versión (PROC-022); la actual quedará como “reemplazada”.', v.status === 'aprobada' ? 'lock' : null)) +
      '<div class="grid g-2-1" style="margin-top:12px;align-items:start">' + UI.card('Ítems de la versión v' + v.v, itemsTable(v, q.currency, false, seeMargin(q)), { tight: true, actions: !can('quotes.create') ? '' : editable ? pbtn('Editar ítems', 'edit', 'sm primary', 'ed', 'quotes.create') : pbtn('Crear nueva versión', 'layers', 'sm', 'nv', 'quotes.create') }) +
      '<div class="stack">' + UI.card('Condiciones de la versión', UI.dl([['Moneda', q.currency + (q.currency === 'USD' ? ' (TC ' + DB.settings.fx + ')' : '')], ['Pasajeros', (q.pax.adt || 0) + ' ADT · ' + (q.pax.chd || 0) + ' CHD · ' + (q.pax.inf || 0) + ' INF'], ['Snapshot', '<span class="mono xs">' + esc(v.snapshot || '') + '</span>'], ['Notas', esc(v.notes || '')], ['Condiciones', esc(v.conditions || 'Condiciones estándar de la agencia')]])) +
      UI.card('Itinerario resumido', itinHtml(v.items)) + '</div></div>';
    bindActs(b, { ed: () => { if (need('quotes.create')) App.go('#/cotizaciones/' + q.id + '/editar'); }, nv: () => newVersion(q) });
  }

  /* ---- Pestaña Pricing ---- */
  function tabPricing(b, q) {
    const v = curV(q); const t = Pricing.quoteTotals(v); const cur = q.currency; const reasons = needsInternal(v, t); const ia = v.internalApproval;
    const maxS = Math.max(...t.lines.map(l => l.saleTotal), 1);
    b.innerHTML = '<div class="grid g-2-1" style="align-items:start">' +
      UI.card('Desglose por línea (v' + v.v + ')', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="num">Costo total</th><th class="num">Venta total</th><th class="num">Utilidad</th><th style="width:160px">Margen</th></tr></thead><tbody>' +
        t.lines.map(l => { const pr = l.saleTotal - l.costTotal; const mg = l.saleTotal ? pr / l.saleTotal * 100 : 0; return '<tr><td><div class="cell-main">' + esc(Q.productName(l.productId)) + '</div><div class="cell-sub">' + esc(l.segment || 'Adulto') + ' · ' + l.qty + ' × ' + l.pax + ' pax · ' + dateShort(l.date) + (seasonOf(l.date) ? ' · ' + esc(seasonOf(l.date).type) + ' ×' + fmtN(seasonOf(l.date).factor, 2) : '') + '</div></td><td class="num">' + money(l.costTotal, cur) + '</td><td class="num">' + money(l.saleTotal, cur) + '<div style="margin-top:4px">' + UI.progress(l.saleTotal / maxS * 100) + '</div></td><td class="num ' + (pr < 0 ? 'bad' : '') + '">' + money(pr, cur) + '</td><td><div class="row between xs"><span class="' + (mg < 15 ? 'bad' : 'ok') + '"><b>' + fmtN(mg, 1) + '%</b></span></div>' + UI.progress(Math.max(0, mg) * 2.5, mg < 15 ? 'sun' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>', { tight: true, sub: 'Costo + markup − descuento + impuestos = precio final (calculado en backend, PRD-BR-010)' }) +
      '<div class="stack">' + UI.card('Totales', '<div class="stat-line"><span class="muted">Costo total</span><b>' + money(t.cost, cur) + '</b></div><div class="stat-line"><span class="muted">Venta bruta</span><b>' + money(t.sale, cur) + '</b></div><div class="stat-line"><span class="muted">Descuento ' + fmtN(v.discountPct || 0, 1) + '%</span><b>− ' + money(t.discount, cur) + '</b></div><div class="stat-line"><span class="muted">Valor de venta</span><b>' + money(t.net, cur) + '</b></div><div class="stat-line"><span class="muted">IGV ' + fmtN(v.taxPct || 0, 0) + '%</span><b>' + money(t.tax, cur) + '</b></div><div class="stat-line total"><span>Total</span><span>' + money(t.total, cur) + '</span></div><div class="stat-line"><span class="muted">Utilidad</span><b>' + money(t.profit, cur) + '</b></div><div class="stat-line"><span class="muted">Margen sobre venta neta</span><b class="' + (t.marginPct < 15 ? 'bad' : 'ok') + '">' + fmtN(t.marginPct, 1) + '%</b></div>' + (cur === 'USD' ? '<div class="stat-line"><span class="muted">Total en soles (TC ' + DB.settings.fx + ')</span><span>' + money(toPEN(t.total, 'USD'), 'PEN') + '</span></div>' : '')) +
      UI.card('Aprobación interna', '<div class="chk-list">' + ck((v.discountPct || 0) <= 5 ? true : 'warn', 'Descuento ≤ 5%', 'Actual ' + fmtN(v.discountPct || 0, 1) + '%. Si supera 5% requiere aprobación.') + ck(t.marginPct >= 15 ? true : 'warn', 'Margen ≥ 15%', 'Actual ' + fmtN(t.marginPct, 1) + '%. Si es menor requiere aprobación.') +
        ck(!overCap(v) ? true : 'warn', 'Tope de descuento ' + MAX_DISC + '%', 'Superarlo requiere quotes.discount_override.') + '</div>' +
        (!reasons.length ? '<div style="margin-top:10px">' + UI.alert('ok', 'No requiere aprobación interna.') + '</div>' : ia ? '<div style="margin-top:10px">' + UI.alert('ok', '<b>Aprobada internamente</b> por ' + esc(Q.userName(ia.by)) + ' el ' + datetime(ia.ts) + (ia.override ? ' (override auditado)' : '') + '. Justificación: ' + esc(ia.reason) + '.') + '</div>' : '<div style="margin-top:10px" id="pr-appr">' + (OPEN.includes(q.status) && !isExpired(q) ? approvalBanner(q, v, reasons, false) : '<span class="xs faint">Versión cerrada: no admite aprobación interna.</span>') + '</div>')) +
      '</div></div>';
    bindActs(b, { iaOk: () => decideApproval(q, true), iaNo: () => decideApproval(q, false), iaReq: () => requestApproval(q) });
  }
  function internalApprove(q, after) {
    if (!need('quotes.approve_internal')) return;
    if (overCap(curV(q)) && !can('quotes.discount_override')) { UI.toast('El descuento supera el tope de ' + MAX_DISC + '%: requiere quotes.discount_override.', 'bad'); return; }
    const v = curV(q); const reasons = needsInternal(v);
    UI.confirm({ title: 'Aprobación interna — ' + esc(q.id) + ' v' + v.v, message: 'Motivo del control: <b>' + esc(reasons.join(' y ') || 'revisión de pricing') + '</b>. La aprobación queda auditada como override de política comercial.', confirmLabel: 'Aprobar internamente', reason: true, reasonLabel: 'Justificación',
      onConfirm: (r) => { v.internalApproval = { by: Auth.user.id, ts: nowStr(), reason: r, override: true }; if (pendReq(v)) Object.assign(v.approvalRequest, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: r }); Audit.log('Cotización', q.id, 'aprobacion_interna', 'v' + v.v + ' ' + reasons.join(', '), 'override: ' + r); Store.save(); UI.toast('Aprobación interna registrada para v' + v.v + '.'); if (after) setTimeout(after, 0); else App.render(); } });
  }

  /* ---- Pestaña Envío y seguimiento (PROC-023) ---- */
  function tabSend(b, q) {
    const c = Q.client(q.clientId) || {};
    const ev = [];
    (q.sends || []).forEach(s => ev.push({ ts: s.ts, icon: s.channel === 'WhatsApp' ? 'msg' : s.channel === 'Portal' ? 'globe' : 'mail', title: 'Enviada por ' + esc(s.channel) + ' (v' + s.v + ')', meta: datetime(s.ts) + ' · ' + esc(Q.userName(s.by)) + ' → ' + esc(s.to) }));
    if (!(q.sends || []).length && q.token && q.status !== 'borrador') ev.push({ ts: (q.versions.find(x => x.v === q.currentVersion) || {}).date + ' 09:00', icon: 'send', title: 'Enviada al cliente (registro de carga inicial)', meta: date(curV(q).date) });
    if (q.viewedAt) ev.push({ ts: q.viewedAt, icon: 'eye', title: 'Vista por el cliente', meta: datetime(q.viewedAt) + ' · apertura del enlace con token' });
    (q.negotiations || []).forEach(n => ev.push({ ts: n.ts, icon: 'handshake', title: 'Negociación (' + esc(n.channel) + ')', meta: datetime(n.ts) + ' · ' + esc(Q.userName(n.by)), desc: esc(n.note) }));
    if (q.approvedAt) ev.push({ ts: q.approvedAt, icon: 'fileCheck', title: 'Aprobada por ' + esc(q.approvedBy || 'cliente'), meta: datetime(q.approvedAt), desc: q.approvalEvidence ? 'Evidencia: ' + esc(q.approvalEvidence.channel) + ' — ' + esc(q.approvalEvidence.ref) : '' });
    if (q.rejectedAt || q.status === 'rechazada') ev.push({ ts: q.rejectedAt || '', icon: 'x', title: 'Rechazada', meta: q.rejectedAt ? datetime(q.rejectedAt) : '', desc: esc(q.rejectedReason || '') });
    ev.sort((a, b2) => String(b2.ts).localeCompare(String(a.ts)));
    const acts = DB.activities.filter(a => a.relId === q.id || (q.oppId && a.relId === q.oppId));
    b.innerHTML = '<div class="grid g2" style="align-items:start"><div class="stack">' +
      UI.card('Enlace seguro de la cotización', q.token ? UI.dl([['Token', '<span class="mono">' + esc(q.token) + '</span>'], ['Enlace', '<span class="mono xs">' + esc(portalUrl(q)) + '</span>'], ['Versión publicada', 'v' + q.currentVersion + ' · ' + UI.statusLabel(curV(q).status)], ['Expira', date(q.validUntil) + (isExpired(q) ? ' ' + UI.badge('vencida') : '')], ['Última vista', q.viewedAt ? datetime(q.viewedAt) : 'Aún no abierta']]) : UI.empty('Aún no se ha generado el enlace. Se genera al enviar la cotización.', 'link'),
        { actions: (q.token ? '<button class="btn sm" data-a="copy">' + I('copy') + 'Copiar enlace</button>' : '') + (can('quotes.send') ? pbtn(q.token ? 'Regenerar' : 'Generar enlace', 'link', 'sm', 'tok', 'quotes.send') : '') }) +
      (can('quotes.send') ? UI.card('Enviar al cliente', '<p class="small muted" style="margin-bottom:10px">Se valida la versión, se adjunta el documento y se registra el envío. Destinatario: <b>' + esc(c.name || '') + '</b></p>' + (OPEN.includes(q.status) && needsIA(curV(q)) ? UI.alert('warn', 'Envío bloqueado: ' + (pendReq(curV(q)) ? 'pendiente de aprobación de gerencia.' : 'requiere aprobación de gerencia (' + esc(needsInternal(curV(q)).join(' y ')) + ').')) + '<div style="height:10px"></div>' : '') + '<div class="row">' + pbtn('Email · ' + (c.email || ''), 'mail', 'sm', 'em', 'quotes.send') + pbtn('WhatsApp · ' + (c.phone || ''), 'msg', 'sm', 'wa', 'quotes.send') + '</div><div class="divider" style="margin:12px 0"></div><div class="row between"><span class="small muted">Simular apertura del enlace por el cliente</span>' + pbtn('Registrar vista', 'eye', 'sm', 'view', 'quotes.send') + '</div>') : UI.card('Enviar al cliente', UI.empty('Su rol no envía cotizaciones (requiere quotes.send). Consulte el historial de envíos y visualizaciones.', 'lock'))) +
      '</div><div class="stack">' + UI.card('Seguimiento', UI.timeline(ev)) +
      UI.card('Actividades CRM relacionadas', acts.length ? '<div class="list">' + acts.map(a => '<a class="list-item click" href="#/crm/actividades" style="color:inherit;text-decoration:none"><div class="ico-box ' + (a.status === 'vencida' ? 'bad' : '') + '">' + I('calendar') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(a.subject) + '</div><div class="xs faint">' + esc(a.type) + ' · ' + datetime(a.due) + '</div></div>' + UI.badge(a.status) + '</a>').join('') + '</div>' : UI.empty('Sin actividades vinculadas', 'calendar'), { tight: true }) + '</div></div>';
    bindActs(b, {
      copy: () => UI.copy(portalUrl(q)),
      tok: () => { if (!need('quotes.send')) return; const old = q.token; q.token = newToken(); Audit.log('Cotización', q.id, old ? 'regenerar_token' : 'generar_token', old || '', q.token); Store.save(); UI.toast('Enlace seguro generado.'); App.render(); },
      em: () => sendModal(q, 'Email'), wa: () => sendModal(q, 'WhatsApp'), view: () => registerView(q)
    });
  }
  function tabActivity(b, q) {
    const au = DB.audit.filter(a => a.entityId === q.id || (a.entity === 'Reserva' && String(a.before).includes(q.id)));
    b.innerHTML = UI.card('Historial de auditoría', UI.timeline(au.map(a => ({ icon: a.action.includes('aprob') ? 'fileCheck' : a.action.includes('rechaz') ? 'x' : a.action.includes('envi') ? 'send' : a.action.includes('version') ? 'layers' : 'history', title: esc(a.action.replace(/_/g, ' ')) + ' <span class="xs faint mono">' + esc(a.id) + '</span>', meta: datetime(a.ts) + ' · ' + esc(Q.userName(a.user)) + ' · IP ' + esc(a.ip) + ' · ' + esc(a.corr), desc: (a.before ? esc(a.before) + ' → ' : '') + esc(a.after) }))), { sub: 'Registro inmutable (PROC-064): usuario, fecha, IP y correlación' });
  }

  /* ---- Acciones de cotización ---- */
  function sendModal(q, channel) {
    if (!need('quotes.send')) return;
    if (isExpired(q)) { UI.toast('Cotización vencida: cree una nueva versión antes de reenviar.', 'bad'); return; }
    if (['aprobada', 'convertida', 'rechazada'].includes(q.status)) { UI.toast('La cotización está ' + esc(UI.statusLabel(q.status)).toLowerCase() + '; no corresponde reenviarla.', 'warn'); return; }
    const v = curV(q); const reasons = needsInternal(v); const c = Q.client(q.clientId) || {};
    if (reasons.length && !v.internalApproval) {
      const pr = pendReq(v);
      UI.modal({ title: pr ? 'Pendiente de aprobación de gerencia' : 'Aprobación de gerencia requerida', size: 'sm', body: UI.alert('warn', 'PROC-021: la versión v' + v.v + ' requiere aprobación interna antes del envío (' + esc(reasons.join(' y ')) + ').' + (pr ? ' Solicitud enviada por ' + esc(Q.userName(pr.by)) + ' el ' + datetime(pr.ts) + '; aguarde la decisión de gerencia.' : '')), actions: [{ label: 'Cerrar' }].concat(canApproveV(v) ? [{ label: 'Aprobar internamente', cls: 'primary', onClick: () => { setTimeout(() => internalApprove(q, () => sendModal(q, channel)), 0); } }] : !pr ? [{ label: 'Solicitar aprobación a gerencia', cls: 'primary', icon: 'shield', onClick: () => { setTimeout(() => requestApproval(q), 0); } }] : []) });
      return;
    }
    if (!v.items.length) { UI.toast('La versión no tiene ítems.', 'bad'); return; }
    UI.modal({ title: 'Enviar ' + esc(q.id) + ' v' + v.v, sub: 'Generar documento → Validar versión → Token/enlace → Enviar → Registrar visualización (PROC-023)',
      body: '<div class="chk-list">' + ck(true, 'Versión validada', 'v' + v.v + ' · ' + v.items.length + ' ítem(s) · total ' + money(Pricing.quoteTotals(v).total, q.currency)) + ck(true, 'Documento generado', 'Plantilla profesional con itinerario, precios, políticas y validez') + ck(true, 'Enlace con token', q.token ? portalUrl(q) : 'Se generará un token único al enviar') + ck(daysFromToday(q.validUntil) >= 0 ? true : 'warn', 'Validez', 'Hasta ' + date(q.validUntil)) + '</div>' +
        '<div class="form-grid" style="margin-top:12px"><div class="c12"><label class="check"><input type="checkbox" id="sd-em"' + (channel !== 'WhatsApp' ? ' checked' : '') + '> Email a ' + esc(c.email || '') + '</label></div><div class="c12"><label class="check"><input type="checkbox" id="sd-wa"' + (channel === 'WhatsApp' ? ' checked' : '') + '> WhatsApp a ' + esc(c.phone || '') + '</label></div><div class="c12"><label class="check"><input type="checkbox" id="sd-pt" checked> Publicar en portal del cliente</label></div>' + UI.field({ id: 'sd-msg', label: 'Mensaje', type: 'textarea', col: 12, rows: 3, value: 'Estimado(a) ' + (c.contactName || c.name || '') + ', le compartimos la propuesta “' + q.title + '” (v' + v.v + '). Puede revisarla y aprobarla en línea desde el enlace adjunto. Quedamos atentos.' }) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Enviar', cls: 'primary', icon: 'send', onClick: (m) => {
        const chans = [['sd-em', 'Email', c.email], ['sd-wa', 'WhatsApp', c.phone], ['sd-pt', 'Portal', c.name]].filter(x => m.querySelector('#' + x[0]).checked);
        if (!chans.length) { UI.toast('Seleccione al menos un canal.', 'bad'); return false; }
        if (!q.token) q.token = newToken();
        const before = q.status;
        if (q.status === 'borrador') { q.status = 'enviada'; v.status = 'enviada'; if (daysFromToday(q.validUntil) < 0) q.validUntil = addDays(TODAY(), DB.settings.quoteValidityDays || 10); }
        q.sends = q.sends || [];
        chans.forEach(([, ch, to]) => { q.sends.push({ ts: nowStr(), channel: ch, to: to || '', by: Auth.user.id, v: v.v }); Notify.push('cotizacion.enviada', ch, to || c.name, 'Cotización ' + q.id + ' v' + v.v + ' — ' + q.title); });
        Audit.log('Cotización', q.id, 'enviar', before, q.status + ' v' + v.v + ' por ' + chans.map(x => x[1]).join('/'));
        Store.save(); UI.toast('Cotización enviada por ' + chans.map(x => x[1]).join(', ') + '.'); App.render();
      } }] });
  }
  function registerView(q) {
    if (!need('quotes.send')) return;
    if (!q.token || q.status === 'borrador') { UI.toast('Primero envíe la cotización para generar el enlace.', 'warn'); return; }
    const before = q.status; q.viewedAt = nowStr();
    if (q.status === 'enviada') { q.status = 'vista'; }
    Audit.log('Cotización', q.id, 'registrar_vista', before, q.status + ' · ' + q.viewedAt);
    Notify.push('cotizacion.vista', 'Portal', q.owner, q.id + ' fue abierta por el cliente');
    Store.save(); UI.toast('Vista registrada: ' + datetime(q.viewedAt) + '.'); App.render();
  }
  function negoModal(q) {
    if (!need('quotes.send')) return;
    UI.modal({ title: 'Registrar negociación — ' + esc(q.id), body: UI.form([
      { id: 'ng-ch', label: 'Canal', type: 'select', col: 6, options: ['Llamada', 'Reunión', 'Email', 'WhatsApp'] },
      { id: 'ng-date', label: 'Fecha y hora', col: 6, value: nowStr(), disabled: true },
      { id: 'ng-note', label: 'Resumen de la contrapropuesta del cliente', type: 'textarea', col: 12, rows: 3, required: true, placeholder: 'Ej.: solicita 8% de descuento y cambio a hotel 4* en Aguas Calientes' },
      { id: 'ng-nv', label: 'Crear nueva versión para ajustar la propuesta', type: 'checkbox', col: 12, value: false }
    ]), actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false;
      const f = UI.formData(m); const before = q.status;
      q.negotiations = q.negotiations || []; q.negotiations.push({ ts: nowStr(), by: Auth.user.id, channel: f['ng-ch'], note: f['ng-note'] });
      q.status = 'negociacion';
      const o = q.oppId ? Q.opportunity(q.oppId) : null; if (o && !['ganada', 'perdida', 'negociacion'].includes(o.stage)) { const bs = o.stage; o.stage = 'negociacion'; o.probability = 70; Audit.log('Oportunidad', o.id, 'cambio_etapa', bs, 'negociacion'); }
      Audit.log('Cotización', q.id, 'negociacion', before, 'negociacion · ' + f['ng-note']);
      Store.save(); UI.toast('Negociación registrada.');
      if (f['ng-nv']) setTimeout(() => newVersion(q, true), 0); else App.render();
    } }] });
  }
  function approveModal(q) {
    if (!need('reservations.create')) return;
    const v = curV(q);
    if (isExpired(q)) {
      UI.modal({ title: 'Aprobación bloqueada', size: 'sm', body: UI.alert('bad', '<b>Cotización vencida</b> el ' + date(q.validUntil) + '. Flujo de excepción: Consulta → Vencida → <b>Bloquear aprobación</b> → Nueva versión.') + '<p class="small muted" style="margin-top:10px">Genere una nueva versión con precios revisados y validez renovada; luego envíela nuevamente al cliente.</p>', actions: [{ label: 'Cerrar' }, { label: 'Crear nueva versión', cls: 'primary', icon: 'layers', onClick: () => { setTimeout(() => newVersion(q), 0); } }] });
      return;
    }
    if (!SENT.includes(q.status)) { UI.toast('Solo se aprueban cotizaciones enviadas, vistas o en negociación (estado actual: ' + esc(UI.statusLabel(q.status)) + ').', 'bad'); return; }
    const t = Pricing.quoteTotals(v); const reasons = needsInternal(v, t); const c = Q.client(q.clientId) || {};
    const pendIA = reasons.length && !v.internalApproval;
    if (pendIA && !canApproveV(v)) {
      const pr = pendReq(v);
      UI.modal({ title: 'Aprobación del cliente bloqueada', size: 'sm', body: UI.alert('warn', '<b>Requiere aprobación de gerencia</b>: ' + esc(reasons.join(' y ')) + (overCap(v) ? '; supera el tope de ' + MAX_DISC + '%' : '') + '. ' + (pr ? 'Solicitud pendiente desde ' + datetime(pr.ts) + '.' : 'Solicítela antes de registrar la aprobación del cliente.')), actions: [{ label: 'Cerrar' }].concat(!pr ? [{ label: 'Solicitar aprobación a gerencia', cls: 'primary', icon: 'shield', onClick: () => { setTimeout(() => requestApproval(q), 0); } }] : []) });
      return;
    }
    UI.modal({ title: 'Registrar aprobación del cliente', sub: esc(q.id) + ' · versión v' + v.v + ' · ' + money(t.total, q.currency),
      body: UI.alert('info', 'PROC-024: Cliente revisa → Aprobar → <b>Registrar timestamp</b> → <b>Evidencia</b> → Cambiar estado. La versión aprobada queda inmutable.') +
        (pendIA ? '<div style="margin-top:10px">' + UI.alert('warn', '<b>Falta aprobación interna</b> (' + esc(reasons.join(' y ')) + '). Puede registrarla en este mismo paso como override auditado.') + '</div>' : '') +
        '<div style="margin-top:12px">' + UI.form([
          { id: 'ap-by', label: 'Aprobado por (cliente)', col: 6, required: true, value: c.contactName || c.name || '' },
          { id: 'ap-ts', label: 'Fecha y hora (timestamp)', col: 6, value: nowStr(), disabled: true },
          { id: 'ap-ch', label: 'Evidencia', type: 'select', col: 6, options: ['Aceptación en portal (enlace con token)', 'Correo electrónico del cliente', 'Mensaje de WhatsApp', 'Firma de conformidad', 'Orden de compra / servicio'] },
          { id: 'ap-ref', label: 'Referencia de la evidencia', col: 6, required: true, placeholder: 'Ej.: correo del 29/09 09:40, OC 4500-8812' }
        ].concat(pendIA && can('quotes.approve_internal') ? [{ id: 'ap-ia', label: 'Registrar aprobación interna (override de política comercial)', type: 'checkbox', col: 12, value: true }, { id: 'ap-iar', label: 'Justificación de la aprobación interna', type: 'textarea', col: 12, rows: 2, required: true, value: v.notes && /aprob/i.test(v.notes) ? v.notes : '' }] : [])) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Aprobar versión v' + v.v, cls: 'primary', icon: 'fileCheck', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        if (pendIA) {
          if (!can('quotes.approve_internal')) { UI.toast('Bloqueado: la versión requiere aprobación interna (quotes.approve_internal).', 'bad'); return false; }
          if (!f['ap-ia']) { UI.toast('Marque la aprobación interna para continuar.', 'bad'); return false; }
          v.internalApproval = { by: Auth.user.id, ts: nowStr(), reason: f['ap-iar'], override: true };
          if (pendReq(v)) Object.assign(v.approvalRequest, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: f['ap-iar'] });
          Audit.log('Cotización', q.id, 'aprobacion_interna', 'v' + v.v + ' ' + reasons.join(', '), 'override: ' + f['ap-iar']);
        }
        const before = q.status;
        q.status = 'aprobada'; v.status = 'aprobada'; q.approvedAt = nowStr(); q.approvedBy = f['ap-by']; q.approvalEvidence = { channel: f['ap-ch'], ref: f['ap-ref'], by: Auth.user.id };
        Audit.log('Cotización', q.id, 'aprobar', before, 'aprobada v' + v.v + ' · ' + f['ap-by'] + ' · ' + f['ap-ch']);
        Notify.push('cotizacion.aprobada', 'Push', q.owner, q.id + ' aprobada por ' + f['ap-by']);
        Notify.push('cotizacion.aprobada', 'Email', c.email || c.name, 'Confirmamos la aprobación de su cotización ' + q.id);
        Store.save(); UI.toast('Cotización aprobada (v' + v.v + ' inmutable). Ya puede convertirla en reserva.'); App.render();
      } }] });
  }
  function rejectQuote(q) {
    if (!need('quotes.send')) return;
    if (!SENT.includes(q.status) && q.status !== 'vencida') { UI.toast('Solo se rechazan cotizaciones enviadas, vistas o en negociación.', 'bad'); return; }
    UI.confirm({ title: 'Rechazar ' + esc(q.id), message: 'Se registrará el rechazo del cliente sobre la versión v' + q.currentVersion + '. El motivo es obligatorio y alimenta el análisis de pérdidas.', confirmLabel: 'Registrar rechazo', danger: true, reason: true, reasonLabel: 'Motivo del rechazo',
      onConfirm: (r) => { const before = q.status; const v = curV(q); q.status = 'rechazada'; v.status = 'rechazada'; q.rejectedReason = r; q.rejectedAt = nowStr(); Audit.log('Cotización', q.id, 'rechazar', before, 'rechazada · ' + r); Notify.push('cotizacion.rechazada', 'Portal', q.owner, q.id + ' rechazada: ' + r); Store.save(); UI.toast('Rechazo registrado.', 'warn'); App.render(); } });
  }
  function newVersion(q, fromNego) {
    if (!need('quotes.create')) return;
    if (q.status === 'convertida') { UI.toast('La cotización ya fue convertida en reserva: la versión aprobada es inmutable (Regla transversal 7).', 'bad'); return; }
    const cv = curV(q);
    const go = () => {
      const n = Math.max(...q.versions.map(x => x.v)) + 1;
      const nv = clone(cv); delete nv.internalApproval; delete nv.approvalRequest;
      Object.assign(nv, { v: n, date: TODAY(), user: Auth.user.id, status: 'borrador', snapshot: snapshotOf(nv.items), notes: (fromNego ? 'Ajuste por negociación. ' : '') + (cv.notes || '') });
      const pol = {}; nv.items.forEach(i => { const p = Q.product(i.productId); if (p) pol[p.id] = clone(p.policies); }); nv.policies = pol;
      const before = q.status;
      cv.status = 'reemplazada'; q.versions.push(nv); q.currentVersion = n; q.status = 'borrador';
      delete q.approvedAt; delete q.approvedBy; delete q.approvalEvidence;
      if (daysFromToday(q.validUntil) < (DB.settings.quoteValidityDays || 10)) q.validUntil = addDays(TODAY(), DB.settings.quoteValidityDays || 10);
      Audit.log('Cotización', q.id, 'nueva_version', 'v' + cv.v + ' (' + before + ')', 'v' + n + ' borrador · ' + nv.snapshot);
      Store.save(); UI.toast('Versión v' + n + ' creada a partir de v' + cv.v + '. La anterior queda como “reemplazada”.');
      App.go('#/cotizaciones/' + q.id + '/editar');
    };
    UI.confirm({ title: 'Crear nueva versión', message: 'Se copiará la versión vigente v' + cv.v + ' (' + esc(UI.statusLabel(cv.status)) + ') a una nueva versión en borrador; v' + cv.v + ' quedará marcada como <b>reemplazada</b> y se conservará sin cambios. El snapshot del catálogo se recalcula (excepción “Cambio de catálogo posterior a cotización”).' + (q.status === 'aprobada' ? '<br><br><b>Atención:</b> la aprobación del cliente sobre v' + cv.v + ' dejará de ser la vigente y la nueva versión requerirá una nueva aprobación.' : ''), confirmLabel: 'Crear v' + (Math.max(...q.versions.map(x => x.v)) + 1), onConfirm: go });
  }
  function duplicate(q) {
    if (!need('quotes.create')) return;
    const v = curV(q);
    const nq = { id: Seq.next('Cotización'), clientId: q.clientId, oppId: q.oppId, title: q.title + ' (copia)', status: 'borrador', currentVersion: 1, validUntil: addDays(TODAY(), DB.settings.quoteValidityDays || 10), currency: q.currency, owner: Auth.user.id, createdAt: TODAY(), travelFrom: q.travelFrom, travelTo: q.travelTo, pax: clone(q.pax), viewedAt: null, token: null, sends: [], negotiations: [] };
    const nv = clone(v); delete nv.internalApproval; delete nv.approvalRequest; Object.assign(nv, { v: 1, date: TODAY(), user: Auth.user.id, status: 'borrador', snapshot: snapshotOf(nv.items) });
    nq.versions = [nv]; DB.quotes.unshift(nq);
    Audit.log('Cotización', nq.id, 'duplicar', q.id + ' v' + v.v, 'borrador v1'); Store.save();
    UI.toast('Duplicada como ' + esc(nq.id) + '.'); App.go('#/cotizaciones/' + nq.id);
  }

  /* ---- Conversión cotización → reserva (PROC-025) ---- */
  function servicesFromItem(it, cur, discPct, depId) {
    const p = Q.product(it.productId);
    const costT = it.unitCost * it.qty * it.pax, saleT = it.unitPrice * it.qty * it.pax * (1 - (discPct || 0) / 100);
    const comps = ((p && p.components) || []).filter(c => c.included !== false).map(c => ({ c, s: Q.service(c.serviceId) })).filter(x => x.s);
    const itin = (p && p.itinerary && p.itinerary[0] && p.itinerary[0].items) || [];
    if (!comps.length) return [{ id: uid('RS'), productId: it.productId, name: (p ? p.name : it.productId) + ' (' + it.pax + ' pax)', date: it.date, time: itin[0] ? itin[0].time : '—', providerId: p ? p.mainProviderId : null, status: 'pendiente', cost: round2(costT), price: round2(saleT), confirmationCode: '', pax: it.pax, depId: depId || null }];
    const w = comps.map(x => conv(x.s.cost, x.s.currency, cur) * (x.c.qty || 1) * (x.s.unit === 'pax' ? it.pax : 1));
    const W = sum(w, x => x) || 1;
    return comps.map((x, k) => ({ id: uid('RS'), productId: it.productId, serviceId: x.c.serviceId, name: x.s.name + (x.c.qty > 1 ? ' ×' + x.c.qty : ''), date: it.date, time: k === 0 && itin[0] ? itin[0].time : (x.c.notes && /\d{2}:\d{2}/.test(x.c.notes) ? /\d{2}:\d{2}/.exec(x.c.notes)[0] : '—'), providerId: x.s.providerId, status: 'pendiente', cost: round2(costT * w[k] / W), price: round2(saleT * w[k] / W), confirmationCode: '', pax: it.pax, depId: depId || null, required: x.c.required !== false }));
  }
  function createReceivables(r, why) {
    const a = round2(r.total * 0.4), b = round2(r.total - a);
    const due1 = minD(addDays(TODAY(), 3), maxD(TODAY(), r.travelFrom)); const due2 = maxD(TODAY(), addDays(r.travelFrom, -15));
    const c1 = { id: nextId('receivables', 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Anticipo 40% — ' + r.title, amount: a, currency: r.currency, due: due1, paid: 0, status: 'abierta' }; DB.receivables.unshift(c1);
    const c2 = { id: nextId('receivables', 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Saldo 60% — ' + r.title, amount: b, currency: r.currency, due: due2, paid: 0, status: 'abierta' }; DB.receivables.unshift(c2);
    Audit.log('Cuenta por cobrar', c1.id + '/' + c2.id, 'crear', why || r.id, r.currency + ' ' + fmtN(a) + ' + ' + fmtN(b));
    return [c1, c2];
  }
  const placeholderPax = (pax) => { const out = []; [['ADT', pax.adt || 0], ['CHD', pax.chd || 0], ['INF', pax.inf || 0]].forEach(([tp, n]) => { for (let i = 1; i <= n; i++) out.push({ name: 'Pasajero ' + tp + ' ' + i + ' (por completar)', doc: '', type: tp, nationality: '', birth: '', phone: '', diet: '', placeholder: true }); }); return out; };

  function convertModal(q) {
    if (!need('reservations.create')) return;
    const existing = resOfQuote(q);
    if (q.status === 'convertida' || existing) {
      UI.modal({ title: 'Conversión idempotente', size: 'sm', body: UI.alert('info', 'PROC-025 · Idempotencia: la cotización <b>' + esc(q.id) + '</b> ya fue convertida' + (existing ? ' en la reserva <b>' + esc(existing.id) + '</b> (v' + (existing.quoteVersion || '') + ', ' + esc(UI.statusLabel(existing.status)) + ')' : '') + '. No se creará una reserva duplicada.'), actions: [{ label: 'Cerrar' }].concat(existing ? [{ label: 'Ver reserva ' + existing.id, cls: 'primary', icon: 'suitcase', onClick: () => App.go('#/reservas/' + existing.id) }] : []) });
      Audit.log('Cotización', q.id, 'convertir_idempotente', 'solicitud repetida', existing ? existing.id : 'convertida');
      return;
    }
    if (q.status !== 'aprobada') { UI.toast('Regla transversal 3: solo una cotización aprobada puede generar reserva (estado actual: ' + esc(UI.statusLabel(q.status)) + ').', 'bad'); return; }
    const v = curV(q); const t = Pricing.quoteTotals(v); const cli = Q.client(q.clientId);
    const paxN = (q.pax.adt || 0) + (q.pax.chd || 0) + (q.pax.inf || 0);
    const checks = v.items.map(it => ({ it, av: availFor(it.productId, it.date, it.pax) }));
    const blocked = checks.filter(c => !c.av.ok);
    const prods = [...new Set(v.items.map(i => i.productId))];
    UI.modal({ title: 'Convertir en reserva — ' + esc(q.id), size: 'lg', sub: 'Quote aprobada → Idempotencia → Disponibilidad → Crear reserva → Copiar snapshot → Vincular quote/versión → Confirmar',
      body: '<div class="grid g2" style="align-items:start"><div><div class="section-title" style="margin-bottom:6px">Precondiciones (PROC-025)</div><div class="chk-list">' +
        ck(true, 'Cotización aprobada', 'Por ' + esc(q.approvedBy || '') + ' · ' + datetime(q.approvedAt)) +
        ck(true, 'Versión exacta v' + v.v, 'Snapshot ' + esc(v.snapshot || snapshotOf(v.items))) +
        ck(v.items.length > 0, 'Servicios', v.items.length + ' ítem(s) de ' + prods.length + ' producto(s)') +
        ck(paxN > 0, 'Pasajeros', (q.pax.adt || 0) + ' ADT · ' + (q.pax.chd || 0) + ' CHD · ' + (q.pax.inf || 0) + ' INF (se crean fichas por completar)') +
        ck(!!(q.travelFrom && q.travelTo), 'Fechas', date(q.travelFrom) + ' – ' + date(q.travelTo)) +
        ck(t.total > 0, 'Precios', 'Total ' + money(t.total, q.currency) + ' (neto ' + money(t.net, q.currency) + ')') +
        ck(true, 'Moneda', q.currency + (q.currency === 'USD' ? ' · TC ' + DB.settings.fx : '')) +
        ck(true, 'Condiciones', 'Políticas snapshot de ' + prods.length + ' producto(s); anticipo 40% / saldo 60%') +
        ck(!!cli, 'Cliente válido', esc(cli ? cli.name : 'no encontrado')) +
        '</div></div><div><div class="section-title" style="margin-bottom:6px">Verificación de disponibilidad</div><div class="chk-list">' +
        checks.map(c => ck(c.av.ok ? (c.av.hold ? 'warn' : true) : false, esc(Q.productName(c.it.productId)) + ' · ' + dateShort(c.it.date) + ' · ' + c.it.pax + ' pax', esc(c.av.msg) + (!c.av.ok ? altsHtml(c.av.alts) : ''))).join('') + '</div>' +
        (blocked.length ? '<div style="margin-top:10px">' + UI.alert('bad', '<b>Conversión bloqueada</b> (Regla transversal 4 · PRD-BR-012): ' + blocked.length + ' ítem(s) sin disponibilidad. Como la reserva debe respetar la versión exacta, ajuste la fecha a una salida alternativa creando una nueva versión y solicite nueva aprobación.') + '</div>' : '<div style="margin-top:10px">' + UI.alert('ok', 'Disponibilidad verificada. Se creará la reserva con servicios en estado <b>pendiente</b> de solicitud a proveedor, cuentas por cobrar (anticipo 40% / saldo 60%) y se marcará la oportunidad como ganada.') + '</div>') +
        '</div></div>',
      actions: [{ label: 'Cancelar' }].concat(blocked.length ? [{ label: 'Crear nueva versión con fecha alternativa', cls: 'primary', icon: 'layers', onClick: () => { setTimeout(() => newVersion(q), 0); } }] : [{ label: 'Convertir y confirmar reserva', cls: 'sun', icon: 'suitcase', onClick: () => { doConvert(q, checks); } }]) });
  }
  function doConvert(q, checks) {
    if (resOfQuote(q)) { UI.toast('Idempotencia: ya existe una reserva para esta cotización.', 'warn'); return; }
    const v = curV(q); const t = Pricing.quoteTotals(v); const cli = Q.client(q.clientId) || {};
    const id = Seq.next('Reserva');
    const services = [];
    checks.forEach(c => { const depId = c.av.dep ? c.av.dep.id : null; if (c.av.dep) { c.av.dep.sold += c.it.pax; setDepStatus(c.av.dep); } servicesFromItem(c.it, q.currency, v.discountPct, depId).forEach(s => services.push(s)); });
    const pol = {}; v.items.forEach(i => { const p = Q.product(i.productId); if (p) pol[p.id] = clone((v.policies && v.policies[p.id]) || p.policies); });
    const r = { id, quoteId: q.id, quoteVersion: v.v, clientId: q.clientId, title: q.title, status: 'confirmada', channel: segChannel(cli), travelFrom: q.travelFrom, travelTo: q.travelTo, currency: q.currency, total: round2(t.total), owner: q.owner, createdAt: nowStr(), sede: (Q.user(q.owner) || Auth.user).sede, notes: 'Generada desde ' + q.id + ' v' + v.v + '. ' + (v.notes || ''), snapshot: v.snapshot || snapshotOf(v.items), policies: pol, passengers: placeholderPax(q.pax), services, changes: [] };
    DB.reservations.unshift(r);
    createReceivables(r, q.id + ' v' + v.v);
    const bq = q.status; q.status = 'convertida'; q.reservationId = id;
    const o = q.oppId ? Q.opportunity(q.oppId) : null;
    if (o && o.stage !== 'ganada') { const bs = o.stage; o.stage = 'ganada'; o.probability = 100; o.closeDate = TODAY(); Audit.log('Oportunidad', o.id, 'cambio_etapa', bs, 'ganada (' + id + ')'); }
    Audit.log('Reserva', id, 'crear_desde_cotizacion', q.id + ' v' + v.v, 'confirmada · ' + money(r.total, r.currency));
    Audit.log('Cotización', q.id, 'convertir', bq, 'convertida → ' + id);
    Notify.push('reserva.confirmada', 'Email', cli.email || cli.name, 'Reserva ' + id + ' confirmada — ' + r.title);
    Notify.push('reserva.confirmada', 'Push', q.owner, 'Reserva ' + id + ' creada desde ' + q.id);
    Store.save(); UI.toast('Reserva ' + id + ' creada y confirmada desde ' + q.id + ' v' + v.v + '.');
    App.go('#/reservas/' + id);
  }

  /* ======================================================================
     RESERVAS — helpers
     ====================================================================== */
  const R_STEPS = ['Borrador', 'Pend. disponibilidad', 'Confirmada', 'En operación', 'Completada'];
  const rFlow = (r) => { const m = { borrador: 0, pendiente_disponibilidad: 1, confirmada: 2, pendiente_pago: 2, pendiente_proveedor: 2, reprogramada: 2, parcial: 2, incidencia: 3, en_operacion: 3, completada: 5 }; if (r.status === 'cancelada') return UI.flow(R_STEPS, 2, 2); return UI.flow(R_STEPS, m[r.status] != null ? m[r.status] : 2); };
  const CLOSED = ['cancelada', 'completada'];
  const saldoOf = (r) => round2(r.total - Q.resPaid(r.id));
  const activeSvcs = (r) => r.services.filter(s => !['cancelado'].includes(s.status) && !(s.status === 'rechazado' && s.replacedBy));
  const svcPax = (r, s) => s.pax || r.passengers.length;
  const uniqDeps = (r, svcs) => { const m = new Map(); svcs.forEach(s => { const x = depForService(s); if (!x) return; const pax = svcPax(r, s); const cur = m.get(x.d.id); if (!cur || cur.pax < pax) m.set(x.d.id, { x, pax, s }); }); return [...m.values()]; };
  const resPol = (r, productId) => (r.policies && r.policies[productId]) || ((Q.product(productId) || {}).policies) || {};
  function tiersFor(text) {
    text = String(text || '');
    if (/48 ?h/i.test(text) && /sin penalidad/i.test(text)) return [[2, 0], [0, 100]];
    if (/24 ?h/i.test(text) && /sin penalidad/i.test(text)) return [[1, 0], [0, 100]];
    if (/Tren:/i.test(text)) return [[15, 0], [7, 50], [2, 50], [0, 100]];
    return [[15, 0], [7, 50], [0, 100]];
  }
  const penaltyPct = (tiers, days) => { for (const [th, pct] of tiers) if (days >= th) return pct; return 100; };
  function svcAvailability(r, s) {
    const p = Q.product(s.productId);
    if (s.status === 'rechazado' && !s.replacedBy) return { ok: false, msg: 'Rechazado por proveedor sin alternativa' };
    if (['confirmado', 'completado'].includes(s.status)) return { ok: true, msg: 'Confirmado por proveedor' + (s.confirmationCode ? ' (' + s.confirmationCode + ')' : '') };
    if (p && p.status !== 'ACTIVE') return { ok: false, msg: 'PRD-BR-002: producto ' + UI.statusLabel(p.status) };
    const dp = depForService(s);
    if (dp) return dp.d.status === 'cerrada' ? { ok: false, msg: 'Salida ' + dp.d.id + ' cerrada' } : { ok: true, msg: 'Cupo retenido en salida ' + dp.d.id + ' (' + dp.d.sold + '/' + dp.d.capacity + ')' };
    if (p && p.availabilityModel === 'POR_SALIDA') { const av = availFor(p.id, s.date, svcPax(r, s)); return av.ok ? { ok: true, msg: av.msg } : { ok: false, msg: av.msg, alts: av.alts }; }
    return { ok: true, warn: true, msg: (p ? (MODEL[p.availabilityModel] || '') + ': ' : '') + (s.status === 'solicitado' ? 'solicitado al proveedor, pendiente de confirmación' : 'pendiente de solicitud al proveedor') };
  }

  /* ======================================================================
     RESERVAS — Lista
     ====================================================================== */
  let resView = 'lista'; let calMonth = null;
  function renderResList(el) {
    const R = scoped(DB.reservations);
    const opsView = can('operations.view') && !seeMargin(null);
    const ro = !can('reservations.create') && !can('reservations.modify') && !can('reservations.cancel');
    const onTrip = R.filter(r => r.status !== 'cancelada' && r.travelFrom <= TODAY() && r.travelTo >= TODAY());
    const pend = R.filter(r => ['pendiente_pago', 'pendiente_proveedor', 'pendiente_disponibilidad'].includes(r.status));
    const withSaldo = R.filter(r => !['cancelada', 'borrador'].includes(r.status) && saldoOf(r) > 0.5);
    el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: 'Reservas', subtitle: 'Reservas directas, corporativas, B2B y e-commerce: disponibilidad, pasajeros, servicios, pagos y operación (PROC-025 a PROC-030).', crumbs: [['Inicio', '#/dashboard'], ['Ventas'], ['Reservas']], actions: scopeCtl() + '<div class="btn-group"><button class="btn sm' + (resView === 'lista' ? ' on' : '') + '" data-v="lista">' + I('list') + 'Lista</button><button class="btn sm' + (resView === 'ocupacion' ? ' on' : '') + '" data-v="ocupacion">' + I('calendar') + 'Ocupación por fecha</button></div>' + (can('reservations.create') ? '<a class="btn primary" href="#/reservas/nueva">' + I('plus') + 'Nueva reserva directa</a>' : '') }) +
      (ro ? roNote(can('finance.receivables') ? 'Consulta enfocada en montos, cobros y pagos. Modificar, reprogramar o cancelar reservas requiere permisos de Reservas.' : 'Consulta de reservas.') : '') +
      (opsView ? UI.alert('info', 'Vista de Operaciones: pasajeros, servicios y costos de proveedor. Los importes de venta, márgenes y utilidad no se muestran para su rol.') : '') + advNote() +
      '<div class="grid g4">' +
      UI.kpi({ label: 'Confirmadas', value: R.filter(r => ['confirmada', 'reprogramada'].includes(r.status)).length, sub: sum(R.filter(r => r.status === 'confirmada'), r => r.passengers.length) + ' pasajeros', tone: 'ok', icon: 'checkCircle' }) +
      UI.kpi({ label: 'En operación', value: R.filter(r => r.status === 'en_operacion').length, sub: DB.operations.filter(o => o.status === 'en_ejecucion' && R.some(r => r.id === o.resId)).length + ' orden(es) en ejecución', tone: 'accent', icon: 'clipboard' }) +
      UI.kpi({ label: 'Pendientes pago / proveedor', value: pend.length, sub: withSaldo.length + ' con saldo por cobrar', tone: 'sun', icon: 'clock' }) +
      UI.kpi({ label: 'Pasajeros en viaje hoy', value: sum(onTrip, r => r.passengers.length), sub: onTrip.length + ' reserva(s) · ' + date(TODAY()), tone: 'info', icon: 'suitcase' }) +
      '</div><div id="r-body"></div></div>';
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { resView = b.dataset.v; renderResList(el); });
    bindScope(el);
    const body = el.querySelector('#r-body');
    if (resView === 'ocupacion') { renderOccupancy(body); return; }
    UI.dataTable(body, {
      rows: () => scoped(DB.reservations), exportName: 'reservas', defaultSort: 'createdAt', defaultDir: -1,
      search: r => [r.id, r.title, Q.clientName(r.clientId), r.quoteId, r.channel].join(' '), searchPlaceholder: 'Buscar código, cliente o cotización…',
      filters: [
        { label: 'Estado', options: ['borrador', 'pendiente_disponibilidad', 'confirmada', 'pendiente_pago', 'pendiente_proveedor', 'reprogramada', 'en_operacion', 'completada', 'cancelada'], key: 'status' },
        { label: 'Canal', options: [['Directo', 'Directo'], ['Corporativo', 'Corporativo'], ['B2B', 'B2B'], ['E-commerce', 'E-commerce']], key: 'channel' }
      ],
      onRow: r => App.go('#/reservas/' + r.id),
      columns: [
        { key: 'id', label: 'Código', render: r => '<span class="mono small">' + esc(r.id) + '</span>' + (r.quoteId ? '<div class="cell-sub mono">' + esc(r.quoteId) + ' v' + r.quoteVersion + '</div>' : '<div class="cell-sub">Reserva directa</div>') },
        { key: 'title', label: 'Reserva / cliente', render: r => '<div class="cell-main">' + esc(r.title) + '</div><div class="cell-sub">' + esc(Q.clientName(r.clientId)) + '</div>' },
        { key: 'channel', label: 'Canal', render: r => '<span class="tag">' + esc(r.channel) + '</span>' },
        { key: 'travelFrom', label: 'Viaje', render: r => '<span class="nowrap">' + dateShort(r.travelFrom) + ' – ' + dateShort(r.travelTo) + '</span><div class="cell-sub">' + (daysFromToday(r.travelFrom) > 0 ? 'en ' + daysFromToday(r.travelFrom) + ' d' : r.travelTo >= TODAY() && r.status !== 'cancelada' ? 'en curso' : 'pasado') + '</div>' },
        { key: 'pax', label: 'Pax', align: 'num', sortVal: r => r.passengers.length, render: r => r.passengers.length, csv: r => r.passengers.length },
        opsView ? { key: 'svc', label: 'Servicios conf.', align: 'num', sortVal: r => activeSvcs(r).filter(s => ['confirmado', 'completado'].includes(s.status)).length, render: r => { const a = activeSvcs(r); return a.filter(s => ['confirmado', 'completado'].includes(s.status)).length + ' / ' + a.length; }, csv: r => activeSvcs(r).length } : null,
        opsView ? { key: 'cost', label: 'Costo proveedores', align: 'num', sortVal: r => toPEN(Q.resCost(r), r.currency), render: r => money(Q.resCost(r), r.currency), csv: r => fmtN(Q.resCost(r)) } : null,
        opsView ? null : { key: 'total', label: 'Total', align: 'num', sortVal: r => toPEN(r.total, r.currency), render: r => '<b>' + money(r.total, r.currency) + '</b>' },
        opsView ? null : { key: 'saldo', label: 'Saldo', align: 'num', sortVal: r => toPEN(saldoOf(r), r.currency), render: r => { const s = r.status === 'cancelada' ? 0 : saldoOf(r); return s > 0.5 ? '<span class="warn">' + money(s, r.currency) + '</span>' : '<span class="ok">Pagado</span>'; }, csv: r => fmtN(saldoOf(r)) },
        own() ? null : { key: 'owner', label: 'Vendedor', render: r => '<span class="small nowrap">' + esc(Q.userName(r.owner)) + '</span>', sortVal: r => Q.userName(r.owner), csv: r => Q.userName(r.owner) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status) + (r.cancelRequest && r.cancelRequest.status === 'pendiente' ? '<div class="cell-sub warn">Anulación solicitada</div>' : ''), csv: r => UI.statusLabel(r.status) }
      ].filter(Boolean)
    });
  }
  function renderOccupancy(body) {
    if (!calMonth) calMonth = TODAY().slice(0, 7);
    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1); const days = new Date(y, m, 0).getDate(); const lead = (first.getDay() + 6) % 7;
    const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const act = scoped(DB.reservations).filter(r => r.status !== 'cancelada');
    const tone = { confirmada: '', en_operacion: 'violet', completada: 'info', borrador: 'info', pendiente_disponibilidad: 'bad', pendiente_pago: 'sun', pendiente_proveedor: 'sun', reprogramada: 'info' };
    let cells = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => '<div class="cal-h">' + d + '</div>').join('');
    for (let i = 0; i < lead; i++) cells += '<div class="cal-d out"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const ev = act.filter(r => r.travelFrom <= ds && r.travelTo >= ds);
      const pax = sum(ev, r => r.passengers.length);
      cells += '<div class="cal-d' + (ds === TODAY() ? ' today' : '') + '"><div class="row between"><span class="dn">' + d + '</span>' + (pax ? '<span class="xs faint">' + pax + ' pax</span>' : '') + '</div>' + ev.slice(0, 3).map(r => '<div class="cal-ev ' + (tone[r.status] || '') + '" data-res="' + r.id + '" title="' + esc(r.id + ' · ' + r.title + ' · ' + r.passengers.length + ' pax · ' + UI.statusLabel(r.status)) + '">' + esc(r.id.slice(-3) + ' ' + r.title) + '</div>').join('') + (ev.length > 3 ? '<div class="vt-more">+' + (ev.length - 3) + ' más</div>' : '') + '</div>';
    }
    const tot = (lead + days) % 7; if (tot) for (let i = tot; i < 7; i++) cells += '<div class="cal-d out"></div>';
    const next = []; for (let i = 0; i < 14; i++) { const ds = addDays(TODAY(), i); const ev = act.filter(r => r.travelFrom <= ds && r.travelTo >= ds); next.push({ ds, ev, pax: sum(ev, r => r.passengers.length) }); }
    const deps = DB.products.flatMap(p => (p.departures || []).map(d => ({ d, p }))).filter(x => daysFromToday(x.d.date) >= 0 && daysFromToday(x.d.date) <= 14).sort((a, b) => a.d.date.localeCompare(b.d.date));
    body.innerHTML = '<div class="grid g-2-1" style="align-items:start">' +
      UI.card('Ocupación por fecha de viaje — ' + MES[m - 1] + ' ' + y, '<div class="cal vt-cal">' + cells + '</div><div class="legend" style="margin-top:10px"><span><i style="background:var(--accent)"></i>Confirmada</span><span><i style="background:var(--violet)"></i>En operación</span><span><i style="background:var(--sun)"></i>Pendiente pago/proveedor</span><span><i style="background:var(--info)"></i>Borrador / reprogramada / completada</span><span><i style="background:var(--bad)"></i>Pend. disponibilidad</span></div>', { actions: '<button class="btn sm icon" data-m="-1" aria-label="Mes anterior">' + I('chevronLeft') + '</button><button class="btn sm" data-m="0">Hoy</button><button class="btn sm icon" data-m="1" aria-label="Mes siguiente">' + I('chevronRight') + '</button>' }) +
      '<div class="stack">' + UI.card('Pasajeros en viaje · próximos 14 días', UI.chart.hbars({ items: next.map(n => ({ label: dateShort(n.ds) + (n.ev.length ? ' · ' + n.ev.length + ' reserva(s)' : ''), value: n.pax, display: n.pax + ' pax' })) })) +
      UI.card('Salidas con cupos (14 días)', deps.length ? '<div class="list">' + deps.map(x => { const pct = x.d.sold / x.d.capacity * 100; return '<div class="list-item"><div class="grow"><div class="row between small"><b>' + esc(x.p.name) + '</b><span class="num">' + x.d.sold + '/' + x.d.capacity + '</span></div><div class="xs faint" style="margin:2px 0 6px">' + esc(x.d.id) + ' · ' + date(x.d.date) + ' · ' + esc(x.d.time) + ' · ' + UI.statusLabel(x.d.status) + '</div>' + UI.progress(pct, pct >= 100 ? 'sun' : '') + '</div></div>'; }).join('') + '</div>' : UI.empty('Sin salidas programadas'), { tight: true, actions: '<a class="btn sm ghost" href="#/catalogo/salidas">Salidas ' + I('arrowRight') + '</a>' }) + '</div></div>';
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const k = +b.dataset.m; if (!k) calMonth = TODAY().slice(0, 7); else { const dd = new Date(y, m - 1 + k, 1); calMonth = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0'); } renderOccupancy(body); });
    body.querySelectorAll('[data-res]').forEach(e => e.onclick = () => App.go('#/reservas/' + e.dataset.res));
  }

  /* ======================================================================
     RESERVAS — Nueva reserva directa
     ====================================================================== */
  function renderNewRes(el) {
    if (!can('reservations.create')) { el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: 'Nueva reserva', crumbs: [['Ventas'], ['Reservas', '#/reservas'], ['Nueva']] }) + UI.alert('warn', 'Su rol no tiene el permiso <b>reservations.create</b>.') + '</div>'; return; }
    const st = { clientId: '', channel: 'Directo', owner: Auth.user.id, productId: '', rateId: '', date: addDays(TODAY(), 7), depId: '', adt: 2, chd: 0, inf: 0, notes: '' };
    el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: 'Nueva reserva directa', subtitle: 'Reserva sin cotización previa: cliente, producto, fecha o salida con cupos y pasajeros. Se valida disponibilidad antes de confirmar (PROC-026, PRD-BR-012).', crumbs: [['Inicio', '#/dashboard'], ['Ventas'], ['Reservas', '#/reservas'], ['Nueva']], actions: '<a class="btn" href="#/reservas">Cancelar</a>' }) +
      '<div class="grid g-2-1" style="align-items:start"><div class="stack">' + UI.card('Cliente y canal', '<div id="nr-a"></div>') + UI.card('Producto, fecha y pasajeros', '<div id="nr-b"></div>') + '</div><div class="qb-sticky">' + UI.card('Disponibilidad y precio', '<div id="nr-c"></div>', { footer: '<div class="row end"><button class="btn" data-a="draft">' + I('file') + 'Guardar borrador</button><button class="btn primary" data-a="confirm">' + I('check') + 'Crear y confirmar</button></div>' }) + '</div></div></div>';
    const A = el.querySelector('#nr-a'), B = el.querySelector('#nr-b'), C = el.querySelector('#nr-c');
    A.innerHTML = UI.form([
      { id: 'nr-client', label: 'Cliente', type: 'select', col: 6, required: true, placeholder: 'Seleccione…', options: DB.clients.filter(c => { const cs = Scope.clientIds(); return !cs || cs.has(c.id); }).map(c => [c.id, c.name + ' · ' + c.segment]), hint: own() ? 'Clientes de su cartera' : '' },
      { id: 'nr-channel', label: 'Canal', type: 'select', col: 3, value: 'Directo', options: ['Directo', 'Corporativo', 'B2B', 'E-commerce'] },
      { id: 'nr-owner', label: 'Vendedor', type: 'select', col: 3, value: Auth.user.id, options: own() ? [[me(), Auth.user.name]] : DB.users.filter(u => ['sales', 'manager', 'tenant_admin', 'operations'].includes(u.role) && u.status === 'activo').map(u => [u.id, u.name]) },
      { id: 'nr-notes', label: 'Notas', type: 'textarea', col: 12, rows: 2, placeholder: 'Requerimientos especiales, hotel de recojo, número de vuelo…' }
    ]) + '<div class="xs faint" style="margin-top:8px">¿Cliente nuevo? Regístrelo primero en <a href="#/crm/clientes">Clientes 360</a>.</div>';
    A.querySelector('#nr-client').onchange = (e) => { st.clientId = e.target.value; const c = Q.client(st.clientId); if (c) { st.channel = segChannel(c); A.querySelector('#nr-channel').value = st.channel; } drawB(); };
    A.querySelector('#nr-channel').onchange = (e) => { st.channel = e.target.value; drawB(); };
    A.querySelector('#nr-owner').onchange = (e) => { st.owner = e.target.value; };
    const prodOpts = () => '<option value="">Seleccione un producto…</option>' + DB.products.map(p => { const blk = p.status !== 'ACTIVE' ? 'PRD-BR-002 · ' + UI.statusLabel(p.status) : p.flags && p.flags.bookable === false ? 'no reservable' : ''; return '<option value="' + p.id + '"' + (p.id === st.productId ? ' selected' : '') + (blk ? ' disabled' : '') + '>' + esc(p.name) + (blk ? ' — ' + esc(blk) : '') + '</option>'; }).join('');
    function calc() {
      const p = Q.product(st.productId); if (!p) return null;
      const r = (p.rates || []).find(x => x.id === st.rateId); if (!r) return null;
      const d = st.depId ? (depById(st.depId) || {}).d : null; const ds = d ? d.date : st.date;
      const sa = suggest(r, ds, r.currency);
      const child = (p.rates || []).find(x => x.segment === 'Niño' && rateValid(x, ds) && x.channel === r.channel);
      const sc = child ? suggest(child, ds, r.currency) : sa;
      const price = round2(st.adt * sa.price + st.chd * sc.price); const cost = round2(st.adt * sa.cost + st.chd * sc.cost);
      return { p, r, ds, sa, sc, child, price, cost, cur: r.currency };
    }
    function drawB() {
      const p = Q.product(st.productId);
      const rates = p ? (p.rates || []) : [];
      const dsRef = st.depId ? ((depById(st.depId) || {}).d || {}).date : st.date;
      if (p && (!st.rateId || !rates.find(r => r.id === st.rateId && rateValid(r, dsRef)))) { const dr = rates.find(r => rateValid(r, dsRef) && r.channel === st.channel && r.segment !== 'Niño') || rates.find(r => rateValid(r, dsRef) && r.segment !== 'Niño'); st.rateId = dr ? dr.id : ''; }
      const byDep = p && p.availabilityModel === 'POR_SALIDA';
      const deps = byDep ? (p.departures || []).filter(d => daysFromToday(d.date) >= 0) : [];
      const paxN = st.adt + st.chd;
      B.innerHTML = '<div class="form-grid"><div class="field c12"><label for="nr-prod">Producto <span class="req">*</span></label><select class="input" id="nr-prod">' + prodOpts() + '</select><div class="hint">Productos inactivos, suspendidos o en borrador aparecen deshabilitados (PRD-BR-002).</div></div>' +
        (p ? '<div class="field c6"><label for="nr-rate">Tarifa</label><select class="input" id="nr-rate">' + (rates.length ? rates.map(r => { const ok = rateValid(r, dsRef); return '<option value="' + r.id + '"' + (r.id === st.rateId ? ' selected' : '') + (ok ? '' : ' disabled') + '>' + esc(r.id + ' · ' + r.type + ' ' + r.segment + ' · ' + r.channel + ' · ' + r.currency + ' ' + fmtN(r.price, 0)) + (ok ? '' : ' — no vigente (PRD-BR-005)') + '</option>'; }).join('') : '<option value="">Sin tarifas</option>') + '</select></div>' +
          (byDep ? '<div class="field c6"><label for="nr-dep">Salida programada <span class="req">*</span></label><select class="input" id="nr-dep"><option value="">Seleccione salida…</option>' + deps.map(d => { const fr = freeOf(d); const dis = d.status === 'cerrada' || fr < Math.max(1, paxN); return '<option value="' + d.id + '"' + (d.id === st.depId ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + esc(d.id + ' · ' + date(d.date) + ' ' + d.time + ' · ' + fr + '/' + d.capacity + ' libres') + (dis ? (fr <= 0 ? ' — completa' : ' — cupo insuficiente') : '') + '</option>'; }).join('') + '</select><div class="hint">Modelo por salida: se retienen cupos al crear la reserva.</div></div>' : '<div class="field c6"><label for="nr-date">Fecha del servicio <span class="req">*</span></label><input class="input" type="date" id="nr-date" value="' + esc(st.date) + '" min="' + TODAY() + '"><div class="hint">' + esc(MODEL[p.availabilityModel] || '') + ' · anticipación mínima ' + (p.advMin || 0) + ' día(s)</div></div>') : '') +
        '<div class="field c4"><label for="nr-adt">Adultos</label><input class="input" type="number" min="0" id="nr-adt" value="' + st.adt + '"></div><div class="field c4"><label for="nr-chd">Niños</label><input class="input" type="number" min="0" id="nr-chd" value="' + st.chd + '"></div><div class="field c4"><label for="nr-inf">Infantes</label><input class="input" type="number" min="0" id="nr-inf" value="' + st.inf + '"></div></div>' +
        (p ? '<div style="margin-top:12px" class="small muted">' + esc(p.short || '') + ' · ' + esc(p.durationValue + ' ' + p.durationUnit) + ' · ' + esc(p.minPax + '–' + p.maxPax + ' pax') + (p.minAge ? ' · edad mínima ' + p.minAge : '') + '</div>' : '');
      B.querySelector('#nr-prod').onchange = (e) => { st.productId = e.target.value; st.rateId = ''; st.depId = ''; drawB(); };
      const rs = B.querySelector('#nr-rate'); if (rs) rs.onchange = (e) => { st.rateId = e.target.value; drawC(); };
      const dp = B.querySelector('#nr-dep'); if (dp) dp.onchange = (e) => { st.depId = e.target.value; drawB(); };
      const dt = B.querySelector('#nr-date'); if (dt) dt.onchange = (e) => { st.date = e.target.value; drawB(); };
      ['adt', 'chd', 'inf'].forEach(k => { B.querySelector('#nr-' + k).onchange = (e) => { st[k] = Math.max(0, num(e.target.value)); drawB(); }; });
      drawC();
    }
    function avail() {
      const p = Q.product(st.productId); if (!p) return null; const paxN = st.adt + st.chd;
      if (p.availabilityModel === 'POR_SALIDA') { if (!st.depId) { const av = availFor(p.id, '0000-00-00', paxN); return { ok: false, msg: 'Seleccione una salida con cupos', alts: av.alts }; } const x = depById(st.depId); return availFor(p.id, x.d.date, paxN); }
      const av = availFor(p.id, st.date, paxN);
      if (daysFromToday(st.date) < (p.advMin || 0)) return { ok: false, msg: 'Anticipación mínima del producto: ' + p.advMin + ' día(s) (política de reserva)', alts: [] };
      if (paxN > p.maxPax) return { ok: false, msg: 'Máximo ' + p.maxPax + ' pasajeros por reserva', alts: [] };
      return av;
    }
    function drawC() {
      const c = calc(); const av = avail(); const p = Q.product(st.productId);
      if (!p) { C.innerHTML = UI.empty('Seleccione cliente y producto para calcular disponibilidad y precio.', 'suitcase'); return; }
      C.innerHTML = '<div class="chk-list">' + ck(av && av.ok ? (av.hold ? 'warn' : true) : false, 'Disponibilidad', esc(av ? av.msg : '') + (av && !av.ok && av.alts ? altsHtml(av.alts) : '')) + ck(!!c, 'Tarifa vigente', c ? esc(c.r.id + ' · ' + c.r.type + ' ' + c.r.segment + (c.sa.season ? ' · ' + c.sa.season.name + ' ×' + fmtN(c.sa.season.factor, 2) : '')) : 'Sin tarifa vigente para la fecha (PRD-BR-005)') + ck(st.adt + st.chd > 0, 'Pasajeros', st.adt + ' ADT · ' + st.chd + ' CHD · ' + st.inf + ' INF') + '</div>' +
        (c ? '<div class="divider" style="margin:10px 0"></div><div class="stat-line"><span class="muted">Adulto × ' + st.adt + '</span><span>' + money(c.sa.price, c.cur) + '</span></div>' + (st.chd ? '<div class="stat-line"><span class="muted">Niño × ' + st.chd + (c.child ? '' : ' (tarifa adulto)') + '</span><span>' + money(c.sc.price, c.cur) + '</span></div>' : '') + (st.inf ? '<div class="stat-line"><span class="muted">Infante × ' + st.inf + '</span><span>Sin cargo</span></div>' : '') + '<div class="stat-line total"><span>Total</span><span>' + money(c.price, c.cur) + '</span></div><div class="stat-line"><span class="muted">Costo estimado</span><span>' + money(c.cost, c.cur) + '</span></div><div class="stat-line"><span class="muted">Margen</span><b class="' + ((c.price - c.cost) / (c.price || 1) * 100 < 15 ? 'bad' : 'ok') + '">' + fmtN(c.price ? (c.price - c.cost) / c.price * 100 : 0, 1) + '%</b></div><div class="stat-line"><span class="muted">Anticipo 40% / saldo 60%</span><span>' + money(c.price * .4, c.cur) + ' / ' + money(c.price * .6, c.cur) + '</span></div>' : '');
    }
    function create(confirmNow) {
      if (!UI.validate(A)) return;
      const p = Q.product(st.productId); if (!p) { UI.toast('Seleccione un producto.', 'bad'); return; }
      if (sellBlock(p) || (p.flags && p.flags.bookable === false)) { UI.toast(esc(sellBlock(p) || 'Producto no reservable'), 'bad'); return; }
      const c = calc(); if (!c) { UI.toast('No hay tarifa vigente para la fecha (PRD-BR-005).', 'bad'); return; }
      const paxN = st.adt + st.chd; if (paxN <= 0) { UI.toast('Indique al menos un pasajero adulto o niño.', 'bad'); return; }
      const av = avail();
      if (confirmNow && (!av || !av.ok)) { UI.toast('Regla transversal 4 / PRD-BR-012: no se puede confirmar sin disponibilidad. ' + esc(av ? av.msg : ''), 'bad'); return; }
      if (p.availabilityModel === 'POR_SALIDA' && !st.depId && !confirmNow) { /* borrador sin salida: se guarda como pendiente de disponibilidad */ }
      const dep = st.depId ? depById(st.depId).d : null;
      const ds = dep ? dep.date : st.date;
      const dur = p.durationUnit === 'días' ? Math.max(1, p.durationValue) - 1 : 0;
      const status = confirmNow ? 'confirmada' : (av && av.ok ? 'borrador' : 'pendiente_disponibilidad');
      const cli = Q.client(A.querySelector('#nr-client').value);
      const id = Seq.next('Reserva');
      const it = { productId: p.id, date: ds, qty: 1, pax: paxN, unitCost: c.cost / paxN, unitPrice: c.price / paxN };
      const hold = av && av.ok && dep;
      if (hold) { dep.sold += paxN; setDepStatus(dep); }
      const r = { id, quoteId: null, quoteVersion: null, clientId: cli.id, title: p.name + ' — ' + cli.name.split(' ').slice(0, 2).join(' '), status, channel: A.querySelector('#nr-channel').value, travelFrom: ds, travelTo: addDays(ds, dur), currency: c.cur, total: c.price, owner: A.querySelector('#nr-owner').value, createdAt: nowStr(), sede: Auth.user.sede, notes: A.querySelector('#nr-notes').value.trim(), snapshot: p.id + ' v' + prodVer(p), policies: { [p.id]: clone(p.policies) }, passengers: placeholderPax({ adt: st.adt, chd: st.chd, inf: st.inf }), services: servicesFromItem(it, c.cur, 0, hold ? dep.id : null), changes: [] };
      DB.reservations.unshift(r);
      createReceivables(r, 'reserva directa');
      Audit.log('Reserva', id, 'crear', '', status + ' · ' + money(r.total, r.currency) + (hold ? ' · hold ' + dep.id + ' +' + paxN : ''));
      if (confirmNow) Notify.push('reserva.confirmada', 'Email', cli.email || cli.name, 'Reserva ' + id + ' confirmada — ' + r.title);
      Store.save(); UI.toast('Reserva ' + id + ' creada (' + UI.statusLabel(status) + ').' + (status === 'pendiente_disponibilidad' ? ' Sin cupo: quedó pendiente de disponibilidad.' : ''), status === 'pendiente_disponibilidad' ? 'warn' : 'ok');
      App.go('#/reservas/' + id);
    }
    bindActs(el, { draft: () => create(false), confirm: () => create(true) });
    drawB();
  }

  /* ======================================================================
     RESERVAS — Reserva 360
     ====================================================================== */
  function renderRes(el, r) {
    const cli = Q.client(r.clientId) || {}; const paid = Q.resPaid(r.id); const cost = Q.resCost(r); const saldo = r.status === 'cancelada' ? 0 : round2(r.total - paid);
    const op = DB.operations.find(o => o.resId === r.id);
    const closed = CLOSED.includes(r.status);
    const pendSvc = activeSvcs(r).filter(s => ['pendiente', 'solicitado'].includes(s.status));
    const canMod = can('reservations.modify'), canCan = can('reservations.cancel'), canNew = can('reservations.create');
    const ro = !canMod && !canCan && !canNew;
    const cr = r.cancelRequest && r.cancelRequest.status === 'pendiente' ? r.cancelRequest : null;
    const sm = seeMargin(r), opsView = can('operations.view') && !sm, acc = !sm && !opsView;
    let acts = scopeCtl();
    if (!ro) {
      if (['borrador', 'pendiente_disponibilidad', 'pendiente_proveedor', 'reprogramada'].includes(r.status)) acts += pbtn('Confirmar reserva', 'checkCircle', 'primary', 'confirm', 'reservations.modify');
      if (!closed) {
        acts += pbtn('Modificar', 'edit', '', 'modify', 'reservations.modify') + pbtn('Reprogramar', 'calendar', '', 'resched', 'reservations.modify');
        if (canCan) acts += pbtn('Cancelar', 'x', 'danger', 'cancel', 'reservations.cancel');
        else if (canNew) acts += cr ? pbtn('Anulación solicitada', 'x', '', 'cancelReq', null, 'Solicitud enviada a gerencia el ' + datetime(cr.ts)) : pbtn('Solicitar anulación', 'x', '', 'cancelReq', null);
      }
    }
    acts += '<button class="btn icon" data-a="more" title="Más acciones" aria-label="Más acciones">' + I('more') + '</button>';
    const pendChange = (r.changes || []).find(c => c.status === 'pendiente');
    el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title: esc(r.title), subtitle: '<span class="mono">' + esc(r.id) + '</span> · ' + UI.badge(r.status) + ' · ' + clientLink(r.clientId) + ' · canal ' + esc(r.channel), crumbs: [['Inicio', '#/dashboard'], ['Ventas'], ['Reservas', '#/reservas'], [r.id]], actions: acts }) +
      (ro ? roNote(acc ? 'Vista enfocada en montos, cuentas por cobrar y pagos. No puede modificar, reprogramar ni cancelar reservas.' : 'Puede revisar la reserva; no puede modificarla.') : '') +
      (opsView ? UI.alert('info', 'Vista de Operaciones: pasajeros, servicios y costos de proveedor. Márgenes y utilidad no se muestran para su rol (requiere finance.profitability).') : '') +
      (r.booking && r.booking.comments ? UI.alert('warn', '<b>Pedido especial del cliente (reserva web):</b> «' + esc(r.booking.comments) + '» ' + specialTags(r.booking.comments) + ' <a href="#" data-a="goWeb">Ver detalle</a>') : '') +
      (cr ? '<div id="r-creq">' + UI.alert('warn', '<b>Anulación solicitada</b> por ' + esc(Q.userName(cr.by)) + ' el ' + datetime(cr.ts) + ': ' + esc(cr.reason) + '. ' + (canCan ? '<div class="row" style="margin-top:8px;gap:8px">' + pbtn('Procesar cancelación', 'x', 'sm danger', 'crOk', 'reservations.cancel') + pbtn('Rechazar solicitud', 'refresh', 'sm', 'crNo', 'reservations.cancel') + '</div>' : 'Gerencia fue notificada; la reserva sigue vigente hasta su decisión (permiso reservations.cancel).')) + '</div>' : '') +
      (r.cancelRequest && r.cancelRequest.status === 'rechazada' && r.status !== 'cancelada' ? UI.alert('info', 'Solicitud de anulación rechazada por ' + esc(Q.userName(r.cancelRequest.decidedBy)) + ' el ' + datetime(r.cancelRequest.decidedAt) + (r.cancelRequest.decisionNote ? ': “' + esc(r.cancelRequest.decisionNote) + '”' : '') + '.') : '') +
      (r.status === 'cancelada' ? UI.alert('bad', '<b>Reserva cancelada</b>' + (r.cancelledAt ? ' el ' + datetime(r.cancelledAt) : '') + '. Motivo: ' + esc(r.cancelReason || '—') + (r.penalty != null ? ' · Penalidad ' + money(r.penalty, r.currency) + ' · Reembolso ' + money(r.refund || 0, r.currency) : '')) : '') +
      (r.status === 'pendiente_disponibilidad' ? UI.alert('warn', '<b>Pendiente de disponibilidad:</b> no hay cupo retenido para uno o más servicios. No se puede confirmar hasta contar con disponibilidad (Regla transversal 4).') : '') +
      (r.status === 'reprogramada' ? UI.alert('info', '<b>Reprogramada</b>' + (r.rescheduledAt ? ' el ' + datetime(r.rescheduledAt) : '') + '. Solicite nuevamente los servicios a proveedores y reemita vouchers.') : '') +
      (pendChange ? UI.alert('warn', '<b>Modificación pendiente de aprobación:</b> ' + esc(pendChange.desc) + ' (impacto ' + (pendChange.delta >= 0 ? '+' : '−') + money(Math.abs(pendChange.delta), r.currency) + '). ' + (can('quotes.approve_internal') ? '<a href="#" data-a="apprChange"><b>Aprobar y aplicar</b></a> · <a href="#" data-a="rejChange">Rechazar</a>' : 'Requiere aprobación de un supervisor.')) : '') +
      (!closed && canMod && pendSvc.length ? UI.alert('info', pendSvc.length + ' servicio(s) sin confirmación de proveedor. Gestiónelos en la pestaña Servicios (PROC-032).') : '') +
      '<div class="card"><div class="card-b">' + rFlow(r) + '<div class="vt-facts">' +
      '<div><div class="k">Cliente</div><div class="v">' + clientLink(r.clientId) + '</div><div class="xs faint">' + esc(cli.segment || '') + '</div></div>' +
      '<div><div class="k">Viaje</div><div class="v">' + dateShort(r.travelFrom) + ' – ' + date(r.travelTo) + '</div><div class="xs faint">' + (daysBetween(r.travelFrom, r.travelTo) + 1) + ' día(s)</div></div>' +
      '<div><div class="k">Pasajeros</div><div class="v">' + r.passengers.length + '</div><div class="xs faint">' + ['ADT', 'CHD', 'INF'].map(t => r.passengers.filter(p => p.type === t).length + ' ' + t).join(' · ') + '</div></div>' +
      (opsView ? '<div><div class="k">Costo proveedores</div><div class="v">' + money(cost, r.currency) + '</div><div class="xs faint">' + activeSvcs(r).length + ' servicio(s) activos</div></div>' +
        '<div><div class="k">Servicios</div><div class="v">' + activeSvcs(r).filter(s => ['confirmado', 'completado'].includes(s.status)).length + ' / ' + activeSvcs(r).length + ' confirmados</div><div class="xs faint">' + pendSvc.length + ' pendiente(s) de proveedor</div></div>'
      : '<div><div class="k">Total venta</div><div class="v">' + money(r.total, r.currency) + '</div><div class="xs faint">' + (sm ? 'Margen ' + fmtN(r.total ? (r.total - cost) / r.total * 100 : 0, 1) + '%' : esc(r.currency)) + '</div></div>' +
        '<div><div class="k">Saldo</div><div class="v ' + (saldo > 0.5 ? 'warn' : 'ok') + '">' + (saldo > 0.5 ? money(saldo, r.currency) : 'Pagado') + '</div><div class="xs faint">Pagado ' + money(paid, r.currency) + '</div></div>') +
      '<div><div class="k">Origen</div><div class="v">' + (r.quoteId ? (can('quotes.view') ? '<a class="mono" href="#/cotizaciones/' + esc(r.quoteId) + '">' + esc(r.quoteId) + '</a>' : '<span class="mono">' + esc(r.quoteId) + '</span>') + ' v' + r.quoteVersion : r.booking ? 'Reserva web' + (r.booking.orderId ? ' · <span class="mono">' + esc(r.booking.orderId) + '</span>' : '') : 'Reserva directa') + '</div><div class="xs faint">' + (op ? (Access.canRoute('operaciones/ordenes') ? '<a href="#/operaciones/ordenes/' + op.id + '">' + esc(op.id) + '</a>' : esc(op.id)) : 'Sin orden operativa') + '</div></div>' +
      '</div></div></div><div id="r-tabs"></div></div>';

    const tabs = [
      { id: 'res', label: 'Resumen', render: b => tabResumen(b, r) },
      r.booking ? { id: 'web', label: 'Detalle de la reserva web', render: b => tabWeb(b, r) } : null,
      { id: 'pax', label: 'Pasajeros', count: r.passengers.length, render: b => tabPax(b, r) },
      { id: 'svc', label: 'Servicios', count: r.services.length, render: b => tabSvc(b, r) },
      opsView ? null : { id: 'pay', label: 'Pagos', count: DB.payments.filter(p => p.resId === r.id).length, render: b => tabPay(b, r) },
      { id: 'docs', label: 'Documentos', count: DB.vouchers.filter(x => x.resId === r.id).length + DB.invoices.filter(x => x.resId === r.id).length, render: b => tabDocs(b, r) },
      acc ? null : { id: 'op', label: 'Operación', render: b => tabOp(b, r) },
      (r.booking || fbList(r).length) && (ruleOn('R-PAX-FEEDBACK', r) || fbList(r).length) ? { id: 'fb', label: 'Comentarios del pasajero', count: fbList(r).filter(f => f.status === 'nuevo').length || fbList(r).length, render: b => tabFeedback(b, r) } : null,
      { id: 'hist', label: 'Historial', count: DB.audit.filter(a => a.entityId === r.id).length, render: b => tabHist(b, r) }
    ].filter(Boolean);
    bindActs(el.querySelector('.page'), {
      confirm: () => confirmRes(r), modify: () => modifyModal(r), resched: () => reschedModal(r), cancel: () => cancelModal(r),
      cancelReq: () => requestCancel(r), crOk: () => cancelModal(r), crNo: () => rejectCancelReq(r),
      goWeb: () => { tabMem[r.id] = 'web'; App.render(); },
      apprChange: () => applyChange(r, pendChange, true), rejChange: () => { if (!need('quotes.approve_internal')) return; pendChange.status = 'rechazada'; Audit.log('Reserva', r.id, 'rechazar_modificacion', pendChange.desc, 'rechazada'); Store.save(); UI.toast('Modificación rechazada.', 'warn'); App.render(); },
      more: (b) => {
        const items = [{ label: 'Documento de confirmación', icon: 'file', onClick: () => resDocModal(r) }];
        if (canMod) items.push({ label: 'Solicitar todos los servicios pendientes', icon: 'send', onClick: () => requestAll(r) });
        if (can('finance.payments.register')) items.push({ label: 'Registrar pago', icon: 'wallet', onClick: () => payModal(r) });
        if (canMod) items.push('-', { label: 'Iniciar operación (en viaje)', icon: 'zap', onClick: () => setResStatus(r, 'en_operacion') }, { label: 'Completar viaje', icon: 'checkCircle', onClick: () => setResStatus(r, 'completada') });
        if (isSup()) items.push('-', { label: 'Reasignar asesor', icon: 'user', onClick: () => reassign('Reserva', r) });
        UI.menu(b, items);
      }
    });
    bindScope(el);
    const defTab = acc ? 'pay' : 'res';
    UI.tabs(el.querySelector('#r-tabs'), tabs, tabs.some(x => x.id === tabMem[r.id]) ? tabMem[r.id] : defTab, { onChange: id => { tabMem[r.id] = id; } });
  }
  function setResStatus(r, to) {
    if (!need('reservations.modify')) return;
    if (to === 'en_operacion' && !['confirmada', 'reprogramada', 'pendiente_pago', 'pendiente_proveedor'].includes(r.status)) { UI.toast('Solo una reserva confirmada puede pasar a operación.', 'bad'); return; }
    if (to === 'en_operacion' && daysFromToday(r.travelFrom) > 1) { UI.toast('El viaje inicia el ' + date(r.travelFrom) + '; la operación se inicia el día de servicio.', 'warn'); return; }
    if (to === 'completada' && r.status !== 'en_operacion') { UI.toast('Solo se completa una reserva en operación.', 'bad'); return; }
    const b = r.status; r.status = to; Audit.log('Reserva', r.id, 'cambio_estado', b, to); Store.save(); UI.toast('Reserva en estado ' + UI.statusLabel(to) + '.'); App.render();
  }

  /* ---- Resumen ---- */
  function tabResumen(b, r) {
    const paid = Q.resPaid(r.id); const cost = Q.resCost(r); const saldo = r.status === 'cancelada' ? 0 : round2(r.total - paid); const own = Q.user(r.owner);
    const svc = activeSvcs(r); const byS = (s) => svc.filter(x => x.status === s).length;
    b.innerHTML = '<div class="grid g-2-1" style="align-items:start"><div class="stack">' +
      UI.card('Datos de la reserva', '<div class="grid g2">' + UI.dl([['Código', '<span class="mono">' + esc(r.id) + '</span>'], ['Cliente', clientLink(r.clientId)], ['Canal', esc(r.channel)], ['Vendedor', own ? UI.userChip(own.id) : esc(Q.userName(r.owner))], ['Sede', esc(Q.sedeName(r.sede))], ['Creada', datetime(r.createdAt)]]) + UI.dl([['Viaje', date(r.travelFrom) + ' – ' + date(r.travelTo)], ['Origen', r.quoteId ? (can('quotes.view') ? '<a href="#/cotizaciones/' + esc(r.quoteId) + '">' + esc(r.quoteId) + '</a>' : esc(r.quoteId)) + ' · versión v' + r.quoteVersion : 'Reserva directa (sin cotización)'], ['Snapshot', '<span class="mono xs">' + esc(r.snapshot || (r.quoteId && Q.quote(r.quoteId) ? (Q.quote(r.quoteId).versions.find(v => v.v === r.quoteVersion) || {}).snapshot || '' : '')) + '</span>'], ['Moneda', r.currency], ['Notas', esc(r.notes || '')]]) + '</div>') +
      UI.card('Estado de servicios', '<div class="grid g4">' + [['Pendientes', byS('pendiente'), 'warn'], ['Solicitados', byS('solicitado'), 'info'], ['Confirmados', byS('confirmado') + byS('completado'), 'ok'], ['Rechazados', r.services.filter(s => s.status === 'rechazado').length, 'bad']].map(x => '<div><div class="xs faint">' + x[0] + '</div><div style="font-size:1.3rem;font-weight:600" class="' + (x[1] ? x[2] : 'faint') + '">' + x[1] + '</div></div>').join('') + '</div>' + (svc.length ? '<div style="margin-top:10px">' + UI.progress((byS('confirmado') + byS('completado')) / svc.length * 100, '') + '</div>' : '')) +
      ((r.changes || []).length ? UI.card('Modificaciones y reprogramaciones', UI.timeline(r.changes.slice().reverse().map(c => ({ icon: c.type === 'reprogramacion' ? 'calendar' : 'edit', title: esc(c.desc), meta: datetime(c.ts) + ' · ' + esc(Q.userName(c.by)) + ' · ' + UI.badge(c.status === 'aplicada' ? 'aplicado' : c.status === 'pendiente' ? 'pendiente' : 'rechazado', c.status === 'aplicada' ? 'Aplicada' : c.status === 'pendiente' ? 'Pendiente aprobación' : 'Rechazada'), desc: 'Impacto: ' + (c.delta >= 0 ? '+' : '−') + money(Math.abs(c.delta || 0), r.currency) + (c.approvedBy ? ' · aprobada por ' + esc(Q.userName(c.approvedBy)) : '') })))) : '') +
      '</div><div class="stack">' + (!seeMargin(r) ? econLimited(r, cost, paid, saldo) : UI.card('Economía de la reserva', '<div class="stat-line"><span class="muted">Venta total</span><b>' + money(r.total, r.currency) + '</b></div><div class="stat-line"><span class="muted">Costo de servicios</span><b>' + money(cost, r.currency) + '</b></div><div class="stat-line"><span class="muted">Margen bruto</span><b class="' + ((r.total - cost) / (r.total || 1) * 100 < 15 ? 'bad' : 'ok') + '">' + money(r.total - cost, r.currency) + ' · ' + fmtN(r.total ? (r.total - cost) / r.total * 100 : 0, 1) + '%</b></div><div class="stat-line"><span class="muted">Pagado</span><b class="ok">' + money(paid, r.currency) + '</b></div><div class="stat-line total"><span>Saldo</span><span class="' + (saldo > 0.5 ? 'warn' : 'ok') + '">' + money(Math.max(0, saldo), r.currency) + '</span></div><div style="margin-top:8px">' + UI.progress(r.total ? paid / r.total * 100 : 0, '') + '</div>' + (r.currency === 'USD' ? '<div class="xs faint" style="margin-top:6px">Equivalente: ' + money(toPEN(r.total, 'USD'), 'PEN') + ' (TC ' + DB.settings.fx + ')</div>' : ''), { actions: pbtn('Registrar pago', 'wallet', 'sm', 'pay', 'finance.payments.register') })) +
      UI.card('Políticas aplicables (snapshot)', [...new Set(r.services.map(s => s.productId))].filter(Boolean).map(pid => { const po = resPol(r, pid); return '<div style="margin-bottom:10px"><b class="small">' + esc(Q.productName(pid)) + '</b><div class="xs muted">Cancelación: ' + esc(po.cancel || '—') + '</div><div class="xs muted">Cambios: ' + esc(po.modify || '—') + '</div></div>'; }).join('') || UI.empty('Sin políticas')) + '</div></div>';
    bindActs(b, { pay: () => payModal(r) });
  }

  function econLimited(r, cost, paid, saldo) {
    if (can('operations.view')) {
      const byProv = {}; activeSvcs(r).forEach(s => { const k = s.providerId || '—'; byProv[k] = (byProv[k] || 0) + (s.cost || 0); });
      return UI.card('Costos de proveedor', Object.entries(byProv).sort((a, b) => b[1] - a[1]).map(([k, v]) => '<div class="stat-line"><span class="muted">' + esc(k === '—' ? 'Sin proveedor' : Q.providerName(k)) + '</span><b>' + money(v, r.currency) + '</b></div>').join('') + '<div class="stat-line total"><span>Costo total</span><span>' + money(cost, r.currency) + '</span></div><p class="xs faint" style="margin-top:8px">Importes de venta, márgenes y utilidad no visibles para su rol (requiere finance.profitability).</p>', { sub: 'Base para liquidaciones y cuentas por pagar' });
    }
    return UI.card('Montos y pagos', '<div class="stat-line"><span class="muted">Total de la reserva</span><b>' + money(r.total, r.currency) + '</b></div><div class="stat-line"><span class="muted">Pagado</span><b class="ok">' + money(paid, r.currency) + '</b></div><div class="stat-line total"><span>Saldo</span><span class="' + (saldo > 0.5 ? 'warn' : 'ok') + '">' + money(Math.max(0, saldo), r.currency) + '</span></div><div style="margin-top:8px">' + UI.progress(r.total ? paid / r.total * 100 : 0, '') + '</div>' + (r.currency === 'USD' ? '<div class="xs faint" style="margin-top:6px">Equivalente: ' + money(toPEN(r.total, 'USD'), 'PEN') + ' (TC ' + DB.settings.fx + ')</div>' : ''), { actions: pbtn('Registrar pago', 'wallet', 'sm', 'pay', 'finance.payments.register') });
  }

  /* ---- Pasajeros ---- */
  function tabPax(b, r) {
    const ph = r.passengers.filter(p => p.placeholder).length;
    b.innerHTML = (ph ? UI.alert('warn', ph + ' pasajero(s) por completar. Los datos nominativos (documento, nacionalidad, fecha de nacimiento) son obligatorios para entradas a Machu Picchu, trenes y manifiestos.') : '') +
      '<div class="card" style="margin-top:' + (ph ? 12 : 0) + 'px"><div class="card-h"><div><div class="t">Pasajeros (' + r.passengers.length + ')</div><div class="s">' + ['ADT', 'CHD', 'INF'].map(t => r.passengers.filter(p => p.type === t).length + ' ' + t).join(' · ') + '</div></div>' + (CLOSED.includes(r.status) || !can('reservations.modify') ? '' : pbtn('Agregar pasajero', 'plus', 'sm primary', 'add', 'reservations.modify')) + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nombre</th><th>Parentesco</th><th>Tipo</th><th class="num">Edad</th><th>Documento</th><th>Nacionalidad</th><th>Nacimiento</th><th>Contacto</th><th>Dieta / observaciones</th><th></th></tr></thead><tbody>' +
      (r.passengers.map((p, i) => { const age = paxAge(p, r); const t = age != null && bkProd(r) && BE() ? BE().ageType(bkProd(r), age) : null; return '<tr><td class="faint">' + (i + 1) + '</td><td><div class="cell-main">' + esc(p.name) + (p.placeholder ? '<span class="ph-tag">Por completar</span>' : '') + (p.isLead ? ' ' + UI.badge('confirmado', 'Titular') : '') + '</div></td><td>' + esc(p.relationship || (p.isLead ? 'Titular' : '—')) + '</td><td><span class="tag" title="' + ({ ADT: 'Adulto', CHD: 'Niño', INF: 'Infante' }[p.type] || '') + '">' + esc(p.type) + '</span>' + (t && t !== 'NA' && t !== p.type ? ' <span class="xs warn" title="Según las reglas de pasajeros del producto (R-CHILD-PER-ADULT / R-INFANT-FREE)">edad → ' + t + '</span>' : '') + '</td><td class="num">' + (age != null ? age : '—') + '</td><td class="nowrap">' + esc(p.doc || '—') + '</td><td>' + esc(p.nationality || '—') + '</td><td class="nowrap">' + (p.birth ? date(p.birth) : '—') + '</td><td class="small">' + ([p.phone, p.email].filter(Boolean).map(esc).join('<br>') || '—') + '</td><td>' + (p.diet ? '<span class="tag">' + esc(p.diet) + '</span>' : '<span class="faint">—</span>') + '</td><td class="nowrap">' + (CLOSED.includes(r.status) || !can('reservations.modify') ? '' : '<button class="btn xs" data-ed="' + i + '">' + I('edit') + 'Editar</button> <button class="btn xs ghost" data-rm="' + i + '" title="Eliminar">' + I('trash') + '</button>') + '</td></tr>'; }).join('') || '<tr><td colspan="11">' + UI.empty('Sin pasajeros', 'user') + '</td></tr>') +
      '</tbody></table></div></div>';
    const open = (idx) => {
      if (!need('reservations.modify')) return;
      const p = idx != null ? r.passengers[idx] : { name: '', doc: '', type: 'ADT', nationality: 'Peruana', birth: '', phone: '', diet: '' };
      const [dt, dn] = String(p.doc || '').includes(' ') ? [p.doc.split(' ')[0], p.doc.split(' ').slice(1).join(' ')] : ['DNI', p.doc || ''];
      UI.modal({ title: idx != null ? 'Editar pasajero' : 'Agregar pasajero', sub: esc(r.id), body: UI.form([
        { id: 'px-name', label: 'Nombre completo', col: 12, required: true, value: p.placeholder ? '' : p.name, placeholder: 'Nombres y apellidos como figuran en el documento' },
        { id: 'px-dt', label: 'Tipo de documento', type: 'select', col: 4, value: dt, options: ['DNI', 'Pasaporte', 'CE', 'Passport'] },
        { id: 'px-dn', label: 'Número de documento', col: 4, required: true, value: dn },
        { id: 'px-type', label: 'Tipo de pasajero', type: 'select', col: 4, value: p.type, options: [['ADT', 'ADT — Adulto'], ['CHD', 'CHD — Niño (2–11)'], ['INF', 'INF — Infante (0–1)']] },
        { id: 'px-nat', label: 'Nacionalidad', col: 4, required: true, value: p.nationality },
        { id: 'px-birth', label: 'Fecha de nacimiento', type: 'date', col: 4, required: true, value: p.birth },
        { id: 'px-phone', label: 'Teléfono', col: 4, value: p.phone },
        { id: 'px-rel', label: 'Parentesco con el titular', type: 'select', col: 4, value: p.relationship || (p.isLead ? 'Titular' : (r.passengers.some(x => x.isLead) ? 'Otro' : 'Titular')), options: REL_OPTS },
        { id: 'px-email', label: 'Correo', type: 'email', col: 8, value: p.email || '' },
        { id: 'px-diet', label: 'Dieta / requerimientos especiales', col: 12, value: p.diet, placeholder: 'Vegetariano, sin gluten, alergias, movilidad reducida…' }
      ]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m);
        const age = Math.floor(daysBetween(f['px-birth'], r.travelFrom) / 365.25);
        const bp = bkProd(r); const bt = bp && BE() ? BE().ageType(bp, age) : null;
        const expType = bt && bt !== 'NA' ? bt : age < 2 ? 'INF' : age < 12 ? 'CHD' : 'ADT';
        if (expType !== f['px-type']) UI.toast('Aviso: por la edad a la fecha del viaje (' + age + ' años) corresponde tipo ' + expType + '.', 'warn');
        if (f['px-rel'] === 'Titular' && r.passengers.some((x, j) => j !== idx && x.isLead)) { UI.toast('Ya existe un titular en la reserva; solo puede haber uno.', 'bad'); return false; }
        const np = Object.assign({}, idx != null ? p : {}, { name: f['px-name'], doc: f['px-dt'] + ' ' + f['px-dn'], type: f['px-type'], nationality: f['px-nat'], birth: f['px-birth'], phone: f['px-phone'], diet: f['px-diet'], relationship: f['px-rel'], isLead: f['px-rel'] === 'Titular', email: f['px-email'], age: age >= 0 ? age : null });
        delete np.placeholder;
        if (idx != null) { r.passengers[idx] = np; Audit.log('Reserva', r.id, 'editar_pasajero', p.name, np.name + ' · ' + np.doc); }
        else { r.passengers.push(np); Audit.log('Reserva', r.id, 'agregar_pasajero', r.passengers.length - 1 + ' pax', r.passengers.length + ' pax · ' + np.name); UI.toast('Pasajero agregado. Si impacta precio o cupos, registre una modificación (PROC-027).', 'info'); }
        Store.save(); tabMem[r.id] = 'pax'; App.render();
      } }] });
    };
    bindActs(b, { add: () => open(null) });
    b.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => open(+x.dataset.ed));
    b.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { if (!need('reservations.modify')) return; const p = r.passengers[+x.dataset.rm]; UI.confirm({ title: 'Eliminar pasajero', message: '¿Eliminar a <b>' + esc(p.name) + '</b> de la reserva? Queda registrado en auditoría.', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { r.passengers.splice(+x.dataset.rm, 1); Audit.log('Reserva', r.id, 'eliminar_pasajero', p.name, r.passengers.length + ' pax'); Store.save(); tabMem[r.id] = 'pax'; App.render(); } }); });
  }

  /* ---- Servicios (PROC-032) ---- */
  function tabSvc(b, r) {
    const closed = CLOSED.includes(r.status) || !can('reservations.modify');
    const sc = seeCost(r), sp = seePrice(r);
    const rows = r.services.slice().sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
    b.innerHTML = '<div class="card"><div class="card-h"><div><div class="t">Servicios de la reserva</div><div class="s">Servicio → Solicitud → Proveedor → Confirmación/Rechazo → Registrar → Actualizar operación</div></div>' + (closed ? '' : pbtn('Solicitar pendientes', 'send', 'sm', 'reqall', 'reservations.modify')) + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Servicio</th><th>Proveedor</th><th>Estado</th><th>Código conf.</th>' + (sc ? '<th class="num">Costo</th>' : '') + (sp ? '<th class="num">Precio</th>' : '') + '<th></th></tr></thead><tbody>' +
      rows.map(s => { const dp = depForService(s); return '<tr><td class="nowrap"><b>' + dateShort(s.date) + '</b> <span class="faint">' + esc(s.time || '') + '</span></td><td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc(Q.productName(s.productId)) + (dp ? ' · ' + esc(dp.d.id) : '') + (s.rejectReason ? ' · <span class="bad">Rechazo: ' + esc(s.rejectReason) + '</span>' : '') + (s.altOf ? ' · alternativa de ' + esc(s.altOf) : '') + '</div></td><td>' + (s.providerId ? '<a href="#/catalogo/proveedores/' + esc(s.providerId) + '">' + esc(Q.providerName(s.providerId)) + '</a>' : '<span class="faint">—</span>') + '</td><td>' + UI.badge(s.status) + '</td><td class="mono small">' + esc(s.confirmationCode || '—') + '</td>' + (sc ? '<td class="num">' + money(s.cost, r.currency) + '</td>' : '') + (sp ? '<td class="num">' + money(s.price, r.currency) + '</td>' : '') + '<td class="nowrap">' + (closed ? '' : s.status === 'pendiente' ? '<button class="btn xs" data-req="' + s.id + '">' + I('send') + 'Solicitar</button>' : s.status === 'solicitado' ? '<button class="btn xs primary" data-ok="' + s.id + '">' + I('check') + 'Confirmar</button> <button class="btn xs danger" data-no="' + s.id + '">' + I('x') + 'Rechazo</button>' : s.status === 'confirmado' ? '<button class="btn xs ghost" data-no="' + s.id + '" title="Registrar rechazo posterior">' + I('x') + '</button>' : '') + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="5">Total servicios activos</td>' + (sc ? '<td class="num">' + money(sum(activeSvcs(r), 'cost'), r.currency) + '</td>' : '') + (sp ? '<td class="num">' + money(sum(activeSvcs(r), 'price'), r.currency) + '</td>' : '') + '<td></td></tr></tfoot></table></div></div>' + (!can('reservations.modify') ? '<p class="xs faint" style="margin-top:8px">Gestión de proveedores (solicitar, confirmar, registrar rechazo): requiere reservations.modify.</p>' : '');
    bindActs(b, { reqall: () => requestAll(r) });
    const S = (id) => r.services.find(x => x.id === id);
    b.querySelectorAll('[data-req]').forEach(x => x.onclick = () => requestSvc(r, S(x.dataset.req)));
    b.querySelectorAll('[data-ok]').forEach(x => x.onclick = () => confirmSvc(r, S(x.dataset.ok)));
    b.querySelectorAll('[data-no]').forEach(x => x.onclick = () => rejectSvc(r, S(x.dataset.no)));
  }
  function requestSvc(r, s, silent) {
    if (!silent && !need('reservations.modify')) return false;
    const pv = Q.provider(s.providerId);
    if (pv && pv.status !== 'activo') { if (!silent) UI.toast('PRD-BR-007: el proveedor ' + esc(pv.name) + ' está ' + esc(UI.statusLabel(pv.status)).toLowerCase() + '. Registre un rechazo y elija alternativa.', 'bad'); return false; }
    s.status = 'solicitado'; s.requestedAt = nowStr();
    Notify.push('proveedor.solicitud', 'Email', pv ? pv.email : 'proveedor', 'Solicitud ' + r.id + ' · ' + s.name + ' · ' + date(s.date) + ' · ' + svcPax(r, s) + ' pax');
    Audit.log('Servicio reserva', s.id, 'solicitar_proveedor', 'pendiente', 'solicitado · ' + (pv ? pv.name : ''));
    if (!silent) { Store.save(); UI.toast('Solicitud enviada a ' + esc(pv ? pv.name : 'proveedor') + '.'); tabMem[r.id] = 'svc'; App.render(); }
    return true;
  }
  function requestAll(r) {
    if (!need('reservations.modify')) return;
    const list = r.services.filter(s => s.status === 'pendiente'); if (!list.length) { UI.toast('No hay servicios pendientes de solicitud.', 'info'); return; }
    let n = 0; list.forEach(s => { if (requestSvc(r, s, true)) n++; });
    if (n && ['confirmada', 'borrador'].includes(r.status) === false && r.status !== 'pendiente_proveedor') { /* estado se mantiene */ }
    Store.save(); UI.toast(n + ' solicitud(es) enviada(s) a proveedores' + (n < list.length ? '; ' + (list.length - n) + ' con proveedor no activo' : '') + '.', n < list.length ? 'warn' : 'ok'); tabMem[r.id] = 'svc'; App.render();
  }
  function afterSvcChange(r) {
    const act = activeSvcs(r);
    if (r.status === 'pendiente_proveedor' && act.every(s => ['confirmado', 'completado'].includes(s.status))) { r.status = 'confirmada'; Audit.log('Reserva', r.id, 'cambio_estado', 'pendiente_proveedor', 'confirmada (todos los servicios confirmados)'); UI.toast('Todos los servicios confirmados: la reserva pasa a Confirmada.'); }
  }
  function confirmSvc(r, s) {
    if (!need('reservations.modify')) return;
    UI.modal({ title: 'Registrar confirmación del proveedor', sub: esc(s.name) + ' · ' + date(s.date), size: 'sm', body: UI.form([{ id: 'cf-code', label: 'Código de confirmación', col: 12, required: true, placeholder: 'Ej.: FSA-7Q2K9' }, { id: 'cf-time', label: 'Hora confirmada', col: 6, value: s.time && s.time !== '—' ? s.time : '' }, { id: 'cf-by', label: 'Confirmado por', col: 6, value: (Q.provider(s.providerId) || {}).contact || '' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); const bs = s.status; s.status = 'confirmado'; s.confirmationCode = f['cf-code']; if (f['cf-time']) s.time = f['cf-time']; s.confirmedAt = nowStr(); Audit.log('Servicio reserva', s.id, 'confirmar_proveedor', bs, 'confirmado · ' + s.confirmationCode); afterSvcChange(r); const op = DB.operations.find(o => o.resId === r.id); if (op) { const a = op.assignments.find(x => x.serviceId === s.id); if (a && f['cf-time']) a.time = f['cf-time']; } Store.save(); UI.toast('Confirmación registrada (' + esc(s.confirmationCode) + ').'); tabMem[r.id] = 'svc'; App.render(); } }] });
  }
  function rejectSvc(r, s) {
    if (!need('reservations.modify')) return;
    const pv = Q.provider(s.providerId) || {};
    const alts = DB.providers.filter(p => p.type === pv.type && p.status === 'activo' && p.id !== pv.id);
    UI.modal({ title: 'Proveedor rechaza — ' + esc(s.name), sub: 'Excepción “Proveedor rechaza”: Solicitud → Rechazo → Alternativa → Actualizar operación → Confirmar', body: UI.form([
      { id: 'rj-why', label: 'Motivo del rechazo', type: 'select', col: 6, options: ['Sin disponibilidad', 'Sobreventa del proveedor', 'Mantenimiento / cierre', 'Condiciones climáticas', 'Tarifa no aceptada', 'Otro'] },
      { id: 'rj-det', label: 'Detalle', col: 6, required: true, placeholder: 'Ej.: hotel sin habitaciones para esa noche' },
      { id: 'rj-alt', label: 'Alternativa', type: 'select', col: 6, options: [['', 'Sin alternativa por ahora']].concat(alts.map(p => [p.id, p.name + ' (' + p.type + ')'])).concat([['same', 'Mismo proveedor, otra fecha']]) },
      { id: 'rj-date', label: 'Fecha alternativa (si aplica)', type: 'date', col: 6, value: s.date }
    ]) + '<div style="margin-top:10px">' + UI.alert('info', 'La alternativa se crea como un nuevo servicio en estado pendiente; el servicio rechazado se conserva para trazabilidad y la orden operativa se actualiza.') + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Registrar rechazo', cls: 'danger', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        const bs = s.status; s.status = 'rechazado'; s.rejectReason = f['rj-why'] + ': ' + f['rj-det'];
        let ns = null;
        if (f['rj-alt']) { ns = Object.assign(clone(s), { id: uid('RS'), status: 'pendiente', confirmationCode: '', rejectReason: '', altOf: s.id, providerId: f['rj-alt'] === 'same' ? s.providerId : f['rj-alt'], date: f['rj-date'] || s.date }); delete ns.replacedBy; s.replacedBy = ns.id; r.services.push(ns); }
        if (r.status === 'confirmada') { r.status = 'pendiente_proveedor'; }
        const op = DB.operations.find(o => o.resId === r.id);
        if (op) { const a = op.assignments.find(x => x.serviceId === s.id); if (a) { a.status = 'cancelada'; } if (ns) op.assignments.push({ serviceId: ns.id, date: ns.date, time: ns.time, service: ns.name + ' (alternativa)', guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null }); }
        Audit.log('Servicio reserva', s.id, 'rechazo_proveedor', bs, 'rechazado · ' + s.rejectReason + (ns ? ' → alternativa ' + ns.id + ' ' + Q.providerName(ns.providerId) : ''));
        Notify.push('proveedor.rechazo', 'Push', r.owner, 'Proveedor rechazó ' + s.name + ' (' + r.id + ')' + (ns ? '. Alternativa registrada.' : ''));
        Store.save(); UI.toast(ns ? 'Rechazo registrado; alternativa creada con ' + esc(Q.providerName(ns.providerId)) + '.' : 'Rechazo registrado sin alternativa: la reserva no podrá confirmarse hasta resolverlo.', ns ? 'warn' : 'bad'); tabMem[r.id] = 'svc'; App.render();
      } }] });
  }

  /* ---- Pagos ---- */
  function tabPay(b, r) {
    const cxc = DB.receivables.filter(x => x.resId === r.id); const pays = DB.payments.filter(p => p.resId === r.id);
    b.innerHTML = '<div class="stack">' + UI.card('Cuentas por cobrar', cxc.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Concepto</th><th>Vence</th><th class="num">Monto</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estado</th></tr></thead><tbody>' + cxc.map(c => '<tr><td class="mono small"><a href="#/finanzas/cobros">' + esc(c.id) + '</a></td><td>' + esc(c.concept) + '</td><td class="nowrap ' + (c.status !== 'pagada' && c.status !== 'cancelada' && daysFromToday(c.due) < 0 ? 'bad' : '') + '">' + date(c.due) + '</td><td class="num">' + money(c.amount, c.currency) + '</td><td class="num">' + money(c.paid, c.currency) + '</td><td class="num"><b>' + money(Math.max(0, c.amount - c.paid), c.currency) + '</b></td><td>' + UI.badge(c.status) + '</td></tr>').join('') + '</tbody><tfoot><tr><td colspan="3">Total</td><td class="num">' + money(sum(cxc, 'amount'), r.currency) + '</td><td class="num">' + money(sum(cxc, 'paid'), r.currency) + '</td><td class="num">' + money(sum(cxc.filter(c => c.status !== 'cancelada'), c => Math.max(0, c.amount - c.paid)), r.currency) + '</td><td></td></tr></tfoot></table></div>' : UI.empty('Sin cuentas por cobrar generadas', 'wallet'), { tight: true, actions: (!cxc.length && r.status !== 'cancelada' ? pbtn('Generar anticipo / saldo', 'plus', 'sm', 'gen', 'finance.receivables') : '') + (r.status !== 'cancelada' ? pbtn('Registrar pago', 'wallet', 'sm primary', 'pay', 'finance.payments.register') : '') }) +
      UI.card('Pagos registrados', pays.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pago</th><th>Fecha</th><th>Método</th><th>Referencia</th><th>CxC</th><th class="num">Monto</th><th>Estado</th></tr></thead><tbody>' + pays.map(p => '<tr><td class="mono small"><a href="#/finanzas/pagos">' + esc(p.id) + '</a></td><td class="nowrap">' + date(p.date) + '</td><td>' + esc(p.method) + '</td><td class="small">' + esc(p.ref) + '</td><td class="mono small">' + esc(p.receivableId || '—') + '</td><td class="num"><b>' + money(p.amount, p.currency) + '</b></td><td>' + UI.badge(p.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin pagos registrados', 'card'), { tight: true, sub: 'Todo pago se asocia a una obligación (Regla transversal 9)' }) + '</div>';
    bindActs(b, { pay: () => payModal(r), gen: () => { if (!need('finance.receivables')) return; createReceivables(r, 'manual'); Store.save(); UI.toast('Cuentas por cobrar generadas.'); tabMem[r.id] = 'pay'; App.render(); } });
  }
  function payModal(r) {
    if (!need('finance.payments.register')) return;
    if (r.status === 'cancelada') { UI.toast('La reserva está cancelada.', 'bad'); return; }
    const open = DB.receivables.filter(c => c.resId === r.id && !['pagada', 'cancelada'].includes(c.status));
    if (!open.length) { UI.toast('No hay cuentas por cobrar abiertas. Genérelas primero (Regla transversal 9).', 'warn'); tabMem[r.id] = 'pay'; App.render(); return; }
    const first = open.sort((a, b) => a.due.localeCompare(b.due))[0];
    UI.modal({ title: 'Registrar pago — ' + esc(r.id), sub: 'Pago rápido aplicado a una cuenta por cobrar', body: UI.form([
      { id: 'pg-cxc', label: 'Cuenta por cobrar', type: 'select', col: 12, value: first.id, options: open.map(c => [c.id, c.id + ' · ' + c.concept + ' · saldo ' + money(c.amount - c.paid, c.currency)]) },
      { id: 'pg-amt', label: 'Monto (' + r.currency + ')', type: 'number', step: '0.01', min: 0, col: 4, required: true, value: round2(first.amount - first.paid) },
      { id: 'pg-met', label: 'Método', type: 'select', col: 4, options: ['Transferencia BCP', 'Transferencia BBVA', 'Transferencia Interbank', 'Yape', 'Plin', 'Tarjeta (POS)', 'Efectivo'] },
      { id: 'pg-date', label: 'Fecha', type: 'date', col: 4, value: TODAY() },
      { id: 'pg-ref', label: 'Referencia / N.º de operación', col: 12, required: true, placeholder: 'Ej.: OP 00918273' }
    ]), onOpen: (m) => { m.querySelector('#pg-cxc').onchange = (e) => { const c = open.find(x => x.id === e.target.value); m.querySelector('#pg-amt').value = round2(c.amount - c.paid); }; },
      actions: [{ label: 'Cancelar' }, { label: 'Registrar pago aplicado', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const c = open.find(x => x.id === f['pg-cxc']); const amt = round2(f['pg-amt']);
        if (!(amt > 0)) { UI.toast('El monto debe ser mayor a cero.', 'bad'); return false; }
        if (amt > round2(c.amount - c.paid) + 0.01) { UI.toast('El monto excede el saldo de la cuenta (' + money(c.amount - c.paid, c.currency) + ').', 'bad'); return false; }
        const pid = nextId('payments', 'PAG-', 5);
        DB.payments.unshift({ id: pid, receivableId: c.id, resId: r.id, method: f['pg-met'], amount: amt, currency: c.currency, date: f['pg-date'], status: 'aplicado', ref: f['pg-ref'], by: Auth.user.id });
        const bc = c.status; c.paid = round2(c.paid + amt); c.status = c.paid >= c.amount - 0.01 ? 'pagada' : 'parcial';
        Audit.log('Pago', pid, 'registrar_aplicar', c.id + ' ' + bc, c.status + ' · ' + money(amt, c.currency));
        if (r.status === 'pendiente_pago' && saldoOf(r) <= 0.5) { r.status = 'confirmada'; Audit.log('Reserva', r.id, 'cambio_estado', 'pendiente_pago', 'confirmada (pagada)'); }
        const cli = Q.client(r.clientId) || {}; Notify.push('pago.recibido', 'Email', cli.email || cli.name, 'Pago recibido ' + money(amt, c.currency) + ' — ' + r.id);
        Store.save(); UI.toast('Pago ' + pid + ' aplicado a ' + c.id + '.'); tabMem[r.id] = 'pay'; App.render();
      } }] });
  }

  /* ---- Documentos ---- */
  function tabDocs(b, r) {
    const vou = DB.vouchers.filter(v => v.resId === r.id); const inv = DB.invoices.filter(i => i.resId === r.id); const q = r.quoteId ? Q.quote(r.quoteId) : null;
    b.innerHTML = '<div class="grid g2" style="align-items:start"><div class="stack">' +
      UI.card('Vouchers', vou.length ? '<div class="list">' + vou.map(v => '<a class="list-item click" href="#/operaciones/vouchers" style="color:inherit;text-decoration:none"><div class="ico-box ' + (v.status === 'anulado' ? 'bad' : '') + '">' + I('ticket') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:600">' + esc(v.id) + ' · v' + v.version + '</div><div class="xs faint">' + esc(v.service) + ' · ' + date(v.date) + ' · ' + v.pax + ' pax · ' + esc(Q.providerName(v.providerId)) + '</div></div>' + UI.badge(v.status) + '</a>').join('') + '</div>' : UI.empty('Aún no se emiten vouchers (Operaciones › Vouchers)', 'ticket'), { tight: true, actions: '<a class="btn sm ghost" href="#/operaciones/vouchers">Vouchers ' + I('arrowRight') + '</a>' }) +
      UI.card('Comprobantes electrónicos', inv.length ? '<div class="list">' + inv.map(i => '<a class="list-item click" href="#/finanzas/facturacion" style="color:inherit;text-decoration:none"><div class="ico-box ' + (i.type === 'Nota de crédito' ? 'sun' : 'info') + '">' + I('receipt') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:600">' + esc(i.type) + ' ' + esc(i.id) + '</div><div class="xs faint">' + esc(i.detail) + ' · ' + date(i.date) + '</div></div><div class="right"><div class="small num" style="font-weight:600">' + money(i.amount, i.currency) + '</div>' + UI.badge(i.status) + '</div></a>').join('') + '</div>' : UI.empty('Sin comprobantes emitidos', 'receipt'), { tight: true, actions: '<a class="btn sm ghost" href="#/finanzas/facturacion">Facturación ' + I('arrowRight') + '</a>' }) +
      '</div><div class="stack">' + UI.card('Documentos comerciales', '<div class="list">' +
        (q && can('quotes.view') ? '<a class="list-item click" href="#/cotizaciones/' + q.id + '" style="color:inherit;text-decoration:none"><div class="ico-box violet">' + I('file') + '</div><div class="grow"><div class="small" style="font-weight:600">Cotización ' + esc(q.id) + ' v' + r.quoteVersion + '</div><div class="xs faint">Versión aprobada (inmutable) · ' + esc(q.approvedBy || '') + '</div></div>' + UI.badge(q.status) + '</a>' : '') +
        '<div class="list-item click" data-a="doc"><div class="ico-box">' + I('fileCheck') + '</div><div class="grow"><div class="small" style="font-weight:600">Confirmación de reserva</div><div class="xs faint">Resumen, pasajeros, servicios, condiciones y pagos</div></div>' + I('chevronRight') + '</div>' +
        (q && can('quotes.view') ? '<div class="list-item click" data-a="qdoc"><div class="ico-box">' + I('file') + '</div><div class="grow"><div class="small" style="font-weight:600">Documento de cotización v' + r.quoteVersion + '</div><div class="xs faint">Vista de impresión</div></div>' + I('chevronRight') + '</div>' : '') + '</div>', { tight: true }) + '</div></div>';
    bindActs(b, { doc: () => resDocModal(r), qdoc: () => { const v = q.versions.find(x => x.v === r.quoteVersion) || curV(q); docModal(q, v); } });
  }
  function resDocModal(r) {
    const cli = Q.client(r.clientId) || {}; const T = DB.tenant; const paid = Q.resPaid(r.id);
    UI.modal({ title: 'Confirmación de reserva — ' + esc(r.id), size: 'lg', body: UI.alert('info', 'En producción el PDF se genera por job asíncrono (PROC-060) y se publica en el portal del cliente.') + '<div style="margin-top:12px"><div class="doc"><div class="doc-head"><div class="row top" style="gap:12px;flex-wrap:nowrap"><div class="qd-logo">' + esc(T.logo) + '</div><div><h2 style="font-size:1.05rem;margin:0">' + esc(T.name) + '</h2><div class="muted xs">RUC ' + esc(T.ruc) + '</div></div></div><div class="right"><h1 style="font-size:1.1rem;margin:0">CONFIRMACIÓN DE RESERVA</h1><div class="mono" style="font-weight:600">' + esc(r.id) + '</div><div class="muted xs">Estado: ' + esc(UI.statusLabel(r.status)) + ' · ' + datetime(r.createdAt) + '</div></div></div>' +
      '<div class="qd-grid"><div><div class="qd-sec" style="margin-top:0">Cliente</div><b>' + esc(cli.name) + '</b><div class="muted xs">' + esc(cli.doc || '') + ' · ' + esc(cli.email || '') + '</div></div><div><div class="qd-sec" style="margin-top:0">Viaje</div><b>' + esc(r.title) + '</b><div class="muted xs">' + date(r.travelFrom) + ' – ' + date(r.travelTo) + ' · ' + r.passengers.length + ' pasajero(s)' + (r.quoteId ? ' · ref. ' + esc(r.quoteId) + ' v' + r.quoteVersion : '') + '</div></div></div>' +
      '<div class="qd-sec">Pasajeros</div><table><thead><tr><th>Nombre</th><th>Documento</th><th>Tipo</th><th>Nacionalidad</th></tr></thead><tbody>' + r.passengers.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.doc || '—') + '</td><td>' + esc(p.type) + '</td><td>' + esc(p.nationality || '—') + '</td></tr>').join('') + '</tbody></table>' +
      '<div class="qd-sec">Servicios</div><table><thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Estado</th><th>Confirmación</th></tr></thead><tbody>' + activeSvcs(r).slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(s => '<tr><td class="nowrap">' + dateShort(s.date) + '</td><td>' + esc(s.time || '') + '</td><td>' + esc(s.name) + '</td><td>' + esc(UI.statusLabel(s.status)) + '</td><td class="mono">' + esc(s.confirmationCode || '—') + '</td></tr>').join('') + '</tbody></table>' +
      '<table class="tot"><tbody><tr><td>Total</td><td class="num"><b>' + money(r.total, r.currency) + '</b></td></tr><tr><td>Pagado</td><td class="num">' + money(paid, r.currency) + '</td></tr><tr><td>Saldo</td><td class="num"><b>' + money(Math.max(0, r.total - paid), r.currency) + '</b></td></tr></tbody></table>' +
      '<div class="qd-sec">Condiciones</div>' + [...new Set(r.services.map(s => s.productId))].filter(Boolean).map(pid => '<div class="xs muted">' + esc(Q.productName(pid)) + ': ' + esc(resPol(r, pid).cancel || '') + '</div>').join('') + '</div></div>', actions: [{ label: 'Cerrar', cls: 'primary' }] });
  }

  /* ---- Operación (PROC-031) ---- */
  function tabOp(b, r) {
    const op = DB.operations.find(o => o.resId === r.id);
    if (op) {
      b.innerHTML = UI.card('Orden operativa ' + esc(op.id), '<div class="grid g2">' + UI.dl([['Orden', '<a class="mono" href="#/operaciones/ordenes/' + op.id + '">' + esc(op.id) + '</a>'], ['Estado', UI.badge(op.status)], ['Coordinador', UI.userChip(op.coordinator)], ['Periodo', date(op.dateFrom) + ' – ' + date(op.dateTo)]]) + '<div><div class="xs faint" style="margin-bottom:6px">Tareas (' + op.tasks.filter(t => t.done).length + '/' + op.tasks.length + ')</div>' + UI.progress(op.tasks.length ? op.tasks.filter(t => t.done).length / op.tasks.length * 100 : 0) + '<div class="col" style="gap:4px;margin-top:8px">' + op.tasks.map(t => '<div class="small ' + (t.done ? 'faint' : '') + '">' + I(t.done ? 'checkCircle' : 'clock') + ' ' + esc(t.t) + '</div>').join('') + '</div></div></div>', { actions: '<a class="btn sm primary" href="#/operaciones/ordenes/' + op.id + '">Abrir orden ' + I('arrowRight') + '</a>' }) +
        '<div style="margin-top:16px">' + UI.card('Asignaciones', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Servicio</th><th>Guía</th><th>Conductor</th><th>Vehículo</th><th>Estado</th></tr></thead><tbody>' + op.assignments.slice().sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time)).map(a => '<tr><td class="nowrap"><b>' + dateShort(a.date) + '</b> <span class="faint">' + esc(a.time || '') + '</span></td><td>' + esc(a.service) + '</td><td>' + (a.guideId ? esc((Q.guide(a.guideId) || {}).name || a.guideId) : '<span class="warn">Sin asignar</span>') + '</td><td>' + (a.driverId ? esc((Q.driver(a.driverId) || {}).name || a.driverId) : '<span class="faint">—</span>') + '</td><td>' + (a.vehicleId ? esc((Q.vehicle(a.vehicleId) || {}).plate || a.vehicleId) : '<span class="faint">—</span>') + '</td><td>' + UI.badge(a.status) + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) + '</div>';
      return;
    }
    const okSt = ['confirmada', 'pendiente_pago', 'pendiente_proveedor', 'reprogramada', 'en_operacion'].includes(r.status);
    b.innerHTML = UI.card('Orden operativa', '<div class="empty">' + I('clipboard') + '<div>Esta reserva aún no tiene orden operativa.</div><div class="xs faint" style="max-width:520px">PROC-031: Reserva confirmada → Crear orden → Replicar servicios → Fechas → Pasajeros → Proveedores → Requerimientos → Tareas → Responsables → Confirmar.</div>' + (okSt ? '<div style="margin-top:8px">' + pbtn('Generar orden operativa', 'clipboard', 'primary', 'gen', 'operations.view') + '</div>' : '<div style="margin-top:8px">' + UI.alert('warn', 'Requiere una reserva confirmada (estado actual: ' + esc(UI.statusLabel(r.status)) + ').') + '</div>') + '</div>');
    bindActs(b, { gen: () => {
      if (!need('operations.view')) return;
      const id = Seq.next('Orden operativa');
      const coord = Auth.user.role === 'operations' ? Auth.user.id : 'U05';
      const svcs = activeSvcs(r);
      const o = { id, resId: r.id, title: r.title, status: 'pendiente_asignacion', coordinator: coord, createdAt: TODAY(), dateFrom: r.travelFrom, dateTo: r.travelTo,
        tasks: [{ t: 'Confirmar servicios pendientes con proveedores', done: svcs.every(s => ['confirmado', 'completado'].includes(s.status)) }, { t: 'Completar datos nominativos de pasajeros', done: !r.passengers.some(p => p.placeholder) }, { t: 'Asignar guía, conductor y vehículo', done: false }, { t: 'Enviar rooming list / dietas a proveedores', done: false }, { t: 'Emitir vouchers', done: false }, { t: 'Llamada de bienvenida al cliente', done: false }],
        assignments: svcs.map(s => ({ serviceId: s.id, date: s.date, time: s.time, service: s.name, guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null })) };
      DB.operations.unshift(o);
      Audit.log('Orden operativa', id, 'crear', r.id, 'pendiente_asignacion · ' + o.assignments.length + ' asignaciones');
      Notify.push('operacion.creada', 'Push', coord, 'Nueva orden ' + id + ' para ' + r.id);
      Store.save(); UI.toast('Orden operativa ' + id + ' generada.'); App.go('#/operaciones/ordenes/' + id);
    } });
  }
  function tabHist(b, r) {
    const au = DB.audit.filter(a => a.entityId === r.id || r.services.some(s => s.id === a.entityId) || (a.entity === 'Cuenta por cobrar' && a.before === r.id));
    b.innerHTML = UI.card('Historial y auditoría', UI.timeline(au.map(a => ({ icon: a.action.includes('cancel') ? 'x' : a.action.includes('reprogram') ? 'calendar' : a.action.includes('modific') ? 'edit' : a.action.includes('crear') ? 'plus' : 'history', title: esc(a.entity) + ' · ' + esc(a.action.replace(/_/g, ' ')) + ' <span class="xs faint mono">' + esc(a.id) + '</span>', meta: datetime(a.ts) + ' · ' + esc(Q.userName(a.user)) + ' · IP ' + esc(a.ip), desc: (a.before ? esc(a.before) + ' → ' : '') + esc(a.after) }))), { sub: 'Toda modificación crítica queda auditada (PRD-BR-014, Regla transversal 8)' });
  }

  /* ---- Confirmar reserva ---- */
  function confirmRes(r) {
    if (!need('reservations.modify')) return;
    const svcs = activeSvcs(r).filter(s => s.required !== false);
    const checks = svcs.map(s => ({ s, av: svcAvailability(r, s) }));
    const bad = checks.filter(c => !c.av.ok);
    UI.modal({ title: 'Confirmar reserva ' + esc(r.id), sub: 'Solo se confirma si todos los servicios requeridos tienen disponibilidad (Regla transversal 4 · PRD-BR-012)',
      body: '<div class="chk-list">' + checks.map(c => ck(c.av.ok ? (c.av.warn ? 'warn' : true) : false, esc(c.s.name) + ' · ' + dateShort(c.s.date), esc(c.av.msg) + (c.av.alts ? altsHtml(c.av.alts) : ''))).join('') + ck(r.passengers.length > 0, 'Pasajeros', r.passengers.length + ' registrado(s)') + '</div>' +
        '<div style="margin-top:10px">' + (bad.length ? UI.alert('bad', '<b>Confirmación bloqueada:</b> ' + bad.length + ' servicio(s) sin disponibilidad. Use Reprogramar para mover la fecha a una salida con cupo o registre la alternativa del proveedor.') : UI.alert('ok', 'Disponibilidad verificada. Los servicios pendientes de proveedor quedarán en seguimiento.')) + '</div>',
      actions: [{ label: 'Cerrar' }].concat(bad.length ? [{ label: 'Reprogramar', cls: 'primary', icon: 'calendar', onClick: () => { setTimeout(() => reschedModal(r), 0); } }] : [{ label: 'Confirmar reserva', cls: 'primary', icon: 'checkCircle', onClick: () => {
        const bs = r.status;
        const held = {};
        activeSvcs(r).forEach(s => { if (s.depId || !s.productId) return; const p = Q.product(s.productId); if (p && p.availabilityModel === 'POR_SALIDA') { const d = (p.departures || []).find(x => x.date === s.date); if (d && !/SAL-\d{4}/.test(s.name)) { if (!held[d.id]) { d.sold += svcPax(r, s); setDepStatus(d); held[d.id] = 1; } s.depId = d.id; } } });
        const pendProv = activeSvcs(r).some(s => ['pendiente', 'solicitado'].includes(s.status));
        r.status = pendProv && bs === 'pendiente_proveedor' ? 'pendiente_proveedor' : 'confirmada';
        if (r.status === 'pendiente_proveedor') { UI.toast('Disponibilidad verificada, pero aún hay servicios sin confirmación del proveedor. La reserva se mantiene en Pend. proveedor.', 'warn'); Audit.log('Reserva', r.id, 'verificar_disponibilidad', bs, 'ok · pendiente proveedor'); Store.save(); App.render(); return; }
        if (!DB.receivables.some(c => c.resId === r.id)) createReceivables(r, 'confirmación');
        Audit.log('Reserva', r.id, 'confirmar', bs, 'confirmada');
        const cli = Q.client(r.clientId) || {}; Notify.push('reserva.confirmada', 'Email', cli.email || cli.name, 'Reserva ' + r.id + ' confirmada — ' + r.title);
        Store.save(); UI.toast('Reserva confirmada.'); App.render();
      } }]) });
  }

  /* ---- Modificar (PROC-027) ---- */
  function modifyModal(r) {
    if (!need('reservations.modify')) return;
    const perPax = r.total / Math.max(1, r.passengers.length);
    const actProds = DB.products.filter(p => p.status === 'ACTIVE' && p.flags && p.flags.bookable);
    UI.modal({ title: 'Modificar reserva ' + esc(r.id), size: 'lg', sub: 'Solicitud → Permiso → Impacto → Disponibilidad → Precio → Aprobación → Aplicar → Auditar → Notificar',
      body: '<div class="grid g2" style="align-items:start"><div>' + UI.form([
        { id: 'md-type', label: 'Tipo de modificación', type: 'select', col: 12, options: [['pax', 'Agregar pasajeros'], ['servicio', 'Agregar servicio adicional'], ['upgrade', 'Upgrade / cambio de servicio'], ['otro', 'Otro ajuste comercial']] },
        { id: 'md-n', label: 'Pasajeros adicionales', type: 'number', min: 1, col: 6, value: 1 },
        { id: 'md-prod', label: 'Servicio adicional', type: 'select', col: 12, options: actProds.map(p => [p.id, p.name]) },
        { id: 'md-date', label: 'Fecha del servicio', type: 'date', col: 6, value: r.travelFrom },
        { id: 'md-amt', label: 'Impacto en precio (' + r.currency + ')', type: 'number', step: '0.01', col: 6, value: round2(perPax), hint: 'Positivo = cargo adicional; negativo = saldo a favor' },
        { id: 'md-desc', label: 'Descripción de la solicitud', type: 'textarea', col: 12, rows: 2, required: true, placeholder: 'Ej.: el cliente agrega 1 adulto (esposa del gerente)' }
      ].concat(can('quotes.approve_internal') ? [{ id: 'md-appr', label: 'Aprobar como supervisor y aplicar ahora', type: 'checkbox', col: 12, value: true }] : [])) + '</div><div><div class="section-title" style="margin-bottom:8px">Análisis de impacto</div><div id="md-imp" class="vt-imp"></div>' + (!can('quotes.approve_internal') ? '<div class="xs faint" style="margin-top:8px">Su rol no puede aprobar modificaciones: la solicitud quedará pendiente de aprobación de un supervisor.</div>' : '') + '</div></div>',
      onOpen: (m) => {
        const g = id => m.querySelector('#' + id);
        const show = () => { const tp = g('md-type').value; g('md-n').closest('.field').style.display = tp === 'pax' ? '' : 'none'; g('md-prod').closest('.field').style.display = tp === 'servicio' ? '' : 'none'; g('md-date').closest('.field').style.display = tp === 'servicio' ? '' : 'none'; };
        const sugg = () => { const tp = g('md-type').value; if (tp === 'pax') g('md-amt').value = round2(perPax * Math.max(1, num(g('md-n').value))); if (tp === 'servicio') { const p = Q.product(g('md-prod').value); const rt = p && defaultRate(p, g('md-date').value, Q.client(r.clientId)); g('md-amt').value = rt ? round2(suggest(rt, g('md-date').value, r.currency).price * r.passengers.length) : 0; } imp(); };
        const imp = () => {
          const tp = g('md-type').value; const d = num(g('md-amt').value); const n = Math.max(1, num(g('md-n').value));
          let av = '';
          if (tp === 'pax') { const deps = uniqDeps(r, activeSvcs(r)).map(z => z.x); av = deps.length ? deps.map(x => ck(freeOf(x.d) >= n, 'Salida ' + x.d.id + ' · ' + dateShort(x.d.date), freeOf(x.d) + ' cupo(s) libre(s); se requieren ' + n)).join('') : ck('warn', 'Servicios sin control por salida', 'Se solicitará ampliación a proveedores (hold)'); }
          else if (tp === 'servicio') { const p = Q.product(g('md-prod').value); const a = p ? availFor(p.id, g('md-date').value, r.passengers.length) : null; av = a ? ck(a.ok ? (a.hold ? 'warn' : true) : false, esc(p.name), esc(a.msg) + (!a.ok ? altsHtml(a.alts) : '')) : ''; }
          else av = ck('warn', 'Disponibilidad', 'Validar con proveedor según el cambio');
          g('md-imp').innerHTML = '<div class="stat-line"><span class="muted">Total actual</span><b>' + money(r.total, r.currency) + '</b></div><div class="stat-line"><span class="muted">Diferencia</span><b class="' + (d > 0 ? 'warn' : d < 0 ? 'ok' : '') + '">' + (d >= 0 ? '+' : '−') + money(Math.abs(d), r.currency) + '</b></div><div class="stat-line total"><span>Nuevo total</span><span>' + money(r.total + d, r.currency) + '</span></div><div class="chk-list" style="margin-top:8px">' + av + ck('warn', 'Requiere aprobación', 'Supervisor con permiso quotes.approve_internal') + '</div>';
        };
        g('md-type').onchange = () => { show(); sugg(); }; g('md-n').oninput = sugg; g('md-prod').onchange = sugg; g('md-date').onchange = sugg; g('md-amt').oninput = imp;
        show(); imp();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Registrar modificación', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        const ch = { id: uid('MOD'), ts: nowStr(), by: Auth.user.id, type: f['md-type'], n: Math.max(1, num(f['md-n'])), productId: f['md-prod'], date: f['md-date'], delta: round2(f['md-amt']), desc: f['md-desc'], status: 'pendiente' };
        if (ch.type === 'pax') { const deps = uniqDeps(r, activeSvcs(r)).map(z => z.x); const short = deps.find(x => freeOf(x.d) < ch.n); if (short) { UI.toast('Sin disponibilidad: la salida ' + esc(short.d.id) + ' no tiene ' + ch.n + ' cupo(s) libre(s) (PRD-BR-012).', 'bad'); return false; } }
        if (ch.type === 'servicio') { const a = availFor(ch.productId, ch.date, r.passengers.length); if (!a.ok) { UI.toast('Sin disponibilidad para el servicio adicional: ' + esc(a.msg), 'bad'); return false; } }
        r.changes = r.changes || []; r.changes.push(ch);
        Audit.log('Reserva', r.id, 'solicitar_modificacion', '', ch.desc + ' · ' + (ch.delta >= 0 ? '+' : '') + ch.delta);
        if (f['md-appr'] && can('quotes.approve_internal')) { applyChange(r, ch, false); return; }
        Notify.push('reserva.modificacion', 'Push', 'U02', 'Aprobar modificación en ' + r.id + ': ' + ch.desc);
        Store.save(); UI.toast('Solicitud registrada: pendiente de aprobación del supervisor.', 'warn'); App.render();
      } }] });
  }
  function applyChange(r, ch, guard) {
    if (guard && !need('quotes.approve_internal')) return;
    if (!ch || ch.status !== 'pendiente') return;
    const before = money(r.total, r.currency);
    if (ch.type === 'pax') {
      for (let i = 1; i <= ch.n; i++) r.passengers.push({ name: 'Pasajero ADT adicional ' + i + ' (por completar)', doc: '', type: 'ADT', nationality: '', birth: '', phone: '', diet: '', placeholder: true });
      uniqDeps(r, activeSvcs(r)).forEach(z => { z.x.d.sold += ch.n; setDepStatus(z.x.d); });
      activeSvcs(r).forEach(s => { if (s.pax) s.pax += ch.n; });
    }
    if (ch.type === 'servicio') {
      const p = Q.product(ch.productId); const a = availFor(ch.productId, ch.date, r.passengers.length);
      const it = { productId: ch.productId, date: ch.date, qty: 1, pax: r.passengers.length, unitCost: 0, unitPrice: ch.delta / Math.max(1, r.passengers.length) };
      const rt = defaultRate(p, ch.date, Q.client(r.clientId)); if (rt) it.unitCost = suggest(rt, ch.date, r.currency).cost;
      if (a.dep) { a.dep.sold += r.passengers.length; setDepStatus(a.dep); }
      servicesFromItem(it, r.currency, 0, a.dep ? a.dep.id : null).forEach(s => r.services.push(s));
      if (ch.date > r.travelTo) r.travelTo = ch.date; if (ch.date < r.travelFrom) r.travelFrom = ch.date;
    }
    r.total = round2(r.total + ch.delta);
    if (ch.delta > 0) DB.receivables.unshift({ id: nextId('receivables', 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Ajuste por modificación — ' + ch.desc, amount: ch.delta, currency: r.currency, due: maxD(TODAY(), addDays(r.travelFrom, -7)), paid: 0, status: 'abierta' });
    if (ch.delta < 0) { let rest = -ch.delta; DB.receivables.filter(c => c.resId === r.id && !['pagada', 'cancelada'].includes(c.status)).forEach(c => { const cut = Math.min(rest, c.amount - c.paid); c.amount = round2(c.amount - cut); rest -= cut; if (c.paid >= c.amount - 0.01) c.status = 'pagada'; }); if (rest > 0.01) ch.credit = round2(rest); }
    ch.status = 'aplicada'; ch.approvedBy = Auth.user.id; ch.appliedAt = nowStr();
    Audit.log('Reserva', r.id, 'modificar', before, money(r.total, r.currency) + ' · ' + ch.desc + ' · aprobado por ' + Auth.user.id);
    const cli = Q.client(r.clientId) || {}; Notify.push('reserva.modificada', 'Email', cli.email || cli.name, 'Modificación aplicada en ' + r.id + ': ' + ch.desc);
    Store.save(); UI.toast('Modificación aprobada y aplicada. Nuevo total ' + money(r.total, r.currency) + '.'); App.render();
  }

  /* ---- Reprogramar (PROC-029) ---- */
  function reschedModal(r) {
    if (!need('reservations.modify')) return;
    if (r.services.some(s => s.status === 'completado')) { UI.toast('La reserva tiene servicios ya ejecutados; no se puede reprogramar completa. Use Modificar.', 'bad'); return; }
    const svcs = activeSvcs(r);
    const propose = () => { const d = svcs.map(s => depForService(s)).filter(Boolean)[0]; if (d) { const alt = (d.p.departures || []).find(x => x.id !== d.d.id && daysFromToday(x.date) >= 0 && freeOf(x) >= svcPax(r, svcs[0])); if (alt) return alt.date; } return addDays(r.travelFrom, 7); };
    UI.modal({ title: 'Reprogramar reserva ' + esc(r.id), size: 'lg', sub: 'Solicitud → Nueva fecha → Disponibilidad → Tarifa → Proveedor → Confirmación → Reserva → Operación → Documentos → Finanzas → Notificación',
      body: UI.form([{ id: 'rp-date', label: 'Nueva fecha de inicio', type: 'date', col: 4, required: true, value: propose(), min: TODAY() }, { id: 'rp-cur', label: 'Inicio actual', col: 4, value: date(r.travelFrom), disabled: true }, { id: 'rp-why', label: 'Motivo', col: 4, required: true, placeholder: 'Ej.: cambio de vuelo del cliente' }]) + '<div id="rp-out" style="margin-top:14px"></div>',
      onOpen: (m) => {
        const draw = () => {
          const nd = m.querySelector('#rp-date').value; if (!nd) return;
          const shift = daysBetween(r.travelFrom, nd);
          let diff = 0; let blocked = 0;
          const rows = svcs.map(s => {
            const newD = addDays(s.date, shift); const p = Q.product(s.productId); const pax = svcPax(r, s);
            const cur = depForService(s);
            let av;
            if (p && p.availabilityModel === 'POR_SALIDA') { av = availFor(p.id, newD, pax, cur ? cur.d.id : null); }
            else if (p && p.status !== 'ACTIVE') av = { ok: false, msg: 'PRD-BR-002' };
            else av = { ok: true, hold: true, msg: 'Hold con proveedor' };
            if (!av.ok) blocked++;
            const fo = (seasonOf(s.date) || { factor: 1 }).factor, fn = (seasonOf(newD) || { factor: 1 }).factor;
            const dp = round2(s.price * (fn / fo - 1)); diff += dp;
            return '<tr><td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc(Q.productName(s.productId)) + '</div></td><td class="nowrap">' + dateShort(s.date) + ' → <b>' + dateShort(newD) + '</b></td><td>' + (av.ok ? '<span class="' + (av.hold ? 'warn' : 'ok') + ' small">' + esc(av.msg) + '</span>' : '<span class="bad small">' + esc(av.msg) + '</span>' + altsHtml(av.alts)) + '</td><td class="num nowrap">×' + fmtN(fo, 2) + ' → ×' + fmtN(fn, 2) + '</td><td class="num ' + (dp > 0 ? 'warn' : dp < 0 ? 'ok' : 'faint') + '">' + (dp ? (dp > 0 ? '+' : '−') + money(Math.abs(dp), r.currency) : '—') + '</td></tr>';
          }).join('');
          m._rp = { nd, shift, diff: round2(diff), blocked };
          m.querySelector('#rp-out').innerHTML = '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Servicio</th><th>Fecha</th><th>Disponibilidad</th><th class="num">Temporada</th><th class="num">Dif. tarifaria</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="grid g2" style="margin-top:12px"><div class="vt-imp"><div class="stat-line"><span class="muted">Desplazamiento</span><b>' + (shift >= 0 ? '+' : '') + shift + ' día(s)</b></div><div class="stat-line"><span class="muted">Diferencia tarifaria</span><b class="' + (diff > 0 ? 'warn' : diff < 0 ? 'ok' : '') + '">' + (diff >= 0 ? '+' : '−') + money(Math.abs(diff), r.currency) + '</b></div><div class="stat-line total"><span>Nuevo total</span><span>' + money(r.total + diff, r.currency) + '</span></div></div><div>' +
            (blocked ? UI.alert('bad', '<b>Bloqueado:</b> ' + blocked + ' servicio(s) sin disponibilidad para la nueva fecha (PRD-BR-012). Elija una fecha con salida disponible.') : shift === 0 ? UI.alert('info', 'Seleccione una fecha distinta a la actual.') : UI.alert('ok', 'Disponibilidad verificada. Al aplicar: servicios vuelven a “pendiente” para nueva solicitud al proveedor, se liberan/retienen cupos, se actualiza la orden operativa, se anulan vouchers vigentes para reemisión y se ajustan cuentas por cobrar.')) + '</div></div>';
        };
        m.querySelector('#rp-date').onchange = draw; draw();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Aplicar reprogramación', cls: 'primary', icon: 'calendar', onClick: (m) => {
        if (!UI.validate(m)) return false; const x = m._rp; if (!x) return false;
        if (x.shift === 0) { UI.toast('La nueva fecha es igual a la actual.', 'bad'); return false; }
        if (x.blocked) { UI.toast('Regla transversal 4: no se puede reprogramar sin disponibilidad.', 'bad'); return false; }
        const why = m.querySelector('#rp-why').value.trim(); const bs = r.status; const bFrom = r.travelFrom;
        uniqDeps(r, svcs).forEach(z => { z.x.d.sold = Math.max(0, z.x.d.sold - z.pax); setDepStatus(z.x.d); });
        const held = {};
        svcs.forEach(s => {
          const pax = svcPax(r, s); const newD = addDays(s.date, x.shift);
          const p = Q.product(s.productId);
          if (p && p.availabilityModel === 'POR_SALIDA') { const nd = (p.departures || []).find(d => d.date === newD); if (nd) { if (!held[nd.id]) { nd.sold += pax; setDepStatus(nd); held[nd.id] = 1; } s.depId = nd.id; s.name = s.name.replace(/SAL-\d{4}/, nd.id); } }
          const fo = (seasonOf(s.date) || { factor: 1 }).factor, fn = (seasonOf(newD) || { factor: 1 }).factor;
          s.price = round2(s.price * fn / fo); s.cost = round2(s.cost * fn / fo);
          s.date = newD; s.status = 'pendiente'; s.confirmationCode = '';
        });
        r.travelFrom = addDays(r.travelFrom, x.shift); r.travelTo = addDays(r.travelTo, x.shift);
        r.total = round2(r.total + x.diff); r.status = 'reprogramada'; r.rescheduledAt = nowStr();
        r.changes = r.changes || []; r.changes.push({ id: uid('MOD'), ts: nowStr(), by: Auth.user.id, type: 'reprogramacion', desc: 'Reprogramación ' + date(bFrom) + ' → ' + date(r.travelFrom) + ' (' + why + ')', delta: x.diff, status: 'aplicada', approvedBy: Auth.user.id });
        const op = DB.operations.find(o => o.resId === r.id);
        if (op) { op.dateFrom = r.travelFrom; op.dateTo = r.travelTo; op.assignments.forEach(a => { const s = r.services.find(z => z.id === a.serviceId); a.date = s ? s.date : addDays(a.date, x.shift); if (a.status !== 'cancelada') a.status = 'pendiente'; }); op.status = 'pendiente_asignacion'; }
        DB.vouchers.filter(v => v.resId === r.id && v.status === 'emitido').forEach(v => { v.status = 'anulado'; Audit.log('Voucher', v.id, 'anular', 'emitido', 'anulado por reprogramación (requiere reemisión)'); });
        if (x.diff > 0) DB.receivables.unshift({ id: nextId('receivables', 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Diferencia tarifaria por reprogramación', amount: x.diff, currency: r.currency, due: maxD(TODAY(), addDays(r.travelFrom, -7)), paid: 0, status: 'abierta' });
        Audit.log('Reserva', r.id, 'reprogramar', bs + ' · ' + bFrom, 'reprogramada · ' + r.travelFrom + ' · dif ' + fmtN(x.diff) + ' · ' + why);
        const cli = Q.client(r.clientId) || {};
        Notify.push('cambio.horario', 'Email', cli.email || cli.name, 'Su reserva ' + r.id + ' fue reprogramada al ' + date(r.travelFrom));
        Notify.push('cambio.horario', 'Push', op ? op.coordinator : 'U05', 'Reprogramación ' + r.id + ': reasignar recursos y solicitar proveedores');
        Store.save(); UI.toast('Reserva reprogramada al ' + date(r.travelFrom) + '.'); App.render();
      } }] });
  }

  /* ---- Solicitud de anulación (Ventas → Gerencia) ---- */
  function requestCancel(r) {
    if (can('reservations.cancel')) { cancelModal(r); return; }
    if (!need('reservations.create')) return;
    if (own() && r.owner !== me()) { UI.toast('Solo el asesor de la reserva puede solicitar su anulación.', 'bad'); return; }
    if (CLOSED.includes(r.status)) { UI.toast('La reserva está ' + esc(UI.statusLabel(r.status)).toLowerCase() + '.', 'warn'); return; }
    if (r.cancelRequest && r.cancelRequest.status === 'pendiente') { UI.toast('Ya existe una solicitud de anulación pendiente desde ' + datetime(r.cancelRequest.ts) + '.', 'warn'); return; }
    UI.modal({ title: 'Solicitar anulación — ' + esc(r.id), size: 'sm', sub: 'La cancelación la ejecuta Gerencia (permiso reservations.cancel)',
      body: UI.alert('info', 'Se notificará a Gerencia para que evalúe la política de cancelación, penalidades y reembolso. La reserva sigue vigente hasta su decisión.') + '<div style="margin-top:12px">' + UI.form([{ id: 'rq-why', label: 'Motivo', type: 'select', col: 12, options: ['Solicitud del cliente', 'Cambio de itinerario del cliente', 'Fuerza mayor / clima', 'Falta de pago', 'Otro'] }, { id: 'rq-det', label: 'Detalle', type: 'textarea', rows: 3, required: true, col: 12, placeholder: 'Ej.: el cliente cancela por viaje de trabajo; solicita conocer la penalidad.' }]) + '</div>',
      actions: [{ label: 'Volver' }, { label: 'Enviar solicitud', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const reason = f['rq-why'] + ': ' + f['rq-det'];
        r.cancelRequest = { by: me(), ts: nowStr(), reason, status: 'pendiente' };
        Audit.log('Reserva', r.id, 'solicitar_anulacion', r.status, 'pendiente de gerencia · ' + reason);
        managers().forEach(u => Notify.push('reserva.anulacion_solicitada', 'Portal', u, 'Anulación solicitada para ' + r.id + ' por ' + Auth.user.name + ': ' + reason));
        Store.save(); UI.toast('Solicitud de anulación enviada a Gerencia.', 'warn'); App.render();
      } }] });
  }
  function rejectCancelReq(r) {
    if (!need('reservations.cancel')) return;
    const cr = r.cancelRequest; if (!cr || cr.status !== 'pendiente') return;
    UI.confirm({ title: 'Rechazar solicitud de anulación', message: 'La reserva <b>' + esc(r.id) + '</b> seguirá vigente. Se notificará a ' + esc(Q.userName(cr.by)) + '.', confirmLabel: 'Rechazar solicitud', reason: true, reasonLabel: 'Motivo',
      onConfirm: (t) => { Object.assign(cr, { status: 'rechazada', decidedBy: me(), decidedAt: nowStr(), decisionNote: t }); Audit.log('Reserva', r.id, 'rechazar_solicitud_anulacion', 'pendiente', 'rechazada · ' + t); Notify.push('reserva.anulacion_rechazada', 'Portal', cr.by, 'Gerencia rechazó la anulación de ' + r.id + (t ? ': ' + t : '')); Store.save(); UI.toast('Solicitud rechazada.', 'warn'); App.render(); } });
  }

  /* ---- Cancelar (PROC-028 · E2E-09) ---- */
  function cancelModal(r) {
    if (!need('reservations.cancel')) return;
    const paid = Q.resPaid(r.id);
    const svcs = r.services.filter(s => !['cancelado', 'completado'].includes(s.status) && !(s.status === 'rechazado'));
    const lines = svcs.map(s => { const days = daysFromToday(s.date); const po = resPol(r, s.productId); const pct = penaltyPct(tiersFor(po.cancel), days); return { s, days, pct, pen: round2(s.price * pct / 100), pol: po.cancel }; });
    const used = r.services.filter(s => s.status === 'completado');
    const allTot = sum(svcs.concat(used), 'price') || 1;
    const penSvc = sum(lines, 'pen'); const consumed = sum(used, 'price');
    const k = r.total / allTot;
    const pen = round2(Math.min(r.total, (penSvc + consumed) * k));
    const refund = round2(Math.max(0, paid - pen)); const owed = round2(Math.max(0, pen - paid));
    const deps = uniqDeps(r, svcs);
    const vou = DB.vouchers.filter(v => v.resId === r.id && v.status === 'emitido');
    UI.modal({ title: 'Cancelar reserva ' + esc(r.id), size: 'lg', sub: 'Solicitud → Política → Impacto económico → Confirmar → Liberar disponibilidad → Cancelar servicios → Finanzas → Notificar → Auditar',
      body: '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Servicio</th><th>Fecha</th><th class="num">Días antes</th><th>Política aplicada</th><th class="num">% penalidad</th><th class="num">Penalidad</th></tr></thead><tbody>' + lines.map(l => '<tr><td>' + esc(l.s.name) + '</td><td class="nowrap">' + dateShort(l.s.date) + '</td><td class="num">' + l.days + '</td><td class="xs muted" style="max-width:260px">' + esc(l.pol || '') + '</td><td class="num ' + (l.pct ? 'warn' : 'ok') + '">' + l.pct + '%</td><td class="num">' + money(l.pen, r.currency) + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="grid g2" style="margin-top:12px;align-items:start"><div class="vt-imp"><div class="section-title" style="margin-bottom:6px">Impacto económico</div><div class="stat-line"><span class="muted">Total de la reserva</span><b>' + money(r.total, r.currency) + '</b></div><div class="stat-line"><span class="muted">Monto pagado</span><b>' + money(paid, r.currency) + '</b></div>' + (consumed ? '<div class="stat-line"><span class="muted">Servicios ya ejecutados (no reembolsables)</span><b>' + money(round2(consumed * k), r.currency) + '</b></div>' : '') + '<div class="stat-line"><span class="muted">Penalidad según política</span><b class="warn">' + money(round2(penSvc * k), r.currency) + '</b></div><div class="stat-line"><span class="muted">Total retenido</span><b class="warn">' + money(pen, r.currency) + '</b></div><div class="stat-line total"><span>Reembolso al cliente</span><span class="ok">' + money(refund, r.currency) + '</span></div>' + (owed ? '<div class="stat-line"><span class="muted">Penalidad por cobrar</span><b class="bad">' + money(owed, r.currency) + '</b></div>' : '') + '</div>' +
        '<div><div class="section-title" style="margin-bottom:6px">Efectos de la cancelación</div><div class="chk-list">' +
        ck(true, 'Liberar disponibilidad', deps.length ? deps.map(z => esc(z.x.d.id) + ' −' + z.pax + ' cupo(s)').join(' · ') : 'Sin cupos por salida retenidos; se notifica liberación a proveedores') +
        ck(true, 'Cancelar servicios', svcs.length + ' servicio(s) pasan a “cancelado”') +
        ck(true, 'Anular vouchers', vou.length ? vou.map(v => esc(v.id)).join(', ') : 'Sin vouchers vigentes') +
        ck(true, 'Finanzas', 'CxC abiertas se cancelan' + (refund ? '; nota de crédito y reembolso por ' + money(refund, r.currency) : '') + (owed ? '; CxC de penalidad ' + money(owed, r.currency) : '')) +
        ck(true, 'Notificar y auditar', 'Cliente, operaciones y finanzas · Regla transversal 8') + '</div></div></div>' +
        '<div style="margin-top:12px">' + UI.form([{ id: 'cn-why', label: 'Motivo de la cancelación', type: 'select', col: 6, options: ['Solicitud del cliente', 'Cambio de itinerario del cliente', 'Fuerza mayor / clima', 'Falta de pago', 'Proveedor sin disponibilidad', 'Otro'] }, { id: 'cn-det', label: 'Detalle (obligatorio)', col: 6, required: true, placeholder: 'Describa el motivo', value: r.cancelRequest && r.cancelRequest.status === 'pendiente' ? 'Solicitado por ' + Q.userName(r.cancelRequest.by) + ' — ' + r.cancelRequest.reason : '' }]) + '</div>',
      actions: [{ label: 'Volver' }, { label: 'Confirmar cancelación', cls: 'danger', icon: 'x', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const reason = f['cn-why'] + ': ' + f['cn-det']; const bs = r.status;
        deps.forEach(z => { const bsold = z.x.d.sold; z.x.d.sold = Math.max(0, z.x.d.sold - z.pax); setDepStatus(z.x.d); Audit.log('Disponibilidad', z.x.d.id, 'liberar', 'vendidos ' + bsold, 'vendidos ' + z.x.d.sold + ' (' + r.id + ')'); });
        svcs.forEach(s => { s.status = 'cancelado'; });
        vou.forEach(v => { v.status = 'anulado'; Audit.log('Voucher', v.id, 'anular', 'emitido', 'anulado por cancelación ' + r.id); });
        DB.receivables.filter(c => c.resId === r.id && !['pagada', 'cancelada'].includes(c.status)).forEach(c => { const b = c.status; c.status = 'cancelada'; Audit.log('Cuenta por cobrar', c.id, 'cancelar', b, 'cancelada'); });
        if (owed > 0) DB.receivables.unshift({ id: nextId('receivables', 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Penalidad por cancelación — ' + r.id, amount: owed, currency: r.currency, due: addDays(TODAY(), 7), paid: 0, status: 'abierta' });
        if (refund > 0) {
          const nc = Seq.next('Factura');
          DB.invoices.unshift({ id: nc, type: 'Nota de crédito', clientId: r.clientId, resId: r.id, amount: refund, currency: r.currency, date: TODAY(), status: 'emitido', detail: 'Anulación por cancelación ' + r.id + ' (penalidad ' + money(pen, r.currency) + ')' });
          const pid = nextId('payments', 'PAG-', 5);
          DB.payments.unshift({ id: pid, receivableId: null, resId: r.id, method: 'Reembolso (mismo medio de pago)', amount: refund, currency: r.currency, date: TODAY(), status: 'pendiente', ref: 'Reembolso ' + nc + ' · 7–15 días hábiles', by: Auth.user.id, kind: 'reembolso' });
          Audit.log('Nota de crédito', nc, 'emitir', '', money(refund, r.currency) + ' · reembolso ' + pid);
        }
        const op = DB.operations.find(o => o.resId === r.id);
        if (op) { const b = op.status; op.status = 'cancelada'; op.assignments.forEach(a => { if (a.status !== 'completada') a.status = 'cancelada'; }); Audit.log('Orden operativa', op.id, 'cancelar', b, 'cancelada por ' + r.id); }
        r.status = 'cancelada'; r.cancelReason = reason; r.cancelledAt = nowStr(); r.penalty = pen; r.refund = refund;
        if (r.cancelRequest && r.cancelRequest.status === 'pendiente') { Object.assign(r.cancelRequest, { status: 'aprobada', decidedBy: me(), decidedAt: nowStr(), decisionNote: reason }); Notify.push('reserva.anulacion_aprobada', 'Portal', r.cancelRequest.by, 'Gerencia procesó la anulación de ' + r.id); }
        Audit.log('Reserva', r.id, 'cancelar', bs, 'cancelada · penalidad ' + fmtN(pen) + ' · reembolso ' + fmtN(refund) + ' · ' + reason);
        const cli = Q.client(r.clientId) || {};
        Notify.push('reserva.cancelada', 'Email', cli.email || cli.name, 'Cancelación de su reserva ' + r.id + (refund ? ' · reembolso ' + money(refund, r.currency) : ''));
        Notify.push('reserva.cancelada', 'Push', op ? op.coordinator : 'U05', 'Reserva ' + r.id + ' cancelada: liberar recursos');
        Notify.push('reserva.cancelada', 'Portal', 'U07', 'Cancelación ' + r.id + ': procesar ' + (refund ? 'reembolso ' + money(refund, r.currency) : 'penalidad'));
        Store.save(); UI.toast('Reserva cancelada. Penalidad ' + money(pen, r.currency) + ' · reembolso ' + money(refund, r.currency) + '.', 'warn'); App.render();
      } }] });
  }

  /* ======================================================================
     Rutas
     ====================================================================== */
  const noAccess = (el, perm, title) => { el.innerHTML = '<div class="page vt-page">' + UI.pageHeader({ title, crumbs: [['Inicio', '#/dashboard'], ['Ventas'], [title]] }) + UI.alert('warn', 'Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <b>' + perm + '</b> para acceder a esta pantalla.') + '</div>'; };
  const notFound = (el, what, back) => { el.innerHTML = '<div class="page vt-page">' + UI.card('', UI.empty(what + ' no existe o no pertenece a este tenant.', 'search') + '<div class="center" style="padding-bottom:16px"><a class="btn" href="' + back + '">Volver</a></div>') + '</div>'; };

  /* =====================================================================================
     v2.1 — Motor de reservas: reserva web (r.booking), comentarios del pasajero y siembra demo
     Fuente única de reglas y precios: window.BookingEngine (BE). Contrato r.booking en BRIEF_V21.
     ===================================================================================== */
  const BE = () => window.BookingEngine;
  const bkProd = (r) => { if (r.booking && r.booking.productId) return Q.product(r.booking.productId) || null; const s = (r.services || []).find(x => x.productId); return s ? Q.product(s.productId) : null; };
  const ruleOn = (id, r) => !BE() || BE().on(id, bkProd(r));
  const ruleName = (id) => { const x = BE() && BE().rule(id); return x ? x.name : id; };
  /* En el back-office el snapshot se muestra aunque la regla se desactive después (dato histórico), con aviso. */
  const ruleTag = (id, r) => ruleOn(id, r) ? '' : ' <span class="tag" title="La regla está desactivada actualmente; se muestra el dato capturado al reservar">' + esc(id) + ' inactiva · dato histórico</span>';
  const REL_OPTS = ['Titular', 'Cónyuge / pareja', 'Hijo/a', 'Padre / madre', 'Hermano/a', 'Amigo/a', 'Otro'];
  const ageAt = (birth, ref) => { if (!birth) return null; const b = Util.parseD(birth), d = Util.parseD(ref || TODAY()); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
  const paxAge = (p, r) => p.age != null && p.age !== '' ? +p.age : ageAt(p.birth, r.travelFrom);
  const specialTags = (t) => (window.PaxExp ? window.PaxExp.specialTags(t) : []).map(x => '<span class="badge b-' + x[0] + '">' + esc(x[1]) + '</span>').join(' ');
  function bkNorm(r) {
    if (window.PaxExp) return window.PaxExp.bk(r);
    const b = r.booking; if (!b) return null; const cur = r.currency; const lod = b.lodging || [];
    return { b, cur, disp: b.currencyDisplay || cur, rate: b.fxRate || 1, lodging: lod, rooms: b.rooms || 0, nights: b.nights || 0, fmt: (n, c) => money(n, c || cur), inDisp: (n) => n };
  }
  const fbList = (r) => (DB.paxFeedback || []).filter(f => f.resId === r.id).sort((a, c) => String(c.createdAt).localeCompare(String(a.createdAt)));

  /* ---- Siembra: una reserva web de ejemplo (PRD-011, Familia Castañeda, 10–19 oct 2026) ---- */
  const DEMO_FEEDBACK = [];
  (function seedBookingDemo() {
    try {
      if (!BE() || DB.reservations.some(r => r.booking)) return;
      const p = Q.product('PRD-011'); const cli = Q.client('CLI-0005'); if (!p || !cli) return;
      const be = BE(); const date0 = '2026-10-10';
      const sel = { date: date0, pax: { adt: 2, chd: 1, inf: 1 }, currency: 'USD', paymentMode: 'adelanto', channel: 'E-commerce',
        addons: [{ id: 'ADD-1102', qty: 3 }, { id: 'ADD-1106', qty: 2 }],
        lodging: [{ legId: 'LEG-1', hotelId: 'H-LIM-4', rooms: [{ type: 'Triple', qty: 1 }] }, { legId: 'LEG-2', hotelId: 'H-AQP-4', rooms: [{ type: 'Triple', qty: 1 }] }, { legId: 'LEG-3', hotelId: 'H-PUN-4', rooms: [{ type: 'Triple', qty: 1 }] }, { legId: 'LEG-4', hotelId: 'H-CUS-5', rooms: [{ type: 'Doble', qty: 2 }] }] };
      const q = be.quote(p, sel);
      const lines = q.lines.filter(l => !l.removed).map(l => Object.assign({}, l));
      const lodging = lines.filter(l => l.kind === 'lodging').map(l => ({ legId: l.legId, city: l.city, hotel: l.hotel, roomType: l.roomType, rooms: l.rooms, nights: l.nights }));
      const addons = lines.filter(l => l.kind === 'addon').map(l => ({ id: l.addonId, name: l.label, qty: l.qty, amount: round2(l.amount) }));
      const total = round2(q.total); const deposit = round2(q.deposit); const balance = round2(total - deposit);
      const id = Seq.next('Reserva'); const created = '2026-08-20 10:15';
      const legOf = (legId) => p.accommodation.legs.find(x => x.id === legId);
      /* Servicios: itinerario del circuito + alojamiento por ciudad + adicionales + traslado de llegada */
      const base = lines.filter(l => l.kind === 'base').reduce((a, l) => a + l.amount, 0);
      const baseCost = 2 * 1180 + 850;
      const svcs = []; let n = 0; const sid = () => 'RS-' + id.slice(-3) + String(++n).padStart(2, '0');
      const tourDays = p.itinerary.filter(d => d.day < 10);
      const pickupTime = '09:35';
      svcs.push({ id: sid(), productId: 'PRD-011', name: 'Traslado de llegada: aeropuerto Jorge Chávez → Miraflores (Lima)', date: date0, time: pickupTime, providerId: 'PRV-004', status: 'confirmado', cost: 38, price: round2(base * 0.02), confirmationCode: 'QT-90210', pickup: true });
      tourDays.forEach((d, i) => { const it = d.items[d.items.length - 1]; svcs.push({ id: sid(), productId: 'PRD-011', name: d.title.replace(/^Lima: llegada y centro histórico$/, 'City tour colonial y moderno (Lima)'), date: be.util.addDays(date0, d.day - 1), time: it.time, providerId: i === 8 ? 'PRV-005' : 'PRV-012', status: i >= 8 ? 'solicitado' : 'confirmado', cost: round2((baseCost - 38) / tourDays.length), price: round2(base * 0.98 / tourDays.length), confirmationCode: i >= 8 ? '' : 'PC-' + (4410 + i) }); });
      svcs.push({ id: sid(), productId: 'PRD-011', name: 'Traslado de salida → aeropuerto de Cusco', date: '2026-10-19', time: '10:00', providerId: 'PRV-004', status: 'confirmado', cost: 16, price: 0, confirmationCode: 'QT-90211' });
      let off = 0;
      p.accommodation.legs.forEach(leg => { const ls = lines.filter(l => l.kind === 'lodging' && l.legId === leg.id); const d = be.util.addDays(date0, off); off += leg.nights; if (!ls.length) return; const h = leg.hotels.find(x => x.name === ls[0].hotel) || {}; const amount = ls.reduce((a, l) => a + l.amount, 0); svcs.push({ id: sid(), productId: 'PRD-011', name: h.name + ' — ' + ls.map(l => l.rooms + ' hab. ' + l.roomType.toLowerCase()).join(' + ') + ' × ' + leg.nights + ' noche(s)', date: d, time: '14:00', providerId: h.providerId || null, status: 'confirmado', cost: round2(amount * 0.82), price: round2(amount), confirmationCode: 'HT-' + leg.id.slice(-1) + '7731', lodgingLeg: leg.id }); });
      lines.filter(l => l.kind === 'addon').forEach(l => { const dt = l.addonId === 'ADD-1102' ? '2026-10-11' : '2026-10-18'; svcs.push({ id: sid(), productId: 'PRD-011', name: (/^Entrada/i.test(l.label) ? l.label : 'Entrada ' + l.label) + ' ×' + l.qty, date: dt, time: l.addonId === 'ADD-1102' ? '15:00' : '07:00', providerId: l.addonId === 'ADD-1106' ? 'PRV-009' : null, status: 'confirmado', cost: round2(l.amount * 0.9), price: round2(l.amount), confirmationCode: l.addonId === 'ADD-1106' ? 'MP-HP-2210' : '', addonId: l.addonId }); });
      const diff = round2(total - svcs.reduce((a, s) => a + s.price, 0)); svcs[1].price = round2(svcs[1].price + diff);
      const r = { id, quoteId: null, quoteVersion: null, clientId: cli.id, title: 'Castañeda — Perú Clásico 10D/9N (web)', status: 'confirmada', channel: 'E-commerce', travelFrom: date0, travelTo: '2026-10-19', currency: 'USD', total, owner: cli.owner || 'U04', createdAt: created, sede: 'SED-01', notes: 'Reserva del sitio web con alojamiento por ciudad. Aniversario de bodas (14/10 en Puno).',
        passengers: [
          { name: 'José Castañeda Ugarte', doc: 'DNI 41220988', type: 'ADT', nationality: 'Peruana', birth: '1982-03-15', phone: '987 450 221', email: 'jcastaneda@correo.pe', diet: '', relationship: 'Titular', age: 44, isLead: true },
          { name: 'Rosa Ugarte de Castañeda', doc: 'DNI 41337520', type: 'ADT', nationality: 'Peruana', birth: '1984-07-02', phone: '987 450 229', email: 'rosa.ugarte@correo.pe', diet: '', relationship: 'Cónyuge / pareja', age: 42, isLead: false },
          { name: 'Sebastián Castañeda Ugarte', doc: 'DNI 79120455', type: 'CHD', nationality: 'Peruana', birth: '2018-05-21', phone: '', email: '', diet: 'Alergia a frutos secos', relationship: 'Hijo/a', age: 8, isLead: false },
          { name: 'Valentina Castañeda Ugarte', doc: 'DNI 91004872', type: 'INF', nationality: 'Peruana', birth: '2024-02-11', phone: '', email: '', diet: '', relationship: 'Hijo/a', age: 2, isLead: false }
        ],
        services: svcs,
        booking: { productId: p.id, date: date0, pax: sel.pax, currencyDisplay: 'PEN', fxRate: be.currency('USD').rate, chargeCurrency: 'USD', lines, adjustments: q.adjustments, total, lodging, rooms: q.rooms, nights: q.nights, addons,
          pickup: { point: 'Aeropuerto Jorge Chávez, Lima (indique vuelo)', address: 'Hotel Costa Verde Suites, Malecón de la Reserva 615, Miraflores', flight: 'LA2047 Trujillo → Lima', arrival: date0 + ' ' + pickupTime },
          comments: 'Aniversario de bodas; niño alérgico a los frutos secos',
          payment: { mode: 'adelanto', depositPct: q.depositPct, deposit, balance, balanceDue: '2026-09-10' },
          rulesApplied: ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-COMPANIONS', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-ADDONS', 'R-SEASON', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PREVIEW-REMOVE', 'R-PICKUP', 'R-COMMENTS', 'R-NOMINATIVE'],
          source: 'Sitio web', orderId: 'WEB-10412', createdAt: created }
      };
      DB.reservations.unshift(r);
      /* Finanzas: CxC adelanto (pagado con tarjeta e-commerce) y saldo (30 días antes, vencido) */
      const c1 = { id: nextId('receivables', 'CXC-', 5), resId: id, clientId: cli.id, concept: 'Adelanto ' + q.depositPct + ' % — Castañeda Perú Clásico (web)', amount: deposit, currency: 'USD', due: '2026-08-20', paid: deposit, status: 'pagada' }; DB.receivables.unshift(c1);
      const c2 = { id: nextId('receivables', 'CXC-', 5), resId: id, clientId: cli.id, concept: 'Saldo ' + (100 - q.depositPct) + ' % — Castañeda Perú Clásico (web)', amount: balance, currency: 'USD', due: '2026-09-10', paid: 0, status: 'vencida' }; DB.receivables.unshift(c2);
      DB.payments.unshift({ id: nextId('payments', 'PAG-', 5), receivableId: c1.id, resId: id, method: 'Tarjeta (e-commerce)', amount: deposit, currency: 'USD', date: '2026-08-20', status: 'aplicado', ref: 'TXN 9120-WB12 · pedido WEB-10412', by: 'Sistema' });
      /* Orden operativa (coordina Operaciones Lima/Cusco) */
      const op = { id: Seq.next('Orden operativa'), resId: id, title: r.title, status: 'pendiente_asignacion', coordinator: 'U05', createdAt: '2026-09-22', dateFrom: r.travelFrom, dateTo: r.travelTo, tasks: [{ t: 'Enviar solicitudes a proveedores', done: true }, { t: 'Asignar guías, conductores y vehículos', done: false }, { t: 'Confirmar torta de aniversario en Puno (14/10)', done: false }, { t: 'Informar alergia a frutos secos a restaurantes y hoteles', done: false }, { t: 'Silla de bebé para traslados (infante 2 años)', done: false }],
        assignments: svcs.filter(s => s.providerId && !/hotel|hab\.|entrada/i.test(s.name)).map(s => ({ serviceId: s.id, date: s.date, time: s.time, service: s.name, guideId: null, driverId: null, vehicleId: null, status: 'pendiente', checkin: null })), evidence: [] };
      DB.operations.unshift(op);
      if (!DB.paxFeedback) DB.paxFeedback = [];
      DB.paxFeedback.unshift(
        { id: 'FB-00002', resId: id, passenger: 'José Castañeda Ugarte', type: 'sugerencia', rating: null, serviceId: svcs[0].id, text: '¿Podrían asignar una silla de bebé en el traslado del aeropuerto? Viajamos con nuestra hija de 2 años.', createdAt: '2026-09-28 21:40', status: 'nuevo', reply: null, repliedAt: null, repliedBy: null, channel: 'Portal pasajero', contact: { email: 'jcastaneda@correo.pe', phone: '987 450 221' } },
        { id: 'FB-00001', resId: id, passenger: 'José Castañeda Ugarte', type: 'comentario', rating: 5, serviceId: null, text: 'El 14 de octubre es nuestro aniversario de bodas. ¿Es posible preparar una sorpresa sencilla en la cena de Puno?', createdAt: '2026-09-24 19:05', status: 'respondido', reply: 'Con gusto, Sr. Castañeda. Coordinamos con el Titicaca Lodge una torta pequeña (sin frutos secos) y una mesa con vista al lago para el 14/10. Sin costo adicional.', repliedAt: '2026-09-25 09:20', repliedBy: 'U05', channel: 'Portal pasajero', contact: { email: 'jcastaneda@correo.pe', phone: '987 450 221' } }
      );
      DEMO_FEEDBACK.push(id);
      Store.save();
    } catch (e) { console.error('Siembra reserva web v2.1', e); }
  })();
  /* Mensajes de la reserva demo: DB.paxMessages pertenece a experiencia.js (carga después); se agregan al terminar la carga */
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const r = DB.reservations.find(x => x.booking && x.booking.orderId === 'WEB-10412'); if (!r) return;
      if (!DB.paxMessages) DB.paxMessages = [];
      if (DB.paxMessages.some(m => m.resId === r.id)) return;
      const to = 'jcastaneda@correo.pe';
      DB.paxMessages.push(
        { id: 'PMS-' + r.id.slice(-4) + '-1', resId: r.id, templateId: null, channel: 'email', to, subject: 'Confirmación de su reserva ' + r.id + ' — Perú Clásico 10D/9N', body: 'Estimado José:\n\nSu reserva ' + r.id + ' (Perú Clásico 10D/9N, del 10 al 19 de octubre de 2026) está confirmada. Recibimos su adelanto del ' + r.booking.payment.depositPct + ' %. El saldo de ' + money(r.booking.payment.balance, 'USD') + ' vence el 10/09/2026.\n\nPuede revisar su viaje en el portal del pasajero.\n\nAndes Horizonte Travel', status: 'leido', scheduledAt: '2026-08-20 10:16', sentAt: '2026-08-20 10:16', readAt: '2026-08-20 12:40', direction: 'saliente' },
        { id: 'PMS-' + r.id.slice(-4) + '-2', resId: r.id, templateId: null, channel: 'whatsapp', to: '987 450 221', subject: 'Recordatorio: saldo de su viaje vencido', body: 'Hola José, le recordamos que el saldo de ' + money(r.booking.payment.balance, 'USD') + ' de su reserva ' + r.id + ' venció el 10/09. Puede pagarlo en línea desde su portal. Gracias.', status: 'entregado', scheduledAt: '2026-09-15 09:00', sentAt: '2026-09-15 09:00', readAt: null, direction: 'saliente' },
        { id: 'PMS-' + r.id.slice(-4) + '-3', resId: r.id, templateId: null, channel: 'portal', to, subject: 'Respuesta a su comentario FB-00001', body: 'Con gusto, Sr. Castañeda. Coordinamos con el Titicaca Lodge una torta pequeña (sin frutos secos) y una mesa con vista al lago para el 14/10. Sin costo adicional.', status: 'enviado', scheduledAt: '2026-09-25 09:20', sentAt: '2026-09-25 09:20', readAt: null, direction: 'saliente', feedbackId: 'FB-00001' }
      );
      Store.save();
      if (/^#\/(reservas|canales|mobile|operaciones)/.test(location.hash) && Auth.user) App.render();
    } catch (e) { console.error('Siembra mensajes v2.1', e); }
  });

  const FBT = { comentario: ['borrador', 'Comentario'], sugerencia: ['abierta', 'Sugerencia'], felicitacion: ['ok', 'Felicitación'], reclamo: ['rechazado', 'Reclamo'], incidencia: ['alta', 'Incidencia'] };
  const FBS = { nuevo: ['pendiente', 'Nuevo'], leido: ['abierta', 'Leído'], respondido: ['ok', 'Respondido'], derivado: ['en_proceso', 'Derivado'] };
  const stars = (n) => n ? '<span style="color:var(--sun);white-space:nowrap" title="' + n + ' de 5">' + '★★★★★'.slice(0, n) + '<span style="color:var(--line)">' + '★★★★★'.slice(n) + '</span></span>' : '';

  /* ---- Pestaña: Detalle de la reserva web ---- */
  function tabWeb(b, r) {
    const k = bkNorm(r); if (!k) { b.innerHTML = UI.empty('Esta reserva no se creó desde el sitio web ni el widget.', 'globe'); return; }
    const bb = k.b; const p = bkProd(r); const hideAmt = can('operations.view') && !seeMargin(r) ? true : false;
    const multi = k.disp !== k.cur;
    const amt = (n) => k.fmt(n) + (multi ? '<div class="xs faint">≈ ' + k.fmt(k.inDisp(n), k.disp) + '</div>' : '');
    const px = bb.pax || { adt: r.passengers.filter(x => x.type === 'ADT').length, chd: r.passengers.filter(x => x.type === 'CHD').length, inf: r.passengers.filter(x => x.type === 'INF').length };
    const rcv = DB.receivables.filter(c => c.resId === r.id);
    const pay = bb.payment || {}; const pk = bb.pickup || {};
    const LK = { base: 'Tour', addon: 'Adicional', lodging: 'Alojamiento', surcharge: 'Recargo', info: 'Info' };
    const cards = [];
    cards.push(UI.card('Origen y moneda', '<div class="grid g2">' + UI.dl([['Producto', p ? (Access.canRoute('catalogo/productos/' + p.id) ? prodLink(p.id) : esc(p.name)) : esc(bb.productId)], ['Fecha de salida', date(bb.date || r.travelFrom)], ['Composición', px.adt + ' ADT · ' + (px.chd || 0) + ' CHD · ' + (px.inf || 0) + ' INF'], ['Origen', esc(bb.source || r.channel) + (bb.orderId ? ' · pedido <span class="mono">' + esc(bb.orderId) + '</span>' : '')]]) +
      UI.dl([['Moneda mostrada', esc(k.disp) + ruleTag('R-MULTICURRENCY', r)], ['Moneda cobrada', esc(k.cur)], ['Tipo de cambio', multi ? '1 ' + esc(k.cur) + ' = ' + fmtN(k.rate, 4) + ' ' + esc(k.disp) + ' <span class="xs faint">(conservado al reservar · regla transversal 15)</span>' : 'No aplica (misma moneda)'], hideAmt ? null : ['Total cobrado', '<b>' + k.fmt(bb.total != null ? bb.total : r.total) + '</b>' + (multi ? ' <span class="xs faint">≈ ' + k.fmt(k.inDisp(bb.total != null ? bb.total : r.total), k.disp) + '</span>' : '')]]) + '</div>'));
    if (!hideAmt && (bb.lines || []).length) cards.push(UI.card('Líneas y ajustes (previsualización aceptada por el cliente)', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Concepto</th><th>Tipo</th><th class="num">Cant.</th><th class="num">P. unitario</th><th class="num">Importe</th></tr></thead><tbody>' +
      bb.lines.filter(l => l.kind !== 'info').map(l => '<tr><td>' + esc(l.label) + '</td><td><span class="tag">' + esc(LK[l.kind] || l.kind) + '</span></td><td class="num">' + (l.qty || '') + '</td><td class="num">' + k.fmt(l.unit || 0) + '</td><td class="num">' + amt(l.amount || 0) + '</td></tr>').join('') +
      (bb.adjustments || []).map(a => '<tr><td>' + esc(a.label) + '</td><td><span class="tag">Ajuste</span></td><td></td><td></td><td class="num ' + (a.amount < 0 ? 'ok' : 'warn') + '">' + amt(a.amount) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="4">Total</td><td class="num">' + amt(bb.total != null ? bb.total : r.total) + '</td></tr></tfoot></table></div>' + (bb.lines.some(l => l.kind === 'info') ? '<div class="card-b xs faint" style="border-top:1px solid var(--line-2)">' + bb.lines.filter(l => l.kind === 'info').map(l => esc(l.label)).join(' · ') + '</div>' : ''), { tight: true }));
    if (k.lodging.length) cards.push(UI.card('Alojamiento por ciudad' + ruleTag('R-LODGING', r), '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ciudad</th><th>Hotel</th><th>Tipo</th><th class="num">Habitaciones</th><th class="num">Noches</th><th class="num">Hab.-noche</th></tr></thead><tbody>' + k.lodging.map(l => '<tr><td>' + esc(l.city) + '</td><td>' + esc(l.hotel) + '</td><td>' + esc(l.roomType) + '</td><td class="num">' + (l.rooms || 0) + '</td><td class="num">' + (l.nights || 0) + '</td><td class="num">' + ((l.rooms || 0) * (l.nights || 0)) + '</td></tr>').join('') + '</tbody><tfoot><tr><td colspan="3">Totales</td><td class="num">' + k.rooms + '</td><td class="num">' + k.nights + '</td><td class="num">' + k.lodging.reduce((a, l) => a + (l.rooms || 0) * (l.nights || 0), 0) + '</td></tr></tfoot></table></div><div class="card-b xs faint" style="border-top:1px solid var(--line-2)">Total de habitaciones = suma de habitaciones por ciudad; total de noches = noches del circuito con alojamiento. Operaciones puede prellenar la rooming list desde este bloque.</div>', { tight: true }));
    const side = [];
    if ((bb.addons || []).length) side.push(UI.card('Adicionales' + ruleTag('R-ADDONS', r), bb.addons.map(a => '<div class="stat-line"><span>' + esc(a.name) + ' × ' + a.qty + '</span>' + (hideAmt ? '' : '<b class="num">' + k.fmt(a.amount) + '</b>') + '</div>').join('')));
    if (pk.point || pk.flight) side.push(UI.card('Punto de recojo y vuelo' + ruleTag('R-PICKUP', r), UI.dl([['Punto', esc(pk.point || '—')], pk.address ? ['Dirección', esc(pk.address)] : null, ['Vuelo de llegada', esc(pk.flight || '—')], ['Llegada', pk.arrival ? datetime(pk.arrival) : '—']])));
    if (bb.comments) side.push(UI.card('Comentarios del cliente' + ruleTag('R-COMMENTS', r), '<div style="border-left:3px solid var(--sun);background:var(--sun-soft);padding:9px 12px;border-radius:0 8px 8px 0;font-size:.9rem;overflow-wrap:anywhere">' + esc(bb.comments) + '</div><div class="row" style="gap:6px;margin-top:8px">' + specialTags(bb.comments + ' ' + r.passengers.map(x => x.diet || '').join(' ')) + '</div>'));
    if (!hideAmt && pay.mode) side.push(UI.card('Plan de pago' + ruleTag(pay.mode === 'pagar_despues' ? 'R-PAY-LATER' : 'R-DEPOSIT', r), '<div class="stat-line"><span class="muted">Modalidad</span><b>' + ({ total: 'Pago total', adelanto: 'Adelanto + saldo', pagar_despues: 'Reservar y pagar después' }[pay.mode] || esc(pay.mode)) + '</b></div>' + (pay.mode !== 'total' ? '<div class="stat-line"><span class="muted">Adelanto (' + (pay.depositPct || 0) + ' %)</span><b>' + k.fmt(pay.deposit || 0) + '</b></div><div class="stat-line"><span class="muted">Saldo</span><b>' + k.fmt(pay.balance || 0) + '</b></div><div class="stat-line"><span class="muted">Vencimiento del saldo</span><b class="' + (pay.balanceDue && pay.balanceDue < TODAY() && rcv.some(c => c.amount - c.paid > 0.004) ? 'bad' : '') + '">' + (pay.balanceDue ? date(pay.balanceDue) : '—') + '</b></div>' : '') +
      (rcv.length ? '<div class="divider" style="margin:8px 0"></div>' + rcv.map(c => '<div class="stat-line"><span class="small">' + esc(c.id) + ' · ' + esc(c.concept.split(' — ')[0]) + '</span><span>' + UI.badge(c.status) + '</span></div>').join('') : '')));
    if ((bb.rulesApplied || []).length) side.push(UI.card('Reglas aplicadas', '<div class="row" style="gap:6px">' + bb.rulesApplied.map(id => '<span class="tag" title="' + esc(ruleName(id)) + (ruleOn(id, r) ? '' : ' (desactivada hoy)') + '">' + esc(id) + (ruleOn(id, r) ? '' : ' · off') + '</span>').join('') + '</div><div class="xs faint" style="margin-top:8px">Reglas del centro de reglas activas al confirmar (Administración › Reglas de reserva). El servidor recalculó precio y disponibilidad al confirmar.</div>'));
    b.innerHTML = '<div class="vt-web">' + (hideAmt ? UI.alert('info', 'Vista de Operaciones: importes de venta, líneas de precio y plan de pago no se muestran para su rol.') : '') + '<div class="grid g-2-1" style="align-items:start;margin-top:' + (hideAmt ? 12 : 0) + 'px"><div class="stack">' + cards.join('') + '</div><div class="stack">' + side.join('') + '</div></div></div>';
  }

  /* ---- Pestaña: Comentarios del pasajero (DB.paxFeedback) ---- */
  function tabFeedback(b, r) {
    const list = fbList(r); const canReply = can('inbox.manage'); const canDerive = can('operations.incidents');
    const msgs = (DB.paxMessages || []).filter(m => m.resId === r.id).sort((a, c) => String(c.sentAt || c.scheduledAt || '').localeCompare(String(a.sentAt || a.scheduledAt || '')));
    b.innerHTML = (ruleOn('R-PAX-FEEDBACK', r) ? '' : UI.alert('info', 'La regla R-PAX-FEEDBACK está desactivada: el pasajero ya no puede enviar comentarios desde su panel. Se muestran los registros previos.')) +
      '<div class="grid g-2-1" style="align-items:start;margin-top:' + (ruleOn('R-PAX-FEEDBACK', r) ? 0 : 12) + 'px"><div class="stack">' + (list.length ? list.map(f => { const s = f.serviceId && r.services.find(x => x.id === f.serviceId); const t = FBT[f.type] || ['borrador', f.type]; const st = FBS[f.status] || [f.status, f.status];
      return '<div class="card"><div class="card-h"><div class="row" style="gap:8px">' + UI.badge(t[0], t[1]) + UI.badge(st[0], st[1]) + stars(f.rating) + '<span class="xs faint mono">' + esc(f.id) + '</span></div><div class="xs faint">' + datetime(f.createdAt) + '</div></div><div class="card-b"><div class="small" style="overflow-wrap:anywhere">' + esc(f.text) + '</div><div class="xs faint" style="margin-top:6px">' + esc(f.passenger) + ' · ' + esc(f.channel || 'Portal pasajero') + (s ? ' · servicio ' + esc(dateShort(s.date) + ' ' + s.name) : ' · viaje en general') + (f.conversationId ? ' · <a href="#/inbox/' + esc(f.conversationId) + '">' + esc(f.conversationId) + '</a>' : '') + (f.incidentId ? ' · ' + (Access.canRoute('operaciones/incidencias') ? '<a href="#/operaciones/incidencias/' + esc(f.incidentId) + '">' + esc(f.incidentId) + '</a>' : esc(f.incidentId)) : '') + '</div>' +
        (f.reply ? '<div style="border-left:3px solid var(--accent);background:var(--accent-soft);padding:8px 10px;border-radius:0 7px 7px 0;margin-top:10px;font-size:.84rem"><b class="xs">Respuesta · ' + esc(Q.userName(f.repliedBy)) + ' · ' + datetime(f.repliedAt) + '</b><div>' + esc(f.reply) + '</div></div>' : '') + '</div>' +
        '<div class="card-f">' + (f.status === 'nuevo' ? '<button class="btn sm ghost" data-fr="' + f.id + '">' + I('eye') + 'Marcar leído</button>' : '') + pbtn(f.reply ? 'Responder de nuevo' : 'Responder', 'send', 'sm primary', 'fb-rep-' + f.id, 'inbox.manage') + (f.status !== 'derivado' ? pbtn('Derivar a incidencia', 'alert', 'sm', 'fb-der-' + f.id, 'operations.incidents') : '') + '</div></div>'; }).join('') : UI.card('', UI.empty('El pasajero no ha enviado comentarios para esta reserva.', 'msg'))) + '</div>' +
      '<div class="stack">' + UI.card('Mensajes al pasajero (' + msgs.length + ')', msgs.length ? '<div class="list">' + msgs.slice(0, 8).map(m => '<div class="list-item" style="align-items:flex-start"><div class="grow" style="min-width:0"><div class="small" style="font-weight:550;overflow-wrap:anywhere">' + esc(m.subject || '') + '</div><div class="xs faint">' + esc({ email: 'Correo', whatsapp: 'WhatsApp', portal: 'Portal', push: 'Push', sms: 'SMS' }[m.channel] || m.channel) + ' · ' + datetime(m.sentAt || m.scheduledAt) + (m.feedbackId ? ' · resp. ' + esc(m.feedbackId) : '') + '</div></div>' + UI.badge({ programado: 'asignada', enviado: 'enviado', entregado: 'aplicado', leido: 'completado', fallido: 'fallido', cancelado: 'cancelado' }[m.status] || 'borrador', { programado: 'Programado', enviado: 'Enviado', entregado: 'Entregado', leido: 'Leído', fallido: 'Fallido', cancelado: 'Cancelado' }[m.status] || m.status) + '</div>').join('') + '</div>' : UI.empty('Sin mensajes', 'mail'), { tight: true, sub: 'Salientes (plantillas y respuestas)', actions: Access.canRoute('admin/comunicaciones') ? '<a class="btn xs ghost" href="#/admin/comunicaciones">Comunicaciones</a>' : '' }) +
      UI.card('Cómo se atiende', '<ul class="small" style="margin:0;padding-left:18px;display:grid;gap:4px"><li>Responder: queda en el comentario y como mensaje saliente en la bandeja del pasajero (permiso inbox.manage).</li><li>Derivar: crea una incidencia en Operaciones con el texto y el servicio (permiso operations.incidents).</li><li>Reclamos e incidencias abren además una conversación en el Inbox para el SLA.</li></ul>') + '</div></div>';
    const F = (id) => (DB.paxFeedback || []).find(x => x.id === id);
    b.querySelectorAll('[data-fr]').forEach(x => x.onclick = () => { const f = F(x.dataset.fr); if (!f) return; f.status = 'leido'; Audit.log('Comentario pasajero', f.id, 'leido', 'nuevo', 'leido'); Store.save(); tabMem[r.id] = 'fb'; App.render(); });
    const H = {}; list.forEach(f => { H['fb-rep-' + f.id] = () => replyFeedback(r, f); H['fb-der-' + f.id] = () => deriveFeedback(r, f); });
    bindActs(b, H);
  }
  function replyFeedback(r, f) {
    if (!need('inbox.manage')) return;
    const lead = r.passengers.find(p => p.isLead) || r.passengers[0] || {}; const cli = Q.client(r.clientId) || {};
    UI.modal({ title: 'Responder comentario ' + esc(f.id), sub: esc(f.passenger) + ' · ' + esc((FBT[f.type] || [0, f.type])[1]), body: '<div style="border-left:3px solid var(--sun);background:var(--sun-soft);padding:8px 12px;border-radius:0 8px 8px 0;font-size:.86rem;margin-bottom:12px">' + esc(f.text) + '</div>' + UI.form([
      { id: 'fr-ch', label: 'Canal', type: 'select', col: 6, options: [['portal', 'Portal del pasajero'], ['email', 'Correo'], ['whatsapp', 'WhatsApp']], value: 'portal' },
      { id: 'fr-st', label: 'Estado del comentario', type: 'select', col: 6, options: [['respondido', 'Respondido (cerrar)'], ['leido', 'En seguimiento']], value: 'respondido' },
      { id: 'fr-tx', label: 'Respuesta', type: 'textarea', rows: 5, col: 12, required: true, value: f.reply || '', placeholder: 'Escriba la respuesta que verá el pasajero' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Enviar respuesta', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const ts = nowStr(); const bf = f.status;
        f.reply = d['fr-tx']; f.repliedAt = ts; f.repliedBy = Auth.user.id; f.status = d['fr-st'];
        if (!DB.paxMessages) DB.paxMessages = [];
        const to = d['fr-ch'] === 'whatsapp' ? ((f.contact && f.contact.phone) || lead.phone || cli.phone || '') : ((f.contact && f.contact.email) || lead.email || cli.email || '');
        const pm = { id: 'PMS-' + Date.now().toString(36).toUpperCase(), resId: r.id, templateId: null, channel: d['fr-ch'], to, subject: 'Respuesta a su comentario ' + f.id, body: f.reply, status: 'enviado', scheduledAt: ts, sentAt: ts, readAt: null, direction: 'saliente', feedbackId: f.id, sentBy: Auth.user.id };
        DB.paxMessages.unshift(pm);
        const cv = f.conversationId && (DB.conversations || []).find(c => c.id === f.conversationId);
        if (cv) { cv.messages.push({ from: Auth.user.id, text: f.reply, ts, type: 'msg' }); if (!cv.firstResponseAt) cv.firstResponseAt = ts; if (f.status === 'respondido') { cv.status = 'resuelta'; cv.resolvedAt = ts; cv.resolvedBy = Auth.user.id; } cv.updatedAt = ts; }
        Notify.push('pasajero.respuesta', { portal: 'Portal', email: 'Email', whatsapp: 'WhatsApp' }[d['fr-ch']], to || f.passenger, 'Respuesta a su comentario ' + f.id + ' (' + r.id + ')');
        Audit.log('Comentario pasajero', f.id, 'responder', bf, f.status + ' · ' + d['fr-ch'] + ' · ' + pm.id);
        Store.save(); UI.toast('Respuesta enviada al pasajero por ' + esc(d['fr-ch']) + '.'); tabMem[r.id] = 'fb'; App.render();
      } }] });
  }
  function deriveFeedback(r, f) {
    if (!need('operations.incidents')) return;
    const op = DB.operations.find(o => o.resId === r.id);
    const sev = f.type === 'incidencia' ? 'alta' : f.type === 'reclamo' ? 'media' : 'baja';
    UI.modal({ title: 'Derivar a incidencia', sub: esc(f.id) + ' · ' + esc(r.id), body: UI.form([
      { id: 'dv-ti', label: 'Título', col: 12, required: true, value: (FBT[f.type] || [0, 'Comentario'])[1] + ' del pasajero: ' + f.text.slice(0, 60) + (f.text.length > 60 ? '…' : '') },
      { id: 'dv-ty', label: 'Tipo', type: 'select', col: 6, options: ['Servicio', 'Transporte', 'Hotel', 'Horario', 'Salud', 'Cliente', 'Otro'], value: 'Cliente' },
      { id: 'dv-sv', label: 'Severidad', type: 'select', col: 6, options: [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta'], ['critica', 'Crítica']], value: sev },
      { id: 'dv-de', label: 'Descripción', type: 'textarea', rows: 4, col: 12, value: f.text + (f.rating ? ' (calificación ' + f.rating + '/5)' : '') }]),
      actions: [{ label: 'Cancelar' }, { label: 'Crear incidencia', cls: 'primary', icon: 'alert', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = UI.formData(m); const ts = nowStr();
        const iid = 'INC-' + String(Math.max(0, ...DB.incidents.map(i => +String(i.id).replace(/\D/g, '') || 0)) + 1).padStart(4, '0');
        const coord = op ? op.coordinator : 'U05';
        const inc = { id: iid, opId: op ? op.id : null, resId: r.id, severity: d['dv-sv'], type: d['dv-ty'], title: d['dv-ti'], desc: d['dv-de'], status: 'abierta', assignee: coord, reportedBy: Auth.user.id, createdAt: ts, evidence: [], serviceId: f.serviceId || null, feedbackId: f.id, log: [{ ts, u: Auth.user.id, m: 'Incidencia creada desde el comentario del pasajero ' + f.id + '.' }] };
        DB.incidents.unshift(inc); const bf = f.status; f.status = 'derivado'; f.incidentId = iid;
        Audit.log('Incidencia', iid, 'crear', 'Comentario ' + f.id, 'abierta / ' + inc.severity); Audit.log('Comentario pasajero', f.id, 'derivar', bf, 'derivado · ' + iid);
        Notify.push('incidencia.creada', 'Email', (Q.user(coord) || {}).email || coord, iid + ' ' + inc.title);
        if (inc.severity === 'critica') Notify.push('incidencia.critica', 'Push', 'U02', 'ALERTA CRÍTICA ' + iid + ' — ' + inc.title);
        Store.save(); UI.toast('Incidencia ' + iid + ' creada y asignada a ' + esc(Q.userName(coord)) + '.'); tabMem[r.id] = 'fb'; App.render();
      } }] });
  }

  App.register('cotizaciones', (el, params) => {
    if (!can('quotes.view')) return noAccess(el, 'quotes.view', 'Cotizaciones');
    if (!params.length) return renderQuoteList(el);
    const q = Q.quote(params[0]);
    if (!q) return notFound(el, 'La cotización ' + params[0], '#/cotizaciones');
    if (own() && q.owner !== me()) return Scope.denied(el, 'La cotización ' + q.id);
    if (params[1] === 'editar') return renderBuilder(el, { quote: q });
    renderQuote(el, q);
  });
  App.register('cotizaciones/nueva', (el, params) => {
    if (!can('quotes.view')) return noAccess(el, 'quotes.view', 'Cotizaciones');
    renderBuilder(el, { oppId: params[0] });
  });
  App.register('reservas', (el, params) => {
    if (!can('reservations.view')) return noAccess(el, 'reservations.view', 'Reservas');
    if (!params.length) return renderResList(el);
    const r = Q.reservation(params[0]);
    if (!r) return notFound(el, 'La reserva ' + params[0], '#/reservas');
    if (own() && r.owner !== me()) return Scope.denied(el, 'La reserva ' + r.id);
    renderRes(el, r);
  });
  App.register('reservas/nueva', (el) => {
    if (!can('reservations.view')) return noAccess(el, 'reservations.view', 'Reservas');
    renderNewRes(el);
  });
})();
