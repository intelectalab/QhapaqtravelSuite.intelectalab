# Rutas propias de la API (fuera del contrato)

Registro del 6 de noviembre de 2026. Son las rutas que el código expone y que no figuran en `docs/kit/api/openapi.yaml`, según `compare_contract.py` sobre el OpenAPI que genera Scramble. Cada una queda en uno de cuatro grupos, con su decisión.

| Grupo | Rutas | Decisión |
| --- | --- | --- |
| Alinear con el contrato | 0 | Ninguna. Las 109 que tenían equivalente en el contrato se movieron a su ruta el 6 de noviembre (sitio público, portales y back-office). |
| Lectura de pantalla | 54 | Se quedan. Evitan varias llamadas por pantalla; se propone sumarlas al contrato como lecturas de interfaz. |
| Editar, borrar o cambiar estado | 58 | Se quedan. Se propone sumarlas al contrato. |
| Acción propia | 13 | Se quedan mientras negocio no las retire; se propone sumarlas al contrato. |
| **Total** | **125** | |

Cómo regenerarlo: exportar el OpenAPI (`php artisan scramble:export --path=storage/openapi.generated.json`) y correr `python3 docs/kit/api/compare_contract.py backend/storage/openapi.generated.json --phase 3`; las rutas nuevas fuera del contrato deben agregarse a este registro. Cuando el registro esté vacío de rutas «Alinear», la CI puede correr con `--strict-extra`.

## Por módulo

### Seguridad y sesión · spec 00 (1)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /auth/invitations/{}` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |

### CRM · spec 01 (15)

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
| `POST /crm/cases/{}/reopen` | Acción propia | Reabrir un caso de postventa; la pantalla lo ofrece y el contrato no tiene esa transición. |
| `POST /crm/clients/{}/portal-access` | Acción propia | Invitar al cliente a su portal: crea o reutiliza el usuario con rol `customer`, lo vincula por `iam_users.client_id` (spec 08 §3.15, PCL-BR-01) y le envía la invitación de `auth/invitations`. El contrato solo tiene la invitación del personal (`POST /iam/users`, `admin.users.manage`); esta va bajo el cliente con `crm.clients.manage` y respeta la cartera del asesor. Exige Idempotency-Key. |
| `POST /crm/clients/{}/portal-access/resend` | Acción propia | Reenviar la invitación al portal mientras el cliente no la acepta; equivale a `POST /iam/users/{id}/resend-invitation` con el permiso de clientes. |
| `POST /crm/clients/{}/portal-access/revoke` | Acción propia | Revocar el acceso al portal: desactiva el usuario sin borrarlo, cierra sus sesiones y vence la invitación pendiente. El estado se lee en `GET /crm/clients/{code}` (`portal_access`). |

### Catálogo · spec 02 (10)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /catalog/availability` | Lectura de pantalla | Vista de disponibilidad de todos los productos en una pantalla; el contrato la da producto por producto. |
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

### Finanzas · spec 07 (7)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `POST /finance/commissions/{}/annul` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `PATCH /finance/payables/{}` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/payables/{}/cancel` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/payments/{}/confirm` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/receivables/{}/cancel` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
| `POST /finance/fx-rates` | Acción propia | Registro manual del tipo de cambio del día desde Finanzas; el contrato solo lo lee. |
| `POST /finance/payables` | Acción propia | Registro de un costo adicional del proveedor sobre una reserva (FIN-BR-23). |

### Canales y portales · spec 08 (17)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
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

### Administración y reportes · spec 09 (10)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
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

### Plataforma SaaS y API · spec 13 (29)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /platform/branding` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
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

### Sitio web público · spec 15 (2)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `GET /public/form-options` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |
| `GET /public/home` | Lectura de pantalla | Lectura agregada para pintar una pantalla en una sola llamada (inicio de portal, opciones de formulario, sesión, contadores, resúmenes). |

### Reseñas · spec 18 (1)

| Ruta | Grupo | Equivalente en el contrato o motivo |
| --- | --- | --- |
| `PUT /channels/external-reviews/{}/reply` | Editar, borrar o cambiar estado | Editar, borrar o cambiar de estado un registro. Lo exige el criterio de CRUD completo de la jefatura y el contrato no siempre lo incluye. |
