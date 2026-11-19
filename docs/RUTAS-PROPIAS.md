# Rutas propias de la API (fuera del contrato)

Registro del 6 de noviembre de 2026. Son las rutas que el código expone y que no figuran en `docs/kit/api/openapi.yaml`, según `compare_contract.py` sobre el OpenAPI que genera Scramble. Cada una queda en uno de cuatro grupos, con su decisión.

| Grupo | Rutas | Decisión |
| --- | --- | --- |
| Alinear con el contrato | 0 | Ninguna. Las 109 que tenían equivalente en el contrato se movieron a su ruta el 6 de noviembre (sitio público, portales y back-office). |
| Lectura de pantalla | 67 | Se quedan. Evitan varias llamadas por pantalla; se propone sumarlas al contrato como lecturas de interfaz. |
| Editar, borrar o cambiar estado | 73 | Se quedan. Se propone sumarlas al contrato. |
| Acción propia | 21 | Se quedan mientras negocio no las retire; se propone sumarlas al contrato. |
| **Total** | **161** | |

Cómo regenerarlo: exportar el OpenAPI (`php artisan scramble:export --path=storage/openapi.generated.json`) y correr `python3 docs/kit/api/compare_contract.py backend/storage/openapi.generated.json --phase 3`; las rutas nuevas fuera del contrato deben agregarse a este registro. Cuando el registro esté vacío de rutas «Alinear», la CI puede correr con `--strict-extra`.

## Por módulo

### Seguridad y sesión · spec 00 (1)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /auth/invitations/{}` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |

### CRM · spec 01 (16)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /crm/advisors` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /crm/after-sales` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /crm/catalogs` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /crm/clients/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /crm/opportunities/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `DELETE /crm/activities/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /crm/activities/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /crm/cases/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /crm/claim-book/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /crm/clients/{}/archive` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /crm/surveys/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /crm/clients/{}/contacts/{}` | Editar, borrar o cambiar estado | Editar un contacto del cliente. El contrato tiene alta (`POST contacts`) y «hacer principal», pero no edición; lo exige el criterio de CRUD completo. |
| `DELETE /crm/clients/{}/contacts/{}` | Editar, borrar o cambiar estado | Quitar un contacto del cliente; si era el principal, el siguiente pasa a serlo. Lo exige el criterio de CRUD completo. |
| `POST /crm/clients/{}/portal-access` | Acción propia | Invitar al cliente a su portal: crea o reutiliza el usuario con rol `customer`, lo vincula por `iam_users.client_id` (spec 08 §3.15, PCL-BR-01) y le envía la invitación de `auth/invitations`. El contrato solo tiene la invitación del personal (`POST /iam/users`, `admin.users.manage`); esta va bajo el cliente con `crm.clients.manage` y respeta la cartera del asesor. Exige Idempotency-Key. |
| `POST /crm/clients/{}/portal-access/resend` | Acción propia | Reenviar la invitación al portal mientras el cliente no la acepta; equivale a `POST /iam/users/{id}/resend-invitation` con el permiso de clientes. |
| `POST /crm/clients/{}/portal-access/revoke` | Acción propia | Revocar el acceso al portal: desactiva el usuario sin borrarlo, cierra sus sesiones y vence la invitación pendiente. El estado se lee en `GET /crm/clients/{code}` (`portal_access`). |
| `POST /crm/clients/{}/anonymize` | Acción propia | Supresión de datos personales (derecho de cancelación ARCO, Ley 29733). Anonimiza al cliente, sus contactos, pasajeros, leads, suscripciones y usuario del portal. También revoca sus consentimientos, conserva reservas y comprobantes y resuelve su solicitud ARCO si se indica. GUIA-TECNICA §14 pide «supresión (`deleted_at` + anonimización)», pero el contrato no tiene la ruta. Requiere `crm.clients.manage` y no la ejecuta Ventas (ARCO-03). La clave Idempotency-Key se respeta si llega. |

### Catálogo · spec 02 (25)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /catalog/products/{}/promotions/{}` | Editar, borrar o cambiar estado | Editar una promoción (nombre, tipo, valor, canal, código, mínimo de pasajeros, vigencia). El contrato solo permite crear, pausar, activar y borrar; lo exige el criterio de CRUD completo. |
| `GET /catalog/availability` | Lectura de pantalla | Vista de disponibilidad de todos los productos en una pantalla; el contrato la da producto por producto. |
| `GET /catalog/products/{}/editor` | Lectura de pantalla | Estado completo del asistente de edición (ficha, componentes, itinerario, tarifas, temporadas, disponibilidad, contenido, políticas, canales, resumen y checklist) en una sola llamada. |
| `POST /catalog/products/preview` | Acción propia | Validación por paso del asistente PROC-014 («validación por paso», spec 02 §2): valida el payload de `POST /catalog/products` hasta el paso indicado, lo ejecuta dentro de una transacción que se revierte y devuelve el resumen y el checklist §42. No guarda nada. |
| `PATCH /catalog/products/{}/minimum-passengers` | Editar, borrar o cambiar estado | Atajo desde la tarjeta «Costo por persona según el grupo»: cambia solo el mínimo de pasajeros (1 al máximo del producto) sin reenviar la ficha completa. Exige `lock_version` y audita el valor anterior y el nuevo. |
| `GET /catalog/products/{}/overview` | Lectura de pantalla | Datos de las secciones de la ficha del producto (salidas, proveedores, relacionados, B2B, promociones, rentabilidad, personalización, versiones, historial y uso en ventas) en una sola llamada. Oculta costos, B2B e historial según el rol. |
| `PUT /catalog/products/{}/components` | Editar, borrar o cambiar estado | Atajo de la pantalla: el asistente guarda todos los componentes en un envío. Las rutas del contrato `POST /catalog/products/{id}/components` y `PATCH/DELETE …/components/{componentId}` ya existen y usan la misma lógica (`ProductSections`). Conserva los ids y audita cada cambio. |
| `PUT /catalog/products/{}/itinerary` | Editar, borrar o cambiar estado | Atajo de la pantalla para guardar días y actividades en un envío. Las rutas del contrato de días y actividades (`POST/PATCH/DELETE …/itineraries/{itId}/days[/{dayId}[/items[/{itemId}]]]`) ya existen; `{itId}` acepta el id del itinerario principal o `principal`. |
| `PUT /catalog/products/{}/seasons` | Editar, borrar o cambiar estado | Atajo de la pantalla para las temporadas asociadas (conserva las que usan sus tarifas). Las rutas del contrato `POST /catalog/products/{id}/seasons` y `DELETE …/seasons/{seasonId}` ya existen; quitar una temporada usada por una tarifa responde 422 `CAT-BR-13`. |
| `PUT /catalog/products/{}/channels` | Editar, borrar o cambiar estado | Atajo de la pantalla para elegir los canales del producto (`is_published`; los canales públicos exigen además producto ACTIVE). La ruta del contrato `PUT /catalog/products/{id}/channels/{channel}` `{published}` ya existe: publica solo con el producto activo (422 `PRD-BR-002`) y nunca despublica ERP. |
| `GET /catalog/products/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /catalog/products/{}/translations` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PATCH /catalog/departures/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /catalog/departures/{}/cancel` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /catalog/departures/{}/close` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /catalog/products/{}/translations/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /catalog/products/{}/translations/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /catalog/seasons/{}/activate` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /catalog/seasons/{}/deactivate` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /catalog/product-types/{}` | Editar, borrar o cambiar estado | Renombrar un tipo y cambiar si requiere itinerario o componentes. El contrato solo permite crear y borrar; lo exige el criterio de CRUD completo. |
| `PATCH /catalog/categories/{}` | Editar, borrar o cambiar estado | Renombrar una categoría. Lo exige el criterio de CRUD completo. |
| `PATCH /catalog/categories/{}/subcategories/{}` | Editar, borrar o cambiar estado | Renombrar una subcategoría. Lo exige el criterio de CRUD completo. |
| `DELETE /catalog/products/{}/pax-rules` | Editar, borrar o cambiar estado | Vuelve a las reglas de pasajeros de la agencia (spec 16 §6.2). |
| `DELETE /catalog/products/{}/payment-policy` | Editar, borrar o cambiar estado | Vuelve a la política de pago de la agencia. |
| `POST /catalog/products/{}/accommodation/legs/reorder` | Editar, borrar o cambiar estado | Reordena los tramos de alojamiento `{ids[]}` (spec 16 §6.2). |
| `DELETE /catalog/products/{}/rates/{}` | Editar, borrar o cambiar estado | Quita una tarifa sin uso; 409 `CAT-RATE-IN-USE` si ya se cotizó o vendió. |

### Cotizaciones · spec 03 (3)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /quotes/{}/versions/{}/pdf` | Lectura de pantalla | Descarga de la propuesta de una versión. El contrato solo tiene `POST` (encola con 202 en la cola `documents`); esta lectura devuelve el PDF ya generado, o lo genera en el momento, como JSON con URL firmada o como `application/pdf` si se pide con `Accept: application/pdf`. |
| `GET /quotes/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `DELETE /quotes/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Reservas · spec 04 (4)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /reservations/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /reservations/{}/changes/options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PATCH /reservations/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `GET /reservations/{}/confirm-preview` | Lectura de pantalla | Vista previa de disponibilidad por servicio antes de confirmar, con salidas alternativas y «Reprogramar» si hay bloqueo (04 §4.1). Pide `reservations.modify`. |

### Operaciones y móvil · spec 05 (18)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /mobile/operator` | Lectura de pantalla | Vista previa de la app del operador desde el back-office, para elegir a quién ver; las rutas del contrato son las de la app con la sesión del propio operador. |
| `GET /mobile/passenger` | Lectura de pantalla | Vista previa de la app del pasajero desde el back-office; la ruta del contrato es la de la app con la sesión del propio pasajero. |
| `PATCH /ops/incidents/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /ops/orders/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /ops/resources/{}/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /ops/resources/{}/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /ops/rooming-lists/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /ops/rooming-lists/{}/rooms/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /ops/rooming-lists/{}/rooms/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /ops/resources/{}` | Acción propia | Alta de guía, conductor o vehículo desde Operaciones; el contrato solo lista recursos y cambia su estado. |
| `GET /ops/orders/{}/evidences` | Lectura de pantalla | Lista las evidencias vigentes de la orden (servicio, incidencia, autor y fecha). El contrato solo las trae dentro de la orden 360 (`include=evidences`), que también las devuelve en `evidence_files`. |
| `GET /ops/evidences/{}/file` | Lectura de pantalla | Entrega el archivo de una evidencia (`operations.view`) sin exponer el bucket privado. Una URL temporal de S3 apunta al host interno del almacenamiento (`storage:9000` en Docker) y el navegador no la alcanza; la web la sirve a través de su propia ruta con la sesión del usuario. |
| `POST /ops/orders/{}/evidences/upload` | Acción propia | Carga directa multipart de una evidencia de la orden (`operations.assign`, imagen o PDF, hasta 10 MB). El flujo del contrato (`/ops/evidences/presign`, PUT al bucket y `/ops/orders/{}/evidences`) es para la app del operador; desde el panel el archivo pasa por una server action de Next, y el PUT a una URL prefirmada exigiría que el navegador vea el almacenamiento. Misma validación, deduplicación por SHA-256 (OPS-BR-71) y auditoría que la ruta del contrato. |
| `POST /ops/incidents/{}/evidences/upload` | Acción propia | Igual que la anterior para una incidencia (`operations.incidents`); deja la entrada «evidencia» en la bitácora de la incidencia. |
| `PUT /ops/assignments/{}/checkins` | Acción propia | Check-in por pasajero desde la ficha de la orden (origen web). El contrato solo lo prevé por la sincronización de la app móvil. |
| `GET /mobile/passenger/feedback` | Lectura de pantalla | Tipos, servicios e historial de comentarios del pasajero para la pantalla «Comentar» de la app. El contrato solo tiene el alta (`POST /mobile/passenger/feedback`); es la misma lectura que `GET /portal/passenger/feedback`, bajo el canal de la app. |
| `POST /ops/mobile-devices/{}/revoke` | Acción propia | Operaciones desactiva el teléfono de un guía o conductor (`operations.assign`, auditado). El contrato solo tiene el cierre de sesión del propio dispositivo (`DELETE /mobile/devices/{id}`); la app borra sus datos al recibir `403 DEVICE_REVOKED` (spec 05 §3.13, `revoked_at`). |

### Extranet de proveedores · spec 06 (9)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /supplier/calendar` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /supplier/company` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /supplier/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /supplier/session` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `DELETE /supplier/company/contacts/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /supplier/company/contacts/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /supplier/rate-requests/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /supplier/company/contacts` | Acción propia | Contactos de la empresa en la extranet del proveedor; el contrato no los tiene. |

### Finanzas · spec 07 (14)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `POST /finance/commissions/{}/annul` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /finance/payables/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/payables/{}/cancel` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/payments/{}/confirm` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/receivables/{}/cancel` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/fx-rates` | Acción propia | Registro manual del tipo de cambio del día desde Finanzas; el contrato solo lo lee. |
| `POST /finance/payables` | Acción propia | Registro de un costo adicional del proveedor sobre una reserva (FIN-BR-23). |
| `GET /finance/bank-lines/{}/candidates` | Lectura de pantalla | Pagos u obligaciones disponibles para asignar una excepción de conciliación (FIN-BR-54: asignar requiere candidato), ordenados por diferencia y referencia. |
| `GET /treasury/settings` | Acción propia | Parámetros de tesorería por agencia (spec 12 §3.9): tolerancia del arqueo, máximo por gasto, tope de declaración jurada, % de reposición, comisión de pasarela, meta y mínimo de margen, egresos fijos. |
| `PATCH /treasury/settings` | Acción propia | Guarda los parámetros de tesorería, con `lock_version` y auditoría. |
| `GET /treasury/movements/{}/receipt` | Lectura de pantalla | Archivo del comprobante del gasto de caja chica. |
| `GET /treasury/counts/{}/pdf` | Lectura de pantalla | Acta imprimible del arqueo. |
| `POST /finance/commission-rules` | Editar, borrar o cambiar estado | Alta de una regla de comisión (criterio de CRUD completo). |
| `PATCH /finance/commission-rules/{}` | Editar, borrar o cambiar estado | Editar, cambiar vigencia o desactivar una regla de comisión, sin superposición. |

### Canales y portales · spec 08 (20)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /portal/passenger/reviews` | Lectura de pantalla | «Califica tu viaje» del portal del pasajero (prototipo): productos del viaje que ya se pueden calificar y las reseñas que el pasajero dejó. El contrato solo trae el alta por enlace de invitación (`POST /public/reviews/by-token`). |
| `POST /portal/passenger/reviews` | Acción propia | Alta de la reseña propia verificada desde el portal (spec 18, `source = portal`), con las reglas RVW-01 a RVW-06. |
| `GET /b2b/agency` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /b2b/catalog/{}` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /b2b/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /channels/b2b` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /channels/customer-portal` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /channels/ecommerce` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /channels/passenger-portal` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /portal/client/profile` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /portal/client/session` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `DELETE /b2b/reservations/{}/cancel-request` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /b2b/reservations/{}/cancel-request` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /b2b/reservations/{}/passengers/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /channels/b2b/agencies/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /channels/passenger-portal/feedback/{}/reply` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /channels/passenger-portal/feedback/{}/status` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /portal/client/profile` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /portal/client/profile/consents/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /portal/client/receivables/{}/payment-reports` | Acción propia | «Informar pago» del cliente (transferencia o depósito ya hecho): crea un pago `pendiente` que valida Finanzas. El contrato reserva `POST /portal/client/receivables/{id}/payments` para el pago en línea (08 §6.5); se separa siguiendo el modelo del portal B2B (`POST /b2b/receivables/{id}/payment-reports`, 08:564). Agregada el 11/11/2026. |

### Administración y reportes · spec 09 (16)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `POST /billing/invoices/{}/send` | Acción propia | «Reenviar por correo» del detalle de la factura de plataforma (prototipo). Envía el resumen de la factura al correo para comprobantes y lo audita como `reenviar`. El contrato no la incluye. |
| `GET /iam/roles/{}` | Lectura de pantalla | Detalle del rol en una sola llamada: experiencia, pantallas que ve (del mapa de acceso), usuarios con el rol y los últimos 30 cambios de permisos de la auditoría. El contrato solo trae la lista de roles y la matriz. Requiere `admin.roles.manage` o `admin.users.manage` (solo lectura, G5-20). |
| `GET /settings/business-hours` | Lectura de pantalla | Horario de atención de la agencia (G7-25): días, resumen ES/EN, si está abierto ahora, próxima apertura y aviso «Carga tu horario de atención» mientras se usa el valor por defecto (lunes a viernes 08:00–19:00). También viene en `GET /settings` como `business_hours`. `admin.settings.manage`. |
| `PUT /settings/business-hours` | Editar, borrar o cambiar estado | Guarda el horario estructurado (por día: abierto, apertura y cierre) en `sys_settings` › `general.business_hours`, con `lock_version` de la sección general y auditoría con el resumen antes y después. Lo usan el sitio, los avisos «Solo en horario de atención», el chat fuera de horario y los plazos en horas hábiles. `admin.settings.manage`. |
| `GET /admin/api` | Lectura de pantalla | Agregado de la pantalla API y webhooks: entregas, apps OAuth, límites del plan, consumo, catálogos de permisos y eventos. Las listas del contrato (`/integrations/api-keys` y `/integrations/webhooks`) ya existen. |
| `GET /admin/branding` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /dashboard/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /health` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /me/counts` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `POST /reservations/{}/services/cancel` | Acción propia | Cancela parte de los servicios de una reserva (estado «parcial», spec 04 §4 v2.5 y §4.6 por servicio): penalidad por servicio, CxC recalculadas, reembolso si lo pagado supera el nuevo total, cupos, vouchers y asignaciones de esos servicios. El contrato define la transición pero no trae la ruta. |
| `POST /reservations/{}/services/cancel/preview` | Lectura de pantalla | Vista previa de la cancelación parcial con la penalidad por servicio, el nuevo total y el reembolso. |
| `POST /me/data-exports` | Acción propia | Registra en la auditoría cada lista que se exporta a Excel o CSV (formato, filas, filtros y columnas). El archivo se arma en el navegador con las filas filtradas y ordenadas, como en ErpSaas. |
| `GET /reports/kpis` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /reports/process-map` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PUT /admin/branding` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /admin/branding/reset` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /cms/contents/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `GET /admin/booking-rules/simulator` | Lectura de pantalla | Opciones del simulador de reglas (productos, planes, monedas y formas de pago); el contrato solo define `POST /admin/booking-rules/simulate`. |
| `POST /reports/schedules/{}/pause` | Editar, borrar o cambiar estado | Pausa un envío programado propio de reportes (CRUD completo de jobs). |
| `POST /reports/schedules/{}/resume` | Editar, borrar o cambiar estado | Reanuda un envío programado propio de reportes. |
| `POST /notifications/pax-templates/{}/test` | Acción propia | Prueba de una plantilla de mensaje al pasajero. Está en el kit, pero aquí se identifica por código en lugar de id, igual que las rutas de aprobación, mensajes al pasajero y webhooks. |

### Aprobaciones · spec 10 (1)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /approvals/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `GET /inbox/channel-accounts` | Lectura de pantalla | Cuentas de WhatsApp y correo de la bandeja (ID del número, buzón, plazo, estado y si el secreto del webhook está configurado, sin mostrarlo). Panel «Canales e integración» de la bandeja. |
| `PUT /inbox/channel-accounts/{}` | Editar, borrar o cambiar estado | Crea o edita la cuenta de canal (`collab_channel_accounts`): ID del número o buzón, secreto del webhook cifrado, plazo de primera respuesta y estado (desconectar = `inactivo`). Audita cada campo; el secreto nunca se devuelve. |

### Plataforma SaaS y API · spec 13 (38)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /platform/branding` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PUT /platform/settings/outgoing-mail` | Editar, borrar o cambiar estado | Correo de salida de la plataforma (SMTP) desde Configuración de la consola. Prueba la conexión antes de guardar, guarda la contraseña cifrada en `platform_settings`, nunca la devuelve y audita cada campo. Todos los correos usan el mailer `platform`, que lee esta cuenta en cada envío. |
| `POST /platform/settings/outgoing-mail/test` | Acción propia | Envía en el momento un correo de prueba con la cuenta guardada y registra el resultado. |
| `PUT /platform/settings/whatsapp-webhook` | Editar, borrar o cambiar estado | Token de verificación de la app de Meta para `GET /integrations/whatsapp/webhook`, desde Configuración de la consola. Se guarda cifrado en `platform_settings`, nunca se devuelve (solo «configurado») y se audita; `clear` lo quita. |
| `PUT /platform/settings/fiscal-webhook` | Editar, borrar o cambiar estado | Secreto con el que el OSE firma `POST /integrations/fiscal/{provider}/webhook`, desde Configuración de la consola. Se guarda cifrado en `platform_settings` (clave `fiscal_provider`, campo `webhook_secret`), nunca se devuelve (solo «configurado») y se audita; `clear` lo quita. |
| `GET /platform/audit-events/export` | Acción propia | Descarga en CSV hasta 5000 eventos de la auditoría de plataforma (7, 30, 90 o 365 días, con los mismos filtros del listado) y registra la exportación. |
| `PUT /platform/settings/form-protection` | Editar, borrar o cambiar estado | Protección de formularios (Cloudflare Turnstile, spec 15 §585) desde Configuración de la consola. Prueba la clave secreta con Cloudflare, la guarda cifrada en `platform_settings`, nunca la devuelve y audita cada campo. |
| `GET /platform/demo-requests` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/dunning` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/features` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/invoices/{}` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/me` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/notifications` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/operations` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/search` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/settings` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /platform/tenants/provision-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/software/demo-requests/options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/software/overview` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/software/plans` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PUT /platform/branding` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /platform/branding/reset` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /platform/branding/logo` | Editar, borrar o cambiar estado | Elige el logo de KipuControl (`tocapu` o `kit`, la marca del kit 2.13) desde Personalización de la consola. Se guarda en `platform_settings` (clave `platform_logo`) y se audita. |
| `GET /public/software/brand` | Lectura de pantalla | Logo activo de KipuControl para el menú, el inicio de sesión, la landing y el ícono de la pestaña. Sin sesión, porque lo pintan páginas públicas. |
| `POST /channels/b2b/agencies/{}/users` | Acción propia | Invita a una persona de la agencia aliada a su portal (rol `b2b`, `iam_users.agency_id`). La spec 08 no define cómo nacen esos usuarios; replica `POST /catalog/providers/{id}/users` del contrato. |
| `PATCH /platform/demo-requests/{}` | Editar, borrar o cambiar estado | Cambia el estado de una solicitud de demo o prueba (nueva, contactada, convertida o descartada) con una nota interna; tabla propia `platform_demo_requests`. |
| `PATCH /platform/coupons/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /platform/coupons/{}/status` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /platform/feature-overrides/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /platform/invoices/{}/dunning/suspend` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /platform/jobs/{}/pause` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /platform/jobs/{}/run` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PUT /platform/plans/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /platform/settings/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /platform/tenants/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /platform/auth/logout` | Acción propia | Cierre de sesión de la consola de plataforma. El contrato usa el `/auth/logout` común, que hoy está dentro del grupo de rutas de la agencia; unificarlo exige reordenar ese grupo. |
| `POST /platform/notifications/read-all` | Acción propia | Marcar como leídos los avisos de la campana del Super Admin; el contrato no define la campana de la consola. |
| `POST /public/software/demo-requests` | Acción propia | Solicitud de demo desde la página comercial de la plataforma; usa la tabla propia `platform_demo_requests`. |
| `POST /platform/tenants/{}/change-plan/preview` | Lectura de pantalla | Vista previa del cambio de plan desde la consola (cobro, crédito, bloqueos y reglas que gana o pierde). |
| `DELETE /platform/tenants/{}/scheduled-change` | Editar, borrar o cambiar estado | Anula el cambio de plan programado de una agencia. |
| `POST /platform/invoices/{}/payment-link` | Acción propia | Envía a la agencia el enlace para registrar la tarjeta y pagar la factura. |
| `POST /platform/invoices/{}/send` | Acción propia | Reenvía la factura por correo. |
| `POST /platform/integration-errors/{}/retry` | Acción propia | Reintenta un error de integración de una agencia. |
| `POST /platform/integration-errors/{}/resolve` | Editar, borrar o cambiar estado | Marca como resuelto un error de integración. |
| `GET /platform/audit-events/{}` | Lectura de pantalla | Detalle de un evento de auditoría de la plataforma (antes y después, IP, navegador, eventos relacionados). |
| `POST /platform/plan-rules/reset-demo` | Editar, borrar o cambiar estado | Restablece la matriz plan-regla a los valores del kit. |

### Marketing y metas · spec 14 (2)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /crm/sales-targets/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /marketing/campaigns/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Sitio web público · spec 15 (7)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /public/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/captcha` | Lectura de pantalla | Clave pública de Turnstile para dibujar el widget en los formularios públicos. Se lee de la configuración de la plataforma (`null` si está apagada), así cambiarla no exige recompilar la web. |
| `GET /public/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/me/vouchers/{}.pdf` | Lectura de pantalla | PDF del voucher desde Mi cuenta; el contrato solo lista los vouchers (`GET /public/me/vouchers`). Verifica que el voucher sea de una reserva del cliente. |
| `POST /public/auth/email/resend` | Acción propia | Reenvía el enlace de verificación del correo (SIT-BR-21) desde Mi cuenta; límite de 3 por minuto. |
| `GET /public/widget/config?product=` | Lectura de pantalla | Configuración pública del widget (producto, valores y dominios verificados) para `/widget/[code]`. El contrato no tiene equivalente. |
| `GET /public/reviews/by-token/{}?t=` | Lectura de pantalla | Carga el formulario del enlace de invitación a reseñar y marca la solicitud como abierta. Complementa `POST /public/reviews/by-token`. |

Ampliaciones de rutas del contrato (11 de noviembre, panel de reserva del sitio): `POST /public/price-quote` acepta adicionales, alojamiento, opciones, ítems quitados y `payment_mode`, y responde `quote_token`; `POST /public/carts/current/items` acepta lo mismo más `quote_token` y `source`; `GET /public/reviews` tiene un modo widget (`widget`, `sources`, `min_rating`, `count`, `layout`) que devuelve reseñas de plataformas conectadas con atribución.

### Reseñas · spec 18 (1)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PUT /channels/external-reviews/{}/reply` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Autoayuda · propia (15)

Agregadas el 10 de noviembre de 2026. El contrato no tiene un módulo de ayuda; lo pide la regla del proyecto «toda pantalla tiene su ayuda». Las lecturas filtran por rol, pantalla permitida y plan; las escrituras de la agencia piden `admin.settings.manage` y las de la plataforma `admin.tenant.manage`. Editar, archivar y reactivar exigen `If-Match`.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /help/articles` | Lectura de pantalla | Centro de ayuda: artículos que aplican al usuario, con buscador, módulos y conteos. |
| `GET /help/articles/{}` | Lectura de pantalla | Ficha del artículo con relacionados e historial. |
| `GET /help/screen` | Lectura de pantalla | Artículo de la pantalla actual (por prefijo de ruta) para el botón de ayuda de la barra superior. |
| `POST /help/articles` | Acción propia | La agencia crea un artículo propio. |
| `PUT /help/articles/{}` | Editar, borrar o cambiar estado | Edita el artículo propio o crea la versión de la agencia de uno de KipuControl. |
| `POST /help/articles/{}/archive` | Editar, borrar o cambiar estado | Archiva el artículo solo para la agencia. |
| `POST /help/articles/{}/restore` | Editar, borrar o cambiar estado | Reactiva un artículo archivado. |
| `DELETE /help/articles/{}/adaptation` | Editar, borrar o cambiar estado | Descarta la versión de la agencia y vuelve a la de KipuControl. |
| `GET /platform/help/articles` | Lectura de pantalla | Centro de ayuda de la consola con los artículos de KipuControl y cuántas agencias adaptaron cada uno. |
| `GET /platform/help/articles/{}` | Lectura de pantalla | Ficha del artículo de KipuControl. |
| `GET /platform/help/screen` | Lectura de pantalla | Ayuda de la pantalla actual de la consola. |
| `POST /platform/help/articles` | Acción propia | La plataforma crea un artículo para las agencias o para la consola. |
| `PUT /platform/help/articles/{}` | Editar, borrar o cambiar estado | Edita un artículo de KipuControl. |
| `POST /platform/help/articles/{}/archive` | Editar, borrar o cambiar estado | Archiva un artículo de KipuControl para todas las agencias que no lo adaptaron. |
| `POST /platform/help/articles/{}/restore` | Editar, borrar o cambiar estado | Reactiva un artículo de KipuControl. |

### Diseño del sitio web · propia (9)

Agregadas el 10 de noviembre de 2026. Editor del sitio público de cada agencia (Personalización → Sitio web). El contrato no tiene un recurso para personalizar el sitio; el borrador y lo publicado viven en `site_designs`, con RLS por agencia. Las rutas de administración piden `admin.settings.manage` y la funcionalidad `cms` del plan.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /admin/site-design` | Lectura de pantalla | Borrador, versión publicada, cambios pendientes, imágenes, versiones e historial. |
| `PUT /admin/site-design/draft` | Editar, borrar o cambiar estado | Guarda el borrador (guardado automático con `lock_version`; 409 SITE-BR-01 si otra persona lo cambió). |
| `POST /admin/site-design/publish` | Acción propia | Publica el borrador, guarda la versión y lo audita. |
| `POST /admin/site-design/discard` | Editar, borrar o cambiar estado | Vuelve el borrador a lo publicado. |
| `POST /admin/site-design/versions/{}/restore` | Editar, borrar o cambiar estado | Copia una versión publicada al borrador. |
| `GET /admin/site-design/preview` | Lectura de pantalla | Diseño del borrador ya resuelto (colores y aviso) para la vista previa. |
| `POST /admin/site-design/images` | Acción propia | Sube una imagen para la portada o un banner (antivirus, JPG, PNG o WebP, hasta 4 MB). |
| `DELETE /admin/site-design/images/{}` | Editar, borrar o cambiar estado | Borra una imagen que no está en uso. |
| `GET /public/site/images/{}` | Lectura de pantalla | Sirve la imagen en el sitio público de la agencia. |

### Reseñas externas y libro de reclamaciones · propia (2)

Agregadas el 11 de noviembre de 2026, con las secciones de Reseñas externas y del Libro de reclamaciones.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PUT /channels/external-reviews/widget` | Editar, borrar o cambiar estado | Guarda la configuración del widget de reseñas para el sitio: plataformas (solo las conectadas), nota mínima, cantidad y diseño. Pide `channels.ecommerce.manage` y queda auditado. |
| `PUT /crm/claim-book/settings` | Editar, borrar o cambiar estado | Guarda el plazo de respuesta, los días de alerta antes del vencimiento y los años de conservación. No tiene GET propio: la configuración y el siguiente correlativo por sede vienen en `GET /crm/claim-book`. Pide `admin.settings.manage` y queda auditado. |

### Portal corporativo · spec 20 (2)

Agregadas el 12 de noviembre de 2026, con las cuentas corporativas y los estados de cuenta.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /crm/corporate-accounts/form-options` | Lectura de pantalla | Empresas del CRM sin cuenta corporativa (según la cartera), roles del portal, períodos de presupuesto y tipos de documento para los formularios. Pide `crm.corporate.manage`. |
| `GET /finance/corporate-statements/{}/pdf` | Lectura de pantalla | PDF del estado de cuenta para Finanzas (el contrato solo lo tiene en el portal). Pide `finance.corporate_statements`. |

### Vitrina, monetización y marca · spec 22 (5)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /cms/stories/{}` | Editar, borrar o cambiar estado | Editar título, ciudad, frase, relato, fotos y tour enlazado de una historia de aventura. El contrato solo crea, pide consentimiento, publica y despublica; lo exige el criterio de CRUD completo. Si la historia está publicada y el cliente no autorizó fotos, no admite fotos (VT-12). `cms.seo.manage` o `channels.cms.publish`. |
| `DELETE /cms/stories/{}` | Editar, borrar o cambiar estado | Eliminar una historia que no está publicada (borrador, esperando consentimiento o despublicada). La auditoría conserva el registro. Mismos permisos. |
| `GET /showcase/overview` | Lectura de pantalla | Resumen público para la web de Rutas Libres en una sola llamada: ciudades con número de tours, temas, cifras del mes del embudo, reglas de cupo y comisión, beneficios, planes y add-ons para la página «Para agencias». Sin datos de agencias ni viajeros. |
| `GET /public/stories` | Lectura de pantalla | Historias publicadas con consentimiento vigente para la página `/aventuras` del sitio de la agencia (spec 22 §2, `(sitio)/aventuras`). El nombre del viajero se muestra según `consent_name_mode`. |
| `GET /public/stories/{}` | Lectura de pantalla | Detalle de una historia publicada para `/aventuras/{slug}`; suma una lectura. 404 si el cliente retiró el consentimiento. |

### Decisiones · finanzas: tipo de cambio y facturación electrónica (16)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PUT /finance/fx-provider` | Editar, borrar o cambiar estado | La agencia elige en Monedas el proveedor de tipo de cambio entre los validados por la plataforma (`code: null` = solo carga manual). G4-29. |
| `GET /finance/ose` | Lectura de pantalla | Estado de la facturación electrónica de la agencia: OSE elegido, modo simulado o conectado, paso pendiente y OSE homologados. |
| `PUT /finance/ose` | Editar, borrar o cambiar estado | La agencia elige uno de los OSE homologados (`code: null` = sin OSE, modo simulado). Borra las credenciales cargadas. |
| `GET /platform/fx-providers` | Lectura de pantalla | Consola › Integraciones › Tipo de cambio: catálogo de proveedores con estado validado / por validar y credenciales enmascaradas. |
| `POST /platform/fx-providers` | Editar, borrar o cambiar estado | Alta de proveedor de tipo de cambio con claves cifradas; nace por validar. |
| `PATCH /platform/fx-providers/{code}` | Editar, borrar o cambiar estado | Edita nombre, nota o claves; cambiar claves lo devuelve a por validar. |
| `DELETE /platform/fx-providers/{code}` | Editar, borrar o cambiar estado | Retira el proveedor del catálogo. |
| `POST /platform/fx-providers/{code}/test` | Acción propia | Prueba de conexión: si pasa queda validado; auditada. |
| `GET /platform/ose-providers` | Lectura de pantalla | Consola › Integraciones › Facturación electrónica: catálogo de OSE con estado homologado y agencias que lo eligieron. |
| `POST /platform/ose-providers` | Editar, borrar o cambiar estado | Alta de OSE en el catálogo. |
| `PATCH /platform/ose-providers/{code}` | Editar, borrar o cambiar estado | Edita nombre, nota u homologación. |
| `DELETE /platform/ose-providers/{code}` | Editar, borrar o cambiar estado | Retira el OSE si ninguna agencia lo tiene elegido (`OSE-IN-USE`). |
| `GET /platform/tenants/{id}/ose` | Lectura de pantalla | Tarjeta Facturación electrónica de la ficha de la agencia. |
| `PUT /platform/tenants/{id}/ose/credentials` | Editar, borrar o cambiar estado | El Super Admin carga las credenciales cifradas de la agencia ante su OSE. |
| `DELETE /platform/tenants/{id}/ose/credentials` | Editar, borrar o cambiar estado | Quita las credenciales de la agencia. |
| `POST /platform/tenants/{id}/ose/test` | Acción propia | Prueba la conexión con el OSE de la agencia; auditada. |

### Decisiones · WhatsApp, webhooks, cifrado y push (9)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /platform/integrations/whatsapp` | Lectura de pantalla | Consola › Integraciones › WhatsApp: app de Meta de KipuControl (ID, secreto enmascarado, token de verificación, registro guiado, versión de la API, rotación y última prueba). Decisión «Firma de WhatsApp». |
| `PUT /platform/integrations/whatsapp` | Editar, borrar o cambiar estado | Guarda la app de Meta cifrada en `platform_settings`. Un secreto nuevo rota el anterior, que sigue validando firmas 24 horas. Auditado por campo. |
| `POST /platform/integrations/whatsapp/test` | Acción propia | «Probar»: valida el ID y el secreto con el adaptador de Meta (simulado mientras no haya conector real). Auditado. |
| `GET /inbox/whatsapp/connection` | Lectura de pantalla | Estado de «Conectar WhatsApp»: número, modo (registro guiado o app propia), WABA enmascarada, URL de aviso propia y si la app de la plataforma está lista. `admin.settings.manage`. |
| `POST /inbox/whatsapp/connection` | Editar, borrar o cambiar estado | Registro guiado: canjea el código de Meta, guarda el ID del número, la WABA cifrada con su hash y el token cifrado. Exige R-WHATSAPP-OFFICIAL. |
| `PUT /inbox/whatsapp/connection/own-app` | Editar, borrar o cambiar estado | «Usar mi propia app de Meta»: ID de app, secreto (`webhook_secret`, spec 10), token permanente e ID del número, cifrados; genera el token de verificación de su URL propia. |
| `DELETE /inbox/whatsapp/connection` | Editar, borrar o cambiar estado | Desconecta el número: estado inactivo y borra las credenciales. |
| `GET /integrations/whatsapp/webhook/{agencia}` | Webhook | Verificación de Meta para la app propia de la agencia (token de verificación de su cuenta de canal). |
| `POST /integrations/whatsapp/webhook/{agencia}` | Webhook | Avisos de la app propia de la agencia, firmados con su secreto; se reparten igual que el URL único (mensajes, estados y plantillas). |

Cambio de comportamiento en rutas del contrato: `POST /integrations/whatsapp/webhook` valida la firma con el secreto de la app de la plataforma y reparte `messages` a la bandeja, `statuses` a la entrega (campañas, recordatorios de pago, mensajes al pasajero) y `message_template_status_update` a la revisión de plantillas (agencia por hash de la WABA); un número desconocido se ignora con 202. `POST /webhooks/providers/fcm` responde 404: los acuses push se consultan a Expo con el job JOB-PUSH-1.

### Decisiones · operaciones y app móvil (7)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /ops/no-shows` | Lectura de pantalla | Listado paginado de no-show por pasajero (`ops_no_shows`), con filtros por reserva, origen y fechas; los anulados solo con `filter[voided]=1`. `operations.view`. Decisión G3-28. |
| `GET /ops/reservation-services/{}/no-shows` | Lectura de pantalla | No-show registrados de un servicio, con su efecto (aviso al asesor, incidencia). `operations.view`. |
| `POST /ops/reservation-services/{}/no-shows` | Acción propia | Registra a los pasajeros que no se presentaron (sin check-in, desde el día del servicio) y aplica lo que diga Configuración › Operaciones: aviso al asesor, incidencia. Sin cargo automático desde el 16 nov. `operations.assign`, auditado. |
| `PATCH /ops/no-shows/{}` | Editar, borrar o cambiar estado | Corrige la nota del registro. `operations.assign`, auditado. |
| `DELETE /ops/no-shows/{}` | Editar, borrar o cambiar estado | Anula el registro con un motivo. `operations.assign`, auditado. |
| `GET /platform/settings/mobile-app` | Lectura de pantalla | Consola › Integraciones › App móvil: versión mínima y enlace a la tienda por plataforma. Decisión G3-27. |
| `PUT /platform/settings/mobile-app` | Editar, borrar o cambiar estado | Guarda la versión mínima de iOS y Android con su enlace (obligatorio si hay versión) en `platform_settings`. Auditado por campo. |

Cambio de comportamiento en rutas del contrato: toda ruta de la API que reciba `X-App-Version` y `X-App-Platform` (las manda la app) responde `426 UPGRADE_REQUIRED` con `details.min_version` y `details.store_url` si la versión es menor a la mínima. Al finalizar un servicio (`POST /mobile/operator/actions` tipo `finish` y `POST /ops/reservation-services/{}/complete`), los pasajeros sin check-in quedan registrados como no-show. La extranet (`/supplier/session`, `/supplier/requests`) usa `catalog_providers.response_sla_hours` o, si falta, `supplier_response_hours` de la agencia (G3-34).

### Decisiones · plataforma: roles, reglas de plan, pedidos de reglas y llaves de API (3)

Agregadas el 13 de noviembre de 2026, con la tanda de decisiones del grupo plataforma.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `POST /admin/booking-rules/{}/automation-requests` | Acción propia | «Pedir automatización» de una regla personalizada (G5-27): qué debe pasar, cuándo y un ejemplo. Llega a la consola en «Pedidos de reglas». Un solo pedido abierto por regla (409 `CR-05`); las reglas estándar responden 422. `admin.settings.manage`. Auditado. |
| `GET /platform/rule-requests` | Lectura de pantalla | Consola › Planes › Pedidos de reglas: pedidos de todas las agencias con su estado, conteos y el catálogo de reglas estándar para enlazar. |
| `POST /platform/rule-requests/{}/decision` | Editar, borrar o cambiar estado | Decide un pedido: `evaluar` (En evaluación), `rechazar` (motivo obligatorio) o `publicar` (enlaza una regla estándar del catálogo). Avisa en la campana al administrador de la agencia y a quien pidió; auditado en la plataforma. Acepta `lock_version`. |

Cambios de permiso sobre rutas del contrato (G5-20): `GET /iam/roles`, `GET /iam/roles/{id}`, `GET /iam/permissions`, `GET /iam/role-permissions` y `GET /iam/access-map` aceptan `admin.roles.manage` **o** `admin.users.manage` (solo lectura); las escrituras de roles siguen pidiendo `admin.roles.manage`. La pantalla `/admin/roles` también se abre con cualquiera de los dos.

Cambios de comportamiento en rutas del contrato: `POST /exports` (CRM) exige además `reports.view` (403 `CRM-EXP-02`), igual que `POST /me/data-exports` para las listas del CRM. `POST /platform/trials` aplica LND-08: una prueba cada 12 meses por agencia, RUC o dominio de correo (409 `TRIAL_ALREADY_USED` con `details.available_from`). Con la regla fuera de plan o apagada, se consultan y canjean los vales vigentes (`GET /finance/gift-cards`, `GET /finance/gift-cards/{}`, canje y anulación), se listan y anulan los links de pago (el cliente los paga hasta su vencimiento), los pases QR emitidos sirven en el check-in y el portal corporativo queda en solo lectura (los GET responden; las escrituras dan 403 `RULE_NOT_IN_PLAN`). El listado de vales y de links trae `meta.rule_enabled`.

Guard de llaves de API (API-BR-01): middleware `App\Domain\Admin\Http\Middleware\AuthenticateApiKey` y `RequireApiScope:<scope>`. Todavía no está puesto en ninguna ruta del contrato (ver dudas del informe del 13 de noviembre); la tabla de endpoints de `/admin/api` se arma sola con las rutas que lo usen.

### Integraciones de prueba: estado de las conexiones y correo de la agencia (4)

Agregadas el 17 de noviembre de 2026 con la decisión «Integraciones de prueba» (`routes/modules/integraciones-de-prueba.php`). En producción (o con `INTEGRATIONS_REQUIRE_REAL=true`) ningún adaptador `fake` entrega resultados: responde 409 `INTEGRATION_UNAVAILABLE` con el aviso de la función.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /integrations/readiness` | Lectura de pantalla | Estado de lo que pone la agencia (correo de salida, WhatsApp, OSE, pasarela: `conectado`, `en_proceso`, `sin_configurar`, y si se puede usar) y de lo que pone KipuControl (`features`: disponible o «Próximamente»). Lo leen el inicio («Completa tu configuración»), Integraciones y las pantallas que dependen de un proveedor. Cualquier usuario de la agencia; `can_manage` con `admin.settings.manage`. |
| `GET /settings/outgoing-mail` | Lectura de pantalla | Correo de salida propio de la agencia (proveedor, correo, remitente, si la clave está guardada y cuándo se probó). Nunca devuelve la clave. Guardado en `sys_settings` › `notifications.outgoing_mail`. `admin.settings.manage`. |
| `PUT /settings/outgoing-mail` | Editar, borrar o cambiar estado | Conecta el correo: `provider` (`gmail`, `outlook`, `zoho`, `otro`), `address`, `password` (clave de aplicación, cifrada; vacía mantiene la guardada si el correo no cambia), `from_name` y, con `otro`, `host`, `port` y `encryption`. Prueba la conexión y envía un correo de prueba antes de guardar: si falla, 422 `MAIL-TEST-FAILED` y no se guarda. Auditado sin la clave. |
| `DELETE /settings/outgoing-mail` | Editar, borrar o cambiar estado | Desconecta el correo de la agencia y borra la clave. 422 `CFG-BR-01` si no había uno conectado. Auditado. |

### Decisiones · sitio: transferencias, reseñas externas, select_date y plazos de la bandeja (16)

Agregadas el 13 de noviembre de 2026, con la tanda de decisiones del grupo sitio (`routes/modules/decisiones-sitio.php` y `routes/public/decisiones-sitio.php`).

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /settings/transfer-validation` | Lectura de pantalla | Configuración › Pagos y transferencias (G7-24): aviso a Finanzas, cancelación automática y escalamiento en horas hábiles, guardados en `sys_settings` › `ecommerce.transfers`. `admin.settings.manage`. |
| `PUT /settings/transfer-validation` | Editar, borrar o cambiar estado | Guarda `alert_finance`, `alert_minutes` (120/240/480), `auto_cancel`, `cancel_hours` (24/48/72), `reminder_minutes` (30/60/120), `escalate_minutes` (60/120/240) y `lock_version`. Auditado por campo; 422 `CFG-BR-01` sin cambios. |
| `POST /public/orders/{}/transfer-proof` | Acción propia | «Subir constancia» desde el enlace del correo con datos bancarios (multipart `file`, foto o PDF de hasta 10 MB, antivirus). Exige `X-Order-Token`. El pedido queda «Constancia recibida» y se pausa la cancelación automática; campana y correo a Finanzas. |
| `POST /public/me/payments/{}/transfer-proof` | Acción propia | Lo mismo desde Mi cuenta del sitio, sobre un pago pendiente de la cuenta. Nombre `public.me.sitio.payments.transfer-proof` (el prefijo `public.me.` lo exige el acceso de cuentas del sitio). |
| `GET /finance/payments/{}/transfer-proof` | Lectura de pantalla | Descarga la última constancia del pago. `finance.receivables` o `finance.payments.register`. |
| `GET /reservations/{}/web-recreation` | Lectura de pantalla | Reemplaza a `web-reactivation` desde el 16 nov (ver «Tanda 16 · operaciones y sitio»). |
| `POST /reservations/{}/web-recreation` | Acción propia | Reemplaza a `web-reactivation` desde el 16 nov (ver «Tanda 16 · operaciones y sitio»). |
| `GET /channels/review-links` | Lectura de pantalla | Reseñas › Conectores: enlaces públicos de Google y TripAdvisor (G7-27), en `sys_settings` › `notifications.review_links`. `channels.ecommerce.manage` o `crm.clients.manage`. |
| `PUT /channels/review-links` | Editar, borrar o cambiar estado | Guarda o quita los enlaces (validados por formato y dominio). `channels.ecommerce.manage`. Auditado. |
| `POST /channels/review-links/test` | Acción propia | «Probar»: valida formato `https`, dominio de la plataforma y que tenga la dirección del negocio, sin llamar a internet. Auditado. |
| `GET /channels/review-invitations` | Lectura de pantalla | Pestaña «Invitaciones postviaje»: reservas terminadas (120 días), su invitación, invitados y clics por enlace (propia, Google, TripAdvisor). |
| `POST /public/reviews/by-token/{}/external-click` | Acción propia | Redirección propia del enlace «Opina también en …»: valida el token de la invitación, registra el clic en `crm_review_link_clicks` y devuelve la URL de la plataforma. La usa la ruta del sitio `/resena/{código}/{google|tripadvisor}`. |
| `GET /inbox/response-times` | Lectura de pantalla | Canales e integración: plazos de primera respuesta del chat web, formularios y portal (G8-11), en `sys_settings` › `notifications.inbox_sla`. `admin.settings.manage`. |
| `PUT /inbox/response-times` | Editar, borrar o cambiar estado | Guarda `webchat`, `form`, `portal` (15, 30, 60, 120, 240 o 480 min; por defecto 15, 120 y 240). Auditado por canal. |

Cambios de comportamiento en rutas del contrato: `POST /public/analytics/events` acepta `select_date` (solo `item_id`, `date`, `adults`, `children`, `pax`, `available`, `source`, `destination`, `type`; el resto de parámetros se descarta). `GET /channels/ecommerce` suma el paso `dates` («Eligieron fecha») al embudo, `unmet_demand` y `orders[].proof_at`. `GET /public/orders/{}` suma `proof` y `auto_cancel_at`. `GET /finance/payments` suma `rows[].proof` (con minutos hábiles y si ya se escaló). `GET /public/me/reservations/{}` suma `payments[].proof_at` y `can_upload_proof`. `GET /inbox/conversations` suma `items[].awaiting_reply`. Las conversaciones nuevas de los cinco canales calculan `first_response_due_at` en horas hábiles. Los candidatos de la conciliación bancaria muestran el pedido web del pago (`order`). Nuevo proceso `JOB-SITIO-1` (cada 15 min): escalamiento de constancias, aviso de pagos sin validar y cancelación automática.

### Tanda 16 nov · datos: vales, reglas del catálogo, cupo de IA y cifrado del asunto (0 rutas nuevas)

Sin rutas nuevas. Correcciones y ampliaciones del kit, sin tocar `docs/kit`:

- **O10 · `fin_gift_card_movements.kind` a `varchar(12)`.** Error del kit (`40_fase3.sql` l. 1193: `varchar(10)` con `'vencimiento'`, 11 letras, en su propio CHECK). Migración `2026_11_16_datos_01_tipo_de_movimiento_de_vales` (si una actualización del kit vuelve a cargar `varchar(10)`, esta migración corre después). El vencimiento automático del vale (`GiftCards::expireCard`) guarda `vencimiento` en lugar de `ajuste`. Los `ajuste` cuya nota empieza con «Vencimiento del vale» se reclasifican a `vencimiento`: única excepción al append-only (se apaga el trigger solo en la migración, cambia el tipo, no montos ni saldos) y queda auditada por movimiento (`Vale de regalo` · `reclasificar_movimiento`). Reversible. Cumple spec 19 §3.9.
- **Dudas 2 y 8 · reglas del catálogo en la base.** `BookingRuleCatalogSeeder` corre siempre desde `DatabaseSeeder` y solo agrega lo que falta en `sys_booking_rule_catalog` y `plan_rule_entitlements` (las 34 reglas de `settings.json` y las 14 de «Funciones del plan»); no pisa lo editado en la consola. `ProvisionTenant` copia el catálogo a la agencia nueva (spec 17 l. 59) y a las agencias existentes se les agregan las reglas que no tienen, sin tocar las suyas (auditado: `Reglas de reserva` · `agregar_reglas`). Reutilizable: `App\Domain\Platform\Support\BookingRuleCatalog` (`addMissing`, `fillTenant`, `fillTenants`). `PlanCatalogSeeder` toma las definiciones del mismo seeder.
- **Duda 9 · cupo de IA en `plan_limits` (ampliación v3.0).** Métrica nueva `ai_requests` (100 / 1 000 / 5 000, supuesto de spec 19 l. 352) en el CHECK de `metric` de `plan_limits` y `usage_counters` (corrige la contradicción del kit entre SC-02 y spec 13 §3.3). Migración `2026_11_16_datos_02_cupo_de_ia_en_limites_del_plan`. Se edita en Consola › Planes con los demás límites (`PlanCatalog::METRICS`); suma los add-ons que la otorguen (`EffectiveLimits`). Sale la constante `AssistantWorkflow::PLAN_QUOTA` y el parámetro `monthlyQuota` de la regla. `GET /ai/usage` suma `exhausted`, y `limit` y `remaining` pueden ser `null` (sin cupo). Se mantienen el aviso al 80 % y el 429 `AI_QUOTA_EXCEEDED` (también en el importador de productos).
- **Duda 3 · asunto y nombre de adjunto cifrados (ampliación v3.0 de la spec 10, junto al cifrado de mensajes del 12 nov).** `collab_conversations.subject` y `collab_message_attachments.file_name` pasan de `varchar(200)` a `text` (`2026_11_16_datos_03`) y se cifran con `MessageCipher::sealLabel`, que valida 200 caracteres antes de cifrar (422 `INB-LABEL-LENGTH`). Escriben cifrado WhatsApp y correo (`InboundMessages`), formulario de contacto, chat web, portal, reseñas externas, adjuntos de la bandeja y la semilla; la bandeja, el portal y la descarga muestran el texto en claro, y la búsqueda de la bandeja sigue en la web sobre lo descifrado. Datos existentes: `2026_11_16_datos_04_cifrar_asunto_y_adjuntos`, reversible (como `2026_11_13_whatsapp_02`).

### Tanda 16 · consola: Integraciones en dos grupos y clave de Payload (3)

Agregadas el 16 de noviembre de 2026, con la tanda de construcción del grupo consola (`routes/platform/tanda16-consola.php`). Duda 13 y O9 de `pendientes.md`.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /platform/integrations/payload` | Lectura de pantalla | Consola › Integraciones › Blog de la vitrina (Payload): URL del admin, clave de firma enmascarada (últimos 4), rotación con 24 h de gracia, aviso «Payload todavía firma con la clave anterior», último aviso firmado (fecha, evento y artículo) y rechazos `WEBHOOK_SIGNATURE` de las últimas 24 h. `admin.tenant.manage`. |
| `PUT /platform/integrations/payload` | Editar, borrar o cambiar estado | Guarda `admin_url` (https, hasta 300). 422 `CFG-BR-01` sin cambios. Auditado bajo «Blog de la vitrina (Payload)». |
| `POST /platform/integrations/payload/secret` | Acción propia | «Generar clave» / «Rotar clave»: crea la clave de firma, la devuelve **una sola vez** (`secret`) y la guarda cifrada en `platform_settings` › `payload_webhook`. Si ya había una, la anterior sigue validando 24 h. Auditado (`generar` / `rotar`). Throttle 6/min. |

Cambio de comportamiento en una ruta propia: `POST /platform/blog/webhooks/payload` (spec 24 BLG-03) valida la firma con la clave de la consola (y la anterior durante la gracia) en lugar de `PAYLOAD_WEBHOOK_SECRET`, que se quitó de `config/seguimiento.php`; también `PAYLOAD_ADMIN_URL` (la URL del admin es un campo de la consola, con `https://rutaslibres.pe/admin` como valor por defecto). Cada aviso válido se registra en `platform_settings` › `payload_webhook_activity`; cada rechazo `WEBHOOK_SIGNATURE` se cuenta en caché por 24 h. `GET /platform/blog/sync-status` lee `configured` y `admin_url` de la consola. `GET /platform/operations` suma `errors[].connection` (sección de la consola a la que enlaza el error: `whatsapp`, `correo-de-salida`, `facturacion-electronica`, etc., o `null`), resuelta por el tipo del adaptador o por el destino.

Pantallas (duda 13, la spec 13 y el prototipo no definen las secciones de Integraciones): Consola › Integraciones pasa de pestañas a menú lateral con **Monitoreo** (Tareas y colas, Salud por agencia, Errores) y **Conexiones** (WhatsApp, App móvil, Tipo de cambio, Facturación electrónica, Correo de salida, Protección de formularios, Antivirus, Blog de la vitrina). Correo de salida, Protección de formularios y Antivirus se mudan desde Consola › Configuración; también el Webhook fiscal (a Facturación electrónica) y se quita el atajo de Cobranza, para que Configuración quede con emisor, IGV y avisos como dice la spec 13 v3.0. Las URLs existentes no cambian; las nuevas son `/plataforma/integraciones/{correo-de-salida|proteccion-de-formularios|antivirus|blog-de-la-vitrina}`. Las tarjetas movidas siguen usando `GET /platform/settings` y sus rutas de guardado (`PUT /platform/settings/form-protection`, `/outgoing-mail`, `/fiscal-webhook`).

### Tanda 16 · operaciones y sitio: no-show sin cargo, recrear la reserva web, baja de WhatsApp, idioma del chat y selector de hora (2)

Agregadas el 16 de noviembre de 2026 con la tanda de construcción del grupo operaciones y sitio. Dudas 6, 7, 10, 11 y 12 de `pendientes.md`. Las dos rutas reemplazan a `GET`/`POST /reservations/{}/web-reactivation` (se quitaron) en `routes/modules/decisiones-sitio.php`.

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /reservations/{}/web-recreation` | Lectura de pantalla | Vista previa de «Recrear la reserva» en una reserva web cancelada cuyo pago se rechazó o venció: monto informado, cupos libres por salida (solo las salidas de esta reserva), `outcome` (`confirmada` o `pendiente_disponibilidad`) y `replaced_by` si ya se recreó. `finance.payments.register`. |
| `POST /reservations/{}/web-recreation` | Acción propia | Duda 7 (spec 04: `cancelada` es terminal). La cancelada sigue cancelada; se crea una reserva nueva (`RES-` nuevo) con los mismos datos (servicios, pasajeros, viaje por tramos, snapshot web y cuotas reabiertas) y el pago que llegó (se traslada a la nueva, se revalida y se aplica). Con cupos recupera los mismos y queda confirmada (o `pendiente_proveedor`, como cualquier pago web aplicado); sin cupos queda `pendiente_disponibilidad` (spec 04 l. 217) para reprogramar o devolver desde la reserva nueva. Body `note` opcional. 201 con `reservation`, `replaces` y `status`. 409 `SIT-RECREATE-01` (no elegible o ya recreada) y `SIT-RECREATE-02` (los cupos se acabaron al confirmar). Auditado en las dos reservas (`recrear` / `reemplazar`), en el pago (`trasladar`) y en el pedido web (`recrear_reserva`); correo al cliente (`reserva.recreada`). Idempotencia opcional. Sale el modo `devolver` directo sobre la cancelada: la devolución se hace desde la reserva nueva. |

Ampliaciones del esquema (propias, sin tocar `docs/kit`):

- **`booking_reservations.replaces_reservation_id`** (`2026_11_16_operaciones_02_reserva_que_reemplaza`, índice único parcial): enlaza la reserva recreada con la cancelada. `GET /reservations/{}` suma `replaces` y `replaced_by` (código), que la ficha muestra como «Reemplaza a RES-…» / «Reemplazada por RES-…».
- **No-show sin cargo** (`2026_11_16_operaciones_01_no_show_sin_cargo`): salen `ops_no_shows.receivable_id`, `charge_pct`, `charge_amount` y `charge_currency`, y la clave `noshow_charge` de `sys_settings` › `operations`. Cumple spec 05 §12 punto 5 («sin cargo automático»).

Cambios de comportamiento en rutas existentes:

- Duda 6 · `PATCH /settings/operations` ya no acepta `noshow_charge` y `GET /settings` no lo devuelve. `POST /ops/reservation-services/{}/no-shows` devuelve `effects` sin `charge`; `GET /ops/no-shows`, `GET /ops/reservation-services/{}/no-shows` y `GET /ops/orders/{}` (`no_shows[]`) sin `charge`; `DELETE /ops/no-shows/{}` sin `charge_cancelled`. La confirmación de «Marcar como completado» en la orden lista a los pasajeros que quedarán como no-show (OPS-BR-51, solo si hay al menos un check-in).
- Duda 7 · el correo «transferencia.datos» suma «Monto de cada tour» cuando el pedido tiene dos o más reservas, con «Puedes pagar todo junto o hacer una transferencia por cada tour.». `GET /public/me/receivables` suma `by_tour` (código, título y saldo por moneda, solo con dos o más tours por pagar) y `split_hint`.
- Duda 10 · el recordatorio de pago (`POST /finance/receivables/{}/reminders` y `JOB` de recordatorios) no sale por WhatsApp si el cliente tiene `mkt_consents` de WhatsApp `revocado`: sale solo por correo, `whatsapp.note` dice «WhatsApp omitido: el cliente se dio de baja.» y la cuota registra en su historial (auditoría `Cuenta por cobrar` · `omitir_whatsapp`) «WhatsApp omitido: el cliente se dio de baja». No pide consentimiento de marketing (spec 14 MKT-BR-16).
- Duda 11 · `POST /public/chat/sessions` lee `X-Site-Locale` (`SiteLocale`, como el catálogo; la web ya lo manda) y la respuesta automática (en horario y fuera de horario, SIT-BR-24) sale en `es` o `en`, con el horario de atención en el mismo idioma.

### Tanda 16 · planes y alta: plantillas e IA por plan, seguimiento en Starter, alta solo con RUC y cupón de bienvenida (0 rutas nuevas)

Agregadas el 16 de noviembre de 2026, con el grupo planes (O3, O4, O7 y O8). Sin rutas nuevas ni migraciones.

Llaves de plan propias (extensión de la lista de la spec 13 §128), en `config/entitlements.php`, en el catálogo de `PlanCatalogSeeder` y en las bases existentes con `PlanCatalogAdditionsSeeder` (llamado desde `DatabaseSeeder`; solo agrega lo que falta). Las cuatro vienen en Starter, Professional y Enterprise:

| Llave | Rutas de la API | Pantalla | Antes |
| --- | --- | --- | --- |
| `module.site_templates` | `cms/templates`, `cms/theme` | `/canales/plantillas` | `module.cms` (solo Enterprise) |
| `module.ai_content` | `cms/ai` | `/canales/contenido-ia` | `module.cms` |
| `module.web_tracking` | `marketing/tracking` | `/canales/seguimiento` | `module.marketing_campaigns` |
| `module.web_analytics` | `analytics/web` | `/reportes/visitas` | `module.reports` |

Blog, páginas, SEO y Aventuras siguen en `module.cms`; Campañas y el resto de Reportes, en sus módulos. `GET /me/access` marca con `null` en `locked` las pantallas habilitadas que cuelgan de un prefijo bloqueado (en Starter, `/reportes/visitas` bajo `/reportes`), para que la web no las bloquee por prefijo.

Complementos (`addons`) agregados al catálogo: `marketing_pro` (S/ 39 al mes, ofrecido a Starter e incluido en Professional y Enterprise, semilla `addonCatalogV28.json`), `ai_content` (mensual, IA Básico S/ 59 o IA Pro S/ 149 según el plan de IA), `ai_images` (mensual S/ 49 o paquete), `premium_template` (pago único S/ 290) y **`ai_credit_pack`** (propio: pago único de los paquetes de créditos). Los precios de la plataforma se facturan sin IGV y la factura FQ01 lo suma (18 %).

Cambios de comportamiento en rutas del contrato:
- `POST /cms/templates/{}/purchase` (TPL-04) y `POST /cms/ai/packs/{}/purchase` cobran en la factura de la plataforma y responden `billing` (`invoice`, `total`, `charge`). Premium y paquetes: un ítem `billing_mode = unico` en `subscription_items` por complemento (`premium_template` o `ai_credit_pack`); cada compra suma 1 a `quantity`, se guarda en `meta.purchases` y emite su propia factura `addon` (la base del kit permite un solo ítem abierto por complemento y exige `ends_at` nulo en los de pago único). IA Básico, IA Pro y 30 imágenes al mes: ítem mensual (`ai_content` o `ai_images`) con `meta.pack`, prorrateado al contratar como los demás complementos y facturado en cada renovación. Sin suscripción vigente, 422 `SUBSCRIPTION_REQUIRED`. La renovación y el MRR solo cuentan los ítems mensuales.
- `GET /cms/ai/credits` y todo pedido de IA asignan los créditos del mes al primer uso del mes (`asignacion_plan`: Starter 0, Professional 50, Enterprise 100, más el plan de IA contratado) y vencen los créditos mensuales sin usar del mes anterior (`vencimiento`, nota «Créditos mensuales sin usar de …», IA-06). La spec 23 lo pone en un job del día 1 (`GrantMonthlyAiCredits`); se hace al primer uso para no depender del programador (mismo resultado, una sola vez por mes). Los paquetes de pago único no vencen todavía a los 12 meses (`ExpireAiPacks` sigue pendiente).
- 429 `AI_CREDITS_EXHAUSTED` suma `details.offer` (planes y paquetes del tipo, con precio) y `details.manage_path`; el mensaje dice desde cuánto cuesta (+ IGV).
- `POST /billing/addons/{}` responde 422 `ADDON_MANAGED_ELSEWHERE` para `ai_content`, `ai_images`, `ai_credit_pack` y `premium_template` (se contratan en Contenido con IA o en Plantillas); `GET /billing/subscription` no los lista en `addon_catalog` y solo muestra ítems mensuales en `addons`.
- `POST /billing/subscription/preview-change` suma `warnings` al bajar de plan (avisos que no bloquean): plantilla activa con plan mínimo mayor, créditos de IA incluidos que bajan y, al pasar a Starter sin Marketing Pro, etiquetas de seguimiento que piden el complemento y Visitas de 30 días sin exportación (`DowngradeValidator::warnings`).
- Alta de la landing solo con RUC (O7). **Desviación de la spec 25** (LND-04 «Boleta: DNI…», §13.3 serie B001) y de `landing.js` del prototipo 2.13 (l. 355 y 376): `POST /public/signups` ya no pide `doc_type` (si llega, solo acepta `factura`) y la suscripción queda siempre con `billing_doc_type = Factura`. `PATCH /billing/subscription` responde 422 `SUB-BR-09` a `doc_type = Boleta` con cualquier RUC y guarda siempre `Factura`; la factura puede ir a otro RUC (10, 15, 17 o 20). El alta muestra «¿No tienes RUC?» con la guía de SUNAT y «Escríbenos» (registra el lead con `POST /public/sales-leads`). Las agencias siguen emitiendo boleta a sus propios clientes (spec 07).
- Cupón KIPUTURISMO2026 (O8, extiende `coupons.json` del kit): 10 %, 1 ciclo, Starter y Professional, sin tope, vence el 31/12/2026, nota «Bienvenida de la landing (spec 25 §5.1)»; lo crea `PlanCatalogAdditionsSeeder` solo si falta. Un cupón vencido responde «El cupón KIPUTURISMO2026 venció el 31/12/2026.» en `POST /public/coupons/validate`, el pago del alta, la conversión de la prueba y `POST /billing/coupon`.

### Tanda 16 · precios: IGV incluido, monedas de cobro y niños en tours con edad mínima (0 rutas nuevas)

Agregadas el 16 de noviembre de 2026, con el grupo precios (O5, duda 4 y O6). Sin rutas nuevas ni migraciones.

- O5 · **Desviación de la spec 03** (fórmula PRC y `quoteTotals` del prototipo, que suman el IGV encima y no redondean) cuando `currency.price_with_tax` está encendido; responde a la spec 03 §12.2 y la spec 04 §12.6. Un solo servicio (`Admin\Support\PriceTax`) para sitio, cotización y reserva directa: encendido, la tarifa es precio final y el IGV se desglosa desde adentro (Humantay 2 adultos Directo: S/ 280.00 = 237.29 + 42.71); apagado, se suma encima (S/ 330.40). Sin valor guardado vale encendido (semilla `settings.json`).
  - `POST /quotes/pricing/preview` y la versión guardada: `net_total` = valor de venta sin IGV y `grand_total` = tarifa − descuento cuando está encendido; el margen (`margin_pct`, `profit_total`) se mide sobre el neto sin IGV (H-11). La vista previa suma `totals.tax_included`; `GET /quotes/{}` (versiones) y `GET /public/quotes/{token}` suman `totals.tax_included`, deducido de los totales guardados (las cotizaciones ya enviadas conservan los suyos). La propuesta en PDF dice «IGV incluido (18 %)».
  - `POST /reservations/availability-check` suma `subtotal` (tarifa) y `tax` (`pct`, `included`, `taxable`, `tax`, `total`); `total` ya incluye el IGV sumado cuando está apagado y la reserva directa guarda ese total. Usa el IGV de la agencia (sin la regla de cliente no domiciliado de la cotización).
  - `POST /public/price-quote` y `POST /public/quote` suman `tax`; apagado, el IGV va como ajuste `tax` («IGV (18 %)») antes de calcular adelanto y saldo, y `list_total` no se muestra.
  - Redondeo de la agencia (`currency.rounding`, `round_mode`): ahora también en cotización y reserva directa, solo al precio por persona que sale de la tarifa (como SIT-BR-02 del sitio); nunca a un precio manual ni al total.
- Duda 4 · (b) toda conversión a una moneda de cobro suma `fxMarginPct` de R-MULTICURRENCY (`FxTable::display`, conversión de tarifas sin precio propio, totales del carrito y del pedido en otra moneda). (c) **Reemplaza lo decidido el 12 nov**: con R-MULTICURRENCY encendida, `POST /public/price-quote` y el carrito cobran en la moneda elegida si es de cobro, con el precio propio de la tarifa si existe (ajuste «Cobrar en varias monedas») o convertido con TC + margen; si la elegida no es de cobro (EUR), en USD. La respuesta suma `converted`. Con la regla apagada se cobra en la moneda de la tarifa (el motor no cotiza fuera de la base sin la regla). Yape y Plin cobran siempre en soles: el checkout y la página del pedido marcan `methods[].available = false` con `note` cuando la moneda no es PEN, y el pago del checkout, el del pedido y `POST /public/me/receivables/{}/pay` responden 422 `SIT-BR-11` a Yape o Plin fuera de soles (interpretación: se paga en soles eligiendo esa moneda; el pago no se convierte). **Desviación del prototipo** (`booking-engine.js` convierte sin margen hacia una moneda de cobro): el caso canónico PRD-011 pasa de S/ 19,324.98 a S/ 19,708.48 (USD 5,167.11 → 5,167.91) con el margen de 2 % de la semilla; `tests/Datasets/prd011.php` se actualizó, la copia del kit (`docs/kit/tests/pest/Datasets/prd011.php`, `docs/kit/tests/e2e/support/expected.ts`) no se tocó.
- O6 · niños en tours con edad mínima (TB-04 de la spec 21). Las rutas del sitio con extras (`price-quote`, `quote`, carrito) aceptan `tour_children` ({tour: niños con la edad mínima o más}); la ficha pública suma `trip.legs[].tours[].children_rule` (`all`, `ask` o `none`: si la edad mínima supera la edad máxima de niño, no se pregunta y ningún niño va). Los menores no pagan, no ocupan cupo ni salen en la orden (`booking_trip_items.children` y el servicio guardan solo los aptos) y el motor avisa «No puede ir a *tour*: edad mínima *N* años». El checkout (paso pasajeros) valida con las fechas de nacimiento y pide ajustar el tour (422 `SIT-BR-14`). La venta en ruta cuenta los niños aptos con las fechas de nacimiento (o la edad) de la reserva, sin preguntar. Vuelo y bus siguen como `tren_entrada`, pero el servicio se llama según `catalog_transport_options.mode` («Vuelo Lima → Arequipa», «Bus…», «Tren…») y el portal y la app del pasajero reciben `mode` en cada servicio para el ícono. La etiqueta general pasa a «Pasajes y entradas» (calendario de operaciones, apps, portal, proveedores y grupo de Rentabilidad).

### Tanda 16 · cotización: confirmación al aplicar un borrador de IA (0 rutas nuevas)

Agregado el 16 de noviembre de 2026 (O11 de `pendientes.md`). **Interpretación registrada de la spec 19 l. 324** («no cambia el estado»): se lee como «la IA nunca envía, aprueba ni confirma sola» (SC-03 l. 177) y se sigue la spec 03 (l. 197 «Crear nueva versión», QTE-BR-18).

- `POST /ai/requests/{}/apply` acepta `confirm` y `void_approval` (booleanos). Cotización en `borrador`: se anota la versión vigente, sin confirmación (como antes). En `enviada`, `vista`, `negociacion`, `rechazada` o `vencida`: sin `confirm` responde 409 `AI_APPLY_CONFIRM` con `details.impact` («Esto crea la v3 en borrador y la v2 queda reemplazada. El cliente sigue viendo la v2 hasta que envíes la v3»); con `confirm` crea la versión nueva y la cotización pasa a `borrador`. En `aprobada` o con aprobación interna pendiente: además pide `void_approval` («Se anulará la aprobación del cliente del [fecha]» o «…la aprobación interna pendiente del [fecha]»). En `convertida`: 409 `QTE-BR-18`. La auditoría del pedido anota lo confirmado.
- `GET /ai/requests/{}` y la lista de `GET /ai/usage` suman `apply_impact` (`level` `warning` o `danger`, versiones, mensaje y aviso) en los borradores listos para aplicar a una cotización; la pantalla del asistente muestra el aviso ámbar o rojo y pide el segundo clic.
- `GET /public/quotes/{token}`: mientras la versión nueva está en borrador, el enlace del cliente muestra la última versión reemplazada (la que se envió) con `status = actualizando` y la nota «Tu asesor está preparando una versión actualizada»; antes respondía 404 «todavía no está disponible». No registra la apertura ni permite aprobar esa versión.

### Tanda 16 · llaves de API: las 35 rutas del contrato aceptan la llave (1 ruta nueva)

Agregado el 16 de noviembre de 2026 (G6-02, punto 1 de las dudas de la tanda de construcción). Cumple spec 13 API-BR-01 («autentica al tenant, no a un usuario») y el esquema `tenantApiKey` del contrato.

- Las 35 operaciones con `tenantApiKey` en `security` aceptan `Authorization: Bearer qts_live_…`/`qts_test_…` además de la sesión. El mapa operación → scope es explícito en `Admin\Support\ApiKeyRoutes::ROUTES` (nombre de ruta → `x-scopes`) y se cuelga en `bootstrap/app.php` junto a `ContractMiddleware`. Si el Bearer no es una llave, la ruta sigue con la sesión como antes. Sin el scope: 403 `API_KEY_SCOPE` con `required_permissions = [scope]`; llave inválida, revocada o vencida: 401 `API_KEY_INVALID`; IP fuera de la lista: 403 `API_KEY_IP`; límite por minuto del plan: 429 con `Retry-After` y `X-RateLimit-*` (todas las respuestas con llave llevan `X-RateLimit-*`). **Ampliación:** cualquier otra ruta con sesión responde 401 `API_KEY_ROUTE` a una llave.
- La llave actúa como la agencia: permisos = scopes (`ApiKeyRoutes::PERMISSIONS`), sin rol y sin cartera (ve toda la agencia dentro de sus scopes). Las escrituras se auditan con `actor_type = api_client`, `actor_id` = id de la llave y autor «Llave *nombre* (KEY-…)» en `actor_role`; la auditoría y los historiales (reserva, cotización, CRM) muestran ese autor. `created_by`/`updated_by` guardan el id de la llave; el autor de una versión de cotización (`quote_versions.author_id`, FK a usuarios) es su responsable. La idempotencia se ata a la llave.
- Responsable de lo que se crea: (1) el `owner_id` que mande el sistema, si es un asesor activo (si no, 422); (2) sin `owner_id`, el lead queda en la cola sin asignar (spec 01 PROC-004); (3) clientes, cotizaciones y reservas quedan con el responsable de la llave. **Ampliación propia:** columnas `integration_api_keys.owner_mode` (`fixed` | `round_robin`, por defecto `round_robin`), `owner_id` y `owner_cursor` (migración `2026_11_16_llaves_01_responsable_de_la_llave`); el reparto por turno rota entre los asesores activos de rol ventas (si no hay, entre todos los asesores) y, si el asesor fijo deja de estar activo, pasa al reparto por turno. `POST /quotes` acepta `owner_id` (solo lo usa la llave; la sesión sigue creando a nombre de quien cotiza).
- `POST /integrations/api-keys` acepta `owner_mode` y `owner_id` (obligatorio con `fixed`). Nueva `PATCH /integrations/api-keys/{code}/owner` (`tanda16.llaves.owner.update`, `admin.api.manage`, auditada `cambiar_responsable`). `GET /admin/api` suma `owner_modes`, `advisors` y, por llave, `owner_mode`, `owner_id` y `owner_name`; los scopes de la pantalla suman `crm:read`, `operations:read` y `webhooks:manage` del contrato.

### Tanda del informe del 18 de noviembre · seguimiento de campañas y OAuth (5 rutas nuevas)

Agregado el 18 de noviembre de 2026 («Tanda siguiente del informe» de pendientes).

- `GET /public/campaigns/open/{token}` (ampliación, spec 14 tabla de destinatarios): píxel 1x1 de apertura para las campañas que salen por el SMTP de la agencia. Token firmado con agencia y destinatario; registra solo la primera apertura en `mkt_campaign_recipients.opened_at`, por el mismo camino que el webhook (`DeliveryReceipts::track`). Siempre responde la imagen, aunque el token no valga. El contrato solo define la apertura por webhook.
- `GET /public/campaigns/click/{token}` (ampliación, spec 14): registra el primer clic (`clicked_at`, que también cuenta como apertura) y redirige 302 solo al enlace n.º N del cuerpo guardado de la campaña. La URL de destino no viaja en la petición (sin open redirect); firma o índice inválidos → 404.
- `GET /oauth/authorize` (spec 13 §3.14, `securitySchemes.oauth2` del contrato): alimenta la página de consentimiento de Next en `/oauth/authorize` (app, permisos). Exige sesión, `admin.api.manage` y OAuth en el plan.
- `POST /oauth/authorize` (spec 13 §3.14): aprueba o rechaza (`approve`) y devuelve `redirect_to` con `code` y `state`, o `error=access_denied`. Solo PKCE S256, URL de retorno exacta y permisos dentro de los de la app; auditado `autorizar` / `rechazar`.
- `POST /oauth/token` (spec 13 §3.14, `tokenUrl` del contrato): canje del código (Authorization Code + PKCE, un solo uso, 10 min) y renovación (`kco_` 1 h, `kcr_` 30 días, rotación). Errores en formato RFC 6749. Next reenvía `/oauth/token` del dominio público a esta ruta.

Cambios sin ruta nueva en rutas del contrato: `POST /ops/checkin/scan` acepta `service_id` opcional (422 `PASS_OTHER_SERVICE`); `POST /reservations/{id}/travel-docs/{passengerId}/{type}/files` ya no lleva el middleware `permission:` porque el contrato la abre al portal del cliente (el controlador limita al cliente o pasajero a su viaje y exige `operations.travel_docs` al personal); la venta del marketplace pide `client_id`; la API con llave responde 429 `QUOTA_EXCEEDED` al 100 % del plan (SUB-BR-04).
