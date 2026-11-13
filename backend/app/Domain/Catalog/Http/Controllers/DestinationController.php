<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\DestinationRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\DestinationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class DestinationController
{
    use ResolvesActor;

    public function __construct(private readonly DestinationRegistry $registry) {}

    public function index(Request $request, DestinationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function show(DestinationDirectory $directory, string $ref): JsonResponse
    {
        return response()->json(['data' => $directory->find($ref)]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->registry->create($this->validated($request), $this->actor($request))]], 201);
    }

    public function update(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->registry->update($ref, $this->validated($request), $this->actor($request))]]);
    }

    public function destroy(Request $request, string $ref): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.']);
        $this->registry->delete($ref, (string) $request->input('reason'), $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'type' => ['required', Rule::in(array_keys(DestinationDirectory::RANKS))],
            'parent_id' => ['nullable', 'uuid'],
            'lat' => ['nullable', 'required_with:lng', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'required_with:lat', 'numeric', 'between:-180,180'],
            'description' => ['nullable', 'string', 'max:1000'],
        ], [
            'name.*' => 'Escribe el nombre del destino.',
            'type.*' => 'Elige el tipo de destino.',
            'parent_id.*' => 'Elige un destino padre válido.',
            'lat.required_with' => 'Si indicas la longitud, indica también la latitud.',
            'lat.*' => 'La latitud va de -90 a 90.',
            'lng.required_with' => 'Si indicas la latitud, indica también la longitud.',
            'lng.*' => 'La longitud va de -180 a 180.',
            'description.*' => 'La descripción admite hasta 1000 caracteres.',
        ]);
    }
}
