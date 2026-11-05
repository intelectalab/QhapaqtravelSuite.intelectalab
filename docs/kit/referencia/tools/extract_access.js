#!/usr/bin/env node
/*
 * Genera, ejecutando el prototipo en Chromium headless (Playwright):
 *   kit-ia/referencia/PERMISOS-ROL.csv      rol × permiso (1/0) desde DB.rolePerms
 *   kit-ia/referencia/ACCESO-PANTALLAS.csv  ruta × rol (permitido/denegado) + permiso requerido, con Access.checkFor
 *   kit-ia/referencia/PERMISOS.md           modelo de permisos, roles, ownership, ROLE_UX y externos
 *
 * Uso (desde la raíz del proyecto, donde está node_modules/playwright):
 *   node kit-ia/referencia/tools/extract_access.js
 * Variables opcionales: CHROMIUM=/ruta/al/headless_shell  PROTO=/ruta/a/proto/index.html
 *
 * Fuentes en el prototipo: DB.roles, DB.permissionGroups, DB.rolePerms (data.js), Access.ROUTES (= ACCESS),
 * Access.ROLE_UX, App.NAV, rutas registradas con App.register (se interceptan al cargar), Access.checkFor
 * (misma regla que el router y que Administración › Roles › «Mapa de acceso»). Se valida además contra la tabla
 * del «Mapa de acceso» renderizada en pantalla.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '..');
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))); } catch (e) { ({ chromium } = require('playwright')); }
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
/* Estructura original (proto/) o espacio de trabajo (docs/prototipo/) */
const PROTO_DIR = fs.existsSync(path.join(ROOT, 'proto', 'index.html')) ? path.join(ROOT, 'proto') : path.join(ROOT, 'prototipo');
const PROTO = process.env.PROTO || path.join(PROTO_DIR, 'index.html');

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvLine = (arr) => arr.map(csvCell).join(',');
const mdEsc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/* Descripciones de permisos: objeto CAP de Administración › Roles (admin.js), leído del código fuente. */
function readCap() {
  const src = fs.readFileSync(path.join(PROTO_DIR, 'assets/js/modules/admin.js'), 'utf8');
  const m = src.match(/const CAP = \{([\s\S]*?)\};/);
  const cap = {};
  if (m) for (const mm of m[1].matchAll(/'([a-z0-9_.]+)':\s*'([^']*)'/g)) cap[mm[1]] = mm[2];
  /* Permisos agregados en v2.x que no figuran en CAP: descripción derivada de la pantalla que habilitan (spec 00 §7.1, §11 fila 15). */
  const derived = {
    'admin.billing.manage': 'suscripción, plan y facturación de la plataforma (admin/suscripcion)',
    'admin.api.manage': 'API keys, apps OAuth y webhooks del tenant (admin/api)',
    'approvals.view': 'bandeja de aprobaciones (aprobaciones)',
    'inbox.view': 'consultar la bandeja omnicanal (inbox)',
    'inbox.manage': 'responder y gestionar conversaciones del inbox',
    'crm.targets.view': 'consultar metas comerciales (crm/metas)',
    'crm.targets.manage': 'crear y ajustar metas comerciales',
    'crm.claims.manage': 'reclamaciones y libro de reclamaciones',
    'marketing.campaigns.manage': 'campañas, segmentos y automatizaciones de marketing',
    'catalog.allotments.manage': 'contratos de cupos (allotments) y liberaciones',
    'operations.travel_docs': 'documentos de viaje de los pasajeros',
    'finance.treasury': 'tesorería: cuentas, caja chica y movimientos'
  };
  for (const [k, v] of Object.entries(derived)) if (!cap[k]) cap[k] = v + ' — derivada de la pantalla (supuesto)';
  return cap;
}

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('qhapaq_session', 'U01'); } catch (e) { }
    window.__ROUTES__ = [];
    let _app;
    Object.defineProperty(window, 'App', {
      configurable: true,
      get() { return _app; },
      set(v) {
        const orig = v.register.bind(v);
        v.register = (p, def) => { window.__ROUTES__.push(p); return orig(p, def); };
        _app = v;
      }
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + PROTO + '#/dashboard');
  await page.waitForFunction(() => window.DB && window.Access && window.App && window.__ROUTES__.length > 20, null, { timeout: 15000 });
  await page.waitForTimeout(300);

  const data = await page.evaluate(() => {
    const ACCESS = Access.ROUTES;
    const needFor = (p) => { const segs = p.split('/'); for (let i = segs.length; i > 0; i--) { const k = segs.slice(0, i).join('/'); if (ACCESS[k]) return { key: k, need: ACCESS[k] }; } return { key: null, need: null }; };
    const roles = DB.roles.map(r => {
      const ux = Access.ROLE_UX[r.id] || { layout: 'backoffice' };
      let routes = null, home = null, nav = null;
      try { routes = ux.routes || null; home = ux.home || null; nav = ux.nav || null; } catch (e) { }
      return { id: r.id, name: r.name, desc: r.desc, scope: r.scope, layout: ux.layout, label: ux.label || '', home, routes, nav };
    });
    const navItems = App.NAV.flatMap(g => g.items.map(i => ({ r: i.r, label: i.label, group: g.group })));
    const ext = [
      { r: 'canales/b2b/portal/catalogo', label: 'Portal de agencias B2B', group: 'Portales y apps externas' },
      { r: 'canales/portal-cliente/CLI-0001/inicio', label: 'Portal del cliente (autoservicio)', group: 'Portales y apps externas' },
      { r: 'canales/portal-pasajero/viajes', label: 'Portal del pasajero', group: 'Portales y apps externas' },
      { r: 'proveedor/solicitudes', label: 'Extranet de proveedores', group: 'Portales y apps externas' },
      { r: 'mobile/operador', label: 'App del operador (guía / conductor)', group: 'Portales y apps externas' },
      { r: 'mobile/pasajero', label: 'App del pasajero', group: 'Portales y apps externas' }
    ];
    const seen = new Set(); const screens = [];
    const add = (s, src) => { if (seen.has(s.r)) return; seen.add(s.r); screens.push(Object.assign({ source: src }, s)); };
    navItems.forEach(s => add(s, 'menú'));
    ext.forEach(s => add(s, 'portal/app'));
    window.__ROUTES__.slice().sort().forEach(r => add({ r, label: '', group: '' }, 'ruta registrada'));
    const rows = screens.map(s => {
      const n = needFor(s.r);
      const res = {}; roles.forEach(ro => { res[ro.id] = Access.checkFor(ro.id, s.r); });
      return Object.assign({}, s, { accessKey: n.key, need: n.need, res });
    });
    return {
      roles, groups: DB.permissionGroups, rolePerms: DB.rolePerms, access: ACCESS, rows,
      registered: window.__ROUTES__.slice(), nav: App.NAV.map(g => ({ group: g.group, items: g.items.map(i => i.r) }))
    };
  });

  /* Verificación contra la tabla «Mapa de acceso» que dibuja Administración › Roles. */
  await page.evaluate(() => { location.hash = '#/admin/roles/mapa'; });
  await page.waitForTimeout(600);
  const mapTab = await page.$('[data-rv="map"]');
  if (mapTab) { await mapTab.click(); await page.waitForTimeout(400); }
  const uiMap = await page.evaluate(() => {
    const t = document.querySelector('.am-matrix'); if (!t) return null;
    const heads = [...t.querySelectorAll('thead th')].slice(1).map(th => th.childNodes[0].textContent.trim());
    const out = [];
    t.querySelectorAll('tbody tr:not(.am-g)').forEach(tr => {
      const route = (tr.querySelector('.mono') || {}).textContent; if (!route) return;
      const cells = [...tr.querySelectorAll('td')].slice(1).map(td => !!td.querySelector('.am-y'));
      out.push({ route: route.replace(/^#\//, ''), cells });
    });
    return { heads, out };
  });
  await browser.close();

  const roleIds = data.roles.map(r => r.id);
  let checked = 0, mismatches = [];
  if (uiMap) {
    const byName = Object.fromEntries(data.roles.map(r => [r.name, r.id]));
    for (const row of uiMap.out) {
      const mine = data.rows.find(x => x.r === row.route); if (!mine) continue;
      uiMap.heads.forEach((h, i) => { const rid = byName[h]; if (!rid) return; checked++; if (mine.res[rid] !== row.cells[i]) mismatches.push(`${row.route}/${rid}`); });
    }
  }

  /* ---------------- PERMISOS-ROL.csv ---------------- */
  const CAP = readCap();
  const allPerms = data.groups.flatMap(g => g.perms.map(p => ({ perm: p, module: g.module })));
  const screensFor = (perm) => Object.entries(data.access).filter(([, need]) => need.includes(perm)).map(([k]) => k);
  const lines = [csvLine(['permiso', 'modulo', 'descripcion', 'pantallas_que_habilita', ...roleIds])];
  for (const { perm, module } of allPerms) {
    lines.push(csvLine([perm, module, CAP[perm] || '', screensFor(perm).join(' | '), ...roleIds.map(r => (data.rolePerms[r] || []).includes(perm) ? 1 : 0)]));
  }
  lines.push(csvLine(['TOTAL', '', '', '', ...roleIds.map(r => (data.rolePerms[r] || []).length)]));
  fs.writeFileSync(path.join(OUT, 'PERMISOS-ROL.csv'), lines.join('\n') + '\n');

  /* ---------------- ACCESO-PANTALLAS.csv ---------------- */
  const reqText = (row) => {
    if (!row.need) return 'ninguno (sin entrada en ACCESS: cualquier rol interno)';
    if (row.need[0] === '*') return '* (cualquier rol interno)';
    return row.need.join(' | ');
  };
  const al = [csvLine(['ruta', 'origen', 'grupo_menu', 'pantalla', 'clave_access', 'permiso_requerido_cualquiera', ...roleIds])];
  for (const row of data.rows) {
    al.push(csvLine(['#/' + row.r, row.source, row.group, row.label, row.accessKey || '', reqText(row), ...roleIds.map(r => row.res[r] ? 'permitido' : 'denegado')]));
  }
  fs.writeFileSync(path.join(OUT, 'ACCESO-PANTALLAS.csv'), al.join('\n') + '\n');

  /* ---------------- PERMISOS.md ---------------- */
  const short = { super_admin: 'SA', tenant_admin: 'TA', manager: 'MG', sales: 'VT', operations: 'OP', finance: 'FI', accounting: 'CO', guide: 'GU', driver: 'CD', b2b: 'B2B', customer: 'CL', passenger: 'PA', provider: 'PR' };
  const S = (r) => short[r] || r;
  const L = [];
  const A = (s = '') => L.push(s);
  A('# Modelo de permisos, roles y acceso a pantallas');
  A();
  A('> Generado por `kit-ia/referencia/tools/extract_access.js` ejecutando el prototipo (`proto/index.html`) en Chromium headless: ' +
    '`DB.roles`, `DB.permissionGroups`, `DB.rolePerms`, `Access.ROUTES` (ACCESS), `Access.ROLE_UX`, `App.NAV` y las rutas registradas con `App.register`; ' +
    'el acceso se evalúa con `Access.checkFor`, la misma función del «Mapa de acceso» de Administración › Roles. Especificación de referencia: 00 §7 y 09 (RBAC-BR, USR-BR).');
  A();
  A(`**Cifras:** ${allPerms.length} permisos en ${data.groups.length} módulos · ${roleIds.length} roles de sistema · ${data.rows.length} rutas evaluadas ` +
    `(${data.rows.filter(r => r.source === 'menú').length} del menú, ${data.registered.length} registradas en el router) · ` +
    (uiMap ? `verificación contra el «Mapa de acceso» en pantalla: ${checked} celdas comparadas, ${mismatches.length} diferencias.` : 'no se pudo leer el «Mapa de acceso» en pantalla.') +
    (errors.length ? ` Errores JS durante la carga: ${errors.length}.` : ''));
  A();
  A('Archivos: `PERMISOS-ROL.csv` (permiso × rol, 1/0, con descripción y pantallas que habilita) · `ACCESO-PANTALLAS.csv` (ruta × rol: `permitido`/`denegado` y permisos requeridos).');
  A();
  A('## 1. Cómo funciona');
  A();
  A('1. **Permisos** con nombre `modulo.recurso.accion` (spatie/laravel-permission con *teams* = tenant). El backend valida cada endpoint con Policy + permiso (`x-permissions` del contrato); el frontend solo oculta o deshabilita (SEC-BR-03, SEC-BR-14). En backend no se admiten comodines; el prototipo acepta prefijos terminados en `.` pero ningún rol semilla los usa.');
  A('2. **Roles**: 13 roles de sistema (plantillas con `tenant_id NULL`) y roles personalizados por tenant (`custom_…`) que heredan la experiencia de su `scope`. La matriz semilla es `DB.rolePerms` (tablas `roles`, `permissions`, `role_has_permissions`).');
  A('3. **Acceso a pantallas** (`Access.check` / `GET /api/v1/me/access`): (a) sin sesión → login; (b) experiencia externa → solo sus prefijos de `ROLE_UX.routes`; (c) Super Admin → solo `admin/tenants`, `admin/plataforma`, `admin/integraciones`, `admin/auditoria`; (d) resto → se busca en ACCESS el **prefijo más largo** de la ruta; `*` o sin entrada = permitido; si no, basta **cualquiera** de los permisos listados. Menú, URL directa y búsqueda global usan la misma regla; el 403 se audita (SEC-BR-07).');
  A('4. **Alcance de datos (ownership)**: Ventas (`sales`) solo ve y gestiona su cartera (`owner_id = auth.id`): leads (también sin asignar en contadores), oportunidades, actividades, cotizaciones, reservas y clientes derivados (`clientIds()` = propios ∪ de sus oportunidades/cotizaciones/reservas). Detalle ajeno → 403 `SCOPE_OWNERSHIP`; `filter[owner]=me` forzado en servidor. Manager y Tenant Admin ven todo el tenant con filtro «Asesor» (SEC-BR-09/10/11).');
  A('5. **Datos sensibles**: costos, márgenes y utilidad solo con `finance.profitability`, `catalog.products.view_profitability` o `quotes.approve_internal`; Operaciones ve costos de proveedor pero no márgenes; externos nunca ven costos (SEC-BR-13, `JsonResource` condicional).');
  A('6. **Usuarios externos** (guía, conductor, B2B, cliente, pasajero, proveedor): nunca entran al back-office; solo a su portal/app y siempre filtrados por su vínculo (`client_id`, `reservation_id`, `agency_id`, `provider_id`, `guide_id`/`driver_id`; SEC-BR-05/12). Sus permisos se interpretan con ese alcance (p. ej. `reservations.view` de un cliente = sus reservas). API separada por experiencia: `/api/v1/portal/client/*`, `/portal/passenger/*`, `/b2b/*`, `/supplier/*`, `/mobile/operator/*` (abilities del token).');
  A();
  A('## 2. Roles y experiencias (ROLE_UX)');
  A();
  A('| Rol | Abrev. | Nombre | Descripción | scope | Experiencia | Inicio | Rutas permitidas | Nº permisos |');
  A('|---|---|---|---|---|---|---|---|---|');
  for (const r of data.roles) {
    const routes = r.id === 'super_admin' ? 'admin/tenants, admin/plataforma, admin/integraciones, admin/auditoria (regla fija)'
      : (r.routes ? r.routes.join(', ') : 'según ACCESS');
    A(`| \`${r.id}\` | ${S(r.id)} | ${mdEsc(r.name)} | ${mdEsc(r.desc)} | ${r.scope} | ${r.layout}${r.label ? ' · ' + mdEsc(r.label) : ''} | \`${r.home || '#/dashboard'}\` | ${mdEsc(routes)} | ${(data.rolePerms[r.id] || []).length} |`);
  }
  A();
  A('## 3. Catálogo de permisos y matriz por rol');
  A();
  A('✓ = el rol semilla tiene el permiso. *Pantallas* = rutas de ACCESS que el permiso habilita (por sí solo o como alternativa).');
  A();
  A('| Permiso | Módulo | Descripción | Pantallas | ' + roleIds.map(S).join(' | ') + ' |');
  A('|---|---|---|---|' + roleIds.map(() => '---').join('|') + '|');
  for (const { perm, module } of allPerms) {
    A(`| \`${perm}\` | ${module} | ${mdEsc(CAP[perm] || 'Por definir (sin descripción en el prototipo)')} | ${screensFor(perm).map(s => '`' + s + '`').join(', ') || '— (acciones dentro de pantallas)'} | ` +
      roleIds.map(r => (data.rolePerms[r] || []).includes(perm) ? '✓' : '·').join(' | ') + ' |');
  }
  A();
  A('## 4. Acceso a pantallas (resumen)');
  A();
  A('Rutas del menú y portales; la lista completa (incluidas todas las rutas registradas en el router) está en `ACCESO-PANTALLAS.csv`.');
  A();
  A('| Ruta | Grupo | Permiso requerido (cualquiera) | ' + roleIds.map(S).join(' | ') + ' |');
  A('|---|---|---|' + roleIds.map(() => '---').join('|') + '|');
  for (const row of data.rows.filter(r => r.source !== 'ruta registrada')) {
    A(`| \`#/${row.r}\` | ${mdEsc(row.group)} | ${mdEsc(reqText(row))} | ` + roleIds.map(r => row.res[r] ? '✓' : '·').join(' | ') + ' |');
  }
  A();
  A('Pantallas accesibles por rol: ' + roleIds.map(r => `${S(r)} ${data.rows.filter(x => x.res[r]).length}`).join(' · ') + ` (de ${data.rows.length} rutas evaluadas).`);
  A();
  A('## 5. Notas para el backend');
  A();
  A('- `GET /api/v1/me/access` debe devolver exactamente esta evaluación (`screens: {ruta: bool}`) para que menú y router del frontend Next.js coincidan con el prototipo.');
  A('- Accesos «cruzados» intencionales: `operaciones/documentos-viaje` abierto a Ventas por `reservations.create`; `crm/clientes` y `finanzas/pagos` a Contabilidad por `finance.receivables`; `catalogo/cupos` a Finanzas por `catalog.products.view_profitability` (00 §7.5).');
  A('- `proveedor` exige `__solo_extranet__` (ningún permiso interno): solo el rol `provider` lo abre por su experiencia.');
  A('- Rutas sin entrada en ACCESS (p. ej. `flujo`, `sitio/*`) quedan abiertas a cualquier rol interno o son públicas; si se agrega una pantalla nueva, registrar su permiso en ACCESS y en `/me/access`.');
  A('- Reglas de administración de roles (no revocar `admin.users.manage` al Tenant Admin, no otorgar permisos de plataforma a roles de tenant, etc.): ver `REGLAS-DE-NEGOCIO.md` (RBAC-BR, USR-BR).');
  if (mismatches.length) { A(); A('Diferencias detectadas con el «Mapa de acceso» en pantalla: ' + mismatches.slice(0, 30).join(', ')); }
  fs.writeFileSync(path.join(OUT, 'PERMISOS.md'), L.join('\n') + '\n');

  console.log(`permisos ${allPerms.length} · roles ${roleIds.length} · rutas ${data.rows.length} (registradas ${data.registered.length}) · ` +
    `celdas verificadas ${checked} · diferencias ${mismatches.length} · errores JS ${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
