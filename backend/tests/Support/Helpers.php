<?php

use App\Domain\Iam\Actions\IssueAccessToken;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Sequences\DefaultSequences;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

const BUSINESS_TODAY = '2026-09-29';

function freezeBusinessToday(string $time = '10:00:00'): void
{
    $now = CarbonImmutable::parse(BUSINESS_TODAY.' '.$time, 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

function tenantByCode(string $code): Tenant
{
    return Tenant::on('pgsql_platform')->where('code', $code)->firstOrFail();
}

function tenantA(): Tenant
{
    return tenantByCode('TNT-0001');
}

function tenantB(): Tenant
{
    return tenantByCode('TNT-0002');
}

function withinTenant(Tenant $tenant, Closure $fn): mixed
{
    return DB::transaction(function () use ($tenant, $fn) {
        DB::select('select app_set_tenant(?::uuid)', [$tenant->getKey()]);
        app(TenantContext::class)->set($tenant);
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

        return $fn();
    });
}

function seedUser(string $code, ?Tenant $tenant = null): User
{
    return withinTenant($tenant ?? tenantA(), fn () => User::query()->where('code', $code)->firstOrFail());
}

function issueToken(User $user, Tenant $tenant, bool $mfaVerified = true): string
{
    return withinTenant($tenant, function () use ($user, $mfaVerified) {
        $plain = app(IssueAccessToken::class)($user, 'pest');

        if ($mfaVerified && $user->needsMfa()) {
            app(IssueAccessToken::class)->completeMfa(AccessToken::query()->findOrFail(Str::before($plain, '|')));
        }

        return $plain;
    });
}

function useToken(string $token): void
{
    app('auth')->forgetGuards();
    test()->withToken($token);
}

function actingAsUser(User $user, Tenant $tenant): User
{
    useToken(issueToken($user, $tenant));
    app(TenantContext::class)->set($tenant);
    app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

    return $user;
}

function actingAsSeed(string $code): User
{
    return actingAsUser(seedUser($code), tenantA());
}

function actingAsTenantBAdmin(): User
{
    return actingAsUser(seedUser('U01', tenantB()), tenantB());
}

function platformUser(string $email = 'ops@kipucontrol.com'): PlatformUser
{
    return PlatformUser::query()->where('email', $email)->firstOrFail();
}

function rowOf(string $table, string $code, ?Tenant $tenant = null, string $column = 'code'): ?object
{
    return withinTenant($tenant ?? tenantA(), fn () => DB::table($table)->where($column, $code)->first());
}

function idOf(string $table, string $code, ?Tenant $tenant = null): string
{
    $row = rowOf($table, $code, $tenant);

    if ($row === null) {
        throw new RuntimeException("{$code} no existe en {$table}.");
    }

    return (string) $row->id;
}

function auditExists(array $where, ?Tenant $tenant = null): bool
{
    $tenant ??= tenantA();

    return DB::connection('pgsql_audit')->transaction(function () use ($where, $tenant) {
        DB::connection('pgsql_audit')->select('select app_set_tenant(?::uuid)', [$tenant->getKey()]);

        return DB::connection('pgsql_audit')->table('audit_events')->where($where)->exists();
    });
}

function approvedQuote(string $code, ?Tenant $tenant = null): object
{
    $tenant ??= tenantA();

    withinTenant($tenant, function () use ($code) {
        $quote = DB::table('quote_quotes')->where('code', $code)->lockForUpdate()->first();
        DB::table('quote_versions')->where('id', $quote->current_version_id)->update(['status' => 'aprobada']);
        DB::table('quote_quotes')->where('id', $quote->id)->update([
            'status' => 'aprobada',
            'approved_at' => now(),
            'approved_by_name' => 'Cliente de prueba',
            'approval_channel' => 'Email',
        ]);
    });

    return rowOf('quote_quotes', $code, $tenant);
}

function idem(string $prefix = 'pest'): string
{
    return $prefix.'-'.Str::uuid()->toString();
}

function critical(?int $lockVersion = null, ?string $key = null): array
{
    $headers = ['Idempotency-Key' => $key ?? idem(), 'Accept' => 'application/json'];

    if ($lockVersion !== null) {
        $headers['If-Match'] = (string) $lockVersion;
    }

    return $headers;
}

function bearer(string $token): array
{
    return ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];
}

function routeExists(string $method, string $uri): bool
{
    try {
        Route::getRoutes()->match(Request::create($uri, $method));

        return true;
    } catch (NotFoundHttpException|MethodNotAllowedHttpException) {
        return false;
    }
}

function requireRoute(string $method, string $uri): void
{
    if (! routeExists($method, $uri)) {
        test()->markTestSkipped("Pendiente: la ruta del contrato {$method} {$uri} aún no existe.");
    }
}

function loginAs(string $email): TestResponse
{
    return test()->postJson('/api/v1/auth/login', ['email' => $email, 'password' => (string) config('demo.password')]);
}

function lockScheduledJobs(): void
{
    DB::select('select pg_advisory_xact_lock(7410301)');
}

function lockPlatformBilling(): void
{
    DB::connection('pgsql_platform')->select('select pg_advisory_xact_lock(7410302)');
}

function lockCatalogProducts(): void
{
    DB::select('select pg_advisory_xact_lock(7410303)');
}

function lockSeededBookings(): void
{
    DB::select('select pg_advisory_xact_lock(7410304)');
}

function lockTreasury(): void
{
    DB::select('select pg_advisory_xact_lock(7410305)');
}

function lockScheduledCampaigns(): void
{
    DB::select('select pg_advisory_xact_lock(7410306)');
}

function sendBody(): array
{
    return ['channels' => ['email'], 'channel' => 'Email', 'recipient' => 'cliente@example.com', 'message' => 'Propuesta de viaje'];
}

function quoteUpdatePayload(string $code): array
{
    $detail = test()->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data');
    $version = collect($detail['versions'])->sortByDesc('number')->first();

    return [
        'client_code' => $detail['client']['code'],
        'title' => $detail['title'].' (ajuste)',
        'travel_from' => $detail['travel_from'],
        'travel_to' => $detail['travel_to'],
        'valid_until' => $detail['valid_until'],
        'currency' => $detail['currency'],
        'pax_adt' => $detail['pax']['adt'],
        'pax_chd' => $detail['pax']['chd'],
        'pax_inf' => $detail['pax']['inf'],
        'discount_pct' => $version['discount_pct'],
        'tax_pct' => $version['tax_pct'],
        'items' => collect($version['items'])->map(fn (array $item) => [
            'product_code' => $item['product']['code'],
            'date' => $item['date'],
            'qty' => $item['qty'],
            'pax' => $item['pax'],
            'segment' => $item['segment'],
            'unit_price' => $item['unit_price'],
        ])->all(),
        'lock_version' => $detail['lock_version'],
    ];
}

function decideInternally(string $code, string $decision, string $note = 'Aprobado')
{
    $quote = rowOf('quote_quotes', $code);

    return test()->postJson("/api/v1/quotes/{$code}/versions/{$quote->current_version_no}/internal-approval", ['decision' => $decision, 'note' => $note], critical((int) $quote->lock_version));
}

function reservationRow(string $code): object
{
    return rowOf('booking_reservations', $code);
}

function reservationLock(string $code): int
{
    return (int) reservationRow($code)->lock_version;
}

function serviceRow(string $code): object
{
    return rowOf('booking_reservation_services', $code);
}

function departureRow(string $ref): object
{
    return rowOf('catalog_product_departures', $ref, column: 'ref');
}

function sequenceOf(string $docType, ?int $year = null): object
{
    $year ??= CarbonImmutable::now('America/Lima')->year;
    $series = DefaultSequences::SERIES[$docType]['year_reset'] ? (string) $year : 'default';

    return withinTenant(tenantA(), function () use ($docType, $series, $year) {
        app(DefaultSequences::class)->ensure((string) tenantA()->getKey(), $docType, $series, $year);

        return DB::table('sys_sequences')->where('doc_type', $docType)->where('series', $series)->first(['prefix', 'pad_width', 'next_number']);
    });
}

function actingAsPlatform(): void
{
    $platform = platformUser();
    $plain = DB::connection('pgsql_platform')->transaction(function () use ($platform) {
        $token = AccessToken::query()->forceCreate([
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
}

function withPlatformSeeingTenant(Closure $fn, ?Tenant $tenant = null): mixed
{
    $platform = DB::connection('pgsql_platform');
    $tenantConnection = DB::connection('pgsql');
    $original = $platform->getPdo();
    $level = $platform->transactionLevel();
    $setLevel = Closure::bind(function (int $count): void {
        $this->transactions = $count;
    }, $platform, $platform::class);

    $platform->setPdo($tenantConnection->getPdo());
    $setLevel($tenantConnection->transactionLevel());
    $tenantConnection->select('select app_set_tenant(?::uuid)', [($tenant ?? tenantA())->getKey()]);

    try {
        return $fn();
    } finally {
        $platform->setPdo($original);
        $setLevel($level);
    }
}

function webTravelers(int $adults, int $children = 0, int $infants = 0): array
{
    $rows = [];
    $types = [['ADT', $adults, 30], ['CHD', $children, 8], ['INF', $infants, 1]];
    foreach ($types as [$type, $count, $age]) {
        for ($i = 1; $i <= $count; $i++) {
            $n = count($rows) + 1;
            $rows[] = ['first_name' => "Viajero{$n}", 'last_name' => "Prueba {$type}", 'birth_date' => now()->subYears($age)->subMonths(2)->toDateString(), 'doc_type' => 'Pasaporte', 'doc_number' => sprintf('PX%07d', 1000 + $n), 'nationality' => 'Perú'];
        }
    }

    return $rows;
}

function siteOf(string $subdomain = 'andes', array $extra = []): array
{
    return ['X-Forwarded-Host' => $subdomain.'.'.config('sites.domain'), ...$extra];
}
