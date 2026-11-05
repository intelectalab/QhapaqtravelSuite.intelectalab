---
description: Revisa los cambios pendientes contra las reglas de tenancy, permisos y datos sensibles
---
Revisa el diff actual (`git diff` y `git diff --staged`) y reporta en español, por archivo y línea, cualquier incumplimiento de:

- **Tenancy:** modelo de negocio sin `BelongsToTenant`; `tenant_id` tomado del request; consultas con `withoutGlobalScopes` sin justificación; jobs que no restablecen el tenant; tabla nueva sin política RLS.
- **Permisos:** endpoint sin Policy o con un permiso distinto al `x-permission` del contrato; ownership de Ventas no forzado; usuario externo que puede leer recursos no vinculados.
- **Datos sensibles:** costos, márgenes o utilidad expuestos en un Resource sin el permiso correspondiente; datos personales en logs.
- **Dinero:** uso de `float`; montos sin `currency` o sin `fx_rate` conservado.
- **Idempotencia y concurrencia:** endpoint marcado idempotente sin middleware; consumo de cupos sin bloqueo; cambios sin `lock_version`.
- **Estados:** `update(['status' => …])` fuera de la máquina de estados.
- **Frontend/app:** cálculos de precio, disponibilidad o permisos en el cliente.
- **Hallazgos:** cualquier comportamiento H-01…H-21 de `docs/04-HALLAZGOS-Y-DECISIONES.md`.
- **Secretos:** credenciales, tokens o URLs reales de proveedores.

Para cada problema: severidad (alta, media, baja), evidencia y corrección propuesta. Si no hay problemas, dilo en una línea. No modifiques archivos.
