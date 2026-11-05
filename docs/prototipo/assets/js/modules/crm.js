/* ==========================================================================
   CRM — PROC-004 a PROC-010
   Leads (captación, duplicados, calificación BANT, conversión) · Oportunidades
   (pipeline kanban) · Actividades (agenda) · Clientes 360 · Postventa y fidelización
   ========================================================================== */
(function () {
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr, parseD } = Util;
  const TD = () => window.TODAY;
  const can = (p) => Auth.can(p);
  const deny = (what) => { UI.toast('Su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene permiso para ' + what + '. Regla transversal 17: el backend valida permisos.', 'bad'); return false; };
  const statusLabel = UI.statusLabel;

  /* ---------------- Catálogos locales ---------------- */
  const SOURCES = ['Formulario web', 'WhatsApp', 'Facebook Ads', 'Instagram', 'Referido', 'Feria Turismo', 'Llamada entrante', 'B2B', 'Email', 'Visita en oficina'];
  const CHANNELS = ['Web', 'WhatsApp', 'Facebook', 'Instagram', 'Teléfono', 'Presencial', 'Email'];
  const INTERESTS = ['Paquete', 'Tour', 'Excursión', 'Viaje corporativo', 'Viaje de promoción', 'Luna de miel', 'Alojamiento', 'Alianza'];
  const SEGMENTS = ['Retail', 'Corporativo', 'VIP', 'Grupos', 'B2B'];
  const ACT_TYPES = ['Llamada', 'Email', 'WhatsApp', 'Reunión', 'Tarea', 'Postventa'];
  const ACT_ICON = { Llamada: 'phoneCall', Email: 'mail', WhatsApp: 'msg', 'Reunión': 'users', Tarea: 'check', Postventa: 'heart' };
  const LOST_REASONS = ['Precio', 'Eligió a la competencia', 'Sin presupuesto', 'Cambio de planes del cliente', 'Sin respuesta del cliente', 'Producto o fecha sin disponibilidad', 'Otro'];
  const DISCARD_REASONS = ['No es cliente potencial (proveedor / alianza)', 'Datos de contacto inválidos', 'Sin interés real', 'Fuera de cobertura / destino no ofrecido', 'Spam o prueba', 'Otro'];
  const CLAIM_TYPES = ['Reclamo', 'Queja', 'Sugerencia', 'Felicitación'];
  const BANT = [
    { k: 'budget', l: 'Presupuesto', opts: [[0, 'No definido'], [10, 'Referencial / bajo'], [18, 'Definido y acorde al producto'], [25, 'Aprobado y disponible']] },
    { k: 'authority', l: 'Autoridad', opts: [[0, 'Desconocida'], [10, 'Influenciador'], [18, 'Co-decisor'], [25, 'Decisor final']] },
    { k: 'need', l: 'Necesidad', opts: [[0, 'Exploratoria'], [10, 'Interés general'], [18, 'Necesidad concreta'], [25, 'Urgente y específica']] },
    { k: 'timeline', l: 'Plazo', opts: [[0, 'Sin fecha'], [10, 'Más de 6 meses'], [18, 'Entre 1 y 6 meses'], [25, 'Menos de 30 días']] }
  ];
  const OPEN_STAGES = ['calificacion', 'descubrimiento', 'cotizacion', 'negociacion'];
  const isOpen = (o) => !['ganada', 'perdida'].includes(o.stage);

  /* Estado de vista (por sesión) */
  const S = { oppView: 'kanban', oppOwner: '', oppQ: '', actView: 'lista', actOwner: '', actType: '', weekStart: null, c360: {} };
  try { S.oppView = localStorage.getItem('crm_oppView') || 'kanban'; S.actView = localStorage.getItem('crm_actView') || 'lista'; } catch (e) { }
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };

  /* ---------------- CSS del módulo ---------------- */
  if (!document.getElementById('css-crm')) {
    const st = document.createElement('style'); st.id = 'css-crm';
    st.textContent = `
.crm-score{display:flex;align-items:center;gap:8px;min-width:100px}
.crm-score .sv{font-weight:600;font-size:.8rem;width:24px;text-align:right;font-variant-numeric:tabular-nums}
.crm-score .progress{flex:1;min-width:48px}
.crm-kb{grid-auto-columns:minmax(172px,1fr);scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.crm-kb .kcol{scroll-snap-align:start;min-height:240px}
.crm-kb .kcol-h{flex-wrap:wrap;gap:4px}
.crm-kb .kcol-h .cnt{font-size:.66rem;background:var(--surface);border-radius:10px;padding:0 6px;color:var(--fg-2);margin-left:4px}
.crm-kb .kcard{touch-action:pan-x pan-y}
.crm-kb .kcard .row{flex-wrap:nowrap}
.crm-kb .kcard .kmeta{display:flex;justify-content:space-between;gap:6px;align-items:center}
.crm-kb .kdrop{border:1px dashed var(--line);border-radius:8px;padding:14px 8px;text-align:center;font-size:.72rem;color:var(--fg-3)}
.crm-kb .kcol.won{background:var(--ok-soft)} .crm-kb .kcol.lost{background:var(--bad-soft)}
.crm-mob{display:none}
@media (max-width:760px){.crm-kb{grid-auto-columns:calc(100vw - 96px)}.crm-mob{display:flex}}
.crm-week{min-width:780px}
.crm-week .cal-d{min-height:230px}
.crm-week .cal-ev{white-space:normal;line-height:1.3;padding:4px 6px}
.cal-ev.done{opacity:.6;text-decoration:line-through}
.crm-actions{display:grid;gap:8px}
.crm-actions .btn{justify-content:flex-start;width:100%}
.nps-scale{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:4px}
.nps-scale button{height:36px;border:1px solid var(--line);border-radius:7px;background:var(--surface);cursor:pointer;font-weight:600;font-size:.84rem;padding:0}
.nps-scale button:hover{border-color:var(--accent)}
.nps-scale button.on.d{background:var(--bad);border-color:var(--bad);color:#fff}
.nps-scale button.on.n{background:var(--sun);border-color:var(--sun);color:#1d1300}
.nps-scale button.on.p{background:var(--ok);border-color:var(--ok);color:#fff}
.nps-legend{display:flex;justify-content:space-between;font-size:.7rem;color:var(--fg-3);margin-top:4px}
.crm-grp-h{display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--surface-2);border-bottom:1px solid var(--line-2);font-size:.78rem;font-weight:600}
.crm-grp-h .badge{margin-left:auto}
.crm-bant-row{display:grid;grid-template-columns:110px minmax(0,1fr) 44px;gap:10px;align-items:center;font-size:.82rem;padding:5px 0}
.crm-head{display:flex;gap:14px;align-items:center;min-width:0}
.crm-head .avatar{flex:none}
.crm-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 14px}
.crm-filters select.input{width:auto}
.crm-filters .search-in{flex:1 1 200px}
.crm-scope{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);font-size:.78rem;font-weight:600;color:var(--fg-2);white-space:nowrap}
.crm-scope svg{width:14px;height:14px}
.crm-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 22px}
@media (max-width:700px){.crm-kv{grid-template-columns:minmax(0,1fr)}}
`;
    document.head.appendChild(st);
  }

  /* ---------------- Datos complementarios (encuestas y reclamos) ---------------- */
  function ensure() {
    let dirty = false;
    if (!DB.surveys) {
      DB.surveys = [
        { id: 'ENC-0101', clientId: 'CLI-0006', resId: 'RES-2026-000346', score: 9, comment: 'Muy satisfecha con la organización. Sugiere más tiempo en la laguna Humantay.', channel: 'Llamada', date: '2026-09-27 12:10', by: 'U03' },
        { id: 'ENC-0100', clientId: 'CLI-0002', resId: null, score: 8, comment: 'Buena coordinación del viaje de integración. Mejorar puntualidad de traslados.', channel: 'Encuesta web', date: '2026-07-22 10:00', by: 'U02' },
        { id: 'ENC-0099', clientId: 'CLI-0003', resId: null, score: 10, comment: 'Excelente atención previa al viaje y respuesta rápida por WhatsApp.', channel: 'Email', date: '2026-07-05 09:30', by: 'U03' },
        { id: 'ENC-0098', clientId: 'CLI-0005', resId: null, score: 9, comment: 'Hotel y guía de primer nivel en el viaje a Paracas.', channel: 'Llamada', date: '2026-05-02 17:20', by: 'U04' },
        { id: 'ENC-0097', clientId: 'CLI-0007', resId: null, score: 8, comment: 'Cupos bien gestionados; vouchers llegaron con retraso.', channel: 'Email', date: '2026-06-15 11:00', by: 'U02' },
        { id: 'ENC-0096', clientId: 'CLI-0001', resId: null, score: 9, comment: 'Todo conforme en el full day a Paracas.', channel: 'WhatsApp', date: '2026-08-10 19:00', by: 'U04' },
        { id: 'ENC-0095', clientId: 'CLI-0001', resId: null, score: 5, comment: 'El hotel en Arequipa no correspondía a la categoría ofrecida.', channel: 'Llamada', date: '2026-05-18 16:40', by: 'U04' },
        { id: 'ENC-0094', clientId: 'CLI-0005', resId: null, score: 6, comment: 'Traslado al aeropuerto llegó 40 minutos tarde.', channel: 'Llamada', date: '2026-02-20 10:15', by: 'U04' }
      ];
      dirty = true;
    }
    if (!DB.claims) {
      DB.claims = [
        { id: 'REC-0014', clientId: 'CLI-0007', resId: 'RES-2026-000345', surveyId: null, type: 'Reclamo', priority: 'media', subject: 'Demora en emisión de vouchers para reservas B2B', desc: 'La agencia reporta que los vouchers de la salida del 02/10 aún no se reflejan en el portal B2B.', status: 'en_proceso', owner: 'U02', createdAt: '2026-09-28 10:20', resolution: '', log: [{ ts: '2026-09-28 10:20', u: 'U02', m: 'Registrado por llamada de Pamela Ortiz' }, { ts: '2026-09-28 15:00', u: 'U06', m: 'Operaciones revisa emisión pendiente' }] },
        { id: 'REC-0013', clientId: 'CLI-0006', resId: 'RES-2026-000346', surveyId: 'ENC-0101', type: 'Sugerencia', priority: 'baja', subject: 'Más tiempo en la laguna Humantay', desc: 'La pasajera sugiere ampliar el tiempo libre en la laguna (actualmente 45 min).', status: 'abierta', owner: 'U03', createdAt: '2026-09-27 12:15', resolution: '', log: [{ ts: '2026-09-27 12:15', u: 'U03', m: 'Registrado desde encuesta ENC-0101' }] },
        { id: 'REC-0012', clientId: 'CLI-0001', resId: null, surveyId: 'ENC-0095', type: 'Reclamo', priority: 'alta', subject: 'Detractor NPS 5 — categoría de hotel en Arequipa', desc: 'El hotel en Arequipa no correspondía a la categoría ofrecida.', status: 'resuelta', owner: 'U04', createdAt: '2026-05-18 16:45', resolution: 'Se otorgó nota de crédito del 15% y se retiró el hotel del programa.', log: [{ ts: '2026-05-18 16:45', u: 'U04', m: 'Caso generado automáticamente por NPS ≤ 6' }, { ts: '2026-05-21 12:00', u: 'U02', m: 'Resuelto: compensación aprobada por gerencia' }] },
        { id: 'REC-0010', clientId: 'CLI-0005', resId: null, surveyId: 'ENC-0094', type: 'Queja', priority: 'media', subject: 'Detractor NPS 6 — retraso de traslado', desc: 'Traslado al aeropuerto llegó 40 minutos tarde.', status: 'cerrada', owner: 'U04', createdAt: '2026-02-20 10:20', resolution: 'Proveedor amonestado; se asignó unidad de respaldo para clientes VIP.', log: [{ ts: '2026-02-20 10:20', u: 'U04', m: 'Caso generado automáticamente por NPS ≤ 6' }, { ts: '2026-02-24 09:00', u: 'U04', m: 'Cerrado con conformidad del cliente' }] }
      ];
      dirty = true;
    }
    if (!DB.crmQueueSeed) {
      DB.crmQueueSeed = true;
      if (!DB.leads.some(l => !l.owner && l.status === 'nuevo')) DB.leads.unshift({ id: nextId(DB.leads, 'LEAD-', 4), name: 'Valeria Chumpitaz Rojas', email: 'vchumpitaz@correo.pe', phone: '956 318 402', company: '', source: 'Formulario web', interest: 'Paquete', destination: 'Arequipa', productId: '', travelDate: '2026-11-14', pax: 3, channel: 'Web', status: 'nuevo', owner: '', score: 48, createdAt: TD() + ' 08:05', notes: 'Consulta por paquete familiar Arequipa y Colca, feriado largo de noviembre. Ingresó a la cola comercial sin asignar.', validatedAt: TD() + ' 08:05', createdBy: 'Sistema' });
      dirty = true;
    }
    DB.clients.forEach(c => { if (!c.contacts) { c.contacts = c.contactName ? [{ name: c.contactName, role: 'Contacto principal', email: c.email, phone: c.phone, primary: true }] : []; dirty = true; } });
    DB.leads.forEach(l => {
      if (l.status === 'convertido' && !l.convertedOppId) { const o = DB.opportunities.find(x => x.leadId === l.id); if (o) { l.convertedOppId = o.id; l.convertedClientId = o.clientId; dirty = true; } }
      if (l.status === 'duplicado' && !l.duplicateOf) { const d = findDups(l.email, l.phone, l.id)[0]; if (d) { l.duplicateOf = d.id; dirty = true; } }
      if (!l.bant && ['calificado', 'convertido'].includes(l.status)) { const q = Math.min(25, Math.round(l.score / 4)); l.bant = { budget: q, authority: q, need: Math.min(25, q + 2), timeline: Math.max(0, l.score - 3 * q - Math.min(25, q + 2) + q), amount: 0, currency: 'PEN', notes: '', at: l.createdAt, by: l.owner }; l.bant.timeline = Math.max(0, Math.min(25, l.score - l.bant.budget - l.bant.authority - l.bant.need)); dirty = true; }
    });
    if (dirty) Store.save();
  }

  /* ---------------- Helpers ---------------- */
  const nextId = (arr, prefix, w) => { const n = Math.max(0, ...arr.map(x => parseInt(String(x.id).replace(prefix, '').replace(/\D/g, ''), 10) || 0)); return prefix + String(n + 1).padStart(w, '0'); };
  const sellers = () => DB.users.filter(u => ['tenant_admin', 'manager', 'sales'].includes(u.role) && u.status === 'activo');
  const sellerOpts = () => sellers().map(u => [u.id, u.name + ' — ' + Q.roleName(u.role)]);
  const ownerFilterOpts = () => sellers().map(u => [u.id, u.name]);
  const strip = (o, p) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(p, ''), v]));
  const normE = s => String(s || '').trim().toLowerCase();
  const normP = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : ''; };
  const penK = (v) => 'S/ ' + (Math.abs(v) >= 1000 ? fmtN(v / 1000, 1) + 'k' : fmtN(v, 0));
  const noAccess = (el, what) => { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Acceso restringido', crumbs: [['CRM'], [what]] }) + UI.alert('bad', '<b>Su rol no tiene acceso a ' + esc(what) + '.</b> Los permisos se validan en el backend en cada solicitud (Regla transversal 17). Solicite al administrador del tenant el permiso correspondiente del módulo CRM.') + '</div>'; };
  const crmAllowed = () => Auth.canAny(['crm.leads.view', 'crm.clients.manage']);
  const readonlyNote = (perm, what) => can(perm) ? '' : UI.alert('warn', 'Modo consulta: su rol no puede ' + esc(what) + ' (permiso <span class="mono">' + esc(perm) + '</span>).');

  /* ---------------- Alcance por rol: cartera del asesor / filtro de gerencia ----------------
     Ventas (Scope.ownOnly): solo registros propios (+ leads sin asignar, que puede tomar).
     Gerente / Admin: todo el equipo, con filtro "Asesor" compartido entre CRM y Ventas y
     facultad de reasignar. Otros roles internos: consulta sin filtro. */
  const me = () => Auth.user.id;
  const own = () => Scope.ownOnly();
  const isSup = () => ['tenant_admin', 'manager'].includes(Auth.role);
  const Adv = { get() { try { return sessionStorage.getItem('qh_advisor') || ''; } catch (e) { return ''; } }, set(v) { try { sessionStorage.setItem('qh_advisor', v || ''); } catch (e) { } } };
  const adv = () => isSup() ? Adv.get() : '';
  const byAdv = (row, key = 'owner') => !adv() || row[key] === adv();
  const clientSet = () => Scope.clientIds();
  const canSeeClient = (id) => { const s = clientSet(); return !s || s.has(id); };
  const V = {
    leads: () => DB.leads.filter(l => own() ? (l.owner === me() || !l.owner) : byAdv(l)),
    opps: () => DB.opportunities.filter(o => own() ? o.owner === me() : byAdv(o)),
    acts: () => DB.activities.filter(a => own() ? a.owner === me() : byAdv(a)),
    clients: () => { const s = clientSet(); return DB.clients.filter(c => s ? s.has(c.id) : byAdv(c)); },
    quotes: () => DB.quotes.filter(q => own() ? q.owner === me() : true),
    res: () => DB.reservations.filter(r => own() ? r.owner === me() : true)
  };
  const mineOk = (row) => !own() || !row || row.owner === me();
  const notMine = (what) => { UI.toast(esc(what) + ' pertenece a la cartera de otro asesor. Con el rol Ventas solo gestiona registros propios (Scope: Mi cartera).', 'bad'); return false; };
  const canReassign = () => isSup() && can('crm.leads.manage');
  const ownerOpts = () => own() ? [[me(), Auth.user.name + ' (yo)']] : sellerOpts();
  function scopeCtl() {
    if (own()) return '<span class="crm-scope" title="Rol Ventas: solo ve y gestiona sus propios registros; los leads sin asignar pueden tomarse.">' + UI.icon('user') + 'Mi cartera</span>';
    if (!isSup()) return '';
    return '<select class="input sm" data-adv aria-label="Filtrar por asesor" style="width:auto"><option value="">Asesor: todos</option>' + sellers().map(u => '<option value="' + u.id + '"' + (u.id === Adv.get() ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') + '</select>';
  }
  const bindScope = (el) => el.querySelectorAll('[data-adv]').forEach(s => s.onchange = () => { Adv.set(s.value); App.render(); });
  const advNote = () => adv() ? UI.alert('info', 'Mostrando solo la cartera de <b>' + esc(Q.userName(adv())) + '</b>. Cambie el filtro “Asesor” para ver todo el equipo.') : '';
  function reassignModal(kind, row, extra) {
    if (!canReassign()) { UI.toast('Solo Gerencia o el Administrador pueden reasignar ' + kind.toLowerCase() + 's entre asesores.', 'bad'); return; }
    UI.modal({ title: 'Reasignar ' + kind.toLowerCase(), size: 'sm', sub: esc(row.id) + ' · actual: ' + esc(Q.userName(row.owner) || 'sin asignar'), body: UI.form([{ id: 'ra_owner', label: 'Nuevo asesor responsable', type: 'select', required: true, placeholder: 'Seleccione…', options: sellerOpts(), value: row.owner, col: 12 }, { id: 'ra_note', label: 'Motivo', type: 'textarea', rows: 2, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Reasignar', cls: 'primary', icon: 'user', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'ra_');
        if (d.owner === row.owner) { UI.toast('Seleccione un asesor distinto al actual.', 'bad'); return false; }
        const prev = row.owner; row.owner = d.owner; if (extra) extra(row, d.owner);
        Store.save(); Audit.log(kind, row.id, 'reasignar', Q.userName(prev) || 'sin asignar', Q.userName(d.owner) + (d.note ? ' · ' + d.note : ''));
        Notify.push(kind.toLowerCase() + '.reasignado', 'Portal', d.owner, kind + ' ' + row.id + ' reasignado a su cartera');
        UI.toast(kind + ' reasignado a ' + esc(Q.userName(d.owner)) + '.'); App.render();
      } }] });
  }

  const ownerShort = (id) => { const u = Q.user(id); if (!u) return '<span class="faint">' + esc(Q.userName(id)) + '</span>'; const parts = u.name.split(' '); return '<span class="row nowrap" style="gap:7px;flex-wrap:nowrap">' + UI.avatar(u) + '<span class="small">' + esc(parts[0] + ' ' + (parts[1] || '')) + '</span></span>'; };
  const clientLink = (id) => { const c = Q.client(id); return c ? '<a href="#/crm/clientes/' + c.id + '">' + esc(c.name) + '</a>' : '<span class="faint">—</span>'; };
  const oppLink = (id) => { const o = Q.opportunity(id); return o ? '<a href="#/crm/oportunidades/' + o.id + '">' + esc(o.title) + '</a>' : '<span class="faint">—</span>'; };
  const leadLink = (id) => { const l = Q.lead(id); return l ? '<a href="#/crm/leads/' + l.id + '">' + esc(l.name) + '</a>' : '<span class="faint">—</span>'; };
  const resLink = (id) => id ? '<a class="mono" href="#/reservas/' + esc(id) + '">' + esc(id) + '</a>' : '<span class="faint">—</span>';
  const quoteLink = (id) => id ? '<a class="mono" href="#/cotizaciones/' + esc(id) + '">' + esc(id) + '</a>' : '<span class="faint">—</span>';

  function relInfo(t, id) {
    if (!t || !id) return null;
    if (t === 'lead') { const x = Q.lead(id); return { kind: 'Lead', label: x ? x.name : id, href: '#/crm/leads/' + id }; }
    if (t === 'opportunity') { const x = Q.opportunity(id); return { kind: 'Oportunidad', label: x ? x.title : id, href: '#/crm/oportunidades/' + id }; }
    if (t === 'client') { const x = Q.client(id); return { kind: 'Cliente', label: x ? x.name : id, href: '#/crm/clientes/' + id }; }
    if (t === 'quote') { const x = Q.quote(id); return { kind: 'Cotización', label: x ? id + ' · ' + x.title : id, href: '#/cotizaciones/' + id }; }
    if (t === 'reservation') { const x = Q.reservation(id); return { kind: 'Reserva', label: x ? id + ' · ' + x.title : id, href: '#/reservas/' + id }; }
    return null;
  }
  const relHtml = (t, id) => { const r = relInfo(t, id); return r ? '<a href="' + r.href + '">' + esc(r.kind) + ': ' + esc(r.label) + '</a>' : '<span class="faint">Sin relación</span>'; };
  const actStatus = (a) => a.status === 'completada' ? 'completada' : (a.due < nowStr() ? 'vencida' : 'pendiente');

  const scoreHtml = (s) => { s = Math.round(+s || 0); const tone = s >= 75 ? 'ok' : s >= 50 ? '' : s >= 35 ? 'sun' : 'bad'; return '<div class="crm-score" title="Score ' + s + '/100"><span class="sv">' + s + '</span>' + UI.progress(s, tone) + '</div>'; };

  function deptOf(destId) { let d = Q.destination(destId); const orig = d; while (d && d.type !== 'Departamento' && d.parent) d = Q.destination(d.parent); return d && d.type === 'Departamento' ? d.name : (orig ? orig.name : ''); }
  function destOptions(cur) { const o = DB.destinations.filter(d => ['Departamento', 'Atracción', 'Ciudad', 'Zona', 'Lugar'].includes(d.type)).map(d => d.name); o.push('Varios'); if (cur && !o.includes(cur)) o.unshift(cur); return o; }
  const productOptions = () => DB.products.filter(p => p.status === 'ACTIVE' || p.status === 'APPROVED').map(p => [p.id, p.name + ' (' + p.code + ')']);

  function clientStats(id) {
    const c = Q.client(id) || {};
    const res = DB.reservations.filter(r => r.clientId === id && mineOk(r));
    const valid = res.filter(r => !['cancelada', 'borrador'].includes(r.status));
    const total = sum(valid, r => toPEN(r.total, r.currency));
    const rids = new Set(res.map(r => r.id));
    const recv = DB.receivables.filter(r => r.clientId === id && (!own() || rids.has(r.resId)) && !['pagada', 'cancelada'].includes(r.status));
    const balance = sum(recv, r => toPEN(r.amount - r.paid, r.currency));
    const overdue = recv.filter(r => r.status === 'vencida' || daysFromToday(r.due) < 0);
    const last = valid.map(r => r.createdAt.slice(0, 10)).sort().pop() || null;
    const surveys = (DB.surveys || []).filter(s => s.clientId === id).sort((a, b) => b.date.localeCompare(a.date));
    const nps = surveys.length ? surveys[0].score : (c.nps == null ? null : c.nps);
    return { res, valid, total, avg: valid.length ? total / valid.length : 0, balance, overdue, last, surveys, nps };
  }
  function clientDests(id) {
    const s = new Set();
    DB.reservations.filter(r => r.clientId === id && r.status !== 'cancelada').forEach(r => r.services.forEach(sv => { const p = Q.product(sv.productId); if (p) { const n = deptOf(p.destId); if (n) s.add(n); } }));
    DB.opportunities.filter(o => o.clientId === id && o.stage === 'ganada').forEach(o => String(o.destination || '').split('/').map(x => x.trim()).filter(x => x && x !== 'Varios').forEach(x => s.add(x)));
    return [...s];
  }
  const npsBadge = (n) => n == null ? '<span class="faint">—</span>' : UI.badge(n >= 9 ? 'ok' : n >= 7 ? 'pendiente' : 'error', String(n) + (n >= 9 ? ' · Promotor' : n >= 7 ? ' · Pasivo' : ' · Detractor'));
  function npsStats(list) { const n = list.length; const p = list.filter(s => s.score >= 9).length; const d = list.filter(s => s.score <= 6).length; return { n, p, d, pas: n - p - d, nps: n ? Math.round((p - d) / n * 100) : 0, avg: n ? sum(list, 'score') / n : 0 }; }

  function findDups(email, phone, exclude) {
    const e = normE(email), p = normP(phone), out = [];
    if (!e && !p) return out;
    const hit = (x) => { const r = []; if (e && normE(x.email) === e) r.push('correo'); if (p && normP(x.phone) === p) r.push('teléfono'); return r; };
    DB.clients.forEach(c => { const r = hit(c); if (r.length) out.push({ type: 'client', id: c.id, name: c.name, by: r, status: c.segment }); });
    DB.leads.forEach(l => { if (l.id === exclude) return; const r = hit(l); if (r.length) out.push({ type: 'lead', id: l.id, name: l.name, by: r, status: l.status }); });
    return out;
  }
  const dupList = (d) => '<div class="list" style="margin-top:8px">' + d.map(x => '<div class="list-item" style="padding:8px 0"><div class="ico-box ' + (x.type === 'client' ? 'violet' : 'warn') + '">' + UI.icon(x.type === 'client' ? 'user' : 'funnel') + '</div><div class="grow"><div class="small"><a href="#/crm/' + (x.type === 'client' ? 'clientes/' : 'leads/') + x.id + '">' + esc(x.name) + '</a> <span class="mono xs faint">' + x.id + '</span></div><div class="xs faint">' + (x.type === 'client' ? 'Cliente existente · ' + esc(x.status) : 'Lead · ' + esc(statusLabel(x.status))) + ' · coincide por ' + x.by.join(' y ') + '</div></div></div>').join('') + '</div>';

  function auditFor(ids) { const set = new Set(ids.filter(Boolean)); return DB.audit.filter(a => set.has(a.entityId)); }
  function auditTimeline(list, max) {
    return UI.timeline(list.slice(0, max || 30).map(a => ({ icon: a.action.includes('crear') ? 'plus' : a.action.includes('convert') ? 'arrowRight' : a.action.includes('descart') || a.action.includes('perd') ? 'x' : 'history', title: esc(a.entity) + ' · ' + esc(a.action.replace(/_/g, ' ')) + ' <span class="mono xs faint">' + esc(a.entityId) + '</span>', meta: datetime(a.ts) + ' · ' + esc(Q.userName(a.user)), desc: (a.before ? esc(a.before) + ' → ' : '') + esc(a.after) })));
  }

  function actItem(a, opts = {}) {
    const st = actStatus(a);
    const btns = st !== 'completada' && can('crm.activities.manage') && mineOk(a) ? '<div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-complete="' + a.id + '">' + UI.icon('check') + 'Completar</button><button class="btn sm ghost icon" data-resched="' + a.id + '" title="Reprogramar" aria-label="Reprogramar">' + UI.icon('clock') + '</button></div>' : '';
    return '<div class="list-item"><div class="ico-box ' + (st === 'vencida' ? 'bad' : st === 'completada' ? 'ok' : a.type === 'Postventa' ? 'violet' : '') + '">' + UI.icon(ACT_ICON[a.type] || 'check') + '</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550"><a href="javascript:void(0)" data-actview="' + a.id + '" style="color:inherit">' + esc(a.subject) + '</a></div><div class="xs faint">' + esc(a.type) + ' · ' + datetime(a.due) + ' · ' + esc(Q.userName(a.owner)) + (opts.rel !== false ? ' · ' + relHtml(a.relType, a.relId) : '') + '</div>' + (a.result ? '<div class="xs muted" style="margin-top:3px">Resultado: ' + esc(a.result) + '</div>' : '') + '</div>' + UI.badge(st) + btns + '</div>';
  }
  function bindActs(root) {
    root.querySelectorAll('[data-complete]').forEach(b => b.onclick = (e) => { e.stopPropagation(); completeActivity(DB.activities.find(a => a.id === b.dataset.complete)); });
    root.querySelectorAll('[data-resched]').forEach(b => b.onclick = (e) => { e.stopPropagation(); reschedule(DB.activities.find(a => a.id === b.dataset.resched)); });
    root.querySelectorAll('[data-actview]').forEach(b => b.onclick = (e) => { e.preventDefault(); activityDrawer(DB.activities.find(a => a.id === b.dataset.actview)); });
  }
  const actsBlock = (acts, opts) => acts.length ? '<div class="list">' + acts.map(a => actItem(a, opts)).join('') + '</div>' : UI.empty('Sin actividades registradas', 'calendar');

  /* ======================================================================
     ACTIVIDADES (PROC-007) — modales compartidos
     ====================================================================== */
  function relOptions(t) {
    if (t === 'lead') return DB.leads.filter(l => l.status !== 'descartado' && mineOk(l)).map(l => [l.id, l.id + ' · ' + l.name]);
    if (t === 'opportunity') return DB.opportunities.filter(mineOk).map(o => [o.id, o.id + ' · ' + o.title]);
    if (t === 'client') return DB.clients.filter(c => canSeeClient(c.id)).map(c => [c.id, c.name]);
    if (t === 'quote') return DB.quotes.filter(mineOk).map(q => [q.id, q.id + ' · ' + q.title]);
    return [];
  }
  function activityModal(preset = {}) {
    if (!can('crm.activities.manage')) return deny('registrar actividades');
    const due = preset.due || (addDays(TD(), 1) + ' 10:00');
    const body = UI.form([
      { id: 'af_type', label: 'Tipo', type: 'select', required: true, options: ACT_TYPES, value: preset.type || 'Llamada', col: 4 },
      { id: 'af_subject', label: 'Asunto', required: true, value: preset.subject || '', col: 8, placeholder: 'Ej.: Presentar opciones de hotel' },
      { id: 'af_relType', label: 'Relacionado con', type: 'select', options: [['', 'Sin relación'], ['lead', 'Lead'], ['opportunity', 'Oportunidad'], ['client', 'Cliente'], ['quote', 'Cotización']], value: preset.relType || '', col: 4 },
      { id: 'af_relId', label: 'Registro', type: 'select', placeholder: 'Seleccione…', options: relOptions(preset.relType), value: preset.relId || '', col: 8 },
      { id: 'af_owner', label: 'Responsable', type: 'select', required: true, options: own() ? ownerOpts() : sellerOpts().concat(DB.users.filter(u => u.role === 'operations' && u.status === 'activo').map(u => [u.id, u.name + ' — Operaciones'])), value: own() ? me() : (preset.owner || Auth.user.id), col: 4 },
      { id: 'af_date', label: 'Fecha', type: 'date', required: true, value: due.slice(0, 10), col: 4 },
      { id: 'af_time', label: 'Hora', type: 'time', required: true, value: due.slice(11, 16), col: 4 },
      { id: 'af_notes', label: 'Descripción / guion', type: 'textarea', rows: 2, value: preset.notes || '', col: 12 }
    ]);
    UI.modal({ title: 'Nueva actividad', sub: 'PROC-007 · Crear → Asignar → Programar → Ejecutar → Resultado → Próxima actividad', body,
      onOpen: (m) => { m.querySelector('#af_relType').onchange = (e) => { const s = m.querySelector('#af_relId'); s.innerHTML = '<option value="">Seleccione…</option>' + relOptions(e.target.value).map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join(''); }; },
      actions: [{ label: 'Cancelar' }, { label: 'Programar actividad', cls: 'primary', icon: 'calendar', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const d = strip(UI.formData(m), 'af_');
        if (d.relType && !d.relId) { UI.toast('Seleccione el registro relacionado.', 'bad'); return false; }
        const a = { id: nextId(DB.activities, 'ACT-', 4), type: d.type, subject: d.subject, relType: d.relType || null, relId: d.relId || null, owner: d.owner, due: d.date + ' ' + d.time, status: 'pendiente', result: '', notes: d.notes, createdAt: nowStr(), createdBy: Auth.user.id };
        DB.activities.unshift(a); Store.save();
        Audit.log('Actividad', a.id, 'crear', '', a.type + ' · ' + a.due);
        if (a.owner !== Auth.user.id) Notify.push('actividad.asignada', 'Push', a.owner, 'Nueva actividad asignada: ' + a.subject);
        UI.toast('Actividad ' + a.id + ' programada para ' + datetime(a.due) + '.');
        if (preset.onSaved) preset.onSaved(a); else App.render();
      } }] });
  }
  function completeActivity(a) {
    if (!a) return;
    if (!can('crm.activities.manage')) return deny('completar actividades');
    if (!mineOk(a)) return notMine('La actividad ' + a.id);
    const body = UI.alert('info', '<b>' + esc(a.subject) + '</b><br><span class="small">' + esc(a.type) + ' · ' + datetime(a.due) + ' · ' + relHtml(a.relType, a.relId) + '</span>') +
      '<div style="margin-top:14px">' + UI.form([
        { id: 'cf_result', label: 'Resultado obtenido', type: 'textarea', required: true, rows: 3, col: 12, placeholder: 'Ej.: Cliente confirma presupuesto y solicita dos alternativas de hotel.' },
        { id: 'cf_next', label: 'Programar la próxima actividad (seguimiento)', type: 'switch', value: true, col: 12 }
      ]) + '</div><div id="cf-nextbox" style="margin-top:12px">' + UI.form([
        { id: 'nx_type', label: 'Tipo', type: 'select', options: ACT_TYPES, value: a.type === 'Postventa' ? 'Postventa' : 'Llamada', col: 4 },
        { id: 'nx_subject', label: 'Asunto', value: 'Seguimiento: ' + a.subject.replace(/^Seguimiento: /, ''), col: 8 },
        { id: 'nx_date', label: 'Fecha', type: 'date', value: addDays(TD(), 2), col: 6 },
        { id: 'nx_time', label: 'Hora', type: 'time', value: '10:00', col: 6 }
      ]) + '</div>';
    UI.modal({ title: 'Completar actividad', sub: a.id, body,
      onOpen: (m) => { const sw = m.querySelector('#cf_next'); const box = m.querySelector('#cf-nextbox'); sw.onchange = () => box.classList.toggle('hide', !sw.checked); },
      actions: [{ label: 'Cancelar' }, { label: 'Registrar resultado', cls: 'primary', icon: 'check', onClick: (m) => {
        const res = m.querySelector('#cf_result'); if (!res.value.trim()) { res.classList.add('err'); UI.toast('Registre el resultado de la actividad (PROC-007).', 'bad'); return false; }
        const nx = m.querySelector('#cf_next').checked; const d = strip(UI.formData(m), 'nx_');
        if (nx && (!d.subject || !d.date || !d.time)) { UI.toast('Complete los datos de la próxima actividad.', 'bad'); return false; }
        a.status = 'completada'; a.result = res.value.trim(); a.completedAt = nowStr();
        Audit.log('Actividad', a.id, 'completar', 'pendiente', a.result.slice(0, 80));
        let extra = '';
        if (a.relType === 'lead') { const l = Q.lead(a.relId); if (l && l.status === 'nuevo' && ['Llamada', 'Email', 'WhatsApp', 'Reunión'].includes(a.type)) { l.status = 'contactado'; l.firstContactAt = nowStr(); Audit.log('Lead', l.id, 'primer_contacto', 'nuevo', 'contactado'); extra = ' El lead pasó a “Contactado”.'; } }
        if (nx) { const n = { id: nextId(DB.activities, 'ACT-', 4), type: d.type, subject: d.subject, relType: a.relType, relId: a.relId, owner: a.owner, due: d.date + ' ' + d.time, status: 'pendiente', result: '', createdAt: nowStr(), createdBy: Auth.user.id, prevId: a.id }; DB.activities.unshift(n); Audit.log('Actividad', n.id, 'crear', 'seguimiento de ' + a.id, n.due); extra += ' Próxima actividad ' + n.id + ' programada.'; }
        Store.save(); UI.toast('Actividad completada.' + extra); App.render();
      } }] });
  }
  function reschedule(a) {
    if (!a) return;
    if (!can('crm.activities.manage')) return deny('reprogramar actividades');
    if (!mineOk(a)) return notMine('La actividad ' + a.id);
    UI.modal({ title: 'Reprogramar actividad', size: 'sm', sub: esc(a.subject), body: UI.form([{ id: 'rs_date', label: 'Nueva fecha', type: 'date', required: true, value: a.due.slice(0, 10) < TD() ? TD() : a.due.slice(0, 10), col: 6 }, { id: 'rs_time', label: 'Hora', type: 'time', required: true, value: a.due.slice(11, 16), col: 6 }, { id: 'rs_reason', label: 'Motivo', type: 'textarea', rows: 2, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Reprogramar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'rs_'); const before = a.due; a.due = d.date + ' ' + d.time; a.status = 'pendiente'; Store.save(); Audit.log('Actividad', a.id, 'reprogramar', before, a.due + (d.reason ? ' · ' + d.reason : '')); UI.toast('Actividad reprogramada para ' + datetime(a.due) + '.'); App.render(); } }] });
  }
  function activityDrawer(a) {
    if (!a) return;
    const st = actStatus(a);
    UI.drawer({ title: esc(a.subject), sub: a.id + ' · ' + esc(a.type), body: UI.dl([['Estado', UI.badge(st)], ['Tipo', esc(a.type)], ['Programada', datetime(a.due)], ['Responsable', UI.userChip(a.owner)], ['Relacionado', relHtml(a.relType, a.relId)], ['Descripción', esc(a.notes || '')], ['Resultado', esc(a.result || '')], ['Completada', a.completedAt ? datetime(a.completedAt) : '']]) + '<div class="divider" style="margin:16px 0"></div><div class="upper" style="margin-bottom:8px">Auditoría</div>' + auditTimeline(auditFor([a.id]), 10),
      actions: (st === 'completada' || !can('crm.activities.manage') || !mineOk(a) ? [{ label: 'Cerrar' }] : [{ label: 'Reprogramar', icon: 'clock', onClick: () => { UI.closeDrawer(); reschedule(a); } }, { label: 'Completar', cls: 'primary', icon: 'check', onClick: () => { UI.closeDrawer(); completeActivity(a); } }]).concat(canReassign() && st !== 'completada' ? [{ label: 'Reasignar', icon: 'user', onClick: () => { UI.closeDrawer(); reassignModal('Actividad', a); } }] : []) });
  }

  /* ======================================================================
     LEADS (PROC-004 / PROC-005)
     ====================================================================== */
  const LEAD_STEPS = ['Lead recibido', 'Validar', 'Detectar duplicado', 'Registrar', 'Asignar', 'Primer contacto', 'Calificar', 'Convertir'];
  function leadStep(l) {
    if (l.status === 'convertido') return [8];
    if (l.status === 'duplicado') return [2, 2];
    if (l.status === 'descartado') { const at = l.discardedAtStep != null ? l.discardedAtStep : 6; return [at, at]; }
    if (!l.owner) return [4];
    return [l.status === 'nuevo' ? 5 : l.status === 'contactado' ? 6 : l.status === 'calificado' ? 7 : 4];
  }
  const initialScore = (d) => Math.min(70, 25 + (d.email ? 8 : 0) + (d.phone ? 8 : 0) + (d.travelDate ? 10 : 0) + (+d.pax > 0 ? 5 : 0) + (d.productId ? 8 : 0) + (d.company ? 4 : 0) + (['Referido', 'Llamada entrante'].includes(d.source) ? 6 : 0));

  App.register('crm', () => { location.replace('#/crm/leads'); });

  App.register('crm/leads', (el, params) => {
    if (!Auth.can('crm.leads.view')) return noAccess(el, 'Leads');
    ensure();
    if (params[0] === 'nuevo') { leadList(el); leadForm(); return; }
    if (params[0]) { const l = Q.lead(params[0]); if (l && own() && l.owner && l.owner !== me()) return Scope.denied(el, 'El lead ' + l.id + ' (' + l.name + ')'); return leadDetail(el, params[0]); }
    leadList(el);
  });

  function leadList(el) {
    const L = V.leads();
    const today = L.filter(l => String(l.createdAt).startsWith(TD()));
    const nuevos = L.filter(l => l.status === 'nuevo');
    const calif = L.filter(l => l.status === 'calificado');
    const conv = L.filter(l => l.status === 'convertido');
    const base = L.filter(l => l.status !== 'duplicado');
    const rate = base.length ? conv.length / base.length * 100 : 0;
    const bySource = Object.entries(L.reduce((m, l) => { m[l.source] = (m[l.source] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
    const byStatus = ['nuevo', 'contactado', 'calificado', 'convertido', 'duplicado', 'descartado'].map(s => [s, L.filter(l => l.status === s).length]);

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: 'Leads', subtitle: 'Captación y calificación (PROC-004 / PROC-005). Cada lead se valida, se revisa contra leads y clientes existentes, se asigna, se contacta y se califica antes de convertirlo en cliente y oportunidad.', crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Leads']],
        actions: scopeCtl() + '<a class="btn" href="#/crm/oportunidades">' + UI.icon('target') + 'Pipeline</a>' + (can('crm.leads.manage') ? '<button class="btn primary" id="btn-new-lead">' + UI.icon('plus') + 'Nuevo lead</button>' : '') }) +
      readonlyNote('crm.leads.manage', 'registrar ni modificar leads') + advNote() +
      (own() && L.some(l => !l.owner) ? UI.alert('info', '<b>' + L.filter(l => !l.owner).length + ' lead(s) sin asignar en la cola comercial.</b> Ábralo y use “Tomar lead” para asignárselo; la acción queda auditada.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Nuevos hoy', value: today.length, sub: 'recibidos el ' + dateShort(TD()), tone: 'info', icon: 'funnel' }) +
        UI.kpi({ label: 'Sin contactar', value: nuevos.length, sub: nuevos.filter(l => !l.owner).length + (own() ? ' en cola sin asignar' : ' sin responsable'), tone: nuevos.length ? 'sun' : 'ok', icon: 'phoneCall' }) +
        UI.kpi({ label: 'Calificados', value: calif.length, sub: 'listos para convertir', tone: 'violet', icon: 'target' }) +
        UI.kpi({ label: 'Tasa de conversión', value: fmtN(rate, 1) + '%', sub: conv.length + ' de ' + base.length + ' leads válidos', tone: 'ok', icon: 'trending' }) +
      '</div><div id="lead-tbl"></div>' +
      '<div class="grid g2">' +
        UI.card('Leads por fuente', UI.chart.hbars({ items: bySource.map(([k, v]) => ({ label: k, value: v })) }), { sub: 'Origen de captación' }) +
        UI.card('Leads por estado', UI.chart.hbars({ items: byStatus.map(([k, v], i) => ({ label: statusLabel(k), value: v, color: ['var(--info)', 'var(--accent)', 'var(--violet)', 'var(--ok)', 'var(--warn)', 'var(--fg-3)'][i] })) }), { sub: own() ? 'Embudo de mi cartera' : 'Embudo actual de la cartera' }) +
      '</div></div>';

    UI.dataTable(el.querySelector('#lead-tbl'), {
      rows: () => V.leads(), exportName: 'leads', defaultSort: 'createdAt', defaultDir: -1, pageSize: 10,
      searchPlaceholder: 'Buscar nombre, empresa, correo, teléfono…',
      search: (r) => [r.id, r.name, r.company, r.email, r.phone, r.destination, r.notes].join(' '),
      filters: [
        { key: 'status', label: 'Estado', options: ['nuevo', 'contactado', 'calificado', 'convertido', 'duplicado', 'descartado'] },
        { key: 'source', label: 'Fuente', options: SOURCES.filter(s => L.some(l => l.source === s)).map(s => [s, s]) },
        { key: 'owner', label: 'Asignación', options: own() ? [['__me', 'Asignados a mí'], ['__none', 'Sin asignar (cola)']] : [['__none', 'Sin asignar'], ['__any', 'Con responsable']], match: (r, v) => v === '__none' ? !r.owner : v === '__me' ? r.owner === me() : !!r.owner }
      ],
      columns: [
        { key: 'name', label: 'Lead', render: r => '<div class="cell-main">' + esc(r.name) + '</div><div class="cell-sub"><span class="mono">' + r.id + '</span>' + (r.company ? ' · ' + esc(r.company) : '') + '</div>' },
        { key: 'email', label: 'Contacto', sort: false, render: r => '<div class="small">' + esc(r.email || '—') + '</div><div class="cell-sub">' + esc(r.phone || '') + '</div>', csv: r => r.email + ' / ' + r.phone },
        { key: 'source', label: 'Fuente · canal', render: r => '<div class="small">' + esc(r.source) + '</div><div class="cell-sub">' + esc(r.channel) + '</div>' },
        { key: 'destination', label: 'Interés', render: r => '<div class="small">' + esc(r.interest) + '</div><div class="cell-sub">' + esc(r.destination || '—') + (r.travelDate ? ' · ' + dateShort(r.travelDate) : '') + '</div>' },
        { key: 'pax', label: 'Pax', align: 'num' },
        { key: 'score', label: 'Score', render: r => scoreHtml(r.score) },
        { key: 'owner', label: 'Responsable', render: r => r.owner ? ownerShort(r.owner) : UI.badge('pendiente', 'Sin asignar'), csv: r => Q.userName(r.owner) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), csv: r => statusLabel(r.status) },
        { key: 'createdAt', label: 'Recibido', render: r => '<span class="nowrap small">' + datetime(r.createdAt) + '</span>' }
      ],
      onRow: r => App.go('#/crm/leads/' + r.id)
    });
    const b = el.querySelector('#btn-new-lead'); if (b) b.onclick = () => leadForm();
    bindScope(el);
  }

  function leadForm(lead) {
    if (!can('crm.leads.manage')) return deny('registrar leads');
    const isNew = !lead;
    const l = lead || { pax: 2, channel: 'Web', source: 'Formulario web', interest: 'Paquete', owner: Auth.user.role === 'sales' ? Auth.user.id : '' };
    const body = UI.alert('info', 'Validación previa (PROC-004): se requiere al menos un dato de contacto válido (correo o teléfono). El sistema revisa duplicados contra <b>leads</b> y <b>clientes</b> por correo y teléfono.') + '<div style="margin-top:14px">' + UI.form([
      { type: 'section', label: 'Datos del contacto' },
      { id: 'lf_name', label: 'Nombre completo', required: true, value: l.name, col: 6 },
      { id: 'lf_company', label: 'Empresa / institución', value: l.company, col: 6 },
      { id: 'lf_email', label: 'Correo electrónico', type: 'email', value: l.email, col: 4, placeholder: 'nombre@dominio.pe' },
      { id: 'lf_phone', label: 'Teléfono / WhatsApp', value: l.phone, col: 4, placeholder: '9XX XXX XXX' },
      { id: 'lf_channel', label: 'Canal', type: 'select', required: true, options: CHANNELS, value: l.channel, col: 4 },
      { type: 'html', col: 12, html: '<div id="lf-dup"></div>' },
      { type: 'section', label: 'Requerimiento de viaje' },
      { id: 'lf_source', label: 'Fuente', type: 'select', required: true, options: SOURCES, value: l.source, col: 4 },
      { id: 'lf_interest', label: 'Interés', type: 'select', required: true, options: INTERESTS, value: l.interest, col: 4 },
      { id: 'lf_destination', label: 'Destino', type: 'select', placeholder: 'Seleccione…', options: destOptions(l.destination), value: l.destination, col: 4 },
      { id: 'lf_productId', label: 'Producto de interés', type: 'select', placeholder: 'Sin definir', options: productOptions(), value: l.productId, col: 6 },
      { id: 'lf_travelDate', label: 'Fecha tentativa de viaje', type: 'date', value: l.travelDate, col: 3 },
      { id: 'lf_pax', label: 'Pasajeros', type: 'number', min: 0, value: l.pax, col: 3 },
      { type: 'section', label: 'Asignación' },
      own() ? { type: 'html', col: 12, html: '<div class="xs faint">Responsable: <b>' + esc(Q.userName(l.owner || me())) + '</b>. Con el rol Ventas el lead queda en su cartera; solo Gerencia puede reasignarlo a otro asesor.</div>' } : { id: 'lf_owner', label: 'Responsable', type: 'select', placeholder: 'Sin asignar (cola comercial)', options: sellerOpts(), value: l.owner, col: 6 },
      own() ? { type: 'html', col: 12, html: '' } : { type: 'html', col: 6, html: '<div class="xs faint" style="padding-top:24px">Si se asigna, el responsable recibe una notificación en el portal (PROC-059).</div>' },
      { id: 'lf_notes', label: 'Notas', type: 'textarea', rows: 2, value: l.notes, col: 12 }
    ]) + '</div>';
    UI.modal({ title: isNew ? 'Nuevo lead' : 'Editar lead ' + l.id, size: 'lg', body,
      onOpen: (m) => {
        const box = m.querySelector('#lf-dup');
        const check = () => { const d = findDups(m.querySelector('#lf_email').value, m.querySelector('#lf_phone').value, l.id); box.innerHTML = d.length ? UI.alert('warn', '<b>Posible duplicado detectado</b> (' + d.length + ' coincidencia' + (d.length > 1 ? 's' : '') + '). Al guardar podrá fusionarlo o marcarlo como duplicado.' + dupList(d)) : ''; };
        ['#lf_email', '#lf_phone'].forEach(s => { m.querySelector(s).addEventListener('input', Util.debounce(check, 250)); });
        if (!isNew) check();
      },
      actions: [{ label: 'Cancelar' }, { label: isNew ? 'Validar y registrar' : 'Guardar cambios', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const d = strip(UI.formData(m), 'lf_');
        if (own()) d.owner = (lead && lead.owner) || me();
        if (!isNew && !mineOk(lead) && lead.owner) return notMine('El lead ' + lead.id);
        if (!d.email && !d.phone) { UI.toast('Validación PROC-004: registre al menos correo o teléfono.', 'bad'); m.querySelector('#lf_email').classList.add('err'); return false; }
        if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { UI.toast('El correo electrónico no tiene un formato válido.', 'bad'); m.querySelector('#lf_email').classList.add('err'); return false; }
        if (d.phone && String(d.phone).replace(/\D/g, '').length < 7) { UI.toast('El teléfono debe tener al menos 7 dígitos.', 'bad'); m.querySelector('#lf_phone').classList.add('err'); return false; }
        if (d.travelDate && d.travelDate < TD()) { UI.toast('La fecha tentativa de viaje no puede ser anterior a hoy.', 'bad'); return false; }
        d.pax = +d.pax || 0;
        if (!isNew) {
          const changed = Object.keys(d).filter(k => String(lead[k] == null ? '' : lead[k]) !== String(d[k]));
          const prevOwner = lead.owner;
          Object.assign(lead, d); Store.save();
          Audit.log('Lead', lead.id, 'editar', changed.join(', ') || 'sin cambios', 'actualizado');
          if (d.owner && d.owner !== prevOwner) { Audit.log('Lead', lead.id, 'asignar', Q.userName(prevOwner), Q.userName(d.owner)); Notify.push('lead.asignado', 'Portal', d.owner, 'Lead asignado: ' + lead.name + ' (' + lead.id + ')'); }
          UI.toast('Lead actualizado.'); App.render(); return;
        }
        const dups = findDups(d.email, d.phone);
        if (!dups.length) { createLead(d, {}); return; }
        setTimeout(() => dupDecision(d, dups), 0);
      } }] });
  }

  function createLead(d, { status, duplicateOf, note }) {
    const l = { id: nextId(DB.leads, 'LEAD-', 4), name: d.name, email: d.email, phone: d.phone, company: d.company, source: d.source, interest: d.interest, destination: d.destination, productId: d.productId || '', travelDate: d.travelDate, pax: d.pax, channel: d.channel, status: status || 'nuevo', owner: d.owner || '', score: initialScore(d), createdAt: nowStr(), notes: [d.notes, note].filter(Boolean).join(' '), duplicateOf: duplicateOf || null, validatedAt: nowStr(), createdBy: Auth.user.id };
    DB.leads.unshift(l); Store.save();
    Audit.log('Lead', l.id, 'crear', d.source, l.status + (duplicateOf ? ' (duplicado de ' + duplicateOf + ')' : ''));
    if (l.owner) { Audit.log('Lead', l.id, 'asignar', 'sin asignar', Q.userName(l.owner)); if (l.owner !== Auth.user.id) Notify.push('lead.asignado', 'Portal', l.owner, 'Nuevo lead asignado: ' + l.name + ' (' + l.id + ')'); }
    UI.toast('Lead ' + l.id + ' registrado' + (status === 'duplicado' ? ' y marcado como duplicado' : '') + '.');
    App.go('#/crm/leads/' + l.id);
    return l;
  }

  function dupDecision(d, dups) {
    const leadMatch = dups.find(x => x.type === 'lead' && !['convertido', 'descartado', 'duplicado'].includes(x.status));
    const first = dups[0];
    const opts = [];
    if (leadMatch) opts.push(['merge', '<b>Fusionar con ' + esc(leadMatch.id) + '</b><br><span class="xs faint">Se completan los datos faltantes del lead existente, se agrega la nota y no se crea un registro nuevo.</span>']);
    opts.push(['dup', '<b>Registrar y marcar como duplicado de ' + esc(first.id) + '</b><br><span class="xs faint">Queda trazado en el historial sin entrar a la cola comercial.</span>']);
    opts.push(['new', '<b>Registrar como lead nuevo de todos modos</b><br><span class="xs faint">Use esta opción si se trata de otra persona (p. ej. teléfono compartido de empresa).</span>']);
    UI.modal({ title: 'Duplicado detectado', sub: 'PROC-004 · Detectar duplicado', body: UI.alert('warn', 'El lead <b>' + esc(d.name) + '</b> coincide con registros existentes:' + dupList(dups)) + '<div class="col" style="margin-top:14px;gap:8px">' + opts.map((o, i) => '<label class="role-opt' + (i === 0 ? ' on' : '') + '" style="align-items:flex-start"><input type="radio" name="dupopt" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + ' style="margin-top:3px;accent-color:var(--accent)"><div>' + o[1] + '</div></label>').join('') + '</div>',
      onOpen: (m) => m.querySelectorAll('input[name=dupopt]').forEach(r => r.onchange = () => m.querySelectorAll('label.role-opt').forEach(x => x.classList.toggle('on', x.contains(m.querySelector('input[name=dupopt]:checked'))))),
      actions: [{ label: 'Volver' }, { label: 'Aplicar', cls: 'primary', onClick: (m) => {
        const v = m.querySelector('input[name=dupopt]:checked').value;
        if (v === 'merge') {
          const ex = Q.lead(leadMatch.id);
          ['email', 'phone', 'company', 'destination', 'productId', 'travelDate'].forEach(k => { if (!ex[k] && d[k]) ex[k] = d[k]; });
          if (d.pax && !ex.pax) ex.pax = d.pax;
          ex.notes = [ex.notes, '[Fusionado ' + dateShort(TD()) + ' · ' + d.source + '/' + d.channel + '] ' + (d.notes || 'Nuevo ingreso del mismo contacto.')].filter(Boolean).join(' ');
          ex.score = Math.min(100, (ex.score || 0) + 5);
          Store.save(); Audit.log('Lead', ex.id, 'fusionar', 'ingreso ' + d.source, 'fusionado en ' + ex.id);
          UI.toast('Ingreso fusionado con el lead ' + ex.id + '.'); App.go('#/crm/leads/' + ex.id);
        } else if (v === 'dup') createLead(d, { status: 'duplicado', duplicateOf: first.id, note: 'Coincide con ' + first.id + ' (' + first.by.join(' y ') + ').' });
        else createLead(d, { note: 'Registrado pese a coincidencia con ' + first.id + '.' });
      } }] });
  }

  function leadDetail(el, id) {
    const l = Q.lead(id);
    if (!l) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Lead no encontrado', crumbs: [['CRM'], ['Leads', '#/crm/leads']] }) + UI.card('', UI.empty('No existe el lead ' + id, 'funnel')) + '</div>'; return; }
    const [step, failed] = leadStep(l);
    const acts = DB.activities.filter(a => a.relType === 'lead' && a.relId === l.id).sort((a, b) => b.due.localeCompare(a.due));
    const dups = findDups(l.email, l.phone, l.id);
    const canM = can('crm.leads.manage');
    const mine = mineOk(l);
    const manage = canM && mine;
    const closed = ['convertido', 'descartado'].includes(l.status);
    const prod = l.productId ? Q.product(l.productId) : null;
    const b = l.bant;

    let banner = '';
    if (l.status === 'convertido') banner = UI.alert('ok', '<b>Lead convertido</b> el ' + datetime(l.convertedAt || l.createdAt) + '. Cliente: ' + clientLink(l.convertedClientId) + ' · Oportunidad: ' + oppLink(l.convertedOppId) + '. El historial del lead se conserva y se muestra en el Customer 360.');
    else if (l.status === 'duplicado') banner = UI.alert('warn', '<b>Marcado como duplicado</b> de ' + (l.duplicateOf ? (l.duplicateOf.startsWith('CLI') ? clientLink(l.duplicateOf) : leadLink(l.duplicateOf)) + ' <span class="mono xs">' + esc(l.duplicateOf) + '</span>' : 'un registro existente') + '. No forma parte de la cola comercial.');
    else if (l.status === 'descartado') banner = UI.alert('bad', '<b>Lead descartado.</b> Motivo: ' + esc(l.discardReason || l.notes || 'no registrado') + (l.discardedAt ? ' · ' + datetime(l.discardedAt) : ''));
    else if (!l.owner) banner = UI.alert('warn', '<b>Lead sin responsable.</b> ' + (own() ? 'Está en la cola comercial: use “Tomar lead” para asignárselo e iniciar el primer contacto.' : 'Asigne un ejecutivo para iniciar el primer contacto (PROC-004 · Asignar).'));
    else if (l.status === 'calificado') banner = UI.alert('info', '<b>Lead calificado.</b> Puede convertirlo en cliente y oportunidad; el historial se conserva (PROC-005).');

    const why = !canM ? 'Requiere permiso crm.leads.manage' : !mine ? 'Tome el lead para gestionarlo' : '';
    const actBtn = (idA, ic, label, cls, show = true) => show ? '<button class="btn ' + (cls || '') + '" id="' + idA + '"' + (manage ? '' : ' disabled title="' + esc(why) + '"') + '>' + UI.icon(ic) + label + '</button>' : '';
    const actions = '<div class="crm-actions">' +
      (!l.owner && canM && !closed ? '<button class="btn primary" id="la-take" title="Asignarme este lead (queda auditado)">' + UI.icon('user') + 'Tomar lead</button>' : '') +
      actBtn('la-convert', 'arrowRight', 'Convertir en cliente + oportunidad', l.owner ? 'primary' : '', !closed && l.status !== 'duplicado') +
      (canReassign() ? actBtn('la-assign', 'user', l.owner ? 'Reasignar responsable' : 'Asignar responsable', '', !closed) : '') +
      '<button class="btn" id="la-activity"' + (can('crm.activities.manage') && mine ? '' : ' disabled title="' + esc(can('crm.activities.manage') ? why : 'Requiere permiso crm.activities.manage') + '"') + '>' + UI.icon('calendar') + 'Registrar actividad</button>' +
      actBtn('la-qualify', 'target', 'Calificar (BANT)', '', !closed && l.status !== 'duplicado') +
      actBtn('la-status', 'refresh', 'Cambiar estado', '', !closed) +
      actBtn('la-edit', 'edit', 'Editar datos', '', !closed) +
      actBtn('la-discard', 'x', 'Descartar con motivo', 'ghost', !closed) +
      actBtn('la-reopen', 'refresh', 'Reabrir lead', '', l.status === 'descartado' || l.status === 'duplicado') +
      '</div>' + (!canM ? '<p class="xs faint" style="margin-top:8px">Su rol no puede modificar leads.</p>' : !mine ? '<p class="xs faint" style="margin-top:8px">Lead en cola comercial sin asignar: tómelo para gestionarlo. La reasignación entre asesores la realiza Gerencia.</p>' : own() && !closed ? '<p class="xs faint" style="margin-top:8px">La reasignación a otro asesor la realiza Gerencia.</p>' : '');

    const bantHtml = b ? '<div>' + BANT.map(x => { const v = +b[x.k] || 0; const lbl = (x.opts.slice().reverse().find(o => v >= o[0]) || x.opts[0])[1]; return '<div class="crm-bant-row"><span class="muted">' + x.l + '</span><div><div class="xs faint" style="margin-bottom:3px">' + esc(lbl) + '</div>' + UI.progress(v / 25 * 100, v >= 18 ? 'ok' : v >= 10 ? '' : 'sun') + '</div><b class="num right">' + v + '/25</b></div>'; }).join('') + '<div class="stat-line total"><span>Score total</span><span>' + l.score + ' / 100</span></div>' + (b.amount ? '<div class="stat-line"><span class="muted">Presupuesto declarado</span><b>' + money(b.amount, b.currency) + '</b></div>' : '') + (b.notes ? '<p class="small muted" style="margin-top:8px">' + esc(b.notes) + '</p>' : '') + '<p class="xs faint" style="margin-top:6px">Calificado por ' + esc(Q.userName(b.by)) + ' · ' + datetime(b.at) + '</p></div>' : UI.empty('Aún no se ha calificado este lead. Use “Calificar (BANT)”.', 'target');

    const hist = auditFor([l.id]).concat(acts.filter(a => a.status === 'completada').map(a => ({ ts: a.completedAt || a.due, user: a.owner, entity: 'Actividad', entityId: a.id, action: 'completar', before: a.type, after: a.result })));
    hist.sort((a, b2) => b2.ts.localeCompare(a.ts));
    hist.push({ ts: l.createdAt, user: l.createdBy || 'Sistema', entity: 'Lead', entityId: l.id, action: 'recibido', before: '', after: l.source + ' · ' + l.channel });

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: esc(l.name) + ' ' + UI.badge(l.status), subtitle: '<span class="mono">' + l.id + '</span> · ' + esc(l.source) + ' vía ' + esc(l.channel) + ' · recibido ' + datetime(l.createdAt), crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Leads', '#/crm/leads'], [l.id]],
        actions: (own() ? scopeCtl() : '') + '<a class="btn" href="#/crm/leads">' + UI.icon('chevronLeft') + 'Volver</a>' }) +
      banner +
      UI.card('Flujo de captación y calificación', UI.flow(LEAD_STEPS, step, failed), { sub: 'PROC-004 Captación → PROC-005 Calificación y conversión' }) +
      '<div class="grid g-2-1"><div class="stack">' +
        UI.card('Ficha del lead', '<div class="crm-kv">' + UI.dl([['Nombre', esc(l.name)], ['Empresa', esc(l.company)], ['Correo', l.email ? '<a href="javascript:void(0)" data-copy="' + esc(l.email) + '">' + esc(l.email) + '</a>' : ''], ['Teléfono', esc(l.phone)], ['Canal', esc(l.channel)], ['Fuente', esc(l.source)]]) + UI.dl([['Interés', esc(l.interest)], ['Destino', esc(l.destination)], ['Producto', prod ? '<a href="#/catalogo/productos/' + prod.id + '">' + esc(prod.name) + '</a>' : ''], ['Fecha de viaje', l.travelDate ? date(l.travelDate) + ' <span class="faint xs">(' + daysFromToday(l.travelDate) + ' d)</span>' : ''], ['Pasajeros', l.pax ? String(l.pax) : ''], ['Score', scoreHtml(l.score)]]) + '</div>' + (l.notes ? '<div class="divider" style="margin:14px 0 10px"></div><div class="upper" style="margin-bottom:4px">Notas</div><p class="small">' + esc(l.notes) + '</p>' : '')) +
        UI.card('Calificación BANT', bantHtml, { sub: 'Presupuesto · Autoridad · Necesidad · Plazo' }) +
        UI.card('Actividades', actsBlock(acts, { rel: false }), { tight: true, sub: acts.length + ' registrada(s)', actions: can('crm.activities.manage') && mine ? '<button class="btn sm" id="la-activity2">' + UI.icon('plus') + 'Actividad</button>' : '' }) +
        UI.card('Historial', auditTimeline(hist, 25), { sub: 'Auditoría y actividades completadas' }) +
      '</div><div class="stack">' +
        UI.card('Acciones', actions) +
        UI.card('Responsable', l.owner ? UI.userChip(l.owner) + '<div class="xs faint" style="margin-top:8px">' + (l.firstContactAt ? 'Primer contacto: ' + datetime(l.firstContactAt) : 'Sin primer contacto registrado') + '</div>' : UI.empty('Sin responsable asignado', 'user')) +
        UI.card('Detección de duplicados', dups.length ? UI.alert('warn', dups.length + ' coincidencia(s) por correo o teléfono.') + dupList(dups) + (manage && !closed && l.status !== 'duplicado' ? '<div class="row" style="margin-top:10px">' + (dups.find(x => x.type === 'lead' && !['convertido', 'duplicado'].includes(x.status)) ? '<button class="btn sm" id="la-mergein">' + UI.icon('copy') + 'Fusionar en este lead</button>' : '') + '<button class="btn sm" id="la-markdup">' + UI.icon('alert') + 'Marcar como duplicado</button></div>' : '') : UI.alert('ok', 'Sin coincidencias con leads ni clientes existentes.'), { sub: 'Correo y teléfono vs. leads y clientes' }) +
        (l.convertedOppId ? UI.card('Resultado de la conversión', UI.dl([['Cliente', clientLink(l.convertedClientId)], ['Oportunidad', oppLink(l.convertedOppId)], ['Etapa', Q.opportunity(l.convertedOppId) ? UI.badge(Q.opportunity(l.convertedOppId).stage) : '']])) : '') +
      '</div></div></div>';

    const on = (s, fn) => { const x = el.querySelector(s); if (x) x.onclick = fn; };
    el.querySelectorAll('[data-copy]').forEach(a => a.onclick = (e) => { e.preventDefault(); UI.copy(a.dataset.copy); });
    on('#la-take', () => takeLead(l));
    on('#la-convert', () => convertLead(l));
    on('#la-assign', () => assignLead(l));
    on('#la-activity', () => activityModal({ relType: 'lead', relId: l.id, owner: l.owner || Auth.user.id, subject: l.status === 'nuevo' ? 'Primer contacto — ' + l.name : 'Seguimiento — ' + l.name, due: nowStr() }));
    on('#la-activity2', () => activityModal({ relType: 'lead', relId: l.id, owner: l.owner || Auth.user.id, subject: 'Seguimiento — ' + l.name }));
    on('#la-qualify', () => qualifyLead(l));
    on('#la-status', () => changeLeadStatus(l));
    on('#la-edit', () => leadForm(l));
    on('#la-discard', () => discardLead(l));
    on('#la-reopen', () => UI.confirm({ title: 'Reabrir lead', message: 'El lead volverá a la cola comercial con estado “Nuevo”.', confirmLabel: 'Reabrir', onConfirm: () => { const b4 = l.status; l.status = 'nuevo'; l.duplicateOf = null; Store.save(); Audit.log('Lead', l.id, 'reabrir', b4, 'nuevo'); UI.toast('Lead reabierto.'); App.render(); } }));
    on('#la-markdup', () => { const t = dups[0]; UI.confirm({ title: 'Marcar como duplicado', message: 'Se marcará <b>' + esc(l.id) + '</b> como duplicado de <b>' + esc(t.id) + '</b> (' + esc(t.name) + ').', confirmLabel: 'Marcar duplicado', danger: true, onConfirm: () => { const b4 = l.status; l.status = 'duplicado'; l.duplicateOf = t.id; Store.save(); Audit.log('Lead', l.id, 'marcar_duplicado', b4, 'duplicado de ' + t.id); UI.toast('Lead marcado como duplicado.'); App.render(); } }); });
    on('#la-mergein', () => {
      const t = Q.lead(dups.find(x => x.type === 'lead' && !['convertido', 'duplicado'].includes(x.status)).id);
      UI.confirm({ title: 'Fusionar leads', message: 'Se fusionará <b>' + esc(t.id) + '</b> (' + esc(t.name) + ') dentro de <b>' + esc(l.id) + '</b>: se completan datos faltantes, sus actividades pasan a este lead y el otro queda como duplicado.', confirmLabel: 'Fusionar', onConfirm: () => {
        ['email', 'phone', 'company', 'destination', 'productId', 'travelDate'].forEach(k => { if (!l[k] && t[k]) l[k] = t[k]; });
        l.pax = l.pax || t.pax; l.score = Math.max(l.score, t.score); l.notes = [l.notes, '[Fusionado desde ' + t.id + '] ' + (t.notes || '')].filter(Boolean).join(' ');
        DB.activities.filter(a => a.relType === 'lead' && a.relId === t.id).forEach(a => { a.relId = l.id; a.mergedFrom = t.id; });
        const b4 = t.status; t.status = 'duplicado'; t.duplicateOf = l.id;
        Store.save(); Audit.log('Lead', t.id, 'fusionar', b4, 'duplicado de ' + l.id); Audit.log('Lead', l.id, 'fusionar', '', 'absorbe ' + t.id);
        UI.toast('Leads fusionados.'); App.render();
      } });
    });
    bindActs(el);
  }

  function takeLead(l) {
    if (!can('crm.leads.manage')) return deny('tomar leads');
    if (l.owner) { UI.toast('El lead ya fue tomado por ' + esc(Q.userName(l.owner)) + '.', 'warn'); App.render(); return; }
    UI.confirm({ title: 'Tomar lead', message: 'Se asignará <b>' + esc(l.name) + '</b> (' + esc(l.id) + ') a su cartera y se programará el primer contacto en 2 horas. La acción queda auditada.', confirmLabel: 'Tomar lead', onConfirm: () => {
      if (l.owner) { UI.toast('Otro asesor tomó el lead antes que usted.', 'bad'); App.render(); return; }
      l.owner = me(); l.assignedAt = nowStr(); l.takenBy = me();
      const t = new Date(); t.setHours(t.getHours() + 2);
      DB.activities.unshift({ id: nextId(DB.activities, 'ACT-', 4), type: 'Llamada', subject: 'Primer contacto — ' + l.name, relType: 'lead', relId: l.id, owner: me(), due: TD() + ' ' + String(Math.min(20, t.getHours())).padStart(2, '0') + ':00', status: 'pendiente', result: '', createdAt: nowStr(), createdBy: me() });
      Store.save(); Audit.log('Lead', l.id, 'tomar_lead', 'sin asignar (cola comercial)', Q.userName(me()));
      DB.users.filter(u => u.role === 'manager' && u.status === 'activo').forEach(u => Notify.push('lead.tomado', 'Portal', u.id, Auth.user.name + ' tomó el lead ' + l.id + ' (' + l.name + ')'));
      UI.toast('Lead ' + l.id + ' asignado a su cartera.'); App.render();
    } });
  }
  function assignLead(l) {
    if (!can('crm.leads.manage')) return deny('asignar leads');
    if (!canReassign()) { UI.toast('Solo Gerencia o el Administrador asignan o reasignan leads entre asesores. Use “Tomar lead” para los leads sin asignar.', 'bad'); return; }
    UI.modal({ title: 'Asignar responsable', size: 'sm', sub: l.id + ' · ' + esc(l.name), body: UI.form([{ id: 'as_owner', label: 'Ejecutivo comercial', type: 'select', required: true, placeholder: 'Seleccione…', options: sellerOpts(), value: l.owner, col: 12 }, { id: 'as_first', label: 'Programar primer contacto en 2 horas', type: 'switch', value: l.status === 'nuevo', col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Asignar', cls: 'primary', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'as_');
        const prev = l.owner; l.owner = d.owner; l.assignedAt = nowStr();
        if (d.first) { const t = new Date(); t.setHours(t.getHours() + 2); const due = TD() + ' ' + String(t.getHours()).padStart(2, '0') + ':00'; DB.activities.unshift({ id: nextId(DB.activities, 'ACT-', 4), type: 'Llamada', subject: 'Primer contacto — ' + l.name, relType: 'lead', relId: l.id, owner: d.owner, due, status: 'pendiente', result: '', createdAt: nowStr(), createdBy: Auth.user.id }); }
        Store.save(); Audit.log('Lead', l.id, 'asignar', prev ? Q.userName(prev) : 'sin asignar', Q.userName(d.owner));
        Notify.push('lead.asignado', 'Portal', d.owner, 'Lead asignado: ' + l.name + ' (' + l.id + ')');
        UI.toast('Lead asignado a ' + esc(Q.userName(d.owner)) + '.'); App.render();
      } }] });
  }
  function changeLeadStatus(l) {
    if (!can('crm.leads.manage')) return deny('cambiar el estado del lead');
    if (!mineOk(l)) return notMine('El lead ' + l.id);
    UI.modal({ title: 'Cambiar estado del lead', size: 'sm', body: UI.form([{ id: 'ls_status', label: 'Nuevo estado', type: 'select', required: true, options: ['nuevo', 'contactado', 'calificado'].map(s => [s, statusLabel(s)]), value: l.status, col: 12 }, { id: 'ls_note', label: 'Comentario', type: 'textarea', rows: 2, col: 12 }]) + '<p class="xs faint" style="margin-top:10px">“Convertido” y “Descartado” se registran con sus acciones específicas para conservar la trazabilidad.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Aplicar', cls: 'primary', onClick: (m) => {
        const d = strip(UI.formData(m), 'ls_');
        if (d.status === 'calificado' && (l.score || 0) < 50) { UI.toast('PROC-005: para marcar como calificado el score debe ser ≥ 50. Califique el lead con BANT.', 'bad'); return false; }
        if (d.status !== 'nuevo' && !l.owner) { UI.toast('PROC-004: asigne un responsable antes de avanzar el lead.', 'bad'); return false; }
        const b4 = l.status; l.status = d.status; if (d.status === 'contactado' && !l.firstContactAt) l.firstContactAt = nowStr();
        Store.save(); Audit.log('Lead', l.id, 'cambio_estado', b4, d.status + (d.note ? ' · ' + d.note : '')); UI.toast('Estado actualizado a ' + statusLabel(d.status) + '.'); App.render();
      } }] });
  }
  function qualifyLead(l) {
    if (!can('crm.leads.manage')) return deny('calificar leads');
    if (!mineOk(l)) return notMine('El lead ' + l.id);
    const b = l.bant || { budget: 0, authority: 0, need: 0, timeline: 0, amount: '', currency: 'PEN', notes: '' };
    const nearest = (x, v) => x.opts.reduce((best, o) => Math.abs(o[0] - v) < Math.abs(best[0] - v) ? o : best, x.opts[0])[0];
    const body = UI.form(BANT.map(x => ({ id: 'bq_' + x.k, label: x.l, type: 'select', options: x.opts.map(o => [o[0], o[1] + ' (' + o[0] + ')']), value: nearest(x, +b[x.k] || 0), col: 6 }))
      .concat([{ id: 'bq_amount', label: 'Presupuesto declarado', type: 'number', min: 0, step: '100', value: b.amount, col: 6 }, { id: 'bq_currency', label: 'Moneda', type: 'select', options: ['PEN', 'USD'], value: b.currency, col: 6 }, { id: 'bq_notes', label: 'Observaciones de la calificación', type: 'textarea', rows: 2, value: b.notes, col: 12 }, { id: 'bq_mark', label: 'Marcar como calificado si el score es ≥ 50', type: 'switch', value: true, col: 12 }])) +
      '<div class="card" style="margin-top:14px"><div class="card-b row between"><span class="small muted">Score resultante</span><div id="bq-score" style="width:200px"></div></div></div>';
    UI.modal({ title: 'Calificar lead (BANT)', sub: l.id + ' · ' + esc(l.name) + ' · PROC-005', body,
      onOpen: (m) => { const upd = () => { const s = BANT.reduce((a, x) => a + (+m.querySelector('#bq_' + x.k).value || 0), 0); m.querySelector('#bq-score').innerHTML = scoreHtml(s); }; BANT.forEach(x => m.querySelector('#bq_' + x.k).onchange = upd); upd(); },
      actions: [{ label: 'Cancelar' }, { label: 'Guardar calificación', cls: 'primary', icon: 'target', onClick: (m) => {
        const d = strip(UI.formData(m), 'bq_');
        const score = BANT.reduce((a, x) => a + (+d[x.k] || 0), 0);
        const prev = l.score; const b4 = l.status;
        l.bant = { budget: +d.budget, authority: +d.authority, need: +d.need, timeline: +d.timeline, amount: +d.amount || 0, currency: d.currency, notes: d.notes, at: nowStr(), by: Auth.user.id };
        l.score = score;
        let msg = 'Calificación registrada: ' + score + '/100.';
        if (d.mark && score >= 50) { if (!l.owner) l.owner = Auth.user.id; l.status = 'calificado'; if (!l.firstContactAt) l.firstContactAt = nowStr(); msg += ' Lead calificado.'; }
        else if (d.mark) { msg += ' No alcanza el umbral de 50 (PROC-005); se mantiene en ' + statusLabel(l.status) + '.'; }
        Store.save(); Audit.log('Lead', l.id, 'calificar', prev + ' / ' + b4, score + ' / ' + l.status);
        UI.toast(msg, d.mark && score < 50 ? 'warn' : 'ok'); App.render();
      } }] });
  }
  function discardLead(l) {
    if (!can('crm.leads.manage')) return deny('descartar leads');
    if (!mineOk(l)) return notMine('El lead ' + l.id);
    UI.modal({ title: 'Descartar lead', size: 'sm', sub: l.id + ' · ' + esc(l.name), body: UI.form([{ id: 'dl_reason', label: 'Motivo', type: 'select', required: true, placeholder: 'Seleccione…', options: DISCARD_REASONS, col: 12 }, { id: 'dl_detail', label: 'Detalle', type: 'textarea', rows: 3, col: 12 }]) + '<p class="xs faint" style="margin-top:10px">El lead no se elimina: queda en el historial con su motivo (Regla transversal 24).</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Descartar', cls: 'danger', onClick: (m) => {
        if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'dl_');
        const b4 = l.status; l.discardedAtStep = leadStep(l)[0]; l.status = 'descartado'; l.discardReason = d.reason + (d.detail ? ': ' + d.detail : ''); l.discardedAt = nowStr();
        DB.activities.filter(a => a.relType === 'lead' && a.relId === l.id && a.status !== 'completada').forEach(a => { a.status = 'completada'; a.result = 'Cerrada automáticamente: lead descartado'; a.completedAt = nowStr(); });
        Store.save(); Audit.log('Lead', l.id, 'descartar', b4, l.discardReason); UI.toast('Lead descartado.'); App.render();
      } }] });
  }

  function convertLead(l) {
    if (!can('crm.leads.manage') || !can('crm.opportunities.manage')) return deny('convertir leads');
    if (!mineOk(l)) return notMine('El lead ' + l.id);
    if (l.status !== 'calificado') { UI.toast('PROC-005: solo los leads calificados pueden convertirse. Estado actual: ' + statusLabel(l.status) + '. Califique el lead (BANT) primero.', 'bad'); return; }
    const match = findDups(l.email, l.phone, l.id).find(x => x.type === 'client');
    const seg = /corporativo/i.test(l.interest) ? 'Corporativo' : /promoción/i.test(l.interest) || l.pax >= 10 ? 'Grupos' : 'Retail';
    const b = l.bant || {};
    const body = (match ? UI.alert('info', 'El contacto ya existe como cliente: ' + clientLink(match.id) + '. Se recomienda vincularlo para no duplicar la ficha.') : '') +
      '<div style="margin-top:12px">' + UI.form([{ type: 'section', label: '1. Cliente' }, { id: 'cv_mode', label: 'Cliente', type: 'select', options: [['new', 'Crear cliente nuevo'], ['existing', 'Vincular a cliente existente']], value: match ? 'existing' : 'new', col: 12 }]) + '</div>' +
      '<div id="cv-new" style="margin-top:12px">' + UI.form([
        { id: 'cn_kind', label: 'Tipo', type: 'select', options: ['Persona', 'Empresa'], value: l.company ? 'Empresa' : 'Persona', col: 4 },
        { id: 'cn_name', label: 'Nombre / razón social', required: true, value: l.company || l.name, col: 8 },
        { id: 'cn_docType', label: 'Documento', type: 'select', options: ['DNI', 'RUC', 'Pasaporte', 'CE'], value: l.company ? 'RUC' : 'DNI', col: 4 },
        { id: 'cn_docNum', label: 'Número', required: true, col: 4 },
        { id: 'cn_segment', label: 'Segmento', type: 'select', options: SEGMENTS, value: seg, col: 4 },
        { id: 'cn_city', label: 'Ciudad', value: 'Lima', col: 6 }, { id: 'cn_country', label: 'País', value: /^\+(?!51)/.test(l.phone || '') ? '' : 'Perú', col: 6 }
      ]) + '</div>' +
      '<div id="cv-ex" class="hide" style="margin-top:12px">' + UI.form([{ id: 'ce_client', label: 'Cliente existente', type: 'select', required: true, placeholder: 'Seleccione…', options: DB.clients.filter(c => canSeeClient(c.id) || (match && c.id === match.id)).map(c => [c.id, c.name + ' · ' + c.doc]), value: match ? match.id : '', col: 12 }]) + '</div>' +
      '<div id="cv-opp" style="margin-top:12px">' + UI.form([{ type: 'section', label: '2. Oportunidad' },
        { id: 'co_title', label: 'Título', required: true, value: (l.company || l.name) + ' — ' + (l.destination || l.interest), col: 12 },
        { id: 'co_stage', label: 'Etapa inicial', type: 'select', options: [['calificacion', 'Calificación'], ['descubrimiento', 'Descubrimiento']], value: 'descubrimiento', col: 4 },
        { id: 'co_amount', label: 'Monto estimado', type: 'number', required: true, min: 0, value: b.amount || '', col: 4 },
        { id: 'co_currency', label: 'Moneda', type: 'select', options: ['PEN', 'USD'], value: b.currency || 'PEN', col: 4 },
        { id: 'co_close', label: 'Cierre estimado', type: 'date', required: true, value: addDays(TD(), 21), col: 4 },
        { id: 'co_owner', label: 'Responsable', type: 'select', required: true, options: ownerOpts(), value: own() ? me() : (l.owner || Auth.user.id), col: 8 },
        { id: 'co_next', label: 'Programar reunión de descubrimiento (mañana 10:00)', type: 'switch', value: true, col: 12 }
      ]) + '</div>';
    UI.modal({ title: 'Convertir lead', size: 'lg', sub: l.id + ' · Lead → Cliente + Oportunidad (PROC-005). Se conserva el historial.', body,
      onOpen: (m) => { const sel = m.querySelector('#cv_mode'); const sw = () => { m.querySelector('#cv-new').classList.toggle('hide', sel.value !== 'new'); m.querySelector('#cv-ex').classList.toggle('hide', sel.value === 'new'); }; sel.onchange = sw; sw(); },
      actions: [{ label: 'Cancelar' }, { label: 'Convertir', cls: 'primary', icon: 'arrowRight', onClick: (m) => {
        const mode = m.querySelector('#cv_mode').value;
        if (!UI.validate(m.querySelector(mode === 'new' ? '#cv-new' : '#cv-ex')) || !UI.validate(m.querySelector('#cv-opp'))) return false;
        let client;
        if (mode === 'new') {
          const c = strip(UI.formData(m.querySelector('#cv-new')), 'cn_');
          const docErr = checkDoc(c.kind, c.docType, c.docNum, c.country); if (docErr) { UI.toast(docErr, 'bad'); return false; }
          const doc = c.docType + ' ' + String(c.docNum).trim();
          const ex = DB.clients.find(x => x.doc.replace(/\s/g, '') === doc.replace(/\s/g, '')); if (ex) { UI.toast('Ya existe un cliente con ' + esc(doc) + ': ' + esc(ex.name) + '. Vincúlelo en lugar de crear uno nuevo.', 'bad'); return false; }
          client = { id: nextId(DB.clients, 'CLI-', 4), kind: c.kind, name: c.name, doc, email: l.email, phone: l.phone, country: c.country, city: c.city, segment: c.segment, owner: l.owner || Auth.user.id, createdAt: TD(), tags: [l.source], nps: null, contactName: c.kind === 'Empresa' ? l.name : '', contacts: c.kind === 'Empresa' ? [{ name: l.name, role: 'Contacto principal', email: l.email, phone: l.phone, primary: true }] : [], sourceLeadId: l.id };
          DB.clients.unshift(client); Audit.log('Cliente', client.id, 'crear', 'desde ' + l.id, client.name);
        } else {
          client = Q.client(m.querySelector('#ce_client').value);
          if (!client.contacts) client.contacts = [];
          if (normE(client.email) !== normE(l.email) && !client.contacts.some(x => normE(x.email) === normE(l.email))) client.contacts.push({ name: l.name, role: 'Contacto (desde ' + l.id + ')', email: l.email, phone: l.phone, primary: false });
        }
        const o = strip(UI.formData(m.querySelector('#cv-opp')), 'co_');
        const st = DB.stages.find(s => s.id === o.stage);
        const opp = { id: nextId(DB.opportunities, 'OPP-', 4), clientId: client.id, title: o.title, stage: o.stage, amount: +o.amount || 0, currency: o.currency, probability: st.prob, closeDate: o.close, owner: o.owner, destination: l.destination, pax: l.pax, leadId: l.id, createdAt: TD(), lostReason: '', productId: l.productId || '' };
        DB.opportunities.unshift(opp);
        const b4 = l.status; l.status = 'convertido'; l.convertedClientId = client.id; l.convertedOppId = opp.id; l.convertedAt = nowStr(); l.convertedBy = Auth.user.id;
        if (o.next) DB.activities.unshift({ id: nextId(DB.activities, 'ACT-', 4), type: 'Reunión', subject: 'Descubrimiento de necesidades — ' + client.name, relType: 'opportunity', relId: opp.id, owner: o.owner, due: addDays(TD(), 1) + ' 10:00', status: 'pendiente', result: '', createdAt: nowStr(), createdBy: Auth.user.id });
        Store.save();
        Audit.log('Lead', l.id, 'convertir', b4, client.id + ' + ' + opp.id);
        Audit.log('Oportunidad', opp.id, 'crear', 'desde ' + l.id, statusLabel(opp.stage) + ' · ' + money(opp.amount, opp.currency));
        Notify.push('lead.convertido', 'Portal', o.owner, 'Lead ' + l.id + ' convertido en ' + opp.id);
        UI.toast('Lead convertido: cliente ' + client.id + ' y oportunidad ' + opp.id + '.');
        App.go('#/crm/oportunidades/' + opp.id);
      } }] });
  }
  function checkDoc(kind, type, num, country) {
    const n = String(num || '').replace(/\s/g, '');
    if (type === 'DNI' && !/^\d{8}$/.test(n)) return 'El DNI debe tener 8 dígitos.';
    if (type === 'RUC' && !/^(10|15|17|20)\d{9}$/.test(n)) return 'Regla transversal 10: el RUC debe tener 11 dígitos y empezar por 10, 15, 17 o 20.';
    if (kind === 'Empresa' && (country || 'Perú') === 'Perú' && type !== 'RUC') return 'Regla transversal 10: una empresa peruana requiere RUC para facturación.';
    if (!n) return 'Ingrese el número de documento.';
    return '';
  }

  /* ======================================================================
     OPORTUNIDADES (PROC-006)
     ====================================================================== */
  App.register('crm/oportunidades', (el, params) => {
    if (!crmAllowed()) return noAccess(el, 'Oportunidades');
    ensure();
    if (params[0] === 'nueva') { oppList(el); oppForm(null, {}); return; }
    if (params[0]) { const o = Q.opportunity(params[0]); if (o && !mineOk(o)) return Scope.denied(el, 'La oportunidad ' + o.id + ' (' + o.title + ')'); return oppDetail(el, params[0]); }
    oppList(el);
  });

  function oppList(el) {
    const O = V.opps();
    const open = O.filter(isOpen);
    const pipe = sum(open, o => toPEN(o.amount, o.currency));
    const weighted = sum(open, o => toPEN(o.amount, o.currency) * o.probability / 100);
    const month = TD().slice(0, 7);
    const won = O.filter(o => o.stage === 'ganada'); const lost = O.filter(o => o.stage === 'perdida');
    const wonM = won.filter(o => String(o.closedAt || o.closeDate).startsWith(month));
    const winRate = won.length + lost.length ? won.length / (won.length + lost.length) * 100 : 0;

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: 'Oportunidades', subtitle: 'Pipeline comercial (PROC-006): Crear → Asignar → Calificar → Descubrir necesidad → Cotización → Negociación → Ganada / Perdida. Un cierre perdido exige motivo.', crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Oportunidades']],
        actions: scopeCtl() + '<div class="btn-group" role="group" aria-label="Vista"><button class="btn' + (S.oppView === 'kanban' ? ' on' : '') + '" data-view="kanban">' + UI.icon('kanban') + 'Kanban</button><button class="btn' + (S.oppView === 'tabla' ? ' on' : '') + '" data-view="tabla">' + UI.icon('list') + 'Tabla</button></div>' + (can('crm.opportunities.manage') ? '<button class="btn primary" id="btn-new-opp">' + UI.icon('plus') + 'Nueva oportunidad</button>' : '') }) +
      readonlyNote('crm.opportunities.manage', 'crear ni mover oportunidades') + advNote() +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Pipeline abierto', value: penK(pipe), sub: open.length + ' oportunidades', tone: 'accent', icon: 'target' }) +
        UI.kpi({ label: 'Pipeline ponderado', value: penK(weighted), sub: 'monto × probabilidad', tone: 'violet', icon: 'percent' }) +
        UI.kpi({ label: 'Ganadas en el mes', value: wonM.length, sub: penK(sum(wonM, o => toPEN(o.amount, o.currency))) + ' cerrados', tone: 'ok', icon: 'award' }) +
        UI.kpi({ label: 'Tasa de cierre', value: fmtN(winRate, 0) + '%', sub: won.length + ' ganadas / ' + lost.length + ' perdidas', tone: 'sun', icon: 'trending' }) +
      '</div><div id="opp-body" style="min-width:0;contain:inline-size"></div></div>';

    el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.oppView = b.dataset.view; remember('crm_oppView', S.oppView); App.render(); });
    const nb = el.querySelector('#btn-new-opp'); if (nb) nb.onclick = () => oppForm(null, {});
    bindScope(el);
    const body = el.querySelector('#opp-body');
    if (S.oppView === 'tabla') return oppTable(body);
    kanban(body);
  }

  function kanban(host) {
    const rows = () => V.opps().filter(o => (!S.oppQ || (o.title + ' ' + o.id + ' ' + Q.clientName(o.clientId)).toLowerCase().includes(S.oppQ.toLowerCase())));
    host.innerHTML = '<div class="card"><div class="crm-filters"><div class="search-in grow" style="max-width:300px">' + UI.icon('search') + '<input class="input sm" type="search" id="kb-q" placeholder="Buscar oportunidad o cliente…" value="' + esc(S.oppQ) + '" aria-label="Buscar"></div><span class="xs faint">' + (own() ? 'Mi cartera: ' + V.opps().length + ' oportunidad(es)' : adv() ? 'Asesor: ' + esc(Q.userName(adv())) : 'Todo el equipo') + '</span><div class="grow"></div><span class="xs faint">Arrastre las tarjetas entre etapas. En móvil use el botón ⋯ de cada tarjeta.</span></div></div>' +
      '<div class="alert info crm-mob">' + UI.icon('info') + '<div class="alert-body small">Deslice horizontalmente para recorrer las ' + DB.stages.length + ' etapas. Toque ⋯ en una tarjeta para moverla.</div></div>' +
      '<div class="kanban crm-kb" id="kb"></div>';
    const kb = host.querySelector('#kb');
    const draw = () => {
      const list = rows();
      kb.innerHTML = DB.stages.map(s => {
        const items = list.filter(o => o.stage === s.id).sort((a, b) => a.closeDate.localeCompare(b.closeDate));
        const tot = sum(items, o => toPEN(o.amount, o.currency));
        return '<div class="kcol' + (s.id === 'ganada' ? ' won' : s.id === 'perdida' ? ' lost' : '') + '" data-stage="' + s.id + '"><div class="kcol-h"><span>' + esc(s.name) + '<span class="cnt">' + items.length + '</span></span><span class="amt">' + penK(tot) + (isOpen({ stage: s.id }) ? ' · ' + s.prob + '%' : '') + '</span></div>' +
          (items.length ? items.map(kcard).join('') : '<div class="kdrop">Suelte aquí</div>') + '</div>';
      }).join('');
      bindKanban();
    };
    function kcard(o) {
      const d = daysFromToday(o.closeDate);
      const late = isOpen(o) && d < 0;
      const nq = DB.quotes.filter(q => q.oppId === o.id).length;
      return '<div class="kcard" draggable="' + (can('crm.opportunities.manage') ? 'true' : 'false') + '" data-id="' + o.id + '" tabindex="0" role="button" aria-label="' + esc(o.title) + '">' +
        '<div class="row between" style="gap:6px"><span class="mono xs faint">' + o.id + '</span>' + (can('crm.opportunities.manage') ? '<button class="btn xs ghost icon" data-move="' + o.id + '" title="Mover a etapa" aria-label="Mover a etapa">' + UI.icon('more') + '</button>' : '') + '</div>' +
        '<div class="kt">' + esc(o.title) + '</div>' +
        '<div class="xs muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(Q.clientName(o.clientId)) + '</div>' +
        '<div class="kmeta"><b class="small num">' + money(o.amount, o.currency, 0) + '</b><span class="xs faint">' + o.probability + '%</span></div>' +
        '<div class="kmeta"><span class="xs ' + (late ? 'bad' : 'faint') + '">' + (o.stage === 'perdida' ? esc((o.lostReason || '').split(':')[0]) : (isOpen(o) ? 'Cierre ' : '') + dateShort(o.closedAt || o.closeDate)) + '</span><span class="row" style="gap:5px">' + (nq ? '<span class="tag" title="Cotizaciones">' + nq + ' cot.</span>' : '') + UI.avatar(o.owner) + '</span></div></div>';
    }
    function bindKanban() {
      let dragId = null;
      kb.querySelectorAll('.kcard').forEach(c => {
        c.addEventListener('dragstart', (e) => { dragId = c.dataset.id; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) { } });
        c.addEventListener('dragend', () => { c.classList.remove('dragging'); kb.querySelectorAll('.kcol.over').forEach(k => k.classList.remove('over')); });
        c.addEventListener('click', (e) => { if (e.target.closest('[data-move]')) return; App.go('#/crm/oportunidades/' + c.dataset.id); });
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter') App.go('#/crm/oportunidades/' + c.dataset.id); });
      });
      kb.querySelectorAll('.kcol').forEach(col => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
        col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); let id = dragId; try { id = e.dataTransfer.getData('text/plain') || dragId; } catch (x) { } const o = Q.opportunity(id); if (o) moveOpp(o, col.dataset.stage); });
      });
      kb.querySelectorAll('[data-move]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const o = Q.opportunity(b.dataset.move); UI.menu(b, DB.stages.filter(s => s.id !== o.stage).map(s => ({ label: 'Mover a ' + s.name, icon: s.id === 'ganada' ? 'award' : s.id === 'perdida' ? 'x' : 'arrowRight', onClick: () => moveOpp(o, s.id) })).concat(['-', { label: 'Abrir detalle', icon: 'eye', onClick: () => App.go('#/crm/oportunidades/' + o.id) }])); });
    }
    host.querySelector('#kb-q').addEventListener('input', Util.debounce(e => { S.oppQ = e.target.value; draw(); }, 150));
    draw();
  }

  function oppTable(host) {
    UI.dataTable(host, {
      rows: () => V.opps(), exportName: 'oportunidades', defaultSort: 'closeDate', pageSize: 12,
      search: (r) => [r.id, r.title, Q.clientName(r.clientId), r.destination].join(' '),
      filters: [
        { key: 'stage', label: 'Etapa', options: DB.stages.map(s => [s.id, s.name]) },
        { key: 'open', label: 'Situación', options: [['open', 'Abiertas'], ['closed', 'Cerradas']], match: (r, v) => v === 'open' ? isOpen(r) : !isOpen(r) }
      ],
      columns: [
        { key: 'title', label: 'Oportunidad', render: r => '<div class="cell-main">' + esc(r.title) + '</div><div class="cell-sub mono">' + r.id + (r.leadId ? ' · desde ' + r.leadId : '') + '</div>' },
        { key: 'clientId', label: 'Cliente', render: r => clientLink(r.clientId), sortVal: r => Q.clientName(r.clientId), csv: r => Q.clientName(r.clientId) },
        { key: 'stage', label: 'Etapa', render: r => UI.badge(r.stage), sortVal: r => DB.stages.findIndex(s => s.id === r.stage), csv: r => statusLabel(r.stage) },
        { key: 'amount', label: 'Monto', align: 'num', render: r => money(r.amount, r.currency, 0), sortVal: r => toPEN(r.amount, r.currency) },
        { key: 'probability', label: 'Prob.', align: 'num', render: r => r.probability + '%' },
        { key: 'weighted', label: 'Ponderado S/', align: 'num', render: r => fmtN(toPEN(r.amount, r.currency) * r.probability / 100, 0), sortVal: r => toPEN(r.amount, r.currency) * r.probability, csv: r => (toPEN(r.amount, r.currency) * r.probability / 100).toFixed(2) },
        { key: 'closeDate', label: 'Cierre', render: r => '<span class="nowrap ' + (isOpen(r) && daysFromToday(r.closeDate) < 0 ? 'bad' : '') + '">' + date(r.closeDate) + '</span>' },
        { key: 'owner', label: 'Responsable', render: r => ownerShort(r.owner), csv: r => Q.userName(r.owner) }
      ],
      footer: (rows) => '<tr><td colspan="3">Total (' + rows.length + ')</td><td class="num">S/ ' + fmtN(sum(rows, r => toPEN(r.amount, r.currency)), 0) + '</td><td></td><td class="num">' + fmtN(sum(rows, r => toPEN(r.amount, r.currency) * r.probability / 100), 0) + '</td><td colspan="2"></td></tr>',
      onRow: r => App.go('#/crm/oportunidades/' + r.id)
    });
  }

  function lostModal(o, apply) {
    UI.modal({ title: 'Marcar como perdida', size: 'sm', sub: o.id + ' · ' + esc(o.title), body: UI.alert('warn', 'PROC-006: el cierre como perdida exige registrar el motivo.') + '<div style="margin-top:12px">' + UI.form([{ id: 'lo_reason', label: 'Motivo de pérdida', type: 'select', required: true, placeholder: 'Seleccione…', options: LOST_REASONS, col: 12 }, { id: 'lo_detail', label: 'Detalle', type: 'textarea', rows: 3, col: 12, placeholder: 'Ej.: eligió paquete de aerolínea con vuelo incluido' }]) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Marcar perdida', cls: 'danger', onClick: (m) => { if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'lo_'); if (d.reason === 'Otro' && !d.detail) { UI.toast('Detalle el motivo cuando selecciona “Otro”.', 'bad'); return false; } apply(d.reason + (d.detail ? ': ' + d.detail : '')); } }] });
  }
  function moveOpp(o, to) {
    if (!can('crm.opportunities.manage')) return deny('mover oportunidades');
    if (!mineOk(o)) return notMine('La oportunidad ' + o.id);
    if (!o || o.stage === to) return;
    const from = o.stage; const st = DB.stages.find(s => s.id === to);
    const apply = (reason) => {
      if (to === 'perdida') { o.lostReason = reason; o.lostAtStage = from; o.probability = 0; o.closedAt = TD(); }
      else if (to === 'ganada') { o.probability = 100; o.closedAt = TD(); o.lostReason = ''; }
      else { o.probability = st.prob; o.closedAt = null; if (from === 'perdida') o.lostReason = ''; }
      o.stage = to; Store.save();
      Audit.log('Oportunidad', o.id, 'cambio_etapa', statusLabel(from), statusLabel(to) + (reason ? ' · ' + reason : ''));
      if (to === 'ganada' || to === 'perdida') Notify.push('oportunidad.' + to, 'Portal', o.owner, o.id + ' marcada como ' + statusLabel(to) + ': ' + o.title);
      UI.toast(o.id + ' movida a ' + esc(st.name) + '.'); App.render();
    };
    if (to === 'perdida') return lostModal(o, apply);
    if (to === 'ganada') { const okQ = DB.quotes.some(q => q.oppId === o.id && ['aprobada', 'convertida'].includes(q.status)); return UI.confirm({ title: 'Marcar como ganada', message: 'Se cerrará <b>' + esc(o.title) + '</b> como ganada por ' + money(o.amount, o.currency) + '.' + (okQ ? '' : '<br><br><span class="warn small">Advertencia: la oportunidad no tiene una cotización aprobada. Verifique antes de confirmar; la reserva se genera desde la cotización aprobada (Regla transversal 3).</span>'), confirmLabel: 'Marcar ganada', onConfirm: () => apply('') }); }
    if (!isOpen(o)) return UI.confirm({ title: 'Reabrir oportunidad', message: 'La oportunidad está cerrada como <b>' + statusLabel(from) + '</b>. ¿Reabrirla en la etapa ' + esc(st.name) + '? Quedará registrado en auditoría.', confirmLabel: 'Reabrir', onConfirm: () => apply('') });
    apply('');
  }

  function oppForm(o, preset = {}) {
    if (!can('crm.opportunities.manage')) return deny('crear o editar oportunidades');
    const isNew = !o;
    if (o && !mineOk(o)) return notMine('La oportunidad ' + o.id);
    const v = o || Object.assign({ stage: 'calificacion', currency: 'PEN', owner: Auth.user.id, closeDate: addDays(TD(), 30), pax: 2 }, preset);
    if (isNew && !v.owner && v.clientId) v.owner = (Q.client(v.clientId) || {}).owner;
    if (own()) v.owner = isNew ? me() : o.owner;
    const fields = [
      { id: 'of_clientId', label: 'Cliente', type: 'select', required: true, placeholder: 'Seleccione…', options: DB.clients.filter(c => canSeeClient(c.id) || c.id === v.clientId).map(c => [c.id, c.name + ' · ' + c.segment]), value: v.clientId, col: 6, hint: own() ? 'Clientes de su cartera' : '' },
      { id: 'of_owner', label: 'Responsable', type: 'select', required: true, options: own() ? [[v.owner, Q.userName(v.owner) + (v.owner === me() ? ' (yo)' : '')]] : sellerOpts(), value: v.owner, col: 6, hint: own() ? 'La reasignación la realiza Gerencia' : '' },
      { id: 'of_title', label: 'Título', required: true, value: v.title, col: 12, placeholder: 'Ej.: Viaje de incentivo Q1 — Cusco 4D/3N' },
      { id: 'of_destination', label: 'Destino', value: v.destination, col: 4 },
      { id: 'of_pax', label: 'Pasajeros', type: 'number', min: 1, value: v.pax, col: 4 },
      isNew ? { id: 'of_stage', label: 'Etapa inicial', type: 'select', options: OPEN_STAGES.map(s => [s, statusLabel(s)]), value: v.stage, col: 4 } : { id: 'of_probability', label: 'Probabilidad %', type: 'number', min: 0, max: 100, value: v.probability, col: 4 },
      { id: 'of_amount', label: 'Monto estimado', type: 'number', required: true, min: 0, step: '100', value: v.amount, col: 4 },
      { id: 'of_currency', label: 'Moneda', type: 'select', options: ['PEN', 'USD'], value: v.currency, col: 4 },
      { id: 'of_closeDate', label: 'Fecha estimada de cierre', type: 'date', required: true, value: v.closeDate, col: 4 },
      { id: 'of_notes', label: 'Necesidad / notas', type: 'textarea', rows: 2, value: v.notes, col: 12 }
    ];
    UI.modal({ title: isNew ? 'Nueva oportunidad' : 'Editar oportunidad ' + o.id, size: 'lg', sub: preset.origin ? 'Origen: ' + esc(preset.origin) : 'PROC-006', body: UI.form(fields),
      actions: [{ label: 'Cancelar' }, { label: isNew ? 'Crear oportunidad' : 'Guardar', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const d = strip(UI.formData(m), 'of_');
        if (own()) d.owner = v.owner;
        if (+d.amount <= 0) { UI.toast('El monto estimado debe ser mayor a cero.', 'bad'); return false; }
        if (isNew && d.closeDate < TD()) { UI.toast('La fecha de cierre no puede ser anterior a hoy.', 'bad'); return false; }
        if (isNew) {
          const st = DB.stages.find(s => s.id === d.stage);
          const n = { id: nextId(DB.opportunities, 'OPP-', 4), clientId: d.clientId, title: d.title, stage: d.stage, amount: +d.amount, currency: d.currency, probability: st.prob, closeDate: d.closeDate, owner: d.owner, destination: d.destination, pax: +d.pax || 0, leadId: preset.leadId || null, createdAt: TD(), lostReason: '', notes: d.notes, origin: preset.origin || '' };
          DB.opportunities.unshift(n); Store.save();
          Audit.log('Oportunidad', n.id, 'crear', preset.origin || '', statusLabel(n.stage) + ' · ' + money(n.amount, n.currency));
          if (n.owner !== Auth.user.id) Notify.push('oportunidad.asignada', 'Portal', n.owner, 'Oportunidad asignada: ' + n.title);
          if (preset.onSaved) { preset.onSaved(n); return; }
          UI.toast('Oportunidad ' + n.id + ' creada.'); App.go('#/crm/oportunidades/' + n.id);
        } else {
          const changed = ['clientId', 'owner', 'title', 'destination', 'amount', 'currency', 'closeDate', 'probability', 'pax'].filter(k => String(o[k]) !== String(d[k]));
          const before = money(o.amount, o.currency) + ' · ' + o.probability + '%';
          Object.assign(o, { clientId: d.clientId, owner: d.owner, title: d.title, destination: d.destination, pax: +d.pax || 0, amount: +d.amount, currency: d.currency, closeDate: d.closeDate, notes: d.notes, probability: Math.max(0, Math.min(100, +d.probability || 0)) });
          Store.save(); Audit.log('Oportunidad', o.id, 'editar', before, (changed.join(', ') || 'sin cambios') + ' → ' + money(o.amount, o.currency) + ' · ' + o.probability + '%');
          UI.toast('Oportunidad actualizada.'); App.render();
        }
      } }] });
  }

  function oppDetail(el, id) {
    const o = Q.opportunity(id);
    if (!o) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Oportunidad no encontrada', crumbs: [['CRM'], ['Oportunidades', '#/crm/oportunidades']] }) + UI.card('', UI.empty('No existe la oportunidad ' + id, 'target')) + '</div>'; return; }
    const c = Q.client(o.clientId);
    const manage = can('crm.opportunities.manage');
    const quotes = V.quotes().filter(q => q.oppId === o.id);
    const lead = o.leadId ? Q.lead(o.leadId) : null;
    const acts = DB.activities.filter(a => (a.relType === 'opportunity' && a.relId === o.id) || (lead && a.relType === 'lead' && a.relId === lead.id) || (a.relType === 'quote' && quotes.some(q => q.id === a.relId))).sort((a, b) => b.due.localeCompare(a.due));
    const steps = ['Calificación', 'Descubrimiento', 'Cotización', 'Negociación', 'Ganada'];
    const idx = DB.stages.findIndex(s => s.id === o.stage);
    let flow;
    if (o.stage === 'perdida') { const f = Math.max(0, OPEN_STAGES.indexOf(o.lostAtStage || 'negociacion')); flow = UI.flow(steps.slice(0, 4).concat(['Perdida']), f, f); }
    else flow = UI.flow(steps, o.stage === 'ganada' ? 5 : idx);
    const d = daysFromToday(o.closeDate);
    const pen = toPEN(o.amount, o.currency);
    const hist = auditFor([o.id, o.leadId].concat(quotes.map(q => q.id)));

    const qRows = quotes.map(q => { const v = q.versions.find(x => x.v === q.currentVersion) || q.versions[q.versions.length - 1]; const t = Pricing.quoteTotals(v); return '<tr class="click" data-href="#/cotizaciones/' + q.id + '"><td><a class="mono" href="#/cotizaciones/' + q.id + '">' + q.id + '</a><div class="cell-sub">' + esc(q.title) + '</div></td><td class="num">v' + q.currentVersion + '</td><td class="num nowrap">' + money(t.total, q.currency, 0) + '</td><td class="nowrap">' + date(q.validUntil) + '</td><td>' + UI.badge(q.status) + '</td></tr>'; }).join('');

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: esc(o.title) + ' ' + UI.badge(o.stage), subtitle: '<span class="mono">' + o.id + '</span> · ' + clientLink(o.clientId) + ' · creada ' + date(o.createdAt) + (o.origin ? ' · origen: ' + esc(o.origin) : ''), crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Oportunidades', '#/crm/oportunidades'], [o.id]],
        actions: (own() ? scopeCtl() : '') + '<a class="btn" href="#/crm/oportunidades">' + UI.icon('chevronLeft') + 'Pipeline</a>' + (canReassign() ? '<button class="btn" id="op-reassign">' + UI.icon('user') + 'Reasignar</button>' : '') + (manage ? '<button class="btn" id="op-edit">' + UI.icon('edit') + 'Editar</button>' : '') + (isOpen(o) && can('quotes.create') ? '<button class="btn primary" id="op-quote">' + UI.icon('file') + 'Crear cotización</button>' : '') }) +
      (o.stage === 'perdida' ? UI.alert('bad', '<b>Oportunidad perdida</b> el ' + date(o.closedAt || o.closeDate) + '. Motivo: ' + esc(o.lostReason || 'no registrado')) : '') +
      (o.stage === 'ganada' ? UI.alert('ok', '<b>Oportunidad ganada</b> el ' + date(o.closedAt || o.closeDate) + ' por ' + money(o.amount, o.currency) + '.' + (quotes.some(q => q.status === 'convertida') ? ' La cotización aprobada ya fue convertida en reserva.' : '')) : '') +
      (isOpen(o) && d < 0 ? UI.alert('warn', 'La fecha estimada de cierre (' + date(o.closeDate) + ') ya pasó. Actualice la fecha o registre el resultado.') : '') +
      readonlyNote('crm.opportunities.manage', 'modificar oportunidades') +
      UI.card('Etapas de la oportunidad', flow + (manage ? '<div class="row" style="margin-top:14px;gap:8px"><span class="small muted">Mover a:</span>' + DB.stages.filter(s => s.id !== o.stage).map(s => '<button class="btn sm' + (s.id === 'ganada' ? '' : s.id === 'perdida' ? ' ghost' : '') + '" data-stage="' + s.id + '">' + (s.id === 'ganada' ? UI.icon('award') : s.id === 'perdida' ? UI.icon('x') : '') + esc(s.name) + '</button>').join('') + '</div>' : ''), { sub: 'PROC-006 · Crear → Calificar → Descubrir → Cotizar → Negociar → Ganada / Perdida' }) +
      '<div class="grid g-2-1"><div class="stack">' +
        UI.card('Datos de la oportunidad', '<div class="crm-kv">' + UI.dl([['Cliente', clientLink(o.clientId)], ['Segmento', c ? esc(c.segment) : ''], ['Destino', esc(o.destination)], ['Pasajeros', String(o.pax || '')], ['Responsable', UI.userChip(o.owner)]]) + UI.dl([['Monto', '<b>' + money(o.amount, o.currency) + '</b>' + (o.currency === 'USD' ? ' <span class="faint xs">≈ S/ ' + fmtN(pen, 0) + '</span>' : '')], ['Probabilidad', o.probability + '%'], ['Ponderado', 'S/ ' + fmtN(pen * o.probability / 100, 0)], ['Cierre estimado', date(o.closeDate) + (isOpen(o) ? ' <span class="xs ' + (d < 0 ? 'bad' : 'faint') + '">(' + (d < 0 ? 'hace ' + (-d) : 'en ' + d) + ' d)</span>' : '')], ['Lead de origen', lead ? leadLink(lead.id) + ' <span class="mono xs faint">' + lead.id + '</span>' : '']]) + '</div>' + (o.notes ? '<div class="divider" style="margin:14px 0 10px"></div><p class="small">' + esc(o.notes) + '</p>' : '')) +
        UI.card('Cotizaciones vinculadas', quotes.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Cotización</th><th class="num">Versión</th><th class="num">Total</th><th>Validez</th><th>Estado</th></tr></thead><tbody>' + qRows + '</tbody></table></div>' : UI.empty('Aún no hay cotizaciones para esta oportunidad.', 'file'), { tight: true, sub: quotes.length + ' cotización(es)', actions: isOpen(o) && can('quotes.create') ? '<button class="btn sm" id="op-quote2">' + UI.icon('plus') + 'Crear cotización</button>' : '' }) +
        UI.card('Actividades', actsBlock(acts), { tight: true, sub: 'Incluye las del lead de origen y de sus cotizaciones', actions: can('crm.activities.manage') ? '<button class="btn sm" id="op-act">' + UI.icon('plus') + 'Actividad</button>' : '' }) +
        UI.card('Historial', auditTimeline(hist, 25), { sub: 'Auditoría de la oportunidad, su lead y cotizaciones' }) +
      '</div><div class="stack">' +
        UI.card('Resumen', '<div class="stat-line"><span class="muted">Monto</span><b>' + money(o.amount, o.currency) + '</b></div><div class="stat-line"><span class="muted">Probabilidad</span><b>' + o.probability + '%</b></div>' + UI.progress(o.probability, o.stage === 'perdida' ? 'bad' : o.stage === 'ganada' ? 'ok' : '') + '<div class="stat-line" style="margin-top:6px"><span class="muted">Valor ponderado</span><b>S/ ' + fmtN(pen * o.probability / 100, 0) + '</b></div><div class="stat-line"><span class="muted">Actividades pendientes</span><b>' + acts.filter(a => a.status !== 'completada').length + '</b></div>' +
          (manage && isOpen(o) ? '<div class="crm-actions" style="margin-top:14px"><button class="btn" id="op-won">' + UI.icon('award') + 'Marcar como ganada</button><button class="btn" id="op-lost">' + UI.icon('x') + 'Marcar como perdida</button></div>' : '') +
          (manage && !isOpen(o) ? '<div class="crm-actions" style="margin-top:14px"><button class="btn" id="op-reopen">' + UI.icon('refresh') + 'Reabrir oportunidad</button></div>' : '')) +
        UI.card('Cliente', c ? '<div class="crm-head" style="margin-bottom:12px">' + UI.avatar({ name: c.name, color: '#46606B' }) + '<div class="grow"><b class="small">' + clientLink(c.id) + '</b><div class="xs faint">' + esc(c.kind) + ' · ' + esc(c.segment) + '</div></div></div>' + UI.dl([['Documento', esc(c.doc)], ['Correo', esc(c.email)], ['Teléfono', esc(c.phone)], ['Contacto', esc(c.contactName || '')]]) + '<a class="btn sm" style="margin-top:12px" href="#/crm/clientes/' + c.id + '">' + UI.icon('users') + 'Ver Customer 360</a>' : UI.empty('Sin cliente', 'user')) +
      '</div></div></div>';

    const on = (s, fn) => { const x = el.querySelector(s); if (x) x.onclick = fn; };
    const goQuote = () => { if (!isOpen(o)) return UI.toast('PROC-006: no se puede cotizar una oportunidad cerrada.', 'bad'); if (!can('quotes.create')) return deny('crear cotizaciones'); App.go('#/cotizaciones/nueva/' + o.id); };
    on('#op-quote', goQuote); on('#op-quote2', goQuote);
    on('#op-edit', () => oppForm(o));
    on('#op-reassign', () => reassignModal('Oportunidad', o));
    on('#op-act', () => activityModal({ relType: 'opportunity', relId: o.id, owner: o.owner, subject: 'Seguimiento — ' + o.title }));
    on('#op-won', () => moveOpp(o, 'ganada')); on('#op-lost', () => moveOpp(o, 'perdida'));
    on('#op-reopen', () => moveOpp(o, o.lostAtStage && OPEN_STAGES.includes(o.lostAtStage) ? o.lostAtStage : 'negociacion'));
    el.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => moveOpp(o, b.dataset.stage));
    el.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = (e) => { if (!e.target.closest('a')) App.go(tr.dataset.href); });
    bindActs(el);
  }

  /* ======================================================================
     AGENDA DE ACTIVIDADES (PROC-007)
     ====================================================================== */
  App.register('crm/actividades', (el) => {
    if (!crmAllowed()) return noAccess(el, 'Actividades');
    ensure();
    if (!S.weekStart) { const d = parseD(TD()); S.weekStart = addDays(TD(), -((d.getDay() + 6) % 7)); }
    const filt = () => V.acts().filter(a => (!S.actType || a.type === S.actType));
    const all = V.acts();
    const venc = all.filter(a => actStatus(a) === 'vencida'), hoy = all.filter(a => actStatus(a) === 'pendiente' && a.due.slice(0, 10) === TD());
    const prox = all.filter(a => actStatus(a) === 'pendiente' && a.due.slice(0, 10) > TD() && daysFromToday(a.due.slice(0, 10)) <= 7);
    const done7 = all.filter(a => a.status === 'completada' && daysFromToday(String(a.completedAt || a.due).slice(0, 10)) >= -7);

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: 'Actividades', subtitle: 'Agenda comercial (PROC-007): Crear → Asignar → Programar → Ejecutar → Registrar resultado → Próxima actividad → Completar.', crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Actividades']],
        actions: scopeCtl() + '<div class="btn-group" role="group" aria-label="Vista"><button class="btn' + (S.actView === 'lista' ? ' on' : '') + '" data-view="lista">' + UI.icon('list') + 'Lista</button><button class="btn' + (S.actView === 'semana' ? ' on' : '') + '" data-view="semana">' + UI.icon('calendar') + 'Semana</button></div>' + (can('crm.activities.manage') ? '<button class="btn primary" id="btn-new-act">' + UI.icon('plus') + 'Nueva actividad</button>' : '') }) +
      readonlyNote('crm.activities.manage', 'crear ni completar actividades') + advNote() +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Vencidas', value: venc.length, sub: 'requieren atención', tone: venc.length ? 'bad' : 'ok', icon: 'alert' }) +
        UI.kpi({ label: 'Para hoy', value: hoy.length, sub: date(TD()), tone: 'sun', icon: 'clock' }) +
        UI.kpi({ label: 'Próximos 7 días', value: prox.length, sub: 'programadas', tone: 'info', icon: 'calendar' }) +
        UI.kpi({ label: 'Completadas (7 días)', value: done7.length, sub: 'con resultado registrado', tone: 'ok', icon: 'checkCircle' }) +
      '</div>' +
      '<div class="card"><div class="crm-filters"><span class="small muted">' + (own() ? 'Mi agenda' : adv() ? 'Agenda de ' + esc(Q.userName(adv())) : 'Agenda del equipo') + '</span><select class="input sm" id="af-type" aria-label="Tipo"><option value="">Tipo: todos</option>' + ACT_TYPES.map(t => '<option' + (t === S.actType ? ' selected' : '') + '>' + t + '</option>').join('') + '</select><div class="grow"></div><span class="xs faint">' + filt().length + ' actividad(es) con los filtros actuales</span></div></div>' +
      '<div id="act-body" style="min-width:0;contain:inline-size"></div></div>';

    el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.actView = b.dataset.view; remember('crm_actView', S.actView); App.render(); });
    bindScope(el);
    el.querySelector('#af-type').onchange = (e) => { S.actType = e.target.value; App.render(); };
    const nb = el.querySelector('#btn-new-act'); if (nb) nb.onclick = () => activityModal({});
    const body = el.querySelector('#act-body');
    const list = filt();
    if (S.actView === 'semana') weekView(body, list); else groupedList(body, list);
  });

  function groupedList(host, list) {
    const groups = [
      ['Vencidas', 'bad', list.filter(a => actStatus(a) === 'vencida').sort((a, b) => a.due.localeCompare(b.due)), 'alert'],
      ['Hoy', 'sun', list.filter(a => actStatus(a) === 'pendiente' && a.due.slice(0, 10) === TD()).sort((a, b) => a.due.localeCompare(b.due)), 'clock'],
      ['Próximas', 'info', list.filter(a => actStatus(a) === 'pendiente' && a.due.slice(0, 10) > TD()).sort((a, b) => a.due.localeCompare(b.due)), 'calendar'],
      ['Completadas', 'ok', list.filter(a => a.status === 'completada').sort((a, b) => String(b.completedAt || b.due).localeCompare(String(a.completedAt || a.due))), 'checkCircle']
    ];
    host.innerHTML = '<div class="card">' + groups.map(([t, tone, items, ic]) => '<div class="crm-grp-h"><span class="ico-box ' + tone + '" style="width:24px;height:24px">' + UI.icon(ic) + '</span>' + t + UI.badge(tone === 'bad' ? 'vencida' : tone === 'ok' ? 'completada' : 'pendiente', items.length + ' actividad' + (items.length === 1 ? '' : 'es')) + '</div>' + (items.length ? '<div class="list">' + items.map(a => actItem(a)).join('') + '</div>' : '<div class="small faint" style="padding:12px 16px">Sin actividades.</div>')).join('') + '</div>';
    bindActs(host);
  }

  function weekView(host, list) {
    const ws = S.weekStart; const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const cls = (a) => { const s = actStatus(a); return s === 'completada' ? 'done' : s === 'vencida' ? 'bad' : a.type === 'Reunión' ? 'violet' : a.type === 'Postventa' ? 'sun' : a.type === 'Tarea' ? 'info' : ''; };
    const inWeek = list.filter(a => a.due.slice(0, 10) >= days[0] && a.due.slice(0, 10) <= days[6]);
    host.innerHTML = UI.card(date(days[0]) + ' — ' + date(days[6]), '<div class="tbl-wrap"><div class="cal crm-week">' + labels.map((l, i) => '<div class="cal-h">' + l + ' ' + dateShort(days[i]) + '</div>').join('') +
      days.map(dd => { const evs = list.filter(a => a.due.slice(0, 10) === dd).sort((a, b) => a.due.localeCompare(b.due)); return '<div class="cal-d' + (dd === TD() ? ' today' : '') + '"><span class="dn">' + parseInt(dd.slice(8), 10) + '</span>' + evs.map(a => '<div class="cal-ev ' + cls(a) + '" data-ev="' + a.id + '" title="' + esc(a.type + ' · ' + a.subject) + '"><b>' + esc(a.due.slice(11, 16)) + '</b> ' + esc(a.subject) + '</div>').join('') + '</div>'; }).join('') + '</div></div>' +
      '<div class="legend" style="margin-top:10px"><span><i style="background:var(--accent)"></i>Llamada / Email / WhatsApp</span><span><i style="background:var(--violet)"></i>Reunión</span><span><i style="background:var(--info)"></i>Tarea</span><span><i style="background:var(--sun)"></i>Postventa</span><span><i style="background:var(--bad)"></i>Vencida</span></div>',
      { sub: inWeek.length + ' actividad(es) en la semana', actions: '<div class="btn-group"><button class="btn sm" data-wk="-7" aria-label="Semana anterior">' + UI.icon('chevronLeft') + '</button><button class="btn sm" data-wk="0">Esta semana</button><button class="btn sm" data-wk="7" aria-label="Semana siguiente">' + UI.icon('chevronRight') + '</button></div>' });
    host.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { const n = +b.dataset.wk; if (!n) { const d = parseD(TD()); S.weekStart = addDays(TD(), -((d.getDay() + 6) % 7)); } else S.weekStart = addDays(S.weekStart, n); weekView(host, list); });
    host.querySelectorAll('[data-ev]').forEach(e => e.onclick = () => activityDrawer(DB.activities.find(a => a.id === e.dataset.ev)));
  }

  /* ======================================================================
     CLIENTES — lista y CUSTOMER 360 (PROC-008)
     ====================================================================== */
  App.register('crm/clientes', (el, params) => {
    if (!Auth.canAny(['crm.leads.view', 'crm.clients.manage', 'finance.receivables'])) return noAccess(el, 'Clientes');
    ensure();
    if (params[0] === 'nuevo') { clientList(el); clientForm(); return; }
    if (params[0]) { const c = Q.client(params[0]); if (c && !canSeeClient(c.id)) return Scope.denied(el, 'El cliente ' + c.name + ' (' + c.id + ')'); return client360(el, params[0]); }
    clientList(el);
  });

  function clientList(el) {
    const C = V.clients();
    const cids = new Set(C.map(c => c.id));
    const npsList = (DB.surveys || []).filter(x => cids.has(x.clientId));
    const ns = npsStats(npsList);
    const rows = () => V.clients().map(c => { const s = clientStats(c.id); return Object.assign({}, c, { _total: s.total, _res: s.valid.length, _last: s.last, _nps: s.nps, _bal: s.balance }); });
    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: 'Clientes 360', subtitle: 'Personas y empresas con su historial comercial, operativo y financiero consolidado (PROC-008).', crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Clientes']],
        actions: scopeCtl() + (can('crm.clients.manage') ? '<button class="btn primary" id="btn-new-cli">' + UI.icon('plus') + 'Nuevo cliente</button>' : '') }) +
      readonlyNote('crm.clients.manage', 'crear ni editar clientes') + advNote() +
      (own() ? UI.alert('info', 'Su cartera incluye los clientes que tiene asignados y aquellos con oportunidades, cotizaciones o reservas a su nombre.') : '') +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Clientes', value: C.length, sub: C.filter(c => c.kind === 'Persona').length + ' personas · ' + C.filter(c => c.kind === 'Empresa').length + ' empresas', tone: 'accent', icon: 'users' }) +
        UI.kpi({ label: 'Corporativo y B2B', value: C.filter(c => ['Corporativo', 'B2B'].includes(c.segment)).length, sub: 'cuentas empresariales', tone: 'violet', icon: 'building' }) +
        UI.kpi({ label: 'VIP y grupos', value: C.filter(c => ['VIP', 'Grupos'].includes(c.segment)).length, sub: 'atención prioritaria', tone: 'sun', icon: 'star' }) +
        UI.kpi({ label: 'NPS', value: (ns.nps > 0 ? '+' : '') + ns.nps, sub: 'promedio ' + fmtN(ns.avg, 1) + ' · ' + ns.n + ' encuestas', tone: 'ok', icon: 'heart' }) +
      '</div><div id="cli-tbl"></div></div>';
    UI.dataTable(el.querySelector('#cli-tbl'), {
      rows, exportName: 'clientes', defaultSort: '_total', defaultDir: -1,
      searchPlaceholder: 'Buscar nombre, documento, correo…',
      search: r => [r.id, r.name, r.doc, r.email, r.phone, r.city, (r.tags || []).join(' ')].join(' '),
      filters: [
        { key: 'segment', label: 'Segmento', options: SEGMENTS.map(s => [s, s]) },
        { key: 'kind', label: 'Tipo', options: [['Persona', 'Persona'], ['Empresa', 'Empresa']] }
      ],
      columns: [
        { key: 'name', label: 'Cliente', render: r => '<div class="cell-main">' + esc(r.name) + '</div><div class="cell-sub"><span class="mono">' + r.id + '</span> · ' + esc(r.doc) + '</div>' },
        { key: 'kind', label: 'Tipo', render: r => '<span class="tag">' + esc(r.kind) + '</span>' },
        { key: 'segment', label: 'Segmento', render: r => UI.badge({ Retail: 'nuevo', Corporativo: 'calificado', VIP: 'negociacion', Grupos: 'contactado', B2B: 'cotizacion' }[r.segment] || 'activo', r.segment) },
        { key: 'city', label: 'Ubicación', render: r => '<div class="small">' + esc(r.city) + '</div><div class="cell-sub">' + esc(r.country) + '</div>' },
        { key: '_res', label: 'Reservas', align: 'num' },
        { key: '_total', label: 'Total comprado S/', align: 'num', render: r => fmtN(r._total, 0), csv: r => r._total.toFixed(2) },
        { key: '_bal', label: 'Saldo S/', align: 'num', render: r => r._bal ? '<span class="warn">' + fmtN(r._bal, 0) + '</span>' : '<span class="faint">0</span>', csv: r => r._bal.toFixed(2) },
        { key: '_nps', label: 'NPS', render: r => r._nps == null ? '<span class="faint">—</span>' : '<b class="' + (r._nps >= 9 ? 'ok' : r._nps >= 7 ? 'warn' : 'bad') + '">' + r._nps + '</b>', sortVal: r => r._nps == null ? -1 : r._nps },
        { key: '_last', label: 'Última compra', render: r => r._last ? date(r._last) : '<span class="faint">—</span>', sortVal: r => r._last || '' },
        { key: 'owner', label: 'Responsable', render: r => ownerShort(r.owner), csv: r => Q.userName(r.owner) }
      ],
      onRow: r => App.go('#/crm/clientes/' + r.id)
    });
    const b = el.querySelector('#btn-new-cli'); if (b) b.onclick = () => clientForm();
    bindScope(el);
  }

  function clientForm(c) {
    if (!can('crm.clients.manage')) return deny('crear o editar clientes');
    const isNew = !c;
    if (c && !canSeeClient(c.id)) return notMine('El cliente ' + c.name);
    const v = c || { kind: 'Persona', country: 'Perú', city: 'Lima', segment: 'Retail', owner: Auth.user.id, tags: [] };
    const m0 = String(v.doc || '').match(/^(\S+)\s+(.+)$/) || [];
    const dtype = m0[1] === 'Passport' ? 'Pasaporte' : (m0[1] || (v.kind === 'Empresa' ? 'RUC' : 'DNI'));
    UI.modal({ title: isNew ? 'Nuevo cliente' : 'Editar cliente ' + c.id, size: 'lg', body: UI.form([
      { type: 'section', label: 'Identificación' },
      { id: 'cl_kind', label: 'Tipo', type: 'select', options: ['Persona', 'Empresa'], value: v.kind, col: 3 },
      { id: 'cl_name', label: 'Nombre / razón social', required: true, value: v.name, col: 9 },
      { id: 'cl_docType', label: 'Tipo de documento', type: 'select', options: ['DNI', 'RUC', 'Pasaporte', 'CE'], value: dtype, col: 3 },
      { id: 'cl_docNum', label: 'Número de documento', required: true, value: m0[2] || '', col: 3 },
      { id: 'cl_segment', label: 'Segmento', type: 'select', required: true, options: SEGMENTS, value: v.segment, col: 3 },
      { id: 'cl_owner', label: 'Responsable', type: 'select', required: true, options: own() ? [[v.owner || me(), Q.userName(v.owner || me())]] : sellerOpts(), value: own() ? (v.owner || me()) : v.owner, col: 3, hint: own() ? 'Reasignación: Gerencia' : '' },
      { type: 'section', label: 'Contacto' },
      { id: 'cl_email', label: 'Correo', type: 'email', value: v.email, col: 4 },
      { id: 'cl_phone', label: 'Teléfono', value: v.phone, col: 4 },
      { id: 'cl_contactName', label: 'Contacto principal (empresas)', value: v.contactName, col: 4 },
      { id: 'cl_country', label: 'País', value: v.country, col: 4 },
      { id: 'cl_city', label: 'Ciudad', value: v.city, col: 4 },
      { id: 'cl_birth', label: 'Fecha de nacimiento (personas)', type: 'date', value: v.birth, col: 4 },
      { id: 'cl_tags', label: 'Etiquetas', value: (v.tags || []).join(', '), col: 12, hint: 'Separadas por comas. Ej.: Familia, Recurrente, Hotel 5*' }
    ]),
      actions: [{ label: 'Cancelar' }, { label: isNew ? 'Crear cliente' : 'Guardar', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const d = strip(UI.formData(m), 'cl_');
        if (own()) d.owner = v.owner || me();
        const err = checkDoc(d.kind, d.docType, d.docNum, d.country); if (err) { UI.toast(err, 'bad'); return false; }
        if (!d.email && !d.phone) { UI.toast('Registre al menos un correo o teléfono de contacto.', 'bad'); return false; }
        const doc = d.docType + ' ' + String(d.docNum).trim();
        const dupDoc = DB.clients.find(x => x.id !== (c && c.id) && x.doc.replace(/\s/g, '') === doc.replace(/\s/g, ''));
        if (dupDoc) { UI.toast('Duplicado: ya existe el cliente ' + esc(dupDoc.name) + ' (' + dupDoc.id + ') con ' + esc(doc) + '.', 'bad'); return false; }
        const save = () => {
          const payload = { kind: d.kind, name: d.name, doc, segment: d.segment, owner: d.owner, email: d.email, phone: d.phone, contactName: d.contactName, country: d.country, city: d.city, birth: d.birth, tags: d.tags.split(',').map(t => t.trim()).filter(Boolean) };
          if (isNew) {
            const n = Object.assign({ id: nextId(DB.clients, 'CLI-', 4), createdAt: TD(), nps: null, contacts: d.contactName ? [{ name: d.contactName, role: 'Contacto principal', email: d.email, phone: d.phone, primary: true }] : [] }, payload);
            DB.clients.unshift(n); Store.save(); Audit.log('Cliente', n.id, 'crear', '', n.name + ' · ' + n.segment);
            UI.toast('Cliente ' + n.id + ' creado.'); App.go('#/crm/clientes/' + n.id);
          } else {
            const changed = Object.keys(payload).filter(k => String(c[k] == null ? '' : c[k]) !== String(payload[k]));
            const segBefore = c.segment;
            Object.assign(c, payload); Store.save(); Audit.log('Cliente', c.id, 'editar', segBefore !== c.segment ? 'segmento ' + segBefore : '', (changed.join(', ') || 'sin cambios'));
            UI.toast('Cliente actualizado.'); App.render();
          }
        };
        const soft = findDups(d.email, d.phone).filter(x => x.type === 'client' && x.id !== (c && c.id));
        if (soft.length) { setTimeout(() => UI.confirm({ title: 'Posible duplicado', message: 'El correo o teléfono coincide con: ' + soft.map(x => '<b>' + esc(x.name) + '</b> (' + x.id + ')').join(', ') + '. ¿Desea guardar de todos modos?', confirmLabel: 'Guardar igualmente', onConfirm: save }), 0); return; }
        save();
      } }] });
  }

  function client360(el, id) {
    const c = Q.client(id);
    if (!c) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Cliente no encontrado', crumbs: [['CRM'], ['Clientes', '#/crm/clientes']] }) + UI.card('', UI.empty('No existe el cliente ' + id, 'user')) + '</div>'; return; }
    const s = clientStats(c.id);
    const opps = DB.opportunities.filter(o => o.clientId === c.id && mineOk(o));
    const quotes = V.quotes().filter(q => q.clientId === c.id);
    const res = s.res.filter(mineOk);
    const resIds = res.map(r => r.id);
    const leads = DB.leads.filter(l => (!own() || !l.owner || l.owner === me()) && (l.convertedClientId === c.id || (l.duplicateOf === c.id) || (c.email && normE(l.email) === normE(c.email)) || (c.phone && normP(l.phone) && normP(l.phone) === normP(c.phone))));
    const acts = DB.activities.filter(a => mineOk(a) && ((a.relType === 'client' && a.relId === c.id) || (a.relType === 'opportunity' && opps.some(o => o.id === a.relId)) || (a.relType === 'lead' && leads.some(l => l.id === a.relId)) || (a.relType === 'quote' && quotes.some(q => q.id === a.relId)))).sort((a, b) => b.due.localeCompare(a.due));
    const recv = DB.receivables.filter(r => r.clientId === c.id && (!own() || resIds.includes(r.resId)));
    const pays = DB.payments.filter(p => resIds.includes(p.resId));
    const vouchers = DB.vouchers.filter(v => resIds.includes(v.resId));
    const invoices = DB.invoices.filter(i => i.clientId === c.id && (!own() || resIds.includes(i.resId)));
    const keys = [c.email, c.phone, c.name].concat(quotes.map(q => q.id), resIds).filter(Boolean).map(x => String(x).toLowerCase());
    const comms = DB.notifications.filter(n => keys.some(k => (String(n.to) + ' ' + n.subject).toLowerCase().includes(k)));
    const claims = (DB.claims || []).filter(x => x.clientId === c.id);
    const shared = own() && (DB.opportunities.some(o => o.clientId === c.id && o.owner !== me()) || DB.quotes.some(q => q.clientId === c.id && q.owner !== me()) || DB.reservations.some(r => r.clientId === c.id && r.owner !== me()));
    const paxMap = {};
    res.forEach(r => r.passengers.forEach(p => { const k = p.doc || p.name; if (!paxMap[k]) paxMap[k] = Object.assign({}, p, { trips: [] }); paxMap[k].trips.push(r); }));
    const pax = Object.values(paxMap);
    const manage = can('crm.clients.manage');
    const openOpps = opps.filter(isOpen);
    const nextActs = acts.filter(a => a.status !== 'completada').sort((a, b) => a.due.localeCompare(b.due));

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: '<span class="crm-head">' + UI.avatar({ name: c.name, color: '#46606B' }, 'lg') + '<span>' + esc(c.name) + '<span class="row" style="gap:6px;margin-top:6px;font-size:.8rem;font-weight:400">' + UI.badge('activo', c.segment) + '<span class="tag">' + esc(c.kind) + '</span>' + (c.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</span></span></span>', subtitle: '<span class="mono">' + c.id + '</span> · ' + esc(c.doc) + ' · ' + esc(c.city) + ', ' + esc(c.country) + ' · cliente desde ' + date(c.createdAt) + ' · responsable ' + esc(Q.userName(c.owner)), crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Clientes', '#/crm/clientes'], [c.id]],
        actions: (own() ? scopeCtl() : '') + (canReassign() ? '<button class="btn" id="c-reassign">' + UI.icon('user') + 'Reasignar</button>' : '') + (manage ? '<button class="btn" id="c-edit">' + UI.icon('edit') + 'Editar</button>' : '') + (can('crm.activities.manage') ? '<button class="btn" id="c-act">' + UI.icon('calendar') + 'Actividad</button>' : '') + (can('crm.opportunities.manage') ? '<button class="btn primary" id="c-opp">' + UI.icon('plus') + 'Nueva oportunidad</button>' : '') }) +
      (shared ? UI.alert('info', 'Vista de su cartera: se muestran solo las oportunidades, cotizaciones, reservas y actividades a su nombre. Otros asesores atienden registros adicionales de este cliente.') : '') +
      (s.overdue.length ? UI.alert('warn', '<b>Saldo vencido:</b> ' + s.overdue.map(r => esc(r.id) + ' (' + money(r.amount - r.paid, r.currency) + ', vence ' + date(r.due) + ')').join(', ') + '. Coordine con Finanzas antes de nuevas reservas a crédito.') : '') +
      (claims.some(x => ['abierta', 'en_proceso'].includes(x.status)) ? UI.alert('info', '<b>Caso de postventa abierto:</b> ' + claims.filter(x => ['abierta', 'en_proceso'].includes(x.status)).map(x => esc(x.id) + ' — ' + esc(x.subject)).join('; ') + ' · <a href="#/crm/postventa">Ver postventa</a>') : '') +
      '<div class="grid g5">' +
        UI.kpi({ label: 'Total comprado', value: penK(s.total), sub: 'reservas vigentes y completadas', tone: 'accent', icon: 'trending' }) +
        UI.kpi({ label: 'Reservas', value: s.valid.length, sub: res.length - s.valid.length ? (res.length - s.valid.length) + ' canceladas/borrador' : 'sin cancelaciones', tone: 'info', icon: 'suitcase' }) +
        UI.kpi({ label: 'Ticket promedio', value: penK(s.avg), sub: 'por reserva', tone: 'violet', icon: 'receipt' }) +
        UI.kpi({ label: 'NPS', value: s.nps == null ? '—' : String(s.nps), sub: s.surveys.length + ' encuesta(s)', tone: s.nps == null ? 'info' : s.nps >= 9 ? 'ok' : s.nps >= 7 ? 'sun' : 'bad', icon: 'heart' }) +
        UI.kpi({ label: 'Saldo pendiente', value: penK(s.balance), sub: s.overdue.length ? s.overdue.length + ' cuota(s) vencida(s)' : 'al día', tone: s.overdue.length ? 'bad' : 'ok', icon: 'wallet' }) +
      '</div><div id="c360-tabs" style="min-width:0;contain:inline-size"></div></div>';

    const tbl = (head, rows, empty) => rows.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr>' + head.map(h => '<th' + (h.startsWith('#') ? ' class="num"' : '') + '>' + esc(h.replace(/^#/, '')) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : UI.empty(empty, 'box');
    const resRow = r => '<tr><td>' + resLink(r.id) + '<div class="cell-sub">' + esc(r.title) + '</div></td><td class="nowrap">' + dateShort(r.travelFrom) + ' – ' + date(r.travelTo) + '</td><td>' + esc(r.channel) + '</td><td class="num">' + r.passengers.length + '</td><td class="num nowrap">' + money(r.total, r.currency, 0) + '</td><td class="num nowrap">' + money(Q.resPaid(r.id), r.currency, 0) + '</td><td>' + UI.badge(r.status) + '</td></tr>';
    const qRow = q => { const v = q.versions.find(x => x.v === q.currentVersion) || q.versions[0]; const t = Pricing.quoteTotals(v); return '<tr><td>' + quoteLink(q.id) + '<div class="cell-sub">' + esc(q.title) + '</div></td><td>' + (q.oppId ? '<a href="#/crm/oportunidades/' + q.oppId + '" class="mono">' + q.oppId + '</a>' : '—') + '</td><td class="num">v' + q.currentVersion + '</td><td class="num nowrap">' + money(t.total, q.currency, 0) + '</td><td class="nowrap">' + date(q.validUntil) + '</td><td>' + UI.badge(q.status) + '</td></tr>'; };
    const oppRow = o => '<tr><td><a href="#/crm/oportunidades/' + o.id + '">' + esc(o.title) + '</a><div class="cell-sub mono">' + o.id + '</div></td><td>' + UI.badge(o.stage) + '</td><td class="num nowrap">' + money(o.amount, o.currency, 0) + '</td><td class="num">' + o.probability + '%</td><td class="nowrap">' + date(o.closeDate) + '</td><td>' + UI.userChip(o.owner) + '</td></tr>';

    const timeline = [];
    timeline.push({ ts: c.createdAt, title: 'Alta de cliente', desc: esc(c.segment) + (c.sourceLeadId ? ' · desde ' + c.sourceLeadId : ''), icon: 'user' });
    leads.forEach(l => timeline.push({ ts: l.createdAt, title: 'Lead ' + l.id + ' recibido · ' + esc(statusLabel(l.status)), desc: esc(l.source) + ' · ' + esc(l.interest) + ' ' + esc(l.destination || ''), icon: 'funnel', href: '#/crm/leads/' + l.id }));
    opps.forEach(o => { timeline.push({ ts: o.createdAt, title: 'Oportunidad ' + o.id + ' creada', desc: esc(o.title), icon: 'target', href: '#/crm/oportunidades/' + o.id }); if (!isOpen(o)) timeline.push({ ts: o.closedAt || o.closeDate, title: 'Oportunidad ' + o.id + ' ' + statusLabel(o.stage).toLowerCase(), desc: o.stage === 'perdida' ? 'Motivo: ' + esc(o.lostReason) : money(o.amount, o.currency), icon: o.stage === 'ganada' ? 'award' : 'x', href: '#/crm/oportunidades/' + o.id }); });
    quotes.forEach(q => { timeline.push({ ts: q.createdAt, title: 'Cotización ' + q.id + ' creada', desc: esc(q.title), icon: 'file', href: '#/cotizaciones/' + q.id }); if (q.approvedAt) timeline.push({ ts: q.approvedAt, title: 'Cotización ' + q.id + ' aprobada', desc: 'por ' + esc(q.approvedBy), icon: 'fileCheck', href: '#/cotizaciones/' + q.id }); });
    res.forEach(r => timeline.push({ ts: r.createdAt, title: 'Reserva ' + r.id + ' · ' + statusLabel(r.status), desc: esc(r.title) + ' · ' + money(r.total, r.currency), icon: 'suitcase', href: '#/reservas/' + r.id }));
    pays.forEach(p => timeline.push({ ts: p.date, title: 'Pago ' + p.id + ' · ' + statusLabel(p.status), desc: esc(p.method) + ' · ' + money(p.amount, p.currency), icon: 'wallet' }));
    s.surveys.forEach(x => timeline.push({ ts: x.date, title: 'Encuesta NPS ' + x.score, desc: esc(x.comment), icon: 'heart' }));
    claims.forEach(x => timeline.push({ ts: x.createdAt, title: esc(x.type) + ' ' + x.id + ' · ' + statusLabel(x.status), desc: esc(x.subject), icon: 'alert' }));
    timeline.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

    const tabs = [
      { id: 'resumen', label: 'Resumen', render: (b) => {
        b.innerHTML = '<div class="grid g-2-1"><div class="stack">' +
          UI.card('Oportunidades abiertas', openOpps.length ? tbl(['Oportunidad', 'Etapa', '#Monto', '#Prob.', 'Cierre', 'Responsable'], openOpps.map(oppRow)) : UI.empty('Sin oportunidades abiertas', 'target'), { tight: true }) +
          UI.card('Últimas reservas', tbl(['Reserva', 'Fechas', 'Canal', '#Pax', '#Total', '#Pagado', 'Estado'], res.slice(0, 4).map(resRow), 'Sin reservas'), { tight: true }) +
          UI.card('Actividad reciente', UI.timeline(timeline.slice(0, 8).map(t => ({ title: t.href ? '<a href="' + t.href + '">' + t.title + '</a>' : t.title, meta: datetime(t.ts), desc: t.desc, icon: t.icon })))) +
        '</div><div class="stack">' +
          UI.card('Datos principales', UI.dl([['Documento', esc(c.doc)], ['Correo', esc(c.email)], ['Teléfono', esc(c.phone)], ['Contacto', esc(c.contactName || '')], ['Segmento', esc(c.segment)], ['Responsable', UI.userChip(c.owner)], ['Destinos visitados', clientDests(c.id).map(esc).join(', ') || '—']])) +
          UI.card('Próximas actividades', nextActs.length ? '<div class="list">' + nextActs.slice(0, 4).map(a => actItem(a)).join('') + '</div>' : UI.empty('Sin actividades pendientes', 'calendar'), { tight: true }) +
          UI.card('Satisfacción', s.surveys.length ? '<div class="stat-line"><span class="muted">Último NPS</span>' + npsBadge(s.nps) + '</div><div class="stat-line"><span class="muted">Promedio</span><b>' + fmtN(sum(s.surveys, 'score') / s.surveys.length, 1) + '</b></div><p class="small muted" style="margin-top:8px">“' + esc(s.surveys[0].comment) + '”</p>' : UI.empty('Sin encuestas registradas', 'heart'), { actions: '<a class="btn sm ghost" href="#/crm/postventa">Postventa ' + UI.icon('arrowRight') + '</a>' }) +
        '</div></div>';
        bindActs(b);
      } },
      { id: 'datos', label: 'Contactos y datos', count: (c.contacts || []).length, render: (b) => {
        b.innerHTML = '<div class="grid g2">' + UI.card('Ficha del cliente', UI.dl([['Código', '<span class="mono">' + c.id + '</span>'], ['Tipo', esc(c.kind)], ['Nombre / razón social', esc(c.name)], ['Documento', esc(c.doc)], ['Correo', esc(c.email)], ['Teléfono', esc(c.phone)], ['País', esc(c.country)], ['Ciudad', esc(c.city)], c.kind === 'Persona' ? ['Nacimiento', c.birth ? date(c.birth) : ''] : null, ['Segmento', esc(c.segment)], ['Etiquetas', (c.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join(' ')], ['Alta', date(c.createdAt)], ['Lead de origen', c.sourceLeadId ? leadLink(c.sourceLeadId) : '']]), { actions: manage ? '<button class="btn sm" id="c-edit2">' + UI.icon('edit') + 'Editar</button>' : '' }) +
          UI.card('Contactos', (c.contacts || []).length ? '<div class="list">' + c.contacts.map((x, i) => '<div class="list-item">' + UI.avatar({ name: x.name, color: '#46606B' }) + '<div class="grow"><div class="small" style="font-weight:550">' + esc(x.name) + (x.primary ? ' ' + UI.badge('activo', 'Principal') : '') + '</div><div class="xs faint">' + esc(x.role || '') + ' · ' + esc(x.email || '') + ' · ' + esc(x.phone || '') + '</div></div>' + (manage && !x.primary ? '<button class="btn xs ghost" data-primary="' + i + '">Hacer principal</button>' : '') + '</div>').join('') + '</div>' : UI.empty('Sin contactos adicionales', 'users'), { tight: true, actions: manage ? '<button class="btn sm" id="c-addcontact">' + UI.icon('plus') + 'Contacto</button>' : '' }) + '</div>';
        const e2 = b.querySelector('#c-edit2'); if (e2) e2.onclick = () => clientForm(c);
        const ac = b.querySelector('#c-addcontact'); if (ac) ac.onclick = () => UI.modal({ title: 'Agregar contacto', body: UI.form([{ id: 'ct_name', label: 'Nombre', required: true, col: 6 }, { id: 'ct_role', label: 'Cargo / relación', col: 6 }, { id: 'ct_email', label: 'Correo', type: 'email', col: 6 }, { id: 'ct_phone', label: 'Teléfono', col: 6 }]), actions: [{ label: 'Cancelar' }, { label: 'Agregar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'ct_'); c.contacts = c.contacts || []; c.contacts.push(Object.assign(d, { primary: !c.contacts.length })); Store.save(); Audit.log('Cliente', c.id, 'agregar_contacto', '', d.name); UI.toast('Contacto agregado.'); App.render(); } }] });
        b.querySelectorAll('[data-primary]').forEach(x => x.onclick = () => { c.contacts.forEach((k, i) => k.primary = i === +x.dataset.primary); const p = c.contacts[+x.dataset.primary]; c.contactName = p.name; Store.save(); Audit.log('Cliente', c.id, 'contacto_principal', '', p.name); UI.toast('Contacto principal actualizado.'); App.render(); });
      } },
      { id: 'leads', label: 'Leads', count: leads.length, render: (b) => { b.innerHTML = UI.card('', tbl(['Lead', 'Fuente', 'Interés', 'Score', 'Estado', 'Recibido'], leads.map(l => '<tr><td>' + leadLink(l.id) + '<div class="cell-sub mono">' + l.id + '</div></td><td>' + esc(l.source) + '</td><td>' + esc(l.interest) + ' · ' + esc(l.destination || '') + '</td><td>' + scoreHtml(l.score) + '</td><td>' + UI.badge(l.status) + '</td><td class="nowrap">' + datetime(l.createdAt) + '</td></tr>'), 'Sin leads asociados a este cliente'), { tight: true }); } },
      { id: 'opps', label: 'Oportunidades', count: opps.length, render: (b) => { b.innerHTML = UI.card('', tbl(['Oportunidad', 'Etapa', '#Monto', '#Prob.', 'Cierre', 'Responsable'], opps.map(oppRow), 'Sin oportunidades'), { tight: true, actions: can('crm.opportunities.manage') ? '<button class="btn sm" id="c-opp2">' + UI.icon('plus') + 'Nueva oportunidad</button>' : '' }); const x = b.querySelector('#c-opp2'); if (x) x.onclick = () => oppForm(null, { clientId: c.id, owner: c.owner }); } },
      { id: 'quotes', label: 'Cotizaciones', count: quotes.length, render: (b) => { b.innerHTML = UI.card('', tbl(['Cotización', 'Oportunidad', '#Versión', '#Total', 'Validez', 'Estado'], quotes.map(qRow), 'Sin cotizaciones'), { tight: true }); } },
      { id: 'res', label: 'Reservas', count: res.length, render: (b) => { b.innerHTML = UI.card('', tbl(['Reserva', 'Fechas', 'Canal', '#Pax', '#Total', '#Pagado', 'Estado'], res.map(resRow), 'Sin reservas'), { tight: true }); } },
      { id: 'pax', label: 'Pasajeros', count: pax.length, render: (b) => { b.innerHTML = UI.card('', tbl(['Pasajero', 'Documento', 'Tipo', 'Nacionalidad', 'Nacimiento', 'Observación', 'Viajes'], pax.map(p => '<tr><td class="cell-main">' + esc(p.name) + '</td><td class="mono">' + esc(p.doc) + '</td><td>' + esc(p.type) + '</td><td>' + esc(p.nationality) + '</td><td class="nowrap">' + (p.birth ? date(p.birth) : '—') + '</td><td>' + esc(p.diet || '—') + '</td><td>' + p.trips.map(r => resLink(r.id)).join('<br>') + '</td></tr>'), 'Sin pasajeros registrados'), { tight: true, sub: 'Consolidado de las reservas del cliente' }); } },
      { id: 'pagos', label: 'Pagos', count: pays.length, render: (b) => {
        b.innerHTML = '<div class="stack">' + UI.card('Cuentas por cobrar', tbl(['CxC', 'Concepto', 'Reserva', 'Vence', '#Monto', '#Pagado', '#Saldo', 'Estado'], recv.map(r => '<tr><td class="mono">' + r.id + '</td><td>' + esc(r.concept) + '</td><td>' + resLink(r.resId) + '</td><td class="nowrap ' + (r.status !== 'pagada' && daysFromToday(r.due) < 0 ? 'bad' : '') + '">' + date(r.due) + '</td><td class="num nowrap">' + money(r.amount, r.currency) + '</td><td class="num nowrap">' + money(r.paid, r.currency) + '</td><td class="num nowrap"><b>' + money(r.amount - r.paid, r.currency) + '</b></td><td>' + UI.badge(r.status) + '</td></tr>'), 'Sin cuentas por cobrar'), { tight: true, sub: 'Saldo consolidado: S/ ' + fmtN(s.balance), actions: '<a class="btn sm ghost" href="#/finanzas/cobros">Finanzas ' + UI.icon('arrowRight') + '</a>' }) +
          UI.card('Pagos registrados', tbl(['Pago', 'Fecha', 'Reserva', 'Método', 'Referencia', '#Monto', 'Estado'], pays.map(p => '<tr><td class="mono">' + p.id + '</td><td class="nowrap">' + date(p.date) + '</td><td>' + resLink(p.resId) + '</td><td>' + esc(p.method) + '</td><td class="small">' + esc(p.ref) + '</td><td class="num nowrap">' + money(p.amount, p.currency) + '</td><td>' + UI.badge(p.status) + '</td></tr>'), 'Sin pagos'), { tight: true }) + '</div>';
      } },
      { id: 'docs', label: 'Documentos', count: vouchers.length + invoices.length, render: (b) => {
        b.innerHTML = '<div class="stack">' + UI.card('Comprobantes electrónicos', tbl(['Comprobante', 'Tipo', 'Fecha', 'Reserva', 'Detalle', '#Monto', 'Estado', ''], invoices.map(i => '<tr><td class="mono">' + i.id + '</td><td>' + esc(i.type) + '</td><td class="nowrap">' + date(i.date) + '</td><td>' + resLink(i.resId) + '</td><td class="small">' + esc(i.detail) + '</td><td class="num nowrap">' + money(i.amount, i.currency) + '</td><td>' + UI.badge(i.status) + '</td><td><button class="btn xs" data-inv="' + i.id + '">' + UI.icon('eye') + 'Ver</button></td></tr>'), 'Sin comprobantes'), { tight: true }) +
          UI.card('Vouchers', tbl(['Voucher', 'Servicio', 'Fecha', 'Reserva', '#Pax', 'Versión', 'Estado', ''], vouchers.map(v => '<tr><td class="mono">' + v.id + '</td><td>' + esc(v.service) + '<div class="cell-sub">' + esc(Q.providerName(v.providerId)) + '</div></td><td class="nowrap">' + date(v.date) + '</td><td>' + resLink(v.resId) + '</td><td class="num">' + v.pax + '</td><td>v' + v.version + '</td><td>' + UI.badge(v.status) + '</td><td><button class="btn xs" data-vou="' + v.id + '">' + UI.icon('eye') + 'Ver</button></td></tr>'), 'Sin vouchers'), { tight: true }) +
          UI.card('Propuestas comerciales', tbl(['Cotización', 'Oportunidad', '#Versión', '#Total', 'Validez', 'Estado'], quotes.map(qRow), 'Sin propuestas'), { tight: true }) + '</div>';
        b.querySelectorAll('[data-inv]').forEach(x => x.onclick = () => docInvoice(DB.invoices.find(i => i.id === x.dataset.inv), c));
        b.querySelectorAll('[data-vou]').forEach(x => x.onclick = () => docVoucher(DB.vouchers.find(v => v.id === x.dataset.vou)));
      } },
      { id: 'comms', label: 'Comunicaciones', count: comms.length, render: (b) => {
        const chIcon = { Email: 'mail', WhatsApp: 'msg', Push: 'phone', Portal: 'globe' };
        b.innerHTML = UI.card('Comunicaciones enviadas', comms.length ? '<div class="list">' + comms.map(n => '<div class="list-item"><div class="ico-box ' + (n.status === 'fallido' ? 'bad' : 'info') + '">' + UI.icon(chIcon[n.channel] || 'bell') + '</div><div class="grow"><div class="small" style="font-weight:550">' + esc(n.subject) + '</div><div class="xs faint">' + esc(n.channel) + ' → ' + esc(n.to) + ' · ' + esc(n.event) + ' · ' + datetime(n.ts) + (n.retries ? ' · ' + n.retries + ' reintento(s)' : '') + '</div></div>' + UI.badge(n.status) + '</div>').join('') + '</div>' : UI.empty('Sin comunicaciones registradas', 'mail'), { tight: true, sub: 'Notificaciones del sistema por email, WhatsApp, push y portal (PROC-059)', actions: manage ? '<button class="btn sm" id="c-comm">' + UI.icon('send') + 'Enviar comunicación</button>' : '' });
        const x = b.querySelector('#c-comm'); if (x) x.onclick = () => UI.modal({ title: 'Enviar comunicación', sub: esc(c.name), body: UI.form([{ id: 'cm_channel', label: 'Canal', type: 'select', options: ['Email', 'WhatsApp', 'Portal'], col: 4 }, { id: 'cm_subject', label: 'Asunto', required: true, col: 8, placeholder: 'Ej.: Documentos de viaje disponibles en su portal' }, { id: 'cm_body', label: 'Mensaje', type: 'textarea', rows: 4, col: 12 }]) + '<p class="xs faint" style="margin-top:10px">WhatsApp Business API se encuentra en sandbox; el envío queda registrado con su estado.</p>', actions: [{ label: 'Cancelar' }, { label: 'Enviar', cls: 'primary', icon: 'send', onClick: (m) => { if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'cm_'); const to = d.channel === 'Email' ? c.email : d.channel === 'WhatsApp' ? c.phone : c.name; if (!to) { UI.toast('El cliente no tiene ' + (d.channel === 'Email' ? 'correo' : 'teléfono') + ' registrado.', 'bad'); return false; } Notify.push('cliente.comunicacion', d.channel, to, d.subject); Audit.log('Cliente', c.id, 'comunicacion', d.channel, d.subject); UI.toast('Comunicación enviada por ' + d.channel + '.'); App.render(); } }] });
      } },
      { id: 'acts', label: 'Actividades', count: acts.length, render: (b) => { b.innerHTML = UI.card('', actsBlock(acts), { tight: true, sub: 'Del cliente, sus leads, oportunidades y cotizaciones', actions: can('crm.activities.manage') ? '<button class="btn sm" id="c-act2">' + UI.icon('plus') + 'Actividad</button>' : '' }); bindActs(b); const x = b.querySelector('#c-act2'); if (x) x.onclick = () => activityModal({ relType: 'client', relId: c.id, owner: c.owner, subject: 'Contacto con ' + c.name }); } },
      { id: 'hist', label: 'Historial', render: (b) => {
        b.innerHTML = '<div class="grid g2">' + UI.card('Línea de tiempo', UI.timeline(timeline.map(t => ({ title: t.href ? '<a href="' + t.href + '">' + t.title + '</a>' : t.title, meta: datetime(t.ts), desc: t.desc, icon: t.icon })))) +
          UI.card('Auditoría', auditTimeline(auditFor([c.id].concat(leads.map(l => l.id), opps.map(o => o.id), quotes.map(q => q.id), resIds, pays.map(p => p.id), claims.map(x => x.id))), 40), { sub: 'Acciones registradas sobre el cliente y sus documentos' }) + '</div>';
      } }
    ];
    UI.tabs(el.querySelector('#c360-tabs'), tabs, S.c360[c.id] || 'resumen', { onChange: (t) => { S.c360[c.id] = t; } });

    const on = (sel, fn) => { const x = el.querySelector(sel); if (x) x.onclick = fn; };
    on('#c-edit', () => clientForm(c));
    on('#c-reassign', () => reassignModal('Cliente', c));
    on('#c-act', () => activityModal({ relType: 'client', relId: c.id, owner: c.owner, subject: 'Contacto con ' + c.name }));
    on('#c-opp', () => oppForm(null, { clientId: c.id, owner: c.owner }));
  }

  function docInvoice(i, c) {
    if (!i) return;
    const t = DB.tenant; const base = i.amount / 1.18;
    const taxed = i.detail.toLowerCase().includes('exportación') ? false : true;
    UI.modal({ title: esc(i.type) + ' ' + i.id, size: 'lg', body: UI.alert('info', 'Vista previa. En producción el PDF y el XML se generan por job asíncrono y se validan con el OSE/SUNAT (integración por definir).') + '<div class="doc" style="margin-top:14px"><div class="doc-head"><div><h2>' + esc(t.name) + '</h2><div class="muted">RUC ' + t.ruc + ' · ' + esc(DB.sedes[0].address) + '</div></div><div style="text-align:right"><h3>' + esc(i.type.toUpperCase()) + ' ELECTRÓNICA</h3><div class="mono">' + i.id + '</div><div class="muted">' + date(i.date) + '</div></div></div><p><b>Cliente:</b> ' + esc(c.name) + ' · ' + esc(c.doc) + '</p><p class="muted">Reserva ' + esc(i.resId) + '</p><table><thead><tr><th>Descripción</th><th style="text-align:right">Importe</th></tr></thead><tbody><tr><td>' + esc(i.detail) + '</td><td style="text-align:right">' + money(taxed ? base : i.amount, i.currency) + '</td></tr></tbody></table><div class="tot">' + (taxed ? '<div class="stat-line"><span>Op. gravada</span><span>' + money(base, i.currency) + '</span></div><div class="stat-line"><span>IGV 18%</span><span>' + money(i.amount - base, i.currency) + '</span></div>' : '<div class="stat-line"><span>Op. exportación</span><span>' + money(i.amount, i.currency) + '</span></div>') + '<div class="stat-line total"><span>Total</span><span>' + money(i.amount, i.currency) + '</span></div></div><p class="muted" style="margin-top:14px;font-size:.74rem">Estado SUNAT: ' + esc(statusLabel(i.status)) + '</p></div>', actions: [{ label: 'Cerrar' }] });
  }
  function docVoucher(v) {
    if (!v) return;
    const r = Q.reservation(v.resId) || { passengers: [] };
    UI.modal({ title: 'Voucher ' + v.id, size: 'lg', body: UI.alert('info', 'Vista previa del voucher. En producción el PDF se genera por job y se envía al pasajero y al proveedor.') + '<div class="doc" style="margin-top:14px"><div class="doc-head"><div><h2>' + esc(DB.tenant.name) + '</h2><div class="muted">Voucher de servicio · v' + v.version + '</div></div><div style="text-align:right"><h3 class="mono">' + v.id + '</h3><div class="muted">Emitido ' + datetime(v.issuedAt) + '</div></div></div><table><tbody><tr><td><b>Servicio</b></td><td>' + esc(v.service) + '</td></tr><tr><td><b>Proveedor</b></td><td>' + esc(Q.providerName(v.providerId)) + '</td></tr><tr><td><b>Fecha</b></td><td>' + date(v.date) + '</td></tr><tr><td><b>Reserva</b></td><td>' + esc(v.resId) + '</td></tr><tr><td><b>Pasajeros</b></td><td>' + v.pax + ' · ' + r.passengers.slice(0, 6).map(p => esc(p.name)).join(', ') + (r.passengers.length > 6 ? '…' : '') + '</td></tr><tr><td><b>Estado</b></td><td>' + esc(statusLabel(v.status)) + '</td></tr></tbody></table><p class="muted" style="font-size:.74rem">Presentar este voucher al proveedor. Emergencias 24 h: ' + esc(DB.sedes[1].phone) + '</p></div>', actions: [{ label: 'Cerrar' }] });
  }

  /* ======================================================================
     POSTVENTA Y FIDELIZACIÓN (PROC-009 / PROC-010)
     ====================================================================== */
  App.register('crm/postventa', (el) => {
    if (!crmAllowed()) return noAccess(el, 'Postventa');
    ensure();
    const manage = can('crm.clients.manage');
    const cs = new Set(V.clients().map(c => c.id));
    const trips = DB.reservations.filter(r => (own() ? r.owner === me() : byAdv(r)) && (r.status === 'completada' && daysFromToday(r.travelTo) >= -60) || (r.status === 'en_operacion' && daysFromToday(r.travelTo) <= 5)).sort((a, b) => b.travelTo.localeCompare(a.travelTo));
    const surveys = DB.surveys.filter(x => cs.has(x.clientId)).sort((a, b) => b.date.localeCompare(a.date));
    const ns = npsStats(surveys);
    const claimRows = () => DB.claims.filter(x => own() ? (x.owner === me() || cs.has(x.clientId)) : byAdv(x));
    const claims = claimRows();
    const openClaims = claims.filter(x => ['abierta', 'en_proceso'].includes(x.status));
    const dist = Array.from({ length: 11 }, (_, i) => surveys.filter(s => s.score === i).length);

    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: 'Postventa y fidelización', subtitle: 'PROC-009: Viaje completado → Contactar → Registrar experiencia → Reclamo/feedback → Resolver → Actualizar Customer 360. PROC-010: Viaje cerrado → Segmentación → Acción comercial → Nueva oportunidad.', crumbs: [['Inicio', '#/dashboard'], ['CRM'], ['Postventa']],
        actions: scopeCtl() + (manage ? '<button class="btn" id="pv-claim">' + UI.icon('alert') + 'Registrar reclamo / feedback</button><button class="btn primary" id="pv-survey">' + UI.icon('heart') + 'Registrar encuesta NPS</button>' : '') }) +
      readonlyNote('crm.clients.manage', 'registrar encuestas ni reclamos') + advNote() +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Viajes por cerrar', value: trips.length, sub: trips.filter(t => !DB.surveys.some(s => s.resId === t.id)).length + ' sin encuesta', tone: 'accent', icon: 'suitcase' }) +
        UI.kpi({ label: 'NPS', value: (ns.nps > 0 ? '+' : '') + ns.nps, sub: ns.n + ' respuestas', tone: ns.nps >= 50 ? 'ok' : ns.nps >= 0 ? 'sun' : 'bad', icon: 'heart' }) +
        UI.kpi({ label: 'Puntaje promedio', value: fmtN(ns.avg, 1), sub: 'escala 0 – 10', tone: 'info', icon: 'star' }) +
        UI.kpi({ label: 'Casos abiertos', value: openClaims.length, sub: claims.filter(x => x.type === 'Reclamo' && ['abierta', 'en_proceso'].includes(x.status)).length + ' reclamo(s)', tone: openClaims.length ? 'sun' : 'ok', icon: 'alert' }) +
      '</div>' +
      '<div class="grid g-3-2">' +
        UI.card('Viajes completados recientemente', trips.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Reserva</th><th>Cliente</th><th>Fin del viaje</th><th>Estado</th><th>Encuesta</th><th></th></tr></thead><tbody>' + trips.map(r => { const sv = DB.surveys.find(s => s.resId === r.id); const d = daysFromToday(r.travelTo); return '<tr><td>' + resLink(r.id) + '<div class="cell-sub">' + esc(r.title) + '</div></td><td>' + clientLink(r.clientId) + '</td><td class="nowrap">' + date(r.travelTo) + '<div class="cell-sub">' + (d < 0 ? 'hace ' + (-d) + ' d' : d === 0 ? 'hoy' : 'en ' + d + ' d') + '</div></td><td>' + UI.badge(r.status) + '</td><td>' + (sv ? npsBadge(sv.score) : UI.badge('pendiente', 'Pendiente')) + '</td><td class="nowrap">' + (manage ? (sv ? '' : '<button class="btn xs" data-nps="' + r.id + '"' + (r.status !== 'completada' ? ' title="El viaje aún está en operación"' : '') + '>' + UI.icon('heart') + 'NPS</button> ') + '<button class="btn xs ghost icon" data-call="' + r.id + '" title="Programar contacto de postventa" aria-label="Programar contacto de postventa">' + UI.icon('phoneCall') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : UI.empty('Sin viajes completados recientemente', 'suitcase'), { tight: true, sub: 'Reservas completadas (60 días) o en operación que terminan en los próximos 5 días' }) +
        UI.card('Distribución NPS', UI.chart.donut({ items: [{ label: 'Promotores (9–10)', value: ns.p, display: ns.p + ' · ' + (ns.n ? fmtN(ns.p / ns.n * 100, 0) : 0) + '%', color: 'var(--ok)' }, { label: 'Pasivos (7–8)', value: ns.pas, display: ns.pas + ' · ' + (ns.n ? fmtN(ns.pas / ns.n * 100, 0) : 0) + '%', color: 'var(--sun)' }, { label: 'Detractores (0–6)', value: ns.d, display: ns.d + ' · ' + (ns.n ? fmtN(ns.d / ns.n * 100, 0) : 0) + '%', color: 'var(--bad)' }], center: (ns.nps > 0 ? '+' : '') + ns.nps, sub: 'NPS' }) + '<div class="divider" style="margin:14px 0"></div>' + UI.chart.bars({ labels: dist.map((_, i) => String(i)), series: [{ name: 'Respuestas', values: dist }], height: 150 }) + '<p class="xs faint">NPS = % promotores − % detractores. Un puntaje ≤ 6 genera automáticamente un caso de reclamo.</p>', { sub: 'Promedio ' + fmtN(ns.avg, 1) + ' sobre ' + ns.n + ' encuestas' }) +
      '</div>' +
      '<div id="pv-claims" style="min-width:0;contain:inline-size"></div>' +
      '<div id="pv-seg" style="min-width:0;contain:inline-size"></div>' +
        UI.card('Últimas encuestas', surveys.length ? '<div class="list">' + surveys.slice(0, 7).map(s => '<div class="list-item"><div class="ico-box ' + (s.score >= 9 ? 'ok' : s.score >= 7 ? 'sun' : 'bad') + '"><b class="small">' + s.score + '</b></div><div class="grow" style="min-width:0"><div class="small" style="font-weight:550">' + clientLink(s.clientId) + '</div><div class="xs muted">' + esc(s.comment) + '</div><div class="xs faint">' + datetime(s.date) + ' · ' + esc(s.channel) + (s.resId ? ' · ' + resLink(s.resId) : '') + '</div></div></div>').join('') + '</div>' : UI.empty('Sin encuestas', 'heart'), { tight: true }) +
      '</div>';

    const on = (sel, fn) => { const x = el.querySelector(sel); if (x) x.onclick = fn; };
    on('#pv-survey', () => surveyModal({}));
    on('#pv-claim', () => claimModal({}));
    el.querySelectorAll('[data-nps]').forEach(b => b.onclick = () => { const r = Q.reservation(b.dataset.nps); if (r.status !== 'completada') UI.toast('Aviso: el viaje ' + r.id + ' aún está en operación; lo habitual es encuestar al cierre (PROC-009).', 'warn'); surveyModal({ clientId: r.clientId, resId: r.id }); });
    el.querySelectorAll('[data-call]').forEach(b => b.onclick = () => { const r = Q.reservation(b.dataset.call); const c = Q.client(r.clientId); activityModal({ type: 'Postventa', relType: 'client', relId: r.clientId, owner: (c && c.owner) || Auth.user.id, subject: 'Llamada de postventa — ' + r.id + ' ' + (c ? c.name : ''), due: nowStr().slice(0, 11) + '17:00' }); });

    UI.dataTable(el.querySelector('#pv-claims'), {
      rows: claimRows, exportName: 'reclamos', defaultSort: 'createdAt', defaultDir: -1, pageSize: 6,
      searchPlaceholder: 'Buscar caso, cliente, asunto…',
      search: r => [r.id, r.subject, r.desc, Q.clientName(r.clientId), r.resId].join(' '),
      toolbar: '<b class="small" style="margin-right:6px">Reclamos y feedback</b>',
      filters: [{ key: 'status', label: 'Estado', options: ['abierta', 'en_proceso', 'resuelta', 'cerrada'] }, { key: 'type', label: 'Tipo', options: CLAIM_TYPES.map(t => [t, t]) }],
      columns: [
        { key: 'id', label: 'Caso', render: r => '<span class="mono">' + r.id + '</span><div class="cell-sub">' + datetime(r.createdAt) + '</div>' },
        { key: 'clientId', label: 'Cliente', render: r => clientLink(r.clientId), csv: r => Q.clientName(r.clientId) },
        { key: 'type', label: 'Tipo', render: r => '<span class="tag">' + esc(r.type) + '</span>' },
        { key: 'subject', label: 'Asunto', render: r => '<div class="small" style="font-weight:550">' + esc(r.subject) + '</div>' + (r.surveyId ? '<div class="cell-sub">Desde encuesta ' + r.surveyId + '</div>' : '') },
        { key: 'resId', label: 'Reserva', render: r => resLink(r.resId) },
        { key: 'priority', label: 'Prioridad', render: r => UI.badge(r.priority), sortVal: r => ['baja', 'media', 'alta', 'critica'].indexOf(r.priority) },
        { key: 'owner', label: 'Responsable', render: r => ownerShort(r.owner), csv: r => Q.userName(r.owner) },
        { key: 'status', label: 'Estado', render: r => UI.badge(r.status), csv: r => statusLabel(r.status) }
      ],
      onRow: r => claimDrawer(r)
    });

    const segRows = () => V.clients().map(c => { const s = clientStats(c.id); return { c, id: c.id, name: c.name, segment: c.segment, last: s.last, days: s.last ? -daysFromToday(s.last) : null, dests: clientDests(c.id), total: s.total, nps: s.nps, openOpp: DB.opportunities.some(o => o.clientId === c.id && isOpen(o)) }; });
    const allDests = [...new Set(V.clients().flatMap(c => clientDests(c.id)))].sort();
    bindScope(el);
    UI.dataTable(el.querySelector('#pv-seg'), {
      rows: segRows, exportName: 'segmentacion_fidelizacion', defaultSort: 'total', defaultDir: -1, pageSize: 8,
      searchPlaceholder: 'Buscar cliente…', search: r => r.name + ' ' + r.id,
      toolbar: '<b class="small" style="margin-right:6px">Segmentación (PROC-010)</b>',
      filters: [
        { key: 'segment', label: 'Segmento', options: SEGMENTS.map(s => [s, s]) },
        { key: 'last', label: 'Última compra', options: [['30', 'Últimos 30 días'], ['90', 'Hace más de 90 días'], ['180', 'Hace más de 180 días'], ['none', 'Sin compras']], match: (r, v) => v === 'none' ? r.days == null : v === '30' ? (r.days != null && r.days <= 30) : (r.days != null && r.days > +v) },
        { key: 'dest', label: 'Destino', options: allDests.map(d => [d, d]), match: (r, v) => r.dests.includes(v) }
      ],
      columns: [
        { key: 'name', label: 'Cliente', render: r => '<a href="#/crm/clientes/' + r.id + '">' + esc(r.name) + '</a><div class="cell-sub">' + esc(r.segment) + '</div>' },
        { key: 'last', label: 'Última compra', render: r => r.last ? date(r.last) + '<div class="cell-sub">hace ' + r.days + ' d</div>' : '<span class="faint">Sin compras</span>', sortVal: r => r.last || '' },
        { key: 'dests', label: 'Destinos', sort: false, render: r => r.dests.length ? '<span class="small">' + r.dests.map(esc).join(', ') + '</span>' : '<span class="faint">—</span>', csv: r => r.dests.join(' / ') },
        { key: 'total', label: 'Comprado S/', align: 'num', render: r => fmtN(r.total, 0), csv: r => r.total.toFixed(2) },
        { key: 'nps', label: 'NPS', align: 'num', render: r => r.nps == null ? '—' : String(r.nps), sortVal: r => r.nps == null ? -1 : r.nps },
        { key: 'act', label: '', sort: false, render: r => manage ? '<button class="btn xs" data-rebuy="' + r.id + '"' + (r.openOpp ? ' title="Ya tiene oportunidades abiertas"' : '') + '>' + UI.icon('plus') + 'Crear oportunidad de recompra</button>' : '', csv: () => '' }
      ],
      afterDraw: (cont) => cont.querySelectorAll('[data-rebuy]').forEach(b => b.onclick = (e) => { e.stopPropagation(); rebuy(Q.client(b.dataset.rebuy)); })
    });
  });

  function rebuy(c) {
    if (!can('crm.opportunities.manage')) return deny('crear oportunidades');
    if (!canSeeClient(c.id)) return notMine('El cliente ' + c.name);
    const s = clientStats(c.id); const dests = clientDests(c.id);
    const SUG = [['Cusco', 'Arequipa y Cañón del Colca'], ['Arequipa', 'Cusco y Machu Picchu'], ['Ica', 'Cusco y Valle Sagrado'], ['Machu Picchu', 'Lago Titicaca — Puno'], ['Puno', 'Paracas e Islas Ballestas']];
    const sug = (SUG.find(x => dests.includes(x[0])) || [null, 'Cusco y Machu Picchu'])[1];
    const open = DB.opportunities.filter(o => o.clientId === c.id && isOpen(o));
    const go = () => oppForm(null, { clientId: c.id, owner: own() ? me() : c.owner, title: 'Recompra — ' + c.name + ' — ' + sug, destination: sug, amount: Math.round(s.avg || 4000), currency: 'PEN', stage: 'calificacion', closeDate: addDays(TD(), 30), notes: 'Campaña de fidelización (PROC-010). Última compra: ' + (s.last ? date(s.last) : 'sin compras') + '. Destinos previos: ' + (dests.join(', ') || '—') + '.', origin: 'Fidelización', onSaved: (n) => { Audit.log('Cliente', c.id, 'accion_fidelizacion', '', 'oportunidad ' + n.id); UI.toast('Oportunidad de recompra <a href="#/crm/oportunidades/' + n.id + '" style="color:inherit;text-decoration:underline">' + n.id + '</a> creada para ' + esc(c.name) + '.'); App.render(); } });
    if (open.length) UI.confirm({ title: 'Cliente con oportunidades abiertas', message: esc(c.name) + ' ya tiene ' + open.length + ' oportunidad(es) abierta(s): ' + open.map(o => '<b>' + esc(o.id) + '</b>').join(', ') + '. ¿Crear otra de recompra?', confirmLabel: 'Crear igualmente', onConfirm: () => setTimeout(go, 0) });
    else go();
  }

  function surveyModal(preset) {
    if (!can('crm.clients.manage')) return deny('registrar encuestas');
    const resOpts = (cid) => DB.reservations.filter(r => r.clientId === cid && r.status !== 'cancelada' && mineOk(r)).map(r => [r.id, r.id + ' · ' + r.title]);
    const body = UI.form([
      { id: 'sv_client', label: 'Cliente', type: 'select', required: true, placeholder: 'Seleccione…', options: V.clients().map(c => [c.id, c.name]), value: preset.clientId, col: 6 },
      { id: 'sv_res', label: 'Reserva / viaje', type: 'select', placeholder: 'Sin reserva específica', options: preset.clientId ? resOpts(preset.clientId) : [], value: preset.resId, col: 6 },
      { id: 'sv_channel', label: 'Canal', type: 'select', options: ['Llamada', 'WhatsApp', 'Email', 'Encuesta web', 'Portal del cliente'], col: 6 },
      { type: 'html', col: 6, html: '' },
      { type: 'html', col: 12, html: '<div class="field"><label>¿Qué tan probable es que recomiende ' + esc(DB.tenant.short) + ' a un amigo o colega? <span class="req">*</span></label><div class="nps-scale" id="sv-scale">' + Array.from({ length: 11 }, (_, i) => '<button type="button" data-v="' + i + '" class="' + (i <= 6 ? 'd' : i <= 8 ? 'n' : 'p') + '">' + i + '</button>').join('') + '</div><div class="nps-legend"><span>Nada probable</span><span>Muy probable</span></div><input type="hidden" name="sv_score" id="sv_score"></div><div id="sv-warn" style="margin-top:10px"></div>' },
      { id: 'sv_comment', label: 'Comentario del cliente', type: 'textarea', rows: 3, col: 12, placeholder: 'Experiencia, puntos a mejorar, felicitaciones…' }
    ]);
    UI.modal({ title: 'Registrar encuesta NPS', sub: 'PROC-009 · Registrar experiencia', body,
      onOpen: (m) => {
        m.querySelector('#sv_client').onchange = (e) => { m.querySelector('#sv_res').innerHTML = '<option value="">Sin reserva específica</option>' + resOpts(e.target.value).map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join(''); };
        m.querySelectorAll('#sv-scale button').forEach(b => b.onclick = () => { m.querySelectorAll('#sv-scale button').forEach(x => x.classList.toggle('on', x === b)); m.querySelector('#sv_score').value = b.dataset.v; const v = +b.dataset.v; m.querySelector('#sv-warn').innerHTML = v <= 6 ? UI.alert('warn', '<b>Detractor (' + v + ').</b> Al guardar se generará automáticamente un caso de reclamo asignado al responsable del cliente y una actividad de seguimiento.') : v <= 8 ? UI.alert('info', 'Pasivo (' + v + '). Se recomienda una acción de fidelización.') : UI.alert('ok', 'Promotor (' + v + '). Candidato a programa de referidos.'); });
      },
      actions: [{ label: 'Cancelar' }, { label: 'Guardar encuesta', cls: 'primary', icon: 'check', onClick: (m) => {
        if (!UI.validate(m)) return false;
        const d = strip(UI.formData(m), 'sv_');
        if (d.score === '' || d.score == null) { UI.toast('Seleccione un puntaje de 0 a 10.', 'bad'); return false; }
        const score = +d.score; const c = Q.client(d.client);
        if (d.res && DB.surveys.some(s => s.resId === d.res)) { UI.toast('La reserva ' + d.res + ' ya tiene una encuesta registrada.', 'bad'); return false; }
        const sv = { id: nextId(DB.surveys, 'ENC-', 4), clientId: c.id, resId: d.res || null, score, comment: d.comment, channel: d.channel, date: nowStr(), by: Auth.user.id };
        DB.surveys.unshift(sv); const prev = c.nps; c.nps = score;
        Audit.log('Encuesta', sv.id, 'crear', '', 'NPS ' + score + ' · ' + c.id);
        Audit.log('Cliente', c.id, 'actualizar_nps', prev == null ? '' : String(prev), String(score));
        let msg = 'Encuesta ' + sv.id + ' registrada (NPS ' + score + ').';
        if (score <= 6) {
          const cl = { id: nextId(DB.claims, 'REC-', 4), clientId: c.id, resId: sv.resId, surveyId: sv.id, type: 'Reclamo', priority: score <= 3 ? 'alta' : 'media', subject: 'Detractor NPS ' + score + (sv.resId ? ' — ' + sv.resId : ''), desc: d.comment || 'Sin comentario registrado.', status: 'abierta', owner: c.owner, createdAt: nowStr(), resolution: '', log: [{ ts: nowStr(), u: Auth.user.id, m: 'Caso generado automáticamente por NPS ≤ 6 (encuesta ' + sv.id + ')' }] };
          DB.claims.unshift(cl);
          DB.activities.unshift({ id: nextId(DB.activities, 'ACT-', 4), type: 'Postventa', subject: 'Resolver ' + cl.id + ' — contactar a ' + c.name, relType: 'client', relId: c.id, owner: c.owner, due: addDays(TD(), 1) + ' 10:00', status: 'pendiente', result: '', createdAt: nowStr(), createdBy: Auth.user.id });
          Audit.log('Reclamo', cl.id, 'crear', 'encuesta ' + sv.id, 'abierta · ' + cl.priority);
          const ow = Q.user(c.owner); Notify.push('postventa.detractor', 'Email', ow ? ow.email : c.owner, 'Detractor NPS ' + score + ': ' + c.name + ' — caso ' + cl.id);
          msg += ' Se generó el caso ' + cl.id + '.';
        }
        Store.save(); UI.toast(msg, score <= 6 ? 'warn' : 'ok'); App.render();
      } }] });
  }

  function claimModal(preset) {
    if (!can('crm.clients.manage')) return deny('registrar reclamos');
    const resOpts = (cid) => DB.reservations.filter(r => r.clientId === cid && mineOk(r)).map(r => [r.id, r.id + ' · ' + r.title]);
    UI.modal({ title: 'Registrar reclamo o feedback', sub: 'PROC-009', body: UI.form([
      { id: 'rc_client', label: 'Cliente', type: 'select', required: true, placeholder: 'Seleccione…', options: V.clients().map(c => [c.id, c.name]), value: preset.clientId, col: 6 },
      { id: 'rc_res', label: 'Reserva', type: 'select', placeholder: 'Sin reserva', options: preset.clientId ? resOpts(preset.clientId) : [], col: 6 },
      { id: 'rc_type', label: 'Tipo', type: 'select', options: CLAIM_TYPES, col: 4 },
      { id: 'rc_priority', label: 'Prioridad', type: 'select', options: ['baja', 'media', 'alta', 'critica'].map(p => [p, statusLabel(p)]), value: 'media', col: 4 },
      { id: 'rc_owner', label: 'Responsable', type: 'select', required: true, options: ownerOpts(), value: Auth.user.id, col: 4 },
      { id: 'rc_subject', label: 'Asunto', required: true, col: 12 },
      { id: 'rc_desc', label: 'Descripción', type: 'textarea', rows: 3, required: true, col: 12 }
    ]), onOpen: (m) => { m.querySelector('#rc_client').onchange = (e) => { const c = Q.client(e.target.value); m.querySelector('#rc_res').innerHTML = '<option value="">Sin reserva</option>' + resOpts(e.target.value).map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join(''); if (c && !own()) m.querySelector('#rc_owner').value = c.owner; }; },
    actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const d = strip(UI.formData(m), 'rc_');
      const cl = { id: nextId(DB.claims, 'REC-', 4), clientId: d.client, resId: d.res || null, surveyId: null, type: d.type, priority: d.priority, subject: d.subject, desc: d.desc, status: ['Felicitación'].includes(d.type) ? 'cerrada' : 'abierta', owner: d.owner, createdAt: nowStr(), resolution: '', log: [{ ts: nowStr(), u: Auth.user.id, m: 'Registrado manualmente' }] };
      DB.claims.unshift(cl); Store.save(); Audit.log('Reclamo', cl.id, 'crear', d.type, cl.status + ' · ' + cl.priority);
      if (cl.owner !== Auth.user.id) Notify.push('postventa.caso', 'Portal', cl.owner, 'Caso ' + cl.id + ' asignado: ' + cl.subject);
      UI.toast(d.type + ' ' + cl.id + ' registrado.'); App.render();
    } }] });
  }

  function claimDrawer(cl) {
    const steps = ['Abierta', 'En proceso', 'Resuelta', 'Cerrada'];
    const idx = ['abierta', 'en_proceso', 'resuelta', 'cerrada'].indexOf(cl.status);
    const manage = can('crm.clients.manage') && (!own() || cl.owner === me() || canSeeClient(cl.clientId));
    const act = (label, to, needs) => ({ label, cls: to === 'resuelta' ? 'primary' : '', onClick: () => {
      if (!manage) return deny('gestionar reclamos');
      if (needs) {
        setTimeout(() => UI.modal({ title: label, size: 'sm', body: UI.form([{ id: 'cr_text', label: to === 'resuelta' ? 'Resolución aplicada' : 'Nota de seguimiento', type: 'textarea', rows: 3, required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const t = m.querySelector('#cr_text').value.trim(); const b4 = cl.status; if (to) { cl.status = to; if (to === 'resuelta') { cl.resolution = t; cl.resolvedAt = nowStr(); } } cl.log.push({ ts: nowStr(), u: Auth.user.id, m: (to ? statusLabel(to) + ': ' : 'Seguimiento: ') + t }); Store.save(); Audit.log('Reclamo', cl.id, to ? 'cambio_estado' : 'seguimiento', b4, (to || b4) + ' · ' + t.slice(0, 60)); UI.toast('Caso ' + cl.id + ' actualizado.'); App.render(); } }] }), 0);
        return;
      }
      const b4 = cl.status; cl.status = to; cl.log.push({ ts: nowStr(), u: Auth.user.id, m: 'Estado: ' + statusLabel(to) }); Store.save(); Audit.log('Reclamo', cl.id, 'cambio_estado', b4, to);
      if (to === 'cerrada') { const c = Q.client(cl.clientId); Notify.push('postventa.cierre', 'Email', c ? c.email : cl.clientId, 'Su caso ' + cl.id + ' ha sido cerrado'); }
      UI.toast('Caso ' + cl.id + ': ' + statusLabel(to) + '.'); App.render();
    } });
    const actions = [];
    if (cl.status === 'abierta') actions.push(act('Iniciar atención', 'en_proceso'));
    if (['abierta', 'en_proceso'].includes(cl.status)) { actions.push(act('Registrar seguimiento', null, true)); actions.push(act('Resolver', 'resuelta', true)); }
    if (cl.status === 'resuelta') actions.push(act('Cerrar caso', 'cerrada'));
    if (!actions.length) actions.push({ label: 'Cerrar' });
    UI.drawer({ title: esc(cl.subject), sub: cl.id + ' · ' + esc(cl.type), body: UI.flow(steps, cl.status === 'cerrada' ? 4 : idx) + '<div style="margin-top:16px">' + UI.dl([['Cliente', clientLink(cl.clientId)], ['Reserva', resLink(cl.resId)], ['Encuesta', cl.surveyId ? '<span class="mono">' + esc(cl.surveyId) + '</span>' : ''], ['Tipo', esc(cl.type)], ['Prioridad', UI.badge(cl.priority)], ['Estado', UI.badge(cl.status)], ['Responsable', UI.userChip(cl.owner)], ['Registrado', datetime(cl.createdAt)], ['Descripción', esc(cl.desc)], ['Resolución', esc(cl.resolution || '')]]) + '</div><div class="divider" style="margin:16px 0"></div><div class="upper" style="margin-bottom:8px">Bitácora</div>' + UI.timeline(cl.log.slice().reverse().map(x => ({ title: esc(x.m), meta: datetime(x.ts) + ' · ' + esc(Q.userName(x.u)), icon: 'history' }))) + (manage ? '' : UI.alert('warn', 'Su rol no puede gestionar casos de postventa.')),
      actions: manage ? actions : [{ label: 'Cerrar' }] });
  }
})();
