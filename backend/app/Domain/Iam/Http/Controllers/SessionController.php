<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\AuthenticateUser;
use App\Domain\Iam\Actions\VerifyMfa;
use App\Domain\Iam\Http\Requests\LoginRequest;
use App\Domain\Iam\Http\Requests\MfaVerifyRequest;
use App\Domain\Iam\Http\Resources\MeResource;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SessionController
{
    public function login(LoginRequest $request, AuthenticateUser $authenticate, PlatformSession $platform): JsonResponse
    {
        $email = (string) $request->input('email');

        if ($platform->owns($email)) {
            return response()->json(['data' => [...$platform->login($email, (string) $request->input('password')), 'realm' => 'platform']]);
        }

        return response()->json(['data' => [...$authenticate($request), 'realm' => 'agency']]);
    }

    public function verifyMfa(MfaVerifyRequest $request, VerifyMfa $verify): JsonResponse
    {
        return response()->json(['data' => $verify($this->user($request), $this->token($request), (string) $request->input('code'))]);
    }

    public function logout(Request $request, AuditLogger $audit): JsonResponse
    {
        $user = $this->user($request);
        $this->token($request)->delete();
        $audit->log('Sesión', (string) $user->code, 'logout');

        return response()->json(['data' => ['message' => 'Cerraste sesión.']]);
    }

    public function me(Request $request): MeResource
    {
        return new MeResource($this->user($request)->load(['roles', 'sede']));
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }

    private function token(Request $request): AccessToken
    {
        $token = $this->user($request)->currentAccessToken();
        assert($token instanceof AccessToken);

        return $token;
    }
}
