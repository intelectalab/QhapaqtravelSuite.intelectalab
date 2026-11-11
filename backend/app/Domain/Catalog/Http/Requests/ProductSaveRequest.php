<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Requests;

use App\Domain\Catalog\Support\ProductOptions;
use App\Domain\Catalog\Support\ProductSectionRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ProductSaveRequest extends FormRequest
{
    public function step(): int
    {
        return $this->routeIs('catalog.products.preview') ? max(1, min(10, (int) $this->input('step', 10))) : 10;
    }

    public function rules(): array
    {
        $step = $this->step();
        $required = fn (int $from) => $step >= $from ? 'required' : 'nullable';
        $sections = $this->routeIs('catalog.products.update') ? ProductSectionRules::destinations() : $this->sections($step);

        return [
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'internal_name' => ['nullable', 'string', 'max:160'],
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9-]+$/'],
            'sku' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9-]+$/'],
            'type_id' => ['required', 'uuid'],
            'category_id' => [$required(2), 'uuid'],
            'subcategory_id' => ['nullable', 'uuid'],
            'destination_id' => [$required(3), 'uuid'],
            'provider_id' => ['nullable', 'uuid'],
            'short_description' => ['nullable', 'string', 'max:600'],
            'duration_value' => ['required', 'numeric', 'min:1', 'max:365'],
            'duration_unit' => ['required', Rule::in(ProductOptions::UNITS)],
            'modality' => ['required', Rule::in(ProductOptions::MODALITIES)],
            'minimum_passengers' => ['required', 'integer', 'min:1', 'max:999'],
            'maximum_passengers' => ['required', 'integer', 'min:1', 'max:999'],
            'minimum_age' => ['required', 'integer', 'min:0', 'max:120'],
            'maximum_age' => ['required', 'integer', 'min:0', 'max:120'],
            'booking_advance_min_days' => ['required', 'integer', 'min:0', 'max:730'],
            'booking_advance_max_days' => ['required', 'integer', 'min:0', 'max:730'],
            'is_bookable' => ['nullable', 'boolean'],
            'is_quoteable' => ['nullable', 'boolean'],
            'is_b2b' => ['nullable', 'boolean'],
            'is_ecommerce' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'markup_pct' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'availability_model' => ['nullable', Rule::in(ProductOptions::AVAILABILITY)],
            'lock_version' => ['nullable', 'integer'],
            'step' => ['nullable', 'integer', 'min:1', 'max:10'],
            ...$sections,
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del producto.',
            'name.min' => 'El nombre necesita al menos 3 letras.',
            'code.required' => 'Escribe el código interno.',
            'code.regex' => 'El código solo lleva letras, números y guiones.',
            'sku.regex' => 'El SKU solo lleva letras, números y guiones.',
            'type_id.required' => 'Elige el tipo de producto.',
            'category_id.required' => 'Elige la categoría.',
            'destination_id.required' => 'Elige el destino.',
            'duration_value.required' => 'Escribe la duración.',
            'duration_value.min' => 'La duración mínima es 1.',
            'duration_unit.*' => 'Elige la unidad de duración.',
            'modality.*' => 'Elige la modalidad.',
            'minimum_passengers.*' => 'Escribe el mínimo de pasajeros (1 o más).',
            'maximum_passengers.*' => 'Escribe el máximo de pasajeros.',
            'minimum_age.*' => 'Escribe la edad mínima.',
            'maximum_age.*' => 'Escribe la edad máxima.',
            'booking_advance_min_days.*' => 'Escribe los días mínimos de anticipación.',
            'booking_advance_max_days.*' => 'Escribe los días máximos de anticipación.',
            'type_id.uuid' => 'Elige el tipo de producto.',
            'category_id.uuid' => 'Elige la categoría.',
            'destination_id.uuid' => 'Elige el destino.',
            ...ProductSectionRules::messages(),
        ];
    }

    private function sections(int $step): array
    {
        $rules = [];

        foreach (ProductSectionRules::STEPS as $key => $from) {
            if ($step < $from || ! $this->has($key) || $this->input($key) === null) {
                continue;
            }

            $rules = [...$rules, ...match ($key) {
                'secondary_destination_ids' => ProductSectionRules::destinations(),
                'components' => ProductSectionRules::components(),
                'itinerary' => ProductSectionRules::itinerary(),
                'rates' => ProductSectionRules::rates(),
                'season_ids' => ProductSectionRules::seasons(),
                'availability' => ['availability' => ['array'], ...ProductSectionRules::availability('availability.')],
                'content' => ['content' => ['array'], ...ProductSectionRules::content('content.')],
                'policies' => ['policies' => ['array'], ...ProductSectionRules::policies('policies.')],
                'channels' => ProductSectionRules::channels(),
            }];
        }

        return $rules;
    }
}
