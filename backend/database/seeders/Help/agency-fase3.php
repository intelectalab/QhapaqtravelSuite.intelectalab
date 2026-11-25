<?php

$article = fn (string $slug, string $module, string $screen, string $title, string $summary, array $steps, array $faqs, array $keywords): array => [
    'slug' => $slug,
    'audience' => 'agency',
    'module' => $module,
    'screen' => $screen,
    'title' => $title,
    'summary' => $summary,
    'steps' => array_map(fn (array $step): array => ['title' => $step[0], 'text' => $step[1]], $steps),
    'faqs' => array_map(fn (array $faq): array => ['question' => $faq[0], 'answer' => $faq[1]], $faqs),
    'keywords' => $keywords,
    'roles' => [],
];

return [
    $article('crm-metas-equipos', 'Comercial · CRM', '/crm/metas/equipos', 'Equipos de ventas y política de bonos', 'Arma los equipos de ventas que comparten metas y define cómo se calcula el bono cuando se cumplen.', [
        ['Crear un equipo', 'Pulsa «Nuevo equipo», ponle nombre y elige a sus integrantes y a su líder.'],
        ['Política de bonos', 'En «Política de bonos» define desde qué porcentaje de cumplimiento se paga y cuánto. Guardarla pide permiso de configuración.'],
    ], [
        ['¿Puedo quitar un equipo?', 'Solo si no tiene metas asignadas. Si las tiene, primero reasígnalas.'],
    ], ['metas', 'equipos', 'bonos', 'ranking']),
    $article('crm-cuentas-corporativas', 'Comercial · CRM', '/crm/cuentas-corporativas', 'Cuentas corporativas', 'Gestiona a las empresas que compran viajes a crédito: condiciones, centros de costo, viajeros y quiénes usan su panel en el portal.', [
        ['Dar de alta una cuenta', 'Elige el cliente empresa, los días de crédito y si exige aprobación desde un monto.'],
        ['Centros de costo y viajeros', 'En sus pestañas registra los centros de costo con su presupuesto y los viajeros, uno por uno o desde un archivo CSV o Excel.'],
        ['Usuarios del panel', 'Invita a las personas de la empresa con su rol: administrador, aprobador, pagador o viajero.'],
    ], [
        ['¿Qué ve la empresa en el portal?', 'Sus compras, movimientos, estados de cuenta y aprobaciones, según el rol de cada usuario. Nunca ve costos ni márgenes.'],
        ['¿Puedo suspender una cuenta?', 'Sí. Mientras esté suspendida, el panel corporativo desaparece del portal de esa empresa.'],
    ], ['corporativo', 'empresa', 'centro de costo', 'aprobacion', 'credito']),
    $article('catalogo-importar', 'Catálogo', '/catalogo/importar', 'Importar productos', 'Carga tours desde una página web, un CSV, un PDF o un Excel. El sistema propone los productos y tú los revisas antes de crearlos.', [
        ['Subir el origen', 'Pega la dirección de la página o sube el archivo y pulsa «Analizar».'],
        ['Revisar y confirmar', 'Revisa cada producto propuesto, corrige lo necesario y confirma. Se crean en borrador con la marca «Detectado por IA».'],
    ], [
        ['¿Se publican solos?', 'No. Quedan en borrador hasta que completes la ficha y los actives.'],
    ], ['importar', 'catalogo', 'csv', 'excel', 'ia']),
    $article('catalogo-precios-dinamicos', 'Catálogo', '/catalogo/precios-dinamicos', 'Precios dinámicos', 'Reglas que suben o bajan el precio según la ocupación, la anticipación o el día, siempre dentro de un piso y un techo.', [
        ['Crear una regla', 'Elige el producto o la categoría, la condición, el ajuste y su prioridad.'],
        ['Simular', 'Antes de activarla, usa el simulador para ver el precio resultante en una fecha y con una ocupación dadas.'],
    ], [
        ['¿Pueden dejar un precio por debajo del costo?', 'No. Cada regla respeta el piso y el techo que defines.'],
        ['¿Dónde se aplican?', 'Las reglas del canal «Venta interna» ajustan el precio de la tarifa en el cotizador y en la reserva directa de los canales Directo y Corporativo; las de «Agencias B2B», el neto que ve cada agencia en su portal y la reserva directa del canal B2B; las de «Sitio web», la reserva directa del canal E-commerce. Cotizaciones y reservas guardan el ajuste usado, así que cambiar o apagar una regla no altera lo ya vendido.'],
    ], ['precio', 'dinamico', 'ocupacion', 'simulador']),
    $article('asistente-ia', 'General', '/asistente', 'Asistente con IA', 'Pide al asistente borradores de cotizaciones, respuestas o resúmenes. Nada se aplica sin que lo revises.', [
        ['Hacer un pedido', 'Escribe qué necesitas y elige sobre qué registro trabajar.'],
        ['Desde la cotización, el lead o la bandeja', 'Pulsa «Asistente» en la ficha de la cotización, en la del lead o en la conversación de la bandeja. El panel lateral ya trae los datos del registro (nombre del cliente, pasajeros, fechas, destinos, servicios o los últimos mensajes) y te propone un pedido que puedes cambiar. Correos, teléfonos y notas internas no se envían.'],
        ['Responder en la bandeja', 'En una conversación, «Responder» pega el borrador en la caja de respuesta. Revísalo y envíalo tú: el asistente nunca envía solo.'],
        ['Aplicar o descartar', 'Revisa el borrador y aplícalo o descártalo. Los datos sensibles del cliente no se envían al asistente.'],
        ['Aplicar a una cotización ya enviada', 'Si la cotización está en borrador, el texto se agrega a la versión vigente. Si ya la enviaste, aplicar crea una versión nueva en borrador y pide confirmar: el cliente sigue viendo la versión anterior hasta que envíes la nueva. Si el cliente ya la aprobó o hay una aprobación interna pendiente, el aviso sale en rojo y pide un segundo clic porque esa aprobación se anula. Una cotización convertida en reserva no cambia.'],
    ], [
        ['¿Tiene límite?', 'Sí, un cupo mensual según tu plan. Lo ves en la misma pantalla.'],
    ], ['ia', 'asistente', 'borrador', 'cupo', 'panel', 'bandeja', 'responder']),
    $article('marketing-recuperacion', 'Marketing', '/marketing/recuperacion', 'Recuperación de ventas', 'Flujos que escriben al cliente que dejó un carrito o una cotización sin cerrar, para retomar la venta.', [
        ['Crear un flujo', 'Elige qué se recupera, cuánto esperar y qué mensaje enviar.'],
        ['Cómo sale', 'Cada 15 minutos el sistema busca carritos sin actividad y cotizaciones enviadas sin respuesta que ya cumplieron la espera, y escribe al cliente. Entre un intento y el siguiente deja la misma espera, hasta el máximo de intentos del flujo.'],
        ['Ver los intentos', 'En «Intentos» revisa a quién se escribió, cuándo y si volvió a comprar. Si el cliente compra después del mensaje, el intento queda «Recuperado» con la reserva y su importe.'],
    ], [
        ['¿Se escribe a quien no dio permiso?', 'No. Solo a quien aceptó recibir comunicaciones por ese canal; si no, el intento queda «Descartado».'],
        ['¿Qué enlace recibe el cliente?', 'En una cotización, el enlace de su propuesta para revisarla y aprobarla; en un carrito, el carrito del sitio de la agencia.'],
    ], ['recuperacion', 'carrito', 'abandono', 'marketing']),
    $article('canales-ota', 'Canales', '/canales/ota', 'Conexión con OTAs', 'Conecta tu catálogo con agencias en línea, relaciona tus productos con los suyos y recibe sus reservas.', [
        ['Conectar', 'Pulsa «Conectar OTA», elige la OTA y escribe su clave. Se guarda cifrada.'],
        ['Relacionar productos', 'En «Mapeos» indica qué producto tuyo corresponde a cada uno de la OTA.'],
        ['Reservas recibidas', 'En «Reservas recibidas» revisa lo que llegó desde cada OTA. Si tiene cupo y datos del viajero, se convierte sola en una reserva confirmada.'],
        ['Convertir a mano', 'Si una reserva quedó «Recibida» porque faltaba el cliente, pulsa «Convertir», elige el cliente de tu cartera y confirma.'],
    ], [
        ['¿Qué pasa si un producto no está relacionado?', 'La reserva que llega se rechaza y queda registrada para que la revises.'],
        ['¿Por cuánto se registra la reserva?', 'Por el neto que te paga la OTA: la venta menos su comisión. Los tres montos se ven al convertirla y quedan en la reserva.'],
        ['¿Y si ya no hay cupo?', 'La reserva queda «Rechazada» con el motivo y no se crea nada. Si la OTA la cancela después de confirmada, la reserva se cancela con su política.'],
    ], ['ota', 'canal', 'mapeo', 'reservas externas', 'convertir']),
    $article('canales-marketplace', 'Canales', '/canales/marketplace', 'Marketplace B2B', 'Publica tus tours para que otros operadores los revendan y vende los de tus aliados, con comisión acordada.', [
        ['Publicar', 'En «Mis publicaciones» elige qué productos ofreces y con qué comisión.'],
        ['Alianzas', 'Acepta o rechaza las solicitudes de otros operadores.'],
        ['Vender', 'En «Red de operadores», con la alianza activa, pulsa «Vender», elige a tu cliente, la fecha y los pasajeros.'],
        ['Ventas', 'En «Ventas y compras» ves cada venta entre aliados con su estado y el código de tu reserva.'],
    ], [
        ['¿Cuándo queda confirmada una venta del marketplace?', 'Al momento, si el operador tiene cupo para esa fecha. Se crea su reserva con tu agencia como cliente y, en tu agencia, la reserva de tu cliente al precio que le vendiste.'],
        ['¿Qué pasa si no hay cupo?', 'La venta queda rechazada y no se crea ninguna reserva. Prueba con otra fecha o menos pasajeros.'],
        ['¿Cuánto cobra el operador?', 'El monto de la venta menos tu comisión. Ese neto queda como costo en tu reserva y como cobro en la del operador.'],
    ], ['marketplace', 'b2b', 'aliados', 'comision']),
    $article('admin-whatsapp', 'Administración', '/admin/whatsapp', 'WhatsApp de la agencia', 'Configura el número de WhatsApp y las plantillas de mensaje que se usan para escribir a los clientes.', [
        ['Número', 'Registra el número de la agencia. Mientras no se conecte el proveedor, funciona en modo de prueba.'],
        ['Plantillas', 'Crea las plantillas y envíalas a revisión. Solo las aprobadas se pueden usar.'],
    ], [
        ['¿Puedo escribir a cualquier cliente?', 'Solo con una plantilla aprobada y si el cliente aceptó recibir mensajes.'],
    ], ['whatsapp', 'plantilla', 'mensajes']),
    $article('operaciones-checkin', 'Operaciones', '/operaciones/checkin', 'Check-in con QR', 'Registra la llegada de cada pasajero leyendo el código QR de su pase, y gestiona los deslindes que deben firmar.', [
        ['Servicios del día', 'Elige el servicio y abre su manifiesto.'],
        ['Escanear', 'Lee el QR del pase. Cada pase sirve una sola vez y solo el día del servicio.'],
        ['Desde la app del operador', 'Con el servicio en curso, toca «Escanear pase QR» y apunta la cámara al pase del pasajero. Su ingreso queda marcado en la lista de pasajeros. Necesitas conexión para validar el pase.'],
        ['Deslindes', 'En «Deslindes» mantén las plantillas que el pasajero firma desde su portal.'],
    ], [
        ['¿Quién puede escanear?', 'El guía o el conductor asignado al servicio.'],
        ['¿Qué pasa si el pase es de otro servicio?', 'La app avisa que no pertenece al servicio que estás registrando y el pase sigue sin usar.'],
        ['¿Y si falta la firma del deslinde?', 'Si el servicio exige deslinde, el pasajero no puede ingresar sin firmarlo.'],
    ], ['check-in', 'qr', 'manifiesto', 'deslinde']),
    $article('finanzas-estados-cuenta-corporativos', 'Finanzas', '/finanzas/estados-cuenta-corporativos', 'Estados de cuenta corporativos', 'Genera, envía y anula los estados de cuenta mensuales de las empresas con crédito.', [
        ['Generar', 'Elige la cuenta y el mes. El sistema arma el saldo inicial, compras, pagos, notas de crédito y saldo final.'],
        ['Enviar o descargar', 'Envíalo por correo a los destinatarios de la empresa o descarga el PDF.'],
    ], [
        ['¿Puedo generar dos veces el mismo mes?', 'No. Si necesitas corregirlo, anúlalo y vuelve a generarlo.'],
    ], ['estado de cuenta', 'corporativo', 'credito', 'pdf']),
    $article('finanzas-links-de-pago', 'Finanzas', '/finanzas/links-de-pago', 'Links de pago', 'Crea un enlace seguro para que el cliente pague una cuota o una reserva en línea.', [
        ['Crear', 'Elige la cuota o la reserva, el monto y la vigencia.'],
        ['Enviar', 'Envíalo por correo o WhatsApp, o copia el enlace.'],
        ['Seguimiento', 'Cuando el cliente paga, el cobro se registra y se aplica solo.'],
    ], [
        ['¿Puedo cancelar un link?', 'Sí, mientras no esté pagado.'],
    ], ['link de pago', 'cobro', 'pago en linea']),
    $article('finanzas-vales', 'Finanzas', '/finanzas/vales', 'Vales de regalo', 'Vende y administra vales de regalo que el cliente usa para pagar sus viajes.', [
        ['Emitir', 'Crea el vale con su monto y vigencia. El código se muestra una sola vez. Si eliges «Enviar el», el correo con el código sale ese día a las 8:00; mientras tanto el código queda guardado cifrado.'],
        ['Canjear o anular', 'Desde el detalle registra un canje o anula el vale.'],
    ], [
        ['¿Se pueden comprar en el sitio?', 'Sí, en la página de regalos del sitio, pagando con tarjeta.'],
    ], ['vale', 'gift card', 'regalo', 'canje']),
    $article('finanzas-exportacion-contable', 'Finanzas', '/finanzas/exportacion-contable', 'Exportación contable', 'Genera el archivo para tu sistema contable con las ventas, cobros y pagos del periodo.', [
        ['Plan de cuentas', 'En «Plan de cuentas» relaciona cada concepto con su cuenta contable.'],
        ['Exportar', 'Elige el sistema de destino y el periodo, y descarga el archivo.'],
    ], [
        ['¿Por qué no me deja exportar?', 'Falta relacionar alguna cuenta. El aviso dice cuál.'],
    ], ['contabilidad', 'exportar', 'plan de cuentas']),
    $article('canales-vitrina', 'Canales', '/canales/vitrina', 'Vitrina Rutas Libres', 'Publica tus free tours en la vitrina de la plataforma y recibe reservas con nombre y correo.', [
        ['Publicar', 'En «Publicaciones» crea la publicación con horarios y punto de encuentro.'],
        ['Reservas y asistencia', 'En «Reservas» marca quién asistió. El día anterior a cada salida, a las 18:00, el viajero recibe un correo con la hora, el punto de encuentro y el enlace para cancelar.'],
        ['Cargos', 'En «Cargos y comisiones» ves por mes los cargos por asistente que superan las reservas gratuitas y las comisiones de tus tours de pago.'],
        ['Factura del mes', 'El día 1 KipuControl factura los cargos del mes anterior a tu suscripción. La columna «Factura» muestra el número y si está por pagar o pagada; el mes en curso aún no se factura.'],
    ], [
        ['¿Tiene costo?', 'Hay un número de reservas gratuitas al mes; las siguientes se cobran según tu plan.'],
        ['¿Qué pasa si marco no-show después de la factura?', 'El cargo ya facturado se mantiene. Marca la asistencia antes de fin de mes para que un no-show no se cobre.'],
    ], ['vitrina', 'free tour', 'rutas libres', 'factura', 'comisión']),
    $article('canales-seo', 'Canales', '/canales/seo', 'Dominio y SEO', 'Conecta tu propio dominio con SSL y mejora cómo aparece tu sitio en Google.', [
        ['Dominio propio', 'Agrega el dominio y copia en tu proveedor los registros TXT y CNAME que se indican. Luego pulsa «Verificar».'],
        ['Auditoría y redirecciones', 'Revisa la auditoría de cada página y crea redirecciones cuando cambies una dirección.'],
    ], [
        ['¿Por qué rechaza una redirección?', 'Porque formaría una cadena de redirecciones. Apunta directo a la dirección final.'],
    ], ['dominio', 'ssl', 'seo', 'redireccion', 'sitemap']),
    $article('canales-seguimiento', 'Canales', '/canales/seguimiento', 'Seguimiento y píxeles', 'Conecta Google Analytics, Meta y otros proveedores para medir tus campañas, respetando el consentimiento de cookies.', [
        ['Agregar una etiqueta', 'Elige el proveedor y escribe su identificador. Las estándar se activan al guardar.'],
        ['Conversiones', 'Indica qué eventos se envían a cada proveedor: compra, pedido de viaje, contacto.'],
        ['Scripts propios', 'Un script propio pasa por revisión antes de cargarse en el sitio.'],
    ], [
        ['¿Se cargan sin permiso del visitante?', 'No. Las de marketing esperan el consentimiento, y en el pago no se carga ninguna.'],
        ['¿Cuánto tarda en verse un cambio?', 'Menos de un minuto. Crear, editar, pausar o borrar una etiqueta queda en la auditoría con cómo estaba antes y después.'],
        ['¿Qué proveedores tengo en mi plan?', 'Starter usa Google Analytics 4, Google Tag Manager y Meta Pixel desde el navegador. Google Ads, TikTok, LinkedIn, Clarity, scripts propios y el envío desde el servidor piden Professional, Enterprise o el complemento Marketing Pro (S/ 39 al mes + IGV, en Suscripción y uso).'],
    ], ['pixel', 'analytics', 'meta', 'conversiones', 'cookies', 'marketing pro']),
    $article('canales-aventuras', 'Canales', '/canales/aventuras', 'Blog de aventuras', 'Publica historias de tus viajeros en el sitio, con su consentimiento.', [
        ['Escribir una historia', 'Crea la historia con fotos y el tour relacionado.'],
        ['Pedir consentimiento', 'Envíala al cliente para que la apruebe desde su portal.'],
        ['Publicar', 'Con el consentimiento, publícala. Aparece en la sección «Aventuras de viajeros» del sitio.'],
    ], [
        ['¿Qué pasa si el cliente retira el permiso?', 'La historia se despublica en el momento.'],
    ], ['aventuras', 'historias', 'blog', 'consentimiento']),
    $article('finanzas-pasarelas', 'Finanzas', '/finanzas/pasarelas', 'Pasarelas y comisiones', 'Conecta tu cuenta de Izipay, Culqi, Niubiz o Mercado Pago para cobrar con tarjeta, y revisa cuánto cobra cada pasarela por transacción.', [
        ['Conectar', '«Conectar pasarela», elige Izipay, Culqi, Niubiz o Mercado Pago y escribe las credenciales que te dio la pasarela. Empieza en modo Pruebas con las credenciales de prueba; cuando todo funcione, cambia a Producción con las de producción. Se guardan cifradas y no se vuelven a mostrar.'],
        ['Probar la conexión', 'Al guardar las credenciales probamos la conexión. Puedes repetirla con «Probar conexión»: si falla, la tarjeta dice por qué, por ejemplo una llave de otro modo.'],
        ['Avisos de la pasarela', 'Copia la «URL de notificaciones» de la tarjeta y pégala en el panel de tu pasarela (en Mercado Pago copia también la clave secreta que te da). Así confirmamos los pagos aunque el cliente cierre el navegador. Niubiz no la necesita.'],
        ['Activar', 'Deja la cuenta en estado Activa. Desde ese momento, las tarjetas del sitio, los links de pago, el portal del cliente, los vales de regalo y la venta en ruta se cobran por esa cuenta.'],
        ['Comisiones', 'Revisa la comisión de cada cobro e importa la liquidación de la pasarela.'],
    ], [
        ['¿Qué credenciales pide cada pasarela?', 'Izipay: usuario (ID de tienda), contraseña, clave pública JavaScript y clave HMAC-SHA-256. Culqi: llave pública y llave secreta. Niubiz: código de comercio, usuario y contraseña de la API. Mercado Pago: Public Key, Access Token y la clave secreta de webhooks.'],
        ['¿Los datos de la tarjeta pasan por KipuControl?', 'No. El cliente los escribe en el formulario seguro de la pasarela y a nosotros solo nos llega una referencia del cobro y los últimos 4 dígitos.'],
        ['¿Se nota el modo Pruebas en el sitio?', 'Sí. El formulario de pago avisa que la pasarela está en modo prueba y que no se cobra dinero real.'],
        ['¿Puedo comparar pasarelas?', 'Sí, el simulador muestra cuánto recibirías con cada una.'],
    ], ['pasarela', 'comision', 'izipay', 'culqi', 'niubiz', 'mercado pago', 'tarjeta', 'credenciales', 'webhook', 'paypal', 'yape', 'liquidacion']),
    $article('reportes-alertas', 'Inteligencia', '/reportes/alertas', 'Alertas de rentabilidad', 'Avisos diarios sobre cobranza, márgenes, proveedores, metas y demanda, para actuar a tiempo.', [
        ['Revisar', 'Cada alerta indica el registro, por qué apareció y una acción sugerida. El título lleva a la cotización, el servicio, la meta o el producto.'],
        ['Filtrar', 'Elige un tipo: cobranza atrasada, margen bajo, proveedor caro, meta en riesgo o demanda alta.'],
        ['Resolver', 'Cuando la atiendas, márcala como resuelta, o descártala si no aplica. No vuelve a aparecer en 30 días.'],
    ], [
        ['¿Cuándo sale cada alerta?', 'Cobranza atrasada: cuotas vencidas con saldo. Margen bajo: cotizaciones abiertas bajo el margen mínimo de Configuración › Políticas. Proveedor caro: un servicio que cuesta más de 15 % sobre el de otro proveedor del mismo tipo, unidad, moneda y ciudad (en hoteles, también con las mismas estrellas). Meta en riesgo: una meta vigente que, sumando las oportunidades que cierran en el periodo, no proyecta llegar al 100 %. Demanda alta: salidas de los próximos 60 días con 85 % de cupos vendidos o más, y productos cotizados 5 veces o más en 7 días.'],
        ['¿Qué la hace de severidad alta?', 'Cobranza con más de 15 días o un saldo de más de 3 000 en su moneda, márgenes bajo el 5 %, servicios 40 % más caros que la alternativa, metas que proyectan menos del 80 % y salidas agotadas.'],
        ['¿Todos ven las alertas de margen y de proveedores?', 'No. Solo quien puede ver la rentabilidad.'],
    ], ['alertas', 'rentabilidad', 'margen', 'cobranza', 'proveedor', 'meta', 'demanda']),
    $article('reportes-visitas', 'Inteligencia', '/reportes/visitas', 'Visitas del sitio', 'Cuántas personas visitan tu sitio, qué páginas ven, de dónde llegan y desde qué dispositivo. Se mide sin cookies.', [
        ['Elegir el periodo', 'Cambia entre 7, 30 y 90 días.'],
        ['Explorar', 'Revisa la tendencia, las visitas en vivo, las páginas, las fuentes, los dispositivos y los países.'],
        ['Exportar', 'Descarga los datos en CSV desde Professional o con Marketing Pro.'],
    ], [
        ['¿Coincide con Google Analytics?', 'No exactamente: aquí se cuenta sin cookies, así que suele mostrar algo más de visitas.'],
        ['¿Cada cuánto se actualizan las cifras?', 'Cada hora para el día de hoy, y a las 03:00 se cierra el día anterior. Las visitas en vivo muestran los últimos 30 minutos al instante.'],
        ['¿Cuánto historial veo?', 'En Starter, los últimos 30 días sin exportación. En Professional, Enterprise o con Marketing Pro, 13 meses con exportación en CSV.'],
    ], ['visitas', 'analitica', 'trafico', 'paginas', 'marketing pro']),
];
