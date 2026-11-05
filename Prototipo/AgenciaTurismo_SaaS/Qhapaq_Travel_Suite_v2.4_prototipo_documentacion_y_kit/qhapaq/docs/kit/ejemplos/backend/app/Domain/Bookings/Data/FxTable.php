<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Tabla de tipos de cambio del día (spec 17 §3.6; prototipo `BE.convert` / `BE.display`).
 * `rate` = PEN por 1 unidad de la moneda. Producción: último valor del día de `fin_fx_rates` por moneda activa
 * de `fin_currencies`. La reserva CONSERVA el fx_rate usado (regla transversal 15).
 */
final readonly class FxTable
{
    /**
     * @param  array<string, BigDecimal>  $rates
     * @param  list<string>  $chargeCurrencies  monedas en las que se cobra (sin margen de conversión)
     */
    public function __construct(
        private array $rates,
        private array $chargeCurrencies,
        private string $baseCurrency = 'PEN',
    ) {
    }

    /** @param list<array{code:string, rate:int|float|string, active?:bool}> $currencies */
    public static function fromArray(array $currencies, array $chargeCurrencies, string $baseCurrency = 'PEN'): self
    {
        $rates = [];
        foreach ($currencies as $c) {
            if (($c['active'] ?? true) === true) {
                // (string) evita arrastrar binario de float: 3.74 → "3.74"
                $rates[(string) $c['code']] = BigDecimal::of((string) $c['rate']);
            }
        }

        return new self($rates, array_values($chargeCurrencies), $baseCurrency);
    }

    public function rate(string $code): BigDecimal
    {
        return $this->rates[$code] ?? throw new \InvalidArgumentException("Moneda no activa: {$code}");
    }

    /** amount × rate(from) / rate(to), escala 6 (se redondea a 2 al construir la línea). */
    public function convert(BigDecimal $amount, string $from, string $to): BigDecimal
    {
        if ($from === $to) {
            return $amount;
        }

        return $amount->multipliedBy($this->rate($from))->dividedBy($this->rate($to), 6, RoundingMode::HALF_UP);
    }

    /** Para MOSTRAR: aplica el margen solo si la moneda destino no es de cobro (FX-03, R-MULTICURRENCY.fxMarginPct). */
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
