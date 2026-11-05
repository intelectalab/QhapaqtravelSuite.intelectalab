<?php

/*
| RBAC 403 (esp. 00 §6 formato de error y §7 matriz; 09 T-14; 13 §10.10; 14 §10.2; 17 §10.2; 18 RVW-11).
| Regla: permiso por endpoint (spatie, teams = tenant) + Policy. El frontend nunca es autoridad.
| Plantilla: al crear un endpoint, agregar su fila al dataset con el rol que NO debe acceder.
*/

use Illuminate\Support\Facades\DB;

/** [usuario semilla, método, ruta, permiso requerido esperado en `required_permissions`] */
dataset('accesos_prohibidos', [
    'Manager edita políticas' => ['U02', 'PATCH', '/api/v1/settings/policies', 'admin.settings.manage'],
    'Ventas lista usuarios' => ['U03', 'GET', '/api/v1/iam/users', 'admin.users.manage'],
    'Manager ve suscripción' => ['U02', 'GET', '/api/v1/billing/subscription', 'admin.billing.manage'],
    'Manager lista API keys' => ['U02', 'GET', '/api/v1/integrations/api-keys', 'admin.api.manage'],
    'Ventas en marketing' => ['U03', 'GET', '/api/v1/marketing/campaigns', 'marketing.campaigns.manage'],
    'Operaciones en metas' => ['U05', 'GET', '/api/v1/crm/sales-targets', 'crm.targets.view'],
    'Finanzas en metas' => ['U07', 'GET', '/api/v1/crm/sales-targets', 'crm.targets.view'],
    'Operaciones edita reglas' => ['U05', 'PATCH', '/api/v1/admin/booking-rules/R-LODGING', 'admin.settings.manage'],
    'Manager rota clave del widget' => ['U02', 'POST', '/api/v1/channels/widget/rotate-key', 'admin.api.manage'],
    'Ventas cancela reserva' => ['U04', 'POST', '/api/v1/reservations/{RES-2026-000350}/cancel', 'reservations.cancel'],
    'Operaciones cancela reserva' => ['U05', 'POST', '/api/v1/reservations/{RES-2026-000350}/cancel', 'reservations.cancel'],
    'Ventas pide reporte de finanzas' => ['U03', 'GET', '/api/v1/reports/finanzas', 'finance.receivables'], // 09 T-24 (REP-BR-01)
]);

it('responde 403 con el formato estándar y los permisos requeridos', function (string $user, string $method, string $uri, string $perm) {
    actingAsSeed($user);
    // Placeholders {RES-…} → id real (las rutas de reservas usan uuid)
    $uri = preg_replace_callback('/\{(RES-[0-9-]+)\}/', fn ($m) => idOf(\App\Domain\Bookings\Models\Reservation::class, $m[1]), $uri);

    $res = $this->json($method, $uri, [], critical(lockVersion: 0));

    expect($res)->toBeApiError(403);
    expect($res->json('required_permissions'))->toContain($perm);
})->with('accesos_prohibidos');

it('el Tenant Admin no entra a la consola de plataforma y el Super Admin no opera datos del tenant', function () {
    actingAsSeed('U01');
    expect($this->getJson('/api/v1/platform/metrics'))->toBeApiError(403);

    // Super Admin vive en `platform_users` con guard `platform` (F0-14)
    $sa = \App\Domain\Platform\Models\PlatformUser::query()->where('email', 'ops@qhapaq.cloud')->firstOrFail();
    $this->actingAs($sa, 'platform');
    $this->getJson('/api/v1/crm/leads')->assertStatus(403);
    $this->getJson('/api/v1/billing/subscription')->assertStatus(403);
});

it('el entitlement es independiente del rol: sin feature en el plan → 403 FEATURE_NOT_IN_PLAN', function () {
    actingAsSeed('U01'); // tiene admin.api.manage
    // Plantilla: bajar el tenant a Starter (api_access = off) con el servicio de plataforma
    app(\App\Domain\Platform\Actions\ChangeTenantPlan::class)->handle(tenantA(), 'starter', effective: 'immediate', force: true);

    expect($this->getJson('/api/v1/integrations/api-keys'))->toBeApiError(403, 'FEATURE_NOT_IN_PLAN');
});

it('Contabilidad recibe la variante contable sin costos ni márgenes (09 T-25, REP-BR-03)', function () {
    actingAsSeed('U08');
    $data = $this->getJson('/api/v1/reports/finanzas?period=set')->assertOk()->json('data');

    expect(json_encode($data))->not->toContain('"cost"')->not->toContain('"profit"')->not->toContain('"margin"');
});

it('todo 403 queda auditado como acceso_denegado', function () {
    actingAsSeed('U03');
    $this->getJson('/api/v1/iam/users')->assertForbidden();

    $ok = withinTenant(tenantA(), fn () => DB::table('audit_events')
        ->where('action', 'acceso_denegado')
        ->where('actor_id', seedUser('U03')->id)
        ->exists());
    expect($ok)->toBeTrue();
});

it('un permiso otorgado se aplica en la siguiente solicitud sin re-login (09 T-13)', function () {
    $u = actingAsSeed('U03');
    $this->getJson('/api/v1/marketing/campaigns')->assertForbidden();

    withinTenant(tenantA(), fn () => $u->givePermissionTo('marketing.campaigns.manage'));
    app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

    $this->getJson('/api/v1/marketing/campaigns')->assertOk();
});
