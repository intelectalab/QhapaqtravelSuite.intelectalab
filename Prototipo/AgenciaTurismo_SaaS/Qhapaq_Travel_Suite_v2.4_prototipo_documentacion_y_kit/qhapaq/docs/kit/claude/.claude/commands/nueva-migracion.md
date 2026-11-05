---
description: Crea la migración de Laravel de una tabla copiándola del esquema validado
argument-hint: <nombre_de_tabla, ej. booking_reservations>
---
Crea la migración para la tabla `$ARGUMENTS`.

1. Localiza el `CREATE TABLE $ARGUMENTS` en `docs/kit/database/*.sql` y su política en `docs/kit/database/90_rls.sql`.
2. Escribe la migración en `backend/database/migrations/` usando `DB::statement()` con el SQL exacto (tipos, CHECK, índices parciales, FKs). No lo traduzcas a Schema Builder si pierde CHECK, índices parciales o tipos de PostgreSQL.
3. En la misma migración: `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` y la política de tenant, igual que en `90_rls.sql`.
4. Crea el modelo Eloquent con `BelongsToTenant` (si tiene `tenant_id`), `HasUuids` (UUID v7), casts de dinero y fechas, y enum PHP para cada columna de estado con valores idénticos al CHECK.
5. Crea su factory con datos coherentes con `docs/kit/seeds/`.
6. Prueba Pest: la migración corre en limpio, un tenant no ve filas de otro (RLS) y los CHECK rechazan estados inválidos.
7. Ejecuta `php artisan migrate:fresh` y `make test`.
