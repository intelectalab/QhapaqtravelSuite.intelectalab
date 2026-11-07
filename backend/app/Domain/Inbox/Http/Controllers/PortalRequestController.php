<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Finance\Actions\SupplierInvoiceReview;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PortalRequestController
{
    public function validateInvoice(Request $request, string $code, SupplierInvoiceReview $review): JsonResponse
    {
        $review->validate($code, $this->note($request, false), $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => 'validada']]);
    }

    public function observeInvoice(Request $request, string $code, SupplierInvoiceReview $review): JsonResponse
    {
        $review->observe($code, (string) $this->note($request, true), $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => 'observada']]);
    }

    private function note(Request $request, bool $required): ?string
    {
        $data = $request->validate(
            ['note' => [$required ? 'required' : 'nullable', 'string', $required ? 'min:3' : 'min:0', 'max:500']],
            ['note.*' => 'Explica el motivo (APR-BR-07).'],
        );
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
