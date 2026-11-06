<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\ResourceCatalog;
use App\Domain\Operations\Support\CalendarDirectory;
use App\Domain\Operations\Support\ResourceDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ResourceController
{
    public function index(Request $request, ResourceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function calendar(Request $request, CalendarDirectory $calendar): JsonResponse
    {
        $data = $request->validate(['month' => ['nullable', 'date_format:Y-m']], ['month.*' => 'Elige un mes válido.']);

        return response()->json(['data' => $calendar->month($this->user($request), $data['month'] ?? null)]);
    }

    public function store(Request $request, string $type, ResourceCatalog $catalog): JsonResponse
    {
        $id = $catalog->save($this->type($type), null, $this->validated($request, $type), $this->user($request));

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function update(Request $request, string $type, string $id, ResourceCatalog $catalog): JsonResponse
    {
        $catalog->save($this->type($type), $id, $this->validated($request, $type), $this->user($request));

        return response()->json(['data' => ['id' => $id]]);
    }

    public function destroy(Request $request, string $type, string $id, ResourceCatalog $catalog): JsonResponse
    {
        $catalog->archive($this->type($type), $id, $this->user($request));

        return response()->json(['data' => ['id' => $id]]);
    }

    private function validated(Request $request, string $type): array
    {
        return match ($this->type($type)) {
            'guide' => $request->validate([
                'full_name' => ['required', 'string', 'min:3', 'max:150'],
                'languages' => ['required', 'array', 'min:1'],
                'languages.*' => ['in:'.implode(',', array_keys(ResourceDirectory::LANGUAGES))],
                'license_number' => ['required', 'string', 'max:40'],
                'rating' => ['nullable', 'numeric', 'min:0', 'max:5'],
                'phone' => ['nullable', 'string', 'max:30'],
                'status' => ['required', 'in:'.implode(',', ResourceDirectory::PERSON_STATUS)],
            ], $this->messages()),
            'driver' => $request->validate([
                'full_name' => ['required', 'string', 'min:3', 'max:150'],
                'license_number' => ['required', 'string', 'max:40'],
                'license_class' => ['nullable', 'in:A-I,A-IIa,A-IIb,A-IIIa,A-IIIb,A-IIIc'],
                'license_expires_on' => ['required', 'date'],
                'phone' => ['nullable', 'string', 'max:30'],
                'status' => ['required', 'in:'.implode(',', ResourceDirectory::PERSON_STATUS)],
            ], $this->messages()),
            default => $request->validate([
                'plate' => ['required', 'string', 'min:5', 'max:12'],
                'vehicle_type' => ['required', 'string', 'min:3', 'max:60'],
                'capacity' => ['required', 'integer', 'min:1', 'max:80'],
                'provider_id' => ['nullable', 'uuid'],
                'soat_expires_on' => ['required', 'date'],
                'status' => ['required', 'in:'.implode(',', ResourceDirectory::VEHICLE_STATUS)],
            ], $this->messages()),
        };
    }

    private function messages(): array
    {
        return [
            'full_name.*' => 'Escribe el nombre completo.',
            'languages.*' => 'Marca al menos un idioma.',
            'license_number.*' => 'Escribe el número de carné o licencia.',
            'license_class.*' => 'Elige la categoría de la licencia.',
            'license_expires_on.*' => 'Indica el vencimiento de la licencia.',
            'rating.*' => 'La calificación va de 0 a 5.',
            'plate.*' => 'Escribe la placa.',
            'vehicle_type.*' => 'Describe el vehículo.',
            'capacity.*' => 'Indica las plazas (1 a 80).',
            'soat_expires_on.*' => 'Indica el vencimiento del SOAT.',
            'status.*' => 'Elige el estado.',
        ];
    }

    private function type(string $type): string
    {
        return match ($type) {
            'guias', 'guide' => 'guide',
            'conductores', 'driver' => 'driver',
            'vehiculos', 'vehicle' => 'vehicle',
            default => throw ApiException::notFound('El tipo de recurso no existe.'),
        };
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
