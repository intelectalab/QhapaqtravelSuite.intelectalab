<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\FxRate;

/**
 * Proveedor de tipo de cambio (spec 17 §3.6, FX-04; tabla fx_rate_providers; D-12 proveedor real por definir).
 * El job de actualización registra UN valor por día y moneda en fin_fx_rates (append-only) y levanta alerta
 * si la variación diaria supera `fx_alert_pct`. Si el proveedor falla se conserva el último valor.
 */
interface FxRateProvider extends HealthCheckable
{
    /**
     * @param  list<string>  $currencies  códigos ISO 4217 activos del tenant (fin_currencies)
     * @return list<FxRate>  tasas en PEN por 1 unidad
     */
    public function latest(array $currencies, string $date): array;
}
