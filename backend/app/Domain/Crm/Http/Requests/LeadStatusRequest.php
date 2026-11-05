<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class LeadStatusRequest extends FormRequest
{
    public function rules(): array
    {
        return ['status' => ['required', 'in:nuevo,contactado,calificado'], 'lock_version' => ['required', 'integer']];
    }

    public function messages(): array
    {
        return ['status.in' => 'Ese estado se cambia con su propia acción.'];
    }
}
