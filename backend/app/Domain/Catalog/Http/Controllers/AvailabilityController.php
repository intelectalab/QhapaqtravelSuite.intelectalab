<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\AvailabilityRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesProduct;
use App\Domain\Catalog\Support\AvailabilityDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AvailabilityController
{
    use ResolvesActor;
    use ResolvesProduct;

    public function __construct(private readonly AvailabilityRegistry $registry) {}

    public function index(Request $request, AvailabilityDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function storeRange(Request $request, string $product): JsonResponse
    {
        $data = [...$this->rangeData($request), 'product_id' => $this->productId($product)];

        return response()->json(['data' => ['code' => $this->registry->createRange($data, $this->actor($request))]], 201);
    }

    public function updateRange(Request $request, string $product, string $code): JsonResponse
    {
        $this->ownedRange($product, $code);

        return response()->json(['data' => ['code' => $this->registry->updateRange($code, $this->rangeData($request), $this->actor($request))]]);
    }

    public function destroyRange(Request $request, string $product, string $code): JsonResponse
    {
        $this->ownedRange($product, $code);
        $this->registry->deleteRange($code, $this->reason($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function storeHold(Request $request): JsonResponse
    {
        $data = $request->validate([
            'departure_id' => ['required', 'uuid'],
            'quantity' => ['required', 'integer', 'between:1,60'],
            'minutes' => ['nullable', 'integer', 'between:5,10080'],
            'reference' => ['required', 'string', 'min:3', 'max:60'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'departure_id.*' => 'Elige la salida.',
            'quantity.*' => 'Indica cuántos cupos bloquear (1 a 60).',
            'minutes.*' => 'El bloqueo dura al menos 5 minutos.',
            'reference.*' => 'Indica la referencia: cotización, reserva o agencia.',
            'notes.*' => 'Las notas admiten hasta 500 caracteres.',
        ]);

        return response()->json(['data' => ['ref' => $this->registry->createHold($data, $this->actor($request))]], 201);
    }

    public function confirmHold(Request $request, string $ref): JsonResponse
    {
        $this->registry->confirmHold($ref, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function releaseHold(Request $request, string $ref): JsonResponse
    {
        $this->registry->releaseHold($ref, $this->reason($request), $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function consumeHold(Request $request, string $ref): JsonResponse
    {
        $this->registry->consumeHold($ref, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function expireHolds(Request $request): JsonResponse
    {
        return response()->json(['data' => ['expired' => $this->registry->expireHolds($this->actor($request))]]);
    }

    private function reason(Request $request): string
    {
        return (string) $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.'])['reason'];
    }

    private function ownedRange(string $product, string $code): void
    {
        $this->ensureOwnedBy($product, 'catalog_availability_ranges', 'code', $code, 'El rango no existe.');
    }

    private function rangeData(Request $request): array
    {
        return $request->validate([
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'status' => ['required', Rule::in(AvailabilityDirectory::RANGE_STATUSES)],
            'capacity_per_day' => ['nullable', 'required_if:status,disponible', 'integer', 'between:1,500'],
            'note' => ['nullable', 'string', 'max:200'],
        ], [
            'date_from.*' => 'Indica desde cuándo.',
            'date_to.after_or_equal' => 'El rango debe terminar después de empezar.',
            'date_to.*' => 'Indica hasta cuándo.',
            'status.*' => 'Elige si está disponible, cerrado o agotado.',
            'capacity_per_day.*' => 'Un rango disponible necesita entre 1 y 500 cupos por día.',
            'note.*' => 'La nota admite hasta 200 caracteres.',
        ]);
    }
}
