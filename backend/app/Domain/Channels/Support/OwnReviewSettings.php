<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class OwnReviewSettings
{
    public const SECTION = 'own_reviews';

    public const SUBRATINGS = ['guia' => 'Guía', 'transporte' => 'Transporte', 'alojamiento' => 'Alojamiento', 'organizacion' => 'Organización', 'valor' => 'Precio y valor'];

    public const PERSONAL_DATA = ['retener' => 'Retener la reseña para revisión', 'enmascarar' => 'Ocultar el dato y evaluar el resto'];

    public const CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp'];

    public const DEFAULTS = [
        'auto_publish' => false,
        'banned_words' => [],
        'personal_data' => 'retener',
        'active_subratings' => ['guia', 'transporte', 'alojamiento', 'organizacion', 'valor'],
        'show_on_site' => true,
        'show_on_widget' => true,
        'invite' => [
            'channel' => 'email',
            'reminder_days' => 5,
            'expire_days' => 30,
            'subject' => '¿Cómo estuvo tu viaje?',
            'body' => 'Hola {nombre}, gracias por viajar con nosotros. Cuéntanos cómo te fue en {tour}: tu opinión ayuda a otros viajeros.',
        ],
        'last_export' => null,
    ];

    public function __construct(private readonly TenantSettings $settings, private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public static function read(): array
    {
        $values = DB::table('sys_settings')->where('section', self::SECTION)->value('values');

        return self::merge(is_string($values) ? (array) json_decode($values, true) : []);
    }

    public static function showOnSite(): bool
    {
        return (bool) self::read()['show_on_site'];
    }

    public function detail(): array
    {
        $meta = $this->settings->sections([self::SECTION])[self::SECTION];

        return [
            'values' => self::merge($meta['values']),
            'updated_at' => $meta['updated_at'],
            'updated_by' => $meta['updated_by'],
            'lock_version' => $meta['lock_version'],
            'options' => [
                'subratings' => self::options(self::SUBRATINGS),
                'personal_data' => self::options(self::PERSONAL_DATA),
                'channels' => self::options(self::CHANNELS),
                'placeholders' => ['{nombre}', '{tour}', '{agencia}', '{enlace}'],
            ],
            'preview' => $this->preview(),
            'export' => $this->export(),
        ];
    }

    private function export(): ?array
    {
        $config = DB::table('channel_widget_config')->first(['public_key']);

        if ($config === null) {
            return null;
        }

        $tenant = $this->context->tenant();
        $published = DB::table('crm_own_reviews as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->whereNull('r.deleted_at')->where('r.status', 'publicada');
        $top = (clone $published)->groupBy('p.code', 'p.slug', 'p.name')->orderByRaw('count(*) desc')->first(['p.code', 'p.slug', 'p.name', DB::raw('count(*) as total'), DB::raw('avg(r.stars) as average')]);
        $latest = [];

        foreach ($top === null ? [] : (clone $published)->where('p.code', $top->code)->orderByDesc('r.published_at')->limit(3)->get(['r.author_display', 'r.stars', 'r.title', 'r.body', 'r.travel_date']) as $row) {
            $latest[] = [
                '@type' => 'Review',
                'author' => ['@type' => 'Person', 'name' => $row->author_display],
                'datePublished' => (string) $row->travel_date,
                'name' => $row->title,
                'reviewBody' => $row->body,
                'reviewRating' => ['@type' => 'Rating', 'ratingValue' => (int) $row->stars, 'bestRating' => 5],
            ];
        }

        $jsonLd = $top === null ? null : [
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            'name' => $top->name,
            'brand' => ['@type' => 'Organization', 'name' => (string) $tenant->commercial_name],
            'aggregateRating' => ['@type' => 'AggregateRating', 'ratingValue' => round((float) $top->average, 1), 'reviewCount' => (int) $top->total, 'bestRating' => 5],
            'review' => $latest,
        ];

        return [
            'public_key' => $config->public_key,
            'key_header' => (string) config('sites.key_header'),
            'cdn' => WidgetHosts::cdn(),
            'host' => WidgetHosts::host((string) $tenant->subdomain),
            'feed_url' => rtrim((string) config('app.url'), '/').'/api/v1/public/reviews'.($top?->slug ? '?product='.rawurlencode((string) $top->slug) : ''),
            'product' => $top ? ['code' => $top->code, 'name' => $top->name] : null,
            'json_ld' => $jsonLd,
        ];
    }

    private function preview(): array
    {
        $tenant = $this->context->tenant();
        $sample = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada', 'borrador'])->whereNotNull('r.travel_to')->orderByDesc('r.travel_to')
            ->first(['r.code', 'r.title', 'c.name']);
        $name = $sample !== null ? trim(explode(' ', trim((string) $sample->name))[0]) : '';

        return [
            'nombre' => $name !== '' ? $name : 'viajero',
            'tour' => (string) ($sample->title ?? 'tu viaje'),
            'agencia' => (string) $tenant->commercial_name,
            'enlace' => WidgetHosts::site((string) $tenant->subdomain).'/resena/SRV-0000',
            'reservation' => $sample->code ?? null,
        ];
    }

    public function update(array $data, User $actor, ?int $lockVersion): array
    {
        $current = $this->detail();

        if ($lockVersion !== null && $lockVersion !== $current['lock_version']) {
            throw ApiException::conflict('STALE_VERSION', 'Otra persona cambió estos ajustes. Recarga para ver la versión actual.');
        }

        $valid = Validator::make($data, [
            'auto_publish' => ['sometimes', 'boolean'],
            'banned_words' => ['sometimes', 'array', 'max:200'],
            'banned_words.*' => ['string', 'min:2', 'max:60'],
            'personal_data' => ['sometimes', Rule::in(array_keys(self::PERSONAL_DATA))],
            'active_subratings' => ['sometimes', 'array', 'min:1'],
            'active_subratings.*' => [Rule::in(array_keys(self::SUBRATINGS))],
            'show_on_site' => ['sometimes', 'boolean'],
            'show_on_widget' => ['sometimes', 'boolean'],
            'invite' => ['sometimes', 'array'],
            'invite.channel' => ['sometimes', Rule::in(array_keys(self::CHANNELS))],
            'invite.reminder_days' => ['sometimes', 'integer', 'min:0', 'max:30'],
            'invite.expire_days' => ['sometimes', 'integer', 'min:3', 'max:120'],
            'invite.subject' => ['sometimes', 'string', 'min:5', 'max:150'],
            'invite.body' => ['sometimes', 'string', 'min:20', 'max:2000', 'regex:/\{enlace\}|\{tour\}|\{nombre\}/'],
        ], [
            'banned_words.*.*' => 'Cada palabra debe tener entre 2 y 60 caracteres.',
            'personal_data.*' => 'Elige qué hacer con los datos personales.',
            'active_subratings.min' => 'Deja al menos un aspecto para calificar.',
            'active_subratings.*.*' => 'Ese aspecto no existe.',
            'invite.channel.*' => 'Elige el canal de la invitación.',
            'invite.reminder_days.*' => 'El recordatorio va de 0 a 30 días.',
            'invite.expire_days.*' => 'La invitación vence entre 3 y 120 días.',
            'invite.subject.*' => 'Escribe un asunto de 5 a 150 caracteres.',
            'invite.body.*' => 'El mensaje necesita al menos 20 caracteres y algún dato del viaje, como {nombre} o {tour}.',
        ])->validate();

        $before = $current['values'];
        $after = self::merge([...$before, ...$valid, 'invite' => [...$before['invite'], ...($valid['invite'] ?? [])]]);
        $after['banned_words'] = array_values(array_unique(array_map(fn (string $word): string => mb_strtolower(trim($word)), $after['banned_words'])));

        if (($after['invite']['reminder_days'] ?? 0) >= ($after['invite']['expire_days'] ?? 30)) {
            throw ValidationException::withMessages(['invite.reminder_days' => 'El recordatorio debe enviarse antes de que venza la invitación.']);
        }

        DB::transaction(function () use ($after, $before, $actor): void {
            $this->settings->save(self::SECTION, $after, $actor);
            $changes = TenantSettings::changes(self::flat($before), self::flat($after));
            $old = [];
            $new = [];
            foreach ($changes as $key => [$from, $to]) {
                $old[] = "{$key}: ".(TenantSettings::text($from) ?? '—');
                $new[] = "{$key}: ".(TenantSettings::text($to) ?? '—');
            }
            $this->audit->log('Ajustes de reseñas', self::SECTION, 'actualizar', $old === [] ? null : implode(' · ', $old), $new === [] ? 'sin cambios' : implode(' · ', $new));
        });

        return $this->detail();
    }

    private static function merge(array $stored): array
    {
        $values = [...self::DEFAULTS, ...array_intersect_key($stored, self::DEFAULTS)];
        $values['invite'] = [...self::DEFAULTS['invite'], ...array_intersect_key((array) ($stored['invite'] ?? []), self::DEFAULTS['invite'])];
        $values['banned_words'] = array_values(array_map('strval', (array) $values['banned_words']));
        $values['active_subratings'] = array_values(array_filter((array) $values['active_subratings'], fn (mixed $key): bool => is_string($key) && isset(self::SUBRATINGS[$key])));

        return $values;
    }

    private static function flat(array $values): array
    {
        $flat = [];

        foreach ($values as $key => $value) {
            if ($key === 'invite') {
                foreach ((array) $value as $inner => $text) {
                    $flat["invite.{$inner}"] = $text;
                }

                continue;
            }

            $flat[$key] = is_array($value) ? implode(', ', $value) : $value;
        }

        return $flat;
    }

    private static function options(array $map): array
    {
        $options = [];

        foreach ($map as $value => $label) {
            $options[] = ['value' => $value, 'label' => $label];
        }

        return $options;
    }
}
