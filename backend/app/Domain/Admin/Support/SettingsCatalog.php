<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

final class SettingsCatalog
{
    public const SECTIONS = ['general', 'currency', 'policies', 'operations', 'channels'];

    public const CHANNELS = [
        'portal_cliente' => ['label' => 'Portal del cliente', 'plan' => 1, 'description' => 'Cotizaciones, pagos y documentos para el cliente.'],
        'portal_pasajero' => ['label' => 'Portal del pasajero', 'plan' => 2, 'description' => 'Itinerario, vouchers y mensajes del viaje.'],
        'b2b' => ['label' => 'Agencias aliadas', 'plan' => 2, 'description' => 'Tarifas netas y reservas de agencias revendedoras.'],
        'whatsapp' => ['label' => 'WhatsApp', 'plan' => 2, 'description' => 'Avisos y conversaciones por WhatsApp Business.'],
        'web' => ['label' => 'Sitio web', 'plan' => 3, 'description' => 'Catálogo público y solicitudes desde la web.'],
        'ecommerce' => ['label' => 'Venta en línea', 'plan' => 3, 'description' => 'Reserva y pago con tarjeta desde la web.'],
        'app_operador' => ['label' => 'App de guías y conductores', 'plan' => 3, 'description' => 'Servicios del día, check-in e incidencias.'],
        'app_pasajero' => ['label' => 'App del pasajero', 'plan' => 3, 'description' => 'Viaje en el teléfono, con avisos push.'],
    ];

    public const SEQUENCE_TYPES = [
        'credit_note' => ['label' => 'Nota de crédito', 'pad' => 8, 'year_reset' => false],
        'debit_note' => ['label' => 'Nota de débito', 'pad' => 8, 'year_reset' => false],
        'commission_settlement' => ['label' => 'Liquidación de comisión', 'pad' => 5, 'year_reset' => true],
        'cash_receipt' => ['label' => 'Recibo de caja', 'pad' => 5, 'year_reset' => true],
        'purchase_order' => ['label' => 'Orden de compra', 'pad' => 5, 'year_reset' => true],
    ];

    public const PLAN_NAMES = [1 => 'Starter', 2 => 'Professional', 3 => 'Enterprise'];

    public const FX_SOURCES = ['Manual diario (SBS referencial)', 'Manual semanal (tesorería)', 'Automático SBS (integración por definir)'];

    public const ROUNDING = ['0.01' => 'Al céntimo', '0.10' => 'A 10 céntimos', '1' => 'Al sol'];

    public const ROUND_MODES = ['nearest' => 'Al más cercano', 'up' => 'Hacia arriba', 'down' => 'Hacia abajo'];

    public const LANGS = ['es-PE' => 'Español (Perú)', 'en-US' => 'Inglés (EE. UU.)'];

    public const DATE_FORMATS = ['DD/MM/AAAA' => '29/09/2026', 'AAAA-MM-DD' => '2026-09-29'];

    public const TIMEZONES = ['America/Lima', 'America/La_Paz', 'America/Santiago', 'America/Guayaquil', 'America/Bogota'];

    public const ALT_CURRENCIES = ['USD' => 'Dólar estadounidense', 'EUR' => 'Euro'];
}
