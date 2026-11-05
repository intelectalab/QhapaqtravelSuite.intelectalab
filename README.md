# Qhapaq Travel Suite

SaaS multi-tenant de gestión integral para agencias de viajes y tour operadores (Perú).

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `backend/` | API en Laravel 12 · PHP 8.4 · PostgreSQL 17 · Redis 8 (colas con Horizon, tiempo real con Reverb) |
| `web/` | Next.js (App Router, TypeScript): back-office, portales, extranet, consola de plataforma y sitio público |
| `mobile/` | React Native (Expo): app del operador y app del pasajero |
| `docs/` | Documentación funcional y técnica, especificaciones, prototipo navegable y kit de desarrollo |
| `docker/`, `docker-compose.yml`, `Makefile` | Entorno local |
| `.github/workflows/` | Integración continua (CI) |

## Requisitos

- Windows con WSL 2 (Ubuntu 24.04) y Docker Desktop con la integración de WSL activada.
- Dentro de Ubuntu: `make`, `git`, `python3` y Node 22 (con nvm).
- El proyecto se trabaja dentro de Linux (`~/QhapaqTravelSuite`), no en `C:\`.

## Primeros pasos

```bash
make up       # levanta todo el entorno en Docker
make setup    # primera vez: dependencias, clave, base de datos y datos de ejemplo
make help     # lista todos los comandos
```

| Servicio | Dirección |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:8000 |
| Correos de prueba (Mailpit) | http://localhost:8025 |
| Archivos (consola de MinIO) | http://localhost:9001 |

## Documentación

1. `docs/index.html`: portal de la documentación con buscador.
2. `docs/kit/GUIA-TECNICA.md`: cómo encaja todo (arquitectura, tenancy, permisos, motor de reservas, frontend, móvil, seguridad).
3. `docs/CONVENCIONES.md`: reglas de tablas, API, colas y pruebas.
4. `docs/kit/backlog/`: historias por fase (0 → 1A → 1B → 2 → 3).
5. `docs/kit/database/` y `docs/kit/api/`: esquema de base de datos y contrato de la API (fuentes de verdad).
6. `docs/prototipo/index.html`: prototipo navegable (referencia visual y de flujo).

## Forma de trabajo

- Una rama por historia del backlog; los commits empiezan con el código de la historia: `F0-01: crear proyectos base`.
- Una historia está terminada cuando las pruebas pasan, el contrato de la API se respeta y la documentación queda al día.
- Nunca subir archivos `.env` con contraseñas reales.
