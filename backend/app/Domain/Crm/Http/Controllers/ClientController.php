<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\ClientPortalAccess;
use App\Domain\Crm\Actions\ClientWorkflow;
use App\Domain\Crm\Http\Requests\ClientSaveRequest;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\ClientDirectory;
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ClientController
{
    public function __construct(private readonly ClientDirectory $directory, private readonly ClientWorkflow $workflow) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request)), 'meta' => ['today' => $this->directory->today()]]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        $client = $this->directory->find($this->user($request), $code) ?? throw Portfolio::missing($this->user($request), 'crm_clients', $code, 'El cliente no existe.', 'Este cliente');

        return response()->json(['data' => $client, 'meta' => ['today' => $this->directory->today()]]);
    }

    public function formOptions(Request $request, CrmCatalog $catalog, Advisors $advisors): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => [
            'segments' => $catalog->options()->get('client_segment', collect())->pluck('label')->values(),
            'advisors' => Portfolio::ownOnly($user) ? [] : $advisors->all()->values(),
            'can_reassign' => ! Portfolio::ownOnly($user),
            'can_manage' => $user->can('crm.clients.manage'),
        ]]);
    }

    public function store(ClientSaveRequest $request): JsonResponse
    {
        return response()->json(['data' => ['code' => $this->workflow->create($request->validated(), $this->user($request))]], 201);
    }

    public function update(ClientSaveRequest $request, string $code): JsonResponse
    {
        $this->workflow->update($code, $request->validated(), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function archive(Request $request, string $code): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:300']]);
        $this->workflow->archive($code, $request->input('reason'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function invitePortal(Request $request, string $code, ClientPortalAccess $access): JsonResponse
    {
        return response()->json(['data' => $access->invite($code, $this->user($request))], 201);
    }

    public function resendPortal(Request $request, string $code, ClientPortalAccess $access): JsonResponse
    {
        return response()->json(['data' => $access->resend($code, $this->user($request))]);
    }

    public function revokePortal(Request $request, string $code, ClientPortalAccess $access): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        return response()->json(['data' => $access->revoke($code, $request->input('reason'), $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
