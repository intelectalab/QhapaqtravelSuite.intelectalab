<?php

use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

it('el inicio de la consola resume agencias, ingresos, planes y alertas con los datos reales', function () {
    actingAsPlatform();

    $home = $this->getJson('/api/v1/platform/home')->assertOk()->json('data');
    $platform = DB::connection('pgsql_platform');
    $status = $platform->table('tenants')->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

    expect($home)->toHaveKeys(['tenants', 'mrr', 'arr', 'arpa', 'mrr_change', 'series', 'failed', 'plans', 'alerts', 'activity'])
        ->and($home['tenants']['total'])->toBe((int) $status->sum())
        ->and($home['tenants']['active'])->toBe((int) ($status['activo'] ?? 0))
        ->and($home['tenants']['suspended'])->toBe((int) ($status['suspendido'] ?? 0))
        ->and(collect($home['plans'])->sum('tenants'))->toBe($platform->table('tenants')->whereNotNull('plan_id')->count())
        ->and(collect($home['plans'])->pluck('rank')->all())->toBe(collect($home['plans'])->pluck('rank')->sort()->values()->all());

    foreach ($home['alerts'] as $alert) {
        expect($alert)->toHaveKeys(['tone', 'kind', 'title', 'detail', 'href'])
            ->and($alert['href'])->toStartWith('/plataforma');
    }
});

it('una agencia suspendida aparece entre las alertas del inicio de la consola', function () {
    DB::connection('pgsql_platform')->table('tenants')->where('id', tenantB()->getKey())->update(['status' => 'suspendido', 'suspend_reason' => 'Falta de pago', 'suspended_at' => now()]);
    actingAsPlatform();

    $alerts = collect($this->getJson('/api/v1/platform/home')->assertOk()->json('data.alerts'));
    $name = (string) DB::connection('pgsql_platform')->table('tenants')->where('id', tenantB()->getKey())->value('commercial_name');

    expect($alerts->firstWhere('title', "{$name} está suspendida"))->not->toBeNull()
        ->and($alerts->firstWhere('title', "{$name} está suspendida")['tone'])->toBe('mute');
});

it('el inicio de la consola no se abre con un usuario de agencia', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/platform/home'))->toBeApiError(403);
});
