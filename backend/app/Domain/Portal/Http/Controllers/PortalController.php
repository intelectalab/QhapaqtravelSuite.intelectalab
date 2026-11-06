<?php

declare(strict_types=1);

namespace App\Domain\Portal\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Actions\PortalMessages;
use App\Domain\Portal\Actions\PortalProfile;
use App\Domain\Portal\Actions\PortalQuoteDecision;
use App\Domain\Portal\Actions\ReportPortalPayment;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Portal\Support\PortalDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

final class PortalController
{
    public function __construct(private readonly PortalDirectory $directory) {}

    public function session(Request $request): JsonResponse
    {
        return $this->json($this->directory->session($this->account($request)));
    }

    public function home(Request $request): JsonResponse
    {
        return $this->json($this->directory->home($this->account($request)));
    }

    public function trips(Request $request): JsonResponse
    {
        return $this->json($this->directory->trips($this->account($request)));
    }

    public function trip(Request $request, string $code): JsonResponse
    {
        return $this->json($this->directory->trip($this->account($request), $code));
    }

    public function quotes(Request $request): JsonResponse
    {
        return $this->json($this->directory->quotes($this->customer($request)));
    }

    public function quote(Request $request, string $code, PortalQuoteDecision $decision): JsonResponse
    {
        $account = $this->customer($request);
        $decision->markViewed($account, $code);

        return $this->json($this->directory->quote($account, $code));
    }

    public function approve(Request $request, string $code, PortalQuoteDecision $decision): JsonResponse
    {
        $account = $this->customer($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'accept' => ['accepted'],
            'comment' => ['nullable', 'string', 'max:500'],
        ], [
            'name.*' => 'Escribe el nombre de quien aprueba.',
            'accept.accepted' => 'Acepta las condiciones de la propuesta para continuar.',
        ]);
        $decision->approve($account, $code, $data, $request->ip());

        return $this->json(['code' => $code]);
    }

    public function reject(Request $request, string $code, PortalQuoteDecision $decision): JsonResponse
    {
        $account = $this->customer($request);
        $data = $request->validate([
            'reason' => ['required', Rule::in(PortalQuoteDecision::REASONS)],
            'comment' => ['required', 'string', 'min:3', 'max:500'],
        ], [
            'reason.*' => 'Elige el motivo.',
            'comment.*' => 'Cuéntanos brevemente el motivo.',
        ]);
        $decision->reject($account, $code, $data['reason'], $data['comment']);

        return $this->json(['code' => $code]);
    }

    public function billing(Request $request): JsonResponse
    {
        return $this->json($this->directory->billing($this->customer($request)));
    }

    public function reportPayment(Request $request, string $code, ReportPortalPayment $report): JsonResponse
    {
        $account = $this->customer($request);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999'],
            'method' => ['required', 'string', 'max:40'],
            'reference' => ['nullable', 'string', 'max:60'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:'.Carbon::tomorrow()->toDateString()],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'amount.*' => 'Escribe un monto mayor a cero.',
            'method.*' => 'Elige cómo pagaste.',
            'paid_on.*' => 'La fecha del pago no puede ser futura.',
        ]);

        return $this->json(['code' => $report($account, $code, $data)]);
    }

    public function profile(Request $request): JsonResponse
    {
        return $this->json($this->directory->profile($this->account($request)));
    }

    public function updateProfile(Request $request, PortalProfile $profile): JsonResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'city' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'max:60'],
            'locale' => ['required', Rule::in(PortalProfile::LOCALES)],
        ], [
            'email.*' => 'Escribe un correo válido.',
            'phone.*' => 'Escribe un teléfono válido.',
            'country.*' => 'Elige un país.',
            'locale.*' => 'Elige un idioma.',
        ]);
        $profile->update($this->account($request), $data);

        return $this->json(['ok' => true]);
    }

    public function consent(Request $request, string $channel, PortalProfile $profile): JsonResponse
    {
        if (! in_array($channel, ['email', 'whatsapp'], true)) {
            throw ApiException::notFound();
        }

        $data = $request->validate(['granted' => ['required', 'boolean']], ['granted.*' => 'Indica si autorizas el envío.']);
        $profile->consent($this->customer($request), $channel, (bool) $data['granted'], $request->ip());

        return $this->json(['channel' => $channel]);
    }

    public function messages(Request $request): JsonResponse
    {
        return $this->json($this->directory->messages($this->account($request)));
    }

    public function sendMessage(Request $request, PortalMessages $messages): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:2000'],
            'subject' => ['nullable', 'string', 'max:180'],
            'conversation' => ['nullable', 'string', 'max:20'],
            'trip' => ['nullable', 'string', 'max:30'],
            'topic' => ['nullable', 'in:general,pagos,documentos,cambios,salud'],
        ], ['body.*' => 'Escribe tu mensaje.']);

        return $this->json(['code' => $messages->send($this->account($request), $data)]);
    }

    private function account(Request $request): PortalAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return PortalAccount::of($user);
    }

    private function customer(Request $request): PortalAccount
    {
        $account = $this->account($request);

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Esta sección es para quien hizo la reserva.');
        }

        return $account;
    }

    private function json(array $data): JsonResponse
    {
        return response()->json(['data' => $data]);
    }
}
