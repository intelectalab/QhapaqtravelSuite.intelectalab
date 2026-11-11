<?php

declare(strict_types=1);

namespace Database\Support;

use Illuminate\Support\Facades\DB;

final class PricingSamples
{
    private const RULES = [
        ['ref' => 'PR-01', 'name' => 'Markup estándar retail', 'kind' => 'Markup %', 'value' => 25, 'scope' => 'Canales directo, e-commerce y corporativo', 'priority' => 50],
        ['ref' => 'PR-02', 'name' => 'Markup mayorista B2B', 'kind' => 'Markup %', 'value' => 16, 'scope' => 'Canal B2B', 'channel' => 'B2B', 'priority' => 10],
        ['ref' => 'PR-03', 'name' => 'IGV servicios a domiciliados', 'kind' => 'Impuesto %', 'value' => 18, 'scope' => 'Clientes domiciliados en Perú', 'residency' => 'dom', 'priority' => 10],
        ['ref' => 'PR-04', 'name' => 'Exportación de servicios', 'kind' => 'Impuesto %', 'value' => 0, 'scope' => 'Pasajeros no domiciliados', 'residency' => 'nodom', 'priority' => 10],
        ['ref' => 'PR-05', 'name' => 'Descuento por ocupación 10+ pax', 'kind' => 'Descuento %', 'value' => 5, 'scope' => 'Grupos de 10 pasajeros o más', 'min_pax' => 10, 'priority' => 20],
        ['ref' => 'PR-06', 'name' => 'Redondeo comercial', 'kind' => 'Redondeo', 'value' => 0.1, 'scope' => 'Todos los canales', 'priority' => 100],
        ['ref' => 'PR-07', 'name' => 'Comisión vendedor', 'kind' => 'Comisión %', 'value' => 3, 'scope' => 'Ventas directas', 'channel' => 'Directo', 'priority' => 50],
        ['ref' => 'PR-08', 'name' => 'Precio mínimo Machu Picchu Full Day', 'kind' => 'Precio mínimo', 'value' => 300, 'scope' => 'Machu Picchu Full Day en USD, por pasajero', 'product' => 'PRD-001', 'currency' => 'USD', 'priority' => 10],
    ];

    public function seed(string $tenantId): void
    {
        foreach (self::RULES as $rule) {
            if (DB::table('catalog_price_rules')->where('tenant_id', $tenantId)->where('ref', $rule['ref'])->exists()) {
                continue;
            }

            $product = isset($rule['product']) ? DB::table('catalog_products')->where('tenant_id', $tenantId)->where('ref', $rule['product'])->value('id') : null;

            if (isset($rule['product']) && $product === null) {
                continue;
            }

            DB::table('catalog_price_rules')->insert([
                'tenant_id' => $tenantId,
                'ref' => $rule['ref'],
                'name' => $rule['name'],
                'kind' => $rule['kind'],
                'value' => $rule['value'],
                'scope' => $rule['scope'],
                'channel' => $rule['channel'] ?? null,
                'min_pax' => $rule['min_pax'] ?? null,
                'customer_residency' => $rule['residency'] ?? null,
                'product_id' => $product,
                'currency' => $rule['currency'] ?? null,
                'priority' => $rule['priority'],
                'status' => 'activa',
            ]);
        }
    }
}
