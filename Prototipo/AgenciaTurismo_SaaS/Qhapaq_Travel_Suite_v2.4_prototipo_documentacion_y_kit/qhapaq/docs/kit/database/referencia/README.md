# Referencia de base de datos · Qhapaq Travel Suite

Material de consulta generado **desde el catálogo de PostgreSQL** después de ejecutar `00`→`90`. No reemplaza a los `.sql` de `kit-ia/database/`: ellos son la fuente de verdad y todo lo de esta carpeta se regenera a partir de ellos. No edite a mano los archivos generados.

## Contenido

| Archivo | Qué contiene |
|---|---|
| `DICCIONARIO-DE-DATOS.md` | Índice general: cifras del catálogo, tablas por dominio (prefijo real de la tabla) y por fase (archivo SQL de origen), columnas agregadas por fases posteriores y la lista de columnas de estado con sus valores. |
| `diccionario/<dominio>.md` | Un archivo por dominio (`plataforma`, `iam`, `sys`, `notif`, `integration`, `catalog`, `crm`, `quote`, `booking`, `ops`, `supplier`, `fin`, `channel`, `cms`, `collab`, `mkt`, `report`). Por tabla: comentario (`COMMENT ON TABLE`), fase, modo RLS y políticas, particionado, columnas (tipo, nulo, default, descripción), PK, FKs con `ON DELETE`, UNIQUE (restricciones e índices únicos, incluidos los parciales con su `WHERE`), CHECK (con la lista de valores cuando es un dominio cerrado), EXCLUDE, índices y triggers. |
| `diccionario.csv` | Una fila por columna: `tabla, columna, tipo, nulo, default, descripcion, fk, dominio, fase`. `fase` es el archivo SQL donde se creó la columna (las columnas agregadas con `ALTER TABLE … ADD COLUMN` llevan el archivo de la fase que las agrega). |
| `er/<dominio>.mmd` · `er/<dominio>.svg` | Diagrama entidad-relación por dominio (Mermaid `erDiagram`). Muestra PK, FK, UK y columnas clave (`code`, `name`, `status`, `currency`, montos, fechas de servicio…); como máximo 14 atributos por tabla, priorizando PK y FK. Las tablas de otros dominios aparecen solo con su `id`. |
| `er/00-general.mmd` · `.svg` | Vista de alto nivel entre dominios: número de FKs entre cada par de dominios. Las FKs hacia `iam_` (usuarios, sedes) y `sys_` se resumen en la etiqueta del nodo para no saturar. |
| `er/index.html` | Visor autocontenido de todos los SVG (sin dependencias externas). |
| `build_reference.py` | Generador. Levanta un cluster temporal, carga el esquema, lee `pg_catalog` y escribe todo lo anterior. Al final **verifica** que tablas, columnas y FKs de la salida coinciden con el catálogo. |
| `pgcatalog.py` | Módulo compartido: cluster temporal y consulta del catálogo a JSON. También lo usa `kit-ia/referencia/tools/build_state_machines.py`. |
| `render_mermaid.cjs` | Render de Mermaid a SVG con Chromium headless (Playwright) y `mermaid.min.js` local. |

### Cómo leer el diccionario

- **Modo RLS.** `tenant` = política `tenant_isolation` con `ENABLE` + `FORCE ROW LEVEL SECURITY`. `shared` = además `tenant_shared_read` (el tenant lee las filas globales con `tenant_id IS NULL`, solo escribe las suyas). `plataforma` = tablas de `01_platform.sql` sin RLS de tenant; se acceden con `platform_role` (`tenants` usa `tenant_self`). `sin RLS` = tablas de negocio sin políticas (`personal_access_tokens`, `role_has_permissions`).
- **Descripción de columna.** Usa el `COMMENT ON COLUMN` cuando existe (columnas agregadas por fases posteriores). Si no hay comentario, se indica la convención de `database/README.md §3` para `tenant_id`, `created_*`, `updated_*`, `deleted_at` y `lock_version`, más PK, FK destino y valores del CHECK. Las demás columnas no tienen comentario en el esquema: su significado está en la sección 3 de la especificación indicada en el comentario de la tabla (`[Spec NN §x]`).
- **ER.** Se omiten las FK `tenant_id → tenants.id` (todas las tablas de negocio la tienen) salvo en el diagrama de Plataforma. Cardinalidad: `||--o{` FK obligatoria, `|o--o{` FK opcional, `--o|` cuando la FK está cubierta por un UNIQUE (relación 1 a 1).

## Cómo regenerar

Requisitos: Python 3.10+, binarios de PostgreSQL 16/17 con contrib (`initdb`, `pg_ctl`, `psql`), Node 18+ con `playwright` y `mermaid@10` (para los SVG).

```bash
# desde la raíz del proyecto
python3 kit-ia/database/referencia/build_reference.py                 # todo (≈ 15 s)
python3 kit-ia/database/referencia/build_reference.py --no-svg        # sin Node: solo Markdown, CSV y .mmd
PGBIN=/usr/lib/postgresql/17/bin python3 kit-ia/database/referencia/build_reference.py --port 55450
```

- Si se ejecuta como `root`, el cluster temporal corre como `postgres` (`runuser`), igual que `tests/validate.sh`. El cluster se crea en un directorio temporal y se elimina al terminar.
- `render_mermaid.cjs` busca Playwright y Mermaid en `node_modules/` de la raíz del proyecto; se pueden indicar con `PLAYWRIGHT_MODULE`, `MERMAID_JS` y `CHROMIUM_PATH` (`npm i -D playwright mermaid@10 && npx playwright install chromium`).
- Si se agrega un prefijo de tabla nuevo, el script se detiene y pide registrarlo en `DOMAINS` (inicio de `build_reference.py`).
- Después de regenerar el diccionario, regenere también las máquinas de estado: `python3 kit-ia/referencia/tools/build_state_machines.py`.

## Verificación incluida

El script compara la salida con el catálogo y termina con error si no coinciden:

- tablas: secciones del diccionario = tablas del catálogo (262);
- columnas: filas del CSV y columnas listadas = `pg_attribute` (4 146);
- FKs: filas de FK en el Markdown = `pg_constraint` tipo `f` (804), y FKs del ER + FKs `tenant_id` omitidas = 804.
