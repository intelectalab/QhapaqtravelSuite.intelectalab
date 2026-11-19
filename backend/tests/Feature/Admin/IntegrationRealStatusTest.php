<?php

use App\Domain\Integrations\Mail\AgencyMailbox;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockScheduledJobs();
    Queue::fake();
});

function adapterCard(string $code): array
{
    return collect(test()->getJson('/api/v1/integrations?page[size]=50')->assertOk()->json('data'))->firstWhere('code', $code);
}

it('el correo sembrado como activo sale por validar mientras la agencia no conecte su cuenta', function () {
    actingAsSeed('U01');

    $email = adapterCard('INT-03');

    expect($email['status'])->toBe('por_validar')
        ->and($email['environment'])->toBe('sandbox')
        ->and($email['status_reason'])->toContain('correo');
});

it('el correo sale activo cuando la agencia tiene su cuenta conectada y verificada', function () {
    $mailbox = Mockery::mock(AgencyMailbox::class);
    $mailbox->shouldReceive('active')->andReturn(true);
    app()->instance(AgencyMailbox::class, $mailbox);
    actingAsSeed('U01');

    $email = adapterCard('INT-03');

    expect($email['status'])->toBe('activo')->and($email['status_reason'])->toBeNull();
});

it('mapas no tiene proveedor y una pasarela de prueba nunca figura como activa', function () {
    config(['integrations.drivers.payments' => 'fake']);
    withinTenant(tenantA(), fn () => DB::table('integration_adapters')->where('code', 'INT-02')->update(['status' => 'activo']));
    actingAsSeed('U01');

    expect(adapterCard('INT-05')['status'])->toBe('futuro')
        ->and(adapterCard('INT-02')['status'])->toBe('sandbox')
        ->and(adapterCard('INT-02')['status_label'])->toBe('En pruebas');

    $kpis = $this->getJson('/api/v1/integrations?page[size]=50')->assertOk()->json('meta.kpis');
    expect($kpis['active'])->toBe(0);
});

it('no se puede pasar a producción el correo sin la cuenta de la agencia', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('integration_adapters')->where('code', 'INT-03')->update(['environment' => 'sandbox']));

    expect($this->patchJson('/api/v1/integrations/INT-03/config', ['environment' => 'production', 'max_retries' => 5, 'backoff_base_s' => 60, 'timeout_s' => 30]))->toBeApiError(422, 'INT-BR-02');
});
