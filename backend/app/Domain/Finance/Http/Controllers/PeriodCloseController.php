<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\PeriodCloseWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PeriodCloseController
{
    use ResolvesActor;

    public function show(Request $request, string $period, PeriodCloseWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->show($period, $this->actor($request))]);
    }

    public function check(Request $request, string $period, string $check, PeriodCloseWorkflow $workflow): JsonResponse
    {
        $workflow->mark($period, $check, true, $this->actor($request));

        return response()->json(['data' => $workflow->show($period, $this->actor($request))]);
    }

    public function uncheck(Request $request, string $period, string $check, PeriodCloseWorkflow $workflow): JsonResponse
    {
        $workflow->mark($period, $check, false, $this->actor($request));

        return response()->json(['data' => $workflow->show($period, $this->actor($request))]);
    }

    public function close(Request $request, string $period, PeriodCloseWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->close($period, $this->actor($request))], 201);
    }
}
