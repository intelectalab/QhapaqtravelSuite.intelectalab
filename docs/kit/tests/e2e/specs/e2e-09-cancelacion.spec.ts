import { test, expect, expectToast } from '../fixtures/auth';
import { E2E09, money } from '../support/expected';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-09 (esp. 04 §4.6 y T-R10; 07 §10): cancelación de RES-2026-000348 →
 * penalidad 53 480, reembolso 0, CxC de penalidad 30 036, CxC abiertas canceladas,
 * cupos liberados, orden cancelada, auditoría. Nota de crédito por OSE (H-06) = Fase 2.
 */
test.describe('E2E-09 · Cancelación con penalidad @fase1 @e2e09', () => {
  test('Manager cancela RES-2026-000348', async ({ pageAs, apiAs }) => {
    const mgr = await pageAs('manager');
    await mgr.goto(R.reservation(E2E09.reservation));
    await mgr.getByTestId(T.reservationCancel).click();

    // Vista previa (POST cancellation/preview)
    await expect(mgr.getByTestId(T.cancellationPenalty)).toHaveAttribute('data-amount', E2E09.penalty);
    await expect(mgr.getByTestId(T.cancellationPenalty)).toContainText(money(E2E09.penalty));
    await expect(mgr.getByTestId(T.cancellationRefund)).toHaveAttribute('data-amount', E2E09.refund);

    await mgr.getByTestId(T.field('reason')).click();
    await mgr.getByTestId(T.option('solicitud_cliente')).click();
    await mgr.getByTestId(T.field('detail')).fill('Cliente corporativo anula por cambio de agenda (E2E-09)');
    await mgr.getByTestId(T.cancellationConfirm).click();
    await expectToast(mgr, /cancelada/i, 'ok');
    await expect(mgr.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'cancelada');

    // CxC: penalidad nueva y las abiertas anteriores canceladas
    await expect(mgr.getByTestId(T.reservationReceivable('penalidad'))).toHaveAttribute('data-amount', E2E09.penaltyReceivable);

    const api = await apiAs('manager');
    const rid = await api.idOf('/reservations', E2E09.reservation);
    const cxc = (await (await api.get('/finance/receivables', { 'filter[reservation]': E2E09.reservation })).json()).data as any[];
    expect(cxc.filter((c) => c.status === 'abierta' && !/penalidad/i.test(c.concept))).toHaveLength(0);

    // Orden operativa OP-2026-0413 cancelada
    const order = (await (await api.get('/ops/orders', { 'filter[code]': 'OP-2026-0413' })).json()).data[0];
    expect(order.status).toBe('cancelada');

    // Auditoría de la reserva
    const act = await (await api.get('/audit-events', { 'filter[entity_id]': rid, 'filter[action]': 'cancelar' })).json();
    expect(act.data.length).toBeGreaterThan(0);
  });

  test('Ventas no puede cancelar (403) y Operaciones tampoco (T-R13/T-R14)', async ({ apiAs }) => {
    const admin = await apiAs('tenantAdmin');
    const id = await admin.idOf('/reservations', 'RES-2026-000350'); // dueño U04
    for (const alias of ['sales2', 'operations'] as const) {       // U04 es el dueño y aun así no tiene reservations.cancel
      const api = await apiAs(alias);
      const r = await api.postIdem(`/reservations/${id}/cancel`, { reason: 'solicitud_cliente', detail: 'E2E' });
      expect(r.status()).toBe(403);
      expect((await r.json()).required_permissions).toContain('reservations.cancel');
    }
  });
});
