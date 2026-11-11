-- Roles de conexión (solo entorno local). En producción, contraseñas desde el gestor de secretos.
-- app_role y platform_role (NOLOGIN) los crea database/90_rls.sql; aquí se crean primero para poder asignarlos.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_role') then create role app_role nologin nobypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'platform_role') then create role platform_role nologin nobypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'kipucontrol_app') then
    create role kipucontrol_app login password 'app_local_only' nobypassrls in role app_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'kipucontrol_platform') then
    create role kipucontrol_platform login password 'platform_local_only' nobypassrls in role platform_role; end if;
end $$;
grant connect on database kipucontrol to kipucontrol_app, kipucontrol_platform;
create database kipucontrol_test owner kipucontrol_owner;
grant connect on database kipucontrol_test to kipucontrol_app, kipucontrol_platform;
