<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\IssueOAuthTokens;
use App\Domain\Admin\Actions\OAuthAuthorization;
use App\Domain\Admin\Support\OAuthTokenError;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OAuthController
{
    public function show(Request $request, OAuthAuthorization $authorization): JsonResponse
    {
        return response()->json(['data' => $authorization->describe($this->validated($request))]);
    }

    public function decide(Request $request, OAuthAuthorization $authorization): JsonResponse
    {
        $data = $this->validated($request);
        $approve = $request->validate(['approve' => ['required', 'boolean']], ['approve.*' => 'Indica si autorizas o rechazas el acceso.'])['approve'];
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $authorization->decide($data, (bool) $approve, $user)]);
    }

    public function token(Request $request, IssueOAuthTokens $tokens): JsonResponse
    {
        $input = $request->only(['grant_type', 'client_id', 'client_secret', 'code', 'redirect_uri', 'code_verifier', 'refresh_token']);

        if ($request->getUser() !== null) {
            $input['client_id'] = urldecode((string) $request->getUser());
            $input['client_secret'] = urldecode((string) $request->getPassword());
        }

        try {
            return response()->json($tokens->exchange($input), 200, ['Cache-Control' => 'no-store', 'Pragma' => 'no-cache']);
        } catch (OAuthTokenError $e) {
            return $e->render();
        }
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'response_type' => ['required', 'in:code'],
            'client_id' => ['required', 'uuid'],
            'redirect_uri' => ['required', 'string', 'max:300'],
            'scope' => ['nullable', 'string', 'max:500'],
            'state' => ['nullable', 'string', 'max:500'],
            'code_challenge' => ['required', 'string', 'regex:/^[A-Za-z0-9\-._~]{43,128}$/'],
            'code_challenge_method' => ['required', 'in:S256'],
        ], [
            'response_type.*' => 'Solo se admite response_type=code.',
            'client_id.*' => 'Falta el identificador de la aplicación o no es válido.',
            'redirect_uri.*' => 'Falta la URL de retorno.',
            'scope.*' => 'Los permisos pedidos no son válidos.',
            'state.*' => 'El parámetro state es demasiado largo.',
            'code_challenge.*' => 'Falta el code_challenge de PKCE o no es válido.',
            'code_challenge_method.*' => 'Solo se admite PKCE con S256.',
        ]);
    }
}
