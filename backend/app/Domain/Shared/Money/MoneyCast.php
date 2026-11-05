<?php

declare(strict_types=1);

namespace App\Domain\Shared\Money;

use Brick\Math\RoundingMode;
use Brick\Money\Money;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

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
            return [$key => (string) \Brick\Math\BigDecimal::of($value)->toScale(2, RoundingMode::HALF_UP)];
        }

        throw new InvalidArgumentException("{$key} debe ser Money o string decimal; nunca float.");
    }
}
