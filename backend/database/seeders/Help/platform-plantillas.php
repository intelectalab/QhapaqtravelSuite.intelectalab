<?php

declare(strict_types=1);

return [
    [
        'slug' => 'plataforma-plantillas',
        'audience' => 'platform',
        'module' => 'Negocio',
        'screen' => '/plataforma/plantillas',
        'title' => 'Plantillas web',
        'summary' => 'El catálogo de diseños para el sitio de las agencias, los envíos a revisión del equipo y los partners, la plantilla de cada agencia y los paquetes de IA.',
        'steps' => [
            ['title' => 'Editar el catálogo', 'text' => 'En «Catálogo» cree una plantilla en borrador, edite su tipo, precio y plan mínimo, márquela por defecto para las agencias nuevas o retírela de la galería.'],
            ['title' => 'Revisar un envío', 'text' => 'En «Envíos a revisión» cada versión muestra sus validaciones. Solo se aprueba con todo en verde, Lighthouse mínimo y la revisión visual confirmada; rechazar pide un motivo.'],
            ['title' => 'Asignar a una agencia', 'text' => 'En «Por agencia» pulse «Asignar» y elija la plantilla. Una premium asignada aquí queda como cortesía.'],
            ['title' => 'Paquetes de IA', 'text' => 'En «Paquetes de IA» ajuste precio, créditos y si el paquete está a la venta.'],
        ],
        'faqs' => [
            ['question' => '¿Qué pasa con las agencias si retiro una plantilla?', 'answer' => 'La conservan. Solo deja de mostrarse en la galería para nuevas elecciones.'],
            ['question' => '¿Qué significa «Sin diseño en el sitio»?', 'answer' => 'La plantilla está publicada pero su diseño aún no existe en el sitio: las agencias la ven como «Llega pronto».'],
        ],
        'keywords' => ['plantillas', 'catálogo', 'envíos', 'partners', 'lighthouse', 'créditos de ia'],
        'roles' => [],
    ],
];
