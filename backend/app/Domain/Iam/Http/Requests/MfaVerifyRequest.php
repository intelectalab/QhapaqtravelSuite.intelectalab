<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class MfaVerifyRequest extends FormRequest
{
    public function rules(): array
    {
        return ['code' => ['required', 'string', 'regex:/^\s*\d{3}\s?\d{3}\s*$/']];
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Escribe el código de 6 dígitos.',
            'code.regex' => 'El código tiene 6 dígitos.',
        ];
    }
}
