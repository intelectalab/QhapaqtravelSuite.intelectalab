<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Http\Controllers;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Tracking\Actions\RecordCookieConsent;
use App\Domain\Tracking\Support\AnalyticsScope;
use App\Domain\Tracking\Support\CookielessCounter;
use App\Domain\Tracking\Support\SiteTags;
use App\Domain\Tracking\Support\TagScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PublicTrackingController
{
    public function __construct(private readonly TenantContext $context) {}

    public function tags(Request $request, SiteTags $tags): JsonResponse
    {
        $data = $request->validate(['path' => ['nullable', 'string', 'max:300'], 'site' => ['nullable', 'in:vitrina,blog,landing']]);
        $path = (string) (parse_url((string) ($data['path'] ?? '/'), PHP_URL_PATH) ?: '/');
        $site = $data['site'] ?? null;
        $scope = $site !== null ? TagScope::platform() : TagScope::tenant();

        return response()->json(['data' => $tags->for($scope, $this->context->id(), $path, $site === 'landing' ? null : $site)])
            ->header('Cache-Control', 'public, max-age=60');
    }

    public function hit(Request $request, CookielessCounter $counter): JsonResponse
    {
        $data = CookielessCounter::validate($request->all());
        $platform = isset($data['site']);
        $scope = $platform ? AnalyticsScope::platform() : AnalyticsScope::tenant($this->context->idOrFail());
        $agency = $platform && ! empty($data['agency'])
            ? DB::connection('pgsql_platform')->table('platform_showcase_agencies')->where('code', $data['agency'])->orWhere('slug', $data['agency'])->value('id')
            : null;
        $country = $request->header('CF-IPCountry') ?? $request->header('X-Country-Code');
        $host = (string) ($request->header('X-Forwarded-Host') ?: $request->getHost());

        return response()->json(['data' => $counter->hit($scope, $data, (string) $request->ip(), (string) $request->userAgent(), $country, $host, $agency === null ? null : (string) $agency)], 202);
    }

    public function consent(Request $request, RecordCookieConsent $record): JsonResponse
    {
        $data = RecordCookieConsent::validate($request->all());

        return response()->json(['data' => $record($data, $data['site'] ?? null, (string) $request->ip(), (string) $request->userAgent())], 201);
    }
}
