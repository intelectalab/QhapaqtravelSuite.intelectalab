<?php

declare(strict_types=1);

return [
    'api' => [
        'module.crm' => ['crm/leads', 'crm/opportunities', 'crm/activities', 'crm/clients', 'crm/advisors', 'crm/after-sales', 'crm/cases', 'crm/surveys', 'crm/sales-targets', 'crm/claim-book', 'crm/pipeline-stages', 'crm/corporate-accounts'],
        'module.catalog' => ['catalog'],
        'module.quotes' => ['quotes'],
        'module.reservations' => ['reservations'],
        'module.finance_basic' => ['finance/invoices', 'finance/payments', 'finance/receivables', 'finance/payables', 'finance/commissions', 'finance/supplier-invoices', 'finance/costs', 'finance/bank-accounts', 'finance/corporate-statements', 'finance/payment-links', 'finance/gift-cards', 'finance/account-mappings', 'finance/accounting-exports', 'finance/gateways', 'finance/gateway-fees'],
        'module.profitability' => ['finance/profitability'],
        'module.treasury' => ['treasury', 'finance/bank-lines'],
        'module.operations' => ['ops/orders', 'ops/assignments', 'ops/calendar', 'ops/resources', 'ops/rooming-lists', 'ops/rooming-rooms', 'ops/supplier-requests', 'ops/order-tasks', 'ops/incidents', 'ops/evidences', 'ops/reservation-services', 'ops/checkin', 'ops/waiver-templates'],
        'module.vouchers' => ['ops/vouchers'],
        'module.travel_docs' => ['ops/travel-docs'],
        'module.b2b' => ['channels/b2b', 'b2b'],
        'module.ecommerce' => ['channels/ecommerce', 'channels/widget'],
        'module.cms' => ['cms', 'admin/site-design'],
        'module.portal_client' => ['portal/client', 'channels/customer-portal'],
        'module.portal_passenger' => ['channels/passenger-portal', 'portal/passenger', 'passenger/reviews'],
        'module.mobile_apps' => ['mobile'],
        'module.inbox_omnichannel' => ['inbox'],
        'module.marketing_campaigns' => ['marketing'],
        'module.reports' => ['reports/kpis', 'reports/insights', 'analytics/web'],
        'module.api_access' => ['integrations/api-keys', 'admin/api'],
        'module.webhooks' => ['integrations/webhooks', 'integrations/webhook-deliveries'],
        'module.oauth_apps' => ['integrations/oauth-apps'],
    ],

    'public' => [
        'module.ecommerce' => ['public/carts', 'public/checkout', 'public/orders'],
    ],

    'screens' => [
        'module.crm' => ['/crm/leads', '/crm/oportunidades', '/crm/actividades', '/crm/clientes', '/crm/postventa', '/crm/metas', '/crm/reclamaciones', '/crm/cuentas-corporativas'],
        'module.catalog' => ['/catalogo'],
        'module.quotes' => ['/cotizaciones'],
        'module.reservations' => ['/reservas'],
        'module.finance_basic' => ['/finanzas/cobros', '/finanzas/pagos', '/finanzas/proveedores', '/finanzas/comisiones', '/finanzas/facturacion', '/finanzas/estados-cuenta-corporativos', '/finanzas/links-de-pago', '/finanzas/vales', '/finanzas/exportacion-contable', '/finanzas/pasarelas'],
        'module.profitability' => ['/finanzas/rentabilidad'],
        'module.treasury' => ['/finanzas/tesoreria', '/finanzas/conciliacion'],
        'module.operations' => ['/operaciones/ordenes', '/operaciones/calendario', '/operaciones/asignaciones', '/operaciones/rooming', '/operaciones/incidencias', '/operaciones/checkin'],
        'module.vouchers' => ['/operaciones/vouchers'],
        'module.travel_docs' => ['/operaciones/documentos-viaje'],
        'module.b2b' => ['/canales/b2b'],
        'module.ecommerce' => ['/canales/ecommerce', '/canales/integracion-web'],
        'module.cms' => ['/canales/cms', '/canales/plantillas', '/canales/contenido-ia', '/canales/seo', '/canales/aventuras'],
        'module.portal_client' => ['/canales/portal-cliente'],
        'module.portal_passenger' => ['/canales/portal-pasajero'],
        'module.mobile_apps' => ['/mobile'],
        'module.inbox_omnichannel' => ['/inbox'],
        'module.marketing_campaigns' => ['/marketing', '/canales/seguimiento'],
        'module.reports' => ['/reportes'],
        'module.api_access' => ['/admin/api'],
    ],
];
