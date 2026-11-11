# Índice de endpoints — KipuControl API v1.0.0

> Generado por `build_openapi.py` desde la §6 de las 19 especificaciones. No editar a mano.

## Resumen

- **Operaciones únicas (método + ruta):** 1006 (de 1044 filas expandidas en las §6; 38 repeticiones deduplicadas).
- **Paths:** 852 · **Esquemas de tabla (§3):** 168 (de 168 tablas detectadas).
- **Por método:** GET 375 · POST 484 · PUT 41 · PATCH 54 · DELETE 52
- **Idempotency-Key:** 153 obligatorias · 3 recomendadas · 8 webhooks (idempotentes por id de evento del proveedor, sin header).
- **If-Match (lock_version):** 194
- **Autenticación:** customer 12 · platform 36 · public 77 · sanctum 872 · verify-token 1 · webhook 8
- **Listados con parámetros estándar** (`filter`, `sort`, `include`, `page[size]`, `page[cursor]`): 143
- **Aceptan API key / OAuth del tenant (scopes):** 35

| Fase | Operaciones | GET | POST | PUT | PATCH | DELETE |
|---|---:|---:|---:|---:|---:|---:|
| Fase 0 · Fundaciones | 84 | 29 | 40 | 2 | 7 | 6 |
| Fase 1 · MVP | 411 | 151 | 198 | 14 | 23 | 25 |
| Fase 2 · Canales y campo | 371 | 147 | 179 | 15 | 17 | 13 |
| Fase 3 · SaaS y crecimiento | 140 | 48 | 67 | 10 | 7 | 8 |
| **Total** | **1006** | **375** | **484** | **41** | **54** | **52** |

| Módulo (tag) | F0 | F1 | F2 | F3 | Total |
|---|---:|---:|---:|---:|---:|
| Núcleo | 19 | 0 | 0 | 0 | 19 |
| CRM | 0 | 54 | 0 | 0 | 54 |
| Catálogo | 0 | 135 | 0 | 0 | 135 |
| Cotizaciones | 0 | 29 | 0 | 0 | 29 |
| Reservas | 0 | 32 | 6 | 0 | 38 |
| Operaciones y móvil | 0 | 67 | 23 | 0 | 90 |
| Extranet de proveedores | 0 | 0 | 34 | 0 | 34 |
| Finanzas | 0 | 43 | 22 | 0 | 65 |
| Canales y portales | 0 | 20 | 80 | 0 | 100 |
| Administración y reportes | 65 | 6 | 0 | 1 | 72 |
| Aprobaciones e inbox | 0 | 0 | 35 | 0 | 35 |
| Cupos y documentos de viaje | 0 | 0 | 29 | 0 | 29 |
| Tesorería y reclamaciones | 0 | 16 | 22 | 0 | 38 |
| Plataforma SaaS y API | 0 | 0 | 0 | 62 | 62 |
| Marketing y metas | 0 | 0 | 0 | 50 | 50 |
| Sitio web público | 0 | 0 | 61 | 2 | 63 |
| Motor de reservas | 0 | 9 | 20 | 0 | 29 |
| Reglas, comunicaciones y monedas | 0 | 0 | 39 | 9 | 48 |
| Reseñas propias | 0 | 0 | 0 | 16 | 16 |

Leyenda: 🔑 `Idempotency-Key` obligatoria · (🔑) recomendada · 🪝 webhook idempotente por id de evento · 🔒 `If-Match` · 🌐 pública (`/public` con clave de widget o sin auth) · 🧩 acepta API key/OAuth con scope.

## Fase 0 · Fundaciones

### Núcleo (19)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/access-requests` | autenticado back-office | 00 §6 |  |
| POST | `/api/v1/auth/invitations/{token}/accept` | público \| público (token) | 00 §6, 09 §6.2 | 🔑 🌐 |
| POST | `/api/v1/auth/login` | público | 00 §6 | 🌐 |
| POST | `/api/v1/auth/logout` | autenticado | 00 §6 |  |
| POST | `/api/v1/auth/mfa/verify` | token mfa:verify | 00 §6 |  |
| POST | `/api/v1/auth/password/forgot` | público | 00 §6 | 🌐 |
| POST | `/api/v1/auth/password/reset` | público | 00 §6 | 🌐 |
| GET | `/api/v1/me` | autenticado | 00 §6 |  |
| GET | `/api/v1/me/access` | autenticado | 00 §6 |  |
| DELETE | `/api/v1/me/mfa` | autenticado | 00 §6 |  |
| POST | `/api/v1/me/mfa/confirm` | autenticado | 00 §6 |  |
| POST | `/api/v1/me/mfa/enroll` | autenticado | 00 §6 |  |
| GET | `/api/v1/me/notifications` | autenticado | 00 §6 |  |
| POST | `/api/v1/me/notifications/read-all` | autenticado | 00 §6 |  |
| GET | `/api/v1/me/permissions` | autenticado | 00 §6 |  |
| GET | `/api/v1/me/tenant` | autenticado back-office | 00 §6 |  |
| POST | `/api/v1/platform/auth/login` | público | 00 §6 | 🌐 |
| POST | `/api/v1/platform/auth/mfa/verify` | público | 00 §6 | 🌐 |
| GET | `/api/v1/search` | autenticado back-office | 00 §6 |  |

### Administración y reportes (65)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/audit-events` | admin.audit.view \| admin.roles.manage | 09 §6.3, 09 §6.7 |  |
| POST | `/api/v1/audit-events/exports` | admin.audit.view | 09 §6.7 | 🔑 |
| GET | `/api/v1/audit-events/{id}` | admin.audit.view | 09 §6.7 |  |
| GET | `/api/v1/iam/access-map` | admin.roles.manage | 09 §6.3 |  |
| GET | `/api/v1/iam/permissions` | admin.roles.manage | 09 §6.3 |  |
| GET | `/api/v1/iam/role-permissions` | admin.roles.manage | 09 §6.3 |  |
| GET | `/api/v1/iam/roles` | admin.roles.manage | 09 §6.3 |  |
| POST | `/api/v1/iam/roles` | admin.roles.manage | 09 §6.3 |  |
| PATCH | `/api/v1/iam/roles/{id}` | admin.roles.manage | 09 §6.3 |  |
| DELETE | `/api/v1/iam/roles/{id}` | admin.roles.manage | 09 §6.3 |  |
| POST | `/api/v1/iam/roles/{id}/permissions/bulk` | admin.roles.manage | 09 §6.3 |  |
| PUT | `/api/v1/iam/roles/{id}/permissions/{permission}` | admin.roles.manage | 09 §6.3 |  |
| DELETE | `/api/v1/iam/roles/{id}/permissions/{permission}` | admin.roles.manage | 09 §6.3 |  |
| GET | `/api/v1/iam/sedes` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/sedes` | admin.users.manage | 09 §6.2 |  |
| PATCH | `/api/v1/iam/sedes/{id}` | admin.users.manage | 09 §6.2 | 🔒 |
| DELETE | `/api/v1/iam/sedes/{id}` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/sedes/{id}/activate` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/sedes/{id}/deactivate` | admin.users.manage | 09 §6.2 |  |
| GET | `/api/v1/iam/users` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/users` | admin.users.manage | 09 §6.2 | 🔑 |
| GET | `/api/v1/iam/users/{id}` | admin.users.manage | 09 §6.2 |  |
| PATCH | `/api/v1/iam/users/{id}` | admin.users.manage | 09 §6.2 | 🔒 |
| POST | `/api/v1/iam/users/{id}/activate` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/users/{id}/deactivate` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/users/{id}/resend-invitation` | admin.users.manage | 09 §6.2 |  |
| POST | `/api/v1/iam/users/{id}/reset-mfa` | admin.users.manage | 09 §6.2 |  |
| GET | `/api/v1/integration-errors` | admin.settings.manage \| SA o dueño con reports.export | 09 §6.6 |  |
| POST | `/api/v1/integration-errors/{id}/resolve` | admin.settings.manage \| SA o dueño con reports.export | 09 §6.6 |  |
| POST | `/api/v1/integration-errors/{id}/retry` | admin.settings.manage \| SA o dueño con reports.export | 09 §6.6 |  |
| GET | `/api/v1/integrations` | admin.settings.manage \| SA | 09 §6.6 |  |
| PATCH | `/api/v1/integrations/{id}/config` | admin.settings.manage \| SA | 09 §6.6 |  |
| POST | `/api/v1/integrations/{id}/test` | admin.settings.manage \| SA | 09 §6.6 |  |
| GET | `/api/v1/jobs` | admin.settings.manage \| SA | 09 §6.6 |  |
| DELETE | `/api/v1/jobs/{id}` | admin.settings.manage \| SA o dueño con reports.export | 09 §6.6 |  |
| POST | `/api/v1/jobs/{id}/pause` | admin.settings.manage \| SA | 09 §6.6 |  |
| POST | `/api/v1/jobs/{id}/resume` | admin.settings.manage \| SA | 09 §6.6 |  |
| POST | `/api/v1/jobs/{id}/run` | admin.settings.manage \| SA | 09 §6.6 | 🔑 |
| GET | `/api/v1/notifications/messages` | admin.settings.manage | 09 §6.5 |  |
| POST | `/api/v1/notifications/messages/retry-failed` | admin.settings.manage | 09 §6.5 |  |
| POST | `/api/v1/notifications/messages/{id}/fallback` | admin.settings.manage | 09 §6.5 |  |
| POST | `/api/v1/notifications/messages/{id}/retry` | admin.settings.manage | 09 §6.5 |  |
| GET | `/api/v1/notifications/rules` | admin.settings.manage | 09 §6.5 |  |
| PATCH | `/api/v1/notifications/rules/{event}` | admin.settings.manage | 09 §6.5 |  |
| POST | `/api/v1/notifications/rules/{event}/test` | admin.settings.manage | 09 §6.5 |  |
| GET | `/api/v1/notifications/templates/{event}/{channel}` | admin.settings.manage | 09 §6.5 |  |
| PUT | `/api/v1/notifications/templates/{event}/{channel}` | admin.settings.manage | 09 §6.5 |  |
| DELETE | `/api/v1/notifications/templates/{event}/{channel}` | admin.settings.manage | 09 §6.5 |  |
| POST | `/api/v1/notifications/templates/{event}/{channel}/test` | admin.settings.manage | 09 §6.5 |  |
| GET | `/api/v1/platform/audit-events` | admin.audit.view (guard platform) | 09 §6.1 |  |
| GET | `/api/v1/platform/plans` | admin.tenant.manage | 09 §6.1 |  |
| GET | `/api/v1/platform/tenants` | admin.tenant.manage | 09 §6.1 |  |
| POST | `/api/v1/platform/tenants` | admin.tenant.manage | 09 §6.1 | 🔑 |
| GET | `/api/v1/platform/tenants/health` | admin.tenant.manage | 09 §6.1 |  |
| POST | `/api/v1/platform/tenants/validate-step` | admin.tenant.manage | 09 §6.1 |  |
| GET | `/api/v1/platform/tenants/{id}` | admin.tenant.manage | 09 §6.1 |  |
| POST | `/api/v1/platform/tenants/{id}/change-plan` | admin.tenant.manage | 09 §6.1 | 🔒 |
| POST | `/api/v1/platform/tenants/{id}/reactivate` | admin.tenant.manage \| super_admin | 09 §6.1, 13 §6 | 🔒 |
| POST | `/api/v1/platform/tenants/{id}/suspend` | admin.tenant.manage \| super_admin | 09 §6.1, 13 §6 | 🔒 |
| GET | `/api/v1/settings` | admin.settings.manage (lectura parcial pública para el resto vía /me/tenant) | 09 §6.4 |  |
| GET | `/api/v1/settings/fx-rates` | admin.settings.manage, finance.treasury | 09 §6.4 |  |
| GET | `/api/v1/settings/sequences` | admin.settings.manage | 09 §6.4 |  |
| POST | `/api/v1/settings/sequences` | admin.settings.manage | 09 §6.4 |  |
| PATCH | `/api/v1/settings/sequences` | admin.settings.manage | 09 §6.4 |  |
| PATCH | `/api/v1/settings/{section}` | admin.settings.manage | 09 §6.4 | 🔒 |

## Fase 1 · MVP

### CRM (54)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/crm/activities` | crm.activities.manage + own | 01 §6.3 |  |
| POST | `/api/v1/crm/activities` | crm.activities.manage | 01 §6.3 |  |
| GET | `/api/v1/crm/activities/related-options` | crm.activities.manage | 01 §6.3 |  |
| GET | `/api/v1/crm/activities/{code}` | crm.activities.manage + own | 01 §6.3 |  |
| POST | `/api/v1/crm/activities/{code}/complete` | crm.activities.manage + own | 01 §6.3 | 🔑 |
| POST | `/api/v1/crm/activities/{code}/reassign` | crm.records.reassign | 01 §6.3 |  |
| POST | `/api/v1/crm/activities/{code}/reschedule` | crm.activities.manage + own | 01 §6.3 |  |
| GET | `/api/v1/crm/after-sales/trips` | crm.clients.manage + own | 01 §6.5 |  |
| GET | `/api/v1/crm/cases` | crm.clients.manage + own | 01 §6.5 |  |
| POST | `/api/v1/crm/cases` | crm.clients.manage | 01 §6.5 | 🔑 |
| GET | `/api/v1/crm/cases/{code}` | crm.clients.manage + own | 01 §6.5 |  |
| POST | `/api/v1/crm/cases/{code}/close` | crm.clients.manage | 01 §6.5 | 🔒 |
| POST | `/api/v1/crm/cases/{code}/follow-ups` | crm.clients.manage | 01 §6.5 |  |
| POST | `/api/v1/crm/cases/{code}/resolve` | crm.clients.manage | 01 §6.5 | 🔒 |
| POST | `/api/v1/crm/cases/{code}/start` | crm.clients.manage + CRM-BR-44 | 01 §6.5 | 🔒 |
| GET | `/api/v1/crm/clients` | crm.clients.manage \| finance.receivables (+ own) | 01 §6.4 | 🧩 `crm:read` |
| POST | `/api/v1/crm/clients` | crm.clients.manage | 01 §6.4 | 🧩 `crm:write` |
| GET | `/api/v1/crm/clients/duplicates` | crm.clients.manage | 01 §6.4 |  |
| GET | `/api/v1/crm/clients/{code}` | crm.clients.manage \| finance.receivables + own | 01 §6.4 | 🧩 `crm:read` |
| PATCH | `/api/v1/crm/clients/{code}` | crm.clients.manage + own | 01 §6.4 | 🧩 `crm:write` |
| POST | `/api/v1/crm/clients/{code}/communications` | crm.clients.manage | 01 §6.4 | 🔑 |
| POST | `/api/v1/crm/clients/{code}/contacts` | crm.clients.manage + own | 01 §6.4 |  |
| POST | `/api/v1/crm/clients/{code}/contacts/{id}/make-primary` | crm.clients.manage | 01 §6.4 |  |
| GET | `/api/v1/crm/clients/{code}/invoices/{id}/preview` | crm.clients.manage \| finance.receivables + own | 01 §6.4 |  |
| POST | `/api/v1/crm/clients/{code}/reassign` | crm.records.reassign | 01 §6.4 |  |
| GET | `/api/v1/crm/clients/{code}/rebuy-proposal` | crm.opportunities.manage + own | 01 §6.5 |  |
| GET | `/api/v1/crm/clients/{code}/vouchers/{id}/preview` | crm.clients.manage \| finance.receivables + own | 01 §6.4 |  |
| GET | `/api/v1/crm/clients/{code}/{tab}` | crm.clients.manage \| finance.receivables + own | 01 §6.4 |  |
| GET | `/api/v1/crm/leads` | crm.leads.view | 01 §6.1 | 🧩 `crm:read` |
| POST | `/api/v1/crm/leads` | crm.leads.manage | 01 §6.1 | (🔑) 🧩 `crm:write` |
| GET | `/api/v1/crm/leads/duplicates` | crm.leads.manage | 01 §6.1 |  |
| GET | `/api/v1/crm/leads/{code}` | crm.leads.view + own (o sin asignar) | 01 §6.1 | 🧩 `crm:read` |
| PATCH | `/api/v1/crm/leads/{code}` | crm.leads.manage + propietario | 01 §6.1 | 🔒 🧩 `crm:write` |
| POST | `/api/v1/crm/leads/{code}/assign` | crm.records.reassign | 01 §6.1 | 🔒 |
| POST | `/api/v1/crm/leads/{code}/convert` | crm.leads.manage + crm.opportunities.manage + propietario | 01 §6.1 | 🔑 |
| POST | `/api/v1/crm/leads/{code}/discard` | crm.leads.manage | 01 §6.1 | 🔒 |
| POST | `/api/v1/crm/leads/{code}/mark-duplicate` | crm.leads.manage | 01 §6.1 | 🔒 |
| POST | `/api/v1/crm/leads/{code}/merge` | crm.leads.manage | 01 §6.1 |  |
| POST | `/api/v1/crm/leads/{code}/qualify` | crm.leads.manage | 01 §6.1 | 🔒 |
| POST | `/api/v1/crm/leads/{code}/reopen` | crm.leads.manage | 01 §6.1 | 🔒 |
| POST | `/api/v1/crm/leads/{code}/status` | crm.leads.manage + propietario | 01 §6.1 | 🔒 |
| POST | `/api/v1/crm/leads/{code}/take` | crm.leads.manage | 01 §6.1 |  |
| GET | `/api/v1/crm/loyalty/segments` | crm.clients.manage + own | 01 §6.5 |  |
| GET | `/api/v1/crm/opportunities` | crm.opportunities.manage + own | 01 §6.2 | 🧩 `crm:read` |
| POST | `/api/v1/crm/opportunities` | crm.opportunities.manage | 01 §6.2 | (🔑) |
| GET | `/api/v1/crm/opportunities/{code}` | crm.opportunities.manage + own | 01 §6.2 | 🧩 `crm:read` |
| PATCH | `/api/v1/crm/opportunities/{code}` | crm.opportunities.manage + own | 01 §6.2 | 🔒 |
| POST | `/api/v1/crm/opportunities/{code}/reassign` | crm.records.reassign | 01 §6.2 | 🔒 |
| POST | `/api/v1/crm/opportunities/{code}/stage` | crm.opportunities.manage + own | 01 §6.2 | 🔒 |
| GET | `/api/v1/crm/pipeline-stages` | crm.opportunities.manage | 01 §6.2 |  |
| GET | `/api/v1/crm/surveys` | crm.clients.manage | 01 §6.5 |  |
| POST | `/api/v1/crm/surveys` | crm.clients.manage | 01 §6.5 | 🔑 |
| GET | `/api/v1/dashboard/sales` | rol con crm.leads.view y alcance own | 01 §6.6 |  |
| POST | `/api/v1/exports` | según recurso (reports.export no es requerido hoy en CRM, ver §12) | 01 §6.6 |  |

### Catálogo (135)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/catalog/categories` | catalog.products.view | 02 §6.5 |  |
| POST | `/api/v1/catalog/categories` | catalog.products.update | 02 §6.5 |  |
| DELETE | `/api/v1/catalog/categories/{id}` | catalog.products.update | 02 §6.5 |  |
| POST | `/api/v1/catalog/categories/{id}/subcategories` | catalog.products.update | 02 §6.5 |  |
| DELETE | `/api/v1/catalog/categories/{id}/subcategories/{subId}` | catalog.products.update | 02 §6.5 |  |
| GET | `/api/v1/catalog/departures` | catalog.products.view | 02 §6.3 | 🧩 `availability:read` |
| POST | `/api/v1/catalog/departures` | catalog.products.manage_availability | 02 §6.3 | 🔑 |
| GET | `/api/v1/catalog/departures/{id}` | catalog.products.view | 02 §6.3 |  |
| POST | `/api/v1/catalog/departures/{id}/confirm-seats` | catalog.products.manage_availability | 02 §6.3 | 🔑 🔒 |
| GET | `/api/v1/catalog/destinations` | catalog.products.view | 02 §6.5 |  |
| POST | `/api/v1/catalog/destinations` | catalog.products.update | 02 §6.5 |  |
| GET | `/api/v1/catalog/destinations/{id}` | catalog.products.view | 02 §6.5 |  |
| PATCH | `/api/v1/catalog/destinations/{id}` | catalog.products.update | 02 §6.5 |  |
| DELETE | `/api/v1/catalog/destinations/{id}` | catalog.products.update | 02 §6.5 |  |
| GET | `/api/v1/catalog/holds` | catalog.products.view | 02 §6.3 |  |
| POST | `/api/v1/catalog/holds` | catalog.products.manage_availability | 02 §6.3 | 🔑 🔒 |
| POST | `/api/v1/catalog/holds/expire` | catalog.products.manage_availability | 02 §6.3 |  |
| POST | `/api/v1/catalog/holds/{id}/confirm` | catalog.products.manage_availability | 02 §6.3 | 🔒 |
| POST | `/api/v1/catalog/holds/{id}/consume` | catalog.products.manage_availability | 02 §6.3 | 🔒 |
| POST | `/api/v1/catalog/holds/{id}/release` | catalog.products.manage_availability | 02 §6.3 | 🔒 |
| GET | `/api/v1/catalog/price-rules` | catalog.products.view_profitability ∨ catalog.products.manage_rates | 02 §6.4 |  |
| POST | `/api/v1/catalog/price-rules` | catalog.products.manage_rates | 02 §6.4 |  |
| POST | `/api/v1/catalog/price-rules/{id}/activate` | catalog.products.manage_rates | 02 §6.4 |  |
| POST | `/api/v1/catalog/price-rules/{id}/deactivate` | catalog.products.manage_rates | 02 §6.4 |  |
| POST | `/api/v1/catalog/pricing/simulate` | catalog.products.view_profitability ∨ catalog.products.manage_rates | 02 §6.4 |  |
| GET | `/api/v1/catalog/product-types` | catalog.products.view | 02 §6.5 |  |
| POST | `/api/v1/catalog/product-types` | catalog.products.update | 02 §6.5 |  |
| DELETE | `/api/v1/catalog/product-types/{id}` | catalog.products.update | 02 §6.5 |  |
| GET | `/api/v1/catalog/products` | catalog.products.view | 02 §6.1 | 🧩 `catalog:read` |
| POST | `/api/v1/catalog/products` | catalog.products.create | 02 §6.1 | 🔑 |
| GET | `/api/v1/catalog/products/export` | catalog.products.view (+ ver §12 export) | 02 §6.1 |  |
| GET | `/api/v1/catalog/products/kpis` | catalog.products.view | 02 §6.1 |  |
| GET | `/api/v1/catalog/products/{id}` | catalog.products.view | 02 §6.1 | 🧩 `catalog:read` |
| PATCH | `/api/v1/catalog/products/{id}` | catalog.products.update | 02 §6.1 | 🔒 |
| DELETE | `/api/v1/catalog/products/{id}` | catalog.products.activate | 02 §6.1 | 🔒 |
| POST | `/api/v1/catalog/products/{id}/activate` | catalog.products.activate | 02 §6.1 | 🔒 |
| GET | `/api/v1/catalog/products/{id}/activation-checklist` | catalog.products.view | 02 §6.1 |  |
| POST | `/api/v1/catalog/products/{id}/approve` | catalog.products.activate | 02 §6.1 | 🔒 |
| POST | `/api/v1/catalog/products/{id}/archive` | catalog.products.activate | 02 §6.1 | 🔒 |
| GET | `/api/v1/catalog/products/{id}/audit` | catalog.products.update ∨ catalog.products.view_profitability ∨ admin.audit.view | 02 §6.1 |  |
| GET | `/api/v1/catalog/products/{id}/availability` | catalog.products.view | 02 §6.2, 16 §6.2 | 🧩 `availability:read` |
| PUT | `/api/v1/catalog/products/{id}/availability` | catalog.products.manage_availability | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/b2b-rates` | net-visible | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/b2b-rates` | catalog.products.update | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/b2b-rates/{agencyId}` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/b2b-rates/{agencyId}` | catalog.products.update \| channels.b2b.manage \| catalog.products.manage_b2b | 02 §6.2, 08 §6.1 |  |
| GET | `/api/v1/catalog/products/{id}/channels` | catalog.products.view | 02 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/channels/{channel}` | catalog.products.publish | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/components` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/components` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/components/reorder` | catalog.products.update | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/components/{componentId}` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/components/{componentId}` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/config-groups` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/config-groups` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/config-groups/{groupId}` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/content` | catalog.products.view | 02 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/content` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/deactivate` | catalog.products.activate | 02 §6.1 | 🔒 |
| GET | `/api/v1/catalog/products/{id}/departures` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/departures` | catalog.products.manage_availability | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/departures/{departureId}` | catalog.products.manage_availability | 02 §6.2 | 🔒 |
| POST | `/api/v1/catalog/products/{id}/duplicate` | catalog.products.create | 02 §6.1 | 🔑 |
| POST | `/api/v1/catalog/products/{id}/faqs` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/faqs/{faqId}` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/inclusions` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/inclusions` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/inclusions/{incId}` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/itineraries` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/itineraries/{itId}/days` | catalog.products.update | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/itineraries/{itId}/days/{dayId}` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/itineraries/{itId}/days/{dayId}` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/itineraries/{itId}/days/{dayId}/items` | catalog.products.update | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/itineraries/{itId}/days/{dayId}/items/{itemId}` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/itineraries/{itId}/days/{dayId}/items/{itemId}` | catalog.products.update | 02 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/main-provider` | catalog.products.update | 02 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/markup` | catalog.products.manage_rates | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/media` | catalog.products.update | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/media/{mediaId}` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/media/{mediaId}` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/policies` | catalog.products.view | 02 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/policies` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/price-quote` | catalog.products.view | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/profitability` | catalog.products.view_profitability | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/promotions` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/promotions` | catalog.products.update \| channels.ecommerce.manage \| catalog.products.manage_promotions | 02 §6.2, 08 §6.3 |  |
| DELETE | `/api/v1/catalog/products/{id}/promotions/{promoId}` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/promotions/{promoId}/activate` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/promotions/{promoId}/pause` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/providers` | catalog.products.view + ver costos | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/rates` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/rates` | catalog.products.manage_rates | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/rates/resolve` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/rates/{rateId}/activate` | catalog.products.manage_rates | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/rates/{rateId}/deactivate` | catalog.products.manage_rates | 02 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/rates/{rateId}/price` | catalog.products.manage_rates | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/related` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/related` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/related/{relId}` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/requirements` | catalog.products.update | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/requirements/{reqId}` | catalog.products.update | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/return-to-draft` | catalog.products.activate | 02 §6.1 | 🔒 |
| GET | `/api/v1/catalog/products/{id}/seasons` | catalog.products.view | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/seasons` | catalog.products.manage_rates | 02 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/seasons/{seasonId}` | catalog.products.manage_rates | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/sheet` | catalog.products.view | 02 §6.1 | 🔑 |
| POST | `/api/v1/catalog/products/{id}/submit-review` | catalog.products.update | 02 §6.1 | 🔒 |
| POST | `/api/v1/catalog/products/{id}/suspend` | catalog.products.activate | 02 §6.1 | 🔒 |
| GET | `/api/v1/catalog/products/{id}/usage` | catalog.products.view | 02 §6.1 |  |
| GET | `/api/v1/catalog/products/{id}/versions` | catalog.products.update ∨ catalog.products.view_profitability | 02 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/versions` | catalog.products.update | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/versions/compare` | catalog.products.update ∨ catalog.products.view_profitability | 02 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/versions/{versionId}` | catalog.products.update ∨ catalog.products.view_profitability | 02 §6.2 |  |
| GET | `/api/v1/catalog/providers` | catalog.providers.manage ∨ finance.payables ∨ catalog.products.update | 02 §6.5 |  |
| POST | `/api/v1/catalog/providers` | catalog.providers.manage | 02 §6.5 |  |
| GET | `/api/v1/catalog/providers/{id}` | catalog.providers.manage ∨ finance.payables ∨ catalog.products.update | 02 §6.5 |  |
| PATCH | `/api/v1/catalog/providers/{id}` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/providers/{id}/activate` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/providers/{id}/contacts` | catalog.providers.manage | 02 §6.5 |  |
| DELETE | `/api/v1/catalog/providers/{id}/contacts/{contactId}` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/providers/{id}/deactivate` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/providers/{id}/rating` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/providers/{id}/renew-contract` | catalog.providers.manage | 02 §6.5 |  |
| GET | `/api/v1/catalog/rates` | catalog.products.view | 02 §6.4 |  |
| GET | `/api/v1/catalog/seasons` | catalog.products.view | 02 §6.4 |  |
| POST | `/api/v1/catalog/seasons` | catalog.products.manage_rates | 02 §6.4 |  |
| GET | `/api/v1/catalog/seasons/resolve` | catalog.products.view | 02 §6.4 |  |
| PATCH | `/api/v1/catalog/seasons/{id}` | catalog.products.manage_rates | 02 §6.4 |  |
| DELETE | `/api/v1/catalog/seasons/{id}` | catalog.products.manage_rates | 02 §6.4 |  |
| GET | `/api/v1/catalog/services` | catalog.products.view | 02 §6.5 |  |
| POST | `/api/v1/catalog/services` | catalog.providers.manage | 02 §6.5 |  |
| GET | `/api/v1/catalog/services/{id}` | catalog.products.view | 02 §6.5 |  |
| PATCH | `/api/v1/catalog/services/{id}` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/services/{id}/activate` | catalog.providers.manage | 02 §6.5 |  |
| POST | `/api/v1/catalog/services/{id}/deactivate` | catalog.providers.manage | 02 §6.5 |  |

### Cotizaciones (29)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/catalog/products/quoteable` | quotes.create | 03 §6 |  |
| GET | `/api/v1/catalog/products/{id}/rate-suggestion` | quotes.create | 03 §6 |  |
| GET | `/api/v1/public/quotes/{token}` | público (token) | 03 §6 | 🌐 |
| POST | `/api/v1/public/quotes/{token}/approve` | público (token) + login cliente | 03 §6 | 🔑 🌐 |
| POST | `/api/v1/public/quotes/{token}/reject` | público (token) + login cliente | 03 §6 | 🔑 🌐 |
| GET | `/api/v1/quotes` | quotes.view | 03 §6 | 🧩 `quotes:read` |
| POST | `/api/v1/quotes` | quotes.create | 03 §6 | (🔑) 🧩 `quotes:write` |
| GET | `/api/v1/quotes/kpis` | quotes.view | 03 §6 |  |
| POST | `/api/v1/quotes/pricing/preview` | quotes.create | 03 §6 |  |
| GET | `/api/v1/quotes/{id}` | quotes.view | 03 §6 | 🧩 `quotes:read` |
| GET | `/api/v1/quotes/{id}/activity` | quotes.view | 03 §6 |  |
| POST | `/api/v1/quotes/{id}/approve` | reservations.create | 03 §6 | 🔑 🔒 |
| GET | `/api/v1/quotes/{id}/conversion-preview` | reservations.create | 03 §6, 04 §6 |  |
| POST | `/api/v1/quotes/{id}/convert` | reservations.create | 03 §6, 04 §6 | 🔑 🔒 |
| POST | `/api/v1/quotes/{id}/duplicate` | quotes.create | 03 §6 | 🔑 |
| POST | `/api/v1/quotes/{id}/internal-approval-requests` | quotes.create o quotes.send (+ dueño) | 03 §6 |  |
| POST | `/api/v1/quotes/{id}/negotiations` | quotes.send | 03 §6 |  |
| POST | `/api/v1/quotes/{id}/reassign` | quotes.reassign (nuevo) | 03 §6 | 🔒 |
| POST | `/api/v1/quotes/{id}/reject` | quotes.send | 03 §6 | 🔒 |
| POST | `/api/v1/quotes/{id}/send` | quotes.send | 03 §6 | 🔑 🔒 |
| POST | `/api/v1/quotes/{id}/token` | quotes.send | 03 §6 |  |
| GET | `/api/v1/quotes/{id}/versions` | quotes.view | 03 §6 |  |
| POST | `/api/v1/quotes/{id}/versions` | quotes.create | 03 §6 | 🔒 🧩 `quotes:write` |
| GET | `/api/v1/quotes/{id}/versions/compare` | quotes.view | 03 §6 |  |
| GET | `/api/v1/quotes/{id}/versions/{v}` | quotes.view | 03 §6 |  |
| PUT | `/api/v1/quotes/{id}/versions/{v}` | quotes.create | 03 §6 | 🔒 |
| POST | `/api/v1/quotes/{id}/versions/{v}/internal-approval` | quotes.approve_internal (+ quotes.discount_override si > 10 %) \| quotes.approve_internal | 03 §6, 09 §6.7 | 🔒 |
| POST | `/api/v1/quotes/{id}/versions/{v}/pdf` | quotes.view | 03 §6 |  |
| POST | `/api/v1/quotes/{id}/views` | quotes.send | 03 §6 |  |

### Reservas (32)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/reservations` | reservations.view | 04 §6 | 🧩 `reservations:read` |
| POST | `/api/v1/reservations` | reservations.create | 04 §6 | 🔑 🧩 `reservations:write` |
| POST | `/api/v1/reservations/availability-check` | reservations.create | 04 §6 |  |
| GET | `/api/v1/reservations/kpis` | reservations.view | 04 §6 |  |
| GET | `/api/v1/reservations/occupancy` | reservations.view | 04 §6 |  |
| GET | `/api/v1/reservations/{id}` | reservations.view | 04 §6 | 🧩 `reservations:read` |
| POST | `/api/v1/reservations/{id}/cancel` | reservations.cancel | 04 §6 | 🔑 🔒 |
| POST | `/api/v1/reservations/{id}/cancel-requests` | reservations.create (dueño) | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/cancel-requests/{rid}/reject` | reservations.cancel | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/cancellation/preview` | reservations.cancel | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/changes` | reservations.modify | 04 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/changes/preview` | reservations.modify | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/changes/{cid}/approve` | quotes.approve_internal (propuesto reservations.approve_changes) | 04 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/changes/{cid}/reject` | quotes.approve_internal (propuesto reservations.approve_changes) | 04 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/complete` | reservations.modify | 04 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/confirm` | reservations.modify | 04 §6 | 🔒 |
| GET | `/api/v1/reservations/{id}/documents/confirmation` | reservations.view | 04 §6 |  |
| GET | `/api/v1/reservations/{id}/history` | reservations.view | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/operation-order` | operations.view | 04 §6 | 🔑 |
| POST | `/api/v1/reservations/{id}/passengers` | reservations.modify | 04 §6 | 🔒 |
| PUT | `/api/v1/reservations/{id}/passengers/{pid}` | reservations.modify | 04 §6 | 🔒 |
| PATCH | `/api/v1/reservations/{id}/passengers/{pid}` | reservations.modify | 04 §6 | 🔒 |
| DELETE | `/api/v1/reservations/{id}/passengers/{pid}` | reservations.modify | 04 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/reassign` | reservations.reassign (propuesto) | 04 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/receivables/generate` | finance.receivables | 04 §6 | 🔑 |
| POST | `/api/v1/reservations/{id}/reschedule` | reservations.modify | 04 §6 | 🔑 🔒 |
| POST | `/api/v1/reservations/{id}/reschedule/preview` | reservations.modify | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/services/request-pending` | reservations.modify | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/services/{sid}/confirm` | reservations.modify | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/services/{sid}/reject` | reservations.modify | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/services/{sid}/request` | reservations.modify | 04 §6 |  |
| POST | `/api/v1/reservations/{id}/start-operation` | reservations.modify | 04 §6 | 🔒 |

### Operaciones y móvil (67)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/ops/assignments` | operations.view | 05 §6.3 |  |
| POST | `/api/v1/ops/assignments/{id}/confirm` | operations.assign | 05 §6.3 | 🔒 |
| POST | `/api/v1/ops/assignments/{id}/release` | operations.assign | 05 §6.3 | 🔒 |
| PUT | `/api/v1/ops/assignments/{id}/resources` | operations.assign | 05 §6.3 | 🔒 |
| POST | `/api/v1/ops/assignments/{id}/validate` | operations.assign | 05 §6.3 |  |
| GET | `/api/v1/ops/calendar` | operations.view | 05 §6.3 |  |
| POST | `/api/v1/ops/evidences/presign` | operations.assign \| operations.incidents \| rol guide/driver | 05 §6.6 |  |
| DELETE | `/api/v1/ops/evidences/{id}` | operations.assign | 05 §6.6 |  |
| GET | `/api/v1/ops/incidents` | operations.view | 05 §6.6 |  |
| POST | `/api/v1/ops/incidents` | operations.incidents | 05 §6.6 | 🔑 |
| GET | `/api/v1/ops/incidents/{id}` | operations.view | 05 §6.6 |  |
| PATCH | `/api/v1/ops/incidents/{id}/assignee` | operations.incidents | 05 §6.6 | 🔒 |
| PATCH | `/api/v1/ops/incidents/{id}/classification` | operations.incidents | 05 §6.6 | 🔒 |
| POST | `/api/v1/ops/incidents/{id}/close` | operations.incidents | 05 §6.6 | 🔒 |
| POST | `/api/v1/ops/incidents/{id}/comments` | operations.incidents | 05 §6.6 |  |
| POST | `/api/v1/ops/incidents/{id}/evidences` | operations.incidents | 05 §6.6 |  |
| POST | `/api/v1/ops/incidents/{id}/reopen` | operations.incidents | 05 §6.6 | 🔒 |
| POST | `/api/v1/ops/incidents/{id}/resolve` | operations.incidents | 05 §6.6 | 🔒 |
| POST | `/api/v1/ops/incidents/{id}/take` | operations.incidents | 05 §6.6 | 🔒 |
| PATCH | `/api/v1/ops/order-tasks/{id}` | operations.assign | 05 §6.1 |  |
| DELETE | `/api/v1/ops/order-tasks/{id}` | operations.assign | 05 §6.1 |  |
| GET | `/api/v1/ops/orders` | operations.view | 05 §6.1 | 🧩 `operations:read` |
| POST | `/api/v1/ops/orders` | operations.assign | 05 §6.1 | 🔑 |
| GET | `/api/v1/ops/orders/candidates` | operations.assign | 05 §6.1 |  |
| GET | `/api/v1/ops/orders/kpis` | operations.view | 05 §6.1 |  |
| GET | `/api/v1/ops/orders/{id}` | operations.view | 05 §6.1, 05 §6.9 | 🧩 `operations:read` |
| POST | `/api/v1/ops/orders/{id}/assignments` | operations.assign | 05 §6.3 |  |
| POST | `/api/v1/ops/orders/{id}/close` | operations.close | 05 §6.1 | 🔑 🔒 |
| GET | `/api/v1/ops/orders/{id}/close-checks` | operations.view | 05 §6.1 |  |
| POST | `/api/v1/ops/orders/{id}/confirm` | operations.assign | 05 §6.1 | 🔒 |
| PATCH | `/api/v1/ops/orders/{id}/coordinator` | operations.assign | 05 §6.1 | 🔒 |
| GET | `/api/v1/ops/orders/{id}/cost-summary` | operations.view | 05 §6.1 |  |
| POST | `/api/v1/ops/orders/{id}/evidences` | operations.assign | 05 §6.6 | 🔑 |
| POST | `/api/v1/ops/orders/{id}/mark-assigned` | operations.assign | 05 §6.1 | 🔒 |
| POST | `/api/v1/ops/orders/{id}/start` | operations.assign | 05 §6.1 | 🔒 |
| POST | `/api/v1/ops/orders/{id}/tasks` | operations.assign | 05 §6.1 |  |
| POST | `/api/v1/ops/orders/{id}/to-assignment` | operations.assign | 05 §6.1 | 🔒 |
| POST | `/api/v1/ops/reservation-services/{id}/complete` | operations.assign | 05 §6.2 | 🔒 |
| POST | `/api/v1/ops/reservation-services/{id}/supplier-confirmation` | operations.assign | 05 §6.2 | 🔒 |
| POST | `/api/v1/ops/reservation-services/{id}/supplier-rejection` | operations.assign | 05 §6.2 | 🔒 |
| POST | `/api/v1/ops/reservation-services/{id}/supplier-request` | operations.assign | 05 §6.2 | 🔑 |
| GET | `/api/v1/ops/resources` | operations.view | 05 §6.3 |  |
| GET | `/api/v1/ops/resources/availability` | operations.view | 05 §6.3 |  |
| GET | `/api/v1/ops/resources/document-alerts` | operations.view | 05 §6.3 |  |
| GET | `/api/v1/ops/resources/{type}/{id}/agenda` | operations.view | 05 §6.3 |  |
| PATCH | `/api/v1/ops/resources/{type}/{id}/status` | operations.assign | 05 §6.3 |  |
| GET | `/api/v1/ops/rooming-lists` | operations.view | 05 §6.4 |  |
| POST | `/api/v1/ops/rooming-lists` | reservations.modify | 05 §6.4 |  |
| GET | `/api/v1/ops/rooming-lists/{id}` | operations.view | 05 §6.4 |  |
| POST | `/api/v1/ops/rooming-lists/{id}/confirm` | reservations.modify | 05 §6.4 | 🔒 |
| GET | `/api/v1/ops/rooming-lists/{id}/document` | operations.view | 05 §6.4 |  |
| POST | `/api/v1/ops/rooming-lists/{id}/rooms` | reservations.modify | 05 §6.4 | 🔒 |
| POST | `/api/v1/ops/rooming-lists/{id}/send` | reservations.modify | 05 §6.4 | 🔑 🔒 |
| POST | `/api/v1/ops/rooming-lists/{id}/validate` | reservations.modify | 05 §6.4 |  |
| PUT | `/api/v1/ops/rooming-rooms/{id}` | reservations.modify | 05 §6.4 | 🔒 |
| DELETE | `/api/v1/ops/rooming-rooms/{id}` | reservations.modify | 05 §6.4 | 🔒 |
| GET | `/api/v1/ops/supplier-requests` | operations.view | 05 §6.2 |  |
| GET | `/api/v1/ops/vouchers` | operations.view | 05 §6.5 | 🧩 `operations:read` |
| POST | `/api/v1/ops/vouchers` | operations.vouchers | 05 §6.5 | 🔑 |
| POST | `/api/v1/ops/vouchers/check` | operations.vouchers | 05 §6.5 |  |
| GET | `/api/v1/ops/vouchers/pending-issue` | operations.view | 05 §6.5 |  |
| GET | `/api/v1/ops/vouchers/{id}` | operations.view | 05 §6.5 | 🧩 `operations:read` |
| GET | `/api/v1/ops/vouchers/{id}/pdf` | operations.view | 05 §6.5 |  |
| POST | `/api/v1/ops/vouchers/{id}/redeem` | operations.vouchers | 05 §6.5 | 🔑 🔒 |
| POST | `/api/v1/ops/vouchers/{id}/resend` | operations.vouchers | 05 §6.5 | 🔑 |
| POST | `/api/v1/ops/vouchers/{id}/versions` | operations.vouchers | 05 §6.5 | 🔑 🔒 |
| POST | `/api/v1/ops/vouchers/{id}/void` | operations.vouchers | 05 §6.5 | 🔑 🔒 |

### Finanzas (43)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/finance/bank-accounts` | finance.payables o finance.payments.register | 07 §6.3 |  |
| GET | `/api/v1/finance/commission-rules` | finance.commissions | 07 §6.4 |  |
| GET | `/api/v1/finance/commissions` | finance.commissions | 07 §6.4 |  |
| POST | `/api/v1/finance/commissions/calculate` | finance.commissions + finance.payments.register | 07 §6.4 | 🔑 |
| GET | `/api/v1/finance/commissions/summary` | finance.commissions | 07 §6.4 |  |
| GET | `/api/v1/finance/commissions/{code}` | finance.commissions | 07 §6.4 |  |
| POST | `/api/v1/finance/commissions/{code}/approve` | finance.commissions | 07 §6.4 | 🔒 |
| POST | `/api/v1/finance/commissions/{code}/pay` | finance.commissions + finance.payments.register | 07 §6.4 | 🔑 🔒 |
| POST | `/api/v1/finance/commissions/{code}/recalculate` | finance.commissions + finance.payments.register | 07 §6.4 | 🔒 |
| POST | `/api/v1/finance/costs` | finance.payables + finance.payments.register | 07 §6.3 | 🔑 |
| POST | `/api/v1/finance/costs/preview` | finance.payables | 07 §6.3 |  |
| GET | `/api/v1/finance/dashboards/accounting` | finance.invoicing | 07 §6.8 |  |
| GET | `/api/v1/finance/dashboards/finance` | finance.receivables + rol finance | 07 §6.8 |  |
| GET | `/api/v1/finance/payables` | finance.payables | 07 §6.3 |  |
| GET | `/api/v1/finance/payables/by-provider` | finance.payables | 07 §6.3 |  |
| GET | `/api/v1/finance/payables/summary` | finance.payables | 07 §6.3 |  |
| GET | `/api/v1/finance/payables/{code}` | finance.payables | 07 §6.3 |  |
| POST | `/api/v1/finance/payables/{code}/approve` | finance.payables | 07 §6.3 | 🔒 |
| POST | `/api/v1/finance/payables/{code}/payouts` | finance.payables + finance.payments.register | 07 §6.3 | 🔑 🔒 |
| POST | `/api/v1/finance/payables/{code}/schedule` | finance.payables + finance.payments.register | 07 §6.3 | 🔒 |
| GET | `/api/v1/finance/payments` | finance.receivables o finance.payments.register | 07 §6.2 | 🧩 `payments:read` |
| POST | `/api/v1/finance/payments` | finance.payments.register | 04 §6, 07 §6.2 | 🔑 🔒 |
| GET | `/api/v1/finance/payments/{code}` | finance.receivables o finance.payments.register | 07 §6.2 | 🧩 `payments:read` |
| POST | `/api/v1/finance/payments/{code}/apply` | finance.payments.register | 07 §6.2 | 🔑 🔒 |
| POST | `/api/v1/finance/payments/{code}/reject` | finance.payments.register | 07 §6.2 | 🔒 |
| POST | `/api/v1/finance/payments/{code}/retry` | finance.payments.register | 07 §6.2 | 🔒 |
| POST | `/api/v1/finance/payments/{code}/revert` | finance.payments.revert | 07 §6.2 | 🔑 🔒 |
| POST | `/api/v1/finance/payments/{code}/validate` | finance.payments.register | 07 §6.2 | 🔑 🔒 |
| GET | `/api/v1/finance/period-closes/{period}` | finance.invoicing | 07 §6.8 |  |
| PUT | `/api/v1/finance/period-closes/{period}/checks/{check}` | finance.invoicing | 07 §6.8 | 🔒 |
| DELETE | `/api/v1/finance/period-closes/{period}/checks/{check}` | finance.invoicing | 07 §6.8 | 🔒 |
| POST | `/api/v1/finance/period-closes/{period}/close` | finance.invoicing | 07 §6.8 | 🔑 |
| GET | `/api/v1/finance/profitability` | finance.profitability | 07 §6.5 |  |
| GET | `/api/v1/finance/profitability/reservations` | finance.profitability | 07 §6.5 |  |
| GET | `/api/v1/finance/receivables` | finance.receivables | 07 §6.1 | 🧩 `payments:read` |
| POST | `/api/v1/finance/receivables/advances` | finance.payments.register | 07 §6.1 | 🔑 🔒 |
| GET | `/api/v1/finance/receivables/summary` | finance.receivables | 07 §6.1 |  |
| GET | `/api/v1/finance/receivables/{code}` | finance.receivables | 07 §6.1 | 🧩 `payments:read` |
| POST | `/api/v1/finance/receivables/{code}/reminders` | finance.payments.register | 07 §6.1 | 🔑 |
| GET | `/api/v1/finance/reservations/{code}/account` | finance.receivables | 07 §6.1 |  |
| POST | `/api/v1/finance/reservations/{code}/account-statement` | finance.payments.register | 07 §6.5 | 🔑 |
| GET | `/api/v1/finance/reservations/{code}/settlement` | finance.profitability | 07 §6.5 |  |
| POST | `/api/v1/finance/reservations/{code}/settlement` | finance.profitability + finance.payments.register | 07 §6.5 | 🔑 🔒 |

### Canales y portales (20)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/channels/portal-preview/clients` | channels.b2b.manage \| channels.cms.publish \| crm.clients.manage | 08 §6.5 |  |
| GET | `/api/v1/channels/portal-preview/clients/{clientId}/{portalPath}` | channels.b2b.manage \| channels.cms.publish \| crm.clients.manage | 08 §6.5 |  |
| GET | `/api/v1/portal/client/documents` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/home` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/notifications` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/payments` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/quotes` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/quotes/{code}` | customer | 08 §6.5 |  |
| POST | `/api/v1/portal/client/quotes/{code}/approve` | customer | 08 §6.5 | 🔑 🔒 |
| GET | `/api/v1/portal/client/quotes/{code}/pdf` | customer | 08 §6.5 |  |
| POST | `/api/v1/portal/client/quotes/{code}/reject` | customer | 08 §6.5 | 🔒 |
| POST | `/api/v1/portal/client/quotes/{code}/update-request` | customer | 08 §6.5 |  |
| POST | `/api/v1/portal/client/quotes/{code}/view` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/receivables` | customer | 08 §6.5 |  |
| POST | `/api/v1/portal/client/receivables/{id}/payments` | customer | 08 §6.5 | 🔑 |
| GET | `/api/v1/portal/client/reservations` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/reservations/{code}` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/reservations/{code}/itinerary.pdf` | customer | 08 §6.5 |  |
| GET | `/api/v1/portal/client/tickets` | customer | 08 §6.5 |  |
| POST | `/api/v1/portal/client/tickets` | customer | 08 §6.5 |  |

### Administración y reportes (6)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/dashboard/executive` | TA/MG (reports.view) | 09 §6.7 |  |
| GET | `/api/v1/dashboard/manager` | quotes.approve_internal \| approvals.view | 09 §6.7 |  |
| GET | `/api/v1/reports/exports` | reports.export | 09 §6.7 |  |
| POST | `/api/v1/reports/exports` | reports.export (o admin.audit.view para auditoría) | 09 §6.7 | 🔑 |
| GET | `/api/v1/reports/exports/{id}/download` | reports.export | 09 §6.7 |  |
| GET | `/api/v1/reports/{report}` | reports.view + pestaña permitida | 09 §6.7 |  |

### Tesorería y reclamaciones (16)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/crm/claim-book` | crm.claims.manage | 12 §6 |  |
| POST | `/api/v1/crm/claim-book` | crm.claims.manage (presencial) | 12 §6 | 🔑 |
| POST | `/api/v1/crm/claim-book/exports` | crm.claims.manage (+ reports.export) | 12 §6 |  |
| GET | `/api/v1/crm/claim-book/reports` | crm.claims.manage (+ reports.export) | 12 §6 |  |
| GET | `/api/v1/crm/claim-book/settings` | ver crm.claims.manage | 12 §6 |  |
| PUT | `/api/v1/crm/claim-book/settings` | editar admin.settings.manage | 12 §6 |  |
| GET | `/api/v1/crm/claim-book/{id}` | crm.claims.manage / consumidor dueño | 12 §6 |  |
| GET | `/api/v1/crm/claim-book/{id}/certificate` | crm.claims.manage / dueño | 12 §6 |  |
| POST | `/api/v1/crm/claim-book/{id}/close` | crm.claims.manage | 12 §6 | 🔒 |
| PATCH | `/api/v1/crm/claim-book/{id}/links` | crm.claims.manage | 12 §6 |  |
| POST | `/api/v1/crm/claim-book/{id}/response` | crm.claims.manage | 12 §6 | 🔑 |
| POST | `/api/v1/crm/claim-book/{id}/response/resend` | crm.claims.manage | 12 §6 |  |
| POST | `/api/v1/crm/claim-book/{id}/review` | crm.claims.manage | 12 §6 | 🔒 |
| GET | `/api/v1/portal/claim-book` | sesión cliente/pasajero | 12 §6 |  |
| POST | `/api/v1/portal/claim-book` | sesión cliente/pasajero | 12 §6 | 🔑 |
| POST | `/api/v1/public/{tenant}/claim-book` | público (rate limit 5/min por IP + captcha) | 12 §6 | 🔑 🌐 |

### Motor de reservas (9)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/catalog/products/{id}/availability-ranges` | catalog.products.view | 16 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/availability-ranges` | catalog.products.manage_availability | 16 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/availability-ranges/close-dates` | catalog.products.manage_availability | 16 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/availability-ranges/{rangeId}` | catalog.products.manage_availability | 16 §6.2 | 🔒 |
| DELETE | `/api/v1/catalog/products/{id}/availability-ranges/{rangeId}` | catalog.products.manage_availability | 16 §6.2 | 🔒 |
| PUT | `/api/v1/catalog/products/{id}/operation` | catalog.products.manage_availability | 16 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/pax-rules` | catalog.products.view | 16 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/pax-rules` | catalog.products.update | 16 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/pax-rules/simulate` | catalog.products.view | 16 §6.2 |  |

## Fase 2 · Canales y campo

### Reservas (6)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/pax-feedback/{code}/incident` | operations.incidents | 04 §6 | 🔑 |
| POST | `/api/v1/pax-feedback/{code}/read` | inbox.manage | 04 §6 |  |
| POST | `/api/v1/pax-feedback/{code}/reply` | inbox.manage | 04 §6 | 🔑 |
| GET | `/api/v1/reservations/{id}/pax-feedback` | reservations.view | 04 §6 |  |
| GET | `/api/v1/reservations/{id}/pax-messages` | reservations.view | 04 §6 |  |
| GET | `/api/v1/reservations/{id}/web-snapshot` | reservations.view | 04 §6 |  |

### Operaciones y móvil (23)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/mobile/devices` | autenticado | 05 §6.7 |  |
| DELETE | `/api/v1/mobile/devices/{id}` | autenticado | 05 §6.7 |  |
| POST | `/api/v1/mobile/operator/actions` | operations.view + vínculo recurso + AssignmentPolicy | 05 §6.7 |  |
| GET | `/api/v1/mobile/operator/assignments/{id}` | operations.view + vínculo recurso + AssignmentPolicy \| guía/conductor | 05 §6.7, 05 §6.9 |  |
| GET | `/api/v1/mobile/operator/bootstrap` | operations.view + vínculo recurso | 05 §6.7 |  |
| GET | `/api/v1/mobile/operator/incidents` | operations.view + vínculo recurso + AssignmentPolicy | 05 §6.7 |  |
| POST | `/api/v1/mobile/operator/incidents` | operations.incidents + vínculo | 05 §6.7 | 🔑 |
| GET | `/api/v1/mobile/operator/me` | operations.view + vínculo recurso | 05 §6.7 |  |
| POST | `/api/v1/mobile/operator/sync` | operations.view + vínculo recurso + AssignmentPolicy | 05 §6.7 |  |
| GET | `/api/v1/mobile/passenger/alerts` | reservations.view + vínculo | 05 §6.8 |  |
| POST | `/api/v1/mobile/passenger/alerts/{id}/read` | reservations.view + vínculo | 05 §6.8 |  |
| GET | `/api/v1/mobile/passenger/documents` | reservations.view + vínculo | 05 §6.8 |  |
| GET | `/api/v1/mobile/passenger/documents/{id}/download` | reservations.view + vínculo | 05 §6.8 |  |
| POST | `/api/v1/mobile/passenger/feedback` | passenger | 05 §6.9 | 🔑 |
| GET | `/api/v1/mobile/passenger/itinerary` | reservations.view + vínculo | 05 §6.8 |  |
| GET | `/api/v1/mobile/passenger/messages` | reservations.view + vínculo \| passenger | 05 §6.8, 05 §6.9 |  |
| POST | `/api/v1/mobile/passenger/messages` | reservations.view + vínculo | 05 §6.8 |  |
| POST | `/api/v1/mobile/passenger/messages/{id}/read` | passenger | 05 §6.9 |  |
| GET | `/api/v1/mobile/passenger/support` | reservations.view + vínculo | 05 §6.8 |  |
| GET | `/api/v1/mobile/passenger/trip` | reservations.view + vínculo | 05 §6.8 |  |
| GET | `/api/v1/mobile/passenger/vouchers` | reservations.view + vínculo | 05 §6.8 |  |
| GET | `/api/v1/mobile/passenger/vouchers/{id}` | reservations.view + vínculo | 05 §6.8 |  |
| POST | `/api/v1/ops/rooming/prefill` | reservations.modify | 05 §6.9 | 🔑 |

### Extranet de proveedores (34)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/catalog/providers/{id}/users` | catalog.providers.manage + admin.users.manage | 06 §6 |  |
| GET | `/api/v1/catalog/rate-requests` | catalog.providers.manage | 06 §6 |  |
| POST | `/api/v1/catalog/rate-requests/{id}/approve` | catalog.products.manage_rates | 06 §6 |  |
| POST | `/api/v1/catalog/rate-requests/{id}/reject` | catalog.products.manage_rates | 06 §6 |  |
| POST | `/api/v1/finance/supplier-invoices/{id}/observe` | finance.payables | 06 §6 |  |
| POST | `/api/v1/finance/supplier-invoices/{id}/reject` | finance.payables | 06 §6 |  |
| POST | `/api/v1/finance/supplier-invoices/{id}/validate` | finance.payables | 06 §6 |  |
| GET | `/api/v1/ops/supplier-responses` | operations.view | 06 §6 |  |
| POST | `/api/v1/ops/supplier-responses/{id}/accept` | operations.assign | 06 §6 |  |
| POST | `/api/v1/ops/supplier-responses/{id}/reject` | operations.assign | 06 §6 |  |
| GET | `/api/v1/supplier/contract` | supplier.portal.view | 06 §6 |  |
| GET | `/api/v1/supplier/dashboard` | supplier.portal.view | 06 §6 |  |
| GET | `/api/v1/supplier/incidents` | supplier.portal.view | 06 §6 |  |
| POST | `/api/v1/supplier/incidents` | supplier.incidents.report | 06 §6 | 🔑 |
| GET | `/api/v1/supplier/incidents/{id}` | supplier.portal.view | 06 §6 |  |
| POST | `/api/v1/supplier/incidents/{id}/comments` | supplier.incidents.report | 06 §6 |  |
| GET | `/api/v1/supplier/me` | supplier.portal.view | 06 §6 |  |
| GET | `/api/v1/supplier/payables` | supplier.payables.view | 06 §6 |  |
| POST | `/api/v1/supplier/payables/{id}/invoices` | supplier.invoices.upload | 06 §6 | 🔑 |
| GET | `/api/v1/supplier/rate-requests` | supplier.portal.view | 06 §6 |  |
| POST | `/api/v1/supplier/rate-requests` | supplier.rates.request | 06 §6 | 🔑 |
| POST | `/api/v1/supplier/rate-requests/{id}/withdraw` | supplier.rates.request | 06 §6 |  |
| GET | `/api/v1/supplier/rates` | supplier.portal.view | 06 §6 |  |
| GET | `/api/v1/supplier/requests` | supplier.portal.view | 06 §6 |  |
| GET | `/api/v1/supplier/requests/{serviceId}` | supplier.portal.view | 06 §6 |  |
| POST | `/api/v1/supplier/requests/{serviceId}/alternative` | supplier.requests.respond | 06 §6 | 🔑 |
| POST | `/api/v1/supplier/requests/{serviceId}/confirm` | supplier.requests.respond | 06 §6 | 🔑 🔒 |
| POST | `/api/v1/supplier/requests/{serviceId}/reject` | supplier.requests.respond | 06 §6 | 🔑 🔒 |
| GET | `/api/v1/supplier/rooming-lists` | supplier.portal.view | 06 §6 |  |
| POST | `/api/v1/supplier/rooming-lists/{id}/acknowledge` | supplier.rooming.manage | 06 §6 | 🔑 |
| POST | `/api/v1/supplier/rooming-lists/{id}/confirm` | supplier.rooming.manage | 06 §6 | 🔑 🔒 |
| POST | `/api/v1/supplier/rooming-rooms/{id}/observations` | supplier.rooming.manage | 06 §6 | 🔑 |
| GET | `/api/v1/supplier/vouchers` | supplier.portal.view | 06 §6 |  |
| POST | `/api/v1/supplier/vouchers/redeem` | supplier.vouchers.redeem | 06 §6 | 🔑 🔒 |

### Finanzas (22)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/finance/bank-lines` | finance.payments.register | 07 §6.7 |  |
| POST | `/api/v1/finance/bank-lines/{code}/confirm` | finance.payments.register | 07 §6.7 | 🔒 |
| POST | `/api/v1/finance/bank-lines/{code}/reject` | finance.payments.register | 07 §6.7 | 🔒 |
| POST | `/api/v1/finance/bank-lines/{code}/resolve` | finance.payments.register | 07 §6.7 | 🔒 |
| POST | `/api/v1/finance/bank-statements` | finance.payments.register | 07 §6.7 | 🔑 |
| GET | `/api/v1/finance/invoices` | finance.invoicing | 07 §6.6 | 🧩 `invoices:read` |
| POST | `/api/v1/finance/invoices` | finance.invoicing | 07 §6.6 | 🔑 |
| GET | `/api/v1/finance/invoices/summary` | finance.invoicing | 07 §6.6 |  |
| POST | `/api/v1/finance/invoices/validate` | finance.invoicing | 07 §6.6 |  |
| GET | `/api/v1/finance/invoices/{number}` | finance.invoicing | 07 §6.6 | 🧩 `invoices:read` |
| GET | `/api/v1/finance/invoices/{number}/cdr` | finance.invoicing (+ portal cliente para los suyos) | 07 §6.6 |  |
| POST | `/api/v1/finance/invoices/{number}/deliver` | finance.invoicing | 07 §6.6 | 🔑 |
| GET | `/api/v1/finance/invoices/{number}/pdf` | finance.invoicing (+ portal cliente para los suyos) | 07 §6.6 |  |
| POST | `/api/v1/finance/invoices/{number}/resend` | finance.invoicing | 07 §6.6 | 🔑 🔒 |
| POST | `/api/v1/finance/invoices/{number}/status-check` | finance.invoicing | 07 §6.6 |  |
| POST | `/api/v1/finance/invoices/{number}/void` | finance.invoicing | 07 §6.6 | 🔑 |
| GET | `/api/v1/finance/invoices/{number}/xml` | finance.invoicing (+ portal cliente para los suyos) | 07 §6.6 |  |
| GET | `/api/v1/finance/receivables/{code}/invoice-draft` | finance.invoicing | 07 §6.6 |  |
| GET | `/api/v1/finance/reconciliation/closures` | finance.payments.register | 07 §6.7 |  |
| POST | `/api/v1/finance/reconciliation/closures` | finance.payments.register | 07 §6.7 | 🔑 |
| POST | `/api/v1/finance/reconciliation/matching` | finance.payments.register | 07 §6.7 | 🔑 |
| POST | `/api/v1/integrations/fiscal/{provider}/webhook` | Firma del proveedor | 07 §6.6 | 🪝 |

### Canales y portales (80)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/b2b/auth/login` | público | 08 §6.2 | 🌐 |
| POST | `/api/v1/b2b/auth/logout` | rol b2b | 08 §6.2 |  |
| GET | `/api/v1/b2b/catalog` | rol b2b | 08 §6.2 |  |
| GET | `/api/v1/b2b/catalog/{productId}/departures` | rol b2b | 08 §6.2 |  |
| GET | `/api/v1/b2b/me` | rol b2b | 08 §6.2 |  |
| POST | `/api/v1/b2b/receivables/{id}/payment-reports` | rol b2b | 08 §6.2 | 🔑 |
| GET | `/api/v1/b2b/reservations` | rol b2b | 08 §6.2 |  |
| POST | `/api/v1/b2b/reservations` | rol b2b | 08 §6.2 | 🔑 |
| POST | `/api/v1/b2b/reservations/quote-price` | rol b2b | 08 §6.2 |  |
| GET | `/api/v1/b2b/reservations/{code}` | rol b2b | 08 §6.2 |  |
| POST | `/api/v1/b2b/settlement-requests` | rol b2b | 08 §6.2 | 🔑 |
| GET | `/api/v1/b2b/statement` | rol b2b | 08 §6.2 |  |
| GET | `/api/v1/b2b/vouchers/{code}/pdf` | rol b2b | 08 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/b2b-rates/{agencyId}` | channels.b2b.manage \| catalog.products.manage_b2b | 08 §6.1 |  |
| POST | `/api/v1/catalog/promotions/{id}/activate` | channels.ecommerce.manage \| catalog.products.manage_promotions | 08 §6.3 |  |
| POST | `/api/v1/catalog/promotions/{id}/deactivate` | channels.ecommerce.manage \| catalog.products.manage_promotions | 08 §6.3 |  |
| GET | `/api/v1/channels/b2b/agencies` | channels.b2b.manage | 08 §6.1 |  |
| POST | `/api/v1/channels/b2b/agencies` | channels.b2b.manage | 08 §6.1 |  |
| GET | `/api/v1/channels/b2b/agencies/{id}` | channels.b2b.manage | 08 §6.1 |  |
| PATCH | `/api/v1/channels/b2b/agencies/{id}` | channels.b2b.manage | 08 §6.1 | 🔒 |
| POST | `/api/v1/channels/b2b/agencies/{id}/block` | channels.b2b.manage | 08 §6.1 | 🔒 |
| GET | `/api/v1/channels/b2b/agencies/{id}/credit-movements` | channels.b2b.manage | 08 §6.1 |  |
| POST | `/api/v1/channels/b2b/agencies/{id}/impersonation` | channels.b2b.manage | 08 §6.1 |  |
| POST | `/api/v1/channels/b2b/agencies/{id}/unblock` | channels.b2b.manage | 08 §6.1 | 🔒 |
| GET | `/api/v1/channels/b2b/price-lists` | channels.b2b.manage | 08 §6.1 |  |
| GET | `/api/v1/channels/b2b/product-rates` | channels.b2b.manage | 08 §6.1 |  |
| GET | `/api/v1/channels/b2b/settlement-requests` | channels.b2b.manage \| finance.commissions | 08 §6.1 |  |
| GET | `/api/v1/channels/b2b/summary` | channels.b2b.manage | 08 §6.1 |  |
| GET | `/api/v1/channels/ecommerce/orders` | channels.ecommerce.manage | 08 §6.3 |  |
| GET | `/api/v1/channels/ecommerce/orders/{code}` | channels.ecommerce.manage | 08 §6.3 |  |
| POST | `/api/v1/channels/ecommerce/orders/{code}/cancel` | channels.ecommerce.manage | 08 §6.3 | 🔒 |
| POST | `/api/v1/channels/ecommerce/orders/{code}/payment-link` | channels.ecommerce.manage | 08 §6.3 | 🔑 |
| GET | `/api/v1/channels/ecommerce/products` | channels.ecommerce.manage | 08 §6.3 |  |
| POST | `/api/v1/channels/ecommerce/products/{id}/publish` | channels.ecommerce.manage | 08 §6.3 |  |
| POST | `/api/v1/channels/ecommerce/products/{id}/unpublish` | channels.ecommerce.manage | 08 §6.3 |  |
| GET | `/api/v1/channels/ecommerce/promotions` | channels.ecommerce.manage | 08 §6.3 |  |
| GET | `/api/v1/channels/ecommerce/summary` | channels.ecommerce.manage | 08 §6.3 |  |
| GET | `/api/v1/cms/contents` | channels.cms.publish (+ channels.cms.edit propuesto) | 08 §6.4 |  |
| POST | `/api/v1/cms/contents` | channels.cms.publish (+ channels.cms.edit propuesto) | 08 §6.4 |  |
| GET | `/api/v1/cms/contents/{id}` | channels.cms.publish (+ channels.cms.edit propuesto) | 08 §6.4 |  |
| PATCH | `/api/v1/cms/contents/{id}` | channels.cms.publish (+ channels.cms.edit propuesto) (publicado → publish) | 08 §6.4 | 🔒 |
| POST | `/api/v1/cms/contents/{id}/approve` | channels.cms.publish | 08 §6.4 | 🔒 |
| POST | `/api/v1/cms/contents/{id}/preview` | channels.cms.publish | 08 §6.4 |  |
| POST | `/api/v1/cms/contents/{id}/publish` | channels.cms.publish | 08 §6.4 | 🔒 |
| POST | `/api/v1/cms/contents/{id}/return` | channels.cms.publish | 08 §6.4 | 🔒 |
| POST | `/api/v1/cms/contents/{id}/submit` | channels.cms.publish (+ channels.cms.edit propuesto) (publicado → publish) | 08 §6.4 | 🔒 |
| POST | `/api/v1/cms/contents/{id}/unpublish` | channels.cms.publish | 08 §6.4 | 🔒 |
| POST | `/api/v1/portal/customer/receivables/{code}/pay` | customer | 08 §6.7 | 🔑 |
| PUT | `/api/v1/portal/customer/reservations/{code}/companions` | customer \| cliente dueño | 08 §6.7, 15 §6.6 | 🔒 |
| GET | `/api/v1/portal/customer/reservations/{code}/web-summary` | customer | 08 §6.7 |  |
| GET | `/api/v1/portal/passenger/activities` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/alerts` | passenger | 08 §6.6 |  |
| POST | `/api/v1/portal/passenger/alerts/{incidentId}/ack` | passenger | 08 §6.6 |  |
| POST | `/api/v1/portal/passenger/auth/link` | público | 08 §6.6 | 🌐 |
| POST | `/api/v1/portal/passenger/auth/verify` | público | 08 §6.6 | 🌐 |
| GET | `/api/v1/portal/passenger/companions` | passenger | 08 §6.7 | 🔒 |
| PUT | `/api/v1/portal/passenger/companions` | passenger | 08 §6.7 | 🔒 |
| GET | `/api/v1/portal/passenger/contacts` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/documents` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/feedback` | passenger | 08 §6.7 |  |
| POST | `/api/v1/portal/passenger/feedback` | passenger | 08 §6.7 | 🔑 |
| GET | `/api/v1/portal/passenger/hotels` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/itinerary` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/messages` | passenger | 08 §6.7 |  |
| POST | `/api/v1/portal/passenger/messages` | passenger | 08 §6.6 |  |
| POST | `/api/v1/portal/passenger/messages/read-all` | passenger | 08 §6.7 |  |
| POST | `/api/v1/portal/passenger/messages/{id}/read` | passenger | 08 §6.7 |  |
| GET | `/api/v1/portal/passenger/transport` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/trip` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/vouchers` | passenger | 08 §6.6 |  |
| GET | `/api/v1/portal/passenger/vouchers/{code}` | passenger | 08 §6.6 |  |
| GET | `/api/v1/public/cms/contents/{slug}` | público | 08 §6.4 | 🌐 |
| GET | `/api/v1/public/cms/placements/{placement}` | portal | 08 §6.4 | 🌐 |
| POST | `/api/v1/public/shop/availability` | público | 08 §6.3 | 🌐 |
| POST | `/api/v1/public/shop/orders` | público | 08 §6.3 | 🔑 🌐 |
| GET | `/api/v1/public/shop/orders/{code}` | público (token del pedido) | 08 §6.3 | 🌐 |
| POST | `/api/v1/public/shop/orders/{code}/payments` | público (token del pedido) | 08 §6.3 | 🔑 🌐 |
| POST | `/api/v1/public/shop/price` | público | 08 §6.3 | 🌐 |
| GET | `/api/v1/public/shop/products` | público (tenant por host) | 08 §6.3 | 🌐 |
| GET | `/api/v1/public/shop/products/{slug}` | público | 08 §6.3 | 🌐 |

### Aprobaciones e inbox (35)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/approval-rules` | approvals.view | 10 §6 | 🔒 |
| POST | `/api/v1/approval-rules` | admin.settings.manage | 10 §6 | 🔒 |
| POST | `/api/v1/approval-rules/reset` | admin.settings.manage | 10 §6 |  |
| PATCH | `/api/v1/approval-rules/{id}` | admin.settings.manage | 10 §6 | 🔒 |
| DELETE | `/api/v1/approval-rules/{id}` | admin.settings.manage | 10 §6 | 🔒 |
| GET | `/api/v1/approvals` | approvals.view | 10 §6 |  |
| POST | `/api/v1/approvals` | approvals.view | 10 §6 | 🔑 |
| GET | `/api/v1/approvals/cancel-preview/{reservation}` | reservations.cancel o regla N | 10 §6 |  |
| GET | `/api/v1/approvals/counters` | approvals.view | 10 §6 |  |
| GET | `/api/v1/approvals/{code}` | approvals.view + visibilidad | 10 §6 |  |
| POST | `/api/v1/approvals/{code}/approve` | Regla del nivel | 10 §6 | 🔑 🔒 |
| POST | `/api/v1/approvals/{code}/delegate` | Regla del nivel | 10 §6 | 🔒 |
| POST | `/api/v1/approvals/{code}/info-requests` | Regla del nivel | 10 §6 | 🔒 |
| POST | `/api/v1/approvals/{code}/info-requests/{id}/answer` | Solicitante / Manager | 10 §6 |  |
| POST | `/api/v1/approvals/{code}/reject` | Regla del nivel | 10 §6 | 🔑 🔒 |
| POST | `/api/v1/approvals/{code}/resubmit` | Solicitante / finance.payables / finance.commissions | 10 §6 | 🔑 |
| POST | `/api/v1/approvals/{code}/withdraw` | Solicitante | 10 §6 | 🔒 |
| POST | `/api/v1/inbox/attachments` | inbox.manage | 10 §6 |  |
| GET | `/api/v1/inbox/conversations` | inbox.view | 10 §6 |  |
| GET | `/api/v1/inbox/conversations/{code}` | inbox.view + Policy | 10 §6 |  |
| PATCH | `/api/v1/inbox/conversations/{code}` | inbox.manage | 10 §6 | 🔒 |
| POST | `/api/v1/inbox/conversations/{code}/activities` | crm.activities.manage | 10 §6 |  |
| POST | `/api/v1/inbox/conversations/{code}/assign` | inbox.manage (Ventas solo me) | 10 §6 | 🔒 |
| POST | `/api/v1/inbox/conversations/{code}/lead` | crm.leads.manage | 10 §6 | 🔑 |
| POST | `/api/v1/inbox/conversations/{code}/link` | inbox.manage + crm.clients.manage | 10 §6 |  |
| POST | `/api/v1/inbox/conversations/{code}/messages` | inbox.manage | 10 §6 | 🔑 |
| POST | `/api/v1/inbox/conversations/{code}/notes` | inbox.manage | 10 §6 |  |
| POST | `/api/v1/inbox/conversations/{code}/reopen` | inbox.manage | 10 §6 | 🔒 |
| POST | `/api/v1/inbox/conversations/{code}/resolve` | inbox.manage | 10 §6 | 🔒 |
| GET | `/api/v1/inbox/templates` | lectura inbox.view; escritura admin.settings.manage | 10 §6 |  |
| POST | `/api/v1/inbox/templates` | lectura inbox.view; escritura admin.settings.manage | 10 §6 |  |
| PATCH | `/api/v1/inbox/templates/{id}` | lectura inbox.view; escritura admin.settings.manage | 10 §6 |  |
| POST | `/api/v1/integrations/email/inbound` | token de canal | 10 §6 | 🪝 |
| GET | `/api/v1/integrations/whatsapp/webhook` | Verify token | 10 §6 | 🌐 |
| POST | `/api/v1/integrations/whatsapp/webhook` | Firma HMAC | 10 §6 | 🪝 |

### Cupos y documentos de viaje (29)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/catalog/allotments` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| POST | `/api/v1/catalog/allotments` | catalog.allotments.manage | 11 §6 | 🔑 |
| GET | `/api/v1/catalog/allotments/grid` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| POST | `/api/v1/catalog/allotments/jobs/release` | catalog.allotments.manage | 11 §6 |  |
| GET | `/api/v1/catalog/allotments/pickup` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| GET | `/api/v1/catalog/allotments/{id}` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| PATCH | `/api/v1/catalog/allotments/{id}` | catalog.allotments.manage | 11 §6 | 🔒 |
| GET | `/api/v1/catalog/allotments/{id}/charges` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| GET | `/api/v1/catalog/allotments/{id}/days/{date}` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| POST | `/api/v1/catalog/allotments/{id}/days/{date}/release` | catalog.allotments.manage | 11 §6 | 🔒 |
| PUT | `/api/v1/catalog/allotments/{id}/days/{date}/retention` | catalog.allotments.manage | 11 §6 | 🔒 |
| DELETE | `/api/v1/catalog/allotments/{id}/days/{date}/retention` | catalog.allotments.manage | 11 §6 | 🔒 |
| POST | `/api/v1/catalog/allotments/{id}/release` | catalog.allotments.manage | 11 §6 | 🔑 🔒 |
| GET | `/api/v1/catalog/allotments/{id}/requests` | catalog.allotments.manage \| catalog.products.view_profitability | 11 §6 |  |
| POST | `/api/v1/catalog/allotments/{id}/requests` | catalog.allotments.manage | 11 §6 | 🔑 |
| POST | `/api/v1/catalog/allotments/{id}/requests/{rid}/respond` | catalog.allotments.manage | 11 §6 | 🔒 |
| GET | `/api/v1/ops/travel-docs` | operations.travel_docs \| reservations.create (owner=me forzado) | 11 §6 |  |
| POST | `/api/v1/ops/travel-docs/jobs/reminders` | operations.travel_docs | 11 §6 |  |
| GET | `/api/v1/ops/travel-docs/passengers` | operations.travel_docs \| reservations.create (owner=me forzado) | 11 §6 |  |
| GET | `/api/v1/reservations/{id}/travel-docs` | operations.travel_docs \| reservations.create (owner=me forzado) + Policy ownership | 11 §6 |  |
| GET | `/api/v1/reservations/{id}/travel-docs/gate` | operations.view | 11 §6 |  |
| POST | `/api/v1/reservations/{id}/travel-docs/requests` | operations.travel_docs \| asesor dueño | 11 §6 | 🔑 |
| PUT | `/api/v1/reservations/{id}/travel-docs/{passengerId}/emergency-contact` | operations.travel_docs | 11 §6 |  |
| PUT | `/api/v1/reservations/{id}/travel-docs/{passengerId}/special-attention` | operations.travel_docs | 11 §6 |  |
| POST | `/api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/files` | operations.travel_docs (portal cliente: token de portal) | 11 §6 | 🔑 |
| POST | `/api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/observe` | operations.travel_docs | 11 §6 | 🔒 |
| POST | `/api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/validate` | operations.travel_docs | 11 §6 | 🔒 |
| GET | `/api/v1/settings/travel-docs` | lectura | 11 §6 |  |
| PUT | `/api/v1/settings/travel-docs` | operations.travel_docs | 11 §6 |  |

### Tesorería y reclamaciones (22)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/treasury/accounts` | finance.treasury | 12 §6 |  |
| POST | `/api/v1/treasury/accounts` | admin.settings.manage | 12 §6 | 🔒 |
| PATCH | `/api/v1/treasury/accounts/{id}` | admin.settings.manage | 12 §6 | 🔒 |
| GET | `/api/v1/treasury/accounts/{id}/movements` | finance.treasury | 12 §6 |  |
| GET | `/api/v1/treasury/cash-flow` | finance.treasury | 12 §6 |  |
| POST | `/api/v1/treasury/counts/{id}/approve` | finance.profitability + approvals.view | 12 §6 | 🔒 |
| POST | `/api/v1/treasury/counts/{id}/validate` | finance.invoicing | 12 §6 |  |
| GET | `/api/v1/treasury/fx/revaluation-preview` | finance.treasury | 12 §6 |  |
| POST | `/api/v1/treasury/fx/revaluations` | finance.invoicing | 12 §6 |  |
| POST | `/api/v1/treasury/gateway/{account}/settlements` | finance.payments.register | 12 §6 | 🔑 |
| GET | `/api/v1/treasury/movements` | finance.treasury | 12 §6 |  |
| POST | `/api/v1/treasury/movements` | finance.payments.register | 12 §6 | 🔑 |
| POST | `/api/v1/treasury/movements/{id}/void` | finance.payments.register | 12 §6 |  |
| POST | `/api/v1/treasury/petty-cash/{account}/counts` | finance.payments.register | 12 §6 |  |
| POST | `/api/v1/treasury/petty-cash/{account}/expenses` | finance.payments.register | 12 §6 | 🔑 |
| POST | `/api/v1/treasury/petty-cash/{account}/replenishments` | finance.payments.register | 12 §6 |  |
| POST | `/api/v1/treasury/petty-cash/{account}/sessions` | finance.payments.register | 12 §6 |  |
| POST | `/api/v1/treasury/replenishments/{id}/approve` | finance.profitability + approvals.view | 12 §6 | 🔒 |
| POST | `/api/v1/treasury/replenishments/{id}/pay` | finance.payments.register | 12 §6 | 🔑 |
| POST | `/api/v1/treasury/replenishments/{id}/reject` | finance.profitability + approvals.view | 12 §6 | 🔒 |
| POST | `/api/v1/treasury/sync` | finance.treasury | 12 §6 |  |
| POST | `/api/v1/treasury/transfers` | finance.payments.register | 12 §6 | 🔑 |

### Sitio web público (61)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/public/analytics/events` | público (con consentimiento) | 15 §6.4 | 🌐 |
| POST | `/api/v1/public/auth/email/verify` | público / token | 15 §6.5 | 🌐 |
| POST | `/api/v1/public/auth/login` | público / token | 15 §6.5 | 🌐 |
| POST | `/api/v1/public/auth/logout` | público / token | 15 §6.5 |  |
| POST | `/api/v1/public/auth/password/forgot` | público / token | 15 §6.5 | 🌐 |
| POST | `/api/v1/public/auth/register` | público / token | 15 §6.5 | 🌐 |
| POST | `/api/v1/public/availability` | público | 15 §6.2 | 🌐 |
| GET | `/api/v1/public/booking-rules` | público | 15 §6.6 | 🌐 |
| POST | `/api/v1/public/carts` | público \| X-KipuControl-Key + Origin verificado | 15 §6.2, 17 §6 | 🔑 🌐 |
| GET | `/api/v1/public/carts/current` | token carrito | 15 §6.2 | 🌐 |
| POST | `/api/v1/public/carts/current/items` | token carrito | 15 §6.2, 15 §6.6 | 🔑 🌐 |
| PATCH | `/api/v1/public/carts/current/items/{line}` | token carrito | 15 §6.2 | 🌐 |
| DELETE | `/api/v1/public/carts/current/items/{line}` | token carrito | 15 §6.2 | 🌐 |
| POST | `/api/v1/public/carts/current/items/{line}/hold` | token carrito | 15 §6.2 | 🌐 |
| PATCH | `/api/v1/public/carts/current/items/{line}/removed-lines` | token carrito | 15 §6.6 | 🔒 🌐 |
| PUT | `/api/v1/public/carts/current/preferences` | token carrito | 15 §6.2 | 🌐 |
| PUT | `/api/v1/public/carts/current/promo` | token carrito | 15 §6.2 | 🌐 |
| DELETE | `/api/v1/public/carts/current/promo` | token carrito | 15 §6.2 | 🌐 |
| POST | `/api/v1/public/chat/sessions` | token de sesión de chat | 15 §6.4 | 🌐 |
| POST | `/api/v1/public/chat/sessions/{id}/messages` | token de sesión de chat | 15 §6.4 | 🌐 |
| POST | `/api/v1/public/checkout/orders` | token carrito | 15 §6.3, 15 §6.6 | 🔑 🔒 🌐 |
| POST | `/api/v1/public/checkout/validate` | token carrito | 15 §6.3 | 🌐 |
| POST | `/api/v1/public/claims` | público | 15 §6.4 | 🔑 🌐 |
| POST | `/api/v1/public/contact` | público + captcha \| rate limit | 10 §6, 15 §6.4 | 🔑 🌐 |
| GET | `/api/v1/public/currencies` | público | 15 §6.6 | 🌐 |
| GET | `/api/v1/public/departures/guaranteed` | público | 15 §6.1 | 🌐 |
| GET | `/api/v1/public/destinations` | público | 15 §6.1 | 🌐 |
| GET | `/api/v1/public/destinations/{slug}` | público | 15 §6.1 | 🌐 |
| POST | `/api/v1/public/leads` | público + captcha invisible | 15 §6.4 | 🔑 🌐 |
| GET | `/api/v1/public/me` | customer | 15 §6.5 | 🔒 |
| PATCH | `/api/v1/public/me` | customer | 15 §6.5 | 🔒 |
| POST | `/api/v1/public/me/arco-requests` | customer | 15 §6.5 | 🔑 |
| GET | `/api/v1/public/me/receivables` | customer | 15 §6.5 |  |
| POST | `/api/v1/public/me/receivables/{id}/payments` | customer | 15 §6.5 | 🔑 |
| GET | `/api/v1/public/me/reservations` | customer (reservations.view, solo su client_id) | 15 §6.5 |  |
| GET | `/api/v1/public/me/reservations/{code}` | customer (reservations.view, solo su client_id) | 15 §6.5 |  |
| GET | `/api/v1/public/me/vouchers` | customer | 15 §6.5 |  |
| GET | `/api/v1/public/me/wishlist` | customer | 15 §6.5 |  |
| PUT | `/api/v1/public/me/wishlist/{product}` | customer | 15 §6.5 |  |
| DELETE | `/api/v1/public/me/wishlist/{product}` | customer | 15 §6.5 |  |
| POST | `/api/v1/public/newsletter` | público | 15 §6.4 | 🔑 🌐 |
| GET | `/api/v1/public/newsletter/confirm/{token}` | público | 15 §6.4 | 🌐 |
| POST | `/api/v1/public/newsletter/unsubscribe` | público | 15 §6.4 | 🔑 🌐 |
| GET | `/api/v1/public/offers` | público | 15 §6.1 | 🌐 |
| POST | `/api/v1/public/orders/lookup` | público | 15 §6.3 | 🌐 |
| GET | `/api/v1/public/orders/{code}` | token del pedido o cliente dueño | 15 §6.3 | 🌐 |
| POST | `/api/v1/public/orders/{code}/payment-session` | token del pedido | 15 §6.3 | 🔑 🌐 |
| POST | `/api/v1/public/orders/{code}/payments` | token del pedido | 15 §6.3 | 🔑 🌐 |
| GET | `/api/v1/public/orders/{code}/vouchers/{id}.pdf` | token del pedido o cliente dueño | 15 §6.3 | 🌐 |
| GET | `/api/v1/public/pages/{slug}` | público | 15 §6.1 | 🌐 |
| GET | `/api/v1/public/posts` | público | 15 §6.1 | 🌐 |
| GET | `/api/v1/public/posts/{slug}` | público | 15 §6.1 | 🌐 |
| POST | `/api/v1/public/price-quote` | público | 15 §6.2 | 🌐 |
| GET | `/api/v1/public/products` | público \| X-KipuControl-Key + Origin verificado | 15 §6.1, 17 §6 | 🌐 |
| GET | `/api/v1/public/products/{slug}` | público \| X-KipuControl-Key + Origin verificado | 15 §6.1, 17 §6 | 🌐 |
| GET | `/api/v1/public/products/{slug}/availability` | público \| pública \| X-KipuControl-Key + Origin verificado | 15 §6.6, 16 §6.1, 17 §6 | 🌐 |
| GET | `/api/v1/public/products/{slug}/calendar` | público | 15 §6.1 | 🌐 |
| GET | `/api/v1/public/products/{slug}/departures` | público | 15 §6.1 | 🌐 |
| POST | `/api/v1/public/quote` | público \| pública \| X-KipuControl-Key + Origin verificado | 15 §6.6, 16 §6.1, 17 §6 | 🌐 |
| GET | `/api/v1/public/site` | público | 15 §6.1 | 🌐 |
| POST | `/api/v1/webhooks/payments/{gateway}` | firma HMAC del proveedor \| firma del proveedor \| firma de la pasarela | 08 §6.3, 13 §6, 15 §6.3 | 🪝 |

### Motor de reservas (20)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| PUT | `/api/v1/catalog/products/{id}/accommodation` | catalog.products.manage_rates | 16 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/accommodation/legs` | catalog.products.manage_rates | 16 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/accommodation/legs/{legId}` | catalog.products.manage_rates | 16 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/accommodation/legs/{legId}` | catalog.products.manage_rates | 16 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/accommodation/legs/{legId}/hotels` | catalog.products.manage_rates | 16 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/accommodation/legs/{legId}/hotels/{hotelId}` | catalog.products.manage_rates | 16 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/accommodation/legs/{legId}/hotels/{hotelId}` | catalog.products.manage_rates | 16 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/addons` | catalog.products.view | 16 §6.2 |  |
| POST | `/api/v1/catalog/products/{id}/addons` | catalog.products.manage_rates | 16 §6.2 |  |
| PATCH | `/api/v1/catalog/products/{id}/addons/{addonId}` | catalog.products.manage_rates | 16 §6.2 |  |
| DELETE | `/api/v1/catalog/products/{id}/addons/{addonId}` | catalog.products.manage_rates | 16 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/booking-config` | catalog.products.view | 16 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/payment-policy` | catalog.products.view | 16 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/payment-policy` | catalog.products.manage_rates | 16 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/pickup` | catalog.products.view | 16 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/pickup` | catalog.products.update ∨ catalog.products.manage_availability | 16 §6.2 |  |
| GET | `/api/v1/catalog/products/{id}/rule-overrides` | catalog.products.view | 16 §6.2 |  |
| PUT | `/api/v1/catalog/products/{id}/rule-overrides/{code}` | catalog.products.update \| admin.settings.manage | 16 §6.2, 17 §6 | 🔒 |
| DELETE | `/api/v1/catalog/products/{id}/rule-overrides/{code}` | catalog.products.update \| admin.settings.manage | 16 §6.2, 17 §6 | 🔒 |
| POST | `/api/v1/public/bookings` | pública | 16 §6.1 | 🔑 🌐 |

### Reglas, comunicaciones y monedas (39)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/admin/booking-rules` | admin.settings.manage | 16 §6.2, 17 §6 |  |
| POST | `/api/v1/admin/booking-rules` | admin.settings.manage | 17 §6 | 🔑 |
| POST | `/api/v1/admin/booking-rules/apply-template` | admin.settings.manage | 17 §6 | 🔑 |
| GET | `/api/v1/admin/booking-rules/audit` | admin.settings.manage | 17 §6 |  |
| POST | `/api/v1/admin/booking-rules/reset` | admin.settings.manage | 17 §6 | 🔑 |
| POST | `/api/v1/admin/booking-rules/simulate` | admin.settings.manage | 17 §6 |  |
| PATCH | `/api/v1/admin/booking-rules/{code}` | admin.settings.manage | 16 §6.2, 17 §6 | 🔒 |
| DELETE | `/api/v1/admin/booking-rules/{code}` | admin.settings.manage | 17 §6 | 🔒 |
| GET | `/api/v1/catalog/products/{id}/rule-overrides/{code}` | admin.settings.manage | 17 §6 | 🔒 |
| GET | `/api/v1/channels/widget` | channels.ecommerce.manage | 17 §6 | 🔒 |
| PUT | `/api/v1/channels/widget` | channels.ecommerce.manage | 17 §6 | 🔒 |
| GET | `/api/v1/channels/widget/domains` | channels.ecommerce.manage | 17 §6 |  |
| POST | `/api/v1/channels/widget/domains` | channels.ecommerce.manage | 17 §6 |  |
| DELETE | `/api/v1/channels/widget/domains/{id}` | channels.ecommerce.manage | 17 §6 |  |
| POST | `/api/v1/channels/widget/domains/{id}/verify` | channels.ecommerce.manage | 17 §6 |  |
| POST | `/api/v1/channels/widget/rotate-key` | admin.api.manage | 17 §6 | 🔑 |
| GET | `/api/v1/finance/currencies` | admin.settings.manage (rate: + finance.treasury) | 17 §6 | 🔒 |
| GET | `/api/v1/finance/currencies/convert` | admin.settings.manage | 17 §6 |  |
| POST | `/api/v1/finance/currencies/refresh` | admin.settings.manage \| finance.treasury | 17 §6 |  |
| PATCH | `/api/v1/finance/currencies/{code}` | admin.settings.manage (rate: + finance.treasury) | 17 §6 | 🔒 |
| GET | `/api/v1/finance/currencies/{code}/rates` | admin.settings.manage (rate: + finance.treasury) | 17 §6 |  |
| GET | `/api/v1/finance/fx-providers` | admin.settings.manage \| finance.treasury | 17 §6 |  |
| POST | `/api/v1/finance/fx-providers/{code}/test` | admin.settings.manage | 17 §6 |  |
| GET | `/api/v1/finance/fx-rates` | admin.settings.manage \| finance.treasury | 17 §6 |  |
| PATCH | `/api/v1/finance/fx-settings` | admin.settings.manage | 17 §6 | 🔒 |
| GET | `/api/v1/notifications/pax-messages` | admin.settings.manage \| operations.assign | 17 §6 |  |
| POST | `/api/v1/notifications/pax-messages/reschedule` | admin.settings.manage \| operations.assign | 17 §6 |  |
| POST | `/api/v1/notifications/pax-messages/{id}/cancel` | admin.settings.manage \| operations.assign | 17 §6 | 🔑 |
| POST | `/api/v1/notifications/pax-messages/{id}/retry` | admin.settings.manage \| operations.assign | 17 §6 | 🔑 |
| POST | `/api/v1/notifications/pax-messages/{id}/send-now` | admin.settings.manage \| operations.assign | 17 §6 | 🔑 |
| GET | `/api/v1/notifications/pax-templates` | admin.settings.manage (GET también operations.assign) | 17 §6 | 🔒 |
| POST | `/api/v1/notifications/pax-templates` | admin.settings.manage (GET también operations.assign) | 17 §6 | 🔒 |
| PATCH | `/api/v1/notifications/pax-templates/{id}` | admin.settings.manage (GET también operations.assign) | 17 §6 | 🔒 |
| DELETE | `/api/v1/notifications/pax-templates/{id}` | admin.settings.manage (GET también operations.assign) | 17 §6 | 🔒 |
| POST | `/api/v1/notifications/pax-templates/{id}/preview` | admin.settings.manage \| operations.assign | 17 §6 |  |
| POST | `/api/v1/notifications/pax-templates/{id}/test` | admin.settings.manage | 17 §6 | 🔑 |
| POST | `/api/v1/public/widget-handoffs` | X-KipuControl-Key + Origin verificado | 17 §6 | 🔑 🌐 |
| POST | `/api/v1/reservations/{id}/pax-messages` | admin.settings.manage \| operations.assign | 17 §6 | 🔑 |
| POST | `/api/v1/webhooks/providers/{provider}` | firma del proveedor | 17 §6 | 🪝 |

## Fase 3 · SaaS y crecimiento

### Administración y reportes (1)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/reports/schedules` | reports.export | 09 §6.7 |  |

### Plataforma SaaS y API (62)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/billing/addons/{code}` | admin.billing.manage | 13 §6 | 🔑 |
| PATCH | `/api/v1/billing/addons/{code}` | admin.billing.manage | 13 §6 | 🔑 |
| DELETE | `/api/v1/billing/addons/{code}` | admin.billing.manage | 13 §6 | 🔑 |
| POST | `/api/v1/billing/coupon` | admin.billing.manage | 13 §6 |  |
| GET | `/api/v1/billing/entitlements` | autenticado | 13 §6 |  |
| GET | `/api/v1/billing/invoices` | admin.billing.manage | 13 §6 |  |
| GET | `/api/v1/billing/invoices/{number}` | admin.billing.manage | 13 §6 |  |
| POST | `/api/v1/billing/invoices/{number}/pay` | admin.billing.manage | 13 §6 | 🔑 |
| GET | `/api/v1/billing/invoices/{number}/pdf` | admin.billing.manage | 13 §6 |  |
| PUT | `/api/v1/billing/payment-methods/default` | admin.billing.manage | 13 §6 | 🔑 |
| POST | `/api/v1/billing/payment-methods/setup-intent` | admin.billing.manage | 13 §6 |  |
| GET | `/api/v1/billing/plan-rules` | admin.billing.manage | 13 §6 |  |
| GET | `/api/v1/billing/subscription` | admin.billing.manage | 13 §6 |  |
| PATCH | `/api/v1/billing/subscription` | admin.billing.manage | 13 §6 | 🔒 |
| POST | `/api/v1/billing/subscription/cancel` | admin.billing.manage | 13 §6 | 🔒 |
| POST | `/api/v1/billing/subscription/change` | admin.billing.manage | 13 §6 | 🔑 🔒 |
| POST | `/api/v1/billing/subscription/preview-change` | admin.billing.manage | 13 §6 |  |
| POST | `/api/v1/billing/subscription/resume` | admin.billing.manage | 13 §6 | 🔒 |
| DELETE | `/api/v1/billing/subscription/scheduled-change` | admin.billing.manage | 13 §6 | 🔒 |
| GET | `/api/v1/billing/usage` | admin.billing.manage | 13 §6 |  |
| GET | `/api/v1/docs/openapi.json` | público | 13 §6 | 🌐 |
| GET | `/api/v1/integrations/api-keys` | admin.api.manage | 13 §6 |  |
| POST | `/api/v1/integrations/api-keys` | admin.api.manage | 13 §6 |  |
| DELETE | `/api/v1/integrations/api-keys/{id}` | admin.api.manage | 13 §6 |  |
| GET | `/api/v1/integrations/oauth-apps` | admin.api.manage + feature oauth_apps | 13 §6 |  |
| POST | `/api/v1/integrations/oauth-apps` | admin.api.manage + feature oauth_apps | 13 §6 |  |
| DELETE | `/api/v1/integrations/oauth-apps/{id}` | admin.api.manage + feature oauth_apps | 13 §6 |  |
| POST | `/api/v1/integrations/oauth-apps/{id}/secret` | admin.api.manage + feature oauth_apps | 13 §6 |  |
| GET | `/api/v1/integrations/webhook-deliveries` | admin.api.manage | 13 §6 |  |
| POST | `/api/v1/integrations/webhook-deliveries/{id}/redeliver` | admin.api.manage | 13 §6 | 🔑 |
| GET | `/api/v1/integrations/webhooks` | admin.api.manage o scope webhooks:manage | 13 §6 | 🧩 `webhooks:manage` |
| POST | `/api/v1/integrations/webhooks` | admin.api.manage o scope webhooks:manage | 13 §6 | 🧩 `webhooks:manage` |
| PATCH | `/api/v1/integrations/webhooks/{id}` | admin.api.manage | 13 §6 | 🧩 `webhooks:manage` |
| DELETE | `/api/v1/integrations/webhooks/{id}` | admin.api.manage | 13 §6 | 🧩 `webhooks:manage` |
| POST | `/api/v1/integrations/webhooks/{id}/ping` | admin.api.manage | 13 §6 |  |
| POST | `/api/v1/integrations/webhooks/{id}/rotate-secret` | admin.api.manage | 13 §6 |  |
| GET | `/api/v1/platform/coupons` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/coupons` | super_admin | 13 §6 |  |
| PATCH | `/api/v1/platform/coupons` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/dunning-policy` | super_admin | 13 §6 |  |
| PATCH | `/api/v1/platform/dunning-policy` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/feature-overrides` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/feature-overrides` | super_admin | 13 §6 |  |
| DELETE | `/api/v1/platform/feature-overrides` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/features/{key}/plans/{plan}` | super_admin | 13 §6 |  |
| PUT | `/api/v1/platform/features/{key}/plans/{plan}` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/invoices` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/invoices/{id}/dunning/extend` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/invoices/{id}/manual-payment` | super_admin | 13 §6 | 🔑 |
| POST | `/api/v1/platform/invoices/{id}/retry` | super_admin | 13 §6 | 🔑 |
| POST | `/api/v1/platform/invoices/{id}/void` | super_admin | 13 §6 | 🔑 |
| GET | `/api/v1/platform/metrics` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/plan-rules` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/plan-rules/reset-demo` | super_admin | 13 §6 | 🔑 |
| PUT | `/api/v1/platform/plan-rules/{rule_code}` | super_admin | 13 §6 | 🔒 |
| GET | `/api/v1/platform/plans/{code}` | super_admin | 13 §6 |  |
| PATCH | `/api/v1/platform/plans/{code}` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/trials` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/trials` | super_admin | 13 §6 |  |
| POST | `/api/v1/platform/trials/{tenant}/convert` | super_admin | 13 §6 | 🔑 |
| POST | `/api/v1/platform/trials/{tenant}/extend` | super_admin | 13 §6 |  |
| GET | `/api/v1/platform/usage` | super_admin | 13 §6 |  |

### Marketing y metas (50)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/crm/sales-target-policy` | crm.targets.manage (policy: admin.settings.manage) | 14 §6 |  |
| PUT | `/api/v1/crm/sales-target-policy` | crm.targets.manage (policy: admin.settings.manage) | 14 §6 |  |
| GET | `/api/v1/crm/sales-targets` | crm.targets.view \| crm.targets.manage | 14 §6 |  |
| POST | `/api/v1/crm/sales-targets` | crm.targets.manage | 14 §6 |  |
| GET | `/api/v1/crm/sales-targets/ranking` | crm.targets.view \| crm.targets.manage | 14 §6 |  |
| GET | `/api/v1/crm/sales-targets/{code}` | crm.targets.view (propia) \| crm.targets.manage | 14 §6 |  |
| POST | `/api/v1/crm/sales-targets/{code}/activate` | crm.targets.manage | 14 §6 | 🔒 |
| POST | `/api/v1/crm/sales-targets/{code}/adjust` | crm.targets.manage | 14 §6 | 🔒 |
| POST | `/api/v1/crm/sales-targets/{code}/close` | crm.targets.manage | 14 §6 | 🔑 🔒 |
| POST | `/api/v1/crm/sales-targets/{code}/void` | crm.targets.manage | 14 §6 | 🔒 |
| GET | `/api/v1/crm/sales-teams` | crm.targets.manage (policy: admin.settings.manage) | 14 §6 |  |
| PUT | `/api/v1/crm/sales-teams` | crm.targets.manage (policy: admin.settings.manage) | 14 §6 |  |
| POST | `/api/v1/integrations/email/webhooks` | firma proveedor | 14 §6 | 🪝 |
| POST | `/api/v1/integrations/whatsapp/webhooks/messages` | firma proveedor | 14 §6 | 🪝 |
| POST | `/api/v1/integrations/whatsapp/webhooks/templates` | firma Meta | 14 §6 | 🪝 |
| GET | `/api/v1/marketing/automations` | marketing.campaigns.manage | 14 §6 |  |
| PUT | `/api/v1/marketing/automations/{code}` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/automations/{code}/activate` | marketing.campaigns.manage | 14 §6 | 🔒 |
| POST | `/api/v1/marketing/automations/{code}/pause` | marketing.campaigns.manage | 14 §6 | 🔒 |
| POST | `/api/v1/marketing/automations/{code}/run` | marketing.campaigns.manage | 14 §6 | 🔑 |
| GET | `/api/v1/marketing/campaigns` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/campaigns` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/campaigns/{code}` | marketing.campaigns.manage | 14 §6 | 🔒 |
| PUT | `/api/v1/marketing/campaigns/{code}` | marketing.campaigns.manage | 14 §6 | 🔒 |
| GET | `/api/v1/marketing/campaigns/{code}/audience` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/campaigns/{code}/cancel` | marketing.campaigns.manage | 14 §6 | 🔒 |
| POST | `/api/v1/marketing/campaigns/{code}/duplicate` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/campaigns/{code}/recipients` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/campaigns/{code}/recipients/{id}/unsubscribe` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/campaigns/{code}/schedule` | marketing.campaigns.manage | 14 §6 | 🔒 |
| POST | `/api/v1/marketing/campaigns/{code}/send` | marketing.campaigns.manage | 14 §6 | 🔑 🔒 |
| POST | `/api/v1/marketing/campaigns/{code}/test-send` | marketing.campaigns.manage | 14 §6 | 🔑 |
| POST | `/api/v1/marketing/campaigns/{code}/unschedule` | marketing.campaigns.manage | 14 §6 | 🔒 |
| GET | `/api/v1/marketing/consents` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/consents` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/consents/{code}/events` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/consents/{code}/revoke` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/contacts` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/segments` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/segments` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/segments/preview` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/segments/{code}` | marketing.campaigns.manage | 14 §6 | 🔒 |
| PUT | `/api/v1/marketing/segments/{code}` | marketing.campaigns.manage | 14 §6 | 🔒 |
| DELETE | `/api/v1/marketing/segments/{code}` | marketing.campaigns.manage | 14 §6 | 🔒 |
| POST | `/api/v1/marketing/segments/{code}/duplicate` | marketing.campaigns.manage | 14 §6 |  |
| GET | `/api/v1/marketing/templates` | marketing.campaigns.manage | 14 §6 |  |
| POST | `/api/v1/marketing/templates` | marketing.campaigns.manage | 14 §6 |  |
| PUT | `/api/v1/marketing/templates/{code}` | marketing.campaigns.manage | 14 §6 | 🔒 |
| GET | `/api/v1/public/unsubscribe/{token}` | público (token firmado, sin login) | 14 §6 | 🌐 |
| POST | `/api/v1/public/unsubscribe/{token}` | público (token firmado, sin login) | 14 §6 | 🌐 |

### Sitio web público (2)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/public/reviews` | público \| X-KipuControl-Key + Origin verificado | 15 §6.1, 15 §6.7, 17 §6, 18 §6 | 🌐 |
| POST | `/api/v1/public/reviews/by-token` | — | 15 §6.7, 18 §6 | 🔑 🌐 |

### Reglas, comunicaciones y monedas (9)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| GET | `/api/v1/channels/external-reviews` | channels.ecommerce.manage \| crm.clients.manage | 17 §6 |  |
| POST | `/api/v1/channels/external-reviews/{id}/escalate` | channels.ecommerce.manage \| crm.clients.manage | 17 §6 | 🔑 |
| POST | `/api/v1/channels/external-reviews/{id}/mark-published` | channels.ecommerce.manage \| crm.clients.manage | 17 §6 | 🔑 |
| POST | `/api/v1/channels/external-reviews/{id}/reply` | channels.ecommerce.manage \| crm.clients.manage | 17 §6 | 🔑 |
| GET | `/api/v1/integrations/review-sources` | admin.settings.manage | 17 §6 |  |
| POST | `/api/v1/integrations/review-sources` | admin.settings.manage | 17 §6 | 🔑 |
| DELETE | `/api/v1/integrations/review-sources/{provider}` | admin.settings.manage | 17 §6 | 🔑 |
| POST | `/api/v1/integrations/review-sources/{provider}/sync` | admin.settings.manage | 17 §6 |  |
| POST | `/api/v1/reservations/{id}/review-invitations` | channels.ecommerce.manage \| crm.clients.manage | 17 §6 | 🔑 |

### Reseñas propias (16)

| Método | Ruta | Permiso | Spec | Marcas |
|---|---|---|---|---|
| POST | `/api/v1/passenger/reviews` | passenger | 08 §6.8, 18 §6 | 🔑 |
| GET | `/api/v1/passenger/reviews/eligibility` | passenger (su reserva) \| passenger (reserva del token) | 08 §6.8, 18 §6 |  |
| GET | `/api/v1/review-requests` | channels.ecommerce.manage | 18 §6 |  |
| POST | `/api/v1/review-requests/schedule-pending` | channels.ecommerce.manage | 18 §6 | 🔑 |
| POST | `/api/v1/review-requests/{code}/cancel` | channels.ecommerce.manage | 18 §6 |  |
| POST | `/api/v1/review-requests/{code}/send` | channels.ecommerce.manage | 18 §6 |  |
| GET | `/api/v1/reviews` | channels.ecommerce.manage \| crm.clients.manage | 18 §6 |  |
| POST | `/api/v1/reviews/export-feed` | channels.ecommerce.manage | 18 §6 | 🔑 |
| GET | `/api/v1/reviews/stats` | channels.ecommerce.manage \| crm.clients.manage | 18 §6 |  |
| GET | `/api/v1/reviews/{code}` | channels.ecommerce.manage \| crm.clients.manage + policy | 18 §6 |  |
| POST | `/api/v1/reviews/{code}/hide` | channels.ecommerce.manage | 18 §6 | 🔒 |
| POST | `/api/v1/reviews/{code}/publish` | channels.ecommerce.manage | 18 §6 | 🔒 |
| POST | `/api/v1/reviews/{code}/reject` | channels.ecommerce.manage | 18 §6 | 🔒 |
| PUT | `/api/v1/reviews/{code}/reply` | channels.ecommerce.manage | 18 §6 | 🔒 |
| GET | `/api/v1/settings/own-reviews` | channels.ecommerce.manage (params de la regla: admin.settings.manage) | 18 §6 |  |
| PATCH | `/api/v1/settings/own-reviews` | channels.ecommerce.manage (params de la regla: admin.settings.manage) | 18 §6 |  |

## Conflictos y deduplicación

32 operaciones aparecen en más de una fila/spec. Se conserva la fuente del dominio dueño (o la primera) y su fase, la idempotencia/lock más estricta y, si el permiso difiere, se documenta la unión (`a | b`) para decidir en la implementación.

### Con diferencias (25)

| Método | Ruta | Fuentes | Diferencia |
|---|---|---|---|
| POST | `/api/v1/auth/invitations/{token}/accept` | 00 §6; 09 §6.2 Usuarios y sedes (PROC-002) | permiso: «público» (00) ≠ «público (token)» (09) |
| DELETE | `/api/v1/catalog/products/{id}/b2b-rates/{agencyId}` | 02 §6.2 Sub-recursos del producto; 08 §6.1 Back-office B2B | permiso: «catalog.products.update» (02) ≠ «channels.b2b.manage \| catalog.products.manage_b2b» (08)<br>fase: [1, 2] → 1 (la de la spec dueña del dominio) |
| POST | `/api/v1/catalog/products/{id}/promotions` | 02 §6.2 Sub-recursos del producto; 08 §6.3 E-commerce | permiso: «catalog.products.update» (02) ≠ «channels.ecommerce.manage \| catalog.products.manage_promotions» (08)<br>fase: [1, 2] → 1 (la de la spec dueña del dominio) |
| POST | `/api/v1/quotes/{id}/versions/{v}/internal-approval` | 03 §6; 09 §6.7 Auditoría, reportes, exportación y dashboard | permiso: «quotes.approve_internal (+ quotes.discount_override si > 10 %)» (03) ≠ «quotes.approve_internal» (09)<br>fase: [0, 1] → 1 (la de la spec dueña del dominio) |
| POST | `/api/v1/quotes/{id}/convert` | 03 §6; 04 §6 | If-Match: declarado solo en 04 → se exige |
| POST | `/api/v1/finance/payments` | 04 §6; 07 §6.2 Pagos | If-Match: declarado solo en 07 → se exige |
| GET | `/api/v1/mobile/operator/assignments/{id}` | 05 §6.7 App operador (`/mobile/operator`, token Sanctum de guía/conductor; Policy por recurso); 05 §6.9 v2.1 | permiso: «operations.view + vínculo recurso + AssignmentPolicy» (05) ≠ «guía/conductor» (05) |
| GET | `/api/v1/mobile/passenger/messages` | 05 §6.8 App pasajero (`/mobile/passenger`, rol passenger; también la consume el portal del pasajero); 05 §6.9 v2.1 | permiso: «reservations.view + vínculo» (05) ≠ «passenger» (05) |
| POST | `/api/v1/webhooks/payments/{gateway}` | 08 §6.3 E-commerce; 13 §6; 15 §6.3 Checkout y pago | permiso: «firma del proveedor» (08) ≠ «firma de la pasarela» (13) ≠ «firma HMAC del proveedor» (15)<br>fase: [2, 3] → 2 (la de la spec dueña del dominio) |
| PUT | `/api/v1/portal/customer/reservations/{code}/companions` | 08 §6.7 v2.1 — Endpoints de portales; 15 §6.6 v2.1 — Motor de reservas público | permiso: «customer» (08) ≠ «cliente dueño» (15) |
| GET | `/api/v1/passenger/reviews/eligibility` | 08 §6.8 v2.2 — Endpoints de reseñas del pasajero; 18 §6 | permiso: «passenger (reserva del token)» (08) ≠ «passenger (su reserva)» (18) |
| POST | `/api/v1/platform/tenants/{id}/suspend` | 09 §6.1 Plataforma (PROC-001); 13 §6 | permiso: «admin.tenant.manage» (09) ≠ «super_admin» (13)<br>If-Match: declarado solo en 09 → se exige<br>fase: [0, 3] → 0 (la de la spec dueña del dominio) |
| POST | `/api/v1/platform/tenants/{id}/reactivate` | 09 §6.1 Plataforma (PROC-001); 13 §6 | permiso: «admin.tenant.manage» (09) ≠ «super_admin» (13)<br>If-Match: declarado solo en 09 → se exige<br>fase: [0, 3] → 0 (la de la spec dueña del dominio) |
| GET | `/api/v1/audit-events` | 09 §6.3 Roles y permisos; 09 §6.7 Auditoría, reportes, exportación y dashboard | permiso: «admin.roles.manage» (09) ≠ «admin.audit.view» (09) |
| POST | `/api/v1/public/contact` | 10 §6; 15 §6.4 Captación y legal | permiso: «rate limit» (10) ≠ «público + captcha» (15)<br>idempotencia: none (10), required (15) → se aplica «required» |
| GET | `/api/v1/public/products` | 15 §6.1 Catálogo y contenido (GET, cache); 17 §6 | permiso: «público» (15) ≠ «X-KipuControl-Key + Origin verificado» (17) |
| GET | `/api/v1/public/products/{slug}` | 15 §6.1 Catálogo y contenido (GET, cache); 17 §6 | permiso: «público» (15) ≠ «X-KipuControl-Key + Origin verificado» (17) |
| GET | `/api/v1/public/reviews` | 15 §6.1 Catálogo y contenido (GET, cache); 15 §6.7 v2.2 — Reseñas públicas; 17 §6; 18 §6 | permiso: «público» (18) ≠ «X-KipuControl-Key + Origin verificado» (17) |
| POST | `/api/v1/public/carts` | 15 §6.2 Precio, disponibilidad, carrito; 17 §6 | permiso: «público» (15) ≠ «X-KipuControl-Key + Origin verificado» (17) |
| POST | `/api/v1/public/checkout/orders` | 15 §6.3 Checkout y pago; 15 §6.6 v2.1 — Motor de reservas público | If-Match: declarado solo en 15 → se exige |
| GET | `/api/v1/public/products/{slug}/availability` | 15 §6.6 v2.1 — Motor de reservas público; 16 §6.1 Públicas (sitio, widget, CMS externo) — autenticación por *publishable key* del tenant + rate limit Redis; 17 §6 | permiso: «público» (15) ≠ «pública» (16) ≠ «X-KipuControl-Key + Origin verificado» (17) |
| POST | `/api/v1/public/quote` | 15 §6.6 v2.1 — Motor de reservas público; 16 §6.1 Públicas (sitio, widget, CMS externo) — autenticación por *publishable key* del tenant + rate limit Redis; 17 §6 | permiso: «público» (15) ≠ «pública» (16) ≠ «X-KipuControl-Key + Origin verificado» (17) |
| PUT | `/api/v1/catalog/products/{id}/rule-overrides/{code}` | 16 §6.2 Internas (back-office); 17 §6 | permiso: «catalog.products.update» (16) ≠ «admin.settings.manage» (17)<br>If-Match: declarado solo en 17 → se exige |
| DELETE | `/api/v1/catalog/products/{id}/rule-overrides/{code}` | 16 §6.2 Internas (back-office); 17 §6 | permiso: «catalog.products.update» (16) ≠ «admin.settings.manage» (17)<br>If-Match: declarado solo en 17 → se exige |
| PATCH | `/api/v1/admin/booking-rules/{code}` | 16 §6.2 Internas (back-office); 17 §6 | If-Match: declarado solo en 17 → se exige |

### Repetidos idénticos (7)

- GET `/api/v1/catalog/products/{id}/availability` — 02 §6.2 Sub-recursos del producto; 16 §6.2 Internas (back-office)
- GET `/api/v1/quotes/{id}/conversion-preview` — 03 §6; 04 §6
- GET `/api/v1/ops/orders/{id}` — 05 §6.1 Órdenes y tareas; 05 §6.9 v2.1
- POST `/api/v1/passenger/reviews` — 08 §6.8 v2.2 — Endpoints de reseñas del pasajero; 18 §6
- POST `/api/v1/public/carts/current/items` — 15 §6.2 Precio, disponibilidad, carrito; 15 §6.6 v2.1 — Motor de reservas público
- POST `/api/v1/public/reviews/by-token` — 15 §6.7 v2.2 — Reseñas públicas; 18 §6
- GET `/api/v1/admin/booking-rules` — 16 §6.2 Internas (back-office); 17 §6; 17 §6

### Alias de ruta aplicados

- `/api/v1/operations/rooming/prefill` → `/api/v1/ops/rooming/prefill` (05). 05 §6.9 (v2.1) usa `/operations/…`; 05 §6.1–6.6 fija `/ops/…`.
- `/api/v1/operations/orders/{code}` → `/api/v1/ops/orders/{code}` (05). 05 §6.9 (v2.1) usa `/operations/…`; 05 §6.1–6.6 fija `/ops/…`.
- `/api/v1/fin/supplier-invoices/{id}/validate` → `/api/v1/finance/supplier-invoices/{id}/validate` (06). 06 §6 usa `/fin/supplier-invoices`; 07 §6 fija el prefijo `/api/v1/finance`.
- `/api/v1/fin/supplier-invoices/{id}/observe` → `/api/v1/finance/supplier-invoices/{id}/observe` (06). 06 §6 usa `/fin/supplier-invoices`; 07 §6 fija el prefijo `/api/v1/finance`.
- `/api/v1/fin/supplier-invoices/{id}/reject` → `/api/v1/finance/supplier-invoices/{id}/reject` (06). 06 §6 usa `/fin/supplier-invoices`; 07 §6 fija el prefijo `/api/v1/finance`.
- `/api/v1/customer/reservations/{code}/companions` → `/api/v1/portal/customer/reservations/{code}/companions` (15). 15 §6.6 usa `/customer/reservations/{code}/companions`; 08 §6.7 define la misma operación en `/portal/customer/…`.

### Nombres de parámetros de ruta unificados

Mismo recurso con distinto nombre de parámetro entre specs (`{id}`/`{code}`…). Se usa el nombre más frecuente en ese prefijo. **Supuesto:** el backend resuelve el recurso por UUID o por `code` (route model binding).

- GET `/api/v1/reservations/{code}/web-snapshot` → `/api/v1/reservations/{id}/web-snapshot` (04 §6)
- PATCH `/api/v1/reservations/{code}/passengers/{id}` → `/api/v1/reservations/{id}/passengers/{pid}` (04 §6)
- GET `/api/v1/reservations/{code}/pax-feedback` → `/api/v1/reservations/{id}/pax-feedback` (04 §6)
- GET `/api/v1/reservations/{code}/pax-messages` → `/api/v1/reservations/{id}/pax-messages` (04 §6)
- GET `/api/v1/ops/orders/{code}` → `/api/v1/ops/orders/{id}` (05 §6.9)
- POST `/api/v1/webhooks/payments/{provider}` → `/api/v1/webhooks/payments/{gateway}` (08 §6.3)
- GET `/api/v1/public/products/{id}/availability` → `/api/v1/public/products/{slug}/availability` (16 §6.1)
- PUT `/api/v1/catalog/products/{id}/rule-overrides/{ruleKey}` → `/api/v1/catalog/products/{id}/rule-overrides/{code}` (16 §6.2)
- PATCH `/api/v1/admin/booking-rules/{ruleKey}` → `/api/v1/admin/booking-rules/{code}` (16 §6.2)
- GET `/api/v1/public/products/{code}` → `/api/v1/public/products/{slug}` (17 §6)
- GET `/api/v1/public/products/{code}/availability` → `/api/v1/public/products/{slug}/availability` (17 §6)

### Expansiones de celdas abreviadas (supuestos)

- 00 §6 — `/api/v1/platform/auth/login · /mfa/verify`: Expansión explícita (CELL_OVERRIDES).
- 08 §6.5 — `/api/v1/channels/portal-preview/clients/{clientId}/…`: La spec usa `…` (mismos GET del portal del cliente en solo lectura). Se modela como `{portalPath}` (supuesto).
- 08 §6.7 — `/api/v1/portal/passenger/messages/{id}/read · /read-all`: `/read-all` se interpreta a nivel de colección (`/messages/read-all`), igual que `/me/notifications/read-all`.
- 10 §6 — `/api/v1/integrations/whatsapp/webhook · /email/inbound · /public/contact`: Expansión explícita (CELL_OVERRIDES).
- 11 §6 — `…/{type}/validate`: `…` resuelto contra la fila anterior → `/api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/validate`
- 11 §6 — `…/{type}/observe`: `…` resuelto contra la fila anterior → `/api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/observe`
- 11 §6 — `…/{passengerId}/special-attention`: `…` resuelto contra la fila anterior → `/api/v1/reservations/{id}/travel-docs/{passengerId}/special-attention`
- 12 §6 — `/api/v1/crm/claim-book/reports?group=type|sede|month · POST /exports`: «POST `/exports`» se interpreta como `/crm/claim-book/exports` (hermano de `reports`).
- 13 §6 — `/api/v1/integrations/oauth-apps (+ /{id}/secret)`: «Registro, rotación y revocación»: rotación = POST `/{id}/secret`, revocación = DELETE `/{id}` (supuesto).
- 14 §6 — `/api/v1/integrations/email/webhooks · /whatsapp/webhooks/messages`: Expansión explícita (CELL_OVERRIDES).

### Rutas ambiguas (resolver con restricciones de ruta en Laravel)

Pares cruzados: una misma URL podría satisfacer ambas y ninguna es más específica. Resolver con restricciones (`->whereUuid('id')`, `->where('tenant', …)`) o renombrando en la spec. Los casos literal-vs-parámetro simples (`/quotes/kpis` vs `/quotes/{id}`) no se listan: basta registrar la ruta literal antes que la parametrizada.

- `/api/v1/approvals/cancel-preview/{reservation}` ↔ `/api/v1/approvals/{code}/approve`
- `/api/v1/approvals/cancel-preview/{reservation}` ↔ `/api/v1/approvals/{code}/delegate`
- `/api/v1/approvals/cancel-preview/{reservation}` ↔ `/api/v1/approvals/{code}/info-requests`
- `/api/v1/approvals/cancel-preview/{reservation}` ↔ `/api/v1/approvals/{code}/reject`
- `/api/v1/approvals/cancel-preview/{reservation}` ↔ `/api/v1/approvals/{code}/resubmit`
- `/api/v1/approvals/cancel-preview/{reservation}` ↔ `/api/v1/approvals/{code}/withdraw`
- `/api/v1/integrations/api-keys/{id}` ↔ `/api/v1/integrations/{id}/config`
- `/api/v1/integrations/api-keys/{id}` ↔ `/api/v1/integrations/{id}/test`
- `/api/v1/integrations/oauth-apps/{id}` ↔ `/api/v1/integrations/{id}/config`
- `/api/v1/integrations/oauth-apps/{id}` ↔ `/api/v1/integrations/{id}/test`
- `/api/v1/integrations/review-sources/{provider}` ↔ `/api/v1/integrations/{id}/config`
- `/api/v1/integrations/review-sources/{provider}` ↔ `/api/v1/integrations/{id}/test`
- `/api/v1/integrations/webhooks/{id}` ↔ `/api/v1/integrations/{id}/config`
- `/api/v1/integrations/webhooks/{id}` ↔ `/api/v1/integrations/{id}/test`
- `/api/v1/public/destinations/{slug}` ↔ `/api/v1/public/{tenant}/claim-book`
- `/api/v1/public/orders/{code}` ↔ `/api/v1/public/{tenant}/claim-book`
- `/api/v1/public/pages/{slug}` ↔ `/api/v1/public/{tenant}/claim-book`
- `/api/v1/public/posts/{slug}` ↔ `/api/v1/public/{tenant}/claim-book`
- `/api/v1/public/products/{slug}` ↔ `/api/v1/public/{tenant}/claim-book`
- `/api/v1/public/quotes/{token}` ↔ `/api/v1/public/{tenant}/claim-book`
- `/api/v1/public/unsubscribe/{token}` ↔ `/api/v1/public/{tenant}/claim-book`

### Otros supuestos del contrato

- Scopes de API key/OAuth: solo se declaran en las rutas de la tabla «Endpoints públicos del tenant» del prototipo y en las lecturas/escrituras equivalentes que describe cada scope; el resto de rutas acepta solo Sanctum.
- Webhooks entrantes: no exigen `Idempotency-Key` (el proveedor no la envía); la deduplicación es por id de evento del proveedor (`x-idempotency.mode = webhook`).
- `requestBody` de alta/edición usa `<Recurso>Input` (columnas escribibles de §3, sin `required`); la obligatoriedad real la definen los FormRequest. Acciones usan el cuerpo que describe la spec (`{…}`) o `ActionBody`.
- Respuestas envueltas en `data` (JsonResource). Tipos PostgreSQL → JSON Schema: uuid→string/uuid, numeric→string decimal, timestamptz→date-time, date→date, jsonb→object, CHECK IN (…)→enum.
- Cabeceras `X-Order-Token` y `X-Signature` y el dominio de staging son nombres propuestos (la spec no los fija).

### Avisos del parser de §3

- 15 §3: tabla sin nombre reconocible antes de «Desde v2.1 **cada línea del carrito genera una reserva** (un» (omitida)

## Canales en tiempo real (Reverb)

- `private-tenant.{tenantId}.user.{userId} (Reverb)` — autenticado — Notificaciones, cambios de permisos (refresca menú) (00)
- `private-webchat.{session}` — token de sesión de chat — Chat web (SIT-BR-24) vía Reverb (15)
