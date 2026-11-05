---
description: Compara las rutas implementadas con el contrato OpenAPI y la fase actual
argument-hint: "[fase: 0 | 1 | 2 | 3]"
---
1. Ejecuta `make openapi-check` (genera el OpenAPI con Scramble y lo compara con `docs/kit/api/openapi.yaml` usando `docs/kit/api/compare_contract.py`).
2. Si se indicó fase ($ARGUMENTS), usa `python3 docs/kit/api/compare_contract.py <openapi-generado> --phase $ARGUMENTS` para exigir solo las operaciones con `x-phase` ≤ esa fase.
3. Reporta: endpoints del contrato aún no implementados, endpoints implementados que no están en el contrato, diferencias de método, parámetros, esquema de respuesta o permiso.
4. No cambies el contrato. Para cada diferencia indica si corresponde corregir el código o proponer un cambio al contrato (con justificación).
