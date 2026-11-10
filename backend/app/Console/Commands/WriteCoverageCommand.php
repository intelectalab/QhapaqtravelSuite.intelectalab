<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

final class WriteCoverageCommand extends Command
{
    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    private const NESTED = ['platform', 'portal', 'public', 'b2b', 'supplier'];

    protected $signature = 'qa:write-coverage {--module= : Muestra solo un módulo (por ejemplo crm o platform/coupons)} {--missing : Lista cada operación sin prueba}';

    protected $description = 'Mide qué operaciones de escritura de la API tienen al menos una prueba que las llame';

    public function handle(): int
    {
        $calls = $this->testedCalls();
        $rows = $this->writeRoutes()->map(function (array $route) use ($calls): array {
            $pattern = '#^'.preg_replace('#\\\\\{[^}]+\\\\\}#', '[^/]+', preg_quote($route['uri'], '#')).'$#';
            $route['covered'] = collect($route['methods'])->contains(fn (string $method): bool => collect($calls[$method] ?? [])->contains(fn (string $url): bool => preg_match($pattern, $url) === 1));

            return $route;
        });

        if ($module = $this->option('module')) {
            $rows = $rows->where('module', $module)->values();
        }

        $covered = $rows->where('covered', true)->count();
        $total = $rows->count();
        $this->line(sprintf('Escrituras con prueba: %d de %d (%d %%)', $covered, $total, $total > 0 ? (int) round($covered * 100 / $total) : 100));

        $this->table(['Módulo', 'Con prueba', 'Total'], $rows->groupBy('module')
            ->map(fn (Collection $group, string $module): array => [$module, $group->where('covered', true)->count(), $group->count()])
            ->sortBy(fn (array $row): float => $row[2] > 0 ? $row[1] / $row[2] : 1)
            ->values()->all());

        if ($this->option('missing')) {
            $rows->where('covered', false)->each(fn (array $route) => $this->line("  {$route['methods'][0]} {$route['uri']}"));
        }

        return self::SUCCESS;
    }

    private function writeRoutes(): Collection
    {
        return collect(Route::getRoutes()->getRoutes())
            ->filter(fn (LaravelRoute $route): bool => str_starts_with($route->uri(), 'api/v1/'))
            ->map(function (LaravelRoute $route): ?array {
                $methods = array_values(array_intersect($route->methods(), self::WRITE_METHODS));
                if ($methods === []) {
                    return null;
                }
                $parts = explode('/', $route->uri());
                $module = $parts[2] ?? $route->uri();
                if (in_array($module, self::NESTED, true) && isset($parts[3])) {
                    $module .= '/'.$parts[3];
                }

                return ['uri' => '/'.$route->uri(), 'methods' => $methods, 'module' => $module];
            })
            ->filter()
            ->values();
    }

    private function testedCalls(): array
    {
        $calls = [];
        foreach (File::allFiles(base_path('tests')) as $file) {
            $source = $file->getContents();
            preg_match_all('/(postJson|putJson|patchJson|deleteJson|post|put|patch|delete)\(\s*["\'](\/api\/v1\/[^"\'?]+)/', $source, $matches, PREG_SET_ORDER);
            foreach ($matches as [, $method, $url]) {
                $calls[strtoupper(str_replace('Json', '', $method))][] = preg_replace('/\{\$[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*(->[A-Za-z_][A-Za-z0-9_]*)*/', 'x', $url);
            }
        }

        return $calls;
    }
}
