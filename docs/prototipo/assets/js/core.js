/* ==========================================================================
   Qhapaq Travel Suite — Núcleo del prototipo (JS vanilla, sin dependencias)
   Store · Auth/RBAC · Router · Componentes UI · Motor de precios · Auditoría
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- Store (persistencia local de la demo) ---------------- */
  const KEY = 'qhapaq_demo_db_v5';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let DB;
  try { const raw = localStorage.getItem(KEY); DB = raw ? JSON.parse(raw) : clone(window.SEED); } catch (e) { DB = clone(window.SEED); }
  window.DB = DB;
  const Store = {
    save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* almacenamiento no disponible */ } },
    reset() { try { localStorage.removeItem(KEY); localStorage.removeItem('qhapaq_session'); } catch (e) { } location.hash = '#/dashboard'; location.reload(); }
  };

  /* ---------------- Utilidades ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CUR = { PEN: 'S/', USD: 'US$', EUR: '€', GBP: '£', BRL: 'R$', CLP: 'CLP$', MXN: 'MX$', COP: 'COL$', ARS: 'AR$', JPY: '¥' };
  const fmtN = (n, d = 2) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = (n, cur = 'PEN', d = 2) => (CUR[cur] || cur) + ' ' + fmtN(n, d);
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const parseD = (s) => { if (!s) return null; const [d, t] = String(s).split(' '); const [y, m, dd] = d.split('-').map(Number); const [hh, mi] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, hh || 0, mi || 0); };
  const date = (s) => { const d = parseD(s); if (!d || isNaN(d)) return s || '—'; return String(d.getDate()).padStart(2, '0') + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear(); };
  const dateShort = (s) => { const d = parseD(s); if (!d || isNaN(d)) return s || '—'; return String(d.getDate()).padStart(2, '0') + ' ' + MES[d.getMonth()]; };
  const datetime = (s) => { if (!s) return '—'; const d = parseD(s); if (!d || isNaN(d)) return s; return date(s) + (String(s).includes(' ') ? ' · ' + String(s).split(' ')[1] : ''); };
  const pad = (n) => String(n).padStart(2, '0');
  const nowStr = () => { const d = new Date(); return window.TODAY + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
  const daysFromToday = (s) => daysBetween(window.TODAY, s);
  const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const initials = (name) => String(name || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const sum = (arr, f) => arr.reduce((a, x) => a + (typeof f === 'function' ? f(x) : x[f] || 0), 0);
  const groupBy = (arr, f) => arr.reduce((m, x) => { const k = typeof f === 'function' ? f(x) : x[f]; (m[k] = m[k] || []).push(x); return m; }, {});
  const toPEN = (amount, cur) => cur === 'USD' ? amount * (DB.settings.fx || 3.74) : amount;

  /* Correlativos */
  const Seq = {
    next(doc) {
      const s = DB.settings.series.find(x => x.doc === doc);
      if (!s) return uid(doc.slice(0, 3).toUpperCase());
      const n = s.next++;
      const width = doc === 'Reserva' ? 6 : doc === 'Voucher' ? 5 : doc === 'Factura' || doc === 'Boleta' ? 8 : doc === 'Orden operativa' ? 4 : 5;
      Store.save();
      return s.prefix + String(n).padStart(width, '0');
    }
  };

  /* ---------------- Búsquedas por id ---------------- */
  const byId = (arr, id) => (DB[arr] || []).find(x => x.id === id);
  const Q = {
    user: id => DB.users.find(u => u.id === id),
    userName: id => (DB.users.find(u => u.id === id) || {}).name || (DB.b2bAgencies.find(a => a.id === id) || {}).name || id || '—',
    client: id => byId('clients', id), clientName: id => (byId('clients', id) || {}).name || '—',
    product: id => byId('products', id), productName: id => (byId('products', id) || {}).name || id || '—',
    provider: id => byId('providers', id), providerName: id => (byId('providers', id) || {}).name || '—',
    service: id => byId('services', id), destination: id => byId('destinations', id), destName: id => (byId('destinations', id) || {}).name || '—',
    quote: id => byId('quotes', id), reservation: id => byId('reservations', id), opportunity: id => byId('opportunities', id), lead: id => byId('leads', id),
    operation: id => byId('operations', id), guide: id => byId('guides', id), driver: id => byId('drivers', id), vehicle: id => byId('vehicles', id),
    agency: id => byId('b2bAgencies', id), season: id => byId('seasons', id),
    role: id => DB.roles.find(r => r.id === id), roleName: id => (DB.roles.find(r => r.id === id) || {}).name || id,
    sede: id => byId('sedes', id), sedeName: id => (byId('sedes', id) || {}).name || '—',
    destPath(id) { const out = []; let d = byId('destinations', id); while (d) { out.unshift(d.name); d = d.parent ? byId('destinations', d.parent) : null; } return out.join(' › '); },
    resPaid(resId) { return sum(DB.payments.filter(p => p.resId === resId && (p.status === 'aplicado' || p.status === 'confirmado')), 'amount'); },
    resCost(r) { return sum(r.services.filter(s => s.status !== 'cancelado'), 'cost'); }
  };

  /* ---------------- Motor de precios (simulación del cálculo backend) ---------------- */
  const Pricing = {
    /* costo + costos adicionales + markup − descuentos + impuestos = precio final */
    calc({ cost = 0, extra = 0, markupPct = 0, markupFixed = 0, discountPct = 0, discountFixed = 0, taxPct = 0, commissionPct = 0, round = 0.1 }) {
      const base = cost + extra;
      const markup = base * markupPct / 100 + markupFixed;
      const subtotal = base + markup;
      const discount = subtotal * discountPct / 100 + discountFixed;
      const net = subtotal - discount;
      const tax = net * taxPct / 100;
      let total = net + tax;
      if (round) total = Math.round(total / round) * round;
      const commission = net * commissionPct / 100;
      const profit = net - base - commission;
      return { base, markup, subtotal, discount, net, tax, total, commission, profit, marginPct: net ? profit / net * 100 : 0 };
    },
    quoteTotals(v) {
      const lines = v.items.map(i => ({ ...i, costTotal: i.unitCost * i.qty * i.pax, saleTotal: i.unitPrice * i.qty * i.pax }));
      const cost = sum(lines, 'costTotal');
      const sale = sum(lines, 'saleTotal');
      const discount = sale * (v.discountPct || 0) / 100;
      const net = sale - discount;
      const tax = net * (v.taxPct || 0) / 100;
      const total = net + tax;
      const profit = net - cost;
      return { lines, cost, sale, discount, net, tax, total, profit, marginPct: net ? profit / net * 100 : 0 };
    },
    seasonFor(dateStr) {
      const list = DB.seasons.filter(s => s.status === 'activa' && dateStr >= s.from && dateStr <= s.to).sort((a, b) => a.priority - b.priority);
      return list[0] || null;
    }
  };

  /* ---------------- Auditoría y notificaciones ---------------- */
  const Audit = {
    log(entity, entityId, action, before, after) {
      DB.audit.unshift({ id: 'AUD-' + (55121 + DB.audit.length), ts: nowStr(), user: Auth.user ? Auth.user.id : 'Sistema', entity, entityId, action, before: before == null ? '' : String(before), after: after == null ? '' : String(after), ip: '190.43.12.' + (8 + Math.floor(Math.random() * 6)), corr: 'c-' + Math.random().toString(16).slice(2, 7) });
      Store.save();
    }
  };
  const Notify = {
    push(event, channel, to, subject, status) {
      DB.notifications.unshift({ id: 'NTF-' + (9922 + DB.notifications.length), ts: nowStr(), event, channel, to, subject, status: status || 'enviado', retries: 0 });
      Store.save(); Shell.refreshBell();
    }
  };

  /* ---------------- Auth / RBAC ---------------- */
  const Auth = {
    user: null,
    load() { try { const id = localStorage.getItem('qhapaq_session'); if (id) this.user = Q.user(id) || null; } catch (e) { } },
    login(uidv) { this.user = Q.user(uidv); try { localStorage.setItem('qhapaq_session', uidv); } catch (e) { } Audit.log('Sesión', uidv, 'login', '', 'OK'); },
    logout() { if (this.user) Audit.log('Sesión', this.user.id, 'logout', '', ''); this.user = null; try { localStorage.removeItem('qhapaq_session'); } catch (e) { } location.hash = '#/login'; App.render(); },
    get role() { return this.user ? this.user.role : null; },
    can(perm) { if (!this.user) return false; const ps = DB.rolePerms[this.user.role] || []; return ps.includes(perm) || ps.some(p => p.endsWith('.') && perm.startsWith(p)); },
    canAny(perms) { return perms.some(p => this.can(p)); },
    get isExternal() { return Access.isExternal(); },
    /* Vínculos del usuario externo con sus datos */
    get clientId() { return this.user && this.user.clientId; }, get agencyId() { return this.user && this.user.agencyId; }, get providerId() { return this.user && this.user.providerId; },
    get resourceId() { return this.user && (this.user.guideId || this.user.driverId); }
  };

  /* ---------------- Iconos (trazos propios, 24×24) ---------------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .8 3.2 2.6 3.5 5.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
    funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.5-4.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    map: '<path d="M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
    file: '<path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21z"/><path d="M14 2.5V8h5M9 13h6M9 17h6"/>',
    fileCheck: '<path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21z"/><path d="M14 2.5V8h5M9 15l2 2 4-4"/>',
    ticket: '<path d="M3 7.5V5h18v2.5a2.5 2.5 0 0 0 0 5V19H3v-6.5a2.5 2.5 0 0 0 0-5z"/><path d="M14 5v14" stroke-dasharray="2 2"/>',
    suitcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V4.5h7V7M3 12h18"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5h6v3H9zM9 11h6M9 15h4"/>',
    truck: '<path d="M2 6h12v10H2zM14 9.5h4l3 3.5v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6"/><circle cx="6.5" cy="11" r="1.8"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    camera: '<path d="M3 8h4l2-2.5h6L17 8h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2.5"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>',
    receipt: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    scale: '<path d="M12 3v18M5 21h14M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    handshake: '<path d="M2 11l4-4 4 1.5L13 6l4 1 5 4"/><path d="M6 13l3.5 3.5a1.5 1.5 0 0 0 2.1 0L17 11M2 11l4 4M22 11l-4 4"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12.5h12L22 7H6"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    phone: '<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
    chart: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
    pie: '<path d="M21 12.5A9 9 0 1 1 11.5 3v9.5z"/><path d="M15 3.3A9 9 0 0 1 20.7 9H15z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.5 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    msg: '<path d="M4 5h16v11H9l-5 4z"/>',
    phoneCall: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    chevronDown: '<path d="M5 9l7 7 7-7"/>',
    chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
    arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.3L3 9M4 13a8 8 0 0 0 14.7 4.3L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 3 1.1-6.2L3 9.7l6.2-.9z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="13.5" r=".8"/><circle cx="15" cy="13.5" r=".8"/>',
    mountain: '<path d="M2 20L9 7l4 7 2.5-4L22 20z"/><path d="M7.5 10l1.5 1.5L10.5 10"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    gps: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    wifiOff: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M12 20h.01M19 13a10 10 0 0 0-2.3-1.7M2 9.5a15 15 0 0 1 4.3-2.8M22 9.5A15 15 0 0 0 11 5.1"/>',
    sync: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M20 3.5v5h-5M4 20.5v-5h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    home: '<path d="M3 11l9-7.5L21 11v9.5a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5z"/>',
    kanban: '<rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="9" rx="1"/><rect x="17" y="3" width="4" height="17" rx="1"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
    heart: '<path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20z"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7.5 5-2.5 5 2.5-1.5-7.5"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    server: '<rect x="3" y="3.5" width="18" height="7" rx="1.5"/><rect x="3" y="13.5" width="18" height="7" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
    logo: '<path d="M3 18l5.5-9 3.5 5.5 2.5-3.5L21 18z"/><path d="M3 21h18" /><circle cx="17" cy="6" r="2"/>'
  };
  const icon = (name, cls) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + (P[name] || P.info) + '</svg>';

  /* ---------------- Estados → apariencia ---------------- */
  const STATUS = {
    // genéricos
    activo: ['Activo', 'ok'], activa: ['Activa', 'ok'], inactivo: ['Inactivo', 'mute'], inactiva: ['Inactiva', 'mute'], vencido: ['Vencido', 'bad'], suspendido: ['Suspendido', 'bad'], prueba: ['En prueba', 'info'], bloqueada: ['Bloqueada', 'bad'],
    // leads
    nuevo: ['Nuevo', 'info'], contactado: ['Contactado', 'accent'], calificado: ['Calificado', 'violet'], convertido: ['Convertido', 'ok'], descartado: ['Descartado', 'mute'], duplicado: ['Duplicado', 'warn'],
    // oportunidades
    calificacion: ['Calificación', 'info'], descubrimiento: ['Descubrimiento', 'accent'], cotizacion: ['Cotización', 'violet'], negociacion: ['Negociación', 'sun'], ganada: ['Ganada', 'ok'], perdida: ['Perdida', 'bad'],
    // actividades
    pendiente: ['Pendiente', 'warn'], completada: ['Completada', 'ok'], vencida: ['Vencida', 'bad'],
    // cotización
    borrador: ['Borrador', 'mute'], enviada: ['Enviada', 'info'], vista: ['Vista', 'accent'], aprobada: ['Aprobada', 'ok'], rechazada: ['Rechazada', 'bad'], convertida: ['Convertida en reserva', 'violet'], cancelada: ['Cancelada', 'mute'], reemplazada: ['Reemplazada', 'mute'],
    // reserva
    pendiente_disponibilidad: ['Pend. disponibilidad', 'warn'], confirmada: ['Confirmada', 'ok'], en_operacion: ['En operación', 'accent'], pendiente_pago: ['Pendiente de pago', 'warn'], pendiente_proveedor: ['Pend. proveedor', 'warn'], reprogramada: ['Reprogramada', 'info'], parcial: ['Parcial', 'warn'], incidencia: ['Con incidencia', 'bad'],
    // disponibilidad / salidas
    disponible: ['Disponible', 'ok'], hold: ['Hold', 'warn'], liberada: ['Liberada', 'mute'], expirada: ['Expirada', 'mute'], consumida: ['Consumida', 'violet'], abierta: ['Abierta', 'info'], completa: ['Completa', 'sun'], cerrada: ['Cerrada', 'mute'],
    // operación
    planificada: ['Planificada', 'mute'], pendiente_asignacion: ['Pend. asignación', 'warn'], asignada: ['Asignada', 'info'], en_ejecucion: ['En ejecución', 'accent'],
    // servicios
    solicitado: ['Solicitado', 'info'], confirmado: ['Confirmado', 'ok'], rechazado: ['Rechazado', 'bad'], completado: ['Completado', 'violet'], cancelado: ['Cancelado', 'mute'], en_curso: ['En curso', 'accent'],
    // pago / cxc / cxp
    aplicado: ['Aplicado', 'ok'], revertido: ['Revertido', 'bad'], pagada: ['Pagada', 'ok'], calculada: ['Calculada', 'info'],
    // vouchers / docs
    emitido: ['Emitido', 'ok'], anulado: ['Anulado', 'bad'], utilizado: ['Utilizado', 'violet'], aceptado: ['Aceptado', 'ok'], observado: ['Observado', 'warn'],
    // incidencias
    en_proceso: ['En proceso', 'accent'], resuelta: ['Resuelta', 'ok'],
    baja: ['Baja', 'mute'], media: ['Media', 'info'], alta: ['Alta', 'warn'], critica: ['Crítica', 'bad'],
    // productos
    DRAFT: ['Borrador', 'mute'], REVIEW: ['En revisión', 'warn'], APPROVED: ['Aprobado', 'info'], ACTIVE: ['Activo', 'ok'], SUSPENDED: ['Suspendido', 'bad'], INACTIVE: ['Inactivo', 'mute'], ARCHIVED: ['Archivado', 'mute'],
    vigente: ['Vigente', 'ok'], 'histórica': ['Histórica', 'mute'], 'en revisión': ['En revisión', 'warn'],
    // cms / ecommerce / jobs / integraciones
    publicado: ['Publicado', 'ok'], en_revision: ['En revisión', 'warn'], despublicado: ['Despublicado', 'mute'], pago_pendiente: ['Pago pendiente', 'warn'], pago_rechazado: ['Pago rechazado', 'bad'],
    ok: ['OK', 'ok'], advertencia: ['Advertencia', 'warn'], error: ['Error', 'bad'], enviado: ['Enviado', 'ok'], fallido: ['Fallido', 'bad'],
    por_validar: ['Por validar', 'warn'], sandbox: ['Sandbox', 'info'], futuro: ['Fase futura', 'mute'],
    sugerido: ['Sugerido', 'info'], conciliado: ['Conciliado', 'ok'], 'excepción': ['Excepción', 'bad'],
    vacaciones: ['Vacaciones', 'mute'], descanso: ['Descanso', 'mute'], mantenimiento: ['Mantenimiento', 'warn'], asignado: ['Asignado', 'info']
  };
  const badge = (status, label) => { const s = STATUS[status] || [status, 'mute']; return '<span class="badge b-' + s[1] + '">' + esc(label || s[0]) + '</span>'; };
  const statusLabel = (s) => (STATUS[s] || [s])[0];

  /* ---------------- Componentes UI ---------------- */
  const UI = {
    esc, money, fmtN, date, dateShort, datetime, badge, statusLabel, icon, initials,
    avatar(nameOrUser, cls) { const u = typeof nameOrUser === 'object' ? nameOrUser : (Q.user(nameOrUser) || { name: nameOrUser }); const col = u.color || '#46606B'; return '<span class="avatar ' + (cls || '') + '" style="background:' + col + '" title="' + esc(u.name) + '">' + esc(initials(u.name)) + '</span>'; },
    userChip(id) { const u = Q.user(id); if (!u) return '<span class="muted">' + esc(Q.userName(id)) + '</span>'; return '<span class="row" style="gap:7px;flex-wrap:nowrap">' + UI.avatar(u) + '<span class="small">' + esc(u.name) + '</span></span>'; },
    pageHeader({ title, subtitle, crumbs = [], actions = '' }) {
      return '<div class="ph"><div class="grow">' + (crumbs.length ? '<div class="crumbs">' + crumbs.map((c, i) => (c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : '<span>' + esc(c[0]) + '</span>') + (i < crumbs.length - 1 ? '<span>/</span>' : '')).join('') + '</div>' : '') + '<h1>' + title + '</h1>' + (subtitle ? '<div class="sub">' + subtitle + '</div>' : '') + '</div>' + (actions ? '<div class="ph-actions">' + actions + '</div>' : '') + '</div>';
    },
    kpi({ label, value, delta, deltaDir, sub, tone = 'accent', icon: ic }) {
      return '<div class="kpi tone-' + tone + '"><div class="l"><span class="row" style="gap:7px"><i class="kdot"></i>' + esc(label) + '</span>' + (ic ? icon(ic) : '') + '</div><div class="v">' + value + '</div>' + ((delta || sub) ? '<div class="d">' + (delta ? '<span class="' + (deltaDir || 'up') + '">' + (deltaDir === 'down' ? '▼ ' : '▲ ') + esc(delta) + '</span>' : '') + (sub ? '<span>' + sub + '</span>' : '') + '</div>' : '') + '</div>';
    },
    card(title, body, { sub = '', actions = '', footer = '', tight = false, id = '' } = {}) {
      return '<div class="card"' + (id ? ' id="' + id + '"' : '') + '>' + (title ? '<div class="card-h"><div><div class="t">' + title + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>' + (actions ? '<div class="row">' + actions + '</div>' : '') + '</div>' : '') + '<div class="card-b' + (tight ? ' tight' : '') + '">' + body + '</div>' + (footer ? '<div class="card-f">' + footer + '</div>' : '') + '</div>';
    },
    empty(msg, ic = 'box') { return '<div class="empty">' + icon(ic) + '<div>' + esc(msg) + '</div></div>'; },
    progress(pct, tone = '') { pct = Math.max(0, Math.min(100, pct)); return '<div class="progress ' + tone + '"><span style="width:' + pct.toFixed(1) + '%"></span></div>'; },
    alert(type, html, ic) { return '<div class="alert ' + type + '">' + icon(ic || (type === 'bad' ? 'alert' : type === 'ok' ? 'checkCircle' : type === 'warn' ? 'alert' : 'info')) + '<div class="alert-body">' + html + '</div></div>'; },
    dl(pairs) { return '<dl class="dl">' + pairs.filter(Boolean).map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + (v == null || v === '' ? '—' : v) + '</dd>').join('') + '</dl>'; },
    /* Flujo de estados: steps = ['Borrador','Enviada',...], current = índice actual, failed = índice fallido opcional */
    flow(steps, current, failedAt) {
      return '<div class="flow">' + steps.map((s, i) => {
        const cls = failedAt === i ? 'fail' : i < current ? 'done' : i === current ? 'cur' : '';
        return '<div class="flow-step ' + cls + '"><div class="flow-node"><div class="flow-dot">' + (i < current && failedAt !== i ? icon('check') : failedAt === i ? icon('x') : (i + 1)) + '</div><div class="flow-lbl">' + esc(s) + '</div></div>' + (i < steps.length - 1 ? '<div class="flow-line"></div>' : '') + '</div>';
      }).join('') + '</div>';
    },
    timeline(items) { /* items: [{title, meta, desc, icon}] */
      if (!items.length) return UI.empty('Sin movimientos registrados', 'history');
      return '<div class="timeline">' + items.map(i => '<div class="tl-item"><div class="tl-dot">' + icon(i.icon || 'check') + '</div><div><div class="tl-t">' + i.title + '</div>' + (i.meta ? '<div class="tl-m">' + i.meta + '</div>' : '') + (i.desc ? '<div class="tl-d">' + i.desc + '</div>' : '') + '</div></div>').join('') + '</div>';
    },
    /* ---- Formularios ---- */
    field(f) {
      const id = f.id; const req = f.required ? ' <span class="req">*</span>' : '';
      const col = 'c' + (f.col || 6);
      if (f.type === 'section') return '<div class="section-title">' + esc(f.label) + '</div>';
      if (f.type === 'html') return '<div class="' + col + '">' + f.html + '</div>';
      let input;
      const val = f.value == null ? '' : f.value;
      const dis = f.disabled ? ' disabled' : '';
      if (f.type === 'select') input = '<select class="input" id="' + id + '" name="' + id + '"' + dis + '>' + (f.placeholder ? '<option value="">' + esc(f.placeholder) + '</option>' : '') + (f.options || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'textarea') input = '<textarea class="input" id="' + id + '" name="' + id + '" rows="' + (f.rows || 3) + '"' + dis + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(val) + '</textarea>';
      else if (f.type === 'switch') return '<div class="' + col + '"><label class="switch"><input type="checkbox" id="' + id + '" name="' + id + '"' + (val ? ' checked' : '') + dis + '> ' + esc(f.label) + '</label>' + (f.hint ? '<div class="hint xs faint">' + esc(f.hint) + '</div>' : '') + '</div>';
      else if (f.type === 'checkbox') return '<div class="' + col + '"><label class="check"><input type="checkbox" id="' + id + '" name="' + id + '"' + (val ? ' checked' : '') + dis + '> ' + esc(f.label) + '</label></div>';
      else input = '<input class="input" id="' + id + '" name="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(val) + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + dis + ' placeholder="' + esc(f.placeholder || '') + '">';
      return '<div class="field ' + col + '"><label for="' + id + '">' + esc(f.label) + req + '</label>' + input + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    },
    form(fields) { return '<div class="form-grid">' + fields.map(UI.field).join('') + '</div>'; },
    formData(root) {
      const out = {};
      root.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => { out[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim(); });
      return out;
    },
    validate(root) {
      let ok = true;
      root.querySelectorAll('.errmsg').forEach(e => e.remove());
      root.querySelectorAll('.field').forEach(f => {
        const lab = f.querySelector('label'); const el = f.querySelector('.input');
        if (!el) return; el.classList.remove('err');
        if (lab && lab.querySelector('.req') && !String(el.value).trim()) { ok = false; el.classList.add('err'); f.insertAdjacentHTML('beforeend', '<div class="errmsg">Campo obligatorio</div>'); }
      });
      if (!ok) UI.toast('Complete los campos obligatorios marcados.', 'bad');
      return ok;
    },
    /* ---- Modales ---- */
    modal({ title, body, size = '', actions = [], onOpen, sub = '' }) {
      UI.closeModal();
      const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'modal-ov';
      ov.innerHTML = '<div class="modal ' + size + '" role="dialog" aria-modal="true"><div class="modal-h"><div><h2>' + title + '</h2>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div><button class="btn ghost icon" data-close aria-label="Cerrar">' + icon('x') + '</button></div><div class="modal-b">' + body + '</div>' + (actions.length ? '<div class="modal-f">' + actions.map((a, i) => '<button class="btn ' + (a.cls || '') + '" data-act="' + i + '">' + (a.icon ? icon(a.icon) : '') + esc(a.label) + '</button>').join('') + '</div>' : '') + '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('mousedown', e => { if (e.target === ov) UI.closeModal(); });
      ov.querySelector('[data-close]').onclick = UI.closeModal;
      actions.forEach((a, i) => { ov.querySelector('[data-act="' + i + '"]').onclick = () => { const m = ov.querySelector('.modal'); if (a.onClick) { const r = a.onClick(m); if (r === false) return; } if (a.close !== false) UI.closeModal(); }; });
      const m = ov.querySelector('.modal');
      if (onOpen) onOpen(m);
      const first = m.querySelector('.modal-b input,.modal-b select,.modal-b textarea'); if (first) setTimeout(() => first.focus(), 30);
      return m;
    },
    closeModal() { const o = document.getElementById('modal-ov'); if (o) o.remove(); },
    confirm({ title = 'Confirmar acción', message, confirmLabel = 'Confirmar', danger = false, onConfirm, reason = false, reasonLabel = 'Motivo' }) {
      UI.modal({ title, size: 'sm', body: '<p>' + message + '</p>' + (reason ? '<div class="field" style="margin-top:12px"><label for="cf-reason">' + esc(reasonLabel) + ' <span class="req">*</span></label><textarea class="input" id="cf-reason" rows="3"></textarea></div>' : ''),
        actions: [{ label: 'Cancelar' }, { label: confirmLabel, cls: danger ? 'danger' : 'primary', onClick: (m) => { let r = ''; if (reason) { r = m.querySelector('#cf-reason').value.trim(); if (!r) { m.querySelector('#cf-reason').classList.add('err'); UI.toast('Indique el motivo.', 'bad'); return false; } } onConfirm && onConfirm(r); } }] });
    },
    drawer({ title, body, wide = false, actions = [], sub = '', onOpen }) {
      UI.closeDrawer();
      const ov = document.createElement('div'); ov.className = 'drawer-ov'; ov.id = 'drawer-ov';
      const d = document.createElement('aside'); d.className = 'drawer' + (wide ? ' wide' : ''); d.id = 'drawer';
      d.innerHTML = '<div class="modal-h"><div class="grow"><h2>' + title + '</h2>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div><button class="btn ghost icon" data-close aria-label="Cerrar">' + icon('x') + '</button></div><div class="drawer-b">' + body + '</div>' + (actions.length ? '<div class="modal-f">' + actions.map((a, i) => '<button class="btn ' + (a.cls || '') + '" data-act="' + i + '">' + (a.icon ? icon(a.icon) : '') + esc(a.label) + '</button>').join('') + '</div>' : '');
      document.body.append(ov, d);
      ov.onclick = UI.closeDrawer; d.querySelector('[data-close]').onclick = UI.closeDrawer;
      actions.forEach((a, i) => { d.querySelector('[data-act="' + i + '"]').onclick = () => { if (a.onClick) { const r = a.onClick(d); if (r === false) return; } if (a.close !== false) UI.closeDrawer(); }; });
      if (onOpen) onOpen(d);
      return d;
    },
    closeDrawer() { ['drawer-ov', 'drawer'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); },
    toast(msg, type = 'ok') {
      let c = document.querySelector('.toasts'); if (!c) { c = document.createElement('div'); c.className = 'toasts'; c.setAttribute('role', 'status'); document.body.appendChild(c); }
      const t = document.createElement('div'); t.className = 'toast ' + type; t.innerHTML = icon(type === 'bad' ? 'alert' : type === 'warn' ? 'alert' : type === 'info' ? 'info' : 'checkCircle') + '<div>' + msg + '</div>';
      c.appendChild(t); setTimeout(() => t.remove(), 3800);
    },
    menu(anchor, items) { /* items: [{label, icon, onClick}|'-'] */
      UI.closeMenu();
      const m = document.createElement('div'); m.className = 'menu'; m.id = 'ctx-menu';
      m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : '<button data-i="' + i + '">' + (it.icon ? icon(it.icon) : '') + esc(it.label) + '</button>').join('');
      document.body.appendChild(m);
      const r = anchor.getBoundingClientRect();
      const left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 10);
      m.style.left = Math.max(8, left) + 'px'; m.style.top = (r.bottom + window.scrollY + 6) + 'px';
      items.forEach((it, i) => { if (it !== '-') m.querySelector('[data-i="' + i + '"]').onclick = () => { UI.closeMenu(); it.onClick && it.onClick(); }; });
      setTimeout(() => document.addEventListener('mousedown', UI._menuAway), 0);
    },
    _menuAway(e) { const m = document.getElementById('ctx-menu'); if (m && !m.contains(e.target)) UI.closeMenu(); },
    closeMenu() { const m = document.getElementById('ctx-menu'); if (m) m.remove(); document.removeEventListener('mousedown', UI._menuAway); },
    /* ---- Pestañas ---- */
    tabs(container, tabs, active, { pills = false, onChange } = {}) {
      /* tabs: [{id,label,count,render(el)}] */
      let cur = active || tabs[0].id;
      container.innerHTML = '<div class="tabs' + (pills ? ' pills' : '') + '" role="tablist">' + tabs.map(t => '<button class="tab" role="tab" data-tab="' + t.id + '">' + esc(t.label) + (t.count != null ? '<span class="cnt">' + t.count + '</span>' : '') + '</button>').join('') + '</div><div class="tab-body" style="padding-top:16px"></div>';
      const body = container.querySelector('.tab-body');
      const show = (id) => { cur = id; container.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === id)); const t = tabs.find(x => x.id === id); body.innerHTML = ''; t.render(body); onChange && onChange(id); };
      container.querySelectorAll('.tab').forEach(b => b.onclick = () => show(b.dataset.tab));
      show(cur);
      return { show, get current() { return cur; } };
    },
    /* ---- Tabla de datos: búsqueda, filtros, orden y paginación ---- */
    dataTable(container, cfg) {
      /* cfg: {columns:[{key,label,render(row),align:'num',sort:true,sortVal(row)}], rows, onRow(row), search:[keys]|fn, filters:[{key,label,options:[[v,l]], match(row,v)}], pageSize, toolbar:'html', empty:'msg', footer(rows)} */
      const st = { q: '', f: {}, sort: cfg.defaultSort || null, dir: cfg.defaultDir || 1, page: 1 };
      const pageSize = cfg.pageSize || 12;
      container.innerHTML = '<div class="card">' +
        '<div class="dt-bar"><div class="search-in" style="flex:1 1 200px;max-width:320px;min-width:170px">' + icon('search') + '<input class="input sm" type="search" placeholder="' + esc(cfg.searchPlaceholder || 'Buscar…') + '" aria-label="Buscar"></div>' +
        (cfg.filters || []).map((f, i) => '<select class="input sm" style="width:auto" data-f="' + i + '" aria-label="' + esc(f.label) + '"><option value="">' + esc(f.label) + ': todos</option>' + f.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, statusLabel(o)]; return '<option value="' + esc(v) + '">' + esc(l) + '</option>'; }).join('') + '</select>').join('') +
        '<div class="grow"></div>' + (cfg.toolbar || '') + '<button class="btn sm" data-export title="Exportar CSV">' + icon('download') + 'Exportar</button></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead></thead><tbody></tbody><tfoot></tfoot></table></div><div class="dt-foot"></div></div>';
      const thead = container.querySelector('thead'), tbody = container.querySelector('tbody'), tfoot = container.querySelector('tfoot'), foot = container.querySelector('.dt-foot');
      const getRows = () => (typeof cfg.rows === 'function' ? cfg.rows() : cfg.rows);
      const filtered = () => {
        let rows = getRows().slice();
        if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(r => (typeof cfg.search === 'function' ? cfg.search(r) : (cfg.search || Object.keys(r)).map(k => r[k]).join(' ')).toString().toLowerCase().includes(q)); }
        (cfg.filters || []).forEach((f, i) => { const v = st.f[i]; if (v) rows = rows.filter(r => f.match ? f.match(r, v) : String(r[f.key]) === v); });
        if (st.sort) { const col = cfg.columns.find(c => c.key === st.sort); const g = col && col.sortVal ? col.sortVal : (r) => r[st.sort]; rows.sort((a, b) => { const x = g(a), y = g(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
        return rows;
      };
      const draw = () => {
        thead.innerHTML = '<tr>' + cfg.columns.map(c => '<th class="' + (c.align || '') + (c.sort !== false && c.key ? ' sortable' : '') + '" data-k="' + (c.key || '') + '">' + esc(c.label) + (st.sort === c.key ? (st.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>').join('') + '</tr>';
        const rows = filtered();
        const pages = Math.max(1, Math.ceil(rows.length / pageSize)); if (st.page > pages) st.page = pages;
        const slice = rows.slice((st.page - 1) * pageSize, st.page * pageSize);
        tbody.innerHTML = slice.length ? slice.map((r, i) => '<tr class="' + (cfg.onRow ? 'click' : '') + '" data-i="' + i + '">' + cfg.columns.map(c => '<td class="' + (c.align || '') + '">' + (c.render ? c.render(r) : esc(r[c.key])) + '</td>').join('') + '</tr>').join('') : '<tr><td colspan="' + cfg.columns.length + '">' + UI.empty(cfg.empty || 'No hay registros que coincidan con los filtros.', 'search') + '</td></tr>';
        tfoot.innerHTML = cfg.footer && rows.length ? cfg.footer(rows) : '';
        foot.innerHTML = '<span>' + rows.length + ' registro' + (rows.length === 1 ? '' : 's') + (getRows().length !== rows.length ? ' de ' + getRows().length : '') + '</span><span class="row" style="gap:6px"><button class="btn xs" data-pg="-1"' + (st.page <= 1 ? ' disabled' : '') + '>' + icon('chevronLeft') + '</button><span>Página ' + st.page + ' de ' + pages + '</span><button class="btn xs" data-pg="1"' + (st.page >= pages ? ' disabled' : '') + '>' + icon('chevronRight') + '</button></span>';
        if (cfg.onRow) tbody.querySelectorAll('tr.click').forEach(tr => tr.onclick = (e) => { if (e.target.closest('button,a,input,select')) return; cfg.onRow(slice[+tr.dataset.i]); });
        thead.querySelectorAll('th.sortable').forEach(th => th.onclick = () => { const k = th.dataset.k; if (st.sort === k) st.dir *= -1; else { st.sort = k; st.dir = 1; } draw(); });
        foot.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { st.page += +b.dataset.pg; draw(); });
        cfg.afterDraw && cfg.afterDraw(container, slice);
      };
      container.querySelector('input[type=search]').addEventListener('input', debounce(e => { st.q = e.target.value; st.page = 1; draw(); }, 150));
      container.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { st.f[s.dataset.f] = s.value; st.page = 1; draw(); });
      const exBtn = container.querySelector('[data-export]');
      if (!Auth.can('reports.export')) { exBtn.disabled = true; exBtn.title = 'Requiere permiso reports.export'; }
      exBtn.onclick = () => {
        if (!Auth.can('reports.export')) { UI.toast('Exportar requiere el permiso reports.export.', 'bad'); return; }
        const rows = filtered();
        const csv = [cfg.columns.map(c => c.label).join(';')].concat(rows.map(r => cfg.columns.map(c => '"' + String(c.csv ? c.csv(r) : (r[c.key] == null ? '' : r[c.key])).replace(/"/g, '""') + '"').join(';'))).join('\n');
        UI.modal({ title: 'Exportación generada', size: 'lg', body: '<p class="small muted" style="margin-bottom:10px">En producción la exportación se procesa como job asíncrono, queda disponible para descarga y se registra en auditoría (PROC-061). Vista previa del archivo CSV (' + rows.length + ' filas):</p><textarea class="input mono" rows="12" readonly>' + esc(csv) + '</textarea>', actions: [{ label: 'Copiar al portapapeles', icon: 'copy', cls: 'primary', onClick: (m) => { const ta = m.querySelector('textarea'); try { navigator.clipboard.writeText(ta.value).then(() => UI.toast('CSV copiado.'), () => { ta.select(); UI.toast('Seleccione y copie con Ctrl+C.', 'info'); }); } catch (e) { ta.select(); } return false; } }, { label: 'Cerrar' }] });
        Audit.log('Exportación', cfg.exportName || 'tabla', 'exportar', '', rows.length + ' filas');
      };
      draw();
      return { redraw: draw, state: st };
    },
    /* ---- Gráficos SVG ---- */
    chart: {
      COLORS: ['var(--accent)', 'var(--sun)', 'var(--info)', 'var(--violet)', 'var(--ok)', 'var(--bad)', 'var(--fg-3)'],
      bars({ labels, series, height = 220, stacked = false, fmt = (v) => fmtN(v, 0), horizontal = false }) {
        const W = 620, H = height, padL = 52, padB = 26, padT = 12, padR = 10;
        const iw = W - padL - padR, ih = H - padB - padT;
        const totals = labels.map((_, i) => stacked ? sum(series, s => s.values[i]) : Math.max(...series.map(s => s.values[i])));
        const max = niceMax(Math.max(...totals, 1));
        const ticks = 4; let g = '';
        for (let t = 0; t <= ticks; t++) { const y = padT + ih - ih * t / ticks; g += '<line class="gridl" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (padL - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(short(max * t / ticks)) + '</text>'; }
        const bw = iw / labels.length; const inner = stacked ? bw * .56 : bw * .72 / series.length;
        labels.forEach((l, i) => {
          let acc = 0;
          series.forEach((s, k) => {
            const v = s.values[i] || 0; const h = ih * v / max;
            const x = stacked ? padL + bw * i + (bw - inner) / 2 : padL + bw * i + bw * .14 + inner * k;
            const y = stacked ? padT + ih - h - ih * acc / max : padT + ih - h;
            g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (inner - 2).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="2" fill="' + (s.color || UI.chart.COLORS[k]) + '"><title>' + esc(l + ' · ' + s.name + ': ' + fmt(v)) + '</title></rect>';
            acc += v;
          });
          g += '<text x="' + (padL + bw * i + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l) + '</text>';
        });
        return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg></div>' + UI.chart.legend(series);
      },
      line({ labels, series, height = 220, fmt = (v) => fmtN(v, 0), area = true }) {
        const W = 620, H = height, padL = 52, padB = 26, padT = 14, padR = 16;
        const iw = W - padL - padR, ih = H - padB - padT;
        const max = niceMax(Math.max(...series.flatMap(s => s.values), 1));
        let g = '';
        for (let t = 0; t <= 4; t++) { const y = padT + ih - ih * t / 4; g += '<line class="gridl" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (padL - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(short(max * t / 4)) + '</text>'; }
        const X = (i) => padL + (labels.length === 1 ? iw / 2 : iw * i / (labels.length - 1));
        const Y = (v) => padT + ih - ih * v / max;
        series.forEach((s, k) => {
          const col = s.color || UI.chart.COLORS[k];
          const pts = s.values.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1));
          if (area && k === 0) g += '<path d="M' + X(0) + ',' + (padT + ih) + ' L' + pts.join(' L') + ' L' + X(s.values.length - 1) + ',' + (padT + ih) + ' Z" fill="' + col + '" opacity=".10"/>';
          g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
          s.values.forEach((v, i) => { g += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="' + (i === s.values.length - 1 ? 4 : 2.6) + '" fill="' + (i === s.values.length - 1 ? col : 'var(--surface)') + '" stroke="' + col + '" stroke-width="2"><title>' + esc(labels[i] + ' · ' + s.name + ': ' + fmt(v)) + '</title></circle>'; });
        });
        labels.forEach((l, i) => { g += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l) + '</text>'; });
        return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg></div>' + UI.chart.legend(series);
      },
      donut({ items, size = 170, center = '', sub = '' }) { /* items [{label,value,color}] */
        const total = sum(items, 'value') || 1; const r = 60, c = 2 * Math.PI * r; let off = 0; let g = '';
        items.forEach((it, k) => { const len = c * it.value / total; g += '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="' + (it.color || UI.chart.COLORS[k]) + '" stroke-width="20" stroke-dasharray="' + Math.max(0, len - 1.5).toFixed(2) + ' ' + (c - len + 1.5).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 80 80)"><title>' + esc(it.label + ': ' + it.value) + '</title></circle>'; off += len; });
        g += '<text x="80" y="80" text-anchor="middle" style="font-size:20px;font-weight:600;fill:var(--fg)">' + esc(center) + '</text><text x="80" y="97" text-anchor="middle">' + esc(sub) + '</text>';
        return '<div class="row top" style="gap:18px;flex-wrap:nowrap"><div class="chart" style="width:' + size + 'px;flex:none"><svg viewBox="0 0 160 160">' + g + '</svg></div><div class="col" style="gap:7px;min-width:0;flex:1">' + items.map((it, k) => '<div class="row between small" style="flex-wrap:nowrap"><span class="row" style="gap:7px;flex-wrap:nowrap;min-width:0"><i style="width:10px;height:10px;border-radius:3px;background:' + (it.color || UI.chart.COLORS[k]) + ';flex:none"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.label) + '</span></span><b class="num">' + esc(it.display || it.value) + '</b></div>').join('') + '</div></div>';
      },
      hbars({ items, fmt = (v) => fmtN(v, 0), color = 'var(--accent)' }) {
        const max = Math.max(...items.map(i => i.value), 1);
        return '<div class="col" style="gap:10px">' + items.map(i => '<div><div class="row between small" style="margin-bottom:4px"><span>' + esc(i.label) + '</span><b class="num">' + esc(i.display || fmt(i.value)) + '</b></div><div class="progress"><span style="width:' + (i.value / max * 100).toFixed(1) + '%;background:' + (i.color || color) + '"></span></div></div>').join('') + '</div>';
      },
      spark(values, color = 'var(--accent)', w = 110, h = 30) {
        const max = Math.max(...values), min = Math.min(...values); const X = i => i * w / (values.length - 1); const Y = v => h - 3 - (h - 6) * (v - min) / ((max - min) || 1);
        return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><polyline fill="none" stroke="' + color + '" stroke-width="1.8" points="' + values.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ') + '"/><circle cx="' + X(values.length - 1) + '" cy="' + Y(values[values.length - 1]) + '" r="2.8" fill="' + color + '"/></svg>';
      },
      legend(series) { return series.length > 1 ? '<div class="legend" style="margin-top:6px">' + series.map((s, k) => '<span><i style="background:' + (s.color || UI.chart.COLORS[k]) + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : ''; }
    },
    /* Portada visual de producto (sin imágenes externas) */
    thumb(p, h) { const hue = p.hue || 190; return '<div class="thumb" style="background:hsl(' + (200 + hue % 24) + ' 62% ' + (24 + hue % 9) + '%);' + (h ? 'aspect-ratio:auto;height:' + h + 'px' : '') + '"><svg class="mtn" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 60 L0 40 L30 18 L52 34 L80 8 L108 36 L130 22 L160 42 L182 28 L200 38 L200 60Z" fill="#fff"/></svg><div class="tt">' + esc(p.name) + '</div></div>'; },
    /* En pantallas angostas (≤ 900 px) lleva la vista al panel de detalle recién actualizado */
    reveal(target) { const t = typeof target === 'string' ? document.querySelector(target) : target; if (t && window.innerWidth <= 900) requestAnimationFrame(() => { t.style.scrollMarginTop = '72px'; t.scrollIntoView({ block: 'start' }); }); },
    copy(text) { try { navigator.clipboard.writeText(text).then(() => UI.toast('Copiado al portapapeles.'), () => UI.toast(esc(text), 'info')); } catch (e) { UI.toast(esc(text), 'info'); } }
  };
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function short(v) { if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '') + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace('.0', '') + 'k'; return String(Math.round(v)); }

  /* ---------------- Modelo de acceso por rol ----------------
     Referencia de mercado (ERP turísticos tipo back-office + extranets, CRM tipo Salesforce/HubSpot):
     1) Cada pantalla exige un permiso; el menú y la URL se validan con la misma regla.
     2) Usuarios externos (cliente, pasajero, agencia B2B, guía/conductor, proveedor) nunca entran al
        back-office: tienen su propio portal/app, acotado a SUS datos.
     3) Ventas trabaja sobre su propia cartera; gerencia y administración ven todo el equipo.
     En producción esta regla la aplica el backend (policies); el frontend solo la refleja. */
  const ACCESS = {
    'dashboard': ['*'], 'flujo': ['*'],
    'crm/leads': ['crm.leads.view'], 'crm/oportunidades': ['crm.opportunities.manage'], 'crm/actividades': ['crm.activities.manage'],
    'crm/clientes': ['crm.clients.manage', 'finance.receivables'], 'crm/postventa': ['crm.clients.manage'], 'crm': ['crm.leads.view'],
    'catalogo/productos': ['catalog.products.view'], 'catalogo/salidas': ['catalog.products.view'], 'catalogo/tarifas': ['catalog.products.view'],
    'catalogo/servicios': ['catalog.products.view'], 'catalogo/proveedores': ['catalog.providers.manage', 'finance.payables', 'catalog.products.update'],
    'catalogo/destinos': ['catalog.products.view'], 'catalogo/categorias': ['catalog.products.update'], 'catalogo': ['catalog.products.view'],
    'cotizaciones': ['quotes.view'], 'reservas': ['reservations.view'],
    'operaciones': ['operations.view'],
    'finanzas/cobros': ['finance.receivables'], 'finanzas/pagos': ['finance.payments.register', 'finance.receivables'], 'finanzas/proveedores': ['finance.payables'],
    'finanzas/comisiones': ['finance.commissions'], 'finanzas/rentabilidad': ['finance.profitability'], 'finanzas/facturacion': ['finance.invoicing', 'finance.profitability'],
    'finanzas/conciliacion': ['finance.payments.register', 'finance.profitability'], 'proveedor': ['__solo_extranet__'], 'finanzas': ['finance.receivables', 'finance.invoicing'],
    'canales/b2b': ['channels.b2b.manage'], 'canales/ecommerce': ['channels.ecommerce.manage'], 'canales/cms': ['channels.cms.publish'],
    'canales/portal-cliente': ['channels.b2b.manage', 'channels.cms.publish', 'crm.clients.manage'], 'canales/portal-pasajero': ['channels.b2b.manage', 'channels.cms.publish', 'operations.assign'],
    'mobile': ['operations.assign'],
    'reportes': ['reports.view'],
    'admin/tenants': ['admin.tenant.manage'], 'admin/usuarios': ['admin.users.manage'], 'admin/roles': ['admin.roles.manage'],
    'admin/configuracion': ['admin.settings.manage'], 'admin/notificaciones': ['admin.settings.manage'], 'admin/integraciones': ['admin.settings.manage', 'admin.tenant.manage'],
    'admin/auditoria': ['admin.audit.view'], 'admin/suscripcion': ['admin.billing.manage'], 'admin/api': ['admin.api.manage'], 'admin/plataforma': ['admin.tenant.manage'],
    'admin': ['admin.users.manage', 'admin.tenant.manage'],
    'aprobaciones': ['approvals.view'], 'inbox': ['inbox.view'],
    'crm/metas': ['crm.targets.view', 'crm.targets.manage'], 'crm/reclamaciones': ['crm.claims.manage'], 'libro-reclamaciones': ['crm.claims.manage'],
    'marketing': ['marketing.campaigns.manage'],
    'catalogo/cupos': ['catalog.allotments.manage', 'catalog.products.view_profitability'],
    'operaciones/documentos-viaje': ['operations.travel_docs', 'reservations.create'],
    'finanzas/tesoreria': ['finance.treasury'],
    'admin/reglas': ['admin.settings.manage'], 'admin/comunicaciones': ['admin.settings.manage', 'operations.assign'], 'admin/monedas': ['admin.settings.manage', 'finance.treasury'],
    'canales/resenas-propias': ['channels.ecommerce.manage', 'crm.clients.manage'], 'canales/resenas': ['channels.ecommerce.manage', 'crm.clients.manage'], 'canales/integracion-web': ['channels.ecommerce.manage', 'admin.api.manage']
  };
  /* Experiencia por rol: back-office (menú lateral) o portal/app externo con rutas propias. */
  const ROLE_UX = {
    super_admin: { layout: 'backoffice', home: '#/admin/tenants', label: 'Consola de plataforma' },
    tenant_admin: { layout: 'backoffice', home: '#/dashboard' },
    manager: { layout: 'backoffice', home: '#/dashboard' },
    sales: { layout: 'backoffice', home: '#/dashboard' },
    operations: { layout: 'backoffice', home: '#/dashboard' },
    finance: { layout: 'backoffice', home: '#/dashboard' },
    accounting: { layout: 'backoffice', home: '#/dashboard' },
    guide: { layout: 'mobile', label: 'App del operador', home: '#/mobile/operador', routes: ['mobile/operador'], nav: [] },
    driver: { layout: 'mobile', label: 'App del operador', home: '#/mobile/operador', routes: ['mobile/operador'], nav: [] },
    passenger: { layout: 'portal', label: 'Portal del pasajero', home: '#/canales/portal-pasajero/viajes', routes: ['canales/portal-pasajero', 'mobile/pasajero', 'libro-reclamaciones'], nav: [['Mi viaje', '#/canales/portal-pasajero/viajes'], ['Itinerario', '#/canales/portal-pasajero/itinerario'], ['Vouchers', '#/canales/portal-pasajero/vouchers'], ['Alertas', '#/canales/portal-pasajero/alertas'], ['Contacto', '#/canales/portal-pasajero/contacto'], ['App móvil', '#/mobile/pasajero']] },
    b2b: { layout: 'portal', label: 'Portal de agencias', home: '#/canales/b2b/portal/catalogo', routes: ['canales/b2b/portal'], nav: [['Catálogo y tarifas', '#/canales/b2b/portal/catalogo'], ['Mis reservas', '#/canales/b2b/portal/reservas'], ['Estado de cuenta', '#/canales/b2b/portal/cuenta']] },
    provider: { layout: 'portal', label: 'Extranet de proveedores', home: '#/proveedor/solicitudes', routes: ['proveedor'], nav: [['Solicitudes', '#/proveedor/solicitudes'], ['Rooming lists', '#/proveedor/rooming'], ['Vouchers', '#/proveedor/vouchers'], ['Pagos', '#/proveedor/pagos'], ['Incidencias', '#/proveedor/incidencias'], ['Mi contrato', '#/proveedor/contrato']] }
  };
  ROLE_UX.customer = { layout: 'portal', label: 'Portal del cliente', get home() { return '#/canales/portal-cliente/' + ((Auth.user && Auth.user.clientId) || 'CLI-0001') + '/inicio'; }, get routes() { return ['canales/portal-cliente/' + ((Auth.user && Auth.user.clientId) || 'CLI-0001'), 'libro-reclamaciones']; }, get nav() { const b = '#/canales/portal-cliente/' + ((Auth.user && Auth.user.clientId) || 'CLI-0001') + '/'; return [['Inicio', b + 'inicio'], ['Cotizaciones', b + 'cotizaciones'], ['Mis viajes', b + 'reservas'], ['Documentos', b + 'documentos'], ['Pagos', b + 'pagos'], ['Soporte', b + 'soporte'], ['Libro de reclamaciones', '#/libro-reclamaciones']]; } };
  const Access = {
    ux(role) { return ROLE_UX[role || Auth.role] || ROLE_UX.tenant_admin; },
    isExternal(role) { return Access.ux(role).layout !== 'backoffice'; },
    /* ¿Puede el usuario actual abrir esta ruta (hash sin #/)? Devuelve {ok, need, reason} */
    check(path) {
      if (!Auth.user) return { ok: false, reason: 'Sin sesión' };
      const ux = Access.ux();
      if (ux.layout !== 'backoffice') {
        const ok = ux.routes.some(r => path === r || path.startsWith(r + '/'));
        return ok ? { ok: true } : { ok: false, reason: 'Esta pantalla pertenece al back-office interno de la agencia y no está disponible para usuarios externos (' + Q.roleName(Auth.role) + ').' };
      }
      if (Auth.role === 'super_admin') {
        const ok = ['admin/tenants', 'admin/plataforma', 'admin/integraciones', 'admin/auditoria'].some(r => path === r || path.startsWith(r + '/'));
        return ok ? { ok: true } : { ok: false, reason: 'El Super Admin SaaS administra la plataforma (tenants, planes, jobs y auditoría). Por aislamiento multi-tenant no opera los datos comerciales de las agencias.' };
      }
      const segs = path.split('/'); let need = null;
      for (let i = segs.length; i > 0; i--) { const k = segs.slice(0, i).join('/'); if (ACCESS[k]) { need = ACCESS[k]; break; } }
      if (!need || need[0] === '*') return { ok: true };
      return Auth.canAny(need) ? { ok: true } : { ok: false, need, reason: 'Su rol (' + Q.roleName(Auth.role) + ') no tiene ninguno de los permisos requeridos para esta pantalla.' };
    },
    canRoute(r) { return Access.check(r).ok; },
    /* Evalúa el acceso de CUALQUIER rol a una ruta (para la matriz de acceso en Administración) */
    checkFor(role, path) {
      const ux = Access.ux(role); const perms = DB.rolePerms[role] || [];
      if (ux.layout !== 'backoffice') return ux.routes.some(r => path === r || path.startsWith(r + '/'));
      if (role === 'super_admin') return ['admin/tenants', 'admin/plataforma', 'admin/integraciones', 'admin/auditoria'].some(r => path === r || path.startsWith(r + '/'));
      const segs = path.split('/'); let need = null;
      for (let i = segs.length; i > 0; i--) { const k = segs.slice(0, i).join('/'); if (ACCESS[k]) { need = ACCESS[k]; break; } }
      return !need || need[0] === '*' || need.some(p => perms.includes(p));
    },
    ROUTES: ACCESS, ROLE_UX
  };
  /* Alcance de datos (ownership): Ventas ve su propia cartera; el resto de roles internos ve todo el tenant. */
  const Scope = {
    ownOnly() { return Auth.role === 'sales'; },
    label() { return Scope.ownOnly() ? 'Mi cartera' : 'Todo el equipo'; },
    mine(rows, key = 'owner', { unassigned = false } = {}) { if (!Scope.ownOnly()) return rows; const me = Auth.user.id; return rows.filter(r => r[key] === me || (unassigned && !r[key])); },
    canSee(row, key = 'owner') { return !Scope.ownOnly() || !row || row[key] === Auth.user.id; },
    clientIds() { if (!Scope.ownOnly()) return null; const me = Auth.user.id; const ids = new Set(DB.clients.filter(c => c.owner === me).map(c => c.id)); DB.opportunities.filter(o => o.owner === me).forEach(o => ids.add(o.clientId)); DB.quotes.filter(q => q.owner === me).forEach(q => ids.add(q.clientId)); DB.reservations.filter(r => r.owner === me).forEach(r => ids.add(r.clientId)); return ids; },
    denied(el, what) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Registro fuera de su cartera' }) + UI.alert('warn', '<b>' + esc(what) + '</b> pertenece a la cartera de otro asesor. Con el rol Ventas solo puede consultar y gestionar sus propios registros; solicite a su gerente la reasignación si corresponde.') + '</div>'; }
  };

  /* ---------------- Navegación ---------------- */
  const NAV = [
    { group: 'General', items: [
      { r: 'dashboard', label: 'Panel de control', icon: 'dashboard' },
      { r: 'flujo', label: 'Mapa de procesos', icon: 'route' },
      { r: 'aprobaciones', label: 'Bandeja de aprobaciones', icon: 'checkCircle' },
      { r: 'inbox', label: 'Bandeja omnicanal', icon: 'msg' }
    ] },
    { group: 'Comercial · CRM', perm: ['crm.leads.view', 'crm.clients.manage'], items: [
      { r: 'crm/leads', label: 'Leads', icon: 'funnel', count: () => Scope.mine(DB.leads, 'owner', { unassigned: true }).filter(l => l.status === 'nuevo').length },
      { r: 'crm/oportunidades', label: 'Oportunidades', icon: 'target' },
      { r: 'crm/actividades', label: 'Actividades', icon: 'calendar', count: () => Scope.mine(DB.activities).filter(a => a.status !== 'completada').length },
      { r: 'crm/clientes', label: 'Clientes 360', icon: 'users' },
      { r: 'crm/postventa', label: 'Postventa y fidelización', icon: 'heart' },
      { r: 'crm/metas', label: 'Metas comerciales', icon: 'award' },
      { r: 'crm/reclamaciones', label: 'Libro de reclamaciones', icon: 'clipboard' }
    ] },
    { group: 'Marketing', items: [
      { r: 'marketing/campanas', label: 'Campañas y segmentos', icon: 'send' }
    ] },
    { group: 'Catálogo turístico', perm: ['catalog.products.view'], items: [
      { r: 'catalogo/productos', label: 'Productos', icon: 'box' },
      { r: 'catalogo/salidas', label: 'Salidas y disponibilidad', icon: 'calendar' },
      { r: 'catalogo/tarifas', label: 'Tarifas y temporadas', icon: 'tag' },
      { r: 'catalogo/cupos', label: 'Cupos y bloqueos', icon: 'grid' },
      { r: 'catalogo/servicios', label: 'Servicios', icon: 'layers' },
      { r: 'catalogo/proveedores', label: 'Proveedores', icon: 'building' },
      { r: 'catalogo/destinos', label: 'Destinos', icon: 'map' }
    ] },
    { group: 'Ventas', perm: ['quotes.view', 'reservations.view'], items: [
      { r: 'cotizaciones', label: 'Cotizaciones', icon: 'file', count: () => Scope.mine(DB.quotes).filter(q => ['enviada', 'vista', 'negociacion'].includes(q.status)).length },
      { r: 'reservas', label: 'Reservas', icon: 'suitcase' }
    ] },
    { group: 'Operaciones', perm: ['operations.view'], items: [
      { r: 'operaciones/ordenes', label: 'Órdenes operativas', icon: 'clipboard' },
      { r: 'operaciones/calendario', label: 'Calendario operativo', icon: 'calendar' },
      { r: 'operaciones/asignaciones', label: 'Asignaciones y recursos', icon: 'truck' },
      { r: 'operaciones/rooming', label: 'Rooming list', icon: 'bed' },
      { r: 'operaciones/vouchers', label: 'Vouchers', icon: 'ticket' },
      { r: 'operaciones/documentos-viaje', label: 'Documentos de viaje', icon: 'fileCheck' },
      { r: 'operaciones/incidencias', label: 'Incidencias', icon: 'alert', count: () => DB.incidents.filter(i => i.status !== 'cerrada' && i.status !== 'resuelta').length }
    ] },
    { group: 'Finanzas', perm: ['finance.receivables', 'finance.invoicing'], items: [
      { r: 'finanzas/cobros', label: 'Cuentas por cobrar', icon: 'wallet' },
      { r: 'finanzas/pagos', label: 'Pagos y aplicaciones', icon: 'card' },
      { r: 'finanzas/proveedores', label: 'Cuentas por pagar', icon: 'coins' },
      { r: 'finanzas/comisiones', label: 'Comisiones', icon: 'percent' },
      { r: 'finanzas/rentabilidad', label: 'Rentabilidad', icon: 'trending' },
      { r: 'finanzas/facturacion', label: 'Facturación', icon: 'receipt' },
      { r: 'finanzas/tesoreria', label: 'Tesorería (caja y bancos)', icon: 'database' },
      { r: 'finanzas/conciliacion', label: 'Conciliación bancaria', icon: 'scale' }
    ] },
    { group: 'Canales', perm: ['channels.b2b.manage', 'channels.cms.publish', 'channels.ecommerce.manage'], items: [
      { r: 'canales/b2b', label: 'B2B agencias', icon: 'handshake' },
      { r: 'canales/ecommerce', label: 'E-commerce', icon: 'cart' },
      { r: 'canales/cms', label: 'CMS', icon: 'layout' },
      { r: 'canales/integracion-web', label: 'Integración web y CMS', icon: 'link' },
      { r: 'canales/resenas-propias', label: 'Reseñas de clientes', icon: 'award' },
      { r: 'canales/resenas', label: 'Reseñas externas', icon: 'star' },
      { r: 'canales/portal-cliente', label: 'Portal del cliente', icon: 'globe' },
      { r: 'canales/portal-pasajero', label: 'Portal del pasajero', icon: 'user' }
    ] },
    { group: 'Móvil', perm: ['operations.view'], items: [
      { r: 'mobile/operador', label: 'App operador', icon: 'phone' },
      { r: 'mobile/pasajero', label: 'App pasajero', icon: 'phone' }
    ] },
    { group: 'Inteligencia', perm: ['reports.view'], items: [
      { r: 'reportes', label: 'Reportes y KPIs', icon: 'chart' }
    ] },
    { group: 'Administración', perm: ['admin.users.manage', 'admin.audit.view'], items: [
      { r: 'admin/tenants', label: 'Tenants y planes', icon: 'server', perm: 'admin.tenant.manage' },
      { r: 'admin/plataforma', label: 'Facturación de plataforma', icon: 'receipt' },
      { r: 'admin/usuarios', label: 'Usuarios y sedes', icon: 'users' },
      { r: 'admin/roles', label: 'Roles y permisos', icon: 'key' },
      { r: 'admin/configuracion', label: 'Configuración', icon: 'settings' },
      { r: 'admin/reglas', label: 'Reglas de reserva', icon: 'shield' },
      { r: 'admin/comunicaciones', label: 'Mensajes al pasajero', icon: 'mail' },
      { r: 'admin/monedas', label: 'Monedas y tipo de cambio', icon: 'coins' },
      { r: 'admin/notificaciones', label: 'Notificaciones', icon: 'bell' },
      { r: 'admin/suscripcion', label: 'Suscripción y uso', icon: 'card' },
      { r: 'admin/api', label: 'API y webhooks', icon: 'link' },
      { r: 'admin/integraciones', label: 'Integraciones y jobs', icon: 'plug' },
      { r: 'admin/auditoria', label: 'Auditoría', icon: 'shield' }
    ] }
  ];

  /* ---------------- Router ---------------- */
  const routes = {};
  const App = {
    NAV,
    register(path, def) { routes[path] = typeof def === 'function' ? { render: def } : def; },
    go(hash) { if (location.hash === hash) App.render(); else location.hash = hash; },
    current: '',
    render() {
      UI.closeModal(); UI.closeDrawer(); UI.closeMenu();
      const h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
      const isSite = h === 'sitio' || h.startsWith('sitio/');
      if (!Auth.user && h !== 'login' && !isSite) { location.hash = '#/login'; return; }
      if (h === 'login') { Shell.renderLogin(); return; }
      if (!h) { location.hash = Access.ux().home; return; }
      const segs = h.split('/').filter(Boolean);
      let match = null, params = [];
      for (let i = segs.length; i > 0; i--) { const k = segs.slice(0, i).join('/'); if (routes[k]) { match = k; params = segs.slice(i).map(decodeURIComponent); break; } }
      if (isSite) Shell.ensureSite(); else Shell.ensure();
      App.current = match || '';
      Shell.markActive(match);
      const el = document.getElementById('view');
      el.innerHTML = '';
      window.scrollTo(0, 0);
      document.body.classList.remove('nav-open');
      if (!match) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('La pantalla solicitada no existe en el prototipo.', 'compass')) + '</div>'; return; }
      const acc = isSite ? { ok: true } : Access.check(h);
      if (!acc.ok) { Shell.denied(el, h, acc); return; }
      const sameMaster = App._prevMatch === match; App._prevMatch = match;
      try { routes[match].render(el, params);
        /* Maestro-detalle en pantallas angostas: al elegir otro registro del mismo listado, llevar la vista al detalle */
        const md = sameMaster && window.innerWidth <= 900 && el.querySelector('[data-mdetail]'); if (md) requestAnimationFrame(() => md.scrollIntoView({ block: 'start' }));
      }
      catch (err) { console.error(err); el.innerHTML = '<div class="page">' + UI.alert('bad', '<b>Error al renderizar la vista.</b> ' + esc(err.message)) + '</div>'; }
    }
  };

  /* ---------------- Shell (layout, login, búsqueda, notificaciones) ---------------- */
  const Shell = {
    built: false,
    ensure() {
      const mode = Access.ux().layout + ':' + Auth.user.id;
      if (this.built && this.mode === mode && document.getElementById('view')) { this.renderNav(); this.refreshUser(); return; }
      this.mode = mode;
      if (Access.isExternal()) { this.buildExternal(); return; }
      const root = document.getElementById('app');
      root.innerHTML = '<div class="app"><aside class="side" id="side"></aside><div class="scrim" id="scrim"></div><div class="main"><header class="topbar">' +
        '<button class="burger" id="burger" aria-label="Abrir menú">' + icon('menu') + '</button>' +
        '<div class="gsearch">' + icon('search') + '<input id="gs" type="search" placeholder="Buscar cliente, cotización, reserva, producto…" autocomplete="off" aria-label="Búsqueda global"><span class="kbd">/</span><div class="gs-results" id="gs-res" hidden></div></div>' +
        '<div class="top-actions"><button class="btn primary" id="btn-new">' + icon('plus') + '<span class="ub-text">Nuevo</span></button><a class="icon-btn top-opt" href="#/sitio" title="Ver sitio web público">' + icon('globe') + '</a><button class="icon-btn top-opt" id="btn-theme" title="Cambiar tema">' + icon('moon') + '</button><button class="icon-btn" id="btn-bell" title="Notificaciones">' + icon('bell') + '<span class="dot" id="bell-dot">0</span></button><button class="user-btn" id="btn-user"></button></div>' +
        '</header><main class="content"><div id="view"></div></main></div></div>';
      this.built = true;
      this.renderNav(); this.refreshUser(); this.refreshBell();
      document.getElementById('burger').onclick = () => document.body.classList.toggle('nav-open');
      document.getElementById('scrim').onclick = () => document.body.classList.remove('nav-open');
      document.getElementById('btn-bell').onclick = () => Shell.openInbox();
      document.getElementById('btn-theme').onclick = () => Shell.toggleTheme();
      document.getElementById('btn-user').onclick = (e) => Shell.userMenu(e.currentTarget);
      document.getElementById('btn-new').onclick = (e) => Shell.quickCreate(e.currentTarget);
      this.bindSearch();
    },
    renderNav() {
      const side = document.getElementById('side'); if (!side) { this.markActive(App.current); return; }
      const t = DB.tenant;
      side.innerHTML = '<div class="brand"><div class="brand-mark">' + icon('logo') + '</div><div><div class="brand-name">Qhapaq Travel Suite</div><div class="brand-sub">ERP · CRM turístico</div></div></div>' +
        '<div class="tenant-chip" id="tenant-chip" title="Tenant activo"><div class="av">' + esc(t.logo) + '</div><div class="grow"><b>' + esc(t.short) + '</b><span>' + esc(t.plan) + ' · ' + esc(Q.sedeName(Auth.user.sede)) + '</span></div>' + icon('chevronDown') + '</div>' +
        '<div class="nav-find">' + icon('search') + '<input id="nav-q" type="search" placeholder="Buscar en el menú" aria-label="Buscar en el menú" autocomplete="off"></div>' +
        '<nav class="nav" aria-label="Navegación principal">' + NAV.map(g => ({ ...g, vis: g.items.filter(i => Access.canRoute(i.r)) })).filter(g => g.vis.length).map(g => '<div class="nav-group' + (Shell.collapsed(g.group) ? ' closed' : '') + '" data-g="' + esc(g.group) + '"><button class="nav-group-title" type="button" aria-expanded="' + !Shell.collapsed(g.group) + '">' + esc(g.group) + icon('chevronDown') + '</button><div class="nav-items">' + g.vis.map(i => { const c = i.count ? i.count() : 0; return '<a href="#/' + i.r + '" data-r="' + i.r + '">' + icon(i.icon) + '<span>' + esc(i.label) + '</span>' + (c ? '<span class="cnt">' + c + '</span>' : '') + '</a>'; }).join('') + '</div></div>').join('') + '</nav>' +
        '<div class="side-foot">Prototipo funcional v1.0 · Datos ficticios<br>Tenant ' + esc(t.id) + ' · ' + esc(t.tz) + '</div>';
      side.querySelector('#tenant-chip').onclick = () => Shell.tenantInfo();
      side.querySelectorAll('.nav-group-title').forEach(b => b.onclick = () => { const g = b.parentElement; g.classList.toggle('closed'); b.setAttribute('aria-expanded', !g.classList.contains('closed')); Shell.setCollapsed(g.dataset.g, g.classList.contains('closed')); });
      const nq = side.querySelector('#nav-q');
      nq.oninput = () => { const q = nq.value.trim().toLowerCase(); side.querySelectorAll('.nav-group').forEach(g => { let any = false; g.querySelectorAll('a').forEach(a => { const hit = !q || a.textContent.toLowerCase().includes(q); a.hidden = !hit; any = any || hit; }); g.hidden = !any; g.classList.toggle('searching', !!q); }); };
      nq.onkeydown = (e) => { if (e.key === 'Enter') { const a = [...side.querySelectorAll('.nav a')].find(x => !x.hidden); if (a) { location.hash = a.getAttribute('href'); nq.value = ''; nq.oninput(); } } if (e.key === 'Escape') { nq.value = ''; nq.oninput(); } };
      this.markActive(App.current);
    },
    collapsed(g) { try { return (JSON.parse(localStorage.getItem('qhapaq_nav') || '{}'))[g] === true; } catch (e) { return false; } },
    setCollapsed(g, v) { try { const m = JSON.parse(localStorage.getItem('qhapaq_nav') || '{}'); m[g] = v; localStorage.setItem('qhapaq_nav', JSON.stringify(m)); } catch (e) { } },
    markActive(r) { const h = location.hash; document.querySelectorAll('.ext-nav a').forEach(a => a.classList.toggle('active', h === a.getAttribute('href') || h.startsWith(a.getAttribute('href') + '/'))); const en = document.querySelector('.ext-nav'); if (en) { const act = en.querySelector('a.active'); if (act && en.scrollWidth > en.clientWidth) en.scrollLeft = Math.max(0, act.offsetLeft - en.offsetLeft - (en.clientWidth - act.offsetWidth) / 2); const upd = () => { en.classList.toggle('at-end', en.scrollLeft + en.clientWidth >= en.scrollWidth - 4); en.classList.toggle('at-start', en.scrollLeft <= 4); }; upd(); en.onscroll = upd; } document.querySelectorAll('.nav a').forEach(a => { const on = !!r && (a.dataset.r === r || (r.startsWith(a.dataset.r + '/'))); a.classList.toggle('active', on); if (on) { const g = a.closest('.nav-group'); if (g) g.classList.remove('closed'); } }); },
    refreshUser() {
      const b = document.getElementById('btn-user'); if (!b || !Auth.user) return;
      b.innerHTML = UI.avatar(Auth.user) + '<span class="ub-text"><b>' + esc(Auth.user.name.split(' ').slice(0, 2).join(' ')) + '</b><span>' + esc(Q.roleName(Auth.user.role)) + '</span></span>' + icon('chevronDown');
    },
    refreshBell() { const d = document.getElementById('bell-dot'); if (!d) return; const n = DB.notifications.filter(x => !x.read).length; d.textContent = n > 9 ? '9+' : n; d.hidden = !n; },
    toggleTheme() { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('qhapaq_theme', r.dataset.theme); } catch (e) { } },
    userMenu(anchor) {
      const narrow = matchMedia('(max-width:640px)').matches;
      UI.menu(anchor, [
        { label: 'Mi perfil', icon: 'user', onClick: () => Shell.profile() },
        ...(narrow ? [{ label: 'Cambiar tema claro/oscuro', icon: 'moon', onClick: () => Shell.toggleTheme() }] : []),
        ...(narrow && !Access.isExternal() ? [{ label: 'Ver sitio web público', icon: 'globe', onClick: () => App.go('#/sitio') }] : []),
        { label: 'Cambiar de rol (demo)', icon: 'users', onClick: () => Shell.switchRole() },
        ...(Access.isExternal() ? [] : [{ label: 'Ver documentación de procesos', icon: 'route', onClick: () => App.go('#/flujo') }]),
        '-',
        { label: 'Restablecer datos de demostración', icon: 'refresh', onClick: () => UI.confirm({ title: 'Restablecer datos', message: 'Se descartarán todos los cambios realizados en esta demo y se cargarán los datos originales.', confirmLabel: 'Restablecer', danger: true, onConfirm: () => Store.reset() }) },
        { label: 'Cerrar sesión', icon: 'logout', onClick: () => Auth.logout() }
      ]);
    },
    profile() {
      const u = Auth.user; const perms = DB.rolePerms[u.role] || [];
      UI.drawer({ title: 'Mi perfil', body: '<div class="row" style="margin-bottom:16px">' + UI.avatar(u, 'lg') + '<div><h3>' + esc(u.name) + '</h3><div class="small muted">' + esc(u.email) + '</div></div></div>' + UI.dl([['Rol', Q.roleName(u.role)], ['Experiencia', Access.isExternal() ? esc(Access.ux().label) + ' (externo)' : 'Back-office interno'], ['Alcance de datos', Access.isExternal() ? 'Solo registros vinculados a su cuenta' : Scope.ownOnly() ? 'Mi cartera (registros propios)' : 'Todo el tenant'], ['Sede', Q.sedeName(u.sede)], ['Tenant', DB.tenant.name], ['Teléfono', esc(u.phone)], ['MFA', u.mfa ? badge('activo', 'Habilitado') : badge('pendiente', 'No habilitado')], ['Último acceso', datetime(u.lastLogin)]]) + '<div class="divider" style="margin:16px 0"></div><div class="upper" style="margin-bottom:8px">Permisos efectivos (' + perms.length + ')</div><div class="chip-row">' + perms.map(p => '<span class="tag mono">' + esc(p) + '</span>').join('') + '</div><p class="xs faint" style="margin-top:12px">La autorización real se valida en el backend en cada solicitud (PROC-062). El menú solo refleja lo que el rol puede ver.</p>' });
    },
    switchRole() {
      const opts = DB.users.filter(u => u.status === 'activo').sort((a, b) => (Access.isExternal(a.role) - Access.isExternal(b.role)));
      UI.modal({ title: 'Cambiar de rol (modo demostración)', sub: 'Inicie sesión como otro usuario para ver el sistema según su rol y permisos.', size: 'lg', body: '<div class="role-grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">' + opts.map(u => '<button class="role-opt' + (u.id === Auth.user.id ? ' on' : '') + '" data-u="' + u.id + '">' + UI.avatar(u) + '<div><b>' + esc(u.name) + '</b><span>' + esc(Q.roleName(u.role)) + (Access.isExternal(u.role) ? ' · externo' : '') + '</span></div></button>').join('') + '</div>',
        onOpen: (m) => m.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { Auth.login(b.dataset.u); UI.closeModal(); Shell.built = false; const home = Shell.homeFor(Auth.user.role); location.hash = home; App.render(); UI.toast('Sesión iniciada como ' + esc(Auth.user.name)); }) });
    },
    homeFor(role) { return Access.ux(role).home; },
    /* Creación rápida: solo muestra lo que el rol puede crear */
    quickCreate(anchor) {
      const opts = [
        ['Lead', 'funnel', '#/crm/leads/nuevo', 'crm.leads.manage'], ['Oportunidad', 'target', '#/crm/oportunidades/nueva', 'crm.opportunities.manage'],
        ['Cliente', 'user', '#/crm/clientes/nuevo', 'crm.clients.manage'], ['Cotización', 'file', '#/cotizaciones/nueva', 'quotes.create'],
        ['Reserva directa', 'suitcase', '#/reservas/nueva', 'reservations.create'], ['Producto turístico', 'box', '#/catalogo/productos/nuevo', 'catalog.products.create'],
        ['Incidencia', 'alert', '#/operaciones/incidencias', 'operations.incidents'], ['Cobro / pago', 'wallet', '#/finanzas/cobros', 'finance.payments.register'],
        ['Campaña', 'send', '#/marketing/campanas', 'marketing.campaigns.manage'], ['Usuario', 'users', '#/admin/usuarios', 'admin.users.manage']
      ].filter(o => Auth.can(o[3]) && Access.canRoute(o[2].slice(2)));
      if (!opts.length) { UI.toast('Su rol no tiene opciones de creación rápida.', 'info'); return; }
      UI.menu(anchor, opts.map(o => ({ label: o[0], icon: o[1], onClick: () => App.go(o[2]) })));
    },
    /* Pantalla 403: acceso denegado por rol (el backend respondería 403 y registraría el intento) */
    denied(el, path, acc) {
      Audit.log('Acceso', '/' + path, 'acceso_denegado', Q.roleName(Auth.role), acc.need ? 'requiere ' + acc.need.join(' | ') : 'fuera del alcance del rol');
      const home = Access.ux().home;
      el.innerHTML = '<div class="page"><div class="card" style="max-width:720px;margin:24px auto;width:100%"><div class="card-b" style="padding:32px;display:grid;gap:14px;justify-items:start">' +
        '<div class="ico-box bad" style="width:48px;height:48px">' + icon('lock') + '</div><div class="upper">Error 403 · Acceso restringido</div><h1>No tiene acceso a esta pantalla</h1><p class="muted">' + esc(acc.reason) + '</p>' +
        (acc.need ? '<div class="small">Permiso requerido (cualquiera de): ' + acc.need.map(p => '<span class="tag mono">' + esc(p) + '</span>').join(' ') + '</div>' : '') +
        '<div class="small faint">Ruta solicitada: <span class="mono">/' + esc(path) + '</span> · El intento quedó registrado en auditoría.</div>' +
        '<div class="row"><a class="btn primary" href="' + home + '">' + icon('home') + 'Ir a mi inicio</a>' + (Access.isExternal() ? '' : '<button class="btn" id="dn-req">' + icon('send') + 'Solicitar acceso al administrador</button>') + '</div></div></div></div>';
      const b = el.querySelector('#dn-req'); if (b) b.onclick = () => { Notify.push('acceso.solicitud', 'Email', 'U01', 'Solicitud de acceso de ' + Auth.user.name + ' a /' + path); UI.toast('Solicitud enviada al administrador del tenant.'); b.disabled = true; };
    },
    /* Shell del sitio web público: sin menú ni barra; el módulo sitio.js dibuja su propia cabecera y pie */
    ensureSite() {
      if (this.mode === 'site' && document.getElementById('view')) return;
      this.mode = 'site'; this.built = false;
      document.getElementById('app').innerHTML = '<div class="site-root"><div id="view"></div></div>';
    },
    /* Shell de usuarios externos: portal o app sin menú de back-office */
    buildExternal() {
      const ux = Access.ux(); const t = DB.tenant; const u = Auth.user;
      const root = document.getElementById('app');
      root.innerHTML = '<div class="ext ' + (ux.layout === 'mobile' ? 'ext-mobile' : '') + '"><header class="ext-top"><div class="ext-row"><div class="ext-brand"><div class="brand-mark">' + icon('logo') + '</div><div><b>' + esc(t.short) + ' Travel</b><span>' + esc(ux.label) + '</span></div></div>' +
        '<nav class="ext-nav" aria-label="Navegación del portal">' + (ux.nav || []).map(n => '<a href="' + n[1] + '">' + esc(n[0]) + '</a>').join('') + '</nav>' +
        '<div class="ext-actions"><button class="icon-btn top-opt" id="btn-theme" title="Cambiar tema">' + icon('moon') + '</button><button class="user-btn" id="btn-user"></button></div></div></header>' +
        '<main class="content"><div id="view"></div></main>' +
        '<footer class="ext-foot">' + esc(t.name) + ' · RUC ' + esc(t.ruc) + ' · Sesión de ' + esc(u.name) + ' (' + esc(Q.roleName(u.role)) + ') · Solo se muestran datos vinculados a su cuenta.</footer></div>';
      this.built = true; this.refreshUser();
      document.getElementById('btn-theme').onclick = () => Shell.toggleTheme();
      document.getElementById('btn-user').onclick = (e) => Shell.userMenu(e.currentTarget);
    },
    tenantInfo() {
      const t = DB.tenant;
      UI.drawer({ title: 'Tenant activo', sub: 'Aislamiento multi-tenant: todas las consultas se filtran por tenant en el backend.', body: UI.dl([['Razón social', esc(t.name)], ['RUC', t.ruc], ['ID tenant', '<span class="mono">' + t.id + '</span>'], ['Plan', t.plan], ['Moneda base', t.currency + ' · alterna ' + t.altCurrency + ' (TC ' + DB.settings.fx + ')'], ['Zona horaria', t.tz], ['IGV', DB.settings.taxPct + '%'], ['Estado', badge(t.status)], ['Alta', date(t.createdAt)]]) + '<div class="divider" style="margin:16px 0"></div><div class="upper" style="margin-bottom:8px">Sedes</div>' + DB.sedes.map(s => '<div class="list-item" style="padding:9px 0">' + '<div class="ico-box">' + icon('building') + '</div><div class="grow"><b class="small">' + esc(s.name) + '</b><div class="xs faint">' + esc(s.address) + '</div></div>' + badge(s.status) + '</div>').join('') + '<div style="margin-top:14px">' + UI.alert('info', 'Prueba E2E-08: un usuario del tenant A no puede acceder a datos del tenant B. El tenant se resuelve desde la autenticación, nunca desde un parámetro enviado por el cliente.') + '</div>' });
    },
    openInbox() {
      DB.notifications.forEach(n => n.read = true); Store.save(); this.refreshBell();
      const chIcon = { Email: 'mail', WhatsApp: 'msg', Push: 'phone', Portal: 'globe' };
      UI.drawer({ title: 'Notificaciones', sub: 'Eventos del sistema enviados por email, WhatsApp, push y portal (PROC-059)', body: '<div class="list">' + DB.notifications.slice(0, 25).map(n => '<div class="list-item" style="padding:10px 0"><div class="ico-box ' + (n.status === 'fallido' ? 'bad' : n.event.includes('critica') ? 'bad' : '') + '">' + icon(chIcon[n.channel] || 'bell') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(n.subject) + '</div><div class="xs faint">' + esc(n.channel) + ' → ' + esc(Q.user(n.to) ? Q.userName(n.to) : n.to) + ' · ' + datetime(n.ts) + '</div></div>' + badge(n.status) + '</div>').join('') + '</div>', actions: [{ label: 'Ver registro completo', cls: 'primary', onClick: () => App.go('#/admin/notificaciones') }] });
    },
    bindSearch() {
      const inp = document.getElementById('gs'), res = document.getElementById('gs-res');
      const run = () => {
        const q = inp.value.trim().toLowerCase(); if (q.length < 2) { res.hidden = true; return; }
        const hits = [];
        const add = (arr, type, ic, lbl, sub, href) => arr.forEach(x => { const txt = (lbl(x) + ' ' + x.id + ' ' + (sub(x) || '')).toLowerCase(); if (txt.includes(q)) hits.push({ type, ic, label: lbl(x), sub: sub(x), href: href(x), id: x.id }); });
        add(DB.clients, 'Cliente', 'user', x => x.name, x => x.doc, x => '#/crm/clientes/' + x.id);
        add(DB.leads, 'Lead', 'funnel', x => x.name, x => x.destination, x => '#/crm/leads/' + x.id);
        add(DB.opportunities, 'Oportunidad', 'target', x => x.title, x => Q.clientName(x.clientId), x => '#/crm/oportunidades/' + x.id);
        add(DB.quotes, 'Cotización', 'file', x => x.title, x => Q.clientName(x.clientId), x => '#/cotizaciones/' + x.id);
        add(DB.reservations, 'Reserva', 'suitcase', x => x.title, x => Q.clientName(x.clientId), x => '#/reservas/' + x.id);
        add(DB.products, 'Producto', 'box', x => x.name, x => x.code, x => '#/catalogo/productos/' + x.id);
        add(DB.providers, 'Proveedor', 'building', x => x.name, x => x.type, x => '#/catalogo/proveedores/' + x.id);
        add(DB.operations, 'Orden operativa', 'clipboard', x => x.title, x => x.resId, x => '#/operaciones/ordenes/' + x.id);
        const vis = hits.filter(x => Access.canRoute(x.href.replace(/^#\//, '')) && (!Scope.ownOnly() || (x.type === 'Cliente' ? Scope.clientIds().has(x.id) : !['Lead', 'Oportunidad', 'Cotización', 'Reserva'].includes(x.type)) || (() => { const col = { Lead: 'leads', Oportunidad: 'opportunities', Cotización: 'quotes', Reserva: 'reservations' }[x.type]; const r = DB[col].find(y => y.id === x.id); return r && r.owner === Auth.user.id; })()));
        hits.length = 0; hits.push(...vis);
        res.innerHTML = hits.length ? hits.slice(0, 12).map((h, i) => '<a href="' + h.href + '" class="' + (i === 0 ? 'sel' : '') + '"><div class="ico-box" style="width:28px;height:28px">' + icon(h.ic) + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(h.label) + '</div><div class="xs faint">' + esc(h.type) + ' · <span class="mono">' + esc(h.id) + '</span>' + (h.sub ? ' · ' + esc(h.sub) : '') + '</div></div></a>').join('') : '<div class="empty" style="padding:18px">Sin resultados para “' + esc(q) + '”</div>';
        res.hidden = false;
        res.querySelectorAll('a').forEach(a => a.onclick = () => { res.hidden = true; inp.value = ''; });
      };
      inp.addEventListener('input', debounce(run, 120));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = res.querySelector('a.sel'); if (a) { location.hash = a.getAttribute('href'); res.hidden = true; inp.value = ''; inp.blur(); } } if (e.key === 'Escape') { res.hidden = true; inp.blur(); } });
      document.addEventListener('mousedown', e => { if (!e.target.closest('.gsearch')) res.hidden = true; });
      document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); } });
    },
    renderLogin() {
      this.built = false;
      const demo = [['U01', 'Back-office completo'], ['U02', 'Supervisión y aprobaciones'], ['U03', 'Su cartera comercial'], ['U05', 'Reservas en ejecución'], ['U07', 'Cobros, pagos y márgenes'], ['U08', 'Comprobantes y CxC'], ['U09', 'App móvil de campo'], ['U13', 'Portal de agencias'], ['U14', 'Portal del cliente'], ['U15', 'Portal del pasajero'], ['U17', 'Extranet de proveedores'], ['U16', 'Consola de plataforma']];
      let sel = 'U01';
      const root = document.getElementById('app');
      root.innerHTML = '<div class="login"><section class="login-art"><div class="brand" style="padding:0"><div class="brand-mark">' + icon('logo') + '</div><div><div class="brand-name">Qhapaq Travel Suite</div><div class="brand-sub">SaaS multi-tenant para agencias y operadores</div></div></div>' +
        '<div style="position:relative"><h1>Gestión integral de la agencia, de la primera consulta al cierre del viaje.</h1><p>CRM, catálogo turístico, cotizaciones versionadas, reservas, operaciones, finanzas, portales, B2B y apps móviles en una sola plataforma con aislamiento por tenant y auditoría completa.</p><div class="login-flow">' + ['Lead', 'Oportunidad', 'Cotización', 'Aprobación', 'Reserva', 'Operación', 'Voucher', 'Ejecución', 'Cobro', 'Rentabilidad', 'Postventa'].map(s => '<span>' + s + '</span>').join('') + '</div></div>' +
        '<svg class="bgm" viewBox="0 0 800 300" preserveAspectRatio="none"><path d="M0 300 L0 210 L90 150 L150 190 L260 80 L340 170 L420 120 L520 200 L610 110 L700 170 L800 130 L800 300Z" fill="#0B4E97"/><path d="M0 300 L0 250 L120 200 L210 240 L330 170 L450 235 L560 190 L680 245 L800 210 L800 300Z" fill="#0A3A73"/></svg>' +
        '<div class="small" style="position:relative;color:var(--side-fg-2)">Prototipo navegable · Datos ficticios · Fecha de referencia ' + date(window.TODAY) + '</div></section>' +
        '<section class="login-form"><form class="login-box" id="login-f" autocomplete="off"><div><h2 style="font-size:1.3rem">Iniciar sesión</h2><p class="small muted" style="margin-top:4px">Seleccione un perfil de demostración. Cada rol ve menús, datos y acciones distintos.</p></div>' +
        '<div class="field"><label for="lg-tenant">Empresa (tenant)</label><select class="input" id="lg-tenant"><option>Andes Horizonte Travel S.A.C. — TNT-0001</option></select></div>' +
        '<div class="field"><label for="lg-email">Correo</label><input class="input" id="lg-email" value="' + esc(Q.user(sel).email) + '"></div>' +
        '<div class="field"><label for="lg-pass">Contraseña</label><input class="input" id="lg-pass" type="password" value="demo-2026"></div>' +
        '<div class="upper">Perfiles de demostración</div><div class="role-grid">' + demo.map(([id, d]) => { const u = Q.user(id); return '<button type="button" class="role-opt' + (id === sel ? ' on' : '') + '" data-u="' + id + '">' + UI.avatar(u) + '<div style="min-width:0"><b>' + esc(Q.roleName(u.role)) + '</b><span>' + esc(d) + '</span></div></button>'; }).join('') + '</div>' +
        '<button class="btn primary" type="submit" style="height:40px;justify-content:center">' + icon('lock') + 'Ingresar</button><a class="btn" href="#/sitio" style="height:40px;justify-content:center">' + icon('globe') + 'Ver sitio web público de la agencia</a><p class="xs faint center">Autenticación con token, resolución de tenant y validación de permisos en backend (PROC-062). MFA disponible por usuario.</p></form></section></div>';
      root.querySelectorAll('.role-opt').forEach(b => b.onclick = () => { sel = b.dataset.u; root.querySelectorAll('.role-opt').forEach(x => x.classList.toggle('on', x === b)); root.querySelector('#lg-email').value = Q.user(sel).email; });
      root.querySelector('#login-f').onsubmit = (e) => { e.preventDefault(); Auth.login(sel); location.hash = Shell.homeFor(Auth.user.role); App.render(); };
    }
  };

  /* ---------------- Tablas responsive (v2.4) ----------------
     En pantallas ≤ 900 px, toda table.tbl que no cabe (o ≥ 5 columnas en ≤ 640 px) en su contenedor se muestra como tarjetas:
     cada celda recibe data-label con el encabezado de su columna; la primera celda es el título
     y la columna de acciones (sin encabezado) va al pie. Excluir con la clase .no-stack (matrices). */
  const ResponsiveTables = {
    SKIP: '.no-stack,.perm-matrix,.am-matrix,.av-tbl,.cal-tbl',
    label(t) {
      const hr = t.tHead && t.tHead.rows.length ? t.tHead.rows[t.tHead.rows.length - 1] : null;
      if (!hr) return false;
      const heads = []; [...hr.cells].forEach(c => { const n = c.colSpan || 1; const tx = c.textContent.replace(/[↑↓]/g, '').trim(); for (let i = 0; i < n; i++) heads.push(tx); });
      [...t.tBodies, t.tFoot].filter(Boolean).forEach(sec => [...sec.rows].forEach(tr => {
        let idx = 0; const cells = [...tr.cells];
        cells.forEach((td, k) => {
          const lab = heads[idx] || ''; idx += td.colSpan || 1;
          if (td.dataset.label !== lab) td.dataset.label = lab;
          const empty = !td.textContent.trim() && !td.querySelector('input,select,button,a,svg,img,.badge');
          const onlyActions = !lab && td.querySelector('button,a,.btn') && !td.textContent.replace(/\s/g, '').length;
          td.classList.toggle('rt-title', k === 0 && cells.length > 1 && sec !== t.tFoot);
          td.classList.toggle('rt-act', k > 0 && (onlyActions || (!lab && !!td.querySelector('.btn,button'))));
          td.classList.toggle('rt-empty', k > 0 && empty);
        });
      }));
      return heads.length > 1;
    },
    apply() {
      const vw = window.innerWidth, narrow = vw <= 900, phone = vw <= 640;
      document.querySelectorAll('table.tbl').forEach(t => {
        if (t.matches(ResponsiveTables.SKIP)) return;
        if (!ResponsiveTables.label(t)) return;
        if (!narrow) { t.classList.remove('rt'); return; }
        if (t.classList.contains('rt')) return;
        const box = t.parentElement; if (!box || !t.offsetParent) return;
        if (t.scrollWidth > box.clientWidth + 4 || (phone && t.tHead.rows[0].cells.length >= 5)) t.classList.add('rt');
      });
    },
    init() {
      let raf = 0; const run = () => { raf = 0; try { ResponsiveTables.apply(); } catch (e) { } };
      const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
      let w = window.innerWidth;
      window.addEventListener('resize', () => { if (window.innerWidth === w) return; w = window.innerWidth; document.querySelectorAll('table.tbl.rt').forEach(t => t.classList.remove('rt')); schedule(); });
      schedule();
    }
  };

  /* ---------------- Cabeceras de página en móvil (v2.4) ----------------
     ≤ 640 px: subtítulo recortado a 3 líneas con «Ver más»; si hay más de 2 acciones, queda visible la
     primaria (o la última) y el resto pasa a una hoja inferior «Más acciones». Los botones originales se
     mueven (no se copian), así conservan sus manejadores; al volver a escritorio se restauran. */
  const MobileHeader = {
    scrollers() {
      /* Pestañas deslizables: la activa queda visible y los bordes se difuminan cuando hay más contenido */
      document.querySelectorAll('.tabs, .pt-nav').forEach(tb => {
        const over = tb.scrollWidth > tb.clientWidth + 2;
        tb.classList.toggle('is-scroll', over);
        if (!over) return;
        const on = tb.querySelector('.tab.on, a.on, a.active, [aria-selected="true"]');
        if (on && tb.dataset.sc !== on.textContent) { tb.dataset.sc = on.textContent; const l = on.offsetLeft - tb.offsetLeft; if (l < tb.scrollLeft || l + on.offsetWidth > tb.scrollLeft + tb.clientWidth) tb.scrollLeft = Math.max(0, l - (tb.clientWidth - on.offsetWidth) / 2); }
        const upd = () => { tb.classList.toggle('at-start', tb.scrollLeft <= 4); tb.classList.toggle('at-end', tb.scrollLeft + tb.clientWidth >= tb.scrollWidth - 4); };
        upd(); if (!tb.dataset.scb) { tb.dataset.scb = '1'; tb.addEventListener('scroll', upd, { passive: true }); }
      });
    },
    apply() {
      const phone = window.innerWidth <= 640;
      MobileHeader.scrollers();
      document.querySelectorAll('.ph').forEach(ph => {
        const sub = ph.querySelector(':scope > .grow > .sub');
        if (sub) {
          if (phone && !sub.dataset.mh && sub.textContent.length > 140) {
            sub.dataset.mh = '1'; sub.classList.add('clamp');
            const more = document.createElement('button'); more.type = 'button'; more.className = 'sub-more'; more.textContent = 'Ver más';
            more.onclick = () => { const c = sub.classList.toggle('clamp'); more.textContent = c ? 'Ver más' : 'Ver menos'; };
            sub.after(more);
          } else if (!phone && sub.dataset.mh) { sub.classList.remove('clamp'); delete sub.dataset.mh; const m = sub.nextElementSibling; if (m && m.classList.contains('sub-more')) m.remove(); }
        }
        const act = ph.querySelector(':scope > .ph-actions'); if (!act) return;
        if (phone && !act.classList.contains('ph-m')) {
          const items = [...act.children].filter(e => !e.hidden && e.offsetParent !== null || e.tagName === 'SELECT');
          const btns = items.filter(e => e.matches('.btn, a.btn, button'));
          const isDanger = b => b.classList.contains('danger');
          const isMenu = b => /m[aá]s acciones/i.test(b.textContent) || (!b.textContent.trim() && /more|dots/.test(b.innerHTML));
          if (btns.length <= 1 || (btns.length === 2 && !btns.some(isDanger))) return;
          const keep = btns.find(b => b.classList.contains('primary')) || btns.find(b => !isDanger(b) && !isMenu(b)) || btns[0];
          const moved = btns.filter(b => b !== keep && !b.classList.contains('ph-more-btn'));
          const store = document.createElement('div'); store.className = 'ph-more-pop'; moved.forEach(b => store.appendChild(b));
          const more = document.createElement('button'); more.type = 'button'; more.className = 'btn ph-more-btn'; more.setAttribute('aria-label', 'Más acciones'); more.innerHTML = icon('more') + '<span>Más</span>';
          more.onclick = () => MobileHeader.sheet(store, more);
          act.classList.add('ph-m'); act.appendChild(more); act.appendChild(store);
        } else if (!phone && act.classList.contains('ph-m')) {
          const store = act.querySelector('.ph-more-pop'); const more = act.querySelector('.ph-more-btn');
          if (store) [...store.children].forEach(b => act.insertBefore(b, more)); store && store.remove(); more && more.remove(); act.classList.remove('ph-m');
        }
      });
    },
    sheet(store, anchor) {
      const ov = document.createElement('div'); ov.className = 'ph-sheet-ov';
      const sh = document.createElement('div'); sh.className = 'ph-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Más acciones');
      sh.innerHTML = '<div class="grab"></div><div class="t">Más acciones</div>';
      const items = [...store.children];
      const close = () => { items.forEach(b => store.appendChild(b)); ov.remove(); sh.remove(); document.removeEventListener('keydown', esc1); };
      const esc1 = (e) => { if (e.key === 'Escape') close(); };
      items.forEach(b => { sh.appendChild(b); b.addEventListener('click', close, { once: true }); });
      ov.onclick = close; document.addEventListener('keydown', esc1);
      document.body.appendChild(ov); document.body.appendChild(sh);
    },
    init() {
      let raf = 0; const run = () => { raf = 0; try { MobileHeader.apply(); } catch (e) { } };
      const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
      window.addEventListener('resize', schedule); schedule();
    }
  };

  /* ---------------- Exposición global ---------------- */
  Object.assign(window, { Store, UI, Q, Pricing, Audit, Notify, Auth, App, Shell, Seq, Access, Scope, ResponsiveTables, MobileHeader, Util: { esc, money, fmtN, date, dateShort, datetime, parseD, addDays, daysBetween, daysFromToday, nowStr, uid, sum, groupBy, toPEN, clone, initials, debounce, pad } });

  /* Arranque */
  document.addEventListener('DOMContentLoaded', () => {
    try { const th = localStorage.getItem('qhapaq_theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { }
    Auth.load();
    ResponsiveTables.init();
    MobileHeader.init();
    window.addEventListener('hashchange', () => App.render());
    App.render();
  });
})();
