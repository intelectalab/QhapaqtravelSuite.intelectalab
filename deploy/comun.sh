#!/bin/bash
set -euo pipefail

DOMINIO="kipucontrol.intelectalab.com"
APP_DIR="/var/www/kipucontrol"
APP_USER="kipucontrol"
SECRETOS="$APP_DIR/deploy/servidor.env"
RESPALDOS="/var/backups/kipucontrol"
NGINX_SITIO="/etc/nginx/sites-available/kipucontrol.conf"
WEBROOT_CERT="/var/www/letsencrypt"
OTROS_SITIOS=(citas.intelectalab.com cursos.intelectalab.com edunova.intelectalab.com gestionproyectos.intelectalab.com epsoftware.intelectalab.com gestor.eggp.edu.pe app.licoria.pe)

paso() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;33m   %s\033[0m\n' "$*"; }
listo() { printf '\033[1;32m   %s\033[0m\n' "$*"; }
falla() { printf '\033[1;31m   %s\033[0m\n' "$*" >&2; exit 1; }

exigir_root() {
  [ "$(id -u)" -eq 0 ] || falla "Corre este script como root (en el servidor entras como root con ssh licoria)."
}

dc() {
  docker compose --project-directory "$APP_DIR" --env-file "$SECRETOS" -f "$APP_DIR/docker-compose.prod.yml" "$@"
}

como_app() {
  sudo -u "$APP_USER" -H "$@"
}

artisan() {
  dc exec -T --user "$APP_UID:$APP_GID" api php artisan "$@" </dev/null
}

cargar_secretos() {
  [ -f "$SECRETOS" ] || falla "Falta $SECRETOS. Primero corre deploy/instalar.sh."
  set -a
  . "$SECRETOS"
  set +a
}

codigo_http() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1/" || echo "000"
}

foto_otros_sitios() {
  for sitio in "${OTROS_SITIOS[@]}"; do
    echo "$sitio $(codigo_http "$sitio")"
  done
}

revisar_otros_sitios() {
  paso "Los demás sitios del servidor siguen respondiendo como antes"
  local antes="$1" cambios=0
  while read -r sitio codigo_antes; do
    local codigo
    codigo="$(codigo_http "$sitio")"
    if [ "$codigo" = "$codigo_antes" ]; then
      listo "$sitio responde igual que antes ($codigo)"
    else
      aviso "$sitio respondía $codigo_antes y ahora responde $codigo"
      cambios=$((cambios + 1))
    fi
  done <"$antes"
  [ "$cambios" -eq 0 ] || aviso "Revisa los sitios marcados antes de seguir."
}

recargar_nginx() {
  nginx -t || falla "nginx -t encontró un error. No se recargó Nginx; los demás sitios siguen como estaban."
  systemctl reload nginx
  listo "Nginx recargado"
}
