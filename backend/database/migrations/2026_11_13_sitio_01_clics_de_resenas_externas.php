<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table if not exists crm_review_link_clicks (
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                id uuid not null default app_uuid_v7(),
                request_id uuid not null references crm_review_requests(id),
                target varchar(15) not null check (target in ('google', 'tripadvisor')),
                clicked_at timestamptz not null default now(),
                created_at timestamptz not null default now(),
                constraint pk_crm_review_link_clicks primary key (id)
            );

            create index if not exists ix_crm_review_link_clicks_request on crm_review_link_clicks (tenant_id, request_id, target);
            create index if not exists ix_crm_review_link_clicks_request_id on crm_review_link_clicks (request_id);
            select app_enable_tenant_rls('crm_review_link_clicks');

            comment on table crm_review_link_clicks is '[G7-27] Clic del viajero en «Opina también en Google / en TripAdvisor» de la invitación postviaje. Se registra con una redirección propia; no se sabe si publicó la reseña, solo el clic.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared('drop table if exists crm_review_link_clicks;');
    }
};
