<?php

declare(strict_types=1);

namespace App\Domain\Growth\Marketplace;

use App\Domain\Admin\Support\ApiKeyActor;
use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Booking\Events\ReservationCreated;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\Support\DirectBookingPlan;
use App\Domain\Booking\Support\ReservationAssembler;
use App\Domain\Booking\Support\ReservationReceivables;
use App\Domain\Catalog\Support\RateResolver;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\InventoryLock;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MarketplaceBooking
{
    public const CHANNEL = 'B2B';

    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $tenantDb,
        private readonly InventoryLock $inventory,
        private readonly DirectBookingPlan $plans,
        private readonly ReservationAssembler $assembler,
        private readonly ReservationReceivables $receivables,
        private readonly SyncServicePayables $payables,
        private readonly SequenceService $sequences,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
    ) {}

    public function client(string $reference, User $actor): object
    {
        return Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $actor)
            ->where(Str::isUuid($reference) ? 'id' : 'code', $reference)
            ->first(['id', 'code', 'name'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un cliente de tu cartera.', ['client_id' => ['Elige un cliente de tu cartera.']]);
    }

    public function book(array $sale, User $actor): array
    {
        $home = $this->context->tenant();
        $me = (string) $home->getKey();
        $seller = (string) $sale['listing']->seller_tenant_id;

        try {
            $setup = $this->tenantDb->run($seller, fn (): array => $this->setup($sale));

            if ($setup['reason'] !== null) {
                return ['status' => 'rechazada', 'reason' => $setup['reason']];
            }

            $this->context->set($seller);
            $departures = $setup['departure'] === null ? [] : [(string) $setup['departure']->id];
            $sold = $this->inventory->withLocks('departure', $departures, fn (): array => $this->tenantDb->run($seller, fn (): array => $this->sellerReservation($sale, $setup)));

            if ($sold['reason'] !== null) {
                return ['status' => 'rechazada', 'reason' => $sold['reason']];
            }

            $mirror = $this->tenantDb->run($me, fn (): Reservation => $this->mirrorReservation($sale, $sold, $actor));

            return ['status' => 'confirmada', 'reason' => null, 'seller' => $sold['reservation'], 'reseller' => $mirror];
        } finally {
            $this->tenantDb->apply(DB::connection(), $me);
            $this->context->set($home);
        }
    }

    private function setup(array $sale): array
    {
        $product = $this->plans->product((string) $sale['listing']->product_ref);
        $pax = (int) $sale['pax'];

        if ($product->maximum_passengers !== null && $pax > (int) $product->maximum_passengers) {
            throw ApiException::unprocessable('RES-BR-06', "Este producto admite hasta {$product->maximum_passengers} pasajeros por reserva.", ['pax' => ["Máximo {$product->maximum_passengers} pasajeros."]]);
        }

        $departure = null;

        if ($product->availability_model === 'POR_SALIDA') {
            $departure = DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', $sale['travel_date'])
                ->whereNotIn('status', ['cerrada', 'cancelada'])->orderBy('departure_time')->first(['id', 'ref', 'capacity', 'sold']);

            if ($departure === null) {
                return ['reason' => 'La agencia que vende no tiene una salida abierta para esa fecha.'];
            }

            if ((int) $departure->capacity - (int) $departure->sold < $pax) {
                return ['reason' => $this->noRoom((int) $departure->capacity - (int) $departure->sold)];
            }
        }

        return ['reason' => null, 'product' => $product, 'departure' => $departure, 'owner' => $this->owner($sale)];
    }

    private function sellerReservation(array $sale, array $setup): array
    {
        $pax = (int) $sale['pax'];
        $departure = $setup['departure'];

        if ($departure !== null) {
            $row = $this->inventory->lockRows('catalog_product_departures', [(string) $departure->id])[(string) $departure->id];
            $free = (int) $row->capacity - (int) $row->sold;

            if ($free < $pax) {
                return ['reason' => $this->noRoom($free)];
            }
        }

        $owner = User::query()->findOrFail($setup['owner']);
        $product = $setup['product'];
        $listing = $sale['listing'];
        $currency = (string) $listing->currency;
        $fx = $this->fx($currency);
        $net = $sale['gross']->minus($sale['commission']);
        $client = $this->agencyClient($sale['reseller'], $owner);
        $date = (string) $sale['travel_date'];
        $days = $product->duration_unit === 'días' ? max(1, (int) ceil((float) $product->duration_value)) : 1;
        $until = Carbon::parse($date)->addDays($days - 1)->toDateString();
        $policies = (array) (DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund', 'penalty_tiers']) ?? []);
        $version = DB::table('catalog_product_versions')->where('product_id', $product->id)->orderByDesc('created_at')->value('version');
        $resellerName = (string) $sale['reseller']->commercial_name;

        $reservation = new Reservation;
        $reservation->forceFill([
            'code' => $this->sequences->next('reservation'),
            'client_id' => $client->id,
            'owner_id' => $owner->getKey(),
            'sede_id' => $this->assembler->sedeFor((string) $owner->getKey(), $owner),
            'title' => mb_substr("{$product->name} — {$resellerName}", 0, 200),
            'status' => ReservationStatus::Confirmada->value,
            'channel' => self::CHANNEL,
            'travel_from' => $date,
            'travel_to' => $until,
            'currency' => $currency,
            'fx_rate' => $fx,
            'total_amount' => (string) $net,
            'snapshot_label' => mb_substr($product->code.($version ? " v{$version}" : '')." · Marketplace {$sale['code']}", 0, 300),
            'catalog_snapshot' => ['product' => $product->code, 'name' => $product->name, 'pax' => ['adt' => $pax, 'chd' => 0, 'inf' => 0], 'marketplace' => $this->terms($sale, $resellerName, 'reseller')],
            'policies_snapshot' => [$product->code => $policies],
            'notes' => "Venta del marketplace {$sale['code']}: {$resellerName} vendió {$pax} pax a {$currency} {$sale['gross']}. Comisión del revendedor {$currency} {$sale['commission']}.",
            'created_by' => $owner->getKey(),
            'updated_by' => $owner->getKey(),
        ]);
        $reservation->save();

        $item = (object) [
            'id' => null,
            'product_id' => $product->id,
            'qty' => 1,
            'pax' => $pax,
            'unit_price' => (string) $net->dividedBy($pax, 6, RoundingMode::HALF_UP),
            'unit_cost' => $this->unitCost((string) $product->id, $date, $currency, $fx),
            'service_date' => $date,
        ];
        $this->assembler->addServices($reservation, $item, $departure?->id, '0', $currency, $fx, $product->main_provider_id, 0, $owner, $departure !== null);
        $this->assembler->placeholders($reservation, $pax, 0, 0);
        $this->receivables->create($reservation, $owner, $net);
        $this->payables->handle((string) $reservation->id, $owner);
        $this->audit->log('Reserva', $reservation->code, 'crear_marketplace', null, "confirmada · {$sale['code']} · {$resellerName} · {$currency} {$net} · {$pax} pax", actor: $owner);
        $this->publish($reservation, $owner);

        return ['reason' => null, 'reservation' => $reservation, 'travel_to' => $until];
    }

    private function mirrorReservation(array $sale, array $sold, User $actor): Reservation
    {
        $sellerReservation = $sold['reservation'];
        $listing = $sale['listing'];
        $client = $sale['client'];
        $pax = (int) $sale['pax'];
        $currency = (string) $listing->currency;
        $fx = $this->fx($currency);
        $date = (string) $sale['travel_date'];
        $net = $sale['gross']->minus($sale['commission']);
        $ownerId = ApiKeyActor::owner($actor);
        $sellerName = (string) $sale['seller']->commercial_name;
        $title = (string) $listing->title;

        $reservation = new Reservation;
        $reservation->forceFill([
            'code' => $this->sequences->next('reservation'),
            'client_id' => $client->id,
            'owner_id' => $ownerId,
            'sede_id' => $this->assembler->sedeFor($ownerId, $actor),
            'title' => mb_substr("{$title} — {$client->name}", 0, 200),
            'status' => ReservationStatus::Confirmada->value,
            'channel' => $this->assembler->channelFor((string) $client->id),
            'travel_from' => $date,
            'travel_to' => $sold['travel_to'],
            'currency' => $currency,
            'fx_rate' => $fx,
            'total_amount' => (string) $sale['gross'],
            'snapshot_label' => mb_substr("Marketplace {$sale['code']} · {$sellerName} · {$title}", 0, 300),
            'catalog_snapshot' => ['product' => null, 'name' => $title, 'pax' => ['adt' => $pax, 'chd' => 0, 'inf' => 0], 'marketplace' => [...$this->terms($sale, $sellerName, 'seller'), 'seller_reservation' => $sellerReservation->code]],
            'policies_snapshot' => [],
            'notes' => "Venta del marketplace {$sale['code']}: opera {$sellerName} con la reserva {$sellerReservation->code}. Le pagas {$currency} {$net}.",
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $reservation->save();

        DB::table('booking_reservation_services')->insert([
            'tenant_id' => $this->context->idOrFail(),
            'reservation_id' => $reservation->id,
            'code' => sprintf('RS-%d%02d', SequenceService::numberOf($reservation->code), 1),
            'name' => mb_substr("{$title} ({$pax} pax)", 0, 200),
            'service_date' => $date,
            'pax' => $pax,
            'status' => 'confirmado',
            'currency' => $currency,
            'fx_rate' => $fx,
            'cost_amount' => (string) $net,
            'price_amount' => (string) $sale['gross'],
            'is_required' => true,
            'service_kind' => 'libre',
            'requires_assignment' => false,
            'confirmation_code' => $sellerReservation->code,
            'confirmed_by_name' => mb_substr($sellerName, 0, 150),
            'confirmed_at' => now(),
            'requested_at' => now(),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $this->assembler->placeholders($reservation, $pax, 0, 0);
        $this->receivables->create($reservation, $actor, $sale['gross']);
        $this->audit->log('Reserva', $reservation->code, 'crear_marketplace', null, "confirmada · {$sale['code']} · {$sellerName} · {$currency} {$sale['gross']} · {$pax} pax", actor: $actor);
        $this->publish($reservation, $actor);

        return $reservation;
    }

    private function terms(array $sale, string $partner, string $role): array
    {
        return [
            'order' => $sale['code'],
            $role => $partner,
            'gross_amount' => (string) $sale['gross'],
            'commission_pct' => (string) $sale['partnership']->commission_pct,
            'commission_amount' => (string) $sale['commission'],
            'net_amount' => (string) $sale['gross']->minus($sale['commission']),
        ];
    }

    private function owner(array $sale): string
    {
        foreach ([$sale['listing']->created_by ?? null, $sale['partnership']->decided_by ?? null] as $candidate) {
            if ($candidate !== null && DB::table('iam_users')->where('id', $candidate)->whereNull('deleted_at')->where('status', 'activo')->exists()) {
                return (string) $candidate;
            }
        }

        throw ApiException::conflict('MKT-OWNER', 'La agencia que vende no tiene un responsable activo para recibir la reserva.');
    }

    private function agencyClient(object $reseller, User $owner): object
    {
        $existing = DB::table('crm_clients')->whereNull('deleted_at')->where('doc_type', 'RUC')->where('doc_number', (string) $reseller->ruc)->first(['id', 'code', 'name']);

        if ($existing !== null) {
            return $existing;
        }

        $code = $this->codes->next('crm_clients', 'CLI-');
        $id = (string) DB::table('crm_clients')->insertGetId([
            'code' => $code,
            'kind' => 'empresa',
            'name' => mb_substr((string) ($reseller->legal_name ?: $reseller->commercial_name), 0, 200),
            'doc_type' => 'RUC',
            'doc_number' => (string) $reseller->ruc,
            'email' => Str::lower((string) $reseller->admin_email),
            'country' => (string) ($reseller->country ?: 'Perú'),
            'segment_code' => 'B2B',
            'owner_id' => $owner->getKey(),
            'tags' => '{Marketplace}',
            'created_by' => $owner->getKey(),
            'updated_by' => $owner->getKey(),
        ]);
        $this->audit->log('Cliente', $code, 'crear_desde_marketplace', after: "{$reseller->commercial_name} · B2B", actor: $owner);

        return (object) ['id' => $id, 'code' => $code, 'name' => $reseller->commercial_name];
    }

    private function unitCost(string $productId, string $date, string $currency, string $fx): string
    {
        $rate = RateResolver::pick(DB::table('catalog_rates')->where('product_id', $productId)->get(['segment', 'channel', 'rate_type', 'status', 'valid_from', 'valid_to', 'price', 'cost', 'currency']), $date, ['Adulto', 'Pasajero'], self::CHANNEL);

        if (! is_object($rate)) {
            return '0';
        }

        return (string) Decimal::convert((string) ($rate->cost ?? '0'), trim((string) $rate->currency), $currency, $fx);
    }

    private function fx(string $currency): string
    {
        if ($currency === 'PEN') {
            return '1';
        }

        $rate = DB::table('fin_fx_rates')->where('currency_code', $currency)->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen')
            ?? throw ApiException::unprocessable('FX_MISSING', "No hay tipo de cambio registrado para {$currency}.");

        return (string) BigDecimal::of((string) $rate)->toScale(6, RoundingMode::HALF_UP);
    }

    private function noRoom(int $free): string
    {
        return $free > 0 ? "La agencia que vende solo tiene {$free} cupos para esa fecha." : 'La agencia que vende ya no tiene cupos para esa fecha.';
    }

    private function publish(Reservation $reservation, User $actor): void
    {
        $id = (string) $reservation->getKey();
        $tenantId = $this->context->idOrFail();
        $payload = ['reservation_id' => $id, 'reservation_code' => $reservation->code, 'origin' => 'marketplace'];
        $this->outbox->add('booking_reservation', $id, 'ReservationCreated', $payload);
        $this->outbox->add('booking_reservation', $id, 'ReservationConfirmed', $payload);
        ReservationCreated::dispatch($tenantId, $id, $reservation->code, null, (string) $actor->getKey());
        ReservationConfirmed::dispatch($tenantId, $id, $reservation->code, null, (string) $actor->getKey());
    }
}
