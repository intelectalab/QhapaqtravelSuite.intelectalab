<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TenantProvisionRequest extends FormRequest
{
    public const BUSINESS_TYPES = ['Agencia de viajes minorista', 'Operador turístico', 'DMC / receptivo', 'Agencia corporativa', 'Agencia mayorista'];

    public function rules(): array
    {
        $partial = $this->routeIs('platform.tenants.validate');
        $updating = $this->routeIs('platform.tenants.update');
        $required = $partial ? 'sometimes' : 'required';
        $onCreate = $partial || $updating ? 'sometimes' : 'required';

        return [
            'commercial_name' => [$required, 'string', 'max:120'],
            'legal_name' => [$required, 'string', 'max:200'],
            'ruc' => [$required, 'regex:/^(10|15|17|20)\d{9}$/'],
            'fiscal_address' => [$required, 'string', 'max:250'],
            'business_type' => [$required, 'in:'.implode(',', self::BUSINESS_TYPES)],
            'subdomain' => [$required, 'regex:/^[a-z0-9-]{3,30}$/'],
            'plan' => [$onCreate, 'string', 'max:20'],
            'status' => ['nullable', 'in:prueba,activo'],
            'sede_name' => [$onCreate, 'string', 'max:120'],
            'sede_city' => [$onCreate, 'string', 'max:80'],
            'sede_address' => [$onCreate, 'string', 'max:250'],
            'admin_name' => [$onCreate, 'string', 'max:150'],
            'admin_email' => [$onCreate, 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
        ];
    }

    public function prepareForValidation(): void
    {
        if ($this->has('subdomain')) {
            $this->merge(['subdomain' => strtolower(trim((string) $this->input('subdomain')))]);
        }
    }

    public function messages(): array
    {
        return [
            'commercial_name.required' => 'Escribe el nombre comercial.',
            'legal_name.required' => 'Escribe la razón social.',
            'ruc.required' => 'Escribe el RUC.',
            'ruc.regex' => 'El RUC tiene 11 dígitos y empieza con 10, 15, 17 o 20.',
            'fiscal_address.required' => 'Escribe el domicilio fiscal.',
            'business_type.*' => 'Elige el tipo de negocio.',
            'subdomain.required' => 'Escribe el subdominio.',
            'subdomain.regex' => 'Subdominio inválido: de 3 a 30 caracteres, solo letras minúsculas, números y guiones.',
            'plan.required' => 'Elige el plan.',
            'sede_name.required' => 'Escribe el nombre de la sede principal.',
            'sede_city.required' => 'Escribe la ciudad de la sede.',
            'sede_address.required' => 'Escribe la dirección de la sede.',
            'admin_name.required' => 'Escribe el nombre del administrador.',
            'admin_email.required' => 'Escribe el correo del administrador.',
            'admin_email.regex' => 'Escribe un correo válido.',
        ];
    }
}
