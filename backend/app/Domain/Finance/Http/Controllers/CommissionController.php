<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\CommissionWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\CommissionDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CommissionController
{
    use ResolvesActor;

    public function index(Request $request, CommissionDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function calculate(Request $request, CommissionWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);

        return response()->json(['data' => ['created' => $workflow->calculate($actor)]], 201);
    }

    public function approve(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $workflow->approve($code, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function pay(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate([
            'method' => ['required', 'string', 'max:40'],
            'reference' => ['required', 'string', 'max:80'],
        ], [
            'method.*' => 'Elige la forma de pago.',
            'reference.*' => 'Indica la referencia del pago (planilla, operación o nota de crédito).',
        ]);
        $workflow->pay($code, $data['method'], $data['reference'], $actor);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function annul(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->annul($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
