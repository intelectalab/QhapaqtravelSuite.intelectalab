# Rutas propias de la API (fuera del contrato)

Registro del 6 de noviembre de 2026. Son las rutas que el código expone y que no figuran en `docs/kit/api/openapi.yaml`, según `compare_contract.py` sobre el OpenAPI que genera Scramble. Cada una queda en uno de cuatro grupos, con su decisión.

| Grupo | Rutas | Decisión |
| --- | --- | --- |
| Alinear con el contrato | 0 | Ninguna. Las 109 que tenían equivalente en el contrato se movieron a su ruta el 6 de noviembre (sitio público, portales y back-office). |
| Lectura de pantalla | 67 | Se quedan. Evitan varias llamadas por pantalla; se propone sumarlas al contrato como lecturas de interfaz. |
| Editar, borrar o cambiar estado | 73 | Se quedan. Se propone sumarlas al contrato. |
| Acción propia | 19 | Se quedan mientras negocio no las retire; se propone sumarlas al contrato. |
| **Total** | **159** | |

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
| `POST /crm/cases/{}/reopen` | Acción propia | Reabrir un caso de postventa; la pantalla lo ofrece y el contrato no tiene esa transición. |
| `POST /crm/clients/{}/portal-access` | Acción propia | Invitar al cliente a su portal: crea o reutiliza el usuario con rol `customer`, lo vincula por `iam_users.client_id` (spec 08 §3.15, PCL-BR-01) y le envía la invitación de `auth/invitations`. El contrato solo tiene la invitación del personal (`POST /iam/users`, `admin.users.manage`); esta va bajo el cliente con `crm.clients.manage` y respeta la cartera del asesor. Exige Idempotency-Key. |
| `POST /crm/clients/{}/portal-access/resend` | Acción propia | Reenviar la invitación al portal mientras el cliente no la acepta; equivale a `POST /iam/users/{id}/resend-invitation` con el permiso de clientes. |
| `POST /crm/clients/{}/portal-access/revoke` | Acción propia | Revocar el acceso al portal: desactiva el usuario sin borrarlo, cierra sus sesiones y vence la invitación pendiente. El estado se lee en `GET /crm/clients/{code}` (`portal_access`). |
| `POST /crm/clients/{}/anonymize` | Acción propia | Supresión de datos personales (derecho de cancelación ARCO, Ley 29733). Anonimiza al cliente, sus contactos, pasajeros, leads, suscripciones y usuario del portal. También revoca sus consentimientos, conserva reservas y comprobantes y resuelve su solicitud ARCO si se indica. GUIA-TECNICA §14 pide «supresión (`deleted_at` + anonimización)», pero el contrato no tiene la ruta. Requiere `crm.clients.manage` y no la ejecuta Ventas (ARCO-03). La clave Idempotency-Key se respeta si llega. |

### Catálogo · spec 02 (18)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /catalog/products/{}/promotions/{}` | Editar, borrar o cambiar estado | Editar una promoción (nombre, tipo, valor, canal, código, mínimo de pasajeros, vigencia). El contrato solo permite crear, pausar, activar y borrar; lo exige el criterio de CRUD completo. |
| `GET /catalog/availability` | Lectura de pantalla | Vista de disponibilidad de todos los productos en una pantalla; el contrato la da producto por producto. |
| `GET /catalog/products/{}/editor` | Lectura de pantalla | Estado completo del asistente de edición (ficha, componentes, itinerario, tarifas, temporadas, disponibilidad, contenido, políticas, canales, resumen y checklist) en una sola llamada. |
| `POST /catalog/products/preview` | Acción propia | Validación por paso del asistente PROC-014 («validación por paso», spec 02 §2): valida el payload de `POST /catalog/products` hasta el paso indicado, lo ejecuta dentro de una transacción que se revierte y devuelve el resumen y el checklist §42. No guarda nada. |
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

### Cotizaciones · spec 03 (3)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /quotes/{}/versions/{}/pdf` | Lectura de pantalla | Descarga de la propuesta de una versión. El contrato solo tiene `POST` (encola con 202 en la cola `documents`); esta lectura devuelve el PDF ya generado, o lo genera en el momento, como JSON con URL firmada o como `application/pdf` si se pide con `Accept: application/pdf`. |
| `GET /quotes/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `DELETE /quotes/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Reservas · spec 04 (3)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /reservations/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /reservations/{}/changes/options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PATCH /reservations/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Operaciones y móvil · spec 05 (15)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /mobile/operator` | Lectura de pantalla | Vista previa de la app del operador desde el back-office, para elegir a quién ver; las rutas del contrato son las de la app con la sesión del propio operador. |
| `GET /mobile/passenger` | Lectura de pantalla | Vista previa de la app del pasajero desde el back-office; la ruta del contrato es la de la app con la sesión del propio pasajero. |
| `PATCH /ops/incidents/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /ops/orders/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /ops/orders/{}/cancel` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
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

### Extranet de proveedores · spec 06 (9)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /supplier/calendar` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /supplier/company` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /supplier/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /supplier/session` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `DELETE /supplier/company/contacts/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /supplier/company/contacts/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /supplier/payables/{}/invoices` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /supplier/rate-requests/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /supplier/company/contacts` | Acción propia | Contactos de la empresa en la extranet del proveedor; el contrato no los tiene. |

### Finanzas · spec 07 (8)

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

### Canales y portales · spec 08 (19)

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

### Administración y reportes · spec 09 (11)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /iam/roles/{}` | Lectura de pantalla | Detalle del rol en una sola llamada: experiencia, pantallas que ve (del mapa de acceso), usuarios con el rol y los últimos 30 cambios de permisos de la auditoría. El contrato solo trae la lista de roles y la matriz. Requiere `admin.roles.manage`. |
| `GET /admin/api` | Lectura de pantalla | Agregado de la pantalla API y webhooks: entregas, apps OAuth, límites del plan, consumo, catálogos de permisos y eventos. Las listas del contrato (`/integrations/api-keys` y `/integrations/webhooks`) ya existen. |
| `GET /admin/branding` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /dashboard/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /health` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /me/counts` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /reports/kpis` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /reports/process-map` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `PUT /admin/branding` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /admin/branding/reset` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `DELETE /cms/contents/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Aprobaciones · spec 10 (1)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /approvals/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Plataforma SaaS y API · spec 13 (30)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /platform/branding` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
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

### Marketing y metas · spec 14 (2)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PATCH /crm/sales-targets/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /marketing/campaigns/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |

### Sitio web público · spec 15 (5)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /public/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/captcha` | Lectura de pantalla | Clave pública de Turnstile para dibujar el widget en los formularios públicos. Se lee de la configuración de la plataforma (`null` si está apagada), así cambiarla no exige recompilar la web. |
| `GET /public/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/me/vouchers/{}.pdf` | Lectura de pantalla | PDF del voucher desde Mi cuenta; el contrato solo lista los vouchers (`GET /public/me/vouchers`). Verifica que el voucher sea de una reserva del cliente. |
| `POST /public/auth/email/resend` | Acción propia | Reenvía el enlace de verificación del correo (SIT-BR-21) desde Mi cuenta; límite de 3 por minuto. |

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
| `PUT /help/articles/{}` | Editar, borrar o cambiar estado | Edita el artículo propio o crea la versión de la agencia de uno de Qhapaq. |
| `POST /help/articles/{}/archive` | Editar, borrar o cambiar estado | Archiva el artículo solo para la agencia. |
| `POST /help/articles/{}/restore` | Editar, borrar o cambiar estado | Reactiva un artículo archivado. |
| `DELETE /help/articles/{}/adaptation` | Editar, borrar o cambiar estado | Descarta la versión de la agencia y vuelve a la de Qhapaq. |
| `GET /platform/help/articles` | Lectura de pantalla | Centro de ayuda de la consola con los artículos de Qhapaq y cuántas agencias adaptaron cada uno. |
| `GET /platform/help/articles/{}` | Lectura de pantalla | Ficha del artículo de Qhapaq. |
| `GET /platform/help/screen` | Lectura de pantalla | Ayuda de la pantalla actual de la consola. |
| `POST /platform/help/articles` | Acción propia | La plataforma crea un artículo para las agencias o para la consola. |
| `PUT /platform/help/articles/{}` | Editar, borrar o cambiar estado | Edita un artículo de Qhapaq. |
| `POST /platform/help/articles/{}/archive` | Editar, borrar o cambiar estado | Archiva un artículo de Qhapaq para todas las agencias que no lo adaptaron. |
| `POST /platform/help/articles/{}/restore` | Editar, borrar o cambiar estado | Reactiva un artículo de Qhapaq. |

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
