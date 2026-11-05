# CLAUDE.md — mobile (React Native · Expo)

Dos apps: **App del operador** (guías y conductores) y **App del pasajero**. Mismo backend y mismos permisos; la app nunca replica reglas de negocio (principio 12 de DOC-PROC-001).

## Fuentes de verdad
- `docs/especificaciones/05-operaciones-movil.md` (§8.4 offline, outbox, idempotencia, conflictos, push) y `08-canales-portales.md` (pasajero).
- `docs/kit/api/openapi.yaml` → cliente tipado (`npm run api:gen`).
- Prototipo: `#/mobile/operador` y `#/mobile/pasajero` (maquetas funcionales dentro de un marco de teléfono; en un teléfono real se ven a pantalla completa).
- Código de referencia: `docs/kit/ejemplos/mobile/` (outbox offline con expo-sqlite, sincronización con backoff e `Idempotency-Key`, resolución de 409).

## Comandos
`npx expo start` · `npm run lint` · `npm test` (Jest + React Native Testing Library) · `npm run api:gen` · builds con EAS.

## Reglas
- Offline-first en la app del operador: SQLite local (expo-sqlite) como caché; cada acción (confirmar asignación, iniciar, check-in por pasajero, evidencia, incidencia, finalizar) va a una **outbox** con `Idempotency-Key` y estados `pending → syncing → synced | failed | conflict`; reintentos con backoff; resolución de conflictos según la respuesta 409 del servidor (el servidor gana; mostrar al usuario qué cambió).
- Evidencias: foto comprimida en el dispositivo, subida a URL firmada (S3) y asociada por API.
- Push: Expo Notifications (FCM/APNs); deep links a la asignación o al mensaje.
- Solo datos del usuario autenticado (su recurso, su reserva). Sin montos de venta ni márgenes.
- GPS solo si existe finalidad operativa y consentimiento (decisión D-10 pendiente).
- Textos en español (y EN en la app del pasajero), accesibles, botones grandes para uso en campo.
