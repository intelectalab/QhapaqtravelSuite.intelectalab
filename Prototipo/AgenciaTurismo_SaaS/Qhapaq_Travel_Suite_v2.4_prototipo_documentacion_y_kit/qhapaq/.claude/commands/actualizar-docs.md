---
description: Registra en la documentación las diferencias entre lo implementado y la especificación
argument-hint: <ID de historia o tema>
---
Para $ARGUMENTS:

1. Compara lo implementado (diff de la rama actual) con la especificación citada por la historia.
2. Si hay diferencias o decisiones nuevas, agrégalas a la sección 11 («Supuestos y puntos abiertos») de esa especificación, con fecha e ID de historia.
3. Añade una entrada a `docs/CHANGELOG.md` bajo «Sin publicar»: Añadido / Cambiado / Corregido, una línea por cambio.
4. Si cambió una tabla o un endpoint, confirma que `docs/kit/database/` y `docs/kit/api/openapi.yaml` ya reflejan el cambio; si no, actualízalos y ejecuta sus validadores (`docs/kit/database/tests/validate.sh`, `python3 docs/kit/api/build_openapi.py --check`).
5. Muestra el resumen de lo que escribiste.
