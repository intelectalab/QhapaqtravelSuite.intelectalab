<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Http\Controllers;

use App\Domain\B2bPortal\Actions\B2bBooking;
use App\Domain\B2bPortal\Actions\B2bReservationChanges;
use App\Domain\B2bPortal\Actions\B2bStatementActions;
use App\Domain\B2bPortal\Support\B2bAccount;
use App\Domain\B2bPortal\Support\B2bCatalog;
use App\Domain\B2bPortal\Support\B2bPortalDirectory;
use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Iam\Actions\AuthenticateUser;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

final class B2bPortalController
{
    public function __construct(
        private readonly B2bPortalDirectory $directory,
        private readonly ChannelKit $kit,
    ) {}

    public function session(Request $request): JsonResponse
    {
        return $this->json($this->directory->session($this->account($request)));
    }

    public function home(Request $request): JsonResponse
    {
        return $this->json($this->directory->home($this->account($request)));
    }

    public function catalog(Request $request): JsonResponse
    {
        return $this->json($this->directory->catalog($this->account($request)));
    }

    public function product(Request $request, string $code): JsonResponse
    {
        return $this->json($this->directory->product($this->account($request), $code, $request->query('month'), (int) $request->query('pax', '2')));
    }

    public function departures(Request $request, string $code, B2bCatalog $catalog): JsonResponse
    {
        $account = $this->account($request);

        return $this->json($catalog->departures($account, $catalog->product($account, $code)));
    }

    public function login(Request $request, AuthenticateUser $authenticate): JsonResponse
    {
        $request->validate(['email' => ['required', 'string', 'email:rfc', 'max:190'], 'password' => ['required', 'string', 'max:72']], ['email.*' => 'Escribe tu correo.', 'password.*' => 'Escribe tu contraseña.']);
        $session = $authenticate($request);

        if (($session['home'] ?? null) !== '/agencia') {
            AccessToken::query()->whereKey(explode('|', (string) ($session['token'] ?? ''))[0])->delete();

            throw new ApiException(401, 'UNAUTHENTICATED', null, 'El correo o la contraseña no son correctos.');
        }

        return $this->json([...$session, 'realm' => 'agency']);
    }

    public function logout(Request $request, AuditLogger $audit): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $user->currentAccessToken()->delete();
        $audit->log('Sesión', (string) $user->code, 'logout');

        return $this->json(['message' => 'Cerraste sesión.']);
    }

    public function simulate(Request $request, B2bBooking $booking): JsonResponse
    {
        $account = $this->account($request);

        return $this->json($booking->simulate($account, $this->bookingData($request, $account, false)));
    }

    public function store(Request $request, B2bBooking $booking): JsonResponse
    {
        $account = $this->account($request);

        return $this->json(['code' => $booking->create($account, $this->bookingData($request, $account, true))]);
    }

    public function reservations(Request $request): JsonResponse
    {
        return $this->json($this->directory->reservations($this->account($request)));
    }

    public function reservation(Request $request, string $code): JsonResponse
    {
        return $this->json($this->directory->reservation($this->account($request), $code));
    }

    public function passenger(Request $request, string $code, int $seq, B2bReservationChanges $changes): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:3', 'max:145'],
            'doc_type' => ['nullable', 'required_with:doc_number', Rule::in(B2bBooking::DOC_TYPES)],
            'doc_number' => ['nullable', 'string', 'max:20', 'regex:/^[A-Za-z0-9\s-]{5,20}$/'],
            'nationality' => ['nullable', 'string', 'max:60'],
            'birth_date' => ['nullable', 'date', 'before:today'],
        ], [
            'full_name.*' => 'Escribe el nombre completo del pasajero.',
            'doc_type.*' => 'Elige el tipo de documento.',
            'doc_number.*' => 'Escribe un número de documento válido.',
            'birth_date.*' => 'La fecha de nacimiento debe ser pasada.',
        ]);
        $changes->savePassenger($this->account($request), $code, $seq, $data);

        return $this->json(['seq' => $seq]);
    }

    public function cancel(Request $request, string $code, B2bReservationChanges $changes): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(ReservationWorkflow::CANCEL_REASONS)],
            'detail' => ['required', 'string', 'min:5', 'max:500'],
        ], [
            'reason.*' => 'Elige el motivo de la anulación.',
            'detail.*' => 'Cuéntanos brevemente por qué anulas.',
        ]);
        $changes->requestCancel($this->account($request), $code, $data['reason'], $data['detail']);

        return $this->json(['code' => $code]);
    }

    public function withdrawCancel(Request $request, string $code, B2bReservationChanges $changes): JsonResponse
    {
        $changes->withdrawCancel($this->account($request), $code);

        return $this->json(['code' => $code]);
    }

    public function statement(Request $request): JsonResponse
    {
        return $this->json($this->directory->statement($this->account($request)));
    }

    public function reportPayment(Request $request, string $code, B2bStatementActions $actions): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999'],
            'method' => ['required', 'string', 'max:40'],
            'reference' => ['required', 'string', 'min:3', 'max:60'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:'.Carbon::tomorrow()->toDateString()],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'amount.*' => 'Escribe un monto mayor a cero.',
            'method.*' => 'Elige el medio de pago.',
            'reference.*' => 'Indica el número de operación.',
            'paid_on.*' => 'La fecha del pago no puede ser futura.',
        ]);

        return $this->json(['code' => $actions->reportPayment($this->account($request), $code, $data)]);
    }

    public function settle(Request $request, B2bStatementActions $actions): JsonResponse
    {
        return $this->json(['code' => $actions->requestSettlement($this->account($request))]);
    }

    public function agency(Request $request): JsonResponse
    {
        return $this->json($this->directory->agency($this->account($request)));
    }

    private function bookingData(Request $request, B2bAccount $account, bool $full): array
    {
        $rules = [
            'product' => ['required', 'string', 'max:30'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$account->today],
            'adults' => ['required', 'integer', 'min:1', 'max:60'],
            'children' => ['nullable', 'integer', 'min:0', 'max:60'],
        ];

        if ($full) {
            $rules += [
                'pay_mode' => ['required', Rule::in(['credito', 'prepago'])],
                'agency_ref' => ['nullable', 'string', 'max:40'],
                'notes' => ['nullable', 'string', 'max:500'],
                'passengers' => ['nullable', 'array', 'max:120'],
                'passengers.*.name' => ['nullable', 'string', 'max:145'],
                'passengers.*.doc_type' => ['nullable', Rule::in(B2bBooking::DOC_TYPES)],
                'passengers.*.doc_number' => ['nullable', 'string', 'max:20', 'regex:/^[A-Za-z0-9\s-]{5,20}$/'],
                'client' => ['nullable', 'array'],
                'client.name' => ['nullable', 'string', 'min:3', 'max:150'],
                'client.doc_type' => ['nullable', 'required_with:client.name', Rule::in(B2bBooking::DOC_TYPES)],
                'client.doc_number' => ['nullable', 'required_with:client.name', 'string', 'regex:/^[A-Za-z0-9-]{5,20}$/'],
                'client.email' => ['nullable', 'required_with:client.name', 'email', 'max:190'],
                'client.phone' => ['nullable', 'string', 'max:30'],
            ];
        }

        return $request->validate($rules, [
            'product.*' => 'Elige un producto.',
            'date.date_format' => 'Elige una fecha válida.',
            'date.after_or_equal' => 'La fecha no puede ser pasada.',
            'date.*' => 'Elige la fecha de salida.',
            'adults.*' => 'Indica cuántos adultos viajan.',
            'children.*' => 'Indica cuántos niños viajan.',
            'pay_mode.*' => 'Elige crédito o prepago.',
            'passengers.*.doc_number.*' => 'Revisa el documento de los pasajeros.',
            'passengers.*' => 'Revisa los datos de los pasajeros.',
            'client.doc_type.*' => 'Elige el tipo de documento del cliente final.',
            'client.doc_number.*' => 'Escribe el documento del cliente final.',
            'client.email.*' => 'Escribe el correo del cliente final.',
            'client.*' => 'Revisa los datos del cliente final.',
        ]);
    }

    private function account(Request $request): B2bAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return B2bAccount::of($user, $this->kit->today());
    }

    private function json(array $data): JsonResponse
    {
        return response()->json(['data' => $data]);
    }
}
