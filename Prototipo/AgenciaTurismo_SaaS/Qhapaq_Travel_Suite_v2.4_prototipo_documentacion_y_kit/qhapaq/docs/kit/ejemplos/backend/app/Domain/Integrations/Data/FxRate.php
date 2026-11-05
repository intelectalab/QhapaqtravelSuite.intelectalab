<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

/** Tipo de cambio leído de un proveedor (spec 17 §3.6, FX-04). Se guarda en fin_fx_rates (append-only). */
final readonly class FxRate
{
    public function __construct(
        public string $currencyCode,   // USD, EUR…
        public string $ratePen,        // numeric(14,6) como string: PEN por 1 unidad
        public string $rateDate,       // YYYY-MM-DD (un valor vigente por día y moneda)
        public string $source,
        public ?string $buy = null,
        public ?string $sell = null,
    ) {
    }
}
