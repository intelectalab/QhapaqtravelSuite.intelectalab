/**
 * Recalcula los valores esperados del motor (PRD-011) ejecutando window.BookingEngine en el prototipo.
 * Uso:  node kit-ia/tests/tools/recalcular-esperados.cjs [ruta/a/proto/index.html]
 * Requiere el paquete `playwright` (o `@playwright/test`) y Chromium instalado (`npx playwright install chromium`).
 * Copiar la salida a e2e/support/expected.ts y pest/Datasets/prd011.php si cambian las semillas.
 */
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('@playwright/test')); }

const fsx = require('fs');
const proto = process.argv[2] || [path.resolve(__dirname, '../../../proto/index.html'), path.resolve(__dirname, '../../../prototipo/index.html')].find(p => fsx.existsSync(p));

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage();
  await page.goto('file://' + proto + '#/sitio');
  await page.waitForFunction(() => window.BookingEngine && window.DB && window.DB.products);
  const out = await page.evaluate(() => {
    const BE = window.BookingEngine;
    const P = DB.products.find((x) => x.id === 'PRD-011');
    const hotels = ['H-LIM-3', 'H-AQP-3', 'H-PUN-3', 'H-CUS-3'];
    const lodging = ['LEG-1', 'LEG-2', 'LEG-3', 'LEG-4'].map((legId, i) => ({ legId, hotelId: hotels[i], rooms: [{ type: 'Doble', qty: 1 }, { type: 'Simple', qty: 1 }] }));
    const base = { date: '2026-10-12', pax: { adt: 2, chd: 1, inf: 1 }, addons: [{ id: 'ADD-1101', qty: 3 }], lodging, paymentMode: 'adelanto', removed: [], channel: 'Directo', currency: 'PEN' };
    const f = (n) => (Math.round(n * 100) / 100).toFixed(2);
    const slim = (q) => ({ lines: Object.fromEntries(q.lines.map((l) => [l.key, { qty: l.qty, unit: f(l.unit), amount: f(l.amount), removable: l.removable, removed: l.removed }])),
      subtotal: f(q.subtotal), total: f(q.total), mode: q.paymentMode, modes: q.modes, depositPct: q.depositPct, deposit: f(q.deposit), balance: f(q.balance),
      balanceDue: q.balanceDue, rooms: q.rooms, nights: q.nights, warnings: q.warnings, season: q.season && q.season.name });
    const withRule = (id, on, fn) => { const r = BE.rule(id); const prev = r.enabled; r.enabled = on; try { return fn(); } finally { r.enabled = prev; } };
    const withPlan = (plan, fn) => { const h = DB.subscription || DB.tenant; const prev = h.plan; h.plan = plan; try { return fn(); } finally { h.plan = prev; } };
    const q = (o = {}) => slim(BE.quote(P, Object.assign({}, base, o)));
    return {
      today: window.TODAY,
      canonicalPEN: q(),
      canonicalUSD: q({ currency: 'USD' }),
      removedAddon: q({ removed: ['addon-ADD-1101'] }),
      removedLimaUSD: q({ currency: 'USD', removed: ['lodge-LEG-1-Doble', 'lodge-LEG-1-Simple'] }),
      widgetUSD: q({ currency: 'USD', addons: [{ id: 'ADD-1101', qty: 1 }] }),
      widgetUSDRemoveLima: q({ currency: 'USD', addons: [{ id: 'ADD-1101', qty: 1 }], removed: ['lodge-LEG-1-Doble', 'lodge-LEG-1-Simple'] }),
      ruleOffLodging: withRule('R-LODGING', false, () => q()),
      ruleOffPreviewRemove: withRule('R-PREVIEW-REMOVE', false, () => q({ removed: ['addon-ADD-1101'] })),
      ruleOffDeposit: withRule('R-DEPOSIT', false, () => q()),
      planStarter: withPlan('Starter', () => q()),
      days2: Object.fromEntries(BE.month(P, 2026, 9, 2).filter((d) => d.day <= 16).map((d) => [d.date, [d.status, d.left, d.label]])),
      pax: [[2, 5, 0], [2, 0, 3], [0, 1, 0], [16, 1, 0], [2, 2, 2]].map(([adt, chd, inf]) => ({ adt, chd, inf, ...BE.validatePax(P, { adt, chd, inf }) })),
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
