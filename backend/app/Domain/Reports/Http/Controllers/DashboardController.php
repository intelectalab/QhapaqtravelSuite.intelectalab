<?php

declare(strict_types=1);

namespace App\Domain\Reports\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\HomeDashboard;
use App\Domain\Reports\Support\NavCounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DashboardController
{
    public function home(Request $request, HomeDashboard $dashboard): JsonResponse
    {
        return response()->json(['data' => $dashboard->build($this->user($request))]);
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
