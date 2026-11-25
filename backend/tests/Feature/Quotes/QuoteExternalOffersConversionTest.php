<?php

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Integrations\Contracts\TravelInventory;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Fake\FakeTravelInventory;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    withinTenant(tenantA(), fn () => DB::table('catalog_dynamic_price_rules')->update(['active' => false]));
    $this->code = 'COT-2026-00188';
    actingAsSeed('U03');
});

function gdsOffer(string $code, string $kind = 'hotel'): array
{
    $criteria = $kind === 'aereo' ? ['kind' => 'aereo', 'origin' => 'Lima', 'destination' => 'Cusco'] : ['kind' => 'hotel', 'destination' => 'Cusco', 'pax' => 2];
    $offer = test()->postJson("/api/v1/quotes/{$code}/external-offers/search", $criteria)->assertOk()->json('data.results.0');
    $state = test()->postJson("/api/v1/quotes/{$code}/external-offers", ['provider' => $offer['provider'], 'offer_ref' => $offer['offer_ref']], critical())->assertOk()->json('data');

    return collect($state['external_offers'])->firstWhere('offer_ref', $offer['offer_ref']);
}

function gdsConvert(string $code, ?string $key = null)
{
    $quote = rowOf('quote_quotes', $code);

    return test()->postJson("/api/v1/quotes/{$code}/convert", [], critical((int) $quote->lock_version, $key ?? idem('gds')));
}

function gdsOfferRow(string $id): object
{
    return withinTenant(tenantA(), fn () => DB::table('quote_external_offers')->where('id', $id)->first());
}

function gdsAudited(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => $entity, 'entity_id' => $code, 'action' => $action])->exists());
}

it('GET /quotes/{id}/external-offers lista las ofertas con el estado de la regla y del proveedor, y otro tenant recibe 404', function () {
    $offer = gdsOffer($this->code);

    $state = $this->getJson("/api/v1/quotes/{$this->code}/external-offers")->assertOk()->json('data');
    expect($state['external_offers'])->toHaveCount(1)
        ->and($state['external_offers'][0]['id'])->toBe($offer['id'])
        ->and($state['external_offers'][0]['can_hold'])->toBeTrue()
        ->and($state['external_offers'][0]['can_remove'])->toBeTrue()
        ->and($state['rule_enabled'])->toBeTrue()
        ->and($state['available'])->toBeTrue()
        ->and($state['external_total'])->toBe($offer['sell_amount']);

    actingAsTenantBAdmin();
    $this->getJson("/api/v1/quotes/{$this->code}/external-offers")->assertNotFound()->assertJsonPath('error', 'RESOURCE_NOT_FOUND');
});

it('SC-01: con R-GDS-OFFERS apagada se consultan y quitan las ofertas, pero buscar, añadir y retener responden 403 RULE_NOT_IN_PLAN', function () {
    $offer = gdsOffer($this->code);
    withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', 'R-GDS-OFFERS')->update(['enabled' => false]));
    RuleResolver::invalidate(tenantA()->getKey());

    expect($this->getJson("/api/v1/quotes/{$this->code}/external-offers")->assertOk()->json('data.rule_enabled'))->toBeFalse();
    expect($this->postJson("/api/v1/quotes/{$this->code}/external-offers/search", ['kind' => 'hotel', 'destination' => 'Cusco']))->toBeApiError(403, 'RULE_NOT_IN_PLAN');
    $this->postJson("/api/v1/quotes/{$this->code}/external-offers/{$offer['id']}/hold")->assertForbidden()->assertJsonPath('code', 'RULE_NOT_IN_PLAN')->assertJsonPath('required_permissions', ['quotes.external_offers']);
    $this->deleteJson("/api/v1/quotes/{$this->code}/external-offers/{$offer['id']}")->assertNoContent();
});

it('POST /external-offers/{offerId}/hold retiene la oferta en el proveedor, alarga su vencimiento y queda auditado', function () {
    $offer = gdsOffer($this->code, 'aereo');

    $held = collect($this->postJson("/api/v1/quotes/{$this->code}/external-offers/{$offer['id']}/hold")->assertOk()->json('data.external_offers'))->firstWhere('id', $offer['id']);

    expect($held['status'])->toBe('retenida')
        ->and($held['can_hold'])->toBeFalse()
        ->and(strtotime($held['offer_expires_at']))->toBeGreaterThan(strtotime($offer['offer_expires_at']) + 3600)
        ->and(gdsAudited('Cotización', $this->code, 'retener_oferta'))->toBeTrue();

    $this->postJson("/api/v1/quotes/{$this->code}/external-offers/{$offer['id']}/hold")->assertOk();
    expect(gdsOfferRow($offer['id'])->status)->toBe('retenida');
});

it('SC-16: al convertir, las ofertas se emiten en el proveedor y su costo entra como servicio confirmado de la reserva', function () {
    $hotel = gdsOffer($this->code);
    $flight = gdsOffer($this->code, 'aereo');
    $this->postJson("/api/v1/quotes/{$this->code}/external-offers/{$flight['id']}/hold")->assertOk();
    $quote = approvedQuote($this->code);
    $version = withinTenant(tenantA(), fn () => DB::table('quote_versions')->where('id', $quote->current_version_id)->first());
    $external = bcadd($hotel['sell_amount'], $flight['sell_amount'], 2);

    $preview = $this->getJson("/api/v1/quotes/{$this->code}/conversion-preview")->assertOk()->json('data');
    expect(collect($preview['checks'])->firstWhere('key', 'external_offers')['ok'])->toBeTrue()
        ->and($preview['total'])->toBe(bcadd((string) $version->grand_total, $external, 2));

    $key = idem('gds-conv');
    $code = gdsConvert($this->code, $key)->assertCreated()->json('data.code');
    $reservation = rowOf('booking_reservations', $code);
    $services = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotNull('confirmation_code')->whereNull('product_id')->get());
    $receivables = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', $reservation->id)->sum('amount'));

    expect($services)->toHaveCount(2)
        ->and($services->pluck('status')->unique()->all())->toBe(['confirmado'])
        ->and(bcadd((string) $services->sum('price_amount'), '0', 2))->toBe($external)
        ->and($services->firstWhere('service_kind', 'alojamiento'))->not->toBeNull()
        ->and(bcadd((string) $reservation->total_amount, '0', 2))->toBe(bcadd((string) $version->grand_total, $external, 2))
        ->and(bcadd((string) $receivables, '0', 2))->toBe(bcadd((string) $reservation->total_amount, '0', 2));

    foreach ([$hotel, $flight] as $offer) {
        $row = gdsOfferRow($offer['id']);
        expect($row->status)->toBe('emitida')
            ->and($row->reservation_id)->toBe($reservation->id)
            ->and($services->pluck('confirmation_code'))->toContain($row->pnr);
    }
    expect(gdsAudited('Reserva', $code, 'emitir_oferta'))->toBeTrue();

    expect(gdsConvert($this->code, $key)->json('data.code'))->toBe($code);
    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotNull('confirmation_code')->whereNull('product_id')->count()))->toBe(2);
    expect($this->deleteJson("/api/v1/quotes/{$this->code}/external-offers/{$hotel['id']}"))->toBeApiError(422);
});

it('SC-16: convertir con una oferta vencida responde 422 OFFER_EXPIRED sin crear la reserva; al quitarla se convierte', function () {
    $offer = gdsOffer($this->code);
    approvedQuote($this->code);
    withinTenant(tenantA(), fn () => DB::table('quote_external_offers')->where('id', $offer['id'])->update(['offer_expires_at' => now()->subMinute()]));

    expect(collect($this->getJson("/api/v1/quotes/{$this->code}/conversion-preview")->assertOk()->json('data.checks'))->firstWhere('key', 'external_offers')['ok'])->toBeFalse();
    expect(gdsConvert($this->code))->toBeApiError(422, 'OFFER_EXPIRED');
    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('quote_id', rowOf('quote_quotes', $this->code)->id)->exists()))->toBeFalse()
        ->and(rowOf('quote_quotes', $this->code)->status)->toBe('aprobada');

    $state = $this->getJson("/api/v1/quotes/{$this->code}/external-offers")->assertOk()->json('data.external_offers.0');
    expect($state['status'])->toBe('vencida')->and($state['can_remove'])->toBeTrue()->and($state['can_hold'])->toBeFalse();

    $this->deleteJson("/api/v1/quotes/{$this->code}/external-offers/{$offer['id']}")->assertNoContent();
    gdsConvert($this->code)->assertCreated();
});

it('SC-16: si el proveedor no emite, la conversión responde 422 OFFER_ISSUE_FAILED, no crea nada, audita el fallo y deja quitar la oferta para convertir', function () {
    $offer = gdsOffer($this->code);
    approvedQuote($this->code);
    app()->instance(TravelInventory::class, new class implements TravelInventory
    {
        private FakeTravelInventory $fake;

        public function __construct()
        {
            $this->fake = new FakeTravelInventory;
        }

        public function search(array $criteria): array
        {
            return $this->fake->search($criteria);
        }

        public function find(string $provider, string $offerRef): ?array
        {
            return $this->fake->find($provider, $offerRef);
        }

        public function hold(string $provider, string $offerRef): AdapterResult
        {
            return $this->fake->hold($provider, $offerRef);
        }

        public function issue(string $provider, string $offerRef, string $idempotencyKey): AdapterResult
        {
            return AdapterResult::transient('Tarifa no disponible');
        }

        public function void(string $provider, string $reference): AdapterResult
        {
            return $this->fake->void($provider, $reference);
        }

        public function healthcheck(): AdapterResult
        {
            return $this->fake->healthcheck();
        }
    });

    expect(gdsConvert($this->code))->toBeApiError(422, 'OFFER_ISSUE_FAILED');
    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('quote_id', rowOf('quote_quotes', $this->code)->id)->exists()))->toBeFalse()
        ->and(rowOf('quote_quotes', $this->code)->status)->toBe('aprobada')
        ->and(gdsOfferRow($offer['id'])->status)->toBe('cotizada')
        ->and(auditExists(['entity' => 'Cotización', 'entity_id' => $this->code, 'action' => 'emitir_oferta_fallida']))->toBeTrue();

    $this->deleteJson("/api/v1/quotes/{$this->code}/external-offers/{$offer['id']}")->assertNoContent();
    gdsConvert($this->code)->assertCreated();
});

it('sin GDS real en producción no se inventan ofertas: la ficha lo informa y buscar responde 409 INTEGRATION_UNAVAILABLE', function () {
    config(['integrations.require_real' => true]);

    $state = $this->getJson("/api/v1/quotes/{$this->code}/external-offers")->assertOk()->json('data');
    expect($state['available'])->toBeFalse()
        ->and($state['unavailable_message'])->not->toBeNull();
    expect($this->postJson("/api/v1/quotes/{$this->code}/external-offers/search", ['kind' => 'hotel', 'destination' => 'Cusco']))->toBeApiError(409, 'INTEGRATION_UNAVAILABLE');
});
