# Diccionario de datos · Contenidos (cms_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Contenidos del CMS y su historial.

10 tablas · 169 columnas · 26 claves foráneas. Diagrama ER: [`../er/cms.svg`](../er/cms.svg) (fuente [`../er/cms.mmd`](../er/cms.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`cms_content_events`](#cms_content_events) | Fase 2 · Canales y campo | tenant | 11 | 3 | [Spec 08 §3.11] [Fase 2] Bitácora editorial del contenido. |
| [`cms_contents`](#cms_contents) | Fase 2 · Canales y campo | tenant | 23 | 2 | [Spec 08 §3.10] [Fase 2] Contenidos CMS (páginas, artículos, banners, legales). |
| [`cms_ai_content_jobs`](#cms_ai_content_jobs) | Fase 3 · SaaS y crecimiento | tenant | 18 | 3 | [Spec 23 §3.6] [Fase 3] Pedidos de contenido con IA (mejorar texto, SEO, traducir, relato, artículo, imagen) con resultado revisable y créditos usados. |
| [`cms_ai_images`](#cms_ai_images) | Fase 3 · SaaS y crecimiento | tenant | 16 | 3 | [Spec 23 §3.7] [Fase 3] Imágenes generadas con IA, con texto alternativo obligatorio, etiqueta IA y créditos cobrados. |
| [`cms_redirects`](#cms_redirects) | Fase 3 · SaaS y crecimiento | tenant | 10 | 2 | [Spec 22 §3.5] [Fase 3] Redirecciones 301/302 del sitio del tenant, sin cadenas. |
| [`cms_seo_pages`](#cms_seo_pages) | Fase 3 · SaaS y crecimiento | tenant | 21 | 1 | [Spec 22 §3.4] [Fase 3] Auditoría SEO por página publicada: metadatos, contenido, velocidad, puntaje y métricas de búsqueda. |
| [`cms_site_domains`](#cms_site_domains) | Fase 3 · SaaS y crecimiento | tenant | 14 | 2 | [Spec 22 §3.3] [Fase 3] Dominios propios del sitio y portales, con verificación DNS y certificado SSL. |
| [`cms_site_themes`](#cms_site_themes) | Fase 3 · SaaS y crecimiento | tenant | 15 | 4 | [Spec 23 §3.5] [Fase 3] Tema del sitio del tenant: plantilla y versión elegidas, tokens y secciones personalizados; uno activo por tenant. |
| [`cms_travel_stories`](#cms_travel_stories) | Fase 3 · SaaS y crecimiento | tenant | 24 | 5 | [Spec 22 §3.6] [Fase 3] Blog de aventuras con clientes: solo se publica con consentimiento vigente (Ley 29733). |
| [`cms_web_analytics_daily`](#cms_web_analytics_daily) | Fase 3 · SaaS y crecimiento | tenant | 17 | 1 | [Spec 24 §3.8] [Fase 3] Visitas agregadas por día del sitio de la agencia, calculadas desde channel_web_events y conteo sin cookies. |

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
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → cms_contents.tenant_id, tenants.id, iam_users.tenant_id. |
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
| `tenant_id, content_id` | `cms_contents.tenant_id, id` | NO ACTION | `fk_cms_content_events_content_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_content_events_tenant_id` |
| `tenant_id, user_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_content_events_user_id` |

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
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, tenants.id. |
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
| `tenant_id, author_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_contents_author_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_contents_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_cms_contents_id` | `tenant_id, id` |  | restricción |
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

### `cms_ai_content_jobs`

[Spec 23 §3.6] [Fase 3] Pedidos de contenido con IA (mejorar texto, SEO, traducir, relato, artículo, imagen) con resultado revisable y créditos usados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → sys_ai_requests.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `kind` | `character varying(16)` | no |  | Valores: `mejorar_texto`, `meta_seo`, `traducir`, `relato_aventura`, `articulo`, `imagen`. |
| 5 | `target_type` | `character varying(12)` | no |  | Valores: `producto`, `pagina`, `articulo`, `historia`, `libre`. |
| 6 | `target_id` | `uuid` | sí |  |  |
| 7 | `locale` | `character varying(5)` | no | `'es'::character varying` |  |
| 8 | `tone` | `character varying(16)` | sí |  | Valores: `cercano`, `profesional`, `aventurero`, `lujo`, `familiar`. |
| 9 | `input` | `jsonb` | no |  |  |
| 10 | `output` | `jsonb` | sí |  |  |
| 11 | `status` | `character varying(12)` | no | `'en_cola'::character varying` | Valores: `en_cola`, `procesando`, `listo`, `aplicado`, `descartado`, `fallido`. |
| 12 | `credits_used` | `integer` | no | `0` |  |
| 13 | `ai_request_id` | `uuid` | sí |  | FK → sys_ai_requests.id. |
| 14 | `error` | `text` | sí |  |  |
| 15 | `applied_at` | `timestamp with time zone` | sí |  |  |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, ai_request_id` | `sys_ai_requests.tenant_id, id` | NO ACTION | `fk_cms_ai_content_jobs_ai_request_id` |
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_ai_content_jobs_created_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_ai_content_jobs_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_cms_ai_content_jobs_id` | `tenant_id, id` |  | restricción |
| `uq_cms_ai_content_jobs_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_ai_content_jobs_1` | `CHECK ((((status)::text <> ALL ((ARRAY['listo'::character varying, 'aplicado'::character varying])::text[])) OR (output IS NOT NULL)))` |  |
| `ck_cms_ai_content_jobs_2` | `CHECK ((((status)::text <> 'aplicado'::text) OR (applied_at IS NOT NULL)))` |  |
| `ck_cms_ai_content_jobs_3` | `CHECK ((((status)::text <> 'fallido'::text) OR ((error IS NOT NULL) AND (credits_used = 0))))` |  |
| `ck_cms_ai_content_jobs_4` | `CHECK ((((target_type)::text = 'libre'::text) OR (target_id IS NOT NULL)))` |  |
| `cms_ai_content_jobs_credits_used_check` | `CHECK ((credits_used >= 0))` |  |
| `cms_ai_content_jobs_input_check` | `CHECK ((jsonb_typeof(input) = 'object'::text))` |  |
| `cms_ai_content_jobs_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['mejorar_texto'::character varying, 'meta_seo'::character varying, 'traducir'::character varying, 'relato_aventura'::character varying, 'articulo'::character varying, 'imagen'::character varying])::text[])))` | `kind`: `mejorar_texto`, `meta_seo`, `traducir`, `relato_aventura`, `articulo`, `imagen` |
| `cms_ai_content_jobs_locale_check` | `CHECK (((locale)::text ~ '^[a-z]{2}(-[A-Z]{2})?$'::text))` |  |
| `cms_ai_content_jobs_status_check` | `CHECK (((status)::text = ANY ((ARRAY['en_cola'::character varying, 'procesando'::character varying, 'listo'::character varying, 'aplicado'::character varying, 'descartado'::character varying, 'fallido'::character varying])::text[])))` | `status`: `en_cola`, `procesando`, `listo`, `aplicado`, `descartado`, `fallido` |
| `cms_ai_content_jobs_target_type_check` | `CHECK (((target_type)::text = ANY ((ARRAY['producto'::character varying, 'pagina'::character varying, 'articulo'::character varying, 'historia'::character varying, 'libre'::character varying])::text[])))` | `target_type`: `producto`, `pagina`, `articulo`, `historia`, `libre` |
| `cms_ai_content_jobs_tone_check` | `CHECK (((tone)::text = ANY ((ARRAY['cercano'::character varying, 'profesional'::character varying, 'aventurero'::character varying, 'lujo'::character varying, 'familiar'::character varying])::text[])))` | `tone`: `cercano`, `profesional`, `aventurero`, `lujo`, `familiar` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_ai_content_jobs_ai_request_id` | `USING btree (ai_request_id)` |
| `ix_cms_ai_content_jobs_created_by` | `USING btree (created_by)` |
| `ix_cms_ai_content_jobs_status` | `USING btree (tenant_id, status, created_at DESC)` |
| `ix_cms_ai_content_jobs_target` | `USING btree (tenant_id, target_type, target_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_ai_content_jobs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_ai_images`

[Spec 23 §3.7] [Fase 3] Imágenes generadas con IA, con texto alternativo obligatorio, etiqueta IA y créditos cobrados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, cms_ai_content_jobs.tenant_id, tenants.id. |
| 3 | `job_id` | `uuid` | no |  | FK → cms_ai_content_jobs.id. |
| 4 | `prompt` | `text` | no |  |  |
| 5 | `style` | `character varying(16)` | no |  | Valores: `fotografico`, `ilustracion`, `acuarela`, `mapa`, `textil`. |
| 6 | `width` | `smallint` | no |  |  |
| 7 | `height` | `smallint` | no |  |  |
| 8 | `file_path` | `character varying(300)` | no |  |  |
| 9 | `alt_text` | `character varying(200)` | no |  |  |
| 10 | `ai_label` | `boolean` | no | `true` |  |
| 11 | `credits_used` | `integer` | no |  |  |
| 12 | `status` | `character varying(12)` | no | `'generada'::character varying` | Valores: `generada`, `en_uso`, `descartada`. |
| 13 | `used_in` | `jsonb` | no | `'[]'::jsonb` |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_ai_images_created_by` |
| `tenant_id, job_id` | `cms_ai_content_jobs.tenant_id, id` | NO ACTION | `fk_cms_ai_images_job_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_ai_images_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `cms_ai_images_alt_text_check` | `CHECK ((length((alt_text)::text) >= 5))` |  |
| `cms_ai_images_credits_used_check` | `CHECK ((credits_used > 0))` |  |
| `cms_ai_images_height_check` | `CHECK (((height >= 256) AND (height <= 4096)))` |  |
| `cms_ai_images_prompt_check` | `CHECK (((length(prompt) >= 10) AND (length(prompt) <= 2000)))` |  |
| `cms_ai_images_status_check` | `CHECK (((status)::text = ANY ((ARRAY['generada'::character varying, 'en_uso'::character varying, 'descartada'::character varying])::text[])))` | `status`: `generada`, `en_uso`, `descartada` |
| `cms_ai_images_style_check` | `CHECK (((style)::text = ANY ((ARRAY['fotografico'::character varying, 'ilustracion'::character varying, 'acuarela'::character varying, 'mapa'::character varying, 'textil'::character varying])::text[])))` | `style`: `fotografico`, `ilustracion`, `acuarela`, `mapa`, `textil` |
| `cms_ai_images_used_in_check` | `CHECK ((jsonb_typeof(used_in) = 'array'::text))` |  |
| `cms_ai_images_width_check` | `CHECK (((width >= 256) AND (width <= 4096)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_ai_images_created_by` | `USING btree (created_by)` |
| `ix_cms_ai_images_job_id` | `USING btree (job_id)` |
| `ix_cms_ai_images_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_ai_images_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_redirects`

[Spec 22 §3.5] [Fase 3] Redirecciones 301/302 del sitio del tenant, sin cadenas.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, tenants.id. |
| 3 | `from_path` | `character varying(300)` | no |  |  |
| 4 | `to_path` | `character varying(400)` | no |  |  |
| 5 | `code` | `smallint` | no | `301` | Valores: `301`, `302`. |
| 6 | `hits` | `bigint` | no | `0` |  |
| 7 | `active` | `boolean` | no | `true` |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_redirects_created_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_redirects_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_redirects_tenant_id_from_path` | `tenant_id, from_path` | `active` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_redirects_1` | `CHECK (((from_path)::text <> (to_path)::text))` |  |
| `cms_redirects_code_check` | `CHECK ((code = ANY (ARRAY[301, 302])))` | `code`: `301`, `302` |
| `cms_redirects_from_path_check` | `CHECK (((from_path)::text ~ '^/'::text))` |  |
| `cms_redirects_hits_check` | `CHECK ((hits >= 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_redirects_created_by` | `USING btree (created_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_redirects_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_seo_pages`

[Spec 22 §3.4] [Fase 3] Auditoría SEO por página publicada: metadatos, contenido, velocidad, puntaje y métricas de búsqueda.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `path` | `character varying(300)` | no |  |  |
| 4 | `title` | `character varying(120)` | no |  |  |
| 5 | `meta_description` | `character varying(320)` | sí |  |  |
| 6 | `focus_keyword` | `character varying(120)` | sí |  |  |
| 7 | `schema_types` | `text[]` | no | `'{}'::text[]` |  |
| 8 | `canonical_url` | `character varying(400)` | sí |  |  |
| 9 | `indexable` | `boolean` | no | `true` |  |
| 10 | `h1_count` | `smallint` | no | `0` |  |
| 11 | `word_count` | `integer` | no | `0` |  |
| 12 | `images` | `smallint` | no | `0` |  |
| 13 | `images_with_alt` | `smallint` | no | `0` |  |
| 14 | `speed_mobile` | `smallint` | sí |  |  |
| 15 | `score` | `smallint` | sí |  |  |
| 16 | `issues` | `jsonb` | no | `'[]'::jsonb` |  |
| 17 | `clicks_28d` | `integer` | no | `0` |  |
| 18 | `avg_position` | `numeric(5,1)` | sí |  |  |
| 19 | `audited_at` | `timestamp with time zone` | sí |  |  |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_seo_pages_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_seo_pages_tenant_id_path` | `tenant_id, path` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_seo_pages_1` | `CHECK ((images_with_alt <= images))` |  |
| `cms_seo_pages_clicks_28d_check` | `CHECK ((clicks_28d >= 0))` |  |
| `cms_seo_pages_h1_count_check` | `CHECK ((h1_count >= 0))` |  |
| `cms_seo_pages_images_check` | `CHECK ((images >= 0))` |  |
| `cms_seo_pages_images_with_alt_check` | `CHECK ((images_with_alt >= 0))` |  |
| `cms_seo_pages_path_check` | `CHECK (((path)::text ~ '^/'::text))` |  |
| `cms_seo_pages_score_check` | `CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100))))` |  |
| `cms_seo_pages_speed_mobile_check` | `CHECK (((speed_mobile IS NULL) OR ((speed_mobile >= 0) AND (speed_mobile <= 100))))` |  |
| `cms_seo_pages_word_count_check` | `CHECK ((word_count >= 0))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_seo_pages_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_site_domains`

[Spec 22 §3.3] [Fase 3] Dominios propios del sitio y portales, con verificación DNS y certificado SSL.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, tenants.id. |
| 3 | `host` | `character varying(253)` | no |  |  |
| 4 | `purpose` | `character varying(12)` | no | `'principal'::character varying` | Valores: `principal`, `reservas`, `blog`, `aventuras`, `portal`. |
| 5 | `status` | `character varying(14)` | no | `'pendiente_dns'::character varying` | Valores: `pendiente_dns`, `verificado`, `error`, `retirado`. |
| 6 | `verify_token` | `character varying(40)` | no |  |  |
| 7 | `ssl_status` | `character varying(10)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `emitido`, `renovando`, `error`. |
| 8 | `ssl_expires_at` | `timestamp with time zone` | sí |  |  |
| 9 | `verified_at` | `timestamp with time zone` | sí |  |  |
| 10 | `last_check_at` | `timestamp with time zone` | sí |  |  |
| 11 | `last_error` | `text` | sí |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_site_domains_created_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_site_domains_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_site_domains_host` | `host` | `((status)::text <> 'retirado'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_site_domains_1` | `CHECK ((((status)::text <> 'verificado'::text) OR (verified_at IS NOT NULL)))` |  |
| `ck_cms_site_domains_2` | `CHECK ((((ssl_status)::text <> 'emitido'::text) OR (ssl_expires_at IS NOT NULL)))` |  |
| `cms_site_domains_host_check` | `CHECK (((host)::text ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'::text))` |  |
| `cms_site_domains_purpose_check` | `CHECK (((purpose)::text = ANY ((ARRAY['principal'::character varying, 'reservas'::character varying, 'blog'::character varying, 'aventuras'::character varying, 'portal'::character varying])::text[])))` | `purpose`: `principal`, `reservas`, `blog`, `aventuras`, `portal` |
| `cms_site_domains_ssl_status_check` | `CHECK (((ssl_status)::text = ANY ((ARRAY['pendiente'::character varying, 'emitido'::character varying, 'renovando'::character varying, 'error'::character varying])::text[])))` | `ssl_status`: `pendiente`, `emitido`, `renovando`, `error` |
| `cms_site_domains_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente_dns'::character varying, 'verificado'::character varying, 'error'::character varying, 'retirado'::character varying])::text[])))` | `status`: `pendiente_dns`, `verificado`, `error`, `retirado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_site_domains_created_by` | `USING btree (created_by)` |
| `ix_cms_site_domains_ssl` | `USING btree (ssl_expires_at) WHERE ((ssl_status)::text = 'emitido'::text)` |
| `ix_cms_site_domains_tenant_id` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_site_domains_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_site_themes`

[Spec 23 §3.5] [Fase 3] Tema del sitio del tenant: plantilla y versión elegidas, tokens y secciones personalizados; uno activo por tenant.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, tenants.id. |
| 3 | `template_id` | `uuid` | no |  | FK → platform_site_templates.id. |
| 4 | `template_version_id` | `uuid` | no |  | FK → platform_site_template_versions.id. |
| 5 | `status` | `character varying(12)` | no | `'vista_previa'::character varying` | Valores: `vista_previa`, `activo`, `anterior`. |
| 6 | `tokens` | `jsonb` | no | `'{}'::jsonb` |  |
| 7 | `sections` | `jsonb` | no | `'[]'::jsonb` |  |
| 8 | `logo_path` | `character varying(300)` | sí |  |  |
| 9 | `chosen_by` | `character varying(16)` | no |  | Valores: `alta`, `agencia`, `admin_plataforma`. |
| 10 | `applied_by` | `uuid` | sí |  | FK → iam_users.id. |
| 11 | `applied_at` | `timestamp with time zone` | sí |  |  |
| 12 | `preview_token` | `character varying(64)` | sí |  |  |
| 13 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, applied_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_site_themes_applied_by` |
| `template_id` | `platform_site_templates.id` | NO ACTION | `fk_cms_site_themes_template_id` |
| `template_version_id` | `platform_site_template_versions.id` | NO ACTION | `fk_cms_site_themes_template_version_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_site_themes_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_site_themes_one_active` | `tenant_id` | `((status)::text = 'activo'::text)` | índice único |
| `uq_cms_site_themes_preview_token` | `preview_token` | `(preview_token IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_site_themes_1` | `CHECK ((((status)::text = 'vista_previa'::text) OR (applied_at IS NOT NULL)))` |  |
| `ck_cms_site_themes_2` | `CHECK ((((status)::text <> 'vista_previa'::text) OR (preview_token IS NOT NULL)))` |  |
| `cms_site_themes_chosen_by_check` | `CHECK (((chosen_by)::text = ANY ((ARRAY['alta'::character varying, 'agencia'::character varying, 'admin_plataforma'::character varying])::text[])))` | `chosen_by`: `alta`, `agencia`, `admin_plataforma` |
| `cms_site_themes_sections_check` | `CHECK ((jsonb_typeof(sections) = 'array'::text))` |  |
| `cms_site_themes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['vista_previa'::character varying, 'activo'::character varying, 'anterior'::character varying])::text[])))` | `status`: `vista_previa`, `activo`, `anterior` |
| `cms_site_themes_tokens_check` | `CHECK ((jsonb_typeof(tokens) = 'object'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_site_themes_applied_by` | `USING btree (applied_by)` |
| `ix_cms_site_themes_template_id` | `USING btree (template_id)` |
| `ix_cms_site_themes_template_version_id` | `USING btree (template_version_id)` |
| `ix_cms_site_themes_tenant_status` | `USING btree (tenant_id, status, applied_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_site_themes_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_travel_stories`

[Spec 22 §3.6] [Fase 3] Blog de aventuras con clientes: solo se publica con consentimiento vigente (Ley 29733).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → crm_clients.tenant_id, iam_users.tenant_id, catalog_products.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `slug` | `character varying(160)` | no |  |  |
| 4 | `title` | `character varying(200)` | no |  |  |
| 5 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 6 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 7 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 8 | `city` | `character varying(80)` | sí |  |  |
| 9 | `quote` | `text` | sí |  |  |
| 10 | `body` | `text` | sí |  |  |
| 11 | `photo_count` | `smallint` | no | `0` |  |
| 12 | `status` | `character varying(24)` | no | `'borrador'::character varying` | Valores: `borrador`, `pendiente_consentimiento`, `publicado`, `despublicado`. |
| 13 | `consent_at` | `timestamp with time zone` | sí |  |  |
| 14 | `consent_by_name` | `character varying(160)` | sí |  |  |
| 15 | `consent_channel` | `character varying(20)` | sí |  | Valores: `portal`, `correo_firmado`, `whatsapp`, `presencial`. |
| 16 | `consent_photos` | `boolean` | sí |  |  |
| 17 | `consent_name_mode` | `character varying(16)` | sí |  | Valores: `nombre_completo`, `solo_nombre`, `anonimo`. |
| 18 | `consent_revoked_at` | `timestamp with time zone` | sí |  |  |
| 19 | `published_at` | `timestamp with time zone` | sí |  |  |
| 20 | `seo_score` | `smallint` | sí |  |  |
| 21 | `views` | `integer` | no | `0` |  |
| 22 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 23 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 24 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, client_id` | `crm_clients.tenant_id, id` | NO ACTION | `fk_cms_travel_stories_client_id` |
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_cms_travel_stories_created_by` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_cms_travel_stories_product_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_cms_travel_stories_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_travel_stories_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_travel_stories_tenant_id_slug` | `tenant_id, slug` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_travel_stories_1` | `CHECK ((((consent_at IS NULL) = (consent_by_name IS NULL)) AND ((consent_at IS NULL) = (consent_channel IS NULL)) AND ((consent_at IS NULL) = (consent_name_mode IS NULL))))` |  |
| `ck_cms_travel_stories_2` | `CHECK ((((status)::text <> 'publicado'::text) OR ((consent_at IS NOT NULL) AND (consent_revoked_at IS NULL) AND (published_at IS NOT NULL))))` |  |
| `ck_cms_travel_stories_3` | `CHECK (((photo_count = 0) OR ((status)::text <> 'publicado'::text) OR consent_photos))` |  |
| `cms_travel_stories_consent_channel_check` | `CHECK (((consent_channel IS NULL) OR ((consent_channel)::text = ANY ((ARRAY['portal'::character varying, 'correo_firmado'::character varying, 'whatsapp'::character varying, 'presencial'::character varying])::text[]))))` | `consent_channel`: `portal`, `correo_firmado`, `whatsapp`, `presencial` |
| `cms_travel_stories_consent_name_mode_check` | `CHECK (((consent_name_mode IS NULL) OR ((consent_name_mode)::text = ANY ((ARRAY['nombre_completo'::character varying, 'solo_nombre'::character varying, 'anonimo'::character varying])::text[]))))` | `consent_name_mode`: `nombre_completo`, `solo_nombre`, `anonimo` |
| `cms_travel_stories_photo_count_check` | `CHECK ((photo_count >= 0))` |  |
| `cms_travel_stories_seo_score_check` | `CHECK (((seo_score IS NULL) OR ((seo_score >= 0) AND (seo_score <= 100))))` |  |
| `cms_travel_stories_slug_check` | `CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))` |  |
| `cms_travel_stories_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'pendiente_consentimiento'::character varying, 'publicado'::character varying, 'despublicado'::character varying])::text[])))` | `status`: `borrador`, `pendiente_consentimiento`, `publicado`, `despublicado` |
| `cms_travel_stories_views_check` | `CHECK ((views >= 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_travel_stories_client_id` | `USING btree (client_id)` |
| `ix_cms_travel_stories_created_by` | `USING btree (created_by)` |
| `ix_cms_travel_stories_product_id` | `USING btree (product_id)` |
| `ix_cms_travel_stories_reservation_id` | `USING btree (reservation_id)` |
| `ix_cms_travel_stories_status` | `USING btree (tenant_id, status, published_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_cms_travel_stories_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `cms_web_analytics_daily`

[Spec 24 §3.8] [Fase 3] Visitas agregadas por día del sitio de la agencia, calculadas desde channel_web_events y conteo sin cookies.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Contenidos (cms_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 2 | `id` | `bigint` | no | `identity (ALWAYS)` | PK. |
| 3 | `day` | `date` | no |  |  |
| 4 | `path` | `character varying(300)` | no |  |  |
| 5 | `source` | `character varying(80)` | no | `'(directo)'::character varying` |  |
| 6 | `medium` | `character varying(40)` | no | `'(ninguno)'::character varying` |  |
| 7 | `campaign` | `character varying(120)` | no | `''::character varying` |  |
| 8 | `device` | `character varying(8)` | no |  | Valores: `movil`, `tablet`, `escritorio`, `otro`. |
| 9 | `country` | `character(2)` | no | `'ZZ'::bpchar` |  |
| 10 | `visits` | `integer` | no | `0` |  |
| 11 | `visitors` | `integer` | no | `0` |  |
| 12 | `pageviews` | `integer` | no | `0` |  |
| 13 | `bounces` | `integer` | no | `0` |  |
| 14 | `engaged_seconds` | `bigint` | no | `0` |  |
| 15 | `conversions` | `integer` | no | `0` |  |
| 16 | `revenue` | `numeric(14,2)` | no | `0` |  |
| 17 | `computed_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_cms_web_analytics_daily_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_cms_web_analytics_daily_dims` | `tenant_id, day, path, source, medium, campaign, device, country` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_cms_web_analytics_daily_1` | `CHECK (((visitors <= visits) AND (bounces <= visits) AND (pageviews >= visits)))` |  |
| `cms_web_analytics_daily_bounces_check` | `CHECK ((bounces >= 0))` |  |
| `cms_web_analytics_daily_conversions_check` | `CHECK ((conversions >= 0))` |  |
| `cms_web_analytics_daily_country_check` | `CHECK ((country ~ '^[A-Z]{2}$'::text))` |  |
| `cms_web_analytics_daily_device_check` | `CHECK (((device)::text = ANY ((ARRAY['movil'::character varying, 'tablet'::character varying, 'escritorio'::character varying, 'otro'::character varying])::text[])))` | `device`: `movil`, `tablet`, `escritorio`, `otro` |
| `cms_web_analytics_daily_engaged_seconds_check` | `CHECK ((engaged_seconds >= 0))` |  |
| `cms_web_analytics_daily_pageviews_check` | `CHECK ((pageviews >= 0))` |  |
| `cms_web_analytics_daily_revenue_check` | `CHECK ((revenue >= (0)::numeric))` |  |
| `cms_web_analytics_daily_visitors_check` | `CHECK ((visitors >= 0))` |  |
| `cms_web_analytics_daily_visits_check` | `CHECK ((visits >= 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_cms_web_analytics_daily_day` | `USING btree (tenant_id, day)` |

[↑ Índice del dominio](#tablas)
