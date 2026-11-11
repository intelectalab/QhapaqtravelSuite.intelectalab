<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\ConversationCrm;
use App\Domain\Crm\Http\Requests\LeadStoreRequest;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ConversationCrmController
{
    public function __construct(private readonly ConversationCrm $crm) {}

    public function lead(LeadStoreRequest $request, string $code): JsonResponse
    {
        $request->validate(['lock_version' => ['nullable', 'integer']]);
        $version = $request->filled('lock_version') ? (int) $request->input('lock_version') : null;

        return response()->json(['data' => $this->crm->createLead($code, $request->validated(), $version, $this->user($request))], 201);
    }

    public function activity(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(ActivityController::fields(true), ActivityController::MESSAGES);

        return response()->json(['data' => $this->crm->createActivity($code, $data, $this->user($request))], 201);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
