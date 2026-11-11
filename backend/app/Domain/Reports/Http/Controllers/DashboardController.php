<?php

declare(strict_types=1);

namespace App\Domain\Reports\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\Dashboards\AccountingPanel;
use App\Domain\Reports\Support\Dashboards\ExecutivePanel;
use App\Domain\Reports\Support\Dashboards\FinancePanel;
use App\Domain\Reports\Support\Dashboards\HomePanel;
use App\Domain\Reports\Support\Dashboards\ManagerPanel;
use App\Domain\Reports\Support\Dashboards\SalesPanel;
use App\Domain\Reports\Support\NavCounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DashboardController
{
    public function home(Request $request, HomePanel $panels): JsonResponse
    {
        return response()->json(['data' => $panels->build($this->user($request))]);
    }

    public function executive(Request $request, ExecutivePanel $panel): JsonResponse
    {
        return response()->json(['data' => $panel->build($this->user($request))]);
    }

    public function manager(Request $request, ManagerPanel $panel): JsonResponse
    {
        return response()->json(['data' => $panel->build($this->user($request))]);
    }

    public function sales(Request $request, SalesPanel $panel): JsonResponse
    {
        return response()->json(['data' => $panel->build($this->user($request))]);
    }

    public function finance(Request $request, FinancePanel $panel): JsonResponse
    {
        return response()->json(['data' => $panel->build($this->user($request))]);
    }

    public function accounting(Request $request, AccountingPanel $panel): JsonResponse
    {
        return response()->json(['data' => $panel->build($this->user($request))]);
    }

    public function counts(Request $request, NavCounts $counts): JsonResponse
    {
        return response()->json(['data' => $counts->for($this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
