<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class QuoteSaveRequest extends FormRequest
{
    public function rules(): array
    {
        $preview = $this->routeIs('quotes.preview');
        $required = $preview ? 'nullable' : 'required';

        return [
            'client_code' => [$required, 'string', 'max:30'],
            'opportunity_code' => ['nullable', 'string', 'max:30'],
            'title' => [$required, 'string', 'max:200'],
            'travel_from' => [$required, 'date'],
            'travel_to' => [$required, 'date', 'after_or_equal:travel_from'],
            'valid_until' => ['nullable', 'date'],
            'currency' => ['required', 'in:PEN,USD'],
            'pax_adt' => ['nullable', 'integer', 'min:0', 'max:999'],
            'pax_chd' => ['nullable', 'integer', 'min:0', 'max:999'],
            'pax_inf' => ['nullable', 'integer', 'min:0', 'max:999'],
            'discount_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tax_pct' => ['nullable', 'numeric', 'in:0,18'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => [$preview ? 'nullable' : 'required', 'array', $preview ? 'min:0' : 'min:1', 'max:60'],
            'items.*.product_code' => ['required', 'string', 'max:30'],
            'items.*.date' => ['required', 'date'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.pax' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.segment' => ['nullable', 'in:Adulto,Niño,Infante,Grupo,Pasajero'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lock_version' => ['nullable', 'integer'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->routeIs('quotes.preview')) {
                    return;
                }
                if ((int) $this->input('pax_adt') + (int) $this->input('pax_chd') + (int) $this->input('pax_inf') <= 0) {
                    $validator->errors()->add('pax_adt', 'Indica al menos un pasajero.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'client_code.required' => 'Elige el cliente.',
            'title.required' => 'Escribe un título para la cotización.',
            'travel_from.required' => 'Elige la fecha de inicio del viaje.',
            'travel_to.required' => 'Elige la fecha de fin del viaje.',
            'travel_to.after_or_equal' => 'La fecha de fin del viaje no puede ser anterior al inicio.',
            'items.required' => 'Agrega al menos un servicio.',
            'items.min' => 'Agrega al menos un servicio.',
            'items.*.date.required' => 'Cada servicio necesita su fecha.',
            'items.*.pax.min' => 'Cada servicio necesita al menos un pasajero.',
            'items.*.qty.min' => 'La cantidad debe ser al menos 1.',
        ];
    }
}
