<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\InboxResponseTimes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class InboxResponseTimesController
{
    public function show(InboxResponseTimes $times): JsonResponse
    {
        return response()->json(['data' => $times->overview()]);
    }

    public function update(Request $request, InboxResponseTimes $times): JsonResponse
    {
        $minutes = ['sometimes', 'integer', Rule::in(InboxResponseTimes::OPTIONS)];
        $data = $request->validate([
            'webchat' => $minutes,
            'form' => $minutes,
            'portal' => $minutes,
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], ['webchat.*' => 'Elige el plazo del chat web.', 'form.*' => 'Elige el plazo de los formularios.', 'portal.*' => 'Elige el plazo del portal.']);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $times->save($data, $user, isset($data['lock_version']) ? (int) $data['lock_version'] : null)]);
    }
}
