<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\PriceRuleRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\PricingRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PriceRuleController
{
    use ResolvesActor;

    public function __construct(private readonly PriceRuleRegistry $registry, private readonly PricingRules $rules) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->rules->overview($this->actor($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->registry->create($this->data($request), $this->actor($request))]], 201);
    }

    public function update(Request $request, string $ref): JsonResponse
    {
        $this->registry->update($ref, $this->data($request), $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function activate(Request $request, string $ref): JsonResponse
    {
        $this->registry->setActive($ref, true, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function deactivate(Request $request, string $ref): JsonResponse
    {
        $this->registry->setActive($ref, false, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function destroy(Request $request, string $ref): JsonResponse
    {
        $reason = (string) $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.'])['reason'];
        $this->registry->delete($ref, $reason, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function simulate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rate_id' => ['required', 'uuid'],
            'date' => ['required', 'date_format:Y-m-d'],
            'pax' => ['required', 'integer', 'between:1,500'],
            'channel' => ['required', Rule::in(PricingRules::CHANNELS)],
            'residency' => ['required', Rule::in(PricingRules::RESIDENCIES)],
            'extra' => ['nullable', 'numeric', 'between:0,9999999'],
            'discount_fixed' => ['nullable', 'numeric', 'between:0,9999999'],
            'markup_pct' => ['nullable', 'numeric', 'between:0,500'],
            'discount_pct' => ['nullable', 'numeric', 'between:0,100'],
        ], [
            'rate_id.*' => 'Elige la tarifa.',
            'date.*' => 'Indica la fecha del servicio.',
            'pax.*' => 'Indica entre 1 y 500 pasajeros.',
            'channel.*' => 'Elige el canal.',
            'residency.*' => 'Indica si el cliente es domiciliado.',
            'extra.*' => 'Los costos adicionales no son válidos.',
            'discount_fixed.*' => 'El descuento fijo no es válido.',
            'markup_pct.*' => 'El markup va de 0 a 500 %.',
            'discount_pct.*' => 'El descuento va de 0 a 100 %.',
        ]);

        return response()->json(['data' => $this->rules->simulate($data)]);
    }

    private function data(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'kind' => ['required', Rule::in(PricingRules::KINDS)],
            'value' => ['required', 'numeric', 'between:0,99999999'],
            'scope' => ['required', 'string', 'min:3', 'max:200'],
            'channel' => ['nullable', Rule::in(PricingRules::CHANNELS)],
            'min_pax' => ['nullable', 'integer', 'between:1,500'],
            'residency' => ['nullable', Rule::in(PricingRules::RESIDENCIES)],
            'product_id' => ['nullable', 'uuid', Rule::exists('catalog_products', 'id')->whereNull('deleted_at')],
            'currency' => ['nullable', Rule::in(CatalogAccess::CURRENCIES)],
            'priority' => ['nullable', 'integer', 'between:1,999'],
        ], [
            'name.*' => 'Ponle un nombre a la regla (3 a 120 caracteres).',
            'kind.*' => 'Elige el tipo de regla.',
            'value.*' => 'Indica el valor.',
            'scope.*' => 'Describe cuándo aplica (3 a 200 caracteres).',
            'channel.*' => 'El canal no es válido.',
            'min_pax.*' => 'El mínimo de pasajeros va de 1 a 500.',
            'residency.*' => 'Indica domiciliado o no domiciliado.',
            'product_id.*' => 'Elige un producto del catálogo.',
            'currency.*' => 'Elige la moneda.',
            'priority.*' => 'La prioridad va de 1 a 999.',
        ]);
    }
}
