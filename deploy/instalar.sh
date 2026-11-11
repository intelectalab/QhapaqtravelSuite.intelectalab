#!/bin/bash
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/comun.sh"

exigir_root
id "$APP_USER" >/dev/null 2>&1 || falla "No existe el usuario $APP_USER. Sigue primero los pasos previos de deploy/LEEME.md."
[ -d "$APP_DIR/.git" ] || falla "No encuentro el repositorio en $APP_DIR. Sigue primero los pasos previos de deploy/LEEME.md."
command -v docker >/dev/null || falla "Docker no está instalado."
command -v certbot >/dev/null || falla "Certbot no está instalado."

FOTO="$(mktemp)"
trap 'rm -f "$FOTO"' EXIT

paso "Estado de los demás sitios antes de empezar"
foto_otros_sitios | tee "$FOTO"

paso "Puertos propios de KipuControl (solo dentro del servidor)"
API_PORT=8230
WEB_PORT=3230
REVERB_HOST_PORT=8231
STORAGE_PORT=9230
if [ ! -f "$SECRETOS" ]; then
  for puerto in $API_PORT $WEB_PORT $REVERB_HOST_PORT $STORAGE_PORT; do
    if ss -ltn | awk '{print $4}' | grep -qE "[:.]$puerto\$"; then
      falla "El puerto $puerto ya lo usa otro programa. No sigo para no tocarlo."
    fi
  done
fi
listo "Web 127.0.0.1:$WEB_PORT · API 127.0.0.1:$API_PORT · tiempo real 127.0.0.1:$REVERB_HOST_PORT · archivos 127.0.0.1:$STORAGE_PORT"

paso "Contraseñas del servidor"
if [ -f "$SECRETOS" ]; then
  aviso "Ya existen en $SECRETOS; se conservan."
else
  aleatorio() { openssl rand -hex "$1"; }
  umask 077
  cat >"$SECRETOS" <<EOF
APP_UID="$(id -u "$APP_USER")"
APP_GID="$(id -g "$APP_USER")"
API_PORT="$API_PORT"
WEB_PORT="$WEB_PORT"
REVERB_HOST_PORT="$REVERB_HOST_PORT"
STORAGE_PORT="$STORAGE_PORT"
DB_OWNER_PASSWORD="$(aleatorio 24)"
DB_APP_PASSWORD="$(aleatorio 24)"
DB_PLATFORM_PASSWORD="$(aleatorio 24)"
REDIS_PASSWORD="$(aleatorio 24)"
STORAGE_ACCESS_KEY="kipu$(aleatorio 8)"
STORAGE_SECRET_KEY="$(aleatorio 24)"
REVERB_APP_KEY="$(aleatorio 16)"
REVERB_APP_SECRET="$(aleatorio 24)"
DEMO_PASSWORD="Kc#$(aleatorio 10)"
DEMO_TOTP_SECRET="$(head -c 20 /dev/urandom | base32 | tr -d '=')"
EOF
  umask 022
  chmod 600 "$SECRETOS"
  listo "Generadas en $SECRETOS (solo root puede leerlas)."
fi
cargar_secretos

rellenar() {
  sed -e "s|__DOMINIO__|$DOMINIO|g" \
      -e "s|__DB_OWNER_PASSWORD__|$DB_OWNER_PASSWORD|g" \
      -e "s|__DB_APP_PASSWORD__|$DB_APP_PASSWORD|g" \
      -e "s|__DB_PLATFORM_PASSWORD__|$DB_PLATFORM_PASSWORD|g" \
      -e "s|__REDIS_PASSWORD__|$REDIS_PASSWORD|g" \
      -e "s|__STORAGE_ACCESS_KEY__|$STORAGE_ACCESS_KEY|g" \
      -e "s|__STORAGE_SECRET_KEY__|$STORAGE_SECRET_KEY|g" \
      -e "s|__REVERB_APP_KEY__|$REVERB_APP_KEY|g" \
      -e "s|__REVERB_APP_SECRET__|$REVERB_APP_SECRET|g" \
      -e "s|__DEMO_PASSWORD__|$DEMO_PASSWORD|g" \
      -e "s|__DEMO_TOTP_SECRET__|$DEMO_TOTP_SECRET|g" \
      -e "s|__API_PORT__|$API_PORT|g" \
      -e "s|__WEB_PORT__|$WEB_PORT|g" \
      -e "s|__REVERB_HOST_PORT__|$REVERB_HOST_PORT|g" \
      -e "s|__STORAGE_PORT__|$STORAGE_PORT|g" \
      "$APP_DIR/deploy/plantillas/$1"
}

paso "Configuración de la API y de la web"
for par in "backend.env:backend/.env" "web.env:web/.env.production.local"; do
  plantilla="${par%%:*}"
  destino="$APP_DIR/${par#*:}"
  if [ -f "$destino" ]; then
    aviso "${par#*:} ya existe; se conserva."
  else
    rellenar "$plantilla" >"$destino"
    chown "$APP_USER:$APP_USER" "$destino"
    chmod 640 "$destino"
    listo "Creado ${par#*:}"
  fi
done
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown root:root "$SECRETOS"
mkdir -p "$RESPALDOS"
chmod 700 "$RESPALDOS"

paso "Imagen de PHP"
dc build api

paso "Base de datos, Redis, archivos y antivirus"
dc up -d --wait postgres redis
dc up -d storage clamav
dc --profile init run --rm storage-init

paso "Dependencias de la API"
dc run --rm --no-deps --user "$APP_UID:$APP_GID" -e COMPOSER_HOME=/tmp/composer api composer install --no-dev --optimize-autoloader --no-interaction </dev/null
if ! grep -q '^APP_KEY=base64:' "$APP_DIR/backend/.env"; then
  dc run --rm --no-deps --user "$APP_UID:$APP_GID" api php artisan key:generate --force </dev/null
fi

paso "Web compilada para producción"
dc run --rm --no-deps -e NODE_ENV=development -e HOME=/tmp web sh -c "npm ci --include=dev --no-audit --no-fund && NODE_ENV=production npm run build" </dev/null

paso "Arranque de la API"
dc up -d --wait api
dc up -d nginx

paso "Esquema y datos de ejemplo"
artisan migrate --database=pgsql_owner --force
artisan db:seed --database=pgsql_owner --force
artisan tenant:sequences
artisan tenant:jobs
artisan finance:service-payables
artisan optimize:clear

paso "Cola, procesos programados, tiempo real y web"
dc up -d queue scheduler reverb web

paso "Sitio en Nginx"
if [ ! -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
  rellenar nginx-inicial.conf >"$NGINX_SITIO"
  ln -sf "$NGINX_SITIO" /etc/nginx/sites-enabled/kipucontrol.conf
  recargar_nginx
  paso "Certificado por webroot"
  certbot certonly --webroot -w "$WEBROOT_CERT" -d "$DOMINIO" --non-interactive --agree-tos --deploy-hook "systemctl reload nginx"
fi
rellenar nginx.conf >"$NGINX_SITIO"
ln -sf "$NGINX_SITIO" /etc/nginx/sites-enabled/kipucontrol.conf
recargar_nginx

paso "KipuControl responde"
for intento in $(seq 1 20); do
  codigo="$(codigo_http "$DOMINIO")"
  [[ "$codigo" =~ ^(2|3) ]] && break
  sleep 3
done
[[ "$codigo" =~ ^(2|3) ]] && listo "https://$DOMINIO responde ($codigo)" || aviso "https://$DOMINIO responde $codigo. Mira: docker compose logs web api"
api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/v1/health" || echo 000)"
listo "API: $api"

revisar_otros_sitios "$FOTO"

paso "Listo"
echo "   Entra a https://$DOMINIO/login."
echo "   La contraseña de los usuarios de ejemplo y la llave del segundo paso están en $SECRETOS"
echo "   (DEMO_PASSWORD y DEMO_TOTP_SECRET). Míralas con: grep DEMO_ $SECRETOS"
echo "   Después, en la consola: Configuración → Correo de salida."
echo "   Para actualizar en adelante: bash $APP_DIR/deploy/actualizar.sh"
