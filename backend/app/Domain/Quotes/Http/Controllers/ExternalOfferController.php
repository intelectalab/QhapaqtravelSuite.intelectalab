<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Actions\ExternalOffers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ExternalOfferController
{
    public function search(Request $request, string $id, ExternalOffers $offers): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:'.implode(',', array_keys(ExternalOffers::KINDS))],
            'origin' => ['nullable', 'required_if:kind,aereo', 'string', 'min:3', 'max:60'],
            'destination' => ['required', 'string', 'min:3', 'max:60'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'pax' => ['nullable', 'integer', 'between:1,40'],
        ], [
            'kind.*' => 'Elige qué buscar: aéreo, hotel, auto o seguro.',
            'origin.*' => 'Escribe la ciudad o el código de origen del vuelo.',
            'destination.*' => 'Escribe el destino.',
            'date_from.*' => 'La fecha de salida no es válida.',
            'date_to.*' => 'La fecha de regreso no es válida.',
            'pax.*' => 'Los pasajeros van de 1 a 40.',
        ]);

        return response()->json(['data' => $offers->search($id, $data, $this->user($request))]);
    }

    public function store(Request $request, string $id, ExternalOffers $offers): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', 'in:amadeus,sabre,travelport,hotelbeds,otro'],
            'offer_ref' => ['required', 'string', 'max:160'],
        ], ['provider.*' => 'Falta el proveedor de la oferta.', 'offer_ref.*' => 'Falta la referencia de la oferta.']);

        return response()->json(['data' => $offers->add($id, $data, $this->user($request))]);
    }

    public function destroy(Request $request, string $id, string $offerId, ExternalOffers $offers): Response
    {
        $offers->remove($id, $offerId, $this->user($request));

        return response()->noContent();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
