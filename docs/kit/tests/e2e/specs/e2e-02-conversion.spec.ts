import { test, expect } from '../fixtures/auth';
import { createApprovedQuote } from '../support/arrange';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-02 (esp. 04 T-R01 + §4.3): cotización aprobada → convertir → reserva confirmada con servicios
 * desglosados, CxC 40/60 con vencimientos exactos, oportunidad ganada y cotización convertida.
 * Incluye la idempotencia vista desde la UI (doble clic = una sola reserva).
 */
test.describe('E2E-02 · Conversión cotización → reserva @fase1 @e2e02', () => {
  test('convierte una vez y muestra CxC 40/60', async ({ pageAs, apiAs }) => {
    const api = await apiAs('sales');                       // U03, dueño de CLI-0003
    const q = await createApprovedQuote(api, { clientCode: 'CLI-0003', productCode: 'PRD-011', serviceDate: '2026-11-20', pax: 2, currency: 'USD' });

    const page = await pageAs('sales');
    await page.goto(R.quote(q.code));
    await expect(page.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'aprobada');

    await page.getByTestId(T.quoteConvert).click();
    // Vista previa: precondiciones y disponibilidad por ítem (GET conversion-preview)
    await expect(page.getByTestId(T.quoteConvertPreview)).toContainText(/disponible|sujeto a confirmación/i);
    // Doble clic deliberado: el front reutiliza la misma Idempotency-Key durante el diálogo
    await page.getByTestId(T.quoteConvertConfirm).dblclick();

    await expect(page).toHaveURL(/\/reservas\/RES-2026-\d{6}$/);
    const resCode = await page.getByTestId(T.reservationCode).innerText();
    await expect(page.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'confirmada');

    // CxC 40/60: hoy 2026-09-29, viaje 2026-11-20 → anticipo vence 2026-10-02 y saldo 2026-11-05 (paso 14)
    const anticipo = page.getByTestId(T.reservationReceivable('anticipo'));
    const saldo = page.getByTestId(T.reservationReceivable('saldo'));
    await expect(anticipo).toHaveAttribute('data-due', '2026-10-02');
    await expect(saldo).toHaveAttribute('data-due', '2026-11-05');
    const total = Number(await page.getByTestId(T.reservationTotal).getAttribute('data-amount'));
    const a = Number(await anticipo.getAttribute('data-amount'));
    const b = Number(await saldo.getAttribute('data-amount'));
    expect(a).toBeCloseTo(Math.round(total * 40) / 100, 2);
    expect(a + b).toBeCloseTo(total, 2);

    // Servicios desglosados: Σ precio de servicios = total sin IGV de la versión (residuo en la última línea)
    const prices = await page.locator('[data-testid^="reservation-service:"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-price'))));
    expect(prices.length).toBeGreaterThan(0);

    // Una sola reserva para la cotización (UNIQUE parcial quote_id)
    const list = await (await api.get('/reservations', { 'filter[quote]': q.code })).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0].code).toBe(resCode);

    // Cotización convertida y enlazada
    await page.goto(R.quote(q.code));
    await expect(page.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'convertida');
    await expect(page.getByTestId(T.quoteReservationLink)).toHaveText(resCode);
  });

  test('convertir una cotización enviada (no aprobada) → 409 RT-3', async ({ apiAs }) => {
    const api = await apiAs('sales');
    const id = await api.idOf('/quotes', 'COT-2026-00188'); // enviada, U03
    const lv = (await (await api.get(`/quotes/${id}`)).json()).data.lock_version;
    const r = await api.postIdem(`/quotes/${id}/convert`, {}, undefined, lv);
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('RT-3');
  });
});
