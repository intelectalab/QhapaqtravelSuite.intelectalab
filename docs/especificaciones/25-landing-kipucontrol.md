# Landing de KipuControl: suscripciones, blog compartido, comentarios, popups y chatbot (v2.12)

Este módulo es nuevo en la v2.12. Define el sitio comercial **kipucontrol.com**, donde una agencia conoce el producto, compara planes y se suscribe sola. **Rutas Libres** (`rutaslibres.pe`, spec 22) sigue siendo la puerta de entrada gratuita: la agencia publica sus free tours sin costo y, cuando quiere más, pasa a un plan desde esta landing con sus datos.

La landing tiene:

1. **Páginas comerciales:** inicio con producto, módulos, testimonios y preguntas frecuentes, y **planes y precios** con comparativo, calculadora de ahorro y conmutadores mensual o anual y soles o dólares.
2. **Suscripción en 3 pasos:**
   - cuenta y agencia (con Google Workspace);
   - plan, add-ons y cupón;
   - pago con tarjeta, Yape o Plin, o PayPal, con factura o boleta.
   La **prueba de 14 días** no pide tarjeta. Al terminar hay una bienvenida con los primeros pasos.
3. **Blog compartido** de KipuControl y Rutas Libres en el mismo Payload CMS (spec 24), con filtro por sitio y categoría, búsqueda y orden. Los artículos tienen índice, tablas, maquetas del producto, preguntas frecuentes y **comentarios moderados**.
4. **Captación:**
   - popup al salir;
   - boletín al 60 % del artículo;
   - **chatbot «Kipu»** con respuestas del producto, captura de correo y paso a una persona por WhatsApp.
5. **SEO para buscadores y para IA:** metadatos, datos estructurados, sitemaps, `llms.txt` y páginas que se leen sin JavaScript.

- Fase del plan: **3 · SaaS y crecimiento** (épica E3.22).
- Sin permisos nuevos de KipuControl: la moderación la hacen el Super Admin y las cuentas de Payload.
- Diseño: sistema «Andean Operations Modernity» que el equipo hizo en Stitch (`kit/design/kipucontrol/DESIGN.md`).

Prototipo:
- Landing:
  - `#/web` (inicio) y `#/web/precios`;
  - `#/web/suscribirse/<plan>/<mensual|anual|prueba>` y `#/web/bienvenido/<id>`;
  - `#/web/blog` y `#/web/blog/<slug>`. Un artículo de Rutas Libres abre en `#/vitrina/blog/<slug>`.
- Plataforma (U16): `#/admin/marketing-vitrina/landing`, con comentarios por moderar, suscripciones desde la landing, popups y chatbot.

## 0. Decisión y referencias

| Opción evaluada | Resultado |
|---|---|
| Landing en WordPress o Webflow | Se descartó. Sería un tercer stack y el checkout tendría que salir del sitio para crear la cuenta. |
| Landing dentro del back-office (Laravel Blade) | Se descartó. Mezcla tráfico público con la app y complica el SEO y el diseño. |
| **App Next.js `apps/landing` + el mismo Payload de la vitrina** | **Elegida.** Es el mismo stack y el mismo despliegue que Rutas Libres. Payload sirve los dos blogs con el campo `site`, y el alta llama a la API pública de KipuControl. |
| Comentarios con Disqus o Facebook | Se descartó: suma scripts de terceros y anuncios, y los datos quedan fuera. Los comentarios son una colección de Payload. |
| Chatbot de terceros (Intercom, Tidio) | Se descartó para la v1. «Kipu» usa el asistente IA de la spec 19 con las páginas y preguntas frecuentes de la landing como fuente. |

Referencias de producto:
- sell-saas.com, para la estructura de una landing de SaaS: producto, prueba gratis, precios y blog.
- Stripe Checkout y Paddle, para el alta en pocos pasos con resumen fijo.
- Culqi, Niubiz e Izipay con campos alojados: los datos de la tarjeta no pasan por nuestros servidores (PCI DSS SAQ A).
- Google Search Central (datos estructurados `SoftwareApplication`, `Offer` y `FAQPage`) y la propuesta `llms.txt`.

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-001 Alta de tenant (spec 13) | Alta sin intervención desde la landing: tenant, usuario administrador y suscripción en `trialing` o `active` |
| PROC-090 Plataforma SaaS (spec 13) | Planes, add-ons, cupones, cobro del primer periodo y comprobante de la plataforma |
| PROC-055 CMS (spec 24) | Blog compartido en Payload, comentarios y SEO |
| PROC-050 Marketing (specs 14 y 24) | Popups, boletín, chatbot, leads y conversiones `plan_pagado` y `suscripcion_boletin` |

## 2. Pantallas

| Ruta Next.js (`apps/landing`) | Qué hace | Roles con acceso |
|---|---|---|
| `/` | Inicio: anuncio, hero con maqueta del panel, logos, módulos, 5 bloques del producto, banda de Rutas Libres, planes, testimonios, blog, preguntas frecuentes y llamada final | Público |
| `/precios` | Planes con conmutadores de ciclo y moneda, comparativo completo, calculadora de ahorro y preguntas de facturación | Público |
| `/suscribirse/[plan]/[ciclo]` | Alta en 3 pasos con resumen fijo (subtotal, cupón, IGV 18 % y total). `ciclo` puede ser `mensual`, `anual` o `prueba` | Público |
| `/bienvenido/[token]` | Confirmación, comprobante y lista de primeros pasos con avance | Quien se suscribió (token firmado) |
| `/blog`, `/blog/categoria/[cat]`, `/blog/[slug]` | Blog con filtro por sitio y categoría, búsqueda, orden, artículo destacado, artículo con índice y comentarios | Público |
| `/legal/*` | Términos, privacidad (Ley 29733), cookies y libro de reclamaciones de la plataforma | Público |
| `(payload)/admin` › Comentarios, Suscriptores, Popups y Leads | Moderación y configuración | Cuentas de Payload `admin`, `editor` y `moderador` |
| `(plataforma)/marketing-vitrina` › Landing | Resumen para el Super Admin: altas, MRR nuevo, comentarios por revisar, popups y chatbot | Super Admin |

## 3. Modelo de datos

**Sin tablas nuevas en PostgreSQL de KipuControl.** El alta usa las tablas de la spec 13: `tenants`, `users`, `subscriptions`, `subscription_items`, `coupons`, `coupon_redemptions`, `platform_invoices` y `platform_invoice_lines`. La atribución (UTM, `gclid` y `fbclid`) va a `platform_conversion_dispatches` de la spec 24, con el evento `plan_pagado`.

Lo que es contenido o captación vive en la base de datos de Payload, que está separada. Son colecciones nuevas:

| Colección | Campos principales | Notas |
|---|---|---|
| `posts` (ampliada) | `site` (`kipucontrol` o `rutaslibres`), `categories`, `allowComments`, `productMock` (bloque) | Un solo Payload para los dos blogs. Cada sitio filtra por `site` |
| `categories` (ampliada) | `site` | Las categorías de KipuControl son ventas, marketing y SEO, operaciones, finanzas e IA para turismo |
| `comments` | `post`, `parent` (una respuesta como máximo de profundidad), `name`, `emailHash`, `email` (solo moderación), `body` (10 a 1500 caracteres), `status` (`pendiente`, `aprobado`, `rechazado`, `spam`), `useful`, `staff`, `ipHash`, `userAgent`, `consentAt` | El correo no se publica. `ipHash` es SHA-256 con sal diaria |
| `subscribers` | `email`, `site`, `source` (`popup_salida`, `scroll_60`, `pie`, `chatbot`), `status` (`pendiente`, `confirmado`, `baja`), `confirmedAt`, `consentText` | Doble confirmación |
| `popups` | `name`, `trigger` (`salida`, `scroll_60`, `tiempo_30s`), `pages`, `freqDays`, `status`, `offer`, `views`, `conversions` | Nunca en `/suscribirse/*` |
| `leads` | `email`, `name`, `intent` (`ventas`, `demo`, `prueba`), `source`, `utm`, `chatTranscript`, `tenantId` | Al convertirse se enlaza con el tenant |
| `chat-sessions` | `visitorHash`, `messages[]`, `handoff`, `leadId`, `rating` | Se guardan 90 días |

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Alta desde la landing | `iniciada → cuenta_creada → pago_pendiente → pagada` · `cuenta_creada → prueba` (sin tarjeta) · `pago_pendiente → fallida` (rechazo; puede reintentar) · `cuenta_creada / pago_pendiente → abandonada` (a las 24 h) |
| Suscripción (spec 13) | La prueba entra en `trialing`. El pago confirmado la pasa a `active` |
| Comentario | `pendiente → aprobado / rechazado / spam` · `aprobado → rechazado` (retirar) · `spam → pendiente` (falso positivo) |
| Suscriptor del boletín | `pendiente → confirmado → baja` |
| Popup | `borrador → activo ↔ pausado` |

## 5. Reglas de negocio

### 5.1 Modelo comercial (valores del prototipo, a validar)

| Concepto | Regla |
|---|---|
| Planes | Vitrina gratis S/ 0, Starter S/ 490, Professional S/ 1,190 y Enterprise S/ 2,890 al mes, sin IGV (catálogo `plans` de la spec 13) |
| Anual | Se pagan 10 meses por 12 («2 meses gratis») |
| Moneda | Precios en soles; en dólares se muestran con el tipo de cambio del día (S/ 3.78 en el prototipo) y se cobran en soles, salvo PayPal |
| Prueba | 14 días de Professional sin tarjeta. Cupón de bienvenida `KIPUTURISMO2026`: 10 % en el primer periodo |
| Enterprise | No tiene alta directa: el botón abre el chatbot o el formulario de ventas |

### 5.2 Reglas

| ID | Regla | Dónde |
|---|---|---|
| LND-01 | Los precios, add-ons y límites de la landing se leen de `GET /api/v1/public/plans`, la misma fuente que el back-office (spec 13). No se escriben a mano en el sitio | ISR + webhook `PlansChanged` |
| LND-02 | Total del alta: subtotal (plan × meses + add-ons) − cupón (solo sobre el plan) = neto; IGV 18 % sobre el neto; total = neto + IGV. El servidor recalcula y rechaza si cambia (422 `SIGNUP_TOTAL_CHANGED`) | `SignupService` |
| LND-03 | El correo no puede pertenecer a otro tenant (409 `SIGNUP_EMAIL_TAKEN`, con enlace a «Iniciar sesión»). La contraseña tiene 10 caracteres o más y no figura en listas de contraseñas filtradas | FormRequest |
| LND-04 | Factura: RUC de 11 dígitos que empieza en 10 o 20, válido en el padrón de SUNAT y activo (422 `RUC_INVALID`). Boleta: DNI de 8 dígitos o carné de extranjería | FormRequest + `RucLookup` |
| LND-05 | **Los datos de la tarjeta nunca pasan por KipuControl.** Se capturan en los campos alojados de la pasarela, que devuelve un token. En la página de pago no cargan etiquetas de terceros ni scripts propios (SEG-05) | Next.js + CSP |
| LND-06 | Yape o Plin: se genera una orden con QR o código con vigencia de 10 minutos. La bienvenida espera la confirmación del webhook de la pasarela. Si vence, el alta queda `pago_pendiente` y se puede reintentar | Webhook |
| LND-07 | El cupón cumple SUB-BR-07 (activo, vigente, con canjes y para ese plan). Se valida en vivo y se vuelve a validar con bloqueo al pagar | `CouponService` |
| LND-08 | La prueba crea la suscripción en `trialing`, sin método de pago, y sigue los avisos y la suspensión de la spec 13. Un mismo RUC o dominio de correo tiene una sola prueba cada 12 meses | `SignupService` |
| LND-09 | Alta abandonada: a la 1 h y a las 24 h se envía un correo para retomar, con el plan y el cupón guardados. Se envía solo con consentimiento de comunicaciones | Job `SignupRecovery` |
| LND-10 | Si la agencia ya publica en Rutas Libres, el alta reutiliza su tenant de vitrina y conserva tours, reservas y reseñas (spec 22). Su plan cambia de «Vitrina gratis» al elegido | `SignupService` |
| LND-11 | Comentarios: campo trampa invisible, 3 comentarios por hora por IP y 2 enlaces o más → `spam`. El primer comentario de un correo queda `pendiente`; después, si el correo tiene un comentario aprobado, se publica solo. Se aceptan la publicación del nombre y el tratamiento de datos (Ley 29733) | Hook `beforeChange` |
| LND-12 | Las respuestas tienen un nivel como máximo. Las del equipo llevan la marca «Equipo KipuControl» y se publican sin moderación. «Útil» se cuenta una vez por visitante (hash diario) | Hook + API |
| LND-13 | Popups: uno por visita y cada uno con frecuencia en días (7 por defecto). No se muestran en el alta, en móvil al salir ni a quien ya tiene cuenta. Se cierran con Esc y con el botón, y devuelven el foco | Componente `Popup` |
| LND-14 | Boletín con doble confirmación. La baja va en cada correo y se aplica en 1 clic | Payload + correo |
| LND-15 | Chatbot «Kipu»: responde solo con las páginas, precios y preguntas frecuentes publicados (RAG sobre Payload y `GET /public/plans`). Si no sabe, ofrece pasar a una persona. Pide el correo solo cuando se lo piden (demo, ventas), con aviso de privacidad. No pide datos de tarjeta ni contraseñas | Asistente IA (spec 19) |
| LND-16 | Paso a persona: WhatsApp del equipo comercial con un resumen de la conversación, en horario de 9:00 a 19:00 (Lima). Fuera de horario se crea un lead y se promete respuesta en menos de 2 horas hábiles | Job `ChatHandoff` |
| LND-17 | SEO: cada página tiene título, descripción, canónica y `hreflang` (es-PE, en, pt-BR). Inicio y precios publican JSON-LD `Organization`, `SoftwareApplication` con `Offer` por plan y `FAQPage`. Los artículos siguen BLG-01 a BLG-06 | Plantillas |
| LND-18 | Filtros del blog: las categorías tienen URL propia e indexable (`/blog/categoria/ventas`). La búsqueda, el orden y el filtro por sitio usan parámetros con `noindex, follow` y canónica a la página limpia | Next.js |
| LND-19 | SEO para IA: `/llms.txt` y `/llms-full.txt` con el resumen del producto, los planes y los artículos. Todo el contenido se renderiza en el servidor y se lee sin JavaScript. `robots.txt` permite los rastreadores de búsqueda y declara la política para los de entrenamiento | Rutas Next.js |
| LND-20 | Rendimiento: LCP < 2,5 s y CLS < 0,1 en móvil. El chatbot y los popups se cargan después de la interacción o a los 3 s | Next.js |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| GET | `/api/v1/public/plans` | público | Planes, precios mensuales y anuales, add-ons, límites y tipo de cambio del día (LND-01) | — |
| POST | `/api/v1/public/coupons/validate` | público (límite 10/min por IP) | Valida un cupón para un plan y ciclo y devuelve el descuento | — |
| GET | `/api/v1/public/ruc/{ruc}` | público (límite 10/min por IP) | Razón social, dirección y estado del contribuyente (LND-04) | — |
| POST | `/api/v1/public/signups` | público (captcha invisible) | Crea el alta: usuario, tenant y suscripción `trialing` (prueba) o alta `pago_pendiente` (plan pagado). Devuelve el token del alta | Idempotency-Key |
| POST | `/api/v1/public/signups/{token}/checkout` | público (token firmado) | Cobra el primer periodo con el token de la pasarela, Yape o PayPal y emite la factura o boleta de la plataforma | Idempotency-Key · lock sobre el alta |
| GET | `/api/v1/public/signups/{token}` | público (token firmado) | Estado del alta y comprobante, para la bienvenida y la espera de Yape | — |
| POST | `/api/v1/public/sales-leads` | público (límite 5/min por IP) | Lead comercial de KipuControl desde el chatbot, el popup o el formulario de ventas, con consentimiento. No confundir con `/public/leads` de la spec 15, que es el lead del sitio de una agencia | Idempotency-Key |
| GET | `/api/v1/platform/signups` | super_admin | Altas desde la landing con embudo, origen, plan, estado y comprobante | — |

Errores nuevos:
- 409 `SIGNUP_EMAIL_TAKEN`;
- 422 `SIGNUP_TOTAL_CHANGED`;
- 422 `RUC_INVALID`;
- 422 `COUPON_INVALID`;
- 422 `TRIAL_ALREADY_USED`;
- 402 `PAYMENT_DECLINED`, con el motivo de la pasarela.

## 7. Permisos y comportamiento por rol

No hay permisos nuevos de KipuControl. El catálogo sigue en 94.

| Rol | Acceso |
|---|---|
| Visitante | Landing, alta, blog, comentarios, boletín y chatbot |
| Agencia recién suscrita | Su bienvenida (token firmado) y luego el back-office como Tenant Admin |
| Super Admin | Pestaña «Landing» de `#/admin/marketing-vitrina`, altas (`/platform/signups`), trials y cupones (spec 13) |
| Equipo de contenidos | Cuentas de Payload. El rol nuevo `moderador` aprueba, rechaza y responde comentarios y no publica artículos |

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `SignupStarted` | default | Guarda la atribución (UTM, `gclid` y `fbclid`) y programa `SignupRecovery` |
| `SignupCompleted` | default | Correo de bienvenida, inicio del onboarding, conversión `plan_pagado` (spec 24) y lead convertido en Payload |
| `SignupRecovery` (1 h y 24 h) | notifications | Correo para retomar un alta abandonada (LND-09) |
| `TrialSignupCreated` | notifications | Avisos de la prueba de la spec 13 (7, 3 y 1 día) |
| `PlansChanged` | default | Revalida `/`, `/precios` y `/llms.txt` de la landing |
| `CommentSubmitted` | notifications | Aviso a los moderadores si queda `pendiente` |
| `CommentApproved` | default | Revalida el artículo y avisa a quien comentó si recibió respuesta |
| `NewsletterSubscribed` | notifications | Correo de doble confirmación y conversión `suscripcion_boletin` |
| `ChatHandoff` | notifications | Mensaje a WhatsApp del equipo comercial con el resumen (LND-16) |
| `PurgeChatSessions` (diario) | default | Borra las conversaciones de más de 90 días |

## 9. Auditoría

Se auditan:
- las altas (creación, pago, fallo y abandono), con IP truncada y aceptación de términos con su versión;
- los canjes de cupón;
- la moderación de comentarios (quién, cuándo y estado anterior);
- los cambios de popups;
- las bajas del boletín.

En Payload, además, se usan sus versiones.

## 10. Casos de prueba mínimos

- LND-02: plan Starter anual con cupón del 10 % → subtotal S/ 4,900.00, cupón − S/ 490.00, IGV S/ 793.80 y total S/ 5,203.80.
- LND-02: el cliente envía un total distinto al recalculado → 422 `SIGNUP_TOTAL_CHANGED`.
- LND-03: alta con un correo de otro tenant → 409.
- LND-04: factura con RUC `2060` o con RUC de baja en SUNAT → 422 `RUC_INVALID`.
- LND-05: en `/suscribirse/*` no carga ninguna etiqueta de marketing, aunque haya consentimiento.
- LND-06: Yape vence a los 10 minutos → alta `pago_pendiente` y botón de reintento.
- LND-08: segunda prueba con el mismo RUC dentro de 12 meses → 422 `TRIAL_ALREADY_USED`.
- LND-10: una agencia de Rutas Libres se suscribe a Starter → mismo tenant y conserva sus tours.
- LND-11: comentario con 2 enlaces → `spam`; con el campo trampa lleno → descartado sin aviso.
- LND-13: el popup de salida no aparece dos veces en 7 días ni en el alta.
- LND-18: `/blog?orden=populares` tiene `noindex` y canónica a `/blog`.
- Playwright (prueba del prototipo, incluida en la entrega):
  - inicio con los conmutadores de ciclo y moneda;
  - calculadora de ahorro;
  - prueba de 14 días sin tarjeta hasta la bienvenida;
  - Starter anual con cupón, tarjeta inválida y RUC inválido rechazados, y luego pago con factura;
  - filtros del blog y comentario que queda `pendiente`;
  - chatbot con precios y paso a ventas;
  - popup de salida;
  - U16 aprueba un comentario en `#/admin/marketing-vitrina/landing`;
  - a 390 px sin desborde y sin errores de JavaScript.

## 11. Cambios y decisiones respecto a la documentación inicial

- **Alta sin intervención:** la spec 13 describía el alta del tenant desde la consola de plataforma. Ahora también se hace desde la landing, con la API pública de esta spec y las mismas tablas.
- **Blog de KipuControl:** comparte el Payload de Rutas Libres (spec 24) con el campo `site`, en lugar de tener un CMS aparte.
- **Rutas Libres como puerta de entrada:** la agencia que empezó gratis se suscribe sin crear otra cuenta (LND-10).

## 12. Supuestos y puntos a validar con negocio

- Precios finales, cupón de lanzamiento y si el anual sigue siendo «2 meses gratis».
- Pasarela de cobro de la plataforma (Culqi, Niubiz o Izipay) y si PayPal cobra en dólares.
- Horario y número de WhatsApp para el paso a persona del chatbot.
- Si los comentarios se abren en todos los artículos o solo en algunos.
- Revisión legal de términos, privacidad y cookies de kipucontrol.com.
- Dominio: `kipucontrol.com` o `kipucontrol.pe`, y si el blog va en `/blog` o en un subdominio.

## 13. Contrato técnico (para el equipo de desarrollo)

### 13.1 App `apps/landing`

- Next.js 15 (App Router) en el mismo monorepo que `apps/vitrina`. El blog se lee del Payload de la vitrina con la Local API cuando comparten despliegue, o con su REST cuando no.
- Rutas: `app/(site)/page.tsx`, `precios/page.tsx`, `suscribirse/[plan]/[ciclo]/page.tsx` (cliente, sin etiquetas de terceros), `bienvenido/[token]/page.tsx`, `blog/page.tsx`, `blog/categoria/[cat]/page.tsx`, `blog/[slug]/page.tsx`, `llms.txt/route.ts`, `sitemap.ts` y `robots.ts`.
- Componentes: `PlanToggle` (ciclo y moneda), `PlanCards`, `CompareTable`, `SavingsCalculator`, `CheckoutWizard` (3 pasos y `OrderSummary` fijo), `HostedCardFields` (campos de la pasarela), `YapeQr`, `BlogFilters` (las categorías son enlaces y la búsqueda es un `<form method="get">`, así funciona sin JavaScript), `CommentThread`, `ExitIntent`, `ScrollSlideIn` y `KipuChat`.
- Diseño: tokens de `kit/design/kipucontrol/tokens.json`. Azul marino `#0A3A73` para navegación y texto de marca, amarillo `#F4B400` (texto `#2B1F00`) solo para la acción principal, verde `#22A55A` para estados correctos y Plus Jakarta Sans.

### 13.2 Payload

- `site` es un campo obligatorio en `posts` y `categories`, con índice. Cada app filtra con `where: { site: { equals: SITE } }`.
- Colecciones nuevas: `comments`, `subscribers`, `popups`, `leads` y `chat-sessions` (§3). El acceso público a `comments` es `create` y la lectura de los aprobados. Las demás no tienen lectura pública.
- Hooks: `commentGuard` (LND-11), `commentNotify` y `revalidateComment`.

### 13.3 Alta y cobro

1. `POST /public/signups` crea el usuario (sin verificar), el tenant y la suscripción `trialing` o el alta `pago_pendiente`, en una transacción.
2. `POST /public/signups/{token}/checkout` cobra con el token de la pasarela. Con el webhook de pago confirmado, la suscripción pasa a `active`, se emite la factura de la plataforma (serie F001 o B001) y se dispara `SignupCompleted`.
3. La bienvenida consulta `GET /public/signups/{token}` cada 3 s mientras está en `pago_pendiente`, durante 10 minutos como máximo.
