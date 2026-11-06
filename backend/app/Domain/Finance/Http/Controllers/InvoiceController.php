<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\IssueCreditNote;
use App\Domain\Finance\Actions\QueryFiscalStatus;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\InvoiceDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InvoiceController
{
    use ResolvesActor;

    public function index(Request $request, InvoiceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function creditNote(Request $request, string $number, IssueCreditNote $issue): JsonResponse
    {
        $data = $request->validate([
            'reason_code' => ['required', 'in:'.implode(',', array_keys(InvoiceDirectory::CREDIT_REASONS))],
            'amount' => ['nullable', 'numeric', 'gt:0'],
            'detail' => ['nullable', 'string', 'max:255'],
        ], [
            'reason_code.*' => 'Elige el motivo de la nota de crédito.',
            'amount.*' => 'El importe debe ser mayor que cero.',
            'detail.*' => 'El sustento admite hasta 255 caracteres.',
        ]);

        return response()->json(['data' => ['number' => $issue($number, $data, $this->actor($request))]], 201);
    }

    public function fiscalStatus(Request $request, string $number, QueryFiscalStatus $query): JsonResponse
    {
        return response()->json(['data' => ['status' => $query($number, $this->actor($request))]]);
    }
}
