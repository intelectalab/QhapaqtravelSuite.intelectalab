-- Roles de conexión (solo entorno local). En producción, contraseñas desde el gestor de secretos.
-- app_role y platform_role (NOLOGIN) los crea database/90_rls.sql; aquí se crean primero para poder asignarlos.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_role') then create role app_role nologin nobypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'platform_role') then create role platform_role nologin nobypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'qhapaq_app') then
    create role qhapaq_app login password 'app_local_only' nobypassrls in role app_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'qhapaq_platform') then
    create role qhapaq_platform login password 'platform_local_only' nobypassrls in role platform_role; end if;
end $$;
grant connect on database qhapaq to qhapaq_app, qhapaq_platform;
create database qhapaq_test owner qhapaq_owner;
grant connect on database qhapaq_test to qhapaq_app, qhapaq_platform;
