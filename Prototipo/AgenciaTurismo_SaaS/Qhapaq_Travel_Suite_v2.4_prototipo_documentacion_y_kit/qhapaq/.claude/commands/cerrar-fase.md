---
description: Verifica que una fase cumple su criterio de salida antes de pasar a la siguiente
argument-hint: <fase: 0 | 1a | 1b | 2 | 3>
---
Verifica el cierre de la fase $ARGUMENTS:

1. Lista las historias de `docs/kit/backlog/fase-$ARGUMENTS.md` y marca cuáles tienen commit con su ID (`git log --oneline --grep`). Reporta las pendientes.
2. Ejecuta la batería completa: `make test lint openapi-check` (backend), `npm run lint test e2e` (web) y las pruebas E2E de la fase en `docs/kit/tests/e2e/` (`npm run test:fase0`, `test:fase1` —cubre 1a y 1b— o `test:fase2`; la fase 3 usa la batería completa `npm test`).
3. Comprueba el criterio de salida de la fase en `docs/03-PLAN-DE-IMPLEMENTACION.md`.
4. Ejecuta `/revisar-seguridad` sobre los cambios de la fase.
5. Entrega un informe: historias hechas / pendientes, pruebas (pasan / fallan), endpoints de la fase implementados frente al contrato, riesgos abiertos y decisiones pendientes que bloquean la siguiente fase.
