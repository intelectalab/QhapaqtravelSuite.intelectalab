<?php

use App\Domain\Admin\Support\ApiDirectory;
use App\Domain\Admin\Support\ApiKeyEndpoints;
use App\Domain\Admin\Support\ApiKeyRoutes;
use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

it('G6-02: lo que crea la llave corre los procesos de cola sin romper por el autor', function () {
    $key = t16llKey(['crm:write', 'quotes:write', 'reservations:write']);

    t16llCall('POST', '/api/v1/crm/leads', $key['token'], t16llLeadBody())->assertCreated();
    t16llCall('POST', '/api/v1/crm/clients', $key['token'], t16llClientBody())->assertCreated();
    t16llCall('POST', '/api/v1/quotes', $key['token'], t16llQuoteBody())->assertCreated();
    t16llCall('POST', '/api/v1/reservations', $key['token'], t16llReservationBody(), critical())->assertCreated();
});

function t16llKey(array $scopes, array $overrides = [], ?Tenant $tenant = null): array
{
    $token = 'qts_live_'.Str::random(32);
    $id = (string) Str::uuid7();
    $code = 'KEY-'.Str::upper(Str::random(5));
    DB::connection('pgsql_platform')->table('integration_api_keys')->insert([
        'id' => $id,
        'tenant_id' => ($tenant ?? tenantA())->getKey(),
        'code' => $code,
        'name' => 'Motor de reservas',
        'environment' => 'live',
        'prefix' => substr($token, 0, 13),
        'last4' => substr($token, -4),
        'token_hash' => hash('sha256', $token),
        'scopes' => '{'.implode(',', array_map(fn (string $scope): string => '"'.$scope.'"', $scopes)).'}',
        'status' => 'active',
        ...$overrides,
    ]);
    RateLimiter::clear("api-key:{$id}");

    return ['token' => $token, 'id' => $id, 'code' => $code];
}

function t16llAudited(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function t16llAllScopes(): array
{
    return array_keys(ApiDirectory::SCOPES);
}

function t16llCall(string $method, string $uri, string $token, array $body = [], array $headers = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $body, ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json', ...$headers]);
}

function t16llValue(string $table, string $column = 'code'): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table($table)->orderBy('created_at')->value($column));
}

function t16llLeadBody(array $extra = []): array
{
    return [
        'name' => 'Contacto por API '.Str::random(4),
        'email' => 'api.'.Str::lower(Str::random(10)).'@prueba.pe',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'paquete',
        'destination' => 'Cusco',
        'travel_date' => '2026-10-20',
        'pax' => 2,
        ...$extra,
    ];
}

function t16llClientBody(array $extra = []): array
{
    return [
        'kind' => 'persona',
        'name' => 'Cliente por API '.Str::random(4),
        'doc_type' => 'DNI',
        'doc_number' => (string) random_int(40000000, 79999999),
        'email' => 'cliente.'.Str::lower(Str::random(10)).'@prueba.pe',
        'city' => 'Arequipa',
        'confirm_duplicate' => true,
        ...$extra,
    ];
}

function t16llClientEdit(string $code, array $extra = []): array
{
    $row = rowOf('crm_clients', $code);

    return [
        'kind' => $row->kind,
        'name' => $row->name,
        'doc_type' => $row->doc_type,
        'doc_number' => $row->doc_number,
        'email' => $row->email,
        'phone' => $row->phone,
        'country' => $row->country,
        'city' => $row->city,
        'segment' => $row->segment_code,
        'tags' => str_replace('"', '', trim((string) $row->tags, '{}')),
        ...$extra,
    ];
}

function t16llQuoteBody(array $extra = []): array
{
    return [
        'client_code' => 'CLI-0012',
        'title' => 'Machu Picchu en el día',
        'currency' => 'USD',
        'travel_from' => '2026-12-10',
        'travel_to' => '2026-12-12',
        'pax_adt' => 2,
        'items' => [['product_code' => 'CUS-MAPI-FD', 'date' => '2026-12-10', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto']],
        ...$extra,
    ];
}

function t16llReservationBody(array $extra = []): array
{
    return [
        'client_id' => 'CLI-0003',
        'product_id' => 'CUS-HUM-FD',
        'departure_id' => departureRow('SAL-0403')->id,
        'adt' => 2,
        'chd' => 0,
        'inf' => 0,
        'confirm' => true,
        ...$extra,
    ];
}

function t16llHookBody(array $extra = []): array
{
    return ['url' => 'https://93.184.216.34/kipucontrol/hooks', 'description' => 'Sincroniza reservas con el ERP', 'events' => ['reservation.confirmed'], ...$extra];
}

function t16llOps(): array
{
    return [
        'listCrmLeads' => ['GET', '/api/v1/crm/leads', 'crm:read'],
        'createCrmLeads' => ['POST', '/api/v1/crm/leads', 'crm:write'],
        'showCrmLeads' => ['GET', '/api/v1/crm/leads/{lead}', 'crm:read'],
        'updateCrmLeads' => ['PATCH', '/api/v1/crm/leads/{lead}', 'crm:write'],
        'listCrmOpportunities' => ['GET', '/api/v1/crm/opportunities', 'crm:read'],
        'showCrmOpportunities' => ['GET', '/api/v1/crm/opportunities/OPP-0117', 'crm:read'],
        'listCrmClients' => ['GET', '/api/v1/crm/clients', 'crm:read'],
        'createCrmClients' => ['POST', '/api/v1/crm/clients', 'crm:write'],
        'showCrmClients' => ['GET', '/api/v1/crm/clients/CLI-0003', 'crm:read'],
        'updateCrmClients' => ['PATCH', '/api/v1/crm/clients/CLI-0006', 'crm:write'],
        'listCatalogProducts' => ['GET', '/api/v1/catalog/products', 'catalog:read'],
        'showCatalogProducts' => ['GET', '/api/v1/catalog/products/CUS-HUM-FD', 'catalog:read'],
        'getCatalogProductsAvailability' => ['GET', '/api/v1/catalog/products/CUS-HUM-FD/availability', 'availability:read'],
        'listCatalogDepartures' => ['GET', '/api/v1/catalog/departures', 'availability:read'],
        'listQuotes' => ['GET', '/api/v1/quotes', 'quotes:read'],
        'createQuotes' => ['POST', '/api/v1/quotes', 'quotes:write'],
        'showQuotes' => ['GET', '/api/v1/quotes/COT-2026-00189', 'quotes:read'],
        'createQuotesVersions' => ['POST', '/api/v1/quotes/{quote}/versions', 'quotes:write'],
        'listReservations' => ['GET', '/api/v1/reservations', 'reservations:read'],
        'createReservations' => ['POST', '/api/v1/reservations', 'reservations:write'],
        'showReservations' => ['GET', '/api/v1/reservations/RES-2026-000361', 'reservations:read'],
        'listFinancePayments' => ['GET', '/api/v1/finance/payments', 'payments:read'],
        'listOpsOrders' => ['GET', '/api/v1/ops/orders', 'operations:read'],
        'showOpsOrders' => ['GET', '/api/v1/ops/orders/OP-2026-0413', 'operations:read'],
        'listOpsVouchers' => ['GET', '/api/v1/ops/vouchers', 'operations:read'],
        'showOpsVouchers' => ['GET', '/api/v1/ops/vouchers/{voucher}', 'operations:read'],
        'listFinanceReceivables' => ['GET', '/api/v1/finance/receivables', 'payments:read'],
        'showFinanceReceivables' => ['GET', '/api/v1/finance/receivables/{receivable}', 'payments:read'],
        'showFinancePayments' => ['GET', '/api/v1/finance/payments/{payment}', 'payments:read'],
        'listFinanceInvoices' => ['GET', '/api/v1/finance/invoices', 'invoices:read'],
        'showFinanceInvoices' => ['GET', '/api/v1/finance/invoices/F001-00001482', 'invoices:read'],
        'listIntegrationsWebhooks' => ['GET', '/api/v1/integrations/webhooks', 'webhooks:manage'],
        'createIntegrationsWebhooks' => ['POST', '/api/v1/integrations/webhooks', 'webhooks:manage'],
        'updateIntegrationsWebhooks' => ['PATCH', '/api/v1/integrations/webhooks/{hook}', 'webhooks:manage'],
        'deleteIntegrationsWebhooks' => ['DELETE', '/api/v1/integrations/webhooks/{hook}', 'webhooks:manage'],
    ];
}

function t16llSuccess(string $operation, string $token): TestResponse
{
    [$method, $uri] = t16llOps()[$operation];
    $lead = fn (): string => (string) t16llCall('POST', '/api/v1/crm/leads', $token, t16llLeadBody())->assertCreated()->json('data.code');
    $hook = fn (): string => (string) t16llCall('POST', '/api/v1/integrations/webhooks', $token, t16llHookBody())->assertCreated()->json('data.code');

    return match ($operation) {
        'createCrmLeads' => t16llCall($method, $uri, $token, t16llLeadBody()),
        'showCrmLeads' => t16llCall($method, str_replace('{lead}', t16llValue('crm_leads'), $uri), $token),
        'updateCrmLeads' => (function () use ($lead, $method, $uri, $token): TestResponse {
            $code = $lead();
            $row = rowOf('crm_leads', $code);

            return t16llCall($method, str_replace('{lead}', $code, $uri), $token, t16llLeadBody(['name' => 'Contacto editado por API', 'email' => $row->email]), critical((int) $row->lock_version));
        })(),
        'createCrmClients' => t16llCall($method, $uri, $token, t16llClientBody()),
        'updateCrmClients' => t16llCall($method, $uri, $token, t16llClientEdit('CLI-0006', ['city' => 'Lyon'])),
        'createQuotes' => t16llCall($method, $uri, $token, t16llQuoteBody()),
        'createQuotesVersions' => (function () use ($method, $uri, $token): TestResponse {
            $code = (string) withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->where('status', 'enviada')->orderBy('code')->value('code'));

            return t16llCall($method, str_replace('{quote}', $code, $uri), $token, [], critical((int) rowOf('quote_quotes', $code)->lock_version));
        })(),
        'createReservations' => t16llCall($method, $uri, $token, t16llReservationBody(), critical()),
        'showOpsVouchers' => t16llCall($method, str_replace('{voucher}', t16llValue('ops_vouchers'), $uri), $token),
        'showFinanceReceivables' => t16llCall($method, str_replace('{receivable}', t16llValue('fin_receivables'), $uri), $token),
        'showFinancePayments' => t16llCall($method, str_replace('{payment}', t16llValue('fin_payments'), $uri), $token),
        'createIntegrationsWebhooks' => t16llCall($method, $uri, $token, t16llHookBody()),
        'updateIntegrationsWebhooks' => t16llCall($method, str_replace('{hook}', $hook(), $uri), $token, t16llHookBody(['description' => 'Editado por API'])),
        'deleteIntegrationsWebhooks' => t16llCall($method, str_replace('{hook}', $hook(), $uri), $token),
        default => t16llCall($method, $uri, $token),
    };
}

dataset('t16ll_operations', fn () => array_keys(t16llOps()));

it('G6-02: las 35 operaciones del contrato con tenantApiKey están mapeadas a su scope', function () {
    $contract = collect(t16llOps())->mapWithKeys(fn (array $op, string $name): array => [$name => $op[2]]);

    expect($contract)->toHaveCount(35)
        ->and(collect(ApiKeyRoutes::ROUTES)->countBy()->all())->toEqual($contract->countBy()->all())
        ->and(ApiKeyRoutes::unknown(app('router')))->toBe([])
        ->and(collect(ApiKeyEndpoints::all()))->toHaveCount(35)
        ->and(array_diff(array_unique(array_values(ApiKeyRoutes::ROUTES)), t16llAllScopes()))->toBe([]);
});

it('G6-02: con su scope la llave usa la operación como la agencia', function (string $operation) {
    $key = t16llKey(t16llAllScopes());
    $response = t16llSuccess($operation, $key['token']);

    expect($response->status())->toBeGreaterThanOrEqual(200)->toBeLessThan(300, $operation.': '.$response->getContent())
        ->and($response->headers->get('X-RateLimit-Limit'))->not->toBeNull();
})->with('t16ll_operations');

it('G6-02: sin su scope la llave recibe 403 API_KEY_SCOPE con el permiso que falta', function (string $operation) {
    [$method, $uri, $scope] = t16llOps()[$operation];
    $key = t16llKey(array_values(array_diff(t16llAllScopes(), [$scope])));

    $samples = ['{lead}' => 'LEAD-0226', '{quote}' => 'COT-2026-00189', '{voucher}' => 'VOU-2026-01201', '{receivable}' => 'CXC-00716', '{payment}' => 'PAG-01930', '{hook}' => 'WH-0001'];
    $response = t16llCall($method, strtr($uri, $samples), $key['token']);

    expect($response)->toBeApiError(403, 'API_KEY_SCOPE')
        ->and($response->json('required_permissions'))->toBe([$scope]);
})->with('t16ll_operations');

it('API-BR-01: llave inválida, mal formada, revocada o vencida responde 401 y la sesión sigue igual', function () {
    expect(t16llCall('GET', '/api/v1/crm/leads', 'qts_live_'.Str::random(32)))->toBeApiError(401, 'API_KEY_INVALID');
    expect(t16llCall('GET', '/api/v1/crm/leads', 'qts_live_corta'))->toBeApiError(401, 'API_KEY_INVALID');

    $revoked = t16llKey(['crm:read'], ['status' => 'revoked']);
    expect(t16llCall('GET', '/api/v1/crm/leads', $revoked['token']))->toBeApiError(401, 'API_KEY_INVALID');

    $expired = t16llKey(['crm:read'], ['expires_at' => now()->subDays(2)->toDateString()]);
    expect(t16llCall('GET', '/api/v1/crm/leads', $expired['token']))->toBeApiError(401, 'API_KEY_INVALID');

    actingAsSeed('U01');
    $session = $this->getJson('/api/v1/crm/leads')->assertOk();
    expect($session->headers->get('X-RateLimit-Limit'))->toBeNull();
});

it('API-BR-01: una IP fuera de la lista recibe 403 y una de la lista entra', function () {
    $key = t16llKey(['crm:read'], ['ip_allowlist' => '{"203.0.113.0/24"}']);

    expect(t16llCall('GET', '/api/v1/crm/leads', $key['token']))->toBeApiError(403, 'API_KEY_IP');

    app('auth')->forgetGuards();
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson('/api/v1/crm/leads', bearer($key['token']))->assertOk();
});

it('G6-02: al pasar el límite por minuto responde 429 con Retry-After y cabeceras', function () {
    $key = t16llKey(['catalog:read']);
    Cache::put('api-key:rate:'.tenantA()->getKey(), 2, 60);

    t16llCall('GET', '/api/v1/catalog/products', $key['token'])->assertOk();
    $last = t16llCall('GET', '/api/v1/catalog/products', $key['token'])->assertOk();
    $limited = t16llCall('GET', '/api/v1/catalog/products', $key['token'])->assertStatus(429);

    expect($last->headers->get('X-RateLimit-Limit'))->toBe('2')
        ->and($last->headers->get('X-RateLimit-Remaining'))->toBe('0')
        ->and($limited->headers->get('Retry-After'))->not->toBeNull()
        ->and($limited->headers->get('X-RateLimit-Remaining'))->toBe('0')
        ->and($limited->headers->get('X-RateLimit-Reset'))->not->toBeNull();
});

it('G6-02: una ruta fuera de la lista rechaza la llave aunque tenga todos los scopes', function () {
    $key = t16llKey(t16llAllScopes());

    expect(t16llCall('GET', '/api/v1/me', $key['token']))->toBeApiError(401, 'API_KEY_ROUTE');
    expect(t16llCall('GET', '/api/v1/crm/leads/duplicates', $key['token']))->toBeApiError(401, 'API_KEY_ROUTE');
    expect(t16llCall('POST', '/api/v1/crm/leads/LEAD-0226/assign', $key['token'], ['owner_id' => seedUser('U03')->id]))->toBeApiError(401, 'API_KEY_ROUTE');
    expect(t16llCall('GET', '/api/v1/admin/api', $key['token']))->toBeApiError(401, 'API_KEY_ROUTE');
});

it('API-BR-01: la llave de otra agencia no ve los datos de la agencia A', function () {
    $key = t16llKey(t16llAllScopes(), tenant: tenantB());

    t16llCall('GET', '/api/v1/crm/clients/CLI-0003', $key['token'])->assertNotFound();
    t16llCall('GET', '/api/v1/crm/leads/LEAD-0226', $key['token'])->assertNotFound();
    t16llCall('GET', '/api/v1/quotes/COT-2026-00189', $key['token'])->assertNotFound();
    t16llCall('GET', '/api/v1/reservations/RES-2026-000361', $key['token'])->assertNotFound();

    $leads = collect(t16llCall('GET', '/api/v1/crm/leads', $key['token'])->assertOk()->json('data'))->pluck('code');
    expect($leads)->not->toContain('LEAD-0226');
});

it('API-BR-01: la llave ve toda la agencia, sin cartera', function () {
    $key = t16llKey(['crm:read']);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/crm/leads/LEAD-0226')->status())->toBeIn([403, 404]);

    t16llCall('GET', '/api/v1/crm/leads/LEAD-0226', $key['token'])->assertOk()->assertJsonPath('data.code', 'LEAD-0226');
    $codes = collect(t16llCall('GET', '/api/v1/crm/leads', $key['token'])->assertOk()->json('data'))->pluck('code');
    expect($codes)->toContain('LEAD-0226')->toContain('LEAD-0223')->toContain('LEAD-0224');
});

it('G6-02: lo que escribe la llave queda auditado con autor «Llave nombre (KEY-…)»', function () {
    $key = t16llKey(['crm:write']);
    $code = (string) t16llCall('POST', '/api/v1/crm/leads', $key['token'], t16llLeadBody())->assertCreated()->json('data.code');
    $label = "Llave Motor de reservas ({$key['code']})";

    expect(t16llAudited(['entity' => 'Lead', 'entity_id' => $code, 'action' => 'crear', 'actor_type' => 'api_client', 'actor_id' => $key['id'], 'actor_role' => $label]))->toBeTrue()
        ->and(rowOf('crm_leads', $code)->created_by)->toBe($key['id']);

    actingAsSeed('U01');
    $events = collect($this->getJson('/api/v1/audit-events?entity=Lead')->assertOk()->json('data'));
    expect($events->firstWhere('entity_id', $code)['actor'] ?? null)->toBe($label);
});

it('G6-02: responsable (1) el owner_id que manda el sistema si es un asesor activo', function () {
    $key = t16llKey(['crm:write', 'quotes:write', 'reservations:write']);
    $u03 = seedUser('U03')->id;
    $u04 = seedUser('U04')->id;

    $lead = t16llCall('POST', '/api/v1/crm/leads', $key['token'], t16llLeadBody(['owner_id' => $u03]))->assertCreated()->json('data.code');
    $client = t16llCall('POST', '/api/v1/crm/clients', $key['token'], t16llClientBody(['owner_id' => $u04]))->assertCreated()->json('data.code');
    $quote = t16llCall('POST', '/api/v1/quotes', $key['token'], t16llQuoteBody(['owner_id' => $u03]))->assertCreated()->json('data.code');
    $reservation = t16llCall('POST', '/api/v1/reservations', $key['token'], t16llReservationBody(['owner_id' => $u04]), critical())->assertCreated()->json('data.code');

    expect(rowOf('crm_leads', $lead)->owner_id)->toBe($u03)
        ->and(rowOf('crm_clients', $client)->owner_id)->toBe($u04)
        ->and(rowOf('quote_quotes', $quote)->owner_id)->toBe($u03)
        ->and(rowOf('booking_reservations', $reservation)->owner_id)->toBe($u04);

    $inactive = seedUser('U12')->id;
    t16llCall('POST', '/api/v1/crm/clients', $key['token'], t16llClientBody(['owner_id' => $inactive]))->assertStatus(422);
    t16llCall('POST', '/api/v1/quotes', $key['token'], t16llQuoteBody(['owner_id' => $inactive]))->assertStatus(422);
    t16llCall('POST', '/api/v1/crm/leads', $key['token'], t16llLeadBody(['owner_id' => (string) Str::uuid7()]))->assertStatus(422);
});

it('G6-02: responsable (2) sin owner_id el lead queda en la cola sin asignar', function () {
    $key = t16llKey(['crm:write']);
    $code = t16llCall('POST', '/api/v1/crm/leads', $key['token'], t16llLeadBody())->assertCreated()->json('data.code');

    expect(rowOf('crm_leads', $code)->owner_id)->toBeNull();
});

it('G6-02: responsable (3) asesor fijo de la llave para clientes, cotizaciones y reservas', function () {
    $u04 = seedUser('U04')->id;
    $key = t16llKey(['crm:write', 'quotes:write', 'reservations:write'], ['owner_mode' => 'fixed', 'owner_id' => $u04]);

    $client = t16llCall('POST', '/api/v1/crm/clients', $key['token'], t16llClientBody())->assertCreated()->json('data.code');
    $quote = t16llCall('POST', '/api/v1/quotes', $key['token'], t16llQuoteBody())->assertCreated()->json('data.code');
    $reservation = t16llCall('POST', '/api/v1/reservations', $key['token'], t16llReservationBody(), critical())->assertCreated()->json('data.code');

    expect(rowOf('crm_clients', $client)->owner_id)->toBe($u04)
        ->and(rowOf('quote_quotes', $quote)->owner_id)->toBe($u04)
        ->and(rowOf('booking_reservations', $reservation)->owner_id)->toBe($u04);
});

it('G6-02: responsable (3) reparto por turno entre los asesores activos', function () {
    $key = t16llKey(['crm:write', 'quotes:write']);
    $pool = [seedUser('U04')->id, seedUser('U03')->id];

    $owners = collect(range(1, 3))->map(fn (): string => (string) rowOf('crm_clients', t16llCall('POST', '/api/v1/crm/clients', $key['token'], t16llClientBody())->assertCreated()->json('data.code'))->owner_id);
    $quote = t16llCall('POST', '/api/v1/quotes', $key['token'], t16llQuoteBody())->assertCreated()->json('data.code');

    expect($owners->all())->toBe([$pool[0], $pool[1], $pool[0]])
        ->and(rowOf('quote_quotes', $quote)->owner_id)->toBe($pool[1])
        ->and(DB::connection('pgsql_platform')->table('integration_api_keys')->where('id', $key['id'])->value('owner_cursor'))->toBe($pool[1]);
});

it('G6-02: el formulario de la llave guarda y cambia el responsable, auditado', function () {
    actingAsSeed('U01');
    $u04 = seedUser('U04')->id;

    $overview = $this->getJson('/api/v1/admin/api')->assertOk()->json('data');
    expect(collect($overview['scopes'])->pluck('value')->all())->toContain('crm:read', 'operations:read', 'webhooks:manage')
        ->and(collect($overview['owner_modes'])->pluck('value')->all())->toBe(['fixed', 'round_robin'])
        ->and(collect($overview['advisors'])->pluck('id'))->toContain($u04);

    $this->postJson('/api/v1/integrations/api-keys', ['name' => 'ERP', 'environment' => 'test', 'scopes' => ['crm:write'], 'owner_mode' => 'fixed'])->assertStatus(422)->assertJsonValidationErrors('owner_id');
    $code = $this->postJson('/api/v1/integrations/api-keys', ['name' => 'ERP', 'environment' => 'test', 'scopes' => ['crm:write'], 'owner_mode' => 'fixed', 'owner_id' => $u04])->assertCreated()->json('data.code');

    expect(rowOf('integration_api_keys', $code))->owner_mode->toBe('fixed')->owner_id->toBe($u04);

    $this->patchJson("/api/v1/integrations/api-keys/{$code}/owner", ['owner_mode' => 'round_robin'])->assertOk()->assertJsonPath('data.owner_mode', 'round_robin');
    expect(rowOf('integration_api_keys', $code))->owner_mode->toBe('round_robin')->owner_id->toBeNull()
        ->and(t16llAudited(['entity' => 'Clave de API', 'entity_id' => $code, 'action' => 'cambiar_responsable']))->toBeTrue();

    $default = $this->postJson('/api/v1/integrations/api-keys', ['name' => 'Sitio', 'environment' => 'test', 'scopes' => ['catalog:read']])->assertCreated()->json('data.code');
    expect(rowOf('integration_api_keys', $default)->owner_mode)->toBe('round_robin');

    actingAsSeed('U03');
    expect($this->patchJson("/api/v1/integrations/api-keys/{$code}/owner", ['owner_mode' => 'round_robin']))->toBeApiError(403);
});
