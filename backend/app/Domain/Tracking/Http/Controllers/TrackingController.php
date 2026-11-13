<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Tracking\Actions\ConversionWorkflow;
use App\Domain\Tracking\Actions\TrackingTagWorkflow;
use App\Domain\Tracking\Support\SiteTags;
use App\Domain\Tracking\Support\TagScope;
use App\Domain\Tracking\Support\TrackingCatalog;
use App\Domain\Tracking\Support\TrackingDirectory;
use App\Domain\Tracking\Support\TrackingPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class TrackingController
{
    public function __construct(private readonly TrackingDirectory $directory, private readonly TrackingTagWorkflow $tags, private readonly ConversionWorkflow $conversions) {}

    public function index(Request $request, TrackingPlan $plan): JsonResponse
    {
        $user = $this->user($request);
        $scope = TagScope::tenant();

        return response()->json(['data' => [
            'rows' => $this->directory->tags($scope)->values(),
            'kpis' => $this->directory->kpis($scope),
            'providers' => TrackingDirectory::providers($plan),
            'consent' => ['policy_version' => SiteTags::POLICY_VERSION, 'categories' => SiteTags::CATEGORIES],
            'plan' => ['rank' => $plan->rank(), 'full' => $plan->full(), 'addon' => $plan->hasAddon(), 'retention_days' => $plan->retentionDays()],
            'can_manage' => $user->can('marketing.tracking.manage'),
            'can_approve' => $user->can('marketing.tracking.approve'),
            'admins' => $this->admins(),
            'me' => $user->getKey(),
        ]]);
    }

    public function show(string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code)]);
    }

    public function store(Request $request): JsonResponse
    {
        $code = $this->tags->create(TagScope::tenant(), $request->all(), $this->user($request));

        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code)], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $result = $this->tags->update(TagScope::tenant(), $code, $request->all(), $this->user($request));

        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code), 'meta' => ['pending_revision' => $result['pending_revision']]]);
    }

    public function destroy(Request $request, string $code): Response
    {
        $this->tags->delete(TagScope::tenant(), $code, $this->user($request));

        return response()->noContent();
    }

    public function submit(Request $request, string $code): JsonResponse
    {
        $this->tags->submit(TagScope::tenant(), $code, $this->user($request));

        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code)]);
    }

    public function decision(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:aprobar,rechazar'],
            'reason' => ['nullable', 'string', 'max:500'],
        ], ['decision.*' => 'Elige aprobar o rechazar.']);
        $this->tags->decide(TagScope::tenant(), $code, $data['decision'], $data['reason'] ?? null, $this->user($request), $this->admins());

        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code)]);
    }

    public function pause(Request $request, string $code): JsonResponse
    {
        $this->tags->pause(TagScope::tenant(), $code, $this->user($request));

        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code)]);
    }

    public function verify(Request $request, string $code): JsonResponse
    {
        $this->tags->verify(TagScope::tenant(), $code, $this->user($request));

        return response()->json(['data' => $this->directory->show(TagScope::tenant(), $code), 'meta' => ['message' => 'Verificación en curso. El resultado aparece en la etiqueta en unos segundos.']], 202);
    }

    public function conversions(): JsonResponse
    {
        return response()->json(['data' => $this->directory->conversions(TagScope::tenant())]);
    }

    public function map(Request $request, string $tag, string $event): JsonResponse
    {
        return response()->json(['data' => $this->conversions->map(TagScope::tenant(), $tag, $event, $request->all(), $this->user($request))]);
    }

    public function unmap(Request $request, string $tag, string $event): Response
    {
        $this->conversions->unmap(TagScope::tenant(), $tag, $event, $this->user($request));

        return response()->noContent();
    }

    public function dispatches(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(array_keys(TrackingCatalog::DISPATCH_STATUSES))],
            'provider' => ['nullable', Rule::in(array_keys(TrackingCatalog::PROVIDERS))],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ], ['*.in' => 'Filtro no reconocido.', '*.date_format' => 'La fecha debe tener el formato AAAA-MM-DD.']);

        return response()->json(['data' => $this->directory->dispatches(TagScope::tenant(), $filters)]);
    }

    public function retry(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->conversions->retry(TagScope::tenant(), $id, $this->user($request))]);
    }

    private function admins(): int
    {
        return DB::table('model_has_roles as m')->join('roles as r', 'r.id', '=', 'm.role_id')->join('iam_users as u', 'u.id', '=', 'm.model_id')
            ->where('r.name', 'tenant_admin')->where('u.status', 'activo')->whereNull('u.deleted_at')->distinct()->count('u.id');
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
