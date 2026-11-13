<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Booking\Data\BookingQuote;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\QuoteSelection;
use App\Domain\Booking\Data\RuleSet;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Catalog\Support\ProductQuotePreview;
use App\Domain\Shared\Errors\ApiException;
use Brick\Math\BigDecimal;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class SiteBooking
{
    public const EXTRA_KINDS = ['addon', 'lodging', 'surcharge', 'tour', 'transport'];

    public const REMOVABLE_PREFIXES = ['addon-', 'lodge-', 'tour-', 'trans-'];

    private const CHANNEL = 'E-commerce';

    private array $products = [];

    public const PER_SERVICE_BASIS = ['Precio fijo', 'Por grupo', 'Por unidad'];

    public function __construct(
        private readonly ProductBookingConfig $config,
        private readonly TenantBookingEngine $engine,
        private readonly RuleResolver $rules,
        private readonly SitePricing $pricing,
    ) {}

    public static function serviceUnits(stdClass $product, ?string $basis, array $pax): ?int
    {
        if (! in_array($basis, self::PER_SERVICE_BASIS, true) && $product->kind !== 'traslados') {
            return null;
        }

        return (int) ceil(((int) $pax['adt'] + (int) ($pax['chd'] ?? 0) + (int) ($pax['inf'] ?? 0)) / max(1, (int) $product->maximum_passengers));
    }

    public static function enginePax(array $pax, ?int $units): array
    {
        return $units === null ? $pax : ['adt' => $units, 'chd' => 0, 'inf' => 0];
    }

    public static function rules(): array
    {
        return [
            'addons' => ['nullable', 'array', 'max:30'],
            'addons.*.id' => ['required', 'string', 'max:20'],
            'addons.*.qty' => ['nullable', 'integer', 'min:1', 'max:99'],
            'lodging' => ['nullable', 'array', 'max:12'],
            'lodging.*.leg_id' => ['required', 'string', 'max:20'],
            'lodging.*.hotel_id' => ['required', 'string', 'max:20'],
            'lodging.*.rooms' => ['required', 'array', 'min:1', 'max:6'],
            'lodging.*.rooms.*.type' => ['required', 'string', 'max:20'],
            'lodging.*.rooms.*.qty' => ['required', 'integer', 'min:0', 'max:20'],
            'no_lodging' => ['nullable', 'boolean'],
            'options' => ['nullable', 'array', 'max:10'],
            'options.*.group' => ['required', 'string', 'max:80'],
            'options.*.label' => ['required', 'string', 'max:80'],
            'removed' => ['nullable', 'array', 'max:40'],
            'removed.*' => ['string', 'max:60'],
            'nights' => ['nullable', 'array', 'max:12'],
            'nights.*' => ['integer', 'between:1,30'],
            'tours' => ['nullable', 'array', 'max:40'],
            'tours.*' => ['required'],
            'tours.*.id' => ['sometimes', 'string', 'max:20'],
            'transport' => ['nullable', 'array', 'max:20'],
            'transport.*' => ['required'],
            'transport.*.id' => ['sometimes', 'string', 'max:20'],
        ];
    }

    public static function messages(): array
    {
        return [
            'addons.*' => 'Revisa los adicionales elegidos.',
            'lodging.*' => 'Revisa el alojamiento elegido.',
            'no_lodging.*' => 'Revisa el alojamiento elegido.',
            'options.*' => 'Revisa las opciones elegidas.',
            'removed.*' => 'Revisa los ítems quitados.',
            'nights.*' => 'Las noches por ciudad van de 1 a 30.',
            'tours.*' => 'Revisa los tours elegidos.',
            'transport.*' => 'Revisa la movilidad elegida.',
        ];
    }

    public static function extrasFrom(array $data): array
    {
        return [
            'addons' => (array) ($data['addons'] ?? []),
            'lodging' => (array) ($data['lodging'] ?? []),
            'no_lodging' => (bool) ($data['no_lodging'] ?? false),
            'options' => (array) ($data['options'] ?? []),
            'removed' => (array) ($data['removed'] ?? []),
            'nights' => (array) ($data['nights'] ?? []),
            'tours' => self::ids((array) ($data['tours'] ?? [])),
            'transport' => self::ids((array) ($data['transport'] ?? [])),
        ];
    }

    public static function decode(stdClass $row, string $removedColumn = 'removed_line_keys'): array
    {
        $options = (array) json_decode((string) ($row->options ?? '[]'), true);
        $removed = $row->{$removedColumn} ?? '{}';
        $trip = (array) json_decode((string) ($row->extras ?? '{}'), true);

        return [
            'addons' => (array) json_decode((string) ($row->addons ?? '[]'), true),
            'lodging' => (array) json_decode((string) ($row->lodging ?? '[]'), true),
            'no_lodging' => (bool) ($row->no_lodging ?? false),
            'options' => array_is_list($options) ? $options : [],
            'removed' => is_array($removed) ? $removed : array_values(array_filter(array_map(fn (string $key): string => trim($key, '"'), explode(',', trim((string) $removed, '{}'))))),
            'nights' => (array) ($trip['nights'] ?? []),
            'tours' => self::ids((array) ($trip['tours'] ?? [])),
            'transport' => self::ids((array) ($trip['transport'] ?? [])),
        ];
    }

    public static function tripJson(array $extras): string
    {
        return json_encode(['nights' => (object) ($extras['nights'] ?? []), 'tours' => array_values($extras['tours'] ?? []), 'transport' => array_values($extras['transport'] ?? [])], JSON_UNESCAPED_UNICODE) ?: '{}';
    }

    public static function ids(array $items): array
    {
        return array_values(array_unique(array_filter(array_map(fn (mixed $item): string => (string) (is_array($item) ? ($item['id'] ?? '') : $item), $items), fn (string $id): bool => $id !== '')));
    }

    public static function pgArray(array $values): string
    {
        return '{'.implode(',', array_map(fn (string $value): string => '"'.str_replace(['\\', '"', ',', '{', '}'], '', $value).'"', $values)).'}';
    }

    public function data(string $productId, string $date): ProductData
    {
        $key = $productId.'|'.$date;
        if (isset($this->products[$key])) {
            return $this->products[$key];
        }

        $base = $this->config->engineProduct($productId, $date);

        return $this->products[$key] = new ProductData(
            id: $base->id,
            code: $base->code,
            maxPax: $base->maxPax,
            ranges: $base->ranges,
            departures: $base->departures,
            hasAvailabilityConfig: $base->hasAvailabilityConfig,
            operatingWeekdays: $base->operatingWeekdays,
            cutoffHours: $base->cutoffHours,
            advanceMinDays: $base->advanceMinDays,
            paxRules: $base->paxRules,
            ruleOverrides: $base->ruleOverrides,
            ruleParams: $base->ruleParams,
            rates: $base->rates,
            addons: $base->addons,
            accommodation: $base->accommodation,
            options: $base->options !== [] ? $base->options : $this->optionGroups($productId),
            payment: $base->payment,
            trip: $base->trip,
        );
    }

    public function config(stdClass $product, string $date): array
    {
        $row = $this->config->product($product->id);
        $data = $this->data($product->id, $date);
        $set = $this->rules->forTenant();
        $payment = $this->config->payment($row, $set, $data);
        $legs = array_values(array_filter($data->accommodation['legs'] ?? [], fn (array $leg): bool => $leg['hotels'] !== []));
        $pickup = $this->config->pickup($row);

        return [
            'options' => array_map(fn (array $group): array => ['group' => $group['group'], 'options' => array_map(fn (array $option): array => ['label' => $option['label'], 'delta' => (string) $option['delta']], $group['options'])], $data->options),
            'addons' => $set->on('R-ADDONS', $data) ? array_map(fn (array $addon): array => [
                'id' => $addon['id'],
                'name' => $addon['name'],
                'category' => $addon['category'],
                'price' => $addon['price'],
                'currency' => $addon['currency'],
                'per' => $addon['per'],
                'applies_to' => $addon['appliesTo'],
                'optional' => $addon['optional'],
            ], $data->addons) : [],
            'lodging' => $set->on('R-LODGING', $data) && $legs !== [] ? [
                'optional' => (bool) DB::table('catalog_products')->where('id', $product->id)->value('accommodation_optional'),
                'currency' => (string) ($data->accommodation['currency'] ?? 'USD'),
                'note' => DB::table('catalog_products')->where('id', $product->id)->value('accommodation_note'),
                'nights' => array_sum(array_column($legs, 'nights')),
                'legs' => array_map(fn (array $leg): array => [
                    'id' => $leg['id'],
                    'city' => $leg['city'],
                    'nights' => (int) $leg['nights'],
                    'hotels' => array_map(fn (array $hotel): array => ['id' => $hotel['id'], 'name' => $hotel['name'], 'category' => $hotel['category'], 'rooms' => array_map(fn (array $room): array => ['type' => $room['type'], 'capacity' => (int) $room['capacity'], 'price' => (string) $room['price']], $hotel['rooms'])], $leg['hotels']),
                ], $legs),
            ] : null,
            'pickup' => $set->on('R-PICKUP', $data) && ($pickup['points'] !== [] || $pickup['required']) ? [
                'required' => $pickup['required'],
                'ask_flight' => $pickup['ask_flight'],
                'points' => array_map(fn (array $point): array => ['label' => $point['label'], 'kind' => $point['kind'], 'requires_address' => $point['requires_address']], $pickup['points']),
            ] : null,
            'payment' => [
                'modes' => $payment['effective_modes'],
                'deposit_pct' => (int) ($payment['values']['deposit_pct'] ?? $payment['tenant']['deposit_pct']),
                'balance_due_days' => (int) ($payment['values']['balance_due_days'] ?? $payment['tenant']['balance_due_days']),
                'hold_hours' => in_array('pagar_despues', $payment['effective_modes'], true) ? $payment['tenant']['hold_hours'] : null,
            ],
            'can_remove' => $set->on('R-PREVIEW-REMOVE', $data),
            'trip' => $this->tripConfig($data, $set, $legs),
        ];
    }

    private function tripConfig(ProductData $data, RuleSet $set, array $legs): ?array
    {
        if (! $set->on('R-TRIP-BUILDER', $data) || ! $set->on('R-LODGING', $data) || $legs === []) {
            return null;
        }

        $tours = collect($data->trip['tours'] ?? [])->groupBy('legId');
        $transport = collect($data->trip['transport'] ?? []);

        return [
            'currency' => (string) ($data->trip['currency'] ?? $data->accommodation['currency'] ?? 'USD'),
            'legs' => array_map(fn (array $leg): array => [
                'id' => $leg['id'],
                'city' => $leg['city'],
                'nights' => (int) $leg['nights'],
                'min_nights' => (int) ($leg['minNights'] ?? $leg['nights']),
                'max_nights' => (int) ($leg['maxNights'] ?? $leg['nights']),
                'seasonal' => collect($leg['hotels'])->contains(fn (array $hotel): bool => ($hotel['seasonRates'] ?? []) !== []),
                'tours' => collect($tours->get($leg['id'], []))->map(fn (array $tour): array => [
                    'id' => $tour['id'],
                    'name' => $tour['name'],
                    'day_offset' => $tour['dayOffset'],
                    'time' => $tour['time'],
                    'hours' => $tour['hours'],
                    'currency' => $tour['currency'],
                    'price_adult' => $tour['priceAdt'],
                    'price_child' => $tour['priceChd'],
                    'min_age' => $tour['minAge'],
                ])->values()->all(),
                'local' => $transport->where('fromLegId', $leg['id'])->whereNull('toLegId')->map(fn (array $option): array => $this->transportConfig($option))->values()->all(),
                'arrivals' => $transport->where('toLegId', $leg['id'])->map(fn (array $option): array => $this->transportConfig($option))->values()->all(),
            ], array_values(array_filter($data->accommodation['legs'] ?? [], fn (array $leg): bool => collect($legs)->contains('id', $leg['id'])))),
        ];
    }

    private function transportConfig(array $option): array
    {
        return [
            'id' => $option['id'],
            'name' => $option['name'],
            'mode' => $option['mode'],
            'mode_label' => $option['kind'],
            'from_leg_id' => $option['fromLegId'],
            'to_leg_id' => $option['toLegId'],
            'pricing' => $option['pricing'],
            'currency' => $option['currency'],
            'price_adult' => $option['priceAdt'],
            'price_child' => $option['priceChd'],
            'hours' => $option['hours'],
            'vehicles' => array_map(fn (array $vehicle): array => ['name' => $vehicle['name'], 'max_pax' => $vehicle['maxPax'], 'price' => $vehicle['price']], $option['vehicles']),
        ];
    }

    public function normalize(ProductData $data, array $pax, array $extras, bool $strict): array
    {
        $set = $this->rules->forTenant();
        $errors = [];
        $addons = [];
        $catalog = collect($data->addons)->keyBy('id');

        if ($set->on('R-ADDONS', $data)) {
            foreach ((array) ($extras['addons'] ?? []) as $selected) {
                $addon = $catalog->get((string) ($selected['id'] ?? ''));
                if ($addon === null) {
                    $errors['addons'][] = 'Uno de los adicionales elegidos ya no está disponible.';

                    continue;
                }
                $addons[$addon['id']] = ['id' => $addon['id'], 'qty' => isset($selected['qty']) ? max(1, min(99, (int) $selected['qty'])) : $this->addonQty($addon, $pax)];
            }
            foreach ($catalog as $addon) {
                if (! $addon['optional'] && ! isset($addons[$addon['id']])) {
                    $addons[$addon['id']] = ['id' => $addon['id'], 'qty' => $this->addonQty($addon, $pax)];
                }
            }
        }

        [$lodging, $noLodging, $lodgingErrors] = $this->lodging($data, $set, $extras, $strict);
        if ($lodgingErrors !== []) {
            $errors['lodging'] = $lodgingErrors;
        }

        $options = [];
        foreach ($data->options as $group) {
            $picked = collect((array) ($extras['options'] ?? []))->firstWhere('group', $group['group']);
            $option = $picked === null ? null : collect($group['options'])->firstWhere('label', $picked['label'] ?? null);
            if ($picked !== null && $option === null) {
                $errors['options'][] = "La opción elegida para {$group['group']} ya no está disponible.";
            }
            $option ??= $group['options'][0] ?? null;
            if ($option !== null) {
                $options[] = ['group' => $group['group'], 'label' => $option['label']];
            }
        }

        [$nights, $tours, $transport, $tripErrors] = $this->trip($data, $set, $extras);
        $errors = [...$errors, ...$tripErrors];

        if ($errors !== []) {
            throw ApiException::unprocessable('SIT-BR-05', collect($errors)->flatten()->first(), ['errors' => $errors]);
        }

        $mandatory = collect($data->addons)->reject(fn (array $addon): bool => $addon['optional'])->map(fn (array $addon): string => 'addon-'.$addon['id'])->all();
        $removed = $set->on('R-PREVIEW-REMOVE', $data)
            ? array_values(array_unique(array_filter(array_map('strval', (array) ($extras['removed'] ?? [])), fn (string $key): bool => Str::startsWith($key, self::REMOVABLE_PREFIXES) && ! in_array($key, $mandatory, true))))
            : [];

        return ['addons' => array_values($addons), 'lodging' => $lodging, 'no_lodging' => $noLodging, 'options' => $options, 'removed' => $removed, 'nights' => $nights, 'tours' => $tours, 'transport' => $transport];
    }

    private function trip(ProductData $data, RuleSet $set, array $extras): array
    {
        $legs = collect($data->accommodation['legs'] ?? [])->keyBy('id');
        if (! $set->on('R-TRIP-BUILDER', $data) || $legs->isEmpty()) {
            return [[], [], [], []];
        }

        $errors = [];
        $nights = [];
        foreach ((array) ($extras['nights'] ?? []) as $legId => $value) {
            if ($legs->has((string) $legId) && is_numeric($value)) {
                $nights[(string) $legId] = (int) $value;
            }
        }

        $catalog = collect($data->trip['tours'] ?? [])->keyBy('id');
        $tours = [];
        foreach (self::ids((array) ($extras['tours'] ?? [])) as $id) {
            if ($catalog->has($id)) {
                $tours[] = $id;
            } else {
                $errors['tours'][] = 'Uno de los tours elegidos ya no está disponible.';
            }
        }

        $options = collect($data->trip['transport'] ?? [])->keyBy('id');
        $wanted = self::ids((array) ($extras['transport'] ?? []));
        foreach ($wanted as $id) {
            if (! $options->has($id)) {
                $errors['transport'][] = 'Una de las opciones de movilidad elegidas ya no está disponible.';
            }
        }
        $transport = array_map(fn (array $option): string => (string) $option['id'], $this->engine->engine()->pickTransport($data, $wanted));

        return [$nights, $tours, $transport, $errors];
    }

    public function price(stdClass $product, string $date, array $pax, string $currency, array $extras, bool $strict, ?string $mode = null, ?string $method = null, ?array $promotion = null, ?int $units = null): array
    {
        $data = $this->data($product->id, $date);
        $selection = $this->normalize($data, $pax, $extras, $strict);
        $engine = $this->engine->engine();
        $request = [
            'date' => $date,
            'pax' => self::enginePax($pax, $units),
            'promotion' => $promotion,
            'round_units' => true,
            'addons' => $selection['addons'],
            'lodging' => $selection['lodging'],
            'options' => $selection['options'],
            'removed' => $selection['removed'],
            'nights' => $selection['nights'],
            'tours' => $selection['tours'],
            'transport' => $selection['transport'],
            'currency' => $currency,
            'channel' => self::CHANNEL,
            'payment_mode' => $mode,
            'payment_method' => $method,
        ];
        $warnings = [];

        try {
            $quote = $engine->quote($data, QuoteSelection::fromArray($request));
            $plain = $selection['options'] === [] ? null : $engine->quote($data, QuoteSelection::fromArray([...$request, 'options' => []]));
            $lines = array_values(array_filter(ProductQuotePreview::serialize($quote)['lines'], fn (array $line): bool => in_array($line['kind'], self::EXTRA_KINDS, true)));
        } catch (DomainException) {
            $quote = $engine->quote($data, QuoteSelection::fromArray([...$request, 'currency' => 'PEN', 'addons' => [], 'lodging' => [], 'options' => [], 'tours' => [], 'transport' => []]));
            $plain = null;
            $lines = [];
            $warnings[] = 'Los adicionales y el alojamiento no se pueden cotizar en '.$currency.'.';
        }

        if ($plain !== null) {
            $delta = $this->baseAmount($quote)->minus($this->baseAmount($plain))->toScale(2);
            if (! $delta->isZero()) {
                array_unshift($lines, ['key' => 'options', 'kind' => 'option', 'label' => implode(' · ', array_map(fn (array $option): string => $option['group'].': '.$option['label'], $selection['options'])), 'qty' => 1, 'unit' => (string) $delta, 'amount' => (string) $delta, 'removable' => false, 'removed' => false, 'meta' => ['options' => $selection['options']]]);
            }
        }

        $paxErrors = $engine->validatePax($data, $pax)->errors;

        return [
            'quote' => $quote,
            'plain' => $plain ?? $quote,
            'selection' => $selection,
            'lines' => $lines,
            'pax_errors' => $paxErrors,
            'warnings' => [...$warnings, ...array_values(array_diff($quote->warnings, $paxErrors, ['El producto no tiene tarifa vigente (PRD-BR-005).']))],
            'payment' => ['modes' => $quote->modes, 'mode' => $quote->paymentMode, 'deposit_pct' => $quote->depositPct, 'balance_due' => $quote->balanceDue?->toDateString(), 'hold_hours' => $quote->holdHours],
            'rooms' => $quote->rooms,
            'nights' => $quote->nights,
            'can_remove' => $this->rules->forTenant()->on('R-PREVIEW-REMOVE', $data),
            'trip' => $this->rules->forTenant()->on('R-TRIP-BUILDER', $data) ? ProductQuotePreview::serialize($quote) : null,
        ];
    }

    public function engineQuote(stdClass $product, array $data): array
    {
        $date = (string) $data['date'];
        $catalog = $product;
        $product = $this->data($catalog->id, $date);
        $pax = ['adt' => (int) $data['pax']['adt'], 'chd' => (int) ($data['pax']['chd'] ?? 0), 'inf' => (int) ($data['pax']['inf'] ?? 0)];
        $selection = $this->normalize($product, $pax, self::extrasFrom($data), false);
        $currency = (string) ($data['currency'] ?? $this->rateCurrency($product));
        $units = self::serviceUnits($catalog, $this->pricing->quote($catalog->id, $date)['basis'] ?? null, $pax);

        try {
            $quote = $this->engine->engine()->quote($product, QuoteSelection::fromArray([
                'date' => $date,
                'pax' => self::enginePax($pax, $units),
                'promotion' => SitePromotions::best($catalog, $pax['adt'] + $pax['chd'], $data['promo_code'] ?? null, $this->rateCurrency($product)),
                'round_units' => true,
                'addons' => $selection['addons'],
                'lodging' => $selection['lodging'],
                'options' => $selection['options'],
                'removed' => $selection['removed'],
                'nights' => $selection['nights'],
                'tours' => $selection['tours'],
                'transport' => $selection['transport'],
                'currency' => $currency,
                'channel' => self::CHANNEL,
                'payment_mode' => $data['payment_mode'] ?? null,
                'payment_method' => $data['payment_method'] ?? null,
                'promo_code' => $data['promo_code'] ?? null,
            ]));
        } catch (DomainException) {
            throw ApiException::unprocessable('R-MULTICURRENCY', "La agencia cotiza solo en soles: {$currency} no está habilitada.", ['currency' => ['La moneda elegida no está habilitada para esta agencia.']]);
        }

        return [
            ...ProductQuotePreview::serialize($quote),
            'date' => $date,
            'pax' => $pax,
            'extras' => $selection,
            'season' => $quote->season?->name,
            'can_remove' => $this->rules->forTenant()->on('R-PREVIEW-REMOVE', $product),
        ];
    }

    private function rateCurrency(ProductData $product): string
    {
        foreach ($product->rates as $rate) {
            if (in_array($rate['segment'] ?? null, ['Adulto', 'Pasajero'], true)) {
                return (string) $rate['currency'];
            }
        }

        return 'PEN';
    }

    private function lodging(ProductData $data, RuleSet $set, array $extras, bool $strict): array
    {
        $legs = collect($data->accommodation['legs'] ?? [])->filter(fn (array $leg): bool => $leg['hotels'] !== [])->keyBy('id');
        if (! $set->on('R-LODGING', $data) || $legs->isEmpty()) {
            return [[], false, []];
        }

        $optional = (bool) DB::table('catalog_products')->where('id', $data->id)->value('accommodation_optional');
        $noLodging = $optional && (bool) ($extras['no_lodging'] ?? false);
        if ($noLodging) {
            return [[], true, []];
        }

        $errors = [];
        $chosen = [];
        foreach ((array) ($extras['lodging'] ?? []) as $choice) {
            $leg = $legs->get((string) ($choice['leg_id'] ?? ''));
            $hotel = $leg === null ? null : collect($leg['hotels'])->firstWhere('id', (string) ($choice['hotel_id'] ?? ''));
            if ($hotel === null) {
                $errors[] = 'Uno de los hoteles elegidos ya no está disponible.';

                continue;
            }
            $rooms = [];
            foreach ((array) ($choice['rooms'] ?? []) as $room) {
                $type = collect($hotel['rooms'])->firstWhere('type', (string) ($room['type'] ?? ''));
                $qty = (int) ($room['qty'] ?? 0);
                if ($type === null) {
                    $errors[] = "{$leg['city']}: el tipo de habitación elegido no existe en {$hotel['name']}.";
                } elseif ($qty > 0) {
                    $rooms[$type['type']] = ['type' => $type['type'], 'qty' => min(20, $qty)];
                }
            }
            if ($rooms === []) {
                $errors[] = "{$leg['city']}: elige al menos una habitación en {$hotel['name']}.";

                continue;
            }
            $chosen[$leg['id']] = ['leg_id' => $leg['id'], 'hotel_id' => $hotel['id'], 'rooms' => array_values($rooms)];
        }

        if ($strict && ! $optional) {
            foreach ($legs as $leg) {
                if (! isset($chosen[$leg['id']])) {
                    $errors[] = "Elige el hotel de {$leg['city']}.";
                }
            }
        }

        return [array_map(fn (string $id): array => $chosen[$id], array_values(array_intersect($legs->keys()->all(), array_keys($chosen)))), false, $errors];
    }

    private function addonQty(array $addon, array $pax): int
    {
        if (($addon['per'] ?? 'pax') !== 'pax') {
            return 1;
        }

        $types = $addon['appliesTo'] === [] ? ['ADT', 'CHD'] : $addon['appliesTo'];

        return max(1, (in_array('ADT', $types, true) ? (int) $pax['adt'] : 0) + (in_array('CHD', $types, true) ? (int) $pax['chd'] : 0) + (in_array('INF', $types, true) ? (int) $pax['inf'] : 0));
    }

    private function baseAmount(BookingQuote $quote): BigDecimal
    {
        $sum = BigDecimal::zero();
        foreach ($quote->lines as $line) {
            if ($line->kind === 'base') {
                $sum = $sum->plus((string) $line->amount->getAmount());
            }
        }

        return $sum;
    }

    private function optionGroups(string $productId): array
    {
        $groups = DB::table('catalog_product_config_groups')->where('product_id', $productId)->orderBy('sort_order')->get(['id', 'name']);
        if ($groups->isEmpty()) {
            return [];
        }
        $options = DB::table('catalog_product_config_options')->whereIn('group_id', $groups->pluck('id'))->orderBy('sort_order')->get(['group_id', 'label', 'price_delta'])->groupBy('group_id');

        return $groups->map(fn (stdClass $group): array => [
            'group' => $group->name,
            'options' => collect($options->get($group->id, []))->map(fn (stdClass $option): array => ['label' => $option->label, 'delta' => (string) $option->price_delta])->values()->all(),
        ])->filter(fn (array $group): bool => $group['options'] !== [])->values()->all();
    }
}
