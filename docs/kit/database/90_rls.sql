-- =============================================================================
-- KipuControl · Esquema PostgreSQL 17 · 90_rls.sql
-- Roles de base de datos, privilegios, Row Level Security por tenant y funciones de
-- resolución previas al contexto (host, API key, widget, webhooks).
-- Idempotente: puede ejecutarse después de CADA fase (omite tablas aún inexistentes).
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- roles (NOLOGIN; los usuarios de conexión se crean en infra)
-- app_role      : conexión de la API/colas del tenant. Sin BYPASSRLS. Siempre con app.tenant_id fijado.
-- platform_role : conexión de plataforma (App\Domain\Platform\*): Super Admin, facturación SaaS, jobs multi-tenant.
--                 Accede a todo vía la política platform_access (no requiere BYPASSRLS; compatible con RDS/Cloud SQL).
-- Ejemplo infra:  create role kipucontrol_app login password '…' in role app_role;
--                 create role kipucontrol_platform login password '…' in role platform_role;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_role') then
    create role app_role nologin nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'platform_role') then
    create role platform_role nologin nobypassrls;
  end if;
end $$;

-- ---------------------------------------------------------------- privilegios
grant usage on schema public to app_role, platform_role;
grant select, insert, update, delete on all tables in schema public to app_role, platform_role;
grant usage, select on all sequences in schema public to app_role, platform_role;
grant execute on all functions in schema public to app_role, platform_role;
alter default privileges in schema public grant select, insert, update, delete on tables to app_role, platform_role;
alter default privileges in schema public grant usage, select on sequences to app_role, platform_role;

-- Catálogos de plataforma: el tenant solo lee.
do $$ declare t text; begin
  foreach t in array array['plans', 'plan_limits', 'features', 'plan_features', 'plan_channels', 'addons', 'addon_prices', 'sys_booking_rule_catalog', 'plan_rule_entitlements', 'sys_rule_templates', 'permissions']::text[] loop
    if to_regclass(t) is not null then
      execute format('revoke insert, update, delete, truncate on %I from app_role', t);
    end if;
  end loop;
end $$;

-- Tablas exclusivas de plataforma (suscripciones, facturación SaaS, medición): sin acceso para app_role.
do $$ declare t text; begin
  foreach t in array array['platform_users', 'tenant_onboarding', 'platform_sequences', 'feature_overrides', 'coupons', 'coupon_redemptions', 'subscriptions', 'subscription_items', 'subscription_changes', 'platform_invoices', 'platform_invoice_lines', 'platform_credit_notes', 'payment_methods', 'payment_attempts', 'usage_counters', 'usage_monthly', 'usage_events', 'platform_metrics_daily', 'platform_marketplace_listings', 'platform_marketplace_partnerships', 'platform_marketplace_orders', 'platform_access_passes', 'platform_showcase_agencies', 'platform_showcase_listings', 'platform_showcase_bookings', 'platform_blog_posts', 'platform_funnel_events', 'platform_site_templates', 'platform_site_template_versions', 'platform_template_submissions', 'platform_ai_credit_packs', 'platform_tracking_tags', 'platform_conversion_mappings', 'platform_conversion_dispatches', 'platform_web_analytics_daily']::text[] loop
    if to_regclass(t) is not null then
      execute format('revoke all on %I from app_role', t);
    end if;
  end loop;
end $$;

-- Append-only: ni la app ni plataforma pueden modificar/borrar (además del trigger).
do $$ declare t text; begin
  foreach t in array array['audit_events', 'crm_case_events', 'ops_incident_logs', 'channel_b2b_credit_movements', 'collab_approval_events', 'mkt_consent_events', 'fin_fx_rates', 'fin_gift_card_movements', 'ops_waiver_signatures', 'platform_funnel_events', 'fin_ai_credit_ledger']::text[] loop
    if to_regclass(t) is not null then
      execute format('revoke update, delete, truncate on %I from app_role, platform_role', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- tenants: cada tenant ve/edita solo su fila
alter table tenants enable row level security;
alter table tenants force row level security;
drop policy if exists tenant_self on tenants;
create policy tenant_self on tenants for select using (id = app_current_tenant_id());
drop policy if exists tenant_self_update on tenants;
create policy tenant_self_update on tenants for update using (id = app_current_tenant_id()) with check (id = app_current_tenant_id());
drop policy if exists platform_access on tenants;
create policy platform_access on tenants to platform_role using (true) with check (true);
revoke insert, delete, truncate on tenants from app_role;
-- El tenant solo edita su perfil. Plan, estado, prueba, suspensión, MRR, módulos, dominio, RUC y razón social
-- son de plataforma (spec 13): sin este REVOKE un tenant podía reactivarse o extender su prueba con un UPDATE.
revoke update on tenants from app_role;
grant update (commercial_name, fiscal_address, legal_rep, logo_initials, logo_path, timezone, locale,
              alt_currency, admin_email, settings, updated_by, updated_at, lock_version) on tenants to app_role;

-- ---------------------------------------------------------------- RLS por tabla con tenant_id
-- 'strict' = tenant_id = app_current_tenant_id(); 'shared' = además filas globales (tenant_id NULL) de solo lectura.
-- Plataforma (tablas sin tenant / sin RLS de tenant)

-- Fase 0 · Fundaciones
do $$ begin perform app_enable_tenant_rls('iam_sedes', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('iam_users', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('iam_mfa_factors', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('roles', 'shared'); end $$;
do $$ begin perform app_enable_tenant_rls('model_has_roles', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('model_has_permissions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('audit_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_sequences', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_idempotency_keys', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_outbox', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('iam_access_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('iam_user_invitations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_settings', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('notif_event_rules', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('notif_templates', 'shared'); end $$;
do $$ begin perform app_enable_tenant_rls('notif_messages', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('notif_reads', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_documents', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('integration_adapters', 'shared'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_scheduled_jobs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_job_runs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('integration_errors', 'strict'); end $$;

-- Fase 1 · MVP
do $$ begin perform app_enable_tenant_rls('catalog_product_types', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_categories', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_subcategories', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_destinations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_providers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_provider_contacts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_services', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_products', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_versions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_destinations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_itineraries', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_itinerary_days', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_itinerary_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_inclusions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_requirements', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_policies', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_related', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_seasons', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_promotions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_media', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_faqs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_channels', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_seasons', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_config_groups', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_config_options', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_rates', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_rate_conditions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_price_rules', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_departures', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_availability_holds', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_availability_ranges', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_pax_rules', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_catalog_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_clients', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_leads', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_lead_qualifications', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_client_contacts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_pipeline_stages', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_opportunities', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_activities', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_surveys', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_cases', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_case_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_claim_book_settings', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_holidays', 'shared'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_quotes', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_versions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_internal_approvals', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_sends', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_access_tokens', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_views', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_negotiations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('quote_approvals', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_reservations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_passengers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_reservation_services', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_inventory_holds', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_changes', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_cancel_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_cancellations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_guides', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_drivers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_vehicles', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_orders', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_order_tasks', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_supplier_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_assignments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_assignment_checkins', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_rooming_lists', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_rooming_rooms', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_rooming_guests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_vouchers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_voucher_versions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_incidents', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_incident_logs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_evidences', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_bank_accounts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_payment_methods', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_receivables', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_receivable_reminders', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_payments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_payment_applications', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_status_history', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_payables', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_payable_payouts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_commission_rules', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_commissions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_settlements', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_fx_rates', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_support_tickets', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_support_ticket_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('report_exports', 'strict'); end $$;

-- Fase 2 · Canales y campo
do $$ begin perform app_enable_tenant_rls('ops_mobile_devices', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_sync_actions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_trip_messages', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_service_cost_history', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('supplier_request_responses', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('supplier_invoices', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('supplier_rate_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_document_series', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_invoices', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_invoice_lines', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_fiscal_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_bank_statements', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_reconciliation_closures', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_bank_lines', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_period_closes', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_period_close_checks', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_b2b_price_lists', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_b2b_agencies', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_b2b_rates', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_b2b_settlement_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_b2b_credit_movements', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_b2b_credit_exceptions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('cms_contents', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('cms_content_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_ecom_orders', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_ecom_order_lines', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_ecom_passengers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_ecom_payment_attempts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_portal_access_links', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_incident_pax_acks', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_pax_feedback', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_approval_rules', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_approval_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_approval_steps', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_approval_info_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_approval_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_channel_accounts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_reply_templates', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_conversations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_messages', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_message_attachments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('collab_inbound_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_allotments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_allotment_days', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_allotment_consumptions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_allotment_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_allotment_charges', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_allotment_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_travel_doc_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_travel_doc_contacts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_travel_doc_special', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('ops_travel_doc_reminders', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_treasury_accounts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_treasury_transfers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_cash_replenishments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_cash_replenishment_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_treasury_movements', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_expense_receipts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_cash_sessions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_cash_counts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_fx_revaluations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_treasury_settings', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('sys_booking_rules', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_rule_overrides', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_addons', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_accommodation_legs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_accommodation_hotels', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_accommodation_room_types', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_payment_policies', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_pickup_points', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_reservation_web_snapshots', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_reservation_web_lodging', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('booking_reservation_web_addons', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('notif_pax_message_templates', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('notif_pax_messages', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fin_currencies', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('fx_rate_providers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_widget_config', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_widget_domains', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_web_carts', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_web_cart_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_widget_handoffs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_wishlist_items', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_web_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_product_translations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('catalog_destination_contents', 'strict'); end $$;

-- Fase 3 · SaaS y crecimiento
do $$ begin perform app_enable_tenant_rls('integration_api_keys', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('integration_webhooks', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('integration_webhook_deliveries', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('oauth_clients', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('integration_oauth_apps', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_contacts_subscribers', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_segments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_templates', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_campaigns', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_consents', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_consent_events', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_campaign_tests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_campaign_recipients', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_campaign_suppressions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_attributions', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_automations', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_automation_runs', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('mkt_automation_enrollments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_sales_teams', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_sales_team_members', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_sales_targets', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_sales_target_adjustments', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_sales_target_policies', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('integration_review_sources', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('channel_external_reviews', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_review_requests', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_own_reviews', 'strict'); end $$;
do $$ begin perform app_enable_tenant_rls('crm_own_review_log', 'strict'); end $$;
-- v2.6 · spec 19 (crecimiento comercial)
do $$ begin if to_regclass('sys_ai_requests') is not null then perform app_enable_tenant_rls('sys_ai_requests', 'strict'); end if; end $$;
do $$ begin if to_regclass('report_ai_insights') is not null then perform app_enable_tenant_rls('report_ai_insights', 'strict'); end if; end $$;
do $$ begin if to_regclass('collab_whatsapp_templates') is not null then perform app_enable_tenant_rls('collab_whatsapp_templates', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_payment_links') is not null then perform app_enable_tenant_rls('fin_payment_links', 'strict'); end if; end $$;
do $$ begin if to_regclass('mkt_recovery_flows') is not null then perform app_enable_tenant_rls('mkt_recovery_flows', 'strict'); end if; end $$;
do $$ begin if to_regclass('mkt_recovery_attempts') is not null then perform app_enable_tenant_rls('mkt_recovery_attempts', 'strict'); end if; end $$;
do $$ begin if to_regclass('catalog_import_jobs') is not null then perform app_enable_tenant_rls('catalog_import_jobs', 'strict'); end if; end $$;
do $$ begin if to_regclass('catalog_dynamic_price_rules') is not null then perform app_enable_tenant_rls('catalog_dynamic_price_rules', 'strict'); end if; end $$;
do $$ begin if to_regclass('channel_ota_connections') is not null then perform app_enable_tenant_rls('channel_ota_connections', 'strict'); end if; end $$;
do $$ begin if to_regclass('channel_ota_product_mappings') is not null then perform app_enable_tenant_rls('channel_ota_product_mappings', 'strict'); end if; end $$;
do $$ begin if to_regclass('channel_ota_bookings') is not null then perform app_enable_tenant_rls('channel_ota_bookings', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_gift_cards') is not null then perform app_enable_tenant_rls('fin_gift_cards', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_gift_card_movements') is not null then perform app_enable_tenant_rls('fin_gift_card_movements', 'strict'); end if; end $$;
do $$ begin if to_regclass('ops_waiver_templates') is not null then perform app_enable_tenant_rls('ops_waiver_templates', 'strict'); end if; end $$;
do $$ begin if to_regclass('ops_waiver_signatures') is not null then perform app_enable_tenant_rls('ops_waiver_signatures', 'strict'); end if; end $$;
do $$ begin if to_regclass('ops_checkin_passes') is not null then perform app_enable_tenant_rls('ops_checkin_passes', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_account_mappings') is not null then perform app_enable_tenant_rls('fin_account_mappings', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_accounting_exports') is not null then perform app_enable_tenant_rls('fin_accounting_exports', 'strict'); end if; end $$;
do $$ begin if to_regclass('quote_external_offers') is not null then perform app_enable_tenant_rls('quote_external_offers', 'strict'); end if; end $$;
-- v2.7 · portal corporativo (spec 20)
do $$ begin if to_regclass('crm_corporate_accounts') is not null then perform app_enable_tenant_rls('crm_corporate_accounts', 'strict'); end if; end $$;
do $$ begin if to_regclass('crm_corporate_cost_centers') is not null then perform app_enable_tenant_rls('crm_corporate_cost_centers', 'strict'); end if; end $$;
do $$ begin if to_regclass('crm_corporate_travelers') is not null then perform app_enable_tenant_rls('crm_corporate_travelers', 'strict'); end if; end $$;
do $$ begin if to_regclass('crm_corporate_portal_users') is not null then perform app_enable_tenant_rls('crm_corporate_portal_users', 'strict'); end if; end $$;
do $$ begin if to_regclass('booking_corporate_approvals') is not null then perform app_enable_tenant_rls('booking_corporate_approvals', 'strict'); end if; end $$;
do $$ begin if to_regclass('booking_cost_allocations') is not null then perform app_enable_tenant_rls('booking_cost_allocations', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_corporate_statements') is not null then perform app_enable_tenant_rls('fin_corporate_statements', 'strict'); end if; end $$;
do $$ begin if to_regclass('report_corporate_exports') is not null then perform app_enable_tenant_rls('report_corporate_exports', 'strict'); end if; end $$;
-- v2.8 · viajes por tramos (spec 21) y marca propia (spec 22)
do $$ begin if to_regclass('catalog_hotel_season_rates') is not null then perform app_enable_tenant_rls('catalog_hotel_season_rates', 'strict'); end if; end $$;
do $$ begin if to_regclass('catalog_leg_tours') is not null then perform app_enable_tenant_rls('catalog_leg_tours', 'strict'); end if; end $$;
do $$ begin if to_regclass('catalog_transport_options') is not null then perform app_enable_tenant_rls('catalog_transport_options', 'strict'); end if; end $$;
do $$ begin if to_regclass('catalog_transport_vehicles') is not null then perform app_enable_tenant_rls('catalog_transport_vehicles', 'strict'); end if; end $$;
do $$ begin if to_regclass('booking_trip_legs') is not null then perform app_enable_tenant_rls('booking_trip_legs', 'strict'); end if; end $$;
do $$ begin if to_regclass('booking_trip_items') is not null then perform app_enable_tenant_rls('booking_trip_items', 'strict'); end if; end $$;
do $$ begin if to_regclass('booking_in_trip_offers') is not null then perform app_enable_tenant_rls('booking_in_trip_offers', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_gateway_accounts') is not null then perform app_enable_tenant_rls('fin_gateway_accounts', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_payment_fees') is not null then perform app_enable_tenant_rls('fin_payment_fees', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_site_domains') is not null then perform app_enable_tenant_rls('cms_site_domains', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_seo_pages') is not null then perform app_enable_tenant_rls('cms_seo_pages', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_redirects') is not null then perform app_enable_tenant_rls('cms_redirects', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_travel_stories') is not null then perform app_enable_tenant_rls('cms_travel_stories', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_site_themes') is not null then perform app_enable_tenant_rls('cms_site_themes', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_ai_content_jobs') is not null then perform app_enable_tenant_rls('cms_ai_content_jobs', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_ai_images') is not null then perform app_enable_tenant_rls('cms_ai_images', 'strict'); end if; end $$;
do $$ begin if to_regclass('fin_ai_credit_ledger') is not null then perform app_enable_tenant_rls('fin_ai_credit_ledger', 'strict'); end if; end $$;
do $$ begin if to_regclass('mkt_tracking_tags') is not null then perform app_enable_tenant_rls('mkt_tracking_tags', 'strict'); end if; end $$;
do $$ begin if to_regclass('mkt_conversion_mappings') is not null then perform app_enable_tenant_rls('mkt_conversion_mappings', 'strict'); end if; end $$;
do $$ begin if to_regclass('mkt_conversion_dispatches') is not null then perform app_enable_tenant_rls('mkt_conversion_dispatches', 'strict'); end if; end $$;
do $$ begin if to_regclass('cms_web_analytics_daily') is not null then perform app_enable_tenant_rls('cms_web_analytics_daily', 'strict'); end if; end $$;

-- ---------------------------------------------------------------- excepciones documentadas (tablas con tenant_id SIN RLS)
-- tenant_onboarding, feature_overrides, subscriptions, coupon_redemptions, platform_invoices, payment_methods, usage_counters, usage_monthly, usage_events
-- Son tablas de plataforma con tenant_id como dato (spec 13 §3.1); app_role no tiene privilegios sobre ellas.

-- ---------------------------------------------------------------- personal_access_tokens con RLS
-- Antes quedaba sin RLS y con CRUD para app_role: desde cualquier tenant se podían leer, borrar o reasignar
-- tokens ajenos. Ahora: RLS estricta (el tenant solo ve sus tokens; los de plataforma tienen tenant_id NULL y solo
-- los ve platform_role). La búsqueda inicial (cuando aún no hay tenant) usa app_resolve_access_token().
do $$ begin perform app_enable_tenant_rls('personal_access_tokens', 'strict'); end $$;

create or replace function app_resolve_access_token(p_token_hash varchar)
returns table (token_id uuid, tenant_id uuid, tokenable_type varchar, tokenable_id uuid, abilities text,
               experience varchar, expires_at timestamptz, mfa_verified_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.tenant_id, t.tokenable_type, t.tokenable_id, t.abilities, t.experience, t.expires_at, t.mfa_verified_at
  from personal_access_tokens t
  where t.token = p_token_hash and t.tenant_id is not null
    and (t.expires_at is null or t.expires_at > now())
$$;
alter function app_resolve_access_token(varchar) owner to platform_role;
comment on function app_resolve_access_token(varchar) is 'Sanctum: hash SHA-256 del token → tenant y dueño, antes de fijar app.tenant_id. Solo tokens de tenant (los de plataforma se resuelven con la conexión de plataforma).';

-- ---------------------------------------------------------------- resolución previa al contexto de tenant
-- Funciones SECURITY DEFINER con dueño platform_role (pasa por platform_access). Devuelven lo mínimo.
create or replace function app_resolve_tenant_by_host(p_host text, p_base_domain text)
returns table (tenant_id uuid, status varchar, timezone varchar, locale varchar)
language sql stable security definer set search_path = public as $$
  select t.id, t.status, t.timezone, t.locale
  from tenants t
  where lower(t.custom_domain) = lower(p_host)
     or (lower(p_host) like '%.' || lower(p_base_domain)
         and t.subdomain = split_part(lower(p_host), '.', 1))
  limit 1
$$;
comment on function app_resolve_tenant_by_host(text, text) is 'Middleware ResolveTenant: host → tenant (subdominio o dominio propio). Antes de fijar app.tenant_id.';

do $$ begin
  if to_regclass('integration_api_keys') is not null then
    execute $f$
      create or replace function app_resolve_api_key(p_prefix varchar)
      returns table (tenant_id uuid, key_id uuid, token_hash char(64), status varchar, scopes text[], ip_allowlist cidr[], expires_at date)
      language sql stable security definer set search_path = public as $q$
        select k.tenant_id, k.id, k.token_hash, k.status, k.scopes, k.ip_allowlist, k.expires_at
        from integration_api_keys k where k.prefix = p_prefix
      $q$;
      alter function app_resolve_api_key(varchar) owner to platform_role;
      comment on function app_resolve_api_key(varchar) is 'API pública: prefijo de la key → tenant + hash (la app compara el hash en tiempo constante).';
    $f$;
  end if;
  if to_regclass('channel_widget_config') is not null then
    execute $f$
      create or replace function app_resolve_widget_key(p_public_key varchar)
      returns uuid language sql stable security definer set search_path = public as $q$
        select w.tenant_id from channel_widget_config w
        where w.public_key = p_public_key or (w.public_key_prev = p_public_key and w.prev_expires_at > now())
      $q$;
      alter function app_resolve_widget_key(varchar) owner to platform_role;
    $f$;
  end if;
  if to_regclass('collab_channel_accounts') is not null then
    execute $f$
      create or replace function app_resolve_channel_account(p_channel varchar, p_phone_number_id varchar, p_mailbox varchar)
      returns table (tenant_id uuid, account_id uuid)
      language sql stable security definer set search_path = public as $q$
        select a.tenant_id, a.id from collab_channel_accounts a
        where a.channel = p_channel
          and ((p_phone_number_id is not null and a.phone_number_id = p_phone_number_id)
            or (p_mailbox is not null and lower(a.mailbox) = lower(p_mailbox)))
        limit 1
      $q$;
      alter function app_resolve_channel_account(varchar, varchar, varchar) owner to platform_role;
      comment on function app_resolve_channel_account(varchar, varchar, varchar) is 'Webhooks entrantes (WhatsApp/email): cuenta de canal → tenant.';
    $f$;
  end if;
end $$;
alter function app_resolve_tenant_by_host(text, text) owner to platform_role;
grant select on tenants to platform_role;

-- ---------------------------------------------------------------- role_has_permissions (pivote sin tenant_id)
-- Sin RLS, un tenant podía agregar permisos a roles de otro tenant (la FK a roles no pasa por RLS).
-- Lectura: permisos de roles visibles (propios + plantillas globales). Escritura: solo roles propios.
do $$ begin
  if to_regclass('role_has_permissions') is not null then
    alter table role_has_permissions enable row level security;
    alter table role_has_permissions force row level security;
    drop policy if exists rhp_read on role_has_permissions;
    create policy rhp_read on role_has_permissions for select
      using (exists (select 1 from roles r where r.id = role_id));
    drop policy if exists rhp_insert on role_has_permissions;
    create policy rhp_insert on role_has_permissions for insert
      with check (exists (select 1 from roles r where r.id = role_id and r.tenant_id = app_current_tenant_id()));
    drop policy if exists rhp_delete on role_has_permissions;
    create policy rhp_delete on role_has_permissions for delete
      using (exists (select 1 from roles r where r.id = role_id and r.tenant_id = app_current_tenant_id()));
    revoke update on role_has_permissions from app_role;
    drop policy if exists platform_access on role_has_permissions;
    create policy platform_access on role_has_permissions to platform_role using (true) with check (true);
  end if;
end $$;

-- ---------------------------------------------------------------- FKs con tenant (referencias cruzadas entre tenants)
-- La validación de una FK NO pasa por RLS: con FKs de una sola columna, un tenant podía enlazar sus filas a
-- registros de otro tenant si conocía el UUID. Se convierten a FKs compuestas (tenant_id, col) → padre(tenant_id, id),
-- con UNIQUE (tenant_id, id) en cada padre. Idempotente: solo toca las FKs de una columna entre tablas cuyo
-- tenant_id es NOT NULL. Para padres o hijos con tenant_id NULL (filas globales) se usa un trigger.
do $$
declare
  r record; def text; uq text; n int := 0;
begin
  for r in
    select k.conname, k.conrelid::regclass::text as child, k.confrelid::regclass::text as parent,
           ca.attname as col, pa.attname as pcol, pg_get_constraintdef(k.oid) as def
    from pg_constraint k
    join pg_attribute ca on ca.attrelid = k.conrelid and ca.attnum = k.conkey[1]
    join pg_attribute pa on pa.attrelid = k.confrelid and pa.attnum = k.confkey[1]
    join pg_attribute ct on ct.attrelid = k.conrelid and ct.attname = 'tenant_id' and ct.attnotnull
    join pg_attribute pt on pt.attrelid = k.confrelid and pt.attname = 'tenant_id' and pt.attnotnull
    join pg_class cc on cc.oid = k.conrelid
    join pg_class pc on pc.oid = k.confrelid
    where k.contype = 'f' and k.connamespace = 'public'::regnamespace
      and array_length(k.conkey, 1) = 1 and ca.attname <> 'tenant_id'
      and not cc.relispartition and pc.relkind = 'r'
  loop
    uq := left('uq_tid_' || r.parent || '_' || r.pcol, 63);
    if not exists (select 1 from pg_constraint where conname = uq and conrelid = r.parent::regclass) then
      execute format('alter table %I add constraint %I unique (tenant_id, %I)', r.parent, uq, r.pcol);
    end if;
    def := regexp_replace(r.def, '^FOREIGN KEY \(' || r.col || '\) REFERENCES ([^(]+)\(' || r.pcol || '\)',
                          'FOREIGN KEY (tenant_id, ' || r.col || ') REFERENCES \1(tenant_id, ' || r.pcol || ')');
    if def = r.def then raise exception 'No se pudo reescribir la FK % de %: %', r.conname, r.child, r.def; end if;
    execute format('alter table %I drop constraint %I', r.child, r.conname);
    execute format('alter table %I add constraint %I %s', r.child, r.conname, def);
    n := n + 1;
  end loop;
  raise notice 'FKs convertidas a (tenant_id, col): %', n;
end $$;

-- Padres o hijos con filas globales (tenant_id NULL): el padre debe ser global o del mismo tenant que el hijo.
create or replace function app_check_fk_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_col text := tg_argv[0]; v_parent text := tg_argv[1]; v_pcol text := tg_argv[2];
  v_ref text; v_ptenant uuid; v_found boolean;
begin
  v_ref := to_jsonb(new) ->> v_col;
  if v_ref is null then return new; end if;
  execute format('select true, tenant_id from %I where %I::text = $1', v_parent, v_pcol) into v_found, v_ptenant using v_ref;
  if v_found and v_ptenant is not null and v_ptenant is distinct from new.tenant_id then
    raise exception 'FK entre tenants no permitida: %.% → %', tg_table_name, v_col, v_parent using errcode = '23503';
  end if;
  return new;
end $$;
alter function app_check_fk_tenant() owner to platform_role;

do $$
declare r record; trg text;
begin
  for r in
    select k.conrelid::regclass::text as child, k.confrelid::regclass::text as parent, ca.attname as col, pa.attname as pcol
    from pg_constraint k
    join pg_attribute ca on ca.attrelid = k.conrelid and ca.attnum = k.conkey[1]
    join pg_attribute pa on pa.attrelid = k.confrelid and pa.attnum = k.confkey[1]
    join pg_attribute ct on ct.attrelid = k.conrelid and ct.attname = 'tenant_id'
    join pg_attribute pt on pt.attrelid = k.confrelid and pt.attname = 'tenant_id'
    join pg_class cc on cc.oid = k.conrelid
    where k.contype = 'f' and k.connamespace = 'public'::regnamespace
      and array_length(k.conkey, 1) = 1 and ca.attname <> 'tenant_id'
      and not cc.relispartition and (not ct.attnotnull or not pt.attnotnull)
  loop
    trg := left('trg_fk_tenant_' || r.child || '_' || r.col, 63);
    execute format('drop trigger if exists %I on %I', trg, r.child);
    execute format('create trigger %I before insert or update of %I, tenant_id on %I for each row execute function app_check_fk_tenant(%L, %L, %L)',
                   trg, r.col, r.child, r.col, r.parent, r.pcol);
  end loop;
end $$;

-- ---------------------------------------------------------------- verificación: ninguna tabla con tenant_id queda sin RLS
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
  where c.relkind in ('r', 'p')
    and not c.relispartition
    and not c.relrowsecurity
    and c.relname <> all (array['tenant_onboarding', 'feature_overrides', 'subscriptions', 'coupon_redemptions', 'platform_invoices', 'payment_methods', 'usage_counters', 'usage_monthly', 'usage_events', 'platform_access_passes', 'platform_showcase_agencies', 'platform_funnel_events']::text[]);
  if missing is not null then
    raise exception 'Tablas con tenant_id sin RLS: %', missing;
  end if;
end $$;

-- ---------------------------------------------------------------- verificación: ninguna FK de una columna entre tablas de tenant
do $$
declare missing text;
begin
  select string_agg(k.conrelid::regclass::text || '.' || k.conname, ', ') into missing
  from pg_constraint k
  join pg_attribute ct on ct.attrelid = k.conrelid and ct.attname = 'tenant_id' and ct.attnotnull
  join pg_attribute pt on pt.attrelid = k.confrelid and pt.attname = 'tenant_id' and pt.attnotnull
  join pg_class cc on cc.oid = k.conrelid
  join pg_class pc on pc.oid = k.confrelid
  where k.contype = 'f' and k.connamespace = 'public'::regnamespace and array_length(k.conkey, 1) = 1
    and not cc.relispartition and pc.relkind = 'r';
  if missing is not null then raise exception 'FKs sin tenant_id: %', missing; end if;
end $$;
