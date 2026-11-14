<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\RuleAutomationInbox;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RuleAutomationInboxController
{
    public function index(RuleAutomationInbox $inbox): JsonResponse
    {
        return response()->json(['data' => $inbox->overview()]);
    }

    public function decide(Request $request, string $code, RuleAutomationInbox $inbox): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:'.implode(',', array_keys(RuleAutomationInbox::DECISIONS))],
            'reason' => ['nullable', 'string', 'max:600'],
            'linked_rule' => ['nullable', 'string', 'max:60'],
            'lock_version' => ['nullable', 'integer'],
        ], [
            'decision.*' => 'Elige rechazar, evaluar o publicar.',
            'reason.*' => 'El motivo admite hasta 600 caracteres.',
            'linked_rule.*' => 'Elige una regla estándar del catálogo.',
        ]);
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden(null, 'Esta acción es exclusiva de la consola de plataforma.', ['admin.tenant.manage']);
        }

        return response()->json(['data' => $inbox->decide($code, $data['decision'], $data['reason'] ?? null, $data['linked_rule'] ?? null, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $user)]);
    }
}
