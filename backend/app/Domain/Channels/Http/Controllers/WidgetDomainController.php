<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Support\WebIntegrationDirectory;
use Illuminate\Http\JsonResponse;

final class WidgetDomainController
{
    public function index(WebIntegrationDirectory $directory): JsonResponse
    {
        $domains = $directory->domains();

        return response()->json(['data' => $domains, 'meta' => ['total' => $domains->count(), 'verified' => $domains->where('status', 'verificado')->count()]]);
    }
}
