/* ==========================================================================
   Experiencia del pasajero y reglas configurables (v2.1)
   Rutas: admin/reglas · admin/comunicaciones · admin/monedas · canales/resenas ·
          canales/integracion-web · sitio/widget (pública, sin sesión)
   Toda disponibilidad, precio, pasajeros, alojamiento, adicionales, pagos y monedas se
   calculan con window.BookingEngine (BE). Este módulo NO duplica cálculos.
   Colecciones propias: DB.paxMessageTemplates, DB.paxMessages, DB.reviewIntegrations,
   DB.externalReviews (de ejemplo), DB.fxRateHistory, DB.widgetConfig, DB.widgetHandoff.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, addDays, nowStr, clone, pad } = Util;
  const BE = window.BookingEngine;
  const T = () => window.TODAY;
  const ic = (n) => UI.icon(n);
  const bd = (tone, label) => '<span class="badge b-' + tone + '">' + esc(label) + '</span>';
  const can = (p) => Auth.can(p);
  const isAdmin = () => can('admin.settings.manage');
  const dis = (ok, perm) => ok ? '' : ' disabled title="Requiere permiso ' + perm + '"';
  const SAMPLE = '<span class="badge b-warn" title="Datos ficticios para la demostración; en producción provienen de la API de cada plataforma">Datos de ejemplo</span>';
  const nextId = (arr, prefix, w) => { let n = 0; (arr || []).forEach(x => { const s = String(x.id || ''); if (s.startsWith(prefix)) { const m = s.slice(prefix.length).match(/^(\d+)/); if (m) n = Math.max(n, +m[1]); } }); return prefix + String(n + 1).padStart(w, '0'); };
  const parseDT = (s) => { const [d, t] = String(s).split(' '); const [y, m, dd] = d.split('-').map(Number); const [hh, mi] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, hh || 0, mi || 0); };
  const fmtDT = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const addHours = (s, h) => { const d = parseDT(s); d.setTime(d.getTime() + h * 3600000); return fmtDT(d); };
  const keepScroll = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };
  const r2 = (n) => Math.round(n * 100) / 100;
  const copyText = (text, ta) => { const fb = () => { if (ta) { ta.focus(); ta.select(); } UI.toast('Seleccione el texto y cópielo con Ctrl+C.', 'info'); }; try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => UI.toast('Código copiado al portapapeles.'), fb); else fb(); } catch (e) { fb(); } };
  const stars = (n, size) => { size = size || 14; let h = '<span class="xstars" aria-label="' + n + ' de 5">'; for (let i = 1; i <= 5; i++) h += '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 3 1.1-6.2L3 9.7l6.2-.9z" fill="' + (i <= Math.round(n) ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'; return h + '</span>'; };

  /* ======================================================================
     Estilos del módulo (solo variables de color del tema)
     ====================================================================== */
  (function css() {
    if (document.getElementById('css-experiencia')) return;
    const s = document.createElement('style'); s.id = 'css-experiencia';
    s.textContent = [
      '.xr-grp .card-b{padding:0}',
      '.xr-row{display:grid;grid-template-columns:46px minmax(0,1fr) 230px;gap:14px;padding:14px 16px;border-top:1px solid var(--line-2)}',
      '.xr-row:first-child{border-top:0}.xr-row.off{background:var(--surface-2)}.xr-row.off .xr-name{color:var(--fg-2)}',
      '.xr-name{font-weight:600;font-size:.9rem}.xr-side{font-size:.78rem;color:var(--fg-2);display:flex;flex-direction:column;gap:6px;align-items:flex-start}',
      '.xr-params{display:flex;flex-wrap:wrap;gap:10px 12px;margin-top:10px;align-items:flex-end}',
      '.xr-p{display:flex;flex-direction:column;gap:3px;min-width:0}.xr-p label{font-size:.7rem;color:var(--fg-3);font-weight:600}.xr-p .input{width:132px}.xr-p .input.err{border-color:var(--bad)}',
      '.xr-err{color:var(--bad);font-size:.74rem;margin-top:6px}',
      '.xr-row.lock{background:var(--surface-2)}.xr-row.lock .xr-name{color:var(--fg-2)}.xr-lk{display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--fg-3)}',
      '.xr-plan{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:6px;font-size:.76rem;color:var(--warn)}',
      '.xf-chart .chart text{font-size:10px}.xf-prov{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;padding:10px 0;border-top:1px solid var(--line-2)}.xf-prov:first-child{border-top:0}',
      '.xrv-sec{display:flex;align-items:center;gap:8px;margin:4px 0 10px;flex-wrap:wrap}',
      '@media (max-width:760px){.xr-row{grid-template-columns:40px minmax(0,1fr)}.xr-side{grid-column:2}}',
      '.xr-tpl{display:flex;flex-direction:column;gap:10px;height:100%}',
      '.xr-diff{display:flex;flex-wrap:wrap;gap:5px}',
      '.xmcal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;font-size:.72rem}',
      '.xmcal .h{color:var(--fg-3);text-align:center;font-weight:600;padding:2px 0}',
      '.xmcal .d{border-radius:6px;padding:5px 0;text-align:center;border:1px solid transparent;font-variant-numeric:tabular-nums}',
      '.xmcal .ok{background:var(--ok-soft);color:var(--ok)}.xmcal .low{background:var(--warn-soft);color:var(--warn)}.xmcal .closed{background:var(--bad-soft);color:var(--bad)}.xmcal .sold{background:var(--mute-soft);color:var(--fg-3)}.xmcal .na{color:var(--fg-3)}.xmcal .sel{border-color:var(--fg);font-weight:700}',
      '.xm-bubble{background:var(--ok-soft);border-radius:12px 12px 12px 3px;padding:10px 12px;white-space:pre-wrap;font-size:.84rem;max-width:420px;border:1px solid var(--line-2)}',
      '.xm-mail{border:1px solid var(--line);border-radius:10px;overflow:hidden}.xm-mail-h{background:var(--surface-2);padding:10px 12px;border-bottom:1px solid var(--line-2);font-size:.8rem}.xm-mail-b{padding:14px;white-space:pre-wrap;font-size:.86rem;line-height:1.55}',
      '.xm-vars{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 2px}.xm-vars button{font-family:var(--f-mono);font-size:.7rem}',
      '.xm-checks{display:flex;flex-wrap:wrap;gap:6px 14px}.xm-scroll{max-height:150px;overflow:auto;border:1px solid var(--line-2);border-radius:8px;padding:8px 10px}',
      '.xstars{color:var(--sun);display:inline-flex;gap:1px;vertical-align:-2px}',
      '.xrv-card{display:flex;flex-direction:column;gap:10px}.xrv-src{display:flex;gap:12px;align-items:center}',
      '.xrv-logo{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-weight:700;font-size:.8rem;background:var(--accent-soft);color:var(--accent);flex:none}',
      '.xc-code{font-family:var(--f-mono);font-size:.75rem;background:var(--surface-3);border:1px solid var(--line-2);border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-all;margin:0;color:var(--fg);line-height:1.5}',
      '.xs-frame{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface-2)}',
      '.xs-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface-3);border-bottom:1px solid var(--line)}.xs-bar i{width:10px;height:10px;border-radius:50%;background:var(--line);display:inline-block}',
      '.xs-url{flex:1;min-width:0;background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:3px 12px;font-size:.74rem;color:var(--fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xs-wph{background:var(--surface);border-bottom:1px solid var(--line-2);padding:12px 18px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.xs-wph b{font-family:var(--f-display)}.xs-wph nav{display:flex;gap:14px;font-size:.78rem;color:var(--fg-2);flex-wrap:wrap}',
      '.xs-grid{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:20px;padding:18px}.xs-side{display:flex;flex-direction:column;gap:12px;font-size:.78rem;color:var(--fg-2)}.xs-side h5{margin:0 0 6px;color:var(--fg);font-size:.8rem}',
      '.xs-post h3{margin:0 0 6px;font-family:var(--f-display);font-size:1.15rem}.xs-post p{font-size:.84rem;color:var(--fg-2);margin:0 0 14px;line-height:1.55}',
      '@media (max-width:900px){.xs-grid{grid-template-columns:minmax(0,1fr)}}',
      /* Widget de reservas */
      '.qw{--qw-accent:var(--accent);--qw-r:10px;background:var(--surface);border:1px solid var(--line);border-radius:var(--qw-r);color:var(--fg);overflow:hidden;font-size:.86rem}',
      '.qw-h{padding:16px 18px;border-bottom:1px solid var(--line-2);display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;justify-content:space-between}',
      '.qw-h h3{margin:0;font-family:var(--f-display);font-size:1.05rem;line-height:1.25}.qw-from{font-size:.78rem;color:var(--fg-2)}.qw-from b{color:var(--fg);font-size:1rem}',
      '.qw-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.qw-tools .input{width:auto;height:30px;font-size:.78rem}',
      '.qw-sec{padding:14px 18px;border-bottom:1px solid var(--line-2)}.qw-sec:last-child{border-bottom:0}',
      '.qw-sec h4{font-size:.86rem;margin:0 0 10px;display:flex;align-items:center;gap:8px;font-family:var(--f-display)}',
      '.qw-n{width:22px;height:22px;border-radius:50%;background:var(--qw-accent);color:#fff;display:inline-grid;place-items:center;font-size:.72rem;flex:none}',
      '.qw-cal-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;text-transform:capitalize}',
      '.qw-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.qw-cal .wd{font-size:.68rem;color:var(--fg-3);text-align:center;font-weight:600}',
      '.qw-d{border:1px solid transparent;border-radius:calc(var(--qw-r) * .6);padding:6px 0 4px;text-align:center;font:inherit;font-size:.8rem;cursor:default;background:none;color:var(--fg-3);min-width:0;display:flex;flex-direction:column;align-items:center;line-height:1.1}',
      '.qw-d small{font-size:.58rem;display:block;min-height:.7rem}',
      '.qw-d.ok{background:var(--ok-soft);color:var(--ok);cursor:pointer}.qw-d.low{background:var(--warn-soft);color:var(--warn);cursor:pointer}.qw-d.closed{background:var(--bad-soft);color:var(--bad);text-decoration:line-through}.qw-d.sold{background:var(--mute-soft);color:var(--fg-3);text-decoration:line-through}',
      '.qw-d.sel{background:var(--qw-accent);color:#fff;border-color:var(--qw-accent)}',
      '.qw-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:.7rem;color:var(--fg-2)}.qw-legend i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:4px;vertical-align:-1px}',
      '.qw-ranges{margin-top:10px;font-size:.76rem;color:var(--fg-2);display:flex;flex-direction:column;gap:3px}',
      '.qw-pax{display:flex;flex-direction:column;gap:10px}.qw-paxr{display:flex;justify-content:space-between;align-items:center;gap:10px}',
      '.qw-step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:calc(var(--qw-r) * .7);overflow:hidden;flex:none}.qw-step button{width:32px;height:30px;border:0;background:var(--surface-2);color:var(--fg);font-size:1rem;cursor:pointer}.qw-step button:disabled{opacity:.4;cursor:not-allowed}.qw-step span{min-width:30px;text-align:center;font-weight:600}',
      '.qw-leg{border:1px solid var(--line-2);border-radius:calc(var(--qw-r) * .7);padding:10px 12px;margin-top:8px}.qw-leg .input{height:32px;font-size:.8rem}',
      '.qw-add{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px dashed var(--line-2)}.qw-add:first-child{border-top:0}',
      '.qw-line{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line-2);align-items:flex-start}.qw-line.rm{color:var(--fg-3);text-decoration:line-through}',
      '.qw-tot{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;margin-top:6px;border-top:2px solid var(--line);font-weight:700;font-size:1.05rem}',
      '.qw-btn{width:100%;height:44px;border:0;border-radius:calc(var(--qw-r) * .8);background:var(--qw-accent);color:#fff;font:inherit;font-weight:700;cursor:pointer;margin-top:12px}.qw-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.qw-link{background:none;border:0;color:var(--link);font:inherit;font-size:.74rem;cursor:pointer;padding:0;text-decoration:underline}',
      '.qw-foot{padding:10px 18px;font-size:.7rem;color:var(--fg-3);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;background:var(--surface-2)}',
      '.qw-modes{display:flex;flex-direction:column;gap:6px;margin-top:8px}.qw-modes label{display:flex;gap:8px;align-items:center;font-size:.8rem}',
      '.qw-full{min-height:100vh;background:var(--bg);padding:18px 14px 40px}.qw-full-in{max-width:760px;margin:0 auto}',
      '.qw-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;font-size:.78rem;color:var(--fg-2);flex-wrap:wrap}'
    ].join('\n');
    document.head.appendChild(s);
  })();

  /* ======================================================================
     Datos semilla propios (idempotente)
     ====================================================================== */
  const CH = { email: ['Email', 'mail'], whatsapp: ['WhatsApp', 'msg'], portal: ['Portal', 'globe'], push: ['Push', 'bell'] };
  const MSG_ST = { programado: ['info', 'Programado'], enviado: ['accent', 'Enviado'], entregado: ['ok', 'Entregado'], leido: ['violet', 'Leído'], fallido: ['bad', 'Fallido'], cancelado: ['mute', 'Cancelado'] };
  const msgBadge = (s) => bd((MSG_ST[s] || ['mute'])[0], (MSG_ST[s] || [0, s])[1]);
  const EVENTS = {
    reserva_confirmada: 'Reserva confirmada (hora de registro)', saldo_vence: 'Vencimiento del saldo (09:00)', viaje: 'Inicio del viaje (hora del primer servicio)',
    fin_viaje: 'Fin del viaje (18:00)', cambio_horario: 'Cambio de horario o incidencia (lo dispara Operaciones)', cumpleanos: 'Cumpleaños del titular durante el viaje (08:00)'
  };
  const VARS = [['pasajero', 'Nombre del titular'], ['reserva', 'Código de reserva'], ['producto', 'Viaje o producto'], ['fecha', 'Fecha de inicio'], ['hora_recojo', 'Hora de recojo'], ['punto_recojo', 'Punto de recojo'], ['saldo', 'Saldo pendiente'], ['fecha_saldo', 'Vencimiento del saldo'], ['enlace_portal', 'Enlace al portal del pasajero']];
  const SALES_CH = ['Directo', 'E-commerce', 'Widget', 'B2B', 'Corporativo'];

  function seed() {
    let ch = false;
    if (!DB.paxMessageTemplates) {
      const t = (id, name, event, offsetHours, channels, subject, body, extra) => Object.assign({ id, name, event, offsetHours, channels, subject, body, lang: 'ES', active: true, conditions: { products: [], channels: [], requiresRule: null, onlyIfBalance: false, onlyIfMissingDocs: false }, updatedAt: '2026-09-20 10:00', updatedBy: 'U01' }, extra || {});
      DB.paxMessageTemplates = [
        t('PMT-001', 'Reserva confirmada', 'reserva_confirmada', 0, ['email', 'whatsapp', 'portal'], 'Su reserva {{reserva}} está confirmada', 'Hola {{pasajero}}:\n\nSu reserva {{reserva}} para {{producto}} con inicio el {{fecha}} está confirmada.\n\nEn su portal encontrará el itinerario, los vouchers y los datos de contacto de operaciones: {{enlace_portal}}\n\nGracias por viajar con Andes Horizonte Travel.'),
        t('PMT-002', 'Recordatorio de saldo', 'saldo_vence', -72, ['email', 'whatsapp'], 'Recordatorio: saldo de su reserva {{reserva}}', 'Hola {{pasajero}}:\n\nLe recordamos que el saldo de {{saldo}} de su reserva {{reserva}} vence el {{fecha_saldo}}. Puede pagarlo con tarjeta o transferencia desde {{enlace_portal}}.\n\nSi ya realizó el pago, ignore este mensaje.', { conditions: { products: [], channels: [], requiresRule: 'R-DEPOSIT', onlyIfBalance: true, onlyIfMissingDocs: false } }),
        t('PMT-003', 'Datos de acompañantes pendientes', 'viaje', -240, ['email', 'portal'], 'Complete los datos de sus acompañantes · {{reserva}}', 'Hola {{pasajero}}:\n\nPara emitir las entradas y el seguro de su viaje del {{fecha}} necesitamos nombre, documento, nacionalidad y fecha de nacimiento de cada acompañante.\n\nComplételos aquí: {{enlace_portal}}', { conditions: { products: [], channels: [], requiresRule: 'R-COMPANIONS', onlyIfBalance: false, onlyIfMissingDocs: true } }),
        t('PMT-004', '7 días antes del viaje', 'viaje', -168, ['email', 'push'], 'Faltan 7 días para {{producto}}', 'Hola {{pasajero}}:\n\nFaltan 7 días para su viaje ({{fecha}}). Revise su itinerario, recomendaciones de altura y lista de equipaje en {{enlace_portal}}.\n\nSi necesita cambiar su punto de recojo, respóndanos por este medio.'),
        t('PMT-005', '48 h antes: punto y hora de recojo', 'viaje', -48, ['whatsapp', 'email', 'push'], 'Recojo confirmado: {{fecha}} a las {{hora_recojo}}', 'Hola {{pasajero}}:\n\nLe recogeremos el {{fecha}} a las {{hora_recojo}} en {{punto_recojo}}. Esté en el lobby 10 minutos antes con su documento de identidad.\n\nLínea de operaciones 24 h: +51 984 100 200.'),
        t('PMT-006', 'Día del servicio', 'viaje', -2, ['whatsapp', 'push'], 'Hoy inicia {{producto}}', 'Buenos días, {{pasajero}}. Su guía le espera a las {{hora_recojo}} en {{punto_recojo}}. Que disfrute el viaje.'),
        t('PMT-007', 'Cambio de horario o incidencia', 'cambio_horario', 0, ['whatsapp', 'email', 'push'], 'Cambio en su servicio · {{reserva}}', 'Hola {{pasajero}}:\n\nHubo un cambio en su servicio del {{fecha}}. Nueva hora de recojo: {{hora_recojo}} en {{punto_recojo}}.\n\nDisculpe las molestias; ante cualquier duda llame a operaciones: +51 984 100 200.'),
        t('PMT-008', 'Postviaje con encuesta', 'fin_viaje', 24, ['email'], '¿Cómo estuvo {{producto}}?', 'Hola {{pasajero}}:\n\nGracias por viajar con nosotros. Cuéntenos su experiencia en 2 minutos; sus comentarios llegan directamente a nuestro equipo: {{enlace_portal}}'),
        t('PMT-009', 'Invitación a reseña externa', 'fin_viaje', 48, ['email'], 'Su opinión ayuda a otros viajeros', 'Hola {{pasajero}}:\n\nSi disfrutó {{producto}}, nos ayudaría mucho que comparta su experiencia en la plataforma de su preferencia. El enlace le llevará directamente a la página oficial de reseñas.\n\n{{enlace_portal}}', { offsetFromRule: true, conditions: { products: [], channels: [], requiresRule: 'R-REVIEW-INVITE', onlyIfBalance: false, onlyIfMissingDocs: false } }),
        t('PMT-010', 'Cumpleaños durante el viaje (opcional)', 'cumpleanos', 0, ['whatsapp'], 'Feliz cumpleaños, {{pasajero}}', 'Feliz cumpleaños, {{pasajero}}. Todo el equipo de Andes Horizonte le desea un gran día en su viaje.', { active: false })
      ];
      ch = true;
    }
    if (!DB.paxMessages) { DB.paxMessages = []; buildSchedule(true); ch = true; }
    if (!DB.fxRateHistory) {
      const H = []; const base = { USD: [3.76, 3.75, 3.75, 3.73, 3.74], EUR: [4.09, 4.07, 4.06, 4.04, 4.05], GBP: [4.80, 4.79, 4.78, 4.79, 4.78] };
      Object.keys(base).forEach(c => base[c].forEach((v, i) => H.push({ id: 'FXH-' + c + '-' + i, code: c, rate: v, prev: i ? base[c][i - 1] : null, at: addDays('2026-09-30', i - 4) + ' 08:00', by: i === 4 ? 'U07' : 'Sistema', source: i === 4 ? 'Manual (Finanzas)' : 'SBS referencial' })));
      DB.fxRateHistory = H.reverse(); ch = true;
    }
    if (!DB.reviewIntegrations) {
      const R = (id, name, api, status, extra) => Object.assign({ id, name, api, status, rating: null, count: null, lastSync: null, scopes: [], account: '', keyMask: '', canReply: false, invites: false, connectedAt: null, connectedBy: null, sample: true }, extra);
      DB.reviewIntegrations = [
        R('tripadvisor', 'TripAdvisor', 'Content API (lectura) + Review Express', 'conectado', { abbr: 'TA', rating: 4.7, count: 1284, lastSync: '2026-09-30 06:00', scopes: ['location_details', 'reviews:read'], account: 'Location ID 2349871', keyMask: '••••••••3f9a', invites: true, connectedAt: '2026-03-02 10:15', connectedBy: 'U01', replyNote: 'La Content API es de solo lectura: las respuestas se publican desde el Management Center de TripAdvisor.' }),
        R('trustpilot', 'Trustpilot', 'Business API (Service Reviews + Invitations)', 'no_conectado', { abbr: 'TP', canReply: true, invites: true }),
        R('google', 'Google Business Profile', 'Business Profile API (reviews.list · updateReply)', 'conectado', { abbr: 'G', rating: 4.8, count: 642, lastSync: '2026-09-30 06:05', scopes: ['business.manage'], account: 'accounts/10744/locations/5521', keyMask: 'OAuth 2.0 · ••••e21c', canReply: true, invites: true, connectedAt: '2026-02-11 09:40', connectedBy: 'U01' }),
        R('facebook', 'Facebook (recomendaciones)', 'Graph API · Page ratings', 'pendiente', { abbr: 'FB', canReply: true, account: 'Página 1049…', note: 'Solicitud de permisos pages_read_user_content en revisión por Meta.' }),
        R('getyourguide', 'GetYourGuide', 'Supplier API (partner)', 'conectado', { abbr: 'GYG', rating: 4.6, count: 389, lastSync: '2026-09-29 22:00', scopes: ['reviews:read', 'bookings:read'], account: 'Supplier 88213', keyMask: '••••••••7b20', connectedAt: '2026-05-20 16:00', connectedBy: 'U01', replyNote: 'Las respuestas se gestionan en el portal de proveedores de GetYourGuide.' }),
        R('viator', 'Viator', 'Viator Partner API (proveedor)', 'no_conectado', { abbr: 'V', replyNote: 'Las respuestas se gestionan en el Management Center de Viator.' })
      ];
      ch = true;
    }
    if (!DB.externalReviews) {
      const V = (id, source, author, dt, rating, title, text, productId, responseStatus, lang, reply) => ({ id, source, author, date: dt, rating, title, text, productId, responseStatus, lang: lang || 'ES', reply: reply || '', repliedAt: reply ? dt : null, repliedBy: reply ? 'U02' : null, sample: true, url: 'https://ejemplo.invalid/' + source + '/' + id });
      DB.externalReviews = [
        V('XRV-0014', 'google', 'Carmen V. (Arequipa)', '2026-09-28', 5, 'Organización impecable', 'Hicimos el Valle Sagrado con mis padres. Recojo puntual, guía muy paciente con los mayores y el almuerzo buffet excelente.', 'PRD-002', 'sin_responder'),
        V('XRV-0013', 'tripadvisor', 'Sarah M. (Reino Unido)', '2026-09-27', 5, 'Machu Picchu done right', 'Our guide Wilber explained everything with passion. The train timing was tight but the team handled it perfectly.', 'PRD-001', 'sin_responder', 'EN'),
        V('XRV-0012', 'getyourguide', 'Lukas B. (Alemania)', '2026-09-26', 4, 'Great hike, early start', 'Rainbow Mountain was stunning. Pick-up at 4:30 was a bit late but the guide compensated on the trail.', 'PRD-004', 'sin_responder', 'EN'),
        V('XRV-0011', 'google', 'Jorge P. (Lima)', '2026-09-25', 2, 'Demora en el traslado', 'El traslado del aeropuerto llegó 40 minutos tarde y nadie nos avisó. El tour estuvo bien, pero la comunicación falló.', 'PRD-005', 'sin_responder'),
        V('XRV-0010', 'tripadvisor', 'Ana y Luis (Chile)', '2026-09-22', 5, 'Circuito completo sin preocupaciones', 'Los cuatro destinos muy bien coordinados, hoteles 3 estrellas limpios y el guía de Puno excelente.', 'PRD-011', 'pendiente_publicar', 'ES', 'Muchas gracias, Ana y Luis. Compartiremos su comentario con el equipo de Puno. Los esperamos pronto.'),
        V('XRV-0009', 'google', 'Rodrigo S. (Cusco)', '2026-09-20', 4, 'Buen servicio', 'Buen tour a Moray y Maras. Recomendaría más tiempo en las salineras.', 'PRD-002', 'publicada', 'ES', 'Gracias, Rodrigo. Tomamos nota para ajustar los tiempos en Maras.'),
        V('XRV-0008', 'getyourguide', 'Emily R. (Estados Unidos)', '2026-09-18', 5, 'Best day in Peru', 'Everything was on time, tickets were ready and the guide spoke perfect English.', 'PRD-001', 'publicada', 'EN', 'Thank you, Emily. We are glad you enjoyed Machu Picchu.'),
        V('XRV-0007', 'tripadvisor', 'Martina G. (Argentina)', '2026-09-15', 3, 'Bien, pero grupo grande', 'El paisaje increíble; el grupo era de 16 personas y costaba escuchar al guía.', 'PRD-001', 'sin_responder'),
        V('XRV-0006', 'google', 'Familia Torres (Trujillo)', '2026-09-12', 5, 'Viajamos con niños', 'Nos explicaron claramente qué edades pagaban y la bebé no pagó. Muy recomendable para familias.', 'PRD-011', 'publicada', 'ES', 'Gracias a ustedes. Nos alegra que el viaje en familia haya sido cómodo.'),
        V('XRV-0005', 'tripadvisor', 'Kenji T. (Japón)', '2026-09-08', 4, 'Well organized', 'Good information about altitude. Hotel in Puno was cold at night.', 'PRD-011', 'sin_responder', 'EN'),
        V('XRV-0004', 'getyourguide', 'Paola M. (Colombia)', '2026-09-05', 1, 'No hubo recojo', 'Nunca llegaron a recogernos al hotel; tuvimos que tomar un taxi a la estación.', 'PRD-001', 'sin_responder'),
        V('XRV-0003', 'google', 'David R. (Lima)', '2026-09-01', 5, 'Excelente atención', 'Atención rápida por WhatsApp y todo según lo ofrecido.', null, 'publicada', 'ES', 'Gracias, David. Fue un gusto atenderle.')
      ];
      ch = true;
    }
    if (!DB.widgetConfig) {
      DB.widgetConfig = {
        tenantSlug: 'andes-horizonte', publicKey: 'pk_live_ah_7Qm2x9LkR4', keyCreatedAt: '2026-06-01 09:00', keyCreatedBy: 'U01', cdn: 'https://cdn.qhapaq.app/widget/v1', host: 'https://reservas.andeshorizonte.pe',
        defaults: { product: 'PRD-011', mode: 'producto', category: 'Cultural', lang: 'es', currency: 'USD', theme: '#0A3A73', radius: 10, reviews: true, method: 'webcomponent', domain: 'blog.andeshorizonte.pe' },
        domains: [
          { id: 'DOM-001', domain: 'www.andeshorizonte.pe', cms: 'Sitio propio (Next.js)', status: 'verificado', token: 'qhapaq-verify=ah-19c2', addedAt: '2026-02-02 16:45', addedBy: 'U01', verifiedAt: '2026-02-02 17:10' },
          { id: 'DOM-002', domain: 'blog.andeshorizonte.pe', cms: 'WordPress', status: 'verificado', token: 'qhapaq-verify=ah-7d41', addedAt: '2026-06-01 09:05', addedBy: 'U01', verifiedAt: '2026-06-01 09:30' },
          { id: 'DOM-003', domain: 'www.hostalqoriwasi.pe', cms: 'Wix (hotel aliado)', status: 'pendiente', token: 'qhapaq-verify=ah-a0f3', addedAt: '2026-09-28 11:20', addedBy: 'U01', verifiedAt: null }
        ]
      };
      ch = true;
    }
    if (!DB.widgetHandoff) { DB.widgetHandoff = []; ch = true; }
    if (ch) Store.save();
  }

  /* ======================================================================
     Reservas: variables y programación de mensajes
     ====================================================================== */
  const liveRes = () => (DB.reservations || []).filter(r => !['cancelada', 'borrador'].includes(r.status));
  const resLead = (r) => (r.passengers || []).find(p => p.isLead) || (r.passengers || [])[0] || {};
  const resClient = (r) => Q.client(r.clientId) || {};
  const resLang = (r) => r.lang ? String(r.lang).toUpperCase() : (resClient(r).country && resClient(r).country !== 'Perú' ? 'EN' : 'ES');
  const firstSvc = (r) => (r.services || []).filter(s => s.status !== 'cancelado').slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  const resProductIds = (r) => { const ids = (r.services || []).map(s => s.productId).filter(Boolean); if (r.booking && r.booking.productId) ids.unshift(r.booking.productId); return ids; };
  const balanceOf = (r) => Math.max(0, (r.total || 0) - Q.resPaid(r.id));
  const msgId = () => nextId(DB.paxMessages, 'MSG-', 6);
  const balanceDue = (r) => (r.booking && r.booking.payment && r.booking.payment.balanceDue) || addDays(r.travelFrom, -15);
  const missingDocs = (r) => (r.passengers || []).some(p => !p.doc);
  function varsFor(r) {
    const l = resLead(r), c = resClient(r), fs = firstSvc(r), bk = r.booking || {};
    return { pasajero: l.name || c.name || 'Pasajero', reserva: r.id, producto: r.title || Q.productName(resProductIds(r)[0]), fecha: date(r.travelFrom), hora_recojo: (bk.pickup && bk.pickup.time) || (fs && fs.time) || '08:00', punto_recojo: (bk.pickup && (bk.pickup.address || bk.pickup.point)) || (fs && fs.notes && /recojo|hotel|lobby|plaza/i.test(fs.notes) ? fs.notes : 'el lobby de su hotel'), saldo: money(balanceOf(r), r.currency), fecha_saldo: date(balanceDue(r)), enlace_portal: 'https://reservas.andeshorizonte.pe/mi-viaje/' + r.id };
  }
  const fill = (txt, v) => String(txt || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => v[k] != null ? v[k] : m);
  const unknownVars = (txt) => (String(txt || '').match(/\{\{\s*([a-z_]+)\s*\}\}/g) || []).map(x => x.replace(/[{}\s]/g, '')).filter(k => !VARS.some(v => v[0] === k));
  function toFor(r, channel) {
    const l = resLead(r), c = resClient(r);
    if (channel === 'email') return l.email || c.email || 'sin-correo@pendiente';
    if (channel === 'whatsapp') return '+51 ' + (l.phone || c.phone || '—');
    if (channel === 'portal') return 'Portal · ' + r.id;
    return 'App pasajero · ' + (l.name || c.name || r.id);
  }
  function tplOffset(t) { return t.offsetFromRule ? (BE.param('R-REVIEW-INVITE', 'daysAfter') || 0) * 24 : (+t.offsetHours || 0); }
  function eventBase(r, ev) {
    const fs = firstSvc(r);
    if (ev === 'reserva_confirmada') return r.createdAt || (r.travelFrom + ' 09:00');
    if (ev === 'saldo_vence') return balanceOf(r) > 0 ? balanceDue(r) + ' 09:00' : null;
    if (ev === 'viaje') return r.travelFrom + ' ' + ((fs && fs.time) || '08:00');
    if (ev === 'fin_viaje') return (r.travelTo || r.travelFrom) + ' 18:00';
    if (ev === 'cumpleanos') { const b = resLead(r).birth || resClient(r).birth; if (!b) return null; const d = r.travelFrom.slice(0, 4) + b.slice(4); return d >= r.travelFrom && d <= (r.travelTo || r.travelFrom) ? d + ' 08:00' : null; }
    return null;
  }
  /* ¿La plantilla aplica a esta reserva? Devuelve el motivo si no aplica */
  function tplBlock(t, r) {
    const c = t.conditions || {};
    if (!t.active) return 'Plantilla inactiva';
    if (c.requiresRule && !BE.on(c.requiresRule)) return 'Regla ' + c.requiresRule + ' inactiva';
    if (c.products && c.products.length && !resProductIds(r).some(id => c.products.includes(id))) return 'Producto fuera de la condición';
    if (c.channels && c.channels.length && !c.channels.includes(r.channel)) return 'Canal de venta fuera de la condición';
    if (c.onlyIfBalance && balanceOf(r) <= 0) return 'Sin saldo pendiente';
    if (c.onlyIfMissingDocs && !missingDocs(r)) return 'Datos de acompañantes completos';
    return null;
  }
  /* Elige la plantilla del idioma de la reserva (o ES) para cada evento */
  function templatesFor(r) {
    const lang = resLang(r); const byKey = {};
    (DB.paxMessageTemplates || []).forEach(t => { const k = t.event + '|' + (t.group || t.id); if (!byKey[k]) byKey[k] = []; byKey[k].push(t); });
    return Object.values(byKey).map(list => list.find(t => t.lang === lang && t.active) || list.find(t => t.lang === 'ES' && t.active) || list[0]);
  }
  /* Recalcula los mensajes programados. Con R-PAX-MESSAGES apagada no programa nada (y retira los pendientes automáticos). */
  function buildSchedule(initial) {
    const now = nowStr(); let added = 0, removed = 0;
    if (!initial) { const before = DB.paxMessages.length; DB.paxMessages = DB.paxMessages.filter(m => !(m.status === 'programado' && m.auto)); removed = before - DB.paxMessages.length; }
    if (!BE.on('R-PAX-MESSAGES')) return { added, removed };
    let i = 0;
    liveRes().forEach(r => templatesFor(r).forEach(t => {
      if (t.event === 'cambio_horario' || tplBlock(t, r)) return;
      const base = eventBase(r, t.event); if (!base) return;
      const at = addHours(base, tplOffset(t)); const v = varsFor(r);
      t.channels.forEach(chn => {
        const done = DB.paxMessages.find(m => m.resId === r.id && m.templateId === t.id && m.channel === chn && m.status !== 'cancelado');
        if (done) return;
        const past = at < now;
        if (past && !initial) return; /* no se reenvían eventos pasados al recalcular */
        if (past && r.status === 'completada' && t.event !== 'fin_viaje') return;
        const m = { id: msgId(), resId: r.id, templateId: t.id, channel: chn, to: toFor(r, chn), subject: fill(t.subject, v), body: fill(t.body, v), status: 'programado', scheduledAt: at, sentAt: null, readAt: null, direction: 'saliente', auto: true, lang: t.lang, attempts: 0 };
        if (past) { i++; const st = chn === 'whatsapp' ? (i % 5 === 3 ? 'fallido' : 'leido') : chn === 'email' ? (i % 3 === 0 ? 'leido' : 'entregado') : chn === 'portal' ? 'leido' : 'entregado'; m.status = st; m.sentAt = at; m.attempts = 1; if (st === 'leido') m.readAt = addHours(at, 1); if (st === 'fallido') m.error = 'El número no tiene WhatsApp o la plantilla no está aprobada por Meta (código 131026).'; }
        DB.paxMessages.push(m); added++;
      });
    }));
    DB.paxMessages.sort((a, b) => String(b.scheduledAt).localeCompare(String(a.scheduledAt)));
    return { added, removed };
  }

  /* ======================================================================
     1) CENTRO DE REGLAS  ·  #/admin/reglas
     ====================================================================== */
  const GROUPS = ['Disponibilidad', 'Pasajeros', 'Alojamiento', 'Adicionales', 'Precios', 'Monedas y pagos', 'Checkout', 'Comunicación'];
  const PM = {
    defaultHours: ['Anticipación por defecto', 'h', 0, 720], minutes: ['Minutos de bloqueo', 'min', 5, 240], minPax: ['Pasajeros mínimos', 'pax', 1, 60], decisionDays: ['Decidir con', 'días antes', 0, 30],
    minAdults: ['Adultos mínimos', '', 0, 10], adultMinAge: ['Edad mínima de adulto', 'años', 8, 18], childMinAge: ['Niño desde', 'años', 0, 17], childMaxAge: ['Niño hasta', 'años', 1, 17],
    maxChildrenPerAdult: ['Niños por adulto', 'máx.', 0, 10], childPricePct: ['Tarifa de niño', '% adulto', 0, 100], infantMaxAge: ['Infante hasta', 'años', 0, 6], maxInfantsPerAdult: ['Infantes por adulto', 'máx.', 0, 5],
    max: ['Máximo por reserva', 'pax', 1, 200], when: ['Cuándo se piden', 'sel', [['al_reservar', 'Al reservar'], ['antes_del_viaje', 'Antes del viaje']]], daysBeforeIfLater: ['Plazo si es después', 'días antes', 1, 60],
    requireDocument: ['Documento obligatorio', 'bool'], minAltitude: ['Altitud mínima', 'm s. n. m.', 1000, 6000], pct: ['Porcentaje', '%', 0, 100], fromPax: ['Desde', 'pax', 2, 100], days: ['Días', 'días', 1, 365],
    fxMarginPct: ['Margen de conversión', '%', 0, 15], balanceDueDays: ['Saldo antes del viaje', 'días', 0, 90], holdHours: ['Bloqueo sin pago', 'h', 1, 168], cardPct: ['Recargo tarjeta', '%', 0, 10],
    askFlight: ['Pedir vuelo de llegada', 'bool'], maxChars: ['Máx. caracteres', '', 100, 5000], daysAfter: ['Días después del viaje', 'días', 0, 30]
  };
  const DEPENDS = { 'R-LODGING-CAPACITY': 'R-LODGING', 'R-SINGLE-SUPP': 'R-LODGING', 'R-REVIEW-INVITE': 'R-PAX-MESSAGES' };
  /* Dónde lee el motor cada parámetro (documentado también en la especificación 17) */
  const ENGINE_USE = {
    'R-CUTOFF': 'BE.dayStatus usa defaultHours si el producto no define cutoffHours ni advMin.', 'R-HOLD': 'Sincroniza settings.holdMinutes (carrito y widget).',
    'R-MIN-ADULTS': 'Sincroniza ecommerce.defaultPaxRules (productos sin reglas propias).', 'R-CHILD-PER-ADULT': 'Sincroniza ecommerce.defaultPaxRules; apagada: sin límite y niño paga 100 %.',
    'R-INFANT-FREE': 'Sincroniza ecommerce.defaultPaxRules; apagada: sin límite e infante paga.', 'R-SINGLE-SUPP': 'BE.quote agrega la línea de suplemento con pct.',
    'R-GROUP-DISC': 'BE.quote aplica pct desde fromPax pagantes.', 'R-EARLY-BIRD': 'BE.quote aplica pct con days o más de anticipación.', 'R-LAST-MINUTE': 'BE.quote recarga pct con menos de days.',
    'R-MULTICURRENCY': 'Sincroniza ecommerce.fxMarginPct.', 'R-DEPOSIT': 'BE.quote usa pct y balanceDueDays si el producto no los define; sincroniza los valores por defecto.',
    'R-PAY-LATER': 'BE.quote devuelve holdHours.', 'R-PAY-FEE': 'BE.quote agrega recargo con cardPct si el medio es tarjeta.', 'R-REVIEW-INVITE': 'Desfase de la plantilla PMT-009 (daysAfter × 24 h).'
  };
  const TEMPLATES = [
    { id: 'receptivo', name: 'Tour operador receptivo', desc: 'Circuitos y excursiones para extranjeros: rangos de disponibilidad, alojamiento por ciudad, varias monedas, adelanto, recojo y mensajes previaje.', on: ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS', 'R-HOLD', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-ALTITUDE', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-SINGLE-SUPP', 'R-ADDONS', 'R-PROMO', 'R-SEASON', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PREVIEW-REMOVE', 'R-PICKUP', 'R-COMMENTS', 'R-NOMINATIVE', 'R-PAX-MESSAGES', 'R-PAX-FEEDBACK', 'R-REVIEW-INVITE'] },
    { id: 'minorista', name: 'Agencia minorista', desc: 'Venta a público local en soles: códigos promocionales, reserva anticipada, reservar ahora y pagar después; sin recojo ni monedas extranjeras.', on: ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-HOLD', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-ADDONS', 'R-PROMO', 'R-EARLY-BIRD', 'R-SEASON', 'R-DEPOSIT', 'R-PAY-LATER', 'R-PREVIEW-REMOVE', 'R-COMMENTS', 'R-PAX-MESSAGES', 'R-PAX-FEEDBACK'] },
    { id: 'aventura', name: 'Operador de aventura', desc: 'Trekking y actividades de altura: grupo mínimo, días de operación, declaración de altura, recargo de última hora y recojo obligatorio; sin alojamiento.', on: ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS', 'R-HOLD', 'R-MIN-GROUP', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-ALTITUDE', 'R-ADDONS', 'R-SEASON', 'R-LAST-MINUTE', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PREVIEW-REMOVE', 'R-PICKUP', 'R-COMMENTS', 'R-PAX-MESSAGES', 'R-PAX-FEEDBACK', 'R-REVIEW-INVITE'] },
    { id: 'b2b', name: 'Solo B2B', desc: 'Venta exclusiva a agencias: sin carrito público, sin promociones ni mensajes de marketing; descuento por grupo, adelanto y pago diferido.', on: ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-COMPANIONS', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-SINGLE-SUPP', 'R-ADDONS', 'R-GROUP-DISC', 'R-SEASON', 'R-DEPOSIT', 'R-PAY-LATER', 'R-NOMINATIVE', 'R-PAX-MESSAGES'] }
  ];
  const RS = { tab: 'reglas', q: '', group: '', state: '', plan: '' };
  /* v2.2 · plan del tenant y vista previa por plan (solo visual; no cambia la suscripción) */
  const viewPlan = () => RS.plan || BE.tenantPlan();
  const minPlanOf = (r) => BE.planOrder().includes(r.minPlan) ? r.minPlan : BE.planOrder()[0];
  const effOn = (r, plan) => r.enabled && BE.planAllows(r.id, plan);
  const DEMO_TAG = '<span class="badge b-warn" title="Valores de prueba: se reemplazarán por los definitivos">Demo — editable</span>';
  const SIM = { plan: '', pid: 'PRD-011', date: null, adt: 2, chd: 1, inf: 1, cur: 'USD', mode: 'adelanto', method: 'transferencia', promo: 0, addons: {}, lodging: {}, removed: [], ym: null };
  const overrideProducts = (id) => (DB.products || []).filter(p => (p.ruleOverrides && p.ruleOverrides[id] === false) || (p.ruleParams && p.ruleParams[id] && Object.keys(p.ruleParams[id]).length));
  const defaults = () => (window.SEED && window.SEED.settings && window.SEED.settings.bookingRules) || [];

  function validateParams(rule, vals) {
    const e = {}; const all = {};
    Object.keys(vals).forEach(k => {
      const m = PM[k]; const v = vals[k]; if (!m) return;
      if (m[1] === 'bool' || m[1] === 'sel') return;
      if (v === '' || v == null || isNaN(v)) { e[k] = 'Ingrese un número'; return; }
      if (v < m[2] || v > m[3]) e[k] = 'Entre ' + m[2] + ' y ' + m[3];
    });
    const P = (id, k) => (id === rule.id ? vals[k] : (BE.rule(id) || { params: {} }).params[k]);
    if (rule.id === 'R-CHILD-PER-ADULT' || rule.id === 'R-INFANT-FREE' || rule.id === 'R-MIN-ADULTS') {
      const cMin = P('R-CHILD-PER-ADULT', 'childMinAge'), cMax = P('R-CHILD-PER-ADULT', 'childMaxAge'), iMax = P('R-INFANT-FREE', 'infantMaxAge'), aMin = P('R-MIN-ADULTS', 'adultMinAge');
      if (cMin != null && cMax != null && cMin > cMax) all.x1 = 'La edad mínima del niño no puede superar la máxima.';
      if (iMax != null && cMin != null && iMax >= cMin) all.x2 = 'La edad máxima del infante (' + iMax + ') debe ser menor que la edad mínima del niño (' + cMin + ').';
      if (aMin != null && cMax != null && cMax >= aMin) all.x3 = 'La edad máxima del niño (' + cMax + ') debe ser menor que la edad mínima del adulto (' + aMin + ').';
    }
    if (rule.id === 'R-DEPOSIT' && vals.pct != null && (vals.pct < 1 || vals.pct > 99)) e.pct = 'Entre 1 y 99 (100 % = pago total)';
    return { ok: !Object.keys(e).length && !Object.keys(all).length, fields: e, cross: Object.values(all) };
  }
  function syncDerived(rule) {
    const e = DB.settings.ecommerce || (DB.settings.ecommerce = {}); const d = e.defaultPaxRules || (e.defaultPaxRules = {}); const P = rule.params || {};
    if (rule.id === 'R-CHILD-PER-ADULT') Object.assign(d, { childMinAge: P.childMinAge, childMaxAge: P.childMaxAge, maxChildrenPerAdult: P.maxChildrenPerAdult, childPricePct: P.childPricePct });
    if (rule.id === 'R-INFANT-FREE') Object.assign(d, { infantMaxAge: P.infantMaxAge, maxInfantsPerAdult: P.maxInfantsPerAdult });
    if (rule.id === 'R-MIN-ADULTS') Object.assign(d, { minAdults: P.minAdults, adultMinAge: P.adultMinAge });
    if (rule.id === 'R-HOLD') { DB.settings.holdMinutes = P.minutes; e.holdMinutes = P.minutes; }
    if (rule.id === 'R-MULTICURRENCY') e.fxMarginPct = P.fxMarginPct;
    if (rule.id === 'R-DEPOSIT') { e.depositPctDefault = P.pct; e.balanceDueDaysDefault = P.balanceDueDays; }
  }
  const afterRuleChange = (id) => { if (['R-PAX-MESSAGES', 'R-REVIEW-INVITE', 'R-COMPANIONS', 'R-DEPOSIT'].includes(id) && DB.paxMessages) buildSchedule(false); };
  function setRule(rule, enabled, why) {
    if (!isAdmin()) { UI.toast('Solo el Tenant Admin puede cambiar reglas (admin.settings.manage).', 'bad'); return false; }
    if (!BE.planAllows(rule.id)) { UI.toast(rule.id + ' está disponible desde el plan ' + minPlanOf(rule) + '. Su plan actual es ' + BE.tenantPlan() + '.', 'bad'); return false; }
    const before = rule.enabled; rule.enabled = enabled; rule.updatedAt = nowStr(); rule.updatedBy = Auth.user.id;
    Audit.log('Regla de reserva', rule.id, enabled ? 'activar' : 'desactivar', before ? 'activa' : 'inactiva', (enabled ? 'activa' : 'inactiva') + (why ? ' · ' + why : ''));
    afterRuleChange(rule.id); Store.save(); return true;
  }

  App.register('admin/reglas', (el) => {
    seed();
    const rules = BE.rules(); const on = rules.filter(r => effOn(r)).length; const inPlan = rules.filter(r => BE.planAllows(r.id)).length; const withOv = (DB.products || []).filter(p => (p.ruleOverrides && Object.values(p.ruleOverrides).some(v => v === false)) || (p.ruleParams && Object.keys(p.ruleParams).length)).length;
    const applied = DB.settings.ruleTemplateApplied;
    el.innerHTML = '<div class="page">' + UI.pageHeader({
      title: 'Centro de reglas de reserva', crumbs: [['Administración'], ['Reglas de reserva']],
      subtitle: 'Cada regla se activa o desactiva para todo el tenant y, si lo admite, por producto. El motor de reservas (BookingEngine) las aplica igual en catálogo, cotizaciones, sitio web, widget, B2B y portales.',
      actions: '<button class="btn" id="xr-new"' + dis(isAdmin(), 'admin.settings.manage') + '>' + ic('plus') + 'Nueva regla</button><button class="btn danger" id="xr-reset"' + dis(isAdmin(), 'admin.settings.manage') + '>' + ic('refresh') + 'Restablecer valores por defecto</button>'
    }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Reglas configuradas', value: rules.length, sub: 'Plan ' + esc(BE.tenantPlan()) + ': ' + inPlan + ' incluidas', icon: 'shield' }) + UI.kpi({ label: 'Activas', value: on, sub: (rules.length - on) + ' inactivas o fuera del plan', icon: 'checkCircle', tone: 'ok' }) + UI.kpi({ label: 'Productos con excepciones', value: withOv, sub: 'ruleOverrides / ruleParams', icon: 'box' }) + UI.kpi({ label: 'Plantilla aplicada', value: applied ? esc(applied.name) : '—', sub: applied ? datetime(applied.at) + ' · ' + esc(Q.userName(applied.by)) : 'Configuración manual', icon: 'layers' }) + '</div>' +
      '<div id="xr-tabs" style="margin-top:16px"></div></div>';
    UI.tabs(el.querySelector('#xr-tabs'), [
      { id: 'reglas', label: 'Reglas', count: rules.length, render: rulesTab },
      { id: 'simulador', label: 'Simulador', render: simTab },
      { id: 'plantillas', label: 'Plantillas por tipo de negocio', render: tplTab },
      { id: 'historial', label: 'Historial de cambios', render: histTab }
    ], RS.tab, { onChange: (id) => { RS.tab = id; } });
    el.querySelector('#xr-new').onclick = newRuleModal;
    el.querySelector('#xr-reset').onclick = () => {
      const d = defaults(); const changed = d.filter(x => { const r = BE.rule(x.id); return !r || r.enabled !== x.enabled || JSON.stringify(r.params) !== JSON.stringify(x.params); });
      UI.confirm({ title: 'Restablecer valores por defecto', danger: true, confirmLabel: 'Restablecer', reason: true, reasonLabel: 'Motivo del cambio',
        message: 'Se restaurarán el estado y los parámetros de las <b>' + d.length + ' reglas estándar</b> (' + changed.length + ' difieren de los valores por defecto). Las reglas personalizadas y las excepciones por producto se conservan.',
        onConfirm: (why) => {
          const custom = BE.rules().filter(r => r.custom);
          DB.settings.bookingRules = clone(d).concat(custom);
          DB.settings.bookingRules.forEach(syncDerived); DB.settings.ruleTemplateApplied = null;
          Audit.log('Regla de reserva', 'TODAS', 'restablecer', changed.length + ' reglas modificadas', 'valores por defecto · ' + why);
          buildSchedule(false); Store.save(); UI.toast('Reglas restablecidas a los valores por defecto.'); App.render();
        } });
    };
  });

  function rulesTab(body) {
    body.innerHTML = '<div class="card"><div class="dt-bar"><div class="search-in" style="flex:1 1 220px;max-width:340px">' + ic('search') + '<input class="input sm" type="search" id="xr-q" placeholder="Buscar regla, código o pantalla…" value="' + esc(RS.q) + '"></div>' +
      '<select class="input sm" id="xr-g" style="width:auto"><option value="">Grupo: todos</option>' + GROUPS.map(g => '<option' + (RS.group === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select>' +
      '<select class="input sm" id="xr-s" style="width:auto"><option value="">Estado: todos</option><option value="on"' + (RS.state === 'on' ? ' selected' : '') + '>Activas</option><option value="off"' + (RS.state === 'off' ? ' selected' : '') + '>Inactivas</option><option value="ov"' + (RS.state === 'ov' ? ' selected' : '') + '>Con excepciones por producto</option><option value="lock"' + (RS.state === 'lock' ? ' selected' : '') + '>No incluidas en el plan</option></select>' +
      '<select class="input sm" id="xr-pl" style="width:auto" title="Solo visual: no cambia la suscripción"><option value="">Previsualizar como plan… (actual: ' + esc(BE.tenantPlan()) + ')</option>' + BE.planOrder().map(p => '<option value="' + p + '"' + (RS.plan === p ? ' selected' : '') + '>Como plan ' + p + (p === BE.tenantPlan() ? ' (actual)' : '') + '</option>').join('') + '</select>' +
      '<div class="grow"></div><span class="xs faint">' + (isAdmin() ? 'Los cambios se aplican de inmediato y quedan auditados.' : 'Solo lectura') + '</span></div></div><div id="xr-list" class="stack" style="margin-top:14px"></div>';
    const draw = () => keepScroll(() => drawRules(body.querySelector('#xr-list')));
    body.querySelector('#xr-q').addEventListener('input', Util.debounce(e => { RS.q = e.target.value; draw(); }, 150));
    body.querySelector('#xr-g').onchange = (e) => { RS.group = e.target.value; draw(); };
    body.querySelector('#xr-s').onchange = (e) => { RS.state = e.target.value; draw(); };
    body.querySelector('#xr-pl').onchange = (e) => { RS.plan = e.target.value; draw(); };
    draw();
  }
  function paramInput(rule, k, v) {
    const m = PM[k] || [k, '', 0, 99999]; const id = 'xp-' + rule.id + '-' + k; const d = isAdmin() ? '' : ' disabled';
    let inp;
    if (m[1] === 'bool') inp = '<select class="input sm" id="' + id + '" data-k="' + k + '" data-t="bool"' + d + '><option value="1"' + (v ? ' selected' : '') + '>Sí</option><option value="0"' + (!v ? ' selected' : '') + '>No</option></select>';
    else if (m[1] === 'sel') inp = '<select class="input sm" id="' + id + '" data-k="' + k + '" data-t="sel"' + d + '>' + m[2].map(o => '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    else inp = '<input class="input sm num" type="number" id="' + id + '" data-k="' + k + '" data-t="num" value="' + esc(v) + '" min="' + m[2] + '" max="' + m[3] + '" step="' + (['cardPct', 'fxMarginPct'].includes(k) ? '0.1' : '1') + '"' + d + '>';
    return '<div class="xr-p"><label for="' + id + '">' + esc(m[0]) + (m[1] && !['bool', 'sel'].includes(m[1]) ? ' (' + esc(m[1]) + ')' : '') + '</label>' + inp + '</div>';
  }
  function drawRules(list) {
    const q = RS.q.toLowerCase();
    const vp = viewPlan(); const prev = RS.plan && RS.plan !== BE.tenantPlan();
    const rules = BE.rules().filter(r => (!RS.group || r.group === RS.group) && (!RS.state || (RS.state === 'on' ? effOn(r, vp) : RS.state === 'off' ? !effOn(r, vp) : RS.state === 'lock' ? !BE.planAllows(r.id, vp) : overrideProducts(r.id).length)) && (!q || (r.id + ' ' + r.name + ' ' + r.desc + ' ' + (r.scope || []).join(' ')).toLowerCase().includes(q)));
    const groups = GROUPS.concat(Array.from(new Set(BE.rules().map(r => r.group))).filter(g => !GROUPS.includes(g)));
    const html = groups.map(g => { const rs = rules.filter(r => r.group === g); if (!rs.length) return ''; const act = rs.filter(r => effOn(r, vp)).length; const lk = rs.filter(r => !BE.planAllows(r.id, vp)).length;
      return '<div class="card xr-grp"><div class="card-h"><div><div class="t">' + esc(g) + '</div><div class="s">' + act + ' de ' + rs.length + ' activas' + (lk ? ' · ' + lk + ' fuera del plan ' + esc(vp) : '') + '</div></div></div><div class="card-b">' + rs.map(ruleRow).join('') + '</div></div>'; }).join('');
    const all = BE.rules(); const pOn = all.filter(r => effOn(r, vp)).length;
    list.innerHTML = (prev ? UI.alert('info', '<b>Vista previa como plan ' + esc(vp) + '</b> (solo visual, no cambia la suscripción ' + esc(BE.tenantPlan()) + '): quedarían activas <b>' + pOn + '</b> de ' + all.length + ' reglas; ' + all.filter(r => !BE.planAllows(r.id, vp)).length + ' no están incluidas en ese plan. <a href="#/admin/suscripcion">Ver comparativo de planes</a>. ' + DEMO_TAG) : '') +
      (html || UI.card('', UI.empty('Ninguna regla coincide con los filtros.', 'search')));
    list.querySelectorAll('[data-toggle]').forEach(inp => inp.onchange = () => {
      const r = BE.rule(inp.dataset.toggle); if (!setRule(r, inp.checked)) { inp.checked = !inp.checked; return; }
      UI.toast('Regla ' + esc(r.id) + (inp.checked ? ' activada' : ' desactivada') + '. ' + (inp.checked ? 'Se aplica desde ahora en: ' : 'Deja de aplicarse en: ') + esc((r.scope || []).join(', ')) + '.', inp.checked ? 'ok' : 'warn');
      keepScroll(() => drawRules(list));
    });
    list.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
      const r = BE.rule(b.dataset.save); const row = b.closest('.xr-row'); const vals = {};
      row.querySelectorAll('[data-k]').forEach(i => { vals[i.dataset.k] = i.dataset.t === 'bool' ? i.value === '1' : i.dataset.t === 'sel' ? i.value : (i.value === '' ? '' : Number(i.value)); });
      const v = validateParams(r, vals);
      row.querySelectorAll('.input.err').forEach(i => i.classList.remove('err')); const ex = row.querySelector('.xr-err'); if (ex) ex.remove();
      if (!v.ok) { Object.keys(v.fields).forEach(k => { const i = row.querySelector('[data-k="' + k + '"]'); if (i) { i.classList.add('err'); i.title = v.fields[k]; } }); row.querySelector('.xr-params').insertAdjacentHTML('afterend', '<div class="xr-err">' + esc(Object.entries(v.fields).map(([k, m]) => (PM[k] || [k])[0] + ': ' + m).concat(v.cross).join(' · ')) + '</div>'); UI.toast('Revise los parámetros de ' + esc(r.id) + '.', 'bad'); return; }
      if (!isAdmin()) { UI.toast('Requiere permiso admin.settings.manage.', 'bad'); return; }
      const before = JSON.stringify(r.params); r.params = Object.assign({}, r.params, vals); r.updatedAt = nowStr(); r.updatedBy = Auth.user.id; syncDerived(r); afterRuleChange(r.id);
      Audit.log('Regla de reserva', r.id, 'editar_parametros', before, JSON.stringify(r.params)); Store.save();
      UI.toast('Parámetros de ' + esc(r.id) + ' guardados.'); keepScroll(() => drawRules(list));
    });
    list.querySelectorAll('[data-ov]').forEach(b => b.onclick = () => overridesDrawer(BE.rule(b.dataset.ov), () => keepScroll(() => drawRules(list))));
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const r = BE.rule(b.dataset.del); UI.confirm({ title: 'Eliminar regla personalizada', danger: true, confirmLabel: 'Eliminar', message: '¿Eliminar la regla <b>' + esc(r.id) + '</b>? Las pantallas que la consulten con BE.on() la considerarán activa por defecto.', onConfirm: () => { DB.settings.bookingRules = BE.rules().filter(x => x.id !== r.id); Audit.log('Regla de reserva', r.id, 'eliminar', r.name, ''); Store.save(); UI.toast('Regla eliminada.'); keepScroll(() => drawRules(list)); } }); });
  }
  function ruleRow(r) {
    const ov = overrideProducts(r.id); const parent = DEPENDS[r.id]; const pOff = parent && !BE.on(parent);
    const keys = Object.keys(r.params || {}); const vp = viewPlan(); const ok = BE.planAllows(r.id, vp); const mp = minPlanOf(r);
    const sw = ok ? '<label class="switch" title="' + (isAdmin() ? (r.enabled ? 'Desactivar' : 'Activar') : 'Requiere permiso admin.settings.manage') + '"><input type="checkbox" data-toggle="' + esc(r.id) + '"' + (r.enabled ? ' checked' : '') + (isAdmin() && BE.planAllows(r.id) ? '' : ' disabled') + ' aria-label="Activar ' + esc(r.name) + '"></label>'
      : '<div class="xr-lk" title="Disponible desde el plan ' + esc(mp) + '"><label class="switch"><input type="checkbox" disabled aria-label="' + esc(r.name) + ': bloqueada por plan"></label>' + ic('lock').replace('<svg', '<svg width="14" height="14"') + '</div>';
    return '<div class="xr-row' + (!ok ? ' lock' : r.enabled ? '' : ' off') + '" data-rule="' + esc(r.id) + '">' +
      '<div>' + sw + '</div>' +
      '<div style="min-width:0"><div class="row" style="gap:8px"><span class="xr-name">' + esc(r.name) + '</span><span class="tag mono">' + esc(r.id) + '</span>' + (!ok ? bd('mute', 'No incluida en el plan') : r.enabled ? bd('ok', 'Activa') : bd('mute', 'Inactiva')) + '<span class="tag" title="Plan mínimo según la matriz de demostración">Desde ' + esc(mp) + '</span>' + (r.custom ? bd('info', 'Personalizada') : '') + '</div>' +
      '<div class="small muted" style="margin-top:4px">' + esc(r.desc) + '</div>' +
      (!ok ? '<div class="xr-plan">' + ic('lock').replace('<svg', '<svg width="12" height="12"') + '<span>Disponible desde el plan <b>' + esc(mp) + '</b>' + (r.enabled ? ' · configurada como activa: se aplicará al mejorar de plan' : '') + '.</span>' + (BE.planAllows(r.id) ? '<span class="tag">Vista previa · su plan ' + esc(BE.tenantPlan()) + ' sí la incluye</span>' : '<a class="btn xs" href="#/admin/suscripcion">' + ic('layers') + 'Mejorar plan</a>') + '</div>' : '') +
      (pOff && r.enabled ? '<div class="xs" style="color:var(--warn);margin-top:4px">Sin efecto mientras ' + esc(parent) + ' esté inactiva.</div>' : '') +
      (ENGINE_USE[r.id] ? '<div class="xs faint" style="margin-top:4px">' + ic('info').replace('<svg', '<svg width="12" height="12" style="vertical-align:-2px"') + ' ' + esc(ENGINE_USE[r.id]) + '</div>' : '') +
      (keys.length ? '<div class="xr-params">' + keys.map(k => paramInput(r, k, r.params[k])).join('') + (isAdmin() ? '<button class="btn sm" data-save="' + esc(r.id) + '">' + ic('check') + 'Guardar</button>' : '') + '</div>' : '') + '</div>' +
      '<div class="xr-side"><div><span class="faint">Aplica en:</span> ' + (r.scope || []).map(s => '<span class="tag">' + esc(s) + '</span>').join(' ') + '</div>' +
      '<div><span class="faint">Excepción por producto:</span> <b>' + (r.productOverride ? 'Sí' : 'No') + '</b></div>' +
      (r.productOverride || ov.length ? '<button class="btn xs" data-ov="' + esc(r.id) + '">' + ic('box') + (ov.length ? ov.length + ' producto' + (ov.length > 1 ? 's la sobrescriben' : ' la sobrescribe') : 'Sin excepciones') + '</button>' : '') +
      (r.updatedAt ? '<div class="xs faint">Modificada ' + datetime(r.updatedAt) + ' · ' + esc(Q.userName(r.updatedBy)) + '</div>' : '') +
      (r.custom && isAdmin() ? '<button class="btn xs ghost" data-del="' + esc(r.id) + '">' + ic('trash') + 'Eliminar</button>' : '') + '</div></div>';
  }
  function overridesDrawer(rule, done) {
    const draw = (d) => {
      const ov = overrideProducts(rule.id);
      d.querySelector('.drawer-b').innerHTML = UI.alert('info', 'Estado del tenant: <b>' + (rule.enabled ? 'activa' : 'inactiva') + '</b>. Una excepción solo puede <b>desactivar</b> la regla para un producto o cambiar sus parámetros; si la regla está inactiva en el tenant, no aplica en ningún producto.') +
        (ov.length ? '<div class="list" style="margin-top:12px">' + ov.map(p => { const off = p.ruleOverrides && p.ruleOverrides[rule.id] === false; const pr = p.ruleParams && p.ruleParams[rule.id];
          return '<div class="list-item"><div class="grow" style="min-width:0"><a href="#/catalogo/productos/' + esc(p.id) + '"><b>' + esc(p.id) + '</b> · ' + esc(p.name) + '</a><div class="xs faint">' + (off ? 'Regla desactivada en este producto' : '') + (pr ? (off ? ' · ' : '') + 'Parámetros: ' + esc(Object.entries(pr).map(([k, v]) => ((PM[k] || [k])[0]) + ' = ' + v).join(', ')) : '') + '</div></div>' + (isAdmin() ? '<button class="btn xs" data-rmov="' + esc(p.id) + '">' + ic('x') + 'Quitar</button>' : '') + '</div>'; }).join('') + '</div>' : '<div style="margin-top:12px">' + UI.empty('Ningún producto sobrescribe esta regla.', 'box') + '</div>') +
        (rule.productOverride && isAdmin() ? '<div class="section-title" style="margin-top:18px">Agregar excepción</div><div class="form-grid" style="margin-top:10px">' +
          UI.field({ id: 'ov-p', label: 'Producto', type: 'select', col: 12, required: true, placeholder: 'Seleccione…', options: DB.products.filter(p => p.status === 'ACTIVE').map(p => [p.id, p.id + ' · ' + p.name]) }) +
          UI.field({ id: 'ov-off', label: 'Desactivar la regla en este producto', type: 'switch', col: 12, value: !Object.keys(rule.params || {}).length }) +
          Object.keys(rule.params || {}).map(k => PM[k] && !['bool', 'sel'].includes(PM[k][1]) ? UI.field({ id: 'ov-k-' + k, label: PM[k][0] + ' (' + PM[k][1] + ') — vacío = valor del tenant', type: 'number', col: 6 }) : '').join('') +
          '<div class="c12"><button class="btn primary" id="ov-add">' + ic('plus') + 'Guardar excepción</button></div></div>' : (rule.productOverride ? '' : UI.alert('warn', 'Esta regla no admite excepciones por producto (productOverride = false).')));
      d.querySelectorAll('[data-rmov]').forEach(b => b.onclick = () => { const p = Q.product(b.dataset.rmov); if (p.ruleOverrides) delete p.ruleOverrides[rule.id]; if (p.ruleParams) delete p.ruleParams[rule.id]; Audit.log('Producto', p.id, 'quitar_excepcion_regla', rule.id, ''); Store.save(); UI.toast('Excepción quitada de ' + esc(p.id) + '.'); draw(d); done(); });
      const add = d.querySelector('#ov-add'); if (add) add.onclick = () => {
        const root = d.querySelector('.drawer-b'); if (!UI.validate(root)) return; const p = Q.product(root.querySelector('#ov-p').value); const off = root.querySelector('#ov-off').checked; const pr = {};
        Object.keys(rule.params || {}).forEach(k => { const i = root.querySelector('#ov-k-' + k); if (i && i.value !== '') pr[k] = Number(i.value); });
        const v = validateParams(rule, Object.assign({}, rule.params, pr)); if (!v.ok) { UI.toast('Parámetros fuera de rango: ' + esc(Object.values(v.fields).concat(v.cross).join(' · ')), 'bad'); return; }
        if (!off && !Object.keys(pr).length) { UI.toast('Desactive la regla o indique al menos un parámetro.', 'bad'); return; }
        if (off) { p.ruleOverrides = p.ruleOverrides || {}; p.ruleOverrides[rule.id] = false; }
        if (Object.keys(pr).length) { p.ruleParams = p.ruleParams || {}; p.ruleParams[rule.id] = pr; }
        Audit.log('Producto', p.id, 'excepcion_regla', '', rule.id + (off ? ' desactivada' : '') + (Object.keys(pr).length ? ' ' + JSON.stringify(pr) : '')); Store.save(); UI.toast('Excepción registrada en ' + esc(p.id) + '.'); draw(d); done();
      };
    };
    UI.drawer({ title: 'Excepciones por producto · ' + esc(rule.id), sub: esc(rule.name), body: '', onOpen: draw });
  }
  function newRuleModal() {
    if (!isAdmin()) { UI.toast('Requiere permiso admin.settings.manage.', 'bad'); return; }
    const scopes = Array.from(new Set(BE.rules().flatMap(r => r.scope || [])));
    UI.modal({ title: 'Nueva regla personalizada', size: 'lg', sub: 'La regla queda disponible como interruptor consultable con BE.on(id). Su comportamiento en pantallas lo implementa el equipo de desarrollo (ver especificación 17).',
      body: UI.form([
        { id: 'nr-id', label: 'Código (R-…)', required: true, col: 4, placeholder: 'R-SENIOR-DISC', hint: 'Mayúsculas, números y guiones' },
        { id: 'nr-g', label: 'Grupo', type: 'select', col: 4, options: GROUPS, value: 'Precios' },
        { id: 'nr-po', label: 'Admite excepción por producto', type: 'switch', col: 4, value: true },
        { id: 'nr-n', label: 'Nombre', required: true, col: 12, placeholder: 'Descuento para adultos mayores' },
        { id: 'nr-d', label: 'Descripción', type: 'textarea', required: true, col: 12, rows: 2 },
        { id: 'nr-p', label: 'Parámetros (clave=valor separados por ;)', col: 12, placeholder: 'minAge=65; pct=10' },
        { type: 'html', col: 12, html: '<label class="xs faint" style="font-weight:600">Aplica en</label><div class="xm-checks" style="margin-top:6px">' + scopes.map(s => '<label class="check"><input type="checkbox" data-sc="' + esc(s) + '"> ' + esc(s) + '</label>').join('') + '</div>' }
      ]),
      actions: [{ label: 'Cancelar' }, { label: 'Crear regla', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const id = f['nr-id'].toUpperCase();
        if (!/^R-[A-Z0-9-]{2,30}$/.test(id)) { UI.toast('El código debe tener el formato R-XXXX.', 'bad'); return false; }
        if (BE.rule(id)) { UI.toast('Ya existe una regla ' + esc(id) + '.', 'bad'); return false; }
        const params = {}; let bad = false; (f['nr-p'] || '').split(';').map(x => x.trim()).filter(Boolean).forEach(kv => { const [k, v] = kv.split('=').map(x => (x || '').trim()); if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(k || '')) bad = true; else params[k] = v !== '' && !isNaN(v) ? Number(v) : v; });
        if (bad) { UI.toast('Parámetros inválidos: use clave=valor; separados por punto y coma.', 'bad'); return false; }
        const scope = Array.from(m.querySelectorAll('[data-sc]:checked')).map(i => i.dataset.sc); if (!scope.length) { UI.toast('Indique al menos una pantalla donde aplica.', 'bad'); return false; }
        const r = { id, group: f['nr-g'], name: f['nr-n'], desc: f['nr-d'], enabled: false, params, scope, productOverride: f['nr-po'], custom: true, createdAt: nowStr(), createdBy: Auth.user.id };
        BE.rules().push(r); Audit.log('Regla de reserva', id, 'crear', '', r.name); Store.save(); UI.toast('Regla ' + esc(id) + ' creada (inactiva). Actívela cuando el comportamiento esté implementado.'); RS.tab = 'reglas'; App.render();
      } }] });
  }

  /* ---- Simulador ---- */
  /* Simula el plan: BE.on() consulta BE.tenantPlan(); se sustituye solo durante el cálculo y se restaura siempre. */
  function simTab(body) {
    const real = BE.tenantPlan; const plan = SIM.plan && BE.planOrder().includes(SIM.plan) ? SIM.plan : '';
    if (plan) BE.tenantPlan = () => plan;
    try { simTabInner(body, plan || real.call(BE), real.call(BE)); } finally { BE.tenantPlan = real; }
  }
  function simTabInner(body, simPlan, realPlan) {
    const prods = (DB.products || []).filter(p => p.status === 'ACTIVE' && (p.rates || []).some(r => r.status === 'vigente'));
    let p = Q.product(SIM.pid) || prods[0]; SIM.pid = p.id;
    if (!SIM.date || BE.dayStatus(p, SIM.date).status === 'pasado') SIM.date = BE.nextAvailable(p, SIM.adt + SIM.chd) || T();
    const curs = BE.on('R-MULTICURRENCY') ? BE.currencies() : [BE.currency(BE.cfg().baseCurrency || 'PEN')];
    if (!curs.some(c => c.code === SIM.cur)) SIM.cur = curs[0].code;
    const sel = simSel(p); const q = BE.quote(p, sel); const st = BE.dayStatus(p, SIM.date, SIM.adt + SIM.chd + (BE.paxRules(p).infantPays ? SIM.inf : 0));
    const [y, m0] = SIM.date.split('-').map(Number); const month = BE.month(p, y, m0 - 1, SIM.adt + SIM.chd);
    const legs = BE.on('R-LODGING', p) && p.accommodation ? p.accommodation.legs : [];
    const addons = BE.on('R-ADDONS', p) ? (p.addons || []) : [];
    const cellCls = (d) => d.status === 'disponible' ? (d.left != null && d.left <= 4 ? 'low' : 'ok') : d.status === 'sin_cupo' ? 'low' : ['cerrado'].includes(d.status) ? 'closed' : d.status === 'agotado' ? 'sold' : 'na';
    const first = new Date(y, m0 - 1, 1).getDay();
    const RULE_IDS = ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-SINGLE-SUPP', 'R-ADDONS', 'R-PROMO', 'R-GROUP-DISC', 'R-EARLY-BIRD', 'R-LAST-MINUTE', 'R-SEASON', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PAY-LATER', 'R-PAY-FEE', 'R-PREVIEW-REMOVE'];
    const ruleState = (id) => { const r = BE.rule(id); if (!r) return bd('mute', 'No existe'); if (!BE.planAllows(id, simPlan)) return bd('warn', 'Fuera del plan ' + simPlan); if (!r.enabled) return bd('mute', 'Inactiva (tenant)'); if (!BE.on(id, p)) return bd('warn', 'Desactivada en el producto'); return bd('ok', 'Aplica'); };
    const fm = (n) => BE.fmt(n, q.currency);
    body.innerHTML = '<div class="grid g-1-2"><div class="stack">' + UI.card('Escenario', '<div class="form-grid">' +
      UI.field({ id: 'sm-p', label: 'Producto', type: 'select', col: 12, value: p.id, options: prods.map(x => [x.id, x.id + ' · ' + x.name]) }) +
      UI.field({ id: 'sm-pl', label: 'Plan a simular', type: 'select', col: 12, value: SIM.plan, options: [['', 'Plan actual (' + realPlan + ')']].concat(BE.planOrder().map(x => [x, 'Como plan ' + x])), hint: 'Solo simulación: BE.planAllows(regla, plan). No cambia la suscripción.' }) +
      UI.field({ id: 'sm-d', label: 'Fecha del servicio', type: 'date', col: 6, value: SIM.date }) +
      UI.field({ id: 'sm-c', label: 'Moneda', type: 'select', col: 6, value: SIM.cur, options: curs.map(c => [c.code, c.code + ' · ' + c.name]), hint: BE.on('R-MULTICURRENCY') ? '' : 'R-MULTICURRENCY inactiva: solo moneda base' }) +
      UI.field({ id: 'sm-a', label: 'Adultos', type: 'number', col: 4, min: 0, value: SIM.adt }) + UI.field({ id: 'sm-n', label: 'Niños', type: 'number', col: 4, min: 0, value: SIM.chd }) + UI.field({ id: 'sm-i', label: 'Infantes', type: 'number', col: 4, min: 0, value: SIM.inf }) +
      UI.field({ id: 'sm-m', label: 'Modalidad de pago', type: 'select', col: 6, value: q.paymentMode, options: q.modes.map(x => [x, { total: 'Pago total', adelanto: 'Adelanto', pagar_despues: 'Pagar después' }[x] || x]) }) +
      UI.field({ id: 'sm-mt', label: 'Medio de pago', type: 'select', col: 6, value: SIM.method, options: [['transferencia', 'Transferencia'], ['tarjeta', 'Tarjeta']] }) +
      (BE.on('R-PROMO', p) ? UI.field({ id: 'sm-pr', label: 'Código promocional (%)', type: 'number', col: 6, min: 0, max: 50, value: SIM.promo }) : '') +
      '</div>' +
      (addons.length ? '<div class="section-title" style="margin-top:14px">Adicionales</div><div class="stack" style="gap:6px;margin-top:8px">' + addons.map(a => '<div class="row between small" style="flex-wrap:nowrap;gap:8px"><span style="min-width:0">' + esc(a.name) + ' <span class="faint">' + money(a.price, a.currency) + '/' + esc(a.per) + '</span></span><input class="input sm num" type="number" min="0" max="20" style="width:64px" data-sad="' + a.id + '" value="' + (SIM.addons[a.id] || 0) + '"></div>').join('') + '</div>' : '') +
      (legs.length ? '<div class="section-title" style="margin-top:14px">Alojamiento por ciudad</div><div class="stack" style="gap:8px;margin-top:8px">' + legs.map(l => { const s = SIM.lodging[l.id] || {}; const h = l.hotels.find(x => x.id === s.hotelId); return '<div><div class="xs faint" style="font-weight:600">' + esc(l.city) + ' · ' + l.nights + ' noche(s)</div><div class="row" style="gap:6px;flex-wrap:nowrap"><select class="input sm" data-slh="' + l.id + '"><option value="">Sin alojamiento</option>' + l.hotels.map(x => '<option value="' + x.id + '"' + (x.id === s.hotelId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' + (h ? '<select class="input sm" style="width:auto" data-slt="' + l.id + '">' + h.rooms.map(rm => '<option' + (rm.type === s.type ? ' selected' : '') + '>' + rm.type + '</option>').join('') + '</select><input class="input sm num" type="number" min="1" max="10" style="width:56px" data-slq="' + l.id + '" value="' + (s.qty || 1) + '">' : '') + '</div></div>'; }).join('') + '</div>' : '')
    ) +
      UI.card('Disponibilidad de ' + ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'][m0 - 1] + ' ' + y, '<div class="xmcal">' + ['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => '<div class="h">' + d + '</div>').join('') + '<div></div>'.repeat(first) + month.map(d => '<div class="d ' + cellCls(d) + (d.date === SIM.date ? ' sel' : '') + '" title="' + esc(d.date + ' · ' + d.label + (d.note ? ' · ' + d.note : '')) + '">' + d.day + '</div>').join('') + '</div>' +
        (BE.on('R-AVAIL-RANGES', p) && BE.rangesSummary(p).length ? '<div class="xs muted" style="margin-top:10px">' + BE.rangesSummary(p).map(r => '<div>' + { disponible: 'Disponible', cerrado: 'Ocupado / cerrado', agotado: 'Agotado' }[r.status] + ' del ' + dateShort(r.from) + ' al ' + dateShort(r.to) + (r.note ? ' · ' + esc(r.note) : '') + '</div>').join('') + '</div>' : '<div class="xs faint" style="margin-top:10px">' + (BE.on('R-AVAIL-RANGES', p) ? 'El producto no tiene rangos configurados.' : 'R-AVAIL-RANGES inactiva: no se evalúan rangos de fechas.') + '</div>'), { sub: 'BE.month(p, año, mes, asientos)' }) +
      '</div><div class="stack">' +
      UI.card('Resultado de BookingEngine', '<div class="row" style="gap:8px;margin-bottom:10px">' + '<span class="small">Día ' + esc(date(SIM.date)) + ':</span>' + bd(st.status === 'disponible' ? 'ok' : ['sin_cupo', 'fuera_de_plazo'].includes(st.status) ? 'warn' : 'bad', st.label) + (st.left != null ? '<span class="xs faint">Cupos libres: ' + st.left + '</span>' : '') + (st.note ? '<span class="xs faint">' + esc(st.note) + '</span>' : '') + (q.ok ? bd('ok', 'Cotización válida') : bd('bad', 'No reservable')) + '</div>' +
        (q.warnings.length ? UI.alert(q.ok ? 'warn' : 'bad', q.warnings.map(esc).join('<br>')) : '') +
        '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Unitario</th><th class="num">Importe</th><th>Quitar</th></tr></thead><tbody>' +
        q.lines.map(l => '<tr' + (l.removed ? ' style="opacity:.5;text-decoration:line-through"' : '') + '><td>' + esc(l.label) + ' <span class="tag">' + l.kind + '</span></td><td class="num">' + (l.kind === 'info' ? '' : l.qty) + '</td><td class="num">' + (l.kind === 'info' ? '' : fm(l.unit)) + '</td><td class="num">' + (l.kind === 'info' ? '' : fm(l.amount)) + '</td><td>' + (l.removable ? '<input type="checkbox" data-srm="' + esc(l.key) + '"' + (l.removed ? ' checked' : '') + ' aria-label="Quitar">' : '<span class="faint xs">—</span>') + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td colspan="3">Subtotal</td><td class="num">' + fm(q.subtotal) + '</td><td></td></tr>' + q.adjustments.map(a => '<tr><td colspan="3">' + esc(a.label) + '</td><td class="num">' + fm(a.amount) + '</td><td></td></tr>').join('') + '<tr><td colspan="3"><b>Total</b></td><td class="num"><b>' + fm(q.total) + '</b></td><td></td></tr></tfoot></table></div>' +
        UI.dl([['Modalidad', { total: 'Pago total', adelanto: 'Adelanto ' + q.depositPct + ' %', pagar_despues: 'Reservar ahora, pagar después' }[q.paymentMode]], ['Paga ahora', fm(q.deposit)], ['Saldo', fm(q.balance) + (q.balanceDue ? ' · vence ' + date(q.balanceDue) : '')], q.holdHours ? ['Bloqueo sin pago', q.holdHours + ' h'] : null, legs.length ? ['Habitaciones / noches', q.rooms + ' hab. · ' + q.nights + ' noches'] : null, ['Temporada', q.season ? esc(q.season.name) + ' (factor ' + q.season.factor + ')' : 'Sin factor'], ['Moneda de la tarifa', q.rateCurrency + (q.currency !== q.rateCurrency ? ' → ' + q.currency + ' (TC referencial)' : '')]]),
        { sub: 'BE.quote(producto, selección) con las reglas vigentes' }) +
      UI.card('Reglas que intervienen para ' + esc(p.id) + ' · plan ' + esc(simPlan) + (SIM.plan && SIM.plan !== realPlan ? ' (simulado)' : ''), '<div class="tbl-wrap"><table class="tbl"><tbody>' + RULE_IDS.map(id => '<tr><td class="mono xs">' + id + '</td><td class="small">' + esc((BE.rule(id) || {}).name || '') + '</td><td>' + ruleState(id) + '</td></tr>').join('') + '</tbody></table></div>') +
      '</div></div>';
    const redraw = () => keepScroll(() => simTab(body));
    const bind = (id, fn) => { const e = body.querySelector(id); if (e) e.onchange = () => { fn(e); redraw(); }; };
    bind('#sm-pl', e => { SIM.plan = e.value; });
    bind('#sm-p', e => { SIM.pid = e.value; SIM.date = null; SIM.addons = {}; SIM.lodging = {}; SIM.removed = []; });
    bind('#sm-d', e => { if (e.value) SIM.date = e.value; });
    bind('#sm-c', e => { SIM.cur = e.value; }); bind('#sm-m', e => { SIM.mode = e.value; }); bind('#sm-mt', e => { SIM.method = e.value; }); bind('#sm-pr', e => { SIM.promo = Math.max(0, Math.min(50, +e.value || 0)); });
    ['a', 'n', 'i'].forEach((k, i) => bind('#sm-' + k, e => { SIM[['adt', 'chd', 'inf'][i]] = Math.max(0, Math.min(30, +e.value || 0)); }));
    body.querySelectorAll('[data-sad]').forEach(e => e.onchange = () => { SIM.addons[e.dataset.sad] = Math.max(0, +e.value || 0); redraw(); });
    body.querySelectorAll('[data-slh]').forEach(e => e.onchange = () => { const l = legs.find(x => x.id === e.dataset.slh); const h = l.hotels.find(x => x.id === e.value); SIM.lodging[l.id] = h ? { hotelId: h.id, type: (h.rooms.find(r => r.type === 'Doble') || h.rooms[0]).type, qty: 1 } : {}; redraw(); });
    body.querySelectorAll('[data-slt]').forEach(e => e.onchange = () => { SIM.lodging[e.dataset.slt].type = e.value; redraw(); });
    body.querySelectorAll('[data-slq]').forEach(e => e.onchange = () => { SIM.lodging[e.dataset.slq].qty = Math.max(1, +e.value || 1); redraw(); });
    body.querySelectorAll('[data-srm]').forEach(e => e.onchange = () => { const k = e.dataset.srm; SIM.removed = SIM.removed.filter(x => x !== k); if (e.checked) SIM.removed.push(k); redraw(); });
  }
  function simSel(p) {
    return { date: SIM.date, pax: { adt: SIM.adt, chd: SIM.chd, inf: SIM.inf }, addons: Object.entries(SIM.addons).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })), lodging: Object.entries(SIM.lodging).filter(([, s]) => s.hotelId).map(([legId, s]) => ({ legId, hotelId: s.hotelId, rooms: [{ type: s.type, qty: s.qty || 1 }] })), currency: SIM.cur, paymentMode: SIM.mode, paymentMethod: SIM.method, promoPct: SIM.promo, removed: SIM.removed, channel: 'Directo' };
  }

  /* ---- Plantillas por tipo de negocio ---- */
  function tplTab(body) {
    const std = defaults().map(r => r.id);
    body.innerHTML = UI.alert('info', 'Una plantilla activa el conjunto de reglas recomendado para el tipo de negocio y desactiva las demás reglas estándar. No cambia parámetros, excepciones por producto ni reglas personalizadas. Puede ajustar cada regla después.') +
      '<div class="grid g2" style="margin-top:14px">' + TEMPLATES.map(t => {
        const toOn = std.filter(id => t.on.includes(id) && !(BE.rule(id) || {}).enabled); const toOff = std.filter(id => !t.on.includes(id) && (BE.rule(id) || {}).enabled);
        const cur = DB.settings.ruleTemplateApplied && DB.settings.ruleTemplateApplied.id === t.id;
        return UI.card(esc(t.name) + (cur ? ' ' + bd('ok', 'Aplicada') : ''), '<div class="xr-tpl"><p class="small muted" style="margin:0">' + esc(t.desc) + '</p>' +
          '<div class="small"><b>' + t.on.length + '</b> reglas activas · <b>' + (std.length - t.on.length) + '</b> inactivas</div>' +
          (toOn.length || toOff.length ? '<div class="xs faint">Cambios respecto a la configuración actual:</div><div class="xr-diff">' + toOn.map(id => '<span class="badge b-ok" title="Se activa">+ ' + id + '</span>').join('') + toOff.map(id => '<span class="badge b-mute" title="Se desactiva">− ' + id + '</span>').join('') + '</div>' : '<div class="xs" style="color:var(--ok)">La configuración actual coincide con esta plantilla.</div>') +
          '<div class="grow"></div><div><button class="btn ' + (toOn.length || toOff.length ? 'primary' : '') + ' sm" data-tpl="' + t.id + '"' + dis(isAdmin(), 'admin.settings.manage') + (toOn.length || toOff.length ? '' : ' disabled') + '>' + ic('layers') + 'Aplicar plantilla</button></div></div>');
      }).join('') + '</div>';
    body.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => {
      const t = TEMPLATES.find(x => x.id === b.dataset.tpl); const chg = std.filter(id => (BE.rule(id) || {}).enabled !== t.on.includes(id));
      UI.confirm({ title: 'Aplicar plantilla «' + esc(t.name) + '»', confirmLabel: 'Aplicar ' + chg.length + ' cambios', message: 'Se modificará el estado de <b>' + chg.length + ' reglas</b>: ' + chg.map(id => '<span class="mono xs">' + id + (t.on.includes(id) ? ' → activa' : ' → inactiva') + '</span>').join(', ') + '. El cambio afecta de inmediato al sitio web, widget, cotizaciones y portales.',
        onConfirm: () => {
          if (!isAdmin()) { UI.toast('Requiere permiso admin.settings.manage.', 'bad'); return; }
          chg.forEach(id => { const r = BE.rule(id); const bf = r.enabled; r.enabled = t.on.includes(id); r.updatedAt = nowStr(); r.updatedBy = Auth.user.id; Audit.log('Regla de reserva', id, r.enabled ? 'activar' : 'desactivar', bf ? 'activa' : 'inactiva', (r.enabled ? 'activa' : 'inactiva') + ' · plantilla ' + t.name); });
          DB.settings.ruleTemplateApplied = { id: t.id, name: t.name, at: nowStr(), by: Auth.user.id };
          Audit.log('Regla de reserva', 'PLANTILLA', 'aplicar_plantilla', '', t.name + ' · ' + chg.length + ' cambios'); buildSchedule(false); Store.save();
          UI.toast('Plantilla «' + esc(t.name) + '» aplicada: ' + chg.length + ' reglas actualizadas.'); App.render();
        } });
    });
  }
  function histTab(body) {
    const rows = (DB.audit || []).filter(a => a.entity === 'Regla de reserva' || (a.entity === 'Producto' && /regla/.test(a.action)));
    UI.dataTable(body, { exportName: 'historial-reglas', rows, search: ['entityId', 'action', 'before', 'after', 'user'], searchPlaceholder: 'Buscar regla o usuario…', pageSize: 15, empty: 'Aún no hay cambios de reglas registrados.',
      filters: [{ label: 'Acción', options: [['activar', 'Activar'], ['desactivar', 'Desactivar'], ['editar_parametros', 'Editar parámetros'], ['aplicar_plantilla', 'Plantilla'], ['restablecer', 'Restablecer'], ['excepcion_regla', 'Excepción por producto']], match: (r, v) => r.action === v }],
      columns: [{ key: 'ts', label: 'Fecha', render: r => datetime(r.ts) }, { key: 'user', label: 'Usuario', render: r => esc(Q.userName(r.user)) }, { key: 'entityId', label: 'Regla / producto', render: r => '<span class="mono small">' + esc(r.entityId) + '</span>' }, { key: 'action', label: 'Acción', render: r => '<span class="tag">' + esc(r.action) + '</span>' }, { key: 'before', label: 'Antes', render: r => '<span class="xs muted">' + esc(String(r.before).slice(0, 90)) + '</span>' }, { key: 'after', label: 'Después', render: r => '<span class="xs">' + esc(String(r.after).slice(0, 110)) + '</span>' }, { key: 'ip', label: 'IP', render: r => '<span class="xs faint mono">' + esc(r.ip) + '</span>' }] });
  }

  /* ======================================================================
     2) MENSAJES AL PASAJERO  ·  #/admin/comunicaciones
     ====================================================================== */
  const MS = { tab: 'plantillas' };
  const canSend = () => isAdmin() || can('operations.assign');
  const chIcons = (list) => list.map(c => '<span class="tag" title="' + CH[c][0] + '">' + ic(CH[c][1]).replace('<svg', '<svg width="12" height="12"') + ' ' + CH[c][0] + '</span>').join(' ');
  const fmtOffset = (t) => { const h = tplOffset(t); if (t.event === 'cambio_horario') return 'Al ocurrir el evento'; if (!h) return 'Al ocurrir'; const a = Math.abs(h); const s = a % 24 === 0 ? (a / 24) + ' día' + (a / 24 > 1 ? 's' : '') : a + ' h'; return s + (h < 0 ? ' antes' : ' después'); };

  App.register('admin/comunicaciones', (el) => {
    seed();
    const ruleOn = BE.on('R-PAX-MESSAGES'); const msgs = DB.paxMessages; const now = nowStr();
    const prog = msgs.filter(m => m.status === 'programado'); const next48 = prog.filter(m => m.scheduledAt <= addHours(now, 48));
    const sent = msgs.filter(m => ['enviado', 'entregado', 'leido', 'fallido'].includes(m.status)); const fail = msgs.filter(m => m.status === 'fallido');
    const readRate = sent.length ? Math.round(msgs.filter(m => m.status === 'leido').length / sent.length * 100) : 0;
    el.innerHTML = '<div class="page">' + UI.pageHeader({
      title: 'Mensajes al pasajero', crumbs: [['Administración'], ['Mensajes al pasajero']],
      subtitle: 'Plantillas por evento del viaje, programación calculada por reserva, envíos manuales e historial de entrega por canal (email, WhatsApp, portal y push).',
      actions: '<button class="btn" id="xm-manual"' + dis(canSend(), 'operations.assign') + '>' + ic('send') + 'Envío manual</button><button class="btn primary" id="xm-newt"' + dis(isAdmin(), 'admin.settings.manage') + '>' + ic('plus') + 'Nueva plantilla</button>'
    }) +
      (ruleOn ? '' : UI.alert('warn', '<b>R-PAX-MESSAGES está desactivada.</b> No se programan mensajes automáticos y los pendientes se retiraron de la cola. Los envíos manuales siguen disponibles.' + (isAdmin() ? ' <a href="#/admin/reglas">Activar en el centro de reglas</a>.' : ''))) +
      (!isAdmin() ? UI.alert('info', 'Con su rol puede enviar mensajes manuales, reintentar fallidos y consultar el historial. La edición de plantillas es exclusiva del Tenant Admin (admin.settings.manage).') : '') +
      '<div class="grid g4">' + UI.kpi({ label: 'Plantillas activas', value: DB.paxMessageTemplates.filter(t => t.active).length + ' / ' + DB.paxMessageTemplates.length, icon: 'mail' }) + UI.kpi({ label: 'Programados', value: prog.length, sub: next48.length + ' en las próximas 48 h', icon: 'clock', tone: 'info' }) + UI.kpi({ label: 'Tasa de lectura', value: readRate + ' %', sub: sent.length + ' enviados', icon: 'eye', tone: 'ok' }) + UI.kpi({ label: 'Fallidos', value: fail.length, sub: fail.length ? 'Requieren reintento' : 'Sin fallos', icon: 'alert', tone: fail.length ? 'bad' : 'ok' }) + '</div>' +
      '<div id="xm-tabs" style="margin-top:16px"></div></div>';
    UI.tabs(el.querySelector('#xm-tabs'), [
      { id: 'plantillas', label: 'Plantillas', count: DB.paxMessageTemplates.length, render: tplListTab },
      { id: 'programacion', label: 'Próximos envíos', count: prog.length, render: progTab },
      { id: 'historial', label: 'Historial', count: sent.length, render: msgHistTab }
    ], MS.tab, { onChange: (id) => { MS.tab = id; } });
    el.querySelector('#xm-manual').onclick = () => manualSend();
    el.querySelector('#xm-newt').onclick = () => editTemplate(null);
  });

  function tplListTab(body) {
    UI.dataTable(body, { exportName: 'plantillas-pasajero', rows: () => DB.paxMessageTemplates, search: ['name', 'subject', 'body', 'event'], pageSize: 12, searchPlaceholder: 'Buscar plantilla…',
      filters: [{ label: 'Evento', options: Object.entries(EVENTS).map(([k, v]) => [k, v.split(' (')[0]]), match: (r, v) => r.event === v }, { label: 'Idioma', options: [['ES', 'Español'], ['EN', 'Inglés']], match: (r, v) => r.lang === v }],
      onRow: (t) => isAdmin() ? editTemplate(t) : previewTemplate(t),
      columns: [
        { key: 'name', label: 'Plantilla', render: t => '<b class="small">' + esc(t.name) + '</b><div class="xs faint mono">' + t.id + '</div>' },
        { key: 'event', label: 'Evento y desfase', render: t => '<span class="small">' + esc(EVENTS[t.event].split(' (')[0]) + '</span><div class="xs faint">' + esc(fmtOffset(t)) + (t.offsetFromRule ? ' · R-REVIEW-INVITE' : '') + '</div>' },
        { key: 'channels', label: 'Canales', sort: false, render: t => chIcons(t.channels) },
        { key: 'lang', label: 'Idioma', render: t => '<span class="tag">' + t.lang + '</span>' },
        { key: 'cond', label: 'Condiciones', sort: false, render: t => { const c = t.conditions || {}; const a = []; if (c.requiresRule) a.push('<span class="tag mono" title="Solo si la regla está activa">' + c.requiresRule + (BE.on(c.requiresRule) ? '' : ' (inactiva)') + '</span>'); if (c.products && c.products.length) a.push('<span class="tag">' + c.products.length + ' producto(s)</span>'); if (c.channels && c.channels.length) a.push('<span class="tag">' + esc(c.channels.join(', ')) + '</span>'); if (c.onlyIfBalance) a.push('<span class="tag">Con saldo</span>'); if (c.onlyIfMissingDocs) a.push('<span class="tag">Faltan datos</span>'); return a.join(' ') || '<span class="xs faint">Todas las reservas</span>'; } },
        { key: 'active', label: 'Activa', render: t => '<label class="switch"><input type="checkbox" data-tact="' + t.id + '"' + (t.active ? ' checked' : '') + (isAdmin() ? '' : ' disabled title="Requiere permiso admin.settings.manage"') + '></label>' },
        { key: 'x', label: '', sort: false, render: t => '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-tprev="' + t.id + '">' + ic('eye') + 'Vista previa</button><button class="btn xs" data-ttest="' + t.id + '"' + dis(isAdmin(), 'admin.settings.manage') + '>' + ic('send') + 'Prueba</button></span>' }
      ],
      afterDraw: (c) => {
        c.querySelectorAll('[data-tact]').forEach(i => i.onchange = () => { const t = DB.paxMessageTemplates.find(x => x.id === i.dataset.tact); if (!isAdmin()) { i.checked = !i.checked; return; } t.active = i.checked; t.updatedAt = nowStr(); t.updatedBy = Auth.user.id; Audit.log('Plantilla de mensaje', t.id, t.active ? 'activar' : 'desactivar', '', t.name); const r = buildSchedule(false); Store.save(); UI.toast('Plantilla ' + (t.active ? 'activada' : 'desactivada') + '. Programación recalculada (' + r.added + ' envíos programados).'); });
        c.querySelectorAll('[data-tprev]').forEach(b => b.onclick = () => previewTemplate(DB.paxMessageTemplates.find(x => x.id === b.dataset.tprev)));
        c.querySelectorAll('[data-ttest]').forEach(b => b.onclick = () => testSend(DB.paxMessageTemplates.find(x => x.id === b.dataset.ttest)));
      } });
  }
  const sampleRes = () => (DB.reservations.find(r => r.id === 'RES-2026-000347') || liveRes()[0] || DB.reservations[0]);
  function renderMsg(channel, subject, bodyTxt) {
    if (channel === 'email') return '<div class="xm-mail"><div class="xm-mail-h"><div><b>De:</b> Andes Horizonte Travel &lt;viajes@andeshorizonte.pe&gt;</div><div><b>Asunto:</b> ' + esc(subject) + '</div></div><div class="xm-mail-b">' + esc(bodyTxt) + '</div></div>';
    if (channel === 'whatsapp') return '<div class="xs faint" style="margin-bottom:6px">WhatsApp Business · plantilla aprobada por Meta</div><div class="xm-bubble">' + esc(bodyTxt) + '</div>';
    if (channel === 'push') return '<div class="card" style="max-width:380px"><div class="card-b"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="ico-box">' + ic('bell') + '</div><div style="min-width:0"><b class="small">' + esc(subject) + '</b><div class="xs muted">' + esc(bodyTxt.replace(/\s+/g, ' ').slice(0, 140)) + (bodyTxt.length > 140 ? '…' : '') + '</div></div></div></div></div>';
    return '<div class="card"><div class="card-h"><div class="t">' + esc(subject) + '</div></div><div class="card-b small" style="white-space:pre-wrap">' + esc(bodyTxt) + '</div></div>';
  }
  function previewTemplate(t, draft) {
    t = draft || t; let resId = sampleRes().id; let chn = t.channels[0] || 'email';
    const draw = (m) => {
      const r = Q.reservation(resId); const v = varsFor(r); const blk = tplBlock(Object.assign({}, t, { active: true }), r);
      m.querySelector('#pv-out').innerHTML = (blk ? UI.alert('warn', 'Con esta reserva la plantilla <b>no se enviaría</b>: ' + esc(blk) + '.') : '') + '<div class="tabs pills" style="margin:10px 0">' + t.channels.map(c => '<button class="tab' + (c === chn ? ' on' : '') + '" data-pch="' + c + '">' + CH[c][0] + '</button>').join('') + '</div>' + renderMsg(chn, fill(t.subject, v), fill(t.body, v)) +
        '<div class="xs faint" style="margin-top:10px">Destinatario: ' + esc(toFor(r, chn)) + ' · Idioma de la reserva: ' + resLang(r) + (eventBase(r, t.event) ? ' · Se enviaría el ' + datetime(addHours(eventBase(r, t.event), tplOffset(t))) : '') + '</div>';
      m.querySelectorAll('[data-pch]').forEach(b => b.onclick = () => { chn = b.dataset.pch; draw(m); });
    };
    UI.modal({ title: 'Vista previa · ' + esc(t.name), size: 'lg', sub: 'Variables reemplazadas con datos reales de la reserva seleccionada.',
      body: '<div class="field"><label for="pv-r">Reserva</label><select class="input" id="pv-r">' + DB.reservations.map(r => '<option value="' + r.id + '"' + (r.id === resId ? ' selected' : '') + '>' + r.id + ' · ' + esc(r.title) + ' (' + esc(resLead(r).name || '') + ')</option>').join('') + '</select></div><div id="pv-out"></div>',
      actions: [{ label: 'Cerrar' }], onOpen: (m) => { m.querySelector('#pv-r').onchange = (e) => { resId = e.target.value; draw(m); }; draw(m); } });
  }
  function testSend(t) {
    if (!isAdmin()) { UI.toast('Requiere permiso admin.settings.manage.', 'bad'); return; }
    const u = Auth.user; const r = sampleRes(); const v = varsFor(r);
    UI.modal({ title: 'Envío de prueba', size: 'sm', body: '<p class="small">Se enviará «' + esc(t.name) + '» con los datos de <b>' + r.id + '</b> a sus propios datos de contacto:</p>' + UI.form([{ id: 'ts-e', label: 'Email', col: 12, value: u.email }, { id: 'ts-w', label: 'WhatsApp', col: 12, value: '+51 ' + (u.phone || '') }]),
      actions: [{ label: 'Cancelar' }, { label: 'Enviar prueba', cls: 'primary', icon: 'send', onClick: (m) => {
        const f = UI.formData(m); t.channels.forEach(c => { const to = c === 'email' ? f['ts-e'] : c === 'whatsapp' ? f['ts-w'] : c === 'portal' ? 'Portal (vista de prueba)' : 'Push · ' + u.name; DB.paxMessages.unshift({ id: msgId(), resId: null, templateId: t.id, channel: c, to, subject: '[PRUEBA] ' + fill(t.subject, v), body: fill(t.body, v), status: 'enviado', scheduledAt: nowStr(), sentAt: nowStr(), readAt: null, direction: 'saliente', test: true, by: u.id, attempts: 1 }); Notify.push('pasajero.mensaje.prueba', CH[c][0], to, '[PRUEBA] ' + fill(t.subject, v)); });
        Audit.log('Plantilla de mensaje', t.id, 'envio_prueba', '', t.channels.join(', ')); Store.save(); UI.toast('Prueba enviada por ' + t.channels.map(c => CH[c][0]).join(', ') + '.');
      } }] });
  }
  function editTemplate(t0) {
    if (!isAdmin()) { UI.toast('Solo el Tenant Admin edita plantillas (admin.settings.manage).', 'bad'); return; }
    const isNew = !t0; const t = t0 ? clone(t0) : { id: nextId(DB.paxMessageTemplates, 'PMT-', 3), name: '', event: 'viaje', offsetHours: -24, channels: ['email'], subject: '', body: '', lang: 'ES', active: true, conditions: { products: [], channels: [], requiresRule: null, onlyIfBalance: false, onlyIfMissingDocs: false } };
    const c = t.conditions || (t.conditions = {}); const prods = DB.products.filter(p => p.status === 'ACTIVE');
    const ruleOpts = [['', 'Ninguna']].concat(BE.rules().filter(r => ['Comunicación', 'Pasajeros', 'Monedas y pagos', 'Checkout'].includes(r.group)).map(r => [r.id, r.id + ' · ' + r.name]));
    const body = UI.form([
      { id: 'et-n', label: 'Nombre', required: true, col: 8, value: t.name }, { id: 'et-l', label: 'Idioma', type: 'select', col: 4, value: t.lang, options: [['ES', 'Español'], ['EN', 'Inglés']] },
      { id: 'et-e', label: 'Evento', type: 'select', col: 8, value: t.event, options: Object.entries(EVENTS) }, { id: 'et-o', label: 'Desfase (horas; negativo = antes)', type: 'number', col: 4, value: t.offsetHours, min: -720, max: 720, disabled: !!t.offsetFromRule, hint: t.offsetFromRule ? 'Toma daysAfter de R-REVIEW-INVITE' : '' },
      { type: 'html', col: 12, html: '<label class="xs faint" style="font-weight:600">Canales</label><div class="xm-checks" style="margin-top:6px">' + Object.keys(CH).map(k => '<label class="check"><input type="checkbox" data-ech="' + k + '"' + (t.channels.includes(k) ? ' checked' : '') + '> ' + CH[k][0] + '</label>').join('') + '</div>' },
      { id: 'et-s', label: 'Asunto (email, push y portal)', col: 12, value: t.subject },
      { type: 'html', col: 12, html: '<label class="xs faint" style="font-weight:600">Variables (clic para insertar en el cuerpo)</label><div class="xm-vars">' + VARS.map(v => '<button type="button" class="btn xs" data-var="' + v[0] + '" title="' + esc(v[1]) + '">{{' + v[0] + '}}</button>').join('') + '</div>' },
      { id: 'et-b', label: 'Cuerpo', type: 'textarea', rows: 7, required: true, col: 12, value: t.body, hint: 'WhatsApp: máximo 1 024 caracteres; la plantilla debe estar aprobada por Meta antes de usarla fuera de la ventana de 24 h.' },
      { type: 'section', label: 'Condiciones' },
      { id: 'et-r', label: 'Solo si la regla está activa', type: 'select', col: 6, value: c.requiresRule || '', options: ruleOpts },
      { type: 'html', col: 6, html: '<label class="xs faint" style="font-weight:600">Canal de venta (vacío = todos)</label><div class="xm-checks" style="margin-top:6px">' + SALES_CH.map(s => '<label class="check"><input type="checkbox" data-esc="' + s + '"' + ((c.channels || []).includes(s) ? ' checked' : '') + '> ' + s + '</label>').join('') + '</div>' },
      { id: 'et-bal', label: 'Solo reservas con saldo pendiente', type: 'switch', col: 6, value: c.onlyIfBalance }, { id: 'et-doc', label: 'Solo si faltan datos de acompañantes', type: 'switch', col: 6, value: c.onlyIfMissingDocs },
      { type: 'html', col: 12, html: '<label class="xs faint" style="font-weight:600">Productos (vacío = todos)</label><div class="xm-scroll xm-checks" style="margin-top:6px">' + prods.map(p => '<label class="check"><input type="checkbox" data-epr="' + p.id + '"' + ((c.products || []).includes(p.id) ? ' checked' : '') + '> ' + esc(p.id + ' · ' + p.name) + '</label>').join('') + '</div>' },
      { id: 'et-a', label: 'Plantilla activa', type: 'switch', col: 12, value: t.active }
    ]);
    const read = (d) => { const f = UI.formData(d.querySelector('.drawer-b')); return Object.assign({}, t, { name: f['et-n'], lang: f['et-l'], event: f['et-e'], offsetHours: t.offsetFromRule ? t.offsetHours : (+f['et-o'] || 0), subject: f['et-s'], body: d.querySelector('#et-b').value, active: f['et-a'], channels: Array.from(d.querySelectorAll('[data-ech]:checked')).map(i => i.dataset.ech), conditions: { requiresRule: f['et-r'] || null, channels: Array.from(d.querySelectorAll('[data-esc]:checked')).map(i => i.dataset.esc), products: Array.from(d.querySelectorAll('[data-epr]:checked')).map(i => i.dataset.epr), onlyIfBalance: f['et-bal'], onlyIfMissingDocs: f['et-doc'] } }); };
    const hasHist = !isNew && DB.paxMessages.some(m => m.templateId === t.id && m.status !== 'programado');
    UI.drawer({ title: isNew ? 'Nueva plantilla' : 'Editar plantilla · ' + esc(t.id), wide: true, body,
      actions: [{ label: 'Vista previa', icon: 'eye', close: false, onClick: (d) => { previewTemplate(null, read(d)); return false; } }].concat(isNew ? [] : [{ label: 'Duplicar en ' + (t.lang === 'ES' ? 'inglés' : 'español'), icon: 'copy', close: false, onClick: () => { const n = clone(t0); n.id = nextId(DB.paxMessageTemplates, 'PMT-', 3); n.lang = t0.lang === 'ES' ? 'EN' : 'ES'; n.group = t0.group || t0.id; t0.group = t0.group || t0.id; n.name = t0.name + ' (' + n.lang + ')'; n.active = false; DB.paxMessageTemplates.push(n); Audit.log('Plantilla de mensaje', n.id, 'duplicar', t0.id, n.lang); Store.save(); UI.closeDrawer(); UI.toast('Versión ' + n.lang + ' creada (inactiva). Traduzca el texto y actívela.'); editTemplate(n); return false; } }, { label: 'Eliminar', cls: 'danger', icon: 'trash', close: false, onClick: () => { if (hasHist) { UI.toast('La plantilla tiene envíos en el historial: desactívela en lugar de eliminarla.', 'bad'); return false; } UI.confirm({ title: 'Eliminar plantilla', danger: true, confirmLabel: 'Eliminar', message: '¿Eliminar «' + esc(t0.name) + '»?', onConfirm: () => { DB.paxMessageTemplates = DB.paxMessageTemplates.filter(x => x.id !== t0.id); DB.paxMessages = DB.paxMessages.filter(m => !(m.templateId === t0.id && m.status === 'programado')); Audit.log('Plantilla de mensaje', t0.id, 'eliminar', t0.name, ''); Store.save(); UI.closeDrawer(); UI.toast('Plantilla eliminada.'); App.render(); } }); return false; } }]).concat([
        { label: 'Guardar', cls: 'primary', icon: 'check', onClick: (d) => {
          if (!UI.validate(d.querySelector('.drawer-b'))) return false; const n = read(d); const errs = [];
          if (!n.channels.length) errs.push('Seleccione al menos un canal.');
          if (n.channels.some(x => x !== 'whatsapp') && !n.subject) errs.push('El asunto es obligatorio para email, push y portal.');
          const uv = unknownVars(n.subject + ' ' + n.body); if (uv.length) errs.push('Variables desconocidas: ' + Array.from(new Set(uv)).map(x => '{{' + x + '}}').join(', ') + '.');
          if (n.channels.includes('whatsapp') && n.body.length > 1024) errs.push('El cuerpo supera 1 024 caracteres (límite de WhatsApp).');
          if (Math.abs(n.offsetHours) > 720) errs.push('El desfase debe estar entre −720 y 720 horas.');
          if (errs.length) { UI.toast(errs.join(' '), 'bad'); return false; }
          n.updatedAt = nowStr(); n.updatedBy = Auth.user.id;
          if (isNew) DB.paxMessageTemplates.push(n); else Object.assign(t0, n);
          Audit.log('Plantilla de mensaje', n.id, isNew ? 'crear' : 'editar', isNew ? '' : t0.name, n.name + ' · ' + n.event + ' ' + n.offsetHours + ' h · ' + n.channels.join('/'));
          const r = buildSchedule(false); Store.save(); UI.toast('Plantilla guardada.' + (BE.on('R-PAX-MESSAGES') ? ' Programación recalculada: ' + r.added + ' envíos programados.' : ' R-PAX-MESSAGES inactiva: no se programó ningún envío.')); App.render();
        } }]),
      onOpen: (d) => { const ta = d.querySelector('#et-b'); d.querySelectorAll('[data-var]').forEach(b => b.onclick = () => { const v = '{{' + b.dataset.var + '}}'; const s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + v + ta.value.slice(ta.selectionEnd || s); ta.focus(); ta.selectionStart = ta.selectionEnd = s + v.length; }); } });
  }
  function progTab(body) {
    const ruleOn = BE.on('R-PAX-MESSAGES');
    body.innerHTML = (ruleOn ? '' : UI.alert('warn', 'R-PAX-MESSAGES inactiva: no hay programación automática. Solo se listan envíos manuales diferidos.')) + '<div id="xm-pt"></div>';
    UI.dataTable(body.querySelector('#xm-pt'), { exportName: 'mensajes-programados', rows: () => DB.paxMessages.filter(m => m.status === 'programado').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), search: ['resId', 'to', 'subject'], pageSize: 12, empty: ruleOn ? 'No hay envíos programados.' : 'Sin programación: la regla R-PAX-MESSAGES está desactivada.',
      toolbar: '<button class="btn sm" id="xm-recalc"' + (ruleOn ? dis(canSend(), 'operations.assign') : ' disabled title="R-PAX-MESSAGES inactiva"') + '>' + ic('refresh') + 'Recalcular programación</button>',
      filters: [{ label: 'Canal', options: Object.keys(CH).map(k => [k, CH[k][0]]), match: (r, v) => r.channel === v }, { label: 'Plantilla', options: DB.paxMessageTemplates.map(t => [t.id, t.name]), match: (r, v) => r.templateId === v }],
      columns: [
        { key: 'scheduledAt', label: 'Programado para', render: m => '<b class="small">' + datetime(m.scheduledAt) + '</b>' },
        { key: 'resId', label: 'Reserva', render: m => '<a href="#/reservas/' + esc(m.resId) + '" class="mono small">' + esc(m.resId) + '</a>' },
        { key: 'to', label: 'Destinatario', render: m => '<span class="small">' + esc(m.to) + '</span>' },
        { key: 'templateId', label: 'Plantilla', render: m => '<span class="small">' + esc((DB.paxMessageTemplates.find(t => t.id === m.templateId) || { name: 'Mensaje libre' }).name) + '</span>' },
        { key: 'channel', label: 'Canal', render: m => chIcons([m.channel]) },
        { key: 'status', label: 'Estado', render: m => msgBadge(m.status) },
        { key: 'x', label: '', sort: false, render: m => '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-now="' + m.id + '"' + dis(canSend(), 'operations.assign') + '>' + ic('send') + 'Enviar ahora</button><button class="btn xs ghost" data-cancel="' + m.id + '"' + dis(canSend(), 'operations.assign') + '>' + ic('x') + '</button></span>' }
      ],
      onRow: (m) => msgDrawer(m),
      afterDraw: (c) => {
        c.querySelectorAll('[data-now]').forEach(b => b.onclick = () => { const m = DB.paxMessages.find(x => x.id === b.dataset.now); sendMsg(m); UI.toast('Mensaje enviado por ' + CH[m.channel][0] + '.'); App.render(); });
        c.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { const m = DB.paxMessages.find(x => x.id === b.dataset.cancel); UI.confirm({ title: 'Cancelar envío programado', message: 'Se cancelará el envío a ' + esc(m.to) + ' (' + esc(m.subject) + ').', confirmLabel: 'Cancelar envío', danger: true, onConfirm: () => { m.status = 'cancelado'; m.cancelledBy = Auth.user.id; m.cancelledAt = nowStr(); Audit.log('Mensaje al pasajero', m.id, 'cancelar', 'programado', 'cancelado'); Store.save(); UI.toast('Envío cancelado.'); App.render(); } }); });
        const rc = c.querySelector('#xm-recalc'); if (rc) rc.onclick = () => { const r = buildSchedule(false); Audit.log('Mensaje al pasajero', 'PROGRAMACION', 'recalcular', r.removed + ' retirados', r.added + ' programados'); Store.save(); UI.toast('Programación recalculada: ' + r.added + ' envíos programados.'); App.render(); };
      } });
  }
  function sendMsg(m) {
    if (!canSend()) { UI.toast('Requiere permiso operations.assign.', 'bad'); return; }
    const bf = m.status; m.status = 'enviado'; m.sentAt = nowStr(); m.attempts = (m.attempts || 0) + 1; m.error = null; m.by = Auth.user.id;
    Notify.push('pasajero.mensaje', CH[m.channel][0], m.to, m.subject); Audit.log('Mensaje al pasajero', m.id, bf === 'fallido' ? 'reintentar' : 'enviar', bf, 'enviado · ' + m.channel); Store.save();
  }
  function msgHistTab(body) {
    UI.dataTable(body, { exportName: 'historial-mensajes', rows: () => DB.paxMessages.filter(m => !['programado'].includes(m.status)).sort((a, b) => String(b.sentAt || b.scheduledAt).localeCompare(String(a.sentAt || a.scheduledAt))), search: ['resId', 'to', 'subject', 'id'], pageSize: 14,
      toolbar: '<button class="btn sm" id="xm-sync"' + dis(canSend(), 'operations.assign') + ' title="Consulta los acuses de entrega y lectura de cada proveedor (demo)">' + ic('sync') + 'Actualizar estados</button>',
      filters: [{ label: 'Estado', options: ['enviado', 'entregado', 'leido', 'fallido', 'cancelado'].map(s => [s, MSG_ST[s][1]]), match: (r, v) => r.status === v }, { label: 'Canal', options: Object.keys(CH).map(k => [k, CH[k][0]]), match: (r, v) => r.channel === v }, { label: 'Origen', options: [['auto', 'Automático'], ['manual', 'Manual'], ['test', 'Prueba']], match: (r, v) => v === 'auto' ? r.auto && !r.manual : v === 'manual' ? r.manual : r.test }],
      columns: [
        { key: 'sentAt', label: 'Fecha', render: m => '<span class="small">' + datetime(m.sentAt || m.scheduledAt) + '</span>' },
        { key: 'resId', label: 'Reserva', render: m => m.resId ? '<span class="mono small">' + esc(m.resId) + '</span>' : bd('info', 'Prueba') },
        { key: 'to', label: 'Destinatario', render: m => '<span class="small">' + esc(m.to) + '</span>' },
        { key: 'subject', label: 'Asunto', render: m => '<span class="small">' + esc(String(m.subject).slice(0, 60)) + '</span>' + (m.manual ? ' <span class="tag">Manual</span>' : '') },
        { key: 'channel', label: 'Canal', render: m => chIcons([m.channel]) },
        { key: 'status', label: 'Estado', render: m => msgBadge(m.status) + (m.readAt ? '<div class="xs faint">' + datetime(m.readAt) + '</div>' : '') },
        { key: 'x', label: '', sort: false, render: m => m.status === 'fallido' ? '<button class="btn xs" data-retry="' + m.id + '"' + dis(canSend(), 'operations.assign') + '>' + ic('refresh') + 'Reintentar</button>' : '' }
      ],
      onRow: (m) => msgDrawer(m),
      afterDraw: (c) => {
        c.querySelectorAll('[data-retry]').forEach(b => b.onclick = () => { const m = DB.paxMessages.find(x => x.id === b.dataset.retry); sendMsg(m); UI.toast('Reintento enviado (intento ' + m.attempts + ').'); App.render(); });
        const sy = c.querySelector('#xm-sync'); if (sy) sy.onclick = () => { let n = 0; DB.paxMessages.forEach(m => { if (m.status === 'entregado') { m.status = 'leido'; m.readAt = nowStr(); n++; } else if (m.status === 'enviado') { m.status = m.channel === 'portal' ? 'leido' : 'entregado'; if (m.status === 'leido') m.readAt = nowStr(); n++; } }); Audit.log('Mensaje al pasajero', 'ACUSES', 'sincronizar_estados', '', n + ' actualizados'); Store.save(); UI.toast(n + ' estado(s) actualizados con los acuses del proveedor.'); App.render(); };
      } });
  }
  function msgDrawer(m) {
    const t = DB.paxMessageTemplates.find(x => x.id === m.templateId);
    const tl = [{ title: 'Programado', meta: datetime(m.scheduledAt), icon: 'clock' }];
    if (m.sentAt) tl.push({ title: 'Enviado' + (m.attempts > 1 ? ' (intento ' + m.attempts + ')' : ''), meta: datetime(m.sentAt) + (m.by ? ' · ' + esc(Q.userName(m.by)) : ' · Sistema'), icon: 'send' });
    if (['entregado', 'leido'].includes(m.status)) tl.push({ title: 'Entregado', meta: 'Acuse del proveedor', icon: 'check' });
    if (m.readAt) tl.push({ title: 'Leído', meta: datetime(m.readAt), icon: 'eye' });
    if (m.status === 'fallido') tl.push({ title: 'Fallido', meta: esc(m.error || 'Error del proveedor'), icon: 'alert' });
    if (m.status === 'cancelado') tl.push({ title: 'Cancelado', meta: datetime(m.cancelledAt) + ' · ' + esc(Q.userName(m.cancelledBy)), icon: 'x' });
    UI.drawer({ title: 'Mensaje ' + esc(m.id), sub: (t ? esc(t.name) : 'Mensaje libre') + ' · ' + CH[m.channel][0], body: UI.dl([['Reserva', m.resId ? '<a href="#/reservas/' + esc(m.resId) + '">' + esc(m.resId) + '</a>' : 'Envío de prueba'], ['Destinatario', esc(m.to)], ['Estado', msgBadge(m.status)], ['Idioma', m.lang || 'ES'], ['Dirección', 'Saliente']]) + '<div class="section-title" style="margin:14px 0 10px">Contenido</div>' + renderMsg(m.channel, m.subject, m.body) + '<div class="section-title" style="margin:14px 0 10px">Trazabilidad</div>' + UI.timeline(tl),
      actions: m.status === 'fallido' && canSend() ? [{ label: 'Reintentar', cls: 'primary', icon: 'refresh', onClick: () => { sendMsg(m); UI.toast('Reintento enviado.'); App.render(); } }] : [] });
  }
  function manualSend(resId) {
    if (!canSend()) { UI.toast('Requiere permiso operations.assign.', 'bad'); return; }
    const res = liveRes(); let rid = resId || (res[0] || {}).id; let tid = 'PMT-007'; const tpls = DB.paxMessageTemplates;
    const draw = (m) => {
      const r = Q.reservation(rid); const t = tpls.find(x => x.id === tid); const v = varsFor(r);
      const chSel = m.querySelector('#ms-c').value || 'whatsapp';
      if (t) { m.querySelector('#ms-s').value = fill(t.subject, v); m.querySelector('#ms-b').value = fill(t.body, v); }
      m.querySelector('#ms-to').textContent = toFor(r, chSel);
    };
    UI.modal({ title: 'Envío manual al pasajero', size: 'lg', sub: 'Se registra en el historial con su usuario. Útil para cambios de horario, incidencias o recordatorios puntuales.',
      body: UI.form([
        { id: 'ms-r', label: 'Reserva', type: 'select', col: 12, value: rid, options: res.map(r => [r.id, r.id + ' · ' + r.title + ' · ' + (resLead(r).name || '')]) },
        { id: 'ms-t', label: 'Plantilla', type: 'select', col: 6, value: tid, options: [['', 'Mensaje libre']].concat(tpls.map(t => [t.id, t.name + ' (' + t.lang + ')'])) },
        { id: 'ms-c', label: 'Canal', type: 'select', col: 6, value: 'whatsapp', options: Object.keys(CH).map(k => [k, CH[k][0]]) },
        { type: 'html', col: 12, html: '<div class="xs faint">Destinatario: <b id="ms-to"></b></div>' },
        { id: 'ms-s', label: 'Asunto', col: 12 }, { id: 'ms-b', label: 'Mensaje', type: 'textarea', rows: 6, required: true, col: 12 }
      ]),
      onOpen: (m) => { m.querySelector('#ms-r').onchange = (e) => { rid = e.target.value; draw(m); }; m.querySelector('#ms-t').onchange = (e) => { tid = e.target.value; draw(m); }; m.querySelector('#ms-c').onchange = () => draw(m); draw(m); },
      actions: [{ label: 'Cancelar' }, { label: 'Enviar ahora', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const r = Q.reservation(f['ms-r']);
        if (f['ms-c'] !== 'whatsapp' && !f['ms-s']) { UI.toast('Indique el asunto.', 'bad'); return false; }
        if (f['ms-c'] === 'whatsapp' && f['ms-b'].length > 1024) { UI.toast('El mensaje supera 1 024 caracteres (límite de WhatsApp).', 'bad'); return false; }
        const msg = { id: msgId(), resId: r.id, templateId: f['ms-t'] || null, channel: f['ms-c'], to: toFor(r, f['ms-c']), subject: f['ms-s'] || '(WhatsApp)', body: f['ms-b'], status: 'programado', scheduledAt: nowStr(), sentAt: null, readAt: null, direction: 'saliente', manual: true, lang: resLang(r), attempts: 0 };
        DB.paxMessages.unshift(msg); sendMsg(msg); UI.toast('Mensaje enviado a ' + esc(msg.to) + '.'); App.render();
      } }] });
  }

  /* ======================================================================
     3) MONEDAS  ·  #/admin/monedas
     ====================================================================== */
  /* v2.2 · Tipos de cambio DEMO: proveedores (fxProviders), proveedor activo (rateProvider), historial de 30 días
     por moneda (rateHistory{CODE:[{date, rate, source}]}), actualización simulada y alerta por variación diaria. */
  const FXS = { code: 'USD' };
  const fxThr = () => { const v = +BE.cfg().fxAlertPct; return v > 0 ? v : 3; };
  const fxHist = (code) => ((BE.cfg().rateHistory || {})[code]) || [];
  const fxDec = (rate) => rate < 0.1 ? 6 : 4;
  function fxDayVar(code) { const h = fxHist(code); if (h.length < 2) return null; const a = h[h.length - 2].rate, b = h[h.length - 1].rate; return a ? (b - a) / a * 100 : null; }
  const fxVarTxt = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + fmtN(v, 2) + ' %';
  const fxProv = (id) => (BE.cfg().fxProviders || []).find(p => p.id === id) || null;
  const FXP_ST = { activo: ['ok', 'Activo'], por_validar: ['warn', 'Por validar'], inactivo: ['mute', 'Inactivo'], error: ['bad', 'Error'] };
  /* Registra el valor del día en el historial (reemplaza el del día si ya existe; conserva 30 días) */
  function fxPushDay(code, rate, source) {
    const e = BE.cfg(); const H = e.rateHistory || (e.rateHistory = {}); const h = H[code] || (H[code] = []); const last = h[h.length - 1];
    const day = last && last.date >= T() ? last.date : T();
    if (last && last.date === day) { last.rate = rate; last.source = source; last.updatedAt = nowStr(); } else { h.push({ date: day, rate, source }); while (h.length > 30) h.shift(); }
  }
  function niceMaxL(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  /* UI.chart.line parte de 0: se grafica (tc − base) × escala y luego se reescriben las etiquetas del eje Y con el TC real */
  function fxChart(code) {
    const h = fxHist(code); if (h.length < 2) return UI.empty('Sin historial para ' + code + '.', 'chart');
    const vals = h.map(x => x.rate); const lo = Math.min(...vals), hi = Math.max(...vals); const span = (hi - lo) || lo * 0.01; const base = lo - span * 0.3;
    const scale = 1000 / ((hi - base) || 1); const dec = fxDec(lo);
    const html = UI.chart.line({ labels: h.map(x => x.date.slice(8, 10) + '/' + x.date.slice(5, 7)), series: [{ name: code + ' · S/ por unidad', values: vals.map(v => (v - base) * scale) }], height: 210, fmt: (v) => fmtN(v / scale + base, dec) });
    return '<div class="xf-chart" data-base="' + base + '" data-scale="' + scale + '" data-dec="' + dec + '" data-max="' + Math.max(...vals.map(v => (v - base) * scale)) + '">' + html + '</div>';
  }
  function fxFixChart(root) {
    root.querySelectorAll('.xf-chart').forEach(c => {
      const base = +c.dataset.base, scale = +c.dataset.scale, dec = +c.dataset.dec, nm = niceMaxL(Math.max(+c.dataset.max, 1));
      c.querySelectorAll('svg text[text-anchor="end"]').forEach((t, i) => { t.textContent = fmtN(base + nm * i / 4 / scale, dec === 6 ? 5 : 3); });
      const xs = Array.from(c.querySelectorAll('svg text[text-anchor="middle"]')); const n = xs.length;
      xs.forEach((t, i) => { if ((n - 1 - i) % 5 !== 0) t.style.display = 'none'; });
    });
  }
  function fxLogModal(code) {
    const h = (DB.fxRateHistory || []).filter(x => x.code === code);
    UI.modal({ title: 'Registro de cambios · ' + code, size: 'lg', sub: 'Cada actualización (proveedor, job diario o carga manual) queda auditada.', body: h.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th class="num">S/ por unidad</th><th class="num">Variación</th><th>Fuente</th><th>Usuario</th></tr></thead><tbody>' + h.map(x => '<tr><td>' + datetime(x.at) + '</td><td class="num">' + fmtN(x.rate, fxDec(x.rate)) + '</td><td class="num">' + (x.prev ? fxVarTxt((x.rate - x.prev) / x.prev * 100) : '—') + '</td><td class="small">' + esc(x.source) + '</td><td class="small">' + esc(Q.userName(x.by)) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin cambios registrados para ' + code + '.', 'history'), actions: [{ label: 'Cerrar' }] });
  }
  function fxHistCard(box) {
    const all = BE.currencies(true).filter(c => c.code !== (BE.cfg().baseCurrency || 'PEN'));
    if (!all.some(c => c.code === FXS.code)) FXS.code = (all[0] || {}).code;
    const h = fxHist(FXS.code); const thr = fxThr(); const vals = h.map(x => x.rate); const dec = fxDec(Math.min(...vals, 1));
    const rows = h.map((x, i) => ({ x, v: i ? (x.rate - h[i - 1].rate) / h[i - 1].rate * 100 : null })).reverse();
    box.innerHTML = UI.card('Historial de 30 días ' + DEMO_TAG,
      '<div class="row" style="gap:8px;margin-bottom:10px"><select class="input sm" id="xf-hc" style="width:auto" aria-label="Moneda del historial">' + all.map(c => '<option value="' + c.code + '"' + (c.code === FXS.code ? ' selected' : '') + '>' + c.code + ' · ' + esc(c.name) + '</option>').join('') + '</select>' +
        (h.length ? '<span class="xs faint">Mín. ' + fmtN(Math.min(...vals), dec) + ' · Máx. ' + fmtN(Math.max(...vals), dec) + ' · Var. 30 días ' + fxVarTxt((vals[vals.length - 1] - vals[0]) / vals[0] * 100) + '</span>' : '') + '<div class="grow"></div><button class="btn xs" id="xf-log">' + ic('history') + 'Registro de cambios</button></div>' +
        fxChart(FXS.code) +
        '<div class="tbl-wrap" style="margin-top:12px;max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>Fecha</th><th class="num">S/ por unidad</th><th class="num">Var. diaria</th><th>Fuente</th></tr></thead><tbody>' +
        rows.map(({ x, v }) => '<tr><td>' + date(x.date) + '</td><td class="num">' + fmtN(x.rate, dec) + '</td><td class="num">' + fxVarTxt(v) + (v != null && Math.abs(v) > thr ? ' ' + bd('warn', '> ' + fmtN(thr, 1) + ' %') : '') + '</td><td class="small">' + esc((fxProv(x.source) || { name: x.source }).name) + '</td></tr>').join('') + '</tbody></table></div>',
      { sub: 'Soles por unidad · rateHistory · valores de prueba generados por el proveedor DEMO', id: 'xf-hist' });
    fxFixChart(box);
    box.querySelector('#xf-hc').onchange = (e) => { FXS.code = e.target.value; fxHistCard(box); };
    box.querySelector('#xf-log').onclick = () => fxLogModal(FXS.code);
  }

  App.register('admin/monedas', (el) => {
    seed();
    const e = BE.cfg(); const all = BE.currencies(true); const multi = BE.on('R-MULTICURRENCY'); const canRate = isAdmin() || can('finance.treasury'); const base = e.baseCurrency || 'PEN';
    const margin = +e.fxMarginPct || 0; const thr = fxThr(); const provs = e.fxProviders || []; const act = fxProv(e.rateProvider);
    const alerts = all.filter(c => c.code !== base && c.active).map(c => ({ c, v: fxDayVar(c.code) })).filter(x => x.v != null && Math.abs(x.v) > thr);
    el.innerHTML = '<div class="page">' + UI.pageHeader({
      title: 'Monedas y tipo de cambio', crumbs: [['Administración'], ['Monedas']],
      subtitle: 'Monedas de visualización para sitio web, widget y portales; tipo de cambio en soles por unidad, proveedor, historial, margen de conversión y monedas en que efectivamente se cobra.',
      actions: '<button class="btn" id="xf-src"' + dis(canRate, 'finance.treasury') + '>' + ic('sync') + 'Actualizar ahora desde proveedor (demo)</button><button class="btn primary" id="xf-save"' + dis(canRate, 'finance.treasury') + '>' + ic('check') + 'Guardar tipos de cambio</button>'
    }) +
      UI.alert('warn', '<b>Tipos de cambio de demostración</b> ' + DEMO_TAG + '<br>El cliente aún no define el tipo de cambio: los valores, el historial de 30 días y los proveedores de esta pantalla son de prueba y se reemplazarán por valores definitivos. <b>El prototipo no consulta proveedores reales</b>: «Actualizar ahora» genera una variación simulada. En producción, el job diario <span class="mono">fx:update-daily</span> consulta el proveedor activo, guarda el valor en <span class="mono">fin_fx_rates</span> y alerta si la variación supera el umbral.') +
      (alerts.length ? UI.alert('bad', '<b>Variación diaria mayor al ' + fmtN(thr, 1) + ' %:</b> ' + alerts.map(x => x.c.code + ' ' + fxVarTxt(x.v)).join(' · ') + '. Verifique el valor antes de publicar precios; el umbral se configura a la derecha.') : '') +
      (multi ? '' : UI.alert('warn', '<b>R-MULTICURRENCY está desactivada</b>' + (BE.planAllows('R-MULTICURRENCY') ? '' : ' (no incluida en el plan ' + esc(BE.tenantPlan()) + ')') + ': el sitio web, el widget y los portales muestran precios solo en ' + base + ' y ocultan el selector de moneda. Los tipos de cambio se siguen usando para convertir tarifas en otras monedas.' + (isAdmin() ? ' <a href="#/admin/reglas">Ir al centro de reglas</a>.' : ''))) +
      (!isAdmin() ? UI.alert('info', 'Con su rol puede actualizar tipos de cambio. Activar monedas, monedas de cobro, el proveedor, el umbral de alerta y el margen son decisiones del Tenant Admin (admin.settings.manage).') : '') +
      '<div class="grid g4">' + UI.kpi({ label: 'Monedas activas', value: all.filter(c => c.active).length + ' / ' + all.length, icon: 'globe' }) + UI.kpi({ label: 'Monedas de cobro', value: esc((e.chargeCurrencies || []).join(', ')), sub: 'Pasarela y conciliación', icon: 'card' }) + UI.kpi({ label: 'Margen de conversión', value: fmtN(margin, 1) + ' %', sub: 'Umbral de alerta ' + fmtN(thr, 1) + ' %', icon: 'percent' }) + UI.kpi({ label: 'Proveedor activo', value: esc(act ? act.kind : '—'), sub: esc(act ? act.name : 'Sin proveedor') + ' · ' + esc(dateShort(e.rateUpdatedAt)), icon: 'sync', tone: act && act.id === 'FX-DEMO' ? 'sun' : 'ok' }) + '</div>' +
      '<div class="grid g-2-1" style="margin-top:16px"><div class="stack">' +
      UI.card('Tabla de monedas ' + DEMO_TAG, '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Moneda</th><th class="num">S/ por unidad</th><th class="num">Var. diaria</th><th class="num">TC al cliente</th><th class="num">S/ 100 equivale a</th><th>Activa</th><th>Cobro</th><th></th></tr></thead><tbody>' +
        all.map(c => { const isB = c.code === base; const eff = c.rate * (1 - margin / 100); const v = isB ? null : fxDayVar(c.code); return '<tr><td><b>' + c.code + '</b> <span class="faint">' + esc(c.symbol) + '</span><div class="xs faint">' + esc(c.name) + '</div></td>' +
          '<td class="num">' + (isB ? '1,000000' : '<input class="input sm num" type="number" step="' + (c.rate < 0.1 ? '0.000001' : '0.0001') + '" min="0" data-rate="' + c.code + '" value="' + c.rate + '" style="width:110px"' + (canRate ? '' : ' disabled') + '>') + '</td>' +
          '<td class="num small"' + (v != null && Math.abs(v) > thr ? ' style="color:var(--bad);font-weight:600"' : '') + '>' + (isB ? '—' : fxVarTxt(v)) + '</td>' +
          '<td class="num small">' + (isB ? '—' : fmtN(eff, 4)) + '</td><td class="num small">' + (isB ? '—' : esc(BE.fmt(100 / (eff || 1), c.code))) + '</td>' +
          '<td><label class="switch"><input type="checkbox" data-act="' + c.code + '"' + (c.active ? ' checked' : '') + (isAdmin() && !isB ? '' : ' disabled') + (isB ? ' title="Moneda base del tenant"' : '') + '></label></td>' +
          '<td><input type="checkbox" data-chg="' + c.code + '"' + ((e.chargeCurrencies || []).includes(c.code) ? ' checked' : '') + (isAdmin() && c.active && !isB ? '' : ' disabled') + ' aria-label="Moneda de cobro ' + c.code + '"></td>' +
          '<td>' + (isB ? '<span class="tag">Base</span>' : '<button class="btn xs" data-hist="' + c.code + '">' + ic('chart') + 'Historial</button>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="xs faint" style="margin:10px 0 0">TC al cliente = TC referencial × (1 − margen). Al mostrar un precio en moneda extranjera se usa este valor, de modo que la variación cambiaria la absorbe el margen. El precio definitivo y el TC se congelan en la reserva (fx_rate, regla transversal 15).</p>', { sub: 'Proveedor activo: ' + esc(act ? act.name : '—') + ' · actualizado ' + esc(datetime(e.rateUpdatedAt)) }) +
      '<div id="xf-hbox"></div>' +
      '</div><div class="stack">' +
      UI.card('Proveedores de tipo de cambio ' + DEMO_TAG, provs.map(p => { const st = FXP_ST[p.status] || ['mute', p.status]; const sel = p.id === e.rateProvider; const selectable = p.status === 'activo';
        return '<div class="xf-prov"><div><input type="radio" name="xf-prov" data-prov="' + p.id + '"' + (sel ? ' checked' : '') + (isAdmin() && selectable ? '' : ' disabled') + ' title="' + (selectable ? 'Usar como proveedor activo' : 'Pendiente de integrar') + '" aria-label="Proveedor ' + esc(p.name) + '"></div><div style="min-width:0"><div class="row" style="gap:6px"><b class="small">' + esc(p.name) + '</b>' + bd(st[0], st[1]) + (sel ? bd('info', 'En uso') : '') + '</div>' +
          '<div class="xs faint" style="margin-top:3px">' + esc(p.kind) + ' · ' + esc(p.schedule || '—') + ' · última ejecución ' + (p.lastRun ? esc(datetime(p.lastRun)) : '—') + '</div><div class="xs muted" style="margin-top:3px">' + esc(p.note || '') + '</div>' +
          (p.status === 'por_validar' && isAdmin() ? '<button class="btn xs" data-ptest="' + p.id + '" style="margin-top:6px">' + ic('plug') + 'Probar conexión (demo)</button>' : '') + '</div></div>'; }).join('') +
        '<p class="xs faint" style="margin:10px 0 0">Job programado <span class="mono">fx:update-daily</span> · diario 08:00 (America/Lima) · cola <span class="mono">integrations</span>. Si el proveedor falla se conserva el último valor y se notifica a Finanzas.</p>', { sub: 'fxProviders · proveedor activo seleccionable' }) +
      UI.card('Configuración', UI.form([
        { id: 'xf-m', label: 'Margen de conversión (%)', type: 'number', step: '0.1', min: 0, max: 15, col: 6, value: margin, disabled: !isAdmin(), hint: 'Parámetro de R-MULTICURRENCY' },
        { id: 'xf-t', label: 'Alerta si la variación diaria supera (%)', type: 'number', step: '0.1', min: 0.1, max: 20, col: 6, value: thr, disabled: !isAdmin(), hint: 'Demo: 3 %' }
      ]) + (isAdmin() ? '<button class="btn sm" id="xf-cfg" style="margin-top:12px">' + ic('check') + 'Guardar configuración</button>' : ''), { sub: 'Actualizado ' + datetime(e.rateUpdatedAt) }) +
      UI.card('Conversor de prueba', '<div class="form-grid">' + UI.field({ id: 'cv-a', label: 'Monto', type: 'number', col: 12, value: 1490, step: '0.01' }) + UI.field({ id: 'cv-f', label: 'De', type: 'select', col: 6, value: 'USD', options: all.map(c => c.code) }) + UI.field({ id: 'cv-t', label: 'A', type: 'select', col: 6, value: 'EUR', options: all.map(c => c.code) }) + '</div><div id="cv-out" style="margin-top:12px"></div>', { sub: 'BE.convert(monto, de, a)' }) +
      '</div></div></div>';
    const hbox = el.querySelector('#xf-hbox'); fxHistCard(hbox);
    const conv = () => { const a = +el.querySelector('#cv-a').value || 0, f = el.querySelector('#cv-f').value, t = el.querySelector('#cv-t').value; const v = BE.convert(a, f, t); const m = +(BE.cfg().fxMarginPct || 0); const vm = f === t ? v : (t === base ? v : BE.convert(a, f, base) / (BE.currency(t).rate * (1 - m / 100)));
      el.querySelector('#cv-out').innerHTML = UI.dl([['TC referencial', '<b>' + esc(BE.fmt(v, t)) + '</b>'], ['Mostrado al cliente (con margen)', esc(BE.fmt(vm, t))], ['Cálculo', '<span class="xs mono">' + a + ' × ' + BE.currency(f).rate + ' ÷ ' + BE.currency(t).rate + '</span>']]) + (BE.currency(t).active ? '' : UI.alert('warn', t + ' está inactiva: no se ofrece a los clientes.')); };
    ['#cv-a', '#cv-f', '#cv-t'].forEach(s => el.querySelector(s).addEventListener('input', conv)); conv();
    el.querySelectorAll('[data-hist]').forEach(b => b.onclick = () => { FXS.code = b.dataset.hist; fxHistCard(hbox); hbox.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const applyRates = (changes, source, srcId) => { changes.forEach(([c, nv]) => { const cur = BE.currency(c); const prev = cur.rate; cur.rate = nv; fxPushDay(c, nv, srcId); DB.fxRateHistory.unshift({ id: 'FXH-' + c + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), code: c, rate: nv, prev, at: nowStr(), by: Auth.user.id, source }); Audit.log('Tipo de cambio', c, 'actualizar', prev, nv + ' · ' + source); if (c === 'USD') { DB.settings.fx = nv; if (DB.tenant) DB.tenant.fx = nv; } }); BE.cfg().rateUpdatedAt = nowStr(); Store.save(); };
    const warnBig = (codes) => { const big = codes.map(c => ({ c, v: fxDayVar(c) })).filter(x => x.v != null && Math.abs(x.v) > fxThr()); if (big.length) { Notify.push('fx.variacion_alta', 'Email', 'finanzas@andeshorizonte.pe', 'Variación diaria de tipo de cambio > ' + fmtN(fxThr(), 1) + ' %: ' + big.map(x => x.c).join(', ')); UI.toast('Alerta: ' + big.map(x => x.c + ' ' + fxVarTxt(x.v)).join(', ') + ' supera el umbral de ' + fmtN(fxThr(), 1) + ' %.', 'warn'); } return big.length; };
    el.querySelector('#xf-save').onclick = () => {
      if (!canRate) { UI.toast('Requiere permiso finance.treasury o admin.settings.manage.', 'bad'); return; }
      const ch = []; let bad = null; el.querySelectorAll('[data-rate]').forEach(i => { const c = i.dataset.rate; const v = +i.value; if (!(v > 0)) bad = c; else if (Math.abs(v - BE.currency(c).rate) > 1e-9) ch.push([c, v]); });
      if (bad) { UI.toast('El tipo de cambio de ' + bad + ' debe ser mayor que cero.', 'bad'); return; }
      if (!ch.length) { UI.toast('No hay cambios que guardar.', 'info'); return; }
      const big = ch.filter(([c, v]) => Math.abs(v - BE.currency(c).rate) / BE.currency(c).rate * 100 > fxThr());
      const go = () => { applyRates(ch, 'Manual (' + Q.roleName(Auth.role) + ')', 'FX-MAN'); const m = fxProv('FX-MAN'); if (m) m.lastRun = nowStr(); Store.save(); if (!warnBig(ch.map(x => x[0]))) UI.toast(ch.length + ' tipo(s) de cambio actualizados. Las reservas ya creadas conservan su TC.'); App.render(); };
      if (big.length) UI.confirm({ title: 'Variación mayor al ' + fmtN(fxThr(), 1) + ' %', confirmLabel: 'Confirmar cambio', message: 'Los tipos de ' + big.map(x => '<b>' + x[0] + '</b>').join(', ') + ' varían más del umbral configurado respecto al valor vigente. Verifique la cifra antes de publicar precios.', onConfirm: go }); else go();
    };
    el.querySelector('#xf-src').onclick = () => {
      if (!canRate) { UI.toast('Requiere permiso finance.treasury o admin.settings.manage.', 'bad'); return; }
      const p = fxProv(BE.cfg().rateProvider);
      if (!p || p.id === 'FX-MAN') { UI.toast('El proveedor activo es la carga manual: edite los valores en la tabla y guarde.', 'info'); return; }
      const ch = BE.currencies(true).filter(c => c.code !== base && c.active).map(c => [c.code, +(c.rate * (1 + (Math.random() - 0.5) * 0.012)).toFixed(fxDec(c.rate))]);
      applyRates(ch, 'Proveedor (demo): ' + p.name, p.id); p.lastRun = nowStr(); Audit.log('Tipo de cambio', p.id, 'actualizar_desde_proveedor', '', ch.length + ' monedas (valores simulados)'); Store.save();
      if (!warnBig(ch.map(x => x[0]))) UI.toast(ch.length + ' monedas actualizadas con el valor del día (variación simulada; el prototipo no consulta proveedores reales).'); App.render();
    };
    el.querySelectorAll('[data-prov]').forEach(i => i.onchange = () => { if (!isAdmin()) { UI.toast('Requiere permiso admin.settings.manage.', 'bad'); App.render(); return; } const ev = BE.cfg(); const bf = ev.rateProvider; const p = fxProv(i.dataset.prov); ev.rateProvider = p.id; ev.rateSource = p.name; Audit.log('Tipo de cambio', 'PROVEEDOR', 'cambiar_proveedor', bf, p.id); Store.save(); UI.toast('Proveedor activo: ' + esc(p.name) + '.'); App.render(); });
    el.querySelectorAll('[data-ptest]').forEach(b => b.onclick = () => { const p = fxProv(b.dataset.ptest); UI.confirm({ title: 'Probar conexión · ' + esc(p.name), confirmLabel: 'Probar (demo)', message: 'En la demo la prueba siempre resulta exitosa y deja el proveedor disponible para seleccionarlo. En producción se valida la credencial y se descarga un valor de muestra.', onConfirm: () => { p.status = 'activo'; p.schedule = 'Diario 08:00 (America/Lima)'; p.note = (p.note || '') + ' Conexión simulada en la demo.'; Audit.log('Tipo de cambio', p.id, 'probar_conexion', 'por_validar', 'activo (demo)'); Store.save(); UI.toast('Conexión simulada correcta: ' + esc(p.name) + ' ya puede seleccionarse.'); App.render(); } }); });
    el.querySelectorAll('[data-act]').forEach(i => i.onchange = () => { const c = BE.currency(i.dataset.act); const ev = BE.cfg(); if (!i.checked && (ev.chargeCurrencies || []).includes(c.code)) { UI.toast(c.code + ' es moneda de cobro: primero quítela de las monedas de cobro.', 'bad'); i.checked = true; return; } c.active = i.checked; Audit.log('Moneda', c.code, i.checked ? 'activar' : 'desactivar', '', ''); Store.save(); UI.toast(c.code + (i.checked ? ' activada: disponible en el selector de moneda.' : ' desactivada.')); App.render(); });
    el.querySelectorAll('[data-chg]').forEach(i => i.onchange = () => { const ev = BE.cfg(); const set = new Set(ev.chargeCurrencies || []); if (i.checked) set.add(i.dataset.chg); else set.delete(i.dataset.chg); set.add(base); ev.chargeCurrencies = Array.from(set); Audit.log('Moneda', i.dataset.chg, i.checked ? 'agregar_cobro' : 'quitar_cobro', '', ev.chargeCurrencies.join(', ')); Store.save(); UI.toast('Monedas de cobro: ' + ev.chargeCurrencies.join(', ') + '. Verifique que la pasarela y las cuentas bancarias admitan estas monedas.'); App.render(); });
    const cfgBtn = el.querySelector('#xf-cfg'); if (cfgBtn) cfgBtn.onclick = () => { const m = +el.querySelector('#xf-m').value; const t = +el.querySelector('#xf-t').value; if (isNaN(m) || m < 0 || m > 15) { UI.toast('El margen debe estar entre 0 y 15 %.', 'bad'); return; } if (!(t >= 0.1 && t <= 20)) { UI.toast('El umbral de alerta debe estar entre 0,1 y 20 %.', 'bad'); return; } const ev = BE.cfg(); const bf = 'margen ' + ev.fxMarginPct + ' · umbral ' + fxThr(); ev.fxMarginPct = m; ev.fxAlertPct = t; const r = BE.rule('R-MULTICURRENCY'); if (r) r.params.fxMarginPct = m; Audit.log('Moneda', 'CONFIG', 'editar', bf, 'margen ' + m + ' · umbral ' + t); Store.save(); UI.toast('Configuración de monedas guardada.'); App.render(); };
  });

  /* ======================================================================
     4) RESEÑAS EXTERNAS  ·  #/canales/resenas
     ====================================================================== */
  const RV_ST = { sin_responder: ['warn', 'Sin responder'], pendiente_publicar: ['info', 'Pendiente de publicar'], publicada: ['ok', 'Respuesta publicada'], no_admite: ['mute', 'Responder en la plataforma'] };
  const INT_ST = { conectado: ['ok', 'Conectado'], no_conectado: ['mute', 'No conectado'], pendiente: ['warn', 'Aprobación pendiente'], error: ['bad', 'Error de credenciales'] };
  const RVS = { tab: 'bandeja' };
  const srcOf = (id) => (DB.reviewIntegrations || []).find(x => x.id === id) || { name: id, abbr: '?' };
  const canConnect = () => isAdmin();
  const canReply = () => can('channels.ecommerce.manage') || can('crm.clients.manage');
  /* v2.2 · Decisión del cliente (30/09/2026): conectores externos priorizados + módulo propio de reseñas verificadas */
  const RV_PRIO = ['google', 'tripadvisor', 'trustpilot'];
  const RV_LATER = ['facebook', 'getyourguide', 'viator'];
  const rvPhase = (id) => RV_PRIO.includes(id) ? 1 : RV_LATER.includes(id) ? 2 : 3;
  const rvPhaseTag = (id) => rvPhase(id) === 1 ? bd('ok', 'Priorizado · fase 1') : bd('mute', 'Fase posterior');
  App.register('canales/resenas', (el) => {
    seed();
    const ints = DB.reviewIntegrations, revs = DB.externalReviews; const con = ints.filter(i => i.status === 'conectado');
    const tot = sum(con, i => i.count || 0); const avg = tot ? sum(con, i => (i.rating || 0) * (i.count || 0)) / tot : 0;
    const pend = revs.filter(r => r.responseStatus === 'sin_responder'); const low = pend.filter(r => r.rating <= 2);
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Reseñas externas', crumbs: [['Canales'], ['Reseñas externas']], subtitle: 'Conectores priorizados con Google Business Profile, TripAdvisor y Trustpilot (luego Facebook, GetYourGuide y Viator): calificación por fuente, bandeja de reseñas, respuestas, invitaciones postviaje y widget para el sitio.', actions: '<a class="btn" href="#/canales/resenas-propias">' + ic('award') + 'Reseñas de clientes (módulo propio)</a>' }) +
      UI.card('Decisión del cliente · 30/09/2026', '<div class="grid g3"><div><div class="section-title">Fase 1 · priorizados</div><div class="small" style="margin-top:6px">' + RV_PRIO.map(id => esc(srcOf(id).name)).join(', ') + '. Conectores a gestionar primero (aprobación de partner / API oficial).</div></div>' +
        '<div><div class="section-title">Fase posterior</div><div class="small" style="margin-top:6px">' + RV_LATER.map(id => esc(srcOf(id).name)).join(', ') + '. Se habilitan cuando haya contrato o volumen de ventas por esos canales.</div></div>' +
        '<div><div class="section-title">Módulo propio</div><div class="small" style="margin-top:6px">Reseñas verificadas de pasajeros con viaje realizado, moderadas y publicadas en el sitio y el widget (regla R-OWN-REVIEWS). No dependen de terceros. <a href="#/canales/resenas-propias">Ir a Reseñas de clientes</a>.</div></div></div>', { sub: 'Documentada en la especificación 17, sección 11 (v2.2)' }) +
      UI.alert('info', '<b>Cumplimiento:</b> las APIs requieren aprobación o contrato con cada plataforma. El sistema solo lee y responde reseñas a través de las APIs oficiales: <b>nunca hace scraping</b> ni publica reseñas propias como si fueran de terceros. Las invitaciones se envían a todos los pasajeros elegibles, sin filtrar por satisfacción (review gating) ni ofrecer incentivos.') +
      '<div class="grid g4" style="margin-top:14px">' + UI.kpi({ label: 'Calificación ponderada', value: fmtN(avg, 2) + ' / 5', sub: SAMPLE, icon: 'star', tone: 'sun' }) + UI.kpi({ label: 'Reseñas en fuentes conectadas', value: fmtN(tot, 0), sub: con.length + ' de ' + ints.length + ' conectores', icon: 'globe' }) + UI.kpi({ label: 'Sin responder', value: pend.length, sub: low.length + ' con 1–2 estrellas', icon: 'msg', tone: pend.length ? 'warn' : 'ok' }) + UI.kpi({ label: 'Invitaciones postviaje', value: BE.on('R-REVIEW-INVITE') ? 'Activas' : 'Inactivas', sub: 'R-REVIEW-INVITE', icon: 'send', tone: BE.on('R-REVIEW-INVITE') ? 'ok' : 'mute' }) + '</div>' +
      (low.length ? '<div style="margin-top:14px">' + UI.alert('warn', '<b>' + low.length + ' reseña(s) de 1–2 estrellas sin respuesta.</b> Responda en menos de 48 h y derive el caso a postventa si hubo una falla de servicio.') + '</div>' : '') +
      '<div id="rv-tabs" style="margin-top:16px"></div></div>';
    UI.tabs(el.querySelector('#rv-tabs'), [
      { id: 'bandeja', label: 'Bandeja de reseñas', count: revs.length, render: rvInbox },
      { id: 'conectores', label: 'Conectores', count: ints.length, render: rvConnectors },
      { id: 'invitaciones', label: 'Invitaciones postviaje', render: rvInvites },
      { id: 'widget', label: 'Widget para el sitio', render: rvWidget }
    ], RVS.tab, { onChange: (id) => { RVS.tab = id; } });
  });
  function rvConnectors(body) {
    const list = DB.reviewIntegrations.slice().sort((a, b) => rvPhase(a.id) - rvPhase(b.id));
    const sec = (ph, title, note) => { const rs = list.filter(i => (rvPhase(i.id) === ph) || (ph === 2 && rvPhase(i.id) === 3)); return rs.length ? '<div class="xrv-sec"><b class="small">' + title + '</b><span class="xs faint">' + note + '</span></div><div class="grid g3" style="margin-bottom:16px">' + rs.map(connCard).join('') + '</div>' : ''; };
    body.innerHTML = sec(1, 'Priorizados · fase 1', 'Google Business Profile, TripAdvisor y Trustpilot') + sec(2, 'Fase posterior', 'Disponibles en la demo; fuera del alcance inicial') +
      '<div class="xs faint">Complementa con el módulo propio de reseñas verificadas: <a href="#/canales/resenas-propias">Reseñas de clientes</a>.</div>';
    bindConn(body);
  }
  function connCard(i) {
    { const st = INT_ST[i.status] || ['mute', i.status];
      return UI.card('', '<div class="xrv-card"><div class="xrv-src"><div class="xrv-logo">' + esc(i.abbr) + '</div><div style="min-width:0"><b>' + esc(i.name) + '</b><div class="xs faint">' + esc(i.api) + '</div></div></div>' +
        '<div class="row" style="gap:6px">' + rvPhaseTag(i.id) + bd(st[0], st[1]) + (i.canReply ? '<span class="tag">Admite respuestas</span>' : '<span class="tag">Solo lectura</span>') + (i.invites ? '<span class="tag">Invitaciones</span>' : '') + '</div>' +
        (i.status === 'conectado' ? '<div class="row between"><span>' + stars(i.rating) + ' <b>' + fmtN(i.rating, 1) + '</b></span><span class="small">' + fmtN(i.count, 0) + ' reseñas</span></div><div>' + SAMPLE + '</div>' : '') +
        UI.dl([['Cuenta', esc(i.account || '—')], ['Credencial', i.keyMask ? '<span class="mono xs">' + esc(i.keyMask) + '</span>' : '—'], ['Alcance', (i.scopes || []).map(s => '<span class="tag mono">' + esc(s) + '</span>').join(' ') || '—'], ['Última sincronización', i.lastSync ? datetime(i.lastSync) : '—']]) +
        (i.note ? '<div class="xs" style="color:var(--warn)">' + esc(i.note) + '</div>' : '') + (i.replyNote ? '<div class="xs faint">' + esc(i.replyNote) + '</div>' : '') +
        '<div class="row" style="gap:6px">' + (i.status === 'conectado' ? '<button class="btn sm" data-sync="' + i.id + '"' + dis(canConnect(), 'admin.settings.manage') + '>' + ic('sync') + 'Sincronizar</button><button class="btn sm ghost" data-disc="' + i.id + '"' + dis(canConnect(), 'admin.settings.manage') + '>Desconectar</button>' : '<button class="btn sm primary" data-conn="' + i.id + '"' + dis(canConnect(), 'admin.settings.manage') + '>' + ic('plug') + (i.status === 'pendiente' ? 'Completar conexión (demo)' : 'Conectar (demo)') + '</button>') + '</div></div>');
    }
  }
  function bindConn(body) {
    body.querySelectorAll('[data-conn]').forEach(b => b.onclick = () => connectModal(DB.reviewIntegrations.find(x => x.id === b.dataset.conn)));
    body.querySelectorAll('[data-disc]').forEach(b => b.onclick = () => { const i = DB.reviewIntegrations.find(x => x.id === b.dataset.disc); UI.confirm({ title: 'Desconectar ' + esc(i.name), danger: true, confirmLabel: 'Desconectar', message: 'Se revocará el token y se eliminará la credencial del almacén de secretos. Las reseñas ya importadas se conservan como histórico.', onConfirm: () => { i.status = 'no_conectado'; i.keyMask = ''; i.scopes = []; i.lastSync = null; Audit.log('Integración de reseñas', i.id, 'desconectar', 'conectado', 'no_conectado'); Store.save(); UI.toast(esc(i.name) + ' desconectado.'); App.render(); } }); });
    body.querySelectorAll('[data-sync]').forEach(b => b.onclick = () => { const i = DB.reviewIntegrations.find(x => x.id === b.dataset.sync); i.lastSync = nowStr(); const n = DB.externalReviews.filter(r => r.source === i.id).length; Audit.log('Integración de reseñas', i.id, 'sincronizar', '', n + ' reseñas'); Store.save(); UI.toast('Sincronización de ' + esc(i.name) + ' completada (demo): sin reseñas nuevas desde la última lectura.'); App.render(); });
  }
  function connectModal(i) {
    if (!canConnect()) { UI.toast('Requiere permiso admin.settings.manage.', 'bad'); return; }
    const SC = { tripadvisor: ['location_details', 'reviews:read'], trustpilot: ['reviews:read', 'reviews:reply', 'invitations:write'], google: ['business.manage'], facebook: ['pages_read_user_content', 'pages_manage_engagement'], getyourguide: ['reviews:read', 'bookings:read'], viator: ['reviews:read', 'products:read'] }[i.id] || ['reviews:read'];
    UI.modal({ title: 'Conectar ' + esc(i.name) + ' (demo)', size: 'lg', sub: esc(i.api),
      body: UI.alert('info', 'En producción la conexión usa OAuth 2.0 o la clave emitida por la plataforma tras aprobar la solicitud de partner. La credencial se guarda cifrada en el almacén de secretos; en pantalla solo se muestran los últimos 4 caracteres.') + '<div style="height:12px"></div>' +
        UI.form([{ id: 'cn-acc', label: i.id === 'google' ? 'Cuenta / ubicación' : 'ID de cuenta, ubicación o proveedor', required: true, col: 6, value: i.account || '' }, { id: 'cn-key', label: 'API key / client secret', type: 'password', required: true, col: 6, placeholder: '••••••••••••' },
          { type: 'html', col: 12, html: '<label class="xs faint" style="font-weight:600">Alcance solicitado</label><div class="xm-checks" style="margin-top:6px">' + SC.map(s => '<label class="check"><input type="checkbox" data-scp="' + s + '" checked> <span class="mono xs">' + s + '</span></label>').join('') + '</div>' },
          { id: 'cn-ok', label: 'Declaro que la agencia tiene contrato o aprobación vigente de ' + i.name + ' para usar su API.', type: 'checkbox', col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Conectar', cls: 'primary', icon: 'plug', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        if (!f['cn-ok']) { UI.toast('Debe confirmar la aprobación o contrato con la plataforma.', 'bad'); return false; }
        if (f['cn-key'].length < 12) { UI.toast('La credencial parece incompleta (mínimo 12 caracteres).', 'bad'); return false; }
        const sc = Array.from(m.querySelectorAll('[data-scp]:checked')).map(x => x.dataset.scp); if (!sc.length) { UI.toast('Seleccione al menos un alcance.', 'bad'); return false; }
        i.status = 'conectado'; i.account = f['cn-acc']; i.keyMask = '••••••••' + f['cn-key'].slice(-4); i.scopes = sc; i.connectedAt = nowStr(); i.connectedBy = Auth.user.id; i.lastSync = nowStr(); i.note = '';
        if (i.rating == null) { i.rating = { trustpilot: 4.5, facebook: 4.6, viator: 4.7 }[i.id] || 4.5; i.count = { trustpilot: 214, facebook: 97, viator: 176 }[i.id] || 50; }
        Audit.log('Integración de reseñas', i.id, 'conectar', 'no_conectado', 'conectado · ' + sc.join(', ')); Store.save(); UI.toast(esc(i.name) + ' conectado (demo). La primera sincronización trae las reseñas públicas de la cuenta.'); App.render();
      } }] });
  }
  function rvInbox(body) {
    UI.dataTable(body, { exportName: 'resenas-externas', rows: () => DB.externalReviews, search: ['author', 'title', 'text', 'source'], pageSize: 10, defaultSort: 'date', defaultDir: -1, searchPlaceholder: 'Buscar autor o texto…',
      toolbar: SAMPLE,
      filters: [{ label: 'Fuente', options: DB.reviewIntegrations.map(i => [i.id, i.name]), match: (r, v) => r.source === v }, { label: 'Estrellas', options: [['5', '5'], ['4', '4'], ['3', '3'], ['low', '1–2']], match: (r, v) => v === 'low' ? r.rating <= 2 : String(r.rating) === v }, { label: 'Respuesta', options: Object.entries(RV_ST).map(([k, v]) => [k, v[1]]), match: (r, v) => r.responseStatus === v }],
      onRow: (r) => reviewDrawer(r),
      columns: [
        { key: 'date', label: 'Fecha', render: r => '<span class="small">' + date(r.date) + '</span>' },
        { key: 'source', label: 'Fuente', render: r => '<span class="tag">' + esc(srcOf(r.source).name) + '</span>' },
        { key: 'rating', label: 'Calificación', render: r => stars(r.rating) },
        { key: 'author', label: 'Autor y reseña', render: r => '<b class="small">' + esc(r.title) + '</b> <span class="xs faint">· ' + esc(r.author) + '</span><div class="xs muted" style="max-width:420px">' + esc(r.text.slice(0, 110)) + (r.text.length > 110 ? '…' : '') + '</div>' },
        { key: 'productId', label: 'Producto', render: r => r.productId ? '<a class="small" href="#/catalogo/productos/' + esc(r.productId) + '">' + esc(r.productId) + '</a>' : '<span class="xs faint">General</span>' },
        { key: 'responseStatus', label: 'Respuesta', render: r => bd(RV_ST[r.responseStatus][0], RV_ST[r.responseStatus][1]) }
      ] });
  }
  function reviewDrawer(r) {
    const src = srcOf(r.source); const replyOk = src.canReply && src.status === 'conectado';
    const TPL = r.rating >= 4 ? 'Muchas gracias, ' + r.author.split(' ')[0] + ', por compartir su experiencia. Nos alegra que haya disfrutado el viaje; transmitiremos sus palabras al equipo.' : 'Estimado/a ' + r.author.split(' ')[0] + ': lamentamos lo ocurrido y agradecemos que nos lo cuente. Hemos revisado el caso con operaciones y nos gustaría contactarle para ofrecerle una solución. Escríbanos a atencion@andeshorizonte.pe indicando su código de reserva.';
    UI.drawer({ title: esc(r.title), sub: esc(src.name) + ' · ' + esc(r.author) + ' · ' + date(r.date), wide: true,
      body: '<div class="row" style="gap:8px;margin-bottom:10px">' + stars(r.rating, 16) + SAMPLE + bd(RV_ST[r.responseStatus][0], RV_ST[r.responseStatus][1]) + '</div><p style="white-space:pre-wrap">' + esc(r.text) + '</p>' +
        UI.dl([['Producto vinculado', r.productId ? '<a href="#/catalogo/productos/' + esc(r.productId) + '">' + esc(Q.productName(r.productId)) + '</a>' : 'Reseña general de la agencia'], ['Idioma', r.lang], ['Enlace original', '<span class="mono xs">' + esc(r.url) + '</span>']]) +
        '<div class="section-title" style="margin:16px 0 10px">Respuesta pública</div>' +
        (replyOk ? '' : UI.alert('info', esc(src.replyNote || (src.name + ' no admite respuestas por API o no está conectado.')) + ' Puede preparar el texto aquí, copiarlo y marcar la reseña cuando lo publique en la plataforma.')) +
        (r.reply ? '<div class="card" style="margin-top:10px"><div class="card-b small" style="white-space:pre-wrap">' + esc(r.reply) + '<div class="xs faint" style="margin-top:6px">' + (r.repliedBy ? esc(Q.userName(r.repliedBy)) + ' · ' + date(r.repliedAt) : '') + '</div></div></div>' : '') +
        (r.responseStatus !== 'publicada' ? '<div class="field" style="margin-top:10px"><label for="rv-rp">Texto de la respuesta</label><textarea class="input" id="rv-rp" rows="5">' + esc(r.reply || '') + '</textarea><div class="hint">No incluya datos personales del pasajero. Sea breve, agradezca y, si hubo un problema, ofrezca un canal privado.</div></div><button class="btn xs" id="rv-tpl" style="margin-top:6px">' + ic('file') + 'Usar respuesta sugerida</button>' : ''),
      actions: (r.rating <= 3 && canReply() ? [{ label: 'Derivar a postventa', icon: 'heart', close: false, onClick: () => { deriveReview(r); return false; } }] : []).concat(r.responseStatus !== 'publicada' && canReply() ? [
        { label: replyOk ? 'Guardar respuesta (simulado)' : 'Guardar y copiar', cls: 'primary', icon: 'send', onClick: (d) => { const t = d.querySelector('#rv-rp').value.trim(); if (t.length < 20) { UI.toast('Escriba una respuesta de al menos 20 caracteres.', 'bad'); return false; } const bf = r.responseStatus; r.reply = t; r.repliedAt = T(); r.repliedBy = Auth.user.id; r.responseStatus = replyOk ? 'pendiente_publicar' : 'no_admite'; Audit.log('Reseña externa', r.id, 'responder', bf, r.responseStatus); Store.save(); if (!replyOk) copyText(t, d.querySelector('#rv-rp')); UI.toast(replyOk ? 'Respuesta guardada: pendiente de publicar en ' + esc(src.name) + ' (el job de integraciones la envía por API).' : 'Respuesta guardada. Publíquela en ' + esc(src.name) + ' y márquela como publicada.'); App.render(); } }
      ] : []).concat(['pendiente_publicar', 'no_admite'].includes(r.responseStatus) && canReply() ? [{ label: 'Marcar como publicada', icon: 'check', onClick: () => { r.responseStatus = 'publicada'; Audit.log('Reseña externa', r.id, 'marcar_publicada', '', ''); Store.save(); UI.toast('Respuesta marcada como publicada.'); App.render(); } }] : []),
      onOpen: (d) => { const b = d.querySelector('#rv-tpl'); if (b) b.onclick = () => { d.querySelector('#rv-rp').value = TPL; }; } });
  }
  function deriveReview(r) {
    if (!DB.conversations) { UI.toast('La bandeja omnicanal no está disponible.', 'bad'); return; }
    if (r.conversationId) { UI.toast('Ya se derivó como ' + esc(r.conversationId) + '.', 'info'); return; }
    const ts = nowStr(); const id = nextId(DB.conversations, 'CNV-', 4);
    DB.conversations.unshift({ id, channel: 'Reseña externa', contact: { name: r.author, email: '', phone: '' }, subject: 'Reseña ' + r.rating + '★ en ' + srcOf(r.source).name + ': ' + r.title, status: 'abierta', assignee: null, messages: [{ from: 'contact', text: r.text, ts, type: 'msg' }], createdAt: ts, clientId: null, leadId: null, resId: null, quoteId: null, priority: r.rating <= 2 ? 'alta' : 'media', tags: ['Reseña', srcOf(r.source).name], slaDueAt: addHours(ts, 24), firstResponseAt: null, ticketId: null, unread: 1, source: 'Reseñas externas' });
    r.conversationId = id; Audit.log('Reseña externa', r.id, 'derivar_postventa', '', id); Store.save(); UI.toast('Caso ' + id + ' creado en la bandeja omnicanal para seguimiento de postventa.');
  }
  function rvInvites(body) {
    const on = BE.on('R-REVIEW-INVITE'); const t = DB.paxMessageTemplates.find(x => x.id === 'PMT-009'); const days = BE.param('R-REVIEW-INVITE', 'daysAfter');
    const plats = DB.reviewIntegrations.filter(i => i.status === 'conectado' && i.invites);
    if (!on) { body.innerHTML = UI.alert('warn', '<b>R-REVIEW-INVITE está desactivada.</b> No se programan invitaciones postviaje y la plantilla PMT-009 queda en pausa.' + (isAdmin() ? ' <a href="#/admin/reglas">Activar en el centro de reglas</a>.' : ' Solicite al Tenant Admin que la active.')) + '<div style="margin-top:14px">' + UI.card('Cómo funciona', '<ol class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>Al finalizar el viaje (' + days + ' día(s) después) se envía la plantilla «Invitación a reseña externa».</li><li>El enlace abre la página oficial de reseñas de la plataforma conectada (Trustpilot, Google o TripAdvisor Review Express).</li><li>Se invita a todos los pasajeros elegibles; nunca se filtra por satisfacción ni se ofrecen incentivos.</li><li>El estado de la invitación queda en el historial de mensajes.</li></ol>') + '</div>'; return; }
    const elig = (DB.reservations || []).filter(r => !['cancelada', 'borrador'].includes(r.status) && (r.travelTo || r.travelFrom) < T());
    const invOf = (r) => DB.paxMessages.filter(m => m.resId === r.id && m.templateId === 'PMT-009');
    body.innerHTML = '<div class="grid g-2-1"><div id="rv-inv"></div><div class="stack">' + UI.card('Configuración', UI.dl([['Regla', bd('ok', 'R-REVIEW-INVITE activa')], ['Envío', days + ' día(s) después del fin del viaje'], ['Plantilla', t ? esc(t.name) + (t.active ? '' : ' ' + bd('warn', 'inactiva')) : '—'], ['Plataformas de destino', plats.map(p => esc(p.name)).join(', ') || '<span style="color:var(--warn)">Ninguna conectada con invitaciones</span>']]) + (isAdmin() ? '<a class="btn sm" href="#/admin/comunicaciones" style="margin-top:10px">' + ic('mail') + 'Editar plantilla</a>' : '')) + '</div></div>';
    UI.dataTable(body.querySelector('#rv-inv'), { exportName: 'invitaciones-resena', rows: elig, pageSize: 10, search: ['id', 'title'], empty: 'No hay viajes finalizados elegibles.',
      columns: [{ key: 'id', label: 'Reserva', render: r => '<span class="mono small">' + r.id + '</span><div class="xs faint">' + esc(r.title) + '</div>' }, { key: 'travelTo', label: 'Fin del viaje', render: r => date(r.travelTo) }, { key: 'lead', label: 'Titular', sort: false, render: r => esc(resLead(r).name || '') },
        { key: 'st', label: 'Invitación', sort: false, render: r => { const m = invOf(r)[0]; return m ? msgBadge(m.status) + '<div class="xs faint">' + datetime(m.sentAt || m.scheduledAt) + '</div>' : '<span class="xs faint">No enviada</span>'; } },
        { key: 'x', label: '', sort: false, render: r => invOf(r).some(m => m.status !== 'cancelado') ? '' : '<button class="btn xs" data-inv="' + r.id + '"' + dis(canReply() && !!t, 'crm.clients.manage') + (plats.length ? '' : ' disabled title="Conecte una plataforma que admita invitaciones"') + '>' + ic('send') + 'Invitar</button>' }],
      afterDraw: (c) => c.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const r = Q.reservation(b.dataset.inv); const v = varsFor(r); const msg = { id: msgId(), resId: r.id, templateId: 'PMT-009', channel: 'email', to: toFor(r, 'email'), subject: fill(t.subject, v), body: fill(t.body, v) + '\n\n' + plats.map(p => p.name + ': https://' + p.id + '.invalid/review/andes-horizonte').join('\n'), status: 'enviado', scheduledAt: nowStr(), sentAt: nowStr(), readAt: null, direction: 'saliente', manual: true, by: Auth.user.id, lang: resLang(r), attempts: 1 }; DB.paxMessages.unshift(msg); Notify.push('resena.invitacion', 'Email', msg.to, msg.subject); Audit.log('Reseña externa', r.id, 'invitar', '', plats.map(p => p.id).join(',')); Store.save(); UI.toast('Invitación enviada a ' + esc(msg.to) + '.'); App.render(); }) });
  }
  function rvWidget(body) {
    const cfg = DB.widgetConfig; const rc = cfg.reviewsWidget || (cfg.reviewsWidget = { sources: ['google', 'tripadvisor'], minRating: 4, count: 3, layout: 'lista' });
    const draw = () => {
      const list = DB.externalReviews.filter(r => rc.sources.includes(r.source) && r.rating >= rc.minRating).sort((a, b) => b.date.localeCompare(a.date)).slice(0, rc.count);
      const code = '<script src="' + cfg.cdn + '/qhapaq-widget.js" type="module" async></script>\n<qhapaq-reviews tenant="' + cfg.tenantSlug + '" sources="' + rc.sources.join(',') + '" min-rating="' + rc.minRating + '" count="' + rc.count + '" layout="' + rc.layout + '" key="' + cfg.publicKey + '"></qhapaq-reviews>';
      body.querySelector('#rw-out').innerHTML = UI.card('Código para el sitio', '<pre class="xc-code" id="rw-code">' + esc(code) + '</pre><button class="btn sm" id="rw-copy" style="margin-top:10px">' + ic('copy') + 'Copiar código</button>') +
        UI.card('Vista previa', '<div class="row between" style="margin-bottom:8px"><b class="small">Lo que dicen nuestros viajeros</b>' + SAMPLE + '</div>' + (list.length ? '<div class="' + (rc.layout === 'carrusel' ? 'grid g3' : 'stack') + '" style="gap:10px">' + list.map(r => '<div class="card"><div class="card-b"><div class="row between">' + stars(r.rating) + '<span class="xs faint">' + esc(srcOf(r.source).name) + '</span></div><div class="small" style="margin-top:6px"><b>' + esc(r.title) + '</b></div><div class="xs muted" style="margin-top:4px">' + esc(r.text.slice(0, 140)) + '</div><div class="xs faint" style="margin-top:6px">' + esc(r.author) + ' · ' + date(r.date) + '</div></div></div>').join('') + '</div>' : UI.empty('Ninguna reseña cumple los filtros.', 'star')) + '<p class="xs faint" style="margin:10px 0 0">Cada reseña enlaza a su fuente original y muestra la atribución exigida por la plataforma. El texto no se edita. Mínimo de estrellas: filtro de visualización, no de invitación.</p>');
      body.querySelector('#rw-copy').onclick = () => copyText(code, null);
    };
    body.innerHTML = '<div class="grid g-1-2"><div>' + UI.card('Configuración', '<label class="xs faint" style="font-weight:600">Fuentes</label><div class="xm-checks" style="margin:6px 0 12px">' + DB.reviewIntegrations.map(i => '<label class="check"><input type="checkbox" data-rws="' + i.id + '"' + (rc.sources.includes(i.id) ? ' checked' : '') + (i.status === 'conectado' ? '' : ' disabled title="No conectado"') + '> ' + esc(i.name) + '</label>').join('') + '</div>' +
      UI.form([{ id: 'rw-min', label: 'Mínimo de estrellas a mostrar', type: 'select', col: 12, value: rc.minRating, options: [1, 2, 3, 4, 5] }, { id: 'rw-n', label: 'Cantidad', type: 'number', col: 6, min: 1, max: 12, value: rc.count }, { id: 'rw-l', label: 'Diseño', type: 'select', col: 6, value: rc.layout, options: [['lista', 'Lista'], ['carrusel', 'Cuadrícula']] }]) + (canReply() ? '<button class="btn sm primary" id="rw-save" style="margin-top:12px">' + ic('check') + 'Guardar configuración</button>' : '')) + '</div><div class="stack" id="rw-out"></div></div>';
    const read = () => { rc.sources = Array.from(body.querySelectorAll('[data-rws]:checked')).map(i => i.dataset.rws); rc.minRating = +body.querySelector('#rw-min').value; rc.count = Math.max(1, Math.min(12, +body.querySelector('#rw-n').value || 3)); rc.layout = body.querySelector('#rw-l').value; draw(); };
    body.querySelectorAll('[data-rws],#rw-min,#rw-n,#rw-l').forEach(i => i.onchange = read);
    const sv = body.querySelector('#rw-save'); if (sv) sv.onclick = () => { read(); Audit.log('Widget de reseñas', 'CONFIG', 'editar', '', JSON.stringify(rc)); Store.save(); UI.toast('Configuración del widget de reseñas guardada.'); };
    draw();
  }

  /* ======================================================================
     5) WIDGET DE RESERVA (motor compartido por la vista previa y la ruta pública)
     ====================================================================== */
  const WL = {
    es: { from: 'Desde', pp: 'por persona', date: 'Elija la fecha', pax: 'Pasajeros', lodging: 'Alojamiento', addons: 'Adicionales', preview: 'Resumen de su reserva', adt: 'Adultos', chd: 'Niños', inf: 'Infantes', years: 'años', free: 'no paga', lodgingOpt: 'Incluir alojamiento', nights: 'noche(s)', rooms: 'habitaciones', total: 'Total', remove: 'Quitar', restore: 'Restaurar', payNow: 'Paga hoy', balance: 'Saldo', due: 'vence', cont: 'Continuar reserva', pick: 'Seleccione una fecha disponible en el calendario.', legendOk: 'Disponible', legendLow: 'Últimos cupos', legendClosed: 'Ocupado / cerrado', legendSold: 'Agotado', legendNa: 'No disponible', secure: 'Pago seguro · El precio final lo confirma el servidor', powered: 'Motor de reservas Qhapaq', ratesNote: 'Tipo de cambio referencial; se cobra en', modes: { total: 'Pago total', adelanto: 'Adelanto', pagar_despues: 'Reservar ahora, pagar después' }, perPax: 'por pasajero', sample: 'Reseñas de ejemplo', none: 'Sin adicionales seleccionados', mon: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'], wd: ['D', 'L', 'M', 'M', 'J', 'V', 'S'], avail: 'Disponible', closed: 'Ocupado', sold: 'Agotado', fromTo: ['del', 'al'], hotel: 'Hotel', noLodging: 'Sin alojamiento en esta ciudad' },
    en: { from: 'From', pp: 'per person', date: 'Choose your date', pax: 'Travellers', lodging: 'Accommodation', addons: 'Add-ons', preview: 'Booking summary', adt: 'Adults', chd: 'Children', inf: 'Infants', years: 'years', free: 'free', lodgingOpt: 'Include accommodation', nights: 'night(s)', rooms: 'rooms', total: 'Total', remove: 'Remove', restore: 'Restore', payNow: 'Pay today', balance: 'Balance', due: 'due', cont: 'Continue booking', pick: 'Select an available date in the calendar.', legendOk: 'Available', legendLow: 'Last seats', legendClosed: 'Closed', legendSold: 'Sold out', legendNa: 'Not available', secure: 'Secure payment · Final price confirmed by the server', powered: 'Qhapaq booking engine', ratesNote: 'Reference exchange rate; charged in', modes: { total: 'Full payment', adelanto: 'Deposit', pagar_despues: 'Book now, pay later' }, perPax: 'per traveller', sample: 'Sample reviews', none: 'No add-ons selected', mon: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], avail: 'Available', closed: 'Closed', sold: 'Sold out', fromTo: ['from', 'to'], hotel: 'Hotel', noLodging: 'No accommodation in this city' }
  };
  const safeColor = (c) => { c = String(c || '').trim(); if (/^[0-9a-fA-F]{6}$/.test(c)) c = '#' + c; return /^#[0-9a-fA-F]{6}$/.test(c) ? c : null; };
  function widgetState(cfg) {
    const p = Q.product(cfg.product); const lang = cfg.lang === 'en' ? 'en' : 'es';
    const curs = BE.on('R-MULTICURRENCY', p) ? BE.currencies() : [BE.currency(BE.cfg().baseCurrency || 'PEN')];
    const cur = curs.some(c => c.code === cfg.currency) ? cfg.currency : curs[0].code;
    const first = p ? BE.nextAvailable(p, 2) : null; const d0 = first || T();
    return { pid: p ? p.id : null, lang, cur, date: first, ym: [+d0.slice(0, 4), +d0.slice(5, 7) - 1], pax: { adt: 2, chd: 0, inf: 0 }, addons: {}, lodgingOn: false, lodging: {}, removed: [], mode: null, cfg };
  }
  function widgetSel(W) {
    return { date: W.date, pax: W.pax, addons: Object.entries(W.addons).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })), lodging: W.lodgingOn ? Object.entries(W.lodging).filter(([, s]) => s.hotelId).map(([legId, s]) => ({ legId, hotelId: s.hotelId, rooms: Object.entries(s.rooms || {}).filter(([, q]) => q > 0).map(([type, qty]) => ({ type, qty })) })) : [], currency: W.cur, paymentMode: W.mode, removed: W.removed, channel: 'Directo' };
  }
  function autoRooms(W, p) {
    const need = W.pax.adt + W.pax.chd;
    (p.accommodation.legs || []).forEach(l => { const s = W.lodging[l.id] || (W.lodging[l.id] = {}); if (s.manual) return; const h = l.hotels.find(x => x.id === s.hotelId) || l.hotels[0]; s.hotelId = h.id; const dbl = h.rooms.find(r => r.type === 'Doble'); const sgl = h.rooms.find(r => r.type === 'Simple'); s.rooms = {}; if (dbl) { s.rooms.Doble = Math.floor(need / 2); if (need % 2) { if (sgl) s.rooms.Simple = 1; else s.rooms.Doble += 1; } } else s.rooms[h.rooms[0].type] = Math.ceil(need / h.rooms[0].capacity); });
  }
  /* Dibuja el widget en host. opts.embedded = vista previa dentro del back-office. */
  function renderWidget(host, W, opts) {
    opts = opts || {}; const p = Q.product(W.pid); const L = WL[W.lang];
    if (!p) { host.innerHTML = '<div class="qw"><div class="qw-sec">' + UI.empty(W.lang === 'en' ? 'Product not available.' : 'Producto no disponible.', 'box') + '</div></div>'; return; }
    const color = safeColor(W.cfg.theme); const radius = Math.max(0, Math.min(24, +W.cfg.radius || 10));
    const pr = BE.paxRules(p); const multi = BE.on('R-MULTICURRENCY', p); const curs = multi ? BE.currencies() : [BE.currency(BE.cfg().baseCurrency || 'PEN')];
    const hasLodging = BE.on('R-LODGING', p) && p.accommodation && (p.accommodation.legs || []).length;
    const addons = BE.on('R-ADDONS', p) ? (p.addons || []) : [];
    if (!pr.infantAllowed || pr.infantAllowed === false) W.pax.inf = 0;
    const seats = W.pax.adt + W.pax.chd + (pr.infantPays ? W.pax.inf : 0);
    if (W.date) { const s = BE.dayStatus(p, W.date, seats); if (s.status !== 'disponible') W.dateWarn = s.label; else W.dateWarn = null; }
    const q = BE.quote(p, widgetSel(W)); if (!W.mode || !q.modes.includes(W.mode)) W.mode = q.modes[0];
    const q2 = W.mode === q.paymentMode ? q : BE.quote(p, widgetSel(W));
    const fm = (n) => BE.fmt(n, q2.currency);
    const fromQ = BE.quote(p, { pax: { adt: 1, chd: 0, inf: 0 }, currency: W.cur, date: W.date || BE.nextAvailable(p, 1) });
    const [y, m0] = W.ym; const month = BE.month(p, y, m0, seats); const firstWd = new Date(y, m0, 1).getDay();
    const cls = (d) => d.status === 'disponible' ? (d.left != null && d.left <= 4 ? 'low' : 'ok') : d.status === 'cerrado' ? 'closed' : ['agotado', 'sin_cupo'].includes(d.status) ? 'sold' : '';
    const minYM = [+T().slice(0, 4), +T().slice(5, 7) - 1]; const atMin = y === minYM[0] && m0 === minYM[1];
    const rv = W.cfg.reviews ? (DB.externalReviews || []).filter(r => r.productId === p.id) : [];
    const rvAvg = rv.length ? sum(rv, 'rating') / rv.length : 0;
    const step = (k, val, min, max) => '<span class="qw-step"><button type="button" data-st="' + k + '" data-d="-1"' + (val <= min ? ' disabled' : '') + ' aria-label="−">−</button><span>' + val + '</span><button type="button" data-st="' + k + '" data-d="1"' + (val >= max ? ' disabled' : '') + ' aria-label="+">+</button></span>';
    let n = 0; const num = () => '<span class="qw-n">' + (++n) + '</span>';
    const valid = BE.validatePax(p, W.pax);
    const dayOk = W.date && !W.dateWarn;
    const pname = W.lang === 'en' && p.nameEn ? p.nameEn : p.name;
    host.innerHTML = '<div class="qw" style="' + (color ? '--qw-accent:' + color + ';' : '') + '--qw-r:' + radius + 'px">' +
      '<div class="qw-h"><div style="min-width:0;flex:1 1 220px"><h3>' + esc(pname) + '</h3><div class="qw-from" style="margin-top:4px">' + L.from + ' <b>' + esc(BE.fmt(fromQ.lines.length ? fromQ.lines[0].unit : 0, fromQ.currency)) + '</b> ' + L.pp + (rv.length ? ' · ' + stars(rvAvg, 12) + ' ' + fmtN(rvAvg, 1) + ' (' + rv.length + ') <span class="badge b-warn">' + L.sample + '</span>' : '') + '</div></div>' +
      '<div class="qw-tools">' + (curs.length > 1 ? '<select class="input" data-w="cur" aria-label="Moneda">' + curs.map(c => '<option' + (c.code === W.cur ? ' selected' : '') + '>' + c.code + '</option>').join('') + '</select>' : '') + '<select class="input" data-w="lang" aria-label="Idioma"><option value="es"' + (W.lang === 'es' ? ' selected' : '') + '>ES</option><option value="en"' + (W.lang === 'en' ? ' selected' : '') + '>EN</option></select></div></div>' +
      /* Calendario */
      '<div class="qw-sec"><h4>' + num() + L.date + '</h4><div class="qw-cal-h"><button type="button" class="btn xs ghost" data-mv="-1"' + (atMin ? ' disabled' : '') + ' aria-label="Mes anterior">' + ic('chevronLeft') + '</button><span>' + L.mon[m0] + ' ' + y + '</span><button type="button" class="btn xs ghost" data-mv="1" aria-label="Mes siguiente">' + ic('chevronRight') + '</button></div>' +
      '<div class="qw-cal">' + L.wd.map(d => '<div class="wd">' + d + '</div>').join('') + '<div></div>'.repeat(firstWd) + month.map(d => { const c = cls(d); const click = c === 'ok' || c === 'low'; return '<button type="button" class="qw-d ' + c + (d.date === W.date ? ' sel' : '') + '"' + (click ? ' data-day="' + d.date + '"' : ' disabled') + ' title="' + esc(d.label + (d.note ? ' · ' + d.note : '')) + '">' + d.day + '<small>' + (c === 'low' && d.left ? d.left : '') + '</small></button>'; }).join('') + '</div>' +
      '<div class="qw-legend"><span><i style="background:var(--ok-soft);border:1px solid var(--ok)"></i>' + L.legendOk + '</span><span><i style="background:var(--warn-soft);border:1px solid var(--warn)"></i>' + L.legendLow + '</span><span><i style="background:var(--bad-soft);border:1px solid var(--bad)"></i>' + L.legendClosed + '</span><span><i style="background:var(--mute-soft);border:1px solid var(--line)"></i>' + L.legendSold + '</span></div>' +
      (BE.on('R-AVAIL-RANGES', p) && BE.rangesSummary(p).length ? '<div class="qw-ranges">' + BE.rangesSummary(p).filter(r => r.to >= T()).slice(0, 6).map(r => '<span><b>' + ({ disponible: L.avail, cerrado: L.closed, agotado: L.sold })[r.status] + '</b> ' + L.fromTo[0] + ' ' + dateShort(r.from) + ' ' + L.fromTo[1] + ' ' + dateShort(r.to) + (r.note && W.lang === 'es' ? ' · ' + esc(r.note) : '') + '</span>').join('') + '</div>' : '') +
      (W.date ? '<div class="small" style="margin-top:8px"><b>' + esc(date(W.date)) + '</b>' + (W.dateWarn ? ' · <span style="color:var(--bad)">' + esc(W.dateWarn) + '</span>' : '') + '</div>' : '') + '</div>' +
      /* Pasajeros */
      '<div class="qw-sec"><h4>' + num() + L.pax + '</h4><div class="qw-pax">' +
      '<div class="qw-paxr"><span>' + L.adt + ' <span class="xs faint">(' + pr.adultMinAge + '+ ' + L.years + ')</span></span>' + step('adt', W.pax.adt, 0, 30) + '</div>' +
      (pr.maxChildrenPerAdult > 0 ? '<div class="qw-paxr"><span>' + L.chd + ' <span class="xs faint">(' + pr.childMinAge + '–' + pr.childMaxAge + ' ' + L.years + (pr.childPays ? '' : ' · ' + L.free) + ')</span></span>' + step('chd', W.pax.chd, 0, 20) + '</div>' : '') +
      (pr.infantAllowed !== false ? '<div class="qw-paxr"><span>' + L.inf + ' <span class="xs faint">(0–' + pr.infantMaxAge + ' ' + L.years + (pr.infantPays ? '' : ' · ' + L.free) + ')</span></span>' + step('inf', W.pax.inf, 0, 10) + '</div>' : '') +
      '</div>' + (pr.note && W.lang === 'es' ? '<div class="xs faint" style="margin-top:8px">' + esc(pr.note) + '</div>' : '') + (valid.errors.length ? '<div class="xs" style="color:var(--bad);margin-top:8px">' + valid.errors.map(esc).join('<br>') + '</div>' : '') + '</div>' +
      /* Alojamiento */
      (hasLodging ? '<div class="qw-sec"><h4>' + num() + L.lodging + '</h4><label class="switch"><input type="checkbox" data-w="lodgingOn"' + (W.lodgingOn ? ' checked' : '') + '> ' + L.lodgingOpt + '</label>' + (p.accommodation.note && W.lang === 'es' ? '<div class="xs faint" style="margin-top:6px">' + esc(p.accommodation.note) + '</div>' : '') +
        (W.lodgingOn ? p.accommodation.legs.map(l => { const s = W.lodging[l.id] || {}; const h = l.hotels.find(x => x.id === s.hotelId); return '<div class="qw-leg"><div class="row between small"><b>' + esc(l.city) + '</b><span class="faint">' + l.nights + ' ' + L.nights + '</span></div><select class="input" data-lh="' + l.id + '" style="margin-top:6px;width:100%"><option value="">' + L.noLodging + '</option>' + l.hotels.map(x => '<option value="' + x.id + '"' + (x.id === s.hotelId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' + (h ? '<div class="stack" style="gap:6px;margin-top:8px">' + h.rooms.map(rm => '<div class="qw-paxr small"><span>' + esc(rm.type) + ' <span class="xs faint">(' + rm.capacity + ' pax · ' + esc(BE.fmt(BE.convert(rm.price, p.accommodation.currency, W.cur), W.cur)) + ')</span></span>' + step('room:' + l.id + ':' + rm.type, (s.rooms || {})[rm.type] || 0, 0, 10) + '</div>').join('') + '</div>' : '') + '</div>'; }).join('') + '<div class="small" style="margin-top:8px"><b>' + q2.rooms + '</b> ' + L.rooms + ' · <b>' + q2.nights + '</b> ' + L.nights + '</div>' : '') + '</div>' : '') +
      /* Adicionales */
      (addons.length ? '<div class="qw-sec"><h4>' + num() + L.addons + '</h4>' + addons.map(a => '<div class="qw-add"><div style="min-width:0"><div class="small">' + esc(a.name) + '</div><div class="xs faint">' + esc(BE.fmt(BE.convert(a.price, a.currency, W.cur), W.cur)) + ' ' + (a.per === 'pax' ? L.perPax : '') + '</div></div>' + step('add:' + a.id, W.addons[a.id] || 0, 0, 30) + '</div>').join('') + '</div>' : '') +
      /* Previsualización */
      '<div class="qw-sec"><h4>' + num() + L.preview + '</h4>' + (dayOk ? q2.lines.filter(l => l.kind !== 'info').map(l => '<div class="qw-line' + (l.removed ? ' rm' : '') + '"><div style="min-width:0"><div class="small">' + esc(l.label) + '</div>' + (l.removable ? '<button type="button" class="qw-link" data-rm="' + esc(l.key) + '">' + (l.removed ? L.restore : L.remove) + '</button>' : '') + '</div><b class="small" style="white-space:nowrap">' + esc(fm(l.amount)) + '</b></div>').join('') +
        q2.adjustments.map(a => '<div class="qw-line"><span class="small">' + esc(a.label) + '</span><b class="small" style="white-space:nowrap">' + esc(fm(a.amount)) + '</b></div>').join('') +
        '<div class="qw-tot"><span>' + L.total + '</span><span>' + esc(fm(q2.total)) + '</span></div>' +
        (q2.modes.length > 1 ? '<div class="qw-modes">' + q2.modes.map(m => '<label><input type="radio" name="qw-mode-' + (opts.embedded ? 'e' : 'f') + '" data-mode="' + m + '"' + (m === q2.paymentMode ? ' checked' : '') + '> ' + L.modes[m] + (m === 'adelanto' ? ' (' + (p.payment && p.payment.depositPct != null ? p.payment.depositPct : BE.param('R-DEPOSIT', 'pct', p)) + ' %)' : '') + '</label>').join('') + '</div>' : '') +
        (q2.paymentMode !== 'total' ? '<div class="small" style="margin-top:8px">' + L.payNow + ': <b>' + esc(fm(q2.deposit)) + '</b> · ' + L.balance + ': ' + esc(fm(q2.balance)) + (q2.balanceDue ? ' (' + L.due + ' ' + date(q2.balanceDue) + ')' : '') + '</div>' : '') +
        (q2.warnings.length ? '<div class="xs" style="color:var(--warn);margin-top:8px">' + q2.warnings.map(esc).join('<br>') + '</div>' : '') +
        (multi && !(BE.cfg().chargeCurrencies || []).includes(W.cur) ? '<div class="xs faint" style="margin-top:8px">' + L.ratesNote + ' ' + esc((BE.cfg().chargeCurrencies || ['PEN']).join(' / ')) + '.</div>' : '')
        : '<div class="small muted">' + L.pick + '</div>') +
      '<button type="button" class="qw-btn" data-go' + (dayOk && q2.ok && valid.ok && W.pax.adt + W.pax.chd > 0 ? '' : ' disabled') + '>' + L.cont + '</button></div>' +
      '<div class="qw-foot"><span>' + ic('lock').replace('<svg', '<svg width="11" height="11" style="vertical-align:-1px"') + ' ' + L.secure + '</span><span>' + L.powered + '</span></div></div>';
    const redraw = () => renderWidget(host, W, opts);
    host.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { W.date = b.dataset.day; W.removed = []; redraw(); });
    host.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { let [yy, mm] = W.ym; mm += +b.dataset.mv; if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; } W.ym = [yy, mm]; redraw(); });
    host.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
      const k = b.dataset.st, d = +b.dataset.d;
      if (k.startsWith('add:')) { const id = k.slice(4); W.addons[id] = Math.max(0, (W.addons[id] || 0) + d); W.removed = W.removed.filter(x => x !== 'addon-' + id); }
      else if (k.startsWith('room:')) { const [, leg, type] = k.split(':'); const s = W.lodging[leg]; s.manual = true; s.rooms = s.rooms || {}; s.rooms[type] = Math.max(0, (s.rooms[type] || 0) + d); W.removed = W.removed.filter(x => !x.startsWith('lodge-' + leg)); }
      else { W.pax[k] = Math.max(0, W.pax[k] + d); if (W.lodgingOn) autoRooms(W, p); }
      redraw();
    });
    const sel = (k) => host.querySelector('[data-w="' + k + '"]');
    if (sel('cur')) sel('cur').onchange = (e) => { W.cur = e.target.value; redraw(); };
    sel('lang').onchange = (e) => { W.lang = e.target.value; redraw(); };
    if (sel('lodgingOn')) sel('lodgingOn').onchange = (e) => { W.lodgingOn = e.target.checked; if (W.lodgingOn) autoRooms(W, p); W.removed = W.removed.filter(x => !x.startsWith('lodge-')); redraw(); };
    host.querySelectorAll('[data-lh]').forEach(s => s.onchange = () => { const l = p.accommodation.legs.find(x => x.id === s.dataset.lh); const st = W.lodging[l.id] || (W.lodging[l.id] = {}); st.hotelId = s.value || null; st.manual = true; st.rooms = {}; const h = l.hotels.find(x => x.id === s.value); if (h) { const need = W.pax.adt + W.pax.chd; const dbl = h.rooms.find(r => r.type === 'Doble') || h.rooms[0]; st.rooms[dbl.type] = Math.max(1, Math.ceil(need / dbl.capacity)); } redraw(); });
    host.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const k = b.dataset.rm; W.removed = W.removed.includes(k) ? W.removed.filter(x => x !== k) : W.removed.concat(k); redraw(); });
    host.querySelectorAll('[data-mode]').forEach(i => i.onchange = () => { W.mode = i.dataset.mode; redraw(); });
    const go = host.querySelector('[data-go]'); if (go) go.onclick = () => continueBooking(W, p, q2, opts);
  }
  /* Traspaso al checkout del sitio: usa el carrito global si sitio.js lo expone; si no, DB.widgetHandoff. */
  function continueBooking(W, p, q, opts) {
    const sel = widgetSel(W);
    const rulesApplied = BE.rules().filter(r => BE.on(r.id, p) && (r.scope || []).includes('Widget')).map(r => r.id);
    const h = { id: nextId(DB.widgetHandoff || [], 'WHO-', 5), createdAt: nowStr(), productId: p.id, date: W.date, pax: Object.assign({}, W.pax), addons: sel.addons, lodging: sel.lodging, removed: W.removed.slice(), currencyDisplay: W.cur, fxRate: BE.currency(W.cur).rate, paymentMode: q.paymentMode, lang: W.lang, source: opts.embedded ? 'vista previa (' + (W.cfg.domain || 'back-office') + ')' : 'widget ' + (W.cfg.domain || 'directo'), status: 'pendiente',
      quote: { lines: q.lines.filter(l => !l.removed), adjustments: q.adjustments, total: q.total, deposit: q.deposit, balance: q.balance, balanceDue: q.balanceDue, depositPct: q.depositPct, rooms: q.rooms, nights: q.nights, currency: q.currency }, rulesApplied };
    const Cart = window.SiteCart || (window.Sitio && window.Sitio.cart);
    if (!opts.embedded && Cart && typeof Cart.add === 'function') {
      try { Cart.add({ productId: p.id, date: W.date, pax: h.pax, addons: sel.addons, lodging: sel.lodging, removed: h.removed, currency: W.cur, paymentMode: q.paymentMode, source: 'widget' }); h.status = 'en_carrito'; DB.widgetHandoff.unshift(h); Store.save(); App.go('#/sitio/checkout'); return; } catch (e) { /* si el carrito falla, se usa el traspaso */ }
    }
    DB.widgetHandoff.unshift(h); if (DB.widgetHandoff.length > 50) DB.widgetHandoff.length = 50; Store.save();
    try { localStorage.setItem('qhapaq_widget_handoff', h.id); } catch (e) { /* sin almacenamiento */ }
    const L = WL[W.lang]; const fm = (n) => BE.fmt(n, q.currency);
    UI.modal({ title: L.preview, size: 'md', sub: (W.lang === 'en' ? 'Reference ' : 'Referencia ') + h.id,
      body: '<div class="small"><b>' + esc(p.name) + '</b><div class="muted">' + esc(date(W.date)) + ' · ' + W.pax.adt + ' ' + L.adt.toLowerCase() + (W.pax.chd ? ', ' + W.pax.chd + ' ' + L.chd.toLowerCase() : '') + (W.pax.inf ? ', ' + W.pax.inf + ' ' + L.inf.toLowerCase() : '') + (q.rooms ? ' · ' + q.rooms + ' ' + L.rooms + ', ' + q.nights + ' ' + L.nights : '') + '</div></div>' +
        '<div style="margin-top:10px">' + h.quote.lines.filter(l => l.kind !== 'info').map(l => '<div class="row between small" style="flex-wrap:nowrap;gap:10px;padding:4px 0;border-top:1px solid var(--line-2)"><span>' + esc(l.label) + '</span><b style="white-space:nowrap">' + esc(fm(l.amount)) + '</b></div>').join('') + q.adjustments.map(a => '<div class="row between small" style="flex-wrap:nowrap;padding:4px 0"><span>' + esc(a.label) + '</span><b>' + esc(fm(a.amount)) + '</b></div>').join('') + '<div class="row between" style="padding-top:8px;border-top:2px solid var(--line);font-weight:700"><span>' + L.total + '</span><span>' + esc(fm(q.total)) + '</span></div>' + (q.paymentMode !== 'total' ? '<div class="small" style="margin-top:6px">' + L.payNow + ': <b>' + esc(fm(q.deposit)) + '</b></div>' : '') + '</div>' +
        (opts.embedded ? UI.alert('info', 'Vista previa: en el sitio del cliente este botón abre el checkout del motor (#/sitio/checkout) con la selección traspasada (' + h.id + ').') : '<p class="xs faint" style="margin-top:12px">' + (W.lang === 'en' ? 'Your selection is saved; in the next step you will enter traveller details, pick-up point and payment.' : 'Su selección quedó guardada; en el siguiente paso ingresará los datos de los pasajeros, el punto de recojo y el pago.') + '</p>'),
      actions: [{ label: W.lang === 'en' ? 'Back' : 'Volver' }].concat(opts.embedded ? [] : [{ label: W.lang === 'en' ? 'Go to checkout' : 'Ir al checkout', cls: 'primary', icon: 'arrowRight', onClick: () => { App.go('#/sitio/checkout'); } }]) });
  }
  function parseWidgetParams(params) {
    const raw = (params || []).join('/'); const [pid, qs] = raw.split('?'); const o = {};
    (qs || '').split('&').filter(Boolean).forEach(kv => { const i = kv.indexOf('='); const k = i < 0 ? kv : kv.slice(0, i); let v = i < 0 ? '' : kv.slice(i + 1); try { v = decodeURIComponent(v); } catch (e) { } o[k] = v; });
    return { product: pid || o.product || '', lang: (o.lang || 'es').toLowerCase(), currency: (o.currency || 'USD').toUpperCase(), theme: o.theme || '', radius: o.radius || 10, reviews: o.reviews !== '0' && o.reviews !== 'false', domain: o.domain || '' };
  }
  const WIDGET_STATE = {};
  App.register('sitio/widget', (el, params) => {
    seed();
    const cfg = parseWidgetParams(params); const p = Q.product(cfg.product);
    document.title = (p ? p.name + ' · ' : '') + 'Reserva en línea | Andes Horizonte Travel';
    if (!p || p.status !== 'ACTIVE' || !(p.flags && p.flags.ecommerce)) {
      const list = (DB.products || []).filter(x => x.status === 'ACTIVE' && x.flags && x.flags.ecommerce && (x.availability || (x.departures || []).length));
      el.innerHTML = '<div class="qw-full"><div class="qw-full-in"><div class="card"><div class="card-b">' + (cfg.product ? UI.alert('warn', 'El producto ' + esc(cfg.product) + ' no está disponible para venta en línea.') : '') + '<h2 style="margin:10px 0">Reserva en línea</h2><div class="list">' + list.map(x => '<a class="list-item" href="#/sitio/widget/' + x.id + '?lang=' + cfg.lang + '&currency=' + cfg.currency + '"><div class="grow"><b class="small">' + esc(x.name) + '</b><div class="xs faint">' + esc(x.short || '') + '</div></div>' + ic('chevronRight') + '</a>').join('') + '</div></div></div></div></div>';
      return;
    }
    const key = JSON.stringify(cfg); let W = WIDGET_STATE[key]; if (!W || !Q.product(W.pid)) { W = widgetState(cfg); WIDGET_STATE[key] = W; }
    el.innerHTML = '<div class="qw-full"><div class="qw-full-in"><div class="qw-bar"><span>' + ic('logo').replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px"') + ' <b>' + esc(DB.tenant.short || DB.tenant.name) + '</b> · ' + (W.lang === 'en' ? 'Online booking' : 'Reserva en línea') + '</span><a href="#/sitio">' + (W.lang === 'en' ? 'Visit our website' : 'Ir al sitio web') + '</a></div><div id="qw-host"></div></div></div>';
    renderWidget(el.querySelector('#qw-host'), W, { embedded: false });
  });

  /* ======================================================================
     6) INTEGRACIÓN CON CUALQUIER CMS  ·  #/canales/integracion-web
     ====================================================================== */
  const IW = { tab: 'configurador' };
  const METHODS = [
    ['webcomponent', 'Widget embebible (Web Component)', 'Una etiqueta script y un elemento <qhapaq-booking>. Funciona en cualquier CMS o HTML que permita pegar código. Hereda el ancho del contenedor, usa Shadow DOM (no choca con los estilos del sitio) y emite eventos al sitio anfitrión.', 'Recomendado para la mayoría de sitios'],
    ['iframe', 'Iframe', 'Página alojada por Qhapaq dentro de un marco. Aislamiento total y compatible con constructores que no permiten scripts (algunos planes de Wix o Squarespace). El alto se ajusta con un script opcional (postMessage).', 'Máxima compatibilidad'],
    ['wordpress', 'Plugin de WordPress', 'Plugin «Qhapaq Booking» con ajustes (clave pública, idioma, moneda, color) y shortcodes o bloques de Gutenberg/Elementor. Compatible con WPML/Polylang para el idioma.', 'Sitios WordPress'],
    ['api', 'API headless', 'Endpoints públicos de catálogo, disponibilidad y cotización para construir la interfaz propia en Strapi, Contentful, Drupal, Webflow, Wix Velo o Shopify (Hydrogen). El pago y la confirmación siempre pasan por el checkout del motor.', 'Equipos con desarrollador']
  ];
  const iwCfg = () => { const c = DB.widgetConfig; c.draft = c.draft || clone(c.defaults); return c.draft; };
  function genCode(method, d) {
    const c = DB.widgetConfig; const theme = safeColor(d.theme) || '#0A3A73';
    const attrs = d.mode === 'catalogo' ? 'category="' + d.category + '"' : 'product="' + d.product + '"';
    if (method === 'webcomponent') return '<!-- Qhapaq · motor de reservas (Web Component) -->\n<script src="' + c.cdn + '/qhapaq-widget.js" type="module" async></script>\n<' + (d.mode === 'catalogo' ? 'qhapaq-catalog' : 'qhapaq-booking') + '\n  tenant="' + c.tenantSlug + '"\n  ' + attrs + '\n  lang="' + d.lang + '"\n  currency="' + d.currency + '"\n  theme="' + theme + '"\n  radius="' + d.radius + '"\n  reviews="' + (d.reviews ? 'true' : 'false') + '"\n  key="' + c.publicKey + '">\n</' + (d.mode === 'catalogo' ? 'qhapaq-catalog' : 'qhapaq-booking') + '>';
    if (method === 'iframe') return '<iframe\n  src="' + c.host + '/widget/' + (d.mode === 'catalogo' ? 'catalogo?category=' + encodeURIComponent(d.category) + '&' : d.product + '?') + 'lang=' + d.lang + '&currency=' + d.currency + '&theme=' + theme.slice(1) + '&radius=' + d.radius + '&reviews=' + (d.reviews ? 1 : 0) + '&key=' + c.publicKey + '"\n  title="Reserva en línea" loading="lazy" allow="payment"\n  style="width:100%;min-height:760px;border:0">\n</iframe>\n<!-- Opcional: ajusta el alto automáticamente -->\n<script src="' + c.cdn + '/iframe-resizer.js" async></script>';
    if (method === 'wordpress') return '// 1) Plugins > Añadir nuevo > Subir «qhapaq-booking.zip» y activar\n// 2) Ajustes > Qhapaq: clave pública ' + c.publicKey + ', idioma y moneda por defecto\n// 3) Pegue el shortcode en una página o use el bloque «Qhapaq Booking»\n\n' + (d.mode === 'catalogo' ? '[qhapaq_catalog category="' + d.category + '" lang="' + d.lang + '" currency="' + d.currency + '"]' : '[qhapaq_booking product="' + d.product + '" lang="' + d.lang + '" currency="' + d.currency + '" theme="' + theme + '" radius="' + d.radius + '" reviews="' + (d.reviews ? 'yes' : 'no') + '"]') + '\n\n// Otros shortcodes\n[qhapaq_catalog category="Cultural"]\n[qhapaq_reviews min_rating="4" count="3"]';
    const pid = d.mode === 'catalogo' ? 'PRD-011' : d.product; const month = (BE.nextAvailable(Q.product(pid) || {}, 2) || T()).slice(0, 7);
    return '# Catálogo y ficha\ncurl -H "X-Qhapaq-Key: ' + c.publicKey + '" \\\n  "' + c.host + '/api/v1/public/products?category=' + encodeURIComponent(d.category) + '&lang=' + d.lang + '"\ncurl -H "X-Qhapaq-Key: ' + c.publicKey + '" "' + c.host + '/api/v1/public/products/' + pid + '"\n\n# Disponibilidad del mes (estados por día: BE.month)\ncurl -H "X-Qhapaq-Key: ' + c.publicKey + '" \\\n  "' + c.host + '/api/v1/public/products/' + pid + '/availability?month=' + month + '&seats=2"\n\n# Cotización (BE.quote) y carrito\ncurl -X POST -H "X-Qhapaq-Key: ' + c.publicKey + '" -H "Content-Type: application/json" \\\n  "' + c.host + '/api/v1/public/quote" \\\n  -d \'{"product":"' + pid + '","date":"' + month + '-10","pax":{"adt":2,"chd":1,"inf":0},"currency":"' + d.currency + '"}\'\ncurl -X POST -H "X-Qhapaq-Key: ' + c.publicKey + '" -H "Idempotency-Key: <uuid>" "' + c.host + '/api/v1/public/carts" -d \'{…selección…}\'\n# → { "checkout_url": "' + c.host + '/checkout/CART-…" }';
  }
  App.register('canales/integracion-web', (el) => {
    seed();
    const c = DB.widgetConfig; const ver = c.domains.filter(x => x.status === 'verificado').length;
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Integración web y CMS', crumbs: [['Canales'], ['Integración web y CMS']],
      subtitle: 'Inserte el motor de reservas en cualquier sitio: widget embebible, iframe, plugin de WordPress o API headless. Mismas reglas, precios y disponibilidad que el back-office (BookingEngine).',
      actions: '<a class="btn" href="#/sitio/widget/' + esc(iwCfg().product) + '?lang=' + iwCfg().lang + '&currency=' + iwCfg().currency + '&theme=' + (safeColor(iwCfg().theme) || '#0A3A73').slice(1) + '" target="_self">' + ic('eye') + 'Abrir widget a pantalla completa</a>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Clave pública del widget', value: '<span class="mono" style="font-size:.95rem">' + esc(c.publicKey.slice(0, 13)) + '…</span>', sub: 'Solo lectura pública; no da acceso a datos', icon: 'key' }) + UI.kpi({ label: 'Dominios autorizados', value: ver + ' / ' + c.domains.length, sub: 'CORS y CSP frame-ancestors', icon: 'globe' }) + UI.kpi({ label: 'Traspasos al checkout', value: (DB.widgetHandoff || []).length, sub: 'Selecciones enviadas desde el widget', icon: 'cart' }) + UI.kpi({ label: 'Reglas activas en widget', value: BE.rules().filter(r => r.enabled && (r.scope || []).includes('Widget')).length, sub: 'Scope «Widget» del centro de reglas', icon: 'shield' }) + '</div>' +
      '<div id="iw-tabs" style="margin-top:16px"></div></div>';
    UI.tabs(el.querySelector('#iw-tabs'), [
      { id: 'configurador', label: 'Configurador y vista previa', render: iwConfigurator },
      { id: 'metodos', label: 'Métodos de integración', render: iwMethods },
      { id: 'dominios', label: 'Dominios y seguridad', count: c.domains.length, render: iwDomains },
      { id: 'webhooks', label: 'Eventos y webhooks', render: iwWebhooks }
    ], IW.tab, { onChange: (id) => { IW.tab = id; } });
  });
  function iwMethods(body) {
    const d = iwCfg();
    body.innerHTML = '<div class="grid g2">' + METHODS.map((m, i) => UI.card(String.fromCharCode(97 + i) + ') ' + esc(m[1]), '<p class="small muted" style="margin-top:0">' + esc(m[2]) + '</p><div style="margin-bottom:8px"><span class="tag">' + esc(m[3]) + '</span></div><pre class="xc-code">' + esc(genCode(m[0], d)) + '</pre>')).join('') + '</div>' +
      '<div style="margin-top:16px">' + UI.card('Guías rápidas por plataforma', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Plataforma</th><th>Método recomendado</th><th>Dónde se pega</th></tr></thead><tbody>' + [
        ['WordPress', 'Plugin + shortcode / bloque', 'Página o entrada > bloque «Qhapaq Booking» o shortcode'], ['Wix', 'Iframe (Embed HTML) o Web Component en Wix Studio', 'Agregar > Insertar código > Insertar HTML'], ['Webflow', 'Web Component', 'Elemento Embed dentro del layout'], ['Shopify', 'Web Component en sección personalizada o API headless (Hydrogen)', 'Tienda online > Temas > Personalizar > Liquid personalizado'],
        ['Squarespace', 'Iframe', 'Bloque de código'], ['Joomla / Drupal', 'Web Component o módulo HTML personalizado', 'Módulo / bloque de contenido HTML'], ['Strapi / Contentful', 'API headless', 'El front (Next.js, Nuxt, Astro) consume /api/v1/public'], ['HTML estático', 'Web Component', 'Antes de </body>']
      ].map(r => '<tr><td><b>' + r[0] + '</b></td><td class="small">' + r[1] + '</td><td class="small muted">' + r[2] + '</td></tr>').join('') + '</tbody></table></div>') + '</div>';
  }
  function iwConfigurator(body) {
    const d = iwCfg(); const c = DB.widgetConfig; const canEdit = can('channels.ecommerce.manage') || isAdmin();
    const prods = (DB.products || []).filter(p => p.status === 'ACTIVE' && p.flags && p.flags.ecommerce && (p.availability || (p.departures || []).length));
    const curs = BE.on('R-MULTICURRENCY') ? BE.currencies() : [BE.currency(BE.cfg().baseCurrency || 'PEN')]; if (!curs.some(x => x.code === d.currency)) d.currency = curs[0].code;
    const revOn = (DB.reviewIntegrations || []).some(i => i.status === 'conectado');
    const cats = Array.from(new Set(prods.map(p => p.category)));
    body.innerHTML = '<div class="grid g-1-2"><div class="stack">' + UI.card('Configuración', UI.form([
      { id: 'iw-m', label: 'Método', type: 'select', col: 12, value: d.method, options: METHODS.map(m => [m[0], m[1]]) },
      { id: 'iw-mode', label: 'Contenido', type: 'select', col: 12, value: d.mode, options: [['producto', 'Un producto (reserva directa)'], ['catalogo', 'Catálogo por categoría']] },
      d.mode === 'catalogo' ? { id: 'iw-cat', label: 'Categoría', type: 'select', col: 12, value: d.category, options: cats } : { id: 'iw-p', label: 'Producto', type: 'select', col: 12, value: d.product, options: prods.map(p => [p.id, p.id + ' · ' + p.name]) },
      { id: 'iw-l', label: 'Idioma', type: 'select', col: 6, value: d.lang, options: [['es', 'Español'], ['en', 'Inglés']] },
      { id: 'iw-c', label: 'Moneda', type: 'select', col: 6, value: d.currency, options: curs.map(x => x.code), hint: BE.on('R-MULTICURRENCY') ? '' : 'R-MULTICURRENCY inactiva' },
      { id: 'iw-t', label: 'Color principal (#RRGGBB)', col: 6, value: d.theme }, { id: 'iw-r', label: 'Radio de bordes (px)', type: 'number', col: 6, min: 0, max: 24, value: d.radius },
      { id: 'iw-rv', label: 'Mostrar reseñas (de ejemplo) del producto', type: 'switch', col: 12, value: d.reviews && revOn, disabled: !revOn, hint: revOn ? '' : 'Conecte una fuente en Reseñas externas' },
      { id: 'iw-dom', label: 'Dominio donde se insertará', type: 'select', col: 12, value: d.domain, options: c.domains.map(x => [x.domain, x.domain + (x.status === 'verificado' ? '' : ' (pendiente de verificar)')]) }
    ]) + '<div class="row" style="gap:8px;margin-top:12px"><button class="btn sm primary" id="iw-save"' + dis(canEdit, 'channels.ecommerce.manage') + '>' + ic('check') + 'Guardar como predeterminado</button></div>') +
      UI.card('Clave pública', '<div class="mono small" style="word-break:break-all">' + esc(c.publicKey) + '</div><div class="xs faint" style="margin-top:6px">Creada ' + datetime(c.keyCreatedAt) + ' · ' + esc(Q.userName(c.keyCreatedBy)) + '. Identifica al tenant y solo permite lectura de catálogo, disponibilidad y cotización desde dominios autorizados; no sirve para leer reservas ni datos de clientes.</div><button class="btn sm" id="iw-rot" style="margin-top:10px"' + dis(can('admin.api.manage'), 'admin.api.manage') + '>' + ic('refresh') + 'Regenerar clave</button>') +
      '</div><div class="stack">' + UI.card('Código para copiar', '<pre class="xc-code" id="iw-code"></pre><textarea id="iw-code-ta" class="input mono" rows="3" style="position:absolute;left:-9999px" aria-hidden="true" tabindex="-1"></textarea><div class="row" style="gap:8px;margin-top:10px"><button class="btn sm primary" id="iw-copy">' + ic('copy') + 'Copiar código</button><span class="xs faint" id="iw-dom-warn"></span></div>') +
      UI.card('Vista previa en vivo', '<div class="xs faint" style="margin-bottom:8px">Simulación del sitio del cliente (página tipo WordPress) con el widget insertado. Usa las reglas, precios y disponibilidad reales.</div><div class="xs-frame"><div class="xs-bar"><i></i><i></i><i></i><div class="xs-url" id="iw-url"></div></div><div class="xs-wph"><b>Blog de viajes · Andes Horizonte</b><nav><span>Inicio</span><span>Destinos</span><span>Guías</span><span>Contacto</span></nav></div><div class="xs-grid"><div class="xs-post"><h3>Circuito Perú Clásico: cómo reservar en línea</h3><p>Diez días entre Lima, Arequipa, Puno y Cusco. Elija la fecha, indique quiénes viajan, añada hoteles por ciudad y entradas a museos, y revise el resumen antes de pagar.</p><div id="iw-prev"></div></div><aside class="xs-side"><div><h5>Entradas recientes</h5>Qué llevar a Machu Picchu<br>Aclimatación en Puno<br>Arequipa en dos días</div><div><h5>Categorías</h5>Cultural · Aventura · Gastronomía</div></aside></div></div>') + '</div></div>';
    const read = () => { const f = UI.formData(body); d.method = f['iw-m']; const pm = d.mode; d.mode = f['iw-mode']; if (f['iw-p']) d.product = f['iw-p']; if (f['iw-cat']) d.category = f['iw-cat']; d.lang = f['iw-l']; d.currency = f['iw-c']; d.theme = f['iw-t']; d.radius = Math.max(0, Math.min(24, +f['iw-r'] || 0)); d.reviews = !!f['iw-rv']; d.domain = f['iw-dom']; return pm !== d.mode; };
    let W = null;
    const draw = () => {
      const code = genCode(d.method, d); body.querySelector('#iw-code').textContent = code; body.querySelector('#iw-code-ta').value = code;
      const dom = c.domains.find(x => x.domain === d.domain); body.querySelector('#iw-dom-warn').innerHTML = dom && dom.status !== 'verificado' ? '<span style="color:var(--warn)">El dominio ' + esc(d.domain) + ' aún no está verificado: el widget no cargará allí.</span>' : '';
      body.querySelector('#iw-url').textContent = 'https://' + (d.domain || 'sitio-del-cliente.pe') + '/circuito-peru-clasico/';
      const tIn = body.querySelector('#iw-t'); tIn.classList.toggle('err', !safeColor(d.theme));
      const prevHost = body.querySelector('#iw-prev');
      if (d.mode === 'catalogo') { const ps = prods.filter(p => p.category === d.category); prevHost.innerHTML = '<div class="qw" style="--qw-accent:' + (safeColor(d.theme) || 'var(--accent)') + ';--qw-r:' + d.radius + 'px"><div class="qw-h"><h3>' + (d.lang === 'en' ? 'Tours' : 'Tours y circuitos') + ' · ' + esc(d.category) + '</h3></div>' + ps.map(p => { const q = BE.quote(p, { pax: { adt: 1 }, currency: d.currency, date: BE.nextAvailable(p, 1) }); return '<div class="qw-sec row between" style="gap:10px"><div style="min-width:0"><b class="small">' + esc(p.name) + '</b><div class="xs faint">' + esc(p.short || '') + '</div></div><div style="text-align:right;white-space:nowrap"><div class="xs faint">' + WL[d.lang].from + '</div><b>' + esc(BE.fmt(q.lines.length ? q.lines[0].unit : 0, q.currency)) + '</b></div></div>'; }).join('') + '</div>'; return; }
      const cfgW = { product: d.product, lang: d.lang, currency: d.currency, theme: d.theme, radius: d.radius, reviews: d.reviews, domain: d.domain };
      if (!W || W.pid !== d.product) W = widgetState(cfgW); else { W.cfg = cfgW; W.lang = d.lang; if (W.cur !== d.currency) W.cur = d.currency; }
      renderWidget(prevHost, W, { embedded: true });
    };
    body.querySelectorAll('input,select').forEach(i => { if (i.closest('#iw-prev') || i.id === 'iw-code-ta') return; i.addEventListener(i.tagName === 'INPUT' && i.type !== 'checkbox' ? 'input' : 'change', Util.debounce(() => { if (read()) { iwConfigurator(body); return; } draw(); }, 150)); });
    body.querySelector('#iw-copy').onclick = () => copyText(body.querySelector('#iw-code-ta').value, body.querySelector('#iw-code-ta'));
    body.querySelector('#iw-save').onclick = () => { if (!canEdit) return; if (!safeColor(d.theme)) { UI.toast('El color debe tener el formato #RRGGBB.', 'bad'); return; } c.defaults = clone(d); Audit.log('Widget web', 'CONFIG', 'editar', '', JSON.stringify(d)); Store.save(); UI.toast('Configuración guardada como predeterminada del widget.'); };
    body.querySelector('#iw-rot').onclick = () => { if (!can('admin.api.manage')) { UI.toast('Requiere permiso admin.api.manage.', 'bad'); return; } UI.confirm({ title: 'Regenerar clave pública', danger: true, confirmLabel: 'Regenerar', reason: true, message: 'La clave actual dejará de funcionar en 24 h (periodo de gracia). Deberá actualizar el código en todos los sitios donde esté insertado el widget.', onConfirm: (why) => { const old = c.publicKey; c.publicKey = 'pk_live_ah_' + Math.random().toString(36).slice(2, 12); c.keyCreatedAt = nowStr(); c.keyCreatedBy = Auth.user.id; Audit.log('Widget web', 'CLAVE', 'regenerar_clave', old.slice(0, 12) + '…', c.publicKey.slice(0, 12) + '… · ' + why); Store.save(); UI.toast('Clave regenerada. La anterior expira en 24 h.'); App.render(); } }); };
    draw();
  }
  function iwDomains(body) {
    const c = DB.widgetConfig; const canEdit = can('channels.ecommerce.manage') || isAdmin(); const ver = c.domains.filter(x => x.status === 'verificado');
    body.innerHTML = '<div class="grid g-2-1"><div id="iw-dt"></div><div class="stack">' + UI.card('Cabeceras resultantes', '<div class="xs faint" style="margin-bottom:6px">Las genera el backend por tenant a partir de los dominios verificados.</div><pre class="xc-code">' + esc('Access-Control-Allow-Origin: <origen verificado que hace la petición>\nVary: Origin\nContent-Security-Policy: frame-ancestors \'self\' ' + ver.map(x => 'https://' + x.domain).join(' ') + ';') + '</pre>') +
      UI.card('Cómo verificar un dominio', '<ol class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>Agregue el dominio.</li><li>Cree un registro DNS TXT con el token mostrado.</li><li>Pulse «Verificar». El job revisa el DNS cada 10 min durante 72 h.</li><li>Solo los dominios verificados reciben CORS y pueden enmarcar el iframe.</li></ol>') + '</div></div>';
    UI.dataTable(body.querySelector('#iw-dt'), { exportName: 'dominios-widget', rows: () => c.domains, search: ['domain', 'cms'], pageSize: 10,
      toolbar: '<button class="btn sm primary" id="iw-add"' + dis(canEdit, 'channels.ecommerce.manage') + '>' + ic('plus') + 'Agregar dominio</button>',
      columns: [{ key: 'domain', label: 'Dominio', render: x => '<b class="small">' + esc(x.domain) + '</b><div class="xs faint">' + esc(x.cms) + '</div>' }, { key: 'status', label: 'Estado', render: x => x.status === 'verificado' ? bd('ok', 'Verificado') : bd('warn', 'Pendiente') }, { key: 'token', label: 'Registro TXT', render: x => '<span class="mono xs">' + esc(x.token) + '</span>' }, { key: 'addedAt', label: 'Alta', render: x => '<span class="small">' + date(x.addedAt) + '</span>' },
        { key: 'x', label: '', sort: false, render: x => '<span class="row" style="gap:4px;flex-wrap:nowrap">' + (x.status !== 'verificado' ? '<button class="btn xs" data-ver="' + x.id + '"' + dis(canEdit, 'channels.ecommerce.manage') + '>' + ic('check') + 'Verificar</button>' : '') + '<button class="btn xs ghost" data-rmd="' + x.id + '"' + dis(canEdit, 'channels.ecommerce.manage') + '>' + ic('trash') + '</button></span>' }],
      afterDraw: (ct) => {
        ct.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => { const x = c.domains.find(y => y.id === b.dataset.ver); x.status = 'verificado'; x.verifiedAt = nowStr(); Audit.log('Widget web', x.domain, 'verificar_dominio', 'pendiente', 'verificado (TXT ' + x.token + ')'); Store.save(); UI.toast('Registro TXT encontrado (demo): ' + esc(x.domain) + ' verificado.'); App.render(); });
        ct.querySelectorAll('[data-rmd]').forEach(b => b.onclick = () => { const x = c.domains.find(y => y.id === b.dataset.rmd); UI.confirm({ title: 'Quitar dominio', danger: true, confirmLabel: 'Quitar', message: 'El widget dejará de cargar en <b>' + esc(x.domain) + '</b> (CORS y frame-ancestors se actualizan de inmediato).', onConfirm: () => { c.domains = c.domains.filter(y => y.id !== x.id); Audit.log('Widget web', x.domain, 'quitar_dominio', x.status, ''); Store.save(); UI.toast('Dominio quitado.'); App.render(); } }); });
        const add = ct.querySelector('#iw-add'); if (add) add.onclick = () => UI.modal({ title: 'Agregar dominio autorizado', size: 'sm', body: UI.form([{ id: 'nd-d', label: 'Dominio (sin https://)', required: true, col: 12, placeholder: 'www.misitio.pe' }, { id: 'nd-c', label: 'CMS o plataforma', type: 'select', col: 12, options: ['WordPress', 'Wix', 'Webflow', 'Shopify', 'Squarespace', 'Drupal', 'Joomla', 'Sitio propio', 'Otro'] }]),
          actions: [{ label: 'Cancelar' }, { label: 'Agregar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); const dm = f['nd-d'].toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (!/^(?=.{4,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(dm)) { UI.toast('Dominio inválido. Ejemplo: www.misitio.pe', 'bad'); return false; } if (c.domains.some(x => x.domain === dm)) { UI.toast('El dominio ya está registrado.', 'bad'); return false; } const x = { id: nextId(c.domains, 'DOM-', 3), domain: dm, cms: f['nd-c'], status: 'pendiente', token: 'qhapaq-verify=ah-' + Math.random().toString(16).slice(2, 6), addedAt: nowStr(), addedBy: Auth.user.id, verifiedAt: null }; c.domains.push(x); Audit.log('Widget web', dm, 'agregar_dominio', '', x.token); Store.save(); UI.toast('Dominio agregado. Cree el registro TXT ' + esc(x.token) + ' y pulse Verificar.'); App.render(); } }] });
      } });
  }
  function iwWebhooks(body) {
    const EV = [['reservation.created', 'Reserva creada desde el widget o el sitio (estado pendiente de pago)'], ['reservation.confirmed', 'Pago aplicado y reserva confirmada'], ['reservation.cancelled', 'Reserva cancelada'], ['payment.applied', 'Pago (adelanto o saldo) aplicado'], ['widget.checkout_started', 'Selección traspasada al checkout (carrito)'], ['review.received', 'Nueva reseña externa sincronizada'], ['passenger.message.failed', 'Mensaje al pasajero fallido tras reintentos']];
    const hooks = (DB.webhooks || []).filter(w => (w.events || []).some(e => EV.some(x => x[0] === e)));
    const PM_EV = [['qhapaq:ready', 'El widget cargó (producto, moneda, idioma)'], ['qhapaq:resize', 'Nuevo alto en px (iframe)'], ['qhapaq:date_selected', 'Fecha elegida'], ['qhapaq:quote', 'Total recalculado {total, currency}'], ['qhapaq:checkout', 'El pasajero pulsó «Continuar reserva» {handoffId}']];
    body.innerHTML = '<div class="grid g2">' + UI.card('Webhooks relevantes (servidor a servidor)', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Evento</th><th>Cuándo</th><th>Suscripciones</th></tr></thead><tbody>' + EV.map(e => { const n = hooks.filter(w => w.events.includes(e[0])).length; return '<tr><td class="mono xs">' + e[0] + '</td><td class="small">' + e[1] + '</td><td>' + (n ? bd('ok', n + ' activa(s)') : '<span class="xs faint">—</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (hooks.length ? '<div class="xs faint" style="margin-top:8px">Endpoints: ' + hooks.map(w => esc(w.url)).join(' · ') + '</div>' : '') + '<div style="margin-top:10px">' + (can('admin.api.manage') ? '<a class="btn sm" href="#/admin/api">' + ic('link') + 'Gestionar en API y webhooks</a>' : '<span class="xs faint">La gestión de webhooks requiere admin.api.manage.</span>') + '</div>', { sub: 'Firmados con HMAC-SHA256 (cabecera Qhapaq-Signature), reintentos exponenciales' }) +
      UI.card('Eventos del widget en la página anfitriona', '<p class="small muted" style="margin-top:0">Para analítica del sitio del cliente (GA4, Meta Pixel). Se emiten como CustomEvent en el elemento y como postMessage desde el iframe (solo a orígenes verificados).</p><div class="tbl-wrap"><table class="tbl"><tbody>' + PM_EV.map(e => '<tr><td class="mono xs">' + e[0] + '</td><td class="small">' + e[1] + '</td></tr>').join('') + '</tbody></table></div><pre class="xc-code" style="margin-top:10px">' + esc("document.querySelector('qhapaq-booking')\n  .addEventListener('qhapaq:checkout', (e) => {\n    gtag('event', 'begin_checkout', { value: e.detail.total, currency: e.detail.currency });\n  });") + '</pre>') + '</div>' +
      '<div style="margin-top:16px">' + UI.card('Últimos traspasos del widget al checkout', (DB.widgetHandoff || []).length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Referencia</th><th>Fecha</th><th>Producto</th><th>Viaje</th><th class="num">Total</th><th>Origen</th><th>Estado</th></tr></thead><tbody>' + DB.widgetHandoff.slice(0, 10).map(h => '<tr><td class="mono xs">' + h.id + '</td><td class="small">' + datetime(h.createdAt) + '</td><td class="small">' + esc(h.productId) + '</td><td class="small">' + date(h.date) + ' · ' + (h.pax.adt + h.pax.chd + h.pax.inf) + ' pax</td><td class="num small">' + esc(BE.fmt(h.quote.total, h.quote.currency)) + '</td><td class="xs">' + esc(h.source) + '</td><td>' + bd(h.status === 'en_carrito' ? 'ok' : 'info', h.status === 'en_carrito' ? 'En carrito' : 'Pendiente') + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Aún no hay traspasos. Pruebe «Continuar reserva» en la vista previa o en el widget a pantalla completa.', 'cart')) + '</div>';
  }

  seed();
})();
