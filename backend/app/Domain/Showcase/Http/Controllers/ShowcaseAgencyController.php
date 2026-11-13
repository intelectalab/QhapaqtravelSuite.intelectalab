<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Showcase\Actions\ManageShowcaseListings;
use App\Domain\Showcase\Actions\ShowcaseBookings;
use App\Domain\Showcase\Support\ShowcaseDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ShowcaseAgencyController
{
    private const MESSAGES = [
        'title.*' => 'Escriba el título del tour (de 5 a 160 caracteres).',
        'city.*' => 'Elija la ciudad.',
        'start_times.*' => 'Indique al menos un horario de salida en formato HH:MM.',
        'languages.*' => 'Elija al menos un idioma.',
        'duration_hours.*' => 'La duración va de 0,5 a 24 horas.',
        'meeting_point.*' => 'Indique un punto de encuentro real (de 10 a 300 caracteres).',
        'model.*' => 'Elija si es free tour o de pago.',
        'price.*' => 'El precio debe ser un número mayor o igual a cero.',
        'capacity.*' => 'El cupo por salida va de 1 a 200 personas.',
        'highlights.*' => 'Cuente lo que verá el viajero, un punto por línea.',
    ];

    public function index(TenantContext $context, ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->agencyListings($context->idOrFail())]);
    }

    public function store(Request $request, ManageShowcaseListings $listings): JsonResponse
    {
        $data = $request->validate([...$this->rules(true), 'own_content' => ['accepted']], [...self::MESSAGES, 'own_content.accepted' => 'Declare que las fotos y los textos son propios.']);

        return response()->json(['data' => ['code' => $listings->create($data)]]);
    }

    public function update(Request $request, string $code, ManageShowcaseListings $listings): JsonResponse
    {
        $data = $request->validate(['action' => ['nullable', 'in:editar,pausar,reanudar'], ...$this->rules(false)], self::MESSAGES);

        return response()->json(['data' => $listings->update($code, $data)]);
    }

    public function bookings(Request $request, TenantContext $context, ShowcaseDirectory $directory): JsonResponse
    {
        $filters = $request->validate(['status' => ['nullable', 'in:'.implode(',', ShowcaseDirectory::BOOKING_STATUSES)]]);

        return response()->json(['data' => $directory->agencyBookings($context->idOrFail(), $filters)]);
    }

    public function attendance(Request $request, string $code, ShowcaseBookings $bookings): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:asistio,no_show']], ['status.*' => 'Indique si asistió o no se presentó.']);

        return response()->json(['data' => $bookings->attendance($code, $data['status'])]);
    }

    public function fees(TenantContext $context, ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->agencyFees($context->idOrFail())]);
    }

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'min:5', 'max:160'],
            'city' => [$required, 'string', 'max:40'],
            'zone' => ['nullable', 'string', 'max:80'],
            'theme' => ['nullable', 'string', 'max:40'],
            'languages' => [$required, 'array', 'min:1', 'max:6'],
            'languages.*' => ['string', 'size:2'],
            'start_times' => [$required, 'array', 'min:1', 'max:8'],
            'start_times.*' => ['regex:/^[0-2][0-9]:[0-5][0-9]$/'],
            'duration_hours' => [$required, 'numeric', 'min:0.5', 'max:24'],
            'meeting_point' => [$required, 'string', 'min:10', 'max:300'],
            'model' => [$required, 'in:propina,pago'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:99999'],
            'capacity' => ['nullable', 'integer', 'between:1,200'],
            'highlights' => [$required, 'array', 'min:1', 'max:12'],
            'highlights.*' => ['string', 'max:160'],
            'product' => ['nullable', 'string', 'max:40'],
        ];
    }
}
