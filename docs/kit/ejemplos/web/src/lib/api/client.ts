/**
 * Cliente tipado de la API (openapi-fetch + tipos generados con openapi-typescript desde kit-ia/api/openapi.yaml).
 *
 *   npm run api:gen   →  openapi-typescript ../docs/kit/api/openapi.yaml -o src/lib/api/schema.d.ts
 *
 * Dos instancias:
 *  - `browserApi`: en el navegador llama al BFF de Next (`/bff/...`, ver app/bff/[...path]/route.ts). El token
 *    Sanctum vive en una cookie httpOnly y NUNCA llega al JavaScript del navegador (api/README §2).
 *  - `serverApi()`: en Server Components / Route Handlers llama a la API interna con el token de la cookie.
 *
 * Middleware del cliente:
 *  - `X-Request-Id` por solicitud (correlation_id del backend).
 *  - Exige `Idempotency-Key` e `If-Match` en las operaciones que el contrato marca (critical-ops.ts, generado).
 *    Los tipos ya obligan a pasarlos en `params.header`; esta comprobación cubre llamadas con `as` o fetch manual.
 *  - Convierte toda respuesta no-2xx en ApiError (TanStack Query la recibe como error de la query/mutación).
 */
import createClient, { type Middleware } from "openapi-fetch";
import { IDEMPOTENT_OPS, IF_MATCH_OPS, opKey } from "./critical-ops";
import { ApiError } from "./errors";
import type { paths } from "./schema";

export type ApiClient = ReturnType<typeof createApiClient>;

type Options = {
  /** Origen sin `/api/v1` (las rutas del contrato ya lo incluyen). */
  baseUrl: string;
  /** Solo en servidor: token Sanctum leído de la cookie httpOnly. */
  getToken?: () => Promise<string | null> | string | null;
  /** Solo en servidor (BFF/SSR): host del tenant para que el backend lo contraste con el token (SEC-BR-02). */
  forwardedHost?: string;
};

export function createApiClient({ baseUrl, getToken, forwardedHost }: Options) {
  const client = createClient<paths>({ baseUrl, headers: { Accept: "application/json" } });

  const middleware: Middleware = {
    async onRequest({ request, schemaPath }) {
      request.headers.set("X-Request-Id", crypto.randomUUID());
      if (forwardedHost) request.headers.set("X-Forwarded-Host", forwardedHost);

      const token = getToken ? await getToken() : null;
      if (token) request.headers.set("Authorization", `Bearer ${token}`);

      const key = opKey(request.method, schemaPath);
      if (IDEMPOTENT_OPS.has(key) && !request.headers.get("Idempotency-Key")) {
        // Nunca generar la clave aquí: un reintento automático produciría una clave nueva y duplicaría la operación.
        throw new Error(`${key} requiere Idempotency-Key: usar useIdempotencyKey() en el formulario.`);
      }
      if (IF_MATCH_OPS.has(key) && !request.headers.get("If-Match")) {
        throw new Error(`${key} requiere If-Match con el lock_version leído del recurso.`);
      }
      return request;
    },
    async onResponse({ response }) {
      if (!response.ok) throw await ApiError.fromResponse(response);
      return response;
    },
  };

  client.use(middleware);
  return client;
}

/** Navegador → BFF de Next (misma sesión por cookie). */
export const browserApi = createApiClient({ baseUrl: "/bff" });

/**
 * Servidor → API interna (Docker: API_INTERNAL_URL=http://nginx/api/v1 en infra/env/web.env.example).
 * `cookies()`/`headers()` son asíncronos en Next 15.
 */
export async function serverApi(): Promise<ApiClient> {
  const { cookies, headers } = await import("next/headers");
  const jar = await cookies();
  const host = (await headers()).get("host") ?? undefined;
  const origin = new URL(process.env.API_INTERNAL_URL ?? "http://localhost:8000/api/v1").origin;
  return createApiClient({
    baseUrl: origin,
    getToken: () => jar.get(SESSION_COOKIE)?.value ?? null,
    forwardedHost: host,
  });
}

/** Cookie httpOnly con el token Sanctum (la fija el BFF al iniciar sesión; SameSite=Lax, Secure en producción). */
export const SESSION_COOKIE = "kipucontrol_session";
/** Cookie legible por el middleware de Next con la experiencia y el rol (UX; la API vuelve a validar todo). */
export const UX_COOKIE = "kipucontrol_ux";
