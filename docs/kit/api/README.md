# Contrato API — KipuControl (`/api/v1`)

Contrato **OpenAPI 3.1** de todo el SaaS, generado desde las 26 especificaciones. Es la fuente de verdad para el
backend Laravel (lo que debe exponer) y para el frontend Next.js y las apps Expo (lo que pueden consumir).

| Archivo | Qué es |
|---|---|
| `openapi.yaml` / `openapi.json` | Contrato (mismo contenido en dos formatos). **No editar a mano.** |
| `build_openapi.py` | Generador reproducible: lee §6 (API REST) y §3 (modelo de datos) de `proto/docs/especificaciones/*.md`, deduplica, valida y escribe el contrato y `ENDPOINTS.md`. |
| `ENDPOINTS.md` | Índice por fase y módulo (método, ruta, permiso, spec), resumen con conteos, conflictos entre specs, alias, supuestos y rutas ambiguas. |
| `compare_contract.py` | Compara el OpenAPI que genera el código (Scramble) contra este contrato, por fase. Para CI. |

## 1. Regenerar y validar

```bash
pip install pyyaml openapi-spec-validator        # una vez
python3 kit-ia/api/build_openapi.py               # genera openapi.yaml/json + ENDPOINTS.md y valida (falla si hay errores)
python3 kit-ia/api/build_openapi.py --check       # CI: falla si el contrato versionado no coincide con las specs
```

Flujo de cambio: **se edita la spec** (§6 para endpoints, §3 para tablas) → se ejecuta el script → se revisa el diff
del contrato → se sube la versión (§5). Si el script interpreta mal una fila, se corrige la regla en la sección
`REGLAS` del script (`CELL_OVERRIDES`, `PATH_ALIASES`, `RESOURCE_MAP`, `PERM_ABBREV`…), nunca el YAML.

### Qué contiene cada operación

- `operationId` único y estable (`listCrmLeads`, `showQuotes`, `createReservations`, `postQuotesConvert`…): se usa
  como nombre de función en los clientes generados. Cambiarlo es un cambio incompatible para el frontend.
- `tags` = módulo (spec dueña del dominio). `summary` = `MÉTODO /ruta — primera frase de la spec`; `description` = texto completo de la tabla.
- Parámetros de ruta; en listados: `filter[...]` (los que nombra la spec, o `filter` deepObject), `sort`, `include`, `page[size]`, `page[cursor]`.
- `Idempotency-Key` (header requerido) donde la spec lo indica o en operaciones críticas (conversión, pagos, vouchers,
  comprobantes, checkout). Webhooks entrantes: sin header, idempotentes por id de evento (`x-idempotency.mode: webhook`).
- `If-Match` (valor = `lock_version`) donde la spec declara lock/`lock_version`, o en PATCH/PUT/DELETE de tablas con `lock_version`.
- `requestBody`/respuestas con `$ref` al esquema de la tabla (`CrmLead`, `QuoteQuote`, `BookingReservation`…) y `…Input`
  para altas/ediciones; respuestas envueltas en `{ data, meta }` (JsonResource); listados `{ data[], meta, links }`.
- Errores comunes: 401, 403 (`required_permissions`, `SCOPE_OWNERSHIP`, `FEATURE_NOT_IN_PLAN`), 404, 409 (estado,
  disponibilidad, `lock_version`), 422 (`errors` + `code` de regla), 429 (`Retry-After`).
- Extensiones: `x-permission` (texto de la spec), `x-permissions` (códigos spatie), `x-spec` / `x-spec-also` (archivo y
  sección), `x-phase` (0–3), `x-resource` (tabla), `x-idempotency`, `x-api-key-scope`.

Seguridad: `sanctum` (por defecto), `platformSanctum` (`/platform/*`), `widgetKey` (`X-KipuControl-Key`, para `/public/*`),
`cartToken` / `orderToken` (carrito y pedido web), `tenantApiKey` y `oauth2` con scopes (`catalog:read`, `reservations:write`…)
en las rutas de la API pública del tenant, `providerSignature` (webhooks entrantes).

Valores de `x-permission` sin punto (v2.5): no son permisos de spatie sino la **experiencia o ability del token**
que exige el middleware `EnsureExperience` (`customer`, `passenger`, `rol b2b`, `supplier`, `super_admin`,
`autenticado`, `token mfa:verify`) o el mecanismo de acceso público (`público`, `token carrito`, `token del pedido`,
firma del proveedor). En esas rutas la autorización fina es por **vínculo** (`client_id`, `reservation_id`,
`agency_id`, `provider_id`) en la Policy. Todo valor con punto debe existir en `referencia/PERMISOS-ROL.csv`.

## 2. Cliente TypeScript para Next.js

Opción recomendada — **openapi-typescript + openapi-fetch** (tipos puros, sin código generado que mantener) con TanStack Query:

```bash
pnpm add openapi-fetch openapi-react-query @tanstack/react-query
pnpm add -D openapi-typescript
# package.json → "api:types": "openapi-typescript ../kit-ia/api/openapi.yaml -o src/lib/api/schema.d.ts"
pnpm api:types
```

```ts
// src/lib/api/client.ts  (se usa desde Route Handlers / Server Actions del BFF; el token Sanctum nunca llega al navegador)
import createClient, { type Middleware } from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import type { paths } from "./schema";

const auth: Middleware = {
  async onRequest({ request, schemaPath }) {
    request.headers.set("Authorization", `Bearer ${await getSanctumToken()}`);
    // Idempotency-Key: generarla UNA vez por intento lógico (al abrir el formulario) y reutilizarla en los reintentos
    if (request.method !== "GET" && !request.headers.has("Idempotency-Key") && IDEMPOTENT_OPS.has(schemaPath)) {
      request.headers.set("Idempotency-Key", crypto.randomUUID());
    }
    return request;
  },
};
export const api = createClient<paths>({ baseUrl: process.env.API_URL });
api.use(auth);
export const $api = createQueryClient(api);   // $api.useQuery("get", "/api/v1/crm/leads", { params: { query: { "filter[status]": "nuevo" } } })
```

`IDEMPOTENT_OPS` e `If-Match`: openapi-typescript no emite extensiones `x-*`; generar el conjunto en build con
`jq -r '.paths|to_entries[]|.key as $p|.value|to_entries[]|select(.value["x-idempotency"].mode=="required")|$p' openapi.json`.
Para `If-Match`, enviar el `lock_version` leído del recurso (`headers: { "If-Match": String(lead.lock_version) }`) y, ante 409, recargar y reintentar con el usuario.

Alternativa — **orval** (genera hooks de TanStack Query y esquemas Zod para React Hook Form):

```ts
// orval.config.ts
export default {
  kipucontrol: {
    input: "../kit-ia/api/openapi.yaml",
    output: { target: "src/lib/api/generated.ts", client: "react-query", mode: "tags-split",
              override: { mutator: { path: "src/lib/api/fetcher.ts", name: "apiFetch" } } },   // añade token, Idempotency-Key, If-Match
  },
  kipucontrolZod: { input: "../kit-ia/api/openapi.yaml", output: { target: "src/lib/api/zod.ts", client: "zod", mode: "tags-split" } },
};
```

Los esquemas `…Input` no llevan `required` (la obligatoriedad la fija cada FormRequest): los esquemas Zod del formulario
se escriben a mano espejo del FormRequest, partiendo del generado. Regenerar el cliente en CI y fallar si hay diff
(`pnpm api:types && git diff --exit-code src/lib/api`).

## 3. Contrato ↔ Laravel en CI (dedoc/scramble)

Scramble documenta lo que el código **realmente** expone; el job compara eso con este contrato.

```bash
composer require dedoc/scramble
php artisan vendor:publish --provider="Dedoc\Scramble\ScrambleServiceProvider" --tag="scramble-config"
# config/scramble.php → 'api_path' => 'api/v1', 'info' => ['version' => env('API_CONTRACT_VERSION', '1.0.0')]
php artisan scramble:export --path=build/openapi.generated.json
```

```yaml
# .github/workflows/api-contract.yml (extracto)
- run: python3 kit-ia/api/build_openapi.py --check                  # el contrato versionado corresponde a las specs
- run: php artisan scramble:export --path=build/openapi.generated.json
- run: python3 kit-ia/api/compare_contract.py build/openapi.generated.json --phase ${{ vars.API_PHASE }} --strict-extra
- run: docker run --rm -v "$PWD:/w" tufin/oasdiff breaking /w/kit-ia/api/openapi.yaml /w/build/openapi.generated.json --fail-on ERR
```

- `compare_contract.py --phase N`: exige que existan en el código todas las operaciones con `x-phase <= N` (la fase en
  curso); `--strict-extra` falla si el código publica rutas que el contrato no tiene (primero se agrega a la spec).
  Los nombres de parámetros de ruta no se comparan (`{id}` ≡ `{code}`).
- `oasdiff breaking`: detecta diferencias de tipos, parámetros requeridos y respuestas. Scramble infiere los cuerpos
  desde FormRequest y JsonResource; para que coincidan, tipar los recursos (`@property` / `JsonResource` con arrays
  explícitos) y declarar enums con `Rule::in([...])`.
- Complemento recomendado en Pest: validar respuestas reales contra el contrato (p. ej. `hotmeteor/spectator`;
  verificar soporte OpenAPI 3.1 en la versión instalada) en los tests feature de cada módulo.
- Rutas: registrar las literales antes que las parametrizadas (`/quotes/kpis` antes de `/quotes/{id}`) y resolver los
  pares cruzados que lista `ENDPOINTS.md` («Rutas ambiguas») con `->whereUuid()` / `->where()`.

## 4. Decisiones y supuestos del contrato

Detalle en `ENDPOINTS.md` → «Conflictos y deduplicación». Resumen:

- Endpoints repetidos entre specs se unifican (misma operación = mismo método + plantilla de ruta); se conserva la spec
  dueña del dominio, su fase, la idempotencia/`If-Match` más estricta y, si el permiso difiere, la unión `a | b` (a decidir).
- Alias: `/fin/…` → `/finance/…`, `/operations/…` → `/ops/…`, `/customer/reservations/…` → `/portal/client/reservations/…`.
- Parámetros de ruta unificados por prefijo (`/reservations/{id}` en todo el recurso); el backend acepta UUID o `code`.
- Dominio de staging, `X-Order-Token` y `X-Signature` son nombres propuestos (la spec no los fija).
- Las tablas de §3 se exponen completas como esquemas (menos `tenant_id` y secretos); las que no usa ninguna operación
  quedan como referencia del modelo (Redocly las marca como `no-unused-components`).

## 5. Versionado del contrato

- **SemVer en `info.version`** (constante `CONTRACT_VERSION` del script); el prefijo de URL solo cambia con MAJOR.
  - **PATCH** (1.0.x): textos, descripciones, ejemplos, correcciones de interpretación sin cambio de forma.
  - **MINOR** (1.x.0): cambios aditivos — nuevos endpoints, parámetros o campos opcionales, nuevos valores de enum en respuestas.
  - **MAJOR** (2.0.0 → `/api/v2`): quitar/renombrar endpoint u `operationId`, volver requerido un campo o parámetro,
    cambiar tipos o códigos de estado. `/api/v1` convive al menos 6 meses para integraciones con API key/OAuth y webhooks (supuesto).
- Deprecación: `deprecated: true` en la operación + header `Sunset` y `Deprecation` en la respuesta; anotar en `proto/docs/CHANGELOG.md`.
- Cada versión se etiqueta en git (`api-contract-v1.3.0`) y se publica en `/api/v1/docs/openapi.json` (spec 13).
- `x-phase` y `x-permission` no afectan la versión; cambios de permiso sí se anotan en el CHANGELOG (impactan RBAC y pruebas 403).
