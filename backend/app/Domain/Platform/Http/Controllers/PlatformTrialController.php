<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\StartTrial;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlatformTrialController
{
    public function store(Request $request, StartTrial $trials): JsonResponse
    {
        $data = $request->validate([
            'tenant' => ['required', 'string', 'max:20'],
            'plan' => ['nullable', 'string', 'max:20'],
            'days' => ['nullable', 'integer', 'between:'.StartTrial::MIN_DAYS.','.StartTrial::MAX_DAYS],
            'reason' => ['required', 'string', 'min:5', 'max:300'],
        ], [
            'tenant.required' => 'Elige la agencia.',
            'days.integer' => 'Indica los días de prueba.',
            'days.between' => 'La prueba dura entre '.StartTrial::MIN_DAYS.' y '.StartTrial::MAX_DAYS.' días.',
            'reason.required' => 'Indica el motivo de la prueba.',
            'reason.min' => 'Describe el motivo en al menos 5 caracteres.',
        ]);
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden(null, 'Esta acción es exclusiva de la consola de plataforma.', ['admin.tenant.manage']);
        }

        return response()->json(['data' => $trials($data['tenant'], $data['plan'] ?? null, isset($data['days']) ? (int) $data['days'] : null, trim($data['reason']), $user)]);
    }
}
