import { expect } from '@playwright/test';
import type { Api } from './api';
import { idemKey } from './api';

/**
 * Preparación de datos por API (Arrange). Las pruebas de UI no deben depender de clics previos
 * de otra prueba: cada spec prepara lo que necesita con estos helpers.
 * SUPUESTO: el cuerpo de POST /quotes sigue esp. 03 §6 (client_id, opportunity_id, currency,
 * items[] con product_id/rate_id/service_date/pax/qty, discount_pct). Ajustar al FormRequest real.
 */
export async function createApprovedQuote(api: Api, opts: {
  clientCode: string; productCode: string; serviceDate: string; pax: number; currency?: 'PEN' | 'USD'; opportunityCode?: string;
}) {
  const clientId = await api.idOf('/crm/clients', opts.clientCode);
  const productId = await api.idOf('/catalog/products', opts.productCode);
  const created = await api.postIdem('/quotes', {
    client_id: clientId,
    opportunity_id: opts.opportunityCode ? await api.idOf('/crm/opportunities', opts.opportunityCode) : null,
    currency: opts.currency ?? 'PEN',
    discount_pct: 0,
    items: [{ product_id: productId, service_date: opts.serviceDate, pax: opts.pax, qty: 1 }],
  });
  expect(created.status(), await created.text()).toBe(201);
  let q = (await created.json()).data;

  const sent = await api.postIdem(`/quotes/${q.id}/send`, { channels: ['email'], message: 'E2E' }, idemKey(), q.lock_version);
  expect(sent.status(), await sent.text()).toBeLessThan(300);
  q = (await sent.json()).data;

  const approved = await api.postIdem(`/quotes/${q.id}/approve`, { approved_by_name: 'Cliente E2E', channel: 'email', ref: 'E2E' }, idemKey(), q.lock_version);
  expect(approved.status(), await approved.text()).toBeLessThan(300);
  return (await approved.json()).data as { id: string; code: string; lock_version: number; total: string };
}

/** Fecha ISO sumando días (fechas de servicio relativas a la fecha congelada). */
export const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
