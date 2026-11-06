<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\ReceivableWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\ReceivableDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReceivableController
{
    use ResolvesActor;

    public function index(Request $request, ReceivableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function registerPayment(Request $request, string $code, ReceivableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'reference' => ['nullable', 'string', 'max:80'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'method.*' => 'Elige el medio de pago.',
            'amount.*' => 'El monto debe ser mayor que cero.',
            'paid_on.required' => 'Indica la fecha del pago.',
            'paid_on.before_or_equal' => 'La fecha del pago no puede ser futura.',
            'paid_on.date' => 'Revisa la fecha del pago.',
            'reference.*' => 'La referencia admite hasta 80 caracteres.',
            'fx_rate.*' => 'El tipo de cambio debe estar entre 0.5 y 20.',
            'note.*' => 'La observación admite hasta 500 caracteres.',
        ]);
        $payment = $workflow->registerPayment($code, $data, $this->actor($request));

        return response()->json(['data' => ['payment' => $payment]], 201);
    }

    public function cancel(Request $request, string $code, ReceivableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->cancel($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
