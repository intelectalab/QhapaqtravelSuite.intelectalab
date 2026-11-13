<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Support\ProfitabilityReport;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ProfitabilityController
{
    public function index(ProfitabilityReport $report): JsonResponse
    {
        return response()->json(['data' => $report->overview()]);
    }

    public function reservations(Request $request, ProfitabilityReport $report): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $light = $filters['light'] ?? null;

        if ($light !== null && ! isset(ProfitabilityReport::LIGHTS[$light])) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El semáforo se filtra con r (rojo), a (ámbar) o g (verde).', ['filter.light' => ['Usa r, a o g.']]);
        }

        return response()->json(CursorPage::respondItems($request, $report->reservations($light, $filters['channel'] ?? null)));
    }
}
