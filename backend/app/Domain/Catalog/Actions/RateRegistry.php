<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\RateDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class RateRegistry
{
    private const FIELDS = ['rate_type', 'segment', 'channel', 'currency', 'price_basis', 'cost', 'price', 'min_price', 'max_price', 'valid_from', 'valid_to', 'season_id', 'conditions'];

    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function create(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor): array {
            $product = DB::table('catalog_products')->where('id', $data['product_id'])->whereNull('deleted_at')->first(['id', 'code', 'status'])
                ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un producto del catálogo.');

            if ($product->status === 'ARCHIVED') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto está archivado: no admite tarifas nuevas.');
            }

            $values = $this->values($data);
            $this->guard($values, $actor);
            $ref = $this->codes->next('catalog_rates', 'TAR-', 3, 'ref');
            DB::table('catalog_rates')->insert([...$values, 'ref' => $ref, 'product_id' => $product->id, 'status' => 'vigente', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->linkSeason($product->id, $values['season_id'], $actor);
            $this->audit->log('Tarifa', $ref, 'crear', after: "{$product->code} · {$values['rate_type']} {$values['segment']} {$values['channel']} · {$values['currency']} {$values['price']}");

            return ['ref' => $ref, 'warning' => $this->warning($values)];
        });
    }

    public function update(string $ref, array $data, int $version, User $actor): array
    {
        return DB::transaction(function () use ($ref, $data, $version, $actor): array {
            $rate = $this->rate($ref);
            $state = RateDirectory::state($rate, CatalogAccess::today());

            if (in_array($state, ['vencida', 'inactiva'], true)) {
                throw ApiException::conflict('PRD-BR-005', $state === 'vencida' ? 'La tarifa está vencida: crea una nueva en lugar de editarla.' : 'Activa la tarifa antes de editarla.');
            }

            $values = $this->values($data);
            $this->guard($values, $actor, $rate);
            $priceChanged = (float) $values['price'] !== (float) $rate->price || (float) $values['cost'] !== (float) $rate->cost;

            if ($priceChanged && blank($data['reason'] ?? null)) {
                throw ApiException::unprocessable('CAT-BR-14', 'Explica el motivo del cambio de precio o costo.');
            }

            $updated = DB::table('catalog_rates')->where('id', $rate->id)->where('lock_version', $version)
                ->update([...$values, 'lock_version' => $version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($updated === 0) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió esta tarifa mientras la veías. Recarga la página e inténtalo de nuevo.');
            }

            $this->linkSeason($rate->product_id, $values['season_id'], $actor);

            if ($priceChanged) {
                $this->audit->log('Tarifa', $ref, 'cambio_precio', "costo {$rate->cost} · precio {$rate->price}", "costo {$values['cost']} · precio {$values['price']} · {$data['reason']}");
            } else {
                $changed = array_filter(self::FIELDS, fn (string $field) => (string) ($values[$field] ?? '') !== trim((string) ($rate->{$field} ?? '')));
                $this->audit->log('Tarifa', $ref, 'modificar', after: implode(', ', $changed) ?: 'sin cambios');
            }

            return ['ref' => $ref, 'warning' => $this->warning($values)];
        });
    }

    public function setActive(string $ref, bool $active, ?string $reason, User $actor): void
    {
        DB::transaction(function () use ($ref, $active, $reason, $actor): void {
            $rate = $this->rate($ref);

            if ($active && $rate->valid_to < CatalogAccess::today()) {
                throw ApiException::conflict('PRD-BR-005', 'La tarifa está vencida: no se puede activar.');
            }

            if (($rate->status === 'vigente') === $active) {
                return;
            }

            DB::table('catalog_rates')->where('id', $rate->id)->update(['status' => $active ? 'vigente' : 'inactiva', 'lock_version' => $rate->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Tarifa', $ref, $active ? 'activar' : 'desactivar', $rate->status, trim(($active ? 'vigente' : 'inactiva').' '.($reason ? "· {$reason}" : '')));
        });
    }

    private function rate(string $ref): object
    {
        return DB::table('catalog_rates')->where('ref', $ref)->lockForUpdate()->first() ?? throw ApiException::notFound('La tarifa no existe.');
    }

    private function values(array $data): array
    {
        return [
            'rate_type' => $data['rate_type'],
            'segment' => $data['segment'],
            'channel' => $data['channel'],
            'currency' => $data['currency'],
            'price_basis' => $data['price_basis'] ?? 'Por persona',
            'cost' => round((float) $data['cost'], 2),
            'price' => round((float) $data['price'], 2),
            'min_price' => isset($data['min_price']) ? round((float) $data['min_price'], 2) : null,
            'max_price' => isset($data['max_price']) ? round((float) $data['max_price'], 2) : null,
            'valid_from' => $data['valid_from'],
            'valid_to' => $data['valid_to'],
            'season_id' => $data['season_id'] ?? null,
            'conditions' => $data['conditions'] ?? null,
        ];
    }

    private function guard(array $values, User $actor, ?object $current = null): void
    {
        if ($values['valid_to'] < CatalogAccess::today()) {
            throw ApiException::unprocessable('PRD-BR-005', 'La vigencia debe terminar hoy o después.');
        }

        if ($values['min_price'] !== null && $values['price'] < $values['min_price']) {
            throw ApiException::unprocessable('CAT-BR-13', 'El precio no puede ser menor que el precio mínimo.');
        }

        if ($values['max_price'] !== null && $values['price'] > $values['max_price']) {
            throw ApiException::unprocessable('CAT-BR-13', 'El precio no puede superar el precio máximo.');
        }

        if (! CatalogAccess::seesNetRates($actor) && RateDirectory::isNet($values['rate_type'], $values['channel'])) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol no gestiona tarifas netas.');
        }

        if ($values['season_id'] && $values['season_id'] !== $current?->season_id) {
            $active = DB::table('catalog_seasons')->where('id', $values['season_id'])->whereNull('deleted_at')->where('status', 'activa')->exists();

            if (! $active) {
                throw ApiException::unprocessable('CAT-BR-13', 'Solo puedes asociar temporadas activas.');
            }
        }
    }

    private function warning(array $values): ?string
    {
        return $values['price'] < $values['cost'] ? 'El precio quedó por debajo del costo.' : null;
    }

    private function linkSeason(string $productId, ?string $seasonId, User $actor): void
    {
        if ($seasonId && ! DB::table('catalog_product_seasons')->where('product_id', $productId)->where('season_id', $seasonId)->exists()) {
            DB::table('catalog_product_seasons')->insert(['product_id' => $productId, 'season_id' => $seasonId, 'created_by' => $actor->getKey()]);
        }
    }
}
