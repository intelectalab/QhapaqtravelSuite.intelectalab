<?php

use App\Domain\Iam\Models\AccessToken;
use App\Http\Middleware\AssignCorrelationId;
use Illuminate\Database\QueryException;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route as Router;
use Spatie\Permission\PermissionRegistrar;

dataset('accesos_prohibidos', [
    'T-14 Manager edita políticas' => ['U02', 'PATCH', '/api/v1/settings/policies', 'admin.settings.manage'],
    'T-14 Ventas lista usuarios' => ['U03', 'GET', '/api/v1/iam/users', 'admin.users.manage'],
    'Manager ve suscripción' => ['U02', 'GET', '/api/v1/billing/subscription', 'admin.billing.manage'],
    'Manager lista API keys' => ['U02', 'GET', '/api/v1/integrations/api-keys', 'admin.api.manage'],
    'Ventas en marketing' => ['U03', 'GET', '/api/v1/marketing/campaigns', 'marketing.campaigns.manage'],
    'Operaciones en metas' => ['U05', 'GET', '/api/v1/crm/sales-targets', 'crm.targets.view'],
    'Finanzas en metas' => ['U07', 'GET', '/api/v1/crm/sales-targets', 'crm.targets.view'],
    'Operaciones edita reglas' => ['U05', 'PATCH', '/api/v1/admin/booking-rules/R-LODGING', 'admin.settings.manage'],
    'Manager rota clave del widget' => ['U02', 'POST', '/api/v1/channels/widget/rotate-key', 'admin.api.manage'],
    'Ventas cancela reserva' => ['U04', 'POST', '/api/v1/reservations/RES-2026-000350/cancel', 'reservations.cancel'],
    'Operaciones cancela reserva' => ['U05', 'POST', '/api/v1/reservations/RES-2026-000350/cancel', 'reservations.cancel'],
    'T-24 Ventas pide reporte de finanzas' => ['U03', 'GET', '/api/v1/reports/finanzas', 'finance.receivables'],
    'T-02 Ventas en órdenes operativas' => ['U03', 'GET', '/api/v1/ops/orders', 'operations.view'],
    'T-02 Finanzas en órdenes operativas' => ['U07', 'GET', '/api/v1/ops/orders', 'operations.view'],
    'T-02 Contabilidad en órdenes operativas' => ['U08', 'GET', '/api/v1/ops/orders', 'operations.view'],
]);

const EXTERNAL_EXPERIENCES = ['api/v1/b2b/', 'api/v1/portal/', 'api/v1/supplier/', 'api/v1/mobile/', 'api/v1/platform/', 'api/v1/public/'];

const SEED_ROLES = ['U01' => 'tenant_admin', 'U02' => 'manager', 'U03' => 'sales', 'U05' => 'operations', 'U07' => 'finance', 'U08' => 'accounting'];

function rolePermissionMatrix(): array
{
    $rows = array_map('str_getcsv', file(base_path('../docs/kit/referencia/PERMISOS-ROL.csv'), FILE_IGNORE_NEW_LINES));
    $header = array_shift($rows);

    return collect($rows)->mapWithKeys(fn (array $row) => [$row[0] => array_combine($header, $row)])->all();
}

it('responde 403 con el formato estándar y los permisos requeridos', function (string $user, string $method, string $uri, string $permission) {
    requireRoute($method, $uri);
    actingAsSeed($user);

    $response = $this->json($method, $uri, [], critical(0));

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain($permission);
})->with('accesos_prohibidos');

it('X-05: cada rol semilla recibe 403 exactamente donde PERMISOS-ROL.csv no le da el permiso', function (string $user, string $role) {
    $matrix = rolePermissionMatrix();
    actingAsSeed($user);
    $mismatches = [];

    $routes = collect(Router::getRoutes()->getRoutes())
        ->filter(fn (Route $route) => in_array('GET', $route->methods(), true) && str_starts_with($route->uri(), 'api/v1/') && ! str_contains($route->uri(), '{') && collect(EXTERNAL_EXPERIENCES)->every(fn (string $prefix) => ! str_starts_with($route->uri(), $prefix)))
        ->map(fn (Route $route) => [$route->uri(), collect($route->gatherMiddleware())->filter(fn ($m) => is_string($m) && str_starts_with($m, 'permission:'))->map(fn (string $m) => explode('|', substr($m, 11)))->values()->all()])
        ->filter(fn (array $route) => $route[1] !== [] && collect($route[1])->flatten()->every(fn (string $p) => isset($matrix[$p])));

    foreach ($routes as [$uri, $groups]) {
        $allowed = collect($groups)->every(fn (array $anyOf) => collect($anyOf)->contains(fn (string $p) => $matrix[$p][$role] === '1'));
        $status = $this->getJson('/'.$uri)->status();

        if ($allowed === ($status === 403)) {
            $mismatches[] = sprintf('%s %s → %d (esperado %s)', $role, $uri, $status, $allowed ? 'acceso' : '403');
        }
    }

    expect($mismatches)->toBe([]);
})->with(collect(SEED_ROLES)->map(fn ($role, $user) => [$user, $role])->all());

it('X-10 / T-14: el Tenant Admin no entra a la consola de plataforma', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/platform/metrics'))->toBeApiError(403);
});

it('X-10 / T-14: el Super Admin no opera datos del tenant', function () {
    $platform = platformUser();
    $plain = withinTenant(tenantA(), function () use ($platform) {
        $token = AccessToken::on('pgsql_platform')->forceCreate([
            'tokenable_type' => $platform->getMorphClass(),
            'tokenable_id' => $platform->getKey(),
            'name' => 'pest',
            'token' => hash('sha256', $secret = 'pest-platform-'.bin2hex(random_bytes(16))),
            'abilities' => ['*'],
            'experience' => 'platform',
            'expires_at' => now()->addHour(),
            'mfa_verified_at' => now(),
        ]);

        return $token->getKey().'|'.$secret;
    });
    useToken($plain);

    $this->getJson('/api/v1/platform/me')->assertOk();
    $this->getJson('/api/v1/crm/leads')->assertForbidden();
    $this->getJson('/api/v1/quotes')->assertForbidden();
});

it('el entitlement es independiente del rol: sin la función en el plan responde 403 FEATURE_NOT_IN_PLAN', function () {})->todo('Fase B: falta ChangeTenantPlan y GET /integrations/api-keys; además el cambio de plan corre por la conexión de plataforma y la API lee por la de la app (ver informe).');

it('T-25 / REP-BR-03: Contabilidad recibe la variante contable sin costos ni márgenes', function () {
    requireRoute('GET', '/api/v1/reports/finanzas');
    actingAsSeed('U08');

    $data = $this->getJson('/api/v1/reports/finanzas?period=set')->assertOk()->json('data');

    foreach (['"cost"', '"profit"', '"margin"'] as $hidden) {
        expect(json_encode($data))->not->toContain($hidden);
    }
});

it('X-16: todo 403 queda auditado como acceso_denegado con el mismo correlation_id de la respuesta', function () {
    $user = actingAsSeed('U03');

    $response = $this->getJson('/api/v1/iam/users')->assertForbidden();
    $correlation = $response->headers->get(AssignCorrelationId::HEADER);

    expect($correlation)->not->toBeEmpty()
        ->and($response->json('correlation_id'))->toBe($correlation)
        ->and(auditExists(['action' => 'acceso_denegado', 'actor_id' => $user->getKey(), 'correlation_id' => $correlation]))->toBeTrue();
});

it('X-16: la conexión de la app no puede modificar ni borrar audit_events', function (string $statement) {
    $attempt = fn () => withinTenant(tenantA(), fn () => DB::statement($statement));

    expect($attempt)->toThrow(QueryException::class);
})->with([
    'update' => "update audit_events set action = 'manipulado'",
    'delete' => 'delete from audit_events',
]);

it('T-13: un permiso otorgado se aplica en la siguiente solicitud sin volver a iniciar sesión', function () {
    $user = actingAsSeed('U03');
    $this->getJson('/api/v1/marketing/campaigns')->assertForbidden();

    withinTenant(tenantA(), fn () => $user->givePermissionTo('marketing.campaigns.manage'));
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->getJson('/api/v1/marketing/campaigns')->assertOk();
});

it('SEC-BR-05: los roles externos no entran a las rutas del back-office', function (string $user) {
    actingAsSeed($user);

    expect($this->getJson('/api/v1/quotes'))->toBeApiError(403, 'SEC-BR-05');
    expect($this->getJson('/api/v1/crm/leads'))->toBeApiError(403, 'SEC-BR-05');
})->with(['cliente' => 'U14', 'agencia B2B' => 'U13', 'proveedor' => 'U17', 'guía' => 'U09', 'conductor' => 'U11']);
