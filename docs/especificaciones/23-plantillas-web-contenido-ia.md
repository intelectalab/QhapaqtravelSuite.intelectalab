# Plantillas web del sitio y contenido con IA (v2.9)

Módulo nuevo de la v2.9. Reúne tres piezas comerciales que ayudan a vender el sitio propio de la agencia:

1. **Plantillas web**: la agencia elige el diseño de su sitio público al contratar o cuando quiera, lo ve con sus propios datos antes de aplicarlo y puede volver a la anterior. El Super Admin también puede asignar una plantilla. Hay plantillas incluidas y **premium** de pago único.
2. **Catálogo abierto al equipo de desarrollo y partners**: cada plantilla es un paquete versionado con un contrato técnico (§13). Se envía a revisión, pasa validaciones automáticas (manifiesto, build, Lighthouse, contraste, i18n, datos estructurados, seguridad) y la revisión visual antes de publicarse en la galería.
3. **Contenido con IA** como **plan adicional**: mejorar descripciones, títulos y meta SEO, traducir, escribir relatos de aventura y artículos del blog; **crear imágenes con costo** en créditos. Nada se publica sin revisión humana.

Fase del plan: **3 · SaaS y crecimiento** (épica E3.20). Permisos nuevos: `cms.templates.manage` y `ai.content.use` (91 en total).

Prototipo:
- Agencia: `#/canales/plantillas` (galería, vista previa en `#/sitio`, aplicar, personalizar, historial) y `#/canales/contenido-ia` (texto, imágenes, historial, planes y créditos).
- Plataforma (U16): `#/admin/plantillas` (catálogo, envíos a revisión, por agencia, guía para desarrolladores).
- Vitrina: el registro de agencia en `#/vitrina/agencias` pide el diseño del sitio.
- El sitio público `#/sitio` se pinta con la plantilla activa o la de vista previa (`window.KipuTpl`).

## 0. Referencias

| Producto | Qué hace | Qué tomamos |
|---|---|---|
| Shopify Themes | Tienda de temas gratis y de pago; vista previa con los datos de la tienda; editor de secciones; revisión de calidad para publicar | Galería con vista previa real, premium de pago único, requisitos de calidad para autores |
| WordPress / Elementor | Temas y kits; el contenido no cambia al cambiar de tema | Separar presentación y datos: cambiar de plantilla nunca toca tours, precios ni SEO |
| Wix / Squarespace AI | Generación de textos y de imágenes dentro del editor con revisión | IA dentro del flujo, con antes y después y aplicación explícita |

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-055 CMS | Plantilla del sitio, personalización, contenido mejorado con IA, imágenes con IA |
| PROC-090 Plataforma SaaS (spec 13) | Catálogo de plantillas, envíos de autores, plantilla por defecto, venta de plantillas premium, planes y paquetes de créditos de IA |
| PROC-054 E-commerce | El sitio con la plantilla elegida sigue usando el motor de reservas (spec 16) |

## 2. Pantallas

| Ruta Next.js | Qué hace | Roles con acceso |
|---|---|---|
| `(backoffice)/canales/plantillas` | Plantilla activa, historial con restaurar, galería filtrable por tipo, vista previa con datos propios, aplicar, comprar premium, personalizar colores y redondeo con validación de contraste | `cms.templates.manage` |
| `(sitio)/?preview=<token>` | Sitio público con la plantilla en vista previa y barra «Aplicar / Salir» | Usuario con el token de vista previa |
| `(backoffice)/canales/contenido-ia` | Pedido de texto (mejorar, SEO, traducir, relato, artículo) con costo previo; resultado antes/después con aplicar, descartar u otra versión; imágenes con estilo, cantidad y calidad; galería con texto alternativo; historial; planes y paquetes; movimientos de créditos | `ai.content.use` |
| `(plataforma)/plantillas` | Catálogo (por defecto, retirar, editar tipo y precio), envíos a revisión con validaciones, asignación por agencia, guía para desarrolladores | Super Admin |
| `(vitrina)/agencias` | El registro pide el diseño del sitio entre las incluidas | Público |

## 3. Modelo de datos PostgreSQL

**Tablas de la plataforma (3.1 a 3.4).**

SQL: `kit/database/40_fase3.sql`, bloque «v2.9 · Plantillas web y contenido con IA (spec 23, plataforma)». Sin RLS de tenant, `REVOKE ALL` para `app_role`; el tenant las lee solo por la API.

### 3.1 `platform_site_templates`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | uuid | no | PK |
| code, slug | varchar | no | Únicos. `slug` kebab-case |
| name, description | | no | |
| category | varchar(16) | no | agencia, free_tour, aventura, lujo, corporativo, multi |
| tier, price_once, currency | | no | incluida (precio 0) o premium (precio > 0) (CHECK) |
| min_plan_code | varchar(40) | sí | Plan mínimo para usarla |
| author_kind, author_name, repo_url | | | equipo o partner |
| status | varchar(12) | no | borrador, en_revision, publicado, retirado. Publicado exige `current_version_id` (CHECK) |
| current_version_id | uuid | sí | FK diferible a `platform_site_template_versions` |
| default_for_new | boolean | no | Una sola por defecto (índice parcial único), publicada e incluida (CHECK) |
| installs, tags | | no | |

### 3.2 `platform_site_template_versions`

`template_id` + `version` semver únicos; `manifest` jsonb con `sections` y `tokens` (CHECK); `bundle_path` y `bundle_sha256`; `status` candidata/aprobada/publicada/retirada. **Aprobada o publicada exige aprobador y Lighthouse móvil ≥ 85 rendimiento, ≥ 95 accesibilidad, ≥ 95 SEO, ≥ 90 buenas prácticas** (CHECK); publicada exige `published_at`.

### 3.3 `platform_template_submissions`

Código único, plantilla, versión, autor, `status` recibida/validando/aprobada/rechazada, `checks` jsonb con el resultado de cada validación, revisor y fecha. Decidida exige revisor y fecha; rechazada exige motivo de 10 caracteres o más (CHECK).

### 3.4 `platform_ai_credit_packs`

Código único; `kind` contenido/imagenes; `credits` > 0; precio; `billing` unico/mensual; `addon_code` (p. ej. `ai_content`, `ai_images`).

**Tablas del tenant (3.5 a 3.8).**

SQL: bloque «v2.9 · Tema del sitio y contenido con IA (spec 23, tenant)». RLS estricto y FKs compuestas por `90_rls.sql`.

### 3.5 `cms_site_themes`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| template_id, template_version_id | uuid | no | FK a la plataforma |
| status | varchar(12) | no | vista_previa, activo, anterior. **Un activo por tenant** (índice parcial único) |
| tokens | jsonb | no | Personalización: `side`, `accent`, `sun`, `radius`, `logo` |
| sections | jsonb | no | Orden y visibilidad de secciones |
| chosen_by | varchar(16) | no | alta, agencia, admin_plataforma |
| applied_by, applied_at | | sí | Activo o anterior exige `applied_at` (CHECK) |
| preview_token | varchar(64) | sí | Único; obligatorio en vista previa (CHECK) |
| lock_version | integer | no | |

### 3.6 `cms_ai_content_jobs`

Código único por tenant; `kind` mejorar_texto/meta_seo/traducir/relato_aventura/articulo/imagen; `target_type` producto/pagina/articulo/historia/libre con `target_id` obligatorio salvo libre (CHECK); `locale`, `tone`; `input` y `output` jsonb; `status` en_cola/procesando/listo/aplicado/descartado/fallido; listo o aplicado exige `output`; aplicado exige `applied_at`; **fallido exige `error` y 0 créditos** (CHECK); `ai_request_id` FK `sys_ai_requests` (spec 19).

### 3.7 `cms_ai_images`

`job_id` FK; `prompt` de 10 a 2 000 caracteres; `style` fotografico/ilustracion/acuarela/mapa/textil; ancho y alto 256–4 096; `file_path`; **`alt_text` obligatorio** (≥ 5); `ai_label` (etiqueta «Imagen generada con IA» en el sitio, por defecto sí); `credits_used` > 0; `status` generada/en_uso/descartada; `used_in` jsonb.

### 3.8 `fin_ai_credit_ledger`

Libro **append-only** (trigger + REVOKE) de créditos por tenant y tipo: `movement` asignacion_plan/compra_paquete/consumo/reembolso/vencimiento/ajuste; `credits` ≠ 0 con signo según el movimiento (compra y asignación positivos; consumo y vencimiento negativos) (CHECK); `balance_after` ≥ 0; compra exige `pack_id`; consumo exige `job_id`; `invoice_id` FK `platform_invoices`.

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Plantilla | `borrador → en_revision → publicado` · `publicado → retirado → publicado` |
| Versión de plantilla | `candidata → aprobada → publicada → retirada` |
| Envío a revisión | `recibida → validando → aprobada | rechazada` |
| Tema del tenant | `vista_previa → activo` · `activo → anterior` (al aplicar otra) · `anterior → activo` (restaurar) |
| Pedido de IA | `en_cola → procesando → listo | fallido` · `listo → aplicado | descartado` |
| Imagen IA | `generada → en_uso | descartada` |

## 5. Reglas de negocio

### 5.1 Modelo comercial (valores del prototipo, a validar)

| Concepto | Regla |
|---|---|
| Plantillas incluidas | Sin costo en cualquier plan (algunas con plan mínimo, p. ej. Pacífico desde Professional) |
| Plantillas premium | S/ 290 pago único por plantilla; quedan disponibles con sus actualizaciones mientras la cuenta esté activa |
| Plantilla a medida | El equipo de KipuControl o un partner la construye con el contrato §13; precio a cotizar; puede quedar exclusiva o pasar al catálogo |
| Créditos incluidos en el plan | Starter 0, Professional 50, Enterprise 100 créditos de contenido al mes |
| IA Básico (add-on `ai_content`) | S/ 59 al mes: 300 créditos de contenido |
| IA Pro (add-on `ai_content`) | S/ 149 al mes: 1 000 créditos de contenido y 30 imágenes |
| Paquetes | 200 créditos de contenido S/ 39; 20 imágenes S/ 39; 60 imágenes S/ 99 (pago único, vencen a 12 meses); 30 imágenes al mes S/ 49 |
| Costo en créditos | Meta SEO 1 · mejorar texto 2 · traducir 3 (por cada 1 000 palabras) · relato 4 · artículo 8 · imagen estándar 1 · imagen HD 2 |

### 5.2 Reglas

| ID | Regla | Dónde |
|---|---|---|
| TPL-01 | Cambiar de plantilla nunca modifica datos: tours, precios, reservas, blog, SEO, dominio y redirecciones quedan igual. Solo cambia la presentación | Arquitectura (§13) |
| TPL-02 | Un tema activo por tenant; aplicar otro deja el anterior en `anterior` y se puede restaurar | DB + Action |
| TPL-03 | La vista previa usa un token propio, no indexable (`noindex`), válido 24 h, y no cambia el sitio publicado | Service |
| TPL-04 | Premium: se compra antes de aplicar; la compra crea el ítem en la factura de plataforma (`subscription_items`, pago único) | Billing (spec 13) |
| TPL-05 | Plan mínimo: no se puede aplicar una plantilla con `min_plan_code` superior al plan del tenant (422 `TEMPLATE_PLAN_REQUIRED`) | Action |
| TPL-06 | Personalización: el color de botones y enlaces debe tener contraste ≥ 4,5:1 sobre blanco; el redondeo va de 0 a 28 px (422 `THEME_CONTRAST`) | FormRequest |
| TPL-07 | Al alta, el tenant recibe la plantilla elegida en el registro o la `default_for_new`; el Super Admin puede asignar cualquier publicada (premium como cortesía) | Onboarding (spec 13) |
| TPL-08 | Publicar una versión exige validaciones automáticas en verde, Lighthouse mínimo (§3.2) y revisión visual a 360, 768 y 1280 px en claro y oscuro | Platform Action + DB CHECK |
| TPL-09 | Versiones menores (x.Y.z) se aplican solas a quienes usan la plantilla; mayores (X.y.z) se ofrecen y la agencia decide | Job |
| TPL-10 | Retirar una plantilla la quita de la galería; quienes la usan la conservan y reciben aviso para migrar | Platform Action |
| IA-01 | Antes de generar se muestra el costo en créditos y el saldo; sin saldo → 429 `AI_CREDITS_EXHAUSTED` (como `AI_QUOTA_EXCEEDED` de la spec 19) con oferta de paquetes | Service |
| IA-02 | Los créditos se descuentan cuando el resultado está listo; si falla, no se cobra (`fallido` con 0 créditos, CHECK) | Job |
| IA-03 | Nada se publica solo: el resultado queda en `listo` y una persona lo aplica; aplicar queda auditado con antes y después | Action + Audit |
| IA-04 | La IA recibe los datos reales del objeto (itinerario, incluye, punto de encuentro, precios) y se le prohíbe inventar cifras; el texto muestra el aviso «revise cifras, horarios y precios» | Prompt de sistema |
| IA-05 | Imágenes: sin personas reales identificables, marcas de terceros ni lugares falsos; texto alternativo obligatorio; etiqueta «Imagen generada con IA» visible en el sitio | Moderación + DB CHECK |
| IA-06 | Los créditos mensuales del plan y del add-on no se acumulan; los de paquetes de pago único vencen a los 12 meses (`vencimiento`) | Job |
| IA-07 | El libro de créditos es append-only; el saldo es el último `balance_after` por tipo | DB |
| IA-08 | Relatos de aventura con IA usan solo historias con consentimiento (spec 22 VT-12) | Action |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| GET | `/api/v1/cms/templates` | cms.templates.manage | Galería: plantillas publicadas con tipo, precio, plan mínimo, Lighthouse y si ya está comprada | — |
| GET | `/api/v1/cms/templates/{code}` | cms.templates.manage | Detalle con secciones y versiones | — |
| POST | `/api/v1/cms/templates/{code}/preview` | cms.templates.manage | Crea un token de vista previa (24 h) y devuelve la URL | — |
| POST | `/api/v1/cms/templates/{code}/purchase` | cms.templates.manage | Compra de plantilla premium (pago único) | Idempotency-Key |
| GET | `/api/v1/cms/theme` | cms.templates.manage | Tema activo, personalización e historial | — |
| PUT | `/api/v1/cms/theme` | cms.templates.manage | Aplicar plantilla (`template_code`, `version`) | If-Match |
| PATCH | `/api/v1/cms/theme/tokens` | cms.templates.manage | Personalizar colores, redondeo, logo y secciones (TPL-06) | If-Match |
| POST | `/api/v1/cms/theme/restore/{id}` | cms.templates.manage | Restaurar una plantilla anterior | — |
| GET | `/api/v1/public/site/theme` | público | Plantilla, versión y tokens del sitio (por host o token de vista previa) | — |
| POST | `/api/v1/cms/ai/jobs` | ai.content.use | Nuevo pedido (`kind`, `target_type`, `target_id`, `tone`, `locale`, `notes`) → 202; costo en la respuesta | Idempotency-Key |
| GET | `/api/v1/cms/ai/jobs` | ai.content.use | Historial con filtros `kind`, `status` | — |
| GET | `/api/v1/cms/ai/jobs/{id}` | ai.content.use | Estado, antes y después | — |
| POST | `/api/v1/cms/ai/jobs/{id}/apply` | ai.content.use | Aplicar al objeto (crea versión y auditoría) | Idempotency-Key |
| POST | `/api/v1/cms/ai/jobs/{id}/discard` | ai.content.use | Descartar | — |
| POST | `/api/v1/cms/ai/jobs/{id}/regenerate` | ai.content.use | Otra versión (cobra de nuevo) | Idempotency-Key |
| POST | `/api/v1/cms/ai/images` | ai.content.use | Crear imágenes (`prompt`, `style`, `count`, `quality`) → 202 | Idempotency-Key |
| GET | `/api/v1/cms/ai/images` | ai.content.use | Galería | — |
| PATCH | `/api/v1/cms/ai/images/{id}` | ai.content.use | Texto alternativo, uso o descarte | — |
| GET | `/api/v1/cms/ai/credits` | ai.content.use | Saldo por tipo, plan de IA y costos | — |
| GET | `/api/v1/cms/ai/credits/ledger` | ai.content.use | Movimientos de créditos | — |
| GET | `/api/v1/cms/ai/packs` | ai.content.use | Planes y paquetes disponibles | — |
| POST | `/api/v1/cms/ai/packs/{code}/purchase` | ai.content.use | Comprar paquete o contratar plan de IA | Idempotency-Key |
| GET | `/api/v1/platform/templates` | super_admin | Catálogo completo | — |
| POST | `/api/v1/platform/templates` | super_admin | Crear plantilla (borrador) | — |
| PATCH | `/api/v1/platform/templates/{code}` | super_admin | Editar tipo, precio, plan mínimo, descripción, por defecto o retirar | — |
| GET | `/api/v1/platform/template-submissions` | super_admin | Envíos con validaciones | — |
| POST | `/api/v1/platform/template-submissions` | super_admin | Enviar versión (también la cuenta de plataforma del partner) (paquete tgz + SHA-256 + manifiesto); lanza validaciones | Idempotency-Key |
| POST | `/api/v1/platform/template-submissions/{code}/decision` | super_admin | Aprobar y publicar o rechazar con motivo (TPL-08) | — |
| POST | `/api/v1/platform/tenants/{id}/theme` | super_admin | Asignar plantilla a un tenant (TPL-07) | — |
| GET | `/api/v1/platform/ai/packs` | super_admin | Paquetes y planes de IA | — |
| PATCH | `/api/v1/platform/ai/packs/{code}` | super_admin | Precio, créditos y estado | — |

## 7. Permisos y comportamiento por rol

Permisos nuevos (2), módulo «Plantillas e IA»: `cms.templates.manage` y `ai.content.use`. Total del catálogo: 91.

| Rol | Permisos nuevos |
|---|---|
| Tenant Admin | Los 2 |
| Manager | Los 2 |
| Ventas, Operaciones, Finanzas | Ninguno (Ventas y Operaciones siguen usando el asistente de la spec 19 con `ai.assistant.use`) |
| Super Admin | Catálogo, envíos, asignación y paquetes por el guard de plataforma |
| Partner de plantillas | Cuenta de plataforma limitada a enviar versiones de sus plantillas |

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `TemplateSubmitted` | default | Lanza `ValidateTemplateBundle` |
| `ValidateTemplateBundle` | integrations | Verifica SHA-256, manifiesto contra `template.schema.json`, build SSR, Lighthouse móvil (3 corridas, mediana), axe, contraste de tokens, i18n, JSON-LD y CSP; guarda `checks` |
| `TemplateVersionPublished` | notifications | Aviso a las agencias que la usan; las menores se aplican solas (TPL-09) |
| `ThemeApplied` | default | Invalida la caché del sitio (ISR `revalidateTag('theme:<tenant>')`) y registra auditoría |
| `GenerateAiContent` | ai | Llama al proveedor de LLM con los datos del objeto; `listo` o `fallido`; descuenta créditos solo si está listo |
| `GenerateAiImages` | ai | Genera, guarda en el almacenamiento del tenant, crea `cms_ai_images` y descuenta créditos |
| `GrantMonthlyAiCredits` (día 1) | billing | Asigna créditos del plan y del add-on; vence los no usados del mes anterior |
| `ExpireAiPacks` (diario) | billing | Vence créditos de paquetes con más de 12 meses |
| `AiCreditsLow` | notifications | Aviso al 80 % de consumo |

## 9. Auditoría

Aplicar, restaurar, personalizar, comprar y asignar plantillas; publicar, retirar y editar plantillas; decisiones de envíos; cada pedido de IA (quién, qué, créditos) y cada aplicación con antes y después; uso y descarte de imágenes; compras de paquetes y planes de IA.

## 10. Casos de prueba mínimos

- TPL-02: dos temas activos para el mismo tenant → unique violation (smoke test «OK v2.9»).
- TPL-08: versión publicada con rendimiento 70 → CHECK (smoke test).
- TPL-05: aplicar Pacífico con plan Starter → 422 `TEMPLATE_PLAN_REQUIRED`.
- TPL-06: guardar color de botones #F6D38B → 422 `THEME_CONTRAST`.
- IA-01: pedir 4 imágenes HD con 6 créditos → 429 `AI_CREDITS_EXHAUSTED`.
- IA-02: un pedido fallido no descuenta créditos.
- IA-07: `UPDATE` sobre `fin_ai_credit_ledger` como `app_role` → sin privilegio (smoke test).
- Aislamiento: el tenant B no ve el tema ni los créditos de A (smoke test).
- Playwright: U01 previsualiza Inti Raymi en `#/sitio`, la aplica desde la barra y el sitio queda con la clase de la plantilla; U01 genera una mejora de texto y la aplica; U16 aprueba el envío TSB-0007; Ventas recibe 403 en `#/canales/plantillas`.

## 11. Cambios y decisiones respecto a la documentación inicial

- El sitio público (spec 15) deja de tener un solo diseño: se separa en datos (API) y presentación (plantilla), con el contrato §13.
- La IA de contenido reutiliza `sys_ai_requests` (spec 19) para trazabilidad y costo del proveedor; los créditos son una capa comercial aparte.

## 12. Supuestos y puntos a validar con negocio

- Precios de plantillas premium, planes de IA y paquetes; créditos incluidos por plan.
- Proveedor de LLM y de imágenes, y su costo real por crédito (margen objetivo ≥ 60 %).
- Si las plantillas a medida pueden venderse luego a otras agencias y el reparto con el partner (propuesta: 70 % partner, 30 % plataforma en premium).
- Si la vista previa se comparte con terceros (por ejemplo, el dueño de la agencia sin usuario).

## 13. Contrato técnico de plantillas (para el equipo de desarrollo)

Esta sección es la guía para construir y agregar plantillas nuevas. Una plantilla es **solo presentación**: recibe datos tipados y no llama a la API por su cuenta.

### 13.1 Repositorio y estructura

Monorepo `kipu-site-templates` (pnpm workspaces), separado del back-office:

```
kipu-site-templates/
├── packages/
│   ├── site-sdk/          # @kipu/site-sdk: tipos, loaders de datos, componentes base (BookingWidget, PriceTag, Reviews, LegalFooter, ClaimBookLink)
│   ├── tokens/            # @kipu/tokens: tokens base y utilidades de contraste
│   └── tpl-cli/           # kipu-tpl: dev, check, submit
└── templates/
    ├── _starter/          # plantilla mínima para copiar
    ├── andes-clasico/
    │   ├── template.json  # manifiesto (validado por kit/design/plantillas/template.schema.json)
    │   ├── tokens.css     # variables CSS claras y oscuras
    │   ├── sections/      # una carpeta por sección declarada (hero_buscador, destinos, …)
    │   ├── pages/         # las 12 páginas obligatorias (§13.3)
    │   ├── i18n/          # es.json, en.json, pt.json
    │   ├── preview/       # capturas 1280 y 390 px para la galería
    │   └── CHANGELOG.md
    └── inti-raymi/ …
```

### 13.2 Manifiesto `template.json`

Campos obligatorios: `id` (slug), `name`, `version` (semver), `kipu` (rango del SDK, p. ej. `^2.9`), `category`, `tier`, `author`, `tokens` (`side`, `accent`, `soft`, `sun`, `radius`, `font.display`, `font.body`), `sections` (lista de secciones que implementa), `pages`, `locales` (`es`, `en`, `pt`), `darkMode`. Opcionales: `minPlan`, `price`, `settings` (opciones que la agencia puede cambiar: colores, logo, orden y visibilidad de secciones). Esquema y ejemplo en `kit/design/plantillas/`.

### 13.3 Páginas obligatorias

`inicio`, `buscar`, `destino`, `tour` (con el `BookingWidget` del SDK, nunca un formulario propio de reserva), `carrito`, `checkout` (del SDK), `blog`, `articulo`, `aventuras`, `contacto`, `legal` (términos, privacidad Ley 29733, cookies) y `libro_reclamaciones` (enlace visible en el pie, obligatorio en Perú).

### 13.4 Secciones disponibles

`hero_buscador`, `hero_video`, `hero_foto`, `hero_simple`, `destinos`, `experiencias`, `mas_vendidos`, `salidas`, `ofertas`, `resenas`, `aventuras`, `blog`, `boletin`, `servicios`, `casos`, `cotizar`, `clientes`, `colecciones`, `a_medida`, `testimonios`, `prensa`, `horarios_hoy`, `tours`, `punto_encuentro`, `mapa_rutas`, `armar_viaje`. Una sección nueva se propone en el SDK primero (con su tipo de datos) y luego se usa en plantillas.

### 13.5 Datos y límites

- Los datos llegan por props tipadas de `@kipu/site-sdk` (Server Components); la plantilla no hace `fetch` a otros orígenes ni a `/api/v1` directamente.
- Precios, disponibilidad y totales siempre del motor (spec 16); la plantilla solo los muestra.
- Prohibido: scripts de terceros fuera de la lista permitida (analítica del tenant configurada por el SDK), `eval`, `dangerouslySetInnerHTML` salvo el Markdown sanitizado del SDK, acceso a cookies de sesión, fuentes externas fuera de Google Fonts precargadas.
- CSP estricta generada por el SDK; imágenes por `next/image` desde el almacenamiento del tenant.

### 13.6 Calidad mínima para publicar

| Criterio | Mínimo |
|---|---|
| Lighthouse móvil (mediana de 3) | Rendimiento ≥ 85, accesibilidad ≥ 95, SEO ≥ 95, buenas prácticas ≥ 90 |
| Web Vitals (4G simulada) | LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms |
| Peso | JS inicial ≤ 170 KB gzip por página |
| Accesibilidad | WCAG 2.2 AA: contraste 4,5:1, foco visible, teclado, `alt` en imágenes, `lang` por idioma |
| Responsive | 360, 768 y 1280 px sin scroll horizontal; objetivos táctiles ≥ 40 px |
| Modo oscuro | Tokens claros y oscuros; respeta `prefers-color-scheme` |
| SEO | `generateMetadata` por página, canónica, `hreflang`, sitemap, JSON-LD (`TouristTrip`, `Product`, `BreadcrumbList`, `BlogPosting`, `Organization`, `FAQPage` donde aplique) |
| i18n | Sin textos fijos; todo desde `i18n/*.json` |

### 13.7 Flujo de trabajo

1. `pnpm kipu-tpl new <slug>` copia `_starter`.
2. `pnpm kipu-tpl dev <slug>` levanta la plantilla con los datos demo (`kit/seeds`) en `localhost:4100`.
3. `pnpm kipu-tpl check <slug>` corre manifiesto, build, Lighthouse, axe, contraste de tokens, i18n, JSON-LD y CSP; falla si algo está debajo del mínimo.
4. `pnpm kipu-tpl submit <slug>` empaqueta (`tgz` + SHA-256), sube a la plataforma y crea el envío (`POST /api/v1/platform/template-submissions`).
5. El Super Admin revisa en `#/admin/plantillas` (vista previa con datos demo) y aprueba o rechaza con motivo.
6. Versionado semver: parche y menor sin cambios de manifiesto incompatibles; mayor si cambian secciones o settings.

### 13.8 Cómo se sirve en producción

El sitio del tenant (`apps/site`, Next.js) resuelve el tenant por host, lee el tema (`GET /api/v1/public/site/theme`) y carga el paquete de la plantilla por `template_id@version` (import dinámico de un registro interno de paquetes ya construidos). Los tokens personalizados se inyectan como variables CSS en el `<html>`. Cambiar de plantilla invalida la caché del sitio con `revalidateTag('theme:<tenant>')`.

### 13.9 Diseño con herramientas de IA

Para proponer el aspecto de una plantilla se puede partir de un diseño generado (por ejemplo, Stitch o Figma). Ejemplo: `kit/design/PROMPT-STITCH-RUTASLIBRES.md`. El diseño se traduce a tokens del manifiesto y a secciones del SDK; nunca se copia HTML generado sin pasar por `kipu-tpl check`.

**Primer caso real (v2.13): Andes Clásico 3.0.** El equipo diseñó en Stitch 12 pantallas (inicio en escritorio y móvil, búsqueda, ficha del tour en escritorio y móvil, carrito y pago, blog, artículo, aventuras, contacto y Libro de Reclamaciones) con el prompt `kit/design/plantillas/PROMPT-STITCH-ANDES-CLASICO.md`. El resultado se tradujo así:
- **Tokens** del manifiesto `kit/design/plantillas/andes-clasico.template.json` (versión 3.0.0, válido contra el esquema): `side` #0F2747, `accent` #0E5DB5, `soft` #E3EEFB, `sun` #F2B33D, `radius` 12, `font.display` Noto Serif y `font.body` Plus Jakarta Sans. El sistema de diseño completo está en `kit/design/plantillas/andes-clasico/DESIGN.md`.
- **Secciones del SDK**, sin secciones nuevas: `hero_buscador` centrado con buscador de vidrio, `destinos` en mosaico, `mas_vendidos`, `ofertas`, `salidas` como tabla, `resenas`, `blog` y `boletin`.
- **Settings nuevos** para la agencia: color de la acción principal, títulos con serif y destinos en mosaico.
- **Reglas visuales:** el dorado se usa solo en la acción principal (Reservar ahora, Cotizar a medida y Buscar) y en los botones de las tarjetas; el Libro de Reclamaciones va destacado en dorado en el pie.

En el prototipo, la piel está en `plantillas.js` (`andesSkin`) y se aplica a `#/sitio` cuando la plantilla activa es Andes Clásico. Las agencias que tenían la 2.3 pasan a la 3.0 sin perder sus personalizaciones.
