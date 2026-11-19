<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

it('el mapa de procesos cuenta cada etapa con los datos reales de la agencia', function () {
    actingAsSeed('U01');

    $map = $this->getJson('/api/v1/reports/process-map')->assertOk()->json('data');
    $stages = collect($map['stages'])->keyBy('id');

    $counts = withinTenant(tenantA(), fn () => [
        'leads' => DB::table('crm_leads')->whereNull('deleted_at')->whereIn('status', ['nuevo', 'contactado', 'calificado'])->count(),
        'opportunities' => DB::table('crm_opportunities')->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida'])->count(),
        'quotes' => DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', ['borrador', 'enviada', 'vista', 'negociacion'])->count(),
        'reservations' => DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['borrador', 'cancelada', 'completada'])->count(),
        'receivables' => DB::table('fin_receivables')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'pagada'])->count(),
    ]);

    expect($stages->keys()->all())->toBe(['lead', 'opportunity', 'quote', 'reservation', 'operation', 'collection'])
        ->and($map['scope'])->toBe('tenant')
        ->and($stages['lead']['value'])->toBe($counts['leads'])
        ->and($stages['opportunity']['value'])->toBe($counts['opportunities'])
        ->and($stages['quote']['value'])->toBe($counts['quotes'])
        ->and($stages['reservation']['value'])->toBe($counts['reservations'])
        ->and($stages['collection']['value'])->toBe($counts['receivables'])
        ->and($stages['collection']['amount'])->toBeGreaterThan(0)
        ->and($map['conversion'])->toHaveKeys(['lead_to_opportunity', 'opportunity_to_quote', 'opportunity_win', 'quote_to_reservation']);

    foreach ($map['stages'] as $stage) {
        expect($stage)->toHaveKeys(['title', 'description', 'href', 'value', 'value_label', 'facts', 'alert'])
            ->and($stage['href'])->toStartWith('/');
    }
});

it('ventas ve el mapa solo con su cartera', function () {
    $seller = actingAsSeed('U03');

    $map = $this->getJson('/api/v1/reports/process-map')->assertOk()->json('data');
    $own = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->where('owner_id', $seller->getKey())->whereIn('status', ['nuevo', 'contactado', 'calificado'])->count());
    $all = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->whereIn('status', ['nuevo', 'contactado', 'calificado'])->count());

    expect($map['scope'])->toBe('own')
        ->and(collect($map['stages'])->firstWhere('id', 'lead')['value'])->toBe($own)
        ->and($own)->toBeLessThan($all);
});

it('el mapa de procesos exige el permiso de reportes', function () {
    actingAsSeed('U14');

    expect($this->getJson('/api/v1/reports/process-map'))->toBeApiError(403);
});
