<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Help\Support\HelpArticleShape;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class HelpArticleSeeder extends Seeder
{
    private const ORDER = ['agency-general-crm', 'agency-catalogo-ventas-operaciones', 'agency-finanzas-canales', 'agency-administracion', 'platform-consola'];

    public function run(): void
    {
        $db = DB::connection('pgsql_platform');
        $existing = $db->table('help_articles')->whereNull('tenant_id')->pluck('slug')->flip();
        $positions = ['agency' => 0, 'platform' => 0];
        $seen = [];

        foreach (self::articles() as $article) {
            $audience = $article['audience'] ?? 'agency';
            $positions[$audience] += 10;

            if (isset($seen[$article['slug']])) {
                throw new RuntimeException("El artículo de ayuda {$article['slug']} está repetido.");
            }

            $seen[$article['slug']] = true;

            if ($existing->has($article['slug'])) {
                continue;
            }

            $db->table('help_articles')->insert([
                'tenant_id' => null,
                'slug' => $article['slug'],
                'audience' => $audience,
                'status' => 'published',
                ...HelpArticleShape::values([...$article, 'sort_order' => $positions[$audience], 'roles' => $article['roles'] ?? [], 'keywords' => $article['keywords'] ?? []]),
            ]);
        }
    }

    public static function articles(): array
    {
        $files = glob(database_path('seeders/Help/*.php')) ?: [];
        usort($files, function (string $a, string $b): int {
            $rank = fn (string $file): int => ($index = array_search(basename($file, '.php'), self::ORDER, true)) === false ? PHP_INT_MAX : $index;

            return [$rank($a), $a] <=> [$rank($b), $b];
        });

        return collect($files)->flatMap(fn (string $file): array => require $file)->values()->all();
    }
}
