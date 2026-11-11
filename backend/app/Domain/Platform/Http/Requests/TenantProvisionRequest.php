<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Requests;

use App\Domain\Admin\Support\SettingsCatalog;
use Illuminate\Foundation\Http\FormRequest;

final class TenantProvisionRequest extends FormRequest
{
    public const BUSINESS_TYPES = ['Agencia de viajes minorista', 'Operador turístico', 'DMC / receptivo', 'Agencia corporativa', 'Agencia mayorista'];

    public const COUNTRIES = ['Perú', 'Bolivia', 'Chile', 'Ecuador', 'Colombia'];

    public const LOCALES = ['es-PE' => 'Español (Perú)', 'es-419' => 'Español (Latinoamérica)', 'en-US' => 'Inglés'];

    public const BASE_CURRENCIES = ['PEN' => 'Sol peruano', 'USD' => 'Dólar estadounidense', 'BOB' => 'Boliviano', 'CLP' => 'Peso chileno'];

    public const ALT_CURRENCIES = ['USD' => 'Dólar estadounidense', 'PEN' => 'Sol peruano', 'EUR' => 'Euro'];

    public const TEMPLATES = ['standard' => 'Estándar KipuControl (recomendada)', 'minimal' => 'Mínimo privilegio'];

    public const STEP_FIELDS = [
        1 => ['commercial_name', 'subdomain', 'plan', 'status'],
        2 => ['legal_name', 'ruc', 'fiscal_address', 'business_type', 'legal_rep'],
        3 => ['country', 'locale', 'base_currency', 'alt_currency', 'timezone'],
        4 => ['sede_name', 'sede_city', 'sede_address', 'sede_phone'],
        5 => ['admin_name', 'admin_email', 'admin_phone', 'admin_mfa'],
        6 => ['roles'],
        7 => ['permission_template'],
        8 => ['quote_validity_days', 'hold_minutes', 'markup_pct', 'max_discount_pct'],
        9 => ['tax_pct', 'rounding', 'advance_pct', 'fx_rate', 'fx_source', 'invoice_series', 'receipt_series'],
        10 => ['channels'],
    ];

    public function rules(): array
    {
        $partial = $this->routeIs('platform.tenants.validate');
        $updating = $this->routeIs('platform.tenants.update');
        $required = $partial ? 'sometimes' : 'required';
        $onCreate = $partial || $updating ? 'sometimes' : 'required';
        $rules = [
            'commercial_name' => [$required, 'string', 'max:120'],
            'legal_name' => [$required, 'string', 'max:200'],
            'ruc' => [$required, 'regex:/^(10|15|17|20)\d{9}$/'],
            'fiscal_address' => [$required, 'string', 'max:250'],
            'business_type' => [$required, 'in:'.implode(',', self::BUSINESS_TYPES)],
            'subdomain' => [$required, 'regex:/^[a-z0-9-]{3,30}$/'],
            'plan' => [$onCreate, 'string', 'max:20'],
            'status' => ['nullable', 'in:prueba,activo'],
            'legal_rep' => ['nullable', 'string', 'max:150'],
            'country' => ['nullable', 'in:'.implode(',', self::COUNTRIES)],
            'locale' => ['nullable', 'in:'.implode(',', array_keys(self::LOCALES))],
            'base_currency' => ['nullable', 'in:'.implode(',', array_keys(self::BASE_CURRENCIES))],
            'alt_currency' => ['nullable', 'in:'.implode(',', array_keys(self::ALT_CURRENCIES)), 'different:base_currency'],
            'timezone' => ['nullable', 'in:'.implode(',', SettingsCatalog::TIMEZONES)],
            'sede_name' => [$onCreate, 'string', 'max:120'],
            'sede_city' => [$onCreate, 'string', 'max:80'],
            'sede_address' => [$onCreate, 'string', 'max:250'],
            'sede_phone' => ['nullable', 'string', 'max:30'],
            'admin_name' => [$onCreate, 'string', 'max:150'],
            'admin_email' => [$onCreate, 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
            'admin_phone' => ['nullable', 'string', 'max:30'],
            'admin_mfa' => ['nullable', 'boolean'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', 'max:40'],
            'permission_template' => ['nullable', 'in:'.implode(',', array_keys(self::TEMPLATES))],
            'quote_validity_days' => ['nullable', 'integer', 'between:1,60'],
            'hold_minutes' => ['nullable', 'integer', 'between:5,1440'],
            'markup_pct' => ['nullable', 'numeric', 'between:0,100'],
            'max_discount_pct' => ['nullable', 'numeric', 'between:0,30'],
            'tax_pct' => ['nullable', 'numeric', 'between:0,30'],
            'rounding' => ['nullable', 'in:'.implode(',', array_keys(SettingsCatalog::ROUNDING))],
            'advance_pct' => ['nullable', 'numeric', 'between:0,100'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0', 'max:100000'],
            'fx_source' => ['nullable', 'in:'.implode(',', SettingsCatalog::FX_SOURCES)],
            'invoice_series' => ['nullable', 'regex:/^F[A-Z0-9]{3}$/'],
            'receipt_series' => ['nullable', 'regex:/^B[A-Z0-9]{3}$/'],
            'channels' => ['nullable', 'array'],
            'channels.*' => ['string', 'in:'.implode(',', array_keys(SettingsCatalog::CHANNELS))],
            'step' => ['nullable', 'integer', 'between:1,11'],
        ];

        $step = $partial ? (int) $this->input('step', 0) : 0;

        if ($step > 0 && isset(self::STEP_FIELDS[$step])) {
            foreach (self::STEP_FIELDS[$step] as $field) {
                if (in_array('sometimes', $rules[$field], true) && in_array($field, ['commercial_name', 'legal_name', 'ruc', 'fiscal_address', 'business_type', 'subdomain', 'plan', 'sede_name', 'sede_city', 'sede_address', 'admin_name', 'admin_email'], true)) {
                    $rules[$field] = array_map(fn ($rule) => $rule === 'sometimes' ? 'required' : $rule, $rules[$field]);
                }
            }
        }

        return $rules;
    }

    public function prepareForValidation(): void
    {
        if ($this->has('subdomain')) {
            $this->merge(['subdomain' => strtolower(trim((string) $this->input('subdomain')))]);
        }

        foreach (['invoice_series', 'receipt_series'] as $field) {
            if ($this->filled($field)) {
                $this->merge([$field => strtoupper(trim((string) $this->input($field)))]);
            }
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
            'country.*' => 'Elige el país.',
            'locale.*' => 'Elige el idioma.',
            'base_currency.*' => 'Elige la moneda base.',
            'alt_currency.different' => 'La moneda alterna debe ser distinta de la moneda base.',
            'alt_currency.*' => 'Elige la moneda alterna.',
            'timezone.*' => 'Elige la zona horaria.',
            'sede_name.required' => 'Escribe el nombre de la sede principal.',
            'sede_city.required' => 'Escribe la ciudad de la sede.',
            'sede_address.required' => 'Escribe la dirección de la sede.',
            'admin_name.required' => 'Escribe el nombre del administrador.',
            'admin_email.required' => 'Escribe el correo del administrador.',
            'admin_email.regex' => 'Escribe un correo válido.',
            'permission_template.*' => 'Elige la plantilla de permisos.',
            'quote_validity_days.*' => 'La validez de la cotización va de 1 a 60 días.',
            'hold_minutes.*' => 'El bloqueo de cupos va de 5 a 1 440 minutos.',
            'markup_pct.*' => 'El margen va de 0 a 100 %.',
            'max_discount_pct.*' => 'El descuento máximo sin aprobación no puede superar el 30 %.',
            'tax_pct.*' => 'El IGV va de 0 a 30 %.',
            'rounding.*' => 'Elige el redondeo.',
            'advance_pct.*' => 'El anticipo va de 0 a 100 %.',
            'fx_rate.*' => 'El tipo de cambio debe ser mayor que cero.',
            'fx_source.*' => 'Elige la fuente del tipo de cambio.',
            'invoice_series.regex' => 'La serie de facturas es F seguida de 3 letras o números, por ejemplo F001.',
            'receipt_series.regex' => 'La serie de boletas es B seguida de 3 letras o números, por ejemplo B001.',
            'channels.*' => 'Hay un canal que no existe.',
        ];
    }
}
