<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Channels\Support\OwnReviewIntake;
use App\Domain\Site\Actions\ReviewByToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SiteReviewController
{
    public function show(Request $request, string $code, ReviewByToken $reviews): JsonResponse
    {
        return response()->json(['data' => $reviews->show($code, (string) $request->query('t', ''))]);
    }

    public function store(Request $request, ReviewByToken $reviews): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            't' => ['required', 'string', 'max:120'],
            ...OwnReviewIntake::rules(),
        ], ['code.*' => 'El enlace para opinar no es válido.', 't.*' => 'El enlace para opinar no es válido.', ...OwnReviewIntake::messages()]);

        return response()->json(['data' => $reviews->submit($data)], 201);
    }
}
