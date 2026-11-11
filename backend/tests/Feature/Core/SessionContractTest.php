<?php

use App\Domain\Iam\Models\MfaFactor;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function resetTokenFor(string $email): string
{
    $token = Str::random(64);
    DB::connection('pgsql_platform')->table('password_reset_tokens')->updateOrInsert(['email' => $email], ['token' => hash('sha256', $token), 'created_at' => now()]);

    return $token;
}

it('auth/password/forgot responde igual exista o no la cuenta y solo guarda token para la real', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'lparedes@andeshorizonte.pe'])->assertOk()->assertJsonPath('data.message', fn ($message) => str_contains($message, 'Si el correo'));
    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'nadie@ejemplo.pe'])->assertOk();

    expect(DB::connection('pgsql_platform')->table('password_reset_tokens')->where('email', 'lparedes@andeshorizonte.pe')->exists())->toBeTrue()
        ->and(DB::connection('pgsql_platform')->table('password_reset_tokens')->where('email', 'nadie@ejemplo.pe')->exists())->toBeFalse();
});

it('auth/password/reset cambia la contraseña con un enlace de un solo uso', function () {
    $token = resetTokenFor('lparedes@andeshorizonte.pe');
    $body = ['email' => 'lparedes@andeshorizonte.pe', 'token' => $token, 'password' => 'NuevaClave2026', 'password_confirmation' => 'NuevaClave2026'];

    $this->postJson('/api/v1/auth/password/reset', $body)->assertOk()->assertJsonPath('data.email', 'lparedes@andeshorizonte.pe');

    $platform = DB::connection('pgsql_platform');

    expect(Hash::check('NuevaClave2026', (string) $platform->table('iam_users')->where('tenant_id', tenantA()->getKey())->where('code', 'U03')->value('password')))->toBeTrue()
        ->and($platform->table('audit_events')->where('tenant_id', tenantA()->getKey())->where('entity_id', 'U03')->where('action', 'restablecer_contrasena')->exists())->toBeTrue();
    expect($this->postJson('/api/v1/auth/password/reset', $body))->toBeApiError(422, 'RESET_TOKEN_INVALID');
});

it('auth/password/reset rechaza un enlace vencido', function () {
    $token = resetTokenFor('lparedes@andeshorizonte.pe');
    DB::connection('pgsql_platform')->table('password_reset_tokens')->where('email', 'lparedes@andeshorizonte.pe')->update(['created_at' => now()->subHours(2)]);

    expect($this->postJson('/api/v1/auth/password/reset', ['email' => 'lparedes@andeshorizonte.pe', 'token' => $token, 'password' => 'NuevaClave2026', 'password_confirmation' => 'NuevaClave2026']))
        ->toBeApiError(422, 'RESET_TOKEN_EXPIRED');
});

it('auth/invitations/{token}/accept exige Idempotency-Key y repite la misma respuesta', function () {
    $token = Str::random(48);
    $user = seedUser('U12');
    DB::connection('pgsql_platform')->table('iam_users')->where('id', $user->id)->update(['status' => 'pendiente']);
    DB::connection('pgsql_platform')->table('iam_user_invitations')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => tenantA()->getKey(), 'user_id' => $user->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDay(), 'require_mfa' => false, 'invited_by' => seedUser('U01')->id]);
    $body = ['password' => 'ClaveSegura2026', 'password_confirmation' => 'ClaveSegura2026'];
    app(TenantContext::class)->clear();

    expect($this->postJson("/api/v1/auth/invitations/{$token}/accept", $body))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');

    $key = idem();
    $first = $this->postJson("/api/v1/auth/invitations/{$token}/accept", $body, critical(null, $key))->assertOk()->json();
    $again = $this->postJson("/api/v1/auth/invitations/{$token}/accept", $body, critical(null, $key))->assertOk();

    expect($again->headers->get('Idempotent-Replayed'))->toBe('true')
        ->and($again->json())->toBe($first)
        ->and(DB::connection('pgsql_platform')->table('iam_users')->where('id', $user->id)->value('status'))->toBe('activo');
});

it('platform/auth/login entrega un token con MFA pendiente y no acepta usuarios de agencia', function () {
    $login = $this->postJson('/api/v1/platform/auth/login', ['email' => 'ops@kipucontrol.com', 'password' => (string) config('demo.password')]);

    $login->assertOk()->assertJsonPath('data.realm', 'platform')->assertJsonPath('data.mfa_required', true);
    expect($this->postJson('/api/v1/platform/auth/login', ['email' => 'lparedes@andeshorizonte.pe', 'password' => (string) config('demo.password')]))->toBeApiError(401);
});

it('me/permissions y me/tenant devuelven datos del usuario y del tenant sin datos de plataforma', function () {
    actingAsSeed('U03');

    $permissions = $this->getJson('/api/v1/me/permissions')->assertOk()->json('data');
    $tenant = $this->getJson('/api/v1/me/tenant')->assertOk()->json('data');

    expect($permissions['permissions'])->toContain('quotes.view')->not->toContain('admin.settings.manage')
        ->and($tenant['code'])->toBe('TNT-0001')
        ->and($tenant)->not->toHaveKey('mrr')
        ->and($tenant)->not->toHaveKey('modules');
});

it('me/tenant es solo para el back-office', function () {
    actingAsSeed('U14');

    expect($this->getJson('/api/v1/me/tenant'))->toBeApiError(403, 'SEC-BR-05');
    $this->getJson('/api/v1/me/permissions')->assertOk();
});

it('me/notifications trae las del usuario con unread_count y read-all las marca', function () {
    $user = actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('notif_messages')->insert(['code' => 'NTF-PEST-1', 'event_code' => 'acceso.solicitud', 'channel' => 'portal', 'recipient_user_id' => $user->id, 'subject' => 'Aviso de prueba', 'status' => 'enviado']));

    $before = $this->getJson('/api/v1/me/notifications')->assertOk();
    expect($before->json('meta.unread_count'))->toBeGreaterThanOrEqual(1)
        ->and(collect($before->json('data'))->pluck('code'))->toContain('NTF-PEST-1');

    $this->postJson('/api/v1/me/notifications/read-all')->assertOk()->assertJsonPath('data.unread_count', 0);
    expect($this->getJson('/api/v1/me/notifications')->json('meta.unread_count'))->toBe(0);
});

it('GET me informa si el rol exige la verificación en dos pasos (mfa_required)', function () {
    actingAsSeed('U01');
    expect($this->getJson('/api/v1/me')->assertOk()->json('data.mfa_required'))->toBeTrue();

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/me')->assertOk()->json('data.mfa_required'))->toBeFalse();
});

it('DELETE me/mfa: el rol que exige MFA no la desactiva; un rol opcional sí', function () {
    actingAsSeed('U01');
    expect($this->deleteJson('/api/v1/me/mfa'))->toBeApiError(422, 'SEC-BR-08');

    actingAsSeed('U04');

    $this->deleteJson('/api/v1/me/mfa')->assertNoContent();
    expect((bool) seedUser('U04')->mfa_enabled)->toBeFalse()
        ->and(withinTenant(tenantA(), fn () => MfaFactor::query()->where('user_id', seedUser('U04')->id)->exists()))->toBeFalse();
    expect($this->deleteJson('/api/v1/me/mfa'))->toBeApiError(409, 'MFA_NOT_ENROLLED');
});

it('search exige 2 caracteres y limita a 12 resultados', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/search?q=c'))->toBeApiError(422);
    $data = $this->getJson('/api/v1/search?q=COT')->assertOk()->json('data');

    expect(count($data))->toBeLessThanOrEqual(12)->toBeGreaterThan(0);
});

it('access-requests registra la solicitud, notifica al Tenant Admin y no la duplica', function () {
    actingAsSeed('U03');

    $data = $this->postJson('/api/v1/access-requests', ['path' => '/admin/usuarios'])->assertOk()->json('data');

    expect($data['required_permissions'])->toBe(['admin.users.manage'])
        ->and($data['notified'])->toBeGreaterThanOrEqual(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'acceso.solicitud')->where('source_id', $data['id'])->exists()))->toBeTrue();
    expect($this->postJson('/api/v1/access-requests', ['path' => '/admin/usuarios']))->toBeApiError(409, 'ACCESS_REQUEST_PENDING');
    expect($this->postJson('/api/v1/access-requests', ['path' => '/cotizaciones']))->toBeApiError(422, 'ACCESS_ALREADY_GRANTED');
});

it('access-requests no está disponible para usuarios externos', function () {
    actingAsSeed('U14');

    expect($this->postJson('/api/v1/access-requests', ['path' => '/admin']))->toBeApiError(403);
});
