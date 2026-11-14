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
| `GET /ops/reservation-services/{}/no-shows` | Lectura de pantalla | No-show registrados de un servicio, con su efecto (aviso al asesor, incidencia, cargo). `operations.view`. |
| `POST /ops/reservation-services/{}/no-shows` | Acción propia | Registra a los pasajeros que no se presentaron (sin check-in, desde el día del servicio) y aplica lo que diga Configuración › Operaciones: aviso al asesor, incidencia, cargo según la política de no-show del producto. `operations.assign`, auditado. |
| `PATCH /ops/no-shows/{}` | Editar, borrar o cambiar estado | Corrige la nota del registro. `operations.assign`, auditado. |
| `DELETE /ops/no-shows/{}` | Editar, borrar o cambiar estado | Anula el registro con un motivo; si generó un cargo sin pagos, cancela la cuenta por cobrar. `operations.assign`, auditado. |
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

### Decisiones · sitio: transferencias, reseñas externas, select_date y plazos de la bandeja (16)

Agregadas el 13 de noviembre de 2026, con la tanda de decisiones del grupo sitio (`routes/modules/decisiones-sitio.php` y `routes/public/decisiones-sitio.php`).

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /settings/transfer-validation` | Lectura de pantalla | Configuración › Pagos y transferencias (G7-24): aviso a Finanzas, cancelación automática y escalamiento en horas hábiles, guardados en `sys_settings` › `ecommerce.transfers`. `admin.settings.manage`. |
| `PUT /settings/transfer-validation` | Editar, borrar o cambiar estado | Guarda `alert_finance`, `alert_minutes` (120/240/480), `auto_cancel`, `cancel_hours` (24/48/72), `reminder_minutes` (30/60/120), `escalate_minutes` (60/120/240) y `lock_version`. Auditado por campo; 422 `CFG-BR-01` sin cambios. |
| `POST /public/orders/{}/transfer-proof` | Acción propia | «Subir constancia» desde el enlace del correo con datos bancarios (multipart `file`, foto o PDF de hasta 10 MB, antivirus). Exige `X-Order-Token`. El pedido queda «Constancia recibida» y se pausa la cancelación automática; campana y correo a Finanzas. |
| `POST /public/me/payments/{}/transfer-proof` | Acción propia | Lo mismo desde Mi cuenta del sitio, sobre un pago pendiente de la cuenta. Nombre `public.me.sitio.payments.transfer-proof` (el prefijo `public.me.` lo exige el acceso de cuentas del sitio). |
| `GET /finance/payments/{}/transfer-proof` | Lectura de pantalla | Descarga la última constancia del pago. `finance.receivables` o `finance.payments.register`. |
| `GET /reservations/{}/web-reactivation` | Lectura de pantalla | Vista previa de «Reactivar» en una reserva web cancelada por pago no validado: monto informado, cupos libres por salida y opciones (reactivar, o reprogramar / devolver si no hay cupos). `finance.payments.register`. |
| `POST /reservations/{}/web-reactivation` | Acción propia | `mode` = `reactivar` (recupera los cupos, valida y aplica el pago), `reprogramar` (valida el pago y deja la reserva pendiente de disponibilidad) o `devolver` (valida el pago y crea un reembolso pendiente). 409 `SIT-REACT-01` / `SIT-REACT-02`. Auditado y con correo al cliente. Idempotencia opcional. |
| `GET /channels/review-links` | Lectura de pantalla | Reseñas › Conectores: enlaces públicos de Google y TripAdvisor (G7-27), en `sys_settings` › `notifications.review_links`. `channels.ecommerce.manage` o `crm.clients.manage`. |
| `PUT /channels/review-links` | Editar, borrar o cambiar estado | Guarda o quita los enlaces (validados por formato y dominio). `channels.ecommerce.manage`. Auditado. |
| `POST /channels/review-links/test` | Acción propia | «Probar»: valida formato `https`, dominio de la plataforma y que tenga la dirección del negocio, sin llamar a internet. Auditado. |
| `GET /channels/review-invitations` | Lectura de pantalla | Pestaña «Invitaciones postviaje»: reservas terminadas (120 días), su invitación, invitados y clics por enlace (propia, Google, TripAdvisor). |
| `POST /public/reviews/by-token/{}/external-click` | Acción propia | Redirección propia del enlace «Opina también en …»: valida el token de la invitación, registra el clic en `crm_review_link_clicks` y devuelve la URL de la plataforma. La usa la ruta del sitio `/resena/{código}/{google|tripadvisor}`. |
| `GET /inbox/response-times` | Lectura de pantalla | Canales e integración: plazos de primera respuesta del chat web, formularios y portal (G8-11), en `sys_settings` › `notifications.inbox_sla`. `admin.settings.manage`. |
| `PUT /inbox/response-times` | Editar, borrar o cambiar estado | Guarda `webchat`, `form`, `portal` (15, 30, 60, 120, 240 o 480 min; por defecto 15, 120 y 240). Auditado por canal. |

Cambios de comportamiento en rutas del contrato: `POST /public/analytics/events` acepta `select_date` (solo `item_id`, `date`, `adults`, `children`, `pax`, `available`, `source`, `destination`, `type`; el resto de parámetros se descarta). `GET /channels/ecommerce` suma el paso `dates` («Eligieron fecha») al embudo, `unmet_demand` y `orders[].proof_at`. `GET /public/orders/{}` suma `proof` y `auto_cancel_at`. `GET /finance/payments` suma `rows[].proof` (con minutos hábiles y si ya se escaló). `GET /public/me/reservations/{}` suma `payments[].proof_at` y `can_upload_proof`. `GET /inbox/conversations` suma `items[].awaiting_reply`. Las conversaciones nuevas de los cinco canales calculan `first_response_due_at` en horas hábiles. Los candidatos de la conciliación bancaria muestran el pedido web del pago (`order`). Nuevo proceso `JOB-SITIO-1` (cada 15 min): escalamiento de constancias, aviso de pagos sin validar y cancelación automática.
