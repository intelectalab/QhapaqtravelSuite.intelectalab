<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\AvailabilityRegistry;
use App\Domain\Catalog\Actions\DepartureRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\DepartureDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class DepartureController
{
    use ResolvesActor;

    public function __construct(private readonly DepartureRegistry $registry) {}

    public function index(Request $request, DepartureDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->registry->create(self::payload($request, true), $this->actor($request))], 201);
    }

    public function update(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => $this->registry->update($ref, self::payload($request, false), (int) $request->input('lock_version'), $this->actor($request))]);
    }

    public function close(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => $this->registry->changeStatus($ref, 'cerrada', $this->reason($request), $this->actor($request))]);
    }

    public function cancel(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => $this->registry->changeStatus($ref, 'cancelada', $this->reason($request), $this->actor($request))]);
    }

    public function confirmSeats(Request $request, AvailabilityRegistry $availability, string $ref): JsonResponse
    {
        if (! $request->has('lock_version') && $request->hasHeader('If-Match')) {
            $request->merge(['lock_version' => trim((string) $request->header('If-Match'), '"W/ ')]);
        }

        $data = $request->validate([
            'quantity' => ['required', 'integer', 'between:1,60'],
            'reference' => ['required', 'string', 'min:3', 'max:60'],
            'lock_version' => ['required', 'integer'],
        ], [
            'quantity.*' => 'Indica cuántos cupos vender (1 a 60).',
            'reference.*' => 'Indica la reserva o el pedido.',
            'lock_version.*' => 'Recarga la página e inténtalo de nuevo.',
        ]);

        return response()->json(['data' => $availability->sellSeats($ref, $data, $this->actor($request))]);
    }

    private function reason(Request $request): string
    {
        return (string) $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.'])['reason'];
    }

    public static function payload(Request $request, bool $creating, bool $withProduct = true): array
    {
        return $request->validate([
            'product_id' => [Rule::requiredIf($creating && $withProduct), 'uuid'],
            'departure_date' => ['required', 'date'],
            'departure_time' => ['required', 'date_format:H:i'],
            'capacity' => ['required', 'integer', 'between:1,60'],
            'status' => ['nullable', Rule::in(['abierta', 'cerrada', 'cancelada'])],
            'provider_id' => ['nullable', 'uuid'],
            'guide_id' => ['nullable', 'uuid'],
            'vehicle_id' => ['nullable', 'uuid'],
            'meeting_point' => ['required', 'string', 'max:160'],
            'return_point' => ['nullable', 'string', 'max:160'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'lock_version' => [Rule::requiredIf(! $creating), 'integer'],
        ], [
            'product_id.*' => 'Elige el producto.',
            'departure_date.*' => 'Indica la fecha de salida.',
            'departure_time.*' => 'Indica la hora en formato 24 h, por ejemplo 07:30.',
            'capacity.*' => 'La capacidad va de 1 a 60 cupos.',
            'status.*' => 'Elige el estado.',
            'provider_id.*' => 'Elige un proveedor válido.',
            'guide_id.*' => 'Elige un guía válido.',
            'vehicle_id.*' => 'Elige un vehículo válido.',
            'meeting_point.*' => 'Indica el punto de encuentro.',
            'return_point.*' => 'El punto de retorno admite hasta 160 caracteres.',
            'notes.*' => 'Las notas admiten hasta 1000 caracteres.',
            'lock_version.*' => 'Recarga la página e inténtalo de nuevo.',
        ]);
    }
}
