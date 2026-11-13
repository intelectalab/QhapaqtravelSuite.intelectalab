<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Http\Controllers;

use App\Domain\Tracking\Support\BlogSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PayloadWebhookController
{
    public function __invoke(Request $request, BlogSync $sync): JsonResponse
    {
        $sync->verify($request);

        return response()->json(['data' => $sync->handle($request)]);
    }
}
