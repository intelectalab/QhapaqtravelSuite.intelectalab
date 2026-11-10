<?php

declare(strict_types=1);

return [
    'api' => [
        'module.crm' => ['crm/leads', 'crm/opportunities', 'crm/activities', 'crm/clients', 'crm/advisors', 'crm/after-sales', 'crm/cases', 'crm/surveys', 'crm/sales-targets', 'crm/claim-book'],
        'module.catalog' => ['catalog'],
        'module.quotes' => ['quotes'],
        'module.reservations' => ['reservations'],
        'module.finance_basic' => ['finance/invoices', 'finance/payments', 'finance/receivables', 'finance/payables', 'finance/commissions', 'finance/supplier-invoices'],
        'module.profitability' => ['finance/profitability'],
        'module.treasury' => ['treasury', 'finance/bank-lines'],
        'module.operations' => ['ops/orders', 'ops/assignments', 'ops/calendar', 'ops/resources', 'ops/rooming-lists', 'ops/order-tasks', 'ops/incidents', 'ops/evidences', 'ops/reservation-services'],
        'module.vouchers' => ['ops/vouchers'],
        'module.travel_docs' => ['ops/travel-docs'],
        'module.b2b' => ['channels/b2b', 'b2b'],
        'module.ecommerce' => ['channels/ecommerce', 'channels/widget'],
        'module.cms' => ['cms'],
        'module.portal_client' => ['portal/client', 'channels/customer-portal'],
        'module.portal_passenger' => ['channels/passenger-portal'],
        'module.mobile_apps' => ['mobile'],
        'module.inbox_omnichannel' => ['inbox'],
        'module.marketing_campaigns' => ['marketing'],
        'module.reports' => ['reports/kpis'],
        'module.api_access' => ['integrations/api-keys', 'admin/api'],
        'module.webhooks' => ['integrations/webhooks'],
    ],

    'public' => [
        'module.ecommerce' => ['public/carts', 'public/checkout', 'public/orders'],
    ],

    'screens' => [
        'module.crm' => ['/crm/leads', '/crm/oportunidades', '/crm/actividades', '/crm/clientes', '/crm/postventa', '/crm/metas', '/crm/reclamaciones'],
        'module.catalog' => ['/catalogo'],
        'module.quotes' => ['/cotizaciones'],
        'module.reservations' => ['/reservas'],
        'module.finance_basic' => ['/finanzas/cobros', '/finanzas/pagos', '/finanzas/proveedores', '/finanzas/comisiones', '/finanzas/facturacion'],
        'module.profitability' => ['/finanzas/rentabilidad'],
        'module.treasury' => ['/finanzas/tesoreria', '/finanzas/conciliacion'],
        'module.operations' => ['/operaciones/ordenes', '/operaciones/calendario', '/operaciones/asignaciones', '/operaciones/rooming', '/operaciones/incidencias'],
        'module.vouchers' => ['/operaciones/vouchers'],
        'module.travel_docs' => ['/operaciones/documentos-viaje'],
        'module.b2b' => ['/canales/b2b'],
        'module.ecommerce' => ['/canales/ecommerce', '/canales/integracion-web'],
        'module.cms' => ['/canales/cms'],
        'module.portal_client' => ['/canales/portal-cliente'],
        'module.portal_passenger' => ['/canales/portal-pasajero'],
        'module.mobile_apps' => ['/mobile'],
        'module.inbox_omnichannel' => ['/inbox'],
        'module.marketing_campaigns' => ['/marketing'],
        'module.reports' => ['/reportes'],
        'module.api_access' => ['/admin/api'],
    ],
];
