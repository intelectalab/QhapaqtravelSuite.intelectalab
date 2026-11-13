<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TrackingDirectory
{
    public function tags(TagScope $scope): Collection
    {
        $users = $this->users($scope);
        $mapped = $scope->db()->table($scope->mappings)->where('active', true)->selectRaw('tag_id, count(*) as n')->groupBy('tag_id')->pluck('n', 'tag_id');

        return $scope->db()->table($scope->tags)->whereNull('deleted_at')->orderBy('code')->get()
            ->map(fn (object $tag) => $this->row($scope, $tag, $users, (int) ($mapped[$tag->id] ?? 0)));
    }

    public function show(TagScope $scope, string $code): array
    {
        $tag = $scope->db()->table($scope->tags)->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('La etiqueta no existe.');
        $users = $this->users($scope);
        $mappings = $scope->db()->table($scope->mappings)->where('tag_id', $tag->id)->where('active', true)->orderBy('internal_event')->get()
            ->map(fn (object $m) => ['event' => $m->internal_event, 'label' => $scope->events()[$m->internal_event]['label'] ?? $m->internal_event, 'provider_event' => $m->provider_event, 'conversion_label' => $m->conversion_label, 'send_value' => (bool) $m->send_value, 'server_side' => (bool) $m->server_side]);
        $history = $scope->db()->table('audit_events')->whereIn('entity', [$scope->entity, $scope->scriptEntity])->where('entity_id', $code)
            ->when($scope->isPlatform(), fn ($query) => $query->whereNull('tenant_id'))
            ->orderByDesc('occurred_at')->limit(30)->get(['code', 'occurred_at', 'action', 'before_value', 'after_value', 'actor_id'])
            ->map(fn (object $event): array => ['code' => (int) $event->code, 'at' => Carbon::parse($event->occurred_at)->toIso8601String(), 'action' => $event->action, 'before' => $event->before_value, 'after' => $event->after_value, 'actor' => $users->get((string) $event->actor_id, 'Sistema')]);

        return [...$this->row($scope, $tag, $users, $mappings->count()), 'mappings' => $mappings->values(), 'history' => $history->values()];
    }

    public function conversions(TagScope $scope): array
    {
        $tags = $scope->db()->table($scope->tags)->whereNull('deleted_at')->whereNotIn('provider', ['script', 'gtm'])->where('status', '<>', 'rechazado')->orderBy('code')->get();
        $mappings = $scope->db()->table($scope->mappings)->whereIn('tag_id', $tags->pluck('id'))->where('active', true)->get()
            ->groupBy('tag_id')->map(fn (Collection $rows): array => $rows->keyBy('internal_event')->map(fn (object $m): array => [
                'provider_event' => $m->provider_event,
                'conversion_label' => $m->conversion_label,
                'send_value' => (bool) $m->send_value,
                'server_side' => (bool) $m->server_side,
            ])->all());

        return [
            'tags' => $tags->map(fn (object $tag): array => [
                'code' => $tag->code,
                'name' => $tag->name,
                'provider' => $tag->provider,
                'provider_name' => TrackingCatalog::provider($tag->provider)['short'],
                'status' => $tag->status,
                'site' => $tag->site ?? null,
                'server_capable' => TrackingCatalog::supportsServer($tag->provider) && (bool) (((array) json_decode((string) $tag->config, true))['server_side'] ?? false),
                'mappings' => (object) ($mappings[$tag->id] ?? []),
                'defaults' => collect($scope->events())->mapWithKeys(fn (array $event, string $key): array => [$key => TrackingCatalog::defaultProviderEvent($tag->provider, $key, $scope->events())]),
            ])->values(),
            'events' => collect($scope->events())->map(fn (array $event, string $key) => ['code' => $key, ...$event])->values(),
        ];
    }

    public function dispatches(TagScope $scope, array $filters): array
    {
        $query = $scope->db()->table($scope->dispatches.' as d')
            ->join($scope->mappings.' as m', 'm.id', '=', 'd.mapping_id')
            ->join($scope->tags.' as t', 't.id', '=', 'm.tag_id')
            ->when(! $scope->isPlatform(), fn ($q) => $q->leftJoin('channel_ecom_orders as o', 'o.id', '=', 'd.order_id'))
            ->when($scope->isPlatform(), fn ($q) => $q->leftJoin('platform_showcase_agencies as a', 'a.id', '=', 'd.agency_id'))
            ->when($filters['provider'] ?? null, fn ($q, $provider) => $q->where('t.provider', $provider))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('d.occurred_at', '>=', Carbon::parse($from, 'America/Lima')->startOfDay()->utc()))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('d.occurred_at', '<=', Carbon::parse($to, 'America/Lima')->endOfDay()->utc()));
        $rows = (clone $query)->when($filters['status'] ?? null, fn ($q, $status) => $q->where('d.status', $status))->orderByDesc('d.occurred_at')->orderByDesc('d.id')->limit(500)
            ->get(['d.*', 'm.provider_event', 't.code as tag_code', 't.name as tag_name', 't.provider', $scope->isPlatform() ? 'a.name as reference' : 'o.code as reference'])
            ->map(fn (object $d) => [
                'id' => (int) $d->id,
                'event_id' => $d->event_id,
                'event' => $d->internal_event,
                'event_label' => $scope->events()[$d->internal_event]['label'] ?? $d->internal_event,
                'tag' => $d->tag_code,
                'tag_name' => $d->tag_name,
                'provider' => $d->provider,
                'provider_event' => $d->provider_event,
                'channel' => $d->channel,
                'status' => $d->status,
                'attempts' => (int) $d->attempts,
                'http_status' => $d->http_status === null ? null : (int) $d->http_status,
                'error' => $d->error,
                'value' => $d->value === null ? null : (string) $d->value,
                'currency' => $d->currency,
                'reference' => $d->reference,
                'occurred_at' => Carbon::parse($d->occurred_at)->toIso8601String(),
                'sent_at' => $d->sent_at ? Carbon::parse($d->sent_at)->toIso8601String() : null,
                'retryable' => $d->status === 'fallido' && (int) $d->attempts < 10,
            ]);
        $counts = (clone $query)->selectRaw('d.status, count(*) as n')->groupBy('d.status')->pluck('n', 'status');

        return [
            'rows' => $rows->values(),
            'kpis' => collect(TrackingCatalog::DISPATCH_STATUSES)->mapWithKeys(fn ($label, $status) => [$status => (int) ($counts[$status] ?? 0)]),
            'retention_days' => 90,
        ];
    }

    public function kpis(TagScope $scope): array
    {
        $tags = $scope->db()->table($scope->tags)->whereNull('deleted_at');
        $since = now()->subDay();
        $dispatches = $scope->db()->table($scope->dispatches)->where('occurred_at', '>=', $since)->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return [
            'active' => (clone $tags)->where('status', 'activo')->count(),
            'configured' => (clone $tags)->count(),
            'in_review' => (clone $tags)->where(fn ($q) => $q->where('status', 'en_revision')->orWhereNotNull('revision'))->count(),
            'sent_24h' => (int) ($dispatches['enviado'] ?? 0),
            'deduplicated_24h' => (int) ($dispatches['duplicado'] ?? 0),
            'failed' => $scope->db()->table($scope->dispatches)->where('status', 'fallido')->count(),
            'mapped_events' => $scope->db()->table($scope->mappings.' as m')->join($scope->tags.' as t', 't.id', '=', 'm.tag_id')->whereNull('t.deleted_at')->where('m.active', true)->count(),
        ];
    }

    public static function providers(?TrackingPlan $plan): array
    {
        return collect(TrackingCatalog::PROVIDERS)->map(fn (array $provider, string $code) => [
            'code' => $code,
            'name' => $provider['name'],
            'short' => $provider['short'],
            'id_label' => $provider['id_label'],
            'placeholder' => $provider['placeholder'],
            'consent' => $provider['consent'],
            'server' => $provider['server'],
            'min_plan' => [1 => 'Starter', 2 => 'Professional', 3 => 'Enterprise'][$provider['min_rank']],
            'allowed' => $plan === null || $plan->allows($code),
        ])->values()->all();
    }

    private function row(TagScope $scope, object $tag, Collection $users, int $mapped): array
    {
        $rules = (array) json_decode((string) $tag->page_rules, true);
        $config = (array) json_decode((string) $tag->config, true);
        $revision = $tag->revision ? (array) json_decode((string) $tag->revision, true) : null;
        $provider = TrackingCatalog::provider($tag->provider);

        return [
            'code' => $tag->code,
            'name' => $tag->name,
            'provider' => $tag->provider,
            'provider_name' => $provider['name'],
            'provider_short' => $provider['short'],
            'site' => $tag->site ?? null,
            'measurement_id' => $tag->measurement_id,
            'consent_category' => $tag->consent_category,
            'placement' => $tag->placement,
            'pages' => implode(', ', (array) ($rules['include'] ?? ['/*'])),
            'exclude' => implode(', ', (array) ($rules['exclude'] ?? [])),
            'server_side' => (bool) ($config['server_side'] ?? false),
            'server_label' => $provider['server'],
            'enhanced_conversions' => (bool) ($config['enhanced_conversions'] ?? false),
            'secret_saved' => $tag->secret_ref !== null,
            'script_src' => $tag->script_src,
            'sri_hash' => $tag->sri_hash,
            'script_body' => $tag->script_body,
            'csp_domains' => TagInput::currentDomains($tag),
            'status' => $tag->status,
            'starts_at' => $tag->starts_at ? Carbon::parse($tag->starts_at)->toIso8601String() : null,
            'ends_at' => $tag->ends_at ? Carbon::parse($tag->ends_at)->toIso8601String() : null,
            'created_by' => $tag->created_by,
            'created_by_name' => $users[$tag->created_by] ?? null,
            'approved_by_name' => $users[$tag->approved_by] ?? null,
            'approved_at' => $tag->approved_at ? Carbon::parse($tag->approved_at)->toIso8601String() : null,
            'submitted_at' => $tag->submitted_at ? Carbon::parse($tag->submitted_at)->toIso8601String() : null,
            'reject_reason' => $tag->reject_reason,
            'verified_at' => $tag->verified_at ? Carbon::parse($tag->verified_at)->toIso8601String() : null,
            'verify_result' => $tag->verify_result,
            'verify_note' => $tag->verify_note,
            'pending_revision' => $revision === null ? null : [
                'fields' => array_keys(array_diff_key($revision, ['author' => true, 'at' => true])),
                'author' => $revision['author'] ?? null,
                'author_name' => $users[$revision['author'] ?? ''] ?? null,
                'at' => $revision['at'] ?? null,
                'script_src' => $revision['script_src'] ?? null,
                'measurement_id' => $revision['measurement_id'] ?? null,
            ],
            'mapped_events' => $mapped,
            'lock_version' => (int) $tag->lock_version,
            'updated_at' => Carbon::parse($tag->updated_at)->toIso8601String(),
        ];
    }

    private function users(TagScope $scope): Collection
    {
        return $scope->isPlatform()
            ? DB::connection('pgsql_platform')->table('platform_users')->pluck('name', 'id')
            : DB::table('iam_users')->pluck('name', 'id');
    }
}
