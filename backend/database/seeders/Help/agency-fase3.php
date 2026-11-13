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
    ], ['precio', 'dinamico', 'ocupacion', 'simulador']),
    $article('asistente-ia', 'General', '/asistente', 'Asistente con IA', 'Pide al asistente borradores de cotizaciones, respuestas o resúmenes. Nada se aplica sin que lo revises.', [
        ['Hacer un pedido', 'Escribe qué necesitas y elige sobre qué registro trabajar.'],
        ['Aplicar o descartar', 'Revisa el borrador y aplícalo o descártalo. Los datos sensibles del cliente no se envían al asistente.'],
    ], [
        ['¿Tiene límite?', 'Sí, un cupo mensual según tu plan. Lo ves en la misma pantalla.'],
    ], ['ia', 'asistente', 'borrador', 'cupo']),
    $article('marketing-recuperacion', 'Marketing', '/marketing/recuperacion', 'Recuperación de ventas', 'Flujos que escriben al cliente que dejó un carrito o una cotización sin cerrar, para retomar la venta.', [
        ['Crear un flujo', 'Elige qué se recupera, cuánto esperar y qué mensaje enviar.'],
        ['Ver los intentos', 'En «Intentos» revisa a quién se escribió, cuándo y si volvió a comprar.'],
    ], [
        ['¿Se escribe a quien no dio permiso?', 'No. Solo a quien aceptó recibir comunicaciones.'],
    ], ['recuperacion', 'carrito', 'abandono', 'marketing']),
    $article('canales-ota', 'Canales', '/canales/ota', 'Conexión con OTAs', 'Conecta tu catálogo con agencias en línea, relaciona tus productos con los suyos y recibe sus reservas.', [
        ['Conectar', 'Pulsa «Nueva conexión», elige la OTA y escribe su clave. Se guarda cifrada.'],
        ['Relacionar productos', 'En «Mapeos» indica qué producto tuyo corresponde a cada uno de la OTA.'],
        ['Reservas recibidas', 'En «Reservas» revisa lo que llegó desde cada OTA.'],
    ], [
        ['¿Qué pasa si un producto no está relacionado?', 'La reserva que llega se rechaza y queda registrada para que la revises.'],
    ], ['ota', 'canal', 'mapeo', 'reservas externas']),
    $article('canales-marketplace', 'Canales', '/canales/marketplace', 'Marketplace B2B', 'Publica tus tours para que otros operadores los revendan y vende los de tus aliados, con comisión acordada.', [
        ['Publicar', 'En «Mis publicaciones» elige qué productos ofreces y con qué comisión.'],
        ['Alianzas', 'Acepta o rechaza las solicitudes de otros operadores.'],
        ['Ventas', 'En «Ventas» ves los pedidos hechos entre aliados.'],
    ], [
        ['¿Cuándo queda confirmada una venta del marketplace?', 'Por ahora queda como solicitada y se coordina con el aliado.'],
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
        ['Deslindes', 'En «Deslindes» mantén las plantillas que el pasajero firma desde su portal.'],
    ], [
        ['¿Quién puede escanear?', 'El guía o el conductor asignado al servicio.'],
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
        ['Emitir', 'Crea el vale con su monto y vigencia. El código se muestra una sola vez.'],
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
        ['Reservas y asistencia', 'En «Reservas» marca quién asistió.'],
        ['Cargos', 'En «Cargos» ves lo que se cobra por las reservas que superan las gratuitas del mes.'],
    ], [
        ['¿Tiene costo?', 'Hay un número de reservas gratuitas al mes; las siguientes se cobran según tu plan.'],
    ], ['vitrina', 'free tour', 'rutas libres']),
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
    ], ['pixel', 'analytics', 'meta', 'conversiones', 'cookies']),
    $article('canales-aventuras', 'Canales', '/canales/aventuras', 'Blog de aventuras', 'Publica historias de tus viajeros en el sitio, con su consentimiento.', [
        ['Escribir una historia', 'Crea la historia con fotos y el tour relacionado.'],
        ['Pedir consentimiento', 'Envíala al cliente para que la apruebe desde su portal.'],
        ['Publicar', 'Con el consentimiento, publícala. Aparece en la sección «Aventuras de viajeros» del sitio.'],
    ], [
        ['¿Qué pasa si el cliente retira el permiso?', 'La historia se despublica en el momento.'],
    ], ['aventuras', 'historias', 'blog', 'consentimiento']),
    $article('finanzas-pasarelas', 'Finanzas', '/finanzas/pasarelas', 'Pasarelas y comisiones', 'Conecta las pasarelas de pago y revisa cuánto cobra cada una por transacción.', [
        ['Conectar', 'Elige la pasarela y escribe sus credenciales. Se guardan cifradas y no se vuelven a mostrar.'],
        ['Comisiones', 'Revisa la comisión de cada cobro e importa la liquidación de la pasarela.'],
    ], [
        ['¿Puedo comparar pasarelas?', 'Sí, el simulador muestra cuánto recibirías con cada una.'],
    ], ['pasarela', 'comision', 'paypal', 'yape', 'liquidacion']),
    $article('reportes-alertas', 'Inteligencia', '/reportes/alertas', 'Alertas de rentabilidad', 'Avisos diarios sobre cuotas vencidas y cotizaciones con margen bajo, para actuar a tiempo.', [
        ['Revisar', 'Cada alerta indica el registro y por qué apareció.'],
        ['Resolver', 'Cuando la atiendas, márcala como resuelta.'],
    ], [
        ['¿Todos ven las alertas de margen?', 'No. Solo quien puede ver la rentabilidad.'],
    ], ['alertas', 'rentabilidad', 'margen', 'cobranza']),
    $article('reportes-visitas', 'Inteligencia', '/reportes/visitas', 'Visitas del sitio', 'Cuántas personas visitan tu sitio, qué páginas ven, de dónde llegan y desde qué dispositivo. Se mide sin cookies.', [
        ['Elegir el periodo', 'Cambia entre 7, 30 y 90 días.'],
        ['Explorar', 'Revisa la tendencia, las visitas en vivo, las páginas, las fuentes, los dispositivos y los países.'],
        ['Exportar', 'Descarga los datos en CSV.'],
    ], [
        ['¿Coincide con Google Analytics?', 'No exactamente: aquí se cuenta sin cookies, así que suele mostrar algo más de visitas.'],
    ], ['visitas', 'analitica', 'trafico', 'paginas']),
];
