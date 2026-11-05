<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Actions\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

/**
 * Paso 10 de la conversión (spec 04 §4.3, `servicesFromItem` del prototipo): desglosa un ítem de cotización
 * en servicios de reserva (`booking_reservation_services`) prorrateando costo y precio por componente.
 *
 *   costT = unit_cost × qty × pax
 *   saleT = unit_price × qty × pax × (1 − discount_pct/100)            (sin IGV)
 *   w_k   = conv(service.cost, service.currency → moneda) × (component.quantity ‖ 1) × (service.unit = 'pax' ? pax : 1)
 *   cost_k = costT × w_k / Σw ; price_k = saleT × w_k / Σw  (round2; residuo a la última línea ⇒ Σ exacto)
 *
 * Ejemplo de la spec (PRD-001, 2 pax, costo 268 / precio 345 USD): Σ costos 536.00 y Σ precios 690.00 exactos.
 * Componentes: `catalog_product_items` con `is_included = true` y `service_id` (los ítems que apuntan a otro
 * producto — `component_product_id` — no generan servicio aquí: Por definir con negocio).
 */
final class ServicesFromQuoteItem
{
    /**
     * @param  object{product_id:string,service_date:string,qty:int,pax:int,unit_cost:string,unit_price:string,id:string}  $item
     * @return list<array<string, mixed>> filas listas para insertar (sin id/tenant: los pone la BD / el contexto)
     */
    public function build(object $item, string $discountPct, string $currency, string $fxRate, ?string $departureId, ?string $mainProviderId): array
    {
        $qty = (int) $item->qty;
        $pax = (int) $item->pax;
        $costT = BigDecimal::of($item->unit_cost)->multipliedBy($qty)->multipliedBy($pax);
        $saleT = BigDecimal::of($item->unit_price)->multipliedBy($qty)->multipliedBy($pax)
            ->multipliedBy(BigDecimal::of(100)->minus($discountPct))->dividedBy(100, 6, RoundingMode::HALF_UP);

        $components = DB::table('catalog_product_items as i')
            ->join('catalog_services as s', 's.id', '=', 'i.service_id')
            ->where('i.product_id', $item->product_id)
            ->where('i.is_included', true)
            ->whereNotNull('i.service_id')
            ->orderBy('i.sort_order')
            ->get(['i.quantity', 'i.is_required', 'i.notes', 's.id as service_id', 's.name', 's.type', 's.unit', 's.cost', 's.currency', 's.provider_id']);

        $base = [
            'product_id' => $item->product_id,
            'quote_item_id' => $item->id,
            'departure_id' => $departureId,
            'service_date' => $item->service_date,
            'pax' => $pax,
            'status' => 'pendiente',
            'currency' => $currency,
            'fx_rate' => $fxRate,
        ];

        if ($components->isEmpty()) {
            return [[
                ...$base,
                'catalog_service_id' => null,
                'provider_id' => $mainProviderId,
                'name' => "Producto ({$pax} pax)",
                'service_time' => null,
                'cost_amount' => (string) Decimal::round2($costT),
                'price_amount' => (string) Decimal::round2($saleT),
                'is_required' => true,
                'service_kind' => 'libre',
                'requires_assignment' => false,
            ]];
        }

        $weights = $components->map(function (object $c) use ($currency, $fxRate, $pax): BigDecimal {
            $cost = Decimal::convert((string) $c->cost, (string) $c->currency, $currency, $fxRate);
            $qty = BigDecimal::of((string) ($c->quantity ?: 1));

            return $cost->multipliedBy($qty)->multipliedBy($c->unit === 'pax' ? $pax : 1);
        })->all();

        $costs = Decimal::allocate($costT, $weights);
        $prices = Decimal::allocate($saleT, $weights);
        $firstTime = $this->firstItineraryTime((string) $item->product_id);

        $rows = [];
        foreach ($components->values() as $k => $c) {
            [$kind, $assign] = $this->kindFor((string) $c->type);
            $q = (float) $c->quantity > 1 ? ' ×'.rtrim(rtrim((string) $c->quantity, '0'), '.') : '';

            $rows[] = [
                ...$base,
                'catalog_service_id' => $c->service_id,
                'provider_id' => $c->provider_id,
                'name' => mb_substr($c->name.$q, 0, 200),
                'service_time' => $this->timeFromNotes($c->notes) ?? ($k === 0 ? $firstTime : null),
                'cost_amount' => (string) $costs[$k],
                'price_amount' => (string) $prices[$k],
                'is_required' => (bool) $c->is_required,
                'service_kind' => $kind,
                'requires_assignment' => $assign,
            ];
        }

        return $rows;
    }

    /** Hora `HH:MM` escrita en las notas del componente (prototipo). */
    private function timeFromNotes(?string $notes): ?string
    {
        return $notes !== null && preg_match('/\b([01]\d|2[0-3]):([0-5]\d)\b/', $notes, $m) === 1 ? $m[0] : null;
    }

    /** Primera hora del día 1 del itinerario por defecto del producto. */
    private function firstItineraryTime(string $productId): ?string
    {
        $time = DB::table('catalog_itineraries as it')
            ->join('catalog_itinerary_days as d', 'd.itinerary_id', '=', 'it.id')
            ->join('catalog_itinerary_items as x', 'x.day_id', '=', 'd.id')
            ->where('it.product_id', $productId)
            ->where('it.is_default', true)
            ->where('d.day_number', 1)
            ->whereNotNull('x.start_time')
            ->orderBy('x.start_time')
            ->value('x.start_time');

        return $time === null ? null : substr((string) $time, 0, 5);
    }

    /**
     * `catalog_services.type` → (`service_kind`, `requires_assignment`) de booking_reservation_services.
     * SUPUESTO: la spec 05 §11-24 reemplaza la heurística del prototipo por estas columnas pero no fija el mapeo.
     *
     * @return array{0:string,1:bool}
     */
    private function kindFor(string $type): array
    {
        return match ($type) {
            'Traslado', 'Transporte' => ['traslado', true],
            'Guía', 'Tour', 'Actividad' => ['tour', true],
            'Tren', 'Entrada' => ['tren_entrada', false],
            'Alojamiento' => ['alojamiento', false],
            default => ['libre', false],
        };
    }
}
