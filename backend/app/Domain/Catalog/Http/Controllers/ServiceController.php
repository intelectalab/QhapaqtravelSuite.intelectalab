<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ServiceRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ServiceDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ServiceController
{
    use ResolvesActor;

    public function __construct(private readonly ServiceRegistry $registry) {}

    public function index(Request $request, ServiceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->registry->create($this->validated($request), $this->actor($request))], 201);
    }

    public function update(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => $this->registry->update($ref, $this->validated($request), $this->actor($request))]);
    }

    public function activate(Request $request, string $ref): JsonResponse
    {
        $this->registry->setActive($ref, true, null, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function deactivate(Request $request, string $ref): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.']);
        $this->registry->setActive($ref, false, (string) $request->input('reason'), $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'provider_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'min:3', 'max:200'],
            'type' => ['required', Rule::in(ServiceDirectory::TYPES)],
            'unit' => ['required', Rule::in(ServiceDirectory::UNITS)],
            'cost' => ['required', 'numeric', 'min:0', 'max:999999'],
            'currency' => ['required', Rule::in(CatalogAccess::CURRENCIES)],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'valid_from' => ['required', 'date'],
            'valid_to' => ['required', 'date', 'after_or_equal:valid_from'],
        ], [
            'provider_id.*' => 'Elige el proveedor.',
            'name.*' => 'Escribe un nombre de al menos 3 caracteres.',
            'type.*' => 'Elige el tipo de servicio.',
            'unit.*' => 'Elige la unidad de cobro.',
            'cost.*' => 'El costo debe ser cero o mayor.',
            'currency.*' => 'Elige la moneda.',
            'capacity.*' => 'La capacidad debe ser un número mayor que cero.',
            'valid_from.*' => 'Indica desde cuándo rige.',
            'valid_to.after_or_equal' => 'La vigencia debe terminar después de empezar.',
            'valid_to.*' => 'Indica hasta cuándo rige.',
        ]);
    }
}
