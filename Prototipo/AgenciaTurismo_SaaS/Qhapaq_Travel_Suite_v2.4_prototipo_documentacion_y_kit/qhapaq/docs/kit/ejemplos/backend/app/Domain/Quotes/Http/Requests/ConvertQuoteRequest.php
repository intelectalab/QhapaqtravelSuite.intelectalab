<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Requests;

use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Concurrency\IfMatch;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/quotes/{id}/convert (operationId `quotesConvert`, x-permission `reservations.create`,
 * x-idempotency required, If-Match requerido). Cuerpo `ActionBody` (libre) en el contrato.
 *
 * - authorize(): delega en QuotePolicy::convert (ownership de Ventas, SEC-BR-09). El permiso
 *   `reservations.create` ya lo exige el middleware de ruta `permission:` (403 con required_permissions).
 * - rules(): `notes` opcional (SUPUESTO: la spec no define cuerpo; se admite una nota que se agrega a `notes`).
 * - Mensajes en español (lang/es/validation.php + messages()).
 * - El esquema Zod del frontend es espejo de estas reglas (ver ejemplos/web/src/features/…).
 */
final class ConvertQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Quote $quote */
        $quote = $this->route('quote');

        return $this->user()?->can('convert', $quote) ?? false;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'notes.max' => 'La nota no puede superar los 1 000 caracteres.',
        ];
    }

    /** lock_version enviado en If-Match (obligatorio en esta operación). */
    public function lockVersion(): int
    {
        return (int) IfMatch::from($this, required: true);
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key'); // presencia ya validada por IdempotencyMiddleware
    }
}
