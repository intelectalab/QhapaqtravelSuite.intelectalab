<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductBookingRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Catalog\Support\ProductQuotePreview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

final class ProductBookingController
{
    use ResolvesActor;

    private const PAX_MESSAGES = [
        'adult_min_age.*' => 'Indica desde qué edad es adulto (1 a 21 años).',
        'child_min_age.*' => 'Indica la edad mínima de niño (0 a 17 años).',
        'child_max_age.*' => 'Indica la edad máxima de niño (0 a 17 años).',
        'infant_max_age.*' => 'Indica hasta qué edad es infante (0 a 5 años).',
        'child_pays.*' => 'Indica si el niño paga.',
        'child_price_pct.*' => 'El precio del niño va de 0 a 100 % del adulto (CAT-PX-02).',
        'infant_allowed.*' => 'Indica si se admiten infantes.',
        'infant_pays.*' => 'Indica si el infante paga.',
        'max_children_per_adult.*' => 'Los niños por adulto van de 0 a 10 (CAT-PX-02).',
        'max_infants_per_adult.*' => 'Los infantes por adulto van de 0 a 5 (CAT-PX-02).',
        'min_adults.*' => 'Los adultos mínimos van de 0 a 10 (CAT-PX-02).',
        'note.*' => 'La nota admite hasta 500 caracteres.',
    ];

    public function __construct(
        private readonly ProductBookingConfig $config,
        private readonly ProductBookingRegistry $registry,
        private readonly ProductQuotePreview $preview,
    ) {}

    public function show(Request $request, string $product): JsonResponse
    {
        $config = $this->config->config($product, $this->actor($request));

        return response()->json(['data' => [...$config, 'examples' => [
            'lodging' => $config['accommodation']['enabled'] ? $this->preview->lodgingExample($config['product']['id'], $config['accommodation']['legs']) : null,
            'payment' => $this->preview->paymentExamples($config['product']['id'], $config['payment']['effective_modes']),
        ]]]);
    }

    public function operation(Request $request, string $product): JsonResponse
    {
        $data = $request->validate([
            'operating_weekdays' => ['required', 'array', 'min:1', 'max:7'],
            'operating_weekdays.*' => ['integer', 'between:0,6'],
            'cutoff_hours' => ['nullable', 'integer', 'between:0,8760'],
        ], [
            'operating_weekdays.*' => 'Elige al menos un día de operación (CAT-AV-06).',
            'cutoff_hours.*' => 'La anticipación va de 0 a 8760 horas (CAT-AV-06).',
        ]);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->operation($code, $version, $data, $this->actor($request)), 'operation');
    }

    public function paxRules(Request $request, string $product): JsonResponse
    {
        return response()->json(['data' => $this->config->paxRules($this->config->product($product))]);
    }

    public function savePaxRules(Request $request, string $product): JsonResponse
    {
        $data = $request->validate([
            'adult_min_age' => ['required', 'integer', 'between:1,21'],
            'child_min_age' => ['required', 'integer', 'between:0,17'],
            'child_max_age' => ['required', 'integer', 'between:0,17'],
            'infant_max_age' => ['required', 'integer', 'between:0,5'],
            'child_pays' => ['required', 'boolean'],
            'child_price_pct' => ['required', 'numeric', 'between:0,100'],
            'infant_allowed' => ['required', 'boolean'],
            'infant_pays' => ['required', 'boolean'],
            'max_children_per_adult' => ['required', 'integer', 'between:0,10'],
            'max_infants_per_adult' => ['required', 'integer', 'between:0,5'],
            'min_adults' => ['required', 'integer', 'between:0,10'],
            'note' => ['nullable', 'string', 'max:500'],
        ], self::PAX_MESSAGES);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->savePaxRules($code, $version, $data, $this->actor($request)), 'pax_rules');
    }

    public function resetPaxRules(Request $request, string $product): Response
    {
        return $this->removed($request, $product, fn (string $code, ?int $version) => $this->registry->resetPaxRules($code, $version, $this->actor($request)));
    }

    public function simulate(Request $request, string $product): JsonResponse
    {
        $data = $request->validate([
            'adt' => ['required', 'integer', 'between:0,50'],
            'chd' => ['nullable', 'integer', 'between:0,50'],
            'inf' => ['nullable', 'integer', 'between:0,50'],
            'ages' => ['nullable', 'array', 'max:50'],
            'ages.*' => ['integer', 'between:0,120'],
        ], [
            'adt.*' => 'Indica cuántos adultos (0 a 50).',
            'chd.*' => 'Indica cuántos niños (0 a 50).',
            'inf.*' => 'Indica cuántos infantes (0 a 50).',
            'ages.*' => 'Cada edad va de 0 a 120 años.',
        ]);
        $row = $this->config->product($product);

        return response()->json(['data' => $this->preview->simulate($row->id, ['adt' => (int) $data['adt'], 'chd' => (int) ($data['chd'] ?? 0), 'inf' => (int) ($data['inf'] ?? 0)], array_map('intval', $data['ages'] ?? []))]);
    }

    public function addons(Request $request, string $product): JsonResponse
    {
        return response()->json(['data' => $this->config->addons($this->config->product($product)->id)]);
    }

    public function storeAddon(Request $request, string $product): JsonResponse
    {
        $data = $this->addonData($request, true);
        $row = $this->config->product($product);
        $addon = $this->registry->createAddon($row->code, $this->lock($request), $data, $this->actor($request));

        return response()->json(['data' => collect($this->config->addons($row->id))->firstWhere('code', $addon)], 201);
    }

    public function updateAddon(Request $request, string $product, string $addon): JsonResponse
    {
        $data = $this->addonData($request, false);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->updateAddon($code, $version, $addon, $data, $this->actor($request)), 'addons');
    }

    public function destroyAddon(Request $request, string $product, string $addon): Response
    {
        return $this->removed($request, $product, fn (string $code, ?int $version) => $this->registry->deleteAddon($code, $version, $addon, $this->actor($request)));
    }

    public function accommodation(Request $request, string $product): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'optional' => ['nullable', 'boolean'],
            'currency' => ['nullable', Rule::in(CatalogAccess::CURRENCIES)],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'enabled.*' => 'Indica si el producto ofrece alojamiento.',
            'optional.*' => 'Indica si el alojamiento es opcional o está incluido.',
            'currency.*' => 'Elige una moneda activa.',
            'note.*' => 'La nota admite hasta 500 caracteres.',
        ]);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->accommodation($code, $version, $data, $this->actor($request)), 'accommodation');
    }

    public function storeLeg(Request $request, string $product): JsonResponse
    {
        $data = $this->legData($request, true);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->createLeg($code, $version, $data, $this->actor($request)), 'accommodation', 201);
    }

    public function updateLeg(Request $request, string $product, string $leg): JsonResponse
    {
        $data = $this->legData($request, false);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->updateLeg($code, $version, $leg, $data, $this->actor($request)), 'accommodation');
    }

    public function destroyLeg(Request $request, string $product, string $leg): Response
    {
        return $this->removed($request, $product, fn (string $code, ?int $version) => $this->registry->deleteLeg($code, $version, $leg, $this->actor($request)));
    }

    public function reorderLegs(Request $request, string $product): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'min:1'], 'ids.*' => ['uuid', 'distinct']], ['ids.*' => 'Envía el orden de los tramos.']);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->reorderLegs($code, $version, $data['ids'], $this->actor($request)), 'accommodation');
    }

    public function storeHotel(Request $request, string $product, string $leg): JsonResponse
    {
        $data = $this->hotelData($request, true);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->createHotel($code, $version, $leg, $data, $this->actor($request)), 'accommodation', 201);
    }

    public function updateHotel(Request $request, string $product, string $leg, string $hotel): JsonResponse
    {
        $data = $this->hotelData($request, false);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->updateHotel($code, $version, $leg, $hotel, $data, $this->actor($request)), 'accommodation');
    }

    public function destroyHotel(Request $request, string $product, string $leg, string $hotel): Response
    {
        return $this->removed($request, $product, fn (string $code, ?int $version) => $this->registry->deleteHotel($code, $version, $leg, $hotel, $this->actor($request)));
    }

    public function paymentPolicy(Request $request, string $product): JsonResponse
    {
        return response()->json(['data' => $this->config->payment($this->config->product($product))]);
    }

    public function savePaymentPolicy(Request $request, string $product): JsonResponse
    {
        $data = $request->validate([
            'modes' => ['required', 'array', 'min:1'],
            'modes.*' => [Rule::in(ProductBookingConfig::PAYMENT_MODES), 'distinct'],
            'deposit_pct' => ['nullable', 'integer', 'between:1,99'],
            'balance_due_days' => ['nullable', 'integer', 'between:0,180'],
            'note' => ['nullable', 'string', 'max:500'],
            'pay_later_enabled' => ['nullable', 'boolean'],
        ], [
            'modes.*' => 'Elige al menos una modalidad con cobro: total o adelanto (CAT-PY-01).',
            'deposit_pct.*' => 'El adelanto va de 1 a 99 % (CAT-PY-01).',
            'balance_due_days.*' => 'El saldo vence entre 0 y 180 días antes del viaje (CAT-PY-01).',
            'note.*' => 'La nota admite hasta 500 caracteres.',
            'pay_later_enabled.*' => 'Indica si se ofrece pagar después.',
        ]);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->payment($code, $version, $data, $this->actor($request)), 'payment');
    }

    public function resetPaymentPolicy(Request $request, string $product): Response
    {
        return $this->removed($request, $product, fn (string $code, ?int $version) => $this->registry->resetPayment($code, $version, $this->actor($request)));
    }

    public function pickup(Request $request, string $product): JsonResponse
    {
        return response()->json(['data' => $this->config->pickup($this->config->product($product))]);
    }

    public function savePickup(Request $request, string $product): JsonResponse
    {
        $data = $request->validate([
            'required' => ['required', 'boolean'],
            'ask_flight' => ['nullable', 'boolean'],
            'points' => ['nullable', 'array', 'max:30'],
            'points.*.label' => ['required', 'string', 'min:3', 'max:150'],
            'points.*.kind' => ['nullable', Rule::in(array_keys(ProductBookingConfig::PICKUP_KINDS))],
            'points.*.requires_address' => ['nullable', 'boolean'],
        ], [
            'required.*' => 'Indica si el recojo es obligatorio.',
            'ask_flight.*' => 'Indica si se pide el número de vuelo.',
            'points.max' => 'Admite hasta 30 puntos de recojo.',
            'points.*.label.*' => 'Cada punto necesita un nombre de 3 a 150 caracteres.',
            'points.*.kind.*' => 'Elige el tipo de punto.',
            'points.*.requires_address.*' => 'Indica si el punto pide dirección.',
        ]);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->pickup($code, $version, $data, $this->actor($request)), 'pickup');
    }

    public function ruleOverrides(Request $request, string $product): JsonResponse
    {
        return response()->json(['data' => $this->config->ruleOverrides($this->config->product($product)->id)]);
    }

    public function saveRuleOverride(Request $request, string $product, string $rule): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['nullable', 'boolean'],
            'disabled' => ['nullable', 'boolean'],
            'params' => ['nullable', 'array'],
        ], [
            'enabled.*' => 'Indica si la regla se aplica a este producto.',
            'params.*' => 'Revisa los parámetros de la regla.',
        ]);

        return $this->saved($request, $product, fn (string $code, ?int $version) => $this->registry->override($code, $version, $rule, $data, $this->actor($request)), 'rules');
    }

    public function resetRuleOverride(Request $request, string $product, string $rule): Response
    {
        return $this->removed($request, $product, fn (string $code, ?int $version) => $this->registry->resetOverride($code, $version, $rule, $this->actor($request)));
    }

    private function addonData(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'min:3', 'max:150'],
            'category' => [$required, Rule::in(ProductBookingConfig::ADDON_CATEGORIES)],
            'price' => [$required, 'numeric', 'min:0', 'max:999999'],
            'currency' => [$required, Rule::in(CatalogAccess::CURRENCIES)],
            'charge_per' => [$required, Rule::in(['pax', 'reserva'])],
            'applies_to' => [$required, 'array', 'min:1'],
            'applies_to.*' => [Rule::in(ProductBookingConfig::PAX_TYPES), 'distinct'],
            'stock_note' => ['nullable', 'string', 'max:200'],
            'provider_id' => ['nullable', 'uuid'],
            'service_id' => ['nullable', 'uuid'],
            'is_optional' => ['nullable', 'boolean'],
        ], [
            'name.*' => 'El nombre va de 3 a 150 caracteres.',
            'category.*' => 'Elige la categoría.',
            'price.*' => 'El precio debe ser cero o mayor (CAT-AD-01).',
            'currency.*' => 'Elige una moneda activa (CAT-AD-01).',
            'charge_per.*' => 'Elige si se cobra por pasajero o por reserva.',
            'applies_to.*' => 'Elige al menos un tipo de pasajero (CAT-AD-01).',
            'stock_note.*' => 'La nota admite hasta 200 caracteres.',
            'provider_id.*' => 'Elige un proveedor válido.',
            'service_id.*' => 'Elige un servicio válido.',
            'is_optional.*' => 'Indica si el adicional es opcional.',
        ]);
    }

    private function legData(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'city' => [$required, 'string', 'min:2', 'max:80'],
            'destination_id' => ['nullable', 'uuid', Rule::exists('catalog_destinations', 'id')->whereNull('deleted_at')],
            'nights' => [$required, 'integer', 'between:1,30'],
            'sequence' => ['nullable', 'integer', 'between:1,60'],
        ], [
            'city.*' => 'Indica la ciudad del tramo.',
            'destination_id.*' => 'Elige un destino del catálogo.',
            'nights.*' => 'Cada tramo tiene de 1 a 30 noches (CAT-LG-01).',
            'sequence.*' => 'Indica el orden del tramo.',
        ]);
    }

    private function hotelData(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'min:3', 'max:150'],
            'category' => [$required, Rule::in(ProductBookingConfig::HOTEL_CATEGORIES)],
            'provider_id' => ['nullable', 'uuid'],
            'room_types' => [$required, 'array', 'min:1', 'max:6'],
            'room_types.*.room_type' => ['required', Rule::in(ProductBookingConfig::ROOM_TYPES)],
            'room_types.*.capacity' => ['required', 'integer', 'between:1,8'],
            'room_types.*.price_per_night' => ['required', 'numeric', 'gt:0', 'max:999999'],
        ], [
            'name.*' => 'El nombre del hotel va de 3 a 150 caracteres.',
            'category.*' => 'Elige la categoría del hotel.',
            'provider_id.*' => 'Elige un proveedor válido.',
            'room_types.*' => 'Agrega al menos un tipo de habitación (CAT-LG-01).',
            'room_types.*.room_type.*' => 'Elige el tipo de habitación.',
            'room_types.*.capacity.*' => 'La capacidad va de 1 a 8 personas (CAT-LG-01).',
            'room_types.*.price_per_night.*' => 'El precio por noche debe ser mayor que cero (CAT-LG-01).',
        ]);
    }

    private function lock(Request $request): ?int
    {
        $value = $request->input('lock_version') ?? $request->header('If-Match');

        return $value === null || $value === '' ? null : (int) trim((string) $value, 'W/" ');
    }

    private function saved(Request $request, string $product, callable $work, string $section, int $status = 200): JsonResponse
    {
        $row = $this->config->product($product);
        $work($row->code, $this->lock($request));
        $config = $this->config->config($row->code, $this->actor($request));

        return response()->json(['data' => $config[$section], 'meta' => ['lock_version' => $config['product']['lock_version']]], $status);
    }

    private function removed(Request $request, string $product, callable $work): Response
    {
        $row = $this->config->product($product);
        $work($row->code, $this->lock($request));

        return response()->noContent();
    }
}
