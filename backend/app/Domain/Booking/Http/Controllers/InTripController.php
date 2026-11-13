<?php

declare(strict_types=1);

namespace App\Domain\Booking\Http\Controllers;

use App\Domain\Booking\Actions\InTripOffers;
use App\Domain\Booking\Support\TripReservations;
use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class InTripController
{
    public function __construct(
        private readonly TripReservations $trips,
        private readonly InTripOffers $offers,
    ) {}

    public function trip(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->trips->show($this->trips->reservation($this->user($request), $code))]);
    }

    public function index(Request $request, string $code): JsonResponse
    {
        $reservation = $this->trips->reservation($this->user($request), $code);
        $rows = $this->trips->offers($reservation->id);

        return response()->json(['data' => $rows, 'meta' => ['count' => count($rows), 'next_cursor' => null, 'available' => $this->trips->available($reservation)]]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['tour', 'transport', 'transporte'])],
            'item_id' => ['required', 'string', 'max:40'],
            'channel' => ['sometimes', Rule::in(InTripOffers::CHANNELS)],
        ], [
            'kind.*' => 'Elige si ofreces un tour o una movilidad.',
            'item_id.*' => 'Elige el servicio que vas a ofrecer.',
            'channel.*' => 'Elige el canal: portal, WhatsApp, correo, app o asesor.',
        ]);
        $user = $this->user($request);
        $reservation = $this->trips->reservation($user, $code);
        $offer = $this->offers->create($reservation, $data['kind'] === 'tour' ? 'tour' : 'transport', $data['item_id'], $data['channel'] ?? 'asesor', (string) $user->getKey());

        return response()->json(['data' => $offer], 201);
    }

    public function cancel(Request $request, string $code, string $offer): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => $this->offers->cancel($this->trips->reservation($user, $code), $offer, (string) $user->getKey())]);
    }

    public function portal(Request $request, string $code): JsonResponse
    {
        $account = $this->holder($request);
        $reservation = $this->trips->byId($account->reservation($code)->id);

        return response()->json(['data' => $this->trips->available($reservation)]);
    }

    public function portalStore(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['tour', 'transport', 'transporte'])],
            'item_id' => ['required', 'string', 'max:40'],
        ], [
            'kind.*' => 'Elige un tour o una movilidad.',
            'item_id.*' => 'Elige el servicio que quieres agregar.',
        ]);
        $account = $this->holder($request);
        $reservation = $this->trips->byId($account->reservation($code)->id);
        $offer = $this->offers->create($reservation, $data['kind'] === 'tour' ? 'tour' : 'transport', $data['item_id'], 'portal', (string) $this->user($request)->getKey());

        return response()->json(['data' => ['offer' => $offer, 'available' => $this->trips->available($reservation)]]);
    }

    private function holder(Request $request): PortalAccount
    {
        $account = PortalAccount::of($this->user($request));
        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'La compra en ruta la hace quien reservó el viaje.', ['reservations.view']);
        }

        return $account;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
