FROM php:8.4-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      git unzip libpq-dev libzip-dev libicu-dev libpng-dev libjpeg-dev libfreetype6-dev \
      libfcgi-bin chromium fonts-liberation \
  && docker-php-ext-configure gd --with-freetype --with-jpeg \
  && docker-php-ext-install -j$(nproc) pdo_pgsql pgsql intl zip bcmath gd pcntl opcache exif \
  && pecl install redis && docker-php-ext-enable redis \
  && rm -rf /var/lib/apt/lists/*

# Endpoint de estado para el healthcheck (cgi-fcgi de libfcgi-bin)
RUN echo "pm.status_path = /status" >> /usr/local/etc/php-fpm.d/zz-docker.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY php.ini /usr/local/etc/php/conf.d/zz-kipucontrol.ini

# PDF (vouchers, comprobantes, itinerarios) con Chromium headless (spatie/browsershot o similar)
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /var/www/backend
