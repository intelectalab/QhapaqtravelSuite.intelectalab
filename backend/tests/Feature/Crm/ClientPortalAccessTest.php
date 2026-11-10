<?php

use App\Domain\Shared\Tenancy\TenantContext;
use App\Http\Middleware\IdempotencyMiddleware;
use App\Jobs\SendPlainMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

const PORTAL_PASSWORD = 'PortalCliente2026';

function portalClient(?string $email, ?string $phone = null): string
{
    actingAsSeed('U03');

    return (string) test()->postJson('/api/v1/crm/clients', [
        'kind' => 'persona',
        'name' => 'Inés Calderón Paz',
        'doc_type' => 'DNI',
        'doc_number' => (string) random_int(40000000, 79999999),
        'email' => $email,
        'phone' => $phone,
        'city' => 'Arequipa',
        'confirm_duplicate' => true,
    ])->assertCreated()->json('data.code');
}

function invitePortal(string $client, ?string $key = null)
{
    return test()->postJson("/api/v1/crm/clients/{$client}/portal-access", [], critical(null, $key));
}

function portalToken(string $email): string
{
    $job = Queue::pushed(SendPlainMail::class, fn (SendPlainMail $job) => $job->to === $email)->last();
    expect($job)->not->toBeNull();
    preg_match('#/invitacion/(\S+)#', $job->body, $match);

    return $match[1];
}

function portalInvitation(string $token)
{
    app(TenantContext::class)->clear();

    return withPlatformSeeingTenant(fn () => test()->getJson("/api/v1/auth/invitations/{$token}"));
}

function acceptPortal(string $token)
{
    app(TenantContext::class)->clear();

    test()->withoutMiddleware(IdempotencyMiddleware::class);

    try {
        return withPlatformSeeingTenant(fn () => test()->postJson("/api/v1/auth/invitations/{$token}/accept", ['password' => PORTAL_PASSWORD, 'password_confirmation' => PORTAL_PASSWORD]));
    } finally {
        app()->forgetInstance(IdempotencyMiddleware::class);
    }
}

function portalLogin(string $email)
{
    app('auth')->forgetGuards();
    app(TenantContext::class)->clear();

    return test()->postJson('/api/v1/auth/login', ['email' => $email, 'password' => PORTAL_PASSWORD, 'tenant_slug' => tenantA()->subdomain]);
}

function portalAudited(string $client, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Cliente')->where('entity_id', $client)->where('action', $action)->exists());
}

function portalAccessOf(string $client): array
{
    actingAsSeed('U03');

    return test()->getJson("/api/v1/crm/clients/{$client}")->assertOk()->json('data.portal_access');
}

it('invita al cliente, acepta la invitación, entra a /portal y solo ve lo suyo', function () {
    $email = 'ines.calderon@portal.pe';
    $client = portalClient($email);
    expect(portalAccessOf($client)['status'])->toBe('sin_acceso');

    $key = idem('portal');
    $first = invitePortal($client, $key)->assertCreated()->assertJsonPath('data.status', 'invitado')->assertJsonPath('data.email', $email);
    $replay = invitePortal($client, $key)->assertCreated();
    expect($replay->headers->get('Idempotent-Replayed'))->toBe('true')
        ->and($replay->json())->toBe($first->json())
        ->and(Queue::pushed(SendPlainMail::class, fn (SendPlainMail $job) => $job->to === $email))->toHaveCount(1)
        ->and(portalAudited($client, 'invitar_portal'))->toBeTrue();

    $user = withinTenant(tenantA(), fn () => DB::table('iam_users as u')->join('model_has_roles as m', 'm.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'm.role_id')
        ->where('u.email', $email)->first(['u.status', 'u.client_id', 'u.mfa_required', 'r.name as role']));
    expect($user->status)->toBe('pendiente')
        ->and($user->role)->toBe('customer')
        ->and($user->client_id)->toBe(idOf('crm_clients', $client))
        ->and($user->mfa_required)->toBeFalse();

    $token = portalToken($email);
    portalInvitation($token)->assertOk()->assertJsonPath('data.portal', true)->assertJsonPath('data.require_mfa', false);
    acceptPortal($token)->assertOk()->assertJsonPath('data.home', '/portal')->assertJsonPath('data.email', $email);

    $session = portalLogin($email)->assertOk()->assertJsonPath('data.home', '/portal')->json('data');
    useToken($session['token']);
    $this->getJson('/api/v1/portal/client/session')->assertOk()->assertJsonPath('data.role', 'customer')->assertJsonPath('data.client.code', $client);
    expect($this->getJson('/api/v1/portal/client/reservations')->assertOk()->json('data.trips'))->toBeEmpty();

    $foreign = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', idOf('crm_clients', 'CLI-0001'))->whereNull('deleted_at')->where('status', '<>', 'borrador')->value('code'));
    expect($foreign)->not->toBeNull();
    expect($this->getJson("/api/v1/portal/client/reservations/{$foreign}"))->toBeApiError(404);
    expect($this->getJson("/api/v1/crm/clients/{$client}")->status())->toBe(403);

    $access = portalAccessOf($client);
    expect($access['status'])->toBe('activo')
        ->and($access['last_login_at'])->not->toBeNull();
});

it('reenvía la invitación con un enlace nuevo y deja sin efecto el anterior', function () {
    $email = 'ines.reenvio@portal.pe';
    $client = portalClient($email);
    invitePortal($client)->assertCreated();
    $old = portalToken($email);

    expect(invitePortal($client))->toBeApiError(409, 'PORTAL_ACCESS_PENDING');

    $this->postJson("/api/v1/crm/clients/{$client}/portal-access/resend")->assertOk()->assertJsonPath('data.status', 'invitado');
    $new = portalToken($email);
    expect($new)->not->toBe($old)
        ->and(portalAudited($client, 'reenviar_invitacion_portal'))->toBeTrue();

    expect(acceptPortal($old))->toBeApiError(409, 'INVITATION_EXPIRED');
    acceptPortal($new)->assertOk();

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/crm/clients/{$client}/portal-access/resend"))->toBeApiError(409, 'PORTAL_NOT_PENDING');
});

it('revoca el acceso: desactiva el usuario sin borrarlo y le impide entrar', function () {
    $email = 'ines.revocar@portal.pe';
    $client = portalClient($email);
    invitePortal($client)->assertCreated();
    acceptPortal(portalToken($email))->assertOk();
    $session = portalLogin($email)->assertOk()->json('data');

    actingAsSeed('U03');
    $this->postJson("/api/v1/crm/clients/{$client}/portal-access/revoke", ['reason' => 'Lo pidió el cliente'])->assertOk()->assertJsonPath('data.status', 'revocado');

    $row = withinTenant(tenantA(), fn () => DB::table('iam_users')->where('email', $email)->first(['status', 'deleted_at', 'deactivated_reason']));
    expect($row->status)->toBe('inactivo')
        ->and($row->deleted_at)->toBeNull()
        ->and($row->deactivated_reason)->toBe('Lo pidió el cliente')
        ->and(portalAudited($client, 'revocar_portal'))->toBeTrue();

    expect(portalLogin($email))->toBeApiError(401);
    useToken($session['token']);
    expect($this->getJson('/api/v1/portal/client/session')->status())->toBe(401);

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/crm/clients/{$client}/portal-access/revoke"))->toBeApiError(409, 'PORTAL_NOT_GRANTED');
    $code = withinTenant(tenantA(), fn () => DB::table('iam_users')->where('email', $email)->value('code'));
    invitePortal($client)->assertCreated()->assertJsonPath('data.status', 'invitado')->assertJsonPath('data.user', $code);
});

it('rechaza clientes sin correo y correos del equipo o de otro cliente', function (?string $email, string $code) {
    $client = portalClient($email, '987 111 222');

    expect(invitePortal($client))->toBeApiError(422, $code);
    expect(portalAccessOf($client)['status'])->toBe('sin_acceso');
})->with([
    'sin correo' => [null, 'PORTAL_EMAIL_REQUIRED'],
    'correo del equipo' => ['lparedes@andeshorizonte.pe', 'PORTAL_EMAIL_TAKEN'],
    'correo de otro cliente' => ['gabriela.rios@correo.pe', 'PORTAL_EMAIL_TAKEN'],
]);

it('rechaza un correo que ya usa un usuario de otra agencia', function () {
    $email = (string) DB::connection('pgsql_platform')->table('iam_users')->where('tenant_id', tenantB()->getKey())->whereNull('deleted_at')->value('email');
    $client = portalClient($email);

    expect(invitePortal($client))->toBeApiError(422, 'PORTAL_EMAIL_TAKEN');
});

it('respeta los permisos y la cartera del asesor', function () {
    $client = portalClient('ines.permisos@portal.pe');

    actingAsSeed('U05');
    expect(invitePortal($client))->toBeApiError(403);
    actingAsSeed('U07');
    expect(invitePortal($client))->toBeApiError(403);
    actingAsSeed('U04');
    expect(invitePortal($client))->toBeApiError(403, 'SCOPE_OWNERSHIP');
    actingAsSeed('U14');
    expect(invitePortal($client)->status())->toBe(403);

    actingAsSeed('U02');
    invitePortal($client)->assertCreated();
});
