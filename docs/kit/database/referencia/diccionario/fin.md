# Diccionario de datos · Finanzas y tesorería (fin_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

CxC, pagos, CxP, comisiones, comprobantes, conciliación, cierres, tesorería y monedas.

34 tablas · 590 columnas · 125 claves foráneas. Diagrama ER: [`../er/fin.svg`](../er/fin.svg) (fuente [`../er/fin.mmd`](../er/fin.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`fin_bank_accounts`](#fin_bank_accounts) | Fase 1 · MVP | tenant | 13 | 1 | [Spec 07 §3.8] [Fase 1] Cuentas bancarias para pagos a proveedores. |
| [`fin_commission_rules`](#fin_commission_rules) | Fase 1 · MVP | tenant | 13 | 1 | [Spec 07 §3.10] [Fase 1] Reglas de comisión (vendedor / agencia B2B). |
| [`fin_commissions`](#fin_commissions) | Fase 1 · MVP | tenant | 30 | 8 | [Spec 07 §3.11 + 14 §3.17] [Fase 1] Comisiones calculadas (vendedor, agencia B2B, bono por meta). |
| [`fin_fx_rates`](#fin_fx_rates) | Fase 1 · MVP | tenant | 17 | 2 | [Spec 07 §3.19 + 09 §3.9 + 17 §3.6] [Fase 1] Histórico de tipo de cambio (append-only). |
| [`fin_payable_payouts`](#fin_payable_payouts) | Fase 1 · MVP | tenant | 15 | 4 | [Spec 07 §3.7] [Fase 1] Pagos a proveedores. |
| [`fin_payables`](#fin_payables) | Fase 1 · MVP | tenant | 30 | 7 | [Spec 07 §3.6] [Fase 1] Cuentas por pagar a proveedores y costos adicionales. |
| [`fin_payment_applications`](#fin_payment_applications) | Fase 1 · MVP | tenant | 13 | 5 | [Spec 07 §3.4] [Fase 1] Aplicación / desaplicación de pagos a CxC. |
| [`fin_payment_methods`](#fin_payment_methods) | Fase 1 · MVP | tenant | 11 | 1 | [Spec 07 §3.9] [Fase 1] Medios de cobro configurables (PAY_METHODS). |
| [`fin_payments`](#fin_payments) | Fase 1 · MVP | tenant | 29 | 7 | [Spec 07 §3.3 + 08 §3.15] [Fase 1] Pagos recibidos y reembolsos. |
| [`fin_receivable_reminders`](#fin_receivable_reminders) | Fase 1 · MVP | tenant | 9 | 3 | [Spec 07 §3.2] [Fase 1] Recordatorios de cobro enviados. |
| [`fin_receivables`](#fin_receivables) | Fase 1 · MVP | tenant | 22 | 3 | [Spec 07 §3.1] [Fase 1] Cuentas por cobrar (obligaciones de cobro). |
| [`fin_settlements`](#fin_settlements) | Fase 1 · MVP | tenant | 15 | 3 | [Spec 07 §3.12] [Fase 1] Liquidación / cierre financiero de la reserva. |
| [`fin_status_history`](#fin_status_history) | Fase 1 · MVP | tenant | 9 | 2 | [Spec 07 §3.5] [Fase 1] Historial de estados de pagos, comisiones, comprobantes y CxP. |
| [`fin_bank_lines`](#fin_bank_lines) | Fase 2 · Canales y campo | tenant | 20 | 6 | [Spec 07 §3.17] [Fase 2] Líneas de extracto bancario y su conciliación. |
| [`fin_bank_statements`](#fin_bank_statements) | Fase 2 · Canales y campo | tenant | 14 | 4 | [Spec 07 §3.17] [Fase 2] Extractos bancarios importados. |
| [`fin_cash_counts`](#fin_cash_counts) | Fase 2 · Canales y campo | tenant | 27 | 8 | [Spec 12 §3.6] [Fase 2] Actas de arqueo de caja. |
| [`fin_cash_replenishment_events`](#fin_cash_replenishment_events) | Fase 2 · Canales y campo | tenant | 9 | 3 | [Spec 12 §3.7] [Fase 2] Historial de estados de la reposición. (columnas supuestas) |
| [`fin_cash_replenishments`](#fin_cash_replenishments) | Fase 2 · Canales y campo | tenant | 20 | 7 | [Spec 12 §3.7] [Fase 2] Reposiciones de caja chica. |
| [`fin_cash_sessions`](#fin_cash_sessions) | Fase 2 · Canales y campo | tenant | 16 | 5 | [Spec 12 §3.5] [Fase 2] Sesiones diarias de caja chica. |
| [`fin_currencies`](#fin_currencies) | Fase 2 · Canales y campo | tenant | 12 | 1 | [Spec 17 §3.6] [Fase 2] Monedas activas del tenant (base / cobro). |
| [`fin_document_series`](#fin_document_series) | Fase 2 · Canales y campo | tenant | 11 | 2 | [Spec 07 §3.13] [Fase 2] Series de comprobantes (F001, B001, FC01, BC01). |
| [`fin_expense_receipts`](#fin_expense_receipts) | Fase 2 · Canales y campo | tenant | 12 | 2 | [Spec 12 §3.3] [Fase 2] Comprobante del gasto de caja chica. |
| [`fin_fiscal_events`](#fin_fiscal_events) | Fase 2 · Canales y campo | tenant | 12 | 3 | [Spec 07 §3.16] [Fase 2] Bitácora de integración fiscal OSE/PSE. |
| [`fin_fx_revaluations`](#fin_fx_revaluations) | Fase 2 · Canales y campo | tenant | 14 | 2 | [Spec 12 §3.8] [Fase 2] Diferencia de cambio mensual por cuenta USD. |
| [`fin_invoice_lines`](#fin_invoice_lines) | Fase 2 · Canales y campo | tenant | 15 | 2 | [Spec 07 §3.15] [Fase 2] Líneas del comprobante. |
| [`fin_invoices`](#fin_invoices) | Fase 2 · Canales y campo | tenant | 46 | 9 | [Spec 07 §3.14] [Fase 2] Comprobantes electrónicos (factura, boleta, NC, ND). Nunca se borran. |
| [`fin_period_close_checks`](#fin_period_close_checks) | Fase 2 · Canales y campo | tenant | 10 | 3 | [Spec 07 §3.18] [Fase 2] Controles manuales del cierre de periodo. |
| [`fin_period_closes`](#fin_period_closes) | Fase 2 · Canales y campo | tenant | 11 | 2 | [Spec 07 §3.18] [Fase 2] Cierre de periodo contable. |
| [`fin_reconciliation_closures`](#fin_reconciliation_closures) | Fase 2 · Canales y campo | tenant | 16 | 2 | [Spec 07 §3.17] [Fase 2] Cierres de conciliación bancaria. |
| [`fin_treasury_accounts`](#fin_treasury_accounts) | Fase 2 · Canales y campo | tenant | 23 | 4 | [Spec 12 §3.1] [Fase 2] Cuentas de tesorería (banco, caja chica, pasarela). |
| [`fin_treasury_movements`](#fin_treasury_movements) | Fase 2 · Canales y campo | tenant | 33 | 8 | [Spec 12 §3.2] [Fase 2] Movimientos de tesorería (saldo derivado). |
| [`fin_treasury_settings`](#fin_treasury_settings) | Fase 2 · Canales y campo | tenant | 13 | 1 | [Spec 12 §3.9] [Fase 2] Parámetros de tesorería (1 fila por tenant). |
| [`fin_treasury_transfers`](#fin_treasury_transfers) | Fase 2 · Canales y campo | tenant | 15 | 3 | [Spec 12 §3.4] [Fase 2] Transferencias entre cuentas / liquidaciones de pasarela. |
| [`fx_rate_providers`](#fx_rate_providers) | Fase 2 · Canales y campo | tenant | 15 | 1 | [Spec 17 §3.6 (v2.2)] [Fase 2] Proveedores de tipo de cambio. |

## Detalle por tabla

### `fin_bank_accounts`

[Spec 07 §3.8] [Fase 1] Cuentas bancarias para pagos a proveedores.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `bank` | `character varying(20)` | no |  |  |
| 4 | `account_type` | `character varying(20)` | no |  | Valores: `cta_cte`, `ahorros`. |
| 5 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 6 | `number` | `character varying(30)` | no |  |  |
| 7 | `cci` | `character varying(20)` | sí |  |  |
| 8 | `label` | `character varying(80)` | no |  |  |
| 9 | `active` | `boolean` | no | `true` |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_bank_accounts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_bank_accounts_tenant_id_bank_number` | `tenant_id, bank, number` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_bank_accounts_account_type_check` | `CHECK (((account_type)::text = ANY ((ARRAY['cta_cte'::character varying, 'ahorros'::character varying])::text[])))` | `account_type`: `cta_cte`, `ahorros` |
| `fin_bank_accounts_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_bank_accounts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_commission_rules`

[Spec 07 §3.10] [Fase 1] Reglas de comisión (vendedor / agencia B2B).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `beneficiary_kind` | `character varying(20)` | no |  | Valores: `vendedor`, `agencia_b2b`. |
| 4 | `condition` | `character varying(30)` | no |  | Valores: `directo_ecommerce`, `corporativo_grupos`, `b2b_convenio`. |
| 5 | `pct` | `numeric(5,2)` | sí |  |  |
| 6 | `base_type` | `character varying(20)` | no | `'neto_sin_igv'::character varying` | Valores: `neto_sin_igv`, `total`. |
| 7 | `valid_from` | `date` | no |  |  |
| 8 | `valid_to` | `date` | sí |  |  |
| 9 | `active` | `boolean` | no | `true` |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_commission_rules_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_commission_rules_1` | `CHECK ((((condition)::text = 'b2b_convenio'::text) OR (pct IS NOT NULL)))` |  |
| `fin_commission_rules_base_type_check` | `CHECK (((base_type)::text = ANY ((ARRAY['neto_sin_igv'::character varying, 'total'::character varying])::text[])))` | `base_type`: `neto_sin_igv`, `total` |
| `fin_commission_rules_beneficiary_kind_check` | `CHECK (((beneficiary_kind)::text = ANY ((ARRAY['vendedor'::character varying, 'agencia_b2b'::character varying])::text[])))` | `beneficiary_kind`: `vendedor`, `agencia_b2b` |
| `fin_commission_rules_condition_check` | `CHECK (((condition)::text = ANY ((ARRAY['directo_ecommerce'::character varying, 'corporativo_grupos'::character varying, 'b2b_convenio'::character varying])::text[])))` | `condition`: `directo_ecommerce`, `corporativo_grupos`, `b2b_convenio` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_commission_rules_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_commission_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_commissions`

[Spec 07 §3.11 + 14 §3.17] [Fase 1] Comisiones calculadas (vendedor, agencia B2B, bono por meta).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 5 | `kind` | `character varying(20)` | no |  | Valores: `vendedor`, `agencia_b2b`, `Bono por meta`. |
| 6 | `beneficiary_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `beneficiary_agency_id` | `uuid` | sí |  | FK → channel_b2b_agencies.id. |
| 8 | `rule_id` | `uuid` | sí |  | FK → fin_commission_rules.id. |
| 9 | `rule_description` | `character varying(255)` | no |  |  |
| 10 | `base_amount` | `numeric(14,2)` | no |  |  |
| 11 | `pct` | `numeric(5,2)` | no |  |  |
| 12 | `amount` | `numeric(14,2)` | no |  |  |
| 13 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 14 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 15 | `status` | `character varying(20)` | no | `'calculada'::character varying` | Valores: `calculada`, `aprobada`, `pagada`. |
| 16 | `approved_at` | `timestamp with time zone` | sí |  |  |
| 17 | `approved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 18 | `paid_at` | `timestamp with time zone` | sí |  |  |
| 19 | `payment_method` | `character varying(40)` | sí |  |  |
| 20 | `payment_ref` | `character varying(80)` | sí |  |  |
| 21 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 22 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 23 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 24 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 25 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 26 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 27 | `settlement_request_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 08 §3.15 FK → channel_b2b_settlement_requests.id. [Agregada en `30_fase2.sql`] |
| 28 | `approval_round` | `smallint` | no | `1` | Columnas agregadas en Fase 2 por spec 10 §3.11 [Agregada en `30_fase2.sql`] |
| 29 | `observation` | `text` | sí |  | Columnas agregadas en Fase 2 por spec 10 §3.11 [Agregada en `30_fase2.sql`] |
| 30 | `sales_target_id` | `uuid` | sí |  | Columnas agregadas en Fase 3 por spec 14 §3.17 FK → crm_sales_targets.id. [Agregada en `40_fase3.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `approved_by` | `iam_users.id` | NO ACTION | `fk_fin_commissions_approved_by` |
| `beneficiary_agency_id` | `channel_b2b_agencies.id` | NO ACTION | `fk_fin_commissions_beneficiary_agency_id` |
| `beneficiary_user_id` | `iam_users.id` | NO ACTION | `fk_fin_commissions_beneficiary_user_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_commissions_reservation_id` |
| `rule_id` | `fin_commission_rules.id` | NO ACTION | `fk_fin_commissions_rule_id` |
| `sales_target_id` | `crm_sales_targets.id` | NO ACTION | `fk_fin_commissions_sales_target_id` |
| `settlement_request_id` | `channel_b2b_settlement_requests.id` | NO ACTION | `fk_fin_commissions_settlement_request_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_commissions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_commissions_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_fin_commissions_tenant_id_reservation_id_kind_p` | `tenant_id, reservation_id, kind` | `((deleted_at IS NULL) AND (reservation_id IS NOT NULL))` | índice único |
| `uq_fin_commissions_tenant_id_sales_target_id_p` | `tenant_id, sales_target_id` | `(sales_target_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_commissions_1` | `CHECK ((num_nonnulls(beneficiary_user_id, beneficiary_agency_id) = 1))` |  |
| `ck_fin_commissions_2` | `CHECK ((((kind)::text = 'Bono por meta'::text) OR (reservation_id IS NOT NULL)))` |  |
| `ck_fin_commissions_x1` | `CHECK ((((kind)::text = 'Bono por meta'::text) = (sales_target_id IS NOT NULL)))` |  |
| `fin_commissions_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `fin_commissions_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['vendedor'::character varying, 'agencia_b2b'::character varying, 'Bono por meta'::character varying])::text[])))` | `kind`: `vendedor`, `agencia_b2b`, `Bono por meta` |
| `fin_commissions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['calculada'::character varying, 'aprobada'::character varying, 'pagada'::character varying])::text[])))` | `status`: `calculada`, `aprobada`, `pagada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_commissions_approved_by` | `USING btree (approved_by)` |
| `ix_fin_commissions_beneficiary_agency_id` | `USING btree (beneficiary_agency_id)` |
| `ix_fin_commissions_beneficiary_user_id` | `USING btree (beneficiary_user_id)` |
| `ix_fin_commissions_reservation_id` | `USING btree (reservation_id)` |
| `ix_fin_commissions_rule_id` | `USING btree (rule_id)` |
| `ix_fin_commissions_sales_target_id` | `USING btree (sales_target_id)` |
| `ix_fin_commissions_settlement_request_id` | `USING btree (settlement_request_id)` |
| `ix_fin_commissions_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_commissions_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_commissions_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_fin_commissions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_fx_rates`

[Spec 07 §3.19 + 09 §3.9 + 17 §3.6] [Fase 1] Histórico de tipo de cambio (append-only).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `currency_code` | `character(3)` | no |  |  |
| 4 | `base_currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 5 | `rate_pen` | `numeric(14,6)` | no |  |  |
| 6 | `buy` | `numeric(12,6)` | sí |  |  |
| 7 | `sell` | `numeric(12,6)` | sí |  |  |
| 8 | `previous_rate` | `numeric(14,6)` | sí |  |  |
| 9 | `rate_date` | `date` | no |  |  |
| 10 | `source` | `character varying(80)` | no |  |  |
| 11 | `effective_at` | `timestamp with time zone` | no | `now()` |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `provider_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2) FK → fx_rate_providers.id. [Agregada en `30_fase2.sql`] |
| 15 | `daily_change_pct` | `numeric(7,3)` | sí |  | Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2) [Agregada en `30_fase2.sql`] |
| 16 | `alert_raised` | `boolean` | no | `false` | Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2) [Agregada en `30_fase2.sql`] |
| 17 | `is_demo` | `boolean` | no | `false` | Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2) [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `provider_id` | `fx_rate_providers.id` | NO ACTION | `fk_fin_fx_rates_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_fx_rates_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_fx_rates_rate_pen_check` | `CHECK ((rate_pen > (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_fx_rates_provider_id` | `USING btree (provider_id)` |
| `ix_fin_fx_rates_tenant_id_currency_code_effective_at_desc` | `USING btree (tenant_id, currency_code, effective_at DESC)` |
| `ix_fin_fx_rates_tenant_id_currency_code_rate_date_desc` | `USING btree (tenant_id, currency_code, rate_date DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_fx_rates_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `fin_payable_payouts`

[Spec 07 §3.7] [Fase 1] Pagos a proveedores.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `payable_id` | `uuid` | no |  | FK → fin_payables.id. |
| 5 | `paid_on` | `date` | no |  |  |
| 6 | `amount` | `numeric(14,2)` | no |  |  |
| 7 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 8 | `method` | `character varying(30)` | no |  | Valores: `transferencia`, `transferencia_cci`, `cheque_gerencia`, `efectivo_caja_chica`, `cargo_bancario`. |
| 9 | `bank_account_id` | `uuid` | sí |  | FK → fin_bank_accounts.id. |
| 10 | `operation_ref` | `character varying(80)` | no |  |  |
| 11 | `bank_line_id` | `uuid` | sí |  | FK → fin_bank_lines.id. |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `bank_account_id` | `fin_bank_accounts.id` | NO ACTION | `fk_fin_payable_payouts_bank_account_id` |
| `bank_line_id` | `fin_bank_lines.id` | NO ACTION | `fk_fin_payable_payouts_bank_line_id` |
| `payable_id` | `fin_payables.id` | NO ACTION | `fk_fin_payable_payouts_payable_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_payable_payouts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_payable_payouts_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_payable_payouts_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `fin_payable_payouts_method_check` | `CHECK (((method)::text = ANY ((ARRAY['transferencia'::character varying, 'transferencia_cci'::character varying, 'cheque_gerencia'::character varying, 'efectivo_caja_chica'::character varying, 'cargo_bancario'::character varying])::text[])))` | `method`: `transferencia`, `transferencia_cci`, `cheque_gerencia`, `efectivo_caja_chica`, `cargo_bancario` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_payable_payouts_bank_account_id` | `USING btree (bank_account_id)` |
| `ix_fin_payable_payouts_bank_line_id` | `USING btree (bank_line_id)` |
| `ix_fin_payable_payouts_payable_id` | `USING btree (payable_id)` |
| `ix_fin_payable_payouts_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_payable_payouts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_payables`

[Spec 07 §3.6] [Fase 1] Cuentas por pagar a proveedores y costos adicionales.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `reservation_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 7 | `kind` | `character varying(20)` | no | `'servicio'::character varying` | Valores: `servicio`, `costo_adicional`. |
| 8 | `cost_type` | `character varying(40)` | sí |  | Valores: `costo_adicional`, `ajuste_tarifa`, `penalidad_proveedor`, `gasto_operativo_destino`. |
| 9 | `concept` | `character varying(255)` | no |  |  |
| 10 | `amount` | `numeric(14,2)` | no |  |  |
| 11 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 12 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 13 | `due_date` | `date` | no |  |  |
| 14 | `paid_amount` | `numeric(14,2)` | no | `0` |  |
| 15 | `status` | `character varying(20)` | no | `'abierta'::character varying` | Valores: `abierta`, `aprobada`, `parcial`, `pagada`, `vencida`, `cancelada`. |
| 16 | `approved_at` | `timestamp with time zone` | sí |  |  |
| 17 | `approved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 18 | `supplier_doc_number` | `character varying(30)` | sí |  |  |
| 19 | `evidence_note` | `text` | sí |  |  |
| 20 | `scheduled_date` | `date` | sí |  |  |
| 21 | `scheduled_bank_account_id` | `uuid` | sí |  | FK → fin_bank_accounts.id. |
| 22 | `scheduled_by` | `uuid` | sí |  | FK → iam_users.id. |
| 23 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 24 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 25 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 26 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 27 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 28 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 29 | `approval_round` | `smallint` | no | `1` | Columnas agregadas en Fase 2 por spec 10 §3.11 [Agregada en `30_fase2.sql`] |
| 30 | `observation` | `text` | sí |  | Columnas agregadas en Fase 2 por spec 10 §3.11 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `approved_by` | `iam_users.id` | NO ACTION | `fk_fin_payables_approved_by` |
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_fin_payables_provider_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_payables_reservation_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_fin_payables_reservation_service_id` |
| `scheduled_bank_account_id` | `fin_bank_accounts.id` | NO ACTION | `fk_fin_payables_scheduled_bank_account_id` |
| `scheduled_by` | `iam_users.id` | NO ACTION | `fk_fin_payables_scheduled_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_payables_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_payables_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_payables_1` | `CHECK (((paid_amount >= (0)::numeric) AND (paid_amount <= amount)))` |  |
| `ck_fin_payables_2` | `CHECK ((((kind)::text <> 'costo_adicional'::text) OR (cost_type IS NOT NULL)))` |  |
| `ck_fin_payables_3` | `CHECK (((currency <> 'USD'::bpchar) OR (fx_rate IS NOT NULL)))` |  |
| `fin_payables_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `fin_payables_cost_type_check` | `CHECK (((cost_type IS NULL) OR ((cost_type)::text = ANY ((ARRAY['costo_adicional'::character varying, 'ajuste_tarifa'::character varying, 'penalidad_proveedor'::character varying, 'gasto_operativo_destino'::character varying])::text[]))))` | `cost_type`: `costo_adicional`, `ajuste_tarifa`, `penalidad_proveedor`, `gasto_operativo_destino` |
| `fin_payables_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `fin_payables_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['servicio'::character varying, 'costo_adicional'::character varying])::text[])))` | `kind`: `servicio`, `costo_adicional` |
| `fin_payables_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'aprobada'::character varying, 'parcial'::character varying, 'pagada'::character varying, 'vencida'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `abierta`, `aprobada`, `parcial`, `pagada`, `vencida`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_payables_approved_by` | `USING btree (approved_by)` |
| `ix_fin_payables_provider_id` | `USING btree (provider_id)` |
| `ix_fin_payables_reservation_id` | `USING btree (reservation_id)` |
| `ix_fin_payables_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_fin_payables_scheduled_bank_account_id` | `USING btree (scheduled_bank_account_id)` |
| `ix_fin_payables_scheduled_by` | `USING btree (scheduled_by)` |
| `ix_fin_payables_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_payables_tenant_id_due_date` | `USING btree (tenant_id, due_date)` |
| `ix_fin_payables_tenant_id_kind` | `USING btree (tenant_id, kind)` |
| `ix_fin_payables_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_payables_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_fin_payables_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_payment_applications`

[Spec 07 §3.4] [Fase 1] Aplicación / desaplicación de pagos a CxC.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `payment_id` | `uuid` | no |  | FK → fin_payments.id. |
| 4 | `receivable_id` | `uuid` | no |  | FK → fin_receivables.id. |
| 5 | `amount` | `numeric(14,2)` | no |  |  |
| 6 | `applied_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `applied_by` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `reversed_at` | `timestamp with time zone` | sí |  |  |
| 9 | `reversed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `applied_by` | `iam_users.id` | NO ACTION | `fk_fin_payment_applications_applied_by` |
| `payment_id` | `fin_payments.id` | NO ACTION | `fk_fin_payment_applications_payment_id` |
| `receivable_id` | `fin_receivables.id` | NO ACTION | `fk_fin_payment_applications_receivable_id` |
| `reversed_by` | `iam_users.id` | NO ACTION | `fk_fin_payment_applications_reversed_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_payment_applications_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_payment_applications_payment_id_p` | `payment_id` | `(reversed_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_payment_applications_amount_check` | `CHECK ((amount > (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_payment_applications_applied_by` | `USING btree (applied_by)` |
| `ix_fin_payment_applications_payment_id` | `USING btree (payment_id)` |
| `ix_fin_payment_applications_receivable_id` | `USING btree (receivable_id)` |
| `ix_fin_payment_applications_reversed_by` | `USING btree (reversed_by)` |
| `ix_fin_payment_applications_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_payment_applications_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_payment_methods`

[Spec 07 §3.9] [Fase 1] Medios de cobro configurables (PAY_METHODS).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(40)` | no |  |  |
| 4 | `label` | `character varying(80)` | no |  |  |
| 5 | `requires_reference` | `boolean` | no | `true` |  |
| 6 | `is_b2b_credit` | `boolean` | no | `false` |  |
| 7 | `active` | `boolean` | no | `true` |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_payment_methods_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_payment_methods_tenant_id_code` | `tenant_id, code` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_payment_methods_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_payment_methods_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_payments`

[Spec 07 §3.3 + 08 §3.15] [Fase 1] Pagos recibidos y reembolsos.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `receivable_id` | `uuid` | sí |  | FK → fin_receivables.id. |
| 6 | `kind` | `character varying(20)` | no | `'cobro'::character varying` | Valores: `cobro`, `reembolso`. |
| 7 | `source` | `character varying(20)` | no | `'backoffice'::character varying` | Valores: `backoffice`, `reserva`, `portal_cliente`, `b2b`, `ecommerce`, `sistema`. |
| 8 | `method` | `character varying(40)` | no |  |  |
| 9 | `amount` | `numeric(14,2)` | no |  |  |
| 10 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 11 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 12 | `paid_on` | `date` | no |  |  |
| 13 | `reference` | `character varying(80)` | sí |  |  |
| 14 | `note` | `text` | sí |  |  |
| 15 | `evidence_document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 16 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `confirmado`, `aplicado`, `rechazado`, `revertido`. |
| 17 | `reject_reason` | `text` | sí |  |  |
| 18 | `retries` | `smallint` | no | `0` |  |
| 19 | `reverted_at` | `timestamp with time zone` | sí |  |  |
| 20 | `reverted_by` | `uuid` | sí |  | FK → iam_users.id. |
| 21 | `revert_reason` | `text` | sí |  |  |
| 22 | `registered_by` | `uuid` | sí |  | FK → iam_users.id. |
| 23 | `reported_by_agency` | `boolean` | no | `false` |  |
| 24 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 25 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 26 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 27 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 28 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 29 | `reversal_request_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 10 §3.11 FK → collab_approval_requests.id. [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `evidence_document_id` | `sys_documents.id` | NO ACTION | `fk_fin_payments_evidence_document_id` |
| `receivable_id` | `fin_receivables.id` | NO ACTION | `fk_fin_payments_receivable_id` |
| `registered_by` | `iam_users.id` | NO ACTION | `fk_fin_payments_registered_by` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_payments_reservation_id` |
| `reversal_request_id` | `collab_approval_requests.id` | NO ACTION | `fk_fin_payments_reversal_request_id` |
| `reverted_by` | `iam_users.id` | NO ACTION | `fk_fin_payments_reverted_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_payments_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_payments_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_payments_1` | `CHECK ((((status)::text <> 'rechazado'::text) OR (reject_reason IS NOT NULL)))` |  |
| `ck_fin_payments_2` | `CHECK ((((status)::text <> 'revertido'::text) OR ((reverted_at IS NOT NULL) AND (reverted_by IS NOT NULL) AND (revert_reason IS NOT NULL))))` |  |
| `ck_fin_payments_3` | `CHECK (((currency <> 'USD'::bpchar) OR (fx_rate IS NOT NULL)))` |  |
| `fin_payments_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `fin_payments_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `fin_payments_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['cobro'::character varying, 'reembolso'::character varying])::text[])))` | `kind`: `cobro`, `reembolso` |
| `fin_payments_source_check` | `CHECK (((source)::text = ANY ((ARRAY['backoffice'::character varying, 'reserva'::character varying, 'portal_cliente'::character varying, 'b2b'::character varying, 'ecommerce'::character varying, 'sistema'::character varying])::text[])))` | `source`: `backoffice`, `reserva`, `portal_cliente`, `b2b`, `ecommerce`, `sistema` |
| `fin_payments_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'confirmado'::character varying, 'aplicado'::character varying, 'rechazado'::character varying, 'revertido'::character varying])::text[])))` | `status`: `pendiente`, `confirmado`, `aplicado`, `rechazado`, `revertido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_payments_evidence_document_id` | `USING btree (evidence_document_id)` |
| `ix_fin_payments_receivable_id` | `USING btree (receivable_id)` |
| `ix_fin_payments_registered_by` | `USING btree (registered_by)` |
| `ix_fin_payments_reservation_id` | `USING btree (reservation_id)` |
| `ix_fin_payments_reversal_request_id` | `USING btree (reversal_request_id)` |
| `ix_fin_payments_reverted_by` | `USING btree (reverted_by)` |
| `ix_fin_payments_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_payments_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_fin_payments_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_payments_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_fin_payments_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_receivable_reminders`

[Spec 07 §3.2] [Fase 1] Recordatorios de cobro enviados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `receivable_id` | `uuid` | no |  | FK → fin_receivables.id. |
| 4 | `channels` | `character varying(60)` | no |  |  |
| 5 | `sent_by` | `uuid` | sí |  | FK → iam_users.id. |
| 6 | `sent_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `balance_at_send` | `numeric(14,2)` | no |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `receivable_id` | `fin_receivables.id` | NO ACTION | `fk_fin_receivable_reminders_receivable_id` |
| `sent_by` | `iam_users.id` | NO ACTION | `fk_fin_receivable_reminders_sent_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_receivable_reminders_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_receivable_reminders_receivable_id` | `USING btree (receivable_id)` |
| `ix_fin_receivable_reminders_sent_by` | `USING btree (sent_by)` |
| `ix_fin_receivable_reminders_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `fin_receivables`

[Spec 07 §3.1] [Fase 1] Cuentas por cobrar (obligaciones de cobro).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 6 | `kind` | `character varying(20)` | no |  | Valores: `anticipo`, `saldo`, `cargo`, `ajuste`, `penalidad`, `b2b`, `total`, `adelanto`, `pago_posterior`. |
| 7 | `concept` | `character varying(255)` | no |  |  |
| 8 | `amount` | `numeric(14,2)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 10 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 11 | `paid_amount` | `numeric(14,2)` | no | `0` |  |
| 12 | `due_date` | `date` | no |  |  |
| 13 | `status` | `character varying(20)` | no | `'abierta'::character varying` | Valores: `abierta`, `parcial`, `vencida`, `pagada`, `cancelada`. |
| 14 | `cancelled_at` | `timestamp with time zone` | sí |  |  |
| 15 | `cancel_reason` | `text` | sí |  |  |
| 16 | `last_reminder_at` | `timestamp with time zone` | sí |  |  |
| 17 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 22 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_fin_receivables_client_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_receivables_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_receivables_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_receivables_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_receivables_1` | `CHECK (((paid_amount >= (0)::numeric) AND (paid_amount <= amount)))` |  |
| `fin_receivables_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `fin_receivables_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `fin_receivables_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['anticipo'::character varying, 'saldo'::character varying, 'cargo'::character varying, 'ajuste'::character varying, 'penalidad'::character varying, 'b2b'::character varying, 'total'::character varying, 'adelanto'::character varying, 'pago_posterior'::character varying])::text[])))` | `kind`: `anticipo`, `saldo`, `cargo`, `ajuste`, `penalidad`, `b2b`, `total`, `adelanto`, `pago_posterior` |
| `fin_receivables_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'parcial'::character varying, 'vencida'::character varying, 'pagada'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `abierta`, `parcial`, `vencida`, `pagada`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_receivables_client_id` | `USING btree (client_id)` |
| `ix_fin_receivables_reservation_id` | `USING btree (reservation_id)` |
| `ix_fin_receivables_tenant_id_client_id` | `USING btree (tenant_id, client_id)` |
| `ix_fin_receivables_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_receivables_tenant_id_due_date_p` | `USING btree (tenant_id, due_date) WHERE ((status)::text = ANY ((ARRAY['abierta'::character varying, 'parcial'::character varying, 'vencida'::character varying])::text[]))` |
| `ix_fin_receivables_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_fin_receivables_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_receivables_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_fin_receivables_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_settlements`

[Spec 07 §3.12] [Fase 1] Liquidación / cierre financiero de la reserva.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `closed_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `closed_by` | `uuid` | no |  | FK → iam_users.id. |
| 6 | `income_pen` | `numeric(14,2)` | no |  |  |
| 7 | `cost_pen` | `numeric(14,2)` | no |  |  |
| 8 | `commissions_pen` | `numeric(14,2)` | no |  |  |
| 9 | `net_pen` | `numeric(14,2)` | no |  |  |
| 10 | `gross_margin_pct` | `numeric(6,2)` | no |  |  |
| 11 | `snapshot` | `jsonb` | no |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `closed_by` | `iam_users.id` | NO ACTION | `fk_fin_settlements_closed_by` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_settlements_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_settlements_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_settlements_tenant_id_reservation_id` | `tenant_id, reservation_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_settlements_closed_by` | `USING btree (closed_by)` |
| `ix_fin_settlements_reservation_id` | `USING btree (reservation_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_settlements_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_status_history`

[Spec 07 §3.5] [Fase 1] Historial de estados de pagos, comisiones, comprobantes y CxP.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `entity_type` | `character varying(30)` | no |  | Valores: `payment`, `commission`, `invoice`, `payable`. |
| 4 | `entity_id` | `uuid` | no |  |  |
| 5 | `status` | `character varying(30)` | no |  |  |
| 6 | `note` | `text` | sí |  |  |
| 7 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_status_history_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_fin_status_history_user_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_status_history_entity_type_check` | `CHECK (((entity_type)::text = ANY ((ARRAY['payment'::character varying, 'commission'::character varying, 'invoice'::character varying, 'payable'::character varying])::text[])))` | `entity_type`: `payment`, `commission`, `invoice`, `payable` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_status_history_tenant_id_entity_type_entity_id` | `USING btree (tenant_id, entity_type, entity_id)` |
| `ix_fin_status_history_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_fin_status_history_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `fin_bank_lines`

[Spec 07 §3.17] [Fase 2] Líneas de extracto bancario y su conciliación.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `statement_id` | `uuid` | sí |  | FK → fin_bank_statements.id. |
| 5 | `bank` | `character varying(20)` | no |  |  |
| 6 | `value_date` | `date` | no |  |  |
| 7 | `description` | `character varying(255)` | no |  |  |
| 8 | `amount` | `numeric(14,2)` | no |  |  |
| 9 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 10 | `matched_payment_id` | `uuid` | sí |  | FK → fin_payments.id. |
| 11 | `matched_payable_id` | `uuid` | sí |  | FK → fin_payables.id. |
| 12 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `sugerido`, `excepcion`, `conciliado`. |
| 13 | `resolution` | `character varying(20)` | sí |  | Valores: `match`, `asignado`, `otro_ingreso`, `gasto_bancario`. |
| 14 | `resolution_note` | `text` | sí |  |  |
| 15 | `resolved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 16 | `closure_id` | `uuid` | sí |  | FK → fin_reconciliation_closures.id. |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `closure_id` | `fin_reconciliation_closures.id` | NO ACTION | `fk_fin_bank_lines_closure_id` |
| `matched_payable_id` | `fin_payables.id` | NO ACTION | `fk_fin_bank_lines_matched_payable_id` |
| `matched_payment_id` | `fin_payments.id` | NO ACTION | `fk_fin_bank_lines_matched_payment_id` |
| `resolved_by` | `iam_users.id` | NO ACTION | `fk_fin_bank_lines_resolved_by` |
| `statement_id` | `fin_bank_statements.id` | NO ACTION | `fk_fin_bank_lines_statement_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_bank_lines_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_bank_lines_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_fin_bank_lines_tenant_id_matched_payable_id_p` | `tenant_id, matched_payable_id` | `(((status)::text <> 'excepcion'::text) AND (matched_payable_id IS NOT NULL))` | índice único |
| `uq_fin_bank_lines_tenant_id_matched_payment_id_p` | `tenant_id, matched_payment_id` | `(((status)::text <> 'excepcion'::text) AND (matched_payment_id IS NOT NULL))` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_bank_lines_1` | `CHECK ((num_nonnulls(matched_payment_id, matched_payable_id) <= 1))` |  |
| `fin_bank_lines_amount_check` | `CHECK ((amount <> (0)::numeric))` |  |
| `fin_bank_lines_resolution_check` | `CHECK (((resolution IS NULL) OR ((resolution)::text = ANY ((ARRAY['match'::character varying, 'asignado'::character varying, 'otro_ingreso'::character varying, 'gasto_bancario'::character varying])::text[]))))` | `resolution`: `match`, `asignado`, `otro_ingreso`, `gasto_bancario` |
| `fin_bank_lines_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'sugerido'::character varying, 'excepcion'::character varying, 'conciliado'::character varying])::text[])))` | `status`: `pendiente`, `sugerido`, `excepcion`, `conciliado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_bank_lines_closure_id` | `USING btree (closure_id)` |
| `ix_fin_bank_lines_matched_payable_id` | `USING btree (matched_payable_id)` |
| `ix_fin_bank_lines_matched_payment_id` | `USING btree (matched_payment_id)` |
| `ix_fin_bank_lines_resolved_by` | `USING btree (resolved_by)` |
| `ix_fin_bank_lines_statement_id` | `USING btree (statement_id)` |
| `ix_fin_bank_lines_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_bank_lines_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_bank_lines_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_bank_statements`

[Spec 07 §3.17] [Fase 2] Extractos bancarios importados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `bank` | `character varying(20)` | no |  |  |
| 4 | `bank_account_id` | `uuid` | sí |  | FK → fin_bank_accounts.id. |
| 5 | `filename` | `character varying(200)` | no |  |  |
| 6 | `document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 7 | `format` | `character varying(10)` | no |  | Valores: `csv`, `txt`, `xlsx`. |
| 8 | `lines_count` | `integer` | no | `0` |  |
| 9 | `imported_by` | `uuid` | no |  | FK → iam_users.id. |
| 10 | `imported_at` | `timestamp with time zone` | no | `now()` |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `bank_account_id` | `fin_bank_accounts.id` | NO ACTION | `fk_fin_bank_statements_bank_account_id` |
| `document_id` | `sys_documents.id` | NO ACTION | `fk_fin_bank_statements_document_id` |
| `imported_by` | `iam_users.id` | NO ACTION | `fk_fin_bank_statements_imported_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_bank_statements_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_bank_statements_format_check` | `CHECK (((format)::text = ANY ((ARRAY['csv'::character varying, 'txt'::character varying, 'xlsx'::character varying])::text[])))` | `format`: `csv`, `txt`, `xlsx` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_bank_statements_bank_account_id` | `USING btree (bank_account_id)` |
| `ix_fin_bank_statements_document_id` | `USING btree (document_id)` |
| `ix_fin_bank_statements_imported_by` | `USING btree (imported_by)` |
| `ix_fin_bank_statements_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_bank_statements_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_cash_counts`

[Spec 12 §3.6] [Fase 2] Actas de arqueo de caja.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 5 | `session_id` | `uuid` | sí |  | FK → fin_cash_sessions.id. |
| 6 | `kind` | `character varying(10)` | no |  | Valores: `surprise`, `closing`. |
| 7 | `counted_at` | `timestamp with time zone` | no | `now()` |  |
| 8 | `denominations` | `jsonb` | no |  |  |
| 9 | `counted_amount` | `numeric(14,2)` | no |  |  |
| 10 | `expected_amount` | `numeric(14,2)` | no |  |  |
| 11 | `difference` | `numeric(14,2)` | no |  |  |
| 12 | `result` | `character varying(10)` | no |  | Valores: `balanced`, `over`, `short`. |
| 13 | `note` | `text` | sí |  |  |
| 14 | `signed_by` | `uuid` | no |  | FK → iam_users.id. |
| 15 | `signed_at` | `timestamp with time zone` | no | `now()` |  |
| 16 | `witness_id` | `uuid` | sí |  | FK → iam_users.id. |
| 17 | `status` | `character varying(25)` | no | `'signed'::character varying` | Valores: `signed`, `pending_approval`, `approved`, `validated`. |
| 18 | `approved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 19 | `approved_at` | `timestamp with time zone` | sí |  |  |
| 20 | `approve_note` | `text` | sí |  |  |
| 21 | `validated_by` | `uuid` | sí |  | FK → iam_users.id. |
| 22 | `validated_at` | `timestamp with time zone` | sí |  |  |
| 23 | `adjustment_movement_id` | `uuid` | sí |  | FK → fin_treasury_movements.id. |
| 24 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 25 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 26 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 27 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_cash_counts_account_id` |
| `adjustment_movement_id` | `fin_treasury_movements.id` | NO ACTION | `fk_fin_cash_counts_adjustment_movement_id` |
| `approved_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_counts_approved_by` |
| `session_id` | `fin_cash_sessions.id` | NO ACTION | `fk_fin_cash_counts_session_id` |
| `signed_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_counts_signed_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_cash_counts_tenant_id` |
| `validated_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_counts_validated_by` |
| `witness_id` | `iam_users.id` | NO ACTION | `fk_fin_cash_counts_witness_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_cash_counts_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_cash_counts_1` | `CHECK ((difference = (counted_amount - expected_amount)))` |  |
| `ck_fin_cash_counts_2` | `CHECK (((difference = (0)::numeric) OR (note IS NOT NULL)))` |  |
| `ck_fin_cash_counts_3` | `CHECK (((approved_by IS NULL) OR (approved_by <> signed_by)))` |  |
| `fin_cash_counts_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['surprise'::character varying, 'closing'::character varying])::text[])))` | `kind`: `surprise`, `closing` |
| `fin_cash_counts_result_check` | `CHECK (((result)::text = ANY ((ARRAY['balanced'::character varying, 'over'::character varying, 'short'::character varying])::text[])))` | `result`: `balanced`, `over`, `short` |
| `fin_cash_counts_status_check` | `CHECK (((status)::text = ANY ((ARRAY['signed'::character varying, 'pending_approval'::character varying, 'approved'::character varying, 'validated'::character varying])::text[])))` | `status`: `signed`, `pending_approval`, `approved`, `validated` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_cash_counts_account_id` | `USING btree (account_id)` |
| `ix_fin_cash_counts_adjustment_movement_id` | `USING btree (adjustment_movement_id)` |
| `ix_fin_cash_counts_approved_by` | `USING btree (approved_by)` |
| `ix_fin_cash_counts_session_id` | `USING btree (session_id)` |
| `ix_fin_cash_counts_signed_by` | `USING btree (signed_by)` |
| `ix_fin_cash_counts_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_cash_counts_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_fin_cash_counts_validated_by` | `USING btree (validated_by)` |
| `ix_fin_cash_counts_witness_id` | `USING btree (witness_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_cash_counts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_cash_replenishment_events`

[Spec 12 §3.7] [Fase 2] Historial de estados de la reposición. (columnas supuestas)

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `replenishment_id` | `uuid` | no |  | FK → fin_cash_replenishments.id. |
| 4 | `from_status` | `character varying(15)` | sí |  |  |
| 5 | `to_status` | `character varying(15)` | no |  |  |
| 6 | `note` | `text` | sí |  |  |
| 7 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `replenishment_id` | `fin_cash_replenishments.id` | NO ACTION | `fk_fin_cash_replenishment_events_replenishment_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_cash_replenishment_events_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_fin_cash_replenishment_events_user_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_cash_replenishment_events_replenishment_id` | `USING btree (replenishment_id)` |
| `ix_fin_cash_replenishment_events_tenant_id` | `USING btree (tenant_id)` |
| `ix_fin_cash_replenishment_events_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `fin_cash_replenishments`

[Spec 12 §3.7] [Fase 2] Reposiciones de caja chica.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 5 | `amount` | `numeric(14,2)` | no |  |  |
| 6 | `status` | `character varying(15)` | no | `'requested'::character varying` | Valores: `requested`, `approved`, `paid`, `rejected`. |
| 7 | `requested_by` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `requested_at` | `timestamp with time zone` | sí |  |  |
| 9 | `approved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 10 | `approved_at` | `timestamp with time zone` | sí |  |  |
| 11 | `paid_by` | `uuid` | sí |  | FK → iam_users.id. |
| 12 | `paid_at` | `timestamp with time zone` | sí |  |  |
| 13 | `paid_from_account_id` | `uuid` | sí |  | FK → fin_treasury_accounts.id. |
| 14 | `transfer_id` | `uuid` | sí |  | FK → fin_treasury_transfers.id. |
| 15 | `reject_reason` | `text` | sí |  |  |
| 16 | `note` | `text` | sí |  |  |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_cash_replenishments_account_id` |
| `approved_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_replenishments_approved_by` |
| `paid_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_replenishments_paid_by` |
| `paid_from_account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_cash_replenishments_paid_from_account_id` |
| `requested_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_replenishments_requested_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_cash_replenishments_tenant_id` |
| `transfer_id` | `fin_treasury_transfers.id` | NO ACTION | `fk_fin_cash_replenishments_transfer_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_cash_replenishments_tenant_id_account_id_p` | `tenant_id, account_id` | `((status)::text = ANY ((ARRAY['requested'::character varying, 'approved'::character varying])::text[]))` | índice único |
| `uq_fin_cash_replenishments_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_cash_replenishments_1` | `CHECK (((approved_by IS NULL) OR (approved_by <> requested_by)))` |  |
| `fin_cash_replenishments_status_check` | `CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'approved'::character varying, 'paid'::character varying, 'rejected'::character varying])::text[])))` | `status`: `requested`, `approved`, `paid`, `rejected` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_cash_replenishments_account_id` | `USING btree (account_id)` |
| `ix_fin_cash_replenishments_approved_by` | `USING btree (approved_by)` |
| `ix_fin_cash_replenishments_paid_by` | `USING btree (paid_by)` |
| `ix_fin_cash_replenishments_paid_from_account_id` | `USING btree (paid_from_account_id)` |
| `ix_fin_cash_replenishments_requested_by` | `USING btree (requested_by)` |
| `ix_fin_cash_replenishments_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_cash_replenishments_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_fin_cash_replenishments_transfer_id` | `USING btree (transfer_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_cash_replenishments_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_cash_sessions`

[Spec 12 §3.5] [Fase 2] Sesiones diarias de caja chica.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 5 | `session_date` | `date` | no |  |  |
| 6 | `opened_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `opened_by` | `uuid` | no |  | FK → iam_users.id. |
| 8 | `opening_amount` | `numeric(14,2)` | no |  |  |
| 9 | `closed_at` | `timestamp with time zone` | sí |  |  |
| 10 | `closed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 11 | `closing_count_id` | `uuid` | sí |  | FK → fin_cash_counts.id. |
| 12 | `status` | `character varying(10)` | no | `'open'::character varying` | Valores: `open`, `closed`. |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_cash_sessions_account_id` |
| `closed_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_sessions_closed_by` |
| `closing_count_id` | `fin_cash_counts.id` | NO ACTION | `fk_fin_cash_sessions_closing_count_id` |
| `opened_by` | `iam_users.id` | NO ACTION | `fk_fin_cash_sessions_opened_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_cash_sessions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_cash_sessions_tenant_id_account_id_p` | `tenant_id, account_id` | `((status)::text = 'open'::text)` | índice único |
| `uq_fin_cash_sessions_tenant_id_account_id_session_date` | `tenant_id, account_id, session_date` |  | índice único |
| `uq_fin_cash_sessions_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_cash_sessions_1` | `CHECK ((((status)::text <> 'closed'::text) OR (closing_count_id IS NOT NULL)))` |  |
| `fin_cash_sessions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[])))` | `status`: `open`, `closed` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_cash_sessions_account_id` | `USING btree (account_id)` |
| `ix_fin_cash_sessions_closed_by` | `USING btree (closed_by)` |
| `ix_fin_cash_sessions_closing_count_id` | `USING btree (closing_count_id)` |
| `ix_fin_cash_sessions_opened_by` | `USING btree (opened_by)` |
| `ix_fin_cash_sessions_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_cash_sessions_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_cash_sessions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_currencies`

[Spec 17 §3.6] [Fase 2] Monedas activas del tenant (base / cobro).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character(3)` | no |  |  |
| 4 | `name` | `character varying(60)` | no |  |  |
| 5 | `symbol` | `character varying(8)` | no |  |  |
| 6 | `active` | `boolean` | no | `true` |  |
| 7 | `is_base` | `boolean` | no | `false` |  |
| 8 | `is_charge` | `boolean` | no | `false` |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_currencies_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_currencies_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_fin_currencies_tenant_id_p` | `tenant_id` | `is_base` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_currencies_1` | `CHECK (((NOT is_charge) OR active))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_currencies_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_currencies_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_document_series`

[Spec 07 §3.13] [Fase 2] Series de comprobantes (F001, B001, FC01, BC01).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `doc_type` | `character(2)` | no |  | Valores: `01`, `03`, `07`, `08`. |
| 4 | `series` | `character(4)` | no |  |  |
| 5 | `next_number` | `integer` | no | `1` |  |
| 6 | `sede_id` | `uuid` | sí |  | FK → iam_sedes.id. |
| 7 | `active` | `boolean` | no | `true` |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `sede_id` | `iam_sedes.id` | NO ACTION | `fk_fin_document_series_sede_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_document_series_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_document_series_tenant_id_series` | `tenant_id, series` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_document_series_doc_type_check` | `CHECK ((doc_type = ANY (ARRAY['01'::bpchar, '03'::bpchar, '07'::bpchar, '08'::bpchar])))` | `doc_type`: `01`, `03`, `07`, `08` |
| `fin_document_series_next_number_check` | `CHECK ((next_number > 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_document_series_sede_id` | `USING btree (sede_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_document_series_no_decrease` | BEFORE UPDATE | `app_sequence_no_decrease` |
| `trg_fin_document_series_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_expense_receipts`

[Spec 12 §3.3] [Fase 2] Comprobante del gasto de caja chica.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `movement_id` | `uuid` | no |  | FK → fin_treasury_movements.id. |
| 4 | `receipt_type` | `character varying(30)` | no |  | Valores: `invoice`, `sales_receipt`, `ticket`, `fee_receipt`, `mobility_sheet`, `sworn_statement`. |
| 5 | `series_number` | `character varying(30)` | sí |  |  |
| 6 | `issuer_ruc` | `character(11)` | sí |  |  |
| 7 | `supplier_name` | `character varying(160)` | no |  |  |
| 8 | `file_path` | `character varying(255)` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `movement_id` | `fin_treasury_movements.id` | NO ACTION | `fk_fin_expense_receipts_movement_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_expense_receipts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_expense_receipts_movement_id` | `movement_id` |  | índice único |
| `uq_fin_expense_receipts_tenant_id_issuer_ruc_series_number_p` | `tenant_id, issuer_ruc, series_number` | `(issuer_ruc IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_expense_receipts_1` | `CHECK ((((receipt_type)::text = ANY ((ARRAY['mobility_sheet'::character varying, 'sworn_statement'::character varying])::text[])) OR (series_number IS NOT NULL)))` |  |
| `ck_fin_expense_receipts_2` | `CHECK ((((receipt_type)::text <> ALL ((ARRAY['invoice'::character varying, 'fee_receipt'::character varying])::text[])) OR (issuer_ruc IS NOT NULL)))` |  |
| `fin_expense_receipts_issuer_ruc_check` | `CHECK ((issuer_ruc ~ '^[0-9]{11}$'::text))` |  |
| `fin_expense_receipts_receipt_type_check` | `CHECK (((receipt_type)::text = ANY ((ARRAY['invoice'::character varying, 'sales_receipt'::character varying, 'ticket'::character varying, 'fee_receipt'::character varying, 'mobility_sheet'::character varying, 'sworn_statement'::character varying])::text[])))` | `receipt_type`: `invoice`, `sales_receipt`, `ticket`, `fee_receipt`, `mobility_sheet`, `sworn_statement` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_expense_receipts_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_expense_receipts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_fiscal_events`

[Spec 07 §3.16] [Fase 2] Bitácora de integración fiscal OSE/PSE.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `invoice_id` | `uuid` | no |  | FK → fin_invoices.id. |
| 4 | `action` | `character varying(20)` | no |  | Valores: `send`, `status`, `resend`, `void`. |
| 5 | `attempt` | `smallint` | no | `1` |  |
| 6 | `request_hash` | `character varying(64)` | sí |  |  |
| 7 | `response_code` | `character varying(10)` | sí |  |  |
| 8 | `response_message` | `text` | sí |  |  |
| 9 | `payload_document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 10 | `status` | `character varying(20)` | no |  | Valores: `ok`, `error_temporal`, `error_definitivo`. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `invoice_id` | `fin_invoices.id` | NO ACTION | `fk_fin_fiscal_events_invoice_id` |
| `payload_document_id` | `sys_documents.id` | NO ACTION | `fk_fin_fiscal_events_payload_document_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_fiscal_events_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_fiscal_events_action_check` | `CHECK (((action)::text = ANY ((ARRAY['send'::character varying, 'status'::character varying, 'resend'::character varying, 'void'::character varying])::text[])))` | `action`: `send`, `status`, `resend`, `void` |
| `fin_fiscal_events_status_check` | `CHECK (((status)::text = ANY ((ARRAY['ok'::character varying, 'error_temporal'::character varying, 'error_definitivo'::character varying])::text[])))` | `status`: `ok`, `error_temporal`, `error_definitivo` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_fiscal_events_invoice_id` | `USING btree (invoice_id)` |
| `ix_fin_fiscal_events_payload_document_id` | `USING btree (payload_document_id)` |
| `ix_fin_fiscal_events_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `fin_fx_revaluations`

[Spec 12 §3.8] [Fase 2] Diferencia de cambio mensual por cuenta USD.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 5 | `period` | `character(7)` | no |  |  |
| 6 | `revaluation_date` | `date` | no |  |  |
| 7 | `balance_usd` | `numeric(14,2)` | no |  |  |
| 8 | `book_rate` | `numeric(12,6)` | no |  |  |
| 9 | `close_rate` | `numeric(12,6)` | no |  |  |
| 10 | `diff_pen` | `numeric(14,2)` | no |  |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_fx_revaluations_account_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_fx_revaluations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_fx_revaluations_tenant_id_account_id_period` | `tenant_id, account_id, period` |  | índice único |
| `uq_fin_fx_revaluations_tenant_id_code` | `tenant_id, code` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_fx_revaluations_account_id` | `USING btree (account_id)` |
| `ix_fin_fx_revaluations_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_fx_revaluations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_invoice_lines`

[Spec 07 §3.15] [Fase 2] Líneas del comprobante.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `invoice_id` | `uuid` | no |  | FK → fin_invoices.id. |
| 4 | `line_no` | `smallint` | no | `1` |  |
| 5 | `description` | `character varying(500)` | no |  |  |
| 6 | `quantity` | `numeric(12,3)` | no | `1` |  |
| 7 | `unit_code` | `character varying(3)` | no | `'ZZ'::character varying` |  |
| 8 | `unit_value` | `numeric(14,2)` | no |  |  |
| 9 | `igv_affectation` | `character varying(2)` | no | `'10'::character varying` | Valores: `10`, `40`. |
| 10 | `line_amount` | `numeric(14,2)` | no |  |  |
| 11 | `igv_amount` | `numeric(14,2)` | no | `0` |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `invoice_id` | `fin_invoices.id` | NO ACTION | `fk_fin_invoice_lines_invoice_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_invoice_lines_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_invoice_lines_invoice_id_line_no` | `invoice_id, line_no` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_invoice_lines_igv_affectation_check` | `CHECK (((igv_affectation)::text = ANY ((ARRAY['10'::character varying, '40'::character varying])::text[])))` | `igv_affectation`: `10`, `40` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_invoice_lines_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_invoice_lines_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_invoices`

[Spec 07 §3.14] [Fase 2] Comprobantes electrónicos (factura, boleta, NC, ND). Nunca se borran.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `number` | `character varying(20)` | no |  |  |
| 4 | `doc_type` | `character(2)` | no |  | Valores: `01`, `03`, `07`, `08`. |
| 5 | `series` | `character(4)` | no |  |  |
| 6 | `correlative` | `integer` | no |  |  |
| 7 | `issue_date` | `date` | no | `CURRENT_DATE` |  |
| 8 | `period` | `character(7)` | no |  |  |
| 9 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 10 | `customer_doc_type` | `character varying(10)` | no |  | Valores: `RUC`, `DNI`, `PASAPORTE`, `CE`, `SIN_DOC`. |
| 11 | `customer_doc_number` | `character varying(20)` | no |  |  |
| 12 | `customer_name` | `character varying(200)` | no |  |  |
| 13 | `customer_address` | `character varying(255)` | sí |  |  |
| 14 | `customer_domiciled` | `boolean` | no | `true` |  |
| 15 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 16 | `receivable_id` | `uuid` | sí |  | FK → fin_receivables.id. |
| 17 | `operation_type` | `character varying(20)` | no | `'gravada'::character varying` | Valores: `gravada`, `exportacion`. |
| 18 | `sunat_operation_code` | `character varying(4)` | sí |  |  |
| 19 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 20 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 21 | `taxable_amount` | `numeric(14,2)` | no |  |  |
| 22 | `igv_amount` | `numeric(14,2)` | no |  |  |
| 23 | `exempt_amount` | `numeric(14,2)` | no | `0` |  |
| 24 | `total_amount` | `numeric(14,2)` | no |  |  |
| 25 | `amount_in_words` | `character varying(255)` | no |  |  |
| 26 | `description` | `character varying(500)` | no |  |  |
| 27 | `ref_invoice_id` | `uuid` | sí |  | FK → fin_invoices.id. |
| 28 | `credit_note_reason_code` | `character(2)` | sí |  |  |
| 29 | `credit_note_reason` | `character varying(255)` | sí |  |  |
| 30 | `status` | `character varying(20)` | no | `'pendiente_envio'::character varying` | Valores: `pendiente_envio`, `emitido`, `aceptado`, `observado`, `rechazado`, `anulado`. |
| 31 | `fiscal_provider` | `character varying(30)` | sí |  |  |
| 32 | `ose_ticket` | `character varying(80)` | sí |  |  |
| 33 | `ose_response_code` | `character varying(10)` | sí |  |  |
| 34 | `ose_response_message` | `text` | sí |  |  |
| 35 | `ose_responded_at` | `timestamp with time zone` | sí |  |  |
| 36 | `xml_document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 37 | `cdr_document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 38 | `pdf_document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 39 | `hash_code` | `character varying(64)` | sí |  |  |
| 40 | `delivered_at` | `timestamp with time zone` | sí |  |  |
| 41 | `issued_by` | `uuid` | no |  | FK → iam_users.id. |
| 42 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 43 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 44 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 45 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 46 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `cdr_document_id` | `sys_documents.id` | NO ACTION | `fk_fin_invoices_cdr_document_id` |
| `client_id` | `crm_clients.id` | NO ACTION | `fk_fin_invoices_client_id` |
| `issued_by` | `iam_users.id` | NO ACTION | `fk_fin_invoices_issued_by` |
| `pdf_document_id` | `sys_documents.id` | NO ACTION | `fk_fin_invoices_pdf_document_id` |
| `receivable_id` | `fin_receivables.id` | NO ACTION | `fk_fin_invoices_receivable_id` |
| `ref_invoice_id` | `fin_invoices.id` | NO ACTION | `fk_fin_invoices_ref_invoice_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_invoices_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_invoices_tenant_id` |
| `xml_document_id` | `sys_documents.id` | NO ACTION | `fk_fin_invoices_xml_document_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_invoices_tenant_id_number` | `tenant_id, number` |  | índice único |
| `uq_fin_invoices_tenant_id_series_correlative` | `tenant_id, series, correlative` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_invoices_1` | `CHECK (((doc_type <> ALL (ARRAY['07'::bpchar, '08'::bpchar])) OR (ref_invoice_id IS NOT NULL)))` |  |
| `ck_fin_invoices_2` | `CHECK (((currency <> 'USD'::bpchar) OR (fx_rate IS NOT NULL)))` |  |
| `fin_invoices_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `fin_invoices_customer_doc_type_check` | `CHECK (((customer_doc_type)::text = ANY ((ARRAY['RUC'::character varying, 'DNI'::character varying, 'PASAPORTE'::character varying, 'CE'::character varying, 'SIN_DOC'::character varying])::text[])))` | `customer_doc_type`: `RUC`, `DNI`, `PASAPORTE`, `CE`, `SIN_DOC` |
| `fin_invoices_doc_type_check` | `CHECK ((doc_type = ANY (ARRAY['01'::bpchar, '03'::bpchar, '07'::bpchar, '08'::bpchar])))` | `doc_type`: `01`, `03`, `07`, `08` |
| `fin_invoices_operation_type_check` | `CHECK (((operation_type)::text = ANY ((ARRAY['gravada'::character varying, 'exportacion'::character varying])::text[])))` | `operation_type`: `gravada`, `exportacion` |
| `fin_invoices_period_check` | `CHECK ((period ~ '^[0-9]{4}-[0-9]{2}$'::text))` |  |
| `fin_invoices_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente_envio'::character varying, 'emitido'::character varying, 'aceptado'::character varying, 'observado'::character varying, 'rechazado'::character varying, 'anulado'::character varying])::text[])))` | `status`: `pendiente_envio`, `emitido`, `aceptado`, `observado`, `rechazado`, `anulado` |
| `fin_invoices_total_amount_check` | `CHECK ((total_amount > (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_invoices_cdr_document_id` | `USING btree (cdr_document_id)` |
| `ix_fin_invoices_client_id` | `USING btree (client_id)` |
| `ix_fin_invoices_issued_by` | `USING btree (issued_by)` |
| `ix_fin_invoices_pdf_document_id` | `USING btree (pdf_document_id)` |
| `ix_fin_invoices_receivable_id` | `USING btree (receivable_id)` |
| `ix_fin_invoices_ref_invoice_id` | `USING btree (ref_invoice_id)` |
| `ix_fin_invoices_reservation_id` | `USING btree (reservation_id)` |
| `ix_fin_invoices_tenant_id_client_id` | `USING btree (tenant_id, client_id)` |
| `ix_fin_invoices_tenant_id_doc_type` | `USING btree (tenant_id, doc_type)` |
| `ix_fin_invoices_tenant_id_issue_date_desc` | `USING btree (tenant_id, issue_date DESC)` |
| `ix_fin_invoices_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_fin_invoices_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_fin_invoices_xml_document_id` | `USING btree (xml_document_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_invoices_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_fin_invoices_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_period_close_checks`

[Spec 07 §3.18] [Fase 2] Controles manuales del cierre de periodo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `period_close_id` | `uuid` | no |  | FK → fin_period_closes.id. |
| 4 | `check_code` | `character varying(20)` | no |  | Valores: `fx`, `aging`, `igv`. |
| 5 | `checked_by` | `uuid` | no |  | FK → iam_users.id. |
| 6 | `checked_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `checked_by` | `iam_users.id` | NO ACTION | `fk_fin_period_close_checks_checked_by` |
| `period_close_id` | `fin_period_closes.id` | CASCADE | `fk_fin_period_close_checks_period_close_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_period_close_checks_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_period_close_checks_period_close_id_check_code` | `period_close_id, check_code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_period_close_checks_check_code_check` | `CHECK (((check_code)::text = ANY ((ARRAY['fx'::character varying, 'aging'::character varying, 'igv'::character varying])::text[])))` | `check_code`: `fx`, `aging`, `igv` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_period_close_checks_checked_by` | `USING btree (checked_by)` |
| `ix_fin_period_close_checks_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_period_close_checks_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_period_closes`

[Spec 07 §3.18] [Fase 2] Cierre de periodo contable.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `period` | `character(7)` | no |  |  |
| 4 | `status` | `character varying(10)` | no | `'abierto'::character varying` | Valores: `abierto`, `cerrado`. |
| 5 | `closed_at` | `timestamp with time zone` | sí |  |  |
| 6 | `closed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `snapshot` | `jsonb` | sí |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `closed_by` | `iam_users.id` | NO ACTION | `fk_fin_period_closes_closed_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_period_closes_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_period_closes_tenant_id_period` | `tenant_id, period` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fin_period_closes_period_check` | `CHECK ((period ~ '^[0-9]{4}-[0-9]{2}$'::text))` |  |
| `fin_period_closes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierto'::character varying, 'cerrado'::character varying])::text[])))` | `status`: `abierto`, `cerrado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_period_closes_closed_by` | `USING btree (closed_by)` |
| `ix_fin_period_closes_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_period_closes_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_reconciliation_closures`

[Spec 07 §3.17] [Fase 2] Cierres de conciliación bancaria.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `period` | `character(7)` | no |  |  |
| 5 | `closed_at` | `timestamp with time zone` | no | `now()` |  |
| 6 | `closed_by` | `uuid` | no |  | FK → iam_users.id. |
| 7 | `lines_count` | `integer` | no |  |  |
| 8 | `credits` | `numeric(14,2)` | no |  |  |
| 9 | `debits` | `numeric(14,2)` | no |  |  |
| 10 | `net` | `numeric(14,2)` | no |  |  |
| 11 | `matched_count` | `integer` | no |  |  |
| 12 | `others_count` | `integer` | no |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `closed_by` | `iam_users.id` | NO ACTION | `fk_fin_reconciliation_closures_closed_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_reconciliation_closures_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_reconciliation_closures_tenant_id_code` | `tenant_id, code` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_reconciliation_closures_closed_by` | `USING btree (closed_by)` |
| `ix_fin_reconciliation_closures_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_reconciliation_closures_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_treasury_accounts`

[Spec 12 §3.1] [Fase 2] Cuentas de tesorería (banco, caja chica, pasarela).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `kind` | `character varying(20)` | no |  | Valores: `bank`, `petty_cash`, `gateway`. |
| 5 | `bank` | `character varying(40)` | sí |  |  |
| 6 | `name` | `character varying(120)` | no |  |  |
| 7 | `account_number` | `character varying(40)` | sí |  |  |
| 8 | `cci` | `character varying(25)` | sí |  |  |
| 9 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 10 | `sede_id` | `uuid` | no |  | FK → iam_sedes.id. |
| 11 | `fund_amount` | `numeric(14,2)` | sí |  |  |
| 12 | `custodian_id` | `uuid` | sí |  | FK → iam_users.id. |
| 13 | `settle_to_account_id` | `uuid` | sí |  | FK → fin_treasury_accounts.id. |
| 14 | `opening_balance` | `numeric(14,2)` | no | `0` |  |
| 15 | `opening_rate` | `numeric(12,6)` | sí |  |  |
| 16 | `opening_date` | `date` | no |  |  |
| 17 | `status` | `character varying(20)` | no | `'active'::character varying` | Valores: `active`, `inactive`. |
| 18 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 23 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `custodian_id` | `iam_users.id` | NO ACTION | `fk_fin_treasury_accounts_custodian_id` |
| `sede_id` | `iam_sedes.id` | NO ACTION | `fk_fin_treasury_accounts_sede_id` |
| `settle_to_account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_treasury_accounts_settle_to_account_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_treasury_accounts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_treasury_accounts_tenant_id_bank_account_number_p` | `tenant_id, bank, account_number` | `(account_number IS NOT NULL)` | índice único |
| `uq_fin_treasury_accounts_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_treasury_accounts_1` | `CHECK ((((kind)::text <> 'petty_cash'::text) OR ((fund_amount IS NOT NULL) AND (custodian_id IS NOT NULL))))` |  |
| `ck_fin_treasury_accounts_2` | `CHECK ((((kind)::text <> 'gateway'::text) OR (settle_to_account_id IS NOT NULL)))` |  |
| `fin_treasury_accounts_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `fin_treasury_accounts_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['bank'::character varying, 'petty_cash'::character varying, 'gateway'::character varying])::text[])))` | `kind`: `bank`, `petty_cash`, `gateway` |
| `fin_treasury_accounts_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))` | `status`: `active`, `inactive` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_treasury_accounts_custodian_id` | `USING btree (custodian_id)` |
| `ix_fin_treasury_accounts_sede_id` | `USING btree (sede_id)` |
| `ix_fin_treasury_accounts_settle_to_account_id` | `USING btree (settle_to_account_id)` |
| `ix_fin_treasury_accounts_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_treasury_accounts_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_treasury_accounts_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_fin_treasury_accounts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_treasury_movements`

[Spec 12 §3.2] [Fase 2] Movimientos de tesorería (saldo derivado).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 5 | `movement_date` | `date` | no |  |  |
| 6 | `direction` | `character(3)` | no |  | Valores: `in`, `out`. |
| 7 | `type` | `character varying(30)` | no |  | Valores: `collection`, `collection_reversal`, `supplier_payment`, `transfer`, `petty_expense`, `replenishment`, `gateway_settlement`, `gateway_fee`, `count_adjustment`, `other_income`, `other_expense`. |
| 8 | `amount` | `numeric(14,2)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  |  |
| 10 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 11 | `orig_amount` | `numeric(14,2)` | sí |  |  |
| 12 | `orig_currency` | `character(3)` | sí |  |  |
| 13 | `orig_fx_rate` | `numeric(12,6)` | sí |  |  |
| 14 | `source_type` | `character varying(30)` | no |  | Valores: `payment`, `payment_reversal`, `payout`, `payable`, `transfer`, `expense`, `replenishment`, `gateway`, `cash_count`, `manual`. |
| 15 | `source_id` | `uuid` | sí |  |  |
| 16 | `source_key` | `character varying(60)` | sí |  |  |
| 17 | `transfer_id` | `uuid` | sí |  | FK → fin_treasury_transfers.id. |
| 18 | `replenishment_id` | `uuid` | sí |  | FK → fin_cash_replenishments.id. |
| 19 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 20 | `category` | `character varying(60)` | sí |  |  |
| 21 | `description` | `character varying(255)` | no |  |  |
| 22 | `reference` | `character varying(80)` | sí |  |  |
| 23 | `counterparty` | `character varying(160)` | sí |  |  |
| 24 | `sede_id` | `uuid` | sí |  | FK → iam_sedes.id. |
| 25 | `deposited_transfer_id` | `uuid` | sí |  | FK → fin_treasury_transfers.id. |
| 26 | `status` | `character varying(20)` | no | `'posted'::character varying` | Valores: `posted`, `voided`. |
| 27 | `void_reason` | `text` | sí |  |  |
| 28 | `voided_by` | `uuid` | sí |  | FK → iam_users.id. |
| 29 | `voided_at` | `timestamp with time zone` | sí |  |  |
| 30 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 31 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 32 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 33 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_treasury_movements_account_id` |
| `deposited_transfer_id` | `fin_treasury_transfers.id` | NO ACTION | `fk_fin_treasury_movements_deposited_transfer_id` |
| `replenishment_id` | `fin_cash_replenishments.id` | NO ACTION | `fk_fin_treasury_movements_replenishment_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_fin_treasury_movements_reservation_id` |
| `sede_id` | `iam_sedes.id` | NO ACTION | `fk_fin_treasury_movements_sede_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_treasury_movements_tenant_id` |
| `transfer_id` | `fin_treasury_transfers.id` | NO ACTION | `fk_fin_treasury_movements_transfer_id` |
| `voided_by` | `iam_users.id` | NO ACTION | `fk_fin_treasury_movements_voided_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_treasury_movements_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_fin_treasury_movements_tenant_id_source_key_p` | `tenant_id, source_key` | `(source_key IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_treasury_movements_1` | `CHECK ((((status)::text <> 'voided'::text) OR ((void_reason IS NOT NULL) AND (voided_by IS NOT NULL) AND (voided_at IS NOT NULL))))` |  |
| `fin_treasury_movements_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `fin_treasury_movements_direction_check` | `CHECK ((direction = ANY (ARRAY['in'::bpchar, 'out'::bpchar])))` | `direction`: `in`, `out` |
| `fin_treasury_movements_source_type_check` | `CHECK (((source_type)::text = ANY ((ARRAY['payment'::character varying, 'payment_reversal'::character varying, 'payout'::character varying, 'payable'::character varying, 'transfer'::character varying, 'expense'::character varying, 'replenishment'::character varying, 'gateway'::character varying, 'cash_count'::character varying, 'manual'::character varying])::text[])))` | `source_type`: `payment`, `payment_reversal`, `payout`, `payable`, `transfer`, `expense`, `replenishment`, `gateway`, `cash_count`, `manual` |
| `fin_treasury_movements_status_check` | `CHECK (((status)::text = ANY ((ARRAY['posted'::character varying, 'voided'::character varying])::text[])))` | `status`: `posted`, `voided` |
| `fin_treasury_movements_type_check` | `CHECK (((type)::text = ANY ((ARRAY['collection'::character varying, 'collection_reversal'::character varying, 'supplier_payment'::character varying, 'transfer'::character varying, 'petty_expense'::character varying, 'replenishment'::character varying, 'gateway_settlement'::character varying, 'gateway_fee'::character varying, 'count_adjustment'::character varying, 'other_income'::character varying, 'other_expense'::character varying])::text[])))` | `type`: `collection`, `collection_reversal`, `supplier_payment`, `transfer`, `petty_expense`, `replenishment`, `gateway_settlement`, `gateway_fee`, `count_adjustment`, `other_income`, `other_expense` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_treasury_movements_account_id` | `USING btree (account_id)` |
| `ix_fin_treasury_movements_deposited_transfer_id` | `USING btree (deposited_transfer_id)` |
| `ix_fin_treasury_movements_replenishment_id` | `USING btree (replenishment_id)` |
| `ix_fin_treasury_movements_reservation_id` | `USING btree (reservation_id)` |
| `ix_fin_treasury_movements_sede_id` | `USING btree (sede_id)` |
| `ix_fin_treasury_movements_tenant_id_account_id_movement_date` | `USING btree (tenant_id, account_id, movement_date)` |
| `ix_fin_treasury_movements_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_treasury_movements_tenant_id_movement_date_desc` | `USING btree (tenant_id, movement_date DESC)` |
| `ix_fin_treasury_movements_tenant_id_replenishment_id` | `USING btree (tenant_id, replenishment_id)` |
| `ix_fin_treasury_movements_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_fin_treasury_movements_tenant_id_type` | `USING btree (tenant_id, type)` |
| `ix_fin_treasury_movements_transfer_id` | `USING btree (transfer_id)` |
| `ix_fin_treasury_movements_voided_by` | `USING btree (voided_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_treasury_movements_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_treasury_settings`

[Spec 12 §3.9] [Fase 2] Parámetros de tesorería (1 fila por tenant).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `petty_tolerance` | `numeric(14,2)` | no | `10.00` |  |
| 4 | `max_petty_expense` | `numeric(14,2)` | no | `500.00` |  |
| 5 | `sworn_statement_max` | `numeric(14,2)` | no | `150.00` |  |
| 6 | `replenish_threshold_pct` | `smallint` | no | `40` |  |
| 7 | `gateway_fee_pct` | `numeric(5,2)` | no | `4.00` |  |
| 8 | `cash_deposit_hours` | `smallint` | no | `24` |  |
| 9 | `recurring_outflows` | `jsonb` | no | `'[]'::jsonb` |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_treasury_settings_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_treasury_settings_tenant_id` | `tenant_id` |  | índice único |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_treasury_settings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fin_treasury_transfers`

[Spec 12 §3.4] [Fase 2] Transferencias entre cuentas / liquidaciones de pasarela.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `from_account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 5 | `to_account_id` | `uuid` | no |  | FK → fin_treasury_accounts.id. |
| 6 | `amount_from` | `numeric(14,2)` | no |  |  |
| 7 | `amount_to` | `numeric(14,2)` | no |  |  |
| 8 | `deal_rate` | `numeric(12,6)` | sí |  |  |
| 9 | `kind` | `character varying(20)` | no |  | Valores: `transfer`, `replenishment`, `gateway_settlement`, `cash_deposit`. |
| 10 | `transfer_date` | `date` | no |  |  |
| 11 | `reference` | `character varying(80)` | no |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `from_account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_treasury_transfers_from_account_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fin_treasury_transfers_tenant_id` |
| `to_account_id` | `fin_treasury_accounts.id` | NO ACTION | `fk_fin_treasury_transfers_to_account_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fin_treasury_transfers_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_fin_treasury_transfers_1` | `CHECK ((from_account_id <> to_account_id))` |  |
| `fin_treasury_transfers_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['transfer'::character varying, 'replenishment'::character varying, 'gateway_settlement'::character varying, 'cash_deposit'::character varying])::text[])))` | `kind`: `transfer`, `replenishment`, `gateway_settlement`, `cash_deposit` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fin_treasury_transfers_from_account_id` | `USING btree (from_account_id)` |
| `ix_fin_treasury_transfers_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fin_treasury_transfers_to_account_id` | `USING btree (to_account_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fin_treasury_transfers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `fx_rate_providers`

[Spec 17 §3.6 (v2.2)] [Fase 2] Proveedores de tipo de cambio.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Finanzas y tesorería (fin_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `kind` | `character varying(20)` | no |  | Valores: `Simulado`, `Oficial`, `API`, `Manual`. |
| 6 | `status` | `character varying(20)` | no | `'por_validar'::character varying` | Valores: `activo`, `por_validar`, `inactivo`, `error`. |
| 7 | `schedule_cron` | `character varying(40)` | sí |  |  |
| 8 | `secret_ref` | `character varying(200)` | sí |  |  |
| 9 | `last_run_at` | `timestamp with time zone` | sí |  |  |
| 10 | `last_error` | `text` | sí |  |  |
| 11 | `note` | `text` | sí |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_fx_rate_providers_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_fx_rate_providers_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `fx_rate_providers_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['Simulado'::character varying, 'Oficial'::character varying, 'API'::character varying, 'Manual'::character varying])::text[])))` | `kind`: `Simulado`, `Oficial`, `API`, `Manual` |
| `fx_rate_providers_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'por_validar'::character varying, 'inactivo'::character varying, 'error'::character varying])::text[])))` | `status`: `activo`, `por_validar`, `inactivo`, `error` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_fx_rate_providers_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_fx_rate_providers_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fx_rate_providers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
