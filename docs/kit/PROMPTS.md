# Prompts por fase

Textos listos para pegar en Claude Code. Suponen el espacio de trabajo armado según `00-LEEME-KIT.md` §2 (con `CLAUDE.md` y `.claude/` copiados). Los comandos con `/` son los de `.claude/commands/`.

Regla general: **una historia por sesión** (`/clear` entre historias). Si una sesión se alarga, pedir un resumen del estado y empezar una nueva con él.

---

## Fase 0 · Fundaciones (49 historias)

**Arranque (una vez):**

```text
Vamos a empezar la Fase 0 de KipuControl. Lee docs/kit/backlog/fase-0.md completo,
docs/CONVENCIONES.md, docs/02-ARQUITECTURA.md y docs/kit/infra/README.md.
No escribas código todavía. Dime:
1) qué historias forman la ruta crítica de la fase y en qué orden,
2) qué supuestos de la fase necesitas que confirme antes de empezar,
3) qué paquetes de Composer y npm vas a instalar y para qué.
```

**Base del backend (F0-01 a F0-0x):**

```text
/implementar-historia F0-01
Usa exactamente docs/kit/infra/docker-compose.yml, el Makefile y los .env de docs/kit/infra/env.
Las tres conexiones de base (pgsql, pgsql_platform, pgsql_owner) según docs/kit/infra/README.md.
```

**Tenancy y RLS (la historia más delicada del proyecto):**

```text
/implementar-historia F0-06
Antes de programar, lee docs/kit/database/00_extensions_and_functions.sql y 90_rls.sql.
Quiero pruebas que demuestren: sin app.tenant_id no se ve ninguna fila; con el tenant A no se ve
nada del B aunque se consulte por id; un job en cola restablece su tenant; kipucontrol_app no tiene BYPASSRLS.
```

**Cierre:** `/cerrar-fase 0` y luego, en otra sesión, el subagente `revisor-seguridad` sobre todo `app/Domain/{Shared,Iam,Platform}`.

---

## Fase 1A · MVP comercial (62 historias)

```text
Empezamos la Fase 1A (CRM, catálogo, motor de reservas básico, cotizaciones).
Lee docs/kit/backlog/fase-1a.md y las specs 01, 02, 03 y 16 (§3 a §6).
Revisa que la Fase 0 esté cerrada (/cerrar-fase 0 si no hay informe) y luego
/siguiente-historia 1a
```

Puntos de atención que conviene repetir en los prompts de esta fase:

- **Motor de reservas** (`BookingEngine`): «Es la única fuente de precio y disponibilidad. Reproduce los casos de `docs/kit/tests/pest/Datasets/prd011.php` y los esperados de PRD-011 (total S/ 19 324,98, adelanto 5 797,49, saldo 13 527,49). Cualquier diferencia de un céntimo es un error.»
- **Disponibilidad por rangos** (02–06 disponible, 07–09 cerrado, 10–14 disponible): «Usa el ejemplo de PRD-011 en `docs/kit/seeds/` y la prueba `motor-disponibilidad-rangos.spec.ts`.»
- **Reglas de pasajeros** (niños 4–10 pagan, infantes < 3 gratis, límite por adulto): «Cada regla consulta el centro de reglas; con la regla apagada no tiene efecto.»

**Cierre:** `/cerrar-fase 1a`.

---

## Fase 1B · MVP operativo (83 historias)

```text
Empezamos la Fase 1B (reservas, operaciones sin apps, finanzas básicas, portal del cliente,
reportes básicos y Libro de Reclamaciones). Lee docs/kit/backlog/fase-1b.md y las specs 04, 05, 07, 08, 09 y 12.
/siguiente-historia 1b
```

- **Conversión cotización → reserva** (`F1B-RES-02`): «Idempotente con `Idempotency-Key`, bloqueo de cupos con `SELECT … FOR UPDATE`, y la prueba de concurrencia F1B-RES-03 antes de dar por cerrada la épica.»
- **Finanzas**: «Dinero con `brick/money`, nunca float; cada pago guarda moneda y `fx_rate`. Sin OSE ni conciliación en esta fase.»
- **Libro de Reclamaciones**: «Requisitos legales de la spec 12: numeración correlativa, plazos y constancia al consumidor.»

**Cierre:** `/cerrar-fase 1b`. Con esto el MVP queda listo para uso interno.

---

## Fase 2 · Canales y campo (127 historias)

Conviene trabajarla en tres frentes, cada uno en su propia sesión y rama:

```text
Frente móvil: lee docs/kit/backlog/fase-2.md (épica E2.1) y mobile/CLAUDE.md.
/siguiente-historia 2   ← filtra las de la épica E2.1
```

```text
Frente sitio público, checkout y CMS: épicas del sitio, widget, pagos, monedas y mensajes al pasajero.
Specs 15, 16 y 17. Todo el precio viene de BookingEngine::quote; la previsualización permite quitar
ítems solo si la regla R-PREVIEW-REMOVE está activa.
```

```text
Frente back-office: facturación electrónica (adaptador Fake de FiscalGateway), conciliación,
aprobaciones e inbox, cupos, documentos de viaje y tesorería. Specs 07, 10, 11 y 12.
```

- **Integraciones** (OSE, pasarela, WhatsApp, TripAdvisor/Trustpilot, tipo de cambio): «Solo interfaz + adaptador Fake con respuestas realistas. No inventes URLs ni credenciales de proveedores; deja el adaptador real como historia aparte cuando haya contrato con el proveedor.»
- **Offline de la app del operador**: «Outbox con `Idempotency-Key`, estados pending/syncing/synced/failed/conflict; el servidor gana en conflicto. Prueba `e2e-07-offline-sync.spec.ts`.»

**Cierre:** `/cerrar-fase 2` y subir `KIPUCONTROL_PHASE` a 2 en el CI.

---

## Fase 3 · SaaS y crecimiento (57 historias)

```text
Empezamos la Fase 3 (suscripciones, planes × reglas, facturación de plataforma, API keys y webhooks,
marketing y metas, reseñas propias y externas, reportes avanzados). Lee docs/kit/backlog/fase-3.md
y las specs 13, 14, 17 y 18. Todo lo de plataforma usa la conexión pgsql_platform.
/siguiente-historia 3
```

- **Planes × reglas**: «Una regla con `minPlan` superior al plan del tenant no tiene efecto aunque esté encendida; la pantalla lo muestra como "Disponible en plan X".»
- **Reseñas propias**: «Solo pasajeros con servicio finalizado pueden calificar, una vez por servicio; moderación antes de publicar.»

**Cierre:** `/cerrar-fase 3`.

---

## Prompts de uso diario

| Necesidad | Prompt |
|---|---|
| Entender una pantalla antes de programarla | `Usa el subagente explorador-prototipo con la ruta #/reservas/RES-2026-0001` |
| Revisar antes de commit | `/revisar-seguridad` |
| Verificar una historia | `Usa el subagente verificador-historia con F1B-RES-02` |
| Error en producción o en pruebas | `/corregir-error <pega el log>` |
| Endpoint puntual | `/nuevo-endpoint POST /api/v1/quotes/{quote}/convert` |
| Tabla puntual | `/nueva-migracion booking_reservations` |
| Contrato vs código | `/verificar-contrato 1` |
| Documentar una diferencia | `/actualizar-docs F1B-RES-02` |
