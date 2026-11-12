/* Canales: B2B (PROC-053), E-commerce (PROC-054), CMS (PROC-055), Portal cliente (PROC-051), Portal pasajero (PROC-052) */
(function () {
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr } = Util;
  const ic = UI.icon;
  const T = () => window.TODAY;
  const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  /* ---------------- Estilos propios del módulo (solo variables del tema) ---------------- */
  (function css() {
    if (document.getElementById('css-canales')) return;
    const s = document.createElement('style'); s.id = 'css-canales';
    s.textContent = [
      '.chv-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--side);color:var(--side-fg);border-radius:var(--r);padding:9px 14px;font-size:.8rem}',
      '.chv-bar>svg{width:18px;height:18px;color:var(--side-fg-2)}',
      '.chv-bar b{font-weight:650;color:var(--side-fg)} .chv-bar .chv-d{color:var(--side-fg-2)}',
      '.chv-bar select,.chv-bar .btn{height:30px;font-size:.78rem;background:var(--side-2);border:1px solid var(--side-act);color:var(--side-fg);border-radius:7px}',
      '.chv-bar select{padding:0 8px;max-width:100%} .chv-bar .btn:hover{background:var(--side-act)}',
      '.chv-bar>label{flex:1 1 240px;min-width:0;flex-wrap:wrap} .chv-bar>label select{flex:1 1 160px;min-width:0}',
      '@media (max-width:640px){.chv-bar{padding:10px 12px}.chv-bar .chv-d{display:none}.chv-bar>label{flex-basis:100%}}',
      '.chv-tabs a.tab{text-decoration:none}','.chv-page{grid-template-columns:minmax(0,1fr)}','.chv-page>*,.chv-page .stack>*{min-width:0}',
      '.pt{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);min-width:0}',
      '.pt-h{display:flex;align-items:center;gap:18px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--line);flex-wrap:wrap}',
      '.pt-logo{display:flex;gap:10px;align-items:center;flex:none}',
      '.pt-mark{width:36px;height:36px;border-radius:8px;background:var(--accent);color:var(--accent-fg);display:grid;place-items:center;flex:none}',
      '.pt-mark svg{width:20px;height:20px}',
      '.pt-name{font-family:var(--f-display);font-weight:650;font-size:.98rem;line-height:1.15;color:var(--fg)}',
      '.pt-sub{font-size:.66rem;color:var(--fg-3);letter-spacing:.08em;text-transform:uppercase}',
      '.pt-nav{display:flex;gap:2px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:thin}',
      '.pt-nav a{padding:7px 11px;border-radius:7px;color:var(--fg-2);font-size:.83rem;white-space:nowrap;display:inline-flex;gap:6px;align-items:center}',
      '.pt-nav a:hover{background:var(--surface-3);text-decoration:none;color:var(--fg)}',
      '.pt-nav a.on{background:var(--accent-soft);color:var(--accent);font-weight:600}',
      '.pt-cnt{font-size:.66rem;background:var(--sun-soft);color:var(--sun);border-radius:10px;padding:0 6px;font-weight:700}',
      '.pt-user{display:flex;gap:9px;align-items:center;font-size:.8rem;flex:none}',
      '.pt-user b{display:block;line-height:1.15} .pt-user span{font-size:.7rem;color:var(--fg-3)}',
      '.pt-b{padding:20px;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;min-width:0}','.pt-b>*,.pt-b .stack>*{min-width:0}','@media (max-width:900px){.sticky-side{position:static}}',
      '.pt-f{padding:12px 20px;border-top:1px solid var(--line);font-size:.72rem;color:var(--fg-3);background:var(--surface)}',
      '@media (max-width:980px){.pt-nav{order:3;flex-basis:100%}}','.pt-h.wide-nav .pt-nav{order:3;flex-basis:100%;margin:0 -6px}','.pt-h.wide-nav .pt-user{margin-left:auto}',
      '@media (max-width:700px){.pt-b{padding:12px}.pt-h{padding:10px 12px;gap:10px}.pt-user .pt-uname{display:none}}',
      '.st-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}',
      '.st-card{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;min-width:0}',
      '.st-card.click{cursor:pointer} .st-card.click:hover{border-color:var(--accent)}',
      '.st-card .thumb{border-radius:0}',
      '.st-card-b{padding:12px 14px;display:flex;flex-direction:column;gap:7px;flex:1}',
      '.st-card-f{padding:10px 14px;border-top:1px solid var(--line-2);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
      '.st-price{font-family:var(--f-display);font-size:1.15rem;font-weight:650;font-variant-numeric:tabular-nums}',
      '.st-old{text-decoration:line-through;color:var(--fg-3);font-size:.8rem}',
      '.gal-main .thumb{aspect-ratio:16/8}',
      '.gal{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}',
      '.gal button{border:2px solid transparent;padding:0;border-radius:10px;background:none;cursor:pointer;min-width:0}',
      '.gal button.on{border-color:var(--accent)} .gal .thumb{aspect-ratio:16/10} .gal .thumb .tt{font-size:.7rem}',
      '.opt-row{display:flex;gap:8px;flex-wrap:wrap}',
      '.opt{border:1px solid var(--line);border-radius:8px;padding:7px 11px;cursor:pointer;background:var(--surface);font-size:.8rem;text-align:left;display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.opt:hover{border-color:var(--accent)} .opt.on{border-color:var(--accent);background:var(--accent-soft)}',
      '.opt[disabled]{opacity:.5;cursor:not-allowed} .opt small{font-size:.7rem;color:var(--fg-3)}',
      '.qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}',
      '.qty button{width:32px;height:32px;border:0;background:var(--surface-2);cursor:pointer;font-size:1rem;color:var(--fg)}',
      '.qty button:hover{background:var(--surface-3)} .qty b{min-width:34px;text-align:center;font-variant-numeric:tabular-nums}',
      '.sticky-side{position:sticky;top:74px}',
      '.sel-text{user-select:all;-webkit-user-select:all;font-family:var(--f-mono);font-size:1.3rem;font-weight:600;padding:8px 14px;border:1px dashed var(--line);border-radius:8px;background:var(--surface-2);display:inline-block;color:var(--fg);cursor:text}',
      '.day-h{display:flex;gap:10px;align-items:center;padding:10px 16px;background:var(--surface-2);border-bottom:1px solid var(--line-2);flex-wrap:wrap}',
      '.day-n{width:40px;height:40px;border-radius:9px;background:var(--surface);border:1px solid var(--line);display:grid;place-items:center;font-weight:700;line-height:1;text-align:center;font-size:.9rem;flex:none}',
      '.day-n small{display:block;font-size:.58rem;font-weight:600;color:var(--fg-3);text-transform:uppercase}',
      '.day.today .day-n{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)} .day.today .day-n small{color:var(--accent-fg)}',
      '.svc{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:12px;padding:11px 16px;border-bottom:1px solid var(--line-2);align-items:start}',
      '.svc:last-child{border-bottom:0} .svc .tm{font-family:var(--f-mono);font-size:.82rem;color:var(--fg-2);padding-top:1px}',
      '.svc.past .tm,.svc.past .sv-t{color:var(--fg-3)}',
      '@media (max-width:560px){.svc{grid-template-columns:48px minmax(0,1fr)}.svc>.badge,.svc>.sv-st{grid-column:2}}',
      '.cms-prev{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)}',
      '.cms-prev-h{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line-2);font-size:.8rem;gap:10px;flex-wrap:wrap}',
      '.cms-prev-b{padding:22px 26px;max-width:760px}',
      '.cms-prev-b h3{margin:14px 0 6px} .cms-prev-b p{margin:0 0 10px;color:var(--fg-2)} .cms-prev-b ul{margin:0 0 10px;padding-left:20px;color:var(--fg-2)}',
      '.serp{border:1px solid var(--line);border-radius:8px;padding:12px 14px;background:var(--surface-2)}',
      '.serp .u{font-size:.74rem;color:var(--ok)} .serp .h{color:var(--info);font-size:1rem;margin:2px 0} .serp .d{font-size:.8rem;color:var(--fg-2)}',
      '.faq details{border-bottom:1px solid var(--line-2);padding:9px 0} .faq summary{cursor:pointer;font-weight:550;font-size:.86rem} .faq p{margin-top:6px;font-size:.84rem;color:var(--fg-2)}',
      '.ck-list{margin:0;padding-left:0;list-style:none;display:grid;gap:5px;font-size:.84rem}',
      '.ck-list li{display:flex;gap:8px;align-items:flex-start} .ck-list svg{width:16px;height:16px;margin-top:2px;flex:none}',
      '.ck-list.yes svg{color:var(--ok)} .ck-list.no svg{color:var(--fg-3)}',
      '.testcard{display:flex;gap:8px;flex-wrap:wrap}',
      '.testcard button{font-family:var(--f-mono);font-size:.74rem}',
      '.login-card{max-width:440px;margin:24px auto;width:100%}',
      '.ext-body{min-width:0}.ext-body>*{min-width:0}',
      '.ext-h{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}',
      '.pxs-stars{color:var(--sun);letter-spacing:1px;font-size:.9rem;white-space:nowrap}.pxs-stars .off{color:var(--line)}',
      '.pxs-comp{border:1px solid var(--line-2);border-radius:9px;padding:10px 12px;background:var(--surface-2)}',
      '.pxs-msg{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:11px 16px;border-bottom:1px solid var(--line-2);cursor:pointer}',
      '.pxs-msg:last-child{border-bottom:0}.pxs-msg:hover{background:var(--surface-2)}.pxs-msg.unread .pxs-sub{font-weight:650;color:var(--fg)}',
      '.pxs-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;margin-right:6px;vertical-align:middle}',
      '.pxs-sub{font-size:.86rem;color:var(--fg-2);overflow-wrap:anywhere}',
      '@media (max-width:560px){.pxs-msg{grid-template-columns:auto minmax(0,1fr)}.pxs-msg>.badge{grid-column:2;justify-self:start}}',
      '.pxs-rate{display:flex;gap:4px;flex-wrap:wrap}.pxs-rate button{border:1px solid var(--line);background:var(--surface);border-radius:7px;min-width:38px;height:34px;cursor:pointer;color:var(--fg-2);font-size:.95rem}',
      '.pxs-rate button.on{border-color:var(--sun);background:var(--sun-soft);color:var(--sun)}',
      '.pxs-reply{border-left:3px solid var(--accent);background:var(--accent-soft);padding:8px 10px;border-radius:0 7px 7px 0;margin-top:8px;font-size:.84rem}',
      '.pxs-quote{border-left:3px solid var(--sun);background:var(--sun-soft);padding:9px 12px;border-radius:0 8px 8px 0;font-size:.88rem;overflow-wrap:anywhere}',
      '.pxs-sub-nav{display:flex;gap:6px;flex-wrap:wrap}'
    ].join('\n');
    document.head.appendChild(s);
  })();

  /* ---------------- Helpers de datos ---------------- */
  function nextId(list, prefix, width) {
    let max = 0;
    (list || []).forEach(x => { const id = typeof x === 'string' ? x : x && x.id; if (id && id.indexOf(prefix) === 0) { const n = parseInt(id.slice(prefix.length), 10); if (n > max) max = n; } });
    return prefix + String(max + 1).padStart(width, '0');
  }
  const rnd = (n) => String(Math.floor(Math.random() * Math.pow(10, n))).padStart(n, '0');
  const vig = (p) => (p.rates || []).filter(r => r.status === 'vigente' && r.validFrom <= T() && r.validTo >= T());
  const publicRate = (p) => { const v = vig(p); return v.find(r => r.channel === 'Directo' && ['Adulto', 'Pasajero'].includes(r.segment)) || v.find(r => r.channel === 'Directo') || v[0] || null; };
  const webRate = (p) => vig(p).find(r => r.channel === 'E-commerce' && ['Adulto', 'Pasajero'].includes(r.segment)) || publicRate(p);
  const childPrice = (p) => { const r = vig(p).find(r => r.segment === 'Niño' && r.channel === 'Directo'); return r ? r.price : null; };
  const b2bRate = (p) => vig(p).find(r => r.type === 'B2B');
  const durLabel = (p) => p.durationValue + ' ' + (p.durationValue === 1 ? p.durationUnit.replace(/s$/, '') : p.durationUnit);
  const moneyMulti = (rows, fn, curFn) => { const g = {}; rows.forEach(r => { const c = curFn(r); g[c] = (g[c] || 0) + fn(r); }); const k = Object.keys(g).filter(c => Math.abs(g[c]) > 0.004); return k.length ? k.map(c => money(g[c], c)).join(' + ') : money(0, 'PEN'); };
  const allServices = () => DB.reservations.flatMap(r => r.services || []);
  const activePromos = (p) => (p.promotions || []).filter(x => x.status === 'activa' && x.from <= T() && x.to >= T() && ['E-commerce', 'Todos'].includes(x.channel));
  const depFree = (d) => Math.max(0, d.capacity - d.sold);
  const HOTEL_ADDR = { 'PRV-001': 'Calle San Agustín 307, Centro Histórico, Cusco', 'PRV-002': 'Calle Tandapata 160, San Blas, Cusco', 'PRV-003': 'Av. Ferrocarril s/n, Urubamba', 'PRV-011': 'Isla flotante Kapi, Uros, Puno', 'PRV-013': 'Km 58 río Amazonas, Iquitos' };
  const EMERGENCY = '+51 984 110 247';

  function ensureTickets() { if (!DB.supportTickets) DB.supportTickets = []; return DB.supportTickets; }

  /* Crea una reserva real (misma estructura que el módulo de reservas) y consume cupos */
  function createRes(o) {
    const p = o.p;
    const id = Seq.next('Reserva');
    const to = p.durationUnit === 'días' ? addDays(o.date, Math.max(0, p.durationValue - 1)) : o.date;
    const svcId = nextId(allServices(), 'RS-', 4);
    const confirmed = o.status === 'confirmada';
    const r = {
      id, quoteId: null, quoteVersion: null, clientId: o.clientId, title: o.title, status: o.status, channel: o.channel,
      travelFrom: o.date, travelTo: to, currency: o.cur, total: Math.round(o.total * 100) / 100, owner: o.owner, createdAt: nowStr(), sede: o.sede || 'SED-01', notes: o.notes || '',
      passengers: o.passengers,
      services: [{ id: svcId, productId: p.id, name: p.name + (o.dep ? ' (salida ' + o.dep.id + ')' : ''), date: o.date, time: o.dep ? o.dep.time : '—', providerId: p.mainProviderId, status: confirmed ? 'confirmado' : 'solicitado', cost: Math.round(o.cost * 100) / 100, price: Math.round(o.total * 100) / 100, confirmationCode: confirmed ? 'AH-' + id.slice(-6) : '' }]
    };
    if (o.extra) Object.assign(r, o.extra);
    DB.reservations.unshift(r);
    if (o.dep) { o.dep.sold += o.pax; if (o.dep.sold >= o.dep.capacity) o.dep.status = 'completa'; }
    return r;
  }
  function releaseDep(r) {
    const s = r.services && r.services[0]; if (!s) return;
    const p = Q.product(s.productId); const m = /salida (SAL-\d+)/.exec(s.name || ''); if (!p || !m) return;
    const d = (p.departures || []).find(x => x.id === m[1]); if (!d) return;
    d.sold = Math.max(0, d.sold - r.passengers.length); if (d.status === 'completa' && d.sold < d.capacity) d.status = 'abierta';
  }
  function addReceivable(o) { const x = Object.assign({ id: nextId(DB.receivables, 'CXC-', 5), paid: 0, status: 'abierta' }, o); DB.receivables.unshift(x); return x; }
  function addPayment(o) { const x = Object.assign({ id: nextId(DB.payments, 'PAG-', 5), date: T(), by: Auth.user ? Auth.user.id : 'Sistema' }, o); DB.payments.unshift(x); return x; }
  function issueVoucher(r) {
    const s = r.services[0];
    const v = { id: Seq.next('Voucher'), resId: r.id, serviceId: s.id, service: s.name.replace(/ \(salida .*\)$/, ''), providerId: s.providerId, date: s.date, pax: r.passengers.length, status: 'emitido', version: 1, issuedAt: nowStr(), issuedBy: Auth.user ? Auth.user.id : 'Sistema' };
    DB.vouchers.unshift(v); return v;
  }
  const cardResult = (num) => { const d = String(num || '').replace(/\D/g, ''); if (d === '4111111111111111' || d === '5555555555554444') return 'ok'; if (d === '4000000000000002') return 'rechazo'; return 'invalida'; };

  /* =====================================================================================
     v2.1 — Experiencia del pasajero: mensajes, comentarios (R-PAX-FEEDBACK) y acompañantes
     Helpers compartidos (window.PaxExp) que también usan Ventas (Reserva 360) y la app pasajero.
     Dueño de DB.paxFeedback: este módulo. DB.paxMessages lo siembra experiencia.js; aquí solo se lee
     y se agregan respuestas/lecturas. Cada funcionalidad consulta BookingEngine.on(regla, producto).
     ===================================================================================== */
  const BEX = () => window.BookingEngine;
  if (!DB.paxFeedback) { DB.paxFeedback = []; Store.save(); }
  if (!DB.corpAccounts) { DB.corpAccounts = JSON.parse(JSON.stringify(window.SEED.corpAccounts || [])); Store.save(); }
  const FB_TYPES = [['comentario', 'Comentario'], ['sugerencia', 'Sugerencia'], ['felicitacion', 'Felicitación'], ['reclamo', 'Reclamo'], ['incidencia', 'Incidencia']];
  const FB_TONE = { comentario: 'borrador', sugerencia: 'abierta', felicitacion: 'ok', reclamo: 'rechazado', incidencia: 'alta' };
  const FB_ST = { nuevo: ['pendiente', 'Nuevo'], leido: ['abierta', 'Leído por la agencia'], respondido: ['ok', 'Respondido'], derivado: ['en_proceso', 'Derivado a operaciones'] };
  const MSG_ST = { programado: ['asignada', 'Programado'], enviado: ['enviado', 'Enviado'], entregado: ['aplicado', 'Entregado'], leido: ['completado', 'Leído'], fallido: ['fallido', 'Fallido'], cancelado: ['cancelado', 'Cancelado'] };
  const CH_LBL = { email: 'Correo', whatsapp: 'WhatsApp', portal: 'Portal', push: 'Notificación push', sms: 'SMS' };
  const REL = ['Titular', 'Cónyuge / pareja', 'Hijo/a', 'Padre / madre', 'Hermano/a', 'Amigo/a', 'Otro'];
  const PX = {
    FB_TYPES, REL, CH_LBL,
    typeLabel: (t) => (FB_TYPES.find(x => x[0] === t) || [t, t])[1],
    typeBadge: (t) => UI.badge(FB_TONE[t] || 'borrador', PX.typeLabel(t)),
    fbBadge: (s) => UI.badge((FB_ST[s] || [s])[0], (FB_ST[s] || [s, s])[1]),
    msgBadge: (s) => UI.badge((MSG_ST[s] || [s])[0], (MSG_ST[s] || [s, s])[1]),
    stars: (n) => n ? '<span class="pxs-stars" title="' + n + ' de 5">' + '★★★★★'.slice(0, n) + '<span class="off">' + '★★★★★'.slice(n) + '</span></span>' : '',
    /* Producto que gobierna las reglas de la reserva: el de la reserva web o el primer servicio */
    product(r) { if (!r) return null; if (r.booking && r.booking.productId) return Q.product(r.booking.productId) || null; const s = (r.services || []).find(x => x.productId); return s ? Q.product(s.productId) : null; },
    on(id, r) { const be = BEX(); return !be || be.on(id, PX.product(r)); },
    param(id, key, r) { const be = BEX(); return be ? be.param(id, key, PX.product(r)) : null; },
    /* Mensajes recibidos por el pasajero (solo los ya enviados; los programados/cancelados no le llegan aún) */
    messagesFor(resId) { return (DB.paxMessages || []).filter(m => m.resId === resId && (m.direction || 'saliente') === 'saliente' && ['enviado', 'entregado', 'leido', 'fallido'].includes(m.status)).sort((a, c) => String(c.sentAt || c.scheduledAt || '').localeCompare(String(a.sentAt || a.scheduledAt || ''))); },
    unread(resId) { return PX.messagesFor(resId).filter(m => m.status !== 'leido' && m.status !== 'fallido').length; },
    markRead(m, who) { if (!m || m.status === 'leido' || m.status === 'fallido') return false; const bf = m.status; m.status = 'leido'; m.readAt = nowStr(); Audit.log('Mensaje al pasajero', m.id, 'leido', bf, 'leido · ' + (who || '')); return true; },
    feedbackFor(resId) { return (DB.paxFeedback || []).filter(f => f.resId === resId).sort((a, c) => String(c.createdAt).localeCompare(String(a.createdAt))); },
    coordinatorOf(r) { const op = (DB.operations || []).find(o => o.resId === r.id); return (op && op.coordinator) || 'U05'; },
    /* Alta de comentario del pasajero (R-PAX-FEEDBACK). Reclamo/incidencia => conversación en el inbox */
    submitFeedback(r, d, who, via) {
      if (!PX.on('R-PAX-FEEDBACK', r)) return { error: 'La regla R-PAX-FEEDBACK está desactivada para esta agencia.' };
      const text = String(d.text || '').trim(); if (text.length < 5) return { error: 'Escriba su comentario (mínimo 5 caracteres).' };
      if (!FB_TYPES.some(t => t[0] === d.type)) return { error: 'Tipo de comentario no válido.' };
      const rating = d.rating ? Math.max(1, Math.min(5, parseInt(d.rating, 10))) : null;
      const ts = nowStr();
      const fb = { id: nextId(DB.paxFeedback, 'FB-', 5), resId: r.id, passenger: who.name, type: d.type, rating, serviceId: d.serviceId || null, text: text.slice(0, 1000), createdAt: ts, status: 'nuevo', reply: null, repliedAt: null, repliedBy: null, channel: via || 'Portal pasajero', contact: { email: who.email || '', phone: who.phone || '' } };
      DB.paxFeedback.unshift(fb);
      const coord = PX.coordinatorOf(r); const tl = PX.typeLabel(d.type);
      Notify.push('pasajero.comentario', 'Portal', coord, tl + ' de ' + who.name + ' (' + r.id + '): ' + text.slice(0, 60));
      if (r.owner && r.owner !== coord) Notify.push('pasajero.comentario', 'Portal', r.owner, tl + ' de ' + who.name + ' en ' + r.id);
      if (['reclamo', 'incidencia'].includes(d.type)) {
        if (!DB.conversations) DB.conversations = [];
        const svc = fb.serviceId ? (r.services || []).find(s => s.id === fb.serviceId) : null;
        const conv = { id: nextId(DB.conversations, 'CNV-', 4), channel: 'Portal', contact: { name: who.name, email: who.email || '', phone: who.phone || '' }, subject: tl + ' del pasajero — ' + r.id + (svc ? ' · ' + svc.name : ''), status: 'abierta', assignee: d.type === 'incidencia' ? coord : (r.owner || coord), messages: [{ from: 'contact', text: text + (rating ? ' (calificación ' + rating + '/5)' : ''), ts, type: 'msg' }], createdAt: ts, clientId: r.clientId, leadId: null, resId: r.id, quoteId: null, priority: d.type === 'incidencia' ? 'alta' : 'media', tags: ['Pasajero', tl, 'Portal pasajero'], slaDueAt: addMinutes(ts, 240), firstResponseAt: null, ticketId: null, unread: 1, source: via || 'Portal pasajero', feedbackId: fb.id };
        DB.conversations.unshift(conv); fb.conversationId = conv.id;
        Audit.log('Conversación', conv.id, 'crear', 'Comentario ' + fb.id, 'abierta · ' + tl);
      }
      Audit.log('Comentario pasajero', fb.id, 'crear', '', tl + (rating ? ' · ' + rating + '/5' : '') + ' · ' + r.id);
      Store.save();
      return { fb };
    },
    /* Etiquetas operativas detectadas en comentarios y dietas (dietas/alergias, celebraciones, accesibilidad, infantes) */
    specialTags(text) {
      const t = String(text || ''); const out = [];
      if (/alerg|frutos secos|man[ií]|gluten|cel[ií]ac|vegetar|vegan|lactosa|dieta|kosher|halal/i.test(t)) out.push(['bad', 'Dieta / alergia']);
      if (/aniversario|cumplea|luna de miel|boda|celebra|pedida de mano/i.test(t)) out.push(['violet', 'Celebración']);
      if (/silla de ruedas|movilidad|accesib|bast[oó]n/i.test(t)) out.push(['warn', 'Accesibilidad']);
      if (/beb[eé]|cuna|silla de (auto|beb)|coche/i.test(t)) out.push(['info', 'Infante / cuna']);
      return out;
    },
    /* Acompañantes: ¿puede el pasajero/cliente completarlos? R-COMPANIONS + plazo (daysBeforeIfLater) */
    companions(r, requireMode) {
      if (!r || !PX.on('R-COMPANIONS', r)) return { show: false };
      const mode = PX.param('R-COMPANIONS', 'when', r) || 'al_reservar';
      if (requireMode && mode !== requireMode) return { show: false, mode };
      const days = +(PX.param('R-COMPANIONS', 'daysBeforeIfLater', r) || 0);
      const deadline = r.travelFrom ? addDays(r.travelFrom, -days) : null;
      const closed = ['cancelada', 'completada'].includes(r.status) || (deadline && T() > deadline);
      return { show: true, mode, deadline, editable: !closed, requireDoc: PX.param('R-COMPANIONS', 'requireDocument', r) !== false };
    },
    /* Normaliza el snapshot booking: moneda de los importes, moneda mostrada, TC y totales de alojamiento */
    bk(r) {
      const b = r && r.booking; if (!b) return null; const be = BEX();
      const cur = (b.total != null && Math.abs(b.total - r.total) <= Math.max(1, r.total * 0.01)) ? r.currency : (b.chargeCurrency || r.currency);
      const disp = b.currencyDisplay || cur;
      const rate = b.fxRate || (be ? be.convert(1, cur, disp) : 1);
      const lod = b.lodging || []; const legs = {}; lod.forEach(l => { legs[l.legId || l.city] = l.nights || 0; });
      return { b, cur, disp, rate, lodging: lod, rooms: b.rooms != null ? b.rooms : lod.reduce((a, l) => a + (+l.rooms || 0), 0), nights: b.nights != null ? b.nights : Object.values(legs).reduce((a, n) => a + n, 0), fmt: (n, c) => be ? be.fmt(n, c || cur) : money(n, c || cur), inDisp: (n) => be ? be.convert(n, cur, disp) : n };
    },
    missing(p, requireDoc) { return !!(p.placeholder || !p.name || /por completar/i.test(p.name) || (requireDoc && !p.doc) || !p.birth); }
  };
  function addMinutes(ts, m) { const d = Util.parseD(ts); d.setMinutes(d.getMinutes() + m); const pd2 = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + pd2(d.getMonth() + 1) + '-' + pd2(d.getDate()) + ' ' + pd2(d.getHours()) + ':' + pd2(d.getMinutes()); }
  const ageAt = (birth, ref) => { if (!birth) return null; const b = Util.parseD(birth), d = Util.parseD(ref || T()); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
  PX.ageAt = ageAt;
  window.PaxExp = PX;

  /* Formulario de acompañantes (+ punto de recojo si R-PICKUP) — portal del pasajero y del cliente */
  function companionsModal(r, who, via) {
    const cmp = PX.companions(r); const p = PX.product(r); const be = BEX();
    if (!cmp.show) return;
    if (!cmp.editable) { UI.toast('El plazo para completar datos venció el ' + date(cmp.deadline) + ' (R-COMPANIONS). Escriba a su agencia.', 'warn'); return; }
    const pickOn = PX.on('R-PICKUP', r) && p && p.pickup; const bk = r.booking || {}; const pk = bk.pickup || {};
    const askFlight = pickOn && p.pickup.askFlight !== false && PX.param('R-PICKUP', 'askFlight', r) !== false;
    const docs = ['DNI', 'Pasaporte', 'CE'];
    const rows = r.passengers.map((x, i) => { const [dt, dn] = String(x.doc || '').includes(' ') ? [x.doc.split(' ')[0], x.doc.split(' ').slice(1).join(' ')] : ['DNI', x.doc || '']; const lead = x.isLead || x.relationship === 'Titular';
      return '<div class="pxs-comp"><div class="row between" style="margin-bottom:6px"><b class="small">' + (i + 1) + '. ' + (lead ? 'Titular' : 'Acompañante') + ' · ' + esc(x.type || 'ADT') + '</b>' + (PX.missing(x, cmp.requireDoc) ? UI.badge('pendiente', 'Por completar') : '') + '</div><div class="form-grid">' +
        UI.field({ id: 'cp_n' + i, label: 'Nombres y apellidos', required: true, value: /por completar/i.test(x.name) ? '' : x.name, col: 6, disabled: lead }) +
        UI.field({ id: 'cp_r' + i, label: 'Parentesco', type: 'select', options: lead ? ['Titular'] : REL.filter(z => z !== 'Titular'), value: x.relationship || (lead ? 'Titular' : 'Otro'), col: 6, disabled: lead }) +
        UI.field({ id: 'cp_dt' + i, label: 'Documento', type: 'select', options: docs, value: dt === 'Passport' ? 'Pasaporte' : dt, col: 4 }) +
        UI.field({ id: 'cp_dn' + i, label: 'Número', required: cmp.requireDoc, value: dn, col: 4 }) +
        UI.field({ id: 'cp_b' + i, label: 'Fecha de nacimiento', type: 'date', required: true, value: x.birth || '', col: 4 }) +
        UI.field({ id: 'cp_na' + i, label: 'Nacionalidad', value: x.nationality || '', col: 6 }) +
        UI.field({ id: 'cp_d' + i, label: 'Dieta / requerimiento', value: x.diet || '', col: 6, placeholder: 'Opcional' }) + '</div></div>'; }).join('');
    const pickHtml = pickOn ? '<div class="section-title" style="margin-top:6px">Punto de recojo' + (askFlight ? ' y vuelo de llegada' : '') + '</div><div class="form-grid">' +
      UI.field({ id: 'cp_pp', label: 'Punto de recojo', type: 'select', required: !!p.pickup.required, placeholder: 'Seleccione…', options: (p.pickup.points || []).concat(pk.point && !(p.pickup.points || []).includes(pk.point) ? [pk.point] : []), value: pk.point || '', col: 12 }) +
      UI.field({ id: 'cp_pa', label: 'Dirección o referencia (hotel)', value: pk.address || '', col: 12 }) +
      (askFlight ? UI.field({ id: 'cp_pf', label: 'Vuelo de llegada', value: pk.flight || '', placeholder: 'Ej.: LA2047', col: 6 }) + UI.field({ id: 'cp_ph', label: 'Llegada (fecha y hora)', type: 'datetime-local', value: pk.arrival ? String(pk.arrival).replace(' ', 'T') : '', col: 6 }) : '') + '</div>' : '';
    UI.modal({ title: 'Datos de acompañantes', size: 'lg', sub: esc(r.id) + ' · plazo hasta el ' + date(cmp.deadline) + ' (R-COMPANIONS)', body: UI.alert('info', 'Los datos deben coincidir con el documento de viaje: las entradas y trenes son nominativos. Los menores se clasifican por su edad a la fecha del viaje según las reglas del producto.') + '<div style="margin-top:12px" class="stack">' + rows + '</div>' + pickHtml,
      actions: [{ label: 'Cancelar' }, { label: 'Guardar datos', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const changes = [];
        for (let i = 0; i < r.passengers.length; i++) {
          const x = r.passengers[i]; const lead = x.isLead || x.relationship === 'Titular';
          const age = ageAt(f['cp_b' + i], r.travelFrom); if (age == null || age < 0 || age > 110) { UI.toast('Fecha de nacimiento no válida para el pasajero ' + (i + 1) + '.', 'bad'); return false; }
          const t = be && p ? be.ageType(p, age) : x.type;
          if (x.type && t && t !== 'NA' && t !== x.type) { UI.toast('Pasajero ' + (i + 1) + ': por su edad (' + age + ' años) corresponde ' + t + ' y la reserva lo tiene como ' + x.type + '. Cambiar el tipo modifica el precio; escriba a su agencia.', 'bad'); return false; }
          const np = Object.assign({}, x, { name: lead ? x.name : f['cp_n' + i], relationship: lead ? 'Titular' : f['cp_r' + i], doc: f['cp_dn' + i] ? f['cp_dt' + i] + ' ' + f['cp_dn' + i] : '', birth: f['cp_b' + i], age, nationality: f['cp_na' + i], diet: f['cp_d' + i] });
          delete np.placeholder;
          if (JSON.stringify(np) !== JSON.stringify(x)) { changes.push(np.name); r.passengers[i] = np; }
        }
        if (pickOn) { const np = { point: f.cp_pp || '', address: f.cp_pa || '', flight: askFlight ? f.cp_pf || '' : (pk.flight || ''), arrival: askFlight && f.cp_ph ? f.cp_ph.replace('T', ' ') : (pk.arrival || '') }; if (JSON.stringify(np) !== JSON.stringify(Object.assign({ point: '', address: '', flight: '', arrival: '' }, pk))) { r.booking = r.booking || {}; r.booking.pickup = np; changes.push('recojo'); } }
        if (!changes.length) { UI.toast('Sin cambios.', 'info'); return; }
        Store.save(); Audit.log('Reserva', r.id, 'acompanantes_' + (via === 'Portal cliente' ? 'portal_cliente' : 'portal_pasajero'), '', changes.join(', '));
        Notify.push('reserva.acompanantes', 'Portal', PX.coordinatorOf(r), who.name + ' actualizó datos de acompañantes/recojo en ' + r.id);
        if (r.owner) Notify.push('reserva.acompanantes', 'Portal', r.owner, 'Datos de viajeros actualizados en ' + r.id + ' (' + via + ')');
        UI.toast('Datos guardados. Operaciones fue notificada.'); App.render();
      } }] });
  }

  /* ---------------- Piezas de interfaz comunes ---------------- */
  function chBar(kind, who, right) {
    return '<div class="chv-bar">' + ic('eye') + '<div class="grow"><b>Vista del canal · ' + esc(kind) + '</b> <span class="chv-d">— ' + esc(String(who).replace(/\.$/, '')) + '. Los datos y acciones son los mismos de los módulos internos.</span></div>' + (right || '') + '</div>';
  }
  function linkTabs(items, active) {
    return '<div class="tabs chv-tabs" role="tablist">' + items.map(t => '<a class="tab' + (t[0] === active ? ' on' : '') + '" href="' + t[2] + '">' + esc(t[1]) + (t[3] != null ? '<span class="cnt">' + t[3] + '</span>' : '') + '</a>').join('') + '</div>';
  }
  function shell({ sub, nav = [], active, user = '', body }) {
    return '<div class="pt"><header class="pt-h' + (nav.length > 5 ? ' wide-nav' : '') + '"><div class="pt-logo"><div class="pt-mark">' + ic('logo') + '</div><div><div class="pt-name">Andes Horizonte Travel</div><div class="pt-sub">' + esc(sub) + '</div></div></div>' +
      '<nav class="pt-nav" aria-label="' + esc(sub) + '">' + nav.map(n => '<a href="' + n.href + '" class="' + (n.id === active ? 'on' : '') + '">' + esc(n.label) + (n.count ? '<span class="pt-cnt">' + n.count + '</span>' : '') + '</a>').join('') + '</nav>' +
      (user ? '<div class="pt-user">' + user + '</div>' : '') + '</header><div class="pt-b">' + body + '</div>' +
      '<footer class="pt-f">Andes Horizonte Travel S.A.C. · RUC ' + esc(DB.tenant.ruc) + ' · Av. José Larco 1150, Of. 602, Miraflores, Lima · Central 01 640 2210 · Emergencias 24/7 ' + EMERGENCY + ' · Agencia inscrita en el Directorio Nacional de Prestadores de Servicios Turísticos</footer></div>';
  }
  /* Usuario externo: sin barra "Vista del canal" ni cabecera/nav duplicada (el shell externo ya trae la navegación).
     Usuario interno: previsualización con barra del canal + marco del portal. */
  const EXT = () => Auth.isExternal;
  function frame(bar, opts) { return EXT() ? '<div class="stack ext-body">' + opts.body + '</div>' : '<div class="stack">' + bar + shell(opts) + '</div>'; }
  const cant = (perm) => ' disabled title="Requiere permiso ' + perm + '"';
  const userChip = (name, sub, color) => UI.avatar({ name, color: color || 'var(--accent)' }) + '<div class="pt-uname"><b>' + esc(name) + '</b><span>' + esc(sub) + '</span></div>';

  function showDoc(title, html, sub) {
    UI.modal({ title, sub: sub || '', size: 'lg', body: UI.alert('info', 'Vista previa del documento. En producción el PDF se genera mediante un job asíncrono y queda disponible para descarga desde el portal.') + '<div style="margin-top:14px">' + html + '</div>', actions: [{ label: 'Cerrar', cls: 'primary' }] });
  }
  function pseudoQR(seed) {
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    let cells = ''; const n = 21;
    const finder = (x, y) => { const f = (a, b) => a >= 0 && a < 7 && b >= 0 && b < 7; const inF = (fx, fy) => f(x - fx, y - fy) ? ((x - fx === 0 || x - fx === 6 || y - fy === 0 || y - fy === 6) || (x - fx >= 2 && x - fx <= 4 && y - fy >= 2 && y - fy <= 4) ? 1 : 0) : -1; const a = inF(0, 0), b = inF(14, 0), c = inF(0, 14); return a >= 0 ? a : b >= 0 ? b : c; };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const f = finder(x, y); let on; if (f >= 0) on = f; else { h = (h * 1103515245 + 12345) >>> 0; on = (h >>> 16) & 1; } if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; }
    return '<svg viewBox="-1 -1 23 23" width="96" height="96" style="fill:currentColor;display:block">' + cells + '</svg>';
  }
  const docHead = (kind, id, extra) => '<div class="doc-head"><div><h2>Andes Horizonte Travel S.A.C.</h2><div class="muted">RUC ' + esc(DB.tenant.ruc) + ' · Av. José Larco 1150, Of. 602, Miraflores, Lima<br>Operaciones Cusco: Calle Plateros 348 · 084 23 1190 · Emergencias 24/7 ' + EMERGENCY + '</div></div><div style="text-align:right"><h3>' + esc(kind) + '</h3><div style="font-family:var(--f-mono);font-size:.9rem;margin-top:4px">' + esc(id) + '</div>' + (extra || '') + '</div></div>';
  function voucherDoc(v) {
    const r = Q.reservation(v.resId) || { passengers: [], services: [] };
    const s = (r.services || []).find(x => x.id === v.serviceId) || {};
    const p = Q.product(s.productId);
    const dep = p && (p.departures || []).find(d => (s.name || '').includes(d.id));
    const op = DB.operations.find(o => o.resId === r.id); const as = op && op.assignments.find(a => a.serviceId === v.serviceId);
    return '<div class="doc">' + docHead('VOUCHER DE SERVICIO', v.id, '<div class="muted" style="margin-top:4px">Versión ' + v.version + ' · Emitido ' + datetime(v.issuedAt) + '</div>') +
      '<div style="display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap"><div style="flex:1;min-width:240px"><table><tbody>' +
      [['Servicio', esc(v.service)], ['Fecha y hora', date(v.date) + (s.time && s.time !== '—' ? ' · ' + esc(s.time) : '')], ['Proveedor', esc(Q.providerName(v.providerId))], ['Código de confirmación', esc(s.confirmationCode || 'Por confirmar')], ['Reserva', esc(r.id || v.resId)], ['Titular', esc(Q.clientName(r.clientId))], ['Pasajeros', v.pax + ' pax'], ['Punto de encuentro', esc(dep ? dep.meeting : (p && p.itinerary && p.itinerary[0] && p.itinerary[0].items[0] ? p.itinerary[0].items[0].location : 'Según coordinación con operaciones'))]].concat(as && as.guideId ? [['Guía', esc(Q.guide(as.guideId).name)]] : []).map(x => '<tr><td class="muted" style="width:38%">' + x[0] + '</td><td><b>' + x[1] + '</b></td></tr>').join('') + '</tbody></table></div>' +
      '<div style="text-align:center;padding-top:10px">' + pseudoQR(v.id) + '<div class="muted" style="font-size:.72rem;margin-top:4px">Validación en destino</div></div></div>' +
      '<h3 style="margin-top:12px">Pasajeros</h3><table><thead><tr><th>Nombre</th><th>Documento</th><th>Tipo</th></tr></thead><tbody>' + (r.passengers || []).map(x => '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.doc) + '</td><td>' + esc(x.type) + '</td></tr>').join('') + '</tbody></table>' +
      '<p class="muted" style="margin-top:10px;font-size:.76rem">Presente este voucher impreso o en su teléfono. Documento válido solo para el servicio, fecha y pasajeros indicados (Regla transversal 11: voucher solo con servicio autorizado). Cambios y cancelaciones según la política del producto.</p></div>';
  }
  function invoiceDoc(inv) {
    const c = Q.client(inv.clientId) || {};
    const base = inv.detail && /Exportaci/.test(inv.detail) ? inv.amount : inv.amount / 1.18; const igv = inv.amount - base;
    return '<div class="doc">' + docHead(inv.type.toUpperCase() + ' ELECTRÓNICA', inv.id, '<div class="muted" style="margin-top:4px">Emisión ' + date(inv.date) + '</div>') +
      '<table><tbody><tr><td class="muted" style="width:30%">Cliente</td><td><b>' + esc(c.name || '—') + '</b></td></tr><tr><td class="muted">Documento</td><td>' + esc(c.doc || '—') + '</td></tr><tr><td class="muted">Reserva</td><td>' + esc(inv.resId) + '</td></tr><tr><td class="muted">Moneda</td><td>' + esc(inv.currency) + '</td></tr></tbody></table>' +
      '<table><thead><tr><th>Descripción</th><th style="text-align:right">Importe</th></tr></thead><tbody><tr><td>' + esc(inv.detail) + '</td><td style="text-align:right">' + money(base, inv.currency) + '</td></tr></tbody></table>' +
      '<table class="tot"><tbody><tr><td>Op. gravada / exportación</td><td style="text-align:right">' + money(base, inv.currency) + '</td></tr><tr><td>IGV</td><td style="text-align:right">' + money(igv, inv.currency) + '</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>' + money(inv.amount, inv.currency) + '</b></td></tr></tbody></table>' +
      '<p class="muted" style="font-size:.74rem">Representación impresa del comprobante electrónico. Estado ante OSE/SUNAT: ' + esc(UI.statusLabel(inv.status)) + '.</p></div>';
  }
  function quoteDoc(q) {
    const v = q.versions.find(x => x.v === q.currentVersion); const t = Pricing.quoteTotals(v); const c = Q.client(q.clientId) || {};
    return '<div class="doc">' + docHead('PROPUESTA DE VIAJE', q.id + ' · v' + v.v, '<div class="muted" style="margin-top:4px">Válida hasta ' + date(q.validUntil) + '</div>') +
      '<p><b>' + esc(q.title) + '</b><br><span class="muted">Cliente: ' + esc(c.name) + ' · Viaje del ' + date(q.travelFrom) + ' al ' + date(q.travelTo) + ' · ' + (q.pax.adt + q.pax.chd + q.pax.inf) + ' pasajeros</span></p>' +
      '<table><thead><tr><th>Servicio</th><th>Fecha</th><th style="text-align:right">Pax</th><th style="text-align:right">P. unit.</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>' + t.lines.map(l => '<tr><td>' + esc(Q.productName(l.productId)) + ' <span class="muted">(' + esc(l.segment) + ')</span></td><td>' + date(l.date) + '</td><td style="text-align:right">' + (l.qty * l.pax) + '</td><td style="text-align:right">' + money(l.unitPrice, q.currency) + '</td><td style="text-align:right">' + money(l.saleTotal, q.currency) + '</td></tr>').join('') + '</tbody></table>' +
      '<table class="tot"><tbody><tr><td>Subtotal</td><td style="text-align:right">' + money(t.sale, q.currency) + '</td></tr>' + (t.discount ? '<tr><td>Descuento ' + v.discountPct + '%</td><td style="text-align:right">− ' + money(t.discount, q.currency) + '</td></tr>' : '') + '<tr><td>IGV ' + v.taxPct + '%</td><td style="text-align:right">' + money(t.tax, q.currency) + '</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>' + money(t.total, q.currency) + '</b></td></tr></tbody></table>' +
      (v.notes ? '<p class="muted">' + esc(v.notes) + '</p>' : '') + '<p class="muted" style="font-size:.74rem;margin-top:8px">Precios sujetos a disponibilidad al momento de la confirmación. Snapshot de productos: ' + esc(v.snapshot) + '.</p></div>';
  }
  function tripDoc(r) {
    return '<div class="doc">' + docHead('ITINERARIO DEL VIAJE', r.id) + '<p><b>' + esc(r.title) + '</b><br><span class="muted">' + date(r.travelFrom) + ' — ' + date(r.travelTo) + ' · ' + r.passengers.map(p => esc(p.name)).join(', ') + '</span></p><table><thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Proveedor</th><th>Confirmación</th></tr></thead><tbody>' + r.services.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(s => '<tr><td>' + dateShort(s.date) + '</td><td>' + esc(s.time) + '</td><td>' + esc(s.name) + '</td><td>' + esc(s.providerId ? Q.providerName(s.providerId) : '—') + '</td><td>' + esc(s.confirmationCode || '—') + '</td></tr>').join('') + '</tbody></table></div>';
  }
  function insuranceDoc(r) {
    return '<div class="doc">' + docHead('CERTIFICADO DE ASISTENCIA EN VIAJE', 'SVA-' + r.id.slice(-6)) + '<table><tbody><tr><td class="muted" style="width:32%">Aseguradora</td><td><b>Seguros Viajero Andino</b> · Central 24 h 01 611 2020</td></tr><tr><td class="muted">Vigencia</td><td>' + date(r.travelFrom) + ' al ' + date(r.travelTo) + '</td></tr><tr><td class="muted">Asegurados</td><td>' + r.passengers.map(p => esc(p.name) + ' (' + esc(p.doc) + ')').join('<br>') + '</td></tr><tr><td class="muted">Coberturas</td><td>Asistencia médica por accidente o enfermedad hasta US$ 30 000 · Evacuación · Pérdida de equipaje US$ 1 200</td></tr></tbody></table></div>';
  }

  /* =====================================================================================
     B2B — PROC-053
     ===================================================================================== */
  const agEmail = (a) => a.email || (a.id === 'AGB-01' ? 'reservas@wayraviajes.pe' : 'reservas@' + a.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.pe');
  const agStatus = (a) => (a.validTo && a.validTo < T()) ? 'vencido' : (a.creditLimit > 0 && a.creditUsed > a.creditLimit) ? 'bloqueada' : a.status;
  const agAvail = (a) => Math.max(0, (a.creditLimit || 0) - (a.creditUsed || 0));
  function b2bTerms(p, a) {
    const entry = (p.b2b || []).find(b => b.agencyId === a.id);
    const pub = publicRate(p); const br = b2bRate(p);
    if (!entry) return { ok: false, reason: 'Sin tarifa B2B asignada a su lista de precios (Regla 14: B2B por agencia/producto/vigencia).' };
    if (entry.validTo && entry.validTo < T()) return { ok: false, reason: 'Tarifa B2B vencida el ' + date(entry.validTo) + ' (Regla 14).' };
    const cur = (br || pub || { currency: 'PEN' }).currency;
    return { ok: true, price: entry.price, cur, commissionPct: entry.commissionPct, list: entry.priceList, credit: !!entry.credit, pub: pub ? pub.price : null, cost: br ? br.cost : pub ? pub.cost : entry.price * 0.8 };
  }
  let b2bSess = null; try { b2bSess = localStorage.getItem('kipucontrol_b2b_sess'); } catch (e) { }
  const setB2bSess = (v) => { b2bSess = v; try { v ? localStorage.setItem('kipucontrol_b2b_sess', v) : localStorage.removeItem('kipucontrol_b2b_sess'); } catch (e) { } };

  App.register('canales/b2b', (el, params) => {
    const isAgency = Auth.role === 'b2b';
    const canManage = Auth.can('channels.b2b.manage');
    let view = isAgency ? 'portal' : (params[0] || (canManage ? 'admin' : 'portal'));
    if (!canManage && view !== 'portal') view = 'portal';
    if (isAgency && params[0] !== 'portal') params = ['portal'].concat(params);
    let html = '<div class="page chv-page">';
    if (!isAgency) {
      html += UI.pageHeader({ title: 'Canal B2B — agencias asociadas', subtitle: 'PROC-053: Agencia → Login → Catálogo autorizado → Tarifas B2B → Disponibilidad → Reserva → Confirmación → Pago/Crédito → Operación → Voucher → Liquidación.', crumbs: [['Inicio', '#/dashboard'], ['Canales'], ['B2B agencias']] }) +
        linkTabs([['admin', 'Administración B2B', '#/canales/b2b/admin', DB.b2bAgencies.length], ['precios', 'Listas de precios', '#/canales/b2b/precios'], ['portal', 'Portal de agencia', '#/canales/b2b/portal']].filter(t => canManage || t[0] === 'portal'), view);
      if (!canManage) html += UI.alert('warn', 'Su rol no tiene el permiso <span class="mono">channels.b2b.manage</span>: solo puede ver la experiencia del portal de agencia.');
    }
    html += '<div id="b2b-v"></div></div>';
    el.innerHTML = html;
    const v = el.querySelector('#b2b-v');
    if (view === 'admin') b2bAdmin(v, canManage);
    else if (view === 'precios') b2bPrices(v, canManage);
    else b2bPortal(v, params[1] || 'catalogo', isAgency);
  });

  function b2bAdmin(v, canManage) {
    const ags = DB.b2bAgencies;
    const b2bRes = DB.reservations.filter(r => r.channel === 'B2B' && r.status !== 'cancelada');
    const coms = DB.commissions.filter(c => c.kind === 'Agencia B2B' && c.status !== 'pagada');
    const limit = sum(ags, 'creditLimit'), used = sum(ags, 'creditUsed');
    const blocked = ags.filter(a => agStatus(a) !== 'activa');
    v.innerHTML = '<div class="stack"><div class="grid g5">' +
      UI.kpi({ label: 'Agencias activas', value: ags.filter(a => agStatus(a) === 'activa').length + ' / ' + ags.length, sub: blocked.length + ' con restricción', tone: 'accent', icon: 'handshake' }) +
      UI.kpi({ label: 'Crédito otorgado', value: money(limit, 'PEN', 0), sub: 'Líneas vigentes', tone: 'info', icon: 'wallet' }) +
      UI.kpi({ label: 'Crédito utilizado', value: money(used, 'PEN', 0), sub: fmtN(limit ? used / limit * 100 : 0, 1) + '% de la línea total', tone: used / (limit || 1) > .7 ? 'sun' : 'ok', icon: 'pie' }) +
      UI.kpi({ label: 'Ventas B2B', value: money(sum(b2bRes, r => toPEN(r.total, r.currency)), 'PEN', 0), sub: b2bRes.length + ' reservas del canal', tone: 'violet', icon: 'suitcase' }) +
      UI.kpi({ label: 'Comisiones por liquidar', value: money(sum(coms, c => toPEN(c.amount, c.currency)), 'PEN'), sub: coms.length + ' registros', tone: 'sun', icon: 'percent' }) +
      '</div>' +
      (blocked.length ? UI.alert('warn', '<b>Regla 14 — B2B por agencia/producto/vigencia.</b> ' + blocked.map(a => esc(a.name) + ' (' + esc(UI.statusLabel(agStatus(a))) + ')').join(', ') + ' no puede reservar a crédito; el portal solo le permite prepago. El bloqueo es automático cuando el crédito utilizado supera el límite.') : '') +
      '<div id="b2b-tbl"></div></div>';
    UI.dataTable(v.querySelector('#b2b-tbl'), {
      exportName: 'agencias_b2b', rows: () => DB.b2bAgencies, search: ['name', 'ruc', 'contact', 'priceList'], searchPlaceholder: 'Buscar agencia, RUC o contacto…',
      filters: [{ label: 'Estado', options: [['activa', 'Activa'], ['bloqueada', 'Bloqueada'], ['inactiva', 'Inactiva']], match: (r, val) => agStatus(r) === val }, { label: 'Lista', key: 'priceList', options: [...new Set(DB.b2bAgencies.map(a => a.priceList))].map(x => [x, x]) }],
      toolbar: canManage ? '<button class="btn sm primary" id="ag-new">' + ic('plus') + 'Nueva agencia</button>' : '',
      columns: [
        { key: 'name', label: 'Agencia', render: a => '<div class="cell-main">' + esc(a.name) + '</div><div class="cell-sub">RUC ' + esc(a.ruc) + ' · ' + esc(a.contact) + '</div>' },
        { key: 'priceList', label: 'Lista de precios', render: a => esc(a.priceList) },
        { key: 'commissionPct', label: 'Comisión', align: 'num', render: a => fmtN(a.commissionPct, 1) + '%' },
        { key: 'creditUsed', label: 'Uso de crédito', sortVal: a => a.creditLimit ? a.creditUsed / a.creditLimit : 0, render: a => a.creditLimit ? '<div style="min-width:150px"><div class="row between xs"><span>' + money(a.creditUsed, a.currency, 0) + '</span><span class="faint">de ' + money(a.creditLimit, a.currency, 0) + '</span></div>' + UI.progress(a.creditUsed / a.creditLimit * 100, a.creditUsed / a.creditLimit >= .9 ? 'bad' : a.creditUsed / a.creditLimit >= .7 ? 'sun' : 'ok') + '</div>' : '<span class="faint small">Sin crédito · prepago</span>' },
        { key: 'avail', label: 'Disponible', align: 'num', sortVal: a => agAvail(a), render: a => a.creditLimit ? money(agAvail(a), a.currency, 0) : '—' },
        { key: 'validTo', label: 'Vigencia', render: a => '<span class="small">' + date(a.since) + ' — ' + date(a.validTo) + '</span>' },
        { key: 'status', label: 'Estado', sortVal: a => agStatus(a), render: a => UI.badge(agStatus(a)) }
      ],
      onRow: a => agencyDrawer(a, canManage)
    });
    const nb = v.querySelector('#ag-new'); if (nb) nb.onclick = () => agencyForm(null);
  }

  function agencyDrawer(a, canManage) {
    const res = DB.reservations.filter(r => r.channel === 'B2B' && (r.agencyId === a.id || (a.clientId && r.clientId === a.clientId)));
    const prices = DB.products.filter(p => (p.b2b || []).some(b => b.agencyId === a.id));
    const st = agStatus(a);
    UI.drawer({
      title: esc(a.name), sub: 'Agencia asociada ' + a.id + ' · RUC ' + a.ruc, wide: true,
      body: '<div class="stack">' + (st !== 'activa' ? UI.alert(st === 'bloqueada' ? 'bad' : 'warn', st === 'bloqueada' ? '<b>Agencia bloqueada.</b> ' + (a.creditLimit && a.creditUsed > a.creditLimit ? 'Crédito excedido (' + money(a.creditUsed, a.currency) + ' de ' + money(a.creditLimit, a.currency) + ').' : 'Bloqueo manual por administración.') + ' Solo puede operar con prepago.' : 'Estado: ' + esc(UI.statusLabel(st))) : '') +
        '<div class="grid g2">' + UI.card('Condición comercial', UI.dl([['Lista de precios', esc(a.priceList)], ['Comisión base', fmtN(a.commissionPct, 1) + '%'], ['Límite de crédito', a.creditLimit ? money(a.creditLimit, a.currency) : 'Sin crédito (prepago)'], ['Crédito utilizado', money(a.creditUsed, a.currency)], ['Disponible', money(agAvail(a), a.currency)], ['Vigencia', date(a.since) + ' — ' + date(a.validTo)], ['Estado', UI.badge(st)]]) + (a.creditLimit ? '<div style="margin-top:12px">' + UI.progress(a.creditUsed / a.creditLimit * 100, a.creditUsed / a.creditLimit >= .9 ? 'bad' : 'ok') + '</div>' : '')) +
        UI.card('Contacto y acceso', UI.dl([['Contacto', esc(a.contact)], ['Correo', esc(agEmail(a))], ['Cliente CRM', a.clientId ? '<a href="#/crm/clientes/' + a.clientId + '">' + esc(a.clientId) + '</a>' : '—'], ['Usuario portal', a.id === 'AGB-01' ? 'U13 · reservas@wayraviajes.pe' : 'Pendiente de alta']])) + '</div>' +
        UI.card('Tarifas B2B asignadas (' + prices.length + ')', prices.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Producto</th><th>Lista</th><th class="num">Precio B2B</th><th class="num">Comisión</th><th>Crédito</th></tr></thead><tbody>' + prices.map(p => { const b = p.b2b.find(x => x.agencyId === a.id); const t = b2bTerms(p, a); return '<tr><td>' + esc(p.name) + '</td><td>' + esc(b.priceList) + '</td><td class="num">' + money(b.price, t.cur || 'PEN') + '</td><td class="num">' + fmtN(b.commissionPct, 1) + '%</td><td>' + (b.credit ? UI.badge('activo', 'Permitido') : UI.badge('inactivo', 'Prepago')) + '</td></tr>'; }).join('') + '</tbody></table></div>' : UI.empty('Sin tarifas asignadas'), { tight: true }) +
        UI.card('Reservas del canal (' + res.length + ')', res.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Reserva</th><th>Servicio</th><th>Fecha</th><th class="num">Total</th><th>Estado</th></tr></thead><tbody>' + res.map(r => '<tr class="click" onclick="location.hash=\'#/reservas/' + r.id + '\'"><td class="mono">' + esc(r.id) + '</td><td>' + esc(r.title) + '</td><td>' + dateShort(r.travelFrom) + '</td><td class="num">' + money(r.total, r.currency) + '</td><td>' + UI.badge(r.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin reservas'), { tight: true }) + '</div>',
      actions: (canManage ? [{ label: 'Editar', icon: 'edit', onClick: () => { setTimeout(() => agencyForm(a), 0); } },
        { label: st === 'bloqueada' ? 'Desbloquear' : 'Bloquear', icon: 'lock', cls: st === 'bloqueada' ? '' : 'danger', onClick: () => { setTimeout(() => toggleBlock(a), 0); } }] : []).concat([{ label: 'Ver portal como esta agencia', icon: 'eye', cls: 'primary', onClick: () => { setB2bSess(a.id); App.go('#/canales/b2b/portal/catalogo'); } }])
    });
  }
  function toggleBlock(a) {
    if (!Auth.can('channels.b2b.manage')) { UI.toast('Requiere permiso channels.b2b.manage.', 'bad'); return; }
    const st = agStatus(a);
    if (st === 'bloqueada' && a.creditLimit && a.creditUsed > a.creditLimit) { UI.toast('No se puede desbloquear: el crédito utilizado supera el límite. Amplíe el límite o registre pagos (Regla 14).', 'bad'); return; }
    UI.confirm({ title: st === 'bloqueada' ? 'Desbloquear agencia' : 'Bloquear agencia', message: (st === 'bloqueada' ? 'La agencia podrá volver a reservar con crédito.' : 'La agencia solo podrá reservar con prepago hasta su desbloqueo.') + ' La acción queda auditada.', reason: true, danger: st !== 'bloqueada', confirmLabel: st === 'bloqueada' ? 'Desbloquear' : 'Bloquear',
      onConfirm: (reason) => { const before = a.status; a.status = st === 'bloqueada' ? 'activa' : 'bloqueada'; Store.save(); Audit.log('Agencia B2B', a.id, a.status === 'bloqueada' ? 'bloquear' : 'desbloquear', before, a.status + ' · ' + reason); Notify.push('b2b.estado', 'Email', agEmail(a), 'Estado de su cuenta B2B: ' + UI.statusLabel(a.status)); UI.toast('Agencia ' + esc(a.name) + ': ' + UI.statusLabel(a.status)); App.render(); } });
  }
  function agencyForm(a) {
    if (!Auth.can('channels.b2b.manage')) { UI.toast('Requiere permiso channels.b2b.manage.', 'bad'); return; }
    const isNew = !a; a = a || { name: '', ruc: '', contact: '', email: '', priceList: 'Minorista 2026', commissionPct: 8, creditLimit: 0, creditUsed: 0, currency: 'PEN', status: 'activa', since: T(), validTo: '2026-12-31' };
    UI.modal({ title: isNew ? 'Alta de agencia asociada' : 'Editar agencia ' + a.id, size: 'lg', body: UI.form([
      { type: 'section', label: 'Datos de la agencia' },
      { id: 'ag_name', label: 'Razón social', required: true, value: a.name, col: 8 }, { id: 'ag_ruc', label: 'RUC', required: true, value: a.ruc, col: 4 },
      { id: 'ag_contact', label: 'Contacto comercial', required: true, value: a.contact, col: 6 }, { id: 'ag_email', label: 'Correo de reservas', value: a.email || (isNew ? '' : agEmail(a)), col: 6 },
      { type: 'section', label: 'Condición comercial (Regla 14)' },
      { id: 'ag_list', label: 'Lista de precios', type: 'select', options: ['Mayorista 2026', 'Minorista 2026', 'Corporativo 2026'], value: a.priceList, col: 4 },
      { id: 'ag_com', label: 'Comisión base %', type: 'number', step: '0.5', min: 0, max: 30, value: a.commissionPct, col: 4, required: true },
      { id: 'ag_cur', label: 'Moneda de la línea', type: 'select', options: [['PEN', 'Soles (PEN)'], ['USD', 'Dólares (USD)']], value: a.currency, col: 4 },
      { id: 'ag_limit', label: 'Límite de crédito', type: 'number', min: 0, step: '100', value: a.creditLimit, col: 4, hint: '0 = solo prepago' },
      { id: 'ag_since', label: 'Vigente desde', type: 'date', value: a.since, col: 4, required: true }, { id: 'ag_to', label: 'Vigente hasta', type: 'date', value: a.validTo, col: 4, required: true },
      { id: 'ag_status', label: 'Estado', type: 'select', options: [['activa', 'Activa'], ['bloqueada', 'Bloqueada'], ['inactiva', 'Inactiva']], value: a.status, col: 4 }
    ]), actions: [{ label: 'Cancelar' }, { label: isNew ? 'Registrar agencia' : 'Guardar cambios', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false;
      const f = UI.formData(m);
      if (!/^\d{11}$/.test(f.ag_ruc)) { UI.toast('El RUC debe tener 11 dígitos.', 'bad'); return false; }
      if (f.ag_to < f.ag_since) { UI.toast('La vigencia final no puede ser anterior al inicio.', 'bad'); return false; }
      const before = isNew ? '' : a.priceList + ' / ' + a.commissionPct + '% / ' + a.creditLimit;
      Object.assign(a, { name: f.ag_name, ruc: f.ag_ruc, contact: f.ag_contact, email: f.ag_email, priceList: f.ag_list, commissionPct: Number(f.ag_com) || 0, currency: f.ag_cur, creditLimit: Number(f.ag_limit) || 0, since: f.ag_since, validTo: f.ag_to, status: f.ag_status });
      if (isNew) { a.id = nextId(DB.b2bAgencies, 'AGB-', 2); a.clientId = null; DB.b2bAgencies.push(a); }
      let warn = '';
      if (a.creditLimit > 0 && a.creditUsed > a.creditLimit) { a.status = 'bloqueada'; warn = ' Bloqueada automáticamente: crédito utilizado mayor al nuevo límite.'; }
      Store.save(); Audit.log('Agencia B2B', a.id, isNew ? 'crear' : 'editar', before, a.priceList + ' / ' + a.commissionPct + '% / ' + a.creditLimit);
      UI.toast((isNew ? 'Agencia ' + a.id + ' registrada.' : 'Agencia actualizada.') + warn, warn ? 'warn' : 'ok'); App.render();
    } }] });
  }

  function b2bPrices(v, canManage) {
    const prods = DB.products.filter(p => p.flags.b2b || (p.b2b || []).length);
    v.innerHTML = '<div class="stack">' + UI.alert('info', 'Solo los productos con el indicador <b>Disponible B2B</b> y estado <b>ACTIVE</b> se muestran en el portal de agencias. Cada agencia ve únicamente las tarifas asignadas a ella y vigentes (Regla 14).') + '<div id="pl-tbl"></div></div>';
    UI.dataTable(v.querySelector('#pl-tbl'), {
      exportName: 'listas_precios_b2b', rows: prods, search: ['name', 'code'], searchPlaceholder: 'Buscar producto…',
      filters: [{ label: 'Estado', key: 'status', options: ['ACTIVE', 'REVIEW', 'SUSPENDED', 'DRAFT'] }],
      columns: [
        { key: 'name', label: 'Producto', render: p => '<div class="cell-main">' + esc(p.name) + '</div><div class="cell-sub mono">' + esc(p.code) + '</div>' },
        { key: 'status', label: 'Estado', render: p => UI.badge(p.status) + (p.status !== 'ACTIVE' ? '<div class="xs faint">No visible en portal</div>' : '') },
        { key: 'pub', label: 'Precio público', align: 'num', sort: false, render: p => { const r = publicRate(p); return r ? money(r.price, r.currency) : '—'; } },
        { key: 'b2b', label: 'Tarifa B2B general', align: 'num', sort: false, render: p => { const r = b2bRate(p); return r ? money(r.price, r.currency) + '<div class="cell-sub">hasta ' + date(r.validTo) + '</div>' : '<span class="faint">—</span>'; } },
        { key: 'ag', label: 'Asignación por agencia', sort: false, render: p => (p.b2b || []).length ? '<div class="chip-row">' + p.b2b.map(b => { const a = Q.agency(b.agencyId) || { name: b.agencyId }; return '<span class="tag">' + esc(a.name.split(' ')[0]) + ' · ' + fmtN(b.price, 0) + ' · ' + fmtN(b.commissionPct, 0) + '%' + (b.credit ? '' : ' · prepago') + '</span>'; }).join('') + '</div>' : '<span class="faint small">Sin asignar</span>' },
        { key: 'act', label: '', sort: false, render: p => canManage ? '<button class="btn xs" data-pl="' + p.id + '">' + ic('edit') + 'Gestionar</button>' : '' }
      ],
      afterDraw: (c) => c.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => priceForm(Q.product(b.dataset.pl)))
    });
  }
  function priceForm(p) {
    if (!Auth.can('channels.b2b.manage')) { UI.toast('Requiere permiso channels.b2b.manage.', 'bad'); return; }
    const r = b2bRate(p) || publicRate(p) || { currency: 'PEN', price: 0 };
    const pub = publicRate(p);
    let bindRm = () => { };
    const list = () => (p.b2b || []).length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Agencia</th><th>Lista</th><th class="num">Precio</th><th class="num">Com.</th><th>Vigencia</th><th></th></tr></thead><tbody>' + p.b2b.map((b, i) => '<tr><td>' + esc(Q.userName(b.agencyId)) + '</td><td>' + esc(b.priceList) + '</td><td class="num">' + money(b.price, r.currency) + '</td><td class="num">' + fmtN(b.commissionPct, 1) + '%</td><td class="small">' + (b.validTo ? date(b.validTo) : 'Según producto') + '</td><td><button class="btn xs ghost" data-rm="' + i + '">' + ic('trash') + 'Quitar</button></td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin agencias asignadas');
    UI.modal({ title: 'Tarifas B2B · ' + esc(p.name), sub: 'Precio público ' + (pub ? money(pub.price, pub.currency) : '—') + ' · Tarifa B2B general ' + (b2bRate(p) ? money(b2bRate(p).price, r.currency) : 'no definida'), size: 'lg',
      body: '<div id="pl-list">' + list() + '</div><div class="section-title" style="margin:16px 0 10px">Asignar o actualizar tarifa por agencia</div>' + UI.form([
        { id: 'pl_ag', label: 'Agencia', type: 'select', options: DB.b2bAgencies.map(a => [a.id, a.name]), col: 6 },
        { id: 'pl_price', label: 'Precio B2B neto (' + r.currency + ')', type: 'number', step: '0.01', min: 0, value: r.price, required: true, col: 3 },
        { id: 'pl_com', label: 'Comisión %', type: 'number', step: '0.5', min: 0, value: 10, required: true, col: 3 },
        { id: 'pl_to', label: 'Vigente hasta', type: 'date', value: '2026-12-31', col: 4 },
        { id: 'pl_credit', label: 'Permite reservar con crédito', type: 'switch', value: true, col: 8 }
      ]),
      onOpen: (m) => { bindRm = () => m.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const x = p.b2b.splice(+b.dataset.rm, 1)[0]; Store.save(); Audit.log('Tarifa B2B', p.id, 'quitar', x.agencyId + ' ' + x.price, ''); m.querySelector('#pl-list').innerHTML = list(); bindRm(); UI.toast('Tarifa retirada para ' + esc(x.agencyId)); }); bindRm(); },
      actions: [{ label: 'Cerrar', onClick: () => App.render() }, { label: 'Guardar tarifa', cls: 'primary', close: false, onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const a = Q.agency(f.pl_ag);
        if (pub && f.pl_price > pub.price) { UI.toast('El precio B2B no puede superar el precio público (' + money(pub.price, pub.currency) + ').', 'bad'); return false; }
        p.b2b = p.b2b || []; const ex = p.b2b.find(b => b.agencyId === a.id);
        const before = ex ? ex.price + ' / ' + ex.commissionPct + '%' : '';
        const val = { agencyId: a.id, priceList: a.priceList, price: Number(f.pl_price), commissionPct: Number(f.pl_com), credit: !!f.pl_credit, validTo: f.pl_to };
        if (ex) Object.assign(ex, val); else p.b2b.push(val);
        if (!p.flags.b2b) p.flags.b2b = true;
        Store.save(); Audit.log('Tarifa B2B', p.id, ex ? 'actualizar' : 'asignar', before, a.id + ' ' + val.price + ' / ' + val.commissionPct + '%');
        m.querySelector('#pl-list').innerHTML = list(); bindRm();
        UI.toast('Tarifa B2B guardada para ' + esc(a.name.replace(/\.$/, '')) + '.'); return false;
      } }] });
  }

  /* ---- Portal de agencia ---- */
  function b2bPortal(v, section, isAgency) {
    /* La agencia externa ya inició sesión: se usa SU agencia (Auth.agencyId), nunca la sesión simulada */
    const a = isAgency ? Q.agency(Auth.agencyId) : (b2bSess ? Q.agency(b2bSess) : null);
    const base = '#/canales/b2b/portal/';
    if (isAgency && !a) { v.innerHTML = UI.card('', UI.empty('Su usuario no está vinculado a una agencia con convenio. Comuníquese con su ejecutivo B2B.', 'handshake')); return; }
    const bar = chBar('Portal de agencias B2B', isAgency ? 'Sesión externa de ' + (a ? a.name : 'agencia') : 'Experiencia que ve la agencia asociada' + (a ? ' ' + a.name : ''), !isAgency && a ? '<button class="btn" id="b2b-out">' + ic('logout') + 'Cerrar sesión de agencia</button>' : '');
    if (!a) {
      v.innerHTML = '<div class="stack">' + bar + shell({ sub: 'Portal de agencias', body: '<div class="card login-card"><div class="card-h"><div><div class="t">Acceso para agencias asociadas</div><div class="s">Canal exclusivo para agencias con convenio vigente</div></div></div><div class="card-b"><div class="form-grid">' +
        UI.field({ id: 'bl_ag', label: 'Agencia', type: 'select', options: DB.b2bAgencies.map(x => [x.id, x.id + ' · ' + x.name]), value: 'AGB-01', col: 12 }) +
        UI.field({ id: 'bl_user', label: 'Usuario', value: 'reservas@wayraviajes.pe', col: 12 }) + UI.field({ id: 'bl_pass', label: 'Contraseña', type: 'password', value: 'demo-2026', col: 12 }) +
        '</div><button class="btn primary" id="bl-go" style="width:100%;justify-content:center;margin-top:14px;height:38px">' + ic('lock') + 'Ingresar al portal</button><p class="xs faint center" style="margin-top:10px">Autenticación del usuario B2B con resolución de tenant y permisos en backend (PROC-062).</p></div></div>' }) + '</div>';
      const sel = v.querySelector('#bl_ag'); sel.onchange = () => { v.querySelector('#bl_user').value = agEmail(Q.agency(sel.value)); };
      v.querySelector('#bl-go').onclick = () => { const id = sel.value; const ag = Q.agency(id); if (ag.status === 'inactiva') { UI.toast('La agencia está inactiva: acceso denegado.', 'bad'); return; } setB2bSess(id); Audit.log('Sesión B2B', id, 'login', '', 'Portal de agencias'); UI.toast('Bienvenido, ' + esc(ag.name)); App.go(base + 'catalogo'); };
      return;
    }
    const st = agStatus(a);
    const myRes = DB.reservations.filter(r => r.channel === 'B2B' && (r.agencyId === a.id || (a.clientId && r.clientId === a.clientId)));
    const nav = [{ id: 'catalogo', label: 'Catálogo autorizado', href: base + 'catalogo' }, { id: 'reservas', label: 'Mis reservas', href: base + 'reservas', count: myRes.filter(r => ['pendiente_pago', 'pendiente_proveedor', 'pendiente_disponibilidad'].includes(r.status)).length }, { id: 'cuenta', label: 'Estado de cuenta', href: base + 'cuenta' }];
    const user = userChip(a.name, a.contact + ' · ' + a.priceList) + (isAgency ? '' : '');
    const creditLine = '<div class="card"><div class="card-b"><div class="row between" style="gap:16px"><div class="row" style="gap:12px"><div class="ico-box ' + (st === 'activa' ? '' : 'bad') + '">' + ic('wallet') + '</div><div><div class="small muted">Línea de crédito</div><b>' + (a.creditLimit ? money(agAvail(a), a.currency) + ' disponibles' : 'Sin línea de crédito · prepago') + '</b></div></div>' +
      (a.creditLimit ? '<div class="grow" style="min-width:200px;max-width:420px"><div class="row between xs"><span>Utilizado ' + money(a.creditUsed, a.currency, 0) + '</span><span class="faint">Límite ' + money(a.creditLimit, a.currency, 0) + '</span></div>' + UI.progress(a.creditUsed / a.creditLimit * 100, a.creditUsed / a.creditLimit >= .9 ? 'bad' : a.creditUsed / a.creditLimit >= .7 ? 'sun' : 'ok') + '</div>' : '') +
      '<div class="small"><span class="muted">Comisión base</span> <b>' + fmtN(a.commissionPct, 1) + '%</b> · <span class="muted">Convenio hasta</span> <b>' + date(a.validTo) + '</b> ' + UI.badge(st) + '</div></div></div></div>';
    const warn = st === 'bloqueada' ? UI.alert('bad', '<b>Cuenta bloqueada para crédito.</b> Puede seguir reservando con prepago. Para reactivar la línea, regularice su saldo o comuníquese con su ejecutivo B2B (Regla 14).') : st === 'vencido' ? UI.alert('bad', '<b>Convenio vencido.</b> No es posible reservar hasta renovar el convenio (Regla 14: vigencia).') : st === 'inactiva' ? UI.alert('bad', 'Agencia inactiva.') : '';
    const secT = { catalogo: 'Catálogo y tarifas', reservas: 'Mis reservas', cuenta: 'Estado de cuenta' }[section] || 'Catálogo y tarifas';
    const extHead = '<div class="ext-h"><div><h2>' + secT + '</h2><div class="small muted">' + esc(a.name) + ' · ' + esc(a.contact) + ' · lista ' + esc(a.priceList) + '</div></div></div>';
    let body = (isAgency ? extHead : '') + warn + creditLine + '<div id="b2b-sec"></div>';
    v.innerHTML = frame(bar, { sub: 'Portal de agencias', nav, active: section, user: user + '<button class="btn sm ghost" id="b2b-logout" title="Cerrar sesión">' + ic('logout') + '</button>', body });
    const out = () => { Audit.log('Sesión B2B', a.id, 'logout', '', ''); setB2bSess(null); App.go(base + 'catalogo'); };
    const ob = v.querySelector('#b2b-out'); if (ob) ob.onclick = out; const lo = v.querySelector('#b2b-logout'); if (lo) lo.onclick = out;
    const sec = v.querySelector('#b2b-sec');
    if (section === 'reservas') b2bMyRes(sec, a, myRes);
    else if (section === 'cuenta') b2bAccount(sec, a, myRes);
    else b2bCatalog(sec, a);
  }

  function b2bCatalog(sec, a) {
    const prods = DB.products.filter(p => p.status === 'ACTIVE' && p.flags.b2b);
    sec.innerHTML = '<div class="row between" style="margin-bottom:12px"><div><h3>' + (EXT() ? 'Productos autorizados' : 'Catálogo autorizado') + '</h3><div class="small muted">' + prods.length + ' productos habilitados para el canal B2B · tarifas netas de su lista <b>' + esc(a.priceList) + '</b></div></div><div class="search-in" style="width:260px;max-width:100%">' + ic('search') + '<input class="input sm" id="b2b-q" type="search" placeholder="Buscar producto o destino…" aria-label="Buscar"></div></div><div class="st-grid" id="b2b-grid"></div>';
    const draw = (q) => {
      const list = prods.filter(p => !q || (p.name + ' ' + Q.destName(p.destId) + ' ' + p.category).toLowerCase().includes(q.toLowerCase())).sort((x, y) => (b2bTerms(y, a).ok ? 1 : 0) - (b2bTerms(x, a).ok ? 1 : 0));
      sec.querySelector('#b2b-grid').innerHTML = list.length ? list.map(p => {
        const t = b2bTerms(p, a);
        const deps = (p.departures || []).filter(d => daysFromToday(d.date) >= 0).slice(0, 4);
        return '<div class="st-card">' + UI.thumb(p) + '<div class="st-card-b"><div class="row between"><span class="tag">' + esc(p.type) + '</span><span class="xs faint">' + esc(durLabel(p)) + ' · ' + esc(Q.destName(p.destId)) + '</span></div><b>' + esc(p.name) + '</b>' +
          (t.ok ? '<div class="stat-line"><span class="muted">PVP sugerido</span><span class="num">' + (t.pub != null ? money(t.pub, t.cur) : '—') + '</span></div><div class="stat-line"><span class="muted">Precio neto B2B</span><b class="num">' + money(t.price, t.cur) + '</b></div><div class="stat-line"><span class="muted">Su comisión</span><span class="num">' + fmtN(t.commissionPct, 1) + '% · ' + money(t.price * t.commissionPct / 100, t.cur) + '</span></div>' : UI.alert('warn', esc(t.reason))) +
          '<div class="xs faint" style="margin-top:4px">' + (p.departures && p.departures.length ? 'Salidas: ' + (deps.length ? deps.map(d => dateShort(d.date) + ' (' + (depFree(d) ? depFree(d) + ' cupos' : 'completa') + ')').join(' · ') : 'sin salidas próximas') : 'Disponibilidad bajo solicitud al proveedor') + '</div></div>' +
          '<div class="st-card-f"><span class="xs faint">Pax ' + p.minPax + '–' + p.maxPax + ' · ' + (t.ok && t.credit ? 'crédito permitido' : 'prepago') + '</span><button class="btn sm ' + (t.ok ? 'primary' : '') + '" data-res="' + p.id + '"' + (t.ok ? '' : ' disabled') + '>' + ic('suitcase') + 'Reservar</button></div></div>';
      }).join('') : UI.empty('Sin productos que coincidan', 'search');
      sec.querySelectorAll('[data-res]').forEach(b => b.onclick = () => b2bReserve(Q.product(b.dataset.res), a));
    };
    draw('');
    sec.querySelector('#b2b-q').addEventListener('input', Util.debounce(e => draw(e.target.value.trim()), 150));
  }

  function b2bReserve(p, a) {
    const st = agStatus(a);
    if (st === 'vencido' || st === 'inactiva') { UI.toast('Regla 14: convenio ' + UI.statusLabel(st).toLowerCase() + '. No es posible reservar.', 'bad'); return; }
    const t = b2bTerms(p, a); if (!t.ok) { UI.toast(t.reason, 'bad'); return; }
    const hasDeps = (p.departures || []).length > 0;
    const deps = (p.departures || []).filter(d => daysFromToday(d.date) >= 0);
    const creditOk = t.credit && a.creditLimit > 0 && st === 'activa';
    const depOpts = deps.map(d => { const tooSoon = daysFromToday(d.date) < p.advMin; return [d.id, date(d.date) + ' · ' + d.time + ' · ' + (tooSoon ? 'fuera de anticipación mínima' : depFree(d) ? depFree(d) + ' cupos' : 'completa')]; });
    const firstOk = deps.find(d => depFree(d) > 0 && daysFromToday(d.date) >= p.advMin);
    UI.modal({ title: 'Reservar · ' + esc(p.name), sub: 'Tarifa ' + esc(t.list) + ' · ' + money(t.price, t.cur) + ' neto por pasajero · comisión ' + fmtN(t.commissionPct, 1) + '%', size: 'lg',
      body: UI.form([
        hasDeps ? { id: 'br_dep', label: 'Salida', type: 'select', options: depOpts, value: firstOk ? firstOk.id : '', required: true, col: 6 } : { id: 'br_date', label: 'Fecha de inicio', type: 'date', value: addDays(T(), Math.max(p.advMin, 7)), min: addDays(T(), p.advMin), required: true, col: 6, hint: 'Anticipación mínima ' + p.advMin + ' días. Sujeto a confirmación del proveedor.' },
        { id: 'br_pax', label: 'Pasajeros', type: 'number', min: p.minPax, max: p.maxPax, value: Math.max(p.minPax, 2), required: true, col: 3 },
        { id: 'br_pay', label: 'Forma de pago', type: 'select', options: creditOk ? [['credito', 'Crédito de la agencia'], ['prepago', 'Prepago']] : [['prepago', 'Prepago']], value: creditOk ? 'credito' : 'prepago', col: 3 },
        { id: 'br_names', label: 'Nombres y documento de pasajeros (uno por línea)', type: 'textarea', rows: 4, placeholder: 'Ej.: Carla Mendoza Ruiz — DNI 45012233', col: 8 },
        { id: 'br_ref', label: 'Referencia de la agencia', placeholder: 'File interno', col: 4 },
        { type: 'html', col: 12, html: '<div id="br-sum"></div><div id="br-msg" style="margin-top:10px"></div>' }
      ]),
      onOpen: (m) => {
        const upd = () => {
          const pax = Number(m.querySelector('#br_pax').value) || 0; const tot = t.price * pax; const pen = toPEN(tot, t.cur); const pay = m.querySelector('#br_pay').value;
          const dep = hasDeps ? deps.find(d => d.id === m.querySelector('#br_dep').value) : null;
          m.querySelector('#br-sum').innerHTML = '<div class="grid g2"><div>' + '<div class="stat-line"><span>' + pax + ' pax × ' + money(t.price, t.cur) + '</span><b class="num">' + money(tot, t.cur) + '</b></div><div class="stat-line"><span class="muted">Comisión a favor (' + fmtN(t.commissionPct, 1) + '%)</span><span class="num">' + money(tot * t.commissionPct / 100, t.cur) + '</span></div>' + (t.cur !== a.currency ? '<div class="stat-line"><span class="muted">Equivalente en ' + a.currency + ' (TC ' + DB.settings.fx + ')</span><span class="num">' + money(pen, 'PEN') + '</span></div>' : '') + '</div><div>' +
            (dep ? '<div class="stat-line"><span class="muted">Cupos de la salida</span><span class="num">' + depFree(dep) + ' de ' + dep.capacity + '</span></div>' : '<div class="stat-line"><span class="muted">Disponibilidad</span><span>Bajo solicitud</span></div>') +
            (pay === 'credito' ? '<div class="stat-line"><span class="muted">Crédito disponible</span><span class="num">' + money(agAvail(a), a.currency) + '</span></div><div class="stat-line"><span class="muted">Disponible tras la reserva</span><b class="num ' + (pen > agAvail(a) ? 'bad' : 'ok') + '">' + money(agAvail(a) - pen, a.currency) + '</b></div>' : '<div class="stat-line"><span class="muted">Prepago</span><span>Pago antes de la emisión del voucher</span></div>') + '</div></div>';
        };
        m.querySelectorAll('input,select').forEach(x => x.addEventListener('input', upd)); upd();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar reserva', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const f = UI.formData(m); const pax = Number(f.br_pax); const msg = m.querySelector('#br-msg');
        if (pax < p.minPax || pax > p.maxPax) { UI.toast('Cantidad de pasajeros fuera del rango permitido (' + p.minPax + '–' + p.maxPax + ').', 'bad'); return false; }
        let dep = null, dt;
        if (hasDeps) {
          dep = deps.find(d => d.id === f.br_dep); if (!dep) { UI.toast('Seleccione una salida.', 'bad'); return false; }
          if (daysFromToday(dep.date) < p.advMin) { msg.innerHTML = UI.alert('bad', 'La salida del ' + date(dep.date) + ' no cumple la anticipación mínima de ' + p.advMin + ' días del producto.'); return false; }
          if (depFree(dep) < pax) { msg.innerHTML = UI.alert('bad', '<b>Sin disponibilidad.</b> La salida tiene ' + depFree(dep) + ' cupos para ' + pax + ' pasajeros. Regla transversal 4: no se confirma sin disponibilidad. Elija otra salida.'); return false; }
          dt = dep.date;
        } else { dt = f.br_date; if (daysFromToday(dt) < p.advMin) { UI.toast('La fecha no cumple la anticipación mínima de ' + p.advMin + ' días.', 'bad'); return false; } }
        const total = t.price * pax; const pen = toPEN(total, t.cur);
        if (f.br_pay === 'credito') {
          if (agStatus(a) !== 'activa') { msg.innerHTML = UI.alert('bad', 'Cuenta bloqueada para crédito (Regla 14). Cambie la forma de pago a prepago.'); return false; }
          if (pen > agAvail(a)) {
            msg.innerHTML = UI.alert('bad', '<b>Crédito insuficiente.</b> La reserva suma ' + money(pen, 'PEN') + ' y su crédito disponible es ' + money(agAvail(a), a.currency) + '. Regla 14: el sistema bloquea la reserva a crédito. <button class="btn xs" id="br-pp" style="margin-left:6px">Cambiar a prepago</button>');
            Audit.log('Agencia B2B', a.id, 'credito_excedido', money(agAvail(a), a.currency), 'Intento ' + money(pen, 'PEN') + ' · ' + p.id);
            m.querySelector('#br-pp').onclick = () => { m.querySelector('#br_pay').value = 'prepago'; m.querySelector('#br_pay').dispatchEvent(new Event('input')); msg.innerHTML = UI.alert('info', 'Forma de pago cambiada a prepago. Confirme nuevamente.'); };
            return false;
          }
        }
        const names = String(f.br_names || '').split('\n').map(s => s.trim()).filter(Boolean);
        const passengers = Array.from({ length: pax }, (_, i) => { const n = names[i] || ''; const parts = n.split(/\s+[—-]\s+/); return { name: parts[0] || 'Pasajero ' + (i + 1) + ' (por nominar)', doc: parts[1] || 'Por registrar', type: 'ADT', nationality: 'Peruana', birth: '', phone: '', diet: '' }; });
        const credit = f.br_pay === 'credito';
        const status = credit ? (dep ? 'confirmada' : 'pendiente_proveedor') : 'pendiente_pago';
        const r = createRes({ p, clientId: a.clientId || 'CLI-0007', title: a.name.split(' ')[0] + ' — ' + pax + ' pax ' + p.name + ' (B2B)', channel: 'B2B', status, cur: t.cur, total, cost: t.cost * pax, owner: Auth.role === 'b2b' ? Auth.user.id : 'U13', date: dt, dep, pax, passengers, notes: 'Reserva creada desde portal B2B por ' + a.name + (f.br_ref ? ' · Ref. ' + f.br_ref : '') + '. ' + (credit ? 'Pago con crédito de la agencia.' : 'Prepago requerido antes de emitir voucher.'), extra: { agencyId: a.id, b2b: { agencyId: a.id, priceList: t.list, commissionPct: t.commissionPct, payMode: credit ? 'credito' : 'prepago', ref: f.br_ref || '' } } });
        addReceivable({ resId: r.id, clientId: r.clientId, concept: (credit ? 'Reserva B2B ' + a.name.split(' ')[0] + ' — crédito 15 d' : 'Prepago B2B ' + a.name.split(' ')[0]), amount: total, currency: t.cur, due: credit ? addDays(T(), 15) : addDays(T(), 1) });
        DB.commissions.unshift({ id: nextId(DB.commissions, 'COM-', 4), resId: r.id, beneficiary: a.id, kind: 'Agencia B2B', base: total, pct: t.commissionPct, amount: Math.round(total * t.commissionPct) / 100, currency: t.cur, status: 'calculada' });
        if (credit) { a.creditUsed = Math.round((a.creditUsed + pen) * 100) / 100; }
        let vou = null; if (status === 'confirmada') vou = issueVoucher(r);
        Store.save();
        Audit.log('Reserva', r.id, 'crear_b2b', '', status + ' · ' + a.id + ' · ' + (credit ? 'crédito' : 'prepago'));
        if (dep) Audit.log('Disponibilidad', dep.id, 'consumir_cupos', (dep.sold - pax) + '/' + dep.capacity, dep.sold + '/' + dep.capacity);
        Notify.push('reserva.confirmada', 'Email', agEmail(a), (status === 'confirmada' ? 'Reserva confirmada ' : 'Reserva registrada ') + r.id + ' — ' + p.name);
        Notify.push('reserva.b2b', 'Portal', 'U02', 'Nueva reserva B2B ' + r.id + ' de ' + a.name);
        if (vou) Notify.push('voucher.emitido', 'Email', agEmail(a), vou.id + ' · ' + p.name);
        UI.toast('Reserva ' + r.id + ' ' + (status === 'confirmada' ? 'confirmada' : 'registrada (' + UI.statusLabel(status).toLowerCase() + ')') + '.' + (vou ? ' Voucher ' + vou.id + ' emitido.' : ''));
        App.go('#/canales/b2b/portal/reservas');
      } }] });
  }

  function b2bMyRes(sec, a, myRes) {
    sec.innerHTML = '<div id="b2b-res"></div>';
    UI.dataTable(sec.querySelector('#b2b-res'), {
      exportName: 'mis_reservas_b2b', rows: myRes, search: r => r.id + ' ' + r.title + ' ' + r.passengers.map(p => p.name).join(' '), searchPlaceholder: 'Buscar reserva o pasajero…',
      filters: [{ label: 'Estado', key: 'status', options: [...new Set(myRes.map(r => r.status))] }],
      defaultSort: 'createdAt', defaultDir: -1,
      columns: [
        { key: 'id', label: 'Reserva', render: r => '<span class="mono">' + esc(r.id) + '</span>' },
        { key: 'title', label: 'Servicio', render: r => '<div class="cell-main">' + esc(r.services[0] ? Q.productName(r.services[0].productId) : r.title) + '</div><div class="cell-sub">' + (r.b2b && r.b2b.ref ? 'Ref. ' + esc(r.b2b.ref) + ' · ' : '') + 'creada ' + datetime(r.createdAt) + '</div>' },
        { key: 'travelFrom', label: 'Fecha', render: r => date(r.travelFrom) },
        { key: 'pax', label: 'Pax', align: 'num', sortVal: r => r.passengers.length, render: r => r.passengers.length },
        { key: 'total', label: 'Total neto', align: 'num', render: r => money(r.total, r.currency) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status) },
        { key: 'createdAt', label: 'Voucher', sort: false, render: r => { const vs = DB.vouchers.filter(x => x.resId === r.id && x.status !== 'anulado'); return vs.length ? vs.map(x => '<button class="btn xs" data-vou="' + x.id + '">' + ic('ticket') + esc(x.id.slice(-5)) + '</button>').join(' ') : '<span class="xs faint">' + (r.status === 'pendiente_pago' ? 'Tras el pago' : 'Pendiente') + '</span>'; } }
      ],
      onRow: r => resDrawer(r, true),
      afterDraw: (c) => c.querySelectorAll('[data-vou]').forEach(b => b.onclick = () => { const x = DB.vouchers.find(y => y.id === b.dataset.vou); showDoc('Voucher ' + x.id, voucherDoc(x)); })
    });
  }
  function resDrawer(r, external) {
    const rcv = DB.receivables.filter(x => x.resId === r.id);
    const vs = DB.vouchers.filter(x => x.resId === r.id && x.status !== 'anulado');
    UI.drawer({ title: esc(r.title), sub: r.id + ' · ' + UI.statusLabel(r.status), wide: true,
      body: '<div class="stack">' + UI.flow(['Registrada', 'Confirmada', 'En operación', 'Completada'], { borrador: 0, pendiente_pago: 0, pendiente_proveedor: 0, pendiente_disponibilidad: 0, confirmada: 1, en_operacion: 2, completada: 4 }[r.status] != null ? { borrador: 0, pendiente_pago: 0, pendiente_proveedor: 0, pendiente_disponibilidad: 0, confirmada: 1, en_operacion: 2, completada: 4 }[r.status] : 0, r.status === 'cancelada' ? 1 : undefined) +
        UI.dl([['Canal', esc(r.channel)], ['Viaje', date(r.travelFrom) + (r.travelTo !== r.travelFrom ? ' — ' + date(r.travelTo) : '')], [EXT() ? 'Total neto' : 'Total', money(r.total, r.currency)]].concat(EXT() ? (r.b2b && r.b2b.ref ? [['Su referencia', esc(r.b2b.ref)]] : []) : [['Notas', esc(r.notes)]])) +
        '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Servicio</th><th>Fecha</th><th>Estado</th><th>Confirmación</th></tr></thead><tbody>' + r.services.map(s => '<tr><td>' + esc(s.name) + '</td><td>' + dateShort(s.date) + ' ' + esc(s.time) + '</td><td>' + UI.badge(s.status) + '</td><td class="mono">' + esc(s.confirmationCode || '—') + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pasajero</th><th>Documento</th><th>Tipo</th></tr></thead><tbody>' + r.passengers.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.doc) + '</td><td>' + esc(p.type) + '</td></tr>').join('') + '</tbody></table></div>' +
        (rcv.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Obligación</th><th>Vence</th><th class="num">Saldo</th><th>Estado</th></tr></thead><tbody>' + rcv.map(x => '<tr><td>' + esc(x.concept) + '</td><td>' + date(x.due) + '</td><td class="num">' + money(x.amount - x.paid, x.currency) + '</td><td>' + UI.badge(x.status) + '</td></tr>').join('') + '</tbody></table></div>' : '') +
        (vs.length ? '<div class="chip-row">' + vs.map(x => '<button class="btn sm" data-vd="' + x.id + '">' + ic('ticket') + 'Voucher ' + esc(x.id) + '</button>').join('') + '</div>' : '') + '</div>',
      onOpen: (d) => d.querySelectorAll('[data-vd]').forEach(b => b.onclick = () => showDoc('Voucher ' + b.dataset.vd, voucherDoc(DB.vouchers.find(x => x.id === b.dataset.vd)))),
      actions: (!EXT() && Access.canRoute('reservas/' + r.id) ? [{ label: 'Abrir en ERP', icon: 'arrowRight', onClick: () => App.go('#/reservas/' + r.id) }] : []).concat([{ label: 'Cerrar', cls: 'primary' }]) });
  }

  function b2bAccount(sec, a, myRes) {
    const ids = myRes.map(r => r.id);
    const rcv = DB.receivables.filter(x => ids.includes(x.resId) && x.status !== 'cancelada');
    const coms = DB.commissions.filter(c => ids.includes(c.resId) || (c.beneficiary === a.id));
    const pays = DB.payments.filter(p => ids.includes(p.resId));
    const pen = (x, f) => toPEN(f(x), x.currency);
    const billed = sum(rcv, x => pen(x, y => y.amount)), paid = sum(rcv, x => pen(x, y => y.paid)), due = billed - paid;
    const comPend = sum(coms.filter(c => c.status !== 'pagada'), c => pen(c, y => y.amount));
    sec.innerHTML = '<div class="stack"><div class="grid g4">' +
      UI.kpi({ label: 'Total facturado', value: money(billed, 'PEN'), sub: rcv.length + ' obligaciones', tone: 'info', icon: 'receipt' }) +
      UI.kpi({ label: 'Pagado', value: money(paid, 'PEN'), tone: 'ok', icon: 'checkCircle' }) +
      UI.kpi({ label: 'Por pagar', value: money(due, 'PEN'), sub: rcv.filter(x => x.status === 'vencida').length + ' vencida(s)', tone: due > 0 ? 'sun' : 'ok', icon: 'wallet' }) +
      UI.kpi({ label: 'Comisiones a favor', value: money(comPend, 'PEN'), sub: 'Saldo neto ' + money(due - comPend, 'PEN'), tone: 'violet', icon: 'percent' }) + '</div>' +
      UI.card('Estado de cuenta y liquidación', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reserva</th><th>Concepto</th><th>Vence</th><th class="num">Cargo</th><th class="num">Comisión</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>' +
        (rcv.length ? rcv.map(x => { const c = coms.find(k => k.resId === x.resId); const saldo = x.amount - x.paid; const pend = pays.filter(p => p.receivableId === x.id && p.status === 'pendiente'); return '<tr><td class="mono">' + esc(x.resId) + '</td><td>' + esc(x.concept) + (pend.length ? '<div class="cell-sub warn">Pago informado por validar: ' + money(sum(pend, 'amount'), x.currency) + '</div>' : '') + '</td><td class="nowrap">' + date(x.due) + '</td><td class="num">' + money(x.amount, x.currency) + '</td><td class="num">' + (c ? money(c.amount, c.currency) : '—') + '</td><td class="num">' + money(x.paid, x.currency) + '</td><td class="num"><b>' + money(saldo, x.currency) + '</b></td><td>' + UI.badge(x.status) + '</td><td>' + (saldo > 0.004 ? '<button class="btn xs" data-inf="' + x.id + '">Informar pago</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="9">' + UI.empty('Sin movimientos') + '</td></tr>') +
        '</tbody></table></div>', { tight: true, sub: 'Montos en moneda de cada reserva · consolidado en soles con TC ' + DB.settings.fx, actions: '<button class="btn sm" id="liq-req">' + ic('send') + 'Solicitar liquidación de comisiones</button>' }) +
      UI.card('Pagos registrados', pays.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pago</th><th>Fecha</th><th>Medio</th><th>Referencia</th><th class="num">Monto</th><th>Estado</th></tr></thead><tbody>' + pays.map(p => '<tr><td class="mono">' + esc(p.id) + '</td><td>' + date(p.date) + '</td><td>' + esc(p.method) + '</td><td class="small">' + esc(p.ref) + '</td><td class="num">' + money(p.amount, p.currency) + '</td><td>' + UI.badge(p.status === 'pendiente' ? 'por_validar' : p.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Aún no registra pagos', 'wallet'), { tight: true }) + '</div>';
    sec.querySelectorAll('[data-inf]').forEach(b => b.onclick = () => {
      const x = DB.receivables.find(y => y.id === b.dataset.inf);
      UI.modal({ title: 'Informar pago · ' + x.resId, sub: esc(x.concept), body: UI.form([
        { id: 'ip_amt', label: 'Monto (' + x.currency + ')', type: 'number', step: '0.01', value: (x.amount - x.paid).toFixed(2), required: true, col: 6 },
        { id: 'ip_m', label: 'Medio', type: 'select', options: ['Transferencia BCP', 'Transferencia Interbank', 'Transferencia BBVA', 'Depósito en cuenta'], col: 6 },
        { id: 'ip_ref', label: 'N.° de operación', required: true, col: 12, placeholder: 'Ej.: 00458812' }
      ]) + '<p class="xs faint" style="margin-top:10px">Finanzas validará el abono contra el extracto bancario (PROC-049). El crédito se libera al aplicar el pago.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Informar pago', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const amt = Number(f.ip_amt);
        if (!(amt > 0) || amt > x.amount - x.paid + 0.004) { UI.toast('El monto debe ser mayor a 0 y no superar el saldo.', 'bad'); return false; }
        const p = addPayment({ receivableId: x.id, resId: x.resId, method: f.ip_m, amount: amt, currency: x.currency, status: 'pendiente', ref: 'OP ' + f.ip_ref + ' (informado por agencia)', by: Auth.role === 'b2b' ? Auth.user.id : 'U13' });
        Store.save(); Audit.log('Pago', p.id, 'informar_b2b', '', 'pendiente · ' + money(amt, x.currency)); Notify.push('pago.informado', 'Portal', 'U07', 'Pago B2B por validar ' + p.id + ' — ' + a.name);
        UI.toast('Pago ' + p.id + ' informado. Queda por validar en Finanzas.'); App.render();
      } }] });
    });
    sec.querySelector('#liq-req').onclick = () => {
      if (!comPend) { UI.toast('No hay comisiones pendientes de liquidar.', 'info'); return; }
      Audit.log('Comisión', a.id, 'solicitar_liquidacion', '', money(comPend, 'PEN'));
      Notify.push('comision.liquidacion', 'Email', 'pleon@andeshorizonte.pe', 'Solicitud de liquidación de comisiones — ' + a.name + ' (' + money(comPend, 'PEN') + ')');
      UI.toast('Solicitud enviada a Finanzas por ' + money(comPend, 'PEN') + '.');
    };
  }

  /* =====================================================================================
     E-COMMERCE — PROC-054
     ===================================================================================== */
  let cart = null;
  let storeF = { q: '', cat: '', sort: 'rel' };
  const CK_STEPS = ['Selección', 'Configuración', 'Disponibilidad', 'Precio', 'Datos del pasajero', 'Pago', 'Confirmación'];
  const defIdx = (g) => { const i = g.options.findIndex(o => o.delta === 0); return i < 0 ? 0 : i; };
  function newCart(pid) { const p = Q.product(pid); const c = { pid, adt: Math.max(1, p.minPax), chd: 0, opts: {}, depId: null, date: null, promo: '', step: 0, buyer: {}, paxList: [], orderId: null, resId: null }; (p.config || []).forEach((g, i) => c.opts[i] = defIdx(g)); const d = (p.departures || []).find(x => depFree(x) >= c.adt && daysFromToday(x.date) >= p.advMin); if (d) c.depId = d.id; if (!(p.departures || []).length) c.date = addDays(T(), Math.max(p.advMin, 14)); return c; }
  function calcCart(c) {
    const p = Q.product(c.pid); const ar = webRate(p) || { price: 0, currency: 'PEN', cost: 0 }; const pub = publicRate(p);
    const cp = childPrice(p); const chU0 = cp != null ? cp : ar.price;
    const opts = (p.config || []).map((g, i) => ({ group: g.group, opt: g.options[c.opts[i] != null ? c.opts[i] : defIdx(g)] }));
    const deltaPP = sum(opts, o => o.opt.delta);
    const adtU = ar.price + deltaPP, chdU = chU0 + deltaPP;
    const sub = adtU * c.adt + chdU * c.chd; const paxN = c.adt + c.chd;
    const promos = activePromos(p);
    let disc = 0, discLbl = '', promoState = '';
    if (c.promo) { const pr = promos.find(x => x.code && x.code.toUpperCase() === c.promo.toUpperCase()); if (pr) { disc = sub * pr.value / 100; discLbl = 'Código ' + pr.code + ' (−' + pr.value + '%)'; promoState = 'ok'; } else promoState = 'bad'; }
    const grp = promos.find(x => !x.code && x.kind === 'Descuento por cantidad' && paxN >= 4);
    if (grp && sub * grp.value / 100 > disc) { disc = sub * grp.value / 100; discLbl = grp.name + ' (−' + grp.value + '%)'; if (promoState === 'ok') promoState = 'grp'; }
    const total = Math.round((sub - disc) * 100) / 100;
    return { p, cur: ar.currency, adtU, chdU, base: ar.price, pubPrice: pub ? pub.price : null, isWeb: ar.channel === 'E-commerce', deltaPP, opts, sub, disc, discLbl, promoState, total, paxN, cost: (ar.cost || 0) * paxN, hasChild: cp != null || p.minAge < 12 };
  }
  function cartAvail(c) {
    const p = Q.product(c.pid); const paxN = c.adt + c.chd;
    if ((p.departures || []).length) {
      const d = p.departures.find(x => x.id === c.depId);
      if (!d) return { ok: false, msg: 'Seleccione una salida.' };
      if (daysFromToday(d.date) < p.advMin) return { ok: false, msg: 'La salida del ' + date(d.date) + ' no cumple la anticipación mínima de ' + p.advMin + ' días para compras en línea.' };
      if (depFree(d) < paxN) return { ok: false, msg: 'Sin disponibilidad: la salida tiene ' + depFree(d) + ' cupos y su compra requiere ' + paxN + '. Regla transversal 4: no se confirma sin disponibilidad.' };
      return { ok: true, dep: d, date: d.date };
    }
    if (!c.date) return { ok: false, msg: 'Seleccione la fecha de inicio.' };
    const dd = daysFromToday(c.date);
    if (dd < p.advMin) return { ok: false, msg: 'La fecha debe tener al menos ' + p.advMin + ' días de anticipación.' };
    if (dd > p.advMax) return { ok: false, msg: 'Fecha fuera del rango de venta (máx. ' + p.advMax + ' días).' };
    return { ok: true, dep: null, date: c.date, onRequest: true };
  }
  function paxBlock(p, c, k) {
    const q = (key, label, sub, val, dis) => '<div class="row between" style="padding:6px 0"><div><b class="small">' + label + '</b><div class="xs faint">' + sub + '</div></div><div class="qty"><button type="button" data-q="' + key + '" data-d="-1" aria-label="Menos">−</button><b>' + val + '</b><button type="button" data-q="' + key + '" data-d="1" aria-label="Más"' + (dis ? ' disabled' : '') + '>+</button></div></div>';
    return q('adt', 'Adultos', '12 años a más', c.adt) + (k.hasChild ? q('chd', 'Niños', p.minAge > 2 ? p.minAge + ' a 11 años' : '2 a 11 años', c.chd) : '') + '<div class="xs faint">Grupo permitido: ' + p.minPax + ' a ' + p.maxPax + ' pasajeros.</div>';
  }
  function optBlock(p, c) {
    if (!(p.config || []).length) return '<div class="small muted">Este producto no tiene opciones de personalización.</div>';
    return p.config.map((g, gi) => '<div style="margin-bottom:10px"><div class="upper" style="margin-bottom:6px">' + esc(g.group) + '</div><div class="opt-row">' + g.options.map((o, oi) => '<button type="button" class="opt' + ((c.opts[gi] != null ? c.opts[gi] : defIdx(g)) === oi ? ' on' : '') + '" data-opt="' + gi + ':' + oi + '"><b>' + esc(o.label) + '</b><small>' + (o.delta === 0 ? 'Incluido' : (o.delta > 0 ? '+' : '−') + ' ' + money(Math.abs(o.delta), webRate(p).currency, 0) + ' p/p') + '</small></button>').join('') + '</div></div>').join('');
  }
  function depBlock(p, c) {
    if ((p.departures || []).length) {
      const deps = p.departures.filter(d => daysFromToday(d.date) >= 0);
      return '<div class="opt-row">' + deps.map(d => { const free = depFree(d), soon = daysFromToday(d.date) < p.advMin; const dis = !free || soon; return '<button type="button" class="opt' + (c.depId === d.id ? ' on' : '') + '" data-dep="' + d.id + '"' + (dis ? ' disabled' : '') + '><b>' + dateShort(d.date) + ' · ' + esc(d.time) + '</b><small>' + (soon ? 'Venta cerrada' : free ? free + ' cupos' : 'Agotado') + '</small></button>'; }).join('') + '</div><div class="xs faint" style="margin-top:6px">Salidas regulares con cupo controlado. Punto de encuentro: ' + esc((p.departures[0] || {}).meeting || '—') + '.</div>';
    }
    return '<div class="field"><label for="ck-date">Fecha de inicio</label><input class="input" type="date" id="ck-date" value="' + esc(c.date || '') + '" min="' + addDays(T(), p.advMin) + '" max="' + addDays(T(), p.advMax) + '"></div><div class="xs faint" style="margin-top:6px">Disponibilidad sujeta a confirmación del hotel/proveedor en máximo 24 h (modelo ' + esc(p.availabilityModel) + ').</div>';
  }
  function priceLines(k, c, withPromoInput) {
    const p = k.p;
    return '<div class="stat-line"><span>' + c.adt + ' adulto' + (c.adt > 1 ? 's' : '') + ' × ' + money(k.adtU, k.cur) + '</span><span class="num">' + money(k.adtU * c.adt, k.cur) + '</span></div>' +
      (c.chd ? '<div class="stat-line"><span>' + c.chd + ' niño' + (c.chd > 1 ? 's' : '') + ' × ' + money(k.chdU, k.cur) + '</span><span class="num">' + money(k.chdU * c.chd, k.cur) + '</span></div>' : '') +
      (k.deltaPP ? '<div class="stat-line"><span class="muted xs">Incluye personalización: ' + k.opts.filter(o => o.opt.delta).map(o => esc(o.opt.label)).join(', ') + ' (' + (k.deltaPP > 0 ? '+' : '−') + money(Math.abs(k.deltaPP), k.cur) + ' p/p)</span><span></span></div>' : '') +
      (k.disc ? '<div class="stat-line"><span class="ok">' + esc(k.discLbl) + '</span><span class="num ok">− ' + money(k.disc, k.cur) + '</span></div>' : '') +
      (withPromoInput ? '<div class="row" style="padding:8px 0;flex-wrap:nowrap"><input class="input sm" id="ck-promo" placeholder="Código promocional" value="' + esc(c.promo) + '" style="text-transform:uppercase"><button type="button" class="btn sm" id="ck-promo-ap">Aplicar</button></div>' + (k.promoState === 'bad' ? '<div class="xs bad">Código no válido para este producto o fuera de vigencia.</div>' : k.promoState === 'grp' ? '<div class="xs warn">Se aplica el mayor descuento disponible (no acumulable).</div>' : '') : '') +
      '<div class="stat-line total"><span>Total</span><span class="num">' + money(k.total, k.cur) + '</span></div><div class="xs faint">Precio final por la compra en ' + k.cur + '. Cálculo validado por el motor de precios del backend (PROC-018).' + (p.id && activePromos(p).length ? '' : '') + '</div>';
  }
  function bindCart(root, c, rerender) {
    const p = Q.product(c.pid);
    root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const k = b.dataset.q, d = +b.dataset.d; const nv = c[k] + d; if (k === 'adt' && nv < 1) return; if (nv < 0) return; if (c.adt + c.chd + d > p.maxPax) { UI.toast('Máximo ' + p.maxPax + ' pasajeros por compra.', 'warn'); return; } c[k] = nv; rerender(); });
    root.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { const [g, o] = b.dataset.opt.split(':').map(Number); c.opts[g] = o; rerender(); });
    root.querySelectorAll('[data-dep]').forEach(b => b.onclick = () => { c.depId = b.dataset.dep; rerender(); });
    const di = root.querySelector('#ck-date'); if (di) di.onchange = () => { c.date = di.value; rerender(); };
    const pa = root.querySelector('#ck-promo-ap'); if (pa) pa.onclick = () => { c.promo = root.querySelector('#ck-promo').value.trim().toUpperCase(); const k = calcCart(c); rerender(); if (c.promo) UI.toast(k.promoState === 'bad' ? 'Código no válido o fuera de vigencia.' : 'Código ' + esc(c.promo) + ' aplicado.', k.promoState === 'bad' ? 'bad' : 'ok'); };
  }

  App.register('canales/ecommerce', (el, params) => {
    const canManage = Auth.can('channels.ecommerce.manage');
    const view = params[0] === 'tienda' || !canManage ? 'tienda' : 'gestion';
    el.innerHTML = '<div class="page chv-page">' + UI.pageHeader({ title: 'E-commerce', subtitle: 'PROC-054: Catálogo → Selección → Configuración → Disponibilidad → Precio → Checkout → Pago → Reserva → Confirmación → Voucher.', crumbs: [['Inicio', '#/dashboard'], ['Canales'], ['E-commerce']], actions: view === 'gestion' ? '<a class="btn" href="#/canales/ecommerce/tienda">' + ic('eye') + 'Ver tienda pública</a>' : '' }) +
      linkTabs([['gestion', 'Gestión del canal', '#/canales/ecommerce/gestion', DB.ecomOrders.length], ['tienda', 'Tienda (vista pública)', '#/canales/ecommerce/tienda']].filter(t => canManage || t[0] === 'tienda'), view) + '<div id="ec-v"></div></div>';
    const v = el.querySelector('#ec-v');
    if (view === 'gestion') ecomAdmin(v);
    else if (params[1] === 'producto' && params[2]) storeProduct(v, params[2]);
    else if (params[1] === 'checkout') storeCheckout(v);
    else storeCatalog(v);
  });

  function ecomAdmin(v) {
    const o = DB.ecomOrders; const ok = o.filter(x => x.status === 'confirmado'); const rej = o.filter(x => x.status === 'pago_rechazado');
    const sessions = 3480 + o.length * 11, views = 1920 + o.length * 7, starts = 212 + o.length * 2, tries = sum(o, x => (x.attempts || []).length || 1);
    v.innerHTML = '<div class="stack"><div class="grid g5">' +
      UI.kpi({ label: 'Pedidos web', value: o.length, sub: 'Setiembre 2026', tone: 'accent', icon: 'cart' }) +
      UI.kpi({ label: 'Confirmados', value: ok.length, sub: fmtN(o.length ? ok.length / o.length * 100 : 0, 0) + '% de los pedidos', tone: 'ok', icon: 'checkCircle' }) +
      UI.kpi({ label: 'Ingresos confirmados', value: money(sum(ok, x => toPEN(x.total, x.currency)), 'PEN', 0), sub: 'Consolidado en soles', tone: 'violet', icon: 'coins' }) +
      UI.kpi({ label: 'Conversión', value: fmtN(ok.length / sessions * 100, 2) + '%', sub: 'Sesiones → compra', tone: 'info', icon: 'trending' }) +
      UI.kpi({ label: 'Pagos rechazados', value: rej.length, sub: 'Recuperables con reintento', tone: rej.length ? 'bad' : 'ok', icon: 'alert' }) + '</div>' +
      '<div class="grid g-2-1"><div id="ec-tabs"></div>' +
      UI.card('Embudo de conversión', UI.chart.hbars({ items: [{ label: 'Sesiones', value: sessions, color: 'var(--info)' }, { label: 'Vistas de producto', value: views, color: 'var(--accent)' }, { label: 'Inicio de checkout', value: starts, color: 'var(--violet)' }, { label: 'Intentos de pago', value: tries, color: 'var(--sun)' }, { label: 'Pedidos confirmados', value: ok.length, color: 'var(--ok)' }], fmt: x => fmtN(x, 0) }) + '<p class="xs faint" style="margin-top:12px">Sesiones y vistas provienen de la analítica web (simulada en la demo). Pedidos e intentos de pago son datos reales del sistema.</p>', { sub: 'Últimos 30 días' }) + '</div></div>';
    UI.tabs(v.querySelector('#ec-tabs'), [
      { id: 'ped', label: 'Pedidos web', count: o.length, render: (b) => ecomOrders(b) },
      { id: 'pub', label: 'Productos publicados', count: DB.products.filter(p => p.flags.ecommerce).length, render: (b) => ecomProducts(b) },
      { id: 'promo', label: 'Promociones y códigos', count: DB.products.reduce((a, p) => a + (p.promotions || []).length, 0), render: (b) => ecomPromos(b) }
    ]);
  }
  function ecomOrders(b) {
    UI.dataTable(b, {
      exportName: 'pedidos_web', rows: () => DB.ecomOrders, search: ['id', 'customer', 'email'], searchPlaceholder: 'Buscar pedido o cliente…',
      filters: [{ label: 'Estado', key: 'status', options: ['confirmado', 'pago_pendiente', 'pago_rechazado', 'cancelado'] }], defaultSort: 'date', defaultDir: -1, pageSize: 8,
      columns: [
        { key: 'id', label: 'Pedido', render: x => '<span class="mono">' + esc(x.id) + '</span><div class="cell-sub">' + datetime(x.date) + '</div>' },
        { key: 'customer', label: 'Cliente', render: x => '<div class="cell-main">' + esc(x.customer) + '</div>' + (x.email ? '<div class="cell-sub">' + esc(x.email) + '</div>' : '') },
        { key: 'product', label: 'Producto', render: x => esc(Q.productName(x.product)) + '<div class="cell-sub">' + x.pax + ' pax' + (x.promo ? ' · ' + esc(x.promo) : '') + '</div>' },
        { key: 'total', label: 'Total', align: 'num', render: x => money(x.total, x.currency) },
        { key: 'status', label: 'Estado', render: x => UI.badge(x.status) },
        { key: 'resId', label: 'Reserva', render: x => x.resId ? '<a class="mono" href="#/reservas/' + x.resId + '">' + esc(x.resId) + '</a>' : '<span class="faint">—</span>' }
      ],
      onRow: x => orderDrawer(x)
    });
  }
  function orderDrawer(x) {
    const r = x.resId ? Q.reservation(x.resId) : null;
    const canAct = ['pago_rechazado', 'pago_pendiente'].includes(x.status);
    UI.drawer({ title: 'Pedido ' + x.id, sub: datetime(x.date) + ' · ' + UI.statusLabel(x.status),
      body: '<div class="stack">' + (x.status === 'pago_rechazado' ? UI.alert('bad', '<b>Pago rechazado.</b> La obligación se mantiene y los cupos siguen retenidos. El cliente puede reintentar o se le puede enviar un nuevo enlace de pago (Excepción: pago rechazado).') : '') +
        UI.dl([['Cliente', esc(x.customer)], ['Correo', esc(x.email || '—')], ['Producto', esc(Q.productName(x.product))], ['Pasajeros', x.pax], ['Salida / fecha', x.depId ? esc(x.depId) : '—'], ['Código promocional', esc(x.promo || '—')], ['Total', money(x.total, x.currency)], ['Reserva', r ? '<a href="#/reservas/' + r.id + '">' + esc(r.id) + '</a> ' + UI.badge(r.status) : '—']]) +
        '<div><div class="upper" style="margin-bottom:8px">Intentos de pago</div>' + UI.timeline((x.attempts || []).slice().reverse().map(a => ({ title: (a.result === 'ok' ? 'Pago aprobado' : 'Pago rechazado') + ' · tarjeta ' + esc(a.card), meta: datetime(a.ts), desc: esc(a.msg || ''), icon: a.result === 'ok' ? 'check' : 'x' }))) + '</div></div>',
      actions: (canAct && Auth.can('channels.ecommerce.manage') ? [{ label: 'Enviar enlace de pago', icon: 'send', onClick: () => { Notify.push('pago.enlace', 'Email', x.email || x.customer, 'Complete el pago de su pedido ' + x.id); Audit.log('Pedido web', x.id, 'enviar_enlace_pago', x.status, x.status); UI.toast('Enlace de pago enviado a ' + esc(x.email || x.customer) + '.'); } },
        { label: 'Anular pedido', icon: 'x', cls: 'danger', onClick: () => { setTimeout(() => UI.confirm({ title: 'Anular pedido ' + x.id, message: 'Se liberarán los cupos retenidos y se cancelará la reserva vinculada. La obligación de cobro quedará cancelada.', reason: true, danger: true, confirmLabel: 'Anular', onConfirm: (why) => {
          const before = x.status; x.status = 'cancelado';
          if (r && r.status !== 'cancelada') { releaseDep(r); r.status = 'cancelada'; r.cancelReason = why; r.services.forEach(s => s.status = 'cancelado'); DB.receivables.filter(c => c.resId === r.id && c.paid === 0).forEach(c => c.status = 'cancelada'); Audit.log('Reserva', r.id, 'cancelar', 'pendiente_pago', 'cancelada · ' + why); }
          Store.save(); Audit.log('Pedido web', x.id, 'anular', before, 'cancelado · ' + why); UI.toast('Pedido anulado y cupos liberados.'); App.render();
        } }), 0); } }] : []).concat([{ label: 'Cerrar', cls: 'primary' }]) });
  }
  function ecomProducts(b) {
    UI.dataTable(b, {
      exportName: 'productos_ecommerce', rows: () => DB.products, search: ['name', 'code'], pageSize: 10,
      filters: [{ label: 'Publicación', options: [['1', 'Publicados'], ['0', 'No publicados']], match: (p, val) => !!p.flags.ecommerce === (val === '1') }],
      columns: [
        { key: 'name', label: 'Producto', render: p => '<div class="cell-main">' + esc(p.name) + '</div><div class="cell-sub">/tours/' + esc(p.seo && p.seo.slug || '—') + '</div>' },
        { key: 'status', label: 'Estado', render: p => UI.badge(p.status) },
        { key: 'price', label: 'Precio web', align: 'num', sort: false, render: p => { const r = webRate(p); return r ? money(r.price, r.currency) + (r.channel === 'E-commerce' ? '<div class="cell-sub">tarifa web</div>' : '') : '—'; } },
        { key: 'promo', label: 'Promoción', sort: false, render: p => activePromos(p).map(x => '<span class="tag">' + esc(x.code || x.name) + ' −' + x.value + '%</span>').join(' ') || '<span class="faint">—</span>' },
        { key: 'pub', label: 'Publicado', sort: false, render: p => '<label class="switch"><input type="checkbox" data-pub="' + p.id + '"' + (p.flags.ecommerce ? ' checked' : '') + (Auth.can('channels.ecommerce.manage') ? '' : cant('channels.ecommerce.manage')) + ' aria-label="Publicar ' + esc(p.name) + '"></label>' }
      ],
      afterDraw: (c) => c.querySelectorAll('[data-pub]').forEach(i => i.onchange = () => {
        const p = Q.product(i.dataset.pub);
        if (!Auth.can('channels.ecommerce.manage')) { i.checked = !i.checked; UI.toast('Requiere permiso channels.ecommerce.manage.', 'bad'); return; }
        if (i.checked && p.status !== 'ACTIVE') { i.checked = false; UI.toast('Solo productos en estado ACTIVE pueden publicarse en e-commerce (Regla transversal 18: los canales no duplican reglas core). Estado actual: ' + UI.statusLabel(p.status) + '.', 'bad'); return; }
        if (i.checked && !webRate(p)) { i.checked = false; UI.toast('El producto no tiene tarifa vigente: no puede publicarse.', 'bad'); return; }
        p.flags.ecommerce = i.checked; p.channels = p.channels || {}; p.channels.ecommerce = i.checked;
        Store.save(); Audit.log('Producto', p.id, i.checked ? 'publicar_ecommerce' : 'despublicar_ecommerce', String(!i.checked), String(i.checked));
        UI.toast(esc(p.name) + (i.checked ? ' publicado en la tienda.' : ' retirado de la tienda.'));
      })
    });
  }
  function ecomPromos(b) {
    const rows = () => DB.products.flatMap(p => (p.promotions || []).map(x => ({ ...x, pid: p.id, pname: p.name })));
    UI.dataTable(b, {
      exportName: 'promociones', rows, search: ['name', 'code', 'pname'], pageSize: 10,
      toolbar: '<button class="btn sm primary" id="pr-new"' + (Auth.can('channels.ecommerce.manage') ? '' : cant('channels.ecommerce.manage')) + '>' + ic('plus') + 'Nueva promoción</button>',
      columns: [
        { key: 'name', label: 'Promoción', render: x => '<div class="cell-main">' + esc(x.name) + '</div><div class="cell-sub">' + esc(x.pname) + '</div>' },
        { key: 'code', label: 'Código', render: x => x.code ? '<span class="mono">' + esc(x.code) + '</span>' : '<span class="faint small">Automática</span>' },
        { key: 'value', label: 'Descuento', align: 'num', render: x => x.value + '%' },
        { key: 'channel', label: 'Canal' },
        { key: 'from', label: 'Vigencia', render: x => '<span class="small">' + date(x.from) + ' — ' + date(x.to) + '</span>' },
        { key: 'status', label: 'Estado', render: x => UI.badge(x.to < T() ? 'vencida' : x.status) },
        { key: 'act', label: '', sort: false, render: x => '<button class="btn xs" data-pt="' + x.pid + '|' + x.id + '"' + (Auth.can('channels.ecommerce.manage') ? '' : cant('channels.ecommerce.manage')) + '>' + (x.status === 'activa' ? 'Desactivar' : 'Activar') + '</button>' }
      ],
      afterDraw: (c) => c.querySelectorAll('[data-pt]').forEach(bt => bt.onclick = () => { if (!Auth.can('channels.ecommerce.manage')) return; const [pid, id] = bt.dataset.pt.split('|'); const pr = Q.product(pid).promotions.find(y => y.id === id); const bf = pr.status; pr.status = pr.status === 'activa' ? 'inactiva' : 'activa'; Store.save(); Audit.log('Promoción', id, 'cambio_estado', bf, pr.status); UI.toast('Promoción ' + esc(pr.name) + ': ' + pr.status + '.'); App.render(); })
    });
    b.querySelector('#pr-new').onclick = () => Auth.can('channels.ecommerce.manage') && UI.modal({ title: 'Nueva promoción', body: UI.form([
      { id: 'pn_p', label: 'Producto', type: 'select', options: DB.products.filter(p => p.status === 'ACTIVE').map(p => [p.id, p.name]), col: 12 },
      { id: 'pn_name', label: 'Nombre', required: true, col: 8, placeholder: 'Ej.: Cyber Andes' }, { id: 'pn_code', label: 'Código', col: 4, placeholder: 'Vacío = automática' },
      { id: 'pn_val', label: 'Descuento %', type: 'number', min: 1, max: 50, value: 10, required: true, col: 4 },
      { id: 'pn_from', label: 'Desde', type: 'date', value: T(), required: true, col: 4 }, { id: 'pn_to', label: 'Hasta', type: 'date', value: addDays(T(), 30), required: true, col: 4 },
      { id: 'pn_ch', label: 'Canal', type: 'select', options: ['E-commerce', 'Todos'], col: 6 }
    ]), actions: [{ label: 'Cancelar' }, { label: 'Crear promoción', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const f = UI.formData(m);
      if (f.pn_to < f.pn_from) { UI.toast('Rango de vigencia inválido.', 'bad'); return false; }
      const code = (f.pn_code || '').toUpperCase().replace(/\s+/g, '');
      if (code && DB.products.some(p => (p.promotions || []).some(x => x.code === code))) { UI.toast('El código ' + esc(code) + ' ya existe.', 'bad'); return false; }
      const p = Q.product(f.pn_p); p.promotions = p.promotions || [];
      const id = nextId(DB.products.flatMap(x => x.promotions || []), 'PROMO-', 2);
      p.promotions.push({ id, name: f.pn_name, kind: code ? 'Descuento %' : 'Descuento por cantidad', value: Number(f.pn_val), from: f.pn_from, to: f.pn_to, channel: f.pn_ch, code, status: 'activa' });
      Store.save(); Audit.log('Promoción', id, 'crear', '', f.pn_name + ' ' + f.pn_val + '%'); UI.toast('Promoción ' + id + ' creada.'); App.render();
    } }] });
  }

  /* ---- Tienda pública ---- */
  function storeFrame(active, body) {
    const nav = [{ id: 'cat', label: 'Tours y paquetes', href: '#/canales/ecommerce/tienda' }, { id: 'dest', label: 'Destinos', href: '#/canales/ecommerce/tienda' }].concat(cart ? [{ id: 'ck', label: 'Mi compra', href: '#/canales/ecommerce/tienda/checkout', count: cart.step < 6 ? 1 : 0 }] : []);
    return '<div class="stack">' + chBar('Tienda online', 'Experiencia pública del visitante web (andeshorizonte.pe)') + shell({ sub: 'Tienda online', nav, active, user: '<span class="small muted">' + ic('phoneCall') + '</span><div class="pt-uname"><b>01 640 2210</b><span>Asesoría de lunes a sábado</span></div>', body }) + '</div>';
  }
  function storeCatalog(v) {
    const prods = () => DB.products.filter(p => p.status === 'ACTIVE' && p.flags.ecommerce && webRate(p));
    const cats = [...new Set(prods().map(p => p.category))];
    v.innerHTML = storeFrame('cat', '<div class="row between" style="align-items:flex-end"><div><h2>Tours y paquetes en Perú</h2><div class="small muted">Reserva en línea con confirmación inmediata y voucher digital. Precios finales por persona.</div></div>' +
      '<div class="row"><div class="search-in" style="width:240px;max-width:100%">' + ic('search') + '<input class="input sm" id="st-q" type="search" placeholder="Buscar destino o tour…" value="' + esc(storeF.q) + '" aria-label="Buscar"></div><select class="input sm" id="st-cat" style="width:auto" aria-label="Categoría"><option value="">Todas las categorías</option>' + cats.map(c => '<option' + (storeF.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select><select class="input sm" id="st-sort" style="width:auto" aria-label="Orden"><option value="rel">Destacados</option><option value="asc"' + (storeF.sort === 'asc' ? ' selected' : '') + '>Precio: menor a mayor</option><option value="desc"' + (storeF.sort === 'desc' ? ' selected' : '') + '>Precio: mayor a menor</option></select></div></div>' +
      (DB.cms.find(c => c.id === 'CMS-02' && c.status === 'publicado') ? UI.alert('info', '<b>Primavera Andina:</b> use el código <span class="mono">PRIMAVERA8</span> en Machu Picchu Full Day y obtenga 8% de descuento hasta el 31 de octubre. Laguna Humantay a precio web.', 'tag') : '') +
      '<div class="st-grid" id="st-grid"></div>');
    const draw = () => {
      let list = prods().filter(p => (!storeF.q || (p.name + ' ' + Q.destPath(p.destId) + ' ' + p.short).toLowerCase().includes(storeF.q.toLowerCase())) && (!storeF.cat || p.category === storeF.cat));
      if (storeF.sort === 'asc') list.sort((a, b) => toPEN(webRate(a).price, webRate(a).currency) - toPEN(webRate(b).price, webRate(b).currency));
      else if (storeF.sort === 'desc') list.sort((a, b) => toPEN(webRate(b).price, webRate(b).currency) - toPEN(webRate(a).price, webRate(a).currency));
      else list.sort((a, b) => (b.flags.featured ? 1 : 0) - (a.flags.featured ? 1 : 0));
      v.querySelector('#st-grid').innerHTML = list.length ? list.map(p => { const r = webRate(p), pub = publicRate(p), pr = activePromos(p); return '<div class="st-card click" data-p="' + p.id + '" tabindex="0" role="link" aria-label="' + esc(p.name) + '">' + UI.thumb(p) + '<div class="st-card-b"><div class="row between"><span class="xs faint">' + esc(Q.destName(p.destId)) + ' · ' + esc(durLabel(p)) + '</span>' + (p.flags.featured ? UI.badge('activa', 'Destacado') : '') + '</div><b>' + esc(p.name) + '</b><div class="small muted">' + esc(p.short) + '</div>' + (pr.length ? '<div class="chip-row">' + pr.map(x => '<span class="tag">' + ic('tag') + esc(x.code ? x.code + ' −' + x.value + '%' : x.name + ' −' + x.value + '%') + '</span>').join('') + '</div>' : '') + '</div><div class="st-card-f"><div><span class="xs faint">Desde</span> ' + (pub && r.channel === 'E-commerce' && pub.price > r.price ? '<span class="st-old">' + money(pub.price, pub.currency, 0) + '</span> ' : '') + '<span class="st-price">' + money(r.price, r.currency, 0) + '</span></div><span class="btn sm primary">Ver detalle</span></div></div>'; }).join('') : UI.empty('No encontramos tours con esos filtros.', 'search');
      v.querySelectorAll('[data-p]').forEach(c => { c.onclick = () => App.go('#/canales/ecommerce/tienda/producto/' + c.dataset.p); c.onkeydown = (e) => { if (e.key === 'Enter') c.click(); }; });
    };
    draw();
    v.querySelector('#st-q').addEventListener('input', Util.debounce(e => { storeF.q = e.target.value.trim(); draw(); }, 150));
    v.querySelector('#st-cat').onchange = (e) => { storeF.cat = e.target.value; draw(); };
    v.querySelector('#st-sort').onchange = (e) => { storeF.sort = e.target.value; draw(); };
  }
  function storeProduct(v, pid) {
    const p = Q.product(pid);
    if (!p || p.status !== 'ACTIVE' || !p.flags.ecommerce) { v.innerHTML = storeFrame('cat', UI.card('', UI.empty('Este producto no está disponible para la venta en línea.', 'box') + '<div class="center" style="padding-bottom:16px"><a class="btn" href="#/canales/ecommerce/tienda">Volver al catálogo</a></div>')); return; }
    const c = (cart && cart.pid === pid && cart.step < 6) ? cart : newCart(pid);
    const shots = [[p.name, p.hue], ['Recorrido', (p.hue + 24) % 360], ['Experiencia', (p.hue + 336) % 360], [Q.destName(p.destId), (p.hue + 48) % 360]];
    const pol = p.policies || {};
    v.innerHTML = storeFrame('cat', '<div class="crumbs"><a href="#/canales/ecommerce/tienda">Tours y paquetes</a><span>/</span><span>' + esc(Q.destPath(p.destId)) + '</span></div>' +
      '<div class="grid g-2-1" style="align-items:start"><div class="stack">' +
      '<div><div class="gal-main" id="gal-main">' + UI.thumb({ name: shots[0][0], hue: shots[0][1] }) + '</div><div class="gal">' + shots.map((s, i) => '<button type="button" class="' + (i === 0 ? 'on' : '') + '" data-g="' + i + '" aria-label="Imagen ' + (i + 1) + '">' + UI.thumb({ name: s[0], hue: s[1] }) + '</button>').join('') + '</div></div>' +
      '<div><div class="chip-row" style="margin-bottom:8px"><span class="tag">' + esc(p.type) + '</span><span class="tag">' + esc(p.category) + ' · ' + esc(p.subcategory) + '</span><span class="tag">' + ic('clock') + esc(durLabel(p)) + '</span><span class="tag">' + esc(p.modality) + '</span></div><h2 style="font-size:1.45rem">' + esc(p.name) + '</h2><p class="muted" style="margin-top:8px">' + esc(p.long || p.short) + '</p></div>' +
      UI.card('Qué incluye', '<div class="grid g2"><div><div class="upper" style="margin-bottom:8px">Incluye</div><ul class="ck-list yes">' + (p.inclusions || []).map(x => '<li>' + ic('check') + esc(x) + '</li>').join('') + '</ul></div><div><div class="upper" style="margin-bottom:8px">No incluye</div><ul class="ck-list no">' + (p.exclusions || []).map(x => '<li>' + ic('x') + esc(x) + '</li>').join('') + '</ul></div></div>') +
      ((p.itinerary || []).length ? UI.card('Itinerario', p.itinerary.map(d => '<div style="margin-bottom:12px"><h4 style="margin-bottom:8px">Día ' + d.day + ' · ' + esc(d.title) + '</h4>' + (d.items.length ? UI.timeline(d.items.map(it => ({ title: esc(it.activity), meta: esc(it.time) + ' · ' + esc(it.location), icon: { Tren: 'train', Transporte: 'truck', Guía: 'compass', Alimentación: 'heart', Hotel: 'bed', Traslado: 'truck' }[it.type] || 'pin' }))) : '<div class="small faint">Detalle a confirmar con su asesor.</div>') + '</div>').join('')) : '') +
      ((p.requirements || []).length ? UI.card('Recomendaciones y requisitos', '<ul class="ck-list">' + p.requirements.map(x => '<li>' + ic('info') + esc(x) + '</li>').join('') + '</ul>') : '') +
      UI.card('Políticas', UI.dl([['Cancelación', esc(pol.cancel)], ['Cambios', esc(pol.modify)], ['No-show', esc(pol.noshow)], ['Reembolsos', esc(pol.refund)], ['Anticipación', 'Mínimo ' + p.advMin + ' días · máximo ' + p.advMax + ' días']])) +
      UI.card('Preguntas frecuentes', '<div class="faq">' + ((p.faqs || []).concat([{ q: '¿Cuándo recibo mi voucher?', a: 'Inmediatamente después de aprobado el pago, si la salida tiene cupo confirmado. En productos bajo solicitud, al confirmar el proveedor (máx. 24 h).' }, { q: '¿Puedo pagar en soles?', a: 'Sí. El cargo se realiza en la moneda del producto y su banco aplica el tipo de cambio.' }])).map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</div>') +
      '</div><div class="sticky-side" id="cfg"></div></div>');
    v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const s = shots[+b.dataset.g]; v.querySelector('#gal-main').innerHTML = UI.thumb({ name: s[0], hue: s[1] }); v.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); });
    const box = v.querySelector('#cfg');
    const draw = () => {
      const k = calcCart(c); const av = cartAvail(c);
      box.innerHTML = UI.card('Arma tu reserva', '<div class="stack" style="gap:14px"><div><span class="xs faint">Desde</span> ' + (k.isWeb && k.pubPrice > k.base ? '<span class="st-old">' + money(k.pubPrice, k.cur) + '</span> ' : '') + '<span class="st-price">' + money(k.base, k.cur) + '</span> <span class="xs faint">por adulto' + (k.isWeb ? ' · precio web' : '') + '</span></div>' +
        '<div><div class="upper" style="margin-bottom:6px">' + ((p.departures || []).length ? 'Salida' : 'Fecha') + '</div>' + depBlock(p, c) + '</div>' +
        '<div><div class="upper">Pasajeros</div>' + paxBlock(p, c, k) + '</div>' +
        ((p.config || []).length ? '<div>' + optBlock(p, c) + '</div>' : '') +
        '<div>' + priceLines(k, c, true) + '</div>' + (!av.ok ? UI.alert('warn', esc(av.msg)) : '') +
        '<button class="btn primary" id="buy" style="height:40px;justify-content:center">' + ic('cart') + 'Reservar ahora</button><div class="xs faint center">Pago seguro · Confirmación inmediata · Atención 24/7 durante el viaje</div></div>');
      bindCart(box, c, draw);
      box.querySelector('#buy').onclick = () => { const a = cartAvail(c); if (!a.ok) { UI.toast(esc(a.msg), 'bad'); return; } c.step = 0; cart = c; App.go('#/canales/ecommerce/tienda/checkout'); };
    };
    draw();
  }
  function storeCheckout(v) {
    if (!cart) { v.innerHTML = storeFrame('ck', UI.card('', UI.empty('Su carrito está vacío.', 'cart') + '<div class="center" style="padding-bottom:16px"><a class="btn primary" href="#/canales/ecommerce/tienda">Ver tours</a></div>')); return; }
    const c = cart; const p = Q.product(c.pid);
    const rer = () => storeCheckout(v);
    const k = calcCart(c); const av = cartAvail(c);
    const order = c.orderId ? DB.ecomOrders.find(o => o.id === c.orderId) : null;
    const dep = av.dep;
    let body = '', next = '';
    switch (c.step) {
      case 0:
        body = UI.card('1. Selección', '<div class="row top" style="gap:16px;flex-wrap:wrap"><div style="width:220px;max-width:100%">' + UI.thumb(p) + '</div><div class="grow" style="min-width:220px"><h3>' + esc(p.name) + '</h3><div class="small muted" style="margin:4px 0 8px">' + esc(p.short) + '</div><div class="chip-row"><span class="tag">' + esc(Q.destPath(p.destId)) + '</span><span class="tag">' + esc(durLabel(p)) + '</span><span class="tag">' + esc(p.modality) + '</span></div><ul class="ck-list yes" style="margin-top:10px">' + (p.inclusions || []).slice(0, 5).map(x => '<li>' + ic('check') + esc(x) + '</li>').join('') + '</ul></div></div>', { footer: '<a class="btn ghost" href="#/canales/ecommerce/tienda">Cambiar de producto</a>' });
        break;
      case 1:
        body = UI.card('2. Configuración', '<div class="stack"><div><div class="upper">Pasajeros</div>' + paxBlock(p, c, k) + '</div><div>' + optBlock(p, c) + '</div></div>', { sub: 'Cada selección recalcula el precio mediante el backend (PRD — Personalización).' });
        break;
      case 2:
        body = UI.card('3. Disponibilidad', depBlock(p, c) + '<div style="margin-top:12px">' + (av.ok ? UI.alert('ok', av.onRequest ? 'Fecha válida. La confirmación del proveedor llegará en máximo 24 h; el cobro se realiza ahora y se reembolsa si no hay confirmación.' : '<b>Hay cupo.</b> Al continuar se retienen ' + k.paxN + ' cupos por ' + DB.settings.holdMinutes + ' minutos (hold) mientras completa la compra.') : UI.alert('bad', esc(av.msg))) + '</div>');
        break;
      case 3:
        body = UI.card('4. Precio', priceLines(k, c, true) + '<div class="xs faint" style="margin-top:8px">Promociones activas para este producto: ' + (activePromos(p).map(x => esc(x.code ? 'código ' + x.code : x.name + ' (automática desde 4 pax)') + ' −' + x.value + '%').join(', ') || 'ninguna') + '.</div>');
        break;
      case 4: {
        const b = c.buyer || {}; const pl = c.paxList || [];
        const extra = Array.from({ length: k.paxN - 1 }, (_, i) => i);
        body = UI.card('5. Datos del pasajero', UI.form([
          { type: 'section', label: 'Titular de la compra (pasajero 1)' },
          { id: 'bu_name', label: 'Nombres y apellidos', required: true, value: b.name || '', col: 6 },
          { id: 'bu_doctype', label: 'Documento', type: 'select', options: ['DNI', 'Pasaporte', 'Carné de extranjería'], value: b.doctype || 'DNI', col: 3 },
          { id: 'bu_doc', label: 'Número', required: true, value: b.doc || '', col: 3 },
          { id: 'bu_email', label: 'Correo electrónico', type: 'email', required: true, value: b.email || '', col: 6, hint: 'Aquí enviaremos la confirmación y el voucher.' },
          { id: 'bu_phone', label: 'Celular / WhatsApp', required: true, value: b.phone || '', col: 3 },
          { id: 'bu_country', label: 'País de residencia', type: 'select', options: ['Perú', 'Argentina', 'Brasil', 'Chile', 'Colombia', 'España', 'Estados Unidos', 'Alemania', 'Francia', 'Otro'], value: b.country || 'Perú', col: 3 }
        ].concat(extra.length ? [{ type: 'section', label: 'Acompañantes' }] : []).concat(extra.flatMap(i => [
          { id: 'px_n' + i, label: 'Pasajero ' + (i + 2) + (i + 1 >= c.adt ? ' (niño)' : ''), required: true, value: (pl[i] || {}).name || '', col: 8 },
          { id: 'px_d' + i, label: 'Documento', required: true, value: (pl[i] || {}).doc || '', col: 4 }
        ]))) + '<p class="xs faint" style="margin-top:12px">Los datos se usan para emitir entradas nominativas y el voucher. Tratamiento conforme a la Ley N.° 29733 de Protección de Datos Personales.</p>');
        break; }
      case 5: {
        const last = order && order.attempts && order.attempts[order.attempts.length - 1];
        body = (order && order.status === 'pago_rechazado' ? UI.alert('bad', '<b>Pago rechazado por el banco emisor</b> (' + esc(last ? last.msg : '') + '). Su pedido <b>' + esc(order.id) + '</b> y los cupos siguen reservados; puede reintentar con otra tarjeta.') : '') +
          UI.card('6. Pago', UI.form([
            { id: 'cd_num', label: 'Número de tarjeta', required: true, value: c.cardNum || '', placeholder: '0000 0000 0000 0000', col: 12 },
            { id: 'cd_name', label: 'Titular de la tarjeta', required: true, value: c.cardName || (c.buyer || {}).name || '', col: 6 },
            { id: 'cd_exp', label: 'Vencimiento', required: true, value: c.cardExp || '12/28', placeholder: 'MM/AA', col: 3 },
            { id: 'cd_cvv', label: 'CVV', required: true, type: 'password', value: c.cardCvv || '', placeholder: '•••', col: 3 }
          ]) + '<div style="margin-top:12px"><div class="upper" style="margin-bottom:6px">Tarjetas de prueba (pasarela sandbox)</div><div class="testcard"><button type="button" class="btn sm" data-card="4111 1111 1111 1111">4111 1111 1111 1111 · aprobada</button><button type="button" class="btn sm" data-card="4000 0000 0000 0002">4000 0000 0000 0002 · rechazada</button></div><p class="xs faint" style="margin-top:8px">Integración con pasarela por definir (INT-02). Confirmación por webhook con idempotencia.</p></div>', { sub: 'Total a pagar ' + money(k.total, k.cur) });
        break; }
      case 6: {
        const r = order && Q.reservation(order.resId); const vou = r && DB.vouchers.find(x => x.resId === r.id);
        body = UI.alert('ok', '<b>¡Compra confirmada!</b> Enviamos la confirmación a ' + esc((c.buyer || {}).email || '') + '.') +
          UI.card('7. Confirmación', UI.dl([['Pedido', '<span class="mono">' + esc(order.id) + '</span> ' + UI.badge(order.status)], ['Reserva', '<span class="mono">' + esc(r.id) + '</span> ' + UI.badge(r.status)], ['Producto', esc(p.name)], ['Fecha', date(r.travelFrom) + (r.services[0].time !== '—' ? ' · ' + esc(r.services[0].time) : '')], ['Pasajeros', r.passengers.map(x => esc(x.name)).join(', ')], ['Total pagado', money(order.total, order.currency)], ['Voucher', vou ? '<span class="mono">' + esc(vou.id) + '</span> ' + UI.badge(vou.status) : 'Se emitirá al confirmar el proveedor (Regla transversal 11)']]), {
            footer: (vou ? '<button class="btn" id="ck-vou">' + ic('ticket') + 'Ver voucher</button>' : '') + (Auth.can('reservations.view') ? '<a class="btn" href="#/reservas/' + r.id + '">' + ic('suitcase') + 'Ver reserva en el ERP</a>' : '') + (Auth.can('channels.ecommerce.manage') ? '<a class="btn" href="#/canales/ecommerce/gestion">Ver pedido en gestión</a>' : '') + '<button class="btn primary" id="ck-new">Seguir comprando</button>' });
        break; }
    }
    const side = UI.card('Resumen de compra', '<div class="row" style="gap:10px;flex-wrap:nowrap;margin-bottom:10px"><div style="width:84px;flex:none">' + UI.thumb({ name: '', hue: p.hue }, 54) + '</div><div class="grow"><b class="small">' + esc(p.name) + '</b><div class="xs faint">' + (dep ? date(dep.date) + ' · ' + esc(dep.time) : c.date ? date(c.date) : 'Fecha por elegir') + '</div></div></div>' + priceLines(k, c, false) + (order ? '<div class="xs faint" style="margin-top:8px">Pedido ' + esc(order.id) + ' · ' + esc(UI.statusLabel(order.status)) + '</div>' : ''));
    const nav = c.step < 6 ? '<div class="row between" style="margin-top:14px">' + (c.step > 0 ? '<button class="btn" id="ck-back">' + ic('chevronLeft') + 'Atrás</button>' : '<span></span>') + (c.step < 5 ? '<button class="btn primary" id="ck-next">Continuar' + ic('chevronRight') + '</button>' : '<button class="btn primary" id="ck-pay">' + ic('lock') + 'Pagar ' + money(k.total, k.cur) + '</button>') + '</div>' : '';
    v.innerHTML = storeFrame('ck', '<div class="card"><div class="card-b">' + UI.flow(CK_STEPS, c.step) + '</div></div><div class="grid g-2-1" style="align-items:start"><div>' + body + nav + '</div><div class="sticky-side">' + side + '</div></div>');
    bindCart(v, c, rer);
    const saveBuyer = () => { const f = UI.formData(v); c.buyer = { name: f.bu_name, doctype: f.bu_doctype, doc: f.bu_doc, email: f.bu_email, phone: f.bu_phone, country: f.bu_country }; c.paxList = Array.from({ length: k.paxN - 1 }, (_, i) => ({ name: f['px_n' + i], doc: f['px_d' + i] })); };
    v.querySelectorAll('[data-card]').forEach(b => b.onclick = () => { v.querySelector('#cd_num').value = b.dataset.card; if (!v.querySelector('#cd_cvv').value) v.querySelector('#cd_cvv').value = '123'; });
    const back = v.querySelector('#ck-back'); if (back) back.onclick = () => { if (c.step === 4) saveBuyer(); if (c.step === 5) { if (order) { UI.toast('El pedido ya fue registrado: complete el pago o anúlelo desde gestión.', 'info'); return; } } c.step--; rer(); };
    const nx = v.querySelector('#ck-next'); if (nx) nx.onclick = () => {
      if (c.step === 1 && (k.paxN < p.minPax || k.paxN > p.maxPax)) { UI.toast('Este producto requiere entre ' + p.minPax + ' y ' + p.maxPax + ' pasajeros.', 'bad'); return; }
      if (c.step === 2 && !av.ok) { UI.toast(esc(av.msg), 'bad'); return; }
      if (c.step === 3 && k.promoState === 'bad') { UI.toast('Retire o corrija el código promocional antes de continuar.', 'bad'); return; }
      if (c.step === 4) { if (!UI.validate(v)) return; saveBuyer(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c.buyer.email)) { UI.toast('Ingrese un correo válido.', 'bad'); return; } }
      c.step++; rer(); window.scrollTo(0, 0);
    };
    const pay = v.querySelector('#ck-pay'); if (pay) pay.onclick = () => {
      if (!UI.validate(v)) return;
      const f = UI.formData(v); c.cardNum = f.cd_num; c.cardName = f.cd_name; c.cardExp = f.cd_exp; c.cardCvv = f.cd_cvv;
      const a2 = cartAvail(c);
      if (!order && !a2.ok) { UI.toast(esc(a2.msg), 'bad'); c.step = 2; rer(); return; }
      checkoutPay(c, p, k, a2);
      rer(); window.scrollTo(0, 0);
    };
    const vb = v.querySelector('#ck-vou'); if (vb) vb.onclick = () => { const r = Q.reservation(order.resId); const x = DB.vouchers.find(y => y.resId === r.id); showDoc('Voucher ' + x.id, voucherDoc(x)); };
    const nb = v.querySelector('#ck-new'); if (nb) nb.onclick = () => { cart = null; App.go('#/canales/ecommerce/tienda'); };
  }
  function checkoutPay(c, p, k, av) {
    let order = c.orderId ? DB.ecomOrders.find(o => o.id === c.orderId) : null;
    const b = c.buyer;
    if (!order) {
      let cli = DB.clients.find(x => (x.email || '').toLowerCase() === b.email.toLowerCase());
      if (!cli) { cli = { id: nextId(DB.clients, 'CLI-', 4), kind: 'Persona', name: b.name, doc: b.doctype + ' ' + b.doc, email: b.email, phone: b.phone, country: b.country, city: '', segment: 'Retail', owner: 'U03', createdAt: T(), tags: ['Web', 'E-commerce'], nps: null }; DB.clients.push(cli); Audit.log('Cliente', cli.id, 'crear_desde_ecommerce', '', b.email); }
      const oid = nextId(DB.ecomOrders, 'WEB-', 5);
      const passengers = [{ name: b.name, doc: b.doctype + ' ' + b.doc, type: 'ADT', nationality: b.country, birth: '', phone: b.phone, diet: '' }].concat((c.paxList || []).map((x, i) => ({ name: x.name, doc: x.doc, type: i + 1 >= c.adt ? 'CHD' : 'ADT', nationality: b.country, birth: '', phone: '', diet: '' })));
      const r = createRes({ p, clientId: cli.id, title: b.name.split(' ').slice(0, 2).join(' ') + ' — ' + p.name + ' (web)', channel: 'E-commerce', status: 'pendiente_pago', cur: k.cur, total: k.total, cost: k.cost, owner: 'U03', date: av.date, dep: av.dep, pax: k.paxN, passengers, notes: 'Pedido web ' + oid + '. ' + (k.opts.length ? 'Configuración: ' + k.opts.map(o => o.group + ' ' + o.opt.label).join(', ') + '. ' : '') + (k.disc ? 'Descuento: ' + k.discLbl + '.' : ''), extra: { ecomOrderId: oid } });
      addReceivable({ resId: r.id, clientId: cli.id, concept: 'Pago e-commerce — pedido ' + oid, amount: k.total, currency: k.cur, due: T() });
      order = { id: oid, date: nowStr(), customer: b.name, email: b.email, product: p.id, pax: k.paxN, total: k.total, currency: k.cur, status: 'pago_pendiente', resId: r.id, depId: av.dep ? av.dep.id : null, promo: k.disc ? k.discLbl : '', attempts: [] };
      DB.ecomOrders.unshift(order); c.orderId = oid; c.resId = r.id;
      Audit.log('Pedido web', oid, 'crear', '', 'pago_pendiente · ' + money(k.total, k.cur));
      Audit.log('Reserva', r.id, 'crear_ecommerce', '', 'pendiente_pago');
      if (av.dep) Audit.log('Disponibilidad', av.dep.id, 'retener_cupos', '', k.paxN + ' cupos · pedido ' + oid);
    }
    const r = Q.reservation(order.resId);
    const rcv = DB.receivables.find(x => x.resId === r.id);
    const res = cardResult(c.cardNum); const last4 = String(c.cardNum).replace(/\D/g, '').slice(-4) || '0000';
    if (res !== 'ok') {
      const msg = res === 'rechazo' ? 'Fondos insuficientes (código 51)' : 'Tarjeta no reconocida por la pasarela sandbox';
      order.status = 'pago_rechazado'; order.attempts = order.attempts || []; order.attempts.push({ ts: nowStr(), card: '•••• ' + last4, result: 'rechazado', msg });
      addPayment({ receivableId: rcv ? rcv.id : null, resId: r.id, method: 'Tarjeta (e-commerce)', amount: order.total, currency: order.currency, status: 'rechazado', ref: 'Rechazo emisor · ' + msg, by: 'Sistema' });
      Store.save();
      Audit.log('Pedido web', order.id, 'pago_rechazado', 'pago_pendiente', 'pago_rechazado · •••• ' + last4);
      Notify.push('pago.rechazado', 'Email', order.email, 'No pudimos procesar el pago del pedido ' + order.id);
      UI.toast('Pago rechazado: ' + esc(msg) + '. La obligación se mantiene; puede reintentar.', 'bad');
      return;
    }
    order.attempts = order.attempts || []; order.attempts.push({ ts: nowStr(), card: '•••• ' + last4, result: 'ok', msg: 'Autorización ' + rnd(6) });
    const pay = addPayment({ receivableId: rcv ? rcv.id : null, resId: r.id, method: 'Tarjeta (e-commerce)', amount: order.total, currency: order.currency, status: 'aplicado', ref: 'TXN ' + rnd(4) + '-' + rnd(4), by: 'Sistema' });
    if (rcv) { rcv.paid = rcv.amount; rcv.status = 'pagada'; }
    const confirmed = !!order.depId;
    r.status = confirmed ? 'confirmada' : 'pendiente_proveedor';
    r.services.forEach(s => { s.status = confirmed ? 'confirmado' : 'solicitado'; if (confirmed) s.confirmationCode = 'AH-' + r.id.slice(-6); });
    order.status = 'confirmado';
    let vou = null; if (confirmed) vou = issueVoucher(r);
    Store.save();
    Audit.log('Pago', pay.id, 'aplicar', 'pendiente', 'aplicado · ' + money(order.total, order.currency));
    Audit.log('Reserva', r.id, 'cambio_estado', 'pendiente_pago', r.status);
    Notify.push('pago.recibido', 'Email', order.email, 'Pago confirmado — pedido ' + order.id);
    Notify.push('reserva.confirmada', 'Email', order.email, (confirmed ? 'Reserva confirmada ' : 'Reserva registrada ') + r.id + ' — ' + p.name);
    if (vou) { Notify.push('voucher.emitido', 'Email', order.email, 'Su voucher ' + vou.id); Audit.log('Voucher', vou.id, 'emitir', '', 'emitido v1 (e-commerce)'); }
    c.step = 6;
    UI.toast('Pago aprobado. Reserva ' + r.id + (vou ? ' y voucher ' + vou.id : '') + ' generados.');
  }

  /* =====================================================================================
     CMS — PROC-055
     ===================================================================================== */
  const CMS_BODY = {
    'CMS-01': '## Primavera en los Andes\nDe setiembre a noviembre Cusco ofrece días soleados, noches frescas y menos visitantes en Machu Picchu. Es la mejor época para combinar ciudad, Valle Sagrado y trekking.\n\n- Machu Picchu Full Day desde US$ 345\n- Laguna Humantay a S/ 129 con precio web\n- Cusco Mágico 5D/4N con hotel 4 estrellas\n\n## Reserve con confianza\nConfirmación inmediata, voucher digital y asistencia 24/7 durante su viaje.',
    'CMS-02': 'Laguna Humantay Full Day a S/ 129 por persona reservando en línea hasta el 31 de octubre. Incluye transporte turístico, desayuno, almuerzo campestre y guía oficial.',
    'CMS-03': '## 10 consejos para el mal de altura\nCusco se encuentra a 3 399 m s. n. m. La mayoría de viajeros se adapta en 24 a 48 horas siguiendo recomendaciones simples.\n\n- Descanse la tarde de llegada y evite esfuerzos intensos\n- Hidrátese: agua y mate de coca\n- Comidas ligeras la primera noche\n- Evite el alcohol las primeras 24 horas\n- Planifique Humantay o Vinicunca después del segundo día\n\nSi los síntomas persisten, comuníquese con nuestra central 24/7.',
    'CMS-04': '## Año Nuevo en Cusco 2027\nReciba el año en la Plaza de Armas con un programa de 5 días que incluye hotel 5 estrellas, cena de gala y Machu Picchu.\n\n- Salidas del 28 de diciembre\n- Cupos limitados por la temporada (factor Año Nuevo)',
    'CMS-05': '## Política de cancelaciones\nLas cancelaciones sin penalidad aplican hasta 15 días antes del inicio del servicio. Entre 14 y 7 días se retiene el 50%. Dentro de los 7 días o en caso de no-show se factura el 100%.\n\nLas entradas nominativas y boletos de tren emitidos no son reembolsables.',
    'CMS-06': 'Fiestas Patrias en el sur andino: paquetes a Arequipa y Colca con 10% de descuento. Vigente del 1 al 31 de julio.'
  };
  const CMS_FLOW = ['Contenido', 'Revisión', 'Aprobación', 'Publicación', 'Despublicación'];
  const cmsIdx = (s) => ({ borrador: 0, en_revision: 1, aprobado: 2, publicado: 3, despublicado: 4 })[s] || 0;
  const cmsBadge = (s) => s === 'aprobado' ? UI.badge('APPROVED', 'Aprobado') : UI.badge(s);
  const slugify = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  function mdLite(s) {
    const out = []; let list = false;
    String(s || '').split('\n').forEach(l => {
      const t = l.trim();
      if (/^- /.test(t)) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + esc(t.slice(2)) + '</li>'); return; }
      if (list) { out.push('</ul>'); list = false; }
      if (!t) return;
      if (/^## /.test(t)) out.push('<h3>' + esc(t.slice(3)) + '</h3>'); else out.push('<p>' + esc(t) + '</p>');
    });
    if (list) out.push('</ul>');
    return out.join('');
  }
  function cmsPreview(c) {
    const url = 'andeshorizonte.pe/' + (c.slug || slugify(c.title));
    UI.modal({ title: 'Vista previa · ' + esc(c.title), sub: 'Canal ' + esc(c.channel) + ' · ' + UI.statusLabel(c.status), size: 'lg', body: '<div class="stack"><div class="cms-prev"><div class="cms-prev-h"><div class="pt-logo"><div class="pt-mark" style="width:28px;height:28px">' + ic('logo') + '</div><b class="small">Andes Horizonte Travel</b></div><span class="xs faint mono">https://' + esc(url) + '</span></div><div class="cms-prev-b"><div class="upper">' + esc(c.type) + '</div><h2 style="margin:4px 0 12px">' + esc(c.title) + '</h2>' + mdLite(c.body) + '</div></div>' +
      '<div><div class="upper" style="margin-bottom:6px">Vista en buscadores (SEO)</div><div class="serp"><div class="u">' + esc(url) + '</div><div class="h">' + esc(c.seoTitle || c.title) + '</div><div class="d">' + esc(c.seoDesc || 'Sin meta descripción: se recomienda completarla (máx. 160 caracteres).') + '</div></div></div></div>', actions: [{ label: 'Cerrar', cls: 'primary' }] });
  }
  App.register('canales/cms', (el, params) => {
    const canPub = Auth.can('channels.cms.publish');
    DB.cms.forEach(c => { if (c.body == null) c.body = CMS_BODY[c.id] || ''; if (c.slug == null) c.slug = slugify(c.title); if (!c.log) c.log = [{ ts: c.updated + ' 09:00', u: c.author, m: 'Estado: ' + UI.statusLabel(c.status) }]; });
    const cnt = (s) => DB.cms.filter(c => c.status === s).length;
    el.innerHTML = '<div class="page chv-page">' + UI.pageHeader({ title: 'CMS — contenidos del sitio y portales', subtitle: 'PROC-055: Contenido → Revisión → Aprobación → Publicación → Canal → Despublicación. Los contenidos publicados alimentan la web, la tienda y los portales.', crumbs: [['Inicio', '#/dashboard'], ['Canales'], ['CMS']], actions: '<button class="btn primary" id="cms-new">' + ic('plus') + 'Nuevo contenido</button>' }) +
      (canPub ? '' : UI.alert('warn', 'Su rol puede redactar y enviar a revisión, pero no aprobar ni publicar (requiere <span class="mono">channels.cms.publish</span>).')) +
      '<div class="grid g5">' + UI.kpi({ label: 'Publicados', value: cnt('publicado'), tone: 'ok', icon: 'globe' }) + UI.kpi({ label: 'En revisión', value: cnt('en_revision'), tone: 'sun', icon: 'eye' }) + UI.kpi({ label: 'Aprobados por publicar', value: cnt('aprobado'), tone: 'info', icon: 'fileCheck' }) + UI.kpi({ label: 'Borradores', value: cnt('borrador'), tone: 'accent', icon: 'edit' }) + UI.kpi({ label: 'Despublicados', value: cnt('despublicado'), tone: 'violet', icon: 'history' }) + '</div>' +
      UI.card('Flujo editorial', UI.flow(CMS_FLOW, 5) + '<p class="xs faint" style="margin-top:8px">Solo usuarios con permiso de publicación aprueban, publican o despublican. Cada transición queda auditada con usuario, fecha y motivo.</p>') +
      '<div id="cms-tbl"></div></div>';
    UI.dataTable(el.querySelector('#cms-tbl'), {
      exportName: 'cms', rows: () => DB.cms, search: ['title', 'type', 'channel', 'id'], searchPlaceholder: 'Buscar contenido…', defaultSort: 'updated', defaultDir: -1,
      filters: [{ label: 'Estado', key: 'status', options: [['borrador', 'Borrador'], ['en_revision', 'En revisión'], ['aprobado', 'Aprobado'], ['publicado', 'Publicado'], ['despublicado', 'Despublicado']] }, { label: 'Tipo', key: 'type', options: [...new Set(DB.cms.map(c => c.type))].map(x => [x, x]) }],
      columns: [
        { key: 'id', label: 'ID', render: c => '<span class="mono">' + esc(c.id) + '</span>' },
        { key: 'title', label: 'Título', render: c => '<div class="cell-main">' + esc(c.title) + '</div><div class="cell-sub">/' + esc(c.slug) + '</div>' },
        { key: 'type', label: 'Tipo' }, { key: 'channel', label: 'Canal' },
        { key: 'status', label: 'Estado', render: c => cmsBadge(c.status) },
        { key: 'updated', label: 'Actualizado', render: c => date(c.updated) },
        { key: 'author', label: 'Autor', render: c => UI.userChip(c.author) }
      ],
      onRow: c => cmsEditor(c, canPub)
    });
    el.querySelector('#cms-new').onclick = () => cmsEditor(null, canPub);
    if (params[0]) { const c = DB.cms.find(x => x.id === params[0]); if (c) cmsEditor(c, canPub); }
  });
  function cmsEditor(c, canPub) {
    const isNew = !c;
    c = c || { title: '', type: 'Página', channel: 'Web', status: 'borrador', body: '', seoTitle: '', seoDesc: '', slug: '', author: Auth.user.id, log: [] };
    const read = (d) => { const f = UI.formData(d); return { title: f.cm_title, type: f.cm_type, channel: f.cm_channel, slug: f.cm_slug || slugify(f.cm_title), body: f.cm_body, seoTitle: f.cm_seot, seoDesc: f.cm_seod }; };
    const persist = (d, newStatus, msg, reason) => {
      if (!UI.validate(d)) return false;
      const data = read(d);
      if (DB.cms.some(x => x !== c && x.slug === data.slug)) { UI.toast('La URL /' + esc(data.slug) + ' ya está en uso por otro contenido.', 'bad'); return false; }
      if (['aprobado', 'publicado', 'despublicado'].includes(newStatus) && !canPub) { UI.toast('Requiere permiso channels.cms.publish: solo puede redactar y enviar a revisión.', 'bad'); return false; }
      if (!newStatus && c.status === 'publicado' && !canPub) { UI.toast('El contenido está publicado: editarlo requiere permiso channels.cms.publish. Solicite a un editor que lo despublique.', 'bad'); return false; }
      if (newStatus === 'publicado' && !data.seoTitle) { UI.toast('Complete el título SEO antes de publicar.', 'bad'); return false; }
      const before = c.status;
      Object.assign(c, data); c.updated = T();
      if (isNew) { c.id = nextId(DB.cms, 'CMS-', 2); DB.cms.unshift(c); }
      if (newStatus) c.status = newStatus;
      c.log = c.log || []; c.log.push({ ts: nowStr(), u: Auth.user.id, m: msg + (reason ? ' — ' + reason : '') });
      Store.save();
      Audit.log('Contenido CMS', c.id, newStatus ? 'cambio_estado' : (isNew ? 'crear' : 'editar'), newStatus ? before : '', newStatus ? newStatus + (reason ? ' · ' + reason : '') : c.title);
      if (newStatus === 'en_revision') Notify.push('cms.revision', 'Portal', 'U02', 'Contenido por revisar: ' + c.title);
      if (newStatus === 'publicado') Notify.push('cms.publicado', 'Portal', c.author, 'Publicado en ' + c.channel + ': ' + c.title);
      UI.toast(msg + ': ' + esc(c.title)); App.go('#/canales/cms');
      return true;
    };
    const withReason = (d, newStatus, msg, title) => { if (!canPub) { UI.toast('Requiere permiso channels.cms.publish.', 'bad'); return; } UI.closeDrawer(); UI.confirm({ title, message: 'Indique el motivo. Quedará registrado en la bitácora y en auditoría.', reason: true, danger: newStatus === 'despublicado', confirmLabel: title, onConfirm: (r) => { const before = c.status; c.status = newStatus; c.updated = T(); c.log.push({ ts: nowStr(), u: Auth.user.id, m: msg + ' — ' + r }); Store.save(); Audit.log('Contenido CMS', c.id, 'cambio_estado', before, newStatus + ' · ' + r); if (newStatus === 'borrador') Notify.push('cms.devuelto', 'Portal', c.author, 'Contenido devuelto: ' + c.title); UI.toast(msg + ': ' + esc(c.title)); App.render(); } }); };
    const s = c.status;
    const acts = [{ label: 'Vista previa', icon: 'eye', close: false, onClick: (d) => { cmsPreview(Object.assign({}, c, read(d))); return false; } }];
    if (canPub || !['publicado', 'aprobado', 'en_revision'].includes(c.status)) acts.push({ label: 'Guardar', icon: 'check', close: false, onClick: (d) => persist(d, isNew ? 'borrador' : null, isNew ? 'Contenido creado' : 'Cambios guardados') || false });
    if (s === 'borrador' || s === 'despublicado') acts.push({ label: 'Enviar a revisión', icon: 'send', cls: 'primary', close: false, onClick: (d) => persist(d, 'en_revision', 'Enviado a revisión') || false });
    if (s === 'en_revision' && canPub) { acts.push({ label: 'Devolver a borrador', icon: 'chevronLeft', close: false, onClick: (d) => { withReason(d, 'borrador', 'Devuelto a borrador', 'Devolver'); return false; } }); acts.push({ label: 'Aprobar', icon: 'fileCheck', cls: 'primary', close: false, onClick: (d) => persist(d, 'aprobado', 'Contenido aprobado') || false }); }
    if (s === 'aprobado' && canPub) acts.push({ label: 'Publicar', icon: 'globe', cls: 'primary', close: false, onClick: (d) => persist(d, 'publicado', 'Publicado en ' + c.channel) || false });
    if (s === 'publicado' && canPub) acts.push({ label: 'Despublicar', icon: 'x', cls: 'danger', close: false, onClick: (d) => { withReason(d, 'despublicado', 'Despublicado', 'Despublicar'); return false; } });
    const locked = s === 'publicado';
    UI.drawer({ title: isNew ? 'Nuevo contenido' : esc(c.title), sub: isNew ? 'Se crea en estado Borrador' : c.id + ' · ' + UI.statusLabel(s === 'aprobado' ? 'APPROVED' : s), wide: true,
      body: '<div class="stack">' + UI.flow(CMS_FLOW, cmsIdx(s)) +
        ((!canPub && ['en_revision', 'aprobado', 'publicado'].includes(s)) ? UI.alert('warn', 'La siguiente transición requiere el permiso <span class="mono">channels.cms.publish</span>.') : '') +
        (locked ? UI.alert('info', 'Contenido publicado: los cambios guardados se reflejan en el canal de inmediato. Para cambios mayores, despublique y reenvíe a revisión.') : '') +
        UI.form([
          { id: 'cm_title', label: 'Título', required: true, value: c.title, col: 12 },
          { id: 'cm_type', label: 'Tipo', type: 'select', options: ['Página', 'Artículo', 'Banner', 'Página legal', 'Landing'], value: c.type, col: 4 },
          { id: 'cm_channel', label: 'Canal', type: 'select', options: ['Web', 'Web / E-commerce', 'Web / Portal', 'Portal cliente', 'Portal pasajero', 'App pasajero'], value: c.channel, col: 4 },
          { id: 'cm_slug', label: 'URL (slug)', value: c.slug, col: 4, placeholder: 'se genera del título' },
          { id: 'cm_body', label: 'Cuerpo', type: 'textarea', rows: 10, value: c.body, col: 12, hint: 'Formato simple: "## " para subtítulos y "- " para listas.' },
          { type: 'section', label: 'SEO' },
          { id: 'cm_seot', label: 'Título SEO', value: c.seoTitle || '', col: 6, placeholder: 'máx. 60 caracteres' },
          { id: 'cm_seod', label: 'Meta descripción', value: c.seoDesc || '', col: 6, placeholder: 'máx. 160 caracteres' }
        ]) + (c.log && c.log.length ? '<div><div class="upper" style="margin-bottom:8px">Bitácora editorial</div>' + UI.timeline(c.log.slice().reverse().map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(Q.userName(l.u)), icon: 'history' }))) + '</div>' : '') + '</div>',
      actions: acts });
  }

  /* =====================================================================================
     PORTAL DEL CLIENTE — PROC-051
     ===================================================================================== */
  const PC_CLIENTS = ['CLI-0001', 'CLI-0002', 'CLI-0005'];
  /* Clientes que un usuario interno puede previsualizar: Ventas solo los de su cartera (Scope) */
  function pcClients() {
    const own = Scope.clientIds();
    const active = DB.clients.filter(c => (!own || own.has(c.id)) && (DB.quotes.some(q => q.clientId === c.id && q.status !== 'borrador') || DB.reservations.some(r => r.clientId === c.id))).map(c => c.id);
    return own ? active : PC_CLIENTS.concat(active.filter(id => !PC_CLIENTS.includes(id)));
  }
  App.register('canales/portal-cliente', (el, params) => {
    const isCustomer = Auth.role === 'customer';
    const list = isCustomer ? [] : pcClients();
    if (isCustomer && !Auth.clientId) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('Su usuario no está vinculado a una cuenta de cliente.', 'user')) + '</div>'; return; }
    if (isCustomer && params[0] !== Auth.clientId) { location.replace('#/canales/portal-cliente/' + Auth.clientId + '/inicio'); return; }   // sin id o id ajeno: el router ya respondió 403 al id ajeno
    if (!isCustomer && !list.length) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('No tiene clientes en su cartera con cotizaciones o reservas para previsualizar el portal.', 'user')) + '</div>'; return; }
    if (!isCustomer && params[0] && !list.includes(params[0])) { if (Scope.ownOnly() && Q.client(params[0])) { Scope.denied(el, 'El cliente ' + params[0]); return; } location.replace('#/canales/portal-cliente/' + list[0] + '/' + (params[1] || 'inicio')); return; }
    const cid = isCustomer ? Auth.clientId : (params[0] || list[0]);
    const section = params[1] || 'inicio'; const itemId = params[2];
    const cl = Q.client(cid); const base = '#/canales/portal-cliente/' + cid + '/';
    const quotes = DB.quotes.filter(q => q.clientId === cid && q.status !== 'borrador');
    const res = DB.reservations.filter(r => r.clientId === cid && r.status !== 'borrador');
    const resIds = res.map(r => r.id);
    const rcv = DB.receivables.filter(x => x.clientId === cid && x.status !== 'cancelada');
    const pendQ = quotes.filter(q => ['enviada', 'vista', 'negociacion'].includes(q.status) && q.validUntil >= T());
    const notes = DB.notifications.filter(n => [cl.email, cl.phone, cid].includes(n.to));
    const saldo = rcv.filter(x => x.amount - x.paid > 0.004);
    const nav = [{ id: 'inicio', label: 'Inicio', href: base + 'inicio' }, { id: 'cotizaciones', label: 'Cotizaciones', href: base + 'cotizaciones', count: pendQ.length }, { id: 'reservas', label: 'Mis viajes', href: base + 'reservas' }, { id: 'documentos', label: 'Documentos', href: base + 'documentos' }, { id: 'pagos', label: 'Pagos', href: base + 'pagos', count: saldo.length }, ].concat(corpAcc(cid) ? [{ id: 'corporativo', label: 'Panel corporativo', href: base + 'corporativo' }] : []).concat([{ id: 'notificaciones', label: 'Notificaciones', href: base + 'notificaciones' }, { id: 'soporte', label: 'Soporte', href: base + 'soporte' }]);
    const sel = isCustomer ? '' : '<label class="row" style="gap:8px;flex-wrap:nowrap"><span class="chv-d">Ver como cliente</span><select id="pc-as" aria-label="Ver como cliente">' + list.map(id => '<option value="' + id + '"' + (id === cid ? ' selected' : '') + '>' + id + ' · ' + esc(Q.clientName(id)) + '</option>').join('') + '</select></label>';
    const who = cl.kind === 'Empresa' && cl.contactName ? cl.contactName.replace(/\s*\(.*\)/, '') : cl.name;
    el.innerHTML = '<div class="page chv-page">' + frame(chBar('Portal del cliente', 'Experiencia que ve ' + cl.name, sel), { sub: 'Portal del cliente', nav, active: section, user: userChip(who, cl.kind === 'Empresa' ? cl.name : cl.email), body: '<div id="pc-b" class="stack"></div>' }) + '</div>';
    const as = el.querySelector('#pc-as'); if (as) as.onchange = () => App.go('#/canales/portal-cliente/' + as.value + '/' + section);
    const b = el.querySelector('#pc-b');
    const ctx = { cid, cl, base, quotes, res, resIds, rcv, pendQ, notes, saldo, who };
    if (section === 'cotizaciones') itemId ? pcQuote(b, ctx, itemId) : pcQuotes(b, ctx);
    else if (section === 'reservas') itemId ? pcRes(b, ctx, itemId) : pcResList(b, ctx);
    else if (section === 'documentos') pcDocs(b, ctx);
    else if (section === 'pagos') pcPays(b, ctx);
    else if (section === 'notificaciones') pcNotes(b, ctx);
    else if (section === 'soporte') pcSupport(b, ctx);
    else if (section === 'corporativo' && corpAcc(cid)) pcCorp(b, ctx, corpAcc(cid), itemId);
    else pcHome(b, ctx);
  });
  /* ---------------- Panel corporativo de la empresa cliente (v2.7 · spec 20) ----------------
     Reportes de compras y movimientos por período, centro de costo y viajero; estado de cuenta mensual;
     aprobaciones; usuarios del portal con rol (administrador, aprobador, pagador, viajero). */
  const corpAcc = (cid) => (DB.corpAccounts || []).find(a => a.clientId === cid && a.status !== 'suspendida');
  const CORP_ROLES = { administrador: 'Administrador', aprobador: 'Aprobador', pagador: 'Pagador', viajero: 'Viajero' };
  function corpRole(acc) {
    if (Auth.role !== 'customer') return 'administrador';   // vista previa interna
    const u = acc.users.find(x => x.userId === Auth.user.id && x.active); return u ? u.role : 'viajero';
  }
  function corpData(x, acc) {
    const pen = (n, c) => Math.round(toPEN(n, c) * 100) / 100;
    const live = x.res.filter(r => !['cancelada', 'borrador'].includes(r.status)).map(r => {
      const al = (acc.allocations || {})[r.id] || {};
      return { resId: r.id, title: r.title, date: r.createdAt.split(' ')[0], travelFrom: r.travelFrom, cc: al.cc || acc.defaultCc, amount: pen(r.total, r.currency), currency: acc.currency, travelers: (r.passengers || []).map(p => p.name), live: true };
    });
    const trips = (acc.history || []).concat(live);
    const ccOf = (resId) => (trips.find(t => t.resId === resId) || {}).cc || acc.defaultCc;
    const mov = [];
    trips.forEach(t => mov.push({ id: 'M-' + t.resId, date: t.date, kind: 'Compra', doc: t.resId, detail: t.title, cc: t.cc, charge: t.amount, credit: 0 }));
    (acc.history || []).forEach(t => {
      (t.payments || []).forEach(p => mov.push({ id: 'M-' + p.id, date: p.date, kind: 'Pago', doc: p.id, detail: p.method + ' · ' + t.resId, cc: t.cc, charge: 0, credit: p.amount }));
      if (t.creditNote) mov.push({ id: 'M-' + t.creditNote.id, date: t.creditNote.date, kind: 'Nota de crédito', doc: t.creditNote.id, detail: t.creditNote.reason + ' · ' + t.resId, cc: t.cc, charge: 0, credit: t.creditNote.amount });
    });
    DB.payments.filter(p => x.resIds.includes(p.resId) && p.status === 'aplicado').forEach(p => mov.push({ id: 'M-' + p.id, date: p.date, kind: 'Pago', doc: p.id, detail: p.method + ' · ' + p.resId, cc: ccOf(p.resId), charge: 0, credit: pen(p.amount, p.currency) }));
    DB.invoices.filter(i => i.clientId === x.cid && /cr[eé]dito/i.test(i.type) && i.status !== 'rechazado').forEach(i => mov.push({ id: 'M-' + i.id, date: i.date, kind: 'Nota de crédito', doc: i.id, detail: i.detail + ' · ' + i.resId, cc: ccOf(i.resId), charge: 0, credit: pen(i.amount, i.currency) }));
    mov.sort((a, c) => a.date.localeCompare(c.date) || (c.charge - a.charge));
    let bal = 0; mov.forEach(m => { bal = Math.round((bal + m.charge - m.credit) * 100) / 100; m.balance = bal; });
    return { trips, mov, balance: bal };
  }
  const CORP_PERIODS = [['2026', 'Año 2026'], ['2026-Q1', 'Ene–mar 2026'], ['2026-Q2', 'Abr–jun 2026'], ['2026-Q3', 'Jul–set 2026'], ['2026-Q4', 'Oct–dic 2026']];
  const inPeriod = (d, per) => { if (!per.includes('Q')) return d.startsWith(per); const q = Number(per.slice(-1)); const m = Number(d.slice(5, 7)); return d.startsWith(per.slice(0, 4)) && Math.ceil(m / 3) === q; };
  function pcCorp(b, x, acc, tab) {
    const role = corpRole(acc); const cur = acc.currency;
    const can = { users: role === 'administrador', statement: ['administrador', 'pagador'].includes(role), approve: ['administrador', 'aprobador'].includes(role) };
    const st = pcCorp.st = pcCorp.st || { per: '2026' };
    const data = corpData(x, acc);
    const own = role === 'viajero' && Auth.role === 'customer' ? (Auth.user.name || '') : null;   // el viajero solo ve sus viajes
    const trips = own ? data.trips.filter(t => (t.travelers || []).includes(own)) : data.trips;
    const pend = acc.approvals.filter(a => a.status === 'pendiente');
    b.innerHTML = '<div class="row between" style="gap:12px;flex-wrap:wrap"><div><h2>Panel corporativo</h2><div class="small muted">' + esc(x.cl.name) + ' · ' + esc(x.cl.doc) + ' · crédito ' + acc.creditDays + ' días · su rol: <b>' + CORP_ROLES[role] + '</b></div></div>' +
      '<label class="row" style="gap:8px"><span class="small muted">Período</span><select class="input sm" id="corp-per" style="width:auto">' + CORP_PERIODS.map(p => '<option value="' + p[0] + '"' + (p[0] === st.per ? ' selected' : '') + '>' + p[1] + '</option>').join('') + '</select></label></div><div id="corp-tabs"></div>';
    b.querySelector('#corp-per').onchange = (e) => { st.per = e.target.value; pcCorp(b, x, acc, tabs.current); };
    const tabs = UI.tabs(b.querySelector('#corp-tabs'), [
      { id: 'resumen', label: 'Resumen de compras', render: (el) => corpSummary(el, x, acc, trips, data, st.per) },
      { id: 'movimientos', label: 'Movimientos', render: (el) => corpMoves(el, x, acc, own ? data.mov.filter(m => trips.some(t => m.detail.includes(t.resId) || m.doc === t.resId)) : data.mov, st.per) },
      { id: 'estado', label: 'Estado de cuenta', render: (el) => corpStatement(el, x, acc, data, can) },
      { id: 'aprobaciones', label: 'Aprobaciones', count: pend.length || null, render: (el) => corpApprovals(el, x, acc, can) },
      { id: 'usuarios', label: 'Usuarios y centros de costo', render: (el) => corpUsers(el, x, acc, can, trips) }
    ], tab || 'resumen');
  }
  function corpSummary(el, x, acc, trips, data, per) {
    const cur = acc.currency; const T2 = trips.filter(t => inPeriod(t.date, per));
    const total = sum(T2, 'amount'); const pax = new Set(T2.flatMap(t => t.travelers || []));
    const months = MESES_CORTO.map((m, i) => ({ m, v: sum(trips.filter(t => t.date.startsWith('2026-' + String(i + 1).padStart(2, '0'))), 'amount') }));
    const byCc = acc.costCenters.map(c => { const v = sum(T2.filter(t => t.cc === c.id), 'amount'); const yr = sum(trips.filter(t => t.cc === c.id && t.date.startsWith('2026')), 'amount'); return { c, v, yr, pct: c.budget ? yr / c.budget * 100 : 0 }; });
    const tv = {}; T2.forEach(t => { const n = (t.travelers || []).length || 1; (t.travelers || []).forEach(p => { tv[p] = tv[p] || { name: p, trips: 0, amount: 0 }; tv[p].trips++; tv[p].amount += t.amount / n; }); });
    const top = Object.values(tv).sort((a, c) => c.amount - a.amount);
    el.innerHTML = '<div class="stack">' +
      '<div class="grid g4">' + UI.kpi({ label: 'Total comprado', value: money(total, cur, 0), sub: T2.length + ' compras en el período', icon: 'cart', tone: 'accent' }) +
      UI.kpi({ label: 'Saldo por pagar', value: money(data.balance, cur, 0), sub: 'A la fecha, todas las compras', icon: 'wallet', tone: data.balance > 0 ? 'sun' : 'ok' }) +
      UI.kpi({ label: 'Viajeros', value: String(pax.size), sub: 'Personas distintas que viajaron', icon: 'users', tone: 'info' }) +
      UI.kpi({ label: 'Ticket promedio', value: T2.length ? money(total / T2.length, cur, 0) : '—', sub: 'Por compra', icon: 'chart', tone: 'violet' }) + '</div>' +
      UI.card('Gasto por mes · 2026', UI.chart.bars({ labels: months.map(z => z.m), series: [{ name: 'Compras (' + cur + ')', values: months.map(z => Math.round(z.v)) }], height: 200 })) +
      '<div class="grid g2">' +
      UI.card('Gasto por centro de costo', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Centro de costo</th><th class="num">Período</th><th class="num">Acumulado 2026</th><th class="num">Presupuesto</th><th>Uso</th></tr></thead><tbody>' +
        byCc.map(r => '<tr><td><b class="mono small">' + esc(r.c.id) + '</b> ' + esc(r.c.name) + '</td><td class="num nowrap">' + money(r.v, cur, 0) + '</td><td class="num nowrap">' + money(r.yr, cur, 0) + '</td><td class="num nowrap">' + money(r.c.budget, cur, 0) + '</td><td style="min-width:110px"><div class="progress"><span style="width:' + Math.min(100, r.pct).toFixed(1) + '%;background:' + (r.pct > 100 ? 'var(--bad)' : r.pct > 80 ? 'var(--sun)' : 'var(--accent)') + '"></span></div><div class="cell-sub' + (r.pct > 100 ? ' bad' : '') + '">' + fmtN(r.pct, 0) + ' %' + (r.pct > 100 ? ' · excedido' : '') + '</div></td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      UI.card('Gasto por viajero', top.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Viajero</th><th class="num">Viajes</th><th class="num">Gasto asignado</th></tr></thead><tbody>' + top.slice(0, 10).map(t => '<tr><td>' + esc(t.name) + '</td><td class="num">' + t.trips + '</td><td class="num">' + money(t.amount, cur) + '</td></tr>').join('') + '</tbody></table></div><div class="small muted" style="padding:8px 12px">El costo de cada compra se reparte en partes iguales entre sus viajeros.</div>' : UI.empty('Sin viajes en el período', 'users'), { tight: true }) +
      '</div>' +
      UI.card('Compras del período', '<div id="corp-trips"></div>', { tight: true }) + '</div>';
    UI.dataTable(el.querySelector('#corp-trips'), { exportName: 'compras_' + per, rows: T2, search: ['resId', 'title', 'cc'], pageSize: 8, defaultSort: 'date', defaultDir: -1,
      filters: [{ label: 'Centro de costo', key: 'cc', options: acc.costCenters.map(c => [c.id, c.id + ' · ' + c.name]) }],
      columns: [{ key: 'date', label: 'Compra', render: t => date(t.date) }, { key: 'resId', label: 'Reserva', render: t => '<span class="mono small">' + esc(t.resId) + '</span>' }, { key: 'title', label: 'Viaje', render: t => esc(t.title) + '<div class="cell-sub">Viaja ' + date(t.travelFrom) + ' · ' + (t.travelers || []).length + ' viajeros</div>' }, { key: 'cc', label: 'Centro de costo', render: t => '<span class="mono small">' + esc(t.cc) + '</span>' }, { key: 'amount', label: 'Importe', align: 'num', render: t => money(t.amount, acc.currency) }],
      empty: 'Sin compras en el período' });
  }
  function corpMoves(el, x, acc, mov, per) {
    const rows = mov.filter(m => inPeriod(m.date, per)); const cur = acc.currency;
    el.innerHTML = '<div class="stack"><div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted grow">Compras, pagos y notas de crédito con el saldo acumulado. «Exportar» descarga CSV; Excel y PDF se generan en segundo plano.</span>' +
      '<button class="btn sm" data-x="Excel">' + ic('download') + 'Excel</button><button class="btn sm" data-x="PDF">' + ic('file') + 'PDF</button></div><div id="corp-mov"></div>' +
      UI.card('Exportaciones recientes', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Código</th><th>Reporte</th><th>Período</th><th>Formato</th><th>Solicitado</th><th>Estado</th></tr></thead><tbody>' + acc.exports.slice(0, 6).map(e => '<tr><td class="mono small">' + esc(e.id) + '</td><td>' + esc(e.type) + '</td><td>' + esc(e.period) + '</td><td>' + esc(e.format) + '</td><td class="small">' + datetime(e.at) + ' · ' + esc(e.by) + '</td><td>' + UI.badge(e.status) + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) + '</div>';
    UI.dataTable(el.querySelector('#corp-mov'), { exportName: 'movimientos_' + per, rows, search: ['doc', 'detail', 'cc'], pageSize: 12, defaultSort: 'date', defaultDir: -1,
      filters: [{ label: 'Tipo', key: 'kind', options: [['Compra', 'Compra'], ['Pago', 'Pago'], ['Nota de crédito', 'Nota de crédito']] }, { label: 'Centro de costo', key: 'cc', options: acc.costCenters.map(c => [c.id, c.id]) }],
      columns: [{ key: 'date', label: 'Fecha', render: m => date(m.date) }, { key: 'kind', label: 'Tipo', render: m => UI.badge(m.kind === 'Compra' ? 'abierta' : m.kind === 'Pago' ? 'pagada' : 'anulado', m.kind) }, { key: 'doc', label: 'Documento', render: m => '<span class="mono small">' + esc(m.doc) + '</span>' }, { key: 'detail', label: 'Detalle' }, { key: 'cc', label: 'C. costo', render: m => '<span class="mono small">' + esc(m.cc) + '</span>' },
        { key: 'charge', label: 'Cargo', align: 'num', render: m => m.charge ? money(m.charge, cur) : '' }, { key: 'credit', label: 'Abono', align: 'num', render: m => m.credit ? money(m.credit, cur) : '' }, { key: 'balance', label: 'Saldo', align: 'num', render: m => '<b>' + money(m.balance, cur) + '</b>' }],
      footer: (r) => '<tr><td colspan="5"><b>Total del período</b></td><td class="num"><b>' + money(sum(r, 'charge'), cur) + '</b></td><td class="num"><b>' + money(sum(r, 'credit'), cur) + '</b></td><td></td></tr>',
      empty: 'Sin movimientos en el período' });
    el.querySelectorAll('[data-x]').forEach(bt => bt.onclick = () => {
      const e = { id: 'EXC-' + String(13 + acc.exports.length).padStart(4, '0'), type: 'Movimientos', period: per, format: bt.dataset.x, status: 'listo', by: x.who, at: nowStr() };
      acc.exports.unshift(e); Store.save(); Audit.log('Exportación corporativa', e.id, 'solicitar', '', e.format + ' · ' + per);
      UI.toast('Exportación ' + e.id + ' lista (' + e.format + '). En producción se genera en segundo plano y llega por correo.', 'ok'); corpMoves(el, x, acc, mov, per);
    });
  }
  function corpStmt(data, month) {
    const before = data.mov.filter(m => m.date < month + '-01'); const inM = data.mov.filter(m => m.date.startsWith(month));
    const open = before.length ? before[before.length - 1].balance : 0;
    const charges = sum(inM, 'charge'); const pays = sum(inM.filter(m => m.kind === 'Pago'), 'credit'); const credits = sum(inM.filter(m => m.kind !== 'Pago'), 'credit');
    return { month, open, charges, pays, credits, close: Math.round((open + charges - pays - credits) * 100) / 100, rows: inM };
  }
  function corpStatement(el, x, acc, data, can) {
    const months = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const cur = acc.currency; const s0 = acc.statement;
    const sts = months.map(m => corpStmt(data, m)).reverse();
    el.innerHTML = '<div class="stack">' +
      UI.card('Envío automático', '<div class="row between" style="gap:12px;flex-wrap:wrap"><div class="small">' + (s0.auto ? 'Activo: el día <b>' + s0.day + '</b> de cada mes se envía el estado de cuenta del mes anterior a <b>' + s0.recipients.map(esc).join(', ') + '</b>. Último envío: ' + date(s0.lastSent) + '.' : 'Desactivado. El estado de cuenta se descarga desde esta pantalla.') + '</div>' +
        '<button class="btn sm" id="corp-auto"' + (can.statement ? '' : ' disabled title="Solo administrador o pagador"') + '>' + ic('settings') + 'Configurar</button></div>') +
      UI.card('Estados de cuenta mensuales', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mes</th><th class="num">Saldo inicial</th><th class="num">Compras</th><th class="num">Pagos</th><th class="num">Notas de crédito</th><th class="num">Saldo final</th><th></th></tr></thead><tbody>' +
        sts.map(s => '<tr><td>' + MESES_LARGO[Number(s.month.slice(5)) - 1] + ' ' + s.month.slice(0, 4) + '</td><td class="num">' + money(s.open, cur) + '</td><td class="num">' + money(s.charges, cur) + '</td><td class="num">' + money(s.pays, cur) + '</td><td class="num">' + money(s.credits, cur) + '</td><td class="num"><b>' + money(s.close, cur) + '</b></td><td class="nowrap"><button class="btn xs" data-v="' + s.month + '">' + ic('eye') + 'Ver PDF</button> <button class="btn xs" data-s="' + s.month + '"' + (can.statement ? '' : ' disabled') + '>' + ic('mail') + 'Enviar</button></td></tr>').join('') + '</tbody></table></div>', { tight: true }) + '</div>';
    const doc = (s) => '<div class="doc">' + docHead('ESTADO DE CUENTA', x.cl.name, '<div class="muted" style="margin-top:4px">' + MESES_LARGO[Number(s.month.slice(5)) - 1] + ' ' + s.month.slice(0, 4) + ' · ' + esc(x.cl.doc) + '</div>') +
      '<table class="tot"><tbody><tr><td>Saldo inicial</td><td style="text-align:right">' + money(s.open, cur) + '</td></tr><tr><td>(+) Compras</td><td style="text-align:right">' + money(s.charges, cur) + '</td></tr><tr><td>(−) Pagos</td><td style="text-align:right">' + money(s.pays, cur) + '</td></tr><tr><td>(−) Notas de crédito</td><td style="text-align:right">' + money(s.credits, cur) + '</td></tr><tr><td><b>Saldo final</b></td><td style="text-align:right"><b>' + money(s.close, cur) + '</b></td></tr></tbody></table>' +
      '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Detalle</th><th>C. costo</th><th style="text-align:right">Cargo</th><th style="text-align:right">Abono</th></tr></thead><tbody>' + (s.rows.length ? s.rows.map(m => '<tr><td>' + date(m.date) + '</td><td>' + esc(m.kind) + '</td><td>' + esc(m.doc) + '</td><td>' + esc(m.detail) + '</td><td>' + esc(m.cc) + '</td><td style="text-align:right">' + (m.charge ? money(m.charge, cur) : '') + '</td><td style="text-align:right">' + (m.credit ? money(m.credit, cur) : '') + '</td></tr>').join('') : '<tr><td colspan="7" class="muted">Sin movimientos en el mes</td></tr>') + '</tbody></table>' +
      '<p class="muted" style="font-size:.74rem">Condición de pago: crédito ' + acc.creditDays + ' días desde la emisión del comprobante. Consultas: ' + esc((Q.user(x.cl.owner) || {}).email || '') + '</p></div>';
    el.querySelectorAll('[data-v]').forEach(bt => bt.onclick = () => showDoc('Estado de cuenta ' + bt.dataset.v, doc(corpStmt(data, bt.dataset.v))));
    el.querySelectorAll('[data-s]').forEach(bt => bt.onclick = () => { const m = bt.dataset.s; s0.recipients.forEach(r => Notify.push('estado_cuenta.corporativo', 'Email', r, 'Estado de cuenta ' + m + ' — ' + x.cl.name)); Audit.log('Estado de cuenta corporativo', acc.id + '/' + m, 'enviar', '', s0.recipients.join(', ')); Store.save(); UI.toast('Estado de cuenta de ' + m + ' enviado a ' + s0.recipients.length + ' destinatarios.', 'ok'); });
    const ab = el.querySelector('#corp-auto'); if (ab && can.statement) ab.onclick = () => UI.modal({ title: 'Envío automático del estado de cuenta', body: UI.form([
      { id: 'ca_on', label: 'Envío automático', type: 'select', options: [['1', 'Activo'], ['0', 'Desactivado']], value: s0.auto ? '1' : '0', col: 6 },
      { id: 'ca_day', label: 'Día del mes (1–28)', type: 'number', min: 1, max: 28, value: s0.day, required: true, col: 6 },
      { id: 'ca_to', label: 'Destinatarios (separados por coma)', value: s0.recipients.join(', '), required: true, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const day = Number(f.ca_day); const to = f.ca_to.split(',').map(z => z.trim()).filter(Boolean);
        if (!(day >= 1 && day <= 28)) { UI.toast('El día debe estar entre 1 y 28 (CP-05).', 'bad'); return false; }
        if (!to.length || to.some(z => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(z))) { UI.toast('Revise los correos de destino.', 'bad'); return false; }
        const bf = JSON.stringify(s0); s0.auto = f.ca_on === '1'; s0.day = day; s0.recipients = to; Store.save(); Audit.log('Cuenta corporativa', acc.id, 'config_estado_cuenta', bf, JSON.stringify(s0)); UI.toast('Configuración guardada.', 'ok'); corpStatement(el, x, acc, data, can);
      } }] });
  }
  function corpApprovals(el, x, acc, can) {
    const cur = acc.currency;
    el.innerHTML = '<div class="stack"><div class="small muted">' + (acc.requireApproval ? 'Las compras desde ' + money(acc.approvalThreshold, cur, 0) + ' necesitan la aprobación de un aprobador de la empresa antes de que la agencia confirme la reserva.' : 'La empresa no exige aprobación previa.') + '</div><div id="corp-ap"></div></div>';
    UI.dataTable(el.querySelector('#corp-ap'), { exportName: 'aprobaciones', rows: acc.approvals, search: ['id', 'ref', 'title', 'requestedBy'], pageSize: 10, defaultSort: 'requestedAt', defaultDir: -1,
      filters: [{ label: 'Estado', key: 'status', options: ['pendiente', 'aprobada', 'rechazada', 'vencida'] }],
      columns: [{ key: 'id', label: 'Solicitud', render: a => '<span class="mono small">' + esc(a.id) + '</span><div class="cell-sub mono">' + esc(a.ref) + '</div>' }, { key: 'title', label: 'Viaje', render: a => esc(a.title) + '<div class="cell-sub">' + esc(a.cc) + ' · pide ' + esc(a.requestedBy) + '</div>' }, { key: 'amount', label: 'Importe', align: 'num', render: a => money(a.amount, a.currency) },
        { key: 'requestedAt', label: 'Solicitada', render: a => datetime(a.requestedAt) + (a.status === 'pendiente' ? '<div class="cell-sub">Vence ' + date(a.expiresAt) + '</div>' : '') }, { key: 'status', label: 'Estado', render: a => UI.badge(a.status) + (a.reason ? '<div class="cell-sub">' + esc(a.reason) + '</div>' : '') },
        { key: 'act', label: '', sort: false, render: a => a.status === 'pendiente' ? '<span class="nowrap"><button class="btn xs primary" data-ok="' + a.id + '"' + (can.approve ? '' : ' disabled title="Solo aprobador o administrador"') + '>Aprobar</button> <button class="btn xs" data-no="' + a.id + '"' + (can.approve ? '' : ' disabled') + '>Rechazar</button></span>' : '' }] });
    const decide = (a, ok, reason) => { const bf = a.status; a.status = ok ? 'aprobada' : 'rechazada'; a.decidedAt = nowStr(); a.reason = reason || ''; Store.save(); Audit.log('Aprobación corporativa', a.id, ok ? 'aprobar' : 'rechazar', bf, a.status + (reason ? ' · ' + reason : '')); Notify.push('aprobacion.corporativa', 'Portal', x.cl.owner, (ok ? 'Aprobada ' : 'Rechazada ') + a.ref + ' — ' + x.cl.name); UI.toast(ok ? 'Solicitud aprobada. La agencia ya puede confirmar la reserva.' : 'Solicitud rechazada.', ok ? 'ok' : 'warn'); corpApprovals(el, x, acc, can); };
    el.querySelectorAll('[data-ok]').forEach(bt => bt.onclick = (e) => { e.stopPropagation(); decide(acc.approvals.find(a => a.id === bt.dataset.ok), true); });
    el.querySelectorAll('[data-no]').forEach(bt => bt.onclick = (e) => { e.stopPropagation(); const a = acc.approvals.find(z => z.id === bt.dataset.no);
      UI.modal({ title: 'Rechazar ' + a.id, body: UI.form([{ id: 'ap_r', label: 'Motivo', required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Rechazar', cls: 'danger', onClick: (m) => { if (!UI.validate(m)) return false; decide(a, false, UI.formData(m).ap_r); } }] }); });
  }
  function corpUsers(el, x, acc, can, trips) {
    const cur = acc.currency;
    el.innerHTML = '<div class="grid g2">' +
      UI.card('Usuarios del portal', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Usuario</th><th>Rol</th><th>Centro de costo</th><th>Estado</th></tr></thead><tbody>' + acc.users.map(u => '<tr><td><b>' + esc(u.name) + '</b><div class="cell-sub">' + esc(u.email) + '</div></td><td>' + CORP_ROLES[u.role] + '</td><td class="mono small">' + esc(u.cc || 'Todos') + '</td><td>' + UI.badge(u.active ? 'activo' : 'inactivo') + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="row" style="padding:10px 12px"><button class="btn sm" id="corp-nu"' + (can.users ? '' : ' disabled title="Solo el administrador de la empresa"') + '>' + ic('plus') + 'Invitar usuario</button></div>', { tight: true }) +
      UI.card('Centros de costo', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Código</th><th>Nombre</th><th class="num">Presupuesto ' + esc(acc.costCenters[0] ? acc.costCenters[0].period : '') + '</th><th class="num">Compras</th></tr></thead><tbody>' + acc.costCenters.map(c => '<tr><td class="mono small">' + esc(c.id) + '</td><td>' + esc(c.name) + '</td><td class="num">' + money(c.budget, cur, 0) + '</td><td class="num">' + trips.filter(t => t.cc === c.id).length + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="row" style="padding:10px 12px"><button class="btn sm" id="corp-nc"' + (can.users ? '' : ' disabled') + '>' + ic('plus') + 'Nuevo centro de costo</button></div>', { tight: true }) + '</div>' +
      '<div class="small muted" style="margin-top:10px">Roles: <b>Administrador</b> gestiona usuarios, centros de costo y todo el panel · <b>Aprobador</b> aprueba compras de su centro de costo · <b>Pagador</b> ve saldos, paga y recibe el estado de cuenta · <b>Viajero</b> ve solo sus viajes.</div>';
    const ccOpts = [['', 'Todos']].concat(acc.costCenters.map(c => [c.id, c.id + ' · ' + c.name]));
    const nu = el.querySelector('#corp-nu'); if (nu && can.users) nu.onclick = () => UI.modal({ title: 'Invitar usuario de la empresa', body: UI.form([
      { id: 'cu_n', label: 'Nombre', required: true, col: 6 }, { id: 'cu_e', label: 'Correo corporativo', type: 'email', required: true, col: 6 },
      { id: 'cu_r', label: 'Rol', type: 'select', options: Object.entries(CORP_ROLES), value: 'viajero', col: 6 }, { id: 'cu_c', label: 'Centro de costo', type: 'select', options: ccOpts, col: 6 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Invitar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const em = f.cu_e.trim().toLowerCase();
        if (acc.users.some(u => u.email.toLowerCase() === em)) { UI.toast('Ese correo ya tiene acceso al portal (CP-06).', 'bad'); return false; }
        if (f.cu_r === 'aprobador' && !f.cu_c) { UI.toast('El aprobador necesita un centro de costo.', 'bad'); return false; }
        const u = { id: 'CPU-' + String(acc.users.length + 1).padStart(2, '0'), userId: null, name: f.cu_n.trim(), email: em, role: f.cu_r, cc: f.cu_c || null, active: true };
        acc.users.push(u); Store.save(); Audit.log('Usuario corporativo', u.id, 'invitar', '', u.role + ' · ' + u.email); Notify.push('portal.invitacion', 'Email', u.email, 'Invitación al portal corporativo de ' + x.cl.name);
        UI.toast('Invitación enviada a ' + u.email + '.', 'ok'); corpUsers(el, x, acc, can, trips);
      } }] });
    const nc = el.querySelector('#corp-nc'); if (nc && can.users) nc.onclick = () => UI.modal({ title: 'Nuevo centro de costo', body: UI.form([
      { id: 'cc_id', label: 'Código', required: true, col: 4, hint: 'Ej. CC-MKT' }, { id: 'cc_n', label: 'Nombre', required: true, col: 8 }, { id: 'cc_b', label: 'Presupuesto anual (' + cur + ')', type: 'number', min: 0, step: '100', value: 0, col: 6 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Crear', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const id = f.cc_id.trim().toUpperCase();
        if (!/^[A-Z0-9-]{2,20}$/.test(id) || acc.costCenters.some(c => c.id === id)) { UI.toast('Código inválido o repetido.', 'bad'); return false; }
        acc.costCenters.push({ id, name: f.cc_n.trim(), budget: Math.max(0, Number(f.cc_b) || 0), period: 'anual', active: true }); Store.save(); Audit.log('Centro de costo', id, 'crear', '', f.cc_n); UI.toast('Centro de costo ' + id + ' creado.', 'ok'); corpUsers(el, x, acc, can, trips);
      } }] });
  }
  const qTotal = (q) => Pricing.quoteTotals(q.versions.find(x => x.v === q.currentVersion)).total;
  const qExpired = (q) => q.status === 'vencida' || (q.validUntil < T() && !['aprobada', 'convertida', 'rechazada', 'cancelada'].includes(q.status));
  function pcHome(b, x) {
    const next = x.res.filter(r => r.travelTo >= T() && !['cancelada'].includes(r.status)).sort((a, c) => a.travelFrom.localeCompare(c.travelFrom))[0];
    const ex = Q.user(x.cl.owner) || {};
    const first = /^Familia /.test(x.who) ? 'familia ' + x.who.split(' ')[1] : x.who.split(' ')[0];
    b.style.display = 'grid'; b.style.gap = '16px';
    b.innerHTML = '<div><h2>Hola, ' + esc(first) + '</h2><div class="small muted">Aquí encontrará sus propuestas, viajes, documentos y pagos con Andes Horizonte Travel.</div></div>' +
      '<div class="grid g4">' + UI.kpi({ label: 'Próximo viaje', value: next ? (daysFromToday(next.travelFrom) <= 0 ? 'En curso' : 'En ' + daysFromToday(next.travelFrom) + ' días') : '—', sub: next ? esc(next.title) : 'Sin viajes programados', tone: 'accent', icon: 'suitcase' }) +
      UI.kpi({ label: 'Cotizaciones por responder', value: x.pendQ.length, sub: x.pendQ.length ? 'Revíselas antes de su vencimiento' : 'Todo al día', tone: x.pendQ.length ? 'sun' : 'ok', icon: 'file' }) +
      UI.kpi({ label: 'Saldo pendiente', value: x.saldo.length ? moneyMulti(x.saldo, r => r.amount - r.paid, r => r.currency) : money(0, 'PEN'), sub: x.saldo.filter(r => r.status === 'vencida').length ? '<span class="bad">' + x.saldo.filter(r => r.status === 'vencida').length + ' vencido</span>' : 'Sin deudas vencidas', tone: x.saldo.length ? 'bad' : 'ok', icon: 'wallet' }) +
      UI.kpi({ label: 'Documentos', value: DB.vouchers.filter(v => x.resIds.includes(v.resId) && v.status !== 'anulado').length + DB.invoices.filter(i => i.clientId === x.cid).length, sub: 'Vouchers y comprobantes', tone: 'info', icon: 'fileCheck' }) + '</div>' +
      '<div class="grid g-2-1"><div class="stack">' +
      (x.pendQ.length ? UI.card('Propuestas pendientes de su respuesta', '<div class="list">' + x.pendQ.map(q => '<a class="list-item click" href="' + x.base + 'cotizaciones/' + q.id + '" style="color:inherit;text-decoration:none"><div class="ico-box sun">' + ic('file') + '</div><div class="grow"><b class="small">' + esc(q.title) + '</b><div class="xs faint">' + esc(q.id) + ' · versión ' + q.currentVersion + ' · válida hasta ' + date(q.validUntil) + '</div></div><div class="right"><b class="num small">' + money(qTotal(q), q.currency) + '</b><div>' + UI.badge(q.status) + '</div></div></a>').join('') + '</div>', { tight: true }) : '') +
      (next ? UI.card('Su próximo viaje', '<div class="row between"><div><b>' + esc(next.title) + '</b><div class="small muted">' + date(next.travelFrom) + ' — ' + date(next.travelTo) + ' · ' + next.passengers.length + ' pasajeros</div></div>' + UI.badge(next.status) + '</div><div class="divider" style="margin:12px 0"></div><div class="list">' + next.services.slice(0, 5).map(s => '<div class="list-item" style="padding:7px 0"><span class="mono xs faint" style="width:90px">' + dateShort(s.date) + ' ' + esc(s.time) + '</span><span class="grow small">' + esc(s.name) + '</span>' + UI.badge(s.status) + '</div>').join('') + '</div>', { actions: '<a class="btn sm" href="' + x.base + 'reservas/' + next.id + '">Ver detalle</a>' }) : UI.card('Su próximo viaje', UI.empty('No tiene viajes programados. Su asesor puede ayudarle a planificar el siguiente.', 'suitcase'))) +
      '</div><div class="stack">' + UI.card('Su asesor de viajes', '<div class="row">' + UI.avatar(ex) + '<div><b class="small">' + esc(ex.name || '—') + '</b><div class="xs faint">' + esc(ex.email || '') + ' · ' + esc(ex.phone || '') + '</div></div></div><a class="btn sm" style="margin-top:12px" href="' + x.base + 'soporte">' + ic('msg') + 'Escribir a mi asesor</a>') +
      UI.card('Últimas notificaciones', x.notes.length ? '<div class="list">' + x.notes.slice(0, 4).map(n => '<div class="list-item"><div class="grow"><div class="small">' + esc(n.subject) + '</div><div class="xs faint">' + esc(n.channel) + ' · ' + datetime(n.ts) + '</div></div></div>').join('') + '</div>' : UI.empty('Sin notificaciones', 'bell'), { tight: true, actions: '<a class="btn sm ghost" href="' + x.base + 'notificaciones">Ver todas</a>' }) + '</div></div>';
  }
  function pcQuotes(b, x) {
    b.innerHTML = '<div><h2>Cotizaciones</h2><div class="small muted">Revise, apruebe o rechace las propuestas de viaje. Solo se muestra la versión vigente de cada cotización.</div></div><div id="pcq"></div>';
    UI.dataTable(b.querySelector('#pcq'), {
      exportName: 'mis_cotizaciones', rows: x.quotes, search: ['id', 'title'], pageSize: 10, defaultSort: 'createdAt', defaultDir: -1,
      columns: [
        { key: 'id', label: 'Cotización', render: q => '<span class="mono">' + esc(q.id) + '</span>' },
        { key: 'title', label: 'Viaje', render: q => '<div class="cell-main">' + esc(q.title) + '</div><div class="cell-sub">' + date(q.travelFrom) + ' — ' + date(q.travelTo) + '</div>' },
        { key: 'currentVersion', label: 'Versión', render: q => 'v' + q.currentVersion },
        { key: 'total', label: 'Total', align: 'num', sortVal: qTotal, render: q => money(qTotal(q), q.currency) },
        { key: 'validUntil', label: 'Válida hasta', render: q => date(q.validUntil) + (qExpired(q) ? ' <span class="xs bad">vencida</span>' : '') },
        { key: 'status', label: 'Estado', render: q => UI.badge(qExpired(q) && q.status !== 'vencida' ? 'vencida' : q.status) },
        { key: 'createdAt', label: '', sort: false, render: () => '<span class="btn xs">Ver</span>' }
      ],
      onRow: q => App.go(x.base + 'cotizaciones/' + q.id)
    });
  }
  function pcQuote(b, x, qid) {
    const q = x.quotes.find(y => y.id === qid);
    if (!q) { b.innerHTML = UI.card('', UI.empty('Cotización no disponible para este cliente.', 'file')); return; }
    if (q.status === 'enviada' && !qExpired(q)) { const bf = q.status; q.status = 'vista'; q.viewedAt = nowStr(); Store.save(); Audit.log('Cotización', q.id, 'vista_portal', bf, 'vista'); Notify.push('cotizacion.vista', 'Portal', q.owner, q.id + ' fue abierta por el cliente'); }
    const v = q.versions.find(y => y.v === q.currentVersion); const t = Pricing.quoteTotals(v);
    const expired = qExpired(q); const open = ['enviada', 'vista', 'negociacion'].includes(q.status) && !expired;
    const ex = Q.user(q.owner) || {};
    const flowIdx = { enviada: 0, vista: 1, negociacion: 1, aprobada: 3, convertida: 4, rechazada: 2, vencida: 2 }[q.status];
    const prods = [...new Set(v.items.map(i => i.productId))].map(Q.product).filter(Boolean);
    b.innerHTML = '<div class="crumbs"><a href="' + x.base + 'cotizaciones">Cotizaciones</a><span>/</span><span>' + esc(q.id) + '</span></div>' +
      '<div class="row between"><div><h2>' + esc(q.title) + '</h2><div class="small muted">' + esc(q.id) + ' · versión ' + v.v + ' del ' + date(v.date) + ' · asesor ' + esc(ex.name || '') + '</div></div>' + UI.badge(expired && q.status !== 'vencida' ? 'vencida' : q.status) + '</div>' +
      UI.card('', UI.flow(['Enviada', 'Vista', 'Respuesta', 'Aprobada', 'Convertida en reserva'], flowIdx, q.status === 'rechazada' || expired ? 2 : undefined)) +
      (expired ? UI.alert('bad', '<b>Cotización vencida el ' + date(q.validUntil) + '.</b> Una versión vencida no puede aprobarse (Regla de negocio de aprobación, PROC-024). Solicite a su asesor una versión actualizada con precios y disponibilidad vigentes. <button class="btn xs" id="pq-upd" style="margin-left:6px">Solicitar actualización</button>') : '') +
      (q.status === 'aprobada' || q.status === 'convertida' ? UI.alert('ok', '<b>Propuesta aprobada</b> el ' + datetime(q.approvedAt) + ' por ' + esc(q.approvedBy || '') + '.' + (q.approval ? ' Evidencia: token <span class="mono">' + esc(q.approval.token || '—') + '</span>, IP ' + esc(q.approval.ip) + ', huella <span class="mono">' + esc(q.approval.hash) + '</span>.' : '') + (q.status === 'convertida' ? ' Ya se generó su reserva.' : ' Su asesor confirmará la reserva y los servicios.')) : '') +
      (q.status === 'rechazada' ? UI.alert('info', 'Propuesta rechazada' + (q.rejectedReason ? ': ' + esc(q.rejectedReason) : '') + '. Si desea retomarla, escriba a su asesor.') : '') +
      '<div class="grid g-2-1" style="align-items:start"><div class="stack">' +
      UI.card('Detalle de la propuesta', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Servicio</th><th>Fecha</th><th class="num">Pax</th><th class="num">P. unitario</th><th class="num">Subtotal</th></tr></thead><tbody>' + t.lines.map(l => '<tr><td><div class="cell-main">' + esc(Q.productName(l.productId)) + '</div><div class="cell-sub">' + esc(l.segment) + (l.qty > 1 ? ' · ' + l.qty + ' servicios' : '') + '</div></td><td class="nowrap">' + date(l.date) + '</td><td class="num">' + l.pax + '</td><td class="num">' + money(l.unitPrice, q.currency) + '</td><td class="num">' + money(l.saleTotal, q.currency) + '</td></tr>').join('') + '</tbody></table></div>' + (v.notes ? '<div class="card-b small muted" style="border-top:1px solid var(--line-2)">' + esc(v.notes) + '</div>' : ''), { tight: true }) +
      prods.map(p => UI.card(esc(p.name), '<div class="grid g2"><div><div class="upper" style="margin-bottom:6px">Incluye</div><ul class="ck-list yes">' + (p.inclusions || []).map(i => '<li>' + ic('check') + esc(i) + '</li>').join('') + '</ul></div><div><div class="upper" style="margin-bottom:6px">Condiciones</div><div class="small muted">' + esc((p.policies || {}).cancel || '') + '</div></div></div>')).join('') +
      '</div><div class="stack sticky-side">' + UI.card('Resumen', '<div class="stat-line"><span>Subtotal</span><span class="num">' + money(t.sale, q.currency) + '</span></div>' + (t.discount ? '<div class="stat-line"><span class="ok">Descuento ' + v.discountPct + '%</span><span class="num ok">− ' + money(t.discount, q.currency) + '</span></div>' : '') + '<div class="stat-line"><span>IGV ' + v.taxPct + '%</span><span class="num">' + money(t.tax, q.currency) + '</span></div><div class="stat-line total"><span>Total</span><span class="num">' + money(t.total, q.currency) + '</span></div><div class="xs faint" style="margin-top:6px">Válida hasta el ' + date(q.validUntil) + (open ? ' (' + daysFromToday(q.validUntil) + ' días)' : '') + ' · ' + (q.pax.adt + q.pax.chd + q.pax.inf) + ' pasajeros</div>' +
        (open ? '<div class="col" style="margin-top:14px"><button class="btn primary" id="pq-ok" style="justify-content:center;height:38px">' + ic('checkCircle') + 'Aprobar propuesta</button><button class="btn" id="pq-no" style="justify-content:center">' + ic('x') + 'Rechazar</button></div>' : ''), { footer: '<button class="btn sm ghost" id="pq-pdf">' + ic('download') + 'Descargar PDF</button>' }) +
      UI.card('¿Dudas?', '<div class="row">' + UI.avatar(ex) + '<div><b class="small">' + esc(ex.name || '') + '</b><div class="xs faint">' + esc(ex.phone || '') + '</div></div></div>') + '</div></div>';
    b.querySelector('#pq-pdf').onclick = () => showDoc('Propuesta ' + q.id, quoteDoc(q));
    const up = b.querySelector('#pq-upd'); if (up) up.onclick = () => { const tk = newTicket(x, 'Solicitud de actualización de ' + q.id, 'Cotizaciones', 'media', 'La cotización venció el ' + date(q.validUntil) + '. Solicito una versión actualizada.', null); UI.toast('Solicitud ' + tk.id + ' enviada a su asesor.'); };
    const okb = b.querySelector('#pq-ok'); if (okb) okb.onclick = () => UI.modal({ title: 'Aprobar propuesta ' + q.id, sub: 'Versión ' + v.v + ' · ' + money(t.total, q.currency), body: UI.alert('info', 'Al aprobar se registra su aceptación con fecha, hora, IP y la versión exacta de la propuesta (snapshot inmutable). Su asesor procederá a confirmar la reserva.') + '<div class="form-grid" style="margin-top:14px">' + UI.field({ id: 'ap_name', label: 'Nombre completo de quien aprueba', required: true, value: x.who, col: 12 }) + UI.field({ id: 'ap_note', label: 'Comentario para el asesor (opcional)', type: 'textarea', rows: 2, col: 12 }) + UI.field({ id: 'ap_tc', label: 'He leído y acepto las condiciones, políticas de cancelación y precios de esta propuesta.', type: 'checkbox', col: 12 }) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Aprobar propuesta', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        if (!f.ap_tc) { UI.toast('Debe aceptar las condiciones para aprobar.', 'bad'); return false; }
        if (qExpired(q)) { UI.toast('La cotización venció: no puede aprobarse.', 'bad'); return false; }
        const bf = q.status; const ts = nowStr();
        q.status = 'aprobada'; v.status = 'aprobada'; q.approvedAt = ts; q.approvedBy = f.ap_name + ' (portal cliente)';
        q.approval = { ts, name: f.ap_name, ip: '181.176.' + (20 + Math.floor(Math.random() * 200)) + '.' + (2 + Math.floor(Math.random() * 250)), channel: 'Portal cliente', token: q.token, version: v.v, total: t.total, currency: q.currency, note: f.ap_note, hash: 'sha256:' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) };
        Store.save();
        Audit.log('Cotización', q.id, 'aprobar_portal', bf, 'aprobada v' + v.v + ' · ' + f.ap_name + ' · IP ' + q.approval.ip);
        Notify.push('cotizacion.aprobada', 'Portal', q.owner, q.id + ' aprobada por el cliente desde el portal');
        Notify.push('cotizacion.aprobada', 'Email', x.cl.email, 'Confirmamos la aprobación de su propuesta ' + q.id);
        UI.toast('Propuesta aprobada. Su asesor fue notificado.'); App.render();
      } }] });
    const nob = b.querySelector('#pq-no'); if (nob) nob.onclick = () => UI.modal({ title: 'Rechazar propuesta ' + q.id, size: 'sm', body: UI.form([{ id: 'rj_r', label: 'Motivo', type: 'select', options: ['Precio', 'Cambio de fechas', 'Eligió otra agencia', 'Cambio de destino', 'Viaje cancelado', 'Otro'], col: 12 }, { id: 'rj_c', label: 'Comentario', type: 'textarea', rows: 3, required: true, col: 12 }]),
      actions: [{ label: 'Volver' }, { label: 'Rechazar', cls: 'danger', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const bf = q.status;
        q.status = 'rechazada'; v.status = 'rechazada'; q.rejectedReason = f.rj_r + ': ' + f.rj_c; q.rejectedAt = nowStr();
        Store.save(); Audit.log('Cotización', q.id, 'rechazar_portal', bf, 'rechazada · ' + f.rj_r);
        Notify.push('cotizacion.rechazada', 'Portal', q.owner, q.id + ' rechazada por el cliente: ' + f.rj_r);
        UI.toast('Registramos su respuesta. Gracias.'); App.render();
      } }] });
  }
  function pcResList(b, x) {
    b.innerHTML = '<div><h2>Mis viajes</h2><div class="small muted">Estado de sus reservas, servicios confirmados y pasajeros.</div></div>' + (x.res.length ? '<div class="grid g2">' + x.res.map(r => { const done = r.services.filter(s => s.status === 'confirmado' || s.status === 'completado').length; return UI.card(esc(r.title), '<div class="row between"><span class="mono small">' + esc(r.id) + '</span>' + UI.badge(r.status) + '</div><div class="small muted" style="margin:6px 0 10px">' + date(r.travelFrom) + ' — ' + date(r.travelTo) + ' · ' + r.passengers.length + ' pasajeros · ' + money(r.total, r.currency) + '</div><div class="row between xs"><span>Servicios confirmados</span><span>' + done + ' de ' + r.services.length + '</span></div>' + UI.progress(done / (r.services.length || 1) * 100, 'ok'), { footer: '<a class="btn sm" href="' + x.base + 'reservas/' + r.id + '">Ver detalle</a>' }); }).join('') + '</div>' : UI.card('', UI.empty('Aún no tiene reservas.', 'suitcase')));
  }
  function pcRes(b, x, rid) {
    const r = x.res.find(y => y.id === rid); if (!r) { b.innerHTML = UI.card('', UI.empty('Reserva no disponible.', 'suitcase')); return; }
    const vs = DB.vouchers.filter(v => v.resId === r.id && v.status !== 'anulado');
    const idx = { pendiente_pago: 0, pendiente_proveedor: 0, pendiente_disponibilidad: 0, confirmada: 1, en_operacion: 2, completada: 4 }[r.status];
    const web = pcWebSummary(r, x); const inTrip = pcInTrip(r, x);
    b.innerHTML = '<div class="crumbs"><a href="' + x.base + 'reservas">Mis viajes</a><span>/</span><span>' + esc(r.id) + '</span></div><div class="row between"><div><h2>' + esc(r.title) + '</h2><div class="small muted">' + date(r.travelFrom) + ' — ' + date(r.travelTo) + '</div></div>' + UI.badge(r.status) + '</div>' +
      UI.card('', UI.flow(['Registrada', 'Confirmada', 'En viaje', 'Finalizada'], idx == null ? 0 : idx, r.status === 'cancelada' ? 1 : undefined)) + web.html + inTrip.html +
      (r.status === 'pendiente_proveedor' ? UI.alert('warn', 'Algunos servicios esperan confirmación del proveedor. Le avisaremos por correo y en este portal.') : '') +
      '<div class="grid g-2-1" style="align-items:start">' + UI.card('Servicios', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>' + r.services.slice().sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time)).map(s => '<tr><td class="nowrap">' + dateShort(s.date) + ' <span class="faint">' + esc(s.time) + '</span></td><td>' + esc(s.name) + '</td><td>' + UI.badge(s.status) + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      '<div class="stack">' + UI.card('Pasajeros (' + r.passengers.length + ')', '<div class="list">' + r.passengers.map(p => '<div class="list-item" style="padding:8px 0">' + UI.avatar({ name: p.name, color: 'var(--fg-3)' }) + '<div class="grow"><div class="small">' + esc(p.name) + '</div><div class="xs faint">' + [p.relationship, p.doc, p.type, p.age != null ? p.age + ' años' : ''].filter(Boolean).map(esc).join(' · ') + '</div></div></div>').join('') + '</div>') +
      UI.card('Documentos del viaje', vs.length ? '<div class="col">' + vs.map(v => '<button class="btn sm" data-v="' + v.id + '">' + ic('ticket') + esc(v.service) + '</button>').join('') + '</div>' : '<div class="small muted">Los vouchers estarán disponibles cuando los servicios estén confirmados.</div>', { footer: '<button class="btn sm ghost" id="pr-it">' + ic('download') + 'Itinerario PDF</button>' }) + '</div></div>';
    b.querySelectorAll('[data-v]').forEach(bt => bt.onclick = () => showDoc('Voucher ' + bt.dataset.v, voucherDoc(DB.vouchers.find(v => v.id === bt.dataset.v))));
    b.querySelector('#pr-it').onclick = () => showDoc('Itinerario ' + r.id, tripDoc(r));
    web.bind(b); inTrip.bind(b);
  }
  /* v2.8 · Venta en ruta (spec 21 · R-IN-TRIP-SALES): tours y movilidad de los tramos que faltan, con link de pago.
     El precio final lo confirma el servidor (BookingEngine en el prototipo); aquí solo se lista la oferta vigente. */
  function inTripOffers(r) {
    const p = PX.product(r); const k = r.booking; if (!p || !p.trip || !k || !k.tripLegs) return null;
    if (!PX.on('R-IN-TRIP-SALES', r) || !['confirmada', 'en_operacion', 'pendiente_proveedor'].includes(r.status)) return null;
    const minH = PX.param('R-IN-TRIP-SALES', 'minHoursBefore', r) || 12;
    const have = new Set(r.services.map(s => s.tourId || s.transportId).filter(Boolean));
    const legOf = (id) => k.tripLegs.find(l => l.legId === id);
    const pax = k.pax || { adt: r.passengers.length, chd: 0 }; const people = (pax.adt || 0) + (pax.chd || 0);
    const cutoff = Util.parseD(nowStr()); cutoff.setHours(cutoff.getHours() + minH);
    const startOf = (d, t) => Util.parseD(d + ' ' + (t || '08:00'));
    const out = [];
    p.trip.tours.filter(t => t.inTrip !== false && !have.has(t.id)).forEach(t => { const l = legOf(t.legId); if (!l) return; const d = addDays(l.checkIn, t.dayOffset || 0); if (startOf(d, t.time) < cutoff) return;
      out.push({ id: t.id, kind: 'tour', city: l.city, name: t.name, date: d, time: t.time, amount: Math.round(((pax.adt || 0) * t.priceAdt + (pax.chd || 0) * (t.priceChd || 0)) * 100) / 100, legId: t.legId }); });
    const pairs = new Set(r.services.filter(s => s.transportId).map(s => { const t = p.trip.transport.find(z => z.id === s.transportId); return t ? t.fromLegId + '>' + t.toLegId : ''; }));
    p.trip.transport.filter(t => !have.has(t.id) && !(t.toLegId && pairs.has(t.fromLegId + '>' + t.toLegId))).forEach(t => { const l = legOf(t.fromLegId); if (!l) return; const d = t.toLegId ? l.checkOut : l.checkIn; if (startOf(d, '08:00') < cutoff) return;
      let amount; if (t.pricing === 'vehiculo') { const v = (t.vehicles || []).slice().sort((a, c) => a.maxPax - c.maxPax).find(z => z.maxPax >= people) || (t.vehicles || [])[t.vehicles.length - 1]; amount = v ? v.price * Math.ceil(people / v.maxPax) : 0; } else amount = (pax.adt || 0) * t.priceAdt + (pax.chd || 0) * (t.priceChd || 0);
      out.push({ id: t.id, kind: 'transport', city: l.city, name: t.name, mode: t.kind, date: d, time: '—', amount: Math.round(amount * 100) / 100, legId: t.fromLegId }); });
    return { p, list: out.sort((a, c) => a.date.localeCompare(c.date)), minH, cur: (p.trip.currency || r.currency) };
  }
  function pcInTrip(r, x) {
    const o = inTripOffers(r); if (!o) return { html: '', bind: () => { } };
    const rows = o.list.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Ciudad</th><th>Servicio</th><th class="num">Precio</th><th></th></tr></thead><tbody>' + o.list.map(z => '<tr><td class="nowrap">' + dateShort(z.date) + (z.time !== '—' ? ' <span class="faint">' + esc(z.time) + '</span>' : '') + '</td><td>' + esc(z.city) + '</td><td>' + (z.kind === 'tour' ? 'Tour · ' : 'Movilidad · ') + esc(z.name) + '</td><td class="num nowrap">' + money(z.amount, o.cur) + '</td><td style="text-align:right"><button class="btn xs primary" data-itb="' + z.id + '">' + ic('card') + 'Agregar y pagar</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="small muted">Ya tiene todo lo disponible para los tramos que faltan.</div>';
    const html = UI.card('Agregar en ruta', '<div class="small muted" style="margin-bottom:8px">Sume tours y movilidad de las ciudades que le faltan. Se reservan hasta ' + o.minH + ' h antes; el pago se hace con un link seguro y el voucher llega al confirmar el proveedor.</div>' + rows, { tight: false });
    const bind = (b) => b.querySelectorAll('[data-itb]').forEach(bt => bt.onclick = () => {
      const z = o.list.find(y => y.id === bt.dataset.itb); if (!z) return;
      UI.modal({ title: 'Agregar en ruta', sub: esc(z.name) + ' · ' + date(z.date), body: UI.dl([['Ciudad', esc(z.city)], ['Pasajeros', String(r.passengers.length)], ['Precio', '<b>' + money(z.amount, o.cur) + '</b>'], ['Pago', 'Link de pago (tarjeta, PayPal o Yape según la pasarela activa de la agencia)']]) + '<div class="xs faint" style="margin-top:8px">El precio lo vuelve a calcular el servidor al confirmar. Si el proveedor no confirma, se devuelve el pago completo.</div>',
        actions: [{ label: 'Cancelar' }, { label: 'Generar link de pago', cls: 'primary', icon: 'card', onClick: () => {
          const sid = nextId(allServices(), 'RS-', 4);
          r.services.push({ id: sid, productId: null, tourId: z.kind === 'tour' ? z.id : undefined, transportId: z.kind === 'transport' ? z.id : undefined, name: (z.kind === 'tour' ? 'Tour ' + z.city + ' · ' : 'Movilidad ') + z.name, date: z.date, time: z.time, providerId: o.p.mainProviderId, status: 'solicitado', cost: Math.round(z.amount / 1.25 * 100) / 100, price: z.amount, confirmationCode: '', kind: z.kind === 'tour' ? 'tour_tramo' : 'movilidad', legId: z.legId, extraOf: o.p.id, soldInTrip: true });
          const rc = { id: nextId(DB.receivables, 'CXC-', 5), resId: r.id, clientId: r.clientId, concept: 'Venta en ruta — ' + z.name, amount: z.amount, currency: o.cur, due: T(), paid: 0, status: 'abierta', kind: 'en_ruta' };
          DB.receivables.unshift(rc); r.total = Math.round((r.total + z.amount) * 100) / 100;
          (DB.inTripOffers = DB.inTripOffers || []).unshift({ id: 'ITO-' + String((DB.inTripOffers.length || 0) + 1).padStart(4, '0'), resId: r.id, itemId: z.id, kind: z.kind, date: z.date, amount: z.amount, currency: o.cur, status: 'link_enviado', serviceId: sid, receivableId: rc.id, createdAt: nowStr() });
          Store.save(); Audit.log('Venta en ruta', r.id, 'agregar', '', z.kind + ' ' + z.id + ' · ' + money(z.amount, o.cur)); Notify.push('venta_ruta.link', 'Email', x.cl.email, 'Link de pago — ' + z.name);
          setTimeout(() => payOnline(x, rc), 50);
        } }] });
    });
    return { html, bind };
  }
  /* v2.1 · Resumen de la reserva web en el portal del cliente. Cada bloque depende de su regla (BookingEngine.on). */
  function pcWebSummary(r, x) {
    const k = PX.bk(r); const cmp = PX.companions(r);
    const miss = cmp.show ? r.passengers.filter(p => PX.missing(p, cmp.requireDoc)) : [];
    const rcvOpen = DB.receivables.filter(c => c.resId === r.id && c.status !== 'cancelada' && c.amount - c.paid > 0.004).sort((a, c) => a.due.localeCompare(c.due));
    const payHere = (c) => '<button class="btn sm primary" data-psal="' + c.id + '">' + ic('card') + 'Pagar saldo · ' + money(c.amount - c.paid, c.currency) + '</button>';
    const compBtn = cmp.show && miss.length ? UI.alert('warn', '<b>Faltan datos de ' + miss.length + ' acompañante(s).</b> Complételos antes del ' + date(cmp.deadline) + ' (entradas y trenes nominativos). ' + (cmp.editable ? '<button class="btn xs primary" id="pc-comp" style="margin-left:6px">Completar acompañantes</button>' : 'El plazo venció: escriba a su asesor.')) : '';
    if (!k) return { html: compBtn + (rcvOpen.length ? UI.alert('info', 'Tiene un saldo pendiente de ' + money(rcvOpen[0].amount - rcvOpen[0].paid, rcvOpen[0].currency) + ' con vencimiento el ' + date(rcvOpen[0].due) + '. ' + payHere(rcvOpen[0])) : ''), bind: (b) => bindWeb(b) };
    const bb = k.b; const multi = PX.on('R-MULTICURRENCY', r) && k.disp !== k.cur;
    const px = bb.pax || { adt: r.passengers.filter(p => p.type === 'ADT').length, chd: r.passengers.filter(p => p.type === 'CHD').length, inf: r.passengers.filter(p => p.type === 'INF').length };
    const amt = (n) => k.fmt(n) + (multi ? ' <span class="xs faint">≈ ' + k.fmt(k.inDisp(n), k.disp) + '</span>' : '');
    const blocks = [];
    if (PX.on('R-LODGING', r) && k.lodging.length) blocks.push('<div><div class="upper" style="margin-bottom:6px">Alojamiento por ciudad</div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Ciudad</th><th>Hotel</th><th>Habitación</th><th class="num">Hab.</th><th class="num">Noches</th></tr></thead><tbody>' + k.lodging.map(l => '<tr><td>' + esc(l.city) + '</td><td>' + esc(l.hotel) + '</td><td>' + esc(l.roomType) + '</td><td class="num">' + (l.rooms || 0) + '</td><td class="num">' + (l.nights || 0) + '</td></tr>').join('') + '</tbody><tfoot><tr><td colspan="3">Total</td><td class="num">' + k.rooms + ' hab.</td><td class="num">' + k.nights + ' noches</td></tr></tfoot></table></div></div>');
    if (PX.on('R-ADDONS', r) && (bb.addons || []).length) blocks.push('<div><div class="upper" style="margin-bottom:6px">Adicionales</div>' + bb.addons.map(a => '<div class="stat-line"><span>' + esc(a.name) + ' × ' + a.qty + '</span><span class="num">' + amt(a.amount) + '</span></div>').join('') + '</div>');
    const pk = bb.pickup;
    if (PX.on('R-PICKUP', r) && pk && pk.point) blocks.push('<div><div class="upper" style="margin-bottom:6px">Punto de recojo</div>' + UI.dl([['Punto', esc(pk.point)], pk.address ? ['Referencia', esc(pk.address)] : null, pk.flight ? ['Vuelo de llegada', esc(pk.flight) + (pk.arrival ? ' · ' + datetime(pk.arrival) : '')] : null]) + '</div>');
    if (PX.on('R-COMMENTS', r) && bb.comments) blocks.push('<div><div class="upper" style="margin-bottom:6px">Sus comentarios</div><div class="pxs-quote">' + esc(bb.comments) + '</div></div>');
    const pay = bb.payment || {};
    const plan = (pay.mode && pay.mode !== 'total' && (PX.on('R-DEPOSIT', r) || PX.on('R-PAY-LATER', r))) || pay.mode === 'total' ? '<div class="stat-line"><span>Total de la reserva</span><b class="num">' + amt(bb.total != null ? bb.total : r.total) + '</b></div>' + (pay.mode === 'adelanto' ? '<div class="stat-line"><span>Adelanto ' + (pay.depositPct || '') + ' %</span><span class="num">' + amt(pay.deposit || 0) + '</span></div><div class="stat-line"><span>Saldo</span><b class="num">' + amt(pay.balance || 0) + '</b></div><div class="stat-line"><span>Vencimiento del saldo</span><span>' + (pay.balanceDue ? date(pay.balanceDue) : '—') + '</span></div>' : pay.mode === 'pagar_despues' ? '<div class="stat-line"><span>Modalidad</span><span>Reservar ahora, pagar después</span></div>' : '<div class="stat-line"><span>Modalidad</span><span>Pago total</span></div>') : '';
    const saldoTxt = rcvOpen.length ? '<div class="row between" style="margin-top:10px;gap:8px"><span class="small ' + (rcvOpen[0].due < T() ? 'bad' : 'warn') + '">Saldo pendiente ' + money(rcvOpen.reduce((a, c) => a + c.amount - c.paid, 0), rcvOpen[0].currency) + ' · vence ' + date(rcvOpen[0].due) + (rcvOpen[0].due < T() ? ' (vencido)' : '') + '</span>' + payHere(rcvOpen[0]) + '</div>' : (plan ? '<div class="small ok" style="margin-top:8px">' + ic('checkCircle') + ' Sin saldo pendiente</div>' : '');
    const head = '<div class="row between" style="margin-bottom:10px"><div class="small muted">Reservado en ' + esc(r.channel || 'web') + ' · ' + px.adt + ' adulto(s)' + (px.chd ? ' · ' + px.chd + ' niño(s)' : '') + (px.inf ? ' · ' + px.inf + ' infante(s)' : '') + (PX.on('R-LODGING', r) && k.lodging.length ? ' · ' + k.rooms + ' habitaciones · ' + k.nights + ' noches' : '') + '</div>' + (multi ? '<span class="xs faint">Precios mostrados en ' + esc(k.disp) + ', cobrados en ' + esc(k.cur) + ' (TC referencial)</span>' : '') + '</div>';
    const html = compBtn + '<div class="grid g-2-1" style="align-items:start">' + UI.card('Resumen de su reserva', head + (blocks.length ? '<div class="stack">' + blocks.join('') + '</div>' : '<div class="small muted">Tour sin alojamiento ni adicionales.</div>')) + UI.card('Plan de pago', (plan || '<div class="small muted">Consulte el detalle con su asesor.</div>') + saldoTxt) + '</div>';
    function bindWeb(b) {
      b.querySelectorAll('[data-psal]').forEach(bt => bt.onclick = () => { if (Auth.role !== 'customer' && !Auth.can('finance.payments.register')) { UI.toast('Vista previa: el pago en línea lo realiza el cliente desde su portal (requiere finance.payments.register para registrarlo internamente).', 'info'); return; } payOnline(x, DB.receivables.find(c => c.id === bt.dataset.psal)); });
      const cb = b.querySelector('#pc-comp'); if (cb) cb.onclick = () => companionsModal(r, { name: x.who, email: x.cl.email, phone: x.cl.phone, id: x.cid }, 'Portal cliente');
    }
    return { html, bind: bindWeb };
  }
  function pcDocs(b, x) {
    const docs = [].concat(
      DB.vouchers.filter(v => x.resIds.includes(v.resId) && v.status !== 'anulado').map(v => ({ id: v.id, kind: 'Voucher', name: v.service, res: v.resId, date: v.issuedAt.split(' ')[0], status: v.status, open: () => showDoc('Voucher ' + v.id, voucherDoc(v)) })),
      DB.invoices.filter(i => i.clientId === x.cid).map(i => ({ id: i.id, kind: i.type, name: i.detail, res: i.resId, date: i.date, status: i.status, open: () => showDoc(i.type + ' ' + i.id, invoiceDoc(i)) })),
      x.quotes.filter(q => ['aprobada', 'convertida'].includes(q.status)).map(q => ({ id: q.id, kind: 'Propuesta aprobada', name: q.title, res: '—', date: (q.approvedAt || q.createdAt).split(' ')[0], status: 'aprobada', open: () => showDoc('Propuesta ' + q.id, quoteDoc(q)) })),
      x.res.filter(r => ['confirmada', 'en_operacion', 'completada'].includes(r.status)).map(r => ({ id: 'ITI-' + r.id.slice(-6), kind: 'Itinerario', name: r.title, res: r.id, date: r.createdAt.split(' ')[0], status: 'emitido', open: () => showDoc('Itinerario ' + r.id, tripDoc(r)) }))
    );
    b.innerHTML = '<div><h2>Documentos</h2><div class="small muted">Vouchers, comprobantes electrónicos, itinerarios y propuestas aprobadas.</div></div><div id="pcd"></div>';
    UI.dataTable(b.querySelector('#pcd'), { exportName: 'mis_documentos', rows: docs, search: ['id', 'kind', 'name', 'res'], pageSize: 10, defaultSort: 'date', defaultDir: -1,
      filters: [{ label: 'Tipo', key: 'kind', options: [...new Set(docs.map(d => d.kind))].map(k => [k, k]) }],
      columns: [{ key: 'id', label: 'Documento', render: d => '<span class="mono">' + esc(d.id) + '</span>' }, { key: 'kind', label: 'Tipo' }, { key: 'name', label: 'Descripción' }, { key: 'res', label: 'Reserva', render: d => '<span class="mono small">' + esc(d.res) + '</span>' }, { key: 'date', label: 'Fecha', render: d => date(d.date) }, { key: 'status', label: 'Estado', render: d => UI.badge(d.status) }, { key: 'act', label: '', sort: false, render: () => '<span class="btn xs">' + ic('eye') + 'Ver</span>' }],
      onRow: d => d.open() });
  }
  function pcPays(b, x) {
    const pays = DB.payments.filter(p => x.resIds.includes(p.resId)).sort((a, c) => c.date.localeCompare(a.date));
    b.innerHTML = '<div><h2>Pagos</h2><div class="small muted">Saldos pendientes, pagos en línea e historial.</div></div>' +
      UI.card('Obligaciones', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Concepto</th><th>Reserva</th><th>Vence</th><th class="num">Importe</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>' + (x.rcv.length ? x.rcv.map(r => { const s = r.amount - r.paid; const pend = pays.filter(p => p.receivableId === r.id && p.status === 'pendiente'); return '<tr><td>' + esc(r.concept) + (pend.length ? '<div class="cell-sub warn">Pago por validar: ' + money(sum(pend, 'amount'), r.currency) + '</div>' : '') + '</td><td class="mono small">' + esc(r.resId) + '</td><td class="nowrap">' + date(r.due) + '</td><td class="num">' + money(r.amount, r.currency) + '</td><td class="num">' + money(r.paid, r.currency) + '</td><td class="num"><b>' + money(s, r.currency) + '</b></td><td>' + UI.badge(r.status) + '</td><td>' + (s > 0.004 ? '<button class="btn xs primary" data-pay="' + r.id + '">' + ic('card') + 'Pagar en línea</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="8">' + UI.empty('Sin obligaciones registradas', 'wallet') + '</td></tr>') + '</tbody></table></div>', { tight: true }) +
      UI.card('Historial de pagos', pays.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pago</th><th>Fecha</th><th>Medio</th><th>Referencia</th><th class="num">Monto</th><th>Estado</th></tr></thead><tbody>' + pays.map(p => '<tr><td class="mono">' + esc(p.id) + '</td><td>' + date(p.date) + '</td><td>' + esc(p.method) + '</td><td class="small">' + esc(p.ref) + '</td><td class="num">' + money(p.amount, p.currency) + '</td><td>' + UI.badge(p.status === 'pendiente' ? 'por_validar' : p.status) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin pagos', 'card'), { tight: true });
    b.querySelectorAll('[data-pay]').forEach(bt => bt.onclick = () => payOnline(x, DB.receivables.find(y => y.id === bt.dataset.pay)));
  }
  /* Pago en línea de una obligación (también lo usa «Pagar saldo» del detalle del viaje) */
  function payOnline(x, r) {
    {
      const s = Math.round((r.amount - r.paid) * 100) / 100;
      UI.modal({ title: 'Pagar en línea', sub: esc(r.concept) + ' · saldo ' + money(s, r.currency), body: UI.form([
        { id: 'pp_amt', label: 'Monto a pagar (' + r.currency + ')', type: 'number', step: '0.01', min: 1, max: s, value: s.toFixed(2), required: true, col: 6, hint: 'Puede realizar pagos parciales.' },
        { id: 'pp_card', label: 'Número de tarjeta', required: true, value: '4111 1111 1111 1111', col: 6 },
        { id: 'pp_name', label: 'Titular', required: true, value: x.who, col: 8 }, { id: 'pp_exp', label: 'Vence', required: true, value: '11/28', col: 4 }
      ]) + '<div class="testcard" style="margin-top:10px"><button type="button" class="btn xs" data-tc="4111 1111 1111 1111">4111… aprobada</button><button type="button" class="btn xs" data-tc="4000 0000 0000 0002">4000… rechazada</button></div>',
        onOpen: (m) => m.querySelectorAll('[data-tc]').forEach(z => z.onclick = () => { m.querySelector('#pp_card').value = z.dataset.tc; }),
        actions: [{ label: 'Cancelar' }, { label: 'Pagar', cls: 'primary', icon: 'lock', onClick: (m) => {
          if (!UI.validate(m)) return false; const f = UI.formData(m); const amt = Math.round(Number(f.pp_amt) * 100) / 100;
          if (!(amt > 0) || amt > s + 0.004) { UI.toast('El monto debe ser mayor a 0 y no superar el saldo (Regla 9: pago asociado a obligación).', 'bad'); return false; }
          const cr = cardResult(f.pp_card);
          if (cr !== 'ok') {
            const p = addPayment({ receivableId: r.id, resId: r.resId, method: 'Tarjeta (portal cliente)', amount: amt, currency: r.currency, status: 'rechazado', ref: 'Rechazo emisor', by: 'Sistema' });
            Store.save(); Audit.log('Pago', p.id, 'pago_rechazado', '', 'Portal cliente · ' + money(amt, r.currency)); Notify.push('pago.rechazado', 'Email', x.cl.email, 'Pago rechazado — ' + r.concept);
            UI.toast('Pago rechazado por el emisor. La obligación se mantiene; puede reintentar con otra tarjeta.', 'bad'); App.render(); return;
          }
          const bf = r.status;
          const p = addPayment({ receivableId: r.id, resId: r.resId, method: 'Tarjeta (portal cliente)', amount: amt, currency: r.currency, status: 'aplicado', ref: 'TXN ' + rnd(4) + '-' + rnd(4), by: 'Sistema' });
          r.paid = Math.round((r.paid + amt) * 100) / 100; r.status = r.paid >= r.amount - 0.004 ? 'pagada' : (r.due < T() ? 'vencida' : 'parcial');
          Store.save(); Audit.log('Pago', p.id, 'registrar_portal', bf, r.status + ' · ' + money(amt, r.currency)); Notify.push('pago.recibido', 'Email', x.cl.email, 'Recibimos su pago de ' + money(amt, r.currency)); Notify.push('pago.recibido', 'Portal', 'U07', 'Pago en línea ' + p.id + ' · ' + x.cl.name);
          UI.toast('Pago ' + p.id + ' aplicado por ' + money(amt, r.currency) + '.'); App.render();
        } }] });
    }
  }
  function pcNotes(b, x) {
    const quotesN = x.quotes.filter(q => q.viewedAt).map(q => ({ ts: q.approvedAt || q.viewedAt, event: 'cotizacion', channel: 'Portal', subject: 'Propuesta ' + q.id + ': ' + UI.statusLabel(q.status), status: 'enviado' }));
    const list = x.notes.concat(quotesN).sort((a, c) => String(c.ts).localeCompare(String(a.ts)));
    const icn = { Email: 'mail', WhatsApp: 'msg', Push: 'phone', Portal: 'globe' };
    b.innerHTML = '<div><h2>Notificaciones</h2><div class="small muted">Avisos enviados por correo, WhatsApp y este portal (PROC-059).</div></div>' + UI.card('', list.length ? '<div class="list">' + list.map(n => '<div class="list-item"><div class="ico-box ' + (n.status === 'fallido' ? 'bad' : '') + '">' + ic(icn[n.channel] || 'bell') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(n.subject) + '</div><div class="xs faint">' + esc(n.channel) + ' · ' + datetime(n.ts) + '</div></div>' + UI.badge(n.status) + '</div>').join('') + '</div>' : UI.empty('Sin notificaciones', 'bell'), { tight: true });
  }
  function newTicket(x, subject, cat, prio, msg, resId) {
    const tk = { id: nextId(ensureTickets(), 'TCK-', 4), clientId: x.cid, subject, category: cat, priority: prio, message: msg, resId: resId || null, status: 'abierta', createdAt: nowStr(), owner: x.cl.owner, log: [{ ts: nowStr(), m: 'Ticket creado desde el portal del cliente' }] };
    DB.supportTickets.unshift(tk); Store.save();
    Audit.log('Ticket soporte', tk.id, 'crear', '', subject);
    Notify.push('soporte.ticket', 'Portal', x.cl.owner, 'Nuevo ticket ' + tk.id + ' de ' + x.cl.name + ': ' + subject);
    return tk;
  }
  function pcSupport(b, x) {
    const tks = ensureTickets().filter(t => t.clientId === x.cid);
    b.innerHTML = '<div><h2>Soporte</h2><div class="small muted">Cree una solicitud y su asesor le responderá en un plazo máximo de 4 horas hábiles. Durante el viaje use la central 24/7 <b>' + EMERGENCY + '</b>.</div></div><div class="grid g-1-2" style="align-items:start">' +
      UI.card('Nueva solicitud', UI.form([
        { id: 'tk_s', label: 'Asunto', required: true, col: 12 },
        { id: 'tk_c', label: 'Categoría', type: 'select', options: ['Cambio de fecha', 'Documentos', 'Facturación', 'Pagos', 'Cotizaciones', 'Reclamo', 'Consulta general'], col: 6 },
        { id: 'tk_p', label: 'Prioridad', type: 'select', options: [['media', 'Normal'], ['alta', 'Alta'], ['baja', 'Baja']], col: 6 },
        { id: 'tk_r', label: 'Reserva relacionada', type: 'select', placeholder: 'Ninguna', options: x.res.map(r => [r.id, r.id + ' · ' + r.title]), col: 12 },
        { id: 'tk_m', label: 'Mensaje', type: 'textarea', rows: 4, required: true, col: 12 }
      ]), { footer: '<button class="btn primary" id="tk-go">' + ic('send') + 'Enviar solicitud</button>' }) +
      UI.card('Mis solicitudes (' + tks.length + ')', tks.length ? '<div class="list">' + tks.map(t => '<div class="list-item"><div class="ico-box ' + (t.priority === 'alta' ? 'warn' : '') + '">' + ic('msg') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(t.subject) + '</div><div class="xs faint"><span class="mono">' + esc(t.id) + '</span> · ' + esc(t.category) + ' · ' + datetime(t.createdAt) + (t.resId ? ' · ' + esc(t.resId) : '') + '</div><div class="xs muted" style="margin-top:3px">' + esc(t.message) + '</div></div>' + UI.badge(t.status) + '</div>').join('') + '</div>' : UI.empty('No tiene solicitudes abiertas.', 'msg'), { tight: true }) + '</div>';
    b.querySelector('#tk-go').onclick = () => { const form = b.querySelector('.form-grid').parentElement; if (!UI.validate(form)) return; const f = UI.formData(form); const tk = newTicket(x, f.tk_s, f.tk_c, f.tk_p, f.tk_m, f.tk_r); UI.toast('Solicitud ' + tk.id + ' registrada. Su asesor fue notificado.'); App.render(); };
  }

  /* =====================================================================================
     PORTAL DEL PASAJERO — PROC-052
     ===================================================================================== */
  const PAX_RES = 'RES-2026-000347';
  let paxSess = null; try { paxSess = localStorage.getItem('kipucontrol_pax_sess'); } catch (e) { }
  const setPax = (v) => { paxSess = v; try { v ? localStorage.setItem('kipucontrol_pax_sess', v) : localStorage.removeItem('kipucontrol_pax_sess'); } catch (e) { } };
  const svcKind = (s) => /Hotel|hab\./i.test(s.name) ? 'hotel' : (s.productId === 'PRD-005' || /Traslado|Tren|Bus/i.test(s.name)) ? 'transporte' : (/libre/i.test(s.name) ? 'libre' : 'actividad');
  const svcState = (s, r) => (svcKind(s) === 'hotel' && s.status !== 'completado' && s.date <= T() && r && r.travelTo >= T()) ? 'stay' : s.status === 'completado' || s.date < T() ? 'done' : s.date === T() ? 'today' : 'next';
  let pxR = null;
  const svcBadge = (s) => ({ done: UI.badge('completado', 'Completado'), today: UI.badge('en_curso', 'Hoy'), stay: UI.badge('en_curso', 'En curso'), next: UI.badge('abierta', 'Próximo') })[svcState(s, pxR || Q.reservation(PAX_RES))];
  /* Identidad del pasajero: el externo usa SU reserva (Auth.user.resId); los internos previsualizan la reserva de demostración */
  const leadOf = (r) => (r.passengers || []).find(p => p.isLead) || (r.passengers || [])[0] || {};
  const leadName = (r) => leadOf(r).name || Q.clientName(r.clientId);
  const leadWho = (r) => { const l = leadOf(r), c = Q.client(r.clientId) || {}; return { name: leadName(r), email: l.email || c.email || '', phone: l.phone || c.phone || '', id: r.clientId }; };
  const pxWho = () => Auth.role === 'passenger' ? { name: Auth.user.name, email: Auth.user.email, phone: Auth.user.phone, id: Auth.user.id } : { name: 'Thomas Keller', email: 't.keller@mail.de', phone: '+49 171 5550102', id: 'U15' };
  App.register('canales/portal-pasajero', (el, params) => {
    const isPax = Auth.role === 'passenger';
    /* Interno: previsualiza la reserva con la que inició sesión (demo PAX_RES o cualquier reserva web con booking) */
    const r = Q.reservation(isPax ? Auth.user.resId : (paxSess && Q.reservation(paxSess) ? paxSess : PAX_RES)); pxR = r;
    const base = '#/canales/portal-pasajero/';
    const section = params[0] || 'viajes';
    const who = pxWho();
    const bar = chBar('Portal del pasajero', 'Experiencia web que ve el pasajero ' + (r && r.id !== PAX_RES ? leadName(r) : who.name) + ' (' + (r ? r.id : PAX_RES) + ')', !isPax && paxSess ? '<button class="btn" id="px-out">' + ic('logout') + 'Cerrar sesión del pasajero</button>' : '');
    if (!r) { el.innerHTML = '<div class="page chv-page">' + (isPax ? '' : bar) + UI.card('', UI.empty(isPax ? 'No encontramos un viaje vinculado a su cuenta. Escriba a su agencia.' : 'Reserva de demostración no disponible.', 'suitcase')) + '</div>'; return; }
    if (!isPax && !paxSess) {
      el.innerHTML = '<div class="page chv-page">' + bar + shell({ sub: 'Portal del pasajero', body: '<div class="card login-card"><div class="card-h"><div><div class="t">Acceso de pasajeros</div><div class="s">Consulte su itinerario, vouchers y alertas de viaje</div></div></div><div class="card-b"><div class="form-grid">' +
        UI.field({ id: 'pl_email', label: 'Correo registrado', value: 't.keller@mail.de', col: 12 }) + UI.field({ id: 'pl_code', label: 'Código de reserva', value: PAX_RES, col: 12 }) +
        '</div><button class="btn primary" id="pl-go" style="width:100%;justify-content:center;margin-top:14px;height:38px">' + ic('lock') + 'Ingresar</button><p class="xs faint center" style="margin-top:10px">También puede ingresar con el enlace seguro enviado a su correo. Available in English · Deutsch.</p></div></div>' }) + '</div>';
      el.querySelector('#pl-go').onclick = () => {
        const em = el.querySelector('#pl_email').value.trim().toLowerCase(), code = el.querySelector('#pl_code').value.trim().toUpperCase();
        const rr = Q.reservation(code); const cl = rr && Q.client(rr.clientId);
        if (!rr || !cl || (cl.email || '').toLowerCase() !== em) { UI.toast('Correo o código de reserva no coinciden.', 'bad'); return; }
        if (code !== PAX_RES && !rr.booking) { UI.toast('En la demo el portal del pasajero está habilitado para ' + PAX_RES + ' y para las reservas web (con detalle del motor de reservas).', 'info'); return; }
        if (Scope.ownOnly() && rr.owner !== Auth.user.id) { UI.toast('La reserva ' + esc(code) + ' pertenece a la cartera de otro asesor.', 'bad'); return; }
        setPax(code); Audit.log('Sesión pasajero', code, 'login', '', em); App.go(base + 'viajes');
      };
      return;
    }
    const alerts = DB.incidents.filter(i => i.resId === r.id && ['Transporte', 'Horario'].includes(i.type) && !['cerrada', 'resuelta'].includes(i.status));
    const vs = DB.vouchers.filter(v => v.resId === r.id && v.status !== 'anulado');
    /* v2.1: Mensajes (R-PAX-MESSAGES), Comentarios (R-PAX-FEEDBACK) y Acompañantes (R-COMPANIONS «antes_de_viaje») */
    const msgOn = PX.on('R-PAX-MESSAGES', r), fbOn = PX.on('R-PAX-FEEDBACK', r), cmp = PX.companions(r, 'antes_de_viaje');
    const unreadN = msgOn ? PX.unread(r.id) : 0;
    /* v2.2: «Califica tu viaje» (R-OWN-REVIEWS, módulo resenas.js) — desaparece si la regla o el plan no la incluyen */
    const ctxWho = Auth.role === 'passenger' ? who : (r.id === PAX_RES ? who : leadWho(r));
    const rvEl = window.OwnReviews ? window.OwnReviews.eligibility(r, ctxWho) : { show: false };
    const extra = [msgOn ? ['mensajes', 'Mensajes', unreadN] : null, fbOn ? ['comentarios', 'Comentarios', 0] : null, cmp.show ? ['acompanantes', 'Acompañantes', r.passengers.filter(p => PX.missing(p, cmp.requireDoc)).length] : null, rvEl.show ? ['resena', 'Califica tu viaje', rvEl.pending] : null].filter(Boolean);
    const nav = [['viajes', 'Mi viaje'], ['itinerario', 'Itinerario'], ['hoteles', 'Hoteles'], ['transporte', 'Transporte'], ['actividades', 'Actividades'], ['vouchers', 'Vouchers'], ['documentos', 'Documentos'], ['alertas', 'Alertas']].concat(extra.map(e => [e[0], e[1]])).concat([['contacto', 'Contacto 24/7']]).map(n => ({ id: n[0], label: n[1], href: base + n[0], count: n[0] === 'alertas' ? alerts.filter(a => !a.paxAck).length : ((extra.find(e => e[0] === n[0]) || [])[2] || 0) }));
    /* El shell externo trae una navegación fija: las secciones v2.1 se ofrecen como sub-navegación dentro del portal */
    const subNav = EXT() && extra.length ? '<div class="pxs-sub-nav">' + extra.map(e => '<a class="btn sm' + (section === e[0] ? ' primary' : '') + '" href="' + base + e[0] + '">' + ic(e[0] === 'mensajes' ? 'mail' : e[0] === 'comentarios' ? 'msg' : e[0] === 'resena' ? 'star' : 'users') + esc(e[1]) + (e[2] ? ' <span class="pt-cnt">' + e[2] + '</span>' : '') + '</a>').join('') + '</div>' : '';
    const pxUser = Auth.role === 'passenger' ? who.name : (r.id === PAX_RES ? who.name : leadName(r));
    el.innerHTML = '<div class="page chv-page">' + frame(bar, { sub: 'Portal del pasajero', nav, active: section, user: userChip(pxUser, 'Reserva ' + r.id, 'var(--ok)') + '<button class="btn sm ghost" id="px-logout" title="Cerrar sesión">' + ic('logout') + '</button>', body: subNav + (alerts.filter(a => !a.paxAck).length && section !== 'alertas' ? UI.alert('bad', '<b>Alerta de viaje:</b> ' + esc(paxAlertText(alerts[0]).title) + ' <a href="' + base + 'alertas">Ver detalle</a>') : '') + '<div id="px-b" class="stack"></div>' }) + '</div>';
    const out = () => { Audit.log('Sesión pasajero', r.id, 'logout', '', ''); setPax(null); App.go(base + 'viajes'); };
    const o1 = el.querySelector('#px-out'); if (o1) o1.onclick = out; const o2 = el.querySelector('#px-logout'); if (o2) o2.onclick = out;
    const b = el.querySelector('#px-b');
    const ctx = { r, base, alerts, vs, op: DB.operations.find(o => o.resId === r.id), msgOn, fbOn, cmp, unreadN, rv: rvEl, who: ctxWho };
    const secs = { itinerario: pxItin, hoteles: pxHotels, transporte: pxTransport, actividades: pxActs, vouchers: pxVouchers, documentos: pxDocs, alertas: pxAlerts, contacto: pxContact };
    if (msgOn) secs.mensajes = pxMsgs; if (fbOn) secs.comentarios = pxFeedback; if (cmp.show) secs.acompanantes = pxCompanions; if (rvEl.show) secs.resena = pxReview;
    (secs[section] || pxTrip)(b, ctx);
  });
  function paxAlertText(i) {
    if (i.id === 'INC-0085') return { title: 'Posible cambio de horario — Machu Picchu Full Day (30 set)', body: 'Se ha anunciado un paro regional en la vía Cusco — Ollantaytambo para el 30 de setiembre. Para proteger su visita, operaciones evalúa adelantar el recojo del hotel a las 03:00 o tomar el tren desde la estación Poroy. Su coordinadora le confirmará el horario definitivo hoy antes de las 18:00 por WhatsApp y en este portal. Su entrada a Machu Picchu y su tren están garantizados.' };
    return { title: i.title, body: i.desc };
  }
  function assignFor(ctx, s) { return ctx.op && ctx.op.assignments.find(a => a.serviceId === s.id); }
  function svcRow(ctx, s) {
    const a = assignFor(ctx, s); const st = svcState(s);
    const extra = [];
    if (s.providerId) extra.push(esc(Q.providerName(s.providerId)));
    if (a && a.guideId) extra.push('Guía ' + esc(Q.guide(a.guideId).name));
    if (a && a.driverId) extra.push('Conductor ' + esc(Q.driver(a.driverId).name));
    if (a && a.vehicleId) { const vh = Q.vehicle(a.vehicleId); extra.push(esc(vh.type) + ' ' + esc(vh.plate)); }
    const al = ctx.alerts.find(i => i.id === 'INC-0085') && s.date === '2026-09-30' && s.productId === 'PRD-001';
    return '<div class="svc' + (st === 'done' ? ' past' : '') + '"><div class="tm">' + esc(s.time) + '</div><div><div class="sv-t small" style="font-weight:550">' + esc(s.name.replace(/ \(salida .*\)$/, '')) + '</div>' + (extra.length ? '<div class="xs faint">' + extra.join(' · ') + '</div>' : '') + (al ? '<div class="xs bad" style="margin-top:3px">' + ic('alert') + ' Posible cambio de horario — ver alertas</div>' : '') + '</div><span class="sv-st">' + svcBadge(s) + '</span></div>';
  }
  function pxTrip(b, ctx) {
    const r = ctx.r; const days = Util.daysBetween(r.travelFrom, r.travelTo) + 1; const dayN = Util.daysBetween(r.travelFrom, T()) + 1;
    const svcs = r.services.slice().sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
    const nextS = svcs.find(s => s.date > T() || (s.date === T() && s.time !== '—')) || svcs.find(s => s.date >= T());
    const today = svcs.filter(s => s.date === T());
    b.innerHTML = '<div class="grid g-2-1" style="align-items:start"><div class="stack">' + UI.card('', '<div class="row top" style="gap:16px;flex-wrap:wrap"><div style="width:240px;max-width:100%">' + UI.thumb({ name: 'Cusco · Valle Sagrado · Machu Picchu', hue: 172 }) + '</div><div class="grow" style="min-width:220px"><div class="upper">Su viaje</div><h2 style="margin:4px 0">' + esc(r.title) + '</h2><div class="small muted">' + date(r.travelFrom) + ' — ' + date(r.travelTo) + ' · ' + r.passengers.map(p => esc(p.name)).join(' y ') + '</div><div style="margin:12px 0 6px" class="row between small"><span>Día ' + Math.min(Math.max(dayN, 0), days) + ' de ' + days + '</span>' + UI.badge(r.status) + '</div>' + UI.progress(Math.min(100, Math.max(0, dayN / days * 100)), 'ok') + '</div></div>') +
      UI.card('Hoy · ' + date(T()), today.length ? today.map(s => svcRow(ctx, s)).join('') : '<div class="card-b small muted">Sin servicios programados hoy.</div>', { tight: true }) +
      (nextS ? UI.card('Próximo servicio', svcRow(ctx, nextS), { tight: true, actions: '<a class="btn sm" href="' + ctx.base + 'itinerario">Itinerario completo</a>' }) : '') + '</div>' +
      '<div class="stack">' + UI.card('Accesos rápidos', '<div class="list">' + [['itinerario', 'calendar', 'Itinerario día a día'], ['hoteles', 'bed', 'Hotel y dirección'], ['transporte', 'truck', 'Traslados y trenes'], ['actividades', 'mountain', 'Actividades y guías'], ['vouchers', 'ticket', 'Vouchers (' + ctx.vs.length + ')'], ['documentos', 'file', 'Documentos del viaje'], ['alertas', 'alert', 'Alertas (' + ctx.alerts.length + ')']].concat(ctx.msgOn ? [['mensajes', 'mail', 'Mensajes' + (ctx.unreadN ? ' (' + ctx.unreadN + ' sin leer)' : '')]] : []).concat(ctx.fbOn ? [['comentarios', 'msg', 'Enviar comentarios']] : []).concat(ctx.cmp && ctx.cmp.show ? [['acompanantes', 'users', 'Datos de acompañantes']] : []).concat([['contacto', 'phoneCall', 'Emergencias 24/7']]).map(q => '<a class="list-item click" href="' + ctx.base + q[0] + '" style="color:inherit;text-decoration:none"><div class="ico-box">' + ic(q[1]) + '</div><span class="grow small">' + q[2] + '</span>' + ic('chevronRight') + '</a>').join('') + '</div>', { tight: true }) +
      UI.card('Emergencias 24/7', '<div class="sel-text">' + EMERGENCY + '</div><div class="xs faint" style="margin-top:6px">Central de operaciones Cusco (español, inglés, alemán)</div>') + '</div></div>';    if (ctx.rv && ctx.rv.pending) b.insertAdjacentHTML('afterbegin', UI.alert('info', '<b>Califica tu viaje.</b> Ya puede calificar ' + ctx.rv.pending + ' servicio(s) realizado(s). Su opinión ayuda a otros viajeros y se publica con el sello «Viaje verificado». <a href="' + ctx.base + 'resena">Calificar ahora</a>', 'star'));
  }
  function pxItin(b, ctx) {
    const r = ctx.r; const days = Util.daysBetween(r.travelFrom, r.travelTo) + 1;
    const rows = Array.from({ length: days }, (_, i) => { const d = addDays(r.travelFrom, i); return { d, n: i + 1, svcs: r.services.filter(s => s.date === d).sort((a, c) => a.time.localeCompare(c.time)) }; });
    const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    b.innerHTML = '<div class="row between"><div><h2>Itinerario día a día</h2><div class="small muted">Estado de cada servicio actualizado por operaciones en tiempo real.</div></div><button class="btn sm" id="it-pdf">' + ic('download') + 'Descargar itinerario</button></div>' +
      rows.map(x => { const dt = Util.parseD(x.d); return '<div class="card day' + (x.d === T() ? ' today' : '') + '"><div class="day-h"><div class="day-n">' + dt.getDate() + '<small>' + DOW[dt.getDay()] + '</small></div><div class="grow"><b>Día ' + x.n + '</b> <span class="small muted">· ' + date(x.d) + '</span></div>' + (x.d === T() ? UI.badge('en_curso', 'Hoy') : x.d < T() ? UI.badge('completado', 'Completado') : '') + '</div>' + (x.svcs.length ? x.svcs.map(s => svcRow(ctx, s)).join('') : '<div class="card-b small muted">Día libre.</div>') + '</div>'; }).join('');
    b.querySelector('#it-pdf').onclick = () => showDoc('Itinerario ' + r.id, tripDoc(r));
  }
  function pxHotels(b, ctx) {
    const rm = DB.rooming.filter(x => x.resId === ctx.r.id);
    const hs = ctx.r.services.filter(s => svcKind(s) === 'hotel');
    b.innerHTML = '<h2>Hoteles</h2>' + (rm.length ? rm.map(h => { const pv = Q.provider(h.hotel) || {}; const s = hs[0]; const v = s && ctx.vs.find(x => x.serviceId === s.id); const room = h.rooms.find(x => x.pax.includes(pxWho().name)) || h.rooms[0]; return UI.card(esc(pv.name), '<div class="grid g2"><div>' + UI.dl([['Dirección', '<span class="sel-text" style="font-size:.86rem;font-family:var(--f-body);font-weight:500;padding:4px 8px">' + esc(HOTEL_ADDR[h.hotel] || pv.city) + '</span>'], ['Teléfono', esc(pv.phone)], ['Categoría', pv.stars ? pv.stars + ' estrellas' : '—'], ['Check-in', date(h.checkIn) + ' · desde 14:00'], ['Check-out', date(h.checkOut) + ' · hasta 10:00']]) + '</div><div>' + UI.dl([['Habitación', room ? esc(room.room) + ' · ' + esc(room.type) : '—'], ['Huéspedes', room ? room.pax.map(esc).join(', ') : '—'], ['Régimen', 'Desayuno buffet incluido (06:00–10:00)'], ['Confirmación', s ? '<span class="mono">' + esc(s.confirmationCode) + '</span>' : '—'], ['Estado', room ? UI.badge(room.status) : '—']]) + '</div></div>', { footer: v ? '<button class="btn sm" data-v="' + v.id + '">' + ic('ticket') + 'Voucher del hotel</button>' : '' }); }).join('') : UI.card('', UI.empty('Sin hoteles en esta reserva', 'bed')));
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => showDoc('Voucher ' + x.dataset.v, voucherDoc(DB.vouchers.find(v => v.id === x.dataset.v))));
  }
  function pxTransport(b, ctx) {
    const list = ctx.r.services.filter(s => svcKind(s) === 'transporte' || s.productId === 'PRD-001').sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
    const train = ctx.r.services.find(s => s.productId === 'PRD-001');
    b.innerHTML = '<h2>Transporte</h2>' + UI.card('Traslados y conexiones', list.map(s => { const a = assignFor(ctx, s); const vh = a && a.vehicleId ? Q.vehicle(a.vehicleId) : null; const dr = a && a.driverId ? Q.driver(a.driverId) : null; return '<div class="svc' + (svcState(s) === 'done' ? ' past' : '') + '"><div class="tm">' + dateShort(s.date) + '<br>' + esc(s.time) + '</div><div><div class="small" style="font-weight:550">' + esc(s.productId === 'PRD-001' ? 'Bus Cusco — Ollantaytambo + Tren Expedition (i/v) + bus Consettur' : s.name) + '</div><div class="xs faint">' + esc(Q.providerName(s.providerId)) + (vh ? ' · ' + esc(vh.type) + ' placa ' + esc(vh.plate) : '') + (dr ? ' · ' + esc(dr.name) + ' (' + esc(dr.phone) + ')' : '') + '</div>' + (s.productId === 'PRD-001' ? '<div class="xs muted">Tren 05:05 Ollantaytambo → Aguas Calientes · retorno 15:20 · código ' + esc(s.confirmationCode) + '</div>' : '') + '</div>' + svcBadge(s) + '</div>'; }).join(''), { tight: true }) +
      (train && ctx.alerts.length ? UI.alert('warn', 'El horario de recojo del 30/09 podría adelantarse por el paro anunciado. Revise <a href="' + ctx.base + 'alertas">Alertas</a>.') : '') +
      UI.alert('info', 'El conductor lo esperará en el lobby del hotel con un cartel a su nombre. Tiempo de tolerancia: 10 minutos.');
  }
  function pxActs(b, ctx) {
    const list = ctx.r.services.filter(s => svcKind(s) === 'actividad').sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
    b.innerHTML = '<h2>Actividades</h2><div class="grid g2">' + list.map(s => { const p = Q.product(s.productId); const a = assignFor(ctx, s); const v = ctx.vs.find(x => x.serviceId === s.id); return UI.card(esc(s.name), '<div class="row between" style="margin-bottom:8px"><span class="small">' + date(s.date) + ' · ' + esc(s.time) + '</span>' + svcBadge(s) + '</div>' + (a && a.guideId ? '<div class="small">Guía: <b>' + esc(Q.guide(a.guideId).name) + '</b> <span class="faint">(' + Q.guide(a.guideId).languages.join(', ') + ')</span></div>' : '') + (p && p.requirements && p.requirements.length ? '<ul class="ck-list" style="margin-top:8px">' + p.requirements.slice(0, 3).map(x => '<li>' + ic('info') + esc(x) + '</li>').join('') + '</ul>' : ''), { footer: v ? '<button class="btn sm" data-v="' + v.id + '">' + ic('ticket') + 'Voucher</button>' : '' }); }).join('') + '</div>';
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => showDoc('Voucher ' + x.dataset.v, voucherDoc(DB.vouchers.find(v => v.id === x.dataset.v))));
  }
  function pxVouchers(b, ctx) {
    b.innerHTML = '<div><h2>Vouchers</h2><div class="small muted">Presente el voucher en su teléfono o impreso. Si un voucher cambia, verá aquí siempre la última versión.</div></div>' + (ctx.vs.length ? '<div class="grid g3">' + ctx.vs.map(v => UI.card(esc(v.service), UI.dl([['Voucher', '<span class="mono">' + esc(v.id) + '</span>'], ['Fecha', date(v.date)], ['Pasajeros', v.pax], ['Versión', 'v' + v.version], ['Estado', UI.badge(v.status)]]), { footer: '<button class="btn sm primary" data-v="' + v.id + '">' + ic('eye') + 'Abrir voucher</button>' })).join('') + '</div>' : UI.card('', UI.empty('Aún no hay vouchers emitidos', 'ticket')));
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => { showDoc('Voucher ' + x.dataset.v, voucherDoc(DB.vouchers.find(v => v.id === x.dataset.v))); Audit.log('Voucher', x.dataset.v, 'ver_portal_pasajero', '', pxWho().name); });
  }
  function pxDocs(b, ctx) {
    const r = ctx.r; const inv = DB.invoices.filter(i => i.resId === r.id);
    const docs = [['Itinerario del viaje', 'PDF · actualizado ' + date(T()), 'route', () => showDoc('Itinerario ' + r.id, tripDoc(r))], ['Certificado de asistencia en viaje', 'Seguros Viajero Andino', 'shield', () => showDoc('Certificado de asistencia', insuranceDoc(r))]].concat(inv.map(i => [i.type + ' ' + i.id, esc(i.detail) + ' · ' + money(i.amount, i.currency), 'receipt', () => showDoc(i.type + ' ' + i.id, invoiceDoc(i))])).concat([['Política de cancelación y cambios', 'Condiciones de su reserva', 'file', () => { const c = DB.cms.find(x => x.id === 'CMS-05'); showDoc('Política de cancelación', '<div class="doc">' + docHead('POLÍTICA DE CANCELACIÓN', 'CMS-05') + mdLite((c && c.body) || CMS_BODY['CMS-05']) + '</div>'); }]]);
    b.innerHTML = '<h2>Documentos</h2>' + UI.card('', '<div class="list">' + docs.map((d, i) => '<div class="list-item click" data-d="' + i + '"><div class="ico-box">' + ic(d[2]) + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(d[0]) + '</div><div class="xs faint">' + d[1] + '</div></div><span class="btn xs">' + ic('eye') + 'Ver</span></div>').join('') + '</div>' +
      '<div class="card-b" style="border-top:1px solid var(--line-2)"><div class="upper" style="margin-bottom:6px">Documentos de viaje registrados</div>' + r.passengers.map(p => '<div class="small">' + esc(p.name) + ' · ' + esc(p.doc) + ' · ' + esc(p.nationality) + '</div>').join('') + '<div class="xs faint" style="margin-top:6px">Lleve su pasaporte original: las entradas a Machu Picchu y el tren son nominativos.</div></div>', { tight: true });
    b.querySelectorAll('[data-d]').forEach(x => x.onclick = () => docs[+x.dataset.d][3]());
  }
  function pxAlerts(b, ctx) {
    const w = pxWho(); const notes = DB.notifications.filter(n => n.to === w.email || n.to === w.phone || n.to === w.id);
    b.innerHTML = '<h2>Alertas del viaje</h2>' + (ctx.alerts.length ? ctx.alerts.map(i => { const t = paxAlertText(i); return '<div class="card"><div class="card-h"><div class="row" style="gap:10px"><div class="ico-box bad">' + ic('alert') + '</div><div><div class="t">' + esc(t.title) + '</div><div class="s">Publicada ' + datetime(i.createdAt) + ' · ref. ' + esc(i.id) + '</div></div></div>' + (i.paxAck ? UI.badge('ok', 'Leída') : UI.badge('critica', 'Importante')) + '</div><div class="card-b"><p class="small">' + esc(t.body) + '</p>' + (i.paxAck ? '<div class="xs faint" style="margin-top:10px">Lectura confirmada el ' + datetime(i.paxAck) + '</div>' : '') + '</div><div class="card-f">' + (i.paxAck ? '' : '<button class="btn primary sm" data-ack="' + i.id + '">' + ic('check') + 'Confirmar lectura</button>') + '<a class="btn sm" href="' + ctx.base + 'contacto">Contactar a operaciones</a></div></div>'; }).join('') : UI.card('', UI.empty('No hay alertas activas para su viaje.', 'checkCircle'))) +
      UI.card('Mensajes recibidos', notes.length ? '<div class="list">' + notes.map(n => '<div class="list-item"><div class="grow"><div class="small">' + esc(n.subject) + '</div><div class="xs faint">' + esc(n.channel) + ' · ' + datetime(n.ts) + '</div></div></div>').join('') + '</div>' : '<div class="card-b small muted">Recibirá aquí los avisos de cambios de horario, asignaciones y recordatorios (PROC-059).</div>', { tight: true });
    b.querySelectorAll('[data-ack]').forEach(x => x.onclick = () => {
      const i = DB.incidents.find(y => y.id === x.dataset.ack); i.paxAck = nowStr(); i.log = i.log || []; i.log.push({ ts: i.paxAck, u: w.id, m: 'Pasajero confirmó lectura de la alerta desde el portal' });
      Store.save(); Audit.log('Incidencia', i.id, 'lectura_pasajero', '', w.name); Notify.push('alerta.leida', 'Portal', i.assignee, w.name + ' confirmó lectura de ' + i.id);
      UI.toast('Gracias. Operaciones fue notificada de su confirmación.'); App.render();
    });
  }
  function pxContact(b, ctx) {
    const co = Q.user((ctx.op && ctx.op.coordinator) || 'U05') || {};
    const asg = ctx.op ? ctx.op.assignments.filter(a => a.date >= T() && a.guideId).sort((a, c) => a.date.localeCompare(c.date))[0] : null;
    const g = asg && Q.guide(asg.guideId);
    b.innerHTML = '<h2>Contacto</h2><div class="grid g2" style="align-items:start"><div class="stack">' +
      UI.card('Emergencias 24/7', '<p class="small muted" style="margin-bottom:10px">Central de operaciones, atención en español, inglés y alemán. Seleccione el número para copiarlo.</p><div class="sel-text" id="em-num">' + EMERGENCY + '</div><div class="row" style="margin-top:12px"><button class="btn sm" id="em-copy">' + ic('copy') + 'Copiar número</button><span class="xs faint">WhatsApp en el mismo número</span></div>') +
      UI.card('Sus contactos del viaje', UI.dl([['Coordinadora', esc(co.name || '') + '<div class="xs faint">' + esc(co.phone || '') + ' · ' + esc(co.email || '') + '</div>'], ['Guía próximo servicio', g ? esc(g.name) + '<div class="xs faint">' + esc(g.phone) + ' · ' + dateShort(asg.date) + ' ' + esc(asg.time) + '</div>' : 'Por asignar'], ['Oficina Cusco', 'Calle Plateros 348, Cusco · 084 23 1190'], ['Asistencia médica', 'Seguros Viajero Andino · 01 611 2020']])) + '</div>' +
      UI.card('Enviar mensaje a operaciones', UI.form([{ id: 'cm_t', label: 'Tema', type: 'select', options: ['Cambio de horario', 'Recojo en hotel', 'Salud', 'Objetos perdidos', 'Otro'], col: 12 }, { id: 'cm_m', label: 'Mensaje', type: 'textarea', rows: 5, required: true, col: 12 }]), { footer: '<button class="btn primary" id="cm-go">' + ic('send') + 'Enviar</button>' }) + '</div>';
    b.querySelector('#em-copy').onclick = () => UI.copy(EMERGENCY);
    b.querySelector('#cm-go').onclick = () => {
      const form = b.querySelector('#cm_m').closest('.card'); if (!UI.validate(form)) return; const f = UI.formData(form);
      const tk = { id: nextId(ensureTickets(), 'TCK-', 4), clientId: ctx.r.clientId, subject: f.cm_t + ' — ' + ctx.r.id, category: 'Operaciones', priority: f.cm_t === 'Salud' ? 'alta' : 'media', message: f.cm_m, resId: ctx.r.id, status: 'abierta', createdAt: nowStr(), owner: co.id || 'U05', log: [{ ts: nowStr(), m: 'Mensaje del pasajero desde el portal' }] };
      DB.supportTickets.unshift(tk); Store.save(); Audit.log('Ticket soporte', tk.id, 'crear', '', 'Portal pasajero'); Notify.push('pasajero.mensaje', 'WhatsApp', co.phone || '984 410 663', 'Mensaje de ' + pxWho().name + ': ' + f.cm_t);
      UI.toast('Mensaje enviado (' + tk.id + '). Operaciones le responderá por WhatsApp.'); App.render();
    };
  }

  /* ---- v2.1 · Mensajes recibidos (R-PAX-MESSAGES) ---- */
  let pxMsgCh = '';
  function pxMsgs(b, ctx) {
    const r = ctx.r; const all = PX.messagesFor(r.id); const list = pxMsgCh ? all.filter(m => m.channel === pxMsgCh) : all;
    const chs = [...new Set(all.map(m => m.channel))];
    const icn = { email: 'mail', whatsapp: 'msg', portal: 'globe', push: 'phone', sms: 'phone' };
    b.innerHTML = '<div class="row between"><div><h2>Mensajes</h2><div class="small muted">Comunicaciones que la agencia le envió sobre esta reserva (confirmación, recordatorios, cambios y respuestas a sus comentarios).</div></div>' + (ctx.unreadN ? '<button class="btn sm" id="pm-all">' + ic('check') + 'Marcar todos como leídos</button>' : '') + '</div>' +
      (chs.length > 1 ? '<div class="tabs pills">' + [['', 'Todos', all.length]].concat(chs.map(c => [c, CH_LBL[c] || c, all.filter(m => m.channel === c).length])).map(t => '<button class="tab' + (pxMsgCh === t[0] ? ' on' : '') + '" data-mch="' + esc(t[0]) + '">' + esc(t[1]) + '<span class="cnt">' + t[2] + '</span></button>').join('') + '</div>' : '') +
      UI.card('', list.length ? list.map(m => '<div class="pxs-msg' + (m.status !== 'leido' && m.status !== 'fallido' ? ' unread' : '') + '" data-pm="' + esc(m.id) + '" role="button" tabindex="0"><div class="ico-box ' + (m.status === 'fallido' ? 'bad' : '') + '">' + ic(icn[m.channel] || 'bell') + '</div><div style="min-width:0"><div class="pxs-sub">' + (m.status !== 'leido' && m.status !== 'fallido' ? '<span class="pxs-dot" aria-label="No leído"></span>' : '') + esc(m.subject || '(sin asunto)') + '</div><div class="xs faint">' + esc(CH_LBL[m.channel] || m.channel) + ' · ' + datetime(m.sentAt || m.scheduledAt) + (m.readAt ? ' · leído ' + datetime(m.readAt) : '') + '</div></div>' + (m.status === 'leido' ? PX.msgBadge('leido') : m.status === 'fallido' ? PX.msgBadge('fallido') : UI.badge('abierta', 'Nuevo')) + '</div>').join('') : UI.empty(all.length ? 'Sin mensajes en este canal.' : 'Aún no hay mensajes para esta reserva.', 'mail'), { tight: true }) +
      '<p class="xs faint">Si un mensaje figura como fallido, la agencia lo reenviará por otro canal. Para responder use Comentarios o Contacto 24/7.</p>';
    b.querySelectorAll('[data-mch]').forEach(x => x.onclick = () => { pxMsgCh = x.dataset.mch; pxMsgs(b, ctx); });
    const open = (id) => { const m = (DB.paxMessages || []).find(y => y.id === id); if (!m) return; const changed = PX.markRead(m, ctx.who.name); if (changed) Store.save();
      UI.modal({ title: esc(m.subject || 'Mensaje'), sub: esc(CH_LBL[m.channel] || m.channel) + ' · ' + datetime(m.sentAt || m.scheduledAt), body: '<div class="small" style="white-space:pre-wrap;line-height:1.55">' + esc(m.body || '') + '</div>' + (m.feedbackId ? '<div class="xs faint" style="margin-top:10px">Respuesta a su comentario ' + esc(m.feedbackId) + '.</div>' : ''), actions: [{ label: 'Cerrar', cls: 'primary', onClick: () => { if (changed) App.render(); } }] }); };
    b.querySelectorAll('[data-pm]').forEach(x => { x.onclick = () => open(x.dataset.pm); x.onkeydown = (e) => { if (e.key === 'Enter') open(x.dataset.pm); }; });
    const ab = b.querySelector('#pm-all'); if (ab) ab.onclick = () => { let n = 0; all.forEach(m => { if (PX.markRead(m, ctx.who.name)) n++; }); Store.save(); UI.toast(n + ' mensaje(s) marcados como leídos.'); App.render(); };
  }

  /* ---- v2.1 · Enviar comentarios (R-PAX-FEEDBACK) ---- */
  function pxFeedback(b, ctx) {
    const r = ctx.r; const mine = PX.feedbackFor(r.id);
    const svcs = (r.services || []).filter(s => s.status !== 'cancelado').sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
    const claimsOk = Access.canRoute('libro-reclamaciones');
    b.innerHTML = '<div><h2>Comentarios</h2><div class="small muted">Cuéntenos cómo va su viaje: comentarios, sugerencias, felicitaciones, reclamos o incidencias. Operaciones los revisa durante el viaje y le responde por este portal.</div></div>' +
      '<div class="grid g-1-2" style="align-items:start">' + UI.card('Nuevo comentario', '<div class="form-grid" id="fb-f">' +
        UI.field({ id: 'fb_type', label: 'Tipo', type: 'select', options: FB_TYPES, value: 'comentario', col: 12 }) +
        UI.field({ id: 'fb_svc', label: 'Servicio relacionado (opcional)', type: 'select', placeholder: 'Ninguno / viaje en general', options: svcs.map(s => [s.id, dateShort(s.date) + ' · ' + s.name.replace(/ \(salida .*\)$/, '')]), col: 12 }) +
        '<div class="field c12"><label>Calificación (opcional)</label><div class="pxs-rate" id="fb-rate" role="radiogroup" aria-label="Calificación de 1 a 5">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-rt="' + n + '" role="radio" aria-checked="false" title="' + n + ' de 5">' + n + ' ★</button>').join('') + '<button type="button" data-rt="0" class="btn ghost xs" style="min-width:auto;border:0">Sin calificar</button></div></div>' +
        UI.field({ id: 'fb_text', label: 'Su comentario', type: 'textarea', rows: 5, required: true, col: 12, placeholder: 'Describa lo ocurrido o su sugerencia (máx. 1000 caracteres)' }) +
        '<div class="c12" id="fb-hint"></div></div>', { footer: '<button class="btn primary" id="fb-go">' + ic('send') + 'Enviar comentario</button>' }) +
      UI.card('Mis comentarios (' + mine.length + ')', mine.length ? '<div class="list">' + mine.map(f => { const s = f.serviceId && (r.services || []).find(x => x.id === f.serviceId); return '<div class="list-item" style="align-items:flex-start"><div class="grow" style="min-width:0"><div class="row" style="gap:6px">' + PX.typeBadge(f.type) + PX.fbBadge(f.status) + PX.stars(f.rating) + '</div><div class="small" style="margin-top:6px;overflow-wrap:anywhere">' + esc(f.text) + '</div><div class="xs faint" style="margin-top:4px"><span class="mono">' + esc(f.id) + '</span> · ' + datetime(f.createdAt) + (s ? ' · ' + esc(s.name) : '') + (f.conversationId ? ' · caso ' + esc(f.conversationId) : '') + '</div>' + (f.reply ? '<div class="pxs-reply"><b class="xs">Respuesta de la agencia · ' + datetime(f.repliedAt) + '</b><div>' + esc(f.reply) + '</div></div>' : f.status === 'derivado' ? '<div class="xs muted" style="margin-top:6px">Operaciones está atendiendo su caso' + (f.incidentId ? ' (ref. ' + esc(f.incidentId) + ')' : '') + '.</div>' : '') + '</div></div>'; }).join('') + '</div>' : UI.empty('Aún no ha enviado comentarios.', 'msg'), { tight: true }) + '</div>';
    let rating = 0;
    const rt = b.querySelector('#fb-rate');
    const paint = () => rt.querySelectorAll('[data-rt]').forEach(x => { const n = +x.dataset.rt; if (!n) return; x.classList.toggle('on', n <= rating); x.setAttribute('aria-checked', n === rating ? 'true' : 'false'); });
    rt.querySelectorAll('[data-rt]').forEach(x => x.onclick = () => { rating = +x.dataset.rt; paint(); });
    const hint = () => { const t = b.querySelector('#fb_type').value; b.querySelector('#fb-hint').innerHTML = t === 'reclamo' ? UI.alert('warn', 'Su reclamo se registra como caso de seguimiento con la agencia. Si además desea dejar constancia formal ante INDECOPI, puede usar el ' + (claimsOk ? '<a href="#/libro-reclamaciones">Libro de Reclamaciones virtual</a>' : 'Libro de Reclamaciones virtual de la agencia') + ' (Ley 29571).') : t === 'incidencia' ? UI.alert('info', 'Operaciones recibe su incidencia al instante. Si es una emergencia llame a la central 24/7 <b>' + EMERGENCY + '</b>.') : ''; };
    b.querySelector('#fb_type').onchange = hint; hint();
    b.querySelector('#fb-go').onclick = () => {
      const f = b.querySelector('#fb-f'); if (!UI.validate(f)) return; const d = UI.formData(f);
      const res = PX.submitFeedback(r, { type: d.fb_type, serviceId: d.fb_svc, rating, text: d.fb_text }, ctx.who, Auth.role === 'passenger' ? 'Portal pasajero' : 'Portal pasajero (vista interna)');
      if (res.error) { UI.toast(res.error, 'bad'); return; }
      const isClaim = res.fb.type === 'reclamo';
      UI.modal({ title: 'Comentario enviado', size: 'sm', body: UI.alert('ok', 'Registramos su ' + esc(PX.typeLabel(res.fb.type).toLowerCase()) + ' <b class="mono">' + esc(res.fb.id) + '</b>. ' + (res.fb.conversationId ? 'Se abrió el caso <b>' + esc(res.fb.conversationId) + '</b> y operaciones le responderá en un máximo de 4 horas.' : 'Operaciones fue notificada.')) + (isClaim ? '<p class="small" style="margin-top:10px">Si lo desea, también puede registrarlo en el Libro de Reclamaciones virtual (constancia formal con plazo legal de respuesta de 15 días hábiles).</p>' : ''),
        actions: (isClaim && claimsOk ? [{ label: 'Ir al Libro de Reclamaciones', icon: 'file', onClick: () => App.go('#/libro-reclamaciones') }] : []).concat([{ label: 'Aceptar', cls: 'primary', onClick: () => App.render() }]) });
    };
  }

  /* ---- v2.2 · Califica tu viaje (R-OWN-REVIEWS; datos y reglas en resenas.js → window.OwnReviews) ---- */
  const RV_PAX_ST = { pendiente: ['pendiente', 'En revisión'], publicada: ['publicado', 'Publicada'], rechazada: ['rechazada', 'No publicada'], oculta: ['inactiva', 'Solo para la agencia'] };
  const NAT_LANG = { Alemana: 'de', Francesa: 'fr', Estadounidense: 'en', Británica: 'en', Brasileña: 'pt' };
  function pxReview(b, ctx) {
    const OR = window.OwnReviews; const r = ctx.r; const el = ctx.rv;
    if (!OR || !el || !el.show) { b.innerHTML = UI.card('', UI.empty('Las reseñas no están disponibles para esta reserva.', 'star')); return; }
    const todo = el.list.filter(x => !x.rv); const subs = OR.activeSubs(); const px0 = (r.passengers || []).find(p => p.name === ctx.who.name) || {};
    const langDef = NAT_LANG[px0.nationality] || 'es';
    const stars5 = (id) => '<div class="pxs-rate" id="' + id + '" role="radiogroup" aria-label="Calificación de 1 a 5">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-rs="' + n + '" role="radio" aria-checked="false" title="' + n + ' de 5">' + n + ' ★</button>').join('') + '</div>';
    const mineHtml = el.mine.map(v => '<div class="list-item" style="align-items:flex-start"><div class="grow" style="min-width:0"><div class="row" style="gap:6px">' + OR.stars(v.stars) + UI.badge(RV_PAX_ST[v.status][0], RV_PAX_ST[v.status][1]) + '</div><div class="small" style="margin-top:6px;font-weight:600">' + esc(v.title) + '</div><div class="small" style="overflow-wrap:anywhere">' + esc(v.text) + '</div><div class="xs faint" style="margin-top:4px">' + esc(Q.productName(v.productId)) + ' · ' + datetime(v.createdAt) + (v.status === 'pendiente' ? ' · la agencia la revisa antes de publicarla' : '') + (v.status === 'oculta' && v.consent === false ? ' · no autorizó su publicación' : '') + '</div>' + (v.reply ? '<div class="rvo-reply" style="margin-top:8px"><b class="xs">Respuesta de la agencia</b> <span class="xs faint">· ' + datetime(v.reply.at) + '</span><div>' + esc(v.reply.text) + '</div></div>' : '') + '</div></div>').join('');
    b.innerHTML = '<div><h2>Califica tu viaje</h2><div class="small muted">Solo pueden opinar pasajeros con una reserva realizada. Su reseña se publica en el sitio de la agencia con el sello «Viaje verificado» si usted lo autoriza.</div></div>' +
      (el.partial ? UI.alert('info', 'Su viaje sigue en curso hasta el ' + date(el.travelTo) + ': por ahora puede calificar los servicios ya realizados. Al terminar podrá calificar el resto.' + (Auth.role === 'passenger' ? '' : ' <span class="xs">(Demo: habilitado para la reserva en operación de Thomas Keller.)</span>')) : '') +
      '<div class="grid g-1-2" style="align-items:start">' +
      (todo.length ? UI.card('Nueva reseña', '<div class="form-grid" id="rv-f">' +
        UI.field({ id: 'rv_prod', label: '¿Qué desea calificar?', type: 'select', options: todo.map(x => [x.p.id, x.p.name + ' · ' + dateShort(x.date)]), col: 12 }) +
        '<div class="field c12"><label>Calificación general <span class="req">*</span></label>' + stars5('rv-stars') + '</div>' +
        (subs.length ? '<div class="field c12"><label>Detalle (opcional)</label><div class="form-grid">' + subs.map(([k, l]) => UI.field({ id: 'rv_s_' + k, label: l, type: 'select', placeholder: 'Sin calificar', options: [5, 4, 3, 2, 1].map(n => [n, n + ' ★']), col: 6 })).join('') + '</div></div>' : '') +
        UI.field({ id: 'rv_title', label: 'Título', required: true, col: 12, placeholder: 'Resuma su experiencia' }) +
        UI.field({ id: 'rv_text', label: 'Su reseña', type: 'textarea', rows: 5, required: true, col: 12, placeholder: 'Qué le gustó, qué mejoraría (mínimo 20 caracteres). No incluya teléfonos ni correos.' }) +
        '<div class="field c6"><label for="rv_photo">Fotos (opcional)</label><input class="input" type="file" id="rv_photo" accept="image/*" multiple><div class="hint">En la demo solo se registra el nombre del archivo.</div></div>' +
        UI.field({ id: 'rv_lang', label: 'Idioma de la reseña', type: 'select', options: OR.LANGS, value: langDef, col: 6 }) +
        UI.field({ id: 'rv_ok', label: 'Autorizo publicar mi reseña con mi nombre abreviado (' + OR.authorOf(ctx.who.name) + ') y país en el sitio web de la agencia.', type: 'checkbox', col: 12 }) +
        '</div>', { footer: '<button class="btn primary" id="rv-go">' + ic('send') + 'Enviar reseña</button>' }) : UI.card('Nueva reseña', UI.empty(el.list.length ? 'Ya calificó todos los servicios realizados. ¡Gracias!' : 'Aún no hay servicios realizados para calificar.', 'checkCircle'))) +
      UI.card('Mis reseñas (' + el.mine.length + ')', el.mine.length ? '<div class="list">' + mineHtml + '</div>' : '<div class="card-b small muted">Aún no ha enviado reseñas.</div>', { tight: true }) + '</div>';
    if (!todo.length) return;
    let stars = 0; const rt = b.querySelector('#rv-stars');
    rt.querySelectorAll('[data-rs]').forEach(x => x.onclick = () => { stars = +x.dataset.rs; rt.querySelectorAll('[data-rs]').forEach(y => { y.classList.toggle('on', +y.dataset.rs <= stars); y.setAttribute('aria-checked', +y.dataset.rs === stars ? 'true' : 'false'); }); });
    b.querySelector('#rv-go').onclick = () => {
      const f = b.querySelector('#rv-f'); if (!UI.validate(f)) return; if (!stars) { UI.toast('Elija una calificación de 1 a 5 estrellas.', 'bad'); return; }
      const d = UI.formData(f); const sr = {}; subs.forEach(([k]) => { if (d['rv_s_' + k]) sr[k] = d['rv_s_' + k]; });
      const photos = [...(b.querySelector('#rv_photo').files || [])].map(x => x.name);
      const res = OR.submit(r, { productId: d.rv_prod, stars, subratings: sr, title: d.rv_title, text: d.rv_text, photos, lang: d.rv_lang, consent: !!d.rv_ok }, ctx.who, 'portal');
      if (res.error) { UI.toast(res.error, 'bad'); return; }
      const v = res.rv;
      UI.modal({ title: 'Gracias por su reseña', size: 'sm', body: UI.alert('ok', v.status === 'publicada' ? 'Su reseña ya está publicada en el sitio con el sello «Viaje verificado».' : v.status === 'oculta' ? 'Recibimos su opinión. Como no autorizó su publicación, solo la verá la agencia.' : 'Recibimos su reseña. La agencia la revisa antes de publicarla (normalmente en menos de 24 horas).'), actions: [{ label: 'Aceptar', cls: 'primary', onClick: () => App.render() }] });
    };
  }

  /* ---- v2.1 · Acompañantes y recojo (R-COMPANIONS en modo «antes_de_viaje» + R-PICKUP) ---- */
  function pxCompanions(b, ctx) {
    const r = ctx.r; const cmp = ctx.cmp; const pk = (r.booking && r.booking.pickup) || null; const pickOn = PX.on('R-PICKUP', r) && PX.product(r) && PX.product(r).pickup;
    const miss = r.passengers.filter(p => PX.missing(p, cmp.requireDoc));
    b.innerHTML = '<div class="row between"><div><h2>Acompañantes</h2><div class="small muted">Complete los datos de quienes viajan con usted' + (pickOn ? ' y confirme su punto de recojo' : '') + '. Plazo: hasta el ' + date(cmp.deadline) + '.</div></div>' + (cmp.editable ? '<button class="btn primary" id="cp-edit">' + ic('edit') + (miss.length ? 'Completar datos' : 'Editar datos') + '</button>' : '') + '</div>' +
      (!cmp.editable ? UI.alert('info', 'El plazo para modificar los datos venció el ' + date(cmp.deadline) + '. Si necesita un cambio, escriba a su agencia desde Contacto.') : miss.length ? UI.alert('warn', miss.length + ' viajero(s) con datos pendientes. Las entradas y trenes son nominativos.') : UI.alert('ok', 'Datos de viajeros completos.')) +
      UI.card('Viajeros (' + r.passengers.length + ')', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Parentesco</th><th>Tipo</th><th>Edad</th><th>Documento</th><th>Nacionalidad</th></tr></thead><tbody>' + r.passengers.map(p => { const age = p.age != null ? p.age : ageAt(p.birth, r.travelFrom); return '<tr><td><div class="cell-main">' + esc(p.name) + '</div>' + (PX.missing(p, cmp.requireDoc) ? UI.badge('pendiente', 'Por completar') : '') + '</td><td>' + esc(p.relationship || (p.isLead ? 'Titular' : '—')) + '</td><td>' + esc(p.type || '—') + '</td><td>' + (age != null ? age + ' años' : '—') + '</td><td class="nowrap">' + esc(p.doc || '—') + '</td><td>' + esc(p.nationality || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>', { tight: true }) +
      (pickOn ? UI.card('Punto de recojo', pk && pk.point ? UI.dl([['Punto', esc(pk.point)], ['Dirección / referencia', esc(pk.address || '')], ['Vuelo de llegada', esc(pk.flight || '')], ['Llegada', pk.arrival ? datetime(pk.arrival) : '']]) : '<div class="small muted">Aún no indicó su punto de recojo.</div>') : '');
    const e = b.querySelector('#cp-edit'); if (e) e.onclick = () => companionsModal(r, ctx.who, 'Portal pasajero');
  }
})();
