<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('el administrador mantiene los feriados del libro y el cambio queda auditado', function () {
    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data');
    $year = substr($data['today'], 0, 4);
    $current = collect($data['holidays']);
    $new = ['date' => "{$year}-12-26", 'name' => 'Feriado de prueba'];

    $this->putJson('/api/v1/crm/claim-book/settings', ['holidays' => [...$current->all(), $new]])->assertOk();
    $after = collect($this->getJson('/api/v1/crm/claim-book')->json('data.holidays'));

    expect($after->firstWhere('date', $new['date'])['name'] ?? null)->toBe('Feriado de prueba')
        ->and($after)->toHaveCount($current->count() + 1);

    $this->putJson('/api/v1/crm/claim-book/settings', ['holidays' => $current->all()])->assertOk();
    $audit = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('action', 'actualizar_feriados')->count());

    expect(collect($this->getJson('/api/v1/crm/claim-book')->json('data.holidays'))->firstWhere('date', $new['date']))->toBeNull()
        ->and($audit)->toBe(2);
});

it('no acepta la misma fecha dos veces ni quita feriados de años anteriores', function () {
    actingAsSeed('U01');
    $past = withinTenant(tenantA(), function (): string {
        DB::table('sys_holidays')->updateOrInsert(['date' => '2020-07-28'], ['name' => 'Fiestas Patrias 2020']);

        return '2020-07-28';
    });

    expect($this->putJson('/api/v1/crm/claim-book/settings', ['holidays' => [['date' => '2026-12-08', 'name' => 'Inmaculada'], ['date' => '2026-12-08', 'name' => 'Repetido']]]))->toBeApiError(422);

    $this->putJson('/api/v1/crm/claim-book/settings', ['holidays' => []])->assertOk();

    expect(withinTenant(tenantA(), fn () => DB::table('sys_holidays')->where('date', $past)->exists()))->toBeTrue();
});

it('el portal muestra la respuesta y la constancia de cada hoja del cliente', function () {
    actingAsSeed('U14');
    $claims = collect($this->getJson('/api/v1/portal/client/profile')->assertOk()->json('data.claims'));

    expect($this->getJson('/api/v1/portal/client/profile')->json('data.claims_book'))->toContain('/libro-reclamaciones');

    if ($claims->isEmpty()) {
        $this->markTestSkipped('El cliente de la demo no tiene hojas.');
    }

    $claim = $claims->first();
    expect($claim)->toHaveKeys(['response', 'receipt', 'book_status'])
        ->and($claim['receipt'])->toHaveKeys(['agency', 'sede', 'consumer', 'good', 'detail', 'request']);

    $answered = $claims->firstWhere('book_status', 'answered');
    if ($answered !== null) {
        expect($answered['response']['text'])->not->toBeEmpty();
    }
});
