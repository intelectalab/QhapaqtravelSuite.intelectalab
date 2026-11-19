<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\AttendDemoRequest;
use App\Domain\Platform\Support\DemoRequestDirectory;
use App\Domain\Showcase\Http\Controllers\PlatformShowcaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class DemoRequestController
{
    public function index(DemoRequestDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list()]);
    }

    public function update(Request $request, string $code, AttendDemoRequest $attend, DemoRequestDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(DemoRequestDirectory::STATUSES)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['status.*' => 'Elige el nuevo estado.', 'notes.max' => 'La nota admite hasta 1000 caracteres.']);

        $attend($code, $data['status'], $data['notes'] ?? null, PlatformShowcaseController::user($request));

        return response()->json(['data' => $directory->find($code)]);
    }
}
