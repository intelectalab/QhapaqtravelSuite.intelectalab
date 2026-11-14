<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Support\ExternalReviewLinks;
use App\Domain\Channels\Support\PostTripInvitations;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ReviewLinksController
{
    public function show(ExternalReviewLinks $links): JsonResponse
    {
        return response()->json(['data' => $links->overview()]);
    }

    public function update(Request $request, ExternalReviewLinks $links): JsonResponse
    {
        $data = $request->validate([
            'google' => ['sometimes', 'nullable', 'string', 'max:500'],
            'tripadvisor' => ['sometimes', 'nullable', 'string', 'max:500'],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], ['google.*' => 'El enlace de Google admite hasta 500 caracteres.', 'tripadvisor.*' => 'El enlace de TripAdvisor admite hasta 500 caracteres.']);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $links->save($data, $user, isset($data['lock_version']) ? (int) $data['lock_version'] : null)]);
    }

    public function test(Request $request, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'platform' => ['required', Rule::in(array_keys(ExternalReviewLinks::PLATFORMS))],
            'url' => ['required', 'string', 'max:500'],
        ], ['platform.*' => 'Elige Google o TripAdvisor.', 'url.*' => 'Pega el enlace público de reseñas.']);
        $result = ExternalReviewLinks::check($data['platform'], $data['url']);
        $audit->log('Reseña externa', 'enlace.'.$data['platform'], 'probar_enlace', null, ($result['ok'] ? 'válido' : 'no válido').' · '.mb_substr($data['url'], 0, 200));

        return response()->json(['data' => ['platform' => $data['platform'], ...$result]]);
    }

    public function invitations(PostTripInvitations $invitations): JsonResponse
    {
        return response()->json(['data' => $invitations->overview()]);
    }

    public function click(Request $request, string $code, PostTripInvitations $invitations): JsonResponse
    {
        $data = $request->validate([
            'target' => ['required', Rule::in(array_keys(ExternalReviewLinks::PLATFORMS))],
            't' => ['required', 'string', 'max:120'],
        ], ['target.*' => 'La plataforma no es válida.', 't.*' => 'El enlace para opinar no es válido.']);

        return response()->json(['data' => ['url' => $invitations->click($code, $data['t'], $data['target'])]]);
    }
}
