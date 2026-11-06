<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Requests;

use App\Domain\Catalog\Support\ProductOptions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ProductSaveRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'internal_name' => ['nullable', 'string', 'max:160'],
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9-]+$/'],
            'sku' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9-]+$/'],
            'type_id' => ['required', 'uuid'],
            'category_id' => ['required', 'uuid'],
            'subcategory_id' => ['nullable', 'uuid'],
            'destination_id' => ['required', 'uuid'],
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
            'is_b2b' => ['nullable', 'boolean'],
            'is_ecommerce' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'markup_pct' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'availability_model' => ['nullable', Rule::in(ProductOptions::AVAILABILITY)],
            'lock_version' => ['nullable', 'integer'],
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
        ];
    }
}
