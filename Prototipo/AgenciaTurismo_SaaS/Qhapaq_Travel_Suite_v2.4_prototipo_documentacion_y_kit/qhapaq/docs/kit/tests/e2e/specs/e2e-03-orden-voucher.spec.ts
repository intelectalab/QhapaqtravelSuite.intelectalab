import { test, expect, expectToast } from '../fixtures/auth';
import { createApprovedQuote } from '../support/arrange';
import { idemKey } from '../support/api';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-03 (esp. 05 §10): reserva confirmada → crear orden → enviar solicitud al proveedor →
 * confirmar proveedor (código obligatorio) → asignar recursos (con advertencia asumida) →
 * emitir voucher → el pasajero lo ve en su portal/app.
 */
test.describe('E2E-03 · Orden operativa hasta voucher @fase1 @e2e03', () => {
  test('flujo completo de Operaciones', async ({ pageAs, apiAs }) => {
    // Arrange: reserva confirmada nueva (conversión por API)
    const sales = await apiAs('sales');
    const q = await createApprovedQuote(sales, { clientCode: 'CLI-0003', productCode: 'PRD-001', serviceDate: '2026-10-20', pax: 2, currency: 'USD' });
    const conv = await sales.postIdem(`/quotes/${q.id}/convert`, {}, idemKey(), q.lock_version);
    expect(conv.status()).toBe(201);
    const resCode: string = (await conv.json()).data.code;

    const ops = await pageAs('operations');
    await ops.goto(R.orders);
    await ops.getByTestId(T.orderCreate).click();
    await ops.getByTestId(T.field('reservation_id')).click();
    await ops.getByTestId(T.option(resCode)).click();
    await ops.getByTestId(T.dialogConfirm).click();
    await expect(ops).toHaveURL(/\/operaciones\/ordenes\/OP-2026-\d{4}$/);

    // Primer servicio: solicitud → confirmación con código (OPS-BR-10/11)
    const firstSvc = ops.locator('[data-testid^="order-service-request:"]').first();
    const svcKey = (await firstSvc.getAttribute('data-testid'))!.split(':')[1];
    await firstSvc.click();
    await expectToast(ops, /solicitud enviada/i, 'ok');
    await ops.getByTestId(T.orderServiceConfirm(svcKey)).click();
    await ops.getByTestId(T.dialogConfirm).click();
    await expect(ops.getByTestId(T.fieldError('confirmation_code'))).toBeVisible(); // código obligatorio
    await ops.getByTestId(T.field('confirmation_code')).fill('CONF-E2E-001');
    await ops.getByTestId(T.dialogConfirm).click();
    await expect(ops.getByTestId(T.orderServiceConfirm(svcKey))).toHaveAttribute('data-status', 'confirmado');

    // Asignación con advertencia (OPS-BR-22): hay que marcar «asumo la advertencia»
    await ops.getByTestId(T.orderAssign(svcKey)).click();
    await ops.getByTestId(T.assignGuide).click();
    await ops.getByTestId(T.option('G01')).click();
    await ops.getByTestId(T.assignDriver).click();
    await ops.getByTestId(T.option('C01')).click();
    await ops.getByTestId(T.assignVehicle).click();
    await ops.locator('[data-testid^="option:"]').first().click();
    const ack = ops.getByTestId(T.assignWarningAck);
    if (await ack.isVisible()) await ack.check();
    await ops.getByTestId(T.assignSave).click();
    await expectToast(ops, /asignaci/i, 'ok');

    // Voucher
    await ops.getByTestId(T.voucherIssue(svcKey)).click();
    await ops.getByTestId(T.dialogConfirm).click();
    const voucher = await ops.getByTestId(T.voucherCode(svcKey)).innerText();
    expect(voucher).toMatch(/^VOU-/);

    // «Ver en app pasajero»: vista previa interna de solo lectura del portal del pasajero (H-05)
    await ops.goto(R.passengerPreview(resCode));
    await expect(ops.getByTestId(T.paxVoucherOpen(voucher))).toBeVisible();
    await expect(ops.getByTestId(T.previewReadOnly)).toBeVisible();
  });
});
