/* ==========================================================================
   Catálogo turístico — Productos (Product 360), asistente de alta, salidas y
   disponibilidad, tarifas/temporadas/pricing, servicios, proveedores, destinos,
   tipos y categorías. Especificación PRD (Productos Turísticos) + PROC-011 a PROC-020.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, date, dateShort, datetime, sum, toPEN, daysFromToday, addDays, nowStr, clone, pad, parseD, daysBetween } = Util;
  const T = () => window.TODAY;
  const ic = UI.icon;
  const can = (p) => Auth.can(p);
  const PERM = {
    view: 'catalog.products.view', create: 'catalog.products.create', update: 'catalog.products.update', activate: 'catalog.products.activate',
    rates: 'catalog.products.manage_rates', avail: 'catalog.products.manage_availability', profit: 'catalog.products.view_profitability',
    publish: 'catalog.products.publish', prov: 'catalog.providers.manage'
  };

  /* ---------------- Catálogos de valores ---------------- */
  const TYPES_ITIN = ['TOUR', 'EXCURSIÓN', 'PAQUETE', 'CIRCUITO', 'PROGRAMA TURÍSTICO'];
  const RATE_TYPES = ['Proveedor', 'Costo', 'Venta', 'Retail', 'B2B', 'Mayorista', 'Corporativa', 'VIP', 'Promocional', 'Especial', 'Grupal'];
  const SEGMENTS = ['Adulto', 'Niño', 'Infante', 'Pasajero', 'Grupo'];
  const RATE_CHANNELS = ['Directo', 'B2B', 'Corporativo', 'E-commerce', 'Mayorista', 'Todos'];
  const PRICE_BASIS = ['Por persona', 'Precio fijo', 'Por grupo', 'Por habitación', 'Por unidad'];
  const MODALITIES = ['Privado', 'Compartido', 'Grupal'];
  const DUR_UNITS = ['horas', 'días', 'noches'];
  const UNITS = ['pax', 'servicio', 'habitación', 'noche', 'vehículo', 'unidad'];
  const ITEM_TYPES = ['Traslado', 'Transporte', 'Tren', 'Hotel', 'Alimentación', 'Guía', 'Actividad', 'Entrada', 'Libre', 'Otro'];
  const REL_TYPES = ['Complementario', 'Alternativo', 'Upgrade', 'Cross-sell', 'Upsell'];
  const PROMO_KINDS = ['Precio promocional', 'Descuento fijo', 'Descuento %', 'Promoción por fecha', 'Descuento por cantidad', 'Promoción por temporada', 'Promoción por canal', 'Código promocional'];
  const SEASON_TYPES = ['Alta', 'Media', 'Baja', 'Feriado', 'Fecha especial', 'Personalizada'];
  const PROV_TYPES = ['Hotel', 'Transporte', 'Tren', 'Guía', 'Conductor', 'Restaurante', 'Operador', 'Actividad', 'Entrada', 'Otros'];
  const SVC_TYPES = ['Traslado', 'Transporte', 'Tren', 'Entrada', 'Guía', 'Alimentación', 'Alojamiento', 'Actividad', 'Tour', 'Seguro', 'Otro'];
  const REQ_CATS = ['Condición física', 'Documentos', 'Nacionalidad', 'Restricción', 'Recomendación', 'Equipamiento', 'Requisito especial'];
  const CH = [
    ['erp', 'ERP', 'Gestión interna del catálogo y operación.'],
    ['crm', 'CRM', 'Recomendaciones en oportunidades y Customer 360.'],
    ['quotes', 'Cotizaciones', 'Seleccionable en el cotizador por ventas.'],
    ['b2b', 'B2B', 'Visible para agencias asociadas con su lista de precios.'],
    ['portal', 'Portal cliente', 'Visible en el portal de autoservicio del cliente.'],
    ['portalPax', 'Portal pasajero', 'Itinerario y documentos del viaje del pasajero.'],
    ['cms', 'CMS', 'Ficha publicable en el sitio web.'],
    ['ecommerce', 'E-commerce', 'Compra en línea con pasarela de pagos.'],
    ['mobile', 'Mobile', 'Apps de operador y pasajero.']
  ];
  const AVAIL = [
    ['SIN_CONTROL', 'Sin control', 'No se controla inventario. Cada venta se confirma manualmente con el proveedor.'],
    ['CUPOS', 'Cupos', 'Cupo fijo por fecha pactado con el proveedor (allotment).'],
    ['CAPACIDAD', 'Capacidad', 'Capacidad máxima simultánea del servicio (aforo de taller, grupo o local).'],
    ['POR_PROVEEDOR', 'Por proveedor', 'El proveedor informa la disponibilidad por solicitud; requiere confirmación antes de reservar.'],
    ['POR_ACTIVIDAD', 'Por actividad', 'Aforo por actividad y turno horario.'],
    ['POR_TRANSPORTE', 'Por transporte', 'Limitada por vehículos y conductores disponibles en la fecha.'],
    ['POR_HABITACION', 'Por habitación', 'Inventario de habitaciones por noche y tipo de habitación.'],
    ['POR_SALIDA', 'Por salida programada', 'Cupos por salida con fecha y hora fijas: capacidad, vendidos, holds y disponibles.'],
    ['POR_FECHA', 'Por fecha', 'Cupo diario configurable por fecha de servicio.']
  ];
  const availLabel = (k) => (AVAIL.find(a => a[0] === k) || [k, k || '—'])[1];
  const DEST_LEVEL = { 'País': 0, 'Región': 1, 'Departamento': 2, 'Provincia': 3, 'Ciudad': 4, 'Zona': 4, 'Lugar': 5, 'Atracción': 6, 'Ruta': 6 };
  const DEST_ICON = { 'País': 'globe', 'Región': 'map', 'Departamento': 'map', 'Provincia': 'map', 'Ciudad': 'building', 'Zona': 'compass', 'Lugar': 'pin', 'Atracción': 'mountain', 'Ruta': 'route' };

  /* ---------------- Helpers de dominio ---------------- */
  const rateState = (r) => r.status === 'inactiva' ? 'inactiva' : (!r.validTo || r.validTo < T()) ? 'vencida' : (r.validFrom && r.validFrom > T()) ? 'programada' : 'vigente';
  const rateBadge = (r) => { const s = rateState(r); return s === 'programada' ? UI.badge('prueba', 'Programada') : UI.badge(s); };
  const mainRate = (p) => { const v = (p.rates || []).filter(r => rateState(r) === 'vigente'); return v.find(r => r.channel === 'Directo' && ['Adulto', 'Pasajero'].includes(r.segment)) || v.find(r => r.channel === 'Directo') || v[0] || null; };
  const shownRate = (p) => { const r = mainRate(p); return r && visRate(r) ? r : ((p.rates || []).filter(x => rateState(x) === 'vigente' && visRate(x))[0] || null); };
  const marginOf = (r) => r && r.price ? (r.price - r.cost) / r.price * 100 : null;
  const pct = (v) => v == null ? '—' : fmtN(v, 1) + '%';
  const svcOk = (s) => !!s && s.status === 'activo' && (!s.validTo || s.validTo >= T());
  const provActive = (pv) => !!pv && pv.status === 'activo' && (!pv.contractEnd || pv.contractEnd >= T());
  const provState = (pv) => !pv ? 'inactivo' : pv.status !== 'activo' ? pv.status : (pv.contractEnd && pv.contractEnd < T()) ? 'vencido' : 'activo';
  const compCostPEN = (c) => {
    if (c.productId) { const p2 = Q.product(c.productId); const r = p2 && mainRate(p2); return r ? toPEN(r.cost * c.qty, r.currency) : 0; }
    const s = Q.service(c.serviceId); return s ? toPEN(s.cost * c.qty, s.currency) : 0;
  };
  const compCost = (p) => sum(p.components || [], compCostPEN);
  const usage = (id) => ({ quotes: DB.quotes.filter(q => q.versions.some(v => v.items.some(i => i.productId === id))), res: DB.reservations.filter(r => r.services.some(s => s.productId === id)) });
  const futureDeps = (p) => (p.departures || []).filter(d => d.date >= T() && d.status !== 'cancelada');
  const ancestors = (id) => { const out = []; let d = Q.destination(id); let guard = 0; while (d && guard++ < 50) { out.push(d.id); d = d.parent ? Q.destination(d.parent) : null; } return out; };
  const inDest = (p, destId) => [p.destId].concat(p.secondary || []).filter(Boolean).some(x => ancestors(x).includes(destId));
  const allDeps = () => DB.products.flatMap(p => (p.departures || []).map(d => ({ d, p })));
  const findDep = (id) => allDeps().find(x => x.d.id === id);
  const held = (d) => sum((DB.catalogHolds || []).filter(h => h.depId === d.id && h.status === 'hold'), 'qty');
  const avail = (d) => d.status === 'cancelada' || d.status === 'cerrada' ? 0 : Math.max(0, d.capacity - d.sold - held(d));
  const provLink = (id) => !id ? '—' : Access.canRoute('catalogo/proveedores') ? '<a href="#/catalogo/proveedores/' + esc(id) + '">' + esc(Q.providerName(id)) + '</a>' : esc(Q.providerName(id));
  const docLink = (base, id) => Access.canRoute(base) ? '<a href="#/' + base + '/' + id + '">' + id + '</a>' : '<span class="mono">' + id + '</span>';
  const prodLink = (id) => '<a href="#/catalogo/productos/' + esc(id) + '">' + esc(Q.productName(id)) + '</a>';
  const svcLink = (id) => { const s = Q.service(id); return s ? '<a href="#/catalogo/servicios/' + esc(id) + '">' + esc(s.name) + '</a>' : esc(id); };
  const destLink = (id) => id ? '<a href="#/catalogo/destinos/' + esc(id) + '">' + esc(Q.destName(id)) + '</a>' : '—';
  const rerender = () => { const y = window.scrollY; App.render(); window.scrollTo(0, y); };
  const noPerm = (perm) => UI.toast('Su rol no tiene el permiso <b>' + esc(perm) + '</b>. La autorización real se valida en backend (PRD-T13 → 403).', 'bad');
  const guard = (perm, fn) => (...a) => can(perm) ? fn(...a) : noPerm(perm);
  const plusMin = (s, m) => { const d = parseD(s); d.setMinutes(d.getMinutes() + m); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const nextId = (prefix, arr, width) => { const n = Math.max(0, ...arr.map(x => parseInt(String(x.id || x).replace(/\D/g, ''), 10) || 0)) + 1; return prefix + String(n).padStart(width, '0'); };
  const guideName = (id) => (Q.guide(id) || {}).name;
  const vehLabel = (id) => { const v = Q.vehicle(id); return v ? v.plate + ' · ' + v.type : null; };
  const tbl = (head, rows, cls) => '<div class="tbl-wrap"><table class="tbl ' + (cls || '') + '"><thead><tr>' + head.map(h => { const [l, a] = Array.isArray(h) ? h : [h, '']; return '<th class="' + a + '">' + esc(l) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  const readOnlyNote = (perm) => can(perm) ? '' : UI.alert('info', 'Modo consulta: su rol (' + esc(Q.roleName(Auth.role)) + ') no tiene el permiso <span class="mono">' + esc(perm) + '</span>; las acciones de edición no se muestran.' + (roleMode() ? ' <span class="xs faint">Perfil: ' + esc(roleMode()) + '.</span>' : ''));
  /* Acciones sin permiso: se ocultan (data-noperm → display:none). El guard() igualmente bloquea con toast si se invoca por otra vía. */
  const NP = ' disabled data-noperm title="Acción no disponible para su rol"';
  const dis = (perm) => can(perm) ? '' : ' disabled data-noperm title="Requiere permiso ' + perm + '"';
  /* Visibilidad de datos sensibles por rol (BRIEF_ROLES §2):
     - costo de proveedor: gestión de catálogo, operaciones (disponibilidad/proveedores) y finanzas (rentabilidad)
     - margen / utilidad: solo catalog.products.view_profitability (Finanzas, Manager, Admin)
     - tarifas netas B2B / costo: quien tarifa o ve rentabilidad (Ventas y Operaciones ven solo tarifas de venta) */
  const SEE = {
    cost: () => can(PERM.profit) || can(PERM.avail) || can(PERM.prov) || can(PERM.update) || can(PERM.rates),
    margin: () => can(PERM.profit),
    net: () => can(PERM.profit) || can(PERM.rates) || Auth.can('channels.b2b.manage'),
    audit: () => can(PERM.update) || can(PERM.profit) || Auth.can('admin.audit.view')
  };
  const NET_TYPES = ['Proveedor', 'Costo', 'B2B', 'Mayorista'];
  const visRate = (r) => SEE.net() || (!NET_TYPES.includes(r.type) && !['B2B', 'Mayorista'].includes(r.channel));
  const visRates = (p) => (p.rates || []).filter(visRate);
  const cols = (arr) => arr.filter(c => c && !c.hide);
  const roleMode = () => { const r = Auth.role; return r === 'sales' ? 'Ventas · consulta de oferta y tarifas de venta' : r === 'operations' ? 'Operaciones · disponibilidad, salidas y proveedores' : r === 'finance' ? 'Finanzas · costos y rentabilidad en solo lectura' : r === 'accounting' ? 'Contabilidad · solo lectura' : ''; };
  const on = (root, sel, fn) => root.querySelectorAll(sel).forEach(b => { b.onclick = (e) => fn(b, e); });
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const defaultPolicies = () => ({ cancel: 'Sin penalidad hasta 15 días antes. 50% entre 14 y 7 días. 100% dentro de 7 días o no-show.', modify: 'Cambios de fecha sin costo hasta 10 días antes, sujetos a disponibilidad y diferencia tarifaria.', noshow: 'No-show se factura al 100%.', penalties: 'Penalidades según cronograma de cancelación; gastos de emisión no reembolsables.', refund: 'Reembolsos en 7–15 días hábiles por el mismo medio de pago.', dateChange: 'Un cambio de fecha sin costo por reserva, con 10 días de anticipación.', advanceMin: '48 horas', advanceMax: '365 días' });
  const snap = (p) => clone({ name: p.name, type: p.type, category: p.category, subcategory: p.subcategory, destId: p.destId, durationValue: p.durationValue, durationUnit: p.durationUnit, modality: p.modality, mainProviderId: p.mainProviderId, components: p.components || [], itinerary: p.itinerary || [], rates: p.rates || [], policies: p.policies || {}, inclusions: p.inclusions || [], exclusions: p.exclusions || [], markupPct: p.markupPct });

  /* Campo select con opciones deshabilitables y grupos (UI.form no las soporta) */
  const optH = (val) => (o) => '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val == null ? '' : val) ? ' selected' : '') + (o.dis ? ' disabled' : '') + '>' + esc(o.l) + '</option>';
  const selField = (id, label, opts, val, { required, placeholder, col = 6, hint } = {}) => ({ type: 'html', col, html: '<div class="field"><label for="' + id + '">' + esc(label) + (required ? ' <span class="req">*</span>' : '') + '</label><select class="input" id="' + id + '" name="' + id + '">' + (placeholder != null ? '<option value="">' + esc(placeholder) + '</option>' : '') + opts.map(o => o.group ? '<optgroup label="' + esc(o.group) + '">' + o.items.map(optH(val)).join('') + '</optgroup>' : optH(val)(o)).join('') + '</select>' + (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>' });

  /* Modal de formulario genérico. onSave(data, modal) → false mantiene abierto. check(modal) corre antes de UI.validate. */
  function formModal({ title, sub, fields, size, saveLabel = 'Guardar', onSave, pre = '', extra = '', check, onOpen }) {
    return UI.modal({ title, sub, size: size || '', body: pre + UI.form(fields) + extra, onOpen,
      actions: [{ label: 'Cancelar' }, { label: saveLabel, cls: 'primary', onClick: (m) => { if (check && check(m) === false) return false; if (!UI.validate(m)) return false; return onSave(UI.formData(m), m); } }] });
  }
  const markErr = (m, id) => { const el = m.querySelector('#' + id); if (el) el.classList.add('err'); };

  /* ---------------- Estilos del módulo (solo variables de tema) ---------------- */
  function css() {
    if (document.getElementById('css-catalogo')) return;
    const s = document.createElement('style'); s.id = 'css-catalogo';
    s.textContent = [
      '.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}',
      '.pcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;color:inherit;text-decoration:none;min-width:0}',
      '.pcard:hover{border-color:var(--accent);text-decoration:none}',
      '.pcard .thumb{border-radius:0}',
      '.pcard .pc-b{padding:11px 13px 13px;display:flex;flex-direction:column;gap:7px;flex:1}',
      '.pcard .pc-price{font-family:var(--f-display);font-weight:600;font-size:1.02rem;font-variant-numeric:tabular-nums}',
      '.cat-fbar{border-bottom:0}',
      '.cat-fbar .search-in{min-width:220px;flex:1 1 220px}',
      '.cat-fbar select.input{width:auto;max-width:210px}',
      '#prod-table .dt-bar .search-in{display:none}',
      '.chk-row{display:flex;gap:11px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed var(--line-2)}',
      '.chk-row:last-child{border-bottom:0}',
      '.chk-ico{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none}',
      '.chk-ico svg{width:13px;height:13px}',
      '.chk-ico.ok{background:var(--ok-soft);color:var(--ok)} .chk-ico.bad{background:var(--bad-soft);color:var(--bad)}',
      '.p-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:14px}',
      '.p-stats>div{border:1px solid var(--line-2);border-radius:8px;padding:9px 11px;background:var(--surface-2);min-width:0}',
      '.p-stats .pv{font-family:var(--f-display);font-weight:600;font-size:1.02rem;font-variant-numeric:tabular-nums;margin-top:2px;overflow-wrap:anywhere}',
      '.p360-top{grid-template-columns:minmax(0,280px) minmax(0,1fr);align-items:start}',
      '@media (max-width:900px){.p360-top{grid-template-columns:minmax(0,1fr)}}',
      '.stl{display:flex;flex-direction:column;gap:6px}',
      '.stl-row{display:grid;grid-template-columns:210px minmax(0,1fr);gap:10px;align-items:center}',
      '.stl-name{font-size:.78rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stl-track{position:relative;height:24px;background:var(--surface-2);border:1px solid var(--line-2);border-radius:5px}',
      '.stl-bar{position:absolute;top:2px;bottom:2px;border-radius:4px;font-size:.66rem;font-weight:600;display:flex;align-items:center;padding:0 5px;overflow:hidden;white-space:nowrap;min-width:6px;background:var(--accent-soft);color:var(--accent);border-left:3px solid var(--accent)}',
      '.stl-bar.t-Alta{background:var(--sun-soft);color:var(--sun);border-color:var(--sun)} .stl-bar.t-Media{background:var(--info-soft);color:var(--info);border-color:var(--info)} .stl-bar.t-Feriado{background:var(--bad-soft);color:var(--bad);border-color:var(--bad)} .stl-bar.t-Fecha.especial,.stl-bar.t-esp{background:var(--violet-soft);color:var(--violet);border-color:var(--violet)} .stl-bar.off{opacity:.45}',
      '.stl-today{position:absolute;top:-5px;bottom:-5px;width:2px;background:var(--bad);z-index:2}',
      '.stl-months{position:relative;height:18px;font-size:.66rem;color:var(--fg-3)}',
      '.stl-months span{position:absolute;top:0;transform:translateX(2px);white-space:nowrap}',
      '.stl-grid{position:absolute;top:0;bottom:0;width:1px;background:var(--line-2)}',
      '@media (max-width:640px){.stl-row{grid-template-columns:96px minmax(0,1fr)}}',
      '.opt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}',
      '.opt{border:1px solid var(--line);border-radius:8px;padding:9px 11px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:center;background:var(--surface);font-size:.84rem;text-align:left}',
      '.opt:hover{border-color:var(--accent)} .opt.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600}',
      '.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}',
      '.gal-it{display:flex;flex-direction:column;gap:6px}',
      '.serp{border:1px solid var(--line-2);border-radius:8px;padding:12px 14px;background:var(--surface-2)}',
      '.serp .st{color:var(--info);font-size:1rem;font-weight:500} .serp .su{color:var(--ok);font-size:.76rem} .serp .sd{color:var(--fg-2);font-size:.8rem;margin-top:2px}',
      '.day-h{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}',
      '.day-n{width:34px;height:34px;border-radius:9px;background:var(--accent);color:var(--accent-fg);display:grid;place-items:center;font-weight:700;font-size:.8rem;flex:none}',
      'tr.changed td{background:var(--warn-soft)}',
      '.avm{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}',
      '.avm label{border:1px solid var(--line);border-radius:9px;padding:10px 12px;display:flex;gap:9px;align-items:flex-start;cursor:pointer;background:var(--surface)}',
      '.avm label.on{border-color:var(--accent);background:var(--accent-soft)}',
      '.avm input{margin-top:3px;accent-color:var(--accent)}',
      '.cal-ev{display:block;width:100%;border:0;text-align:left;font:inherit;font-size:.7rem}',
      '.cal-d .dn{font-weight:600}',
      '.tree-box{max-height:640px;overflow:auto}',
      '.tree .node .xs{margin-left:4px}',
      '.wiz-body{min-height:260px}',
      '.chk-scroll{max-height:220px;overflow:auto;border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}',
      '.mini-form{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;align-items:end;padding:12px;border:1px dashed var(--line);border-radius:9px;background:var(--surface-2)}',
      '.mini-form>.c2{grid-column:span 2}.mini-form>.c3{grid-column:span 3}.mini-form>.c4{grid-column:span 4}.mini-form>.c5{grid-column:span 5}.mini-form>.c6{grid-column:span 6}.mini-form>.c12{grid-column:span 12}',
      '@media (max-width:760px){.mini-form>*{grid-column:span 12!important}}',
      '.stars{color:var(--sun);letter-spacing:1px;white-space:nowrap}',
      '.list-plain{margin:0;padding-left:18px;display:grid;gap:4px;font-size:.84rem}',
      '.li-row{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line-2);font-size:.84rem}',
      '.li-row:last-child{border-bottom:0}',
      '.page .stack{align-content:start}',
      '.tbl td.num{white-space:nowrap}',
      '[data-noperm]{display:none!important}',
      '#p360-tabs,#sl-tabs,#tf-tabs,#prod-body,#prod-table,#sv-t,#pv-t,.tab-body{min-width:0}'
    ].concat(BK_CSS).join('\n');
    document.head.appendChild(s);
  }
  const stars = (r) => { const n = Math.round(r || 0); return '<span class="stars" title="' + fmtN(r, 1) + ' / 5">' + '★★★★★'.slice(0, n) + '<span class="faint">' + '★★★★★'.slice(0, 5 - n) + '</span></span> <span class="small num">' + fmtN(r, 1) + '</span>'; };

  /* ---------------- Inicialización de estructuras propias del módulo ---------------- */
  function ensure() {
    let ch = false;
    if (!DB.catalogHolds) {
      DB.catalogHolds = [
        { id: 'HLD-0001', depId: 'SAL-0103', qty: 2, ref: 'COT-2026-00188', status: 'hold', createdAt: T() + ' 08:50', expiresAt: T() + ' 23:50', user: 'U03', notes: 'Bloqueo mientras el cliente aprueba la cotización' },
        { id: 'HLD-0002', depId: 'SAL-0403', qty: 4, ref: 'B2B Mundo Andino Tours', status: 'hold', createdAt: T() + ' 00:05', expiresAt: T() + ' 00:35', user: 'U13', notes: 'Hold desde portal B2B' },
        { id: 'HLD-0003', depId: 'SAL-0404', qty: 2, ref: 'WEB-10433', status: 'confirmada', createdAt: '2026-09-28 22:10', expiresAt: '2026-09-28 22:40', user: 'Sistema', notes: 'Pedido e-commerce' },
        { id: 'HLD-0004', depId: 'SAL-0105', qty: 3, ref: 'COT-2026-00190', status: 'liberada', createdAt: '2026-09-27 10:00', expiresAt: '2026-09-27 10:30', user: 'U04', notes: 'Cliente cambió de fecha' },
        { id: 'HLD-0005', depId: 'SAL-0101', qty: 2, ref: 'RES-2026-000347', status: 'confirmada', createdAt: '2026-08-28 14:12', expiresAt: '2026-08-28 14:42', user: 'U03', notes: 'Keller — MAPI' }
      ]; ch = true;
    }
    if (!DB.pricingRules) {
      DB.pricingRules = [
        { id: 'PR-01', name: 'Markup estándar retail', kind: 'Markup %', value: 25, scope: 'Canal Directo / E-commerce', status: 'activa' },
        { id: 'PR-02', name: 'Markup mayorista B2B', kind: 'Markup %', value: 16, scope: 'Canal B2B', status: 'activa' },
        { id: 'PR-03', name: 'IGV servicios a domiciliados', kind: 'Impuesto %', value: 18, scope: 'Clientes domiciliados en Perú', status: 'activa' },
        { id: 'PR-04', name: 'Exportación de servicios', kind: 'Impuesto %', value: 0, scope: 'Pasajeros no domiciliados', status: 'activa' },
        { id: 'PR-05', name: 'Descuento por ocupación 10+ pax', kind: 'Descuento %', value: 5, scope: 'Ocupación ≥ 10 pasajeros', status: 'activa' },
        { id: 'PR-06', name: 'Redondeo comercial', kind: 'Redondeo', value: 0.1, scope: 'Todos los canales', status: 'activa' },
        { id: 'PR-07', name: 'Comisión vendedor', kind: 'Comisión %', value: 3, scope: 'Ventas directas', status: 'activa' },
        { id: 'PR-08', name: 'Precio mínimo MAPI Full Day', kind: 'Precio mínimo', value: 300, scope: 'PRD-001 · USD por pax', status: 'activa' }
      ]; ch = true;
    }
    DB.products.forEach(p => {
      if (!p.seasons) { p.seasons = []; ch = true; }
      if (!p.channels) { p.channels = { erp: true }; ch = true; }
      if (p.channels.portalPax === undefined) { p.channels.portalPax = !!p.channels.portal; ch = true; }
      if (!p.createdAt) { p.createdAt = ((p.versions || [])[0] || {}).date || T(); p.updatedAt = ((p.versions || [])[(p.versions || []).length - 1] || {}).date || p.createdAt; ch = true; }
      if (!p.policies) { p.policies = defaultPolicies(); ch = true; }
      if (p.policies.penalties === undefined) { p.policies.penalties = 'Según cronograma de cancelación; gastos de emisión de entradas y boletos no reembolsables.'; p.policies.dateChange = 'Un cambio de fecha sin costo por reserva con 10 días de anticipación; luego aplica diferencia tarifaria.'; ch = true; }
      if (!p.gallery) { p.gallery = [{ hue: p.hue || 190, label: 'Portada', main: true }, { hue: ((p.hue || 190) + 28) % 360, label: 'Recorrido' }, { hue: ((p.hue || 190) + 320) % 360, label: 'Detalle del servicio' }]; ch = true; }
      if (!p.availCfg) { p.availCfg = { capacity: p.maxPax || '', source: 'interna' }; ch = true; }
      ['related', 'b2b', 'promotions', 'faqs', 'departures', 'components', 'itinerary', 'inclusions', 'exclusions', 'requirements', 'rates', 'versions'].forEach(k => { if (!p[k]) { p[k] = []; ch = true; } });
      if (!p.seo) { p.seo = { title: '', description: '', slug: '' }; ch = true; }
      (p.versions || []).forEach((v, i, arr) => {
        if (v.snapshot && typeof v.snapshot === 'object') return;
        const s = snap(p); const back = arr.length - 1 - i;
        if (v.status === 'histórica' && back > 0) { s.rates.forEach(r => { r.price = Math.round(r.price * (1 - 0.03 * back)); }); if (back > 1 && s.components.length > 2) s.components.pop(); if (back > 1) s.name = s.name; }
        v.snapshot = s; ch = true;
      });
    });
    if (ch) Store.save();
  }

  /* ==========================================================================
     LISTADO DE PRODUCTOS (tarjetas / tabla)
     ========================================================================== */
  const LS = { view: (() => { try { return localStorage.getItem('qhapaq_cat_view') || 'cards'; } catch (e) { return 'cards'; } })(), q: '', f: { type: '', cat: '', status: '', dest: '', ch: '' } };
  const PSTATUS = ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'];
  const destOptions = () => { const out = []; const walk = (parent, depth) => DB.destinations.filter(d => (d.parent || null) === parent).forEach(d => { out.push([d.id, '  '.repeat(depth) + d.name + ' (' + d.type + ')']); walk(d.id, depth + 1); }); walk(null, 0); return out; };

  App.register('catalogo', () => { location.replace('#/catalogo/productos'); });

  App.register('catalogo/productos', (el, params) => {
    ensure(); css();
    if (params[0]) return product360(el, params[0], params[1], params[2]);
    const ps = DB.products;
    const active = ps.filter(p => p.status === 'ACTIVE');
    const review = ps.filter(p => p.status === 'REVIEW');
    const withDeps = ps.filter(p => futureDeps(p).length);
    const margins = active.map(p => marginOf(mainRate(p))).filter(x => x != null); const M = SEE.margin();
    const avgM = margins.length ? sum(margins, x => x) / margins.length : 0;
    const sel = (k, label, opts) => '<select class="input sm" data-lf="' + k + '" aria-label="' + esc(label) + '"><option value="">' + esc(label) + ': todos</option>' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (LS.f[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: 'Productos turísticos', subtitle: 'Oferta comercial del tenant utilizada por CRM, cotizaciones, reservas, operaciones, B2B y e-commerce. Producto = definición comercial; servicio = componente operativo del proveedor.', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Productos']],
        actions: '<a class="btn" href="#/catalogo/categorias">' + ic('layers') + 'Tipos y categorías</a>' + (can(PERM.create) ? '<a class="btn primary" href="#/catalogo/productos/nuevo">' + ic('plus') + 'Nuevo producto</a>' : '') }) +
      '<div class="grid g4">' +
        UI.kpi({ label: 'Productos activos', value: active.length, sub: 'de ' + ps.length + ' en catálogo', tone: 'ok', icon: 'box' }) +
        UI.kpi({ label: 'En revisión', value: review.length, sub: ps.filter(p => p.status === 'DRAFT').length + ' en borrador', tone: 'sun', icon: 'clipboard' }) +
        UI.kpi({ label: 'Con salidas programadas', value: withDeps.length, sub: sum(withDeps, p => futureDeps(p).length) + ' salidas futuras', tone: 'info', icon: 'calendar' }) +
        (M ? UI.kpi({ label: 'Margen promedio', value: pct(avgM), sub: 'Tarifa directa vigente · activos', tone: 'violet', icon: 'percent' }) : UI.kpi({ label: 'Reservables hoy', value: active.filter(p => p.flags && p.flags.bookable).length, sub: 'activos con reserva habilitada', tone: 'violet', icon: 'check' })) +
      '</div>' +
      '<div class="card"><div class="dt-bar cat-fbar"><div class="search-in grow" style="max-width:300px">' + ic('search') + '<input class="input sm" type="search" id="lf-q" placeholder="Buscar nombre, código, SKU, destino…" value="' + esc(LS.q) + '" aria-label="Buscar productos"></div>' +
        sel('type', 'Tipo', DB.productTypes.map(t => [t, t])) + sel('cat', 'Categoría', DB.categories.map(c => [c.name, c.name])) + sel('status', 'Estado', PSTATUS.map(s => [s, UI.statusLabel(s)])) + sel('dest', 'Destino', destOptions()) + sel('ch', 'Canal', CH.map(c => [c[0], c[1]])) +
        '<div class="grow"></div><div class="btn-group" role="group" aria-label="Vista"><button class="btn sm' + (LS.view === 'cards' ? ' on' : '') + '" data-view="cards">' + ic('grid') + 'Tarjetas</button><button class="btn sm' + (LS.view === 'table' ? ' on' : '') + '" data-view="table">' + ic('list') + 'Tabla</button></div></div></div>' +
      '<div id="prod-body"></div></div>';
    const body = el.querySelector('#prod-body');
    const filtered = () => ps.filter(p => {
      const q = LS.q.toLowerCase();
      if (q && !(p.name + ' ' + p.code + ' ' + p.sku + ' ' + p.id + ' ' + Q.destPath(p.destId)).toLowerCase().includes(q)) return false;
      const f = LS.f;
      if (f.type && p.type !== f.type) return false;
      if (f.cat && p.category !== f.cat) return false;
      if (f.status && p.status !== f.status) return false;
      if (f.dest && !inDest(p, f.dest)) return false;
      if (f.ch && !(p.channels || {})[f.ch]) return false;
      return true;
    });
    let dt = null;
    const draw = () => {
      if (LS.view === 'table') {
        if (dt) { dt.redraw(); return; }
        body.id = 'prod-table';
        dt = UI.dataTable(body, { exportName: 'productos', rows: filtered, onRow: (p) => App.go('#/catalogo/productos/' + p.id), defaultSort: 'name', pageSize: 15,
          columns: cols([
            { key: 'name', label: 'Producto', render: p => '<div class="cell-main">' + esc(p.name) + '</div><div class="cell-sub mono">' + esc(p.code) + ' · ' + esc(p.sku) + '</div>' },
            { key: 'type', label: 'Tipo', render: p => '<span class="tag">' + esc(p.type) + '</span>' },
            { key: 'category', label: 'Categoría', render: p => esc(p.category) + '<div class="cell-sub">' + esc(p.subcategory || '') + '</div>' },
            { key: 'destId', label: 'Destino', render: p => esc(Q.destName(p.destId)), sortVal: p => Q.destName(p.destId), csv: p => Q.destPath(p.destId) },
            { key: 'durationValue', label: 'Duración', render: p => p.durationValue + ' ' + esc(p.durationUnit), csv: p => p.durationValue + ' ' + p.durationUnit },
            { key: 'price', label: 'Desde', align: 'num', render: p => { const r = shownRate(p); return r ? money(r.price, r.currency) : '<span class="faint">Sin tarifa</span>'; }, sortVal: p => { const r = shownRate(p); return r ? toPEN(r.price, r.currency) : -1; }, csv: p => { const r = shownRate(p); return r ? r.currency + ' ' + r.price : ''; } },
            { key: 'margin', label: 'Margen', align: 'num', hide: !M, render: p => pct(marginOf(mainRate(p))), sortVal: p => marginOf(mainRate(p)) || -1, csv: p => fmtN(marginOf(mainRate(p)) || 0, 1) },
            { key: 'deps', label: 'Salidas', align: 'num', render: p => futureDeps(p).length || '<span class="faint">—</span>', sortVal: p => futureDeps(p).length, csv: p => futureDeps(p).length },
            { key: 'chs', label: 'Canales', render: p => CH.filter(c => p.channels[c[0]]).length + '/9', sortVal: p => CH.filter(c => p.channels[c[0]]).length, csv: p => CH.filter(c => p.channels[c[0]]).map(c => c[1]).join(', ') },
            { key: 'status', label: 'Estado', render: p => UI.badge(p.status) }
          ]) });
      } else {
        dt = null; body.id = 'prod-body';
        const rows = filtered();
        body.innerHTML = rows.length ? '<div class="cat-grid">' + rows.map(p => {
          const r = shownRate(p); const m = marginOf(r); const fl = p.flags || {};
          return '<a class="pcard" href="#/catalogo/productos/' + p.id + '">' + UI.thumb(p, 118) + '<div class="pc-b">' +
            '<div class="row between" style="flex-wrap:nowrap;gap:6px"><span class="mono xs faint">' + esc(p.code) + '</span>' + UI.badge(p.status) + '</div>' +
            '<div class="row" style="gap:6px"><span class="tag">' + esc(p.type) + '</span><span class="xs faint">' + esc(p.category) + ' · ' + esc(p.subcategory || '') + '</span></div>' +
            '<div class="xs muted row" style="gap:5px;flex-wrap:nowrap">' + ic('pin') + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(Q.destPath(p.destId)) + '</span></div>' +
            '<div class="xs muted">' + p.durationValue + ' ' + esc(p.durationUnit) + ' · ' + esc(p.modality) + ' · ' + p.minPax + '–' + p.maxPax + ' pax</div>' +
            '<div class="row between" style="margin-top:auto;align-items:flex-end"><div><div class="xs faint">Desde</div><div class="pc-price">' + (r ? money(r.price, r.currency, 0) : '<span class="faint small">Sin tarifa vigente</span>') + '</div></div>' + (M ? '<div class="right"><div class="xs faint">Margen</div><b class="small num">' + pct(m) + '</b></div>' : '') + '</div>' +
            '<div class="chip-row">' + [['bookable', 'Reservable'], ['quoteable', 'Cotizable'], ['b2b', 'B2B'], ['ecommerce', 'E-commerce'], ['featured', 'Destacado']].filter(f => fl[f[0]]).map(f => '<span class="tag">' + f[1] + '</span>').join('') + (futureDeps(p).length ? '<span class="tag">' + futureDeps(p).length + ' salidas</span>' : '') + '</div>' +
            '</div></a>';
        }).join('') + '</div>' : UI.card('', UI.empty('No hay productos que coincidan con los filtros.', 'search'));
      }
    };
    el.querySelector('#lf-q').addEventListener('input', Util.debounce(e => { LS.q = e.target.value; draw(); }, 150));
    el.querySelectorAll('[data-lf]').forEach(s => s.onchange = () => { LS.f[s.dataset.lf] = s.value; draw(); });
    on(el, '[data-view]', (b) => { LS.view = b.dataset.view; try { localStorage.setItem('qhapaq_cat_view', LS.view); } catch (e) { } el.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b)); dt = null; body.innerHTML = ''; draw(); });
    draw();
  });

  /* ==========================================================================
     TIPOS DE PRODUCTO Y CATEGORÍAS (§3, §4)
     ========================================================================== */
  App.register('catalogo/categorias', (el) => {
    ensure(); css();
    const cnt = (f) => DB.products.filter(f).length;
    const canE = can(PERM.update);
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Tipos y categorías de producto', subtitle: 'Catálogos configurables por tenant (§3 y §4 de la especificación). Un tipo o categoría en uso no puede eliminarse; los productos conservan su clasificación histórica.', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Productos', '#/catalogo/productos'], ['Tipos y categorías']] }) +
      readOnlyNote(PERM.update) +
      '<div class="grid g2">' +
        UI.card('Tipos de producto', '<div class="list">' + DB.productTypes.map(t => { const n = cnt(p => p.type === t); return '<div class="list-item"><div class="ico-box">' + ic('tag') + '</div><div class="grow"><b class="small">' + esc(t) + '</b><div class="xs faint">' + (TYPES_ITIN.includes(t) ? 'Requiere itinerario para activarse' : 'Itinerario opcional') + '</div></div><button class="btn xs ghost" data-ftype="' + esc(t) + '">' + n + ' producto' + (n === 1 ? '' : 's') + '</button><button class="btn xs ghost icon" data-deltype="' + esc(t) + '" title="Eliminar tipo"' + (canE ? '' : NP) + '>' + ic('trash') + '</button></div>'; }).join('') + '</div>', { tight: true, sub: DB.productTypes.length + ' tipos configurados', actions: '<button class="btn sm primary" id="add-type"' + dis(PERM.update) + '>' + ic('plus') + 'Nuevo tipo</button>' }) +
        UI.card('Categorías y subcategorías', '<div class="list">' + DB.categories.map(c => { const n = cnt(p => p.category === c.name); return '<div class="list-item" style="align-items:flex-start"><div class="ico-box violet">' + ic('layers') + '</div><div class="grow"><div class="row between"><b class="small">' + esc(c.name) + '</b><span class="row" style="gap:4px"><button class="btn xs ghost" data-fcat="' + esc(c.name) + '">' + n + ' producto' + (n === 1 ? '' : 's') + '</button><button class="btn xs" data-addsub="' + c.id + '"' + (canE ? '' : NP) + '>' + ic('plus') + 'Subcategoría</button><button class="btn xs ghost icon" data-delcat="' + c.id + '" title="Eliminar categoría"' + (canE ? '' : NP) + '>' + ic('trash') + '</button></span></div><div class="chip-row" style="margin-top:6px">' + c.subs.map(s => { const m = cnt(p => p.category === c.name && p.subcategory === s); return '<span class="tag">' + esc(s) + ' <b>' + m + '</b>' + (canE ? ' <button class="btn xs ghost icon" style="height:18px;width:18px" data-delsub="' + c.id + '|' + esc(s) + '" title="Eliminar subcategoría">' + ic('x') + '</button>' : '') + '</span>'; }).join('') + '</div></div></div>'; }).join('') + '</div>', { tight: true, sub: DB.categories.length + ' categorías · ' + sum(DB.categories, c => c.subs.length) + ' subcategorías', actions: '<button class="btn sm primary" id="add-cat"' + dis(PERM.update) + '>' + ic('plus') + 'Nueva categoría</button>' }) +
      '</div></div>';
    const goFilter = (k, v) => { LS.f = { type: '', cat: '', status: '', dest: '', ch: '' }; LS.f[k] = v; App.go('#/catalogo/productos'); };
    on(el, '[data-ftype]', b => goFilter('type', b.dataset.ftype));
    on(el, '[data-fcat]', b => goFilter('cat', b.dataset.fcat));
    const addType = el.querySelector('#add-type'); if (addType) addType.onclick = guard(PERM.update, () => formModal({ title: 'Nuevo tipo de producto', size: 'sm', fields: [{ id: 'name', label: 'Nombre del tipo', required: true, col: 12, placeholder: 'p. ej. CRUCERO FLUVIAL' }, { id: 'itin', type: 'switch', label: 'Requiere itinerario para activarse', col: 12 }], onSave: (d) => { const t = d.name.toUpperCase(); if (DB.productTypes.includes(t)) { UI.toast('El tipo ya existe.', 'bad'); return false; } DB.productTypes.push(t); if (d.itin) TYPES_ITIN.push(t); Audit.log('Catálogo', 'productTypes', 'crear_tipo', '', t); Store.save(); UI.toast('Tipo ' + esc(t) + ' creado.'); rerender(); } }));
    on(el, '[data-deltype]', guard(PERM.update, (b) => { const t = b.dataset.deltype; const n = cnt(p => p.type === t); if (n) { UI.toast('No se puede eliminar: ' + n + ' producto(s) usan el tipo ' + esc(t) + '. Los productos históricos conservan su clasificación.', 'bad'); return; } UI.confirm({ title: 'Eliminar tipo', message: '¿Eliminar el tipo <b>' + esc(t) + '</b>? No tiene productos asociados.', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { DB.productTypes.splice(DB.productTypes.indexOf(t), 1); Audit.log('Catálogo', 'productTypes', 'eliminar_tipo', t, ''); Store.save(); UI.toast('Tipo eliminado.'); rerender(); } }); }));
    const addCat = el.querySelector('#add-cat'); if (addCat) addCat.onclick = guard(PERM.update, () => formModal({ title: 'Nueva categoría', size: 'sm', fields: [{ id: 'name', label: 'Nombre', required: true, col: 12, placeholder: 'p. ej. Bienestar' }, { id: 'subs', type: 'textarea', label: 'Subcategorías (una por línea)', col: 12, placeholder: 'Spa andino\nYoga y meditación' }], onSave: (d) => { if (DB.categories.some(c => c.name.toLowerCase() === d.name.toLowerCase())) { UI.toast('La categoría ya existe.', 'bad'); return false; } const c = { id: nextId('CAT-', DB.categories, 1), name: d.name, subs: d.subs.split('\n').map(s => s.trim()).filter(Boolean) }; DB.categories.push(c); Audit.log('Catálogo', c.id, 'crear_categoria', '', c.name); Store.save(); UI.toast('Categoría creada.'); rerender(); } }));
    on(el, '[data-addsub]', guard(PERM.update, (b) => { const c = DB.categories.find(x => x.id === b.dataset.addsub); formModal({ title: 'Nueva subcategoría — ' + esc(c.name), size: 'sm', fields: [{ id: 'name', label: 'Nombre', required: true, col: 12 }], onSave: (d) => { if (c.subs.includes(d.name)) { UI.toast('Ya existe.', 'bad'); return false; } c.subs.push(d.name); Audit.log('Catálogo', c.id, 'crear_subcategoria', '', d.name); Store.save(); UI.toast('Subcategoría agregada.'); rerender(); } }); }));
    on(el, '[data-delsub]', guard(PERM.update, (b) => { const [cid, s] = b.dataset.delsub.split('|'); const c = DB.categories.find(x => x.id === cid); const n = cnt(p => p.category === c.name && p.subcategory === s); if (n) { UI.toast('No se puede eliminar: ' + n + ' producto(s) usan la subcategoría ' + esc(s) + '.', 'bad'); return; } c.subs = c.subs.filter(x => x !== s); Audit.log('Catálogo', c.id, 'eliminar_subcategoria', s, ''); Store.save(); UI.toast('Subcategoría eliminada.'); rerender(); }));
    on(el, '[data-delcat]', guard(PERM.update, (b) => { const c = DB.categories.find(x => x.id === b.dataset.delcat); const n = cnt(p => p.category === c.name); if (n) { UI.toast('No se puede eliminar: ' + n + ' producto(s) usan la categoría ' + esc(c.name) + '.', 'bad'); return; } UI.confirm({ title: 'Eliminar categoría', message: '¿Eliminar <b>' + esc(c.name) + '</b> y sus subcategorías?', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { DB.categories.splice(DB.categories.indexOf(c), 1); Audit.log('Catálogo', c.id, 'eliminar_categoria', c.name, ''); Store.save(); UI.toast('Categoría eliminada.'); rerender(); } }); }));
  });

  /* ==========================================================================
     ASISTENTE DE ALTA (PROC-014): Definir → Categorizar → Destino → Componentes →
     Itinerario → Tarifas → Temporadas → Disponibilidad → Contenido → Publicar
     ========================================================================== */
  const WZ_STEPS = ['Definir', 'Categorizar', 'Destino', 'Componentes', 'Itinerario', 'Tarifas', 'Temporadas', 'Disponibilidad', 'Contenido', 'Publicar'];
  let WZ = null;
  const newDraft = () => ({ step: 0, p: { id: '', code: '', sku: '', name: '', internalName: '', type: '', category: '', subcategory: '', destId: '', secondary: [], status: 'DRAFT', short: '', long: '', durationValue: 1, durationUnit: 'días', modality: 'Compartido', mainProviderId: '', minPax: 1, maxPax: 12, minAge: 0, maxAge: 85, advMin: 2, advMax: 365, flags: { bookable: true, quoteable: true, b2b: false, ecommerce: false, featured: false }, markupPct: 25, components: [], itinerary: [], inclusions: [], exclusions: [], requirements: [], policies: defaultPolicies(), rates: [], availabilityModel: 'SIN_CONTROL', availCfg: { capacity: '', source: 'interna' }, departures: [], related: [], channels: { erp: true, crm: true, quotes: true, b2b: false, portal: false, portalPax: false, cms: false, ecommerce: false, mobile: false }, versions: [], promotions: [], b2b: [], seo: { title: '', description: '', slug: '' }, faqs: [], seasons: [], hue: 150 + Math.floor(Math.random() * 60) } });

  function svcOptions(selected, excludeIds) {
    const groups = {};
    DB.services.forEach(s => { const pv = Q.provider(s.providerId); const okS = svcOk(s) && provActive(pv); (groups[s.type] = groups[s.type] || []).push({ v: s.id, l: s.id + ' · ' + s.name + ' — ' + money(s.cost, s.currency) + '/' + s.unit + (okS ? '' : ' [' + (!svcOk(s) ? 'servicio vencido/inactivo' : 'proveedor ' + UI.statusLabel(provState(pv)).toLowerCase()) + ' · PRD-BR-007]'), dis: !okS || (excludeIds || []).includes(s.id) }); });
    return Object.keys(groups).sort().map(g => ({ group: g, items: groups[g] }));
  }

  /* Validación de tarifa: PRD-BR-004 (moneda y vigencia) y PRD-BR-005 (no vencida). Devuelve código de error o '' */
  function validateRate(r, mark) {
    const miss = []; if (!r.currency) miss.push('currency'); if (!r.validFrom) miss.push('validFrom'); if (!r.validTo) miss.push('validTo');
    if (miss.length) { miss.forEach(mark); UI.toast('<b>PRD-BR-004:</b> toda tarifa debe tener moneda y vigencia (desde / hasta). Sin moneda la API responde 422 (PRD-T08).', 'bad'); return 'BR-004'; }
    if (r.validTo < r.validFrom) { mark('validTo'); UI.toast('La vigencia final debe ser posterior a la inicial.', 'bad'); return 'rango'; }
    if (r.validTo < T()) { mark('validTo'); UI.toast('<b>PRD-BR-005:</b> la vigencia ya venció; una tarifa fuera de vigencia no puede aplicarse ni registrarse como vigente.', 'bad'); return 'BR-005'; }
    if (!(r.price > 0)) { mark('price'); UI.toast('Indique un precio de venta mayor a cero.', 'bad'); return 'precio'; }
    if (r.minPrice && r.price < r.minPrice) { mark('price'); UI.toast('El precio de venta está por debajo del precio mínimo definido.', 'bad'); return 'min'; }
    if (r.maxPrice && r.price > r.maxPrice) { mark('price'); UI.toast('El precio de venta supera el precio máximo definido.', 'bad'); return 'max'; }
    if (r.price < r.cost) UI.toast('Atención: el precio de venta es menor al costo (margen negativo).', 'warn');
    return '';
  }

  App.register('catalogo/productos/nuevo', (el) => {
    ensure(); css();
    if (!can(PERM.create)) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Nuevo producto', crumbs: [['Catálogo'], ['Productos', '#/catalogo/productos'], ['Nuevo']] }) + UI.alert('bad', 'Su rol no tiene el permiso <span class="mono">catalog.products.create</span> (PRD-T13 → 403).') + '</div>'; return; }
    if (!WZ) WZ = newDraft();
    const p = WZ.p; const step = WZ.step;
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Nuevo producto turístico', subtitle: 'Asistente PROC-014. El producto se crea en estado <b>Borrador (DRAFT)</b>: editable y no comercializable hasta pasar revisión, aprobación y el checklist de activación (§42).', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Productos', '#/catalogo/productos'], ['Nuevo']], actions: '<button class="btn" id="wz-discard">' + ic('x') + 'Descartar</button>' }) +
      '<div class="card"><div class="card-b">' + UI.flow(WZ_STEPS, step) + '</div></div>' +
      '<div class="card"><div class="card-h"><div><div class="t">Paso ' + (step + 1) + ' de ' + WZ_STEPS.length + ' · ' + WZ_STEPS[step] + '</div><div class="s">' + esc(p.name || 'Producto sin nombre') + (p.code ? ' · ' + esc(p.code) : '') + '</div></div></div><div class="card-b wiz-body" id="wz-body"></div>' +
      '<div class="card-f"><button class="btn" id="wz-prev"' + (step === 0 ? ' disabled' : '') + '>' + ic('chevronLeft') + 'Anterior</button>' + (step < WZ_STEPS.length - 1 ? '<button class="btn primary" id="wz-next">Siguiente' + ic('chevronRight') + '</button>' : '<button class="btn primary" id="wz-create">' + ic('check') + 'Crear producto en borrador</button>') + '</div></div></div>';
    const body = el.querySelector('#wz-body');
    const lines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
    const STEPS = [
      /* 1 Definir */
      { html: () => UI.form([
          { type: 'section', label: 'Identificación' },
          { id: 'name', label: 'Nombre comercial', required: true, value: p.name, col: 6, placeholder: 'p. ej. Valle Sagrado VIP Full Day' },
          { id: 'internalName', label: 'Nombre interno', value: p.internalName, col: 6 },
          { id: 'code', label: 'Código interno', required: true, value: p.code, col: 3, placeholder: 'CUS-VSG-VIP', hint: 'Único por tenant' },
          { id: 'sku', label: 'SKU comercial', value: p.sku, col: 3, placeholder: 'AH-VSG-001' },
          { id: 'type', label: 'Tipo de producto', type: 'select', required: true, options: DB.productTypes, value: p.type, placeholder: 'Seleccione', col: 3 },
          { id: 'modality', label: 'Modalidad', type: 'select', options: MODALITIES, value: p.modality, col: 3 },
          { type: 'section', label: 'Duración, pasajeros y anticipación' },
          { id: 'durationValue', label: 'Duración', type: 'number', min: 1, value: p.durationValue, col: 3, required: true },
          { id: 'durationUnit', label: 'Unidad', type: 'select', options: DUR_UNITS, value: p.durationUnit, col: 3 },
          { id: 'minPax', label: 'Pasajeros mínimo', type: 'number', min: 1, value: p.minPax, col: 3 },
          { id: 'maxPax', label: 'Pasajeros máximo', type: 'number', min: 1, value: p.maxPax, col: 3 },
          { id: 'minAge', label: 'Edad mínima', type: 'number', min: 0, value: p.minAge, col: 3 },
          { id: 'maxAge', label: 'Edad máxima', type: 'number', min: 0, value: p.maxAge, col: 3 },
          { id: 'advMin', label: 'Anticipación mínima (días)', type: 'number', min: 0, value: p.advMin, col: 3 },
          { id: 'advMax', label: 'Anticipación máxima (días)', type: 'number', min: 0, value: p.advMax, col: 3 },
          { id: 'short', label: 'Descripción corta', type: 'textarea', rows: 2, value: p.short, col: 12 }
        ]),
        bind: (b) => { const n = b.querySelector('#name'), c = b.querySelector('#code'); n.addEventListener('input', () => { if (!c.dataset.touched) c.value = slugify(n.value).toUpperCase().split('-').filter(Boolean).slice(0, 3).map(w => w.slice(0, 4)).join('-'); }); c.addEventListener('input', () => { c.dataset.touched = '1'; }); },
        save: (b) => { if (!UI.validate(b)) return false; const d = UI.formData(b);
          if (DB.products.some(x => x.code.toLowerCase() === d.code.toLowerCase())) { markErr(b, 'code'); UI.toast('El código interno ya existe en el tenant.', 'bad'); return false; }
          if (d.minPax > d.maxPax) { markErr(b, 'maxPax'); UI.toast('El máximo de pasajeros debe ser mayor o igual al mínimo.', 'bad'); return false; }
          if (d.minAge > d.maxAge) { markErr(b, 'maxAge'); UI.toast('La edad máxima debe ser mayor o igual a la mínima.', 'bad'); return false; }
          if (d.advMin > d.advMax) { markErr(b, 'advMax'); UI.toast('La anticipación máxima debe ser mayor a la mínima.', 'bad'); return false; }
          Object.assign(p, d); if (!p.sku) p.sku = 'AH-' + p.code; if (!p.internalName) p.internalName = p.name; } },
      /* 2 Categorizar */
      { html: () => { const cat = DB.categories.find(c => c.name === p.category); return UI.form([
          { id: 'category', label: 'Categoría', type: 'select', required: true, options: DB.categories.map(c => c.name), value: p.category, placeholder: 'Seleccione', col: 6 },
          { id: 'subcategory', label: 'Subcategoría', type: 'select', options: cat ? cat.subs : [], value: p.subcategory, placeholder: cat ? 'Seleccione' : 'Elija primero la categoría', col: 6 },
          { type: 'section', label: 'Indicadores comerciales (§5)' },
          { id: 'bookable', type: 'switch', label: 'Permite reserva (is_bookable)', value: p.flags.bookable, col: 4 },
          { id: 'quoteable', type: 'switch', label: 'Permite cotización (is_quoteable)', value: p.flags.quoteable, col: 4 },
          { id: 'b2b', type: 'switch', label: 'Disponible B2B (is_b2b)', value: p.flags.b2b, col: 4 },
          { id: 'ecommerce', type: 'switch', label: 'Publicable e-commerce (is_ecommerce)', value: p.flags.ecommerce, col: 4 },
          { id: 'featured', type: 'switch', label: 'Destacado (is_featured)', value: p.flags.featured, col: 4 }
        ]) + '<p class="xs faint" style="margin-top:12px">Los indicadores se aplican solo cuando el producto esté ACTIVO. <a href="#/catalogo/categorias">Administrar tipos y categorías</a></p>'; },
        bind: (b) => { b.querySelector('#category').onchange = (e) => { const c = DB.categories.find(x => x.name === e.target.value); b.querySelector('#subcategory').innerHTML = '<option value="">Seleccione</option>' + (c ? c.subs.map(s => '<option>' + esc(s) + '</option>').join('') : ''); }; },
        save: (b) => { if (!UI.validate(b)) return false; const d = UI.formData(b); p.category = d.category; p.subcategory = d.subcategory; ['bookable', 'quoteable', 'b2b', 'ecommerce', 'featured'].forEach(k => { p.flags[k] = d[k]; }); } },
      /* 3 Destino */
      { html: () => UI.form([selField('destId', 'Destino principal', destOptions().map(o => ({ v: o[0], l: o[1] })), p.destId, { required: true, placeholder: 'Seleccione', col: 12, hint: 'Jerarquía País → Región → Departamento → Ciudad/Zona → Lugar → Atracción (PROC-011)' })]) +
          '<div class="section-title" style="margin-top:16px">Destinos secundarios</div><div class="chk-scroll" style="margin-top:8px">' + DB.destinations.map(d => '<label class="check small"><input type="checkbox" data-sec="' + d.id + '"' + (p.secondary.includes(d.id) ? ' checked' : '') + '> ' + esc(d.name) + ' <span class="xs faint">' + esc(d.type) + '</span></label>').join('') + '</div>',
        save: (b) => { if (!UI.validate(b)) return false; p.destId = b.querySelector('#destId').value; p.secondary = [...b.querySelectorAll('[data-sec]:checked')].map(x => x.dataset.sec).filter(x => x !== p.destId); } },
      /* 4 Componentes */
      { html: () => { const provOpts = DB.providers.map(pv => ({ v: pv.id, l: pv.name + ' · ' + pv.type + (provActive(pv) ? '' : ' [' + UI.statusLabel(provState(pv)) + ' · PRD-BR-007]'), dis: !provActive(pv) }));
          return UI.form([selField('mainProviderId', 'Proveedor principal', provOpts, p.mainProviderId, { placeholder: 'Seleccione', col: 12, hint: 'Solo proveedores activos con contrato vigente (PRD-BR-007). Información contractual separada de la comercial (§8).' })]) +
            '<div class="section-title" style="margin-top:16px">Componentes (servicios de proveedores)</div>' +
            (p.components.length ? tbl(['#', 'Servicio', 'Proveedor', ['Cant.', 'num'], 'Unidad', 'Req.', 'Incl.', ['Subtotal S/', 'num'], ''], p.components.map((c, i) => { const s = Q.service(c.serviceId); return '<tr><td>' + (i + 1) + '</td><td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub mono">' + s.id + '</div></td><td>' + esc(Q.providerName(s.providerId)) + '</td><td class="num">' + c.qty + '</td><td>' + esc(c.unit) + '</td><td>' + (c.required ? 'Sí' : 'No') + '</td><td>' + (c.included ? 'Sí' : 'No') + '</td><td class="num">' + fmtN(compCostPEN(c)) + '</td><td><button class="btn xs ghost icon" data-rmc="' + i + '" title="Quitar">' + ic('x') + '</button></td></tr>'; }).join('') + '<tr><td colspan="7"><b>Costo total de componentes</b></td><td class="num"><b>' + fmtN(compCost(p)) + '</b></td><td></td></tr>', 'compact') : '<p class="small faint" style="margin:8px 0">Aún no hay componentes.</p>') +
            '<div class="mini-form" style="margin-top:12px"><div class="c6">' + UI.form([selField('wz-svc', 'Servicio', svcOptions('', p.components.map(c => c.serviceId)), '', { placeholder: 'Seleccione un servicio', col: 12 })]) + '</div><div class="c2"><div class="field"><label for="wz-qty">Cantidad</label><input class="input" id="wz-qty" type="number" min="1" value="1"></div></div><div class="c2"><label class="check small"><input type="checkbox" id="wz-req" checked> Requerido</label><label class="check small"><input type="checkbox" id="wz-inc" checked> Incluido</label></div><div class="c2"><button class="btn primary" id="wz-addc" style="width:100%;justify-content:center">' + ic('plus') + 'Agregar</button></div></div>'; },
        bind: (b) => { const pv = b.querySelector('#mainProviderId'); pv.onchange = () => { p.mainProviderId = pv.value; };
          b.querySelector('#wz-addc').onclick = () => { const id = b.querySelector('#wz-svc').value; if (!id) { UI.toast('Seleccione un servicio.', 'bad'); return; } const s = Q.service(id); p.components.push({ serviceId: id, qty: Math.max(1, +b.querySelector('#wz-qty').value || 1), unit: s.unit, order: p.components.length + 1, required: b.querySelector('#wz-req').checked, included: b.querySelector('#wz-inc').checked, notes: '' }); if (!p.mainProviderId) p.mainProviderId = s.providerId; drawStep(); };
          on(b, '[data-rmc]', (x) => { p.components.splice(+x.dataset.rmc, 1); p.components.forEach((c, i) => { c.order = i + 1; }); drawStep(); }); },
        save: (b) => { p.mainProviderId = b.querySelector('#mainProviderId').value; if (!p.components.length && p.type !== 'PRODUCTO PERSONALIZADO') UI.toast('Sin componentes: podrá agregarlos luego, pero el checklist de activación los exige (§42).', 'warn'); } },
      /* 5 Itinerario */
      { html: () => (p.itinerary.length ? p.itinerary.map((d, di) => '<div class="card" style="margin-bottom:10px"><div class="card-h"><div class="row" style="flex-wrap:nowrap"><span class="day-n">D' + d.day + '</span><b class="small">' + esc(d.title) + '</b></div><button class="btn xs ghost" data-rmd="' + di + '">' + ic('trash') + 'Quitar día</button></div><div class="card-b tight">' + (d.items.length ? tbl(['Hora', 'Actividad', 'Tipo', 'Ubicación', ''], d.items.map((it, ii) => '<tr><td class="mono">' + esc(it.time) + '</td><td>' + esc(it.activity) + '</td><td>' + esc(it.type) + '</td><td>' + esc(it.location) + '</td><td><button class="btn xs ghost icon" data-rmi="' + di + '|' + ii + '">' + ic('x') + '</button></td></tr>').join(''), 'compact') : '<p class="small faint" style="padding:10px 16px">Día sin actividades.</p>') + '</div></div>').join('') : '<p class="small faint">Sin días. ' + (TYPES_ITIN.includes(p.type) ? 'El tipo ' + esc(p.type) + ' requiere itinerario para activarse.' : 'El itinerario es opcional para el tipo ' + esc(p.type || 'seleccionado') + '.') + '</p>') +
          '<div class="mini-form" style="margin-top:12px"><div class="c6"><div class="field"><label for="wz-dt">Nuevo día — título</label><input class="input" id="wz-dt" placeholder="p. ej. Cusco — Valle Sagrado"></div></div><div class="c3"><button class="btn" id="wz-addd">' + ic('plus') + 'Agregar día</button></div></div>' +
          (p.itinerary.length ? '<div class="mini-form" style="margin-top:10px"><div class="c2"><div class="field"><label for="wz-id">Día</label><select class="input" id="wz-id">' + p.itinerary.map((d, i) => '<option value="' + i + '">Día ' + d.day + '</option>').join('') + '</select></div></div><div class="c2"><div class="field"><label for="wz-it">Hora</label><input class="input" id="wz-it" type="time" value="08:00"></div></div><div class="c4"><div class="field"><label for="wz-ia">Actividad</label><input class="input" id="wz-ia"></div></div><div class="c2"><div class="field"><label for="wz-ity">Tipo</label><select class="input" id="wz-ity">' + ITEM_TYPES.map(t => '<option>' + t + '</option>').join('') + '</select></div></div><div class="c2"><div class="field"><label for="wz-il">Ubicación</label><input class="input" id="wz-il"></div></div><div class="c12"><button class="btn primary" id="wz-addi">' + ic('plus') + 'Agregar actividad</button></div></div>' : ''),
        bind: (b) => { b.querySelector('#wz-addd').onclick = () => { const t = b.querySelector('#wz-dt').value.trim(); if (!t) { UI.toast('Indique el título del día.', 'bad'); return; } p.itinerary.push({ day: p.itinerary.length + 1, title: t, items: [] }); drawStep(); };
          const ai = b.querySelector('#wz-addi'); if (ai) ai.onclick = () => { const a = b.querySelector('#wz-ia').value.trim(); if (!a) { UI.toast('Indique la actividad.', 'bad'); return; } const d = p.itinerary[+b.querySelector('#wz-id').value]; d.items.push({ time: b.querySelector('#wz-it').value || '—', activity: a, type: b.querySelector('#wz-ity').value, location: b.querySelector('#wz-il').value.trim() }); d.items.sort((x, y) => String(x.time).localeCompare(String(y.time))); drawStep(); };
          on(b, '[data-rmd]', (x) => { p.itinerary.splice(+x.dataset.rmd, 1); p.itinerary.forEach((d, i) => { d.day = i + 1; }); drawStep(); });
          on(b, '[data-rmi]', (x) => { const [di, ii] = x.dataset.rmi.split('|').map(Number); p.itinerary[di].items.splice(ii, 1); drawStep(); }); } },
      /* 6 Tarifas */
      { html: () => { const cc = compCost(p); return UI.alert('info', 'Costo de componentes: <b>' + money(cc) + '</b> (≈ ' + money(cc / DB.settings.fx, 'USD') + '). Toda tarifa requiere <b>moneda y vigencia</b> (PRD-BR-004); no se aceptan tarifas ya vencidas (PRD-BR-005).') +
          '<div style="margin-top:12px">' + (p.rates.length ? tbl(['Tipo', 'Segmento', 'Canal', 'Moneda', ['Costo', 'num'], ['Venta', 'num'], ['Margen', 'num'], 'Vigencia', ''], p.rates.map((r, i) => '<tr><td>' + esc(r.type) + '</td><td>' + esc(r.segment) + '</td><td>' + esc(r.channel) + '</td><td>' + r.currency + '</td><td class="num">' + fmtN(r.cost) + '</td><td class="num">' + fmtN(r.price) + '</td><td class="num">' + pct(marginOf(r)) + '</td><td class="nowrap small">' + dateShort(r.validFrom) + ' → ' + date(r.validTo) + '</td><td><button class="btn xs ghost icon" data-rmr="' + i + '">' + ic('x') + '</button></td></tr>').join(''), 'compact') : '<p class="small faint">Sin tarifas.</p>') + '</div>' +
          '<div class="mini-form" style="margin-top:12px">' +
          '<div class="c2"><div class="field"><label for="wr-type">Tipo</label><select class="input" id="wr-type">' + RATE_TYPES.map(t => '<option' + (t === 'Venta' ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></div>' +
          '<div class="c2"><div class="field"><label for="wr-seg">Segmento</label><select class="input" id="wr-seg">' + SEGMENTS.map(t => '<option>' + t + '</option>').join('') + '</select></div></div>' +
          '<div class="c2"><div class="field"><label for="wr-ch">Canal</label><select class="input" id="wr-ch">' + RATE_CHANNELS.map(t => '<option>' + t + '</option>').join('') + '</select></div></div>' +
          '<div class="c2"><div class="field"><label for="wr-cur">Moneda <span class="req">*</span></label><select class="input" id="wr-cur"><option value="">Seleccione</option><option>PEN</option><option>USD</option></select></div></div>' +
          '<div class="c2"><div class="field"><label for="wr-cost">Costo</label><input class="input" id="wr-cost" type="number" step="0.01" value="' + Math.round(cc) + '"></div></div>' +
          '<div class="c2"><div class="field"><label for="wr-price">Venta</label><input class="input" id="wr-price" type="number" step="0.01" value="' + Math.round(cc * (1 + p.markupPct / 100)) + '"></div></div>' +
          '<div class="c3"><div class="field"><label for="wr-from">Vigencia desde <span class="req">*</span></label><input class="input" id="wr-from" type="date" value="' + T() + '"></div></div>' +
          '<div class="c3"><div class="field"><label for="wr-to">Vigencia hasta <span class="req">*</span></label><input class="input" id="wr-to" type="date"></div></div>' +
          '<div class="c4"><div class="field"><label for="wr-season">Temporada</label><select class="input" id="wr-season"><option value="">Sin temporada</option>' + DB.seasons.filter(s => s.status === 'activa').map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('') + '</select></div></div>' +
          '<div class="c2"><button class="btn primary" id="wr-add" style="width:100%;justify-content:center">' + ic('plus') + 'Agregar</button></div></div>'; },
        bind: (b) => { b.querySelector('#wr-add').onclick = () => { const g = (id) => b.querySelector('#' + id);
            const r = { type: g('wr-type').value, segment: g('wr-seg').value, channel: g('wr-ch').value, currency: g('wr-cur').value, cost: +g('wr-cost').value || 0, price: +g('wr-price').value || 0, validFrom: g('wr-from').value, validTo: g('wr-to').value, season: g('wr-season').value, status: 'vigente', basis: 'Por persona' };
            if (validateRate(r, (k) => { const m = { currency: 'wr-cur', validFrom: 'wr-from', validTo: 'wr-to', price: 'wr-price' }[k]; if (m) g(m).classList.add('err'); })) return;
            r.id = nextId('TAR-', DB.products.flatMap(x => x.rates).concat(p.rates), 3); p.rates.push(r); drawStep(); };
          on(b, '[data-rmr]', (x) => { p.rates.splice(+x.dataset.rmr, 1); drawStep(); }); },
        save: () => { if (!p.rates.length) UI.toast('Sin tarifas: el producto no podrá activarse hasta tener una tarifa vigente (§42).', 'warn'); } },
      /* 7 Temporadas */
      { html: () => '<p class="small muted" style="margin-bottom:10px">Asocie las temporadas que modifican tarifa o disponibilidad (PROC-019). Las temporadas usadas por las tarifas se asocian automáticamente.</p><div class="chk-scroll" style="max-height:none">' + DB.seasons.map(s => { const byRate = p.rates.some(r => r.season === s.id); return '<label class="check small" style="align-items:flex-start"><input type="checkbox" data-ss="' + s.id + '"' + (p.seasons.includes(s.id) || byRate ? ' checked' : '') + (byRate || s.status !== 'activa' ? ' disabled' : '') + '> <span><b>' + esc(s.name) + '</b><br><span class="xs faint">' + esc(s.type) + ' · ' + dateShort(s.from) + ' → ' + date(s.to) + ' · ×' + fmtN(s.factor, 2) + ' · prioridad ' + s.priority + '</span></span></label>'; }).join('') + '</div><p class="xs faint" style="margin-top:8px"><a href="#/catalogo/tarifas/temporadas">Administrar temporadas</a></p>',
        save: (b) => { p.seasons = [...b.querySelectorAll('[data-ss]:checked')].map(x => x.dataset.ss).filter(id => !p.rates.some(r => r.season === id)); } },
      /* 8 Disponibilidad */
      { html: () => '<div class="avm">' + AVAIL.map(a => '<label class="' + (p.availabilityModel === a[0] ? 'on' : '') + '"><input type="radio" name="wz-av" value="' + a[0] + '"' + (p.availabilityModel === a[0] ? ' checked' : '') + '><span><b class="small mono">' + a[0] + '</b><br><span class="xs muted">' + esc(a[2]) + '</span></span></label>').join('') + '</div>' +
          '<div class="form-grid" style="margin-top:14px"><div class="field c4"><label for="wz-cap">Capacidad / cupo de referencia</label><input class="input" id="wz-cap" type="number" min="0" value="' + esc(p.availCfg.capacity) + '"></div><div class="field c4"><label for="wz-src">Fuente de disponibilidad</label><select class="input" id="wz-src"><option value="interna"' + (p.availCfg.source !== 'externa' ? ' selected' : '') + '>Inventario propio</option><option value="externa"' + (p.availCfg.source === 'externa' ? ' selected' : '') + '>Proveedor externo (adaptador)</option></select></div></div>' +
          '<div style="margin-top:12px">' + UI.alert('info', '<b>PRD-BR-013:</b> la disponibilidad externa solo se trata como real cuando existe integración confirmada. El adaptador de proveedores (INT-06) está en estado parcial: la disponibilidad externa es informativa.') + '</div>',
        bind: (b) => b.querySelectorAll('[name=wz-av]').forEach(r => { r.onchange = () => b.querySelectorAll('.avm label').forEach(l => l.classList.toggle('on', l.contains(r))); }),
        save: (b) => { const r = b.querySelector('[name=wz-av]:checked'); p.availabilityModel = r ? r.value : 'SIN_CONTROL'; p.availCfg = { capacity: b.querySelector('#wz-cap').value, source: b.querySelector('#wz-src').value }; } },
      /* 9 Contenido */
      { html: () => UI.form([
          { id: 'long', label: 'Descripción completa', type: 'textarea', rows: 4, value: p.long, col: 12 },
          { id: 'inclusions', label: 'Incluye (uno por línea)', type: 'textarea', rows: 5, value: p.inclusions.join('\n') || p.components.filter(c => c.included).map(c => (Q.service(c.serviceId) || {}).name).join('\n'), col: 6 },
          { id: 'exclusions', label: 'No incluye (uno por línea)', type: 'textarea', rows: 5, value: p.exclusions.join('\n') || 'Propinas\nBebidas\nGastos personales\nServicios no especificados', col: 6 },
          { id: 'requirements', label: 'Requisitos y recomendaciones (uno por línea)', type: 'textarea', rows: 3, value: p.requirements.join('\n'), col: 12 },
          { type: 'section', label: 'SEO' },
          { id: 'seoTitle', label: 'SEO title', value: p.seo.title || p.name, col: 6 },
          { id: 'slug', label: 'Slug', value: p.seo.slug || slugify(p.name), col: 6 },
          { id: 'seoDesc', label: 'SEO description', type: 'textarea', rows: 2, value: p.seo.description || p.short, col: 12 }
        ]),
        save: (b) => { const d = UI.formData(b); p.long = d.long; p.inclusions = lines(d.inclusions); p.exclusions = lines(d.exclusions); p.requirements = lines(d.requirements); p.seo = { title: d.seoTitle, description: d.seoDesc, slug: slugify(d.slug) }; } },
      /* 10 Publicar */
      { html: () => { const cks = activationChecks(Object.assign({}, p, { status: 'APPROVED' })); const okN = cks.filter(c => c.ok).length;
          return '<div class="grid g2"><div><div class="section-title">Canales solicitados</div><div class="col" style="gap:8px;margin-top:10px">' + CH.map(c => '<label class="switch"><input type="checkbox" data-ch="' + c[0] + '"' + (p.channels[c[0]] ? ' checked' : '') + (c[0] === 'erp' ? ' disabled' : '') + '> ' + c[1] + ' <span class="xs faint">' + esc(c[2]) + '</span></label>').join('') + '</div><p class="xs faint" style="margin-top:10px">Un producto en borrador no es comercializable: los canales de venta se publican efectivamente al activar el producto (PRD-BR-002).</p></div>' +
            '<div><div class="section-title">Resumen</div>' + UI.dl([['Producto', '<b>' + esc(p.name) + '</b>'], ['Código / SKU', '<span class="mono">' + esc(p.code) + ' · ' + esc(p.sku) + '</span>'], ['Tipo', esc(p.type)], ['Categoría', esc(p.category) + ' › ' + esc(p.subcategory || '—')], ['Destino', esc(Q.destPath(p.destId))], ['Proveedor principal', esc(Q.providerName(p.mainProviderId))], ['Componentes', p.components.length + ' · costo ' + money(compCost(p))], ['Itinerario', p.itinerary.length + ' día(s)'], ['Tarifas', p.rates.length], ['Temporadas', new Set(p.seasons.concat(p.rates.map(r => r.season).filter(Boolean))).size], ['Disponibilidad', esc(availLabel(p.availabilityModel))], ['Estado inicial', UI.badge('DRAFT')]]) +
            '<div class="section-title" style="margin-top:14px">Preparación para activación (§42)</div><div class="row between small" style="margin:8px 0 6px"><span>' + okN + ' de ' + cks.length + ' validaciones cumplidas</span><b>' + Math.round(okN / cks.length * 100) + '%</b></div>' + UI.progress(okN / cks.length * 100, okN === cks.length ? 'ok' : 'warn') + '<div style="margin-top:6px">' + cks.filter(c => !c.ok).map(c => '<div class="chk-row"><span class="chk-ico bad">' + ic('x') + '</span><div class="grow"><div class="small">' + esc(c.k) + '</div><div class="xs faint">' + esc(c.d) + '</div></div></div>').join('') + '</div></div></div>'; },
        save: (b) => { b.querySelectorAll('[data-ch]').forEach(x => { p.channels[x.dataset.ch] = x.dataset.ch === 'erp' ? true : x.checked; }); } }
    ];
    function drawStep() { body.innerHTML = STEPS[step].html(); if (STEPS[step].bind) STEPS[step].bind(body); }
    drawStep();
    el.querySelector('#wz-prev').onclick = () => { WZ.step = Math.max(0, step - 1); App.render(); };
    const nx = el.querySelector('#wz-next'); if (nx) nx.onclick = () => { if (STEPS[step].save && STEPS[step].save(body) === false) return; WZ.step = step + 1; App.render(); };
    const cr = el.querySelector('#wz-create'); if (cr) cr.onclick = () => {
      STEPS[step].save(body);
      if (!p.name || !p.code || !p.type || !p.category || !p.destId) { UI.toast('Faltan datos obligatorios de los pasos Definir, Categorizar o Destino.', 'bad'); return; }
      const np = clone(p);
      np.id = nextId('PRD-', DB.products, 3); np.status = 'DRAFT'; np.createdAt = T(); np.updatedAt = T(); np.channels.erp = true;
      np.versions = [{ v: '0.1', date: T(), user: Auth.user.id, reason: 'Creación desde asistente PROC-014', status: 'borrador', snapshot: snap(np) }];
      np.gallery = [{ hue: np.hue, label: 'Portada', main: true }];
      DB.products.push(np);
      Audit.log('Producto', np.id, 'crear', '', 'DRAFT · ' + np.name);
      Store.save(); WZ = null;
      UI.toast('Producto <b>' + esc(np.id) + '</b> creado en borrador.');
      App.go('#/catalogo/productos/' + np.id);
    };
    el.querySelector('#wz-discard').onclick = () => UI.confirm({ title: 'Descartar asistente', message: 'Se perderán los datos ingresados en el asistente.', confirmLabel: 'Descartar', danger: true, onConfirm: () => { WZ = null; App.go('#/catalogo/productos'); } });
  });

  /* ==========================================================================
     PRODUCT 360 (§30)
     ========================================================================== */
  const TAB_IDS = ['general', 'componentes', 'itinerario', 'tarifas', 'temporadas', 'disponibilidad', 'salidas', 'proveedores', 'politicas', 'inclusiones', 'relacionados', 'b2b', 'promociones', 'rentabilidad', 'personalizacion', 'contenido', 'canales', 'versiones', 'historial', 'reservas'];

  function activationChecks(p) {
    const prov = Q.provider(p.mainProviderId);
    const compIssues = (p.components || []).map(c => {
      if (c.productId) { const p2 = Q.product(c.productId); return p2 && p2.status === 'ACTIVE' ? null : 'Producto componente ' + c.productId + ' no activo'; }
      const s = Q.service(c.serviceId); const pv = s && Q.provider(s.providerId);
      if (!svcOk(s)) return (s ? s.id + ' ' + s.name : c.serviceId) + ': servicio vencido o inactivo';
      if (!provActive(pv)) return (pv ? pv.name : 'Proveedor') + ': ' + UI.statusLabel(provState(pv)).toLowerCase();
      return null;
    }).filter(Boolean);
    const rates = p.rates || [];
    const valid = rates.filter(r => rateState(r) === 'vigente');
    const noCur = rates.filter(r => !r.currency);
    const noVal = rates.filter(r => !r.validFrom || !r.validTo);
    const pol = p.policies || {};
    const needItin = TYPES_ITIN.includes(p.type);
    const itinOk = (p.itinerary || []).length > 0 && p.itinerary.every(d => (d.items || []).length > 0);
    const needComp = p.type !== 'PRODUCTO PERSONALIZADO';
    const depOk = p.availabilityModel !== 'POR_SALIDA' || futureDeps(p).some(d => d.status === 'abierta');
    const stOk = ['APPROVED', 'SUSPENDED', 'INACTIVE', 'ACTIVE'].includes(p.status);
    return [
      { k: 'Tipo', ok: !!p.type && DB.productTypes.includes(p.type), d: p.type || 'Sin tipo de producto' },
      { k: 'Nombre', ok: !!(p.name && p.name.trim().length >= 3), d: p.name || 'Sin nombre comercial' },
      { k: 'Destino', ok: !!Q.destination(p.destId), d: p.destId ? Q.destPath(p.destId) : 'Sin destino principal' },
      { k: 'Estado', ok: stOk, d: 'Estado actual: ' + UI.statusLabel(p.status) + (stOk ? '' : ' — debe pasar por revisión y aprobación (DRAFT → REVIEW → APPROVED)') },
      { k: 'Componentes', ok: !needComp || (p.components || []).length > 0, d: needComp ? ((p.components || []).length ? (p.components || []).length + ' componente(s) con trazabilidad al servicio de origen' : 'Sin componentes') : 'No aplica al tipo' },
      { k: 'Proveedor', ok: provActive(prov) && !compIssues.length, d: !prov ? 'Sin proveedor principal' : !provActive(prov) ? prov.name + ': ' + UI.statusLabel(provState(prov)).toLowerCase() + ' (PRD-BR-007)' : compIssues.length ? compIssues.join(' · ') + ' (PRD-BR-007)' : prov.name + ' y proveedores de componentes activos con contrato vigente' },
      { k: 'Tarifa válida', ok: valid.length > 0, d: valid.length ? valid.length + ' tarifa(s) vigente(s) al ' + date(T()) : (rates.length ? 'Todas las tarifas están vencidas o inactivas (PRD-BR-005)' : 'Sin tarifas registradas') },
      { k: 'Moneda', ok: rates.length > 0 && !noCur.length, d: !rates.length ? 'Sin tarifas: no hay moneda definida (PRD-T08 → 422)' : noCur.length ? noCur.length + ' tarifa(s) sin moneda (PRD-BR-004)' : [...new Set(rates.map(r => r.currency))].join(' / ') },
      { k: 'Vigencia', ok: rates.length > 0 && !noVal.length && valid.length > 0, d: !rates.length ? 'Sin tarifas con vigencia' : noVal.length ? noVal.length + ' tarifa(s) sin vigencia (PRD-BR-004)' : valid.length ? 'Vigencias completas; al menos una vigente hoy' : 'Ninguna tarifa vigente hoy' },
      { k: 'Políticas', ok: !!(pol.cancel && pol.modify && pol.noshow && pol.refund), d: pol.cancel && pol.modify && pol.noshow && pol.refund ? 'Cancelación, modificación, no-show y reembolso definidos' : 'Faltan políticas obligatorias' },
      { k: 'Disponibilidad', ok: !!p.availabilityModel && depOk, d: availLabel(p.availabilityModel) + (p.availabilityModel === 'POR_SALIDA' ? (depOk ? ' · con salidas futuras abiertas' : ' · sin salidas futuras abiertas') : '') },
      { k: 'Itinerario', ok: !needItin || itinOk, d: needItin ? (itinOk ? p.itinerary.length + ' día(s) con actividades' : (p.itinerary || []).length ? 'Hay días sin actividades' : 'Sin itinerario; obligatorio para ' + p.type) : 'No aplica al tipo ' + (p.type || '') }
    ];
  }

  function checklistModal(p, mode) {
    const cks = activationChecks(p); const fails = cks.filter(c => !c.ok);
    const attempt = mode === 'activate';
    if (attempt && fails.length) Audit.log('Producto', p.id, 'activacion_rechazada', p.status, fails.map(f => f.k).join(', '));
    const head = fails.length ? UI.alert('bad', (attempt ? '<b>Activación bloqueada.</b> ' : '<b>El producto aún no puede activarse.</b> ') + fails.length + ' validación(es) obligatoria(s) no cumplida(s) (§42). ' + (attempt ? 'El producto permanece en estado <b>' + UI.statusLabel(p.status) + '</b>.' : '')) : UI.alert('ok', '<b>Checklist completo.</b> Se cumplen las ' + cks.length + ' validaciones de activación (§42).');
    UI.modal({ title: 'Checklist de activación', sub: esc(p.id + ' · ' + p.name), size: 'lg',
      body: head + '<div class="chk-list" style="margin-top:10px">' + cks.map(c => '<div class="chk-row"><span class="chk-ico ' + (c.ok ? 'ok' : 'bad') + '">' + ic(c.ok ? 'check' : 'x') + '</span><div class="grow"><div class="small" style="font-weight:600">' + esc(c.k) + '</div><div class="xs faint">' + esc(c.d) + '</div></div><span class="xs ' + (c.ok ? 'ok' : 'bad') + '" style="font-weight:600">' + (c.ok ? '✓ Cumple' : '✗ Falta') + '</span></div>').join('') + '</div><p class="xs faint" style="margin-top:10px">La validación definitiva la ejecuta el backend al activar; si falta un elemento la API responde 422 con el detalle. El frontend no es autoridad (PRD-BR-011).</p>',
      actions: attempt && !fails.length ? [{ label: 'Cancelar' }, { label: 'Activar producto', cls: 'primary', icon: 'zap', onClick: () => { setStatus(p, 'ACTIVE', ''); } }] : [{ label: 'Cerrar' }] });
  }

  function setStatus(p, to, reason) {
    const before = p.status; p.status = to; p.updatedAt = T();
    const vig = p.versions.filter(v => v.status !== 'histórica');
    if (to === 'ACTIVE') vig.forEach(v => { if (v.status === 'borrador' || v.status === 'en revisión') v.status = 'vigente'; });
    if (to === 'REVIEW') vig.forEach(v => { if (v.status === 'borrador') v.status = 'en revisión'; });
    Audit.log('Producto', p.id, 'cambio_estado', before, to + (reason ? ' — ' + reason : ''));
    if (to === 'ACTIVE') Notify.push('producto.activado', 'Email', 'U03', 'Producto ' + p.name + ' activo y disponible para venta');
    if (to === 'SUSPENDED' || to === 'INACTIVE') Notify.push('producto.no_vendible', 'Push', 'U04', 'Producto ' + p.name + ' ' + UI.statusLabel(to).toLowerCase() + ': no disponible para nuevas ventas');
    if (to === 'REVIEW') Notify.push('producto.revision', 'Portal', 'U02', 'Producto ' + p.name + ' pendiente de revisión');
    Store.save();
    UI.toast('Estado actualizado: <b>' + UI.statusLabel(before) + ' → ' + UI.statusLabel(to) + '</b>.');
    rerender();
  }

  function changeStatus(p, to) {
    if (to === 'ACTIVE') return checklistModal(p, 'activate');
    if (to === 'REVIEW') {
      const miss = [!p.name && 'nombre', !p.type && 'tipo', !p.destId && 'destino', !p.category && 'categoría'].filter(Boolean);
      if (miss.length) { UI.toast('No se puede enviar a revisión: falta ' + miss.join(', ') + '.', 'bad'); return; }
      return UI.confirm({ title: 'Enviar a revisión', message: '¿Enviar <b>' + esc(p.name) + '</b> a revisión? Gerencia recibirá la notificación para aprobarlo.', confirmLabel: 'Enviar', onConfirm: () => setStatus(p, 'REVIEW', '') });
    }
    if (to === 'APPROVED') return UI.confirm({ title: 'Aprobar producto', message: 'Aprobado: el producto queda listo para activarse y publicarse. La activación exige el checklist §42.', confirmLabel: 'Aprobar', onConfirm: () => setStatus(p, 'APPROVED', '') });
    const txt = { DRAFT: ['Devolver a borrador', 'Indique las observaciones de la revisión.'], SUSPENDED: ['Suspender producto', 'Suspendido: temporalmente no vendible. Las cotizaciones y reservas existentes conservan su snapshot.'], INACTIVE: ['Inactivar producto', 'Inactivo: no disponible para nuevas operaciones (PRD-BR-002). No se borra el historial.'], ARCHIVED: ['Archivar producto', 'Archivado: conservación histórica. No se elimina físicamente (§41).'] }[to];
    UI.confirm({ title: txt[0], message: txt[1], confirmLabel: txt[0].split(' ')[0], danger: to !== 'DRAFT', reason: true, onConfirm: (r) => setStatus(p, to, r) });
  }

  function lifecycleActions(p) {
    const A = PERM.activate;
    const L = {
      DRAFT: [['REVIEW', 'Enviar a revisión', 'send', PERM.update], ['ACTIVE', 'Activar', 'zap', A]],
      REVIEW: [['DRAFT', 'Devolver', 'chevronLeft', A], ['ACTIVE', 'Activar', 'zap', A], ['APPROVED', 'Aprobar', 'check', A]],
      APPROVED: [['ACTIVE', 'Activar', 'zap', A]],
      ACTIVE: [['INACTIVE', 'Inactivar', 'x', A], ['SUSPENDED', 'Suspender', 'alert', A]],
      SUSPENDED: [['INACTIVE', 'Inactivar', 'x', A], ['ACTIVE', 'Activar', 'zap', A]],
      INACTIVE: [['ARCHIVED', 'Archivar', 'box', A], ['ACTIVE', 'Activar', 'zap', A]],
      ARCHIVED: []
    }[p.status] || [];
    return '<button class="btn" id="p-more">' + ic('more') + 'Más acciones</button>' + L.map((a, i) => '<button class="btn' + (i === L.length - 1 && !['SUSPENDED', 'INACTIVE', 'ARCHIVED'].includes(a[0]) ? ' primary' : '') + '" data-lc="' + a[0] + '"' + dis(a[3]) + '>' + ic(a[2]) + esc(a[1]) + '</button>').join('');
  }

  function deleteProduct(p) {
    const u = usage(p.id); const inPkg = DB.products.filter(x => (x.components || []).some(c => c.productId === p.id));
    const ops = DB.operations.filter(o => u.res.some(r => r.id === o.resId));
    if (u.quotes.length || u.res.length || inPkg.length) {
      UI.modal({ title: 'Eliminación física bloqueada', size: 'lg', body: UI.alert('bad', '<b>PRD-BR-018 / §41:</b> el producto está referenciado por documentos históricos y no puede eliminarse físicamente. Use <b>Inactivar</b> o <b>Archivar</b> para conservar la trazabilidad.') +
        '<div class="grid g3" style="margin-top:12px"><div><div class="upper">Cotizaciones</div>' + (u.quotes.map(q => '<div class="small"><a href="#/cotizaciones/' + q.id + '">' + q.id + '</a> ' + UI.badge(q.status) + '</div>').join('') || '<span class="faint small">—</span>') + '</div><div><div class="upper">Reservas</div>' + (u.res.map(r => '<div class="small"><a href="#/reservas/' + r.id + '">' + r.id + '</a> ' + UI.badge(r.status) + '</div>').join('') || '<span class="faint small">—</span>') + '</div><div><div class="upper">Operaciones / paquetes</div>' + (ops.map(o => '<div class="small"><a href="#/operaciones/ordenes/' + o.id + '">' + o.id + '</a></div>').join('') + inPkg.map(x => '<div class="small">' + prodLink(x.id) + '</div>').join('') || '<span class="faint small">—</span>') + '</div></div>',
        actions: [{ label: 'Cerrar' }].concat(p.status !== 'ARCHIVED' ? [{ label: 'Archivar producto', cls: 'primary', icon: 'box', onClick: () => { setTimeout(() => changeStatus(p, 'ARCHIVED'), 0); } }] : []) });
      Audit.log('Producto', p.id, 'eliminacion_bloqueada', p.status, 'PRD-BR-018 · ' + u.quotes.length + ' cot. / ' + u.res.length + ' res.');
      return;
    }
    UI.confirm({ title: 'Eliminar producto', message: 'El producto <b>' + esc(p.name) + '</b> no tiene cotizaciones, reservas ni operaciones. Se eliminará del catálogo (soft delete en backend, registrado en auditoría).', danger: true, confirmLabel: 'Eliminar', reason: true, onConfirm: (r) => { DB.products.splice(DB.products.indexOf(p), 1); Audit.log('Producto', p.id, 'eliminar', p.status, 'soft delete — ' + r); Store.save(); UI.toast('Producto eliminado.'); App.go('#/catalogo/productos'); } });
  }

  function duplicateProduct(p) {
    const np = clone(p); np.id = nextId('PRD-', DB.products, 3); np.name = p.name + ' (copia)'; np.code = p.code + '-C' + np.id.slice(-2); np.sku = p.sku + '-C'; np.status = 'DRAFT'; np.departures = []; np.createdAt = T(); np.updatedAt = T();
    np.rates = np.rates.map((r, i) => Object.assign(r, { id: nextId('TAR-', DB.products.flatMap(x => x.rates), 3).replace(/\d+$/, n => String(+n + i).padStart(3, '0')) }));
    np.versions = [{ v: '0.1', date: T(), user: Auth.user.id, reason: 'Duplicado de ' + p.id, status: 'borrador', snapshot: snap(np) }]; np.promotions = [];
    DB.products.push(np); Audit.log('Producto', np.id, 'crear', '', 'DRAFT · duplicado de ' + p.id); Store.save(); UI.toast('Borrador ' + np.id + ' creado a partir de ' + p.id + '.'); App.go('#/catalogo/productos/' + np.id);
  }

  function fichaDoc(p) {
    const r = mainRate(p);
    UI.modal({ title: 'Ficha comercial — ' + esc(p.name), size: 'lg', sub: 'Vista del documento. En producción el PDF se genera mediante un job asíncrono y queda disponible para descarga (PROC-061).',
      body: '<div class="doc"><div class="doc-head"><div><h2>' + esc(p.name) + '</h2><div class="muted small">' + esc(p.type) + ' · ' + esc(Q.destPath(p.destId)) + ' · ' + p.durationValue + ' ' + esc(p.durationUnit) + ' · ' + esc(p.modality) + '</div></div><div style="text-align:right"><b>' + esc(DB.tenant.name) + '</b><div class="muted small">RUC ' + DB.tenant.ruc + '</div><div class="muted small">Código ' + esc(p.code) + '</div></div></div>' +
        '<p>' + esc(p.long || p.short) + '</p>' +
        (p.itinerary.length ? '<h3 style="margin-top:14px">Itinerario</h3><table><thead><tr><th>Día</th><th>Hora</th><th>Actividad</th><th>Lugar</th></tr></thead><tbody>' + p.itinerary.flatMap(d => (d.items.length ? d.items : [{ time: '', activity: d.title, location: '' }]).map((it, i) => '<tr><td>' + (i === 0 ? 'Día ' + d.day : '') + '</td><td>' + esc(it.time) + '</td><td>' + esc(it.activity) + '</td><td>' + esc(it.location) + '</td></tr>')).join('') + '</tbody></table>' : '') +
        '<div class="grid g2" style="margin-top:10px"><div><h3>Incluye</h3><ul class="list-plain">' + p.inclusions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div><div><h3>No incluye</h3><ul class="list-plain">' + p.exclusions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' +
        (p.requirements.length ? '<h3 style="margin-top:12px">Requisitos y recomendaciones</h3><ul class="list-plain">' + p.requirements.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
        '<h3 style="margin-top:12px">Políticas</h3><p class="small"><b>Cancelación:</b> ' + esc(p.policies.cancel) + '<br><b>Modificación:</b> ' + esc(p.policies.modify) + '<br><b>No-show:</b> ' + esc(p.policies.noshow) + '<br><b>Reembolso:</b> ' + esc(p.policies.refund) + '</p>' +
        '<p style="margin-top:12px"><b>Precio desde:</b> ' + (r ? money(r.price, r.currency) + ' por ' + esc(r.segment.toLowerCase()) : 'a consultar') + ' <span class="muted small">· Tarifa sujeta a disponibilidad y temporada.</span></p></div>',
      actions: [{ label: 'Cerrar' }] });
  }

  function product360(el, id, tabId, subId) {
    const p = Q.product(id);
    if (!p) { el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Producto no encontrado', crumbs: [['Catálogo'], ['Productos', '#/catalogo/productos']] }) + UI.card('', UI.empty('No existe el producto ' + id + ' en este tenant (PRD-T02: acceso a otro tenant → denegado).', 'box')) + '</div>'; return; }
    const u = usage(p.id); const r0 = shownRate(p);
    const vig = p.versions.find(v => v.status === 'vigente') || p.versions[p.versions.length - 1] || { v: '—' };
    const steps = ['Borrador', 'En revisión', 'Aprobado', 'Activo']; let fIdx = { DRAFT: 0, REVIEW: 1, APPROVED: 2, ACTIVE: 3 }[p.status]; let failed;
    if (fIdx === undefined) { steps.push(UI.statusLabel(p.status)); fIdx = 4; if (p.status === 'SUSPENDED') failed = 4; }
    const cks = activationChecks(p); const okN = cks.filter(c => c.ok).length;
    const sellable = p.status === 'ACTIVE' && p.flags.bookable;
    el.innerHTML = '<div class="page">' +
      UI.pageHeader({ title: esc(p.name), subtitle: '<span class="mono">' + esc(p.code) + '</span> · SKU <span class="mono">' + esc(p.sku) + '</span> · ' + esc(p.type) + ' · ' + esc(p.category) + ' › ' + esc(p.subcategory || '—') + ' · ' + UI.badge(p.status) + ' · versión ' + esc(vig.v), crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Productos', '#/catalogo/productos'], [p.id]], actions: lifecycleActions(p) }) +
      (['SUSPENDED', 'INACTIVE', 'ARCHIVED'].includes(p.status) ? UI.alert('bad', '<b>PRD-BR-002:</b> producto ' + UI.statusLabel(p.status).toLowerCase() + '. No puede seleccionarse para nuevas cotizaciones ni reservas (PRD-T04 → controlado). Los documentos históricos conservan su snapshot.') : ['DRAFT', 'REVIEW', 'APPROVED'].includes(p.status) ? UI.alert('warn', 'Producto en estado <b>' + UI.statusLabel(p.status) + '</b>: aún no comercializable. Checklist de activación: ' + okN + '/' + cks.length + ' validaciones cumplidas. <a href="javascript:void(0)" id="p-chk">Ver checklist</a>') : '') +
      readOnlyNote(PERM.update) +
      '<div class="card"><div class="card-b"><div class="grid p360-top">' + UI.thumb(p, 150) + '<div style="min-width:0"><div class="upper" style="margin-bottom:6px">Ciclo de vida del producto</div>' + UI.flow(steps, fIdx, failed) +
        '<div class="p-stats">' +
          '<div><div class="upper">Precio desde</div><div class="pv">' + (r0 ? money(r0.price, r0.currency) : '<span class="faint">Sin tarifa</span>') + '</div></div>' +
          (SEE.margin() ? '<div><div class="upper">Margen tarifa base</div><div class="pv">' + pct(marginOf(r0)) + '</div></div>' : '') +
          (SEE.cost() ? '<div><div class="upper">Costo componentes</div><div class="pv">' + money(compCost(p), 'PEN', 0) + '</div></div>' : '<div><div class="upper">Duración</div><div class="pv">' + p.durationValue + ' ' + esc(p.durationUnit) + '</div></div>') +
          '<div><div class="upper">Salidas futuras</div><div class="pv">' + futureDeps(p).length + '</div></div>' +
          '<div><div class="upper">' + (Scope.ownOnly() ? 'Uso en mi cartera' : 'Uso en ventas') + '</div><div class="pv">' + u.quotes.filter(q => Scope.canSee(q)).length + ' cot. · ' + u.res.filter(r => Scope.canSee(r)).length + ' res.</div></div>' +
          '<div><div class="upper">Comercializable</div><div class="pv">' + (sellable ? '<span class="ok">Sí</span>' : '<span class="bad">No</span>') + '</div></div>' +
        '</div></div></div></div></div>' +
      '<div id="p360-tabs"></div></div>';
    on(el, '[data-lc]', (b) => { if (b.disabled) return; changeStatus(p, b.dataset.lc); });
    const pc = el.querySelector('#p-chk'); if (pc) pc.onclick = () => checklistModal(p, 'preview');
    /* Menú de acciones: solo se listan las acciones que el rol puede ejecutar */
    const more = [
      { label: 'Validar checklist de activación (§42)', icon: 'fileCheck', onClick: () => checklistModal(p, 'preview') },
      can(PERM.update) && { label: 'Crear nueva versión', icon: 'copy', onClick: guard(PERM.update, () => newVersionModal(p)) },
      { label: 'Ficha comercial (vista PDF)', icon: 'file', onClick: () => fichaDoc(p) },
      can(PERM.create) && { label: 'Duplicar como nuevo borrador', icon: 'copy', onClick: guard(PERM.create, () => duplicateProduct(p)) }
    ].filter(Boolean);
    if (can(PERM.activate)) more.push('-', { label: 'Archivar', icon: 'box', onClick: guard(PERM.activate, () => { if (p.status === 'ARCHIVED') { UI.toast('El producto ya está archivado.', 'info'); return; } changeStatus(p, 'ARCHIVED'); }) }, { label: 'Eliminar producto', icon: 'trash', onClick: guard(PERM.activate, () => deleteProduct(p)) });
    el.querySelector('#p-more').onclick = (e) => UI.menu(e.currentTarget, more);
    const T360 = [
      { id: 'general', label: 'General', render: b => tabGeneral(b, p) },
      { id: 'componentes', label: 'Componentes', count: p.components.length, render: b => tabComponents(b, p) },
      { id: 'itinerario', label: 'Itinerario', count: p.itinerary.length, render: b => tabItinerary(b, p) },
      { id: 'tarifas', label: SEE.net() ? 'Tarifas' : 'Tarifas de venta', count: visRates(p).length, render: b => tabRates(b, p) },
      { id: 'temporadas', label: 'Temporadas', render: b => tabSeasons(b, p) },
      { id: 'disponibilidad', label: 'Disponibilidad', render: b => tabAvailability(b, p) },
      { id: 'reservas', label: 'Reservas online', render: b => tabBooking(b, p, tabId === 'reservas' ? subId : null) },
      { id: 'salidas', label: 'Salidas', count: p.departures.length, render: b => tabDepartures(b, p) },
      { id: 'proveedores', label: 'Proveedores', hide: !SEE.cost(), render: b => tabProviders(b, p) },
      { id: 'politicas', label: 'Políticas', render: b => tabPolicies(b, p) },
      { id: 'inclusiones', label: 'Inclusiones / Exclusiones', render: b => tabIncl(b, p) },
      { id: 'relacionados', label: 'Relacionados', count: p.related.length, render: b => tabRelated(b, p) },
      { id: 'b2b', label: 'B2B', count: p.b2b.length, hide: !SEE.net(), render: b => tabB2B(b, p) },
      { id: 'promociones', label: 'Promociones', count: p.promotions.length, render: b => tabPromos(b, p) },
      { id: 'rentabilidad', label: 'Costos y rentabilidad', hide: !SEE.margin(), render: b => tabProfit(b, p) },
      { id: 'personalizacion', label: 'Personalización', render: b => tabConfig(b, p) },
      { id: 'contenido', label: 'Contenido', render: b => tabContent(b, p) },
      { id: 'canales', label: 'Canales', count: CH.filter(c => p.channels[c[0]]).length, render: b => tabChannels(b, p) },
      { id: 'versiones', label: 'Versiones', count: p.versions.length, hide: !(can(PERM.update) || SEE.margin()), render: b => tabVersions(b, p) },
      { id: 'historial', label: 'Historial', hide: !SEE.audit(), render: b => tabHistory(b, p) }
    ].filter(t => !t.hide);
    /* Pestañas no permitidas se ocultan (no solo se bloquean). Si se llega por URL a una oculta, se abre General. */
    const tabOk = T360.some(t => t.id === tabId);
    if (tabId && TAB_IDS.includes(tabId) && !tabOk) UI.toast('La pestaña solicitada no está disponible para su rol (' + esc(Q.roleName(Auth.role)) + ').', 'bad');
    UI.tabs(el.querySelector('#p360-tabs'), T360, tabOk ? tabId : 'general', { onChange: (t) => { try { history.replaceState(null, '', '#/catalogo/productos/' + p.id + (t === 'general' ? '' : '/' + t)); } catch (e) { } } });
  }

  /* ---------------- General: ficha maestra §5, indicadores y requisitos §12 ---------------- */
  function tabGeneral(b, p) {
    const pv = Q.provider(p.mainProviderId); const u = usage(p.id); const cks = activationChecks(p); const okN = cks.filter(c => c.ok).length;
    const uq = u.quotes.filter(q => Scope.canSee(q)), ur = u.res.filter(r => Scope.canSee(r));
    const FL = [['bookable', 'Permite reserva', 'is_bookable'], ['quoteable', 'Permite cotización', 'is_quoteable'], ['b2b', 'Disponible B2B', 'is_b2b'], ['ecommerce', 'Publicable e-commerce', 'is_ecommerce'], ['featured', 'Destacado', 'is_featured']];
    b.innerHTML = '<div class="grid g-2-1"><div class="stack">' +
      UI.card('Ficha maestra', UI.dl([
        ['ID', '<span class="mono">' + p.id + '</span>'], ['Tenant', '<span class="mono">' + DB.tenant.id + '</span> · ' + esc(DB.tenant.short)], ['Código interno', '<span class="mono">' + esc(p.code) + '</span>'], ['SKU comercial', '<span class="mono">' + esc(p.sku) + '</span>'],
        ['Nombre comercial', '<b>' + esc(p.name) + '</b>'], ['Nombre interno', esc(p.internalName)], ['Tipo', esc(p.type)], ['Categoría', esc(p.category) + ' › ' + esc(p.subcategory || '—')],
        ['Destino principal', destLink(p.destId) + '<div class="xs faint">' + esc(Q.destPath(p.destId)) + '</div>'], ['Destinos secundarios', p.secondary.length ? '<div class="chip-row">' + p.secondary.map(d => '<a class="tag" href="#/catalogo/destinos/' + d + '">' + esc(Q.destName(d)) + '</a>').join('') + '</div>' : '—'],
        ['Estado', UI.badge(p.status)], ['Descripción corta', esc(p.short)], ['Descripción completa', esc(p.long) || '<span class="faint">Sin descripción larga</span>'],
        ['Duración', p.durationValue + ' ' + esc(p.durationUnit)], ['Modalidad', esc(p.modality)], ['Proveedor principal', provLink(p.mainProviderId) + ' ' + (pv ? UI.badge(provState(pv)) : '')],
        ['Pasajeros', 'Mínimo ' + p.minPax + ' · máximo ' + p.maxPax], ['Edad', p.minAge + ' a ' + p.maxAge + ' años'], ['Anticipación de reserva', 'Mínima ' + p.advMin + ' día(s) · máxima ' + p.advMax + ' días'], ].concat(SEE.margin() ? [['Markup de referencia', fmtN(p.markupPct, 1) + '%']] : []).concat([
        ['Creado', date(p.createdAt)], ['Actualizado', date(p.updatedAt)]
      ])), { actions: '<button class="btn sm" id="g-edit"' + dis(PERM.update) + '>' + ic('edit') + 'Editar ficha</button>' }) +
      UI.card('Requisitos del producto (§12)', '<div class="grid g3" style="margin-bottom:12px"><div><div class="upper">Edad mínima</div><b>' + p.minAge + ' años</b></div><div><div class="upper">Edad máxima</div><b>' + p.maxAge + ' años</b></div><div><div class="upper">Grupo</div><b>' + p.minPax + '–' + p.maxPax + ' pax</b></div></div>' +
        (p.requirements.length ? p.requirements.map((r, i) => '<div class="li-row"><span>' + esc(r) + '</span><button class="btn xs ghost icon" data-rmreq="' + i + '" title="Quitar"' + dis(PERM.update) + '>' + ic('x') + '</button></div>').join('') : '<p class="small faint">Sin requisitos registrados.</p>') +
        (can(PERM.update) ? '<div class="mini-form" style="margin-top:12px"><div class="c4"><div class="field"><label for="rq-cat">Tipo de requisito</label><select class="input" id="rq-cat">' + REQ_CATS.map(c => '<option>' + c + '</option>').join('') + '</select></div></div><div class="c6"><div class="field"><label for="rq-txt">Detalle</label><input class="input" id="rq-txt" placeholder="p. ej. Pasaporte vigente con 6 meses de validez"></div></div><div class="c2"><button class="btn primary" id="rq-add" style="width:100%;justify-content:center">' + ic('plus') + 'Agregar</button></div></div>' : '')) +
      '</div><div class="stack">' +
      UI.card('Indicadores comerciales', FL.map(f => '<div class="li-row"><span>' + f[1] + ' <span class="xs faint mono">' + f[2] + '</span></span>' + (p.flags[f[0]] ? UI.badge('activo', 'Sí') : UI.badge('inactivo', 'No')) + '</div>').join('') + '<p class="xs faint" style="margin-top:8px">Los indicadores solo tienen efecto con el producto en estado Activo.</p>') +
      UI.card('Checklist de activación', '<div class="row between small" style="margin-bottom:6px"><span>' + okN + ' de ' + cks.length + ' validaciones</span><b>' + Math.round(okN / cks.length * 100) + '%</b></div>' + UI.progress(okN / cks.length * 100, okN === cks.length ? 'ok' : 'warn') + '<div style="margin-top:10px">' + cks.filter(c => !c.ok).slice(0, 5).map(c => '<div class="xs bad" style="margin-bottom:3px">✗ ' + esc(c.k) + '</div>').join('') + '</div>', { actions: '<button class="btn sm" id="g-chk">' + ic('fileCheck') + 'Validar</button>' }) +
      UI.card(Scope.ownOnly() ? 'Uso en mi cartera' : 'Uso en ventas y operación', (Access.canRoute('cotizaciones') ? '<div class="upper" style="margin-bottom:6px">Cotizaciones (' + uq.length + ')</div>' + (uq.map(q => '<div class="li-row">' + docLink('cotizaciones', q.id) + UI.badge(q.status) + '</div>').join('') || '<p class="small faint">Sin cotizaciones.</p>') : '') + '<div class="upper" style="margin:10px 0 6px">Reservas (' + ur.length + ')</div>' + (ur.map(r => '<div class="li-row">' + docLink('reservas', r.id) + UI.badge(r.status) + '</div>').join('') || '<p class="small faint">Sin reservas.</p>') + '<p class="xs faint" style="margin-top:8px">Cotizaciones y reservas usan snapshot de la versión aplicada: los cambios posteriores no las alteran (PRD-BR-008/009). Con referencias no se permite borrado físico (PRD-BR-018).</p>') +
      '</div></div>';
    const eb = b.querySelector('#g-edit'); if (eb) eb.onclick = guard(PERM.update, () => editFicha(p));
    b.querySelector('#g-chk').onclick = () => checklistModal(p, 'preview');
    if (b.querySelector('#rq-add')) b.querySelector('#rq-add').onclick = guard(PERM.update, () => { const t = b.querySelector('#rq-txt').value.trim(); if (!t) { UI.toast('Ingrese el detalle del requisito.', 'bad'); return; } p.requirements.push(b.querySelector('#rq-cat').value + ': ' + t); p.updatedAt = T(); Audit.log('Producto', p.id, 'modificar', '', 'Requisito agregado'); Store.save(); UI.toast('Requisito agregado.'); rerender(); });
    on(b, '[data-rmreq]', guard(PERM.update, (x) => { const r = p.requirements.splice(+x.dataset.rmreq, 1)[0]; Audit.log('Producto', p.id, 'modificar', r, 'Requisito eliminado'); Store.save(); rerender(); }));
  }

  function editFicha(p) {
    const cat = DB.categories.find(c => c.name === p.category);
    const provOpts = DB.providers.map(pv => ({ v: pv.id, l: pv.name + ' · ' + pv.type + (provActive(pv) ? '' : ' [' + UI.statusLabel(provState(pv)) + ']'), dis: !provActive(pv) && pv.id !== p.mainProviderId }));
    UI.drawer({ title: 'Editar ficha maestra', sub: p.id + ' · los cambios quedan auditados (§29)', wide: true,
      body: (p.status === 'ACTIVE' ? UI.alert('info', 'Producto activo: los cambios no alteran cotizaciones ni reservas históricas (snapshot, PRD-BR-008). Para cambios estructurales se recomienda crear una nueva versión.') + '<div style="height:12px"></div>' : '') + UI.form([
        { type: 'section', label: 'Identificación' },
        { id: 'name', label: 'Nombre comercial', required: true, value: p.name, col: 6 }, { id: 'internalName', label: 'Nombre interno', value: p.internalName, col: 6 },
        { id: 'code', label: 'Código interno', required: true, value: p.code, col: 4 }, { id: 'sku', label: 'SKU', value: p.sku, col: 4 },
        { id: 'type', label: 'Tipo', type: 'select', required: true, options: DB.productTypes, value: p.type, col: 4 },
        { id: 'category', label: 'Categoría', type: 'select', required: true, options: DB.categories.map(c => c.name), value: p.category, col: 6 },
        { id: 'subcategory', label: 'Subcategoría', type: 'select', options: cat ? cat.subs : [], value: p.subcategory, placeholder: '—', col: 6 },
        selField('destId', 'Destino principal', destOptions().map(o => ({ v: o[0], l: o[1] })), p.destId, { required: true, col: 6 }),
        selField('mainProviderId', 'Proveedor principal', provOpts, p.mainProviderId, { placeholder: 'Seleccione', col: 6, hint: 'Proveedores inactivos o con contrato vencido no disponibles (PRD-BR-007)' }),
        { id: 'short', label: 'Descripción corta', type: 'textarea', rows: 2, value: p.short, col: 12 },
        { id: 'long', label: 'Descripción completa', type: 'textarea', rows: 3, value: p.long, col: 12 },
        { type: 'section', label: 'Operación y restricciones' },
        { id: 'durationValue', label: 'Duración', type: 'number', min: 1, value: p.durationValue, col: 3 }, { id: 'durationUnit', label: 'Unidad', type: 'select', options: DUR_UNITS, value: p.durationUnit, col: 3 },
        { id: 'modality', label: 'Modalidad', type: 'select', options: MODALITIES, value: p.modality, col: 3 }, { id: 'markupPct', label: 'Markup ref. %', type: 'number', step: '0.1', value: p.markupPct, col: 3 },
        { id: 'minPax', label: 'Pax mínimo', type: 'number', min: 1, value: p.minPax, col: 3 }, { id: 'maxPax', label: 'Pax máximo', type: 'number', min: 1, value: p.maxPax, col: 3 },
        { id: 'minAge', label: 'Edad mínima', type: 'number', min: 0, value: p.minAge, col: 3 }, { id: 'maxAge', label: 'Edad máxima', type: 'number', min: 0, value: p.maxAge, col: 3 },
        { id: 'advMin', label: 'Anticipación mín. (días)', type: 'number', min: 0, value: p.advMin, col: 3 }, { id: 'advMax', label: 'Anticipación máx. (días)', type: 'number', min: 0, value: p.advMax, col: 3 },
        { type: 'section', label: 'Indicadores' },
        { id: 'bookable', type: 'switch', label: 'Permite reserva', value: p.flags.bookable, col: 4 }, { id: 'quoteable', type: 'switch', label: 'Permite cotización', value: p.flags.quoteable, col: 4 }, { id: 'b2b', type: 'switch', label: 'Disponible B2B', value: p.flags.b2b, col: 4 },
        { id: 'ecommerce', type: 'switch', label: 'Publicable e-commerce', value: p.flags.ecommerce, col: 4 }, { id: 'featured', type: 'switch', label: 'Destacado', value: p.flags.featured, col: 4 }
      ]),
      onOpen: (d) => { d.querySelector('#category').onchange = (e) => { const c = DB.categories.find(x => x.name === e.target.value); d.querySelector('#subcategory').innerHTML = '<option value="">—</option>' + (c ? c.subs.map(s => '<option>' + esc(s) + '</option>').join('') : ''); }; },
      actions: [{ label: 'Cancelar' }, { label: 'Guardar cambios', cls: 'primary', icon: 'check', onClick: (d) => {
        if (!UI.validate(d)) return false; const f = UI.formData(d);
        if (DB.products.some(x => x !== p && x.code.toLowerCase() === f.code.toLowerCase())) { markErr(d, 'code'); UI.toast('Código interno duplicado.', 'bad'); return false; }
        if (f.minPax > f.maxPax || f.minAge > f.maxAge || f.advMin > f.advMax) { UI.toast('Revise los rangos: mínimo no puede superar al máximo.', 'bad'); return false; }
        const changed = []; ['name', 'internalName', 'code', 'sku', 'type', 'category', 'subcategory', 'destId', 'short', 'long', 'durationValue', 'durationUnit', 'modality', 'markupPct', 'minPax', 'maxPax', 'minAge', 'maxAge', 'advMin', 'advMax'].forEach(k => { if (String(p[k]) !== String(f[k])) { changed.push(k); p[k] = f[k]; } });
        ['bookable', 'quoteable', 'b2b', 'ecommerce', 'featured'].forEach(k => { if (p.flags[k] !== f[k]) { changed.push('is_' + k); p.flags[k] = f[k]; } });
        if (f.mainProviderId !== p.mainProviderId) { Audit.log('Producto', p.id, 'cambio_proveedor', Q.providerName(p.mainProviderId), Q.providerName(f.mainProviderId)); p.mainProviderId = f.mainProviderId; }
        p.updatedAt = T();
        if (changed.length) Audit.log('Producto', p.id, 'modificar', '', changed.join(', '));
        Store.save(); UI.toast(changed.length ? 'Ficha actualizada (' + changed.length + ' campo(s)).' : 'Sin cambios en los campos.'); rerender();
      } }] });
  }

  /* ---------------- Componentes §9 / §10 ---------------- */
  function tabComponents(b, p) {
    const comps = p.components.slice().sort((a, c) => a.order - c.order);
    const issues = comps.filter(c => { if (c.productId) return false; const s = Q.service(c.serviceId); return !svcOk(s) || !provActive(Q.provider(s && s.providerId)); });
    const E = can(PERM.update); const C = SEE.cost();
    const cc = (v) => C ? v : '';
    const rows = comps.map((c, i) => {
      if (c.productId) { const p2 = Q.product(c.productId); const r = p2 && mainRate(p2);
        return '<tr><td class="num">' + c.order + '</td><td><div class="cell-main">' + prodLink(c.productId) + '</div><div class="cell-sub">Producto componente (paquete) · <span class="mono">' + c.productId + '</span></div></td><td>' + (p2 ? provLink(p2.mainProviderId) : '—') + '</td><td class="num">' + c.qty + '</td><td>' + esc(c.unit) + '</td><td>' + (c.required ? 'Sí' : 'No') + '</td><td>' + (c.included ? 'Sí' : 'No') + '</td>' + cc('<td class="num">' + (r ? money(r.cost, r.currency) : '—') + '</td><td class="num">' + fmtN(compCostPEN(c)) + '</td>') + '<td>' + (p2 ? UI.badge(p2.status) : '—') + '</td><td class="small">' + esc(c.notes || '') + '</td><td class="nowrap">' + compBtns(i, comps.length, E) + '</td></tr>'; }
      const s = Q.service(c.serviceId); const pv = s && Q.provider(s.providerId);
      return '<tr><td class="num">' + c.order + '</td><td><div class="cell-main">' + svcLink(c.serviceId) + '</div><div class="cell-sub">' + esc(s ? s.type : '') + ' · origen <span class="mono">' + esc(c.serviceId) + '</span></div></td><td>' + provLink(s && s.providerId) + (provActive(pv) ? '' : ' ' + UI.badge(provState(pv))) + '</td><td class="num">' + c.qty + '</td><td>' + esc(c.unit) + '</td><td>' + (c.required ? 'Sí' : 'No') + '</td><td>' + (c.included ? 'Sí' : 'No') + '</td>' + cc('<td class="num">' + (s ? money(s.cost, s.currency) : '—') + '</td><td class="num">' + fmtN(compCostPEN(c)) + '</td>') + '<td class="nowrap">' + (s ? (svcOk(s) ? '<span class="small">hasta ' + dateShort(s.validTo) + '</span>' : UI.badge('vencido')) : '—') + '</td><td class="small">' + esc(c.notes || '') + '</td><td class="nowrap">' + compBtns(i, comps.length, E) + '</td></tr>';
    }).join('');
    const tot = compCost(p);
    b.innerHTML = (issues.length ? UI.alert('bad', '<b>PRD-BR-007:</b> ' + issues.length + ' componente(s) con servicio vencido o proveedor inactivo/vencido. No estarán disponibles para nuevas ventas y bloquean la activación.') + '<div style="height:12px"></div>' : '') +
      UI.card('Componentes del producto', comps.length ? tbl([['Orden', 'num'], 'Componente / origen', 'Proveedor', ['Cant.', 'num'], 'Unidad', 'Req.', 'Incl.'].concat(C ? [['Costo unit.', 'num'], ['Subtotal S/', 'num']] : []).concat(['Vigencia', 'Notas', '']), rows + (C ? '<tr><td colspan="8"><b>Costo total calculado</b> <span class="xs faint">(convertido a soles, TC ' + DB.settings.fx + ')</span></td><td class="num"><b>' + fmtN(tot) + '</b></td><td colspan="3" class="small faint">≈ ' + money(tot / DB.settings.fx, 'USD') + '</td></tr>' : '')) : UI.empty('El producto no tiene componentes. Agregue servicios de proveedores o productos (paquetes).', 'layers'),
        { tight: true, sub: C ? 'Cada componente conserva service_id, provider_id, cantidad, unidad, orden, requerido, incluido, costo, notas y vigencia de origen (PRD-BR-006)' : 'Servicios incluidos en el producto. Los costos de proveedor no se muestran para su rol.', actions: '<button class="btn sm" id="c-addp"' + dis(PERM.update) + '>' + ic('box') + 'Agregar producto</button><button class="btn sm primary" id="c-add"' + dis(PERM.update) + '>' + ic('plus') + 'Agregar servicio</button>' }) +
      '<p class="xs faint" style="margin-top:10px">Los componentes seleccionados se convierten en servicios operativos al reservar (transporte → asignación de vehículo y conductor; guía → asignación de guía; hotel → rooming list), §38.</p>';
    const save = (msg, before, after) => { p.updatedAt = T(); Audit.log('Producto', p.id, 'cambio_componentes', before || '', after || msg); Store.save(); UI.toast(msg); rerender(); };
    const ca = b.querySelector('#c-add'); if (ca) ca.onclick = guard(PERM.update, () => compModal(p, null, save));
    const cp = b.querySelector('#c-addp'); if (cp) cp.onclick = guard(PERM.update, () => compModal(p, null, save, true));
    on(b, '[data-cup]', guard(PERM.update, (x) => { const i = +x.dataset.cup; if (i <= 0) return; const a = comps[i], c = comps[i - 1]; const o = a.order; a.order = c.order; c.order = o; if (a.order === c.order) a.order--; save('Orden actualizado.', '', 'Reordenar: ' + (a.serviceId || a.productId) + ' ↑'); }));
    on(b, '[data-cdn]', guard(PERM.update, (x) => { const i = +x.dataset.cdn; if (i >= comps.length - 1) return; const a = comps[i], c = comps[i + 1]; const o = a.order; a.order = c.order; c.order = o; if (a.order === c.order) a.order++; save('Orden actualizado.', '', 'Reordenar: ' + (a.serviceId || a.productId) + ' ↓'); }));
    on(b, '[data-ced]', guard(PERM.update, (x) => compModal(p, comps[+x.dataset.ced], save)));
    on(b, '[data-crm]', guard(PERM.update, (x) => { const c = comps[+x.dataset.crm]; const name = c.productId ? Q.productName(c.productId) : (Q.service(c.serviceId) || {}).name; UI.confirm({ title: 'Quitar componente', message: '¿Quitar <b>' + esc(name) + '</b> del producto? Las cotizaciones existentes conservan su snapshot.', danger: true, confirmLabel: 'Quitar', onConfirm: () => { p.components.splice(p.components.indexOf(c), 1); p.components.sort((a, d) => a.order - d.order).forEach((k, i) => k.order = i + 1); save('Componente quitado.', c.serviceId || c.productId, 'eliminado'); } }); }));
  }
  const compBtns = (i, n, E) => '<button class="btn xs ghost icon" data-cup="' + i + '" title="Subir"' + (!E ? NP : i > 0 ? '' : ' disabled') + '>' + ic('chevronDown').replace('<svg', '<svg style="transform:rotate(180deg)"') + '</button><button class="btn xs ghost icon" data-cdn="' + i + '" title="Bajar"' + (!E ? NP : i < n - 1 ? '' : ' disabled') + '>' + ic('chevronDown') + '</button><button class="btn xs ghost icon" data-ced="' + i + '" title="Editar"' + (E ? '' : NP) + '>' + ic('edit') + '</button><button class="btn xs ghost icon" data-crm="' + i + '" title="Quitar"' + (E ? '' : NP) + '>' + ic('trash') + '</button>';

  function compModal(p, c, save, isProduct) {
    const prodMode = isProduct || (c && c.productId);
    const fields = [];
    if (prodMode) fields.push(selField('ref', 'Producto componente', DB.products.filter(x => x.id !== p.id).map(x => ({ v: x.id, l: x.id + ' · ' + x.name + (x.status === 'ACTIVE' ? '' : ' [' + UI.statusLabel(x.status) + ' · PRD-BR-002]'), dis: x.status !== 'ACTIVE' && !(c && c.productId === x.id) })), c && c.productId, { required: true, placeholder: 'Seleccione', col: 12, hint: 'Producto compuesto (§10): el componente mantiene la trazabilidad a su producto de origen.' }));
    else fields.push(selField('ref', 'Servicio', svcOptions(c && c.serviceId, []).map(g => Object.assign(g, { items: g.items.map(o => Object.assign(o, { dis: o.dis && !(c && c.serviceId === o.v) })) })), c && c.serviceId, { required: true, placeholder: 'Seleccione', col: 12, hint: 'Servicios vencidos o de proveedores inactivos no seleccionables (PRD-BR-007).' }));
    fields.push({ id: 'qty', label: 'Cantidad', type: 'number', min: 1, required: true, value: c ? c.qty : 1, col: 3 }, { id: 'unit', label: 'Unidad', type: 'select', options: UNITS, value: c ? c.unit : 'pax', col: 3 }, { id: 'order', label: 'Orden', type: 'number', min: 1, value: c ? c.order : p.components.length + 1, col: 2 }, { id: 'required', type: 'checkbox', label: 'Requerido', value: c ? c.required : true, col: 2 }, { id: 'included', type: 'checkbox', label: 'Incluido', value: c ? c.included : true, col: 2 }, { id: 'notes', label: 'Notas', value: c ? c.notes : '', col: 12 });
    formModal({ title: (c ? 'Editar' : 'Agregar') + ' componente', sub: p.name, fields, onOpen: (m) => { const r = m.querySelector('#ref'); if (!prodMode) r.onchange = () => { const s = Q.service(r.value); if (s) m.querySelector('#unit').value = UNITS.includes(s.unit) ? s.unit : 'unidad'; }; },
      onSave: (d) => {
        const before = c ? JSON.stringify({ q: c.qty, u: c.unit }) : '';
        const obj = c || {}; if (prodMode) { obj.productId = d.ref; delete obj.serviceId; } else { obj.serviceId = d.ref; delete obj.productId; }
        Object.assign(obj, { qty: Math.max(1, d.qty), unit: d.unit, order: d.order || p.components.length + 1, required: d.required, included: d.included, notes: d.notes });
        if (!c) { p.components.push(obj); if (!p.mainProviderId && !prodMode) p.mainProviderId = Q.service(d.ref).providerId; }
        save(c ? 'Componente actualizado.' : 'Componente agregado.', before, (obj.serviceId || obj.productId) + ' × ' + obj.qty + ' ' + obj.unit);
      } });
  }

  /* ---------------- Itinerario §14 ---------------- */
  function tabItinerary(b, p) {
    const E = can(PERM.update); const C = SEE.cost();
    const needs = TYPES_ITIN.includes(p.type);
    b.innerHTML = (needs && !p.itinerary.length ? UI.alert('warn', 'El tipo ' + esc(p.type) + ' requiere itinerario para activarse (§42).') + '<div style="height:12px"></div>' : '') +
      '<div class="row between" style="margin-bottom:12px"><div class="small muted">' + (E ? 'Constructor por día: hora, actividad, tipo (servicio, hotel, transporte, alimentación, guía), ubicación, nota, costo y precio (PROC-016).' : 'Itinerario día a día del producto (solo lectura).') + '</div><button class="btn primary sm" id="it-addd"' + dis(PERM.update) + '>' + ic('plus') + 'Agregar día</button></div>' +
      (p.itinerary.length ? '<div class="stack">' + p.itinerary.map((d, di) => UI.card('<span class="day-h" style="justify-content:flex-start"><span class="day-n">D' + d.day + '</span><span>' + esc(d.title) + '</span></span>',
        d.items.length ? tbl(['Hora', 'Actividad', 'Tipo', 'Ubicación', 'Servicio vinculado', 'Nota'].concat(C ? [['Costo / precio', 'num']] : []).concat(E ? [''] : []), d.items.map((it, ii) => '<tr><td class="mono nowrap">' + esc(it.time) + '</td><td class="cell-main">' + esc(it.activity) + '</td><td><span class="tag">' + esc(it.type) + '</span></td><td>' + esc(it.location) + '</td><td class="small">' + (it.serviceId ? svcLink(it.serviceId) : '<span class="faint">—</span>') + '</td><td class="small">' + esc(it.note || '') + '</td>' + (C ? '<td class="num small">' + (it.cost || it.price ? fmtN(it.cost || 0) + ' / ' + fmtN(it.price || 0) : '—') + '</td>' : '') + (E ? '<td class="nowrap"><button class="btn xs ghost icon" data-ied="' + di + '|' + ii + '" title="Editar">' + ic('edit') + '</button><button class="btn xs ghost icon" data-irm="' + di + '|' + ii + '" title="Quitar">' + ic('x') + '</button></td>' : '') + '</tr>').join(''), 'compact') : '<p class="small faint" style="padding:12px 16px">Día sin actividades.</p>',
        { tight: true, actions: '<button class="btn xs" data-iadd="' + di + '"' + (E ? '' : NP) + '>' + ic('plus') + 'Ítem</button><button class="btn xs ghost" data-ided="' + di + '"' + (E ? '' : NP) + '>' + ic('edit') + 'Día</button><button class="btn xs ghost" data-idrm="' + di + '"' + (E ? '' : NP) + '>' + ic('trash') + '</button>' })).join('') + '</div>' : UI.card('', UI.empty('Sin itinerario. Agregue el primer día.', 'route')));
    const save = (msg, detail) => { p.updatedAt = T(); Audit.log('Producto', p.id, 'cambio_itinerario', '', detail || msg); Store.save(); UI.toast(msg); rerender(); };
    const dayModal = (d) => formModal({ title: d ? 'Editar día ' + d.day : 'Nuevo día', size: 'sm', fields: [{ id: 'title', label: 'Título del día', required: true, value: d ? d.title : '', col: 12, placeholder: 'p. ej. Llegada y City Tour' }], onSave: (f) => { if (d) d.title = f.title; else p.itinerary.push({ day: p.itinerary.length + 1, title: f.title, items: [] }); save(d ? 'Día actualizado.' : 'Día agregado.', (d ? 'Día ' + d.day : 'Nuevo día') + ': ' + f.title); } });
    const itemModal = (d, it) => formModal({ title: (it ? 'Editar' : 'Nueva') + ' actividad · Día ' + d.day, fields: [
        { id: 'time', label: 'Hora', type: 'time', value: it && /^\d\d:\d\d$/.test(it.time) ? it.time : '', col: 3, hint: 'Vacío = sin hora fija' }, { id: 'activity', label: 'Actividad', required: true, value: it ? it.activity : '', col: 9 },
        { id: 'type', label: 'Tipo', type: 'select', options: ITEM_TYPES, value: it ? it.type : 'Actividad', col: 4 }, { id: 'location', label: 'Ubicación', value: it ? it.location : '', col: 8 },
        selField('serviceId', 'Servicio vinculado (componente)', p.components.filter(c => c.serviceId).map(c => ({ v: c.serviceId, l: c.serviceId + ' · ' + (Q.service(c.serviceId) || {}).name })), it && it.serviceId, { placeholder: 'Ninguno', col: 12 }),
        { id: 'note', label: 'Nota', value: it ? it.note || '' : '', col: 12 }, { id: 'image', label: 'Imagen (referencia de galería)', value: it ? it.image || '' : '', col: 6, placeholder: 'p. ej. portada-mapi.jpg' },
        { id: 'cost', label: 'Costo', type: 'number', step: '0.01', value: it ? it.cost || '' : '', col: 3 }, { id: 'price', label: 'Precio', type: 'number', step: '0.01', value: it ? it.price || '' : '', col: 3 }
      ], onSave: (f) => { const o = it || {}; Object.assign(o, { time: f.time || '—', activity: f.activity, type: f.type, location: f.location, serviceId: f.serviceId, note: f.note, image: f.image, cost: f.cost || 0, price: f.price || 0 }); if (!it) d.items.push(o); d.items.sort((x, y) => String(x.time).localeCompare(String(y.time))); save(it ? 'Actividad actualizada.' : 'Actividad agregada.', 'Día ' + d.day + ' · ' + o.time + ' ' + o.activity); } });
    const ad = b.querySelector('#it-addd'); if (ad) ad.onclick = guard(PERM.update, () => dayModal(null));
    on(b, '[data-iadd]', guard(PERM.update, (x) => itemModal(p.itinerary[+x.dataset.iadd], null)));
    on(b, '[data-ided]', guard(PERM.update, (x) => dayModal(p.itinerary[+x.dataset.ided])));
    on(b, '[data-idrm]', guard(PERM.update, (x) => { const d = p.itinerary[+x.dataset.idrm]; UI.confirm({ title: 'Quitar día ' + d.day, message: 'Se eliminará el día y sus ' + d.items.length + ' actividad(es). Los días siguientes se renumeran.', danger: true, confirmLabel: 'Quitar', onConfirm: () => { p.itinerary.splice(p.itinerary.indexOf(d), 1); p.itinerary.forEach((k, i) => k.day = i + 1); save('Día eliminado.', 'Día eliminado: ' + d.title); } }); }));
    on(b, '[data-ied]', guard(PERM.update, (x) => { const [di, ii] = x.dataset.ied.split('|').map(Number); itemModal(p.itinerary[di], p.itinerary[di].items[ii]); }));
    on(b, '[data-irm]', guard(PERM.update, (x) => { const [di, ii] = x.dataset.irm.split('|').map(Number); const it = p.itinerary[di].items.splice(ii, 1)[0]; save('Actividad eliminada.', 'Día ' + (di + 1) + ' · eliminado ' + it.activity); }));
  }

  /* ---------------- Tarifas §16 / §19 ---------------- */
  function rateModal(p, onDone) {
    formModal({ title: 'Nueva tarifa', sub: p.name + ' · PROC-017: moneda → costo → venta → vigencia → segmento → canal → temporada', size: 'lg',
      fields: [
        { id: 'type', label: 'Tipo de tarifa', type: 'select', required: true, options: RATE_TYPES, value: 'Venta', col: 4 }, { id: 'segment', label: 'Segmento', type: 'select', required: true, options: SEGMENTS, value: 'Adulto', col: 4 }, { id: 'channel', label: 'Canal', type: 'select', required: true, options: RATE_CHANNELS, value: 'Directo', col: 4 },
        { id: 'currency', label: 'Moneda', type: 'select', options: [['PEN', 'PEN — Soles'], ['USD', 'USD — Dólares']], placeholder: 'Seleccione', col: 3, hint: 'Obligatoria (PRD-BR-004)' }, { id: 'basis', label: 'Base de precio', type: 'select', options: PRICE_BASIS, value: 'Por persona', col: 3 },
        { id: 'cost', label: 'Costo', type: 'number', step: '0.01', required: true, value: Math.round((mainRate(p) || {}).cost || 0) || '', col: 3 }, { id: 'price', label: 'Precio de venta', type: 'number', step: '0.01', required: true, col: 3 },
        { id: 'minPrice', label: 'Precio mínimo', type: 'number', step: '0.01', col: 3 }, { id: 'maxPrice', label: 'Precio máximo', type: 'number', step: '0.01', col: 3 },
        { id: 'validFrom', label: 'Vigencia desde', type: 'date', value: T(), col: 3, hint: 'Obligatoria (PRD-BR-004)' }, { id: 'validTo', label: 'Vigencia hasta', type: 'date', col: 3, hint: 'Obligatoria (PRD-BR-004)' },
        selField('season', 'Temporada', DB.seasons.map(s => ({ v: s.id, l: s.name + ' (' + dateShort(s.from) + ' → ' + dateShort(s.to) + ')' + (s.status === 'activa' ? '' : ' [inactiva]'), dis: s.status !== 'activa' })), '', { placeholder: 'Sin temporada', col: 6 }),
        { id: 'conditions', label: 'Condiciones (reglas §19)', col: 6, placeholder: 'p. ej. Mín. 4 pax; anticipación ≥ 7 días; lun–vie' }
      ],
      check: (m) => { const g = (k) => m.querySelector('#' + k).value; const r = { currency: g('currency'), validFrom: g('validFrom'), validTo: g('validTo'), price: +g('price'), cost: +g('cost'), minPrice: +g('minPrice') || 0, maxPrice: +g('maxPrice') || 0 }; if (validateRate(r, (k) => markErr(m, k))) return false; },
      onSave: (d) => { const r = { id: nextId('TAR-', DB.products.flatMap(x => x.rates), 3), type: d.type, segment: d.segment, channel: d.channel, currency: d.currency, basis: d.basis, cost: d.cost, price: d.price, minPrice: d.minPrice || null, maxPrice: d.maxPrice || null, validFrom: d.validFrom, validTo: d.validTo, season: d.season, conditions: d.conditions, status: 'vigente' }; p.rates.push(r); p.updatedAt = T(); Audit.log('Tarifa', r.id, 'crear', '', p.id + ' · ' + r.type + ' ' + r.segment + ' ' + r.channel + ' ' + r.currency + ' ' + r.price); Store.save(); UI.toast('Tarifa ' + r.id + ' creada.'); onDone ? onDone() : rerender(); } });
  }

  function tabRates(b, p) {
    const E = can(PERM.rates); const C = SEE.cost(), M = SEE.margin();
    const RS = visRates(p);
    const valid = p.rates.filter(r => rateState(r) === 'vigente');
    b.innerHTML = (!valid.length ? UI.alert('bad', '<b>Sin tarifas vigentes.</b> El producto no puede cotizarse ni activarse (PRD-BR-005, §42).') + '<div style="height:12px"></div>' : '') + readOnlyNote(PERM.rates) +
      UI.card(SEE.net() ? 'Tarifas del producto' : 'Tarifas de venta', RS.length ? tbl(['ID', 'Tipo', 'Segmento', 'Canal', 'Moneda'].concat(C ? [['Costo', 'num']] : []).concat([['Venta', 'num']]).concat(M ? [['Margen', 'num']] : []).concat(['Base', 'Vigencia', 'Temporada', 'Estado']).concat(E ? [''] : []), RS.map((r) => { const i = p.rates.indexOf(r); const st = rateState(r); return '<tr' + (st === 'vencida' ? ' style="opacity:.7"' : '') + '><td class="mono">' + r.id + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.segment) + '</td><td>' + esc(r.channel) + '</td><td>' + (r.currency || '<span class="bad">—</span>') + '</td>' + (C ? '<td class="num">' + fmtN(r.cost) + '</td>' : '') + '<td class="num"><b>' + fmtN(r.price) + '</b></td>' + (M ? '<td class="num">' + pct(marginOf(r)) + '</td>' : '') + '<td class="small">' + esc(r.basis || 'Por persona') + (r.conditions ? '<div class="cell-sub">' + esc(r.conditions) + '</div>' : '') + '</td><td class="nowrap small">' + dateShort(r.validFrom) + ' → ' + date(r.validTo) + '</td><td class="small">' + esc(r.season ? (Q.season(r.season) || {}).name || r.season : '—') + '</td><td>' + rateBadge(r) + '</td>' + (E ? '<td class="nowrap"><button class="btn xs" data-rprice="' + i + '"' + (st !== 'vencida' && st !== 'inactiva' ? '' : ' disabled') + '>' + ic('edit') + 'Precio</button> <button class="btn xs ghost" data-rtog="' + i + '"' + (st !== 'vencida' ? '' : ' disabled') + '>' + (st === 'inactiva' ? 'Activar' : 'Desactivar') + '</button></td>' : '') + '</tr>'; }).join(''), 'compact') : UI.empty('Sin tarifas registradas.', 'tag'),
        { tight: true, sub: SEE.net() ? 'Múltiples tarifas por tipo, segmento y canal (PRD-BR-016). Las vencidas no son seleccionables (PRD-BR-005, PRD-T05).' : 'Precios de venta por segmento y canal. Tarifas netas B2B' + (C ? '' : ', costos de proveedor') + ' y márgenes no se muestran para su rol.', actions: '<button class="btn sm" id="r-resolve">' + ic('search') + 'Resolver tarifa aplicable</button><button class="btn sm primary" id="r-new"' + dis(PERM.rates) + '>' + ic('plus') + 'Nueva tarifa</button>' }) +
      '<p class="xs faint" style="margin-top:10px">Los cambios de precio quedan auditados (PRD-T11) y no alteran cotizaciones ni reservas existentes, que conservan el snapshot de la tarifa aplicada (PRD-T06). <a href="#/catalogo/tarifas">Ver tarifas consolidadas</a></p>';
    const nb = b.querySelector('#r-new'); if (nb) nb.onclick = guard(PERM.rates, () => rateModal(p));
    b.querySelector('#r-resolve').onclick = () => resolveRateModal(p);
    on(b, '[data-rprice]', guard(PERM.rates, (x) => { const r = p.rates[+x.dataset.rprice]; if (rateState(r) === 'vencida') { UI.toast('<b>PRD-BR-005:</b> tarifa vencida; cree una nueva tarifa vigente.', 'bad'); return; }
      formModal({ title: 'Cambio de precio — ' + r.id, size: 'sm', sub: r.type + ' · ' + r.segment + ' · ' + r.channel, pre: UI.alert('info', 'Precio actual: <b>' + money(r.price, r.currency) + '</b> · costo ' + money(r.cost, r.currency) + '. El cambio se audita y no modifica cotizaciones emitidas (snapshot).') + '<div style="height:10px"></div>',
        fields: [{ id: 'cost', label: 'Nuevo costo', type: 'number', step: '0.01', required: true, value: r.cost, col: 6 }, { id: 'price', label: 'Nuevo precio', type: 'number', step: '0.01', required: true, value: r.price, col: 6 }, { id: 'reason', label: 'Motivo del cambio', type: 'textarea', rows: 2, required: true, col: 12 }],
        onSave: (d) => { if (!(d.price > 0)) { UI.toast('Precio inválido.', 'bad'); return false; } if (r.minPrice && d.price < r.minPrice) { UI.toast('Por debajo del precio mínimo (' + money(r.minPrice, r.currency) + ').', 'bad'); return false; } const before = r.currency + ' ' + r.price + ' (costo ' + r.cost + ')'; r.price = d.price; r.cost = d.cost; p.updatedAt = T(); Audit.log('Tarifa', r.id, 'cambio_precio', before, r.currency + ' ' + r.price + ' (costo ' + r.cost + ') — ' + d.reason); Store.save(); UI.toast('Precio actualizado y auditado.'); rerender(); } }); }));
    on(b, '[data-rtog]', guard(PERM.rates, (x) => { const r = p.rates[+x.dataset.rtog]; const before = rateState(r); r.status = before === 'inactiva' ? 'vigente' : 'inactiva'; Audit.log('Tarifa', r.id, 'cambio_estado', before, rateState(r)); Store.save(); UI.toast('Tarifa ' + (r.status === 'inactiva' ? 'desactivada' : 'activada') + '.'); rerender(); }));
  }

  function resolveRateModal(p) {
    UI.modal({ title: 'Resolver tarifa aplicable', sub: p.name + ' · simulación de la regla de selección (backend)', size: 'lg',
      body: '<div class="form-grid"><div class="field c4"><label for="rs-date">Fecha de servicio</label><input class="input" type="date" id="rs-date" value="' + addDays(T(), 7) + '"></div><div class="field c4"><label for="rs-seg">Segmento</label><select class="input" id="rs-seg">' + SEGMENTS.map(s => '<option>' + s + '</option>').join('') + '</select></div><div class="field c4"><label for="rs-ch">Canal</label><select class="input" id="rs-ch">' + RATE_CHANNELS.filter(c => c !== 'Todos').map(s => '<option>' + s + '</option>').join('') + '</select></div></div><div id="rs-out" style="margin-top:14px"></div>',
      onOpen: (m) => { const run = () => { const dt = m.querySelector('#rs-date').value, sg = m.querySelector('#rs-seg').value, chn = m.querySelector('#rs-ch').value; const season = Pricing.seasonFor(dt);
        const rows = visRates(p).map(r => { let why = ''; if (r.status === 'inactiva') why = 'Tarifa inactiva'; else if (!r.validTo || r.validTo < T()) why = 'Vencida (PRD-BR-005)'; else if (dt < r.validFrom || dt > r.validTo) why = 'Fuera de vigencia para la fecha'; else if (r.segment !== sg) why = 'Otro segmento'; else if (r.channel !== chn && r.channel !== 'Todos') why = 'Otro canal'; return { r, why }; });
        const ok = rows.filter(x => !x.why).sort((a, c) => (a.r.season === (season || {}).id ? -1 : 0) - (c.r.season === (season || {}).id ? -1 : 0));
        m.querySelector('#rs-out').innerHTML = (ok.length ? UI.alert('ok', 'Tarifa aplicable: <b>' + ok[0].r.id + '</b> · ' + money(ok[0].r.price, ok[0].r.currency) + ' (' + esc(ok[0].r.type) + ')' + (season ? ' · temporada vigente para la fecha: ' + esc(season.name) + ' (×' + fmtN(season.factor, 2) + ')' : '')) : UI.alert('bad', 'No hay tarifa aplicable para la combinación. El producto no puede cotizarse para esa fecha/segmento/canal.')) + '<div style="height:10px"></div>' + tbl(['Tarifa', 'Segmento', 'Canal', 'Vigencia', ['Precio', 'num'], 'Resultado'], rows.map(x => '<tr><td class="mono">' + x.r.id + '</td><td>' + esc(x.r.segment) + '</td><td>' + esc(x.r.channel) + '</td><td class="small nowrap">' + dateShort(x.r.validFrom) + ' → ' + date(x.r.validTo) + '</td><td class="num">' + money(x.r.price, x.r.currency) + '</td><td>' + (x.why ? '<span class="small ' + (x.why.includes('Vencida') ? 'bad' : 'faint') + '">No seleccionable · ' + esc(x.why) + '</span>' : UI.badge('vigente', 'Seleccionable')) + '</td></tr>').join(''), 'compact'); };
        m.querySelectorAll('input,select').forEach(i => i.onchange = run); run(); },
      actions: [{ label: 'Cerrar' }] });
  }

  /* ---------------- Temporadas del producto §18 ---------------- */
  function tabSeasons(b, p) {
    const ids = [...new Set(p.rates.map(r => r.season).filter(Boolean).concat(p.seasons))];
    const r0 = mainRate(p); const E = can(PERM.rates);
    b.innerHTML = UI.card('Temporadas asociadas', ids.length ? tbl(['Temporada', 'Tipo', 'Rango', ['Prioridad', 'num'], ['Factor', 'num'], ['Precio base ref.', 'num'], ['Precio en temporada', 'num'], 'Tarifas', 'Estado', ''], ids.map(id => { const s = Q.season(id); if (!s) return ''; const used = p.rates.filter(r => r.season === id); return '<tr><td class="cell-main">' + esc(s.name) + '</td><td>' + esc(s.type) + '</td><td class="nowrap small">' + date(s.from) + ' → ' + date(s.to) + '</td><td class="num">' + s.priority + '</td><td class="num">×' + fmtN(s.factor, 2) + '</td><td class="num">' + (r0 ? money(r0.price, r0.currency) : '—') + '</td><td class="num"><b>' + (r0 ? money(r0.price * s.factor, r0.currency) : '—') + '</b></td><td class="small mono">' + (used.map(r => r.id).join(', ') || '<span class="faint">asociación directa</span>') + '</td><td>' + UI.badge(s.status) + '</td><td>' + (used.length ? '' : '<button class="btn xs ghost" data-sdis="' + id + '"' + (E ? '' : NP) + '>Desasociar</button>') + '</td></tr>'; }).join(''), 'compact') : UI.empty('Sin temporadas asociadas.', 'sun'),
      { tight: true, sub: 'La tarifa solo se usa cuando la fecha de reserva/servicio cumple la vigencia de la temporada. La de mayor prioridad (menor número) prevalece ante solapamientos.', actions: '<a class="btn sm" href="#/catalogo/tarifas/temporadas">' + ic('calendar') + 'Administrar temporadas</a><button class="btn sm primary" id="s-assoc"' + dis(PERM.rates) + '>' + ic('plus') + 'Asociar temporada</button>' });
    const a = b.querySelector('#s-assoc'); if (a) a.onclick = guard(PERM.rates, () => formModal({ title: 'Asociar temporada', size: 'sm', fields: [selField('season', 'Temporada', DB.seasons.filter(s => !ids.includes(s.id)).map(s => ({ v: s.id, l: s.name + ' · ' + s.type + (s.status === 'activa' ? '' : ' [inactiva]'), dis: s.status !== 'activa' })), '', { required: true, placeholder: 'Seleccione', col: 12 })], onSave: (d) => { p.seasons.push(d.season); Audit.log('Producto', p.id, 'asociar_temporada', '', d.season); Store.save(); UI.toast('Temporada asociada.'); rerender(); } }));
    on(b, '[data-sdis]', guard(PERM.rates, (x) => { p.seasons = p.seasons.filter(s => s !== x.dataset.sdis); Audit.log('Producto', p.id, 'desasociar_temporada', x.dataset.sdis, ''); Store.save(); UI.toast('Temporada desasociada.'); rerender(); }));
  }

  /* ---------------- Disponibilidad §20 ---------------- */
  function tabAvailability(b, p) {
    const E = can(PERM.avail);
    const deps = futureDeps(p); const hs = (DB.catalogHolds || []).filter(h => h.status === 'hold' && p.departures.some(d => d.id === h.depId));
    b.innerHTML = UI.alert('info', 'La disponibilidad por fecha que consumen el sitio web, el widget y el cotizador (rangos disponible / cerrado / agotado, días de operación y anticipación) se configura en <a href="#/catalogo/productos/' + esc(p.id) + '/reservas">Reservas online › Disponibilidad</a> (motor de reservas v2.1).') + '<div style="height:12px"></div>' + '<div class="grid g-2-1"><div class="stack">' + readOnlyNote(PERM.avail) +
      UI.card('Modelo de disponibilidad', '<div class="avm">' + AVAIL.map(a => '<label class="' + (p.availabilityModel === a[0] ? 'on' : '') + '"><input type="radio" name="av-m" value="' + a[0] + '"' + (p.availabilityModel === a[0] ? ' checked' : '') + (E ? '' : ' disabled') + '><span><b class="small mono">' + a[0] + '</b><br><span class="xs muted">' + esc(a[2]) + '</span></span></label>').join('') + '</div>' +
        '<div class="form-grid" style="margin-top:14px"><div class="field c4"><label for="av-cap">Capacidad / cupo de referencia</label><input class="input" id="av-cap" type="number" min="0" value="' + esc(p.availCfg.capacity) + '"' + (E ? '' : ' disabled') + '></div><div class="field c4"><label for="av-src">Fuente</label><select class="input" id="av-src"' + (E ? '' : ' disabled') + '><option value="interna"' + (p.availCfg.source !== 'externa' ? ' selected' : '') + '>Inventario propio</option><option value="externa"' + (p.availCfg.source === 'externa' ? ' selected' : '') + '>Proveedor externo (adaptador)</option></select></div><div class="c4" style="display:flex;align-items:flex-end"><button class="btn primary" id="av-save"' + dis(PERM.avail) + '>' + ic('check') + 'Guardar configuración</button></div></div>') +
      UI.alert('info', '<b>PRD-BR-013:</b> la disponibilidad externa solo se trata como disponibilidad real cuando existe integración confirmada. <b>§37:</b> el producto define la configuración; el Availability Engine determina la disponibilidad real y no se duplica la lógica en Productos.') +
      (p.availCfg.source === 'externa' ? UI.alert('warn', 'Fuente externa: el adaptador de proveedores (INT-06) está en estado <b>parcial</b>. La disponibilidad informada es referencial y debe confirmarse con el proveedor antes de confirmar la reserva (PRD-BR-012).') : '') +
      '</div><div class="stack">' +
      UI.card('Situación actual', UI.dl([['Modelo', '<span class="mono">' + esc(p.availabilityModel) + '</span> · ' + esc(availLabel(p.availabilityModel))], ['Capacidad ref.', p.availCfg.capacity || '—'], ['Salidas futuras', deps.length], ['Cupos disponibles', sum(deps, d => avail(d))], ['Holds activos', hs.length + ' (' + sum(hs, 'qty') + ' cupos)']]) + (p.availabilityModel === 'POR_SALIDA' ? '<div class="divider" style="margin:12px 0"></div>' + (deps.slice(0, 5).map(d => '<div style="margin-bottom:8px"><div class="row between small"><span>' + dateShort(d.date) + ' ' + esc(d.time) + '</span><span class="num">' + d.sold + '/' + d.capacity + ' · disp. ' + avail(d) + '</span></div>' + UI.progress(d.sold / d.capacity * 100, d.sold >= d.capacity ? 'sun' : '') + '</div>').join('') || '<p class="small faint">Sin salidas futuras.</p>') : ''), { actions: '<a class="btn sm ghost" href="#/catalogo/salidas">' + ic('calendar') + 'Salidas</a>' }) +
      UI.card('Estados de disponibilidad (PROC-020)', UI.flow(['Disponible', 'Hold', 'Confirmada', 'Consumida'], 4) + '<p class="xs faint" style="margin-top:6px">Alternativos: liberada, expirada. No se confirma sin cupo disponible (Regla transversal 4, PRD-BR-012).</p>') +
      '</div></div>';
    b.querySelectorAll('[name=av-m]').forEach(r => r.onchange = () => b.querySelectorAll('.avm label').forEach(l => l.classList.toggle('on', l.contains(r) && r.checked)));
    const sv = b.querySelector('#av-save'); if (sv) sv.onclick = guard(PERM.avail, () => { const m = b.querySelector('[name=av-m]:checked').value; const before = p.availabilityModel; p.availabilityModel = m; p.availCfg = { capacity: b.querySelector('#av-cap').value, source: b.querySelector('#av-src').value }; p.updatedAt = T(); Audit.log('Producto', p.id, 'cambio_disponibilidad', before, m + ' · cap ' + (p.availCfg.capacity || '—') + ' · ' + p.availCfg.source); Store.save(); UI.toast('Configuración de disponibilidad guardada.'); rerender(); });
  }

  /* ---------------- Salidas §21 ---------------- */
  function depModal(p, d, after) {
    const productSel = !p;
    const fields = [];
    if (productSel) fields.push(selField('productId', 'Producto', DB.products.map(x => ({ v: x.id, l: x.id + ' · ' + x.name + (['ACTIVE', 'APPROVED'].includes(x.status) ? '' : ' [' + UI.statusLabel(x.status) + ']'), dis: ['INACTIVE', 'ARCHIVED'].includes(x.status) })), 'PRD-004', { required: true, col: 12 }));
    fields.push(
      { id: 'date', label: 'Fecha', type: 'date', required: true, value: d ? d.date : addDays(T(), 7), col: 4 }, { id: 'time', label: 'Hora', type: 'time', required: true, value: d ? d.time : '04:30', col: 4 }, { id: 'capacity', label: 'Capacidad', type: 'number', min: 1, required: true, value: d ? d.capacity : (p ? p.maxPax : 16), col: 4 },
      { id: 'status', label: 'Estado', type: 'select', options: [['abierta', 'Abierta'], ['cerrada', 'Cerrada'], ['cancelada', 'Cancelada']], value: d ? (d.status === 'completa' ? 'abierta' : d.status) : 'abierta', col: 4, hint: 'Completa se calcula al agotar cupos' },
      selField('providerId', 'Proveedor operador', DB.providers.filter(pv => provActive(pv)).map(pv => ({ v: pv.id, l: pv.name + ' · ' + pv.type })), d ? d.providerId : (p ? p.mainProviderId : ''), { placeholder: 'Según producto', col: 8 }),
      selField('guideId', 'Guía', DB.guides.map(g => ({ v: g.id, l: g.name + ' · ' + g.languages.join('/') + (g.status === 'vacaciones' ? ' [vacaciones]' : ''), dis: g.status === 'vacaciones' })), d ? d.guideId : '', { placeholder: 'Sin asignar', col: 6 }),
      selField('vehicleId', 'Transporte', DB.vehicles.map(v => ({ v: v.id, l: v.plate + ' · ' + v.type + (v.status === 'mantenimiento' ? ' [mantenimiento]' : ''), dis: v.status === 'mantenimiento' })), d ? d.vehicleId : '', { placeholder: 'Sin asignar', col: 6 }),
      { id: 'meeting', label: 'Punto de salida', required: true, value: d ? d.meeting : 'Plaza Regocijo', col: 6 }, { id: 'ret', label: 'Punto de retorno', value: d ? d.ret : '', col: 6 },
      { id: 'notes', label: 'Observaciones', type: 'textarea', rows: 2, value: d ? d.notes || '' : '', col: 12 });
    formModal({ title: d ? 'Editar salida ' + d.id : 'Nueva salida programada', sub: p ? p.name : 'Seleccione el producto', size: 'lg', fields,
      onSave: (f) => {
        const prod = p || Q.product(f.productId);
        if (!d && f.date < T()) { markErr(document, 'date'); UI.toast('No se pueden programar salidas en fechas pasadas.', 'bad'); return false; }
        if (d) { const min = d.sold + held(d); if (f.capacity < min) { UI.toast('La capacidad no puede ser menor a cupos vendidos + en hold (' + min + ').', 'bad'); return false; } }
        if (f.capacity > 60) { UI.toast('Capacidad máxima operativa por salida: 60 pax.', 'bad'); return false; }
        const veh = Q.vehicle(f.vehicleId); if (veh && veh.capacity < f.capacity) UI.toast('Atención: el vehículo ' + veh.plate + ' tiene ' + veh.capacity + ' asientos para ' + f.capacity + ' cupos.', 'warn');
        const o = d || { id: nextId('SAL-', allDeps().map(x => x.d), 4), sold: 0 };
        const before = d ? d.date + ' ' + d.time + ' cap ' + d.capacity + ' ' + d.status : '';
        Object.assign(o, { date: f.date, time: f.time, capacity: f.capacity, status: f.status, providerId: f.providerId, guideId: f.guideId || null, vehicleId: f.vehicleId || null, meeting: f.meeting, ret: f.ret, notes: f.notes });
        if (o.status === 'abierta' && o.sold >= o.capacity) o.status = 'completa';
        if (!d) prod.departures.push(o);
        prod.departures.sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
        Audit.log('Salida', o.id, d ? 'modificar' : 'crear', before, prod.id + ' · ' + o.date + ' ' + o.time + ' cap ' + o.capacity + ' ' + o.status);
        if (d && f.status === 'cancelada' && d.sold) Notify.push('salida.cancelada', 'Email', 'U05', 'Salida ' + o.id + ' cancelada con ' + d.sold + ' cupos vendidos: reprogramar pasajeros');
        Store.save(); UI.toast(d ? 'Salida actualizada.' : 'Salida ' + o.id + ' creada.'); after ? after() : rerender();
      } });
  }

  function tabDepartures(b, p) {
    const E = can(PERM.avail);
    const rows = p.departures.slice().sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time));
    b.innerHTML = (p.availabilityModel !== 'POR_SALIDA' ? UI.alert('info', 'El modelo de disponibilidad actual es <b>' + esc(availLabel(p.availabilityModel)) + '</b>. Las salidas programadas controlan cupos cuando el modelo es POR_SALIDA.') + '<div style="height:12px"></div>' : '') +
      UI.card('Salidas programadas', rows.length ? tbl(['Salida', 'Fecha', 'Hora', ['Cap.', 'num'], ['Vendidos', 'num'], ['Hold', 'num'], ['Disp.', 'num'], 'Ocupación', 'Estado', 'Guía', 'Transporte', 'Salida / retorno'].concat(E ? [''] : []), rows.map(d => { const oc = d.sold / d.capacity * 100; return '<tr><td class="mono">' + d.id + '</td><td class="nowrap">' + date(d.date) + (d.date < T() ? ' <span class="xs faint">pasada</span>' : '') + '</td><td class="mono">' + esc(d.time) + '</td><td class="num">' + d.capacity + '</td><td class="num">' + d.sold + '</td><td class="num">' + held(d) + '</td><td class="num"><b>' + avail(d) + '</b></td><td style="min-width:90px">' + UI.progress(oc, oc >= 100 ? 'sun' : oc >= 70 ? 'ok' : '') + '<div class="xs faint">' + fmtN(oc, 0) + '%</div></td><td>' + UI.badge(d.status) + '</td><td class="small">' + (d.guideId ? esc(guideName(d.guideId)) : '<span class="warn">Sin guía</span>') + '</td><td class="small">' + (d.vehicleId ? esc(vehLabel(d.vehicleId)) : '<span class="faint">—</span>') + '</td><td class="small">' + esc(d.meeting) + (d.ret ? ' → ' + esc(d.ret) : '') + (d.notes ? '<div class="cell-sub">' + esc(d.notes) + '</div>' : '') + '</td>' + (E ? '<td><button class="btn xs" data-dep="' + d.id + '">' + ic('edit') + 'Editar</button></td>' : '') + '</tr>'; }).join(''), 'compact') : UI.empty('Sin salidas programadas.', 'calendar'),
        { tight: true, sub: 'Fecha, hora, capacidad, cupos, estado, proveedor, guía, transporte, punto de salida y retorno (§21)', actions: '<a class="btn sm" href="#/catalogo/salidas">' + ic('calendar') + 'Calendario y holds</a><button class="btn sm primary" id="d-new"' + dis(PERM.avail) + '>' + ic('plus') + 'Nueva salida</button>' });
    const nb = b.querySelector('#d-new'); if (nb) nb.onclick = guard(PERM.avail, () => depModal(p, null));
    on(b, '[data-dep]', guard(PERM.avail, (x) => depModal(p, p.departures.find(d => d.id === x.dataset.dep))));
  }

  /* ---------------- Proveedores del producto §8 ---------------- */
  function tabProviders(b, p) {
    const map = {};
    if (p.mainProviderId) map[p.mainProviderId] = { main: true, svcs: [] };
    p.components.forEach(c => { if (!c.serviceId) return; const s = Q.service(c.serviceId); if (!s) return; (map[s.providerId] = map[s.providerId] || { main: false, svcs: [] }).svcs.push(s); });
    const ids = Object.keys(map);
    b.innerHTML = UI.alert('info', 'Descripción comercial del producto e información contractual/operativa del proveedor se gestionan por separado (§8). El proveedor puede cambiar sin alterar la identidad comercial del producto.') + '<div style="height:12px"></div>' +
      UI.card('Proveedores involucrados', ids.length ? tbl(['Proveedor', 'Tipo', 'Rol en el producto', 'Contrato', 'Condiciones de pago', 'Calificación', 'Estado'], ids.map(id => { const pv = Q.provider(id); if (!pv) return ''; const m = map[id]; const dl = daysFromToday(pv.contractEnd); return '<tr><td><div class="cell-main">' + provLink(id) + '</div><div class="cell-sub mono">' + id + ' · RUC ' + esc(pv.ruc) + '</div></td><td>' + esc(pv.type) + '</td><td class="small">' + (m.main ? '<span class="tag">Principal</span> ' : '') + m.svcs.map(s => svcLink(s.id)).join(', ') + '</td><td class="nowrap small">' + dateShort(pv.contractStart) + ' → ' + date(pv.contractEnd) + '<div class="cell-sub ' + (dl < 0 ? 'bad' : dl <= 60 ? 'warn' : '') + '">' + (dl < 0 ? 'Vencido hace ' + (-dl) + ' días' : 'Vence en ' + dl + ' días') + '</div></td><td class="small">' + esc(pv.paymentTerms) + ' · ' + pv.currency + '</td><td>' + stars(pv.rating) + '</td><td>' + UI.badge(provState(pv)) + '</td></tr>'; }).join(''), 'compact') : UI.empty('Sin proveedores asociados.', 'building'),
        { tight: true, actions: '<button class="btn sm primary" id="pv-change"' + dis(PERM.update) + '>' + ic('refresh') + 'Cambiar proveedor principal</button>' });
    const cb = b.querySelector('#pv-change'); if (cb) cb.onclick = guard(PERM.update, () => formModal({ title: 'Cambiar proveedor principal', size: 'sm', fields: [selField('prov', 'Nuevo proveedor principal', DB.providers.map(pv => ({ v: pv.id, l: pv.name + ' · ' + pv.type + (provActive(pv) ? '' : ' [' + UI.statusLabel(provState(pv)) + ']'), dis: !provActive(pv) })), p.mainProviderId, { required: true, col: 12, hint: 'Solo proveedores activos con contrato vigente (PRD-BR-007)' }), { id: 'reason', label: 'Motivo', type: 'textarea', rows: 2, required: true, col: 12 }],
      onSave: (d) => { if (d.prov === p.mainProviderId) { UI.toast('Es el proveedor actual.', 'info'); return false; } Audit.log('Producto', p.id, 'cambio_proveedor', Q.providerName(p.mainProviderId), Q.providerName(d.prov) + ' — ' + d.reason); p.mainProviderId = d.prov; p.updatedAt = T(); Store.save(); UI.toast('Proveedor principal actualizado.'); rerender(); } }));
  }

  /* ---------------- Políticas §13 ---------------- */
  function tabPolicies(b, p) {
    const E = can(PERM.update); const po = p.policies;
    b.innerHTML = readOnlyNote(PERM.update) + UI.card('Políticas del producto', UI.form([
      { id: 'cancel', label: 'Cancelación', type: 'textarea', rows: 3, required: true, value: po.cancel, col: 6, disabled: !E },
      { id: 'modify', label: 'Modificación', type: 'textarea', rows: 3, required: true, value: po.modify, col: 6, disabled: !E },
      { id: 'noshow', label: 'No-show', type: 'textarea', rows: 2, required: true, value: po.noshow, col: 6, disabled: !E },
      { id: 'penalties', label: 'Penalidades', type: 'textarea', rows: 2, value: po.penalties, col: 6, disabled: !E },
      { id: 'refund', label: 'Reembolso', type: 'textarea', rows: 2, required: true, value: po.refund, col: 6, disabled: !E },
      { id: 'dateChange', label: 'Cambios de fecha', type: 'textarea', rows: 2, value: po.dateChange, col: 6, disabled: !E },
      { id: 'advanceMin', label: 'Anticipación mínima', value: po.advanceMin, col: 3, disabled: !E }, { id: 'advanceMax', label: 'Anticipación máxima', value: po.advanceMax, col: 3, disabled: !E }
    ]), { sub: 'Las políticas aplicadas a una cotización o reserva se conservan como snapshot (§13): editar aquí no modifica documentos emitidos.', footer: '<button class="btn primary" id="po-save"' + dis(PERM.update) + '>' + ic('check') + 'Guardar políticas</button>' });
    const s = b.querySelector('#po-save'); if (s) s.onclick = guard(PERM.update, () => { const card = b.querySelector('.card'); if (!UI.validate(card)) return; const d = UI.formData(card); const ch = Object.keys(d).filter(k => String(po[k] || '') !== String(d[k])); Object.assign(po, d); p.updatedAt = T(); if (ch.length) Audit.log('Producto', p.id, 'cambio_politicas', '', ch.join(', ')); Store.save(); UI.toast(ch.length ? 'Políticas actualizadas.' : 'Sin cambios.'); rerender(); });
  }

  /* ---------------- Inclusiones / exclusiones §11 ---------------- */
  function tabIncl(b, p) {
    const E = can(PERM.update);
    const box = (key, title, ph) => UI.card(title, (p[key].length ? p[key].map((x, i) => '<div class="li-row"><span class="row" style="gap:8px;flex-wrap:nowrap">' + ic(key === 'inclusions' ? 'check' : 'x') + esc(x) + '</span><button class="btn xs ghost icon" data-rm="' + key + '|' + i + '" title="Quitar"' + (E ? '' : NP) + '>' + ic('trash') + '</button></div>').join('') : '<p class="small faint">Sin elementos.</p>') +
      (E ? '<div class="row" style="margin-top:12px;flex-wrap:nowrap"><input class="input" id="add-' + key + '" placeholder="' + esc(ph) + '"' + (E ? '' : ' disabled') + '><button class="btn primary" data-add="' + key + '">' + ic('plus') + 'Agregar</button></div>' : ''), { sub: p[key].length + ' elemento(s)' });
    b.innerHTML = readOnlyNote(PERM.update) + '<div class="grid g2">' + box('inclusions', 'Incluye', 'p. ej. Guía oficial bilingüe') + box('exclusions', 'No incluye', 'p. ej. Propinas') + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card-b small muted">Estas listas se muestran en: <span class="chip-row" style="display:inline-flex">' + ['Cotización', 'Voucher', 'Portal', 'E-commerce', 'PDF', 'Documentos comerciales'].map(x => '<span class="tag">' + x + '</span>').join('') + '</span></div></div>';
    const save = (msg, k, v) => { p.updatedAt = T(); Audit.log('Producto', p.id, 'modificar', '', msg + ': ' + v); Store.save(); UI.toast(msg + '.'); rerender(); };
    on(b, '[data-add]', guard(PERM.update, (x) => { const k = x.dataset.add; const i = b.querySelector('#add-' + k); const v = i.value.trim(); if (!v) { UI.toast('Ingrese un texto.', 'bad'); return; } if (p[k].includes(v)) { UI.toast('Ya está en la lista.', 'info'); return; } p[k].push(v); save(k === 'inclusions' ? 'Inclusión agregada' : 'Exclusión agregada', k, v); }));
    b.querySelectorAll('input[id^=add-]').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') b.querySelector('[data-add="' + i.id.slice(4) + '"]').click(); }));
    on(b, '[data-rm]', guard(PERM.update, (x) => { const [k, i] = x.dataset.rm.split('|'); const v = p[k].splice(+i, 1)[0]; save(k === 'inclusions' ? 'Inclusión quitada' : 'Exclusión quitada', k, v); }));
  }

  /* ---------------- Relacionados §22 ---------------- */
  function tabRelated(b, p) {
    const E = can(PERM.update);
    const reverse = DB.products.filter(x => x.id !== p.id && (x.related || []).some(r => r.productId === p.id));
    b.innerHTML = UI.card('Productos relacionados', p.related.length ? tbl(['Producto', 'Tipo de relación', 'Tipo', ['Precio desde', 'num'], 'Estado', ''], p.related.map((r, i) => { const x = Q.product(r.productId); if (!x) return ''; const mr = shownRate(x); return '<tr><td><div class="cell-main">' + prodLink(x.id) + '</div><div class="cell-sub mono">' + x.id + '</div></td><td><span class="tag">' + esc(r.relation) + '</span></td><td>' + esc(x.type) + '</td><td class="num">' + (mr ? money(mr.price, mr.currency) : '—') + '</td><td>' + UI.badge(x.status) + (x.status !== 'ACTIVE' ? '<div class="cell-sub warn">No se ofrecerá (PRD-BR-002)</div>' : '') + '</td><td><button class="btn xs ghost icon" data-rrm="' + i + '" title="Quitar"' + (E ? '' : NP) + '>' + ic('x') + '</button></td></tr>'; }).join(''), 'compact') : UI.empty('Sin productos relacionados.', 'link'),
      { tight: true, sub: 'Complementario, alternativo, upgrade, cross-sell y upsell. Usado por CRM, e-commerce y cotizaciones para sugerir productos.', actions: '<button class="btn sm primary" id="rl-add"' + dis(PERM.update) + '>' + ic('plus') + 'Relacionar producto</button>' }) +
      (reverse.length ? '<div style="height:16px"></div>' + UI.card('Referenciado desde', '<div class="list">' + reverse.map(x => '<div class="list-item">' + prodLink(x.id) + '<span class="tag">' + esc(x.related.find(r => r.productId === p.id).relation) + '</span></div>').join('') + '</div>', { tight: true }) : '');
    const a = b.querySelector('#rl-add'); if (a) a.onclick = guard(PERM.update, () => formModal({ title: 'Relacionar producto', size: 'sm', fields: [selField('pid', 'Producto', DB.products.filter(x => x.id !== p.id && !p.related.some(r => r.productId === x.id)).map(x => ({ v: x.id, l: x.id + ' · ' + x.name + (x.status === 'ACTIVE' ? '' : ' [' + UI.statusLabel(x.status) + ']') })), '', { required: true, placeholder: 'Seleccione', col: 12 }), { id: 'relation', label: 'Tipo de relación', type: 'select', options: REL_TYPES, col: 12 }],
      onSave: (d) => { p.related.push({ productId: d.pid, relation: d.relation }); Audit.log('Producto', p.id, 'relacionar', '', d.relation + ' → ' + d.pid); Store.save(); UI.toast('Producto relacionado.'); rerender(); } }));
    on(b, '[data-rrm]', guard(PERM.update, (x) => { const r = p.related.splice(+x.dataset.rrm, 1)[0]; Audit.log('Producto', p.id, 'desrelacionar', r.relation + ' → ' + r.productId, ''); Store.save(); UI.toast('Relación eliminada.'); rerender(); }));
  }

  /* ---------------- B2B §24 ---------------- */
  function tabB2B(b, p) {
    const E = can(PERM.update); const pub = mainRate(p); const cur = pub ? pub.currency : 'PEN';
    b.innerHTML = (!p.flags.b2b || !p.channels.b2b ? UI.alert('warn', 'El producto no está habilitado para el canal B2B (' + (!p.flags.b2b ? 'indicador is_b2b desactivado' : 'canal B2B no publicado') + '). Las listas de precios no serán visibles para las agencias.') + '<div style="height:12px"></div>' : '') +
      '<div class="grid g4" style="margin-bottom:16px">' + UI.kpi({ label: 'Precio público', value: pub ? money(pub.price, cur) : '—', sub: pub ? pub.id + ' · ' + pub.channel : 'Sin tarifa', tone: 'accent' }) + UI.kpi({ label: 'Agencias con precio', value: p.b2b.length, tone: 'info' }) + UI.kpi({ label: 'Precio B2B promedio', value: p.b2b.length ? money(sum(p.b2b, 'price') / p.b2b.length, cur) : '—', tone: 'violet' }) + UI.kpi({ label: 'Comisión promedio', value: p.b2b.length ? fmtN(sum(p.b2b, 'commissionPct') / p.b2b.length, 1) + '%' : '—', tone: 'sun' }) + '</div>' +
      UI.card('Listas de precios por agencia', p.b2b.length ? tbl(['Agencia', 'Lista de precios', ['Precio B2B', 'num'], ['Dif. vs público', 'num'], ['Comisión', 'num'], 'Crédito', 'Vigencia', 'Condición / restricciones', 'Estado agencia', ''], p.b2b.map((x, i) => { const ag = Q.agency(x.agencyId) || {}; const diff = pub ? (x.price - pub.price) / pub.price * 100 : null; return '<tr><td><div class="cell-main">' + esc(ag.name || x.agencyId) + '</div><div class="cell-sub mono">' + esc(x.agencyId) + ' · RUC ' + esc(ag.ruc || '') + '</div></td><td>' + esc(x.priceList) + '</td><td class="num"><b>' + money(x.price, cur) + '</b></td><td class="num">' + (diff == null ? '—' : fmtN(diff, 1) + '%') + '</td><td class="num">' + fmtN(x.commissionPct, 1) + '%</td><td class="small">' + (x.credit ? 'Sí · ' + money(ag.creditUsed || 0, 'PEN', 0) + ' / ' + money(ag.creditLimit || 0, 'PEN', 0) : 'Prepago') + '</td><td class="small nowrap">hasta ' + date(x.validTo || ag.validTo) + '</td><td class="small">' + esc(x.conditions || '—') + (x.restrictions ? '<div class="cell-sub">' + esc(x.restrictions) + '</div>' : '') + '</td><td>' + UI.badge(ag.status || 'inactiva') + '</td><td class="nowrap"><button class="btn xs ghost icon" data-bed="' + i + '" title="Editar"' + (E ? '' : NP) + '>' + ic('edit') + '</button><button class="btn xs ghost icon" data-brm="' + i + '" title="Quitar"' + (E ? '' : NP) + '>' + ic('trash') + '</button></td></tr>'; }).join(''), 'compact') : UI.empty('Sin precios B2B configurados.', 'handshake'),
        { tight: true, sub: 'Precio diferenciado, comisión, condición comercial, crédito, vigencia y restricciones por agencia (Regla transversal 14).', actions: '<a class="btn sm" href="#/canales/b2b">' + ic('handshake') + 'Canal B2B</a><button class="btn sm primary" id="b2-add"' + dis(PERM.update) + '>' + ic('plus') + 'Agregar agencia</button>' });
    const modal = (x) => formModal({ title: x ? 'Editar precio B2B' : 'Precio B2B por agencia', fields: [
        selField('agencyId', 'Agencia asociada', DB.b2bAgencies.map(a => ({ v: a.id, l: a.name + ' · ' + a.priceList + (a.status === 'activa' ? '' : ' [' + UI.statusLabel(a.status) + ']'), dis: a.status !== 'activa' || (!x && p.b2b.some(y => y.agencyId === a.id)) })), x ? x.agencyId : '', { required: true, placeholder: 'Seleccione', col: 12, hint: 'Agencias bloqueadas no disponibles.' }),
        { id: 'priceList', label: 'Lista de precios', value: x ? x.priceList : 'Mayorista 2026', required: true, col: 6 }, { id: 'price', label: 'Precio B2B (' + cur + ')', type: 'number', step: '0.01', required: true, value: x ? x.price : (pub ? Math.round(pub.price * 0.9) : ''), col: 3 }, { id: 'commissionPct', label: 'Comisión %', type: 'number', step: '0.1', value: x ? x.commissionPct : 10, col: 3 },
        { id: 'credit', type: 'switch', label: 'Venta a crédito', value: x ? x.credit : false, col: 4 }, { id: 'validTo', label: 'Vigencia hasta', type: 'date', required: true, value: x ? x.validTo || '2026-12-31' : '2026-12-31', col: 4 },
        { id: 'conditions', label: 'Condición comercial', value: x ? x.conditions || '' : '', col: 6, placeholder: 'p. ej. Pago a 15 días' }, { id: 'restrictions', label: 'Restricciones', value: x ? x.restrictions || '' : '', col: 6, placeholder: 'p. ej. No aplica en temporada alta' }],
      onSave: (d) => { if (pub && d.price > pub.price) UI.toast('El precio B2B supera al precio público.', 'warn'); if (pub && d.price < pub.cost) { UI.toast('El precio B2B está por debajo del costo (' + money(pub.cost, cur) + ').', 'bad'); return false; } const ag = Q.agency(d.agencyId); if (d.credit && !(ag.creditLimit > 0)) { UI.toast('La agencia no tiene línea de crédito aprobada.', 'bad'); return false; } const before = x ? x.price : ''; const o = x || {}; Object.assign(o, d); if (!x) p.b2b.push(o); Audit.log('Producto', p.id, x ? 'cambio_precio_b2b' : 'crear_precio_b2b', before, d.agencyId + ' ' + cur + ' ' + d.price + ' · com ' + d.commissionPct + '%'); Store.save(); UI.toast('Precio B2B guardado.'); rerender(); } });
    const a = b.querySelector('#b2-add'); if (a) a.onclick = guard(PERM.update, () => modal(null));
    on(b, '[data-bed]', guard(PERM.update, (x) => modal(p.b2b[+x.dataset.bed])));
    on(b, '[data-brm]', guard(PERM.update, (x) => { const r = p.b2b.splice(+x.dataset.brm, 1)[0]; Audit.log('Producto', p.id, 'eliminar_precio_b2b', r.agencyId, ''); Store.save(); UI.toast('Precio B2B eliminado.'); rerender(); }));
  }

  /* ---------------- Promociones §25 ---------------- */
  function tabPromos(b, p) {
    const E = can(PERM.update); const pub = shownRate(p);
    const pst = (x) => x.status === 'inactiva' ? 'inactiva' : x.to < T() ? 'vencida' : 'activa';
    const preview = (x) => { if (!pub) return '—'; let v = pub.price; if (x.kind === 'Descuento %' || x.kind === 'Descuento por cantidad' || x.kind === 'Promoción por temporada' || x.kind === 'Promoción por canal' || x.kind === 'Código promocional' || x.kind === 'Promoción por fecha') v = pub.price * (1 - x.value / 100); else if (x.kind === 'Descuento fijo') v = pub.price - x.value; else if (x.kind === 'Precio promocional') v = x.value; return money(v, pub.currency); };
    b.innerHTML = UI.card('Promociones', p.promotions.length ? tbl(['ID', 'Promoción', 'Tipo', ['Valor', 'num'], 'Canal', 'Código', 'Vigencia', ['Precio resultante', 'num'], 'Estado', ''], p.promotions.map((x, i) => '<tr><td class="mono">' + esc(x.id) + '</td><td class="cell-main">' + esc(x.name) + '</td><td>' + esc(x.kind) + '</td><td class="num">' + (x.kind === 'Descuento fijo' || x.kind === 'Precio promocional' ? fmtN(x.value) : fmtN(x.value, 0) + '%') + '</td><td>' + esc(x.channel) + '</td><td class="mono">' + esc(x.code || '—') + '</td><td class="small nowrap">' + dateShort(x.from) + ' → ' + date(x.to) + '</td><td class="num">' + preview(x) + '</td><td>' + UI.badge(pst(x)) + '</td><td class="nowrap"' + (E ? '' : ' hidden') + '><button class="btn xs ghost" data-ptog="' + i + '"' + (!E ? NP : pst(x) !== 'vencida' ? '' : ' disabled') + '>' + (x.status === 'inactiva' ? 'Activar' : 'Pausar') + '</button><button class="btn xs ghost icon" data-prm="' + i + '" title="Eliminar"' + (E ? '' : NP) + '>' + ic('trash') + '</button></td></tr>').join(''), 'compact') : UI.empty('Sin promociones configuradas.', 'percent'),
      { tight: true, sub: 'La lógica promocional es independiente del precio base: el motor del backend la aplica sobre la tarifa vigente. Precio base de referencia: ' + (pub ? money(pub.price, pub.currency) + ' (' + pub.id + ')' : '—'), actions: '<button class="btn sm primary" id="pm-add"' + dis(PERM.update) + '>' + ic('plus') + 'Nueva promoción</button>' });
    const a = b.querySelector('#pm-add'); if (a) a.onclick = guard(PERM.update, () => formModal({ title: 'Nueva promoción', fields: [
        { id: 'name', label: 'Nombre', required: true, col: 8 }, { id: 'kind', label: 'Tipo', type: 'select', options: PROMO_KINDS, value: 'Descuento %', col: 4 },
        { id: 'value', label: 'Valor (% o monto)', type: 'number', step: '0.01', required: true, col: 4 }, { id: 'channel', label: 'Canal', type: 'select', options: ['Todos', 'Directo', 'E-commerce', 'B2B', 'Corporativo'], col: 4 }, { id: 'code', label: 'Código promocional', col: 4 },
        { id: 'from', label: 'Desde', type: 'date', required: true, value: T(), col: 6 }, { id: 'to', label: 'Hasta', type: 'date', required: true, col: 6 }],
      onSave: (d) => { if (d.to < d.from || d.to < T()) { UI.toast('Vigencia inválida o vencida.', 'bad'); return false; } if (/%|cantidad|temporada|canal|Código|fecha/.test(d.kind) && d.kind !== 'Descuento fijo' && (d.value <= 0 || d.value >= 60)) { UI.toast('Los descuentos porcentuales deben estar entre 0 y 60%.', 'bad'); return false; } const o = Object.assign({ id: nextId('PROMO-', DB.products.flatMap(x => x.promotions || []), 2), status: 'activa' }, d, { code: d.code.toUpperCase() }); p.promotions.push(o); Audit.log('Producto', p.id, 'crear_promocion', '', o.id + ' ' + o.name); Store.save(); UI.toast('Promoción creada.'); rerender(); } }));
    on(b, '[data-ptog]', guard(PERM.update, (x) => { const o = p.promotions[+x.dataset.ptog]; o.status = o.status === 'inactiva' ? 'activa' : 'inactiva'; Audit.log('Producto', p.id, 'cambio_promocion', '', o.id + ' ' + o.status); Store.save(); rerender(); }));
    on(b, '[data-prm]', guard(PERM.update, (x) => { const o = p.promotions.splice(+x.dataset.prm, 1)[0]; Audit.log('Producto', p.id, 'eliminar_promocion', o.id, ''); Store.save(); UI.toast('Promoción eliminada.'); rerender(); }));
  }

  /* ---------------- Costos y rentabilidad §26 + simulador de pricing §17 ---------------- */
  function tabProfit(b, p) {
    if (!can(PERM.profit)) { b.innerHTML = UI.alert('bad', 'Su rol no tiene el permiso <span class="mono">catalog.products.view_profitability</span>. Los costos y márgenes no se exponen (PRD-T13 → 403).'); return; }
    const r0 = mainRate(p); const cc = compCost(p);
    const rateOpts = p.rates.map(r => '<option value="' + r.id + '"' + (rateState(r) !== 'vigente' ? ' disabled' : '') + (r0 && r.id === r0.id ? ' selected' : '') + '>' + r.id + ' · ' + esc(r.type + ' ' + r.segment + ' ' + r.channel) + ' · ' + money(r.price, r.currency) + (rateState(r) !== 'vigente' ? ' [' + rateState(r) + ' — PRD-BR-005]' : '') + '</option>').join('');
    const num = (id, label, v, step, col) => '<div class="field ' + (col || 'c4') + '"><label for="' + id + '">' + label + '</label><input class="input" type="number" id="' + id + '" value="' + v + '" step="' + (step || '0.01') + '"></div>';
    b.innerHTML = '<div class="grid g2">' +
      UI.card('Desglose de rentabilidad', (r0 ? '<div class="form-grid"><div class="field c12"><label for="pf-rate">Tarifa analizada</label><select class="input" id="pf-rate">' + rateOpts + '</select></div>' + num('pf-other', 'Otros costos (unit.)', Math.round(r0.price * 0.04), '0.01') + num('pf-com', 'Comisión %', p.b2b[0] && r0.channel === 'B2B' ? p.b2b[0].commissionPct : 5, '0.1') + num('pf-pax', 'Pasajeros', 1, '1') + '</div><div id="pf-out" style="margin-top:14px"></div>' : UI.alert('bad', 'Sin tarifa vigente para analizar (PRD-BR-005).')) +
        '<div class="divider" style="margin:14px 0"></div><div class="stat-line"><span class="muted">Costo según componentes vigentes</span><b class="num">' + money(cc) + '</b></div><div class="stat-line"><span class="muted">Equivalente en USD (TC ' + DB.settings.fx + ')</span><b class="num">' + money(cc / DB.settings.fx, 'USD') + '</b></div>',
        { sub: 'Venta − costo proveedor − otros costos − comisión = utilidad (§26). Finanzas es la fuente de verdad de los movimientos (§39).' }) +
      UI.card('Simulador del motor de precios', '<div class="form-grid">' + num('sm-cost', 'Costo proveedor', r0 ? r0.cost : Math.round(cc), '0.01') + num('sm-extra', 'Costos adicionales', 0) + num('sm-mk', 'Markup %', p.markupPct, '0.1') + num('sm-mkf', 'Markup fijo', 0) + num('sm-dp', 'Descuento %', 0, '0.1') + num('sm-df', 'Descuento fijo', 0) +
        '<div class="field c4"><label for="sm-tax">Impuesto</label><select class="input" id="sm-tax"><option value="18">IGV 18% (domiciliado)</option><option value="0">0% exportación de servicios</option></select></div>' + num('sm-com', 'Comisión %', 5, '0.1') + '<div class="field c4"><label for="sm-rnd">Redondeo</label><select class="input" id="sm-rnd"><option value="0.1">0.10</option><option value="1">1.00</option><option value="0">Sin redondeo</option></select></div></div><div id="sm-out" style="margin-top:14px"></div>' +
        UI.alert('info', '<b>Cálculo ejecutado en backend</b> (PRD-BR-010/011): esta simulación invoca el mismo modelo del motor de precios; el precio válido es siempre el devuelto por la API y cualquier valor manipulado en el navegador se ignora (PRD-T15).'),
        { sub: 'Costo + adicionales + markup − descuentos + impuestos = precio final', actions: '<button class="btn sm" id="sm-apply"' + dis(PERM.rates) + '>Guardar markup de referencia</button>' }) +
      '</div><div style="height:16px"></div>' +
      UI.card('Margen por tarifa', tbl(['Tarifa', 'Tipo', 'Canal', ['Venta', 'num'], ['Costo', 'num'], ['Utilidad bruta', 'num'], ['Margen', 'num'], 'Estado'], p.rates.map(r => '<tr><td class="mono">' + r.id + '</td><td>' + esc(r.type) + ' · ' + esc(r.segment) + '</td><td>' + esc(r.channel) + '</td><td class="num">' + money(r.price, r.currency) + '</td><td class="num">' + money(r.cost, r.currency) + '</td><td class="num">' + money(r.price - r.cost, r.currency) + '</td><td class="num"><b class="' + (marginOf(r) < 15 ? 'warn' : '') + '">' + pct(marginOf(r)) + '</b></td><td>' + rateBadge(r) + '</td></tr>').join('') || '<tr><td colspan="8">' + UI.empty('Sin tarifas', 'tag') + '</td></tr>', 'compact'), { tight: true });
    const g = (id) => { const e = b.querySelector('#' + id); return e ? +e.value || 0 : 0; };
    const out = b.querySelector('#pf-out');
    const runPf = () => { if (!out) return; const r = p.rates.find(x => x.id === b.querySelector('#pf-rate').value) || r0; const pax = Math.max(1, g('pf-pax')); const sale = r.price * pax, cost = r.cost * pax, other = g('pf-other') * pax, com = sale * g('pf-com') / 100; const util = sale - cost - other - com; const cur = r.currency;
      out.innerHTML = '<div class="stat-line"><span>Precio de venta</span><b class="num">' + money(sale, cur) + '</b></div><div class="stat-line"><span>Costo proveedor</span><span class="num">− ' + money(cost, cur) + '</span></div><div class="stat-line"><span>Otros costos</span><span class="num">− ' + money(other, cur) + '</span></div><div class="stat-line"><span>Comisión (' + fmtN(g('pf-com'), 1) + '%)</span><span class="num">− ' + money(com, cur) + '</span></div><div class="stat-line total"><span>Utilidad</span><span class="num ' + (util < 0 ? 'bad' : 'ok') + '">' + money(util, cur) + '</span></div><div class="stat-line"><span>Margen %</span><b class="num">' + pct(sale ? util / sale * 100 : 0) + '</b></div>'; };
    const smOut = b.querySelector('#sm-out');
    const runSm = () => { const cur = r0 ? r0.currency : 'PEN'; const k = Pricing.calc({ cost: g('sm-cost'), extra: g('sm-extra'), markupPct: g('sm-mk'), markupFixed: g('sm-mkf'), discountPct: g('sm-dp'), discountFixed: g('sm-df'), taxPct: +b.querySelector('#sm-tax').value, commissionPct: g('sm-com'), round: +b.querySelector('#sm-rnd').value });
      const L = (l, v, cls) => '<div class="stat-line ' + (cls || '') + '"><span>' + l + '</span><span class="num">' + money(v, cur) + '</span></div>';
      smOut.innerHTML = L('Costo proveedor + adicionales', k.base) + L('+ Markup', k.markup) + L('= Subtotal', k.subtotal) + L('− Descuentos', k.discount) + L('= Valor neto', k.net) + L('+ Impuestos', k.tax) + L('Precio final', k.total, 'total') + L('Comisión', k.commission) + L('Utilidad', k.profit) + '<div class="stat-line"><span>Margen sobre neto</span><b class="num">' + pct(k.marginPct) + '</b></div>'; };
    b.querySelectorAll('#pf-rate,#pf-other,#pf-com,#pf-pax').forEach(i => i.addEventListener('input', runPf));
    b.querySelectorAll('[id^=sm-]').forEach(i => i.addEventListener('input', runSm));
    runPf(); runSm();
    const ap = b.querySelector('#sm-apply'); if (ap) ap.onclick = guard(PERM.rates, () => { const v = g('sm-mk'); const before = p.markupPct; p.markupPct = v; Audit.log('Producto', p.id, 'cambio_markup', before + '%', v + '%'); Store.save(); UI.toast('Markup de referencia actualizado a ' + fmtN(v, 1) + '%.'); });
  }

  /* ---------------- Personalización §23 ---------------- */
  const CFG_SEL = {};
  function tabConfig(b, p) {
    const E = can(PERM.update); p.config = p.config || [];
    const valid = visRates(p).filter(r => rateState(r) === 'vigente');
    const sel = CFG_SEL[p.id] = CFG_SEL[p.id] || { rate: (mainRate(p) || {}).id, opts: {} };
    p.config.forEach(g => { if (sel.opts[g.group] == null) { const z = g.options.findIndex(o => o.delta === 0); sel.opts[g.group] = z < 0 ? 0 : z; } });
    const draw = () => {
      const r = valid.find(x => x.id === sel.rate) || valid[0];
      const deltas = p.config.map(g => ({ g: g.group, o: g.options[sel.opts[g.group]] || g.options[0] }));
      const total = r ? r.price + sum(deltas, x => x.o ? x.o.delta : 0) : 0;
      b.innerHTML = '<div class="grid g-2-1"><div class="stack">' + (p.config.length ? p.config.map((g, gi) => UI.card(esc(g.group), '<div class="opt-grid">' + g.options.map((o, oi) => '<button class="opt' + (sel.opts[g.group] === oi ? ' on' : '') + '" data-opt="' + gi + '|' + oi + '"><span>' + esc(o.label) + '</span><span class="xs num">' + (o.delta === 0 ? 'incluido' : (o.delta > 0 ? '+' : '−') + fmtN(Math.abs(o.delta), 0)) + '</span></button>').join('') + '</div>', { actions: '<button class="btn xs ghost" data-grm="' + gi + '"' + (E ? '' : NP) + '>' + ic('trash') + 'Quitar grupo</button>' })).join('') : UI.card('', UI.empty('Producto no configurable. Agregue grupos de opciones (hotel, transporte, habitación, actividades…).', 'settings'))) + '</div>' +
        '<div class="stack">' + UI.card('Precio configurado', (r ? '<div class="field" style="margin-bottom:12px"><label for="cf-rate">Tarifa base</label><select class="input" id="cf-rate">' + visRates(p).map(x => '<option value="' + x.id + '"' + (x.id === r.id ? ' selected' : '') + (rateState(x) !== 'vigente' ? ' disabled' : '') + '>' + x.id + ' · ' + esc(x.segment + ' ' + x.channel) + ' · ' + money(x.price, x.currency) + (rateState(x) !== 'vigente' ? ' [vencida]' : '') + '</option>').join('') + '</select></div><div class="stat-line"><span>Tarifa base</span><span class="num">' + money(r.price, r.currency) + '</span></div>' + deltas.map(x => '<div class="stat-line"><span>' + esc(x.g) + ': ' + esc(x.o ? x.o.label : '—') + '</span><span class="num">' + (x.o && x.o.delta ? (x.o.delta > 0 ? '+ ' : '− ') + money(Math.abs(x.o.delta), r.currency) : '—') + '</span></div>').join('') + '<div class="stat-line total"><span>Precio por pasajero</span><span class="num">' + money(total, r.currency) + '</span></div>' : UI.alert('bad', 'Sin tarifa vigente: no es posible calcular el precio (PRD-BR-005).')) +
          '<p class="xs faint" style="margin-top:10px">Cada selección solicita el recálculo al motor de precios del backend (POST /api/v1/catalog/products/' + p.id + '/price-quote). El total mostrado es la respuesta simulada.</p>', { actions: '<button class="btn sm primary" id="cf-add"' + dis(PERM.update) + '>' + ic('plus') + 'Grupo de opciones</button>' }) + '</div></div>';
      on(b, '[data-opt]', (x) => { const [gi, oi] = x.dataset.opt.split('|').map(Number); sel.opts[p.config[gi].group] = oi; draw(); });
      const cr = b.querySelector('#cf-rate'); if (cr) cr.onchange = () => { sel.rate = cr.value; draw(); };
      const ca = b.querySelector('#cf-add'); if (ca) ca.onclick = guard(PERM.update, () => formModal({ title: 'Nuevo grupo de opciones', fields: [{ id: 'group', label: 'Grupo', required: true, col: 12, placeholder: 'p. ej. Actividades' }, { id: 'options', label: 'Opciones: una por línea, formato "Etiqueta | diferencia de precio"', type: 'textarea', rows: 5, required: true, col: 12, placeholder: 'Machu Picchu | 0\nValle Sagrado | 85\nCity Tour | 40' }],
        onSave: (d) => { const opts = d.options.split('\n').map(l => l.split('|')).filter(a => a[0] && a[0].trim()).map(a => ({ label: a[0].trim(), delta: +(a[1] || 0) || 0 })); if (opts.length < 2) { UI.toast('Ingrese al menos dos opciones.', 'bad'); return false; } if (p.config.some(g => g.group.toLowerCase() === d.group.toLowerCase())) { UI.toast('Ya existe el grupo.', 'bad'); return false; } p.config.push({ group: d.group, options: opts }); Audit.log('Producto', p.id, 'cambio_personalizacion', '', 'Grupo ' + d.group + ' (' + opts.length + ')'); Store.save(); UI.toast('Grupo agregado.'); rerender(); } }));
      on(b, '[data-grm]', guard(PERM.update, (x) => { const g = p.config.splice(+x.dataset.grm, 1)[0]; delete sel.opts[g.group]; Audit.log('Producto', p.id, 'cambio_personalizacion', g.group, 'eliminado'); Store.save(); UI.toast('Grupo eliminado.'); rerender(); }));
    };
    draw();
  }

  /* ---------------- Contenido comercial §27 ---------------- */
  function tabContent(b, p) {
    const E = can(PERM.update);
    b.innerHTML = readOnlyNote(PERM.update) + '<div class="grid g-2-1"><div class="stack">' +
      UI.card('Descripciones y SEO', UI.form([
        { id: 'short', label: 'Descripción corta', type: 'textarea', rows: 2, value: p.short, col: 12, disabled: !E, hint: 'Recomendado: hasta 160 caracteres' },
        { id: 'long', label: 'Descripción larga', type: 'textarea', rows: 5, value: p.long, col: 12, disabled: !E },
        { id: 'features', label: 'Características destacadas (una por línea)', type: 'textarea', rows: 3, value: (p.features || []).join('\n'), col: 6, disabled: !E },
        { id: 'video', label: 'Video (URL)', value: p.video || '', col: 6, disabled: !E, placeholder: 'https://…' },
        { type: 'section', label: 'SEO' },
        { id: 'seoTitle', label: 'SEO title', value: p.seo.title, col: 12, disabled: !E, hint: 'Máximo recomendado 60 caracteres' },
        { id: 'seoDesc', label: 'SEO description', type: 'textarea', rows: 2, value: p.seo.description, col: 12, disabled: !E, hint: 'Máximo recomendado 160 caracteres' },
        { id: 'slug', label: 'Slug', value: p.seo.slug, col: 12, disabled: !E, hint: 'Solo minúsculas, números y guiones' }
      ]) + '<div class="serp" style="margin-top:14px" id="serp"></div>', { footer: '<button class="btn primary" id="ct-save"' + dis(PERM.update) + '>' + ic('check') + 'Guardar contenido</button>' }) +
      UI.card('Preguntas frecuentes', (p.faqs.length ? p.faqs.map((f, i) => '<div class="li-row" style="align-items:flex-start"><div><b class="small">' + esc(f.q) + '</b><div class="small muted">' + esc(f.a) + '</div></div><button class="btn xs ghost icon" data-frm="' + i + '"' + (E ? '' : NP) + '>' + ic('trash') + '</button></div>').join('') : '<p class="small faint">Sin preguntas frecuentes.</p>'), { actions: '<button class="btn sm" id="fq-add"' + dis(PERM.update) + '>' + ic('plus') + 'Agregar FAQ</button>' }) +
      '</div><div class="stack">' +
      UI.card('Galería', '<div class="gal">' + p.gallery.map((g, i) => '<div class="gal-it">' + UI.thumb({ name: g.label, hue: g.hue }, 96) + '<div class="row between" style="gap:4px">' + (g.main ? UI.badge('activo', 'Principal') : '<button class="btn xs" data-gmain="' + i + '"' + (E ? '' : NP) + '>Marcar principal</button>') + '<button class="btn xs ghost icon" data-grmv="' + i + '" title="Quitar"' + (!E ? NP : !g.main ? '' : ' disabled') + '>' + ic('trash') + '</button></div></div>').join('') + '</div><p class="xs faint" style="margin-top:10px">Galería simulada: en producción las imágenes se cargan al almacenamiento de objetos del tenant con variantes optimizadas.</p>', { actions: '<button class="btn sm" id="g-add"' + dis(PERM.update) + '>' + ic('image') + 'Agregar imagen</button>' }) +
      '</div></div>';
    const serp = () => { const t = b.querySelector('#seoTitle').value || p.name, d = b.querySelector('#seoDesc').value || p.short, s = slugify(b.querySelector('#slug').value || p.name); b.querySelector('#serp').innerHTML = '<div class="xs faint" style="margin-bottom:4px">Vista previa en buscadores · ' + t.length + '/60 · ' + d.length + '/160</div><div class="su">andeshorizonte.pe › tours › ' + esc(s) + '</div><div class="st">' + esc(t.slice(0, 70)) + '</div><div class="sd">' + esc(d.slice(0, 170)) + '</div>'; };
    ['seoTitle', 'seoDesc', 'slug'].forEach(k => b.querySelector('#' + k).addEventListener('input', serp)); serp();
    const sv = b.querySelector('#ct-save'); if (sv) sv.onclick = guard(PERM.update, () => { const d = UI.formData(b.querySelector('.card')); const slug = slugify(d.slug); if (d.slug && slug !== d.slug) UI.toast('Slug normalizado a "' + esc(slug) + '".', 'info'); if (slug && DB.products.some(x => x !== p && x.seo && x.seo.slug === slug)) { UI.toast('El slug ya está en uso por otro producto.', 'bad'); return; } p.short = d.short; p.long = d.long; p.features = d.features.split('\n').map(x => x.trim()).filter(Boolean); p.video = d.video; p.seo = { title: d.seoTitle, description: d.seoDesc, slug }; p.updatedAt = T(); Audit.log('Producto', p.id, 'cambio_contenido', '', 'Descripciones / SEO'); Store.save(); UI.toast('Contenido guardado.'); rerender(); });
    const fa = b.querySelector('#fq-add'); if (fa) fa.onclick = guard(PERM.update, () => formModal({ title: 'Nueva pregunta frecuente', fields: [{ id: 'q', label: 'Pregunta', required: true, col: 12 }, { id: 'a', label: 'Respuesta', type: 'textarea', rows: 3, required: true, col: 12 }], onSave: (d) => { p.faqs.push(d); Audit.log('Producto', p.id, 'cambio_contenido', '', 'FAQ agregada'); Store.save(); UI.toast('FAQ agregada.'); rerender(); } }));
    on(b, '[data-frm]', guard(PERM.update, (x) => { p.faqs.splice(+x.dataset.frm, 1); Audit.log('Producto', p.id, 'cambio_contenido', '', 'FAQ eliminada'); Store.save(); rerender(); }));
    const ga = b.querySelector('#g-add'); if (ga) ga.onclick = guard(PERM.update, () => formModal({ title: 'Agregar imagen', size: 'sm', fields: [{ id: 'label', label: 'Descripción / texto alternativo', required: true, col: 12, placeholder: 'p. ej. Vista desde la Casa del Guardián' }, { id: 'file', label: 'Archivo', type: 'file', col: 12, hint: 'Simulado: no se sube el archivo en la demo' }], onSave: (d) => { p.gallery.push({ hue: Math.floor(Math.random() * 360), label: d.label }); Audit.log('Producto', p.id, 'cambio_contenido', '', 'Imagen agregada: ' + d.label); Store.save(); UI.toast('Imagen agregada a la galería.'); rerender(); } }));
    on(b, '[data-gmain]', guard(PERM.update, (x) => { p.gallery.forEach((g, i) => g.main = i === +x.dataset.gmain); p.hue = p.gallery[+x.dataset.gmain].hue; Audit.log('Producto', p.id, 'cambio_contenido', '', 'Imagen principal'); Store.save(); rerender(); }));
    on(b, '[data-grmv]', guard(PERM.update, (x) => { p.gallery.splice(+x.dataset.grmv, 1); Store.save(); rerender(); }));
  }

  /* ---------------- Canales §28 ---------------- */
  function tabChannels(b, p) {
    const E = can(PERM.publish); const act = p.status === 'ACTIVE';
    b.innerHTML = (!act ? UI.alert('warn', 'Producto en estado <b>' + UI.statusLabel(p.status) + '</b>: solo productos activos pueden publicarse en canales de venta (PRD-BR-002). ERP permanece habilitado para la gestión interna.') + '<div style="height:12px"></div>' : '') + readOnlyNote(PERM.publish) +
      UI.card('Publicación por canal', '<div class="list">' + CH.map(c => { const lock = c[0] === 'erp' || !E || (!act && !p.channels[c[0]]); return '<div class="list-item"><div class="ico-box ' + (p.channels[c[0]] ? 'ok' : '') + '">' + ic({ erp: 'server', crm: 'users', quotes: 'file', b2b: 'handshake', portal: 'globe', portalPax: 'user', cms: 'layout', ecommerce: 'cart', mobile: 'phone' }[c[0]]) + '</div><div class="grow"><b class="small">' + c[1] + '</b><div class="xs faint">' + esc(c[2]) + '</div></div>' + (p.channels[c[0]] ? (act || c[0] === 'erp' ? UI.badge('publicado') : UI.badge('pendiente', 'Pendiente de activación')) : UI.badge('despublicado', 'No publicado')) + '<label class="switch"><input type="checkbox" data-chn="' + c[0] + '"' + (p.channels[c[0]] ? ' checked' : '') + (lock ? ' disabled' : '') + ' aria-label="' + c[1] + '"></label></div>'; }).join('') + '</div>', { tight: true, sub: 'No todos los productos se publican en todos los canales. Cada publicación y despublicación queda auditada (§29).' });
    b.querySelectorAll('[data-chn]').forEach(i => i.onchange = () => { if (!can(PERM.publish)) { i.checked = !i.checked; noPerm(PERM.publish); return; } const k = i.dataset.chn; if (i.checked && !act) { i.checked = false; UI.toast('<b>PRD-BR-002:</b> active el producto antes de publicarlo en ' + esc(CH.find(c => c[0] === k)[1]) + '.', 'bad'); return; }
      p.channels[k] = i.checked; if (k === 'b2b') p.flags.b2b = i.checked; if (k === 'ecommerce') p.flags.ecommerce = i.checked; if (k === 'quotes') p.flags.quoteable = i.checked;
      Audit.log('Producto', p.id, i.checked ? 'publicacion' : 'despublicacion', '', CH.find(c => c[0] === k)[1]); Store.save(); UI.toast((i.checked ? 'Publicado en ' : 'Despublicado de ') + esc(CH.find(c => c[0] === k)[1]) + '.'); rerender(); });
  }

  /* ---------------- Versiones §15 ---------------- */
  function newVersionModal(p) {
    const cur = p.versions.filter(v => v.status !== 'histórica').slice(-1)[0] || p.versions[p.versions.length - 1] || { v: '0.0' };
    const [a, c] = String(cur.v).split('.').map(n => parseInt(n, 10) || 0);
    const minor = a + '.' + (c + 1), major = (a + 1) + '.0';
    formModal({ title: 'Crear nueva versión', sub: p.name + ' · versión actual ' + cur.v, pre: UI.alert('info', 'La nueva versión guarda un snapshot de datos, componentes, itinerario, tarifas, condiciones y políticas. La versión anterior se marca como <b>histórica</b> y permanece consultable (PRD-BR-017, PRD-T12).') + '<div style="height:12px"></div>',
      fields: [{ id: 'kind', label: 'Tipo de cambio', type: 'select', options: [[minor, 'Menor → ' + minor], [major, 'Mayor → ' + major]], col: 6 }, { id: 'validFrom', label: 'Vigente desde', type: 'date', required: true, value: T(), col: 6 }, { id: 'reason', label: 'Motivo del cambio', type: 'textarea', rows: 3, required: true, col: 12, placeholder: 'p. ej. Nuevo horario de tren y actualización de tarifas 2027' }],
      saveLabel: 'Crear versión',
      onSave: (d) => { if (p.versions.some(v => v.v === d.kind)) { UI.toast('La versión ' + d.kind + ' ya existe.', 'bad'); return false; }
        const prev = p.versions.filter(v => v.status !== 'histórica'); prev.forEach(v => v.status = 'histórica');
        const st = ['ACTIVE', 'APPROVED', 'SUSPENDED', 'INACTIVE'].includes(p.status) ? 'vigente' : p.status === 'REVIEW' ? 'en revisión' : 'borrador';
        p.versions.push({ v: d.kind, date: T(), validFrom: d.validFrom, user: Auth.user.id, reason: d.reason, status: st, snapshot: snap(p) });
        p.updatedAt = T(); Audit.log('Producto', p.id, 'nueva_version', cur.v, d.kind + ' — ' + d.reason); Store.save(); UI.toast('Versión ' + d.kind + ' creada; ' + cur.v + ' quedó como histórica.'); rerender(); } });
  }

  function snapSummary(s) {
    const svcN = (c) => c.productId ? Q.productName(c.productId) : ((Q.service(c.serviceId) || {}).name || c.serviceId);
    return {
      'Nombre': s.name, 'Tipo': s.type, 'Categoría': s.category + ' › ' + (s.subcategory || '—'), 'Destino': Q.destPath(s.destId), 'Duración': s.durationValue + ' ' + s.durationUnit, 'Modalidad': s.modality, 'Proveedor principal': Q.providerName(s.mainProviderId), 'Markup ref.': (s.markupPct || 0) + '%',
      'Componentes': s.components.length + ': ' + s.components.map(svcN).join(', '), 'Itinerario': s.itinerary.length + ' día(s), ' + sum(s.itinerary, d => (d.items || []).length) + ' actividad(es)',
      'Tarifas': s.rates.map(r => r.id + ' ' + r.currency + ' ' + r.price).join(' · ') || '—', 'Cancelación': (s.policies || {}).cancel || '—', 'Inclusiones': s.inclusions.length + ' ítem(s)', 'Exclusiones': s.exclusions.length + ' ítem(s)'
    };
  }

  function tabVersions(b, p) {
    const vs = p.versions.slice().reverse();
    b.innerHTML = UI.card('Historial de versiones', tbl(['Versión', 'Fecha', 'Vigente desde', 'Usuario', 'Motivo del cambio', 'Estado', ''], vs.map(v => '<tr><td class="mono"><b>v' + esc(v.v) + '</b></td><td class="nowrap">' + date(v.date) + '</td><td class="nowrap small">' + date(v.validFrom || v.date) + '</td><td>' + UI.userChip(v.user) + '</td><td class="small">' + esc(v.reason) + '</td><td>' + UI.badge(v.status) + '</td><td><button class="btn xs" data-vsee="' + esc(v.v) + '">' + ic('eye') + 'Snapshot</button></td></tr>').join(''), 'compact'),
      { tight: true, sub: 'Las cotizaciones y reservas referencian la versión usada (snapshot); las versiones históricas no se modifican (PRD-BR-017).', actions: '<button class="btn sm primary" id="v-new"' + dis(PERM.update) + '>' + ic('copy') + 'Crear nueva versión</button>' }) +
      '<div style="height:16px"></div>' +
      UI.card('Comparar versiones', p.versions.length < 2 ? '<p class="small faint">Se necesitan al menos dos versiones para comparar.</p>' : '<div class="row" style="margin-bottom:12px"><div class="field"><label for="v-a">Versión A</label><select class="input" id="v-a">' + p.versions.map((v, i) => '<option' + (i === p.versions.length - 2 ? ' selected' : '') + '>' + esc(v.v) + '</option>').join('') + '</select></div><div class="field"><label for="v-b">Versión B</label><select class="input" id="v-b">' + p.versions.map((v, i) => '<option' + (i === p.versions.length - 1 ? ' selected' : '') + '>' + esc(v.v) + '</option>').join('') + '</select></div></div><div id="v-diff"></div>');
    const nb = b.querySelector('#v-new'); if (nb) nb.onclick = guard(PERM.update, () => newVersionModal(p));
    on(b, '[data-vsee]', (x) => { const v = p.versions.find(y => y.v === x.dataset.vsee); const s = snapSummary(v.snapshot || snap(p)); UI.modal({ title: 'Snapshot versión ' + esc(v.v), sub: esc(p.name) + ' · ' + date(v.date) + ' · ' + esc(Q.userName(v.user)) + ' · inmutable', size: 'lg', body: UI.alert('info', 'Snapshot inmutable de la versión: las cotizaciones que la referencian conservan estos datos aunque el producto cambie (PRD-T10).') + '<div style="height:12px"></div>' + UI.dl(Object.entries(s).map(([k, val]) => [k, esc(val)])), actions: [{ label: 'Cerrar' }] }); });
    const va = b.querySelector('#v-a'), vb = b.querySelector('#v-b');
    const diff = () => { const A = p.versions.find(v => v.v === va.value), B = p.versions.find(v => v.v === vb.value); const sa = snapSummary(A.snapshot || snap(p)), sb = snapSummary(B.snapshot || snap(p)); const keys = Object.keys(sa); const n = keys.filter(k => sa[k] !== sb[k]).length;
      b.querySelector('#v-diff').innerHTML = '<div class="small muted" style="margin-bottom:8px">' + n + ' diferencia(s) entre v' + esc(A.v) + ' y v' + esc(B.v) + '.</div>' + tbl(['Campo', 'v' + A.v + ' (' + UI.statusLabel(A.status) + ')', 'v' + B.v + ' (' + UI.statusLabel(B.status) + ')'], keys.map(k => '<tr class="' + (sa[k] !== sb[k] ? 'changed' : '') + '"><td class="nowrap"><b class="small">' + esc(k) + '</b></td><td class="small">' + esc(sa[k]) + '</td><td class="small">' + esc(sb[k]) + '</td></tr>').join(''), 'compact'); };
    if (va) { va.onchange = diff; vb.onchange = diff; diff(); }
  }

  /* ---------------- Historial (auditoría filtrada) ---------------- */
  function tabHistory(b, p) {
    const ids = new Set([p.id].concat(p.rates.map(r => r.id), p.departures.map(d => d.id)));
    const rows = DB.audit.filter(a => ids.has(a.entityId) || (a.after || '').includes(p.id + ' ') || (a.after || '').startsWith(p.id));
    UI.dataTable(b, { exportName: 'auditoria-' + p.id, rows, defaultSort: 'ts', defaultDir: -1, pageSize: 12, empty: 'Sin eventos de auditoría para este producto.',
      filters: [{ key: 'action', label: 'Acción', options: [...new Set(rows.map(r => r.action))].map(a => [a, a]) }, { key: 'entity', label: 'Entidad', options: [...new Set(rows.map(r => r.entity))].map(a => [a, a]) }],
      columns: [
        { key: 'ts', label: 'Fecha y hora', render: r => '<span class="nowrap">' + datetime(r.ts) + '</span>' },
        { key: 'user', label: 'Usuario', render: r => UI.userChip(r.user) },
        { key: 'entity', label: 'Entidad', render: r => esc(r.entity) + ' <span class="mono xs faint">' + esc(r.entityId) + '</span>' },
        { key: 'action', label: 'Acción', render: r => '<span class="tag mono">' + esc(r.action) + '</span>' },
        { key: 'before', label: 'Antes', render: r => '<span class="small">' + esc(r.before || '—') + '</span>' },
        { key: 'after', label: 'Después', render: r => '<span class="small">' + esc(r.after || '—') + '</span>' },
        { key: 'ip', label: 'IP / correlación', render: r => '<span class="mono xs">' + esc(r.ip) + '<br>' + esc(r.corr) + '</span>' }
      ] });
  }

  /* ==========================================================================
     RESERVAS ONLINE (motor de reservas v2.1) — configuración comercial por producto.
     Fuente única de cálculo: window.BookingEngine (BE). Este módulo SOLO edita la
     configuración (p.availability, p.paxRules, p.addons, p.accommodation, p.payment,
     p.pickup, p.ruleOverrides, p.ruleParams); disponibilidad, validación de pasajeros
     y precio se piden siempre a BE. Cada sección consulta su regla con BE.on().
     ========================================================================== */
  const BE = window.BookingEngine;
  const BK = {};
  const bk = (p) => (BK[p.id] = BK[p.id] || { month: null, picking: false, sel: [], day: null, seats: 1, sim: { adt: 2, chd: 1, inf: 1, age: 5 } });
  const AV_ST = { disponible: ['Disponible', 'ok'], cerrado: ['Ocupado / cerrado', 'bad'], agotado: ['Agotado', 'sun'], sin_cupo: ['Cupo insuficiente', 'warn'], fuera_de_plazo: ['Fuera de plazo', 'info'], no_opera: ['No opera', 'mute'], sin_configurar: ['Sin configurar', 'mute'], pasado: ['Fecha pasada', 'mute'] };
  const AV_SHORT = { cerrado: 'Ocup.', agotado: 'Agot.', fuera_de_plazo: 'Plazo', no_opera: 'No op.', sin_configurar: '—', pasado: '' };
  const RANGE_ST = [['disponible', 'Disponible'], ['cerrado', 'Cerrado / ocupado'], ['agotado', 'Agotado']];
  const LEG_WORD = { disponible: 'Disponible', cerrado: 'Ocupado', agotado: 'Agotado', gap: 'Sin rango' };
  const ADDON_CATS = ['Museo', 'Entrada', 'Alimentación', 'Transporte', 'Extensión', 'Seguro', 'Experiencia', 'Servicio', 'Otro'];
  const ROOM_TYPES = [['Simple', 1], ['Doble', 2], ['Matrimonial', 2], ['Triple', 3], ['Familiar', 4], ['Suite', 2]];
  const HOTEL_CATS = ['3 estrellas', '4 estrellas', '5 estrellas', 'Hostal', 'Lodge', 'Boutique'];
  const WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const PAY_MODES = { total: 'Pago total al reservar', adelanto: 'Adelanto + saldo antes del viaje', pagar_despues: 'Reservar ahora, pagar después' };
  const PAX_T = { ADT: 'Adulto', CHD: 'Niño', INF: 'Infante', NA: 'Sin clasificar' };
  const MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const BK_CSS = [
    '.bk-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}',
    '.bk-h{font-size:.66rem;font-weight:600;text-transform:uppercase;color:var(--fg-3);text-align:center;padding:2px 0}',
    '.bk-d{border:1px solid var(--line-2);border-radius:7px;min-height:54px;padding:4px 6px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;font:inherit;font-size:.7rem;background:var(--surface);color:var(--fg-2);cursor:pointer;text-align:left;min-width:0}',
    '.bk-d .dn{font-weight:700;font-size:.8rem}',
    '.bk-d .bl{font-size:.64rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.bk-d.st-disponible{background:var(--ok-soft);color:var(--ok);border-color:transparent}',
    '.bk-d.st-cerrado{background:var(--bad-soft);color:var(--bad);border-color:transparent}',
    '.bk-d.st-agotado{background:var(--sun-soft);color:var(--sun-2);border-color:transparent}',
    '.bk-d.st-sin_cupo{background:var(--warn-soft);color:var(--warn);border-color:transparent}',
    '.bk-d.st-fuera_de_plazo{background:var(--info-soft);color:var(--info);border-color:transparent}',
    '.bk-d.st-no_opera,.bk-d.st-sin_configurar{background:var(--surface-2);color:var(--fg-3)}',
    '.bk-d.st-pasado{background:transparent;color:var(--fg-3);opacity:.5;cursor:default}',
    '.bk-d.empty{border:0;background:transparent;cursor:default}',
    '.bk-d.sel{outline:2px solid var(--accent);outline-offset:1px}',
    '.bk-d.cur{box-shadow:inset 0 0 0 2px var(--accent)}',
    '.bk-lg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:.72rem;color:var(--fg-2);margin-top:10px}',
    '.bk-sw{width:11px;height:11px;border-radius:3px;display:inline-block;vertical-align:-1px;margin-right:4px;border:1px solid var(--line)}',
    '.bk-sw.st-disponible{background:var(--ok)} .bk-sw.st-cerrado{background:var(--bad)} .bk-sw.st-agotado{background:var(--sun)} .bk-sw.st-sin_cupo{background:var(--warn)} .bk-sw.st-fuera_de_plazo{background:var(--info)} .bk-sw.st-no_opera{background:var(--surface-3)}',
    '.bk-sum{padding:10px 12px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface-2);font-size:.84rem;line-height:1.6}',
    '.bk-off{opacity:.55}',
    '.bk-rule{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;padding:11px 0;border-bottom:1px dashed var(--line-2);align-items:start}',
    '.bk-rule:last-child{border-bottom:0}',
    '.bk-params{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}',
    '.bk-params .field{width:160px;max-width:100%}',
    '.bk-leg{border:1px solid var(--line-2);border-radius:10px;padding:12px;background:var(--surface-2)}',
    '.bk-leg+.bk-leg{margin-top:10px}',
    '.bk-wd{display:flex;flex-wrap:wrap;gap:6px 14px}',
    '.bk-pt{display:flex;gap:6px;align-items:center;margin-bottom:6px}',
    '.bk-pt .input{flex:1;min-width:0}',
    '.bk-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
    '@media (max-width:560px){.bk-d{min-height:42px;padding:3px 4px}.bk-d .bl{display:none}.bk-rule{grid-template-columns:minmax(0,1fr)}.bk-cal{gap:2px}}'
  ];

  /* ---------- Estado de reglas (tenant + override por producto) ---------- */
  const ruleState = (id, p) => { const r = BE.rule(id); if (!r) return 'on'; if (!r.enabled) return 'tenant_off'; if (r.productOverride && p.ruleOverrides && p.ruleOverrides[id] === false) return 'product_off'; return 'on'; };
  const ruleTag = (id) => '<span class="tag mono">' + esc(id) + '</span>';
  const rulesLink = () => Access.canRoute('admin/reglas') ? ' <a href="#/admin/reglas">Administrar en Reglas de reserva</a>.' : ' <span class="xs faint">La administra el Administrador del tenant (Administración › Reglas de reserva).</span>';
  /* HTML de bloqueo si TODAS las reglas indicadas están apagadas; null si alguna está activa */
  function gate(p, ids, what) {
    const st = ids.map(id => ruleState(id, p));
    if (st.some(s => s === 'on')) return null;
    if (st.every(s => s === 'tenant_off')) return UI.alert('info', '<b>Regla desactivada para este tenant</b> ' + ids.map(ruleTag).join(' ') + '. ' + esc(what) + ' no se ofrece en ningún canal mientras la regla esté apagada; la configuración guardada del producto se conserva.' + rulesLink());
    const off = ids.filter((id, i) => st[i] === 'product_off');
    return UI.alert('warn', '<b>Desactivada solo para este producto</b> ' + off.map(ruleTag).join(' ') + '. ' + esc(what) + ' no se ofrece para este producto (override en «Reglas del producto»).' + (can(PERM.update) ? ' <a href="javascript:void(0)" data-reenable="' + off.join(',') + '">Reactivar para este producto</a>' : ''));
  }
  const ruleNote = (id, p) => { const s = ruleState(id, p); return s === 'on' ? '' : '<div class="xs faint" style="margin-top:4px">' + ruleTag(id) + ' ' + (s === 'tenant_off' ? 'desactivada para este tenant' : 'desactivada para este producto') + '.</div>'; };
  function bindReenable(root, p) {
    on(root, '[data-reenable]', guard(PERM.update, (x) => { const ids = x.dataset.reenable.split(','); p.ruleOverrides = p.ruleOverrides || {}; ids.forEach(id => delete p.ruleOverrides[id]); touch(p, 'regla_producto', ids.join(', ') + ': desactivada', 'reactivada (usa configuración del tenant)'); UI.toast('Regla reactivada para este producto.'); rerender(); }));
  }
  function touch(p, action, before, after) { p.updatedAt = T(); Audit.log('Producto', p.id, action, before == null ? '' : String(before), after == null ? '' : String(after)); Store.save(); }
  const dsab = (E) => E ? '' : ' disabled';
  const numIn = (id, label, val, { min, max, step, col = 3, hint, E = true } = {}) => '<div class="field c' + col + '"><label for="' + id + '">' + esc(label) + '</label><input class="input" type="number" id="' + id + '" value="' + esc(val == null ? '' : val) + '"' + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') + (step ? ' step="' + step + '"' : '') + dsab(E) + '>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  const swIn = (id, label, val, E, col = 6, hint) => '<div class="c' + col + '"><label class="switch"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') + dsab(E) + '> ' + esc(label) + '</label>' + (hint ? '<div class="xs faint" style="margin-top:3px">' + hint + '</div>' : '') + '</div>';
  const val = (root, id) => { const e = root.querySelector('#' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : undefined; };
  const nval = (root, id) => { const v = val(root, id); return v === '' || v == null ? null : Number(v); };
  const rateCur = (p) => ((BE.baseRate(p, 'Adulto') || BE.baseRate(p, 'Pasajero') || mainRate(p) || {}).currency) || 'PEN';
  const allRanges = () => DB.products.flatMap(x => (x.availability && x.availability.ranges) || []);
  const allAddons = () => DB.products.flatMap(x => x.addons || []);
  const eachDay = (from, to, fn) => { let d = from; let g = 0; while (d <= to && g++ < 1200) { fn(d); d = BE.util.addDays(d, 1); } };
  const nightsExpected = (p) => p.durationUnit === 'días' ? Math.max(0, p.durationValue - 1) : p.durationUnit === 'noches' ? p.durationValue : null;

  /* ---------- Leyenda textual de rangos («Disponible del 02 al 06 oct · Ocupado del 07 al 09 oct …») ---------- */
  function fmtSpan(a, b) {
    const pa = BE.util.parse(a), pb = BE.util.parse(b); const y0 = BE.util.parse(T()).getFullYear();
    const d2 = (d) => pad(d.getDate()); const m = (d) => MES_L[d.getMonth()].slice(0, 3).replace('set', 'set');
    const yr = (d) => d.getFullYear() !== y0 ? ' ' + d.getFullYear() : '';
    if (a === b) return 'el ' + d2(pa) + ' ' + m(pa) + yr(pa);
    if (pa.getMonth() === pb.getMonth() && pa.getFullYear() === pb.getFullYear()) return 'del ' + d2(pa) + ' al ' + d2(pb) + ' ' + m(pb) + yr(pb);
    return 'del ' + d2(pa) + ' ' + m(pa) + (pa.getFullYear() !== pb.getFullYear() ? yr(pa) : '') + ' al ' + d2(pb) + ' ' + m(pb) + yr(pb);
  }
  /* Segmentos efectivos: mismo criterio de precedencia que BE.dayStatus (un rango no disponible prevalece sobre uno disponible) */
  function rangeSegments(p) {
    const rs = (p.availability && p.availability.ranges) || []; if (!rs.length) return [];
    const from = rs.reduce((a, r) => r.from < a ? r.from : a, rs[0].from), to = rs.reduce((a, r) => r.to > a ? r.to : a, rs[0].to);
    const start = from < T() ? T() : from; if (start > to) return [];
    const segs = [];
    eachDay(start, to, (d) => {
      const hits = rs.filter(r => d >= r.from && d <= r.to); const r = hits.find(x => x.status !== 'disponible') || hits[0] || null;
      const st = r ? r.status : 'gap'; const key = st + '|' + (st === 'disponible' ? r.capacityPerDay : '');
      const last = segs[segs.length - 1];
      if (last && last.key === key && BE.util.addDays(last.to, 1) === d) last.to = d; else segs.push({ key, status: st, from: d, to: d, cap: r ? r.capacityPerDay : null, note: r ? r.note : '' });
    });
    return segs;
  }
  const legendText = (p) => rangeSegments(p).map(s => LEG_WORD[s.status] + ' ' + fmtSpan(s.from, s.to) + (s.status === 'disponible' ? ' (' + s.cap + ' cupos/día)' : '')).join(' · ');
  const legendHtml = (p) => { const segs = rangeSegments(p); return segs.length ? segs.map(s => '<span class="nowrap"><span class="bk-sw st-' + (s.status === 'gap' ? 'no_opera' : s.status) + '"></span>' + '<b>' + LEG_WORD[s.status] + '</b> ' + fmtSpan(s.from, s.to) + (s.status === 'disponible' ? ' <span class="faint">(' + s.cap + '/día)</span>' : '') + '</span>').join(' <span class="faint">·</span> ') : '<span class="faint">Sin rangos vigentes configurados.</span>'; };

  /* ---------- Resúmenes ---------- */
  const paxSummary = (p) => {
    if (gate(p, ['R-CHILD-PER-ADULT', 'R-INFANT-FREE'], '')) return 'Reglas de niños e infantes desactivadas';
    const r = BE.paxRules(p); const chd = BE.baseRate(p, 'Niño');
    return 'Adulto ' + r.adultMinAge + '+ · Niño ' + r.childMinAge + '–' + r.childMaxAge + (BE.on('R-CHILD-PER-ADULT', p) ? (r.childPays ? ' paga ' + (chd ? 'tarifa Niño' : r.childPricePct + ' %') : ' no paga') + ' (máx. ' + r.maxChildrenPerAdult + '/adulto)' : '') +
      (BE.on('R-INFANT-FREE', p) ? ' · Infante 0–' + r.infantMaxAge + (r.infantAllowed === false ? ' no admitido' : r.infantPays ? ' paga' : ' no paga') + (r.infantAllowed === false ? '' : ' (máx. ' + r.maxInfantsPerAdult + '/adulto)') : '');
  };
  const lodgingSummary = (p) => { const legs = (p.accommodation && p.accommodation.legs) || []; const n = sum(legs, 'nights'); return legs.length + ' ciudad' + (legs.length === 1 ? '' : 'es') + ' · ' + n + ' noche' + (n === 1 ? '' : 's'); };
  const payModes = (p) => { const q = BE.quote(p, { pax: { adt: 1 } }); return q.modes; };
  const paySummary = (p) => { const q = BE.quote(p, { pax: { adt: 1 }, paymentMode: 'adelanto' }); return q.modes.map(m => m === 'adelanto' ? 'Adelanto ' + q.depositPct + ' %' : m === 'total' ? 'Pago total' : 'Pagar después (' + BE.param('R-PAY-LATER', 'holdHours', p) + ' h)').join(' · ') + (q.modes.includes('adelanto') ? ' · saldo ' + ((p.payment && p.payment.balanceDueDays != null) ? p.payment.balanceDueDays : BE.param('R-DEPOSIT', 'balanceDueDays')) + ' días antes' : ''); };

  /* ==========================================================================
     Pestaña «Reservas online» con sub-secciones
     ========================================================================== */
  function tabBooking(b, p, sub) {
    const SUBS = [
      { id: 'disponibilidad', label: 'Disponibilidad', rules: ['R-AVAIL-RANGES'], what: 'La disponibilidad por rangos de fechas', render: x => bkAvail(x, p) },
      { id: 'pasajeros', label: 'Pasajeros', rules: ['R-CHILD-PER-ADULT', 'R-INFANT-FREE'], what: 'El control de niños e infantes', render: x => bkPax(x, p) },
      { id: 'adicionales', label: 'Adicionales', count: (p.addons || []).length, rules: ['R-ADDONS'], what: 'La venta de adicionales', render: x => bkAddons(x, p) },
      { id: 'alojamiento', label: 'Alojamiento', rules: ['R-LODGING'], what: 'El alojamiento opcional por ciudad', render: x => bkLodging(x, p) },
      { id: 'pago', label: 'Pago', rules: ['R-DEPOSIT', 'R-PAY-LATER'], what: 'El pago con adelanto y el «pagar después» (solo pago total)', render: x => bkPayment(x, p) },
      { id: 'recojo', label: 'Recojo y datos', rules: ['R-PICKUP'], what: 'La solicitud de punto de recojo y vuelo', render: x => bkPickup(x, p) },
      { id: 'reglas', label: 'Reglas del producto', count: Object.keys(p.ruleOverrides || {}).length + Object.keys(p.ruleParams || {}).length || null, rules: [], render: x => bkRules(x, p) }
    ];
    const nx = BE.nextAvailable(p, 1);
    const box = (k, v) => '<div><div class="upper">' + k + '</div><div class="small" style="margin-top:3px">' + v + '</div></div>';
    const ov = Object.keys(p.ruleOverrides || {}).length, pr = Object.keys(p.ruleParams || {}).length;
    b.innerHTML = UI.card('Configuración comercial de reservas',
      '<div class="bk-sum">' + (ruleState('R-AVAIL-RANGES', p) === 'on' ? legendHtml(p) : '<span class="faint">Disponibilidad por rangos desactivada (' + (ruleState('R-AVAIL-RANGES', p) === 'tenant_off' ? 'tenant' : 'producto') + ').</span>') + '</div>' +
      '<div class="p-stats">' +
        box('Próxima fecha vendible', nx ? '<b>' + date(nx) + '</b>' : '<span class="bad">Sin fechas disponibles</span>') +
        box('Pasajeros', esc(paxSummary(p))) +
        box('Adicionales', BE.on('R-ADDONS', p) ? (p.addons || []).length + ' configurado(s)' : '<span class="faint">Regla desactivada</span>') +
        box('Alojamiento', !BE.on('R-LODGING', p) ? '<span class="faint">Regla desactivada</span>' : p.accommodation ? '<b>' + esc(lodgingSummary(p)) + '</b>' + (p.accommodation.optional ? ' · opcional' : ' · incluido') : '<span class="faint">No ofrece</span>') +
        box('Pago', esc(paySummary(p))) +
        box('Recojo', !BE.on('R-PICKUP', p) ? '<span class="faint">Regla desactivada</span>' : p.pickup ? (p.pickup.points || []).length + ' punto(s)' + (p.pickup.askFlight ? ' · pide vuelo' : '') + (p.pickup.required ? ' · obligatorio' : '') : '<span class="faint">Sin puntos</span>') +
        box('Ajustes de reglas', ov + pr ? ov + ' activación(es) · ' + pr + ' parámetro(s)' : 'Usa la configuración del tenant') +
      '</div>' +
      '<p class="xs faint" style="margin-top:10px">Todo cálculo (disponibilidad, validación de pasajeros, precio, adelanto y saldo) lo resuelve el motor de reservas (<span class="mono">BookingEngine</span>): el sitio web, el widget embebible, el portal B2B y el cotizador leen esta configuración; el backend vuelve a calcular y valida al confirmar.</p>',
      { sub: 'Cada sección obedece a una regla del centro de reglas; si el tenant la apaga, la sección deja de ofrecerse en todos los canales.' }) +
      '<div id="bk-sub" style="margin-top:14px"></div>';
    const ok = SUBS.some(s => s.id === sub);
    UI.tabs(b.querySelector('#bk-sub'), SUBS.map(s => ({ id: s.id, label: s.label + (s.rules.length && gate(p, s.rules, '') ? ' (desactivada)' : ''), count: s.count, render: (x) => {
      const g = s.rules.length ? gate(p, s.rules, s.what) : null;
      if (g) x.innerHTML = g; else s.render(x);
      bindReenable(x, p);
    } })), ok ? sub : 'disponibilidad', { pills: true, onChange: (t) => { try { history.replaceState(null, '', '#/catalogo/productos/' + p.id + '/reservas' + (t === 'disponibilidad' ? '' : '/' + t)); } catch (e) { } } });
  }

  /* ---------------- 1. Disponibilidad por rangos (R-AVAIL-RANGES, R-WEEKDAYS, R-CUTOFF) ---------------- */
  function defaultMonth(p) {
    const rs = ((p.availability && p.availability.ranges) || []).filter(r => r.to >= T()).sort((a, c) => a.from.localeCompare(c.from));
    const d = rs.length ? (rs[0].from > T() ? rs[0].from : T()) : T(); return d.slice(0, 7);
  }
  function bkAvail(x, p) {
    const E = can(PERM.avail);
    if (!p.availability) {
      x.innerHTML = readOnlyNote(PERM.avail) + UI.card('Disponibilidad por rangos', UI.empty('Este producto aún no tiene disponibilidad por rangos: el sitio web y el widget lo muestran como «Consultar».', 'calendar') +
        (E ? '<div style="text-align:center;margin-top:8px"><button class="btn primary" id="av-init">' + ic('plus') + 'Configurar disponibilidad por rangos</button></div>' : ''));
      const bi = x.querySelector('#av-init'); if (bi) bi.onclick = guard(PERM.avail, () => { p.availability = { ranges: [], weekdays: [0, 1, 2, 3, 4, 5, 6], cutoffHours: (p.advMin || 2) * 24 }; touch(p, 'disponibilidad_rangos', 'sin configurar', 'configuración inicial (todos los días, ' + p.availability.cutoffHours + ' h)'); UI.toast('Disponibilidad inicializada. Agregue el primer rango.'); rerender(); });
      return;
    }
    const st = bk(p); if (!st.month) st.month = defaultMonth(p);
    const av = p.availability;
    const [yy, mm] = st.month.split('-').map(Number);
    const days = BE.month(p, yy, mm - 1, st.seats);
    const lead = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
    const cal = '<div class="bk-cal">' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(h => '<div class="bk-h">' + h + '</div>').join('') +
      '<div class="bk-d empty"></div>'.repeat(lead) +
      days.map(d => { const short = d.status === 'disponible' ? (d.left != null ? d.left + ' disp.' : 'Disp.') : d.status === 'sin_cupo' ? d.left + ' disp.' : d.status === 'cerrado' && !d.range ? 'Sin rango' : AV_SHORT[d.status] || ''; return '<button type="button" class="bk-d st-' + d.status + (st.sel.includes(d.date) ? ' sel' : '') + (st.day === d.date ? ' cur' : '') + '" data-day="' + d.date + '" title="' + esc(date(d.date) + ' · ' + d.label + (d.note ? ' · ' + d.note : '')) + '"' + (d.status === 'pasado' ? ' disabled' : '') + '><span class="dn">' + d.day + '</span><span class="bl">' + esc(short) + '</span></button>'; }).join('') + '</div>';
    const dd = st.day && days.find(d => d.date === st.day);
    const rs = (av.ranges || []).slice().sort((a, c) => a.from.localeCompare(c.from) || (a.status === 'disponible' ? -1 : 1));
    const soldIn = (r) => { let mx = 0; eachDay(r.from > T() ? r.from : T(), r.to, d => { mx = Math.max(mx, BE.soldOn(p, d)); }); return mx; };
    x.innerHTML = readOnlyNote(PERM.avail) + '<div class="grid g-2-1"><div class="stack">' +
      UI.card('Calendario de disponibilidad',
        '<div class="row between" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><div class="row" style="gap:6px"><button class="btn sm ghost icon" id="cal-prev" title="Mes anterior">' + ic('chevronLeft') + '</button><b style="min-width:130px;text-align:center;text-transform:capitalize">' + MES_L[mm - 1] + ' ' + yy + '</b><button class="btn sm ghost icon" id="cal-next" title="Mes siguiente">' + ic('chevronRight') + '</button></div>' +
        '<label class="small row" style="gap:6px">Consultar para <select class="input" id="cal-seats" style="width:auto">' + [1, 2, 4, 6, 8, 12].map(n => '<option' + (n === st.seats ? ' selected' : '') + '>' + n + '</option>').join('') + '</select> pax</label></div>' +
        (st.picking ? UI.alert('warn', 'Modo <b>cerrar fechas</b>: haga clic en los días a cerrar (' + st.sel.length + ' seleccionado' + (st.sel.length === 1 ? '' : 's') + '). <button class="btn xs primary" id="pk-ok"' + (st.sel.length ? '' : ' disabled') + '>Cerrar fechas seleccionadas</button> <button class="btn xs ghost" id="pk-no">Cancelar</button>') : '') +
        cal +
        '<div class="bk-lg">' + ['disponible', 'cerrado', 'agotado', 'sin_cupo', 'fuera_de_plazo', 'no_opera'].map(k => '<span><span class="bk-sw st-' + k + '"></span>' + AV_ST[k][0] + '</span>').join('') + '</div>' +
        (dd ? '<div class="bk-sum" style="margin-top:10px"><b>' + date(dd.date) + '</b> · ' + UI.badge('x', AV_ST[dd.status] ? AV_ST[dd.status][0] : dd.status).replace('b-mute', 'b-' + (AV_ST[dd.status] || ['', 'mute'])[1]) + ' · ' + esc(dd.label) + (dd.left != null && dd.status !== 'cerrado' ? ' · quedan <b>' + dd.left + '</b>' + (dd.cap ? ' de ' + dd.cap : '') : '') + (dd.note ? '<div class="xs muted">' + esc(dd.note) + '</div>' : '') + (dd.range ? '<div class="xs faint">Rango <span class="mono">' + esc(dd.range.id) + '</span> · vendidos ' + BE.soldOn(p, dd.date) + ' · en hold ' + BE.heldOn(p, dd.date) + '</div>' : '') + (dd.departure ? '<div class="xs faint">Salida programada <span class="mono">' + esc(dd.departure.id) + '</span>: su capacidad prevalece sobre la del rango.</div>' : '') + '</div>' : '<p class="xs faint" style="margin-top:8px">Haga clic en un día para ver su estado según el motor (<span class="mono">BE.dayStatus</span>).</p>'),
        { actions: E ? '<button class="btn sm" id="pk-start"' + (st.picking ? ' disabled' : '') + '>' + ic('lock') + 'Cerrar fechas</button>' : '' }) +
      '</div><div class="stack">' +
      UI.card('Leyenda para el cliente', '<div class="small" style="line-height:1.7">' + legendHtml(p) + '</div><p class="xs faint" style="margin-top:8px">Texto generado desde los rangos (desde hoy). Se muestra igual en el sitio web y el widget.</p>') +
      UI.card('Operación', (BE.rule('R-WEEKDAYS') && ruleState('R-WEEKDAYS', p) === 'on' ? '<div class="upper" style="margin-bottom:6px">Días de operación</div><div class="bk-wd">' + [1, 2, 3, 4, 5, 6, 0].map(i => '<label class="check"><input type="checkbox" data-wd="' + i + '"' + ((av.weekdays || []).includes(i) ? ' checked' : '') + dsab(E) + '> ' + WD[i] + '</label>').join('') + '</div>' : '<div class="xs faint">' + ruleTag('R-WEEKDAYS') + ' desactivada: el producto opera todos los días.</div>') +
        (ruleState('R-CUTOFF', p) === 'on' ? '<div class="form-grid" style="margin-top:12px">' + numIn('av-cut', 'Anticipación mínima (horas)', av.cutoffHours, { min: 0, max: 8760, col: 12, E, hint: 'Fechas dentro de este plazo aparecen «fuera de plazo». Por defecto del tenant: ' + BE.param('R-CUTOFF', 'defaultHours') + ' h.' }) + '</div>' : '<div class="xs faint" style="margin-top:10px">' + ruleTag('R-CUTOFF') + ' desactivada: no se exige anticipación.</div>') +
        (E ? '<button class="btn sm primary" id="av-ops" style="margin-top:12px">' + ic('check') + 'Guardar operación</button>' : '')) +
      '</div></div>' +
      UI.card('Rangos de disponibilidad', rs.length ? tbl(['Rango', 'Desde', 'Hasta', ['Días', 'num'], 'Estado', ['Cupo/día', 'num'], ['Máx. vendidos', 'num'], 'Nota'].concat(E ? [''] : []), rs.map(r => { const dn = BE.util.diffDays(r.from, r.to) + 1; const past = r.to < T(); return '<tr' + (past ? ' class="bk-off"' : '') + '><td class="mono">' + esc(r.id) + '</td><td class="nowrap">' + date(r.from) + '</td><td class="nowrap">' + date(r.to) + '</td><td class="num">' + dn + '</td><td>' + UI.badge('x', RANGE_ST.find(s => s[0] === r.status)[1]).replace('b-mute', 'b-' + AV_ST[r.status][1]) + (rs.some(o => o !== r && o.status === 'disponible' && r.status !== 'disponible' && !(r.to < o.from || r.from > o.to)) ? ' <span class="xs faint">excepción</span>' : '') + '</td><td class="num">' + (r.status === 'disponible' ? r.capacityPerDay : '—') + '</td><td class="num">' + (past ? '—' : soldIn(r)) + '</td><td class="small">' + esc(r.note || '') + '</td>' + (E ? '<td class="nowrap"><button class="btn xs" data-rg="' + esc(r.id) + '">' + ic('edit') + 'Editar</button> <button class="btn xs ghost icon" data-rgdel="' + esc(r.id) + '" title="Eliminar rango">' + ic('trash') + '</button></td>' : '') + '</tr>'; }).join(''), 'compact') : UI.empty('Sin rangos. Agregue un rango disponible para empezar a vender.', 'calendar'),
        { tight: true, sub: 'Un rango cerrado o agotado puede superponerse a uno disponible como excepción (p. ej. 07–09 oct dentro de la temporada); dos rangos del mismo tipo no pueden solaparse.', actions: E ? '<button class="btn sm primary" id="rg-new">' + ic('plus') + 'Nuevo rango</button>' : '' });

    const redraw = () => bkAvail(x, p);
    const shift = (n) => { const d = new Date(yy, mm - 1 + n, 1); st.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); st.day = null; redraw(); };
    x.querySelector('#cal-prev').onclick = () => shift(-1); x.querySelector('#cal-next').onclick = () => shift(1);
    x.querySelector('#cal-seats').onchange = (e) => { st.seats = +e.target.value; redraw(); };
    on(x, '[data-day]', (btn) => { const d = btn.dataset.day; if (st.picking) { st.sel = st.sel.includes(d) ? st.sel.filter(z => z !== d) : st.sel.concat(d); } else st.day = st.day === d ? null : d; redraw(); });
    const ps = x.querySelector('#pk-start'); if (ps) ps.onclick = guard(PERM.avail, () => { st.picking = true; st.sel = []; st.day = null; redraw(); });
    const pn = x.querySelector('#pk-no'); if (pn) pn.onclick = () => { st.picking = false; st.sel = []; redraw(); };
    const pk = x.querySelector('#pk-ok'); if (pk) pk.onclick = guard(PERM.avail, () => closeDatesModal(p, st));
    const ops = x.querySelector('#av-ops'); if (ops) ops.onclick = guard(PERM.avail, () => {
      const before = 'días ' + (av.weekdays || []).map(i => WD[i]).join(',') + ' · ' + av.cutoffHours + ' h';
      const wds = [...x.querySelectorAll('[data-wd]')]; if (wds.length) { const sel = wds.filter(c => c.checked).map(c => +c.dataset.wd).sort(); if (!sel.length) { UI.toast('Seleccione al menos un día de operación (R-WEEKDAYS).', 'bad'); return; } av.weekdays = sel; }
      const cut = x.querySelector('#av-cut'); if (cut) { const h = cut.value === '' ? null : +cut.value; if (h == null || h < 0 || h > 8760 || !Number.isInteger(h)) { cut.classList.add('err'); UI.toast('La anticipación debe ser un número entero de horas entre 0 y 8760.', 'bad'); return; } av.cutoffHours = h; }
      touch(p, 'disponibilidad_operacion', before, 'días ' + av.weekdays.map(i => WD[i]).join(',') + ' · ' + av.cutoffHours + ' h'); UI.toast('Operación guardada.'); rerender();
    });
    const rn = x.querySelector('#rg-new'); if (rn) rn.onclick = guard(PERM.avail, () => rangeModal(p, null));
    on(x, '[data-rg]', guard(PERM.avail, (b2) => rangeModal(p, av.ranges.find(r => r.id === b2.dataset.rg))));
    on(x, '[data-rgdel]', guard(PERM.avail, (b2) => { const r = av.ranges.find(z => z.id === b2.dataset.rgdel); const sold = r.status === 'disponible' && r.to >= T() ? soldIn(r) : 0;
      UI.confirm({ title: 'Eliminar rango ' + r.id, danger: true, confirmLabel: 'Eliminar', message: esc(RANGE_ST.find(s => s[0] === r.status)[1]) + ' ' + esc(fmtSpan(r.from, r.to)) + '.' + (sold ? ' <b>Hay hasta ' + sold + ' cupo(s) vendidos en esas fechas:</b> las reservas existentes no se anulan, pero las fechas dejarán de venderse si ningún otro rango las cubre.' : ''), onConfirm: () => { av.ranges = av.ranges.filter(z => z !== r); touch(p, 'rango_eliminar', r.id + ' ' + r.from + '→' + r.to + ' ' + r.status, ''); UI.toast('Rango eliminado.'); rerender(); } }); }));
  }
  /* Valida un rango contra los demás (BE.overlaps). Devuelve mensaje de error o null. */
  function rangeError(p, r, exceptId) {
    if (!r.from || !r.to) return 'Indique las fechas desde y hasta.';
    if (r.from > r.to) return 'La fecha «desde» debe ser anterior o igual a «hasta».';
    if (r.to < T()) return 'El rango termina en el pasado; no afecta ventas.';
    if (BE.util.diffDays(r.from, r.to) > 730) return 'Un rango no puede superar 2 años.';
    if (r.status === 'disponible' && (!Number.isInteger(r.capacityPerDay) || r.capacityPerDay < 1 || r.capacityPerDay > 500)) return 'Indique un cupo por día entero entre 1 y 500.';
    const clash = BE.overlaps(p, r.from, r.to, exceptId).filter(o => (o.status === 'disponible') === (r.status === 'disponible'));
    if (clash.length) return 'Se superpone con ' + clash.map(o => o.id + ' (' + fmtSpan(o.from, o.to) + ', ' + o.status + ')').join(', ') + '. Solo un rango cerrado/agotado puede superponerse a uno disponible como excepción (CAT-AV-01).';
    if (r.status === 'disponible') { let bad = null; eachDay(r.from > T() ? r.from : T(), r.to, d => { const s = BE.soldOn(p, d); if (!bad && s > r.capacityPerDay) bad = [d, s]; }); if (bad) return 'El ' + date(bad[0]) + ' ya hay ' + bad[1] + ' cupos vendidos: el cupo por día no puede ser menor (CAT-AV-03).'; }
    return null;
  }
  function soldDays(p, from, to) { const out = []; eachDay(from > T() ? from : T(), to, d => { const s = BE.soldOn(p, d); if (s) out.push([d, s]); }); return out; }
  function notifyClosed(p, sd, what) { if (!sd.length) return; Notify.push('disponibilidad.cerrada_con_ventas', 'Email', 'U05', p.id + ': ' + what + ' con ' + sum(sd, z => z[1]) + ' cupo(s) vendidos (' + sd.map(z => dateShort(z[0])).join(', ') + '). Revisar reservas afectadas.'); }
  function rangeModal(p, r) {
    formModal({ title: r ? 'Editar rango ' + r.id : 'Nuevo rango de disponibilidad', sub: esc(p.name), size: 'lg',
      pre: UI.alert('info', 'Un rango <b>cerrado</b> o <b>agotado</b> puede superponerse a uno <b>disponible</b> y prevalece como excepción (caso: disponible 02–06 oct, ocupado 07–09 oct, disponible 10–14 oct). Dos rangos del mismo tipo no pueden solaparse.'),
      fields: [
        { id: 'from', label: 'Desde', type: 'date', required: true, value: r ? r.from : BE.util.addDays(T(), 7), col: 4 },
        { id: 'to', label: 'Hasta', type: 'date', required: true, value: r ? r.to : BE.util.addDays(T(), 37), col: 4 },
        { id: 'status', label: 'Estado', type: 'select', options: RANGE_ST, value: r ? r.status : 'disponible', col: 4 },
        { id: 'capacityPerDay', label: 'Capacidad por día (pax)', type: 'number', min: 0, max: 500, value: r ? r.capacityPerDay : (p.maxPax || 12), col: 4, hint: 'Solo aplica a rangos disponibles' },
        { id: 'note', label: 'Nota (visible en el calendario)', value: r ? r.note || '' : '', col: 8, placeholder: 'p. ej. Grupo privado, mantenimiento de vía, feriado' }
      ],
      onSave: (f) => {
        const o = { from: f.from, to: f.to, status: f.status, capacityPerDay: f.status === 'disponible' ? (f.capacityPerDay === '' ? null : f.capacityPerDay) : 0, note: f.note };
        const err = rangeError(p, o, r ? r.id : null); if (err) { UI.toast(err, 'bad'); return false; }
        const apply = () => {
          const before = r ? r.from + '→' + r.to + ' ' + r.status + ' cap ' + r.capacityPerDay : '';
          const tgt = r || { id: nextId('RG-', allRanges(), 4) }; Object.assign(tgt, o); if (!r) p.availability.ranges.push(tgt);
          touch(p, r ? 'rango_modificar' : 'rango_crear', before, tgt.id + ' ' + tgt.from + '→' + tgt.to + ' ' + tgt.status + ' cap ' + tgt.capacityPerDay + (tgt.note ? ' · ' + tgt.note : ''));
          if (o.status !== 'disponible') notifyClosed(p, soldDays(p, o.from, o.to), 'rango ' + tgt.id + ' ' + o.status);
          UI.closeModal(); UI.toast(r ? 'Rango actualizado.' : 'Rango ' + tgt.id + ' creado.'); rerender();
        };
        const sd = o.status !== 'disponible' ? soldDays(p, o.from, o.to) : [];
        if (sd.length) { UI.confirm({ title: 'Fechas con ventas', confirmLabel: 'Cerrar de todos modos', danger: true, message: 'Las fechas ' + sd.map(z => dateShort(z[0]) + ' (' + z[1] + ' pax)').join(', ') + ' tienen reservas. Las reservas existentes <b>no</b> se anulan; se notificará a Operaciones para gestionarlas.', onConfirm: apply }); return false; }
        apply(); return false;
      } });
  }
  function closeDatesModal(p, st) {
    const days = st.sel.slice().sort().filter(d => { const s = BE.dayStatus(p, d); return !['cerrado', 'agotado', 'pasado'].includes(s.status); });
    if (!days.length) { UI.toast('Los días seleccionados ya están cerrados o agotados.', 'info'); return; }
    const groups = []; days.forEach(d => { const g = groups[groups.length - 1]; if (g && BE.util.addDays(g.to, 1) === d) g.to = d; else groups.push({ from: d, to: d }); });
    const sd = groups.flatMap(g => soldDays(p, g.from, g.to));
    formModal({ title: 'Cerrar ' + days.length + ' fecha(s)', sub: esc(p.name), size: 'sm',
      pre: '<div class="bk-sum" style="margin-bottom:12px">Se crearán ' + groups.length + ' rango(s): ' + groups.map(g => '<b>' + fmtSpan(g.from, g.to) + '</b>').join(', ') + '</div>' + (sd.length ? UI.alert('warn', 'Fechas con ventas: ' + sd.map(z => dateShort(z[0]) + ' (' + z[1] + ' pax)').join(', ') + '. Las reservas no se anulan; se notifica a Operaciones.') : ''),
      fields: [{ id: 'status', label: 'Estado', type: 'select', options: RANGE_ST.slice(1), value: 'cerrado', col: 12 }, { id: 'note', label: 'Motivo (visible en el calendario)', required: true, col: 12, placeholder: 'p. ej. Ocupado: grupo privado' }],
      saveLabel: 'Cerrar fechas',
      onSave: (f) => {
        const ids = groups.map(g => { const r = { id: nextId('RG-', allRanges(), 4), from: g.from, to: g.to, status: f.status, capacityPerDay: 0, note: f.note }; p.availability.ranges.push(r); return r.id + ' ' + g.from + '→' + g.to; });
        touch(p, 'cerrar_fechas', '', f.status + ' · ' + ids.join('; ') + ' · ' + f.note); notifyClosed(p, sd, 'cierre de fechas');
        st.picking = false; st.sel = []; UI.toast(days.length + ' fecha(s) cerradas en ' + groups.length + ' rango(s).'); rerender();
      } });
  }

  /* ---------------- 2. Reglas de pasajeros (R-CHILD-PER-ADULT, R-INFANT-FREE, R-MIN-ADULTS, R-MAX-PAX) ---------------- */
  function bkPax(x, p) {
    const E = can(PERM.update); const base = Object.assign({ infantAllowed: true }, BE.cfg().defaultPaxRules || {}, p.paxRules || {});
    const chdOn = BE.on('R-CHILD-PER-ADULT', p), infOn = BE.on('R-INFANT-FREE', p), minOn = BE.on('R-MIN-ADULTS', p);
    const chdRate = BE.baseRate(p, 'Niño'); const st = bk(p).sim;
    x.innerHTML = readOnlyNote(PERM.update) + '<div class="grid g-2-1"><div class="stack">' +
      UI.card('Reglas de pasajeros', (p.paxRules ? '' : UI.alert('info', 'El producto hereda los valores por defecto del tenant (Monedas y e-commerce). Al guardar se crea una configuración propia.')) +
        '<div class="form-grid">' +
        '<div class="section-title">Bandas de edad</div>' +
        numIn('px-adt', 'Adulto desde (años)', base.adultMinAge, { min: 1, max: 99, E }) + numIn('px-cmin', 'Niño desde', base.childMinAge, { min: 0, max: 17, E }) + numIn('px-cmax', 'Niño hasta', base.childMaxAge, { min: 0, max: 17, E }) + numIn('px-imax', 'Infante hasta', base.infantMaxAge, { min: 0, max: 5, E }) +
        '<div class="section-title">Niños ' + ruleTag('R-CHILD-PER-ADULT') + '</div>' +
        (chdOn ? swIn('px-cpays', 'El niño paga', base.childPays, E, 4) + numIn('px-cpct', '% de la tarifa adulto', base.childPricePct, { min: 0, max: 100, col: 4, E, hint: chdRate ? 'Hay tarifa Niño vigente (' + esc(chdRate.id) + ' · ' + money(chdRate.price, chdRate.currency) + '): el motor usa esa tarifa y este % queda de respaldo.' : 'Sin tarifa Niño vigente: el motor aplica este %.' }) + numIn('px-cmaxad', 'Máx. niños por adulto', base.maxChildrenPerAdult, { min: 0, max: 10, col: 4, E }) : '<div class="c12">' + ruleNote('R-CHILD-PER-ADULT', p) + '<div class="xs faint">Sin límite de niños por adulto; los niños pagan el 100 % (o la tarifa Niño si existe).</div></div>') +
        '<div class="section-title">Infantes ' + ruleTag('R-INFANT-FREE') + '</div>' +
        (infOn ? swIn('px-iallow', 'Se admiten infantes', base.infantAllowed !== false, E, 4) + swIn('px-ipays', 'El infante paga (apagado = no paga)', !!base.infantPays, E, 4) + numIn('px-imaxad', 'Máx. infantes por adulto', base.maxInfantsPerAdult, { min: 0, max: 5, col: 4, E }) : '<div class="c12">' + ruleNote('R-INFANT-FREE', p) + '<div class="xs faint">Los infantes pagan como niño y sin límite por adulto.</div></div>') +
        '<div class="section-title">Adulto responsable ' + ruleTag('R-MIN-ADULTS') + '</div>' +
        (minOn ? numIn('px-minad', 'Mínimo de adultos por reserva', base.minAdults, { min: 0, max: 10, col: 4, E }) : '<div class="c12">' + ruleNote('R-MIN-ADULTS', p) + '</div>') +
        '<div class="c8 small muted" style="align-self:end">' + (BE.on('R-MAX-PAX', p) ? 'Máximo por reserva: <b>' + (p.maxPax || '—') + ' pax</b> (ficha del producto, ' + ruleTag('R-MAX-PAX') + ').' : ruleTag('R-MAX-PAX') + ' desactivada.') + '</div>' +
        '<div class="field c12"><label for="px-note">Nota para el cliente</label><textarea class="input" id="px-note" rows="2"' + dsab(E) + '>' + esc(base.note || '') + '</textarea></div>' +
        '</div>' + (E ? '<button class="btn primary" id="px-save" style="margin-top:12px">' + ic('check') + 'Guardar reglas de pasajeros</button>' : '')) +
      '</div><div class="stack">' +
      UI.card('Simulador de grupo', '<div class="bk-mini">' + numIn('sm-adt', 'Adultos', st.adt, { min: 0, max: 30, col: 12 }).replace('field c12', 'field') + numIn('sm-chd', 'Niños', st.chd, { min: 0, max: 30, col: 12 }).replace('field c12', 'field') + numIn('sm-inf', 'Infantes', st.inf, { min: 0, max: 30, col: 12 }).replace('field c12', 'field') + '</div><div id="sm-out" style="margin-top:12px"></div>' +
        '<div class="divider" style="margin:12px 0"></div><div class="row" style="gap:8px;align-items:flex-end">' + numIn('sm-age', 'Clasificar edad', st.age, { min: 0, max: 99, col: 12 }).replace('field c12', 'field" style="width:120px') + '<div id="sm-age-out" class="small" style="padding-bottom:9px"></div></div>',
        { sub: 'Respuesta de BE.validatePax y BE.quote con la configuración guardada' }) +
      '</div></div>';
    const sim = () => {
      st.adt = +val(x, 'sm-adt') || 0; st.chd = +val(x, 'sm-chd') || 0; st.inf = +val(x, 'sm-inf') || 0; st.age = val(x, 'sm-age');
      const pax = { adt: st.adt, chd: st.chd, inf: st.inf }; const v = BE.validatePax(p, pax); const cur = rateCur(p);
      const q = BE.quote(p, { date: BE.nextAvailable(p, v.seats || 1), pax, currency: cur });
      x.querySelector('#sm-out').innerHTML = (v.ok ? UI.alert('ok', '<b>Grupo válido</b> · ocupa ' + v.seats + ' asiento(s).') : UI.alert('bad', '<b>No se puede reservar:</b><ul class="list-plain">' + v.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>')) +
        q.lines.filter(l => l.kind === 'base').map(l => '<div class="stat-line"><span>' + esc(l.label) + ' × ' + l.qty + '</span><span class="num">' + BE.fmt(l.amount, cur) + '</span></div>').join('') +
        (q.lines.some(l => l.kind === 'base') ? '<div class="stat-line total"><span>Tour (sin adicionales ni alojamiento)</span><span class="num">' + BE.fmt(q.lines.filter(l => l.kind === 'base').reduce((a, l) => a + l.amount, 0), cur) + '</span></div>' : '');
      const t = st.age === '' ? null : BE.ageType(p, st.age);
      x.querySelector('#sm-age-out').innerHTML = t ? (st.age + ' años → <b>' + PAX_T[t] + '</b>' + (t === 'NA' ? ' <span class="bad">(edad fuera de las bandas)</span>' : '')) : '';
    };
    ['sm-adt', 'sm-chd', 'sm-inf', 'sm-age'].forEach(id => { x.querySelector('#' + id).oninput = sim; }); sim();
    const sv = x.querySelector('#px-save'); if (sv) sv.onclick = guard(PERM.update, () => {
      const n = (id, dflt) => { const v = nval(x, id); return v == null ? dflt : v; };
      const r = Object.assign({}, base, { adultMinAge: n('px-adt'), childMinAge: n('px-cmin'), childMaxAge: n('px-cmax'), infantMaxAge: n('px-imax'), note: val(x, 'px-note') });
      if (chdOn) Object.assign(r, { childPays: val(x, 'px-cpays'), childPricePct: n('px-cpct'), maxChildrenPerAdult: n('px-cmaxad') });
      if (infOn) Object.assign(r, { infantAllowed: val(x, 'px-iallow'), infantPays: val(x, 'px-ipays'), maxInfantsPerAdult: n('px-imaxad') });
      if (minOn) r.minAdults = n('px-minad');
      const ints = ['adultMinAge', 'childMinAge', 'childMaxAge', 'infantMaxAge', 'maxChildrenPerAdult', 'maxInfantsPerAdult', 'minAdults'];
      if (ints.some(k => r[k] == null || !Number.isInteger(r[k]) || r[k] < 0)) { UI.toast('Edades y límites deben ser números enteros ≥ 0.', 'bad'); return; }
      if (!(r.infantMaxAge < r.childMinAge && r.childMinAge <= r.childMaxAge && r.childMaxAge < r.adultMinAge)) { UI.toast('Bandas inconsistentes: se requiere infante hasta < niño desde ≤ niño hasta < adulto desde (CAT-PX-01).', 'bad'); return; }
      if (r.childPricePct == null || r.childPricePct < 0 || r.childPricePct > 100) { UI.toast('El % de niño debe estar entre 0 y 100.', 'bad'); return; }
      if (r.maxChildrenPerAdult > 10 || r.maxInfantsPerAdult > 5 || r.minAdults > 10) { UI.toast('Límites fuera de rango (niños ≤ 10, infantes ≤ 5, adultos ≤ 10 por reserva).', 'bad'); return; }
      const gaps = []; if (r.childMinAge > r.infantMaxAge + 1) gaps.push((r.infantMaxAge + 1) + '–' + (r.childMinAge - 1)); if (r.adultMinAge > r.childMaxAge + 1) gaps.push((r.childMaxAge + 1) + '–' + (r.adultMinAge - 1));
      const fmt = (z) => 'ADT ' + z.adultMinAge + '+ · CHD ' + z.childMinAge + '-' + z.childMaxAge + (z.childPays ? ' ' + z.childPricePct + '%' : ' gratis') + ' máx ' + z.maxChildrenPerAdult + ' · INF 0-' + z.infantMaxAge + (z.infantAllowed === false ? ' no admitido' : z.infantPays ? ' paga' : ' gratis') + ' máx ' + z.maxInfantsPerAdult + ' · min ADT ' + z.minAdults;
      const before = p.paxRules ? fmt(Object.assign({}, base)) : 'hereda tenant'; p.paxRules = r;
      if (p.minAge > r.infantMaxAge && r.infantAllowed !== false && p.minAge > 0) UI.toast('Atención: la ficha indica edad mínima ' + p.minAge + ' años; revise si admite infantes.', 'warn');
      touch(p, 'reglas_pasajeros', before, fmt(r)); UI.toast(gaps.length ? 'Guardado. Atención: edades ' + gaps.join(' y ') + ' años quedan sin clasificar y el motor las rechaza.' : 'Reglas de pasajeros guardadas.', gaps.length ? 'warn' : 'ok'); rerender();
    });
  }

  /* ---------------- 3. Adicionales (R-ADDONS) ---------------- */
  function bkAddons(x, p) {
    const E = can(PERM.rates); const rows = p.addons || [];
    const provN = (a) => a.serviceId ? svcLink(a.serviceId) + '<div class="xs faint">' + esc(Q.providerName((Q.service(a.serviceId) || {}).providerId || a.providerId)) + '</div>' : a.providerId ? provLink(a.providerId) : '<span class="faint">—</span>';
    x.innerHTML = readOnlyNote(PERM.rates) + UI.card('Adicionales del producto', rows.length ? tbl(['Adicional', 'Categoría', ['Precio', 'num'], 'Cobro', 'Aplica a', 'Stock / nota', 'Proveedor / servicio'].concat(E ? [''] : []), rows.map(a => '<tr><td><b>' + esc(a.name) + '</b><div class="xs faint mono">' + esc(a.id) + '</div></td><td>' + '<span class="tag">' + esc(a.category) + '</span></td><td class="num">' + BE.fmt(a.price, a.currency) + (a.currency !== 'PEN' ? '<div class="xs faint">≈ ' + BE.fmt(BE.convert(a.price, a.currency, 'PEN'), 'PEN') + '</div>' : '') + '</td><td class="small">' + (a.per === 'reserva' ? 'Por reserva' : 'Por pasajero') + '</td><td><div class="chip-row">' + (a.appliesTo || []).map(t => '<span class="tag mono">' + t + '</span>').join('') + '</div></td><td class="small">' + esc(a.stock || a.note || '—') + '</td><td class="small">' + provN(a) + '</td>' + (E ? '<td class="nowrap"><button class="btn xs" data-ad="' + esc(a.id) + '">' + ic('edit') + 'Editar</button> <button class="btn xs ghost icon" data-addel="' + esc(a.id) + '" title="Eliminar">' + ic('trash') + '</button></td>' : '') + '</tr>').join(''), 'compact') : UI.empty('Sin adicionales. Agregue entradas a museos, extensiones, comidas o seguros.', 'ticket'),
      { tight: true, sub: 'Opcionales que el cliente agrega en el sitio web, el widget o el cotizador; en la previsualización puede quitarlos (R-PREVIEW-REMOVE). Precios de venta referenciales.', actions: E ? '<button class="btn sm primary" id="ad-new">' + ic('plus') + 'Nuevo adicional</button>' : '' });
    const nb = x.querySelector('#ad-new'); if (nb) nb.onclick = guard(PERM.rates, () => addonModal(p, null));
    on(x, '[data-ad]', guard(PERM.rates, (b2) => addonModal(p, rows.find(a => a.id === b2.dataset.ad))));
    on(x, '[data-addel]', guard(PERM.rates, (b2) => { const a = rows.find(z => z.id === b2.dataset.addel); const used = (DB.reservations || []).filter(r => r.booking && (r.booking.addons || []).some(z => z.id === a.id)).length;
      UI.confirm({ title: 'Eliminar adicional', danger: true, confirmLabel: 'Eliminar', message: 'Se quitará <b>' + esc(a.name) + '</b> de la oferta del producto.' + (used ? ' Figura en ' + used + ' reserva(s): se conserva en su snapshot.' : ''), onConfirm: () => { p.addons = rows.filter(z => z !== a); touch(p, 'adicional_eliminar', a.id + ' ' + a.name, ''); UI.toast('Adicional eliminado.'); rerender(); } }); }));
  }
  function addonModal(p, a) {
    const curs = BE.currencies().map(c => [c.code, c.code + ' · ' + c.name]); if (a && !curs.some(c => c[0] === a.currency)) curs.push([a.currency, a.currency]);
    const at = a ? a.appliesTo || [] : ['ADT', 'CHD'];
    formModal({ title: a ? 'Editar adicional ' + a.id : 'Nuevo adicional', sub: esc(p.name), size: 'lg',
      fields: [
        { id: 'name', label: 'Nombre', required: true, value: a ? a.name : '', col: 8, placeholder: 'p. ej. Museo Larco (Lima)' },
        { id: 'category', label: 'Categoría', type: 'select', options: ADDON_CATS, value: a ? a.category : 'Museo', col: 4 },
        { id: 'price', label: 'Precio de venta', type: 'number', min: 0, step: '0.01', required: true, value: a ? a.price : '', col: 4 },
        { id: 'currency', label: 'Moneda', type: 'select', options: curs, value: a ? a.currency : 'PEN', col: 4 },
        { id: 'per', label: 'Cobro', type: 'select', options: [['pax', 'Por pasajero'], ['reserva', 'Por reserva']], value: a ? (a.per || 'pax') : 'pax', col: 4 },
        { type: 'html', col: 12, html: '<div class="field"><label>Aplica a <span class="req">*</span></label><div class="bk-wd">' + ['ADT', 'CHD', 'INF'].map(t => '<label class="check"><input type="checkbox" data-at="' + t + '"' + (at.includes(t) ? ' checked' : '') + '> ' + PAX_T[t] + ' (' + t + ')</label>').join('') + '</div></div>' },
        { id: 'stock', label: 'Stock / nota', value: a ? a.stock || a.note || '' : '', col: 12, placeholder: 'p. ej. Cupo limitado diario; se emite con documento' },
        selField('providerId', 'Proveedor (opcional)', DB.providers.map(v => ({ v: v.id, l: v.name + ' · ' + v.type + (provActive(v) ? '' : ' [inactivo]') })), a ? a.providerId || '' : '', { placeholder: 'Sin vínculo', col: 6 }),
        selField('serviceId', 'Servicio operativo (opcional)', DB.services.map(s => ({ v: s.id, l: s.name + ' · ' + Q.providerName(s.providerId) })), a ? a.serviceId || '' : '', { placeholder: 'Sin vínculo', col: 6, hint: 'Permite generar el servicio operativo al confirmar la reserva' })
      ],
      onSave: (f, m) => {
        const apt = [...m.querySelectorAll('[data-at]')].filter(c => c.checked).map(c => c.dataset.at);
        if (!apt.length) { UI.toast('Seleccione a qué pasajeros aplica.', 'bad'); return false; }
        if (f.price === '' || f.price < 0) { UI.toast('El precio debe ser ≥ 0.', 'bad'); return false; }
        if ((p.addons || []).some(z => z !== a && z.name.toLowerCase() === f.name.toLowerCase())) { UI.toast('Ya existe un adicional con ese nombre en el producto.', 'bad'); return false; }
        const svc = f.serviceId ? Q.service(f.serviceId) : null;
        if (svc && f.providerId && svc.providerId !== f.providerId) { UI.toast('El servicio elegido pertenece a ' + esc(Q.providerName(svc.providerId)) + ', no al proveedor seleccionado.', 'bad'); return false; }
        const o = { name: f.name, category: f.category, price: Math.round(f.price * 100) / 100, currency: f.currency, per: f.per, appliesTo: apt, optional: true, stock: f.stock, providerId: f.providerId || (svc ? svc.providerId : null) || null, serviceId: f.serviceId || null };
        const before = a ? a.name + ' ' + a.currency + ' ' + a.price + ' ' + (a.per || 'pax') : '';
        const tgt = a || { id: nextId('ADD-', allAddons(), 4) }; Object.assign(tgt, o); delete tgt.note; if (!a) { p.addons = p.addons || []; p.addons.push(tgt); }
        touch(p, a ? 'adicional_modificar' : 'adicional_crear', before, tgt.id + ' ' + tgt.name + ' ' + tgt.currency + ' ' + tgt.price + ' ' + tgt.per + ' [' + apt.join('/') + ']');
        UI.toast(a ? 'Adicional actualizado.' : 'Adicional ' + tgt.id + ' creado.'); rerender();
      } });
  }

  /* ---------------- 4. Alojamiento por ciudad (R-LODGING, R-LODGING-CAPACITY, R-SINGLE-SUPP) ---------------- */
  function bkLodging(x, p) {
    const E = can(PERM.rates); const ac = p.accommodation;
    if (!ac) {
      x.innerHTML = readOnlyNote(PERM.rates) + UI.card('Alojamiento por ciudad', UI.empty('Este producto no ofrece alojamiento. Actívelo para circuitos multi-ciudad (tramos con hoteles y tipos de habitación por ciudad).', 'bed') + (E ? '<div style="text-align:center;margin-top:8px"><button class="btn primary" id="lg-init">' + ic('plus') + 'Ofrecer alojamiento por ciudad</button></div>' : ''));
      const bi = x.querySelector('#lg-init'); if (bi) bi.onclick = guard(PERM.rates, () => { p.accommodation = { optional: true, currency: 'USD', note: '', legs: [] }; touch(p, 'alojamiento_activar', 'sin alojamiento', 'opcional · USD'); UI.toast('Alojamiento activado. Agregue los tramos por ciudad.'); rerender(); });
      return;
    }
    const legs = ac.legs || []; const cur = ac.currency || 'USD'; const nN = sum(legs, 'nights'); const exp = nightsExpected(p);
    /* Ejemplo con el motor: 2 adultos, habitación doble (o la de menor precio con capacidad ≥ 2) por ciudad */
    const pick = legs.map(l => { let best = null; l.hotels.forEach(h => h.rooms.filter(r => r.capacity >= 2).forEach(r => { if (!best || r.price < best.r.price) best = { h, r }; })); return best ? { legId: l.id, hotelId: best.h.id, rooms: [{ type: best.r.type, qty: 1 }] } : null; }).filter(Boolean);
    const q = pick.length ? BE.quote(p, { pax: { adt: 2 }, lodging: pick, currency: cur }) : null;
    const lodgeLines = q ? q.lines.filter(l => l.kind === 'lodging') : [];
    x.innerHTML = readOnlyNote(PERM.rates) + '<div class="grid g-2-1"><div class="stack">' +
      UI.card('Tramos del itinerario', legs.length ? legs.map((l, i) => '<div class="bk-leg"><div class="row between" style="gap:8px;flex-wrap:wrap"><div><span class="tag mono">' + esc(l.id) + '</span> <b>' + (i + 1) + '. ' + esc(l.city) + '</b> · ' + l.nights + ' noche' + (l.nights === 1 ? '' : 's') + (l.destId ? ' <span class="xs faint">' + esc(Q.destName(l.destId)) + '</span>' : '') + '</div>' +
        (E ? '<div class="row" style="gap:4px"><button class="btn xs ghost icon" data-lgup="' + i + '" title="Subir"' + (i ? '' : ' disabled') + '>' + ic('chevronLeft') + '</button><button class="btn xs ghost icon" data-lgdn="' + i + '" title="Bajar"' + (i < legs.length - 1 ? '' : ' disabled') + '>' + ic('chevronRight') + '</button><button class="btn xs" data-lged="' + i + '">' + ic('edit') + 'Tramo</button><button class="btn xs" data-htnew="' + i + '">' + ic('plus') + 'Hotel</button><button class="btn xs ghost icon" data-lgdel="' + i + '" title="Eliminar tramo">' + ic('trash') + '</button></div>' : '') + '</div>' +
        (l.hotels.length ? tbl(['Hotel', 'Categoría', 'Habitaciones (precio por noche)'].concat(E ? [''] : []), l.hotels.map((h, hi) => '<tr><td><b>' + esc(h.name) + '</b>' + (h.providerId ? '<div class="xs">' + provLink(h.providerId) + '</div>' : '') + '</td><td class="small nowrap">' + esc(h.category || '—') + '</td><td><div class="chip-row">' + h.rooms.map(r => '<span class="tag">' + esc(r.type) + ' · ' + r.capacity + ' pax · ' + BE.fmt(r.price, cur) + '</span>').join('') + '</div></td>' + (E ? '<td class="nowrap"><button class="btn xs" data-hted="' + i + '|' + hi + '">' + ic('edit') + '</button> <button class="btn xs ghost icon" data-htdel="' + i + '|' + hi + '" title="Quitar hotel">' + ic('trash') + '</button></td>' : '') + '</tr>').join(''), 'compact') : '<p class="small warn" style="margin-top:8px">Sin hoteles: el tramo no se puede vender con alojamiento.</p>') +
        '</div>').join('') : UI.empty('Sin tramos. Agregue la primera ciudad del itinerario.', 'route'),
        { actions: E ? '<button class="btn sm primary" id="lg-new">' + ic('plus') + 'Nuevo tramo</button>' : '' }) +
      '</div><div class="stack">' +
      UI.card('Resumen', '<div class="pv" style="font-family:var(--f-display);font-weight:600;font-size:1.15rem">' + esc(lodgingSummary(p)) + '</div>' +
        '<div class="small muted" style="margin-top:4px">' + legs.map(l => esc(l.city) + ' ' + l.nights + 'n').join(' → ') + '</div>' +
        (exp != null && legs.length ? (exp === nN ? '<div class="xs ok" style="margin-top:6px">Coincide con la duración del producto (' + p.durationValue + ' ' + esc(p.durationUnit) + ' → ' + exp + ' noches).</div>' : UI.alert('warn', 'El itinerario suma ' + nN + ' noches y la duración del producto (' + p.durationValue + ' ' + esc(p.durationUnit) + ') implica ' + exp + '. Revise los tramos (CAT-LG-02).')) : '') +
        '<div class="form-grid" style="margin-top:12px">' + swIn('lg-opt', 'Alojamiento opcional (el cliente puede reservar sin hotel)', ac.optional !== false, E, 12) +
        '<div class="field c12"><label for="lg-cur">Moneda de precios</label><select class="input" id="lg-cur"' + dsab(E) + '>' + BE.currencies().map(c => '<option value="' + c.code + '"' + (c.code === cur ? ' selected' : '') + '>' + c.code + ' · ' + esc(c.name) + '</option>').join('') + '</select></div>' +
        '<div class="field c12"><label for="lg-note">Nota para el cliente</label><textarea class="input" id="lg-note" rows="2"' + dsab(E) + '>' + esc(ac.note || '') + '</textarea></div></div>' +
        (E ? '<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn sm primary" id="lg-save">' + ic('check') + 'Guardar</button><button class="btn sm ghost" id="lg-off">' + ic('x') + 'Dejar de ofrecer</button></div>' : '')) +
      UI.card('Ejemplo calculado por el motor', q ? '<div class="xs faint" style="margin-bottom:6px">2 adultos · 1 habitación doble de menor precio por ciudad</div>' + lodgeLines.map(l => '<div class="stat-line"><span class="small">' + esc(l.label) + '</span><span class="num">' + BE.fmt(l.amount, cur) + '</span></div>').join('') + '<div class="stat-line total"><span>Alojamiento · ' + q.rooms + ' hab. · ' + q.nights + ' noches</span><span class="num">' + BE.fmt(lodgeLines.reduce((a, l) => a + l.amount, 0), cur) + '</span></div>' + (q.warnings.length ? '<div class="xs warn" style="margin-top:6px">' + q.warnings.map(esc).join('<br>') + '</div>' : '') + '<p class="xs faint" style="margin-top:6px">' + ruleTag('R-LODGING-CAPACITY') + (BE.on('R-LODGING-CAPACITY', p) ? ' valida camas suficientes (infantes comparten).' : ' desactivada.') + ' ' + ruleTag('R-SINGLE-SUPP') + (BE.on('R-SINGLE-SUPP', p) ? ' suplemento simple ' + BE.param('R-SINGLE-SUPP', 'pct', p) + ' %.' : ' desactivada.') + '</p>' : '<p class="small faint">Agregue hoteles con habitaciones de 2 o más plazas para ver el ejemplo.</p>') +
      '</div></div>';
    const save = (act, before, after) => { touch(p, act, before, after); rerender(); };
    const sv = x.querySelector('#lg-save'); if (sv) sv.onclick = guard(PERM.rates, () => { const before = (ac.optional !== false ? 'opcional' : 'incluido') + ' · ' + cur; ac.optional = val(x, 'lg-opt'); ac.currency = val(x, 'lg-cur'); ac.note = val(x, 'lg-note'); UI.toast('Alojamiento guardado.'); save('alojamiento_config', before, (ac.optional ? 'opcional' : 'incluido') + ' · ' + ac.currency); });
    const off = x.querySelector('#lg-off'); if (off) off.onclick = guard(PERM.rates, () => UI.confirm({ title: 'Dejar de ofrecer alojamiento', danger: true, confirmLabel: 'Quitar alojamiento', message: 'Se eliminarán ' + legs.length + ' tramo(s) y sus hoteles de la oferta. Las reservas existentes conservan su snapshot.', onConfirm: () => { const b0 = lodgingSummary(p); delete p.accommodation; UI.toast('Alojamiento retirado del producto.'); save('alojamiento_desactivar', b0, 'sin alojamiento'); } }));
    const nl = x.querySelector('#lg-new'); if (nl) nl.onclick = guard(PERM.rates, () => legModal(p, null));
    on(x, '[data-lged]', guard(PERM.rates, (b2) => legModal(p, legs[+b2.dataset.lged])));
    on(x, '[data-lgdel]', guard(PERM.rates, (b2) => { const l = legs[+b2.dataset.lgdel]; UI.confirm({ title: 'Eliminar tramo ' + l.city, danger: true, confirmLabel: 'Eliminar', message: 'Se eliminará el tramo y sus ' + l.hotels.length + ' hotel(es).', onConfirm: () => { ac.legs = legs.filter(z => z !== l); UI.toast('Tramo eliminado.'); save('tramo_eliminar', l.id + ' ' + l.city + ' ' + l.nights + 'n', ''); } }); }));
    const mv = (i, d) => { const a = legs.splice(i, 1)[0]; legs.splice(i + d, 0, a); save('tramo_reordenar', '', legs.map(l => l.city).join(' → ')); };
    on(x, '[data-lgup]', guard(PERM.rates, (b2) => mv(+b2.dataset.lgup, -1))); on(x, '[data-lgdn]', guard(PERM.rates, (b2) => mv(+b2.dataset.lgdn, 1)));
    on(x, '[data-htnew]', guard(PERM.rates, (b2) => hotelModal(p, legs[+b2.dataset.htnew], null)));
    on(x, '[data-hted]', guard(PERM.rates, (b2) => { const [i, hi] = b2.dataset.hted.split('|').map(Number); hotelModal(p, legs[i], legs[i].hotels[hi]); }));
    on(x, '[data-htdel]', guard(PERM.rates, (b2) => { const [i, hi] = b2.dataset.htdel.split('|').map(Number); const l = legs[i]; const h = l.hotels[hi]; UI.confirm({ title: 'Quitar hotel', danger: true, confirmLabel: 'Quitar', message: 'Se quitará <b>' + esc(h.name) + '</b> del tramo ' + esc(l.city) + '.', onConfirm: () => { l.hotels.splice(hi, 1); UI.toast('Hotel quitado.'); save('hotel_eliminar', l.id + ' ' + h.id + ' ' + h.name, ''); } }); }));
  }
  function legModal(p, l) {
    const ac = p.accommodation;
    formModal({ title: l ? 'Editar tramo ' + l.id : 'Nuevo tramo', sub: esc(p.name), size: 'sm',
      fields: [{ id: 'city', label: 'Ciudad', required: true, value: l ? l.city : '', col: 12, placeholder: 'p. ej. Arequipa' },
        selField('destId', 'Destino del catálogo', DB.destinations.filter(d => ['Ciudad', 'Departamento', 'Provincia', 'Zona', 'Lugar'].includes(d.type)).map(d => ({ v: d.id, l: d.name + ' (' + d.type + ')' })), l ? l.destId || '' : '', { placeholder: 'Sin vincular', col: 12 }),
        { id: 'nights', label: 'Noches', type: 'number', min: 1, max: 30, required: true, value: l ? l.nights : 1, col: 12 }],
      onSave: (f) => {
        if (!Number.isInteger(f.nights) || f.nights < 1 || f.nights > 30) { UI.toast('Las noches deben ser un entero entre 1 y 30.', 'bad'); return false; }
        if (ac.legs.some(z => z !== l && z.city.toLowerCase() === f.city.toLowerCase())) UI.toast('Ya existe un tramo en ' + esc(f.city) + ' (se permite para itinerarios que regresan a la misma ciudad).', 'warn');
        const before = l ? l.city + ' ' + l.nights + 'n' : '';
        const tgt = l || { id: nextId('LEG-', ac.legs, 0), hotels: [] }; Object.assign(tgt, { city: f.city, destId: f.destId || null, nights: f.nights }); if (!l) ac.legs.push(tgt);
        touch(p, l ? 'tramo_modificar' : 'tramo_crear', before, tgt.id + ' ' + tgt.city + ' ' + tgt.nights + 'n · total ' + lodgingSummary(p)); UI.toast(l ? 'Tramo actualizado.' : 'Tramo agregado.'); rerender();
      } });
  }
  function hotelModal(p, l, h) {
    const cur = p.accommodation.currency || 'USD';
    const types = ROOM_TYPES.slice(); (h ? h.rooms : []).forEach(r => { if (!types.some(t => t[0] === r.type)) types.push([r.type, r.capacity]); });
    const roomRows = types.map(([t, cap]) => { const r = h && h.rooms.find(z => z.type === t); return '<tr><td><label class="check"><input type="checkbox" data-rt="' + esc(t) + '"' + (r ? ' checked' : '') + '> ' + esc(t) + '</label></td><td><input class="input" type="number" min="1" max="8" data-rcap="' + esc(t) + '" value="' + (r ? r.capacity : cap) + '" style="width:80px"></td><td><input class="input" type="number" min="0" step="0.01" data-rpr="' + esc(t) + '" value="' + (r ? r.price : '') + '" placeholder="0.00" style="width:110px"></td></tr>'; }).join('');
    formModal({ title: h ? 'Editar hotel' : 'Nuevo hotel en ' + esc(l.city), sub: esc(p.name) + ' · tramo ' + esc(l.id), size: 'lg',
      fields: [{ id: 'name', label: 'Hotel', required: true, value: h ? h.name : '', col: 6 }, { id: 'category', label: 'Categoría', type: 'select', options: HOTEL_CATS.concat(h && h.category && !HOTEL_CATS.includes(h.category) ? [h.category] : []), value: h ? h.category : '3 estrellas', col: 3 },
        selField('providerId', 'Proveedor (opcional)', DB.providers.filter(v => v.type === 'Hotel').map(v => ({ v: v.id, l: v.name + (provActive(v) ? '' : ' [inactivo]') })), h ? h.providerId || '' : '', { placeholder: 'Sin contrato', col: 3 })],
      extra: '<div class="upper" style="margin:14px 0 6px">Tipos de habitación · precio por habitación y noche (' + esc(cur) + ')</div>' + tbl(['Tipo', 'Capacidad (pax)', 'Precio/noche'], roomRows, 'compact'),
      onSave: (f, m) => {
        const rooms = []; let bad = null;
        m.querySelectorAll('[data-rt]').forEach(c => { if (!c.checked) return; const t = c.dataset.rt; const cap = +m.querySelector('[data-rcap="' + t + '"]').value; const pr = m.querySelector('[data-rpr="' + t + '"]').value; if (!Number.isInteger(cap) || cap < 1 || cap > 8) bad = t + ': capacidad entre 1 y 8'; else if (pr === '' || +pr <= 0) bad = t + ': indique el precio por noche'; rooms.push({ type: t, capacity: cap, price: Math.round(+pr * 100) / 100 }); });
        if (bad) { UI.toast(bad + '.', 'bad'); return false; }
        if (!rooms.length) { UI.toast('Active al menos un tipo de habitación.', 'bad'); return false; }
        if (l.hotels.some(z => z !== h && z.name.toLowerCase() === f.name.toLowerCase())) { UI.toast('El hotel ya está en este tramo.', 'bad'); return false; }
        const before = h ? h.name + ' ' + h.rooms.map(r => r.type + ' ' + r.price).join(', ') : '';
        const pre = 'H-' + String(l.city).normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() + '-'; const used = new Set(p.accommodation.legs.flatMap(z => z.hotels.map(y => y.id))); let k = l.hotels.length + 1; while (used.has(pre + k)) k++;
        const tgt = h || { id: pre + k };
        Object.assign(tgt, { name: f.name, category: f.category, providerId: f.providerId || undefined, rooms }); if (!f.providerId) delete tgt.providerId; if (!h) l.hotels.push(tgt);
        touch(p, h ? 'hotel_modificar' : 'hotel_crear', before, l.id + ' ' + tgt.id + ' ' + tgt.name + ' · ' + rooms.map(r => r.type + ' ' + r.capacity + 'p ' + cur + ' ' + r.price).join(', '));
        UI.toast(h ? 'Hotel actualizado.' : 'Hotel agregado al tramo.'); rerender();
      } });
  }

  /* ---------------- 5. Pago (R-DEPOSIT, R-PAY-LATER) ---------------- */
  function bkPayment(x, p) {
    const E = can(PERM.rates); const pay = p.payment || {}; const modes = pay.modes || BE.cfg().paymentModes || ['total'];
    const depOn = BE.on('R-DEPOSIT', p); const plT = ruleState('R-PAY-LATER', p); const plRule = BE.rule('R-PAY-LATER');
    const nx = BE.nextAvailable(p, 2); const cur = rateCur(p);
    const prev = BE.quote(p, { date: nx, pax: { adt: 2 }, currency: cur }).modes.map(m => { const q = BE.quote(p, { date: nx, pax: { adt: 2 }, currency: cur, paymentMode: m }); return '<tr><td>' + esc(PAY_MODES[m]) + '</td><td class="num">' + BE.fmt(q.deposit, cur) + (m === 'adelanto' ? ' <span class="xs faint">(' + q.depositPct + ' %)</span>' : '') + '</td><td class="num">' + BE.fmt(q.balance, cur) + '</td><td class="nowrap small">' + (q.balanceDue ? date(q.balanceDue) : '—') + (q.holdHours ? '<div class="xs faint">cupo retenido ' + q.holdHours + ' h</div>' : '') + '</td></tr>'; }).join('');
    x.innerHTML = readOnlyNote(PERM.rates) + '<div class="grid g-2-1"><div class="stack">' +
      UI.card('Modalidades de pago', '<div class="stack" style="gap:10px">' +
        '<label class="check"><input type="checkbox" id="pm-total"' + (modes.includes('total') ? ' checked' : '') + dsab(E) + '> ' + PAY_MODES.total + '</label>' +
        (depOn ? '<label class="check"><input type="checkbox" id="pm-adel"' + (modes.includes('adelanto') ? ' checked' : '') + dsab(E) + '> ' + PAY_MODES.adelanto + ' ' + ruleTag('R-DEPOSIT') + '</label>' : '<div class="small faint">' + PAY_MODES.adelanto + ' — ' + ruleNote('R-DEPOSIT', p).replace(/<\/?div[^>]*>/g, '') + '</div>') +
        (plT === 'tenant_off' ? '<div class="small faint">' + PAY_MODES.pagar_despues + ' — ' + ruleTag('R-PAY-LATER') + ' desactivada para este tenant.' + rulesLink() + '</div>' :
          '<label class="check"><input type="checkbox" id="pm-later"' + (plT === 'on' ? ' checked' : '') + dsab(E && plRule && plRule.productOverride) + '> ' + PAY_MODES.pagar_despues + ' ' + ruleTag('R-PAY-LATER') + ' <span class="xs faint">(cupo retenido ' + BE.param('R-PAY-LATER', 'holdHours', p) + ' h; se controla con el override de la regla)</span></label>') +
        '</div>' +
        (depOn ? '<div class="form-grid" style="margin-top:14px">' + numIn('pm-pct', '% de adelanto', pay.depositPct != null ? pay.depositPct : BE.param('R-DEPOSIT', 'pct'), { min: 1, max: 99, col: 4, E, hint: 'Tenant: ' + BE.param('R-DEPOSIT', 'pct') + ' %' }) + numIn('pm-days', 'Saldo: días antes del viaje', pay.balanceDueDays != null ? pay.balanceDueDays : BE.param('R-DEPOSIT', 'balanceDueDays'), { min: 0, max: 180, col: 4, E, hint: 'Tenant: ' + BE.param('R-DEPOSIT', 'balanceDueDays') + ' días' }) + '</div>' : '') +
        '<div class="field" style="margin-top:12px"><label for="pm-note">Nota para el cliente</label><textarea class="input" id="pm-note" rows="2"' + dsab(E) + '>' + esc(pay.note || '') + '</textarea></div>' +
        (E ? '<button class="btn primary" id="pm-save" style="margin-top:12px">' + ic('check') + 'Guardar pago</button>' : '')) +
      '</div><div class="stack">' +
      UI.card('Vista previa del motor', nx ? '<div class="xs faint" style="margin-bottom:6px">2 adultos · salida ' + date(nx) + ' · tour sin adicionales</div>' + tbl(['Modalidad', ['Paga ahora', 'num'], ['Saldo', 'num'], 'Vence'], prev, 'compact') : '<p class="small faint">Sin fechas disponibles para simular.</p>', { sub: 'BE.quote → deposit, balance, balanceDue' }) +
      '</div></div>';
    const sv = x.querySelector('#pm-save'); if (sv) sv.onclick = guard(PERM.rates, () => {
      const m = []; if (val(x, 'pm-total')) m.push('total'); const adel = depOn ? val(x, 'pm-adel') : modes.includes('adelanto'); if (adel) m.push('adelanto');
      if (!m.length) { UI.toast('Seleccione pago total o adelanto (al menos una modalidad con cobro).', 'bad'); return; }
      const np = Object.assign({}, pay, { modes: m, note: val(x, 'pm-note') });
      if (depOn) { const pc = nval(x, 'pm-pct'), dd = nval(x, 'pm-days'); if (adel && (pc == null || pc < 1 || pc > 99)) { UI.toast('El % de adelanto debe estar entre 1 y 99.', 'bad'); return; } if (dd == null || !Number.isInteger(dd) || dd < 0 || dd > 180) { UI.toast('Los días para el saldo deben ser un entero entre 0 y 180.', 'bad'); return; } np.depositPct = pc; np.balanceDueDays = dd; }
      const before = (pay.modes || []).join('+') + ' ' + (pay.depositPct != null ? pay.depositPct + '%' : '') + ' ' + (pay.balanceDueDays != null ? pay.balanceDueDays + 'd' : '') + ' · pagar después ' + plT;
      p.payment = np;
      const lt = x.querySelector('#pm-later'); if (lt && !lt.disabled) { p.ruleOverrides = p.ruleOverrides || {}; if (lt.checked) delete p.ruleOverrides['R-PAY-LATER']; else p.ruleOverrides['R-PAY-LATER'] = false; }
      touch(p, 'politica_pago', before, m.join('+') + ' ' + (np.depositPct != null ? np.depositPct + '%' : '') + ' ' + (np.balanceDueDays != null ? np.balanceDueDays + 'd' : '') + ' · pagar después ' + ruleState('R-PAY-LATER', p));
      UI.toast('Política de pago guardada.'); rerender();
    });
  }

  /* ---------------- 6. Recojo y datos requeridos (R-PICKUP) ---------------- */
  function bkPickup(x, p) {
    const E = can(PERM.update) || can(PERM.avail); const pk = p.pickup || { required: false, askFlight: false, points: [] };
    const pts = (pk.points || []).slice();
    const draw = () => {
      x.innerHTML = (E ? '' : readOnlyNote(PERM.update)) + '<div class="grid g-2-1"><div class="stack">' +
        UI.card('Puntos de partida / recojo', (pts.length ? pts.map((t, i) => '<div class="bk-pt"><span class="xs faint mono" style="width:18px">' + (i + 1) + '</span><input class="input" data-pt="' + i + '" value="' + esc(t) + '"' + dsab(E) + '>' + (E ? '<button class="btn xs ghost icon" data-ptdel="' + i + '" title="Quitar">' + ic('x') + '</button>' : '') + '</div>').join('') : '<p class="small faint">Sin puntos configurados.</p>') +
          (E ? '<div class="bk-pt" style="margin-top:10px"><span style="width:18px"></span><input class="input" id="pt-new" placeholder="p. ej. Hotel en Miraflores o Barranco"><button class="btn sm" id="pt-add">' + ic('plus') + 'Agregar</button></div>' : ''),
          { sub: 'El cliente elige uno al reservar; si elige hotel, se pide la dirección.' }) +
        '</div><div class="stack">' +
        UI.card('Datos requeridos al cliente', '<div class="form-grid">' + swIn('pk-req', 'Punto de recojo obligatorio', pk.required, E, 12) + swIn('pk-fl', 'Pedir vuelo y hora de llegada', pk.askFlight, E, 12, 'Útil cuando un punto es el aeropuerto. Parámetro del tenant: ' + (BE.param('R-PICKUP', 'askFlight') ? 'pide vuelo' : 'no pide vuelo') + '.') + '</div>' +
          '<p class="xs faint" style="margin-top:10px">Comentarios del cliente: ' + ruleTag('R-COMMENTS') + (BE.on('R-COMMENTS', p) ? ' activa (máx. ' + BE.param('R-COMMENTS', 'maxChars', p) + ' caracteres)' : ' desactivada') + ' · Acompañantes: ' + ruleTag('R-COMPANIONS') + (BE.on('R-COMPANIONS', p) ? ' activa' : ' desactivada') + '.</p>' +
          (E ? '<button class="btn primary" id="pk-save" style="margin-top:12px">' + ic('check') + 'Guardar recojo</button>' : '')) +
        '</div></div>';
      x.querySelectorAll('[data-pt]').forEach(i => { i.oninput = () => { pts[+i.dataset.pt] = i.value; }; });
      on(x, '[data-ptdel]', (b2) => { pts.splice(+b2.dataset.ptdel, 1); draw(); });
      const add = x.querySelector('#pt-add'); if (add) add.onclick = () => { const v = x.querySelector('#pt-new').value.trim(); if (!v) { UI.toast('Escriba el punto de recojo.', 'bad'); return; } if (pts.some(z => z.toLowerCase() === v.toLowerCase())) { UI.toast('Ese punto ya existe.', 'bad'); return; } pts.push(v); draw(); UI.toast('Punto agregado; recuerde guardar.', 'info'); };
      const sv = x.querySelector('#pk-save'); if (sv) sv.onclick = () => {
        if (!E) { noPerm(PERM.update); return; }
        const clean = pts.map(z => String(z).trim()).filter(Boolean); const req = val(x, 'pk-req');
        if (req && !clean.length) { UI.toast('Con recojo obligatorio debe existir al menos un punto (R-PICKUP).', 'bad'); return; }
        const before = (pk.required ? 'obligatorio' : 'opcional') + (pk.askFlight ? ' + vuelo' : '') + ' · ' + (pk.points || []).length + ' puntos';
        p.pickup = { required: req, askFlight: val(x, 'pk-fl'), points: clean };
        touch(p, 'recojo', before, (req ? 'obligatorio' : 'opcional') + (p.pickup.askFlight ? ' + vuelo' : '') + ' · ' + clean.length + ' puntos: ' + clean.join(' | ')); UI.toast('Recojo guardado.'); rerender();
      };
    };
    draw();
  }

  /* ---------------- 7. Reglas del producto (overrides sobre el centro de reglas) ---------------- */
  const PARAM_SECTION = { 'R-AVAIL-RANGES': 'disponibilidad', 'R-CUTOFF': 'disponibilidad', 'R-WEEKDAYS': 'disponibilidad', 'R-MIN-ADULTS': 'pasajeros', 'R-CHILD-PER-ADULT': 'pasajeros', 'R-INFANT-FREE': 'pasajeros', 'R-LODGING': 'alojamiento', 'R-ADDONS': 'adicionales', 'R-DEPOSIT': 'pago', 'R-PICKUP': 'recojo' };
  const PARAM_L = { minPax: 'Mínimo pax', decisionDays: 'Decisión (días antes)', minAdults: 'Mín. adultos', adultMinAge: 'Adulto desde', childMinAge: 'Niño desde', childMaxAge: 'Niño hasta', maxChildrenPerAdult: 'Máx. niños/adulto', childPricePct: '% niño', infantMaxAge: 'Infante hasta', maxInfantsPerAdult: 'Máx. infantes/adulto', max: 'Máximo', when: 'Cuándo', daysBeforeIfLater: 'Días antes (si luego)', requireDocument: 'Documento obligatorio', minAltitude: 'Altitud mínima (m)', pct: '%', fromPax: 'Desde pax', days: 'Días', holdHours: 'Horas de retención', defaultHours: 'Horas por defecto', balanceDueDays: 'Saldo (días antes)', askFlight: 'Pedir vuelo', cardPct: '% tarjeta', maxChars: 'Máx. caracteres', minutes: 'Minutos' };
  function bkRules(x, p) {
    const E = can(PERM.update); const rs = BE.rules().filter(r => r.productOverride); const tenantOnly = BE.rules().filter(r => !r.productOverride);
    const groups = [...new Set(rs.map(r => r.group))];
    const stBadge = (r) => { const s = ruleState(r.id, p); return s === 'on' ? '<span class="badge b-ok">Activa en el producto</span>' : s === 'tenant_off' ? '<span class="badge b-mute">Inactiva en el tenant</span>' : '<span class="badge b-warn">Desactivada en el producto</span>'; };
    const paramUI = (r) => {
      const keys = Object.keys(r.params || {}); const own = (p.ruleParams || {})[r.id] || {};
      if (PARAM_SECTION[r.id]) return '<div class="bk-params xs faint">Parámetros propios en la sección <a href="javascript:void(0)" data-go="' + PARAM_SECTION[r.id] + '">' + esc(PARAM_SECTION[r.id]) + '</a>' + (keys.length ? ' · tenant: ' + keys.map(k => esc(PARAM_L[k] || k) + ' ' + esc(String(r.params[k]))).join(', ') : '') + '.</div>';
      if (r.id === 'R-MAX-PAX') return '<div class="bk-params xs faint">Se aplica el máximo de la ficha del producto (' + (p.maxPax || '—') + ' pax).</div>';
      if (!keys.length) return '';
      const off = r.enabled ? '' : ' disabled';
      return '<div class="bk-params">' + keys.map(k => { const tv = r.params[k]; const ov = own[k]; const idn = 'rp-' + r.id + '-' + k;
        if (typeof tv === 'boolean') return '<div class="field"><label for="' + idn + '">' + esc(PARAM_L[k] || k) + '</label><select class="input" id="' + idn + '" data-rp="' + r.id + '|' + k + '|b"' + dsab(E) + off + '><option value="">Tenant (' + (tv ? 'sí' : 'no') + ')</option><option value="1"' + (ov === true ? ' selected' : '') + '>Sí</option><option value="0"' + (ov === false ? ' selected' : '') + '>No</option></select></div>';
        if (typeof tv === 'number') return '<div class="field"><label for="' + idn + '">' + esc(PARAM_L[k] || k) + '</label><input class="input" type="number" step="any" id="' + idn + '" data-rp="' + r.id + '|' + k + '|n" value="' + (ov != null ? esc(ov) : '') + '" placeholder="Tenant: ' + esc(tv) + '"' + dsab(E) + off + '></div>';
        return '<div class="field"><label for="' + idn + '">' + esc(PARAM_L[k] || k) + '</label><input class="input" id="' + idn + '" data-rp="' + r.id + '|' + k + '|s" value="' + (ov != null ? esc(ov) : '') + '" placeholder="Tenant: ' + esc(tv) + '"' + dsab(E) + off + '></div>'; }).join('') +
        (E && r.enabled ? '<button class="btn sm" data-rps="' + r.id + '">' + ic('check') + 'Guardar parámetros</button>' : '') + '</div>';
    };
    x.innerHTML = readOnlyNote(PERM.update) + UI.card('Reglas aplicables a este producto', UI.alert('info', 'Solo se listan las reglas del centro que permiten ajuste por producto (<span class="mono">productOverride</span>). El producto puede <b>desactivarlas</b> o <b>cambiar parámetros</b> solo para sí mismo; no puede activar una regla apagada en el tenant.' + rulesLink()) +
      groups.map(g => '<div class="section-title" style="margin-top:14px">' + esc(g) + '</div>' + rs.filter(r => r.group === g).map(r => { const s = ruleState(r.id, p); const has = (p.ruleOverrides || {})[r.id] === false || (p.ruleParams || {})[r.id];
        return '<div class="bk-rule' + (r.enabled ? '' : ' bk-off') + '"><div style="min-width:0"><b>' + esc(r.name) + '</b> ' + ruleTag(r.id) + ' ' + stBadge(r) + '<div class="xs muted" style="margin-top:3px">' + esc(r.desc) + '</div>' + (r.enabled ? '' : '<div class="xs" style="margin-top:3px">Desactivada a nivel tenant.' + (Access.canRoute('admin/reglas') ? ' <a href="#/admin/reglas">Activar en Reglas de reserva</a>' : '') + '</div>') + '</div>' +
          '<div class="row" style="gap:8px">' + (r.enabled ? '<label class="switch" title="' + (E ? 'Activar o desactivar solo para este producto' : 'Requiere permiso ' + PERM.update) + '"><input type="checkbox" data-rov="' + r.id + '"' + (s === 'on' ? ' checked' : '') + dsab(E) + '> <span class="small">Aplicar</span></label>' : '') + (E && has ? '<button class="btn xs ghost" data-rreset="' + r.id + '" title="Quitar ajustes del producto">' + ic('refresh') + 'Restablecer</button>' : '') + '</div>' +
          paramUI(r) + '</div>'; }).join('')).join('') +
      (tenantOnly.length ? '<p class="xs faint" style="margin-top:14px">' + tenantOnly.length + ' regla(s) solo se configuran a nivel tenant: ' + tenantOnly.map(r => esc(r.name) + ' (' + (r.enabled ? 'activa' : 'inactiva') + ')').join(', ') + '.</p>' : ''),
      { sub: 'Estado efectivo = regla activa en el tenant y no desactivada por el producto (BE.on)' });
    on(x, '[data-go]', (b2) => { try { history.replaceState(null, '', '#/catalogo/productos/' + p.id + '/reservas/' + b2.dataset.go); } catch (e) { } rerender(); });
    x.querySelectorAll('[data-rov]').forEach(c => { c.onchange = guard(PERM.update, () => { const id = c.dataset.rov; const before = ruleState(id, p); p.ruleOverrides = p.ruleOverrides || {}; if (c.checked) delete p.ruleOverrides[id]; else p.ruleOverrides[id] = false; if (!Object.keys(p.ruleOverrides).length) delete p.ruleOverrides; touch(p, 'regla_producto', id + ': ' + before, id + ': ' + ruleState(id, p)); UI.toast(c.checked ? 'Regla ' + id + ' aplicada al producto.' : 'Regla ' + id + ' desactivada solo para este producto.'); rerender(); }); });
    on(x, '[data-rps]', guard(PERM.update, (b2) => { const id = b2.dataset.rps; const r = BE.rule(id); const o = {}; let bad = null;
      x.querySelectorAll('[data-rp^="' + id + '|"]').forEach(i => { const [, k, t] = i.dataset.rp.split('|'); const v = i.value.trim(); if (v === '') return; if (t === 'n') { const n = Number(v); if (!isFinite(n) || n < 0) { bad = (PARAM_L[k] || k) + ': número ≥ 0'; return; } if (/pct|Pct/.test(k) && n > 100) { bad = (PARAM_L[k] || k) + ': máximo 100'; return; } if (n !== r.params[k]) o[k] = n; } else if (t === 'b') { const b3 = v === '1'; if (b3 !== r.params[k]) o[k] = b3; } else if (v !== r.params[k]) o[k] = v; });
      if (bad) { UI.toast(bad + '.', 'bad'); return; }
      const before = JSON.stringify((p.ruleParams || {})[id] || {}); p.ruleParams = p.ruleParams || {}; if (Object.keys(o).length) p.ruleParams[id] = o; else delete p.ruleParams[id]; if (!Object.keys(p.ruleParams).length) delete p.ruleParams;
      touch(p, 'regla_parametros', id + ' ' + before, id + ' ' + JSON.stringify(o)); UI.toast(Object.keys(o).length ? 'Parámetros de ' + id + ' guardados para este producto.' : 'Sin diferencias: el producto usa los parámetros del tenant.'); rerender(); }));
    on(x, '[data-rreset]', guard(PERM.update, (b2) => { const id = b2.dataset.rreset; const before = ruleState(id, p) + ' ' + JSON.stringify((p.ruleParams || {})[id] || {}); if (p.ruleOverrides) { delete p.ruleOverrides[id]; if (!Object.keys(p.ruleOverrides).length) delete p.ruleOverrides; } if (p.ruleParams) { delete p.ruleParams[id]; if (!Object.keys(p.ruleParams).length) delete p.ruleParams; } touch(p, 'regla_restablecer', id + ' ' + before, id + ' usa tenant'); UI.toast('Regla ' + id + ' restablecida a la configuración del tenant.'); rerender(); }));
  }

  /* ==========================================================================
     SALIDAS Y DISPONIBILIDAD (PROC-020): Disponible → Hold → Confirmada → Liberada/Expirada/Consumida
     ========================================================================== */
  const SAL = { month: '2026-10' };
  const ds = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const depTone = (d) => d.status === 'cancelada' ? 'bad' : avail(d) === 0 ? 'sun' : d.sold / d.capacity >= 0.7 ? 'info' : '';

  function holdModal(depId, after) {
    const opts = allDeps().filter(x => x.d.date >= T()).sort((a, c) => (a.d.date + a.d.time).localeCompare(c.d.date + c.d.time)).map(({ d, p }) => ({ v: d.id, l: d.id + ' · ' + dateShort(d.date) + ' ' + d.time + ' · ' + p.name + ' · disp. ' + avail(d) + (d.status !== 'abierta' ? ' [' + UI.statusLabel(d.status) + ']' : avail(d) === 0 ? ' [sin cupo]' : '') + (p.status !== 'ACTIVE' ? ' [producto ' + UI.statusLabel(p.status) + ']' : ''), dis: d.status !== 'abierta' || avail(d) === 0 || p.status !== 'ACTIVE' }));
    formModal({ title: 'Solicitar hold de cupos', sub: 'Solicitud → capacidad → restricciones → hold → confirmar / liberar (PROC-020)', fields: [
        selField('depId', 'Salida', opts, depId, { required: true, placeholder: 'Seleccione', col: 12, hint: 'Salidas cerradas, completas o de productos no activos no son seleccionables.' }),
        { id: 'qty', label: 'Cupos', type: 'number', min: 1, required: true, value: 2, col: 4 }, { id: 'minutes', label: 'Vigencia del hold (min)', type: 'number', min: 5, value: DB.settings.holdMinutes || 30, col: 4 }, { id: 'ref', label: 'Referencia', required: true, col: 4, placeholder: 'COT-… / RES-… / WEB-…' },
        { id: 'notes', label: 'Observaciones', col: 12 }],
      onSave: (f) => { const x = findDep(f.depId); if (!x) return false; const a = avail(x.d);
        if (f.qty > a) { const alt = x.p.departures.filter(d => d.id !== x.d.id && d.date >= T() && d.status === 'abierta' && avail(d) >= f.qty).slice(0, 3); UI.toast('<b>Regla transversal 4 / PRD-BR-012:</b> cupo insuficiente en ' + x.d.id + ' (disponibles ' + a + ', solicitados ' + f.qty + '). ' + (alt.length ? 'Alternativas: ' + alt.map(d => d.id + ' (' + dateShort(d.date) + ', ' + avail(d) + ')').join(', ') + '.' : 'Sin salidas alternativas con cupo.'), 'bad'); return false; }
        const h = { id: nextId('HLD-', DB.catalogHolds, 4), depId: x.d.id, qty: f.qty, ref: f.ref, status: 'hold', createdAt: nowStr(), expiresAt: plusMin(nowStr(), f.minutes || 30), user: Auth.user.id, notes: f.notes };
        DB.catalogHolds.unshift(h); Audit.log('Disponibilidad', h.id, 'hold', 'disponible', x.d.id + ' · ' + h.qty + ' cupos · expira ' + h.expiresAt.split(' ')[1]); Store.save(); UI.toast('Hold ' + h.id + ' creado: ' + h.qty + ' cupos hasta las ' + h.expiresAt.split(' ')[1] + '.'); after ? after() : rerender(); } });
  }
  function sellModal(depId) {
    const x = findDep(depId);
    formModal({ title: 'Confirmar cupos · ' + depId, size: 'sm', sub: x.p.name + ' · ' + date(x.d.date) + ' ' + x.d.time, pre: UI.alert('info', 'Disponibles: <b>' + avail(x.d) + '</b> de ' + x.d.capacity + ' (vendidos ' + x.d.sold + ', en hold ' + held(x.d) + ').') + '<div style="height:10px"></div>', fields: [{ id: 'qty', label: 'Cupos a confirmar', type: 'number', min: 1, required: true, value: 1, col: 6 }, { id: 'ref', label: 'Reserva / pedido', required: true, col: 6 }],
      onSave: (f) => { if (x.p.status !== 'ACTIVE') { UI.toast('<b>PRD-BR-002:</b> el producto no está activo; no se pueden confirmar nuevas ventas.', 'bad'); return false; } if (x.d.status !== 'abierta' || f.qty > avail(x.d)) { UI.toast('<b>Regla transversal 4 / PRD-BR-012:</b> no se confirma sin disponibilidad. Disponibles: ' + avail(x.d) + '. Sobreventa bloqueada.', 'bad'); return false; }
        const h = { id: nextId('HLD-', DB.catalogHolds, 4), depId, qty: f.qty, ref: f.ref, status: 'confirmada', createdAt: nowStr(), expiresAt: nowStr(), user: Auth.user.id, notes: 'Confirmación directa' };
        DB.catalogHolds.unshift(h); x.d.sold += f.qty; if (x.d.sold >= x.d.capacity) x.d.status = 'completa';
        Audit.log('Disponibilidad', h.id, 'confirmar', 'disponible', depId + ' · ' + f.qty + ' cupos · ' + f.ref); Store.save(); UI.toast('Cupos confirmados. Vendidos ' + x.d.sold + '/' + x.d.capacity + '.'); rerender(); } });
  }
  function holdAction(h, act) {
    const x = findDep(h.depId); if (!x) return;
    if (act === 'confirmar') {
      if (h.status !== 'hold') return;
      if (h.expiresAt < nowStr()) { UI.toast('El hold ' + h.id + ' expiró a las ' + h.expiresAt.split(' ')[1] + '. Ejecute la expiración o solicite uno nuevo.', 'bad'); return; }
      if (x.p.status !== 'ACTIVE') { UI.toast('<b>PRD-BR-002:</b> producto no activo; no se puede confirmar.', 'bad'); return; }
      if (x.d.sold + h.qty > x.d.capacity) { UI.toast('<b>PRD-BR-012:</b> la confirmación excede la capacidad de la salida. Bloqueado.', 'bad'); return; }
      h.status = 'confirmada'; x.d.sold += h.qty; if (x.d.sold >= x.d.capacity) x.d.status = 'completa';
      Audit.log('Disponibilidad', h.id, 'confirmar', 'hold', 'confirmada · ' + h.depId + ' vendidos ' + x.d.sold + '/' + x.d.capacity);
      Notify.push('disponibilidad.confirmada', 'Portal', h.user, 'Cupos confirmados ' + h.id + ' (' + h.ref + ')');
      Store.save(); UI.toast('Hold confirmado.'); rerender(); return;
    }
    if (act === 'liberar') return UI.confirm({ title: 'Liberar ' + h.id, message: h.status === 'confirmada' ? 'Se devolverán ' + h.qty + ' cupos confirmados a la salida ' + h.depId + ' (cancelación).' : 'Se liberarán ' + h.qty + ' cupos retenidos.', reason: true, confirmLabel: 'Liberar', danger: true, onConfirm: (r) => { const before = h.status; if (before === 'confirmada') { x.d.sold = Math.max(0, x.d.sold - h.qty); if (x.d.status === 'completa') x.d.status = 'abierta'; } h.status = 'liberada'; Audit.log('Disponibilidad', h.id, 'liberar', before, 'liberada — ' + r); Store.save(); UI.toast('Cupos liberados.'); rerender(); } });
    if (act === 'consumir') { h.status = 'consumida'; Audit.log('Disponibilidad', h.id, 'consumir', 'confirmada', 'consumida · servicio ejecutado'); Store.save(); UI.toast('Cupos marcados como consumidos.'); rerender(); }
  }
  function runExpiry() {
    const now = nowStr(); const exp = DB.catalogHolds.filter(h => h.status === 'hold' && h.expiresAt < now);
    exp.forEach(h => { h.status = 'expirada'; Audit.log('Disponibilidad', h.id, 'expirar', 'hold', 'expirada (job)'); });
    const j = (DB.jobs || []).find(x => x.id === 'JOB-01'); if (j) { j.last = now; j.lastResult = exp.length + ' hold(s) expirado(s)'; }
    Store.save(); UI.toast(exp.length ? exp.length + ' hold(s) expirado(s) y cupos devueltos: ' + exp.map(h => h.id).join(', ') + '.' : 'No hay holds vencidos.', exp.length ? 'ok' : 'info'); rerender();
  }
  const holdBtns = (h) => { const E = can(PERM.avail); return (h.status === 'hold' ? '<button class="btn xs primary" data-hact="confirmar|' + h.id + '"' + (E ? '' : NP) + '>Confirmar</button> <button class="btn xs" data-hact="liberar|' + h.id + '"' + (E ? '' : NP) + '>Liberar</button>' : h.status === 'confirmada' ? '<button class="btn xs" data-hact="consumir|' + h.id + '"' + (E ? '' : NP) + '>Consumir</button> <button class="btn xs ghost" data-hact="liberar|' + h.id + '"' + (E ? '' : NP) + '>Liberar</button>' : '<span class="xs faint">—</span>'); };
  const bindHoldBtns = (root) => on(root, '[data-hact]', guard(PERM.avail, (x) => { const [a, id] = x.dataset.hact.split('|'); holdAction(DB.catalogHolds.find(h => h.id === id), a); }));

  function depDrawer(depId) {
    const x = findDep(depId); if (!x) return; const { d, p } = x; const hs = DB.catalogHolds.filter(h => h.depId === d.id); const E = can(PERM.avail);
    UI.drawer({ title: 'Salida ' + d.id, sub: esc(p.name) + ' · ' + date(d.date) + ' ' + d.time, body: '<div class="row" style="margin-bottom:12px">' + UI.badge(d.status) + (p.status !== 'ACTIVE' ? UI.badge(p.status) : '') + '</div>' + UI.dl([['Producto', prodLink(p.id)], ['Fecha y hora', date(d.date) + ' · ' + esc(d.time)], ['Capacidad', d.capacity], ['Vendidos', d.sold], ['En hold', held(d)], ['Disponibles', '<b>' + avail(d) + '</b>'], ['Guía', d.guideId ? esc(guideName(d.guideId)) : '<span class="warn">Sin asignar</span>'], ['Transporte', d.vehicleId ? esc(vehLabel(d.vehicleId)) : '—'], ['Proveedor', provLink(d.providerId || p.mainProviderId)], ['Punto de salida', esc(d.meeting)], ['Punto de retorno', esc(d.ret || '—')], ['Observaciones', esc(d.notes || '—')]]) +
      '<div style="margin:14px 0 6px">' + UI.progress(d.sold / d.capacity * 100, d.sold >= d.capacity ? 'sun' : '') + '</div><div class="upper" style="margin:16px 0 8px">Holds y confirmaciones</div>' + (hs.length ? hs.map(h => '<div class="li-row"><div><b class="mono small">' + h.id + '</b> · ' + h.qty + ' cupos · ' + esc(h.ref) + '<div class="xs faint">' + datetime(h.createdAt) + (h.status === 'hold' ? ' · expira ' + h.expiresAt.split(' ')[1] : '') + '</div></div><div class="row" style="gap:4px">' + UI.badge(h.status) + holdBtns(h) + '</div></div>').join('') : '<p class="small faint">Sin holds.</p>'),
      actions: [{ label: 'Ver producto', onClick: () => App.go('#/catalogo/productos/' + p.id + '/salidas') }].concat(E ? [{ label: 'Editar', onClick: guard(PERM.avail, () => { UI.closeDrawer(); depModal(p, d); }) }, { label: 'Confirmar cupos', onClick: guard(PERM.avail, () => { UI.closeDrawer(); sellModal(d.id); }) }, { label: 'Hold', cls: 'primary', onClick: guard(PERM.avail, () => { UI.closeDrawer(); holdModal(d.id); }) }] : []),
      onOpen: (dr) => { bindHoldBtns(dr); } });
  }

  App.register('catalogo/salidas', (el, params) => {
    ensure(); css();
    const deps = allDeps(); const fut = deps.filter(x => x.d.date >= T() && x.d.status !== 'cancelada');
    const cap = sum(fut, x => x.d.capacity), sold = sum(fut, x => x.d.sold), hl = sum(fut, x => held(x.d));
    const activeH = DB.catalogHolds.filter(h => h.status === 'hold'); const staleH = activeH.filter(h => h.expiresAt < nowStr());
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Salidas y disponibilidad', subtitle: 'Salidas programadas de todos los productos, cupos, holds y confirmaciones. No se confirma una venta sin disponibilidad (Regla transversal 4, PRD-BR-012).', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Salidas y disponibilidad']],
        actions: '<button class="btn" id="sl-exp"' + dis(PERM.avail) + '>' + ic('clock') + 'Expirar holds vencidos</button><button class="btn" id="sl-hold"' + dis(PERM.avail) + '>' + ic('lock') + 'Nuevo hold</button><button class="btn primary" id="sl-new"' + dis(PERM.avail) + '>' + ic('plus') + 'Nueva salida</button>' }) +
      readOnlyNote(PERM.avail) +
      (staleH.length ? UI.alert('warn', staleH.length + ' hold(s) superaron su tiempo de vigencia y siguen reteniendo cupos (' + staleH.map(h => h.id).join(', ') + '). El job JOB-01 los expira cada 5 minutos; puede ejecutarlo ahora.') : '') +
      '<div class="grid g5">' + UI.kpi({ label: 'Salidas futuras', value: fut.length, sub: new Set(fut.map(x => x.p.id)).size + ' productos', tone: 'accent', icon: 'calendar' }) + UI.kpi({ label: 'Capacidad', value: fmtN(cap, 0), sub: 'cupos programados', tone: 'info', icon: 'users' }) + UI.kpi({ label: 'Vendidos', value: fmtN(sold, 0), sub: fmtN(cap ? sold / cap * 100 : 0, 1) + '% de ocupación', tone: 'ok', icon: 'check' }) + UI.kpi({ label: 'En hold', value: fmtN(hl, 0), sub: activeH.length + ' hold(s) activos', tone: 'sun', icon: 'lock' }) + UI.kpi({ label: 'Disponibles', value: fmtN(sum(fut, x => avail(x.d)), 0), sub: fut.filter(x => avail(x.d) === 0).length + ' salidas sin cupo', tone: 'violet', icon: 'box' }) + '</div>' +
      '<div id="sl-tabs"></div></div>';
    const b1 = el.querySelector('#sl-new'); if (b1) b1.onclick = guard(PERM.avail, () => depModal(null, null));
    el.querySelector('#sl-hold').onclick = guard(PERM.avail, () => holdModal(''));
    el.querySelector('#sl-exp').onclick = guard(PERM.avail, runExpiry);
    UI.tabs(el.querySelector('#sl-tabs'), [
      { id: 'tabla', label: 'Programación', count: deps.length, render: (b) => {
        const rows = deps.map(({ d, p }) => Object.assign({}, d, { _p: p, _held: held(d), _avail: avail(d) }));
        UI.dataTable(b, { exportName: 'salidas', rows, defaultSort: 'date', pageSize: 15, onRow: (r) => depDrawer(r.id),
          filters: [{ key: '_pid', label: 'Producto', options: [...new Set(deps.map(x => x.p.id))].map(id => [id, Q.productName(id)]), match: (r, v) => r._p.id === v }, { key: 'status', label: 'Estado', options: ['abierta', 'completa', 'cerrada', 'cancelada'] }, { key: '_when', label: 'Periodo', options: [['fut', 'Futuras'], ['past', 'Pasadas']], match: (r, v) => v === 'fut' ? r.date >= T() : r.date < T() }],
          search: (r) => r.id + ' ' + r._p.name + ' ' + r.meeting,
          columns: cols([
            { key: 'id', label: 'Salida', render: r => '<div class="cell-main mono">' + r.id + '</div><div class="cell-sub"><a href="#/catalogo/productos/' + r._p.id + '/salidas">' + esc(r._p.name) + '</a></div>', csv: r => r.id + ' ' + r._p.name },
            { key: 'date', label: 'Fecha', render: r => '<span class="nowrap">' + date(r.date) + '</span> <span class="mono xs faint">' + esc(r.time) + '</span>', sortVal: r => r.date + r.time },
            { key: 'capacity', label: 'Cap.', align: 'num' }, { key: 'sold', label: 'Vendidos', align: 'num' }, { key: '_held', label: 'Hold', align: 'num' },
            { key: '_avail', label: 'Disp.', align: 'num', render: r => '<b class="' + (r._avail === 0 ? 'warn' : '') + '">' + r._avail + '</b>' },
            { key: 'occ', label: 'Ocupación', render: r => { const o = r.sold / r.capacity * 100; return '<div style="min-width:90px">' + UI.progress(o, o >= 100 ? 'sun' : o >= 70 ? 'ok' : '') + '<div class="xs faint">' + fmtN(o, 0) + '%</div></div>'; }, sortVal: r => r.sold / r.capacity, csv: r => fmtN(r.sold / r.capacity * 100, 0) + '%' },
            { key: 'status', label: 'Estado', render: r => UI.badge(r.status) },
            { key: 'guideId', label: 'Guía', render: r => r.guideId ? '<span class="small">' + esc(guideName(r.guideId)) + '</span>' : '<span class="small warn">Sin guía</span>', csv: r => guideName(r.guideId) || '' },
            { key: 'vehicleId', label: 'Transporte', render: r => '<span class="small">' + esc(vehLabel(r.vehicleId) || '—') + '</span>', csv: r => vehLabel(r.vehicleId) || '' },
            { key: 'acts', label: '', sort: false, hide: !can(PERM.avail), render: r => '<span class="nowrap"><button class="btn xs" data-shold="' + r.id + '"' + (r._avail > 0 && r.status === 'abierta' && r.date >= T() ? '' : ' disabled') + '>Hold</button> <button class="btn xs" data-ssell="' + r.id + '"' + (r.date >= T() ? '' : ' disabled') + '>Confirmar</button></span>', csv: () => '' }
          ]),
          afterDraw: (c) => { on(c, '[data-shold]', guard(PERM.avail, (x) => holdModal(x.dataset.shold))); on(c, '[data-ssell]', guard(PERM.avail, (x) => sellModal(x.dataset.ssell))); } });
      } },
      { id: 'calendario', label: 'Calendario', render: (b) => {
        const [y, m] = SAL.month.split('-').map(Number); const first = new Date(y, m - 1, 1); const off = (first.getDay() + 6) % 7; const start = new Date(y, m - 1, 1 - off); const dim = new Date(y, m, 0).getDate(); const cells = Math.ceil((off + dim) / 7) * 7;
        const byDate = {}; deps.forEach(x => { (byDate[x.d.date] = byDate[x.d.date] || []).push(x); });
        let g = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => '<div class="cal-h">' + d + '</div>').join('');
        for (let i = 0; i < cells; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const s = ds(d); const evs = (byDate[s] || []).sort((a, c) => a.d.time.localeCompare(c.d.time)); const capD = sum(evs, x => x.d.capacity), soldD = sum(evs, x => x.d.sold);
          g += '<div class="cal-d' + (d.getMonth() !== m - 1 ? ' out' : '') + (s === T() ? ' today' : '') + '"><div class="row between"><span class="dn">' + d.getDate() + '</span>' + (capD ? '<span class="xs faint num">' + soldD + '/' + capD + '</span>' : '') + '</div>' + evs.map(x => '<button class="cal-ev ' + depTone(x.d) + '" data-cdep="' + x.d.id + '" title="' + esc(x.p.name + ' · ' + x.d.time + ' · ' + x.d.sold + '/' + x.d.capacity + ' · disponibles ' + avail(x.d)) + '">' + esc(x.d.time) + ' ' + esc(x.p.name) + ' · ' + x.d.sold + '/' + x.d.capacity + '</button>').join('') + (capD ? UI.progress(soldD / capD * 100, soldD >= capD ? 'sun' : '') : '') + '</div>'; }
        b.innerHTML = UI.card('<span class="row" style="gap:8px"><button class="btn sm icon" id="cal-prev" aria-label="Mes anterior">' + ic('chevronLeft') + '</button><span style="text-transform:capitalize">' + MESES[m - 1] + ' ' + y + '</span><button class="btn sm icon" id="cal-next" aria-label="Mes siguiente">' + ic('chevronRight') + '</button></span>', '<div class="tbl-wrap"><div class="cal" style="min-width:720px">' + g + '</div></div><div class="legend" style="margin-top:10px"><span><i style="background:var(--accent-soft);border:1px solid var(--accent)"></i>Con cupos</span><span><i style="background:var(--info-soft);border:1px solid var(--info)"></i>Ocupación ≥ 70%</span><span><i style="background:var(--sun-soft);border:1px solid var(--sun)"></i>Sin disponibilidad</span><span><i style="background:var(--bad-soft);border:1px solid var(--bad)"></i>Cancelada</span></div>', { sub: 'Ocupación por día (vendidos / capacidad). Clic en una salida para ver holds y acciones.' });
        b.querySelector('#cal-prev').onclick = () => { const d = new Date(y, m - 2, 1); SAL.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); rerender(); };
        b.querySelector('#cal-next').onclick = () => { const d = new Date(y, m, 1); SAL.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); rerender(); };
        on(b, '[data-cdep]', (x) => depDrawer(x.dataset.cdep));
      } },
      { id: 'holds', label: 'Holds de disponibilidad', count: activeH.length, render: (b) => {
        b.innerHTML = UI.card('Máquina de estados de disponibilidad', UI.flow(['Disponible', 'Hold', 'Confirmada', 'Consumida'], 4) + '<p class="xs faint" style="margin-top:6px">Alternativos: <b>Liberada</b> (manual o por cancelación) y <b>Expirada</b> (job JOB-01 al vencer el tiempo del hold, ' + (DB.settings.holdMinutes || 30) + ' min por defecto). Un hold retiene cupos pero no los vende.</p>') + '<div style="height:16px"></div><div id="hl-t"></div>';
        UI.dataTable(b.querySelector('#hl-t'), { exportName: 'holds', rows: () => DB.catalogHolds, defaultSort: 'createdAt', defaultDir: -1, pageSize: 12,
          filters: [{ key: 'status', label: 'Estado', options: ['hold', 'confirmada', 'liberada', 'expirada', 'consumida'] }],
          columns: cols([
            { key: 'id', label: 'Hold', render: h => '<span class="mono">' + h.id + '</span>' },
            { key: 'depId', label: 'Salida', render: h => { const x = findDep(h.depId); return x ? '<div class="cell-main mono">' + h.depId + '</div><div class="cell-sub">' + esc(x.p.name) + ' · ' + dateShort(x.d.date) + ' ' + x.d.time + '</div>' : esc(h.depId); } },
            { key: 'qty', label: 'Cupos', align: 'num' }, { key: 'ref', label: 'Referencia', render: h => '<span class="mono small">' + esc(h.ref) + '</span>' },
            { key: 'createdAt', label: 'Creado', render: h => '<span class="nowrap small">' + datetime(h.createdAt) + '</span>' },
            { key: 'expiresAt', label: 'Expira', render: h => h.status === 'hold' ? '<span class="nowrap small ' + (h.expiresAt < nowStr() ? 'bad' : '') + '">' + datetime(h.expiresAt) + (h.expiresAt < nowStr() ? ' · vencido' : '') + '</span>' : '<span class="faint">—</span>' },
            { key: 'user', label: 'Usuario', render: h => '<span class="small">' + esc(Q.userName(h.user)) + '</span>' },
            { key: 'status', label: 'Estado', render: h => UI.badge(h.status) },
            { key: 'acts', label: '', sort: false, hide: !can(PERM.avail), render: holdBtns, csv: () => '' }
          ]), afterDraw: (c) => bindHoldBtns(c) });
      } }
    ], ['tabla', 'calendario', 'holds'].includes(params[0]) ? params[0] : 'tabla', { onChange: (t) => { try { history.replaceState(null, '', '#/catalogo/salidas' + (t === 'tabla' ? '' : '/' + t)); } catch (e) { } } });
  });

  /* ==========================================================================
     TARIFAS, TEMPORADAS Y REGLAS DE PRICING (PROC-017, PROC-018, PROC-019)
     ========================================================================== */
  const seasonCls = (t) => ({ Alta: 't-Alta', Media: 't-Media', Feriado: 't-Feriado', 'Fecha especial': 't-esp', Personalizada: 't-esp' }[t] || '');
  function seasonModal(s) {
    formModal({ title: s ? 'Editar temporada ' + s.id : 'Nueva temporada', sub: 'Crear → rango → prioridad → asociar reglas → validar solapamientos → activar (PROC-019)', fields: [
        { id: 'name', label: 'Nombre', required: true, value: s ? s.name : '', col: 8 }, { id: 'type', label: 'Tipo', type: 'select', options: SEASON_TYPES, value: s ? s.type : 'Alta', col: 4 },
        { id: 'from', label: 'Desde', type: 'date', required: true, value: s ? s.from : '', col: 3 }, { id: 'to', label: 'Hasta', type: 'date', required: true, value: s ? s.to : '', col: 3 },
        { id: 'priority', label: 'Prioridad', type: 'number', min: 0, required: true, value: s ? s.priority : 2, col: 2, hint: '0 = máxima' }, { id: 'factor', label: 'Factor tarifa', type: 'number', step: '0.01', required: true, value: s ? s.factor : 1, col: 2 },
        { id: 'status', label: 'Estado', type: 'select', options: [['activa', 'Activa'], ['inactiva', 'Inactiva']], value: s ? s.status : 'activa', col: 2 }],
      onSave: (f) => {
        if (f.to < f.from) { UI.toast('La fecha final debe ser posterior a la inicial.', 'bad'); return false; }
        if (!(f.factor > 0) || f.factor > 3) { UI.toast('El factor debe estar entre 0.01 y 3.00.', 'bad'); return false; }
        const cand = Object.assign({}, f); const over = f.status === 'activa' ? DB.seasons.filter(x => x.id !== (s && s.id) && x.status === 'activa' && x.from <= f.to && f.from <= x.to) : [];
        const same = over.filter(x => x.priority === f.priority);
        if (same.length) { UI.toast('<b>PROC-019 · solapamiento no resoluble:</b> se cruza con "' + esc(same[0].name) + '" (' + dateShort(same[0].from) + ' → ' + dateShort(same[0].to) + ') con la misma prioridad ' + f.priority + '. Cambie la prioridad o ajuste el rango.', 'bad'); return false; }
        const before = s ? s.from + '→' + s.to + ' p' + s.priority + ' ×' + s.factor : '';
        const o = s || { id: nextId('TMP-', DB.seasons, 2) }; Object.assign(o, cand); if (!s) DB.seasons.push(o);
        Audit.log('Temporada', o.id, s ? 'modificar' : 'crear', before, o.from + '→' + o.to + ' p' + o.priority + ' ×' + o.factor + ' ' + o.status);
        Store.save();
        if (over.length) UI.toast('Temporada guardada. Solapa con ' + over.map(x => '"' + esc(x.name) + '" (p' + x.priority + ')').join(', ') + ': en las fechas comunes prevalece la de menor número de prioridad.', 'warn'); else UI.toast('Temporada guardada sin solapamientos.');
        rerender();
      } });
  }

  App.register('catalogo/tarifas', (el, params) => {
    ensure(); css();
    const all = DB.products.flatMap(p => p.rates.filter(visRate).map(r => Object.assign({}, r, { _p: p, _st: rateState(r) })));
    const C = SEE.cost(), M = SEE.margin(), PR = SEE.margin() || can(PERM.rates);
    const vig = all.filter(r => r._st === 'vigente'); const venc = all.filter(r => r._st === 'vencida');
    const noRate = DB.products.filter(p => !['ARCHIVED'].includes(p.status) && !p.rates.some(r => rateState(r) === 'vigente'));
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Tarifas y temporadas', subtitle: SEE.net() ? 'Tarifas consolidadas de todos los productos, temporadas con validación de solapamientos y reglas del motor de precios. El precio final siempre lo calcula el backend (PRD-BR-010).' : 'Tarifas de venta vigentes por producto, segmento y canal, y calendario de temporadas. Consulta en solo lectura: costos netos, tarifas B2B y márgenes no se muestran para su rol.', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Tarifas y temporadas']] }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Tarifas vigentes', value: vig.length, sub: 'de ' + all.length + ' registradas', tone: 'ok', icon: 'tag' }) + UI.kpi({ label: 'Tarifas vencidas', value: venc.length, sub: 'No seleccionables (PRD-BR-005)', tone: 'bad', icon: 'clock' }) + (M ? UI.kpi({ label: 'Margen promedio vigente', value: pct(vig.length ? sum(vig, r => marginOf(r)) / vig.length : 0), tone: 'violet', icon: 'percent' }) : UI.kpi({ label: 'Temporadas activas', value: DB.seasons.filter(x => x.status === 'activa').length, sub: 'de ' + DB.seasons.length + ' configuradas', tone: 'violet', icon: 'calendar' })) + UI.kpi({ label: 'Productos sin tarifa vigente', value: noRate.length, sub: noRate.map(p => p.id).join(', ') || '—', tone: 'sun', icon: 'alert' }) + '</div>' +
      '<div id="tf-tabs"></div></div>';
    UI.tabs(el.querySelector('#tf-tabs'), [
      { id: 'tarifas', label: 'Tarifas consolidadas', count: all.length, render: (b) => UI.dataTable(b, { exportName: 'tarifas', rows: all, defaultSort: '_pn', pageSize: 15, onRow: (r) => App.go('#/catalogo/productos/' + r._p.id + '/tarifas'),
        search: (r) => r.id + ' ' + r._p.name + ' ' + r.type + ' ' + r.channel,
        filters: [{ key: 'type', label: 'Tipo', options: RATE_TYPES.filter(t => all.some(r => r.type === t)).map(t => [t, t]) }, { key: 'channel', label: 'Canal', options: [...new Set(all.map(r => r.channel))].map(t => [t, t]) }, { key: '_st', label: 'Estado', options: [['vigente', 'Vigente'], ['vencida', 'Vencida'], ['inactiva', 'Inactiva'], ['programada', 'Programada']] }, { key: 'currency', label: 'Moneda', options: [['PEN', 'PEN'], ['USD', 'USD']] }],
        columns: cols([
          { key: '_pn', label: 'Producto', render: r => '<div class="cell-main">' + esc(r._p.name) + '</div><div class="cell-sub">' + UI.badge(r._p.status) + '</div>', sortVal: r => r._p.name, csv: r => r._p.id + ' ' + r._p.name },
          { key: 'id', label: 'Tarifa', render: r => '<span class="mono">' + r.id + '</span>' }, { key: 'type', label: 'Tipo' }, { key: 'segment', label: 'Segmento' }, { key: 'channel', label: 'Canal' }, { key: 'currency', label: 'Moneda' },
          { key: 'cost', label: 'Costo', align: 'num', hide: !C, render: r => fmtN(r.cost) }, { key: 'price', label: 'Venta', align: 'num', render: r => '<b>' + fmtN(r.price) + '</b>' },
          { key: 'margin', label: 'Margen', align: 'num', hide: !M, render: r => pct(marginOf(r)), sortVal: r => marginOf(r), csv: r => fmtN(marginOf(r), 1) },
          { key: 'validTo', label: 'Vigencia', render: r => '<span class="nowrap small">' + dateShort(r.validFrom) + ' → ' + date(r.validTo) + '</span>', csv: r => r.validFrom + ' / ' + r.validTo },
          { key: 'season', label: 'Temporada', render: r => '<span class="small">' + esc((Q.season(r.season) || {}).name || '—') + '</span>', csv: r => (Q.season(r.season) || {}).name || '' },
          { key: '_st', label: 'Estado', render: r => rateBadge(r) }
        ]) }) },
      { id: 'temporadas', label: 'Temporadas', count: DB.seasons.length, render: (b) => {
        const S = new Date(2026, 0, 1), E = new Date(2027, 3, 1); const span = (E - S) / 86400000;
        const pos = (s) => Math.max(0, Math.min(100, (parseD(s) - S) / 86400000 / span * 100));
        const months = []; for (let i = 0; i < 15; i++) { const d = new Date(2026, i, 1); months.push({ l: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'][d.getMonth()] + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''), x: (d - S) / 86400000 / span * 100 }); }
        const ss = DB.seasons.slice().sort((a, c) => a.from.localeCompare(c.from));
        const pairs = []; ss.forEach((a, i) => ss.slice(i + 1).forEach(c => { if (a.status === 'activa' && c.status === 'activa' && a.from <= c.to && c.from <= a.to) pairs.push([a, c]); }));
        const grid = months.map(mo => '<span class="stl-grid" style="left:' + mo.x.toFixed(2) + '%"></span>').join('');
        const tl = '<div class="stl"><div class="stl-row"><span></span><div class="stl-months">' + months.map(mo => '<span style="left:' + mo.x.toFixed(2) + '%">' + mo.l + '</span>').join('') + '</div></div>' + ss.map(s => '<div class="stl-row"><div class="stl-name" title="' + esc(s.name) + '"><b>' + esc(s.name) + '</b><div class="xs faint">' + esc(s.type) + ' · p' + s.priority + '</div></div><div class="stl-track">' + grid + '<span class="stl-today" style="left:' + pos(T()).toFixed(2) + '%" title="Hoy"></span><span class="stl-bar ' + seasonCls(s.type) + (s.status !== 'activa' ? ' off' : '') + '" style="left:' + pos(s.from).toFixed(2) + '%;width:' + Math.max(0.6, pos(addDays(s.to, 1)) - pos(s.from)).toFixed(2) + '%" title="' + esc(s.name + ': ' + date(s.from) + ' → ' + date(s.to) + ' · ×' + s.factor) + '">×' + fmtN(s.factor, 2) + '</span></div></div>').join('') + '</div>';
        b.innerHTML = UI.card('Línea de tiempo de temporadas', '<div class="tbl-wrap"><div style="min-width:560px">' + tl + '</div></div><div class="legend" style="margin-top:10px"><span><i style="background:var(--sun)"></i>Alta</span><span><i style="background:var(--info)"></i>Media</span><span><i style="background:var(--accent)"></i>Baja</span><span><i style="background:var(--bad)"></i>Feriado</span><span><i style="background:var(--violet)"></i>Fecha especial / personalizada</span><span><i style="background:var(--bad);width:2px"></i>Hoy</span></div>', { sub: 'Enero 2026 – marzo 2027', actions: '<button class="btn sm primary" id="ss-new"' + dis(PERM.rates) + '>' + ic('plus') + 'Nueva temporada</button>' }) +
          '<div style="margin-top:16px"></div>' +
          UI.card('Temporadas', tbl(['ID', 'Nombre', 'Tipo', 'Rango', ['Prior.', 'num'], ['Factor', 'num'], ['Tarifas', 'num'], 'Estado'].concat(can(PERM.rates) ? [''] : []), ss.map(s => { const n = DB.products.reduce((a, p) => a + p.rates.filter(r => r.season === s.id).length + (p.seasons.includes(s.id) ? 1 : 0), 0); return '<tr><td class="mono">' + s.id + '</td><td class="cell-main">' + esc(s.name) + '</td><td>' + esc(s.type) + '</td><td class="nowrap small">' + dateShort(s.from) + ' → ' + date(s.to) + '</td><td class="num">' + s.priority + '</td><td class="num">×' + fmtN(s.factor, 2) + '</td><td class="num">' + n + '</td><td>' + UI.badge(s.status) + '</td>' + (can(PERM.rates) ? '<td class="nowrap"><button class="btn xs ghost icon" data-sed="' + s.id + '" title="Editar">' + ic('edit') + '</button><button class="btn xs ghost icon" data-sdel="' + s.id + '" title="Eliminar">' + ic('trash') + '</button></td>' : '') + '</tr>'; }).join(''), 'compact'), { tight: true }) +
          '<div class="grid g2" style="margin-top:16px">' + UI.card('Solapamientos detectados', pairs.length ? tbl(['Temporadas', 'Periodo común', 'Prevalece'], pairs.map(([a, c]) => { const w = a.priority === c.priority ? null : a.priority < c.priority ? a : c; return '<tr><td class="small">' + esc(a.name) + ' (p' + a.priority + ')<br>' + esc(c.name) + ' (p' + c.priority + ')</td><td class="small nowrap">' + dateShort(a.from > c.from ? a.from : c.from) + ' → ' + dateShort(a.to < c.to ? a.to : c.to) + '</td><td class="small">' + (w ? '<b>' + esc(w.name) + '</b>' : '<span class="bad">Conflicto: misma prioridad</span>') + '</td></tr>'; }).join(''), 'compact') : '<p class="small faint" style="padding:14px 16px">Sin solapamientos entre temporadas activas.</p>', { tight: true, sub: 'Se permiten solapamientos solo con prioridad distinta' }) +
          UI.card('Resolver temporada por fecha', '<div class="row"><input class="input" type="date" id="ss-date" value="' + T() + '" style="max-width:180px"><div id="ss-res" class="small grow"></div></div>') + '</div>';
        const res = () => { const d = b.querySelector('#ss-date').value; const s = Pricing.seasonFor(d); const cands = DB.seasons.filter(x => x.status === 'activa' && d >= x.from && d <= x.to); b.querySelector('#ss-res').innerHTML = s ? 'Aplica <b>' + esc(s.name) + '</b> (×' + fmtN(s.factor, 2) + ', prioridad ' + s.priority + ')' + (cands.length > 1 ? '<div class="xs faint">También vigentes: ' + cands.filter(x => x !== s).map(x => esc(x.name)).join(', ') + '</div>' : '') : '<span class="warn">Sin temporada activa para la fecha: se aplica la tarifa base.</span>'; };
        b.querySelector('#ss-date').onchange = res; res();
        const nb = b.querySelector('#ss-new'); if (nb) nb.onclick = guard(PERM.rates, () => seasonModal(null));
        on(b, '[data-sed]', guard(PERM.rates, (x) => seasonModal(Q.season(x.dataset.sed))));
        on(b, '[data-sdel]', guard(PERM.rates, (x) => { const s = Q.season(x.dataset.sdel); const used = DB.products.filter(p => p.rates.some(r => r.season === s.id) || p.seasons.includes(s.id)); if (used.length) { UI.modal({ title: 'No se puede eliminar', size: 'sm', body: UI.alert('bad', 'La temporada <b>' + esc(s.name) + '</b> está asociada a ' + used.length + ' producto(s)/tarifa(s): ' + used.map(p => p.id).join(', ') + '. El historial no se destruye (Regla transversal 24). Puede inactivarla.'), actions: [{ label: 'Cerrar' }].concat(s.status === 'activa' ? [{ label: 'Inactivar', cls: 'primary', onClick: () => { s.status = 'inactiva'; Audit.log('Temporada', s.id, 'cambio_estado', 'activa', 'inactiva'); Store.save(); UI.toast('Temporada inactivada.'); rerender(); } }] : []) }); return; } UI.confirm({ title: 'Eliminar temporada', message: '¿Eliminar <b>' + esc(s.name) + '</b>? No tiene tarifas asociadas.', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { DB.seasons.splice(DB.seasons.indexOf(s), 1); Audit.log('Temporada', s.id, 'eliminar', s.name, ''); Store.save(); UI.toast('Temporada eliminada.'); rerender(); } }); }));
      } },
      PR && { id: 'reglas', label: 'Reglas de pricing', count: DB.pricingRules.length, render: (b) => pricingTab(b) }
    ].filter(Boolean), ['tarifas', 'temporadas'].concat(PR ? ['reglas'] : []).includes(params[0]) ? params[0] : 'tarifas', { onChange: (t) => { try { history.replaceState(null, '', '#/catalogo/tarifas' + (t === 'tarifas' ? '' : '/' + t)); } catch (e) { } } });
  });

  function pricingTab(b) {
    if (!(SEE.margin() || can(PERM.rates))) { b.innerHTML = UI.alert('bad', 'Las reglas de markup, comisión y utilidad requieren <span class="mono">catalog.products.manage_rates</span> o <span class="mono">catalog.products.view_profitability</span>.'); return; }
    const R = DB.pricingRules; const rule = (id) => { const r = R.find(x => x.id === id); return r && r.status === 'activa' ? r : null; };
    const prods = DB.products.filter(p => p.rates.length);
    b.innerHTML = UI.card('Cadena de cálculo (PROC-018)', UI.flow(['Tarifa', 'Reglas', 'Temporada', 'Segmento', 'Ocupación', 'Canal', 'Descuento', 'Impuesto', 'Redondeo', 'Precio'], 10) + '<p class="small muted" style="margin-top:8px">Costo + costos adicionales + markup − descuentos + impuestos = precio final. Soporta precio fijo, por persona, por grupo, por habitación y por unidad; markup porcentual y fijo; comisión; precio mínimo y máximo.</p>') +
      '<div class="grid g-1-2" style="margin-top:16px">' +
      UI.card('Reglas de pricing', '<div class="list">' + R.map(r => '<div class="list-item"><div class="grow"><b class="small">' + esc(r.name) + '</b><div class="xs faint">' + esc(r.kind) + ' · ' + (r.kind === 'Redondeo' ? fmtN(r.value, 2) : r.kind === 'Precio mínimo' ? fmtN(r.value, 0) : fmtN(r.value, 1) + '%') + ' · ' + esc(r.scope) + '</div></div><label class="switch"><input type="checkbox" data-prule="' + r.id + '"' + (r.status === 'activa' ? ' checked' : '') + (can(PERM.rates) ? '' : NP) + ' aria-label="Activar regla"></label></div>').join('') + '</div>', { tight: true, actions: '<button class="btn sm primary" id="pr-new"' + dis(PERM.rates) + '>' + ic('plus') + 'Regla</button>' }) +
      UI.card('Simulador de precio', '<div class="form-grid">' +
        '<div class="field c6"><label for="ps-prod">Producto</label><select class="input" id="ps-prod">' + prods.map(p => '<option value="' + p.id + '"' + (p.id === 'PRD-001' ? ' selected' : '') + (['INACTIVE', 'ARCHIVED'].includes(p.status) ? ' disabled' : '') + '>' + esc(p.name) + (p.status !== 'ACTIVE' ? ' [' + UI.statusLabel(p.status) + ']' : '') + '</option>').join('') + '</select></div>' +
        '<div class="field c6"><label for="ps-rate">Tarifa</label><select class="input" id="ps-rate"></select></div>' +
        '<div class="field c3"><label for="ps-date">Fecha de servicio</label><input class="input" type="date" id="ps-date" value="' + addDays(T(), 14) + '"></div>' +
        '<div class="field c3"><label for="ps-pax">Pasajeros</label><input class="input" type="number" min="1" id="ps-pax" value="2"></div>' +
        '<div class="field c3"><label for="ps-ch">Canal</label><select class="input" id="ps-ch"><option>Directo</option><option>E-commerce</option><option>B2B</option><option>Corporativo</option></select></div>' +
        '<div class="field c3"><label for="ps-res">Cliente</label><select class="input" id="ps-res"><option value="dom">Domiciliado (IGV)</option><option value="nodom">No domiciliado (exportación)</option></select></div>' +
        '<div class="field c3"><label for="ps-extra">Costos adicionales</label><input class="input" type="number" step="0.01" id="ps-extra" value="0"></div>' +
        '<div class="field c3"><label for="ps-dfix">Descuento fijo</label><input class="input" type="number" step="0.01" id="ps-dfix" value="0"></div>' +
        '<div class="field c3"><label for="ps-mko">Markup % (manual)</label><input class="input" type="number" step="0.1" id="ps-mko" placeholder="Según regla"></div>' +
        '<div class="field c3"><label for="ps-dpo">Descuento % (manual)</label><input class="input" type="number" step="0.1" id="ps-dpo" placeholder="Según regla"></div>' +
        '</div><div id="ps-out" style="margin-top:14px"></div>', { sub: 'Simulación del cálculo del backend con las reglas activas' }) + '</div>';
    const g = (id) => b.querySelector('#' + id);
    const fillRates = () => { const p = Q.product(g('ps-prod').value); g('ps-rate').innerHTML = p.rates.map(r => '<option value="' + r.id + '"' + (rateState(r) !== 'vigente' ? ' disabled' : '') + '>' + r.id + ' · ' + esc(r.type + ' ' + r.segment + ' ' + r.channel) + ' · ' + money(r.cost, r.currency) + ' costo' + (rateState(r) !== 'vigente' ? ' [' + rateState(r) + ' — PRD-BR-005]' : '') + '</option>').join(''); const f = p.rates.find(r => rateState(r) === 'vigente'); if (f) g('ps-rate').value = f.id; };
    const run = () => {
      const p = Q.product(g('ps-prod').value); const r = p.rates.find(x => x.id === g('ps-rate').value && rateState(x) === 'vigente');
      if (!r) { g('ps-out').innerHTML = UI.alert('bad', 'El producto no tiene tarifas vigentes seleccionables (PRD-BR-005).'); return; }
      const dt = g('ps-date').value, pax = Math.max(1, +g('ps-pax').value || 1), chn = g('ps-ch').value;
      const inRange = dt >= r.validFrom && dt <= r.validTo;
      const s = Pricing.seasonFor(dt); const factor = s ? s.factor : 1;
      const mkRule = chn === 'B2B' ? rule('PR-02') : rule('PR-01'); const mk = g('ps-mko').value !== '' ? +g('ps-mko').value : mkRule ? mkRule.value : p.markupPct;
      const dRule = pax >= 10 ? rule('PR-05') : null; const dp = g('ps-dpo').value !== '' ? +g('ps-dpo').value : dRule ? dRule.value : 0;
      const taxRule = g('ps-res').value === 'dom' ? rule('PR-03') : rule('PR-04'); const tax = taxRule ? taxRule.value : 0;
      const rnd = rule('PR-06') ? rule('PR-06').value : 0;
      const ag = chn === 'B2B' && p.b2b[0] ? p.b2b[0] : null; const com = ag ? ag.commissionPct : (rule('PR-07') ? rule('PR-07').value : 0);
      const baseCost = r.cost * pax; const seasonAdj = baseCost * (factor - 1);
      const k = Pricing.calc({ cost: baseCost + seasonAdj, extra: +g('ps-extra').value || 0, markupPct: mk, discountPct: dp, discountFixed: +g('ps-dfix').value || 0, taxPct: tax, commissionPct: com, round: rnd });
      const minR = rule('PR-08'); const unit = k.total / pax; const belowMin = minR && p.id === 'PRD-001' && r.currency === 'USD' && unit < minR.value;
      const cur = r.currency; const L = (l, v, cls, note) => '<div class="stat-line ' + (cls || '') + '"><span>' + l + (note ? ' <span class="xs faint">' + note + '</span>' : '') + '</span><span class="num">' + money(v, cur) + '</span></div>';
      g('ps-out').innerHTML = (!inRange ? UI.alert('bad', 'La fecha ' + date(dt) + ' está fuera de la vigencia de ' + r.id + ' (' + date(r.validFrom) + ' → ' + date(r.validTo) + '): la tarifa no puede aplicarse (PRD-BR-005).') + '<div style="height:10px"></div>' : '') +
        (p.status !== 'ACTIVE' ? UI.alert('warn', 'Producto ' + UI.statusLabel(p.status) + ': la simulación es referencial; no puede usarse para nuevas ventas (PRD-BR-002).') + '<div style="height:10px"></div>' : '') +
        L('Costo proveedor', baseCost, '', fmtN(r.cost) + ' × ' + pax + ' pax') + L('Ajuste de temporada', seasonAdj, '', s ? esc(s.name) + ' ×' + fmtN(factor, 2) : 'sin temporada') + L('+ Costos adicionales', k.base - baseCost - seasonAdj) + L('+ Markup', k.markup, '', fmtN(mk, 1) + '%' + (g('ps-mko').value === '' && mkRule ? ' · ' + mkRule.id : '')) + L('= Subtotal', k.subtotal) + L('− Descuentos', k.discount, '', dp ? fmtN(dp, 1) + '%' + (dRule && g('ps-dpo').value === '' ? ' · ' + dRule.id : '') : '') + L('= Valor neto', k.net) + L('+ Impuestos', k.tax, '', fmtN(tax, 0) + '%' + (taxRule ? ' · ' + taxRule.id : '')) + L('Precio final', k.total, 'total', 'redondeo ' + (rnd || 'no')) +
        '<div class="stat-line"><span>Precio por pasajero</span><b class="num">' + money(unit, cur) + '</b></div>' + L('Comisión', k.commission, '', fmtN(com, 1) + '%' + (ag ? ' · ' + ag.agencyId : '')) + L('Utilidad', k.profit) + '<div class="stat-line"><span>Margen sobre neto</span><b class="num">' + pct(k.marginPct) + '</b></div>' +
        (belowMin ? UI.alert('warn', 'Precio por pax por debajo del mínimo (' + money(minR.value, 'USD') + ', ' + minR.id + '): el backend aplica el precio mínimo.') : '') +
        '<p class="xs faint" style="margin-top:8px">Cálculo ejecutado en backend (PRD-BR-010). El navegador solo presenta el resultado; cualquier manipulación se ignora (PRD-T15).</p>';
    };
    g('ps-prod').onchange = () => { fillRates(); run(); };
    b.querySelectorAll('#ps-rate,#ps-date,#ps-pax,#ps-ch,#ps-res,#ps-extra,#ps-dfix,#ps-mko,#ps-dpo').forEach(i => i.addEventListener('input', run));
    fillRates(); run();
    b.querySelectorAll('[data-prule]').forEach(i => i.onchange = () => { if (!can(PERM.rates)) { i.checked = !i.checked; return noPerm(PERM.rates); } const r = R.find(x => x.id === i.dataset.prule); r.status = i.checked ? 'activa' : 'inactiva'; Audit.log('Regla de precio', r.id, 'cambio_estado', i.checked ? 'inactiva' : 'activa', r.status); Store.save(); UI.toast('Regla ' + r.id + ' ' + r.status + '.'); run(); });
    const nb = b.querySelector('#pr-new'); if (nb) nb.onclick = guard(PERM.rates, () => formModal({ title: 'Nueva regla de pricing', fields: [{ id: 'name', label: 'Nombre', required: true, col: 12 }, { id: 'kind', label: 'Tipo', type: 'select', options: ['Markup %', 'Markup fijo', 'Descuento %', 'Descuento fijo', 'Impuesto %', 'Comisión %', 'Redondeo', 'Precio mínimo', 'Precio máximo'], col: 6 }, { id: 'value', label: 'Valor', type: 'number', step: '0.01', required: true, col: 6 }, { id: 'scope', label: 'Ámbito / condición', required: true, col: 12, placeholder: 'p. ej. Canal Corporativo · anticipación ≥ 30 días' }],
      onSave: (d) => { const r = Object.assign({ id: nextId('PR-', R, 2), status: 'activa' }, d); R.push(r); Audit.log('Regla de precio', r.id, 'crear', '', r.name + ' ' + r.value); Store.save(); UI.toast('Regla creada.'); rerender(); } }));
  }

  /* ==========================================================================
     SERVICIOS (PROC-013): Proveedor → Servicio → Costo → Vigencia → Disponibilidad → Producto
     ========================================================================== */
  const svcState = (s) => s.status !== 'activo' ? s.status : (s.validTo && s.validTo < T()) ? 'vencido' : 'activo';
  const SVC = () => can(PERM.prov); /* servicios = componente del proveedor: los gestiona quien gestiona proveedores */
  const svcProducts = (id) => DB.products.filter(p => p.components.some(c => c.serviceId === id));
  function svcModal(s) {
    const provOpts = DB.providers.map(pv => ({ v: pv.id, l: pv.name + ' · ' + pv.type + (provActive(pv) ? '' : ' [' + UI.statusLabel(provState(pv)) + ']') }));
    formModal({ title: s ? 'Editar servicio ' + s.id : 'Nuevo servicio', sub: 'Componente operativo adquirido a un proveedor', size: 'lg', fields: [
        selField('providerId', 'Proveedor', provOpts, s ? s.providerId : '', { required: true, placeholder: 'Seleccione', col: 6 }), { id: 'type', label: 'Tipo de servicio', type: 'select', options: SVC_TYPES, value: s ? s.type : 'Transporte', col: 6 },
        { type: 'html', col: 12, html: '<div id="sv-warn"></div>' },
        { id: 'name', label: 'Nombre del servicio', required: true, value: s ? s.name : '', col: 12 },
        { id: 'unit', label: 'Unidad', type: 'select', options: UNITS, value: s ? s.unit : 'pax', col: 3 }, { id: 'cost', label: 'Costo', type: 'number', step: '0.01', required: true, value: s ? s.cost : '', col: 3 }, { id: 'currency', label: 'Moneda', type: 'select', options: ['PEN', 'USD'], value: s ? s.currency : 'PEN', col: 3 }, { id: 'capacity', label: 'Capacidad', type: 'number', min: 0, value: s ? s.capacity || '' : '', col: 3 },
        { id: 'validFrom', label: 'Vigencia desde', type: 'date', required: true, value: s ? s.validFrom : T(), col: 4 }, { id: 'validTo', label: 'Vigencia hasta', type: 'date', required: true, value: s ? s.validTo : '2026-12-31', col: 4 }, { id: 'status', label: 'Estado', type: 'select', options: [['activo', 'Activo'], ['inactivo', 'Inactivo']], value: s ? (s.status === 'vencido' ? 'inactivo' : s.status) : 'activo', col: 4 }],
      onOpen: (m) => { const w = () => { const pv = Q.provider(m.querySelector('#providerId').value); m.querySelector('#sv-warn').innerHTML = pv && !provActive(pv) ? UI.alert('warn', '<b>PRD-BR-007:</b> el proveedor ' + esc(pv.name) + ' está ' + UI.statusLabel(provState(pv)).toLowerCase() + '. El servicio no estará disponible para nuevas ventas y se guardará como inactivo.') : ''; }; m.querySelector('#providerId').onchange = w; w(); },
      onSave: (f) => {
        if (f.validTo < f.validFrom) { UI.toast('La vigencia final debe ser posterior a la inicial.', 'bad'); return false; }
        if (!(f.cost >= 0)) { UI.toast('Costo inválido.', 'bad'); return false; }
        const pv = Q.provider(f.providerId); let forced = false;
        if (!provActive(pv) && f.status === 'activo') { f.status = 'inactivo'; forced = true; }
        const before = s ? s.currency + ' ' + s.cost + ' · ' + s.status : '';
        const o = s || { id: nextId('SRV-', DB.services, 3) }; Object.assign(o, f, { capacity: f.capacity || null }); if (!s) DB.services.push(o);
        Audit.log('Servicio', o.id, s ? (s && before.split(' · ')[0] !== o.currency + ' ' + o.cost ? 'cambio_costo' : 'modificar') : 'crear', before, o.currency + ' ' + o.cost + ' · ' + o.status + (s ? ' · usado en ' + svcProducts(o.id).length + ' producto(s)' : ''));
        Store.save(); UI.toast(forced ? 'Servicio guardado como <b>inactivo</b>: proveedor no activo (PRD-BR-007).' : 'Servicio ' + o.id + ' guardado.', forced ? 'warn' : 'ok'); rerender();
      } });
  }

  App.register('catalogo/servicios', (el, params) => {
    ensure(); css();
    if (params[0]) return serviceDetail(el, params[0]);
    const S = DB.services; const act = S.filter(s => svcState(s) === 'activo'); const provOff = S.filter(s => !provActive(Q.provider(s.providerId)));
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Servicios turísticos', subtitle: 'Unidades operativas adquiribles a proveedores. Un producto se compone de servicios; el servicio conserva su identidad, costo y vigencia de origen (PROC-013).', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Servicios']], actions: '<button class="btn primary" id="sv-new"' + dis(PERM.prov) + '>' + ic('plus') + 'Nuevo servicio</button>' }) + readOnlyNote(PERM.prov) +
      (provOff.length ? UI.alert('warn', '<b>PRD-BR-007:</b> ' + provOff.length + ' servicio(s) pertenecen a proveedores inactivos o con contrato vencido y no están disponibles para nuevas ventas: ' + provOff.map(s => '<a href="#/catalogo/servicios/' + s.id + '">' + s.id + '</a>').join(', ') + '.') : '') +
      '<div class="grid g4">' + UI.kpi({ label: 'Servicios activos', value: act.length, sub: 'de ' + S.length, tone: 'ok', icon: 'layers' }) + UI.kpi({ label: 'Vencidos / inactivos', value: S.length - act.length, tone: 'bad', icon: 'clock' }) + UI.kpi({ label: 'Vencen en 90 días', value: S.filter(s => svcState(s) === 'activo' && daysFromToday(s.validTo) <= 90).length, tone: 'sun', icon: 'alert' }) + UI.kpi({ label: 'Proveedor no activo', value: provOff.length, tone: 'violet', icon: 'building' }) + '</div><div id="sv-t"></div></div>';
    const nb = el.querySelector('#sv-new'); if (nb) nb.onclick = guard(PERM.prov, () => svcModal(null));
    const C = SEE.cost();
    UI.dataTable(el.querySelector('#sv-t'), { exportName: 'servicios', rows: S, defaultSort: 'id', pageSize: 15, onRow: (s) => App.go('#/catalogo/servicios/' + s.id),
      filters: [{ key: 'type', label: 'Tipo', options: [...new Set(S.map(s => s.type))].map(t => [t, t]) }, { key: 'providerId', label: 'Proveedor', options: DB.providers.filter(pv => S.some(s => s.providerId === pv.id)).map(pv => [pv.id, pv.name]) }, { key: '_st', label: 'Estado', options: [['activo', 'Activo'], ['vencido', 'Vencido'], ['inactivo', 'Inactivo']], match: (s, v) => svcState(s) === v }],
      search: (s) => s.id + ' ' + s.name + ' ' + Q.providerName(s.providerId),
      columns: cols([
        { key: 'id', label: 'ID', render: s => '<span class="mono">' + s.id + '</span>' },
        { key: 'name', label: 'Servicio', render: s => '<div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc(s.type) + '</div>' },
        { key: 'providerId', label: 'Proveedor', render: s => provLink(s.providerId) + (provActive(Q.provider(s.providerId)) ? '' : ' ' + UI.badge(provState(Q.provider(s.providerId)))), sortVal: s => Q.providerName(s.providerId), csv: s => Q.providerName(s.providerId) },
        { key: 'unit', label: 'Unidad' }, { key: 'cost', label: 'Costo', align: 'num', hide: !C, render: s => money(s.cost, s.currency), sortVal: s => toPEN(s.cost, s.currency), csv: s => s.currency + ' ' + s.cost },
        { key: 'validTo', label: 'Vigencia', render: s => '<span class="small nowrap">' + dateShort(s.validFrom) + ' → ' + date(s.validTo) + '</span>', csv: s => s.validFrom + ' / ' + s.validTo },
        { key: 'capacity', label: 'Capacidad', align: 'num', render: s => s.capacity || '—' },
        { key: 'uses', label: 'Productos', align: 'num', render: s => svcProducts(s.id).length, sortVal: s => svcProducts(s.id).length, csv: s => svcProducts(s.id).length },
        { key: 'status', label: 'Estado', render: s => UI.badge(svcState(s)), sortVal: s => svcState(s), csv: s => svcState(s) }
      ]) });
  });

  function serviceDetail(el, id) {
    const s = Q.service(id);
    if (!s) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('Servicio no encontrado: ' + id, 'layers')) + '</div>'; return; }
    const pv = Q.provider(s.providerId); const prods = svcProducts(s.id); const st = svcState(s);
    const stepIdx = st === 'activo' ? (prods.length ? 6 : 5) : 3;
    const aud = DB.audit.filter(a => a.entityId === s.id);
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(s.name), subtitle: '<span class="mono">' + s.id + '</span> · ' + esc(s.type) + ' · ' + UI.badge(st), crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Servicios', '#/catalogo/servicios'], [s.id]],
        actions: '<button class="btn" id="sd-tog"' + dis(PERM.prov) + '>' + ic(s.status === 'activo' ? 'x' : 'check') + (s.status === 'activo' ? 'Desactivar' : 'Activar') + '</button><button class="btn primary" id="sd-edit"' + dis(PERM.prov) + '>' + ic('edit') + 'Editar</button>' }) +
      (!provActive(pv) ? UI.alert('bad', '<b>PRD-BR-007:</b> el proveedor ' + esc(pv ? pv.name : '') + ' está ' + UI.statusLabel(provState(pv)).toLowerCase() + '. Este servicio no está disponible para nuevas ventas.') : '') +
      (s.validTo < T() ? UI.alert('bad', 'Servicio fuera de vigencia desde el ' + date(s.validTo) + ' (PRD-BR-003).') : daysFromToday(s.validTo) <= 60 ? UI.alert('warn', 'La vigencia del servicio vence en ' + daysFromToday(s.validTo) + ' días (' + date(s.validTo) + ').') : '') +
      UI.card('Cadena del servicio (PROC-013)', UI.flow(['Proveedor', 'Servicio', 'Costo', 'Vigencia', 'Disponibilidad', 'Producto', 'Cotización', 'Reserva', 'Operación'], stepIdx, st !== 'activo' ? 3 : undefined)) +
      '<div class="grid g-2-1"><div class="stack">' + UI.card('Ficha del servicio', UI.dl([['ID', '<span class="mono">' + s.id + '</span>'], ['Nombre', esc(s.name)], ['Tipo', esc(s.type)], ['Proveedor', provLink(s.providerId)], ['Unidad', esc(s.unit)]].concat(SEE.cost() ? [['Costo', '<b>' + money(s.cost, s.currency) + '</b> por ' + esc(s.unit)], ['Equivalente', money(toPEN(s.cost, s.currency)) + (s.currency === 'USD' ? ' (TC ' + DB.settings.fx + ')' : '')]] : []).concat([['Vigencia', date(s.validFrom) + ' → ' + date(s.validTo)], ['Capacidad', s.capacity || 'Sin límite propio'], ['Estado', UI.badge(st)]]))) +
      UI.card('Productos que lo utilizan', prods.length ? tbl(['Producto', ['Cant.', 'num'], 'Unidad', 'Requerido', 'Estado'], prods.map(p => { const c = p.components.find(x => x.serviceId === s.id); return '<tr><td>' + prodLink(p.id) + '<div class="cell-sub mono">' + p.id + '</div></td><td class="num">' + c.qty + '</td><td>' + esc(c.unit) + '</td><td>' + (c.required ? 'Sí' : 'No') + '</td><td>' + UI.badge(p.status) + '</td></tr>'; }).join(''), 'compact') : UI.empty('Ningún producto usa este servicio.', 'box'), { tight: true }) + '</div>' +
      '<div class="stack">' + UI.card('Proveedor', pv ? UI.dl([['Nombre', provLink(pv.id)], ['Tipo', esc(pv.type)]].concat(SEE.cost() ? [['Contrato', date(pv.contractStart) + ' → ' + date(pv.contractEnd)], ['Pago', esc(pv.paymentTerms)]] : []).concat([['Estado', UI.badge(provState(pv))]])) : '—') +
      (SEE.audit() || can(PERM.prov) ? UI.card('Historial', UI.timeline(aud.map(a => ({ title: esc(a.action) + ' · ' + esc(Q.userName(a.user)), meta: datetime(a.ts), desc: esc((a.before ? a.before + ' → ' : '') + a.after), icon: 'history' })))) : '') + '</div></div></div>';
    el.querySelector('#sd-edit').onclick = guard(PERM.prov, () => svcModal(s));
    el.querySelector('#sd-tog').onclick = guard(PERM.prov, () => { if (s.status !== 'activo') { if (!provActive(pv)) { UI.toast('<b>PRD-BR-007:</b> no se puede activar un servicio de un proveedor ' + UI.statusLabel(provState(pv)).toLowerCase() + '.', 'bad'); return; } if (s.validTo < T()) { UI.toast('Actualice la vigencia antes de activar.', 'bad'); return; } s.status = 'activo'; Audit.log('Servicio', s.id, 'cambio_estado', 'inactivo', 'activo'); Store.save(); UI.toast('Servicio activado.'); rerender(); return; }
      UI.confirm({ title: 'Desactivar servicio', message: prods.length ? 'Lo usan ' + prods.length + ' producto(s): ' + prods.map(p => esc(p.name)).join(', ') + '. Quedará no disponible para nuevas ventas; cotizaciones existentes conservan snapshot.' : '¿Desactivar el servicio?', reason: true, danger: true, confirmLabel: 'Desactivar', onConfirm: (r) => { s.status = 'inactivo'; Audit.log('Servicio', s.id, 'cambio_estado', 'activo', 'inactivo — ' + r); Store.save(); UI.toast('Servicio desactivado.'); rerender(); } }); });
  }

  /* ==========================================================================
     PROVEEDORES (PROC-012): Crear → Tipo → Contactos → Contrato → Vigencia → Costos → Activar → Utilizar → Desactivar
     ========================================================================== */
  const provProducts = (id) => DB.products.filter(p => p.mainProviderId === id || p.components.some(c => { const s = c.serviceId && Q.service(c.serviceId); return s && s.providerId === id; }));
  function provModal(pv) {
    formModal({ title: pv ? 'Editar proveedor' : 'Nuevo proveedor', sub: 'La información contractual y operativa se mantiene separada de la descripción comercial de los productos (§8).', size: 'lg', fields: [
        { type: 'section', label: 'Datos generales' },
        { id: 'name', label: 'Razón social / nombre', required: true, value: pv ? pv.name : '', col: 6 }, { id: 'type', label: 'Tipo', type: 'select', options: PROV_TYPES, value: pv ? pv.type : 'Hotel', col: 3 }, { id: 'ruc', label: 'RUC', required: true, value: pv ? pv.ruc : '', col: 3, placeholder: '11 dígitos' },
        { id: 'city', label: 'Ciudad', value: pv ? pv.city : 'Cusco', col: 4 }, { id: 'stars', label: 'Categoría (estrellas)', type: 'number', min: 0, max: 5, value: pv ? pv.stars || '' : '', col: 2 },
        { type: 'section', label: 'Contacto principal' },
        { id: 'contact', label: 'Contacto', required: true, value: pv ? pv.contact : '', col: 4 }, { id: 'phone', label: 'Teléfono', value: pv ? pv.phone : '', col: 4 }, { id: 'email', label: 'Correo', type: 'email', value: pv ? pv.email : '', col: 4 },
        { type: 'section', label: 'Contrato y condiciones' },
        { id: 'contractStart', label: 'Inicio de contrato', type: 'date', required: true, value: pv ? pv.contractStart : T(), col: 3 }, { id: 'contractEnd', label: 'Fin de contrato', type: 'date', required: true, value: pv ? pv.contractEnd : '2027-09-30', col: 3 },
        { id: 'currency', label: 'Moneda de costos', type: 'select', options: ['PEN', 'USD'], value: pv ? pv.currency : 'PEN', col: 3 }, { id: 'paymentTerms', label: 'Condiciones de pago', value: pv ? pv.paymentTerms : 'Crédito 15 días', col: 3 }],
      onSave: (f) => {
        if (!/^(10|15|17|20)\d{9}$/.test(f.ruc)) { UI.toast('RUC inválido: debe tener 11 dígitos y empezar con 10, 15, 17 o 20.', 'bad'); return false; }
        if (DB.providers.some(x => x !== pv && x.ruc === f.ruc)) { UI.toast('Ya existe un proveedor con ese RUC.', 'bad'); return false; }
        if (f.contractEnd < f.contractStart) { UI.toast('El fin de contrato debe ser posterior al inicio.', 'bad'); return false; }
        if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { UI.toast('Correo inválido.', 'bad'); return false; }
        const o = pv || { id: nextId('PRV-', DB.providers, 3), status: 'inactivo', rating: 0, contacts: [] }; const before = pv ? pv.contractEnd : '';
        Object.assign(o, f, { stars: f.stars || undefined }); if (pv && pv.status === 'vencido' && f.contractEnd >= T()) o.status = 'inactivo';
        if (!pv) DB.providers.push(o);
        Audit.log('Proveedor', o.id, pv ? 'modificar' : 'crear', before, pv ? 'contrato hasta ' + o.contractEnd : 'inactivo (pendiente de activación)');
        Store.save(); UI.toast(pv ? 'Proveedor actualizado.' : 'Proveedor ' + o.id + ' creado como inactivo. Valide el contrato y actívelo.'); pv ? rerender() : App.go('#/catalogo/proveedores/' + o.id);
      } });
  }

  App.register('catalogo/proveedores', (el, params) => {
    ensure(); css();
    if (params[0]) return providerDetail(el, params[0]);
    const P = DB.providers;
    const soon = P.filter(pv => pv.status === 'activo' && daysFromToday(pv.contractEnd) >= 0 && daysFromToday(pv.contractEnd) <= 95);
    const expired = P.filter(pv => provState(pv) === 'vencido');
    const cxp = DB.payables.filter(x => x.status !== 'pagada');
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Proveedores', subtitle: 'Hoteles, transportistas, guías, restaurantes, operadores, actividades y entradas. Un proveedor inactivo o con contrato vencido no está disponible para nuevas ventas (PRD-BR-007).', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Proveedores']], actions: '<button class="btn primary" id="pv-new"' + dis(PERM.prov) + '>' + ic('plus') + 'Nuevo proveedor</button>' }) +
      readOnlyNote(PERM.prov) +
      (expired.length ? UI.alert('bad', 'Contrato vencido: ' + expired.map(pv => '<a href="#/catalogo/proveedores/' + pv.id + '">' + esc(pv.name) + '</a> (' + date(pv.contractEnd) + ')').join(', ') + '. Sus servicios bloquean la activación de productos.') : '') +
      '<div class="grid g4">' + UI.kpi({ label: 'Proveedores activos', value: P.filter(pv => provState(pv) === 'activo').length, sub: 'de ' + P.length, tone: 'ok', icon: 'building' }) + UI.kpi({ label: 'Contratos por vencer', value: soon.length, sub: 'próximos 95 días', tone: 'sun', icon: 'clock' }) + UI.kpi({ label: 'Vencidos / inactivos', value: P.filter(pv => provState(pv) !== 'activo').length, tone: 'bad', icon: 'alert' }) + (Auth.can('finance.payables') ? UI.kpi({ label: 'Cuentas por pagar abiertas', value: money(sum(cxp, x => toPEN(x.amount - x.paid, x.currency)), 'PEN', 0), sub: cxp.length + ' documentos', tone: 'violet', icon: 'coins' }) : UI.kpi({ label: 'Servicios vigentes', value: DB.services.filter(s => svcState(s) === 'activo').length, sub: 'componentes contratados', tone: 'violet', icon: 'layers' })) + '</div><div id="pv-t"></div></div>';
    const nb = el.querySelector('#pv-new'); if (nb) nb.onclick = guard(PERM.prov, () => provModal(null));
    UI.dataTable(el.querySelector('#pv-t'), { exportName: 'proveedores', rows: P, defaultSort: 'name', pageSize: 15, onRow: (pv) => App.go('#/catalogo/proveedores/' + pv.id),
      filters: [{ key: 'type', label: 'Tipo', options: [...new Set(P.map(x => x.type))].map(t => [t, t]) }, { key: '_st', label: 'Estado', options: [['activo', 'Activo'], ['inactivo', 'Inactivo'], ['vencido', 'Vencido']], match: (x, v) => provState(x) === v }],
      search: (x) => x.id + ' ' + x.name + ' ' + x.ruc + ' ' + x.city + ' ' + x.contact,
      columns: [
        { key: 'name', label: 'Proveedor', render: x => '<div class="cell-main">' + esc(x.name) + '</div><div class="cell-sub mono">' + x.id + ' · RUC ' + esc(x.ruc) + '</div>' },
        { key: 'type', label: 'Tipo' }, { key: 'city', label: 'Ciudad' },
        { key: 'contact', label: 'Contacto', render: x => '<span class="small">' + esc(x.contact) + '<br><span class="faint">' + esc(x.phone) + '</span></span>' },
        { key: 'contractEnd', label: 'Contrato', render: x => { const d = daysFromToday(x.contractEnd); return '<span class="small nowrap">hasta ' + date(x.contractEnd) + '</span><div class="cell-sub ' + (d < 0 ? 'bad' : d <= 95 ? 'warn' : '') + '">' + (d < 0 ? 'vencido hace ' + (-d) + ' d' : 'vence en ' + d + ' d') + '</div>'; } },
        { key: 'paymentTerms', label: 'Pago', render: x => '<span class="small">' + esc(x.paymentTerms) + ' · ' + x.currency + '</span>' },
        { key: 'svcs', label: 'Servicios', align: 'num', render: x => DB.services.filter(s => s.providerId === x.id).length, sortVal: x => DB.services.filter(s => s.providerId === x.id).length, csv: x => DB.services.filter(s => s.providerId === x.id).length },
        { key: 'rating', label: 'Calificación', render: x => stars(x.rating), csv: x => x.rating },
        { key: 'status', label: 'Estado', render: x => UI.badge(provState(x)), sortVal: x => provState(x), csv: x => provState(x) }
      ] });
  });

  function providerDetail(el, id) {
    const pv = Q.provider(id);
    if (!pv) { el.innerHTML = '<div class="page">' + UI.card('', UI.empty('Proveedor no encontrado: ' + id, 'building')) + '</div>'; return; }
    pv.contacts = pv.contacts || [];
    const st = provState(pv); const dl = daysFromToday(pv.contractEnd);
    const svcs = DB.services.filter(s => s.providerId === id); const prods = provProducts(id);
    const resSvcs = DB.reservations.flatMap(r => r.services.filter(s => s.providerId === id).map(s => ({ s, r })));
    const pays = DB.payables.filter(x => x.providerId === id); const open = pays.filter(x => x.status !== 'pagada');
    const stepIdx = st === 'activo' ? (resSvcs.length || prods.length ? 7 : 6) : pv.status === 'inactivo' && (pv.rating || prods.length) ? 8 : st === 'vencido' ? 4 : 6;
    const E = can(PERM.prov);
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: esc(pv.name), subtitle: '<span class="mono">' + pv.id + '</span> · ' + esc(pv.type) + ' · RUC ' + esc(pv.ruc) + ' · ' + esc(pv.city) + ' · ' + UI.badge(st), crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Proveedores', '#/catalogo/proveedores'], [pv.id]],
        actions: '<button class="btn" id="pd-renew"' + dis(PERM.prov) + '>' + ic('refresh') + 'Renovar contrato</button><button class="btn" id="pd-edit"' + dis(PERM.prov) + '>' + ic('edit') + 'Editar</button>' + (pv.status === 'activo' ? '<button class="btn danger" id="pd-off"' + dis(PERM.prov) + '>' + ic('x') + 'Desactivar</button>' : '<button class="btn primary" id="pd-on"' + dis(PERM.prov) + '>' + ic('check') + 'Activar</button>') }) +
      readOnlyNote(PERM.prov) +
      (dl < 0 ? UI.alert('bad', '<b>Contrato vencido</b> desde el ' + date(pv.contractEnd) + ' (hace ' + (-dl) + ' días). El proveedor y sus servicios no están disponibles para nuevas ventas (PRD-BR-007). Renueve el contrato para reactivarlo.') : dl <= 95 ? UI.alert('warn', 'El contrato vence el ' + date(pv.contractEnd) + ' (en ' + dl + ' días). Inicie la renovación para no bloquear productos.') : '') +
      UI.card('Ciclo del proveedor (PROC-012)', UI.flow(['Crear', 'Tipo', 'Contactos', 'Contrato', 'Vigencia', 'Costos', 'Activar', 'Utilizar', 'Desactivar'], stepIdx, st === 'vencido' ? 4 : undefined)) +
      '<div class="grid g3">' +
        UI.card('Datos y contrato', UI.dl([['Tipo', esc(pv.type) + (pv.stars ? ' · ' + pv.stars + '★' : '')], ['RUC', '<span class="mono">' + esc(pv.ruc) + '</span>'], ['Ciudad', esc(pv.city)], ['Contrato', date(pv.contractStart) + ' → ' + date(pv.contractEnd)], ['Vigencia', dl < 0 ? '<span class="bad">Vencido</span>' : '<span class="' + (dl <= 95 ? 'warn' : 'ok') + '">' + dl + ' días restantes</span>'], ['Moneda de costos', pv.currency], ['Condiciones de pago', esc(pv.paymentTerms)], ['Estado', UI.badge(st)]])) +
        UI.card('Contactos', '<div class="li-row"><div><b class="small">' + esc(pv.contact) + '</b> <span class="tag">Principal</span><div class="xs faint">' + esc(pv.phone) + ' · ' + esc(pv.email) + '</div></div></div>' + pv.contacts.map((c, i) => '<div class="li-row"><div><b class="small">' + esc(c.name) + '</b> <span class="xs faint">' + esc(c.role) + '</span><div class="xs faint">' + esc(c.phone) + ' · ' + esc(c.email) + '</div></div><button class="btn xs ghost icon" data-ctrm="' + i + '"' + (E ? '' : NP) + '>' + ic('x') + '</button></div>').join(''), { actions: '<button class="btn xs" id="pd-ct"' + dis(PERM.prov) + '>' + ic('plus') + 'Contacto</button>' }) +
        UI.card('Calificación', '<div style="font-size:1.4rem">' + stars(pv.rating) + '</div><p class="xs faint" style="margin-top:6px">Promedio de evaluaciones operativas (puntualidad, calidad y respuesta).</p>' + (pv.ratingNote ? '<p class="small" style="margin-top:8px">' + esc(pv.ratingNote) + '</p>' : ''), { actions: '<button class="btn xs" id="pd-rate"' + dis(PERM.prov) + '>' + ic('star') + 'Calificar</button>' }) +
      '</div>' +
      '<div class="grid g2">' +
        UI.card('Servicios del proveedor', svcs.length ? tbl(['Servicio', ['Costo', 'num'], 'Vigencia', 'Estado'], svcs.map(s => '<tr><td>' + svcLink(s.id) + '<div class="cell-sub mono">' + s.id + ' · ' + esc(s.type) + '</div></td><td class="num">' + money(s.cost, s.currency) + '<div class="cell-sub">por ' + esc(s.unit) + '</div></td><td class="small nowrap">' + date(s.validTo) + '</td><td>' + UI.badge(svcState(s)) + '</td></tr>').join(''), 'compact') : UI.empty('Sin servicios registrados.', 'layers'), { tight: true, actions: '<a class="btn xs" href="#/catalogo/servicios">' + ic('layers') + 'Servicios</a>' }) +
        UI.card('Productos en los que participa', prods.length ? tbl(['Producto', 'Rol', 'Estado'], prods.map(p => '<tr><td>' + prodLink(p.id) + '<div class="cell-sub mono">' + p.id + '</div></td><td class="small">' + (p.mainProviderId === id ? 'Principal' : 'Componente') + '</td><td>' + UI.badge(p.status) + '</td></tr>').join(''), 'compact') : UI.empty('No participa en productos.', 'box'), { tight: true }) +
      '</div><div class="grid g2">' +
        UI.card('Reservas en las que participa', resSvcs.length ? tbl(['Reserva', 'Servicio', 'Fecha', ['Costo', 'num'], 'Estado'], resSvcs.map(({ s, r }) => '<tr><td>' + docLink('reservas', r.id) + '<div class="cell-sub">' + esc(Q.clientName(r.clientId)) + '</div></td><td class="small">' + esc(s.name) + (s.confirmationCode ? '<div class="cell-sub mono">' + esc(s.confirmationCode) + '</div>' : '') + '</td><td class="nowrap small">' + dateShort(s.date) + '</td><td class="num">' + money(s.cost, r.currency) + '</td><td>' + UI.badge(s.status) + '</td></tr>').join(''), 'compact') : UI.empty('Sin reservas.', 'suitcase'), { tight: true, sub: resSvcs.length + ' servicio(s) reservados' }) +
        (!Auth.can('finance.payables') ? UI.card('Cuentas por pagar', UI.alert('info', 'La información de pagos al proveedor la gestiona Finanzas (requiere <span class="mono">finance.payables</span>).')) : UI.card('Cuentas por pagar', pays.length ? tbl(['Documento', 'Concepto', 'Vence', ['Monto', 'num'], ['Saldo', 'num'], 'Estado'], pays.map(x => '<tr><td class="mono">' + x.id + '<div class="cell-sub"><a href="#/reservas/' + x.resId + '">' + x.resId + '</a></div></td><td class="small">' + esc(x.concept) + '</td><td class="nowrap small ' + (x.status !== 'pagada' && x.due < T() ? 'bad' : '') + '">' + date(x.due) + '</td><td class="num">' + money(x.amount, x.currency) + '</td><td class="num"><b>' + money(x.amount - x.paid, x.currency) + '</b></td><td>' + UI.badge(x.status) + '</td></tr>').join(''), 'compact') : UI.empty('Sin cuentas por pagar.', 'coins'), { tight: true, sub: 'Saldo abierto ' + money(sum(open, x => toPEN(x.amount - x.paid, x.currency))) + ' · Finanzas es la fuente de verdad', actions: '<a class="btn xs" href="#/finanzas/proveedores">' + ic('coins') + 'Cuentas por pagar</a>' })) +
      '</div></div>';
    const q = (s) => el.querySelector(s);
    q('#pd-edit').onclick = guard(PERM.prov, () => provModal(pv));
    q('#pd-renew').onclick = guard(PERM.prov, () => formModal({ title: 'Renovar contrato', size: 'sm', fields: [{ id: 'contractEnd', label: 'Nuevo fin de contrato', type: 'date', required: true, value: addDays(pv.contractEnd > T() ? pv.contractEnd : T(), 365), col: 12 }, { id: 'paymentTerms', label: 'Condiciones de pago', value: pv.paymentTerms, col: 12 }],
      onSave: (f) => { if (f.contractEnd <= T()) { UI.toast('La nueva vigencia debe ser futura.', 'bad'); return false; } const before = pv.contractEnd; pv.contractEnd = f.contractEnd; pv.paymentTerms = f.paymentTerms; if (pv.status === 'vencido') pv.status = 'inactivo'; Audit.log('Proveedor', pv.id, 'renovar_contrato', before, f.contractEnd); Store.save(); UI.toast('Contrato renovado hasta ' + date(f.contractEnd) + (pv.status === 'inactivo' ? '. Active el proveedor para volver a usarlo.' : '.')); rerender(); } }));
    const onb = q('#pd-on'); if (onb) onb.onclick = guard(PERM.prov, () => { if (pv.contractEnd < T()) { UI.toast('<b>PROC-012:</b> contrato vencido. Renueve la vigencia antes de activar.', 'bad'); return; } if (!/^\d{11}$/.test(pv.ruc)) { UI.toast('RUC inválido.', 'bad'); return; } const before = pv.status; pv.status = 'activo'; Audit.log('Proveedor', pv.id, 'activar', before, 'activo'); Notify.push('proveedor.activado', 'Email', 'U05', 'Proveedor ' + pv.name + ' activo'); Store.save(); UI.toast('Proveedor activado.'); rerender(); });
    const off = q('#pd-off'); if (off) off.onclick = guard(PERM.prov, () => { const act = prods.filter(p => p.status === 'ACTIVE'); UI.confirm({ title: 'Desactivar proveedor', message: (act.length ? '<b>Impacto:</b> ' + act.length + ' producto(s) activo(s) dependen de este proveedor (' + act.map(p => esc(p.name)).join(', ') + ') y dejarán de estar disponibles para nuevas ventas (PRD-BR-007). ' : '') + 'Las reservas confirmadas y cuentas por pagar no se modifican.', reason: true, danger: true, confirmLabel: 'Desactivar', onConfirm: (r) => { pv.status = 'inactivo'; Audit.log('Proveedor', pv.id, 'desactivar', 'activo', 'inactivo — ' + r); if (act.length) Notify.push('proveedor.desactivado', 'Email', 'U02', 'Proveedor ' + pv.name + ' desactivado: ' + act.length + ' producto(s) afectados'); Store.save(); UI.toast('Proveedor desactivado.'); rerender(); } }); });
    q('#pd-ct').onclick = guard(PERM.prov, () => formModal({ title: 'Nuevo contacto', fields: [{ id: 'name', label: 'Nombre', required: true, col: 6 }, { id: 'role', label: 'Cargo / área', col: 6, placeholder: 'Reservas, Operaciones, Cobranzas…' }, { id: 'phone', label: 'Teléfono', col: 6 }, { id: 'email', label: 'Correo', type: 'email', col: 6 }], onSave: (f) => { pv.contacts.push(f); Audit.log('Proveedor', pv.id, 'agregar_contacto', '', f.name); Store.save(); UI.toast('Contacto agregado.'); rerender(); } }));
    on(el, '[data-ctrm]', guard(PERM.prov, (x) => { const c = pv.contacts.splice(+x.dataset.ctrm, 1)[0]; Audit.log('Proveedor', pv.id, 'quitar_contacto', c.name, ''); Store.save(); rerender(); }));
    q('#pd-rate').onclick = guard(PERM.prov, () => formModal({ title: 'Calificar proveedor', size: 'sm', fields: [{ id: 'rating', label: 'Calificación (1 a 5)', type: 'number', step: '0.1', min: 1, max: 5, required: true, value: pv.rating || 4, col: 12 }, { id: 'note', label: 'Comentario', type: 'textarea', rows: 2, col: 12, value: pv.ratingNote || '' }], onSave: (f) => { if (f.rating < 1 || f.rating > 5) { UI.toast('La calificación debe estar entre 1 y 5.', 'bad'); return false; } const b = pv.rating; pv.rating = f.rating; pv.ratingNote = f.note; Audit.log('Proveedor', pv.id, 'calificar', b, f.rating); Store.save(); UI.toast('Calificación registrada.'); rerender(); } }));
  }

  /* ==========================================================================
     DESTINOS (PROC-011): País → Región → Departamento/Provincia → Ciudad/Zona → Lugar → Atracción/Ruta
     ========================================================================== */
  const DTYPES = Object.keys(DEST_LEVEL);
  const descendants = (id) => { const out = []; const walk = (pid) => DB.destinations.filter(d => d.parent === pid).forEach(d => { out.push(d.id); walk(d.id); }); walk(id); return out; };
  function destModal(d, parentId) {
    const parent = Q.destination(parentId || (d && d.parent));
    const types = DTYPES.filter(t => !parent || DEST_LEVEL[t] > DEST_LEVEL[parent.type]);
    const fields = [{ id: 'name', label: 'Nombre', required: true, value: d ? d.name : '', col: 8 }, { id: 'type', label: 'Tipo', type: 'select', options: d ? DTYPES : types, value: d ? d.type : types[0], col: 4 }];
    if (d) fields.push(selField('parent', 'Depende de', DB.destinations.filter(x => x.id !== d.id).map(x => ({ v: x.id, l: Q.destPath(x.id) + ' (' + x.type + ')' })), d.parent || '', { placeholder: 'Ninguno (nivel raíz)', col: 12, hint: 'No se permiten referencias circulares ni jerarquías inválidas (PROC-011).' }));
    fields.push({ id: 'lat', label: 'Latitud', type: 'number', step: '0.0001', value: d && d.lat != null ? d.lat : '', col: 4 }, { id: 'lng', label: 'Longitud', type: 'number', step: '0.0001', value: d && d.lng != null ? d.lng : '', col: 4 }, { id: 'desc', label: 'Descripción', type: 'textarea', rows: 2, value: d ? d.desc || '' : '', col: 12 });
    formModal({ title: d ? 'Editar destino' : 'Nuevo destino' + (parent ? ' en ' + esc(parent.name) : ' raíz'), sub: parent ? Q.destPath(parent.id) : '', fields,
      onSave: (f) => {
        const newParent = d ? (f.parent || null) : (parent ? parent.id : null);
        if (d && newParent) { if (newParent === d.id || descendants(d.id).includes(newParent)) { UI.toast('<b>PROC-011 · referencia circular:</b> "' + esc(Q.destName(newParent)) + '" es descendiente de "' + esc(d.name) + '"; no puede ser su padre.', 'bad'); return false; } }
        const par = newParent ? Q.destination(newParent) : null;
        if (par && DEST_LEVEL[f.type] <= DEST_LEVEL[par.type]) { UI.toast('<b>Jerarquía inválida:</b> un(a) ' + esc(f.type) + ' no puede depender de un(a) ' + esc(par.type) + ' (PROC-011).', 'bad'); return false; }
        if (d) { const bad = DB.destinations.filter(x => x.parent === d.id && DEST_LEVEL[x.type] <= DEST_LEVEL[f.type]); if (bad.length) { UI.toast('<b>Jerarquía inválida:</b> los hijos ' + bad.map(x => esc(x.name)).join(', ') + ' quedarían en un nivel igual o superior.', 'bad'); return false; } }
        if (!par && f.type !== 'País') { UI.toast('Un destino sin padre debe ser de tipo País.', 'bad'); return false; }
        if ((f.lat !== '' && (f.lat < -90 || f.lat > 90)) || (f.lng !== '' && (f.lng < -180 || f.lng > 180))) { UI.toast('Coordenadas inválidas: latitud −90..90, longitud −180..180.', 'bad'); return false; }
        if ((f.lat === '') !== (f.lng === '')) { UI.toast('Ingrese latitud y longitud juntas.', 'bad'); return false; }
        if (f.lat !== '' && (f.lat < -18.4 || f.lat > 0 || f.lng < -81.4 || f.lng > -68.6)) UI.toast('Atención: las coordenadas están fuera del territorio peruano.', 'warn');
        if (DB.destinations.some(x => x !== d && x.parent === newParent && x.name.toLowerCase() === f.name.toLowerCase())) { UI.toast('Ya existe un destino con ese nombre en el mismo nivel.', 'bad'); return false; }
        const o = d || { id: nextId('D', DB.destinations, 2) }; const before = d ? d.name + ' / ' + (d.parent || 'raíz') : '';
        Object.assign(o, { name: f.name, type: f.type, parent: newParent, lat: f.lat === '' ? undefined : f.lat, lng: f.lng === '' ? undefined : f.lng, desc: f.desc }); if (!d) DB.destinations.push(o);
        Audit.log('Destino', o.id, d ? 'modificar' : 'crear', before, o.name + ' / ' + (o.parent || 'raíz'));
        Store.save(); UI.toast(d ? 'Destino actualizado.' : 'Destino ' + o.id + ' creado.'); App.go('#/catalogo/destinos/' + o.id);
      } });
  }

  App.register('catalogo/destinos', (el, params) => {
    ensure(); css();
    const sel = Q.destination(params[0]) || DB.destinations[0];
    const openSet = new Set(ancestors(sel.id));
    const tree = (pid) => { const kids = DB.destinations.filter(d => (d.parent || null) === pid); if (!kids.length) return ''; return '<ul>' + kids.map(d => { const n = DB.products.filter(p => inDest(p, d.id)).length; return '<li><a class="node' + (d.id === sel.id ? ' sel' : '') + '" href="#/catalogo/destinos/' + d.id + '">' + ic(DEST_ICON[d.type] || 'pin') + esc(d.name) + '<span class="xs faint">' + esc(d.type) + (n ? ' · ' + n : '') + '</span></a>' + tree(d.id) + '</li>'; }).join('') + '</ul>'; };
    const children = DB.destinations.filter(d => d.parent === sel.id);
    const prods = DB.products.filter(p => inDest(p, sel.id));
    const direct = DB.products.filter(p => p.destId === sel.id || p.secondary.includes(sel.id));
    const E = can(PERM.update);
    el.innerHTML = '<div class="page">' + UI.pageHeader({ title: 'Destinos', subtitle: 'Estructura geográfica jerárquica con coordenadas. Controles: jerarquía válida, sin referencias circulares y coordenadas válidas (PROC-011).', crumbs: [['Inicio', '#/dashboard'], ['Catálogo'], ['Destinos']], actions: '<button class="btn" id="ds-root"' + dis(PERM.update) + '>' + ic('globe') + 'Nuevo país</button><button class="btn primary" id="ds-child"' + dis(PERM.update) + '>' + ic('plus') + 'Nuevo destino hijo</button>' }) +
      readOnlyNote(PERM.update) +
      '<div class="grid g-1-2">' +
        UI.card('Jerarquía', '<div class="tree tree-box">' + tree(null) + '</div>', { sub: DB.destinations.length + ' destinos · País → Región → Departamento → Ciudad/Zona → Lugar → Atracción' }) +
        '<div class="stack" data-mdetail>' +
          UI.card(ic(DEST_ICON[sel.type] || 'pin') + ' ' + esc(sel.name), '<div class="crumbs" style="margin-bottom:10px">' + ancestors(sel.id).reverse().map(a => '<a href="#/catalogo/destinos/' + a + '">' + esc(Q.destName(a)) + '</a>').join('<span>›</span>') + '</div>' +
            UI.dl([['ID', '<span class="mono">' + sel.id + '</span>'], ['Tipo', esc(sel.type) + ' · nivel ' + DEST_LEVEL[sel.type]], ['Depende de', sel.parent ? destLink(sel.parent) : 'Nivel raíz'], ['Coordenadas', sel.lat != null ? '<span class="mono">' + fmtN(sel.lat, 4) + ', ' + fmtN(sel.lng, 4) + '</span> <span class="xs faint">WGS84 · geocodificación INT-05</span>' : '<span class="faint">Sin coordenadas</span>'], ['Descripción', esc(sel.desc || '—')], ['Subdestinos', children.length ? children.map(c => destLink(c.id)).join(', ') : '—'], ['Productos', prods.length + ' (directos: ' + direct.length + ')']]),
            { actions: '<button class="btn sm" id="ds-edit"' + dis(PERM.update) + '>' + ic('edit') + 'Editar</button><button class="btn sm ghost" id="ds-del"' + dis(PERM.update) + '>' + ic('trash') + 'Eliminar</button>' }) +
          UI.card('Productos del destino', prods.length ? tbl(['Producto', 'Tipo', 'Relación', ['Desde', 'num'], 'Estado'], prods.map(p => { const r = shownRate(p); return '<tr><td>' + prodLink(p.id) + '<div class="cell-sub mono">' + p.id + '</div></td><td>' + esc(p.type) + '</td><td class="small">' + (p.destId === sel.id ? 'Destino principal' : p.secondary.includes(sel.id) ? 'Secundario' : 'En subdestino: ' + esc(Q.destName(p.destId))) + '</td><td class="num">' + (r ? money(r.price, r.currency, 0) : '—') + '</td><td>' + UI.badge(p.status) + '</td></tr>'; }).join(''), 'compact') : UI.empty('Sin productos en este destino.', 'box'), { tight: true, sub: 'Incluye productos de los subdestinos' }) +
        '</div></div></div>';
    el.querySelector('#ds-child').onclick = guard(PERM.update, () => { if (DEST_LEVEL[sel.type] >= 6) { UI.toast('Un(a) ' + esc(sel.type) + ' es el último nivel de la jerarquía; no admite subdestinos.', 'bad'); return; } destModal(null, sel.id); });
    el.querySelector('#ds-root').onclick = guard(PERM.update, () => destModal(null, null));
    el.querySelector('#ds-edit').onclick = guard(PERM.update, () => destModal(sel));
    el.querySelector('#ds-del').onclick = guard(PERM.update, () => { if (children.length) { UI.toast('No se puede eliminar: tiene ' + children.length + ' subdestino(s).', 'bad'); return; } if (direct.length) { UI.toast('No se puede eliminar: ' + direct.length + ' producto(s) lo referencian (' + direct.map(p => p.id).join(', ') + ').', 'bad'); return; } UI.confirm({ title: 'Eliminar destino', message: '¿Eliminar <b>' + esc(sel.name) + '</b>?', danger: true, confirmLabel: 'Eliminar', onConfirm: () => { DB.destinations.splice(DB.destinations.indexOf(sel), 1); Audit.log('Destino', sel.id, 'eliminar', sel.name, ''); Store.save(); UI.toast('Destino eliminado.'); App.go('#/catalogo/destinos/' + (sel.parent || '')); } }); });
    void E; void openSet;
  });
})();
