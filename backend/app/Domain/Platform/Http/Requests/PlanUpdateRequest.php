<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Requests;

use App\Domain\Platform\Support\PlanCatalog;
use Illuminate\Foundation\Http\FormRequest;

final class PlanUpdateRequest extends FormRequest
{
    public function rules(): array
    {
        $limits = collect(PlanCatalog::METRICS)->mapWithKeys(fn (string $metric) => ["limits.{$metric}" => ['present', 'nullable', 'integer', 'min:0', 'max:100000000']])->all();

        return [
            'price_month' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'price_year' => ['required', 'numeric', 'min:0', 'max:12000000'],
            'trial_days' => ['required', 'integer', 'min:0', 'max:60'],
            'support_level' => ['nullable', 'string', 'max:80'],
            'limits' => ['required', 'array'],
            ...$limits,
        ];
    }

    public function messages(): array
    {
        return [
            'price_month.required' => 'Escribe el precio mensual.',
            'price_year.required' => 'Escribe el precio anual.',
            'trial_days.max' => 'La prueba gratis puede durar hasta 60 días.',
            'limits.*.integer' => 'Los límites son números enteros.',
            'limits.*.min' => 'Los límites no pueden ser negativos.',
        ];
    }
}
