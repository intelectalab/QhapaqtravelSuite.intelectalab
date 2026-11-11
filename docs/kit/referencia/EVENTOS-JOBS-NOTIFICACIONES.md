# Eventos de dominio, jobs, notificaciones, webhooks y tiempo real

> Generado por `kit-ia/referencia/tools/extract_events.py` desde la §8 de `proto/docs/especificaciones/*.md`, `kit-ia/api/openapi.json` (`x-realtime-channels`) y las semillas `jobs.json`, `settings.json` (`notifications`, `notifRules`) y `webhooks.json`. Texto literal de las especificaciones; cuando un dato no está definido se indica «Por definir».

**Cifras:** 144 eventos de dominio · 89 jobs · 115 notificaciones · 4 push móviles · 16 eventos de webhook saliente · 8 canales Reverb.

## 1. Marco común (spec 00 §8, CONVENCIONES §4)

- **Colas Horizon (Redis):** `critical` (pagos, conversión, revocación de tokens) · `default` · `notifications` · `documents` (PDF) · `integrations` (outbox, adapters) · `reports` (exportaciones, read models) · `low`. Supervisores por cola.
- **Jobs:** `TenantAware` (fijan `app.tenant_id` antes de tocar datos), `tries` + `backoff` exponencial, `ShouldBeUnique` cuando aplique, registro en `sys_job_runs`. Scheduler en `routes/console.php`.
- **Reintentos por defecto** (09 INT-BR-04/05): errores transitorios (timeout, 5xx, 429) con backoff `base × 2^intento` (1, 2, 4, 8, 16 min ± 20 % jitter), máx. 5; luego fallo definitivo + alerta + auditoría. Errores permanentes (4xx de validación, destinatario inválido) pasan directo a fallo definitivo. Donde la tabla de jobs no indica reintentos, aplica esta política.
- **Eventos de dominio:** se emiten **después del commit** (`afterCommit`); una notificación fallida nunca revierte la transacción (SEC-BR-22). Efectos externos garantizados vía outbox transaccional `sys_outbox` (cola `integrations`).
- **Notificaciones:** `NotificationDispatcher` (cola `notifications`) lee `notif_event_rules` del tenant, resuelve destinatarios, condición y momento (inmediato / lote 15 min / horario laboral), elige plantilla por canal y crea `notif_messages` (`pendiente`); un job por canal envía por adapter (`MailSender`, `MessagingChannel`, FCM/APNs, Portal = registro + broadcast Reverb). Canales: Email, WhatsApp, Push, Portal.
- **Tiempo real:** Laravel Reverb; canal privado por usuario `private-tenant.{tenantId}.user.{userId}` (campana, cambios de permisos → refrescar `/me/access`) y canales de tablero listados en §6.

## 2. Eventos de dominio

| Spec | Evento | Disparador / emisor | Listeners / efecto | Cola | Notificación asociada |
|---|---|---|---|---|---|
| 00 | `UserLoggedIn` / `LoginFailed` / `UserLoggedOut` | — | Auditoría (`login`, `login_fallido`, `logout`); `last_login_at/ip` | — | — |
| 00 | `AccessDenied` | — | Auditoría `acceso_denegado`; métrica de seguridad; alerta si > 20/min por usuario | — | — |
| 00 | `CrossTenantAttempt` | — | Auditoría + alerta de seguridad a plataforma | — | — |
| 00 | `PermissionsChanged` / `UserRoleChanged` | — | Flush caché spatie del tenant; broadcast para refrescar `/me/access` | — | — |
| 00 | `TokensRevoked` | — | Baja, reset MFA, suspensión de tenant | — | — |
| 01 | `LeadCreated` | alta / ingreso sistema | notificación si asignado (`notifications`) | notifications | — |
| 01 | `LeadAssigned` / `LeadTaken` | assign / take | notificación al asesor / a Managers (`notifications`) | notifications | — |
| 01 | `LeadQualified`, `LeadStatusChanged`, `LeadDiscarded`, `LeadMerged` | servicios | auditoría (sync), read models (`low`) | low | — |
| 01 | `LeadConverted` | convert | notificación owner (`notifications`), `ClientCreated`, `OpportunityCreated` (`critical` para consistencia) | critical, notifications | — |
| 01 | `OpportunityCreated`, `OpportunityStageChanged`, `OpportunityWon`, `OpportunityLost`, `OpportunityReassigned` | servicios | notificaciones, invalidar cache de dashboards (`default`) | default | — |
| 01 | `ActivityScheduled`, `ActivityCompleted`, `ActivityRescheduled`, `ActivityReassigned` | servicios | `ActivityCompleted` → CRM-BR-30; notificación de asignación | — | — |
| 01 | `SurveyRecorded` / `DetractorDetected` | encuesta | caso + actividad (misma transacción) + Email al responsable | — | — |
| 01 | `CaseCreated`, `CaseStatusChanged`, `CaseClosed` | casos | notificación al owner / al cliente | — | — |
| 01 | `ClientCommunicationRequested` | 360 | adapter del canal vía `notif_messages` (`notifications`, reintentos/backoff) | notifications | — |
| 01 | Consumidos: `QuoteCreated`, `QuoteNegotiationRecorded`, `QuoteConverted` (Cotizaciones) | módulo Ventas | CRM-BR-27 (`default`) | default | — |
| 01 | Consumido (propuesto): `ReservationCompleted` (Operaciones) | cierre operativo | crear actividad Postventa (ver §12) | — | — |
| 02 | `ProductCreated` | Alta/duplicado | Auditoría (`default`) | default | — |
| 02 | `ProductSubmittedForReview` | DRAFT→REVIEW | Notificar aprobadores; ítem en bandeja de aprobaciones (`notifications`) | notifications | `producto.revision` · Portal → Manager (U02) |
| 02 | `ProductActivated` | →ACTIVE | Notificar ventas; invalidar caché de catálogo/canales; reindexar búsqueda (`notifications`, `low`) | notifications, low | `producto.activado` · Email → Ventas (U03) |
| 02 | `ProductBecameUnsellable` | →SUSPENDED/INACTIVE | Notificar ventas y canales; despublicar de e‑commerce/B2B en caché (`notifications`) | notifications | `producto.no_vendible` · Push → Ventas (U04) |
| 02 | `ProductStatusChanged` | Cualquier transición | Auditoría | — | — |
| 02 | `ProductVersionCreated` | Nueva versión | Auditoría; `current_version_id` | — | — |
| 02 | `RatePriceChanged` | Cambio de precio | Auditoría (PRD-T11); recalcular `from_price` (`low`) | low | — |
| 02 | `ProductPublished` / `ProductUnpublished` | Canal | Sincronizar CMS/e‑commerce/B2B (`integrations`, outbox) | integrations | — |
| 02 | `DepartureCancelled` (con vendidos) | Edición de salida | Notificar operaciones para reprogramar (`notifications`) | notifications | `salida.cancelada` · Email → Operaciones (U05) |
| 02 | `AvailabilityHoldCreated/Confirmed/Released/Expired/Consumed` | Holds | Auditoría; broadcast ocupación (Reverb canal `tenant.{id}.catalog.departures`) | — | `disponibilidad.confirmada` · Portal → creador del hold |
| 02 | `ProviderActivated` | Activar proveedor | Notificar operaciones | — | `proveedor.activado` · Email → Operaciones (U05) |
| 02 | `ProviderDeactivated` (con productos ACTIVE) | Desactivar | Notificar gerencia | — | `proveedor.desactivado` · Email → Manager (U02) |
| 03 | `QuoteCreated` | POST quotes | default: actualizar etapa de oportunidad | default | — |
| 03 | `QuoteVersionCreated` | nueva versión / duplicar | default | default | — |
| 03 | `QuoteInternalApprovalRequested` | solicitud | notifications + Reverb bandeja | notifications | `cotizacion.aprobacion_solicitada` · Portal → cada manager activo |
| 03 | `QuoteInternalApprovalDecided` | aprobar/rechazar | notifications | notifications | `cotizacion.aprobacion_aprobada\|rechazada` · Portal → dueño (si decide otro) |
| 03 | `QuoteSent` | send | notifications (1 job por canal, adapter Email/WhatsApp/Portal), documents (PDF adjunto) | notifications, documents | `cotizacion.enviada` · canal elegido → cliente |
| 03 | `QuoteViewed` | portal / manual | notifications | notifications | `cotizacion.vista` · Portal → dueño |
| 03 | `QuoteNegotiationRecorded` | negociación | default: oportunidad → negociación | default | — |
| 03 | `QuoteApproved` | approve (interno o portal) | notifications | notifications | `cotizacion.aprobada` · Push → dueño; Email → cliente |
| 03 | `QuoteRejected` | reject | notifications | notifications | `cotizacion.rechazada` · Portal → dueño |
| 03 | `QuoteReassigned` | reassign | notifications | notifications | `cotizacion.reasignada` · Portal → nuevo dueño |
| 03 | `QuoteExpired` | JOB-02 | low | low | (propuesto) aviso al dueño |
| 03 | `QuoteConverted` | convert | critical | critical | ver 04 |
| 05 | `OperationOrderCreated` | Crear orden | Email coordinador (`notifications`); audit | notifications | — |
| 05 | `OperationStatusChanged` | Transiciones §4.1 | Reserva `en_operacion`/`completada` (`critical`); Reverb tablero ops | critical | — |
| 05 | `SupplierRequestSent` / `SupplierConfirmed` / `SupplierRejected` / `SupplierAlternativeProposed` | PROC-032 | Email proveedor / coordinador; portal extranet; Reverb | — | — |
| 05 | `ServiceAssigned` (`ResourcesAssigned`) | Asignar | Push (Expo) + WhatsApp al recurso según casillas; invalidación de caché de ocupación | — | — |
| 05 | `AssignmentConfirmed`, `AssignmentReleased` | Web/móvil | Push coordinador / WhatsApp recurso | — | — |
| 05 | `ServiceStarted`, `PassengerCheckedIn`, `ServiceFinished` | Móvil | Push coordinador; Reverb orden 360; alerta al pasajero (opcional, §12) | — | — |
| 05 | `EvidenceUploaded` | Web/móvil/extranet | Job de procesamiento (`documents`) | documents | — |
| 05 | `VoucherIssued`, `VoucherVersioned`, `VoucherVoided`, `VoucherRedeemed` | PROC-035 | PDF (`documents`); email cliente, push pasajeros, email proveedor; portal | documents | — |
| 05 | `IncidentCreated`, `IncidentEscalatedCritical`, `IncidentAssigned`, `IncidentResolved`, `IncidentClosed`, `IncidentReopened` | PROC-037 | Email coordinador; crítica → push + WhatsApp Manager (cola `critical`); push responsable | critical | — |
| 05 | `RoomingListConfirmed`, `RoomingListSent` | PROC-034 | PDF + email hotel | — | — |
| 05 | `OperationClosed` | PROC-039 | Finanzas: habilita liquidación de CxP y rentabilidad; email coordinador; notificación portal cliente ("Su viaje … ha finalizado. Cuéntenos su experiencia"); CRM postventa | — | — |
| 05 | `MobileSyncConflictResolved` | Sync | Audit + métrica | — | — |
| 06 | `SupplierConfirmed` | Confirmar solicitud | Actualiza orden 360 (Reverb); desbloquea voucher; cierra tarea "Enviar solicitudes…" si todas respondidas (propuesto) Actualiza orden 360 (Reverb); desbloquea voucher; cierra tarea "Enviar solicitudes…" si todas respondidas (propuesto) | — | Portal → Operaciones (U05, U06): "{proveedor} confirmó {servicio} ({reserva}) · código …" |
| 06 | `SupplierRejected` | Rechazar | Tarea/alerta de búsqueda de alternativa Tarea/alerta de búsqueda de alternativa | — | Portal → Operaciones: "… rechazó …: motivo" |
| 06 | `SupplierAlternativeProposed` | Alternativa | Bandeja de alternativas; job de expiración de `hold_until` Bandeja de alternativas; job de expiración de `hold_until` | — | Portal → Operaciones |
| 06 | `RoomingAcknowledged` / `RoomingConfirmedByHotel` | Rooming | — — | — | Portal → Operaciones |
| 06 | `RoomingObservationReported` → `IncidentCreated` | Observación | SLA de incidencia SLA de incidencia | — | Portal → Operaciones `incidencia.creada` |
| 06 | `VoucherRedeemed` | Canje | Evidencia de prestación para liquidación (Finanzas) Evidencia de prestación para liquidación (Finanzas) | — | Portal → Operaciones `voucher.utilizado` |
| 06 | `SupplierInvoiceUploaded` | Factura | Tarea de validación en CxP Tarea de validación en CxP | — | Portal → Finanzas (U07) `proveedor.factura` |
| 06 | `IncidentCreated` (extranet) | Nueva incidencia | Crítica → alerta a gerencia push + WhatsApp (alinear con PROC-037) Crítica → alerta a gerencia push + WhatsApp (alinear con PROC-037) | — | Portal → Operaciones `incidencia.creada` o `incidencia.critica` |
| 06 | `IncidentCommentAdded` | Comentario | — — | — | Portal → Operaciones y responsable |
| 06 | `RateUpdateRequested` | Solicitud de tarifa | Tarea en Catálogo › Proveedores Tarea en Catálogo › Proveedores | — | Portal → Operaciones (U05) y Manager (U02) `proveedor.tarifa` |
| 07 | `ReceivableCreated` (`kind`) | Anticipo, Reservas, Canales | Notificación `pago.solicitud` (notifications) | notifications | — |
| 07 | `PaymentRegistered` / `PaymentValidated` | Pagos | Auditoría; tablero en tiempo real (Reverb) | — | — |
| 07 | `PaymentApplied` | Registrar, aplicar, conciliación→aplicar | Recalcular CxC, sincronizar reserva (critical); `pago.recibido`; KPIs caja | critical | — |
| 07 | `PaymentRejected` | Rechazo | `pago.rechazado` (notifications) | notifications | — |
| 07 | `PaymentReverted` | Reversión | Recalcular CxC, liberar crédito B2B (critical); `pago.revertido`; control "reversión sin NC" | critical | — |
| 07 | `PayableApproved` / `CostApproved` | CxP | Recalcular rentabilidad (default) | default | — |
| 07 | `SupplierPaymentRegistered` | Payout | `pago.proveedor` (notifications); extranet del proveedor | notifications | — |
| 07 | `CommissionsCalculated` / `CommissionApproved` / `CommissionPaid` | Comisiones | `comision.pagada` | — | — |
| 07 | `ReservationSettled` | Liquidación | `reserva.liquidada` (portal, responsable) | — | — |
| 07 | `InvoiceRequested` | Emisión | Outbox → `SendInvoiceToFiscalProvider` (integrations) | integrations | — |
| 07 | `InvoiceAccepted` / `InvoiceObserved` / `InvoiceRejected` | Respuesta OSE | Actualiza estado; `GenerateInvoicePdf` (documents); alerta a Contabilidad si observado/rechazado | documents | — |
| 07 | `InvoiceDelivered` | Entrega | `comprobante.emitido` (email + portal) | — | — |
| 07 | `BankStatementImported` | Conciliación | `NormalizeBankStatement` (default) | default | — |
| 07 | `ReconciliationClosed`, `AccountingPeriodClosed` | Cierres | `contabilidad.cierre` (email a Finanzas) | — | — |
| 08 | `B2bAgencyCreated/Updated/Blocked/Unblocked` | Admin B2B | Auditoría; email a agencia (`notifications`) | notifications | — |
| 08 | `B2bRateAssigned/Removed` | Tarifas B2B | Invalida caché catálogo B2B (`low`) | low | — |
| 08 | `B2bReservationCreated` | Portal B2B | Reservas (`ReservationCreated`), Finanzas (CxC, comisión `calculada`), crédito (movimiento), Operaciones (orden si confirmada), notificaciones (`critical` para la transacción, `notifications` para avisos) | critical, notifications | — |
| 08 | `B2bCreditExceededAttempt` | Portal B2B | Auditoría; alerta a ejecutivo B2B | — | — |
| 08 | `B2bPaymentReported` | Portal B2B | Bandeja de Finanzas (validación, PROC-049) | — | — |
| 08 | `PaymentApplied` (Finanzas) | Finanzas | Libera crédito B2B (`credit_movements`) | — | — |
| 08 | `B2bSettlementRequested` | Portal B2B | Finanzas comisiones | — | — |
| 08 | `EcomOrderCreated` | Checkout | Hold de cupos; `hold_expires_at` | — | — |
| 08 | `EcomPaymentFailed` / `EcomPaymentApproved` | Webhook pasarela (`critical`) | Pago, CxC, reserva, voucher, emails | — | — |
| 08 | `EcomOrderCancelled` / `EcomOrderExpired` | Gestión / job | Libera cupos, cancela reserva y CxC | — | — |
| 08 | `ProductPublishedToChannel` / `Unpublished` | E-commerce | Invalida caché pública; sitemap (espec. 15) | — | — |
| 08 | `CmsContentStatusChanged` | CMS | Invalida caché pública; notificaciones | — | — |
| 08 | `QuoteViewed`, `QuoteApproved`, `QuoteRejected` (canal portal) | Portal cliente | Cotizaciones/CRM; notificaciones al asesor | — | — |
| 08 | `ClientPortalPaymentApplied` / `Failed` | Portal cliente | Finanzas; emails | — | — |
| 08 | `SupportTicketCreated` | Portales | Inbox/asesor/coordinador | — | — |
| 08 | `IncidentAlertAcknowledged` | Portal pasajero | Operaciones | — | — |
| 09 | `TenantProvisioned` | alta | enviar invitación admin (`notifications`), crear bucket/rutas S3, sembrar jobs del tenant (`default`) | default, notifications | — |
| 09 | `TenantSuspended` / `TenantReactivated` | suspender/reactivar | revocar tokens (`critical`), pausar/reanudar jobs, notificar admin | critical | — |
| 09 | `TenantPlanChanged` | cambio de plan | recalcular entitlements, facturación de plataforma | — | — |
| 09 | `UserInvited` / `UserActivated` / `UserDeactivated` / `UserRoleChanged` / `UserMfaReset` | PROC-002 | revocar tokens en baja/cambio de rol; flush caché permisos; notificaciones | — | — |
| 09 | `PermissionsChanged` | matriz de roles | `app(PermissionRegistrar::class)->forgetCachedPermissions()` por tenant; broadcast Reverb para refrescar menú de usuarios con ese rol | — | — |
| 09 | `SettingsUpdated` | configuración | invalidar caché `settings:{tenant}` en Redis | — | — |
| 09 | `NotificationRequested` | cualquier módulo vía `Notify` | resolver regla → plantilla → canales → `SendNotification` (`notifications`) | notifications | — |
| 09 | `ExportRequested` | exportar | `GenerateExport` (`reports`) | reports | — |
| 09 | `InternalApprovalGranted` | dashboard Manager | notificación Portal al vendedor | — | — |
| 10 | Listeners `QuoteApprovalRequested`, `QuoteVersionSaved`, `ReservationCancelRequested`, `PaymentReversalRequested`, `PayableRegistered`, `CommissionCalculated`, `SupplierRateRequested` | Eventos de dominio de cada módulo | `ApprovalRequestFactory::fromSubject()` (reemplaza el `sync()` del prototipo) | default | — |
| 10 | Listeners `QuoteInternallyApproved`, `ReservationCancelled`, `PaymentReverted`, `PayableApproved`… | Resolución en origen | Cierra solicitud `closed_in_origin` | default | — |
| 10 | `ApprovalRequested`, `ApprovalLevelApproved`, `ApprovalDecided`, `ApprovalInfoRequested`, `ApprovalDelegated` | Servicio de decisión | Notificación portal/email a aprobadores, solicitante, delegado; broadcast Reverb `tenant.{t}.user.{u}` (contador de menú) | notifications | — |
| 10 | `ExecuteApprovalEffect` | Aprobación final (síncrono en transacción; job solo para efectos externos: emails, PDF NC) | Outbox `sys_outbox` para notificaciones de cliente/proveedor | critical | — |
| 10 | `ScanAttachment` | Subida | Antivirus; bloquea envío si infectado | default | — |
| 10 | `SupportTicketCreated` listener | Portal cliente/pasajero | Crea conversación canal `portal` | default | — |
| 11 | Listener `ConsumeAllotmentOnServiceChange` (eventos `BookingServiceConfirmed`, `BookingServiceCancelled`, `ReservationCancelled`, `ReservationRescheduled`) | — | `critical` Recalcula `catalog_allotment_consumptions` y `used_qty/pending_qty` con `Cache::lock("allot:{id}:{date}")`; si queda disponible < 0 emite `AllotmentOverbooked` | critical | — |
| 11 | Listener `CreateTravelDocChecklist` (`ReservationConfirmed`, `PassengerUpdated`) | — | `default` Crea/ajusta ítems | default | — |
| 12 | `PaymentConfirmed`, `PaymentApplied`, `PaymentReverted` | — | `TreasurySyncListener` crea el movimiento (idempotente por `source_key`) | critical | — |
| 12 | `SupplierPaymentRegistered` | — | Egreso por payout | critical | — |
| 12 | `PettyCashExpenseRegistered` | — | Si el saldo < umbral: notificación `caja.umbral` (Portal a Finanzas) | default | — |
| 12 | `CashCountSigned` (con diferencia > tolerancia) | — | `arqueo.diferencia` al Manager (Portal/Reverb) | notifications | — |
| 12 | `CashReplenishmentRequested/Approved/Rejected/Paid` | — | `caja.reposicion*` al aprobador, solicitante o custodio | notifications | — |
| 12 | `FxRevaluationRegistered` | — | Asiento contable (integración contable futura vía `sys_outbox`) | default | — |
| 12 | `ClaimBookEntryReceived` | — | Constancia PDF (`reclamacion.constancia`, email) y aviso al responsable (`reclamacion.nueva`) | notifications, documents | — |
| 12 | `ClaimAnswered` | — | Email con la respuesta (`reclamacion.respuesta`); `sent_at` al confirmar el proveedor de correo (webhook) | notifications, documents | — |
| 14 | Webhooks email/WhatsApp | on demand | Actualiza `recipients` (entregado/abierto/clic/respuesta/rebote); respuesta «BAJA» o enlace → `ConsentRevoked` | integrations | — |
| 14 | `ConsentRevoked` | evento | Confirmación de baja al titular (PROC-059), invalida caché de audiencias | notifications | — |
| 14 | `RecomputeAttribution` | cada hora y en `ReservationCreated`/`LeadCreated`/`EcomOrderPaid` | Recalcula `mkt_attributions` (MKT-BR-10) | reports | — |
| 14 | Plantilla WA enviada a Meta | on demand | Adapter WhatsApp Business (INT-04) | integrations | — |
| 14 | `SalesTargetProgress` (read model) | cada 15 min y en eventos de reserva/oportunidad | Materializa avance/proyección por meta | reports | — |
| 14 | `SalesTargetsPendingClose` | diario 08:00 | Notifica al Manager metas vigentes con período terminado | low | — |
| 14 | `SalesTargetClosed` | evento | Crea comisión «Bono por meta» (idempotente por target) → `CommissionCalculated` | critical | — |
| 14 | Notificaciones | — | `marketing.prueba`, `marketing.programada`, `marketing.enviada`, `marketing.baja`, `marketing.auto.<key>`, `meta.asignada` (Portal + Email al asesor al activar/ajustar/cerrar), `comision.bono_meta` (Email a Finanzas) | — | — |
| 16 | `AvailabilityRangeChanged` (crear/editar/eliminar/cerrar fechas/operación) | — | `InvalidateAvailabilityCache` | critical | — |
| 16 | `AvailabilityClosedWithSales` | — | `NotifyOperationsAffectedBookings` (email + inbox a Operaciones con reservas afectadas) | notifications | — |
| 16 | `BookingRuleChanged` (tenant u override) | — | `InvalidateRulesCache`, `InvalidateAvailabilityCache` (todo el tenant o el producto) | critical | — |
| 16 | `ProductBookingConfigChanged` (pax, adicionales, alojamiento, pago, recojo) | — | `InvalidateQuoteCache`, `ReindexPublicCatalog` | default | — |
| 16 | Scheduler cada 5 min | — | `ExpireCheckoutHolds` (R-HOLD) y `ReleasePayLaterHolds` (R-PAY-LATER) | critical | — |
| 16 | Scheduler diario | — | `EvaluateMinimumGroup` (R-MIN-GROUP: si no se alcanza `minPax` a `decisionDays`, propone reprogramar) | default | — |
| 17 | `BookingRuleChanged` | — | default Invalida `rules:{tenant}` en Redis; si afecta comunicaciones despacha `SchedulePaxMessages` | default | — |
| 17 | `DispatchDuePaxMessages` (cada minuto) | — | notifications Envía `programado` con `scheduled_at ≤ now()`; `tries=5`, backoff exponencial; `fallido` al agotar | notifications | — |
| 17 | `ServiceScheduleChanged` / `IncidentCreated` | — | notifications Dispara PMT-007 (cambio de horario) | notifications | — |
| 17 | `SyncExternalReviews` (cada 6 h por fuente) | — | integrations Importa reseñas nuevas (upsert por `external_id`), actualiza rating/cantidad; 401/403 → estado `error` | integrations | — |
| 17 | `PublishReviewReply` | — | integrations Publica respuestas `pendiente_publicar` en APIs que lo permiten | integrations | — |
| 17 | `fx:update-daily` → `RefreshFxRates` (v2.2; diario 08:00 America/Lima por tenant; `ShouldBeUnique` por tenant) | — | integrations Consulta el proveedor activo, inserta `fin_fx_rates` del día por moneda activa, calcula `daily_change_pct`; si supera `fx_alert_pct` marca `alert_raised` y notifica a Finanzas (`fx.variacion_alta`); fallo → conserva el último valor, `fx_rate_providers.last_error` y aviso | integrations | — |
| 17 | `VerifyWidgetDomain` (cada 10 min, 72 h) | — | low Busca TXT; al verificar publica CORS/CSP | low | — |
| 17 | `ExpireWidgetHandoffs` (hora) | — | low `pendiente → expirado` a las 24 h | low | — |
| 17 | Eventos del widget en el navegador | — | — `kipucontrol:ready`, `kipucontrol:resize`, `kipucontrol:date_selected`, `kipucontrol:quote`, `kipucontrol:checkout` (CustomEvent / postMessage a orígenes verificados) | — | — |
| 18 | `OwnReviewSubmitted` | — | `Notify` a admin y asesor dueño («Nueva reseña n★…») | notifications | — |
| 18 | `OwnReviewPublished/Hidden/Rejected` | — | Invalida cache `public:reviews:{product}` y feed del widget | default | — |
| 18 | `OwnReviewReplied` | — | Correo al pasajero + mensaje en portal (`pax_messages`) | notifications | — |
| 18 | Prototipo | — | `Notify.push('resena.nueva'\|'resena.respuesta'\|'resena.invitacion', …)` | — | — |

## 3. Jobs y scheduler

| Spec | Job | Cola Horizon | Disparador / cron | Qué hace | Reintentos |
|---|---|---|---|---|---|
| 01 | JOB-04 Recordatorio de actividades CRM | Por definir | cada hora | Marca `vencida` las pendientes con `due_at < now()` y envía recordatorio al owner de las vencidas o del día (Push/Portal) | Política general (§1) |
| 01 | (existente en Admin) JOB-08 Reportes programados | Por definir | lunes 07:00 | Puede incluir KPIs CRM de gerencia | Política general (§1) |
| 01 | Exportaciones CSV | reports | on-demand | Cola `reports`; archivo en S3; auditoría | Política general (§1) |
| 02 | `ExpireAvailabilityHolds` (JOB-01) | critical | cada 5 min (`routes/console.php`) + manual | holds `hold` con `expires_at < now` → `expirada`; `ShouldBeUnique`; registra en `sys_job_runs` (`last`, `lastResult` “N hold(s) expirado(s)”) | Política general (§1) |
| 02 | `MarkExpiredProviderContracts` | default | diario 00:10 | proveedores `activo` con `contract_end < today` → `vencido`; notifica productos ACTIVE afectados | Política general (§1) |
| 02 | `ProviderContractExpiryAlerts` | notifications | diario | contratos que vencen en ≤95 días (umbral del KPI) | Política general (§1) |
| 02 | `ServiceValidityAlerts` | notifications | diario | servicios que vencen en ≤90 días (KPI) o ≤60 (alerta en ficha) | Política general (§1) |
| 02 | `RateValidityAlerts` | notifications | diario | productos ACTIVE sin tarifa vigente (KPI “Productos sin tarifa vigente”) | Política general (§1) |
| 02 | `GenerateProductSheetPdf` | documents | on demand | Ficha comercial PDF (itinerario, incluye/no incluye, requisitos, políticas, precio desde) | Política general (§1) |
| 02 | `ExportCatalogCsv` | reports | on demand | Exportaciones de tablas (auditadas) | Política general (§1) |
| 05 | `ExpireUnconfirmedAssignments` (JOB-09) | default | cada 30 min | Asignaciones `asignada` no confirmadas dentro de X h antes del servicio → alerta al coordinador (regla a definir, §12) | Política general (§1) |
| 05 | `DetectPendingSupplierServices` (JOB-06) | default | cada 2 h | Servicios `pendiente`/`solicitado` próximos → alerta/tarea | Política general (§1) |
| 05 | `NotifyUpcomingTrips` (JOB-05) | notifications | diario 05:00 | Recordatorios 48 h a pasajeros (alertas app) | Política general (§1) |
| 05 | `IncidentSlaMonitor` | critical | cada 5 min | Marca SLA vencido, notifica responsable y Manager | Política general (§1) |
| 05 | `ResourceDocumentAlerts` | notifications | diario | Licencias y SOAT ≤ 30 días | Política general (§1) |
| 05 | `GenerateVoucherPdf`, `GenerateRoomingPdf` | documents | on-demand | Browsershot; versionado en `sys_documents` con hash | Política general (§1) |
| 05 | `ProcessEvidence` | documents | on-demand | Validar MIME/tamaño, EXIF/rotación, miniatura, hash | Política general (§1) |
| 05 | `SendExpoPush` | notifications | on-demand | Expo Push API; manejo de tickets/receipts y tokens inválidos (desactiva `expo_push_token`) | Política general (§1) |
| 05 | `PurgeMobileSyncLog` | low | diario | Retención de `ops_sync_actions` (90 días propuesto) | Política general (§1) |
| 06 | `RemindPendingSupplierRequests` | notifications | cada 2 h (integrado a JOB-06) | Solicitudes sin respuesta > 24 h o servicio en ≤ 48 h → email/WhatsApp al proveedor y alerta a Operaciones | Política general (§1) |
| 06 | `ExpireSupplierAlternativeHolds` | default | diario | Alternativas con `hold_until` vencido y sin revisión → `expirada` | Política general (§1) |
| 06 | `ProviderContractExpiryAlerts` | notifications | diario | Contratos con vencimiento < 60 días → proveedor y Catálogo | Política general (§1) |
| 06 | `ProcessSupplierInvoice` | documents | on-demand | Validar XML UBL (RUC emisor = proveedor, receptor = tenant, importe), guardar hash | Política general (§1) |
| 07 | `SendInvoiceToFiscalProvider` | integrations | Outbox | `tries` 5, backoff exponencial, `ShouldBeUnique` por invoice; registra `fin_fiscal_events`; fallo definitivo → alerta (PROC-065) | `tries` 5, backoff exponencial, `ShouldBeUnique` por invoice |
| 07 | `PollFiscalStatus` | integrations | Cada 5 min para `emitido` > N min **[por validar según proveedor]** | Reemplaza la simulación de 1,4 s y el botón manual | Política general (§1) |
| 07 | `GenerateInvoicePdf` / `GenerateAccountStatementPdf` | documents | Evento | `sys_documents` con hash | Política general (§1) |
| 07 | `NormalizeBankStatement` | default | Importación | Parser por banco (CSV/TXT/XLSX) **[por validar formatos]** | Política general (§1) |
| 07 | `fin:mark-overdue` | low | Diario 00:05 hora del tenant | CxC/CxP `vencida` | Política general (§1) |
| 07 | `fin:payment-reminders` | notifications | Diario (DOC-PROC-001 §26.3) | Prototipo: solo manual; política de días a definir | Política general (§1) |
| 07 | `fin:calculate-commissions` | default | Diario (opcional) | Prototipo: manual | Política general (§1) |
| 07 | `fin:import-fx-rate` | integrations | Diario | Fuente por validar (SBS/SUNAT) | Política general (§1) |
| 07 | `ExportJob` | reports | Exportar CSV | PROC-061 | Política general (§1) |
| 08 | `ExpireEcomHolds` (agregado) | critical | cada 5 min (junto con JOB-01 "Expirar holds") | Pedidos `pago_pendiente/pago_rechazado` con `hold_expires_at < now` → `expirado`, libera cupos, cancela reserva/CxC | Política general (§1) |
| 08 | `MarkB2bAgreementsExpired` (derivado, opcional) | low | diario 00:10 | Notifica agencias con convenio por vencer (30/7 días) y vencidos | Política general (§1) |
| 08 | `RecalculateB2bCredit` (control) | low | diario | Verifica `credit_used` = suma de movimientos; alerta si difiere | Política general (§1) |
| 08 | `GenerateDocumentPdf` | documents | on demand | Propuesta, voucher, itinerario, comprobante, certificado | Política general (§1) |
| 08 | `SendNotification` | notifications | on event | Email/WhatsApp/Portal/Push con reintentos (PROC-059) | reintentos (PROC-059) |
| 08 | `SyncWebAnalytics` (agregado) | integrations | cada hora | Sesiones/vistas/inicio de checkout para el embudo (hoy simulados) | Política general (§1) |
| 09 | JOB-01 · Expirar holds de disponibilidad | critical | cada 5 min | Libera holds vencidos según `hold_minutes` | Política general (§1) |
| 09 | JOB-02 · Marcar cotizaciones vencidas | default | diario 00:05 | Cotizaciones `borrador/enviada/vista/negociacion` con `validUntil < hoy` → `vencida`; audita `vencer` por cotización | Política general (§1) |
| 09 | JOB-03 · Recordatorios de pago | notifications | diario 09:00 | CxC no pagadas con vencimiento ≤ `pay_reminder_days` → email `pago.recordatorio` | Política general (§1) |
| 09 | JOB-04 · Recordatorio de actividades CRM | notifications | cada hora | Cuenta actividades no completadas con vencimiento ≤ hoy | Política general (§1) |
| 09 | JOB-05 · Notificar próximos viajes | notifications | diario 05:00 | Reservas `confirmada/pendiente_pago` con inicio ≤ `trip_notice_hours` → email `viaje.proximo` | Política general (§1) |
| 09 | JOB-06 · Detectar reservas pendientes de proveedor | default | cada 2 h | Servicios `solicitado/pendiente`; si hay → estado `advertencia` | Política general (§1) |
| 09 | JOB-07 · Sincronizar proveedores (adapters) | integrations | cada 6 h | Reintento con backoff `2^attempt` min; al llegar a `max` → `fallo_definitivo`, email `integracion.fallo` a Operaciones, audita | Reintento con backoff `2^attempt` min |
| 09 | JOB-08 · Reportes programados (gerencia) | reports | lunes 07:00 | Genera y envía PDF a destinatarios; crea `report_exports` | Política general (§1) |
| 09 | JOB-09 · Expirar asignaciones no confirmadas | default | cada 30 min | Asignaciones `pendiente` con más de `assign_expiry_min` | Política general (§1) |
| 09 | JOB-nn · Reporte programado: {reporte} | reports | definido por usuario | Igual que JOB-08 con formato y destinatarios propios | Política general (§1) |
| 10 | `approvals:sla-check` (scheduler cada 5 min, `ShouldBeUnique`) | low | — | 75 % del SLA: advertencia al aprobador; vencido: evento `sla_vencido`, notificación al aprobador y al Manager (escalamiento) | Política general (§1) |
| 10 | `ProcessInboundMessage` | integrations | Webhook / formulario / email inbound | Idempotencia, resolución de contacto, crea/actualiza conversación, reabre, `MessageReceived` Reverb | Política general (§1) |
| 10 | `SendOutboundMessage` (tries 5, backoff exponencial) | integrations | Respuesta del agente | Envío por adaptador (`WhatsAppCloudAdapter`, `SmtpAdapter`, `PortalAdapter`); estado de entrega | tries 5, backoff exponencial) |
| 10 | `ProcessDeliveryStatus` | integrations | Webhook de estado | `delivery_status` (entregado/leído/fallido) | Política general (§1) |
| 10 | `inbox:first-response-sla` (cada minuto) | low | — | Alertas por conversaciones sin respuesta próximas a vencer / vencidas; notificación a Manager | Política general (§1) |
| 11 | Job `ReleaseAllotments` (`JOB-10`, diario 00:15, ShouldBeUnique) | default | diario 00:15 | CUP-BR-009; registra en `sys_job_runs`; resultado "N unidades liberadas en M fechas" | Política general (§1) |
| 11 | Job `ReleaseDueAlerts` (diario 07:00) | notifications | diario 07:00 | Fechas con release en ≤ 3 días y disponible > 0 → push/email a Operaciones | Política general (§1) |
| 11 | Job `TravelDocReminders` (`JOB-11`, diario 08:00) | notifications | diario 08:00 | Reservas no completas con días al viaje ∈ `reminder_days` o ≤ mínimo; un envío automático por día | Política general (§1) |
| 11 | `TravelDocsGate` | síncrono | on-demand / evento | Consultado por emisión de vouchers/entradas (05) | Política general (§1) |
| 12 | `treasury:cash-deposit-alerts` | low | on-demand / evento | TES-BR-09 | Política general (§1) |
| 12 | `treasury:open-session-check` | low | on-demand / evento | Alerta de cajas sin aperturar (TES-BR-05) | Política general (§1) |
| 12 | `treasury:cash-flow-snapshot` | reports | on-demand / evento | Cachea la proyección en Redis | Política general (§1) |
| 12 | `claims:deadline-alerts` | notifications | on-demand / evento | `reclamacion.por_vencer` / `reclamacion.vencida` al responsable y copia al Manager | Política general (§1) |
| 13 | `billing:renewals` | critical | Diario 06:00 | Suscripciones con `current_period_end < hoy`: aplica el cambio programado (revalida SUB-BR-03), aplica el cupón, genera la factura, cobra (`ChargeInvoiceJob`), avanza el periodo y procesa `cancel_scheduled → canceled`. Usa `ShouldBeUnique` por suscripción. | Política general (§1) |
| 13 | `ChargeInvoiceJob` | critical | Evento | Cobra con Idempotency-Key = `inv:{id}:attempt:{n}` y registra el `payment_attempt`. Si se aprueba, pasa a `paid`. Si se rechaza, pasa a `failed` y se programa el dunning. | Política general (§1) |
| 13 | `billing:dunning` | critical | Diario 10:00 | Facturas `failed` con `dunning_next_retry_at <= now()`: reintenta, reprograma según `retry_days` o suspende (sección 4.3). Usa `Cache::lock('dunning:'.$invoiceId)`. | reintenta, reprograma según `retry_days` o suspende (sección 4 |
| 13 | `billing:trials` | default | Diario 08:00 | Avisos a 7, 3 y 1 día. Suspensión o baja al vencer sin tarjeta. | Política general (§1) |
| 13 | `billing:expire-cards` | low | Mensual | Avisa de tarjetas que vencen en 30 días. | Política general (§1) |
| 13 | `EmitPlatformInvoiceJob` / `EmitCreditNoteJob` | documents | Evento | XML UBL 2.1 → OSE → CDR → PDF (S3). Reintentos con backoff (PROC-065). | Reintentos con backoff (PROC-065) |
| 13 | `usage:consolidate` | reports | Diario 00:15 | Vuelca los contadores Redis `usage:{tenant}:{metric}:{yyyymmdd}` (INCRBY en tiempo real) a `usage_counters` con UPSERT, recalcula `usage_monthly`, envía avisos 80/100 % y borra claves de más de 2 días. Toma snapshots de gauges (usuarios, sedes, `SUM(size)` de `sys_documents`). | Política general (§1) |
| 13 | `platform:metrics-snapshot` | reports | Diario 01:00 | MRR = Σ suscripciones activas (precio mensualizado + add-ons − cupón). ARR = MRR×12. ARPA. Altas, bajas, logo churn y revenue churn en `platform_metrics_daily`. | Política general (§1) |
| 13 | `api-keys:expire` | low | Diario | Pasa a `expired` las keys vencidas y avisa 7 días antes. | Política general (§1) |
| 13 | `DeliverWebhookJob` | integrations | Evento | Sección 8.4. | Política general (§1) |
| 13 | `webhooks:purge` | low | Diario | Retención de 30 días de las entregas. | Política general (§1) |
| 13 | `BookingRulePlanChanged` (v2.2) | default | Evento | Refresca `sys_booking_rules.min_plan` de todos los tenants e invalida `rules:{tenant}`; notifica `plan.cambio_reglas` a los tenants afectados. | Política general (§1) |
| 14 | `DispatchScheduledCampaigns` | default | cada minuto | Campañas `programada` con `scheduled_at ≤ now` → `CampaignSending` | Política general (§1) |
| 14 | `SendCampaignBatch` (ShouldBeUnique por campaña+lote) | notifications | lotes de 200/min (rate limit ESP / Meta tier) | Recalcula consentimiento y baja por destinatario justo antes de enviar (MKT-BR-01/02), envía por adapter, guarda `provider_message_id`; reintentos backoff 1/5/15 min; al terminar → `CampaignSent` | reintentos backoff 1/5/15 min |
| 14 | `RunAutomations` | notifications | cada 15 min (reactivación: lunes 08:00; cumpleaños: diario 09:00) | Calcula colas: suscriptores ≤ 7 días; pedidos web en pago pendiente > 1 h; reservas confirmadas/pend. pago/pend. proveedor con inicio en ≤ 3 días; completadas ≤ 7 días sin encuesta; cumpleaños en 7 días; clientes sin compra 365 días. Aplica MKT-BR-16/17, registra runs | Política general (§1) |
| 15 | `ExpireAvailabilityHolds` (JOB-01, 02) | critical | cada 1 min | Holds `hold` vencidos → `expirada` (incluye carritos); emite `CartHoldExpired` al socket del carrito | Política general (§1) |
| 15 | `ExpireEcomOrders` (08 ECO-BR-11) | critical | cada 5 min | Pedidos `pago_pendiente/rechazado` sin hold vivo → `expirado` | Política general (§1) |
| 15 | `ExpireUnvalidatedTransfers` (propuesto) | default | cada 30 min | Pagos por validar > 4 h hábiles → alerta a Finanzas; > 24 h → cancelar y liberar | Política general (§1) |
| 15 | `RemindBalanceDue` | notifications | diario 09:00 | Saldo que vence en 7 y 2 días (email + WhatsApp plantilla) | Política general (§1) |
| 15 | `AbandonedCartRecovery` | low | cada hora | Carritos activos 24 h con email y consentimiento de marketing | Política general (§1) |
| 15 | `RefreshCatalogReadModels` | default | al cambiar tarifas/salidas/promos + cada 15 min | `from_price`, etiquetas, rating, `best_seller`; invalida cache/ISR (`revalidateTag`) | Política general (§1) |
| 15 | `GenerateSitemaps` | low | diario 03:00 + al publicar | Sitemaps por idioma | Política general (§1) |
| 15 | `GenerateVoucherPdf` | documents | al emitir | PDF con QR | Política general (§1) |
| 15 | `AggregateWebFunnel` | reports | cada hora | `channel_web_funnel_daily` | Política general (§1) |
| 15 | `SendNewsletterDoubleOptIn` | notifications | al alta | Email de confirmación | Política general (§1) |
| 17 | `SchedulePaxMessages` (scheduler cada 15 min + tras `ReservationConfirmed`, `PaymentApplied`, cambio de plantilla/regla) | notifications | cada 15 min + tras | Calcula (reserva × plantilla × canal) y hace upsert de `programado` futuros; retira pendientes si R-PAX-MESSAGES está apagada | Política general (§1) |
| 18 | `ReservationCompleted` → `ScheduleReviewRequest` | default | on-demand / evento | Crea solicitud en `travel_to + daysAfter` | Política general (§1) |
| 18 | `SendDueReviewRequests` (cada 15 min) | notifications | cada 15 min | Envía invitaciones vencidas de programación; recordatorio a `reminder_days`; vence a `expire_days` | Política general (§1) |

### 3.1 Jobs de la semilla (`kit-ia/seeds/jobs.json`, pantalla Administración › Jobs)

| ID | Nombre | Programación (prototipo) |
|---|---|---|
| JOB-01 | Expirar holds de disponibilidad | cada 5 min |
| JOB-02 | Marcar cotizaciones vencidas | diario 00:05 |
| JOB-03 | Recordatorios de pago | diario 09:00 |
| JOB-04 | Recordatorio de actividades CRM | cada hora |
| JOB-05 | Notificar próximos viajes (48 h) | diario 05:00 |
| JOB-06 | Detectar reservas pendientes de proveedor | cada 2 h |
| JOB-07 | Sincronizar proveedores (adapters) | cada 6 h |
| JOB-08 | Reportes programados (gerencia) | lunes 07:00 |
| JOB-09 | Expirar asignaciones no confirmadas | cada 30 min |
| JOB-10 | Liberar cupos en release (allotments) | diario 00:15 |
| JOB-11 | Recordatorio de documentos de viaje | diario 08:00 |

## 4. Notificaciones

### 4.1 Catálogo configurable por tenant (Administración › Notificaciones; `settings.notifications`)

| Evento | Email | WhatsApp | Push | Portal | Destinatarios (`notifRules`) |
|---|---|---|---|---|---|
| Cotización enviada | sí | sí | no | sí | Cliente |
| Cotización aprobada | sí | no | sí | sí | Vendedor + Gerencia |
| Reserva confirmada | sí | sí | sí | sí | Cliente + Operaciones |
| Pago recibido | sí | sí | no | sí | Cliente + Finanzas |
| Asignación | no | sí | sí | no | Guía / Conductor |
| Cambio de horario | sí | sí | sí | sí | Pasajeros + Guía |
| Incidencia crítica | sí | sí | sí | no | Gerencia + Operaciones |
| Voucher emitido | sí | no | sí | sí | Cliente + Proveedor |
| Inicio/fin de servicio | no | sí | sí | sí | Pasajeros |
| Cierre de viaje | sí | no | no | sí | Cliente (encuesta NPS) |

### 4.2 Notificaciones por módulo (según las especificaciones)

Plantilla: cuando la especificación da el asunto o el código de plantilla se muestra; si no, «Por definir» (la plantilla vigente por canal se elige en `notif_templates`).

| Spec | Evento | Canal | Destinatario | Plantilla / asunto | Detalle |
|---|---|---|---|---|---|
| 01 | `lead.asignado` | Portal | asesor asignado | "Lead asignado: {nombre} ({code})" / "Nuevo lead asignado…" | — |
| 01 | `lead.tomado` | Portal | todos los Manager activos | "{asesor} tomó el lead {code} ({nombre})" | — |
| 01 | `lead.convertido` | Portal | owner de la oportunidad | "Lead {code} convertido en {OPP}" | — |
| 01 | `oportunidad.asignada` | Portal | owner (si ≠ actor) | "Oportunidad asignada: {título}" | — |
| 01 | `oportunidad.ganada` / `oportunidad.perdida` | Portal | owner | "{OPP} marcada como Ganada/Perdida: {título}" | — |
| 01 | `actividad.asignada` | Push | owner (si ≠ actor) | "Nueva actividad asignada: {asunto}" | — |
| 01 | `lead.reasignado`, `oportunidad.reasignado`, `actividad.reasignado`, `cliente.reasignado` | Portal | nuevo asesor | "{Tipo} {code} reasignado a su cartera" | — |
| 01 | `postventa.detractor` | Email | responsable del cliente | "Detractor NPS n: {cliente} — caso {REC}" | — |
| 01 | `postventa.caso` | Portal | owner del caso (si ≠ actor) | "Caso {REC} asignado: {asunto}" | — |
| 01 | `postventa.cierre` | Email | cliente | "Su caso {REC} ha sido cerrado" | — |
| 01 | `cliente.comunicacion` | Email / WhatsApp / Portal | cliente | asunto libre (WhatsApp en sandbox) | — |
| 02 | `ProductSubmittedForReview` | — | — | Por definir | `producto.revision` · Portal → Manager (U02) |
| 02 | `ProductActivated` | — | — | Por definir | `producto.activado` · Email → Ventas (U03) |
| 02 | `ProductBecameUnsellable` | — | — | Por definir | `producto.no_vendible` · Push → Ventas (U04) |
| 02 | `DepartureCancelled` (con vendidos) | — | — | Por definir | `salida.cancelada` · Email → Operaciones (U05) |
| 02 | `AvailabilityHoldCreated/Confirmed/Released/Expired/Consumed` | — | — | Por definir | `disponibilidad.confirmada` · Portal → creador del hold |
| 02 | `ProviderActivated` | — | — | Por definir | `proveedor.activado` · Email → Operaciones (U05) |
| 02 | `ProviderDeactivated` (con productos ACTIVE) | — | — | Por definir | `proveedor.desactivado` · Email → Manager (U02) |
| 03 | `QuoteInternalApprovalRequested` | — | — | Por definir | `cotizacion.aprobacion_solicitada` · Portal → cada manager activo |
| 03 | `QuoteInternalApprovalDecided` | — | — | Por definir | `cotizacion.aprobacion_aprobada\|rechazada` · Portal → dueño (si decide otro) |
| 03 | `QuoteSent` | — | — | Por definir | `cotizacion.enviada` · canal elegido → cliente |
| 03 | `QuoteViewed` | — | — | Por definir | `cotizacion.vista` · Portal → dueño |
| 03 | `QuoteApproved` | — | — | Por definir | `cotizacion.aprobada` · Push → dueño; Email → cliente |
| 03 | `QuoteRejected` | — | — | Por definir | `cotizacion.rechazada` · Portal → dueño |
| 03 | `QuoteReassigned` | — | — | Por definir | `cotizacion.reasignada` · Portal → nuevo dueño |
| 03 | `QuoteExpired` | — | — | Por definir | (propuesto) aviso al dueño |
| 03 | `QuoteConverted` | — | — | Por definir | ver 04 |
| 04 | `QuoteConverted`, `ReservationCreated`, `ReservationConfirmed` | `reserva.confirmada` · Email → cliente; Push → dueño (conversión) | `reserva.confirmada` · Email → cliente; Push → dueño (conversión) | Por definir | — |
| 04 | `BookingServiceRequested` | `proveedor.solicitud` · Email → proveedor (reserva, servicio, fecha, pax) | `proveedor.solicitud` · Email → proveedor (reserva, servicio, fecha, pax) | Por definir | — |
| 04 | `BookingServiceRejected` | `proveedor.rechazo` · Push → dueño | `proveedor.rechazo` · Push → dueño | Por definir | — |
| 04 | `ReservationModificationRequested` | `reserva.modificacion` · Push → gerencia (prototipo U02 fijo) | `reserva.modificacion` · Push → gerencia (prototipo U02 fijo) | Por definir | — |
| 04 | `ReservationModified` | `reserva.modificada` · Email → cliente | `reserva.modificada` · Email → cliente | Por definir | — |
| 04 | `ReservationRescheduled` | `cambio.horario` · Email → cliente; Push → coordinador de la orden (o U05) | `cambio.horario` · Email → cliente; Push → coordinador de la orden (o U05) | Por definir | — |
| 04 | `ReservationCancellationRequested` / `…Rejected` / `…Approved` | `reserva.anulacion_solicitada` · Portal → managers; `reserva.anulacion_rechazada\|aprobada` · Portal → solicitante | `reserva.anulacion_solicitada` · Portal → managers; `reserva.anulacion_rechazada\|aprobada` · Portal → solicitante | Por definir | — |
| 04 | `ReservationCancelled` | `reserva.cancelada` · Email → cliente; Push → coordinador; Portal → Finanzas | `reserva.cancelada` · Email → cliente; Push → coordinador; Portal → Finanzas | Por definir | — |
| 04 | `AvailabilityReleased` | — (sincroniza portales/e-commerce) | — (sincroniza portales/e-commerce) | Por definir | — |
| 04 | `PaymentApplied` | `pago.recibido` · Email → cliente | `pago.recibido` · Email → cliente | Por definir | — |
| 04 | `ReservationReassigned` | `reserva.reasignada` · Portal → nuevo dueño | `reserva.reasignada` · Portal → nuevo dueño | Por definir | — |
| 04 | `OperationOrderCreated` | `operacion.creada` · Push → coordinador | `operacion.creada` · Push → coordinador | Por definir | — |
| 05 | `orden.creada`, `orden.responsable` | Email | Coordinador | Por definir | — |
| 05 | `proveedor.solicitud` | Email | Proveedor | Por definir | — |
| 05 | `proveedor.rechazo` | Email | Coordinador | Por definir | — |
| 05 | `asignacion.nueva` | Push + WhatsApp (casillas) | Guía y conductor | Por definir | — |
| 05 | `asignacion.liberada` | WhatsApp | Guía y conductor | Por definir | — |
| 05 | `asignacion.confirmada`, `servicio.iniciado`, `servicio.finalizado` | Push | Coordinador | Por definir | — |
| 05 | `incidencia.creada` | Email | Coordinador | Por definir | — |
| 05 | `incidencia.critica` | Push + WhatsApp | Manager | Por definir | — |
| 05 | `incidencia.asignada` | Push | Responsable | Por definir | — |
| 05 | `incidencia.cerrada` (crítica) | Push | Manager | Por definir | — |
| 05 | `voucher.emitido` | Email cliente, Push pasajeros, Email proveedor | — | Por definir | — |
| 05 | `voucher.reenviado` | Email | Cliente | Por definir | — |
| 05 | `voucher.actualizado` | Email cliente + Push pasajeros | — | Por definir | — |
| 05 | `voucher.anulado` | Email | Proveedor | Por definir | — |
| 05 | `rooming.enviado` | Email (PDF adjunto) | Hotel | Por definir | — |
| 05 | `operacion.cerrada` | Email coordinador + Portal cliente | — | Por definir | — |
| 06 | `SupplierConfirmed` | — | — | Por definir | Portal → Operaciones (U05, U06): "{proveedor} confirmó {servicio} ({reserva}) · código …" |
| 06 | `SupplierRejected` | — | — | Por definir | Portal → Operaciones: "… rechazó …: motivo" |
| 06 | `SupplierAlternativeProposed` | — | — | Por definir | Portal → Operaciones |
| 06 | `RoomingAcknowledged` / `RoomingConfirmedByHotel` | — | — | Por definir | Portal → Operaciones |
| 06 | `RoomingObservationReported` → `IncidentCreated` | — | — | Por definir | Portal → Operaciones `incidencia.creada` |
| 06 | `VoucherRedeemed` | — | — | Por definir | Portal → Operaciones `voucher.utilizado` |
| 06 | `SupplierInvoiceUploaded` | — | — | Por definir | Portal → Finanzas (U07) `proveedor.factura` |
| 06 | `IncidentCreated` (extranet) | — | — | Por definir | Portal → Operaciones `incidencia.creada` o `incidencia.critica` |
| 06 | `IncidentCommentAdded` | — | — | Por definir | Portal → Operaciones y responsable |
| 06 | `RateUpdateRequested` | — | — | Por definir | Portal → Operaciones (U05) y Manager (U02) `proveedor.tarifa` |
| 07 | `pago.solicitud` | Email + Portal | Cliente | "Solicitud de anticipo CXC-… — monto, vence …" | — |
| 07 | `pago.recordatorio` | Email (+ WhatsApp si hay teléfono) | Cliente | "Recordatorio de pago CXC-… — saldo …, vence …" | — |
| 07 | `pago.recibido` | Email | Cliente | "Pago recibido PAG-… — monto (CXC-…)" | — |
| 07 | `pago.rechazado` | Email | Cliente | "Pago PAG-… no validado: motivo. La obligación sigue pendiente." | — |
| 07 | `pago.revertido` | Email | Cliente | "Reversión del pago PAG-… — monto" | — |
| 07 | `pago.proveedor` | Email | Proveedor | "Pago realizado CXP-… — monto · Op. …" | — |
| 07 | `comision.pagada` | Email | Vendedor / agencia | "Comisión COM-… pagada — monto" | — |
| 07 | `estado_cuenta.enviado` | Email | Cliente | "Estado de cuenta RES-… — saldo …" | — |
| 07 | `reserva.liquidada` | Portal | Responsable de la reserva | "Reserva RES-… liquidada — utilidad …" | — |
| 07 | `comprobante.emitido` | Email + Portal | Cliente | "Comprobante electrónico F001-… — monto" | — |
| 07 | `contabilidad.cierre` | Email | Finanzas | "Periodo … cerrado por …" | — |
| 07 | `proveedor.factura` (entrante, extranet) | Portal | Finanzas | "… registró la factura … para CXP-…" | — |
| 08 | `b2b.estado` | Email | Agencia (bloqueo/desbloqueo) | Por definir | — |
| 08 | `reserva.confirmada` | Email | Agencia / comprador web | Por definir | — |
| 08 | `reserva.b2b` | Portal | Gerente (U02) | Por definir | — |
| 08 | `voucher.emitido` | Email | Agencia / comprador web | Por definir | — |
| 08 | `pago.informado` | Portal | Finanzas (U07) | Por definir | — |
| 08 | `comision.liquidacion` | Email | Finanzas (pleon@…) | Por definir | — |
| 08 | `pago.enlace` | Email | Comprador web | Por definir | — |
| 08 | `pago.rechazado` | Email | Comprador web / cliente | Por definir | — |
| 08 | `pago.recibido` | Email / Portal | Comprador/cliente; Finanzas (U07) en portal cliente | Por definir | — |
| 08 | `cms.revision` / `cms.publicado` / `cms.devuelto` | Portal | Gerente (U02) / autor / autor | Por definir | — |
| 08 | `cotizacion.vista` / `cotizacion.aprobada` / `cotizacion.rechazada` | Portal (+ Email al cliente en aprobada) | Asesor dueño de la cotización | Por definir | — |
| 08 | `soporte.ticket` | Portal | Asesor del cliente | Por definir | — |
| 08 | `alerta.leida` | Portal | Responsable de la incidencia | Por definir | — |
| 08 | `pasajero.mensaje` | WhatsApp | Coordinador de la operación | Por definir | — |
| 09 | Cotización enviada | ✓ ✓ – ✓ | Cliente | Por definir | — |
| 09 | Cotización aprobada | ✓ – ✓ ✓ | Vendedor + Gerencia | Por definir | — |
| 09 | Reserva confirmada | ✓ ✓ ✓ ✓ | Cliente + Operaciones | Por definir | — |
| 09 | Pago recibido | ✓ ✓ – ✓ | Cliente + Finanzas | Por definir | — |
| 09 | Asignación | – ✓ ✓ – | Guía / Conductor | Por definir | — |
| 09 | Cambio de horario | ✓ ✓ ✓ ✓ | Pasajeros + Guía | Por definir | — |
| 09 | Incidencia crítica | ✓ ✓ ✓ – | Gerencia + Operaciones | Por definir | — |
| 09 | Voucher emitido | ✓ – ✓ ✓ | Cliente + Proveedor | Por definir | — |
| 09 | Inicio/fin de servicio | – ✓ ✓ ✓ | Pasajeros | Por definir | — |
| 09 | Cierre de viaje | ✓ – – ✓ | Cliente (encuesta NPS) | Por definir | — |
| 11 | Notificaciones (PROC-059) | — | — | Por definir | `notifications` `cupo.release`, `cupo.liberacion` → proveedor (Email); `cupo.ampliacion` → proveedor; `cupo.release_proximo` → Operaciones; `documentos.recordatorio` / `documentos.solicitud` → cliente (Email + WhatsApp); `documentos.observado` → cliente |
| 15 | `pago.rechazado` | Email | comprador | Por definir | — |
| 15 | `pago.recibido` | Email | comprador (checkout y pago de saldo) | Por definir | — |
| 15 | `reserva.confirmada` | Email + WhatsApp | comprador | Por definir | — |
| 15 | `reserva.recibida` | Email | comprador (transferencia/Yape) | Por definir | — |
| 15 | `voucher.emitido` | Email | comprador | Por definir | — |
| 15 | `pedido.web` | Portal | asesor e-commerce (U03) | Por definir | — |
| 15 | `reserva.pendiente_proveedor` | Portal | Operaciones (U05) | Por definir | — |
| 15 | `pago.por_validar` | Portal | Finanzas (U07) | Por definir | — |
| 15 | `lead.nuevo` / `lead.acuse` | Portal / Email | Gerencia (cola) / cliente | Por definir | — |
| 15 | `inbox.nueva` | Portal | asesor | Por definir | — |
| 15 | `newsletter.doble_optin` | Email | suscriptor | Por definir | — |
| 15 | `cuenta.bienvenida` | Email | nuevo cliente | Por definir | — |
| 15 | `reclamacion.constancia` / `reclamacion.nueva` | Email / Portal | consumidor / responsable (vía ClaimBook) | Por definir | — |

### 4.3 Push de las apps móviles (spec 05 §8.4.5)

| Evento | Destinatario | Deep link |
|---|---|---|
| Nueva asignación / liberación / cambio de hora | Guía, conductor | Detalle de la asignación |
| Alerta operativa (incidencia crítica en sus órdenes) | Guía, conductor | Pantalla Hoy |
| Voucher emitido/actualizado, cambio de horario, alerta de viaje, respuesta de chat | Pasajero | Vouchers / Alertas / Soporte |
| Confirmación, inicio, fin de servicio | Coordinador (web: Reverb; móvil del coordinador si aplica) | Orden 360 |

## 5. Webhooks salientes

Firma HMAC-SHA256 por suscripción, entrega por la cola `integrations` (outbox), timeout 10 s, sin redirecciones, validación SSRF; 2xx = entregado, 410 = deshabilitar suscripción, otro código o timeout = reintento con backoff (13 §8.4, API-BR-06/07). Registro de entregas en `integration_webhook_deliveries` (semilla `webhookDeliveries.json`).

| Evento | Citado en | 
|---|---|
| `incident.created` | semilla webhooks.json |
| `incident.resolved` | semilla webhooks.json |
| `invoice.issued` | semilla webhooks.json |
| `invoice.payment_failed` | spec 13 |
| `lead.created` | semilla webhooks.json |
| `passenger.message.failed` | spec 17 |
| `payment.applied` | spec 17, semilla webhooks.json |
| `quote.approved` | semilla webhooks.json |
| `quote.sent` | semilla webhooks.json |
| `reservation.cancelled` | spec 17, semilla webhooks.json |
| `reservation.confirmed` | spec 17, semilla webhooks.json |
| `reservation.created` | spec 17 |
| `review.received` | spec 17 |
| `tenant.suspendido` | spec 13 |
| `voucher.issued` | semilla webhooks.json |
| `widget.checkout_started` | spec 17 |

- *17 §8 Eventos, jobs y notificaciones*: notifications Actualizan entregado/leído/fallido (cola notifications)
- *17 §8 Eventos, jobs y notificaciones*: integrations (outbox) `reservation.created/confirmed/cancelled`, `payment.applied`, `widget.checkout_started`, `review.received`, `passenger.message.failed` (HMAC-SHA256) (cola integrations)

## 6. Canales de tiempo real (Reverb)

| Canal | Spec | Uso (extracto) |
|---|---|---|
| `private-tenant.{tenantId}.user.{userId}` | 00 |  Canal `private-tenant.{tenantId}.user.{userId}` (Reverb) autenticado Notificaciones, cambios de permisos (refresca menú) —  |
| `private-tenant.{t}.user.{u}` | 00 | 4. Canal Portal/Push → broadcast `private-tenant.{t}.user.{u}` para la campana. |
| `tenant.{id}.catalog.departures` | 02 |  `AvailabilityHoldCreated/Confirmed/Released/Expired/Consumed` Holds Auditoría; broadcast ocupación (Reverb canal `tenant.{id}.catalog.departures`) `disponibilidad.confirmada` · Portal → creador del hold  |
| `tenant.{t}.ops` | 05 | Tiempo real (Reverb): canal `tenant.{t}.ops` para tablero de órdenes, calendario y orden 360; `tenant.{t}.user.{u}` para notificaciones. |
| `tenant.{t}.user.{u}` | 05 | Tiempo real (Reverb): canal `tenant.{t}.ops` para tablero de órdenes, calendario y orden 360; `tenant.{t}.user.{u}` para notificaciones. |
| `tenant.{t}.user.{u}` | 10 |  `ApprovalRequested`, `ApprovalLevelApproved`, `ApprovalDecided`, `ApprovalInfoRequested`, `ApprovalDelegated` `notifications` Servicio de decisión Notificación portal/email a aprobadores, solicitante, delegado; broadcas |
| `tenant.{t}.supplier.{providerId}` | 06 | Tiempo real: canal Reverb `tenant.{t}.supplier.{providerId}` para refrescar KPIs y listas de la extranet. |
| `tenant.{id}.ops` | 11 |  Reverb — Canal `tenant.{id}.ops` actualiza grilla y tablero  |
| `private-webchat.{session}` | 15 |  POST `/public/chat/sessions` · `/public/chat/sessions/{id}/messages` · WS `private-webchat.{session}` token de sesión de chat Chat web (SIT-BR-24) vía Reverb rate limit  |
| `private-tenant.{tenantId}.user.{userId} (Reverb)` | contrato (00) | Notificaciones, cambios de permisos (refresca menú) · auth: autenticado |
| `private-webchat.{session}` | contrato (15) | Chat web (SIT-BR-24) vía Reverb · auth: token de sesión de chat |

Autorización de canales (Supuesto, coherente con 00 §8): `routes/channels.php` valida que el `tenantId` del canal coincida con el del token y que el usuario tenga el permiso de la pantalla que consume el canal.

## 7. Otros elementos de la §8 (texto no tabular)

### 00 · Transversal (seguridad y RBAC)

- *§8.1 Servicio `Notify` (usado por todos los módulos)*: Firma del prototipo: `Notify.push(event, channel, to, subject, status)` → fila en notificaciones con `id NTF-n`, `ts`, `event`, `channel` (Email/WhatsApp/Push/Portal), `to` (usuario, email o teléfono), `subject`, `status` (`enviado` por defecto), `retries 0`, y refresca la campana.
- *§8.1 Servicio `Notify` (usado por todos los módulos)*: 1. El módulo emite un evento de dominio (`QuoteSent`, `ReservationConfirmed`…) **después del commit**.
- *§8.1 Servicio `Notify` (usado por todos los módulos)*: 2. `NotificationDispatcher` (cola `notifications`) busca `notif_event_rules` del tenant, resuelve destinatarios, aplica condición y momento (inmediato / lote 15 min / horario laboral), elige plantilla vigente por canal y crea `notif_messages` (`pendiente`).
- *§8.1 Servicio `Notify` (usado por todos los módulos)*: 3. Un job por canal envía vía adapter (`MailSender`, `MessagingChannel`, push FCM/APNs, Portal = registro + broadcast Reverb) y actualiza estado; fallos según política de reintentos (09 §5 INT-BR-04/05).
- *§8.1 Servicio `Notify` (usado por todos los módulos)*: 4. Canal Portal/Push → broadcast `private-tenant.{t}.user.{u}` para la campana.
- *§8.2 Colas*: `critical` (pagos, conversión, revocación de tokens), `default`, `notifications`, `documents` (PDF), `integrations` (outbox, adapters), `reports` (exportaciones, read models), `low`. Horizon con supervisores por cola; jobs `TenantAware`, `tries`, `backoff` exponencial, `ShouldBeUnique` donde aplique, registro en `sys_job_runs`.

### 01 · CRM

- *§8.3 Notificaciones que emite el prototipo*: Plantillas y canales por evento son configurables en Administración › Notificaciones (PROC-059); los eventos CRM deben agregarse a esa matriz (hoy solo tiene eventos de cotización, reserva, pago, operación).

### 03 · Cotizaciones

- *§8*: Jobs: **JOB-02 `quotes:expire`** (scheduler diario 00:05 tz tenant; en el prototipo se ejecuta manualmente desde Integraciones y jobs) → `borrador/enviada/vista/negociacion` con `valid_until < hoy` pasan a `vencida`. **`GenerateQuotePdf`** (cola `documents`, `ShouldBeUnique` por versión, guarda en `sys_documents` con hash). Propuesto: `quotes:expiring-reminder` diario para las que vencen en ≤ 3 días (hoy solo es KPI).

### 04 · Reservas

- *§8*: Jobs: **JOB-01 `holds:expire`** cada 5 min (`holdMinutes` 30) para holds temporales `hold` vencidos → `expirada` y `sold` recalculado; **`GenerateReservationConfirmationPdf`** (documents); propuestos: `reservations:detect-pending` (pendientes de proveedor/pago próximos a viajar), recordatorio de CxC por vencer (finanzas), `reservations:auto-start` opcional el día de inicio.
- *§v2.1 — Eventos*: `PaxFeedbackReplied` (cola `notifications`: envía por el canal elegido y registra entrega/lectura en `notif_pax_messages`), `PaxFeedbackEscalated` → `IncidentCreated` (notifica al coordinador; crítica → gerencia por push/WhatsApp). Auditoría: `Comentario pasajero · leido/responder/derivar`, `Reserva · editar_pasajero` con parentesco/titular.

### 05 · Operaciones y móvil

- *§8.2 Notificaciones (canal → destinatario) según prototipo*: La matriz evento × canal es configurable (`admin/notificaciones`: Asignación = WhatsApp+Push; Incidencia crítica = Email+WhatsApp+Push; Voucher emitido = Email+Push+Portal; Cambio de horario = todos).
- *§8.3 Jobs y scheduler*: Tiempo real (Reverb): canal `tenant.{t}.ops` para tablero de órdenes, calendario y orden 360; `tenant.{t}.user.{u}` para notificaciones.
- *§8.4 Apps móviles: arquitectura, almacenamiento local, outbox, idempotencia, conflictos y push (React Native / Expo)*: Tokens inválidos (receipts `DeviceNotRegistered`) → se anula `expo_push_token`. Si push falla, el canal alternativo es WhatsApp según matriz de notificaciones.

### 06 · Extranet de proveedores

- *§8*: Tiempo real: canal Reverb `tenant.{t}.supplier.{providerId}` para refrescar KPIs y listas de la extranet.

### 08 · Canales y portales

- *§8.3 Notificaciones que emite el prototipo*: En producción los destinatarios fijos (U02, U07, pleon@) se reemplazan por reglas de notificación del tenant (rol/responsable).

### 09 · Administración y reportes

- *§8.3 Catálogo de eventos de notificación (configurables)*: Eventos de sistema emitidos por este módulo (no configurables, siempre Email/Portal): `tenant.activado`, `tenant.suspendido`, `tenant.reactivado`, `usuario.invitado`, `seguridad.mfa_reset`, `acceso.solicitud`, `exportacion.lista` (Portal al solicitante), `reporte.programado`, `integracion.fallo`, `pago.recordatorio`, `viaje.proximo`, `cotizacion.aprobacion_interna`.
- *§8.3 Catálogo de eventos de notificación (configurables)*: Plantillas predeterminadas: texto exacto en `admin.js` `DEF_TPL` (asunto + cuerpo por evento); WhatsApp = primeras 4 líneas sin líneas vacías; Push = cuerpo en una línea recortado a 140.

### 10 · Aprobaciones e inbox

- *§8*: Notificaciones (PROC-059): `aprobacion.solicitada`, `aprobacion.resultado`, `aprobacion.informacion`, `aprobacion.delegada`, `cotizacion.aprobacion_aprobada/rechazada`, `reserva.anulacion_aprobada/rechazada`, `reserva.cancelada`, `pago.revertido`, `pago.reembolso`, `proveedor.tarifa`, `b2b.credito`, `inbox.asignada`, `inbox.nueva`, `inbox.mensaje`, `inbox.respuesta`, `soporte.resuelto`, `lead.asignado`, `actividad.asignada`.

### 13 · Plataforma SaaS y API

- *§8.1 Modelo de facturación*: Opción A: Laravel Cashier (Stripe)**. Si la pasarela elegida es Stripe (cobra en PEN), se usan `Billable` en `Tenant`, `newSubscription()->create()`, `swap()` (upgrade con `prorate()`/`alwaysInvoice()`), `swapAndInvoice`, `noProrate()->swap()` a fin de periodo para el downgrade, y los webhooks `invoice.payment_failed` y `customer.subscription.updated`. El dunning de Stripe (Smart Retries) se desactiva y se usa el propio para controlar la suspensión y el calendario 1/3/7.
- *§8.1 Modelo de facturación*: Opción B: pasarela local** (Niubiz, Izipay, Culqi, Mercado Pago; por definir, ver INT-02). Se usa un motor de suscripción propio (`BillingService`) con tokenización en iframe, cargos recurrentes vía API de la pasarela usando el token (`payment_methods.gateway_token`) y el job de renovación. Es la opción recomendada para Perú (menores comisiones y liquidación local), detrás de la interfaz `PaymentGateway` con adapters (`charge`, `refund`, `createSetupIntent`, `parseWebhook`).
- *§8.1 Modelo de facturación*: En ambos casos, **la factura electrónica la emite la plataforma** con su OSE (Nubefact, Efact u otro), serie `FQ01` y notas de crédito `NQ01`, por el job `EmitPlatformInvoiceJob` (cola `documents`). La factura comercial de la pasarela no sustituye al comprobante SUNAT. Precios sin IGV más 18 % de IGV. El tenant es el adquirente (RUC 20).
- *§8.3 Medición de uso y rate limiting (Redis)*: Contador de uso**: `INCRBY usage:{t}:{metric}:{yyyymmdd} n` en el punto de consumo (listener de `ReservationCreated`, `NotificationSent{channel}`, middleware de API). Si Redis falla, se escribe en la tabla fallback `usage_events` (degradación segura).
- *§8.4 Webhooks: firma HMAC y entrega*: 1. Los eventos de dominio (`QuoteSent`, `QuoteApproved`, `ReservationCreated/Confirmed/Cancelled`, `PaymentApplied/Reversed`, `InvoiceIssued`, `VoucherIssued`, `IncidentCreated/Resolved`, `LeadCreated`) se escriben en `sys_outbox` en la misma transacción.
- *§8.4 Webhooks: firma HMAC y entrega*: 2. `OutboxRelay` publica y, por cada webhook `active` suscrito (consulta GIN `events @> ARRAY[type]`), crea una entrega `pending` y encola `DeliverWebhookJob`.
- *§8.4 Webhooks: firma HMAC y entrega*: 4. Firma: `t = unix_time`, `v1 = hex(HMAC_SHA256(secret, t + "." + raw_body))`. Header `KipuControl-Signature: t=…,v1=…[,v1=…]` (dos v1 durante la gracia de rotación). Además: `KipuControl-Event-Id`, `KipuControl-Event-Type`, `KipuControl-Delivery-Id`, `User-Agent: KipuControl-Webhooks/1.0`.
- *§8.4 Webhooks: firma HMAC y entrega*: 7. Tras 10 fallos consecutivos: `disabled` y notificación.
- *§8.5 Notificaciones (PROC-059)*: `suscripcion.plan_cambiado`, `suscripcion.cambio_programado`, `suscripcion.addon`, `suscripcion.cancelacion` (al tenant y a ops@), `suscripcion.reanudada`, `suscripcion.pago_recibido`, `suscripcion.metodo_pago`, `plataforma.cobro_fallido` (en cada reintento), `plataforma.enlace_pago`, `tenant.suspendido`, `trial.extendido`, `trial.convertido`, avisos de trial a 7/3/1 día, `uso.aviso_80` y `uso.aviso_100`, `api.key_creada`, `webhook.deshabilitado`, `plan.cambio_condiciones` (30 días antes).

### 14 · Marketing y metas

- *§8*: Tiempo real (Reverb): avance de envío (`enviando`) y conteo del constructor opcional.

### 15 · Sitio web público

- *§8.1 Eventos de dominio*: `CartItemAdded`, `CartHoldCreated`, `CartHoldExpired`, `WebOrderCreated`, `WebPaymentAttempted`, `WebPaymentApproved`, `WebPaymentPendingValidation`, `ReservationConfirmed` (04), `VouchersIssued` (05), `WebLeadCaptured`, `WebContactReceived`, `WebChatStarted`, `NewsletterSubscribed`, `ClaimBookSheetRegistered` (12), `CustomerRegistered`.
- *§8.4 Analítica del embudo (prototipo: `DB.webEvents`, modal “Eventos de analítica (demo)” en el pie)*: Eventos con nombres GA4: `page_view`, `search`, `view_item_list`, `view_item`, `add_to_wishlist`/`remove_from_wishlist`, `add_to_cart`, `remove_from_cart`, `view_cart`, `apply_promo`, `select_promotion`, `begin_checkout`, `add_shipping_info` (consentimientos), `add_payment_info`, `payment_failed`, `purchase`, `purchase_pending`, `purchase_balance`, `generate_lead` (tailor_made / contact_form / web_chat), `sign_up`, `sign_up_newsletter`, `login`, `share`, `contact_whatsapp`, `select_language`, `select_currency`, `claim_submitted`. Parámetros: `item_id`, `value`, `currency`, `transaction_id`, `items[]`, `payment_type`, `pay_mode`. Producción: GTM + GA4 **solo con consentimiento de cookies analíticas**; `purchase` se envía también server-side (Measurement Protocol) desde el webhook para no perder conversiones; UTM guardado en carrito y pedido para atribución (14).

### 16 · Motor de reservas y centro de reglas

- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `BookingEngine` · Fachada única (sitio, widget, B2B, cotizador, reservas) · `dayStatus(Product $p, CarbonImmutable $date, int $seats = 0): DayStatus`; `month(Product $p, int $y, int $m, int $seats): Collection`; `nextAvailable(Product $p, int $seats, ?CarbonImmutable $from = null): ?CarbonImmutable` (máx. 400 días); `validatePax(Product $p, PaxCount $pax): PaxValidation`; `ageType(Product $p, ?int $age): PaxType`; `quote(Product $p, QuoteSelection $sel): QuoteResult`
- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `RuleResolver` · `on(string $key, ?Product $p): bool`, `param(string $key, string $name, ?Product $p): mixed` con caché por request
- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `PaxRulesResolver` · `resolve(Product $p): PaxRules` (defaults tenant → `catalog_pax_rules` → efectos de reglas apagadas)
- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `AvailabilityCalculator` · Rango efectivo, capacidad, vendidos (`booking_reservation_services` no cancelados de reservas no borrador/cancelada) y holds vigentes · `effectiveRange()`, `sold()`, `held()`
- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `PriceCalculator` · Líneas base/adicionales/alojamiento/suplementos, ajustes, pago
- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `FxConverter` · `convert(Money $m, string $to)` con `rate` del día + `fxMarginPct` (`R-MULTICURRENCY`)
- *§8 Eventos, jobs (colas Redis) y notificaciones › §8.1 BookingEngine — servicio de dominio Laravel*: `RuleRegistry` · Mapa `rule_key → handler` para reglas agregadas por el tenant
- *§8.1 BookingEngine — servicio de dominio Laravel*: 3. Tarifa base: vigente `segment=Adulto` (o `Pasajero`) del canal o `Directo`; sin tarifa ⇒ warning PRD-BR-005.
- *§8.5 Notificaciones del prototipo*: `Notify.push('disponibilidad.cerrada_con_ventas', 'Email', 'U05', …)` al cerrar fechas con ventas (rango o cierre rápido).

