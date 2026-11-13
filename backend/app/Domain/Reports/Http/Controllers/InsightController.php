<?php

declare(strict_types=1);

namespace App\Domain\Reports\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Actions\AiInsights;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InsightController
{
    public function index(Request $request, AiInsights $insights): JsonResponse
    {
        return response()->json($insights->list($request, $this->user($request)));
    }

    public function resolve(Request $request, string $id, AiInsights $insights): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:vista,resuelta,descartada']], ['status.*' => 'Indica si la alerta queda resuelta o descartada.']);

        return response()->json(['data' => $insights->resolve($id, $data['status'], $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
