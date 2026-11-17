import { expect } from '@playwright/test';
import type { Api } from './api';
import { idemKey } from './api';

/**
 * Preparación de datos por API (Arrange). Las pruebas de UI no deben depender de clics previos
 * de otra prueba: cada spec prepara lo que necesita con estos helpers.
 * Cuerpo de POST /quotes según el FormRequest real (QuoteSaveRequest): cliente, oportunidad y
 * productos por código. Los productos del kit se nombran por su `ref` (PRD-011) y se traducen a su código.
 */
async function productCodeOf(api: Api, ref: string): Promise<string> {
  const rows = (await (await api.get('/catalog/products', { 'filter[code]': ref })).json()).data as { code: string; ref: string }[];
  const row = rows.find((x) => x.code === ref || x.ref === ref);
  expect(row, `producto ${ref}`).toBeTruthy();
  return row!.code;
}

async function quoteState(api: Api, code: string) {
  const r = await api.get(`/quotes/${code}`);
  expect(r.status(), await r.text()).toBe(200);
  const q = (await r.json()).data;
  return { id: q.id as string, code: q.code as string, lock_version: Number(q.lock_version), total: String(q.total ?? q.grand_total ?? '') };
}

export async function createApprovedQuote(api: Api, opts: {
  clientCode: string; productCode: string; serviceDate: string; pax: number; currency?: 'PEN' | 'USD'; opportunityCode?: string;
}) {
  const created = await api.postIdem('/quotes', {
    client_code: opts.clientCode,
    opportunity_code: opts.opportunityCode ?? null,
    title: `E2E ${opts.productCode} ${opts.serviceDate}`,
    travel_from: opts.serviceDate,
    travel_to: opts.serviceDate,
    currency: opts.currency ?? 'PEN',
    pax_adt: opts.pax,
    discount_pct: 0,
    items: [{ product_code: await productCodeOf(api, opts.productCode), date: opts.serviceDate, pax: opts.pax, qty: 1, segment: 'Adulto' }],
  });
  expect(created.status(), await created.text()).toBe(201);
  let q = await quoteState(api, (await created.json()).data.code);

  const sent = await api.postIdem(`/quotes/${q.code}/send`, { channels: ['email'], message: 'E2E' }, idemKey(), q.lock_version);
  expect(sent.status(), await sent.text()).toBeLessThan(300);
  q = await quoteState(api, q.code);

  const approved = await api.postIdem(`/quotes/${q.code}/approve`, { approved_by_name: 'Cliente E2E', channel: 'email', ref: 'E2E' }, idemKey(), q.lock_version);
  expect(approved.status(), await approved.text()).toBeLessThan(300);
  return quoteState(api, q.code);
}

/** Fecha ISO sumando días (fechas de servicio relativas a la fecha congelada). */
export const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
