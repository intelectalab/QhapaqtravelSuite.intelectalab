<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Quotes\Support\PublicQuoteView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PublicQuoteController
{
    public function show(Request $request, string $token, PublicQuoteView $view): JsonResponse
    {
        return response()->json(['data' => $view->show($token, $request)]);
    }
}
