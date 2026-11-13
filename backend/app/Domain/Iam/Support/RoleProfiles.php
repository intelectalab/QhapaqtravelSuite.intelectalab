<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

final class RoleProfiles
{
    public const DATA_SCOPES = [
        'tenant_admin' => 'Toda la agencia.',
        'manager' => 'Todo el equipo, con filtros por asesor y sede.',
        'sales' => 'Su cartera: leads, oportunidades, cotizaciones y reservas propias.',
        'operations' => 'Reservas en ejecución y proveedores de la agencia; ve costos, no márgenes.',
        'finance' => 'La información financiera de toda la agencia.',
        'accounting' => 'Comprobantes, cobros y pagos de la agencia; los pagos, en lectura.',
        'guide' => 'Solo los servicios que tiene asignados.',
        'driver' => 'Solo los traslados que tiene asignados.',
        'b2b' => 'Solo su agencia: sus reservas, tarifas netas y estado de cuenta.',
        'customer' => 'Solo sus cotizaciones, viajes, documentos y pagos.',
        'passenger' => 'Solo su viaje: itinerario, vouchers y avisos.',
        'provider' => 'Solo sus solicitudes, listas de pasajeros, vouchers y pagos.',
    ];

    public const SCOPE_DEFAULTS = [
        'tenant' => 'Según sus permisos, sobre toda la agencia.',
        'mobile' => 'Solo los servicios vinculados a su cuenta.',
        'canal' => 'Solo los registros vinculados a su cuenta.',
    ];

    public const KEY_DENIALS = [
        'quotes.approve_internal' => 'Aprobar cotizaciones y descuentos',
        'catalog.products.view_profitability' => 'Ver márgenes y utilidad',
        'catalog.products.update' => 'Editar el catálogo',
        'finance.payments.register' => 'Registrar pagos',
        'finance.invoicing' => 'Emitir comprobantes',
        'reservations.cancel' => 'Anular reservas',
        'admin.users.manage' => 'Administrar usuarios',
        'reports.export' => 'Exportar reportes',
    ];

    public const EXTERNAL = [
        ['key' => 'b2b', 'label' => 'Portal de agencias aliadas', 'path' => '/agencia', 'roles' => ['b2b']],
        ['key' => 'customer', 'label' => 'Portal del cliente', 'path' => '/portal', 'roles' => ['customer']],
        ['key' => 'passenger', 'label' => 'Portal del pasajero', 'path' => '/portal', 'roles' => ['passenger']],
        ['key' => 'provider', 'label' => 'Extranet de proveedores', 'path' => '/proveedor', 'roles' => ['provider']],
        ['key' => 'operator', 'label' => 'App de guías y conductores', 'path' => '/mobile/operador', 'roles' => ['guide', 'driver']],
    ];

    public static function dataScope(string $role, ?string $scope): string
    {
        return self::DATA_SCOPES[$role] ?? self::SCOPE_DEFAULTS[$scope ?? 'tenant'] ?? self::SCOPE_DEFAULTS['tenant'];
    }

    public static function denied(string $experience, array $permissions): array
    {
        if ($experience !== 'backoffice') {
            return ['Entrar al back-office', 'Ver costos, márgenes y datos de otros clientes'];
        }

        return array_values(array_filter(self::KEY_DENIALS, fn (string $permission): bool => ! isset($permissions[$permission]), ARRAY_FILTER_USE_KEY));
    }

    public static function external(string $role, string $experience): array
    {
        return collect(self::EXTERNAL)->mapWithKeys(fn (array $row): array => [$row['key'] => $experience !== 'backoffice' && in_array($role, $row['roles'], true)])->all();
    }
}
