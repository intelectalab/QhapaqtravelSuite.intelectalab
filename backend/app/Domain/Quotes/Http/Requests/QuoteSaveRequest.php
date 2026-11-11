<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class QuoteSaveRequest extends FormRequest
{
    public const STEPS = 4;

    public function step(): ?int
    {
        return $this->routeIs('quotes.preview') && $this->filled('step') ? max(1, min(self::STEPS, (int) $this->input('step'))) : null;
    }

    public function rules(): array
    {
        $preview = $this->routeIs('quotes.preview');
        $step = $this->step() ?? 0;
        $required = fn (int $from): string => ! $preview || $step >= $from ? 'required' : 'nullable';

        return [
            'client_code' => [$required(1), 'string', 'max:30'],
            'opportunity_code' => ['nullable', 'string', 'max:30'],
            'title' => [$required(1), 'string', 'max:200'],
            'travel_from' => [$required(2), 'date'],
            'travel_to' => [$required(2), 'date', 'after_or_equal:travel_from'],
            'valid_until' => ['nullable', 'date'],
            'currency' => ['required', 'in:PEN,USD'],
            'pax_adt' => ['nullable', 'integer', 'min:0', 'max:999'],
            'pax_chd' => ['nullable', 'integer', 'min:0', 'max:999'],
            'pax_inf' => ['nullable', 'integer', 'min:0', 'max:999'],
            'discount_pct' => ['nullable', 'numeric', 'min:0', 'max:50'],
            'tax_pct' => ['nullable', 'numeric', 'min:0', 'max:18'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'conditions' => ['nullable', 'string', 'max:4000'],
            'items' => [$required(3), 'array', ! $preview || $step >= 3 ? 'min:1' : 'min:0', 'max:60'],
            'items.*.product_code' => ['required', 'string', 'max:30'],
            'items.*.date' => ['required', 'date'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.pax' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.segment' => ['nullable', 'in:Adulto,Niño,Infante,Grupo,Pasajero'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.rate_id' => ['nullable', 'uuid'],
            'lock_version' => ['nullable', 'integer'],
            'step' => ['nullable', 'integer', 'min:1', 'max:'.self::STEPS],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->routeIs('quotes.preview') && ($this->step() ?? 0) < 2) {
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
            'items.required' => 'Agrega al menos un producto del catálogo.',
            'items.min' => 'Agrega al menos un producto del catálogo.',
            'items.*.date.required' => 'Cada ítem necesita su fecha.',
            'items.*.pax.min' => 'Cada ítem necesita al menos un pasajero.',
            'items.*.qty.min' => 'La cantidad debe ser al menos 1.',
            'items.*.unit_cost.min' => 'El costo unitario no puede ser negativo.',
            'tax_pct.max' => 'El IGV va de 0 a 18 %.',
            'tax_pct.min' => 'El IGV va de 0 a 18 %.',
            'discount_pct.max' => 'El descuento no puede pasar de 50 %.',
        ];
    }
}
