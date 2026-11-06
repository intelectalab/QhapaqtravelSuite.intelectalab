<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\ResetPassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PasswordController
{
    public function forgot(Request $request, ResetPassword $reset): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email:rfc', 'max:190']], ['email.*' => 'Escribe un correo válido.']);
        $reset->forgot($data['email']);

        return response()->json(['data' => ['message' => 'Si el correo pertenece a una cuenta activa, te enviamos un enlace para restablecer la contraseña. Vence en '.ResetPassword::MINUTES.' minutos.']]);
    }

    public function reset(Request $request, ResetPassword $reset): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            'token' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:10', 'max:72', 'regex:/[A-Za-z]/', 'regex:/\d/', 'confirmed'],
        ], [
            'email.*' => 'Escribe un correo válido.',
            'token.*' => 'El enlace no es válido.',
            'password.required' => 'Escribe una contraseña.',
            'password.min' => 'La contraseña necesita al menos 10 caracteres.',
            'password.regex' => 'Usa letras y números en la contraseña.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ]);

        return response()->json(['data' => ['email' => $reset->reset($data['email'], $data['token'], $data['password']), 'message' => 'Listo: ya puedes iniciar sesión con tu nueva contraseña.']]);
    }
}
