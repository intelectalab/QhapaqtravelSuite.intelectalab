<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\TreasuryMovementWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\TreasuryDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TreasuryController
{
    use ResolvesActor;

    public function index(Request $request, TreasuryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function store(Request $request, TreasuryMovementWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'account' => ['required', 'string', 'max:20'],
            'direction' => ['required', 'in:in,out'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'category' => ['required', 'string', 'max:60'],
            'description' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:80'],
            'counterparty' => ['nullable', 'string', 'max:160'],
        ], [
            'account.*' => 'Elige la cuenta.',
            'direction.*' => 'Indica si es ingreso o egreso.',
            'amount.*' => 'El importe debe ser mayor que cero.',
            'date.*' => 'Indica una fecha válida, no futura.',
            'category.*' => 'Elige o escribe la categoría.',
            'description.*' => 'Describe el movimiento (hasta 255 caracteres).',
            'reference.*' => 'La referencia admite hasta 80 caracteres.',
            'counterparty.*' => 'La contraparte admite hasta 160 caracteres.',
        ]);

        return response()->json(['data' => ['code' => $workflow->record($data, $this->actor($request))]], 201);
    }

    public function void(Request $request, string $code, TreasuryMovementWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->void($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
