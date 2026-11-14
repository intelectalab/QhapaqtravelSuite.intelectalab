<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table if not exists catalog_rate_prices (
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                id uuid not null default app_uuid_v7(),
                rate_id uuid not null references catalog_rates(id) on delete cascade,
                currency char(3) not null,
                price numeric(14, 2) not null check (price > 0),
                created_by uuid references iam_users(id),
                updated_by uuid references iam_users(id),
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_catalog_rate_prices primary key (id)
            );

            create unique index if not exists uq_catalog_rate_prices_rate_currency on catalog_rate_prices (tenant_id, rate_id, currency);
            create index if not exists ix_catalog_rate_prices_rate on catalog_rate_prices (rate_id);
            create index if not exists ix_catalog_rate_prices_created_by on catalog_rate_prices (created_by);
            create index if not exists ix_catalog_rate_prices_updated_by on catalog_rate_prices (updated_by);
            select app_enable_tenant_rls('catalog_rate_prices');

            comment on table catalog_rate_prices is '[G7-11/15] Precio propio de una tarifa en otra moneda de cobro. Solo se usa con el ajuste «Cobrar en varias monedas» encendido: si el cliente del sitio elige esa moneda, se cobra este precio en lugar de convertir el principal.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared('drop table if exists catalog_rate_prices;');
    }
};
