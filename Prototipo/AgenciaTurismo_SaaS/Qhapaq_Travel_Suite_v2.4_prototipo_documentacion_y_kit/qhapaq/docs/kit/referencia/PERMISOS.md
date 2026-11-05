# Modelo de permisos, roles y acceso a pantallas

> Generado por `kit-ia/referencia/tools/extract_access.js` ejecutando el prototipo (`proto/index.html`) en Chromium headless: `DB.roles`, `DB.permissionGroups`, `DB.rolePerms`, `Access.ROUTES` (ACCESS), `Access.ROLE_UX`, `App.NAV` y las rutas registradas con `App.register`; el acceso se evalúa con `Access.checkFor`, la misma función del «Mapa de acceso» de Administración › Roles. Especificación de referencia: 00 §7 y 09 (RBAC-BR, USR-BR).

**Cifras:** 57 permisos en 11 módulos · 13 roles de sistema · 84 rutas evaluadas (60 del menú, 81 registradas en el router) · verificación contra el «Mapa de acceso» en pantalla: 832 celdas comparadas, 0 diferencias.

Archivos: `PERMISOS-ROL.csv` (permiso × rol, 1/0, con descripción y pantallas que habilita) · `ACCESO-PANTALLAS.csv` (ruta × rol: `permitido`/`denegado` y permisos requeridos).

## 1. Cómo funciona

1. **Permisos** con nombre `modulo.recurso.accion` (spatie/laravel-permission con *teams* = tenant). El backend valida cada endpoint con Policy + permiso (`x-permissions` del contrato); el frontend solo oculta o deshabilita (SEC-BR-03, SEC-BR-14). En backend no se admiten comodines; el prototipo acepta prefijos terminados en `.` pero ningún rol semilla los usa.
2. **Roles**: 13 roles de sistema (plantillas con `tenant_id NULL`) y roles personalizados por tenant (`custom_…`) que heredan la experiencia de su `scope`. La matriz semilla es `DB.rolePerms` (tablas `roles`, `permissions`, `role_has_permissions`).
3. **Acceso a pantallas** (`Access.check` / `GET /api/v1/me/access`): (a) sin sesión → login; (b) experiencia externa → solo sus prefijos de `ROLE_UX.routes`; (c) Super Admin → solo `admin/tenants`, `admin/plataforma`, `admin/integraciones`, `admin/auditoria`; (d) resto → se busca en ACCESS el **prefijo más largo** de la ruta; `*` o sin entrada = permitido; si no, basta **cualquiera** de los permisos listados. Menú, URL directa y búsqueda global usan la misma regla; el 403 se audita (SEC-BR-07).
4. **Alcance de datos (ownership)**: Ventas (`sales`) solo ve y gestiona su cartera (`owner_id = auth.id`): leads (también sin asignar en contadores), oportunidades, actividades, cotizaciones, reservas y clientes derivados (`clientIds()` = propios ∪ de sus oportunidades/cotizaciones/reservas). Detalle ajeno → 403 `SCOPE_OWNERSHIP`; `filter[owner]=me` forzado en servidor. Manager y Tenant Admin ven todo el tenant con filtro «Asesor» (SEC-BR-09/10/11).
5. **Datos sensibles**: costos, márgenes y utilidad solo con `finance.profitability`, `catalog.products.view_profitability` o `quotes.approve_internal`; Operaciones ve costos de proveedor pero no márgenes; externos nunca ven costos (SEC-BR-13, `JsonResource` condicional).
6. **Usuarios externos** (guía, conductor, B2B, cliente, pasajero, proveedor): nunca entran al back-office; solo a su portal/app y siempre filtrados por su vínculo (`client_id`, `reservation_id`, `agency_id`, `provider_id`, `guide_id`/`driver_id`; SEC-BR-05/12). Sus permisos se interpretan con ese alcance (p. ej. `reservations.view` de un cliente = sus reservas). API separada por experiencia: `/api/v1/portal/client/*`, `/portal/passenger/*`, `/b2b/*`, `/supplier/*`, `/mobile/operator/*` (abilities del token).

## 2. Roles y experiencias (ROLE_UX)

| Rol | Abrev. | Nombre | Descripción | scope | Experiencia | Inicio | Rutas permitidas | Nº permisos |
|---|---|---|---|---|---|---|---|---|
| `super_admin` | SA | Super Admin SaaS | Plataforma, planes y tenants | plataforma | backoffice · Consola de plataforma | `#/admin/tenants` | admin/tenants, admin/plataforma, admin/integraciones, admin/auditoria (regla fija) | 2 |
| `tenant_admin` | TA | Tenant Admin | Administración completa del tenant | tenant | backoffice | `#/dashboard` | según ACCESS | 56 |
| `manager` | MG | Manager | Supervisión, aprobaciones y reportes | tenant | backoffice | `#/dashboard` | según ACCESS | 47 |
| `sales` | VT | Ventas (Sales) | CRM, clientes y cotizaciones | tenant | backoffice | `#/dashboard` | según ACCESS | 16 |
| `operations` | OP | Operaciones | Reservas, proveedores y ejecución | tenant | backoffice | `#/dashboard` | según ACCESS | 16 |
| `finance` | FI | Finanzas | Cobros, pagos, costos y rentabilidad | tenant | backoffice | `#/dashboard` | según ACCESS | 15 |
| `accounting` | CO | Contabilidad | Facturación y procesos contables | tenant | backoffice | `#/dashboard` | según ACCESS | 6 |
| `guide` | GU | Guía | Ejecución de servicios (app operador) | mobile | mobile · App del operador | `#/mobile/operador` | mobile/operador | 2 |
| `driver` | CD | Conductor | Transporte (app operador) | mobile | mobile · App del operador | `#/mobile/operador` | mobile/operador | 2 |
| `b2b` | B2B | Usuario B2B | Agencia asociada — canal B2B | canal | portal · Portal de agencias | `#/canales/b2b/portal/catalogo` | canales/b2b/portal | 4 |
| `customer` | CL | Cliente | Portal del cliente | canal | portal · Portal del cliente | `#/canales/portal-cliente/CLI-0001/inicio` | canales/portal-cliente/CLI-0001, libro-reclamaciones | 2 |
| `passenger` | PA | Pasajero | Portal / app del pasajero | canal | portal · Portal del pasajero | `#/canales/portal-pasajero/viajes` | canales/portal-pasajero, mobile/pasajero, libro-reclamaciones | 1 |
| `provider` | PR | Proveedor | Confirmación de solicitudes | canal | portal · Extranet de proveedores | `#/proveedor/solicitudes` | proveedor | 1 |

## 3. Catálogo de permisos y matriz por rol

✓ = el rol semilla tiene el permiso. *Pantallas* = rutas de ACCESS que el permiso habilita (por sí solo o como alternativa).

| Permiso | Módulo | Descripción | Pantallas | SA | TA | MG | VT | OP | FI | CO | GU | CD | B2B | CL | PA | PR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `admin.tenant.manage` | Administración | tenants y planes de la plataforma | `admin/tenants`, `admin/integraciones`, `admin/plataforma`, `admin` | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `admin.users.manage` | Administración | usuarios y sedes | `admin/usuarios`, `admin` | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `admin.roles.manage` | Administración | roles y permisos | `admin/roles` | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `admin.settings.manage` | Administración | configuración, notificaciones e integraciones | `admin/configuracion`, `admin/notificaciones`, `admin/integraciones`, `admin/reglas`, `admin/comunicaciones`, `admin/monedas` | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `admin.audit.view` | Administración | consultar auditoría | `admin/auditoria` | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `admin.billing.manage` | Administración | suscripción, plan y facturación de la plataforma (admin/suscripcion) — derivada de la pantalla (supuesto) | `admin/suscripcion` | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `admin.api.manage` | Administración | API keys, apps OAuth y webhooks del tenant (admin/api) — derivada de la pantalla (supuesto) | `admin/api`, `canales/integracion-web` | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `approvals.view` | Colaboración | bandeja de aprobaciones (aprobaciones) — derivada de la pantalla (supuesto) | `aprobaciones` | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `inbox.view` | Colaboración | consultar la bandeja omnicanal (inbox) — derivada de la pantalla (supuesto) | `inbox` | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · |
| `inbox.manage` | Colaboración | responder y gestionar conversaciones del inbox — derivada de la pantalla (supuesto) | — (acciones dentro de pantallas) | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · |
| `crm.leads.view` | CRM | ver leads | `crm/leads`, `crm` | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `crm.leads.manage` | CRM | gestionar leads | — (acciones dentro de pantallas) | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `crm.opportunities.manage` | CRM | oportunidades | `crm/oportunidades` | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `crm.activities.manage` | CRM | actividades | `crm/actividades` | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `crm.clients.manage` | CRM | clientes 360 y postventa | `crm/clientes`, `crm/postventa`, `canales/portal-cliente`, `canales/resenas-propias`, `canales/resenas` | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `crm.targets.view` | CRM | consultar metas comerciales (crm/metas) — derivada de la pantalla (supuesto) | `crm/metas` | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `crm.targets.manage` | CRM | crear y ajustar metas comerciales — derivada de la pantalla (supuesto) | `crm/metas` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `crm.claims.manage` | CRM | reclamaciones y libro de reclamaciones — derivada de la pantalla (supuesto) | `crm/reclamaciones`, `libro-reclamaciones` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `marketing.campaigns.manage` | Marketing | campañas, segmentos y automatizaciones de marketing — derivada de la pantalla (supuesto) | `marketing` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `catalog.products.view` | Catálogo | consultar oferta | `catalogo/productos`, `catalogo/salidas`, `catalogo/tarifas`, `catalogo/servicios`, `catalogo/destinos`, `catalogo` | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · | · |
| `catalog.products.create` | Catálogo | crear productos | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `catalog.products.update` | Catálogo | editar productos | `catalogo/proveedores`, `catalogo/categorias` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `catalog.products.activate` | Catálogo | activar / inactivar | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `catalog.products.manage_rates` | Catálogo | tarifas y temporadas | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `catalog.products.manage_availability` | Catálogo | salidas, cupos y holds | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `catalog.products.view_profitability` | Catálogo | ver costos y márgenes | `catalogo/cupos` | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `catalog.products.publish` | Catálogo | publicar en canales | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `catalog.providers.manage` | Catálogo | gestionar proveedores y servicios | `catalogo/proveedores` | · | ✓ | · | · | ✓ | · | · | · | · | · | · | · | · |
| `catalog.allotments.manage` | Catálogo | contratos de cupos (allotments) y liberaciones — derivada de la pantalla (supuesto) | `catalogo/cupos` | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `quotes.view` | Cotizaciones | consultar | `cotizaciones` | · | ✓ | ✓ | ✓ | · | ✓ | · | · | · | · | ✓ | · | · |
| `quotes.create` | Cotizaciones | crear | — (acciones dentro de pantallas) | · | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | · | · | · |
| `quotes.approve_internal` | Cotizaciones | aprobar internamente | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `quotes.send` | Cotizaciones | enviar al cliente | — (acciones dentro de pantallas) | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `quotes.discount_override` | Cotizaciones | autorizar descuentos | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `reservations.view` | Reservas | consultar | `reservas` | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | ✓ | ✓ | · |
| `reservations.create` | Reservas | crear | `operaciones/documentos-viaje` | · | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | · | · | · |
| `reservations.modify` | Reservas | modificar | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `reservations.cancel` | Reservas | cancelar | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `operations.view` | Operaciones | consultar | `operaciones` | · | ✓ | ✓ | · | ✓ | · | · | ✓ | ✓ | · | · | · | ✓ |
| `operations.assign` | Operaciones | asignar recursos | `canales/portal-pasajero`, `mobile`, `admin/comunicaciones` | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `operations.vouchers` | Operaciones | emitir vouchers | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `operations.incidents` | Operaciones | registrar incidencias | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | ✓ | · | · | ✓ | ✓ | · | · | · | · |
| `operations.close` | Operaciones | cerrar servicios | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `operations.travel_docs` | Operaciones | documentos de viaje de los pasajeros — derivada de la pantalla (supuesto) | `operaciones/documentos-viaje` | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `finance.receivables` | Finanzas | cuentas por cobrar | `crm/clientes`, `finanzas/cobros`, `finanzas/pagos`, `finanzas` | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `finance.payments.register` | Finanzas | registrar pagos | `finanzas/pagos`, `finanzas/conciliacion` | · | ✓ | · | · | · | ✓ | · | · | · | · | · | · | · |
| `finance.payments.revert` | Finanzas | revertir pagos | — (acciones dentro de pantallas) | · | ✓ | · | · | · | ✓ | · | · | · | · | · | · | · |
| `finance.payables` | Finanzas | cuentas por pagar | `catalogo/proveedores`, `finanzas/proveedores` | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `finance.commissions` | Finanzas | comisiones | `finanzas/comisiones` | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `finance.profitability` | Finanzas | rentabilidad | `finanzas/rentabilidad`, `finanzas/facturacion`, `finanzas/conciliacion` | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `finance.invoicing` | Finanzas | facturación electrónica | `finanzas/facturacion`, `finanzas` | · | ✓ | · | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `finance.treasury` | Finanzas | tesorería: cuentas, caja chica y movimientos — derivada de la pantalla (supuesto) | `finanzas/tesoreria`, `admin/monedas` | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `channels.b2b.manage` | Canales | canal B2B | `canales/b2b`, `canales/portal-cliente`, `canales/portal-pasajero` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `channels.ecommerce.manage` | Canales | e-commerce | `canales/ecommerce`, `canales/resenas-propias`, `canales/resenas`, `canales/integracion-web` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `channels.cms.publish` | Canales | CMS | `canales/cms`, `canales/portal-cliente`, `canales/portal-pasajero` | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `reports.view` | Reportes | consultar reportes | `reportes` | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| `reports.export` | Reportes | exportar y programar | — (acciones dentro de pantallas) | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |

## 4. Acceso a pantallas (resumen)

Rutas del menú y portales; la lista completa (incluidas todas las rutas registradas en el router) está en `ACCESO-PANTALLAS.csv`.

| Ruta | Grupo | Permiso requerido (cualquiera) | SA | TA | MG | VT | OP | FI | CO | GU | CD | B2B | CL | PA | PR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/dashboard` | General | * (cualquier rol interno) | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| `#/flujo` | General | * (cualquier rol interno) | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| `#/aprobaciones` | General | approvals.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/inbox` | General | inbox.view | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · |
| `#/crm/leads` | Comercial · CRM | crm.leads.view | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/crm/oportunidades` | Comercial · CRM | crm.opportunities.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/crm/actividades` | Comercial · CRM | crm.activities.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/crm/clientes` | Comercial · CRM | crm.clients.manage \| finance.receivables | · | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | · | · |
| `#/crm/postventa` | Comercial · CRM | crm.clients.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/crm/metas` | Comercial · CRM | crm.targets.view \| crm.targets.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/crm/reclamaciones` | Comercial · CRM | crm.claims.manage | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/marketing/campanas` | Marketing | marketing.campaigns.manage | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/catalogo/productos` | Catálogo turístico | catalog.products.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/catalogo/salidas` | Catálogo turístico | catalog.products.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/catalogo/tarifas` | Catálogo turístico | catalog.products.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/catalogo/cupos` | Catálogo turístico | catalog.allotments.manage \| catalog.products.view_profitability | · | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/catalogo/servicios` | Catálogo turístico | catalog.products.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/catalogo/proveedores` | Catálogo turístico | catalog.providers.manage \| finance.payables \| catalog.products.update | · | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/catalogo/destinos` | Catálogo turístico | catalog.products.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `#/cotizaciones` | Ventas | quotes.view | · | ✓ | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · |
| `#/reservas` | Ventas | reservations.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| `#/operaciones/ordenes` | Operaciones | operations.view | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/operaciones/calendario` | Operaciones | operations.view | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/operaciones/asignaciones` | Operaciones | operations.view | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/operaciones/rooming` | Operaciones | operations.view | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/operaciones/vouchers` | Operaciones | operations.view | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/operaciones/documentos-viaje` | Operaciones | operations.travel_docs \| reservations.create | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · |
| `#/operaciones/incidencias` | Operaciones | operations.view | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/finanzas/cobros` | Finanzas | finance.receivables | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `#/finanzas/pagos` | Finanzas | finance.payments.register \| finance.receivables | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `#/finanzas/proveedores` | Finanzas | finance.payables | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `#/finanzas/comisiones` | Finanzas | finance.commissions | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `#/finanzas/rentabilidad` | Finanzas | finance.profitability | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `#/finanzas/facturacion` | Finanzas | finance.invoicing \| finance.profitability | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `#/finanzas/tesoreria` | Finanzas | finance.treasury | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `#/finanzas/conciliacion` | Finanzas | finance.payments.register \| finance.profitability | · | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · |
| `#/canales/b2b` | Canales | channels.b2b.manage | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/canales/ecommerce` | Canales | channels.ecommerce.manage | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/canales/cms` | Canales | channels.cms.publish | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/canales/integracion-web` | Canales | channels.ecommerce.manage \| admin.api.manage | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/canales/resenas-propias` | Canales | channels.ecommerce.manage \| crm.clients.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/canales/resenas` | Canales | channels.ecommerce.manage \| crm.clients.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/canales/portal-cliente` | Canales | channels.b2b.manage \| channels.cms.publish \| crm.clients.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| `#/canales/portal-pasajero` | Canales | channels.b2b.manage \| channels.cms.publish \| operations.assign | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | ✓ | · |
| `#/mobile/operador` | Móvil | operations.assign | · | ✓ | ✓ | · | ✓ | · | · | ✓ | ✓ | · | · | · | · |
| `#/mobile/pasajero` | Móvil | operations.assign | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | ✓ | · |
| `#/reportes` | Inteligencia | reports.view | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| `#/admin/tenants` | Administración | admin.tenant.manage | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/plataforma` | Administración | admin.tenant.manage | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/usuarios` | Administración | admin.users.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/roles` | Administración | admin.roles.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/configuracion` | Administración | admin.settings.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/reglas` | Administración | admin.settings.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/comunicaciones` | Administración | admin.settings.manage \| operations.assign | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | · | · |
| `#/admin/monedas` | Administración | admin.settings.manage \| finance.treasury | · | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · |
| `#/admin/notificaciones` | Administración | admin.settings.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/suscripcion` | Administración | admin.billing.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/api` | Administración | admin.api.manage | · | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/integraciones` | Administración | admin.settings.manage \| admin.tenant.manage | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `#/admin/auditoria` | Administración | admin.audit.view | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · |
| `#/canales/b2b/portal/catalogo` | Portales y apps externas | channels.b2b.manage | · | ✓ | ✓ | · | · | · | · | · | · | ✓ | · | · | · |
| `#/canales/portal-cliente/CLI-0001/inicio` | Portales y apps externas | channels.b2b.manage \| channels.cms.publish \| crm.clients.manage | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | ✓ | · | · |
| `#/canales/portal-pasajero/viajes` | Portales y apps externas | channels.b2b.manage \| channels.cms.publish \| operations.assign | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | · | ✓ | · |
| `#/proveedor/solicitudes` | Portales y apps externas | __solo_extranet__ | · | · | · | · | · | · | · | · | · | · | · | · | ✓ |

Pantallas accesibles por rol: SA 4 · TA 75 · MG 67 · VT 30 · OP 32 · FI 30 · CO 14 · GU 1 · CD 1 · B2B 1 · CL 2 · PA 4 · PR 7 (de 84 rutas evaluadas).

## 5. Notas para el backend

- `GET /api/v1/me/access` debe devolver exactamente esta evaluación (`screens: {ruta: bool}`) para que menú y router del frontend Next.js coincidan con el prototipo.
- Accesos «cruzados» intencionales: `operaciones/documentos-viaje` abierto a Ventas por `reservations.create`; `crm/clientes` y `finanzas/pagos` a Contabilidad por `finance.receivables`; `catalogo/cupos` a Finanzas por `catalog.products.view_profitability` (00 §7.5).
- `proveedor` exige `__solo_extranet__` (ningún permiso interno): solo el rol `provider` lo abre por su experiencia.
- Rutas sin entrada en ACCESS (p. ej. `flujo`, `sitio/*`) quedan abiertas a cualquier rol interno o son públicas; si se agrega una pantalla nueva, registrar su permiso en ACCESS y en `/me/access`.
- Reglas de administración de roles (no revocar `admin.users.manage` al Tenant Admin, no otorgar permisos de plataforma a roles de tenant, etc.): ver `REGLAS-DE-NEGOCIO.md` (RBAC-BR, USR-BR).
