import { test, expect, request } from '@playwright/test';
import { expectNoHorizontalScroll } from '../fixtures/auth';
import { API_URL } from '../support/api';
import { PRD011 } from '../support/expected';
import { API, R } from '../support/routes';
import { setRule } from '../support/rules';
import { T } from '../support/testids';

/**
 * Disponibilidad por rangos (pedido 2 del cliente; esp. 16 + 17 R-AVAIL-RANGES; E2E-W2).
 * PRD-011: 02–06 oct disponible · 07–09 oct cerrado («Ocupado») · 10–14 oct disponible.
 * Anónimo (sitio/widget). Fase 1 = motor básico; widget/sitio = Fase 2.
 */
test.describe('Motor · disponibilidad por rangos (PRD-011) @fase1 @motor @responsive', () => {
  test('calendario del widget respeta los tres rangos', async ({ page }) => {
    await page.goto(R.widget(PRD011.code, '?lang=es&currency=PEN'));
    const cal = page.getByTestId(T.bkCalendar);
    await expect(cal).toBeVisible();
    // Octubre 2026 (el primer disponible es 02/10, el widget abre en ese mes)
    for (const [date, exp] of Object.entries(PRD011.daysFor2Seats)) {
      const day = page.getByTestId(T.bkDay(date));
      await expect(day, date).toHaveAttribute('data-status', exp.status);
      if (exp.status === 'cerrado') await expect(day).toBeDisabled();
      else await expect(day).toBeEnabled();
    }
    await expect(page.getByTestId(T.bkDay('2026-10-08'))).toHaveAttribute('title', /Ocupado/);
    await expect(page.getByTestId(T.bkDay('2026-10-10'))).toHaveAttribute('title', /Últimos 3 cupos/);

    // Resumen de rangos («Disponible del 02 al 06 oct · Ocupado del 07 al 09 oct · …»)
    const sum = page.getByTestId(T.bkRangesSummary);
    await expect(sum.getByTestId(T.bkRange('RG-1101'))).toContainText(/02.*06/);
    await expect(sum.getByTestId(T.bkRange('RG-1102'))).toContainText(/Ocupado.*07.*09/);
    await expect(sum.getByTestId(T.bkRange('RG-1103'))).toContainText(/10.*14/);
    await expectNoHorizontalScroll(page);
  });

  test('con 4 asientos el 10/10 queda sin cupo', async ({ page }) => {
    await page.goto(R.widget(PRD011.code, '?lang=es'));
    await page.getByTestId(T.bkPaxInc('adt')).click();
    await page.getByTestId(T.bkPaxInc('adt')).click(); // 2 → 4 adultos
    await expect(page.getByTestId(T.bkDay('2026-10-10'))).toHaveAttribute('data-status', 'sin_cupo');
    await expect(page.getByTestId(T.bkDay('2026-10-12'))).toHaveAttribute('data-status', 'disponible');
  });

  test('API pública devuelve el mismo estado por día (el front no calcula)', async () => {
    const api = await request.newContext({ baseURL: `${API_URL}/`, extraHTTPHeaders: { 'X-Qhapaq-Key': process.env.E2E_WIDGET_PUBLIC_KEY ?? 'pk_demo' } });
    const r = await api.get(API.publicAvailability(PRD011.code, '2026-10', 2).slice(1));
    expect(r.ok()).toBeTruthy();
    const days = Object.fromEntries(((await r.json()).data as any[]).map((d) => [d.date, d]));
    for (const [date, exp] of Object.entries(PRD011.daysFor2Seats)) {
      expect(days[date].status, date).toBe(exp.status);
      expect(days[date].left, date).toBe(exp.left);
    }
    await api.dispose();
  });

  test('07–09 oct no se puede reservar aunque se fuerce por API (409)', async () => {
    const api = await request.newContext({ baseURL: `${API_URL}/`, extraHTTPHeaders: { 'X-Qhapaq-Key': process.env.E2E_WIDGET_PUBLIC_KEY ?? 'pk_demo' } });
    const r = await api.post('public/widget-handoffs', {
      headers: { 'Idempotency-Key': `e2e-${Date.now()}` },
      data: { product: PRD011.code, service_date: '2026-10-08', pax: { adt: 2, chd: 0, inf: 0 }, currency_display: 'PEN', payment_mode: 'total' },
    });
    expect([409, 422]).toContain(r.status());
    await api.dispose();
  });

  test('R-AVAIL-RANGES apagada: sin resumen de rangos (la regla desaparece limpiamente)', async ({ page }) => {
    const restore = await setRule('R-AVAIL-RANGES', false);
    try {
      await page.goto(R.widget(PRD011.code, '?lang=es'));
      await expect(page.getByTestId(T.bkRangesSummary)).toHaveCount(0);
    } finally { await restore(); }
  });
});
