"""Fuentes de las máquinas de estado: qué sección de qué especificación documenta cada columna de estado.

Cada clave es `tabla.columna` (debe existir en el esquema con un CHECK de lista de valores).
Campos:
  titulo        nombre de la entidad en español.
  fuentes       lista de secciones. `spec` = prefijo del archivo (00…18); `sec` = número de la sección
                (encabezado «### 4.1 …», «### v2.1 …» o «## 4.»); `row` = fila de una tabla «Objeto | Estados…»;
                `para` = párrafo que empieza con ese texto. `tabla=True` → se leen automáticamente las filas de las
                tablas «Desde | Hacia» / «De | A» / «De → A» / «Transición» de esa sección.
  t             transiciones transcritas a mano desde prosa (no hay tabla): T(desde, hacia, acción, quién, guardas, efectos, ref).
                desde/hacia: estados separados por «|»; «*» = alta (estado inicial).
  alias         frase de la celda (sin backticks, en minúsculas) → estados.
  celda         texto exacto de una celda (sin backticks) → estados (lista vacía = no cambia el estado de esta columna).
  terminales    estados finales según la spec.
  omitir_diagrama  pares (desde, hacia) que no se dibujan (p. ej. transiciones siempre rechazadas).
  notas         observaciones (supuestos, diferencias spec ↔ SQL).
Columnas de estado sin entrada aquí → «Transiciones por definir (solo valores en SQL)».
"""


def T(desde, hacia, accion, quien="", guardas="", efectos="", ref=""):
    return dict(desde=desde, hacia=hacia, accion=accion, quien=quien, guardas=guardas, efectos=efectos, ref=ref)


ABIERTAS_OPP = ["calificacion", "descubrimiento", "cotizacion", "negociacion"]

ENTIDADES = {
    # ------------------------------------------------------------------ 00 transversal
    "sys_idempotency_keys.status": dict(
        titulo="Clave de idempotencia", fuentes=[dict(spec="00", sec="4", row="Idempotency key")],
        t=[T("*", "processing", "Primera solicitud con `Idempotency-Key`", "Middleware"),
           T("processing", "completed", "La solicitud termina bien", "Middleware", efectos="Respuesta cacheada 24 h"),
           T("processing", "failed", "La solicitud falla", "Middleware", efectos="`failed` permite reintento con la misma key")],
        terminales=["completed"]),
    "sys_outbox.status": dict(
        titulo="Mensaje de outbox", fuentes=[dict(spec="00", sec="4", row="Outbox")],
        t=[T("*", "pending", "Se registra en la misma transacción del cambio", "Sistema"),
           T("pending", "dispatched", "Worker publica el evento", "Worker"),
           T("pending", "failed", "Fallo al publicar", "Worker", efectos="Reintentos con backoff")],
        terminales=["dispatched"]),
    "iam_access_requests.status": dict(
        titulo="Solicitud de acceso", fuentes=[dict(spec="00", sec="4", row="Solicitud de acceso")],
        t=[T("*", "pendiente", "Solicitud de acceso"),
           T("pendiente", "atendida", "Atender", "Tenant Admin"),
           T("pendiente", "rechazada", "Rechazar", "Tenant Admin")],
        terminales=["atendida", "rechazada"]),
    # ------------------------------------------------------------------ 01 CRM
    "crm_leads.status": dict(
        titulo="Lead", fuentes=[dict(spec="01", sec="4.1", tabla=True)],
        celda={"(sin alta)": []},
        terminales=["convertido"],
        notas=["La resolución `merge` al registrar no crea lead (fila «(sin alta)»): completa el lead existente.",
               "Asignación («Tomar lead», «Asignar/Reasignar») no cambia el estado.",
               "CHECK adicional de tabla: un lead distinto de `nuevo`, `duplicado` y `descartado` exige `owner_id` (CRM-BR-10/11)."]),
    "crm_opportunities.stage": dict(
        titulo="Oportunidad (etapa)", fuentes=[dict(spec="01", sec="4.2", tabla=True)],
        alias={"abierta": ABIERTAS_OPP, "otra abierta": ABIERTAS_OPP},
        notas=["La spec la llama `STATUS`; en SQL es `crm_opportunities.stage` (`default 'descubrimiento'`).",
               "«abierta» = `calificacion`, `descubrimiento`, `cotizacion` o `negociacion`. CHECK adicional: `closed_at` solo con etapa `ganada`/`perdida`."]),
    "crm_activities.status": dict(
        titulo="Actividad", fuentes=[dict(spec="01", sec="4.3", tabla=True)], terminales=["completada"]),
    "crm_cases.status": dict(
        titulo="Caso de postventa", fuentes=[dict(spec="01", sec="4.4", tabla=True)], terminales=["cerrada"],
        notas=["Las hojas del Libro de Reclamaciones usan además `book_status` (ver «Hoja de reclamación»). Al cerrar la hoja, la spec 12 sincroniza el caso con Postventa."]),
    # ------------------------------------------------------------------ 02 Catálogo
    "catalog_products.status": dict(
        titulo="Producto", fuentes=[dict(spec="02", sec="4.1", tabla=True)], terminales=["ARCHIVED"],
        omitir_diagrama=[("DRAFT", "ACTIVE"), ("REVIEW", "ACTIVE")],
        notas=["La fila DRAFT/REVIEW → ACTIVE existe en la UI pero el checklist la rechaza siempre (422 + audit `activacion_rechazada`); no se dibuja.",
               "«Comercializable» = `status = ACTIVE AND is_bookable`."]),
    "catalog_product_versions.status": dict(
        titulo="Versión de producto", fuentes=[dict(spec="02", sec="4.2")],
        t=[T("*", "borrador|en_revision|vigente", "Nueva versión", "", "", "Nace `vigente` si el producto está ACTIVE/APPROVED/SUSPENDED/INACTIVE, `en_revision` si REVIEW, `borrador` si DRAFT"),
           T("borrador", "en_revision", "Producto pasa a REVIEW (Enviar a revisión)"),
           T("borrador|en_revision", "vigente", "Producto pasa a ACTIVE (Activar)"),
           T("borrador|en_revision|vigente", "historica", "Se crea una nueva versión", efectos="Todas las no históricas pasan a `historica`")],
        terminales=["historica"], notas=["Las versiones históricas son inmutables (PRD-BR-017)."]),
    "catalog_rates.status": dict(
        titulo="Tarifa", fuentes=[dict(spec="02", sec="4.3")],
        t=[T("vigente", "inactiva", "Desactivar", "`manage_rates`"),
           T("inactiva", "vigente", "Activar", "`manage_rates`", "No permitido si está vencida (`valid_to < hoy`)")],
        notas=["`vencida` y `programada` son estados efectivos calculados por fechas, no se persisten."]),
    "catalog_product_departures.status": dict(
        titulo="Salida", fuentes=[dict(spec="02", sec="4.4", tabla=True), dict(spec="08", sec="4.6")]),
    "catalog_availability_holds.status": dict(
        titulo="Hold de disponibilidad", fuentes=[dict(spec="02", sec="4.5", tabla=True), dict(spec="15", sec="4.3")],
        alias={"(disponible)": ["*"]}, terminales=["liberada", "expirada", "consumida"],
        notas=["El hold de carrito del sitio web (15 §4.3) usa esta misma tabla: 30 min; «Volver a bloquear» crea un hold nuevo."]),
    "booking_inventory_holds.status": dict(
        titulo="Hold de inventario de la reserva", fuentes=[dict(spec="02", sec="4.5", tabla=True), dict(spec="04", sec="4.3")],
        alias={"(disponible)": ["*"]}, terminales=["liberada", "expirada", "consumida"],
        notas=["Mismos valores y ciclo que `catalog_availability_holds` (PROC-020). La conversión (04 §4.3 paso 9) crea el hold ya `confirmada` para POR_SALIDA y `hold` para modelos sin control por salida; la cancelación (04 §4.6) lo pasa a `liberada`."]),
    "catalog_providers.status": dict(
        titulo="Proveedor", fuentes=[dict(spec="02", sec="4.6")],
        t=[T("*", "inactivo", "Crear proveedor"),
           T("inactivo", "activo", "Activar", "", "Contrato no vencido y RUC de 11 dígitos"),
           T("activo", "inactivo", "Desactivar", "", "Motivo obligatorio"),
           T("activo", "vencido", "Contrato vencido", "Job diario / cálculo"),
           T("vencido", "inactivo", "Renovar contrato con fecha futura o editar fin de contrato ≥ hoy")]),
    "catalog_services.status": dict(
        titulo="Servicio", fuentes=[dict(spec="02", sec="4.7")],
        t=[T("inactivo", "activo", "Activar", "", "Proveedor activo y `valid_to ≥ hoy`"),
           T("activo", "inactivo", "Desactivar", "", "Motivo obligatorio"),
           T("activo", "inactivo", "Guardar con proveedor no activo", "Sistema", efectos="Se fuerza `inactivo`")],
        notas=["`vencido` es efectivo cuando `valid_to < hoy` (02 §4.7). Supuesto: si se persiste, lo asigna el mismo cálculo/job que en proveedores."]),
    "catalog_seasons.status": dict(
        titulo="Temporada", fuentes=[dict(spec="02", sec="4.8")],
        t=[T("activa", "inactiva", "Formulario de edición o «Inactivar» desde el modal de borrado bloqueado"),
           T("inactiva", "activa", "Formulario de edición")]),
    "catalog_product_promotions.status": dict(
        titulo="Promoción de producto", fuentes=[dict(spec="02", sec="4.8"), dict(spec="08", sec="4.7")],
        t=[T("activa", "inactiva", "Pausar", "`update`"),
           T("inactiva", "activa", "Activar", "`update`", "No vencida (`date_to ≥ hoy`)")],
        notas=["`vencida` es efectiva si `date_to < hoy` y no se puede alternar."]),
    "catalog_availability_ranges.status": dict(
        titulo="Rango de disponibilidad", fuentes=[dict(spec="16", sec="4.2")],
        t=[T("*", "disponible|cerrado|agotado", "Crear rango (`POST /api/v1/catalog/products/{id}/availability-ranges`)", "`catalog.products.manage_availability`", "Sin solape (CAT-AV-01/03/04)"),
           T("disponible|cerrado|agotado", "disponible|cerrado|agotado", "Editar rango (`PATCH …/availability-ranges/{rangeId}`, `If-Match`)", "`catalog.products.manage_availability`", "Validación de solape y ventas (CAT-AV-01/03/04)")],
        notas=["`activo → eliminado` de 16 §4.2 es el soft delete de la fila (`deleted_at`), no un valor de `status`.",
               "Supuesto: «disponible ↔ cerrado ↔ agotado por edición» se interpreta como cambio libre entre los tres valores, sujeto a las validaciones.",
               "Permiso y endpoints según `kit-ia/api/openapi.yaml` (16 §6.2)."]),
    "catalog_price_rules.status": dict(
        titulo="Regla de pricing", fuentes=[dict(spec="02", sec="4.8")],
        t=[T("activa", "inactiva", "Switch", "`manage_rates`"), T("inactiva", "activa", "Switch", "`manage_rates`")]),
    # ------------------------------------------------------------------ 03 Cotizaciones
    "quote_quotes.status": dict(
        titulo="Cotización", fuentes=[dict(spec="03", sec="4.1", tabla=True), dict(spec="08", sec="4.4", tabla=True)],
        terminales=["convertida"], omitir_diagrama=[("*", "cancelada")],
        notas=["`cancelada` existe en el CHECK pero no está implementada en el prototipo (03 §12).",
               "La UI trata como vencida cualquier `enviada`/`vista`/`negociacion` con validez pasada aunque el job no haya corrido.",
               "Plantilla de prueba: `kit-ia/tests/pest/Unit/Quotes/QuoteStateMachineTest.php`."]),
    "quote_versions.status": dict(
        titulo="Versión de cotización", fuentes=[dict(spec="03", sec="4.1")],
        t=[T("*", "borrador", "Crear cotización o nueva versión", "`quotes.create`"),
           T("borrador", "enviada", "Enviar", "`quotes.send`", efectos="Congela la versión"),
           T("enviada", "aprobada", "Registrar aprobación del cliente / portal", "`reservations.create`", efectos="Inmutable (candado)"),
           T("enviada", "rechazada", "Rechazar", "`quotes.send`"),
           T("enviada", "vencida", "Vencimiento", "Sistema", efectos="Según la spec solo aparece en datos semilla"),
           T("borrador|enviada|aprobada|rechazada|vencida", "reemplazada", "Crear nueva versión", "`quotes.create`", efectos="La versión anterior deja de ser vigente")],
        terminales=["reemplazada"],
        notas=["Una versión en `negociacion` (cabecera) conserva `enviada`."]),
    "quote_internal_approvals.status": dict(
        titulo="Aprobación interna de cotización", fuentes=[dict(spec="03", sec="4.2", tabla=True)],
        terminales=["aprobada", "rechazada", "anulada"]),
    # ------------------------------------------------------------------ 04 Reservas
    "booking_reservations.status": dict(
        titulo="Reserva", fuentes=[dict(spec="04", sec="4.1", tabla=True), dict(spec="07", sec="4.9"), dict(spec="08", sec="4.5"), dict(spec="15", sec="4.4")],
        alias={"no cerrada": ["borrador", "pendiente_disponibilidad", "confirmada", "pendiente_pago", "pendiente_proveedor", "reprogramada", "parcial", "incidencia", "en_operacion"]},
        celda={"(sin cambio)": []},
        t=[T("*", "pendiente_pago", "Reserva B2B prepago o pedido e-commerce / sitio web", "Canales (sistema)", ref="08 §4.5 · 15 §4.4"),
           T("*", "pendiente_proveedor", "Reserva B2B crédito con producto bajo solicitud", "Canales (sistema)", ref="08 §4.5"),
           T("pendiente_pago", "confirmada", "Todas las CxC no canceladas pagadas (Finanzas o pago rápido) / tarjeta aprobada", "Sistema", ref="07 §4.9 · 15 §4.4"),
           T("pendiente_pago", "pendiente_proveedor", "Pago aprobado con servicios bajo solicitud", "Sistema", ref="08 §4.5 · 15 §4.4"),
           T("pendiente_pago", "cancelada", "Anular o expirar el pedido web", "Sistema / `channels.ecommerce.manage`", ref="08 §4.2")],
        terminales=["completada", "cancelada"],
        notas=["`parcial` e `incidencia` existen en el CHECK pero ningún módulo documenta cuándo se asignan (04 §4.1): Por definir.",
               "La reversión de un pago no devuelve la reserva a `pendiente_pago` (07 §4.9, P-09)."]),
    "booking_reservation_services.status": dict(
        titulo="Servicio de reserva", fuentes=[dict(spec="04", sec="4.2"), dict(spec="05", sec="4.3", tabla=True), dict(spec="06", sec="4.1", tabla=True)],
        alias={"por responder": ["pendiente", "solicitado"], "por responder / alternativa propuesta": ["pendiente", "solicitado"],
               "alternativa propuesta": ["pendiente", "solicitado"], "cualquiera": ["pendiente", "solicitado", "confirmado", "rechazado", "en_curso"]},
        celda={"(sin cambio) + respuesta alternativa": [], "Alternativa propuesta": [], "confirmado / Por responder": ["confirmado"]},
        t=[T("*", "pendiente", "Conversión / reserva directa / modificación", "Sistema", ref="04 §4.3 paso 10"),
           T("pendiente", "solicitado", "Solicitar", "`operations.assign`", "Proveedor `activo` (PRD-BR-007)", ref="04 §4.2"),
           T("solicitado", "confirmado", "Confirmar", "", "Código obligatorio; hora y «confirmado por» opcionales", ref="04 §4.2"),
           T("confirmado", "completado", "Operaciones completa el servicio", ref="04 §4.2"),
           T("solicitado|confirmado", "rechazado", "Rechazar", "", "Motivo + detalle obligatorios", "Alternativa opcional → nuevo servicio `pendiente` con `alt_of`; el rechazado queda con `replaced_by`", ref="04 §4.2"),
           T("pendiente|solicitado|confirmado|rechazado|en_curso", "cancelado", "Cancelación de la reserva", "`reservations.cancel`", ref="04 §4.2 · §4.6"),
           T("solicitado|confirmado", "pendiente", "Reprogramación", "`reservations.modify`", efectos="Todos los activos vuelven a `pendiente` sin código", ref="04 §4.5")],
        terminales=["completado", "cancelado"],
        notas=["La spec 04 lo nombra `booking_services`; en SQL es `booking_reservation_services`.",
               "En la extranet (06 §4.1) «Por responder» y «Alternativa propuesta» son etiquetas sobre `pendiente`/`solicitado` según la última respuesta; la alternativa vive en `supplier_request_responses.review_status`."]),
    "booking_changes.status": dict(
        titulo="Modificación / reprogramación de reserva", fuentes=[dict(spec="04", sec="4.4"), dict(spec="04", sec="4.5")],
        t=[T("*", "pendiente", "Solicitar modificación", "`reservations.modify`", efectos="Audita `solicitar_modificacion`; notifica a gerencia"),
           T("*", "aplicada", "«Aprobar como supervisor y aplicar ahora» / reprogramación aplicada", "`quotes.approve_internal` · `reservations.modify`", efectos="Reprogramación: `type='reprogramacion'`, `approved_by` = actor"),
           T("pendiente", "aplicada", "Aprobar", "`quotes.approve_internal`", efectos="Aplica el cambio; audita `modificar`; email `reserva.modificada`"),
           T("pendiente", "rechazada", "Rechazar", "`quotes.approve_internal`", efectos="Audita `rechazar_modificacion`")],
        terminales=["aplicada", "rechazada"]),
    "booking_cancel_requests.status": dict(
        titulo="Solicitud de anulación", fuentes=[dict(spec="04", sec="4.6"), dict(spec="10", sec="4.1"), dict(spec="10", sec="4.3")],
        t=[T("*", "pendiente", "Solicitar anulación", "`reservations.create` sin `reservations.cancel` (dueño)", "Reserva no cerrada; sin otra pendiente; motivo + detalle", "Notifica a managers; la reserva sigue vigente", ref="04 §4.6"),
           T("pendiente", "aprobada", "Procesar cancelación / aprobar en bandeja", "`reservations.cancel`", efectos="Efecto completo de la cancelación (04 §4.6); notifica al solicitante", ref="04 §4.6 · 10 §4.3"),
           T("pendiente", "rechazada", "Rechazar solicitud", "`reservations.cancel`", "Motivo obligatorio", "Notifica al solicitante; la reserva sigue vigente", ref="04 §4.6 · 10 §4.3"),
           T("pendiente", "retirada", "Retirar la solicitud de aprobación", "Solicitante", efectos="La solicitud de aprobación pasa a `anulada`", ref="10 §4.1")],
        terminales=["aprobada", "rechazada", "retirada"]),
    "channel_pax_feedback.status": dict(
        titulo="Comentario del pasajero", fuentes=[dict(spec="04", sec="v2.1")],
        t=[T("*", "nuevo", "Pasajero envía comentario"),
           T("nuevo", "leido", "Marcar leído / Responder «En seguimiento»", "Back-office"),
           T("leido", "respondido", "Responder con estado «Respondido»", "Back-office", efectos="Mensaje saliente `notif_pax_messages`; resuelve la conversación si existe"),
           T("leido", "leido", "Responder «En seguimiento»", "Back-office"),
           T("nuevo|leido|respondido", "derivado", "Derivar a incidencia", "Back-office", efectos="Crea `ops_incidents` con `feedback_id`")],
        terminales=["derivado"],
        notas=["La spec 04 v2.1 la nombra `booking_pax_feedback`; en SQL es `channel_pax_feedback`.",
               "La spec escribe «nuevo → leido → respondido»; Supuesto: `respondido` se alcanza desde `leido` y también directamente desde `nuevo` al responder."]),
    # ------------------------------------------------------------------ 05 Operaciones
    "ops_orders.status": dict(
        titulo="Orden operativa", fuentes=[dict(spec="05", sec="4.1", tabla=True)],
        alias={"activo": ["planificada", "pendiente_asignacion", "asignada", "confirmada", "en_ejecucion"]},
        celda={"recalculado": ["pendiente_asignacion", "asignada", "confirmada"]},
        terminales=["completada", "cancelada"],
        notas=["Hallazgo H-16: el cierre exige `en_ejecucion` además de las 4 precondiciones PROC-039.",
               "Reprogramación de la reserva (04 §4.5): la orden vuelve a `pendiente_asignacion`."]),
    "ops_assignments.status": dict(
        titulo="Asignación de recurso", fuentes=[dict(spec="05", sec="4.2", tabla=True), dict(spec="04", sec="4.6")],
        terminales=["completada"],
        notas=["La fila «`confirmado`/`en_curso` (servicio) → `completada`» se refiere al estado del servicio de la reserva; la asignación pasa a `completada`.",
               "La cancelación de la reserva (04 §4.6 paso 7) pasa las asignaciones no completadas a «cancelada», pero ese valor no está en el CHECK de `ops_assignments.status`: Por definir (agregar el valor o liberar la asignación)."]),
    "ops_vouchers.status": dict(
        titulo="Voucher", fuentes=[dict(spec="05", sec="4.4", tabla=True), dict(spec="06", sec="4.3")],
        terminales=["utilizado", "anulado"],
        notas=["Las versiones viven en `ops_voucher_versions`; «emitido vN → emitido vN+1» no cambia el estado."]),
    "ops_incidents.status": dict(
        titulo="Incidencia", fuentes=[dict(spec="05", sec="4.5", tabla=True), dict(spec="06", sec="4.5")]),
    "ops_rooming_lists.status": dict(
        titulo="Rooming list", fuentes=[dict(spec="05", sec="4.6", tabla=True), dict(spec="06", sec="4.2")],
        celda={"(ack)": [], "(confirmada por hotel)": []},
        notas=["El acuse y la confirmación del hotel no cambian `status`: registran `hotel_ack_at` y `hotel_confirmed_at` (06 §4.2)."]),
    "ops_rooming_rooms.status": dict(
        titulo="Habitación de rooming list", fuentes=[dict(spec="05", sec="4.6"), dict(spec="06", sec="4.2")],
        t=[T("*", "pendiente", "Agregar habitación", "`reservations.modify`"),
           T("pendiente|confirmada|observada", "pendiente|confirmada|observada", "Edición en web", "`reservations.modify`"),
           T("pendiente", "confirmada", "Extranet «Confirmar habitaciones» (habitaciones no observadas)", "Hotel", efectos="`hotel_confirmed_at` en la lista"),
           T("pendiente|confirmada", "observada", "Extranet «Reportar observación»", "Hotel", efectos="`hotel_note`; crea incidencia `Proveedor`")]),
    "ops_guides.status": dict(
        titulo="Guía (recurso)", fuentes=[dict(spec="05", sec="4.7")],
        t=[T("disponible|asignado|descanso|vacaciones", "disponible|asignado|descanso|vacaciones", "Cambio manual en «Asignaciones y recursos»", "`operations.assign`", efectos="Audit `cambio_estado`")],
        notas=["Supuesto: la notación «disponible ↔ asignado ↔ descanso ↔ vacaciones» se interpreta como cambio manual libre entre estados. 05 §12 propone derivar `asignado` de las asignaciones."]),
    "ops_drivers.status": dict(
        titulo="Conductor (recurso)", fuentes=[dict(spec="05", sec="4.7")],
        t=[T("disponible|asignado|descanso|vacaciones", "disponible|asignado|descanso|vacaciones", "Cambio manual en «Asignaciones y recursos»", "`operations.assign`", efectos="Audit `cambio_estado`")],
        notas=["Supuesto: cambio manual libre entre estados (misma lectura que guías)."]),
    "ops_vehicles.status": dict(
        titulo="Vehículo (recurso)", fuentes=[dict(spec="05", sec="4.7")],
        t=[T("disponible|asignado|mantenimiento", "disponible|asignado|mantenimiento", "Cambio manual en «Asignaciones y recursos»", "`operations.assign`", efectos="Audit `cambio_estado`")],
        notas=["Supuesto: cambio manual libre entre estados."]),
    "ops_supplier_requests.status": dict(
        titulo="Solicitud al proveedor (PROC-032)", fuentes=[dict(spec="05", sec="4.3"), dict(spec="06", sec="4.1")], t=[],
        notas=["05 §4.3 y 06 §4.1 documentan el ciclo sobre `booking_reservation_services.status` (solicitado → confirmado/rechazado, alternativa propuesta); "
               "no fijan cuándo cambia `ops_supplier_requests.status` ni cuándo pasa a `anulada`. Supuesto razonable a validar: reflejar la respuesta del proveedor "
               "(`confirmado`, `rechazado`, `alternativa_propuesta`) y `anulada` al cancelar el servicio."]),
    # ------------------------------------------------------------------ 06 Extranet
    "supplier_request_responses.review_status": dict(
        titulo="Revisión de alternativa del proveedor", fuentes=[dict(spec="06", sec="4.1")],
        t=[T("*", "pendiente", "Proveedor propone «Alternativa»", "Proveedor", "Tipo + detalle", "Notifica a Operaciones; audit `proveedor_alternativa`"),
           T("pendiente", "aceptada", "Operaciones acepta la alternativa", "Operaciones", "No implementado en el prototipo (06 §12)", "Servicio → `confirmado`"),
           T("pendiente", "rechazada", "Operaciones rechaza la alternativa", "Operaciones", "No implementado en el prototipo (06 §12)", "Servicio vuelve a «Por responder»")],
        notas=["`expirada` no tiene disparador documentado: Por definir."]),
    "supplier_invoices.status": dict(
        titulo="Factura del proveedor", fuentes=[dict(spec="06", sec="4.4")],
        t=[T("*", "registrada", "Proveedor agrega la factura en la extranet", "Proveedor"),
           T("registrada", "validada", "Validar", "Finanzas"), T("registrada", "observada", "Observar", "Finanzas"),
           T("registrada", "rechazada", "Rechazar", "Finanzas")]),
    "supplier_rate_requests.status": dict(
        titulo="Solicitud de tarifa del proveedor", fuentes=[dict(spec="06", sec="4.6"), dict(spec="10", sec="4.3")],
        t=[T("*", "pendiente", "Proveedor solicita cambio de tarifa", "Proveedor"),
           T("pendiente", "aprobada", "Aprobar (bandeja de aprobaciones, tipo `provider_rate`)", "Compras/Operaciones", efectos="Actualiza el costo del servicio o `scheduled_cost`; historial; notifica al proveedor", ref="06 §4.6 · 10 §4.3"),
           T("pendiente", "rechazada", "Rechazar", "Compras/Operaciones", efectos="Notifica al proveedor", ref="06 §4.6 · 10 §4.3"),
           T("pendiente", "retirada", "Retirar", "Proveedor", "Propuesto en la spec", ref="06 §4.6")],
        terminales=["aprobada", "rechazada", "retirada"]),
    # ------------------------------------------------------------------ 07 Finanzas
    "fin_receivables.status": dict(
        titulo="Cuenta por cobrar (CxC)", fuentes=[dict(spec="07", sec="4.1", tabla=True), dict(spec="15", sec="4.5")],
        terminales=["cancelada"],
        notas=["En el prototipo el estado es derivado (`cxcStatus`); orden de evaluación: `cancelada` → `pagada` si saldo ≤ 0 → `vencida` si `due < hoy` → `parcial` si pagado > 0 → `abierta`.",
               "[Decisión] `vencida` la asigna un scheduler diario."]),
    "fin_payments.status": dict(
        titulo="Pago", fuentes=[dict(spec="07", sec="4.2", tabla=True), dict(spec="10", sec="4.3")],
        terminales=["revertido"],
        notas=["La reversión puede requerir aprobación (tipo `reversal`, 10 §4.3)."]),
    "fin_payables.status": dict(
        titulo="Cuenta por pagar (CxP)", fuentes=[dict(spec="07", sec="4.3", tabla=True), dict(spec="10", sec="4.3")],
        celda={"aprobada (o vencida con approved_at)": ["aprobada"]},
        t=[T("aprobada", "parcial", "Registrar pago (payout) con saldo > 0", "`finance.payables` + `OP`", ref="07 §4.3 [Decisión] · Supuesto"),
           T("parcial", "pagada", "Registrar pago que deja saldo 0", "`finance.payables` + `OP`", ref="07 §4.3 [Decisión] · Supuesto"),
           T("abierta|aprobada|parcial|vencida", "cancelada", "Cancelación del servicio o de la reserva", "Sistema", ref="07 §4.3 [Decisión] · Supuesto")],
        terminales=["pagada", "cancelada"],
        notas=["Estado derivado en el prototipo (`cxpStatus`): `pagada` si saldo ≤ 0 → `vencida` si `due < hoy` → `aprobada` si `approved` → `abierta`.",
               "«Aprobar» una CxP `vencida` la deja `vencida` con `approved_at` (el estado derivado prioriza el vencimiento).",
               "[Decisión] 07 §4.3 agrega `parcial` y `cancelada`; los pares desde/hacia de esas transiciones son Supuesto.",
               "El rechazo en la bandeja (tipo `payable`) no cambia el estado: guarda `observation` y la deja «observada» para la ronda 2 (10 §4.3)."]),
    "fin_commissions.status": dict(
        titulo="Comisión", fuentes=[dict(spec="07", sec="4.4", tabla=True), dict(spec="10", sec="4.3"), dict(spec="14", sec="4.5")],
        terminales=["pagada"],
        notas=["El cierre de una meta con bono alcanzado crea la comisión «Bono por meta» en `calculada` (14 §4.5).",
               "Rechazo en la bandeja (tipo `commission`): guarda `observation` y sigue `calculada` hasta el reenvío."]),
    "fin_invoices.status": dict(
        titulo="Comprobante electrónico", fuentes=[dict(spec="07", sec="4.6", tabla=True)],
        t=[T("*", "pendiente_envio", "Validar y emitir: queda en outbox antes de la respuesta de envío", "`finance.invoicing`", ref="07 §4.6 [Decisión]"),
           T("pendiente_envio", "emitido", "Enviado al OSE (ticket)", "Sistema", ref="07 §4.6 [Decisión]"),
           T("emitido", "rechazado", "Respuesta OSE: inválido (numeración consumida)", "Sistema", efectos="Nunca se entrega", ref="07 §4.6 [Decisión]"),
           T("aceptado|observado", "anulado", "Nota de crédito total o comunicación de baja/resumen", "`finance.invoicing`", ref="07 §4.6 [Decisión] · Supuesto")],
        terminales=["rechazado", "anulado"], omitir_diagrama=[("*", "anulado")],
        notas=["[Decisión] estados de producción: `pendiente_envio` → `emitido` → `aceptado` | `observado` | `rechazado` → `anulado`. En SUNAT un comprobante `observado` ya es válido; el «corregir y reenviar» del prototipo debe revisarse con el OSE (07 §12 P-03).",
               "Supuesto: `anulado` se alcanza desde comprobantes válidos (`aceptado`, `observado`); la spec no precisa el origen."]),
    "fin_bank_lines.status": dict(
        titulo="Línea de extracto bancario", fuentes=[dict(spec="07", sec="4.7", tabla=True)],
        celda={"cerrada (closure_id)": []},
        notas=["«Cerrar conciliación» no cambia `status`: asigna `closure_id` y bloquea las líneas (`cerrada` no es un valor del CHECK)."]),
    "fin_period_closes.status": dict(
        titulo="Periodo contable", fuentes=[dict(spec="07", sec="4.8")],
        t=[T("*", "abierto", "Apertura del periodo"),
           T("abierto", "cerrado", "Cerrar periodo", "`finance.invoicing`", "Todos los controles OK")],
        terminales=["cerrado"], notas=["Sin reapertura."]),
    # ------------------------------------------------------------------ 08 Canales
    "channel_b2b_agencies.status": dict(
        titulo="Agencia B2B", fuentes=[dict(spec="08", sec="4.1", tabla=True), dict(spec="10", sec="4.3")],
        celda={"bloqueada (efectivo)": [], "vencido (efectivo)": []},
        notas=["Estado efectivo (`agStatus`): `vencido` si `valid_to < hoy` (no se persiste); si no, `bloqueada` si `credit_limit > 0 AND credit_used > credit_limit`; si no, `status`.",
               "La aprobación de una excepción de crédito (`credit_b2b`, 10 §4.3) reactiva la agencia bloqueada por consumo."]),
    "channel_ecom_orders.status": dict(
        titulo="Pedido web (e-commerce)", fuentes=[dict(spec="08", sec="4.2", tabla=True), dict(spec="15", sec="4.2", tabla=True)],
        alias={"por_validar": ["pago_por_validar"]},
        celda={"pago_pendiente (sub-estado por_validar)": ["pago_por_validar"]},
        terminales=["confirmado", "cancelado", "expirado"],
        notas=["Supuesto: el sub-estado `por_validar` de 15 §4.2 se persiste como `pago_por_validar` (valor del CHECK).",
               "El vencimiento de validación de 4 h hábiles está marcado como propuesto en la spec."]),
    "cms_contents.status": dict(
        titulo="Contenido CMS", fuentes=[dict(spec="08", sec="4.3", tabla=True)],
        notas=["No hay transición `aprobado → borrador` ni `aprobado → en_revision` en el prototipo (08 §12)."]),
    "channel_support_tickets.status": dict(
        titulo="Ticket de soporte", fuentes=[dict(spec="08", sec="4.7"), dict(spec="10", sec="4.2")],
        t=[T("*", "abierta", "Cliente crea el ticket desde el portal", "Cliente", ref="08 §4.7"),
           T("abierta|en_proceso", "resuelta", "La conversación asociada se resuelve", "Sistema", ref="10 §4.2"),
           T("resuelta", "en_proceso", "Reabrir la conversación", "Agente", ref="10 §4.2")],
        notas=["El prototipo solo usa `abierta`; `abierta → en_proceso` y el paso a `cerrada` no están documentados: Por definir."]),
    # ------------------------------------------------------------------ 09 Administración
    "tenants.status": dict(
        titulo="Tenant", fuentes=[dict(spec="09", sec="4.1", tabla=True), dict(spec="13", sec="4.1")],
        omitir_diagrama=[("prueba", "activo")],
        notas=["`prueba → activo` no existe en el prototipo (09 §12).",
               "13 §4.1 indica `tenants.status = suspended` cuando la suscripción pasa a `suspended`; el valor del CHECK es `suspendido`."]),
    "iam_users.status": dict(
        titulo="Usuario del tenant", fuentes=[dict(spec="09", sec="4.2", tabla=True), dict(spec="00", sec="4", row="Usuario")],
        alias={"invitar": ["*"]}),
    "iam_sedes.status": dict(
        titulo="Sede", fuentes=[dict(spec="09", sec="4.3", tabla=True)],
        alias={"crear": ["*"]}),
    "notif_messages.status": dict(
        titulo="Notificación", fuentes=[dict(spec="09", sec="4.5")],
        t=[T("*", "pendiente", "Se genera la notificación", "Sistema"),
           T("pendiente", "enviado", "Envío OK", "Sistema"), T("pendiente", "fallido", "Envío con error", "Sistema"),
           T("fallido", "enviado", "Reintentar", "Sistema / Admin", efectos="`retries + 1`"),
           T("fallido", "fallido", "Reintentar sin éxito / error permanente", "Sistema / Admin", efectos="`retries + 1`; error permanente genera `integration_errors` `fallo_definitivo`")],
        notas=["Canal alterno: desde `fallido` se crea un mensaje Email nuevo con `is_fallback` (no cambia el estado del original)."]),
    "integration_errors.status": dict(
        titulo="Error de integración", fuentes=[dict(spec="09", sec="4.6")],
        t=[T("*", "reintentando", "Falla una integración", "Sistema"),
           T("reintentando", "resuelto", "Reintento OK", "Sistema"),
           T("reintentando", "fallo_definitivo", "`attempt ≥ max`", "Sistema", efectos="Alerta"),
           T("fallo_definitivo", "reintentando", "Reintentar (JOB-07)", "Admin", efectos="`attempt = 0`"),
           T("reintentando|fallo_definitivo", "resuelto", "Resolver con motivo", "Admin")],
        terminales=["resuelto"], notas=["Error permanente: el reintento solo incrementa `attempt` (INT-BR-05)."]),
    "sys_scheduled_jobs.last_status": dict(
        titulo="Job programado (último resultado)", fuentes=[dict(spec="09", sec="4.7")],
        t=[T("ok|advertencia|error", "en_curso", "Ejecutar ahora / disparo del scheduler", "Admin / Scheduler"),
           T("en_curso", "ok|advertencia|error", "Termina la ejecución", "Sistema")],
        notas=["`last_status` es NULL hasta la primera ejecución. `paused` es una bandera independiente (pausar → `next_run_at = null`)."]),
    "sys_job_runs.status": dict(
        titulo="Ejecución de job", fuentes=[dict(spec="09", sec="4.7")],
        t=[T("*", "en_curso", "Inicia la ejecución", "Scheduler / Admin"),
           T("en_curso", "ok|advertencia|error", "Termina la ejecución", "Sistema")],
        terminales=["ok", "advertencia", "error"]),
    "report_exports.status": dict(
        titulo="Exportación de reporte", fuentes=[dict(spec="09", sec="4.8")],
        t=[T("*", "en_cola", "Solicitar exportación", "Usuario con permiso del reporte", "Sin permiso no se crea (audita `exportar_denegado`, 403)"),
           T("en_cola", "procesando", "El job toma la exportación", "Sistema"),
           T("procesando", "disponible", "Archivo generado", "Sistema"),
           T("procesando", "fallido", "Error del job", "Sistema"),
           T("disponible", "expirado", "Vence `expires_at`", "Sistema")],
        terminales=["fallido", "expirado"]),
    "integration_adapters.status": dict(
        titulo="Adaptador de integración", fuentes=[dict(spec="09", sec="4.9")], t=[],
        notas=["Estados de gestión de plataforma, no transicionables desde la UI del tenant. Solo cambia `environment` (`sandbox → production` bloqueado si `status IN (por_validar, futuro)` o `sandbox`). Transiciones de plataforma: Por definir."]),
    # ------------------------------------------------------------------ 10 Aprobaciones e inbox
    "collab_approval_requests.status": dict(
        titulo="Solicitud de aprobación", fuentes=[dict(spec="10", sec="4.1", tabla=True), dict(spec="10", sec="4.3")],
        terminales=["aprobada", "anulada"],
        notas=["Reenviar una solicitud `rechazada` (payable/commission) crea una **nueva** solicitud `pendiente` (ronda + 1); la rechazada no cambia."]),
    "collab_conversations.status": dict(
        titulo="Conversación (inbox)", fuentes=[dict(spec="10", sec="4.2", tabla=True), dict(spec="15", sec="4.6")],
        alias={"cualquiera": []}),
    # ------------------------------------------------------------------ 11 Cupos y documentos
    "catalog_allotments.status": dict(
        titulo="Contrato de cupo", fuentes=[dict(spec="11", sec="4.1", tabla=True)],
        alias={"(nuevo)": ["*"]}),
    "catalog_allotment_requests.status": dict(
        titulo="Ampliación de cupo", fuentes=[dict(spec="11", sec="4.3")],
        t=[T("*", "solicitada", "Solicitar ampliación"),
           T("solicitada", "aceptada", "Aceptar", "", "Respuesta obligatoria", "Suma `extra_qty` a `blocked_qty` de cada fecha"),
           T("solicitada", "rechazada", "Rechazar", "", "Respuesta obligatoria")],
        terminales=["aceptada", "rechazada"]),
    "ops_travel_doc_items.status": dict(
        titulo="Ítem documental de viaje", fuentes=[dict(spec="11", sec="4.4", tabla=True)],
        notas=["`vencido` y `no_aplica` son estados calculados (no están en el CHECK).",
               "Estado por pasajero y por reserva = peor estado de sus ítems: vencido > observado > pendiente (incluye recibido) > completo."]),
    # ------------------------------------------------------------------ 12 Tesorería y reclamaciones
    "fin_cash_sessions.status": dict(
        titulo="Sesión de caja", fuentes=[dict(spec="12", sec="4", para="**Sesión de caja:**")],
        t=[T("*", "open", "Abrir sesión (`POST …/sessions`)", "Finanzas / Tenant Admin", "No puede haber dos sesiones abiertas por caja"),
           T("open", "closed", "Acta de arqueo de tipo `closing`", "Finanzas / Tenant Admin")],
        terminales=["closed"]),
    "fin_cash_counts.status": dict(
        titulo="Arqueo de caja", fuentes=[dict(spec="12", sec="4", para="**Arqueo:**")],
        t=[T("*", "signed", "Firmar arqueo", "Firmante", efectos="Diferencia dentro de tolerancia → ajuste `count_adjustment` al firmar"),
           T("signed", "validated", "Validar", "Contabilidad", "`|diferencia| ≤ tolerancia`"),
           T("signed", "pending_approval", "Diferencia mayor a la tolerancia", "Sistema"),
           T("pending_approval", "approved", "Aprobar", "Manager o Finanzas distinto del firmante", efectos="Genera el ajuste; si es de cierre, cierra la sesión"),
           T("approved", "validated", "Validar", "Contabilidad")],
        terminales=["validated"],
        notas=["Supuesto: el paso a `pending_approval` ocurre al firmar cuando la diferencia supera la tolerancia."]),
    "fin_cash_replenishments.status": dict(
        titulo="Reposición de caja", fuentes=[dict(spec="12", sec="4", para="**Reposición:**")],
        t=[T("*", "requested", "Solicitar reposición", "Finanzas / Tenant Admin", efectos="Marca los gastos pendientes con `replenishment_id`"),
           T("requested", "approved", "Aprobar", "Manager, Finanzas o Tenant Admin (≠ solicitante)"),
           T("requested", "rejected", "Rechazar", "Manager, Finanzas o Tenant Admin (≠ solicitante)", efectos="Libera los gastos"),
           T("approved", "paid", "Pagar", "Finanzas / Tenant Admin", efectos="Transferencia `replenishment` banco → caja"),
           T("paid", "approved", "Se anula la transferencia de reposición", "Sistema")],
        terminales=["rejected"]),
    "fin_treasury_movements.status": dict(
        titulo="Movimiento de tesorería", fuentes=[dict(spec="12", sec="4", para="**Movimiento:**")],
        t=[T("*", "posted", "Registrar movimiento"),
           T("posted", "voided", "Anular", "", "Solo manuales, transferencias (todas sus partidas), gastos no rendidos y liquidaciones; los sincronizados se corrigen en el origen")],
        terminales=["voided"]),
    "crm_cases.book_status": dict(
        titulo="Hoja de reclamación (Libro de Reclamaciones)", fuentes=[dict(spec="12", sec="4", para="**Hoja de reclamación:**"), dict(spec="15", sec="4.6")],
        t=[T("*", "received", "Alta de la hoja", "Consumidor (portal/web) o personal (presencial)", efectos="Correlativo por sede, `due_date`, constancia por email, notificación al responsable"),
           T("received", "in_review", "Asignar responsable", "`crm.claims.manage`", efectos="Notificación"),
           T("received|in_review", "answered", "Responder", "`crm.claims.manage`", efectos="Email al consumidor; marca «fuera de plazo» si `sent_at > due_date`"),
           T("answered", "answered", "Reenviar respuesta", "`crm.claims.manage`", efectos="Nuevo envío registrado"),
           T("answered", "closed", "Cerrar", "`crm.claims.manage`", "Motivo de cierre", "Sincroniza `resolution` y estado cerrado en Postventa")],
        terminales=["closed"],
        notas=["Estado de plazo derivado: `en_plazo`, `por_vencer`, `vencido`, `respondido_en_plazo`, `respondido_fuera_de_plazo`.",
               "15 §4.6 usa etiquetas en español (recibido → en_evaluacion → respondido → cerrado) para los mismos estados."]),
    # ------------------------------------------------------------------ 13 Plataforma
    "subscriptions.status": dict(
        titulo="Suscripción", fuentes=[dict(spec="13", sec="4.1", tabla=True)],
        celda={"active (cambio programado)": ["active"]},
        t=[T("suspended", "canceled", "Fin del periodo de solo lectura (7 días) tras el trial vencido", "Job", ref="13 §4.1")],
        terminales=["canceled"]),
    "subscription_changes.status": dict(
        titulo="Cambio programado de suscripción", fuentes=[dict(spec="13", sec="4.1")],
        t=[T("*", "scheduled", "Downgrade válido", "Tenant Admin / Super Admin"),
           T("scheduled", "applied", "Renovación de la suscripción", "Job de renovación")],
        notas=["`voided` no tiene disparador documentado: Por definir."]),
    "platform_invoices.status": dict(
        titulo="Factura de plataforma", fuentes=[dict(spec="13", sec="4.2"), dict(spec="13", sec="4.3")],
        t=[T("*", "draft", "Generar factura"),
           T("draft", "open", "Emitir"),
           T("open", "paid", "Cobro aprobado"),
           T("open", "failed", "Cobro rechazado (D0)", efectos="Inicia el dunning"),
           T("failed", "paid", "Reintento aprobado / pago manual"),
           T("failed", "uncollectible", "Último reintento rechazado", efectos="Suscripción → `suspended`"),
           T("draft|open|failed|uncollectible", "void", "Nota de crédito"),
           T("paid", "void", "Nota de crédito", efectos="Reembolso a la pasarela")],
        terminales=["void"]),
    "integration_api_keys.status": dict(
        titulo="API key", fuentes=[dict(spec="13", sec="4.4")],
        t=[T("*", "active", "Crear API key", "Tenant Admin"),
           T("active", "revoked", "Revocar (manual, irreversible)", "Tenant Admin", efectos="401 inmediato (se invalida la caché de autenticación)"),
           T("active", "expired", "Vencimiento", "Job diario")],
        terminales=["revoked", "expired"]),
    "integration_webhooks.status": dict(
        titulo="Webhook", fuentes=[dict(spec="13", sec="4.5")],
        t=[T("*", "active", "Crear webhook"),
           T("active", "paused", "Pausar (manual)"), T("paused", "active", "Reanudar (manual)"),
           T("active", "disabled", "`consecutive_failures ≥ 10`", "Sistema", efectos="Email al Tenant Admin"),
           T("disabled", "active", "Reactivar (manual)", efectos="Contador de fallos a 0"),
           T("active|paused|disabled", "deleted", "Eliminar")],
        terminales=["deleted"], notas=["Cambiar la URL resetea el contador de fallos."]),
    "integration_webhook_deliveries.status": dict(
        titulo="Entrega de webhook", fuentes=[dict(spec="13", sec="4.5")],
        t=[T("*", "pending", "Evento a entregar"),
           T("pending", "delivered", "2xx en menos de 10 s"),
           T("pending|retrying", "retrying", "Fallo; backoff 1 min, 5 min, 30 min, 2 h, 6 h, 24 h"),
           T("retrying", "delivered", "Reintento con 2xx", ref="13 §4.5 · Supuesto"),
           T("retrying", "failed", "Se agotan los 6 intentos")],
        terminales=["delivered", "failed"],
        notas=["Un reenvío manual crea una entrega nueva con `manual = true`.", "Supuesto: un reintento exitoso pasa a `delivered`."]),
    # ------------------------------------------------------------------ 14 Marketing y metas
    "mkt_campaigns.status": dict(
        titulo="Campaña", fuentes=[dict(spec="14", sec="4.1", tabla=True)], terminales=["enviada", "cancelada"]),
    "mkt_consents.status": dict(
        titulo="Consentimiento", fuentes=[dict(spec="14", sec="4.2", tabla=True)],
        alias={"(sin registro)": ["*"]},
        notas=["Sin borrado: los eventos quedan en `mkt_consent_events` (append-only)."]),
    "mkt_templates.status": dict(
        titulo="Plantilla de marketing", fuentes=[dict(spec="14", sec="4.3")],
        t=[T("*", "en_revision", "Crear plantilla WhatsApp"),
           T("*", "activa", "Crear plantilla Email", efectos="Email: siempre `activa`"),
           T("en_revision", "aprobada", "Webhook de Meta (aprobada)", "Sistema"),
           T("en_revision", "rechazada", "Webhook de Meta (rechazada)", "Sistema"),
           T("aprobada", "en_revision", "Editar contenido/categoría", "MK")]),
    "mkt_automations.status": dict(
        titulo="Automatización", fuentes=[dict(spec="14", sec="4.4")],
        t=[T("pausada", "activa", "Activar", "MK", "Bloqueado si la plantilla WhatsApp no está aprobada"),
           T("activa", "pausada", "Pausar", "MK")]),
    "crm_sales_targets.status": dict(
        titulo="Meta comercial", fuentes=[dict(spec="14", sec="4.5", tabla=True)],
        terminales=["cerrada", "anulada"]),
    # ------------------------------------------------------------------ 15 Sitio web
    "channel_web_carts.status": dict(
        titulo="Carrito web", fuentes=[dict(spec="15", sec="4.1", tabla=True)],
        terminales=["convertido", "abandonado", "expirado"]),
    # ------------------------------------------------------------------ 17 Reglas, comunicaciones, reseñas, web
    "notif_pax_messages.status": dict(
        titulo="Mensaje al pasajero", fuentes=[dict(spec="17", sec="4", row="Mensaje")],
        t=[T("*", "programado", "Programación por reglas", "Scheduler"),
           T("programado", "enviado", "Envío (auto o «enviar ahora»)", "Scheduler / Operaciones / Admin"),
           T("enviado", "entregado", "Webhook del proveedor", "Sistema"),
           T("entregado", "leido", "Webhook del proveedor", "Sistema"),
           T("enviado|programado", "fallido", "Error de envío / webhook", "Sistema"),
           T("fallido", "enviado", "Reintento", "Operaciones / Admin", efectos="`attempts++`"),
           T("programado", "cancelado", "Cancelar", "Operaciones / Admin")],
        terminales=["leido", "cancelado"]),
    "integration_review_sources.status": dict(
        titulo="Conector de reseñas", fuentes=[dict(spec="17", sec="4", row="Conector de reseñas")],
        t=[T("no_conectado", "conectado", "Conectar", "Admin"), T("pendiente", "conectado", "Completar conexión", "Admin"),
           T("conectado", "error", "Sincronización con 401/403", "Job de sincronización"),
           T("error", "conectado", "Reconectar", "Admin / Job"),
           T("conectado", "no_conectado", "Desconectar", "Admin", efectos="Revoca token y borra el secreto")],
        notas=["Cómo se llega a `pendiente` no está documentado: Por definir."]),
    "channel_external_reviews.response_status": dict(
        titulo="Respuesta a reseña externa", fuentes=[dict(spec="17", sec="4", row="Respuesta a reseña")],
        t=[T("*", "sin_responder", "Reseña importada", "Job de sincronización"),
           T("sin_responder", "pendiente_publicar", "Responder", "Admin / Manager / Ventas"),
           T("pendiente_publicar", "publicada", "Publicación por API (Google `updateReply`, Trustpilot `reply`)", "Job de publicación"),
           T("sin_responder", "no_admite", "La API es solo lectura", "Sistema"),
           T("no_admite", "publicada", "Publicación manual", "Admin / Manager / Ventas")],
        terminales=["publicada"]),
    "channel_widget_domains.status": dict(
        titulo="Dominio del widget", fuentes=[dict(spec="17", sec="4", row="Dominio")],
        t=[T("*", "pendiente", "Agregar dominio", "Admin / Manager"),
           T("pendiente", "verificado", "Verificación DNS", "Job DNS", efectos="Regenera CORS y CSP `frame-ancestors`")],
        notas=["Eliminar borra el dominio (no hay estado)."]),
    "channel_widget_handoffs.status": dict(
        titulo="Traspaso del widget", fuentes=[dict(spec="17", sec="4", row="Traspaso del widget")],
        t=[T("*", "pendiente", "El widget inicia el traspaso", "Widget", efectos="Evento `widget.checkout_started`"),
           T("pendiente", "en_carrito", "Llega al carrito", "Checkout"),
           T("en_carrito", "convertido", "Pedido creado", "Checkout"),
           T("pendiente", "expirado", "24 h sin uso", "Scheduler")],
        terminales=["convertido", "expirado"]),
    # ------------------------------------------------------------------ 18 Reseñas propias
    "crm_own_reviews.status": dict(
        titulo="Reseña propia", fuentes=[dict(spec="18", sec="4", tabla=True)],
        notas=["Responder o editar la respuesta no cambia el estado."]),
    "crm_review_requests.status": dict(
        titulo="Solicitud de reseña", fuentes=[dict(spec="18", sec="4", para="Responder / editar respuesta")],
        t=[T("*", "programada", "Programación tras el viaje", "Sistema"),
           T("programada", "enviada", "Envío", "Sistema"), T("enviada", "abierta", "El pasajero abre el enlace", "Sistema"),
           T("abierta", "respondida", "El pasajero envía la reseña", "Pasajero"),
           T("programada", "cancelada", "Cancelar", "Admin"),
           T("enviada|abierta", "vencida", "Job al `expires_at`", "Sistema"),
           T("vencida|enviada", "enviada", "Reenviar", "Admin")],
        terminales=["respondida", "cancelada"]),
}
