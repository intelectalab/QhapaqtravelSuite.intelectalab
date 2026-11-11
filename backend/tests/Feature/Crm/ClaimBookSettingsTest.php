<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function claimBookSettings(): object
{
    return withinTenant(tenantA(), fn () => DB::table('crm_claim_book_settings')->first(['response_days', 'alert_days', 'retention_years']));
}

it('el libro trae el correlativo de cada sede con su siguiente número', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data');
    $lima = collect($data['sequences'])->firstWhere('sede', 'Lima — Miraflores');
    $year = substr($data['today'], 0, 4);

    expect($data['sequences'])->not->toBeEmpty()
        ->and($lima['next'])->toStartWith("LR-LIM-{$year}-")
        ->and(strlen($lima['next']))->toBe(strlen("LR-LIM-{$year}-000000"));

    $sede = withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('name', 'Lima — Miraflores')->value('id'));
    $this->postJson('/api/v1/crm/claim-book', [
        'sede_id' => $sede,
        'type' => 'queja',
        'consumer_name' => 'Rocío Valdivia Paz',
        'consumer_doc_type' => 'DNI',
        'consumer_doc_number' => '41553200',
        'consumer_email' => 'rocio.valdivia@correo.pe',
        'consumer_address' => 'Av. Larco 345, Miraflores',
        'email_consent' => true,
        'good_kind' => 'Servicio',
        'good_description' => 'City tour Lima colonial',
        'detail' => 'El tour salió una hora tarde y no se visitó la Catedral.',
        'request' => 'Devolución parcial del servicio.',
    ], critical())->assertCreated();

    $after = collect($this->getJson('/api/v1/crm/claim-book')->json('data.sequences'))->firstWhere('sede', 'Lima — Miraflores');
    expect($after['last'])->toBe($lima['next'])
        ->and($after['year_count'])->toBe($lima['year_count'] + 1);
});

it('el administrador cambia los parámetros del libro, se aplican a las hojas nuevas y queda auditado', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/crm/claim-book/settings', ['response_days' => 10, 'alert_days' => 2, 'retention_years' => 5])->assertOk()->assertJsonPath('data.response_days', 10);

    $settings = claimBookSettings();
    expect((int) $settings->response_days)->toBe(10)
        ->and((int) $settings->alert_days)->toBe(2)
        ->and((int) $settings->retention_years)->toBe(5)
        ->and($this->getJson('/api/v1/crm/claim-book')->json('data.settings.response_days'))->toBe(10)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Libro de reclamaciones', 'entity_id' => 'configuracion', 'action' => 'actualizar'])->exists()))->toBeTrue();
});

it('valida los parámetros y la alerta debe llegar antes del vencimiento', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/crm/claim-book/settings', ['response_days' => 40, 'alert_days' => 12, 'retention_years' => 1])->assertStatus(422)->assertJsonValidationErrors(['response_days', 'alert_days', 'retention_years']);
    $this->putJson('/api/v1/crm/claim-book/settings', ['response_days' => 5, 'alert_days' => 5, 'retention_years' => 2])->assertStatus(422)->assertJsonValidationErrors(['alert_days']);

    expect((int) claimBookSettings()->response_days)->toBe(15);
});

it('Gerencia gestiona hojas pero no cambia los parámetros del libro', function () {
    actingAsSeed('U02');

    $this->getJson('/api/v1/crm/claim-book')->assertOk()->assertJsonPath('data.can.settings', false);
    $this->putJson('/api/v1/crm/claim-book/settings', ['response_days' => 10, 'alert_days' => 2, 'retention_years' => 5])->assertForbidden()->assertJsonPath('required_permissions', ['admin.settings.manage']);

    expect((int) claimBookSettings()->response_days)->toBe(15);
});
