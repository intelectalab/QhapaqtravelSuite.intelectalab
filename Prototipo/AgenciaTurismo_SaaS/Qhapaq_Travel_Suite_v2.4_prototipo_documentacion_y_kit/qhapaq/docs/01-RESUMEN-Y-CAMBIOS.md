# Qhapaq Travel Suite — Resumen para desarrollo y registro de cambios

Versión del paquete: **2.4 (01/10/2026)**. Este documento explica al área de programación qué contiene el prototipo, qué cambió respecto a la documentación inicial (DOC-PROC-001 v1.0 y Especificación PRD de Productos Turísticos) y dónde está el detalle de cada módulo.

## 1. Qué se entrega

| Pieza | Ubicación | Para qué sirve |
| --- | --- | --- |
| Prototipo funcional navegable | `index.html` + `assets/` | Referencia visual y de comportamiento de cada pantalla, rol y regla. HTML/CSS/JS sin dependencias; los datos viven en el navegador. |
| Convenciones técnicas | `docs/CONVENCIONES.md` | Contrato común: multi-tenancy, tablas, API, colas, archivos, frontend, pruebas. |
| Arquitectura objetivo | `docs/02-ARQUITECTURA.md` | Stack Laravel 12 / PHP 8.4, PostgreSQL 17, Redis 8, Next.js, React Native; estructura de repositorios y despliegue. |
| Plan de implementación | `docs/03-PLAN-DE-IMPLEMENTACION.md` | Orden de construcción por fases y dependencias entre módulos. |
| Hallazgos y decisiones | `docs/04-HALLAZGOS-Y-DECISIONES.md` | Inconsistencias detectadas y decisiones que negocio debe tomar antes de programar. |
| Especificaciones por módulo | `docs/especificaciones/00…18-*.md` | 19 especificaciones con modelo PostgreSQL, estados, reglas, endpoints `/api/v1`, permisos, jobs, auditoría, pruebas y diferencias con la documentación inicial. |
| Registro de cambios | `docs/CHANGELOG.md` | Historial de versiones del prototipo. |
| Auditoría UX y responsive | `docs/05-AUDITORIA-UX-RESPONSIVE.md` | Hallazgos por rol en teléfono y tablet, correcciones aplicadas al prototipo y reglas para implementar. |
| Kit de desarrollo con IA | `docs/kit/` (paquete del kit) | Para programar con Claude Code: 262 tablas en SQL validado, contrato OpenAPI de 1 006 endpoints, 378 historias por fase con criterios, dependencias y prioridad, 91 pruebas E2E y 72 Pest, 108 colecciones de datos semilla, tokens de diseño y reglas responsive, Docker/CI, `CLAUDE.md`, comandos y prompts por fase, guía técnica, código de ejemplo verificado, diccionario de datos con diagramas ER, máquinas de estado, reglas de negocio, códigos de error, eventos y jobs, permisos, glosario y colección Postman. Sin equipo ni plazos. Punto de entrada: `kit/00-LEEME-KIT.md`. |

Cifras del paquete: 16 dominios funcionales en 15 archivos de módulo, 74 rutas registradas, 13 roles, 57 permisos, ~725 endpoints especificados y más de 200 tablas PostgreSQL descritas.

## 2. Cómo usar el prototipo

1. Abrir `index.html` (local o subido a public_html). En el login elegir un perfil de demostración; cada rol entra a su propia experiencia.
2. Menú de usuario → «Cambiar de rol (demo)» para comparar lo que ve cada rol, y «Restablecer datos de demostración» para volver a los datos semilla.
3. «Ver sitio web público» desde el login o el icono de globo de la barra superior abre el sitio de la agencia sin iniciar sesión.
4. Administración › Roles y permisos › **Mapa de acceso**: matriz rol × pantalla calculada con la misma regla del router.
5. Cada archivo `assets/js/modules/<modulo>.js` corresponde a una o más especificaciones (tabla de la sección 5).

Importante: el prototipo calcula precios, disponibilidad y permisos en el navegador solo para demostrar el comportamiento. **En producción toda regla vive en el backend**; el frontend solo presenta (principios 2, 5 y 17 de DOC-PROC-001).

## 3. Mapa de módulos

| # | Módulo | Estado frente a la documentación inicial | Especificación | Archivo del prototipo |
| --- | --- | --- | --- | --- |
| 00 | Seguridad, tenancy, RBAC, auditoría, notificaciones (transversal) | Ampliado | `00-transversal-seguridad-rbac.md` | `core.js`, `data.js` |
| 01 | CRM: leads, oportunidades, actividades, Cliente 360, postventa | Implementado y precisado | `01-crm.md` | `crm.js` |
| 02 | Catálogo: productos (Product 360), servicios, proveedores, destinos, tarifas, temporadas, salidas, holds | Implementado y precisado | `02-catalogo.md` | `catalogo.js` |
| 03 | Cotizaciones: versiones, snapshot, pricing, aprobación interna, envío | Implementado y ampliado | `03-cotizaciones.md` | `ventas.js` |
| 04 | Reservas: conversión idempotente, modificación, reprogramación, cancelación | Implementado y ampliado | `04-reservas.md` | `ventas.js` |
| 05 | Operaciones + apps móviles (operador y pasajero, offline) | Implementado | `05-operaciones-movil.md` | `operaciones.js` |
| 06 | Extranet de proveedores | **Nuevo** | `06-extranet-proveedores.md` | `proveedor.js` |
| 07 | Finanzas: CxC, pagos, CxP, comisiones, rentabilidad, facturación, conciliación | Implementado y precisado | `07-finanzas.md` | `finanzas.js` |
| 08 | Canales: B2B, e-commerce (gestión), CMS, portal cliente, portal pasajero | Implementado | `08-canales-portales.md` | `canales.js` |
| 09 | Administración y reportes | Implementado y ampliado | `09-administracion-reportes.md` | `admin.js`, `dashboard.js` |
| 10 | Bandeja de aprobaciones + bandeja omnicanal | **Nuevo** | `10-aprobaciones-inbox.md` | `colaboracion.js` |
| 11 | Cupos y bloqueos (allotments) + documentos de viaje | **Nuevo** | `11-cupos-documentos-viaje.md` | `inventario.js` |
| 12 | Tesorería + Libro de Reclamaciones | **Nuevo** | `12-tesoreria-reclamaciones.md` | `tesoreria.js` |
| 13 | Plataforma SaaS: suscripción, uso, facturación de plataforma, API y webhooks | **Nuevo** | `13-plataforma-saas-api.md` | `plataforma.js` |
| 14 | Marketing (segmentos, campañas, automatizaciones) + metas comerciales | **Nuevo** (la doc. inicial lo listaba solo como «Automatizaciones CRM» P1) | `14-marketing-metas.md` | `crecimiento.js` |
| 15 | Sitio web público de la agencia (e-commerce completo) | **Nuevo** (la doc. inicial solo describía PROC-054) | `15-sitio-web-publico.md` | `sitio.js` |
| 16 | Motor de reservas y centro de reglas (disponibilidad por rangos, pasajeros por edad, alojamiento por ciudad, adicionales, pagos, monedas) | **Nuevo v2.1** | `16-motor-de-reservas-y-reglas.md` | `booking-engine.js`, `catalogo.js` |
| 18 | Reseñas propias verificadas (calificación postviaje, moderación, publicación en sitio y widget) | **Nuevo v2.2** | `18-resenas-propias.md` | `resenas.js` |
| 17 | Centro de reglas, mensajes al pasajero, monedas, reseñas externas e integración con cualquier CMS (widget) | **Nuevo v2.1** | `17-reglas-comunicaciones-monedas-resenas-integracion-web.md` | `experiencia.js` |

## 4. Cambios respecto a la documentación inicial

### 4.1 Cambios de arquitectura y stack

| Tema | Documentación inicial | Decisión para desarrollo | Motivo |
| --- | --- | --- | --- |
| Frontend web | React | **Next.js (App Router, TypeScript)** con grupos de rutas por experiencia | Indicado por el cliente; permite SSR/ISR para el sitio público (SEO) y un solo proyecto para back-office y portales. |
| Base de datos | PostgreSQL | **PostgreSQL 17** con Row Level Security por `tenant_id` | Segunda barrera de aislamiento multi-tenant además del global scope de Laravel. |
| Cache y colas | Jobs/colas sin tecnología definida | **Redis 8** + Laravel Horizon (colas), locks distribuidos, rate limiting, contadores de uso | Cupos, holds, idempotencia y medición de uso requieren locks y contadores atómicos. |
| Tiempo real | No definido | **Laravel Reverb** (WebSockets) | Bandeja de aprobaciones, inbox, notificaciones y tablero de operaciones en vivo. |
| Autorización | RBAC genérico | spatie/laravel-permission con *teams* = tenant + Policies + mapa de acceso por pantalla | Mismo modelo que el prototipo (`ACCESS`, `ROLE_UX`). |
| Identificadores | No definido | UUID v7 + código legible por tenant (`COT-2026-00191`) desde `sys_sequences` | Correlativos sin huecos por tenant y ordenables. |
| Operaciones críticas | «idempotentes cuando corresponda» | Header `Idempotency-Key` obligatorio y `lock_version` (bloqueo optimista) | Conversión, pagos, vouchers, comprobantes y webhooks no deben duplicarse. |

### 4.2 Modelo de roles y experiencias (cambio mayor)

La documentación inicial definía 14 actores. El prototipo los convierte en **13 roles con permisos y experiencia propios**, siguiendo la práctica de ERP turísticos (back-office + extranets) y CRM (cartera por vendedor):

| Rol | Experiencia | Alcance de datos | Cambio respecto a la doc. inicial |
| --- | --- | --- | --- |
| Super Admin SaaS | Consola de plataforma | Tenants, planes, facturación de plataforma, jobs, auditoría de plataforma. **Sin datos comerciales** de las agencias. | Precisado: antes podía verlo todo. |
| Tenant Admin | Back-office completo | Todo el tenant, sin gestión de plataforma. | Precisado. |
| Manager | Back-office | Todo el equipo; aprueba descuentos, anulaciones, CxP, comisiones; no configura el sistema ni registra caja. | Precisado. |
| Ventas | Back-office | **Solo su cartera** (leads propios y sin asignar, sus oportunidades, cotizaciones, reservas, clientes). Pide aprobación, no la da. | Nuevo: ownership de registros. |
| Operaciones | Back-office | Reservas en ejecución, proveedores, asignaciones, vouchers, cupos, documentos de viaje. Ve costos de proveedor, **no márgenes**. | Precisado. |
| Finanzas / Contabilidad | Back-office | Dinero y comprobantes; Contabilidad solo emite comprobantes y consulta CxC. | Precisado. |
| Guía / Conductor | App móvil | Solo sus asignaciones. | Precisado. |
| Usuario B2B | Portal de agencias | Solo su agencia: precio neto, PVP sugerido, comisión y crédito. | Precisado. |
| Cliente | Portal del cliente | Solo sus cotizaciones, viajes, documentos y pagos. | Precisado. |
| Pasajero | Portal y app del pasajero | Solo su viaje. | Precisado. |
| Proveedor | **Extranet de proveedores** (nuevo) | Solo sus solicitudes, rooming, vouchers, pagos y contrato. Sin precios de venta ni datos del cliente. | Nuevo portal. |

Reglas de acceso implementadas: permiso requerido por pantalla (tabla `ACCESS`), bloqueo por URL con pantalla 403 auditada, menú filtrado por pantalla, acciones ocultas o deshabilitadas con el permiso requerido, datos sensibles (costos, márgenes) ocultos según permiso. Detalle completo en `00-transversal-seguridad-rbac.md`.

### 4.3 Procesos precisados o agregados en módulos existentes

| Proceso | Cambio | Dónde |
| --- | --- | --- |
| PROC-004/005 Leads | Detección de duplicados por email/teléfono con fusión; calificación BANT con umbral; «Tomar lead» sin asignar. | 01 |
| PROC-006 Oportunidades | Tablero kanban; «Perdida» exige motivo; reasignación solo por gerencia. | 01 |
| PROC-014/042 Productos | Checklist de activación §42 ejecutable; 19 pestañas del Product 360; paquete = producto con componentes (sin tablas de paquete separadas). | 02 |
| PROC-020 Disponibilidad | Holds con expiración (Disponible → Hold → Confirmada → Liberada/Expirada/Consumida); bloqueo de sobreventa con salidas alternativas. | 02 |
| PROC-021/022 Cotización | **Aprobación interna**: descuento > 5 % o margen < 15 % requiere gerencia; tope de descuento 10 % salvo permiso `quotes.discount_override`. Comparador de versiones. | 03 |
| PROC-025 Conversión | Algoritmo en 19 pasos con idempotencia, locks Redis + `SELECT … FOR UPDATE`, CxC anticipo 40 % / saldo 60 %. | 04 |
| PROC-028 Cancelación | Penalidad por tramos según política; Ventas solo «solicita anulación» y gerencia decide; nota de crédito y reembolso. | 04 |
| PROC-033 Asignación | Validación de conflictos: solape de horario (< 6 h), capacidad del vehículo, vacaciones/mantenimiento, licencia/SOAT vencidos, idioma del grupo. | 05 |
| PROC-039 Cierre | Cierre bloqueado hasta cumplir 4 precondiciones. | 05 |
| PROC-050 Facturación | Validación fiscal previa; OSE/SUNAT simulado y marcado como «por validar». | 07 |
| PROC-053 B2B | Crédito por agencia con bloqueo automático al exceder el límite. | 08 |
| PROC-059 Notificaciones | Matriz evento × canal editable y plantillas con variables. | 09 |

### 4.4 Módulos nuevos (no estaban en la documentación inicial)

| Módulo | Qué resuelve | Por qué se agregó |
| --- | --- | --- |
| Bandeja de aprobaciones | Una sola bandeja para descuentos, anulaciones, reversiones, CxP, comisiones, tarifas de proveedor y excepciones; SLA, niveles y delegación. | Las aprobaciones estaban dispersas en cada módulo. |
| Bandeja omnicanal | Conversaciones de WhatsApp, email, chat web, formulario y tickets vinculadas a lead/cliente/reserva, con SLA y plantillas. | Las agencias venden y atienden principalmente por WhatsApp. |
| Extranet de proveedores | El proveedor confirma, rechaza o propone alternativas; acusa rooming; valida vouchers; sube facturas. | Reduce llamadas y correos de confirmación (PROC-032). |
| Cupos y bloqueos (allotments) | Contratos de cupo con release, utilización, penalidad y pick-up report. | Práctica estándar de tour operadores para hoteles, tren y entradas. |
| Documentos de viaje | Pasaporte/visa/seguro/vacunas/autorización de menores por pasajero, vencimientos y bloqueo de entradas nominativas. | Evita incidencias en migraciones y en Machu Picchu. |
| Tesorería | Cuentas bancarias, caja chica por sede, arqueos, transferencias, flujo de caja proyectado. | Finanzas cubría obligaciones, no la caja. |
| Libro de Reclamaciones | Hoja virtual con correlativo por sede, plazo configurable (15 días hábiles) y constancia. | Obligatorio en Perú (validar normativa vigente). |
| Suscripción y facturación de plataforma | Planes, uso vs límites, add-ons, facturación y dunning, feature flags. | Necesario para operar el producto como SaaS. |
| API y webhooks del tenant | API keys con scopes, webhooks firmados HMAC con reintentos. | Integración con sistemas del cliente (principio API-first). |
| Marketing y metas | Segmentos, campañas email/WhatsApp con consentimiento (Ley 29733), automatizaciones, metas por asesor con ranking. | La doc. inicial lo dejaba como «Automatizaciones CRM» (P1) sin detalle. |
| Sitio web público | Home con buscador, destinos, listados con filtros, ficha rica, carrito multi-producto con hold, checkout con anticipo, cuenta del viajero, viajes a medida, blog, legales, chat. | El cliente pidió una vista pública más completa, al nivel de agencias y OTAs. |

### 4.5 Cambios visuales y de usabilidad

- Identidad azul marino + dorado (tipografía Plus Jakarta Sans) tomada de la línea gráfica de los prototipos previos del cliente; modo claro y oscuro.
- Navegación: grupos plegables que recuerdan su estado, buscador dentro del menú, búsqueda global (`/`), botón «+ Nuevo» con lo que el rol puede crear, acceso directo al sitio público, breadcrumbs en todas las pantallas.
- Portales externos con barra superior propia (sin menú de back-office) y app móvil a pantalla completa.
- Tokens de color y componentes en `assets/css/app.css` para replicar en Next.js (ver `02-ARQUITECTURA.md` §6).

### 4.6 Versión 2.1: motor de reservas, reglas configurables y experiencia del pasajero

Pedido del cliente del 30/09/2026, implementado en el prototipo y especificado en 16 y 17 (más subsecciones «v2.1» en 02, 04, 05, 08 y 15):

| Pedido | Solución | Regla que lo gobierna | Dónde |
| --- | --- | --- | --- |
| Integrar con cualquier CMS | Widget embebible (Web Component), iframe, plugin WordPress con shortcodes y API headless; configurador con vista previa y dominios autorizados; ruta pública `sitio/widget/<producto>`. | — | 17 |
| Disponibilidad por rangos con días intermedios (02–06 disponible, 07–09 ocupado, 10–14 disponible) | Rangos por producto con estado disponible / cerrado u ocupado / agotado, capacidad diaria y nota; un rango cerrado sobre uno disponible funciona como excepción; calendario y leyenda en catálogo, sitio y widget. Ejemplo exacto cargado en PRD-011. | R-AVAIL-RANGES, R-CUTOFF, R-WEEKDAYS | 16 |
| Límite de niños por adulto (4–10 años pagan) e infantes sin costo (0–3) | Bandas de edad configurables por producto, % o tarifa de niño, máximos por adulto, mínimo de adultos, validación en vivo. | R-CHILD-PER-ADULT, R-INFANT-FREE, R-MIN-ADULTS, R-MAX-PAX | 16 |
| Alojamiento opcional multi-ciudad con total de habitaciones y noches | Tramos por ciudad con noches, hoteles por categoría y tipos de habitación; el cliente elige habitaciones por ciudad; totales de habitaciones y noches; validación de camas; rooming prellenado. PRD-011 Lima–Arequipa–Puno–Cusco. | R-LODGING, R-LODGING-CAPACITY, R-SINGLE-SUPP | 16, 15, 05 |
| Datos de acompañantes | Titular + cada acompañante (documento, nacionalidad, nacimiento, parentesco); completar al reservar o antes del viaje desde el portal. | R-COMPANIONS, R-NOMINATIVE | 15, 08, 04 |
| Adicionales (museos, otros) | Catálogo de adicionales por producto (por pax o por reserva, por tipo de pasajero). | R-ADDONS | 16, 15 |
| Modalidad de pago y % de adelanto | Total, adelanto con % y vencimiento del saldo, pagar después con bloqueo; recargo por tarjeta opcional. | R-DEPOSIT, R-PAY-LATER, R-PAY-FEE | 16, 15 |
| Administrar mensajes al pasajero | Plantillas por evento y desfase, canales, idiomas, condiciones, vista previa, programación por reserva, envío manual e historial. | R-PAX-MESSAGES | 17 |
| Panel del pasajero para enviar comentarios | Comentarios, sugerencias, felicitaciones, reclamos e incidencias con calificación; los reclamos abren conversación en el inbox; respuesta desde la reserva. | R-PAX-FEEDBACK | 08, 04 |
| Varias monedas | 10 monedas con tipo de cambio editable e historial, margen de conversión, monedas de cobro (PEN/USD). | R-MULTICURRENCY | 17, 16 |
| Previsualización con opción de quitar ítems | Resumen obligatorio antes de pagar; se quitan adicionales y alojamiento y el total se recalcula. | R-PREVIEW-REMOVE | 15, 17 |
| API con TripAdvisor, Trustpilot y otros | Conectores TripAdvisor, Trustpilot, Google Business Profile, Facebook, GetYourGuide y Viator (adaptadores; requieren aprobación de cada plataforma); bandeja de reseñas, respuestas, invitación postviaje y widget. Datos de ejemplo rotulados. | R-REVIEW-INVITE | 17 |
| Formulario con comentarios y puntos de partida | Punto de recojo o dirección del hotel, vuelo y hora de llegada, comentarios especiales visibles en operaciones, app y voucher. | R-PICKUP, R-COMMENTS | 15, 05 |
| **Toda regla activable o no por cada cliente del SaaS** | **Centro de reglas** en Administración › Reglas de reserva: 31 reglas en 8 grupos con interruptor, parámetros, excepción por producto, simulador, plantillas por tipo de negocio e historial. El motor consulta el centro en cada cálculo. | Todas | 16, 17 |

Reglas adicionales propuestas e incluidas (desactivadas por defecto salvo indicación): grupo mínimo para garantizar salida, suplemento de habitación simple, descuento por grupo, descuento por reserva anticipada, recargo de última hora, reservar y pagar después, recargo por medio de pago, declaración de salud para altura, documento obligatorio para entradas nominativas (activa), invitación a reseña externa.

### 4.7 Versión 2.2: decisiones del cliente del 30/09/2026

| # | Decisión | Qué se hizo |
| --- | --- | --- |
| 1 | Aún no hay reglas ni planes definitivos: usar unos de prueba. | Matriz **DEMO** regla × plan (Starter, Professional, Enterprise), editable por el Super Admin en Facturación de plataforma › Planes. Cada regla tiene un plan mínimo; si el plan del tenant no la incluye, el motor la ignora y el centro de reglas la muestra con candado y «Mejorar plan». La suscripción del tenant muestra qué incluye su plan y qué suma cada upgrade. Precios de planes rotulados como demo. |
| 2 | Aún no hay proveedor de tipo de cambio: usar valores de demo. | Tipos de cambio **DEMO** con historial de 30 días por moneda, proveedor simulado (más SBS, proveedor comercial y carga manual por validar), actualización diaria, alerta por variación y auditoría. |
| 3 | Cada tour genera su propia reserva. | Decisión cerrada; sin cambios en el carrito. |
| 4 | Considerar algunas plataformas de reseñas y un módulo propio. | Priorizadas Google Business Profile, TripAdvisor y Trustpilot (fase 1); Facebook, GetYourGuide y Viator después. Nuevo **módulo de reseñas propias verificadas**: el pasajero califica desde el portal o la app los servicios ya realizados, la agencia modera y responde, y se publican en el sitio y el widget con sello «Viaje verificado» y datos schema.org. Regla R-OWN-REVIEWS. |

## 5. Qué NO está resuelto y debe decidir negocio

Ver `04-HALLAZGOS-Y-DECISIONES.md`. Los cinco más importantes:

1. Tratamiento fiscal de ventas a extranjeros (exportación de servicios y tipo de comprobante) — validar con contador.
2. Proveedor OSE/PSE, pasarela de pagos y WhatsApp Business: contratos y APIs (no se inventaron credenciales ni costos).
3. Estructurar las políticas de cancelación como tramos (hoy se deducen de texto libre).
4. Libro de crédito B2B único (hoy el crédito se descuenta en dos lugares).
5. Normativa vigente del Libro de Reclamaciones y de protección de datos personales.
