# Backlog de desarrollo — Qhapaq Travel Suite

Historias de usuario listas para implementarse con Claude Code, una por sesión, en orden de fase. Cada historia cita la especificación, las tablas (`../database/`), los endpoints (`../api/openapi.yaml`), las pantallas del prototipo, los criterios de aceptación y las pruebas. El formato está descrito en [FORMATO.md](FORMATO.md).

El backlog no incluye estimaciones de tiempo ni asignaciones: la planificación (equipo, plazos y cronograma) la definen la empresa y el proyectista. Las historias traen dependencias y prioridad para ordenar el trabajo.

## Resumen

| Fase | Archivo | Historias |
|---|---|--:|
| Fase 0 · Fundaciones | [fase-0.md](fase-0.md) · `fase-0.csv` | 49 |
| Fase 1A · MVP comercial (CRM, catálogo, motor básico, cotizaciones) | [fase-1a.md](fase-1a.md) · `fase-1a.csv` | 62 |
| Fase 1B · MVP operativo (reservas, operaciones, finanzas básicas, portal cliente, reportes, reclamaciones) | [fase-1b.md](fase-1b.md) · `fase-1b.csv` | 83 |
| Fase 2 · Canales y campo | [fase-2.md](fase-2.md) · `fase-2.csv` | 127 |
| Fase 3 · SaaS y crecimiento | [fase-3.md](fase-3.md) · `fase-3.csv` | 57 |
| **Total** | `backlog-completo.csv` | **378** |

Prioridades: P0 = sin esto la fase no cierra · P1 = parte del alcance de la fase · P2 = puede pasar a la fase siguiente sin romper nada.

## Épicas

| Fase | Épica | Historias |
|---|---|--:|
| 0 | E0.1 · Repositorios, entorno y convenciones de código | 4 |
| 0 | E0.2 · Multi-tenancy y RLS | 6 |
| 0 | E0.3 · Autenticación, sesiones y MFA | 5 |
| 0 | E0.4 · IAM: usuarios, sedes, roles y permisos | 8 |
| 0 | E0.5 · Servicios transversales del núcleo | 9 |
| 0 | E0.6 · Configuración, notificaciones y auditoría (administración) | 5 |
| 0 | E0.7 · Shell Next.js por experiencia y pantallas de administración | 9 |
| 0 | E0.8 · Datos semilla y pruebas de salida de fase | 3 |
| 1A | E1A.1 · CRM · Leads | 8 |
| 1A | E1A.2 · CRM · Oportunidades y actividades | 6 |
| 1A | E1A.3 · CRM · Clientes y Customer 360 | 4 |
| 1A | E1A.4 · CRM · Postventa, fidelización y panel de Ventas | 6 |
| 1A | E1A.5 · Catálogo · Maestros (tipos, destinos, proveedores, servicios) | 7 |
| 1A | E1A.6 · Catálogo · Producto y Product 360 | 13 |
| 1A | E1A.7 · Catálogo · Tarifas, temporadas y pricing | 4 |
| 1A | E1A.8 · Catálogo · Salidas y holds | 3 |
| 1A | E1A.9 · Motor de reservas básico (BookingEngine) | 8 |
| 1A | E1A.10 · Pruebas de salida de Fase 1-A | 3 |
| 1B | E1B.1 · Cotizaciones | 13 |
| 1B | E1B.2 · Reservas y conversión idempotente | 18 |
| 1B | E1B.3 · Operaciones (sin apps) | 16 |
| 1B | E1B.4 · Finanzas básicas (sin OSE ni conciliación) | 13 |
| 1B | E1B.5 · Portal del cliente | 7 |
| 1B | E1B.6 · Reportes básicos, exportación y paneles | 6 |
| 1B | E1B.7 · Libro de Reclamaciones | 6 |
| 1B | E1B.8 · Integración con Fase 1-A, datos semilla y pruebas de salida | 4 |
| 2 | E2.1 · Apps móviles operador y pasajero con offline | 17 |
| 2 | E2.2 · Portal del pasajero | 9 |
| 2 | E2.3 · Canal B2B con crédito | 10 |
| 2 | E2.4 · Extranet de proveedores | 11 |
| 2 | E2.5 · Sitio público, checkout, pagos y CMS | 19 |
| 2 | E2.6 · Facturación electrónica OSE, conciliación y cierre de periodo | 11 |
| 2 | E2.7 · Motor de reservas completo, centro de reglas, widget/CMS, mensajes al pasajero y monedas | 15 |
| 2 | E2.8 · Bandeja de aprobaciones | 5 |
| 2 | E2.9 · Inbox omnicanal | 7 |
| 2 | E2.10 · Cupos (allotments) y documentos de viaje | 10 |
| 2 | E2.11 · Tesorería (caja y bancos) | 10 |
| 2 | E2.12 · Cierre de fase y homologaciones | 3 |
| 3 | E3.1 · Plataforma · Planes, entitlements, matriz planes × reglas y uso | 7 |
| 3 | E3.2 · Suscripción del tenant | 6 |
| 3 | E3.3 · Facturación de plataforma y cobranza | 7 |
| 3 | E3.4 · Alta de tenant de punta a punta | 2 |
| 3 | E3.5 · API pública: API keys, webhooks y OAuth | 6 |
| 3 | E3.6 · Marketing: consentimientos, segmentos, campañas y automatizaciones | 10 |
| 3 | E3.7 · Metas comerciales | 4 |
| 3 | E3.8 · Reseñas propias verificadas | 5 |
| 3 | E3.9 · Reseñas externas | 3 |
| 3 | E3.10 · Reportes avanzados | 3 |
| 3 | E3.11 · Pruebas y salida de Fase 3 | 4 |

## Cómo se usa

1. `/siguiente-historia 1a` propone las próximas historias con dependencias cumplidas.
2. `/implementar-historia F1A-CRM-03` la implementa con pruebas primero.
3. El subagente `verificador-historia` confirma criterio por criterio; `/revisar-seguridad` antes del commit.
4. Commit con el ID: `F1A-CRM-03: conversión de lead a cliente`. El avance se mide con `git log --grep`.
5. Al terminar la fase: `/cerrar-fase 1a`.

Para importar a una herramienta de gestión (Jira, Linear, GitHub Projects, Trello), usar `backlog-completo.csv`: una fila por historia; UTF-8, separador coma; los criterios de aceptación van numerados y separados por ` | `; tablas, endpoints y dependencias separados por `, `.
