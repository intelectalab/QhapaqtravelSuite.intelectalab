<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

final class PlanFeatureRules
{
    public const GROUP = 'Funciones del plan';

    public const RULES = [
        'R-AI-ASSISTANT' => [
            'name' => 'Asistente de ventas con IA',
            'description' => 'Arma itinerarios y borradores de cotización a partir de un pedido en texto o audio y redacta la respuesta. Cupo mensual de pedidos según el plan: 100 en Starter.',
            'min_plan' => 'Starter',
            'scope' => ['Cotizaciones', 'CRM', 'Bandeja'],
        ],
        'R-PAY-LINKS' => [
            'name' => 'Links de pago',
            'description' => 'Crea y envía links para cobrar con Yape, Plin, Mercado Pago, PagoEfectivo o tarjeta en cuotas. Fuera del plan, los links ya enviados se pueden pagar hasta su vencimiento.',
            'min_plan' => 'Starter',
            'scope' => ['Finanzas', 'Sitio web'],
        ],
        'R-AI-IMPORT' => [
            'name' => 'Importador de productos con IA',
            'description' => 'Lee una URL, un PDF o una planilla, detecta los productos y los crea en borrador para revisarlos.',
            'min_plan' => 'Starter',
            'scope' => ['Catálogo'],
        ],
        'R-WHATSAPP-OFFICIAL' => [
            'name' => 'WhatsApp Business oficial',
            'description' => 'Conecta el número de la agencia a la bandeja y envía plantillas transaccionales aprobadas por Meta.',
            'min_plan' => 'Professional',
            'scope' => ['Bandeja', 'Comunicación'],
        ],
        'R-CART-RECOVERY' => [
            'name' => 'Recuperación de carritos y cotizaciones',
            'description' => 'Recordatorios automáticos a quien dejó un carrito del sitio o una cotización sin responder.',
            'min_plan' => 'Professional',
            'scope' => ['Marketing', 'Sitio web', 'Cotizaciones'],
        ],
        'R-GIFT-CARDS' => [
            'name' => 'Vales de regalo',
            'description' => 'Emite y vende vales de regalo que se canjean como medio de pago. Fuera del plan, los vales vigentes se consultan y canjean hasta vencer.',
            'min_plan' => 'Professional',
            'scope' => ['Finanzas', 'Sitio web'],
        ],
        'R-QR-CHECKIN' => [
            'name' => 'Check-in con QR y deslinde firmado',
            'description' => 'Emite un pase QR por pasajero y servicio, y registra el ingreso desde la app del operador. Fuera del plan, los pases ya emitidos siguen sirviendo en el check-in.',
            'min_plan' => 'Professional',
            'scope' => ['Operaciones', 'Portal pasajero'],
        ],
        'R-ACCOUNTING-EXPORT' => [
            'name' => 'Exportación contable',
            'description' => 'Exporta ventas, cobros y compras por período al sistema contable de la agencia.',
            'min_plan' => 'Professional',
            'scope' => ['Finanzas'],
        ],
        'R-CORP-PORTAL' => [
            'name' => 'Portal corporativo',
            'description' => 'La empresa cliente ve sus compras, movimientos y estado de cuenta, aprueba compras sobre el umbral y gestiona sus usuarios. Fuera del plan, el portal queda en solo lectura.',
            'min_plan' => 'Professional',
            'scope' => ['Portal cliente', 'Cotizaciones', 'Finanzas'],
        ],
        'R-OTA-CHANNEL' => [
            'name' => 'Conexión con OTAs',
            'description' => 'Publica productos y recibe reservas de Viator, GetYourGuide, Expedia, Google Things to Do y Civitatis.',
            'min_plan' => 'Enterprise',
            'scope' => ['Canales', 'Reservas'],
        ],
        'R-MARKETPLACE' => [
            'name' => 'Marketplace entre agencias',
            'description' => 'Publica productos para otras agencias de la red y vende los de ellas con comisión.',
            'min_plan' => 'Enterprise',
            'scope' => ['Canales', 'Reservas'],
        ],
        'R-DYNAMIC-PRICING' => [
            'name' => 'Precios dinámicos',
            'description' => 'Ajusta el precio por ocupación, anticipación, día de la semana, temporada y demanda.',
            'min_plan' => 'Enterprise',
            'scope' => ['Catálogo', 'Sitio web'],
        ],
        'R-GDS-OFFERS' => [
            'name' => 'Aéreo y hotel por integración',
            'description' => 'Busca ofertas de vuelos y hoteles del GDS o del banco de camas y las agrega a la cotización.',
            'min_plan' => 'Enterprise',
            'scope' => ['Cotizaciones'],
        ],
        'R-AI-INSIGHTS' => [
            'name' => 'Alertas de rentabilidad con IA',
            'description' => 'Avisa de margen bajo, proveedor caro, meta en riesgo y cobranza atrasada, con la acción sugerida.',
            'min_plan' => 'Enterprise',
            'scope' => ['Reportes'],
        ],
    ];

    public static function codes(): array
    {
        return array_keys(self::RULES);
    }
}
