<?php

use Illuminate\Support\Facades\DB;

function agencyBearer(): string
{
    $email = withinTenant(tenantA(), fn () => DB::table('iam_users')->where('status', 'activo')->where('mfa_required', false)->where('mfa_enabled', false)->whereNull('deleted_at')->orderBy('code')->value('email'));
    $login = test()->postJson('/api/v1/auth/login', ['email' => $email, 'password' => (string) config('demo.password')])->assertOk()->json('data');

    return (string) $login['token'];
}

it('C-08 v2.5: el token de la agencia funciona aunque personal_access_tokens tenga RLS', function () {
    $token = agencyBearer();

    expect(DB::selectOne("select relrowsecurity as rls from pg_class where relname = 'personal_access_tokens'")->rls)->toBeTrue();
    $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$token}"])->assertOk();
});

it('C-08 v2.5: otra agencia no ve los tokens de la agencia A', function () {
    agencyBearer();

    expect(withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->count()))->toBeGreaterThan(0)
        ->and(withinTenant(tenantB(), fn () => DB::table('personal_access_tokens')->where('tenant_id', tenantA()->getKey())->count()))->toBe(0);
});

it('C-08 v2.5: un token inválido responde 401 y uno de la plataforma 403 en el back-office de la agencia (09 T-14)', function () {
    $this->getJson('/api/v1/me', ['Authorization' => 'Bearer 1|no-es-un-token'])->assertStatus(401);
    $this->getJson('/api/v1/me')->assertStatus(401);

    $platform = $this->postJson('/api/v1/platform/auth/login', ['email' => 'ops@kipucontrol.com', 'password' => (string) config('demo.password')])->assertOk()->json('data.token');
    $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$platform}"])->assertForbidden();
});
