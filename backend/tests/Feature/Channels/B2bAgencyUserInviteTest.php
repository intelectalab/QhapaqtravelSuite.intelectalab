<?php

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

function activeB2bAgencyCode(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->whereNull('deleted_at')->where('status', 'activa')->where('valid_to', '>=', now()->toDateString())->orderBy('code')->value('code'));
}

it('la agencia invita a una persona de su aliada al portal con el rol b2b', function () {
    Mail::fake();
    $code = activeB2bAgencyCode();
    actingAsSeed('U01');

    $data = $this->postJson("/api/v1/channels/b2b/agencies/{$code}/users", ['name' => 'Rosa Huamán', 'email' => 'rosa.huaman@aliada.test', 'phone' => '+51 984 222 333'])->assertOk()->json('data');

    expect($data['invited']['status'])->toBe('pendiente')
        ->and(collect($data['users'])->pluck('email'))->toContain('rosa.huaman@aliada.test');

    $user = withinTenant(tenantA(), fn () => DB::table('iam_users')->where('email', 'rosa.huaman@aliada.test')->first(['id', 'agency_id']));
    $agencyId = withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('code', $code)->value('id'));
    $roles = withinTenant(tenantA(), fn () => User::query()->findOrFail($user->id)->getRoleNames()->all());

    expect($user->agency_id)->toBe($agencyId)->and($roles)->toBe(['b2b'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Agencia B2B', 'entity_id' => $code, 'action' => 'invitar_usuario'])->exists()))->toBeTrue();
});

it('no invita con un correo que ya usa otro usuario', function () {
    Mail::fake();
    $code = activeB2bAgencyCode();
    actingAsSeed('U01');
    $taken = (string) withinTenant(tenantA(), fn () => DB::table('iam_users')->orderBy('code')->value('email'));

    expect($this->postJson("/api/v1/channels/b2b/agencies/{$code}/users", ['name' => 'Otra Persona', 'email' => $taken]))->toBeApiError(422, 'USR-BR-01');
});

it('una aliada bloqueada no recibe invitaciones', function () {
    $code = activeB2bAgencyCode();
    withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('code', $code)->update(['status' => 'bloqueada', 'block_reason' => 'manual']));
    actingAsSeed('U01');

    expect($this->postJson("/api/v1/channels/b2b/agencies/{$code}/users", ['name' => 'Rosa Huamán', 'email' => 'rosa2@aliada.test']))->toBeApiError(409, 'B2B-BR-18');
});

it('sin el permiso de usuarios no se puede invitar', function () {
    $code = activeB2bAgencyCode();
    actingAsSeed('U03');

    $this->postJson("/api/v1/channels/b2b/agencies/{$code}/users", ['name' => 'Rosa Huamán', 'email' => 'rosa3@aliada.test'])->assertForbidden();
});
