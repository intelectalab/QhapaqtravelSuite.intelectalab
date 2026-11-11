<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\OpportunityWorkflow;
use App\Domain\Crm\Http\Requests\OpportunitySaveRequest;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CatalogInterest;
use App\Domain\Crm\Support\OpportunityDirectory;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class OpportunityController
{
    public function __construct(private readonly OpportunityDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->board($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw Portfolio::missing($this->user($request), 'crm_opportunities', $code, 'La oportunidad no existe.', 'Esta oportunidad')]);
    }

    public function stage(Request $request, string $code, OpportunityWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'stage' => ['required', 'in:calificacion,descubrimiento,cotizacion,negociacion,ganada,perdida'],
            'lost_reason' => ['nullable', 'string'],
            'lost_detail' => ['nullable', 'string', 'max:1000'],
            'confirm_reopen' => ['boolean'],
        ]);
        $warnings = $workflow->changeStage($code, $data, $this->user($request));

        return response()->json(['data' => $this->directory->find($this->user($request), $code), 'meta' => ['warnings' => $warnings]]);
    }

    public function formOptions(Request $request, Advisors $advisors, CatalogInterest $interest): JsonResponse
    {
        $user = $this->user($request);
        $clients = Portfolio::scope(DB::table('crm_clients')->whereNull('deleted_at'), $user, 'owner_id')->orderBy('name')->get(['code', 'name', 'kind']);

        return response()->json(['data' => [
            'clients' => $clients,
            'advisors' => Portfolio::ownOnly($user) ? [] : $advisors->all()->values(),
            'can_reassign' => ! Portfolio::ownOnly($user),
            'stages' => $this->directory->stages()->whereIn('code', OpportunityDirectory::OPEN)->values(),
            'products' => $interest->products(),
        ]]);
    }

    public function store(OpportunitySaveRequest $request, OpportunityWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $workflow->create($request->validated(), $this->user($request))]], 201);
    }

    public function reassign(Request $request, string $code, OpportunityWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'owner_id' => ['required', 'uuid'],
            'note' => ['nullable', 'string', 'max:300'],
            'lock_version' => ['nullable', 'integer'],
        ], ['owner_id.required' => 'Elige el nuevo responsable.']);
        $workflow->reassign($code, $data['owner_id'], $data['note'] ?? null, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $this->user($request));

        return response()->json(['data' => $this->directory->find($this->user($request), $code)]);
    }

    public function update(OpportunitySaveRequest $request, string $code, OpportunityWorkflow $workflow): JsonResponse
    {
        $workflow->update($code, $request->validated(), (int) $request->input('lock_version'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
