<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use App\Domain\Crm\Support\ClientDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class ClientSaveRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'kind' => ['required', 'in:persona,empresa'],
            'name' => ['required', 'string', 'max:200'],
            'doc_type' => ['required', Rule::in(ClientDocument::TYPES)],
            'doc_number' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'country' => ['nullable', 'string', 'max:80'],
            'city' => ['nullable', 'string', 'max:80'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'segment' => ['nullable', 'string', 'max:40'],
            'owner_id' => ['nullable', 'uuid'],
            'tags' => ['nullable', 'string', 'max:400'],
            'confirm_duplicate' => ['nullable', 'boolean'],
            'contact_name' => ['nullable', 'string', 'max:160'],
            'contact_role' => ['nullable', 'string', 'max:120'],
            'contact_email' => ['nullable', 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
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
            'kind.required' => 'Elige si es persona o empresa.',
            'name.required' => 'Escribe el nombre o la razón social.',
            'doc_type.required' => 'Elige el tipo de documento.',
            'doc_number.required' => 'Escribe el número de documento.',
            'email.regex' => 'Escribe un correo válido.',
            'contact_email.regex' => 'Escribe un correo válido para el contacto.',
            'birth_date.before' => 'La fecha de nacimiento debe ser anterior a hoy.',
        ];
    }
}
