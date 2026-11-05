---
description: Propone la siguiente historia a implementar según fase, prioridad y dependencias
argument-hint: "[fase: 0 | 1a | 1b | 2 | 3]"
---
Revisa `docs/kit/backlog/backlog-completo.csv` y `docs/CHANGELOG.md` para saber qué historias ya están hechas (busca sus IDs en el changelog y en los mensajes de `git log --oneline`).

Fase indicada: $ARGUMENTS (si está vacía, usa la fase más baja con historias pendientes; orden 0 → 1a → 1b → 2 → 3).

Devuelve una tabla con las 5 siguientes historias listas para empezar (todas sus dependencias cumplidas), ordenadas por prioridad (P0 antes que P1 y P2) y luego por ID: ID, título, prioridad, dependencias. No implementes nada.
