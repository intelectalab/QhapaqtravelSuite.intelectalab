<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ManageB2bAgency;
use App\Domain\Channels\Support\B2bDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class B2bAgencyController
{
    public function index(Request $request, B2bDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function store(Request $request, ManageB2bAgency $manage): JsonResponse
    {
        $code = $manage->create($this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code, ManageB2bAgency $manage): JsonResponse
    {
        $manage->update($code, $this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function status(Request $request, string $code, ManageB2bAgency $manage): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:activa,bloqueada,inactiva'],
            'reason' => ['nullable', 'required_if:status,bloqueada', 'string', 'max:200'],
        ], ['status.*' => 'Elige el nuevo estado.', 'reason.required_if' => 'Indica el motivo del bloqueo.', 'reason.*' => 'El motivo admite hasta 200 caracteres.']);
        $manage->setStatus($code, $data['status'], $data['reason'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(Request $request, string $code, ManageB2bAgency $manage): JsonResponse
    {
        $manage->setStatus($code, 'inactiva', $request->string('reason')->toString() ?: null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'legal_name' => ['required', 'string', 'max:200'],
            'ruc' => ['required', 'regex:/^\d{11}$/'],
            'contact_name' => ['required', 'string', 'max:150'],
            'booking_email' => ['nullable', 'email', 'max:190'],
            'client' => ['nullable', 'string', 'exists:crm_clients,code'],
            'price_list_id' => ['required', 'uuid', 'exists:channel_b2b_price_lists,id'],
            'commission_pct' => ['required', 'numeric', 'between:0,30'],
            'currency' => ['required', 'in:PEN,USD'],
            'credit_limit' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'valid_from' => ['required', 'date'],
            'valid_to' => ['required', 'date', 'after_or_equal:valid_from'],
        ], [
            'legal_name.*' => 'Indica la razón social.',
            'ruc.*' => 'El RUC debe tener 11 dígitos.',
            'contact_name.*' => 'Indica la persona de contacto.',
            'booking_email.*' => 'Revisa el correo de reservas.',
            'client.*' => 'Elige un cliente válido.',
            'price_list_id.*' => 'Elige la lista de precios.',
            'commission_pct.*' => 'La comisión debe estar entre 0 y 30 %.',
            'currency.*' => 'Elige la moneda de la línea.',
            'credit_limit.*' => 'Revisa la línea de crédito.',
            'valid_from.*' => 'Indica el inicio de vigencia.',
            'valid_to.after_or_equal' => 'El fin de vigencia no puede ser anterior al inicio.',
            'valid_to.*' => 'Indica el fin de vigencia.',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
