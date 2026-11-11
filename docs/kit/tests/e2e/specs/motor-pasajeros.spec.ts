import { test, expect, request } from '@playwright/test';
import { API_URL } from '../support/api';
import { PRD011 } from '../support/expected';
import { API, R } from '../support/routes';
import { setRule } from '../support/rules';
import { T } from '../support/testids';

/**
 * Reglas de pasajeros por adulto (pedido 3; esp. 16/17: R-MIN-ADULTS, R-CHILD-PER-ADULT,
 * R-INFANT-FREE, R-MAX-PAX). PRD-011: adulto 11+, niño 4–10 (paga tarifa Niño), infante 0–3 (no paga,
 * no ocupa asiento), máx. 2 niños y 1 infante por adulto, mínimo 1 adulto, máx. 16 pax.
 */
const pk = { 'X-KipuControl-Key': process.env.E2E_WIDGET_PUBLIC_KEY ?? 'pk_demo' };

async function setPax(page: import('@playwright/test').Page, target: { adt: number; chd: number; inf: number }) {
  for (const k of ['adt', 'chd', 'inf'] as const) {
    const count = page.getByTestId(T.bkPaxCount(k));
    for (let i = 0; i < 20 && Number(await count.innerText()) < target[k]; i++) await page.getByTestId(T.bkPaxInc(k)).click();
    for (let i = 0; i < 20 && Number(await count.innerText()) > target[k]; i++) await page.getByTestId(T.bkPaxDec(k)).click();
  }
}

test.describe('Motor · reglas de pasajeros por adulto @fase1 @motor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(R.widget(PRD011.code, '?lang=es&currency=PEN'));
    await page.getByTestId(T.bkDay('2026-10-12')).click();
  });

  test('rótulos de edades y «no paga» para infantes', async ({ page }) => {
    await expect(page.getByTestId(T.bkPaxAgeLabel('adt'))).toContainText('11+');
    await expect(page.getByTestId(T.bkPaxAgeLabel('chd'))).toContainText(/4.*10/);
    await expect(page.getByTestId(T.bkPaxAgeLabel('inf'))).toContainText(/0.*3.*no paga/i);
    await setPax(page, { adt: 2, chd: 1, inf: 1 });
    await expect(page.getByTestId(T.bkSummaryLine('base-inf'))).toHaveAttribute('data-amount', '0.00');
    await expect(page.getByTestId(T.bkContinue)).toBeEnabled();
  });

  for (const c of PRD011.pax.invalid) {
    test(`bloquea ${c.adt} ADT + ${c.chd} CHD + ${c.inf} INF`, async ({ page }) => {
      await setPax(page, c);
      await expect(page.getByTestId(T.bkPaxError)).toContainText(c.error);
      await expect(page.getByTestId(T.bkContinue)).toBeDisabled();
    });
  }

  test('infantes no ocupan asiento: 2 ADT + 2 CHD + 2 INF es válido', async ({ page }) => {
    await setPax(page, { adt: 2, chd: 2, inf: 2 });
    await expect(page.getByTestId(T.bkPaxError)).toHaveCount(0);
  });

  test('el servidor valida igual (POST /public/quote → ok=false con el mismo mensaje)', async () => {
    const api = await request.newContext({ baseURL: `${API_URL}/`, extraHTTPHeaders: pk });
    const r = await api.post(API.publicQuote.slice(1), { data: { product: PRD011.code, date: '2026-10-12', pax: { adt: 2, chd: 5, inf: 0 }, currency: 'PEN' } });
    const body = await r.json();
    expect(r.status() === 422 || body.data?.ok === false).toBeTruthy();
    expect(JSON.stringify(body)).toContain('Máximo 2 niño(s)');
    await api.dispose();
  });

  test('R-CHILD-PER-ADULT apagada: sin límite de niños y pagan tarifa completa', async ({ page }) => {
    const restore = await setRule('R-CHILD-PER-ADULT', false);
    try {
      await page.reload();
      await page.getByTestId(T.bkDay('2026-10-12')).click();
      await setPax(page, { adt: 1, chd: 4, inf: 0 });
      await expect(page.getByTestId(T.bkPaxError)).toHaveCount(0);
    } finally { await restore(); }
  });
});
