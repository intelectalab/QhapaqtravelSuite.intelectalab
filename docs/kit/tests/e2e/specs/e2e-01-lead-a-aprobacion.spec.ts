import { test, expect } from '../fixtures/auth';
import type { Api } from '../support/api';
import { R } from '../support/routes';
import { T } from '../support/testids';

const future = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

async function productCode(api: Api, ref: string): Promise<string> {
  const rows = (await (await api.get('/catalog/products', { 'filter[code]': ref })).json()).data as { code: string; ref: string }[];
  return rows.find((x) => x.code === ref || x.ref === ref)!.code;
}

/**
 * E2E-01 (DOC-PROC-001; esp. 01 §10, 03 T-Q15, 08 P05)
 * Lead → tomar → actividad completada → BANT → convertir (cliente existente) → oportunidad →
 * cotización con descuento fuera de política → aprobación interna (Manager) → envío →
 * vista en portal del cliente → aprobación del cliente.
 * Fase 1 · criterio de salida del MVP.
 */
test.describe('E2E-01 · Lead a cotización aprobada @fase1 @e2e01', () => {
  test('flujo completo con historial visible en el 360', async ({ pageAs, apiAs }) => {
    const sales = await pageAs('sales2');
    await sales.goto(R.lead('LEAD-0232'));
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'nuevo');
    await sales.getByTestId(T.leadTake).click();
    await expect(sales.getByTestId('lead-status')).toBeVisible();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'nuevo');

    await sales.getByTestId('lead-status').click();
    await sales.getByTestId(T.field('status')).getByTestId(T.option('contactado')).click();
    await sales.getByTestId(T.field('note')).fill('Primer contacto por WhatsApp (E2E-01)');
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'contactado');

    await sales.getByTestId(T.leadQualify).click();
    for (const k of ['budget', 'authority', 'need', 'timeline']) await sales.getByTestId(T.field(k)).getByTestId(T.option('25')).click();
    await expect(sales.getByTestId(T.field('mark_qualified'))).toHaveAttribute('aria-checked', 'true');
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'calificado');

    await sales.getByTestId(T.leadConvert).click();
    await sales.getByTestId(T.field('client_mode')).getByTestId(T.option('existing')).click();
    await sales.getByTestId(T.field('client_code')).click();
    await sales.getByTestId(T.option('CLI-0001')).click();
    await sales.getByTestId(T.field('opportunity_title')).fill('Perú Clásico familia Ríos');
    await sales.getByTestId(T.field('amount')).fill('19000');
    await sales.getByTestId(T.field('expected_close_date')).fill(future(60));
    await sales.getByTestId(T.field('expected_close_date')).press('Enter');
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales).toHaveURL(/\/crm\/clientes\/CLI-0001/);

    const api = await apiAs('sales2');
    const lead = (await (await api.get('/crm/leads/LEAD-0232')).json()).data;
    expect(lead.status).toBe('convertido');
    const oppCode: string = lead.converted.opportunity.code;

    await sales.goto(R.opportunity(oppCode));
    await sales.getByTestId(T.opportunityCreateQuote).click();
    await expect(sales.getByTestId('wizard-body:1')).toBeVisible();
    await expect(sales.getByTestId(T.field('client_code'))).toHaveAttribute('data-value', 'CLI-0001');
    await sales.getByTestId('wizard-next:1').click();
    await sales.getByTestId(T.field('travel_from')).fill('20/11/2026');
    await sales.getByTestId(T.field('travel_from')).press('Enter');
    await sales.getByTestId(T.field('travel_to')).fill('29/11/2026');
    await sales.getByTestId(T.field('travel_to')).press('Enter');
    await sales.getByLabel('Adultos', { exact: true }).fill('2');
    await sales.getByTestId('wizard-next:2').click();
    await sales.getByTestId('quote-add-line').click();
    await sales.getByTestId(T.field('items.0.product_code')).click();
    await sales.getByTestId(T.option(await productCode(api, 'PRD-011'))).click();
    await expect(sales.getByTestId('quote-line:1')).toContainText(/× 2 pasajeros/);
    await sales.getByTestId('wizard-next:3').click();
    await sales.getByTestId(T.field('discount_pct')).fill('8');
    await sales.getByTestId(T.quoteSave).click();
    await expect(sales).toHaveURL(/\/cotizaciones\/COT-2026-\d{5}$/);
    const quoteCode = sales.url().split('/').pop()!;

    await expect(sales.getByTestId('quote-send-blocked')).toBeVisible();
    await expect(sales.getByTestId(T.quoteSend)).toHaveCount(0);
    await sales.getByTestId(T.quoteRequestApproval).click();
    await sales.getByTestId(T.field('note')).fill('Cliente recurrente; pide 8 % por viajar en familia');
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales.getByTestId(T.quoteRequestApproval)).toHaveCount(0);

    const manager = await pageAs('manager');
    await manager.goto(R.quote(quoteCode));
    await manager.getByTestId(T.quoteInternalApprove).click();
    await manager.getByTestId(T.field('decision')).getByTestId(T.option('approve')).click();
    await manager.getByTestId(T.field('note')).fill('Cliente recurrente; margen sigue sobre 15 %');
    await manager.getByTestId(T.dialogConfirm).click();
    await expect(manager.getByTestId(T.quoteInternalApprove)).toHaveCount(0);

    await sales.reload();
    await sales.getByTestId(T.quoteSend).click();
    await sales.getByTestId(T.field('channels')).getByRole('button', { name: /portal/i }).click();
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'enviada');

    const customer = await pageAs('customer');
    await customer.goto(R.customerQuote(quoteCode));
    await expect(customer.getByTestId(T.portalQuoteStatus)).toHaveAttribute('data-status', 'vista');
    await expect(customer.getByText(/costo|margen/i)).toHaveCount(0);
    await customer.getByTestId(T.portalQuoteApprove).click();
    await customer.getByTestId(T.field('name')).fill('Gabriela Ríos Montoya');
    await customer.getByTestId(T.field('accept')).click();
    await customer.getByTestId(T.dialogConfirm).click();
    await expect(customer.getByTestId(T.portalQuoteStatus)).toHaveAttribute('data-status', 'aprobada');

    await sales.goto(R.opportunity(oppCode));
    const quoteRow = sales.locator(`a[href="/cotizaciones/${quoteCode}"]`);
    await expect(quoteRow).toContainText(/aprobada/i);
  });

  test('H-04: el cliente no puede aprobar mientras la aprobación interna esté pendiente', async ({ apiAs }) => {
    // Se valida por API (la UI del portal solo oculta el botón; la autoridad es el backend).
    const sales = await apiAs('sales2');
    const customer = await apiAs('customer');
    const list = await (await sales.get('/quotes', { 'filter[internal_approval]': 'pend' })).json();
    test.skip(!list.data?.length, 'Requiere una cotización enviada con aprobación interna pendiente en la semilla E2E');
    const q = list.data[0];
    const r = await customer.postIdem(`/portal/client/quotes/${q.code}/approve`, { approver_name: 'X', accept_terms: true }, undefined, q.lock_version);
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toMatch(/QTE-BR-13|H-04/);
  });
});
