<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class LeadQualifyRequest extends FormRequest
{
    public function rules(): array
    {
        $points = ['required', 'integer', 'in:0,10,18,25'];

        return [
            'budget' => $points,
            'authority' => $points,
            'need' => $points,
            'timeline' => $points,
            'amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'in:PEN,USD'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'mark_qualified' => ['boolean'],
            'lock_version' => ['required', 'integer'],
        ];
    }
}
