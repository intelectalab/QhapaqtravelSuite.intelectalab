<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\B2bRateDirectory;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ProductB2bRates
{
    public function __construct(private readonly B2bRateDirectory $directory, private readonly AuditLogger $audit) {}

    public static function rules(bool $partial): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'agency' => [$partial ? 'prohibited' : 'sometimes', 'string', 'max:30'],
            'net_price' => [$required, 'numeric', 'min:0', 'max:99999999'],
            'currency' => ['sometimes', 'in:PEN,USD'],
            'commission_pct' => ['sometimes', 'numeric', 'between:0,30'],
            'credit_allowed' => ['sometimes', 'boolean'],
            'valid_to' => ['nullable', 'date'],
            'conditions' => ['nullable', 'string', 'max:300'],
            'restrictions' => ['nullable', 'string', 'max:300'],
        ];
    }

    public static function messages(): array
    {
        return [
            'agency.*' => 'Elige la agencia.',
            'net_price.*' => 'Indica el precio neto (cero o más).',
            'currency.*' => 'La moneda es PEN o USD.',
            'commission_pct.*' => 'La comisión va de 0 a 30 %.',
            'valid_to.*' => 'La vigencia no es una fecha válida.',
            'conditions.*' => 'Las condiciones admiten hasta 300 caracteres.',
            'restrictions.*' => 'Las restricciones admiten hasta 300 caracteres.',
        ];
    }

    public function save(string $productCode, string $agencyCode, array $data, User $actor, string $mode): void
    {
        DB::transaction(function () use ($productCode, $agencyCode, $data, $actor, $mode): void {
            $product = $this->product($productCode);
            $agency = $this->agency($agencyCode);
            $current = DB::table('catalog_product_b2b_rates')->where('product_id', $product->id)->where('agency_id', $agency->id)->whereNull('deleted_at')->lockForUpdate()->first();

            if ($mode === 'create' && $current !== null) {
                throw ApiException::conflict('B2B-BR-10', "{$agency->legal_name} ya tiene una tarifa para este producto. Edítala.");
            }

            if ($mode === 'update' && $current === null) {
                throw ApiException::notFound('La agencia no tiene tarifa para este producto.');
            }

            $values = $this->validated($product, $agency, [
                'net_price' => $data['net_price'] ?? $current->price ?? null,
                'currency' => $data['currency'] ?? $current->currency ?? null,
                'commission_pct' => $data['commission_pct'] ?? $current->commission_pct ?? $agency->commission_pct,
                'credit_allowed' => array_key_exists('credit_allowed', $data) ? (bool) $data['credit_allowed'] : (bool) ($current->is_credit ?? ((float) $agency->credit_limit > 0)),
                'valid_to' => array_key_exists('valid_to', $data) ? $data['valid_to'] : ($current->valid_to ?? null),
                'conditions' => array_key_exists('conditions', $data) ? $data['conditions'] : ($current->conditions ?? null),
                'restrictions' => array_key_exists('restrictions', $data) ? $data['restrictions'] : ($current->restrictions ?? null),
            ]);

            if ($current) {
                DB::table('catalog_product_b2b_rates')->where('id', $current->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            } else {
                DB::table('catalog_product_b2b_rates')->insert([...$values, 'product_id' => $product->id, 'agency_id' => $agency->id, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            }

            if (! $product->is_b2b) {
                DB::table('catalog_products')->where('id', $product->id)->update(['is_b2b' => true, 'updated_by' => $actor->getKey()]);
            }

            $this->audit->log('Tarifa B2B', "{$product->code}/{$agency->code}", $current ? 'modificar' : 'asignar', $current ? "{$current->currency} {$current->price}" : null, "{$values['currency']} {$values['price']} · comisión {$values['commission_pct']} %");
        });
    }

    public function remove(string $productCode, string $agencyCode, User $actor): void
    {
        DB::transaction(function () use ($productCode, $agencyCode, $actor): void {
            $product = $this->product($productCode);
            $agency = $this->agency($agencyCode);
            $current = DB::table('catalog_product_b2b_rates')->where('product_id', $product->id)->where('agency_id', $agency->id)->whereNull('deleted_at')->first()
                ?? throw ApiException::notFound('La agencia no tiene tarifa para este producto.');
            DB::table('catalog_product_b2b_rates')->where('id', $current->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Tarifa B2B', "{$product->code}/{$agency->code}", 'quitar', "{$current->currency} {$current->price}", null);
        });
    }

    private function validated(object $product, object $agency, array $data): array
    {
        $errors = [];
        $public = $this->directory->publicPrice($product->id);
        $price = (float) $data['net_price'];
        $currency = (string) ($data['currency'] ?? $public->currency ?? 'PEN');

        if ($agency->status !== 'activa' || $agency->valid_to < CatalogAccess::today()) {
            throw ApiException::unprocessable('B2B-BR-10', 'Solo se asignan tarifas a agencias activas y con convenio vigente.');
        }

        if ($public !== null && $public->currency === $currency && $price > (float) $public->price) {
            $errors['net_price'] = ['El precio B2B no puede superar el precio público ('.$currency.' '.number_format((float) $public->price, 2).').'];
        } elseif ($public !== null && $public->currency === $currency && $price < (float) $public->cost) {
            $errors['net_price'] = ['El precio B2B no puede quedar por debajo del costo ('.$currency.' '.number_format((float) $public->cost, 2).').'];
        }

        if ($data['credit_allowed'] && (float) $agency->credit_limit <= 0) {
            $errors['credit_allowed'] = ['La agencia no tiene línea de crédito: la tarifa solo puede ser al contado.'];
        }

        if ($data['valid_to'] !== null && $data['valid_to'] !== '' && (string) $data['valid_to'] < CatalogAccess::today()) {
            $errors['valid_to'] = ['La vigencia debe llegar al menos hasta hoy.'];
        }

        if ($errors !== []) {
            throw ApiException::unprocessable('B2B-BR-10', (string) array_values($errors)[0][0], $errors);
        }

        return [
            'price' => number_format($price, 2, '.', ''),
            'currency' => $currency,
            'commission_pct' => number_format((float) $data['commission_pct'], 2, '.', ''),
            'is_credit' => (bool) $data['credit_allowed'],
            'valid_to' => $data['valid_to'] ?: null,
            'conditions' => $data['conditions'] ? trim((string) $data['conditions']) : null,
            'restrictions' => $data['restrictions'] ? trim((string) $data['restrictions']) : null,
            'price_list_id' => $agency->price_list_id,
            'price_list' => $agency->price_list,
        ];
    }

    private function product(string $code): object
    {
        return DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'name', 'status', 'is_b2b'])
            ?? throw ApiException::notFound('El producto no existe.');
    }

    private function agency(string $code): object
    {
        return DB::table('channel_b2b_agencies as a')->join('channel_b2b_price_lists as l', 'l.id', '=', 'a.price_list_id')->where('a.code', $code)->whereNull('a.deleted_at')
            ->first(['a.id', 'a.code', 'a.legal_name', 'a.status', 'a.valid_to', 'a.credit_limit', 'a.commission_pct', 'a.price_list_id', 'l.name as price_list'])
            ?? throw ApiException::notFound('La agencia no existe.');
    }
}
