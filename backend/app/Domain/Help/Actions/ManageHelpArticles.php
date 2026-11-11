<?php

declare(strict_types=1);

namespace App\Domain\Help\Actions;

use App\Domain\Help\Support\HelpArticleShape;
use App\Domain\Help\Support\HelpLibrary;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageHelpArticles
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly HelpLibrary $library,
    ) {}

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $slug = self::freeSlug($data['title'], fn (string $candidate): bool => DB::table('help_articles')->where('slug', $candidate)->exists());
            $values = HelpArticleShape::values($data);
            $values['sort_order'] ??= (int) DB::table('help_articles')->where('audience', 'agency')->max('sort_order') + 10;

            DB::table('help_articles')->insert([
                'tenant_id' => $this->context->id(),
                'slug' => $slug,
                'audience' => 'agency',
                'steps' => '[]',
                'faqs' => '[]',
                'keywords' => '[]',
                'roles' => '[]',
                ...$values,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log(HelpArticleShape::ENTITY, $slug, 'crear', null, $values['title']);

            return $slug;
        });
    }

    public function update(string $slug, array $data, int $expected, User $actor): void
    {
        DB::transaction(function () use ($slug, $data, $expected, $actor): void {
            [$own, $global] = $this->lock($slug);
            $current = $own ?? $global;
            IfMatch::assertMatches($expected, (int) $current->lock_version, 'El artículo');
            $values = HelpArticleShape::values($data);

            if (! HelpArticleShape::changed($current, $values)) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            if ($own !== null) {
                DB::table('help_articles')->where('id', $own->id)->update([...$values, 'updated_by' => $actor->getKey()]);
                $this->audit->log(HelpArticleShape::ENTITY, $slug, 'editar', $own->title, $values['title'] ?? $own->title);

                return;
            }

            $this->adapt($global, [...$values, 'status' => 'published'], $actor);
            $this->audit->log(HelpArticleShape::ENTITY, $slug, 'adaptar', 'Versión de KipuControl', $values['title'] ?? $global->title);
        });
    }

    public function archive(string $slug, int $expected, User $actor): void
    {
        DB::transaction(function () use ($slug, $expected, $actor): void {
            [$own, $global] = $this->lock($slug);
            $current = $own ?? $global;
            IfMatch::assertMatches($expected, (int) $current->lock_version, 'El artículo');

            if ($current->status === 'archived') {
                throw ApiException::conflict('HLP-BR-02', 'El artículo ya está archivado.');
            }

            if ($own !== null) {
                DB::table('help_articles')->where('id', $own->id)->update(['status' => 'archived', 'updated_by' => $actor->getKey()]);
            } else {
                $this->adapt($global, ['status' => 'archived'], $actor);
            }

            $this->audit->log(HelpArticleShape::ENTITY, $slug, 'archivar', 'Publicado', 'Archivado');
        });
    }

    public function restore(string $slug, int $expected, User $actor): void
    {
        DB::transaction(function () use ($slug, $expected, $actor): void {
            [$own, $global] = $this->lock($slug);
            IfMatch::assertMatches($expected, (int) ($own ?? $global)->lock_version, 'El artículo');

            if ($own === null || $own->status !== 'archived') {
                throw ApiException::conflict('HLP-BR-03', 'El artículo no está archivado.');
            }

            DB::table('help_articles')->where('id', $own->id)->update(['status' => 'published', 'updated_by' => $actor->getKey()]);
            $this->audit->log(HelpArticleShape::ENTITY, $slug, 'reactivar', 'Archivado', 'Publicado');
        });
    }

    public function original(string $slug): void
    {
        DB::transaction(function () use ($slug): void {
            [$own, $global] = $this->lock($slug);

            if ($global === null) {
                throw ApiException::conflict('HLP-BR-04', 'Es un artículo propio de la agencia: no tiene versión de KipuControl. Si ya no sirve, archívalo.');
            }

            if ($own === null) {
                throw ApiException::conflict('HLP-BR-04', 'Este artículo ya muestra la versión de KipuControl.');
            }

            DB::table('help_articles')->where('id', $own->id)->delete();
            $this->audit->log(HelpArticleShape::ENTITY, $slug, 'restaurar_original', $own->title.($own->status === 'archived' ? ' (archivado)' : ''), 'Versión de KipuControl');
        });
    }

    public static function freeSlug(string $title, callable $taken): string
    {
        $base = Str::limit(Str::slug($title), 70, '') ?: 'articulo';
        $candidate = $base;

        for ($n = 2; $taken($candidate); $n++) {
            $candidate = "{$base}-{$n}";
        }

        return $candidate;
    }

    private function lock(string $slug): array
    {
        DB::table('help_articles')->where('audience', 'agency')->where('slug', $slug)->whereNotNull('tenant_id')->lockForUpdate()->get(['id']);
        $versions = $this->library->versions($slug);

        if ($versions['own'] === null && ($versions['global'] === null || $versions['global']->status === 'archived')) {
            throw ApiException::notFound('El artículo de ayuda no existe.');
        }

        return [$versions['own'], $versions['global']];
    }

    private function adapt(object $global, array $values, User $actor): void
    {
        DB::table('help_articles')->insert([
            ...HelpArticleShape::copy($global),
            ...$values,
            'tenant_id' => $this->context->id(),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
    }
}
