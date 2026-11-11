<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
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
            'reminder_days' => 3,
            'expire_days' => 30,
            'subject' => '¿Cómo estuvo tu viaje?',
            'body' => 'Hola {nombre}, gracias por viajar con nosotros. Cuéntanos cómo te fue en {tour}: tu opinión ayuda a otros viajeros.',
        ],
        'last_export' => null,
    ];

    public function __construct(private readonly TenantSettings $settings, private readonly AuditLogger $audit) {}

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
