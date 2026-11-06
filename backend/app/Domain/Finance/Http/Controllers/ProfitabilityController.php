<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Support\ProfitabilityReport;
use Illuminate\Http\JsonResponse;

final class ProfitabilityController
{
    public function index(ProfitabilityReport $report): JsonResponse
    {
        return response()->json(['data' => $report->overview()]);
    }
}
