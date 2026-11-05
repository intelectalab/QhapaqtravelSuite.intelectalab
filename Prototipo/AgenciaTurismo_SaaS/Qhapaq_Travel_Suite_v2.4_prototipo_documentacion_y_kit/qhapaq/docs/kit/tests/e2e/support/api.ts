import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import { API } from './routes';
import { PASSWORD, TOTP_SECRET, userFor, type RoleAlias } from './users';

export const API_URL = process.env.E2E_API_URL ?? 'http://andes.localhost:8000/api/v1';

/** Clave de idempotencia nueva (CONVENCIONES §3). Reusar la misma para probar idempotencia. */
export const idemKey = (prefix = 'e2e') => `${prefix}-${randomUUID()}`;

/** Login por API (Sanctum) con MFA TOTP si el usuario lo exige (esp. 00 §6). Devuelve el token completo. */
export async function apiToken(email: string, opts: { mfa?: boolean; baseURL?: string } = {}): Promise<string> {
  const ctx = await request.newContext({ baseURL: opts.baseURL ?? API_URL });
  const res = await ctx.post(API.login.slice(1), { data: { email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`Login ${email} → ${res.status()} ${await res.text()}`);
  let body = await res.json();
  if (body.mfa_required || body.abilities?.includes?.('mfa:verify')) {
    const mfa = await ctx.post(API.mfaVerify.slice(1), {
      headers: { Authorization: `Bearer ${body.token}` },
      data: { code: authenticator.generate(TOTP_SECRET) },
    });
    if (!mfa.ok()) throw new Error(`MFA ${email} → ${mfa.status()}`);
    body = await mfa.json();
  }
  await ctx.dispose();
  return body.token as string;
}

/** Cliente API autenticado como un rol semilla. */
export class Api {
  private constructor(public readonly ctx: APIRequestContext) {}

  static async as(alias: RoleAlias, baseURL = API_URL): Promise<Api> {
    const u = userFor(alias);
    const token = await apiToken(u.email, { mfa: u.mfa });
    return Api.withToken(token, baseURL);
  }

  static async withToken(token: string, baseURL = API_URL): Promise<Api> {
    const ctx = await request.newContext({
      baseURL: baseURL.endsWith('/') ? baseURL : `${baseURL}/`,
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    return new Api(ctx);
  }

  private p(path: string) { return path.startsWith('/') ? path.slice(1) : path; }

  get(path: string, params?: Record<string, string | number>) { return this.ctx.get(this.p(path), { params }); }
  post(path: string, data?: unknown, headers: Record<string, string> = {}) { return this.ctx.post(this.p(path), { data, headers }); }
  patch(path: string, data?: unknown, headers: Record<string, string> = {}) { return this.ctx.patch(this.p(path), { data, headers }); }
  put(path: string, data?: unknown, headers: Record<string, string> = {}) { return this.ctx.put(this.p(path), { data, headers }); }
  delete(path: string, headers: Record<string, string> = {}) { return this.ctx.delete(this.p(path), { headers }); }

  /** POST con Idempotency-Key (y If-Match opcional). */
  postIdem(path: string, data: unknown, key = idemKey(), ifMatch?: number) {
    const h: Record<string, string> = { 'Idempotency-Key': key };
    if (ifMatch != null) h['If-Match'] = String(ifMatch);
    return this.post(path, data, h);
  }

  /**
   * Resuelve el id (uuid) a partir del código legible. Supuesto: todos los listados aceptan
   * `filter[code]=` (CONVENCIONES §3 lista `filter[…]` genérico); si el módulo expone `/{code}`
   * directamente, usar ese camino.
   */
  async idOf(listPath: string, code: string): Promise<string> {
    const r = await this.get(listPath, { 'filter[code]': code });
    const j = await r.json();
    const row = (j.data ?? []).find((x: { code: string }) => x.code === code);
    if (!row) throw new Error(`${code} no encontrado en ${listPath}`);
    return row.id;
  }

  async dispose() { await this.ctx.dispose(); }
}

export async function json<T = any>(res: APIResponse): Promise<T> {
  const t = await res.text();
  try { return JSON.parse(t) as T; } catch { throw new Error(`Respuesta no JSON (${res.status()}): ${t.slice(0, 300)}`); }
}
