<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\PaymentWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\PaymentDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PaymentController
{
    use ResolvesActor;

    public function index(Request $request, PaymentDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function confirm(Request $request, string $code, PaymentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['receivable' => ['nullable', 'string', 'max:30']], ['receivable.*' => 'Elige la cuota a la que se aplica.']);
        $workflow->confirm($code, $data['receivable'] ?? null, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function validatePayment(Request $request, string $code, PaymentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'apply' => ['sometimes', 'boolean'],
            'receivable_id' => ['nullable', 'string', 'max:40'],
        ], ['apply.*' => 'Indica si el pago se aplica a una cuota.', 'receivable_id.*' => 'Elige la cuota a la que se aplica.']);
        $workflow->confirm($code, $data['receivable_id'] ?? null, $this->actor($request), (bool) ($data['apply'] ?? false));

        return response()->json(['data' => $this->state($code)]);
    }

    public function apply(Request $request, string $code, PaymentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['receivable_id' => ['required', 'string', 'max:40']], ['receivable_id.*' => 'Elige la cuota a la que se aplica.']);
        $workflow->applyConfirmed($code, $data['receivable_id'], $this->actor($request));

        return response()->json(['data' => $this->state($code)]);
    }

    public function reject(Request $request, string $code, PaymentWorkflow $workflow): JsonResponse
    {
        $workflow->reject($code, $this->reason($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function retry(Request $request, string $code, PaymentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500'], 'lock_version' => ['nullable', 'integer']], ['note.*' => 'La nota admite hasta 500 caracteres.']);
        $workflow->retry($code, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $data['note'] ?? null, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function revert(Request $request, string $code, PaymentWorkflow $workflow): JsonResponse
    {
        $workflow->revert($code, $this->reason($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function state(string $code): array
    {
        $payment = DB::table('fin_payments as p')->leftJoin('fin_receivables as r', 'r.id', '=', 'p.receivable_id')->where('p.code', $code)->first(['p.code', 'p.status', 'p.lock_version', 'r.code as receivable']);

        return ['code' => $code, 'status' => $payment?->status, 'receivable' => $payment?->receivable, 'lock_version' => $payment === null ? null : (int) $payment->lock_version];
    }

    private function reason(Request $request): string
    {
        return $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo (mínimo 5 caracteres).'])['reason'];
    }
}
