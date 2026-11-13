<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Admin\Support\RuleParams;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\RuleSet;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductBookingConfig
{
    public const ADDON_CATEGORIES = ['Museo', 'Entrada', 'Alimentación', 'Transporte', 'Extensión', 'Seguro', 'Experiencia', 'Servicio', 'Otro'];

    public const PAX_TYPES = ['ADT', 'CHD', 'INF'];

    public const ROOM_TYPES = ['Simple', 'Doble', 'Matrimonial', 'Triple', 'Familiar', 'Suite'];

    public const HOTEL_CATEGORIES = ['3 estrellas', '4 estrellas', '5 estrellas', 'Hostal', 'Lodge', 'Boutique'];

    public const PICKUP_KINDS = ['aeropuerto' => 'Aeropuerto', 'hotel' => 'Hotel', 'punto_encuentro' => 'Punto de encuentro', 'terminal' => 'Terminal', 'por_cuenta' => 'Por su cuenta'];

    public const PAYMENT_MODES = ['total', 'adelanto'];

    public const SECTION_RULES = [
        'disponibilidad' => ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS'],
        'pasajeros' => ['R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE'],
        'adicionales' => ['R-ADDONS'],
        'alojamiento' => ['R-LODGING'],
        'pago' => ['R-DEPOSIT', 'R-PAY-LATER'],
        'recojo' => ['R-PICKUP'],
    ];

    private const PRODUCT_COLUMNS = ['id', 'code', 'name', 'status', 'lock_version', 'duration_value', 'duration_unit', 'maximum_passengers', 'booking_advance_min_days', 'operating_weekdays', 'cutoff_hours', 'accommodation_enabled', 'accommodation_optional', 'accommodation_currency', 'accommodation_note', 'pickup_required', 'pickup_ask_flight'];

    public function __construct(
        private readonly TenantBookingEngine $engine,
        private readonly RuleResolver $rules,
    ) {}

    public function product(string $product): object
    {
        return DB::table('catalog_products')->whereNull('deleted_at')->where(Str::isUuid($product) ? 'id' : 'code', $product)->first(self::PRODUCT_COLUMNS)
            ?? throw ApiException::notFound('El producto no existe.');
    }

    public function config(string $product, User $viewer): array
    {
        $row = $this->product($product);
        $data = $this->engineProduct($row->id);
        $set = $this->rules->forTenant();

        return [
            'product' => ['id' => $row->id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->status, 'lock_version' => (int) $row->lock_version, 'duration' => $this->durationNights($row)],
            'sections' => $this->sectionStates($set, $data),
            'operation' => $this->operation($row),
            'pax_rules' => $this->paxRules($row),
            'addons' => $this->addons($row->id),
            'accommodation' => $this->accommodation($row),
            'payment' => $this->payment($row, $set, $data),
            'pickup' => $this->pickup($row),
            'rules' => $this->ruleOverrides($row->id, $set, $data),
            'summary' => $this->summary($row, $set, $data),
            'options' => $this->options(),
            'can' => [
                'update' => $viewer->can('catalog.products.update'),
                'manage_rates' => $viewer->can('catalog.products.manage_rates'),
                'manage_availability' => $viewer->can('catalog.products.manage_availability'),
                'manage_pickup' => $viewer->canAny(['catalog.products.update', 'catalog.products.manage_availability']),
                'admin_rules' => $viewer->can('admin.settings.manage'),
            ],
        ];
    }

    public function engineProduct(string $productId, ?string $date = null): ProductData
    {
        $base = $this->engine->product($productId, $date ?? CatalogAccess::today());
        $sections = $this->engineSections($productId);

        return new ProductData(
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
            addons: $sections['addons'],
            accommodation: $sections['accommodation'],
            options: $base->options,
            payment: $sections['payment'],
            trip: $sections['trip'],
        );
    }

    public function engineSections(string $productId): array
    {
        $product = DB::table('catalog_products')->where('id', $productId)->first(['accommodation_enabled', 'accommodation_currency']);
        $policy = DB::table('catalog_payment_policies')->where('product_id', $productId)->first();
        $legs = $product !== null && $product->accommodation_enabled ? $this->legs($productId) : [];
        $seasons = TripCatalog::seasonRatesFor(collect($legs)->pluck('hotels')->flatten(1)->pluck('id')->all());

        return [
            'addons' => $this->addonRows($productId)->map(fn ($addon): array => [
                'id' => $addon->code,
                'name' => $addon->name,
                'category' => $addon->category,
                'price' => (string) $addon->price,
                'currency' => $addon->currency,
                'per' => $addon->charge_per,
                'appliesTo' => $this->pgArray($addon->applies_to),
                'optional' => (bool) $addon->is_optional,
            ])->all(),
            'accommodation' => $legs === [] ? [] : [
                'currency' => (string) ($product->accommodation_currency ?? 'USD'),
                'legs' => array_map(fn (array $leg): array => [
                    'id' => $leg['code'],
                    'city' => $leg['city'],
                    'nights' => $leg['nights'],
                    'minNights' => $leg['min_nights'],
                    'maxNights' => $leg['max_nights'],
                    'hotels' => array_map(fn (array $hotel): array => [
                        'id' => $hotel['code'],
                        'name' => $hotel['name'],
                        'category' => $hotel['category'],
                        'providerId' => $hotel['provider']['id'] ?? null,
                        'seasonRates' => $seasons[$hotel['id']] ?? [],
                        'rooms' => array_map(fn (array $room): array => ['type' => $room['room_type'], 'capacity' => $room['capacity'], 'price' => $room['price_per_night']], $hotel['room_types']),
                    ], $leg['hotels']),
                ], $legs),
            ],
            'trip' => $legs === [] ? [] : TripCatalog::engineTrip($productId, $legs),
            'payment' => $policy === null ? [] : array_filter([
                'modes' => $this->pgArray($policy->modes),
                'depositPct' => $policy->deposit_pct === null ? null : (int) round((float) $policy->deposit_pct),
                'balanceDueDays' => $policy->balance_due_days === null ? null : (int) $policy->balance_due_days,
            ], fn (mixed $value): bool => $value !== null),
        ];
    }

    public function operation(object $row): array
    {
        return [
            'operating_weekdays' => $this->weekdays($row->operating_weekdays),
            'cutoff_hours' => $row->cutoff_hours === null ? null : (int) $row->cutoff_hours,
            'advance_min_days' => (int) $row->booking_advance_min_days,
        ];
    }

    public function paxRules(object $row): array
    {
        $stored = DB::table('catalog_pax_rules')->where('product_id', $row->id)->first();
        $effective = $this->engine->paxRulesFor($row->id);
        $values = $stored === null ? null : [
            'adult_min_age' => (int) $stored->adult_min_age,
            'child_min_age' => (int) $stored->child_min_age,
            'child_max_age' => (int) $stored->child_max_age,
            'infant_max_age' => (int) $stored->infant_max_age,
            'child_pays' => (bool) $stored->child_pays,
            'child_price_pct' => (string) (float) $stored->child_price_pct,
            'infant_allowed' => (bool) $stored->infant_allowed,
            'infant_pays' => (bool) $stored->infant_pays,
            'max_children_per_adult' => (int) $stored->max_children_per_adult,
            'max_infants_per_adult' => (int) $stored->max_infants_per_adult,
            'min_adults' => (int) $stored->min_adults,
            'note' => $stored->note,
        ];

        return [
            'inherited' => $stored === null,
            'values' => $values,
            'effective' => [
                'adult_min_age' => (int) $effective['adultMinAge'],
                'child_min_age' => (int) $effective['childMinAge'],
                'child_max_age' => (int) $effective['childMaxAge'],
                'infant_max_age' => (int) $effective['infantMaxAge'],
                'child_pays' => (bool) ($effective['childPays'] ?? true),
                'child_price_pct' => (string) (float) ($effective['childPricePct'] ?? 100),
                'infant_allowed' => (bool) ($effective['infantAllowed'] ?? true),
                'infant_pays' => (bool) ($effective['infantPays'] ?? false),
                'max_children_per_adult' => (int) $effective['maxChildrenPerAdult'],
                'max_infants_per_adult' => (int) $effective['maxInfantsPerAdult'],
                'min_adults' => (int) $effective['minAdults'],
            ],
            'warnings' => self::ageGaps($values ?? []),
        ];
    }

    public static function ageGaps(array $values): array
    {
        if ($values === []) {
            return [];
        }

        $gaps = [];
        if ((int) $values['infant_max_age'] + 1 < (int) $values['child_min_age']) {
            $gaps[] = self::gap((int) $values['infant_max_age'] + 1, (int) $values['child_min_age'] - 1);
        }
        if ((int) $values['child_max_age'] + 1 < (int) $values['adult_min_age']) {
            $gaps[] = self::gap((int) $values['child_max_age'] + 1, (int) $values['adult_min_age'] - 1);
        }

        return $gaps;
    }

    public function addons(string $productId): array
    {
        $providers = DB::table('catalog_providers')->pluck('name', 'id');
        $services = DB::table('catalog_services')->get(['id', 'ref', 'name'])->keyBy('id');

        return $this->addonRows($productId)->map(fn ($addon): array => [
            'id' => $addon->id,
            'code' => $addon->code,
            'name' => $addon->name,
            'category' => $addon->category,
            'price' => (string) $addon->price,
            'currency' => $addon->currency,
            'charge_per' => $addon->charge_per,
            'applies_to' => $this->pgArray($addon->applies_to),
            'stock_note' => $addon->stock_note,
            'is_optional' => (bool) $addon->is_optional,
            'provider' => $addon->provider_id === null ? null : ['id' => $addon->provider_id, 'name' => $providers[$addon->provider_id] ?? null],
            'service' => $addon->service_id === null || ! $services->has($addon->service_id) ? null : ['id' => $addon->service_id, 'ref' => $services[$addon->service_id]->ref, 'name' => $services[$addon->service_id]->name],
        ])->all();
    }

    public function accommodation(object $row): array
    {
        $legs = $this->legs($row->id);
        $nights = array_sum(array_column($legs, 'nights'));
        $expected = $this->durationNights($row);
        $warnings = [];

        if ($legs !== [] && $expected !== null && $nights !== $expected) {
            $warnings[] = "Los tramos suman {$nights} noche(s) y la duración del producto equivale a {$expected} (CAT-LG-02).";
        }
        foreach ($legs as $leg) {
            if ($leg['hotels'] === []) {
                $warnings[] = "{$leg['city']} no tiene hoteles: el cliente no podrá elegir alojamiento en ese tramo.";
            }
        }
        $cities = collect($legs)->pluck('city')->map(fn (string $city) => mb_strtolower($city));
        if ($cities->count() !== $cities->unique()->count()) {
            $warnings[] = 'Hay ciudades repetidas en el itinerario de alojamiento.';
        }

        return [
            'enabled' => (bool) $row->accommodation_enabled,
            'optional' => (bool) $row->accommodation_optional,
            'currency' => $row->accommodation_currency,
            'note' => $row->accommodation_note,
            'legs' => $legs,
            'cities' => count($legs),
            'nights' => $nights,
            'expected_nights' => $expected,
            'warnings' => $warnings,
        ];
    }

    public function payment(object $row, ?RuleSet $set = null, ?ProductData $data = null): array
    {
        $set ??= $this->rules->forTenant();
        $data ??= $this->engineProduct($row->id);
        $policy = DB::table('catalog_payment_policies')->where('product_id', $row->id)->first();
        $modes = $policy === null ? ['total', 'adelanto'] : $this->pgArray($policy->modes);
        $effective = $set->on('R-DEPOSIT', $data) ? $modes : array_values(array_diff($modes, ['adelanto']));
        if ($set->on('R-PAY-LATER', $data)) {
            $effective[] = 'pagar_despues';
        }

        return [
            'inherited' => $policy === null,
            'values' => $policy === null ? null : [
                'modes' => $modes,
                'deposit_pct' => $policy->deposit_pct === null ? null : (int) round((float) $policy->deposit_pct),
                'balance_due_days' => $policy->balance_due_days === null ? null : (int) $policy->balance_due_days,
                'note' => $policy->note,
            ],
            'tenant' => [
                'deposit_pct' => (int) ($set->param('R-DEPOSIT', 'pct') ?? 30),
                'balance_due_days' => (int) ($set->param('R-DEPOSIT', 'balanceDueDays') ?? 15),
                'hold_hours' => (int) ($set->param('R-PAY-LATER', 'holdHours') ?? 24),
            ],
            'pay_later' => [
                'tenant_enabled' => $set->on('R-PAY-LATER'),
                'enabled' => $set->on('R-PAY-LATER', $data),
            ],
            'effective_modes' => $effective === [] ? ['total'] : array_values(array_unique($effective)),
        ];
    }

    public function pickup(object $row): array
    {
        return [
            'required' => (bool) $row->pickup_required,
            'ask_flight' => (bool) $row->pickup_ask_flight,
            'points' => DB::table('catalog_pickup_points')->where('product_id', $row->id)->orderBy('sequence')->get(['id', 'sequence', 'label', 'kind', 'requires_address'])
                ->map(fn (object $point): array => ['id' => $point->id, 'sequence' => (int) $point->sequence, 'label' => $point->label, 'kind' => $point->kind, 'requires_address' => (bool) $point->requires_address])->all(),
        ];
    }

    public function ruleOverrides(string $productId, ?RuleSet $set = null, ?ProductData $data = null): array
    {
        $set ??= $this->rules->forTenant();
        $data ??= $this->engineProduct($productId);
        $overrides = DB::table('catalog_product_rule_overrides')->where('product_id', $productId)->get(['rule_code', 'disabled', 'params'])->keyBy('rule_code');

        return DB::table('sys_booking_rules')->orderBy('sort_order')->get(['code', 'rule_group', 'name', 'description', 'enabled', 'params', 'product_override'])
            ->map(function (object $rule) use ($set, $data, $overrides): array {
                $tenantParams = (array) json_decode((string) $rule->params, true);
                $override = $overrides->get($rule->code);
                $own = $override !== null && $override->params !== null ? (array) json_decode((string) $override->params, true) : [];

                return [
                    'code' => $rule->code,
                    'group' => $rule->rule_group,
                    'name' => $rule->name,
                    'description' => $rule->description,
                    'product_override' => (bool) $rule->product_override,
                    'tenant_enabled' => $set->on($rule->code),
                    'product_disabled' => $override !== null && (bool) $override->disabled,
                    'effective' => $set->on($rule->code, $data),
                    'has_override' => $override !== null,
                    'params' => RuleParams::describe($rule->code, [...$tenantParams, ...$own]),
                    'tenant_params' => $tenantParams,
                    'own_params' => $own,
                ];
            })->values()->all();
    }

    public function legs(string $productId): array
    {
        $legs = DB::table('catalog_accommodation_legs')->where('product_id', $productId)->orderBy('sequence')->get(['id', 'code', 'sequence', 'city', 'destination_id', 'nights', 'min_nights', 'max_nights']);
        $hotels = DB::table('catalog_accommodation_hotels')->whereIn('leg_id', $legs->pluck('id'))->orderBy('name')->get(['id', 'leg_id', 'code', 'name', 'category', 'provider_id'])->groupBy('leg_id');
        $rooms = DB::table('catalog_accommodation_room_types')->whereIn('hotel_id', $hotels->flatten()->pluck('id'))->orderBy('capacity')->orderBy('price_per_night')->get(['id', 'hotel_id', 'room_type', 'capacity', 'price_per_night'])->groupBy('hotel_id');
        $destinations = DB::table('catalog_destinations')->whereIn('id', $legs->pluck('destination_id')->filter())->pluck('name', 'id');
        $providers = DB::table('catalog_providers')->whereIn('id', $hotels->flatten()->pluck('provider_id')->filter())->pluck('name', 'id');

        return $legs->map(fn (object $leg): array => [
            'id' => $leg->id,
            'code' => $leg->code,
            'sequence' => (int) $leg->sequence,
            'city' => $leg->city,
            'destination' => $leg->destination_id === null ? null : ['id' => $leg->destination_id, 'name' => $destinations[$leg->destination_id] ?? null],
            'nights' => (int) $leg->nights,
            'min_nights' => $leg->min_nights === null ? null : (int) $leg->min_nights,
            'max_nights' => $leg->max_nights === null ? null : (int) $leg->max_nights,
            'hotels' => collect($hotels->get($leg->id, []))->map(fn ($hotel): array => [
                'id' => $hotel->id,
                'code' => $hotel->code,
                'name' => $hotel->name,
                'category' => $hotel->category,
                'provider' => $hotel->provider_id === null ? null : ['id' => $hotel->provider_id, 'name' => $providers[$hotel->provider_id] ?? null],
                'room_types' => collect($rooms->get($hotel->id, []))->map(fn ($room): array => ['room_type' => $room->room_type, 'capacity' => (int) $room->capacity, 'price_per_night' => (string) $room->price_per_night])->values()->all(),
            ])->values()->all(),
        ])->values()->all();
    }

    public function durationNights(object $row): ?int
    {
        $value = (int) floor((float) $row->duration_value);

        return match ($row->duration_unit) {
            'noches' => $value,
            'días' => max(0, $value - 1),
            default => null,
        };
    }

    private function sectionStates(RuleSet $set, ProductData $data): array
    {
        $states = [];
        foreach (self::SECTION_RULES as $section => $codes) {
            $tenantOn = collect($codes)->contains(fn (string $code): bool => $set->on($code));
            $productOn = collect($codes)->contains(fn (string $code): bool => $set->on($code, $data));
            $states[$section] = [
                'rules' => $codes,
                'status' => ! $tenantOn ? 'tenant_off' : (! $productOn ? 'product_off' : 'on'),
            ];
        }

        return $states;
    }

    private function summary(object $row, RuleSet $set, ProductData $data): array
    {
        $pax = $this->engine->paxRulesFor($row->id);
        $legs = DB::table('catalog_accommodation_legs')->where('product_id', $row->id)->get(['nights']);
        $ranges = DB::table('catalog_availability_ranges')->where('product_id', $row->id)->whereNull('deleted_at')->where('date_to', '>=', CatalogAccess::today())->count();

        return [
            'ranges' => $ranges,
            'pax' => 'Adulto desde '.$pax['adultMinAge'].' años · niño de '.$pax['childMinAge'].' a '.$pax['childMaxAge'].(empty($pax['childPays']) ? ' sin costo' : ' al '.(float) ($pax['childPricePct'] ?? 100).' %').' · infante hasta '.$pax['infantMaxAge'].(empty($pax['infantPays']) ? ' no paga' : ' paga'),
            'addons' => DB::table('catalog_product_addons')->where('product_id', $row->id)->whereNull('deleted_at')->count(),
            'lodging' => $row->accommodation_enabled ? ['cities' => $legs->count(), 'nights' => (int) $legs->sum('nights')] : null,
            'payment' => $this->payment($row, $set, $data)['effective_modes'],
            'pickup_points' => DB::table('catalog_pickup_points')->where('product_id', $row->id)->count(),
            'overrides' => DB::table('catalog_product_rule_overrides')->where('product_id', $row->id)->count(),
        ];
    }

    private function options(): array
    {
        return [
            'currencies' => CatalogAccess::CURRENCIES,
            'addon_categories' => self::ADDON_CATEGORIES,
            'pax_types' => [['value' => 'ADT', 'label' => 'Adulto'], ['value' => 'CHD', 'label' => 'Niño'], ['value' => 'INF', 'label' => 'Infante']],
            'room_types' => self::ROOM_TYPES,
            'hotel_categories' => self::HOTEL_CATEGORIES,
            'pickup_kinds' => collect(self::PICKUP_KINDS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['id', 'name', 'type'])->map(fn (object $provider): array => (array) $provider)->all(),
            'services' => DB::table('catalog_services')->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['id', 'ref', 'name', 'provider_id', 'type'])->map(fn (object $service): array => (array) $service)->all(),
            'destinations' => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('name')->get(['id', 'name'])->map(fn (object $destination): array => (array) $destination)->all(),
        ];
    }

    private function addonRows(string $productId): Collection
    {
        return DB::table('catalog_product_addons')->where('product_id', $productId)->whereNull('deleted_at')->orderBy('code')->get();
    }

    private function weekdays(mixed $value): array
    {
        return array_map('intval', $this->pgArray($value));
    }

    private function pgArray(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        $text = trim((string) $value, '{}');

        return $text === '' ? [] : array_map(fn (string $item) => trim($item, '"'), explode(',', $text));
    }

    private static function gap(int $from, int $to): string
    {
        return $from === $to ? "La edad de {$from} año(s) no tiene banda: el checkout la rechazará (CAT-PX-01)." : "Las edades de {$from} a {$to} años no tienen banda: el checkout las rechazará (CAT-PX-01).";
    }
}
