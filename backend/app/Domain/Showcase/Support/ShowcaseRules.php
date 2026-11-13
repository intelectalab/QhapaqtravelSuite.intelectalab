<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use Illuminate\Support\Facades\DB;

final class ShowcaseRules
{
    public const BRAND = 'Rutas Libres Perú';

    public const DOMAIN = 'rutaslibres.pe';

    public const FREE_MONTHLY_BOOKINGS = 30;

    public const FEE_PER_ATTENDEE = '2.00';

    public const FEE_CURRENCY = 'PEN';

    public const COMMISSION_PCT = ['none' => '8.00', 'starter' => '5.00', 'professional' => '4.00', 'enterprise' => '3.00'];

    public const PLAN_LABELS = ['none' => 'Sin plan', 'starter' => 'Starter', 'professional' => 'Professional', 'enterprise' => 'Enterprise'];

    public const BLOG_MIN_WORDS = 800;

    public const BLOG_MIN_LISTINGS = 3;

    public const PASS_MAX_DAYS = 60;

    public const BENEFITS = [
        ['Vitrina gratis', 'Publique free tours sin costo y reciba reservas con nombre y correo.'],
        ['Sitio propio con su marca', 'Dominio propio, SEO por página, blog de aventuras y reservas en línea.'],
        ['Sin cargo por asistente', 'Las agencias con plan no pagan por asistente en sus free tours.'],
        ['Comisión menor en tours de pago', 'Desde 3 % con Enterprise, frente al 8 % sin plan.'],
        ['Back-office completo', 'CRM, cotizaciones, reservas, operaciones y finanzas en un solo lugar.'],
    ];

    public static function planOf(?string $tenantId): string
    {
        if ($tenantId === null) {
            return 'none';
        }

        $plan = DB::connection('pgsql_platform')->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')
            ->where('t.id', $tenantId)->where('t.status', 'activo')->value('p.code');

        return is_string($plan) && isset(self::COMMISSION_PCT[$plan]) ? $plan : 'none';
    }

    public static function commissionFor(string $plan): string
    {
        return self::COMMISSION_PCT[$plan] ?? self::COMMISSION_PCT['none'];
    }
}
