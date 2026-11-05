# Qhapaq Travel Suite — espacio de trabajo para desarrollo (v2.4)

Esta carpeta ya está armada como raíz del proyecto:

- `CLAUDE.md` y `.claude/` — instrucciones, comandos y subagentes para Claude Code (abrir Claude Code aquí).
- `backend/`, `web/`, `mobile/` — vacíos salvo su `CLAUDE.md` y `.env.example`; la Fase 0 (historia F0-01) los crea.
- `docker-compose.yml`, `Makefile`, `docker/`, `.github/workflows/ci.yml` — entorno local y CI.
- `docs/` — documentación funcional y técnica (`docs/index.html` abre el portal con buscador), especificaciones, auditoría UX/responsive, prototipo navegable (`docs/prototipo/index.html`) y el kit (`docs/kit/`).

Por dónde empezar:
1. `docs/kit/00-LEEME-KIT.md` — qué contiene el kit y cómo usarlo.
2. `docs/kit/GUIA-TECNICA.md` — cómo encaja todo (arquitectura, tenancy, permisos, motor de reservas, frontend, móvil, seguridad).
3. `docs/kit/ejemplos/` — código de referencia verificado.
4. `docs/kit/database/referencia/` y `docs/kit/referencia/` — diccionario de datos, diagramas ER, máquinas de estado, reglas, errores, eventos, permisos y glosario.
5. `docs/kit/PROMPTS.md` — prompts para trabajar cada fase con Claude Code.

No incluye equipo, plazos ni estimaciones de tiempo: la planificación la definen la empresa y el proyectista.
