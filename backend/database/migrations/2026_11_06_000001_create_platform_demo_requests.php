<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table platform_demo_requests (
                id uuid not null default app_uuid_v7(),
                number bigint generated always as identity,
                code varchar(20) generated always as ('SOL-' || lpad(number::text, 5, '0')) stored,
                kind varchar(20) not null check (kind in ('demo', 'trial')),
                plan_id uuid references plans(id),
                billing_cycle varchar(10) check (billing_cycle in ('month', 'year')),
                full_name varchar(150) not null,
                email varchar(190) not null,
                phone varchar(30),
                company varchar(150) not null,
                business_type varchar(40) not null,
                city varchar(80),
                team_size varchar(20) not null check (team_size in ('1-5', '6-15', '16-50', '51+')),
                message text,
                status varchar(20) not null default 'nueva' check (status in ('nueva', 'contactada', 'convertida', 'descartada')),
                source varchar(40) not null default 'sitio_software',
                ip inet,
                user_agent varchar(250),
                consent_at timestamptz not null,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_platform_demo_requests primary key (id),
                constraint uq_platform_demo_requests_code unique (code)
            );

            create index ix_platform_demo_requests_status_created on platform_demo_requests (status, created_at desc);
            create index ix_platform_demo_requests_email on platform_demo_requests (lower(email));
            create index ix_platform_demo_requests_plan_id on platform_demo_requests (plan_id);

            create trigger trg_platform_demo_requests_updated_at before update on platform_demo_requests for each row execute function app_set_updated_at();

            alter table platform_demo_requests disable row level security;
            revoke all on platform_demo_requests from app_role;
            grant select, insert, update on platform_demo_requests to platform_role;
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists platform_demo_requests cascade');
    }
};
