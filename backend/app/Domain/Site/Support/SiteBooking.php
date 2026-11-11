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
use stdClass;

final class SiteBooking
{
    public const EXTRA_KINDS = ['addon', 'lodging', 'surcharge'];

    private const CHANNEL = 'E-commerce';

    private array $products = [];

    public function __construct(
        private readonly ProductBookingConfig $config,
        private readonly TenantBookingEngine $engine,
        private readonly RuleResolver $rules,
    ) {}

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
        ];
    }

    public static function decode(stdClass $row, string $removedColumn = 'removed_line_keys'): array
    {
        $options = (array) json_decode((string) ($row->options ?? '[]'), true);
        $removed = $row->{$removedColumn} ?? '{}';

        return [
            'addons' => (array) json_decode((string) ($row->addons ?? '[]'), true),
            'lodging' => (array) json_decode((string) ($row->lodging ?? '[]'), true),
            'no_lodging' => (bool) ($row->no_lodging ?? false),
            'options' => array_is_list($options) ? $options : [],
            'removed' => is_array($removed) ? $removed : array_values(array_filter(array_map(fn (string $key): string => trim($key, '"'), explode(',', trim((string) $removed, '{}'))))),
        ];
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

        if ($errors !== []) {
            throw ApiException::unprocessable('SIT-BR-05', collect($errors)->flatten()->first(), ['errors' => $errors]);
        }

        $mandatory = collect($data->addons)->reject(fn (array $addon): bool => $addon['optional'])->map(fn (array $addon): string => 'addon-'.$addon['id'])->all();
        $removed = $set->on('R-PREVIEW-REMOVE', $data)
            ? array_values(array_unique(array_filter(array_map('strval', (array) ($extras['removed'] ?? [])), fn (string $key): bool => (str_starts_with($key, 'addon-') || str_starts_with($key, 'lodge-')) && ! in_array($key, $mandatory, true))))
            : [];

        return ['addons' => array_values($addons), 'lodging' => $lodging, 'no_lodging' => $noLodging, 'options' => $options, 'removed' => $removed];
    }

    public function price(stdClass $product, string $date, array $pax, string $currency, array $extras, bool $strict, ?string $mode = null, ?string $method = null): array
    {
        $data = $this->data($product->id, $date);
        $selection = $this->normalize($data, $pax, $extras, $strict);
        $engine = $this->engine->engine();
        $request = [
            'date' => $date,
            'pax' => $pax,
            'addons' => $selection['addons'],
            'lodging' => $selection['lodging'],
            'options' => $selection['options'],
            'removed' => $selection['removed'],
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
            $quote = $engine->quote($data, QuoteSelection::fromArray([...$request, 'currency' => 'PEN', 'addons' => [], 'lodging' => [], 'options' => []]));
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
            'selection' => $selection,
            'lines' => $lines,
            'pax_errors' => $paxErrors,
            'warnings' => [...$warnings, ...array_values(array_diff($quote->warnings, $paxErrors, ['El producto no tiene tarifa vigente (PRD-BR-005).']))],
            'payment' => ['modes' => $quote->modes, 'mode' => $quote->paymentMode, 'deposit_pct' => $quote->depositPct, 'balance_due' => $quote->balanceDue?->toDateString(), 'hold_hours' => $quote->holdHours],
            'rooms' => $quote->rooms,
            'nights' => $quote->nights,
            'can_remove' => $this->rules->forTenant()->on('R-PREVIEW-REMOVE', $data),
        ];
    }

    public function engineQuote(stdClass $product, array $data): array
    {
        $date = (string) $data['date'];
        $product = $this->data($product->id, $date);
        $pax = ['adt' => (int) $data['pax']['adt'], 'chd' => (int) ($data['pax']['chd'] ?? 0), 'inf' => (int) ($data['pax']['inf'] ?? 0)];
        $selection = $this->normalize($product, $pax, self::extrasFrom($data), false);
        $currency = (string) ($data['currency'] ?? $this->rateCurrency($product));

        try {
            $quote = $this->engine->engine()->quote($product, QuoteSelection::fromArray([
                'date' => $date,
                'pax' => $pax,
                'addons' => $selection['addons'],
                'lodging' => $selection['lodging'],
                'options' => $selection['options'],
                'removed' => $selection['removed'],
                'currency' => $currency,
                'channel' => (string) ($data['channel'] ?? 'Directo'),
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
