<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table cms_template_purchases (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                template_id uuid not null references platform_site_templates(id),
                source varchar(10) not null check (source in ('compra', 'cortesia')),
                price numeric(12,2) not null check (price >= 0),
                currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
                invoice_id uuid references platform_invoices(id),
                purchased_by uuid,
                purchased_by_name varchar(160) not null,
                purchased_at timestamptz not null default now(),
                created_at timestamptz not null default now(),
                constraint pk_cms_template_purchases primary key (id),
                constraint uq_cms_template_purchases_tenant_template unique (tenant_id, template_id),
                constraint ck_cms_template_purchases_1 check (source = 'cortesia' or price > 0)
            );

            create index ix_cms_template_purchases_template_id on cms_template_purchases (template_id);
            create index ix_cms_template_purchases_invoice_id on cms_template_purchases (invoice_id);
            select app_enable_tenant_rls('cms_template_purchases');

            comment on table cms_template_purchases is '[Spec 23 TPL-04, TPL-07] Plantillas premium compradas por la agencia (pago único) o asignadas como cortesía por la plataforma.';
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists cms_template_purchases cascade');
    }
};
