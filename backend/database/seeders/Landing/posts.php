<?php

declare(strict_types=1);

return [
    [
        'slug' => 'como-cotizar-un-paquete-a-cusco-en-10-minutos',
        'title' => 'Cómo cotizar un paquete a Cusco en 10 minutos',
        'title_accent' => '(y cerrar la venta el mismo día)',
        'category' => 'ventas',
        'published' => '2026-10-18',
        'reads' => 2400,
        'featured' => true,
        'author' => 'Carlos Mendoza',
        'role' => 'Jefe de producto · ex operador receptivo en Cusco',
        'keyword' => 'cotizar paquete cusco',
        'excerpt' => 'Guía paso a paso para agencias receptivas: márgenes con trenes y boletos, exoneración del IGV y envío del itinerario por WhatsApp con cobro en soles y dólares.',
        'body' => <<<'MD'
## El cuello de botella tradicional
Un viajero de São Paulo pide un Cusco clásico de cinco días para cuatro personas. En muchas agencias eso abre entre cuatro y seis horas de hojas de cálculo, portales de trenes, consultas de cupos al hotel y mensajes al guía para confirmar disponibilidad.
Cuando por fin llega el PDF, al final de la tarde, el viajero ya reservó con la agencia que le respondió en quince minutos. No perdiste por precio: perdiste por tiempo.
> Consejo de temporada alta: entre junio y agosto no congeles una cotización por más de 48 horas sin pre-reservar el tren. El cupo de Vistadome se agota antes que el del hotel.
## Tu matriz de costos y márgenes en 3 pasos
Separa los componentes del paquete en tres bolsas y trátalas distinto. La primera son los costos fijos que no admiten comisión, como las entradas a Machu Picchu. La segunda son los servicios que bajan de precio por volumen, como el transporte y los guías. La tercera son las tarifas netas que negociaste con hoteles y trenes.
Con esa separación el margen deja de ser un porcentaje único que aplicas a todo y pasa a ser una decisión por componente.
| Componente (4 pasajeros) | Costo neto | Margen | Precio por pasajero |
| Tren Vistadome ida y vuelta | USD 142,00 | 25 % | USD 177,50 |
| Boleto Machu Picchu circuito 2 | USD 41,00 | 0 % | USD 41,00 |
| Guía oficial bilingüe | USD 35,00 | 35 % | USD 47,25 |
| Hotel boutique 4 estrellas, por noche | USD 85,00 | 30 % | USD 110,50 |
## El cotizador de KipuControl
El cotizador toma las tarifas vigentes de tu catálogo, aplica la exoneración del IGV para no domiciliados y calcula el margen por pasajero antes de que envíes la propuesta. Si alguien del equipo baja el precio por debajo del margen mínimo de tu agencia, la cotización pide aprobación.
[[maqueta:cotizador]]
Cada versión queda guardada. Si el viajero pide cambiar el hotel, comparas la versión anterior con la nueva y ves la diferencia de margen en una sola pantalla.
## Cierre inmediato: itinerario interactivo y cobro multimoneda
Un PDF adjunto por correo se abre menos de la mitad de las veces. Un enlace con el itinerario día por día, las fotos del hotel y un botón para pagar el anticipo elimina la fricción: el viajero revisa desde el teléfono y paga en el mismo momento.
El enlace acepta soles o dólares y guarda el tipo de cambio del día de la cotización, así el monto no cambia aunque el pago llegue una semana después.
> Dato de conversión: las agencias que responden en los primeros 15 minutos con enlace y pasarela cierran 38 % más que las que tardan más de 2 horas.
## Lista para tu próxima cotización
- Responde la consulta en menos de 15 minutos, aunque sea con una propuesta base.
- Separa costos fijos, escalonados y netos antes de poner margen.
- Pre-reserva el tren si la cotización vive más de dos días en temporada alta.
- Envía un enlace con botón de pago, no solo un PDF.
- Guarda el tipo de cambio en la cotización para no discutir montos después.
MD,
        'faq' => [
            ['q' => '¿Cómo aplica la exoneración del IGV para turistas no domiciliados?', 'a' => 'Los servicios de hospedaje y alimentación a no domiciliados con pasaporte se tratan como exportación de servicios (DL 1125). KipuControl la aplica por ítem al emitir el comprobante.'],
            ['q' => '¿Puedo cotizar en dólares y cobrar en soles con Yape?', 'a' => 'Sí. La cotización guarda el tipo de cambio y el enlace de pago acepta soles o dólares.'],
            ['q' => '¿Qué pasa si el pasajero reprograma Machu Picchu?', 'a' => 'La reserva pasa a reprogramación, libera los cupos y recalcula las diferencias de tarifa.'],
        ],
    ],
    [
        'slug' => 'guia-sunat-2026-facturacion-electronica-tours-receptivos',
        'title' => 'Guía SUNAT 2026: facturación electrónica para tours receptivos',
        'title_accent' => null,
        'category' => 'finanzas',
        'published' => '2026-10-14',
        'reads' => 4800,
        'featured' => false,
        'author' => 'Renzo Quispe',
        'role' => 'Contador tributario',
        'keyword' => 'facturación electrónica turismo',
        'excerpt' => 'Requisitos del DL 1125, validación de pasaporte y emisión de facturas sin IGV para turistas no domiciliados.',
        'body' => <<<'MD'
## Qué cambia para una agencia receptiva
La agencia receptiva vende a viajeros que no viven en el Perú. Una parte de esos servicios califica como exportación y no lleva IGV, pero solo si el comprobante y el respaldo cumplen lo que pide SUNAT. El error más común no es cobrar mal: es emitir bien y no poder demostrarlo en una fiscalización.
## Los tres requisitos que revisa SUNAT
- El viajero es no domiciliado y lo acredita con su pasaporte o documento de viaje.
- El servicio está en la lista de servicios que califican, como hospedaje y alimentación incluidos en el paquete.
- El comprobante identifica al viajero con su documento y separa los ítems exonerados de los gravados.
> Consejo práctico: guarda la copia del pasaporte junto a la reserva, no en el correo de un asesor. Cuando llegue la fiscalización, el respaldo tiene que estar donde está el comprobante.
## Factura, boleta o ninguna
Si el viajero paga a nombre propio emites boleta o factura según tenga o no RUC del extranjero, que normalmente no tiene. Si paga una agencia del exterior, emites factura a esa agencia como exportación de servicios. En los dos casos el IGV se calcula por ítem, no por el total del paquete.
| Ítem del paquete | Tratamiento | IGV |
| Hospedaje a no domiciliado | Exportación de servicios | 0 % |
| Alimentación incluida en el hospedaje | Exportación de servicios | 0 % |
| Transporte interno | Gravado | 18 % |
| Entradas a museos y sitios | Inafecto según el emisor | 0 % |
## Cómo lo resuelve KipuControl
Cada producto de tu catálogo guarda su tratamiento tributario. Al confirmar el pago, KipuControl arma el comprobante con los ítems separados, toma el documento del pasajero de la reserva y lo envía a tu proveedor de facturación electrónica. Recibes el XML y la constancia de recepción en la ficha de la reserva.
El contador revisa un solo reporte mensual con lo exonerado y lo gravado, en lugar de reconstruirlo desde los correos del equipo.
MD,
        'faq' => [
            ['q' => '¿Necesito un proveedor de facturación electrónica aparte?', 'a' => 'Sí. KipuControl se conecta con tu operador de servicios electrónicos (OSE) y le envía cada comprobante; tú eliges el proveedor.'],
            ['q' => '¿Qué pasa si el viajero no tiene pasaporte a la mano al pagar?', 'a' => 'La reserva queda con el dato pendiente y el comprobante no se emite como exportación hasta completarlo.'],
        ],
    ],
    [
        'slug' => 'seo-local-para-operadores-en-cusco',
        'title' => 'SEO local para operadores en Cusco: tu web primera en Google para Camino Inca',
        'title_accent' => null,
        'category' => 'marketing-seo',
        'published' => '2026-10-11',
        'reads' => 3900,
        'featured' => false,
        'author' => 'Lucía Barreda',
        'role' => 'Especialista SEO',
        'keyword' => 'seo agencia de viajes',
        'excerpt' => 'Web bilingüe, reseñas verificadas y datos estructurados de turismo para aparecer en Google sin pagar publicidad.',
        'body' => <<<'MD'
## Por qué tu web no aparece
Buscar «Inca Trail 4 days» devuelve agregadores, OTAs y unas pocas agencias locales. Las que aparecen no son necesariamente las más grandes: son las que tienen una página por tour, en el idioma del viajero, con precios visibles y reseñas que Google puede leer.
## Una página por tour, no una página por agencia
Cada tour necesita su propia dirección, su título con el destino y la duración, y una descripción que responda lo que el viajero pregunta: qué incluye, cuánto cuesta, cuándo sale y qué tan difícil es. Una página de «Nuestros tours» con veinte tarjetas no posiciona ninguno.
- Título con destino, duración y tipo de experiencia.
- Precio desde, en la moneda del visitante.
- Itinerario día por día con los nombres reales de los lugares.
- Preguntas frecuentes con respuestas cortas.
> Dato útil: las páginas de tour con precio visible reciben más clics desde Google que las que dicen «consultar precio», porque el buscador puede mostrar el monto en el resultado.
## Reseñas que cuentan
Google valora las reseñas verificadas y recientes. Pide la reseña al terminar el viaje, no tres semanas después, y responde cada una. KipuControl envía la invitación al pasajero cuando el operador cierra el servicio y muestra las reseñas en la página del tour.
## Datos estructurados de turismo
Los datos estructurados le dicen a Google, en su idioma, que tu página describe un tour con un precio, una duración y una calificación. El sitio que crea KipuControl los publica en cada tour, con su versión en inglés y portugués, sin que tengas que escribir código.
## Lo que medimos cada mes
Mide las búsquedas que te traen visitas, las páginas que convierten en reservas y las que reciben visitas pero no ventas. Esas últimas son tu lista de trabajo del mes siguiente.
MD,
        'faq' => [
            ['q' => '¿Cuánto tarda en notarse el SEO?', 'a' => 'Entre ocho y doce semanas para las búsquedas de cola larga, como un tour con su duración y su destino.'],
        ],
    ],
    [
        'slug' => 'checklist-de-operaciones-de-campo',
        'title' => 'Checklist de operaciones de campo: guías, transportistas y manifiestos',
        'title_accent' => null,
        'category' => 'operaciones',
        'published' => '2026-10-08',
        'reads' => 2100,
        'featured' => false,
        'author' => 'Diego Rivas',
        'role' => 'Jefe de operaciones',
        'keyword' => 'operaciones turisticas',
        'excerpt' => 'Planillas de contingencia, comunicación con guías y controles en Ollantaytambo y Aguas Calientes.',
        'body' => <<<'MD'
## La noche anterior
La operación de mañana se gana o se pierde la noche anterior. A las seis de la tarde el jefe de operaciones debería tener tres cosas cerradas: el manifiesto de pasajeros, la asignación de guía y vehículo por salida, y los boletos de ingreso emitidos.
- Manifiesto con nombres, documentos, restricciones alimentarias y teléfono de contacto.
- Guía y conductor confirmados por mensaje, con la hora de recojo de cada hotel.
- Boletos de tren y de ingreso descargados y asignados a cada pasajero.
- Plan B si el tren se retrasa o si la carretera a Ollantaytambo se cierra.
> Consejo de campo: comparte el manifiesto con el guía por el teléfono, no impreso. Si un pasajero se suma a última hora, el guía lo ve en el momento.
## Durante el servicio
El guía marca la asistencia en cada punto de recojo y registra cualquier incidente con foto. Si un pasajero no se presenta, el sistema lo marca como no show y aplica la política de la agencia, sin discusiones al regreso.
## Puestos de control
En Ollantaytambo y Aguas Calientes los controles revisan documento y boleto de cada pasajero. Lleva el manifiesto actualizado y los boletos en el orden en que suben al tren. Un pasajero con el nombre mal escrito en el boleto puede quedarse en el andén.
## Al cierre del día
El operador cierra el servicio con sus evidencias. Ese cierre dispara el pago al proveedor y la invitación de reseña al pasajero. Si no se cierra, ni el proveedor cobra ni el pasajero opina.
## Lo que cambia con KipuControl
Las órdenes de servicio salen de la reserva confirmada, con los pasajeros, el guía y el vehículo asignados. El guía las ve en la app móvil, incluso sin cobertura, y las evidencias suben al recuperar la señal.
MD,
        'faq' => [],
    ],
    [
        'slug' => 'embudo-de-ventas-por-whatsapp',
        'title' => 'De lead frío a voucher confirmado: el embudo de ventas por WhatsApp',
        'title_accent' => null,
        'category' => 'ventas',
        'published' => '2026-10-05',
        'reads' => 3200,
        'featured' => false,
        'author' => 'Carlos Mendoza',
        'role' => 'Jefe de producto',
        'keyword' => 'ventas por whatsapp turismo',
        'excerpt' => 'Mensajes con botones de pago, recordatorios y seguimiento para no perder consultas en temporada alta.',
        'body' => <<<'MD'
## WhatsApp no es un embudo, es una bandeja
La mayoría de agencias recibe por WhatsApp más del 70 % de sus consultas, pero las atiende como una bandeja de chat: quien escribe último aparece arriba y quien no respondió se pierde. Un embudo, en cambio, sabe en qué etapa está cada viajero y qué toca hacer con él.
## Las cinco etapas
- Nuevo: llegó la consulta y nadie la tomó.
- Calificado: sabes destino, fechas, número de viajeros y presupuesto.
- Cotizado: el viajero recibió la propuesta con su enlace.
- Negociación: pidió cambios o comparó con otra agencia.
- Ganado o perdido: pagó el anticipo o dijo que no, con el motivo.
> Dato de temporada alta: una consulta que no recibe respuesta en la primera hora tiene la mitad de probabilidad de convertirse en venta.
## Mensajes que avanzan la venta
Cada etapa tiene un mensaje que la mueve a la siguiente. Al calificar, pregunta fechas y número de viajeros en un solo mensaje. Al cotizar, envía el enlace con el itinerario y el botón de pago, no un PDF. En negociación, ofrece una alternativa concreta en lugar de un descuento.
## Recordatorios sin perseguir
Programa un recordatorio a las 24 horas de enviada la cotización y otro antes de que venza. Si el viajero no responde a ninguno, marca la oportunidad como perdida con el motivo «sin respuesta» y libera al asesor para las consultas nuevas.
## Lo que hace KipuControl
La bandeja de WhatsApp de KipuControl crea el lead al primer mensaje, lo asigna por turno y lo lleva por las etapas. La cotización se envía desde la misma conversación y el pago del anticipo confirma la reserva sin que nadie copie datos.
MD,
        'faq' => [
            ['q' => '¿Necesito WhatsApp Business API?', 'a' => 'Para enviar desde KipuControl sí. Te ayudamos a conectar el número de tu agencia en la puesta en marcha.'],
        ],
    ],
    [
        'slug' => 'prompts-de-ia-para-itinerarios',
        'title' => '15 prompts de IA para redactar itinerarios turísticos que venden',
        'title_accent' => null,
        'category' => 'ia',
        'published' => '2026-10-01',
        'reads' => 2900,
        'featured' => false,
        'author' => 'Mateo Salcedo',
        'role' => 'Producto e IA',
        'keyword' => 'ia para agencias de viaje',
        'excerpt' => 'Plantillas para describir tours, traducir al inglés y portugués y escribir títulos SEO, siempre con revisión humana.',
        'body' => <<<'MD'
## La regla de oro: tú pones los hechos
La inteligencia artificial redacta bien, pero inventa con la misma seguridad. Dale siempre los hechos del tour: horarios, lugares, qué incluye y qué no. Pídele que redacte, no que investigue. Y revisa cada texto antes de publicarlo.
## Para describir un tour
- Redacta una descripción de 120 palabras para este tour, en tono cálido y concreto, usando solo estos datos.
- Convierte este itinerario en una lista día por día con una frase por actividad.
- Escribe tres beneficios del tour pensando en una familia con niños.
- Resume en dos líneas qué hace distinto a este tour frente a uno genérico.
- Escribe la sección «qué llevar» a partir de la altitud y la temporada indicadas.
## Para traducir sin perder el tono
- Traduce al inglés de Estados Unidos manteniendo los nombres de lugares en español.
- Traduce al portugués de Brasil con un tono cercano, sin regionalismos.
- Revisa esta traducción y señala frases que suenen literales.
> Consejo: pide la traducción con los nombres propios sin traducir. «Valle Sagrado» se busca así también en inglés.
## Para posicionar en buscadores
- Propón cinco títulos de menos de 60 caracteres con el destino y la duración.
- Escribe la meta descripción de 150 caracteres con el precio desde.
- Genera seis preguntas frecuentes reales que haría un viajero sobre este tour.
- Sugiere el texto alternativo de estas tres fotos describiendo lo que se ve.
## Para responder consultas
- Redacta una respuesta corta a esta consulta con las fechas disponibles y el precio.
- Propón una alternativa si las fechas pedidas no tienen cupo.
- Escribe un recordatorio amable para una cotización enviada hace dos días.
## En KipuControl
El contenido con IA de KipuControl usa los datos de tu catálogo como fuente y deja cada texto en borrador para que alguien del equipo lo apruebe antes de publicarlo en tu web.
MD,
        'faq' => [],
    ],
    [
        'slug' => 'precios-dinamicos-temporada-alta',
        'title' => 'Precios por temporada sin hojas de cálculo',
        'title_accent' => null,
        'category' => 'finanzas',
        'published' => null,
        'reads' => 0,
        'featured' => false,
        'author' => 'Renzo Quispe',
        'role' => 'Contador tributario',
        'keyword' => 'precios turismo',
        'excerpt' => 'Borrador: cómo definir temporadas, recargos por última hora y descuentos por anticipación sin perder margen.',
        'body' => "## Borrador\nIdeas para el artículo de temporadas: factor por temporada, reglas de última hora y descuento por compra anticipada.",
        'faq' => [],
    ],
];
