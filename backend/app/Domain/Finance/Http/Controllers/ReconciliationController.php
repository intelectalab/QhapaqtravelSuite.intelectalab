<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\ReconciliationWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\ReconciliationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReconciliationController
{
    use ResolvesActor;

    public function index(Request $request, ReconciliationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function confirm(Request $request, string $code, ReconciliationWorkflow $workflow): JsonResponse
    {
        $workflow->confirm($code, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reject(Request $request, string $code, ReconciliationWorkflow $workflow): JsonResponse
    {
        $workflow->reject($code, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resolve(Request $request, string $code, ReconciliationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'resolution' => ['required', 'in:otro_ingreso,gasto_bancario'],
            'note' => ['required', 'string', 'min:5', 'max:500'],
        ], [
            'resolution.*' => 'Elige cómo se resuelve la línea.',
            'note.*' => 'Escribe el sustento (mínimo 5 caracteres).',
        ]);
        $workflow->resolve($code, $data['resolution'], $data['note'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
