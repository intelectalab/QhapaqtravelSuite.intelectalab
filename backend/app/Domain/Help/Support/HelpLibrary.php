<?php

declare(strict_types=1);

namespace App\Domain\Help\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\AccessMap;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class HelpLibrary
{
    public const MANAGE = 'admin.settings.manage';

    private const RELATED = 4;

    public function __construct(private readonly AccessMap $access) {}

    public function canManage(User $user): bool
    {
        return $user->getAllPermissions()->contains('name', self::MANAGE);
    }

    public function index(User $user, array $filters): array
    {
        $manage = $this->canManage($user);
        $status = $manage ? (string) ($filters['status'] ?? 'published') : 'published';
        $visible = $this->visible($user, $manage && $status !== 'published');
        $query = trim((string) ($filters['q'] ?? ''));
        $module = (string) ($filters['module'] ?? '');

        $scoped = $visible->filter(fn (array $item): bool => $status === 'all' || $item['row']->status === $status);
        $found = $scoped
            ->filter(fn (array $item): bool => $module === '' || $item['row']->module === $module)
            ->filter(fn (array $item): bool => HelpArticleShape::matches($item['row'], $query))
            ->sortBy(fn (array $item): array => $query === '' ? [0, (int) $item['row']->sort_order] : [-HelpArticleShape::rank($item['row'], $query), (int) $item['row']->sort_order])
            ->values();

        return [
            'articles' => $found->map(fn (array $item): array => HelpArticleShape::summary($item['row'], $item['origin']))->all(),
            'modules' => $this->modules($scoped),
            'counts' => [
                'total' => $visible->where('row.status', 'published')->count(),
                'archived' => $manage ? $visible->where('row.status', 'archived')->count() : 0,
                'adapted' => $visible->where('row.status', 'published')->where('origin', 'adaptado')->count(),
                'own' => $visible->where('row.status', 'published')->where('origin', 'propio')->count(),
            ],
            'can_manage' => $manage,
            'filters' => ['q' => $query, 'module' => $module, 'status' => $status],
            'options' => $manage ? $this->options() : null,
        ];
    }

    public function show(User $user, string $slug): array
    {
        $manage = $this->canManage($user);
        $item = $this->visible($user, $manage)->first(fn (array $candidate): bool => $candidate['row']->slug === $slug) ?? throw ApiException::notFound('El artículo de ayuda no existe o no aplica a tu rol.');

        return [
            ...HelpArticleShape::full($item['row'], $item['origin']),
            'related' => $this->related($user, $item['row']),
            'has_original' => $item['global'] !== null,
            'can_manage' => $manage,
            'history' => $manage ? $this->history($slug) : [],
            'options' => $manage ? $this->options() : null,
        ];
    }

    public function screen(User $user, string $path): array
    {
        $path = '/'.trim((string) parse_url($path, PHP_URL_PATH), '/');
        $candidates = $this->visible($user, false)
            ->filter(fn (array $item): bool => HelpArticleShape::covers($item['row']->screen, $path))
            ->sortBy(fn (array $item): array => [-strlen($item['row']->screen), (int) $item['row']->sort_order])
            ->values();
        $main = $candidates->first();

        return [
            'path' => $path,
            'article' => $main === null ? null : HelpArticleShape::full($main['row'], $main['origin']),
            'more' => $candidates->skip(1)->take(self::RELATED)->map(fn (array $item): array => HelpArticleShape::summary($item['row'], $item['origin']))->values()->all(),
            'related' => $main === null ? $this->starters($user) : $this->related($user, $main['row']),
            'can_manage' => $this->canManage($user),
        ];
    }

    public function versions(string $slug): array
    {
        $rows = DB::table('help_articles')->where('audience', 'agency')->where('slug', $slug)->get(HelpArticleShape::COLUMNS);

        return [
            'own' => $rows->first(fn (object $row): bool => $row->tenant_id !== null),
            'global' => $rows->first(fn (object $row): bool => $row->tenant_id === null),
        ];
    }

    private function visible(User $user, bool $withArchived): Collection
    {
        $map = $this->access->for($user);
        $roles = $user->getRoleNames()->all();
        $manage = $this->canManage($user);

        return $this->effective()
            ->filter(fn (array $item): bool => $withArchived || $item['row']->status === 'published')
            ->filter(fn (array $item): bool => $manage || $this->forRoles($item['row'], $roles))
            ->filter(fn (array $item): bool => $this->reachable($item['row']->screen, $map))
            ->values();
    }

    private function effective(): Collection
    {
        return DB::table('help_articles')->where('audience', 'agency')->get(HelpArticleShape::COLUMNS)
            ->groupBy('slug')
            ->map(function (Collection $rows): array {
                $own = $rows->first(fn (object $row): bool => $row->tenant_id !== null);
                $global = $rows->first(fn (object $row): bool => $row->tenant_id === null);

                return ['row' => $own ?? $global, 'global' => $global, 'origin' => $own === null ? 'kipucontrol' : ($global === null ? 'propio' : 'adaptado')];
            })
            ->reject(fn (array $item): bool => $item['origin'] === 'kipucontrol' && $item['row']->status === 'archived')
            ->sortBy(fn (array $item): array => [(int) $item['row']->sort_order, $item['row']->title])
            ->values();
    }

    private function forRoles(object $row, array $roles): bool
    {
        $targets = HelpArticleShape::decode($row->roles);

        return $targets === [] || array_intersect($targets, $roles) !== [];
    }

    private function reachable(string $screen, array $map): bool
    {
        $screens = collect($map['screens'])->all();
        $match = collect(array_keys($screens))
            ->filter(fn (string $prefix): bool => HelpArticleShape::covers($prefix, $screen))
            ->sortByDesc(fn (string $prefix): int => strlen($prefix))
            ->first();

        if ($match !== null && ! $screens[$match]) {
            return false;
        }

        return collect(array_keys(collect($map['locked'])->all()))->every(fn (string $locked): bool => ! HelpArticleShape::covers($locked, $screen));
    }

    private function modules(Collection $items): array
    {
        return $items->groupBy(fn (array $item): string => $item['row']->module)
            ->map(fn (Collection $group, string $module): array => ['module' => $module, 'count' => $group->count(), 'order' => $group->min(fn (array $item): int => (int) $item['row']->sort_order)])
            ->sortBy('order')
            ->map(fn (array $module): array => ['module' => $module['module'], 'count' => $module['count']])
            ->values()
            ->all();
    }

    private function related(User $user, object $row): array
    {
        return $this->visible($user, false)
            ->filter(fn (array $item): bool => $item['row']->module === $row->module && $item['row']->slug !== $row->slug)
            ->take(self::RELATED)
            ->map(fn (array $item): array => HelpArticleShape::summary($item['row'], $item['origin']))
            ->values()
            ->all();
    }

    private function starters(User $user): array
    {
        return $this->visible($user, false)->take(self::RELATED)->map(fn (array $item): array => HelpArticleShape::summary($item['row'], $item['origin']))->values()->all();
    }

    private function options(): array
    {
        $modules = DB::table('help_articles')->where('audience', 'agency')->selectRaw('module, min(sort_order) as position')->groupBy('module')->orderBy('position')->pluck('module')->all();
        $labels = collect(DB::table('roles')->whereIn('name', HelpArticleShape::backofficeRoles())->pluck('display_name', 'name'));

        return [
            'modules' => $modules,
            'screens' => array_keys((array) config('access.routes')),
            'roles' => collect(HelpArticleShape::backofficeRoles())->map(fn (string $role): array => ['value' => $role, 'label' => (string) ($labels[$role] ?? $role)])->all(),
        ];
    }

    private function history(string $slug): array
    {
        return DB::table('audit_events as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.actor_id')
            ->where('a.entity', HelpArticleShape::ENTITY)->where('a.entity_id', $slug)
            ->orderByDesc('a.occurred_at')->limit(8)
            ->get(['a.code', 'a.action', 'a.before_value', 'a.after_value', 'a.occurred_at', 'u.name as actor'])
            ->map(fn (object $event): array => [
                'code' => (int) $event->code,
                'action' => $event->action,
                'before' => $event->before_value,
                'after' => $event->after_value,
                'actor' => $event->actor,
                'at' => Carbon::parse($event->occurred_at)->toIso8601String(),
            ])
            ->all();
    }
}
