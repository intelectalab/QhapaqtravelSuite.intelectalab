<?php

use App\Domain\Crm\Support\LoyaltySegments;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

function loyaltyRows(array $query = []): array
{
    return test()->getJson('/api/v1/crm/loyalty/segments'.($query === [] ? '' : '?'.http_build_query($query)))->assertOk()->json('data');
}

it('la segmentación lista a cada cliente de la cartera con compras, destinos, NPS y propuesta de recompra', function () {
    actingAsSeed('U02');

    $rows = loyaltyRows();
    $clients = withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->count());
    $buyer = collect($rows)->first(fn (array $row): bool => $row['purchases'] > 0);

    expect($rows)->toHaveCount($clients)
        ->and($buyer)->not->toBeNull()
        ->and($buyer['last_purchase_date'])->not->toBeNull()
        ->and($buyer['total_pen'])->toBeGreaterThan(0)
        ->and($buyer['proposal']['amount'])->toBe($buyer['average_pen'])
        ->and($buyer['proposal']['stage'])->toBe('calificacion')
        ->and($buyer['proposal']['currency'])->toBe('PEN')
        ->and($buyer['proposal']['title'])->toStartWith("Recompra — {$buyer['name']} — ");
});

it('la propuesta sugiere el destino según lo que el cliente ya visitó y 4 000 soles si no compró', function () {
    actingAsSeed('U02');

    foreach (loyaltyRows() as $row) {
        $expected = collect(LoyaltySegments::SUGGESTIONS)->first(fn (string $next, string $place): bool => in_array($place, $row['destinations'], true)) ?? LoyaltySegments::DEFAULT_SUGGESTION;
        expect($row['proposal']['destination'])->toBe($expected);

        if ($row['purchases'] === 0) {
            expect($row['proposal']['amount'])->toBe(LoyaltySegments::DEFAULT_AMOUNT)->and($row['days_since'])->toBeNull();
        }
    }
});

it('filtra por segmento, última compra y destino visitado (CRM-BR-46)', function () {
    actingAsSeed('U02');
    $all = collect(loyaltyRows());
    $segment = (string) $all->pluck('segment')->filter()->first();

    expect(collect(loyaltyRows(['filter' => ['segment' => $segment]]))->pluck('segment')->unique()->all())->toBe([$segment])
        ->and(collect(loyaltyRows(['filter' => ['last_purchase' => 'none']]))->every(fn (array $row): bool => $row['days_since'] === null))->toBeTrue()
        ->and(collect(loyaltyRows(['filter' => ['last_purchase' => '90']]))->every(fn (array $row): bool => $row['days_since'] > 90))->toBeTrue();

    $place = $all->pluck('destinations')->flatten()->first();
    if ($place !== null) {
        expect(collect(loyaltyRows(['filter' => ['destination' => $place]]))->every(fn (array $row): bool => in_array($place, $row['destinations'], true)))->toBeTrue();
    }

    expect($this->getJson('/api/v1/crm/loyalty/segments?filter[last_purchase]=45'))->toBeApiError(422);
});

it('Ventas solo ve su cartera y la propuesta queda a su nombre', function () {
    $seller = actingAsSeed('U03');
    $own = withinTenant(tenantA(), fn () => Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $seller)->pluck('code')->sort()->values()->all());
    $rows = collect(loyaltyRows());

    expect($rows->pluck('code')->sort()->values()->all())->toBe($own)
        ->and($rows->every(fn (array $row): bool => $row['proposal']['owner_id'] === $seller->id))->toBeTrue();

    $foreign = withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->whereNotIn('code', $own)->value('code'));
    expect($this->getJson("/api/v1/crm/clients/{$foreign}/rebuy-proposal"))->toBeApiError(403);
});

it('la precarga de recompra trae la propuesta y las oportunidades abiertas del cliente', function () {
    actingAsSeed('U02');
    $row = collect(loyaltyRows())->firstWhere('has_open_opportunity', true) ?? collect(loyaltyRows())->first();

    $data = $this->getJson("/api/v1/crm/clients/{$row['code']}/rebuy-proposal")->assertOk()->json('data');

    expect($data['client']['code'])->toBe($row['code'])
        ->and($data['proposal'])->toBe($row['proposal'])
        ->and($data['open_opportunities'])->toBe($row['open_opportunities']);

    expect($this->getJson('/api/v1/crm/clients/CLI-9999/rebuy-proposal'))->toBeApiError(404);
});

it('con oportunidades abiertas la recompra pide confirmación y deja la acción de fidelización auditada', function () {
    actingAsSeed('U02');
    $row = collect(loyaltyRows())->firstWhere('has_open_opportunity', true);
    expect($row)->not->toBeNull();

    withinTenant(tenantA(), function () use ($row) {
        $client = DB::table('crm_clients')->where('code', $row['code'])->first(['id', 'code']);
        $segments = app(LoyaltySegments::class);

        expect(fn () => $segments->guard($client, []))->toThrow(ApiException::class);
        $segments->guard($client, ['confirm_open' => true]);
        $segments->record($client->code, 'OPP-9999');

        expect(DB::table('audit_events')->where('entity', 'Cliente')->where('entity_id', $client->code)->where('action', 'accion_fidelizacion')->value('after_value'))->toBe('oportunidad OPP-9999');
    });
});

it('Finanzas no ve la segmentación ni la precarga de recompra', function () {
    actingAsSeed('U07');

    expect($this->getJson('/api/v1/crm/loyalty/segments'))->toBeApiError(403)
        ->and($this->getJson('/api/v1/crm/clients/CLI-0002/rebuy-proposal'))->toBeApiError(403);
});
