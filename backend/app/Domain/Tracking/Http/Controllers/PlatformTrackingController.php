<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Http\Controllers;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Tracking\Actions\ConversionWorkflow;
use App\Domain\Tracking\Actions\TrackingTagWorkflow;
use App\Domain\Tracking\Support\AnalyticsScope;
use App\Domain\Tracking\Support\BlogSync;
use App\Domain\Tracking\Support\TagScope;
use App\Domain\Tracking\Support\TrackingDirectory;
use App\Domain\Tracking\Support\WebAnalyticsReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

final class PlatformTrackingController
{
    private const RETENTION_DAYS = 396;

    public function __construct(private readonly TrackingDirectory $directory, private readonly TrackingTagWorkflow $tags) {}

    public function index(Request $request): JsonResponse
    {
        $scope = TagScope::platform();

        return response()->json(['data' => [
            'rows' => $this->directory->tags($scope)->values(),
            'kpis' => $this->directory->kpis($scope),
            'conversions' => $this->directory->conversions($scope),
            'providers' => TrackingDirectory::providers(null),
            'me' => $this->actor($request)->getKey(),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $code = $this->tags->create(TagScope::platform(), $request->all(), $this->actor($request));

        return response()->json(['data' => $this->directory->show(TagScope::platform(), $code)], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $actor = $this->actor($request);
        $action = $request->validate(['action' => ['nullable', 'in:editar,pausar,reanudar,enviar_revision']], ['action.in' => 'Acción no reconocida.'])['action'] ?? 'editar';
        $scope = TagScope::platform();
        $pending = false;

        match ($action) {
            'pausar', 'reanudar' => $this->tags->pause($scope, $code, $actor),
            'enviar_revision' => $this->tags->submit($scope, $code, $actor),
            default => $pending = $this->tags->update($scope, $code, Arr::except($request->all(), ['action']), $actor)['pending_revision'],
        };

        return response()->json(['data' => $this->directory->show($scope, $code), 'meta' => ['pending_revision' => $pending]]);
    }

    public function decision(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:aprobar,rechazar'],
            'reason' => ['nullable', 'string', 'max:500'],
        ], ['decision.*' => 'Elige aprobar o rechazar.']);
        $this->tags->decide(TagScope::platform(), $code, $data['decision'], $data['reason'] ?? null, $this->actor($request));

        return response()->json(['data' => $this->directory->show(TagScope::platform(), $code)]);
    }

    public function map(Request $request, string $tag, string $event, ConversionWorkflow $conversions): JsonResponse
    {
        return response()->json(['data' => $conversions->map(TagScope::platform(), $tag, $event, $request->all(), $this->actor($request))]);
    }

    public function overview(Request $request, WebAnalyticsReport $report): JsonResponse
    {
        $period = WebAnalyticsReport::period($request->query(), self::RETENTION_DAYS);

        return response()->json(['data' => [
            ...$report->overview(AnalyticsScope::platform(), $period),
            'pages' => array_slice($report->pages(AnalyticsScope::platform(), $period), 0, 20),
            'sources' => array_slice($report->sources(AnalyticsScope::platform(), $period), 0, 20),
            'devices' => $report->devices(AnalyticsScope::platform(), $period),
            'filters' => ['site' => $period['site'], 'agency' => $period['agency']],
        ]]);
    }

    public function agencies(Request $request, WebAnalyticsReport $report): JsonResponse
    {
        return response()->json(['data' => $report->agencies(WebAnalyticsReport::period($request->query(), self::RETENTION_DAYS))]);
    }

    public function blogStatus(BlogSync $sync): JsonResponse
    {
        return response()->json(['data' => $sync->status()]);
    }

    private function actor(Request $request): PlatformUser
    {
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden(null, 'Esta acción es exclusiva de la consola de plataforma.', ['admin.tenant.manage']);
        }

        return $user;
    }
}
