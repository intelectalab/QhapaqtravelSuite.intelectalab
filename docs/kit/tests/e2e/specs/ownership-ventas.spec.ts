import { test, expect } from '../fixtures/auth';
import type { Api } from '../support/api';
import { R } from '../support/routes';
import { T } from '../support/testids';
import { userFor } from '../support/users';

/**
 * Ownership del rol Ventas (esp. 00 SEC-BR-09 / §7.6, 03 QTE-BR-26, 01 H-17).
 * U03 (Lucía) solo ve su cartera: cotizaciones COT-2026-00189/00188/00186/00183, reservas 000347/000346/000343/000349.
 * U04 (Diego) es dueño de COT-2026-00190/00185/00184 y RES-2026-000350/000344.
 * Fase 1 (se prueba con cada módulo que tenga owner_id).
 */
const OWN_QUOTES_U03 = ['COT-2026-00189', 'COT-2026-00188', 'COT-2026-00186', 'COT-2026-00183'];
const FOREIGN_QUOTE = 'COT-2026-00190';     // U04
const FOREIGN_RES = 'RES-2026-000350';      // U04
const FOREIGN_LEAD = 'LEAD-0231';           // U04

async function portfolioOf(admin: Api, alias: 'sales' | 'sales2'): Promise<string[]> {
  const rows = (await (await admin.get('/quotes', { 'page[size]': 100 })).json()).data as { code: string; owner?: { name?: string } | null }[];
  return rows.filter((q) => q.owner?.name === userFor(alias).name).map((q) => q.code).sort();
}

test.describe('Ownership de Ventas @fase1 @ownership @smoke', () => {
  test('lista de cotizaciones: solo su cartera y sin columna Vendedor', async ({ pageAs, apiAs }) => {
    const expected = await portfolioOf(await apiAs('tenantAdmin'), 'sales');
    expect(expected).toEqual(expect.arrayContaining(OWN_QUOTES_U03));
    expect(expected).not.toContain(FOREIGN_QUOTE);
    const page = await pageAs('sales');
    await page.goto(R.quotes);
    const rowsPicker = page.getByRole('button', { name: 'Filas por página' }).first();
    if (await rowsPicker.count()) {
      await rowsPicker.click();
      await page.getByTestId(T.option('100')).click();
    }
    const rows = page.locator('[data-testid^="table-row:COT-"]');
    await expect(rows).toHaveCount(expected.length);
    const codes = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.split(':')[1]));
    expect(codes.sort()).toEqual(expected);
    await expect(page.getByRole('columnheader', { name: /vendedor/i })).toHaveCount(0);
    await expect(page.getByText('Mi cartera')).toBeVisible();
  });

  for (const [label, url] of [
    ['cotización ajena', R.quote(FOREIGN_QUOTE)],
    ['reserva ajena', R.reservation(FOREIGN_RES)],
    ['lead ajeno', R.lead(FOREIGN_LEAD)],
  ] as const) {
    test(`detalle de ${label} → «Registro fuera de su cartera»`, async ({ pageAs }) => {
      const page = await pageAs('sales');
      await page.goto(url);
      await expect(page.getByTestId(T.scopeDenied)).toBeVisible();
      await expect(page.getByTestId(T.scopeDenied)).toContainText(/cartera de otro asesor/i);
    });
  }

  test('API: detalle ajeno → 403 SEC-BR-09; filter[owner] de otro se ignora', async ({ apiAs }) => {
    const admin = await apiAs('tenantAdmin');
    const foreignId = await admin.idOf('/quotes', FOREIGN_QUOTE);
    const sales = await apiAs('sales');

    const detail = await sales.get(`/quotes/${foreignId}`);
    expect(detail.status()).toBe(403);
    expect((await detail.json()).code).toBe('SEC-BR-09');

    const own = await portfolioOf(admin, 'sales');
    const list = await (await sales.get('/quotes', { 'filter[owner]': 'U04', 'page[size]': 100 })).json();
    const codes = (list.data as any[]).map((q) => q.code);
    expect(codes).not.toContain(FOREIGN_QUOTE);
    expect(codes.sort()).toEqual(own);
  });

  test('búsqueda global y KPIs respetan la cartera', async ({ apiAs }) => {
    const sales = await apiAs('sales');
    const s = await (await sales.get('/search', { q: 'COT-2026-0019' })).json();
    expect(JSON.stringify(s)).not.toContain(FOREIGN_QUOTE);
    const k = await (await sales.get('/quotes/kpis')).json();
    const admin = await (await (await apiAs('tenantAdmin')).get('/quotes/kpis')).json();
    expect(k.data.total ?? k.data.count).toBeLessThan(admin.data.total ?? admin.data.count);
  });

  test('H-17: «viajes por cerrar» de Postventa solo trae reservas propias', async ({ apiAs }) => {
    const sales = await apiAs('sales');
    const r = await (await sales.get('/crm/after-sales/trips')).json();
    expect(JSON.stringify(r)).not.toContain(FOREIGN_RES);
  });
});
