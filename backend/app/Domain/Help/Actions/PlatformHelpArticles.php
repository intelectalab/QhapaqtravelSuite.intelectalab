<?php

declare(strict_types=1);

namespace App\Domain\Help\Actions;

use App\Domain\Help\Support\HelpArticleShape;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PlatformHelpArticles
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(private readonly PlatformSession $session) {}

    public function index(array $filters): array
    {
        $rows = $this->globals();
        $adaptations = $this->adaptations();
        $audience = (string) ($filters['audience'] ?? 'agency');
        $status = (string) ($filters['status'] ?? 'published');
        $module = (string) ($filters['module'] ?? '');
        $query = trim((string) ($filters['q'] ?? ''));
        $scoped = $rows->filter(fn (object $row): bool => ($audience === 'all' || $row->audience === $audience) && ($status === 'all' || $row->status === $status));

        return [
            'articles' => $scoped
                ->filter(fn (object $row): bool => ($module === '' || $row->module === $module) && HelpArticleShape::matches($row, $query))
                ->sortBy(fn (object $row): array => $query === '' ? [$row->audience === 'agency' ? 0 : 1, (int) $row->sort_order] : [-HelpArticleShape::rank($row, $query), (int) $row->sort_order])
                ->map(fn (object $row): array => [...HelpArticleShape::summary($row, 'qhapaq'), 'adaptations' => (int) ($adaptations[$row->slug] ?? 0)])
                ->values()->all(),
            'modules' => $scoped->groupBy('module')->map(fn (Collection $group, string $name): array => ['module' => $name, 'count' => $group->count(), 'order' => (int) $group->min('sort_order')])->sortBy('order')->map(fn (array $m): array => ['module' => $m['module'], 'count' => $m['count']])->values()->all(),
            'counts' => [
                'agency' => $rows->where('audience', 'agency')->where('status', 'published')->count(),
                'platform' => $rows->where('audience', 'platform')->where('status', 'published')->count(),
                'archived' => $rows->where('status', 'archived')->count(),
                'adapted' => $rows->filter(fn (object $row): bool => isset($adaptations[$row->slug]))->count(),
            ],
            'filters' => ['q' => $query, 'module' => $module, 'status' => $status, 'audience' => $audience],
            'options' => $this->options(),
        ];
    }

    public function show(string $slug): array
    {
        $row = $this->find($slug);

        return [
            ...HelpArticleShape::full($row, 'qhapaq'),
            'adaptations' => (int) ($this->adaptations()[$slug] ?? 0),
            'related' => $this->globals()->filter(fn (object $other): bool => $other->audience === $row->audience && $other->module === $row->module && $other->slug !== $slug && $other->status === 'published')->take(4)->map(fn (object $other): array => HelpArticleShape::summary($other, 'qhapaq'))->values()->all(),
            'history' => $this->history($slug),
            'can_manage' => true,
            'has_original' => false,
            'options' => $this->options(),
        ];
    }

    public function screen(string $path): array
    {
        $path = '/'.trim((string) parse_url($path, PHP_URL_PATH), '/');
        $live = $this->globals()->where('audience', 'platform')->where('status', 'published');
        $candidates = $live->filter(fn (object $row): bool => HelpArticleShape::covers($row->screen, $path))->sortBy(fn (object $row): array => [-strlen($row->screen), (int) $row->sort_order])->values();
        $main = $candidates->first();
        $related = $main === null ? $live->take(4) : $live->filter(fn (object $row): bool => $row->module === $main->module && $row->slug !== $main->slug)->take(4);

        return [
            'path' => $path,
            'article' => $main === null ? null : HelpArticleShape::full($main, 'qhapaq'),
            'more' => $candidates->skip(1)->take(4)->map(fn (object $row): array => HelpArticleShape::summary($row, 'qhapaq'))->values()->all(),
            'related' => $related->map(fn (object $row): array => HelpArticleShape::summary($row, 'qhapaq'))->values()->all(),
            'can_manage' => true,
        ];
    }

    public function create(array $data, PlatformUser $actor): string
    {
        return $this->db()->transaction(function () use ($data, $actor): string {
            $slug = ManageHelpArticles::freeSlug($data['title'], fn (string $candidate): bool => $this->db()->table('help_articles')->where('slug', $candidate)->exists());
            $values = HelpArticleShape::values($data);
            $values['sort_order'] ??= (int) $this->db()->table('help_articles')->whereNull('tenant_id')->where('audience', $data['audience'])->max('sort_order') + 10;

            if ($data['audience'] === 'platform') {
                $values['roles'] = '[]';
            }

            $this->db()->table('help_articles')->insert([
                'tenant_id' => null,
                'slug' => $slug,
                'audience' => $data['audience'],
                'steps' => '[]',
                'faqs' => '[]',
                'keywords' => '[]',
                'roles' => '[]',
                ...$values,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->log($slug, 'crear', null, $values['title'], $actor);

            return $slug;
        });
    }

    public function update(string $slug, array $data, int $expected, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($slug, $data, $expected, $actor): void {
            $row = $this->find($slug, true);
            IfMatch::assertMatches($expected, (int) $row->lock_version, 'El artículo');
            $values = HelpArticleShape::values($data);

            if ($row->audience === 'platform') {
                $values['roles'] = '[]';
            }

            if (! HelpArticleShape::changed($row, $values)) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->db()->table('help_articles')->where('id', $row->id)->update([...$values, 'updated_by' => $actor->getKey()]);
            $this->log($slug, 'editar', $row->title, $values['title'] ?? $row->title, $actor);
        });
    }

    public function status(string $slug, string $status, int $expected, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($slug, $status, $expected, $actor): void {
            $row = $this->find($slug, true);
            IfMatch::assertMatches($expected, (int) $row->lock_version, 'El artículo');

            if ($row->status === $status) {
                throw ApiException::conflict($status === 'archived' ? 'HLP-BR-02' : 'HLP-BR-03', $status === 'archived' ? 'El artículo ya está archivado.' : 'El artículo no está archivado.');
            }

            $this->db()->table('help_articles')->where('id', $row->id)->update(['status' => $status, 'updated_by' => $actor->getKey()]);
            $this->log($slug, $status === 'archived' ? 'archivar' : 'reactivar', $status === 'archived' ? 'Publicado' : 'Archivado', $status === 'archived' ? 'Archivado' : 'Publicado', $actor);
        });
    }

    private function find(string $slug, bool $lock = false): object
    {
        $query = $this->db()->table('help_articles')->whereNull('tenant_id')->where('slug', $slug);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first(HelpArticleShape::COLUMNS) ?? throw ApiException::notFound('El artículo de ayuda no existe.');
    }

    private function globals(): Collection
    {
        return $this->db()->table('help_articles')->whereNull('tenant_id')->orderBy('sort_order')->orderBy('title')->get(HelpArticleShape::COLUMNS);
    }

    private function adaptations(): array
    {
        return $this->db()->table('help_articles')->whereNotNull('tenant_id')->selectRaw('slug, count(*) as total')->groupBy('slug')->pluck('total', 'slug')->all();
    }

    private function options(): array
    {
        $modules = $this->db()->table('help_articles')->whereNull('tenant_id')->selectRaw('audience, module, min(sort_order) as position')->groupBy('audience', 'module')->orderBy('position')->get();
        $labels = $this->db()->table('roles')->whereNull('tenant_id')->whereIn('name', HelpArticleShape::backofficeRoles())->pluck('display_name', 'name');

        return [
            'audiences' => collect(HelpArticleShape::AUDIENCES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'modules' => $modules->where('audience', 'agency')->pluck('module')->values()->all(),
            'platform_modules' => $modules->where('audience', 'platform')->pluck('module')->values()->all(),
            'screens' => array_keys((array) config('access.routes')),
            'roles' => collect(HelpArticleShape::backofficeRoles())->map(fn (string $role): array => ['value' => $role, 'label' => (string) ($labels[$role] ?? $role)])->all(),
        ];
    }

    private function log(string $slug, string $action, ?string $before, ?string $after, PlatformUser $actor): void
    {
        $this->session->log(HelpArticleShape::ENTITY, $slug, $action, $before, $after, $actor);
    }

    private function history(string $slug): array
    {
        return $this->db()->table('audit_events as a')->leftJoin('platform_users as u', 'u.id', '=', 'a.actor_id')->whereNull('a.tenant_id')
            ->where('a.entity', HelpArticleShape::ENTITY)->where('a.entity_id', $slug)
            ->orderByDesc('a.occurred_at')->limit(8)
            ->get(['a.code', 'a.action', 'a.before_value', 'a.after_value', 'a.occurred_at', 'u.name as actor'])
            ->map(fn (object $event): array => ['code' => (int) $event->code, 'action' => $event->action, 'before' => $event->before_value, 'after' => $event->after_value, 'actor' => $event->actor, 'at' => Carbon::parse($event->occurred_at)->toIso8601String()])
            ->all();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
