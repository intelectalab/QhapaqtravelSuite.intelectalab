import type { LegalText } from "./LegalDocument";

export const TERMS: LegalText = {
  title: "Términos del servicio",
  summary: "Las condiciones para usar KipuControl, el software de gestión para agencias de viaje y operadores turísticos.",
  version: "0.9 provisional",
  updated: "25 de noviembre de 2026",
  sections: [
    {
      title: "Quiénes somos",
      paragraphs: ["KipuControl es un servicio de software en la nube que ofrece KipuControl Cloud S.A.C. a agencias de viaje, operadores turísticos y empresas del sector. Al crear una cuenta o usar el servicio aceptas estos términos en nombre de tu empresa."],
    },
    {
      title: "La cuenta de tu agencia",
      items: [
        "Quien crea la cuenta declara que puede obligar a la empresa y que los datos que registra son verdaderos.",
        "Cada usuario es personal. Tu agencia decide quién entra, con qué rol y con qué permisos.",
        "Tu agencia cuida sus contraseñas y la verificación en dos pasos. Si sospechas un acceso indebido, avísanos de inmediato.",
      ],
    },
    {
      title: "Planes, prueba y pagos",
      items: [
        "Los precios de cada plan se publican en la página de planes, en soles y sin IGV. El IGV se agrega al facturar.",
        "La prueba gratuita dura los días que indica el plan y no pide tarjeta. Al terminar, la cuenta pasa al plan elegido si registraste un medio de pago.",
        "La suscripción se renueva al final de cada periodo, mensual o anual, hasta que la canceles desde Administración.",
        "Si un pago no se puede cobrar, te avisamos y la cuenta puede pasar a solo lectura hasta regularizarlo.",
      ],
    },
    {
      title: "Tus datos son tuyos",
      paragraphs: [
        "La información que tu agencia registra en KipuControl, como clientes, cotizaciones, reservas y comprobantes, pertenece a tu agencia. La usamos solo para prestarte el servicio, darte soporte y mejorar el producto con datos agregados que no identifican a nadie.",
        "Puedes exportar tus datos mientras la cuenta esté activa y durante los 30 días siguientes a su cancelación. Después de ese plazo los eliminamos, salvo lo que la ley nos obligue a conservar.",
      ],
    },
    {
      title: "Uso aceptable",
      items: [
        "No uses KipuControl para enviar mensajes no solicitados ni para tratar datos sin el consentimiento que exige la ley.",
        "No intentes acceder a la información de otras agencias ni vulnerar la seguridad del servicio.",
        "Las integraciones con terceros, como pasarelas de pago, facturación electrónica o WhatsApp, se rigen también por las condiciones de cada proveedor.",
      ],
    },
    {
      title: "Disponibilidad y soporte",
      paragraphs: ["Trabajamos para que el servicio esté disponible todo el tiempo y avisamos con anticipación los mantenimientos programados. El soporte se presta por los canales y en el horario que indica cada plan."],
    },
    {
      title: "Responsabilidad",
      paragraphs: ["KipuControl es una herramienta de gestión. Las decisiones comerciales, tributarias y operativas de tu agencia, como precios, comprobantes emitidos o servicios contratados, son responsabilidad de tu agencia."],
    },
    {
      title: "Cambios en estos términos",
      paragraphs: ["Si cambiamos estos términos te avisaremos por correo y en el sistema con al menos 15 días de anticipación. Si no estás de acuerdo, puedes cancelar la suscripción antes de que el cambio entre en vigencia."],
    },
    {
      title: "Ley aplicable y contacto",
      paragraphs: ["Estos términos se rigen por las leyes de la República del Perú. Para cualquier consulta escríbenos desde la página de contacto."],
    },
  ],
};

export const PRIVACY: LegalText = {
  title: "Política de privacidad",
  summary: "Cómo tratamos los datos personales de quienes visitan este sitio, se suscriben al boletín, comentan en el blog o crean una cuenta, según la Ley 29733.",
  version: "0.9 provisional",
  updated: "25 de noviembre de 2026",
  sections: [
    {
      title: "Responsable del tratamiento",
      paragraphs: ["El responsable de los datos que se recogen en este sitio es KipuControl Cloud S.A.C. Tratamos los datos según la Ley 29733, Ley de Protección de Datos Personales, y su reglamento."],
    },
    {
      title: "Qué datos recogemos",
      items: [
        "Alta de una cuenta: nombre de la empresa, RUC, nombre y correo de quien la crea, teléfono y datos de facturación.",
        "Boletín: tu correo, la página desde donde te suscribiste y la fecha en que confirmaste.",
        "Comentarios del blog: tu nombre, que se publica, y tu correo, que no se publica y solo ve el equipo de moderación.",
        "Solicitudes de demo o contacto: los datos que escribes en el formulario.",
        "Uso del sitio: medimos visitas de forma agregada. Para limitar abusos guardamos una huella cifrada de tu dirección IP que cambia cada día.",
      ],
    },
    {
      title: "Para qué los usamos",
      items: [
        "Crear y administrar la cuenta de tu agencia y emitir los comprobantes de la suscripción.",
        "Enviarte el boletín, solo si confirmaste la suscripción.",
        "Publicar y moderar los comentarios del blog y responder tus consultas.",
        "Proteger el sitio contra el spam y el uso indebido.",
      ],
    },
    {
      title: "Con quién los compartimos",
      paragraphs: ["No vendemos datos personales. Los compartimos solo con los proveedores que nos ayudan a prestar el servicio, como alojamiento en la nube, envío de correos o facturación electrónica, y cuando una autoridad lo exige conforme a ley."],
    },
    {
      title: "Cuánto tiempo los conservamos",
      items: [
        "Boletín: hasta que te des de baja. La baja se aplica en un clic desde cualquier correo.",
        "Comentarios: mientras el artículo esté publicado o hasta que pidas retirarlos.",
        "Cuenta de la agencia: mientras la suscripción esté activa y el plazo que exijan las normas tributarias.",
      ],
    },
    {
      title: "Tus derechos",
      paragraphs: ["Puedes pedir acceso, rectificación, cancelación u oposición al tratamiento de tus datos (derechos ARCO) escribiéndonos desde la página de contacto. Responderemos en los plazos que fija la ley. Si no estás conforme con la respuesta, puedes acudir a la Autoridad Nacional de Protección de Datos Personales."],
    },
    {
      title: "Seguridad",
      paragraphs: ["Cifrado de los datos en tránsito y de los datos sensibles en reposo, accesos por rol, verificación en dos pasos y registro de auditoría de las acciones críticas."],
    },
    {
      title: "Cambios en esta política",
      paragraphs: ["Publicaremos aquí cualquier cambio con su fecha. Si el cambio afecta cómo usamos tus datos, te avisaremos por correo."],
    },
  ],
};
