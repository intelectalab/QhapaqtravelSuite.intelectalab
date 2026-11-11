<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\LeadWorkflow;
use App\Domain\Crm\Http\Requests\LeadConvertRequest;
use App\Domain\Crm\Http\Requests\LeadDiscardRequest;
use App\Domain\Crm\Http\Requests\LeadQualifyRequest;
use App\Domain\Crm\Http\Requests\LeadStatusRequest;
use App\Domain\Crm\Http\Requests\LeadStoreRequest;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CatalogInterest;
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\LeadDirectory;
use App\Domain\Crm\Support\LeadDuplicates;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class LeadController
{
    public function __construct(private readonly LeadDirectory $directory, private readonly LeadWorkflow $workflow) {}

    public function catalogs(CrmCatalog $catalog, CatalogInterest $interest): JsonResponse
    {
        return response()->json(['data' => $catalog->options()->merge($interest->options())]);
    }

    public function store(LeadStoreRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->workflow->create($request->validated(), $this->user($request))], 201);
    }

    public function update(LeadStoreRequest $request, string $code): JsonResponse
    {
        $request->validate(['lock_version' => ['required', 'integer']]);
        $this->workflow->update($code, $request->validated(), (int) $request->input('lock_version'), $this->user($request));

        return $this->fresh($request, $code);
    }

    public function assign(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'owner_id' => ['required', 'uuid'],
            'schedule_first_contact' => ['boolean'],
            'reason' => ['nullable', 'string', 'max:300'],
        ], ['owner_id.required' => 'Elige el asesor.']);
        $this->workflow->assign($code, $data['owner_id'], (bool) ($data['schedule_first_contact'] ?? false), $data['reason'] ?? null, $this->user($request));

        return $this->fresh($request, $code);
    }

    public function advisors(Advisors $advisors): JsonResponse
    {
        return response()->json(['data' => $advisors->all()->values()]);
    }

    public function take(Request $request, string $code): JsonResponse
    {
        $this->workflow->take($code, $this->user($request));

        return $this->fresh($request, $code);
    }

    public function status(LeadStatusRequest $request, string $code): JsonResponse
    {
        $this->workflow->changeStatus($code, (string) $request->input('status'), (int) $request->input('lock_version'), $this->user($request), $request->input('note'));

        return $this->fresh($request, $code);
    }

    public function duplicates(Request $request, LeadDuplicates $matcher): JsonResponse
    {
        $data = $request->validate(['email' => ['nullable', 'string', 'max:190'], 'phone' => ['nullable', 'string', 'max:40'], 'exclude' => ['nullable', 'string', 'max:30']]);
        $exclude = isset($data['exclude']) ? DB::table('crm_leads')->where('code', $data['exclude'])->value('id') : null;
        $matches = collect($matcher->find($data['email'] ?? null, $data['phone'] ?? null, $exclude))
            ->map(fn (array $match) => collect($match)->except('id')->all());

        return response()->json(['data' => $matches->values()]);
    }

    public function reopen(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['lock_version' => ['required', 'integer']]);
        $this->workflow->reopen($code, (int) $data['lock_version'], $this->user($request));

        return $this->fresh($request, $code);
    }

    public function markDuplicate(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'duplicate_of_type' => ['required', 'in:lead,client'],
            'duplicate_of_id' => ['required', 'uuid'],
            'lock_version' => ['required', 'integer'],
        ], ['duplicate_of_id.required' => 'Elige la coincidencia.']);
        $this->workflow->markDuplicate($code, $data['duplicate_of_type'], $data['duplicate_of_id'], (int) $data['lock_version'], $this->user($request));

        return $this->fresh($request, $code);
    }

    public function merge(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['source_lead_id' => ['required', 'uuid']], ['source_lead_id.required' => 'Elige el lead que se fusiona en este.']);
        $result = $this->workflow->merge($code, $data['source_lead_id'], $this->user($request));

        return response()->json(['data' => $this->directory->find($this->user($request), $code), 'meta' => $result]);
    }

    public function qualify(LeadQualifyRequest $request, string $code): JsonResponse
    {
        $this->workflow->qualify($code, $request->validated(), (int) $request->input('lock_version'), $request->boolean('mark_qualified'), $this->user($request));

        return $this->fresh($request, $code);
    }

    public function discard(LeadDiscardRequest $request, string $code): JsonResponse
    {
        $this->workflow->discard($code, (string) $request->input('reason'), $request->input('detail'), (int) $request->input('lock_version'), $this->user($request));

        return $this->fresh($request, $code);
    }

    public function convert(LeadConvertRequest $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->workflow->convert($code, $request->validated(), (int) $request->input('lock_version'), $this->user($request))]);
    }

    private function fresh(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code)]);
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw Portfolio::missing($this->user($request), 'crm_leads', $code, 'El lead no existe.', 'Este lead')]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
