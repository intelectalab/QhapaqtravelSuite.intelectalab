<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\RoleAdmin;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RoleController
{
    public function __construct(private readonly RoleAdmin $roles) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->roles->list(), 'meta' => ['catalog' => $this->roles->catalog()]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:250'],
            'scope' => ['required', 'in:tenant,mobile,canal'],
            'copy_from' => ['nullable', 'string', 'max:125'],
        ], $this->messages());

        return response()->json(['data' => ['code' => $this->roles->create($data, $this->user($request))]], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:250'],
            'scope' => ['prohibited'],
        ], [...$this->messages(), 'scope.prohibited' => 'El alcance de un rol no cambia después de crearlo.']);
        $this->roles->update($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(string $code): JsonResponse
    {
        $this->roles->delete($code);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function permissions(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', 'max:125'],
            'grant' => ['required', 'boolean'],
        ]);

        return response()->json(['data' => $this->roles->set($code, $data['permissions'], (bool) $data['grant'])]);
    }

    private function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del rol.',
            'description.required' => 'Describe para qué sirve el rol.',
            'scope.in' => 'Elige el alcance del rol.',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
