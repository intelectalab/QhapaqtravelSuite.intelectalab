#!/bin/bash
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/comun.sh"

FORZAR=false
[ "${1:-}" = "--forzar" ] && FORZAR=true

exigir_root
cargar_secretos
cd "$APP_DIR"

FOTO="$(mktemp)"
trap 'rm -f "$FOTO"' EXIT
foto_otros_sitios >"$FOTO"

paso "Lo nuevo en GitHub"
ANTES="$(como_app git -C "$APP_DIR" rev-parse HEAD)"
como_app git -C "$APP_DIR" fetch --quiet origin main
DESPUES="$(como_app git -C "$APP_DIR" rev-parse origin/main)"
if [ "$ANTES" = "$DESPUES" ] && [ "$FORZAR" = false ]; then
  listo "El servidor ya tiene lo último de GitHub ($(como_app git -C "$APP_DIR" log -1 --format='%h %s'))."
  echo "   Si igual quieres recompilar y reiniciar: bash $APP_DIR/deploy/actualizar.sh --forzar"
  exit 0
fi
como_app git -C "$APP_DIR" log --format='   %h  %ad  %s' --date=format:'%d/%m %H:%M' "$ANTES..$DESPUES" || true
CAMBIADOS="$(como_app git -C "$APP_DIR" diff --name-only "$ANTES" "$DESPUES")"
cambio() { [ "$FORZAR" = true ] || grep -qE "$1" <<<"$CAMBIADOS"; }

paso "Copia de seguridad de la base"
mkdir -p "$RESPALDOS"
COPIA="$RESPALDOS/kipucontrol-$(date +%Y%m%d-%H%M).sql.gz"
dc exec -T postgres pg_dump -U kipucontrol_owner -d kipucontrol --no-owner </dev/null | gzip >"$COPIA"
[ -s "$COPIA" ] || falla "La copia de seguridad salió vacía. No actualicé nada."
chmod 600 "$COPIA"
ls -1t "$RESPALDOS"/kipucontrol-*.sql.gz | tail -n +11 | xargs -r rm -f
listo "$COPIA ($(du -h "$COPIA" | cut -f1)); se guardan las 10 últimas."

paso "Descarga del código"
como_app git -C "$APP_DIR" merge --ff-only --quiet origin/main || falla "El servidor tiene cambios propios que no están en GitHub. No los toqué; revisa con: sudo -u $APP_USER git -C $APP_DIR status"
listo "Ahora en $(como_app git -C "$APP_DIR" log -1 --format='%h %s')"

if cambio '^docker/php/'; then
  paso "Imagen de PHP"
  dc build api
fi

paso "API"
if cambio '^backend/composer\.(json|lock)$'; then
  dc run --rm --no-deps --user "$APP_UID:$APP_GID" -e COMPOSER_HOME=/tmp/composer api composer install --no-dev --optimize-autoloader --no-interaction </dev/null
fi
dc up -d --wait api
artisan migrate --database=pgsql_owner --force
artisan db:seed --class=HelpArticleSeeder --database=pgsql_owner --force
artisan tenant:sequences
artisan tenant:jobs
artisan optimize:clear
dc up -d nginx
dc restart api
artisan horizon:terminate || true
dc up -d queue scheduler reverb
dc restart queue scheduler reverb
listo "API, cola, procesos programados y tiempo real al día"

if cambio '^web/'; then
  paso "Web"
  INSTALAR="true"
  cambio '^web/package(-lock)?\.json$' && INSTALAR="npm ci --include=dev --no-audit --no-fund"
  dc run --rm --no-deps -e NODE_ENV=development -e HOME=/tmp -e NEXT_DIST_DIR=.next-nueva web sh -c "$INSTALAR && NODE_ENV=production npm run build" </dev/null \
    || falla "La web no compiló. La versión anterior sigue funcionando; la base ya está migrada (copia en $COPIA)."
  rm -rf "$APP_DIR/web/.next-anterior"
  [ -d "$APP_DIR/web/.next" ] && mv "$APP_DIR/web/.next" "$APP_DIR/web/.next-anterior"
  mv "$APP_DIR/web/.next-nueva" "$APP_DIR/web/.next"
  dc up -d web
  dc restart web
  listo "Web recompilada"
fi

if cambio '^(docker-compose\.prod\.yml|docker/)'; then
  paso "Contenedores con la configuración nueva"
  dc up -d --remove-orphans
fi

paso "KipuControl responde"
for intento in $(seq 1 20); do
  codigo="$(codigo_http "$DOMINIO")"
  [[ "$codigo" =~ ^(2|3) ]] && break
  sleep 3
done
[[ "$codigo" =~ ^(2|3) ]] && listo "https://$DOMINIO responde ($codigo)" || aviso "https://$DOMINIO responde $codigo. Mira: bash $APP_DIR/deploy/estado.sh"

revisar_otros_sitios "$FOTO"
paso "Listo"
