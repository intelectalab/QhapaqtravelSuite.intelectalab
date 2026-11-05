# Glosario de negocio y técnico

> Generado por `kit-ia/referencia/tools/build_glossary.py`. Definiciones redactadas a partir de las especificaciones; «Dónde aparece» = especificaciones con más menciones del término (número de menciones entre paréntesis; 00 = Transversal (seguridad y RBAC), 01 = CRM, 02 = Catálogo, 03 = Cotizaciones, 04 = Reservas, 05 = Operaciones y móvil, 06 = Extranet de proveedores, 07 = Finanzas, 08 = Canales y portales, 09 = Administración y reportes, 10 = Aprobaciones e inbox, 11 = Cupos y documentos de viaje, 12 = Tesorería y reclamaciones, 13 = Plataforma SaaS y API, 14 = Marketing y metas, 15 = Sitio web público, 16 = Motor de reservas y centro de reglas, 17 = Reglas, comunicaciones, monedas, reseñas e integración web, 18 = Reseñas propias). Las tablas se verifican contra `kit-ia/database/*.sql`.

**105 términos** en 9 categorías: Plataforma, Catálogo, Técnico, Comercial (cotizaciones y reservas), Operaciones, CRM, Finanzas, Canales, Documentación y pruebas.

## Plataforma

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **API key / OAuth app** | Credenciales de la API pública del tenant (`qts_live_…`, scopes) y aplicaciones OAuth 2.0 con PKCE. | `integration_api_keys`, `integration_oauth_apps`, `oauth_clients` | 13 (37), 17 (1) |
| **Dunning** | Cobranza automática de la plataforma a tenants con pago fallido: reintentos D+1/D+3/D+7 y suspensión. | `payment_attempts`, `platform_invoices` | 13 (27) |
| **MRR / ARR** | Ingreso recurrente mensual/anual de la plataforma (Σ suscripciones activas mensualizadas). | `platform_metrics_daily` | 13 (13), 09 (4) |
| **Plan / entitlement** | Plan comercial del SaaS (Starter, Professional, Enterprise) y los derechos que otorga: módulos, límites (usuarios, sedes, almacenamiento, mensajes, API) y reglas activables. Precedencia: override > add-on > plan. | `plans`, `plan_features`, `plan_limits`, `feature_overrides`, `plan_rule_entitlements` | 13 (102), 09 (59), 17 (27), 18 (5), 08 (4) y 7 más |
| **Sede** | Oficina o sucursal del tenant (p. ej. Lima, Cusco). Agrupa usuarios, cajas chicas y series; el plan limita cuántas se pueden crear. | `iam_sedes` | 09 (51), 12 (14), 13 (9), 14 (9), 15 (5) y 7 más |
| **Tenant** | Agencia de viajes u operador que contrata el SaaS. Todos sus datos llevan `tenant_id` y quedan aislados por global scope + RLS de PostgreSQL; se resuelve desde el token y el subdominio (`andes.localhost`). | `tenants`, `app.tenant_id` | 09 (157), 13 (96), 00 (89), 16 (57), 02 (35) y 14 más |

## Catálogo

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **Adicionales (add-ons)** | Extras opcionales por tipo de pasajero (entradas, comidas, extensiones) que se suman al precio (R-ADDONS). | `catalog_product_addons` | 16 (33), 13 (22), 15 (13), 17 (13), 04 (10) y 6 más |
| **BookingEngine** | Servicio de dominio que calcula estado del día, cotización (líneas, ajustes, pago) y validación de pasajeros; idéntico al `BE` del prototipo. | — | 16 (23), 15 (18), 17 (18), 02 (7), 04 (4) y 3 más |
| **Centro de reglas / regla activable** | Interruptores `R-…` por tenant (32 en la semilla) con parámetros y excepción por producto; el motor los consulta con `BookingEngine::on(regla, producto)`. | `sys_booking_rules`, `catalog_product_rule_overrides` | 16 (106), 17 (76), 15 (57), 08 (28), 05 (22) y 10 más |
| **Componente** | Servicio o producto que forma parte de un producto compuesto (p. ej. tren + bus + entrada + guía en Machu Picchu Full Day); define proveedor y costo. | `catalog_product_items` | 02 (40), 04 (10), 00 (4), 11 (2), 01 (1) y 3 más |
| **Cupo / allotment** | Inventario contratado con un proveedor (habitaciones, asientos) garantizado por fecha, distinto de las salidas propias y de los holds; se consume al confirmar servicios. | `catalog_allotments`, `catalog_allotment_days`, `catalog_allotment_consumptions` | 11 (91), 02 (29), 15 (29), 04 (28), 08 (27) y 8 más |
| **Destino** | Jerarquía geográfica País › Departamento › Ciudad › Zona › Lugar › Atracción usada en productos, leads y el sitio web. | `catalog_destinations`, `catalog_destination_contents` | 02 (34), 15 (29), 01 (23), 07 (4), 08 (3) y 5 más |
| **Markup / margen** | Recargo sobre el costo (`base × markupPct/100 + markupFixed`) que da el precio de venta; margen = (precio − costo) / precio. Márgenes y utilidad solo son visibles con permisos de rentabilidad (SEC-BR-13). | `catalog_price_rules` | 02 (34), 03 (27), 07 (19), 09 (18), 00 (12) y 11 más |
| **Modelo de disponibilidad** | Cómo controla el inventario cada producto: SIN_CONTROL, CUPOS, CAPACIDAD, POR_PROVEEDOR, POR_ACTIVIDAD, POR_TRANSPORTE, POR_HABITACION, POR_SALIDA, POR_FECHA. | `catalog_products.availability_model` | 04 (12), 02 (9), 08 (1), 15 (1), 16 (1) |
| **Pick-up report** | Reporte del ritmo de ventas frente al cupo contratado por fecha (PROC-060). | — | 11 (2) |
| **Precio desde (from_price)** | Precio mínimo vigente que se muestra en listados y en el sitio web; se recalcula al cambiar tarifas. | `catalog_products.from_price` | 02 (4), 15 (2) |
| **Producto** | Unidad vendible del catálogo (excursión, full day, paquete, traslado, hotel, actividad…). Ciclo de vida DRAFT → REVIEW → APPROVED → ACTIVE (y SUSPENDED / INACTIVE); solo ACTIVE se cotiza y reserva (PRD-BR-002). | `catalog_products`, `catalog_product_versions` | 02 (128), 15 (44), 08 (42), 16 (31), 17 (23) y 11 más |
| **Proveedor** | Hotel, transportista, operador, guía externo, restaurante o entidad (p. ej. Ministerio de Cultura) que presta servicios; tiene contrato, condiciones de pago y acceso a la extranet. | `catalog_providers`, `catalog_provider_contacts` | 06 (155), 02 (85), 05 (73), 07 (49), 04 (43) y 12 más |
| **Rango de disponibilidad** | Periodo disponible, cerrado/ocupado o agotado de un producto con capacidad por día (p. ej. disponible 02–06 oct, ocupado 07–09 oct); gobernado por R-AVAIL-RANGES. | `catalog_availability_ranges` | 16 (4), 12 (1) |
| **Recojo (pickup)** | Punto de partida del pasajero (hotel, aeropuerto con vuelo y hora); obligatorio si R-PICKUP está activa. | `catalog_pickup_points` | 16 (26), 05 (14), 15 (11), 04 (10), 08 (8) y 2 más |
| **Release (liberación de cupo)** | Fecha límite antes del servicio en que los cupos contratados no vendidos se devuelven al proveedor (job JOB-10 ReleaseAllotments); después puede aplicar penalidad por no uso. | `catalog_allotment_days`, `catalog_allotment_charges` | 11 (30), 02 (2), 05 (2), 08 (2), 04 (1) y 1 más |
| **Salida (departure)** | Fecha programada de un producto con capacidad propia (`capacity`, `sold`); en el modelo POR_SALIDA no se confirma si `capacity − sold < pax` (RT-4). | `catalog_product_departures` | 02 (71), 04 (47), 15 (38), 08 (37), 05 (14) y 8 más |
| **Servicio (de proveedor)** | Prestación unitaria que entrega un proveedor (habitación, traslado, entrada, guiado) con costo y vigencia; los productos se arman con servicios. | `catalog_services`, `catalog_service_cost_history` | 05 (107), 04 (79), 02 (66), 06 (35), 08 (28) y 13 más |
| **Tarifa (rate)** | Precio y costo de un producto por segmento (Adulto, Niño, B2B…), canal, moneda y vigencia; base del precio sugerido en cotizaciones. | `catalog_rates`, `catalog_rate_conditions` | 02 (83), 08 (39), 06 (37), 15 (29), 03 (18) y 7 más |
| **Temporada / factor de temporada** | Rango de fechas con un factor multiplicador de precio (alta, baja, feriados) y prioridad; el precio de una línea se ajusta por `factor(fecha) / factor(temporada de la tarifa)` (PRC-01). | `catalog_seasons`, `catalog_product_seasons` | 02 (41), 15 (14), 03 (10), 04 (6), 00 (2) y 5 más |
| **Tramo de alojamiento** | Ciudad del itinerario con noches y hoteles/tipos de habitación elegibles (R-LODGING). | `catalog_accommodation_legs`, `catalog_accommodation_hotels`, `catalog_accommodation_room_types` | 16 (18), 04 (10), 07 (5), 14 (5), 02 (2) y 3 más |

## Técnico

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **ACCESS / ROLE_UX** | Mapas del prototipo: permiso requerido por pantalla y experiencia por rol (back-office, portal, app). Ver PERMISOS.md. | `core.js` | 00 (20), 08 (4), 02 (3), 05 (3), 06 (3) y 7 más |
| **Auditoría** | Registro append-only de acciones críticas (quién, qué, antes/después, IP) consultable en Administración › Auditoría. | `audit_events` | 09 (75), 01 (45), 00 (40), 02 (39), 05 (35) y 14 más |
| **BFF** | Backend-for-frontend en Next.js (Route Handlers / Server Actions) que guarda el token Sanctum y llama a la API. | — | 15 (1) |
| **Cartera / ownership** | Registros cuyo `owner_id` es el asesor; el rol Ventas solo ve y gestiona su cartera (SEC-BR-09). | `columna owner_id` | 01 (23), 00 (15), 03 (12), 08 (10), 04 (9) y 7 más |
| **Correlativo / serie** | Numeración por tipo de documento (COT-2026-, RES-2026-, F001-) asignada de forma atómica, sin huecos en documentos fiscales. | `sys_sequences`, `fin_document_series` | 07 (21), 09 (16), 00 (10), 12 (9), 13 (6) y 8 más |
| **Horizon / colas** | Gestor de colas Redis de Laravel; colas critical, default, notifications, documents, integrations, reports, low. | `sys_job_runs` | 01 (19), 15 (12), 00 (8), 09 (6), 12 (6) y 14 más |
| **Idempotency-Key** | Header que hace repetible sin duplicar una operación crítica; misma clave = misma respuesta durante 24 h (RT-22, SEC-BR-16). | `sys_idempotency_keys` | 15 (29), 04 (28), 08 (27), 05 (21), 13 (20) y 14 más |
| **Job / scheduler** | Tarea en cola o programada (`routes/console.php`); los programados se identifican JOB-nn y se registran en `sys_job_runs`. | `sys_scheduled_jobs`, `sys_job_runs` | 09 (69), 11 (27), 13 (18), 03 (17), 02 (16) y 14 más |
| **lock_version / If-Match** | Control de concurrencia optimista: el cliente envía la versión leída y el servidor responde 409 si cambió (SEC-BR-17). | `columna lock_version` | 08 (18), 04 (17), 01 (16), 10 (15), 14 (15) y 14 más |
| **Outbox** | Tabla donde se registran efectos externos en la misma transacción; un worker los envía con reintentos (integraciones, webhooks, OSE). | `sys_outbox` | 05 (8), 07 (6), 13 (4), 00 (3), 04 (2) y 6 más |
| **Product 360 / Reserva 360 / Cliente 360** | Vistas de detalle con pestañas que concentran toda la información de un producto, una reserva o un cliente (configuración, historial, documentos, finanzas). | — | 01 (27), 02 (16), 05 (8), 04 (7), 06 (3) y 5 más |
| **Read model** | Vista o tabla derivada para consultas pesadas (KPIs, reportes) que se recalcula por eventos o jobs. | — | 14 (6), 01 (5), 09 (4), 15 (3), 00 (1) y 1 más |
| **Reverb** | Servidor WebSocket de Laravel para tiempo real (campana, tableros, chat web). | — | 05 (5), 10 (4), 00 (3), 06 (2), 15 (2) y 8 más |
| **RLS (Row Level Security)** | Política de PostgreSQL que filtra cada tabla por `tenant_id = current_setting('app.tenant_id')`; segunda barrera de aislamiento. | `90_rls.sql` | 13 (11), 09 (9), 00 (8), 02 (4), 11 (3) y 14 más |
| **Sanctum / abilities** | Tokens de Laravel Sanctum para el BFF y las apps; las abilities (`mfa:verify`, `supplier`, `customer`…) limitan la experiencia. | `personal_access_tokens` | 16 (36), 02 (33), 00 (31), 05 (22), 01 (19) y 14 más |
| **spatie/laravel-permission (teams)** | Paquete de roles y permisos; con *teams* el equipo es el tenant. | `roles`, `permissions`, `role_has_permissions` | 00 (4), 09 (3), 01 (1), 02 (1), 10 (1) y 2 más |
| **Webhook** | Llamada HTTP firmada (HMAC-SHA256) que el sistema envía a sistemas del tenant ante eventos (`reservation.confirmed`…) o que recibe de proveedores (pasarela, OSE, Meta). | `integration_webhooks`, `integration_webhook_deliveries` | 13 (53), 10 (11), 14 (9), 17 (9), 08 (7) y 4 más |

## Comercial (cotizaciones y reservas)

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **Acompañantes / datos nominativos** | Datos de cada pasajero (nombre, documento, nacionalidad, nacimiento) exigidos al reservar o antes del viaje (R-COMPANIONS); obligatorios para entradas nominativas (R-NOMINATIVE). | `booking_passengers` | 08 (11), 15 (10), 04 (4), 11 (4), 13 (1) y 2 más |
| **Aprobación interna** | Visto bueno de Manager/Tenant Admin requerido antes de enviar una cotización con descuento o margen fuera de política (QTE-BR-11/12). | `quote_internal_approvals`, `collab_approval_requests` | 03 (29), 10 (10), 04 (8), 09 (6), 00 (4) y 2 más |
| **Conversión (cotización → reserva)** | Paso idempotente que crea la reserva desde la versión aprobada, re-verifica disponibilidad dentro de la transacción y genera CxC 40/60 (PROC-025). | `booking_reservations.quote_id` | 01 (68), 04 (46), 03 (27), 14 (12), 15 (12) y 10 más |
| **Cotización / versión** | Propuesta de precio a un cliente con líneas, pax, moneda y vigencia; cada cambio crea una versión. Solo una versión `aprobada` genera reserva (RT-3) y es inmutable (RT-7). | `quote_quotes`, `quote_versions`, `quote_items` | 01 (64), 03 (62), 09 (40), 04 (31), 08 (30) y 8 más |
| **Hold (bloqueo de cupo)** | Retención temporal de cupos mientras se confirma una venta (carrito web, cotización en conversión, pagar después). Vence a los `hold_minutes` (R-HOLD) y un job lo libera (JOB-01). | `catalog_availability_holds`, `booking_inventory_holds` | 02 (74), 15 (38), 04 (20), 16 (16), 08 (8) y 3 más |
| **Pax / ADT / CHD / INF** | Pasajeros (pax) por tipo: adulto (ADT), niño (CHD) e infante (INF); el tipo se calcula por edad a la fecha del viaje según las reglas de pasajeros del producto. | `booking_passengers.pax_type`, `catalog_pax_rules` | 04 (66), 16 (28), 15 (27), 02 (23), 03 (18) y 7 más |
| **Penalidad** | Monto retenido al cancelar según la política snapshot (por días antes del viaje); nunca supera el total y los servicios ejecutados se retienen al 100 % (RES-BR-31). | `booking_cancellations` | 04 (22), 11 (19), 07 (3), 10 (3), 15 (1) |
| **Reprogramación** | Cambio de fecha de una reserva con diferencia tarifaria por temporada; anula vouchers y reinicia asignaciones (RES-BR-20…24). | `booking_changes` | 04 (30), 01 (10), 02 (2), 07 (2), 13 (2) y 1 más |
| **Reserva** | Venta confirmada o en proceso con pasajeros y servicios; estados borrador → confirmada → en_operacion → completada (y pendientes, reprogramada, cancelada). | `booking_reservations`, `booking_reservation_services` | 04 (121), 08 (108), 07 (96), 05 (66), 15 (45) y 14 más |
| **Snapshot** | Copia congelada de precios, políticas y configuración al momento de cotizar o reservar; cambios posteriores del catálogo no alteran la venta. | `booking_reservation_web_snapshots`, `catalog_product_versions` | 04 (31), 02 (22), 03 (16), 07 (7), 13 (7) y 11 más |
| **Titular** | Pasajero responsable de la reserva (uno por reserva, RES-V21-04); los demás son acompañantes. | `booking_passengers` | 08 (9), 06 (5), 14 (5), 04 (4), 15 (4) y 3 más |

## Operaciones

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **Asignación** | Recurso (guía, conductor, vehículo) asignado a un servicio; el recurso la confirma desde la app del operador. | `ops_assignments`, `ops_assignment_checkins` | 05 (74), 01 (11), 04 (8), 08 (6), 09 (4) y 5 más |
| **Documentos de viaje** | Checklist documental por pasajero (pasaporte, DNI, visas, menores) validado antes del viaje; bloquea emisiones nominativas si falta. | `ops_travel_doc_items` | 11 (23), 00 (5), 05 (2), 08 (1), 13 (1) |
| **Extranet de proveedores** | Portal del proveedor para responder solicitudes, rooming lists, vouchers, incidencias y ver pagos. | `supplier_*` | 05 (36), 06 (26), 07 (8), 10 (6), 00 (4) y 1 más |
| **Incidencia / SLA** | Evento durante la operación (retraso, accidente, reclamo) con severidad, responsable y plazo de atención (SLA) vigilado por job. | `ops_incidents`, `ops_incident_logs` | 05 (60), 06 (30), 10 (21), 08 (18), 01 (11) y 7 más |
| **MAPI** | Machu Picchu: sus entradas son nominativas (Ministerio de Cultura) y no se emiten sin documento validado del pasajero (DOC-BR-010). | — | 11 (12), 15 (1) |
| **Orden operativa** | Documento de ejecución de una reserva confirmada: tareas, asignaciones de guías/conductores/vehículos, solicitudes a proveedores y rooming. | `ops_orders`, `ops_order_tasks` | 04 (10), 05 (9), 00 (3), 10 (2), 11 (1) |
| **Rooming list** | Lista de habitaciones y huéspedes enviada al hotel; un pasajero no puede figurar en dos habitaciones del mismo intervalo (RT-13). | `ops_rooming_lists`, `ops_rooming_rooms`, `ops_rooming_guests` | 05 (71), 06 (38), 09 (2), 00 (1), 08 (1) |
| **Solicitud a proveedor** | Pedido de confirmación de un servicio al proveedor; este confirma con código, rechaza con motivo o propone alternativa desde la extranet. | `ops_supplier_requests`, `supplier_request_responses` | 05 (6), 04 (3), 06 (3), 11 (1) |
| **Voucher** | Documento que acredita un servicio ante el proveedor o el pasajero; solo se emite con servicio confirmado (RT-11), se versiona y se anula al reprogramar. | `ops_vouchers`, `ops_voucher_versions` | 05 (103), 08 (45), 06 (41), 15 (31), 00 (10) y 8 más |

## CRM

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **Campaña / segmento** | Envío masivo por email/WhatsApp a un segmento de contactos con consentimiento, prueba previa y atribución de ventas. | `mkt_campaigns`, `mkt_segments`, `mkt_consents` | 14 (61), 02 (10), 01 (7), 03 (6), 04 (2) y 5 más |
| **Cola comercial** | Leads sin asignar (`owner_id` NULL) que un asesor puede «tomar» de forma atómica (CRM-BR-08). | `crm_leads.owner_id` | 01 (4), 15 (1) |
| **Lead** | Contacto interesado aún no calificado (formulario web, WhatsApp, referido); pasa por cola comercial, contacto, calificación y conversión a cliente + oportunidad. | `crm_leads`, `crm_lead_qualifications` | 01 (202), 15 (25), 00 (18), 10 (16), 09 (15) y 2 más |
| **Meta comercial** | Objetivo de ventas por asesor/equipo y período con avance y bono (MET-BR). | `crm_sales_targets`, `crm_sales_target_adjustments` | 14 (80), 01 (14), 09 (12), 17 (4), 07 (3) y 6 más |
| **Oportunidad / embudo** | Negocio en curso con un cliente, con etapas del pipeline, monto esperado y resultado ganado/perdido. | `crm_opportunities`, `crm_pipeline_stages` | 01 (92), 03 (16), 09 (14), 14 (11), 00 (7) y 4 más |
| **Postventa / NPS** | Seguimiento después del viaje: encuesta NPS (0–10), detección de detractores (caso automático) y fidelización. | `crm_surveys`, `crm_cases` | 01 (43), 12 (4), 09 (3), 17 (3), 14 (2) y 2 más |

## Finanzas

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **Anticipo / saldo** | División del cobro de una reserva (40 % / 60 % al convertir; % configurable en el sitio con R-DEPOSIT) con vencimientos. | `fin_receivables.kind` | 07 (71), 15 (49), 04 (24), 12 (23), 08 (13) y 8 más |
| **Cierre de periodo** | Bloqueo contable de un mes tras un checklist; impide emitir o registrar con fechas del periodo cerrado (FIN-BR-48). | `fin_period_closes`, `fin_period_close_checks` | 07 (14) |
| **Comisión** | Importe que se paga a asesores o agencias B2B según reglas (porcentaje, metas, bonos). | `fin_commission_rules`, `fin_commissions` | 08 (43), 07 (41), 14 (16), 10 (9), 02 (7) y 7 más |
| **Comprobante electrónico (factura / boleta / nota)** | Documento fiscal SUNAT: factura (con RUC), boleta (consumidor final), notas de crédito/débito; series y correlativos sin huecos. | `fin_invoices`, `fin_invoice_lines`, `fin_document_series` | 07 (139), 13 (53), 06 (27), 15 (17), 00 (15) y 6 más |
| **Conciliación bancaria** | Cruce de movimientos del extracto bancario importado con pagos y payouts del sistema; cierre por cuenta y periodo. | `fin_bank_statements`, `fin_bank_lines`, `fin_reconciliation_closures` | 07 (30), 12 (3), 15 (3), 00 (1) |
| **CxC (cuenta por cobrar)** | Obligación de cobro al cliente (anticipo, saldo, penalidad); todo pago debe aplicarse a una CxC (RT-9). | `fin_receivables` | 07 (105), 04 (60), 08 (40), 15 (24), 00 (11) y 4 más |
| **CxP (cuenta por pagar)** | Obligación de pago a un proveedor por servicios de una reserva; se paga con payouts. | `fin_payables`, `fin_payable_payouts` | 07 (76), 06 (28), 10 (22), 02 (13), 12 (9) y 4 más |
| **IGV** | Impuesto General a las Ventas (18 %); 0 % en exportación de servicios a clientes no domiciliados (PRC-07). | `sys_settings (taxPct)` | 07 (16), 04 (10), 03 (8), 13 (7), 09 (4) y 5 más |
| **Libro de reclamaciones** | Registro obligatorio en Perú (normativa INDECOPI) de quejas y reclamos con plazo legal de respuesta; accesible a clientes y pasajeros. | `crm_claim_book_settings`, `crm_cases` | 15 (11), 12 (7), 01 (4), 08 (3), 00 (1) |
| **Liquidación** | Cierre económico de una reserva u operación: costos reales, CxP y rentabilidad final; también liquidación de comisiones a asesores/agencias. | `fin_settlements`, `fin_commissions` | 07 (27), 08 (17), 12 (7), 05 (2), 09 (2) y 4 más |
| **Moneda base / de cobro** | La base es la moneda contable del tenant (PEN); las de cobro son las aceptadas para pagar (PEN, USD); otras solo se muestran (R-MULTICURRENCY). | `fin_currencies` | 09 (4), 17 (4), 10 (2), 15 (2) |
| **OSE / PSE** | Operador de Servicios Electrónicos (valida y emite el CDR en nombre de SUNAT) o Proveedor de Servicios Electrónicos (genera/firma/envía por cuenta del emisor). El proveedor concreto está por definir. | `fin_fiscal_events`, `integration_adapters` | 07 (31), 13 (5), 00 (1), 06 (1), 09 (1) y 1 más |
| **Payout** | Pago efectivo a un proveedor que reduce el saldo de una CxP. | `fin_payable_payouts` | 07 (10), 12 (3) |
| **Rentabilidad** | Precio menos costo por reserva/servicio; visible solo con `finance.profitability` o permisos equivalentes. | `fin_settlements` | 07 (25), 02 (14), 09 (4), 00 (3), 05 (3) y 4 más |
| **RUC / DNI / CE** | Documentos peruanos: RUC (11 dígitos, empresas y personas con negocio), DNI (8 dígitos), carné de extranjería. | `crm_clients` | 07 (18), 01 (13), 15 (11), 09 (6), 08 (4) y 8 más |
| **SUNAT / UBL / CDR** | SUNAT es la autoridad tributaria peruana; UBL 2.1 es el XML del comprobante; CDR es la constancia de recepción (aceptado, observado, rechazado). | `fin_fiscal_events` | 07 (15), 13 (6), 00 (2), 06 (2), 09 (1) |
| **Tesorería / caja chica / arqueo** | Posición de bancos y cajas por sede: sesiones de caja, gastos, arqueos (conteo físico), reposiciones y transferencias. | `fin_treasury_accounts`, `fin_cash_sessions`, `fin_cash_counts` | 12 (52), 07 (6), 00 (1), 09 (1) |
| **Tipo de cambio (TC / FX)** | Conversión PEN/USD (y monedas de referencia) congelada en cada documento (RT-15); proveedor diario con alerta de variación. | `fin_fx_rates`, `fin_currencies`, `fx_rate_providers` | 07 (38), 17 (21), 15 (15), 09 (13), 12 (13) y 9 más |

## Canales

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **B2B / agencia asociada** | Venta a otras agencias con tarifa neta asignada, convenio con vigencia y línea de crédito; la agencia opera en su propio portal (RT-14). | `channel_b2b_agencies`, `channel_b2b_credit_movements` | 08 (187), 02 (48), 07 (33), 00 (29), 10 (11) y 11 más |
| **CMS** | Gestor de contenidos del sitio (páginas, blog, banners) con flujo editorial borrador → revisión → publicado. | `cms_contents`, `cms_content_events` | 08 (31), 15 (9), 02 (3), 17 (2), 09 (1) y 3 más |
| **E-commerce / checkout** | Venta directa en el sitio web: carrito con holds, pago en línea total/adelanto y creación automática de reserva y CxC. | `channel_ecom_orders`, `channel_web_carts` | 08 (84), 15 (47), 17 (29), 02 (12), 16 (12) y 8 más |
| **Inbox omnicanal** | Bandeja unificada de conversaciones (WhatsApp, email, chat web) con plantillas, asignación y creación de leads. | `collab_conversations`, `collab_messages` | 10 (46), 00 (14), 15 (11), 04 (6), 08 (4) y 6 más |
| **Portal del cliente / del pasajero** | Experiencias externas: el cliente ve sus cotizaciones, viajes, documentos y pagos; el pasajero su itinerario, vouchers y alertas (también en app). | `channel_portal_access_links` | 08 (42), 00 (14), 03 (5), 18 (4), 05 (3) y 6 más |
| **Reseña propia / externa** | Opinión verificada que el pasajero deja tras el viaje (R-OWN-REVIEWS), frente a reseñas importadas de TripAdvisor/Google. | `crm_own_reviews`, `channel_external_reviews` | 18 (41), 15 (26), 17 (22), 08 (7), 13 (2) |
| **Tarifa neta** | Precio B2B que paga la agencia asociada antes de su comisión o margen de reventa. | `catalog_product_b2b_rates`, `channel_b2b_price_lists` | 06 (12), 11 (5), 02 (4), 08 (3), 07 (2) y 2 más |
| **Ventana de 24 h (WhatsApp)** | Regla de Meta: fuera de las 24 h desde el último mensaje del cliente solo se pueden enviar plantillas aprobadas (INB-BR-02). | `collab_reply_templates` | 10 (2), 17 (1) |
| **Widget / publishable key** | Componente embebible en webs de terceros autenticado con clave pública `X-Qhapaq-Key` validada contra dominios verificados. | `channel_widget_config`, `channel_widget_domains` | 17 (52), 18 (9), 16 (8), 15 (6), 04 (1) |

## Documentación y pruebas

| Término | Definición | Tablas / código | Dónde aparece (spec) |
|---|---|---|---|
| **data-testid** | Atributo estable para selectores de Playwright; el contrato de selectores está en `kit-ia/tests`. | `kit-ia/tests/e2e` | — |
| **DemoSeeder / E2ESeeder** | Seeders de Laravel que cargan `kit-ia/seeds/*.json` (demo) y el estado de prueba E2E (tenant B, contraseña y TOTP comunes). | `kit-ia/seeds` | 00 (4), 02 (1) |
| **DOC-PROC-001** | Documento funcional inicial del cliente; sus «reglas transversales» numeradas se citan como RT-n. | — | 07 (6), 02 (4), 08 (4), 01 (2), 03 (2) y 7 más |
| **E2E-xx** | Escenario de prueba de extremo a extremo (Playwright) definido en la documentación (p. ej. E2E-08 aislamiento entre tenants). | `kit-ia/tests/e2e` | 05 (8), 09 (7), 00 (6), 02 (6), 04 (5) y 8 más |
| **PROC-xxx** | Identificador de proceso de negocio de la documentación inicial (p. ej. PROC-025 conversión cotización → reserva); cada spec lista los que cubre en su §1. | — | 05 (60), 07 (52), 01 (42), 02 (37), 09 (37) y 14 más |
| **Prototipo** | Aplicación navegable `proto/index.html` (HTML + JS sin backend, datos en `DB`) que define pantallas, reglas y comportamiento de referencia. | `proto/` | 07 (40), 08 (34), 05 (32), 02 (27), 01 (23) y 14 más |
| **RT-n (regla transversal)** | Regla transversal n de DOC-PROC-001 §30 (p. ej. RT-4 no confirmar sin disponibilidad, RT-22 idempotencia). Ver REGLAS-DE-NEGOCIO.md §3. | — | 08 (22), 05 (15), 01 (13), 07 (13), 15 (13) y 6 más |
| **Spec / especificación** | Documento técnico por módulo `proto/docs/especificaciones/NN-*.md` con la plantilla de 12 secciones de CONVENCIONES §8. | — | 01 (7), 08 (7), 05 (4), 09 (3), 00 (2) y 7 más |
| **XXX-BR-nn** | Regla de negocio de un módulo (CRM-BR, QTE-BR, RES-BR, FIN-BR…); se devuelve como `code` en errores 409/422. | — | 09 (114), 01 (97), 02 (95), 05 (80), 08 (78) y 12 más |

