<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\SedeAdmin;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SedeController
{
    public function __construct(private readonly SedeAdmin $sedes) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->sedes->list(), 'meta' => ['managers' => $this->sedes->managers(), 'limit' => $this->sedes->limit()]]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ['code' => $this->sedes->create($this->validated($request), $this->user($request))]], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $this->sedes->update($code, $this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function activate(Request $request, string $code): JsonResponse
    {
        $this->sedes->setStatus($code, true, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function deactivate(Request $request, string $code): JsonResponse
    {
        $this->sedes->setStatus($code, false, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(Request $request, string $code): JsonResponse
    {
        $this->sedes->delete($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:80'],
            'address' => ['required', 'string', 'max:250'],
            'phone' => ['nullable', 'string', 'max:30'],
            'manager_id' => ['nullable', 'uuid'],
        ], [
            'name.required' => 'Escribe el nombre de la sede.',
            'address.required' => 'Escribe la dirección.',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
