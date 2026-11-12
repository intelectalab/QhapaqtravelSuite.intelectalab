# Blog en Payload CMS, SEO, etiquetas de seguimiento y visitas (v2.10)

Este módulo es nuevo en la v2.10. Junta cuatro piezas para que la vitrina **Rutas Libres** y el sitio de cada agencia puedan medir, hacer publicidad y crecer en buscadores:

1. **Blog de Rutas Libres en Payload CMS.** Payload 3 se instala dentro de la misma app Next.js de la vitrina y se publica en `rutaslibres.pe/blog`. Su base de datos es propia. Los tours de KipuControl se insertan como bloques nativos (sin iframe ni widget). El blog de cada agencia sigue siendo el nativo de KipuControl (specs 15 y 22).
2. **SEO completo** del blog y de la vitrina:
   - metadatos, palabra clave, URL canónica y `hreflang`;
   - sitemaps, datos estructurados e imagen para redes;
   - redirecciones, IndexNow y Search Console.
3. **Etiquetas de seguimiento y publicidad**, administradas sin tocar código:
   - Google Analytics 4, Google Tag Manager y Google Ads (conversiones y conversiones mejoradas);
   - Meta Pixel con Conversions API, TikTok Pixel, Microsoft Clarity y LinkedIn Insight;
   - **scripts propios** cuando aparezca una herramienta nueva.
   Todas respetan el consentimiento de cookies (Ley 29733 y Google Consent Mode v2). Los scripts propios pasan por revisión y nunca cargan en la página de pago.
4. **Vista general de visitas**:
   - visitas, visitantes, páginas, fuentes, campañas, dispositivos y países;
   - conversiones e ingresos, en tiempo real y por período.
   Se ve en la consola de plataforma (vitrina y blog, también por agencia) y en el back-office de cada agencia (su sitio).

- Fase del plan: **3 · SaaS y crecimiento** (épica E3.21).
- Permisos nuevos: `marketing.tracking.manage`, `marketing.tracking.approve` y `analytics.web.view` (94 en total).

Prototipo:
- Agencia:
  - `#/canales/seguimiento`, con pestañas Etiquetas, Conversiones, Scripts propios y Envíos;
  - `#/reportes/visitas`, la vista general de visitas del sitio.
- Plataforma (U16): `#/admin/marketing-vitrina`, con las etiquetas de la vitrina y el blog, sus visitas, las visitas por agencia y el blog en Payload.
- Vitrina: el banner de cookies y la carga de etiquetas siguen el consentimiento (`window.KipuTags`).

## 0. Decisión y referencias

| Opción evaluada | Resultado |
|---|---|
| WordPress en `/blog` | Se descartó para Rutas Libres. Suma un tercer stack (PHP sin Laravel) y plugins que hay que mantener, y los tours solo entrarían por el widget. |
| Ghost | Es bueno para blog y newsletter, pero los tours solo entran por el widget y hay poco control de bloques. |
| Statamic (Laravel) | Es una buena alternativa si el equipo fuera solo PHP. |
| **Payload CMS 3** | **Elegido.** Es TypeScript y vive dentro de Next.js (mismo despliegue y mismo diseño). Tiene bloques de tours nativos, borradores, versiones, publicación programada, vista previa en vivo y plugins de SEO y redirecciones. Es código abierto y se aloja en nuestros servidores. |

Referencias de producto para las etiquetas y las visitas:
- Shopify Customer Events: píxeles con sandbox y consentimiento.
- Google Tag Manager con Consent Mode v2.
- Meta Conversions API, deduplicada con `event_id`.
- Plausible y Fathom: visitas sin cookies, con hash diario.
- PCI DSS 4.0, requisitos 6.4.3 y 11.6.1: inventario, autorización e integridad de los scripts en las páginas de pago.

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-055 CMS | Blog de la vitrina en Payload, SEO del blog y del sitio |
| PROC-050 Marketing (spec 14) | Etiquetas, píxeles, Google Ads, conversiones, campañas y UTM |
| PROC-054 E-commerce (spec 15) | Conversiones de compra del lado del servidor y página de pago sin scripts de terceros |
| PROC-090 Plataforma SaaS (spec 13) | Medición de la vitrina, visitas por agencia y embudo de captación |

## 2. Pantallas

| Ruta Next.js | Qué hace | Roles con acceso |
|---|---|---|
| `(vitrina)/blog`, `(vitrina)/blog/[slug]`, `(vitrina)/blog/ciudad/[ciudad]` | Blog servido por Payload: artículos con bloques de tours, autor, tabla de contenidos, FAQ y artículos relacionados | Público |
| `(payload)/admin` | Panel de Payload para el equipo de contenidos: artículos, ciudades, autores, medios, redirecciones, vista previa en vivo y programación | Cuentas de Payload (roles `admin`, `editor`, `autor`, `seo`) |
| `(backoffice)/canales/seguimiento` | Etiquetas por proveedor con asistente, verificación de instalación, mapeo de conversiones, scripts propios con revisión y registro de envíos | `marketing.tracking.manage` (aprobar scripts: `marketing.tracking.approve`) |
| `(backoffice)/reportes/visitas` | Vista general: KPIs con comparación, tendencia diaria, en vivo (últimos 30 min), páginas, fuentes y campañas, dispositivos, países, conversiones y exportación CSV | `analytics.web.view` |
| `(plataforma)/marketing-vitrina` | Lo mismo para la vitrina y el blog, más visitas y conversiones por agencia y el estado de la sincronización con Payload | Super Admin |
| Banner de cookies (vitrina y sitios) | Aceptar todo, rechazar todo o configurar por categoría (necesarias, analíticas, marketing). Se vuelve a abrir desde el pie | Público |

## 3. Modelo de datos PostgreSQL

**Tablas de la plataforma (3.1 a 3.4).** SQL: `kit/database/40_fase3.sql`, bloque «v2.10 · Seguimiento, conversiones y visitas de la vitrina (spec 24, plataforma)». No tienen RLS y tienen `REVOKE ALL` para `app_role`.

### 3.1 `platform_tracking_tags`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| code | varchar(20) | no | Único (`TAG-0001`) |
| site | varchar(10) | no | vitrina, blog, ambos |
| provider | varchar(16) | no | ga4, gtm, google_ads, meta_pixel, tiktok, clarity, linkedin, script |
| measurement_id | varchar(40) | sí | **Formato por proveedor (CHECK)**: `G-…`, `GTM-…`, `AW-…` y Pixel numérico. Los scripts no llevan ID |
| config | jsonb | no | Opciones del proveedor: `enhanced_conversions`, `debug_mode`, `send_page_view`, `ads_data_redaction`, `url_passthrough` |
| secret_ref | varchar(200) | sí | Referencia al vault (token de Conversions API, credencial de Google Ads API). Nunca se guarda el secreto |
| consent_category | varchar(12) | no | necesarias, analiticas, marketing |
| placement | varchar(12) | no | head, body_inicio, body_fin |
| page_rules | jsonb | no | `{"include":["/*"],"exclude":["/checkout/*"]}` |
| script_body / script_src | text / varchar(400) | sí | Solo para `script`. Cuerpo de 50 KB como máximo; la fuente tiene que ser `https://` |
| sri_hash | varchar(120) | sí | **Obligatorio si hay `script_src`** (CHECK) |
| csp_domains | text[] | no | Dominios que se agregan a la CSP del sitio |
| exclude_checkout | boolean | no | Para `script` siempre es true (CHECK) |
| status | varchar(12) | no | borrador, en_revision, activo, pausado, rechazado. **Activo o pausado exige aprobación** y el aprobador tiene que ser distinto del autor (CHECK) |
| starts_at / ends_at | timestamptz | sí | Ventana de campaña (`ends_at > starts_at`) |
| reject_reason | text | sí | Obligatorio al rechazar (10 caracteres o más) |

Índice único `(site, provider, measurement_id)` para que no se cargue dos veces el mismo ID.

### 3.2 `platform_conversion_mappings`

`tag_id` + `internal_event`, únicos juntos. Los eventos son reserva_vitrina, registro_agencia, pase_iniciado, plan_pagado, addon_comprado, suscripcion_boletin, lectura_articulo y clic_whatsapp. Cada mapeo guarda:
- `provider_event`, por ejemplo `Lead`, `CompleteRegistration`, `Purchase` o `conversion`;
- `conversion_label`, la etiqueta de la conversión de Google Ads;
- `send_value`, `server_side` y `active`.

### 3.3 `platform_conversion_dispatches`

Registro de cada envío: `event_id` (para deduplicar entre navegador y servidor), mapeo, canal navegador o servidor, intentos, código HTTP, error, valor y agencia.
- Estados: pendiente, enviado (exige `sent_at`), fallido (exige `error`), sin_consentimiento y duplicado.
- `(event_id, mapping_id, channel)` es único.
- Se guarda 90 días.

### 3.4 `platform_web_analytics_daily`

Agregado diario por:
- sitio (vitrina o blog), página y agencia;
- fuente, medio y campaña;
- dispositivo y país.

Métricas: visitas, visitantes, páginas vistas, rebotes, segundos con interacción, conversiones e ingresos.
- CHECK: visitantes ≤ visitas, rebotes ≤ visitas y páginas vistas ≥ visitas.
- No guarda datos personales.

**Cambio en `platform_blog_posts` (spec 22 §3.11).** La tabla pasa a ser el **índice sincronizado** de los artículos de Payload. Se agregan `payload_id` (único), `synced_at` (obligatorio si hay `payload_id`), `canonical_url` y `noindex`. VT-13 (800 palabras como mínimo para publicar) sigue validándose en la base y además en el hook de Payload.

**Tablas del tenant (3.5 a 3.8).** Están en el bloque «v2.10 · … del sitio de la agencia (spec 24, tenant)». Tienen `tenant_id`, RLS estricto y FKs compuestas.

### 3.5 `mkt_tracking_tags`

Mismas columnas y CHECKs que 3.1, sin `site`. Para el tenant solo exigen aprobación los **scripts propios**. Las etiquetas estándar (GA4, Pixel y similares) se activan al guardarlas, porque su código lo genera KipuControl.

### 3.6 `mkt_conversion_mappings`

Eventos del sitio de la agencia:
- compra (`purchase`) y compra_pendiente (Yape o transferencia);
- inicio_pago;
- lead_cotizacion, lead_contacto y chat_web;
- registro_cliente, suscripcion_boletin y clic_whatsapp;
- reserva_vitrina.

Son los eventos GA4 de la spec 15 §8.4.

### 3.7 `mkt_conversion_dispatches`

Igual que 3.3, con `order_id` hacia `channel_ecom_orders` (FK compuesta).

### 3.8 `cms_web_analytics_daily`

Igual que 3.4, sin agencia. Se calcula desde `channel_web_events` (spec 15 §3.8) y desde el conteo sin cookies (VIS-01).

**Base de datos de Payload:** aparte,, `rutaslibres_cms`, en el mismo clúster de PostgreSQL, con su propio rol `payload_role` y su propio respaldo. Payload **no tiene acceso** a la base de KipuControl; se integra solo por la API (§6) y webhooks firmados.

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Etiqueta estándar del tenant | `borrador → activo` (al guardar con ID válido) · `activo ↔ pausado` |
| Script propio y etiqueta de la plataforma | `borrador → en_revision → activo / rechazado` · `rechazado → borrador` (corrige) · `activo ↔ pausado` · editar un activo crea una nueva revisión y el anterior sigue activo hasta que se apruebe |
| Envío de conversión | `pendiente → enviado / fallido / sin_consentimiento / duplicado` · `fallido → pendiente` (reintento, hasta 10 intentos) |
| Artículo en Payload | `draft → scheduled → published` · `published → draft` (despublicar). El índice `platform_blog_posts` refleja `borrador / en_revision / publicado / archivado` |

## 5. Reglas de negocio

### 5.1 Modelo comercial (valores del prototipo, a validar)

| Concepto | Regla |
|---|---|
| Starter (sitio propio) | GA4, GTM y Meta Pixel; visitas de los últimos 30 días |
| Professional y Enterprise | Todos los proveedores; conversiones del lado del servidor (Meta CAPI, Google Ads y GA4 Measurement Protocol); scripts propios; visitas de 13 meses y exportación |
| Add-on «Marketing Pro» (`marketing_pro`) | S/ 39 al mes para dar a Starter lo de Professional en esta spec |
| Vitrina gratuita | La agencia ve en `#/canales/vitrina` sus visitas y reservas de la vitrina. Las etiquetas de la vitrina las maneja solo la plataforma |

### 5.2 Reglas

| ID | Regla | Dónde |
|---|---|---|
| SEG-01 | Antes de cualquier etiqueta se carga el **Consent Mode v2** con todo denegado (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`). Cada etiqueta se activa solo si el visitante aceptó su categoría, y al cambiar el consentimiento se actualiza sin recargar | `KipuTags` (Next.js) |
| SEG-02 | ID con formato inválido → 422 `TAG_ID_INVALID` (y CHECK). Mismo proveedor e ID dos veces → 409 `TAG_DUPLICATE` | FormRequest + DB |
| SEG-03 | Scripts propios: `script_src` exige `https` y hash SRI (422 `SCRIPT_SRI_REQUIRED`). Hay que declarar los dominios de la CSP. Se rechaza el código que use `document.write`, `eval` o `new Function`, o que lea campos de formularios de pago | FormRequest + análisis estático |
| SEG-04 | Un script propio se activa solo con la aprobación de una persona con `marketing.tracking.approve`. Si el tenant tiene dos o más administradores, el aprobador tiene que ser otro (403 `SCRIPT_SELF_APPROVAL`). En la plataforma la regla vale para todas las etiquetas (CHECK) | Action + DB |
| SEG-05 | **Nunca se cargan scripts propios ni de terceros no esenciales en el pago** (`/checkout/*`, `/pagar/*` ni en el iframe de la pasarela). Así se cumple PCI DSS 6.4.3: inventario, autorización y justificación de cada script | DB CHECK + middleware |
| SEG-06 | La CSP del sitio usa `nonce` y `strict-dynamic` y suma los dominios de las etiquetas activas. Una etiqueta que no carga por la CSP aparece en «Verificar instalación» | Middleware Next.js |
| SEG-07 | Las conversiones se envían por el navegador y por el servidor con el **mismo `event_id`**, para que Meta, TikTok y Google deduplicen. El envío por servidor exige consentimiento de marketing guardado; sin él queda en `sin_consentimiento` y no se envía | Job + DB único |
| SEG-08 | Conversiones mejoradas de Google Ads y Meta CAPI: correo y teléfono se normalizan y se envían solo como **hash SHA-256**. El `gclid`, `fbclid` y `ttclid` se guardan con la UTM del carrito (spec 14) | Service |
| SEG-09 | La compra se reporta cuando el pago está confirmado (webhook de la pasarela), no al volver de la pasarela. `compra_pendiente` se envía como evento propio y no cuenta como conversión de compra | Listener |
| SEG-10 | Reintentos con espera exponencial hasta 10 intentos. Si falla 3 veces seguidas se avisa al responsable. Los envíos se guardan 90 días | Job |
| SEG-11 | Botón **Verificar instalación**: abre la página en un navegador sin interfaz, acepta cookies y confirma que cada etiqueta activa cargó y disparó `page_view` | Job `VerifyTags` |
| SEG-12 | Cambiar, pausar o borrar una etiqueta invalida la caché del sitio (`revalidateTag('tags:<sitio>')`) en menos de 1 minuto y queda auditado con el antes y el después | Action + Audit |
| BLG-01 | Un artículo se publica con 800 palabras o más (VT-13), palabra clave en el título, el H1, el primer párrafo y el slug, meta título de 30 a 60 caracteres, meta descripción de 70 a 160, imagen destacada con texto alternativo y un solo H1 | Hook `beforeChange` de Payload |
| BLG-02 | Los artículos de ciudad enlazan al menos 3 tours publicados de la vitrina con el bloque `ToursRecomendados`. Si un tour se despublica, el bloque lo oculta y avisa al editor | Bloque + webhook |
| BLG-03 | Al publicar o despublicar, Payload llama al webhook firmado (HMAC) de KipuControl, que actualiza `platform_blog_posts` y revalida el sitemap, la página y el listado | Hook `afterChange` |
| BLG-04 | Cambiar el slug de un artículo publicado crea una redirección 301 automática (plugin de redirecciones), sin cadenas ni bucles | Hook |
| BLG-05 | Cada artículo publica JSON-LD `BlogPosting`, `BreadcrumbList` y, si tiene preguntas, `FAQPage`. La imagen para redes se genera con `next/og` cuando no se sube una | Plantilla |
| BLG-06 | Los sitemaps se dividen por tipo (artículos, ciudades, tours y agencias) con `lastmod` real. Al publicar se avisa por IndexNow y el sitemap queda registrado en Search Console | Job `PingSearchEngines` |
| VIS-01 | **Conteo sin cookies.** Cada visita se cuenta con un hash del IP truncado, el navegador y el sitio, con una sal que cambia cada día, así que no se puede seguir a una persona de un día a otro. No se guarda el IP. Por eso las visitas se cuentan aunque el visitante rechace las cookies; el detalle por evento con `session_id` solo existe con consentimiento analítico | `POST /public/analytics/hit` |
| VIS-02 | Visita: 30 minutos sin actividad la cierran. Rebote: visita de una página sin interacción en 10 segundos. Se excluyen los bots conocidos y el tráfico interno (usuarios del back-office y las IP de la agencia) | Job `AggregateWebAnalytics` |
| VIS-03 | La fuente sale de la UTM, de `gclid`, `fbclid` o `ttclid` (Google Ads `google / cpc`, Meta `facebook / paid`) o del referente. Sin nada de eso es `(directo)` | Service |
| VIS-04 | El agregado diario se recalcula cada hora para el día en curso y una vez a las 03:00 para el día anterior. Los últimos 30 minutos («en vivo») salen de Redis | Jobs |
| VIS-05 | Los números de esta vista son los de KipuControl. Si hay GA4 conectado, se muestra al lado su cifra y la diferencia esperada (GA4 cuenta solo a quien aceptó cookies) | UI |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| GET | `/api/v1/marketing/tracking/tags` | marketing.tracking.manage | Etiquetas del sitio con estado y última verificación | — |
| POST | `/api/v1/marketing/tracking/tags` | marketing.tracking.manage | Crear etiqueta (SEG-02 y SEG-03) | Idempotency-Key |
| GET | `/api/v1/marketing/tracking/tags/{code}` | marketing.tracking.manage | Detalle con historial de cambios | — |
| PATCH | `/api/v1/marketing/tracking/tags/{code}` | marketing.tracking.manage | Editar (un script activo genera una nueva revisión) | If-Match |
| DELETE | `/api/v1/marketing/tracking/tags/{code}` | marketing.tracking.manage | Eliminar (borrado lógico) | — |
| POST | `/api/v1/marketing/tracking/tags/{code}/submit` | marketing.tracking.manage | Enviar un script propio a revisión | — |
| POST | `/api/v1/marketing/tracking/tags/{code}/decision` | marketing.tracking.approve | Aprobar o rechazar con motivo (SEG-04) | — |
| POST | `/api/v1/marketing/tracking/tags/{code}/pause` | marketing.tracking.manage | Pausar o reanudar | — |
| POST | `/api/v1/marketing/tracking/tags/{code}/verify` | marketing.tracking.manage | Verificar instalación (SEG-11) → 202 | — |
| GET | `/api/v1/marketing/tracking/conversions` | marketing.tracking.manage | Mapeo de eventos a proveedores | — |
| PUT | `/api/v1/marketing/tracking/conversions/{tag}/{event}` | marketing.tracking.manage | Crear o editar un mapeo | — |
| DELETE | `/api/v1/marketing/tracking/conversions/{tag}/{event}` | marketing.tracking.manage | Quitar un mapeo | — |
| GET | `/api/v1/marketing/tracking/dispatches` | marketing.tracking.manage | Envíos con filtros `status`, `provider`, `from`, `to` | — |
| POST | `/api/v1/marketing/tracking/dispatches/{id}/retry` | marketing.tracking.manage | Reintentar un envío fallido | — |
| GET | `/api/v1/analytics/web/overview` | analytics.web.view | KPIs y tendencia (`from`, `to`, `compare`) | — |
| GET | `/api/v1/analytics/web/pages` | analytics.web.view | Páginas con visitas, rebote, tiempo y conversiones | — |
| GET | `/api/v1/analytics/web/sources` | analytics.web.view | Fuentes, medios y campañas | — |
| GET | `/api/v1/analytics/web/devices` | analytics.web.view | Dispositivos y países | — |
| GET | `/api/v1/analytics/web/realtime` | analytics.web.view | Últimos 30 minutos | — |
| GET | `/api/v1/analytics/web/export` | analytics.web.view | CSV del período | — |
| GET | `/api/v1/public/site/tags` | público | Etiquetas activas del sitio por host y página, con categoría de consentimiento (sin secretos) | — |
| POST | `/api/v1/public/analytics/hit` | público | Visita sin cookies (VIS-01), con `beacon` y límite por IP | — |
| POST | `/api/v1/public/consent` | público | Guarda la elección del banner de cookies con versión de la política (spec 14) | — |
| GET | `/api/v1/platform/tracking/tags` | super_admin | Etiquetas de la vitrina y el blog | — |
| POST | `/api/v1/platform/tracking/tags` | super_admin | Crear etiqueta | Idempotency-Key |
| PATCH | `/api/v1/platform/tracking/tags/{code}` | super_admin | Editar, pausar o enviar a revisión | If-Match |
| POST | `/api/v1/platform/tracking/tags/{code}/decision` | super_admin | Aprobar o rechazar (otro Super Admin) | — |
| PUT | `/api/v1/platform/tracking/conversions/{tag}/{event}` | super_admin | Mapeo de conversiones de la vitrina | — |
| GET | `/api/v1/platform/analytics/web/overview` | super_admin | Visitas de la vitrina y el blog (`site`, `agency`) | — |
| GET | `/api/v1/platform/analytics/web/agencies` | super_admin | Visitas, reservas y conversión por agencia | — |
| POST | `/api/v1/platform/blog/webhooks/payload` | firma HMAC | Payload avisa la creación, publicación, despublicación o cambio de slug (BLG-03) | Idempotency-Key |
| GET | `/api/v1/platform/blog/sync-status` | super_admin | Artículos sincronizados, pendientes y con error | — |

Errores nuevos:
- 422 `TAG_ID_INVALID`;
- 409 `TAG_DUPLICATE`;
- 422 `SCRIPT_SRI_REQUIRED`;
- 403 `SCRIPT_SELF_APPROVAL`;
- 422 `TRACKING_PLAN_REQUIRED`, cuando el proveedor o el envío del lado del servidor no están en el plan;
- 401 `WEBHOOK_SIGNATURE`.

## 7. Permisos y comportamiento por rol

Hay 3 permisos nuevos en el módulo «Seguimiento y visitas»: `marketing.tracking.manage`, `marketing.tracking.approve` y `analytics.web.view`. El catálogo queda en 94.

| Rol | Permisos nuevos |
|---|---|
| Tenant Admin | Los 3 |
| Manager | `marketing.tracking.manage` y `analytics.web.view` (no aprueba scripts) |
| Ventas | `analytics.web.view` |
| Operaciones, Finanzas y Contabilidad | Ninguno |
| Super Admin | Etiquetas, visitas y blog de la vitrina por el guard de plataforma |
| Equipo de contenidos | Cuentas en Payload (`admin`, `editor`, `autor`, `seo`), sin acceso a KipuControl |

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `TrackingTagChanged` | default | Revalida la caché de etiquetas y la CSP del sitio y registra auditoría |
| `VerifyTags` | integrations | Abre el sitio con Playwright, acepta cookies y confirma la carga de cada etiqueta |
| `DispatchConversion` | integrations | Envía al proveedor (Meta CAPI, Google Ads API, GA4 Measurement Protocol o TikTok Events API) con el `event_id` |
| `RetryFailedConversions` (cada 15 min) | integrations | Reintenta los `fallido` con espera exponencial |
| `ConversionFailuresAlert` | notifications | Aviso tras 3 fallos seguidos de una etiqueta |
| `AggregateWebAnalytics` (cada hora y 03:00) | reports | Calcula `*_web_analytics_daily` |
| `PurgeConversionDispatches` (diario) | default | Borra los envíos de más de 90 días |
| `PayloadPostPublished` | default | Sincroniza `platform_blog_posts`, revalida páginas y sitemaps y lanza `PingSearchEngines` |
| `PingSearchEngines` | integrations | IndexNow y aviso del sitemap a Search Console |
| `ScriptReviewRequested` | notifications | Aviso a quien puede aprobar |

## 9. Auditoría

Se auditan:
- crear, editar, pausar, eliminar, aprobar y rechazar etiquetas y scripts, con el antes y el después del código;
- los cambios de mapeo de conversiones;
- los reintentos manuales;
- las exportaciones de visitas;
- los cambios de política de cookies.

En Payload se usan sus propias versiones de cada artículo.

## 10. Casos de prueba mínimos

Los primeros siete están incluidos en la prueba de humo, en la línea «OK v2.10»:
- SEG-02: guardar GA4 con `UA-12345` → CHECK.
- SEG-03: script externo sin SRI → CHECK.
- SEG-04: etiqueta de la vitrina activa sin aprobación → CHECK.
- SEG-04: un script propio del tenant activo sin aprobación → CHECK.
- SEG-05: script propio con `exclude_checkout = false` → CHECK.
- SEG-07: el mismo `event_id` enviado dos veces por servidor → unique violation.
- VIS: más visitantes que visitas → CHECK. El tenant B no ve las etiquetas ni las visitas de A.

Los demás:
- SEG-01: sin aceptar cookies de marketing, el Pixel no se carga y `gtag('consent')` queda en `denied`.
- BLG-01: publicar en Payload un artículo de 700 palabras → error del hook. El índice no cambia.
- BLG-04: cambiar el slug de un artículo publicado → 301 desde la URL anterior.
- Playwright:
  - U01 agrega Google Ads `AW-123456789` con la conversión «compra» y la verifica;
  - U01 crea un script propio y U02 no puede aprobarlo (403);
  - U16 ve visitas por agencia en `#/admin/marketing-vitrina`;
  - en `#/vitrina`, rechazar cookies deja el panel de etiquetas sin cargas de marketing.

## 11. Cambios y decisiones respecto a la documentación inicial

- **Blog de Rutas Libres:** pasa de tablas propias (spec 22) a Payload CMS. `platform_blog_posts` queda como índice sincronizado y la pantalla «Blog SEO» de `#/admin/vitrina` enlaza al panel de Payload.
- **Blog de las agencias:** sigue nativo en KipuControl (multi-tenant, consentimiento, plantillas e IA).
- **GTM y GA4:** la spec 15 los mencionaba como fijos; ahora son configurables por sitio desde esta spec, con más proveedores y conversiones del lado del servidor.
- **Visitas:** se agrega un conteo sin cookies para tener cifras completas aunque el visitante rechace la analítica.

## 12. Supuestos y puntos a validar con negocio

- Revisión legal del conteo sin cookies (VIS-01) frente a la Ley 29733 y su reglamento (D.S. 016-2024-JUS).
- Qué proveedores entran en Starter y el precio del add-on Marketing Pro.
- Si los editores del blog entran a Payload con la cuenta de plataforma (OIDC) o con usuario propio y 2FA.
- Hospedaje de los medios del blog (S3 compatible + CDN) y presupuesto de imágenes.
- Si se compran campañas de Google Ads para la vitrina desde el día uno y con qué presupuesto.

## 13. Contrato técnico (para el equipo de desarrollo)

### 13.1 Payload CMS dentro de la vitrina

```
apps/vitrina/                  Next.js 15 (App Router) + Payload 3
  src/app/(vitrina)/…          páginas públicas (consumen la API de KipuControl)
  src/app/(payload)/admin/…    panel de Payload
  src/payload.config.ts        db: @payloadcms/db-postgres (DATABASE_URI → rutaslibres_cms)
                               editor: @payloadcms/richtext-lexical
                               plugins: @payloadcms/plugin-seo, @payloadcms/plugin-redirects,
                                        @payloadcms/plugin-nested-docs, @payloadcms/storage-s3
  src/collections/             Posts, Cities, Authors, Media, Pages, Users
  src/blocks/                  ToursRecomendados, MapaRuta, Faq, Cta, Galeria, Cita
  src/hooks/                   seoGuard (BLG-01), syncKipu (BLG-03), slugRedirect (BLG-04)
```

- `Posts`:
  - campos: `title`, `slug`, `city`, `author`, `focusKeyword`, `excerpt`, `heroImage` (con `alt` obligatorio), `content` (Lexical con bloques), `faq[]`, `relatedPosts`, `meta` (plugin SEO), `publishedAt` y `noindex`;
  - `versions.drafts` con `autosave` y `schedulePublish`;
  - `livePreview` hacia `/blog/[slug]?preview=`.
- Bloque `ToursRecomendados`: guarda solo los **slugs** de los tours y los resuelve en el render con `GET /api/v1/showcase/listings?slugs=` (caché por etiqueta `showcase:listing:<slug>`). Nunca copia precios ni horarios a Payload.
- Acceso:
  - `autor`: crea y edita lo suyo;
  - `editor`: publica;
  - `seo`: edita metadatos y redirecciones;
  - `admin`: todo.
- Webhook a KipuControl: `POST /api/v1/platform/blog/webhooks/payload` con la cabecera `X-Kipu-Signature: sha256=<HMAC>` sobre el cuerpo; 5 minutos de tolerancia y clave en el vault.
#### 13.1.1 Configuración de entradas y SEO (v2.11)

El código está en [`kit/ejemplos/vitrina-payload/`](../kit/ejemplos/vitrina-payload/README.md), compilado con `tsc --noEmit` (Payload 3.92.1, Next.js 15.4). Se copia a `apps/vitrina/src`.

Colección `posts` en el panel:

| Pestaña o zona | Campos | Reglas |
|---|---|---|
| Contenido | `title` (H1, localizado), `titleAccent`, `kicker`, `excerpt`, `heroImage` + `heroCaption`, `content` (Lexical con H2 a H4 y bloques), `faq[]` | El editor no ofrece H1 (BLG-01). |
| Relaciones | `author`, `categories` (anidadas), `city`, `tags`, `relatedPosts` (máx. 3) | Con `city`, 3 tours como mínimo (BLG-02). |
| SEO (plugin) | `meta.title`, `meta.description`, `meta.image`, `meta.ogTitle`, con vista previa de Google | 30–60 y 70–160 caracteres. |
| Barra lateral | `slug`, `focusKeyword`, `publishedAt`, `noindex`, `canonicalUrl`; calculados `wordCount`, `readingMinutes`, `seoScore`, `seoChecks`, `createdBy`, `kipuSyncedAt` | Solo editor y SEO cambian `noindex`. |

Bloques del contenido: `toursRecomendados` (solo slugs; precios y horarios se leen de `GET /api/v1/showcase/listings?slugs=`), `consejo`, `cita`, `faq`, `cta`, `galeria` y `mapaRuta`.

Otras colecciones: `categories` (con `parent` y `breadcrumbs` del plugin nested-docs), `cities` (el slug es el id de ciudad de la vitrina), `tags`, `authors` (cargo, bio, verificado y `sameAs` para E-E-A-T), `media` (alt obligatorio y tamaños 4:3, portada y OG), `pages`, `users` (rol) y `redirects` (plugin, 301 y 302). Global `seo-defaults`: plantilla de título, descripción e imagen por defecto, organización, verificación de buscadores y rutas bloqueadas en robots.

Hooks, en orden:
1. `onlyEditorsPublish`: el autor no publica ni despublica (403).
2. `seoGuard`: calcula palabras, minutos y semáforo en cada guardado; si se publica y falla una regla bloqueante, responde 422 con la lista.
3. `slugRedirect` (BLG-04): 301 desde el slug anterior de una entrada publicada.
4. `revalidatePost`: etiquetas `post:<slug>` y `posts`, `/blog` y `/blog/sitemap.xml`.
5. `syncKipu` (BLG-03): webhook firmado con `X-Kipu-Timestamp` y `X-Kipu-Signature: sha256=HMAC(timestamp.cuerpo)`, `Idempotency-Key` y 3 intentos; luego IndexNow.

Next.js: `generateMetadata` (canónica, `hreflang` es-PE/en/pt-BR, robots, Open Graph de artículo y Twitter), JSON-LD `BlogPosting` + `BreadcrumbList` + `FAQPage` en un `@graph`, `opengraph-image.tsx` con `next/og`, `/blog/sitemap.xml` con `xhtml:link` y `robots.ts` (sin indexar fuera de producción).

Índice del blog con filtros: categoría (pastillas con conteo), destino (`city`) y búsqueda de texto, combinables. En producción la URL es `/blog?categoria=&destino=&q=`; las páginas `/blog/categoria/<slug>` y `/blog/destino/<slug>` son indexables y van en el sitemap del blog, mientras que las combinaciones con `q` o con dos filtros llevan `noindex, follow` y canónica a la página sin filtro. Mismo patrón para el blog de la landing de KipuControl, con el filtro adicional por sitio.

En el prototipo, `#/admin/marketing-vitrina` › Blog en Payload › «Entrada y SEO» muestra la ficha de cada entrada con la vista previa en Google y en redes. El artículo público `#/vitrina/blog/<slug>` usa la misma estructura.

- Despliegue: un solo contenedor de la app vitrina. El panel de Payload queda en `/admin` y se restringe por IP o SSO. Las migraciones de Payload van en su propio pipeline.

### 13.2 Componente `KipuTags` (vitrina y sitios de agencias)

1. El `layout` del servidor pide `GET /public/site/tags?host=&path=` (caché `tags:<sitio>`, 60 s).
2. Pinta en `<head>` el **default de Consent Mode v2** (todo `denied`) antes de cualquier otra etiqueta.
3. Las etiquetas estándar se generan desde plantillas internas de KipuControl, por ejemplo `gtag.js` con el ID o el `fbq('init', id)`. Nunca se acepta el código pegado de un proveedor estándar: va como `script` y pasa por revisión.
4. Los scripts propios se insertan con `nonce`, `integrity` (SRI) y `crossorigin`, en la posición `placement` y solo en las rutas de `page_rules` que no son de pago.
5. Al aceptar cookies se llama a `gtag('consent','update', …)`, `fbq('consent','grant')` y similares, y se cargan las etiquetas de la categoría aceptada.
6. `window.kipuTrack(event, params)` envía el evento a las etiquetas mapeadas y a `POST /public/analytics/events` con un `event_id` UUID v7.

### 13.3 Envíos del lado del servidor

| Proveedor | API | Datos |
|---|---|---|
| Meta | Conversions API (`/{pixel_id}/events`) | `event_name`, `event_id`, `event_time`, `action_source=website`, `user_data` con hash (em, ph, fbp, fbc), `custom_data` (value, currency, content_ids) |
| Google Ads | Google Ads API, `ConversionUploadService` (o conversiones mejoradas por gtag) | `gclid` o datos con hash, `conversion_action`, `conversion_date_time`, valor y moneda |
| GA4 | Measurement Protocol | `client_id`, `transaction_id`, `items[]`, valor y moneda (spec 15) |
| TikTok | Events API | `event`, `event_id`, `ttclid`, datos con hash |

### 13.4 Rendimiento y seguridad

- Las etiquetas de terceros cargan con `afterInteractive` o `lazyOnload`. Presupuesto: +60 KB de JS como máximo sobre la spec 15 y sin bajar el LCP de 2,5 s.
- Las cabeceras CSP las arma el middleware con los `csp_domains` de las etiquetas activas. Hay reporte `report-to` y monitoreo de cambios en la página de pago (PCI DSS 11.6.1).
- Los secretos (token de CAPI y desarrollador de Google Ads) se leen del vault en el job. Nunca llegan al navegador ni a la API pública.
