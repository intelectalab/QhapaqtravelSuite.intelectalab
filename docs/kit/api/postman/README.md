# Colección Postman de la API — KipuControl

Colección **Postman v2.1** generada desde el contrato `kit-ia/api/openapi.json` por `build_postman.py`. Sirve para
probar el backend Laravel a mano durante el desarrollo, reproducir errores y compartir ejemplos de llamadas.
No se edita a mano: si cambia el contrato, se regenera.

| Archivo | Contenido |
|---|---|
| `kipucontrol-api.postman_collection.json` | 1 006 requests (una por operación del contrato) |
| `local.postman_environment.json` | Tenant demo TNT-0001 «andes»: `http://andes.localhost:8000`, usuario `mquispe@andeshorizonte.pe` (Tenant Admin) |
| `tenant-b.postman_environment.json` | Tenant TNT-0002 «selva»: `http://selva.localhost:8000`, usuario `gerencia@selvaviva.pe` (prueba de aislamiento E2E-08) |
| `build_postman.py` | Generador (Python 3, sin dependencias) |

## 1. Estructura

```
00 · Inicio: autenticación          ← login (guarda el token), MFA, login de plataforma, GET /me
Fase 0 · Fundaciones                  (79)  Núcleo · Administración y reportes
Fase 1 · MVP comercial y operativo    (411) CRM · Catálogo · Cotizaciones · Reservas · Operaciones · Finanzas · …
Fase 2 · Canales y campo              (371) Extranet · Canales y portales · Aprobaciones e inbox · Cupos · Sitio web · …
Fase 3 · SaaS y crecimiento           (140) Plataforma SaaS y API · Marketing y metas · Reseñas propias · …
```

Fase = `x-phase` de la operación; subcarpeta = primer `tag` del contrato (módulo). Cada request incluye:

- **URL** `{{baseUrl}}/api/v1/…` con variables de ruta `:id`, `:code`… Su valor por defecto sale de `kit-ia/seeds`
  cuando hay una colección que coincide (p. ej. `/crm/leads/:code` → `LEAD-0232`, `/catalog/products/:id` → `PRD-001`).
  El contrato indica que el backend acepta UUID o código legible (route model binding; supuesto del contrato).
- **Query params** documentados en el contrato (filtros `filter[…]`, `sort`, `include`, `page[size]`, `page[cursor]`),
  desactivados por defecto salvo los obligatorios: se activan con la casilla.
- **Headers**: `Accept: application/json`; `Authorization: Bearer {{token}}` (o `{{platformToken}}` en `/platform/*`);
  `X-KipuControl-Key` + `Origin` en rutas públicas del widget/sitio; `Cookie: ah_cart=…` o `X-Order-Token` en carrito y pedido;
  `X-Signature` en webhooks entrantes; `Idempotency-Key: {{$guid}}` en 156 operaciones (`x-idempotency` obligatorio u
  opcional); `If-Match: {{lockVersion}}` en 185 operaciones con `lock_version`. Donde el contrato admite API key del tenant,
  hay un segundo `Authorization: Bearer {{apiKey}}` desactivado como alternativa.
- **Cuerpo de ejemplo** (579 requests) derivado del esquema: enums → primer valor válido; fechas, montos decimales como
  string, nombres, correos y teléfonos tomados de las semillas (cliente `CLI-0001`, producto `PRD-001`); las FK (`*_id`)
  se envían como variables de colección `{{client_id}}`, `{{product_id}}`… con un UUID de ejemplo que hay que reemplazar
  por uno real del tenant. Los cuerpos de acción (`ActionBody`) llevan las claves que cita la descripción (`{reason}`,
  `{provider_id, reason}`…) o `{}` si la spec no las detalla. Los campos generados (`*_norm`, columnas STORED) se omiten.
- **Descripción**: texto de la operación, permiso (`x-permission` y `x-permissions`), fase, especificación y sección
  (`x-spec`, `x-spec-also`), tabla (`x-resource`), idempotencia, scope de API key y esquema de seguridad.

## 2. Importar

**Postman** (v10+): *Import* → arrastrar `kipucontrol-api.postman_collection.json` y los dos `*.postman_environment.json` →
elegir el entorno «KipuControl · local (andes · TNT-0001)» arriba a la derecha.

**Insomnia** (2023+): *Create* → *Import* → *From File* → la colección; Insomnia convierte las variables `{{…}}` y las
carpetas. Los entornos de Postman se importan igual (o se crea un *Environment* con `baseUrl`, `email`, `password`,
`tenantSlug`, `token`). Los scripts de prueba de Postman (`pm.*`) no se ejecutan en Insomnia: copiar el token del login
a la variable `token` a mano o con *Response → Body attribute* (`$.token`).

**Bruno** (v1+): *Import Collection* → *Postman Collection* → elegir el archivo y una carpeta destino; los entornos se
crean en *Environments* con las mismas variables. Bruno traduce `pm.environment.set` a `bru.setEnvVar` en la mayoría de
los casos; si no, en el request de login agregar en *Script › Post Response*:
`bru.setEnvVar("token", res.body.token || res.body.data?.token)`.

Alternativa: importar directamente `kit-ia/api/openapi.yaml` en cualquiera de las tres herramientas (se pierden los
cuerpos de ejemplo, los headers de idempotencia y el script de login).

## 3. Uso

1. Levantar el backend (`kit-ia/infra`, `make up`) y sembrar con `E2ESeeder` (contraseña común `E2E_PASSWORD`,
   TOTP común `E2E_TOTP_SECRET`; ver `kit-ia/tests/README.md`). Los valores por defecto del entorno coinciden con
   `kit-ia/tests/e2e/.env.example`.
2. Ejecutar **POST /auth/login**: el script de prueba guarda `token` en el entorno. Si el usuario tiene MFA
   (`tokenMfaPending = true`), poner el código TOTP en `totpCode` y ejecutar **POST /auth/mfa/verify**, que reemplaza
   `token` por el definitivo.
3. Para otro rol, cambiar `email` por un usuario de `kit-ia/seeds/users.json` (Ventas `lparedes@andeshorizonte.pe`,
   Operaciones `khuaman@andeshorizonte.pe`, Finanzas `pleon@andeshorizonte.pe`…) y repetir el login: así se prueban los
   403 por permiso y el ownership de Ventas (`SCOPE_OWNERSHIP`).
4. Aislamiento entre tenants: con el entorno *tenant B* pedir un recurso de TNT-0001 (p. ej. `GET /crm/leads/LEAD-0232`)
   → debe responder **404** (SEC-BR-02, E2E-08).
5. Idempotencia: `{{$guid}}` genera una clave nueva en cada envío. Para probar un reintento, reemplazarla por un valor
   fijo y enviar dos veces (misma respuesta) o cambiar el cuerpo (422 `IDEMPOTENCY_KEY_REUSED`).
6. Concurrencia: poner en `lockVersion` el `lock_version` leído del recurso; con un valor viejo la API responde 409.

Variables de entorno: `baseUrl`, `tenantSlug`, `email`, `password`, `totpCode`, `token`, `tokenMfaPending`,
`platformEmail`, `platformToken`, `widgetKey`, `siteOrigin`, `apiKey`, `cartToken`, `orderToken`, `providerSignature`,
`lockVersion`. Los valores de `widgetKey` (`pk_test_…`) y `apiKey` (`qts_test_…`) son marcadores: copiar los reales desde
Administración › API / Integración web del tenant.

## 4. Regenerar

```bash
python3 kit-ia/api/postman/build_postman.py
# operaciones en OpenAPI: 1006 · requests en colección: 1006 · variables FK: 146
```

El script falla (código 1) si el número de requests no coincide con las operaciones del contrato o con el total esperado
(`EXPECTED_REQUESTS = 1006`); al agregar endpoints al contrato, actualizar esa constante. `kit-ia/referencia/tools/regenerar.sh`
regenera esta colección junto con el material de `kit-ia/referencia/`.

Supuestos: el nombre del header del token de pedido (`X-Order-Token`) y el de firma de webhooks (`X-Signature`) son
los del contrato, que los marca como supuestos; el código de conflicto de versión es `STALE_VERSION`
(spec 00 y contrato, ver `kit-ia/referencia/CODIGOS-DE-ERROR.md`).
