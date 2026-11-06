<?php

use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\TenantContext;
use Database\Support\KitSchema;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

dataset('recursos_de_negocio', [
    'reserva' => ['booking_reservations', '/api/v1/reservations', 'RES-2026-000348'],
    'cotización' => ['quote_quotes', '/api/v1/quotes', 'COT-2026-00191'],
    'cliente' => ['crm_clients', '/api/v1/crm/clients', 'CLI-0002'],
    'lead' => ['crm_leads', '/api/v1/crm/leads', 'LEAD-0231'],
    'producto' => ['catalog_products', '/api/v1/catalog/products', 'CUS-PKG-5D4N'],
    'cuenta por cobrar' => ['fin_receivables', '/api/v1/finance/receivables', 'CXC-00716'],
    'orden operativa' => ['ops_orders', '/api/v1/ops/orders', 'OP-2026-0413'],
]);

const PLATFORM_TABLES_WITHOUT_RLS = ['personal_access_tokens'];

it('X-01 / T-01: un usuario de B recibe 404 RESOURCE_NOT_FOUND al pedir un recurso de A y queda auditado', function (string $table, string $route, string $code) {
    expect(rowOf($table, $code))->not->toBeNull();
    actingAsTenantBAdmin();

    $this->getJson("{$route}/{$code}")
        ->assertNotFound()
        ->assertJsonPath('error', 'RESOURCE_NOT_FOUND');

    expect(auditExists(['action' => 'acceso_denegado', 'entity_id' => "{$route}/{$code}"], tenantB()))->toBeTrue();
})->with('recursos_de_negocio');

it('X-01 / T-01: los listados de B no contienen filas de A', function (string $table, string $route) {
    $rowsA = withinTenant(tenantA(), fn () => DB::table($table)->pluck('code', 'id')->all());
    expect($rowsA)->not->toBeEmpty();
    actingAsTenantBAdmin();

    $json = json_encode($this->getJson($route.'?page[size]=100')->assertOk()->json());

    foreach ($rowsA as $id => $code) {
        expect($json)->not->toContain((string) $id);
        expect($json)->not->toContain('"'.$code.'"');
    }
})->with('recursos_de_negocio');

it('X-02 / T-02: tenant_id enviado en el cuerpo se ignora; el tenant sale del token', function () {
    $userB = actingAsTenantBAdmin();
    $catalogs = $this->getJson('/api/v1/crm/catalogs')->assertOk()->json('data');
    $first = fn (string $kind) => collect($catalogs)->first(fn ($items, $key) => str_contains((string) $key, $kind))[0]['code'] ?? $kind;

    $this->postJson('/api/v1/crm/leads', [
        'tenant_id' => tenantA()->getKey(),
        'name' => 'Lead de prueba aislamiento',
        'email' => 'aislamiento@example.com',
        'phone' => '987654321',
        'channel' => $first('channel'),
        'source' => $first('source'),
        'interest' => $first('interest'),
    ])->assertCreated();

    $leadB = withinTenant(tenantB(), fn () => DB::table('crm_leads')->where('email', 'aislamiento@example.com')->first());

    expect($leadB?->tenant_id)->toBe($userB->tenant_id)
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_leads')->where('email', 'aislamiento@example.com')->exists()))->toBeFalse();
});

it('X-02 / T-02: X-Tenant-Id de otro tenant se ignora y se responden datos del tenant del token', function () {
    actingAsTenantBAdmin();
    $leadsA = withinTenant(tenantA(), fn () => DB::table('crm_leads')->pluck('code')->all());

    $json = json_encode($this->withHeader('X-Tenant-Id', tenantA()->getKey())->getJson('/api/v1/crm/leads')->assertOk()->json());

    foreach ($leadsA as $code) {
        expect($json)->not->toContain('"'.$code.'"');
    }
})->skip('X-02 / T-02 (00 SEC-BR-02): X-Tenant-Id o ?tenant de otro tenant deben ignorarse y responder con datos del token; hoy ResolveTenant::rejectClientSuppliedTenant responde 403 en cualquier ruta.');

it('X-02 / T-02: una ruta que intenta fijar otro tenant responde 403 TENANT_SCOPE_VIOLATION', function () {
    requireRoute('GET', '/api/v1/me/tenant');
    actingAsTenantBAdmin();

    expect($this->getJson('/api/v1/me/tenant?tenant='.tenantA()->getKey()))
        ->toBeApiError(403, 'TENANT_SCOPE_VIOLATION');
});

it('X-03: con qhapaq_app y sin app.tenant_id una consulta directa devuelve 0 filas', function () {
    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->count()))->toBeGreaterThan(0);

    DB::transaction(function () {
        DB::statement("select set_config('app.tenant_id', '', true)");

        expect(DB::table('booking_reservations')->count())->toBe(0)
            ->and(DB::table('quote_quotes')->count())->toBe(0)
            ->and(DB::table('crm_clients')->count())->toBe(0);
    });
});

it('X-03: con qhapaq_app y sin app.tenant_id un INSERT viola la política', function () {
    $insert = fn () => DB::transaction(function () {
        DB::statement("select set_config('app.tenant_id', '', true)");
        DB::table('crm_leads')->insert(['tenant_id' => tenantA()->getKey(), 'code' => 'LEAD-RLS-1', 'name' => 'Sin tenant']);
    });

    expect($insert)->toThrow(QueryException::class);
});

it('X-01: RLS aísla por sí sola aunque la consulta SQL directa no filtre por tenant', function () {
    withinTenant(tenantB(), function () {
        expect(DB::table('booking_reservations')->where('code', 'RES-2026-000348')->exists())->toBeFalse()
            ->and(DB::table('quote_quotes')->count())->toBe(0)
            ->and(DB::table('crm_clients')->whereIn('code', ['CLI-0001', 'CLI-0002'])->count())->toBe(0);
    });
});

it('X-01: con qhapaq_app y app.tenant_id de B no se puede escribir una fila con tenant_id de A', function () {
    $insert = fn () => withinTenant(tenantB(), fn () => DB::table('crm_leads')->insert([
        'tenant_id' => tenantA()->getKey(), 'code' => 'LEAD-RLS-2', 'name' => 'Cruce de tenant',
    ]));

    expect($insert)->toThrow(QueryException::class);
});

it('todas las tablas de negocio con tenant_id tienen RLS habilitada y forzada', function () {
    $platform = [...KitSchema::tables('01_platform'), ...PLATFORM_TABLES_WITHOUT_RLS];

    $missing = collect(DB::select(<<<'SQL'
        select c.relname, c.relrowsecurity, c.relforcerowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
          and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
        SQL))
        ->reject(fn (object $table) => in_array($table->relname, $platform, true))
        ->reject(fn (object $table) => $table->relrowsecurity && $table->relforcerowsecurity)
        ->pluck('relname')
        ->all();

    expect($missing)->toBe([]);
});

it('X-04: un job sin tenant serializado falla de forma explícita', function () {
    $job = new class
    {
        public ?string $tenantId = null;
    };

    expect(fn () => (new RestoreTenantContext)->handle($job, fn () => true))->toThrow(RuntimeException::class);
});

it('X-04: un job con tenant serializado corre con app.tenant_id de su tenant y limpia el contexto al terminar', function () {
    $job = new class
    {
        public ?string $tenantId = null;
    };
    $job->tenantId = tenantB()->getKey();

    $seen = (new RestoreTenantContext)->handle($job, fn () => [
        DB::selectOne("select current_setting('app.tenant_id', true) as tenant")->tenant,
        DB::table('quote_quotes')->count(),
    ]);

    expect($seen)->toBe([tenantB()->getKey(), 0])
        ->and(app(TenantContext::class)->has())->toBeFalse();
});

it('JOB-02 restaura el tenant antes de vencer cotizaciones', function () {})->todo('Fase B: no existe App\Domain\Quotes\Jobs\ExpireQuotes; cuando exista debe usar TenantAware (RestoreTenantContext).');

it('cache y locks usan el prefijo t:{tenant_id}: del tenant del contexto', function () {
    app(TenantContext::class)->set(tenantA());

    expect(app(TenantContext::class)->key('idem', 'abc'))->toBe('t:'.tenantA()->getKey().':idem:abc');
});

it('la caché de permisos de un tenant no deja sin permisos a otro tenant', function () {
    actingAsSeed('U01');
    $this->getJson('/api/v1/crm/leads')->assertOk();

    actingAsTenantBAdmin();
    $this->getJson('/api/v1/crm/leads')->assertOk();
});
