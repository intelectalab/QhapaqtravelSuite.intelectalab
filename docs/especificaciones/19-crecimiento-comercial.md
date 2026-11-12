# Crecimiento comercial: IA, WhatsApp, cobro local, distribución y back office (v2.6)

Módulo nuevo de la v2.6, a partir del análisis de competencia del 03/11/2026: Rezdy, Bókun, FareHarbor, Tourplan y los sistemas de Latam. Agrupa 13 funciones que suben el valor comercial de KipuControl:

1. Asistente IA de ventas.
2. WhatsApp Business oficial.
3. Pagos locales y links de pago.
4. Recuperación de carritos y cotizaciones.
5. Importador de productos con IA.
6. Channel manager con OTAs.
7. Marketplace B2B entre tenants.
8. Precios dinámicos.
9. Vales de regalo.
10. Check-in con QR y deslinde firmado.
11. Exportación contable.
12. Aéreo y hotel por integración.
13. Alertas de rentabilidad con IA.

Fase del plan: **3 · SaaS y crecimiento** (épicas E3.12 a E3.16 del backlog).

Toda integración externa va detrás de una interfaz con adaptador `Fake`: el LLM, Meta, la pasarela, las OTAs, el GDS o banco de camas y los sistemas contables. Cada función es una **regla activable** por tenant y queda limitada por plan (§5 SC-01). El prototipo todavía no tiene pantallas de este módulo (§11).

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-010 Lead y cotización | El asistente IA arma un itinerario y un borrador de cotización desde un pedido en texto o audio, y redacta la respuesta |
| PROC-020 Reserva | Reservas entrantes de OTAs y del marketplace; vales de regalo como medio de pago; ofertas de aéreo y hotel en la cotización |
| PROC-030 Operación | Pase QR de check-in por pasajero y deslinde de responsabilidad firmado en el móvil |
| PROC-040 Cobranza | Links de pago con Yape, Plin, Mercado Pago, PagoEfectivo y tarjeta en cuotas |
| PROC-050 Canales | Conexión con Viator, GetYourGuide, Expedia, Google Things to Do y Civitatis; red B2B entre tenants |
| PROC-055 Marketing | Recuperación automática de carritos y cotizaciones abandonadas |
| PROC-070 Contabilidad | Exportación de ventas, cobros y compras a Contasis, Concar, Siigo, QuickBooks, Xero o CSV |
| PROC-080 Reportes | Alertas de margen bajo, proveedor caro, meta en riesgo y cobranza atrasada |

## 2. Pantallas

| Ruta Next.js | Qué hace | Roles con acceso |
|---|---|---|
| Panel lateral «Asistente» en cotización, lead e inbox | Pedido libre → itinerario o borrador; «Aplicar» crea la versión en borrador; «Responder» pega el borrador en la conversación | Ventas, Manager, Tenant Admin (`ai.assistant.use`) |
| `/admin/whatsapp` | Número conectado, calidad, plantillas transaccionales y su estado en Meta | Tenant Admin, Manager (`inbox.whatsapp.manage`) |
| `/finanzas/links-de-pago` | Crear y enviar links (WhatsApp, correo, copiar), ver estado y anular | Finanzas, Ventas en su cartera (`finance.payment_links`) |
| `/marketing/recuperacion` | Flujos de carrito y cotización: demora, canal, plantilla, intentos; métrica de recuperados | Manager, Tenant Admin (`marketing.campaigns.manage`) |
| `/catalogo/importar` | Subir URL, PDF o planilla → revisión de productos detectados → crear en borrador | Tenant Admin, Manager (`catalog.products.import`) |
| `/catalogo/precios-dinamicos` | Reglas por ocupación, anticipación, día, temporada y demanda, con simulador | Tenant Admin, Manager (`catalog.products.dynamic_pricing`) |
| `/canales/ota` | Conexiones, mapeo de productos, reservas recibidas y errores de sincronización | Tenant Admin, Manager (`channels.ota.manage`) |
| `/canales/marketplace` | Publicar productos, buscar productos de otros operadores, alianzas y ventas | Tenant Admin, Manager (`channels.marketplace.manage`) |
| `/finanzas/vales` | Emitir, vender en el sitio, consultar saldo, canjear y anular | Finanzas (`finance.gift_cards`) |
| `/operaciones/checkin` y app del operador | Escaneo de QR, manifiesto en vivo y estado del deslinde por pasajero | Operaciones, guía, conductor (`operations.checkin`) |
| `/finanzas/exportacion-contable` | Plan de cuentas por destino y exportaciones por período | Contabilidad, Finanzas (`finance.accounting_export`) |
| Pestaña «Aéreo y hotel» de la cotización | Buscar y añadir ofertas del GDS o del banco de camas | Ventas (`quotes.external_offers`) |
| `/reportes/alertas` | Alertas de IA con su detalle y acción sugerida | Manager, Tenant Admin, Finanzas (`ai.insights.view`) |
| Portal del pasajero: «Mi pase» y «Firmar deslinde» | QR por servicio; firma con nombre y trazo | Pasajero (su reserva) |
| Sitio público: `/pagar/{token}` y `/regalo` | Pago del link; compra de vale | Público |

## 3. Modelo de datos PostgreSQL

SQL: `kit/database/40_fase3.sql`, bloque «v2.6». Todas las tablas de tenant tienen RLS estricto y FKs compuestas `(tenant_id, …)`. Las tablas del marketplace son de plataforma, sin `tenant_id`.

### 3.1 `sys_ai_requests`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| kind | varchar(20) | no | CHECK IN ('itinerary','quote_draft','reply_draft','summary','product_import','insight') |
| source_type, source_id | varchar(40), uuid | sí | Lead, cotización, conversación, importación |
| user_id | uuid | sí | FK `iam_users` |
| prompt | text | no | Texto del pedido (sin datos de tarjeta; ver SC-04) |
| input_ref, output | jsonb | no / sí | Contexto enviado (ids, no datos completos) y respuesta estructurada |
| provider, model | varchar | no / sí | `fake` por defecto |
| tokens_in, tokens_out, cost_usd | integer, integer, numeric(10,4) | no | Base del cupo mensual |
| status | varchar(12) | no | CHECK IN ('pending','completed','failed','applied','discarded') |
| error, completed_at, applied_at | — | sí | `applied` exige `applied_at` |

### 3.2 `collab_whatsapp_templates`

Plantillas transaccionales por cuenta de WhatsApp (`collab_channel_accounts`): `name` (minúsculas y guion bajo), `lang`, `category` ('utility','marketing','authentication'), `purpose` ('cotizacion','link_pago','voucher','recordatorio','recuperacion','resena','otro'), `body`, `variables`, `meta_template_id` y `status` ('borrador','enviada','aprobada','rechazada','pausada'). Es UNIQUE por cuenta, nombre e idioma. Las plantillas de campañas siguen en `mkt_templates` (spec 14).

### 3.3 `fin_payment_links`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| code | varchar(30) | no | `LPG-0001`, UNIQUE por tenant |
| reservation_id, receivable_id, gift_card_id | uuid | sí | Al menos uno (CHECK) |
| amount, currency | numeric(14,2), char(3) | no | |
| methods | text[] | no | ⊆ {card, yape, plin, mercadopago, transfer, pagoefectivo, paypal} |
| installments_max | smallint | no | 1–24 |
| provider, provider_ref, url | — | — | Adaptador de pasarela |
| token_hash | char(64) | no | UNIQUE; el token va en `/pagar/{token}` |
| expires_at | timestamptz | no | |
| status | varchar(10) | no | CHECK IN ('activo','pagado','vencido','anulado'); `pagado` exige `paid_at` y `payment_id` (FK `fin_payments`) |
| lock_version | integer | no | |

### 3.4 `mkt_recovery_flows` y `mkt_recovery_attempts`

Un flujo define `trigger_kind` ('cart','quote'), `delay_minutes` (15 a 20 160), `channel` ('email','whatsapp'), `template_ref`, `max_attempts` (1 a 5), `include_payment_link` y `active`.

Cada intento guarda el flujo y el carrito (`channel_web_carts`) o la cotización (`quote_quotes`), exactamente uno de los dos. También guarda `client_id`, `to_address`, `attempt_no`, `scheduled_at`, `sent_at` y `status` ('programado','enviado','recuperado','descartado','fallido'). Cuando el intento recupera la venta, registra `recovered_reservation_id` y `recovered_amount`. El intento es UNIQUE por flujo, origen y número.

### 3.5 `catalog_import_jobs`

`code` (`IMP-0001`), `source_type` ('url','pdf','csv','xlsx'), `source_url` o `file_path`, `status` ('en_cola','procesando','revision','importado','fallido','cancelado'), `extracted` (jsonb con los productos detectados y su confianza), `products_detected`, `products_created`, `ai_request_id` (FK `sys_ai_requests`) y `error`.

### 3.6 `channel_ota_connections`, `channel_ota_product_mappings` y `channel_ota_bookings`

**Conexión.** `ota` ('viator','getyourguide','expedia','google_ttd','civitatis','otro'), `account_ref`, `credentials_encrypted`, `webhook_secret_encrypted`, `commission_pct` (0 a 60), `markup_pct` (-20 a 100), `sync_availability`, `status` ('borrador','conectado','pausado','error','desconectado'), `last_sync_at`, `last_error` y `lock_version`.

**Mapeo.** Conexión + producto (`catalog_products`) + `ota_product_ref`/`ota_option_ref`, UNIQUE. `price_mode` ('markup','fijo','neto'; `fijo` exige `fixed_price`) y `status` ('pendiente','activo','pausado','error').

**Reserva recibida.** UNIQUE por conexión y `ota_booking_ref`. Guarda `payload`, `gross_amount`, `net_amount`, `currency`, `travel_date`, `pax` y `status` ('recibida','confirmada','rechazada','cancelada','error'). `confirmada` exige `reservation_id` (FK `booking_reservations`).

### 3.7 `platform_marketplace_listings`, `platform_marketplace_partnerships` y `platform_marketplace_orders`

Son tablas de plataforma: `app_role` no tiene privilegios sobre ellas, y `MarketplaceService` las usa con la conexión `platform`.

**Publicación.** `seller_tenant_id` (FK `tenants`) y `product_ref` (uuid del producto en el tenant vendedor, sin FK porque cruza tenants), UNIQUE. Además `product_code`, `title`, `destination`, `summary`, `currency`, `from_price`, `reseller_commission_pct` (0 a 40) y `status` ('borrador','publicado','pausado','retirado').

**Alianza.** Par vendedor ↔ revendedor, UNIQUE, con CHECK de que son tenants distintos. Guarda `commission_pct`, `platform_fee_pct` (1 % por defecto), `credit_limit`, `payment_terms` ('prepago','credito') y `status` ('solicitada','activa','rechazada','suspendida','terminada').

**Venta.** `code`, alianza, publicación, los dos tenants, referencias a la reserva en cada tenant, `gross_amount`, `commission_amount`, `platform_fee_amount`, `currency` y `status` ('solicitada','confirmada','rechazada','cancelada','liquidada'). `idempotency_key` es UNIQUE por revendedor.

### 3.8 `catalog_dynamic_price_rules`

`code`, `name` y `product_id` (NULL = todo el catálogo). `basis` ('ocupacion','anticipacion','dia_semana','temporada','demanda'), `conditions` (jsonb, por ejemplo `{"occupancy_gte":0.8}` o `{"days_before_lte":3}`), `adjust_pct` (-50 a 100), `floor_pct` y `ceiling_pct` (tope del ajuste acumulado), `priority`, `channels` (web, b2b, ota, interno), `valid_from`/`valid_to`, `active` y `lock_version`.

### 3.9 `fin_gift_cards` y `fin_gift_card_movements`

**Vale.** `code` (`VAL-0001`) y `redeem_code_hash` (UNIQUE por tenant; el código de canje se muestra una sola vez, y se guardan el hash y `redeem_code_last4`). Además `initial_amount`, `balance` (CHECK 0 ≤ balance ≤ inicial), `currency`, `buyer_client_id`, destinatario, mensaje, `deliver_at`, `expires_at`, `status` ('pendiente','activa','agotada','vencida','anulada'; `agotada` exige saldo 0), `payment_id` y `lock_version`.

**Movimientos.** Append-only: `kind` ('emision','canje','reverso','ajuste','anulacion','vencimiento'), `amount`, `balance_after`, `reservation_id` y `receivable_id`.

### 3.10 `ops_waiver_templates`, `ops_waiver_signatures` y `ops_checkin_passes`

**Plantilla de deslinde.** Versionada: UNIQUE por tenant, código y versión. Guarda `lang`, `body`, `requires_guardian_for_minors` y `active`.

**Firma.** Append-only y UNIQUE por plantilla, versión, reserva y pasajero. Guarda `body_sha256` del texto firmado, `signed_name`, `guardian_name`, `signature_path` (trazo en S3), `ip`, `user_agent` y `signed_at`.

**Pase QR.** Por pasajero y servicio (`booking_reservation_services`). `token_hash` es UNIQUE, y solo puede haber un pase no anulado por servicio y pasajero. Estados: 'emitido','usado','anulado'. `usado` exige `scanned_at`; se guardan también `scanned_by` y `scan_device_id`.

### 3.11 `fin_account_mappings` y `fin_accounting_exports`

**Plan de cuentas.** Por `target` ('contasis','concar','siigo','quickbooks','xero','csv') y `concept` ('venta_gravada','venta_exonerada','igv','cxc','caja','banco','cxp','costo_servicio','comision','diferencia_cambio','anticipo','vale_regalo'), UNIQUE. Guarda `account_code` y `cost_center`.

**Exportación.** `code`, `target`, `period_from`/`period_to`, `scope` (ventas, cobros, compras), `status` ('en_cola','generado','enviado','fallido'; `generado` exige `file_path`), `rows_count` y `sha256`.

### 3.12 `quote_external_offers`

Oferta de un `provider` ('amadeus','sabre','travelport','hotelbeds','otro') y `kind` ('aereo','hotel','auto','seguro') para una cotización (`quote_quotes`, versión opcional) y luego para la reserva. Guarda `offer_ref` (UNIQUE por tenant y proveedor), `summary`, `payload`, `net_amount`, `sell_amount`, `currency`, `offer_expires_at` y `pnr`. Estados: 'cotizada','retenida','emitida','vencida','cancelada','error'; `emitida` exige `pnr`.

### 3.13 `report_ai_insights`

`kind` ('margen_bajo','proveedor_caro','meta_en_riesgo','cobranza_atrasada','demanda_alta'), `severity` ('baja','media','alta'), `title`, `detail`, origen, `metric`, `audience_user_id`, `status` ('nueva','vista','resuelta','descartada'), `ai_request_id`, `generated_at` y `resolved_at`.

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Link de pago | `activo → pagado` (webhook de la pasarela) · `activo → vencido` (job al `expires_at`) · `activo → anulado` (usuario) |
| Intento de recuperación | `programado → enviado → recuperado` (reserva creada desde el carrito o la cotización) · `programado|enviado → descartado` (el cliente ya compró, se dio de baja o se agotaron los intentos) · `programado → fallido` |
| Importación | `en_cola → procesando → revision → importado` · `procesando → fallido` · `en_cola|revision → cancelado` |
| Conexión OTA | `borrador → conectado` (credenciales verificadas) · `conectado ↔ pausado` · `conectado → error` (3 fallos seguidos) `→ conectado` (reintento OK) · `* → desconectado` |
| Reserva OTA | `recibida → confirmada` (reserva creada con cupo) · `recibida → rechazada` (sin cupo o producto sin mapeo) · `confirmada → cancelada` (cancelación de la OTA) · `recibida → error` |
| Alianza marketplace | `solicitada → activa | rechazada` (vendedor) · `activa ↔ suspendida` · `activa|suspendida → terminada` |
| Venta marketplace | `solicitada → confirmada | rechazada` · `confirmada → cancelada` · `confirmada → liquidada` (cierre mensual) |
| Vale de regalo | `pendiente → activa` (pago o emisión manual) · `activa → agotada` (saldo 0) · `activa → vencida` (job) · `pendiente|activa → anulada` |
| Pase QR | `emitido → usado` (escaneo) · `emitido → anulado` (cancelación del servicio o reemisión) |
| Oferta externa | `cotizada → retenida → emitida` · `cotizada|retenida → vencida` (job) · `* → cancelada` |
| Alerta IA | `nueva → vista → resuelta | descartada` |
| Pedido IA | `pending → completed → applied | discarded` · `pending → failed` |

## 5. Reglas de negocio

| ID | Regla | Dónde |
|---|---|---|
| SC-01 | Cada función es una regla activable con plan mínimo. Plan **Starter**: R-AI-ASSISTANT (cupo 100 pedidos al mes), R-PAY-LINKS y R-AI-IMPORT. Plan **Professional**: R-WHATSAPP-OFFICIAL, R-CART-RECOVERY, R-GIFT-CARDS, R-QR-CHECKIN y R-ACCOUNTING-EXPORT. Plan **Enterprise**: R-OTA-CHANNEL, R-MARKETPLACE, R-DYNAMIC-PRICING, R-GDS-OFFERS y R-AI-INSIGHTS. Regla apagada o fuera de plan → 403 `RULE_NOT_IN_PLAN` | `EnsureFeature` + RuleResolver |
| SC-02 | El cupo de IA se mide por `sys_ai_requests` del mes (`usage_counters` clave `ai_requests`). Al 80 % se avisa; al 100 % se responde 429 `AI_QUOTA_EXCEEDED` hasta el mes siguiente o la compra de un paquete adicional | Service + medición (spec 13) |
| SC-03 | La IA nunca confirma, cobra ni envía sola: deja un borrador que un usuario aplica o envía. «Aplicar» crea una versión de cotización en `borrador` y pasa por las reglas de precio y aprobación de siempre | Action |
| SC-04 | No se envían a la IA datos de tarjeta, documentos de identidad ni contraseñas. Los datos del cliente se reducen a nombre, fechas, pax y preferencias | Service (filtro de PII) |
| SC-05 | WhatsApp: fuera de la ventana de 24 h solo se pueden enviar plantillas `aprobada`. El opt-in del cliente es obligatorio antes del primer mensaje | Adapter + consentimientos (spec 14) |
| SC-06 | El link de pago aplica el pago a la CxC o a la reserva con la misma lógica de 07 §4.9. El link es idempotente: un segundo webhook del mismo cobro no duplica el pago. Si el monto excede el saldo pendiente → 422 `AMOUNT_EXCEEDS_BALANCE` | Action + Idempotency |
| SC-07 | Recuperación: no se envía si el cliente no tiene consentimiento del canal, si ya compró (se descarta) o si se alcanzó `max_attempts`. Pausa entre intentos ≥ `delay_minutes` | Job |
| SC-08 | El importador nunca publica: crea productos en `borrador` tras la revisión, con los campos marcados «detectado por IA» | Action |
| SC-09 | Disponibilidad hacia OTAs = disponibilidad real menos los holds vigentes (`catalog_availability_holds`). Una reserva OTA consume cupo con el mismo bloqueo de fila que el checkout; sin cupo → `rechazada` y se informa a la OTA | BookingEngine |
| SC-10 | El precio a la OTA según el mapeo: markup sobre la tarifa pública, precio fijo o neto. La comisión de la OTA se registra como CxP de comisión al confirmar | Service |
| SC-11 | Marketplace: el revendedor ve el precio neto (público − comisión) y vende con su margen. La venta crea la reserva en el tenant vendedor (canal `marketplace`) y una reserva espejo en el revendedor. La tarifa de plataforma (1 %) se factura en la suscripción del vendedor | MarketplaceService (conexión platform) |
| SC-12 | Precio dinámico: se aplican las reglas activas por prioridad y el ajuste acumulado queda entre `floor_pct` y `ceiling_pct`. Cotización y reserva guardan el ajuste en su snapshot; un cambio posterior de regla no altera lo ya vendido | PricingService |
| SC-13 | Vale de regalo: el canje no puede superar el saldo, se registra con bloqueo de fila del vale y deja un movimiento. Un vale vencido no se canjea; la anulación devuelve el saldo solo si nunca se canjeó | Action + lock |
| SC-14 | Check-in QR: un pase solo se usa una vez. El escaneo exige que el servicio sea del día y que el usuario esté asignado al servicio. Si la regla R-QR-CHECKIN exige deslinde, no se marca el check-in sin firma vigente (o la del tutor, para menores) | Action |
| SC-15 | La exportación contable solo incluye períodos con comprobantes `aceptado` u `observado` y exige el plan de cuentas completo para los conceptos del alcance; si falta una cuenta → 422 `ACCOUNT_MAPPING_MISSING` | Service |
| SC-16 | Una oferta externa vencida no se puede convertir. Al convertir la cotización, las ofertas `retenida` pasan a emitirse en el GDS o banco de camas y su costo entra como servicio de la reserva | Action |
| SC-17 | Las alertas IA solo muestran datos que el rol ya puede ver: Ventas no recibe márgenes ni costos (SEC-BR-13) | Policy |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| POST | `/api/v1/ai/requests` | ai.assistant.use | Nuevo pedido (`kind`, `prompt`, `source`) → 202 con el pedido; resultado por polling o Reverb | Idempotency-Key |
| GET | `/api/v1/ai/requests/{id}` | ai.assistant.use | Estado y salida del pedido | — |
| POST | `/api/v1/ai/requests/{id}/apply` | ai.assistant.use | Aplica el borrador (crea versión de cotización o mensaje en borrador) | Idempotency-Key |
| POST | `/api/v1/ai/requests/{id}/discard` | ai.assistant.use | Descarta | — |
| GET | `/api/v1/ai/usage` | ai.assistant.use | Consumo del mes y cupo del plan | — |
| GET | `/api/v1/reports/insights` | ai.insights.view | Alertas filtradas por estado y tipo | — |
| POST | `/api/v1/reports/insights/{id}/resolve` | ai.insights.view | Marcar resuelta o descartada (`{status}`) | — |
| GET | `/api/v1/inbox/whatsapp-templates` | inbox.whatsapp.manage | Plantillas transaccionales | — |
| POST | `/api/v1/inbox/whatsapp-templates` | inbox.whatsapp.manage | Crear y enviar a Meta | — |
| PATCH | `/api/v1/inbox/whatsapp-templates/{id}` | inbox.whatsapp.manage | Editar (aprobada → enviada) | — |
| POST | `/api/v1/inbox/conversations/{id}/send-template` | inbox.manage | Envía una plantilla aprobada con variables | Idempotency-Key |
| GET | `/api/v1/finance/payment-links` | finance.payment_links | Lista | — |
| POST | `/api/v1/finance/payment-links` | finance.payment_links | Crear link | Idempotency-Key |
| POST | `/api/v1/finance/payment-links/{code}/send` | finance.payment_links | Enviar por WhatsApp o correo | — |
| POST | `/api/v1/finance/payment-links/{code}/cancel` | finance.payment_links | Anular | lock_version |
| GET | `/api/v1/public/pay/{token}` | público (token firmado) | Datos del link para la página de pago | — |
| POST | `/api/v1/public/pay/{token}/checkout` | público (token firmado) | Inicia el cobro con el medio elegido | Idempotency-Key |
| GET | `/api/v1/marketing/recovery-flows` | marketing.campaigns.manage | Flujos | — |
| POST | `/api/v1/marketing/recovery-flows` | marketing.campaigns.manage | Crear | — |
| PATCH | `/api/v1/marketing/recovery-flows/{code}` | marketing.campaigns.manage | Editar o activar | — |
| GET | `/api/v1/marketing/recovery-attempts` | marketing.campaigns.manage | Intentos y recuperados | — |
| POST | `/api/v1/catalog/imports` | catalog.products.import | Nueva importación (URL o archivo) | Idempotency-Key |
| GET | `/api/v1/catalog/imports/{code}` | catalog.products.import | Estado y productos detectados | — |
| POST | `/api/v1/catalog/imports/{code}/confirm` | catalog.products.import | Crea en borrador los productos elegidos | Idempotency-Key |
| POST | `/api/v1/catalog/imports/{code}/cancel` | catalog.products.import | Cancelar | — |
| GET | `/api/v1/catalog/dynamic-price-rules` | catalog.products.dynamic_pricing | Lista | — |
| POST | `/api/v1/catalog/dynamic-price-rules` | catalog.products.dynamic_pricing | Crear | — |
| PATCH | `/api/v1/catalog/dynamic-price-rules/{code}` | catalog.products.dynamic_pricing | Editar o activar | lock_version |
| POST | `/api/v1/catalog/dynamic-price-rules/simulate` | catalog.products.dynamic_pricing | Simula el precio por fecha y canal | — |
| GET | `/api/v1/channels/ota/connections` | channels.ota.manage | Conexiones | — |
| POST | `/api/v1/channels/ota/connections` | channels.ota.manage | Crear y verificar credenciales | — |
| PATCH | `/api/v1/channels/ota/connections/{code}` | channels.ota.manage | Editar, pausar o reanudar | lock_version |
| POST | `/api/v1/channels/ota/connections/{code}/sync` | channels.ota.manage | Forzar sincronización | Idempotency-Key |
| GET | `/api/v1/channels/ota/connections/{code}/mappings` | channels.ota.manage | Mapeos | — |
| PUT | `/api/v1/channels/ota/connections/{code}/mappings/{productId}` | channels.ota.manage | Crear o editar mapeo | — |
| GET | `/api/v1/channels/ota/bookings` | channels.ota.manage | Reservas recibidas y errores | — |
| POST | `/api/v1/webhooks/ota/{ota}` | firma de la OTA | Reserva, cambio o cancelación entrante | Idempotency por `ota_booking_ref` |
| GET | `/api/v1/marketplace/listings` | channels.marketplace.manage | Buscar productos de otros operadores (destino, fecha) | — |
| POST | `/api/v1/marketplace/listings` | channels.marketplace.manage | Publicar un producto propio | — |
| PATCH | `/api/v1/marketplace/listings/{id}` | channels.marketplace.manage | Editar, pausar o retirar | — |
| GET | `/api/v1/marketplace/partnerships` | channels.marketplace.manage | Alianzas | — |
| POST | `/api/v1/marketplace/partnerships` | channels.marketplace.manage | Solicitar alianza | — |
| POST | `/api/v1/marketplace/partnerships/{id}/decide` | channels.marketplace.manage | Aceptar o rechazar (`{decision}`) | — |
| POST | `/api/v1/marketplace/orders` | channels.marketplace.manage | Vender un producto de un aliado | Idempotency-Key |
| GET | `/api/v1/marketplace/orders` | channels.marketplace.manage | Ventas y compras del marketplace | — |
| GET | `/api/v1/finance/gift-cards` | finance.gift_cards | Lista | — |
| POST | `/api/v1/finance/gift-cards` | finance.gift_cards | Emitir (manual) | Idempotency-Key |
| GET | `/api/v1/finance/gift-cards/{code}` | finance.gift_cards | Detalle y movimientos | — |
| POST | `/api/v1/finance/gift-cards/{code}/redeem` | finance.gift_cards | Canjear contra una reserva o CxC | Idempotency-Key |
| POST | `/api/v1/finance/gift-cards/{code}/void` | finance.gift_cards | Anular | lock_version |
| POST | `/api/v1/public/gift-cards` | público (widget key) | Comprar un vale en el sitio | Idempotency-Key |
| POST | `/api/v1/public/gift-cards/balance` | público (widget key) | Consultar saldo con el código de canje | — |
| GET | `/api/v1/ops/waiver-templates` | operations.checkin | Plantillas de deslinde | — |
| POST | `/api/v1/ops/waiver-templates` | operations.checkin | Crear versión | — |
| POST | `/api/v1/ops/checkin/scan` | operations.checkin | Escanear un pase (`{token}`) | Idempotency-Key |
| GET | `/api/v1/ops/checkin/manifest/{serviceId}` | operations.checkin | Manifiesto en vivo del servicio | — |
| GET | `/api/v1/portal/passenger/passes` | pasajero (su reserva) | Pases QR de sus servicios | — |
| POST | `/api/v1/portal/passenger/waivers` | pasajero (su reserva) | Firmar deslinde (multipart con el trazo) | Idempotency-Key |
| GET | `/api/v1/finance/account-mappings` | finance.accounting_export | Plan de cuentas por destino | — |
| PUT | `/api/v1/finance/account-mappings` | finance.accounting_export | Guardar plan de cuentas | — |
| POST | `/api/v1/finance/accounting-exports` | finance.accounting_export | Generar exportación | Idempotency-Key |
| GET | `/api/v1/finance/accounting-exports` | finance.accounting_export | Exportaciones y descarga | — |
| POST | `/api/v1/quotes/{id}/external-offers/search` | quotes.external_offers | Buscar aéreo, hotel, auto o seguro | — |
| POST | `/api/v1/quotes/{id}/external-offers` | quotes.external_offers | Añadir una oferta a la cotización | Idempotency-Key |
| DELETE | `/api/v1/quotes/{id}/external-offers/{offerId}` | quotes.external_offers | Quitar oferta | — |

## 7. Permisos y comportamiento por rol

Permisos nuevos (12), módulo «Crecimiento»: `ai.assistant.use`, `ai.insights.view`, `inbox.whatsapp.manage`, `finance.payment_links`, `finance.gift_cards`, `finance.accounting_export`, `catalog.products.import`, `catalog.products.dynamic_pricing`, `channels.ota.manage`, `channels.marketplace.manage`, `operations.checkin`, `quotes.external_offers`.

| Rol | Permisos nuevos |
|---|---|
| Tenant Admin | Los 12 |
| Manager | Los 12 salvo `finance.accounting_export` |
| Ventas | `ai.assistant.use`, `finance.payment_links` (solo su cartera), `quotes.external_offers` |
| Operaciones | `ai.assistant.use`, `operations.checkin` |
| Finanzas | `ai.insights.view`, `finance.payment_links`, `finance.gift_cards`, `finance.accounting_export` |
| Contabilidad | `finance.accounting_export` |
| Guía, Conductor | `operations.checkin` (solo servicios asignados) |
| Pasajero | Sin permisos nuevos: ve sus pases y firma por pertenencia |

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `AiRequestQueued` → `RunAiRequest` | ai | Llama al adaptador LLM, guarda la salida, tokens y costo; emite `AiRequestCompleted` por Reverb |
| `GenerateAiInsights` (diario 06:00) | ai | Calcula alertas por tenant y avisa a su audiencia |
| `PaymentLinkPaid` (webhook) | payments | Registra el pago y aplica a la CxC; notifica al vendedor |
| `ExpirePaymentLinks` (cada hora) | default | `activo → vencido` |
| `ScheduleRecoveryAttempts` (cada 15 min) | marketing | Detecta carritos o cotizaciones sin avance y programa intentos |
| `SendRecoveryAttempt` | notifications | Envía por el canal con plantilla y link de pago opcional |
| `ProcessCatalogImport` | ai | Extrae productos del origen y deja la importación en `revision` |
| `SyncOtaAvailability` (cada 15 min y tras cada venta) | channels | Publica disponibilidad y precios a cada conexión `conectado` |
| `OtaBookingReceived` | channels | Crea o rechaza la reserva y responde a la OTA |
| `MarketplaceOrderConfirmed` | platform | Crea las reservas en ambos tenants y registra comisión y tarifa |
| `ExpireGiftCards` (diario) | default | `activa → vencida` con movimiento de vencimiento |
| `DeliverGiftCard` | notifications | Envía el vale al destinatario en `deliver_at` |
| `IssueCheckinPasses` (al confirmar la reserva) | default | Crea los pases y los deja en el portal del pasajero |
| `BuildAccountingExport` | reports | Genera el archivo en el formato del destino |
| `ExpireExternalOffers` (cada 30 min) | default | `cotizada|retenida → vencida` |

## 9. Auditoría

Se auditan las siguientes acciones:

- **Pedidos de IA:** aplicar y descartar.
- **WhatsApp:** cambios de plantillas.
- **Links de pago:** creación, envío, anulación y pago.
- **Recuperación:** cambios de flujos.
- **Importaciones:** confirmación.
- **Precios dinámicos:** cambios de reglas, con antes y después.
- **OTAs:** conexiones (sin credenciales en el log), mapeos y reservas recibidas.
- **Marketplace:** publicaciones, alianzas y ventas.
- **Vales:** emisión, canje y anulación.
- **Operación:** firmas de deslinde y escaneos.
- **Contabilidad:** exportaciones contables.
- **Cotización:** ofertas externas.

Los secretos y los códigos de canje nunca se auditan en claro.

## 10. Casos de prueba mínimos

Pest:

- Aislamiento de tenant en las 19 tablas de tenant; el marketplace no expone datos de un tenant a otro fuera de lo publicado.
- SC-01: regla apagada o plan sin la regla → 403.
- SC-02: cupo de IA al 100 % → 429.
- SC-03: aplicar crea una versión en borrador y no cambia el estado de la cotización.
- SC-04: el filtro de PII elimina DNI y tarjeta del prompt.
- SC-06: webhook duplicado no duplica el pago; monto mayor al saldo → 422.
- SC-07: sin consentimiento no se envía; compra posterior → descartado.
- SC-09: reserva OTA sin cupo → rechazada; dos reservas OTA concurrentes por el último cupo → una confirmada.
- SC-11: venta del marketplace crea las dos reservas y la comisión; idempotencia por clave.
- SC-12: ajustes acumulados respetan piso y techo; el snapshot no cambia.
- SC-13: canje mayor al saldo → 422; canjes concurrentes no dejan saldo negativo.
- SC-14: un pase usado dos veces → 409; sin deslinde → 422.
- SC-15: falta una cuenta → 422.
- SC-16: convertir con oferta vencida → 422.
- SC-17: Ventas no recibe márgenes en las alertas.

Playwright: Ventas pide un itinerario de 4 días a Cusco y aplica el borrador; Finanzas crea un link con Yape y lo paga en sandbox; carrito abandonado recibe el intento y se recupera; Operaciones escanea el QR de un pasajero con deslinde firmado; a 400 px, `/pagar/{token}` y `/regalo` sin scroll horizontal.

## 11. Cambios y decisiones respecto a la documentación inicial

- **Módulo nuevo** (v2.6). Sale del análisis de competencia; la documentación inicial y la Fase 3 lo dejaban como «Futuro» (IA, OTA/GDS, marketplace).
- Se reutiliza lo existente:
  - WhatsApp usa `collab_channel_accounts` (spec 10) y las campañas siguen en `mkt_templates` (spec 14).
  - Los pagos se aplican como en 07 §4.9.
  - La disponibilidad sale de `catalog_availability_holds`, la fuente única desde la v2.5.
  - Los planes y el cupo usan `plan_rule_entitlements` y `usage_counters` (spec 13).
- El marketplace se modela en plataforma porque cruza tenants: ninguna tabla de tenant referencia datos de otro tenant.
- El prototipo navegable no tiene aún las pantallas de este módulo. Las rutas Next.js de §2 son la referencia para construirlas.

## 12. Supuestos y puntos a validar con negocio

- Proveedor de LLM y su costo; cupo de IA por plan (supuesto: 100 al mes en Starter, 1 000 en Professional y 5 000 en Enterprise).
- Pasarela local (Izipay, Niubiz, Mercado Pago o Culqi) y comisiones de Yape y Plin.
- Acuerdos de conectividad con cada OTA (Viator y GetYourGuide exigen alta como proveedor) y elección de GDS o banco de camas.
- Tarifa de plataforma del marketplace (supuesto: 1 % del vendedor) y si el revendedor paga por adelantado o con crédito.
- Precios de los planes. El análisis de competencia propone USD 39, 99 y 249 al mes; los planes demo actuales están en soles (S/ 490, 1 190 y Enterprise). Decidir moneda y precio antes del lanzamiento.
- Validez legal del deslinde firmado en el móvil en cada país, y conservación de la firma (supuesto: 5 años).
- Formato exacto de importación de Contasis y Concar (por confirmar con un contador cliente).
