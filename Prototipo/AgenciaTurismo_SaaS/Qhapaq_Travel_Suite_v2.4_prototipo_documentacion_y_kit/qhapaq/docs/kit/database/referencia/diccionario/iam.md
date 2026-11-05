# Diccionario de datos · Identidad y acceso (iam_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Sedes, usuarios, MFA, tokens, roles y permisos (Spatie).

11 tablas · 122 columnas · 27 claves foráneas. Diagrama ER: [`../er/iam.svg`](../er/iam.svg) (fuente [`../er/iam.mmd`](../er/iam.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`permissions`](#permissions) | Plataforma | plataforma | 5 | 0 | [Spec 00 §3.5] [Plataforma] Catálogo global de permisos (spatie). Sin tenant; sembrado por seeder. |
| [`iam_access_requests`](#iam_access_requests) | Fase 0 · Fundaciones | tenant | 10 | 3 | [Spec 00 §3.10] [Fase 0] Solicitudes de acceso desde la pantalla 403. |
| [`iam_mfa_factors`](#iam_mfa_factors) | Fase 0 · Fundaciones | tenant | 9 | 2 | [Spec 00 §3.3] [Fase 0] Factor TOTP por usuario (secreto cifrado). |
| [`iam_sedes`](#iam_sedes) | Fase 0 · Fundaciones | tenant | 15 | 2 | [Spec 09 §3.6] [Fase 0] Sedes (sucursales) del tenant. |
| [`iam_user_invitations`](#iam_user_invitations) | Fase 0 · Fundaciones | tenant | 11 | 3 | [Spec 09 §3.7] [Fase 0] Invitaciones de usuario (token de un solo uso, 72 h). |
| [`iam_users`](#iam_users) | Fase 0 · Fundaciones | tenant | 34 | 9 | [Spec 00 §3.2] [Fase 0] Usuarios del tenant (internos y externos: cliente, pasajero, B2B, proveedor, guía, conductor). |
| [`model_has_permissions`](#model_has_permissions) | Fase 0 · Fundaciones | tenant | 4 | 2 | [Spec 00 §3.5] [Fase 0] Tabla del paquete spatie. NO se usa: prohibidos permisos directos a usuario (se crea por compatibilidad con la migración del paquete). |
| [`model_has_roles`](#model_has_roles) | Fase 0 · Fundaciones | tenant | 4 | 2 | [Spec 00 §3.5] [Fase 0] Asignación de rol a usuario (un rol por usuario). |
| [`personal_access_tokens`](#personal_access_tokens) | Fase 0 · Fundaciones | sin RLS | 15 | 1 | [Spec 00 §3.4] [Fase 0] Tokens Sanctum extendidos. Sin RLS: se consultan antes de conocer el tenant (son la fuente del tenant). |
| [`role_has_permissions`](#role_has_permissions) | Fase 0 · Fundaciones | sin RLS | 2 | 2 | [Spec 00 §3.5] [Fase 0] Pivote rol-permiso (spatie). Sin tenant_id propio: se filtra vía `roles`. |
| [`roles`](#roles) | Fase 0 · Fundaciones | shared | 13 | 1 | [Spec 00 §3.5] [Fase 0] Roles spatie con teams (tenant_id NULL = plantilla de sistema). |

## Detalle por tabla

### `permissions`

[Spec 00 §3.5] [Plataforma] Catálogo global de permisos (spatie). Sin tenant; sembrado por seeder.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `name` | `character varying(125)` | no |  |  |
| 3 | `guard_name` | `character varying(125)` | no | `'api'::character varying` |  |
| 4 | `module` | `character varying(40)` | no |  |  |
| 5 | `description` | `character varying(200)` | sí |  |  |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_permissions_name_guard_name` | `name, guard_name` |  | índice único |

[↑ Índice del dominio](#tablas)

### `iam_access_requests`

[Spec 00 §3.10] [Fase 0] Solicitudes de acceso desde la pantalla 403.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 4 | `path` | `character varying(250)` | no |  |  |
| 5 | `required_permissions` | `text[]` | no | `'{}'::text[]` |  |
| 6 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `atendida`, `rechazada`. |
| 7 | `resolved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `resolved_at` | `timestamp with time zone` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `resolved_by` | `iam_users.id` | NO ACTION | `fk_iam_access_requests_resolved_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_iam_access_requests_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_iam_access_requests_user_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `iam_access_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'atendida'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `pendiente`, `atendida`, `rechazada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_iam_access_requests_resolved_by` | `USING btree (resolved_by)` |
| `ix_iam_access_requests_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_iam_access_requests_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `iam_mfa_factors`

[Spec 00 §3.3] [Fase 0] Factor TOTP por usuario (secreto cifrado).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 4 | `type` | `character varying(10)` | no | `'totp'::character varying` |  |
| 5 | `secret` | `text` | no |  |  |
| 6 | `confirmed_at` | `timestamp with time zone` | sí |  |  |
| 7 | `recovery_codes` | `jsonb` | no | `'[]'::jsonb` |  |
| 8 | `last_used_step` | `bigint` | sí |  |  |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_iam_mfa_factors_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_iam_mfa_factors_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_iam_mfa_factors_user_id` | `user_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `iam_mfa_factors_type_check` | `CHECK (((type)::text = 'totp'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_iam_mfa_factors_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `iam_sedes`

[Spec 09 §3.6] [Fase 0] Sedes (sucursales) del tenant.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `city` | `character varying(80)` | sí |  |  |
| 6 | `address` | `character varying(250)` | no |  |  |
| 7 | `phone` | `character varying(30)` | sí |  |  |
| 8 | `manager_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 9 | `status` | `character varying(20)` | no | `'activa'::character varying` | Valores: `activa`, `inactiva`. |
| 10 | `is_main` | `boolean` | no | `false` |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 15 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `manager_user_id` | `iam_users.id` | NO ACTION | `fk_iam_sedes_manager_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_iam_sedes_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_iam_sedes_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_iam_sedes_tenant_id_lower_name` | `tenant_id, lower((name)::text)` |  | índice único |
| `uq_iam_sedes_tenant_id_p` | `tenant_id` | `is_main` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `iam_sedes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `activa`, `inactiva` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_iam_sedes_manager_user_id` | `USING btree (manager_user_id)` |
| `ix_iam_sedes_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_iam_sedes_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_iam_sedes_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `iam_user_invitations`

[Spec 09 §3.7] [Fase 0] Invitaciones de usuario (token de un solo uso, 72 h).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 4 | `token_hash` | `character(64)` | no |  |  |
| 5 | `expires_at` | `timestamp with time zone` | no |  |  |
| 6 | `accepted_at` | `timestamp with time zone` | sí |  |  |
| 7 | `require_mfa` | `boolean` | no | `true` |  |
| 8 | `invited_by` | `uuid` | no |  | FK → iam_users.id. |
| 9 | `resent_count` | `smallint` | no | `0` |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `invited_by` | `iam_users.id` | NO ACTION | `fk_iam_user_invitations_invited_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_iam_user_invitations_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_iam_user_invitations_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_iam_user_invitations_token_hash` | `token_hash` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_iam_user_invitations_invited_by` | `USING btree (invited_by)` |
| `ix_iam_user_invitations_tenant_id` | `USING btree (tenant_id)` |
| `ix_iam_user_invitations_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `iam_users`

[Spec 00 §3.2] [Fase 0] Usuarios del tenant (internos y externos: cliente, pasajero, B2B, proveedor, guía, conductor).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | sí |  |  |
| 4 | `name` | `character varying(150)` | no |  |  |
| 5 | `email` | `character varying(190)` | no |  |  |
| 6 | `password` | `character varying(255)` | sí |  |  |
| 7 | `phone` | `character varying(30)` | sí |  |  |
| 8 | `sede_id` | `uuid` | no |  | FK → iam_sedes.id. |
| 9 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `activo`, `inactivo`. |
| 10 | `mfa_enabled` | `boolean` | no | `false` |  |
| 11 | `mfa_required` | `boolean` | no | `false` |  |
| 12 | `last_login_at` | `timestamp with time zone` | sí |  |  |
| 13 | `last_login_ip` | `inet` | sí |  |  |
| 14 | `avatar_color` | `character(7)` | sí |  |  |
| 15 | `client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 16 | `agency_id` | `uuid` | sí |  | FK → channel_b2b_agencies.id. |
| 17 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 18 | `guide_id` | `uuid` | sí |  | FK → ops_guides.id. |
| 19 | `driver_id` | `uuid` | sí |  | FK → ops_drivers.id. |
| 20 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 21 | `invited_at` | `timestamp with time zone` | sí |  |  |
| 22 | `invited_by` | `uuid` | sí |  | FK → iam_users.id. |
| 23 | `deactivated_at` | `timestamp with time zone` | sí |  |  |
| 24 | `deactivated_reason` | `text` | sí |  |  |
| 25 | `locale` | `character varying(10)` | sí |  |  |
| 26 | `remember_token` | `character varying(100)` | sí |  |  |
| 27 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 28 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 29 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 30 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 31 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 32 | `provider_role` | `character varying(20)` | sí |  | Columnas agregadas en Fase 2 por spec 06 §3.1 + 15 §3.10 Valores: `admin`, `reservas`, `recepcion`, `contabilidad`. [Agregada en `30_fase2.sql`] |
| 33 | `created_via` | `character varying(20)` | no | `'backoffice'::character varying` | Columnas agregadas en Fase 2 por spec 06 §3.1 + 15 §3.10 Valores: `backoffice`, `sitio_web`. [Agregada en `30_fase2.sql`] |
| 34 | `email_verified_at` | `timestamp with time zone` | sí |  | Columnas agregadas en Fase 2 por spec 06 §3.1 + 15 §3.10 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `channel_b2b_agencies.id` | NO ACTION | `fk_iam_users_agency_id` |
| `client_id` | `crm_clients.id` | NO ACTION | `fk_iam_users_client_id` |
| `driver_id` | `ops_drivers.id` | NO ACTION | `fk_iam_users_driver_id` |
| `guide_id` | `ops_guides.id` | NO ACTION | `fk_iam_users_guide_id` |
| `invited_by` | `iam_users.id` | NO ACTION | `fk_iam_users_invited_by` |
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_iam_users_provider_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_iam_users_reservation_id` |
| `sede_id` | `iam_sedes.id` | NO ACTION | `fk_iam_users_sede_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_iam_users_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_iam_users_tenant_id_code_p` | `tenant_id, code` | `(code IS NOT NULL)` | índice único |
| `uq_iam_users_tenant_id_lower_email` | `tenant_id, lower((email)::text)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `iam_users_created_via_check` | `CHECK (((created_via)::text = ANY ((ARRAY['backoffice'::character varying, 'sitio_web'::character varying])::text[])))` | `created_via`: `backoffice`, `sitio_web` |
| `iam_users_provider_role_check` | `CHECK (((provider_role IS NULL) OR ((provider_role)::text = ANY ((ARRAY['admin'::character varying, 'reservas'::character varying, 'recepcion'::character varying, 'contabilidad'::character varying])::text[]))))` | `provider_role`: `admin`, `reservas`, `recepcion`, `contabilidad` |
| `iam_users_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'activo'::character varying, 'inactivo'::character varying])::text[])))` | `status`: `pendiente`, `activo`, `inactivo` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_iam_users_agency_id` | `USING btree (agency_id)` |
| `ix_iam_users_client_id` | `USING btree (client_id)` |
| `ix_iam_users_driver_id` | `USING btree (driver_id)` |
| `ix_iam_users_guide_id` | `USING btree (guide_id)` |
| `ix_iam_users_invited_by` | `USING btree (invited_by)` |
| `ix_iam_users_provider_id` | `USING btree (provider_id)` |
| `ix_iam_users_reservation_id` | `USING btree (reservation_id)` |
| `ix_iam_users_sede_id` | `USING btree (sede_id)` |
| `ix_iam_users_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_iam_users_tenant_id_provider_id` | `USING btree (tenant_id, provider_id)` |
| `ix_iam_users_tenant_id_sede_id` | `USING btree (tenant_id, sede_id)` |
| `ix_iam_users_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_iam_users_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `model_has_permissions`

[Spec 00 §3.5] [Fase 0] Tabla del paquete spatie. NO se usa: prohibidos permisos directos a usuario (se crea por compatibilidad con la migración del paquete).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). PK. FK → tenants.id. |
| 2 | `permission_id` | `uuid` | no |  | PK. FK → permissions.id. |
| 3 | `model_type` | `character varying(255)` | no |  | PK. |
| 4 | `model_id` | `uuid` | no |  | PK. |

**PK:** `tenant_id, permission_id, model_id, model_type`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `permission_id` | `permissions.id` | CASCADE | `fk_model_has_permissions_permission_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_model_has_permissions_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_model_has_permissions_model_id_model_type` | `USING btree (model_id, model_type)` |
| `ix_model_has_permissions_permission_id` | `USING btree (permission_id)` |

[↑ Índice del dominio](#tablas)

### `model_has_roles`

[Spec 00 §3.5] [Fase 0] Asignación de rol a usuario (un rol por usuario).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). PK. FK → tenants.id. |
| 2 | `role_id` | `uuid` | no |  | PK. FK → roles.id. |
| 3 | `model_type` | `character varying(255)` | no |  | PK. |
| 4 | `model_id` | `uuid` | no |  | PK. |

**PK:** `tenant_id, role_id, model_id, model_type`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `role_id` | `roles.id` | CASCADE | `fk_model_has_roles_role_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_model_has_roles_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_model_has_roles_model_id_model_type` | `USING btree (model_id, model_type)` |
| `ix_model_has_roles_role_id` | `USING btree (role_id)` |

[↑ Índice del dominio](#tablas)

### `personal_access_tokens`

[Spec 00 §3.4] [Fase 0] Tokens Sanctum extendidos. Sin RLS: se consultan antes de conocer el tenant (son la fuente del tenant).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `tokenable_type` | `character varying(255)` | no |  |  |
| 4 | `tokenable_id` | `uuid` | no |  |  |
| 5 | `name` | `character varying(255)` | no |  |  |
| 6 | `token` | `character varying(64)` | no |  |  |
| 7 | `abilities` | `text` | sí |  |  |
| 8 | `last_used_at` | `timestamp with time zone` | sí |  |  |
| 9 | `expires_at` | `timestamp with time zone` | sí |  |  |
| 10 | `experience` | `character varying(20)` | no |  | Valores: `backoffice`, `portal`, `mobile`, `platform`. |
| 11 | `mfa_verified_at` | `timestamp with time zone` | sí |  |  |
| 12 | `device_name` | `character varying(120)` | sí |  |  |
| 13 | `ip` | `inet` | sí |  |  |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_personal_access_tokens_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_personal_access_tokens_token` | `token` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `personal_access_tokens_experience_check` | `CHECK (((experience)::text = ANY ((ARRAY['backoffice'::character varying, 'portal'::character varying, 'mobile'::character varying, 'platform'::character varying])::text[])))` | `experience`: `backoffice`, `portal`, `mobile`, `platform` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_personal_access_tokens_tenant_id` | `USING btree (tenant_id)` |
| `ix_personal_access_tokens_tokenable_type_tokenable_id` | `USING btree (tokenable_type, tokenable_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_personal_access_tokens_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `role_has_permissions`

[Spec 00 §3.5] [Fase 0] Pivote rol-permiso (spatie). Sin tenant_id propio: se filtra vía `roles`.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `permission_id` | `uuid` | no |  | PK. FK → permissions.id. |
| 2 | `role_id` | `uuid` | no |  | PK. FK → roles.id. |

**PK:** `permission_id, role_id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `permission_id` | `permissions.id` | CASCADE | `fk_role_has_permissions_permission_id` |
| `role_id` | `roles.id` | CASCADE | `fk_role_has_permissions_role_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_role_has_permissions_role_id` | `USING btree (role_id)` |

[↑ Índice del dominio](#tablas)

### `roles`

[Spec 00 §3.5] [Fase 0] Roles spatie con teams (tenant_id NULL = plantilla de sistema).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Identidad y acceso (iam_) | Fase 0 · Fundaciones (`10_fase0.sql`) | shared (tenant + filas globales de solo lectura) · FORCE | `platform_access`, `tenant_isolation`, `tenant_shared_read` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `name` | `character varying(125)` | no |  |  |
| 4 | `guard_name` | `character varying(125)` | no | `'api'::character varying` |  |
| 5 | `display_name` | `character varying(120)` | no |  |  |
| 6 | `description` | `character varying(250)` | sí |  |  |
| 7 | `scope` | `character varying(10)` | no |  | Valores: `tenant`, `mobile`, `canal`. |
| 8 | `is_custom` | `boolean` | no | `false` |  |
| 9 | `experience` | `character varying(20)` | no |  | Valores: `backoffice`, `portal`, `mobile`. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_roles_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_roles_tenant_id_name_guard_name_p` | `tenant_id, name, guard_name` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `roles_experience_check` | `CHECK (((experience)::text = ANY ((ARRAY['backoffice'::character varying, 'portal'::character varying, 'mobile'::character varying])::text[])))` | `experience`: `backoffice`, `portal`, `mobile` |
| `roles_scope_check` | `CHECK (((scope)::text = ANY ((ARRAY['tenant'::character varying, 'mobile'::character varying, 'canal'::character varying])::text[])))` | `scope`: `tenant`, `mobile`, `canal` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_roles_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
