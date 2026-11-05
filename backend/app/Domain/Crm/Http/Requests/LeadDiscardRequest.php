<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class LeadDiscardRequest extends FormRequest
{
    public function rules(): array
    {
        return ['reason' => ['required', 'string'], 'detail' => ['nullable', 'string', 'max:1000'], 'lock_version' => ['required', 'integer']];
    }

    public function messages(): array
    {
        return ['reason.required' => 'Elige el motivo.'];
    }
}
