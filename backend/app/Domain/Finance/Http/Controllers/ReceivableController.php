<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\ReceivableWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\ReceivableDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

final class ReceivableController
{
    use ResolvesActor;

    public function index(Request $request, ReceivableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function summary(Request $request, ReceivableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->summary($this->actor($request))]);
    }

    public function account(string $code, ReceivableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->account($code)]);
    }

    public function statement(Request $request, string $code, ReceivableWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate(['email' => ['nullable', 'email', 'max:150']], ['email.*' => 'Revisa el correo.']);

        return response()->json(['data' => $workflow->sendStatement($code, $data['email'] ?? null, $actor)]);
    }

    public function registerPayment(Request $request, ReceivableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'receivable_id' => ['required', 'string', 'max:40'],
            'method' => ['required', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'reference' => ['nullable', 'string', 'max:80'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'receivable_id.*' => 'Indica la cuota que se paga.',
            'method.*' => 'Elige el medio de pago.',
            'amount.*' => 'El monto debe ser mayor que cero.',
            'paid_on.required' => 'Indica la fecha del pago.',
            'paid_on.before_or_equal' => 'La fecha del pago no puede ser futura.',
            'paid_on.date' => 'Revisa la fecha del pago.',
            'reference.*' => 'La referencia admite hasta 80 caracteres.',
            'fx_rate.*' => 'El tipo de cambio debe estar entre 0.5 y 20.',
            'note.*' => 'La observación admite hasta 500 caracteres.',
        ]);
        $code = (string) Arr::pull($data, 'receivable_id');
        $payment = $workflow->registerPayment($code, $data, $this->actor($request));

        return response()->json(['data' => ['payment' => $payment]], 201);
    }

    public function advance(Request $request, ReceivableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'reservation' => ['required', 'string', 'max:30'],
            'pct' => ['nullable', 'numeric', 'gt:0', 'lte:100'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'due_date' => ['required', 'date', 'after_or_equal:today'],
            'concept' => ['required', 'string', 'min:3', 'max:255'],
            'notify' => ['nullable', 'boolean'],
        ], [
            'reservation.*' => 'Elige la reserva.',
            'pct.*' => 'El porcentaje va de 1 a 100.',
            'amount.*' => 'El importe debe ser mayor que cero.',
            'due_date.*' => 'El vencimiento no puede ser una fecha pasada.',
            'concept.*' => 'Describe el anticipo (3 a 255 caracteres).',
        ]);

        return response()->json(['data' => ['code' => $workflow->requestAdvance($data, $this->actor($request))]], 201);
    }

    public function remind(Request $request, string $code, ReceivableWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->remind($code, $this->actor($request))], 201);
    }

    public function cancel(Request $request, string $code, ReceivableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->cancel($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
