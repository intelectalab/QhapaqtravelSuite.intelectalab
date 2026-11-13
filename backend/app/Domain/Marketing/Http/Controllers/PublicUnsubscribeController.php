<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Marketing\Actions\RecipientUnsubscribe;
use App\Domain\Site\Actions\NewsletterLifecycle;
use Illuminate\Http\JsonResponse;

final class PublicUnsubscribeController
{
    public function show(string $token, RecipientUnsubscribe $links): JsonResponse
    {
        return response()->json(['data' => $links->describe($token)]);
    }

    public function store(string $token, NewsletterLifecycle $newsletter, RecipientUnsubscribe $links): JsonResponse
    {
        $result = $newsletter->unsubscribe($token);

        return response()->json(['data' => [...$links->describe($token), 'status' => $result['status']]]);
    }
}
