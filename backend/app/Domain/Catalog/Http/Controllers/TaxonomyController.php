<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\TaxonomyRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\TaxonomyDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class TaxonomyController
{
    use ResolvesActor;

    public function __construct(private readonly TaxonomyRegistry $registry) {}

    public function types(Request $request, TaxonomyDirectory $directory): JsonResponse
    {
        $types = $directory->types($this->actor($request));

        return response()->json(['data' => $types['types'], 'meta' => ['can' => $types['can']]]);
    }

    public function categories(Request $request, TaxonomyDirectory $directory): JsonResponse
    {
        $categories = $directory->categories($this->actor($request));

        return response()->json(['data' => $categories['categories'], 'meta' => ['can' => $categories['can']]]);
    }

    public function storeType(Request $request): JsonResponse
    {
        return response()->json(['data' => ['id' => $this->registry->createType($this->typeData($request), $this->actor($request))]], 201);
    }

    public function updateType(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['id' => $this->registry->updateType($id, $this->typeData($request), $this->actor($request))]]);
    }

    public function destroyType(Request $request, string $id): Response
    {
        $this->registry->deleteType($id, $this->actor($request));

        return response()->noContent();
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'subcategories' => ['nullable', 'array', 'max:30'],
            'subcategories.*' => ['string', 'min:2', 'max:80'],
        ], [
            'name.*' => 'Escribe el nombre de la categoría (2 a 80 caracteres).',
            'subcategories.max' => 'Agrega hasta 30 subcategorías a la vez.',
            'subcategories.*' => 'Cada subcategoría lleva de 2 a 80 caracteres.',
        ]);

        return response()->json(['data' => ['ref' => $this->registry->createCategory($data, $this->actor($request))]], 201);
    }

    public function updateCategory(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->registry->updateCategory($ref, $this->nameData($request, 'categoría'), $this->actor($request))]]);
    }

    public function destroyCategory(Request $request, string $ref): Response
    {
        $this->registry->deleteCategory($ref, $this->actor($request));

        return response()->noContent();
    }

    public function storeSubcategory(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => ['id' => $this->registry->createSubcategory($ref, $this->nameData($request, 'subcategoría')['name'], $this->actor($request))]], 201);
    }

    public function updateSubcategory(Request $request, string $ref, string $subId): JsonResponse
    {
        return response()->json(['data' => ['id' => $this->registry->updateSubcategory($ref, $subId, $this->nameData($request, 'subcategoría'), $this->actor($request))]]);
    }

    public function destroySubcategory(Request $request, string $ref, string $subId): Response
    {
        $this->registry->deleteSubcategory($ref, $subId, $this->actor($request));

        return response()->noContent();
    }

    private function typeData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'requires_itinerary' => ['nullable', 'boolean'],
            'requires_components' => ['nullable', 'boolean'],
            'version' => ['nullable', 'string', 'max:40'],
        ], [
            'name.*' => 'Escribe el nombre del tipo (2 a 60 caracteres).',
            'requires_itinerary.*' => 'Indica si el tipo requiere itinerario.',
            'requires_components.*' => 'Indica si el tipo requiere componentes.',
            'version.*' => 'Recarga la página e inténtalo de nuevo.',
        ]);
    }

    private function nameData(Request $request, string $label): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'version' => ['nullable', 'string', 'max:40'],
        ], [
            'name.*' => "Escribe el nombre de la {$label} (2 a 80 caracteres).",
            'version.*' => 'Recarga la página e inténtalo de nuevo.',
        ]);
    }
}
