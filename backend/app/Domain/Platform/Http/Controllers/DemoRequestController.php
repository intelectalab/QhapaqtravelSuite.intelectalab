<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Support\DemoRequestDirectory;
use Illuminate\Http\JsonResponse;

final class DemoRequestController
{
    public function index(DemoRequestDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list()]);
    }
}
