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
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\LeadDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class LeadController
{
    public function __construct(private readonly LeadDirectory $directory, private readonly LeadWorkflow $workflow) {}

    public function catalogs(CrmCatalog $catalog): JsonResponse
    {
        return response()->json(['data' => $catalog->options()]);
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
        $this->workflow->changeStatus($code, (string) $request->input('status'), (int) $request->input('lock_version'), $this->user($request));

        return $this->fresh($request, $code);
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
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('El lead no existe.')]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
