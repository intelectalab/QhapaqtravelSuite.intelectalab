<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class DirectBookingPlan
{
    public const CHANNELS = ['Directo', 'Corporativo', 'B2B', 'E-commerce'];

    private const DEPARTURE_WINDOW_DAYS = 120;

    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantBookingEngine $engines,
        private readonly ReservationAssembler $assembler,
    ) {}

    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->timezone())->startOfDay();
    }

    public function product(string $reference): object
    {
        $product = DB::table('catalog_products')->whereNull('deleted_at')
            ->where(self::isUuid($reference) ? 'id' : 'code', $reference)
            ->first(['id', 'code', 'name', 'status', 'is_bookable', 'availability_model', 'duration_value', 'duration_unit', 'booking_advance_min_days', 'maximum_passengers', 'main_provider_id'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un producto.', ['product_id' => ['Elige un producto.']]);

        if ($product->status !== 'ACTIVE' || ! $product->is_bookable) {
            throw ApiException::unprocessable('PRD-BR-002', "«{$product->name}» no está activo para reservar.", ['product_id' => ["«{$product->name}» no está activo para reservar."]]);
        }

        return $product;
    }

    public function build(array $data, User $actor, bool $requirePrice): array
    {
        $product = $this->product((string) $data['product_id']);
        $adults = (int) ($data['adt'] ?? 0);
        $children = (int) ($data['chd'] ?? 0);
        $infants = (int) ($data['inf'] ?? 0);
        $seats = $adults + $children;
        $today = $this->today();
        $perSeat = $product->availability_model === 'POR_SALIDA';
        $departures = $perSeat ? $this->departures((string) $product->id, $today) : [];

        if ($seats < 1) {
            throw ApiException::unprocessable('RES-BR-04', 'Indica al menos un adulto o un niño.', ['adt' => ['Indica al menos un adulto o un niño.']]);
        }

        if ($product->maximum_passengers !== null && $seats > (int) $product->maximum_passengers) {
            throw ApiException::unprocessable('RES-BR-06', "«{$product->name}» admite hasta {$product->maximum_passengers} pasajeros por reserva.", ['adt' => ["Máximo {$product->maximum_passengers} pasajeros."]]);
        }

        $departure = $perSeat ? $this->departure((string) $product->id, $data, $today) : null;
        $date = $departure !== null ? $departure->departure_date : ($data['date'] ?? null);
        $base = [
            'product' => ['code' => $product->code, 'name' => $product->name, 'model' => $product->availability_model, 'advance_min_days' => (int) $product->booking_advance_min_days, 'max_pax' => $product->maximum_passengers === null ? null : (int) $product->maximum_passengers],
            'departures' => $departures,
            'pax' => ['adt' => $adults, 'chd' => $children, 'inf' => $infants],
        ];

        if ($date === null) {
            if ($requirePrice) {
                throw ApiException::unprocessable('RES-BR-06', $perSeat ? 'Elige una salida.' : 'Elige la fecha del servicio.', [$perSeat ? 'departure_id' : 'date' => [$perSeat ? 'Elige una salida.' : 'Elige la fecha del servicio.']]);
            }

            return [...$base, 'priced' => false];
        }

        $date = CarbonImmutable::parse((string) $date, $today->getTimezone())->startOfDay();
        if (! $perSeat && $date->lessThan($today->addDays((int) $product->booking_advance_min_days))) {
            $days = (int) $product->booking_advance_min_days;
            throw ApiException::unprocessable('RES-BR-06', "«{$product->name}» se reserva con al menos {$days} ".($days === 1 ? 'día' : 'días').' de anticipación.', ['date' => ['La fecha no cumple la anticipación mínima.']]);
        }

        if ($date->lessThan($today)) {
            throw ApiException::unprocessable('RES-BR-06', 'La fecha no puede ser pasada.', ['date' => ['La fecha no puede ser pasada.']]);
        }

        $client = isset($data['client_id']) ? DB::table('crm_clients')->whereNull('deleted_at')->where(self::isUuid((string) $data['client_id']) ? 'id' : 'code', $data['client_id'])->value('id') : null;
        $channel = (string) ($data['channel'] ?? ($client ? $this->assembler->channelFor((string) $client) : 'Directo'));
        $price = $this->price((string) $product->id, $date->toDateString(), $channel, $adults, $children);
        $free = $departure ? (int) $departure->capacity - (int) $departure->sold : null;
        $available = $departure === null || $free >= $seats;
        $days = $product->duration_unit === 'días' ? max(1, (int) ceil((float) $product->duration_value)) : 1;

        return [
            ...$base,
            'priced' => true,
            'product_id' => (string) $product->id,
            'main_provider_id' => $product->main_provider_id,
            'channel' => $channel,
            'date' => $date->toDateString(),
            'travel_from' => $date->toDateString(),
            'travel_to' => $date->addDays($days - 1)->toDateString(),
            'departure' => $departure ? ['id' => $departure->id, 'ref' => $departure->ref, 'time' => $departure->departure_time ? substr((string) $departure->departure_time, 0, 5) : null, 'free' => $free] : null,
            'currency' => $price['currency'],
            'fx_rate' => $this->fx($price['currency']),
            'adult_price' => (string) $price['adult'],
            'child_price' => $children > 0 ? (string) $price['child'] : null,
            'total' => (string) $price['total'],
            'cost' => (string) $price['cost'],
            'available' => $available,
            'note' => $departure === null
                ? 'Se pide al proveedor y queda sujeto a su confirmación.'
                : ($available ? "Salida {$departure->ref}: quedan {$free} cupos." : "Salida {$departure->ref}: solo quedan ".max(0, $free).' cupos.'),
        ];
    }

    public function view(array $plan, User $viewer): array
    {
        unset($plan['product_id'], $plan['main_provider_id'], $plan['fx_rate']);

        if (! $viewer->can('finance.profitability') && ! $viewer->can('catalog.products.view_profitability')) {
            unset($plan['cost']);
        }

        return $plan;
    }

    private function departures(string $productId, CarbonImmutable $today): array
    {
        return DB::table('catalog_product_departures')->where('product_id', $productId)
            ->whereBetween('departure_date', [$today->toDateString(), $today->addDays(self::DEPARTURE_WINDOW_DAYS)->toDateString()])
            ->whereNotIn('status', ['cerrada', 'cancelada'])
            ->orderBy('departure_date')->orderBy('departure_time')
            ->get(['id', 'ref', 'departure_date', 'departure_time', 'capacity', 'sold'])
            ->map(fn (object $row): array => ['id' => $row->id, 'ref' => $row->ref, 'date' => $row->departure_date, 'time' => $row->departure_time ? substr((string) $row->departure_time, 0, 5) : null, 'free' => max(0, (int) $row->capacity - (int) $row->sold)])
            ->all();
    }

    private function departure(string $productId, array $data, CarbonImmutable $today): ?object
    {
        if (empty($data['departure_id']) && empty($data['date'])) {
            return null;
        }

        $query = DB::table('catalog_product_departures')->where('product_id', $productId)->where('departure_date', '>=', $today->toDateString());
        $departure = (! empty($data['departure_id']) ? $query->where('id', $data['departure_id']) : $query->where('departure_date', $data['date'])->orderBy('departure_time'))
            ->first(['id', 'ref', 'departure_date', 'departure_time', 'capacity', 'sold', 'status']);

        if ($departure === null || in_array($departure->status, ['cerrada', 'cancelada'], true)) {
            throw ApiException::unprocessable('RES-BR-06', 'No hay una salida abierta para esa fecha.', ['departure_id' => ['Elige una salida abierta.']]);
        }

        return $departure;
    }

    private function price(string $productId, string $date, string $channel, int $adults, int $children): array
    {
        $product = $this->engines->product($productId, $date);
        $currency = null;

        foreach ($product->rates as $rate) {
            if (in_array($rate['segment'] ?? '', ['Adulto', 'Pasajero'], true) && in_array($rate['channel'] ?? '', [$channel, 'Directo'], true)) {
                $currency = (string) $rate['currency'];
                break;
            }
        }

        $engine = $this->engines->engine();
        $adult = $currency === null ? null : $engine->segmentPrice($product, 'Adulto', $date, $currency, $channel);

        if ($adult === null) {
            throw ApiException::unprocessable('PRD-BR-005', 'El producto no tiene una tarifa vigente para esa fecha y canal.', ['date' => ['Sin tarifa vigente para esa fecha.']]);
        }

        $child = $children > 0 ? ($engine->segmentPrice($product, 'Niño', $date, $currency, $channel) ?? $adult) : $adult;
        $adultPrice = Decimal::round2($adult['price']->getAmount());
        $childPrice = Decimal::round2($child['price']->getAmount());

        return [
            'currency' => $currency,
            'adult' => $adultPrice,
            'child' => $childPrice,
            'total' => Decimal::round2($adultPrice->multipliedBy($adults)->plus($childPrice->multipliedBy($children))),
            'cost' => Decimal::round2($adult['cost']->getAmount()->multipliedBy($adults)->plus($child['cost']->getAmount()->multipliedBy($children))),
        ];
    }

    private function fx(string $currency): string
    {
        if ($currency === 'PEN') {
            return '1';
        }

        $rate = DB::table('fin_fx_rates')->where('currency_code', $currency)->orderByDesc('rate_date')->value('rate_pen');

        if ($rate === null) {
            throw ApiException::unprocessable('FX_MISSING', "No hay tipo de cambio registrado para {$currency}.");
        }

        return (string) BigDecimal::of((string) $rate)->toScale(6, RoundingMode::HALF_UP);
    }

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f-]{36}$/i', $value) === 1;
    }
}
