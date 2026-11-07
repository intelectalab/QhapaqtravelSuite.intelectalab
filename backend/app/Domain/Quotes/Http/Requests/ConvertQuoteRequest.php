<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Requests;

use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Concurrency\IfMatch;
use Illuminate\Foundation\Http\FormRequest;

final class ConvertQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        $quote = $this->route('quote');

        return $quote instanceof Quote && ($this->user()?->can('convert', $quote) ?? false);
    }

    public function rules(): array
    {
        return [
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'lock_version' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'notes.max' => 'La nota no puede superar los 1 000 caracteres.',
        ];
    }

    public function lockVersion(): int
    {
        $body = $this->input('lock_version');

        return IfMatch::from($this, required: false)
            ?? (is_numeric($body) ? (int) $body : (int) IfMatch::from($this, required: true));
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
