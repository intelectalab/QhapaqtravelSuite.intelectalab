<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            revoke update on tenants from app_role;
            grant update (commercial_name, fiscal_address, legal_rep, logo_initials, logo_path, timezone, locale,
                          alt_currency, admin_email, settings, updated_by, updated_at, lock_version) on tenants to app_role;

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
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            grant update on tenants to app_role;
            do $$ begin
              if to_regclass('role_has_permissions') is not null then
                drop policy if exists rhp_read on role_has_permissions;
                drop policy if exists rhp_insert on role_has_permissions;
                drop policy if exists rhp_delete on role_has_permissions;
                drop policy if exists platform_access on role_has_permissions;
                alter table role_has_permissions no force row level security;
                alter table role_has_permissions disable row level security;
                grant update on role_has_permissions to app_role;
              end if;
            end $$;
            SQL);
    }
};
