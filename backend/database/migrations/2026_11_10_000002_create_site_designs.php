<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table site_designs (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
                published jsonb check (published is null or jsonb_typeof(published) = 'object'),
                published_version integer not null default 0,
                published_at timestamptz,
                published_by uuid,
                draft_updated_at timestamptz,
                draft_updated_by uuid,
                lock_version integer not null default 0,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_site_designs primary key (id),
                constraint uq_site_designs_tenant unique (tenant_id)
            );

            create trigger trg_site_designs_updated_at before update on site_designs for each row execute function app_set_updated_at();
            create trigger trg_site_designs_lock_version before update on site_designs for each row execute function app_bump_lock_version();
            select app_enable_tenant_rls('site_designs');

            comment on table site_designs is 'Personalización del sitio público de cada agencia. draft = lo que se edita y se ve en la vista previa; published = lo que ven los visitantes.';

            create table site_design_versions (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                version integer not null check (version > 0),
                design jsonb not null check (jsonb_typeof(design) = 'object'),
                note varchar(200),
                published_by uuid,
                published_by_name varchar(160),
                created_at timestamptz not null default now(),
                constraint pk_site_design_versions primary key (id),
                constraint uq_site_design_versions unique (tenant_id, version)
            );

            create index ix_site_design_versions_tenant on site_design_versions (tenant_id, version desc);
            select app_enable_tenant_rls('site_design_versions');

            comment on table site_design_versions is 'Cada publicación del sitio queda guardada para poder volver a ella.';

            create table site_design_images (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                file_name varchar(200) not null,
                mime varchar(40) not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
                size_bytes integer not null check (size_bytes > 0),
                width integer,
                height integer,
                storage_disk varchar(40) not null,
                storage_path varchar(300) not null,
                uploaded_by uuid,
                created_at timestamptz not null default now(),
                deleted_at timestamptz,
                constraint pk_site_design_images primary key (id)
            );

            create index ix_site_design_images_tenant on site_design_images (tenant_id, created_at desc);
            select app_enable_tenant_rls('site_design_images');

            comment on table site_design_images is 'Imágenes que la agencia sube para la portada y los banners de su sitio.';
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists site_design_images cascade');
        DB::statement('drop table if exists site_design_versions cascade');
        DB::statement('drop table if exists site_designs cascade');
    }
};
