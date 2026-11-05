# Backlog · Fase 3 — SaaS y crecimiento

Alcance: suscripciones y facturación de plataforma, planes × reglas y entitlements, medición de uso, alta de tenant de punta a punta, API keys, webhooks y OAuth (spec 13); marketing y metas comerciales (spec 14); reseñas propias verificadas (spec 18) y reseñas externas (spec 17, parte reseñas); reportes avanzados (spec 09).
Especificaciones: `13-plataforma-saas-api.md`, `14-marketing-metas.md`, `18-resenas-propias.md`, `17-reglas-comunicaciones-monedas-resenas-integracion-web.md` (§3.7, R-REVIEW-INVITE, RV-01..03, reseñas externas), `09-administracion-reportes.md` (PROC-001 asistente, §3.16–3.17, §6.7, §7.3–7.4).
Requiere Fases 0, 1 (A y B) y 2 terminadas. Criterio de salida (03-PLAN §2): alta de un segundo tenant real de punta a punta sin intervención manual (F3-QA-03), con las suites de las especificaciones 13, 14, 17 (reseñas) y 18 en verde y la regresión E2E-01…E2E-10 intacta.

Archivo tabular equivalente: `fase-3.csv`.

## Resumen

| Épica | Nombre | Historias |
|---|---|---|
| E3.1 | Plataforma · Planes, entitlements, matriz planes × reglas y uso | 7 |
| E3.2 | Suscripción del tenant | 6 |
| E3.3 | Facturación de plataforma y cobranza | 7 |
| E3.4 | Alta de tenant de punta a punta | 2 |
| E3.5 | API pública: API keys, webhooks y OAuth | 6 |
| E3.6 | Marketing: consentimientos, segmentos, campañas y automatizaciones | 10 |
| E3.7 | Metas comerciales | 4 |
| E3.8 | Reseñas propias verificadas | 5 |
| E3.9 | Reseñas externas | 3 |
| E3.10 | Reportes avanzados | 3 |
| E3.11 | Pruebas y salida de Fase 3 | 4 |
| **Total** | | **57** |

Prioridad: P0 = imprescindible para el criterio de salida (636 h) · P1 = necesaria en la fase (288 h) · P2 = puede pasar a una fase posterior sin bloquear (24 h).

Cobertura referencial: 154 endpoints, 74 tablas citadas, 55 casos de prueba de las especificaciones.

## Cómo usar este backlog con Claude Code

1. Trabajar una historia por sesión, en el orden de dependencias (columna «Depende de»).
2. Entregar a Claude Code el bloque completo de la historia más las secciones de especificación citadas; los criterios de aceptación son la definición de «hecho» de la sesión.
3. Escribir primero las pruebas de la historia (Pest y, si tiene pantalla, Playwright) a partir de las plantillas de `kit-ia/tests/` y verlas fallar; luego el código (ver `kit-ia/tests/README.md`).
4. Cerrar la historia solo con sus pruebas en verde y la especificación actualizada si hubo cambios (sección 11 y `CHANGELOG.md`).

## Supuestos y decisiones que afectan esta fase

- Las dependencias con fases previas usan los IDs de `fase-0.md`, `fase-1a.md`, `fase-1b.md` y `fase-2.md`. F2-MOT-01 deja `plan_allows()` en verdadero: F3-PLT-03 activa la dimensión plan del `RuleResolver`.
- El catálogo de funcionalidades de 13 §3.4 (28 claves, `features` + `plan_features` con niveles + add-ons + overrides) reemplaza la matriz de 18 entitlements de 09 §3.2 creada en F0-05; la migración de F3-PLT-01 mapea los valores existentes.
- Precios, límites y matriz planes × reglas son **DEMO editables** (D-08, D-11, 13 §12-9): se siembran desde `seeds/plans.json`, `planCatalogDemo.json` y `settings.json › bookingRules[].minPlan` con `is_demo=true`.
- Pasarela de cobro recurrente y OSE de la plataforma sin definir (D-01, D-02, 13 §12-1): se construye la interfaz `PaymentGateway` con adaptador sandbox y se reutiliza el adaptador OSE de Fase 2 con credenciales del emisor Qhapaq Cloud; el adaptador real se conecta cuando se decida, sin cambiar las historias.
- Excesos de consumo (overage) no se facturan: se avisa al 80/100 % y se bloquea según `hard` (13 §12-5); `line_type usage_overage` queda previsto.
- Manager sin acceso a Suscripción ni API (13 §12-6); OAuth 2.0 queda en P2 (13 §12-7).
- «Reportes avanzados» = metas reales y rendimiento de marketing en paneles y reportes, exportación XLSX/PDF y envíos programados. Los read models `rpt_*`, los 7 reportes, la exportación CSV y los paneles ejecutivo/gerencia ya se construyen en Fase 1-B (F1B-REP-01…05, que difiere XLSX/PDF, programación y metas a esta fase).
- El asistente visual de alta de tenant (11 pasos), el cambio de plan desde consola y la salud por tenant se trasladaron a esta fase desde F0-09 (nota de `fase-0.md`).
- Proveedores de email (ESP) y WhatsApp Business sin contratar (D-03): adaptadores sandbox; la acción «Registrar respuesta de Meta» solo existe en entornos no productivos.
- Reseñas externas: fase 1 Google Business Profile, TripAdvisor y Trustpilot; Facebook, GetYourGuide y Viator como stub rotulado (D-15). Contratos y aprobaciones de API pendientes; los datos del prototipo son de ejemplo.
- Base de la meta de ventas = total con impuestos de reservas creadas en el período (14 §12-6) y sede por `branch_id` de la reserva (14 §12-8), pendientes de validación.
- Rutas Next.js de portales y consola con segmento propio (`/portal-pasajero`, `/portal-cliente`, `/plataforma`) para evitar la colisión de route groups sin segmento (ver `kit-ia/tests/e2e/support/routes.ts`).
- `kit-ia/api/ENDPOINTS.md` asigna por error permisos «público (token firmado)» y «firma Meta» a endpoints internos de Marketing (automations, consents, campaigns); la autoridad es 14 §6 (`marketing.campaigns.manage`). Además el índice omite `POST /api/v1/webhooks/payments/{gateway}`, que sí está en 13 §6 (F3-SUB-05).
- Reglas del motor citadas por plan (matriz demo): R-OWN-REVIEWS desde Professional; R-REVIEW-INVITE, R-PAY-LATER y R-PAY-FEE desde Enterprise.

## Fuera de alcance de esta fase

- Facturación por excesos de consumo y precios en USD para agencias exportadoras (13 §12-2, §12-5).
- Atribución multi-touch y aprobación de metas por el Tenant Admin en la bandeja de aprobaciones (14 §12-4, §12-9).
- Conectores reales de Facebook, GetYourGuide y Viator; traducción automática de reseñas y votos «útil» públicos (18 §12).
- Pantalla de reseña en la app React Native del pasajero: usa los mismos endpoints de F3-RVP-02; su UI queda para el backlog de apps.
- CMS avanzado: 03-PLAN lo menciona en Fase 3, pero el mapa de fases del kit no lo incluye; se mantiene lo construido en Fase 2.
- IA, scoring, OTA/GDS, marketplace y fiscal internacional (Futuro).

## Historias

### E3.1 · Plataforma · Planes, entitlements, matriz planes × reglas y uso

#### F3-PLT-01 · Catálogo comercial de planes: límites, features, add-ons y overrides

**Historia:** Como Super Admin, quiero planes con límites, funcionalidades y add-ons configurables, para vender el producto por niveles.

**Especificación:** 13 §3.1–3.5; 09 §3.1–3.3 (base creada en F0-05); D-08

**Tablas:** `plans` (amplía: `rank`, `price_month`, `price_year`, `trial_days`, `status`, `gateway_price_ids`, `price_locked_until` en suscripciones), `plan_limits`, `features`, `plan_features`, `feature_overrides`, `addons`, `addon_prices`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Migración que amplía `plans` de F0-05 con `rank` UNIQUE, `price_year` (CHECK `price_year <= price_month*12`), `trial_days` (CHECK 0–60) y `status IN (active,hidden,retired)`.
2. `plan_limits` con CHECK de `metric` (10 métricas de 13 §3.3), `value` NULL = ilimitado y `hard`; semilla con la tabla de 13 §3.3 (Starter/Professional/Enterprise).
3. `features` con las 28 claves de 13 §3.4 (`kind`, `module`, `addon_code`, `routes[]`); `plan_features.value` admite `on`/`off`/nivel (`b2b` = `basic` en Professional).
4. `feature_overrides` con UNIQUE (tenant_id, feature_key) y CHECK `valid_until <= created_at::date + 180` (PLN-BR-03).
5. `addons` (6 códigos) y `addon_prices` por plan para `extra_users`; `grants jsonb` validado.
6. PLN-BR-01: `UpdatePlanRequest` rechaza precios que no respetan el orden de `rank`.
7. Todas son tablas de plataforma: sin `tenant_id`, sin RLS, solo accesibles por la conexión `platform`.

**Pruebas:** Pest: CHECK de `price_year`, override > 180 días → error de BD; PLN-BR-01 → 422.

**Depende de:** F0-05, F0-14 · **Prioridad:** P0

#### F3-PLT-02 · `EntitlementService`, middleware `EnsureFeature` y entitlements para Next.js

**Historia:** Como plataforma, quiero resolver en backend qué funcionalidades tiene cada tenant, para bloquear lo que su plan no incluye.

**Especificación:** 13 §5 ENT-BR-01, PLN-BR-03, §7 (tres capas), §6 `GET /billing/entitlements`

**Tablas:** `plan_features`, `feature_overrides`, `subscription_items`

**Endpoints:** `GET /api/v1/billing/entitlements` (cache 5 min)

**Pantallas:** — (consumido por el menú y guards de F0-39)

**Criterios de aceptación:**

1. `EntitlementService::for($tenant)` resuelve override vigente > add-on activo disponible en el plan > `plan_features`, con el origen de cada valor (`plan`/`addon`/`override`).
2. Cache Redis `ent:{tenant_id}` TTL 10 min, invalidada por el evento `EntitlementsChanged` (cambio de plan, add-on, override, matriz).
3. Middleware `feature:{key}` en grupos de rutas → 403 `FEATURE_NOT_IN_PLAN`; los jobs llaman `$this->ensureFeature()` y se omiten sin fallo si el feature no aplica.
4. Un override con `valid_until` vencido deja de regir sin job.
5. Next.js: el menú y los guards de ruta leen `/billing/entitlements` (UX, no seguridad); pantalla de bloqueo con «Mejorar plan».
6. Perder un feature nunca borra datos: solo deshabilita acceso.

**Pruebas:** 13 §10 caso 6 (precedencia, override vencido, `feature:ecommerce` en Professional → 403).

**Depende de:** F3-PLT-01, F0-19, F0-39 · **Prioridad:** P0

#### F3-PLT-03 · Matriz planes × reglas de reserva (DEMO editable)

**Historia:** Como Super Admin, quiero definir desde qué plan está disponible cada regla del motor, para empaquetar el producto sin tocar código.

**Especificación:** 13 §3.4 v2.2 (`plan_rule_entitlements`), §5 PLN-BR-04, §6 plan-rules, §8.2 `BookingRulePlanChanged`, §11 v2.2; 17 §3.1 (`min_plan`, regla efectiva), PLN-R-01; D-11

**Tablas:** `plan_rule_entitlements`, vista `plan_rules_v`, `sys_booking_rules.min_plan`, `sys_booking_rule_catalog.min_plan`

**Endpoints:** `GET /api/v1/platform/plan-rules`, `PUT /api/v1/platform/plan-rules/{rule_code}` (If-Match; `?dry_run=1`), `POST /api/v1/platform/plan-rules/reset-demo` (Idempotency-Key), `GET /api/v1/billing/plan-rules` (cache 5 min)

**Pantallas:** —

**Criterios de aceptación:**

1. Se modela como «plan mínimo» por regla (PK `rule_code`, CHECK `min_plan IN (Starter,Professional,Enterprise)`, `is_demo=true`); semilla = matriz demo de `seeds/settings.json` (Starter 15, Professional +14, Enterprise +3).
2. `RuleResolver::on()` (F1A-MOT-01) pasa a evaluar `enabled ∧ plan_allows(code, tenant.plan) ∧ ¬override_producto`; fuera del plan la configuración (`enabled`, `params`) se conserva.
3. `PATCH /admin/booking-rules/{code}` con `enabled=true` de una regla fuera del plan → 403 `RULE_NOT_IN_PLAN`.
4. `PUT /platform/plan-rules/{code}` devuelve `affected_tenants[]` (ganan/pierden); con `dry_run=1` no persiste; audita `cambiar_plan_minimo` con antes/después y conteos.
5. `BookingRulePlanChanged` refresca `sys_booking_rules.min_plan` de todos los tenants, invalida `rules:{tenant}` y notifica `plan.cambio_reglas` a los afectados.
6. `GET /billing/plan-rules` devuelve reglas incluidas, bloqueadas (con plan mínimo) y lo que suma cada upgrade.

**Pruebas:** Pest `Unit/Booking/BookingEngineQuoteTest.php` (plan Starter: R-LODGING y R-ADDONS sin efecto; Professional los recupera) y `Feature/Booking/BookingRulesToggleTest.php` (403 `RULE_NOT_IN_PLAN`, configuración conservada).

**Depende de:** F3-PLT-02, F1A-MOT-01, F1A-MOT-06 · **Prioridad:** P0

#### F3-PLT-04 · Medición de uso: contadores Redis, consolidación diaria y límites duros

**Historia:** Como plataforma, quiero medir el consumo de cada tenant, para aplicar límites y avisar antes de bloquear.

**Especificación:** 13 §3.10, §5 SUB-BR-04/05, §8.2 `usage:consolidate`, §8.3

**Tablas:** `usage_counters` (particionada por mes), `usage_monthly`, `usage_events` (fallback)

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `INCRBY usage:{t}:{metric}:{yyyymmdd}` en listeners de `ReservationCreated`, `NotificationSent{channel}` y middleware de API; si Redis falla se escribe en `usage_events`.
2. Job `usage:consolidate` (cola `reports`, 00:15): UPSERT idempotente en `usage_counters`, recálculo de `usage_monthly`, snapshot de gauges (usuarios facturables, sedes, `SUM(size)` de `sys_documents`) y purga de claves > 2 días.
3. Avisos `uso.aviso_80` y `uso.aviso_100` una vez por métrica y mes (`alert_*_sent_at`).
4. Límites `hard`: crear usuario/sede sobre el límite → 422 `PLAN_LIMIT_REACHED` (con `SELECT … FOR UPDATE` en `tenants`); WhatsApp/email al 100 % se encolan diferidos; reservas solo avisan (límite `soft`).
5. Usuarios facturables = activos internos + guía/conductor; roles de portal no consumen licencia (supuesto 13 §12-4).

**Pruebas:** 13 §10 casos 7 (usuario 6 en Starter → 422) y 11 (UPSERT idempotente, aviso 80 % una vez).

**Depende de:** F3-PLT-01, F0-28, F0-29 · **Prioridad:** P0

#### F3-PLT-05 · Consumo del tenant y uso por tenant en consola

**Historia:** Como Tenant Admin y como Super Admin, quiero ver el consumo frente a los límites, para anticipar un cambio de plan.

**Especificación:** 13 §2 (`suscripcion/historial`, `plataforma/uso`), §6

**Tablas:** `usage_monthly`, `plan_limits`

**Endpoints:** `GET /api/v1/billing/usage?month=`, `GET /api/v1/platform/usage?filter[plan]=`

**Pantallas:** `/admin/suscripcion/historial`, `/plataforma/facturacion/uso`

**Criterios de aceptación:**

1. `/billing/usage` devuelve consumo vs límite efectivo (plan + add-ons) por métrica y mes.
2. `/platform/usage` lista solo contadores agregados por tenant con el % del límite más consumido; nunca datos comerciales (13 §2 restricción).
3. Pantallas con medidores al 80/100 % y tabla mensual; sin scroll horizontal a 400 px.

**Pruebas:** Pest: Super Admin no recibe campos comerciales; Tenant Admin solo su tenant. Playwright PW-SUB-01 (avisos 83 % WhatsApp y 85 % API).

**Depende de:** F3-PLT-04, F3-SUB-06 · **Prioridad:** P1

#### F3-PLT-06 · Consola Super Admin: catálogo de planes, matriz planes × reglas y feature flags

**Historia:** Como Super Admin, quiero editar precios, límites, matriz de reglas y flags por plan con excepciones por tenant, para ajustar la oferta comercial sin despliegues.

**Especificación:** 13 §2 (`plataforma/planes`, `plataforma/flags`), §5 PLN-BR-01/02/03/04, §6 plans/features/feature-overrides/plan-rules, §11 v2.2

**Tablas:** `plans`, `plan_limits`, `plan_features`, `feature_overrides`, `plan_rule_entitlements`, `subscriptions.price_locked_until`

**Endpoints:** `GET /api/v1/platform/plans/{code}`, `PATCH /api/v1/platform/plans/{code}`, `GET /api/v1/platform/features/{key}/plans/{plan}`, `PUT /api/v1/platform/features/{key}/plans/{plan}`, `GET /api/v1/platform/feature-overrides`, `POST /api/v1/platform/feature-overrides`, `DELETE /api/v1/platform/feature-overrides`

**Pantallas:** `/plataforma/facturacion/planes`, `/plataforma/facturacion/flags`

**Criterios de aceptación:**

1. Catálogo de planes rotulado «Demo — editable»: precio mensual/anual, días de prueba y límites; PLN-BR-01 validado.
2. Cambio de precio: aplica a nuevas suscripciones de inmediato y a las existentes desde la renovación con aviso de 30 días (`plan.cambio_condiciones`; `price_locked_until`) (PLN-BR-02).
3. Tarjeta «Planes × reglas de reserva» agrupada como el centro de reglas (8 grupos, 32 reglas) con un radio por plan, conteo por plan y «Tenants con acceso»; confirmación con la lista de tenants que ganan/pierden (`dry_run`) y «Restablecer matriz demo».
4. Matriz de feature flags por plan y overrides por tenant con motivo y vigencia ≤ 180 días; cada cambio invalida `ent:*`.
5. Auditoría `editar_plan`, `plan_entitlement`, `override`, `quitar_override`, `cambiar_plan_minimo`, `restablecer_demo`.

**Pruebas:** Playwright PW-PLAT-01 (habilita e-commerce en Professional). Pest: override de 181 días → 422; PUT de flag invalida la caché del tenant afectado.

**Depende de:** F3-PLT-03, F0-14 · **Prioridad:** P0

#### F3-PLT-07 · Centro de reglas por plan: candado, «Previsualizar como plan» y simulador

**Historia:** Como Tenant Admin, quiero ver qué reglas no incluye mi plan y simular cómo quedaría con otro plan, para decidir si mejorar.

**Especificación:** 17 §2 (`admin/reglas` v2.2), §3.1 (regla efectiva), §6 `GET /admin/booking-rules?plan=`, PLN-R-01

**Tablas:** `sys_booking_rules`

**Endpoints:** `GET /api/v1/admin/booking-rules?plan=Starter`, `POST /api/v1/admin/booking-rules/simulate`

**Pantallas:** `/admin/reglas` (pestañas Reglas y Simulador)

**Criterios de aceptación:**

1. Rótulo «Desde plan X»; fuera del plan: candado, «Disponible desde el plan X» y botón «Mejorar plan» (lleva a `/admin/suscripcion` con el plan preseleccionado); interruptor deshabilitado.
2. «Previsualizar como plan…» calcula `effective` con el plan indicado sin cambiar la suscripción (solo visual).
3. Simulador con «Plan a simular»: `BookingEngine::quote` con el `RuleSet` del plan elegido; muestra el estado de cada regla para el producto.

**Pruebas:** Pest: `GET ?plan=Starter` marca R-LODGING `effective=false` sin tocar `enabled`. Playwright: TNT-0001 (Enterprise) previsualiza Starter y ve el candado en R-LODGING.

**Depende de:** F3-PLT-03, F2-MOT-03 · **Prioridad:** P1

### E3.2 · Suscripción del tenant

#### F3-SUB-01 · Modelo de suscripción y máquina de estados

**Historia:** Como plataforma, quiero una suscripción viva por tenant con su ciclo de vida, para cobrar y aplicar el plan correcto.

**Especificación:** 13 §3.6, §3.7, §4.1; 09 §3.4 (`tenants.status`)

**Tablas:** `subscriptions`, `subscription_items`, `subscription_changes`, `payment_methods`

**Endpoints:** `GET /api/v1/billing/subscription`

**Pantallas:** —

**Criterios de aceptación:**

1. Migraciones con CHECK de `status` (6 estados), `cycle`, `billing_ruc` (`^(10|15|17|20)\d{9}$`), `trial_extended_days <= 14`, `current_period_end > current_period_start`, `lock_version`.
2. UNIQUE parcial una suscripción viva por tenant (`WHERE status <> 'canceled'`); un solo `subscription_changes` `scheduled` por suscripción; `payment_methods` UNIQUE (tenant_id) WHERE `is_default`, solo token de pasarela (PCI SAQ-A).
3. `SubscriptionStateMachine` con las transiciones de 13 §4.1; transición inválida → 409.
4. `ProvisionTenant` (F0-09) crea la suscripción en `trialing` con `trial_ends_at = hoy + plan.trial_days`; la migración de datos crea la suscripción de los tenants existentes (TNT-0001 Enterprise; TNT-0004 con precio pactado).
5. `tenants.status` se sincroniza con la suscripción (`suspended` ↔ `suspendido`).

**Pruebas:** Pest: transiciones válidas/ inválidas; UNIQUE parcial; aislamiento (`/billing/*` solo devuelve la suscripción del tenant del token).

**Depende de:** F3-PLT-01, F0-09 · **Prioridad:** P0

#### F3-SUB-02 · Cambio de plan con prorrateo: upgrade inmediato y downgrade programado

**Historia:** Como Tenant Admin, quiero cambiar de plan o de ciclo viendo el costo exacto y los bloqueos, para decidir sin sorpresas.

**Especificación:** 13 §5 SUB-BR-01/02/03, §6 preview-change/change/scheduled-change, §8.2 `billing:renewals` (revalidación)

**Tablas:** `subscriptions`, `subscription_changes`, `platform_invoices`

**Endpoints:** `POST /api/v1/billing/subscription/preview-change`, `POST /api/v1/billing/subscription/change` (Idempotency-Key + If-Match), `DELETE /api/v1/billing/subscription/scheduled-change` (If-Match)

**Pantallas:** —

**Criterios de aceptación:**

1. `ProrationCalculator` (unit): upgrade = `precio_nuevo × días_restantes/días_periodo − crédito`; mensual→anual inicia periodo de 12 meses; neto negativo va a `credit_balance`; redondeo HALF_UP a 2 decimales con brick/math.
2. `preview-change` devuelve `{kind, proration, blockers[]}` y las reglas que se habilitan o dejan de aplicar (usa F3-PLT-03).
3. Upgrade: factura de prorrateo cobrada al instante (F3-BIL-02); downgrade: `subscription_changes.scheduled` con `effective_at` = fin de periodo + 1, sin reembolso.
4. `DowngradeValidator`: consumo sobre límites del destino o módulos en uso no incluidos → 422 `SUB_DOWNGRADE_BLOCKED` con la lista; se revalida al aplicarlo en la renovación.
5. Audita `cambio_plan`, `cambio_plan_programado`, `downgrade_bloqueado`, `anular_cambio_programado`; emite `EntitlementsChanged`.

**Pruebas:** 13 §10 casos 1 (Enterprise mensual→anual: cargo 28 900, crédito 385.33, neto 28 514.67, total con IGV 33 647.31) y 2 (downgrade con 3 sedes y 38.2 GB → 422 con ≥ 2 bloqueos).

**Depende de:** F3-SUB-01, F3-BIL-01 · **Prioridad:** P0

#### F3-SUB-03 · Add-ons y cupones

**Historia:** Como Tenant Admin, quiero contratar paquetes y canjear cupones, para ajustar el plan a mi operación.

**Especificación:** 13 §3.5, §3.9, §5 SUB-BR-06/07/08, §6 addons y coupon

**Tablas:** `subscription_items`, `addons`, `addon_prices`, `coupons`, `coupon_redemptions`

**Endpoints:** `POST /api/v1/billing/addons/{code}` (Idempotency-Key), `PATCH /api/v1/billing/addons/{code}` (Idempotency-Key), `DELETE /api/v1/billing/addons/{code}` (Idempotency-Key), `POST /api/v1/billing/coupon`

**Pantallas:** —

**Criterios de aceptación:**

1. Contratar/ajustar add-on genera prorrateo; no se reduce por debajo de lo consumido en el periodo (SUB-BR-06); el retiro queda vigente hasta fin de periodo (`ends_at`).
2. Cupón: activo, vigente, con canjes, aplicable al plan y no acumulable; canje con `lockForUpdate` sobre `coupons`; CHECK `redeemed_count <= max_redemptions` y porcentual ≤ 50 % (SUB-BR-08).
3. Errores 422 `COUPON_INVALID` con motivo (`vencido`, `agotado`, `plan`, `acumulado`).
4. Audita `addon_contratar/ajustar/retirar/mantener`, `cupon_aplicar`, `cupon_rechazado`; emite `EntitlementsChanged` cuando el add-on otorga un feature.

**Pruebas:** 13 §10 caso 5 (cupón vencido/agotado/de otro plan/acumulado → 422; 2 canjes simultáneos del último cupo → 1 prospera). Playwright PW-SUB-02 (almacenamiento +50 GB).

**Depende de:** F3-SUB-02 · **Prioridad:** P1

#### F3-SUB-04 · Cancelación con encuesta, reanudación y datos de facturación

**Historia:** Como Tenant Admin, quiero cancelar al fin del periodo o reanudar, y mantener mis datos de facturación, para controlar la relación con la plataforma.

**Especificación:** 13 §4.1 (cancel_scheduled), §5 SUB-BR-09/11, §6 cancel/resume/PATCH

**Tablas:** `subscriptions` (`cancel_at`, `cancel_survey`, `auto_renew`, `billing_*`)

**Endpoints:** `POST /api/v1/billing/subscription/cancel` (If-Match), `POST /api/v1/billing/subscription/resume` (If-Match), `PATCH /api/v1/billing/subscription` (If-Match)

**Pantallas:** —

**Criterios de aceptación:**

1. Cancelar exige encuesta (motivo obligatorio) y aceptación de condiciones de cierre; queda `cancel_scheduled` con `auto_renew=false` y `cancel_at` = fin de periodo.
2. Reanudar antes de `cancel_at` vuelve a `active`.
3. RUC validado; los datos de facturación se copian a `bill_to` al emitir y las facturas emitidas no cambian (SUB-BR-09).
4. Notificaciones `suscripcion.cancelacion` (tenant y ops@) y `suscripcion.reanudada`; auditoría `cancelar`, `reanudar`, `datos_facturacion`.

**Pruebas:** Pest: cancelar sin motivo → 422; reanudar después de `cancel_at` → 409. Playwright PW-SUB-02 (banner «Cancelación programada» → reanudar).

**Depende de:** F3-SUB-01 · **Prioridad:** P1

#### F3-SUB-05 · Método de pago tokenizado y webhook entrante de la pasarela

**Historia:** Como Tenant Admin, quiero registrar una tarjeta sin que la plataforma guarde sus datos, para que la renovación se cobre sola.

**Especificación:** 13 §3.7, §6 payment-methods y `webhooks/payments/{gateway}`, §8.1 (opción A Cashier / opción B pasarela local); D-02, INT-02

**Tablas:** `payment_methods`, `payment_attempts`

**Endpoints:** `POST /api/v1/billing/payment-methods/setup-intent`, `PUT /api/v1/billing/payment-methods/default` (Idempotency-Key), `POST /api/v1/webhooks/payments/{gateway}` (firma de la pasarela; idempotente por event id)

**Pantallas:** `/admin/suscripcion/pago`

**Criterios de aceptación:**

1. Reutiliza la interfaz `PaymentGateway` y los adaptadores de F1B-POR-04/F2-WEB-08; agrega cobro recurrente con token (`createSetupIntent`, `charge` sin presencia del titular) con credenciales del comercio de la plataforma, no del tenant.
2. Formulario embebido (iframe de la pasarela); en BD solo `gateway_token`, `brand`, `last4`, vencimiento; nunca PAN ni CVV; auditoría solo con •••• last4.
3. Webhook entrante verifica firma, deduplica por id de evento y actualiza `payment_attempts`/factura.
4. Datos de facturación editables en la misma pantalla (F3-SUB-04).

**Pruebas:** Pest: webhook con firma inválida → 401; mismo evento dos veces → un solo efecto; el token nunca aparece en logs (máscara).

**Depende de:** F3-SUB-01, F1B-POR-04, F2-WEB-08 · **Prioridad:** P0

#### F3-SUB-06 · Pantalla Suscripción: plan, consumo, «Qué incluye su plan» y cambio de plan

**Historia:** Como Tenant Admin, quiero ver y gestionar mi plan en una sola pantalla, para entender qué tengo y qué gano al mejorar.

**Especificación:** 13 §2 (`#/admin/suscripcion`, v2.2), §11 v2.2

**Tablas:** —

**Endpoints:** `GET /api/v1/billing/subscription`, `GET /api/v1/billing/usage`, `GET /api/v1/billing/plan-rules`, `POST /api/v1/billing/subscription/preview-change`

**Pantallas:** `/admin/suscripcion`

**Criterios de aceptación:**

1. KPIs (plan, renovación, próximo cargo, tarjeta), medidores al 80/100 %, módulos con su origen (plan/add-on/override).
2. Sección «Qué incluye su plan» (reglas incluidas por grupo; no incluidas con candado y plan mínimo) y comparativo de planes con «Mejorar a X» que abre el cambio preseleccionado.
3. Modal de cambio con prorrateo, bloqueos y reglas que se habilitan o dejan de aplicar; cupón; cancelación con encuesta.
4. Solo `admin.billing.manage` (Tenant Admin); Manager recibe 403 (supuesto 13 §12-6).

**Pruebas:** Playwright PW-SUB-01 y PW-SUB-02; `rbac-403.spec.ts` (Manager → `/admin/suscripcion` 403).

**Depende de:** F3-SUB-02, F3-SUB-03, F3-SUB-04, F3-PLT-03 · **Prioridad:** P0

### E3.3 · Facturación de plataforma y cobranza

#### F3-BIL-01 · Facturas de plataforma, notas de crédito, intentos de cobro y correlativos

**Historia:** Como plataforma (Qhapaq Cloud S.A.C.), quiero emitir facturas y notas de crédito a cada tenant con numeración propia, para cobrar la suscripción con respaldo tributario.

**Especificación:** 13 §3.8, §4.2, §8.1

**Tablas:** `platform_invoices`, `platform_invoice_lines`, `platform_credit_notes`, `payment_attempts`, `platform_sequences`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Migraciones con CHECK `total = subtotal + igv`, `status` (6 estados), `kind`, `sunat_status`, UNIQUE (series, number); `platform_sequences` con `SELECT … FOR UPDATE` para `FQ01` y `NQ01`.
2. `bill_to jsonb` snapshot e `igv_pct` 18.00 al emitir; líneas con `line_type` (plan, addon, prorrateo, descuento, `usage_overage` previsto).
3. `PlatformInvoiceStateMachine`: `draft → open → paid`; `open → failed → paid|uncollectible`; cualquiera ≠ `void` → `void` con nota de crédito; `paid → void` pide reembolso.
4. `payment_attempts.idempotency_key` UNIQUE (`inv:{id}:attempt:{n}`).
5. Migración de las 28 facturas demo de `seeds/platformInvoices.json`.

**Pruebas:** Pest unit: máquina de estados; CHECK de totales; correlativo sin huecos con 2 emisiones concurrentes.

**Depende de:** F3-SUB-01, F0-25 · **Prioridad:** P0

#### F3-BIL-02 · Renovación automática y cobro idempotente

**Historia:** Como plataforma, quiero renovar y cobrar cada periodo sin intervención manual, para no perder ingresos ni cobrar dos veces.

**Especificación:** 13 §5 SUB-BR-12, §8.2 `billing:renewals` y `ChargeInvoiceJob`

**Tablas:** `subscriptions`, `subscription_changes`, `platform_invoices`, `payment_attempts`, `coupon_redemptions`

**Endpoints:** `POST /api/v1/billing/invoices/{number}/pay` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. `billing:renewals` (cola `critical`, 06:00, `ShouldBeUnique` por suscripción): aplica el cambio programado (revalida SUB-BR-03; si falla, no lo aplica y notifica), aplica cupón (`remaining_cycles`), genera factura, encola `ChargeInvoiceJob`, avanza el periodo y procesa `cancel_scheduled → canceled`.
2. `ChargeInvoiceJob`: Idempotency-Key `inv:{id}:attempt:{n}` hacia la pasarela, registra `payment_attempt`; aprobado → `paid`; rechazado → `failed` e inicio de dunning.
3. `POST /billing/invoices/{number}/pay` con la misma Idempotency-Key → un solo cargo y un solo `payment_attempt` (doble clic).
4. Precio pactado por suscripción (p. ej. TNT-0004) y grandfathering `price_locked_until` (PLN-BR-02).

**Pruebas:** 13 §10 caso 4 (idempotencia de pago).

**Depende de:** F3-BIL-01, F3-SUB-05 · **Prioridad:** P0

#### F3-BIL-03 · Dunning 1/3/7, suspensión automática y reactivación

**Historia:** Como Super Admin, quiero reintentos de cobro programados y suspensión automática por impago, para reducir la morosidad sin perder datos del tenant.

**Especificación:** 13 §4.3, §8.2 `billing:dunning`, §6 dunning-policy/retry/manual-payment/extend, §4.1 (past_due, suspended); 09 TEN-BR-10

**Tablas:** `platform_invoices` (`dunning_*`), `payment_attempts`, `subscriptions`, `tenants`

**Endpoints:** `GET /api/v1/platform/dunning-policy`, `PATCH /api/v1/platform/dunning-policy`, `POST /api/v1/platform/invoices/{id}/retry` (Idempotency-Key), `POST /api/v1/platform/invoices/{id}/manual-payment` (Idempotency-Key), `POST /api/v1/platform/invoices/{id}/dunning/extend`

**Pantallas:** —

**Criterios de aceptación:**

1. `billing:dunning` (10:00, `Cache::lock('dunning:'.$id)`): reintenta facturas `failed` con `dunning_next_retry_at <= now()`, reprograma según `retry_days` (1, 3, 7) + prórroga, envía `plataforma.cobro_fallido`.
2. Tras el último rechazo: factura `uncollectible`, suscripción `suspended`, `tenants.status = suspendido`; login bloqueado (403 `TENANT_SUSPENDED`), datos intactos.
3. El reintento manual no mueve el calendario; la prórroga suma 7 días al último reintento.
4. Pago manual (transferencia) reactiva el tenant si no queda deuda.
5. Mientras la suscripción esté `suspended`, toda ruta distinta de `/billing/*` y login responde 402 `PAYMENT_REQUIRED`; banner en Next.js para `past_due`.

**Pruebas:** 13 §10 caso 3 (falla 26/09 → reintentos 27/09, 29/09 y 03/10; el tercero suspende; pago manual reactiva; retry manual no altera `dunning_next_retry_at`).

**Depende de:** F3-BIL-02, F0-10 · **Prioridad:** P0

#### F3-BIL-04 · Emisión electrónica de facturas y notas de crédito de la plataforma

**Historia:** Como plataforma, quiero emitir los comprobantes FQ01/NQ01 por OSE, para cumplir con SUNAT sin bloquear el cobro.

**Especificación:** 13 §8.1 (factura de la plataforma), §8.2 `EmitPlatformInvoiceJob`/`EmitCreditNoteJob`, §6 void; 09 PROC-064/065

**Tablas:** `platform_invoices` (`sunat_*`, `pdf_path`, `xml_path`), `platform_credit_notes`

**Endpoints:** `POST /api/v1/platform/invoices/{id}/void` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. Jobs en cola `documents`: XML UBL 2.1 → OSE → CDR → PDF en S3 `platform/invoices/{yyyy}/{series-number}.*`; reintentos con backoff (PROC-065).
2. Con la OSE caída la factura queda `sunat_status=pending` y el cobro no se bloquea.
3. Anular: nota de crédito `NQ01` vinculada (UNIQUE `invoice_id`) y reembolso a la pasarela si estaba pagada.
4. Reutiliza el adaptador OSE de Fase 2 con las credenciales del emisor de plataforma (supuesto: mismo proveedor que los tenants; D-01).

**Pruebas:** 13 §10 caso 12 (OSE caída → reintentos, `pending` sin bloquear el cobro).

**Depende de:** F3-BIL-01, F2-FIS-04 · **Prioridad:** P1

#### F3-BIL-05 · Facturas del tenant en su consola

**Historia:** Como Tenant Admin, quiero ver, descargar y pagar mis facturas de la plataforma, para mantener la cuenta al día.

**Especificación:** 13 §2 (`suscripcion/facturas`), §6 invoices

**Tablas:** `platform_invoices`, `platform_invoice_lines`

**Endpoints:** `GET /api/v1/billing/invoices`, `GET /api/v1/billing/invoices/{number}`, `GET /api/v1/billing/invoices/{number}/pdf`, `POST /api/v1/billing/invoices/{number}/pay` (Idempotency-Key)

**Pantallas:** `/admin/suscripcion/facturas`

**Criterios de aceptación:**

1. Listado de facturas del tenant autenticado (nunca de otros; tablas de plataforma filtradas por `BillingService`).
2. PDF por URL firmada temporal; «Pagar ahora» con la tarjeta registrada; «Reenviar por correo».
3. Estados en español (`pagada`, `pendiente`, `fallida`, `vencida`, `anulada`) mapeados desde el dominio.

**Pruebas:** Pest: tenant A no lista facturas de B; PDF solo con URL firmada. Playwright PW-SUB-01 (factura FQ01 tras pasar a anual).

**Depende de:** F3-BIL-02 · **Prioridad:** P1

#### F3-BIL-06 · Consola de facturación de plataforma: facturas, cobranza, trials y cupones

**Historia:** Como Super Admin, quiero operar la cobranza de todos los tenants desde una consola, para resolver impagos, trials y promociones.

**Especificación:** 13 §2 (`plataforma/facturas`, `cobranza`, `trials`, `cupones`), §4.1 trialing, §5 SUB-BR-07/08/10, §8.2 `billing:trials`

**Tablas:** `platform_invoices`, `coupons`, `subscriptions`

**Endpoints:** `GET /api/v1/platform/invoices`, `GET /api/v1/platform/trials`, `POST /api/v1/platform/trials`, `POST /api/v1/platform/trials/{tenant}/extend`, `POST /api/v1/platform/trials/{tenant}/convert` (Idempotency-Key), `GET /api/v1/platform/coupons`, `POST /api/v1/platform/coupons`, `PATCH /api/v1/platform/coupons`

**Pantallas:** `/plataforma/facturacion/facturas`, `/plataforma/facturacion/cobranza`, `/plataforma/facturacion/trials`, `/plataforma/facturacion/cupones`

**Criterios de aceptación:**

1. Facturas de todos los tenants con filtros (tenant, estado, periodo); reintentar, pago manual, anular con NC.
2. Cobranza: calendario D+1/D+3/D+7, reintentar ahora, enlace de pago, prórroga, suspender; editar política; «Ejecutar el job» audita `billing:dunning ejecutar`.
3. Trials: avisos a 7/3/1 días (`billing:trials`, 08:00), extender 7 días (máx. 14 acumulados, SUB-BR-10) y convertir con cupón; al vencer sin método de pago → `suspended` (solo lectura 7 días) y luego `canceled`.
4. Cupones: crear (código `^[A-Z0-9_-]{4,20}$`, % ≤ 50), activar, desactivar, canjes frente al máximo.
5. El Super Admin no ve datos comerciales de los tenants.

**Pruebas:** Playwright PW-PLAT-01 (job de cobranza reprograma TNT-0004 al 03/10; extiende y convierte TNT-0005; cupón VERANO27 60 % rechazado y 25 % aceptado).

**Depende de:** F3-BIL-03, F3-SUB-03 · **Prioridad:** P0

#### F3-BIL-07 · Métricas SaaS: MRR, ARR, ARPA y churn

**Historia:** Como Super Admin, quiero métricas diarias del negocio SaaS, para seguir crecimiento y bajas.

**Especificación:** 13 §2 (`#/admin/plataforma`), §8.2 `platform:metrics-snapshot`, §6 metrics

**Tablas:** `platform_metrics_daily`

**Endpoints:** `GET /api/v1/platform/metrics?from=&to=`

**Pantallas:** `/plataforma/facturacion`

**Criterios de aceptación:**

1. Job diario 01:00: MRR = Σ suscripciones activas (precio mensualizado + add-ons − cupón); ARR = MRR × 12; ARPA; altas, bajas, logo churn y revenue churn (90 días).
2. Semilla histórica desde `seeds/platformMetrics.json`.
3. Pantalla con KPIs, evolución de MRR, altas/bajas, MRR por plan, cobros fallidos y eventos del ciclo de vida (gráficos con los tokens del prototipo).

**Pruebas:** Pest: snapshot idempotente por día; suscripción `trialing` no suma MRR.

**Depende de:** F3-BIL-02 · **Prioridad:** P1

### E3.4 · Alta de tenant de punta a punta

#### F3-TEN-01 · Asistente visual de alta de tenant (11 pasos) integrado con la suscripción

**Historia:** Como Super Admin, quiero dar de alta una agencia paso a paso con validación en línea, para que quede operativa sin soporte técnico.

**Especificación:** 09 §1 PROC-001, §2 (`admin/tenants/nuevo`), §5 TEN-BR-01..06/12, §6.1; 13 §4.1 (alta → trialing)

**Tablas:** `tenants`, `tenant_onboarding`, `subscriptions`

**Endpoints:** `POST /api/v1/platform/tenants/validate-step`, `POST /api/v1/platform/tenants` (Idempotency-Key), `GET /api/v1/platform/plans`

**Pantallas:** `/plataforma/tenants/new`

**Criterios de aceptación:**

1. 11 pasos en el orden del prototipo con validación por paso (`validate-step`) y revisión final con checklist de controles.
2. El alta usa `ProvisionTenant` (F0-09) y además crea la suscripción `trialing` o `active` según el plan y ciclo elegidos (F3-SUB-01).
3. Canales fuera del plan quedan bloqueados (TEN-BR-06); rol Tenant Admin siempre incluido (TEN-BR-04).
4. Al terminar: tenant visible «En prueba», invitación enviada al administrador, auditoría `alta`.

**Pruebas:** 09 Playwright (asistente completo → tenant «En prueba»); T-03, T-04.

**Depende de:** F0-09, F3-SUB-01, F0-39 · **Prioridad:** P0

#### F3-TEN-02 · Cambio de plan desde la consola y salud por tenant

**Historia:** Como Super Admin, quiero cambiar el plan de un tenant y ver su salud técnica, para dar soporte sin entrar a sus datos.

**Especificación:** 09 §6.1 (change-plan, health), §5 TEN-BR-09; 13 §5 SUB-BR-02/03

**Tablas:** `tenants`, `subscriptions`, `subscription_changes`, `sys_job_runs`, `integration_errors`

**Endpoints:** `POST /api/v1/platform/tenants/{id}/change-plan` (If-Match), `GET /api/v1/platform/tenants/health`

**Pantallas:** `/plataforma/tenants/[id]`, `/plataforma/integraciones`

**Criterios de aceptación:**

1. `change-plan` reutiliza `ChangePlanService` (misma lógica que el tenant: prorrateo, bloqueos TEN-BR-09/SUB-BR-03) con `effective: immediate|next_cycle`.
2. Salud por tenant: plan, estado, integraciones, jobs, errores abiertos y último heartbeat (solo metadatos técnicos).
3. Drawer del tenant con consumo, entitlements y overrides vigentes.

**Pruebas:** T-07 (downgrade a Starter con 9 usuarios → 409).

**Depende de:** F3-TEN-01, F3-SUB-02 · **Prioridad:** P1

### E3.5 · API pública: API keys, webhooks y OAuth

#### F3-API-01 · API keys del tenant: emisión, hash, scopes, IP allowlist y revocación

**Historia:** Como Tenant Admin, quiero crear claves de API con permisos acotados, para integrar mis sistemas de forma segura.

**Especificación:** 13 §3.11, §4.4, §5 API-BR-01/02/03, §6 api-keys, §8.2 `api-keys:expire`

**Tablas:** `integration_api_keys`

**Endpoints:** `GET /api/v1/integrations/api-keys`, `POST /api/v1/integrations/api-keys`, `DELETE /api/v1/integrations/api-keys/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. Token `qts_{env}_` + 32 base62 mostrado una sola vez (solo en la respuesta 201); en BD `prefix` (13 car., UNIQUE global), `last4` y `token_hash` SHA-256.
2. Guard `api-key` (Bearer) que autentica al **tenant** (no a un usuario) y fija `app.tenant_id`; middleware `scope:x` por ruta (catálogo de scopes con CHECK `scopes <@ ARRAY[...]`).
3. IP allowlist opcional (`cidr[]`); key vencida o revocada → 401 inmediato (se invalida la caché de autenticación); sin scope → 403; IP fuera → 403.
4. Máximo de keys activas según `plan_limits.api_keys` (API-BR-02); entitlement `api_access`.
5. `last_used_at`/IP escritos como máximo cada 60 s (`SET NX EX 60`); job diario expira y avisa 7 días antes.
6. Revocar exige `reason`; el token y los secretos nunca se auditan ni se registran en logs.

**Pruebas:** 13 §10 caso 8 (token solo en 201, hash en BD, revocada → 401, sin scope → 403, IP fuera → 403, key de A no lee datos de B).

**Depende de:** F3-PLT-02, F0-06, F0-24 · **Prioridad:** P0

#### F3-API-02 · Rate limit por API key, cuota mensual y cabeceras

**Historia:** Como plataforma, quiero limitar el uso de la API por clave y por plan, para proteger el servicio y cobrar por nivel.

**Especificación:** 13 §5 SUB-BR-04 (API), §8.3; 13 §2 (`api/limites`)

**Tablas:** `usage_counters` (métrica `api_calls_month`)

**Endpoints:** — (middleware sobre todas las rutas con guard `api-key`)

**Pantallas:** `/admin/api/limites`

**Criterios de aceptación:**

1. `RateLimiter::for('api-key')` con `Limit::perMinute(api_rate_per_min)` por key + ráfaga `perSecond(ceil(rate/6))`, ventana deslizante `rl:{tenant}:{key}`.
2. Cuota mensual `api_calls_month` → 429 `QUOTA_EXCEEDED`; exceso de rate → 429 `RATE_LIMITED`; ambos con `Retry-After`.
3. Cabeceras `X-RateLimit-Limit/Remaining/Reset`, `X-Quota-Limit/Remaining`.
4. Conteo de 429 por key y día (`apikey:{id}:429:{yyyymmdd}`) para la pantalla de límites.

**Pruebas:** 13 §10 caso 7 (cuota al 100 % → 429 `QUOTA_EXCEEDED`; rate por minuto → 429 con `Retry-After`).

**Depende de:** F3-API-01, F3-PLT-04 · **Prioridad:** P0

#### F3-API-03 · Webhooks salientes: registro, anti-SSRF, rotación de secreto y ping

**Historia:** Como Tenant Admin, quiero suscribir URLs a eventos de mi cuenta, para que mis sistemas reaccionen sin consultar la API.

**Especificación:** 13 §3.12, §4.5, §5 API-BR-04..08, §6 webhooks

**Tablas:** `integration_webhooks`

**Endpoints:** `GET /api/v1/integrations/webhooks`, `POST /api/v1/integrations/webhooks`, `PATCH /api/v1/integrations/webhooks/{id}`, `DELETE /api/v1/integrations/webhooks/{id}`, `POST /api/v1/integrations/webhooks/{id}/rotate-secret`, `POST /api/v1/integrations/webhooks/{id}/ping`

**Pantallas:** —

**Criterios de aceptación:**

1. URL HTTPS obligatoria (CHECK + FormRequest); `SafeUrlValidator` resuelve DNS y rechaza loopback, RFC1918, link-local, `.local`/`.internal`; sin redirecciones.
2. Secreto cifrado (`Crypt`) mostrado solo en la respuesta 201; `secret_prefix` para mostrar; rotación con 24 h de gracia (se envían dos firmas `v1`).
3. Máximo por plan (`plan_limits.webhooks`) y entitlement `webhooks`; acepta también API key con scope `webhooks:manage`.
4. `active ⇄ paused`; cambiar la URL resetea `consecutive_failures`; `ping` síncrono; SoftDeletes.
5. `api_version` fijada por webhook (`2026-09-01`).

**Pruebas:** 13 §10 caso 9 (URL `http://` o privada → 422; firma verificable; rotación con ambas firmas durante 24 h).

**Depende de:** F3-API-01, F0-27 · **Prioridad:** P0

#### F3-API-04 · Entrega de webhooks: outbox, firma HMAC, reintentos, deshabilitación y reenvío

**Historia:** Como plataforma, quiero entregar cada evento de dominio a los webhooks suscritos con garantía y trazabilidad, para que las integraciones sean confiables.

**Especificación:** 13 §3.13, §4.5 (entrega), §8.4; 17 §8 (eventos `review.received`, `widget.checkout_started`)

**Tablas:** `integration_webhook_deliveries` (particionada por mes), `sys_outbox`

**Endpoints:** `GET /api/v1/integrations/webhook-deliveries?filter[status]=`, `POST /api/v1/integrations/webhook-deliveries/{id}/redeliver` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. `OutboxRelay` publica eventos de `sys_outbox` y, por cada webhook `active` suscrito (GIN `events @> ARRAY[type]`), crea una entrega `pending` y encola `DeliverWebhookJob` (cola `integrations`).
2. Cuerpo `{id: evt_…, type, api_version, created_at, tenant_id, data}` sin costos ni márgenes; cabeceras `Qhapaq-Signature: t=…,v1=…`, `Qhapaq-Event-Id`, `Qhapaq-Event-Type`, `Qhapaq-Delivery-Id`, `User-Agent: Qhapaq-Webhooks/1.0`.
3. Firma `hex(HMAC_SHA256(secret, t + "." + raw_body))`; timeout 10 s; SSRF revalidado en cada envío (DNS rebinding).
4. 2xx = entregado; 410 = deshabilitar; otro código o timeout → reintentos `[60, 300, 1800, 7200, 21600, 86400]` (6 intentos) → `failed`.
5. 10 fallos consecutivos → `disabled` + `webhook.deshabilitado` al Tenant Admin (API-BR-07); reenvío manual crea entrega `manual=true`.
6. `webhooks:purge` retiene 30 días (DROP PARTITION).

**Pruebas:** 13 §10 caso 9 (10 fallos → `disabled`; reenvío crea `manual=true`). Pest: el receptor puede verificar la firma con el secreto.

**Depende de:** F3-API-03, F0-27, F0-28 · **Prioridad:** P0

#### F3-API-05 · Consola de API: keys, webhooks, entregas, límites y documentación

**Historia:** Como Tenant Admin, quiero administrar mi integración desde pantallas claras, para no depender de soporte.

**Especificación:** 13 §2 (`admin/api`, `webhooks`, `entregas`, `limites`, `docs`), §7

**Tablas:** —

**Endpoints:** `GET /api/v1/docs/openapi.json` (público) y los de F3-API-01..04

**Pantallas:** `/admin/api`, `/admin/api/webhooks`, `/admin/api/entregas`, `/admin/api/limites`, `/admin/api/docs`

**Criterios de aceptación:**

1. Token y secreto visibles una sola vez con «Copiar»; la tabla muestra solo prefijo y últimos 4.
2. Log de entregas con HTTP, ms, intento y próximo reintento; detalle con headers, firma, payload y respuesta; «Reenviar».
3. Documentación: endpoints públicos, extracto OpenAPI 3.1 (dedoc/scramble) y guía de verificación de firmas (ejemplos PHP/Node).
4. Sin entitlement `api_access` la pantalla muestra el bloqueo y deshabilita «Nueva API key» (la API responde 403).
5. Solo `admin.api.manage`; Manager 403.

**Pruebas:** Playwright PW-API-01 (crear key → token una vez; webhook con URL privada → error; válido → secreto una vez; reenvíos de WH-0002 hasta deshabilitar). `rbac-403.spec.ts` (Manager → `/integrations/api-keys` 403).

**Depende de:** F3-API-02, F3-API-04 · **Prioridad:** P0

#### F3-API-06 · Aplicaciones OAuth 2.0 (Authorization Code + PKCE)

**Historia:** Como Tenant Admin de plan Enterprise, quiero registrar aplicaciones OAuth de terceros, para que integradores accedan con consentimiento y scopes.

**Especificación:** 13 §3.14, §6 oauth-apps; §12-7

**Tablas:** `oauth_clients` (Passport + `tenant_id`, RLS), `integration_oauth_apps`

**Endpoints:** `GET /api/v1/integrations/oauth-apps`, `POST /api/v1/integrations/oauth-apps`, `DELETE /api/v1/integrations/oauth-apps/{id}`, `POST /api/v1/integrations/oauth-apps/{id}/secret`

**Pantallas:** `/admin/api/oauth`

**Criterios de aceptación:**

1. Laravel Passport solo con Authorization Code + PKCE; `oauth_clients.tenant_id` con RLS.
2. Secreto visible una vez; rotación y revocación auditadas; entitlement `oauth_apps`.
3. Los tokens OAuth pasan por la misma cadena `scope:x`, rate limit y cuota que las API keys.

**Pruebas:** Pest: flujo PKCE completo en test; cliente de A no obtiene tokens para B; sin entitlement → 403.

**Depende de:** F3-API-01 · **Prioridad:** P2

### E3.6 · Marketing: consentimientos, segmentos, campañas y automatizaciones

#### F3-MKT-01 · Contactos unificados, suscriptores y consentimientos por canal

**Historia:** Como Manager, quiero registrar y consultar el consentimiento de cada contacto por canal, para enviar publicidad solo a quien la autorizó (Ley 29733).

**Especificación:** 14 §3.1–3.3, §4.2, §5 MKT-BR-01/02/11/15, §6 contacts/consents

**Tablas:** `mkt_contacts_subscribers`, `mkt_consents`, `mkt_consent_events`, vista `mkt_contacts_v`

**Endpoints:** `GET /api/v1/marketing/contacts`, `GET /api/v1/marketing/consents`, `POST /api/v1/marketing/consents`, `POST /api/v1/marketing/consents/{code}/revoke`, `GET /api/v1/marketing/consents/{code}/events`

**Pantallas:** `/marketing/campanas?tab=consentimientos` (+ drawer «Gestionar»)

**Criterios de aceptación:**

1. `mkt_consents`: UNIQUE (tenant_id, subject_type, subject_id, channel); CHECK `(status='revocado') = (revoked_at IS NOT NULL)`; `lock_version`.
2. `mkt_consent_events` append-only (trigger que rechaza UPDATE/DELETE); cada otorgamiento/baja inserta evento con origen, evidencia, actor e IP.
3. Otorgar exige origen del catálogo, evidencia y versión de política (MKT-BR-11); `revocado → otorgado` solo con un nuevo consentimiento expreso.
4. Vista `mkt_contacts_v`: clientes + leads abiertos no duplicados por email + suscriptores no vinculados (MKT-BR-15).
5. Permiso `marketing.campaigns.manage` en todos los endpoints (Tenant Admin, Manager); Ventas 403 auditado.
6. Supuesto: el índice `api/ENDPOINTS.md` marca por error estos endpoints como «público (token firmado)»; la autoridad es 14 §6.

**Pruebas:** 14 §10 casos 1 (aislamiento) y 2 (Ventas → 403 en `/marketing/*`); Pest: UPDATE sobre `mkt_consent_events` → error de BD.

**Depende de:** F0-18, F1A-CRM-15 · **Prioridad:** P0

#### F3-MKT-02 · Baja pública en un clic y confirmación

**Historia:** Como titular de datos, quiero darme de baja desde el enlace del correo sin iniciar sesión, para dejar de recibir publicidad de inmediato.

**Especificación:** 14 §5 MKT-BR-02, §6 `public/unsubscribe`, §8 `ConsentRevoked`

**Tablas:** `mkt_consents`, `mkt_consent_events`, `mkt_campaign_recipients`

**Endpoints:** `GET /api/v1/public/unsubscribe/{token}`, `POST /api/v1/public/unsubscribe/{token}`

**Pantallas:** Página pública de baja (sitio del tenant)

**Criterios de aceptación:**

1. Token firmado por destinatario y canal; GET muestra la confirmación y POST revoca (idempotente).
2. La baja prevalece sobre cualquier segmento o regla y se aplica de inmediato; `ConsentRevoked` envía confirmación al titular e invalida la caché de audiencias.
3. Evento con `revoke_source=enlace` y `revoke_campaign_id`.

**Pruebas:** Pest: dos POST con el mismo token → una sola revocación; token alterado → 404.

**Depende de:** F3-MKT-01 · **Prioridad:** P0

#### F3-MKT-03 · Segmentos dinámicos, conteo en vivo y resolución de audiencia con supresiones

**Historia:** Como Manager, quiero armar segmentos con reglas y ver en vivo cuántos contactos son elegibles, para dirigir campañas sin incumplir la ley.

**Especificación:** 14 §3.4, §3.9, §5 MKT-BR-01/06/12/13/14, §6 segments

**Tablas:** `mkt_segments`, `mkt_campaign_suppressions`

**Endpoints:** `GET /api/v1/marketing/segments`, `POST /api/v1/marketing/segments`, `POST /api/v1/marketing/segments/preview`, `GET /api/v1/marketing/segments/{code}`, `PUT /api/v1/marketing/segments/{code}` (If-Match), `DELETE /api/v1/marketing/segments/{code}` (If-Match), `POST /api/v1/marketing/segments/{code}/duplicate`

**Pantallas:** `/marketing/campanas?tab=segmentos`, `/marketing/segmentos/[code]`, `/marketing/segmentos/nuevo`

**Criterios de aceptación:**

1. Reglas validadas contra el catálogo MKT-BR-13 (FormRequest + esquema Zod espejo); coincidencia TODAS/ALGUNA; nombre único.
2. `AudienceResolver` (servicio único para preview, programación y envío): elegibles y suprimidos con motivo `optout`, `nodata` (MKT-BR-06), `consent` (MKT-BR-01), `fatigue` (72 h, MKT-BR-14); admite evaluación a una fecha `at`.
3. `preview` devuelve `{matched, by_type, email, whatsapp, sample[10]}` en < 500 ms con la semilla (debounce 300 ms en UI).
4. Segmento usado por una campaña no se elimina (409 MKT-BR-12); sí se duplica.

**Pruebas:** 14 §10 casos 4 (supresiones con motivo; evaluación histórica) y 12 (DELETE segmento usado → 409).

**Depende de:** F3-MKT-01 · **Prioridad:** P0

#### F3-MKT-04 · Plantillas de email y WhatsApp con aprobación de Meta

**Historia:** Como Manager, quiero plantillas con variables y estado de aprobación, para cumplir las políticas de WhatsApp Business.

**Especificación:** 14 §3.5, §4.3, §5 MKT-BR-02/03, §6 templates y webhook de Meta; D-03, INT-04

**Tablas:** `mkt_templates`

**Endpoints:** `GET /api/v1/marketing/templates`, `POST /api/v1/marketing/templates`, `PUT /api/v1/marketing/templates/{code}` (If-Match), `POST /api/v1/integrations/whatsapp/webhooks/templates` (firma Meta; idempotente por event id)

**Pantallas:** `/marketing/campanas?tab=plantillas` (editor modal)

**Criterios de aceptación:**

1. WhatsApp: nombre `^[a-z0-9_]+$`, alta → `en_revision` y envío a Meta por el adaptador; webhook → `aprobada`/`rechazada`; editar una aprobada la devuelve a revisión.
2. Email comercial exige `{{enlace_baja}}`; WhatsApp comercial indica «Responde BAJA» (MKT-BR-02).
3. Variables solo de la lista cerrada; vista previa en vivo con un contacto real elegible.
4. Sin proveedor contratado: adaptador sandbox y acción «Registrar respuesta de Meta» solo en entornos no productivos.

**Pruebas:** 14 §10 caso 6 (WA con plantilla en revisión → 422 MKT-BR-03 al programar, probar o enviar).

**Depende de:** F3-MKT-01, F2-INB-03 · **Prioridad:** P1

#### F3-MKT-05 · Campañas: editor, prueba obligatoria, programación, envío idempotente y cancelación

**Historia:** Como Manager, quiero crear, probar, programar y enviar campañas por email o WhatsApp, para generar demanda medible.

**Especificación:** 14 §3.6–3.8, §4.1, §5 MKT-BR-03/04/05/07/08/09/18, §6 campaigns, §8 `DispatchScheduledCampaigns`/`SendCampaignBatch`

**Tablas:** `mkt_campaigns`, `mkt_campaign_tests`, `mkt_campaign_recipients`, `mkt_campaign_suppressions`, `catalog_promotions` (+`campaign_id`)

**Endpoints:** `GET /api/v1/marketing/campaigns`, `POST /api/v1/marketing/campaigns`, `GET /api/v1/marketing/campaigns/{code}`, `PUT /api/v1/marketing/campaigns/{code}` (If-Match), `GET /api/v1/marketing/campaigns/{code}/audience`, `POST /api/v1/marketing/campaigns/{code}/test-send` (Idempotency-Key), `POST /api/v1/marketing/campaigns/{code}/schedule` (If-Match), `POST /api/v1/marketing/campaigns/{code}/unschedule` (If-Match), `POST /api/v1/marketing/campaigns/{code}/send` (Idempotency-Key + If-Match), `POST /api/v1/marketing/campaigns/{code}/cancel` (If-Match), `POST /api/v1/marketing/campaigns/{code}/duplicate`

**Pantallas:** `/marketing/campanas/nueva`, `/marketing/campanas/[code]/editar`

**Criterios de aceptación:**

1. `CampaignStateMachine`: `borrador → programada → enviando → enviada`; `borrador/programada → cancelada` con motivo; `enviada` y `cancelada` inmutables (409).
2. Prueba obligatoria a un usuario interno activo antes de programar/enviar; editar el contenido invalida las pruebas (MKT-BR-04, MKT-BR-18).
3. Programación ≥ 15 min; WhatsApp comercial solo 08:00–20:00 hora del tenant (MKT-BR-05); 0 elegibles → 422 MKT-BR-07; código promocional único, activo y vigente (MKT-BR-09), creable inline.
4. Enviar congela `audience_snapshot`, crea `recipients` `pendiente` y `suppressions`; `SendCampaignBatch` (lotes de 200/min, `ShouldBeUnique` campaña+lote) re-evalúa consentimiento y baja por destinatario antes de enviar.
5. `DispatchScheduledCampaigns` cada minuto; `send` con la misma Idempotency-Key → un solo envío.
6. UTM `utm_campaign=cmp-XXXX` generado.

**Pruebas:** 14 §10 casos 5, 7 y 8 (sin prueba → 422; < 15 min o WA 21:00 → 422; idempotencia de `/send`; enviada → programada 409).

**Depende de:** F3-MKT-03, F3-MKT-04, F0-26 · **Prioridad:** P0

#### F3-MKT-06 · Eventos de entrega, bajas por respuesta y métricas de campaña

**Historia:** Como Manager, quiero ver entregas, aperturas, clics y bajas de cada campaña, para medir su efecto.

**Especificación:** 14 §3.8, §6 webhooks email/WhatsApp y recipients, §8 (webhooks, `ConsentRevoked`)

**Tablas:** `mkt_campaign_recipients`, `mkt_consents`

**Endpoints:** `POST /api/v1/integrations/email/webhooks` (firma proveedor), `POST /api/v1/integrations/whatsapp/webhooks/messages` (firma proveedor), `GET /api/v1/marketing/campaigns/{code}/recipients`, `POST /api/v1/marketing/campaigns/{code}/recipients/{id}/unsubscribe`

**Pantallas:** `/marketing/campanas/[code]` (pestañas KPIs, embudo, destinatarios)

**Criterios de aceptación:**

1. Webhooks firmados e idempotentes por id de evento: entregado/abierto (lectura en WA)/clic/rebote/respuesta.
2. Respuesta «BAJA» o enlace → revoca el consentimiento y excluye al contacto de campañas programadas (MKT-BR-02).
3. «Registrar baja» manual desde el destinatario (idempotente).
4. Avance del envío en tiempo real por Reverb mientras la campaña está `enviando`.

**Pruebas:** 14 §10 caso 9 (baja por «BAJA» excluye de la siguiente campaña programada).

**Depende de:** F3-MKT-05, F3-MKT-02 · **Prioridad:** P1

#### F3-MKT-07 · Atribución last-touch de 30 días

**Historia:** Como Manager, quiero saber qué reservas, leads y usos de código genera cada campaña, para invertir donde rinde.

**Especificación:** 14 §3.10, §3.17, §5 MKT-BR-10, §8 `RecomputeAttribution`; 03-PLAN (depende de Reservas y e-commerce)

**Tablas:** `mkt_attributions`, `booking_reservations`, `crm_leads` (+`utm_campaign`), `channel_ecom_orders` (+`promo_code`, `utm_campaign`)

**Endpoints:** — (se expone en `GET /api/v1/marketing/campaigns/{code}` como `attribution`)

**Pantallas:** `/marketing/campanas/[code]` (conversiones atribuidas)

**Criterios de aceptación:**

1. Reserva (no borrador/cancelada) de un destinatario creada en (sent_at, sent_at + 30 d] si la campaña es la última enviada a ese contacto y la reserva no proviene de una cotización creada antes del envío.
2. Leads nuevos cuyo email coincide con un destinatario; usos del código en pedidos web dentro de la ventana.
3. Ingreso = total × TC de la reserva (regla 15); UNIQUE por conversión (una sola campaña).
4. Job en cola `reports` cada hora y en `ReservationCreated`/`LeadCreated`/`EcomOrderPaid`; ventana compartida con `crm_sales_target_policies.attribution_window_days`.

**Pruebas:** 14 §10 caso 10 (reserva a los 10 días → atribuida; desde cotización previa → no; segunda campaña se lleva la conversión).

**Depende de:** F3-MKT-05, F1B-RES-02, F2-WEB-07 · **Prioridad:** P1

#### F3-MKT-08 · Automatizaciones comerciales y de servicio

**Historia:** Como Manager, quiero 6 automatizaciones (bienvenida, carrito, pre-viaje, encuesta, cumpleaños, reactivación), para comunicar en el momento justo sin trabajo manual.

**Especificación:** 14 §3.11–3.12, §4.4, §5 MKT-BR-16/17, §6 automations, §8 `RunAutomations`

**Tablas:** `mkt_automations`, `mkt_automation_runs`, `mkt_automation_enrollments`

**Endpoints:** `GET /api/v1/marketing/automations`, `PUT /api/v1/marketing/automations/{code}`, `POST /api/v1/marketing/automations/{code}/activate` (If-Match), `POST /api/v1/marketing/automations/{code}/pause` (If-Match), `POST /api/v1/marketing/automations/{code}/run` (Idempotency-Key)

**Pantallas:** `/marketing/campanas?tab=automatizaciones`

**Criterios de aceptación:**

1. `RunAutomations` cada 15 min (reactivación lunes 08:00; cumpleaños diario 09:00) calcula colas con datos reales y registra `runs`.
2. Comerciales requieren consentimiento; de servicio (pre-viaje, encuesta) se basan en la ejecución del contrato pero respetan la baja (MKT-BR-16).
3. Idempotencia por UNIQUE de `enrollments` (contacto + referencia): ejecutar dos veces no reenvía (MKT-BR-17).
4. Activar bloqueado si la plantilla WA no está aprobada; «Ejecutar ahora» con Idempotency-Key.

**Pruebas:** 14 §10 caso 11 (dos ejecuciones no reenvían; comercial sin consentimiento → suprimido; pre-viaje sin consentimiento y sin baja → enviado).

**Depende de:** F3-MKT-03, F3-MKT-04 · **Prioridad:** P1

#### F3-MKT-09 · Pantallas de Marketing: campañas, KPIs y detalle

**Historia:** Como Manager, quiero el módulo Marketing completo en Next.js, para operar campañas como en el prototipo.

**Especificación:** 14 §2 (tabla completa), §7, §9

**Tablas:** —

**Endpoints:** (consume F3-MKT-01..08)

**Pantallas:** `/marketing/campanas` (pestañas Campañas, Segmentos, Plantillas, Automatizaciones, Consentimientos), `/marketing/campanas/[code]`

**Criterios de aceptación:**

1. KPIs (enviadas 90 d, apertura, CTR, ingresos atribuidos, contactables email/WhatsApp); tabla con filtros estado/canal y exportación CSV (`reports.export`).
2. Detalle: flujo de estados, acciones según estado, KPIs, embudo, conversiones con enlace, destinatarios, resumen, audiencia (snapshot o estimación) e historial.
3. Grupo de menú «Marketing» solo con `marketing.campaigns.manage`; responsive 400 px sin scroll horizontal.

**Pruebas:** 14 §10 Playwright 17 y 18 (segmento con conteo en vivo, campaña email con prueba, envío, procesamiento y baja; consentimiento de lead → elegible).

**Depende de:** F3-MKT-05, F3-MKT-06 · **Prioridad:** P0

#### F3-MKT-10 · Captura de consentimientos en formularios existentes y conversión de suscriptores

**Historia:** Como agencia, quiero que los formularios del sitio, el checkout y los portales registren el consentimiento por canal con evidencia, para que la audiencia de marketing sea legal desde el origen.

**Especificación:** 14 §3.1–3.3, §3.17, MKT-BR-11, §12-3; 15 (newsletter y checkout); 08 (portal del cliente)

**Tablas:** `mkt_contacts_subscribers`, `mkt_consents`, `mkt_consent_events`

**Endpoints:** — (se integra en los endpoints existentes de newsletter, checkout y portal)

**Pantallas:** Formularios de `/`, `/checkout`, `/portal-cliente` (casillas por canal)

**Criterios de aceptación:**

1. Casilla independiente por canal (email, WhatsApp), sin premarcar, con texto y versión de política vigente (supuesto 14 §12-3).
2. Al enviar: `mkt_consents` + evento con origen del catálogo (Newsletter web, Checkout, Portal), evidencia (IP, id de formulario) y `policy_version`.
3. Newsletter con doble opt-in (`double_opt_in_at`); el suscriptor se vincula a `crm_clients`/`crm_leads` cuando coincide el email y deja de listarse como contacto separado.
4. Solicitud ARCO de cancelación suprime el suscriptor (`deleted_at`) conservando los eventos de consentimiento.

**Pruebas:** Pest: formulario sin casilla → sin consentimiento (contacto suprimido con motivo `consent`); doble opt-in pendiente no es elegible.

**Depende de:** F3-MKT-01, F2-WEB-13, F2-WEB-07, F1B-POR-01 · **Prioridad:** P1

### E3.7 · Metas comerciales

#### F3-MET-01 · Metas comerciales: modelo, alta, activación, ajuste y anulación

**Historia:** Como Manager, quiero fijar metas por asesor, sede o equipo con reglas anti-manipulación, para gestionar el desempeño comercial.

**Especificación:** 14 §3.13–3.16, §4.5, §5 MET-BR-01..05, §6 sales-targets/teams/policy

**Tablas:** `crm_sales_targets`, `crm_sales_target_adjustments`, `crm_sales_teams`, `crm_sales_team_members`, `crm_sales_target_policies`

**Endpoints:** `GET /api/v1/crm/sales-targets`, `POST /api/v1/crm/sales-targets`, `GET /api/v1/crm/sales-targets/{code}`, `POST /api/v1/crm/sales-targets/{code}/activate` (If-Match), `POST /api/v1/crm/sales-targets/{code}/adjust` (If-Match), `POST /api/v1/crm/sales-targets/{code}/void` (If-Match), `GET /api/v1/crm/sales-teams`, `PUT /api/v1/crm/sales-teams`, `GET /api/v1/crm/sales-target-policy`, `PUT /api/v1/crm/sales-target-policy`

**Pantallas:** —

**Criterios de aceptación:**

1. Índice único parcial alcance + período salvo anuladas (409 MET-BR-01); ventas > 0 obligatoria, conversión 0–100 % (MET-BR-02); sin períodos terminados (MET-BR-03).
2. Todo ajuste exige motivo y registra antes/después (MET-BR-04); con > 50 % del período transcurrido, reducir un indicador de una meta vigente requiere Tenant Admin → 403 `MET-BR-05` para Manager (`SalesTargetPolicy::decrease`).
3. Bono solo para alcance asesor (CHECK); política por tenant con tramos `[90→50 %, 100→100 %, 120→130 %]` editable con `admin.settings.manage`.
4. Ventas: `owner=me` forzado, sin borradores; meta ajena → 403 «fuera de su cartera».
5. Notificación `meta.asignada` (Portal + Email) al activar/ajustar.

**Pruebas:** 14 §10 casos 3, 13 y 14 (Ventas solo propias; duplicada → 409; período terminado → 422; Manager reduce al 97 % → 403, Tenant Admin OK).

**Depende de:** F0-18, F1A-CRM-10 · **Prioridad:** P0

#### F3-MET-02 · Avance, proyección y ranking de metas (read model)

**Historia:** Como asesor y como Manager, quiero ver el avance real y la proyección al cierre, para actuar a tiempo.

**Especificación:** 14 §5 MET-BR-07/08/09, §8 `SalesTargetProgress`, §6 ranking; 09 H-21

**Tablas:** `crm_target_progress` (read model), `booking_reservations`, `crm_opportunities`

**Endpoints:** `GET /api/v1/crm/sales-targets/ranking?period=`

**Pantallas:** —

**Criterios de aceptación:**

1. Ventas = Σ total en PEN (TC de la reserva) de reservas no borrador/canceladas creadas en el período del asesor, de la sede (`branch_id`) o de los integrantes vigentes del equipo; margen = venta − costo de servicios no cancelados; conversión = ganadas / (ganadas + perdidas).
2. Proyección = real + pipeline ponderado con cierre en el período; margen proyectado con el ratio real (22 % sin ventas); ritmo lineal real/días × total.
3. Estados de visualización derivados (Por iniciar, En camino, En riesgo, Crítico, Por cerrar, Cumplida/No cumplida).
4. Refresco cada 15 min y en eventos de reserva/oportunidad (cola `reports`).
5. Ranking: para Ventas posición, nombre y % sin montos ni bonos ajenos (el `JsonResource` omite los campos).

**Pruebas:** 14 §10 caso 16 (avance por asesor/sede/equipo en PEN con TC de la reserva); caso 3 (ranking sin montos ajenos).

**Depende de:** F3-MET-01, F1B-RES-01 · **Prioridad:** P0

#### F3-MET-03 · Cierre de período y bono por meta como comisión

**Historia:** Como Manager, quiero cerrar el período y que el bono pase a Finanzas como comisión, para pagar variables por un solo circuito.

**Especificación:** 14 §3.17 (`fin_commissions`), §4.5 cierre, §5 MET-BR-06/10, §8 `SalesTargetClosed`/`SalesTargetsPendingClose`; 07 PROC-047

**Tablas:** `crm_sales_targets` (`result`, `bonus_commission_id`), `fin_commissions` (+`sales_target_id`, `reservation_id` nullable)

**Endpoints:** `POST /api/v1/crm/sales-targets/{code}/close` (Idempotency-Key + If-Match)

**Pantallas:** —

**Criterios de aceptación:**

1. Cerrar solo después de `period_to` (422 MET-BR-06); congela `result` (cambios posteriores en reservas no lo alteran).
2. Si alcanza un tramo y hay monto > 0: crea UNA comisión «Bono por meta» en estado `calculada` (UNIQUE `fin_commissions(tenant_id, sales_target_id)`; CHECK `(kind='Bono por meta') = (sales_target_id IS NOT NULL)`).
3. Notifica a Finanzas (`comision.bono_meta`) y al asesor; `SalesTargetsPendingClose` diario 08:00 avisa al Manager.
4. Migración que vuelve nullable `fin_commissions.reservation_id` sin romper las comisiones existentes.

**Pruebas:** 14 §10 caso 15 (cerrar antes → 422; MET con 112,9 % y bono S/ 600 → comisión S/ 600 calculada; repetir cierre → sin segunda comisión). Playwright 19 (Finanzas U07 aprueba la comisión).

**Depende de:** F3-MET-02, F1B-FIN-06 · **Prioridad:** P0

#### F3-MET-04 · Pantallas de Metas (Manager y Ventas)

**Historia:** Como Manager y como asesor, quiero la pantalla de metas del prototipo, para seguir el período y el ranking.

**Especificación:** 14 §2 (`crm/metas`, `crm/metas/[code]`), §7

**Tablas:** —

**Endpoints:** (consume F3-MET-01..03)

**Pantallas:** `/crm/metas`, `/crm/metas/[code]`

**Criterios de aceptación:**

1. Manager/Admin: selector de período y asesor, KPIs, tabla de metas con Ajustar, ranking con montos, metas de sede/equipo con cobertura, historial.
2. Ventas: solo su meta (KPIs, 4 indicadores con proyección, reservas propias con margen, pipeline propio, bono por tramos, posición «N de M» sin montos ajenos).
3. Detalle con flujo Borrador → Vigente → Cerrada, historial de ajustes y enlace a la comisión si tiene `finance.commissions`.
4. Responsive 400 px sin scroll horizontal.

**Pruebas:** 14 §10 Playwright 20 (U03 «Su posición: 3 de 3», sin montos; `/crm/metas/MET-0007` → «fuera de su cartera»; `/marketing/campanas` → 403).

**Depende de:** F3-MET-02, F3-MET-03 · **Prioridad:** P0

### E3.8 · Reseñas propias verificadas

#### F3-RVP-01 · Modelo de reseñas propias, historial de moderación y ajustes

**Historia:** Como agencia, quiero guardar reseñas verificadas de mis pasajeros con su historial, para tener una fuente de reputación propia.

**Especificación:** 18 §3.1–3.4, §4, RVW-01/03/05; 17 §3.1 (R-OWN-REVIEWS, plan mínimo Professional)

**Tablas:** `crm_own_reviews`, `crm_own_review_log`, `crm_review_requests`, `sys_settings.own_reviews`

**Endpoints:** `GET /api/v1/settings/own-reviews`, `PATCH /api/v1/settings/own-reviews`

**Pantallas:** —

**Criterios de aceptación:**

1. Migraciones con CHECK `stars 1–5`, `lang`, `status IN (pendiente,publicada,rechazada,oculta)`, `source`, `status <> 'publicada' OR consent_publish`; UNIQUE (tenant_id, reservation_id, product_id, passenger_id) WHERE `deleted_at IS NULL` (RVW-03).
2. `OwnReviewStateMachine` según 18 §4 (autopublicar, publicar, rechazar, ocultar; responder no cambia estado).
3. Todo el módulo exige `effective(R-OWN-REVIEWS)` = activa ∧ plan ≥ Professional ∧ no desactivada en el producto; si no, 403 `RULE_NOT_IN_PLAN`/`RULE_DISABLED` y los datos se conservan (RVW-01).
4. Ajustes: `auto_publish`, `banned_words`, `personal_data` (retener/enmascarar), subcalificaciones activas, `show_on_site/show_on_widget`, invitación; parámetros de la regla (`daysAfter`, `minStarsAutoPublish`, `moderation`) solo con `admin.settings.manage`.
5. Semilla demo (`seeds/ownReviews.json`, 12 reseñas con `is_demo=true`).

**Pruebas:** 18 §10 Pest: aislamiento tenant; RVW-01 (regla apagada / plan Starter → 403 y lista pública vacía); RVW-03 duplicado → 409.

**Depende de:** F3-PLT-03, F0-06 · **Prioridad:** P0

#### F3-RVP-02 · Alta de reseña por el pasajero (portal, app y enlace del correo)

**Historia:** Como pasajero, quiero calificar mi viaje con estrellas, subcalificaciones, texto y fotos, para contar mi experiencia.

**Especificación:** 18 §5 RVW-02/04/05/06, §6 passenger/reviews y public/reviews/by-token; 08 §6.8

**Tablas:** `crm_own_reviews`, `crm_own_review_log`, `crm_review_requests`

**Endpoints:** `GET /api/v1/passenger/reviews/eligibility`, `POST /api/v1/passenger/reviews` (Idempotency-Key, multipart), `POST /api/v1/public/reviews/by-token` (Idempotency-Key)

**Pantallas:** `/portal-pasajero/resena` («Califica tu viaje» y «Mis reseñas»)

**Criterios de aceptación:**

1. Elegibilidad: reserva `completada`, o `en_operacion` solo por servicios `completado` o con fecha pasada; reservas canceladas/borrador no (RVW-02).
2. Validación: estrellas 1–5 obligatorias; subcalificaciones solo activas; título ≥ 3; texto 20–2000; consentimiento explícito sin premarcar (RVW-04/05).
3. Detección de palabras prohibidas y datos personales (correo, teléfono, DNI/pasaporte) → `pendiente` con motivo; si `personal_data=enmascarar`, reemplazo por «[dato oculto]» antes de evaluar (RVW-06).
4. Autopublicación si consentimiento ∧ sin alertas ∧ `stars ≥ minStarsAutoPublish` ∧ (`moderation=false` ∨ `auto_publish=true`); sin consentimiento → `oculta`.
5. Fotos a S3 `tenants/{t}/reviews/{uuid}.jpg` con URL firmada; enlace del correo de un solo uso (`token_hash`).
6. `OwnReviewSubmitted` notifica al admin y al asesor dueño.

**Pruebas:** 18 §10 Pest: RVW-02 (reserva ajena, cancelada, servicio futuro → 422); autopublicación vs pendiente; PII retenida y enmascarada; publicar sin consentimiento → 422.

**Depende de:** F3-RVP-01, F2-PAX-01 · **Prioridad:** P0

#### F3-RVP-03 · Moderación, respuesta pública y alcance de Ventas

**Historia:** Como Manager, quiero moderar y responder reseñas sin filtrar por nota, para cuidar la reputación con transparencia.

**Especificación:** 18 §2 (`canales/resenas-propias`), §5 RVW-07/08/11, §6 reviews, §7, §9

**Tablas:** `crm_own_reviews`, `crm_own_review_log`

**Endpoints:** `GET /api/v1/reviews`, `GET /api/v1/reviews/stats`, `GET /api/v1/reviews/{code}`, `POST /api/v1/reviews/{code}/publish` (If-Match), `POST /api/v1/reviews/{code}/reject` (If-Match), `POST /api/v1/reviews/{code}/hide` (If-Match), `PUT /api/v1/reviews/{code}/reply` (If-Match), `POST /api/v1/reviews/export-feed` (Idempotency-Key)

**Pantallas:** `/canales/resenas-propias` (Resumen, Bandeja de moderación, Todas, Solicitudes, Reglas y ajustes), `/canales/resenas-propias/[code]`

**Criterios de aceptación:**

1. Rechazar u ocultar exige motivo; la nota nunca es motivo de rechazo (sin review gating, RVW-07); publicar con alertas exige `confirm_flags=true`.
2. Respuesta pública sin datos personales (422); `OwnReviewReplied` envía correo al pasajero y mensaje en su portal.
3. Ventas: solo reseñas de sus reservas/clientes (`owner=me`), sin moderar ni responder (403) (RVW-11).
4. KPIs, distribución de estrellas, promedio por producto y subcalificación; exportación CSV; `export-feed` regenera feed del widget y caché del sitio.
5. Si la regla está apagada o el plan no la incluye: solo aviso explicativo.

**Pruebas:** 18 §10 Pest: rechazar sin motivo → 422; respuesta con teléfono → 422; Ventas 403 al moderar (`rbac-403.spec.ts`). Playwright equivalente a `e2e_resenas.js` (22 comprobaciones).

**Depende de:** F3-RVP-02 · **Prioridad:** P0

#### F3-RVP-04 · Solicitudes de reseña post-viaje

**Historia:** Como agencia, quiero invitar automáticamente a todos los pasajeros después del viaje, para aumentar reseñas sin incentivos ni sesgo.

**Especificación:** 18 §3.3, §4 (solicitud), §5 RVW-09, §6 review-requests, §8 `ScheduleReviewRequest`/`SendDueReviewRequests`

**Tablas:** `crm_review_requests`

**Endpoints:** `GET /api/v1/review-requests`, `POST /api/v1/review-requests/schedule-pending` (Idempotency-Key), `POST /api/v1/review-requests/{code}/send`, `POST /api/v1/review-requests/{code}/cancel`

**Pantallas:** `/canales/resenas-propias` (pestaña Solicitudes)

**Criterios de aceptación:**

1. `ReservationCompleted` → solicitud en `travel_to + daysAfter` a las 09:00 (UNIQUE por reserva).
2. `SendDueReviewRequests` cada 15 min: envía, recuerda a `reminder_days`, vence a `expire_days`; `programada → enviada → abierta → respondida`; `→ cancelada`; `→ vencida`.
3. A todos los elegibles, sin incentivos (RVW-09); enlace firmado de un solo uso.

**Pruebas:** 18 §10 Pest: el job respeta `daysAfter`; reenviar una vencida la pasa a `enviada`.

**Depende de:** F3-RVP-02, F1B-RES-05 · **Prioridad:** P1

#### F3-RVP-05 · Reseñas verificadas en el sitio público, widget y JSON-LD

**Historia:** Como visitante del sitio, quiero ver reseñas de viajeros verificados, para confiar en la agencia.

**Especificación:** 18 §2 (sitio), §5 RVW-10, §6 public/reviews, §11 (JSON-LD); 15 §11.3

**Tablas:** `crm_own_reviews`

**Endpoints:** `GET /api/v1/public/reviews?product=&stars=&lang=&page=` (cache 10 min)

**Pantallas:** `/tours/[slug]` (bloque «Reseñas de viajeros verificados»), `/`, `/tours` (tarjetas)

**Criterios de aceptación:**

1. Solo `publicada`, sello «Viaje verificado» y rótulo «ejemplo (demo)» si `is_demo`; `show_on_site/show_on_widget` apagan cada salida.
2. Ficha: promedio, distribución, subcalificaciones, filtro por estrellas, respuesta de la agencia; chip en cabecera; inicio con las 3 últimas.
3. `aggregateRating` y hasta 5 `review` en JSON-LD solo con reseñas propias; sin reseñas publicadas no se emite.
4. Caché `public:reviews:{product}` invalidada al moderar (`OwnReviewPublished/Hidden/Rejected`).

**Pruebas:** 18 §10 Playwright (sitio anónimo a 400 px: bloque con sello, filtro, JSON-LD, sin scroll horizontal; regla apagada y plan Starter → todo desaparece).

**Depende de:** F3-RVP-03, F2-WEB-05 · **Prioridad:** P1

### E3.9 · Reseñas externas

#### F3-RVE-01 · Conectores de reseñas externas y sincronización

**Historia:** Como Tenant Admin, quiero conectar Google Business Profile, TripAdvisor y Trustpilot, para centralizar mis reseñas externas.

**Especificación:** 17 §3.7, §4 (conector), §5 RV-01/03, §6 review-sources, §8 `SyncExternalReviews`; D-15

**Tablas:** `integration_review_sources`, `channel_external_reviews`

**Endpoints:** `GET /api/v1/integrations/review-sources`, `POST /api/v1/integrations/review-sources` (Idempotency-Key), `DELETE /api/v1/integrations/review-sources/{provider}` (Idempotency-Key), `POST /api/v1/integrations/review-sources/{provider}/sync` (ShouldBeUnique)

**Pantallas:** `/canales/resenas` (pestaña Conectores)

**Criterios de aceptación:**

1. Interfaz `ReviewSourceAdapter` (`connect`, `fetchSince`, `reply?`, `supportsInvites`) con adaptadores fase 1: Google, TripAdvisor (Content API, solo lectura) y Trustpilot; Facebook, GetYourGuide y Viator quedan como stub rotulado «fase posterior».
2. Solo APIs oficiales con contrato/aprobación declarada (`contract_ack_at/by`); sin scraping (RV-01).
3. Secreto en vault (`secret_ref`); la API solo devuelve los últimos 4 (RV-03); desconectar revoca el token y borra el secreto.
4. `SyncExternalReviews` cada 6 h por fuente: upsert por `external_id`, texto inmutable, actualiza rating/cantidad; 401/403 → `error` con aviso.
5. Datos de ejemplo del prototipo rotulados en toda pantalla y widget.

**Pruebas:** 17 §10 Pest caso 9 (la respuesta de `review-sources` nunca incluye el secreto); aislamiento (caso 1).

**Depende de:** F0-28, F3-PLT-02 · **Prioridad:** P1

#### F3-RVE-02 · Bandeja de reseñas externas: responder, publicar y derivar a postventa

**Historia:** Como Manager o asesor, quiero responder reseñas externas desde una bandeja, para atender la reputación en un solo lugar.

**Especificación:** 17 §4 (respuesta), §5 RV-02, §6 external-reviews, §7, §8 `PublishReviewReply`; 10 (inbox)

**Tablas:** `channel_external_reviews`, `collab_conversations`

**Endpoints:** `GET /api/v1/channels/external-reviews`, `POST /api/v1/channels/external-reviews/{id}/reply` (Idempotency-Key), `POST /api/v1/channels/external-reviews/{id}/mark-published` (Idempotency-Key), `POST /api/v1/channels/external-reviews/{id}/escalate` (Idempotency-Key)

**Pantallas:** `/canales/resenas` (pestaña Bandeja y drawer)

**Criterios de aceptación:**

1. Respuesta ≥ 20 caracteres (RV-02); `sin_responder → pendiente_publicar → publicada` vía API cuando la fuente lo permite (Google `updateReply`, Trustpilot `reply`); si es solo lectura → `no_admite` con «Guardar y copiar» y «Marcar como publicada».
2. `PublishReviewReply` (cola `integrations`) publica las pendientes con reintentos.
3. «Derivar a postventa» crea una conversación en el inbox para ≤ 3★.
4. Ventas puede ver, responder, invitar y derivar (las reseñas externas no tienen dueño); conectar/desconectar/sincronizar solo Tenant Admin.

**Pruebas:** 17 §10 Playwright E2E-V1 (U02 responde → «Pendiente de publicar»).

**Depende de:** F3-RVE-01, F2-INB-01 · **Prioridad:** P1

#### F3-RVE-03 · Invitaciones a reseña externa (R-REVIEW-INVITE) y widget de reseñas

**Historia:** Como agencia, quiero invitar a reseñar en plataformas externas y mostrar esas reseñas en mi web, para reforzar la reputación pública.

**Especificación:** 17 §5 R-REVIEW-INVITE, §6 review-invitations y public/reviews, §2 (pestañas Invitaciones y Widget); 13 §11 v2.2 (plan mínimo Enterprise)

**Tablas:** `channel_external_reviews`, `channel_widget_config.reviews_widget`, `notif_pax_messages`

**Endpoints:** `POST /api/v1/reservations/{id}/review-invitations` (Idempotency-Key), `GET /api/v1/public/reviews?sources=&min_rating=&count=` (cache 10 min)

**Pantallas:** `/canales/resenas` (pestañas Invitaciones postviaje y Widget para el sitio)

**Criterios de aceptación:**

1. Invitar requiere R-REVIEW-INVITE efectiva (activa ∧ plan Enterprise); inactiva → aviso y 403 `RULE_DISABLED`/`RULE_NOT_IN_PLAN`.
2. Invitación a todos los pasajeros de reservas finalizadas, sin gating ni incentivos; usa la plantilla PMT-009 (desfase `daysAfter × 24 h`).
3. Widget de reseñas: fuentes, mínimo de estrellas, cantidad y diseño; código y vista previa; siempre con atribución de la fuente.
4. El `aggregateRating` del sitio no usa reseñas externas (18 §11).

**Pruebas:** Pest: invitar con regla inactiva → 403; widget sin fuente conectada → lista vacía.

**Depende de:** F3-RVE-01, F2-MOT-12, F2-MOT-13 · **Prioridad:** P2

### E3.10 · Reportes avanzados

#### F3-REP-01 · Paneles y centro de reportes conectados a metas y marketing

**Historia:** Como Tenant Admin y Manager, quiero que el panel y los reportes usen las metas reales y muestren el rendimiento de campañas, para dirigir con cifras del período.

**Especificación:** 09 §7.2 (bloque «Metas del mes»), §7.4, H-21, §12-7; 14 §1 (PROC-060: avance, ranking e historial de metas; métricas y atribución de campañas)

**Tablas:** `crm_target_progress`, `crm_sales_targets`, `mkt_campaigns`, `mkt_attributions`, `rpt_monthly_sales`

**Endpoints:** `GET /api/v1/dashboard/manager`, `GET /api/v1/dashboard/executive`, `GET /api/v1/reports/{report}`

**Pantallas:** `/dashboard` (Tenant Admin y Manager), `/reportes/[tab]`

**Criterios de aceptación:**

1. El bloque «Metas del mes» del panel de gerencia y el KPI de meta del panel ejecutivo leen `crm_target_progress` (asesor, sede, equipo) en lugar del parámetro de configuración provisional de F1B-REP-04 (09 §12-7); sin metas vigentes se muestra «Sin meta definida».
2. Reporte Comercial suma columnas «Meta», «% cumplimiento» y «Proyección» por vendedor; Ventas ve solo la suya (REP-BR-02) y el ranking sin montos ajenos (MET-BR-07).
3. Nueva pestaña «Marketing» en `/reportes` para roles con `marketing.campaigns.manage`: campañas enviadas, apertura/lectura, CTR, conversiones e ingresos atribuidos por mes (lee `mkt_attributions`); exportable por el flujo de F1B-REP-03.
4. Sin cambios de contrato en los 7 reportes existentes: los campos nuevos son aditivos.

**Pruebas:** Pest: panel de gerencia con meta de U03 igual a `crm_target_progress`; Ventas en pestaña Marketing → 403; Ventas en Comercial sin metas ajenas.

**Depende de:** F3-MET-02, F3-MKT-07, F1B-REP-02, F1B-REP-04 · **Prioridad:** P1

#### F3-REP-02 · Exportación XLSX y PDF

**Historia:** Como Finanzas, quiero exportar reportes en Excel y PDF, para compartirlos fuera del sistema.

**Especificación:** 09 §3.16 (`format IN (CSV,XLSX,PDF)`), EXP-BR-01/02, §6.7 exports

**Tablas:** `report_exports`

**Endpoints:** `POST /api/v1/reports/exports` (Idempotency-Key), `GET /api/v1/reports/exports`, `GET /api/v1/reports/exports/{id}/download`

**Pantallas:** `/reportes/[tab]` (modal Exportar)

**Criterios de aceptación:**

1. Se amplía el job de exportación CSV de F1B-REP-03 con XLSX (una hoja por tabla, formatos de número, moneda y fecha) y PDF (plantilla con logo del tenant, filtros aplicados, KPIs y gráficos renderizados en la cola `documents`).
2. Mismo flujo Solicitud → Permiso → Job → Archivo → Disponible; archivo 7 días con URL firmada y descarga auditada.
3. La exportación respeta el alcance del rol (Ventas no exporta; Contabilidad sin costos ni márgenes).

**Pruebas:** 09 T-23 con `format=XLSX` y `format=PDF` (sin `reports.export` → 403 + `exportar_denegado`; con permiso → 202 y `disponible`).

**Depende de:** F1B-REP-03, F0-30 · **Prioridad:** P1

#### F3-REP-03 · Reportes programados por correo

**Historia:** Como Manager, quiero programar el envío periódico de un reporte, para recibirlo sin entrar al sistema.

**Especificación:** 09 §6.7 schedules, §8.2 JOB-08/JOB-nn, EXP-BR-03

**Tablas:** `sys_scheduled_jobs`, `report_exports`

**Endpoints:** `POST /api/v1/reports/schedules`

**Pantallas:** `/reportes/[tab]` (modal Programar) y `/admin/integraciones/jobs`

**Criterios de aceptación:**

1. `{report_key, frequency, time, format, recipients}` crea un `sys_scheduled_jobs` `JOB-nn` en cola `reports`; frecuencias diario/lunes/viernes/mensual día 1; destinatarios obligatorios y válidos (EXP-BR-03).
2. Cada ejecución crea `report_exports` con `requested_by = NULL` (Sistema) y envía el archivo por email.
3. JOB-08 «Reportes programados (gerencia)» lunes 07:00 con la misma mecánica; pausar/reanudar desde el scheduler de F0-28.

**Pruebas:** Pest: correo inválido → 422 EXP-BR-03; la ejecución crea un export `disponible` y un envío.

**Depende de:** F3-REP-02 · **Prioridad:** P1

### E3.11 · Pruebas y salida de Fase 3

#### F3-QA-01 · Suites Pest de plataforma, marketing, metas y reseñas

**Historia:** Como responsable técnico, quiero las suites mínimas de cada especificación en verde, para cerrar la fase con evidencia.

**Especificación:** 13 §10 (12 casos), 14 §10 (casos 1–16), 17 §10 (casos de reseñas), 18 §10, 09 §10 (T-23..T-25)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Todas las pruebas Pest listadas en las especificaciones, sobre PostgreSQL 17 + Redis 8 reales.
2. Plantillas de `kit-ia/tests/pest` aplicadas a los módulos nuevos: aislamiento, RBAC 403, ownership, máquinas de estado, idempotencia y reglas activables.
3. Cobertura de líneas ≥ 80 % en `Domain/Platform`, `Domain/Marketing` y servicios de reseñas.

**Pruebas:** Pipeline verde.

**Depende de:** F3-API-05, F3-MKT-09, F3-MET-04, F3-RVP-05, F3-REP-03 · **Prioridad:** P0

#### F3-QA-02 · Playwright de Fase 3 y regresión E2E-01…E2E-10

**Historia:** Como responsable técnico, quiero los flujos de pantalla de la fase automatizados y la regresión completa en verde, para liberar sin romper fases previas.

**Especificación:** 13 §10 (PW-SUB-01/02, PW-API-01, PW-PLAT-01, PW-RBAC-01), 14 §10 (17–20), 17 §10 (E2E-V1), 18 §10; DOC-PROC-001 E2E-01…E2E-10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Specs Playwright nuevas en `kit-ia/tests/e2e/specs` con `data-testid` de `SELECTORES.md` (se agregan los de las pantallas de la fase).
2. Regresión completa E2E-01…E2E-10, motor (rangos, pasajeros, checkout con adelanto y quitar ítems), ownership y 403 en verde.
3. Barrido responsive 400 px de las pantallas nuevas sin scroll horizontal.

**Pruebas:** Suite Playwright completa en verde en staging.

**Depende de:** F3-QA-01 · **Prioridad:** P0

#### F3-QA-03 · Segundo tenant real de punta a punta sin intervención manual

**Historia:** Como dirección del producto, quiero dar de alta y operar una segunda agencia real solo con el sistema, para validar que el SaaS está listo para vender.

**Especificación:** 03-PLAN §2 (criterio de salida de Fase 3); 09 PROC-001; 13 §4.1

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Guion automatizado (Playwright + API) en staging: alta por el asistente → trial → Tenant Admin acepta invitación y enrola MFA → registra tarjeta → conversión → factura FQ01 emitida y cobrada → carga de catálogo mínimo → cotización → reserva → consumo medido → API key y webhook entregado con firma válida.
2. Durante todo el guion no se usa `tinker`, SQL manual ni soporte de plataforma; el Super Admin no accede a datos comerciales del nuevo tenant.
3. E2E-08 ejecutado entre TNT-0001 y el tenant nuevo.
4. Checklist de salida firmado en `CHANGELOG.md` con fecha.

**Pruebas:** Guion completo en verde dos veces seguidas en staging.

**Depende de:** F3-QA-02, F3-TEN-01, F3-BIL-04 · **Prioridad:** P0

#### F3-QA-04 · Endurecimiento de seguridad de plataforma

**Historia:** Como responsable de seguridad, quiero verificar que secretos, tokens y endpoints públicos no filtren información, para operar el SaaS con riesgo controlado.

**Especificación:** 13 §5 API-BR-06, §9 (secretos nunca auditados); 17 RV-03; 14 (páginas públicas); 00 (formato de error)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pruebas automáticas de SSRF (IPs privadas, DNS rebinding simulado, redirecciones) sobre webhooks.
2. Máscara de tokens, secretos, `gateway_token` y números de tarjeta en `Log::`, Sentry y auditoría (test que busca patrones en los logs de la suite).
3. Rate limit en endpoints públicos nuevos (`/public/unsubscribe`, `/public/reviews`, `/public/reviews/by-token`, webhooks entrantes).
4. Revisión de `JsonResource`: el Super Admin nunca recibe datos comerciales; Ventas nunca recibe montos ajenos en ranking.

**Pruebas:** Pest de seguridad en verde; informe de hallazgos cerrado.

**Depende de:** F3-API-04, F3-MKT-02, F3-RVP-05 · **Prioridad:** P1

## Definición de terminado (toda historia)

- Migraciones reversibles; tablas de tenant con RLS forzado y tablas de plataforma sin `tenant_id` accesibles solo por la conexión `platform`; CHECK de estados, índices y FK en la misma migración.
- Actions dentro de transacción, con locks donde haya dinero, cupones o cupos, eventos de dominio `afterCommit`, outbox para efectos externos y auditoría de las acciones críticas (13 §9, 14 §9, 17 §9, 18 §9).
- Endpoints con FormRequest, Policy + permiso spatie + `EnsureFeature` cuando aplique, `JsonResource` que omite campos sensibles (el Super Admin nunca recibe datos comerciales) y OpenAPI regenerado.
- Secretos, tokens y datos de tarjeta nunca en BD en claro, logs, Sentry ni auditoría.
- Pantallas Next.js equivalentes al prototipo, con estados vacío, error, bloqueo por plan y 403; sin scroll horizontal de página a 400 px; `data-testid` según `kit-ia/tests/e2e/SELECTORES.md`.
- Pruebas: aislamiento de tenant, RBAC (403), ownership, máquina de estados, reglas de negocio, idempotencia y reglas activables (regla apagada / plan sin la regla) cuando aplique.
