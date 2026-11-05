# Reglas de negocio — catálogo de referencia

> Generado por `kit-ia/referencia/tools/extract_rules.py` desde `proto/docs/especificaciones/*.md` y `kit-ia/seeds/settings.json` (`bookingRules`) + `plans.json`. No editar a mano: corregir la especificación y regenerar. La versión tabular completa (con columna de comportamiento) está en `REGLAS-DE-NEGOCIO.csv`.

**Cifras:** 747 filas de regla (730 IDs distintos; una misma regla puede repetirse en varias especificaciones con matices propios) en 19 especificaciones · 32 reglas activables del centro de reglas · 20 reglas transversales (RT-n) referenciadas.

## 1. Cómo leer este catálogo

- **ID**: identificador principal tal como aparece en la especificación (primera clave de la celda). Los alias (`RT-n`, `PRD-BR-nnn` de la documentación inicial, etc.) se listan en la columna *Alias*.
- **Dónde se valida**: texto literal de la especificación. *Capa* lo normaliza: `FormRequest` (validación de entrada), `Policy` (autorización/alcance), `Middleware`, `Service` (servicio de dominio, transacción, locks), `Job/Listener`, `BD` (CHECK, UNIQUE, índices parciales, triggers, RLS), `Resource` (serialización condicional), `UI`. Abreviaturas de las specs: **FR** = FormRequest, **P** = Policy, **S** = Service, **DB** = constraint, **J** = Job.
- **Activable**: reglas del centro de reglas (`R-…`, tabla `sys_booking_rules`) que gobiernan la regla. Si la regla activable está apagada para el tenant o el producto (override), el comportamiento desaparece (`BookingEngine::on(rule, product)`).
- Una regla citada solo como referencia (sin fila propia) no se duplica aquí; búsquela por su ID en la columna *Alias*.

### Prefijos de ID

| Prefijo | Filas | Prefijo | Filas | Prefijo | Filas |
|---|---|---|---|---|---|
| `FIN-BR` | 59 | `OPS-BR` | 49 | `CRM-BR` | 48 |
| `CAT-BR` | 45 | `SUP-BR` | 30 | `RES-BR` | 29 |
| `RT` | 29 | `SIT-BR` | 28 | `QTE-BR` | 27 |
| `SEC-BR` | 25 | `PRD-BR` | 19 | `MKT-BR` | 18 |
| `TES-BR` | 18 | `B2B-BR` | 17 | `ECO-BR` | 16 |
| `APR-BR` | 15 | `DOC-BR` | 13 | `CFG-BR` | 12 |
| `MOB-BR` | 12 | `SUB-BR` | 12 | `TEN-BR` | 12 |
| `INB-BR` | 11 | `RVW` | 11 | `USR-BR` | 11 |
| `CUP-BR` | 10 | `LR-BR` | 10 | `MET-BR` | 10 |
| `PCL-BR` | 10 | `RBAC-BR` | 9 | `API-BR` | 8 |
| `NTF-BR` | 8 | `CAN-V21` | 7 | `CAT-AV` | 7 |
| `CMS-BR` | 7 | `PPX-BR` | 7 | `PRC` | 7 |
| `INT-BR` | 6 | `REP-BR` | 6 | `RES-V21` | 6 |
| `SED-BR` | 5 | `CR` | 4 | `FX` | 4 |
| `OPS-V21` | 4 | `PLN-BR` | 4 | `AUD-BR` | 3 |
| `CAT-AD` | 3 | `CAT-LG` | 3 | `CAT-PX` | 3 |
| `CAT-RL` | 3 | `EXP-BR` | 3 | `JOB-BR` | 3 |
| `MSG` | 3 | `PAX-BR` | 3 | `RV` | 3 |
| `WG` | 3 | `CAT-PY` | 2 | `DSH-BR` | 2 |
| `PROC` | 2 | `CAT-PK` | 1 | `ENT-BR` | 1 |
| `PLN-R` | 1 |  |  |  |  |

## 2. Catálogo de reglas activables (centro de reglas)

Fuente: `kit-ia/seeds/settings.json → bookingRules` (32 reglas) · tabla `sys_booking_rules` (por tenant, `code`, `enabled`, `params`, `params_schema`, `product_override`, `min_plan`) y catálogo de plataforma `sys_booking_rule_catalog` + `plan_rule_entitlements`. Las especificaciones 16 §3.1 y 01_platform.sql hablan de 31 reglas; la semilla trae 32 porque v2.2 agregó `R-OWN-REVIEWS` (spec 18).

| Código | Grupo | Nombre | Plan mínimo | Override por producto | Activa en demo | Parámetros (valores demo) | Canales | Reglas con ID que la citan |
|---|---|---|---|---|---|---|---|---|
| `R-AVAIL-RANGES` | Disponibilidad | Disponibilidad por rangos de fechas | Starter | sí | sí | — | Catálogo, Sitio web, Widget, Cotizaciones, Reservas | — |
| `R-CUTOFF` | Disponibilidad | Anticipación mínima de reserva | Starter | sí | sí | `defaultHours=48` | Sitio web, Widget, B2B | — |
| `R-WEEKDAYS` | Disponibilidad | Días de operación por semana | Starter | sí | sí | — | Sitio web, Widget | — |
| `R-HOLD` | Disponibilidad | Bloqueo temporal de cupos en el carrito | Starter | no | sí | `minutes=30` | Sitio web, Widget | — |
| `R-MIN-GROUP` | Disponibilidad | Grupo mínimo para garantizar la salida | Professional | sí | no | `minPax=2`, `decisionDays=3` | Operaciones, Sitio web | — |
| `R-MIN-ADULTS` | Pasajeros | Adulto responsable obligatorio | Starter | sí | sí | `minAdults=1`, `adultMinAge=11` | Sitio web, Widget, Cotizaciones, B2B | — |
| `R-CHILD-PER-ADULT` | Pasajeros | Límite de niños que pagan por adulto | Starter | sí | sí | `childMinAge=4`, `childMaxAge=10`, `maxChildrenPerAdult=2`, `childPricePct=70` | Sitio web, Widget, Cotizaciones, B2B | RES-V21-04 |
| `R-INFANT-FREE` | Pasajeros | Infantes sin costo y límite por adulto | Starter | sí | sí | `infantMaxAge=3`, `maxInfantsPerAdult=1` | Sitio web, Widget, Cotizaciones, B2B | OPS-V21-03, RES-V21-04 |
| `R-MAX-PAX` | Pasajeros | Máximo de pasajeros por reserva | Starter | sí | sí | `max=16` | Sitio web, Widget | — |
| `R-COMPANIONS` | Pasajeros | Datos de acompañantes | Starter | sí | sí | `when="al_reservar"`, `daysBeforeIfLater=7`, `requireDocument=true` | Sitio web, Widget, Portal cliente | CAN-V21-01 |
| `R-ALTITUDE` | Pasajeros | Declaración de salud para altura | Professional | sí | no | `minAltitude=3500` | Sitio web, Widget | — |
| `R-LODGING` | Alojamiento | Alojamiento opcional por ciudad | Professional | sí | sí | — | Sitio web, Widget, Cotizaciones | CAN-V21-01, RES-V21-01 |
| `R-LODGING-CAPACITY` | Alojamiento | Validar camas suficientes | Professional | no | sí | — | Sitio web, Widget, Cotizaciones | CAT-LG-03, OPS-V21-03 |
| `R-SINGLE-SUPP` | Alojamiento | Suplemento de habitación simple | Professional | sí | no | `pct=40` | Sitio web, Cotizaciones | — |
| `R-ADDONS` | Adicionales | Adicionales (entradas a museos, extensiones, comidas) | Professional | sí | sí | — | Sitio web, Widget, Cotizaciones, Portal cliente | CAN-V21-01, RES-V21-01 |
| `R-PROMO` | Precios | Códigos promocionales | Starter | no | sí | — | Sitio web, Widget | — |
| `R-GROUP-DISC` | Precios | Descuento por grupo | Professional | sí | no | `fromPax=6`, `pct=5` | Sitio web, Widget, Cotizaciones | — |
| `R-EARLY-BIRD` | Precios | Descuento por reserva anticipada | Professional | sí | no | `days=60`, `pct=7` | Sitio web, Widget | — |
| `R-LAST-MINUTE` | Precios | Recargo de última hora | Professional | sí | no | `days=3`, `pct=10` | Sitio web, Widget | — |
| `R-SEASON` | Precios | Factor de temporada | Starter | no | sí | — | Sitio web, Widget, Cotizaciones | — |
| `R-MULTICURRENCY` | Monedas y pagos | Mostrar precios en varias monedas | Professional | no | sí | `fxMarginPct=2` | Sitio web, Widget, Portal cliente | CAN-V21-01, CAN-V21-07, RES-V21-01 |
| `R-DEPOSIT` | Monedas y pagos | Pago con adelanto (porcentaje) | Starter | sí | sí | `pct=30`, `balanceDueDays=15` | Sitio web, Widget, Portal cliente, B2B | CAN-V21-01, RES-V21-01 |
| `R-PAY-LATER` | Monedas y pagos | Reservar ahora, pagar después | Enterprise | sí | no | `holdHours=24` | Sitio web, Widget | RES-V21-01 |
| `R-PAY-FEE` | Monedas y pagos | Recargo por medio de pago | Enterprise | no | no | `cardPct=3.5` | Sitio web, Widget | — |
| `R-PREVIEW-REMOVE` | Checkout | Previsualización con opción de quitar ítems | Starter | no | sí | — | Sitio web, Widget | — |
| `R-PICKUP` | Checkout | Punto de partida / recojo obligatorio | Starter | sí | sí | `askFlight=true` | Sitio web, Widget, Portal cliente | CAN-V21-01, RES-V21-01 |
| `R-COMMENTS` | Checkout | Comentarios del cliente | Starter | no | sí | `maxChars=1000` | Sitio web, Widget, Portal cliente | CAN-V21-01, RES-V21-01 |
| `R-NOMINATIVE` | Checkout | Documento obligatorio para entradas nominativas | Professional | sí | sí | — | Sitio web, Operaciones | — |
| `R-PAX-MESSAGES` | Comunicación | Mensajes automáticos al pasajero | Professional | no | sí | — | Comunicaciones | CAN-V21-01 |
| `R-PAX-FEEDBACK` | Comunicación | Comentarios del pasajero desde su panel | Professional | no | sí | — | Portal pasajero, App pasajero | CAN-V21-01, RES-V21-05 |
| `R-REVIEW-INVITE` | Comunicación | Invitación a reseña externa | Enterprise | no | no | `daysAfter=2` | Comunicaciones, Reseñas | — |
| `R-OWN-REVIEWS` | Comunicación | Reseñas propias verificadas | Professional | sí | sí | `daysAfter=1`, `minStarsAutoPublish=4`, `moderation=true` | Portal pasajero, Sitio web, Widget, Reseñas | RVW-01 |

### 2.1 Qué hace cada regla activable en cada módulo

**`R-AVAIL-RANGES` — Disponibilidad por rangos de fechas.** Define periodos disponibles, cerrados u ocupados y agotados por producto (p. ej. disponible 02–06 oct, ocupado 07–09 oct).

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Calendario con estados por día (`BE.month`: disponible, ocupado/cerrado, agotado, sin cupo para el grupo, fuera de plazo, no opera), leyenda de rangos (`BE.rangesSummary`) y «próxima fecha disponible» (`BE.nextAvailable`) (Si está apagada: Sin leyenda de rangos; el motor trata el producto como disponible (salidas programadas siguen mandando))
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Si está apagada, `dayStatus` ignora `availability` (Sección del Product 360: Disponibilidad (oculta))
- *17 §5 Reglas de negocio*: Rangos disponibles/cerrados/agotados — Calendario del widget y del simulador; resumen «Disponible del 02 al 06 oct · Ocupado del 07 al 09 oct…». Inactiva: no se listan rangos (`BookingEngine::dayStatus` (Service) + `availability` API)

**`R-CUTOFF` — Anticipación mínima de reserva.** Bloquea fechas dentro de las horas de anticipación del producto.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Días fuera de plazo / no operativos deshabilitados; nota «reserve con X h» (Si está apagada: Días habilitados)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Horas = `product.cutoff_hours` ‖ `advMin×24` ‖ `params.defaultHours` (Sección del Product 360: Disponibilidad › Operación)
- *17 §5 Reglas de negocio*: Anticipación mínima — Días «fuera de plazo» no seleccionables. Parámetro `defaultHours` usado si el producto no define `cutoffHours` ni `advMin` (Service)

**`R-WEEKDAYS` — Días de operación por semana.** El producto solo se vende los días de la semana configurados.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Días fuera de plazo / no operativos deshabilitados; nota «reserve con X h» (Si está apagada: Días habilitados)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Filtra por día de semana (Sección del Product 360: Disponibilidad › Operación)
- *17 §5 Reglas de negocio*: Días de operación — Días «no opera» deshabilitados (Service)

**`R-HOLD` — Bloqueo temporal de cupos en el carrito.** Reserva los cupos mientras el cliente paga.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Bloqueo de cupos `minutes` al añadir al carrito (`catalogHolds` con `productId/date`) (Si está apagada: Sin bloqueo ni temporizador)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Minutos de hold del checkout (solo tenant) (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Bloqueo de cupos — Parámetro `minutes` sincroniza `settings.holdMinutes` (carrito/checkout) (Service + lock Redis)

**`R-MIN-GROUP` — Grupo mínimo para garantizar la salida.** Si no se alcanza el mínimo X días antes, la salida se reprograma o reembolsa.

- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: No evaluada por el motor (job de operaciones, §8) (Sección del Product 360: Reglas (parámetros))

**`R-MIN-ADULTS` — Adulto responsable obligatorio.** Toda reserva requiere al menos un adulto.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Selector por tipo con edades del producto (`BE.paxRules`), chips de límites, validación en vivo (`BE.validatePax`), «+» deshabilitado al alcanzar el límite por adulto (Si está apagada: Chip y límite desaparecen; niños a tarifa adulto e infantes pagan (lo decide BE))
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: `minAdults = 0` si apagada (Sección del Product 360: Pasajeros)
- *17 §5 Reglas de negocio*: Composición del grupo — Widget: rótulos de edades, «no paga», ocultar infantes si `infantAllowed=false`, errores de `BE.validatePax` bloquean «Continuar». Parámetros sincronizan `ecommerce.defaultPaxRules` (productos sin reglas propias). Inactivas: sin límite y pagan tarifa completa (FormRequest + Service)

**`R-CHILD-PER-ADULT` — Límite de niños que pagan por adulto.** Niños de 4 a 10 años (configurable) pagan tarifa de niño; máximo N por adulto.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Selector por tipo con edades del producto (`BE.paxRules`), chips de límites, validación en vivo (`BE.validatePax`), «+» deshabilitado al alcanzar el límite por adulto (Si está apagada: Chip y límite desaparecen; niños a tarifa adulto e infantes pagan (lo decide BE))
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Apagada ⇒ sin máximo, `childPricePct=100` (Sección del Product 360: Pasajeros (sección oculta si también R-INFANT-FREE))
- *17 §5 Reglas de negocio*: Composición del grupo — Widget: rótulos de edades, «no paga», ocultar infantes si `infantAllowed=false`, errores de `BE.validatePax` bloquean «Continuar». Parámetros sincronizan `ecommerce.defaultPaxRules` (productos sin reglas propias). Inactivas: sin límite y pagan tarifa completa (FormRequest + Service)

**`R-INFANT-FREE` — Infantes sin costo y límite por adulto.** Menores de 3 años (configurable) no pagan y comparten asiento/cama; máximo N por adulto.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Selector por tipo con edades del producto (`BE.paxRules`), chips de límites, validación en vivo (`BE.validatePax`), «+» deshabilitado al alcanzar el límite por adulto (Si está apagada: Chip y límite desaparecen; niños a tarifa adulto e infantes pagan (lo decide BE))
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Apagada ⇒ sin máximo, `infantPays=true` (Sección del Product 360: Pasajeros)
- *17 §5 Reglas de negocio*: Composición del grupo — Widget: rótulos de edades, «no paga», ocultar infantes si `infantAllowed=false`, errores de `BE.validatePax` bloquean «Continuar». Parámetros sincronizan `ecommerce.defaultPaxRules` (productos sin reglas propias). Inactivas: sin límite y pagan tarifa completa (FormRequest + Service)

**`R-MAX-PAX` — Máximo de pasajeros por reserva.** Grupos mayores se derivan a cotización a medida.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Selector por tipo con edades del producto (`BE.paxRules`), chips de límites, validación en vivo (`BE.validatePax`), «+» deshabilitado al alcanzar el límite por adulto (Si está apagada: Chip y límite desaparecen; niños a tarifa adulto e infantes pagan (lo decide BE))
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Máximo = `product.max_pax` (Sección del Product 360: Pasajeros (lectura))
- *17 §5 Reglas de negocio*: Composición del grupo — Widget: rótulos de edades, «no paga», ocultar infantes si `infantAllowed=false`, errores de `BE.validatePax` bloquean «Continuar». Parámetros sincronizan `ecommerce.defaultPaxRules` (productos sin reglas propias). Inactivas: sin límite y pagan tarifa completa (FormRequest + Service)

**`R-COMPANIONS` — Datos de acompañantes.** Solicita nombre, documento, nacionalidad, fecha de nacimiento y parentesco de cada acompañante.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Paso «Acompañantes»: nombre, documento, nacionalidad, nacimiento (edad validada con `BE.ageType` en cada línea), parentesco, email/teléfono opcionales; con `antes_de_viaje` casilla «completar después» y botón «Completar acompañantes» en Mi cuenta (Si está apagada: Paso omitido; acompañantes como «Adulto 2 (por completar)»)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Checkout (spec 15); no afectan precio (Sección del Product 360: Reglas (parámetros) / Recojo (estado))
- *17 §5 Reglas de negocio*: Datos de acompañantes — Condición de la plantilla PMT-003 (solo si faltan documentos) (Job de programación)

**`R-ALTITUDE` — Declaración de salud para altura.** Casilla de declaración y recomendación médica en tours sobre 3 500 m s. n. m. (sin registrar diagnósticos).

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Declaración obligatoria en el pago si el itinerario supera la altitud (Puno 3 812 m, Humantay 4 200 m); solo se guarda la aceptación (Si está apagada: Sin declaración)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Checkout (spec 15); no afectan precio (Sección del Product 360: Reglas (parámetros) / Recojo (estado))

**`R-LODGING` — Alojamiento opcional por ciudad.** El cliente elige hotel, tipo y número de habitaciones por ciudad; se muestran total de habitaciones y noches.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: «Sin alojamiento / Incluir hoteles»; por ciudad: hotel, habitaciones por tipo, camas vs. personas, «Sugerir habitaciones», totales «X habitaciones · Y noches» (`quote.rooms/nights`) (Si está apagada: Sección oculta; líneas de hotel no se cotizan)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Apagada ⇒ `sel.lodging` se ignora (Sección del Product 360: Alojamiento)
- *17 §5 Reglas de negocio*: Alojamiento por ciudad — Paso «Alojamiento» (se oculta si inactiva), totales de habitaciones y noches, advertencia de camas, suplemento simple (Service)

**`R-LODGING-CAPACITY` — Validar camas suficientes.** Las habitaciones elegidas deben alojar a adultos y niños; los infantes comparten cama.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: «Sin alojamiento / Incluir hoteles»; por ciudad: hotel, habitaciones por tipo, camas vs. personas, «Sugerir habitaciones», totales «X habitaciones · Y noches» (`quote.rooms/nights`) (Si está apagada: Sección oculta; líneas de hotel no se cotizan)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Advierte si camas < adultos+niños por tramo (Sección del Product 360: Alojamiento (ejemplo))
- *17 §5 Reglas de negocio*: Alojamiento por ciudad — Paso «Alojamiento» (se oculta si inactiva), totales de habitaciones y noches, advertencia de camas, suplemento simple (Service)

**`R-SINGLE-SUPP` — Suplemento de habitación simple.** Cobra un recargo cuando un adulto viaja solo en habitación simple.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: «Sin alojamiento / Incluir hoteles»; por ciudad: hotel, habitaciones por tipo, camas vs. personas, «Sugerir habitaciones», totales «X habitaciones · Y noches» (`quote.rooms/nights`) (Si está apagada: Sección oculta; líneas de hotel no se cotizan)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Recargo `pct` sobre líneas de habitación Simple (Sección del Product 360: Reglas (parámetros))
- *17 §5 Reglas de negocio*: Alojamiento por ciudad — Paso «Alojamiento» (se oculta si inactiva), totales de habitaciones y noches, advertencia de camas, suplemento simple (Service)

**`R-ADDONS` — Adicionales (entradas a museos, extensiones, comidas).** Permite agregar servicios opcionales por pasajero o por reserva.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Adicionales con cantidad por tipo de pasajero (máx. = pasajeros de ese tipo) (Si está apagada: Sección oculta)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Apagada ⇒ `sel.addons` se ignora (Sección del Product 360: Adicionales)
- *17 §5 Reglas de negocio*: Adicionales — Paso «Adicionales» (se oculta si inactiva) (Service)

**`R-PROMO` — Códigos promocionales.** Acepta cupones de descuento vigentes.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Ajustes calculados solo por `BE.quote`; código promocional en el carrito (Si está apagada: Campo de código oculto / ajuste no aplicado)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Solo tenant (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Precios — Ajustes en el resumen y en el simulador; campo promo del simulador se oculta si R-PROMO inactiva (Service)

**`R-GROUP-DISC` — Descuento por grupo.** Descuento automático desde N pasajeros que pagan.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Ajustes calculados solo por `BE.quote`; código promocional en el carrito (Si está apagada: Campo de código oculto / ajuste no aplicado)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Ajustes sobre subtotal (Sección del Product 360: Reglas (parámetros))
- *17 §5 Reglas de negocio*: Precios — Ajustes en el resumen y en el simulador; campo promo del simulador se oculta si R-PROMO inactiva (Service)

**`R-EARLY-BIRD` — Descuento por reserva anticipada.** Descuento si se reserva con X días o más de anticipación.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Ajustes calculados solo por `BE.quote`; código promocional en el carrito (Si está apagada: Campo de código oculto / ajuste no aplicado)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Ajustes sobre subtotal (Sección del Product 360: Reglas (parámetros))
- *17 §5 Reglas de negocio*: Precios — Ajustes en el resumen y en el simulador; campo promo del simulador se oculta si R-PROMO inactiva (Service)

**`R-LAST-MINUTE` — Recargo de última hora.** Recargo si se reserva con menos de X días.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Ajustes calculados solo por `BE.quote`; código promocional en el carrito (Si está apagada: Campo de código oculto / ajuste no aplicado)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Ajustes sobre subtotal (Sección del Product 360: Reglas (parámetros))
- *17 §5 Reglas de negocio*: Precios — Ajustes en el resumen y en el simulador; campo promo del simulador se oculta si R-PROMO inactiva (Service)

**`R-SEASON` — Factor de temporada.** Aplica el factor de la temporada vigente en la fecha del servicio.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Ajustes calculados solo por `BE.quote`; código promocional en el carrito (Si está apagada: Campo de código oculto / ajuste no aplicado)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Solo tenant (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Precios — Ajustes en el resumen y en el simulador; campo promo del simulador se oculta si R-PROMO inactiva (Service)

**`R-MULTICURRENCY` — Mostrar precios en varias monedas.** El cliente elige la moneda de visualización; se cobra en las monedas de cobro configuradas.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Selector con todas las monedas activas; aviso «precio referencial; se cobra en PEN o USD» y TC aplicado (Si está apagada: Solo monedas de cobro)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Solo tenant (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Varias monedas — Selector de moneda del widget, simulador y configurador; inactiva → solo moneda base y aviso en `admin/monedas`. Parámetro `fxMarginPct` ⇄ `ecommerce.fxMarginPct` (Service)

**`R-DEPOSIT` — Pago con adelanto (porcentaje).** Permite pagar un porcentaje al reservar y el saldo antes del viaje.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Modalidades total / adelanto (% del producto o regla, saldo y vencimiento) / pagar después (bloqueo N h); recargo por tarjeta en el total (Si está apagada: Modalidad o recargo desaparecen)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Apagada ⇒ se quita `adelanto` de `modes` (Sección del Product 360: Pago)
- *17 §5 Reglas de negocio*: Pagos — Modalidades del resumen (adelanto, pagar después), adelanto/saldo/vencimiento, recargo con tarjeta en simulador. R-DEPOSIT también condiciona PMT-002 (Service + FormRequest checkout)

**`R-PAY-LATER` — Reservar ahora, pagar después.** Reserva sin pago con bloqueo de cupos por X horas; se libera si no se paga.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Modalidades total / adelanto (% del producto o regla, saldo y vencimiento) / pagar después (bloqueo N h); recargo por tarjeta en el total (Si está apagada: Modalidad o recargo desaparecen)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Encendida ⇒ se **agrega** `pagar_despues` a `modes` (Sección del Product 360: Pago (checkbox = override de la regla))
- *17 §5 Reglas de negocio*: Pagos — Modalidades del resumen (adelanto, pagar después), adelanto/saldo/vencimiento, recargo con tarjeta en simulador. R-DEPOSIT también condiciona PMT-002 (Service + FormRequest checkout)

**`R-PAY-FEE` — Recargo por medio de pago.** Traslada al cliente un % por pago con tarjeta (verificar normativa y contrato con la pasarela).

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Modalidades total / adelanto (% del producto o regla, saldo y vencimiento) / pagar después (bloqueo N h); recargo por tarjeta en el total (Si está apagada: Modalidad o recargo desaparecen)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Solo tenant (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Pagos — Modalidades del resumen (adelanto, pagar después), adelanto/saldo/vencimiento, recargo con tarjeta en simulador. R-DEPOSIT también condiciona PMT-002 (Service + FormRequest checkout)

**`R-PREVIEW-REMOVE` — Previsualización con opción de quitar ítems.** Antes de pagar, el cliente revisa el resumen y puede quitar adicionales y alojamiento.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Botón «Quitar/Restaurar» en adicionales y alojamiento de la previsualización (siempre obligatoria); ítems base no removibles (Si está apagada: Previsualización sin botones)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Solo tenant (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Quitar ítems — Botones «Quitar/Restaurar» en líneas `removable` (adicionales y alojamiento). Inactiva: el resumen se muestra igual, sin botones (Service (`removed[]` validado en servidor))

**`R-PICKUP` — Punto de partida / recojo obligatorio.** Solicita punto de recojo o dirección del hotel, y vuelo de llegada si aplica.

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Paso «Recojo y comentarios»: puntos del producto u «otra dirección / hotel», vuelo y llegada (obligatorios si el punto es aeropuerto), comentarios con contador (Si está apagada: Campo/paso omitido)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Checkout pide punto/vuelo (Sección del Product 360: Recojo)

**`R-COMMENTS` — Comentarios del cliente.** Campo libre para pedidos especiales (dietas, celebraciones, accesibilidad).

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Paso «Recojo y comentarios»: puntos del producto u «otra dirección / hotel», vuelo y llegada (obligatorios si el punto es aeropuerto), comentarios con contador (Si está apagada: Campo/paso omitido)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Otros módulos (Sección del Product 360: —)

**`R-NOMINATIVE` — Documento obligatorio para entradas nominativas.** Exige documento de todos los pasajeros cuando el producto incluye entradas nominativas (Machu Picchu).

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Documento obligatorio de acompañantes en productos con entradas nominativas (Machu Picchu) (Si está apagada: Según `requireDocument`)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Checkout (spec 15); no afectan precio (Sección del Product 360: Reglas (parámetros) / Recojo (estado))

**`R-PAX-MESSAGES` — Mensajes automáticos al pasajero.** Envía mensajes programados (confirmación, previaje, día del servicio, postviaje).

- *15 §5 Reglas de negocio › §5.1 v2.1 — Reglas configurables que gobiernan el sitio (`DB.settings.bookingRules`)*: Comportamiento en el sitio: Al confirmar, plantillas activas del evento (`reserva_confirmada`; `reserva_creada`/`reserva_pendiente_pago` si existen) → `DB.paxMessages` enviado/programado según `offsetHours`, respetando `conditions` (Si está apagada: No se generan mensajes)
- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Otros módulos (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Mensajes automáticos — Apagada: aviso, se retiran los `programado` automáticos y no se programa; envíos manuales siguen disponibles (Job `SchedulePaxMessages`)

**`R-PAX-FEEDBACK` — Comentarios del pasajero desde su panel.** El pasajero envía comentarios o incidencias durante y después del viaje.

- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Otros módulos (Sección del Product 360: —)

**`R-REVIEW-INVITE` — Invitación a reseña externa.** Tras el viaje invita a dejar reseña en TripAdvisor, Trustpilot o Google (según integración activa).

- *16 §5 Reglas de negocio › §5.1 Centro de reglas: qué gobierna cada una en el motor y en el Product 360*: Efecto exacto en `BookingEngine`: Otros módulos (Sección del Product 360: —)
- *17 §5 Reglas de negocio*: Invitación a reseña — Plantilla PMT-009 (desfase `daysAfter × 24 h`) y pestaña «Invitaciones». Inactiva: aviso y sin invitaciones (Job + Policy)

**`R-OWN-REVIEWS` — Reseñas propias verificadas.** Solicita calificación y reseña a los pasajeros después del viaje; se moderan y publican en el sitio y el widget con sello de «viaje verificado».

- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Sub-navegación «Califica tu viaje (n)» y ruta `#/canales/portal-pasajero/resena`: Solo si `effective(R-OWN-REVIEWS)` para el producto de la reserva y hay servicios calificables o reseñas previas; `n` = productos pendientes de calificar
- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Aviso en «Mi viaje»: «Califica tu viaje. Ya puede calificar n servicio(s)…» con enlace
- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Elegibilidad: Reserva `completada` → todos sus productos; `en_operacion` → servicios `completado` o con fecha pasada (demo: Thomas Keller, RES-2026-000347, hasta 02/10: Traslado aeropuerto y Cusco Mágico); nota «Su viaje sigue en curso…»
- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Formulario: Producto a calificar, estrellas 1–5 (obligatorio), subcalificaciones activas (guía, transporte, alojamiento, organización, calidad-precio; opcionales), título, texto (20–2000), fotos (`input file`, en la demo solo se registra el nombre), idioma (por nacionalidad: alemana → alemán), casilla de consentimiento sin marcar
- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Resultado: Modal según estado: publicada (autopublicación), en revisión (moderación / alertas) o solo para la agencia (sin consentimiento)
- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Mis reseñas: Estado para el pasajero («En revisión», «Publicada», «No publicada», «Solo para la agencia») y respuesta de la agencia; la respuesta también llega a Mensajes
- *08 §5 Reglas de negocio › §5.7 v2.2 — Califica tu viaje (R-OWN-REVIEWS)*: Regla apagada / plan Starter: Desaparecen sub-navegación, aviso y sección (URL directa → Mi viaje)
- *15 §5 Reglas de negocio › §5.2 v2.2 — Reseñas propias verificadas en el sitio (R-OWN-REVIEWS)*: Tarjeta de producto: Si hay reseñas propias publicadas: estrellas, promedio, (n) y sello «Viaje verificado»; si no, la calificación de catálogo existente
- *15 §5 Reglas de negocio › §5.2 v2.2 — Reseñas propias verificadas en el sitio (R-OWN-REVIEWS)*: Cabecera de la ficha: Chip «Viaje verificado · promedio (n)» que desplaza al bloque
- *15 §5 Reglas de negocio › §5.2 v2.2 — Reseñas propias verificadas en el sitio (R-OWN-REVIEWS)*: Ficha: «Reseñas de viajeros verificados»: Promedio, % recomienda, distribución 5→1, subcalificaciones activas, texto de política (sin moderar por nota), filtro por estrellas (Todas / 5…1 con conteo), 4 reseñas y «Ver las N reseñas»; cada reseña con sello, título, texto, subcalificaciones, respuesta de «Andes Horizonte», autor abreviado, país y fecha de viaje; rótulo «ejemplo (demo)» en las semilla. Va **antes** del bloque de reseñas externas, que sigue rotulado «Reseñas de ejemplo (demo)»
- *15 §5 Reglas de negocio › §5.2 v2.2 — Reseñas propias verificadas en el sitio (R-OWN-REVIEWS)*: Inicio: Sección «Opiniones de viajeros verificados» (3 últimas y promedio global) antes de las reseñas externas
- *15 §5 Reglas de negocio › §5.2 v2.2 — Reseñas propias verificadas en el sitio (R-OWN-REVIEWS)*: Idioma EN: Textos traducidos (Verified trip, Reviews from verified travelers, etc.)
- *15 §5 Reglas de negocio › §5.2 v2.2 — Reseñas propias verificadas en el sitio (R-OWN-REVIEWS)*: Apagado: Regla inactiva, plan sin la regla, producto con `ruleOverrides['R-OWN-REVIEWS']=false` o `show_on_site=false` → no se muestra nada ni se emite `aggregateRating`

## 3. Reglas transversales (RT-n)

Numeración heredada de la documentación inicial: `RT-n` = regla transversal n de DOC-PROC-001 §30 («Regla transversal n»). Cada módulo la aplica con su propio ID; esta tabla agrupa dónde aparece cada una.

| RT | Texto (primera aparición) | Aparece como |
|---|---|---|
| RT-1 | Toda solicitud autenticada pertenece a un tenant válido y activo; sin tenant → 401/403 | PRD-BR-001 (02), SEC-BR-01 (00) |
| RT-2 | El tenant se resuelve **solo** desde el token (y se contrasta con el host `{slug}.dominio`); se ignora cualquier `tenant_id`/`X-Tenant-Id` del cliente. Recurso de otro tenant → **404** `RESOURCE_NOT_FOUND`; ruta que intenta fijar otro tenant → **403** `TENANT_SCOPE_VIOLATION`; ambos se auditan como  | SEC-BR-02 (00) |
| RT-3 | Solo una cotización `aprobada` genera reserva | CRM-BR-23 (01), RT-3 (04) |
| RT-4 | No se confirma, convierte, reprograma ni agrega pax/servicio sin disponibilidad; POR_SALIDA con cupo `capacity − sold ≥ pax` | PRD-BR-012 (02), RT-4 (04), RT-4 (08) |
| RT-5 | El precio se recalcula en backend; el frontend solo previsualiza (endpoint `pricing/preview`) | RT-5 (03), SEC-BR-18 (00) |
| RT-7 | Versión `aprobada` inmutable; versiones no vigentes consultables y no editables (PRD-BR-017) | QTE-BR-19 (03) |
| RT-8 | Cancelación: motivo obligatorio, penalidad por política snapshot (§4.6), auditada | RES-BR-30 (04) |
| RT-9 | Todo pago se asocia a una obligación: registrar exige CxC con saldo > 0 no cancelada; aplicar exige CxC de la misma reserva y moneda. Mensaje: "Regla transversal 9: el pago debe asociarse a una obligación" | RES-BR-40 (04), RT-9 (07), RT-9 (08) |
| RT-10 | Facturación con datos fiscales válidos (§5.7) | CRM-BR-15 (01), RT-10 (07) |
| RT-11 | Solo servicios `confirmado` o `completado` emiten voucher | RT-11 (05), RT-11 (08) |
| RT-12 | Asignación requiere al menos un recurso y servicio no cancelado | RT-12 (05) |
| RT-13 | Un pasajero no puede figurar en más de una habitación del mismo intervalo (misma lista u otra lista del mismo o distinto hotel con fechas superpuestas) | RT-13 (05) |
| RT-14 | B2B por agencia/producto/vigencia | RT-14 (02), RT-14 (07), RT-14 (08) |
| RT-15 | Moneda y TC conservados | RT-15 (02), RT-15 (07), SEC-BR-19 (00) |
| RT-16 | Toda acción de §9 se audita | PRD-BR-014 (02), RT-16 (01), RT-16 (05), RT-16 (06), RT-16 (07), SEC-BR-15 (00) |
| RT-17 | Cada botón oculto/deshabilitado en UI se revalida en API (403) | RT-17 (01), RT-17 (05), RT-17 (07), SEC-BR-03 (00) |
| RT-19 | Toda acción móvil lleva `client_action_id` (UUID v7) y es idempotente en servidor | RT-19 (05) |
| RT-22 | Conversión idempotente: una cotización genera como máximo una reserva (aunque se cancele) | RT-19 (05), RT-22 (04), RT-22 (07), SEC-BR-16 (00) |
| RT-23 | Documentos vinculados al origen (comprobante → CxC → reserva; NC → comprobante) | RT-23 (07) |
| RT-24 | Sin borrado físico; leads descartados/duplicados permanecen en historial | PRD-BR-018 (02), RT-24 (01), RT-24 (07), SEC-BR-21 (00) |

## 4. Reglas por especificación

### 00 · Transversal (seguridad y RBAC) (`00-transversal-seguridad-rbac.md`) — 25 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `SEC-BR-01` | PRD-BR-001 / RT-1 | §5 Reglas de negocio transversales | Toda solicitud autenticada pertenece a un tenant válido y activo; sin tenant → 401/403 | Middleware `ResolveTenant` + `EnsureTenantActive` | Middleware |  |
| `SEC-BR-02` | PRD-BR-015 / RT-2 / E2E-08 | §5 Reglas de negocio transversales | El tenant se resuelve **solo** desde el token (y se contrasta con el host `{slug}.dominio`); se ignora cualquier `tenant_id`/`X-Tenant-Id` del cliente. Recurso de otro tenant → **404** `RESOURCE_NOT_FOUND`; ruta que intenta fijar otro tenant → **403** `TENANT_SCOPE_VIOLATION`; ambos se auditan como `acceso_denegado` | Middleware + global scope `BelongsToTenant` + RLS | Policy · Middleware · BD |  |
| `SEC-BR-03` | PRD-BR-011 / RT-17 | §5 Reglas de negocio transversales | El backend valida permisos en cada endpoint (Policy + permiso spatie). El frontend solo refleja (oculta/deshabilita); ocultar un botón no concede ni retira acceso | Policy | Policy |  |
| `SEC-BR-04` |  | §5 Reglas de negocio transversales | Cada pantalla exige “cualquiera de” los permisos de `ACCESS`; se busca el prefijo de ruta más largo definido; `*` = cualquier rol interno | Middleware Next + endpoint `GET /me/access` | Middleware · UI |  |
| `SEC-BR-05` |  | §5 Reglas de negocio transversales | Roles externos (guide, driver, b2b, customer, passenger, provider) nunca acceden al back-office: solo a las rutas de su experiencia (`ROLE_UX.routes`). Mensaje: “Esta pantalla pertenece al back-office interno de la agencia y no está disponible para usuarios externos (rol)” | Middleware `EnsureExperience` (ability del token) | Policy · Middleware |  |
| `SEC-BR-06` |  | §5 Reglas de negocio transversales | Super Admin SaaS solo accede a `admin/tenants`, `admin/plataforma`, `admin/integraciones`, `admin/auditoria`; no opera datos comerciales de tenants | Guard `platform` + rutas `/api/v1/platform/*` | Middleware |  |
| `SEC-BR-07` |  | §5 Reglas de negocio transversales | Cada acceso denegado (403 de pantalla o endpoint) se audita: entidad `Acceso`, id = ruta, before = rol, after = `requiere p1 \| p2` o `fuera del alcance del rol` | Exception handler | Middleware |  |
| `SEC-BR-08` |  | §5 Reglas de negocio transversales | MFA TOTP para roles internos (obligatorio según política 09 §12-4); tokens sin MFA verificado no acceden a recursos | Middleware `EnsureMfaVerified` | Middleware |  |
| `SEC-BR-09` |  | §5 Reglas de negocio transversales | *(Ownership Ventas)* Rol `sales`: listados, KPIs, tablero, búsquedas y reportes limitados a registros con `owner_id = auth.id` (leads también sin asignar en contadores); detalle ajeno → 403 con mensaje “pertenece a la cartera de otro asesor… solicite a su gerente la reasignación” | Policy `view` + scope `OwnedBy` + filtro `owner=me` forzado | Policy |  |
| `SEC-BR-10` |  | §5 Reglas de negocio transversales | Alcance de clientes de Ventas = clientes propios ∪ clientes de sus oportunidades, cotizaciones y reservas | Scope `Scope.clientIds()` | Policy |  |
| `SEC-BR-11` |  | §5 Reglas de negocio transversales | Gerente y Tenant Admin ven todo el tenant y disponen de filtro “Asesor” | Policy | Policy |  |
| `SEC-BR-12` |  | §5 Reglas de negocio transversales | Usuario externo solo ve sus datos: cliente → `client_id`; pasajero → `reservation_id`; B2B → `agency_id`; proveedor → `provider_id`; guía/conductor → `guide_id`/`driver_id`. Un cliente que abre `portal-cliente/{otro}` es redirigido al suyo | Policy por recurso + scope | Policy |  |
| `SEC-BR-13` |  | §5 Reglas de negocio transversales | *(datos sensibles)* Costos de proveedor, márgenes y utilidad solo con `finance.profitability`, `catalog.products.view_profitability` o `quotes.approve_internal`; Ventas ve margen solo de sus cotizaciones; Operaciones ve costos de proveedor pero no márgenes ni utilidad; externos nunca ven costos | `JsonResource` condicional (`when(can)`) | Resource |  |
| `SEC-BR-14` |  | §5 Reglas de negocio transversales | Acción no permitida: no se muestra activa (oculta o deshabilitada con “Requiere permiso x.y”); si llega por otra vía → 403 y sin cambios | Frontend + Policy | Policy · UI |  |
| `SEC-BR-15` | PRD-BR-014 / RT-16 | §5 Reglas de negocio transversales | Acciones críticas auditadas (lista §9) | `AuditLogger` | Service |  |
| `SEC-BR-16` | RT-22 | §5 Reglas de negocio transversales | Operaciones críticas exigen `Idempotency-Key`; misma key + mismo cuerpo → misma respuesta; misma key + cuerpo distinto → 422 `IDEMPOTENCY_KEY_REUSED`; key en proceso → 409 `IDEMPOTENCY_IN_PROGRESS` | Middleware `Idempotent` | Middleware |  |
| `SEC-BR-17` |  | §5 Reglas de negocio transversales | Recursos con `lock_version` requieren `If-Match`; desfase → 409 `STALE_VERSION` | Trait `OptimisticLock` | Service |  |
| `SEC-BR-18` | PRD-BR-010 / RT-5 | §5 Reglas de negocio transversales | Precios calculados en backend con `PricingService` (§5.1); el frontend solo previsualiza | Service | Service |  |
| `SEC-BR-19` | RT-15 | §5 Reglas de negocio transversales | Moneda y `fx_rate` se congelan en cada documento; conversión a PEN = `monto × fx` si USD | Service | Service |  |
| `SEC-BR-20` |  | §5 Reglas de negocio transversales | Correlativos: asignación atómica (`SELECT … FOR UPDATE` en `sys_sequences`), sin huecos por rollback en documentos fiscales (se asigna al confirmar), nunca retroceden | Service + trigger | Service · BD |  |
| `SEC-BR-21` | RT-24 | §5 Reglas de negocio transversales | Sin borrado físico de registros con historia: `deleted_at` / baja lógica | Modelos `SoftDeletes` | BD |  |
| `SEC-BR-22` |  | §5 Reglas de negocio transversales | Una notificación fallida no revierte la transacción de negocio (listener en cola tras commit: `afterCommit`) | Listener | Job/Listener |  |
| `SEC-BR-23` |  | §5 Reglas de negocio transversales | Exportar datos requiere permiso de exportación y se audita (`exportar`, `exportar_denegado`, `descargar`) | Policy | Policy |  |
| `SEC-BR-24` |  | §5 Reglas de negocio transversales | Tenant suspendido → 403 `TENANT_SUSPENDED` en login y solicitudes | Middleware | Middleware |  |
| `SEC-BR-25` |  | §5 Reglas de negocio transversales | Rate limit: login 5/min por IP+email; API 120/min por usuario; exportaciones 10/h por usuario (Redis) | `RateLimiter` | Middleware |  |

### 01 · CRM (`01-crm.md`) — 51 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `CRM-BR-01` | PROC-004 | §5 Reglas de negocio | Lead: obligatorios nombre, canal, fuente, interés | FormRequest `StoreLeadRequest` | FormRequest |  |
| `CRM-BR-02` |  | §5 Reglas de negocio | Al menos correo **o** teléfono. Correo con formato `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`; teléfono ≥ 7 dígitos. Mensaje: "Validación PROC-004: registre al menos correo o teléfono." | FormRequest + CHECK DB | FormRequest · BD |  |
| `CRM-BR-03` |  | §5 Reglas de negocio | Detección de duplicados en alta y edición de lead: coincidencia por `email_norm` (minúsculas, trim) o `phone_norm` (últimos 9 dígitos) contra **leads** (excepto el propio) **y clientes**. Resultado: lista con tipo, id, nombre, estado/segmento y campo(s) coincidente(s) | Service `LeadDuplicateFinder` | Service |  |
| `CRM-BR-04` |  | §5 Reglas de negocio | Si hay duplicados al registrar, el alta exige decisión explícita: `merge` (solo si hay un lead coincidente en nuevo/contactado/calificado), `mark_duplicate` (de la 1ª coincidencia) o `create_new` (queda nota "Registrado pese a coincidencia con X"). Sin decisión → `409 CRM-BR-04` con las coincidencias | Service | Service |  |
| `CRM-BR-05` |  | §5 Reglas de negocio | Fecha tentativa de viaje no puede ser anterior a hoy (zona del tenant) | FormRequest | FormRequest |  |
| `CRM-BR-06` | PRD-BR-002 | §5 Reglas de negocio | Producto de interés: solo productos `ACTIVE` o `APPROVED` | FormRequest (exists + status) | FormRequest |  |
| `CRM-BR-07` |  | §5 Reglas de negocio | Score inicial = min(70, 25 + 8·correo + 8·teléfono + 10·fecha + 5·(pax>0) + 8·producto + 4·empresa + 6·(fuente Referido o Llamada entrante)) | Service | Service |  |
| `CRM-BR-08` |  | §5 Reglas de negocio | "Tomar lead": solo leads sin owner y no convertidos/descartados. Operación atómica (`UPDATE … WHERE owner_id IS NULL`); si otro asesor lo tomó antes → `409` "Otro asesor tomó el lead antes que usted". Crea actividad Llamada "Primer contacto — {nombre}" hoy a la hora (ahora+2 h, tope 20:00); notifica a todos los Manager activos | Service + lock optimista | Service |  |
| `CRM-BR-09` |  | §5 Reglas de negocio | Asignar/reasignar leads, oportunidades, actividades y clientes entre asesores: solo supervisor (Tenant Admin, Manager) con `crm.leads.manage`. Mensaje a Ventas: "Solo Gerencia o el Administrador pueden reasignar…". Reasignar exige asesor distinto al actual; motivo opcional. Al asignar un lead se puede programar primer contacto (+2 h) | Policy `reassign` (permiso nuevo `crm.records.reassign`, ver §11) | Policy |  |
| `CRM-BR-10` |  | §5 Reglas de negocio | Pasar a `calificado` exige score ≥ 50 ("PROC-005: para marcar como calificado el score debe ser ≥ 50") | Service (state machine) | Service |  |
| `CRM-BR-11` |  | §5 Reglas de negocio | Avanzar un lead más allá de `nuevo` exige responsable ("PROC-004: asigne un responsable antes de avanzar el lead") | Service + CHECK DB | Service · BD |  |
| `CRM-BR-12` | PROC-005 | §5 Reglas de negocio | Solo leads `calificado` se convierten; requiere `crm.leads.manage` y `crm.opportunities.manage` | Policy + Service | Policy · Service |  |
| `CRM-BR-13` |  | §5 Reglas de negocio | "Convertido" y "Descartado" no se eligen en "Cambiar estado"; solo con sus acciones específicas (trazabilidad) | FormRequest (`status in nuevo,contactado,calificado`) | FormRequest |  |
| `CRM-BR-14` |  | §5 Reglas de negocio | Descartar exige motivo del catálogo (+ detalle opcional); el lead no se elimina (RT-24); las actividades pendientes del lead se cierran automáticamente | Service | Service |  |
| `CRM-BR-15` | RT-10 | §5 Reglas de negocio | Documento de cliente: DNI = 8 dígitos; RUC = 11 dígitos iniciando en 10, 15, 17 o 20; empresa con país Perú requiere RUC; número obligatorio | FormRequest `ClientDocumentRule` + CHECK | FormRequest · BD |  |
| `CRM-BR-16` |  | §5 Reglas de negocio | No puede existir otro cliente con el mismo tipo+número de documento (bloqueante: "Ya existe un cliente con … Vincúlelo") | Service + UNIQUE DB | Service · BD |  |
| `CRM-BR-17` |  | §5 Reglas de negocio | Cliente: correo o teléfono obligatorio; si correo/teléfono coincide con otro cliente → advertencia con confirmación ("Guardar igualmente"), no bloqueante (`confirm_duplicate=true`) | FormRequest + Service | FormRequest · Service |  |
| `CRM-BR-18` |  | §5 Reglas de negocio | Conversión: si el contacto ya existe como cliente se propone "Vincular a cliente existente". Al vincular, si el correo del lead no está en el cliente ni en sus contactos se agrega como contacto no principal. Cliente nuevo: owner = owner del lead (o actor), tags = [fuente], `source_lead_id`; empresa → contacto principal = persona del lead. Segmento sugerido: Corporativo si interés "corporativo"; Grupos si "promoción" o pax ≥ 10; si no Retail | Service `ConvertLeadAction` (transacción única) | Service |  |
| `CRM-BR-19` | PROC-005 | §5 Reglas de negocio | La conversión conserva el lead (estado `convertido` + `converted_client_id`, `converted_opportunity_id`, `converted_at`, `converted_by`); su historial y actividades se muestran en el 360 y en la oportunidad | Service | Service |  |
| `CRM-BR-20` |  | §5 Reglas de negocio | Oportunidad: cliente, responsable, título, monto, moneda (PEN/USD), fecha de cierre obligatorios; monto > 0; en alta, fecha de cierre ≥ hoy; probabilidad editable 0–100 solo en edición | FormRequest | FormRequest |  |
| `CRM-BR-21` |  | §5 Reglas de negocio | Ventas solo puede crear oportunidades para clientes de su cartera y siempre como owner | Policy + FormRequest | FormRequest · Policy |  |
| `CRM-BR-22` |  | §5 Reglas de negocio | Cambio de etapa fija probabilidad = default de la etapa (ganada 100, perdida 0) y `closed_at` para cerradas | Service | Service |  |
| `CRM-BR-23` | RT-3 | §5 Reglas de negocio | Ganar sin cotización aprobada/convertida está permitido con advertencia ("la reserva se genera desde la cotización aprobada") | Service (warning en respuesta `meta.warnings`) | Service |  |
| `CRM-BR-24` | PROC-006 | §5 Reglas de negocio | Perder exige motivo; "Otro" exige detalle | FormRequest | FormRequest |  |
| `CRM-BR-25` |  | §5 Reglas de negocio | No se puede crear cotización desde una oportunidad cerrada ("PROC-006: no se puede cotizar una oportunidad cerrada"); requiere `quotes.create` | Policy (módulo Cotizaciones) | Policy |  |
| `CRM-BR-26` |  | §5 Reglas de negocio | Reabrir una oportunidad cerrada requiere confirmación y queda auditado | Service | Service |  |
| `CRM-BR-27` |  | §5 Reglas de negocio | Sincronización desde Cotizaciones: alta → `cotizacion` (si estaba en calificación/descubrimiento); negociación → `negociacion`; conversión en reserva → `ganada` | Listener de eventos de Cotizaciones | Job/Listener |  |
| `CRM-BR-28` | PROC-007 | §5 Reglas de negocio | Actividad: tipo, asunto, responsable, fecha y hora obligatorios; si hay tipo de relación, el registro relacionado es obligatorio y debe ser visible para el actor | FormRequest | FormRequest |  |
| `CRM-BR-29` |  | §5 Reglas de negocio | Completar exige resultado; la próxima actividad (activada por defecto) exige asunto, fecha y hora; hereda relación y responsable | FormRequest + Service | FormRequest · Service |  |
| `CRM-BR-30` |  | §5 Reglas de negocio | Completar una actividad de tipo Llamada/Email/WhatsApp/Reunión vinculada a un lead en `nuevo` lo pasa a `contactado` | Listener `ActivityCompleted` | Job/Listener |  |
| `CRM-BR-31` |  | §5 Reglas de negocio | Ventas: solo puede ser responsable de sus actividades; completa/reprograma solo las propias. Supervisor asigna a asesores (Tenant Admin, Manager, Ventas activos) o a usuarios de Operaciones activos | Policy + FormRequest | FormRequest · Policy |  |
| `CRM-BR-32` |  | §5 Reglas de negocio | Reprogramar: fecha y hora obligatorias, motivo opcional; la actividad vuelve a `pendiente`. (El prototipo no impide una fecha pasada; propuesta: `due_at ≥ now()`, ver §12) | FormRequest | FormRequest |  |
| `CRM-BR-33` | PROC-008 | §5 Reglas de negocio | Ventas ve en el 360 solo los clientes de su cartera: `owner` = yo **o** con oportunidad/cotización/reserva mía. Dentro del 360 solo ve sus oportunidades, cotizaciones, reservas, actividades y las CxC/pagos/comprobantes/vouchers de sus reservas; leads: propios o sin asignar | Policy + scopes Eloquent | Policy |  |
| `CRM-BR-34` |  | §5 Reglas de negocio | KPIs del cliente: total comprado = Σ reservas no `cancelada`/`borrador` en PEN; ticket promedio = total / nº; saldo = Σ(monto − pagado) de CxC no `pagada`/`cancelada`; vencida si estado `vencida` o vencimiento < hoy (alerta "Coordine con Finanzas antes de nuevas reservas a crédito") | Read model / Query | Query/Read model |  |
| `CRM-BR-35` |  | §5 Reglas de negocio | Enviar comunicación desde el 360: canal Email/WhatsApp/Portal, asunto obligatorio; requiere destino (correo para Email, teléfono para WhatsApp) | FormRequest + Service | FormRequest · Service |  |
| `CRM-BR-36` |  | §5 Reglas de negocio | Contactos: nombre obligatorio; el primero es principal; "Hacer principal" desmarca los demás | Service + UNIQUE parcial | Service · BD |  |
| `CRM-BR-37` | PROC-009 | §5 Reglas de negocio | Viajes por cerrar: reservas `completada` con fin de viaje en los últimos 60 días, o `en_operacion` que terminan en ≤ 5 días | Query | Query/Read model |  |
| `CRM-BR-38` |  | §5 Reglas de negocio | Encuesta: cliente y puntaje 0–10 obligatorios; reserva opcional (no cancelada, visible para el actor); encuestar un viaje aún en operación muestra aviso, no bloquea | FormRequest | FormRequest |  |
| `CRM-BR-39` |  | §5 Reglas de negocio | NPS ≤ 6 (detractor) genera automáticamente: caso `Reclamo` (prioridad `alta` si ≤ 3, si no `media`; owner = responsable del cliente; asunto "Detractor NPS n — reserva"), actividad Postventa "Resolver REC-… — contactar a …" mañana 10:00 y notificación Email al responsable | Listener `DetractorDetected` (misma transacción que la encuesta) | Service · Job/Listener |  |
| `CRM-BR-40` |  | §5 Reglas de negocio | La última encuesta actualiza `crm_clients.nps_last` (audit `actualizar_nps`) | Service | Service |  |
| `CRM-BR-41` |  | §5 Reglas de negocio | Una sola encuesta por reserva ("La reserva … ya tiene una encuesta registrada") | UNIQUE parcial + Service | Service · BD |  |
| `CRM-BR-42` |  | §5 Reglas de negocio | NPS = round((% promotores − % detractores)·100); promotor 9–10, pasivo 7–8, detractor 0–6 | Read model | Query/Read model |  |
| `CRM-BR-43` |  | §5 Reglas de negocio | Caso: cliente, asunto, descripción y responsable obligatorios; Felicitación nace `cerrada`; resolver exige texto; notificación al cliente al cerrar | FormRequest + Service | FormRequest · Service |  |
| `CRM-BR-44` |  | §5 Reglas de negocio | Gestionar un caso: `crm.clients.manage` y, para Ventas, ser owner del caso o tener al cliente en cartera | Policy | Policy |  |
| `CRM-BR-45` | PROC-010 | §5 Reglas de negocio | Recompra: requiere `crm.opportunities.manage` y cliente visible. Si el cliente ya tiene oportunidades abiertas se pide confirmación. Precarga: título "Recompra — {cliente} — {sugerencia}", destino sugerido por mapa (Cusco→Arequipa y Cañón del Colca; Arequipa→Cusco y Machu Picchu; Ica→Cusco y Valle Sagrado; Machu Picchu→Lago Titicaca — Puno; Puno→Paracas e Islas Ballestas; por defecto Cusco y Machu Picchu), monto = ticket promedio (o 4 000), PEN, `calificacion`, cierre +30 d, origen "Fidelización"; audit `Cliente accion_fidelizacion` | Service + FormRequest | FormRequest · Service |  |
| `CRM-BR-46` |  | §5 Reglas de negocio | Segmentación: filtros segmento, última compra (≤ 30 d, > 90 d, > 180 d, sin compras) y destino visitado (departamento de los productos reservados + destinos de oportunidades ganadas) | Query | Query/Read model |  |
| `CRM-BR-47` |  | §5 Reglas de negocio | Alcance por rol obligatorio en backend en listas, KPIs, búsquedas, selects de relación y exportaciones (ver §7) | Global scope + Policy | Policy |  |
| `CRM-BR-48` |  | §5 Reglas de negocio | KPIs consolidados en PEN con el tipo de cambio vigente del tenant (`settings.fx`); los montos de cada registro se conservan en su moneda (RT-15) | Read model | Query/Read model |  |
| `RT-16` | PROC-063 | §5 Reglas de negocio | Toda acción de §9 se audita | Observer/Service | Service · Job/Listener |  |
| `RT-17` |  | §5 Reglas de negocio | Cada botón oculto/deshabilitado en UI se revalida en API (403) | Policy | Policy |  |
| `RT-24` |  | §5 Reglas de negocio | Sin borrado físico; leads descartados/duplicados permanecen en historial | Sin endpoint DELETE | BD |  |

### 02 · Catálogo (`02-catalogo.md`) — 64 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `PRD-BR-001` | PRD-BR-015 / RT-1 | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | *(2)* Tenant válido, aislamiento | P + RLS; 404 | Policy · BD |  |
| `PRD-BR-002` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Producto no ACTIVE no se usa en nuevas ventas | S (catálogo, cotizador, reservas, canales) | Service |  |
| `PRD-BR-003` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Fuera de vigencia no seleccionable | S | Service |  |
| `PRD-BR-004` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Tarifa con moneda y vigencia | FR + DB | FormRequest · BD |  |
| `PRD-BR-005` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Tarifa vencida no aplicable | FR + S | FormRequest · Service |  |
| `PRD-BR-006` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Trazabilidad de componentes | S + DB | Service · BD |  |
| `PRD-BR-007` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Proveedor inactivo no disponible | S | Service |  |
| `PRD-BR-008` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | *(009)* Snapshot en cotizaciones | S (Cotizaciones copia snapshot al quote item) | Service |  |
| `PRD-BR-010` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | *(011)* Precio y permisos en backend | S + P | Policy · Service |  |
| `PRD-BR-012` | RT-4 | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | No confirmar sin disponibilidad | S + lock Redis + DB CHECK `sold <= capacity` | Service · BD |  |
| `PRD-BR-013` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Disponibilidad externa informativa | S | Service |  |
| `PRD-BR-014` | RT-16 | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Modificación crítica auditada | S (listener) | Service |  |
| `PRD-BR-016` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Tarifas por segmento/canal | DB | BD |  |
| `PRD-BR-017` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Versiones consultables | S | Service |  |
| `PRD-BR-018` | RT-24 | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | *(§41)* Sin borrado físico con historia | S → 409 | Service |  |
| `PROC-011` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Jerarquía válida, sin ciclos, coordenadas | S + DB | Service · BD |  |
| `PROC-019` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Validar solapamientos | S + DB EXCLUDE | Service · BD |  |
| `RT-14` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | B2B por agencia/producto/vigencia | S | Service |  |
| `RT-15` |  | §5 Reglas de negocio › §5.1 Reglas de la documentación inicial (aplicación en el prototipo) | Moneda y TC conservados | S (guardar fx en snapshot) | Middleware · Service |  |
| `CAT-BR-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | `code` único por tenant (sin distinguir mayúsculas) | FR + DB | FormRequest · BD |  |
| `CAT-BR-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | min ≤ max en pasajeros, edades y anticipación | FR + DB | FormRequest · BD |  |
| `CAT-BR-03` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | SKU por defecto `<prefijo tenant>-<code>`; nombre interno por defecto = nombre | S | Service |  |
| `CAT-BR-04` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Producto nuevo siempre DRAFT, versión 0.1 `borrador`, canal ERP siempre publicado; los canales elegidos en el asistente quedan “solicitados” y solo son efectivos en ACTIVE | S | Service |  |
| `CAT-BR-05` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Enviar a revisión exige nombre, tipo, destino y categoría | S → 422 | Service |  |
| `CAT-BR-06` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | **Checklist de activación (12 ítems)**: Tipo existente; Nombre ≥3 caracteres; Destino existente; Estado ∈ {APPROVED, SUSPENDED, INACTIVE, ACTIVE}; Componentes ≥1 (salvo tipo sin `requires_components`); Proveedor principal activo con contrato vigente **y** todos los servicios de componentes vigentes/activos con proveedor activo **y** productos-componente ACTIVE; ≥1 tarifa vigente hoy; todas las tarifas con moneda; todas con vigencia y ≥1 vigente; políticas cancelación, modificación, no-show y reembolso; modelo de disponibilidad definido y, si POR_SALIDA, ≥1 salida futura `abierta`; itinerario (si el tipo lo requiere) con ≥1 día y **todos los días con ≥1 actividad** | S → 422 `{code:'PRD-ACT-CHECKLIST', failed:[…]}` | Service · BD |  |
| `CAT-BR-07` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Transiciones solo según §4.1; motivo obligatorio para Devolver, Suspender, Inactivar, Archivar | S (state machine) | Service |  |
| `CAT-BR-08` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Eliminar: solo sin cotizaciones, reservas, operaciones ni paquetes que lo incluyan; motivo obligatorio; soft delete | S → 409 `PRD-BR-018` | Service |  |
| `CAT-BR-09` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Duplicar: nuevo DRAFT “(copia)”, `code` + `-C<nn>`, `sku` + `-C`, sin salidas ni promociones, tarifas con nuevos ref, versión 0.1 | S | Service |  |
| `CAT-BR-10` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Componente-servicio: servicio activo y vigente con proveedor activo y contrato vigente; componente-producto: ACTIVE y distinto del propio; cantidad ≥1; orden por defecto = último+1; reordenar ↑↓; quitar con confirmación. En el asistente no se repite servicio; en 360 sí (§12) | FR + S | FormRequest · Service |  |
| `CAT-BR-11` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Si el producto no tiene proveedor principal, se asigna el del primer servicio agregado. Cambiar proveedor principal: solo activos con contrato vigente, motivo obligatorio, distinto del actual | FR + S | FormRequest · Service |  |
| `CAT-BR-12` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Itinerario: título de día y actividad obligatorios; ítems ordenados por hora (vacía al final como “—”); al quitar un día se renumeran; `service_id` solo entre componentes del producto | FR + S | FormRequest · Service |  |
| `CAT-BR-13` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Alta de tarifa: moneda, desde, hasta; hasta ≥ desde; hasta ≥ hoy; precio > 0; min ≤ precio ≤ max; precio < costo → **advertencia** (no bloquea); temporada solo activa | FR → 422 | FormRequest |  |
| `CAT-BR-14` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Cambio de precio: solo tarifa no vencida ni inactiva; nuevo costo y precio + motivo obligatorios; precio > 0 y ≥ precio mínimo | FR + S + `lock_version` | FormRequest · Service |  |
| `CAT-BR-15` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Resolver tarifa aplicable (fecha, segmento, canal): descarta inactivas, vencidas, fecha fuera de vigencia, otro segmento, otro canal (salvo “Todos”); entre las válidas prefiere la de la temporada vigente en la fecha | S | Service |  |
| `CAT-BR-16` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Temporadas del producto: asociables solo activas; las usadas por tarifas se asocian automáticamente y no se pueden desasociar | S | Service |  |
| `CAT-BR-17` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Temporada: hasta ≥ desde; factor 0.01–3.00; solapamiento entre activas permitido solo con prioridad distinta (igual prioridad → rechazo); prevalece menor número; eliminar solo si ninguna tarifa/producto la usa, si no se ofrece inactivar | FR + DB EXCLUDE | FormRequest · BD |  |
| `CAT-BR-18` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Resolución de temporada por fecha: activas que contienen la fecha, orden por prioridad ascendente; sin temporada → tarifa base | S (`SeasonResolver`) | Service |  |
| `CAT-BR-19` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Configuración de disponibilidad: modelo ∈ 9 valores; capacidad de referencia; fuente interna/externa | FR | FormRequest |  |
| `CAT-BR-20` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Salida: fecha ≥ hoy al crear; capacidad 1–60; en edición capacidad ≥ vendidos + en hold; proveedor solo activo; guías de vacaciones y vehículos en mantenimiento no seleccionables; vehículo con menos asientos que la capacidad → advertencia; alta desde listado global no admite productos INACTIVE/ARCHIVED | FR + S | FormRequest · Service |  |
| `CAT-BR-21` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Hold: salida `abierta`, futura, con disponibles > 0, producto ACTIVE; `qty ≤ disponibles` (si no, rechazo listando hasta 3 salidas alternativas del mismo producto con cupo suficiente); vigencia en minutos (≥5, default 30); referencia obligatoria | S + `Cache::lock("departure:{id}")` + transacción | Service |  |
| `CAT-BR-22` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Confirmar hold: estado `hold`, no expirado, producto ACTIVE, `sold + qty ≤ capacity` | S + lock | Service |  |
| `CAT-BR-23` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Confirmación directa de cupos: producto ACTIVE, salida `abierta`, `qty ≤ disponibles`, referencia obligatoria | S + lock | Service |  |
| `CAT-BR-24` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Liberar: motivo obligatorio; si estaba confirmada devuelve `sold` y reabre salida completa | S | Service |  |
| `CAT-BR-25` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Expiración: holds `hold` con `expires_at < now` → `expirada` | J | Job/Listener |  |
| `CAT-BR-26` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Precio B2B por agencia: agencia `activa`, una lista por agencia/producto, precio ≥ costo de la tarifa pública (si no, rechazo), precio > público → advertencia, venta a crédito exige línea de crédito de la agencia > 0, vigencia obligatoria. Aviso si `is_b2b` falso o canal B2B no publicado | FR + S | FormRequest · Service |  |
| `CAT-BR-27` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Promoción: hasta ≥ desde y ≥ hoy; en tipos porcentuales (%, cantidad, temporada, canal, código, fecha) 0 < valor < 60; código en mayúsculas; precio resultante sobre la tarifa pública visible | FR | FormRequest |  |
| `CAT-BR-28` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Publicación por canal: solo si producto ACTIVE; ERP no se puede despublicar; al (des)publicar B2B, E-commerce y Cotizaciones se sincronizan `is_b2b`, `is_ecommerce`, `is_quoteable` | S | Service |  |
| `CAT-BR-29` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Contenido: slug normalizado (minúsculas, sin tildes, guiones) y único en el tenant; una sola imagen principal, que no puede quitarse | FR + DB | FormRequest · BD |  |
| `CAT-BR-30` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Personalización: grupo con nombre único y ≥2 opciones “Etiqueta \| diferencia”; precio = tarifa base vigente visible + Σ deltas; cada selección se recalcula en backend | FR + S (`POST …/price-quote`) | FormRequest · Service |  |
| `CAT-BR-31` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Nueva versión: menor (`a.b+1`) o mayor (`a+1.0`) sobre la última no histórica; no repetir número; motivo y “vigente desde” obligatorios; snapshot completo | FR + S | FormRequest · Service |  |
| `CAT-BR-32` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Políticas: cancelación, modificación, no-show y reembolso obligatorias | FR | FormRequest |  |
| `CAT-BR-33` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Inclusiones/exclusiones: texto no vacío y sin duplicados en la lista | FR | FormRequest |  |
| `CAT-BR-34` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Relacionados: distinto del propio, no repetido; se muestra también “Referenciado desde” (relación inversa) | FR + DB | FormRequest · BD |  |
| `CAT-BR-35` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Requisitos: `<categoría>: <detalle>`; detalle obligatorio | FR | FormRequest |  |
| `CAT-BR-36` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Tipos (en mayúsculas) y categorías/subcategorías únicos; no se eliminan si hay productos que los usan | FR + S | FormRequest · Service |  |
| `CAT-BR-37` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Servicio: hasta ≥ desde; costo ≥ 0; proveedor no activo → se guarda `inactivo` (aviso); cambio de costo/moneda se audita como `cambio_costo` indicando en cuántos productos se usa; activar requiere proveedor activo y vigencia; desactivar con motivo (avisa productos que lo usan) | FR + S | FormRequest · Service |  |
| `CAT-BR-38` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Proveedor: RUC `^(10\|15\|17\|20)\d{9}$` y único; fin de contrato ≥ inicio; email válido; nace `inactivo`; activar requiere contrato vigente; renovar exige fecha futura (vencido → inactivo); desactivar con motivo y notifica a gerencia si hay productos ACTIVE afectados; calificación 1–5 | FR + DB + S | FormRequest · Service · BD |  |
| `CAT-BR-39` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Destino: raíz solo `País`; nivel hijo > nivel padre; sin ciclos (el nuevo padre no puede ser descendiente); al cambiar tipo, ningún hijo puede quedar en nivel ≥; lat/lng juntas y en rango; advertencia fuera del territorio peruano (lat −18.4..0, lng −81.4..−68.6); nombre único entre hermanos; Atracción/Ruta (nivel 6) no admite hijos; eliminar solo sin subdestinos y sin productos que lo referencien (principal o secundario) | FR + S + DB | FormRequest · Service · BD |  |
| `CAT-BR-40` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Datos sensibles por rol (§7): costo, margen, tarifas netas (tipos Proveedor/Costo/B2B/Mayorista o canal B2B/Mayorista), historial | P + `JsonResource` condicional | Policy · Resource |  |
| `CAT-BR-41` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Rentabilidad: utilidad = venta − costo proveedor − otros costos − comisión (por pax × n); margen = utilidad / venta. Guardar markup de referencia requiere `manage_rates` | S | Service |  |
| `CAT-BR-42` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Motor de precios: `base = costo×pax + ajuste temporada (costo×(factor−1))`; `+ adicionales`; `+ markup (%, fijo)`; `− descuento (%, fijo)`; `+ impuesto`; redondeo; comisión sobre neto; utilidad = neto − base − comisión. Reglas: markup PR-01 (Directo/E-commerce) o PR-02 (B2B) salvo override; descuento PR-05 si ≥10 pax; IGV PR-03 (domiciliado) / PR-04 0% (no domiciliado); redondeo PR-06; comisión = agencia B2B o PR-07; PR-08 precio mínimo (el backend aplica el mínimo) | S (`PricingEngine`) | Service |  |
| `CAT-BR-43` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Filtro por destino incluye descendientes del destino principal y de los secundarios | S (query por `path`) | Service |  |
| `CAT-BR-44` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | “Precio desde” = tarifa vigente Directo y Adulto/Pasajero; si no existe, Directo; si no, la primera vigente — siempre entre las visibles para el rol | S | Service |  |
| `CAT-BR-45` |  | §5 Reglas de negocio › §5.2 Reglas del módulo (nuevas) | Código de salida, hold, tarifa y promoción se generan por secuencia del tenant (no por máximo+1 como el prototipo) | S (`sys_sequences`) | Service · BD |  |

### 03 · Cotizaciones (`03-cotizaciones.md`) — 35 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `QTE-BR-01` |  | §5 Reglas de negocio › §5.2 Reglas | Cliente, título, viaje desde, viaje hasta y válida hasta son obligatorios | FormRequest `StoreQuoteRequest` | FormRequest |  |
| `QTE-BR-02` |  | §5 Reglas de negocio › §5.2 Reglas | `travel_to ≥ travel_from` ("La fecha de fin del viaje no puede ser anterior al inicio.") | FormRequest + CHECK | FormRequest · BD |  |
| `QTE-BR-03` |  | §5 Reglas de negocio › §5.2 Reglas | ADT + CHD + INF > 0 | FormRequest + CHECK | FormRequest · BD |  |
| `QTE-BR-04` |  | §5 Reglas de negocio › §5.2 Reglas | Al menos un ítem | FormRequest | FormRequest |  |
| `QTE-BR-05` | PRD-BR-002 | §5 Reglas de negocio › §5.2 Reglas | Solo productos `ACTIVE` y `flags.quoteable ≠ false`; inactivos se listan deshabilitados con el motivo | FormRequest (rule `QuoteableProduct`) + Service | FormRequest · Service |  |
| `QTE-BR-06` | PRD-BR-005 | §5 Reglas de negocio › §5.2 Reglas | Tarifa del ítem vigente para la fecha del ítem; si al cambiar la fecha deja de serlo se quita la tarifa | FormRequest + Service | FormRequest · Service |  |
| `QTE-BR-07` |  | §5 Reglas de negocio › §5.2 Reglas | `qty > 0`, `pax > 0`, `unit_price > 0`, `unit_cost ≥ 0` | FormRequest + CHECK | FormRequest · BD |  |
| `QTE-BR-08` |  | §5 Reglas de negocio › §5.2 Reglas | Tope de descuento 10 % (`MAX_DISC`). Superarlo solo con `quotes.discount_override` (máx. 50 %); se audita `descuento_sobre_tope` | FormRequest + Policy | FormRequest · Policy |  |
| `QTE-BR-09` |  | §5 Reglas de negocio › §5.2 Reglas | Ventas solo puede usar clientes de su cartera (`Scope.clientIds`: clientes propios + clientes de sus oportunidades, cotizaciones y reservas) y oportunidades propias no ganadas/perdidas | FormRequest + Policy | FormRequest · Policy |  |
| `QTE-BR-10` |  | §5 Reglas de negocio › §5.2 Reglas | Solo se edita la versión vigente en `borrador`; editarla anula la solicitud de aprobación pendiente y borra la aprobación interna | Policy + Service | Policy · Service |  |
| `QTE-BR-11` |  | §5 Reglas de negocio › §5.2 Reglas | Requiere aprobación interna si `discount_pct > 5` o `marginPct < 15` (`needsInternal`) | Service `QuotePolicyEvaluator` | Policy · Service |  |
| `QTE-BR-12` |  | §5 Reglas de negocio › §5.2 Reglas | No se envía al cliente una versión con QTE-BR-11 sin aprobación interna | Service (409 `QTE-BR-12`) | Service |  |
| `QTE-BR-13` |  | §5 Reglas de negocio › §5.2 Reglas | No se registra la aprobación del cliente con QTE-BR-11 pendiente, salvo que el usuario tenga `quotes.approve_internal` y registre la aprobación interna en el mismo paso (checkbox + justificación) | Service | Service |  |
| `QTE-BR-14` |  | §5 Reglas de negocio › §5.2 Reglas | Aprobar internamente con descuento > 10 % exige además `quotes.discount_override` | Policy | Policy |  |
| `QTE-BR-15` |  | §5 Reglas de negocio › §5.2 Reglas | Solo el dueño (si es Ventas) solicita aprobación; una sola solicitud pendiente por versión; justificación obligatoria | Policy + UNIQUE parcial | Policy · BD |  |
| `QTE-BR-16` |  | §5 Reglas de negocio › §5.2 Reglas | Cotización vencida (`vencida` o `enviada/vista/negociacion` con `valid_until < hoy`): no se reenvía ni se aprueba; se ofrece crear nueva versión (excepción DOC-PROC §24) | Service | Service |  |
| `QTE-BR-17` |  | §5 Reglas de negocio › §5.2 Reglas | Rechazo con motivo obligatorio; solo desde `enviada/vista/negociacion/vencida` | FormRequest + Service | FormRequest · Service |  |
| `QTE-BR-18` |  | §5 Reglas de negocio › §5.2 Reglas | Nueva versión permitida en cualquier estado salvo `convertida`; desde `aprobada` invalida la aprobación del cliente | Service | Service |  |
| `QTE-BR-19` | RT-7 | §5 Reglas de negocio › §5.2 Reglas | Versión `aprobada` inmutable; versiones no vigentes consultables y no editables (PRD-BR-017) | Trigger `frozen_at` + Policy | Policy |  |
| `QTE-BR-20` | PRD-BR-008-009 | §5 Reglas de negocio › §5.2 Reglas | Cada versión guarda snapshot de productos (versión vigente) y copia de políticas; cambios posteriores del catálogo no la alteran | Service | Service |  |
| `QTE-BR-21` |  | §5 Reglas de negocio › §5.2 Reglas | Solo se aprueba (cliente) desde `enviada/vista/negociacion` | Service | Service |  |
| `QTE-BR-22` |  | §5 Reglas de negocio › §5.2 Reglas | Registrar vista requiere token y estado ≠ `borrador`; solo `enviada` cambia a `vista` | Service | Service |  |
| `QTE-BR-23` |  | §5 Reglas de negocio › §5.2 Reglas | Reenvío prohibido en `aprobada/convertida/rechazada` | Service | Service |  |
| `QTE-BR-24` |  | §5 Reglas de negocio › §5.2 Reglas | Al enviar una cotización con validez vencida en `borrador` se renueva `valid_until = hoy + quoteValidityDays` (10) | Service | Service |  |
| `QTE-BR-25` |  | §5 Reglas de negocio › §5.2 Reglas | Reasignar vendedor solo Tenant Admin / Manager; nuevo dueño distinto al actual; motivo opcional | Policy (`quotes.reassign`, ver §11) | Policy |  |
| `QTE-BR-26` |  | §5 Reglas de negocio › §5.2 Reglas | Ventas no ve ni abre cotizaciones ajenas (pantalla "Registro fuera de su cartera"); tampoco en búsqueda global | Policy + global scope `owner=me` | Policy |  |
| `QTE-BR-27` |  | §5 Reglas de negocio › §5.2 Reglas | Validez por defecto: hoy + `settings.quoteValidityDays` (10) | Service | Service |  |
| `RT-5` | PRD-BR-010-011 | §5 Reglas de negocio › §5.2 Reglas | El precio se recalcula en backend; el frontend solo previsualiza (endpoint `pricing/preview`) | Service | Service |  |
| `PRC-01` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | Precio sugerido por línea: (`suggest(rate, date, cur)`), se ejecuta al agregar un producto y al cambiar tarifa o fecha de la línea (sobrescribe costo y precio unitarios) | Service (PricingService; autoridad backend) | Service |  |
| `PRC-02` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | Tarifa por defecto: (`defaultRate(p, date, client)`): tarifas válidas = `status ≠ 'vencida'` y `validFrom ≤ date ≤ validTo`. Preferencia: (1) canal = canal del segmento del cliente (`Corporativo`→Corporativo, `B2B`→B2B, `Grupos`→Corporativo, resto→Directo) y segmento ≠ Niño; (2) canal Directo y segmento ≠ Niño; (3) la primera válida; (4) ninguna → precio manual (toast de aviso). Tarifas no vigentes aparecen deshabilitadas "— no vigente (PRD-BR-005)". | Service (PricingService; autoridad backend) | Service |  |
| `PRC-03` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | Defaults de línea: `qty = 1`, `pax = max(1, ADT + CHD)`, `segment='Adulto'`; producto tipo `TRASLADO`: `pax = 1`, `qty = 2`, `segment='Pasajero'`. Si la tarifa elegida es de segmento Niño, la línea pasa a `Niño`. | Service (PricingService; autoridad backend) | Service |  |
| `PRC-04` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | Totales de versión: (`Pricing.quoteTotals(v)`), autoridad backend (PRD-BR-010) | Service (PricingService; autoridad backend) | Service |  |
| `PRC-05` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | Motor unitario `Pricing.calc`: (usado por el simulador de Catálogo y Configuración; el backend debe exponerlo como servicio único `PricingEngine::calc`, y la línea de cotización debe poder derivarse de él cuando la tarifa defina markup en vez de precio) | Service (PricingService; autoridad backend) | Service |  |
| `PRC-06` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | Moneda: cambiar la moneda en el constructor convierte todos los `unit_cost/unit_price` con `conv` y `round2`. Cotización en USD muestra "Equivalente en soles" `total × fx`. `fx_rate` se persiste por versión (regla transversal 15). | Service (PricingService; autoridad backend) | Service |  |
| `PRC-07` |  | §5 Reglas de negocio › §5.1 Algoritmo exacto de pricing | IGV por defecto: `tax_pct = 0` si `client.country ≠ 'Perú'` (exportación de servicios, cliente no domiciliado), si no `settings.taxPct` (18). Editable 0–18. | Service (PricingService; autoridad backend) | Service |  |

### 04 · Reservas (`04-reservas.md`) — 40 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `RT-3` |  | §5 Reglas de negocio | Solo una cotización `aprobada` genera reserva | Service (409) | Service |  |
| `RT-4` | PRD-BR-012 | §5 Reglas de negocio | No se confirma, convierte, reprograma ni agrega pax/servicio sin disponibilidad; POR_SALIDA con cupo `capacity − sold ≥ pax` | Service + lock + `CHECK (sold <= capacity)` | Service · BD |  |
| `PRD-BR-013` |  | §5 Reglas de negocio | Modelos sin salida propia se tratan como hold sujeto a confirmación del proveedor (advertencia, no bloqueo) | Service | Service |  |
| `RT-22` |  | §5 Reglas de negocio | Conversión idempotente: una cotización genera como máximo una reserva (aunque se cancele) | UNIQUE parcial + Idempotency-Key + FOR UPDATE | Middleware · BD |  |
| `RES-BR-01` |  | §5 Reglas de negocio | Conversión sin ítems con cupo insuficiente; no hay conversión parcial | Service | Service |  |
| `RES-BR-02` |  | §5 Reglas de negocio | La reserva conserva versión exacta, snapshot y políticas de la cotización | Service | Service |  |
| `RES-BR-03` |  | §5 Reglas de negocio | CxC automáticas 40 % anticipo / 60 % saldo con vencimientos §4.3 paso 14; si no existen al confirmar, se crean | Service | Service |  |
| `RES-BR-04` |  | §5 Reglas de negocio | Reserva directa: cliente y producto obligatorios; producto ACTIVE + bookable (PRD-BR-002); tarifa vigente (PRD-BR-005); ADT+CHD > 0 | FormRequest | FormRequest |  |
| `RES-BR-05` |  | §5 Reglas de negocio | "Crear y confirmar" requiere disponibilidad OK; sin ella solo borrador `pendiente_disponibilidad` | Service | Service |  |
| `RES-BR-06` |  | §5 Reglas de negocio | POR_SALIDA requiere salida; anticipación mínima y máximo de pax del producto para otros modelos | FormRequest | FormRequest |  |
| `RES-BR-07` |  | §5 Reglas de negocio | Confirmar exige disponibilidad de todos los servicios activos requeridos y ≥ 1 pasajero; servicio `rechazado` sin alternativa bloquea | Service | Service |  |
| `RES-BR-08` |  | §5 Reglas de negocio | Iniciar operación solo desde confirmada/reprogramada/pend. pago/pend. proveedor y cuando `travel_from ≤ hoy + 1`; completar solo desde `en_operacion` | Service | Service |  |
| `RES-BR-09` |  | §5 Reglas de negocio | Pasajero: nombre, número de documento, nacionalidad y fecha de nacimiento obligatorios; tipo sugerido por edad a la fecha de viaje `floor(días/365.25)`: < 2 INF, < 12 CHD, si no ADT (advertencia, no bloqueo) | FormRequest (warning en respuesta) | FormRequest |  |
| `RES-BR-10` |  | §5 Reglas de negocio | Agregar/quitar pasajeros no recalcula precio ni cupos; para impacto se usa Modificación | Service (ver §12) | Service |  |
| `RES-BR-11` | PRD-BR-007 | §5 Reglas de negocio | Solo se solicita a proveedores `activo` | Service | Service |  |
| `RES-BR-12` |  | §5 Reglas de negocio | Confirmar servicio exige código de confirmación | FormRequest | FormRequest |  |
| `RES-BR-13` |  | §5 Reglas de negocio | Rechazo de proveedor: motivo + detalle obligatorios; alternativa como nuevo servicio `pendiente`; reserva `confirmada` → `pendiente_proveedor` | Service | Service |  |
| `RES-BR-14` |  | §5 Reglas de negocio | Modificación: descripción obligatoria; disponibilidad según tipo; aplica solo con aprobación de `quotes.approve_internal` (propuesto `reservations.approve_changes`) | Policy + Service | Policy · Service |  |
| `RES-BR-15` |  | §5 Reglas de negocio | Delta positivo genera CxC; delta negativo reduce CxC abiertas y el exceso queda como crédito | Service | Service |  |
| `RES-BR-20` |  | §5 Reglas de negocio | Reprogramación bloqueada si hay servicios `completado` | Service | Service |  |
| `RES-BR-21` |  | §5 Reglas de negocio | Nueva fecha distinta de la actual y ≥ hoy; motivo obligatorio | FormRequest | FormRequest |  |
| `RES-BR-22` |  | §5 Reglas de negocio | Diferencia tarifaria por factor de temporada por servicio (§4.5) | Service | Service |  |
| `RES-BR-23` |  | §5 Reglas de negocio | Reprogramar anula vouchers emitidos y reinicia servicios y asignaciones | Service | Service |  |
| `RES-BR-24` |  | §5 Reglas de negocio | Diferencia positiva genera CxC | Service | Service |  |
| `RES-BR-30` | RT-8 | §5 Reglas de negocio | Cancelación: motivo obligatorio, penalidad por política snapshot (§4.6), auditada | FormRequest + Service | FormRequest · Service |  |
| `RES-BR-31` |  | §5 Reglas de negocio | Penalidad nunca supera el total; servicios ejecutados se retienen al 100 % | Service | Service |  |
| `RES-BR-32` |  | §5 Reglas de negocio | Reembolso genera nota de crédito + pago de reembolso pendiente; penalidad no cubierta genera CxC a 7 días | Service | Service |  |
| `RES-BR-33` |  | §5 Reglas de negocio | Solicitud de anulación: solo el dueño, una pendiente por reserva, reserva no cerrada | Policy + UNIQUE parcial | Policy · BD |  |
| `RES-BR-40` | RT-9 | §5 Reglas de negocio | Pago rápido: requiere CxC abierta; monto > 0 y ≤ saldo de la CxC (+0.01); se registra `aplicado`; CxC → `pagada` si cubre, si no `parcial` | FormRequest + Service | FormRequest · Service |  |
| `RES-BR-41` |  | §5 Reglas de negocio | Generar anticipo/saldo manual solo si la reserva no tiene CxC y no está cancelada | Service | Service |  |
| `RES-BR-42` |  | §5 Reglas de negocio | Orden operativa solo para reservas confirmada/pend. pago/pend. proveedor/reprogramada/en operación | Service | Service |  |
| `RES-BR-50` |  | §5 Reglas de negocio | Ventas solo ve/gestiona reservas propias (lista, KPIs, calendario, detalle, búsqueda); clientes de su cartera en reserva directa; vendedor fijo = él mismo | Policy + scope | Policy |  |
| `RES-BR-51` |  | §5 Reglas de negocio | Reasignar asesor solo tenant_admin/manager | Policy | Policy |  |
| `PRD-BR-014` |  | §5 Reglas de negocio | Toda modificación crítica auditada | Service | Service |  |
| `RES-V21-01` |  | §5 Reglas de negocio › v2.1 — Reglas del motor de reservas que gobiernan Reserva 360 | La pestaña «Detalle de la reserva web» existe solo si hay snapshot `booking`; muestra el dato histórico aunque la regla se haya desactivado después, con etiqueta «R-x inactiva · dato histórico» (R-MULTICURRENCY, R-LODGING, R-ADDONS, R-PICKUP, R-COMMENTS, R-DEPOSIT/R-PAY-LATER) | Resource / UI | Resource · UI | `R-MULTICURRENCY` `R-LODGING` `R-ADDONS` `R-PICKUP` `R-COMMENTS` `R-DEPOSIT` `R-PAY-LATER` |
| `RES-V21-02` |  | §5 Reglas de negocio › v2.1 — Reglas del motor de reservas que gobiernan Reserva 360 | Operaciones (sin permisos de rentabilidad) no recibe `lines`, `adjustments`, `total`, `payment` del snapshot | `ReservationWebSnapshotResource` según Policy | Policy · Resource |  |
| `RES-V21-03` |  | §5 Reglas de negocio › v2.1 — Reglas del motor de reservas que gobiernan Reserva 360 | Totales: habitaciones = Σ habitaciones por ciudad; noches = Σ noches de las ciudades con alojamiento (no se multiplican por habitaciones) | `BookingEngine` (servidor) | Service |  |
| `RES-V21-04` |  | §5 Reglas de negocio › v2.1 — Reglas del motor de reservas que gobiernan Reserva 360 | Un solo titular por reserva; edad a la fecha del viaje; tipo ADT/CHD/INF según `paxRules` del producto (R-CHILD-PER-ADULT, R-INFANT-FREE) | FormRequest + índice parcial | FormRequest · BD | `R-CHILD-PER-ADULT` `R-INFANT-FREE` |
| `RES-V21-05` |  | §5 Reglas de negocio › v2.1 — Reglas del motor de reservas que gobiernan Reserva 360 | Pestaña «Comentarios del pasajero» visible si hay booking o comentarios; si R-PAX-FEEDBACK está desactivada se avisa y solo se ven registros previos | UI / Policy | Policy · UI | `R-PAX-FEEDBACK` |
| `RES-V21-06` |  | §5 Reglas de negocio › v2.1 — Reglas del motor de reservas que gobiernan Reserva 360 | Responder requiere `inbox.manage`; derivar requiere `operations.incidents`; Ventas solo sobre su cartera | Policy | Policy |  |

### 05 · Operaciones y móvil (`05-operaciones-movil.md`) — 74 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `OPS-BR-01` | PROC-031 | §5 Reglas de negocio | Solo una reserva en estado `confirmada` o `en_operacion` genera orden operativa ("Solo una reserva confirmada genera orden operativa") | FormRequest + Service `CreateOperationOrder` | FormRequest · Service |  |
| `OPS-BR-02` |  | §5 Reglas de negocio | Una reserva tiene como máximo una orden operativa; candidatas = sin orden, no `cancelada`/`completada` | Constraint DB + Service | Service · BD |  |
| `OPS-BR-03` |  | §5 Reglas de negocio | Al crear la orden se replican como asignaciones los servicios no cancelados, con proveedor y que requieren recursos (prototipo: excluye por nombre hotel/"hab."/entrada; producción: `requires_assignment`) | Service | Service |  |
| `OPS-BR-04` |  | §5 Reglas de negocio | Coordinador obligatorio, usuario activo con rol operations/manager/tenant_admin; por defecto el usuario actual si es Operaciones | FormRequest | FormRequest |  |
| `OPS-BR-05` |  | §5 Reglas de negocio | Transiciones de orden según §4.1; "Marcar como asignada" bloqueada con asignaciones pendientes; "Confirmar operación" bloqueada con asignaciones sin confirmar por el recurso o servicios `pendiente`/`solicitado` | Service (state machine) → 409 | Service |  |
| `OPS-BR-06` |  | §5 Reglas de negocio | Iniciar ejecución (web o móvil) pasa la reserva de `confirmada` a `en_operacion` | Service + listener | Service |  |
| `OPS-BR-07` |  | §5 Reglas de negocio | Las tareas no bloquean el cierre; se registra quién y cuándo las completó | Service | Service |  |
| `OPS-BR-10` | PROC-032 | §5 Reglas de negocio | Solo servicios `pendiente` pueden enviarse al proveedor; registra solicitud y notifica por email | Service | Service |  |
| `OPS-BR-11` |  | §5 Reglas de negocio | Confirmación de proveedor exige código de confirmación | FormRequest (`required`) | FormRequest |  |
| `OPS-BR-12` |  | §5 Reglas de negocio | Rechazo de proveedor exige motivo; solo desde `solicitado` | FormRequest + Service | FormRequest · Service |  |
| `OPS-BR-13` |  | §5 Reglas de negocio | Un servicio no puede marcarse completado antes de su fecha ("no puede completarse antes de su fecha (PROC-036)") | Service | Service |  |
| `RT-12` | OPS-BR-20 / PROC-033 | §5 Reglas de negocio | Asignación requiere al menos un recurso y servicio no cancelado | FormRequest + Service | FormRequest · Service |  |
| `OPS-BR-21` |  | §5 Reglas de negocio | **Bloqueo**: mismo recurso con otro servicio de **otra orden o salida programada** el mismo día con diferencia < 6 h (360 min) | Service `AssignmentValidator` + lock Redis por recurso+fecha | FormRequest · Service |  |
| `OPS-BR-22` |  | §5 Reglas de negocio | **Advertencia**: mismo recurso en la misma orden < 6 h ("verifique el encadenamiento") o cualquier otro servicio el mismo día ≥ 6 h ("verifique tiempos de retorno") | Service | Service |  |
| `OPS-BR-23` |  | §5 Reglas de negocio | Se ignoran ocupaciones de asignaciones `completada` y de órdenes `cancelada` | Vista `ops_resource_occupations` | Query/Read model |  |
| `OPS-BR-24` |  | §5 Reglas de negocio | Guía/conductor en `vacaciones` → bloqueo; en `descanso` → advertencia | Service | Service |  |
| `OPS-BR-25` |  | §5 Reglas de negocio | Idiomas requeridos por los pasajeros no cubiertos por el guía → advertencia (prototipo deriva DE/FR/PT de la nacionalidad y "alemán" de las notas) | Service | Service |  |
| `OPS-BR-26` |  | §5 Reglas de negocio | Licencia del conductor vencida a la fecha del servicio → bloqueo; vence en ≤ 30 días desde hoy → advertencia | Service | Service |  |
| `OPS-BR-27` |  | §5 Reglas de negocio | Vehículo en `mantenimiento` → bloqueo; capacidad < nº pasajeros → bloqueo; SOAT vencido a la fecha del servicio → bloqueo; SOAT ≤ 30 días → advertencia | Service | Service |  |
| `OPS-BR-28` |  | §5 Reglas de negocio | Con advertencias, la asignación exige aceptación explícita ("Asumo las advertencias…") que se guarda en `warnings_ack` y en auditoría | FormRequest (`ack_warnings=true`) | FormRequest |  |
| `OPS-BR-29` |  | §5 Reglas de negocio | Liberar recursos notifica por WhatsApp a cada recurso y vuelve la asignación a `pendiente` | Service + listener | Service |  |
| `RT-13` | OPS-BR-30 / PROC-034 | §5 Reglas de negocio | Un pasajero no puede figurar en más de una habitación del mismo intervalo (misma lista u otra lista del mismo o distinto hotel con fechas superpuestas) | Constraint EXCLUDE + Service (mensaje legible) | Service · BD |  |
| `OPS-BR-31` |  | §5 Reglas de negocio | Número de habitación único en la lista y no asignado a otra reserva del mismo hotel en fechas superpuestas | Constraint UNIQUE/EXCLUDE | BD |  |
| `OPS-BR-32` |  | §5 Reglas de negocio | Ocupación ≤ capacidad por tipo (Simple 1, Doble 2, Doble twin 2, Matrimonial 2, Triple 3, Junior suite 2) | Service | Service |  |
| `OPS-BR-33` |  | §5 Reglas de negocio | Advertencias no bloqueantes: habitación vacía, pasajeros sin habitación, habitaciones observadas por el hotel | Service (respuesta `warnings`) | Service |  |
| `OPS-BR-34` |  | §5 Reglas de negocio | Guardar/confirmar/enviar bloqueados si hay conflictos; enviar exige estado `confirmada` o `enviada` | Service → 409/422 | Service |  |
| `OPS-BR-35` |  | §5 Reglas de negocio | Toda modificación de una lista `confirmada`/`enviada` la pasa a `modificada` (requiere reconfirmar y reenviar) | Service | Service |  |
| `OPS-BR-36` |  | §5 Reglas de negocio | Nueva rooming list: hotel activo de tipo Hotel, check-out > check-in, reserva sin rooming y no cancelada/completada | FormRequest | FormRequest |  |
| `RT-11` | OPS-BR-40 / PROC-035 | §5 Reglas de negocio | Solo servicios `confirmado` o `completado` emiten voucher | Service | Service |  |
| `OPS-BR-41` |  | §5 Reglas de negocio | Un único voucher vigente (`emitido`) por servicio; para cambios usar "Nueva versión" | Constraint + Service | Service · BD |  |
| `OPS-BR-42` |  | §5 Reglas de negocio | No se emite voucher si el proveedor no está `activo` (contrato no vigente) | Service | Service |  |
| `OPS-BR-43` |  | §5 Reglas de negocio | Advertencias: servicio confirmado sin código de confirmación; servicio ya ejecutado (voucher como respaldo) | Service | Service |  |
| `OPS-BR-44` |  | §5 Reglas de negocio | Nueva versión exige motivo y servicio aún confirmado/completado; incrementa `version`, conserva el código y guarda snapshot | Service | Service |  |
| `OPS-BR-45` |  | §5 Reglas de negocio | Reenviar, versionar, marcar utilizado y anular solo en vouchers `emitido` | Policy/Service | Policy · Service |  |
| `OPS-BR-46` |  | §5 Reglas de negocio | Anular exige motivo; el voucher queda en historial (sin borrado) y se notifica al proveedor | FormRequest + Service | FormRequest · Service |  |
| `OPS-BR-47` |  | §5 Reglas de negocio | Emisión solo para reservas no `cancelada`/`borrador`; `pax` = nº de pasajeros de la reserva | Service | Service |  |
| `OPS-BR-50` | PROC-036 | §5 Reglas de negocio | En la app, el check-in se habilita solo con el servicio `en_curso` | Service (móvil valida también en backend) | Service |  |
| `OPS-BR-51` |  | §5 Reglas de negocio | Finalizar exige ≥ 1 check-in y ≥ 1 evidencia del servicio; los pasajeros sin check-in quedan como no-show (se informa antes de confirmar) | Service | Service |  |
| `OPS-BR-52` |  | §5 Reglas de negocio | El recurso solo ve y opera asignaciones donde es guía o conductor (acceso a otra asignación → vuelve a "Hoy") | Policy `AssignmentPolicy::operate` | Policy |  |
| `OPS-BR-60` | PROC-037 | §5 Reglas de negocio | SLA por severidad: crítica 4 h, alta 8 h, media 24 h, baja 72 h (horas corridas desde el registro) | Service + Job SLA | Service · Job/Listener |  |
| `OPS-BR-61` |  | §5 Reglas de negocio | Incidencia `critica` (al crear o al reclasificar) alerta a gerencia por push y WhatsApp y queda registrado en bitácora | Listener `notifications` | Job/Listener |  |
| `OPS-BR-62` |  | §5 Reglas de negocio | Cierre: `alta`/`critica` requieren resolución; `critica` requiere ≥ 1 evidencia; `baja`/`media` sin resolución requieren comentario de cierre | Service → 422 con code | Service |  |
| `OPS-BR-63` |  | §5 Reglas de negocio | Reabrir exige motivo y vuelve a `en_proceso` | FormRequest | FormRequest |  |
| `OPS-BR-64` |  | §5 Reglas de negocio | Título y descripción obligatorios (web); en móvil el título es obligatorio y la descripción por defecto = título | FormRequest | FormRequest |  |
| `OPS-BR-65` |  | §5 Reglas de negocio | Responsable por defecto: coordinador de la orden | Service | Service |  |
| `OPS-BR-70` | PROC-038 | §5 Reglas de negocio | Evidencias: imagen o PDF, asociadas a servicio (opcional) o incidencia; retiro lógico con motivo obligatorio y auditoría | FormRequest + Service | FormRequest · Service |  |
| `OPS-BR-71` |  | §5 Reglas de negocio | Deduplicación por hash SHA-256 por orden | Constraint | BD |  |
| `OPS-BR-80` | PROC-039 | §5 Reglas de negocio | Precondición 1: todos los servicios no cancelados con proveedor en `completado` | Service `CloseOperation` | Service |  |
| `OPS-BR-81` |  | §5 Reglas de negocio | Precondición 2: ninguna incidencia de la orden en `abierta`/`en_proceso` (resuelta o cerrada = gestionada) | Service | Service |  |
| `OPS-BR-82` |  | §5 Reglas de negocio | Precondición 3: la orden tiene ≥ 1 evidencia y ninguna incidencia `alta`/`critica` sin evidencia | Service | Service |  |
| `OPS-BR-83` |  | §5 Reglas de negocio | Precondición 4: todos los servicios con proveedor tienen costo > 0 | Service | Service |  |
| `OPS-BR-84` |  | §5 Reglas de negocio | Al cerrar: orden `completada`, reserva `completada`, notificar equipo y cliente, costos a liquidación/rentabilidad | Service + eventos | Service · Job/Listener |  |
| `RT-19` | RT-22 / MOB-BR-01 / PROC-058 | §5 Reglas de negocio | Toda acción móvil lleva `client_action_id` (UUID v7) y es idempotente en servidor | Middleware + `ops_sync_actions` | Middleware |  |
| `MOB-BR-02` |  | §5 Reglas de negocio | La app aplica la acción localmente (optimista) y la encola si no hay red; los efectos secundarios (auditoría, notificaciones) ocurren solo al sincronizar | App + Service | Service · App móvil |  |
| `MOB-BR-03` |  | §5 Reglas de negocio | Coalescencia local: para `confirm` y `checkin` con la misma clave `tipo:orden:servicio:pasajero` solo se conserva la última acción pendiente | App (SQLite) | App móvil |  |
| `MOB-BR-04` |  | §5 Reglas de negocio | Reintentos con backoff exponencial y jitter; tras el máximo se marca `failed` | App | App móvil |  |
| `MOB-BR-05` |  | §5 Reglas de negocio | Conflicto `confirm`: si ya estaba confirmada en web, se descarta el duplicado sin error | Service | Service |  |
| `MOB-BR-06` |  | §5 Reglas de negocio | Conflicto `checkin`/`checkin_all`: idempotencia por pasajero + servicio; se conserva la marca de tiempo más temprana | Service + constraint | Service · BD |  |
| `MOB-BR-07` |  | §5 Reglas de negocio | Conflicto `start`: el backend es fuente de verdad de la planificación, el dispositivo de los hechos de campo; se conserva la hora real de inicio aunque la hora planificada haya cambiado | Service | Service |  |
| `MOB-BR-08` |  | §5 Reglas de negocio | Conflicto `finish`: la transición de campo prevalece si es válida en la máquina de estados (PROC-036) | Service | Service |  |
| `MOB-BR-09` |  | §5 Reglas de negocio | Conflicto `evidence`: mismo hash ya existente → se asocia la evidencia existente | Service + constraint | Service · BD |  |
| `MOB-BR-10` |  | §5 Reglas de negocio | Acción inválida en la máquina de estados (p. ej. `finish` sobre asignación liberada o reasignada a otro recurso) → `rejected`, la app revierte el cambio local y muestra el motivo | Service | Service |  |
| `MOB-BR-11` |  | §5 Reglas de negocio | Conflicto `incident`: si el coordinador registró una incidencia similar (misma orden y tipo) en los últimos 10 min, no se fusiona: se crea vinculada (`related_incident_id`) y se notifica para revisión | Service | Service |  |
| `MOB-BR-12` |  | §5 Reglas de negocio | El móvil no replica reglas de negocio: valida UX (botones por estado) pero la autoridad es la API | Arquitectura | Infraestructura |  |
| `MOB-BR-13` |  | §5 Reglas de negocio | Usuario externo sin recurso vinculado ve "Su usuario no está vinculado a un recurso operativo…" | API 403 + app | Middleware · Controller · App móvil |  |
| `PAX-BR-01` |  | §5 Reglas de negocio | El pasajero solo ve su reserva (`users.reservation_id`/vínculo pasajero); sin vínculo: "No encontramos un viaje vinculado a su cuenta" | Policy | Policy |  |
| `PAX-BR-02` |  | §5 Reglas de negocio | La app del pasajero muestra solo vouchers no anulados y servicios no cancelados; el itinerario excluye alojamiento como actividad y muestra la noche en hotel y habitación | API Resource | Controller · Resource |  |
| `PAX-BR-03` |  | §5 Reglas de negocio | Próxima actividad = primer servicio con proveedor, con hora, no completado, posterior a ahora | API | Controller |  |
| `RT-16` | OPS-BR-90 | §5 Reglas de negocio | Todas las acciones críticas (§9) se auditan | Listener audit | Job/Listener |  |
| `RT-17` | OPS-BR-91 | §5 Reglas de negocio | Botones sin permiso se muestran deshabilitados con `title="Requiere permiso x.y"`; si llega por otra vía: toast "Su rol (…) no tiene el permiso …" y no modifica datos | Next.js + API 403 | Middleware · Controller · UI |  |
| `OPS-V21-01` |  | §5 Reglas de negocio › v2.1 — Reglas | El recojo aplica al servicio con `is_pickup=true`; si ninguno lo tiene, al primer servicio del primer día. `meetingPoint` devuelve el punto/dirección del cliente para ese servicio | Service `MeetingPointResolver` | Service |  |
| `OPS-V21-02` |  | §5 Reglas de negocio › v2.1 — Reglas | Prellenado de rooming: por cada leg de `booking.lodging` sin rooming, una lista `borrador` con check-in = fecha de salida + noches acumuladas de legs anteriores; habitaciones numeradas provisionalmente (`LIM-1`…), estado `pendiente`; adultos repartidos entre habitaciones, luego niños, infantes con el adulto de la habitación menos ocupada | `RoomingPrefillService` (idempotente por leg) | Service |  |
| `OPS-V21-03` |  | §5 Reglas de negocio › v2.1 — Reglas | Infantes no ocupan cama (R-INFANT-FREE/R-LODGING-CAPACITY) | `validateRooming` | FormRequest | `R-INFANT-FREE` `R-LODGING-CAPACITY` |
| `OPS-V21-04` |  | §5 Reglas de negocio › v2.1 — Reglas | Alertas operativas derivadas de `comments` y `diet_notes` (dieta/alergia, celebración, accesibilidad, infante) se muestran en orden, app y voucher; no se almacenan diagnósticos (solo el texto del cliente) | Resource | Resource |  |

### 06 · Extranet de proveedores (`06-extranet-proveedores.md`) — 31 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `SUP-BR-01` |  | §5 Reglas de negocio | El usuario proveedor solo accede a datos de SU `provider_id`; sin vínculo no ve datos ("Su usuario no está vinculado a un proveedor") | Policy + global scope `SupplierScope` + RLS | Policy · BD |  |
| `SUP-BR-02` |  | §5 Reglas de negocio | La extranet no expone precios de venta, márgenes, datos de contacto del cliente final ni documentos de pasajeros; solo grupo/titular, pax y tarifa neta | API Resources con whitelist (§3.5) | Controller · Resource |  |
| `SUP-BR-03` |  | §5 Reglas de negocio | Solo se listan servicios de reservas que no están en `borrador` | Query | Query/Read model |  |
| `SUP-BR-04` |  | §5 Reglas de negocio | Solo se responde una solicitud en estado `solicitado`/`pendiente`; otra → "La solicitud ya fue respondida…" | Service → 409 | Service |  |
| `SUP-BR-05` |  | §5 Reglas de negocio | La solicitud debe pertenecer al proveedor ("La solicitud no corresponde a su establecimiento") | Policy → 403/404 | Policy |  |
| `SUP-BR-06` |  | §5 Reglas de negocio | Confirmar exige código de confirmación ≥ 4 caracteres (se imprime en el voucher del pasajero); se normaliza a mayúsculas | FormRequest | FormRequest |  |
| `SUP-BR-07` |  | §5 Reglas de negocio | Rechazar exige motivo (lista cerrada) y detalle | FormRequest | FormRequest |  |
| `SUP-BR-08` |  | §5 Reglas de negocio | Alternativa exige tipo y detalle; el servicio alternativo solo puede ser un servicio activo del propio proveedor; no cambia el estado del servicio hasta que Operaciones decida | FormRequest + Service | FormRequest · Service |  |
| `SUP-BR-09` |  | §5 Reglas de negocio | Una solicitud sin respuesta bloquea la emisión del voucher (RT-11) | Doc 05 OPS-BR-40 | Otra especificación |  |
| `SUP-BR-10` |  | §5 Reglas de negocio | Tiempo objetivo de respuesta: 24 h (mostrado en KPI) | UI + Job de recordatorio (§8) | Job/Listener · UI |  |
| `SUP-BR-20` |  | §5 Reglas de negocio | Rooming: solo listas cuyo hotel es el proveedor | Policy | Policy |  |
| `SUP-BR-21` |  | §5 Reglas de negocio | Confirmar habitaciones deja las observadas pendientes hasta que Operaciones resuelva la incidencia | Service | Service |  |
| `SUP-BR-22` |  | §5 Reglas de negocio | Observación de habitación exige motivo (lista cerrada) y propuesta del hotel; impacto `media`/`alta`/`baja`; genera incidencia asignada al coordinador de la orden (o Operaciones por defecto) | FormRequest + Service | FormRequest · Service |  |
| `SUP-BR-30` |  | §5 Reglas de negocio | Validar voucher: el código debe existir y estar emitido a nombre del proveedor ("no corresponde a un voucher emitido a su establecimiento") | Service → 404 | Service |  |
| `SUP-BR-31` |  | §5 Reglas de negocio | Voucher `anulado` → rechazo "no es válido para el servicio"; `utilizado` → aviso con fecha de uso previa (no se reutiliza) | Service → 409 | Service |  |
| `SUP-BR-32` |  | §5 Reglas de negocio | Si la fecha del servicio es futura se advierte "Registre el uso solo si el huésped ya se presentó" y requiere confirmación | UI + flag `confirm_future=true` | UI |  |
| `SUP-BR-33` |  | §5 Reglas de negocio | Canje idempotente: dos validaciones simultáneas del mismo código → una sola aplica | `Idempotency-Key` + `lock_version` | Middleware · Service |  |
| `SUP-BR-40` |  | §5 Reglas de negocio | Factura: número con formato serie-correlativo `^[A-Z0-9]{4}-\d{1,8}$`, fecha de emisión y archivo PDF/XML/ZIP obligatorios | FormRequest | FormRequest |  |
| `SUP-BR-41` |  | §5 Reglas de negocio | Importe distinto del saldo de la CxP (> 0.01) no bloquea: se registra con advertencia "Finanzas revisará la diferencia" | Service (`amount_difference`) | Service |  |
| `SUP-BR-42` |  | §5 Reglas de negocio | Solo CxP del proveedor y no `pagada`; una factura activa por CxP | Policy + constraint | Policy · BD |  |
| `SUP-BR-43` |  | §5 Reglas de negocio | Finanzas programa el pago solo con factura registrada | Doc Finanzas (regla de pago) | Otra especificación |  |
| `SUP-BR-44` |  | §5 Reglas de negocio | Saldos por moneda sin conversión (el proveedor factura en su moneda de contrato) | Resource | Resource |  |
| `SUP-BR-50` |  | §5 Reglas de negocio | Incidencias visibles: `provider_id` = proveedor, reportadas por usuarios del proveedor, o de tipo Proveedor en reservas con servicios del proveedor | Scope | Policy |  |
| `SUP-BR-51` |  | §5 Reglas de negocio | Nueva incidencia solo sobre servicios del proveedor no cancelados/rechazados con fecha ≥ hoy − 7 días; asunto y descripción obligatorios; tipos: Proveedor, Horario, Capacidad, Pasajero, Otro | FormRequest | FormRequest |  |
| `SUP-BR-52` |  | §5 Reglas de negocio | Incidencia crítica desde la extranet notifica a Operaciones como `incidencia.critica` (y debe disparar la alerta a gerencia de PROC-037, §11) | Listener | Job/Listener |  |
| `SUP-BR-53` |  | §5 Reglas de negocio | Comentarios solo en incidencias abiertas/en proceso; en el seguimiento los autores internos se muestran como "Operaciones {agencia}" | Service + Resource | Service · Resource |  |
| `SUP-BR-60` |  | §5 Reglas de negocio | Contrato: alerta si vence en < 60 días; vencido → "La agencia no puede solicitar nuevos servicios hasta renovarlo" (PRD-BR-007: proveedor inactivo no disponible para nuevas ventas) | Resource + regla catálogo | Resource |  |
| `SUP-BR-61` |  | §5 Reglas de negocio | Actualización de tarifa: importe > 0; vigencia desde ≥ hoy + 30 días (cláusula de contrato); una solicitud pendiente por servicio | FormRequest + constraint | FormRequest · BD |  |
| `SUP-BR-62` |  | §5 Reglas de negocio | La nueva tarifa no se aplica automáticamente: requiere aprobación y crea una nueva vigencia; reservas confirmadas conservan la tarifa pactada (PRD-BR-008/009) | Service catálogo | Service |  |
| `SUP-BR-63` |  | §5 Reglas de negocio | Tarifas mostradas sin IGV; la aplicada en cada solicitud es la vigente a la fecha del servicio | Resource | Resource |  |
| `RT-16` | SUP-BR-70 | §5 Reglas de negocio | Toda acción del proveedor queda auditada con actor externo | Listener audit | Job/Listener |  |

### 07 · Finanzas (`07-finanzas.md`) — 70 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `RT-9` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Todo pago se asocia a una obligación: registrar exige CxC con saldo > 0 no cancelada; aplicar exige CxC de la misma reserva y moneda. Mensaje: "Regla transversal 9: el pago debe asociarse a una obligación" | S | Service |  |
| `RT-10` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Facturación con datos fiscales válidos (§5.7) | FR + S | FormRequest · Service |  |
| `RT-14` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Crédito B2B solo para agencias asociadas con línea vigente y estado `activa` | S | Service |  |
| `RT-15` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Moneda y TC conservados en CxC, pago, CxP, payout, comisión y comprobante; consolidación en PEN al TC del documento (fallback TC del día) | S + DB (CHECK fx en USD) | Service · BD |  |
| `RT-16` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Acciones críticas auditadas (§9) | S | Service |  |
| `RT-17` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | El backend valida permisos; sin permiso el botón se oculta y la acción responde 403 (prototipo: toast "Sin permiso para … requiere …") | P | Policy |  |
| `RT-22` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Idempotencia en registrar/aplicar/revertir pago, pago a proveedor, emisión, liquidación, cálculo de comisiones | Middleware `Idempotency-Key` | Middleware |  |
| `RT-23` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Documentos vinculados al origen (comprobante → CxC → reserva; NC → comprobante) | DB | BD |  |
| `RT-24` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Sin borrado físico; comprobantes nunca se eliminan | DB | BD |  |
| `PRD-BR-007` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Proveedor inactivo no disponible: el modal "Registrar costo" solo lista proveedores `activo`; aprobar CxP de proveedor no activo muestra advertencia (no bloquea) | S | Service |  |
| `PRD-BR-014` |  | §5 Reglas de negocio › §5.1 Transversales aplicadas | Modificación crítica auditada | S | Service |  |
| `FIN-BR-01` |  | §5 Reglas de negocio › §5.2 Cuentas por cobrar y anticipos (PROC-040/041) | Estado de CxC según §4.1; `paid_amount` = Σ aplicaciones vigentes de pagos `aplicado` (no se confía en valor enviado) | S + J | Service · Job/Listener |  |
| `FIN-BR-02` |  | §5 Reglas de negocio › §5.2 Cuentas por cobrar y anticipos (PROC-040/041) | Anticipo solo para reservas no `cancelada`/`completada` | FR | FormRequest |  |
| `FIN-BR-03` |  | §5 Reglas de negocio › §5.2 Cuentas por cobrar y anticipos (PROC-040/041) | Importe de anticipo > 0 y ≤ total de la reserva − Σ CxC no canceladas ("PROC-041: el anticipo excede el saldo no comprometido de la reserva") | S (con lock de reserva) | Service |  |
| `FIN-BR-04` |  | §5 Reglas de negocio › §5.2 Cuentas por cobrar y anticipos (PROC-040/041) | Defaults del modal: 50 % del total (tope: disponible), vencimiento hoy+3, concepto "Anticipo N% — {título}", moneda de la reserva, TC del día si USD, notificar = sí | FR (defaults UI) | FormRequest · UI |  |
| `FIN-BR-05` |  | §5 Reglas de negocio › §5.2 Cuentas por cobrar y anticipos (PROC-040/041) | Recordatorio: bloqueado si la CxC está pagada; envía email y WhatsApp si el cliente tiene teléfono; registra fecha | S | Service |  |
| `FIN-BR-06` |  | §5 Reglas de negocio › §5.2 Cuentas por cobrar y anticipos (PROC-040/041) | Aging en listado: Por vencer / 0–30 / 31–60 / >60 días sobre saldos abiertos en PEN; panel Finanzas usa 5 tramos (…/61–90/>90) — **unificar a 5 tramos** [Decisión] | S (query) | Service |  |
| `FIN-BR-07` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Monto > 0 y ≤ saldo de la CxC ("PROC-042: el monto … no puede exceder el saldo pendiente") | FR + S | FormRequest · Service |  |
| `FIN-BR-08` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Referencia/N° de operación obligatoria salvo métodos Efectivo ("Caja sede") y Crédito B2B ("Línea B2B") | FR | FormRequest |  |
| `FIN-BR-09` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Pago en USD requiere TC (default TC del día) y se conserva | FR | FormRequest |  |
| `FIN-BR-10` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Crédito B2B: el cliente debe ser una agencia (`b2b_agencies.client_id`), agencia `activa`, y monto en PEN ≤ `credit_limit − credit_used`; suma a `credit_used`; la reversión resta (mín. 0) | S + lock `b2b:credit:{agency}` | Service |  |
| `FIN-BR-11` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Registro back-office = confirmar + aplicar atómico (dos transiciones, un evento `PaymentApplied`) | S | Service |  |
| `FIN-BR-12` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Solo pagos `pendiente` se validan; el modal muestra si el abono figura en el extracto (línea con match) y advierte si no | S | Service |  |
| `FIN-BR-13` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Rechazo con motivo obligatorio; la CxC se mantiene; se notifica al cliente; reintento vuelve a `pendiente` e incrementa `retries` (Excepción "Pago rechazado" DOC-PROC-001 §24) | FR + S | FormRequest · Service |  |
| `FIN-BR-14` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Solo pagos `confirmado` se aplican; sin aplicación parcial ni reparto entre CxC; monto ≤ saldo de la CxC elegida | S | Service |  |
| `FIN-BR-15` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Tras aplicar: recalcular CxC y, si la reserva está `pendiente_pago` y todas sus CxC no canceladas están pagadas, pasarla a `confirmada` (auditoría "confirmada (obligaciones pagadas)") | S | Service |  |
| `FIN-BR-16` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Reversión: permiso `finance.payments.revert`, solo `confirmado`/`aplicado`, motivo obligatorio, desaplicar y recalcular; el modal muestra saldo antes/después | P + FR + S | FormRequest · Policy · Service |  |
| `FIN-BR-17` |  | §5 Reglas de negocio › §5.3 Pagos, aplicación y reversión (PROC-042/043) | Pagos `revertido`/`rechazado` no participan en conciliación ni en saldos | S | Service |  |
| `FIN-BR-18` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Estado de CxP según §4.3 | S + J | Service · Job/Listener |  |
| `FIN-BR-19` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Programar o pagar exige CxP aprobada ("PROC-046: Obligación → Aprobación → Pago") | S | Service |  |
| `FIN-BR-20` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Aprobación advierte (no bloquea) si el proveedor no está activo o la reserva no existe | S | Service |  |
| `FIN-BR-21` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Programación: fecha ≥ hoy (default: vencimiento, o hoy si vencida); cuenta de origen de la misma moneda | FR | FormRequest |  |
| `FIN-BR-22` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Payout: monto > 0 y ≤ saldo; N° de operación obligatorio; TC obligatorio si USD; al quedar pagada se limpia la programación | FR + S | FormRequest · Service |  |
| `FIN-BR-23` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Registrar costo: reserva no `cancelada`/`borrador`; proveedor activo; servicio opcional (si se elige, precarga el proveedor del servicio); monto > 0; vence hoy+15 por defecto; nace `abierta` sin aprobar | FR + S | FormRequest · Service |  |
| `FIN-BR-24` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | El costo solo impacta la rentabilidad al aprobarse; el modal muestra el impacto estimado en el margen (semáforo) | S | Service |  |
| `FIN-BR-25` |  | §5 Reglas de negocio › §5.4 Cuentas por pagar y costos (PROC-044/045/046) | Panel Finanzas marca CxP "sin factura" si el proveedor no cargó su factura en la extranet; la extranet informa "Finanzas programa el pago solo con la factura registrada" — **no se bloquea en el prototipo** (§12 P-11) | S | Service |  |
| `FIN-BR-26` |  | §5 Reglas de negocio › §5.5 Comisiones (PROC-047) | Regla: reserva canal `B2B` con agencia vinculada al cliente → beneficiario agencia, `% = commission_pct` del convenio, base = total de la reserva. Si no: beneficiario = responsable de la reserva, 2,5 % si canal Corporativo/Grupos o cliente segmento Corporativo, si no 3 %; base = total/1,18 en PEN, total en USD ("exportación, sin IGV") | S (config en `fin_commission_rules`) | Service |  |
| `FIN-BR-27` |  | §5 Reglas de negocio › §5.5 Comisiones (PROC-047) | Se calculan para reservas en `confirmada, en_operacion, completada, pendiente_pago, pendiente_proveedor, parcial, reprogramada`; máximo una por (reserva, tipo) | S + DB unique | Service · BD |  |
| `FIN-BR-28` |  | §5 Reglas de negocio › §5.5 Comisiones (PROC-047) | Aprobar solo `calculada`; pagar solo `aprobada`; forma de pago según tipo (vendedor: Planilla del mes / Transferencia; agencia: NC a cuenta B2B / Transferencia); referencia obligatoria | S + FR | FormRequest · Service |  |
| `FIN-BR-29` |  | §5 Reglas de negocio › §5.5 Comisiones (PROC-047) | Recalcular prohibido si `pagada`; si estaba `aprobada` vuelve a `calculada` y requiere nueva aprobación | S | Service |  |
| `FIN-BR-30` |  | §5 Reglas de negocio › §5.5 Comisiones (PROC-047) | El detalle alerta si el monto difiere de la regla vigente en > 0,05 | S | Service |  |
| `FIN-BR-31` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Universo: reservas ≠ `borrador`/`cancelada` | S | Service |  |
| `FIN-BR-32` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Ingresos = total de la reserva (PEN al TC de la reserva); costo = Σ costo de servicios no cancelados + costos adicionales **aprobados**; margen bruto = ingresos − costo; utilidad neta = margen − Σ comisiones (todas); margen % = bruto/ingresos | S | Service |  |
| `FIN-BR-33` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Semáforo de margen: < 15 % rojo, 15–25 % ámbar, > 25 % verde (panel Finanzas: ≥ 25 % verde) — **unificar** [Decisión] | S | Service |  |
| `FIN-BR-34` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Margen por producto: Σ (precio − costo) de servicios con `product_id` | S | Service |  |
| `FIN-BR-35` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Datos de margen, costos y utilidad solo para `finance.profitability` / `catalog.products.view_profitability` / `quotes.approve_internal` (BRIEF_ROLES principio 2) | P | Policy |  |
| `FIN-BR-36` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Liquidar requiere: ≥ 1 CxC y todas pagadas; todas las CxP de la reserva con saldo 0; costos adicionales aprobados; comisiones aprobadas o pagadas; reserva `completada`. Mensaje enumerando pendientes | S | Service |  |
| `FIN-BR-37` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Liquidación guarda snapshot (ingreso, costo, comisiones, utilidad, %) y notifica al responsable (`reserva.liquidada`, portal); no se re-liquida | S + DB unique | Service · BD |  |
| `FIN-BR-38` |  | §5 Reglas de negocio › §5.6 Rentabilidad y liquidación (PROC-048) | Estado de cuenta: email al cliente con saldo por cobrar; auditado | S | Service |  |
| `FIN-BR-39` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Factura: documento RUC que cumpla `^(10\|15\|17\|20)\d{9}$` ("Factura requiere RUC válido de 11 dígitos (Regla transversal 10)") | FR | FormRequest |  |
| `FIN-BR-40` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Boleta: DNI `^\d{8}$` o Pasaporte/CE `^[A-Z0-9]{6,12}$`; si el documento es RUC → error "corresponde emitir factura" | FR | FormRequest |  |
| `FIN-BR-41` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | NC: debe referenciar un comprobante `aceptado`, del mismo cliente y que no sea NC; documento del adquirente obligatorio; importe ≤ importe del referenciado | FR + S | FormRequest · Service |  |
| `FIN-BR-42` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Razón social/nombre obligatorio; descripción obligatoria | FR | FormRequest |  |
| `FIN-BR-43` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Importe > 0 y ≤ máximo facturable de la CxC = importe CxC − Σ (comprobantes no anulados de esa CxC, NC con signo negativo; comprobantes antiguos sin CxC se imputan por reserva e importe igual) | S | Service |  |
| `FIN-BR-44` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Tipo por defecto según documento del cliente (RUC → Factura, otro → Boleta); importe por defecto = min(pagado, pendiente de facturar) si hay pagos, si no el pendiente | FR (defaults) | FormRequest |  |
| `FIN-BR-45` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Domiciliado → operación gravada, IGV 18 % **incluido** (base = total/1,18); no domiciliado → exportación sin IGV. Default: domiciliado si país del cliente = Perú | S | Service |  |
| `FIN-BR-46` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Numeración: Factura `F001-` + 8 dígitos, Boleta `B001-` + 8 dígitos (series configurables); NC `FC01-` si modifica factura, `BC01-` si modifica boleta | S + `FOR UPDATE` | Service · BD |  |
| `FIN-BR-47` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Solo se entregan comprobantes `aceptado` ("Solo se entregan comprobantes aceptados por el OSE"); NC solo desde `aceptado` | S | Service |  |
| `FIN-BR-48` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | Periodo cerrado: no se emiten comprobantes con fecha del periodo; ajustes vía NC/ND en el periodo siguiente (texto del cierre; **no aplicado en el prototipo**, implementar) | S | Service |  |
| `FIN-BR-49` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | La emisión es asíncrona: se persiste, se encola en outbox y la UI muestra "Esperando respuesta del OSE"; errores externos no revierten la transacción interna (PROC-065, RT-21) | S + J | Service · Job/Listener |  |
| `FIN-BR-50` |  | §5 Reglas de negocio › §5.7 Facturación electrónica (PROC-050) | "Cobrado por facturar" = por reserva, Σ pagos aplicados (PEN) − Σ comprobantes ≠ NC no anulados (PEN) > 0,50 | S | Service |  |
| `FIN-BR-51` |  | §5 Reglas de negocio › §5.8 Conciliación bancaria (PROC-049) | Candidatos: abono (> 0) ↔ pagos no `revertido`/`rechazado` no vinculados a otra línea; cargo (< 0) ↔ CxP aprobadas o pagadas no vinculadas | S | Service |  |
| `FIN-BR-52` |  | §5 Reglas de negocio › §5.8 Conciliación bancaria (PROC-049) | Match: \|importe PEN del candidato − \|importe línea\|\| < 0,50; se prioriza el candidato cuyo N° (≥ 5 dígitos) de la descripción aparece en la referencia del pago o en el RUC del proveedor. Pagos USD al TC conservado del pago; CxP por saldo (o importe si pagada) | S | Service |  |
| `FIN-BR-53` |  | §5 Reglas de negocio › §5.8 Conciliación bancaria (PROC-049) | Confirmar: pago `pendiente` → `confirmado` (no aplica); CxP con saldo → payout `cargo_bancario` por min(\|cargo\|/TC, saldo) | S | Service |  |
| `FIN-BR-54` |  | §5 Reglas de negocio › §5.8 Conciliación bancaria (PROC-049) | Resolver excepción exige sustento; asignar requiere candidato; alternativa "otro ingreso" (abono) o "gasto/comisión bancaria" (cargo) sin afectar obligaciones | FR + S | FormRequest · Service |  |
| `FIN-BR-55` |  | §5 Reglas de negocio › §5.8 Conciliación bancaria (PROC-049) | Cerrar exige que todas las líneas abiertas estén `conciliado`; las líneas cerradas quedan bloqueadas; resumen abonos/cargos/neto | S | Service |  |
| `FIN-BR-56` |  | §5 Reglas de negocio › §5.9 Cierre contable de periodo | 7 controles (§2.2); cerrar exige todos OK; mensaje lista los pendientes | S | Service |  |
| `FIN-BR-57` |  | §5 Reglas de negocio › §5.9 Cierre contable de periodo | Controles manuales: solo `finance.invoicing` y periodo abierto; registran usuario y fecha; se auditan al marcar y desmarcar | P + S | Policy · Service |  |
| `FIN-BR-58` |  | §5 Reglas de negocio › §5.9 Cierre contable de periodo | Al cerrar notifica a Finanzas (`contabilidad.cierre`, email) | J | Job/Listener |  |
| `FIN-BR-59` |  | §5 Reglas de negocio › §5.10 Permisos compuestos | Toda acción operativa de tesorería (registrar/validar/aplicar/rechazar pagos, anticipos, recordatorios, programar/pagar CxP, registrar costos, calcular/recalcular/pagar comisiones, liquidar, estado de cuenta, conciliación) exige `finance.payments.register` además del permiso del recurso | P | Policy |  |

### 08 · Canales y portales (`08-canales-portales.md`) — 68 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `RT-14` | PRD-BR-016 | §5 Reglas de negocio › §5.1 B2B (PROC-053) | B2B por agencia/producto/vigencia: una agencia solo ve y reserva productos con tarifa asignada a ella y no vencida. Mensajes: "Sin tarifa B2B asignada a su lista de precios (Regla 14…)" / "Tarifa B2B vencida el dd mmm aaaa (Regla 14)". El botón Reservar queda deshabilitado. | Service `B2bTermsResolver` + Policy | Policy · Service |  |
| `B2B-BR-01` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Catálogo autorizado = productos `status='ACTIVE'` **y** `is_b2b=true` (agregado: y canal B2B publicado en `catalog_product_channels`, como exige Catálogo). Orden: primero los reservables. | Query/Service | Service · Query/Read model |  |
| `B2B-BR-02` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Agencia `vencido` o `inactiva` no puede reservar (ni prepago): "Regla 14: convenio vencido/inactiva. No es posible reservar." Login de agencia `inactiva` denegado. | Policy `reserve` + Auth | Policy |  |
| `B2B-BR-03` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Crédito solo si: tarifa `credit_allowed` **y** `credit_limit > 0` **y** estado efectivo `activa`. Si no, única forma de pago = prepago. | FormRequest + Service | FormRequest · Service |  |
| `B2B-BR-04` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Reserva a crédito rechazada si el total (convertido a PEN) > crédito disponible: "Crédito insuficiente… el sistema bloquea la reserva a crédito" + opción "Cambiar a prepago". Se audita `credito_excedido` aun sin crear reserva. | Service (con `SELECT … FOR UPDATE` sobre la agencia) | Service · BD |  |
| `B2B-BR-05` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Pasajeros entre `min_pax` y `max_pax` del producto. | FormRequest | FormRequest |  |
| `B2B-BR-06` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Anticipación mínima `advance_min_days`: salida o fecha con menos días → rechazo. Sin salidas: fecha mínima = hoy + advMin (sugerida hoy + max(advMin,7)). | FormRequest + Service | FormRequest · Service |  |
| `RT-4` | PRD-BR-012 | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Sin disponibilidad no se confirma: si la salida tiene menos cupos libres que pax → "Sin disponibilidad… Elija otra salida." | Service + lock Redis de salida | Service |  |
| `B2B-BR-07` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | No se puede desbloquear una agencia cuyo crédito utilizado supera el límite: "Amplíe el límite o registre pagos (Regla 14)". | Service | Service |  |
| `B2B-BR-08` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Bloqueo automático al guardar agencia si `credit_limit > 0` y `credit_used > credit_limit` (toast de advertencia). | Service (observer) | Service |  |
| `B2B-BR-09` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Alta/edición: razón social, RUC (11 dígitos), contacto, comisión (0–30), vigencias obligatorias; `valid_to >= valid_from`. | FormRequest | FormRequest |  |
| `B2B-BR-10` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Tarifa B2B por agencia: precio neto ≤ precio público vigente ("El precio B2B no puede superar el precio público"); al asignar se marca el producto `is_b2b=true`. Agregado para unificar con Catálogo: precio neto ≥ costo (bloquea), crédito permitido solo si la agencia tiene línea > 0, no asignable a agencias no activas. | FormRequest + Service (misma regla en Catálogo y Canales) | FormRequest · Service |  |
| `B2B-BR-11` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Estado inicial de la reserva: crédito+salida → `confirmada` + voucher v1; crédito sin salida → `pendiente_proveedor`; prepago → `pendiente_pago` ("Prepago requerido antes de emitir voucher"). | Service | Service |  |
| `B2B-BR-12` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Efectos de la reserva: CxC por el total neto (crédito: vence hoy + 15 d; prepago: hoy + 1 d); comisión `calculada` = total × comisión% (2 decimales); si crédito, `credit_used += total en PEN`. **Precisado**: `credit_used` se mueve solo vía `channel_b2b_credit_movements` (cargo al reservar, liberación al aplicar pago o anular) — evita el doble conteo actual con el método de pago "Crédito B2B" de Finanzas. | Service + listener `PaymentApplied` | Service |  |
| `B2B-BR-13` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Nombres de pasajeros opcionales (una línea "Nombre — Documento"); faltantes quedan "Pasajero n (por nominar)" / "Por registrar". Nominación completa exigible antes del voucher en productos nominativos (ver 12). | Service | Service |  |
| `B2B-BR-14` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | "Informar pago": monto > 0 y ≤ saldo; N.° de operación obligatorio; crea pago `pendiente` (por validar) y notifica a Finanzas. El crédito se libera al **aplicar** el pago (Finanzas). | FormRequest + Service | FormRequest · Service |  |
| `B2B-BR-15` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | "Solicitar liquidación de comisiones": solo si hay comisiones no pagadas ("No hay comisiones pendientes de liquidar"). Crea solicitud (agregado) y notifica a Finanzas. | Service | Service |  |
| `B2B-BR-16` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | La agencia solo ve reservas `channel='B2B'` de su agencia (`agency_id`, o `crm_client_id` de la agencia) y sus CxC/pagos/comisiones. Ve "Total neto", su referencia; no ve notas internas, costos ni márgenes. | Policy + Resource | Policy · Resource |  |
| `B2B-BR-17` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Usuario B2B sin agencia vinculada → "Su usuario no está vinculado a una agencia con convenio." | Middleware | Middleware |  |
| `RT-11` |  | §5 Reglas de negocio › §5.1 B2B (PROC-053) | Voucher solo con servicio confirmado: prepago muestra "Tras el pago". | Service Operaciones | Service |  |
| `ECO-BR-01` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Publicar en tienda solo si producto `ACTIVE` ("Solo productos en estado ACTIVE pueden publicarse… Regla transversal 18") y con tarifa web o pública vigente ("El producto no tiene tarifa vigente"). Publicar/despublicar actualiza `is_ecommerce` y el canal `ecommerce`. | FormRequest + Service | FormRequest · Service |  |
| `ECO-BR-02` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Catálogo público = `ACTIVE` ∧ `is_ecommerce` ∧ tarifa vigente. Detalle de producto no publicado → "Este producto no está disponible para la venta en línea." | Query público | Query/Read model |  |
| `ECO-BR-03` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Precio adulto: tarifa vigente canal `E-commerce` segmento Adulto/Pasajero; si no existe, tarifa pública `Directo` (Adulto/Pasajero → cualquiera Directo → primera vigente). Precio niño: tarifa `Niño`/`Directo`; si no existe, precio adulto. Se muestra precio tachado si la pública > web. | `PricingService` (PRD-BR-010, RT-5) | Service |  |
| `ECO-BR-04` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Personalización: cada opción suma `delta` por persona (adulto y niño); opción por defecto = la de delta 0. | PricingService | Service |  |
| `ECO-BR-05` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Promociones aplicables: `activa`, vigentes hoy, canal `E-commerce` o `Todos`. Código (case-insensitive) inválido → "Código no válido… o fuera de vigencia" y **bloquea continuar** en el paso Precio. Automática "Descuento por cantidad" (sin código) cuando pax ≥ 4. **No acumulables**: se aplica el mayor descuento. Descuento = subtotal × %; total redondeado a 2 decimales. | PricingService | Service |  |
| `ECO-BR-06` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Pasajeros: adultos ≥ 1; total ≤ `max_pax` ("Máximo n pasajeros por compra"); al continuar desde Configuración, total entre `min_pax` y `max_pax`. Niños solo si existe tarifa niño o `min_age < 12` (rango "2–11" o "minAge–11"). | FormRequest | FormRequest |  |
| `ECO-BR-07` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Disponibilidad con salidas: salida obligatoria; no agotada; cumple anticipación mínima ("Venta cerrada" en el selector); cupos ≥ pax (RT-4). Sin salidas: fecha obligatoria entre hoy+advMin y hoy+advMax; bajo solicitud ("confirmación del proveedor en máximo 24 h; el cobro se realiza ahora y se reembolsa si no hay confirmación"). | Service | Service |  |
| `ECO-BR-08` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Datos del comprador: nombre, documento, número, email válido (`^[^@\s]+@[^@\s]+\.[a-z]{2,}$`), celular, país; acompañantes con nombre y documento obligatorios. Tratamiento Ley 29733. | FormRequest | FormRequest |  |
| `ECO-BR-09` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Revalidación de disponibilidad al pagar si el pedido aún no existe; si falla → vuelve al paso Disponibilidad. | Service | Service |  |
| `ECO-BR-10` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Pedido creado al primer intento de pago: cliente por email (reutiliza si existe; si no crea Persona, segmento Retail, tags Web/E-commerce), reserva `pendiente_pago` (canal E-commerce), CxC vence hoy, consumo de cupos. | Service (transacción + idempotencia) | Service |  |
| `ECO-BR-11` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Hold: los cupos quedan retenidos `hold_minutes` (30). **Agregado**: al expirar sin pago aprobado, el pedido pasa a `expirado` y se liberan cupos/reserva/CxC (el prototipo lo anuncia pero no lo ejecuta). | Job `ExpireEcomHolds` | Job/Listener |  |
| `ECO-BR-12` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Pago rechazado: la obligación y los cupos se mantienen; se puede reintentar con otra tarjeta; desde "Pago" no se puede volver atrás si el pedido existe ("complete el pago o anúlelo desde gestión"). | Service | Service |  |
| `ECO-BR-13` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Pago aprobado: pago `aplicado` por el total, CxC `pagada`, reserva/servicios según ECO-BR (4.2), voucher v1 solo si hay salida confirmada (RT-11). | Service (webhook idempotente) | Service |  |
| `ECO-BR-14` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Anular pedido solo en `pago_pendiente`/`pago_rechazado`, motivo obligatorio; libera cupos, cancela reserva y CxC sin pagos. Enviar enlace de pago solo en esos estados. | Policy + Service | Policy · Service |  |
| `ECO-BR-15` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Promoción nueva: producto ACTIVE, nombre, % 1–50, vigencia `hasta ≥ desde`, código único en el tenant (mayúsculas, sin espacios); con código → tipo "Descuento %", sin código → "Descuento por cantidad". | FormRequest | FormRequest |  |
| `ECO-BR-16` |  | §5 Reglas de negocio › §5.2 E-commerce (PROC-054) | Nunca se almacena PAN/CVV; solo últimos 4 dígitos y token/ID de la pasarela (INT-02 por definir). | Adapter de pagos | Service |  |
| `CMS-BR-01` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Aprobar, publicar, despublicar y devolver requieren `channels.cms.publish` ("solo puede redactar y enviar a revisión"). | Policy | Policy |  |
| `CMS-BR-02` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Editar un contenido `publicado` requiere `channels.cms.publish` ("Solicite a un editor que lo despublique"). En `en_revision`/`aprobado` sin permiso no hay botón Guardar. | Policy | Policy |  |
| `CMS-BR-03` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Slug único por tenant ("La URL /x ya está en uso"); si vacío se genera del título (minúsculas, sin tildes, `-`, máx. 60). | FormRequest + UNIQUE | FormRequest · BD |  |
| `CMS-BR-04` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Publicar exige título SEO ("Complete el título SEO antes de publicar"). Recomendado: SEO title ≤ 60, meta ≤ 160 (solo placeholder en prototipo; agregado como validación dura de longitud). | FormRequest | FormRequest |  |
| `CMS-BR-05` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Devolver y despublicar exigen motivo; queda en bitácora y auditoría. | FormRequest | FormRequest |  |
| `CMS-BR-06` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Cada transición registra evento en bitácora (usuario, fecha, mensaje, motivo). | Service | Service |  |
| `CMS-BR-07` |  | §5 Reglas de negocio › §5.3 CMS (PROC-055) | Solo contenido `publicado` (y dentro de vigencia, agregado) se entrega a canales (sitio, tienda, portales). | Query pública | Query/Read model |  |
| `PCL-BR-01` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | El cliente solo accede a su `crm_client_id`; cualquier otro id en la URL redirige al propio. Sin vínculo → "Su usuario no está vinculado a una cuenta de cliente." | Middleware + Policy | Policy · Middleware |  |
| `PCL-BR-02` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Solo se muestran cotizaciones ≠ `borrador` (versión vigente), reservas ≠ `borrador`, CxC ≠ `cancelada`. | Query | Query/Read model |  |
| `PCL-BR-03` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Cotización vencida no puede aprobarse (Excepción "Cotización vencida", PROC-024). | Service | Service |  |
| `PCL-BR-04` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Aprobar exige nombre de quien aprueba y aceptación de condiciones; registra evidencia (fecha-hora, IP, token, versión, total, moneda, comentario, hash). | FormRequest + Service | FormRequest · Service |  |
| `PCL-BR-05` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Rechazar exige motivo (Precio, Cambio de fechas, Eligió otra agencia, Cambio de destino, Viaje cancelado, Otro) y comentario. | FormRequest | FormRequest |  |
| `PCL-BR-06` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Abrir una cotización `enviada` la marca `vista` **solo si el actor es el cliente** (precisado: el prototipo también la marca en la previsualización interna). | Service | Service |  |
| `RT-9` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Pago en línea: monto > 0 y ≤ saldo ("Regla 9: pago asociado a obligación"); pagos parciales permitidos. | FormRequest | FormRequest |  |
| `PCL-BR-07` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Pago rechazado: registra pago `rechazado`, mantiene obligación, permite reintento. | Service | Service |  |
| `PCL-BR-08` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Documentos visibles: vouchers no anulados de sus reservas, comprobantes del cliente, propuestas aprobadas/convertidas, itinerarios de reservas confirmada/en_operacion/completada. | Query | Query/Read model |  |
| `PCL-BR-09` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Ticket: asunto y mensaje obligatorios; se asigna al asesor del cliente. | FormRequest | FormRequest |  |
| `PCL-BR-10` |  | §5 Reglas de negocio › §5.4 Portal del cliente (PROC-051) | Ventas previsualiza solo clientes de su cartera (`Scope.clientIds`) con cotizaciones no borrador o reservas; cliente ajeno → "Registro fuera de su cartera". | Policy | Policy |  |
| `PPX-BR-01` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | El pasajero ve solo la reserva vinculada a su usuario (`reservation_id`); sin reserva → "No encontramos un viaje vinculado a su cuenta." | Middleware + Policy | Policy · Middleware |  |
| `PPX-BR-02` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | Acceso por enlace/código: email + código de reserva deben coincidir con el email del cliente titular ("Correo o código de reserva no coinciden"). | Service auth | Service |  |
| `PPX-BR-03` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | Alertas = incidencias de la reserva tipo Transporte u Horario, no cerradas/resueltas; se muestran con el texto público de la incidencia. | Query | Query/Read model |  |
| `PPX-BR-04` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | Confirmar lectura registra fecha, usuario, bitácora de la incidencia y notifica al responsable. | Service | Service |  |
| `PPX-BR-05` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | Vouchers: solo no anulados, última versión; cada apertura se audita. | Service | Service |  |
| `PPX-BR-06` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | Mensaje a operaciones: mensaje obligatorio; tema "Salud" → prioridad alta; se asigna al coordinador de la operación. | FormRequest + Service | FormRequest · Service |  |
| `PPX-BR-07` |  | §5 Reglas de negocio › §5.5 Portal del pasajero (PROC-052) | Estado visual de servicio: completado si `status='completado'` o fecha pasada; "Hoy"; hotel "En curso" durante la estadía; "Próximo". | Resource (derivado) | Resource |  |
| `CAN-V21-01` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | Cada sección desaparece (nav, accesos, ruta → «Mi viaje») cuando su regla está desactivada: Mensajes ↔ R-PAX-MESSAGES, Comentarios ↔ R-PAX-FEEDBACK, Acompañantes ↔ R-COMPANIONS en modo `antes_de_viaje`; bloques del resumen ↔ R-LODGING/R-ADDONS/R-PICKUP/R-COMMENTS/R-DEPOSIT/R-MULTICURRENCY | Policy + Resource | Policy · Resource | `R-PAX-MESSAGES` `R-PAX-FEEDBACK` `R-COMPANIONS` `R-LODGING` `R-ADDONS` `R-PICKUP` `R-COMMENTS` `R-DEPOSIT` `R-MULTICURRENCY` |
| `CAN-V21-02` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | El pasajero solo ve mensajes `enviado\|entregado\|leido\|fallido` (no programados ni cancelados) de su reserva | Query scope | Policy · Query/Read model |  |
| `CAN-V21-03` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | Comentario: texto 5–1000 caracteres, calificación 1–5 o nula, servicio de la misma reserva | FormRequest | FormRequest |  |
| `CAN-V21-04` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | Reclamo/incidencia → conversación en el Inbox; reclamo muestra enlace al Libro de Reclamaciones (Ley 29571) sin registrarlo automáticamente | Service | Service |  |
| `CAN-V21-05` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | Acompañantes: editable hasta `travelFrom − daysBeforeIfLater`; titular no editable (solo documento/nacimiento); edad a la fecha de viaje; si la edad cambia el tipo ADT/CHD/INF se rechaza (cambia precio → modificación PROC-027) | FormRequest + `BookingEngine.ageType` | FormRequest · Service |  |
| `CAN-V21-06` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | Pagar saldo: aplica a la CxC abierta más próxima; internos sin `finance.payments.register` solo previsualizan | Policy | Policy |  |
| `CAN-V21-07` |  | §5 Reglas de negocio › §5.6 v2.1 — Reglas de portales | Importes del resumen en moneda cobrada con equivalente en la moneda mostrada (TC referencial) si R-MULTICURRENCY | Resource | Resource | `R-MULTICURRENCY` |

### 09 · Administración y reportes (`09-administracion-reportes.md`) — 80 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `TEN-BR-01` |  | §5 Reglas de negocio | Subdominio 3–30 caracteres `[a-z0-9-]`, se normaliza a minúsculas; único en la plataforma. Mensajes: “Subdominio inválido…”, “El subdominio ya está en uso por otro tenant.” | FormRequest + UNIQUE | FormRequest · BD |  |
| `TEN-BR-02` |  | §5 Reglas de negocio | RUC 11 dígitos que inicia con 10, 15, 17 o 20; único (“Ya existe un tenant con ese RUC”) | FormRequest + CHECK + UNIQUE | FormRequest · BD |  |
| `TEN-BR-03` |  | §5 Reglas de negocio | Obligatorios: nombre comercial, subdominio, razón social, RUC, domicilio fiscal, sede (nombre, ciudad, dirección), administrador (nombre, correo válido), validez de cotización, minutos de hold, IGV, tipo de cambio > 0 | FormRequest por paso (`POST /platform/tenants/validate-step`) y completo al crear | FormRequest |  |
| `TEN-BR-04` |  | §5 Reglas de negocio | Rol Tenant Admin siempre incluido en el alta (casilla deshabilitada) | Service | Service |  |
| `TEN-BR-05` |  | §5 Reglas de negocio | Descuento máximo sin aprobación ≤ 30 % (también en configuración) | FormRequest | FormRequest |  |
| `TEN-BR-06` |  | §5 Reglas de negocio | Canales no incluidos en el plan quedan bloqueados (entitlements) | Service (`plan_channels`) | Service |  |
| `TEN-BR-07` | PROC-001 | §5 Reglas de negocio | No se puede suspender el tenant de la sesión activa (“solicítelo desde otra cuenta de plataforma”) | Policy | Policy |  |
| `TEN-BR-08` |  | §5 Reglas de negocio | Suspender/Reactivar exige motivo, que queda en auditoría | FormRequest | FormRequest |  |
| `TEN-BR-09` |  | §5 Reglas de negocio | Cambio de plan: bloquea si usuarios > límite (“Desactive usuarios antes del downgrade”) o almacenamiento > límite; mismo plan → aviso sin cambios | Service (409 `PLAN_LIMIT_EXCEEDED`) | Service |  |
| `TEN-BR-10` |  | §5 Reglas de negocio | Tenant suspendido: sus usuarios no pueden iniciar sesión; los datos se conservan | Middleware `EnsureTenantActive` (403 `TENANT_SUSPENDED`) | Middleware |  |
| `TEN-BR-11` |  | §5 Reglas de negocio | La moneda base no puede cambiarse una vez registradas transacciones | Service | Service |  |
| `TEN-BR-12` |  | §5 Reglas de negocio | Plantilla “Mínimo privilegio”: roles no-admin reciben solo permisos `*.view`, `*.receivables`, `manage_availability`, `*.create` de su matriz estándar | Service | Service |  |
| `USR-BR-01` |  | §5 Reglas de negocio | Correo válido y único en el tenant (insensible a mayúsculas): “Ya existe una identidad con ese correo… Reactive el usuario existente” | FormRequest + UNIQUE | FormRequest · BD |  |
| `USR-BR-02` |  | §5 Reglas de negocio | Límite de usuarios del plan (usuarios no inactivos ≥ límite → bloqueo “Plan/entitlements”) | Service con lock | Service |  |
| `USR-BR-03` |  | §5 Reglas de negocio | El correo no se edita después de la invitación | FormRequest (campo prohibido) | FormRequest |  |
| `USR-BR-04` |  | §5 Reglas de negocio | No puede cambiar su propio rol | Policy | Policy |  |
| `USR-BR-05` |  | §5 Reglas de negocio | El tenant debe conservar al menos un Tenant Admin activo (al cambiar rol o desactivar) | Service | Service |  |
| `USR-BR-06` |  | §5 Reglas de negocio | No puede desactivar su propia cuenta | Policy | Policy |  |
| `USR-BR-07` |  | §5 Reglas de negocio | Baja lógica con motivo; se conservan historial, auditoría y registros | Service (sin DELETE) | Service |  |
| `USR-BR-08` |  | §5 Reglas de negocio | Aviso de oportunidades/actividades abiertas al desactivar (no bloquea) | Service (respuesta incluye `warnings`) | Service |  |
| `USR-BR-09` |  | §5 Reglas de negocio | Selector de rol excluye `super_admin` salvo que el actor sea Super Admin | FormRequest | FormRequest |  |
| `USR-BR-10` |  | §5 Reglas de negocio | Reset de MFA con motivo; obliga a re-enrolar en el próximo acceso y notifica al usuario | Service | Service |  |
| `USR-BR-11` |  | §5 Reglas de negocio | Invitación de un solo uso válida 72 h; la contraseña nunca viaja por correo | Service | Service |  |
| `SED-BR-01` |  | §5 Reglas de negocio | Nombre de sede único (insensible a mayúsculas); dirección obligatoria | FormRequest + UNIQUE | FormRequest · BD |  |
| `SED-BR-02` |  | §5 Reglas de negocio | Nuevas sedes limitadas por plan (Starter 1, Professional 2, Enterprise ilimitadas) | Service | Service |  |
| `SED-BR-03` |  | §5 Reglas de negocio | No se desactiva una sede con usuarios activos ni la última sede activa | Service | Service |  |
| `SED-BR-04` |  | §5 Reglas de negocio | No se elimina una sede con usuarios o reservas asociadas (“Desactívela para conservar el historial”) | Service + FK `RESTRICT` | Service · BD |  |
| `SED-BR-05` |  | §5 Reglas de negocio | Responsable: usuario activo con rol TA, Manager, Ventas, Operaciones o Finanzas | FormRequest | FormRequest |  |
| `RBAC-BR-01` |  | §5 Reglas de negocio | El rol Super Admin SaaS no se edita desde un tenant | Policy | Policy |  |
| `RBAC-BR-02` |  | §5 Reglas de negocio | Anti-bloqueo: Tenant Admin no pierde `admin.roles.manage` ni `admin.users.manage` | Service | Service |  |
| `RBAC-BR-03` |  | §5 Reglas de negocio | Roles de alcance `canal` o `mobile` no reciben permisos `admin.*` | Service | Service |  |
| `RBAC-BR-04` |  | §5 Reglas de negocio | Roles `canal`/`mobile` no reciben `finance.*`, `*profitability*` ni `quotes.discount_override` | Service | Service |  |
| `RBAC-BR-05` |  | §5 Reglas de negocio | `admin.tenant.manage` no es otorgable a roles del tenant (prototipo: “reservado al Tenant Admin”; ver §11) | Service | Service |  |
| `RBAC-BR-06` |  | §5 Reglas de negocio | Rol personalizado: nombre único, descripción obligatoria, alcance inmutable tras crearlo; al copiar permisos a un rol no-tenant se eliminan los prohibidos por RBAC-BR-03/04 | FormRequest + Service | FormRequest · Service |  |
| `RBAC-BR-07` |  | §5 Reglas de negocio | Rol personalizado con usuarios asignados no se elimina | Service | Service |  |
| `RBAC-BR-08` |  | §5 Reglas de negocio | Cambio masivo por módulo: aplica los permitidos e informa “N bloqueado(s) por reglas de seguridad” | Service (respuesta `applied`, `blocked`) | Service |  |
| `RBAC-BR-09` |  | §5 Reglas de negocio | Cada otorgamiento/revocación se audita y aplica en la siguiente solicitud del usuario (flush caché spatie) | Service + evento `PermissionsChanged` | Service · Job/Listener |  |
| `CFG-BR-01` |  | §5 Reglas de negocio | Guardado por diferencia: solo se persisten y auditan los campos modificados; sin cambios → “No hay cambios que guardar” | Service | Service |  |
| `CFG-BR-02` |  | §5 Reglas de negocio | Razón social, nombre comercial e iniciales del logo obligatorios; iniciales en mayúsculas, máx. 3 | FormRequest | FormRequest |  |
| `CFG-BR-03` |  | §5 Reglas de negocio | RUC y país no editables desde el tenant (“requiere validación de plataforma”) | FormRequest (prohibited) | FormRequest |  |
| `CFG-BR-04` |  | §5 Reglas de negocio | Tipo de cambio 0.5 < TC < 20 (“fuera de rango razonable”); IGV 0–30 % | FormRequest | FormRequest |  |
| `CFG-BR-05` |  | §5 Reglas de negocio | Moneda base bloqueada si existen reservas o pagos | Service | Service |  |
| `CFG-BR-06` |  | §5 Reglas de negocio | Cada cambio de TC agrega fila a historial con fecha, fuente y usuario; el TC se congela en snapshot de cotizaciones y pagos | Service | Service |  |
| `CFG-BR-07` |  | §5 Reglas de negocio | Correlativos: no se reutilizan ni retroceden; solo avanzar (migración); prefijo no vacío y único | FormRequest + trigger | FormRequest · BD |  |
| `CFG-BR-08` |  | §5 Reglas de negocio | Nuevas series solo para tipos no existentes: Nota de crédito, Nota de débito, Liquidación de comisión, Recibo de caja, Orden de compra a proveedor | FormRequest | FormRequest |  |
| `CFG-BR-09` |  | §5 Reglas de negocio | Validez de cotización 1–60 días; hold 5–1440 min (“El hold mínimo es 5 minutos”); descuento máx. ≤ 30 %; política de cancelación obligatoria | FormRequest | FormRequest |  |
| `CFG-BR-10` |  | §5 Reglas de negocio | Máx. pasajeros por guía 1–40; parámetros operativos obligatorios ≥ 0 | FormRequest | FormRequest |  |
| `CFG-BR-11` |  | §5 Reglas de negocio | Cambios de configuración aplican a documentos nuevos; los existentes conservan su snapshot | Service | Service |  |
| `CFG-BR-12` |  | §5 Reglas de negocio | Canales: solo los del plan son editables; habilitar e-commerce con pasarela INT-02 `por_validar` → aviso “los pagos quedarán como pendientes” (no bloquea) | Service | Service |  |
| `NTF-BR-01` |  | §5 Reglas de negocio | La incidencia crítica debe notificarse por al menos un canal | FormRequest + CHECK | FormRequest · BD |  |
| `NTF-BR-02` |  | §5 Reglas de negocio | “Probar” un evento sin canales activos → aviso | Service | Service |  |
| `NTF-BR-03` |  | §5 Reglas de negocio | Variables permitidas: `{{cliente}}`, `{{reserva}}`, `{{cotizacion}}`, `{{fecha_viaje}}`, `{{monto}}`, `{{servicio}}`, `{{hora}}`, `{{enlace}}`, `{{agencia}}`, `{{vendedor}}`; cualquier otra bloquea guardar y enviar prueba | FormRequest | FormRequest |  |
| `NTF-BR-04` |  | §5 Reglas de negocio | Push: cuerpo ≤ 140 caracteres | FormRequest + CHECK | FormRequest · BD |  |
| `NTF-BR-05` |  | §5 Reglas de negocio | Guardar plantilla sin cambios → aviso; cada guardado incrementa versión | Service | Service |  |
| `NTF-BR-06` |  | §5 Reglas de negocio | Un fallo de canal no revierte la transacción de negocio que originó el evento (PROC-065) | Listener en cola, fuera de la transacción | Service · Job/Listener |  |
| `NTF-BR-07` |  | §5 Reglas de negocio | Error permanente (WhatsApp sandbox 131026) no se resuelve reintentando: sugiere canal alterno | Service | Service |  |
| `NTF-BR-08` |  | §5 Reglas de negocio | Canal alterno solo para envíos no-Email y que no sean ya alternos | Service | Service |  |
| `INT-BR-01` | PROC-064 | §5 Reglas de negocio | No se inventan APIs, credenciales, costos ni límites: integraciones sin proveedor quedan “Por validar” y la prueba no envía credenciales | Service | Service |  |
| `INT-BR-02` |  | §5 Reglas de negocio | No pasar a Producción una integración `por_validar`/`futuro`; WhatsApp (`sandbox`) requiere plantillas aprobadas | Service | Service |  |
| `INT-BR-03` |  | §5 Reglas de negocio | Credenciales solo en bóveda; nunca se muestran; rotación cada 90 días | Infra | Infraestructura |  |
| `INT-BR-04` |  | §5 Reglas de negocio | Transitorios (timeout, 5xx, 429) se reintentan con backoff exponencial `base × 2^intento` (UI: 1, 2, 4, 8, 16 min ± 20 % jitter), máx. 5; luego fallo definitivo + alerta + auditoría | Job middleware | Middleware · Job/Listener |  |
| `INT-BR-05` |  | §5 Reglas de negocio | Permanentes (4xx de validación, destinatario inválido) pasan directo a fallo definitivo; reintentar no cambia el resultado | Service | Service |  |
| `INT-BR-06` |  | §5 Reglas de negocio | Resolver manualmente un error exige descripción de la resolución | FormRequest | FormRequest |  |
| `JOB-BR-01` |  | §5 Reglas de negocio | “Ejecutar ahora” encola una ejecución sin alterar la programación; ejecución idempotente (`ShouldBeUnique`) | Job | Job/Listener |  |
| `JOB-BR-02` |  | §5 Reglas de negocio | Pausar deja `next_run_at` vacío; reanudar recalcula | Service | Service |  |
| `JOB-BR-03` |  | §5 Reglas de negocio | Solo se eliminan los envíos programados de reportes (los archivos generados se conservan) | Policy | Policy |  |
| `AUD-BR-01` | PROC-063 | §5 Reglas de negocio | Bitácora append-only: ningún rol edita ni borra eventos; los accesos a la bitácora también se auditan | DB (REVOKE + trigger) | BD |  |
| `AUD-BR-02` |  | §5 Reglas de negocio | Super Admin solo ve eventos de plataforma: entidades Tenant, Sesión, Job, Integración, Plan, Rol, Permiso, Exportación, o acciones `*denegad*` | Policy / scope de consulta | Policy |  |
| `AUD-BR-03` |  | §5 Reglas de negocio | Exportar bitácora requiere `admin.audit.view` y se procesa como job PROC-061 | Policy | Policy |  |
| `REP-BR-01` | PROC-060 | §5 Reglas de negocio | Pestañas por rol (§7.3); si se solicita una no permitida: “El reporte solicitado no está disponible para su rol” | Policy por endpoint | Policy |  |
| `REP-BR-02` |  | §5 Reglas de negocio | Ventas: todos los reportes filtrados a su cartera (`owner = me`), series mensuales recalculadas con sus registros | Scope en query | Policy |  |
| `REP-BR-03` |  | §5 Reglas de negocio | Sin `finance.profitability` el reporte de finanzas omite costos, márgenes y utilidad (variante contable) | Resource condicional | Resource |  |
| `REP-BR-04` |  | §5 Reglas de negocio | Columna/gráfico de CxP solo con `finance.payables` | Resource condicional | Resource |  |
| `REP-BR-05` |  | §5 Reglas de negocio | Exportar y programar requieren `reports.export`; sin él los botones se muestran deshabilitados con “Requiere permiso reports.export” | Policy | Policy |  |
| `REP-BR-06` |  | §5 Reglas de negocio | Reservas canceladas no suman ventas; cifras en PEN al TC vigente del documento | Read model | Query/Read model |  |
| `EXP-BR-01` | PROC-061 | §5 Reglas de negocio | Flujo Solicitud → Permiso → Job → Procesar → Archivo → Disponible; sin permiso → 403, se audita `exportar_denegado` | Service + Job | Service · Job/Listener |  |
| `EXP-BR-02` |  | §5 Reglas de negocio | Archivo disponible 7 días vía URL firmada; cada descarga se audita (`descargar`) | Controller | Controller |  |
| `EXP-BR-03` |  | §5 Reglas de negocio | Programar envío: destinatarios obligatorios, cada correo válido; frecuencia diario/lunes/viernes/mensual día 1 y hora | FormRequest | FormRequest |  |
| `DSH-BR-01` |  | §5 Reglas de negocio | Cotización fuera de política = descuento > 5 % o margen < 15 % de la versión vigente, en estados borrador/enviada/vista/negociación y sin aprobación interna | Query (usar `policies.max_discount_pct`, ver §11) | Query/Read model |  |
| `DSH-BR-02` | PROC-021 | §5 Reglas de negocio | Aprobación interna exige `quotes.approve_internal` y justificación; queda auditada y notifica al vendedor; habilita el envío al cliente | Policy + Service (módulo Ventas) | Policy · Service |  |

### 10 · Aprobaciones e inbox (`10-aprobaciones-inbox.md`) — 26 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `APR-BR-01` |  | §5 Reglas de negocio | Toda solicitud se enruta por `collab_approval_rules`: niveles aplicables = reglas activas del tipo con `min_amount_pen ≤ amount_base`; por nivel se usa la de mayor umbral. | `ApprovalRouter` (Service) | Service |  |
| `APR-BR-02` |  | §5 Reglas de negocio | El nivel 1 de un tipo de origen usa el permiso del módulo (`quotes.approve_internal`, `reservations.cancel`, `finance.payments.revert`, `finance.payables`, `finance.commissions`, `catalog.providers.manage`) y no es editable. | FormRequest `UpdateApprovalRuleRequest` + constraint `is_origin_locked` | FormRequest · Service · BD |  |
| `APR-BR-03` |  | §5 Reglas de negocio | Segregación de funciones: el solicitante no aprueba su propia solicitud (configurable por regla, por defecto prohibido) y un usuario no aprueba dos niveles. | Policy `ApprovalRequestPolicy@decide` + `UNIQUE (request_id, decided_by)` | Policy · BD |  |
| `APR-BR-04` |  | §5 Reglas de negocio | Aprobador elegible = usuario activo con `approvals.view` + permiso del nivel; si hay delegación, solo el delegado. | Policy | Policy |  |
| `APR-BR-05` |  | §5 Reglas de negocio | Cotización con descuento > 10 % (tope) solo se aprueba con `quotes.discount_override` (se puede rechazar sin él). | Service + Policy | Policy · Service |  |
| `APR-BR-06` |  | §5 Reglas de negocio | Disparador de cotización: versión vigente en estado abierto con descuento > 5 % o margen < 15 % y sin `internalApproval`; si está en borrador solo con solicitud del asesor; si ya fue enviada sin aprobación se crea «detectada por regla». | Listener `QuoteVersionSaved` | Job/Listener |  |
| `APR-BR-07` |  | §5 Reglas de negocio | Rechazo con motivo obligatorio. | FormRequest + CHECK DB | FormRequest · BD |  |
| `APR-BR-08` |  | §5 Reglas de negocio | El efecto en origen y el cierre de la solicitud ocurren en la misma transacción con `lock_version` del registro de origen; si el origen cambió de estado (p. ej. reserva ya completada, pago no aplicado) → 409 y la solicitud no cambia. | `ApprovalDecisionService` (DB::transaction + `If-Match`) | Service · BD |  |
| `APR-BR-09` |  | §5 Reglas de negocio | Reversión solo sobre pagos `confirmado`/`aplicado` (PROC-043). Anulación bloqueada si la reserva está `cancelada`/`completada`. | Service | Service |  |
| `APR-BR-10` |  | §5 Reglas de negocio | Pedir información pausa el SLA; al responder, `due_at` se extiende por el tiempo en pausa. | Service | Service |  |
| `APR-BR-11` |  | §5 Reglas de negocio | Una sola solicitud viva por `dedupe_key`. | Índice único parcial | BD |  |
| `APR-BR-12` |  | §5 Reglas de negocio | Si la solicitud se resuelve en el módulo de origen (p. ej. gerente aprueba desde la cotización), la bandeja la cierra como `closed_in_origin`. | Listener de eventos de origen | Job/Listener |  |
| `APR-BR-13` |  | §5 Reglas de negocio | Tarifa de proveedor: vigencia con ≥ 30 días de anticipación (validado en extranet); si la fecha ya pasó al aprobar, se aplica de inmediato. | FormRequest extranet + Service | FormRequest · Service |  |
| `APR-BR-14` |  | §5 Reglas de negocio | Umbrales en moneda base con TC de la solicitud (Regla 15). | Columna generada `amount_base` | BD |  |
| `APR-BR-15` |  | §5 Reglas de negocio | Cada tipo conserva al menos una regla activa de nivel 1; el permiso de una regla debe tener al menos un usuario activo. | Service de reglas | Service |  |
| `INB-BR-01` |  | §5 Reglas de negocio | SLA de 1.ª respuesta por canal: web chat 15 min, WhatsApp 30 min, formulario 2 h, email 4 h, portal 4 h (configurable en `collab_channel_accounts`). | Scheduler + Service | Service · Job/Listener |  |
| `INB-BR-02` |  | §5 Reglas de negocio | WhatsApp: fuera de 24 h desde el último mensaje del cliente solo se envían plantillas aprobadas por Meta. | `WhatsAppAdapter` + FormRequest `SendMessageRequest` | FormRequest · Service |  |
| `INB-BR-03` |  | §5 Reglas de negocio | Responder una conversación sin responsable la asigna al agente que responde. | Service | Service |  |
| `INB-BR-04` |  | §5 Reglas de negocio | Ventas: ve y actúa sobre conversaciones asignadas a él o sin asignar; solo puede tomarlas (no reasignar a otro). Operaciones: asignadas + pasajeros en viaje (reserva `en_operacion` o hoy dentro de las fechas del viaje). Manager/Admin: todas. | Policy `ConversationPolicy` + scope de consulta | Policy |  |
| `INB-BR-05` |  | §5 Reglas de negocio | Crear lead aplica PROC-004 (detección de duplicados por email/teléfono contra leads y clientes) y guarda el origen (`conversation_id`). | `CreateLeadFromConversation` | Service |  |
| `INB-BR-06` |  | §5 Reglas de negocio | Vincular a cliente solo a clientes dentro del alcance (Ventas: su cartera). | Policy | Policy |  |
| `INB-BR-07` |  | §5 Reglas de negocio | Crear actividad requiere vínculo a lead o cliente. | FormRequest | FormRequest |  |
| `INB-BR-08` |  | §5 Reglas de negocio | Mensajes entrantes idempotentes por `external_message_id`; un fallo del proveedor no bloquea la conversación (Regla 21). | Webhook controller + job | Job/Listener |  |
| `INB-BR-09` |  | §5 Reglas de negocio | Tickets de portal se reflejan como conversación de canal `portal`; responder/resolver actualiza el ticket (`en_proceso`/`resuelta`) y su log. | Listener `SupportTicketCreated` + Service | Service · Job/Listener |  |
| `INB-BR-10` |  | §5 Reglas de negocio | Notas internas nunca se envían ni se exponen en portales/API públicas. | Resource + Policy | Policy · Resource |  |
| `INB-BR-11` |  | §5 Reglas de negocio | Adjuntos ≤ 16 MB, tipos permitidos, escaneo antivirus antes de enviar. | FormRequest + job `ScanAttachment` | FormRequest · Job/Listener |  |

### 11 · Cupos y documentos de viaje (`11-cupos-documentos-viaje.md`) — 23 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `CUP-BR-001` |  | §5 Reglas de negocio | `valid_to >= valid_from` | FormRequest + CHECK | FormRequest · BD |  |
| `CUP-BR-002` |  | §5 Reglas de negocio | El servicio del contrato pertenece al proveedor; tipo Alojamiento/Tren/Entrada | FormRequest | FormRequest |  |
| `CUP-BR-003` |  | §5 Reglas de negocio | Sin dos contratos vigentes solapados para el mismo servicio | EXCLUDE constraint + Service | Service · BD |  |
| `CUP-BR-004` |  | §5 Reglas de negocio | Ampliación futura y dentro de la vigencia | FormRequest | FormRequest |  |
| `CUP-BR-005` |  | §5 Reglas de negocio | Solo se libera lo disponible (no lo consumido): `released_qty <= blocked_qty - used_qty` | Service + CHECK + lock Redis | Service · BD |  |
| `CUP-BR-006` |  | §5 Reglas de negocio | Confirmar un servicio que excede el disponible del cupo → sobreventa marcada y servicio queda *on request* (o 409 si el tenant configura bloqueo estricto) | Service (`AllotmentConsumer`) + Regla transversal 4 | Service |  |
| `CUP-BR-007` |  | §5 Reglas de negocio | Retener después del release expone a penalidad `disponible × tarifa neta × penalidad %`; la UI muestra el monto antes de confirmar | Service | Service |  |
| `CUP-BR-008` |  | §5 Reglas de negocio | Consume solo el servicio **confirmado/completado/en curso** de reserva no cancelada ni borrador; solicitado/pendiente = "en trámite" | Listener | Job/Listener |  |
| `CUP-BR-009` |  | §5 Reglas de negocio | Job diario: libera fechas con release ≤ hoy no retenidas; registra cargo por fechas pasadas con disponible > 0 no liberado; vence contratos | Job `ReleaseAllotments` | Job/Listener |  |
| `CUP-BR-010` |  | §5 Reglas de negocio | Cargo > 0 genera `fin_payables` al proveedor (moneda y TC conservados) | Listener `AllotmentChargeRecorded` | Job/Listener |  |
| `DOC-BR-001` |  | §5 Reglas de negocio | Extranjero: pasaporte con vencimiento ≥ fin de viaje + `passport_months` (6) | Service + validación al validar | Service |  |
| `DOC-BR-002` |  | §5 Reglas de negocio | Peruano: DNI/pasaporte vigente al fin del viaje | Service + validación al validar | Service |  |
| `DOC-BR-003` |  | §5 Reglas de negocio | Visa aplica si la nacionalidad está en `visa_nationalities` | Service (aplicabilidad) | Service |  |
| `DOC-BR-004` |  | §5 Reglas de negocio | Seguro obligatorio para extranjeros y para programas de categoría Aventura (trekking/altura) si `insurance_trekking` | Service (aplicabilidad) | Service |  |
| `DOC-BR-005` |  | §5 Reglas de negocio | Vacuna fiebre amarilla si algún producto está en Amazonía (Loreto/Madre de Dios) o su requisito la menciona | Service (aplicabilidad) | Service |  |
| `DOC-BR-006` |  | §5 Reglas de negocio | Menor (CHD/INF o < 18 al inicio): autorización; permiso notarial si no viaja con ambos padres, o acreditación de filiación; validar requiere archivo | Service | Service |  |
| `DOC-BR-007` |  | §5 Reglas de negocio | Extranjero: registro migratorio (TAM virtual) | Service | Service |  |
| `DOC-BR-008` |  | §5 Reglas de negocio | Contacto de emergencia (nombre y teléfono) obligatorio | FormRequest | FormRequest |  |
| `DOC-BR-009` |  | §5 Reglas de negocio | Atención especial: solo indicador + nota operativa; rechazo de términos clínicos (lista configurable) | FormRequest | FormRequest |  |
| `DOC-BR-010` |  | §5 Reglas de negocio | **Bloqueo operativo**: no se emiten entradas nominativas MAPI (servicio con proveedor Ministerio de Cultura o producto no-paquete que incluye la entrada) ni su voucher si algún pasajero no tiene `id_doc` = completo y, si es menor, `minor_auth` = completo | Service de emisión de vouchers (05) consulta `TravelDocsGate::assertCanIssue()` → 422 `DOC-BR-010` | Policy · Service |  |
| `DOC-BR-011` |  | §5 Reglas de negocio | Solo `operations.travel_docs` carga, valida, observa y edita | Policy | Policy |  |
| `DOC-BR-012` |  | §5 Reglas de negocio | Ventas solo consulta y solicita documentos de reservas propias (`owner_id = me`) | Policy + filtro servidor | Policy |  |
| `DOC-BR-013` |  | §5 Reglas de negocio | Archivos PDF/JPG/PNG ≤ 10 MB, antivirus, URL firmada 10 min | FormRequest + job | FormRequest · Job/Listener |  |

### 12 · Tesorería y reclamaciones (`12-tesoreria-reclamaciones.md`) — 28 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `TES-BR-01` |  | §5 Reglas de negocio | No se registran movimientos con fecha futura | FormRequest | FormRequest |  |
| `TES-BR-02` |  | §5 Reglas de negocio | Bancos y cajas no operan en sobregiro; un egreso o transferencia no puede dejar saldo negativo, tampoco al anular transferencias | Service (lock `Cache::lock("treasury:account:{id}")` + `SELECT … FOR UPDATE`) | Service · BD |  |
| `TES-BR-03` |  | §5 Reglas de negocio | Los movimientos sincronizados (cobros, reversiones, pagos a proveedores) no se editan ni anulan en tesorería; se corrigen en el origen (PROC-043/046) | Policy + Service | Policy · Service |  |
| `TES-BR-04` |  | §5 Reglas de negocio | Sincronización idempotente: un pago confirmado o aplicado genera un solo ingreso (`source_key`); la reversión genera un egreso; cada payout de CxP, un egreso. Crédito B2B no genera movimiento | Listener + UNIQUE `source_key` | Job/Listener · BD |  |
| `TES-BR-05` |  | §5 Reglas de negocio | No se registran gastos ni ingresos de caja con la caja sin aperturar ese día | Service | Service |  |
| `TES-BR-06` |  | §5 Reglas de negocio | No se apertura una caja si la sesión anterior sigue abierta | Service + índice parcial | Service · BD |  |
| `TES-BR-07` |  | §5 Reglas de negocio | El conteo de apertura debe igualar el saldo del último cierre; si difiere, primero se hace un arqueo | Service | Service |  |
| `TES-BR-08` |  | §5 Reglas de negocio | Alerta cuando el saldo de una caja baja del umbral (%) del fondo fijo | Listener `PettyCashBelowThreshold` | Job/Listener |  |
| `TES-BR-09` |  | §5 Reglas de negocio | Los cobros en efectivo se depositan en el banco dentro de N horas (alerta) | Job `treasury:cash-deposit-alerts` | Job/Listener |  |
| `TES-BR-10` |  | §5 Reglas de negocio | Un gasto incluido en una reposición no se anula | Service | Service |  |
| `TES-BR-11` |  | §5 Reglas de negocio | Tope por gasto de caja chica (S/ 500); por encima se paga por CxP | FormRequest | FormRequest |  |
| `TES-BR-12` |  | §5 Reglas de negocio | Todo gasto lleva comprobante: serie y número (salvo planilla de movilidad o declaración jurada), RUC de 11 dígitos en factura y RxH, y declaración jurada hasta S/ 150 | FormRequest + UNIQUE comprobante | FormRequest · BD |  |
| `TES-BR-13` |  | §5 Reglas de negocio | Una diferencia de arqueo mayor a la tolerancia requiere aprobación de gerencia; toda diferencia requiere justificación | Service | Service |  |
| `TES-BR-14` |  | §5 Reglas de negocio | Segregación de funciones: quien firma un arqueo o solicita una reposición no la aprueba | Policy + CHECK | Policy · BD |  |
| `TES-BR-15` |  | §5 Reglas de negocio | Una sola reposición en curso por caja | Índice parcial | BD |  |
| `TES-BR-16` |  | §5 Reglas de negocio | Una revaluación por cuenta USD y periodo | UNIQUE | BD |  |
| `TES-BR-17` |  | §5 Reglas de negocio | Moneda y TC conservados en cada movimiento; conversiones entre monedas guardan el original (Regla transversal 15) | Service | Service |  |
| `TES-BR-18` |  | §5 Reglas de negocio | Valorización USD por costo promedio ponderado: entradas al TC de la operación y salidas al promedio. La diferencia realizada es monto × (TC operación − promedio); la no realizada es saldo × TC cierre − valor contable | Service `FxValuationService` | Service |  |
| `LR-BR-01` |  | §5 Reglas de negocio | Correlativo por sede y año, sin saltos ni reutilización | `sys_sequences` FOR UPDATE | BD |  |
| `LR-BR-02` |  | §5 Reglas de negocio | Plazo = `response_days` días hábiles contados desde el día siguiente a la recepción, excluyendo sábados, domingos y `sys_holidays`; se fija al recibir la hoja | Service `BusinessDayCalculator` | Service |  |
| `LR-BR-03` |  | §5 Reglas de negocio | Obligatorios: sede, nombre, documento (DNI de 8 dígitos), domicilio, email válido, descripción del bien, tipo (Reclamo o Queja), detalle (≥ 20 caracteres), pedido y aceptación de notificación por email | FormRequest (+ Zod en Next.js) | FormRequest · UI |  |
| `LR-BR-04` |  | §5 Reglas de negocio | Consumidor menor de edad: se exigen nombre y documento del padre, madre o apoderado | FormRequest | FormRequest |  |
| `LR-BR-05` |  | §5 Reglas de negocio | Constancia al email del consumidor al registrar (PDF por job) | Listener `ClaimBookEntryReceived` | Job/Listener |  |
| `LR-BR-06` |  | §5 Reglas de negocio | La respuesta es motivada (≥ 40 caracteres), incluye las acciones adoptadas y se envía al email consignado; queda con fecha de envío y referencia de la notificación | FormRequest + Service | FormRequest · Service |  |
| `LR-BR-07` |  | §5 Reglas de negocio | Solo se cierra una hoja respondida | Service (máquina de estados) | Service |  |
| `LR-BR-08` |  | §5 Reglas de negocio | El detalle, el pedido, los datos del consumidor y `received_at` son inmutables; sin borrado físico; conservación mínima de 2 años | Policy + SoftDeletes deshabilitado para `is_book` | Policy · BD |  |
| `LR-BR-09` |  | §5 Reglas de negocio | Un consumidor externo solo ve sus hojas (`client_id` propio o su email) | Policy + scope | Policy |  |
| `LR-BR-10` |  | §5 Reglas de negocio | Cambiar el plazo solo afecta a las hojas nuevas | Service | Service |  |

### 13 · Plataforma SaaS y API (`13-plataforma-saas-api.md`) — 25 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `SUB-BR-01` |  | §5 Reglas de negocio | Upgrade (rank mayor o ciclo mensual→anual): inmediato. Se cobra `precio_nuevo × días_restantes/días_periodo − crédito del plan actual`. Pasar a anual inicia un nuevo periodo de 12 meses y cobra el precio anual menos el crédito. Un neto negativo va a `credit_balance`. | `ChangePlanService` + `ProrationCalculator` (unit tests) | Service |  |
| `SUB-BR-02` |  | §5 Reglas de negocio | Downgrade (rank menor o anual→mensual): programado al cierre del periodo. Sin reembolso. Un solo cambio programado. | `ChangePlanService`, índice único parcial | Service · BD |  |
| `SUB-BR-03` |  | §5 Reglas de negocio | Un downgrade se bloquea si el consumo actual supera un límite del plan destino (usuarios, sedes, almacenamiento, API keys, webhooks) o si hay módulos en uso que el destino no incluye (e-commerce con pedidos, CMS publicado, apps con guías/conductores, multi-sede, OAuth, integraciones). 422 `SUB_DOWNGRADE_BLOCKED` con la lista. Se revalida al aplicarlo en la renovación; si falla, no se aplica y se notifica. | `DowngradeValidator` (Service) + job `billing:renewals` | FormRequest · Service · Job/Listener |  |
| `SUB-BR-04` |  | §5 Reglas de negocio | Límites `hard` al 100 %: users/sedes impiden crear más (422 `PLAN_LIMIT_REACHED`). WhatsApp/email se encolan diferidos. API responde 429 `QUOTA_EXCEEDED`. Reservas: aviso sin bloqueo (límite `soft`). | Policies de alta + `NotificationThrottler` + middleware `api.quota` | Policy · Middleware · Service |  |
| `SUB-BR-05` |  | §5 Reglas de negocio | Avisos de consumo al 80 % y 100 % por métrica, una vez por mes (`usage_monthly.alert_*_sent_at`). | Job `usage:consolidate` | Job/Listener |  |
| `SUB-BR-06` |  | §5 Reglas de negocio | No se puede reducir un paquete add-on por debajo de lo ya consumido en el periodo. Un add-on retirado sigue vigente hasta fin de periodo. | `AddonService` | Service |  |
| `SUB-BR-07` |  | §5 Reglas de negocio | Cupón: activo, vigente, con canjes disponibles, aplicable al plan y no acumulable. Canje con `lockForUpdate` sobre `coupons`. | `RedeemCouponRequest` + `CouponService` | FormRequest · Service |  |
| `SUB-BR-08` |  | §5 Reglas de negocio | Descuento porcentual máximo del 50 %. | CHECK + FormRequest | FormRequest · BD |  |
| `SUB-BR-09` |  | §5 Reglas de negocio | RUC válido (11 dígitos: 10/15/17/20). Los datos de facturación se copian (snapshot) al emitir. Las emitidas no cambian. | FormRequest + `bill_to jsonb` | FormRequest |  |
| `SUB-BR-10` |  | §5 Reglas de negocio | Extensión de trial máxima de 14 días acumulados. | CHECK + Service | Service · BD |  |
| `SUB-BR-11` |  | §5 Reglas de negocio | Cancelación con encuesta obligatoria (motivo) y aceptación de las condiciones de cierre. Efectiva al fin de periodo. | `CancelSubscriptionRequest` | FormRequest |  |
| `SUB-BR-12` |  | §5 Reglas de negocio | Cobros y pagos idempotentes (`Idempotency-Key` → `payment_attempts.idempotency_key`). Un doble clic no genera doble cargo. | Middleware idempotencia + UNIQUE | Middleware · BD |  |
| `PLN-BR-01` |  | §5 Reglas de negocio | El precio de los planes respeta el orden de rank. El anual no supera 12 mensualidades. | `UpdatePlanRequest` | FormRequest |  |
| `PLN-BR-02` |  | §5 Reglas de negocio | Cambio de precio: aplica a nuevas suscripciones de inmediato y a las existentes desde la renovación, con aviso de 30 días (grandfathering: `subscriptions.price_locked_until`). | `PlanPriceChangeService` + notificación | Service |  |
| `PLN-BR-04` |  | §5 Reglas de negocio | (v2.2) Matriz regla × plan: el plan mínimo de una regla lo cambia solo el Super Admin; se informa y audita el número de tenants afectados; los tenants que pierden la regla conservan su configuración (enabled/params) y el motor deja de aplicarla (`RULE_NOT_IN_PLAN`); aviso por email a los afectados. | `PlanRuleService` + Policy | Policy · Service |  |
| `PLN-BR-03` |  | §5 Reglas de negocio | Un override por tenant dura como máximo 180 días. Un override vencido deja de regir sin job (se evalúa `valid_until`). | CHECK + `EntitlementService` | Service · BD |  |
| `ENT-BR-01` |  | §5 Reglas de negocio | Resolución de entitlement: override vigente > add-on activo disponible en el plan > `plan_features`. El frontend nunca es autoridad. | `EntitlementService` | Service |  |
| `API-BR-01` |  | §5 Reglas de negocio | La API key autentica al **tenant** (no a un usuario). Scope requerido por ruta. IP allowlist opcional. Key vencida o revocada → 401. | Guard `api-key` + middleware `scope:x` | Policy · Middleware |  |
| `API-BR-02` |  | §5 Reglas de negocio | Máximo de API keys activas según el plan. | `CreateApiKeyRequest` | FormRequest · Service |  |
| `API-BR-03` |  | §5 Reglas de negocio | El token (`qts_{env}_` + 32 caracteres base62) se muestra una sola vez. Se guarda como SHA-256. | `ApiKeyService` | Service |  |
| `API-BR-04` |  | §5 Reglas de negocio | Máximo de webhooks según el plan. Entitlement `webhooks`. | FormRequest | FormRequest |  |
| `API-BR-05` |  | §5 Reglas de negocio | La URL del webhook debe ser HTTPS. | FormRequest + CHECK | FormRequest · BD |  |
| `API-BR-06` |  | §5 Reglas de negocio | Anti-SSRF: se resuelve el DNS y se rechazan loopback, RFC1918, link-local, `.local`/`.internal`. Se revalida en cada envío (DNS rebinding). Sin seguir redirecciones. | `SafeUrlValidator` + cliente HTTP del job | FormRequest · Job/Listener |  |
| `API-BR-07` |  | §5 Reglas de negocio | Webhook deshabilitado tras 10 fallos consecutivos. | `DeliverWebhookJob` | Job/Listener |  |
| `API-BR-08` |  | §5 Reglas de negocio | Rotación del secreto: el anterior se acepta 24 h (se envían ambas firmas `v1`). | `WebhookService` | Service |  |

### 14 · Marketing y metas (`14-marketing-metas.md`) — 28 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `MKT-BR-01` |  | §5 Reglas de negocio | Solo se envía a contactos con consentimiento **vigente para el canal** a la fecha del envío (finalidad publicitaria = finalidad adicional, consentimiento previo, expreso e inequívoco — Ley 29733) | Service `AudienceResolver` + job (re-evaluación en cada lote) | Service · Job/Listener |  |
| `MKT-BR-02` |  | §5 Reglas de negocio | La baja se aplica de inmediato y prevalece sobre cualquier regla o segmento; plantillas comerciales de email deben contener `{{enlace_baja}}` y las de WhatsApp indicar «Responde BAJA»; se envía confirmación de baja al titular | FormRequest plantilla/campaña + Service + webhook de respuesta WA | FormRequest · Service |  |
| `MKT-BR-03` |  | §5 Reglas de negocio | WhatsApp solo con plantilla aprobada por Meta; el texto no se edita en la campaña; editar una aprobada la devuelve a revisión; no se permite envío de prueba de una no aprobada | Policy + Service | Policy · Service |  |
| `MKT-BR-04` |  | §5 Reglas de negocio | Envío de prueba obligatorio (a usuario interno activo) antes de programar o enviar; editar el contenido invalida las pruebas | Service `CampaignStateMachine` | Service |  |
| `MKT-BR-05` |  | §5 Reglas de negocio | Programación ≥ 15 min en el futuro; WhatsApp comercial solo entre 08:00 y 20:00 hora del tenant (Ley 29571 art. 58 — prácticas no agresivas) | FormRequest `ScheduleCampaignRequest` | FormRequest |  |
| `MKT-BR-06` |  | §5 Reglas de negocio | Supresión por falta de dato: email vacío; WhatsApp requiere móvil (9 dígitos iniciando en 9 en Perú o número internacional E.164). Fijos corporativos se suprimen | Service | Service |  |
| `MKT-BR-07` |  | §5 Reglas de negocio | No se programa ni envía una campaña con 0 destinatarios elegibles | Service (422 `MKT-BR-07`) | Service |  |
| `MKT-BR-08` |  | §5 Reglas de negocio | Solo se editan campañas en borrador; programada → desprogramar; enviada/cancelada inmutables | Policy + máquina de estados (409) | Policy |  |
| `MKT-BR-09` |  | §5 Reglas de negocio | Código promocional único en el tenant (4–20 alfanuméricos, mayúsculas), activo y vigente al enviar | FormRequest + UNIQUE `catalog_promotions(tenant_id, code)` | FormRequest · BD |  |
| `MKT-BR-10` |  | §5 Reglas de negocio | Atribución last-touch 30 días: reserva (no borrador/cancelada) de un destinatario creada en (sent_at, sent_at+30 d], siempre que la campaña sea la última enviada a ese contacto antes de la reserva y que la reserva **no provenga de una cotización creada antes del envío**; leads nuevos cuyo email coincide con un destinatario; usos del código en pedidos web en la ventana. Ingreso = total × TC de la reserva (regla 15) | Job `RecomputeAttribution` (read model) | Job/Listener · Query/Read model |  |
| `MKT-BR-11` |  | §5 Reglas de negocio | Un consentimiento exige origen (catálogo), evidencia y versión de política; no se admiten casillas pre-marcadas; los registros no se eliminan | FormRequest + trigger append-only | FormRequest · BD |  |
| `MKT-BR-12` |  | §5 Reglas de negocio | Un segmento usado por alguna campaña no se elimina (evidencia de audiencia); se puede duplicar | Policy (409) | Policy |  |
| `MKT-BR-13` |  | §5 Reglas de negocio | Reglas de segmento permitidas: tipo de contacto (eq), segmento (eq/neq), país (eq/neq), destino de interés (contains), última compra (en ≤ N días / > N días o nunca / sin compras), gasto total S/ (≥/≤), NPS (≥/≤/sin encuesta), canal de origen (eq), etiqueta (has), consentimiento (otorgado / sin consentimiento para canal); coincidencia TODAS/ALGUNA; nombre único | FormRequest (esquema Zod espejo) | FormRequest |  |
| `MKT-BR-14` |  | §5 Reglas de negocio | Fatiga: máximo 1 campaña por contacto cada 72 h (se suprime con motivo `fatigue`) | Service | Service |  |
| `MKT-BR-15` |  | §5 Reglas de negocio | Contactos = clientes + leads abiertos (nuevo/contactado/calificado) no duplicados por email con clientes + suscriptores no vinculados; deduplicación por email | Read model `mkt_contacts_v` (vista) | Query/Read model |  |
| `MKT-BR-16` |  | §5 Reglas de negocio | Automatizaciones comerciales (bienvenida, carrito, cumpleaños, reactivación) requieren consentimiento; las de servicio (pre-viaje, encuesta) se basan en la ejecución del contrato (Ley 29733 art. 14) pero respetan la baja | Job `RunAutomations` | Job/Listener |  |
| `MKT-BR-17` |  | §5 Reglas de negocio | Idempotencia de automatizaciones: un mismo disparador (contacto + referencia) se procesa una sola vez | UNIQUE `mkt_automation_enrollments` | BD |  |
| `MKT-BR-18` |  | §5 Reglas de negocio | Envíos de prueba solo a usuarios internos del tenant; no cuentan en métricas | Service | Service |  |
| `MET-BR-01` |  | §5 Reglas de negocio | Una meta por alcance (asesor/sede/equipo) y período, salvo anuladas | Índice único parcial + FormRequest (409) | FormRequest · BD |  |
| `MET-BR-02` |  | §5 Reglas de negocio | Meta de ventas obligatoria > 0; reservas, margen y conversión opcionales; conversión 0–100 % | FormRequest | FormRequest |  |
| `MET-BR-03` |  | §5 Reglas de negocio | No se crean metas para períodos terminados | FormRequest | FormRequest |  |
| `MET-BR-04` |  | §5 Reglas de negocio | Todo ajuste exige motivo y registra antes/después | FormRequest + tabla de ajustes + auditoría | FormRequest |  |
| `MET-BR-05` |  | §5 Reglas de negocio | Con más del 50 % del período transcurrido, **reducir** cualquier indicador de una meta vigente requiere Tenant Admin (anti-manipulación del bono); aumentar está permitido a Manager | Policy `SalesTargetPolicy::decrease` | Policy |  |
| `MET-BR-06` |  | §5 Reglas de negocio | Cierre solo después del fin del período; congela el resultado (cambios posteriores en reservas no lo alteran) | Service + `result` jsonb | Service |  |
| `MET-BR-07` |  | §5 Reglas de negocio | Ventas ve solo sus metas (no borradores). En el ranking ve posición, nombre y % de cumplimiento de los demás, **sin montos ni bonos** ajenos | Policy + Resource que omite montos para rol sales | Policy · Resource |  |
| `MET-BR-08` |  | §5 Reglas de negocio | Avance real: ventas = Σ total (PEN, TC de la reserva) de reservas no borrador/canceladas **creadas** en el período del asesor (owner), de la sede (`branch_id`) o de los integrantes del equipo; margen = venta − costo de servicios no cancelados; reservas = conteo; conversión = ganadas / (ganadas + perdidas) de oportunidades con fecha de cierre en el período | Read model `crm_target_progress` | Query/Read model |  |
| `MET-BR-09` |  | §5 Reglas de negocio | Proyección al cierre = real + pipeline ponderado (Σ monto × probabilidad de oportunidades abiertas con cierre entre hoy y fin del período); margen proyectado con el ratio de margen real (22 % si no hay ventas). Se muestra además el ritmo lineal real/días × total | Read model | Query/Read model |  |
| `MET-BR-10` |  | §5 Reglas de negocio | Bono (solo asesor): tramos de la política sobre el % de ventas: ≥ 90 % → 50 %, ≥ 100 % → 100 %, ≥ 120 % → 130 % del bono base. Al cerrar, si hay monto > 0, se crea UNA comisión «Bono por meta» `calculada` (Finanzas aprueba y paga — PROC-047) | Service + UNIQUE `fin_commissions(sales_target_id)` | Service · BD |  |

### 15 · Sitio web público (`15-sitio-web-publico.md`) — 28 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `SIT-BR-01` |  | §5 Reglas de negocio | Catálogo público = `status='ACTIVE'` ∧ publicado en canal e-commerce ∧ ≥ 1 tarifa vigente (ECO-BR-02). Ficha de producto no publicado → “Este producto no está disponible para la venta en línea (PRD-BR-002)” con CTA a cotizar. | Query `PublicCatalogService` | Service · Query/Read model |  |
| `SIT-BR-02` |  | §5 Reglas de negocio | **Precio por fecha** = tarifa vigente en esa fecha (canal `E-commerce` si existe, si no `Directo`; segmento Adulto/Pasajero; niño: `Niño` o adulto) × `factor(temporada de la fecha) / factor(temporada base de la tarifa)`, redondeo 0.10. Temporada = `Pricing.seasonFor`: activa que contiene la fecha con menor `priority` (fechas especiales priority 0 ganan). Sin tarifa vigente en la fecha → día no vendible (“Tarifa por publicar”). | `PricingService` (RT-5) | Service |  |
| `SIT-BR-03` |  | §5 Reglas de negocio | “Desde” = mínimo precio adulto sobre los días vendibles (salidas con cupo o próximos 150 días). Precio tachado cuando la tarifa Directo > tarifa web en la misma fecha. | `PricingService` (read model cacheado) | Service · Query/Read model |  |
| `SIT-BR-04` |  | §5 Reglas de negocio | Día vendible: `advance_min ≤ días hasta la fecha ≤ advance_max`; con salidas: existe salida no cancelada ese día y `disponibles ≥ adultos + niños` (disponibles = capacidad − vendidos − holds vivos); sin salidas: servicio diario “confirmación en 24 h”. Infantes (< 2) no ocupan cupo ni pagan. | `AvailabilityService` (RT-4, PRD-BR-012) | Policy · Service |  |
| `SIT-BR-05` |  | §5 Reglas de negocio | Pasajeros por línea: adultos ≥ 1; `min_pax ≤ adultos + niños ≤ max_pax`; infantes ≤ adultos; niños solo si `min_age < 12`; infantes solo si `min_age = 0`; aviso si `min_age ≥ 2` y hay niños. | FormRequest + panel | FormRequest |  |
| `SIT-BR-06` |  | §5 Reglas de negocio | **Hold al añadir al carrito**: productos con salida bloquean `adultos + niños` durante `settings.hold_minutes` (30). Temporizador visible en carrito y checkout; al vencer → `expirada`, toast y opción “Volver a bloquear”. Un hold por línea; quitar línea libera. | `CartService` + job | Service · Job/Listener |  |
| `SIT-BR-07` |  | §5 Reglas de negocio | Revalidación antes de cobrar: si el hold no está vivo, se reintenta bloquear; si no hay cupos → 409 “La salida del … ya no tiene cupos. Actualice su carrito.” | `CheckoutService` | Service |  |
| `SIT-BR-08` |  | §5 Reglas de negocio | Código promocional a nivel de carrito: se aplica a cada línea cuyo producto tenga esa promo activa (canal E-commerce/Todos, vigente hoy). Descuento por cantidad automático (≥ 4 pax por línea). No acumulables: gana el mayor por línea. Código que no aplica a ninguna línea → “El código no aplica a los productos de su carrito o no está vigente” (no bloquea, se ignora). Los extras no se descuentan. | `PricingService` | Service |  |
| `SIT-BR-09` |  | §5 Reglas de negocio | **Anticipo**: solo si la primera fecha del carrito está a ≥ 15 días: 30 % si ≥ 30 días, 40 % entre 15 y 29 días; si < 15 días → solo pago total (“No disponible: su viaje inicia en menos de 15 días”). Saldo vence 15 días antes del inicio (o hoy si ya pasó). Modalidad inmutable una vez creado el pedido. | `CheckoutService` | Service |  |
| `SIT-BR-10` |  | §5 Reglas de negocio | Extras: seguro de asistencia US$ 6 por pasajero (incl. infantes) por día de duración (proveedor PRV-014, póliza inmediata al confirmar el pago); traslado privado aeropuerto → hotel (precio del producto PRD-005 por vehículo de hasta `max_pax`) solo para productos de Cusco que no sean paquetes; no se ofrecen en el propio traslado. Se crean como servicios separados de la reserva. | `PricingService` / `CheckoutService` | Service |  |
| `SIT-BR-11` |  | §5 Reglas de negocio | Productos `TRASLADO`: precio por vehículo = tarifa × ⌈pax totales / `max_pax`⌉. | `PricingService` | Service |  |
| `SIT-BR-12` |  | §5 Reglas de negocio | Multimoneda: cada línea se calcula en la moneda de su tarifa; el carrito y el pedido se expresan en la moneda elegida (PEN/USD) con `settings.fx` del día; el TC se guarda en pedido y reserva (RT-15). Yape/Plin cobra en PEN (conversión mostrada). | `PricingService` | Service |  |
| `SIT-BR-13` |  | §5 Reglas de negocio | Comprador: nombres y apellidos (≥ 2 palabras), email válido, celular ≥ 7 dígitos, documento válido: DNI 8 dígitos; CE 9–12 alfanum.; pasaporte 6–15 alfanum. Factura: RUC 11 dígitos que inicia en 10/15/17/20, razón social y dirección fiscal obligatorias (RT-10). | FormRequest | FormRequest |  |
| `SIT-BR-14` |  | §5 Reglas de negocio | Pasajeros = grupo más grande del carrito (máximo de adultos, niños e infantes entre líneas). Cada uno: nombres, apellidos, nacimiento, documento válido y único en el pedido, nacionalidad. Edad a la primera fecha: ADT ≥ 12, CHD 2–11, INF < 2; además ≥ `min_age` del producto. | FormRequest | FormRequest |  |
| `SIT-BR-15` |  | §5 Reglas de negocio | Consentimientos obligatorios para pagar: términos, políticas de cancelación de cada producto (se listan), tratamiento de datos incl. transferencia a proveedores. Marketing opcional (crea/reactiva suscriptor + consentimiento email). Se guarda fecha/hora y `policy_version` (PDP-2026.1). | FormRequest + `ConsentService` | FormRequest · Service |  |
| `SIT-BR-16` |  | §5 Reglas de negocio | Tarjeta: sandbox aprobadas 4111 1111 1111 1111, 5555 5555 5555 4444, 3782 822463 10005, 3622 720627 1667; rechazada 4000 0000 0000 0002 (código 51); otras → código 14. Nunca PAN/CVV en el backend (tokenización de la pasarela, ECO-BR-16). Rechazo no libera cupos ni anula la obligación; se puede reintentar. | Adapter de pagos | Service |  |
| `SIT-BR-17` |  | §5 Reglas de negocio | Transferencia/Yape: exige nº/código de operación; el pago queda `pendiente` (“por validar”), los cupos se consumen y la reserva queda `pendiente_pago`; Finanzas valida en ≤ 4 h hábiles (conciliación). Vouchers recién al aplicarse. | `CheckoutService` + Finanzas | Service |  |
| `SIT-BR-18` |  | §5 Reglas de negocio | Vouchers solo para servicios `confirmado` y cuando todas las CxC del pedido están pagadas (pago total o saldo completado) (RT-11). El seguro genera su voucher/certificado. | `VoucherService` | Service |  |
| `SIT-BR-19` |  | §5 Reglas de negocio | Página de confirmación y “gestionar mi reserva”: acceso con token del pedido (cookie del navegador que compró), sesión del cliente dueño, o correo + código RES/WEB exactos. Nunca expone costos, márgenes ni datos de otros clientes. Consultas fallidas se auditan y tienen rate limit (5/min/IP). | Policy pública | Policy |  |
| `SIT-BR-20` |  | §5 Reglas de negocio | Mi cuenta: solo usuarios con `client_id` (customer/passenger/B2B con cliente). Pagar saldo = monto de la CxC − pagado − pagos pendientes de validación; si hay un pago por validar que cubre la CxC, no se muestra “Pagar”. | Policy + Service | Policy · Service |  |
| `SIT-BR-21` |  | §5 Reglas de negocio | Registro: email único en `iam_users`; si existe `crm_clients` con ese email se vincula (no se duplica), si no se crea (Persona, Retail, tags Web). Contraseña ≥ 8 (producción: política del tenant, hash Argon2id, verificación de email). Login fallido auditado; rate limit 5/min. Al iniciar sesión se fusiona la lista de deseos local y el carrito se vincula al cliente. | `AuthController` público | Controller |  |
| `SIT-BR-22` |  | §5 Reglas de negocio | **Lead web** (viajes a medida / contacto “cotizar”): ≥ 1 destino, fecha futura (≥ 2 días) salvo “Aún no defino fechas”, regreso ≥ inicio, ≥ 1 adulto, nombre, email, teléfono, consentimiento. Se crea `nuevo` **sin asignar** (fuente Web) o `duplicado` si hay lead abierto con el mismo email; `score` inicial = 40 + fecha 12 + pax≥4 10 + teléfono 6 + presupuesto ≥ US$ 2 000 12 + producto 8 (máx. 95); `sla_due_at` = +24 h hábiles. Notifica a gerencia (cola) y acuse al cliente. | FormRequest + `LeadIntakeService` | FormRequest · Service |  |
| `SIT-BR-23` |  | §5 Reglas de negocio | Contacto: nombre, email, mensaje ≥ 10, consentimiento → conversación canal `Formulario` (inbox) vinculada a cliente si el email existe; motivo “Quiero cotizar un viaje” también crea lead. | Service | Service |  |
| `SIT-BR-24` |  | §5 Reglas de negocio | Chat web: nombre, email o WhatsApp, consulta, consentimiento → conversación `Web chat` sin asignar; respuesta automática inmediata (no cuenta como primera respuesta del SLA); el widget muestra mensajes del contacto, del asesor y del sistema, **nunca** notas internas ni eventos. | Service + Reverb | Service |  |
| `SIT-BR-25` |  | §5 Reglas de negocio | Newsletter: email válido + consentimiento explícito (casilla no premarcada). Existente activo → “ya está suscrito”; en baja → reactiva. Doble opt-in por email. | `ConsentService` (14) | Service |  |
| `SIT-BR-26` |  | §5 Reglas de negocio | Libro de Reclamaciones público: consumidor (o menor + apoderado), documento válido, email, teléfono, domicilio, establecimiento (sede), bien contratado, tipo Reclamo/Queja, detalle ≥ 15, pedido, declaración. Correlativo por sede `LR-{LIM\|CUS\|AQP}-AAAA-000001`, plazo 15 días hábiles con feriados (`crm_claim_book_settings`), constancia por email. Mismo servicio que el portal y el registro presencial (12). | `ClaimBookService` | Service |  |
| `SIT-BR-27` |  | §5 Reglas de negocio | Reseñas: en el prototipo son **de ejemplo** y se rotulan; en producción solo reseñas verificadas (pasajero con reserva completada que respondió la encuesta post-viaje), moderadas; el rating mostrado es el read model. | Job + moderación | Job/Listener |  |
| `SIT-BR-28` |  | §5 Reglas de negocio | Idioma y moneda: preferencia en cookie; contenidos traducidos cuando existan (fallback a ES con aviso); precios siempre convertidos con el TC del día y leyenda del TC en el pie. | Middleware Next.js | Middleware · UI |  |

### 16 · Motor de reservas y centro de reglas (`16-motor-de-reservas-y-reglas.md`) — 22 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `CAT-AV-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Dos rangos del mismo tipo (disponible/disponible o no-disponible/no-disponible) no pueden solaparse; un rango cerrado/agotado **sí** puede superponerse a uno disponible y prevalece como excepción | FormRequest + `AvailabilityRangeService` + exclusion constraints | FormRequest · Policy · Service · BD |  |
| `CAT-AV-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Rango disponible: capacidad entera 1–500; cerrado/agotado: capacidad 0 | FormRequest + CHECK | FormRequest · BD |  |
| `CAT-AV-03` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | La capacidad por día de un rango disponible no puede quedar por debajo de lo vendido en cualquiera de sus fechas futuras | Service (query a `booking_reservation_services`) | Service |  |
| `CAT-AV-04` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Cerrar fechas con ventas se permite con confirmación explícita; las reservas no se anulan y se notifica a Operaciones | Service + evento `AvailabilityClosedWithSales` | Policy · Service · Job/Listener |  |
| `CAT-AV-05` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Un rango no puede terminar en el pasado ni durar más de 730 días | FormRequest + CHECK | FormRequest · BD |  |
| `CAT-AV-06` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Al menos un día de operación; anticipación entera 0–8760 h | FormRequest | FormRequest |  |
| `CAT-AV-07` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Una salida programada en la fecha prevalece sobre la capacidad del rango | `BookingEngine::dayStatus` | Service |  |
| `CAT-PX-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | `infante_hasta < niño_desde ≤ niño_hasta < adulto_desde`; edades sin banda (brecha) generan advertencia porque `ageType` devuelve `NA` y el checkout las rechaza | FormRequest (error) + respuesta con `warnings` | FormRequest |  |
| `CAT-PX-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | % niño 0–100; máx. niños/adulto ≤ 10, infantes/adulto ≤ 5, mín. adultos ≤ 10 | FormRequest | FormRequest |  |
| `CAT-PX-03` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Si existe tarifa `Niño` vigente para el canal, el motor la usa; el % es respaldo | `BookingEngine::quote` | Service |  |
| `CAT-AD-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Nombre único por producto; precio ≥ 0; aplica a ≥ 1 tipo de pasajero; moneda activa | FormRequest | FormRequest |  |
| `CAT-AD-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Si se vincula servicio y proveedor, el servicio debe pertenecer al proveedor; si solo servicio, se hereda su proveedor | Service | Service |  |
| `CAT-AD-03` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Eliminar un adicional no altera reservas (snapshot) | Soft delete | BD |  |
| `CAT-LG-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Tramos con 1–30 noches; hoteles con ≥ 1 tipo de habitación; capacidad 1–8; precio > 0; hotel único por tramo | FormRequest | FormRequest |  |
| `CAT-LG-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Advertencia si Σ noches ≠ duración (días − 1, o noches) | Resource (`warnings`) | Resource |  |
| `CAT-LG-03` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Las camas elegidas por tramo deben alojar adultos + niños (infantes comparten) cuando `R-LODGING-CAPACITY` está activa | `BookingEngine::quote` (warning bloqueante en checkout) | Service | `R-LODGING-CAPACITY` |
| `CAT-PY-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Al menos una modalidad con cobro (`total` o `adelanto`); % adelanto 1–99; días de saldo 0–180 | FormRequest | FormRequest |  |
| `CAT-PY-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Si el saldo vence antes de hoy, se cobra de inmediato (warning) | `BookingEngine::quote` | Service |  |
| `CAT-PK-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Recojo obligatorio ⇒ al menos un punto; puntos únicos | FormRequest | FormRequest |  |
| `CAT-RL-01` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Solo reglas con `product_override=true` admiten override | Policy + FormRequest | FormRequest · Policy |  |
| `CAT-RL-02` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Un producto no puede activar una regla apagada en el tenant | `BookingEngine::on` | Service |  |
| `CAT-RL-03` |  | §5 Reglas de negocio › §5.2 Reglas del módulo | Parámetros del override: mismos tipos/rangos que `params_schema`; % ≤ 100; valores iguales al tenant no se guardan | FormRequest | FormRequest |  |

### 17 · Reglas, comunicaciones, monedas, reseñas e integración web (`17-reglas-comunicaciones-monedas-resenas-integracion-web.md`) — 18 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `CR-01` |  | §5 Reglas de negocio | Validación de parámetros | FormRequest `UpdateBookingRuleRequest` | FormRequest |  |
| `CR-02` |  | §5 Reglas de negocio | Excepción por producto | Service + trigger | Service · BD |  |
| `CR-03` |  | §5 Reglas de negocio | Plantillas de negocio | Service | Service |  |
| `CR-04` |  | §5 Reglas de negocio | Reglas personalizadas | Policy | Policy |  |
| `MSG-01` |  | §5 Reglas de negocio | Plantilla válida | FormRequest | FormRequest |  |
| `MSG-02` |  | §5 Reglas de negocio | Programación | Job + índice único parcial | Job/Listener · BD |  |
| `MSG-03` |  | §5 Reglas de negocio | Envío manual | Policy | Policy |  |
| `FX-01` |  | §5 Reglas de negocio | Tipo de cambio | FormRequest + Service | FormRequest · Service |  |
| `FX-02` |  | §5 Reglas de negocio | Monedas | FormRequest + CHECK | FormRequest · BD |  |
| `FX-04` |  | §5 Reglas de negocio | Proveedor y alerta (v2.2) | Service + Job | Service · Job/Listener |  |
| `PLN-R-01` |  | §5 Reglas de negocio | Regla por plan (v2.2) | Policy + Service | Policy · Service |  |
| `FX-03` |  | §5 Reglas de negocio | TC al cliente | Service | Service |  |
| `RV-01` |  | §5 Reglas de negocio | Cumplimiento | Policy + revisión legal | Policy |  |
| `RV-02` |  | §5 Reglas de negocio | Respuesta | FormRequest | FormRequest |  |
| `RV-03` |  | §5 Reglas de negocio | Credenciales | Service | Service |  |
| `WG-01` |  | §5 Reglas de negocio | Dominios | Middleware | Middleware |  |
| `WG-02` |  | §5 Reglas de negocio | Clave pública | Middleware + rate limit | Middleware |  |
| `WG-03` |  | §5 Reglas de negocio | Precio | Service | Service |  |

### 18 · Reseñas propias (`18-resenas-propias.md`) — 11 reglas

| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |
|---|---|---|---|---|---|---|
| `RVW-01` |  | §5 Reglas de negocio | Todo el módulo exige `effective(R-OWN-REVIEWS)` = regla activa ∧ plan ≥ Professional ∧ no desactivada en el producto. Si no: sin formulario, sin bloque en el sitio, sin JSON-LD, sin invitaciones; los datos se conservan | Policy + Service (`BE.on`) | Policy · Service | `R-OWN-REVIEWS` |
| `RVW-02` |  | §5 Reglas de negocio | Verificación: solo reseñan pasajeros de una reserva `completada`, o de una `en_operacion` por los servicios con estado `completado` o fecha pasada (demo: Thomas Keller, RES-2026-000347, hasta el 02/10). Reservas `cancelada`/`borrador` no | Service | Service |  |
| `RVW-03` |  | §5 Reglas de negocio | Una reseña por pasajero, reserva y producto | constraint DB + FormRequest | FormRequest · BD |  |
| `RVW-04` |  | §5 Reglas de negocio | Estrellas 1–5 obligatorias; subcalificaciones opcionales y solo las activas; título ≥ 3; texto 20–2000 | FormRequest | FormRequest |  |
| `RVW-05` |  | §5 Reglas de negocio | Publicación exige consentimiento explícito (casilla sin marcar por defecto); sin consentimiento → `oculta` | Service + CHECK | Service · BD |  |
| `RVW-06` |  | §5 Reglas de negocio | Palabras prohibidas y datos personales (correo, teléfono, pasaporte/DNI) retienen la reseña con motivo; si `personal_data = enmascarar` se reemplazan por «[dato oculto]» antes de evaluar | Service | Service |  |
| `RVW-07` |  | §5 Reglas de negocio | Sin «review gating»: la nota nunca es motivo de rechazo; rechazar/ocultar exige motivo | Policy + UI | Policy · UI |  |
| `RVW-08` |  | §5 Reglas de negocio | La respuesta pública no puede contener datos personales; se notifica al pasajero y se deja en sus mensajes del portal | FormRequest + Listener | FormRequest · Job/Listener |  |
| `RVW-09` |  | §5 Reglas de negocio | Invitación `daysAfter` días después de `travel_to` a las 09:00, recordatorio y vencimiento configurables; a todos los elegibles, sin incentivos | Job | Job/Listener |  |
| `RVW-10` |  | §5 Reglas de negocio | Sitio/widget muestran solo `publicada`, con sello «Viaje verificado» y rótulo «ejemplo (demo)» si `is_demo`; `show_on_site/show_on_widget` apagan cada salida | Query + cache | Query/Read model |  |
| `RVW-11` |  | §5 Reglas de negocio | Ventas: solo reseñas de reservas propias o clientes de su cartera; no modera ni responde | Policy (`owner=me`) | Policy |  |

## 5. Supuestos y notas

- La columna *Capa* es una normalización automática del texto «Dónde se valida»; ante duda manda el texto literal.
- Reglas con el mismo ID en dos especificaciones (p. ej. `RT-4 / PRD-BR-012` en Reservas y en Canales) se listan en ambas porque cada spec agrega su mensaje o su punto de validación.
- El plan mínimo sale de `bookingRules[].minPlan`; si `plans.json` incluye la regla en un plan inferior se indica entre paréntesis.
- Los parámetros mostrados son los valores de la semilla demo; los rangos válidos los fija `params_schema` (17 §3.1, CR-01).
