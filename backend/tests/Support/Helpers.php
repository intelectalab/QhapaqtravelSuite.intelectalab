<?php

use App\Domain\Iam\Actions\IssueAccessToken;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
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

function platformUser(string $email = 'ops@qhapaq.cloud'): PlatformUser
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
        $quote = DB::table('quote_quotes')->where('code', $code)->first();
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
