<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class DemoRequestStoreRequest extends FormRequest
{
    public const TEAM_SIZES = ['1-5', '6-15', '16-50', '51+'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kind' => ['required', 'in:demo,trial'],
            'plan' => ['nullable', 'string', 'max:30'],
            'billing_cycle' => ['nullable', 'in:month,year'],
            'full_name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:190'],
            'phone' => ['nullable', 'string', 'regex:/^[0-9 +()-]{6,30}$/'],
            'company' => ['required', 'string', 'min:2', 'max:150'],
            'business_type' => ['required', 'in:'.implode(',', TenantProvisionRequest::BUSINESS_TYPES)],
            'city' => ['nullable', 'string', 'max:80'],
            'team_size' => ['required', 'in:'.implode(',', self::TEAM_SIZES)],
            'message' => ['nullable', 'string', 'max:1500'],
            'consent' => ['accepted'],
            'website' => ['nullable', 'string', 'max:200'],
        ];
    }

    public function messages(): array
    {
        return [
            'kind.*' => 'Elige si quieres una demo o una prueba.',
            'billing_cycle.*' => 'Elige un ciclo de facturación válido.',
            'full_name.*' => 'Escribe tu nombre completo.',
            'email.*' => 'Escribe un correo válido.',
            'phone.*' => 'Escribe un teléfono válido, solo números y +.',
            'company.*' => 'Escribe el nombre de tu agencia.',
            'business_type.*' => 'Elige el tipo de agencia.',
            'city.*' => 'La ciudad es demasiado larga.',
            'team_size.*' => 'Elige el tamaño de tu equipo.',
            'message.*' => 'El mensaje no puede superar 1 500 caracteres.',
            'consent.*' => 'Necesitamos tu autorización para contactarte.',
        ];
    }
}
