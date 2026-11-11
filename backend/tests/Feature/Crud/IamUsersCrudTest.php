<?php

use App\Domain\Iam\Support\StaffSeats;
use App\Jobs\SendPlainMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function iamUserRow(string $code): object
{
    return withinTenant(tenantA(), fn () => DB::table('iam_users as u')->leftJoin('model_has_roles as m', 'm.model_id', '=', 'u.id')->leftJoin('roles as r', 'r.id', '=', 'm.role_id')
        ->where('u.code', $code)->first(['u.*', 'r.name as role']));
}

function iamUserByEmail(string $email): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('iam_users')->where('email', $email)->first());
}

function iamInvite(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/iam/users', [
        'name' => 'Rosa Ccori',
        'email' => 'rccori@andeshorizonte.pe',
        'phone' => '+51 984 111 222',
        'role' => 'sales',
        'sede_id' => idOf('iam_sedes', 'SED-02'),
        ...$overrides,
    ], critical());
}

function iamSetUserLimit(?int $value): void
{
    DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', tenantA()->plan_id)->where('metric', 'users')->update(['value' => $value]);
}

function iamUserAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Usuario', 'entity_id' => $code, 'action' => $action])->exists());
}

function iamTokens(string $code): int
{
    return withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->where('tokenable_id', iamUserRow($code)->id)->count());
}

it('invita a un usuario: queda pendiente, con su rol, una invitación de 72 h y el correo con el enlace', function () {
    Queue::fake();
    actingAsSeed('U01');

    $code = iamInvite()->assertCreated()->json('data.code');
    $user = iamUserRow($code);
    $invitation = withinTenant(tenantA(), fn () => DB::table('iam_user_invitations')->where('user_id', $user->id)->first());

    expect($user->status)->toBe('pendiente')
        ->and($user->role)->toBe('sales')
        ->and($user->email)->toBe('rccori@andeshorizonte.pe')
        ->and($user->sede_id)->toBe(idOf('iam_sedes', 'SED-02'))
        ->and((bool) $user->mfa_required)->toBeFalse()
        ->and($user->password)->toBeNull()
        ->and($invitation->accepted_at)->toBeNull()
        ->and(now()->diffInHours($invitation->expires_at))->toEqual(72.0)
        ->and(iamUserAudit($code, 'invitar'))->toBeTrue();
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail) => $mail->to === 'rccori@andeshorizonte.pe' && str_contains($mail->body, '/invitacion/') && ! str_contains($mail->body, 'contraseña:'));
});

it('el rol que exige MFA marca al invitado con la verificación obligatoria', function () {
    Queue::fake();
    actingAsSeed('U01');

    $code = iamInvite(['email' => 'finanzas2@andeshorizonte.pe', 'role' => 'finance'])->assertCreated()->json('data.code');

    expect((bool) iamUserRow($code)->mfa_required)->toBeTrue();
});

it('la invitación exige Idempotency-Key y valida sus campos', function (array $body, string $field) {
    actingAsSeed('U01');

    $this->postJson('/api/v1/iam/users', [...['name' => 'X', 'email' => 'x@andeshorizonte.pe', 'role' => 'sales', 'sede_id' => idOf('iam_sedes', 'SED-01')], ...$body], critical())
        ->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'correo inválido' => [['email' => 'no-es-correo'], 'email'],
    'sin nombre' => [['name' => ''], 'name'],
    'sin rol' => [['role' => ''], 'role'],
    'sede inválida' => [['sede_id' => 'SED-01'], 'sede_id'],
]);

it('sin Idempotency-Key la invitación no se procesa', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/iam/users', ['name' => 'X', 'email' => 'x@andeshorizonte.pe', 'role' => 'sales', 'sede_id' => idOf('iam_sedes', 'SED-01')]))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
    expect(iamUserByEmail('x@andeshorizonte.pe'))->toBeNull();
});

it('USR-BR-01: rechaza el correo repetido sin importar mayúsculas y el de un usuario desactivado', function () {
    actingAsSeed('U01');

    expect(iamInvite(['email' => 'LPAREDES@andeshorizonte.pe']))->toBeApiError(422, 'USR-BR-01');
    $inactive = iamInvite(['email' => 'rtito@andeshorizonte.pe']);
    expect($inactive)->toBeApiError(422, 'USR-BR-01')
        ->and($inactive->json('message'))->toContain('Reactívalo');
});

it('USR-BR-09: el rol debe ser de la agencia y no de un canal ni de la plataforma', function (string $role) {
    actingAsSeed('U01');

    expect(iamInvite(['role' => $role]))->toBeApiError(422, 'USR-BR-09');
})->with(['super_admin', 'b2b', 'no_existe']);

it('USR-BR-02: con el cupo de usuarios del plan lleno no se invita ni se reactiva', function () {
    actingAsSeed('U01');
    iamSetUserLimit(withinTenant(tenantA(), fn () => StaffSeats::count(DB::table('iam_users'))));

    expect(iamInvite())->toBeApiError(409, 'USR-BR-02')
        ->and($this->postJson('/api/v1/iam/users/U12/activate'))->toBeApiError(409, 'USR-BR-02');
    expect(iamUserByEmail('rccori@andeshorizonte.pe'))->toBeNull()
        ->and(iamUserRow('U12')->status)->toBe('inactivo');
});

it('edita nombre, teléfono y sede; el cambio de rol revoca las sesiones y se audita', function () {
    actingAsSeed('U03');
    $this->getJson('/api/v1/me')->assertOk();
    actingAsSeed('U01');
    $sede = idOf('iam_sedes', 'SED-01');

    $this->patchJson('/api/v1/iam/users/U03', ['name' => 'Lucía Paredes Ríos', 'phone' => '+51 999 000 111', 'role' => 'operations', 'sede_id' => $sede])->assertOk();
    $user = iamUserRow('U03');

    expect($user->name)->toBe('Lucía Paredes Ríos')
        ->and($user->phone)->toBe('+51 999 000 111')
        ->and($user->sede_id)->toBe($sede)
        ->and($user->role)->toBe('operations')
        ->and(iamTokens('U03'))->toBe(0)
        ->and(iamUserAudit('U03', 'cambio_rol'))->toBeTrue()
        ->and(iamUserAudit('U03', 'editar'))->toBeTrue()
        ->and($this->getJson('/api/v1/iam/users/U03')->json('data.permissions'))->toContain('operations.view')->not->toContain('quotes.create');
});

it('USR-BR-03/04: el correo no se edita y nadie cambia su propio rol', function () {
    actingAsSeed('U01');
    $sede = idOf('iam_sedes', 'SED-01');

    $this->patchJson('/api/v1/iam/users/U03', ['name' => 'Lucía', 'role' => 'sales', 'sede_id' => $sede, 'email' => 'otra@andeshorizonte.pe'])->assertStatus(422)->assertJsonValidationErrors('email');
    expect($this->patchJson('/api/v1/iam/users/U01', ['name' => 'Mariela Quispe', 'role' => 'manager', 'sede_id' => $sede]))->toBeApiError(403, 'USR-BR-04')
        ->and(iamUserRow('U01')->role)->toBe('tenant_admin')
        ->and(iamUserRow('U03')->email)->toBe('lparedes@andeshorizonte.pe');
});

it('USR-BR-05: la agencia conserva al menos un administrador activo al cambiar su rol o desactivarlo', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/iam/roles/manager/permissions/admin.users.manage')->assertOk();
    actingAsSeed('U02');

    expect($this->patchJson('/api/v1/iam/users/U01', ['name' => 'Mariela Quispe', 'role' => 'manager', 'sede_id' => idOf('iam_sedes', 'SED-01')]))->toBeApiError(409, 'USR-BR-05')
        ->and($this->postJson('/api/v1/iam/users/U01/deactivate', ['reason' => 'Prueba de bloqueo']))->toBeApiError(409, 'USR-BR-05');
    expect(iamUserRow('U01')->status)->toBe('activo')
        ->and(iamUserRow('U01')->role)->toBe('tenant_admin');
});

it('desactivar a un usuario cierra sus sesiones, le impide entrar, avisa lo que tenía abierto y se audita', function () {
    expect(loginAs('lparedes@andeshorizonte.pe')->status())->toBe(200);
    actingAsSeed('U03');
    $token = iamTokens('U03');
    $opportunities = withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->where('owner_id', iamUserRow('U03')->id)->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida'])->count());
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/iam/users/U03/deactivate', ['reason' => 'Dejó la agencia'])->assertOk();
    $user = iamUserRow('U03');

    expect($token)->toBeGreaterThan(0)
        ->and($user->status)->toBe('inactivo')
        ->and($user->deactivated_reason)->toBe('Dejó la agencia')
        ->and($user->deactivated_at)->not->toBeNull()
        ->and(iamTokens('U03'))->toBe(0)
        ->and(iamUserAudit('U03', 'desactivar'))->toBeTrue()
        ->and(collect($response->json('meta.warnings'))->contains(fn (string $warning) => str_contains($warning, "{$opportunities} oportunidades")))->toBe($opportunities > 0);
    expect(loginAs('lparedes@andeshorizonte.pe'))->toBeApiError(401);
    expect($this->postJson('/api/v1/iam/users/U03/deactivate', ['reason' => 'Otra vez']))->toBeApiError(409, 'USER_INACTIVE');
});

it('USR-BR-06/07: nadie se desactiva a sí mismo y el motivo es obligatorio', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/iam/users/U01/deactivate', ['reason' => 'Me voy']))->toBeApiError(403, 'USR-BR-06');
    $this->postJson('/api/v1/iam/users/U03/deactivate', [])->assertStatus(422)->assertJsonValidationErrors('reason');
    expect(iamUserRow('U03')->status)->toBe('activo');
});

it('reactivar a un usuario con contraseña lo deja activo y vuelve a entrar', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U12')->update(['password' => bcrypt((string) config('demo.password'))]));
    expect(loginAs('rtito@andeshorizonte.pe'))->toBeApiError(401);

    $this->postJson('/api/v1/iam/users/U12/activate')->assertOk();
    $user = iamUserRow('U12');

    expect($user->status)->toBe('activo')
        ->and($user->deactivated_at)->toBeNull()
        ->and($user->deactivated_reason)->toBeNull()
        ->and(iamUserAudit('U12', 'reactivar'))->toBeTrue();
    expect(loginAs('rtito@andeshorizonte.pe')->status())->toBe(200);
    expect($this->postJson('/api/v1/iam/users/U12/activate'))->toBeApiError(409, 'USER_ACTIVE');
});

it('reactivar a quien nunca definió contraseña lo devuelve a pendiente', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U12')->update(['password' => null]));

    $this->postJson('/api/v1/iam/users/U12/activate')->assertOk();

    expect(iamUserRow('U12')->status)->toBe('pendiente');
});

it('USR-BR-10: reiniciar la MFA borra el factor, cierra sesiones, avisa al usuario y obliga a configurarla de nuevo al entrar', function () {
    Queue::fake();
    actingAsSeed('U01');
    $id = iamUserRow('U02')->id;

    $this->postJson('/api/v1/iam/users/U02/reset-mfa', ['reason' => 'Cambió de teléfono'])->assertOk();

    expect(withinTenant(tenantA(), fn () => DB::table('iam_mfa_factors')->where('user_id', $id)->exists()))->toBeFalse()
        ->and((bool) iamUserRow('U02')->mfa_enabled)->toBeFalse()
        ->and(iamTokens('U02'))->toBe(0)
        ->and(iamUserAudit('U02', 'resetear_mfa'))->toBeTrue();
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail) => $mail->to === 'rsalazar@andeshorizonte.pe' && str_contains($mail->subject, 'verificación en dos pasos'));

    $login = loginAs('rsalazar@andeshorizonte.pe')->assertOk();
    expect($login->json('data.mfa_required'))->toBeTrue()
        ->and($login->json('data.mfa_enrolled'))->toBeFalse();
    useToken($login->json('data.token'));
    expect($this->getJson('/api/v1/me'))->toBeApiError(403);
    expect($this->postJson('/api/v1/auth/mfa/verify', ['code' => '123456']))->toBeApiError(422, 'MFA_NOT_ENROLLED');
    $this->postJson('/api/v1/me/mfa/enroll')->assertOk()->assertJsonStructure(['data' => ['secret', 'otpauth_uri']]);
});

it('USR-BR-10: nadie reinicia su propia MFA y el motivo es obligatorio', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/iam/users/U01/reset-mfa', ['reason' => 'Prueba']))->toBeApiError(403, 'USR-BR-10');
    $this->postJson('/api/v1/iam/users/U02/reset-mfa', [])->assertStatus(422)->assertJsonValidationErrors('reason');
    expect((bool) iamUserRow('U02')->mfa_enabled)->toBeTrue();
});

it('reenviar la invitación vence el enlace anterior y manda uno nuevo; solo a pendientes', function () {
    Queue::fake();
    actingAsSeed('U01');
    $code = iamInvite()->json('data.code');
    $id = iamUserRow($code)->id;

    $this->postJson("/api/v1/iam/users/{$code}/resend-invitation")->assertOk();
    $invitations = withinTenant(tenantA(), fn () => DB::table('iam_user_invitations')->where('user_id', $id)->orderBy('id')->get());

    expect($invitations)->toHaveCount(2)
        ->and(now()->greaterThanOrEqualTo($invitations[0]->expires_at))->toBeTrue()
        ->and(now()->lessThan($invitations[1]->expires_at))->toBeTrue()
        ->and((int) $invitations[1]->resent_count)->toBe(1)
        ->and(iamUserAudit($code, 'reenviar_invitacion'))->toBeTrue();
    Queue::assertPushed(SendPlainMail::class, 2);
    expect($this->postJson('/api/v1/iam/users/U03/resend-invitation'))->toBeApiError(409, 'USER_NOT_PENDING');
});

it('solo quien administra usuarios invita, edita, desactiva, reactiva o reinicia la MFA', function (string $method, string $uri, array $body) {
    actingAsSeed('U02');

    expect($this->json($method, $uri, $body, critical()))->toBeApiError(403);
})->with([
    ['POST', '/api/v1/iam/users', ['name' => 'X', 'email' => 'x@andeshorizonte.pe', 'role' => 'sales', 'sede_id' => '01a1b4f8-5057-707f-98c2-04c20ef71894']],
    ['PATCH', '/api/v1/iam/users/U03', ['name' => 'X', 'role' => 'sales', 'sede_id' => '01a1b4f8-5057-707f-98c2-04c20ef71894']],
    ['POST', '/api/v1/iam/users/U03/deactivate', ['reason' => 'Prueba']],
    ['POST', '/api/v1/iam/users/U12/activate', []],
    ['POST', '/api/v1/iam/users/U04/reset-mfa', ['reason' => 'Prueba']],
    ['POST', '/api/v1/iam/users/U03/resend-invitation', []],
]);

it('un usuario inexistente responde 404', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/iam/users/U99/deactivate', ['reason' => 'Prueba']))->toBeApiError(404);
});

it('la sede del usuario debe existir y estar activa', function (string $case) {
    actingAsSeed('U01');
    $sede = match ($case) {
        'inexistente' => '01a1b4f8-0000-7000-8000-000000000000',
        'inactiva' => (function () {
            $code = test()->postJson('/api/v1/iam/sedes', ['name' => 'Sede cerrada', 'address' => 'Calle 1'])->json('data.code');
            test()->postJson("/api/v1/iam/sedes/{$code}/deactivate")->assertOk();

            return idOf('iam_sedes', $code);
        })(),
    };

    iamInvite(['sede_id' => $sede])->assertStatus(422)->assertJsonValidationErrors('sede_id');
    $this->patchJson('/api/v1/iam/users/U03', ['name' => 'Lucía Paredes', 'role' => 'sales', 'sede_id' => $sede])->assertStatus(422)->assertJsonValidationErrors('sede_id');
    expect(iamUserRow('U03')->sede_id)->toBe(idOf('iam_sedes', 'SED-03'));
})->with(['inexistente', 'inactiva']);

it('las opciones marcan qué roles exigen dos pasos y la invitación puede exigirlos a cualquier rol', function () {
    Queue::fake();
    actingAsSeed('U01');

    $roles = collect($this->getJson('/api/v1/iam/users')->assertOk()->json('meta.roles'))->keyBy('code');
    expect($roles['tenant_admin']['mfa'])->toBeTrue()->and($roles['sales']['mfa'])->toBeFalse();

    iamInvite(['require_mfa' => true])->assertCreated();
    expect((bool) iamUserByEmail('rccori@andeshorizonte.pe')->mfa_required)->toBeTrue();
});
