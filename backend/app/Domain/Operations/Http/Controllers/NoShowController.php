<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\NoShowRegistry;
use App\Domain\Operations\Support\NoShowDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NoShowController
{
    public function __construct(private readonly NoShowRegistry $registry, private readonly NoShowDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->directory->page($request));
    }

    public function forService(string $service): JsonResponse
    {
        $row = $this->registry->service($service);

        return response()->json(['data' => $this->directory->forService((string) $row->id)]);
    }

    public function store(Request $request, string $service): JsonResponse
    {
        $data = $request->validate([
            'passenger_ids' => ['required', 'array', 'min:1', 'max:60'],
            'passenger_ids.*' => ['required', 'uuid'],
            'note' => ['nullable', 'string', 'max:300'],
        ], [
            'passenger_ids.*' => 'Elige al menos un pasajero que no se presentó.',
            'note.*' => 'La nota admite hasta 300 caracteres.',
        ]);

        return response()->json(['data' => $this->registry->register($service, $data['passenger_ids'], $data['note'] ?? null, $this->user($request))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['note' => ['present', 'nullable', 'string', 'max:300']], ['note.*' => 'La nota admite hasta 300 caracteres.']);

        return response()->json(['data' => $this->registry->updateNote($id, $data['note'] ?? null, $this->user($request))]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe por qué anulas el registro (3 a 300 caracteres).']);

        return response()->json(['data' => $this->registry->void($id, $data['reason'], $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
