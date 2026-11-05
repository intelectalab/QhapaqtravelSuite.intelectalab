# Hallazgos y decisiones pendientes

Al documentar cada módulo se revisó el código del prototipo línea por línea. Esto dejó dos tipos de resultados:

- **Hallazgos:** comportamientos del prototipo que no deben pasar tal cual a producción.
- **Decisiones de negocio pendientes:** hay **286 puntos** en la sección 12 de las especificaciones. Aquí están los que bloquean o cambian el diseño; el resto está en cada especificación.

Leyenda de prioridad:

- **Alta:** decidir antes de programar el módulo.
- **Media:** decidir antes de su salida a producción.
- **Baja:** mejora.

## 1. Hallazgos que el backend debe corregir (no copiar del prototipo)

| ID | Prioridad | Hallazgo | Corrección para desarrollo | Especificación |
| --- | --- | --- | --- | --- |
| H-01 | Alta | Toda venta a cliente extranjero se trata como exportación sin IGV y se emite boleta con pasaporte. Según la ley del IGV solo ciertos servicios califican y normalmente requieren factura. | Validar con contador antes de programar Facturación; parametrizar reglas fiscales por tipo de servicio. | 07 |
| H-02 | Alta | El crédito B2B se descuenta al reservar (Canales) y otra vez al registrar un pago «Crédito B2B» (Finanzas); una transferencia aplicada no lo libera. | Un solo libro de movimientos de crédito (`channel_b2b_credit_movements`) como fuente de verdad. | 08, 07 |
| H-03 | Alta | La conversión cotización → reserva no vuelve a verificar la disponibilidad en el instante de confirmar. | Revalidar dentro de la transacción con lock de salida/cupo (algoritmo de 19 pasos). | 04 |
| H-04 | Alta | El portal del cliente permite aprobar una cotización que tiene pendiente la aprobación interna de gerencia. | Bloquear la aprobación del cliente mientras `quote_internal_approvals.status = pending`. | 03, 08 |
| H-05 | Alta | La previsualización interna de los portales ejecuta acciones reales (reservar, aprobar, pagar). | Modo previsualización de solo lectura (impersonación sin escritura). | 08 |
| H-06 | Alta | La nota de crédito por cancelación usa la serie de facturas y no pasa por la OSE. | Serie propia de notas de crédito vinculada al comprobante de origen y emisión por OSE. | 04, 07 |
| H-07 | Alta | Una incidencia crítica reportada por un proveedor no alerta a gerencia (PROC-037 lo exige). | Mismo evento `IncidentCreated` con severidad crítica, sin importar el origen. | 06 |
| H-08 | Alta | Las acciones de campo de guías/conductores y del proveedor no verifican un permiso específico. | Crear permisos `field.*` y `supplier.*` y validarlos por endpoint. | 05, 06 |
| H-09 | Media | La reserva directa no aplica IGV y la conversión desde cotización sí. | Un único servicio de cálculo de impuestos para ambos caminos. | 04 |
| H-10 | Media | Los tramos de penalidad de cancelación se deducen del texto libre de la política. | Política estructurada: tramos (días antes, % penalidad) + texto legal. | 02, 04 |
| H-11 | Media | El margen se calcula sobre el total con IGV y las comisiones sobre el neto sin IGV. | Base neta sin impuestos para margen, rentabilidad y comisiones. | 07 |
| H-12 | Media | El panel de Finanzas usa el tipo de cambio del día y el módulo usa el del documento. | Siempre el tipo de cambio conservado en el documento (regla transversal 15). | 07 |
| H-13 | Media | El factor de temporada se aplica al precio en una pantalla y al costo en otra. | Una sola función de pricing en backend (`PricingService`). | 02 |
| H-14 | Media | El hold de 30 min de la tienda de Canales se anuncia pero no expira (el sitio público sí lo hace). | Job `ExpireHolds` común para todos los canales. | 08, 15 |
| H-15 | Media | Las reglas de tarifa B2B por agencia difieren entre Catálogo (advierte) y Canales (bloquea). | Unificar: bloquear sin tarifa vigente para la agencia. | 02, 08 |
| H-16 | Media | Se puede cerrar una orden operativa que no está «en ejecución». | Exigir estado `en_ejecucion` además de las 4 precondiciones. | 05 |
| H-17 | Media | La lista «viajes por cerrar» de Postventa muestra a Ventas registros de otros asesores. | Filtro de ownership en el endpoint. | 01 |
| H-18 | Media | La reasignación de registros depende del nombre del rol, no de un permiso. | Permiso `crm.records.reassign`. | 01 |
| H-19 | Media | El CMS exige permiso de publicar para entrar; nadie puede solo redactar. | Permiso `channels.cms.edit` para redactores. | 08 |
| H-20 | Baja | La extranet muestra la tarifa del proveedor en la moneda de la reserva y no en la de su contrato. | Mostrar en moneda del contrato con conversión informativa. | 06 |
| H-21 | Baja | Umbrales de aprobación, metas y embudo del panel del Manager están escritos en el código. | Leerlos de configuración y de datos reales. | 09 |

Corregidos ya en el prototipo durante esta revisión:

- La exportación de tablas ahora exige el permiso `reports.export`.
- La búsqueda global de Ventas se limita a sus clientes.
- El Manager ve Facturación y Conciliación en solo lectura.

## 2. Decisiones de negocio que bloquean el diseño

| ID | Tema | Pregunta | Afecta |
| --- | --- | --- | --- |
| D-01 | Facturación electrónica | ¿Qué OSE/PSE se usará? ¿Series por sede? ¿Tratamiento de exportación de servicios? | 07, 04, 15 |
| D-02 | Pagos en línea | ¿Qué pasarela (tarjeta, Yape/Plin)? ¿Pago de anticipo y saldo en línea? ¿Plazo de liquidación? | 07, 08, 12, 15 |
| D-03 | WhatsApp y email | ¿Proveedor de WhatsApp Business API? ¿Dominio de envío de correo? | 10, 14, 09 |
| D-04 | Políticas comerciales | Tope de descuento (hoy 10 %), umbrales de aprobación (5 % descuento / 15 % margen), anticipo (hoy 40 %, sitio 30–40 %), tramos de cancelación. | 03, 04, 15 |
| D-05 | Crédito B2B | Límite, plazo y bloqueo por agencia; ¿se cobra comisión o se vende a neto? | 08, 07 |
| D-06 | Proveedores | ¿Qué proveedores usarán la extranet? ¿Cuáles tienen API real (tren, entradas)? La disponibilidad externa solo es real con integración confirmada (PRD-BR-013). | 06, 02, 11 |
| D-07 | Legal | Normativa vigente de Libro de Reclamaciones (plazo, formato), protección de datos (Ley 29733), permisos de viaje de menores y requisitos de visa por nacionalidad. | 12, 14, 11 |
| D-08 | Planes SaaS | Precios, límites por plan, add-ons y política de suspensión por impago. | 13 |
| D-09 | Idiomas y monedas | ¿Qué idiomas y monedas en el sitio público y portales? | 15, 08 |
| D-11 | Reglas de reserva | **Resuelta (demo):** matriz regla × plan de prueba, editable; valores definitivos pendientes. | 16, 17, 13 |
| D-12 | Monedas | **Resuelta (demo):** tipos de cambio de demostración con proveedor simulado; proveedor real y margen definitivo pendientes. | 16, 17 |
| D-13 | Datos históricos | Si una regla se apaga, ¿el back-office sigue mostrando los datos capturados con ella (hoy sí, rotulados «dato histórico»)? | 04, 16 |
| D-14 | Carrito | **Resuelta:** cada tour genera su propia reserva (decisión del cliente, 30/09/2026). | 15, 04 |
| D-15 | Reseñas | **Resuelta:** fase 1 Google Business Profile, TripAdvisor y Trustpilot; fase 2 Facebook, GetYourGuide y Viator; más módulo propio de reseñas verificadas. Pendiente: contratos y aprobación de cada API. | 17, 18 |
| D-10 | Apps móviles | ¿Android e iOS? ¿Tiempo máximo offline? ¿GPS del guía con qué finalidad y consentimiento? | 05 |

## 3. Puntos por especificación (sección 12)

| Especificación | Puntos abiertos |
| --- | --- |
| 00 Transversal / seguridad / RBAC | 13 |
| 01 CRM | 24 |
| 02 Catálogo | 32 |
| 03 Cotizaciones | 14 |
| 04 Reservas | 17 |
| 05 Operaciones y móvil | 20 |
| 06 Extranet de proveedores | 14 |
| 07 Finanzas | 20 |
| 08 Canales y portales | 23 |
| 09 Administración y reportes | 15 |
| 10 Aprobaciones e inbox | 10 |
| 11 Cupos y documentos de viaje | 8 |
| 12 Tesorería y reclamaciones | 8 |
| 13 Plataforma SaaS y API | 8 |
| 14 Marketing y metas | 11 |
| 15 Sitio web público | 19 |
| 16 Motor de reservas y reglas | 13 |
| 17 Reglas, comunicaciones, monedas, reseñas e integración web | 9 |
| 18 Reseñas propias | 6 |
| **Total** | **286** |
