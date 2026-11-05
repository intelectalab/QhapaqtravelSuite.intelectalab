# Selectores `data-testid` — contrato entre el frontend Next.js y Playwright

Las pruebas E2E **solo** localizan elementos por `data-testid` (`testIdAttribute: 'data-testid'` en `playwright.config.ts`). Nunca por texto visible, clases CSS ni estructura del DOM: el texto cambia con el idioma y el diseño cambia con shadcn/Tailwind. El espejo en código de este documento es `support/testids.ts`; si cambia uno, cambia el otro en el mismo commit.

## 1. Convención

| Regla | Ejemplo |
|---|---|
| Formato `{pantalla}-{elemento}` en kebab-case e inglés (como el código, CONVENCIONES §3). | `quote-send`, `bk-total` |
| Sufijo dinámico tras `:` con el **código legible** del registro o el valor de dominio (nunca el uuid). | `table-row:RES-2026-000348`, `bk-day:2026-10-12`, `bk-pax-inc:chd` |
| Campos de formulario: `field:{name}` con el mismo `name` del esquema Zod / FormRequest (notación con puntos para anidados). Su error: `field-error:{name}`. | `field:confirmation_code`, `field:items.0.service_date` |
| Opciones de combobox / picker (Radix): `option:{código}`. | `option:G01`, `option:RES-2026-000350` |
| Acciones de negocio genéricas: `action:{verbo}` cuando no tienen id propio en la lista de abajo. | `action:duplicate` |
| Prefijos reservados: `bk-` motor de reservas (widget, sitio, checkout), `pax-` portal del pasajero, `portal-quote-` portal del cliente, `nav-item:` menú lateral. | |
| El `data-testid` va en el elemento interactivo (botón, input, enlace), no en su contenedor. En Radix, en el `Trigger`/`Item`. | |
| Componentes compartidos (tabla, diálogo, toast, badge) lo traen de fábrica en `web/src/components/ui/*`; las pantallas no lo repiten. | |
| No se generan con índices de array salvo cuando el dominio no tiene código (`quote-line:0`). | |

### Atributos de estado que las pruebas leen

Los valores se exponen en atributos `data-*` con el valor **de dominio** (el mismo del `CHECK` de la tabla o del JSON de la API), no el texto traducido:

| Atributo | Dónde | Valor |
|---|---|---|
| `data-status` | `status-badge`, `bk-day:*`, `portal-quote-status`, `order-service-confirm:*` | Estado de dominio (`confirmada`, `cerrado`, `vista`, `confirmado`…) |
| `data-variant` | `toast` | `ok` \| `bad` \| `warn` |
| `data-state` | `status-step:*`, `order-step:*`, `quote-internal-approval-banner` | `done` \| `current` \| `todo` / `pendiente` \| `aprobada` \| `rechazada` |
| `data-amount` | montos (`bk-total`, `bk-deposit`, `bk-balance`, `reservation-total`, `reservation-receivable:*`, `cancellation-penalty`, filas de CxC…) | String decimal con 2 decimales, sin separador de miles (`19324.98`) |
| `data-due` | `reservation-receivable:*` | Fecha ISO `YYYY-MM-DD` |
| `data-price` | `reservation-service:*` | Precio del servicio, string decimal |
| `data-removed` | `bk-line:*` | `true` \| `false` |
| `data-read` | `pax-alert:*` | `true` \| `false` |
| `data-at` | `order-step:*` | Instante ISO recortado a minutos (`2026-09-29T09:40`) |
| `data-severity` | `incident-severity` | `baja` \| `media` \| `alta` \| `critica` |
| `data-incidents-ok` | `order-close-checks` | `true` \| `false` |
| `data-total` | `checkout-summary` | Total recalculado por el servidor |
| `data-value` | `profit-margin` | Margen en % (número) |
| `title` | `bk-day:*` | Etiqueta del motor (`Ocupado / cerrado`, `Últimos 3 cupos`) |

## 2. Transversales (shell, F0-38…F0-41)

| data-testid | Elemento |
|---|---|
| `app-shell` | Contenedor raíz autenticado (se espera tras login) |
| `page-title` | Título H1 de la pantalla |
| `nav-item:{clave}` | Ítem del menú lateral; clave = ruta sin `/` y con `-` (`cotizaciones`, `admin-usuarios`, `finanzas-rentabilidad`, `marketing`, `plataforma`) |
| `user-menu`, `user-menu-logout` | Menú de usuario y salir |
| `toast` | Notificación efímera (`data-variant`) |
| `forbidden-page`, `forbidden-required-perms`, `forbidden-requested-path`, `forbidden-request-access` | Pantalla 403 (00 §2): contenedor, permisos requeridos, ruta, botón «Solicitar acceso» |
| `scope-denied` | Aviso «Registro fuera de su cartera» (ownership de Ventas) |
| `not-found-page` | Pantalla 404 |
| `status-badge` | Chip de estado del registro abierto (`data-status`) |
| `status-step:{estado}` | Paso del flujo de estados |
| `dialog`, `dialog-confirm`, `dialog-cancel` | Diálogo modal y sus botones |
| `table-row:{código}`, `table-empty`, `table-export` | Tabla de datos (TanStack Table) |
| `filter:{nombre}`, `tab:{clave}`, `kpi:{clave}` | Filtros, pestañas y KPIs |
| `preview-readonly-banner` | Banner de vista previa interna de portales, solo lectura (H-05) |

## 3. Autenticación (`/login`, `/mfa`)

`login-email`, `login-password`, `login-submit`, `login-error`, `mfa-code`, `mfa-submit`.

## 4. Por pantalla

### CRM — `/crm/leads/[code]`, `/crm/oportunidades/[code]`
| data-testid | Elemento |
|---|---|
| `lead-take` | «Tomar» lead de la cola |
| `lead-activity-done:{tipo}` | Completar actividad (`primer-contacto`…) |
| `lead-bant:{budget\|authority\|need\|timing}` | Casillas BANT |
| `lead-qualify` | Marcar calificado |
| `lead-convert`, `lead-convert-client-mode:{new\|existing}`, `lead-convert-client` | Convertir y selector de cliente |
| `field:opportunity.title`, `field:opportunity.amount` | Datos de la oportunidad al convertir |
| `opportunity-create-quote` | «Crear cotización» en la oportunidad |
| `timeline-360` | Historial del 360 |

### Cotizaciones — `/cotizaciones/nueva`, `/cotizaciones/[code]`
| data-testid | Elemento |
|---|---|
| `quote-add-product`, `quote-product-picker`, `quote-product-option:{PRD}` | Agregar producto |
| `quote-line:{n}`, `field:items.{n}.service_date`, `field:items.{n}.pax_adt` | Línea y sus campos |
| `quote-discount-pct`, `quote-total`, `quote-margin`, `quote-save` | Totales y guardar |
| `quote-internal-approval-banner` (`data-state`), `quote-request-internal-approval`, `quote-internal-approve` | Aprobación interna |
| `quote-send`, `quote-send-channel:{email\|whatsapp\|portal}` | Envío |
| `quote-register-client-approval` | Registrar aprobación del cliente |
| `quote-convert`, `quote-convert-preview`, `quote-convert-confirm`, `quote-reservation-link` | Conversión a reserva |

### Reservas — `/reservas/[code]`
| data-testid | Elemento |
|---|---|
| `reservation-code`, `reservation-total` (`data-amount`) | Cabecera |
| `reservation-service:{código de servicio}` (`data-price`) | Servicios |
| `reservation-receivable:{anticipo\|saldo\|penalidad}` (`data-amount`, `data-due`) | CxC de la reserva |
| `reservation-cancel`, `cancellation-penalty`, `cancellation-refund`, `cancellation-confirm` | Cancelación (E2E-09); motivo con `field:reason` + `option:{motivo}`, detalle `field:detail` |

### Operaciones — `/operaciones/ordenes`, `/operaciones/ordenes/[code]`, `/operaciones/incidencias/[code]`
| data-testid | Elemento |
|---|---|
| `order-create` (+ `field:reservation_id`, `option:{RES}`) | Nueva orden |
| `order-service-request:{svc}`, `order-service-confirm:{svc}` (`data-status`), `field:confirmation_code` | Solicitud y confirmación al proveedor |
| `order-assign:{svc}`, `assign-guide`, `assign-driver`, `assign-vehicle`, `assign-warning-ack`, `assign-save` | Asignación de recursos |
| `voucher-issue:{svc}`, `voucher-code:{svc}` | Voucher |
| `order-step:{assignmentId}:{confirmado\|inicio\|checkin\|evidencia\|fin}` (`data-state`, `data-at`) | Pasos de campo en la orden 360 |
| `order-close-checks` (`data-incidents-ok`), `order-close` | Cierre operativo |
| `incident-severity` (`data-severity`), `incident-evidence` (input file), `incident-resolve`, `incident-close`, `field:resolution` | Incidencia |
| `critical-incident-alert` | Alerta crítica en el panel del Manager |

### Finanzas — `/finanzas/cobros/[code]`, `/finanzas/rentabilidad/[res]`
| data-testid | Elemento |
|---|---|
| `table-row:CXC-…` (`data-amount`) | Fila de CxC |
| `payment-register`, `payment-apply` (+ `field:amount`, `field:method`, `option:{método}`, `field:reference`) | Registrar y aplicar pago |
| `invoice-issue` | Emitir comprobante |
| `cost-register`, `cost-approve` (+ `field:amount`, `field:provider_invoice`) | Costo de proveedor |
| `profit-margin` (`data-value`), `settlement-open` | Rentabilidad y liquidación |

### Portal del cliente — `/portal-cliente/cotizaciones/[code]`
`portal-quote-status` (`data-status`), `portal-quote-approver-name`, `portal-quote-accept-terms`, `portal-quote-approve`.

### Portal del pasajero — `/portal-pasajero/*`
| data-testid | Elemento |
|---|---|
| `pax-alert:{id}` (`data-read`), `pax-alert-read:{id}` | Alertas y «marcar como leída» |
| `pax-itinerary-day:{n}` | Día del itinerario |
| `pax-voucher-open:{VOU}`, `pax-voucher-qr` | Voucher y su QR |

### Motor de reservas: widget `/widget/[code]`, ficha `/tours/[slug]` y `/checkout`
Mismos ids en widget, ficha del sitio y simulador del centro de reglas (un solo componente `BookingPanel`).

| data-testid | Elemento |
|---|---|
| `bk-calendar`, `bk-day:{YYYY-MM-DD}` (`data-status`, `title`, `disabled` si no seleccionable), `bk-month-next` | Calendario |
| `bk-ranges-summary`, `bk-range:{RG-…}` | Resumen de rangos (se omite si R-AVAIL-RANGES está apagada) |
| `bk-pax-inc:{adt\|chd\|inf}`, `bk-pax-dec:{…}`, `bk-pax-count:{…}`, `bk-pax-age-label:{…}`, `bk-pax-error` | Pasajeros |
| `bk-lodging-toggle`, `bk-lodging-hotel:{LEG}`, `bk-room-inc:{LEG}:{tipo}`, `bk-rooms-total`, `bk-nights-total` | Alojamiento por ciudad |
| `bk-addon-inc:{ADD}` | Adicionales |
| `bk-line:{key}` (`data-amount`, `data-removed`), `bk-line-remove:{key}`, `bk-line-restore:{key}` | Líneas del resumen; `key` = clave del motor (`base-adt`, `addon-ADD-1101`, `lodge-LEG-1-Doble`) |
| `bk-subtotal`, `bk-total`, `bk-deposit`, `bk-balance`, `bk-balance-due` (`data-amount`) | Totales |
| `bk-pay-mode:{total\|adelanto\|pagar_despues}` | Modalidad (radio) |
| `bk-currency`, `bk-warning`, `bk-continue` | Moneda, advertencias, continuar |
| `checkout-summary` (`data-total`), `checkout-pay-mode:{…}`, `checkout-amount-today` (`data-amount`), `checkout-pay` | Checkout |

### Centro de reglas — `/admin/reglas`
`rule-toggle:{R-…}`, `rule-locked:{R-…}` (candado «Disponible desde el plan X»).

## 5. Pantallas de Fase 3 (a completar al construirlas)

Seguir la convención: `subscription-*` (`/admin/suscripcion`: `subscription-change-plan`, `subscription-meter:{metric}`, `subscription-plan-rule:{R-…}`), `apikey-*` (`apikey-create`, `apikey-token-once`, `apikey-revoke:{KEY}`), `webhook-*` (`webhook-create`, `webhook-secret-once`, `webhook-redeliver:{WHD}`), `campaign-*`, `segment-*` (`segment-rule-add`, `segment-count`), `consent-*`, `target-*` (`target-adjust:{MET}`, `target-rank-position`), `review-*` (`review-publish:{RVO}`, `review-reject:{RVO}`, `review-reply:{RVO}`), `ext-review-*`, `plan-rule-radio:{R-…}:{plan}`, `dunning-run`. Registrar cada id nuevo aquí y en `support/testids.ts`.

## 6. Verificación

- `npm run test:smoke` falla si falta un id usado por las pruebas; Playwright muestra el id no encontrado.
- Regla de revisión de PR del frontend: todo botón de acción de negocio y todo monto visible llevan `data-testid` y, si es monto, `data-amount`.
