<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Support\SubscriptionDirectory;
use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SubscriptionController
{
    public function index(Request $request, SubscriptionDirectory $directory): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $directory->overview($user)]);
    }

    public function billing(Request $request, SubscriptionDirectory $directory, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'ruc' => ['required', 'regex:/^(10|15|17|20)[0-9]{9}$/'],
            'name' => ['required', 'string', 'max:200'],
            'address' => ['required', 'string', 'max:200'],
            'ubigeo' => ['nullable', 'digits:6'],
            'email' => ['required', 'email', 'max:150'],
        ], [
            'ruc.*' => 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20 (SUB-BR-09).',
            'name.*' => 'Escribe la razón social.',
            'address.*' => 'Escribe la dirección fiscal.',
            'ubigeo.*' => 'El ubigeo tiene 6 dígitos.',
            'email.*' => 'Escribe un correo válido para recibir las facturas.',
        ]);
        $changed = $directory->updateBilling($data);

        if ($changed === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        foreach ($changed as $key => [$old, $new]) {
            $audit->log('Suscripción', str_replace('billing_', 'facturacion.', $key), 'actualizar', TenantSettings::text($old), TenantSettings::text($new));
        }

        return response()->json(['data' => ['changed' => array_keys($changed)]]);
    }
}
