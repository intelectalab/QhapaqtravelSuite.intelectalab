<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Help\Support\HelpArticleShape;
use Database\Seeders\HelpArticleSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class RefreshHelpArticles extends Command
{
    protected $signature = 'help:actualizar {slugs* : Artículos de KipuControl que se reemplazan con el texto de database/seeders/Help}';

    protected $description = 'Reemplaza artículos de ayuda de KipuControl ya sembrados con su versión actual de los seeders, sin tocar las versiones de las agencias';

    public function handle(): int
    {
        $articles = collect(HelpArticleSeeder::articles())->keyBy('slug');
        $missing = collect($this->argument('slugs'))->reject(fn (string $slug): bool => $articles->has($slug));

        if ($missing->isNotEmpty()) {
            $this->error('No existen en los seeders: '.$missing->implode(', '));

            return self::FAILURE;
        }

        $db = DB::connection('pgsql_platform');

        foreach ($this->argument('slugs') as $slug) {
            $article = $articles->get($slug);
            $current = $db->table('help_articles')->whereNull('tenant_id')->where('slug', $slug)->first(['id', 'sort_order']);

            if ($current === null) {
                $this->line("{$slug}: no está sembrado; corre HelpArticleSeeder");

                continue;
            }

            $db->table('help_articles')->where('id', $current->id)->update([
                ...HelpArticleShape::values([...$article, 'sort_order' => $current->sort_order, 'roles' => $article['roles'] ?? [], 'keywords' => $article['keywords'] ?? []]),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_at' => now(),
            ]);
            $this->line("{$slug}: actualizado");
        }

        return self::SUCCESS;
    }
}
