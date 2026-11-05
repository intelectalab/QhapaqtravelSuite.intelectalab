<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TenantStatusRequest extends FormRequest
{
    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'min:5', 'max:500']];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Escribe el motivo.',
            'reason.min' => 'Explica el motivo con un poco más de detalle.',
        ];
    }
}
