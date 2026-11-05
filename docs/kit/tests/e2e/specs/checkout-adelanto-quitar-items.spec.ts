import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from '../fixtures/auth';
import { PRD011, WIDGET_USD, money } from '../support/expected';
import { R } from '../support/routes';
import { setRule } from '../support/rules';
import { T } from '../support/testids';

/**
 * Checkout con adelanto y previsualización quitando ítems (pedidos 4, 6, 7 y 11; esp. 17 E2E-W1).
 * PRD-011 · 12/10/2026 · 2 ADT + 1 CHD + 1 INF · alojamiento automático (Doble+Simple 3* por ciudad) ·
 * Museo Larco ×1 · USD · quitar Lima → 6 habitaciones / 8 noches · adelanto 30 %.
 * Valores = window.BookingEngine.quote del prototipo (support/expected.ts). Fase 2 (widget/checkout).
 */
test.describe('Checkout · adelanto y quitar ítems @fase2 @motor @responsive', () => {
  test('flujo del widget hasta el checkout', async ({ page }) => {
    await page.goto(R.widget(PRD011.code, '?lang=es&currency=USD'));
    await page.getByTestId(T.bkDay('2026-10-12')).click();
    await page.getByTestId(T.bkPaxInc('chd')).click();
    await page.getByTestId(T.bkPaxInc('inf')).click();

    await page.getByTestId(T.bkLodgingToggle).check();
    await page.getByTestId(T.bkAddonInc('ADD-1101')).click();
    await page.getByTestId(T.bkPayMode('adelanto')).check();

    await expect(page.getByTestId(T.bkRoomsTotal)).toHaveText(String(WIDGET_USD.before.rooms));
    await expect(page.getByTestId(T.bkNightsTotal)).toHaveText(String(WIDGET_USD.before.nights));
    await expect(page.getByTestId(T.bkTotal)).toHaveAttribute('data-amount', WIDGET_USD.before.total);
    await expect(page.getByTestId(T.bkDeposit)).toHaveAttribute('data-amount', WIDGET_USD.before.deposit);

    // Las líneas base no se pueden quitar; alojamiento y adicionales sí
    await expect(page.getByTestId(T.bkLineRemove('base-adt'))).toHaveCount(0);
    await page.getByTestId(T.bkLineRemove('lodge-LEG-1-Doble')).click();
    await page.getByTestId(T.bkLineRemove('lodge-LEG-1-Simple')).click();
    await expect(page.getByTestId(T.bkSummaryLine('lodge-LEG-1-Doble'))).toHaveAttribute('data-removed', 'true');

    const a = WIDGET_USD.afterRemoveLima;
    await expect(page.getByTestId(T.bkRoomsTotal)).toHaveText(String(a.rooms));
    await expect(page.getByTestId(T.bkNightsTotal)).toHaveText(String(a.nights));
    await expect(page.getByTestId(T.bkTotal)).toHaveAttribute('data-amount', a.total);
    await expect(page.getByTestId(T.bkDeposit)).toHaveAttribute('data-amount', a.deposit);
    await expect(page.getByTestId(T.bkBalance)).toHaveAttribute('data-amount', a.balance);
    await expect(page.getByTestId(T.bkDeposit)).toContainText(money(a.deposit));
    // Saldo: 12/10 − 30 días ya pasó → se cobra hoy y se advierte
    await expect(page.getByTestId(T.bkWarning)).toContainText(/salida es cercana/i);

    // Restaurar y volver a quitar (el ítem quitado se puede recuperar)
    await page.getByTestId(T.bkLineRestore('lodge-LEG-1-Doble')).click();
    await expect(page.getByTestId(T.bkSummaryLine('lodge-LEG-1-Doble'))).toHaveAttribute('data-removed', 'false');
    await page.getByTestId(T.bkLineRemove('lodge-LEG-1-Doble')).click();

    await expectNoHorizontalScroll(page);

    // Continuar → checkout: el servidor recalcula (WG-03) y cobra solo el adelanto hoy
    await page.getByTestId(T.bkContinue).click();
    await expect(page).toHaveURL(new RegExp(`${R.checkout}`));
    await expect(page.getByTestId(T.checkoutSummary)).toHaveAttribute('data-total', a.total);
    await expect(page.getByTestId(T.checkoutPayMode('adelanto'))).toBeChecked();
    await expect(page.getByTestId(T.checkoutAmountToday)).toHaveAttribute('data-amount', a.deposit);

    // Cambiar a pago total en el checkout
    await page.getByTestId(T.checkoutPayMode('total')).check();
    await expect(page.getByTestId(T.checkoutAmountToday)).toHaveAttribute('data-amount', WIDGET_USD.afterRemoveLimaTotalMode.deposit);
  });

  test('R-PREVIEW-REMOVE apagada: resumen sin botones Quitar', async ({ page }) => {
    const restore = await setRule('R-PREVIEW-REMOVE', false);
    try {
      await page.goto(R.widget(PRD011.code, '?lang=es&currency=USD'));
      await page.getByTestId(T.bkDay('2026-10-12')).click();
      await page.getByTestId(T.bkLodgingToggle).check();
      await expect(page.locator('[data-testid^="bk-line-remove:"]')).toHaveCount(0);
    } finally { await restore(); }
  });

  test('R-DEPOSIT apagada: solo pago total', async ({ page }) => {
    const restore = await setRule('R-DEPOSIT', false);
    try {
      await page.goto(R.widget(PRD011.code, '?lang=es&currency=USD'));
      await page.getByTestId(T.bkDay('2026-10-12')).click();
      await expect(page.getByTestId(T.bkPayMode('adelanto'))).toHaveCount(0);
      await expect(page.getByTestId(T.bkPayMode('total'))).toBeChecked();
    } finally { await restore(); }
  });
});
