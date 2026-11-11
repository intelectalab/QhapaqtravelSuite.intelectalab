<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OpportunitySaveRequest extends FormRequest
{
    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'client_code' => [$creating ? 'required' : 'nullable', 'string', 'max:30'],
            'title' => ['required', 'string', 'max:200'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999'],
            'currency' => ['required', 'in:PEN,USD'],
            'expected_close_date' => ['required', 'date', ...($creating ? ['after_or_equal:today'] : [])],
            'probability' => [$creating ? 'nullable' : 'required', 'integer', 'min:0', 'max:100'],
            'owner_id' => ['nullable', 'uuid'],
            'stage' => ['nullable', 'in:calificacion,descubrimiento,cotizacion,negociacion'],
            'product_id' => ['nullable', 'uuid'],
            'destination' => ['nullable', 'string', 'max:120'],
            'pax' => ['nullable', 'integer', 'min:0', 'max:999'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lock_version' => [$creating ? 'nullable' : 'required', 'integer'],
            'origin' => ['nullable', 'in:manual,fidelizacion'],
            'confirm_open' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'client_code.required' => 'Elige el cliente.',
            'title.required' => 'Escribe un título para la oportunidad.',
            'amount.required' => 'Escribe el monto estimado.',
            'amount.gt' => 'El monto debe ser mayor que cero.',
            'currency.*' => 'Elige soles o dólares.',
            'expected_close_date.required' => 'Elige la fecha estimada de cierre.',
            'expected_close_date.after_or_equal' => 'La fecha de cierre no puede ser anterior a hoy.',
            'probability.*' => 'La probabilidad va de 0 a 100.',
            'pax.*' => 'Escribe un número de pasajeros válido.',
            'stage.in' => 'Elige una etapa abierta del embudo.',
        ];
    }
}
