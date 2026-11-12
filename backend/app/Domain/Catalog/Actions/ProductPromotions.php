<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\B2bRateDirectory;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ProductPromotions
{
    public const KINDS = ['Descuento %', 'Descuento fijo', 'Precio promocional', 'Descuento por cantidad', 'Código promocional', 'Promoción por fecha', 'Promoción por temporada', 'Promoción por canal'];

    public const PERCENT_KINDS = ['Descuento %', 'Descuento por cantidad', 'Código promocional', 'Promoción por fecha', 'Promoción por temporada', 'Promoción por canal'];

    public const CHANNELS = ['Todos', 'Directo', 'E-commerce', 'B2B', 'Corporativo'];

    public const MAX_PERCENT = 60;

    public function __construct(private readonly CodeSequence $codes, private readonly AuditLogger $audit, private readonly B2bRateDirectory $rates) {}

    public static function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'min:3', 'max:120'],
            'kind' => [$required, 'in:'.implode(',', self::KINDS)],
            'value' => [$required, 'numeric', 'gt:0', 'max:99999999'],
            'channel' => ['sometimes', 'in:'.implode(',', self::CHANNELS)],
            'promo_code' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'min_pax' => ['nullable', 'integer', 'between:1,99'],
            'valid_from' => [$required, 'date'],
            'valid_to' => [$required, 'date'],
        ];
    }

    public static function messages(): array
    {
        return [
            'name.*' => 'Escribe el nombre de la promoción (3 a 120 caracteres).',
            'kind.*' => 'Elige el tipo de promoción.',
            'value.*' => 'Indica un valor mayor que cero.',
            'channel.*' => 'Elige el canal.',
            'promo_code.*' => 'El código lleva solo letras, números, guion o guion bajo, sin espacios.',
            'min_pax.*' => 'El mínimo de pasajeros va de 1 a 99.',
            'valid_from.*' => 'Indica desde cuándo rige.',
            'valid_to.*' => 'Indica hasta cuándo rige.',
        ];
    }

    public function create(string $productCode, array $data, User $actor): string
    {
        return DB::transaction(function () use ($productCode, $data, $actor): string {
            $product = $this->product($productCode);
            $values = $this->validated($product, $data, null);
            $ref = $this->codes->next('catalog_product_promotions', 'PROMO-', 2, 'ref');
            DB::table('catalog_product_promotions')->insert([...$values, 'ref' => $ref, 'product_id' => $product->id, 'status' => 'activa', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Promoción', $ref, 'crear', null, "{$product->code} · {$values['name']} · ".self::label($values['kind'], (string) $values['value']));

            return $ref;
        });
    }

    public function update(string $productCode, string $ref, array $data, User $actor): void
    {
        DB::transaction(function () use ($productCode, $ref, $data, $actor): void {
            $product = $this->product($productCode);
            $promotion = $this->promotion($product, $ref);
            $values = $this->validated($product, [...(array) $promotion, 'valid_from' => $promotion->date_from, 'valid_to' => $promotion->date_to, ...$data], $promotion);
            DB::table('catalog_product_promotions')->where('id', $promotion->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Promoción', $ref, 'modificar', self::label($promotion->kind, (string) $promotion->value), self::label($values['kind'], (string) $values['value']));
        });
    }

    public function status(string $productCode, string $ref, string $status, User $actor): void
    {
        DB::transaction(function () use ($productCode, $ref, $status, $actor): void {
            $product = $this->product($productCode);
            $promotion = $this->promotion($product, $ref);

            if ($promotion->date_to < CatalogAccess::today()) {
                throw ApiException::unprocessable('CAT-BR-27', 'La promoción ya venció y no se activa ni se pausa. Extiende su vigencia para volver a usarla.');
            }

            DB::table('catalog_product_promotions')->where('id', $promotion->id)->update(['status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Promoción', $ref, $status === 'activa' ? 'activar' : 'pausar', $promotion->status, $status);
        });
    }

    public function statusByRef(string $ref, string $status, User $actor): void
    {
        $code = DB::table('catalog_product_promotions as p')->join('catalog_products as c', 'c.id', '=', 'p.product_id')->where('p.ref', $ref)->whereNull('p.deleted_at')->value('c.code');

        if ($code === null) {
            throw ApiException::notFound('La promoción no existe.');
        }

        $this->status((string) $code, $ref, $status, $actor);
    }

    public function delete(string $productCode, string $ref, User $actor): void
    {
        DB::transaction(function () use ($productCode, $ref, $actor): void {
            $promotion = $this->promotion($this->product($productCode), $ref);
            DB::table('catalog_product_promotions')->where('id', $promotion->id)->update(['deleted_at' => now(), 'status' => 'inactiva', 'updated_by' => $actor->getKey()]);
            $this->audit->log('Promoción', $ref, 'eliminar', $promotion->name, null);
        });
    }

    public static function label(string $kind, string $value): string
    {
        $number = rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');

        return in_array($kind, self::PERCENT_KINDS, true) ? "{$kind} {$number} %" : "{$kind} {$number}";
    }

    private function validated(object $product, array $data, ?object $current): array
    {
        $kind = (string) $data['kind'];
        $value = (float) $data['value'];
        $from = (string) $data['valid_from'];
        $to = (string) $data['valid_to'];
        $code = isset($data['promo_code']) && trim((string) $data['promo_code']) !== '' ? strtoupper(trim((string) $data['promo_code'])) : null;
        $channel = (string) ($data['channel'] ?? $current->channel ?? 'Todos');
        $errors = [];

        if ($product->status === 'ARCHIVED') {
            throw ApiException::unprocessable('CAT-BR-27', 'El producto está archivado.');
        }

        if ($to < $from) {
            $errors['valid_to'] = ['La vigencia termina antes de empezar.'];
        } elseif ($to < CatalogAccess::today() && ($current === null || $to !== $current->date_to)) {
            $errors['valid_to'] = ['La vigencia debe llegar al menos hasta hoy.'];
        }

        if (in_array($kind, self::PERCENT_KINDS, true) && $value >= self::MAX_PERCENT) {
            $errors['value'] = ['Los descuentos porcentuales deben estar entre 0 y '.self::MAX_PERCENT.' %.'];
        }

        if (! in_array($kind, self::PERCENT_KINDS, true)) {
            $public = $this->rates->publicPrice($product->id)?->price;
            if ($public !== null && $value >= (float) $public) {
                $errors['value'] = [$kind === 'Precio promocional' ? 'El precio promocional debe ser menor que la tarifa pública ('.number_format((float) $public, 2).').' : 'El descuento no puede igualar ni superar la tarifa pública ('.number_format((float) $public, 2).').'];
            }
        }

        if ($kind === 'Código promocional' && $code === null) {
            $errors['promo_code'] = ['Una promoción de tipo código necesita su código.'];
        }

        if ($kind === 'Descuento por cantidad' && empty($data['min_pax'])) {
            $errors['min_pax'] = ['Indica desde cuántos pasajeros aplica.'];
        }

        if ($code !== null && DB::table('catalog_product_promotions')->whereNull('deleted_at')->where('promo_code', $code)->when($current, fn ($query) => $query->where('id', '<>', $current->id))->exists()) {
            $errors['promo_code'] = ['Ese código ya lo usa otra promoción.'];
        }

        if ($errors !== []) {
            throw ApiException::unprocessable('CAT-BR-27', (string) array_values($errors)[0][0], $errors);
        }

        return [
            'name' => trim((string) $data['name']),
            'kind' => $kind,
            'value' => number_format($value, 2, '.', ''),
            'channel' => $channel,
            'promo_code' => $code,
            'min_pax' => empty($data['min_pax']) ? null : (int) $data['min_pax'],
            'date_from' => $from,
            'date_to' => $to,
        ];
    }

    private function product(string $code): object
    {
        return DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'name', 'status'])
            ?? throw ApiException::notFound('El producto no existe.');
    }

    private function promotion(object $product, string $ref): object
    {
        return DB::table('catalog_product_promotions')->where('product_id', $product->id)->where('ref', $ref)->whereNull('deleted_at')->lockForUpdate()->first()
            ?? throw ApiException::notFound('La promoción no existe.');
    }
}
