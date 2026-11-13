<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductSubresources
{
    public const RELATIONS = ['Complementario', 'Alternativo', 'Upgrade', 'Cross-sell', 'Upsell'];

    public const KIND_LABELS = ['include' => 'Incluye', 'exclude' => 'No incluye'];

    private const LIMITS = ['catalog_product_inclusions' => 40, 'catalog_product_requirements' => 40, 'catalog_product_faqs' => 30, 'catalog_product_media' => 20, 'catalog_product_config_groups' => 20];

    public function __construct(private readonly ProductSections $sections, private readonly AuditLogger $audit) {}

    public function addRequirement(string $code, ?int $version, User $actor, array $data): string
    {
        return $this->within($code, $version, $actor, function (object $product) use ($actor, $data): string {
            $this->ensureRoom($product, 'catalog_product_requirements', 'CAT-BR-35', 'Un producto admite hasta 40 requisitos.');
            $text = trim($data['text']);
            $id = $this->insert('catalog_product_requirements', $product, ['category' => $data['category'] ?? null, 'text' => $text], $actor);
            $this->note($product, "Agregó el requisito «{$text}»");

            return $id;
        });
    }

    public function removeRequirement(string $code, ?int $version, User $actor, string $id): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($id): void {
            $row = $this->owned('catalog_product_requirements', $product, $id, 'El requisito no existe.');
            DB::table('catalog_product_requirements')->where('id', $row->id)->delete();
            $this->note($product, "Quitó el requisito «{$row->text}»");
        });
    }

    public function addInclusion(string $code, ?int $version, User $actor, array $data): string
    {
        return $this->within($code, $version, $actor, function (object $product) use ($actor, $data): string {
            $this->ensureRoom($product, 'catalog_product_inclusions', 'CAT-BR-33', 'Cada lista admite hasta 40 líneas.', ['kind' => $data['kind']]);
            $text = trim($data['text']);
            $title = self::KIND_LABELS[$data['kind']];

            if (DB::table('catalog_product_inclusions')->where('product_id', $product->id)->where('kind', $data['kind'])->whereRaw('lower(text) = ?', [mb_strtolower($text)])->exists()) {
                throw ApiException::unprocessable('CAT-BR-33', "Esa línea ya está en «{$title}».");
            }

            $id = $this->insert('catalog_product_inclusions', $product, ['kind' => $data['kind'], 'text' => $text, 'sort_order' => $this->nextOrder('catalog_product_inclusions', $product, ['kind' => $data['kind']])], $actor);
            $this->note($product, "Agregó «{$text}» a «{$title}»");

            return $id;
        });
    }

    public function removeInclusion(string $code, ?int $version, User $actor, string $id): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($id): void {
            $row = $this->owned('catalog_product_inclusions', $product, $id, 'La línea no existe.');
            DB::table('catalog_product_inclusions')->where('id', $row->id)->delete();
            $this->note($product, "Quitó «{$row->text}» de «".self::KIND_LABELS[$row->kind].'»');
        });
    }

    public function addFaq(string $code, ?int $version, User $actor, array $data): string
    {
        return $this->within($code, $version, $actor, function (object $product) use ($actor, $data): string {
            $this->ensureRoom($product, 'catalog_product_faqs', 'CAT-BR-33', 'Un producto admite hasta 30 preguntas frecuentes.');
            $question = trim($data['question']);

            if (DB::table('catalog_product_faqs')->where('product_id', $product->id)->whereRaw('lower(question) = ?', [mb_strtolower($question)])->exists()) {
                throw ApiException::unprocessable('CAT-BR-33', 'Esa pregunta ya está en el producto.');
            }

            $id = $this->insert('catalog_product_faqs', $product, ['question' => $question, 'answer' => trim($data['answer']), 'sort_order' => $this->nextOrder('catalog_product_faqs', $product)], $actor);
            $this->note($product, "Agregó la pregunta «{$question}»");

            return $id;
        });
    }

    public function removeFaq(string $code, ?int $version, User $actor, string $id): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($id): void {
            $row = $this->owned('catalog_product_faqs', $product, $id, 'La pregunta no existe.');
            DB::table('catalog_product_faqs')->where('id', $row->id)->delete();
            $this->note($product, "Quitó la pregunta «{$row->question}»");
        });
    }

    public function addMedia(string $code, ?int $version, User $actor, array $data): string
    {
        return $this->within($code, $version, $actor, function (object $product) use ($actor, $data): string {
            $this->ensureRoom($product, 'catalog_product_media', 'CAT-BR-29', 'Un producto admite hasta 20 imágenes.');
            $url = trim($data['url']);
            $alt = trim($data['alt_text']);

            if (DB::table('catalog_product_media')->where('product_id', $product->id)->where('storage_path', $url)->exists()) {
                throw ApiException::unprocessable('CAT-BR-29', 'Esa imagen ya está en la galería.');
            }

            $main = (bool) ($data['is_main'] ?? false) || ! DB::table('catalog_product_media')->where('product_id', $product->id)->where('is_main', true)->exists();
            if ($main) {
                DB::table('catalog_product_media')->where('product_id', $product->id)->update(['is_main' => false]);
            }

            $id = $this->insert('catalog_product_media', $product, ['kind' => 'image', 'storage_path' => $url, 'alt_text' => $alt, 'is_main' => $main, 'sort_order' => $this->nextOrder('catalog_product_media', $product)], $actor);
            $this->note($product, "Agregó la imagen «{$alt}»");
            if ($main) {
                $this->note($product, "Cambió la portada a «{$alt}»");
            }

            return $id;
        });
    }

    public function updateMedia(string $code, ?int $version, User $actor, string $id, array $data): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($actor, $id, $data): void {
            $row = $this->owned('catalog_product_media', $product, $id, 'La imagen no existe.');
            $values = ['updated_by' => $actor->getKey(), 'updated_at' => now()];

            if (array_key_exists('alt_text', $data)) {
                $values['alt_text'] = trim((string) $data['alt_text']);
            }
            if (array_key_exists('sort_order', $data)) {
                $values['sort_order'] = (int) $data['sort_order'];
            }
            $alt = $values['alt_text'] ?? $row->alt_text;

            if (array_key_exists('is_main', $data) && (bool) $data['is_main'] !== (bool) $row->is_main) {
                if (! $data['is_main']) {
                    throw ApiException::unprocessable('CAT-BR-29', 'La galería necesita una portada. Marca otra imagen como portada.');
                }
                DB::table('catalog_product_media')->where('product_id', $product->id)->update(['is_main' => false]);
                $values['is_main'] = true;
                $this->note($product, "Cambió la portada a «{$alt}»");
            }

            DB::table('catalog_product_media')->where('id', $row->id)->update($values);
            if (isset($values['alt_text']) && $values['alt_text'] !== $row->alt_text) {
                $this->note($product, "Cambió la descripción de la imagen a «{$values['alt_text']}»", $row->alt_text);
            }
            if (isset($values['sort_order']) && $values['sort_order'] !== (int) $row->sort_order) {
                $this->note($product, "Movió la imagen «{$alt}» a la posición {$values['sort_order']}");
            }
        });
    }

    public function removeMedia(string $code, ?int $version, User $actor, string $id): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($id): void {
            $row = $this->owned('catalog_product_media', $product, $id, 'La imagen no existe.');

            if ($row->is_main && DB::table('catalog_product_media')->where('product_id', $product->id)->where('id', '<>', $row->id)->exists()) {
                throw ApiException::unprocessable('CAT-BR-29', 'La portada no se quita. Marca otra imagen como portada antes de quitarla.');
            }

            DB::table('catalog_destination_contents')->where('hero_media_id', $row->id)->update(['hero_media_id' => null]);
            DB::table('catalog_product_media')->where('id', $row->id)->delete();
            $this->note($product, "Quitó la imagen «{$row->alt_text}»");
        });
    }

    public function relate(string $code, ?int $version, User $actor, array $data): string
    {
        return $this->within($code, $version, $actor, function (object $product) use ($actor, $data): string {
            $reference = (string) $data['related_product_id'];
            $related = DB::table('catalog_products')->whereNull('deleted_at')->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->first(['id', 'code', 'name', 'status'])
                ?? throw ApiException::unprocessable('CAT-BR-34', 'El producto relacionado no existe.');

            if ($related->id === $product->id) {
                throw ApiException::unprocessable('CAT-BR-34', 'Un producto no se relaciona consigo mismo.');
            }
            if ($related->status === 'ARCHIVED') {
                throw ApiException::unprocessable('CAT-BR-34', "{$related->code}: un producto archivado no se relaciona.");
            }
            if (DB::table('catalog_product_related')->where('product_id', $product->id)->where('related_product_id', $related->id)->exists()) {
                throw ApiException::conflict('CAT-BR-34', "{$related->code} ya está relacionado con este producto.");
            }

            $id = $this->insert('catalog_product_related', $product, ['related_product_id' => $related->id, 'relation' => $data['relation']], $actor);
            $this->audit->log('Producto', $product->code, 'relacionar', null, "{$related->code} {$related->name} · {$data['relation']}");

            return $id;
        });
    }

    public function unrelate(string $code, ?int $version, User $actor, string $id): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($id): void {
            $row = DB::table('catalog_product_related as r')->join('catalog_products as p', 'p.id', '=', 'r.related_product_id')->where('r.product_id', $product->id)
                ->where(Str::isUuid($id) ? 'r.id' : 'p.code', $id)->first(['r.id', 'r.relation', 'p.code', 'p.name']) ?? throw ApiException::notFound('La relación no existe.');
            DB::table('catalog_product_related')->where('id', $row->id)->delete();
            $this->audit->log('Producto', $product->code, 'desrelacionar', "{$row->code} {$row->name} · {$row->relation}", null);
        });
    }

    public function addConfigGroup(string $code, ?int $version, User $actor, array $data): string
    {
        return $this->within($code, $version, $actor, function (object $product) use ($actor, $data): string {
            $this->ensureRoom($product, 'catalog_product_config_groups', 'CAT-BR-30', 'Un producto admite hasta 20 grupos de personalización.');
            $name = trim($data['name']);

            if (DB::table('catalog_product_config_groups')->where('product_id', $product->id)->whereRaw('lower(name) = ?', [mb_strtolower($name)])->exists()) {
                throw ApiException::unprocessable('CAT-BR-30', "Ya existe el grupo «{$name}».");
            }

            $labels = array_map(fn (array $option) => mb_strtolower(trim($option['label'])), $data['options']);
            if (count(array_unique($labels)) !== count($labels)) {
                throw ApiException::unprocessable('CAT-BR-30', "Hay opciones repetidas en «{$name}».");
            }

            $id = $this->insert('catalog_product_config_groups', $product, ['name' => $name, 'sort_order' => $this->nextOrder('catalog_product_config_groups', $product)], $actor);
            DB::table('catalog_product_config_options')->insert(array_map(fn (array $option, int $index) => [
                'id' => (string) Str::uuid7(), 'group_id' => $id, 'label' => trim($option['label']), 'price_delta' => number_format((float) ($option['price_delta'] ?? 0), 2, '.', ''), 'sort_order' => $index + 1, 'created_by' => $actor->getKey(),
            ], $data['options'], array_keys($data['options'])));
            $this->audit->log('Producto', $product->code, 'cambio_personalizacion', null, "Agregó el grupo «{$name}» con ".count($data['options']).' opciones');

            return $id;
        });
    }

    public function removeConfigGroup(string $code, ?int $version, User $actor, string $id): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($id): void {
            $row = $this->owned('catalog_product_config_groups', $product, $id, 'El grupo de personalización no existe.');
            DB::table('catalog_product_config_options')->where('group_id', $row->id)->delete();
            DB::table('catalog_product_config_groups')->where('id', $row->id)->delete();
            $this->audit->log('Producto', $product->code, 'cambio_personalizacion', "Grupo «{$row->name}»", "Quitó el grupo «{$row->name}»");
        });
    }

    public function markup(string $code, ?int $version, User $actor, float $markup): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($markup): void {
            $before = (float) $product->markup_pct;
            DB::table('catalog_products')->where('id', $product->id)->update(['markup_pct' => $markup]);

            if (abs($before - $markup) > 0.0001) {
                $this->audit->log('Producto', $product->code, 'cambio_markup', $this->percent($before), $this->percent($markup));
            }
        });
    }

    public function reorderComponents(string $code, ?int $version, User $actor, array $ids): void
    {
        $this->within($code, $version, $actor, function (object $product) use ($actor, $ids): void {
            $current = collect($this->sections->currentComponents($product->id))->keyBy('id');
            $ids = array_values($ids);

            if (count($ids) !== $current->count() || array_diff($ids, $current->keys()->all()) !== []) {
                throw ApiException::unprocessable('CAT-BR-10', 'Envía todos los componentes del producto, cada uno una sola vez.');
            }

            if ($ids === $current->keys()->all()) {
                return;
            }

            $this->sections->components($product, array_map(fn (string $id) => $current[$id], $ids), $actor);
            $this->note($product, 'Reordenó los componentes');
        });
    }

    private function within(string $code, ?int $version, User $actor, callable $work): mixed
    {
        $result = null;
        $this->sections->edit($code, $version, $actor, function (object $product) use ($work, &$result): void {
            $result = $work($product);
        });

        return $result;
    }

    private function owned(string $table, object $product, string $id, string $missing): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound($missing);
        }

        return DB::table($table)->where('id', $id)->where('product_id', $product->id)->first() ?? throw ApiException::notFound($missing);
    }

    private function ensureRoom(object $product, string $table, string $rule, string $message, array $where = []): void
    {
        if (DB::table($table)->where('product_id', $product->id)->where($where)->count() >= self::LIMITS[$table]) {
            throw ApiException::unprocessable($rule, $message);
        }
    }

    private function nextOrder(string $table, object $product, array $where = []): int
    {
        return (int) DB::table($table)->where('product_id', $product->id)->where($where)->max('sort_order') + 1;
    }

    private function insert(string $table, object $product, array $values, User $actor): string
    {
        $id = (string) Str::uuid7();
        DB::table($table)->insert([...$values, 'id' => $id, 'product_id' => $product->id, 'created_by' => $actor->getKey()]);

        return $id;
    }

    private function note(object $product, string $after, ?string $before = null): void
    {
        $this->audit->log('Producto', $product->code, 'modificar', $before === null ? null : mb_substr($before, 0, 500), mb_substr($after, 0, 500));
    }

    private function percent(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.').' %';
    }
}
