<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\B2bPortalPreview;
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

    public function summary(Request $request, B2bDirectory $directory): JsonResponse
    {
        $overview = $directory->overview($this->user($request));

        return response()->json(['data' => ['today' => $overview['today'], 'kpis' => $overview['kpis']]]);
    }

    public function agencies(Request $request, B2bDirectory $directory): JsonResponse
    {
        $status = $request->query('status');
        $query = $request->query('q');
        $items = collect($directory->overview($this->user($request))['items'])
            ->when(is_string($status) && $status !== '', fn ($rows) => $rows->where('effective_status', $status))
            ->when(is_string($query) && $query !== '', fn ($rows) => $rows->filter(fn (array $row): bool => str_contains(mb_strtolower($row['code'].' '.$row['legal_name'].' '.$row['ruc']), mb_strtolower((string) $query))))
            ->values();

        return response()->json(['data' => $items]);
    }

    public function show(Request $request, string $code, B2bDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->agency($code, $this->user($request))]);
    }

    public function movements(string $code, B2bDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->movements($code)]);
    }

    public function settlements(Request $request, B2bDirectory $directory): JsonResponse
    {
        $status = $request->query('status');

        return response()->json(['data' => $directory->settlements(is_string($status) ? $status : null)]);
    }

    public function impersonate(Request $request, string $code, B2bPortalPreview $preview): JsonResponse
    {
        return response()->json(['data' => $preview->start($code, $this->user($request))]);
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

    public function block(Request $request, string $code, ManageB2bAgency $manage): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']], ['reason.required' => 'Indica el motivo del bloqueo.', 'reason.*' => 'El motivo admite hasta 200 caracteres.']);
        $manage->setStatus($code, 'bloqueada', $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function unblock(Request $request, string $code, ManageB2bAgency $manage): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']], ['reason.*' => 'El motivo admite hasta 200 caracteres.']);
        $manage->setStatus($code, 'activa', $data['reason'] ?? null, $this->user($request));

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
