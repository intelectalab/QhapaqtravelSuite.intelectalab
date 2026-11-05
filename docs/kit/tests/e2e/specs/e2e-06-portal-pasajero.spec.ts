import { test, expect, expectNoHorizontalScroll } from '../fixtures/auth';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-06 (esp. 08 P06): pasajero (U15, RES-2026-000347) → Mi viaje → alerta visible →
 * confirmar lectura → itinerario → abrir voucher con QR.
 * Portal del cliente básico = Fase 1; portal del pasajero = Fase 2 (esp. 03-PLAN).
 */
test.describe('E2E-06 · Portal del pasajero @fase2 @e2e06 @responsive', () => {
  test('alerta, itinerario y voucher', async ({ passengerPage: page }) => {
    await page.goto(R.passengerTrip);
    await expect(page.getByTestId(T.pageTitle)).toContainText(/mi viaje/i);

    // Alerta visible (incidencia crítica INC-0085 de OP-2026-0412 genera aviso de cambio)
    const alert = page.locator('[data-testid^="pax-alert:"]').first();
    await expect(alert).toBeVisible();
    const alertId = (await alert.getAttribute('data-testid'))!.split(':')[1];
    await page.getByTestId(T.paxAlertMarkRead(alertId)).click();
    await expect(alert).toHaveAttribute('data-read', 'true');

    // Itinerario día por día
    await page.goto(R.passengerItinerary);
    await expect(page.locator('[data-testid^="pax-itinerary-day:"]')).not.toHaveCount(0);

    // Voucher con QR
    await page.goto(R.passengerVouchers);
    const v = page.locator('[data-testid^="pax-voucher-open:"]').first();
    await v.click();
    await expect(page.getByTestId(T.paxVoucherQr)).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('el pasajero no ve reservas ajenas (esp. 08 T01)', async ({ passengerPage: page }) => {
    await page.goto('/portal-pasajero/viajes?reserva=RES-2026-000348');
    await expect(page.getByTestId(T.notFound).or(page.getByTestId(T.forbidden))).toBeVisible();
  });
});
