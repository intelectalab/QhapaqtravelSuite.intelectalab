<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\AccountingExports;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AccountingExportController
{
    use ResolvesActor;

    public function mappings(AccountingExports $exports): JsonResponse
    {
        return response()->json(['data' => $exports->mappings()]);
    }

    public function saveMappings(Request $request, AccountingExports $exports): JsonResponse
    {
        $data = $request->validate([
            'target' => ['required', 'in:'.implode(',', array_keys(AccountingExports::TARGETS))],
            'mappings' => ['required', 'array', 'min:1'],
            'mappings.*.concept' => ['required', 'distinct', 'in:'.implode(',', array_keys(AccountingExports::CONCEPTS))],
            'mappings.*.account_code' => ['nullable', 'string', 'max:30', 'regex:/^[0-9A-Za-z.\-]*$/'],
            'mappings.*.cost_center' => ['nullable', 'string', 'max:30'],
        ], [
            'target.*' => 'Elige el sistema contable de destino.',
            'mappings.required' => 'Completa al menos una cuenta.',
            'mappings.*.concept.*' => 'Uno de los conceptos no es válido.',
            'mappings.*.account_code.max' => 'La cuenta admite hasta 30 caracteres.',
            'mappings.*.account_code.regex' => 'La cuenta solo admite números, letras, puntos y guiones.',
            'mappings.*.cost_center.max' => 'El centro de costo admite hasta 30 caracteres.',
        ]);

        return response()->json(['data' => $exports->saveMappings($data, $this->actor($request))]);
    }

    public function index(Request $request, AccountingExports $exports): JsonResponse
    {
        return response()->json($exports->list($request));
    }

    public function store(Request $request, AccountingExports $exports): JsonResponse
    {
        $data = $request->validate([
            'target' => ['required', 'in:'.implode(',', array_keys(AccountingExports::TARGETS))],
            'period_from' => ['required', 'date'],
            'period_to' => ['required', 'date'],
            'scope' => ['nullable', 'array', 'min:1'],
            'scope.*' => ['in:'.implode(',', array_keys(AccountingExports::SCOPES))],
        ], [
            'target.*' => 'Elige el sistema contable de destino.',
            'period_from.*' => 'Elige la fecha inicial del periodo.',
            'period_to.*' => 'Elige la fecha final del periodo.',
            'scope.*' => 'Elige qué exportar: ventas, cobros o compras.',
        ]);

        return response()->json(['data' => $exports->generate($data, $this->actor($request))]);
    }
}
