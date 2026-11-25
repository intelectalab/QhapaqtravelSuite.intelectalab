<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table if not exists cms_web_analytics_hits (
                id bigint generated always as identity,
                tenant_id uuid not null default app_current_tenant_id() references tenants (id),
                occurred_at timestamptz not null default now(),
                day date not null,
                path varchar(300) not null,
                source varchar(80) not null default '(directo)',
                medium varchar(40) not null default '(ninguno)',
                campaign varchar(120) not null default '',
                device varchar(12) not null,
                country char(2) not null default 'ZZ',
                visits integer not null default 0,
                visitors integer not null default 0,
                pageviews integer not null default 0,
                bounces integer not null default 0,
                engaged_seconds bigint not null default 0,
                conversions integer not null default 0,
                revenue numeric(14,2) not null default 0,
                constraint pk_cms_web_analytics_hits primary key (id)
            );

            create index if not exists ix_cms_web_analytics_hits_tenant_id_day on cms_web_analytics_hits (tenant_id, day);

            select app_enable_tenant_rls('cms_web_analytics_hits', 'strict');

            comment on table cms_web_analytics_hits is 'VIS-04: cada visita, página vista, rebote que se descuenta, tiempo o conversión del sitio de la agencia, como un movimiento sin IP ni identificador del visitante. El job de visitas los suma en cms_web_analytics_daily cada hora para el día en curso y a las 03:00 para el día anterior; después se depuran.';

            create table if not exists platform_web_analytics_hits (
                id bigint generated always as identity,
                occurred_at timestamptz not null default now(),
                day date not null,
                site varchar(10) not null,
                agency_id uuid,
                path varchar(300) not null,
                source varchar(80) not null default '(directo)',
                medium varchar(40) not null default '(ninguno)',
                campaign varchar(120) not null default '',
                device varchar(12) not null,
                country char(2) not null default 'ZZ',
                visits integer not null default 0,
                visitors integer not null default 0,
                pageviews integer not null default 0,
                bounces integer not null default 0,
                engaged_seconds bigint not null default 0,
                conversions integer not null default 0,
                revenue numeric(14,2) not null default 0,
                constraint pk_platform_web_analytics_hits primary key (id)
            );

            create index if not exists ix_platform_web_analytics_hits_day on platform_web_analytics_hits (day);

            alter table platform_web_analytics_hits disable row level security;
            revoke all on platform_web_analytics_hits from app_role;
            grant select, insert, delete on platform_web_analytics_hits to platform_role;

            comment on table platform_web_analytics_hits is 'VIS-04: movimientos de visitas de la vitrina y el blog, sin IP ni identificador del visitante. El job de visitas de la plataforma los suma en platform_web_analytics_daily cada hora para el día en curso y a las 03:00 para el día anterior.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists platform_web_analytics_hits;
            drop table if exists cms_web_analytics_hits;
            SQL);
    }
};
