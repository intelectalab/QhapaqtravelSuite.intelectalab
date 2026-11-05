/* ==========================================================================
   Crecimiento comercial — Marketing (campañas, segmentos, automatizaciones,
   consentimientos Ley 29733) y Metas comerciales (CRM).
   Rutas: marketing/campanas[/<CMP>|/nueva|/<CMP>/editar|/<pestaña>]
          marketing/segmentos/<SEG>|nuevo · crm/metas[/<MET>]
   Colecciones propias: DB.segments, DB.campaigns, DB.automations, DB.consents,
   DB.mktTemplates, DB.subscribers, DB.salesTargets, DB.salesTeams, DB.salesTargetPolicy
   ========================================================================== */
(function () {
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr, parseD, pad } = Util;
  const TD = () => window.TODAY;
  const can = (p) => Auth.can(p);
  const MK = 'marketing.campaigns.manage', TM = 'crm.targets.manage', TV = 'crm.targets.view';
  const dis = (p) => can(p) ? '' : ' disabled title="Requiere permiso ' + p + '"';
  const need = (p, what) => { if (can(p)) return true; UI.toast('Su rol (' + esc(Q.roleName(Auth.role)) + ') no puede ' + what + '. Requiere permiso ' + p + '.', 'bad'); return false; };
  const nextId = (arr, prefix, w) => { const n = Math.max(0, ...arr.map(x => parseInt(String(x.id).replace(prefix, '').replace(/\D/g, ''), 10) || 0)); return prefix + String(n + 1).padStart(w, '0'); };
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 100; };
  const pct = (a, b) => b ? a / b * 100 : 0;
  const S0 = (v) => 'S/ ' + fmtN(v, 0);
  const normE = (s) => String(s || '').trim().toLowerCase();
  const me = () => Auth.user.id;
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const recall = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const log = (o, m) => { o.history = o.history || []; o.history.push({ ts: nowStr(), u: Auth.user ? Auth.user.id : 'Sistema', m }); };
  const tl = (h) => UI.timeline((h || []).slice().reverse().map(x => ({ title: esc(x.m), meta: datetime(x.ts) + ' · ' + esc(Q.userName(x.u)), icon: 'history' })));
  const toTs = (v) => String(v || '').replace('T', ' ').slice(0, 16);
  const fromTs = (v) => String(v || '').replace(' ', 'T');

  /* ---------------- CSS del módulo ---------------- */
  if (!document.getElementById('css-crecimiento')) {
    const st = document.createElement('style'); st.id = 'css-crecimiento';
    st.textContent = `
.mk-rule{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) 34px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line-2)}
.mk-rule:last-child{border-bottom:0}
@media (max-width:640px){.mk-rule{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 34px}.mk-rule .rv{grid-column:1/3}}
.mk-mail{border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}
.mk-mail-h{padding:10px 14px;border-bottom:1px solid var(--line-2);background:var(--surface-2);font-size:.8rem;display:grid;gap:3px}
.mk-mail-b{padding:16px;white-space:pre-wrap;font-size:.86rem;line-height:1.55;overflow-wrap:anywhere}
.mk-mail-f{padding:10px 14px;border-top:1px solid var(--line-2);font-size:.72rem;color:var(--fg-3)}
.mk-wa{background:var(--surface-3);border-radius:10px;padding:14px}
.mk-wa-b{background:var(--ok-soft);color:var(--fg);border-radius:10px 10px 10px 2px;padding:10px 12px;max-width:360px;white-space:pre-wrap;font-size:.84rem;line-height:1.5;overflow-wrap:anywhere}
.mk-wa-m{font-size:.7rem;color:var(--fg-3);margin-top:6px}
.mk-vars{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.mk-vars .tag{cursor:pointer}
.mk-count{font-family:var(--f-display);font-size:2rem;font-weight:700;line-height:1}
.mk-auto{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
@media (max-width:460px){.mk-auto{grid-template-columns:minmax(0,1fr)}}
.mk-sup{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;font-size:.82rem}
.mt-rank{display:grid;grid-template-columns:26px minmax(0,1.7fr) minmax(50px,1fr) 46px;gap:10px;align-items:center;padding:9px 6px;border-bottom:1px solid var(--line-2);font-size:.84rem}
.mt-rank:last-child{border-bottom:0}
.mt-rank.me{background:var(--accent-soft);border-radius:8px}
.mt-rank .pos{font-weight:700;text-align:center}
.mt-met{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
@media (max-width:1000px){.mt-met{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:520px){.mt-met{grid-template-columns:minmax(0,1fr)}}
.mt-box{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--surface);display:grid;gap:6px;min-width:0}
.mt-box .v{font-family:var(--f-display);font-size:1.3rem;font-weight:700}
.mt-box .s{font-size:.74rem;color:var(--fg-3)}
.cg-col{align-content:start}
.cg-sel{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cg-sel select.input{width:auto;max-width:100%}
`;
    document.head.appendChild(st);
  }

  /* ===================================================================
     DATOS SEMILLA — Marketing
     =================================================================== */
  const DEST_ALIAS = { 'humantay': 'Cusco', 'machu picchu': 'Cusco', 'valle sagrado': 'Cusco', 'paracas': 'Ica', 'colca': 'Arequipa', 'titicaca': 'Puno' };
  const splitDest = (s) => { const out = []; String(s || '').split(/[\/,+]/).map(x => x.trim()).filter(x => x && x !== 'Varios').forEach(x => { out.push(x); const a = DEST_ALIAS[x.toLowerCase()]; if (a) out.push(a); }); return out; };
  const PHONE_CC = [['+1 ', 'Estados Unidos'], ['+39', 'Italia'], ['+49', 'Alemania'], ['+33', 'Francia'], ['+34', 'España'], ['+54', 'Argentina'], ['+55', 'Brasil'], ['+56', 'Chile'], ['+81', 'Japón']];
  const countryOfPhone = (p) => { const x = PHONE_CC.find(c => String(p || '').startsWith(c[0])); return x ? x[1] : 'Perú'; };
  const waNumber = (p) => { const s = String(p || '').trim(); if (s.startsWith('+')) return s; const d = s.replace(/\D/g, ''); return d.length === 9 && d[0] === '9' ? '+51 ' + s : null; };

  function ensureMkt() {
    let dirty = false;
    if (!DB.subscribers) {
      const S = (id, name, email, phone, country, interest, createdAt, extra) => Object.assign({ id, name, email, phone, country, interest, source: 'Newsletter web', createdAt }, extra || {});
      DB.subscribers = [
        S('SUB-0001', 'Carla Mendoza Ruiz', 'carla.mendoza@correo.pe', '986 221 034', 'Perú', 'Cusco', '2026-03-14 10:12'),
        S('SUB-0002', 'Luis Ángel Torres', 'ltorres@correo.pe', '975 118 440', 'Perú', 'Arequipa', '2026-04-02 18:40'),
        S('SUB-0003', 'Emily Johnson', 'emily.j@mail.com', '+1 415 555 0192', 'Estados Unidos', 'Machu Picchu', '2026-08-30 21:05', { clientId: 'CLI-0010' }),
        S('SUB-0004', 'Martina Gómez', 'martina.gomez@mail.com.ar', '+54 9 11 5555 2231', 'Argentina', 'Machu Picchu', '2026-05-20 13:30'),
        S('SUB-0005', 'Hans Weber', 'h.weber@mail.de', '+49 160 5550177', 'Alemania', 'Cusco', '2026-06-11 08:15', { source: 'Pop-up del blog' }),
        S('SUB-0006', 'Rosa Elvira Chávez', 'rechavez@correo.pe', '961 330 118', 'Perú', 'Paracas', '2026-07-01 20:22'),
        S('SUB-0007', 'Daniel Prado Ayala', 'dprado@correo.pe', '947 552 910', 'Perú', 'Humantay', '2026-07-19 12:02'),
        S('SUB-0008', 'Julie Bernard', 'j.bernard@mail.fr', '+33 6 55 12 90 44', 'Francia', 'Machu Picchu', '2026-07-25 16:48'),
        S('SUB-0009', 'Andrés Quiroga Paz', 'aquiroga@correo.pe', '992 118 305', 'Perú', 'Arequipa', '2026-08-03 09:31', { source: 'Feria Turismo (tablet)' }),
        S('SUB-0010', 'Paola Linares Vega', 'plinares@correo.pe', '954 776 012', 'Perú', 'Cusco', '2026-08-12 19:10'),
        S('SUB-0011', 'Kenji Watanabe', 'k.watanabe@mail.jp', '+81 90 5555 1234', 'Japón', 'Machu Picchu', '2026-08-21 07:44'),
        S('SUB-0012', 'Sebastián Ríos Calle', 'srios@correo.pe', '983 441 207', 'Perú', 'Paracas', '2026-08-27 22:18'),
        S('SUB-0013', 'Camila Herrera Solís', 'cherrera@correo.pe', '958 002 331', 'Perú', 'Cusco', '2026-09-04 11:25'),
        S('SUB-0014', 'Lucas Pereira', 'lucas.pereira@mail.com.br', '+55 11 95555 0101', 'Brasil', 'Machu Picchu', '2026-09-06 15:00'),
        S('SUB-0015', 'Valentina Soto Rey', 'vsoto@correo.pe', '976 330 812', 'Perú', 'Arequipa', '2026-09-12 17:36'),
        S('SUB-0016', 'Miguel Ángel Cárdenas', 'macardenas@correo.pe', '941 220 776', 'Perú', 'Cusco', '2026-09-26 10:50'),
        S('SUB-0017', 'Nadia Reyes Olano', 'nreyes@correo.pe', '951 443 208', 'Perú', 'Paracas', '2026-09-28 08:05', { source: 'Pop-up del blog' })
      ];
      dirty = true;
    }
    if (!DB.consents) {
      const POL = 'PDP-2026.1';
      const list = [];
      const add = (key, channel, grantedAt, source, evidence, rev) => {
        const [subjectType, subjectId] = key.split(':');
        const r = { id: 'CNS-' + String(list.length + 1).padStart(4, '0'), key, subjectType, subjectId, channel, status: 'otorgado', grantedAt, source, evidence, policyVersion: POL, revokedAt: null, revokeSource: '', revokeCampaign: null, history: [{ ts: grantedAt, u: 'Sistema', m: 'Consentimiento otorgado · ' + source }] };
        if (rev) { r.status = 'revocado'; r.revokedAt = rev[0]; r.revokeSource = rev[1]; r.revokeCampaign = rev[2] || null; r.history.push({ ts: rev[0], u: 'Sistema', m: 'Baja (opt-out) · ' + rev[1] }); }
        list.push(r);
      };
      add('client:CLI-0001', 'email', '2025-12-10 11:20', 'Ficha física firmada en oficina', 'Ficha F-0112 firmada (Miraflores)');
      add('client:CLI-0001', 'whatsapp', '2025-12-10 11:20', 'Ficha física firmada en oficina', 'Ficha F-0112 firmada (Miraflores)');
      add('client:CLI-0002', 'email', '2026-01-20 16:00', 'Contrato corporativo / convenio', 'Contrato marco 2026, cláusula 12 (comunicaciones)');
      add('client:CLI-0003', 'email', '2026-06-02 09:14', 'Checkout e-commerce — casilla', 'IP 91.64.10.22 · texto política v2026.1');
      add('client:CLI-0003', 'whatsapp', '2026-06-02 09:40', 'WhatsApp opt-in (respuesta SÍ)', 'Mensaje wamid.HBgL…A1 respuesta "SÍ"');
      add('client:CLI-0004', 'email', '2026-05-14 10:00', 'Formulario web — casilla de marketing', 'IP 190.235.8.14', ['2026-08-14 09:30', 'Solicitud ARCO (derecho de oposición)']);
      add('client:CLI-0005', 'email', '2025-11-28 17:45', 'Ficha física firmada en oficina', 'Ficha F-0098 (Trujillo, visita)');
      add('client:CLI-0005', 'whatsapp', '2025-11-28 17:45', 'Ficha física firmada en oficina', 'Ficha F-0098 (Trujillo, visita)');
      add('client:CLI-0006', 'email', '2026-08-19 22:31', 'Checkout e-commerce — casilla', 'IP 82.66.140.9 · texto política v2026.1');
      add('client:CLI-0007', 'email', '2026-02-01 12:00', 'Contrato corporativo / convenio', 'Convenio B2B Wayra 2026, anexo 3');
      add('client:CLI-0008', 'email', '2026-09-02 15:10', 'Llamada grabada — consentimiento verbal', 'Grabación CALL-20260902-151');
      add('client:CLI-0008', 'whatsapp', '2026-09-02 15:10', 'Llamada grabada — consentimiento verbal', 'Grabación CALL-20260902-151', ['2026-09-15 10:22', 'Respuesta BAJA por WhatsApp', 'CMP-0010']);
      add('client:CLI-0010', 'email', '2026-08-30 21:05', 'Newsletter web (doble opt-in)', 'SUB-0003 · confirmación doble 2026-08-30 21:07');
      add('lead:LEAD-0231', 'email', '2026-09-29 07:44', 'Formulario web — casilla de marketing', 'IP 200.121.44.7');
      add('lead:LEAD-0230', 'whatsapp', '2026-09-28 16:20', 'WhatsApp opt-in (respuesta SÍ)', 'Chat entrante, respuesta "SÍ" a política');
      add('lead:LEAD-0229', 'email', '2026-09-28 10:02', 'Formulario Facebook Lead Ads — casilla', 'Lead ID fb 88120034 · casilla marcada');
      add('lead:LEAD-0224', 'email', '2026-09-24 11:30', 'Llamada grabada — consentimiento verbal', 'Grabación CALL-20260924-113');
      add('lead:LEAD-0223', 'whatsapp', '2026-09-29 06:12', 'WhatsApp opt-in (respuesta SÍ)', 'Derivado de Instagram DM, respuesta "SÍ"');
      const wa = ['SUB-0001', 'SUB-0007', 'SUB-0010', 'SUB-0013', 'SUB-0016', 'SUB-0005'];
      DB.subscribers.filter(s => !s.clientId).forEach(s => {
        const rev = s.id === 'SUB-0012' ? ['2026-09-02 10:14', 'Enlace de baja en correo', 'CMP-0009'] : s.id === 'SUB-0002' ? ['2026-07-11 08:02', 'Enlace de baja en correo', 'CMP-0008'] : s.id === 'SUB-0015' ? ['2026-09-20 12:40', 'Solicitud ARCO (derecho de oposición)'] : null;
        add('subscriber:' + s.id, 'email', s.createdAt, s.source === 'Newsletter web' ? 'Newsletter web (doble opt-in)' : s.source + ' — casilla de marketing', 'Confirmación doble · ' + s.createdAt, rev);
        if (wa.includes(s.id)) add('subscriber:' + s.id, 'whatsapp', s.createdAt, 'Casilla WhatsApp en formulario', 'Casilla marcada · ' + s.createdAt);
      });
      DB.consents = list; dirty = true;
    }
    if (!DB.mktTemplates) {
      DB.mktTemplates = [
        { id: 'TPL-01', name: 'Newsletter mensual', channel: 'email', category: 'MARKETING', status: 'activa', subject: '{{nombre}}, esta temporada te espera {{destino}}', body: 'Hola {{nombre}}:\n\nPreparamos una selección de experiencias en {{destino}} con salidas confirmadas y cupos limitados. Tu asesor(a) {{asesor}} puede armar tu itinerario a medida.\n\nUsa el código {{codigo_promo}} al reservar en nuestra web.\n\nSaludos,\n{{agencia}}', updatedAt: '2026-08-25 10:00', updatedBy: 'U01' },
        { id: 'TPL-02', name: 'Promoción con código', channel: 'email', category: 'MARKETING', status: 'activa', subject: 'Tu código {{codigo_promo}} para viajar a {{destino}}', body: 'Hola {{nombre}}:\n\nTienes un beneficio exclusivo: con el código {{codigo_promo}} obtienes un descuento en tu próxima reserva a {{destino}}.\n\nVálido para nuevas reservas y sujeto a disponibilidad.\n\n{{asesor}} — {{agencia}}', updatedAt: '2026-09-10 12:30', updatedBy: 'U02' },
        { id: 'TPL-03', name: 'Reactivación (12 meses)', channel: 'email', category: 'MARKETING', status: 'activa', subject: '{{nombre}}, te extrañamos', body: 'Hola {{nombre}}:\n\nHa pasado un tiempo desde tu último viaje con nosotros. Queremos ayudarte a planear el próximo: {{asesor}} te contactará con opciones a tu medida.\n\nCódigo de regreso: {{codigo_promo}}.\n\n{{agencia}}', updatedAt: '2026-09-18 09:00', updatedBy: 'U01' },
        { id: 'TPL-04', name: 'promo_primavera_mapi', channel: 'whatsapp', category: 'MARKETING', status: 'aprobada', metaId: 'wa_tpl_8812201', subject: '', body: 'Hola {{nombre}}, llegó la Primavera Andina: con el código {{codigo_promo}} tienes 8% en Machu Picchu Full Day hasta el 31/10. Escribe INFO y {{asesor}} te ayuda a reservar.\nResponde BAJA para no recibir más promociones.', updatedAt: '2026-09-12 11:20', updatedBy: 'U02' },
        { id: 'TPL-05', name: 'promo_colegios_2027', channel: 'whatsapp', category: 'MARKETING', status: 'en_revision', metaId: 'wa_tpl_8812540', subject: '', body: 'Hola {{nombre}}, abrimos la planificación de viajes de promoción 2027 a {{destino}} con tarifa grupal y liberados para docentes. Responde INFO para recibir la propuesta.\nResponde BAJA para no recibir más promociones.', updatedAt: '2026-09-27 16:05', updatedBy: 'U03' },
        { id: 'TPL-06', name: 'bienvenida_suscriptor', channel: 'whatsapp', category: 'MARKETING', status: 'aprobada', metaId: 'wa_tpl_8811090', subject: '', body: 'Hola {{nombre}}, gracias por suscribirte a {{agencia}}. Te enviaremos novedades de {{destino}} y ofertas de temporada.\nResponde BAJA para no recibir más mensajes.', updatedAt: '2026-06-01 10:00', updatedBy: 'U01' },
        { id: 'TPL-07', name: 'recordatorio_previaje', channel: 'whatsapp', category: 'UTILITY', status: 'aprobada', metaId: 'wa_tpl_8810033', subject: '', body: 'Hola {{nombre}}, tu viaje a {{destino}} inicia el {{fecha_viaje}}. Revisa tu itinerario y vouchers en el portal. Ante cualquier consulta escribe a este número.', updatedAt: '2026-05-10 10:00', updatedBy: 'U01' },
        { id: 'TPL-08', name: 'Bienvenida suscriptor (email)', channel: 'email', category: 'MARKETING', status: 'activa', subject: 'Bienvenido(a) a {{agencia}}, {{nombre}}', body: 'Hola {{nombre}}:\n\nGracias por suscribirte. Cada mes te contaremos lo mejor de {{destino}} y del Perú, con salidas confirmadas y precios de temporada.\n\n{{agencia}}', updatedAt: '2026-06-01 10:00', updatedBy: 'U01' },
        { id: 'TPL-09', name: 'Encuesta post-viaje', channel: 'email', category: 'SERVICIO', status: 'activa', subject: '{{nombre}}, ¿cómo estuvo tu viaje a {{destino}}?', body: 'Hola {{nombre}}:\n\nGracias por viajar con nosotros. Cuéntanos tu experiencia en menos de un minuto: del 0 al 10, ¿qué tan probable es que nos recomiendes?\n\n{{agencia}}', updatedAt: '2026-04-02 10:00', updatedBy: 'U01' },
        { id: 'TPL-10', name: 'Carrito abandonado', channel: 'email', category: 'MARKETING', status: 'activa', subject: '{{nombre}}, tu reserva a {{destino}} sigue pendiente', body: 'Hola {{nombre}}:\n\nGuardamos tu selección. Completa el pago para confirmar tus cupos; la disponibilidad puede variar.\n\n{{asesor}} — {{agencia}}', updatedAt: '2026-07-01 10:00', updatedBy: 'U01' },
        { id: 'TPL-11', name: 'Feliz cumpleaños', channel: 'email', category: 'MARKETING', status: 'activa', subject: '¡Feliz cumpleaños, {{nombre}}!', body: 'Hola {{nombre}}:\n\nTodo el equipo de {{agencia}} te desea un feliz cumpleaños. Celébralo viajando: usa {{codigo_promo}} en tu próxima reserva.', updatedAt: '2026-07-01 10:00', updatedBy: 'U01' }
      ];
      DB.mktTemplates.forEach(t => { if (t.channel === 'email') t.body += '\n\n—\nRecibes este correo porque autorizaste comunicaciones comerciales. Darte de baja: {{enlace_baja}}'; });
      dirty = true;
    }
    if (!DB.segments) {
      const G = (id, name, desc, match, rules, owner, createdAt) => ({ id, name, desc, match, rules, owner, createdAt, updatedAt: createdAt });
      DB.segments = [
        G('SEG-001', 'Newsletter — contactos con email autorizado', 'Todos los clientes, leads y suscriptores con consentimiento de email vigente.', 'all', [{ f: 'consent', op: 'has', v: 'email' }], 'U01', '2026-06-01 10:00'),
        G('SEG-002', 'Interés en Cusco con WhatsApp autorizado', 'Contactos con interés o compras en Cusco y opt-in de WhatsApp.', 'all', [{ f: 'dest', op: 'contains', v: 'Cusco' }, { f: 'consent', op: 'has', v: 'whatsapp' }], 'U02', '2026-09-12 11:00'),
        G('SEG-003', 'Alto valor: VIP, corporativo o gasto ≥ S/ 5 000', 'Clientes de mayor valor para preventas y lanzamientos.', 'any', [{ f: 'segment', op: 'eq', v: 'VIP' }, { f: 'segment', op: 'eq', v: 'Corporativo' }, { f: 'spent', op: 'gte', v: 5000 }], 'U02', '2026-09-20 09:30'),
        G('SEG-004', 'Mercado receptivo (extranjeros)', 'Contactos con país distinto de Perú.', 'all', [{ f: 'country', op: 'neq', v: 'Perú' }], 'U01', '2026-07-15 10:00'),
        G('SEG-005', 'Reactivación: clientes sin compra en 12 meses', 'Clientes con última compra hace más de 365 días o sin compras.', 'all', [{ f: 'type', op: 'eq', v: 'client' }, { f: 'last', op: 'older', v: 365 }], 'U01', '2026-09-18 09:00'),
        G('SEG-006', 'Promotores NPS ≥ 9 (referidos)', 'Clientes promotores para el programa de referidos.', 'all', [{ f: 'nps', op: 'gte', v: 9 }], 'U02', '2026-08-01 10:00'),
        G('SEG-007', 'Colegios y grupos', 'Segmento Grupos o leads de viaje de promoción.', 'any', [{ f: 'segment', op: 'eq', v: 'Grupos' }, { f: 'tags', op: 'has', v: 'Viaje de promoción' }], 'U03', '2026-09-27 15:40')
      ];
      dirty = true;
    }
    /* Código promocional de la preventa (vinculado a CMP-0011) dentro de las promociones del producto */
    if (!DB.mktPromoSeed) {
      const p = Q.product('PRD-002');
      if (p) { p.promotions = p.promotions || []; if (!DB.products.some(x => (x.promotions || []).some(y => y.code === 'ANONUEVO27'))) p.promotions.push({ id: nextId(DB.products.flatMap(x => x.promotions || []), 'PROMO-', 2), name: 'Preventa Año Nuevo 2027', kind: 'Descuento %', value: 5, from: '2026-10-01', to: '2026-11-30', channel: 'Todos', code: 'ANONUEVO27', status: 'activa', campaignId: 'CMP-0011' }); }
      const p1 = DB.products.find(x => (x.promotions || []).some(y => y.code === 'PRIMAVERA8')); if (p1) p1.promotions.find(y => y.code === 'PRIMAVERA8').campaignId = 'CMP-0010';
      DB.mktPromoSeed = true; dirty = true;
    }
    if (!DB.campaigns) {
      const promo = (code) => { const p = DB.products.find(x => (x.promotions || []).some(y => y.code === code)); if (!p) return null; const pr = p.promotions.find(y => y.code === code); return { productId: p.id, promoId: pr.id, code }; };
      const C = (o) => Object.assign({ tests: [], recipients: [], audience: null, history: [], promo: null, scheduledAt: null, sentAt: null, utm: 'utm_source=' + (o.channel === 'email' ? 'newsletter' : 'whatsapp') + '&utm_medium=' + o.channel + '&utm_campaign=' + o.id.toLowerCase() }, o);
      DB.campaigns = [
        C({ id: 'CMP-0008', name: 'Fiestas Patrias en Arequipa y el Colca', channel: 'email', segmentId: 'SEG-001', templateId: 'TPL-01', subject: '{{nombre}}, Fiestas Patrias en Arequipa y el Colca', body: '', status: 'enviada', owner: 'U02', createdAt: '2026-07-06 10:00', scheduledAt: '2026-07-10 09:00', sentAt: '2026-07-10 09:00', tests: [{ ts: '2026-07-08 16:10', u: 'U02', to: 'rsalazar@andeshorizonte.pe' }] }),
        C({ id: 'CMP-0009', name: 'Newsletter setiembre: Machu Picchu y Humantay', channel: 'email', segmentId: 'SEG-001', templateId: 'TPL-01', subject: '{{nombre}}, esta temporada te espera {{destino}}', body: '', status: 'enviada', owner: 'U01', createdAt: '2026-08-28 12:00', scheduledAt: '2026-09-01 09:00', sentAt: '2026-09-01 09:00', tests: [{ ts: '2026-08-29 10:05', u: 'U01', to: 'mquispe@andeshorizonte.pe' }] }),
        C({ id: 'CMP-0010', name: 'Primavera Andina −8% Machu Picchu Full Day', channel: 'whatsapp', segmentId: 'SEG-002', templateId: 'TPL-04', subject: '', body: '', status: 'enviada', owner: 'U02', createdAt: '2026-09-12 11:30', scheduledAt: '2026-09-15 10:00', sentAt: '2026-09-15 10:00', promo: promo('PRIMAVERA8'), tests: [{ ts: '2026-09-13 09:40', u: 'U02', to: '987 331 902' }] }),
        C({ id: 'CMP-0011', name: 'Año Nuevo en Cusco 2027 — preventa', channel: 'email', segmentId: 'SEG-003', templateId: 'TPL-02', subject: '{{nombre}}, preventa Año Nuevo en Cusco con {{codigo_promo}}', body: '', status: 'programada', owner: 'U02', createdAt: '2026-09-26 17:00', scheduledAt: '2026-10-01 09:00', promo: promo('ANONUEVO27'), tests: [{ ts: '2026-09-28 17:20', u: 'U02', to: 'rsalazar@andeshorizonte.pe' }] }),
        C({ id: 'CMP-0012', name: 'Te extrañamos: reactivación 12 meses', channel: 'email', segmentId: 'SEG-005', templateId: 'TPL-03', subject: '{{nombre}}, te extrañamos', body: '', status: 'borrador', owner: 'U01', createdAt: '2026-09-18 09:10' }),
        C({ id: 'CMP-0013', name: 'Colegios: viajes de promoción 2027', channel: 'whatsapp', segmentId: 'SEG-007', templateId: 'TPL-05', subject: '', body: '', status: 'borrador', owner: 'U02', createdAt: '2026-09-27 16:10' })
      ];
      DB.campaigns.forEach(c => { const t = tpl(c.templateId); c.body = t ? t.body : ''; });
      /* Envíos históricos: destinatarios reales según consentimiento vigente a la fecha del envío */
      DB.campaigns.filter(c => c.status === 'enviada').sort((a, b) => a.sentAt.localeCompare(b.sentAt)).forEach(c => {
        const a = audience(seg(c.segmentId), c.channel, c.sentAt, c.id);
        c.audience = snapAud(a); c.recipients = makeRecipients(c, a.eligible);
        DB.consents.filter(x => x.revokeCampaign === c.id).forEach(x => { const r = c.recipients.find(y => y.k === x.key); if (r) Object.assign(r, { d: true, o: true, u: true }); });
        c.history = [{ ts: c.createdAt, u: c.owner, m: 'Campaña creada en borrador' }, { ts: c.tests[0].ts, u: c.owner, m: 'Envío de prueba a ' + c.tests[0].to }, { ts: addDays(c.sentAt.slice(0, 10), -2) + ' 12:00', u: c.owner, m: 'Programada para ' + c.scheduledAt }, { ts: c.sentAt, u: 'Sistema', m: 'Envío completado: ' + c.recipients.length + ' destinatarios · ' + (c.audience.matched - c.audience.eligible) + ' suprimidos' }];
      });
      const c11 = DB.campaigns.find(c => c.id === 'CMP-0011'); c11.history = [{ ts: c11.createdAt, u: 'U02', m: 'Campaña creada en borrador' }, { ts: '2026-09-28 17:20', u: 'U02', m: 'Envío de prueba a rsalazar@andeshorizonte.pe' }, { ts: '2026-09-28 17:25', u: 'U02', m: 'Programada para 2026-10-01 09:00' }];
      DB.campaigns.filter(c => c.status === 'borrador').forEach(c => { c.history = [{ ts: c.createdAt, u: c.owner, m: 'Campaña creada en borrador' }]; });
      dirty = true;
    }
    if (!DB.automations) {
      const A = (o) => Object.assign({ runs: [], done: [], history: [], stats: { sent: 0, suppressed: 0, conv: 0 } }, o);
      DB.automations = [
        A({ id: 'AUT-01', key: 'welcome', name: 'Bienvenida a suscriptor', trigger: 'Nuevo suscriptor del newsletter con consentimiento de email', delay: 'Inmediato (máx. 7 días)', channel: 'email', templateId: 'TPL-08', purpose: 'comercial', status: 'activa', stats: { sent: 212, suppressed: 9, conv: 14 }, done: ['subscriber:SUB-0013', 'subscriber:SUB-0014', 'subscriber:SUB-0015'], updatedAt: '2026-06-01 10:00', updatedBy: 'U01' }),
        A({ id: 'AUT-02', key: 'cart', name: 'Carrito abandonado (e-commerce)', trigger: 'Pedido web en “pago pendiente” por más de 1 hora', delay: '1 hora', channel: 'email', templateId: 'TPL-10', purpose: 'comercial', status: 'activa', stats: { sent: 48, suppressed: 11, conv: 9 }, updatedAt: '2026-07-01 10:00', updatedBy: 'U01' }),
        A({ id: 'AUT-03', key: 'pretrip', name: 'Recordatorio pre-viaje', trigger: 'Reserva confirmada con inicio de viaje en los próximos 3 días', delay: '72 h antes del inicio', channel: 'whatsapp', templateId: 'TPL-07', purpose: 'servicio', status: 'activa', stats: { sent: 164, suppressed: 0, conv: 0 }, updatedAt: '2026-05-10 10:00', updatedBy: 'U01' }),
        A({ id: 'AUT-04', key: 'survey', name: 'Encuesta post-viaje (NPS)', trigger: 'Reserva completada sin encuesta registrada (hasta 7 días del fin)', delay: '24 h después del fin', channel: 'email', templateId: 'TPL-09', purpose: 'servicio', status: 'activa', stats: { sent: 131, suppressed: 3, conv: 0 }, updatedAt: '2026-04-02 10:00', updatedBy: 'U01' }),
        A({ id: 'AUT-05', key: 'birthday', name: 'Saludo de cumpleaños', trigger: 'Cumpleaños del cliente (fecha de nacimiento en ficha)', delay: 'El día, 09:00', channel: 'email', templateId: 'TPL-11', purpose: 'comercial', status: 'pausada', stats: { sent: 37, suppressed: 6, conv: 2 }, updatedAt: '2026-08-20 18:00', updatedBy: 'U02' }),
        A({ id: 'AUT-06', key: 'reactivation', name: 'Reactivación 12 meses', trigger: 'Cliente sin compras en los últimos 365 días', delay: 'Semanal (lunes 08:00)', channel: 'email', templateId: 'TPL-03', purpose: 'comercial', status: 'pausada', stats: { sent: 0, suppressed: 0, conv: 0 }, updatedAt: '2026-09-18 09:15', updatedBy: 'U01' })
      ];
      DB.automations.forEach(a => { a.history = [{ ts: a.updatedAt, u: a.updatedBy, m: (a.status === 'activa' ? 'Activada' : 'Pausada') + ' · plantilla ' + a.templateId }]; });
      dirty = true;
    }
    if (dirty) Store.save();
  }

  /* ---------------- Contactos (clientes + leads abiertos + suscriptores) ---------------- */
  const tpl = (id) => (DB.mktTemplates || []).find(t => t.id === id);
  const seg = (id) => (DB.segments || []).find(s => s.id === id);
  const resOk = (r) => !['cancelada', 'borrador'].includes(r.status);
  const destNames = (destId) => destId ? Q.destPath(destId).split(' › ').filter(x => x && x !== 'Perú') : [];
  function contacts() {
    const out = []; const seen = new Set();
    const surveys = DB.surveys || [];
    DB.clients.forEach(c => {
      const rs = DB.reservations.filter(r => r.clientId === c.id && resOk(r));
      const last = rs.map(r => r.createdAt.slice(0, 10)).sort().pop() || null;
      const sv = surveys.filter(s => s.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      const ds = new Set();
      DB.opportunities.filter(o => o.clientId === c.id).forEach(o => splitDest(o.destination).forEach(d => ds.add(d)));
      rs.forEach(r => r.services.forEach(s => { const p = Q.product(s.productId); if (p) destNames(p.destId).forEach(d => ds.add(d)); }));
      const leads = DB.leads.filter(l => normE(l.email) && normE(l.email) === normE(c.email));
      leads.forEach(l => splitDest(l.destination).forEach(d => ds.add(d)));
      const lead = (c.sourceLeadId && Q.lead(c.sourceLeadId)) || leads[0];
      out.push({ key: 'client:' + c.id, type: 'client', id: c.id, name: c.name, email: c.email, phone: c.phone, segment: c.segment, country: c.country, dests: [...ds], last, days: last ? -daysFromToday(last) : null, spent: sum(rs, r => toPEN(r.total, r.currency)), nps: sv ? sv.score : (c.nps == null ? null : c.nps), channel: lead ? lead.channel : (rs[0] ? rs[0].channel : 'Directo'), tags: c.tags || [], owner: c.owner, birth: c.birth || null, href: '#/crm/clientes/' + c.id });
      seen.add(normE(c.email));
    });
    DB.leads.filter(l => ['nuevo', 'contactado', 'calificado'].includes(l.status) && !seen.has(normE(l.email))).forEach(l => {
      out.push({ key: 'lead:' + l.id, type: 'lead', id: l.id, name: l.name, email: l.email, phone: l.phone, segment: 'Lead', country: countryOfPhone(l.phone), dests: splitDest(l.destination), last: null, days: null, spent: 0, nps: null, channel: l.channel, tags: [l.source, l.interest].filter(Boolean), owner: l.owner, birth: null, href: '#/crm/leads/' + l.id });
      if (l.email) seen.add(normE(l.email));
    });
    (DB.subscribers || []).filter(s => !s.clientId && !s.leadId && !seen.has(normE(s.email))).forEach(s => {
      out.push({ key: 'subscriber:' + s.id, type: 'subscriber', id: s.id, name: s.name, email: s.email, phone: s.phone, segment: 'Suscriptor', country: s.country, dests: splitDest(s.interest), last: null, days: null, spent: 0, nps: null, channel: 'Web', tags: ['Newsletter', s.source], owner: null, birth: null, createdAt: s.createdAt, href: null });
    });
    return out;
  }
  const contactByKey = (k, list) => (list || contacts()).find(c => c.key === k);
  const typeLabel = { client: 'Cliente', lead: 'Lead', subscriber: 'Suscriptor' };

  /* ---------------- Consentimiento (Ley 29733) ---------------- */
  const consentRec = (key, ch) => (DB.consents || []).find(x => x.key === key && x.channel === ch);
  function consentOk(key, ch, at) {
    const r = consentRec(key, ch); at = at || nowStr();
    if (!r || r.grantedAt > at) return false;
    if (r.status === 'revocado') return r.revokedAt > at;
    return r.status === 'otorgado';
  }
  const optedOut = (key, ch, at) => { const r = consentRec(key, ch); return !!(r && r.status === 'revocado' && r.revokedAt <= (at || nowStr())); };
  const consentBadge = (key, ch) => { const r = consentRec(key, ch); if (!r) return UI.badge('sin', 'Sin consentimiento'); return r.status === 'otorgado' ? UI.badge('activo', 'Otorgado') : UI.badge('rechazado', 'Baja'); };

  /* ---------------- Segmentos: reglas ---------------- */
  const SEGMENTS = ['Retail', 'Corporativo', 'VIP', 'Grupos', 'B2B', 'Lead', 'Suscriptor'];
  const FIELDS = {
    type: { label: 'Tipo de contacto', ops: [['eq', 'es']], values: () => [['client', 'Cliente'], ['lead', 'Lead'], ['subscriber', 'Suscriptor']] },
    segment: { label: 'Segmento', ops: [['eq', 'es'], ['neq', 'no es']], values: () => SEGMENTS.map(s => [s, s]) },
    country: { label: 'País', ops: [['eq', 'es'], ['neq', 'no es']], values: (cs) => [...new Set(['Perú'].concat(cs.map(c => c.country)))].sort().map(x => [x, x]) },
    dest: { label: 'Destino de interés', ops: [['contains', 'incluye']], values: (cs) => [...new Set(cs.flatMap(c => c.dests))].sort().map(x => [x, x]) },
    last: { label: 'Última compra', ops: [['within', 'en los últimos N días'], ['older', 'hace más de N días o nunca'], ['none', 'sin compras']], num: true },
    spent: { label: 'Gasto total (S/)', ops: [['gte', 'mayor o igual a'], ['lte', 'menor o igual a']], num: true },
    nps: { label: 'NPS (0–10)', ops: [['gte', 'mayor o igual a'], ['lte', 'menor o igual a'], ['null', 'sin encuesta']], num: true },
    channel: { label: 'Canal de origen', ops: [['eq', 'es']], values: (cs) => [...new Set(cs.map(c => c.channel))].sort().map(x => [x, x]) },
    tags: { label: 'Etiqueta', ops: [['has', 'tiene']], values: (cs) => [...new Set(cs.flatMap(c => c.tags))].sort().map(x => [x, x]) },
    consent: { label: 'Consentimiento', ops: [['has', 'otorgado para'], ['not', 'sin consentimiento para']], values: () => [['email', 'Email'], ['whatsapp', 'WhatsApp']] }
  };
  const noValue = (r) => ['none', 'null'].includes(r.op);
  function testRule(c, r, at) {
    const v = r.v;
    switch (r.f) {
      case 'type': return c.type === v;
      case 'segment': return r.op === 'neq' ? c.segment !== v : c.segment === v;
      case 'country': return r.op === 'neq' ? c.country !== v : c.country === v;
      case 'dest': return c.dests.includes(v);
      case 'last': return r.op === 'none' ? c.days == null : r.op === 'within' ? (c.days != null && c.days <= +v) : (c.days == null || c.days > +v);
      case 'spent': return r.op === 'lte' ? c.spent <= +v : c.spent >= +v;
      case 'nps': return r.op === 'null' ? c.nps == null : c.nps != null && (r.op === 'lte' ? c.nps <= +v : c.nps >= +v);
      case 'channel': return c.channel === v;
      case 'tags': return c.tags.includes(v);
      case 'consent': return r.op === 'not' ? !consentOk(c.key, v, at) : consentOk(c.key, v, at);
      default: return true;
    }
  }
  const matches = (s, c, at) => !s || !s.rules.length ? true : s.match === 'any' ? s.rules.some(r => testRule(c, r, at)) : s.rules.every(r => testRule(c, r, at));
  const ruleText = (r) => { const F = FIELDS[r.f]; if (!F) return ''; const op = (F.ops.find(o => o[0] === r.op) || F.ops[0])[1]; const vals = F.values ? F.values([]) : []; const vl = (vals.find(x => x[0] === r.v) || [0, r.v])[1]; return F.label + ' ' + op + (noValue(r) ? '' : ' ' + (r.f === 'spent' ? 'S/ ' + fmtN(+r.v, 0) : vl)); };
  const segText = (s) => s.rules.length ? s.rules.map(ruleText).join(s.match === 'any' ? ' · O · ' : ' · Y · ') : 'Todos los contactos';

  /* ---------------- Audiencia y supresión ---------------- */
  function fatigue(key, at, exceptId) {
    const lim = parseD(at).getTime() - 72 * 3600000;
    return (DB.campaigns || []).some(c => c.id !== exceptId && ['enviada', 'enviando'].includes(c.status) && c.sentAt && c.sentAt <= at && parseD(c.sentAt).getTime() >= lim && c.recipients.some(r => r.k === key));
  }
  function audience(s, ch, at, exceptId) {
    at = at || nowStr();
    const all = contacts().filter(c => matches(s, c, at));
    const out = { matched: all.length, eligible: [], sup: { optout: [], nodata: [], consent: [], fatigue: [] } };
    all.forEach(c => {
      const addr = ch === 'email' ? c.email : waNumber(c.phone);
      if (optedOut(c.key, ch, at)) out.sup.optout.push(c);
      else if (!addr) out.sup.nodata.push(c);
      else if (!consentOk(c.key, ch, at)) out.sup.consent.push(c);
      else if (fatigue(c.key, at, exceptId)) out.sup.fatigue.push(c);
      else out.eligible.push(Object.assign({ to: addr }, c));
    });
    return out;
  }
  const snapAud = (a) => ({ matched: a.matched, eligible: a.eligible.length, optout: a.sup.optout.length, nodata: a.sup.nodata.length, consent: a.sup.consent.length, fatigue: a.sup.fatigue.length, at: nowStr() });
  function makeRecipients(c, elig) {
    return elig.map(x => {
      const h = hash(x.key + c.id); const em = c.channel === 'email';
      const d = h >= (em ? 4 : 3); const o = d && h < (em ? 60 : 86); const cl = o && h < (em ? 24 : 36); const r = o && (em ? h % 17 === 0 : h < 18);
      return { k: x.key, name: x.name, to: x.to, d, o, c: cl, r, u: false };
    });
  }
  const SUP_LBL = { optout: 'Baja (opt-out) registrada', nodata: 'Sin dato de contacto válido para el canal', consent: 'Sin consentimiento para el canal', fatigue: 'Recibió otra campaña en las últimas 72 h' };
  function supTable(a) {
    const n = (k) => Array.isArray(a.sup ? a.sup[k] : null) ? a.sup[k].length : (a[k] || 0);
    const matched = a.matched, eligible = Array.isArray(a.eligible) ? a.eligible.length : a.eligible;
    return '<div class="mk-sup"><span>Coinciden con el segmento</span><b class="num">' + matched + '</b>' + Object.keys(SUP_LBL).map(k => '<span class="muted">− ' + SUP_LBL[k] + '</span><b class="num">' + n(k) + '</b>').join('') + '<span style="border-top:1px solid var(--line);padding-top:6px;font-weight:600">Destinatarios elegibles</span><b class="num" style="border-top:1px solid var(--line);padding-top:6px">' + eligible + '</b></div>';
  }

  /* ---------------- Plantillas: variables y vista previa ---------------- */
  const VARS = ['nombre', 'destino', 'asesor', 'codigo_promo', 'fecha_viaje', 'agencia', 'enlace_baja'];
  function renderVars(text, ct, c) {
    const first = ct ? String(ct.name).split(' ')[0] : 'Andrea';
    const owner = ct && ct.owner ? Q.userName(ct.owner).split(' ').slice(0, 2).join(' ') : 'Mariela Quispe';
    const map = { nombre: first, destino: ct && ct.dests[0] ? ct.dests[ct.dests.length > 1 && ct.dests[1] === 'Cusco' ? 1 : 0] : 'Cusco', asesor: owner, codigo_promo: c && c.promo ? c.promo.code : '(sin código)', fecha_viaje: date(addDays(TD(), 3)), agencia: DB.tenant.short + ' Travel', enlace_baja: 'andeshorizonte.pe/baja?t=' + (ct ? ct.key.split(':')[1].toLowerCase() : 'demo') };
    return esc(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => map[k] != null ? '<b>' + esc(map[k]) + '</b>' : m);
  }
  function preview(channel, subject, body, ct, c) {
    if (channel === 'whatsapp') return '<div class="mk-wa"><div class="mk-wa-b">' + renderVars(body, ct, c) + '</div><div class="mk-wa-m">WhatsApp Business · plantilla de Meta · ' + esc(ct ? (waNumber(ct.phone) || 'sin número') : '+51 9xx xxx xxx') + '</div></div>';
    return '<div class="mk-mail"><div class="mk-mail-h"><span><span class="faint">De:</span> ' + esc(DB.tenant.short) + ' Travel &lt;novedades@andeshorizonte.pe&gt;</span><span><span class="faint">Para:</span> ' + esc(ct ? ct.email : 'contacto@correo.pe') + '</span><span><span class="faint">Asunto:</span> <b>' + renderVars(subject, ct, c) + '</b></span></div><div class="mk-mail-b">' + renderVars(body, ct, c) + '</div><div class="mk-mail-f">' + esc(DB.tenant.name) + ' · RUC ' + esc(DB.tenant.ruc) + ' · Banco de datos inscrito ante la ANPD (Ley 29733)</div></div>';
  }
  const tplStatus = (t) => t.channel === 'whatsapp' ? (t.status === 'aprobada' ? UI.badge('aprobada', 'Aprobada por Meta') : t.status === 'en_revision' ? UI.badge('en_revision', 'En revisión (Meta)') : UI.badge('rechazada', 'Rechazada por Meta')) : UI.badge('activa');

  /* ---------------- Métricas y atribución ---------------- */
  function metrics(c) {
    const R = c.recipients || [];
    return { sent: R.length, delivered: R.filter(r => r.d).length, opened: R.filter(r => r.o).length, clicked: R.filter(r => r.c).length, replied: R.filter(r => r.r).length, unsub: R.filter(r => r.u).length };
  }
  /* Atribución last-touch 30 días: reserva/lead de un destinatario creado tras el envío, sin otra campaña posterior al mismo contacto antes de la conversión; o uso del código promocional. */
  function attribution(c) {
    const out = { leads: [], res: [], revenue: 0, promoUses: 0 };
    if (c.status !== 'enviada' || !c.sentAt) return out;
    const end = addDays(c.sentAt.slice(0, 10), 30) + ' 23:59';
    const keys = new Set(c.recipients.map(r => r.k));
    const sentTo = (key, before) => (DB.campaigns || []).filter(x => x.status === 'enviada' && x.sentAt && x.sentAt <= before && x.recipients.some(r => r.k === key)).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    const clientKeys = {}; c.recipients.forEach(r => { const [t, id] = r.k.split(':'); if (t === 'client') clientKeys[id] = r.k; if (t === 'subscriber') { const s = (DB.subscribers || []).find(x => x.id === id); if (s && s.clientId) clientKeys[s.clientId] = r.k; } });
    DB.clients.forEach(cl => { if (clientKeys[cl.id]) return; const sub = (DB.subscribers || []).find(s => s.clientId === cl.id); if (sub && keys.has('subscriber:' + sub.id)) clientKeys[cl.id] = 'subscriber:' + sub.id; });
    DB.reservations.filter(r => resOk(r) && clientKeys[r.clientId] && r.createdAt > c.sentAt && r.createdAt <= end && !(r.quoteId && (Q.quote(r.quoteId) || {}).createdAt < c.sentAt)).forEach(r => { const lt = sentTo(clientKeys[r.clientId], r.createdAt); if (lt && lt.id === c.id) { out.res.push(r); out.revenue += toPEN(r.total, r.currency); } });
    const emails = new Set(c.recipients.map(r => { const ct = r.k.split(':'); const s = ct[0] === 'subscriber' ? (DB.subscribers || []).find(x => x.id === ct[1]) : null; return s ? normE(s.email) : ''; }).filter(Boolean));
    (DB.subscribers || []).filter(s => s.clientId && keys.has('client:' + s.clientId)).forEach(s => emails.add(normE(s.email)));
    DB.leads.filter(l => l.createdAt > c.sentAt && l.createdAt <= end && emails.has(normE(l.email))).forEach(l => out.leads.push(l));
    if (c.promo) out.promoUses = (DB.ecomOrders || []).filter(o => o.promo && String(o.promo).toUpperCase() === c.promo.code && o.date > c.sentAt && o.date <= end).length;
    return out;
  }

  /* ===================================================================
     MARKETING — Hub con pestañas
     =================================================================== */
  const TABS = ['campanas', 'segmentos', 'plantillas', 'automatizaciones', 'consentimientos'];
  const CH_LBL = { email: 'Email', whatsapp: 'WhatsApp' };
  const chTag = (ch) => '<span class="tag">' + UI.icon(ch === 'email' ? 'mail' : 'msg') + CH_LBL[ch] + '</span>';
  const CST = { borrador: ['borrador', 'Borrador'], programada: ['programada', 'Programada'], enviando: ['enviando', 'Enviando'], enviada: ['enviado', 'Enviada'], cancelada: ['cancelada', 'Cancelada'] };
  const cBadge = (s) => s === 'programada' ? UI.badge('asignada', 'Programada') : s === 'enviando' ? UI.badge('en_curso', 'Enviando') : UI.badge(CST[s][0], CST[s][1]);
  const crumbs = (last) => [['Inicio', '#/dashboard'], ['Marketing'], ['Campañas y segmentos', '#/marketing/campanas']].concat(last ? [[last]] : []);

  App.register('marketing', () => { location.hash = '#/marketing/campanas'; });
  App.register('marketing/campanas', (el, params) => {
    ensureMkt();
    if (!can(MK)) return blocked(el, MK, 'Campañas y segmentos');
    const p0 = params[0];
    if (p0 === 'nueva') return campaignEditor(el, null);
    if (p0 && /^CMP-/.test(p0)) return params[1] === 'editar' ? campaignEditor(el, p0) : campaignDetail(el, p0);
    const tab = TABS.includes(p0) ? p0 : recall('mk_tab', 'campanas');
    const sent = DB.campaigns.filter(c => c.status === 'enviada' && daysFromToday(c.sentAt.slice(0, 10)) >= -90);
    const M = sent.map(metrics); const tot = (k) => sum(M, k);
    const att = sent.map(attribution);
    const allC = contacts(); const reachE = allC.filter(c => consentOk(c.key, 'email')).length, reachW = allC.filter(c => consentOk(c.key, 'whatsapp')).length;
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Campañas y segmentos', subtitle: 'Marketing con consentimiento: segmentos dinámicos → campaña email/WhatsApp → envío con supresión (Ley 29733) → métricas y atribución a leads y reservas.', crumbs: crumbs(), actions: '<a class="btn" href="#/marketing/segmentos/nuevo">' + UI.icon('filter') + 'Nuevo segmento</a><a class="btn primary" href="#/marketing/campanas/nueva">' + UI.icon('plus') + 'Nueva campaña</a>' }) +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Campañas enviadas (90 d)', value: sent.length, sub: tot('sent') + ' mensajes', tone: 'accent', icon: 'send' }) +
        UI.kpi({ label: 'Tasa de apertura / lectura', value: fmtN(pct(tot('opened'), tot('delivered')), 1) + '%', sub: 'sobre ' + tot('delivered') + ' entregados', tone: 'info', icon: 'eye' }) +
        UI.kpi({ label: 'Clics (CTR)', value: fmtN(pct(tot('clicked'), tot('delivered')), 1) + '%', sub: tot('clicked') + ' clics · ' + tot('replied') + ' respuestas', tone: 'violet', icon: 'link' }) +
        UI.kpi({ label: 'Ingresos atribuidos', value: S0(sum(att, 'revenue')), sub: sum(att, a => a.res.length) + ' reservas · ' + sum(att, a => a.leads.length) + ' leads', tone: 'ok', icon: 'trending' }) +
        UI.kpi({ label: 'Contactables', value: reachE + ' / ' + reachW, sub: 'email / WhatsApp de ' + allC.length + ' contactos', tone: 'sun', icon: 'shield' }) +
      '</div><div id="mk-tabs"></div></div>';
    UI.tabs(el.querySelector('#mk-tabs'), [
      { id: 'campanas', label: 'Campañas', count: DB.campaigns.length, render: tabCampaigns },
      { id: 'segmentos', label: 'Segmentos', count: DB.segments.length, render: tabSegments },
      { id: 'plantillas', label: 'Plantillas', count: DB.mktTemplates.length, render: tabTemplates },
      { id: 'automatizaciones', label: 'Automatizaciones', count: DB.automations.filter(a => a.status === 'activa').length, render: tabAutomations },
      { id: 'consentimientos', label: 'Consentimientos (Ley 29733)', render: tabConsents }
    ], tab, { onChange: (id) => remember('mk_tab', id) });
  });
  function blocked(el, perm, what) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: what }) + UI.alert('warn', 'Requiere permiso <span class="mono">' + perm + '</span>.') + '</div>'; }

  /* ---- Pestaña: campañas ---- */
  function tabCampaigns(b) {
    UI.dataTable(b, {
      exportName: 'campanas', rows: () => DB.campaigns.slice().sort((a, b) => (b.sentAt || b.scheduledAt || b.createdAt).localeCompare(a.sentAt || a.scheduledAt || a.createdAt)),
      search: c => [c.id, c.name, (seg(c.segmentId) || {}).name].join(' '), searchPlaceholder: 'Buscar campaña…',
      filters: [{ key: 'status', label: 'Estado', options: Object.keys(CST).map(k => [k, CST[k][1]]) }, { key: 'channel', label: 'Canal', options: [['email', 'Email'], ['whatsapp', 'WhatsApp']] }],
      columns: [
        { key: 'name', label: 'Campaña', render: c => '<div class="cell-main">' + esc(c.name) + '</div><div class="cell-sub mono">' + c.id + (c.promo ? ' · ' + esc(c.promo.code) : '') + '</div>' },
        { key: 'channel', label: 'Canal', render: c => chTag(c.channel) },
        { key: 'segmentId', label: 'Segmento', render: c => '<span class="small">' + esc((seg(c.segmentId) || {}).name || '—') + '</span>', csv: c => (seg(c.segmentId) || {}).name },
        { key: 'status', label: 'Estado', render: c => cBadge(c.status), csv: c => CST[c.status][1] },
        { key: 'when', label: 'Envío', sortVal: c => c.sentAt || c.scheduledAt || '', render: c => c.sentAt ? datetime(c.sentAt) : c.scheduledAt ? '<span class="small">' + datetime(c.scheduledAt) + '</span><div class="cell-sub">programada</div>' : '<span class="faint">—</span>', csv: c => c.sentAt || c.scheduledAt || '' },
        { key: 'sent', label: 'Enviados', align: 'num', sortVal: c => metrics(c).sent, render: c => c.recipients.length ? fmtN(c.recipients.length, 0) : '—', csv: c => c.recipients.length },
        { key: 'open', label: 'Apertura', align: 'num', sortVal: c => { const m = metrics(c); return pct(m.opened, m.delivered); }, render: c => { const m = metrics(c); return m.sent ? fmtN(pct(m.opened, m.delivered), 1) + '%' : '—'; }, csv: c => { const m = metrics(c); return m.sent ? pct(m.opened, m.delivered).toFixed(1) : ''; } },
        { key: 'conv', label: 'Conversiones', align: 'num', sort: false, render: c => { if (c.status !== 'enviada') return '—'; const a = attribution(c); return a.leads.length + ' L · ' + a.res.length + ' R'; }, csv: c => { const a = attribution(c); return a.leads.length + ' leads / ' + a.res.length + ' reservas'; } },
        { key: 'rev', label: 'Ingresos', align: 'num', sortVal: c => attribution(c).revenue, render: c => c.status === 'enviada' ? '<span class="nowrap">' + S0(attribution(c).revenue) + '</span>' : '—', csv: c => attribution(c).revenue.toFixed(2) }
      ],
      onRow: c => App.go('#/marketing/campanas/' + c.id)
    });
  }

  /* ---- Pestaña: segmentos ---- */
  function tabSegments(b) {
    const cs = contacts();
    UI.dataTable(b, {
      exportName: 'segmentos', rows: () => DB.segments, search: s => s.id + ' ' + s.name + ' ' + segText(s), searchPlaceholder: 'Buscar segmento…',
      toolbar: '<a class="btn sm primary" href="#/marketing/segmentos/nuevo">' + UI.icon('plus') + 'Nuevo segmento</a>',
      columns: [
        { key: 'name', label: 'Segmento', render: s => '<div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc(segText(s)) + '</div>' },
        { key: 'count', label: 'Contactos', align: 'num', sortVal: s => cs.filter(c => matches(s, c)).length, render: s => '<b>' + cs.filter(c => matches(s, c)).length + '</b>', csv: s => cs.filter(c => matches(s, c)).length },
        { key: 'em', label: 'Email OK', align: 'num', sort: false, render: s => cs.filter(c => matches(s, c) && consentOk(c.key, 'email')).length, csv: s => cs.filter(c => matches(s, c) && consentOk(c.key, 'email')).length },
        { key: 'wa', label: 'WhatsApp OK', align: 'num', sort: false, render: s => cs.filter(c => matches(s, c) && consentOk(c.key, 'whatsapp') && waNumber(c.phone)).length, csv: s => cs.filter(c => matches(s, c) && consentOk(c.key, 'whatsapp')).length },
        { key: 'used', label: 'Campañas', align: 'num', sortVal: s => DB.campaigns.filter(c => c.segmentId === s.id).length, render: s => DB.campaigns.filter(c => c.segmentId === s.id).length },
        { key: 'updatedAt', label: 'Actualizado', render: s => '<span class="small">' + datetime(s.updatedAt) + '</span><div class="cell-sub">' + esc(Q.userName(s.owner)) + '</div>' }
      ],
      onRow: s => App.go('#/marketing/segmentos/' + s.id)
    });
  }

  /* ---- Pestaña: plantillas ---- */
  function tabTemplates(b) {
    UI.dataTable(b, {
      exportName: 'plantillas', rows: () => DB.mktTemplates, search: t => t.id + ' ' + t.name + ' ' + t.subject + ' ' + t.body, searchPlaceholder: 'Buscar plantilla…',
      toolbar: '<button class="btn sm primary" id="tp-new">' + UI.icon('plus') + 'Nueva plantilla</button>',
      filters: [{ key: 'channel', label: 'Canal', options: [['email', 'Email'], ['whatsapp', 'WhatsApp']] }],
      columns: [
        { key: 'name', label: 'Plantilla', render: t => '<div class="cell-main' + (t.channel === 'whatsapp' ? ' mono' : '') + '">' + esc(t.name) + '</div><div class="cell-sub">' + esc(t.id) + (t.metaId ? ' · ' + esc(t.metaId) : '') + '</div>' },
        { key: 'channel', label: 'Canal', render: t => chTag(t.channel) },
        { key: 'category', label: 'Categoría', render: t => '<span class="tag">' + esc(t.category) + '</span>' },
        { key: 'status', label: 'Estado', render: tplStatus, csv: t => t.status },
        { key: 'used', label: 'Uso', align: 'num', sort: false, render: t => DB.campaigns.filter(c => c.templateId === t.id).length + DB.automations.filter(a => a.templateId === t.id).length },
        { key: 'updatedAt', label: 'Actualizada', render: t => '<span class="small">' + datetime(t.updatedAt) + '</span>' }
      ],
      onRow: t => templateModal(t)
    });
    b.querySelector('#tp-new').onclick = () => templateModal(null);
  }
  function templateModal(t) {
    const isNew = !t; const d = t ? Object.assign({}, t) : { channel: 'email', category: 'MARKETING', name: '', subject: '', body: 'Hola {{nombre}}:\n\n\n\n{{agencia}}\n\n—\nDarte de baja: {{enlace_baja}}' };
    const sample = contacts().find(c => c.type === 'client' && c.dests.length) || null;
    UI.modal({
      title: isNew ? 'Nueva plantilla' : 'Plantilla ' + esc(t.name), size: 'lg', sub: isNew ? 'Las plantillas de WhatsApp de categoría MARKETING requieren aprobación de Meta antes de usarse.' : tplStatus(t) + (t.metaId ? ' · ID Meta ' + esc(t.metaId) : ''),
      body: '<div class="grid g2"><div>' + UI.form([
        { id: 'tp_name', label: 'Nombre' + (d.channel === 'whatsapp' ? ' (minúsculas y guion bajo, como en Meta)' : ''), value: d.name, required: true, col: 12 },
        { id: 'tp_ch', label: 'Canal', type: 'select', options: [['email', 'Email'], ['whatsapp', 'WhatsApp']], value: d.channel, col: 6, disabled: !isNew },
        { id: 'tp_cat', label: 'Categoría', type: 'select', options: ['MARKETING', 'UTILITY', 'SERVICIO'], value: d.category, col: 6 },
        { id: 'tp_sub', label: 'Asunto (email)', value: d.subject, col: 12 },
        { id: 'tp_body', label: 'Contenido', type: 'textarea', rows: 9, value: d.body, required: true, col: 12 }
      ]) + '<div class="xs faint" style="margin-top:8px">Variables (clic para insertar):</div><div class="mk-vars">' + VARS.map(v => '<span class="tag mono" data-var="' + v + '">{{' + v + '}}</span>').join('') + '</div></div>' +
        '<div><div class="upper" style="margin-bottom:8px">Vista previa' + (sample ? ' · ' + esc(sample.name) : '') + '</div><div id="tp-prev"></div><div id="tp-rules" style="margin-top:10px"></div></div></div>',
      onOpen: (m) => {
        let last = m.querySelector('#tp_body');
        m.querySelectorAll('#tp_body,#tp_sub').forEach(x => x.addEventListener('focus', () => { last = x; }));
        const upd = () => {
          const f = UI.formData(m); const ch = isNew ? f.tp_ch : d.channel;
          m.querySelector('#tp_sub').closest('.field').style.display = ch === 'email' ? '' : 'none';
          m.querySelector('#tp-prev').innerHTML = preview(ch, f.tp_sub, f.tp_body, sample, { promo: { code: 'PRIMAVERA8' } });
          const probs = tplProblems(ch, f.tp_cat, f.tp_body);
          m.querySelector('#tp-rules').innerHTML = probs.length ? UI.alert('warn', probs.join('<br>')) : UI.alert('ok', 'Cumple las reglas de baja y variables.');
        };
        m.querySelectorAll('[data-var]').forEach(s => s.onclick = () => { const v = '{{' + s.dataset.var + '}}'; const i = last.selectionStart || last.value.length; last.value = last.value.slice(0, i) + v + last.value.slice(i); last.focus(); upd(); });
        m.querySelectorAll('input,select,textarea').forEach(x => x.addEventListener('input', upd));
        upd();
      },
      actions: [{ label: 'Cerrar' }].concat(!isNew && t.channel === 'whatsapp' && t.status === 'en_revision' ? [{ label: 'Registrar respuesta de Meta: aprobada', icon: 'check', onClick: () => { if (!need(MK, 'gestionar plantillas')) return false; t.status = 'aprobada'; t.updatedAt = nowStr(); Audit.log('Plantilla', t.id, 'aprobacion_meta', 'en_revision', 'aprobada'); Store.save(); UI.toast('Plantilla ' + esc(t.name) + ' aprobada por Meta.'); App.render(); } }] : []).concat([{ label: isNew ? 'Crear plantilla' : 'Guardar cambios', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!need(MK, 'gestionar plantillas')) return false;
        if (!UI.validate(m)) return false; const f = UI.formData(m); const ch = isNew ? f.tp_ch : d.channel;
        const probs = tplProblems(ch, f.tp_cat, f.tp_body);
        if (probs.length) { UI.toast(probs[0], 'bad'); return false; }
        if (ch === 'email' && !f.tp_sub) { UI.toast('El asunto es obligatorio en plantillas de email.', 'bad'); return false; }
        if (ch === 'whatsapp' && !/^[a-z0-9_]+$/.test(f.tp_name)) { UI.toast('Nombre de plantilla WhatsApp: solo minúsculas, números y guion bajo (formato Meta).', 'bad'); return false; }
        if (isNew) {
          const n = { id: nextId(DB.mktTemplates, 'TPL-', 2), name: f.tp_name, channel: ch, category: f.tp_cat, status: ch === 'whatsapp' ? 'en_revision' : 'activa', metaId: ch === 'whatsapp' ? 'wa_tpl_' + (8812600 + DB.mktTemplates.length) : undefined, subject: ch === 'email' ? f.tp_sub : '', body: f.tp_body, updatedAt: nowStr(), updatedBy: me() };
          DB.mktTemplates.push(n); Audit.log('Plantilla', n.id, 'crear', '', n.name + ' · ' + n.status); Store.save();
          UI.toast(ch === 'whatsapp' ? 'Plantilla enviada a aprobación de Meta (en revisión).' : 'Plantilla ' + n.id + ' creada.');
        } else {
          const changed = f.tp_body !== t.body || f.tp_sub !== t.subject || f.tp_cat !== t.category;
          const before = t.status;
          Object.assign(t, { name: f.tp_name, category: f.tp_cat, subject: ch === 'email' ? f.tp_sub : '', body: f.tp_body, updatedAt: nowStr(), updatedBy: me() });
          if (ch === 'whatsapp' && changed) t.status = 'en_revision';
          DB.campaigns.filter(c => c.templateId === t.id && c.status === 'borrador').forEach(c => { c.body = t.body; if (ch === 'email') c.subject = t.subject; });
          Audit.log('Plantilla', t.id, 'editar', before, t.status); Store.save();
          UI.toast(ch === 'whatsapp' && changed ? 'Cambios guardados: la plantilla vuelve a revisión de Meta (MKT-BR-03).' : 'Plantilla actualizada.', ch === 'whatsapp' && changed ? 'warn' : 'ok');
        }
        App.render();
      } }])
    });
  }
  function tplProblems(ch, cat, body) {
    const p = [];
    if (cat === 'MARKETING' && ch === 'email' && !/\{\{enlace_baja\}\}/.test(body)) p.push('MKT-BR-02: las plantillas comerciales de email deben incluir {{enlace_baja}} (baja en un clic).');
    if (cat === 'MARKETING' && ch === 'whatsapp' && !/BAJA/.test(body)) p.push('MKT-BR-02: las plantillas comerciales de WhatsApp deben indicar cómo darse de baja (p. ej. “Responde BAJA”).');
    const unk = (String(body).match(/\{\{(\w+)\}\}/g) || []).map(x => x.slice(2, -2)).filter(v => !VARS.includes(v));
    if (unk.length) p.push('Variables no reconocidas: ' + unk.map(v => '{{' + v + '}}').join(', '));
    return p;
  }

  /* ---- Pestaña: automatizaciones ---- */
  function autoQueue(a) {
    const cs = contacts(); const now = nowStr();
    const done = new Set(a.done || []);
    let items = [];
    if (a.key === 'welcome') items = cs.filter(c => c.type === 'subscriber' && c.createdAt && daysFromToday(c.createdAt.slice(0, 10)) >= -7).map(c => ({ c, ref: c.id, why: 'Suscrito el ' + datetime(c.createdAt) }));
    if (a.key === 'cart') items = (DB.ecomOrders || []).filter(o => o.status === 'pago_pendiente' && (parseD(now) - parseD(o.date)) > 3600000).map(o => ({ c: cs.find(c => c.name === o.customer || (o.email && normE(c.email) === normE(o.email))), ref: o.id, why: 'Pedido ' + o.id + ' · ' + Q.productName(o.product) + ' · ' + money(o.total, o.currency) })).filter(x => x.c);
    if (a.key === 'pretrip') items = DB.reservations.filter(r => ['confirmada', 'pendiente_pago', 'pendiente_proveedor'].includes(r.status) && daysFromToday(r.travelFrom) >= 0 && daysFromToday(r.travelFrom) <= 3).map(r => ({ c: cs.find(c => c.key === 'client:' + r.clientId), ref: r.id, why: r.id + ' inicia el ' + date(r.travelFrom) })).filter(x => x.c);
    if (a.key === 'survey') items = DB.reservations.filter(r => r.status === 'completada' && daysFromToday(r.travelTo) >= -7 && !surveyed(r)).map(r => ({ c: cs.find(c => c.key === 'client:' + r.clientId), ref: r.id, why: r.id + ' finalizó el ' + date(r.travelTo) })).filter(x => x.c);
    if (a.key === 'birthday') items = cs.filter(c => c.birth).filter(c => { const md = c.birth.slice(5); for (let i = 0; i <= 7; i++) { if (addDays(TD(), i).slice(5) === md) return true; } return false; }).map(c => ({ c, ref: c.id, why: 'Cumpleaños ' + dateShort(TD().slice(0, 4) + '-' + c.birth.slice(5)) }));
    if (a.key === 'reactivation') items = cs.filter(c => c.type === 'client' && (c.days != null ? c.days > 365 : daysFromToday((Q.client(c.id) || {}).createdAt || TD()) < -365)).map(c => ({ c, ref: c.id, why: c.last ? 'Última compra ' + date(c.last) : 'Sin compras desde el alta' }));
    items = items.filter(x => !done.has(x.c.key + '|' + x.ref) && !done.has(x.c.key));
    return items.map(x => { const ch = a.channel; const addr = ch === 'email' ? x.c.email : waNumber(x.c.phone); let block = ''; if (optedOut(x.c.key, ch)) block = 'Baja registrada'; else if (!addr) block = 'Sin dato para ' + CH_LBL[ch]; else if (a.purpose === 'comercial' && !consentOk(x.c.key, ch)) block = 'Sin consentimiento'; return Object.assign(x, { addr, block }); });
  }
  /* Encuesta ya registrada: en DB.surveys (módulo CRM) o como actividad de Postventa completada tras el viaje */
  const surveyed = (r) => (DB.surveys || []).some(s => s.resId === r.id) || DB.activities.some(x => x.type === 'Postventa' && x.status === 'completada' && x.relType === 'client' && x.relId === r.clientId && x.due.slice(0, 10) >= r.travelTo);
  function nextReactivation() {
    const cand = DB.clients.filter(c => !DB.reservations.some(r => r.clientId === c.id && resOk(r))).map(c => ({ c, d: addDays(c.createdAt, 365) }));
    DB.clients.forEach(c => { const last = DB.reservations.filter(r => r.clientId === c.id && resOk(r)).map(r => r.createdAt.slice(0, 10)).sort().pop(); if (last) cand.push({ c, d: addDays(last, 365) }); });
    return cand.filter(x => x.d > TD()).sort((a, b) => a.d.localeCompare(b.d))[0];
  }
  function tabAutomations(b) {
    b.innerHTML = UI.alert('info', '<b>Finalidad y consentimiento.</b> Las automatizaciones <b>comerciales</b> solo envían a contactos con consentimiento vigente para el canal. Las de <b>servicio</b> (recordatorio pre-viaje, encuesta post-viaje) se basan en la ejecución del contrato de viaje (Ley 29733, art. 14) y aun así respetan las bajas registradas. El job <span class="mono">mkt:automations</span> corre cada 15 min en producción.') +
      '<div class="mk-auto" style="margin-top:14px">' + DB.automations.map(a => {
        const q = autoQueue(a); const t = tpl(a.templateId); const okN = q.filter(x => !x.block).length;
        const nr = a.key === 'reactivation' && !q.length ? nextReactivation() : null;
        return UI.card(esc(a.name), '<div class="stack" style="gap:10px"><div class="row between"><span class="row" style="gap:6px">' + chTag(a.channel) + '<span class="tag">' + (a.purpose === 'comercial' ? 'Comercial' : 'Servicio') + '</span></span>' + (a.status === 'activa' ? UI.badge('activa') : UI.badge('pendiente', 'Pausada')) + '</div>' +
          UI.dl([['Disparador', esc(a.trigger)], ['Espera', esc(a.delay)], ['Plantilla', t ? esc(t.name) + ' ' + (t.channel === 'whatsapp' && t.status !== 'aprobada' ? UI.badge('en_revision', 'No aprobada') : '') : '—'], ['En cola ahora', '<b>' + q.length + '</b> · ' + okN + ' enviables' + (q.length - okN ? ' · ' + (q.length - okN) + ' suprimidos' : '') + (nr ? '<div class="xs faint">Próximo ingreso: ' + esc(nr.c.name) + ' el ' + date(nr.d) + '</div>' : '')], ['Acumulado', fmtN(a.stats.sent, 0) + ' enviados · ' + a.stats.conv + ' conversiones'], a.runs[0] ? ['Última ejecución', datetime(a.runs[0].ts) + ' · ' + a.runs[0].sent + ' env. / ' + a.runs[0].sup + ' sup.'] : null]) +
          (q.length ? '<div class="list" style="border:1px solid var(--line-2);border-radius:8px">' + q.slice(0, 4).map(x => '<div class="list-item" style="padding:7px 10px"><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + esc(x.c.name) + '</div><div class="xs faint">' + esc(x.why) + '</div></div>' + (x.block ? UI.badge('rechazado', x.block) : UI.badge('pendiente', 'En cola')) + '</div>').join('') + '</div>' : '') + '</div>',
          { footer: '<div class="row" style="gap:6px"><button class="btn sm" data-atog="' + a.id + '">' + UI.icon(a.status === 'activa' ? 'clock' : 'zap') + (a.status === 'activa' ? 'Pausar' : 'Activar') + '</button><button class="btn sm" data-arun="' + a.id + '"' + (a.status !== 'activa' ? ' disabled title="Active la automatización para ejecutarla"' : '') + '>' + UI.icon('refresh') + 'Ejecutar ahora</button><button class="btn sm ghost" data-aedit="' + a.id + '">' + UI.icon('edit') + 'Configurar</button></div>' });
      }).join('') + '</div>';
    b.querySelectorAll('[data-atog]').forEach(x => x.onclick = () => toggleAuto(DB.automations.find(a => a.id === x.dataset.atog)));
    b.querySelectorAll('[data-arun]').forEach(x => x.onclick = () => runAuto(DB.automations.find(a => a.id === x.dataset.arun)));
    b.querySelectorAll('[data-aedit]').forEach(x => x.onclick = () => editAuto(DB.automations.find(a => a.id === x.dataset.aedit)));
  }
  function toggleAuto(a) {
    if (!need(MK, 'gestionar automatizaciones')) return;
    const t = tpl(a.templateId);
    if (a.status !== 'activa' && t && t.channel === 'whatsapp' && t.status !== 'aprobada') { UI.toast('MKT-BR-03: la plantilla de WhatsApp de esta automatización no está aprobada por Meta.', 'bad'); return; }
    const before = a.status; a.status = a.status === 'activa' ? 'pausada' : 'activa'; a.updatedAt = nowStr(); a.updatedBy = me(); log(a, a.status === 'activa' ? 'Activada' : 'Pausada');
    Audit.log('Automatización', a.id, a.status === 'activa' ? 'activar' : 'pausar', before, a.status); Store.save();
    UI.toast(esc(a.name) + ': ' + (a.status === 'activa' ? 'activada' : 'pausada') + '.'); App.render();
  }
  function runAuto(a) {
    if (!need(MK, 'ejecutar automatizaciones')) return;
    if (a.status !== 'activa') { UI.toast('La automatización está pausada.', 'warn'); return; }
    const q = autoQueue(a); if (!q.length) { UI.toast('No hay contactos en cola para “' + esc(a.name) + '”.', 'info'); return; }
    const t = tpl(a.templateId); let sent = 0, sup = 0;
    q.forEach(x => {
      a.done = a.done || []; a.done.push(x.c.key + '|' + x.ref);
      if (x.block) { sup++; return; }
      Notify.push('marketing.auto.' + a.key, CH_LBL[a.channel], x.addr, (t ? t.name : a.name) + ' — ' + x.c.name); sent++;
    });
    a.stats.sent += sent; a.stats.suppressed += sup; a.runs.unshift({ ts: nowStr(), sent, sup, by: me() }); log(a, 'Ejecución manual: ' + sent + ' enviados, ' + sup + ' suprimidos');
    Audit.log('Automatización', a.id, 'ejecutar', q.length + ' en cola', sent + ' enviados / ' + sup + ' suprimidos'); Store.save();
    UI.toast('Ejecución de “' + esc(a.name) + '”: ' + sent + ' enviados, ' + sup + ' suprimidos por consentimiento o baja.'); App.render();
  }
  function editAuto(a) {
    const opts = DB.mktTemplates.filter(t => t.channel === a.channel).map(t => [t.id, t.name + (t.channel === 'whatsapp' && t.status !== 'aprobada' ? ' (no aprobada)' : '')]);
    UI.modal({ title: 'Configurar: ' + esc(a.name), size: 'sm', sub: esc(a.trigger), body: UI.form([{ id: 'au_tpl', label: 'Plantilla', type: 'select', options: opts, value: a.templateId, col: 12 }, { id: 'au_delay', label: 'Espera / programación', value: a.delay, required: true, col: 12 }]) + '<div style="margin-top:12px">' + tl(a.history) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => {
        if (!need(MK, 'configurar automatizaciones')) return false; if (!UI.validate(m)) return false; const f = UI.formData(m); const t = tpl(f.au_tpl);
        if (a.status === 'activa' && t.channel === 'whatsapp' && t.status !== 'aprobada') { UI.toast('MKT-BR-03: no puede usar una plantilla WhatsApp no aprobada en una automatización activa.', 'bad'); return false; }
        const before = a.templateId + ' · ' + a.delay; a.templateId = f.au_tpl; a.delay = f.au_delay; a.updatedAt = nowStr(); a.updatedBy = me(); log(a, 'Configuración: ' + t.name + ' · ' + a.delay);
        Audit.log('Automatización', a.id, 'configurar', before, a.templateId + ' · ' + a.delay); Store.save(); UI.toast('Automatización actualizada.'); App.render();
      } }] });
  }

  /* ---- Pestaña: consentimientos ---- */
  const GRANT_SRC = ['Formulario web — casilla de marketing', 'Newsletter web (doble opt-in)', 'Checkout e-commerce — casilla', 'Ficha física firmada en oficina', 'Llamada grabada — consentimiento verbal', 'WhatsApp opt-in (respuesta SÍ)', 'Portal del cliente — preferencias', 'Contrato corporativo / convenio'];
  const REVOKE_SRC = ['Enlace de baja en correo', 'Respuesta BAJA por WhatsApp', 'Solicitud ARCO (derecho de oposición)', 'Portal del cliente — preferencias', 'Solicitud verbal registrada por asesor'];
  function tabConsents(b) {
    const cs = contacts(); const C = DB.consents;
    const rev30 = C.filter(x => x.status === 'revocado' && daysFromToday(x.revokedAt.slice(0, 10)) >= -30).length;
    const none = cs.filter(c => !consentRec(c.key, 'email') && !consentRec(c.key, 'whatsapp')).length;
    b.innerHTML = UI.alert('info', '<b>Ley 29733 y su Reglamento (D.S. 016-2024-JUS).</b> El uso de datos para publicidad es una finalidad adicional que requiere consentimiento <b>libre, previo, expreso, informado e inequívoco</b>, registrado por canal con fecha, origen, evidencia y versión de la política. La baja (derecho de oposición) se aplica de inmediato y el envío suprime automáticamente a quien no tenga consentimiento vigente.') +
      '<div class="grid g4" style="margin:14px 0">' +
        UI.kpi({ label: 'Email autorizado', value: cs.filter(c => consentOk(c.key, 'email')).length, sub: 'de ' + cs.length + ' contactos', tone: 'ok', icon: 'mail' }) +
        UI.kpi({ label: 'WhatsApp autorizado', value: cs.filter(c => consentOk(c.key, 'whatsapp')).length, sub: 'opt-in por canal', tone: 'ok', icon: 'msg' }) +
        UI.kpi({ label: 'Bajas últimos 30 días', value: rev30, sub: C.filter(x => x.status === 'revocado').length + ' bajas vigentes', tone: rev30 ? 'sun' : 'info', icon: 'x' }) +
        UI.kpi({ label: 'Sin consentimiento', value: none, sub: 'no reciben campañas', tone: 'bad', icon: 'lock' }) +
      '</div><div id="cn-tbl"></div>';
    const src = (k, ch) => { const r = consentRec(k, ch); return r ? (r.status === 'otorgado' ? date(r.grantedAt) + ' · ' + r.source : 'Baja ' + date(r.revokedAt) + ' · ' + r.revokeSource) : ''; };
    UI.dataTable(b.querySelector('#cn-tbl'), {
      exportName: 'consentimientos', rows: () => contacts(), search: c => c.name + ' ' + c.email + ' ' + c.phone + ' ' + c.id, searchPlaceholder: 'Buscar contacto, correo o teléfono…', pageSize: 10,
      filters: [{ key: 'type', label: 'Tipo', options: [['client', 'Cliente'], ['lead', 'Lead'], ['subscriber', 'Suscriptor']] }, { key: 'em', label: 'Email', options: [['ok', 'Otorgado'], ['rev', 'Baja'], ['none', 'Sin registro']], match: (c, v) => { const r = consentRec(c.key, 'email'); return v === 'none' ? !r : r && (v === 'ok' ? r.status === 'otorgado' : r.status === 'revocado'); } }, { key: 'wa', label: 'WhatsApp', options: [['ok', 'Otorgado'], ['rev', 'Baja'], ['none', 'Sin registro']], match: (c, v) => { const r = consentRec(c.key, 'whatsapp'); return v === 'none' ? !r : r && (v === 'ok' ? r.status === 'otorgado' : r.status === 'revocado'); } }],
      columns: [
        { key: 'name', label: 'Contacto', render: c => '<div class="cell-main">' + (c.href ? '<a href="' + c.href + '">' + esc(c.name) + '</a>' : esc(c.name)) + '</div><div class="cell-sub">' + typeLabel[c.type] + ' · ' + esc(c.id) + '</div>' },
        { key: 'email', label: 'Email', render: c => consentBadge(c.key, 'email') + '<div class="cell-sub">' + esc(src(c.key, 'email') || c.email || '—') + '</div>', csv: c => (consentRec(c.key, 'email') || {}).status || 'sin registro' },
        { key: 'phone', label: 'WhatsApp', render: c => consentBadge(c.key, 'whatsapp') + '<div class="cell-sub">' + esc(src(c.key, 'whatsapp') || (waNumber(c.phone) ? c.phone : 'Sin móvil')) + '</div>', csv: c => (consentRec(c.key, 'whatsapp') || {}).status || 'sin registro' },
        { key: 'csv_e', label: 'Origen email', sort: false, render: () => '', csv: c => src(c.key, 'email') },
        { key: 'act', label: '', sort: false, csv: () => '', render: c => '<button class="btn xs" data-cn="' + c.key + '">Gestionar</button>' }
      ].filter(col => col.key !== 'csv_e'),
      onRow: c => consentDrawer(c.key),
      afterDraw: (ct) => ct.querySelectorAll('[data-cn]').forEach(x => x.onclick = (e) => { e.stopPropagation(); consentDrawer(x.dataset.cn); })
    });
  }
  function consentDrawer(key) {
    const c = contactByKey(key); if (!c) return;
    const card = (ch) => { const r = consentRec(key, ch); const addr = ch === 'email' ? c.email : waNumber(c.phone);
      return UI.card(CH_LBL[ch], (r ? UI.dl([['Estado', consentBadge(key, ch)], ['Otorgado', datetime(r.grantedAt)], ['Origen', esc(r.source)], ['Evidencia', esc(r.evidence)], ['Política', esc(r.policyVersion)], r.status === 'revocado' ? ['Baja', datetime(r.revokedAt) + ' · ' + esc(r.revokeSource) + (r.revokeCampaign ? ' (' + esc(r.revokeCampaign) + ')' : '')] : null]) : UI.alert('warn', 'Sin consentimiento registrado. El contacto se suprime de todas las campañas por ' + CH_LBL[ch] + '.')) +
        '<div class="row" style="margin-top:10px;gap:6px">' + (!r || r.status === 'revocado' ? '<button class="btn sm primary" data-grant="' + ch + '"' + (addr ? '' : ' disabled title="Sin ' + (ch === 'email' ? 'correo' : 'celular') + ' válido"') + '>' + UI.icon('check') + 'Registrar consentimiento</button>' : '<button class="btn sm danger" data-revoke="' + ch + '">' + UI.icon('x') + 'Registrar baja (opt-out)</button>') + '</div>', { sub: esc(addr || 'Sin dato de contacto válido') }); };
    const hist = DB.consents.filter(x => x.key === key).flatMap(x => (x.history || []).map(h => Object.assign({ ch: x.channel }, h))).sort((a, b) => a.ts.localeCompare(b.ts));
    UI.drawer({ title: esc(c.name), sub: typeLabel[c.type] + ' · ' + esc(c.id) + ' · consentimientos por canal (Ley 29733)', wide: true,
      body: '<div class="grid g2">' + card('email') + card('whatsapp') + '</div><div class="section-title" style="margin:16px 0 10px">Historial</div>' + UI.timeline(hist.slice().reverse().map(h => ({ title: esc(CH_LBL[h.ch] + ' · ' + h.m), meta: datetime(h.ts) + ' · ' + esc(Q.userName(h.u)), icon: /Baja/.test(h.m) ? 'x' : 'check' }))) + '<p class="xs faint" style="margin-top:12px">Los registros de consentimiento no se eliminan: se conservan como evidencia ante la ANPD. Una baja solo se revierte con un nuevo consentimiento expreso.</p>',
      onOpen: (d) => {
        d.querySelectorAll('[data-grant]').forEach(x => x.onclick = () => grantConsent(c, x.dataset.grant));
        d.querySelectorAll('[data-revoke]').forEach(x => x.onclick = () => revokeConsent(c, x.dataset.revoke));
      } });
  }
  function grantConsent(c, ch) {
    if (!need(MK, 'registrar consentimientos')) return;
    UI.modal({ title: 'Registrar consentimiento — ' + CH_LBL[ch], size: 'sm', sub: esc(c.name), body: UI.form([{ id: 'cg_src', label: 'Origen', type: 'select', options: GRANT_SRC, required: true, col: 12 }, { id: 'cg_ev', label: 'Evidencia (IP, ID de formulario, grabación, ficha)', required: true, col: 12 }, { id: 'cg_pol', label: 'Versión de política informada', value: 'PDP-2026.1', required: true, col: 12 }]) + '<p class="xs faint" style="margin-top:10px">MKT-BR-11: sin origen ni evidencia no se registra consentimiento. No se admiten casillas pre-marcadas.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m);
        let r = consentRec(c.key, ch); const before = r ? r.status : 'sin registro';
        if (!r) { const [t, id] = c.key.split(':'); r = { id: nextId(DB.consents, 'CNS-', 4), key: c.key, subjectType: t, subjectId: id, channel: ch, history: [] }; DB.consents.push(r); }
        Object.assign(r, { status: 'otorgado', grantedAt: nowStr(), source: f.cg_src, evidence: f.cg_ev, policyVersion: f.cg_pol, revokedAt: null, revokeSource: '', revokeCampaign: null });
        r.history.push({ ts: nowStr(), u: me(), m: 'Consentimiento otorgado · ' + f.cg_src });
        Audit.log('Consentimiento', r.id, 'otorgar_' + ch, before, 'otorgado · ' + f.cg_src); Store.save();
        UI.toast('Consentimiento de ' + CH_LBL[ch] + ' registrado para ' + esc(c.name) + '.'); UI.closeDrawer(); consentDrawer(c.key);
      } }] });
  }
  function revokeConsent(c, ch, campaignId, silent) {
    if (!need(MK, 'registrar bajas')) return;
    const doIt = (src) => {
      const r = consentRec(c.key, ch); if (!r) return;
      r.status = 'revocado'; r.revokedAt = nowStr(); r.revokeSource = src; r.revokeCampaign = campaignId || null; r.history.push({ ts: nowStr(), u: me(), m: 'Baja (opt-out) · ' + src });
      Audit.log('Consentimiento', r.id, 'baja_' + ch, 'otorgado', 'revocado · ' + src);
      Notify.push('marketing.baja', ch === 'email' ? 'Email' : 'WhatsApp', ch === 'email' ? c.email : c.phone, 'Confirmación de baja de comunicaciones comerciales');
      Store.save();
    };
    if (silent) { doIt(silent); return; }
    UI.modal({ title: 'Registrar baja — ' + CH_LBL[ch], size: 'sm', sub: esc(c.name), body: UI.form([{ id: 'rv_src', label: 'Origen de la baja', type: 'select', options: REVOKE_SRC, col: 12 }]) + '<p class="small muted" style="margin-top:10px">La baja se aplica de inmediato: el contacto se excluye de campañas programadas y automatizaciones comerciales por este canal (MKT-BR-02). Se envía confirmación al titular.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Registrar baja', cls: 'danger', onClick: (m) => { doIt(UI.formData(m).rv_src); UI.toast('Baja registrada para ' + esc(c.name) + '.'); UI.closeDrawer(); consentDrawer(c.key); } }] });
  }

  /* ===================================================================
     CONSTRUCTOR DE SEGMENTOS
     =================================================================== */
  App.register('marketing/segmentos', (el, params) => {
    ensureMkt();
    if (!can(MK)) return blocked(el, MK, 'Segmentos');
    const id = params[0];
    const orig = id && id !== 'nuevo' ? seg(id) : null;
    if (id && id !== 'nuevo' && !orig) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Segmento no encontrado: ' + esc(id)) + '</div>'; return; }
    const d = orig ? JSON.parse(JSON.stringify(orig)) : { name: '', desc: '', match: 'all', rules: [{ f: 'consent', op: 'has', v: 'email' }] };
    const cs = contacts();
    const used = orig ? DB.campaigns.filter(c => c.segmentId === orig.id) : [];
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: orig ? esc(orig.name) : 'Nuevo segmento', subtitle: 'Segmento dinámico: se evalúa en el momento del envío con los datos vigentes de clientes, leads y suscriptores.', crumbs: crumbs(orig ? orig.id : 'Nuevo segmento'),
      actions: (orig ? '<button class="btn" id="sg-dup">' + UI.icon('copy') + 'Duplicar</button><button class="btn danger" id="sg-del">' + UI.icon('trash') + 'Eliminar</button><a class="btn" href="#/marketing/campanas/nueva?seg=' + orig.id + '" id="sg-camp">' + UI.icon('send') + 'Crear campaña</a>' : '') + '<button class="btn primary" id="sg-save">' + UI.icon('check') + 'Guardar segmento</button>' }) +
      '<div class="grid g-3-2"><div class="stack cg-col">' +
        UI.card('Definición', UI.form([{ id: 'sg_name', label: 'Nombre', value: d.name, required: true, col: 8 }, { id: 'sg_match', label: 'Coincidencia', type: 'select', options: [['all', 'Cumple TODAS las reglas (Y)'], ['any', 'Cumple ALGUNA regla (O)']], value: d.match, col: 4 }, { id: 'sg_desc', label: 'Descripción', value: d.desc, col: 12 }])) +
        UI.card('Reglas', '<div id="sg-rules"></div><button class="btn sm" id="sg-add" style="margin-top:10px">' + UI.icon('plus') + 'Agregar regla</button>', { sub: 'Segmento, país, destino de interés, última compra, gasto total, NPS, canal, etiquetas y consentimiento' }) +
        (used.length ? UI.card('Campañas que usan este segmento', '<div class="list">' + used.map(c => '<a class="list-item click" href="#/marketing/campanas/' + c.id + '"><div class="grow small"><b>' + esc(c.name) + '</b><div class="xs faint mono">' + c.id + '</div></div>' + cBadge(c.status) + '</a>').join('') + '</div>', { tight: true }) : '') +
      '</div><div class="stack cg-col"><div id="sg-live"></div></div></div></div>';
    const rulesEl = el.querySelector('#sg-rules'), live = el.querySelector('#sg-live');
    const drawRules = () => {
      rulesEl.innerHTML = d.rules.length ? d.rules.map((r, i) => { const F = FIELDS[r.f]; const vals = F.values ? F.values(cs) : [];
        return '<div class="mk-rule"><select class="input sm" data-rf="' + i + '" aria-label="Campo">' + Object.keys(FIELDS).map(k => '<option value="' + k + '"' + (k === r.f ? ' selected' : '') + '>' + FIELDS[k].label + '</option>').join('') + '</select>' +
          '<select class="input sm" data-ro="' + i + '" aria-label="Operador">' + F.ops.map(o => '<option value="' + o[0] + '"' + (o[0] === r.op ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
          '<div class="rv">' + (noValue(r) ? '<span class="xs faint">sin valor</span>' : F.num ? '<input class="input sm" type="number" min="0" data-rv="' + i + '" value="' + esc(r.v) + '" aria-label="Valor">' : '<select class="input sm" data-rv="' + i + '" aria-label="Valor">' + vals.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(r.v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>') + '</div>' +
          '<button class="btn ghost icon sm" data-rx="' + i + '" title="Quitar regla" aria-label="Quitar regla">' + UI.icon('x') + '</button></div>'; }).join('') : UI.empty('Sin reglas: el segmento incluye a todos los contactos.', 'filter');
      rulesEl.querySelectorAll('[data-rf]').forEach(s => s.onchange = () => { const r = d.rules[+s.dataset.rf]; r.f = s.value; const F = FIELDS[r.f]; r.op = F.ops[0][0]; r.v = F.num ? (r.f === 'last' ? 365 : r.f === 'nps' ? 9 : 1000) : ((F.values(cs)[0] || [''])[0]); drawRules(); });
      rulesEl.querySelectorAll('[data-ro]').forEach(s => s.onchange = () => { d.rules[+s.dataset.ro].op = s.value; drawRules(); });
      rulesEl.querySelectorAll('[data-rv]').forEach(s => s.addEventListener(s.tagName === 'INPUT' ? 'input' : 'change', () => { d.rules[+s.dataset.rv].v = s.tagName === 'INPUT' ? Number(s.value) : s.value; drawLive(); }));
      rulesEl.querySelectorAll('[data-rx]').forEach(s => s.onclick = () => { d.rules.splice(+s.dataset.rx, 1); drawRules(); });
      drawLive();
    };
    const drawLive = () => {
      d.match = el.querySelector('#sg_match').value;
      const m = cs.filter(c => matches(d, c)); const ae = audience(d, 'email'), aw = audience(d, 'whatsapp');
      live.innerHTML = UI.card('Conteo en vivo', '<div class="row between"><div><div class="mk-count">' + m.length + '</div><div class="xs faint">contactos coinciden · ' + m.filter(c => c.type === 'client').length + ' clientes · ' + m.filter(c => c.type === 'lead').length + ' leads · ' + m.filter(c => c.type === 'subscriber').length + ' suscriptores</div></div><div class="ico-box" style="width:44px;height:44px">' + UI.icon('users') + '</div></div>' +
        '<div class="grid g2" style="margin-top:14px;gap:12px"><div><div class="upper" style="margin-bottom:6px">Email</div>' + supTable(ae) + '</div><div><div class="upper" style="margin-bottom:6px">WhatsApp</div>' + supTable(aw) + '</div></div>', { sub: 'Supresión aplicada al enviar (Ley 29733)' }) +
        UI.card('Vista previa (' + Math.min(10, m.length) + ' de ' + m.length + ')', m.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Contacto</th><th>País</th><th class="num">Gasto S/</th><th>Email</th><th>WA</th></tr></thead><tbody>' + m.slice(0, 10).map(c => '<tr><td><div class="cell-main small">' + esc(c.name) + '</div><div class="cell-sub">' + typeLabel[c.type] + ' · ' + esc(c.segment) + '</div></td><td class="small">' + esc(c.country) + '</td><td class="num">' + fmtN(c.spent, 0) + '</td><td>' + (consentOk(c.key, 'email') ? UI.badge('activo', 'Sí') : UI.badge('mute', 'No')) + '</td><td>' + (consentOk(c.key, 'whatsapp') ? UI.badge('activo', 'Sí') : UI.badge('mute', 'No')) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Ningún contacto cumple las reglas.', 'search'), { tight: true });
    };
    el.querySelector('#sg_match').onchange = drawLive;
    el.querySelector('#sg-add').onclick = () => { d.rules.push({ f: 'country', op: 'eq', v: 'Perú' }); drawRules(); };
    el.querySelector('#sg-save').onclick = () => {
      if (!need(MK, 'guardar segmentos')) return;
      const root = el.querySelector('.card'); if (!UI.validate(root)) return; const f = UI.formData(root);
      if (DB.segments.some(s => s.name.toLowerCase() === f.sg_name.toLowerCase() && (!orig || s.id !== orig.id))) { UI.toast('Ya existe un segmento con ese nombre.', 'bad'); return; }
      d.rules.forEach(r => { if (FIELDS[r.f].num && !noValue(r)) r.v = Number(r.v) || 0; });
      if (orig) { const before = segText(orig); Object.assign(orig, { name: f.sg_name, desc: f.sg_desc, match: f.sg_match, rules: d.rules, updatedAt: nowStr() }); Audit.log('Segmento', orig.id, 'editar', before, segText(orig)); Store.save(); UI.toast('Segmento actualizado. Las campañas en borrador y programadas usarán las nuevas reglas al enviarse.'); App.render(); }
      else { const n = { id: nextId(DB.segments, 'SEG-', 3), name: f.sg_name, desc: f.sg_desc, match: f.sg_match, rules: d.rules, owner: me(), createdAt: nowStr(), updatedAt: nowStr() }; DB.segments.push(n); Audit.log('Segmento', n.id, 'crear', '', segText(n)); Store.save(); UI.toast('Segmento ' + n.id + ' creado.'); App.go('#/marketing/segmentos/' + n.id); }
    };
    if (orig) {
      el.querySelector('#sg-dup').onclick = () => { if (!need(MK, 'duplicar segmentos')) return; const n = Object.assign(JSON.parse(JSON.stringify(orig)), { id: nextId(DB.segments, 'SEG-', 3), name: orig.name + ' (copia)', owner: me(), createdAt: nowStr(), updatedAt: nowStr() }); DB.segments.push(n); Audit.log('Segmento', n.id, 'duplicar', orig.id, n.name); Store.save(); UI.toast('Segmento duplicado como ' + n.id + '.'); App.go('#/marketing/segmentos/' + n.id); };
      el.querySelector('#sg-del').onclick = () => {
        if (!need(MK, 'eliminar segmentos')) return;
        if (used.length) { UI.toast('MKT-BR-12: el segmento está vinculado a ' + used.length + ' campaña(s) (' + used.map(c => c.id).join(', ') + '). Se conserva como evidencia de la audiencia.', 'bad'); return; }
        UI.confirm({ title: 'Eliminar segmento', message: '¿Eliminar el segmento <b>' + esc(orig.name) + '</b>? No está usado por ninguna campaña.', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { DB.segments = DB.segments.filter(s => s.id !== orig.id); Audit.log('Segmento', orig.id, 'eliminar', orig.name, ''); Store.save(); UI.toast('Segmento eliminado.'); App.go('#/marketing/campanas/segmentos'); } });
      };
      el.querySelector('#sg-camp').onclick = (e) => { e.preventDefault(); remember('mk_newseg', orig.id); App.go('#/marketing/campanas/nueva'); };
    }
    drawRules();
  });

  /* ===================================================================
     EDITOR DE CAMPAÑA
     =================================================================== */
  function promoOptions() { return DB.products.flatMap(p => (p.promotions || []).filter(x => x.code && x.status === 'activa' && x.to >= TD()).map(x => [p.id + '|' + x.id, x.code + ' — ' + x.value + '% · ' + p.name + ' (hasta ' + dateShort(x.to) + ')'])); }
  function campaignEditor(el, id) {
    const orig = id ? DB.campaigns.find(c => c.id === id) : null;
    if (id && !orig) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Campaña no encontrada: ' + esc(id)) + '</div>'; return; }
    if (orig && orig.status !== 'borrador') { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(orig.name), crumbs: crumbs(orig.id) }) + UI.alert('warn', 'MKT-BR-08: solo se editan campañas en <b>Borrador</b>. Estado actual: ' + cBadge(orig.status) + (orig.status === 'programada' ? '. Desprograme la campaña para editarla.' : '.') + ' <a href="#/marketing/campanas/' + orig.id + '">Volver a la campaña</a>') + '</div>'; return; }
    const preSeg = recall('mk_newseg', ''); remember('mk_newseg', '');
    const d = orig ? JSON.parse(JSON.stringify(orig)) : { name: '', channel: 'email', segmentId: preSeg || 'SEG-001', templateId: 'TPL-01', subject: '', body: '', promo: null };
    if (!orig) { const t = tpl(d.templateId); d.subject = t.subject; d.body = t.body; }
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: orig ? 'Editar ' + esc(orig.id) : 'Nueva campaña', subtitle: 'Borrador → Programada → Enviando → Enviada. Antes de programar se exige un envío de prueba (MKT-BR-04).', crumbs: crumbs(orig ? orig.id : 'Nueva campaña'), actions: '<a class="btn" href="#/marketing/campanas' + (orig ? '/' + orig.id : '') + '">Cancelar</a><button class="btn primary" id="ce-save">' + UI.icon('check') + 'Guardar borrador</button>' }) +
      '<div class="grid g-3-2"><div class="stack cg-col">' + UI.card('Campaña', '<div id="ce-form"></div>') + UI.card('Contenido', '<div id="ce-content"></div>') + '</div><div class="stack cg-col"><div id="ce-aud"></div>' + UI.card('Vista previa', '<div class="field" style="margin-bottom:10px"><label for="ce-sample">Contacto de ejemplo</label><select class="input sm" id="ce-sample"></select></div><div id="ce-prev"></div>') + '</div></div></div>';
    const form = el.querySelector('#ce-form'), content = el.querySelector('#ce-content');
    const drawForm = () => {
      const pOpts = [['', 'Sin código promocional']].concat(promoOptions()).concat([['new', '+ Crear nuevo código…']]);
      const cur = d.promo ? d.promo.productId + '|' + d.promo.promoId : '';
      form.innerHTML = UI.form([
        { id: 'ce_name', label: 'Nombre interno', value: d.name, required: true, col: 12, placeholder: 'Ej.: Newsletter octubre — Arequipa y Colca' },
        { id: 'ce_ch', label: 'Canal', type: 'select', options: [['email', 'Email'], ['whatsapp', 'WhatsApp']], value: d.channel, col: 4 },
        { id: 'ce_seg', label: 'Segmento', type: 'select', options: DB.segments.map(s => [s.id, s.name]), value: d.segmentId, col: 8 },
        { id: 'ce_promo', label: 'Código promocional vinculado', type: 'select', options: pOpts, value: cur, col: 12, hint: 'Códigos activos de Productos › Promociones. El uso del código se atribuye a la campaña (MKT-BR-10).' }
      ]) + '<div id="ce-newpromo"></div>';
      form.querySelector('#ce_ch').onchange = (e) => { d.channel = e.target.value; const first = DB.mktTemplates.find(t => t.channel === d.channel && (t.channel === 'email' || t.status === 'aprobada')) || DB.mktTemplates.find(t => t.channel === d.channel); d.templateId = first.id; d.subject = first.subject; d.body = first.body; drawContent(); drawAud(); };
      form.querySelector('#ce_seg').onchange = (e) => { d.segmentId = e.target.value; drawAud(); };
      form.querySelector('#ce_name').oninput = (e) => { d.name = e.target.value; };
      form.querySelector('#ce_promo').onchange = (e) => {
        const v = e.target.value; const np = form.querySelector('#ce-newpromo');
        if (v === 'new') {
          np.innerHTML = '<div style="margin-top:10px;padding:12px;border:1px dashed var(--line);border-radius:8px">' + UI.form([{ id: 'np_code', label: 'Código', required: true, col: 4, placeholder: 'OCTUBRE10' }, { id: 'np_val', label: 'Descuento %', type: 'number', min: 1, max: 30, value: 10, required: true, col: 4 }, { id: 'np_prod', label: 'Producto', type: 'select', options: DB.products.filter(p => p.status === 'ACTIVE').map(p => [p.id, p.name]), col: 4 }, { id: 'np_from', label: 'Desde', type: 'date', value: TD(), col: 6 }, { id: 'np_to', label: 'Hasta', type: 'date', value: addDays(TD(), 30), col: 6 }]) + '<button class="btn sm primary" id="np-ok" style="margin-top:10px">' + UI.icon('plus') + 'Crear y vincular código</button></div>';
          np.querySelector('#np-ok').onclick = () => {
            if (!UI.validate(np)) return; const f = UI.formData(np); const code = String(f.np_code).toUpperCase().replace(/\s+/g, '');
            if (!/^[A-Z0-9]{4,20}$/.test(code)) { UI.toast('Código: 4 a 20 caracteres alfanuméricos sin espacios.', 'bad'); return; }
            if (DB.products.some(p => (p.promotions || []).some(x => x.code === code))) { UI.toast('MKT-BR-09: el código ' + esc(code) + ' ya existe.', 'bad'); return; }
            if (f.np_to < f.np_from) { UI.toast('Rango de vigencia inválido.', 'bad'); return; }
            const p = Q.product(f.np_prod); p.promotions = p.promotions || [];
            const pr = { id: nextId(DB.products.flatMap(x => x.promotions || []), 'PROMO-', 2), name: 'Campaña: ' + (d.name || code), kind: 'Descuento %', value: Number(f.np_val), from: f.np_from, to: f.np_to, channel: 'Todos', code, status: 'activa', campaignId: orig ? orig.id : null };
            p.promotions.push(pr); Audit.log('Promoción', pr.id, 'crear', '', code + ' ' + pr.value + '% (marketing)'); Store.save();
            d.promo = { productId: p.id, promoId: pr.id, code }; UI.toast('Código ' + code + ' creado y vinculado.'); drawForm(); drawPrev();
          };
        } else { np.innerHTML = ''; if (!v) d.promo = null; else { const [pid, prid] = v.split('|'); const pr = Q.product(pid).promotions.find(x => x.id === prid); d.promo = { productId: pid, promoId: prid, code: pr.code }; } drawPrev(); }
      };
    };
    const drawContent = () => {
      const opts = DB.mktTemplates.filter(t => t.channel === d.channel);
      const t = tpl(d.templateId);
      content.innerHTML = '<div class="form-grid"><div class="field c12"><label for="ce_tpl">Plantilla</label><select class="input" id="ce_tpl">' + opts.map(o => '<option value="' + o.id + '"' + (o.id === d.templateId ? ' selected' : '') + (o.channel === 'whatsapp' && o.status !== 'aprobada' ? ' disabled' : '') + '>' + esc(o.name) + (o.channel === 'whatsapp' ? (o.status === 'aprobada' ? ' — aprobada por Meta' : ' — ' + (o.status === 'en_revision' ? 'en revisión' : 'rechazada') + ' (no seleccionable)') : '') + '</option>').join('') + '</select></div>' +
        (d.channel === 'email' ? '<div class="field c12"><label for="ce_sub">Asunto <span class="req">*</span></label><input class="input" id="ce_sub" value="' + esc(d.subject) + '"></div><div class="field c12"><label for="ce_body">Cuerpo del correo</label><textarea class="input" id="ce_body" rows="10">' + esc(d.body) + '</textarea></div>' : '<div class="c12">' + UI.alert('info', 'WhatsApp: el texto es el de la plantilla aprobada por Meta y no se edita en la campaña; solo se completan las variables (MKT-BR-03).') + '<textarea class="input" rows="5" readonly style="margin-top:8px">' + esc(t ? t.body : '') + '</textarea></div>') +
        '</div><div class="xs faint" style="margin-top:8px">Variables:</div><div class="mk-vars">' + VARS.map(v => '<span class="tag mono" data-var="' + v + '">{{' + v + '}}</span>').join('') + '</div>' + (t && t.channel === 'whatsapp' && t.status !== 'aprobada' ? UI.alert('bad', 'MKT-BR-03: la plantilla <b>' + esc(t.name) + '</b> no está aprobada por Meta; la campaña no podrá programarse ni enviarse hasta su aprobación.') : '') + '<div id="ce-probs"></div>';
      let last = content.querySelector('#ce_body');
      content.querySelector('#ce_tpl').onchange = (e) => { d.templateId = e.target.value; const tt = tpl(d.templateId); d.subject = tt.subject; d.body = tt.body; drawContent(); };
      const sub = content.querySelector('#ce_sub'), body = content.querySelector('#ce_body');
      if (sub) { sub.oninput = () => { d.subject = sub.value; drawPrev(); }; sub.onfocus = () => { last = sub; }; }
      if (body) { body.oninput = () => { d.body = body.value; drawPrev(); }; body.onfocus = () => { last = body; }; }
      content.querySelectorAll('[data-var]').forEach(s => s.onclick = () => { if (!last) { UI.toast('En WhatsApp las variables vienen definidas por la plantilla aprobada.', 'info'); return; } const v = '{{' + s.dataset.var + '}}'; const i = last.selectionStart || last.value.length; last.value = last.value.slice(0, i) + v + last.value.slice(i); last.dispatchEvent(new Event('input')); last.focus(); });
      if (d.channel === 'whatsapp' && t) { d.body = t.body; d.subject = ''; }
      drawPrev();
    };
    let sampleKey = '';
    const drawAud = () => {
      const a = audience(seg(d.segmentId), d.channel, nowStr(), orig ? orig.id : null);
      el.querySelector('#ce-aud').innerHTML = UI.card('Audiencia estimada', supTable(a) + (a.eligible.length ? '' : UI.alert('warn', 'MKT-BR-07: no hay destinatarios elegibles para este canal.')), { sub: esc((seg(d.segmentId) || {}).name || '') + ' · ' + CH_LBL[d.channel] + ' · se recalcula al enviar' });
      const sel = el.querySelector('#ce-sample'); const list = a.eligible.length ? a.eligible : contacts().filter(c => matches(seg(d.segmentId), c));
      sel.innerHTML = list.slice(0, 30).map(c => '<option value="' + esc(c.key) + '">' + esc(c.name) + ' · ' + typeLabel[c.type] + '</option>').join('') || '<option value="">(sin contactos)</option>';
      sampleKey = sel.value; sel.onchange = () => { sampleKey = sel.value; drawPrev(); };
      drawPrev();
    };
    const drawPrev = () => {
      const ct = sampleKey ? contactByKey(sampleKey) : null;
      el.querySelector('#ce-prev').innerHTML = preview(d.channel, d.subject, d.body, ct, d);
      const pr = el.querySelector('#ce-probs'); if (pr) { const t = tpl(d.templateId); const probs = d.channel === 'email' ? tplProblems('email', t ? t.category : 'MARKETING', d.body) : []; pr.innerHTML = probs.length ? UI.alert('warn', probs.join('<br>')) : ''; }
    };
    drawForm(); drawContent(); drawAud();
    el.querySelector('#ce-save').onclick = () => {
      if (!need(MK, 'guardar campañas')) return;
      if (!UI.validate(form)) return; d.name = form.querySelector('#ce_name').value.trim();
      if (d.channel === 'email' && !String(d.subject).trim()) { UI.toast('El asunto es obligatorio.', 'bad'); return; }
      const t = tpl(d.templateId);
      if (d.channel === 'email') { const probs = tplProblems('email', t ? t.category : 'MARKETING', d.body); if (probs.length) { UI.toast(probs[0], 'bad'); return; } }
      if (orig) {
        const before = orig.segmentId + ' · ' + orig.templateId;
        Object.assign(orig, { name: d.name, channel: d.channel, segmentId: d.segmentId, templateId: d.templateId, subject: d.subject, body: d.body, promo: d.promo, utm: 'utm_source=' + (d.channel === 'email' ? 'newsletter' : 'whatsapp') + '&utm_medium=' + d.channel + '&utm_campaign=' + orig.id.toLowerCase() });
        if (orig.tests.length) { orig.tests = []; log(orig, 'Contenido editado: se requiere un nuevo envío de prueba'); } else log(orig, 'Borrador editado');
        Audit.log('Campaña', orig.id, 'editar', before, orig.segmentId + ' · ' + orig.templateId); Store.save(); UI.toast('Borrador guardado.'); App.go('#/marketing/campanas/' + orig.id);
      } else {
        const nid = nextId(DB.campaigns, 'CMP-', 4);
        const c = { id: nid, name: d.name, channel: d.channel, segmentId: d.segmentId, templateId: d.templateId, subject: d.subject, body: d.body, promo: d.promo, status: 'borrador', owner: me(), createdAt: nowStr(), scheduledAt: null, sentAt: null, tests: [], recipients: [], audience: null, history: [], utm: 'utm_source=' + (d.channel === 'email' ? 'newsletter' : 'whatsapp') + '&utm_medium=' + d.channel + '&utm_campaign=' + nid.toLowerCase() };
        if (d.promo) { const p = Q.product(d.promo.productId); const pr = p && p.promotions.find(x => x.id === d.promo.promoId); if (pr && !pr.campaignId) pr.campaignId = nid; }
        log(c, 'Campaña creada en borrador'); DB.campaigns.push(c); Audit.log('Campaña', nid, 'crear', '', c.name + ' · ' + CH_LBL[c.channel]); Store.save();
        UI.toast('Campaña ' + nid + ' creada en borrador.'); App.go('#/marketing/campanas/' + nid);
      }
    };
  }

  /* ===================================================================
     DETALLE DE CAMPAÑA
     =================================================================== */
  function campaignDetail(el, id) {
    const c = DB.campaigns.find(x => x.id === id);
    if (!c) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Campaña no encontrada: ' + esc(id)) + '</div>'; return; }
    const s = seg(c.segmentId), t = tpl(c.templateId);
    const sent = ['enviando', 'enviada'].includes(c.status);
    const a = sent ? null : audience(s, c.channel, c.scheduledAt && c.scheduledAt > nowStr() ? c.scheduledAt : nowStr(), c.id);
    const M = metrics(c), A = attribution(c);
    const steps = ['Borrador', 'Programada', 'Enviando', 'Enviada'];
    const idx = { borrador: 0, programada: 1, enviando: 2, enviada: 4, cancelada: 1 }[c.status];
    const acts = [];
    if (c.status === 'borrador') acts.push('<a class="btn" href="#/marketing/campanas/' + c.id + '/editar">' + UI.icon('edit') + 'Editar</a>');
    if (['borrador', 'programada'].includes(c.status)) acts.push('<button class="btn" id="cd-test">' + UI.icon('mail') + 'Envío de prueba</button>');
    if (c.status === 'borrador') acts.push('<button class="btn" id="cd-sched">' + UI.icon('calendar') + 'Programar</button>');
    if (c.status === 'programada') acts.push('<button class="btn" id="cd-unsched">' + UI.icon('clock') + 'Desprogramar</button>');
    if (['borrador', 'programada'].includes(c.status)) acts.push('<button class="btn danger" id="cd-cancel">' + UI.icon('x') + 'Cancelar</button><button class="btn primary" id="cd-send">' + UI.icon('send') + 'Enviar ahora</button>');
    if (c.status === 'enviando') acts.push('<button class="btn primary" id="cd-proc">' + UI.icon('refresh') + 'Procesar envío (job)</button>');
    acts.push('<button class="btn" id="cd-dup">' + UI.icon('copy') + 'Duplicar</button>');
    const ctSample = sent && c.recipients[0] ? contactByKey(c.recipients[0].k) : (a && a.eligible[0]) || null;
    const due = c.status === 'programada' && c.scheduledAt <= nowStr();
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(c.name) + ' ' + cBadge(c.status), subtitle: '<span class="mono">' + c.id + '</span> · ' + CH_LBL[c.channel] + ' · responsable ' + esc(Q.userName(c.owner)), crumbs: crumbs(c.id), actions: acts.join('') }) +
      UI.card('', UI.flow(steps, idx, c.status === 'cancelada' ? 1 : undefined)) +
      (due ? UI.alert('warn', '<b>Programación alcanzada (' + datetime(c.scheduledAt) + ').</b> En producción el scheduler despacha la campaña en el minuto; en la demo use “Enviar ahora”.') : '') +
      (c.status === 'enviando' ? UI.alert('info', '<b>Envío en curso.</b> El job <span class="mono">mkt:send-campaign</span> procesa lotes de 200 destinatarios por minuto (rate limit del proveedor) y registra entregas, aperturas y clics vía webhooks. ' + UI.progress(35)) : '') +
      (c.status === 'cancelada' ? UI.alert('bad', '<b>Campaña cancelada.</b> ' + esc(c.cancelReason || '')) : '') +
      '<div class="grid g-3-2"><div class="stack cg-col">' +
        (c.status === 'enviada' ? '<div class="grid g4">' +
          UI.kpi({ label: 'Enviados / entregados', value: M.sent + ' / ' + M.delivered, sub: fmtN(pct(M.delivered, M.sent), 1) + '% entrega', tone: 'accent', icon: 'send' }) +
          UI.kpi({ label: c.channel === 'email' ? 'Abiertos' : 'Leídos', value: M.opened, sub: fmtN(pct(M.opened, M.delivered), 1) + '% · ' + M.clicked + ' clics (' + fmtN(pct(M.clicked, M.delivered), 1) + '%)', tone: 'info', icon: 'eye' }) +
          UI.kpi({ label: 'Respuestas / bajas', value: M.replied + ' / ' + M.unsub, sub: fmtN(pct(M.unsub, M.delivered), 1) + '% de bajas', tone: M.unsub ? 'sun' : 'ok', icon: 'msg' }) +
          UI.kpi({ label: 'Ingresos atribuidos', value: S0(A.revenue), sub: A.leads.length + ' leads · ' + A.res.length + ' reservas' + (c.promo ? ' · ' + A.promoUses + ' usos código' : ''), tone: 'ok', icon: 'trending' }) + '</div>' +
          UI.card('Embudo', UI.chart.hbars({ items: [['Enviados', M.sent], ['Entregados', M.delivered], [c.channel === 'email' ? 'Abiertos' : 'Leídos', M.opened], ['Clics', M.clicked], ['Respuestas', M.replied], ['Leads', A.leads.length], ['Reservas', A.res.length]].map(([l, v]) => ({ label: l, value: v, display: v + (M.sent ? ' · ' + fmtN(pct(v, M.sent), 1) + '%' : '') })) }), { sub: 'Atribución last-touch 30 días (MKT-BR-10)' }) +
          UI.card('Conversiones atribuidas', (A.res.length || A.leads.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Tipo</th><th>Registro</th><th>Contacto</th><th>Fecha</th><th class="num">Monto S/</th></tr></thead><tbody>' + A.res.map(r => '<tr><td>Reserva</td><td><a class="mono" href="#/reservas/' + r.id + '">' + r.id + '</a></td><td class="small">' + esc(Q.clientName(r.clientId)) + '</td><td class="small">' + datetime(r.createdAt) + '</td><td class="num">' + fmtN(toPEN(r.total, r.currency), 2) + '</td></tr>').join('') + A.leads.map(l => '<tr><td>Lead</td><td><a class="mono" href="#/crm/leads/' + l.id + '">' + l.id + '</a></td><td class="small">' + esc(l.name) + '</td><td class="small">' + datetime(l.createdAt) + '</td><td class="num">—</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin conversiones atribuidas en la ventana de 30 días.', 'trending')), { tight: true }) : '') +
        UI.card('Mensaje', preview(c.channel, c.subject, c.body, ctSample, c), { sub: t ? 'Plantilla ' + esc(t.name) + ' · ' + tplStatus(t) : '' }) +
        (c.recipients.length ? '<div id="cd-rec"></div>' : '') +
      '</div><div class="stack cg-col">' +
        UI.card('Resumen', UI.dl([['Canal', chTag(c.channel)], ['Segmento', s ? '<a href="#/marketing/segmentos/' + s.id + '">' + esc(s.name) + '</a><div class="xs faint">' + esc(segText(s)) + '</div>' : '—'], ['Código promocional', c.promo ? '<span class="mono">' + esc(c.promo.code) + '</span> · ' + esc(Q.productName(c.promo.productId)) : '—'], ['UTM', '<span class="mono xs">' + esc(c.utm) + '</span>'], ['Programada', c.scheduledAt ? datetime(c.scheduledAt) : '—'], ['Enviada', c.sentAt ? datetime(c.sentAt) : '—'], ['Pruebas', c.tests.length ? c.tests.map(x => datetime(x.ts) + ' → ' + esc(x.to)).join('<br>') : '<span class="faint">Sin envío de prueba</span>'], ['Creada', datetime(c.createdAt) + ' · ' + esc(Q.userName(c.owner))]])) +
        UI.card(sent ? 'Audiencia al envío (snapshot)' : 'Audiencia si se envía ahora', sent && c.audience ? supTable(c.audience) : a ? supTable(a) + (a.sup.optout.length || a.sup.consent.length ? '<details style="margin-top:10px"><summary class="small" style="cursor:pointer">Ver suprimidos (' + (a.matched - a.eligible.length) + ')</summary><div class="list" style="margin-top:6px">' + Object.keys(SUP_LBL).flatMap(k => a.sup[k].map(x => '<div class="list-item" style="padding:6px 0"><div class="grow small">' + esc(x.name) + '<div class="xs faint">' + SUP_LBL[k] + '</div></div></div>')).join('') + '</div></details>' : '') : '', { sub: 'Supresión automática por consentimiento, baja, dato y fatiga' }) +
        UI.card('Historial', tl(c.history)) +
      '</div></div></div>';
    const on = (sel, fn) => { const x = el.querySelector(sel); if (x) x.onclick = fn; };
    on('#cd-test', () => testSend(c));
    on('#cd-sched', () => scheduleCampaign(c));
    on('#cd-unsched', () => { if (!need(MK, 'desprogramar')) return; const b = c.scheduledAt; c.status = 'borrador'; c.scheduledAt = null; log(c, 'Desprogramada (estaba para ' + b + ')'); Audit.log('Campaña', c.id, 'desprogramar', 'programada', 'borrador'); Store.save(); UI.toast('Campaña devuelta a borrador.'); App.render(); });
    on('#cd-cancel', () => UI.confirm({ title: 'Cancelar campaña', message: 'La campaña <b>' + esc(c.name) + '</b> no se enviará. Queda registrada para auditoría.', danger: true, confirmLabel: 'Cancelar campaña', reason: true, onConfirm: (r) => { if (!need(MK, 'cancelar campañas')) return; const b = c.status; c.status = 'cancelada'; c.cancelReason = r; log(c, 'Cancelada: ' + r); Audit.log('Campaña', c.id, 'cancelar', b, 'cancelada · ' + r); Store.save(); UI.toast('Campaña cancelada.'); App.render(); } }));
    on('#cd-send', () => launchCampaign(c));
    on('#cd-proc', () => completeSend(c));
    on('#cd-dup', () => { if (!need(MK, 'duplicar campañas')) return; const nid = nextId(DB.campaigns, 'CMP-', 4); const n = Object.assign(JSON.parse(JSON.stringify(c)), { id: nid, name: c.name + ' (copia)', status: 'borrador', owner: me(), createdAt: nowStr(), scheduledAt: null, sentAt: null, tests: [], recipients: [], audience: null, history: [], cancelReason: '', utm: c.utm.replace(c.id.toLowerCase(), nid.toLowerCase()) }); log(n, 'Duplicada de ' + c.id); DB.campaigns.push(n); Audit.log('Campaña', nid, 'duplicar', c.id, n.name); Store.save(); UI.toast('Campaña duplicada como ' + nid + '.'); App.go('#/marketing/campanas/' + nid); });
    if (c.recipients.length) {
      UI.dataTable(el.querySelector('#cd-rec'), {
        exportName: 'destinatarios_' + c.id, rows: () => c.recipients, search: r => r.name + ' ' + r.to, searchPlaceholder: 'Buscar destinatario…', pageSize: 8,
        toolbar: '<b class="small" style="margin-right:6px">Destinatarios</b>',
        filters: [{ key: 'st', label: 'Estado', options: [['u', 'Baja'], ['r', 'Respondió'], ['c', 'Clic'], ['o', c.channel === 'email' ? 'Abierto' : 'Leído'], ['d', 'Entregado'], ['x', 'Rebotado']], match: (r, v) => v === 'x' ? !r.d : !!r[v] }],
        columns: [
          { key: 'name', label: 'Destinatario', render: r => '<div class="cell-main small">' + esc(r.name) + '</div><div class="cell-sub">' + esc(r.to) + '</div>' },
          { key: 'st', label: 'Estado', sortVal: r => (r.u ? 5 : 0) + (r.r ? 4 : r.c ? 3 : r.o ? 2 : r.d ? 1 : 0), render: r => r.u ? UI.badge('rechazado', 'Baja') : r.r ? UI.badge('calificado', 'Respondió') : r.c ? UI.badge('contactado', 'Clic') : r.o ? UI.badge('nuevo', c.channel === 'email' ? 'Abierto' : 'Leído') : r.d ? UI.badge('ok', 'Entregado') : UI.badge('fallido', 'Rebotado'), csv: r => r.u ? 'baja' : r.r ? 'respondio' : r.c ? 'clic' : r.o ? 'abierto' : r.d ? 'entregado' : 'rebotado' },
          { key: 'act', label: '', sort: false, csv: () => '', render: r => r.u || !r.d || c.status !== 'enviada' ? '' : '<button class="btn xs" data-unsub="' + esc(r.k) + '" title="Simula el clic en “darse de baja” o la respuesta BAJA">Registrar baja</button>' }
        ],
        afterDraw: (ct) => ct.querySelectorAll('[data-unsub]').forEach(x => x.onclick = () => {
          if (!need(MK, 'registrar bajas')) return;
          const r = c.recipients.find(y => y.k === x.dataset.unsub); const ctt = contactByKey(r.k) || { key: r.k, name: r.name, email: r.to, phone: r.to };
          UI.confirm({ title: 'Registrar baja desde la campaña', message: 'Se registrará la baja de <b>' + esc(r.name) + '</b> para ' + CH_LBL[c.channel] + ' (origen: ' + (c.channel === 'email' ? 'enlace de baja' : 'respuesta BAJA') + ' en ' + c.id + '). Se excluirá de todos los envíos comerciales futuros por este canal.', confirmLabel: 'Registrar baja', danger: true, onConfirm: () => { r.u = true; r.o = true; revokeConsent(ctt, c.channel, c.id, c.channel === 'email' ? 'Enlace de baja en correo' : 'Respuesta BAJA por WhatsApp'); log(c, 'Baja registrada: ' + r.name); Store.save(); UI.toast('Baja registrada y aplicada.'); App.render(); } });
        })
      });
    }
  }
  function sendBlockers(c, forSchedule) {
    const t = tpl(c.templateId); const b = [];
    if (c.channel === 'whatsapp' && (!t || t.status !== 'aprobada')) b.push('MKT-BR-03: la plantilla de WhatsApp debe estar aprobada por Meta.');
    if (c.channel === 'email') { const p = tplProblems('email', t ? t.category : 'MARKETING', c.body); if (p.length) b.push(p[0]); }
    if (!c.tests.length) b.push('MKT-BR-04: realice un envío de prueba antes de ' + (forSchedule ? 'programar' : 'enviar') + '.');
    if (c.promo) { const p = Q.product(c.promo.productId); const pr = p && p.promotions.find(x => x.id === c.promo.promoId); if (!pr || pr.status !== 'activa' || pr.to < TD()) b.push('MKT-BR-09: el código ' + c.promo.code + ' no está activo o está vencido.'); }
    return b;
  }
  function testSend(c) {
    if (!need(MK, 'enviar pruebas')) return;
    const t = tpl(c.templateId);
    if (c.channel === 'whatsapp' && (!t || t.status !== 'aprobada')) { UI.toast('MKT-BR-03: Meta no permite enviar (ni probar) plantillas no aprobadas.', 'bad'); return; }
    const internal = DB.users.filter(u => u.status === 'activo' && !Access.isExternal(u.role) && u.role !== 'super_admin');
    const a = audience(seg(c.segmentId), c.channel, nowStr(), c.id); const samples = (a.eligible.length ? a.eligible : contacts()).slice(0, 20);
    UI.modal({ title: 'Envío de prueba', size: 'sm', sub: 'Solo a usuarios internos del tenant; no cuenta en métricas.', body: UI.form([{ id: 'ts_to', label: 'Destinatario interno', type: 'select', options: internal.map(u => [u.id, u.name + ' · ' + (c.channel === 'email' ? u.email : u.phone)]), value: me(), col: 12 }, { id: 'ts_s', label: 'Datos de ejemplo (variables)', type: 'select', options: samples.map(x => [x.key, x.name]), col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Enviar prueba', cls: 'primary', icon: 'send', onClick: (m) => {
        const f = UI.formData(m); const u = Q.user(f.ts_to); const to = c.channel === 'email' ? u.email : u.phone;
        c.tests.push({ ts: nowStr(), u: me(), to, sample: f.ts_s }); log(c, 'Envío de prueba a ' + to);
        Notify.push('marketing.prueba', CH_LBL[c.channel], to, '[PRUEBA] ' + (c.channel === 'email' ? c.subject.replace(/\{\{nombre\}\}/g, (contactByKey(f.ts_s) || { name: 'Cliente' }).name.split(' ')[0]) : c.name));
        Audit.log('Campaña', c.id, 'envio_prueba', '', to); Store.save(); UI.toast('Prueba enviada a ' + esc(to) + '.'); App.render();
      } }] });
  }
  function scheduleCampaign(c) {
    if (!need(MK, 'programar campañas')) return;
    const bl = sendBlockers(c, true); if (bl.length) { UI.toast(bl[0], 'bad'); return; }
    const def = addDays(TD(), 1) + 'T09:00';
    UI.modal({ title: 'Programar campaña', size: 'sm', sub: esc(c.name), body: UI.form([{ id: 'sc_at', label: 'Fecha y hora de envío (America/Lima)', type: 'datetime-local', value: def, required: true, col: 12 }]) + '<p class="xs faint" style="margin-top:10px">MKT-BR-05: al menos 15 minutos en el futuro' + (c.channel === 'whatsapp' ? ' y entre 08:00 y 20:00 (WhatsApp comercial)' : '') + '. La audiencia y la supresión se recalculan al momento del envío.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Programar', cls: 'primary', icon: 'calendar', onClick: (m) => {
        if (!UI.validate(m)) return false; const at = toTs(UI.formData(m).sc_at);
        const min = new Date(parseD(nowStr()).getTime() + 15 * 60000);
        if (parseD(at) < min) { UI.toast('MKT-BR-05: la programación debe ser al menos 15 minutos en el futuro.', 'bad'); return false; }
        const hh = +at.slice(11, 13); if (c.channel === 'whatsapp' && (hh < 8 || hh >= 20)) { UI.toast('MKT-BR-05: WhatsApp comercial solo entre 08:00 y 20:00.', 'bad'); return false; }
        const a = audience(seg(c.segmentId), c.channel, at, c.id); if (!a.eligible.length) { UI.toast('MKT-BR-07: sin destinatarios elegibles.', 'bad'); return false; }
        c.status = 'programada'; c.scheduledAt = at; log(c, 'Programada para ' + at + ' (' + a.eligible.length + ' elegibles estimados)');
        Audit.log('Campaña', c.id, 'programar', 'borrador', 'programada · ' + at); Notify.push('marketing.programada', 'Email', (Q.user(c.owner) || {}).email || c.owner, 'Campaña ' + c.id + ' programada para ' + at); Store.save();
        UI.toast('Campaña programada para ' + datetime(at) + '.'); App.render();
      } }] });
  }
  function launchCampaign(c) {
    if (!need(MK, 'enviar campañas')) return;
    const bl = sendBlockers(c, false); if (bl.length) { UI.toast(bl[0], 'bad'); return; }
    const a = audience(seg(c.segmentId), c.channel, nowStr(), c.id);
    if (!a.eligible.length) { UI.toast('MKT-BR-07: sin destinatarios elegibles tras la supresión.', 'bad'); return; }
    UI.modal({ title: 'Enviar campaña ahora', size: 'sm', sub: esc(c.name) + ' · ' + CH_LBL[c.channel], body: supTable(a) + '<p class="small muted" style="margin-top:12px">Se enviará solo a los <b>' + a.eligible.length + '</b> destinatarios elegibles. Los suprimidos no recibirán el mensaje (Ley 29733). Esta acción no se puede deshacer.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar envío', cls: 'primary', icon: 'send', onClick: () => {
        const b = c.status; c.status = 'enviando'; c.sentAt = nowStr(); c.audience = snapAud(a); c.recipients = makeRecipients(c, a.eligible).map(r => Object.assign(r, { d: false, o: false, c: false, r: false, _pend: true }));
        log(c, 'Envío iniciado: ' + a.eligible.length + ' destinatarios · ' + (a.matched - a.eligible.length) + ' suprimidos');
        Audit.log('Campaña', c.id, 'enviar', b, 'enviando · ' + a.eligible.length + ' destinatarios'); Store.save();
        UI.toast('Envío iniciado. El job procesa los lotes en segundo plano.'); App.render();
      } }] });
  }
  function completeSend(c) {
    if (!need(MK, 'procesar envíos')) return;
    const fresh = makeRecipients(c, c.recipients.map(r => ({ key: r.k, name: r.name, to: r.to })));
    c.recipients = fresh; c.status = 'enviada';
    const M = metrics(c);
    log(c, 'Envío completado: ' + M.sent + ' enviados, ' + M.delivered + ' entregados');
    Audit.log('Campaña', c.id, 'envio_completado', 'enviando', 'enviada · ' + M.sent);
    Notify.push('marketing.enviada', 'Email', (Q.user(c.owner) || {}).email || c.owner, 'Campaña ' + c.id + ' enviada a ' + M.sent + ' destinatarios'); Store.save();
    UI.toast('Campaña enviada: ' + M.delivered + ' de ' + M.sent + ' entregados.'); App.render();
  }

  /* ===================================================================
     METAS COMERCIALES (crm/metas)
     =================================================================== */
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const lastDay = (y, m) => y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate());
  function pRange(p) { if (p.includes('Q')) { const [y, q] = p.split('-Q'); const m0 = (+q - 1) * 3 + 1; return [y + '-' + pad(m0) + '-01', lastDay(+y, m0 + 2)]; } const [y, m] = p.split('-').map(Number); return [p + '-01', lastDay(y, m)]; }
  const pLabel = (p) => p.includes('Q') ? ['I', 'II', 'III', 'IV'][+p.split('-Q')[1] - 1] + ' trimestre ' + p.slice(0, 4) : MESES[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4);
  const curMonth = () => TD().slice(0, 7);
  const curQ = () => TD().slice(0, 4) + '-Q' + (Math.floor((+TD().slice(5, 7) - 1) / 3) + 1);
  const nextMonth = () => { const [y, m] = curMonth().split('-').map(Number); return m === 12 ? (y + 1) + '-01' : y + '-' + pad(m + 1); };
  const nextQ = () => { const [y, q] = curQ().split('-Q').map(Number); return q === 4 ? (y + 1) + '-Q1' : y + '-Q' + (q + 1); };
  function pTime(p) { const [f, t] = pRange(p); const total = Util.daysBetween(f, t) + 1; if (TD() < f) return { state: 'futuro', total, elapsed: 0, frac: 0 }; if (TD() > t) return { state: 'finalizado', total, elapsed: total, frac: 1 }; const e = Util.daysBetween(f, TD()) + 1; return { state: 'en_curso', total, elapsed: e, frac: e / total }; }
  const MET = { sales: { l: 'Monto de ventas', fmt: v => S0(v), short: 'Ventas' }, bookings: { l: 'N.º de reservas', fmt: v => fmtN(v, 0), short: 'Reservas' }, margin: { l: 'Margen bruto', fmt: v => S0(v), short: 'Margen' }, conversion: { l: 'Conversión de oportunidades', fmt: v => v == null ? '—' : fmtN(v, 1) + '%', short: 'Conversión' } };
  const SCOPE_LBL = { asesor: 'Asesor', sede: 'Sede', equipo: 'Equipo' };
  const team = (id) => (DB.salesTeams || []).find(t => t.id === id);
  const scopeName = (t) => t.scopeType === 'asesor' ? Q.userName(t.scopeId) : t.scopeType === 'sede' ? Q.sedeName(t.scopeId) : (team(t.scopeId) || {}).name || t.scopeId;
  const advisors = () => DB.users.filter(u => ['sales', 'manager', 'tenant_admin'].includes(u.role) && u.status === 'activo');

  function ensureTargets() {
    let dirty = false;
    if (!DB.salesTeams) { DB.salesTeams = [{ id: 'EQ-01', name: 'Ventas directas y e-commerce', leader: 'U02', members: ['U03', 'U04'] }, { id: 'EQ-02', name: 'Cuentas corporativas y B2B', leader: 'U02', members: ['U02'] }]; dirty = true; }
    if (!DB.salesTargetPolicy) { DB.salesTargetPolicy = { tiers: [{ min: 90, pay: 50 }, { min: 100, pay: 100 }, { min: 120, pay: 130 }], primary: 'sales', lockDecreaseAfterPct: 50, attributionWindowDays: 30 }; dirty = true; }
    if (!DB.salesTargets) {
      const T = (id, scopeType, scopeId, period, goals, status, extra) => Object.assign({ id, scopeType, scopeId, periodType: period.includes('Q') ? 'trimestre' : 'mes', period, goals, status, bonus: scopeType === 'asesor' ? { amount: 600, currency: 'PEN' } : null, createdBy: 'U02', createdAt: addDays(pRange(period)[0], -5) + ' 10:00', result: null, bonusCommissionId: null, history: [] }, extra || {});
      const R = (sales, bookings, margin, conversion, at) => ({ sales, bookings, margin, conversion, closedAt: at, closedBy: 'U02', frozen: true });
      DB.salesTargets = [
        T('MET-0001', 'asesor', 'U02', '2026-07', { sales: 60000, bookings: 3, margin: 15000, conversion: 30 }, 'cerrada', { bonus: { amount: 1000, currency: 'PEN' }, result: R(64250, 3, 16420, 33.3, '2026-08-01 09:00') }),
        T('MET-0002', 'asesor', 'U03', '2026-07', { sales: 8500, bookings: 3, margin: 2100, conversion: 30 }, 'cerrada', { result: R(9420, 4, 2380, 40, '2026-08-01 09:00') }),
        T('MET-0003', 'asesor', 'U04', '2026-07', { sales: 8000, bookings: 3, margin: 2000, conversion: 30 }, 'cerrada', { bonus: { amount: 700, currency: 'PEN' }, result: R(7950, 3, 1890, 25, '2026-08-01 09:00') }),
        T('MET-0004', 'asesor', 'U02', '2026-08', { sales: 65000, bookings: 3, margin: 16000, conversion: 30 }, 'cerrada', { bonus: { amount: 1000, currency: 'PEN' }, result: R(41300, 2, 10150, 20, '2026-09-01 09:10') }),
        T('MET-0005', 'asesor', 'U03', '2026-08', { sales: 9000, bookings: 2, margin: 2200, conversion: 30 }, 'vigente'),
        T('MET-0006', 'asesor', 'U04', '2026-08', { sales: 8000, bookings: 3, margin: 2000, conversion: 30 }, 'cerrada', { bonus: { amount: 700, currency: 'PEN' }, result: R(8860, 3, 2140, 33.3, '2026-09-01 09:10') }),
        T('MET-0007', 'asesor', 'U02', '2026-09', { sales: 70000, bookings: 3, margin: 18000, conversion: 35 }, 'vigente', { bonus: { amount: 1000, currency: 'PEN' } }),
        T('MET-0008', 'asesor', 'U03', '2026-09', { sales: 9000, bookings: 3, margin: 2200, conversion: 30 }, 'vigente'),
        T('MET-0009', 'asesor', 'U04', '2026-09', { sales: 8000, bookings: 3, margin: 2000, conversion: 30 }, 'vigente', { bonus: { amount: 700, currency: 'PEN' } }),
        T('MET-0010', 'sede', 'SED-01', '2026-Q3', { sales: 90000, bookings: 8, margin: 22000, conversion: null }, 'vigente', { createdBy: 'U01' }),
        T('MET-0011', 'sede', 'SED-02', '2026-Q3', { sales: 20000, bookings: 4, margin: 5500, conversion: null }, 'vigente', { createdBy: 'U01' }),
        T('MET-0012', 'equipo', 'EQ-01', '2026-Q3', { sales: 30000, bookings: 6, margin: 7500, conversion: 30 }, 'vigente'),
        T('MET-0013', 'asesor', 'U02', '2026-10', { sales: 120000, bookings: 3, margin: 26000, conversion: 35 }, 'borrador', { bonus: { amount: 1000, currency: 'PEN' } }),
        T('MET-0014', 'asesor', 'U03', '2026-10', { sales: 60000, bookings: 3, margin: 13000, conversion: 35 }, 'vigente'),
        T('MET-0015', 'asesor', 'U04', '2026-10', { sales: 25000, bookings: 3, margin: 5500, conversion: 30 }, 'vigente', { bonus: { amount: 700, currency: 'PEN' } }),
        T('MET-0016', 'equipo', 'EQ-01', '2026-Q4', { sales: 160000, bookings: 10, margin: 35000, conversion: 30 }, 'vigente'),
        T('MET-0017', 'sede', 'SED-01', '2026-Q4', { sales: 260000, bookings: 12, margin: 58000, conversion: null }, 'vigente', { createdBy: 'U01' })
      ];
      DB.salesTargets.forEach(t => {
        t.history.push({ ts: t.createdAt, u: t.createdBy, m: 'Meta creada' + (t.status === 'borrador' ? ' en borrador' : ' y activada') + ' · ventas ' + S0(t.goals.sales) });
        if (t.status === 'cerrada') t.history.push({ ts: t.result.closedAt, u: t.result.closedBy, m: 'Período cerrado · cumplimiento ' + fmtN(pct(t.result.sales, t.goals.sales), 1) + '%' });
      });
      const m8 = DB.salesTargets.find(t => t.id === 'MET-0008');
      m8.history.push({ ts: '2026-09-10 12:30', u: 'U02', m: 'Ajuste de meta · reservas 4 → 3 · Motivo: grupo escolar pospuesto a noviembre por el colegio' });
      /* Bonos de metas cerradas → comisiones (tipo «Bono por meta») para Finanzas */
      DB.salesTargets.filter(t => t.status === 'cerrada').forEach(t => {
        const b = bonusFor(t, t.result.sales); if (!b.amount) return;
        const paid = t.period === '2026-07';
        const cm = { id: nextId(DB.commissions, 'COM-', 4), resId: null, targetId: t.id, beneficiary: t.scopeId, kind: 'Bono por meta', base: t.result.sales, pct: +(b.amount / t.result.sales * 100).toFixed(2), amount: b.amount, currency: 'PEN', fx: null, status: paid ? 'pagada' : 'aprobada', rule: b.rule, createdAt: t.result.closedAt, history: [{ ts: t.result.closedAt, status: 'calculada', user: 'Sistema', note: b.rule }] };
        if (paid) { cm.paidAt = '2026-08-05 10:00'; cm.payRef = 'Planilla del mes · Planilla 2026-07'; cm.history.push({ ts: '2026-08-05 10:00', status: 'pagada', user: 'U07', note: 'Planilla 2026-07' }); } else cm.history.push({ ts: '2026-09-02 09:00', status: 'aprobada', user: 'U07', note: '' });
        DB.commissions.push(cm); t.bonusCommissionId = cm.id;
      });
      dirty = true;
    }
    if (dirty) Store.save();
  }
  function bonusFor(t, achievedSales) {
    const pol = DB.salesTargetPolicy; if (!t.bonus || !t.goals.sales) return { amount: 0, tier: null, pct: 0, rule: 'Sin bono configurado' };
    const p = pct(achievedSales, t.goals.sales); const tier = pol.tiers.filter(x => p >= x.min).sort((a, b) => b.min - a.min)[0];
    const amount = tier ? Math.round(t.bonus.amount * tier.pay) / 100 : 0;
    return { amount, tier, pct: p, rule: 'Bono por meta ' + t.id + ' (' + pLabel(t.period) + ') · cumplimiento ' + fmtN(p, 1) + '% → ' + (tier ? 'tramo ≥' + tier.min + '%: ' + tier.pay + '% del bono de ' + S0(t.bonus.amount) : 'sin tramo (mín. ' + pol.tiers[0].min + '%)') };
  }
  function ownersOf(t) { if (t.scopeType === 'asesor') return [t.scopeId]; if (t.scopeType === 'equipo') return (team(t.scopeId) || { members: [] }).members; return DB.users.filter(u => u.sede === t.scopeId).map(u => u.id); }
  function compute(t) {
    const [f, to] = pRange(t.period); const inR = (d) => d && d.slice(0, 10) >= f && d.slice(0, 10) <= to;
    const owners = ownersOf(t);
    const res = DB.reservations.filter(r => resOk(r) && inR(r.createdAt) && (t.scopeType === 'sede' ? r.sede === t.scopeId : owners.includes(r.owner)));
    const opps = DB.opportunities.filter(o => owners.includes(o.owner));
    const closed = opps.filter(o => ['ganada', 'perdida'].includes(o.stage) && inR(o.closeDate));
    const won = closed.filter(o => o.stage === 'ganada').length;
    const open = opps.filter(o => !['ganada', 'perdida'].includes(o.stage) && o.closeDate >= (TD() > f ? TD() : f) && inR(o.closeDate));
    const sales = sum(res, r => toPEN(r.total, r.currency)); const margin = sum(res, r => toPEN(r.total - Q.resCost(r), r.currency));
    const pipe = sum(open, o => toPEN(o.amount, o.currency) * o.probability / 100);
    const mRatio = sales ? margin / sales : 0.22;
    return { res, closed, open, sales, bookings: res.length, margin, conversion: closed.length ? won / closed.length * 100 : null, won, lost: closed.length - won, pipe, pipeBookings: sum(open, o => o.probability / 100), pipeMargin: pipe * mRatio };
  }
  function evalT(t) {
    const tm = pTime(t.period);
    if (t.status === 'cerrada' && t.result && t.result.frozen) return { tm, a: Object.assign({ res: [], closed: [], open: [], pipe: 0, pipeBookings: 0, pipeMargin: 0 }, t.result), frozen: true, proj: { sales: t.result.sales, bookings: t.result.bookings, margin: t.result.margin }, lin: { sales: t.result.sales } };
    const a = t.status === 'cerrada' && t.result ? Object.assign(compute(t), t.result) : compute(t);
    const lin = { sales: tm.state === 'en_curso' ? a.sales / tm.frac : a.sales, bookings: tm.state === 'en_curso' ? a.bookings / tm.frac : a.bookings, margin: tm.state === 'en_curso' ? a.margin / tm.frac : a.margin };
    const proj = tm.state === 'finalizado' ? { sales: a.sales, bookings: a.bookings, margin: a.margin } : { sales: a.sales + a.pipe, bookings: a.bookings + a.pipeBookings, margin: a.margin + a.pipeMargin };
    return { tm, a, proj, lin };
  }
  const achv = (t, e) => pct(e.a.sales, t.goals.sales);
  function health(t, e) {
    if (t.status === 'borrador') return UI.badge('borrador');
    if (t.status === 'anulada') return UI.badge('anulado', 'Anulada');
    if (t.status === 'cerrada') return achv(t, e) >= 100 ? UI.badge('ok', 'Cumplida') : UI.badge('rechazada', 'No cumplida');
    if (e.tm.state === 'finalizado') return UI.badge('pendiente', 'Por cerrar');
    if (e.tm.state === 'futuro') return UI.badge('nuevo', 'Por iniciar');
    const p = pct(e.proj.sales, t.goals.sales); return p >= 100 ? UI.badge('ok', 'En camino') : p >= 80 ? UI.badge('pendiente', 'En riesgo') : UI.badge('error', 'Crítico');
  }
  const bar = (p) => '<div class="row" style="gap:8px;flex-wrap:nowrap;min-width:110px"><div class="grow">' + UI.progress(p, p >= 100 ? 'ok' : p >= 80 ? 'sun' : 'bad') + '</div><b class="small num" style="width:46px;text-align:right">' + fmtN(p, 0) + '%</b></div>';
  const visibleTargets = () => DB.salesTargets.filter(t => t.status !== 'anulada' && (!Scope.ownOnly() || (t.scopeType === 'asesor' && t.scopeId === me() && t.status !== 'borrador')));
  const S = { period: null, adv: '' };

  App.register('crm/metas', (el, params) => {
    ensureTargets();
    if (!can(TV) && !can(TM)) return blocked(el, TV, 'Metas comerciales');
    if (params[0]) return targetDetail(el, params[0]);
    const own = Scope.ownOnly(); const manage = can(TM);
    const periodsAll = [...new Set(visibleTargets().map(t => t.period).concat(own ? [] : [curMonth(), nextMonth(), curQ()]))].sort((a, b) => pRange(b)[0].localeCompare(pRange(a)[0]) || (a.includes('Q') ? 1 : -1));
    if (!S.period || !periodsAll.includes(S.period)) S.period = periodsAll.includes(curMonth()) ? curMonth() : periodsAll[0] || curMonth();
    const rows = visibleTargets().filter(t => t.period === S.period && (!S.adv || (t.scopeType === 'asesor' && t.scopeId === S.adv)));
    const ctl = '<div class="cg-sel"><select class="input" id="mt-period" aria-label="Período">' + periodsAll.map(p => '<option value="' + p + '"' + (p === S.period ? ' selected' : '') + '>' + pLabel(p) + (p === curMonth() || p === curQ() ? ' (actual)' : '') + '</option>').join('') + '</select>' +
      (own ? '<span class="tag">' + UI.icon('lock') + 'Mis metas</span>' : '<select class="input" id="mt-adv" aria-label="Asesor"><option value="">Asesor: todos</option>' + advisors().map(u => '<option value="' + u.id + '"' + (u.id === S.adv ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') + '</select>') +
      (manage ? '<button class="btn primary" id="mt-new">' + UI.icon('plus') + 'Nueva meta</button>' : '') + '</div>';
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Metas comerciales', subtitle: own ? 'Sus metas del período, avance calculado con sus reservas y oportunidades, proyección al cierre y posición en el ranking del equipo.' : 'Metas mensuales y trimestrales por asesor, sede y equipo. Avance real con reservas, oportunidades y márgenes; proyección con pipeline ponderado; bono por cumplimiento vinculado a Comisiones.', crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Metas comerciales']], actions: ctl }) + '<div id="mt-body" class="stack"></div></div>';
    const body = el.querySelector('#mt-body');
    if (own) salesView(body, rows); else managerView(body, rows, manage);
    el.querySelector('#mt-period').onchange = (e) => { S.period = e.target.value; App.render(); };
    const adv = el.querySelector('#mt-adv'); if (adv) adv.onchange = (e) => { S.adv = e.target.value; App.render(); };
    const nb = el.querySelector('#mt-new'); if (nb) nb.onclick = () => targetModal(null);
  });

  function metricBoxes(t, e) {
    return '<div class="mt-met">' + ['sales', 'bookings', 'margin', 'conversion'].map(k => {
      const g = t.goals[k]; if (g == null) return '<div class="mt-box"><div class="upper">' + MET[k].short + '</div><div class="s">Sin meta para este indicador</div></div>';
      const real = e.a[k]; const p = k === 'conversion' ? (real == null ? 0 : Math.min(100, pct(real, g))) : pct(real, g);
      const pj = k === 'conversion' ? null : e.proj[k];
      return '<div class="mt-box"><div class="upper">' + MET[k].l + '</div><div class="v">' + MET[k].fmt(real) + '</div><div class="s">Meta ' + MET[k].fmt(g) + '</div>' + bar(p) + '<div class="s">' + (pj != null && !e.frozen && e.tm.state !== 'finalizado' ? 'Proyección al cierre: <b>' + MET[k].fmt(pj) + '</b> (' + fmtN(pct(pj, g), 0) + '%)' : k === 'conversion' ? (e.a.won != null && !e.frozen ? e.a.won + ' ganadas / ' + ((e.a.won || 0) + (e.a.lost || 0)) + ' cerradas' : 'Oportunidades cerradas en el período') : e.frozen ? 'Resultado congelado al cierre' : 'Período finalizado') + '</div></div>';
    }).join('') + '</div>';
  }
  function rankRows(period) {
    return DB.salesTargets.filter(t => t.period === period && t.scopeType === 'asesor' && ['vigente', 'cerrada'].includes(t.status)).map(t => { const e = evalT(t); return { t, e, p: achv(t, e), pp: pct(e.proj.sales, t.goals.sales) }; }).sort((a, b) => b.p - a.p);
  }
  function rankCard(period, amounts) {
    const rk = rankRows(period);
    if (!rk.length) return UI.card('Ranking del equipo', UI.empty('Sin metas individuales en el período.', 'award'));
    const mine = rk.findIndex(x => x.t.scopeId === me());
    return UI.card('Ranking del equipo', (amounts ? '' : '<div class="small" style="margin-bottom:10px">' + (mine >= 0 ? 'Su posición: <b>' + (mine + 1) + ' de ' + rk.length + '</b>' : 'No participa en el ranking de este período') + '</div>') +
      rk.map((x, i) => '<div class="mt-rank' + (x.t.scopeId === me() ? ' me' : '') + '"><span class="pos">' + (i + 1) + '</span><span class="row" style="gap:8px;flex-wrap:nowrap;min-width:0">' + UI.avatar(x.t.scopeId) + '<span style="min-width:0"><span class="small" style="font-weight:550;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(Q.userName(x.t.scopeId)) + '</span>' + (amounts ? '<span class="xs faint">' + S0(x.e.a.sales) + ' de ' + S0(x.t.goals.sales) + '</span>' : '') + '</span></span><span>' + UI.progress(x.p, x.p >= 100 ? 'ok' : x.p >= 80 ? 'sun' : 'bad') + '</span><b class="num small" style="text-align:right">' + fmtN(x.p, 0) + '%</b></div>').join(''),
      { sub: 'Por % de cumplimiento de la meta de ventas' + (amounts ? '' : ' · MET-BR-07: sin montos ni bonos de otros asesores') });
  }
  function resTable(list, showMargin) {
    return list.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Reserva</th><th>Cliente</th><th>Creada</th><th>Estado</th><th class="num">Venta S/</th>' + (showMargin ? '<th class="num">Margen S/</th>' : '') + '</tr></thead><tbody>' + list.map(r => '<tr><td><a class="mono" href="#/reservas/' + r.id + '">' + r.id + '</a><div class="cell-sub">' + esc(r.title) + '</div></td><td class="small">' + esc(Q.clientName(r.clientId)) + '</td><td class="small nowrap">' + date(r.createdAt) + '</td><td>' + UI.badge(r.status) + '</td><td class="num">' + fmtN(toPEN(r.total, r.currency), 2) + (r.currency !== 'PEN' ? '<div class="cell-sub">' + money(r.total, r.currency) + '</div>' : '') + '</td>' + (showMargin ? '<td class="num">' + fmtN(toPEN(r.total - Q.resCost(r), r.currency), 2) + '</td>' : '') + '</tr>').join('') + '</tbody></table></div>' : UI.empty('Sin reservas en el período.', 'suitcase');
  }
  function oppTable(list) {
    return list.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Oportunidad</th><th>Cierre</th><th class="num">Monto S/</th><th class="num">Prob.</th><th class="num">Ponderado</th></tr></thead><tbody>' + list.map(o => '<tr><td><a href="#/crm/oportunidades/' + o.id + '">' + esc(o.title) + '</a><div class="cell-sub mono">' + o.id + ' · ' + esc(Q.userName(o.owner)) + '</div></td><td class="small nowrap">' + date(o.closeDate) + '</td><td class="num">' + fmtN(toPEN(o.amount, o.currency), 0) + '</td><td class="num">' + o.probability + '%</td><td class="num">' + fmtN(toPEN(o.amount, o.currency) * o.probability / 100, 0) + '</td></tr>').join('') + '</tbody></table></div>' : UI.empty('Sin oportunidades abiertas con cierre en el período.', 'target');
  }
  function bonusCard(t, e) {
    if (!t.bonus) return UI.card('Bono por cumplimiento', UI.empty('Las metas de ' + SCOPE_LBL[t.scopeType].toLowerCase() + ' no generan bono individual.', 'award'));
    const pol = DB.salesTargetPolicy; const cur = bonusFor(t, e.a.sales); const pj = bonusFor(t, e.proj.sales);
    const com = t.bonusCommissionId ? DB.commissions.find(c => c.id === t.bonusCommissionId) : null;
    return UI.card('Bono por cumplimiento', '<div class="stat-line"><span class="muted">Bono base</span><b>' + S0(t.bonus.amount) + '</b></div>' + pol.tiers.map(x => '<div class="stat-line"><span class="muted">Cumplimiento ≥ ' + x.min + '%</span><span>' + x.pay + '% del bono · <b>' + S0(t.bonus.amount * x.pay / 100) + '</b></span></div>').join('') +
      '<div class="stat-line total"><span>' + (t.status === 'cerrada' ? 'Bono liquidado' : 'Bono con el avance actual') + '</span><span class="num">' + S0(cur.amount) + '</span></div>' + (t.status === 'vigente' && e.tm.state !== 'finalizado' ? '<div class="xs faint">Con la proyección al cierre: ' + S0(pj.amount) + '</div>' : '') +
      (com ? '<div style="margin-top:10px">' + UI.alert('ok', 'Vinculado a la comisión <b class="mono">' + com.id + '</b> (' + esc(com.kind) + ') · ' + UI.badge(com.status) + (can('finance.commissions') ? ' · <a href="#/finanzas/comisiones/' + com.id + '">Ver en Comisiones</a>' : ' · Finanzas la aprueba y paga en planilla.')) + '</div>' : t.status === 'cerrada' ? '<div class="xs faint" style="margin-top:8px">No alcanzó el tramo mínimo: sin bono.</div>' : '<div class="xs faint" style="margin-top:8px">Al cerrar el período se genera la comisión «Bono por meta» en estado Calculada para aprobación de Finanzas (PROC-047).</div>'),
      { sub: 'Primario: monto de ventas · política del tenant' });
  }

  function salesView(b, rows) {
    const t = rows.find(x => x.scopeType === 'asesor');
    const hist = visibleTargets().filter(x => x.period !== S.period).sort((a, c) => pRange(c.period)[0].localeCompare(pRange(a.period)[0]));
    if (!t) { b.innerHTML = UI.alert('info', 'No tiene una meta asignada para ' + pLabel(S.period) + '. Su gerente define las metas; aquí verá el avance en cuanto se active.') + histCard(hist, false); bindHist(b); return; }
    const e = evalT(t); const p = achv(t, e);
    b.innerHTML = UI.alert('info', '<b>Vista de Ventas:</b> solo sus metas y sus registros (Scope). El ranking muestra la posición y el % de cumplimiento de cada asesor, sin montos ni bonos de otros (MET-BR-07).') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Cumplimiento de ventas', value: fmtN(p, 1) + '%', sub: S0(e.a.sales) + ' de ' + S0(t.goals.sales), tone: p >= 100 ? 'ok' : p >= 80 ? 'sun' : 'bad', icon: 'award' }) +
        UI.kpi({ label: 'Proyección al cierre', value: e.tm.state === 'en_curso' || e.tm.state === 'futuro' ? S0(e.proj.sales) : '—', sub: e.tm.state === 'en_curso' ? 'ritmo lineal ' + S0(e.lin.sales) + ' · pipeline ' + S0(e.a.pipe) : e.tm.state === 'futuro' ? 'pipeline ponderado del período' : 'período finalizado', tone: 'info', icon: 'trending' }) +
        UI.kpi({ label: 'Días del período', value: e.tm.state === 'futuro' ? 'Inicia ' + dateShort(pRange(t.period)[0]) : e.tm.elapsed + ' / ' + e.tm.total, sub: pLabel(t.period) + ' · ' + health(t, e), tone: 'accent', icon: 'calendar' }) +
        UI.kpi({ label: 'Bono estimado', value: S0(bonusFor(t, e.a.sales).amount), sub: t.bonus ? 'con proyección ' + S0(bonusFor(t, e.proj.sales).amount) : 'sin bono', tone: 'sun', icon: 'coins' }) +
      '</div>' + UI.card('Mi meta · ' + pLabel(t.period) + ' ' + health(t, e), metricBoxes(t, e), { actions: '<a class="btn sm ghost" href="#/crm/metas/' + t.id + '">Detalle ' + UI.icon('arrowRight') + '</a>' }) +
      '<div class="grid g-2-1"><div class="stack cg-col">' + UI.card('Reservas que suman a mi meta', resTable(e.a.res || [], true), { tight: true, sub: 'Reservas propias creadas en el período (excluye borradores y canceladas)' }) + UI.card('Mi pipeline con cierre en el período', oppTable(e.a.open || []), { tight: true }) + '</div><div class="stack cg-col">' + rankCard(t.period, false) + bonusCard(t, e) + '</div></div>' + histCard(hist, false);
    bindHist(b);
  }
  function managerView(b, rows, manage) {
    const ind = rows.filter(t => t.scopeType === 'asesor' && t.status !== 'borrador').map(t => ({ t, e: evalT(t) }));
    const goal = sum(ind, x => x.t.goals.sales), real = sum(ind, x => x.e.a.sales), proj = sum(ind, x => x.e.proj.sales);
    const risk = ind.filter(x => x.t.status === 'vigente' && x.e.tm.state === 'en_curso' && pct(x.e.proj.sales, x.t.goals.sales) < 100).length;
    const bonus = sum(ind, x => bonusFor(x.t, x.t.status === 'cerrada' ? x.e.a.sales : x.e.proj.sales).amount);
    const hist = DB.salesTargets.filter(t => t.status === 'cerrada' || (t.status === 'vigente' && pTime(t.period).state === 'finalizado'));
    b.innerHTML = (manage ? '' : UI.alert('info', 'Consulta en solo lectura: requiere <span class="mono">crm.targets.manage</span> para crear o ajustar metas.')) +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Meta de ventas (asesores)', value: S0(goal), sub: ind.length + ' metas individuales · ' + pLabel(S.period), tone: 'accent', icon: 'award' }) +
        UI.kpi({ label: 'Venta real', value: S0(real), sub: fmtN(pct(real, goal), 1) + '% de cumplimiento', tone: pct(real, goal) >= 100 ? 'ok' : 'info', icon: 'suitcase' }) +
        UI.kpi({ label: 'Proyección al cierre', value: S0(proj), sub: fmtN(pct(proj, goal), 1) + '% · con pipeline ponderado', tone: 'violet', icon: 'trending' }) +
        UI.kpi({ label: 'Asesores en riesgo', value: risk, sub: 'proyección < 100% en período en curso', tone: risk ? 'bad' : 'ok', icon: 'alert' }) +
        UI.kpi({ label: 'Bonos estimados', value: S0(bonus), sub: 'según tramos de la política', tone: 'sun', icon: 'coins' }) +
      '</div><div id="mt-tbl"></div><div class="grid g2">' + rankCard(S.period, true) + coverageCard(rows) + '</div>' + histCard(hist, true);
    UI.dataTable(b.querySelector('#mt-tbl'), {
      exportName: 'metas_' + S.period, rows: () => rows.map(t => ({ t, e: evalT(t), id: t.id })), search: x => x.t.id + ' ' + scopeName(x.t), searchPlaceholder: 'Buscar meta o alcance…', pageSize: 12,
      filters: [{ key: 'scope', label: 'Alcance', options: [['asesor', 'Asesor'], ['sede', 'Sede'], ['equipo', 'Equipo']], match: (x, v) => x.t.scopeType === v }, { key: 'status', label: 'Estado', options: [['borrador', 'Borrador'], ['vigente', 'Vigente'], ['cerrada', 'Cerrada']], match: (x, v) => x.t.status === v }],
      columns: [
        { key: 'id', label: 'Meta', render: x => '<div class="cell-main">' + (x.t.scopeType === 'asesor' ? UI.userChip(x.t.scopeId) : esc(scopeName(x.t))) + '</div><div class="cell-sub mono">' + x.t.id + ' · ' + SCOPE_LBL[x.t.scopeType] + ' · ' + x.t.periodType + '</div>', csv: x => x.t.id + ' ' + scopeName(x.t) },
        { key: 'goal', label: 'Meta ventas', align: 'num', sortVal: x => x.t.goals.sales, render: x => '<span class="nowrap">' + S0(x.t.goals.sales) + '</span>', csv: x => x.t.goals.sales },
        { key: 'real', label: 'Real', align: 'num', sortVal: x => x.e.a.sales, render: x => '<span class="nowrap">' + S0(x.e.a.sales) + '</span>', csv: x => x.e.a.sales.toFixed(2) },
        { key: 'pct', label: 'Avance', sortVal: x => achv(x.t, x.e), render: x => bar(achv(x.t, x.e)), csv: x => achv(x.t, x.e).toFixed(1) },
        { key: 'proj', label: 'Proyección', align: 'num', sortVal: x => x.e.proj.sales, render: x => x.e.frozen || x.e.tm.state === 'finalizado' ? '—' : '<span class="nowrap">' + S0(x.e.proj.sales) + '</span><div class="cell-sub">' + fmtN(pct(x.e.proj.sales, x.t.goals.sales), 0) + '%</div>', csv: x => x.e.proj.sales.toFixed(2) },
        { key: 'bk', label: 'Reservas', align: 'num', sort: false, render: x => fmtN(x.e.a.bookings, 0) + ' / ' + (x.t.goals.bookings == null ? '—' : x.t.goals.bookings), csv: x => x.e.a.bookings },
        { key: 'mg', label: 'Margen', align: 'num', sort: false, render: x => x.t.goals.margin ? fmtN(pct(x.e.a.margin, x.t.goals.margin), 0) + '%' : '—', csv: x => x.e.a.margin.toFixed(2) },
        { key: 'cv', label: 'Conversión', align: 'num', sort: false, render: x => x.e.a.conversion == null ? '—' : fmtN(x.e.a.conversion, 0) + '%' + (x.t.goals.conversion ? '<div class="cell-sub">meta ' + x.t.goals.conversion + '%</div>' : ''), csv: x => x.e.a.conversion == null ? '' : x.e.a.conversion.toFixed(1) },
        { key: 'st', label: 'Estado', sort: false, render: x => health(x.t, x.e), csv: x => x.t.status },
        { key: 'act', label: '', sort: false, csv: () => '', render: x => manage && ['borrador', 'vigente'].includes(x.t.status) ? '<button class="btn xs" data-adj="' + x.t.id + '">Ajustar</button>' : '' }
      ],
      onRow: x => App.go('#/crm/metas/' + x.t.id),
      afterDraw: (ct) => ct.querySelectorAll('[data-adj]').forEach(bt => bt.onclick = (ev) => { ev.stopPropagation(); adjustModal(DB.salesTargets.find(t => t.id === bt.dataset.adj)); })
    });
    bindHist(b);
  }
  function coverageCard(rows) {
    const grp = rows.filter(t => t.scopeType !== 'asesor' && t.status !== 'borrador');
    if (!grp.length) return UI.card('Metas de sede y equipo', UI.empty('Sin metas de sede o equipo para el período. Las metas trimestrales se ven al elegir el trimestre.', 'building'));
    return UI.card('Metas de sede y equipo', '<div class="list">' + grp.map(t => {
      const e = evalT(t); const p = achv(t, e);
      const ind = DB.salesTargets.filter(x => x.scopeType === 'asesor' && ['vigente', 'cerrada'].includes(x.status) && ownersOf(t).includes(x.scopeId) && pRange(x.period)[0] >= pRange(t.period)[0] && pRange(x.period)[1] <= pRange(t.period)[1] && x.period !== t.period);
      const cov = sum(ind, x => x.goals.sales);
      return '<a class="list-item click" href="#/crm/metas/' + t.id + '" style="display:block"><div class="row between small"><b>' + esc(scopeName(t)) + '</b>' + health(t, e) + '</div><div class="xs faint" style="margin:3px 0 6px">' + SCOPE_LBL[t.scopeType] + ' · ' + S0(e.a.sales) + ' de ' + S0(t.goals.sales) + ' · proyección ' + S0(e.proj.sales) + '</div>' + bar(p) + (t.scopeType === 'equipo' && ind.length ? '<div class="xs faint" style="margin-top:4px' + (cov < t.goals.sales ? ';color:var(--bad)' : '') + '">Cobertura por metas mensuales de sus asesores: ' + S0(cov) + (cov < t.goals.sales ? ' (faltan ' + S0(t.goals.sales - cov) + ')' : '') + '</div>' : '') + '</a>';
    }).join('') + '</div>', { tight: true, sub: 'Sede: reservas de la sede · Equipo: reservas de sus integrantes' });
  }
  function histCard(list, all) {
    return '<div id="mt-hist" data-all="' + (all ? 1 : 0) + '" data-ids="' + list.map(t => t.id).join(',') + '"></div>';
  }
  function bindHist(b) {
    const h = b.querySelector('#mt-hist'); if (!h) return; const ids = h.dataset.ids ? h.dataset.ids.split(',') : []; const all = h.dataset.all === '1';
    const rows = () => ids.map(id => DB.salesTargets.find(t => t.id === id)).filter(Boolean).map(t => ({ t, e: evalT(t) })).sort((a, c) => pRange(c.t.period)[0].localeCompare(pRange(a.t.period)[0]));
    UI.dataTable(h, {
      exportName: 'historial_metas', rows, search: x => x.t.id + ' ' + scopeName(x.t) + ' ' + pLabel(x.t.period), searchPlaceholder: 'Buscar en historial…', pageSize: 6,
      toolbar: '<b class="small" style="margin-right:6px">' + (all ? 'Historial de metas (cerradas o por cerrar)' : 'Mis metas de otros períodos') + '</b>',
      columns: [
        { key: 'p', label: 'Período', sortVal: x => pRange(x.t.period)[0], render: x => pLabel(x.t.period) + '<div class="cell-sub mono">' + x.t.id + '</div>', csv: x => x.t.period },
        { key: 's', label: 'Alcance', render: x => esc(scopeName(x.t)) + '<div class="cell-sub">' + SCOPE_LBL[x.t.scopeType] + '</div>', csv: x => scopeName(x.t) },
        { key: 'g', label: 'Meta', align: 'num', render: x => S0(x.t.goals.sales), csv: x => x.t.goals.sales },
        { key: 'r', label: 'Resultado', align: 'num', render: x => S0(x.e.a.sales), csv: x => x.e.a.sales },
        { key: 'pc', label: 'Cumplimiento', sortVal: x => achv(x.t, x.e), render: x => bar(achv(x.t, x.e)), csv: x => achv(x.t, x.e).toFixed(1) },
        { key: 'b', label: 'Bono', align: 'num', sort: false, render: x => { const c = x.t.bonusCommissionId && DB.commissions.find(y => y.id === x.t.bonusCommissionId); return c ? S0(c.amount) + '<div class="cell-sub">' + UI.statusLabel(c.status) + '</div>' : '—'; }, csv: x => { const c = x.t.bonusCommissionId && DB.commissions.find(y => y.id === x.t.bonusCommissionId); return c ? c.amount : 0; } },
        { key: 'st', label: 'Estado', sort: false, render: x => health(x.t, x.e), csv: x => x.t.status }
      ],
      empty: 'Sin períodos anteriores.',
      onRow: x => App.go('#/crm/metas/' + x.t.id)
    });
  }

  /* ---- Detalle de meta ---- */
  function targetDetail(el, id) {
    const t = DB.salesTargets.find(x => x.id === id);
    if (!t) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Meta no encontrada: ' + esc(id)) + '</div>'; return; }
    if (Scope.ownOnly() && !(t.scopeType === 'asesor' && t.scopeId === me() && t.status !== 'borrador')) { Scope.denied(el, 'La meta ' + t.id + ' (' + scopeName(t) + ')'); return; }
    const manage = can(TM); const e = evalT(t);
    const acts = [];
    if (manage && t.status === 'borrador') acts.push('<button class="btn danger" id="td-void">' + UI.icon('x') + 'Anular</button><button class="btn primary" id="td-act">' + UI.icon('check') + 'Activar meta</button>');
    if (manage && ['borrador', 'vigente'].includes(t.status)) acts.push('<button class="btn" id="td-adj">' + UI.icon('edit') + 'Ajustar</button>');
    if (manage && t.status === 'vigente') acts.push('<button class="btn primary" id="td-close"' + (e.tm.state !== 'finalizado' ? ' disabled title="MET-BR-06: se cierra al terminar el período (' + date(pRange(t.period)[1]) + ')"' : '') + '>' + UI.icon('fileCheck') + 'Cerrar período</button>');
    const showMargin = !Scope.ownOnly() || t.scopeId === me();
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(scopeName(t)) + ' · ' + pLabel(t.period) + ' ' + health(t, e), subtitle: '<span class="mono">' + t.id + '</span> · Meta ' + (t.periodType === 'mes' ? 'mensual' : 'trimestral') + ' de ' + SCOPE_LBL[t.scopeType].toLowerCase() + ' · creada por ' + esc(Q.userName(t.createdBy)) + ' el ' + datetime(t.createdAt), crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Metas comerciales', '#/crm/metas'], [t.id]], actions: acts.join('') }) +
      UI.card('', UI.flow(['Borrador', 'Vigente', 'Cerrada'], t.status === 'borrador' ? 0 : t.status === 'vigente' ? 1 : 3, t.status === 'anulada' ? 0 : undefined)) +
      (t.status === 'vigente' && e.tm.state === 'finalizado' ? UI.alert('warn', '<b>Período finalizado sin cerrar.</b> Al cerrar se congela el resultado y, si corresponde, se genera el bono en Comisiones.') : '') +
      (e.frozen ? UI.alert('info', 'Resultado congelado al cierre del período (' + datetime(t.result.closedAt) + '). Cambios posteriores en reservas no alteran esta meta (MET-BR-06).') : '') +
      UI.card('Indicadores', metricBoxes(t, e), { sub: e.tm.state === 'en_curso' ? 'Día ' + e.tm.elapsed + ' de ' + e.tm.total + ' · proyección = real + pipeline ponderado con cierre en el período · ritmo lineal ' + S0(e.lin.sales) : pLabel(t.period) + ' · ' + date(pRange(t.period)[0]) + ' al ' + date(pRange(t.period)[1]) }) +
      '<div class="grid g-2-1"><div class="stack cg-col">' + (e.frozen ? '' : UI.card('Reservas que suman a la meta', resTable(e.a.res, showMargin), { tight: true, sub: t.scopeType === 'sede' ? 'Reservas de la sede creadas en el período' : 'Reservas de ' + (t.scopeType === 'equipo' ? 'los integrantes' : 'el asesor') + ' creadas en el período' }) + UI.card('Pipeline con cierre en el período', oppTable(e.a.open), { tight: true })) + UI.card('Historial y ajustes (auditoría)', tl(t.history)) + '</div><div class="stack cg-col">' +
        UI.card('Definición', UI.dl([['Alcance', SCOPE_LBL[t.scopeType] + ' · ' + esc(scopeName(t))], t.scopeType === 'equipo' ? ['Integrantes', ownersOf(t).map(u => esc(Q.userName(u))).join(', ')] : null, ['Período', pLabel(t.period)], ['Ventas', S0(t.goals.sales)], ['Reservas', t.goals.bookings == null ? '—' : t.goals.bookings], ['Margen', t.goals.margin == null ? '—' : S0(t.goals.margin)], ['Conversión', t.goals.conversion == null ? '—' : t.goals.conversion + '%'], ['Estado', health(t, e)]])) +
        bonusCard(t, e) + (t.scopeType === 'asesor' ? rankCard(t.period, !Scope.ownOnly()) : '') + '</div></div></div>';
    const on = (s, f) => { const x = el.querySelector(s); if (x) x.onclick = f; };
    on('#td-adj', () => adjustModal(t));
    on('#td-act', () => { if (!need(TM, 'activar metas')) return; t.status = 'vigente'; t.history.push({ ts: nowStr(), u: me(), m: 'Meta activada' }); Audit.log('Meta comercial', t.id, 'activar', 'borrador', 'vigente'); notifyOwner(t, 'Nueva meta asignada: ' + pLabel(t.period) + ' · ventas ' + S0(t.goals.sales)); Store.save(); UI.toast('Meta ' + t.id + ' activada.'); App.render(); });
    on('#td-void', () => UI.confirm({ title: 'Anular meta', message: 'La meta en borrador <b>' + t.id + '</b> quedará anulada (no se elimina, queda en auditoría).', danger: true, reason: true, confirmLabel: 'Anular', onConfirm: (r) => { if (!need(TM, 'anular metas')) return; t.status = 'anulada'; t.history.push({ ts: nowStr(), u: me(), m: 'Anulada · ' + r }); Audit.log('Meta comercial', t.id, 'anular', 'borrador', 'anulada · ' + r); Store.save(); UI.toast('Meta anulada.'); App.go('#/crm/metas'); } }));
    on('#td-close', () => closeTarget(t));
  }
  function notifyOwner(t, subj) { if (t.scopeType === 'asesor') { const u = Q.user(t.scopeId); if (u) { Notify.push('meta.asignada', 'Portal', u.id, subj); Notify.push('meta.asignada', 'Email', u.email, subj); } } }
  function closeTarget(t) {
    if (!need(TM, 'cerrar metas')) return;
    const e = evalT(t); if (e.tm.state !== 'finalizado') { UI.toast('MET-BR-06: solo se cierra una meta cuando su período terminó (' + date(pRange(t.period)[1]) + ').', 'bad'); return; }
    const b = bonusFor(t, e.a.sales);
    UI.confirm({ title: 'Cerrar período ' + pLabel(t.period), message: 'Se congelará el resultado de <b>' + esc(scopeName(t)) + '</b>: ventas ' + S0(e.a.sales) + ' (' + fmtN(achv(t, e), 1) + '%), ' + e.a.bookings + ' reservas, margen ' + S0(e.a.margin) + '.' + (t.bonus ? '<br><br>' + esc(b.rule) + (b.amount ? '<br>Se generará la comisión <b>Bono por meta</b> por ' + S0(b.amount) + ' en estado Calculada para aprobación de Finanzas.' : '') : ''), confirmLabel: 'Cerrar período', onConfirm: () => {
      t.status = 'cerrada'; t.result = { sales: +e.a.sales.toFixed(2), bookings: e.a.bookings, margin: +e.a.margin.toFixed(2), conversion: e.a.conversion == null ? null : +e.a.conversion.toFixed(1), closedAt: nowStr(), closedBy: me(), frozen: true, resIds: e.a.res.map(r => r.id) };
      t.history.push({ ts: nowStr(), u: me(), m: 'Período cerrado · cumplimiento ' + fmtN(achv(t, e), 1) + '%' });
      Audit.log('Meta comercial', t.id, 'cerrar', 'vigente', 'cerrada · ' + fmtN(achv(t, e), 1) + '%');
      if (t.bonus && b.amount) {
        const cm = { id: nextId(DB.commissions, 'COM-', 4), resId: null, targetId: t.id, beneficiary: t.scopeId, kind: 'Bono por meta', base: t.result.sales, pct: +(b.amount / t.result.sales * 100).toFixed(2), amount: b.amount, currency: 'PEN', fx: null, status: 'calculada', rule: b.rule, createdAt: nowStr(), history: [{ ts: nowStr(), status: 'calculada', user: me(), note: b.rule }] };
        DB.commissions.unshift(cm); t.bonusCommissionId = cm.id; t.history.push({ ts: nowStr(), u: me(), m: 'Bono ' + S0(b.amount) + ' enviado a Comisiones (' + cm.id + ')' });
        Audit.log('Comisión', cm.id, 'calcular', '', 'Bono por meta ' + t.id + ' · ' + S0(b.amount));
        DB.users.filter(u => u.role === 'finance' && u.status === 'activo').forEach(u => Notify.push('comision.bono_meta', 'Email', u.email, 'Bono por meta ' + cm.id + ' por aprobar — ' + Q.userName(t.scopeId) + ' ' + S0(b.amount)));
      }
      notifyOwner(t, 'Cierre de meta ' + pLabel(t.period) + ': ' + fmtN(achv(t, e), 1) + '%' + (b.amount ? ' · bono ' + S0(b.amount) : ''));
      Store.save(); UI.toast('Período cerrado' + (b.amount ? '; bono ' + S0(b.amount) + ' enviado a Comisiones.' : '.')); App.render();
    } });
  }
  function goalFields(g, withBonus, bonus) {
    return [
      { id: 'g_sales', label: 'Monto de ventas (S/)', type: 'number', min: 1, step: 100, value: g.sales, required: true, col: 6 },
      { id: 'g_book', label: 'N.º de reservas', type: 'number', min: 0, value: g.bookings == null ? '' : g.bookings, col: 6 },
      { id: 'g_margin', label: 'Margen bruto (S/)', type: 'number', min: 0, step: 100, value: g.margin == null ? '' : g.margin, col: 6 },
      { id: 'g_conv', label: 'Conversión de oportunidades (%)', type: 'number', min: 0, max: 100, value: g.conversion == null ? '' : g.conversion, col: 6 }
    ].concat(withBonus ? [{ id: 'g_bonus', label: 'Bono base por cumplimiento (S/)', type: 'number', min: 0, step: 50, value: bonus ? bonus.amount : 600, col: 6, hint: 'Tramos: ' + DB.salesTargetPolicy.tiers.map(x => '≥' + x.min + '% → ' + x.pay + '%').join(' · ') }] : []);
  }
  const readGoals = (f) => ({ sales: Number(f.g_sales), bookings: f.g_book === '' ? null : Number(f.g_book), margin: f.g_margin === '' ? null : Number(f.g_margin), conversion: f.g_conv === '' ? null : Number(f.g_conv) });
  const goalsTxt = (g) => 'ventas ' + S0(g.sales) + ' · reservas ' + (g.bookings == null ? '—' : g.bookings) + ' · margen ' + (g.margin == null ? '—' : S0(g.margin)) + ' · conversión ' + (g.conversion == null ? '—' : g.conversion + '%');
  function targetModal() {
    if (!need(TM, 'crear metas')) return;
    const periods = [curMonth(), nextMonth(), curQ(), nextQ()];
    UI.modal({ title: 'Nueva meta comercial', size: 'lg', sub: 'Una meta por alcance y período (MET-BR-01). Se crea en borrador o activa.',
      body: UI.form([
        { id: 'n_type', label: 'Alcance', type: 'select', options: [['asesor', 'Asesor'], ['sede', 'Sede'], ['equipo', 'Equipo']], value: 'asesor', col: 4 },
        { id: 'n_scope', label: 'Asesor / sede / equipo', type: 'select', options: advisors().map(u => [u.id, u.name]), col: 8 },
        { id: 'n_period', label: 'Período', type: 'select', options: periods.map(p => [p, pLabel(p)]), value: nextMonth(), col: 6 },
        { id: 'n_act', label: 'Activar al crear (notifica al asesor)', type: 'switch', value: true, col: 6 },
        { type: 'section', label: 'Indicadores' }
      ].concat(goalFields({ sales: 10000, bookings: 3, margin: 2500, conversion: 30 }, true))) + '<div id="n-hint" style="margin-top:10px"></div>',
      onOpen: (m) => {
        const typ = m.querySelector('#n_type'), sc = m.querySelector('#n_scope'), per = m.querySelector('#n_period');
        const refill = () => { const t = typ.value; const opts = t === 'asesor' ? advisors().map(u => [u.id, u.name]) : t === 'sede' ? DB.sedes.map(s => [s.id, s.name]) : DB.salesTeams.map(x => [x.id, x.name]); sc.innerHTML = opts.map(o => '<option value="' + o[0] + '">' + esc(o[1]) + '</option>').join(''); const bf = m.querySelector('#g_bonus'); if (bf) bf.closest('.field').style.display = t === 'asesor' ? '' : 'none'; hint(); };
        const hint = () => { const f = UI.formData(m); const prev = DB.salesTargets.filter(x => x.scopeType === f.n_type && x.scopeId === f.n_scope && x.status === 'cerrada').sort((a, b) => b.period.localeCompare(a.period))[0]; const dup = DB.salesTargets.find(x => x.scopeType === f.n_type && x.scopeId === f.n_scope && x.period === f.n_period && x.status !== 'anulada'); m.querySelector('#n-hint').innerHTML = dup ? UI.alert('bad', 'MET-BR-01: ya existe la meta ' + dup.id + ' para este alcance y período.') : prev ? UI.alert('info', 'Referencia: en ' + pLabel(prev.period) + ' la meta fue ' + S0(prev.goals.sales) + ' y el resultado ' + S0(prev.result.sales) + ' (' + fmtN(pct(prev.result.sales, prev.goals.sales), 0) + '%).') : ''; };
        typ.onchange = refill; sc.onchange = hint; per.onchange = hint; refill();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Crear meta', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const g = readGoals(f);
        if (!(g.sales > 0)) { UI.toast('La meta de ventas debe ser mayor a cero.', 'bad'); return false; }
        if (g.conversion != null && (g.conversion < 0 || g.conversion > 100)) { UI.toast('La conversión debe estar entre 0 y 100%.', 'bad'); return false; }
        if (DB.salesTargets.some(x => x.scopeType === f.n_type && x.scopeId === f.n_scope && x.period === f.n_period && x.status !== 'anulada')) { UI.toast('MET-BR-01: ya existe una meta para ese alcance y período.', 'bad'); return false; }
        if (pTime(f.n_period).state === 'finalizado') { UI.toast('No se crean metas para períodos terminados.', 'bad'); return false; }
        const t = { id: nextId(DB.salesTargets, 'MET-', 4), scopeType: f.n_type, scopeId: f.n_scope, periodType: f.n_period.includes('Q') ? 'trimestre' : 'mes', period: f.n_period, goals: g, status: f.n_act ? 'vigente' : 'borrador', bonus: f.n_type === 'asesor' ? { amount: Number(f.g_bonus) || 0, currency: 'PEN' } : null, createdBy: me(), createdAt: nowStr(), result: null, bonusCommissionId: null, history: [{ ts: nowStr(), u: me(), m: 'Meta creada' + (f.n_act ? ' y activada' : ' en borrador') + ' · ' + goalsTxt(g) }] };
        DB.salesTargets.push(t); Audit.log('Meta comercial', t.id, 'crear', '', scopeName(t) + ' · ' + t.period + ' · ' + goalsTxt(g));
        if (t.status === 'vigente') notifyOwner(t, 'Nueva meta asignada: ' + pLabel(t.period) + ' · ventas ' + S0(g.sales));
        Store.save(); S.period = t.period; UI.toast('Meta ' + t.id + ' creada.'); App.go('#/crm/metas/' + t.id);
      } }] });
  }
  function adjustModal(t) {
    if (!need(TM, 'ajustar metas')) return;
    if (!['borrador', 'vigente'].includes(t.status)) { UI.toast('Solo se ajustan metas en borrador o vigentes.', 'bad'); return; }
    const tm = pTime(t.period); const pol = DB.salesTargetPolicy;
    UI.modal({ title: 'Ajustar meta ' + t.id, size: 'lg', sub: esc(scopeName(t)) + ' · ' + pLabel(t.period) + (tm.state === 'en_curso' ? ' · ' + fmtN(tm.frac * 100, 0) + '% del período transcurrido' : ''),
      body: (t.status === 'vigente' && tm.frac * 100 > pol.lockDecreaseAfterPct ? UI.alert('warn', 'MET-BR-05: transcurrió más del ' + pol.lockDecreaseAfterPct + '% del período. Solo el Tenant Admin puede <b>reducir</b> indicadores; los aumentos están permitidos.') : '') + UI.form(goalFields(t.goals, t.scopeType === 'asesor', t.bonus).concat([{ id: 'g_reason', label: 'Motivo del ajuste (queda en auditoría)', type: 'textarea', rows: 2, required: true, col: 12 }])),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar ajuste', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false; const f = UI.formData(m); const g = readGoals(f);
        if (!(g.sales > 0)) { UI.toast('La meta de ventas debe ser mayor a cero.', 'bad'); return false; }
        const lower = ['sales', 'bookings', 'margin', 'conversion'].some(k => g[k] != null && t.goals[k] != null && g[k] < t.goals[k]);
        if (lower && t.status === 'vigente' && tm.frac * 100 > pol.lockDecreaseAfterPct && Auth.role !== 'tenant_admin') { UI.toast('MET-BR-05: con más del ' + pol.lockDecreaseAfterPct + '% del período transcurrido, reducir la meta requiere al Tenant Admin.', 'bad'); return false; }
        const nb = t.scopeType === 'asesor' ? Number(f.g_bonus) || 0 : null;
        const diffs = ['sales', 'bookings', 'margin', 'conversion'].filter(k => g[k] !== t.goals[k]).map(k => MET[k].short.toLowerCase() + ' ' + (t.goals[k] == null ? '—' : MET[k].fmt(t.goals[k])) + ' → ' + (g[k] == null ? '—' : MET[k].fmt(g[k])));
        if (t.bonus && nb !== t.bonus.amount) diffs.push('bono ' + S0(t.bonus.amount) + ' → ' + S0(nb));
        if (!diffs.length) { UI.toast('No hay cambios que guardar.', 'info'); return false; }
        const before = goalsTxt(t.goals); t.goals = g; if (t.bonus) t.bonus.amount = nb;
        t.history.push({ ts: nowStr(), u: me(), m: 'Ajuste de meta · ' + diffs.join(' · ') + ' · Motivo: ' + f.g_reason });
        Audit.log('Meta comercial', t.id, 'ajustar', before, goalsTxt(g) + ' · motivo: ' + f.g_reason);
        if (t.status === 'vigente') notifyOwner(t, 'Su meta de ' + pLabel(t.period) + ' fue ajustada: ' + diffs.join(', '));
        Store.save(); UI.toast('Meta ajustada y registrada en auditoría.'); App.render();
      } }] });
  }
})();
