<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\AcceptInvitation;
use App\Domain\Iam\Actions\AuthenticateUser;
use App\Domain\Iam\Actions\EnrollMfa;
use App\Domain\Iam\Actions\VerifyMfa;
use App\Domain\Iam\Http\Requests\LoginRequest;
use App\Domain\Iam\Http\Requests\MfaVerifyRequest;
use App\Domain\Iam\Http\Resources\MeResource;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\AccessMap;
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

    public function enrollMfa(Request $request, EnrollMfa $enroll): JsonResponse
    {
        return response()->json(['data' => $enroll->start($this->user($request), $this->token($request))]);
    }

    public function confirmMfa(MfaVerifyRequest $request, EnrollMfa $enroll): JsonResponse
    {
        return response()->json(['data' => $enroll->confirm($this->user($request), $this->token($request), (string) $request->input('code'))]);
    }

    public function access(Request $request, AccessMap $access): JsonResponse
    {
        return response()->json(['data' => $access->for($this->user($request))]);
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

    public function invitation(string $token, AcceptInvitation $invitations): JsonResponse
    {
        return response()->json(['data' => $invitations->show($token)]);
    }

    public function acceptInvitation(Request $request, string $token, AcceptInvitation $invitations): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:10', 'max:72', 'regex:/[A-Za-z]/', 'regex:/\d/', 'confirmed'],
        ], [
            'password.required' => 'Escribe una contraseña.',
            'password.min' => 'La contraseña necesita al menos 10 caracteres.',
            'password.regex' => 'Usa letras y números en la contraseña.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ]);

        return response()->json(['data' => $invitations->accept($token, $data['password'])]);
    }

    private function token(Request $request): AccessToken
    {
        $token = $this->user($request)->currentAccessToken();
        assert($token instanceof AccessToken);

        return $token;
    }
}
