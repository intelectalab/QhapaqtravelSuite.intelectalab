#!/bin/bash
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/comun.sh"

exigir_root
cargar_secretos

paso "Versión publicada"
como_app git -C "$APP_DIR" log -1 --format='   %h  %ad  %s' --date=format:'%d/%m/%Y %H:%M'

paso "Contenedores"
dc ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'

paso "Respuesta"
echo "   Web: $(codigo_http "$DOMINIO")"
echo "   API: $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/v1/health" || echo 000)"

paso "Últimos errores"
for servicio in web api queue; do
  echo "   -- $servicio"
  dc logs --tail 200 --no-log-prefix "$servicio" 2>&1 | grep -iE 'error|exception|fatal' | tail -5 | sed 's/^/   /' || true
done

paso "Memoria y disco"
free -h | sed 's/^/   /'
df -h / | tail -1 | sed 's/^/   /'
docker stats --no-stream --format '   {{.Name}}  {{.MemUsage}}' | grep kipucontrol || true
