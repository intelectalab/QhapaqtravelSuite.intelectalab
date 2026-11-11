<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\PaymentWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\PaymentDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    private function reason(Request $request): string
    {
        return $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo (mínimo 5 caracteres).'])['reason'];
    }
}
