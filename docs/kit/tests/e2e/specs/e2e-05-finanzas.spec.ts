import { test, expect, expectToast } from '../fixtures/auth';
import { createApprovedQuote } from '../support/arrange';
import { idemKey } from '../support/api';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-05 (esp. 07 §10): reserva → obligación (anticipo) → registrar pago → emitir comprobante →
 * registrar costo → aprobar → rentabilidad actualizada → liquidación.
 * Fase 1: comprobante interno sin OSE (sunat_status=pending); la emisión real por OSE es Fase 2.
 */
test.describe('E2E-05 · Ciclo financiero de una reserva @fase1 @e2e05', () => {
  test('pago del anticipo, comprobante, costo y rentabilidad', async ({ pageAs, apiAs }) => {
    const sales = await apiAs('sales');
    const q = await createApprovedQuote(sales, { clientCode: 'CLI-0003', productCode: 'PRD-011', serviceDate: '2026-11-20', pax: 2, currency: 'USD' });
    const conv = await sales.postIdem(`/quotes/${q.id}/convert`, {}, idemKey(), q.lock_version);
    const res = (await conv.json()).data as { code: string };

    const fin = await pageAs('finance');
    await fin.goto(`${R.receivables}?filter[reservation]=${res.code}`);
    const anticipoRow = fin.locator('[data-testid^="table-row:CXC-"]').filter({ hasText: /Anticipo 40%/ });
    await expect(anticipoRow).toHaveCount(1);
    const cxcCode = (await anticipoRow.getAttribute('data-testid'))!.split(':')[1];
    const amount = await anticipoRow.getAttribute('data-amount');

    // Registrar pago por el monto exacto del anticipo (Idempotency-Key en el front)
    await fin.goto(R.receivable(cxcCode));
    await fin.getByTestId(T.paymentRegister).click();
    await fin.getByTestId(T.field('amount')).fill(amount!);
    await fin.getByTestId(T.field('method')).click();
    await fin.getByTestId(T.option('transferencia')).click();
    await fin.getByTestId(T.field('reference')).fill('OP-BCP-E2E-5501');
    await fin.getByTestId(T.dialogConfirm).click();
    await expectToast(fin, /pago registrado/i, 'ok');
    await fin.getByTestId(T.paymentApply).click();
    await expect(fin.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'pagada');

    // Comprobante (Fase 1: sin OSE)
    await fin.getByTestId(T.invoiceIssue).click();
    await fin.getByTestId(T.dialogConfirm).click();
    await expectToast(fin, /comprobante/i, 'ok');

    // Costo del proveedor → aprobar → rentabilidad
    await fin.goto(R.profitability(res.code));
    const before = Number(await fin.getByTestId(T.profitMargin).getAttribute('data-value'));
    await fin.getByTestId(T.costRegister).click();
    await fin.getByTestId(T.field('amount')).fill('150.00');
    await fin.getByTestId(T.field('provider_invoice')).fill('F001-000123');
    await fin.getByTestId(T.dialogConfirm).click();
    await fin.getByTestId(T.costApprove).click();
    await expect.poll(async () => Number(await fin.getByTestId(T.profitMargin).getAttribute('data-value'))).toBeLessThan(before);

    // Liquidación: abre el modal con venta, costo y utilidad (base neta sin IGV, H-11)
    await fin.getByTestId(T.settlement).click();
    await expect(fin.getByTestId(T.dialog)).toContainText(/utilidad/i);
  });

  test('pago duplicado con la misma Idempotency-Key → un solo pago', async ({ apiAs }) => {
    const fin = await apiAs('finance');
    const cxc = (await (await fin.get('/finance/receivables', { 'filter[status]': 'abierta', 'page[size]': 1 })).json()).data[0];
    const key = idemKey('pay');
    const body = { receivable_id: cxc.id, amount: '1.00', currency: cxc.currency, method: 'transferencia', reference: 'E2E-IDEM' };
    // POST /finance/payments exige Idempotency-Key e If-Match (lock_version de la CxC)
    const a = await fin.postIdem('/finance/payments', body, key, cxc.lock_version);
    const b = await fin.postIdem('/finance/payments', body, key, cxc.lock_version);
    expect(a.status()).toBe(201);
    expect(b.status()).toBe(201);
    expect((await b.json()).data.id).toBe((await a.json()).data.id);
  });
});
