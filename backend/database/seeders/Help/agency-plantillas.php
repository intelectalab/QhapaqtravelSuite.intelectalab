<?php

declare(strict_types=1);

return [
    [
        'slug' => 'canales-plantillas',
        'audience' => 'agency',
        'module' => 'Canales',
        'screen' => '/canales/plantillas',
        'title' => 'Plantillas del sitio',
        'summary' => 'El diseño de su sitio público: la plantilla activa, el historial para volver a una anterior y la galería con vista previa usando sus propios datos.',
        'steps' => [
            ['title' => 'Ver una plantilla con sus datos', 'text' => 'En la galería pulse «Vista previa». Su sitio se abre con esa plantilla y una barra abajo para aplicarla o salir. Nadie más la ve: el enlace dura 24 horas y no se indexa.'],
            ['title' => 'Aplicar una plantilla', 'text' => 'Pulse «Aplicar» en la tarjeta o en la barra de la vista previa y confirme. Su sitio cambia de presentación al momento; tours, precios, blog, SEO y dominio quedan igual.'],
            ['title' => 'Personalizar colores y redondeo', 'text' => 'En «Su plantilla activa» pulse «Personalizar». El color de botones y enlaces necesita contraste 4,5:1 sobre blanco. Para el resto del diseño use «Más opciones», que abre Personalización.'],
            ['title' => 'Volver a una plantilla anterior', 'text' => 'En «Historial» pulse «Restaurar». Su sitio vuelve a esa plantilla con la personalización que tenía y la actual queda en el historial.'],
            ['title' => 'Comprar una premium', 'text' => 'Las plantillas premium cuestan S/ 290 + IGV de pago único, en cualquier plan. Pulse «Comprar»: KipuControl emite la factura FQ01 de esa compra, la cobra con su medio de pago y luego puede aplicarla cuando quiera.'],
        ],
        'faqs' => [
            ['question' => '¿Qué plantillas incluye mi plan?', 'answer' => 'Las plantillas están en los tres planes. Actual, Andes Clásico, Inti Raymi, Amazonía y Chakana se aplican sin costo en cualquier plan; Pacífico pide Professional o Enterprise.'],
            ['question' => '¿Por qué una plantilla dice «Llega pronto»?', 'answer' => 'Está en el catálogo pero todavía no tiene su diseño construido en el sitio. Cuando el equipo la publique podrá verla y aplicarla.'],
            ['question' => '¿Pierdo mis tours o mi SEO al cambiar?', 'answer' => 'No. La plantilla solo cambia la presentación. Sus datos, precios, reservas, blog, dominio y redirecciones no se tocan.'],
            ['question' => 'Una plantilla dice «Desde Professional»', 'answer' => 'Tiene plan mínimo. Si su plan es menor, la administración puede mejorarlo desde Suscripción y uso. Si baja de plan, la plantilla activa sigue publicada, pero no podrá volver a aplicarla.'],
        ],
        'keywords' => ['plantilla', 'diseño', 'tema', 'sitio web', 'andes clásico', 'vista previa', 'premium'],
        'roles' => [],
    ],
    [
        'slug' => 'canales-contenido-ia',
        'audience' => 'agency',
        'module' => 'Canales',
        'screen' => '/canales/contenido-ia',
        'title' => 'Contenido con IA',
        'summary' => 'Mejore descripciones, títulos SEO, traducciones, relatos y artículos del blog, y cree imágenes. Todo resultado espera su revisión antes de llegar al sitio.',
        'steps' => [
            ['title' => 'Pedir un texto', 'text' => 'En «Mejorar contenido» elija qué necesita, sobre qué tour, página o historia, el tono y el idioma. Antes de pulsar «Generar» verá el costo en créditos y su saldo.'],
            ['title' => 'Revisar y aplicar', 'text' => 'Cada resultado muestra el antes y la propuesta. Revisa cifras, horarios y precios y pulsa «Aplicar»: el cambio queda en la auditoría con el texto anterior. «Otra versión» cobra de nuevo.'],
            ['title' => 'Crear imágenes', 'text' => 'En «Imágenes» describa la escena, elija estilo, cantidad y calidad. Cada imagen nace con texto alternativo y la etiqueta «Imagen generada con IA»; úsela, edite su texto o descártela.'],
            ['title' => 'Comprar créditos', 'text' => 'En «Planes y créditos» contrate IA Básico (S/ 59 al mes) o IA Pro (S/ 149 al mes), o compre un paquete de pago único. Todo se suma a su factura de KipuControl con IGV. Los movimientos muestran cada asignación, compra y consumo con su saldo.'],
        ],
        'faqs' => [
            ['question' => '¿Cuántos créditos incluye mi plan?', 'answer' => 'Cada mes: Starter 0, Professional 50 y Enterprise 100 créditos de contenido. Los créditos mensuales del plan y de IA Básico o IA Pro no se acumulan; los de paquetes de pago único duran 12 meses.'],
            ['question' => '¿Qué pasa si me quedo sin créditos?', 'answer' => 'El pedido no se envía y verá cuánto necesita, su saldo y los planes y paquetes disponibles. Cualquier plan, también Starter, puede contratarlos.'],
            ['question' => '¿Me cobran si la IA falla?', 'answer' => 'No. Un pedido fallido queda en el historial con cero créditos.'],
            ['question' => '¿Se publica algo solo?', 'answer' => 'Nunca. Todo resultado queda «Por revisar» hasta que una persona lo aplica o lo descarta.'],
            ['question' => '¿Por qué no puedo pedir un relato de una historia?', 'answer' => 'Solo se escriben relatos de historias con el consentimiento vigente del viajero.'],
        ],
        'keywords' => ['ia', 'inteligencia artificial', 'créditos', 'traducir', 'seo', 'imágenes', 'artículo'],
        'roles' => [],
    ],
];
