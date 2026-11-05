<?php

declare(strict_types=1);

namespace App\Domain\Shared\Money;

use Brick\Math\RoundingMode;
use Brick\Money\Money;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Cast Eloquent `numeric(14,2)` + `currency char(3)` ⇄ Brick\Money\Money (CONVENCIONES §2, regla transversal 15).
 *
 *   protected function casts(): array {
 *       return ['total_amount' => MoneyCast::class.':currency'];     // columna de moneda de la fila
 *   }
 *   $reservation->total_amount;                                        // Money (USD 1250.00)
 *   $reservation->total_amount = Money::of('1250.00', 'USD');         // escribe total_amount y currency
 *
 * - PostgreSQL devuelve numeric como string ("1250.00"): nunca se convierte a float.
 * - Escala 2, RoundingMode::HALF_UP (= round2 del prototipo). Para cálculos intermedios usar BigDecimal.
 * - En la API el monto sale como string decimal + currency (ver Decimal::toApi()).
 * - Requiere `composer require brick/money` (el contrato no fija la librería; CLAUDE.md la recomienda).
 *
 * @implements CastsAttributes<Money|null, Money|string|null>
 */
final class MoneyCast implements CastsAttributes
{
    public function __construct(private readonly string $currencyColumn = 'currency')
    {
    }

    public function get(Model $model, string $key, mixed $value, array $attributes): ?Money
    {
        if ($value === null) {
            return null;
        }

        $currency = $attributes[$this->currencyColumn] ?? null;
        if (! is_string($currency) || strlen($currency) !== 3) {
            throw new InvalidArgumentException("Falta la moneda ({$this->currencyColumn}) para {$key}.");
        }

        return Money::of((string) $value, $currency, null, RoundingMode::HALF_UP);
    }

    /** @return array<string, string|null> */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null) {
            return [$key => null];
        }

        if ($value instanceof Money) {
            return [
                $key => (string) $value->getAmount()->toScale(2, RoundingMode::HALF_UP),
                $this->currencyColumn => $value->getCurrency()->getCurrencyCode(),
            ];
        }

        if (is_string($value) && preg_match('/^-?\d+(\.\d+)?$/', $value) === 1) {
            // String decimal: se conserva la moneda que ya tiene la fila.
            return [$key => (string) \Brick\Math\BigDecimal::of($value)->toScale(2, RoundingMode::HALF_UP)];
        }

        throw new InvalidArgumentException("{$key} debe ser Money o string decimal; nunca float.");
    }
}
