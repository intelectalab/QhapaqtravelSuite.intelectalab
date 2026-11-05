---
description: Implementa un endpoint exactamente como está en el contrato OpenAPI
argument-hint: "<MÉTODO> <ruta>, ej. POST /api/v1/quotes/{quote}/convert"
---
Implementa el endpoint `$ARGUMENTS`.

1. Lee su definición en `docs/kit/api/openapi.yaml`: parámetros, cuerpo, respuestas, `x-permission`, `x-idempotency`, `If-Match`, `x-phase` y la especificación de origen.
2. Crea o actualiza: FormRequest (validación y mensajes en español), Policy (permiso del contrato + ownership + recurso vinculado para usuarios externos), Action (un caso de uso, dentro de `DB::transaction`), JsonResource (omitiendo costos y márgenes según permiso) y la ruta.
3. Si el contrato marca idempotencia, aplica el middleware `idempotent`. Si marca `If-Match`, valida `lock_version` y responde 409 ante conflicto.
4. Pruebas Pest: 2xx feliz, 422 con `code` de regla, 403 para un rol sin permiso, 404 para recurso de otro tenant, repetición idempotente y 409 si aplica.
5. `make test lint openapi-check` en verde. Si el contrato está mal, no lo cambies en silencio: propón el cambio y anótalo en `docs/CHANGELOG.md`.
