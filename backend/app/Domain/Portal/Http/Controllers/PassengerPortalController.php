<?php

declare(strict_types=1);

namespace App\Domain\Portal\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Actions\PassengerAccess;
use App\Domain\Portal\Actions\PassengerFeedback;
use App\Domain\Portal\Actions\PassengerReviews;
use App\Domain\Portal\Actions\PassengerTripActions;
use App\Domain\Portal\Support\PassengerTrip;
use App\Domain\Portal\Support\PortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PassengerPortalController
{
    public function feedback(Request $request, PassengerFeedback $feedback): JsonResponse
    {
        return response()->json(['data' => $feedback->overview($this->account($request), $request->query('trip'))]);
    }

    public function sendFeedback(Request $request, PassengerFeedback $feedback): JsonResponse
    {
        $data = $request->validate(PassengerFeedback::rules(), PassengerFeedback::messages());

        return response()->json(['data' => $feedback->create($this->account($request), $data)], 201);
    }

    public function reviews(Request $request, PassengerReviews $reviews): JsonResponse
    {
        return response()->json(['data' => $reviews->overview($this->account($request), $request->query('trip'))]);
    }

    public function sendReview(Request $request, PassengerReviews $reviews): JsonResponse
    {
        $data = $request->validate(PassengerReviews::rules(), PassengerReviews::messages());

        return response()->json(['data' => $reviews->create($this->account($request), $data)], 201);
    }

    public function link(Request $request, PassengerAccess $access): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            'code' => ['required', 'string', 'max:30', 'regex:/^RES-[A-Za-z0-9-]+$/i'],
        ], ['email.*' => 'Escribe el correo con el que reservaste.', 'code.*' => 'Escribe el código de reserva (empieza con RES-).']);
        $access->link($data['email'], $data['code']);

        return response()->json(['data' => ['message' => 'Te enviamos un enlace a tu correo. Vence en '.PassengerAccess::MINUTES.' minutos.']]);
    }

    public function verify(Request $request, PassengerAccess $access): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'size:48']], ['token.*' => 'El enlace no es válido.']);

        return response()->json(['data' => $access->verify($data['token'])]);
    }

    public function trip(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->trip($this->account($request), $this->code($request)));
    }

    public function itinerary(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->itinerary($this->account($request), $this->code($request)));
    }

    public function hotels(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->section($this->account($request), 'hotels', $this->code($request)));
    }

    public function transport(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->section($this->account($request), 'transport', $this->code($request)));
    }

    public function activities(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->section($this->account($request), 'activities', $this->code($request)));
    }

    public function vouchers(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->vouchers($this->account($request), $this->code($request)));
    }

    public function voucher(Request $request, string $code, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->voucher($this->account($request), $code));
    }

    public function documents(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->documents($this->account($request), $this->code($request)));
    }

    public function alerts(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->alerts($this->account($request), $this->code($request)));
    }

    public function ack(Request $request, string $incidentId, PassengerTripActions $actions): JsonResponse
    {
        return $this->json($actions->ack($this->account($request), $incidentId));
    }

    public function contacts(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->contacts($this->account($request), $this->code($request)));
    }

    public function messages(Request $request, PassengerTrip $trips): JsonResponse
    {
        return $this->json($trips->messages($this->account($request), $this->code($request)));
    }

    public function sendMessage(Request $request, PassengerTripActions $actions): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:2000'],
            'topic' => ['nullable', Rule::in(array_keys(PassengerTripActions::TOPICS))],
            'trip' => ['nullable', 'string', 'max:30'],
        ], ['body.*' => 'Escribe tu mensaje.', 'topic.*' => 'Elige el tema.']);

        return response()->json(['data' => $actions->send($this->account($request), $data)], 201);
    }

    public function readMessage(Request $request, string $id, PassengerTripActions $actions): JsonResponse
    {
        return $this->json(['updated' => $actions->read($this->account($request), $id, $this->code($request))]);
    }

    public function readAll(Request $request, PassengerTripActions $actions): JsonResponse
    {
        return $this->json(['updated' => $actions->read($this->account($request), null, $this->code($request))]);
    }

    public function companions(Request $request, PassengerTripActions $actions): JsonResponse
    {
        return $this->json($actions->companions($this->account($request), $this->code($request)));
    }

    public function updateCompanions(Request $request, PassengerTripActions $actions): JsonResponse
    {
        $version = $request->header('If-Match');

        return $this->json($actions->updateCompanions($this->account($request), $this->code($request), $request->only(['passengers', 'pickup']), is_numeric($version) ? (int) $version : null));
    }

    private function code(Request $request): ?string
    {
        $trip = $request->input('trip', $request->query('trip'));

        return is_string($trip) && $trip !== '' ? $trip : null;
    }

    private function json(array $data): JsonResponse
    {
        return response()->json(['data' => $data]);
    }

    private function account(Request $request): PortalAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return PortalAccount::of($user);
    }
}
