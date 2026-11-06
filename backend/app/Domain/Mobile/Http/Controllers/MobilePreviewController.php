<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Http\Controllers;

use App\Domain\Mobile\Support\OperatorAppPreview;
use App\Domain\Mobile\Support\PassengerAppPreview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class MobilePreviewController
{
    public function operator(Request $request, OperatorAppPreview $preview): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date_format:Y-m-d'], 'staff' => ['nullable', 'string', 'max:30']], ['date.*' => 'Revisa la fecha.']);

        return response()->json(['data' => $preview->show($request->string('date')->toString() ?: null, $request->string('staff')->toString() ?: null)]);
    }

    public function passenger(Request $request, PassengerAppPreview $preview): JsonResponse
    {
        return response()->json(['data' => $preview->show($request->string('reservation')->toString() ?: null)]);
    }
}
