# Publicar KipuControl en kipucontrol.intelectalab.com

Cada paso dice **dónde** se hace. Hay tres lugares:

| Lugar | Cómo llegas | Cómo sabes que estás ahí |
|---|---|---|
| **Tu PC** | GitHub Desktop, o PowerShell (la terminal de Windows) | La línea empieza con `PS C:\Users\ADMIN>` |
| **El servidor** | En PowerShell de tu PC escribe `ssh licoria` y pulsa Enter | La línea cambia a `root@vmi3223152:~#` |
| **GitHub** | El navegador, en github.com | — |

Para salir del servidor y volver a tu PC, escribe `exit`.

El servidor es compartido. Estos scripts solo crean cosas nuevas de KipuControl:

- el usuario `kipucontrol`;
- la carpeta `/var/www/kipucontrol`;
- sus contenedores;
- el sitio de Nginx `kipucontrol.conf`;
- su certificado;
- las copias en `/var/backups/kipucontrol`.

No tocan los demás proyectos.

## Cada vez que quieras publicar lo nuevo

**1. En tu PC (GitHub Desktop):** haz commit y push de tus cambios.

**2. En tu PC (PowerShell):** entra al servidor.

```bash
ssh licoria
```

**3. En el servidor:** corre la actualización.

```bash
bash /var/www/kipucontrol/deploy/actualizar.sh
```

El script hace esto, en orden:

1. **Mira si hay algo nuevo.** Trae solo lo que ya está en GitHub, en la rama `main`. Si no hay nada nuevo, lo dice y termina sin tocar nada.
2. **Saca una copia de la base** y guarda las 10 últimas.
3. **Actualiza la API:** aplica las migraciones y reinicia.
4. **Recompila la web**, solo si cambió algo en `web/`. Si la compilación falla, la versión anterior sigue funcionando.
5. **Revisa los sitios.** Comprueba que KipuControl y los demás sitios respondan igual que antes.

Otros comandos útiles, también **en el servidor**:

- `bash /var/www/kipucontrol/deploy/actualizar.sh --forzar` recompila y reinicia aunque no haya cambios.
- `bash /var/www/kipucontrol/deploy/estado.sh` muestra cómo está todo: los contenedores, los últimos errores y la memoria.

## La primera vez (una sola vez)

### Paso 1 · En tu PC (PowerShell): entra al servidor

```bash
ssh licoria
```

Todo lo que sigue hasta el paso 3 se escribe **en el servidor**, en esa misma ventana.

### Paso 2 · En el servidor: crea el usuario y la llave de solo lectura

```bash
useradd --create-home --shell /bin/bash kipucontrol
```

```bash
sudo -u kipucontrol -H bash -c 'mkdir -p ~/.ssh && ssh-keygen -t ed25519 -N "" -C kipucontrol-deploy -f ~/.ssh/kipucontrol_deploy && printf "Host github.com\n  IdentityFile ~/.ssh/kipucontrol_deploy\n  IdentitiesOnly yes\n" > ~/.ssh/config && ssh-keyscan github.com >> ~/.ssh/known_hosts && cat ~/.ssh/kipucontrol_deploy.pub'
```

Al final aparece una línea que empieza con `ssh-ed25519`. Cópiala: la necesitas en el paso 3. El usuario no tiene contraseña ni permisos de administrador.

### Paso 3 · En GitHub (navegador): registra la llave

1. Abre el repositorio `intelectalab/QhapaqtravelSuite.intelectalab`.
2. Ve a Settings → Deploy keys → Add deploy key.
3. En el título pon `kipucontrol servidor`. En la llave, pega la línea `ssh-ed25519…` que copiaste.
4. Deja **sin marcar** «Allow write access»: el servidor solo descarga, nunca sube.
5. Pulsa «Add key».

### Paso 4 · En el servidor: descarga el repositorio

Vuelve a la ventana de PowerShell donde estás dentro del servidor.

```bash
install -d -o kipucontrol -g kipucontrol /var/www/kipucontrol
```

```bash
sudo -u kipucontrol -H git clone git@github.com:intelectalab/QhapaqtravelSuite.intelectalab.git /var/www/kipucontrol
```

### Paso 5 · En el servidor: instala

```bash
bash /var/www/kipucontrol/deploy/instalar.sh
```

Tarda unos 10 minutos. El script hace esto, en orden:

1. **Comprueba los puertos.** Revisa que estén libres y anota cómo responden los demás sitios.
2. **Genera las contraseñas** del servidor. Solo las lee root y no van a GitHub.
3. **Levanta KipuControl:** la base, Redis, los archivos, el antivirus, la API, la cola y la web compilada.
4. **Carga los datos de ejemplo.**
5. **Publica el sitio:** crea el sitio de Nginx y saca el certificado.
6. **Revisa los sitios.** Comprueba que KipuControl responda y que los demás sitios sigan igual.

Si se corta a la mitad, se puede volver a correr: conserva lo que ya creó.

### Paso 6 · En el servidor: mira la contraseña de los usuarios de ejemplo

```bash
grep DEMO_ /var/www/kipucontrol/deploy/servidor.env
```

No son las de tu equipo: se generaron solo para el servidor. `DEMO_PASSWORD` es la contraseña y `DEMO_TOTP_SECRET`, la llave del segundo paso.

### Paso 7 · En el navegador: configura el correo

1. Entra a `https://kipucontrol.intelectalab.com/login` con el Super Admin.
2. Ve a Configuración → Correo de salida y escribe:
   - servidor `mail.intelectalab.com`;
   - cifrado SSL, puerto 465;
   - usuario y remitente `prueba@intelectalab.com`;
   - la contraseña del buzón.
3. Guarda y pulsa «Enviar prueba».

## Cómo queda armado

| Pieza | Dónde |
|---|---|
| Web | contenedor `web`, 127.0.0.1:3230 |
| API | contenedores `api` + `nginx`, 127.0.0.1:8230, publicada en `/api` |
| Tiempo real (Reverb) | 127.0.0.1:8231, publicado en `/app` |
| Archivos (S3) | 127.0.0.1:9230, publicado en `/almacen` para los enlaces de descarga firmados |
| Base de datos | PostgreSQL 17 propio, sin puerto hacia afuera |
| Redis, antivirus | propios, sin puerto hacia afuera |
| Contraseñas | `/var/www/kipucontrol/deploy/servidor.env` (solo root) |
| Copias de la base | `/var/backups/kipucontrol` |

El servidor corre con `APP_ENV=staging`: los cobros con tarjeta, la facturación electrónica y WhatsApp usan los simuladores hasta que haya un proveedor real. En modo `production` esos simuladores están prohibidos.
