<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ExportAuditLog;
use App\Domain\Admin\Support\AuditDirectory;
use App\Domain\Iam\Models\User;
use App\Http\Middleware\IdempotencyMiddleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditController
{
    public function index(Request $request, AuditDirectory $directory): JsonResponse
    {
        return response()->json($directory->page($request, $this->user($request)));
    }

    public function show(string $id, AuditDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->find($id)]);
    }

    public function export(Request $request, AuditDirectory $directory, ExportAuditLog $export): JsonResponse
    {
        $request->validate([
            'filters' => ['nullable', 'array'],
            'format' => ['nullable', 'in:CSV'],
        ], ['format.in' => 'La bitácora se exporta en CSV.']);
        $scoped = $request->duplicate(['filter' => $request->input('filters', []), 'days' => $request->input('filters.days', '30')]);
        $user = $this->user($request);

        return response()->json(['data' => $export($directory->filters($scoped, $user), $user, $request->header(IdempotencyMiddleware::HEADER))], 202);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
