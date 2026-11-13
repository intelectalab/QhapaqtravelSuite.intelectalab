<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class CookielessCounter
{
    public const VISIT_MINUTES = 30;

    public const LIVE_MINUTES = 30;

    private const BOTS = '/bot|crawl|spider|slurp|headless|lighthouse|curl|wget|python-requests|facebookexternalhit|preview|monitor|pingdom|uptime/i';

    private const SEARCH = ['google', 'bing', 'duckduckgo', 'yahoo', 'yandex', 'ecosia', 'baidu'];

    private const SOCIAL = ['facebook', 'instagram', 't.co', 'twitter', 'x.com', 'linkedin', 'tiktok', 'youtube', 'whatsapp', 'pinterest', 'lnkd.in'];

    public static function validate(array $input): array
    {
        return Validator::make($input, [
            'path' => ['required', 'string', 'max:300', 'starts_with:/'],
            'referrer' => ['nullable', 'string', 'max:500'],
            'utm_source' => ['nullable', 'string', 'max:80'],
            'utm_medium' => ['nullable', 'string', 'max:40'],
            'utm_campaign' => ['nullable', 'string', 'max:120'],
            'gclid' => ['nullable', 'string', 'max:200'],
            'fbclid' => ['nullable', 'string', 'max:300'],
            'ttclid' => ['nullable', 'string', 'max:200'],
            'kind' => ['nullable', 'in:pageview,engagement,conversion'],
            'seconds' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'value' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'site' => ['nullable', 'in:vitrina,blog'],
            'agency' => ['nullable', 'string', 'max:40'],
        ], [
            'path.*' => 'Indica la ruta de la página que se visitó.',
            'kind.in' => 'Tipo de visita no reconocido.',
        ])->validate();
    }

    public function hit(AnalyticsScope $scope, array $data, string $ip, string $userAgent, ?string $country, ?string $ownHost = null, ?string $agencyId = null): array
    {
        if (trim($userAgent) === '' || preg_match(self::BOTS, $userAgent) === 1) {
            return ['counted' => false, 'reason' => 'bot'];
        }

        $now = CarbonImmutable::now(WebAnalyticsReport::TIMEZONE);
        $day = $now->toDateString();
        $site = $scope->isPlatform() ? ($data['site'] ?? 'vitrina') : null;
        $siteKey = $scope->isPlatform() ? 'platform:'.$site : 'tenant:'.$scope->tenantId;
        $hash = hash('sha256', $this->salt($day).'|'.$siteKey.'|'.$this->truncate($ip).'|'.$userAgent);
        $stateKey = "web-visit:{$siteKey}:{$day}:{$hash}";
        $state = Cache::get($stateKey);
        $path = $this->path((string) $data['path']);
        $kind = $data['kind'] ?? 'pageview';
        $fresh = ! is_array($state) || $now->getTimestamp() - (int) $state['last'] > self::VISIT_MINUTES * 60;

        if ($kind === 'engagement') {
            if ($fresh) {
                return ['counted' => false, 'reason' => 'sin_visita'];
            }

            $seconds = (int) ($data['seconds'] ?? 0);
            $this->bump($scope, $state['entry'], ['engaged_seconds' => $seconds]);

            if ($seconds >= 10 && $state['bounce']) {
                $this->unbounce($scope, $state['entry']);
                $state['bounce'] = false;
            }

            Cache::put($stateKey, [...$state, 'last' => $now->getTimestamp()], now()->addHours(26));

            return ['counted' => true, 'kind' => 'engagement'];
        }

        $dims = $fresh ? $this->dims($data, $path, $userAgent, $country, $ownHost, $site, $agencyId, $day) : [...$state['entry'], 'path' => $path];

        if ($kind === 'conversion') {
            $target = $fresh ? $dims : $state['entry'];
            $this->bump($scope, $target, ['conversions' => 1, 'revenue' => (string) ($data['value'] ?? 0)]);

            return ['counted' => true, 'kind' => 'conversion'];
        }

        if ($fresh) {
            $counted = (array) ($state['rows'] ?? []);
            $rowKey = md5(json_encode($dims));
            $this->bump($scope, $dims, ['visits' => 1, 'visitors' => in_array($rowKey, $counted, true) ? 0 : 1, 'pageviews' => 1, 'bounces' => 1]);
            $state = ['entry' => $dims, 'last' => $now->getTimestamp(), 'pages' => 1, 'bounce' => true, 'rows' => [...$counted, $rowKey]];
        } else {
            $this->bump($scope, $dims, ['pageviews' => 1]);

            if ($state['bounce']) {
                $this->unbounce($scope, $state['entry']);
            }

            $state = [...$state, 'last' => $now->getTimestamp(), 'pages' => (int) $state['pages'] + 1, 'bounce' => false];
        }

        Cache::put($stateKey, $state, now()->addHours(26));
        $this->remember($scope->isPlatform() ? ['platform:'.$site, 'platform:todos'] : [$siteKey], $hash, $path, $now->getTimestamp());

        return ['counted' => true, 'kind' => 'pageview', 'new_visit' => $fresh];
    }

    public function live(string $key): array
    {
        $cutoff = now()->getTimestamp() - self::LIVE_MINUTES * 60;
        $visitors = collect((array) Cache::get('web-live:'.$key, []))->filter(fn (array $entry) => $entry['at'] >= $cutoff);

        return [
            'visitors' => $visitors->count(),
            'pages' => $visitors->groupBy('path')->map(fn ($items, $path) => ['path' => $path, 'visitors' => $items->count()])->sortByDesc('visitors')->take(6)->values()->all(),
            'window_minutes' => self::LIVE_MINUTES,
        ];
    }

    public function source(array $data, ?string $ownHost): array
    {
        if (! empty($data['utm_source'])) {
            return [mb_strtolower(trim((string) $data['utm_source'])), mb_strtolower(trim((string) ($data['utm_medium'] ?? ''))) ?: '(ninguno)', trim((string) ($data['utm_campaign'] ?? ''))];
        }

        if (! empty($data['gclid'])) {
            return ['google', 'cpc', trim((string) ($data['utm_campaign'] ?? ''))];
        }

        if (! empty($data['fbclid'])) {
            return ['facebook', 'paid', trim((string) ($data['utm_campaign'] ?? ''))];
        }

        if (! empty($data['ttclid'])) {
            return ['tiktok', 'paid', trim((string) ($data['utm_campaign'] ?? ''))];
        }

        $host = mb_strtolower((string) parse_url((string) ($data['referrer'] ?? ''), PHP_URL_HOST));
        $host = preg_replace('/^(www|m|l|lm)\./', '', $host) ?? $host;

        if ($host === '' || ($ownHost !== null && $host === preg_replace('/^www\./', '', mb_strtolower($ownHost)))) {
            return ['(directo)', '(ninguno)', ''];
        }

        $medium = match (true) {
            collect(self::SEARCH)->contains(fn (string $engine) => str_contains($host, $engine)) => 'organic',
            collect(self::SOCIAL)->contains(fn (string $network) => str_contains($host, $network)) => 'social',
            default => 'referral',
        };
        $source = $medium === 'referral' ? $host : collect([...self::SEARCH, ...self::SOCIAL])->first(fn (string $name) => str_contains($host, $name)) ?? $host;

        return [mb_substr($source, 0, 80), $medium, ''];
    }

    public static function device(string $userAgent): string
    {
        return match (true) {
            preg_match('/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i', $userAgent) === 1 => 'tablet',
            preg_match('/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i', $userAgent) === 1 => 'movil',
            preg_match('/windows|macintosh|linux|x11|cros/i', $userAgent) === 1 => 'escritorio',
            default => 'otro',
        };
    }

    private function dims(array $data, string $path, string $userAgent, ?string $country, ?string $ownHost, ?string $site, ?string $agencyId, string $day): array
    {
        [$source, $medium, $campaign] = $this->source($data, $ownHost);
        $country = strtoupper(trim((string) $country));

        return array_filter([
            'day' => $day,
            'site' => $site,
            'agency_id' => $agencyId,
            'path' => $path,
            'source' => mb_substr($source, 0, 80),
            'medium' => mb_substr($medium, 0, 40),
            'campaign' => mb_substr($campaign, 0, 120),
            'device' => self::device($userAgent),
            'country' => preg_match('/^[A-Z]{2}$/', $country) === 1 && $country !== 'XX' ? $country : 'ZZ',
        ], fn ($value) => $value !== null);
    }

    private function bump(AnalyticsScope $scope, array $dims, array $metrics): void
    {
        $platform = $scope->isPlatform();
        $table = $scope->table;
        $columns = ['visits', 'visitors', 'pageviews', 'bounces', 'engaged_seconds', 'conversions', 'revenue'];
        $values = array_map(fn (string $column) => $metrics[$column] ?? 0, $columns);
        $dimColumns = $platform ? ['day', 'site', 'path', 'agency_id', 'source', 'medium', 'campaign', 'device', 'country'] : ['day', 'path', 'source', 'medium', 'campaign', 'device', 'country'];
        $dimValues = array_map(fn (string $column) => $dims[$column] ?? null, $dimColumns);
        $conflict = $platform
            ? "(day, site, path, coalesce(agency_id, '00000000-0000-0000-0000-000000000000'::uuid), source, medium, campaign, device, country)"
            : '(tenant_id, day, path, source, medium, campaign, device, country)';
        $updates = implode(', ', array_map(fn (string $column) => "{$column} = {$table}.{$column} + excluded.{$column}", $columns));
        $all = [...$dimColumns, ...$columns];

        DB::connection($scope->connection)->statement(
            "insert into {$table} (".implode(', ', $all).', computed_at) values ('.implode(', ', array_fill(0, count($all), '?')).", now()) on conflict {$conflict} do update set {$updates}, computed_at = now()",
            [...$dimValues, ...$values],
        );
    }

    private function unbounce(AnalyticsScope $scope, array $dims): void
    {
        $query = DB::connection($scope->connection)->table($scope->table)->where('bounces', '>', 0);

        foreach ($dims as $column => $value) {
            $query->where($column, $value);
        }

        if ($scope->isPlatform() && ! isset($dims['agency_id'])) {
            $query->whereNull('agency_id');
        }

        $query->update(['bounces' => DB::raw('bounces - 1')]);
    }

    private function remember(array $keys, string $hash, string $path, int $at): void
    {
        $cutoff = $at - self::LIVE_MINUTES * 60;

        foreach ($keys as $key) {
            $entries = collect((array) Cache::get('web-live:'.$key, []))->filter(fn (array $entry) => $entry['at'] >= $cutoff)->all();
            $entries[$hash] = ['at' => $at, 'path' => $path];
            Cache::put('web-live:'.$key, array_slice($entries, -500, null, true), now()->addMinutes(self::LIVE_MINUTES + 5));
        }
    }

    private function path(string $raw): string
    {
        $path = (string) parse_url($raw, PHP_URL_PATH);

        return mb_substr($path === '' ? '/' : $path, 0, 300);
    }

    private function salt(string $day): string
    {
        return hash_hmac('sha256', 'web-salt|'.$day, (string) config('app.key'));
    }

    private function truncate(string $ip): string
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return preg_replace('/\.\d+$/', '.0', $ip) ?? $ip;
        }

        return implode(':', array_slice(explode(':', $ip), 0, 3)).'::';
    }
}
