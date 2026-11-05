import { test, expect, expectToast } from '../fixtures/auth';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-01 (DOC-PROC-001; esp. 01 §10, 03 T-Q15, 08 P05)
 * Lead → tomar → actividad completada → BANT → convertir (cliente existente) → oportunidad →
 * cotización con descuento fuera de política → aprobación interna (Manager) → envío →
 * vista en portal del cliente → aprobación del cliente.
 * Fase 1 · criterio de salida del MVP.
 */
test.describe('E2E-01 · Lead a cotización aprobada @fase1 @e2e01', () => {
  test('flujo completo con historial visible en el 360', async ({ pageAs }) => {
    // ---- Ventas U04 toma el lead sin asignar y lo califica ----
    const sales = await pageAs('sales2');
    await sales.goto(R.lead('LEAD-0232'));
    await sales.getByTestId(T.leadTake).click();
    await expectToast(sales, /asignado|tomado/i, 'ok');
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'nuevo');

    // Primer contacto: la actividad completada pasa el lead a «contactado» (CRM-BR)
    await sales.getByTestId(T.leadActivityDone('primer-contacto')).click();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'contactado');

    // BANT completo → calificado
    for (const k of ['budget', 'authority', 'need', 'timing']) await sales.getByTestId(T.leadBant(k)).check();
    await sales.getByTestId(T.leadQualify).click();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'calificado');

    // Convertir con cliente existente de su cartera (CLI-0001, portal U14)
    await sales.getByTestId(T.leadConvert).click();
    await sales.getByTestId(T.leadConvertClientMode('existing')).check();
    await sales.getByTestId(T.leadConvertClient).selectOption('CLI-0001');
    await sales.getByTestId(T.field('opportunity.title')).fill('Perú Clásico familia Ríos');
    await sales.getByTestId(T.field('opportunity.amount')).fill('19000');
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales).toHaveURL(/\/crm\/oportunidades\/OPP-\d{4}/);
    const oppCode = sales.url().split('/').pop()!;

    // ---- Cotización desde la oportunidad, con descuento 12 % (> tope 10 %: requiere gerencia) ----
    await sales.getByTestId(T.opportunityCreateQuote).click();
    await expect(sales).toHaveURL(new RegExp(`/cotizaciones/nueva\\?opp=${oppCode}`));
    await sales.getByTestId(T.quoteAddProduct).click();
    await sales.getByTestId(T.quoteProductOption('PRD-011')).click();
    await sales.getByTestId(T.field('items.0.service_date')).fill('2026-11-20');
    await sales.getByTestId(T.field('items.0.pax_adt')).fill('2');
    await sales.getByTestId(T.quoteDiscount).fill('12');
    await sales.getByTestId(T.quoteSave).click();
    await expect(sales).toHaveURL(/\/cotizaciones\/COT-2026-\d{5}$/);
    const quoteCode = sales.url().split('/').pop()!;
    await expect(sales.getByTestId(T.quoteApprovalBanner)).toBeVisible();

    // Sin aprobación interna no se puede enviar (QTE-BR-12)
    await expect(sales.getByTestId(T.quoteSend)).toBeDisabled();
    await sales.getByTestId(T.quoteRequestApproval).click();
    await expectToast(sales, /solicitud/i, 'ok');

    // ---- Manager U02 aprueba (justificación obligatoria) ----
    const manager = await pageAs('manager');
    await manager.goto(R.quote(quoteCode));
    await manager.getByTestId(T.quoteInternalApprove).click();
    await manager.getByTestId(T.field('note')).fill('Cliente recurrente; margen sigue sobre 15 %');
    await manager.getByTestId(T.dialogConfirm).click();
    await expect(manager.getByTestId(T.quoteApprovalBanner)).toHaveAttribute('data-state', 'aprobada');

    // ---- Ventas envía por portal ----
    await sales.reload();
    await sales.getByTestId(T.quoteSend).click();
    await sales.getByTestId(T.quoteSendChannel('portal')).check();
    await sales.getByTestId(T.dialogConfirm).click();
    await expect(sales.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'enviada');

    // ---- Cliente U14 abre (→ vista) y aprueba ----
    const customer = await pageAs('customer');
    await customer.goto(R.customerQuote(quoteCode));
    await expect(customer.getByTestId(T.portalQuoteStatus)).toHaveAttribute('data-status', 'vista');
    await expect(customer.getByText(/costo|margen/i)).toHaveCount(0); // el portal nunca muestra costos
    await customer.getByTestId(T.portalQuoteApproverName).fill('Gabriela Ríos Montoya');
    await customer.getByTestId(T.portalQuoteAcceptTerms).check();
    await customer.getByTestId(T.portalQuoteApprove).click();
    await expect(customer.getByTestId(T.portalQuoteStatus)).toHaveAttribute('data-status', 'aprobada');

    // ---- Historial visible en el 360 de la oportunidad ----
    await sales.goto(R.opportunity(oppCode));
    const tl = sales.getByTestId(T.timeline360);
    for (const hito of [/lead convertido/i, /cotización creada/i, /aprobación interna/i, /enviada/i, /vista/i, /aprobada por el cliente/i]) {
      await expect(tl).toContainText(hito);
    }
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
