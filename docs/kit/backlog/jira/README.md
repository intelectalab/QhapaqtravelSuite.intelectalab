# Importar el backlog a Jira

Archivos generados desde `../backlog-completo.csv` con `build_jira_csv.py` (incluido en esta carpeta, `docs/kit/backlog/jira/`). Contienen **60 épicas y 447 historias**, con sus vínculos de dependencia. No traen estimaciones, responsables ni sprints, porque la planificación la define el equipo con el proyectista.

| Archivo | Para |
|---|---|
| `kipucontrol-jira-cloud.csv` | **Jira Cloud.** Es un solo archivo: las épicas van primero y las historias se enlazan a su épica con la columna `Parent`. |
| `kipucontrol-jira-datacenter-1-epicas.csv` y `kipucontrol-jira-datacenter-2-historias.csv` | **Jira Data Center o Server.** Primero se importan las épicas y después las historias. Las historias se enlazan con `Epic Link`, que lleva el nombre de la épica. |

## Qué trae cada issue

- **Summary:** el ID de la historia y su título, por ejemplo `F1B-RES-02 · Conversión idempotente cotización → reserva`. Las épicas llevan `E1B.2 · Reservas y conversión idempotente`.
- **Description** (en formato wiki de Jira):
  - la historia, la especificación, las tablas, los endpoints y las pantallas;
  - los criterios de aceptación numerados, las pruebas y las dependencias;
  - la definición de terminado;
  - el comando de Claude Code para implementarla.
- **Priority:** P0 → Highest, P1 → High y P2 → Medium.
- **Fix Version:** la fase, por ejemplo `Fase 1A · MVP comercial`. El importador puede crear las versiones si no existen.
- **Labels:** `kipucontrol`, la fase (`fase-1a`), el módulo (`crm`, `res`, `mot`…; en Fase 0, la épica) y la prioridad (`p0`).
- **Bloqueado por:** el `Issue Id` de cada historia de la que depende. Al mapearlo se crean 883 vínculos de bloqueo.
- **Historia (ID kit):** el ID del kit. Es opcional mapearlo a un campo personalizado, porque el ID ya va en el Summary.

## Pasos (Jira Cloud, proyecto company-managed)

1. Cree el proyecto (por ejemplo, clave `KIPU`) con los tipos de issue Épica e Historia.
2. Vaya a **⚙ Configuración › Sistema › Importación de sistemas externos › CSV**. Se necesita permiso de administrador de Jira.
3. Suba `kipucontrol-jira-cloud.csv`. Codificación **UTF-8** y delimitador **coma**.
4. Elija el proyecto destino y mapee los campos:

| Columna del CSV | Campo de Jira |
|---|---|
| Issue Id | Issue Id |
| Parent | Parent |
| Issue Type | Issue Type (mapear `Epic` → Épica y `Story` → Historia si el sitio está en español) |
| Summary | Summary |
| Epic Name | Epic Name (si existe en su sitio; si no, ignorar) |
| Description | Description |
| Priority | Priority |
| Fix Version | Fix Version/s |
| Labels (las 4 columnas) | Labels |
| Bloqueado por (las 12 columnas) | Vínculo de tipo **Blocks**, en el sentido «is blocked by» |
| Historia (ID kit) | Un campo de texto personalizado, o no importar |

5. Antes de importar todo, **pruebe con un archivo de 10–20 filas** (las épicas y algunas historias de la Fase 0). Así confirma el mapeo de tipos y el sentido del vínculo de bloqueo. Si el vínculo sale al revés («blocks» en lugar de «is blocked by»), cambie el sentido en el mapeo.
6. Guarde la configuración del asistente al final; sirve para las siguientes importaciones.

En proyectos **team-managed**, el importador de CSV tiene menos opciones de mapeo. Se recomienda un proyecto company-managed. Si usa uno team-managed, importe y luego revise que las historias hayan quedado bajo su épica.

Si el campo `Parent` no aparece en el mapeo, revise la configuración de subtareas en **Configuración › Sistema › Issues › Subtareas**. El primer artículo de Atlassian enlazado al final explica este caso.

## Pasos (Jira Data Center o Server)

1. **Sistema › Importación de sistemas externos › CSV**.
2. Importe primero `kipucontrol-jira-datacenter-1-epicas.csv`. Mapee `Epic Name` y, si quiere conservar el ID, `Issue Id`.
3. Importe después `kipucontrol-jira-datacenter-2-historias.csv`. Mapee `Epic Link`, que trae el nombre exacto de la épica, y `Bloqueado por` al vínculo «Blocks» (is blocked by).

## Regenerar

v2.5: el generador escapa `{ } [ ] * ^ ~ +` para que las rutas como `/quotes/{id}/convert` y los criterios con llaves se vean completos en Jira, convierte el código Markdown a `{{monoespacio}}` y separa los criterios solo por « | N) ». Para comprobar que los CSV versionados están al día: `python3 docs/kit/backlog/jira/build_jira_csv.py --check`.

Si cambia el backlog (`../fase-*.csv` y `../backlog-completo.csv`):

```bash
python3 docs/kit/backlog/jira/build_jira_csv.py
```

Referencias de Atlassian:
- [Mantener la relación padre-hijo al importar CSV en Jira Cloud](https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/)
- [Importar issues con jerarquía desde CSV (Data Center)](https://support.atlassian.com/jira/kb/how-to-import-issues-with-hierarchy-from-a-csv-into-jira-software/)
