<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Support\FormProtection;
use Illuminate\Http\JsonResponse;

final class PublicCaptchaController
{
    public function __invoke(FormProtection $forms): JsonResponse
    {
        $siteKey = $forms->siteKey();

        return response()->json(['data' => ['provider' => $siteKey === null ? null : FormProtection::PROVIDER, 'site_key' => $siteKey]])
            ->header('Cache-Control', 'public, max-age=60');
    }
}
