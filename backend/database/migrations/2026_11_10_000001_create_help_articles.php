<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table help_articles (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid default app_current_tenant_id() references tenants(id),
                slug varchar(80) not null,
                audience varchar(12) not null default 'agency' check (audience in ('agency', 'platform')),
                module varchar(60) not null,
                screen varchar(120) not null check (screen ~ '^/[a-z0-9/_-]*$'),
                title varchar(160) not null,
                summary varchar(600) not null,
                steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
                faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array'),
                keywords jsonb not null default '[]'::jsonb check (jsonb_typeof(keywords) = 'array'),
                roles jsonb not null default '[]'::jsonb check (jsonb_typeof(roles) = 'array'),
                sort_order integer not null default 0,
                status varchar(12) not null default 'published' check (status in ('published', 'archived')),
                created_by uuid,
                updated_by uuid,
                lock_version integer not null default 0,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_help_articles primary key (id),
                constraint ck_help_articles_audience check (tenant_id is null or audience = 'agency')
            );

            create unique index uq_help_articles_global_slug on help_articles (slug) where tenant_id is null;
            create unique index uq_help_articles_tenant_slug on help_articles (tenant_id, slug) where tenant_id is not null;
            create index ix_help_articles_tenant_id on help_articles (tenant_id);
            create index ix_help_articles_audience_screen on help_articles (audience, screen);

            create trigger trg_help_articles_updated_at before update on help_articles for each row execute function app_set_updated_at();
            create trigger trg_help_articles_lock_version before update on help_articles for each row execute function app_bump_lock_version();

            select app_enable_tenant_rls('help_articles', 'shared');

            comment on table help_articles is 'Artículos de autoayuda por pantalla. tenant_id nulo = contenido de Qhapaq para todas las agencias; con tenant_id = artículo propio de la agencia o su versión de uno de Qhapaq (mismo slug).';
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists help_articles cascade');
    }
};
