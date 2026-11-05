# Diccionario de datos · Extranet de proveedores (supplier_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Respuestas, facturas y solicitudes de tarifa del proveedor.

3 tablas · 70 columnas · 19 claves foráneas. Diagrama ER: [`../er/supplier.svg`](../er/supplier.svg) (fuente [`../er/supplier.mmd`](../er/supplier.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`supplier_invoices`](#supplier_invoices) | Fase 2 · Canales y campo | tenant | 22 | 6 | [Spec 06 §3.3] [Fase 2] Factura del proveedor asociada a una CxP. |
| [`supplier_rate_requests`](#supplier_rate_requests) | Fase 2 · Canales y campo | tenant | 22 | 6 | [Spec 06 §3.4] [Fase 2] Solicitudes de actualización de tarifa del proveedor. |
| [`supplier_request_responses`](#supplier_request_responses) | Fase 2 · Canales y campo | tenant | 26 | 7 | [Spec 06 §3.2] [Fase 2] Respuesta del proveedor (confirmación, rechazo, alternativa). |

## Detalle por tabla

### `supplier_invoices`

[Spec 06 §3.3] [Fase 2] Factura del proveedor asociada a una CxP.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Extranet de proveedores (supplier_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `payable_id` | `uuid` | no |  | FK → fin_payables.id. |
| 4 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 5 | `number` | `character varying(20)` | no |  |  |
| 6 | `issue_date` | `date` | no |  |  |
| 7 | `amount` | `numeric(14,2)` | no |  |  |
| 8 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 9 | `amount_difference` | `numeric(14,2)` | no | `0` |  |
| 10 | `document_id` | `uuid` | no |  | FK → sys_documents.id. |
| 11 | `original_file_name` | `character varying(200)` | no |  |  |
| 12 | `status` | `character varying(20)` | no | `'registrada'::character varying` | Valores: `registrada`, `validada`, `observada`, `rechazada`. |
| 13 | `uploaded_by` | `uuid` | no |  | FK → iam_users.id. |
| 14 | `uploaded_at` | `timestamp with time zone` | no | `now()` |  |
| 15 | `validated_by` | `uuid` | sí |  | FK → iam_users.id. |
| 16 | `validated_at` | `timestamp with time zone` | sí |  |  |
| 17 | `validation_note` | `text` | sí |  |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 22 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `document_id` | `sys_documents.id` | NO ACTION | `fk_supplier_invoices_document_id` |
| `payable_id` | `fin_payables.id` | NO ACTION | `fk_supplier_invoices_payable_id` |
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_supplier_invoices_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_supplier_invoices_tenant_id` |
| `uploaded_by` | `iam_users.id` | NO ACTION | `fk_supplier_invoices_uploaded_by` |
| `validated_by` | `iam_users.id` | NO ACTION | `fk_supplier_invoices_validated_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_supplier_invoices_tenant_id_payable_id_p` | `tenant_id, payable_id` | `(((status)::text = ANY ((ARRAY['registrada'::character varying, 'validada'::character varying])::text[])) AND (deleted_at IS NULL))` | índice único |
| `uq_supplier_invoices_tenant_id_provider_id_number` | `tenant_id, provider_id, number` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `supplier_invoices_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `supplier_invoices_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `supplier_invoices_number_check` | `CHECK (((number)::text ~ '^[A-Z0-9]{4}-[0-9]{1,8}$'::text))` |  |
| `supplier_invoices_status_check` | `CHECK (((status)::text = ANY ((ARRAY['registrada'::character varying, 'validada'::character varying, 'observada'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `registrada`, `validada`, `observada`, `rechazada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_supplier_invoices_document_id` | `USING btree (document_id)` |
| `ix_supplier_invoices_payable_id` | `USING btree (payable_id)` |
| `ix_supplier_invoices_provider_id` | `USING btree (provider_id)` |
| `ix_supplier_invoices_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_supplier_invoices_uploaded_by` | `USING btree (uploaded_by)` |
| `ix_supplier_invoices_validated_by` | `USING btree (validated_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_supplier_invoices_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `supplier_rate_requests`

[Spec 06 §3.4] [Fase 2] Solicitudes de actualización de tarifa del proveedor.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Extranet de proveedores (supplier_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 5 | `service_id` | `uuid` | no |  | FK → catalog_services.id. |
| 6 | `current_cost` | `numeric(14,2)` | no |  |  |
| 7 | `proposed_cost` | `numeric(14,2)` | no |  |  |
| 8 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 9 | `effective_from` | `date` | no |  |  |
| 10 | `reason_type` | `character varying(40)` | no |  | Valores: `Ajuste por inflación / costos`, `Cambio de temporada`, `Mejora del servicio`, `Tarifa promocional`, `Otro`. |
| 11 | `reason_detail` | `text` | sí |  |  |
| 12 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `aprobada`, `rechazada`, `retirada`. |
| 13 | `requested_by` | `uuid` | no |  | FK → iam_users.id. |
| 14 | `requested_at` | `timestamp with time zone` | no | `now()` |  |
| 15 | `reviewed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 16 | `reviewed_at` | `timestamp with time zone` | sí |  |  |
| 17 | `review_note` | `text` | sí |  |  |
| 18 | `resulting_rate_id` | `uuid` | sí |  | FK → catalog_service_cost_history.id. |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_supplier_rate_requests_provider_id` |
| `requested_by` | `iam_users.id` | NO ACTION | `fk_supplier_rate_requests_requested_by` |
| `resulting_rate_id` | `catalog_service_cost_history.id` | NO ACTION | `fk_supplier_rate_requests_resulting_rate_id` |
| `reviewed_by` | `iam_users.id` | NO ACTION | `fk_supplier_rate_requests_reviewed_by` |
| `service_id` | `catalog_services.id` | NO ACTION | `fk_supplier_rate_requests_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_supplier_rate_requests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_supplier_rate_requests_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_supplier_rate_requests_tenant_id_service_id_p` | `tenant_id, service_id` | `((status)::text = 'pendiente'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `supplier_rate_requests_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `supplier_rate_requests_proposed_cost_check` | `CHECK ((proposed_cost > (0)::numeric))` |  |
| `supplier_rate_requests_reason_type_check` | `CHECK (((reason_type)::text = ANY ((ARRAY['Ajuste por inflación / costos'::character varying, 'Cambio de temporada'::character varying, 'Mejora del servicio'::character varying, 'Tarifa promocional'::character varying, 'Otro'::character varying])::text[])))` | `reason_type`: `Ajuste por inflación / costos`, `Cambio de temporada`, `Mejora del servicio`, `Tarifa promocional`, `Otro` |
| `supplier_rate_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'retirada'::character varying])::text[])))` | `status`: `pendiente`, `aprobada`, `rechazada`, `retirada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_supplier_rate_requests_provider_id` | `USING btree (provider_id)` |
| `ix_supplier_rate_requests_requested_by` | `USING btree (requested_by)` |
| `ix_supplier_rate_requests_resulting_rate_id` | `USING btree (resulting_rate_id)` |
| `ix_supplier_rate_requests_reviewed_by` | `USING btree (reviewed_by)` |
| `ix_supplier_rate_requests_service_id` | `USING btree (service_id)` |
| `ix_supplier_rate_requests_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_supplier_rate_requests_tenant_id_provider_id_status` | `USING btree (tenant_id, provider_id, status)` |
| `ix_supplier_rate_requests_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_supplier_rate_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `supplier_request_responses`

[Spec 06 §3.2] [Fase 2] Respuesta del proveedor (confirmación, rechazo, alternativa).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Extranet de proveedores (supplier_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `supplier_request_id` | `uuid` | no |  | FK → ops_supplier_requests.id. |
| 4 | `reservation_service_id` | `uuid` | no |  | FK → booking_reservation_services.id. |
| 5 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 6 | `type` | `character varying(20)` | no |  | Valores: `confirmacion`, `rechazo`, `alternativa`. |
| 7 | `responded_by_user_id` | `uuid` | no |  | FK → iam_users.id. |
| 8 | `responded_at` | `timestamp with time zone` | no | `now()` |  |
| 9 | `confirmed_by_name` | `character varying(120)` | sí |  |  |
| 10 | `confirmation_code` | `character varying(40)` | sí |  |  |
| 11 | `rejection_reason` | `character varying(60)` | sí |  | Valores: `Sin disponibilidad (sold out)`, `Fecha bloqueada por mantenimiento`, `Tarifa no vigente para la fecha`, `Cupo de grupo excedido`, `Otro`. |
| 12 | `alt_kind` | `character varying(40)` | sí |  | Valores: `Otra fecha`, `Otro tipo de habitación`, `Otro horario`, `Upgrade sin costo`, `Otro`. |
| 13 | `alt_date` | `date` | sí |  |  |
| 14 | `alt_service_id` | `uuid` | sí |  | FK → catalog_services.id. |
| 15 | `alt_net_cost` | `numeric(14,2)` | sí |  |  |
| 16 | `currency` | `character(3)` | sí |  |  |
| 17 | `hold_until` | `date` | sí |  |  |
| 18 | `note` | `text` | sí |  |  |
| 19 | `review_status` | `character varying(20)` | sí |  | Valores: `pendiente`, `aceptada`, `rechazada`, `expirada`. |
| 20 | `reviewed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 21 | `reviewed_at` | `timestamp with time zone` | sí |  |  |
| 22 | `review_note` | `text` | sí |  |  |
| 23 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 24 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 25 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 26 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `alt_service_id` | `catalog_services.id` | NO ACTION | `fk_supplier_request_responses_alt_service_id` |
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_supplier_request_responses_provider_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_supplier_request_responses_reservation_service_id` |
| `responded_by_user_id` | `iam_users.id` | NO ACTION | `fk_supplier_request_responses_responded_by_user_id` |
| `reviewed_by` | `iam_users.id` | NO ACTION | `fk_supplier_request_responses_reviewed_by` |
| `supplier_request_id` | `ops_supplier_requests.id` | NO ACTION | `fk_supplier_request_responses_supplier_request_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_supplier_request_responses_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_supplier_request_responses_1` | `CHECK ((((type)::text <> 'confirmacion'::text) OR ((confirmation_code IS NOT NULL) AND (length((confirmation_code)::text) >= 4))))` |  |
| `ck_supplier_request_responses_2` | `CHECK ((((type)::text <> 'rechazo'::text) OR ((rejection_reason IS NOT NULL) AND (note IS NOT NULL))))` |  |
| `ck_supplier_request_responses_3` | `CHECK ((((type)::text <> 'alternativa'::text) OR ((alt_kind IS NOT NULL) AND (note IS NOT NULL))))` |  |
| `supplier_request_responses_alt_kind_check` | `CHECK (((alt_kind IS NULL) OR ((alt_kind)::text = ANY ((ARRAY['Otra fecha'::character varying, 'Otro tipo de habitación'::character varying, 'Otro horario'::character varying, 'Upgrade sin costo'::character varying, 'Otro'::character varying])::text[]))))` | `alt_kind`: `Otra fecha`, `Otro tipo de habitación`, `Otro horario`, `Upgrade sin costo`, `Otro` |
| `supplier_request_responses_rejection_reason_check` | `CHECK (((rejection_reason IS NULL) OR ((rejection_reason)::text = ANY ((ARRAY['Sin disponibilidad (sold out)'::character varying, 'Fecha bloqueada por mantenimiento'::character varying, 'Tarifa no vigente para la fecha'::character varying, 'Cupo de grupo excedido'::character varying, 'Otro'::character varying])::text[]))))` | `rejection_reason`: `Sin disponibilidad (sold out)`, `Fecha bloqueada por mantenimiento`, `Tarifa no vigente para la fecha`, `Cupo de grupo excedido`, `Otro` |
| `supplier_request_responses_review_status_check` | `CHECK (((review_status IS NULL) OR ((review_status)::text = ANY ((ARRAY['pendiente'::character varying, 'aceptada'::character varying, 'rechazada'::character varying, 'expirada'::character varying])::text[]))))` | `review_status`: `pendiente`, `aceptada`, `rechazada`, `expirada` |
| `supplier_request_responses_type_check` | `CHECK (((type)::text = ANY ((ARRAY['confirmacion'::character varying, 'rechazo'::character varying, 'alternativa'::character varying])::text[])))` | `type`: `confirmacion`, `rechazo`, `alternativa` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_supplier_request_responses_alt_service_id` | `USING btree (alt_service_id)` |
| `ix_supplier_request_responses_provider_id` | `USING btree (provider_id)` |
| `ix_supplier_request_responses_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_supplier_request_responses_responded_by_user_id` | `USING btree (responded_by_user_id)` |
| `ix_supplier_request_responses_reviewed_by` | `USING btree (reviewed_by)` |
| `ix_supplier_request_responses_supplier_request_id` | `USING btree (supplier_request_id)` |
| `ix_supplier_request_responses_tenant_id_provider_id_crea_8b689f` | `USING btree (tenant_id, provider_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_supplier_request_responses_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
