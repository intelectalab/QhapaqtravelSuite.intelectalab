# Diccionario de datos · Contenidos (cms_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Contenidos del CMS y su historial.

2 tablas · 34 columnas · 5 claves foráneas. Diagrama ER: [`../er/cms.svg`](../er/cms.svg) (fuente [`../er/cms.mmd`](../er/cms.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`cms_content_events`](#cms_content_events) | Fase 2 · Canales y campo | tenant | 11 | 3 | [Spec 08 §3.11] [Fase 2] Bitácora editorial del contenido. |
| [`cms_contents`](#cms_contents) | Fase 2 · Canales y campo | tenant | 23 | 2 | [Spec 08 §3.10] [Fase 2] Contenidos CMS (páginas, artículos, banners, legales). |

## Detalle por tabla

### `cms_content_events`

[Spec 08 §3.11] [Fase 2] Bitácora editorial del contenido.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `content_id` | `uuid` | no |  | FK → cms_contents.id. |
| 4 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 6 | `from_status` | `character varying(30)` | sí |  |  |
| 7 | `to_status` | `character varying(30)` | sí |  |  |
| 8 | `message` | `character varying(300)` | no |  |  |
| 9 | `reason` | `character varying(300)` | sí |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `content_id` | `cms_contents.id` | NO ACTION | `fk_cms_content_events_content_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_content_events_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_cms_content_events_user_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_content_events_content_id` | `USING btree (content_id)` |
| `ix_cms_content_events_tenant_id` | `USING btree (tenant_id)` |
| `ix_cms_content_events_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `cms_contents`

[Spec 08 §3.10] [Fase 2] Contenidos CMS (páginas, artículos, banners, legales).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `title` | `character varying(200)` | no |  |  |
| 5 | `type` | `character varying(30)` | no |  | Valores: `Página`, `Artículo`, `Banner`, `Página legal`, `Landing`. |
| 6 | `channel` | `character varying(40)` | no |  | Valores: `Web`, `Web / E-commerce`, `Web / Portal`, `Portal cliente`, `Portal pasajero`, `App pasajero`. |
| 7 | `slug` | `character varying(60)` | no |  |  |
| 8 | `body` | `text` | no |  |  |
| 9 | `seo_title` | `character varying(60)` | sí |  |  |
| 10 | `seo_description` | `character varying(160)` | sí |  |  |
| 11 | `status` | `character varying(30)` | no | `'borrador'::character varying` | Valores: `borrador`, `en_revision`, `aprobado`, `publicado`, `despublicado`. |
| 12 | `author_id` | `uuid` | no |  | FK → iam_users.id. |
| 13 | `published_at` | `timestamp with time zone` | sí |  |  |
| 14 | `unpublished_at` | `timestamp with time zone` | sí |  |  |
| 15 | `placement` | `character varying(40)` | sí |  |  |
| 16 | `valid_from` | `date` | sí |  |  |
| 17 | `valid_to` | `date` | sí |  |  |
| 18 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 23 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `author_id` | `iam_users.id` | NO ACTION | `fk_cms_contents_author_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_contents_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_contents_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_cms_contents_tenant_id_slug_p` | `tenant_id, slug` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_contents_1` | `CHECK ((((status)::text <> 'publicado'::text) OR (seo_title IS NOT NULL)))` |  |
| `cms_contents_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['Web'::character varying, 'Web / E-commerce'::character varying, 'Web / Portal'::character varying, 'Portal cliente'::character varying, 'Portal pasajero'::character varying, 'App pasajero'::character varying])::text[])))` | `channel`: `Web`, `Web / E-commerce`, `Web / Portal`, `Portal cliente`, `Portal pasajero`, `App pasajero` |
| `cms_contents_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'aprobado'::character varying, 'publicado'::character varying, 'despublicado'::character varying])::text[])))` | `status`: `borrador`, `en_revision`, `aprobado`, `publicado`, `despublicado` |
| `cms_contents_type_check` | `CHECK (((type)::text = ANY ((ARRAY['Página'::character varying, 'Artículo'::character varying, 'Banner'::character varying, 'Página legal'::character varying, 'Landing'::character varying])::text[])))` | `type`: `Página`, `Artículo`, `Banner`, `Página legal`, `Landing` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_contents_author_id` | `USING btree (author_id)` |
| `ix_cms_contents_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_cms_contents_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_cms_contents_tenant_id_type` | `USING btree (tenant_id, type)` |
| `ix_cms_contents_tenant_id_updated_at_desc` | `USING btree (tenant_id, updated_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_contents_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_cms_contents_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
