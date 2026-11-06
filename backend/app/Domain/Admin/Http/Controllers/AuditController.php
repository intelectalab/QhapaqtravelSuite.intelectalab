<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Support\AuditDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditController
{
    public function index(Request $request, AuditDirectory $directory): JsonResponse
    {
        $days = (int) $request->query('days', '30');

        return response()->json(['data' => $directory->list(in_array($days, [1, 7, 30, 90, 0], true) ? $days : 30)]);
    }

    public function show(string $code, AuditDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->find($code)]);
    }
}
