<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Http\Controllers;

use App\Domain\Catalog\Actions\ProviderRateReview;
use App\Domain\Catalog\Actions\ProviderUserInvitation;
use App\Domain\Catalog\Support\RateRequestDirectory;
use App\Domain\Finance\Actions\SupplierInvoiceReview;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SupplierBackofficeController
{
    public function rateRequests(Request $request, RateRequestDirectory $directory): JsonResponse
    {
        return response()->json($directory->page($request));
    }

    public function approveRateRequest(Request $request, string $id, RateRequestDirectory $directory, ProviderRateReview $review): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']], ['note.*' => 'La nota admite hasta 500 caracteres.']);
        $code = $directory->code($id);
        $effect = $review->approve($code, $this->note($data), $this->user($request));

        return response()->json(['data' => $directory->find($code), 'meta' => ['effect' => $effect]]);
    }

    public function rejectRateRequest(Request $request, string $id, RateRequestDirectory $directory, ProviderRateReview $review): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica al proveedor por qué se rechaza (mínimo 3 caracteres).']);
        $code = $directory->code($id);
        $review->reject($code, trim($data['note']), $this->user($request));

        return response()->json(['data' => $directory->find($code)]);
    }

    public function rejectInvoice(Request $request, string $id, SupplierInvoiceReview $review): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica el motivo del rechazo (APR-BR-07).']);

        return response()->json(['data' => (array) $review->reject($id, trim($data['note']), $this->user($request))]);
    }

    public function inviteProviderUser(Request $request, string $id, ProviderUserInvitation $invitation): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
        ], ['name.*' => 'Escribe el nombre de la persona.', 'email.*' => 'Escribe un correo válido.', 'phone.*' => 'Escribe un teléfono válido.']);

        return response()->json(['data' => $invitation->invite($id, $data, $this->user($request))]);
    }

    private function note(array $data): ?string
    {
        $note = trim((string) ($data['note'] ?? ''));

        return $note === '' ? null : $note;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
