<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists sys_rule_automation_requests cascade;

            create table if not exists platform_rule_requests (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null references tenants(id),
                number bigint generated always as identity,
                code varchar(20) generated always as ('PRA-' || lpad(number::text, 5, '0')) stored,
                rule_code varchar(60) not null,
                rule_name varchar(160) not null,
                expected text not null,
                trigger_when text not null,
                example text not null,
                status varchar(20) not null default 'enviado' check (status in ('enviado', 'en_evaluacion', 'rechazado', 'publicado')),
                decision_reason text,
                linked_rule_code varchar(60),
                requested_by uuid,
                requested_by_name varchar(160) not null,
                decided_by uuid,
                decided_by_name varchar(160),
                decided_at timestamptz,
                lock_version integer not null default 1,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_platform_rule_requests primary key (id),
                constraint uq_platform_rule_requests_code unique (code),
                constraint ck_platform_rule_requests_1 check (status <> 'rechazado' or decision_reason is not null),
                constraint ck_platform_rule_requests_2 check (status <> 'publicado' or linked_rule_code is not null)
            );

            create unique index if not exists uq_platform_rule_requests_open on platform_rule_requests (tenant_id, rule_code) where status in ('enviado', 'en_evaluacion');
            create index if not exists ix_platform_rule_requests_status on platform_rule_requests (status, created_at desc);
            create index if not exists ix_platform_rule_requests_tenant_rule on platform_rule_requests (tenant_id, rule_code, created_at desc);
            create trigger trg_platform_rule_requests_updated_at before update on platform_rule_requests for each row execute function app_set_updated_at();

            revoke all on platform_rule_requests from app_role;
            grant select, insert, update on platform_rule_requests to platform_role;

            comment on table platform_rule_requests is '[G5-27] Pedidos de las agencias para automatizar una regla personalizada. La plataforma los rechaza con motivo, los evalúa o los publica enlazándolos a una regla estándar del catálogo. Solo la usa platform_role (política platform_access); la agencia lee los suyos con filtro por tenant_id.';
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists platform_rule_requests cascade');
    }
};
