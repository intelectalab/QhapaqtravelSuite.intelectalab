/* ==========================================================================
   v2.10 · Seguimiento, conversiones y visitas (spec 24)
   - #/canales/seguimiento        Etiquetas (GA4, GTM, Google Ads, Meta Pixel, TikTok, Clarity, LinkedIn), conversiones,
                                  scripts propios con revisión y registro de envíos del sitio de la agencia.
   - #/reportes/visitas           Vista general de visitas del sitio (conteo sin cookies + eventos con consentimiento).
   - #/admin/marketing-vitrina    Plataforma: visitas de la vitrina y el blog, por agencia, etiquetas y blog en Payload CMS.
   - window.KipuTags              Banner de cookies y carga de etiquetas según el consentimiento (vitrina y sitio).
   En producción: componente KipuTags de Next.js, API /api/v1/marketing/tracking/*, /api/v1/analytics/web/* y
   blog de la vitrina en Payload CMS 3 (ver 24-blog-payload-seo-seguimiento-visitas.md §13).
   ========================================================================== */
(function () {
  'use strict';
  const { esc, fmtN, nowStr, sum } = Util;
  const ic = (n) => UI.icon(n);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const KEYS = ['trackingProviders', 'trackingEvents', 'trackingTags', 'conversionMappings', 'conversionDispatches', 'webAnalytics', 'platformTracking', 'consentPolicy'];
  function ensure() {
    const S = window.SEED || {}; let ch = false;
    KEYS.forEach(k => { if (DB[k] == null && S[k] != null) { DB[k] = clone(S[k]); ch = true; } });
    if (ch) Store.save();
  }
  const PROV = (id) => (DB.trackingProviders || []).find(p => p.id === id) || { id, name: id, short: id, color: '#666' };
  const EV = (id) => (DB.trackingEvents || []).find(e => e.id === id) || { id, label: PEV[id] || id };
  const PEV = { reserva_vitrina: 'Reserva en la vitrina', registro_agencia: 'Registro de agencia', pase_iniciado: 'Pase de 30 días iniciado', plan_pagado: 'Plan pagado', addon_comprado: 'Add-on comprado', suscripcion_boletin: 'Suscripción al boletín', lectura_articulo: 'Lectura completa de artículo', clic_whatsapp: 'Clic en WhatsApp' };
  const CONS = { necesarias: 'Necesarias', analiticas: 'Analíticas', marketing: 'Marketing' };
  const ST = { borrador: ['Borrador', 'mute'], en_revision: ['En revisión', 'warn'], activo: ['Activa', 'ok'], pausado: ['Pausada', 'mute'], rechazado: ['Rechazada', 'bad'], enviado: ['Enviado', 'ok'], fallido: ['Fallido', 'bad'], sin_consentimiento: ['Sin consentimiento', 'warn'], duplicado: ['Deduplicado', 'info'], pendiente: ['Pendiente', 'warn'], published: ['Publicado', 'ok'], scheduled: ['Programado', 'info'], draft: ['Borrador', 'mute'] };
  const sb = (s) => { const x = ST[s] || [s, 'mute']; return '<span class="badge b-' + x[1] + '">' + esc(x[0]) + '</span>'; };
  const chip = (pid) => { const p = PROV(pid); return '<span class="tg-chip" style="--c:' + p.color + '">' + esc(p.short) + '</span>'; };
  const isSA = () => Auth.role === 'super_admin' && Auth.can('admin.tenant.manage');
  const PLAN_ORDER = ['Starter', 'Professional', 'Enterprise'];
  const planOk = (min) => (DB.tenant && PLAN_ORDER.indexOf(DB.tenant.plan) >= PLAN_ORDER.indexOf(min)) || (DB.addonsActive || []).includes('marketing_pro');
  const nextTag = () => 'TAG-' + String(Math.max(0, ...DB.trackingTags.map(t => +t.id.slice(4))) + 1).padStart(4, '0');
  const CSS = '<style>.tg-chip{display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:600;color:#fff;background:var(--c)}' +
    '.tg-mx td,.tg-mx th{text-align:center}.tg-mx td:first-child,.tg-mx th:first-child{text-align:left}.tg-cell{display:inline-flex;flex-direction:column;align-items:center;gap:2px;min-width:92px;padding:6px 8px;border:1px dashed var(--line);border-radius:8px;background:none;color:var(--fg-2);font:inherit;font-size:12px;cursor:pointer}' +
    '.tg-cell.on{border-style:solid;border-color:color-mix(in srgb,var(--ok) 45%,var(--line));background:color-mix(in srgb,var(--ok) 8%,transparent);color:var(--fg)}.tg-cell:disabled{cursor:default;opacity:.55}' +
    '.tg-code{font:12px/1.5 var(--mono,ui-monospace,monospace);background:var(--surface-2,rgba(0,0,0,.04));border:1px solid var(--line);border-radius:8px;padding:8px 10px;white-space:pre-wrap;word-break:break-all;max-height:140px;overflow:auto}' +
    '.tg-live{display:flex;align-items:baseline;gap:8px}.tg-live b{font-size:34px;line-height:1}.tg-dot{width:9px;height:9px;border-radius:50%;background:var(--ok);display:inline-block;box-shadow:0 0 0 0 var(--ok);animation:tgp 1.8s infinite}@keyframes tgp{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ok) 60%,transparent)}100%{box-shadow:0 0 0 10px transparent}}' +
    '.tg-per{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.tg-per a{padding:6px 12px;font-size:13px;color:var(--fg-2);text-decoration:none}.tg-per a.on{background:var(--accent);color:#fff}' +
    '.tg-checks{display:flex;flex-wrap:wrap;gap:4px}.tg-checks span{font-size:11px;padding:1px 7px;border-radius:10px;background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}.tg-checks span.no{background:color-mix(in srgb,var(--bad) 12%,transparent);color:var(--bad)}' +
    '.tg-2c{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1fr);gap:14px;margin-top:14px}@media (max-width:900px){.tg-2c{grid-template-columns:minmax(0,1fr)}}' +
    '@media (prefers-reduced-motion:reduce){.tg-dot{animation:none}}</style>';

  /* =========================================================================
     0) KipuTags: banner de cookies y etiquetas que cargan según el consentimiento
     ========================================================================= */
  const CK = 'kc_cookie_consent';
  const readC = () => { try { return JSON.parse(localStorage.getItem(CK) || 'null'); } catch (e) { return null; } };
  const writeC = (c) => { try { localStorage.setItem(CK, JSON.stringify(c)); } catch (e) { /* sin almacenamiento */ } };
  const BAN_CSS = '<style>.kt-ban{position:fixed;left:16px;right:16px;bottom:16px;z-index:60;max-width:760px;margin:0 auto;background:#fff;color:#0F172A;border:1px solid #E2E8F0;border-radius:1.5rem;box-shadow:0 12px 32px -4px rgba(15,23,42,.18);padding:18px 20px;font:14px/1.5 "Plus Jakarta Sans",system-ui,sans-serif}' +
    '.kt-ban h4{margin:0 0 4px;font-size:15px}.kt-ban p{margin:0 0 10px;color:#64748B}.kt-ban .kt-b{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.kt-ban button{border:1px solid #E2E8F0;background:#fff;color:#0F172A;border-radius:999px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer}' +
    '.kt-ban button.kt-p{background:var(--kt-p,#1D4ED8);border-color:var(--kt-p,#1D4ED8);color:#fff}.kt-ban label{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #E2E8F0}.kt-ban label small{display:block;color:#64748B}.kt-cfg{display:none;margin-bottom:10px}.kt-ban.cfg .kt-cfg{display:block}' +
    '.kt-pill{position:fixed;left:14px;bottom:14px;z-index:59;border:1px solid #E2E8F0;background:#fff;color:#0F172A;border-radius:999px;padding:6px 12px;font:12.5px/1.2 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.12);cursor:pointer}</style>';
  const KipuTags = {
    consent() { return readC(); },
    set(c) { const v = { v: (DB.consentPolicy || {}).version || 'COOK-2026.2', analiticas: !!c.analiticas, marketing: !!c.marketing, at: nowStr() }; writeC(v); return v; },
    tags(site) {
      ensure();
      const L = site === 'sitio' ? DB.trackingTags : (DB.platformTracking.tags || []).filter(t => t.site === site || t.site === 'ambos');
      const pay = /checkout|pagar/.test(location.hash);
      return L.filter(t => t.status === 'activo' && !(pay && (t.provider === 'script')));
    },
    loaded(site) { const c = readC() || {}; return KipuTags.tags(site).filter(t => t.consent === 'necesarias' || c[t.consent]).map(t => t.name); },
    blocked(site) { const c = readC() || {}; return KipuTags.tags(site).filter(t => !(t.consent === 'necesarias' || c[t.consent])).map(t => t.name); },
    banner(site) {
      const c = readC(); const n = KipuTags.loaded(site).length;
      const cats = (DB.consentPolicy || { categories: [] }).categories;
      return BAN_CSS + (c ? '<button class="kt-pill" id="kt-open" type="button" aria-label="Preferencias de cookies">Cookies · ' + n + ' etiqueta' + (n === 1 ? '' : 's') + ' activa' + (n === 1 ? '' : 's') + '</button>' :
        '<div class="kt-ban" id="kt-ban" role="dialog" aria-label="Cookies"><h4>Usamos cookies</h4><p>Las necesarias hacen funcionar el sitio. Con su permiso usamos también cookies analíticas y de marketing para medir visitas y campañas. Puede cambiar su elección cuando quiera desde el pie de página.</p>' +
        '<div class="kt-cfg">' + cats.map(([k, l, d]) => '<label><input type="checkbox" data-kt="' + k + '"' + (k === 'necesarias' ? ' checked disabled' : '') + '><span><b>' + esc(l) + '</b><small>' + esc(d) + '</small></span></label>').join('') + '</div>' +
        '<div class="kt-b"><button type="button" id="kt-cfg">Configurar</button><button type="button" id="kt-no">Rechazar</button><button type="button" class="kt-p" id="kt-yes">Aceptar todo</button></div></div>');
    },
    bind(el, site, rerender) {
      const q = (s) => el.querySelector(s);
      const done = (c, how) => { KipuTags.set(c); Audit.log('Consentimiento de cookies', site, how, '', (c.analiticas ? 'analíticas ' : '') + (c.marketing ? 'marketing' : '') || 'solo necesarias'); Store.save(); rerender ? rerender() : App.render(); };
      if (q('#kt-yes')) q('#kt-yes').onclick = () => done({ analiticas: true, marketing: true }, 'aceptar_todo');
      if (q('#kt-no')) q('#kt-no').onclick = () => done({ analiticas: false, marketing: false }, 'rechazar');
      if (q('#kt-cfg')) q('#kt-cfg').onclick = () => { const b = q('#kt-ban'); if (!b.classList.contains('cfg')) { b.classList.add('cfg'); q('#kt-cfg').textContent = 'Guardar selección'; return; } done({ analiticas: q('[data-kt="analiticas"]').checked, marketing: q('[data-kt="marketing"]').checked }, 'configurar'); };
      if (q('#kt-open')) q('#kt-open').onclick = () => { const c = readC() || {}; UI.modal({ title: 'Preferencias de cookies', sub: 'Política ' + esc(c.v || '') + ' · elegido ' + esc(c.at || ''), body: '<div class="col" style="gap:10px">' + (DB.consentPolicy.categories).map(([k, l, d]) => '<label class="check"><input type="checkbox" data-kt2="' + k + '"' + (k === 'necesarias' || c[k] ? ' checked' : '') + (k === 'necesarias' ? ' disabled' : '') + '> <b>' + esc(l) + '</b> <span class="xs faint">' + esc(d) + '</span></label>').join('') + '</div>' +
        '<div class="xs faint" style="margin-top:12px">Activas ahora: ' + (esc(KipuTags.loaded(site).join(', ')) || 'ninguna') + '. Bloqueadas por su elección: ' + (esc(KipuTags.blocked(site).join(', ')) || 'ninguna') + '.</div>',
        actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { done({ analiticas: m.querySelector('[data-kt2="analiticas"]').checked, marketing: m.querySelector('[data-kt2="marketing"]').checked }, 'cambiar'); } }] }); };
      // Conteo sin cookies (VIS-01): suma la visita al agregado del día, con o sin consentimiento
      try { const A = site === 'sitio' ? DB.webAnalytics : DB.platformTracking.sites[site === 'blog' ? 'blog' : 'vitrina']; const d = (A.days || A)[(A.days || A).length - 1]; if (d) { d.visits++; d.pageviews++; } } catch (e) { /* sin datos */ }
    }
  };
  window.KipuTags = KipuTags;

  /* =========================================================================
     1) #/canales/seguimiento  (agencia)
     ========================================================================= */
  App.register('canales/seguimiento', (el, params) => {
    ensure(); const T = DB.trackingTags; const D = DB.conversionDispatches;
    const act = T.filter(t => t.status === 'activo'); const fail = D.filter(d => d.status === 'fallido').length; const rev = T.filter(t => t.status === 'en_revision').length;
    el.innerHTML = CSS + '<div class="page">' + UI.pageHeader({ title: 'Seguimiento y píxeles', crumbs: [['Inicio', '#/dashboard'], ['Canales'], ['Seguimiento y píxeles']], subtitle: 'Conecte Google Analytics, Google Ads, Meta Pixel y otras herramientas sin tocar código. Todas cargan solo si el visitante acepta la categoría de cookies que corresponde, y nunca en la página de pago.', actions: '<a class="btn" href="#/reportes/visitas">' + ic('eye') + 'Ver visitas</a>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Etiquetas activas', value: act.length, sub: T.length + ' configuradas', icon: 'target', tone: 'accent' }) +
      UI.kpi({ label: 'Conversiones enviadas (24 h)', value: D.filter(d => d.status === 'enviado').length, sub: D.filter(d => d.status === 'duplicado').length + ' deduplicadas por event_id', icon: 'send', tone: 'ok' }) +
      UI.kpi({ label: 'Envíos con error', value: fail, sub: fail ? 'revise la pestaña Envíos' : 'todo en orden', icon: 'alert', tone: fail ? 'bad' : 'ok' }) +
      UI.kpi({ label: 'Scripts por revisar', value: rev, sub: 'necesitan aprobación', icon: 'shield', tone: rev ? 'sun' : 'info' }) + '</div><div id="tg-tabs" style="margin-top:14px"></div></div>';
    UI.tabs(el.querySelector('#tg-tabs'), [
      { id: 'etiquetas', label: 'Etiquetas', count: T.filter(t => t.provider !== 'script').length, render: tabTags },
      { id: 'conversiones', label: 'Conversiones', count: DB.conversionMappings.filter(m => m.active).length, render: tabConv },
      { id: 'scripts', label: 'Scripts propios', count: T.filter(t => t.provider === 'script').length, render: tabScripts },
      { id: 'envios', label: 'Envíos', count: D.length, render: tabSends }
    ], ['conversiones', 'scripts', 'envios'].includes(params[0]) ? params[0] : 'etiquetas');
  });
  const canM = () => Auth.can('marketing.tracking.manage');
  function tabTags(b) {
    const T = DB.trackingTags.filter(t => t.provider !== 'script');
    b.innerHTML = UI.card('Etiquetas del sitio', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Proveedor</th><th>Nombre e ID</th><th>Cookies</th><th>Páginas</th><th>Del servidor</th><th>Verificación</th><th>Estado</th><th></th></tr></thead><tbody>' +
      T.map(t => { const p = PROV(t.provider); return '<tr><td>' + chip(t.provider) + '</td><td><b>' + esc(t.name) + '</b><div class="xs faint mono">' + esc(t.mid) + '</div></td><td>' + esc(CONS[t.consent]) + '</td><td class="small mono">' + esc(t.pages) + (t.exclude ? '<div class="xs faint">sin ' + esc(t.exclude) + '</div>' : '') + '</td>' +
        '<td class="small">' + (p.server ? (t.config && (t.config.capi || t.config.server) ? UI.badge('ok', 'Sí') + '<div class="xs faint">' + esc(p.server) + '</div>' : '<span class="faint">No</span>') : '<span class="faint">—</span>') + '</td>' +
        '<td class="small">' + (t.verify === 'ok' ? '<span class="row" style="gap:4px;flex-wrap:nowrap;color:var(--ok)">' + ic('checkCircle') + 'Carga bien</span><div class="xs faint">' + esc(t.verifiedAt) + '</div>' : '<span class="faint">Sin verificar</span>') + '</td><td>' + sb(t.status) + '</td>' +
        '<td class="nowrap" style="text-align:right">' + (canM() ? '<button class="btn xs" data-ver="' + t.id + '">' + ic('refresh') + 'Verificar</button> <button class="btn xs" data-tg="' + t.id + '">' + (t.status === 'activo' ? 'Pausar' : 'Reanudar') + '</button> <button class="btn xs" data-ed="' + t.id + '">' + ic('edit') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>',
      { tight: true, actions: canM() ? '<button class="btn primary sm" id="tg-new">' + ic('plus') + 'Nueva etiqueta</button>' : '' }) +
      '<div class="grid g2" style="margin-top:14px">' + UI.card('Cómo se cargan', '<ol class="small" style="margin:0;padding-left:18px;line-height:1.6"><li>Antes de todo se carga <b>Consent Mode v2</b> de Google con todo denegado.</li><li>Si el visitante acepta <b>analíticas</b>, se activan GA4, GTM y Clarity; si acepta <b>marketing</b>, Google Ads, Meta, TikTok y LinkedIn.</li><li>El código de cada proveedor lo genera KipuControl con el ID; no se pega código del proveedor.</li><li>En <span class="mono">/checkout</span> y en el pago no carga ningún script propio ni de terceros no esencial (PCI DSS 6.4.3).</li></ol>') +
      UI.card('Vista del visitante', '<div class="small">Política de cookies <b>' + esc(DB.consentPolicy.version) + '</b>. El banner aparece en el sitio público y en la vitrina.</div><div class="row" style="gap:8px;margin-top:10px"><a class="btn sm" href="#/sitio" target="_blank">' + ic('eye') + 'Abrir el sitio</a><button class="btn sm" id="tg-reset">Volver a mostrar el banner</button></div><div class="xs faint" style="margin-top:8px">Las visitas se cuentan también sin cookies, de forma agregada y sin datos personales (ver Visitas del sitio).</div>') + '</div>';
    const q = (s) => b.querySelector(s);
    if (q('#tg-new')) q('#tg-new').onclick = () => tagModal(null, b);
    q('#tg-reset').onclick = () => { try { localStorage.removeItem(CK); } catch (e) { /* */ } UI.toast('Listo: el banner de cookies se mostrará otra vez al abrir el sitio.'); };
    b.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => tagModal(DB.trackingTags.find(t => t.id === x.dataset.ed), b));
    b.querySelectorAll('[data-tg]').forEach(x => x.onclick = () => { const t = DB.trackingTags.find(z => z.id === x.dataset.tg); const bf = t.status; t.status = t.status === 'activo' ? 'pausado' : 'activo'; Store.save(); Audit.log('Etiqueta', t.id, t.status === 'activo' ? 'reanudar' : 'pausar', bf, t.status); UI.toast(t.name + (t.status === 'activo' ? ' activa otra vez.' : ' pausada. Deja de cargar en menos de 1 minuto.')); App.render(); });
    b.querySelectorAll('[data-ver]').forEach(x => x.onclick = () => { const t = DB.trackingTags.find(z => z.id === x.dataset.ver); if (t.status !== 'activo') { UI.toast('La etiqueta está pausada: reanúdela para verificarla.', 'bad'); return; } x.disabled = true; x.innerHTML = 'Verificando…'; setTimeout(() => { t.verify = 'ok'; t.verifiedAt = nowStr(); Store.save(); Audit.log('Etiqueta', t.id, 'verificar', '', 'ok'); UI.toast('Verificada: ' + PROV(t.provider).short + ' cargó en / con cookies aceptadas y envió page_view.'); App.render(); }, 450); });
  }
  function tagModal(t, b) {
    const isNew = !t; const P = DB.trackingProviders.filter(p => p.id !== 'script');
    const cur = t ? t.provider : 'ga4';
    const body = () => { const p = PROV(UI.formData(m0).t_p || cur); return p; };
    let m0;
    UI.modal({ title: isNew ? 'Nueva etiqueta' : 'Editar ' + esc(t.name), body: UI.form([
      { id: 't_p', label: 'Proveedor', type: 'select', options: P.map(p => [p.id, p.name + (planOk(p.minPlan) ? '' : ' · desde ' + p.minPlan)]), value: cur, col: 12, disabled: !isNew },
      { id: 't_n', label: 'Nombre', value: t ? t.name : '', required: true, col: 6, placeholder: 'Ej.: Google Ads · campañas Cusco' },
      { id: 't_i', label: PROV(cur).idLabel, value: t ? t.mid : '', required: true, col: 6, placeholder: PROV(cur).placeholder },
      { id: 't_pg', label: 'Cargar en', value: t ? t.pages : '/*', col: 6, hint: 'Rutas separadas por coma. /* = todo el sitio' },
      { id: 't_ex', label: 'Excepto', value: t ? t.exclude : '', col: 6, placeholder: '/cuenta/*', hint: 'El pago siempre queda excluido' },
      { id: 't_s', label: 'Enviar también conversiones desde el servidor', type: 'switch', value: t ? !!(t.config && (t.config.capi || t.config.server)) : false, col: 12, hint: 'Meta Conversions API / Google Ads API / GA4 Measurement Protocol. No se pierden compras por bloqueadores y se deduplican con event_id.' },
      { id: 't_k', label: 'Token o credencial del proveedor (se guarda en el vault)', type: 'password', value: '', col: 12, placeholder: t && t.config && t.config.secret ? 'Guardado · deje vacío para no cambiarlo' : 'Pegue el token de acceso' }
    ]) + '<div class="xs faint" id="t-hint" style="margin-top:8px"></div>', onOpen: (m) => {
      m0 = m; const upd = () => { const p = body(); m.querySelector('label[for="t_i"]').innerHTML = esc(p.idLabel) + ' <span class="req">*</span>'; m.querySelector('#t_i').placeholder = p.placeholder; m.querySelector('#t-hint').innerHTML = 'Cookies: <b>' + esc(CONS[p.consent]) + '</b>' + (p.server ? ' · servidor: ' + esc(p.server) : ' · sin envío del servidor') + (planOk(p.minPlan) ? '' : ' · <span style="color:var(--bad)">requiere ' + p.minPlan + ' o el add-on Marketing Pro</span>'); const sw = m.querySelector('#t_s'); sw.disabled = !p.server; if (!p.server) sw.checked = false; };
      m.querySelector('#t_p').onchange = upd; upd();
    }, actions: [{ label: 'Cancelar' }, { label: isNew ? 'Crear y activar' : 'Guardar', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const f = UI.formData(m); const p = PROV(isNew ? f.t_p : cur); const mid = String(f.t_i).trim();
      if (!planOk(p.minPlan)) { UI.toast('TRACKING_PLAN_REQUIRED: ' + p.name + ' está en ' + p.minPlan + ' o con el add-on Marketing Pro.', 'bad'); return false; }
      if (!new RegExp(p.re).test(mid)) { UI.toast('TAG_ID_INVALID: el ' + p.idLabel.toLowerCase() + ' debe tener el formato ' + p.placeholder + '.', 'bad'); return false; }
      if (DB.trackingTags.some(x => x !== t && x.provider === p.id && x.mid === mid && x.status !== 'rechazado')) { UI.toast('TAG_DUPLICATE: ese ID ya está configurado.', 'bad'); return false; }
      if (f.t_s && !f.t_k && !(t && t.config && t.config.secret)) { UI.toast('Para enviar desde el servidor pegue el token del proveedor.', 'bad'); return false; }
      const cfg = Object.assign({}, t ? t.config : {}); if (p.id === 'meta_pixel') cfg.capi = !!f.t_s; else cfg.server = !!f.t_s; if (p.id === 'google_ads') cfg.enhanced = true; if (f.t_k) cfg.secret = 'vault://tenant/' + DB.tenant.id + '/' + p.id;
      const before = t ? t.mid + ' ' + t.pages : '';
      if (isNew) { t = { id: nextTag(), provider: p.id, consent: p.consent, placement: 'head', status: 'activo', createdBy: Auth.user.id, approvedBy: null, verify: null, verifiedAt: null }; DB.trackingTags.push(t); }
      Object.assign(t, { name: f.t_n, mid, pages: f.t_pg || '/*', exclude: f.t_ex || '', config: cfg });
      Store.save(); Audit.log('Etiqueta', t.id, isNew ? 'crear' : 'editar', before, t.mid + ' ' + t.pages); UI.toast(isNew ? t.name + ' creada y activa. Use «Verificar» para comprobar que carga.' : 'Cambios guardados.'); App.render();
    } }] });
  }
  function tabConv(b) {
    const tags = DB.trackingTags.filter(t => t.provider !== 'script' && t.provider !== 'gtm' && t.status !== 'rechazado'); const M = DB.conversionMappings;
    b.innerHTML = UI.card('Qué se envía a cada herramienta', '<div class="tbl-wrap"><table class="tbl tg-mx"><thead><tr><th>Evento del sitio</th>' + tags.map(t => '<th>' + chip(t.provider) + '<div class="xs faint" style="margin-top:3px">' + esc(t.name) + '</div></th>').join('') + '</tr></thead><tbody>' +
      DB.trackingEvents.map(e => '<tr><td><b>' + esc(e.label) + '</b><div class="xs faint mono">' + esc(e.ga4) + (e.value ? ' · con valor' : '') + '</div></td>' + tags.map(t => { const m = M.find(x => x.tagId === t.id && x.event === e.id && x.active); return '<td><button class="tg-cell' + (m ? ' on' : '') + '" data-c="' + t.id + '|' + e.id + '"' + (canM() ? '' : ' disabled') + '>' + (m ? '<b>' + esc(m.providerEvent) + '</b><span class="xs faint">' + (m.server ? 'navegador + servidor' : 'navegador') + (m.value ? ' · valor' : '') + '</span>' : '<span>+ Enviar</span>') + '</button></td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>', { tight: true, sub: 'Haga clic en una celda para configurarla.' }) +
      UI.alert('info', 'Cada conversión lleva un event_id único. Si se envía por el navegador y por el servidor, Meta, TikTok y Google la cuentan una sola vez. La compra se reporta cuando el pago está confirmado; los pagos pendientes (Yape o transferencia) van como evento aparte. Correo y teléfono solo viajan cifrados con SHA-256.');
    b.querySelectorAll('[data-c]').forEach(x => x.onclick = () => {
      const [tid, ev] = x.dataset.c.split('|'); const t = DB.trackingTags.find(z => z.id === tid); const p = PROV(t.provider); const e = EV(ev); let m = M.find(z => z.tagId === tid && z.event === ev);
      const def = { ga4: e.ga4, meta_pixel: { compra: 'Purchase', compra_pendiente: 'AddPaymentInfo', inicio_pago: 'InitiateCheckout', registro_cliente: 'CompleteRegistration', suscripcion_boletin: 'Subscribe', clic_whatsapp: 'Contact' }[ev] || 'Lead', google_ads: 'conversion', tiktok: { compra: 'CompletePayment', inicio_pago: 'InitiateCheckout' }[ev] || 'SubmitForm', clarity: e.ga4, linkedin: 'conversion' }[p.id] || e.ga4;
      UI.modal({ title: e.label + ' → ' + p.name, body: UI.form([
        { id: 'c_e', label: 'Nombre del evento en ' + p.short, value: m ? m.providerEvent : def, required: true, col: 6 },
        { id: 'c_l', label: 'Etiqueta de conversión', value: m ? m.label || '' : '', col: 6, placeholder: p.id === 'google_ads' ? 'AbC-dEf_123' : 'No aplica', disabled: p.id !== 'google_ads', hint: p.id === 'google_ads' ? 'Google Ads › Objetivos › Conversiones' : '' },
        { id: 'c_v', label: 'Enviar valor y moneda', type: 'switch', value: m ? m.value : e.value, col: 6 },
        { id: 'c_s', label: 'También desde el servidor', type: 'switch', value: m ? m.server : !!(t.config && (t.config.capi || t.config.server)), col: 6, disabled: !p.server || !(t.config && (t.config.capi || t.config.server)), hint: p.server ? '' : 'Este proveedor no recibe envíos del servidor' }
      ]), actions: (m ? [{ label: 'Quitar', cls: 'danger', onClick: () => { m.active = false; Store.save(); Audit.log('Conversión', m.id, 'quitar', m.providerEvent, ''); App.render(); } }] : []).concat([{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (md) => {
        if (!UI.validate(md)) return false; const f = UI.formData(md);
        if (p.id === 'google_ads' && !/^[A-Za-z0-9_-]{6,60}$/.test(f.c_l || '')) { UI.toast('Google Ads necesita la etiqueta de la conversión.', 'bad'); return false; }
        if (!m) { m = { id: 'CVM-' + String(M.length + 1).padStart(3, '0'), tagId: tid, event: ev }; M.push(m); }
        Object.assign(m, { providerEvent: f.c_e, label: p.id === 'google_ads' ? f.c_l : null, value: !!f.c_v, server: !!f.c_s, active: true }); Store.save(); Audit.log('Conversión', m.id, 'configurar', '', ev + ' → ' + p.short + ' ' + f.c_e); UI.toast('Listo: «' + e.label + '» se envía a ' + p.short + '.'); App.render();
      } }]) });
    });
  }
  const tenantAdmins = () => DB.users.filter(u => u.role === 'tenant_admin' && u.status === 'activo');
  function tabScripts(b) {
    const S = DB.trackingTags.filter(t => t.provider === 'script'); const canA = Auth.can('marketing.tracking.approve');
    b.innerHTML = (S.length ? S.map(t => { const self = t.createdBy === Auth.user.id && tenantAdmins().length >= 2;
      return UI.card(esc(t.name), '<div class="grid g2" style="gap:12px"><div><div class="xs faint">Fuente</div><div class="tg-code">' + esc(t.src || t.body || '') + '</div>' + (t.sri ? '<div class="xs faint" style="margin-top:6px">SRI <span class="mono">' + esc(t.sri.slice(0, 32)) + '…</span></div>' : '') + '</div>' +
        '<div class="small" style="line-height:1.7"><div>Cookies: <b>' + esc(CONS[t.consent]) + '</b> · posición <span class="mono">' + esc(t.placement) + '</span></div><div>Páginas: <span class="mono">' + esc(t.pages) + '</span> · nunca en <span class="mono">/checkout/*</span> ' + ic('lock') + '</div><div>Dominios en la CSP: ' + (t.csp || []).map(d => '<span class="mono">' + esc(d) + '</span>').join(', ') + '</div>' +
        '<div>Creado por ' + esc(Q.userName(t.createdBy)) + (t.submittedAt ? ' · enviado ' + esc(t.submittedAt) : '') + '</div>' + (t.approvedBy ? '<div>Aprobado por ' + esc(Q.userName(t.approvedBy)) + ' · ' + esc(t.approvedAt || '') + '</div>' : '') + (t.rejectReason ? '<div style="color:var(--bad)">Rechazo: ' + esc(t.rejectReason) + '</div>' : '') + '</div></div>',
        { sub: 'Script externo', actions: sb(t.status) + (t.status === 'en_revision' && canA ? (self ? ' <button class="btn xs" disabled title="403 SCRIPT_SELF_APPROVAL">Lo aprueba otra persona</button>' : ' <button class="btn xs" data-rj="' + t.id + '">Rechazar</button> <button class="btn xs primary" data-ap="' + t.id + '">' + ic('check') + 'Aprobar</button>') : '') + (['activo', 'pausado'].includes(t.status) && canM() ? ' <button class="btn xs" data-ps="' + t.id + '">' + (t.status === 'activo' ? 'Pausar' : 'Reanudar') + '</button>' : '') }); }).join('<div style="height:12px"></div>') : UI.empty('Sin scripts propios.', 'shield')) +
      '<div class="row between" style="margin-top:14px;gap:10px;flex-wrap:wrap">' + UI.alert('warn', 'Use un script propio solo cuando la herramienta no esté en la lista de etiquetas. Lo revisa una persona con permiso de aprobación, debe declarar sus dominios y, si viene de otro servidor, el hash SRI.') + (canM() ? '<button class="btn primary" id="sc-new">' + ic('plus') + 'Nuevo script</button>' : '') + '</div>';
    const q = (s) => b.querySelector(s);
    if (q('#sc-new')) q('#sc-new').onclick = () => scriptModal();
    b.querySelectorAll('[data-ap]').forEach(x => x.onclick = () => { const t = DB.trackingTags.find(z => z.id === x.dataset.ap); if (t.createdBy === Auth.user.id && tenantAdmins().length >= 2) { UI.toast('SCRIPT_SELF_APPROVAL: debe aprobarlo otra persona.', 'bad'); return; } t.status = 'activo'; t.approvedBy = Auth.user.id; t.approvedAt = nowStr(); t.verify = 'ok'; t.verifiedAt = nowStr(); Store.save(); Audit.log('Script propio', t.id, 'aprobar', 'en_revision', 'activo'); Notify.push('script.aprobado', 'Email', t.createdBy, 'Script aprobado: ' + t.name); UI.toast('Aprobado. El script carga en el sitio en menos de 1 minuto.'); App.render(); });
    b.querySelectorAll('[data-rj]').forEach(x => x.onclick = () => UI.modal({ title: 'Rechazar script', body: UI.form([{ id: 'r_m', label: 'Motivo (mínimo 10 caracteres)', type: 'textarea', required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Rechazar', cls: 'danger', onClick: (m) => { const r = UI.formData(m).r_m; if (String(r).length < 10) { UI.toast('Escriba un motivo de al menos 10 caracteres.', 'bad'); return false; } const t = DB.trackingTags.find(z => z.id === x.dataset.rj); t.status = 'rechazado'; t.rejectReason = r; Store.save(); Audit.log('Script propio', t.id, 'rechazar', 'en_revision', r); App.render(); } }] }));
    b.querySelectorAll('[data-ps]').forEach(x => x.onclick = () => { const t = DB.trackingTags.find(z => z.id === x.dataset.ps); const bf = t.status; t.status = t.status === 'activo' ? 'pausado' : 'activo'; Store.save(); Audit.log('Script propio', t.id, 'pausar', bf, t.status); App.render(); });
  }
  function scriptModal() {
    UI.modal({ title: 'Nuevo script propio', size: 'lg', body: UI.form([
      { id: 's_n', label: 'Nombre', required: true, col: 6, placeholder: 'Ej.: Chat de ventas de proveedor X' },
      { id: 's_c', label: 'Cookies que usa', type: 'select', options: [['marketing', 'Marketing'], ['analiticas', 'Analíticas'], ['necesarias', 'Necesarias (justifique)']], col: 6 },
      { id: 's_src', label: 'URL del script (https)', col: 12, placeholder: 'https://cdn.proveedor.com/widget.js' },
      { id: 's_sri', label: 'Hash SRI', col: 12, placeholder: 'sha384-…', hint: 'Obligatorio si el script viene de otro servidor. El proveedor lo publica o se calcula con openssl dgst -sha384 -binary | openssl base64 -A' },
      { id: 's_body', label: 'O código en línea (máx. 50 KB)', type: 'textarea', rows: 4, col: 12, placeholder: 'window.dataLayer = window.dataLayer || []; …' },
      { id: 's_csp', label: 'Dominios que necesita (CSP)', col: 6, placeholder: 'cdn.proveedor.com, api.proveedor.com', required: true },
      { id: 's_pl', label: 'Posición', type: 'select', options: [['body_fin', 'Final del body'], ['head', 'Head'], ['body_inicio', 'Inicio del body']], col: 3 },
      { id: 's_pg', label: 'Páginas', value: '/*', col: 3 },
      { id: 's_x', label: 'Nunca cargar en el pago (/checkout/*)', type: 'checkbox', value: true, disabled: true, col: 12 }
    ]), actions: [{ label: 'Cancelar' }, { label: 'Enviar a revisión', cls: 'primary', onClick: (m) => {
      if (!UI.validate(m)) return false; const f = UI.formData(m);
      if (!f.s_src && !f.s_body) { UI.toast('Indique la URL del script o el código.', 'bad'); return false; }
      if (f.s_src && !/^https:\/\//.test(f.s_src)) { UI.toast('La URL del script debe empezar con https://.', 'bad'); return false; }
      if (f.s_src && !/^sha(256|384|512)-[A-Za-z0-9+/=]{20,}$/.test(f.s_sri || '')) { UI.toast('SCRIPT_SRI_REQUIRED: un script externo necesita su hash SRI (sha384-…).', 'bad'); return false; }
      if (f.s_body && /\b(eval|document\.write|new\s+Function)\b|card|cvv|tarjeta/i.test(f.s_body)) { UI.toast('El código usa eval, document.write o new Function, o lee datos de pago. No se permite.', 'bad'); return false; }
      if (f.s_body && f.s_body.length > 51200) { UI.toast('El código supera 50 KB.', 'bad'); return false; }
      const t = { id: nextTag(), provider: 'script', name: f.s_n, src: f.s_src || null, body: f.s_body || null, sri: f.s_sri || null, csp: String(f.s_csp).split(',').map(s => s.trim()).filter(Boolean), consent: f.s_c, placement: f.s_pl, pages: f.s_pg || '/*', exclude: '/checkout/*', status: 'en_revision', createdBy: Auth.user.id, approvedBy: null, verify: null, verifiedAt: null, config: {}, submittedAt: nowStr() };
      DB.trackingTags.push(t); Store.save(); Audit.log('Script propio', t.id, 'enviar_revision', '', t.name);
      DB.users.filter(u => (DB.rolePerms[u.role] || []).includes('marketing.tracking.approve') && u.id !== Auth.user.id).forEach(u => Notify.push('script.revision', 'Email', u.id, 'Script por revisar: ' + t.name));
      UI.toast('Enviado a revisión. Lo aprueba una persona con permiso de aprobación.'); App.render();
    } }] });
  }
  function tabSends(b, flt) {
    const D = DB.conversionDispatches; const f = flt || '';
    const rows = D.filter(d => !f || d.status === f);
    const mp = (id) => DB.conversionMappings.find(m => m.id === id) || {}; const tg = (id) => DB.trackingTags.find(t => t.id === mp(id).tagId) || {};
    b.innerHTML = UI.card('Envíos de conversiones', '<div class="row" style="gap:8px;margin-bottom:10px"><select class="input sm" id="sd-f" style="width:auto" aria-label="Estado"><option value="">Todos los estados</option>' + ['enviado', 'fallido', 'sin_consentimiento', 'duplicado'].map(s => '<option value="' + s + '"' + (s === f ? ' selected' : '') + '>' + ST[s][0] + '</option>').join('') + '</select><span class="xs faint">Se guardan 90 días.</span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Evento</th><th>Destino</th><th>Canal</th><th class="num">Valor</th><th>Referencia</th><th>Estado</th><th></th></tr></thead><tbody>' +
      rows.map(d => '<tr><td class="small nowrap">' + esc(d.at) + '</td><td>' + esc(EV(d.event).label) + '</td><td>' + chip(tg(d.mappingId).provider) + ' <span class="xs faint">' + esc(mp(d.mappingId).providerEvent || '') + '</span></td><td class="small">' + esc(d.channel) + '</td><td class="num">' + (d.value != null ? esc(d.currency) + ' ' + fmtN(d.value, 0) : '—') + '</td><td class="mono small">' + esc(d.ref) + '</td><td>' + sb(d.status) + (d.error || d.note ? '<div class="xs faint" style="max-width:260px">' + esc(d.error || d.note) + '</div>' : '') + '</td>' +
        '<td style="text-align:right">' + (d.status === 'fallido' && canM() ? '<button class="btn xs" data-rt="' + d.id + '">' + ic('refresh') + 'Reintentar</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>', { tight: true });
    b.querySelector('#sd-f').onchange = (e) => tabSends(b, e.target.value);
    b.querySelectorAll('[data-rt]').forEach(x => x.onclick = () => { const d = D.find(z => String(z.id) === x.dataset.rt); d.attempts++; d.status = 'enviado'; d.http = 200; d.note = 'Reintento manual: aceptado por el proveedor.'; delete d.error; Store.save(); Audit.log('Conversión', String(d.id), 'reintentar', 'fallido', 'enviado'); UI.toast('Reenviado y aceptado por el proveedor.'); tabSends(b, f); });
  }

  /* =========================================================================
     2) Vista general de visitas (agencia y plataforma)
     ========================================================================= */
  function agg(days) { const s = (k) => sum(days, k); const v = s('visits'); return { visits: v, visitors: s('visitors'), pageviews: s('pageviews'), bounce: v ? 100 * s('bounces') / v : 0, time: v ? s('engaged') / v : 0, conv: s('conv'), rev: s('rev'), cr: v ? 100 * s('conv') / v : 0, ppv: v ? s('pageviews') / v : 0 }; }
  const dlt = (a, b) => { if (!b) return { delta: '', deltaDir: 'up' }; const p = 100 * (a - b) / b; return { delta: Math.abs(p).toFixed(1) + ' %', deltaDir: p >= 0 ? 'up' : 'down' }; };
  const mmss = (s) => Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';
  const dm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  function overview(days, n, opts) {
    const cur = days.slice(-n), prev = days.slice(-2 * n, -n); const A = agg(cur), B = agg(prev);
    const step = n > 14 ? 5 : 1; const labels = cur.map((d, i) => (i % step === 0 || i === cur.length - 1) ? dm(d.d) : '');
    return '<div class="grid g4">' + UI.kpi(Object.assign({ label: 'Visitas', value: fmtN(A.visits, 0), sub: 'vs. ' + n + ' días anteriores', icon: 'eye', tone: 'accent' }, dlt(A.visits, B.visits))) +
      UI.kpi(Object.assign({ label: 'Visitantes', value: fmtN(A.visitors, 0), sub: fmtN(A.ppv, 1) + ' páginas por visita', icon: 'users', tone: 'info' }, dlt(A.visitors, B.visitors))) +
      UI.kpi(Object.assign({ label: opts.convLabel || 'Conversiones', value: fmtN(A.conv, 0), sub: A.cr.toFixed(2) + ' % de las visitas', icon: 'target', tone: 'ok' }, dlt(A.conv, B.conv))) +
      UI.kpi(Object.assign({ label: opts.noRev ? 'Rebote' : 'Ingresos atribuidos', value: opts.noRev ? A.bounce.toFixed(0) + ' %' : 'S/ ' + fmtN(A.rev, 0), sub: opts.noRev ? mmss(A.time) + ' por visita' : 'rebote ' + A.bounce.toFixed(0) + ' %', icon: opts.noRev ? 'refresh' : 'coins', tone: 'violet' }, opts.noRev ? {} : dlt(A.rev, B.rev))) + '</div>' +
      '<div class="tg-2c">' + UI.card('Visitas por día', UI.chart.line({ labels, series: [{ name: 'Visitas', values: cur.map(d => d.visits) }, { name: 'Visitantes', values: cur.map(d => d.visitors), color: 'var(--info)' }], height: 230 }), { sub: 'Últimos ' + n + ' días · ' + mmss(A.time) + ' por visita' }) +
      UI.card('En vivo', '<div class="tg-live"><span class="tg-dot"></span><b>' + (opts.live ? opts.live.now : '—') + '</b><span class="small muted">visitantes en los últimos 30 min</span></div>' + (opts.live ? '<div class="col" style="gap:6px;margin-top:12px">' + opts.live.pages.map(([p, v]) => '<div class="row between small" style="flex-wrap:nowrap"><span class="mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p) + '</span><b>' + v + '</b></div>').join('') + '</div>' : ''), { sub: 'Se actualiza cada 30 s' }) + '</div>';
  }
  const srcTable = (S, total) => '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fuente / medio</th><th>Campaña</th><th class="num">Visitas</th><th class="num">%</th></tr></thead><tbody>' + S.map(([s, m, c, p]) => '<tr><td><b>' + esc(s) + '</b> <span class="faint">/ ' + esc(m) + '</span></td><td class="small mono">' + esc(c || '—') + '</td><td class="num">' + fmtN(Math.round(total * p / 100), 0) + '</td><td class="num">' + p + ' %</td></tr>').join('') + '</tbody></table></div>';
  App.register('reportes/visitas', (el, params) => {
    ensure(); const W = DB.webAnalytics; const n = params[0] === '7' ? 7 : 30; const cur = W.days.slice(-n); const A = agg(cur);
    const ga = DB.trackingTags.find(t => t.provider === 'ga4' && t.status === 'activo');
    el.innerHTML = CSS + '<div class="page">' + UI.pageHeader({ title: 'Visitas del sitio', crumbs: [['Inicio', '#/dashboard'], ['Inteligencia'], ['Visitas del sitio']], subtitle: 'Cuántas personas visitan su sitio, de dónde llegan, qué miran y cuántas reservan. Las visitas se cuentan sin cookies y sin datos personales, así que incluyen a quienes rechazan las cookies.',
      actions: '<span class="tg-per">' + [['7', '7 días'], ['30', '30 días']].map(([k, l]) => '<a href="#/reportes/visitas/' + k + '" class="' + (String(n) === k ? 'on' : '') + '">' + l + '</a>').join('') + '</span><button class="btn" id="vs-csv">' + ic('download') + 'Exportar CSV</button>' }) +
      overview(W.days, n, { live: W.live }) +
      '<div class="grid g2" style="margin-top:14px">' + UI.card('Páginas más vistas', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Página</th><th class="num">Vistas</th><th class="num">%</th></tr></thead><tbody>' + W.pages.map(([p, l, s]) => '<tr><td><b>' + esc(l) + '</b><div class="xs faint mono">' + esc(p) + '</div></td><td class="num">' + fmtN(Math.round(A.pageviews * s / 100), 0) + '</td><td class="num">' + s + ' %</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      UI.card('Fuentes y campañas', srcTable(W.sources, A.visits), { tight: true, sub: 'UTM, gclid (Google Ads), fbclid (Meta) o referente' }) + '</div>' +
      '<div class="grid g3" style="margin-top:14px">' + UI.card('Dispositivos', UI.chart.donut({ items: W.devices.map(([k, v]) => ({ label: { movil: 'Móvil', escritorio: 'Escritorio', tablet: 'Tablet' }[k], value: v, display: v + ' %' })), size: 130, center: W.devices[0][1] + ' %', sub: 'móvil' })) +
      UI.card('Países', UI.chart.hbars({ items: W.countries.slice(0, 7).map(([c, l, v]) => ({ label: l, value: v, display: v + ' %' })) })) +
      UI.card('Conversiones por evento', UI.chart.hbars({ items: W.byEvent.map(([e, v]) => ({ label: EV(e).label, value: Math.round(v * A.conv / sum(W.byEvent, x => x[1])) })), color: 'var(--ok)' }), { sub: 'Últimos ' + n + ' días' }) + '</div>' +
      UI.alert('info', 'Cómo se cuenta: una visita termina tras 30 minutos sin actividad; se excluyen bots y su propio equipo. ' + (ga ? 'Google Analytics (' + esc(ga.mid) + ') muestra cerca del ' + Math.round(W.ga4Compare * 100) + ' % de estas visitas porque solo mide a quien acepta cookies analíticas.' : 'Si conecta Google Analytics verá aquí la comparación.')) + '</div>';
    el.querySelector('#vs-csv').onclick = () => {
      const csv = ['fecha;visitas;visitantes;paginas_vistas;rebotes;conversiones;ingresos'].concat(cur.map(d => [d.d, d.visits, d.visitors, d.pageviews, d.bounces, d.conv, d.rev].join(';'))).join('\n');
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'visitas-' + cur[0].d + '-a-' + cur[cur.length - 1].d + '.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* sin descarga */ }
      Audit.log('Visitas', 'export', 'exportar', '', cur.length + ' días'); UI.toast('CSV de ' + cur.length + ' días descargado.');
    };
  });

  /* =========================================================================
     3) #/admin/marketing-vitrina  (plataforma)
     ========================================================================= */
  App.register('admin/marketing-vitrina', (el, params) => {
    ensure(); if (!isSA()) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Solo el Super Admin SaaS administra el marketing de la vitrina.') + '</div>'; return; }
    const P = DB.platformTracking; const v30 = agg(P.sites.vitrina.slice(-30)), b30 = agg(P.sites.blog.slice(-30)); const SC = DB.showcase;
    el.innerHTML = CSS + '<div class="page">' + UI.pageHeader({ title: 'Marketing de la vitrina', crumbs: [['Plataforma', '#/admin/tenants'], ['Marketing de la vitrina']], subtitle: 'Visitas, campañas y conversiones de ' + esc(SC.domain) + ' y su blog en Payload CMS. Las etiquetas se activan con la aprobación de otro Super Admin.', actions: '<a class="btn" href="#/web" target="_blank">' + ic('eye') + 'Abrir landing</a><a class="btn" href="#/vitrina" target="_blank">' + ic('eye') + 'Abrir vitrina</a>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Visitas vitrina (30 d)', value: fmtN(v30.visits, 0), sub: fmtN(v30.visitors, 0) + ' visitantes', icon: 'globe', tone: 'accent' }) + UI.kpi({ label: 'Visitas blog (30 d)', value: fmtN(b30.visits, 0), sub: mmss(b30.time) + ' por visita', icon: 'file', tone: 'info' }) +
      UI.kpi({ label: 'Reservas en la vitrina', value: fmtN(sum(P.agencies, a => a[2]), 0), sub: (100 * sum(P.agencies, a => a[2]) / Math.max(1, sum(P.agencies, a => a[1]))).toFixed(1) + ' % de las visitas a tours', icon: 'ticket', tone: 'ok' }) +
      UI.kpi({ label: 'Etiquetas activas', value: P.tags.filter(t => t.status === 'activo').length, sub: P.tags.filter(t => t.status === 'en_revision').length + ' por aprobar', icon: 'target', tone: 'violet' }) + '</div><div id="mv-tabs" style="margin-top:14px"></div></div>';
    UI.tabs(el.querySelector('#mv-tabs'), [
      { id: 'visitas', label: 'Visitas', render: (b) => pVisits(b, 'vitrina') },
      { id: 'agencias', label: 'Por agencia', count: P.agencies.length, render: pAgencies },
      { id: 'etiquetas', label: 'Etiquetas y conversiones', count: P.tags.length, render: pTags },
      { id: 'blog', label: 'Blog en Payload', count: P.payload.posts.length, render: pBlog },
      { id: 'landing', label: 'Landing KipuControl', count: ((DB.landing && DB.landing.comments) || []).filter(c => c.status === 'pendiente').length || undefined, render: b => window.KipuLanding ? window.KipuLanding.admin(b) : (b.innerHTML = UI.empty('Landing no cargada')) }
    ], ['agencias', 'etiquetas', 'blog', 'landing'].includes(params[0]) ? params[0] : 'visitas');
  });
  function pVisits(b, site) {
    const P = DB.platformTracking; const days = P.sites[site]; const A = agg(days.slice(-30));
    b.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><span class="tg-per">' + [['vitrina', 'Vitrina'], ['blog', 'Blog']].map(([k, l]) => '<a href="javascript:void 0" data-s="' + k + '" class="' + (k === site ? 'on' : '') + '">' + l + '</a>').join('') + '</span></div>' +
      overview(days, 30, { convLabel: site === 'blog' ? 'Clics a tours' : 'Reservas y registros', noRev: true, live: { now: site === 'blog' ? 23 : 41, pages: site === 'blog' ? [['/blog/free-tours-en-lima-guia', 9], ['/blog/cuanta-propina-free-tour-peru', 6], ['/blog/que-comer-en-lima-en-un-dia', 5]] : [['/', 14], ['/lima', 11], ['/cusco', 8], ['/agencias', 5]] } }) +
      '<div style="margin-top:14px">' + UI.card('Fuentes y campañas', srcTable(P.sources, A.visits), { tight: true, sub: 'Incluye campañas de Google Ads, Meta y TikTok para captar viajeros y agencias' }) + '</div>';
    b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => pVisits(b, x.dataset.s));
  }
  function pAgencies(b) {
    const P = DB.platformTracking; const ag = (id) => DB.showcase.agencies.find(a => a.id === id) || { name: id };
    b.innerHTML = UI.card('Visitas y reservas por agencia (30 días)', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Agencia</th><th>Plan</th><th class="num">Visitas a sus tours</th><th class="num">Reservas</th><th class="num">Conversión</th><th>Tendencia</th></tr></thead><tbody>' +
      P.agencies.map(([id, v, r], i) => '<tr><td><b>' + esc(ag(id).name) + '</b><div class="xs faint">' + esc(ag(id).city || '') + '</div></td><td class="small">' + esc(ag(id).plan || '') + '</td><td class="num">' + fmtN(v, 0) + '</td><td class="num">' + fmtN(r, 0) + '</td><td class="num">' + (100 * r / v).toFixed(1) + ' %</td><td>' + UI.chart.spark(P.sites.vitrina.slice(-14).map((d, k) => d.visits * (1 + ((i + k) % 5) / 12)), 'var(--accent)') + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      UI.alert('info', 'Cada agencia ve sus propias visitas y reservas de la vitrina en Canales › Vitrina. Las que tienen plan reciben además el enlace a su sitio propio desde su perfil.');
  }
  function pTags(b) {
    const P = DB.platformTracking; const me = Auth.user.id;
    b.innerHTML = UI.card('Etiquetas de la vitrina y el blog', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Proveedor</th><th>Nombre e ID</th><th>Sitio</th><th>Cookies</th><th>Creada por</th><th>Estado</th><th></th></tr></thead><tbody>' +
      P.tags.map(t => '<tr><td>' + chip(t.provider) + '</td><td><b>' + esc(t.name) + '</b><div class="xs faint mono">' + esc(t.mid) + '</div></td><td>' + esc({ ambos: 'Vitrina y blog', vitrina: 'Vitrina', blog: 'Blog' }[t.site]) + '</td><td>' + esc(CONS[t.consent]) + '</td><td class="small">' + esc(t.createdBy === 'U16' ? Q.userName('U16') : t.createdBy) + '</td><td>' + sb(t.status) + '</td>' +
        '<td class="nowrap" style="text-align:right">' + (t.status === 'borrador' ? '<button class="btn xs" data-sub="' + t.id + '">Enviar a revisión</button>' : '') + (t.status === 'en_revision' ? (t.createdBy === me ? '<button class="btn xs" disabled title="La aprueba otro Super Admin (cuatro ojos)">Lo aprueba otro Super Admin</button>' : '<button class="btn xs primary" data-pap="' + t.id + '">' + ic('check') + 'Aprobar</button>') : '') + (t.status === 'activo' ? '<button class="btn xs" data-pps="' + t.id + '">Pausar</button>' : '') + (t.status === 'pausado' ? '<button class="btn xs" data-pps="' + t.id + '">Reanudar</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) +
      '<div style="margin-top:14px">' + UI.card('Conversiones de la vitrina', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Evento</th><th>Destino</th><th>Evento del proveedor</th><th>Etiqueta de conversión</th><th>Servidor</th></tr></thead><tbody>' + P.mappings.map(m => { const t = P.tags.find(x => x.id === m.tagId) || {}; return '<tr><td>' + esc(PEV[m.event] || m.event) + '</td><td>' + chip(t.provider) + '</td><td class="mono small">' + esc(m.providerEvent) + '</td><td class="mono small">' + esc(m.label || '—') + '</td><td>' + (m.server ? UI.badge('ok', 'Sí') : '<span class="faint">No</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>', { tight: true, sub: 'El registro de agencia y el plan pagado se envían desde el servidor a Google Ads para optimizar las campañas de captación.' }) + '</div>';
    b.querySelectorAll('[data-sub]').forEach(x => x.onclick = () => { const t = P.tags.find(z => z.id === x.dataset.sub); t.status = 'en_revision'; Store.save(); Audit.log('Etiqueta vitrina', t.id, 'enviar_revision', 'borrador', 'en_revision'); UI.toast('Enviada. Otro Super Admin debe aprobarla.'); pTags(b); });
    b.querySelectorAll('[data-pap]').forEach(x => x.onclick = () => { const t = P.tags.find(z => z.id === x.dataset.pap); t.status = 'activo'; t.approvedBy = me; t.verify = 'ok'; t.verifiedAt = nowStr(); Store.save(); Audit.log('Etiqueta vitrina', t.id, 'aprobar', 'en_revision', 'activo'); UI.toast(t.name + ' activa en la vitrina.'); pTags(b); });
    b.querySelectorAll('[data-pps]').forEach(x => x.onclick = () => { const t = P.tags.find(z => z.id === x.dataset.pps); const bf = t.status; t.status = t.status === 'activo' ? 'pausado' : 'activo'; Store.save(); Audit.log('Etiqueta vitrina', t.id, 'pausar', bf, t.status); pTags(b); });
  }
  function pBlog(b) {
    const Y = DB.platformTracking.payload; const post = (id) => DB.showcase.posts.find(p => p.id === id) || { title: id, slug: '' };
    const ck = (c) => '<div class="tg-checks">' + [[c.words >= 800, fmtN(c.words, 0) + ' palabras'], [c.keyword, 'palabra clave'], [c.meta, 'meta título y descripción'], [c.alt, 'texto alternativo'], [c.tours >= 3, c.tours + ' tours enlazados']].map(([ok, l]) => '<span class="' + (ok ? '' : 'no') + '">' + (ok ? '✓ ' : '✗ ') + esc(l) + '</span>').join('') + '</div>';
    b.innerHTML = '<div class="grid g3">' + UI.card('Payload CMS', '<div class="small" style="line-height:1.8"><div><b>' + esc(Y.version) + '</b></div><div>Base: <span class="mono">' + esc(Y.db) + '</span></div><div>Panel: <span class="mono">' + esc(Y.url) + '</span></div></div><div class="row" style="gap:8px;margin-top:10px"><button class="btn sm primary" id="py-open">' + ic('link') + 'Abrir panel de Payload</button></div>') +
      UI.card('Sincronización', '<div class="small" style="line-height:1.8"><div>Último webhook: <b>' + esc(Y.lastWebhook) + '</b> ' + (Y.webhookOk ? UI.badge('ok', 'Firma válida') : UI.badge('fallido')) + '</div><div>Al publicar: índice, sitemap, revalidación de páginas e IndexNow.</div></div><div class="row" style="gap:8px;margin-top:10px"><button class="btn sm" id="py-sync">' + ic('sync') + 'Sincronizar ahora</button></div>') +
      UI.card('Reglas SEO al publicar', '<ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>800 palabras o más y un solo H1</li><li>Palabra clave en título, H1, primer párrafo y slug</li><li>Meta título 30–60 y descripción 70–160</li><li>Imagen con texto alternativo</li><li>Artículos de ciudad: 3 tours o más</li></ul>') + '</div>' +
      '<div style="margin-top:14px">' + UI.card('Artículos', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Artículo</th><th>Estado en Payload</th><th>Controles SEO</th><th>Sincronizado</th><th></th></tr></thead><tbody>' + Y.posts.map(x => { const p = post(x.postId); return '<tr><td><b>' + esc(p.title) + '</b><div class="xs faint mono">/blog/' + esc(p.slug) + ' · ' + esc(x.payloadId.slice(-6)) + '</div></td><td>' + sb(x.status) + (x.publishAt ? '<div class="xs faint">' + esc(x.publishAt) + '</div>' : '') + '</td><td>' + ck(x.checks) + '</td><td class="small nowrap">' + esc(x.syncedAt) + '</td><td><button class="btn sm" data-pyv="' + esc(x.postId) + '">' + ic('eye') + 'Entrada y SEO</button></td></tr>'; }).join('') + '</tbody></table></div>', { tight: true, sub: 'Los artículos se escriben y publican en Payload; aquí se ve el índice sincronizado y si cumplen las reglas SEO.' }) + '</div>';
    b.querySelectorAll('[data-pyv]').forEach(x => x.onclick = () => postModal(post(x.dataset.pyv), Y.posts.find(z => z.postId === x.dataset.pyv)));
    b.querySelector('#py-open').onclick = () => UI.toast('En producción abre ' + Y.url + ' (acceso del equipo de contenidos).', 'info');
    b.querySelector('#py-sync').onclick = () => { Y.lastWebhook = nowStr(); Y.posts.forEach(x => x.syncedAt = nowStr()); Store.save(); Audit.log('Blog Payload', 'sync', 'sincronizar', '', Y.posts.length + ' artículos'); UI.toast(Y.posts.length + ' artículos sincronizados.'); pBlog(b); };
  }
  /* v2.11 · Ficha de la entrada tal como la guarda Payload (colección posts) y vista previa en Google y redes. */
  function postModal(p, x) {
    const S = DB.showcase; const seo = p.seo || {}; const au = (S.authors || []).find(a => a.id === p.authorId) || { name: p.author || '—' };
    const cat = ((S.categories || []).find(c => c.id === p.category) || { name: '—' }).name; const city = (S.cities.find(c => c.id === p.city) || { name: '—' }).name;
    const secs = p.sections || []; const tours = secs.reduce((n, s) => n + (s.tours || []).length, 0);
    const mt = seo.metaTitle || ''; const md = seo.metaDescription || ''; const url = 'https://' + S.domain + '/blog/' + p.slug;
    const len = (v, a, z) => '<span class="xs ' + (v.length >= a && v.length <= z ? 'ok-t' : 'bad-t') + '" style="color:var(--' + (v.length >= a && v.length <= z ? 'ok' : 'bad') + ')">' + v.length + ' / ' + a + '–' + z + '</span>';
    const kw = (seo.keyword || p.keyword || '').toLowerCase(); const has = (t) => !!kw && String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const row = (k, v) => '<tr><td class="muted small" style="width:38%">' + k + '</td><td class="small" style="word-break:break-word;overflow-wrap:anywhere">' + v + '</td></tr>';
    const yes = (ok, t) => (ok ? '✓ ' : '✗ ') + esc(t);
    const blocks = { toursRecomendados: tours, consejo: secs.filter(s => s.tip).length, cita: secs.filter(s => s.quote).length };
    const body = '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">' +
      '<div>' + UI.card('Contenido y relaciones', '<table class="tbl compact" style="table-layout:fixed;width:100%"><tbody>' +
        row('Título (H1)', esc(p.title)) + row('Antetítulo', esc(p.kicker || '—')) + row('Entradilla', esc(p.excerpt)) + row('Portada · alt', esc((p.cover || {}).alt || '— falta texto alternativo')) +
        row('Autor', esc(au.name) + (au.verified ? ' · verificado' : '')) + row('Categoría', esc(cat)) + row('Ciudad', esc(city)) +
        row('Bloques', (secs.length ? secs.length + ' secciones H2 · ' : '') + blocks.toursRecomendados + ' tours (ToursRecomendados) · ' + blocks.consejo + ' consejos · ' + blocks.cita + ' citas') +
        row('Preguntas frecuentes', (p.faq || []).length + ' (FAQPage)') + row('Relacionadas', (p.related || []).length + ' entradas') +
        '</tbody></table>', { tight: true }) + '</div>' +
      '<div>' + UI.card('Barra lateral y SEO', '<table class="tbl compact" style="table-layout:fixed;width:100%"><tbody>' +
        row('Slug', '<span class="mono">' + esc(p.slug) + '</span>') + row('Palabra clave', esc(seo.keyword || p.keyword || '—')) +
        row('Meta título', esc(mt || '—') + '<div>' + len(mt, 30, 60) + '</div>') + row('Meta descripción', esc(md || '—') + '<div>' + len(md, 70, 160) + '</div>') +
        row('Canónica', '<span class="mono xs" style="word-break:break-all">' + esc(seo.canonical || url) + '</span>') + row('Indexación', seo.noindex ? 'noindex' : 'index, follow') +
        row('Palabras · lectura', fmtN(x ? x.checks.words : p.words, 0) + ' · ' + (p.readMinutes || Math.ceil(p.words / 220)) + ' min') +
        row('Palabra clave en', [yes(has(p.title), 'título'), yes(has((p.intro || [])[0] || p.excerpt), 'primer párrafo'), yes(has(p.slug.replace(/-/g, ' ')), 'slug'), yes(has(mt), 'meta título')].join('<br>')) +
        '</tbody></table>', { tight: true }) + '</div></div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px">' +
      UI.card('Vista previa en Google', '<div style="font-family:arial,sans-serif;max-width:600px"><div class="xs" style="color:#202124">' + esc(S.brand) + '</div><div class="xs" style="color:#4d5156">' + esc(url) + '</div><div style="color:#1a0dab;font-size:19px;line-height:1.3;margin:2px 0">' + esc((mt || p.title).slice(0, 60)) + '</div><div class="small" style="color:#4d5156">' + esc(Util.date(p.publishedAt || window.TODAY)) + ' — ' + esc((md || p.excerpt).slice(0, 160)) + '</div>' +
        ((p.faq || []).length ? '<div class="xs" style="margin-top:6px;color:#4d5156">' + p.faq.slice(0, 2).map(f => '▸ ' + esc(f[0])).join('<br>') + '</div>' : '') + '</div>') +
      UI.card('Vista previa en redes (Open Graph)', '<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden"><div style="aspect-ratio:1200/630;background:radial-gradient(circle at 85% 20%,rgba(249,87,56,.6),transparent 45%),linear-gradient(160deg,#1D4ED8,#0F172A);color:#fff;padding:14px;display:flex;flex-direction:column;justify-content:flex-end"><div class="xs" style="color:#85F8C4;font-weight:800;letter-spacing:.1em;text-transform:uppercase">' + esc(p.kicker || '') + '</div><b style="font-size:17px;line-height:1.2">' + esc(p.title) + '</b></div><div style="padding:8px 10px" class="small"><div class="xs faint">' + esc(S.domain.toUpperCase()) + '</div><b>' + esc(mt || p.title) + '</b></div></div><div class="xs faint" style="margin-top:6px">Imagen generada con next/og en /blog/' + esc(p.slug) + '/opengraph-image si la entrada no sube una propia.</div>') + '</div>' +
      UI.alert('info', 'Así guarda Payload la entrada (colección <span class="mono">posts</span>, kit/ejemplos/vitrina-payload). La publicación la bloquea <span class="mono">seoGuard</span> si falla una regla BLG-01/02; el JSON-LD publica BlogPosting, BreadcrumbList y FAQPage.');
    UI.modal({ title: 'Entrada en Payload', sub: esc(p.title), size: 'lg', body, actions: [{ label: 'Ver en la vitrina', cls: 'primary', onClick: () => { App.go('#/vitrina/blog/' + p.slug); } }] });
  }
})();
