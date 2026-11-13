<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Actions\PortalQuoteDecision;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Quotes\Actions\QuoteAccessTokens;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class PublicQuoteDecisionController
{
    public function approve(Request $request, PortalQuoteDecision $decision, string $token): JsonResponse
    {
        $account = $this->customer($request);
        $quote = $this->quote($account, $token);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'accept' => ['accepted'],
            'comment' => ['nullable', 'string', 'max:500'],
        ], [
            'name.*' => 'Escribe el nombre de quien aprueba.',
            'accept.accepted' => 'Acepta las condiciones de la propuesta para continuar.',
            'comment.*' => 'El comentario admite hasta 500 caracteres.',
        ]);
        $decision->approve($account, (string) $quote->code, $data, $request->ip());

        return $this->result((string) $quote->id);
    }

    public function reject(Request $request, PortalQuoteDecision $decision, string $token): JsonResponse
    {
        $account = $this->customer($request);
        $quote = $this->quote($account, $token);
        $data = $request->validate([
            'reason' => ['required', Rule::in(PortalQuoteDecision::REASONS)],
            'comment' => ['required', 'string', 'min:3', 'max:500'],
        ], [
            'reason.*' => 'Elige el motivo.',
            'comment.*' => 'Cuéntanos brevemente el motivo.',
        ]);
        $decision->reject($account, (string) $quote->code, $data['reason'], $data['comment']);

        return $this->result((string) $quote->id);
    }

    private function customer(Request $request): PortalAccount
    {
        $user = $request->user();
        assert($user instanceof User);
        $account = PortalAccount::of($user);

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Solo quien recibió la propuesta puede aprobarla o rechazarla.');
        }

        return $account;
    }

    private function quote(PortalAccount $account, string $token): object
    {
        $quoteId = preg_match(QuoteAccessTokens::PATTERN, $token) === 1
            ? DB::table('quote_access_tokens')->where('token_hash', QuoteAccessTokens::hash($token))->whereNull('revoked_at')->value('quote_id')
            : null;
        $code = $quoteId === null ? null : DB::table('quote_quotes')->where('id', $quoteId)->whereNull('deleted_at')->value('code');

        if ($code === null) {
            throw ApiException::notFound('El enlace no es válido o fue reemplazado por uno nuevo. Pide a tu asesor que te lo envíe otra vez.');
        }

        return $account->quote((string) $code);
    }

    private function result(string $quoteId): JsonResponse
    {
        $quote = DB::table('quote_quotes')->where('id', $quoteId)->first(['code', 'status', 'approved_at', 'lock_version']);

        return response()->json(['data' => ['code' => $quote->code, 'status' => $quote->status, 'approved_at' => $quote->approved_at, 'lock_version' => (int) $quote->lock_version]]);
    }
}
