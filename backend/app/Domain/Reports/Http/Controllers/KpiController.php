<?php

declare(strict_types=1);

namespace App\Domain\Reports\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\KpiReport;
use App\Domain\Reports\Support\ProcessMap;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class KpiController
{
    public function kpis(Request $request, KpiReport $report): JsonResponse
    {
        return response()->json(['data' => $report->build($this->user($request))]);
    }

    public function flow(Request $request, ProcessMap $map): JsonResponse
    {
        return response()->json(['data' => $map->build($this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
