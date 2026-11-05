<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CrmCatalogSeeder
{
    public const ITEMS = [
        'lead_source' => ['Formulario web', 'WhatsApp', 'Facebook Ads', 'Instagram', 'Referido', 'Feria Turismo', 'Llamada entrante', 'B2B', 'Email', 'Visita en oficina'],
        'lead_channel' => ['Web', 'WhatsApp', 'Facebook', 'Instagram', 'Teléfono', 'Presencial', 'Email'],
        'lead_interest' => ['Paquete', 'Tour', 'Excursión', 'Viaje corporativo', 'Viaje de promoción', 'Luna de miel', 'Alojamiento', 'Alianza'],
        'client_segment' => ['Retail', 'Corporativo', 'VIP', 'Grupos', 'B2B'],
        'activity_type' => ['Llamada', 'Email', 'WhatsApp', 'Reunión', 'Tarea', 'Postventa'],
        'lost_reason' => ['Precio', 'Eligió a la competencia', 'Sin presupuesto', 'Cambio de planes del cliente', 'Sin respuesta del cliente', 'Producto o fecha sin disponibilidad', 'Otro'],
        'discard_reason' => ['No es cliente potencial (proveedor / alianza)', 'Datos de contacto inválidos', 'Sin interés real', 'Fuera de cobertura / destino no ofrecido', 'Spam o prueba', 'Otro'],
    ];

    public static function code(string $label): string
    {
        return Str::limit(Str::slug($label, '_'), 40, '');
    }

    public function run(Tenant $tenant): void
    {
        foreach (self::ITEMS as $kind => $labels) {
            foreach ($labels as $index => $label) {
                $key = ['tenant_id' => $tenant->getKey(), 'kind' => $kind, 'code' => self::code($label)];
                $values = ['label' => $label, 'requires_detail' => $label === 'Otro', 'sort_order' => $index + 1];

                if (DB::table('crm_catalog_items')->where($key)->exists()) {
                    DB::table('crm_catalog_items')->where($key)->update($values);
                } else {
                    DB::table('crm_catalog_items')->insert(['id' => (string) Str::uuid7(), ...$key, ...$values]);
                }
            }
        }
    }
}
