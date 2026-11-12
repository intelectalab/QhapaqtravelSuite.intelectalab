/* ==========================================================================
   v2.9 · Plantillas web y contenido con IA (spec 23)
   - #/canales/plantillas    La agencia elige la plantilla de su sitio (galería, vista previa, aplicar, personalizar, restaurar).
   - #/canales/contenido-ia  Mejorar textos, SEO, traducciones, relatos y artículos con IA; crear imágenes con costo en créditos.
   - #/admin/plantillas      Consola de plataforma: catálogo, envíos del equipo de desarrollo o partners, asignación por agencia,
                             guía técnica para construir plantillas.
   - window.KipuTpl          Aplica la plantilla activa (o la vista previa) al sitio público #/sitio.
   En producción: plantillas como paquetes Next.js versionados (ver 23-plantillas-web-contenido-ia.md §13) y
   contenido con IA sobre /api/v1/cms/ai/* con créditos en fin_ai_credit_ledger.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, fmtN, date, nowStr, sum } = Util;
  const ic = (n) => UI.icon(n);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const nextId = (arr, prefix, w) => { const n = Math.max(0, ...(arr || []).map(x => parseInt(String(x.id || '').replace(prefix, '').replace(/\D/g, ''), 10) || 0)); return prefix + String(n + 1).padStart(w, '0'); };
  const KEYS = ['aiPlans', 'aiCreditPacks', 'aiCreditCost', 'aiCredits', 'aiJobs', 'aiImages', 'siteTemplates', 'siteTheme', 'templateSubmissions', 'tenantThemes'];
  function ensure() {
    const S = window.SEED || {}; let ch = false;
    KEYS.forEach(k => { if (DB[k] == null && S[k] != null) { DB[k] = clone(S[k]); ch = true; } });
    const sa = (S.siteTemplates || []).find(t => t.id === 'TPL-ANDES'), da = (DB.siteTemplates || []).find(t => t.id === 'TPL-ANDES');
    if (sa && da && da.version !== sa.version && parseInt(da.version, 10) < 3) { Object.assign(da, clone(sa), { installs: da.installs }); ch = true; }
    if (ch) Store.save();
  }
  const TPL = (id) => (DB.siteTemplates || []).find(t => t.id === id);
  const PREV_KEY = 'kc_tpl_preview';
  const getPrev = () => { try { return sessionStorage.getItem(PREV_KEY); } catch (e) { return null; } };
  const setPrev = (v) => { try { v ? sessionStorage.setItem(PREV_KEY, v) : sessionStorage.removeItem(PREV_KEY); } catch (e) { /* sin almacenamiento */ } };
  const CAT = { agencia: 'Agencia', free_tour: 'Free tours', aventura: 'Aventura', lujo: 'Lujo', corporativo: 'Corporativo', multi: 'Circuitos' };
  const isSA = () => Auth.role === 'super_admin' && Auth.can('admin.tenant.manage');

  /* ---------- color helpers ---------- */
  const hex = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(x.substr(i, 2), 16)); };
  const toHex = (a) => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (h, w, t) => { const a = hex(h), b = hex(w); return toHex(a.map((v, i) => v + (b[i] - v) * t)); };
  const tokensOf = (t, ov) => Object.assign({}, t.tokens, ov || {});

  /* =========================================================================
     0) Aplicación de la plantilla al sitio público
     ========================================================================= */
  function cssFor(t, ov) {
    const k = tokensOf(t, ov); const c = '.ws.tpl-' + t.slug;
    const darkAcc = mix(k.accent, '#ffffff', .38);
    let s = c + '{--side:' + k.side + ';--sun:' + k.sun + ';--accent:' + k.accent + ';--accent-2:' + mix(k.accent, '#000000', .18) + ';--accent-soft:' + k.soft + ';--link:' + k.accent + '}' +
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) ' + c + '{--accent:' + darkAcc + ';--accent-2:' + mix(darkAcc, '#ffffff', .2) + ';--accent-soft:' + mix(k.side, '#000000', .35) + ';--link:' + darkAcc + '}}' +
      ':root[data-theme="dark"] ' + c + '{--accent:' + darkAcc + ';--accent-2:' + mix(darkAcc, '#ffffff', .2) + ';--accent-soft:' + mix(k.side, '#000000', .35) + ';--link:' + darkAcc + '}' +
      c + ' .ws-card,' + c + ' .ws-block,' + c + ' .ws-img{border-radius:' + k.radius + 'px}';
    if (t.slug === 'inti-raymi' || t.slug === 'chakana-free-tours') s += c + ' .ws-hero{border-bottom:10px solid transparent;border-image:repeating-linear-gradient(90deg,' + k.sun + ' 0 12px,' + k.accent + ' 12px 24px,#2F6B4F 24px 30px) 10}' + c + ' .ws-card{border-radius:6px ' + k.radius + 'px 6px ' + k.radius + 'px}';
    if (t.slug === 'nazca-noche') s += c + '{--bg:#14110F;--surface:#1E1A16;--surface-2:#24201B;--surface-3:#2C2721;--fg:#EDE6DC;--fg-2:#C9BFB2;--fg-3:#9C9184;--line:#3A332B;--line-2:#2E2822;background:var(--bg);color:var(--fg)}' + c + ' .ws-hero{background:linear-gradient(160deg,#0B0907,#2A241D)}' + c + ' h1,' + c + ' h2,' + c + ' h3{letter-spacing:.02em}';
    if (t.slug === 'pacifico') s += c + ' .ws-hero{background:linear-gradient(135deg,' + k.side + ',' + k.accent + ')}';
    if (t.slug === 'amazonia') s += c + ' .ws-hero{background:linear-gradient(160deg,' + k.side + ',#1F7A4D 70%,#5FA86B)}';
    if (t.slug === 'andes-clasico') s += andesSkin(c, k);
    return s;
  }
  /* v2.13 · Andes Clásico 3.0 (diseño de Stitch): serif en títulos, hero centrado con buscador de vidrio,
     destinos en mosaico, dorado solo en la acción principal, boletín en celeste y Libro de Reclamaciones destacado. */
  function andesSkin(c, k) {
    const serif = '"Noto Serif",Georgia,"Times New Roman",serif';
    return [
      c + '{--ac-ink:' + k.side + ';--ac-gold-fg:#2A1E00;--f-display:' + serif + '}',
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) ' + c + '{--ac-ink:var(--fg)}}:root[data-theme="dark"] ' + c + '{--ac-ink:var(--fg)}',
      c + ' .ws-kick{display:block;font:700 .7rem/1.2 "Plus Jakarta Sans",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}',
      c + ' .ws-h2,' + c + ' .ws-page-h h1{font-family:' + serif + ';font-weight:600;color:var(--ac-ink);letter-spacing:-.015em;font-size:clamp(1.6rem,3vw,2.3rem);line-height:1.15}',
      c + ' .ws-cb h3,' + c + ' .ws-dest b,' + c + ' .ws-logo b{font-family:' + serif + ';font-weight:600}',
      c + ' .ws-cta{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;border-radius:10px;background:var(--sun);color:var(--ac-gold-fg);font-weight:700;font-size:.82rem;text-decoration:none;box-shadow:0 6px 16px -6px rgba(242,179,61,.6)}',
      c + ' .ws-cta:hover{filter:brightness(1.05);text-decoration:none}',
      '@media (max-width:760px){' + c + ' .ws-cta{display:none}}',
      c + ' .ws-head{background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}',
      c + ' .ws-nav a{font-weight:600}' + c + ' .ws-nav a.on{color:var(--ac-ink);background:transparent;box-shadow:inset 0 -2px 0 var(--sun);border-radius:0}',
      /* hero */
      c + ' .ws-hero{background:radial-gradient(120% 90% at 50% 0%,' + mix(k.side, '#ffffff', .12) + ',' + k.side + ' 55%,' + mix(k.side, '#000000', .35) + ')}',
      c + ' .ws-hero .ws-wrap{text-align:center;padding-top:72px;padding-bottom:56px}',
      c + ' .ws-hero .k{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)}',
      c + ' .ws-hero h1{font-family:' + serif + ';font-weight:600;font-size:clamp(2rem,5vw,3.5rem);line-height:1.12;letter-spacing:-.02em;max-width:860px;margin:16px auto 0}',
      c + ' .ws-hero p.l{margin:14px auto 0;font-size:1.05rem}',
      c + ' .ws-search{margin:32px auto 0;text-align:left;border-radius:16px;padding:18px;background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.4);box-shadow:0 24px 60px -20px rgba(0,0,0,.45)}',
      c + ' .ws-search .btn{background:var(--sun);border-color:var(--sun);color:var(--ac-gold-fg);font-weight:700}',
      c + ' .ws-hero .ws-trust{justify-content:center;margin-top:26px}',
      /* destinos en mosaico */
      c + ' .ws-bento{grid-template-columns:repeat(12,minmax(0,1fr))!important}',
      c + ' .ws-bento>.ws-dest{grid-column:span 6;min-height:240px}' + c + ' .ws-bento>.ws-dest:nth-child(1){grid-column:span 7;min-height:320px}' + c + ' .ws-bento>.ws-dest:nth-child(2){grid-column:span 5;min-height:320px}',
      c + ' .ws-bento>.ws-dest .in{min-height:inherit;padding:22px;background:linear-gradient(180deg,transparent 35%,rgba(0,18,43,.78))}',
      c + ' .ws-bento>.ws-dest b{font-size:1.45rem}',
      '@media (max-width:760px){' + c + ' .ws-bento>.ws-dest,' + c + ' .ws-bento>.ws-dest:nth-child(1),' + c + ' .ws-bento>.ws-dest:nth-child(2){grid-column:1/-1;min-height:200px}}',
      /* tarjetas */
      c + ' .ws-card{border-radius:' + k.radius + 'px}' + c + ' .ws-card:hover{transform:translateY(-2px);transition:transform .15s,box-shadow .15s}',
      c + ' .ws-flag{background:var(--side);color:#fff}' + c + ' .ws-flag.sun{background:var(--sun);color:var(--ac-gold-fg)}' + c + ' .ws-flag.ok{background:var(--ok);color:#fff}',
      c + ' .ws-cb .kd{color:var(--accent)}',
      c + ' .ws-price b{color:var(--ac-ink)}',
      c + ' .ws-card .ws-price .btn.primary{background:var(--sun);border-color:var(--sun);color:var(--ac-gold-fg);font-weight:700}',
      /* salidas como tabla */
      c + ' .ws-deps{gap:0;border:1px solid var(--line);border-radius:' + k.radius + 'px;overflow:hidden;background:var(--surface)}',
      c + ' .ws-dep{border:0;border-radius:0;border-bottom:1px solid var(--line-2);padding:14px 18px}' + c + ' .ws-dep:last-child{border-bottom:0}',
      c + ' .ws-dep .d b{color:var(--accent)}',
      /* por qué y garantías */
      c + ' .ws-why .it{background:var(--surface);border:1px solid var(--line);border-radius:' + k.radius + 'px;padding:20px}',
      c + ' .ws-guar .it{border-radius:' + k.radius + 'px}' + c + ' .ws-guar svg{color:var(--sun)}',
      /* boletín celeste */
      c + ' .ws-news{background:var(--accent-soft);color:var(--fg);border:1px solid var(--line)}',
      c + ' .ws-news h2{color:var(--ac-ink)}' + c + ' .ws-news p{color:var(--fg-2)}' + c + ' .ws-news label.check{color:var(--fg-2)}' + c + ' .ws-news label.check a{color:var(--accent)}',
      c + ' .ws-news .btn.sun{background:var(--sun);border-color:var(--sun);color:var(--ac-gold-fg)}',
      /* pie */
      c + ' .ws-foot h4{color:var(--sun);letter-spacing:.12em}',
      c + ' .ws-lr{border-color:var(--sun)!important;color:var(--sun)!important;background:rgba(242,179,61,.1);font-weight:700}'
    ].join('');
  }
  window.KipuTpl = {
    activeId() { ensure(); const p = getPrev(); return (p && TPL(p)) ? p : (DB.siteTheme ? DB.siteTheme.templateId : 'TPL-ANDES'); },
    cls() { const t = TPL(this.activeId()); return t ? 'tpl-' + t.slug : ''; },
    css() { const t = TPL(this.activeId()); if (!t) return ''; const ov = getPrev() ? null : (DB.siteTheme || {}).overrides; return '<style id="tpl-css">' + cssFor(t, ov) + '</style>'; },
    bar() {
      const p = getPrev(); const t = p && TPL(p); if (!t) return '';
      const can = Auth.user && Auth.can && Auth.can('cms.templates.manage');
      return '<div class="tpl-bar" role="region" aria-label="Vista previa de plantilla"><span>' + ic('palette') + '<b>Vista previa:</b> ' + esc(t.name) + ' v' + esc(t.version) + '</span><span class="row" style="gap:6px">' +
        (can ? '<a class="btn sm primary" href="#/canales/plantillas/aplicar/' + t.id + '">Aplicar esta plantilla</a>' : '') + '<button class="btn sm" onclick="KipuTpl.exit()">Salir de la vista previa</button></span></div>' +
        '<style>.tpl-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:60;background:var(--surface);color:var(--fg);border:1px solid var(--line);box-shadow:0 12px 30px rgba(0,0,0,.25);border-radius:14px;padding:10px 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 32px);font-size:.85rem}.tpl-bar svg{width:16px;height:16px;vertical-align:-3px;margin-right:6px}</style>';
    },
    preview(id) { setPrev(id); App.go('#/sitio'); },
    exit() { const back = Auth.user && Auth.can && Auth.can('cms.templates.manage'); setPrev(null); if (back) App.go('#/canales/plantillas'); else App.render(); }
  };

  /* Mini maqueta de una plantilla con sus tokens */
  function mock(t, ov, big) {
    const k = tokensOf(t, ov); const r = Math.min(k.radius, 14); const dark = t.slug === 'nazca-noche';
    const bg = dark ? '#1E1A16' : '#fff'; const fg = dark ? '#EDE6DC' : '#1F2937'; const ln = dark ? '#3A332B' : '#E5E7EB';
    const band = (t.slug === 'inti-raymi' || t.slug === 'chakana-free-tours') ? '<div style="height:5px;background:repeating-linear-gradient(90deg,' + k.sun + ' 0 8px,' + k.accent + ' 8px 16px,#2F6B4F 16px 20px)"></div>' : '';
    const hero = dark ? 'linear-gradient(160deg,#0B0907,#2A241D)' : 'linear-gradient(140deg,' + k.side + ',' + k.accent + ')';
    return '<div class="tpl-mock' + (big ? ' big' : '') + '" style="background:' + bg + ';color:' + fg + ';border-color:' + ln + '" aria-hidden="true">' +
      '<div class="tm-top" style="border-color:' + ln + '"><i style="background:' + k.side + '"></i><span style="background:' + ln + '"></span><span style="background:' + ln + '"></span><b style="background:' + k.sun + '"></b></div>' +
      '<div class="tm-hero" style="background:' + hero + '"><span></span><span class="s"></span><em style="background:' + k.sun + '"></em>' + (t.slug === 'nazca-noche' ? '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0 34 L40 6 L62 30 L100 2" stroke="' + k.sun + '" stroke-width=".8" fill="none"/></svg>' : '') + (t.slug === 'qhapaq-nan' ? '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M6 32 C30 10 50 36 70 14 S94 18 96 8" stroke="' + k.sun + '" stroke-width="1.2" stroke-dasharray="3 2" fill="none"/></svg>' : '') + '</div>' + band +
      '<div class="tm-cards">' + [0, 1, 2].map(i => '<div style="border-radius:' + r + 'px;border-color:' + ln + '"><i style="border-radius:' + Math.max(0, r - 3) + 'px;background:linear-gradient(135deg,' + mix(k.accent, '#ffffff', .25 + i * .15) + ',' + k.side + ')"></i><span style="background:' + ln + '"></span><b style="background:' + k.accent + '"></b></div>').join('') + '</div></div>';
  }
  const MOCK_CSS = '<style>' +
    '.tpl-mock{border:1px solid;border-radius:12px;overflow:hidden;font-size:0}.tpl-mock .tm-top{display:flex;gap:6px;align-items:center;padding:7px 9px;border-bottom:1px solid}.tpl-mock .tm-top i{width:14px;height:14px;border-radius:4px}.tpl-mock .tm-top span{height:6px;width:26px;border-radius:3px}.tpl-mock .tm-top b{margin-left:auto;width:30px;height:10px;border-radius:5px}' +
    '.tpl-mock .tm-hero{position:relative;height:74px;padding:12px;display:flex;flex-direction:column;gap:5px}.tpl-mock .tm-hero span{height:8px;width:62%;background:rgba(255,255,255,.9);border-radius:4px}.tpl-mock .tm-hero span.s{width:40%;height:5px;background:rgba(255,255,255,.6)}.tpl-mock .tm-hero em{width:44px;height:12px;border-radius:6px;margin-top:4px}.tpl-mock .tm-hero svg{position:absolute;inset:0;width:100%;height:100%}' +
    '.tpl-mock .tm-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:9px}.tpl-mock .tm-cards div{border:1px solid;padding:5px;display:flex;flex-direction:column;gap:4px}.tpl-mock .tm-cards i{height:28px}.tpl-mock .tm-cards span{height:5px;width:80%;border-radius:3px}.tpl-mock .tm-cards b{height:7px;width:46%;border-radius:4px}' +
    '.tpl-mock.big .tm-hero{height:120px}.tpl-mock.big .tm-cards i{height:46px}' +
    '.tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}.tpl-card{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:12px;display:flex;flex-direction:column;gap:10px}.tpl-card.on{outline:2px solid var(--accent);outline-offset:-1px}' +
    '.tpl-card h3{font-size:1rem;margin:0}.tpl-tags{display:flex;gap:5px;flex-wrap:wrap}.tpl-tags span{font-size:.7rem;background:var(--surface-3);border-radius:999px;padding:2px 8px;color:var(--fg-2)}.tpl-lh{display:flex;gap:6px;flex-wrap:wrap;font-size:.72rem}.tpl-lh span{border:1px solid var(--line);border-radius:6px;padding:1px 6px}.tpl-lh b{color:var(--ok)}' +
    '.ai-ba{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:760px){.ai-ba{grid-template-columns:1fr}}.ai-ba>div{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface)}.ai-ba .after{border-color:var(--accent);background:var(--accent-soft)}.ai-ba h4{margin:0 0 6px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3)}' +
    '.ai-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.ai-img{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)}.ai-img .pic{height:120px;position:relative}.ai-img .pic small{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;border-radius:6px;padding:2px 6px;font-size:.66rem}.ai-img .bd{padding:8px 10px;display:flex;flex-direction:column;gap:6px}' +
    '.ai-cost{display:flex;gap:8px;align-items:center;background:var(--sun-soft);border-radius:10px;padding:8px 10px;font-size:.84rem}.ai-cost svg{width:16px;height:16px}' +
    '.code{background:var(--surface-3);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-family:var(--f-mono,ui-monospace,monospace);font-size:.76rem;white-space:pre;overflow:auto;max-width:100%}' +
    '</style>';
  const lhChips = (lh) => '<div class="tpl-lh" title="Lighthouse móvil: rendimiento, accesibilidad, SEO y buenas prácticas"><span>Rend. <b>' + lh.perf + '</b></span><span>Acces. <b>' + lh.a11y + '</b></span><span>SEO <b>' + lh.seo + '</b></span><span>BP <b>' + lh.bp + '</b></span></div>';
  const tierBadge = (t) => t.tier === 'premium' ? '<span class="badge b-sun">Premium · S/ ' + fmtN(t.price, 0) + '</span>' : '<span class="badge b-ok">Incluida</span>';
  const PLAN_ORDER = ['Starter', 'Professional', 'Enterprise'];
  const planOk = (t) => !t.minPlan || PLAN_ORDER.indexOf(DB.tenant.plan || 'Enterprise') >= PLAN_ORDER.indexOf(t.minPlan);
  const owned = (t) => t.tier !== 'premium' || ((DB.siteTheme.purchased || []).includes(t.id));

  /* =========================================================================
     1) Agencia: #/canales/plantillas
     ========================================================================= */
  App.register('canales/plantillas', (el, params) => {
    ensure(); const can = Auth.can('cms.templates.manage');
    const th = DB.siteTheme; const cur = TPL(th.templateId) || DB.siteTemplates[0];
    const pub = DB.siteTemplates.filter(t => t.status === 'publicado');
    const q = {}; if (params[0] === 'cat') q.cat = params[1] || ''; if (params[0] === 'aplicar') q.aplicar = params[1];
    const upd = cur.version !== th.version;
    el.innerHTML = MOCK_CSS + '<div class="page">' + UI.pageHeader({ title: 'Plantillas del sitio web', crumbs: [['Inicio', '#/dashboard'], ['Canales'], ['Plantillas del sitio']], subtitle: 'Elija el diseño de su sitio público. Sus tours, precios, reservas, blog y SEO no cambian al cambiar de plantilla: solo la presentación. Puede ver cada una con sus datos antes de aplicarla y volver a la anterior cuando quiera.', actions: '<a class="btn" href="#/sitio">' + ic('eye') + 'Ver mi sitio</a>' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Plantilla activa', value: esc(cur.name), sub: 'v' + esc(th.version) + ' · ' + (th.chosenBy === 'alta' ? 'elegida al contratar' : th.chosenBy === 'admin_plataforma' ? 'asignada por KipuControl' : 'elegida por su equipo'), icon: 'palette', tone: 'accent' }) +
      UI.kpi({ label: 'Disponibles', value: pub.length, sub: pub.filter(t => t.tier === 'premium').length + ' premium', icon: 'layout', tone: 'info' }) +
      UI.kpi({ label: 'Rendimiento móvil', value: cur.lh.perf + ' / 100', sub: 'Lighthouse de la versión publicada', icon: 'zap', tone: cur.lh.perf >= 90 ? 'ok' : 'sun' }) +
      UI.kpi({ label: 'Actualización', value: upd ? 'v' + esc(cur.version) : 'Al día', sub: upd ? 'Nueva versión disponible' : 'Sin cambios pendientes', icon: 'refresh', tone: upd ? 'sun' : 'ok' }) + '</div>' +
      '<div class="grid g2" style="margin-top:14px;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)">' +
      UI.card('Su plantilla activa', '<div class="grid g2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' + mock(cur, th.overrides, true) + '<div class="stack"><div><b>' + esc(cur.name) + '</b> ' + tierBadge(cur) + '<div class="small muted" style="margin-top:4px">' + esc(cur.desc) + '</div></div>' + lhChips(cur.lh) + '<div class="xs faint">Secciones: ' + cur.sections.map(s => esc(s.replace(/_/g, ' '))).join(' · ') + '</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap">' + (can ? '<button class="btn sm primary" id="tp-cust">' + ic('edit') + 'Personalizar colores</button>' : '') + (upd && can ? '<button class="btn sm" id="tp-upd">' + ic('refresh') + 'Actualizar a v' + esc(cur.version) + '</button>' : '') + '</div></div></div>', { sub: 'Activa desde ' + esc(th.appliedAt) }) +
      UI.card('Historial', th.history.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Plantilla</th><th>Desde</th><th>Hasta</th><th></th></tr></thead><tbody>' + th.history.slice().reverse().map((h, i) => { const t = TPL(h.templateId) || { name: h.templateId }; return '<tr><td><b>' + esc(t.name) + '</b> <span class="xs faint">v' + esc(h.version) + '</span><div class="xs faint">' + esc(h.by || '') + '</div></td><td>' + esc(h.from) + '</td><td>' + esc(h.to) + '</td><td style="text-align:right">' + (can && TPL(h.templateId) && h.templateId !== th.templateId ? '<button class="btn xs" data-rs="' + (th.history.length - 1 - i) + '">Restaurar</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : UI.empty('Sin cambios de plantilla.', 'history'), { tight: true, sub: 'Puede volver a una plantilla anterior con un clic.' }) + '</div>' +
      '<div class="row between" style="margin:18px 0 10px;flex-wrap:wrap;gap:8px"><h2 style="margin:0;font-size:1.1rem">Galería</h2><div class="row" style="gap:6px;flex-wrap:wrap" id="tp-f">' + [['', 'Todas']].concat(Object.entries(CAT)).map(([k, l]) => '<button class="btn xs' + ((q.cat || '') === k ? ' primary' : '') + '" data-cat="' + k + '">' + esc(l) + '</button>').join('') + '</div></div>' +
      '<div class="tpl-grid">' + pub.filter(t => !q.cat || t.category === q.cat).map(t => '<div class="tpl-card' + (t.id === cur.id ? ' on' : '') + '">' + mock(t) + '<div class="row between" style="gap:6px;align-items:flex-start"><h3>' + esc(t.name) + '</h3>' + tierBadge(t) + '</div><div class="small muted">' + esc(t.desc) + '</div><div class="tpl-tags">' + [...new Set(t.tags.concat(CAT[t.category]))].map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' + lhChips(t.lh) +
        '<div class="xs faint">v' + esc(t.version) + ' · ' + esc(t.author) + (t.minPlan ? ' · desde plan ' + esc(t.minPlan) : '') + ' · ' + t.installs + ' agencias</div>' +
        '<div class="row" style="gap:6px;margin-top:auto"><button class="btn sm" data-pv="' + t.id + '">' + ic('eye') + 'Vista previa</button>' + (t.id === cur.id ? '<span class="badge b-accent">Activa</span>' : can ? '<button class="btn sm primary" data-ap="' + t.id + '">Aplicar</button>' : '') + '</div></div>').join('') + '</div>' +
      '<div style="margin-top:14px">' + UI.alert('info', '¿Quiere un diseño propio? El equipo de KipuControl o un estudio partner puede crear una plantilla exclusiva para su marca con el mismo contrato técnico (precio a cotizar). Las plantillas nuevas aparecen en esta galería cuando pasan la revisión de calidad.') + '</div></div>';
    el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => App.go('#/canales/plantillas' + (b.dataset.cat ? '/cat/' + b.dataset.cat : '')));
    el.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => KipuTpl.preview(b.dataset.pv));
    el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => applyFlow(b.dataset.ap));
    el.querySelectorAll('[data-rs]').forEach(b => b.onclick = () => { const h = th.history[+b.dataset.rs]; applyTpl(TPL(h.templateId), 'Restaurada desde el historial'); });
    const cu = el.querySelector('#tp-cust'); if (cu) cu.onclick = () => customize(cur);
    const up = el.querySelector('#tp-upd'); if (up) up.onclick = () => UI.confirm({ title: 'Actualizar plantilla', message: 'Se aplicará ' + cur.name + ' v' + cur.version + '. Sus personalizaciones se conservan.', confirmLabel: 'Actualizar', onConfirm: () => { th.version = cur.version; th.appliedAt = nowStr(); Store.save(); Audit.log('Plantilla', cur.id, 'actualizar', '', cur.version); UI.toast('Plantilla actualizada a v' + cur.version + '.'); App.render(); } });
    if (q.aplicar && TPL(q.aplicar) && can) { setPrev(null); history.replaceState(null, '', '#/canales/plantillas'); setTimeout(() => applyFlow(q.aplicar), 0); }
  });
  function applyFlow(id) {
    const t = TPL(id); if (!t) return;
    if (!planOk(t)) { UI.modal({ title: 'Plantilla disponible desde ' + t.minPlan, body: UI.alert('warn', esc(t.name) + ' requiere el plan ' + esc(t.minPlan) + ' o superior. Su plan actual es ' + esc(DB.tenant.plan || '—') + '.'), actions: [{ label: 'Cerrar' }] }); return; }
    if (!owned(t)) {
      UI.modal({ title: 'Plantilla premium: ' + t.name, body: '<p class="small">Las plantillas premium son diseños de autor. Se pagan una sola vez y quedan disponibles para su cuenta mientras esté activa, con sus actualizaciones.</p>' + UI.dl([['Precio', 'S/ ' + fmtN(t.price, 0) + ' + IGV · pago único'], ['Autor', esc(t.author)], ['Se factura en', 'Su próxima factura de KipuControl']]),
        actions: [{ label: 'Cancelar' }, { label: 'Comprar y aplicar', cls: 'primary', icon: 'cart', onClick: () => { DB.siteTheme.purchased = (DB.siteTheme.purchased || []).concat(t.id); Audit.log('Plantilla', t.id, 'comprar', '', 'S/ ' + t.price); applyTpl(t, 'Compra de plantilla premium'); } }] });
      return;
    }
    UI.modal({ title: 'Aplicar ' + t.name, body: mock(t, null, true) + '<ul class="small" style="margin:12px 0 0;padding-left:18px;line-height:1.7"><li>Se publica en su sitio en 1 a 2 minutos.</li><li>Sus tours, precios, blog, SEO, dominio y redirecciones no cambian.</li><li>Secciones de esta plantilla: ' + t.sections.map(s => esc(s.replace(/_/g, ' '))).join(', ') + '.</li><li>Puede volver a la anterior desde el historial.</li></ul>',
      actions: [{ label: 'Cancelar' }, { label: 'Vista previa', icon: 'eye', onClick: () => { KipuTpl.preview(t.id); } }, { label: 'Aplicar ahora', cls: 'primary', icon: 'check', onClick: () => applyTpl(t, '') }] });
  }
  function applyTpl(t, note) {
    const th = DB.siteTheme; if (th.templateId === t.id && th.version === t.version) { UI.toast('Esa plantilla ya está activa.'); return; }
    th.history.push({ templateId: th.templateId, version: th.version, from: String(th.appliedAt).slice(0, 10), to: nowStr().slice(0, 10), by: Q.userName(th.appliedBy || Auth.user.id) });
    const before = th.templateId; th.templateId = t.id; th.version = t.version; th.appliedAt = nowStr(); th.appliedBy = Auth.user.id; th.chosenBy = 'agencia'; th.overrides = {};
    const tt = (DB.tenantThemes || []).find(x => x.tenantId === DB.tenant.id); if (tt) { tt.templateId = t.id; tt.version = t.version; tt.chosenBy = 'agencia'; }
    t.installs++; setPrev(null); Store.save(); Audit.log('Plantilla', t.id, 'aplicar', before, t.id + (note ? ' · ' + note : ''));
    UI.closeModal(); UI.toast('Plantilla ' + t.name + ' aplicada. Su sitio ya muestra el nuevo diseño.'); App.go('#/canales/plantillas');
  }
  function customize(t) {
    const k = tokensOf(t, DB.siteTheme.overrides);
    UI.modal({ title: 'Personalizar ' + t.name, size: 'lg', sub: 'Los colores se validan con contraste mínimo 4,5:1 sobre blanco para botones y enlaces (WCAG AA).',
      body: UI.form([{ id: 'c_side', label: 'Color de marca (cabecera y hero)', type: 'color', value: k.side, col: 4 }, { id: 'c_acc', label: 'Botones y enlaces', type: 'color', value: k.accent, col: 4 }, { id: 'c_sun', label: 'Acento', type: 'color', value: k.sun, col: 4 }, { id: 'c_rad', label: 'Redondeo de tarjetas (px)', type: 'number', value: k.radius, col: 6 }, { id: 'c_logo', label: 'Logo (SVG o PNG)', placeholder: 'logo-andes.svg', col: 6 }]) + '<div id="c-prev" style="margin-top:12px"></div>',
      onOpen: (m) => { const draw = () => { const f = UI.formData(m); m.querySelector('#c-prev').innerHTML = mock(t, { side: f.c_side, accent: f.c_acc, sun: f.c_sun, radius: +f.c_rad || 0 }, true) + '<div class="xs faint" style="margin-top:6px">Contraste del botón: <b>' + contrast(f.c_acc, '#FFFFFF').toFixed(1) + ':1</b></div>'; }; m.querySelectorAll('input').forEach(i => i.oninput = draw); draw(); },
      actions: [{ label: 'Restablecer', onClick: () => { DB.siteTheme.overrides = {}; Store.save(); UI.toast('Colores de la plantilla restablecidos.'); App.render(); } }, { label: 'Guardar', cls: 'primary', icon: 'check', onClick: (m) => { const f = UI.formData(m); const cr = contrast(f.c_acc, '#FFFFFF'); if (cr < 4.5) { UI.toast('El color de botones tiene contraste ' + cr.toFixed(1) + ':1; el mínimo es 4,5:1.', 'bad'); return false; } const r = Math.max(0, Math.min(28, +f.c_rad || 0)); DB.siteTheme.overrides = { side: f.c_side, accent: f.c_acc, sun: f.c_sun, radius: r }; Store.save(); Audit.log('Plantilla', t.id, 'personalizar', '', JSON.stringify(DB.siteTheme.overrides)); UI.toast('Personalización guardada.'); App.render(); } }] });
  }
  function lum(h) { return hex(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }

  /* =========================================================================
     2) Agencia: #/canales/contenido-ia
     ========================================================================= */
  const KIND = { mejorar_texto: 'Mejorar descripción', meta_seo: 'Título y meta SEO', traducir: 'Traducir', relato_aventura: 'Relato de aventura', articulo: 'Artículo de blog', imagen: 'Imágenes' };
  const TONE = { cercano: 'Cercano', profesional: 'Profesional', aventurero: 'Aventurero', lujo: 'Lujo', familiar: 'Familiar' };
  const LOC = { es: 'Español', en: 'Inglés', pt: 'Portugués' };
  const art = (hue, i) => 'linear-gradient(' + (150 + i * 10) + 'deg,hsl(' + hue + ',55%,28%),hsl(' + ((hue + 30) % 360) + ',65%,55%))';
  App.register('canales/contenido-ia', (el, params) => {
    ensure(); const C = DB.aiCredits; const J = DB.aiJobs; const month = String(window.TODAY || nowStr()).slice(0, 7);
    const mj = J.filter(j => String(j.at).slice(0, 7) === month || true);
    el.innerHTML = MOCK_CSS + '<div class="page">' + UI.pageHeader({ title: 'Contenido con IA', crumbs: [['Inicio', '#/dashboard'], ['Canales'], ['Contenido con IA']], subtitle: 'Mejore descripciones de tours, títulos SEO, traducciones, relatos de aventura y artículos del blog, y cree imágenes. Nada se publica sin que usted lo revise. Cada pedido consume créditos; si la IA falla, no se cobra.' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Créditos de contenido', value: fmtN(C.balance.contenido, 0), sub: C.planIncluded.contenido + ' del plan + ' + (C.addons.includes('IA-PRO') ? '1 000' : C.addons.includes('IA-BASICO') ? '300' : '0') + ' del add-on al mes', icon: 'sparkles', tone: C.balance.contenido > 50 ? 'accent' : 'sun' }) +
      UI.kpi({ label: 'Créditos de imágenes', value: fmtN(C.balance.imagenes, 0), sub: '1 por imagen estándar · 2 por HD', icon: 'image', tone: C.balance.imagenes > 4 ? 'info' : 'sun' }) +
      UI.kpi({ label: 'Pedidos', value: mj.length, sub: mj.filter(j => j.status === 'aplicado').length + ' aplicados', icon: 'list', tone: 'violet' }) +
      UI.kpi({ label: 'Plan de IA', value: C.addons.includes('IA-PRO') ? 'IA Pro' : C.addons.includes('IA-BASICO') ? 'IA Básico' : 'Solo plan', sub: 'S/ ' + (C.addons.includes('IA-PRO') ? 149 : C.addons.includes('IA-BASICO') ? 59 : 0) + ' al mes', icon: 'award', tone: 'ok' }) + '</div><div id="ai-tabs" style="margin-top:14px"></div></div>';
    UI.tabs(el.querySelector('#ai-tabs'), [
      { id: 'texto', label: 'Mejorar contenido', render: aiText },
      { id: 'imagenes', label: 'Imágenes', count: DB.aiImages.filter(x => x.status !== 'descartada').length, render: aiImages },
      { id: 'historial', label: 'Historial', count: J.length, render: aiHistory },
      { id: 'planes', label: 'Planes y créditos', render: aiPlans }
    ], ['imagenes', 'historial', 'planes'].includes(params[0]) ? params[0] : 'texto');
  });
  function targetsFor(kind) {
    if (kind === 'meta_seo') return (DB.seoPages || []).map(p => ['pagina:' + p.path, 'Página ' + p.path]);
    if (kind === 'relato_aventura') return (DB.travelStories || []).map(s => ['historia:' + s.id, s.title]);
    if (kind === 'articulo') return [['libre:', 'Tema libre (artículo nuevo)']];
    return DB.products.filter(p => p.status !== 'INACTIVO').slice(0, 14).map(p => ['producto:' + p.id, p.name]);
  }
  function aiText(b) {
    const cost = DB.aiCreditCost;
    b.innerHTML = '<div class="grid g2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);align-items:start">' +
      UI.card('Nuevo pedido', UI.form([{ id: 'ai_k', label: 'Qué necesita', type: 'select', options: Object.entries(KIND).filter(([k]) => k !== 'imagen').map(([k, l]) => [k, l + ' · ' + cost[k] + ' crédito' + (cost[k] > 1 ? 's' : '')]), col: 12 },
        { id: 'ai_t', label: 'Sobre', type: 'select', options: targetsFor('mejorar_texto'), col: 12 }, { id: 'ai_tone', label: 'Tono', type: 'select', options: Object.entries(TONE), col: 6 }, { id: 'ai_loc', label: 'Idioma', type: 'select', options: Object.entries(LOC), col: 6 },
        { id: 'ai_note', label: 'Indicaciones (opcional)', type: 'textarea', placeholder: 'Ej.: mencionar que el recojo es desde el hotel y que hay opción vegetariana', col: 12 }]) +
        '<div class="ai-cost" id="ai-c" style="margin-top:10px"></div><div class="row end" style="margin-top:10px"><button class="btn primary" id="ai-go">' + ic('sparkles') + 'Generar</button></div>', { sub: 'La IA usa los datos reales del tour (itinerario, incluye, punto de encuentro) para no inventar.' }) +
      '<div id="ai-out">' + UI.card('Resultado', UI.empty('Elija qué mejorar y pulse Generar. Verá el antes y el después para aplicar o descartar.', 'sparkles')) + '</div></div>';
    const k = b.querySelector('#ai_k'), t = b.querySelector('#ai_t');
    const upd = () => { const c = cost[k.value]; b.querySelector('#ai-c').innerHTML = ic('coins') + '<span>Costo: <b>' + c + ' crédito' + (c > 1 ? 's' : '') + '</b> · saldo ' + fmtN(DB.aiCredits.balance.contenido, 0) + ' → ' + fmtN(DB.aiCredits.balance.contenido - c, 0) + '</span>'; };
    k.onchange = () => { t.innerHTML = targetsFor(k.value).map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join(''); upd(); }; upd();
    b.querySelector('#ai-go').onclick = () => {
      const f = UI.formData(b); const c = cost[f.ai_k];
      if (DB.aiCredits.balance.contenido < c) { buyModal('contenido'); return; }
      const [tt, tid] = String(f.ai_t).split(':'); const job = gen(f.ai_k, tt, tid, f.ai_tone, f.ai_loc, f.ai_note); job.credits = c;
      DB.aiJobs.unshift(job); spend('contenido', c, job.id); Store.save(); Audit.log('IA contenido', job.id, 'generar', '', KIND[job.kind] + ' · ' + c + ' créditos');
      showJob(b.querySelector('#ai-out'), job); upd();
    };
  }
  function spend(kind, c, jobId) { const C = DB.aiCredits; C.balance[kind] -= c; C.ledger.push({ id: nextId(C.ledger, 'ICL-', 4), at: nowStr(), kind, movement: 'consumo', credits: -c, balance: C.balance[kind], note: jobId }); const kv = document.querySelectorAll('.kpi .v'); const ix = kind === 'imagenes' ? 1 : 0; if (kv[ix]) kv[ix].textContent = fmtN(C.balance[kind], 0); }
  function gen(kind, tt, tid, tone, loc, note) {
    const id = nextId(DB.aiJobs, 'IAC-', 4); const base = { id, kind, target: tt === 'pagina' ? 'pagina' : tt === 'historia' ? 'historia' : tt === 'libre' ? 'libre' : 'producto', targetId: tid, locale: loc, tone, status: 'listo', at: nowStr(), by: Auth.user.id };
    const tn = { cercano: 'cálido y directo', profesional: 'claro y preciso', aventurero: 'enérgico', lujo: 'sereno y exclusivo', familiar: 'tranquilo y cuidadoso' }[tone] || '';
    if (kind === 'meta_seo') { const p = (DB.seoPages || []).find(x => x.path === tid) || {}; const name = (p.title || tid).split('|')[0].trim(); return Object.assign(base, { targetLabel: 'Página ' + tid, before: { title: p.title || '', desc: p.desc || '(sin descripción)' }, after: { title: (name + ' | ' + (DB.tenant.short || 'Su agencia')).slice(0, 60), desc: (name + ': salidas diarias, guía profesional y reserva en línea con confirmación inmediata. Precios web y pago en cuotas.').slice(0, 155) } }); }
    if (kind === 'relato_aventura') { const s = (DB.travelStories || []).find(x => x.id === tid) || {}; return Object.assign(base, { targetLabel: s.title || tid, before: { text: s.quote || s.body || 'Notas de la reserva y del guía.' }, after: { text: 'Llegaron a ' + (s.city || 'Cusco') + ' con ganas de verlo todo y se fueron con una historia que todavía cuentan. ' + (s.quote ? '«' + s.quote + '», nos escribieron al volver. ' : '') + 'Así fue su viaje, día por día, contado con su permiso.' } }); }
    if (kind === 'articulo') return Object.assign(base, { targetLabel: 'Artículo nuevo', before: { text: note || 'Tema libre' }, after: { text: '# ' + (note || 'Qué hacer en Cusco en 3 días') + '\n\nBorrador de 1 200 palabras con introducción, 5 secciones con H2, preguntas frecuentes, 3 tours enlazados de su catálogo y meta descripción. Tono ' + tn + '. Revise datos y precios antes de publicar.' } });
    const p = DB.products.find(x => x.id === tid) || {};
    if (kind === 'traducir') return Object.assign(base, { targetLabel: (p.name || tid) + ' → ' + LOC[loc === 'es' ? 'en' : loc], locale: loc === 'es' ? 'en' : loc, before: { text: p.short || '' }, after: { text: (loc === 'pt' ? 'Experiência ' : '') + (p.name || '') + ': ' + (loc === 'pt' ? 'passeio com guia profissional, transporte e entradas incluídas. Reserve online com confirmação imediata.' : 'guided experience with professional guide, transport and entrance fees included. Book online with instant confirmation.') } });
    const inc = (p.includes || []).slice(0, 3).join(', ').toLowerCase();
    return Object.assign(base, { targetLabel: p.name || tid, before: { text: p.short || '' }, after: { text: (p.short ? p.short.replace(/\.$/, '') + '. ' : '') + 'Una experiencia ' + (p.category ? p.category.toLowerCase() : '') + ' pensada para disfrutar sin preocupaciones' + (inc ? ': incluye ' + inc : '') + '. ' + (note ? note.trim().replace(/\.?$/, '. ') : '') + 'Grupos pequeños, guía local y confirmación inmediata al reservar.' } });
  }
  function showJob(box, j) {
    const ba = (x) => x ? (x.title != null ? '<div class="small"><b>' + esc(x.title) + '</b></div><div class="small muted" style="margin-top:4px">' + esc(x.desc) + '</div>' : '<div class="small" style="white-space:pre-wrap">' + esc(x.text) + '</div>') : '—';
    box.innerHTML = UI.card(KIND[j.kind] + ' · ' + j.targetLabel, '<div class="ai-ba"><div><h4>Antes</h4>' + ba(j.before) + '</div><div class="after"><h4>Propuesta de la IA</h4>' + ba(j.after) + '</div></div>' +
      '<div class="xs faint" style="margin-top:8px">' + esc(j.id) + ' · ' + j.credits + ' crédito' + (j.credits > 1 ? 's' : '') + ' · ' + esc(LOC[j.locale] || j.locale) + (j.tone ? ' · tono ' + esc(TONE[j.tone] || j.tone) : '') + '. Revise cifras, horarios y precios antes de aplicar.</div>' +
      (j.status === 'listo' ? '<div class="row end" style="margin-top:10px;gap:6px"><button class="btn" data-x="dis">Descartar</button><button class="btn" data-x="re">' + ic('refresh') + 'Otra versión (' + j.credits + ')</button><button class="btn primary" data-x="ap">' + ic('check') + 'Aplicar</button></div>' : '<div style="margin-top:8px">' + UI.badge(j.status) + '</div>'), { sub: 'Generado ' + esc(j.at) });
    const on = (x, fn) => { const e = box.querySelector('[data-x="' + x + '"]'); if (e) e.onclick = fn; };
    on('dis', () => { j.status = 'descartado'; Store.save(); Audit.log('IA contenido', j.id, 'descartar', 'listo', 'descartado'); showJob(box, j); });
    on('re', () => { const c = j.credits; if (DB.aiCredits.balance.contenido < c) { buyModal('contenido'); return; } j.status = 'descartado'; const n = gen(j.kind, j.target === 'pagina' ? 'pagina' : j.target, j.targetId, j.tone, j.kind === 'traducir' ? 'es' : j.locale, ''); n.credits = c; if (n.after.text) n.after.text = n.after.text.replace('pensada para disfrutar sin preocupaciones', 'para vivir con calma y buena compañía'); DB.aiJobs.unshift(n); spend('contenido', c, n.id); Store.save(); showJob(box, n); });
    on('ap', () => {
      if (j.target === 'producto' && j.kind === 'mejorar_texto') { const p = DB.products.find(x => x.id === j.targetId); if (p) p.short = j.after.text; }
      if (j.target === 'producto' && j.kind === 'traducir') { const p = DB.products.find(x => x.id === j.targetId); if (p) { p.i18n = p.i18n || {}; p.i18n[j.locale] = { short: j.after.text }; } }
      if (j.target === 'pagina') { const p = (DB.seoPages || []).find(x => x.path === j.targetId); if (p) { p.title = j.after.title; p.desc = j.after.desc; } }
      if (j.target === 'historia') { const s = (DB.travelStories || []).find(x => x.id === j.targetId); if (s) s.body = j.after.text; }
      j.status = 'aplicado'; j.appliedAt = nowStr(); Store.save(); Audit.log('IA contenido', j.id, 'aplicar', 'listo', j.target + ' ' + (j.targetId || ''));
      UI.toast(j.target === 'libre' ? 'Borrador creado en el blog.' : 'Aplicado. El cambio queda en el historial de auditoría.'); showJob(box, j);
    });
  }
  function aiImages(b) {
    const imgs = DB.aiImages;
    b.innerHTML = '<div class="grid g2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);align-items:start">' +
      UI.card('Crear imágenes', UI.form([{ id: 'im_p', label: 'Describa la imagen', type: 'textarea', required: true, placeholder: 'Ej.: pareja mirando el cañón del Colca al amanecer, cóndor volando, luz dorada', col: 12 },
        { id: 'im_s', label: 'Estilo', type: 'select', options: [['fotografico', 'Fotográfico'], ['ilustracion', 'Ilustración'], ['acuarela', 'Acuarela'], ['mapa', 'Mapa ilustrado'], ['textil', 'Patrón textil andino']], col: 12 },
        { id: 'im_n', label: 'Cantidad', type: 'select', options: [['1', '1'], ['2', '2'], ['4', '4']], value: '2', col: 4 }, { id: 'im_q', label: 'Calidad', type: 'select', options: [['std', 'Estándar 1024 px'], ['hd', 'HD 2048 px']], col: 8 }]) +
        '<div class="ai-cost" id="im-c" style="margin-top:10px"></div><div class="xs faint" style="margin-top:8px">Reglas: no se generan personas reales identificables, logotipos de terceros ni fotos que se hagan pasar por un lugar real distinto. Cada imagen lleva texto alternativo y la etiqueta «Imagen generada con IA» en el sitio.</div>' +
        '<div class="row end" style="margin-top:10px"><button class="btn primary" id="im-go">' + ic('image') + 'Crear</button></div>', { sub: 'Para fotos reales de sus tours, use su propio material: convierte mejor.' }) +
      UI.card('Galería', imgs.length ? '<div class="ai-imgs">' + imgs.map((x, i) => '<div class="ai-img"><div class="pic" style="background:' + art(x.hue, i) + '"><svg viewBox="0 0 200 120" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true"><circle cx="' + (40 + (x.hue % 120)) + '" cy="34" r="14" fill="#fff" fill-opacity=".35"/><path d="M0 120V80l40-30 30 22 45-44 40 34 45-20v78z" fill="#000" fill-opacity=".25"/><path d="M0 120V98l60-18 50 14 50-12 40 8v30z" fill="#000" fill-opacity=".3"/></svg><small>IA' + (x.hd ? ' · HD' : '') + '</small></div><div class="bd"><div class="xs">' + esc(x.alt) + '</div><div class="row between">' + UI.badge(x.status === 'en_uso' ? 'activo' : x.status === 'descartada' ? 'baja' : 'borrador', x.status === 'en_uso' ? 'En uso' : x.status === 'descartada' ? 'Descartada' : 'Generada') + '<span class="xs faint">' + x.credits + ' cr.</span></div>' + (x.status === 'generada' ? '<div class="row" style="gap:4px"><button class="btn xs primary" data-use="' + x.id + '">Usar</button><button class="btn xs" data-alt="' + x.id + '">Texto alt.</button><button class="btn xs" data-del="' + x.id + '">Descartar</button></div>' : x.usedIn.length ? '<div class="xs faint">En: ' + esc(x.usedIn.join(', ')) + '</div>' : '') + '</div></div>').join('') + '</div>' : UI.empty('Aún no hay imágenes.', 'image'), { sub: DB.aiCredits.balance.imagenes + ' créditos de imágenes disponibles' }) + '</div>';
    const cost = () => { const f = UI.formData(b); return (+f.im_n || 1) * (f.im_q === 'hd' ? DB.aiCreditCost.imagen_hd : DB.aiCreditCost.imagen); };
    const upd = () => { const c = cost(); b.querySelector('#im-c').innerHTML = ic('coins') + '<span>Costo: <b>' + c + ' crédito' + (c > 1 ? 's' : '') + ' de imágenes</b> · saldo ' + DB.aiCredits.balance.imagenes + ' → ' + (DB.aiCredits.balance.imagenes - c) + '</span>'; };
    b.querySelectorAll('#im_n,#im_q').forEach(x => x.onchange = upd); upd();
    b.querySelector('#im-go').onclick = () => {
      if (!UI.validate(b)) return; const f = UI.formData(b); const c = cost(); if (String(f.im_p).trim().length < 10) { UI.toast('Describa la imagen con al menos 10 caracteres.', 'bad'); return; }
      if (/\b(logo|marca registrada|famoso|celebridad)\b/i.test(f.im_p)) { UI.toast('El pedido incluye marcas o personas reales; reformúlelo.', 'bad'); return; }
      if (DB.aiCredits.balance.imagenes < c) { buyModal('imagenes'); return; }
      const job = { id: nextId(DB.aiJobs, 'IAC-', 4), kind: 'imagen', target: 'libre', targetLabel: f.im_n + ' imagen(es) · ' + f.im_s, locale: 'es', status: 'listo', credits: c, at: nowStr(), by: Auth.user.id, prompt: f.im_p, style: f.im_s };
      DB.aiJobs.unshift(job); spend('imagenes', c, job.id);
      const hue = Math.abs([...f.im_p].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 360;
      for (let i = 0; i < +f.im_n; i++) DB.aiImages.unshift({ id: nextId(DB.aiImages, 'IMG-', 4), jobId: job.id, alt: String(f.im_p).slice(0, 90), style: f.im_s, hd: f.im_q === 'hd', status: 'generada', usedIn: [], hue: (hue + i * 37) % 360, credits: f.im_q === 'hd' ? 2 : 1 });
      Store.save(); Audit.log('IA imágenes', job.id, 'generar', '', f.im_n + ' · ' + c + ' créditos'); UI.toast(f.im_n + ' imagen(es) creada(s). Revise el texto alternativo antes de usarlas.'); aiImages(b);
    };
    b.querySelectorAll('[data-use]').forEach(x => x.onclick = () => { const im = DB.aiImages.find(z => z.id === x.dataset.use); UI.modal({ title: 'Usar imagen', body: UI.form([{ id: 'u_w', label: 'Dónde', type: 'select', options: [['Banner de inicio', 'Banner de inicio'], ['Galería de un tour', 'Galería de un tour'], ['Artículo del blog', 'Artículo del blog'], ['Historia de aventura', 'Historia de aventura']], col: 12 }, { id: 'u_a', label: 'Texto alternativo', value: im.alt, required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Usar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; const f = UI.formData(m); if (String(f.u_a).trim().length < 5) { UI.toast('El texto alternativo es obligatorio.', 'bad'); return false; } im.alt = f.u_a; im.status = 'en_uso'; im.usedIn.push(f.u_w); Store.save(); Audit.log('IA imágenes', im.id, 'usar', 'generada', f.u_w); aiImages(b); } }] }); });
    b.querySelectorAll('[data-alt]').forEach(x => x.onclick = () => { const im = DB.aiImages.find(z => z.id === x.dataset.alt); UI.modal({ title: 'Texto alternativo', body: UI.form([{ id: 'a_t', label: 'Describa lo que se ve (lectores de pantalla y SEO)', value: im.alt, required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { if (!UI.validate(m)) return false; im.alt = UI.formData(m).a_t; Store.save(); aiImages(b); } }] }); });
    b.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { const im = DB.aiImages.find(z => z.id === x.dataset.del); im.status = 'descartada'; Store.save(); aiImages(b); });
  }
  function aiHistory(b) {
    b.innerHTML = UI.card('Pedidos', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Tipo</th><th>Sobre</th><th>Usuario</th><th class="num">Créditos</th><th>Estado</th></tr></thead><tbody>' + DB.aiJobs.map(j => '<tr><td class="mono">' + esc(j.id) + '<div class="xs faint">' + esc(j.at) + '</div></td><td>' + esc(KIND[j.kind]) + '</td><td>' + esc(j.targetLabel) + '</td><td>' + esc(Q.userName(j.by)) + '</td><td class="num">' + j.credits + '</td><td>' + UI.badge(j.status === 'aplicado' ? 'aplicado' : j.status === 'descartado' ? 'baja' : 'borrador', { aplicado: 'Aplicado', descartado: 'Descartado', listo: 'Por revisar', fallido: 'Fallido (sin cobro)' }[j.status] || j.status) + '</td></tr>').join('') + '</tbody></table></div>', { tight: true, sub: 'Todo pedido queda auditado: quién lo pidió, qué se aplicó y cuántos créditos usó.' });
  }
  function aiPlans(b) {
    const C = DB.aiCredits;
    b.innerHTML = '<div class="grid g3">' + [{ code: 'PLAN', name: 'Incluido en su plan', price: 0, content: C.planIncluded.contenido, images: C.planIncluded.imagenes, features: ['Starter: 0 · Professional: 50 · Enterprise: 100 créditos al mes', 'Sin imágenes'] }].concat(DB.aiPlans).map(p => '<div class="card" style="padding:16px"><div class="row between"><b>' + esc(p.name) + '</b>' + (C.addons.includes(p.code) ? '<span class="badge b-ok">Contratado</span>' : '') + '</div><div style="font-size:1.5rem;font-weight:800;margin:6px 0">' + (p.price ? 'S/ ' + p.price + '<span class="small muted"> /mes</span>' : 'Incluido') + '</div><ul class="small" style="padding-left:18px;margin:0;line-height:1.7">' + p.features.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (p.code !== 'PLAN' && !C.addons.includes(p.code) ? '<button class="btn sm primary" style="margin-top:10px" data-plan="' + p.code + '">Contratar</button>' : '') + '</div>').join('') + '</div>' +
      '<div style="margin-top:14px">' + UI.card('Paquetes de créditos', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Paquete</th><th>Tipo</th><th class="num">Créditos</th><th>Cobro</th><th class="num">Precio</th><th></th></tr></thead><tbody>' + DB.aiCreditPacks.map(p => '<tr><td><b>' + esc(p.name) + '</b><div class="xs faint mono">' + esc(p.code) + '</div></td><td>' + (p.kind === 'imagenes' ? 'Imágenes' : 'Contenido') + '</td><td class="num">' + p.credits + '</td><td>' + (p.billing === 'unico' ? 'Pago único (vence a 12 meses)' : 'Mensual') + '</td><td class="num">S/ ' + p.price + '</td><td style="text-align:right"><button class="btn xs primary" data-pk="' + p.code + '">Comprar</button></td></tr>').join('') + '</tbody></table></div>', { tight: true, sub: 'Precios referenciales sin IGV. Se cobran en su factura de KipuControl.' }) + '</div>' +
      '<div style="margin-top:14px">' + UI.card('Movimientos de créditos', '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Fecha</th><th>Tipo</th><th>Movimiento</th><th class="num">Créditos</th><th class="num">Saldo</th><th>Detalle</th></tr></thead><tbody>' + C.ledger.slice().reverse().map(l => '<tr><td>' + esc(l.at) + '</td><td>' + (l.kind === 'imagenes' ? 'Imágenes' : 'Contenido') + '</td><td>' + esc(l.movement.replace('_', ' ')) + '</td><td class="num ' + (l.credits < 0 ? 'bad' : 'ok') + '">' + (l.credits > 0 ? '+' : '') + l.credits + '</td><td class="num">' + l.balance + '</td><td class="xs">' + esc(l.note || '') + '</td></tr>').join('') + '</tbody></table></div>', { tight: true, sub: 'Libro de solo inserción: los créditos mensuales no se acumulan; los de paquetes vencen a los 12 meses.' }) + '</div>';
    b.querySelectorAll('[data-pk]').forEach(x => x.onclick = () => buyPack(DB.aiCreditPacks.find(p => p.code === x.dataset.pk)));
    b.querySelectorAll('[data-plan]').forEach(x => x.onclick = () => { const p = DB.aiPlans.find(z => z.code === x.dataset.plan); UI.confirm({ title: 'Contratar ' + p.name, message: 'S/ ' + p.price + ' al mes desde hoy (prorrateado en su próxima factura). Se suman ' + p.content + ' créditos de contenido' + (p.images ? ' y ' + p.images + ' de imágenes' : '') + ' cada mes.', confirmLabel: 'Contratar', onConfirm: () => { C.addons = [p.code]; C.balance.contenido += p.content; C.balance.imagenes += p.images; C.ledger.push({ id: nextId(C.ledger, 'ICL-', 4), at: nowStr(), kind: 'contenido', movement: 'asignacion_plan', credits: p.content, balance: C.balance.contenido, note: 'Add-on ' + p.name }); if (p.images) C.ledger.push({ id: nextId(C.ledger, 'ICL-', 4), at: nowStr(), kind: 'imagenes', movement: 'asignacion_plan', credits: p.images, balance: C.balance.imagenes, note: 'Add-on ' + p.name }); Store.save(); Audit.log('IA plan', p.code, 'contratar', '', 'S/ ' + p.price + '/mes'); UI.toast(p.name + ' contratado.'); App.render(); } }); });
  }
  function buyPack(p) {
    const C = DB.aiCredits;
    UI.confirm({ title: 'Comprar ' + p.name, message: 'S/ ' + p.price + ' + IGV' + (p.billing === 'mensual' ? ' al mes' : ', pago único') + '. Se suman ' + p.credits + ' créditos de ' + (p.kind === 'imagenes' ? 'imágenes' : 'contenido') + ' al momento.', confirmLabel: 'Comprar', onConfirm: () => {
      C.balance[p.kind] += p.credits; C.ledger.push({ id: nextId(C.ledger, 'ICL-', 4), at: nowStr(), kind: p.kind, movement: 'compra_paquete', credits: p.credits, balance: C.balance[p.kind], note: 'Paquete ' + p.code + ' · S/ ' + p.price });
      Store.save(); Audit.log('IA créditos', p.code, 'comprar', '', p.credits + ' créditos'); UI.toast(p.credits + ' créditos agregados.'); App.render(); } });
  }
  function buyModal(kind) {
    const packs = DB.aiCreditPacks.filter(p => p.kind === kind);
    UI.modal({ title: 'Créditos insuficientes', body: UI.alert('warn', 'No tiene créditos de ' + (kind === 'imagenes' ? 'imágenes' : 'contenido') + ' suficientes para este pedido.') + '<div class="list" style="margin-top:10px">' + packs.map(p => '<div class="list-item row between"><span><b>' + esc(p.name) + '</b><div class="xs faint">' + (p.billing === 'unico' ? 'Pago único' : 'Mensual') + '</div></span><button class="btn sm primary" data-bp="' + p.code + '">S/ ' + p.price + '</button></div>').join('') + '</div>',
      actions: [{ label: 'Cerrar' }], onOpen: (m) => m.querySelectorAll('[data-bp]').forEach(x => x.onclick = () => { UI.closeModal(); buyPack(packs.find(p => p.code === x.dataset.bp)); }) });
  }

  /* =========================================================================
     3) Plataforma: #/admin/plantillas
     ========================================================================= */
  App.register('admin/plantillas', (el, params) => {
    ensure(); if (!isSA()) { el.innerHTML = '<div class="page">' + UI.alert('warn', 'Solo el Super Admin SaaS administra el catálogo de plantillas.') + '</div>'; return; }
    const T = DB.siteTemplates; const S = DB.templateSubmissions;
    const prem = T.filter(t => t.tier === 'premium'); const rev = sum(prem, t => t.price * t.installs);
    el.innerHTML = MOCK_CSS + '<div class="page">' + UI.pageHeader({ title: 'Plantillas web', crumbs: [['Plataforma', '#/admin/tenants'], ['Plantillas web']], subtitle: 'Catálogo de diseños para el sitio público de las agencias. El equipo de desarrollo o un partner envía cada versión; pasa validaciones automáticas (manifiesto, build, Lighthouse, contraste, datos estructurados, seguridad) y la revisión visual antes de publicarse.' }) +
      '<div class="grid g4">' + UI.kpi({ label: 'Publicadas', value: T.filter(t => t.status === 'publicado').length, sub: T.length + ' en el catálogo', icon: 'layout', tone: 'accent' }) + UI.kpi({ label: 'En revisión', value: S.filter(s => ['recibida', 'validando'].includes(s.status)).length, sub: 'envíos pendientes', icon: 'clock', tone: 'sun' }) +
      UI.kpi({ label: 'Agencias con plantilla', value: DB.tenantThemes.length, sub: DB.tenantThemes.filter(x => x.chosenBy === 'agencia').length + ' la cambiaron ellas mismas', icon: 'building', tone: 'info' }) + UI.kpi({ label: 'Ventas premium', value: 'S/ ' + fmtN(rev, 0), sub: prem.reduce((a, t) => a + t.installs, 0) + ' compras', icon: 'coins', tone: 'ok' }) + '</div><div id="tpa-tabs" style="margin-top:14px"></div></div>';
    UI.tabs(el.querySelector('#tpa-tabs'), [
      { id: 'catalogo', label: 'Catálogo', count: T.length, render: admCat },
      { id: 'envios', label: 'Envíos a revisión', count: S.filter(s => ['recibida', 'validando'].includes(s.status)).length, render: admSub },
      { id: 'agencias', label: 'Por agencia', count: DB.tenantThemes.length, render: admTen },
      { id: 'dev', label: 'Para desarrolladores', render: admDev }
    ], ['envios', 'agencias', 'dev'].includes(params[0]) ? params[0] : 'catalogo');
  });
  function admCat(b) {
    const T = DB.siteTemplates;
    b.innerHTML = UI.card('Catálogo', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:150px">Vista</th><th>Plantilla</th><th>Tipo</th><th>Versión</th><th>Lighthouse</th><th class="num">Agencias</th><th>Estado</th><th></th></tr></thead><tbody>' + T.map(t => '<tr><td>' + mock(t) + '</td><td><b>' + esc(t.name) + '</b>' + (t.isDefault ? ' <span class="badge b-accent">Por defecto</span>' : '') + '<div class="xs faint">' + esc(t.author) + ' · ' + esc(CAT[t.category]) + (t.minPlan ? ' · desde ' + esc(t.minPlan) : '') + '</div></td><td>' + tierBadge(t) + '</td><td class="mono">' + esc(t.version) + '</td><td>' + lhChips(t.lh) + '</td><td class="num">' + t.installs + '</td><td>' + UI.badge(t.status === 'publicado' ? 'publicado' : t.status === 'retirado' ? 'baja' : 'borrador', { publicado: 'Publicada', en_revision: 'En revisión', borrador: 'Borrador', retirado: 'Retirada' }[t.status]) + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' + (t.status === 'publicado' && !t.isDefault && t.tier === 'incluida' ? '<button class="btn xs" data-df="' + t.id + '">Por defecto</button> ' : '') + (t.status === 'publicado' && !t.isDefault ? '<button class="btn xs" data-rt="' + t.id + '">Retirar</button> ' : '') + (t.status === 'retirado' ? '<button class="btn xs" data-rp="' + t.id + '">Republicar</button> ' : '') + '<button class="btn xs" data-ed="' + t.id + '">Editar</button></td></tr>').join('') + '</tbody></table></div>', { tight: true, sub: 'La plantilla por defecto se asigna al alta de una agencia que no elige otra. Retirar no afecta a las agencias que ya la usan: se les ofrece migrar.' });
    b.querySelectorAll('[data-df]').forEach(x => x.onclick = () => { DB.siteTemplates.forEach(t => t.isDefault = t.id === x.dataset.df); Store.save(); Audit.log('Plantilla', x.dataset.df, 'por_defecto', '', 'nuevas agencias'); App.render(); });
    b.querySelectorAll('[data-rt]').forEach(x => x.onclick = () => UI.confirm({ title: 'Retirar plantilla', message: 'Deja de mostrarse en la galería. Las ' + TPL(x.dataset.rt).installs + ' agencias que la usan la conservan y reciben aviso para migrar.', danger: true, confirmLabel: 'Retirar', onConfirm: () => { TPL(x.dataset.rt).status = 'retirado'; Store.save(); Audit.log('Plantilla', x.dataset.rt, 'retirar', 'publicado', 'retirado'); App.render(); } }));
    b.querySelectorAll('[data-rp]').forEach(x => x.onclick = () => { TPL(x.dataset.rp).status = 'publicado'; Store.save(); App.render(); });
    b.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => { const t = TPL(x.dataset.ed); UI.modal({ title: 'Editar ' + t.name, body: UI.form([{ id: 'e_n', label: 'Nombre', value: t.name, required: true, col: 6 }, { id: 'e_c', label: 'Categoría', type: 'select', options: Object.entries(CAT), value: t.category, col: 6 }, { id: 'e_t', label: 'Tipo', type: 'select', options: [['incluida', 'Incluida (sin costo)'], ['premium', 'Premium (pago único)']], value: t.tier, col: 4 }, { id: 'e_p', label: 'Precio S/ (premium)', type: 'number', value: t.price, col: 4 }, { id: 'e_m', label: 'Plan mínimo', type: 'select', options: [['', 'Cualquiera'], ['Starter', 'Starter'], ['Professional', 'Professional'], ['Enterprise', 'Enterprise']], value: t.minPlan || '', col: 4 }, { id: 'e_d', label: 'Descripción', type: 'textarea', value: t.desc, col: 12 }]),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: (m) => { const f = UI.formData(m); const price = +f.e_p || 0; if (f.e_t === 'premium' && price <= 0) { UI.toast('Una plantilla premium necesita precio.', 'bad'); return false; } if (f.e_t === 'premium' && t.isDefault) { UI.toast('La plantilla por defecto debe ser incluida.', 'bad'); return false; } Object.assign(t, { name: f.e_n, category: f.e_c, tier: f.e_t, price: f.e_t === 'premium' ? price : 0, minPlan: f.e_m || null, desc: f.e_d }); Store.save(); Audit.log('Plantilla', t.id, 'editar', '', t.tier + ' ' + t.price); App.render(); } }] }); });
  }
  const CHK = { manifest: 'Manifiesto válido', build: 'Build y SSR', lighthouse: 'Lighthouse móvil', contraste: 'Contraste WCAG AA', i18n: 'Textos ES/EN/PT', datos_estructurados: 'Datos estructurados', seguridad: 'Seguridad (sin scripts externos)', revision_visual: 'Revisión visual' };
  const MIN = { perf: 85, a11y: 95, seo: 95, bp: 90 };
  function admSub(b) {
    const S = DB.templateSubmissions;
    b.innerHTML = S.map(s => { const t = TPL(s.templateId) || { name: s.templateId }; const lh = s.checks.lighthouse; const lhOk = Object.keys(MIN).every(k => lh[k] >= MIN[k]);
      return UI.card(esc(t.name) + ' v' + esc(s.version), '<div class="grid g4">' + Object.entries(CHK).map(([k, l]) => { const v = k === 'lighthouse' ? (lhOk ? 'ok' : 'falla') : s.checks[k]; return '<div style="display:flex;gap:8px;align-items:flex-start">' + (v === 'ok' ? '<span class="ok" style="flex:none">' + ic('checkCircle') + '</span>' : v === 'falla' ? '<span class="bad" style="flex:none">' + ic('x') + '</span>' : '<span class="faint" style="flex:none">' + ic('clock') + '</span>') + '<div><div class="small"><b>' + esc(l) + '</b></div><div class="xs faint">' + (k === 'lighthouse' ? 'R ' + lh.perf + ' · A ' + lh.a11y + ' · SEO ' + lh.seo + ' · BP ' + lh.bp + ' (mín. 85/95/95/90)' : v === 'ok' ? 'Correcto' : v === 'falla' ? 'No cumple' : 'Pendiente') + '</div></div></div>'; }).join('') + '</div>' +
        (s.reason ? '<div style="margin-top:10px">' + UI.alert('bad', '<b>Motivo del rechazo:</b> ' + esc(s.reason)) + '</div>' : '') +
        (['recibida', 'validando'].includes(s.status) ? '<div class="row end" style="gap:6px;margin-top:10px"><button class="btn sm" data-pvs="' + s.templateId + '">' + ic('eye') + 'Vista previa con datos demo</button><button class="btn sm danger" data-rj="' + s.id + '">Rechazar</button><button class="btn sm primary" data-okk="' + s.id + '">Aprobar y publicar</button></div>' : ''),
        { sub: esc(s.id) + ' · ' + esc(s.by) + ' · ' + esc(s.at) + ' · ' + { recibida: 'Recibida', validando: 'Validando', aprobada: 'Aprobada ' + (s.decidedAt || ''), rechazada: 'Rechazada ' + (s.decidedAt || '') }[s.status] }); }).join('<div style="height:12px"></div>');
    b.querySelectorAll('[data-pvs]').forEach(x => x.onclick = () => KipuTpl.preview(x.dataset.pvs));
    b.querySelectorAll('[data-okk]').forEach(x => x.onclick = () => { const s = DB.templateSubmissions.find(z => z.id === x.dataset.okk); const lh = s.checks.lighthouse;
      if (!Object.keys(MIN).every(k => lh[k] >= MIN[k])) { UI.toast('No se puede aprobar: Lighthouse por debajo del mínimo.', 'bad'); return; }
      const bad = Object.entries(s.checks).filter(([k, v]) => k !== 'lighthouse' && k !== 'revision_visual' && v !== 'ok'); if (bad.length) { UI.toast('Hay validaciones que no pasan: ' + bad.map(([k]) => CHK[k]).join(', '), 'bad'); return; }
      UI.confirm({ title: 'Aprobar y publicar', message: 'Confirmo la revisión visual (360, 768 y 1280 px, claro y oscuro). La versión ' + s.version + ' se publica en la galería de todas las agencias.', confirmLabel: 'Publicar', onConfirm: () => { s.status = 'aprobada'; s.checks.revision_visual = 'ok'; s.decidedAt = nowStr(); s.reviewer = Auth.user.id; const t = TPL(s.templateId); t.status = 'publicado'; t.version = s.version; Store.save(); Audit.log('Plantilla envío', s.id, 'aprobar', 'validando', 'publicada ' + s.version); UI.toast(t.name + ' publicada.'); App.render(); } }); });
    b.querySelectorAll('[data-rj]').forEach(x => x.onclick = () => UI.modal({ title: 'Rechazar envío', body: UI.form([{ id: 'r_r', label: 'Motivo (se envía al autor; mínimo 10 caracteres)', type: 'textarea', required: true, col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Rechazar', cls: 'danger', onClick: (m) => { if (!UI.validate(m)) return false; const r = UI.formData(m).r_r; if (r.trim().length < 10) { UI.toast('Explique el motivo (mínimo 10 caracteres).', 'bad'); return false; } const s = DB.templateSubmissions.find(z => z.id === x.dataset.rj); s.status = 'rechazada'; s.reason = r; s.decidedAt = nowStr(); s.reviewer = Auth.user.id; Store.save(); Audit.log('Plantilla envío', s.id, 'rechazar', 'validando', 'rechazada'); App.render(); } }] }));
  }
  function admTen(b) {
    const pub = DB.siteTemplates.filter(t => t.status === 'publicado');
    b.innerHTML = UI.card('Plantilla por agencia', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Agencia</th><th>Plantilla</th><th>Versión</th><th>Elegida por</th><th></th></tr></thead><tbody>' + DB.tenantThemes.map((x, i) => { const t = TPL(x.templateId) || { name: x.templateId, version: x.version }; return '<tr><td><b>' + esc(x.tenant) + '</b><div class="xs faint mono">' + esc(x.tenantId) + '</div></td><td>' + esc(t.name) + '</td><td class="mono">' + esc(x.version) + (t.version !== x.version ? ' <span class="badge b-sun">v' + esc(t.version) + ' disponible</span>' : '') + '</td><td>' + { alta: 'Al contratar', agencia: 'La agencia', admin_plataforma: 'Plataforma' }[x.chosenBy] + '</td><td style="text-align:right"><button class="btn xs" data-as="' + i + '">Asignar</button></td></tr>'; }).join('') + '</tbody></table></div>', { tight: true, sub: 'El Super Admin puede asignar una plantilla a una agencia (por ejemplo, al hacer el alta asistida). La agencia puede cambiarla después desde su panel.' });
    b.querySelectorAll('[data-as]').forEach(x => x.onclick = () => { const r = DB.tenantThemes[+x.dataset.as]; UI.modal({ title: 'Asignar plantilla a ' + r.tenant, body: UI.form([{ id: 'a_t', label: 'Plantilla', type: 'select', options: pub.map(t => [t.id, t.name + (t.tier === 'premium' ? ' (premium, cortesía)' : '')]), value: r.templateId, col: 12 }, { id: 'a_n', label: 'Nota para la agencia', type: 'textarea', col: 12 }]), actions: [{ label: 'Cancelar' }, { label: 'Asignar', cls: 'primary', onClick: (m) => { const f = UI.formData(m); const t = TPL(f.a_t); const before = r.templateId; r.templateId = t.id; r.version = t.version; r.chosenBy = 'admin_plataforma'; if (r.tenantId === DB.tenant.id) { DB.siteTheme.history.push({ templateId: DB.siteTheme.templateId, version: DB.siteTheme.version, from: String(DB.siteTheme.appliedAt).slice(0, 10), to: nowStr().slice(0, 10), by: 'Plataforma' }); Object.assign(DB.siteTheme, { templateId: t.id, version: t.version, chosenBy: 'admin_plataforma', appliedAt: nowStr(), appliedBy: null, overrides: {} }); if (t.tier === 'premium') DB.siteTheme.purchased = (DB.siteTheme.purchased || []).concat(t.id); } Store.save(); Audit.log('Plantilla', r.tenantId, 'asignar', before, t.id); Notify.push('plantilla.asignada', 'Email', r.tenant, 'Nueva plantilla para su sitio: ' + t.name + (f.a_n ? ' — ' + f.a_n : '')); App.render(); } }] }); });
  }
  function admDev(b) {
    const ex = JSON.stringify({ id: 'inti-raymi', name: 'Inti Raymi', version: '1.4.0', kipu: '^2.9', category: 'agencia', tier: 'incluida', author: { name: 'Equipo KipuControl', email: 'plantillas@kipucontrol.com' }, tokens: { side: '#7E1526', accent: '#C8102E', soft: '#FBEDE6', sun: '#E3A33B', radius: 18, font: { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' } }, sections: ['hero_buscador', 'destinos', 'mas_vendidos', 'resenas', 'aventuras', 'blog'], pages: ['inicio', 'buscar', 'destino', 'tour', 'carrito', 'checkout', 'blog', 'articulo', 'aventuras', 'contacto', 'legal', 'libro_reclamaciones'], locales: ['es', 'en', 'pt'], darkMode: true }, null, 2);
    b.innerHTML = '<div class="grid g2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' + UI.card('Cómo se construye una plantilla', '<ol class="small" style="padding-left:18px;margin:0;line-height:1.8"><li>Clonar el repositorio <span class="mono">kipu-site-templates</span> y crear la carpeta <span class="mono">templates/&lt;slug&gt;</span> desde <span class="mono">_starter</span>.</li><li>Declarar <span class="mono">template.json</span> (manifiesto) y los tokens; no tocar datos ni API: la plantilla solo recibe props tipadas del SDK <span class="mono">@kipu/site-sdk</span>.</li><li>Implementar las 12 páginas obligatorias y las secciones que declare, en Next.js (App Router, RSC), sin scripts externos.</li><li><span class="mono">pnpm kipu-tpl dev</span> levanta la plantilla con los datos demo; <span class="mono">pnpm kipu-tpl check</span> corre manifiesto, build, Lighthouse, axe, contraste, i18n y JSON-LD.</li><li><span class="mono">pnpm kipu-tpl submit</span> empaqueta (tgz + SHA-256) y crea el envío; aparece en «Envíos a revisión».</li><li>Al aprobar, la versión se publica en la galería; las agencias que la usan reciben la actualización menor automáticamente y la mayor con aviso.</li></ol>', { sub: 'Detalle completo en la spec 23 §13 (contrato técnico).' }) +
      UI.card('Manifiesto de ejemplo', '<div class="code">' + esc(ex) + '</div>', { sub: 'kit/design/plantillas/template.schema.json valida este archivo.' }) + '</div>' +
      '<div style="margin-top:14px">' + UI.card('Requisitos para publicar', '<div class="tbl-wrap"><table class="tbl compact"><tbody>' + [['Lighthouse móvil', 'Rendimiento ≥ 85, accesibilidad ≥ 95, SEO ≥ 95, buenas prácticas ≥ 90'], ['Web Vitals', 'LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms en 4G simulada'], ['Peso', 'JS inicial ≤ 170 KB gzip por página; imágenes con next/image, AVIF/WebP y tamaños'], ['Accesibilidad', 'WCAG 2.2 AA: contraste 4,5:1, foco visible, navegación por teclado, textos alternativos'], ['Responsive', '360, 768 y 1280 px sin scroll horizontal; objetivos táctiles ≥ 40 px'], ['Modo oscuro', 'Tokens claros y oscuros; respeta prefers-color-scheme'], ['SEO', 'Metadatos por página, canónica, hreflang, sitemap, JSON-LD (TouristTrip, Product, BreadcrumbList, BlogPosting, Organization)'], ['Idiomas', 'Sin textos fijos: todo desde el diccionario es/en/pt'], ['Seguridad', 'Sin scripts ni fuentes de terceros fuera de la lista permitida; CSP estricta; sin acceso a cookies de sesión'], ['Legal Perú', 'Libro de Reclamaciones visible, política de privacidad (Ley 29733) y términos']].map(r => '<tr><td style="width:180px"><b>' + r[0] + '</b></td><td class="small">' + r[1] + '</td></tr>').join('') + '</tbody></table></div>', { tight: true }) + '</div>';
  }
})();
