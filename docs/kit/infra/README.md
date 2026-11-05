# Infraestructura local y CI

| Archivo | Destino en el espacio de trabajo |
|---|---|
| `docker-compose.yml` | `./docker-compose.yml` (raíz, junto a `backend/` y `web/`) |
| `docker/` (php, nginx, postgres/init) | `./docker/` |
| `Makefile` | `./Makefile` |
| `env/backend.env.example` | `backend/.env.example` (y copia local a `backend/.env`) |
| `env/web.env.example` | `web/.env.example` (y copia local a `web/.env.local`) |
| `env/mobile.env.example` | `mobile/.env.example` |
| `github/workflows/ci.yml` | `.github/workflows/ci.yml` |

## Arranque

```bash
cp docs/kit/infra/docker-compose.yml docs/kit/infra/Makefile . && cp -r docs/kit/infra/docker .
make setup      # .env, composer install, key, migraciones y datos demo
make up         # API http://localhost:8000 · web http://localhost:3000 · Mailpit http://localhost:8025 · MinIO http://localhost:9001
make help       # lista de comandos
```

Tenants por subdominio: `andes.localhost` (TNT-0001, datos demo) y `selva.localhost` (TNT-0002, prueba de aislamiento). Los navegadores resuelven `*.localhost` a 127.0.0.1 sin configurar nada.

## Servicios

| Servicio | Imagen | Puerto | Para qué |
|---|---|---|---|
| api | php 8.4-fpm (Dockerfile propio: pgsql, redis, intl, bcmath, gd, Chromium para PDF) | 9000 interno | Laravel |
| nginx | nginx 1.27 | 8000 | Entrada HTTP de la API; propaga `X-Request-Id` como correlation_id |
| queue | misma imagen | — | Horizon (colas `critical, default, notifications, documents, integrations, reports, low`) |
| scheduler | misma imagen | — | `schedule:work` (vencimiento de holds, recordatorios, tipo de cambio, sincronización de reseñas) |
| reverb | misma imagen | 8080 | WebSockets |
| web | node 22 | 3000 | Next.js en modo desarrollo |
| postgres | postgres:17 | 5432 | Base `qhapaq` y `qhapaq_test` |
| redis | redis:8 | 6379 | Caché, sesiones, colas, locks, idempotencia |
| minio (+ minio-init) | minio | 9000 / 9001 | S3 local; buckets `qhapaq-private` y `qhapaq-public` |
| mailpit | mailpit | 8025 / 1025 | Correo de prueba (enlaces mágicos, notificaciones) |

## Usuarios de base de datos (RLS)

| Usuario | Rol | Uso |
|---|---|---|
| `qhapaq_owner` | dueño del esquema | Solo migraciones (`--database=pgsql_owner`). Nunca en runtime. |
| `qhapaq_app` | `app_role` (sin BYPASSRLS) | API, colas, scheduler. Siempre con `SET LOCAL app.tenant_id`. |
| `qhapaq_platform` | `platform_role` | Módulo de plataforma (Super Admin, facturación SaaS, jobs multi-tenant). |

Las políticas están en `docs/kit/database/90_rls.sql`. En `backend/config/database.php` se definen tres conexiones que comparten host y base y cambian usuario:

```php
'pgsql'          => [... 'username' => env('DB_USERNAME'),          'password' => env('DB_PASSWORD')],
'pgsql_platform' => [... 'username' => env('DB_PLATFORM_USERNAME'), 'password' => env('DB_PLATFORM_PASSWORD')],
'pgsql_owner'    => [... 'username' => env('DB_OWNER_USERNAME'),    'password' => env('DB_OWNER_PASSWORD')],
```

## CI

`ci.yml` tiene cuatro trabajos: **backend** (Pint, Larastan, migraciones, Pest con PostgreSQL 17 y Redis 8 reales, comparación con el contrato hasta la fase de la variable de repositorio `QHAPAQ_PHASE`), **database-kit** (valida los `.sql` y que el contrato siga generándose igual desde las specs), **web** (cliente tipado al día, lint, Vitest, build) y **e2e** en pull requests (stack completo con Docker + Playwright).

Subir `QHAPAQ_PHASE` (0 → 1 → 2 → 3) al cerrar cada fase hace que el CI exija todos los endpoints del contrato de esa fase.

## Producción (lineamientos, no incluidos como archivos)

- Misma imagen PHP con `opcache.validate_timestamps=0`, sin Xdebug, `APP_DEBUG=false`.
- PostgreSQL gestionado con backups diarios y PITR; réplica de lectura para reportes.
- Redis con persistencia AOF; Horizon supervisado.
- Secretos en un gestor (no en `.env` versionado); rotación de `APP_KEY` planificada.
- S3 con cifrado en reposo y URLs firmadas de corta duración para documentos de pasajeros.
- Detalle en `docs/02-ARQUITECTURA.md` §8.
