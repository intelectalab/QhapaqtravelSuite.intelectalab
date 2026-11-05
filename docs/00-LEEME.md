# Documentación para desarrollo — Qhapaq Travel Suite

Orden de lectura recomendado:

1. `01-RESUMEN-Y-CAMBIOS.md` — qué se entrega, mapa de módulos y todos los cambios respecto a la documentación inicial.
2. `02-ARQUITECTURA.md` — stack Laravel 12 / PHP 8.4, PostgreSQL 17, Redis 8, Next.js, React Native; estructura y despliegue.
3. `CONVENCIONES.md` — reglas comunes de tablas, API, colas, archivos, frontend y pruebas.
4. `03-PLAN-DE-IMPLEMENTACION.md` — fases y dependencias.
5. `04-HALLAZGOS-Y-DECISIONES.md` — lo que no se debe copiar del prototipo y lo que negocio debe decidir.
6. `especificaciones/` — una especificación por módulo (00 a 18), todas con la misma estructura de 12 secciones.
7. `CHANGELOG.md` — historial de versiones.
8. `05-AUDITORIA-UX-RESPONSIVE.md` — auditoría de experiencia móvil por rol y reglas responsive que se deben replicar en Next.js y la app.
9. `kit/00-LEEME-KIT.md` — kit de desarrollo con IA (Claude Code): base de datos validada, contrato OpenAPI, backlog de historias, pruebas, datos semilla, diseño, infraestructura y prompts por fase. Se entrega en el paquete del kit.

El prototipo (`../index.html`) es la referencia visual y de comportamiento; las especificaciones son la referencia técnica. Si difieren, prevalece la especificación y se registra la diferencia.
