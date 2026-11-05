<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Support\ClientDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ClientController
{
    public function __construct(private readonly ClientDirectory $directory)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request)), 'meta' => ['today' => $this->directory->today()]]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        $client = $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('El cliente no existe.');

        return response()->json(['data' => $client, 'meta' => ['today' => $this->directory->today()]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
