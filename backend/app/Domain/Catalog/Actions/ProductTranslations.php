<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Support\SiteLocale;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductTranslations
{
    public const TRANSLATABLE = ['en'];

    public function __construct(private readonly AuditLogger $audit) {}

    public function show(string $code): array
    {
        $product = $this->product($code);
        $rows = DB::table('catalog_product_translations')->where('product_id', $product->id)->get()->keyBy('locale');

        return [
            'code' => $product->code,
            'base' => [
                'locale' => SiteLocale::BASE,
                'name' => $product->name,
                'short' => $product->short_description,
                'long' => $product->long_description,
                'inclusions' => DB::table('catalog_product_inclusions')->where('product_id', $product->id)->where('kind', 'include')->orderBy('sort_order')->pluck('text')->all(),
                'exclusions' => DB::table('catalog_product_inclusions')->where('product_id', $product->id)->where('kind', 'exclude')->orderBy('sort_order')->pluck('text')->all(),
                'seo_title' => $product->seo_title,
                'seo_description' => $product->seo_description,
            ],
            'translations' => collect(self::TRANSLATABLE)->map(function (string $locale) use ($rows): array {
                $row = $rows->get($locale);

                return [
                    'locale' => $locale,
                    'exists' => $row !== null,
                    'name' => $row->name ?? null,
                    'short' => $row->short ?? null,
                    'long' => $row->long ?? null,
                    'inclusions' => $row ? (json_decode((string) $row->inclusions, true) ?: []) : [],
                    'exclusions' => $row ? (json_decode((string) $row->exclusions, true) ?: []) : [],
                    'seo_title' => $row->seo_title ?? null,
                    'seo_description' => $row->seo_description ?? null,
                    'slug' => $row->slug ?? null,
                    'updated_at' => $row->updated_at ?? null,
                ];
            })->all(),
        ];
    }

    public function save(string $code, string $locale, array $data, User $actor): array
    {
        $this->assertLocale($locale);

        return DB::transaction(function () use ($code, $locale, $data, $actor): array {
            $product = $this->product($code, true);
            $slug = $this->slug($data['slug'] ?? $data['name'], $locale, (string) $product->id);
            $values = [
                'name' => trim((string) $data['name']),
                'short' => $this->text($data['short'] ?? null),
                'long' => $this->text($data['long'] ?? null),
                'inclusions' => json_encode($this->lines($data['inclusions'] ?? []), JSON_UNESCAPED_UNICODE),
                'exclusions' => json_encode($this->lines($data['exclusions'] ?? []), JSON_UNESCAPED_UNICODE),
                'seo_title' => $this->text($data['seo_title'] ?? null),
                'seo_description' => $this->text($data['seo_description'] ?? null),
                'slug' => $slug,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ];
            $exists = DB::table('catalog_product_translations')->where('product_id', $product->id)->where('locale', $locale)->exists();

            if ($exists) {
                DB::table('catalog_product_translations')->where('product_id', $product->id)->where('locale', $locale)->update($values);
            } else {
                DB::table('catalog_product_translations')->insert([...$values, 'product_id' => $product->id, 'locale' => $locale, 'created_by' => $actor->getKey()]);
            }

            $this->audit->log('Producto', $product->code, $exists ? 'editar_traduccion' : 'crear_traduccion', null, mb_strtoupper($locale).' · '.$values['name'], actor: $actor);

            return $this->show($product->code);
        });
    }

    public function delete(string $code, string $locale, User $actor): void
    {
        $this->assertLocale($locale);
        $product = $this->product($code);
        $deleted = DB::table('catalog_product_translations')->where('product_id', $product->id)->where('locale', $locale)->delete();

        if ($deleted === 0) {
            throw ApiException::notFound('El producto no tiene traducción en ese idioma.');
        }

        $this->audit->log('Producto', $product->code, 'quitar_traduccion', mb_strtoupper($locale), null, actor: $actor);
    }

    private function product(string $code, bool $lock = false): object
    {
        $query = DB::table('catalog_products')->whereNull('deleted_at')->where('code', $code);

        return ($lock ? $query->lockForUpdate() : $query)->first(['id', 'code', 'name', 'short_description', 'long_description', 'seo_title', 'seo_description'])
            ?? throw ApiException::notFound('El producto no existe.');
    }

    private function assertLocale(string $locale): void
    {
        if (! in_array($locale, self::TRANSLATABLE, true)) {
            throw ApiException::unprocessable('LOCALE_INVALID', 'Por ahora el sitio se traduce al inglés (en).');
        }
    }

    private function slug(string $source, string $locale, string $productId): string
    {
        $base = Str::slug($source) ?: 'producto';
        $slug = $base;
        $n = 2;

        while (DB::table('catalog_product_translations')->where('locale', $locale)->where('slug', $slug)->where('product_id', '<>', $productId)->exists()) {
            $slug = "{$base}-{$n}";
            $n++;
        }

        return mb_substr($slug, 0, 160);
    }

    private function lines(mixed $value): array
    {
        $items = is_array($value) ? $value : preg_split('/\R/', (string) $value);

        return array_values(array_filter(array_map(fn ($line): string => mb_substr(trim((string) $line), 0, 300), $items ?: []), fn (string $line): bool => $line !== ''));
    }

    private function text(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
