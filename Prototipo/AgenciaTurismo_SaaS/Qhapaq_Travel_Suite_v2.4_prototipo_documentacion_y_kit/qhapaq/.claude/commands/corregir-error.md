---
description: Diagnostica y corrige un error con una prueba que lo reproduzca primero
argument-hint: <descripción del error o salida del log>
---
Error reportado: $ARGUMENTS

1. Reproduce el error con una prueba (Pest o Playwright) que falle hoy. Muéstrame la prueba antes de corregir.
2. Encuentra la causa raíz; no parches el síntoma. Revisa si viola alguna regla de `CLAUDE.md` o un hallazgo H-xx.
3. Corrige con el cambio mínimo, deja la prueba en verde y ejecuta la batería del repositorio.
4. Explica en español la causa, la corrección y si hace falta registrar algo en `docs/CHANGELOG.md`.
