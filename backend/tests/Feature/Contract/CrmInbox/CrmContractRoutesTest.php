<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/Support.php';

it('lista los viajes de postventa con su encuesta asociada', function () {
    actingAsSeed('U01');

    $response = $this->getJson('/api/v1/crm/after-sales/trips')->assertOk();

    expect($response->json('meta.total'))->toBe(count($response->json('data')))
        ->and($response->json('meta'))->toHaveKey('without_survey');
});

it('lista las encuestas con estadísticas NPS y pagina por cursor', function () {
    actingAsSeed('U01');

    $response = $this->getJson('/api/v1/crm/surveys?page[size]=2')->assertOk();

    expect($response->json('meta.stats'))->toHaveKeys(['nps', 'average', 'promoters', 'passives', 'detractors', 'distribution'])
        ->and(count($response->json('meta.stats.distribution')))->toBe(11)
        ->and(count($response->json('data')))->toBeLessThanOrEqual(2);
});

it('filtra los casos por estado y muestra el detalle con su bitácora', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('status', 'abierta')->orderBy('code')->value('code'));

    $list = $this->getJson('/api/v1/crm/cases?filter[status]=abierta&page[size]=100')->assertOk();
    expect(collect($list->json('data'))->pluck('status')->unique()->all())->toBe(['abierta'])
        ->and(collect($list->json('data'))->pluck('code'))->toContain($code);

    $this->getJson("/api/v1/crm/cases/{$code}")->assertOk()->assertJsonPath('data.code', $code)->assertJsonStructure(['data' => ['log']]);
    $this->getJson('/api/v1/crm/cases/PV-NO-EXISTE')->assertNotFound();
});

it('Ventas no ve el caso de otro asesor: 403 SEC-BR-09', function () {
    $sales = seedUser('U03');
    $code = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('owner_id', '<>', $sales->getKey())->orderBy('code')->value('code'));
    expect($code)->not->toBeNull();
    actingAsSeed('U03');

    expect($this->getJson("/api/v1/crm/cases/{$code}"))->toBeApiError(403, 'SEC-BR-09');
    expect(collect($this->getJson('/api/v1/crm/cases?page[size]=100')->assertOk()->json('data'))->pluck('code'))->not->toContain($code);
});

it('lista las etapas del embudo con su probabilidad por defecto', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/crm/pipeline-stages')->assertOk()->json('data');

    expect($data)->not->toBeEmpty()
        ->and($data[0])->toHaveKeys(['code', 'name', 'default_probability', 'is_closed']);
});

it('detecta duplicados duros por documento y blandos por correo', function () {
    actingAsSeed('U01');
    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->whereNotNull('email_norm')->orderBy('code')->first(['code', 'doc_type', 'doc_number', 'email_norm']));

    $this->getJson('/api/v1/crm/clients/duplicates?doc_type='.$client->doc_type.'&doc_number='.$client->doc_number)
        ->assertOk()->assertJsonPath('data.hard.code', $client->code)->assertJsonPath('meta.blocking', true);
    $this->getJson('/api/v1/crm/clients/duplicates?email='.urlencode($client->email_norm).'&exclude='.$client->code)
        ->assertOk()->assertJsonPath('data.hard', null);
    $soft = $this->getJson('/api/v1/crm/clients/duplicates?email='.urlencode($client->email_norm))->assertOk()->json('data.soft');
    expect(collect($soft)->pluck('code'))->toContain($client->code);
});

it('la ruta del cliente sigue resolviendo un código normal', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/crm/clients/CLI-0002')->assertOk()->assertJsonPath('data.code', 'CLI-0002');
});

it('genera la vista previa firmada del comprobante y del voucher del cliente', function () {
    actingAsSeed('U01');

    $invoice = $this->getJson('/api/v1/crm/clients/CLI-0002/invoices/F001-00001482/preview')->assertOk();
    expect($invoice->json('data'))->toHaveKeys(['document_id', 'file_name', 'expires_at']);
    expect(crmInboxAudited(['action' => 'solicitar_pdf', 'entity_id' => 'F001-00001482']))->toBeTrue();

    $voucher = $this->getJson('/api/v1/crm/clients/CLI-0002/vouchers/VOU-2026-01204/preview')->assertOk();
    expect($voucher->json('data'))->toHaveKeys(['document_id', 'file_name']);

    $this->getJson('/api/v1/crm/clients/CLI-0003/invoices/F001-00001482/preview')->assertNotFound();
});

it('reasigna el cliente, audita y responde la ficha', function () {
    actingAsSeed('U01');
    $target = seedUser('U04');
    $before = rowOf('crm_clients', 'CLI-0002');
    expect($before->owner_id)->not->toBe($target->getKey());

    $this->postJson('/api/v1/crm/clients/CLI-0002/reassign', ['owner_id' => $target->getKey(), 'note' => 'Cambio de cartera'])
        ->assertOk()->assertJsonPath('data.code', 'CLI-0002');

    expect(rowOf('crm_clients', 'CLI-0002')->owner_id)->toBe($target->getKey())
        ->and(crmInboxAudited(['action' => 'reasignar', 'entity_id' => 'CLI-0002']))->toBeTrue();

    $this->postJson('/api/v1/crm/clients/CLI-0002/reassign', ['owner_id' => $target->getKey()])->assertStatus(422);
});

it('Ventas no reasigna clientes: 403 con el permiso requerido', function () {
    actingAsSeed('U03');

    $response = $this->postJson('/api/v1/crm/clients/CLI-0002/reassign', ['owner_id' => seedUser('U04')->getKey()]);

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('crm.records.reassign');
});
