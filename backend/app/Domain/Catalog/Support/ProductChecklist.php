<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Illuminate\Support\Facades\DB;

final class ProductChecklist
{
    public const ACTIVATABLE = ['APPROVED', 'SUSPENDED', 'INACTIVE', 'ACTIVE'];

    public function evaluate(object $product): array
    {
        $today = now()->toDateString();
        $type = DB::table('catalog_product_types')->where('id', $product->product_type_id)->whereNull('deleted_at')->first(['name', 'requires_itinerary', 'requires_components']);
        $provider = $product->main_provider_id ? DB::table('catalog_providers')->where('id', $product->main_provider_id)->whereNull('deleted_at')->first(['name', 'status', 'contract_end']) : null;
        $components = DB::table('catalog_product_items')->where('product_id', $product->id)->count();
        $blockedServices = DB::table('catalog_product_items as i')->join('catalog_services as s', 's.id', '=', 'i.service_id')->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->where('i.product_id', $product->id)
            ->where(fn ($query) => $query->where('s.status', '<>', 'activo')->orWhere('s.valid_to', '<', $today)->orWhereNotNull('s.deleted_at')
                ->orWhere('pv.status', '<>', 'activo')->orWhere('pv.contract_end', '<', $today)->orWhereNotNull('pv.deleted_at'))
            ->pluck('s.ref');
        $blockedProducts = DB::table('catalog_product_items as i')->join('catalog_products as c', 'c.id', '=', 'i.component_product_id')
            ->where('i.product_id', $product->id)->where(fn ($query) => $query->where('c.status', '<>', 'ACTIVE')->orWhereNotNull('c.deleted_at'))
            ->pluck('c.code');
        $blocked = $blockedServices->merge($blockedProducts);
        $rates = DB::table('catalog_rates')->where('product_id', $product->id)->get(['currency', 'valid_from', 'valid_to', 'status']);
        $currentRate = $rates->first(fn (object $rate) => $rate->status === 'vigente' && $rate->valid_from <= $today && $rate->valid_to >= $today);
        $policy = DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund']);
        $itinerary = DB::table('catalog_itineraries')->where('product_id', $product->id)->where('is_default', true)->value('id');
        $days = $itinerary ? DB::table('catalog_itinerary_days as d')->where('d.itinerary_id', $itinerary)
            ->select('d.id')->selectRaw('(select count(*) from catalog_itinerary_items i where i.day_id = d.id) as items')->get() : collect();
        $futureDeparture = DB::table('catalog_product_departures')->where('product_id', $product->id)->where('status', 'abierta')->where('departure_date', '>=', $today)->exists();

        $items = [
            ['key' => 'type', 'label' => 'Tipo de producto', 'ok' => $type !== null, 'detail' => $type?->name ?? 'Sin tipo'],
            ['key' => 'name', 'label' => 'Nombre de al menos 3 letras', 'ok' => mb_strlen(trim((string) $product->name)) >= 3, 'detail' => $product->name],
            ['key' => 'destination', 'label' => 'Destino', 'ok' => DB::table('catalog_destinations')->where('id', $product->primary_destination_id)->whereNull('deleted_at')->exists(), 'detail' => null],
            ['key' => 'status', 'label' => 'Aprobado antes de activar', 'ok' => in_array($product->status, self::ACTIVATABLE, true), 'detail' => null],
            ['key' => 'components', 'label' => 'Al menos un componente', 'ok' => $components > 0 || ($type && ! $type->requires_components), 'detail' => "{$components} cargados"],
            ['key' => 'provider', 'label' => 'Proveedor principal activo y con contrato vigente', 'ok' => $provider !== null && $provider->status === 'activo' && $provider->contract_end >= $today && $blocked->isEmpty(), 'detail' => $blocked->isNotEmpty() ? 'Componentes no disponibles: '.$blocked->implode(', ') : ($provider ? $provider->name : 'Sin proveedor')],
            ['key' => 'rate_today', 'label' => 'Una tarifa vigente hoy', 'ok' => $currentRate !== null, 'detail' => null],
            ['key' => 'rate_currency', 'label' => 'Todas las tarifas con moneda', 'ok' => $rates->isNotEmpty() && $rates->every(fn (object $rate) => ! empty($rate->currency)), 'detail' => null],
            ['key' => 'rate_validity', 'label' => 'Todas las tarifas con vigencia', 'ok' => $rates->isNotEmpty() && $rates->every(fn (object $rate) => $rate->valid_from && $rate->valid_to), 'detail' => null],
            ['key' => 'policies', 'label' => 'Políticas de cancelación, cambio, no-show y reembolso', 'ok' => $policy !== null && collect((array) $policy)->every(fn ($text) => trim((string) $text) !== ''), 'detail' => null],
            ['key' => 'availability', 'label' => 'Modelo de disponibilidad', 'ok' => ! empty($product->availability_model) && ($product->availability_model !== 'POR_SALIDA' || $futureDeparture), 'detail' => $product->availability_model === 'POR_SALIDA' && ! $futureDeparture ? 'Falta una salida abierta' : null],
            ['key' => 'itinerary', 'label' => 'Itinerario con actividades cada día', 'ok' => ! ($type?->requires_itinerary) || ($days->isNotEmpty() && $days->every(fn (object $day) => (int) $day->items > 0)), 'detail' => $days->isEmpty() ? 'Sin días' : "{$days->count()} días"],
        ];

        return $items;
    }

    public function failed(object $product): array
    {
        return array_values(array_filter($this->evaluate($product), fn (array $item) => ! $item['ok']));
    }
}
