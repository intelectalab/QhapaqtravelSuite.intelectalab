<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final readonly class FxTable
{
    public function __construct(
        private array $rates,
        private array $chargeCurrencies,
        private string $baseCurrency = 'PEN',
    ) {}

    public static function fromArray(array $currencies, array $chargeCurrencies, string $baseCurrency = 'PEN'): self
    {
        $rates = [];
        foreach ($currencies as $c) {
            if (($c['active'] ?? true) === true) {

                $rates[(string) $c['code']] = BigDecimal::of((string) $c['rate']);
            }
        }

        return new self($rates, array_values($chargeCurrencies), $baseCurrency);
    }

    public function rate(string $code): BigDecimal
    {
        return $this->rates[$code] ?? throw new \InvalidArgumentException("Moneda no activa: {$code}");
    }

    public function convert(BigDecimal $amount, string $from, string $to): BigDecimal
    {
        if ($from === $to) {
            return $amount;
        }

        return $amount->multipliedBy($this->rate($from))->dividedBy($this->rate($to), 6, RoundingMode::HALF_UP);
    }

    public function display(BigDecimal $amount, string $from, string $to, string $marginPct): BigDecimal
    {
        $value = $this->convert($amount, $from, $to);

        return in_array($to, $this->chargeCurrencies, true)
            ? $value
            : $value->multipliedBy(BigDecimal::of(100)->plus($marginPct))->dividedBy(100, 6, RoundingMode::HALF_UP);
    }

    public function isCharge(string $code): bool
    {
        return in_array($code, $this->chargeCurrencies, true);
    }

    public function base(): string
    {
        return $this->baseCurrency;
    }
}
