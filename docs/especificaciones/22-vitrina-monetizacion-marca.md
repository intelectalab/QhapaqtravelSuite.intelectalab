# Vitrina gratuita, monetización y marca propia de la agencia (v2.8)

Módulo nuevo de la v2.8. Reúne cuatro piezas comerciales del SaaS:

> **v2.11 · Diseño.** La vitrina usa el sistema «Luminous Nomad» del equipo (Stitch): cobalto `#1D4ED8` para navegación y confianza, coral `#F95738` solo para reservar y precios, esmeralda `#059669` para verificado, Plus Jakarta Sans y tarjetas redondeadas, sin motivos folclóricos. Referencia: `kit/design/rutaslibres/DESIGN.md`.

1. **Vitrina gratuita multi-agencia** en un dominio nuevo de la plataforma (nombre provisional **Rutas Libres Perú**, `rutaslibres.pe`). Las agencias publican free tours sin costo y los viajeros reservan con nombre y correo. Tiene blog SEO propio. Sirve para **atraer agencias** y mostrarles siempre los beneficios de los planes, al estilo de Mercado Pago con sus vendedores.
2. **Pase Básico de 30 días** con las funciones que el Super Admin elija, gratis o pagado, y **add-ons** con pago único o mensual, para agencias que prefieren pagar una sola vez.
3. **Pasarelas de pago con PayPal**: cada cobro registra la comisión de la pasarela y el neto, y la rentabilidad la descuenta.
4. **Marca propia**: dominio propio con SSL, herramientas SEO (auditoría por página, redirecciones, sitemap) y **blog de aventuras con clientes**, publicado solo con consentimiento.

Fase del plan: **3 · SaaS y crecimiento** (épica E3.19). Permisos nuevos: `channels.showcase.manage`, `cms.seo.manage` y `finance.gateways.manage` (89 en total).

Prototipo:
- Vitrina pública: `#/vitrina` (inicio, ciudad, ficha con reserva gratis, «Para agencias», blog).
- Agencia: `#/canales/vitrina`, `#/canales/seo`, `#/canales/aventuras`, `#/finanzas/pasarelas`; página pública `#/sitio/aventuras`.
- Plataforma (U16): `#/admin/pases` y `#/admin/vitrina`.

## 0. Investigación de referencia (noviembre 2026)

| Sitio | Modelo | Qué tomamos |
|---|---|---|
| [freetourslima.com](https://freetourslima.com/) | Directorio de free tours de varias agencias en Lima: filtros por zona y tema, banderas de idioma, reserva solo con nombre y correo, pago con propina; blog y botón «Publica tu tour» | Estructura de la vitrina, reserva sin pago, filtros y llamado a agencias |
| [GuruWalk](https://support.guruwalk.com/portal/en/kb/articles/why-choose-guruwalk) | Plan gratis con cupo mensual de reservas y luego cargo por asistente o plan PRO; ranking por reseñas de asistentes; fuerte SEO | Cupo gratis + cargo por asistente; reseñas solo de quien asistió |
| FreeTour.com | Directorio internacional con cargos más bajos y menos funciones | Precio de entrada bajo |
| Civitatis | Marketplace grande en español a comisión, con mucho SEO y Google Ads | Blog por ciudad enlazado a tours; comisión para tours de pago |

Comparativa usada: [GuruWalk vs FreeTour vs Civitatis (TourDash, 2026)](https://www.tourdash.app/en/blog/guruwalk-vs-freetour-vs-civitatis-2026).

Conclusión: la vitrina compite por SEO local en español («free tour lima», «free walking tour cusco») con un dominio nuevo y un blog por ciudad. Lo que ninguno de esos sitios da, y es el argumento de venta de KipuControl, es el **sitio propio de la agencia** con SEO, cobros y paquetes, y el back-office completo.

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-090 Plataforma SaaS (spec 13) | Pases de 30 días, add-ons de pago único o mensual, embudo de captación de agencias |
| PROC-054 E-commerce | Pasarela PayPal y comisión por cobro |
| PROC-040 Cobranza y PROC-045 Rentabilidad | Comisión y neto por cobro; la rentabilidad descuenta la comisión |
| PROC-055 CMS | Dominio propio, SEO por página, redirecciones y blog de aventuras |

## 2. Pantallas

| Ruta Next.js | Qué hace | Roles con acceso |
|---|---|---|
| `(vitrina)/` | Buscador por ciudad, tema e idioma; ciudades; más reservados; banda «¿Tiene una agencia?»; blog | Público |
| `(vitrina)/[ciudad]` | Listado con filtros de zona, tema, idioma y tipo | Público |
| `(vitrina)/tour/[slug]` | Ficha con lo que verá, punto de encuentro, agencia y reserva gratis (nombre, correo, fecha, hora, personas, idioma) | Público |
| `(vitrina)/agencias` | Beneficios, cifras de la vitrina, planes (Vitrina gratis, Pase 30 días, Starter, Professional), add-ons y registro de agencia | Público |
| `(vitrina)/blog`, `(vitrina)/blog/[slug]` | Artículos SEO con tours recomendados y banda para agencias. Desde la v2.10 se sirven desde Payload CMS (spec 24) | Público |
| `(backoffice)/canales/vitrina` | Publicaciones, reservas de la vitrina (asistió / no-show), comisión del mes y beneficios del plan | `channels.showcase.manage` |
| `(backoffice)/canales/seo` | Dominios y SSL, auditoría por página, redirecciones, sitemap y robots | `cms.seo.manage` |
| `(backoffice)/canales/aventuras` | Historias con cliente, consentimiento y publicación | `cms.seo.manage` o `channels.cms.publish` |
| `(sitio)/aventuras`, `(sitio)/aventuras/[slug]` | Historias publicadas en el sitio de la agencia | Público |
| `(backoffice)/finanzas/pasarelas` | Pasarelas, transacciones con bruto, comisión, IGV y neto; simulador | `finance.gateways.manage` |
| `(plataforma)/pases` | Pases de 30 días (crear con funciones, extender, convertir, revocar) y catálogo de add-ons | Super Admin |
| `(plataforma)/vitrina` | Moderación, embudo, blog SEO y agencias | Super Admin |

## 3. Modelo de datos PostgreSQL

**Tablas del tenant (3.1 a 3.6).**

SQL: `kit/database/40_fase3.sql`, bloque «v2.8 · Pasarelas, dominio propio, SEO y aventuras». 6 tablas con `tenant_id`, RLS estricto y FKs compuestas.

### 3.1 `fin_gateway_accounts`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| provider | varchar(16) | no | CHECK IN ('pasarela_local','paypal','yape','plin','otro') |
| label, account_ref | varchar | no | UNIQUE (tenant_id, provider, account_ref) |
| status, mode | varchar | no | pendiente/activa/pausada/error; sandbox/produccion. Activa en producción exige `credentials_ref` (CHECK) |
| currency, fee_currency | char(3) | no | |
| fee_pct, fee_fixed, fx_spread_pct | numeric | no | 0–15 %, ≥ 0, 0–10 % |
| tax_on_fee, pass_fee_to_customer | boolean | no | IGV sobre la comisión; trasladar la comisión como recargo visible |
| settle_days | smallint | no | 0–60 |
| credentials_ref | varchar(120) | sí | Llave del vault; nunca el secreto |
| addon_required | varchar(40) | sí | p. ej. `paypal_gateway` |

### 3.2 `fin_payment_fees`

Una fila por cobro hecho por pasarela (UNIQUE por `payment_id`). `net = gross − fee − fee_tax − fx_spread` (CHECK). `status` estimado/liquidado/ajustado; liquidado exige `settled_on`. FK `fin_payments` y `fin_gateway_accounts`.

### 3.3 `cms_site_domains`

`host` válido en minúsculas, único en toda la plataforma mientras no esté retirado. `status` pendiente_dns/verificado/error/retirado (verificado exige `verified_at`); `ssl_status` pendiente/emitido/renovando/error (emitido exige `ssl_expires_at`); `verify_token` para el TXT.

### 3.4 `cms_seo_pages`

Por página publicada (UNIQUE tenant + path): título, meta descripción, palabra clave, `schema_types`, canónica, indexable, H1, palabras, imágenes y con alt (alt ≤ imágenes), velocidad móvil, puntaje 0–100, `issues` jsonb, clics 28 d y posición media.

### 3.5 `cms_redirects`

`from_path` → `to_path`, código 301/302, contador de visitas; origen ≠ destino (CHECK) y único por tenant entre las activas.

### 3.6 `cms_travel_stories`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id, slug | | no | UNIQUE (tenant_id, slug) |
| title, client_id | | no | FK `crm_clients` |
| reservation_id, product_id | uuid | sí | FK `booking_reservations`, `catalog_products` |
| quote, body, city, photo_count | | | |
| status | varchar(24) | no | borrador, pendiente_consentimiento, publicado, despublicado |
| consent_at, consent_by_name, consent_channel, consent_name_mode | | sí | Los cuatro juntos o ninguno (CHECK); canal portal/correo_firmado/whatsapp/presencial; nombre completo/solo nombre/anónimo |
| consent_photos, consent_revoked_at | | sí | |
| published_at | timestamptz | sí | **Publicado exige consentimiento vigente y fecha** (CHECK); con fotos exige `consent_photos` |

**Tablas de la plataforma (3.7 a 3.12).**

Tablas sin RLS de tenant y con `REVOKE ALL` para `app_role`: el tenant las usa solo por la API, que filtra por su perfil de agencia. Cambios en `addons` (`billing_mode`, `price_once`, CHECK de precios según el modo) y en `subscription_items` (`billing_mode`, `paid_once_at`; los de pago único no tienen `ends_at`).

### 3.7 `platform_access_passes`

Código único; `tenant_id` FK `tenants`; `starts_on < ends_on` y máximo 60 días (CHECK); `features` text[] no vacío; `status` activo/vencido/convertido/revocado; **un pase activo por tenant** (índice parcial); con precio exige `invoice_id` (`platform_invoices`); `convert_to_plan_id` FK `plans`; `source` consola/vitrina/ventas.

### 3.8 `platform_showcase_agencies`

Código y slug únicos; `tenant_id` opcional (agencias sin cuenta) y único si existe; RUC 10/20 + 9 dígitos; `status` en_revision/activa/suspendida/rechazada (activa exige `verified_at`); rating y reseñas.

### 3.9 `platform_showcase_listings`

Código y slug únicos; `model` propina/pago con `price > 0` solo si es de pago (CHECK); idiomas y horarios no vacíos; punto de encuentro obligatorio; `status` borrador/en_revision/publicado/rechazado/despublicado (rechazado exige motivo; publicado exige `published_at`); `featured_until` para el add-on Destacado; `tenant_product_ref` enlaza con un producto del tenant.

### 3.10 `platform_showcase_bookings`

Código y `cancel_token` únicos; nombre, correo (citext), pax 1–30, idioma, `status` confirmada/asistio/no_show/cancelada; `fee_basis` cupo_gratis/por_asistente/comision/plan; con comisión exige `commission_pct` y `amount` (CHECK).

### 3.11 `platform_blog_posts`

Slug único; palabra clave obligatoria; `status` borrador/en_revision/publicado/archivado; **publicado exige fecha y al menos 800 palabras** (CHECK); `linked_listing_ids`.

### 3.12 `platform_funnel_events`

Append-only (trigger + REVOKE). `kind` visita/reserva/registro_agencia/pase_iniciado/plan_pagado/addon_comprado, con agencia, tenant, publicación, `session_hash` y UTM.

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Publicación de la vitrina | `borrador → en_revision → publicado | rechazado` · `rechazado → en_revision` (corrige) · `publicado ↔ despublicado` |
| Agencia de la vitrina | `en_revision → activa | rechazada` · `activa ↔ suspendida` |
| Reserva de la vitrina | `confirmada → asistio | no_show` (la agencia, desde la fecha) · `confirmada → cancelada` (viajero con su token o agencia) |
| Pase | `activo → vencido` (job) · `activo → convertido` (se suscribe) · `activo → revocado` |
| Dominio | `pendiente_dns → verificado | error` · `error → pendiente_dns` · `* → retirado` |
| Historia de aventura | `borrador → pendiente_consentimiento → publicado` · `publicado → despublicado` (incluye retiro del consentimiento) |
| Comisión de cobro | `estimado → liquidado → ajustado` |

## 5. Reglas de negocio

### 5.1 Modelo comercial

| Concepto | Regla (valores del prototipo, a validar) |
|---|---|
| Vitrina gratis | Free tours ilimitados; 30 reservas al mes sin costo por agencia; luego S/ 2 por asistente |
| Tours de pago en la vitrina | Comisión 8 % sin plan, 5 % Starter, 4 % Professional, 3 % Enterprise |
| Agencias con plan | Sin cargo por asistente en free tours |
| Pase Básico 30 días | S/ 149 pago único o cortesía; funciones a elección; uno activo por tenant; máx. 60 días |
| Add-ons | Pago único, mensual o ambos: PayPal (único S/ 149), Armador por tramos (S/ 690 o S/ 89/mes), SEO y blog de aventuras (S/ 490 o S/ 69/mes), Destacado en la vitrina (S/ 39/mes), Dominio propio (S/ 290 o S/ 45/mes) |

### 5.2 Reglas

| ID | Regla | Dónde |
|---|---|---|
| VT-01 | Toda publicación pasa por moderación: fotos y textos propios (declaración), punto de encuentro real y agencia verificada (RUC y licencia). Rechazar exige motivo | Platform Action |
| VT-02 | Reserva de la vitrina: solo nombre y correo válidos; sin pago para free tours; cupo por salida; un mismo correo no reserva dos veces la misma salida | Public Action |
| VT-03 | Cargo a la agencia: free tours sin costo hasta 30 reservas al mes; desde la 31 se cobra por asistente; tours de pago pagan la comisión de su plan. Las agencias con plan no tienen cargo por asistente | Service + factura mensual |
| VT-04 | Solo quien asistió puede reseñar; el ranking ordena por destacado, reseñas verificadas y tasa de asistencia | Service |
| VT-05 | El panel de toda agencia sin plan muestra siempre los beneficios de los planes y el botón «Probar 30 días» | UI |
| VT-06 | Pase: uno activo por tenant, máximo 60 días, funciones elegidas de `features`. Al vencer, el tenant queda en solo lectura 15 días; los datos se conservan | Job + middleware de entitlements (spec 13) |
| VT-07 | Add-on de pago único: se factura una vez y queda activo mientras exista la cuenta; mensual: se suma a la factura recurrente; «ambos»: el tenant elige al contratar | Billing (spec 13) |
| VT-08 | Cada cobro por pasarela crea su `fin_payment_fees` con la comisión estimada; al liquidar, se reemplaza por la real del reporte o webhook de la pasarela. La rentabilidad de la reserva descuenta comisión, IGV de la comisión y margen de cambio | Service + Job |
| VT-09 | Si la pasarela traslada la comisión al cliente, el recargo se muestra en el checkout antes de pagar y figura en el comprobante | BookingEngine |
| VT-10 | Las credenciales de PayPal y de la pasarela local se guardan cifradas en el vault; la API nunca las devuelve | Integrations (spec 13) |
| VT-11 | Dominio: verificación por TXT y CNAME; SSL automático y renovación 30 días antes; un host pertenece a un solo tenant | Job |
| VT-12 | Historia de aventura: solo se publica con consentimiento vigente; si el cliente lo retira desde su portal, se despublica en el momento. El nombre se muestra según `consent_name_mode` | DB CHECK + Action |
| VT-13 | Blog SEO: un artículo se publica con 800 palabras o más, palabra clave y al menos 3 tours enlazados de su ciudad | Platform Action |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| GET | `/api/v1/showcase/listings` | público | Publicaciones con filtros `city`, `zone`, `theme`, `lang`, `model` | — |
| GET | `/api/v1/showcase/listings/{slug}` | público | Ficha con agencia, horarios y reseñas | — |
| POST | `/api/v1/showcase/listings/{slug}/bookings` | público | Reservar (nombre, correo, fecha, hora, personas, idioma) | Idempotency-Key |
| POST | `/api/v1/showcase/bookings/{token}/cancel` | público (token) | Cancelar desde el correo | — |
| GET | `/api/v1/showcase/posts` | público | Artículos publicados | — |
| GET | `/api/v1/showcase/posts/{slug}` | público | Artículo con tours enlazados | — |
| POST | `/api/v1/showcase/agencies` | público | Registro de agencia (y pedido de pase) | Idempotency-Key |
| GET | `/api/v1/channels/showcase/listings` | channels.showcase.manage | Publicaciones de la agencia | — |
| POST | `/api/v1/channels/showcase/listings` | channels.showcase.manage | Crear y enviar a revisión | Idempotency-Key |
| PATCH | `/api/v1/channels/showcase/listings/{code}` | channels.showcase.manage | Editar (vuelve a revisión) o pausar | — |
| GET | `/api/v1/channels/showcase/bookings` | channels.showcase.manage | Reservas de la vitrina | — |
| POST | `/api/v1/channels/showcase/bookings/{code}/attendance` | channels.showcase.manage | Marcar `asistio` o `no_show` | — |
| GET | `/api/v1/channels/showcase/fees` | channels.showcase.manage | Cargos y comisiones por mes | — |
| GET | `/api/v1/cms/domains` | cms.seo.manage | Dominios y SSL | — |
| POST | `/api/v1/cms/domains` | cms.seo.manage | Agregar dominio (devuelve TXT y CNAME) | — |
| POST | `/api/v1/cms/domains/{id}/verify` | cms.seo.manage | Verificar DNS y pedir SSL | — |
| DELETE | `/api/v1/cms/domains/{id}` | cms.seo.manage | Retirar dominio | — |
| GET | `/api/v1/cms/seo/pages` | cms.seo.manage | Auditoría por página | — |
| PATCH | `/api/v1/cms/seo/pages/{id}` | cms.seo.manage | Editar título, descripción, palabra clave, schema y canónica | — |
| POST | `/api/v1/cms/seo/audit` | cms.seo.manage | Reauditar ahora | — |
| GET | `/api/v1/cms/redirects` | cms.seo.manage | Redirecciones | — |
| POST | `/api/v1/cms/redirects` | cms.seo.manage | Crear (422 si genera cadena) | — |
| DELETE | `/api/v1/cms/redirects/{id}` | cms.seo.manage | Desactivar | — |
| GET | `/api/v1/cms/stories` | cms.seo.manage \| channels.cms.publish | Historias de aventura | — |
| POST | `/api/v1/cms/stories` | cms.seo.manage \| channels.cms.publish | Crear borrador desde una reserva | — |
| POST | `/api/v1/cms/stories/{id}/consent-request` | cms.seo.manage \| channels.cms.publish | Pedir el consentimiento al cliente | — |
| POST | `/api/v1/cms/stories/{id}/publish` | channels.cms.publish | Publicar (422 sin consentimiento) | — |
| POST | `/api/v1/cms/stories/{id}/unpublish` | channels.cms.publish | Despublicar | — |
| POST | `/api/v1/portal/client/stories/{id}/consent` | customer (titular) | Dar o retirar el consentimiento | — |
| GET | `/api/v1/finance/gateways` | finance.gateways.manage | Pasarelas | — |
| POST | `/api/v1/finance/gateways` | finance.gateways.manage | Conectar pasarela (credenciales al vault) | Idempotency-Key |
| PATCH | `/api/v1/finance/gateways/{id}` | finance.gateways.manage | Editar comisión, traslado y estado | — |
| GET | `/api/v1/finance/gateway-fees` | finance.gateways.manage \| finance.profitability | Cobros con bruto, comisión y neto (`from`, `to`, `gateway`) | — |
| POST | `/api/v1/finance/gateway-fees/import` | finance.gateways.manage | Importar el reporte de liquidación de la pasarela | Idempotency-Key |
| GET | `/api/v1/platform/access-passes` | super_admin | Pases | — |
| POST | `/api/v1/platform/access-passes` | super_admin | Crear pase con funciones | Idempotency-Key |
| POST | `/api/v1/platform/access-passes/{code}/extend` | super_admin | Extender días | — |
| POST | `/api/v1/platform/access-passes/{code}/convert` | super_admin | Convertir a plan | — |
| POST | `/api/v1/platform/access-passes/{code}/revoke` | super_admin | Revocar | — |
| PATCH | `/api/v1/platform/addons/{code}/billing` | super_admin | Modo de cobro y precios del add-on | — |
| GET | `/api/v1/platform/showcase/moderation` | super_admin | Publicaciones y agencias por revisar | — |
| POST | `/api/v1/platform/showcase/listings/{code}/decision` | super_admin | Aprobar o rechazar con motivo | — |
| POST | `/api/v1/platform/showcase/agencies/{code}/verify` | super_admin | Verificar agencia | — |
| GET | `/api/v1/platform/showcase/funnel` | super_admin | Embudo por mes | — |
| GET | `/api/v1/platform/showcase/posts` | super_admin | Artículos del blog | — |
| POST | `/api/v1/platform/showcase/posts` | super_admin | Crear artículo | — |
| PATCH | `/api/v1/platform/showcase/posts/{id}` | super_admin | Editar o publicar (VT-13) | — |

## 7. Permisos y comportamiento por rol

Permisos nuevos (3), módulo «Marca y vitrina»: `channels.showcase.manage`, `cms.seo.manage` y `finance.gateways.manage`. Total del catálogo: 89.

| Rol | Permisos nuevos |
|---|---|
| Tenant Admin | Los 3 |
| Manager | `channels.showcase.manage` y `cms.seo.manage` (no `finance.gateways.manage`) |
| Finanzas | `finance.gateways.manage` |
| Super Admin | Pases, add-ons y vitrina por el guard de plataforma |

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `ShowcaseBookingCreated` | notifications | Confirmación al viajero y aviso a la agencia |
| `ShowcaseReminder` (diario 18:00) | notifications | Recordatorio al viajero de las salidas de mañana |
| `ShowcaseMonthlyFees` (día 1) | billing | Calcula cargos y comisiones del mes por agencia y los factura |
| `ExpireAccessPasses` (diario) | default | `activo → vencido`, solo lectura y oferta del plan sugerido |
| `AccessPassReminder` | notifications | Aviso 7, 3 y 1 día antes del fin del pase |
| `VerifyDomains` (cada 10 min) | default | Verifica DNS pendientes y emite SSL |
| `RenewCertificates` (diario) | default | Renueva SSL a 30 días del vencimiento |
| `SeoNightlyAudit` (diario 02:00) | reports | Recalcula puntaje e issues de cada página |
| `ImportGatewaySettlements` (diario) | integrations | Trae la liquidación de PayPal y la pasarela local y ajusta las comisiones |
| `StoryConsentRevoked` | default | Despublica la historia y avisa al equipo |

## 9. Auditoría

Moderación de publicaciones y agencias; pases (crear, extender, convertir, revocar); precios y modo de cobro de add-ons; configuración de pasarelas (sin secretos); dominios; cambios SEO; redirecciones; consentimientos y publicación de historias.

## 10. Casos de prueba mínimos

- VT-03: la reserva 31 del mes de una agencia sin plan genera cargo por asistente; con plan, cero.
- VT-06: un segundo pase activo para el mismo tenant → 409 (índice parcial).
- VT-08: `net = gross − fee − fee_tax − fx_spread` (CHECK) y la rentabilidad baja por la comisión.
- VT-12: publicar una historia sin consentimiento → 422 y CHECK en la base (incluido en `tests/smoke_test.sql`, línea «OK v2.8»).
- VT-13: publicar un artículo de 700 palabras → 422.
- app_role no puede leer las tablas de la vitrina (smoke test).
- Playwright: un viajero reserva gratis en `#/vitrina/tour/cusco-centro-historico-gratis`; una agencia se registra en `#/vitrina/agencias`; U16 crea un pase de 30 días con funciones; a 390 px la vitrina no tiene scroll horizontal.

## 11. Cambios y decisiones respecto a la documentación inicial

- La vitrina es de la plataforma (no del tenant) para que una agencia sin cuenta pueda publicar; por eso sus tablas no tienen RLS de tenant y se protegen con REVOKE.
- Se reutiliza el blog y el SEO del sitio público (spec 15) para el sitio de la agencia; aquí se agregan dominio, auditoría, redirecciones e historias con consentimiento.
- PayPal entra como una pasarela más del módulo de pagos (spec 07) con su comisión registrada por cobro.
- **v2.10:** el blog de la vitrina pasa a **Payload CMS 3** dentro de la app Next.js de la vitrina (`rutaslibres.pe/blog`), con base de datos propia y tours como bloques nativos. `platform_blog_posts` queda como índice sincronizado por webhook y VT-13 se valida también en Payload. Las etiquetas (GA4, GTM, Google Ads, Meta Pixel y otras), las conversiones y la vista de visitas están en la spec 24. El blog de aventuras de las agencias sigue nativo en KipuControl.

## 12. Supuestos y puntos a validar con negocio

- Nombre y dominio de la vitrina (provisional: Rutas Libres Perú, `rutaslibres.pe`).
- Cupo gratis (30 reservas al mes), cargo por asistente (S/ 2) y comisiones por plan.
- Precio del pase (S/ 149) y si se puede repetir.
- Precios de los add-ons y cuáles se ofrecen como pago único.
- Comisión de PayPal: se toma del reporte real; el valor configurado es solo para estimar.
## 13. SEO de la vitrina: recomendación

1. Dominio nuevo corto y en español, con la palabra «tours» o «free tours» si está libre; HTTPS desde el día uno.
2. Una página por ciudad y por zona («Free tours en Barranco») con contenido único, datos estructurados `ItemList`, `TouristTrip` y `BlogPosting`, y sitemap por tipo.
3. Blog por ciudad con artículos largos que respondan búsquedas reales («qué comer en Lima», «cuánta propina en un free tour») y enlacen a 3 tours.
4. Reseñas solo de asistentes, para tener `AggregateRating` creíble.
5. Las agencias enlazan su perfil de la vitrina desde su sitio y sus redes; la vitrina enlaza el sitio propio de las agencias con plan (beneficio visible del plan).
6. Medir en Search Console (adaptador) y revisar mensualmente las 20 consultas con más impresiones.
7. Desde la v2.10 el blog se publica desde Payload con las reglas SEO de la spec 24 (BLG-01 a BLG-06), y las campañas de Google Ads y Meta se miden con las etiquetas y conversiones de esa spec.
