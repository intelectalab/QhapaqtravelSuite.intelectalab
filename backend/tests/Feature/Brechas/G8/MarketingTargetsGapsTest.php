<?php

use Illuminate\Support\Facades\DB;

function g8LastTest(string $campaign): object
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_campaign_tests')->where('campaign_id', rowOf('mkt_campaigns', $campaign)->id)->orderByDesc('sent_at')->first());
}

it('el envío de prueba va al destinatario interno elegido con un contacto de ejemplo', function () {
    actingAsSeed('U01');
    $other = seedUser('U02');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', ['to_user_id' => $other->id, 'sample' => 'CLI-0001'], critical())
        ->assertCreated()->assertJsonPath('data.sent_to', $other->email);

    $test = g8LastTest('CMP-0012');
    expect($test->to_user_id)->toBe($other->id)
        ->and($test->to_address)->toBe($other->email)
        ->and($test->sample_subject_type)->toBe('client')
        ->and($test->sample_subject_id)->toBe(rowOf('crm_clients', 'CLI-0001')->id);
});

it('el envío de prueba rechaza destinatarios y contactos que no existen', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', ['to_user_id' => 'no-es-uuid'], critical())->assertStatus(422)->assertJsonValidationErrors('to_user_id');
    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', ['to_user_id' => '01900000-0000-7000-8000-000000000000'], critical())->assertStatus(422)->assertJsonValidationErrors('to_user_id');
    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', ['sample' => 'CLI-9999'], critical())->assertStatus(422)->assertJsonValidationErrors('sample');
});

it('la vista de campañas ofrece destinatarios internos y contactos de ejemplo', function () {
    actingAsSeed('U01');

    $options = $this->getJson('/api/v1/marketing/campaigns')->assertOk()->json('data.test_options');
    expect($options['recipients'])->not->toBeEmpty()
        ->and($options['samples'])->not->toBeEmpty()
        ->and($options['recipients'][0])->toHaveKeys(['value', 'label', 'email', 'phone']);
});

it('activar una meta de asesor le avisa al asesor', function () {
    actingAsSeed('U01');
    $target = rowOf('crm_sales_targets', 'MET-0013');

    $this->postJson('/api/v1/crm/sales-targets/MET-0013/activate', [], critical((int) $target->lock_version))->assertOk();

    $notices = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'meta.asignada')->where('source_id', $target->id)->get());

    if ($target->scope_type === 'asesor') {
        expect($notices->where('channel', 'portal')->pluck('recipient_user_id'))->toContain($target->scope_id);
    } else {
        expect($notices)->toBeEmpty();
    }
});

it('la ficha de la meta trae el ranking del período', function () {
    actingAsSeed('U02');

    $detail = $this->getJson('/api/v1/crm/sales-targets/MET-0013')->assertOk()->json('data');
    expect($detail)->toHaveKey('ranking')->and($detail['ranking'])->toBeArray();
});

it('las aprobaciones muestran la línea de impacto y el alcance del rol', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/approvals')->assertOk()->json('data');
    expect($data['viewer'])->toHaveKeys(['role', 'scope'])
        ->and(collect($data['items'])->every(fn (array $item): bool => array_key_exists('impact', $item)))->toBeTrue()
        ->and(collect($data['items'])->whereNotNull('impact'))->not->toBeEmpty();
});
