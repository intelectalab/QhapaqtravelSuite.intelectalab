<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\RuleAutomationRequests;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RuleAutomationController
{
    public function store(Request $request, string $code, RuleAutomationRequests $requests): JsonResponse
    {
        $data = $request->validate(RuleAutomationRequests::rules(), RuleAutomationRequests::messages());
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $requests->request($code, $data, $user)], 201);
    }
}
