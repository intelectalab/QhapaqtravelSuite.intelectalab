<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\ReconciliationOperations;
use App\Domain\Finance\Actions\ReconciliationWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\ReconciliationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

final class ReconciliationController
{
    use ResolvesActor;

    public function index(Request $request, ReconciliationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function import(Request $request, ReconciliationOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'bank' => ['required_without:bank_account', 'nullable', 'string', 'max:20'],
            'bank_account' => ['nullable', 'string', 'max:20'],
            'file' => ['required', 'file', 'max:2048', 'extensions:csv,txt,xlsx'],
        ], [
            'bank.*' => 'Indica el banco del extracto.',
            'file.*' => 'Sube el extracto en CSV, TXT o XLSX (hasta 2 MB).',
        ]);
        $file = $request->file('file');
        assert($file instanceof UploadedFile);

        return response()->json(['data' => $operations->import($data, $file, $this->actor($request))], 202);
    }

    public function matching(Request $request, ReconciliationOperations $operations): JsonResponse
    {
        return response()->json(['data' => $operations->matching($this->actor($request))]);
    }

    public function closures(ReconciliationOperations $operations): JsonResponse
    {
        return response()->json(['data' => $operations->closures()]);
    }

    public function close(Request $request, ReconciliationOperations $operations): JsonResponse
    {
        return response()->json(['data' => $operations->close($this->actor($request))]);
    }

    public function candidates(string $code, ReconciliationWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->candidates($code)]);
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
            'resolution' => ['required', 'in:asignado,otro_ingreso,gasto_bancario'],
            'target' => ['required_if:resolution,asignado', 'nullable', 'string', 'max:30'],
            'note' => ['required', 'string', 'min:5', 'max:500'],
        ], [
            'resolution.*' => 'Elige cómo se resuelve la línea.',
            'target.*' => 'Elige el pago u obligación a asignar.',
            'note.*' => 'Escribe el sustento (mínimo 5 caracteres).',
        ]);
        $workflow->resolve($code, $data['resolution'], $data['target'] ?? null, $data['note'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
