<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class LeadStoreRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'company' => ['nullable', 'string', 'max:160'],
            'email' => ['nullable', 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'channel' => ['required', 'string'],
            'source' => ['required', 'string'],
            'interest' => ['required', 'string'],
            'destination' => ['nullable', 'string', 'max:120'],
            'destination_id' => ['nullable', 'uuid'],
            'product_id' => ['nullable', 'uuid'],
            'owner_id' => ['nullable', 'uuid'],
            'travel_date' => ['nullable', 'date', ...($this->isMethod('post') ? ['after_or_equal:today'] : [])],
            'pax' => ['nullable', 'integer', 'min:0', 'max:999'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'duplicate_resolution' => ['nullable', 'in:create_new,mark_duplicate,merge'],
            'merge_into' => ['nullable', 'string', 'max:30'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $digits = strlen(preg_replace('/\D/', '', (string) $this->input('phone')));
                if (! $this->filled('email') && $digits < 7) {
                    $validator->errors()->add('email', 'Registra al menos un correo o un teléfono de 7 dígitos o más.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre.',
            'channel.required' => 'Elige el canal.',
            'source.required' => 'Elige la fuente.',
            'interest.required' => 'Elige el interés.',
            'email.regex' => 'Escribe un correo válido.',
            'travel_date.after_or_equal' => 'La fecha de viaje no puede ser anterior a hoy.',
        ];
    }
}
